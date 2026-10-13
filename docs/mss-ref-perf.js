/* LearnSphere - SQL Server Performance and Tuning Quick Reference (cheat sheet).
   window.QREF['mss-perf'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for SQL Server 2019 to 2022 and current Azure SQL; verify syntax against your build. Check build-specific behaviour in the release notes. */
window.QREF=window.QREF||{};
window.QREF['mss-perf']={title:'SQL Server Performance and Tuning Quick Reference',blurb:'Wait types, performance DMVs and fixes for SQL Server tuning, plus maps of waits, Query Store, plans and common investigations.',hint:'parameter sniffing',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every SQL Server tuner should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Method and waits'},
{acc:[
{t:'A tuning method',s:'Measure, find, fix, verify.',
 a:'Establish a baseline, find the biggest cost (usually with waits and Query Store), change one thing, and measure again. Without a baseline you cannot tell whether a change helped.',
 w:'It stops guess-driven tuning.',
 c:`SELECT TOP 10 wait_type, wait_time_ms FROM sys.dm_os_wait_stats ORDER BY wait_time_ms DESC;`,see:[0,0,'A tuning method: measure, find, fix, verify']},
{t:'How waits work',s:'Running, runnable, suspended.',
 a:'A worker is **running**, **runnable** (waiting for CPU, `SOS_SCHEDULER_YIELD`) or **suspended** (waiting for a resource such as I/O or a lock). The wait type names the resource.',
 w:'Waits turn "it is slow" into "it waits for X".',
 c:`SELECT session_id, status, wait_type, wait_time FROM sys.dm_exec_requests WHERE session_id > 50;`,see:[1,0,'How SQL Server waits work']},
{t:'Common wait types',s:'What the names mean.',
 a:'`PAGEIOLATCH_*` data file reads, `WRITELOG` log flushes, `LCK_M_*` blocking, `CXPACKET`/`CXCONSUMER` parallelism, `RESOURCE_SEMAPHORE` memory grants, `SOS_SCHEDULER_YIELD` CPU pressure.',
 w:'Learn six or seven and you can read most reports.',
 c:`SELECT wait_type, waiting_tasks_count, wait_time_ms FROM sys.dm_os_wait_stats WHERE wait_type LIKE 'PAGEIOLATCH%' OR wait_type = 'WRITELOG';`,see:[1,4,'Common wait types: PAGEIOLATCH, CXPACKET, LCK_M, WRITELOG']},
{t:'Query statistics DMV',s:'Cumulative cost per plan.',
 a:'`sys.dm_exec_query_stats` keeps totals per cached plan: executions, CPU, reads, duration. It disappears when plans leave the cache, so Query Store is better for history.',
 w:'Sort by total CPU or reads to find top consumers.',
 c:`SELECT TOP 10 total_worker_time/execution_count AS avg_cpu, execution_count, st.text FROM sys.dm_exec_query_stats qs CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st ORDER BY total_worker_time DESC;`,see:[1,3,'Query statistics with dm_exec_query_stats']}
]},

{h:'Query Store and plans'},
{acc:[
{t:'Query Store',s:'A flight recorder for queries.',
 a:'Query Store records query text, plans and runtime statistics per interval, inside the database. It survives restarts and lets you compare plans over time.',
 w:'Turn it on for every user database and check capture mode and size.',
 c:`ALTER DATABASE MyDb SET QUERY_STORE = ON (OPERATION_MODE = READ_WRITE);`,see:[2,0,'Enabling and configuring Query Store']},
{t:'Regressions and plan forcing',s:'Pin the good plan.',
 a:'A **regressed query** got slower after a plan change. You can **force** the earlier plan with `sp_query_store_force_plan` as a quick fix while you find the cause.',
 w:'Forced plans can fail, so monitor them.',
 c:`EXEC sp_query_store_force_plan @query_id = 42, @plan_id = 7;`,see:[2,2,'Regressed queries and plan forcing']},
{t:'Estimated and actual plans',s:'What was guessed and what happened.',
 a:'The estimated plan shows the optimiser\'s choices and row estimates. The actual plan adds real row counts, executions and warnings. Large gaps between them signal statistics or sniffing issues.',
 w:'Always compare estimated and actual rows.',
 c:`SET STATISTICS IO, TIME ON;`,see:[3,0,'Estimated vs actual plans']},
{t:'Scans, seeks and lookups',s:'Access patterns.',
 a:'A **seek** finds specific rows, a **scan** reads the structure. A **key lookup** fetches missing columns from the clustered index per row and hurts when repeated for many rows.',
 w:'A covering index removes expensive lookups.',
 c:`SELECT OrderId, Status FROM dbo.Orders WHERE CustomerId = 42;`,see:[3,2,'Scans, seeks and key lookups']},
{t:'Spills and warnings',s:'Not enough memory grant.',
 a:'Sort and hash operators that exceed their memory grant **spill** to tempdb, which is slow. Bad estimates cause under-sized grants.',
 w:'Spill warnings usually mean statistics need attention.',
 c:`SELECT * FROM sys.dm_exec_query_memory_grants;`,see:[3,4,'Spills, warnings and row goals']}
]},

{h:'Statistics, indexes and IQP'},
{acc:[
{t:'Statistics',s:'The optimiser\'s map.',
 a:'Statistics describe value distribution so the optimiser can estimate rows. Auto-update triggers on a threshold of changes. Large tables may need more frequent or full-scan updates.',
 w:'Stale statistics are a top cause of bad plans.',
 c:`SELECT name, last_updated, rows, modification_counter FROM sys.stats s CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) WHERE s.object_id = OBJECT_ID('dbo.Orders');`,see:[4,0,'How statistics work']},
{t:'Parameter sniffing',s:'A plan fitted to one value.',
 a:'The plan is compiled for the first parameter values. If data is skewed, a plan good for one value is bad for another. Fixes: `OPTION (RECOMPILE)`, `OPTIMIZE FOR`, better indexes, or Query Store hints.',
 w:'A query that is sometimes fast and sometimes slow is the classic symptom.',
 c:`SELECT query_id, COUNT(DISTINCT plan_id) AS plans FROM sys.query_store_plan GROUP BY query_id HAVING COUNT(DISTINCT plan_id) > 1;`,see:[4,3,'Parameter sniffing and fixes']},
{t:'Covering and included columns',s:'Avoid lookups.',
 a:'Add output columns as **INCLUDE** columns so the nonclustered index answers the query alone. Keep key columns for seek and sort.',
 w:'Each index costs writes, so design for the workload.',
 c:`CREATE NONCLUSTERED INDEX IX_Orders_Cust ON dbo.Orders (CustomerId) INCLUDE (Status, Total);`,see:[5,1,'Covering and included columns']},
{t:'Missing and unused indexes',s:'Evidence, not blind trust.',
 a:'Missing-index DMVs suggest indexes but ignore existing overlap and workload mix. Unused-index DMVs show indexes with no reads and many writes. Review before changing.',
 w:'Consolidate rather than add.',
 c:`SELECT TOP 10 * FROM sys.dm_db_missing_index_details;`,see:[5,3,'Missing index DMVs and their limits']},
{t:'Intelligent Query Processing',s:'Compatibility-level features.',
 a:'Newer compatibility levels enable adaptive joins, memory grant feedback and batch mode on rowstore. Behaviour changes with the level, so test before raising it.',
 w:'Use Query Store to compare before and after.',
 c:`ALTER DATABASE MyDb SET COMPATIBILITY_LEVEL = 160;`,see:[6,0,'Compatibility levels and behavior changes']}
]},

{h:'Resources and blocking'},
{acc:[
{t:'Memory pressure',s:'Grants and clerks.',
 a:'Memory goes to the buffer pool, plan cache and query memory grants. `RESOURCE_SEMAPHORE` waits mean queries are waiting for a grant. Look at memory clerks for what uses it.',
 w:'Adding RAM hides bad queries until they grow.',
 c:`SELECT TOP 10 type, SUM(pages_kb)/1024 AS mb FROM sys.dm_os_memory_clerks GROUP BY type ORDER BY mb DESC;`,see:[7,0,'Memory pressure and memory clerks']},
{t:'CPU and parallelism',s:'Too many or too few cores per query.',
 a:'High signal wait (`SOS_SCHEDULER_YIELD`) means CPU pressure. Parallel plans use multiple workers: tune MAXDOP and cost threshold, and fix the queries that need it.',
 w:'A few big queries often explain high CPU.',
 c:`SELECT TOP 5 total_worker_time, execution_count FROM sys.dm_exec_query_stats ORDER BY total_worker_time DESC;`,see:[7,2,'CPU pressure and parallelism']},
{t:'Storage latency',s:'Per-file read and write time.',
 a:'`sys.dm_io_virtual_file_stats` gives cumulative stall per file. Average read latency above 20 ms or log write latency above a few ms deserves attention.',
 w:'Check latency per file before blaming the SAN or the query.',
 c:`SELECT DB_NAME(database_id) AS db, file_id, io_stall_read_ms/NULLIF(num_of_reads,0) AS avg_read_ms FROM sys.dm_io_virtual_file_stats(NULL,NULL);`,see:[7,3,'Storage latency and virtual file stats']},
{t:'tempdb contention',s:'Allocation page latches.',
 a:'`PAGELATCH_*` waits on tempdb allocation pages indicate contention. Use equal-sized data files and avoid creating many temp objects in tight loops.',
 w:'One tempdb file per core up to eight is a common start.',
 c:`SELECT * FROM sys.dm_os_waiting_tasks WHERE wait_type LIKE 'PAGELATCH%';`,see:[7,4,'tempdb contention and configuration']},
{t:'Head blocker',s:'Find the root of a block chain.',
 a:'A chain of sessions waits behind one **head blocker**. Find its session and statement, and decide whether to wait, tune or kill.',
 w:'Killing without checking can start a long rollback.',
 c:`SELECT session_id, blocking_session_id, wait_type, wait_time FROM sys.dm_exec_requests WHERE blocking_session_id <> 0;`,see:[8,0,'Finding the head blocker']},
{t:'Deadlocks',s:'Reading the graph.',
 a:'The `system_health` Extended Events session captures deadlock graphs. The graph lists victims, processes, resources and statements. Consistent access order and indexes reduce them.',
 w:'Deadlocks are retried in code, but still deserve a fix.',
 c:`SELECT CAST(event_data AS xml) FROM sys.fn_xe_file_target_read_file('system_health*.xel', NULL, NULL, NULL) WHERE object_name = 'xml_deadlock_report';`,see:[8,1,'Reading deadlock graphs']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Three small maps of how the parts fit together: waits, Query Store and statistics to plan.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. Wait-based tuning'},
{map:{title:'Wait map',h:216,trace:'Where a request spends its time',
 hint:'Tap any box, or press Where a request spends its time to follow a request through its states.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'run',x:126,y:24,w:200,h:56,c:'proc',t:'Running',s:'on a CPU',d:'The worker executes on the scheduler.',why:'CPU time accumulates.',chk:`SELECT * FROM sys.dm_exec_requests WHERE status = 'running';`,see:[1,0,'How SQL Server waits work']},
 {id:'rn',x:354,y:24,w:200,h:56,c:'warn',t:'Runnable',s:'waiting for CPU',d:'Ready, but queued behind others (SOS_SCHEDULER_YIELD).',why:'High values mean CPU pressure.',chk:`SELECT * FROM sys.dm_os_schedulers WHERE runnable_tasks_count > 0;`,see:[7,2,'CPU pressure and parallelism']},
 {id:'su',x:126,y:136,w:200,h:56,c:'warn',t:'Suspended',s:'waiting for a resource',d:'Waiting for I/O, a lock, memory or a latch.',why:'The wait type names it.',chk:`SELECT wait_type, wait_time FROM sys.dm_exec_requests WHERE status = 'suspended';`,see:[1,4,'Common wait types']},
 {id:'res',x:354,y:136,w:200,h:56,c:'mem',t:'Resource',s:'disk, lock, memory',d:'The resource becomes available and the worker becomes runnable.',why:'Fix the resource or the query.',chk:`SELECT * FROM sys.dm_os_wait_stats ORDER BY wait_time_ms DESC;`,see:[1,1,'sys.dm_os_wait_stats']}],
 steps:[
 {ids:['run','rn'],t:'1. A request runs on a CPU, and if it must wait it becomes suspended.',w:'Three states.',s:'Schedulers.',x:'Ignoring signal waits.',c:`SELECT * FROM sys.dm_exec_requests;`},
 {ids:['su','res'],t:'2. It waits on a named resource and returns to runnable when ready.',w:'The wait type is the clue.',s:'Resource.',x:'Tuning the wrong layer.',c:`SELECT * FROM sys.dm_os_wait_stats ORDER BY wait_time_ms DESC;`}]}},

{h:'2. Query Store'},
{map:{title:'Query Store map',h:216,trace:'From a query to a forced plan',
 hint:'Tap any box, or press From a query to a forced plan to follow Query Store.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'q',x:126,y:24,w:200,h:56,c:'ext',t:'Query runs',s:'plan compiled',d:'Each execution has a plan and runtime statistics.',why:'Parameterised queries group together.',chk:`SELECT TOP 5 * FROM sys.query_store_query;`,see:[2,0,'Enabling and configuring Query Store']},
 {id:'cap',x:354,y:24,w:200,h:56,c:'disk',t:'Capture',s:'interval stats',d:'Statistics are aggregated per interval and stored in the database.',why:'Mind size and capture mode.',chk:`SELECT actual_state_desc, current_storage_size_mb FROM sys.database_query_store_options;`,see:[2,4,'Capture modes and cleanup']},
 {id:'reg',x:126,y:136,w:200,h:56,c:'warn',t:'Regression',s:'slower plan',d:'A query\'s duration increases after a plan change.',why:'Use the regressed queries report.',chk:`SELECT TOP 10 * FROM sys.query_store_runtime_stats ORDER BY avg_duration DESC;`,see:[2,2,'Regressed queries and plan forcing']},
 {id:'frc',x:354,y:136,w:200,h:56,c:'proc',t:'Force plan',s:'pin the good one',d:'Force a known good plan as an immediate fix.',why:'Check for forcing failures.',chk:`EXEC sp_query_store_force_plan @query_id = 42, @plan_id = 7;`,see:[2,2,'Regressed queries and plan forcing']}],
 steps:[
 {ids:['q','cap'],t:'1. Queries run and Query Store aggregates statistics.',w:'History in the database.',s:'Capture mode.',x:'Read-only because it is full.',c:`SELECT actual_state_desc FROM sys.database_query_store_options;`},
 {ids:['reg','frc'],t:'2. Spot regressions and force the good plan.',w:'Fast mitigation.',s:'Plan IDs.',x:'Forcing hides the cause.',c:`SELECT * FROM sys.query_store_plan WHERE is_forced_plan = 1;`}]}},

{h:'3. Statistics to plan'},
{map:{title:'Plan map',h:216,trace:'How a plan is chosen',
 hint:'Tap any box, or press How a plan is chosen to follow estimation to execution.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'st',x:126,y:24,w:200,h:56,c:'disk',t:'Statistics',s:'histograms',d:'Distribution of values per column or index.',why:'Update regularly.',chk:`DBCC SHOW_STATISTICS ('dbo.Orders', IX_Orders_Cust);`,see:[4,0,'How statistics work']},
 {id:'ce',x:354,y:24,w:200,h:56,c:'proc',t:'Cardinality estimator',s:'row estimates',d:'Estimates how many rows each operator returns.',why:'Version depends on compat level.',chk:`SELECT compatibility_level FROM sys.databases;`,see:[4,2,'Cardinality estimator versions']},
 {id:'pl',x:126,y:136,w:200,h:56,c:'proc',t:'Plan choice',s:'cost-based',d:'The optimiser picks the cheapest plan it finds.',why:'Poor estimates lead to poor plans.',chk:`SET SHOWPLAN_XML ON;`,see:[3,1,'Reading a plan: operators and data flow']},
 {id:'ex',x:354,y:136,w:200,h:56,c:'mem',t:'Execution',s:'actual rows',d:'Operators run and actual row counts appear in the actual plan.',why:'Compare with estimates.',chk:`SET STATISTICS XML ON;`,see:[3,0,'Estimated vs actual plans']}],
 steps:[
 {ids:['st','ce'],t:'1. Statistics feed the estimator.',w:'Estimates come from data.',s:'Auto update.',x:'Stale stats.',c:`SELECT * FROM sys.dm_db_stats_properties(OBJECT_ID('dbo.Orders'), 1);`},
 {ids:['pl','ex'],t:'2. The optimiser chooses a plan, and execution shows the truth.',w:'Check the gap.',s:'Plan.',x:'Spills and lookups.',c:`SET STATISTICS IO ON;`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Three small maps of how something happens, step by step: a tuning loop, parameter sniffing and a blocking storm.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Tuning a slow workload'},
{map:{title:'Tuning loop map',h:216,trace:'Measure, find, fix, verify',
 hint:'Tap any box, or press Measure, find, fix, verify to follow a tuning cycle.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'bas',x:126,y:24,w:200,h:56,c:'mem',t:'Baseline',s:'normal numbers',d:'Record waits, I/O latency and key queries when things are normal.',why:'Compare to it.',chk:`SELECT * FROM sys.dm_os_wait_stats;`,see:[0,1,'Baselines and benchmarks']},
 {id:'wt',x:354,y:24,w:200,h:56,c:'mem',t:'Top waits',s:'where the time goes',d:'Find the dominant wait types.',why:'Ignore benign waits.',chk:`SELECT TOP 10 * FROM sys.dm_os_wait_stats ORDER BY wait_time_ms DESC;`,see:[1,1,'sys.dm_os_wait_stats']},
 {id:'top',x:21,y:136,w:194,h:56,c:'mem',t:'Top queries',s:'Query Store',d:'Find the queries that cause the waits.',why:'Sort by total cost.',chk:`SELECT TOP 10 * FROM sys.query_store_runtime_stats ORDER BY avg_cpu_time DESC;`,see:[2,1,'Finding top resource consumers']},
 {id:'fix',x:243,y:136,w:194,h:56,c:'proc',t:'One change',s:'index or rewrite',d:'Apply one change.',why:'Test in non-production.',chk:`CREATE INDEX ...;`,see:[5,0,'Index design principles']},
 {id:'ver',x:465,y:136,w:194,h:56,c:'mem',t:'Verify',s:'measure again',d:'Compare with the baseline.',why:'Roll back if worse.',chk:`SELECT * FROM sys.query_store_runtime_stats;`,see:[0,0,'A tuning method']}],
 steps:[
 {ids:['bas','wt'],t:'1. Compare current waits with the baseline.',w:'Find what changed.',s:'Baseline.',x:'No baseline.',c:`SELECT TOP 10 * FROM sys.dm_os_wait_stats ORDER BY wait_time_ms DESC;`},
 {ids:['top','fix'],t:'2. Find the top queries and make one change.',w:'Single variable.',s:'Change.',x:'Many changes at once.',c:`SELECT TOP 10 * FROM sys.query_store_runtime_stats;`},
 {ids:['ver'],t:'3. Measure and keep or revert.',w:'Evidence.',s:'Metrics.',x:'Seeing no improvement.',c:`SELECT * FROM sys.query_store_runtime_stats;`}]}},

{h:'2. Fixing parameter sniffing'},
{map:{title:'Sniffing map',h:216,trace:'Sometimes fast, sometimes slow',
 hint:'Tap any box, or press Sometimes fast, sometimes slow to follow the diagnosis.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'sym',x:126,y:24,w:200,h:56,c:'warn',t:'Symptom',s:'variable duration',d:'The same procedure is fast for some parameters and slow for others.',why:'Look for several plans.',chk:`SELECT query_id, COUNT(DISTINCT plan_id) FROM sys.query_store_plan GROUP BY query_id HAVING COUNT(DISTINCT plan_id) > 1;`,see:[4,3,'Parameter sniffing and fixes']},
 {id:'two',x:354,y:24,w:200,h:56,c:'mem',t:'Compare plans',s:'good vs bad',d:'Compare the plans and the parameter values compiled.',why:'Look at the plan XML.',chk:`SELECT * FROM sys.query_store_plan WHERE query_id = 42;`,see:[3,0,'Estimated vs actual plans']},
 {id:'opt',x:126,y:136,w:200,h:56,c:'proc',t:'Choose a fix',s:'options',d:'RECOMPILE, OPTIMIZE FOR, OPTION hints, better indexes or Query Store hints.',why:'Pick the least invasive.',chk:`OPTION (RECOMPILE)`,see:[4,3,'Parameter sniffing and fixes']},
 {id:'fix',x:354,y:136,w:200,h:56,c:'mem',t:'Verify',s:'both cases',d:'Test with both small and large parameter values.',why:'Check for regressions.',chk:`EXEC dbo.GetOrders @CustomerId = 1;`,see:[4,3,'Parameter sniffing and fixes']}],
 steps:[
 {ids:['sym','two'],t:'1. Confirm several plans for the same query and compare them.',w:'Evidence of sniffing.',s:'Query Store.',x:'Blaming the server.',c:`SELECT * FROM sys.query_store_plan WHERE query_id = 42;`},
 {ids:['opt','fix'],t:'2. Apply the least invasive fix and test both cases.',w:'Stable performance.',s:'Hints.',x:'Fixing one case only.',c:`EXEC dbo.GetOrders @CustomerId = 1;`}]}},

{h:'3. Resolving a blocking storm'},
{map:{title:'Blocking map',h:216,trace:'Find and clear the head blocker',
 hint:'Tap any box, or press Find and clear the head blocker to follow a blocking investigation.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'wts',x:126,y:24,w:200,h:56,c:'warn',t:'LCK_M waits',s:'many sessions waiting',d:'A growing list of sessions waiting on locks.',why:'Check the count.',chk:`SELECT COUNT(*) FROM sys.dm_exec_requests WHERE wait_type LIKE 'LCK_M%';`,see:[8,0,'Finding the head blocker']},
 {id:'head',x:354,y:24,w:200,h:56,c:'mem',t:'Head blocker',s:'root of the chain',d:'The session that is not itself blocked.',why:'Follow blocking_session_id.',chk:`SELECT session_id FROM sys.dm_exec_requests WHERE blocking_session_id = 0 AND session_id IN (SELECT blocking_session_id FROM sys.dm_exec_requests);`,see:[8,0,'Finding the head blocker']},
 {id:'sql',x:126,y:136,w:200,h:56,c:'mem',t:'What it runs',s:'statement and transaction',d:'Get its statement, host, and open transaction age.',why:'Long transactions are the cause.',chk:`SELECT * FROM sys.dm_exec_sessions s JOIN sys.dm_tran_session_transactions t ON s.session_id = t.session_id;`,see:[8,4,'Long-running transactions']},
 {id:'dec',x:354,y:136,w:200,h:56,c:'proc',t:'Decide',s:'wait, tune or kill',d:'End the transaction with the owner, tune, or kill as a last resort.',why:'Expect rollback time.',chk:`KILL 87;`,see:[8,2,'Reducing blocking with indexes and isolation']}],
 steps:[
 {ids:['wts','head'],t:'1. Confirm blocking and find the head of the chain.',w:'One root cause.',s:'DMVs.',x:'Killing a victim.',c:`SELECT * FROM sys.dm_exec_requests WHERE blocking_session_id <> 0;`},
 {ids:['sql','dec'],t:'2. Look at what it does and decide.',w:'Fix the cause afterwards.',s:'Isolation.',x:'Rollback takes long.',c:`SELECT * FROM sys.dm_exec_sql_text(...);`}]}},

]},

{t:'Wait type lookup',d:'The wait types met most often, what they mean and where to look.',see:[[1,4,'Common wait types: PAGEIOLATCH, CXPACKET, LCK_M, WRITELOG'],[1,1,'sys.dm_os_wait_stats']],b:[
{t:[['Wait type','Meaning','Look at'],['`PAGEIOLATCH_SH/EX`','Reading data pages from disk','Storage latency, missing indexes, memory'],['`WRITELOG`','Waiting for log flush','Log disk latency, small commits'],['`LCK_M_*`','Waiting for a lock','Blocking chain, isolation, indexes'],['`CXPACKET`, `CXCONSUMER`','Parallel exchange','MAXDOP, skew, statistics'],['`SOS_SCHEDULER_YIELD`','CPU pressure','Top CPU queries'],['`RESOURCE_SEMAPHORE`','Waiting for a memory grant','Large sorts and hashes, estimates'],['`PAGELATCH_*`','In-memory page contention','tempdb allocation, hot pages'],['`ASYNC_NETWORK_IO`','Client not consuming results','Application, row-by-row fetch'],['`HADR_SYNC_COMMIT`','Synchronous AG commit','Network and secondary log disk'],['`THREADPOOL`','Out of worker threads','Blocking, too many requests']]}
]},
{t:'Performance DMVs and tools',d:'Where to find each kind of evidence.',see:[[1,2,'Active requests with dm_exec_requests'],[9,1,'The system_health session']],b:[
{t:[['Evidence','Source'],['Current requests and blocking','`sys.dm_exec_requests`, `sys.dm_os_waiting_tasks`'],['Wait totals since start','`sys.dm_os_wait_stats`'],['Query cost history','Query Store (`sys.query_store_*`)'],['Cached plan cost','`sys.dm_exec_query_stats`'],['File latency','`sys.dm_io_virtual_file_stats`'],['Memory use','`sys.dm_os_memory_clerks`, `sys.dm_exec_query_memory_grants`'],['Index use','`sys.dm_db_index_usage_stats`, `sys.dm_db_missing_index_details`'],['Deadlocks and errors','`system_health` Extended Events session'],['Plans','SSMS actual execution plan, `SET STATISTICS IO, TIME ON`']]}
]},
]};
