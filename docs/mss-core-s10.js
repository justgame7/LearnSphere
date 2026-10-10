/* LearnSphere - SQL Server Core DBA, Section 10: Production Readiness & Capstone.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const ready=M.dg(700,230,[
[10,10,680,210,'A production-ready instance',1],
[30,45,150,50,'Installed and|patched',0],[200,45,150,50,'Configured|memory, MAXDOP',0],[370,45,150,50,'Secured|least privilege',0],[540,45,140,50,'Monitored|alerts',0],
[30,120,150,50,'Backed up|and restore tested',2],[200,120,150,50,'Maintained|stats, CHECKDB',0],[370,120,150,50,'Documented|runbook',0],[540,120,140,50,'Handed over|owner named',0],
[30,185,650,28,'Every box has an owner, a check and a date',0]],
[]);

const base=M.dg(700,150,[
[10,25,180,70,'Measure|normal behavior|(CPU, waits, I/O)',0],[230,25,220,70,'Store|in a table or tool|with timestamps',2],[490,25,200,70,'Compare|today against baseline|and alert on change',0]],
[[190,60,230,60],[450,60,490,60]]);

const change=M.dg(700,130,[
[10,25,120,60,'Request',0],[160,25,120,60,'Test|non-production',0],[310,25,120,60,'Approve',0],[460,25,100,60,'Apply|in window',2],[590,25,100,60,'Verify and|record',0]],
[[130,55,160,55],[280,55,310,55],[430,55,460,55],[560,55,590,55]]);

const cap=M.dg(700,150,[
[10,25,100,70,'1. Install|and patch',0],[130,25,100,70,'2. Configure|memory,|MAXDOP',0],[250,25,100,70,'3. Databases|files, models',0],
[370,25,100,70,'4. Maintain|jobs and checks',0],[490,25,100,70,'5. Monitor|alerts',0],[610,25,80,70,'6. Verify|handover',2]],
[[110,60,130,60],[230,60,250,60],[350,60,370,60],[470,60,490,60],[590,60,610,60]]);

/* ---------- 0: Readiness checklist ---------- */
L['mss-core:9:0']={blocks:[
{p:'Before a SQL Server instance carries production data, check it against a **written list**. This lecture is that list.'},
{svg:ready},
{h:'Checklist'},
{t:[['Area','Check','How to verify'],
['**Version**','Supported version, latest CU tested','`SELECT @@VERSION`'],
['**Memory**','max server memory set','`sp_configure`'],
['**Parallelism**','MAXDOP and cost threshold set','`sys.configurations`'],
['**tempdb**','Equal-size files, pre-sized','`tempdb.sys.database_files`'],
['**Files**','Data, log, backup on separate volumes; fixed growth','`sys.master_files`'],
['**IFI**','Enabled for the service account','`sys.dm_server_services`'],
['**Recovery**','Model matches requirement, log backups scheduled','`sys.databases`, Agent jobs'],
['**Backups**','Full, diff, log; restore tested','Test restore log'],
['**Integrity**','CHECKDB scheduled','Job history'],
['**Security**','Windows auth, sa disabled or renamed, least privilege','`sys.server_principals`'],
['**Monitoring**','Alerts on errors, disk, jobs, availability','Alert list'],
['**Docs**','Runbook, contacts, configuration','Document store']]},
{h:'Quick scripted check'},
{code:`SELECT name, value_in_use
FROM   sys.configurations
WHERE  name IN ('max server memory (MB)', 'max degree of parallelism',
                'cost threshold for parallelism', 'backup compression default',
                'remote admin connections', 'optimize for ad hoc workloads');

SELECT name, recovery_model_desc, page_verify_option_desc,
       is_auto_close_on, is_auto_shrink_on
FROM   sys.databases;`},
{note:'Treat the checklist as a living document. After every incident ask which line would have prevented it, and add it.'}],
src:[['Hardware and software requirements',M.SS+'install/hardware-and-software-requirements-for-installing-sql-server-2022'],['Server configuration options',M.DE+'configure-windows/server-configuration-options-sql-server']]};

/* ---------- 1: Baselines and documentation ---------- */
L['mss-core:9:1']={blocks:[
{p:'You cannot say a server is slow unless you know what **normal** looks like. A **baseline** is a record of normal. **Documentation** lets anyone on the team find, understand and fix the system.'},
{svg:base},
{h:'What to baseline'},
{t:[['Area','Measures','Source'],
['**CPU**','Utilization, runnable tasks','Perfmon, `sys.dm_os_schedulers`'],
['**Memory**','Page life expectancy, memory grants','`sys.dm_os_performance_counters`'],
['**I/O**','Latency per file, throughput','`sys.dm_io_virtual_file_stats`'],
['**Waits**','Top wait types over time','`sys.dm_os_wait_stats` snapshots'],
['**Workload**','Batch requests per second, connections','Counters'],
['**Size**','Database and file growth per week','`sys.master_files`']]},
{code:`-- A simple baseline table filled by an Agent job
CREATE TABLE dba.WaitBaseline (
  capture_time datetime2 NOT NULL DEFAULT SYSDATETIME(),
  wait_type nvarchar(60), wait_time_ms bigint, waiting_tasks_count bigint
);

INSERT dba.WaitBaseline (wait_type, wait_time_ms, waiting_tasks_count)
SELECT TOP (20) wait_type, wait_time_ms, waiting_tasks_count
FROM   sys.dm_os_wait_stats
ORDER  BY wait_time_ms DESC;`},
{h:'What to document'},
{ul:['**Server card**: version, edition, CU, collation, memory, CPU, storage layout, service accounts.','**Databases**: owner, purpose, size, recovery model, backup schedule, RPO and RTO.','**Jobs and maintenance**: what runs, when, and who to call.','**Network**: ports, firewall rules, listeners, certificates.','**Dependencies**: which applications and which other servers.']},
{note:'Documentation that is not updated is worse than none. Make updates part of the change process.'}],
src:[['Monitor performance counters',M.RD+'performance-monitor/monitor-resource-usage-system-monitor'],['sys.dm_os_performance_counters',M.RD+'system-dynamic-management-views/sys-dm-os-performance-counters-transact-sql']]};

/* ---------- 2: Runbooks and change ---------- */
L['mss-core:9:2']={blocks:[
{p:'A **runbook** is a short, tested procedure for a known task or incident. **Change management** is how you alter production without surprises.'},
{svg:change},
{h:'What a good runbook contains'},
{ul:['**Trigger**: the symptom or alert this applies to.','**Impact**: what is affected, and who to tell.','**Steps**: numbered, exact, with commands and expected output.','**Verification**: how to know it worked.','**Rollback**: how to undo.','**Escalation**: who to call next.']},
{h:'Runbooks every instance needs'},
{t:[['Runbook','Covers'],
['**Instance will not start**','Error log, disk, master, service account'],
['**Log full (error 9002)**','Reuse wait reason, log backup, space'],
['**Disk full**','Find growth, free space, move files'],
['**Blocking or hang**','Head blocker, DAC, kill decision'],
['**Restore a database**','Backup chain, point in time, verify'],
['**Failed job**','Job history, rerun, root cause']]},
{h:'Change rules'},
{flow:['Write the change, with the rollback','Test in non-production','Approve with the application owner','Apply in the agreed window','Verify and record the result']},
{note:'Always take or confirm a recent backup before a change that can modify data or structure, and keep the script in source control.'}],
src:[['SQL Server error log',M.RD+'performance/view-the-sql-server-error-log-sql-server-management-studio'],['Troubleshoot SQL Server','https://learn.microsoft.com/en-us/troubleshoot/sql/welcome-sql-server']]};

/* ---------- 3: Daily routines ---------- */
L['mss-core:9:3']={blocks:[
{p:'A DBA role is mostly **routine done well**. Short, regular checks catch most problems before users do.'},
{h:'Daily'},
{ul:['Agent **job failures** and alerts.','**Backups** completed; last full, differential and log times.','**Free disk space** and file growth.','**Error log** review for severity 17 and above, deadlocks, I/O warnings.','**Availability**: all databases online; no suspect pages.','Review **long-running** and **blocked** requests.']},
{h:'Weekly'},
{ul:['**Integrity checks** results.','**Index and statistics** maintenance results.','**Capacity**: database and file growth trend.','**Top waits** and top queries compared with baseline.','**Security**: new logins, role changes, failed logins.','**Backups**: restore a recent backup to a test server.']},
{h:'Monthly and quarterly'},
{ul:['**Patching**: review CUs and security updates, test, schedule.','**Disaster recovery** exercise.','**Licensing and inventory** review.','**Review** of runbooks and baseline.','**Clean up** unused logins, jobs and databases.']},
{h:'A one-minute health query'},
{code:`-- Failed jobs in the last day
SELECT j.name, h.run_date, h.run_time, h.message
FROM   msdb.dbo.sysjobs j
JOIN   msdb.dbo.sysjobhistory h ON h.job_id = j.job_id
WHERE  h.run_status = 0 AND h.step_id = 0
  AND  h.run_date >= CONVERT(int, FORMAT(DATEADD(day,-1,GETDATE()),'yyyyMMdd'));

-- Last backup per database
SELECT d.name,
       MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END) AS last_full,
       MAX(CASE WHEN b.type = 'L' THEN b.backup_finish_date END) AS last_log
FROM   sys.databases d
LEFT   JOIN msdb.dbo.backupset b ON b.database_name = d.name
WHERE  d.database_id > 4
GROUP  BY d.name;`},
{note:'Automate collection and reporting. A person should review a summary, not run twenty queries by hand.'}],
src:[['SQL Server Agent job history',M.RD+'system-tables/dbo-sysjobhistory-transact-sql'],['backupset',M.RD+'system-tables/backupset-transact-sql']]};

/* ---------- 4: Capstone ---------- */
L['mss-core:9:4']={blocks:[
{p:'This capstone ties the course together. You will build a **production-ready instance** on your lab server, step by step, and prove each step with a query.'},
{svg:cap},
{h:'Brief'},
{p:'Create an instance for a fictional **SalesDB** with the settings, files, jobs and checks a real DBA would put in place.'},
{h:'Steps'},
{t:[['#','Task','Proof'],
['1','Install SQL Server 2022 Developer and the latest CU on your lab host','`SELECT @@VERSION`'],
['2','Set **max server memory**, **MAXDOP**, **cost threshold**','`sys.configurations`'],
['3','Check tempdb has equal-size files and pre-size them','`tempdb.sys.database_files`'],
['4','Create **SalesDB** with a dedicated filegroup, sized files and fixed growth','`sys.master_files`'],
['5','Set **FULL** recovery, `PAGE_VERIFY CHECKSUM`, RCSI on','`sys.databases`'],
['6','Create one table with a key, a foreign key and a nonclustered index','`sys.indexes`'],
['7','Install the Ola Hallengren solution; schedule full, log, CHECKDB, index jobs','Job list'],
['8','Take a full and a log backup, **restore to a new name**, run CHECKDB on the copy','Restore output'],
['9','Create an Agent alert for severity 17+ and error 9002, send to an operator','`sysalerts`'],
['10','Write a one-page server card and the "log full" runbook','Document']]},
{code:`-- Example of step 5 and step 8 proof
ALTER DATABASE SalesDB SET RECOVERY FULL;
ALTER DATABASE SalesDB SET PAGE_VERIFY CHECKSUM;
ALTER DATABASE SalesDB SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;

BACKUP DATABASE SalesDB TO DISK = 'E:\\Backup\\SalesDB_full.bak' WITH CHECKSUM, COMPRESSION;
RESTORE DATABASE SalesDB_Test FROM DISK = 'E:\\Backup\\SalesDB_full.bak'
  WITH MOVE 'SalesDB_d1' TO 'D:\\SQLData\\SalesDB_Test_d1.ndf',
       MOVE 'SalesDB_log' TO 'L:\\SQLLog\\SalesDB_Test_log.ldf', RECOVERY;
DBCC CHECKDB (SalesDB_Test) WITH NO_INFOMSGS;`},
{note:'Do all of this on a lab server. File paths and logical names in the example must match your environment.'},
{h:'You are done when'},
{ul:['Every row in the readiness checklist has a proof.','A restore from backup worked and CHECKDB is clean.','Another person could operate the instance from your documents.']},
{p:'Next, choose the sub-course closest to your goals: **Backup, Restore and Recovery**, **Performance and Tuning**, **Security and Compliance** or **High Availability and DR**.'}],
src:[['Back up and restore of SQL Server databases',M.RD+'backup-restore/back-up-and-restore-of-sql-server-databases'],['SQL Server documentation',M.SQL]]};

})();
