/* LearnSphere - Security, Section 06: Auditing & Activity Monitoring.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const SG=O.D+'dbseg/';

/* ---------- diagrams ---------- */
const ua=O.dg(700,200,[
[10,60,140,80,'Audited actions|logon, DDL, DML,|privilege use',0],
[200,60,140,80,'Audit policies|enabled for users|or everyone',2],
[390,60,130,80,'Unified audit|trail (one place)',2],
[570,10,120,60,'UNIFIED_AUDIT|_TRAIL view',0],[570,110,120,60,'Purge, archive|or export (SIEM)',0]],
[[150,100,200,100],[340,100,390,100],[520,85,570,40],[520,115,570,140]]);

/* ---------- 0: Unified auditing ---------- */
L['ora-sec:5:0']={blocks:[
{p:'**Unified Auditing** is the single auditing system since 12c. It replaces traditional auditing (`AUDIT` statements and many separate trails) with **policies** and **one trail**.'},
{svg:ua},
{t:[['Item','Traditional','Unified'],
['**Setup**','`AUDIT_TRAIL` parameter, many options','Policies, enabled with `AUDIT POLICY`'],
['**Trail**','`SYS.AUD$`, `FGA_LOG$`, OS files, separate for others','`UNIFIED_AUDIT_TRAIL` (one view)'],
['**Performance**','Heavier, in tables','Queue-based, lighter'],
['**Roles**','DBA role','`AUDIT_ADMIN` and `AUDIT_VIEWER`']]},
{code:`-- is unified auditing only mode on?
SELECT value FROM v$option WHERE parameter=\'Unified Auditing\';

-- what is enabled right now?
SELECT policy_name, enabled_option, entity_name, success, failure FROM audit_unified_enabled_policies;

SELECT COUNT(*) FROM unified_audit_trail;`},
{h:'Modes'},
{ul:['**Mixed mode** (default after upgrade): traditional and unified both work.','**Pure unified mode**: only unified auditing. Requires relinking the binaries (`uniaud_on`).']},
{note:'Aim for **pure unified mode** in new systems. Predefined policies such as `ORA_SECURECONFIG` and `ORA_LOGON_FAILURES` are enabled by default in many setups.'}],
src:[['Unified auditing',SG]]};

/* ---------- 1: Policies ---------- */
L['ora-sec:5:1']={blocks:[
{p:'A **policy** names what to audit. You create it once and enable it for users, roles or everyone.'},
{code:`-- predefined policies
AUDIT POLICY ora_secureconfig;
AUDIT POLICY ora_logon_failures;

-- custom: privileged use and sensitive table access
CREATE AUDIT POLICY priv_use
  PRIVILEGES SELECT ANY TABLE, ALTER SYSTEM, CREATE USER, DROP USER
  ACTIONS DELETE ON app.salary, UPDATE ON app.salary
  WHEN \'SYS_CONTEXT(\'\'USERENV\'\',\'\'SESSION_USER\'\') NOT IN (\'\'APP_OWNER\'\')\' EVALUATE PER SESSION;

AUDIT POLICY priv_use;
AUDIT POLICY priv_use BY dba_alice, dba_bob;
AUDIT POLICY priv_use EXCEPT app_batch;`},
{t:[['Policy part','Meaning'],
['`PRIVILEGES`','Use of system privileges'],
['`ACTIONS`','Statement types or actions on objects'],
['`ROLES`','Use of privileges through roles'],
['`WHEN ... EVALUATE`','Condition (per session, statement or instance)'],
['`BY user` / `EXCEPT user`','Target and exclusions']]},
{h:'What to audit'},
{ul:['Logon failures and successes of administrators.','Use of powerful privileges and changes to users, roles and the audit settings.','Access to sensitive tables.']},
{note:'Audit what you will **review**. Auditing everything creates volume that nobody reads and hides the events that matter.'}],
src:[['Audit policies',SG]]};

/* ---------- 2: Reading the trail ---------- */
L['ora-sec:5:2']={blocks:[
{p:'All unified audit records are in `UNIFIED_AUDIT_TRAIL`. Query it by time, user and action.'},
{code:`SELECT event_timestamp, dbusername, os_username, userhost, action_name,
       object_schema, object_name, return_code, unified_audit_policies
FROM unified_audit_trail
WHERE event_timestamp > SYSTIMESTAMP - INTERVAL \'1\' DAY
  AND action_name IN (\'LOGON\',\'CREATE USER\',\'DROP USER\',\'GRANT\',\'ALTER SYSTEM\')
ORDER BY event_timestamp DESC;

-- failed logons by user and host
SELECT dbusername, userhost, COUNT(*) FROM unified_audit_trail
WHERE action_name=\'LOGON\' AND return_code <> 0
GROUP BY dbusername, userhost ORDER BY 3 DESC;`},
{t:[['Column','Meaning'],
['`EVENT_TIMESTAMP`','When'],
['`DBUSERNAME`, `OS_USERNAME`, `USERHOST`','Who and from where'],
['`ACTION_NAME`, `OBJECT_*`','What'],
['`RETURN_CODE`','0 success, otherwise an ORA error'],
['`SQL_TEXT`, `SQL_BINDS`','The statement and binds (if captured)'],
['`UNIFIED_AUDIT_POLICIES`','Which policy caused the record']]},
{note:'Move the records to a separate system (SIEM) so a privileged user cannot erase their own trail. Report from there.'}],
src:[['Unified audit trail',SG]]};

/* ---------- 3: Trail management ---------- */
L['ora-sec:5:3']={blocks:[
{p:'The audit trail grows. Manage its **size**, **location** and **retention**.'},
{code:`-- move the trail to its own tablespace
EXEC DBMS_AUDIT_MGMT.SET_AUDIT_TRAIL_LOCATION(
       audit_trail_type => DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED,
       audit_trail_location_value => \'AUDIT_TS\');

-- mark the last archive time, then purge older records
EXEC DBMS_AUDIT_MGMT.SET_LAST_ARCHIVE_TIMESTAMP(
       audit_trail_type => DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED,
       last_archive_time => SYSTIMESTAMP - 90);
EXEC DBMS_AUDIT_MGMT.CLEAN_AUDIT_TRAIL(
       audit_trail_type => DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED, use_last_arch_timestamp => TRUE);

-- schedule a purge job
EXEC DBMS_AUDIT_MGMT.CREATE_PURGE_JOB(
       audit_trail_type => DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED,
       audit_trail_purge_interval => 24, audit_trail_purge_name => \'daily_purge\', use_last_arch_timestamp => TRUE);`},
{flow:['Export or forward records to long-term storage first','Set the last archive timestamp','Purge records older than the timestamp','Monitor trail size and purge job success']},
{note:'Never purge before the archive is confirmed. Retention is a compliance decision (often one year or more online or offline).'}],
src:[['Audit trail management',SG]]};

/* ---------- 4: Fine-grained auditing ---------- */
L['ora-sec:5:4']={blocks:[
{p:'**Fine-grained auditing (FGA)** audits access to **specific columns** when a **condition** is true, and can run a **handler** (an alert).'},
{code:`BEGIN
  DBMS_FGA.ADD_POLICY(
    object_schema   => \'APP\',
    object_name     => \'EMPLOYEES\',
    policy_name     => \'FGA_SALARY\',
    audit_condition => \'SALARY > 100000\',
    audit_column    => \'SALARY\',
    statement_types => \'SELECT,UPDATE\',
    audit_trail     => DBMS_FGA.DB + DBMS_FGA.EXTENDED);
END;
/
SELECT * FROM dba_fga_audit_trail;   -- also visible in UNIFIED_AUDIT_TRAIL`},
{t:[['','Policy-based (unified)','FGA'],
['**Granularity**','Statement or object','Column and row condition'],
['**Handler**','No','Yes (call a procedure)'],
['**Use**','Broad coverage','Targeted sensitive data']]},
{note:'FGA records the **SQL text** and the condition match. Use it for the few columns that really matter, such as salary or card numbers.'}],
src:[['Fine-grained auditing',SG]]};

/* ---------- 5: Multitenant ---------- */
L['ora-sec:5:5']={blocks:[
{p:'In a CDB, audit policies can be **common** or **local**, and there is one trail per container view.'},
{t:[['','Common policy','Local policy'],
['**Created in**','Root','A PDB'],
['**Applies to**','All containers (or the chosen ones)','That PDB only'],
['**Name**','`C##...` for common users','Any name'],
['**Use**','Standard rules across all PDBs','PDB-specific audit needs']]},
{code:`-- common policy from the root
CREATE AUDIT POLICY c##priv_use PRIVILEGES CREATE USER, DROP USER CONTAINER = ALL;
AUDIT POLICY c##priv_use;

-- view across containers (from the root)
SELECT con_id, event_timestamp, dbusername, action_name FROM cdb_unified_audit_trail
WHERE event_timestamp > SYSTIMESTAMP - 1;`},
{h:'Who reads which trail'},
{ul:['The **root** audit administrator sees records of all containers.','A **PDB** administrator sees only that PDB records.']},
{note:'Use common policies for the base standard, and local ones for application specifics. Keep the naming clear.'}],
src:[['Auditing in multitenant',SG]]};

/* ---------- 6: Practical ---------- */
L['ora-sec:5:6']={blocks:[
{p:'**Build an audit policy for privileged access.**'},
{code:`-- 1. policy
CREATE AUDIT POLICY dba_activity
  ACTIONS LOGON, CREATE USER, ALTER USER, DROP USER, GRANT, REVOKE, ALTER SYSTEM, CREATE ROLE, ALTER DATABASE
  ROLES DBA, AUDIT_ADMIN;
AUDIT POLICY dba_activity;

-- 2. generate events (as an administrator)
CREATE USER audit_test IDENTIFIED BY "Tmp#Pw_2026_x";
GRANT CREATE SESSION TO audit_test;
DROP USER audit_test;

-- 3. report
SELECT event_timestamp, dbusername, action_name, object_name, return_code
FROM unified_audit_trail WHERE unified_audit_policies LIKE \'%DBA_ACTIVITY%\' ORDER BY event_timestamp DESC;`},
{h:'Add'},
{ul:['An alert query for any `DROP USER` or `ALTER SYSTEM` by a non-DBA.','A job that exports the last day of audit records to a central system.','A purge job with a retention you can justify.']},
{h:'Check your result'},
{t:[['Check','Expected'],
['`AUDIT_UNIFIED_ENABLED_POLICIES`','`DBA_ACTIVITY` listed'],
['Trail','Three events for the three statements'],
['Purge','Job exists, last archive timestamp is set'],
['Export','Records arrive in the central system']]},
{note:'Verify that a user **without** `AUDIT_ADMIN` cannot disable the policy. Audit settings are themselves audited.'}],
src:[['Unified auditing',SG]]};

})();
