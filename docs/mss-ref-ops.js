/* LearnSphere - SQL Server Operations and Monitoring Quick Reference (cheat sheet).
   window.QREF['mss-ops'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for SQL Server 2019 to 2022 and current Azure SQL; verify syntax against your build. Check build-specific behaviour in the release notes. */
window.QREF=window.QREF||{};
window.QREF['mss-ops']={title:'SQL Server Operations and Monitoring Quick Reference',blurb:'Operational queries and alert checklist for SQL Server, plus maps of Agent, monitoring, Resource Governor and everyday tasks.',hint:'alert on failure',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every SQL Server operator should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'SQL Server Agent and automation'},
{acc:[
{t:'Jobs, steps and schedules',s:'Automation inside the instance.',
 a:'A **job** has ordered **steps** (T-SQL, PowerShell, SSIS), **schedules** and notifications. Steps define what happens on success and failure. Job history is stored in msdb.',
 w:'Most routine maintenance runs as Agent jobs.',
 c:`SELECT name, enabled FROM msdb.dbo.sysjobs;`,see:[0,0,'Jobs, steps and schedules']},
{t:'Operators, alerts and Database Mail',s:'Be told when something breaks.',
 a:'**Operators** are contacts, **alerts** fire on severity, error numbers or performance conditions, and **Database Mail** sends the message. Test the full path.',
 w:'An alert nobody receives is useless.',
 c:`EXEC msdb.dbo.sp_send_dbmail @profile_name = 'dba', @recipients = 'dba@example.com', @subject = 'test';`,see:[0,1,'Operators, alerts and Database Mail']},
{t:'Proxies and job security',s:'Least privilege for job steps.',
 a:'A **proxy** runs a job step under a credential for non-T-SQL subsystems, so the Agent service account does not need broad rights.',
 w:'Never run jobs as sysadmin unless necessary.',
 c:`SELECT name, credential_id FROM msdb.dbo.sysproxies;`,see:[0,2,'Proxies and job security']},
{t:'Job history and troubleshooting',s:'Why did it fail.',
 a:'`sysjobhistory` records step results and messages. The Agent error log and SQL error log add context. Increase history retention for busy servers.',
 w:'Look at the failing step\'s message, not only the job outcome.',
 c:`SELECT TOP 20 j.name, h.step_name, h.run_status, h.message FROM msdb.dbo.sysjobhistory h JOIN msdb.dbo.sysjobs j ON j.job_id = h.job_id ORDER BY h.instance_id DESC;`,see:[0,3,'Job history and troubleshooting']},
{t:'PowerShell and dbatools',s:'Script the fleet.',
 a:'The SqlServer module and the community **dbatools** module provide commands for backups, restores, inventory, and migrations across many instances.',
 w:'Scripts in source control are repeatable and reviewable.',
 c:`Get-DbaDatabase -SqlInstance sql01 | Select Name, RecoveryModel, LastFullBackup`,see:[1,1,'dbatools essentials']}
]},

{h:'Monitoring and multi-server'},
{acc:[
{t:'What to monitor',s:'A short list.',
 a:'Availability, backups, job failures, disk space, error log, blocking, waits, and replication or AG health. Monitor trends against a baseline, not only thresholds.',
 w:'Monitor outcomes users care about first.',
 c:`SELECT * FROM sys.dm_os_sys_info;`,see:[2,0,'What to monitor and why']},
{t:'Monitoring with DMVs',s:'Built-in telemetry.',
 a:'DMVs give current and cumulative information. Collect them on a schedule into a repository table to build history.',
 w:'Cumulative values reset at restart.',
 c:`SELECT TOP 10 wait_type, wait_time_ms FROM sys.dm_os_wait_stats ORDER BY wait_time_ms DESC;`,see:[2,1,'Monitoring with DMVs']},
{t:'Extended Events',s:'Lightweight tracing.',
 a:'Sessions capture events with filters to a file or ring buffer, replacing Profiler. `system_health` is always on and captures deadlocks and errors.',
 w:'Filter early to keep overhead low.',
 c:`SELECT name, startup_state FROM sys.server_event_sessions;`,see:[2,2,'Extended Events for monitoring']},
{t:'Alerting strategy',s:'Few, actionable alerts.',
 a:'Alert on conditions that need a person: backup failure, no log backup, disk space low, AG not synchronizing, severity 19 to 25 errors. Route by severity and escalate.',
 w:'Fewer alerts get more attention.',
 c:`SELECT name, message_id, severity FROM msdb.dbo.sysalerts;`,see:[2,4,'Alerting strategy']},
{t:'Central Management Server',s:'Query many instances.',
 a:'A CMS stores registered servers in groups so you can run one query across all, and apply policies.',
 w:'Good for inventory and ad hoc checks.',
 c:`SELECT name FROM msdb.dbo.sysmanagement_shared_registered_servers;`,see:[3,0,'Central Management Servers']},
{t:'Policy-Based Management',s:'Standards as policies.',
 a:'Policies evaluate facets of server objects against conditions on demand, on schedule or on change, and report or enforce standards.',
 w:'Use it to prove consistency across servers.',
 c:`SELECT name FROM msdb.dbo.syspolicy_policies;`,see:[3,2,'Policy-Based Management']}
]},

{h:'Capacity, governance and troubleshooting'},
{acc:[
{t:'Resource Governor',s:'Limit and prioritise workloads.',
 a:'A **classifier function** assigns each session to a **workload group**, which uses a **resource pool** with CPU, memory and I/O limits. It protects important workloads from noisy ones.',
 w:'Memory limits apply to query memory, not the buffer pool.',
 c:`SELECT * FROM sys.resource_governor_workload_groups;`,see:[4,0,'Resource Governor basics']},
{t:'Capacity planning',s:'Know the trend.',
 a:'Track database size, growth and key metrics monthly. Forecast when disk, memory or CPU will run out and plan before it does.',
 w:'Capacity is a trend, not a snapshot.',
 c:`SELECT DB_NAME(database_id), SUM(size)*8/1024 AS mb FROM sys.master_files GROUP BY database_id;`,see:[4,2,'Capacity planning and growth tracking']},
{t:'A troubleshooting method',s:'Consistent steps.',
 a:'Define the problem, check what changed, gather evidence (error log, DMVs, events), form a hypothesis, test, fix, and document. Avoid changing several things at once.',
 w:'A method beats panic.',
 c:`EXEC sp_readerrorlog;`,see:[5,0,'A troubleshooting method']},
{t:'Reading the error log',s:'First place to look.',
 a:'The SQL Server error log records startups, backups, errors, deadlocks (with trace flags) and I/O warnings. `sp_readerrorlog` filters it.',
 w:'Cycle the log regularly so it stays readable.',
 c:`EXEC sp_readerrorlog 0, 1, 'error';`,see:[5,1,'Reading the error log']},
{t:'Connectivity failures',s:'Layers to check.',
 a:'Check name resolution, network and firewall, the instance listening port, protocols, authentication and permissions, in that order.',
 w:'Test from the client machine.',
 c:`sqlcmd -S tcp:server,1433 -E -Q "SELECT 1"`,see:[5,3,'Connectivity failures']},
{t:'Dump files',s:'When SQL Server crashes.',
 a:'Stack dumps (`SQLDump*.mdmp`) appear in the Log directory after serious errors. They are for Microsoft Support, along with the error log entries.',
 w:'Collect them before restarting if you can.',
 c:`SELECT * FROM sys.dm_server_memory_dumps;`,see:[5,2,'Dump files and stack dumps']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Three small maps of how the parts fit together: SQL Server Agent, monitoring layers and Resource Governor.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. SQL Server Agent'},
{map:{title:'Agent map',h:328,trace:'A job runs and notifies',
 hint:'Tap any box, or press A job runs and notifies to follow a job through the Agent.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'sch',x:126,y:24,w:200,h:56,c:'ext',t:'Schedule',s:'when',d:'Time-based or on startup or idle.',why:'Avoid overlaps.',chk:`SELECT * FROM msdb.dbo.sysschedules;`,see:[0,0,'Jobs, steps and schedules']},
 {id:'job',x:354,y:24,w:200,h:56,c:'proc',t:'Job',s:'ordered steps',d:'A named sequence of steps with a failure policy.',why:'Set owner carefully.',chk:`SELECT name, owner_sid FROM msdb.dbo.sysjobs;`,see:[0,0,'Jobs, steps and schedules']},
 {id:'stp',x:126,y:136,w:200,h:56,c:'proc',t:'Step',s:'T-SQL, PowerShell, CmdExec',d:'Each step has a subsystem and success and failure actions.',why:'Use retries sparingly.',chk:`SELECT step_id, subsystem FROM msdb.dbo.sysjobsteps;`,see:[0,4,'Multi-step jobs and error handling']},
 {id:'prx',x:354,y:136,w:200,h:56,c:'warn',t:'Proxy',s:'credential',d:'Runs non-T-SQL steps with limited rights.',why:'Least privilege.',chk:`SELECT * FROM msdb.dbo.sysproxies;`,see:[0,2,'Proxies and job security']},
 {id:'op',x:126,y:248,w:200,h:56,c:'mem',t:'Operator',s:'contact',d:'Receives notifications by email.',why:'Use groups.',chk:`SELECT name, email_address FROM msdb.dbo.sysoperators;`,see:[0,1,'Operators, alerts and Database Mail']},
 {id:'mail',x:354,y:248,w:200,h:56,c:'net',t:'Database Mail',s:'SMTP',d:'Sends the message through a profile.',why:'Test it.',chk:`SELECT * FROM msdb.dbo.sysmail_event_log;`,see:[0,1,'Operators, alerts and Database Mail']}],
 steps:[
 {ids:['sch','job'],t:'1. A schedule starts the job.',w:'Time-based start.',s:'Schedule.',x:'Disabled job.',c:`SELECT name, enabled FROM msdb.dbo.sysjobs;`},
 {ids:['stp','prx'],t:'2. Steps run in order, using a proxy if needed.',w:'Defined failure paths.',s:'Retry.',x:'Wrong owner.',c:`SELECT * FROM msdb.dbo.sysjobhistory;`},
 {ids:['op','mail'],t:'3. On failure, the operator is notified by Database Mail.',w:'People are told.',s:'Notification.',x:'Mail not configured.',c:`SELECT * FROM msdb.dbo.sysmail_event_log;`}]}},

{h:'2. Monitoring layers'},
{map:{title:'Monitoring map',h:328,trace:'From evidence to an alert',
 hint:'Tap any box, or press From evidence to an alert to follow monitoring data.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'dmv',x:126,y:24,w:200,h:56,c:'mem',t:'DMVs',s:'current state',d:'Live and cumulative engine counters.',why:'Collect snapshots.',chk:`SELECT * FROM sys.dm_os_wait_stats;`,see:[2,1,'Monitoring with DMVs']},
 {id:'xe',x:354,y:24,w:200,h:56,c:'mem',t:'Extended Events',s:'events',d:'Targeted event capture to files.',why:'Filter.',chk:`SELECT * FROM sys.dm_xe_sessions;`,see:[2,2,'Extended Events for monitoring']},
 {id:'pm',x:126,y:136,w:200,h:56,c:'mem',t:'Performance Monitor',s:'OS counters',d:'Windows counters for CPU, memory and disk.',why:'Log to a file for baselines.',chk:`typeperf "\\Processor(_Total)\\% Processor Time" -sc 5`,see:[2,3,'Performance Monitor and counters']},
 {id:'log',x:354,y:136,w:200,h:56,c:'mem',t:'Error log',s:'history',d:'Messages and errors from the engine.',why:'Cycle regularly.',chk:`EXEC sp_readerrorlog;`,see:[5,1,'Reading the error log']},
 {id:'alr',x:240,y:248,w:200,h:56,c:'warn',t:'Alerts',s:'notify',d:'Conditions that notify an operator.',why:'Few and actionable.',chk:`SELECT * FROM msdb.dbo.sysalerts;`,see:[2,4,'Alerting strategy']}],
 steps:[
 {ids:['dmv','xe'],t:'1. DMVs and Extended Events provide engine evidence.',w:'Inside view.',s:'Collection.',x:'No history.',c:`SELECT * FROM sys.dm_xe_sessions;`},
 {ids:['pm','log'],t:'2. Performance Monitor and the error log add OS and history.',w:'Outside view.',s:'Counters.',x:'Logs rolled away.',c:`EXEC sp_readerrorlog;`},
 {ids:['alr'],t:'3. Alerts turn evidence into action.',w:'Someone responds.',s:'Thresholds.',x:'Alert fatigue.',c:`SELECT * FROM msdb.dbo.sysalerts;`}]}},

{h:'3. Resource Governor'},
{map:{title:'Resource Governor map',h:216,trace:'From a session to a pool',
 hint:'Tap any box, or press From a session to a pool to follow how a session is classified.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'ses',x:126,y:24,w:200,h:56,c:'ext',t:'New session',s:'login',d:'A connection arrives and is classified.',why:'Based on login, app, host.',chk:`SELECT session_id, group_id FROM sys.dm_exec_sessions;`,see:[4,0,'Resource Governor basics']},
 {id:'cls',x:354,y:24,w:200,h:56,c:'proc',t:'Classifier function',s:'in master',d:'A function returning the workload group name.',why:'Must be fast.',chk:`SELECT * FROM sys.resource_governor_configuration;`,see:[4,0,'Resource Governor basics']},
 {id:'grp',x:126,y:136,w:200,h:56,c:'mem',t:'Workload group',s:'policy',d:'Sets importance and request limits.',why:'One per workload.',chk:`SELECT * FROM sys.dm_resource_governor_workload_groups;`,see:[4,1,'Workload groups and pools']},
 {id:'pool',x:354,y:136,w:200,h:56,c:'disk',t:'Resource pool',s:'limits',d:'CPU, memory and I/O min and max.',why:'Max is a cap under contention.',chk:`SELECT * FROM sys.dm_resource_governor_resource_pools;`,see:[4,1,'Workload groups and pools']}],
 steps:[
 {ids:['ses','cls'],t:'1. A new session runs the classifier.',w:'Assigned at login.',s:'Function.',x:'Slow classifier blocks logins.',c:`SELECT * FROM sys.resource_governor_configuration;`},
 {ids:['grp','pool'],t:'2. The workload group maps to a pool with limits.',w:'Protects workloads.',s:'Min and max.',x:'Limits too tight.',c:`SELECT * FROM sys.dm_resource_governor_resource_pools;`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Three small maps of how something happens, step by step: an alerted job, a connection failure and capacity tracking.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Creating an alerted job'},
{map:{title:'Job creation map',h:328,trace:'Build a job that tells you when it fails',
 hint:'Tap any box, or press Build a job that tells you when it fails to follow the steps.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'mail',x:126,y:24,w:200,h:56,c:'proc',t:'Database Mail',s:'profile',d:'Create a mail account and profile and test.',why:'Send a test.',chk:`EXEC msdb.dbo.sysmail_help_profile_sp;`,see:[0,1,'Operators, alerts and Database Mail']},
 {id:'op',x:354,y:24,w:200,h:56,c:'proc',t:'Operator',s:'contact group',d:'Create an operator with an email address or group.',why:'Group mailbox.',chk:`EXEC msdb.dbo.sp_add_operator @name = 'DBA', @email_address = 'dba@example.com';`,see:[0,1,'Operators, alerts and Database Mail']},
 {id:'job',x:126,y:136,w:200,h:56,c:'proc',t:'Job and steps',s:'T-SQL',d:'Create the job and its steps with failure actions.',why:'Add error handling.',chk:`EXEC msdb.dbo.sp_add_job @job_name = 'Nightly';`,see:[0,4,'Multi-step jobs and error handling']},
 {id:'sch',x:354,y:136,w:200,h:56,c:'proc',t:'Schedule and notify',s:'on failure',d:'Attach a schedule and notify the operator on failure.',why:'Offset from others.',chk:`EXEC msdb.dbo.sp_add_jobschedule ...;`,see:[0,0,'Jobs, steps and schedules']},
 {id:'tst',x:240,y:248,w:200,h:56,c:'mem',t:'Test',s:'force a failure',d:'Cause a failure to verify the notification arrives.',why:'Document.',chk:`EXEC msdb.dbo.sp_start_job 'Nightly';`,see:[0,3,'Job history and troubleshooting']}],
 steps:[
 {ids:['mail','op'],t:'1. Set up mail and an operator.',w:'Notification path.',s:'Profile.',x:'No test.',c:`EXEC msdb.dbo.sysmail_help_profile_sp;`},
 {ids:['job','sch'],t:'2. Create the job, schedule and failure notification.',w:'Automation.',s:'Owner.',x:'No failure path.',c:`SELECT * FROM msdb.dbo.sysjobs;`},
 {ids:['tst'],t:'3. Test with a forced failure.',w:'Proof.',s:'Alerts.',x:'Skipping tests.',c:`EXEC msdb.dbo.sp_start_job 'Nightly';`}]}},

{h:'2. Troubleshooting a connection failure'},
{map:{title:'Connectivity map',h:216,trace:'Check from the client to the instance',
 hint:'Tap any box, or press Check from the client to the instance to follow the layers.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'nm',x:126,y:24,w:200,h:56,c:'mem',t:'Name resolution',s:'DNS',d:'Does the name resolve to the right address?',why:'Check aliases.',chk:`nslookup sql01`,see:[5,3,'Connectivity failures']},
 {id:'net',x:354,y:24,w:200,h:56,c:'net',t:'Network and firewall',s:'reachable',d:'Is the port reachable from the client?',why:'Test the port.',chk:`Test-NetConnection sql01 -Port 1433`,see:[5,3,'Connectivity failures']},
 {id:'prt',x:21,y:136,w:194,h:56,c:'mem',t:'Listening port',s:'TCP',d:'Is the instance listening, and on which port?',why:'Dynamic ports for named instances.',chk:`EXEC sp_readerrorlog 0, 1, 'listening';`,see:[5,3,'Connectivity failures']},
 {id:'prt2',x:243,y:136,w:194,h:56,c:'mem',t:'Protocols and encryption',s:'TCP/IP, TLS',d:'Is TCP/IP enabled and certificate trusted?',why:'Match client and server.',chk:`SELECT encrypt_option FROM sys.dm_exec_connections;`,see:[5,3,'Connectivity failures']},
 {id:'auth',x:465,y:136,w:194,h:56,c:'warn',t:'Authentication',s:'login',d:'Does the login exist and have CONNECT permission?',why:'Error log has the reason.',chk:`EXEC sp_readerrorlog 0, 1, 'Login failed';`,see:[5,3,'Connectivity failures']}],
 steps:[
 {ids:['nm','net'],t:'1. Check name and network from the client.',w:'Most common causes.',s:'Hosts, firewall.',x:'Testing from the server only.',c:`Test-NetConnection sql01 -Port 1433`},
 {ids:['prt','prt2'],t:'2. Check the listening port and protocols.',w:'Server side.',s:'Config Manager.',x:'Wrong port.',c:`EXEC sp_readerrorlog 0, 1, 'listening';`},
 {ids:['auth'],t:'3. Check authentication in the error log.',w:'Reason is logged.',s:'Login.',x:'Misleading client message.',c:`EXEC sp_readerrorlog 0, 1, 'Login failed';`}]}},

{h:'3. Tracking growth and capacity'},
{map:{title:'Capacity map',h:216,trace:'Collect, trend and forecast',
 hint:'Tap any box, or press Collect, trend and forecast to follow capacity planning.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'col',x:126,y:24,w:200,h:56,c:'proc',t:'Collect',s:'scheduled',d:'A job records database and file sizes and key metrics.',why:'Daily or weekly.',chk:`INSERT INTO dba.dbo.FileSizes SELECT ... FROM sys.master_files;`,see:[4,2,'Capacity planning and growth tracking']},
 {id:'st',x:354,y:24,w:200,h:56,c:'disk',t:'Store',s:'history table',d:'Keep history in a central table.',why:'Retain for years.',chk:`SELECT * FROM dba.dbo.FileSizes;`,see:[4,2,'Capacity planning and growth tracking']},
 {id:'fc',x:126,y:136,w:200,h:56,c:'mem',t:'Forecast',s:'trend',d:'Project when space or capacity runs out.',why:'Include seasonality.',chk:`SELECT ... FROM dba.dbo.FileSizes;`,see:[4,2,'Capacity planning and growth tracking']},
 {id:'act',x:354,y:136,w:200,h:56,c:'proc',t:'Act',s:'ahead of time',d:'Order storage, archive data or right-size.',why:'Cost matters.',chk:`SELECT * FROM sys.dm_os_volume_stats(DB_ID(), 1);`,see:[4,3,'Right-sizing and cost']}],
 steps:[
 {ids:['col','st'],t:'1. Collect and store sizes regularly.',w:'History.',s:'Job.',x:'No retention.',c:`SELECT * FROM dba.dbo.FileSizes;`},
 {ids:['fc','act'],t:'2. Forecast and act early.',w:'No surprises.',s:'Review.',x:'Reacting to a full disk.',c:`SELECT * FROM sys.dm_os_volume_stats(DB_ID(), 1);`}]}},

]},

{t:'Operations quick queries',d:'Queries for the checks done most often.',see:[[2,1,'Monitoring with DMVs'],[5,1,'Reading the error log']],b:[
{t:[['Check','Query'],['Failed jobs in the last day','`SELECT j.name, h.run_date FROM msdb.dbo.sysjobhistory h JOIN msdb.dbo.sysjobs j ON j.job_id = h.job_id WHERE h.run_status = 0 AND h.step_id = 0;`'],['Last backup per database','`SELECT database_name, MAX(backup_finish_date) FROM msdb.dbo.backupset GROUP BY database_name;`'],['Disk space','`SELECT DISTINCT vs.volume_mount_point, vs.available_bytes/1048576 AS free_mb FROM sys.master_files f CROSS APPLY sys.dm_os_volume_stats(f.database_id, f.file_id) vs;`'],['Error log search','`EXEC sp_readerrorlog 0, 1, \'error\';`'],['Current blocking','`SELECT * FROM sys.dm_exec_requests WHERE blocking_session_id <> 0;`'],['Uptime','`SELECT sqlserver_start_time FROM sys.dm_os_sys_info;`'],['Database state','`SELECT name, state_desc FROM sys.databases;`'],['Agent status','`SELECT status_desc FROM sys.dm_server_services WHERE servicename LIKE \'SQL Server Agent%\';`']]}
]},
{t:'Alerts worth having',d:'A starting set of alerts, with the condition and why.',see:[[2,4,'Alerting strategy'],[0,1,'Operators, alerts and Database Mail']],b:[
{t:[['Alert','Condition','Why'],['Backup failure','Job failure or no backup in the RPO window','Recoverability'],['Log backup missing','`log_reuse_wait_desc = LOG_BACKUP` for long','Log growth'],['Severity 19 to 25','Agent alerts on severity','Serious engine errors'],['Error 823, 824, 825','Agent alerts','I/O or corruption'],['Low disk space','Free space below threshold','Outage prevention'],['AG not synchronized','Replica or database state','Data protection'],['Blocking for minutes','Blocked process threshold','User impact'],['Agent not running','Service status','Jobs missed']]}
]},
]};
