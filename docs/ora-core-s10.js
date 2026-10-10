/* LearnSphere - Oracle Core DBA, Section 10: Users, Privileges & Roles.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const model=O.dg(700,200,[
[10,70,110,60,'Users|SHOP_APP|SHOP_RPT',2],[170,15,140,50,'Role SHOP_RW',0],[170,135,140,50,'Role SHOP_RO',0],
[370,15,150,50,'INSERT UPDATE DELETE|SELECT',0],[370,135,150,50,'SELECT only',0],
[570,70,120,60,'Objects in|schema SHOP',2]],
[[120,90,170,45],[120,110,170,155],[310,40,370,40],[310,160,370,160],[520,40,570,90],[520,160,570,110]]);

const login=O.dg(700,120,[
[10,30,130,60,'Password|stored as a hash',0],[180,30,130,60,'External|OS or Kerberos|identity',0],[350,30,150,60,'No authentication|schema-only|account',0],[540,30,150,60,'Global|directory or cloud|identity (IAM)',0]],[]);

/* ---------- 0: Users and authentication ---------- */
L['ora-core:9:0']={blocks:[
{p:'A **user** is an account that can connect. A **schema** is the set of objects that user owns. In Oracle the two have the same name, so people often use the words together.'},
{h:'User vs schema'},
{t:[['Term','Meaning'],
['**User**','An account with a name and a way to log in'],
['**Schema**','The tables, views and code owned by that user'],
['**Schema-only account**','A user that owns objects but cannot log in with a password']]},
{h:'How a user proves who they are'},
{svg:login},
{t:[['Method','How it works','Use for'],
['**Password**','`IDENTIFIED BY password`. Oracle stores a salted hash.','Most accounts'],
['**External**','`IDENTIFIED EXTERNALLY`. The OS or Kerberos vouches for the user.','Operating system accounts, batch jobs'],
['**Global**','`IDENTIFIED GLOBALLY`. A directory, Active Directory or cloud IAM.','Enterprise single sign-on'],
['**No authentication**','`NO AUTHENTICATION`. Nobody can log in as this account.','**Schema owners** for applications']]},
{code:`-- Example account types
CREATE USER app_owner NO AUTHENTICATION;                 -- owns tables, cannot log in
CREATE USER app_user  IDENTIFIED BY ChooseAPassword1;    -- a normal login

SELECT username, authentication_type, account_status
FROM   dba_users WHERE oracle_maintained = 'N';`},
{flow:['User sends a name and a credential','Oracle checks it with the chosen method','Account must be OPEN (not locked or expired)','CREATE SESSION privilege is required to complete the login','Session starts']},
{note:'Best practice: the application owner is a schema-only account. The application logs in as a different user with only the rights it needs. If the app account is stolen, the attacker cannot drop tables.'}],
src:[['Managing security for users',O.AD+'managing-users-and-securing-the-database.html'],['Database Security Guide',D+'dbseg/']]};

/* ---------- 1: Creating users ---------- */
L['ora-core:9:1']={blocks:[
{p:'Creating a user is one statement, but each option matters: where the user stores data, how much space they may use, and what happens to the password.'},
{h:'A complete example'},
{code:`CREATE USER shop_app IDENTIFIED BY ChooseAPassword1
  DEFAULT TABLESPACE shop_data
  TEMPORARY TABLESPACE temp
  QUOTA 5G ON shop_data
  PROFILE default
  PASSWORD EXPIRE;

GRANT CREATE SESSION TO shop_app;`},
{t:[['Clause','Meaning'],
['`DEFAULT TABLESPACE`','Where the user objects go if none is named'],
['`TEMPORARY TABLESPACE`','Where sorts spill to'],
['`QUOTA`','How much space the user may use in a tablespace. Without a quota the user cannot create objects.'],
['`PROFILE`','Password and resource rules'],
['`PASSWORD EXPIRE`','The user must change the password at first login'],
['`ACCOUNT LOCK`','The account cannot connect']]},
{h:'Change, lock and remove'},
{code:`ALTER USER shop_app QUOTA 10G ON shop_data;
ALTER USER shop_app ACCOUNT LOCK;
ALTER USER shop_app ACCOUNT UNLOCK;
ALTER USER shop_app IDENTIFIED BY NewPassword2;

DROP USER shop_app CASCADE;       -- removes the user AND all objects`},
{h:'Account status'},
{t:[['Status','Meaning'],
['`OPEN`','Can log in'],
['`LOCKED`','Locked by a DBA'],
['`LOCKED(TIMED)`','Locked after failed logins, unlocks after a set time'],
['`EXPIRED`','Password must be changed'],
['`EXPIRED(GRACE)`','Password has expired but a grace period still allows logins']]},
{code:`SELECT username, account_status, lock_date, expiry_date FROM dba_users WHERE username = 'SHOP_APP';
SELECT username, tablespace_name, max_bytes FROM dba_ts_quotas WHERE username = 'SHOP_APP';`},
{note:'Avoid the UNLIMITED TABLESPACE privilege. It overrides every quota. Grant a quota on a named tablespace instead. Before DROP USER CASCADE, check the name twice, because it removes all data of that schema.'}],
src:[['CREATE USER',D+'sqlrf/CREATE-USER.html'],['Managing users',O.AD+'managing-users-and-securing-the-database.html']]};

/* ---------- 2: Privileges and roles ---------- */
L['ora-core:9:2']={blocks:[
{p:'A **privilege** is the right to do something. A **role** is a named bundle of privileges that you grant as one unit. Grant roles to users, not individual privileges.'},
{svg:model},
{h:'Two kinds of privilege'},
{t:[['Kind','What it allows','Example'],
['**System privilege**','An action in the database','`CREATE SESSION`, `CREATE TABLE`, `ALTER SYSTEM`'],
['**Object privilege**','An action on one object','`SELECT ON hr.employees`, `EXECUTE ON pkg_x`']]},
{p:'Privileges with **ANY** in the name, such as `SELECT ANY TABLE`, work on every schema. Treat them as dangerous.'},
{code:`-- Object privilege
GRANT SELECT ON hr.employees TO shop_app;

-- Role
CREATE ROLE shop_ro;
GRANT SELECT ON shop.orders TO shop_ro;
GRANT shop_ro TO shop_rpt;

-- Take it away
REVOKE shop_ro FROM shop_rpt;`},
{h:'Passing privileges on'},
{t:[['Option','Used with','Effect of REVOKE'],
['`WITH ADMIN OPTION`','System privileges and roles','Does **not** cascade to users who got it from them'],
['`WITH GRANT OPTION`','Object privileges','**Does** cascade to those who received it']]},
{h:'See who has what'},
{code:`SELECT * FROM dba_sys_privs  WHERE grantee = 'SHOP_APP';
SELECT * FROM dba_tab_privs  WHERE grantee = 'SHOP_APP';
SELECT * FROM dba_role_privs WHERE grantee = 'SHOP_APP';
SELECT * FROM session_privs;          -- what I have right now`},
{flow:['Define the job: what must this account do?','Group the rights in a role','Grant the role to the user','Test with the user, then review with the dictionary views']},
{note:'ORA-00942 means the object does not exist or you may not see it. ORA-01031 means insufficient privileges. Both usually point to a missing grant.'}],
src:[['Managing privileges and roles',D+'dbseg/configuring-privilege-and-role-authorization.html'],['GRANT',D+'sqlrf/GRANT.html']]};

/* ---------- 3: Predefined roles and least privilege ---------- */
L['ora-core:9:3']={blocks:[
{p:'Oracle ships many roles. Some are safe and narrow, others are very powerful. Knowing the difference is the heart of **least privilege**: give only what is needed.'},
{h:'Roles you will meet'},
{t:[['Role','What it gives','Risk'],
['`CONNECT`','`CREATE SESSION` only (since 12.2)','Low'],
['`RESOURCE`','Create common object types in your own schema','Medium, often more than needed'],
['`SELECT_CATALOG_ROLE`','Read the dictionary and `V$` views','Low to medium'],
['`DATAPUMP_EXP_FULL_DATABASE` / `DATAPUMP_IMP_FULL_DATABASE`','Full-database export and import','High'],
['`PDB_DBA`','DBA tasks inside one PDB','Medium'],
['`DBA`','Almost everything except starting and stopping','**Very high**']]},
{h:'The least privilege ladder'},
{flow:['Start with nothing','Grant CREATE SESSION to log in','Add only the object privileges needed, through a role','Never grant DBA or ANY privileges to an application account','Review regularly and remove unused rights']},
{h:'Typical account design'},
{t:[['Account','Gets','Does not get'],
['**Schema owner**','CREATE TABLE and similar, quota','Login (NO AUTHENTICATION)'],
['**Application user**','Role with DML on needed tables','DDL, ANY, DBA'],
['**Read-only user**','Role with SELECT','Any change'],
['**Operations DBA**','A named account with a role such as `PDB_DBA`','The shared SYS password']]},
{h:'Check for over-privileged accounts'},
{code:`-- Who has the DBA role?
SELECT grantee FROM dba_role_privs WHERE granted_role = 'DBA';

-- Who has dangerous ANY privileges?
SELECT grantee, privilege FROM dba_sys_privs
WHERE  privilege LIKE '%ANY%' AND grantee NOT IN (SELECT username FROM dba_users WHERE oracle_maintained = 'Y');`},
{note:'Privilege Analysis (DBMS_PRIVILEGE_CAPTURE) can record which privileges an account actually uses, so you can remove the rest. Check your licence for it before you rely on it.'}],
src:[['Predefined roles',D+'dbseg/configuring-privilege-and-role-authorization.html'],['Database Security Guide',D+'dbseg/']]};

/* ---------- 4: Profiles ---------- */
L['ora-core:9:4']={blocks:[
{p:'A **profile** is a set of rules for passwords and resource use. Every user has one. If you do not choose, the user gets the `DEFAULT` profile.'},
{h:'Password settings'},
{t:[['Parameter','Meaning'],
['`FAILED_LOGIN_ATTEMPTS`','Wrong passwords before the account locks'],
['`PASSWORD_LOCK_TIME`','Days the account stays locked'],
['`PASSWORD_LIFE_TIME`','Days before the password expires'],
['`PASSWORD_GRACE_TIME`','Days a user can still log in after expiry'],
['`PASSWORD_REUSE_TIME` / `PASSWORD_REUSE_MAX`','Limit reuse of old passwords'],
['`PASSWORD_VERIFY_FUNCTION`','A function that checks password strength'],
['`INACTIVE_ACCOUNT_TIME`','Days of no login before the account is locked']]},
{h:'Resource limits'},
{t:[['Parameter','Limits'],
['`SESSIONS_PER_USER`','Concurrent sessions'],
['`CPU_PER_SESSION`, `CPU_PER_CALL`','CPU time'],
['`CONNECT_TIME`','Total session time (minutes)'],
['`IDLE_TIME`','Minutes of inactivity before disconnect'],
['`LOGICAL_READS_PER_CALL`','Reads per statement']]},
{code:`CREATE PROFILE app_profile LIMIT
  FAILED_LOGIN_ATTEMPTS  5
  PASSWORD_LOCK_TIME     1/24
  PASSWORD_LIFE_TIME     90
  PASSWORD_GRACE_TIME    7
  PASSWORD_REUSE_MAX     5
  PASSWORD_VERIFY_FUNCTION ora12c_verify_function
  SESSIONS_PER_USER      10
  IDLE_TIME              60;

ALTER USER shop_app PROFILE app_profile;

SELECT profile, resource_name, limit FROM dba_profiles WHERE profile = 'APP_PROFILE';`},
{p:'`1/24` means one hour (fractions of a day). The verify function checks length and complexity. Resource limits only apply if `RESOURCE_LIMIT = TRUE`, which is the default in current releases.'},
{flow:['Define a profile for each kind of account','Assign users to it','Oracle counts failures and locks the account at the limit','A DBA unlocks the account when the cause is known']},
{note:'Service accounts used by applications can have no expiry (PASSWORD_LIFE_TIME UNLIMITED) because an expired password would stop the application. Protect them in other ways: a vault, limited rights and network controls.'}],
src:[['CREATE PROFILE',D+'sqlrf/CREATE-PROFILE.html'],['Configuring user authentication',D+'dbseg/configuring-authentication.html']]};

/* ---------- 5: Administrative privileges ---------- */
L['ora-core:9:5']={blocks:[
{p:'**Administrative privileges** let a user do things no normal user can: start and stop the database, recover it, manage encryption keys. Each one is narrow and connects to its own schema.'},
{t:[['Privilege','Typical use','Connects as schema'],
['`SYSDBA`','Full control: startup, shutdown, create, recover','`SYS`'],
['`SYSOPER`','Startup, shutdown, backup. No view of user data.','`PUBLIC`'],
['`SYSBACKUP`','Backup and recovery tools such as RMAN','`SYSBACKUP`'],
['`SYSDG`','Data Guard operations','`SYSDG`'],
['`SYSKM`','Encryption key management','`SYSKM`'],
['`SYSRAC`','Run RAC (Clusterware) operations','`SYSRAC`']]},
{code:`-- Connect with the privilege
sqlplus / as sysbackup
sqlplus backup_admin@//host:1521/FREE as sysbackup

SHOW USER      -- SYSBACKUP

-- Grant (from the root, to a common user)
GRANT SYSBACKUP TO c##backup_admin CONTAINER = ALL;`},
{h:'The password file'},
{p:'Users with an administrative privilege are listed in the **password file** so they can log in even when the database is closed.'},
{code:`SHOW PARAMETER remote_login_passwordfile       -- EXCLUSIVE is normal
SELECT username, sysdba, sysoper, sysbackup, sysdg, syskm FROM v$pwfile_users;`},
{h:'Rules'},
{ul:['Use the narrowest privilege that does the job: SYSBACKUP for backups, not SYSDBA.','Give each person a named account. Do not share the SYS password.','`SYSDBA` can see everything, so audit its use.','Restrict where SYSDBA connections may come from, and protect the password file.']},
{flow:['Backup operator needs RMAN','Grant SYSBACKUP to a named common user','The user connects AS SYSBACKUP','SYSDBA stays with a small group, and its use is audited']},
{note:'OS authentication works for SYSDBA when your OS user belongs to the right group (normally dba). Anyone with that group on the server effectively has SYSDBA.'}],
src:[['Administrative privileges',D+'dbseg/configuring-privilege-and-role-authorization.html'],['Password file',O.AD+'managing-users-and-securing-the-database.html']]};

/* ---------- 6: Schema-level privileges ---------- */
L['ora-core:9:6']={blocks:[
{p:'Before 23ai, the only way to give a user access to **all tables of one schema** was a `SELECT ANY TABLE` privilege (too wide, covers every schema) or one grant per table (too much work and forgotten for new tables). **Schema-level privileges** solve this.'},
{t:[['','Before (19c)','Schema-level privilege (23ai and later)'],
['**Read all tables of HR**','`SELECT ANY TABLE` (all schemas) or one grant per table','`GRANT SELECT ANY TABLE ON SCHEMA hr TO analyst;`'],
['**New tables created later**','Need new grants','Covered automatically'],
['**Risk**','Very wide, or very manual','Limited to one schema']]},
{code:`-- 23ai and later
GRANT SELECT ANY TABLE ON SCHEMA hr TO analyst;
GRANT CREATE ANY TABLE  ON SCHEMA shop TO shop_dev;

REVOKE SELECT ANY TABLE ON SCHEMA hr FROM analyst;

SELECT * FROM dba_schema_privs WHERE grantee = 'ANALYST';`},
{h:'What you can do'},
{t:[['Statement type','Examples of schema-level grants'],
['Query','`SELECT ANY TABLE`'],
['Change data','`INSERT ANY TABLE`, `UPDATE ANY TABLE`, `DELETE ANY TABLE`'],
['Create objects','`CREATE ANY TABLE`, `CREATE ANY VIEW`'],
['Run code','`EXECUTE ANY PROCEDURE`']]},
{note:'This works in 23ai and 26ai only **[26ai]**. In 19c you still use a role with object grants, and a short script that re-grants after new tables are added.'},
{h:'19c alternative'},
{code:`-- 19c: generate grants for all current tables of a schema
BEGIN
  FOR t IN (SELECT table_name FROM dba_tables WHERE owner = 'HR') LOOP
    EXECUTE IMMEDIATE 'GRANT SELECT ON hr.' || t.table_name || ' TO hr_ro';
  END LOOP;
END;
/`},
{flow:['A new reporting user needs read access to one schema','On 26ai grant SELECT ANY TABLE ON SCHEMA','On 19c use a role and refresh its grants when tables change']}],
src:[['Schema privileges in 26ai',O.D26+'dbseg/'],['Privileges and roles in 19c',D+'dbseg/']]};

/* ---------- 7: Practical ---------- */
L['ora-core:9:7']={blocks:[
{p:'Build a small **least-privilege model** for a shop application. You create a schema owner, an application user and a reporting user, and prove that each can only do what it should.'},
{h:'Design'},
{t:[['Account','Purpose','Rights'],
['`SHOP`','Owns the tables','No login. Creates objects.'],
['`SHOP_APP`','Application','Read and change data (role `SHOP_RW`)'],
['`SHOP_RPT`','Reports','Read only (role `SHOP_RO`)']]},
{h:'Step 1: Create the accounts and profile'},
{code:`ALTER SESSION SET CONTAINER = FREEPDB1;

CREATE PROFILE shop_profile LIMIT FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LOCK_TIME 1/24 SESSIONS_PER_USER 10;

CREATE USER shop NO AUTHENTICATION DEFAULT TABLESPACE users QUOTA 500M ON users;
GRANT CREATE TABLE TO shop;

CREATE USER shop_app IDENTIFIED BY ChooseAPassword1 PROFILE shop_profile;
CREATE USER shop_rpt IDENTIFIED BY ChooseAPassword1 PROFILE shop_profile;
GRANT CREATE SESSION TO shop_app, shop_rpt;`},
{h:'Step 2: Create objects and roles'},
{code:`CREATE TABLE shop.orders (id NUMBER PRIMARY KEY, customer VARCHAR2(50), total NUMBER);
INSERT INTO shop.orders VALUES (1, 'Acme', 100);
COMMIT;

CREATE ROLE shop_rw;
CREATE ROLE shop_ro;
GRANT SELECT, INSERT, UPDATE, DELETE ON shop.orders TO shop_rw;
GRANT SELECT ON shop.orders TO shop_ro;
GRANT shop_rw TO shop_app;
GRANT shop_ro TO shop_rpt;`},
{h:'Step 3: Test it'},
{code:`CONNECT shop_rpt/ChooseAPassword1@//localhost:1521/FREEPDB1
SELECT * FROM shop.orders;                 -- works
DELETE FROM shop.orders;                   -- ORA-01031 insufficient privileges

CONNECT shop_app/ChooseAPassword1@//localhost:1521/FREEPDB1
UPDATE shop.orders SET total = 120 WHERE id = 1;     -- works
DROP TABLE shop.orders;                    -- ORA-00942 or ORA-01031

CONNECT shop/anything                      -- fails: no authentication`},
{h:'Step 4: Review'},
{code:`SELECT grantee, privilege, table_name FROM dba_tab_privs WHERE owner = 'SHOP';
SELECT grantee, granted_role FROM dba_role_privs WHERE grantee LIKE 'SHOP%';`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`shop_rpt` can SELECT','Yes'],
['`shop_rpt` can DELETE','No, ORA-01031'],
['`shop_app` can UPDATE','Yes'],
['`shop_app` can DROP the table','No'],
['Login as `shop`','Not possible']]},
{note:'Replace the lab password with a strong secret in production, and keep it in a vault rather than in scripts.'}],
src:[['Database Security Guide',D+'dbseg/'],['Managing users',O.AD+'managing-users-and-securing-the-database.html']]};

})();
