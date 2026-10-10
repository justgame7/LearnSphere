/* LearnSphere - Security, Section 08: SQL Firewall & Modern Protections.
   Lectures 0-5 are core, 6+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const SG=O.D+'dbseg/';
const SG26=O.D26+'dbseg/';

/* ---------- diagrams ---------- */
const inj=O.dg(700,190,[
[10,50,130,80,'User input|name = x\' OR 1=1',0],
[190,50,140,80,'Application|builds SQL by|string concatenation',0],
[380,50,130,80,'Database|runs altered SQL',2],
[560,50,130,80,'Data exposed|or changed',0]],
[[140,90,190,90],[330,90,380,90],[510,90,560,90]]);

const fw=O.dg(700,190,[
[10,50,130,80,'1. Capture|learn normal|SQL and context',2],
[190,50,130,80,'2. Review|and generate|allow-list',0],
[370,50,130,80,'3. Enforce|allow-list|(block or log)',2],
[550,50,140,80,'4. Monitor|violations in|audit and views',0]],
[[140,90,190,90],[320,90,370,90],[500,90,550,90]]);

/* ---------- 0: SQL injection ---------- */
L['ora-sec:7:0']={blocks:[
{p:'**SQL injection** happens when user input becomes part of the SQL text. The attacker changes the meaning of the statement.'},
{svg:inj},
{code:`-- vulnerable: string concatenation
v_sql := \'SELECT * FROM users WHERE name = \'\'\' || p_name || \'\'\'\';
EXECUTE IMMEDIATE v_sql;
-- p_name = x\' OR \'1\'=\'1  returns all users

-- safe: bind variable
EXECUTE IMMEDIATE \'SELECT * FROM users WHERE name = :n\' USING p_name;`},
{t:[['Defense','How'],
['**Bind variables**','Input is data, never code. Also better for performance.'],
['**Input validation**','`DBMS_ASSERT` for object names, allow-lists'],
['**Least privilege**','The application account can do little even if injected'],
['**Avoid dynamic SQL**','Use static SQL where possible'],
['**SQL Firewall**','Block statements that do not match learned patterns']]},
{note:'The main fix is in the **application code**. The database controls limit damage and detect problems, but cannot fix poor code by itself.'}],
src:[['SQL injection',SG]]};

/* ---------- 1: SQL Firewall ---------- */
L['ora-sec:7:1']={blocks:[
{p:'**Oracle SQL Firewall** (26ai) is built into the database. It learns the SQL an application normally runs and the contexts it runs from, and then **blocks everything else**. **[26ai]**'},
{svg:fw},
{t:[['Piece','Meaning'],
['**Capture**','Records top-level SQL statements and session context (IP, OS program) of a user'],
['**Allow-list**','The approved SQL and contexts'],
['**Enforce**','Block or only log what is not in the allow-list'],
['**Violation log**','Records of what was blocked or flagged']]},
{code:`-- outline only. Verify names and options in the 26ai Security Guide.
EXEC DBMS_SQL_FIREWALL.ENABLE;
EXEC DBMS_SQL_FIREWALL.CREATE_CAPTURE(username => \'APP_USER\', top_level_only => TRUE);
EXEC DBMS_SQL_FIREWALL.START_CAPTURE(\'APP_USER\');
-- run the application workload
EXEC DBMS_SQL_FIREWALL.STOP_CAPTURE(\'APP_USER\');
EXEC DBMS_SQL_FIREWALL.GENERATE_ALLOW_LIST(\'APP_USER\');
EXEC DBMS_SQL_FIREWALL.ENABLE_ALLOW_LIST(\'APP_USER\', enforce => DBMS_SQL_FIREWALL.ENFORCE_SQL, block => TRUE);`},
{note:'This is a 26ai feature. The package and procedure names above follow the documented pattern, but check the **26ai Security Guide** for your exact release before using it.'}],
src:[['SQL Firewall (26ai)',SG26]]};

/* ---------- 2: Monitoring violations ---------- */
L['ora-sec:7:2']={blocks:[
{p:'An allow-list is only useful if you **watch violations** and respond.'},
{t:[['Mode','Effect','When'],
['**Observe (log only)**','Violations are recorded, SQL still runs','First phase, after capture'],
['**Block**','Violations are blocked, errors returned','After tuning the allow-list'],
['**Per user or per application**','Separate allow-lists','Different application accounts']]},
{code:`-- review violations (view names per 26ai documentation)
SELECT * FROM dba_sql_firewall_violations ORDER BY occurred_at DESC FETCH FIRST 20 ROWS ONLY;`},
{h:'Response process'},
{flow:['A violation is recorded','Classify: new legitimate SQL, bug, or attack','If legitimate: add to the allow-list through change control','If attack: investigate the session, source, credentials','Report and improve']},
{h:'Operational points'},
{ul:['Re-capture after each application release.','Keep the allow-list under version control.','Send violations to your SIEM.']},
{note:'Start in **log only** mode. Move to blocking only when false positives are rare, or users will see errors.'}],
src:[['SQL Firewall violations',SG26]]};

/* ---------- 3: Immutable and blockchain tables ---------- */
L['ora-sec:7:3']={blocks:[
{p:'Some data must **not change after it is written**: audit trails, financial records, evidence. Oracle offers two special table types.'},
{t:[['','Immutable table','Blockchain table'],
['**Insert**','Allowed','Allowed'],
['**Update / delete**','Blocked (delete only after a retention period)','Blocked (delete only after retention)'],
['**Integrity proof**','None beyond blocking','Rows are chained with a **cryptographic hash**, tamper detection'],
['**Use**','WORM style records','Records that must be provably unchanged']]},
{code:`CREATE IMMUTABLE TABLE app.audit_log (
  id NUMBER, event VARCHAR2(200), event_time TIMESTAMP)
  NO DROP UNTIL 365 DAYS IDLE
  NO DELETE UNTIL 90 DAYS AFTER INSERT;

CREATE BLOCKCHAIN TABLE app.ledger (
  id NUMBER, amount NUMBER, entry_time TIMESTAMP)
  NO DROP UNTIL 365 DAYS IDLE
  NO DELETE LOCKED
  HASHING USING "SHA2_512" VERSION "v1";`},
{note:'Choose retention periods with care. You cannot delete data before the period ends, even with powerful privileges.'}],
src:[['Immutable and blockchain tables',O.AD]]};

/* ---------- 4: Schema privileges ---------- */
L['ora-sec:7:4']={blocks:[
{p:'**Schema-level privileges** (23ai and later) grant a privilege on **all objects of one schema**, including new ones. This replaces many `ANY` grants. **[26ai]**'},
{code:`-- before: access to every schema
GRANT SELECT ANY TABLE TO report_user;

-- now: only the app schema
GRANT SELECT ANY TABLE ON SCHEMA app TO report_user;
GRANT INSERT ANY TABLE, UPDATE ANY TABLE ON SCHEMA app TO app_batch;

SELECT * FROM dba_schema_privs WHERE schema = \'APP\';`},
{t:[['Privilege (on schema)','Meaning'],
['`SELECT ANY TABLE`','Read all tables of that schema'],
['`INSERT / UPDATE / DELETE ANY TABLE`','DML on all tables of that schema'],
['`EXECUTE ANY PROCEDURE`','Run procedures of that schema'],
['`CREATE ANY TABLE`, `ALTER ANY TABLE`, `DROP ANY TABLE`','DDL in that schema']]},
{h:'Benefits'},
{ul:['Smaller blast radius than `ANY` on the whole database.','New objects are covered automatically.','Easier audit: one grant per schema.']},
{note:'Replace database-wide `ANY` privileges with schema privileges as a clean-up project. Check the release availability for your platform.'}],
src:[['Schema privileges',SG26]]};

/* ---------- 5: Practical ---------- */
L['ora-sec:7:5']={blocks:[
{p:'**Lock down an application** with SQL Firewall. This needs a 26ai database. If you only have 19c, do the same exercise with a least-privilege account and auditing, and read the firewall steps.'},
{flow:['Create the application account with minimal privileges','Capture normal traffic during a test run','Generate and review the allow-list','Enable in log-only mode and run a test with a normal and an injected query','Switch to blocking and repeat','Document the process for releases']},
{code:`-- injected test (the application builds SQL by string concatenation in this test)
-- normal:   SELECT * FROM app.orders WHERE cust_id = 5
-- injected: SELECT * FROM app.orders WHERE cust_id = 5 OR 1=1

-- check violations after the test
SELECT * FROM dba_sql_firewall_violations;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['Normal SQL','Runs'],
['Injected SQL','Logged, then blocked'],
['Violation record','Includes the SQL text, the user, the client IP and program'],
['New release','Process to refresh the allow-list is documented']]},
{note:'Firewall does not replace secure code. It is a safety net that turns a bug into an alert instead of a breach.'}],
src:[['SQL Firewall (26ai)',SG26]]};

})();
