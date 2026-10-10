/* LearnSphere - Security, Section 03: Authorization & Least Privilege.
   Lectures 0-5 are core, 6+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const SG=O.D+'dbseg/';

/* ---------- diagrams ---------- */
const priv=O.dg(700,190,[
[10,60,130,70,'User',0],
[190,60,130,70,'Role|(group of|privileges)',2],
[370,25,150,60,'System privilege|CREATE TABLE',0],
[370,105,150,60,'Object privilege|SELECT on app.orders',0],
[560,60,130,70,'Schema privilege|(23ai and later)',0]],
[[140,95,190,95],[320,80,370,55],[320,110,370,135],[520,55,560,85]]);

/* ---------- 0: Privilege review ---------- */
L['ora-sec:2:0']={blocks:[
{p:'Privileges control **what a user can do**. Four kinds, from broad to narrow.'},
{svg:priv},
{t:[['Kind','Example','Scope'],
['**System privilege**','`CREATE TABLE`, `ALTER SYSTEM`, `SELECT ANY TABLE`','Database wide'],
['**Object privilege**','`SELECT ON app.orders`','One object'],
['**Role**','`CONNECT`, a custom `APP_READ`','Bundle of privileges'],
['**Schema privilege** (23ai and later)','`GRANT SELECT ANY TABLE ON SCHEMA app TO u`','All objects of one schema, including future ones']]},
{code:`-- what does a user have?
SELECT * FROM dba_sys_privs WHERE grantee=\'APP_USER\';
SELECT * FROM dba_tab_privs WHERE grantee=\'APP_USER\';
SELECT * FROM dba_role_privs WHERE grantee=\'APP_USER\';

-- roles of a role
SELECT * FROM role_role_privs;`},
{h:'Good practice'},
{ul:['Grant to **roles**, and roles to users.','Prefer object privileges over system privileges.','Use `WITH ADMIN OPTION` and `WITH GRANT OPTION` only for specific delegation.']},
{note:'Use the **schema privilege** feature where available instead of `ANY` privileges. It gives access to one schema only.'}],
src:[['Privileges and roles',SG]]};

/* ---------- 1: ANY and PUBLIC ---------- */
L['ora-sec:2:1']={blocks:[
{p:'Two things create risk quietly: **`ANY` privileges** and **grants to `PUBLIC`**.'},
{t:[['Risk','Why it is dangerous','Check'],
['**`SELECT ANY TABLE`**','Reads every table in every schema, including `SYS` objects in some configs','`DBA_SYS_PRIVS` where privilege like \'%ANY%\''],
['**`CREATE ANY ...`, `ALTER ANY ...`**','Creates objects in other schemas, a route to escalation','Same'],
['**`PUBLIC` grants**','Everyone has them, including accounts created later','`DBA_TAB_PRIVS` where grantee = \'PUBLIC\''],
['**`EXECUTE` on `UTL_FILE`, `UTL_HTTP`, `UTL_TCP`, `DBMS_LOB`...**','Allows file and network access','Revoke from PUBLIC where not needed'],
['**`DBA` role**','Everything','Who has it?']]},
{code:`SELECT grantee, privilege FROM dba_sys_privs
WHERE privilege LIKE \'%ANY%\' AND grantee NOT IN (SELECT username FROM dba_users WHERE oracle_maintained=\'Y\')
ORDER BY grantee;

SELECT table_name, privilege FROM dba_tab_privs
WHERE grantee=\'PUBLIC\' AND table_name IN (\'UTL_FILE\',\'UTL_HTTP\',\'UTL_TCP\',\'UTL_SMTP\',\'DBMS_RANDOM\');`},
{note:'Revoke from PUBLIC carefully in a test system. Some applications use these packages. Replace with grants to a specific role.'}],
src:[['Privilege risks',SG]]};

/* ---------- 2: Privilege analysis ---------- */
L['ora-sec:2:2']={blocks:[
{p:'**Privilege analysis** records which privileges a user or role **actually uses**, then lists the unused ones, so you can safely revoke them.'},
{code:`BEGIN
  DBMS_PRIVILEGE_CAPTURE.CREATE_CAPTURE(
    name => \'app_cap\', type => DBMS_PRIVILEGE_CAPTURE.G_ROLE, roles => role_name_list(\'APP_ROLE\'));
  DBMS_PRIVILEGE_CAPTURE.ENABLE_CAPTURE(\'app_cap\');
END;
/
-- ... run the application for a representative period ...
EXEC DBMS_PRIVILEGE_CAPTURE.DISABLE_CAPTURE(\'app_cap\');
EXEC DBMS_PRIVILEGE_CAPTURE.GENERATE_RESULT(\'app_cap\');

SELECT * FROM dba_unused_privs WHERE capture=\'app_cap\';
SELECT * FROM dba_used_privs WHERE capture=\'app_cap\';`},
{flow:['Create the capture for a user or role','Run a full business cycle (month end, batch)','Generate the result','Review unused privileges','Revoke and test']},
{t:[['Capture type','Scope'],
['**Database**','All privilege use'],
['**Role**','Use of the listed roles'],
['**Context**','Under a condition (user, program)'],
['**Role and context**','Combined']]},
{note:'Capture a **full cycle** (including rare jobs) before revoking. An unused privilege today may be needed at quarter-end.'}],
src:[['Privilege analysis',SG]]};

/* ---------- 3: Invoker rights ---------- */
L['ora-sec:2:3']={blocks:[
{p:'PL/SQL runs with the rights of its **owner** (definer) by default. You can choose **invoker** rights, and you can control access with **code-based roles**.'},
{t:[['Mode','Runs with','Use'],
['**Definer\'s rights** (default)','The privileges of the owner (without roles)','Controlled access: the user can only do what the code does'],
['**Invoker\'s rights** (`AUTHID CURRENT_USER`)','The privileges of the caller','Shared utilities that act on the caller\'s data'],
['**Code-based access** (`GRANT role TO PROCEDURE`)','Owner privileges plus a role granted to the code (`INHERIT PRIVILEGES` rules apply)','Narrow, code-limited extra privileges']]},
{code:`-- definer: the user gets only what the procedure does
CREATE OR REPLACE PROCEDURE app.get_salary(p_id NUMBER, p_out OUT NUMBER) AS
BEGIN SELECT salary INTO p_out FROM app.emp WHERE id=p_id; END;
/
GRANT EXECUTE ON app.get_salary TO clerk;

-- invoker
CREATE OR REPLACE PROCEDURE util.count_rows(p_tab VARCHAR2) AUTHID CURRENT_USER AS ...

-- code-based role
GRANT hr_admin_role TO PROCEDURE app.run_payroll;`},
{h:'Security points'},
{ul:['A definer procedure that builds dynamic SQL from input is an injection risk with the owner\'s power.','Since 12c, `INHERIT PRIVILEGES` controls whether an invoker-rights procedure can use the caller\'s privileges.']},
{note:'Use definer\'s rights with **narrow** procedures as a security boundary: the user cannot select the table, but can call the controlled procedure.'}],
src:[['Invoker and definer rights',SG]]};

/* ---------- 4: Secure application roles and context ---------- */
L['ora-sec:2:4']={blocks:[
{p:'A **secure application role** is enabled only when a package says the **conditions** are met, such as the connection comes from the application server.'},
{code:`-- context set by a trusted package
CREATE CONTEXT app_ctx USING app.ctx_pkg;

-- role enabled through a package
CREATE ROLE app_role IDENTIFIED USING app.role_pkg;

CREATE OR REPLACE PACKAGE BODY app.role_pkg AS
  PROCEDURE enable_role IS
  BEGIN
    IF SYS_CONTEXT(\'USERENV\',\'IP_ADDRESS\') = \'10.1.2.3\' THEN
      DBMS_SESSION.SET_ROLE(\'app_role\');
    END IF;
  END;
END;
/`},
{t:[['Piece','Meaning'],
['**Application context**','Session attributes set only by a trusted package'],
['**Secure application role**','Role enabled only by its package'],
['**`SYS_CONTEXT(\'USERENV\', ...)`**','Built-in facts: IP address, host, module, authentication method']]},
{h:'Typical conditions'},
{ul:['Only from the application server IP.','Only for a specific program or module.','Only with a certain authentication method (strong, not password).']},
{note:'The context can be set only by the package named in `CREATE CONTEXT`. Users cannot fake it with their own `SET` commands.'}],
src:[['Secure application roles',SG]]};

/* ---------- 5: Practical ---------- */
L['ora-sec:2:5']={blocks:[
{p:'**Reduce an over-privileged application schema** step by step with privilege analysis.'},
{code:`-- 1. situation: the application account is too strong
GRANT DBA TO app_user;     -- (the "before" state, do not do this in production)

-- 2. capture
BEGIN
  DBMS_PRIVILEGE_CAPTURE.CREATE_CAPTURE(\'app_cap\', DBMS_PRIVILEGE_CAPTURE.G_CONTEXT,
     condition => \'SYS_CONTEXT(\'\'USERENV\'\',\'\'SESSION_USER\'\')=\'\'APP_USER\'\'\');
  DBMS_PRIVILEGE_CAPTURE.ENABLE_CAPTURE(\'app_cap\');
END;
/
-- 3. run the application's tests
-- 4. report
EXEC DBMS_PRIVILEGE_CAPTURE.DISABLE_CAPTURE(\'app_cap\');
EXEC DBMS_PRIVILEGE_CAPTURE.GENERATE_RESULT(\'app_cap\');
SELECT sys_priv, obj_priv, object_owner, object_name FROM dba_used_privs WHERE capture=\'app_cap\';

-- 5. replace DBA with a role of what was used
CREATE ROLE app_min;
-- GRANT only the used privileges to app_min ...
REVOKE DBA FROM app_user;
GRANT app_min TO app_user;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['Used privileges list','Much shorter than DBA'],
['After revoke','Application tests still pass'],
['`DBA_ROLE_PRIVS`','`DBA` not granted to app_user'],
['`PUBLIC` grants reviewed','Dangerous packages revoked where unused']]},
{note:'The aim is a role that lists **exactly** what the application needs, with a document that proves it from captured data.'}],
src:[['Privilege analysis',SG]]};

})();
