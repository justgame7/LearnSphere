/* LearnSphere - SQL Server Operations, Monitoring & Automation, Section 03: Monitoring.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const what=M.dg(700,220,[
[10,10,680,200,'Five questions monitoring must answer',1],
[30,50,200,50,'Is it up?|availability',2],[250,50,200,50,'Is it healthy?|errors, jobs, HA state',0],[470,50,200,50,'Is it fast?|waits, latency',0],
[30,120,200,50,'Is it full?|disk, log, growth',2],[250,120,200,50,'Is it safe?|logins, audit, changes',0],[470,120,200,50,'Is it protected?|backups, DR',2],
[30,180,640,22,'Monitor what the business cares about first, then what helps you diagnose',0]],
[]);

const dm=M.dg(700,150,[
[10,25,200,70,'DMVs|live state|cheap to read',2],[250,25,200,70,'Collect on a schedule|into a table|keep history',0],[490,25,200,70,'Compare|baseline and trend|alert on change',0]],
[[210,60,250,60],[450,60,490,60]]);

const xe=M.dg(700,150,[
[10,25,200,70,'system_health|always on|deadlocks, errors',2],[250,25,200,70,'Custom session|filtered, short|event file target',0],[490,25,200,70,'Review|and drop|when finished',0]],
[]);

const pm=M.dg(700,170,[
[10,25,150,70,'Processor|% Processor Time',0],[180,25,150,70,'Memory|Page life expectancy,|Grants Pending',0],[350,25,150,70,'Disk|Avg Disk sec/Read,|Write',0],[520,25,170,70,'SQL Server|Batch Requests/sec,|Compilations/sec',2],
[10,115,680,40,'Collect at 15 to 60 second intervals and store for trend analysis',0]],
[]);

const alr=M.dg(700,190,[
[10,20,215,150,'Page',1],[25,55,185,30,'Service down',2],[25,95,185,30,'HA failover',0],[25,130,185,30,'Log full',0],
[245,20,215,150,'Ticket',1],[260,55,185,30,'Backup older than RPO',2],[260,95,185,30,'Disk below 15 percent',0],[260,130,185,30,'Job failed',0],
[480,20,210,150,'Dashboard only',1],[495,55,180,30,'CPU trends',0],[495,95,180,30,'Waits',0],[495,130,180,30,'Growth',0]],
[]);

/* ---------- 0: What to monitor ---------- */
L['mss-ops:2:0']={blocks:[
{p:'**Monitoring** is the routine collection of facts that tell you whether the service is working, and warn you before users notice a problem.'},
{svg:what},
{t:[['Area','Examples','Why'],
['**Availability**','Service state, connectivity, AG role','Is it reachable?'],
['**Errors**','Severity 17+, 823/824/825, 9002','Early warning of failures'],
['**Jobs**','Failures, long runs, missed schedules','Backups and maintenance'],
['**Capacity**','Disk, log use, file growth, tempdb','Avoid outages from space'],
['**Performance**','Waits, CPU, I/O latency, blocking','User experience'],
['**Protection**','Last backup, restore tests, replication lag','RPO and DR readiness'],
['**Security**','Failed logins, permission changes','Detect misuse']]},
{h:'Principles'},
{ul:['**Measure** what you can **act on**.','Keep **history** so you can see trends, not only the current value.','Know what **normal** looks like before you set thresholds.']}],
src:[['Monitor and tune for performance',M.RD+'performance/monitor-and-tune-for-performance'],['SQL Server monitoring tools',M.RD+'performance/performance-monitoring-and-tuning-tools']]};

/* ---------- 1: DMVs ---------- */
L['mss-ops:2:1']={blocks:[
{p:'**DMVs** give the live state with no extra software. Combine them with a table and a job to turn snapshots into history.'},
{svg:dm},
{code:`-- A tiny history table for file sizes and free space
CREATE TABLE dba.FileSizeHistory (
  captured datetime2 NOT NULL DEFAULT SYSDATETIME(),
  db sysname, file_name sysname, size_mb int, used_mb int
);

INSERT dba.FileSizeHistory (db, file_name, size_mb, used_mb)
SELECT DB_NAME(), name, size/128, CAST(FILEPROPERTY(name,'SpaceUsed') AS int)/128
FROM   sys.database_files;`},
{h:'Useful sources'},
{t:[['Need','DMV or view'],
['Active work','`sys.dm_exec_requests`, `sys.dm_exec_sessions`'],
['Waits','`sys.dm_os_wait_stats`'],
['I/O latency','`sys.dm_io_virtual_file_stats`'],
['Memory','`sys.dm_os_process_memory`, `sys.dm_os_memory_clerks`'],
['HA health','`sys.dm_hadr_database_replica_states`'],
['Job and backup status','`msdb` tables'],
['Blocking and locks','`sys.dm_tran_locks`, `sys.dm_os_waiting_tasks`']]},
{note:'Most DMVs reset at restart. Store samples so a restart does not erase your history.'}],
src:[['Dynamic management views',M.RD+'system-dynamic-management-views/system-dynamic-management-views'],['sys.dm_os_waiting_tasks',M.RD+'system-dynamic-management-views/sys-dm-os-waiting-tasks-transact-sql']]};

/* ---------- 2: Extended Events ---------- */
L['mss-ops:2:2']={blocks:[
{p:'Where DMVs show the **current** state, **Extended Events** capture **what happened**: deadlocks, errors, slow statements.'},
{svg:xe},
{h:'Use in monitoring'},
{ul:['Read **system_health** regularly for deadlocks, errors and wait events.','Create a small **always-on** session for known costly events, with a file target and size limit.','Create **short, filtered** sessions for investigations, and drop them afterwards.']},
{code:`-- Deadlocks in the last day from system_health files
SELECT x.value('(@timestamp)[1]','datetime2') AS time_utc, x.query('.') AS deadlock
FROM  (SELECT CAST(event_data AS xml) AS e
       FROM sys.fn_xe_file_target_read_file('system_health*.xel', NULL, NULL, NULL)
       WHERE object_name = 'xml_deadlock_report') a
CROSS APPLY e.nodes('/event') n(x)
WHERE  x.value('(@timestamp)[1]','datetime2') > DATEADD(day,-1,SYSUTCDATETIME());`},
{note:'Details of building sessions are in the Performance and Tuning sub-course. In operations, the discipline is to keep sessions small and to review them.'}],
src:[['Extended Events',M.RD+'extended-events/extended-events'],['system_health session',M.RD+'extended-events/use-the-system-health-session']]};

/* ---------- 3: Performance Monitor ---------- */
L['mss-ops:2:3']={blocks:[
{p:'**Performance Monitor** (Perfmon) records operating system and SQL Server counters over time. It is the standard way to build a baseline on Windows.'},
{svg:pm},
{h:'A starter counter set'},
{t:[['Counter','Look for'],
['`Processor % Processor Time`','Sustained high values'],
['`SQLServer:Buffer Manager Page life expectancy`','Sudden drops'],
['`SQLServer:Memory Manager Memory Grants Pending`','Above zero for long'],
['`PhysicalDisk Avg. Disk sec/Read`, `Avg. Disk sec/Write`','Latency over target'],
['`SQLServer:SQL Statistics Batch Requests/sec`','Workload level and change'],
['`SQLServer:Locks Lock Waits/sec`, `Number of Deadlocks/sec`','Blocking and deadlocks']]},
{code:`# Collect to a file every 15 seconds (Windows)
logman create counter SqlBaseline -c "\\Processor(_Total)\\% Processor Time" "\\SQLServer:Buffer Manager\\Page life expectancy" -si 15 -o C:\\PerfLogs\\SqlBaseline
logman start SqlBaseline`},
{note:'On Linux use the DMV `sys.dm_os_performance_counters` and tools such as collectd, Telegraf or your monitoring agent.'}],
src:[['Monitor resource usage with Performance Monitor',M.RD+'performance-monitor/monitor-resource-usage-system-monitor'],['sys.dm_os_performance_counters',M.RD+'system-dynamic-management-views/sys-dm-os-performance-counters-transact-sql']]};

/* ---------- 4: Alerting strategy ---------- */
L['mss-ops:2:4']={blocks:[
{p:'An alert is a request for a **human decision**. Too many alerts and people stop reading them. A good strategy decides **what interrupts** and **what waits**.'},
{svg:alr},
{h:'Rules'},
{ul:['**Every alert has an owner and a runbook**: what to check and do.','Separate **pages** (act now), **tickets** (act today) and **dashboards** (look when needed).','Alert on **symptoms users feel** and on **causes you can fix**, not on every counter.','Use **thresholds with duration** (for example over 90 percent for 10 minutes) to avoid flapping.','**Review alerts** monthly: delete noisy ones and add missing ones after incidents.']},
{h:'Tools'},
{t:[['Tool','Use'],
['**SQL Server Agent alerts and Database Mail**','Built in, good for errors and jobs'],
['**System Center, Azure Monitor, third-party**','Central monitoring and dashboards'],
['**Prometheus and Grafana**','Open source metrics and visualization'],
['**On-call and chat integrations**','Routing and escalation']]}],
src:[['Monitoring SQL Server with Azure Monitor','https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/monitor-sql-server-azure-monitor'],['Alerts',M.RD+'sql-server-agent/alerts']]};

})();
