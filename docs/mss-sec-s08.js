/* LearnSphere - SQL Server Security & Compliance, Section 08: Auditing.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const arch=M.dg(700,220,[
[10,15,680,190,'SQL Server Audit',1],
[30,55,190,60,'Server audit|where to write, failure|behavior',2],[255,45,190,40,'Server audit specification|server-level actions',0],[255,95,190,40,'Database audit specification|per database actions',0],
[480,55,180,60,'Target|file, Application log,|Security log, URL',0],
[30,150,630,45,'One server audit can have many specifications. Each specification attaches to one audit.',0]],
[[220,75,255,65],[220,85,255,115],[445,85,480,85]]);

const spec=M.dg(700,190,[
[10,20,330,150,'Server-level groups (examples)',1],[25,55,300,30,'FAILED_LOGIN_GROUP',0],[25,95,300,30,'SERVER_ROLE_MEMBER_CHANGE_GROUP',2],[25,135,300,28,'LOGIN_CHANGE_PASSWORD_GROUP',0],
[360,20,330,150,'Database-level actions (examples)',1],[375,55,300,30,'SELECT on sales.Customers BY public',2],[375,95,300,30,'SCHEMA_OBJECT_CHANGE_GROUP',0],[375,135,300,28,'DATABASE_ROLE_MEMBER_CHANGE_GROUP',0]],
[]);

const tgt=M.dg(700,180,[
[10,20,160,70,'File|.sqlaudit files|best for most cases',2],[190,20,160,70,'Windows|Application log|simple',0],[370,20,160,70,'Windows|Security log|needs OS rights',0],[550,20,140,70,'URL|Azure Blob|2017 and later',0],
[10,110,680,55,'Whatever the target, protect it: only the audit owner and reviewers can read, nobody can edit',0]],
[]);

const rd=M.dg(700,150,[
[10,25,200,70,'sys.fn_get_audit_file|reads .sqlaudit|files with T-SQL',2],[250,25,200,70,'Scheduled review|failed logins,|role changes',0],[490,25,200,70,'Send to SIEM|or alert on|key events',0]],
[[210,60,250,60],[450,60,490,60]]);

/* ---------- 0: Architecture ---------- */
L['mss-sec:7:0']={blocks:[
{p:'**SQL Server Audit** records chosen actions to a safe place, so you can answer **who did what, when and from where**. It is built into the engine, in all editions from SQL Server 2016 SP1.'},
{svg:arch},
{t:[['Object','Purpose'],
['**Server audit**','Defines the target, queue delay and what to do on failure'],
['**Server audit specification**','Server-level events such as logins and role changes'],
['**Database audit specification**','Database-level events such as SELECT on a table']]},
{h:'On failure'},
{t:[['Option','Effect'],
['`CONTINUE`','Keep working, audit may miss events'],
['`FAIL_OPERATION`','Fail the audited action if it cannot be recorded'],
['`SHUTDOWN`','Stop the instance if auditing fails (very strict)']]},
{note:'SHUTDOWN is used in highly regulated systems where a missing audit record is not acceptable. Plan disk space and monitoring first.'}],
src:[['SQL Server Audit',M.RD+'security/auditing/sql-server-audit-database-engine'],['SQL Server Audit action groups and actions',M.RD+'security/auditing/sql-server-audit-action-groups-and-actions']]};

/* ---------- 1: Specifications ---------- */
L['mss-sec:7:1']={blocks:[
{p:'A **specification** says which events to record. Pick events that answer real questions, and keep volume manageable.'},
{svg:spec},
{code:`USE master;
CREATE SERVER AUDIT Audit_Security
  TO FILE (FILEPATH = 'E:\\Audit\\', MAXSIZE = 100 MB, MAX_ROLLOVER_FILES = 20)
  WITH (QUEUE_DELAY = 1000, ON_FAILURE = CONTINUE);

CREATE SERVER AUDIT SPECIFICATION Audit_Security_Server
  FOR SERVER AUDIT Audit_Security
  ADD (FAILED_LOGIN_GROUP),
  ADD (SERVER_ROLE_MEMBER_CHANGE_GROUP),
  ADD (LOGIN_CHANGE_PASSWORD_GROUP)
  WITH (STATE = ON);

ALTER SERVER AUDIT Audit_Security WITH (STATE = ON);

USE SalesDB;
CREATE DATABASE AUDIT SPECIFICATION Audit_SalesDB
  FOR SERVER AUDIT Audit_Security
  ADD (SELECT, UPDATE ON sales.Customers BY public)
  WITH (STATE = ON);`},
{h:'What to audit first'},
{ul:['**Failed and successful logins** for privileged accounts.','**Changes** to logins, roles and permissions.','**Schema changes** in production databases.','**Reads and writes** of the most sensitive tables.','**Use of high privileges**, such as sysadmin actions.']},
{note:'Auditing every SELECT on busy tables is expensive and noisy. Be selective, and test the overhead before enabling in production.'}],
src:[['Create a server audit and server audit specification',M.RD+'security/auditing/create-a-server-audit-and-server-audit-specification'],['CREATE DATABASE AUDIT SPECIFICATION',M.TS+'statements/create-database-audit-specification-transact-sql']]};

/* ---------- 2: Targets ---------- */
L['mss-sec:7:2']={blocks:[
{p:'Audit data is only useful if it is **complete** and **cannot be changed** by the people being audited.'},
{svg:tgt},
{t:[['Target','Pros','Cons'],
['**File**','Fast, rolls over, readable with T-SQL','You must protect and collect the files'],
['**Windows Application log**','Easy to set up','Mixed with other events, size limits'],
['**Windows Security log**','Central, tamper-resistant with OS policy','Needs OS permissions and setup'],
['**URL (Azure Blob)**','Off-box, large capacity','Network and storage dependency']]},
{h:'Protect the audit'},
{ul:['Put files on a **separate volume**, readable only by the audit service account and reviewers.','**Forward** to a central log system or SIEM, so a local admin cannot remove the trail.','Keep **retention** that matches your policy and regulation.','Monitor the **audit itself**: if it is off or failing, someone must know.']},
{code:`SELECT name, status_desc, audit_file_path, queue_delay, on_failure_desc
FROM   sys.dm_server_audit_status;`}],
src:[['SQL Server Audit targets',M.RD+'security/auditing/sql-server-audit-database-engine'],['sys.dm_server_audit_status',M.RD+'system-dynamic-management-views/sys-dm-server-audit-status-transact-sql']]};

/* ---------- 3: Reading and alerting ---------- */
L['mss-sec:7:3']={blocks:[
{p:'An audit nobody reads is only a storage cost. Build a simple **review** and **alert** routine.'},
{svg:rd},
{code:`-- Last 24 hours of audit events
SELECT event_time, action_id, succeeded, server_principal_name, database_name,
       object_name, client_ip, application_name, statement
FROM   sys.fn_get_audit_file('E:\\Audit\\*.sqlaudit', DEFAULT, DEFAULT)
WHERE  event_time > DATEADD(hour, -24, SYSUTCDATETIME())
ORDER  BY event_time DESC;

-- Failed logins by source
SELECT client_ip, server_principal_name, COUNT(*) AS failures
FROM   sys.fn_get_audit_file('E:\\Audit\\*.sqlaudit', DEFAULT, DEFAULT)
WHERE  action_id = 'LGIF' AND event_time > DATEADD(hour, -1, SYSUTCDATETIME())
GROUP  BY client_ip, server_principal_name
HAVING COUNT(*) >= 5;`},
{h:'What to alert on'},
{ul:['**Many failed logins** from one source.','**Membership changes** of sysadmin or other privileged roles.','**Audit stopped** or failed.','Access to **very sensitive** tables from unexpected accounts or hosts.']},
{note:'Time stamps are UTC in the file. Use the same time zone in your review and your incident records.'}],
src:[['sys.fn_get_audit_file',M.RD+'system-functions/sys-fn-get-audit-file-transact-sql'],['View a SQL Server audit log',M.RD+'security/auditing/view-a-sql-server-audit-log']]};

})();
