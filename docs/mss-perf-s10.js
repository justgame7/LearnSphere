/* LearnSphere - SQL Server Performance & Tuning, Section 10: Extended Events & Monitoring.
   Lectures 0-4 are core, 5 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const arch=M.dg(700,200,[
[10,20,150,70,'Event|something happens:|sql_batch_completed',2],[190,20,150,70,'Predicate|filter: duration|over 1 second',0],[370,20,150,70,'Action|extra data:|sql_text, username',0],[550,20,140,70,'Target|event_file,|ring_buffer',2],
[10,115,680,70,'A session is a set of events with predicates, actions and targets.|Events fire inside the engine, so overhead is low when filtered well.',0]],
[[160,55,190,55],[340,55,370,55],[520,55,550,55]]);

const sh=M.dg(700,170,[
[10,20,215,70,'Always running|started with the instance',0],[245,20,215,70,'Captures|deadlocks, severe errors,|long waits, scheduler issues',2],[480,20,210,70,'Targets|ring buffer and|system_health*.xel files',0],
[10,110,680,45,'Check it first when something happened that you did not capture',0]],
[]);

const mk=M.dg(700,150,[
[10,25,150,70,'Choose events|sql_statement|_completed',0],[190,25,150,70,'Filter|duration, database',2],[370,25,150,70,'Add target|event_file',0],[550,25,140,70,'Start, read,|stop, drop',2]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

const rd=M.dg(700,150,[
[10,25,200,70,'.xel files|on disk',0],[250,25,200,70,'sys.fn_xe_file_target_read_file|returns event_data XML',2],[490,25,200,70,'Shred with XQuery|filter, group, sort',0]],
[[210,60,250,60],[450,60,490,60]]);

const prof=M.dg(700,170,[
[10,25,200,70,'SQL Server Profiler|deprecated|high overhead',0],[250,25,200,70,'Extended Events|replacement|lighter and richer',2],[490,25,200,70,'XEvent Profiler|in SSMS: quick live|view of a standard session',0],
[10,115,680,40,'Learn XE once and you can reproduce almost every trace you used before',0]],
[[210,60,250,60],[450,60,490,60]]);

/* ---------- 0: Architecture ---------- */
L['mss-perf:9:0']={blocks:[
{p:'**Extended Events (XE)** is the built-in tracing system. It records events from inside the engine with low overhead, and it replaces SQL Trace and Profiler.'},
{svg:arch},
{t:[['Part','Role'],
['**Package**','A group of events, actions and targets'],
['**Event**','A point in the engine that can be recorded'],
['**Predicate**','A filter evaluated before the event is stored'],
['**Action**','Extra data collected with the event'],
['**Target**','Where events go: file, ring buffer, counter, histogram'],
['**Session**','A named set of the above, started and stopped as one']]},
{code:`-- What events can I capture?
SELECT p.name AS package, o.name AS event_name
FROM   sys.dm_xe_objects o JOIN sys.dm_xe_packages p ON p.guid = o.package_guid
WHERE  o.object_type = 'event' AND o.name LIKE '%deadlock%';

-- Sessions on this instance
SELECT name, create_time FROM sys.dm_xe_sessions;`},
{note:'Always filter early with a predicate. Capturing every statement of a busy server can still be heavy, even though XE is lighter than Trace.'}],
src:[['Extended Events overview',M.RD+'extended-events/extended-events'],['Extended Events concepts',M.RD+'extended-events/sql-server-extended-events-packages']]};

/* ---------- 1: system_health ---------- */
L['mss-perf:9:1']={blocks:[
{p:'**system_health** is an Extended Events session that is **always on**. It captures the things you wish you had recorded after an incident.'},
{svg:sh},
{t:[['Event','Why it matters'],
['`xml_deadlock_report`','Every deadlock graph'],
['`error_reported` (severity 20 and above, plus 17 to 19 in some cases)','Serious errors'],
['`wait_info` for long waits','Latch, lock and I/O waits that took long'],
['`scheduler_monitor_system_health_ring_buffer_recorded`','Non-yielding schedulers, CPU issues'],
['`sp_server_diagnostics_component_result`','Health of memory, I/O, query processing']]},
{code:`-- Read deadlocks from the system_health files
SELECT CAST(event_data AS xml) AS event_xml
FROM   sys.fn_xe_file_target_read_file('system_health*.xel', NULL, NULL, NULL)
WHERE  object_name = 'xml_deadlock_report';`},
{note:'Files roll over, so old incidents can disappear. Copy the system_health files elsewhere or create your own session with larger files if you need a longer history.'}],
src:[['Use the system_health session',M.RD+'extended-events/use-the-system-health-session'],['sys.fn_xe_file_target_read_file',M.RD+'system-functions/sys-fn-xe-file-target-read-file-transact-sql']]};

/* ---------- 2: Creating sessions ---------- */
L['mss-perf:9:2']={blocks:[
{p:'You create a session in T-SQL or with the SSMS wizard (Management, Extended Events, Sessions, New Session). T-SQL is repeatable and easy to review.'},
{svg:mk},
{code:`CREATE EVENT SESSION [slow_statements] ON SERVER
ADD EVENT sqlserver.sql_statement_completed
 (ACTION (sqlserver.sql_text, sqlserver.database_name, sqlserver.client_app_name, sqlserver.username)
  WHERE duration > 1000000)         -- microseconds: over 1 second
ADD TARGET package0.event_file
 (SET filename = N'E:\\XE\\slow_statements.xel', max_file_size = 100, max_rollover_files = 5)
WITH (MAX_MEMORY = 4096 KB, EVENT_RETENTION_MODE = ALLOW_SINGLE_EVENT_LOSS,
      MAX_DISPATCH_LATENCY = 30 SECONDS, STARTUP_STATE = OFF);

ALTER EVENT SESSION [slow_statements] ON SERVER STATE = START;
-- ... wait and collect ...
ALTER EVENT SESSION [slow_statements] ON SERVER STATE = STOP;
DROP EVENT SESSION [slow_statements] ON SERVER;`},
{h:'Rules'},
{ul:['**Always use a predicate**: duration, database, or application.','Use the **event_file** target for anything you want to keep. **ring_buffer** is memory only and can lose data.','Limit file **size and rollover** so the disk does not fill.','**Stop and drop** sessions when finished.']}],
src:[['CREATE EVENT SESSION',M.TS+'statements/create-event-session-transact-sql'],['Quick start: Extended Events',M.RD+'extended-events/quick-start-extended-events-in-sql-server']]};

/* ---------- 3: Reading ---------- */
L['mss-perf:9:3']={blocks:[
{p:'Events are stored as **XML**. In SSMS you can browse them, and in T-SQL you can query them like a table.'},
{svg:rd},
{code:`SELECT x.value('(@timestamp)[1]', 'datetime2') AS event_time,
       x.value('(data[@name="duration"]/value)[1]', 'bigint')/1000 AS duration_ms,
       x.value('(action[@name="database_name"]/value)[1]', 'nvarchar(128)') AS db,
       x.value('(action[@name="sql_text"]/value)[1]', 'nvarchar(max)') AS sql_text
FROM  (SELECT CAST(event_data AS xml) AS e
       FROM   sys.fn_xe_file_target_read_file('E:\\XE\\slow_statements*.xel', NULL, NULL, NULL)) a
CROSS  APPLY e.nodes('/event') n(x)
ORDER  BY duration_ms DESC;`},
{h:'In SSMS'},
{ul:['**Watch Live Data**: events as they arrive.','**View Target Data**: the current content of a ring buffer or file target.','Open an **.xel file** directly and use filters, grouping and columns.']},
{note:'XML shredding is slow for very large files. Filter with predicates in the session so the file stays small, and read only what you need.'}],
src:[['Advanced Extended Events: view event data',M.RD+'extended-events/advanced-viewing-of-target-data-from-extended-events-in-sql-server'],['sys.fn_xe_file_target_read_file',M.RD+'system-functions/sys-fn-xe-file-target-read-file-transact-sql']]};

/* ---------- 4: Replacing Profiler ---------- */
L['mss-perf:9:4']={blocks:[
{p:'**SQL Server Profiler** and **SQL Trace** are deprecated for the database engine. Extended Events can capture the same information with less impact.'},
{svg:prof},
{t:[['Profiler event','Extended Events event'],
['SQL:BatchCompleted','`sql_batch_completed`'],
['RPC:Completed','`rpc_completed`'],
['SP:StmtCompleted','`sp_statement_completed`'],
['Deadlock graph','`xml_deadlock_report`'],
['Showplan XML','`query_post_execution_showplan` (expensive: filter strictly)'],
['Lock:Escalation','`lock_escalation`'],
['Login / Logout','`login`, `logout`']]},
{h:'XEvent Profiler in SSMS'},
{p:'SSMS has a quick view under **Object Explorer, XEvent Profiler**. It starts predefined sessions (Standard and TSQL) and shows live data. It is a good first step for ad hoc checks.'},
{ul:['Use it for **minutes**, not for permanent capture.','For longer captures create a **named session with a file target**.','Avoid heavy events such as actual plans on busy production servers.']}],
src:[['Extended Events replaces SQL Trace',M.RD+'extended-events/extended-events'],['XEvent Profiler',M.RD+'extended-events/use-the-ssms-xe-profiler']]};

})();
