/* LearnSphere - SQL Server Operations, Monitoring & Automation, Section 06: Troubleshooting & Support.
   Lectures 0-4 are core, 5 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const meth=M.dg(700,200,[
[10,25,120,70,'1. Define|symptom, scope,|when',0],[150,25,120,70,'2. Collect|logs, DMVs,|changes',2],[290,25,120,70,'3. Hypothesize|rank likely|causes',0],[430,25,120,70,'4. Test|one change or|one check',2],[570,25,120,70,'5. Fix and|record',0],
[10,115,680,70,'Ask first: what changed? Most problems follow a change in code, data volume, configuration, patch or environment.',0]],
[[130,60,150,60],[270,60,290,60],[410,60,430,60],[550,60,570,60]]);

const log=M.dg(700,170,[
[10,25,200,70,'ERRORLOG|current and 6 archives|text, newest first',2],[250,25,200,70,'Contains|startup, errors, backups,|logins, I/O warnings',0],[490,25,200,70,'Read with|SSMS, sp_readerrorlog|or a text editor',0],
[10,115,680,40,'Check the error log first for any incident on the instance',0]],
[]);

const dump=M.dg(700,170,[
[10,25,200,70,'Engine detects|an assertion or|exception',0],[250,25,200,70,'Writes SQLDump file|in the LOG folder|.mdmp',2],[490,25,200,70,'Collect with logs|send to support|do not open',0],
[10,115,680,40,'Dumps can contain data in memory: treat them as sensitive',0]],
[[210,60,250,60],[450,60,490,60]]);

const conn=M.dg(700,150,[
[10,25,120,70,'DNS and|name',0],[150,25,120,70,'Network|and port',0],[290,25,120,70,'Service|and protocol',0],[430,25,120,70,'TLS|and trust',0],[570,25,120,70,'Login and|permission',2]],
[[130,60,150,60],[270,60,290,60],[410,60,430,60],[550,60,570,60]]);

const sup=M.dg(700,200,[
[10,20,215,70,'Gather|build, error text,|time, logs',0],[245,20,215,70,'Open case|severity, impact,|contact',2],[480,20,210,70,'Work together|diagnostics,|follow-up steps',0],
[10,115,680,70,'Good case information shortens the time to a fix: version, exact message, what changed, what you tried',0]],
[[225,55,245,55],[460,55,480,55]]);

/* ---------- 0: Method ---------- */
L['mss-ops:5:0']={blocks:[
{p:'Troubleshooting is a **method**, not a set of tricks. A fixed approach keeps you calm and makes your work reviewable.'},
{svg:meth},
{h:'Questions to ask first'},
{t:[['Question','Why'],
['What exactly is failing, and what is the **exact error text**?','Do not paraphrase'],
['**Since when**, and what changed?','Finds the trigger'],
['**Who and what** is affected?','Scope: one user, one app, all'],
['Does it fail **always** or sometimes?','Load, timing, data dependent'],
['What have you **already tried**?','Avoid repeats, find side effects']]},
{h:'Rules'},
{ul:['**Collect before changing**: logs, state, a snapshot.','Make **one change at a time**, and note it.','**Time-box** and escalate: do not struggle alone on an outage.','**Write it down**: a short incident note becomes tomorrow runbook.']}],
src:[['Troubleshooting SQL Server',M.SS+'troubleshoot/troubleshooting-sql-server'],['SQL Server troubleshooting','https://learn.microsoft.com/en-us/troubleshoot/sql/welcome-sql-server']]};

/* ---------- 1: Error log ---------- */
L['mss-ops:5:1']={blocks:[
{p:'The **SQL Server error log** is a text record of what the instance did and what went wrong. It is the first place to look.'},
{svg:log},
{code:`-- Current log, search for text
EXEC sp_readerrorlog 0, 1, N'error';
EXEC sp_readerrorlog 0, 1, N'Login failed';

-- Parameters: log number, log type (1 SQL Server, 2 Agent), search1, search2
EXEC sp_readerrorlog 1, 1, N'I/O requests';

-- Start a new log file without restarting
EXEC sp_cycle_errorlog;`},
{h:'Reading it'},
{t:[['Severity','Meaning'],
['**10**','Informational'],
['**11 to 16**','User or code errors'],
['**17 to 19**','Resource problems, such as out of memory or disk'],
['**20 to 25**','Fatal errors, connection and sometimes server stop']]},
{ul:['**Startup** lines show version, build, memory, CPU count and databases recovered.','**Repeated messages** such as "I/O requests taking longer than 15 seconds" signal storage trouble.','Keep **more archives** (default 6) so you can look back.']}],
src:[['View the SQL Server error log',M.RD+'performance/view-the-sql-server-error-log-sql-server-management-studio'],['Database engine error severities',M.RD+'errors-events/database-engine-error-severities']]};

/* ---------- 2: Dump files ---------- */
L['mss-ops:5:2']={blocks:[
{p:'When SQL Server hits an internal assertion, access violation or a non-yielding scheduler, it writes a **memory dump** (.mdmp) and a text summary into the **LOG** folder.'},
{svg:dump},
{code:`-- Dumps this instance has created
SELECT filename, creation_time, size_in_bytes/1048576 AS size_mb
FROM   sys.dm_server_memory_dumps
ORDER  BY creation_time DESC;`},
{h:'What you do'},
{ul:['Do **not** try to open and read dumps yourself in normal operations.','Collect the **dump, the matching error log and the SQLDump text file** together.','Note **what the workload was doing** at that time, and whether it repeats.','Check **patch level**: many dumps are fixed in a later CU.','Protect the files: **memory can contain data**.']},
{note:'A one-off dump after a known bug may only need patching. Repeated dumps in the same area need a support case.'}],
src:[['Use the SQLdumper utility',M.SS+'troubleshoot/use-the-sqldumper-utility-to-generate-a-dump-file'],['sys.dm_server_memory_dumps',M.RD+'system-dynamic-management-views/sys-dm-server-memory-dumps-transact-sql']]};

/* ---------- 3: Connectivity failures ---------- */
L['mss-ops:5:3']={blocks:[
{p:'Connectivity problems repeat in every environment. Go through the layers **from the client outward** and test each one with a simple tool.'},
{svg:conn},
{t:[['Layer','Test','Typical failure'],
['**Name**','nslookup, ping by name','Wrong or stale DNS, alias'],
['**Network and port**','Test-NetConnection host -Port 1433','Firewall, wrong port, instance down'],
['**Service and protocol**','Services, Configuration Manager, error log','TCP disabled, Browser stopped'],
['**TLS and trust**','Connection string Encrypt, certificate details','Certificate not trusted or name mismatch'],
['**Kerberos**','Error "Cannot generate SSPI context"','Missing or duplicate SPN'],
['**Login and permission**','sqlcmd with known login, error log state','Disabled login, no database access']]},
{h:'Emergency access'},
{p:'If normal connections fail, use the **dedicated administrator connection (DAC)**: `sqlcmd -A`, or `ADMIN:` before the server name. Enable remote DAC in advance.'},
{code:`EXEC sp_configure 'remote admin connections', 1; RECONFIGURE;`}],
src:[['Resolve connectivity errors','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/connect/resolve-connectivity-errors-overview'],['Register a Service Principal Name for Kerberos',M.DE+'configure-windows/register-a-service-principal-name-for-kerberos-connections']]};

/* ---------- 4: Working with Microsoft support ---------- */
L['mss-ops:5:4']={blocks:[
{p:'Some problems need the product team or a specialist. Good preparation makes the case move much faster.'},
{svg:sup},
{h:'What to prepare'},
{t:[['Item','Detail'],
['**Version and build**','`SELECT @@VERSION` and SERVERPROPERTY output'],
['**Exact error message**','Number, severity, state and text'],
['**Timeline**','When it started, what changed, how often'],
['**Impact**','What is affected, and the business severity'],
['**Diagnostics**','Error log, dump files, Extended Events, configuration scripts'],
['**What you tried**','And the result']]},
{h:'Tips'},
{ul:['Choose the **severity** that matches business impact and give a reachable contact.','Use **diagnostic collection tools** that support asks for, instead of ad hoc dumps.','**Mask or protect** sensitive data in logs and traces before you upload them.','Keep **notes** of each step and ask for the root cause in writing.']},
{note:'Also use the community: Microsoft Q&A, forums and official documentation can answer many questions faster than a case.'}],
src:[['Microsoft support','https://support.microsoft.com/'],['SQL Server troubleshooting','https://learn.microsoft.com/en-us/troubleshoot/sql/welcome-sql-server']]};

})();
