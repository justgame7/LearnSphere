/* LearnSphere - SQL Server Performance & Tuning, Section 02: Wait Statistics & DMVs.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const kinds=M.dg(700,170,[
[10,20,200,70,'Resource waits|locks, latches, I/O,|memory',2],[250,20,200,70,'Queue waits|idle background threads|usually benign',0],[490,20,200,70,'External waits|OLE DB, CLR,|linked servers',0],
[10,110,680,45,'Filter the benign waits before you read the list',0]],
[]);

const delta=M.dg(700,150,[
[10,30,200,70,'Sample 1|copy wait stats|into a table',0],[250,30,200,70,'Wait 5 to 60 seconds|during the problem',2],[490,30,200,70,'Sample 2, subtract|top deltas show the|current problem',0]],
[[210,65,250,65],[450,65,490,65]]);

const req=M.dg(700,170,[
[10,20,150,70,'dm_exec_sessions|who, from where',0],[190,20,160,70,'dm_exec_requests|what now, waits,|blockers',2],[380,20,150,70,'dm_exec_sql_text|the statement',0],[560,20,130,70,'dm_exec_query_plan|the plan',0],
[10,115,680,40,'Join them with the sql_handle and plan_handle columns',0]],
[[160,55,190,55],[350,55,380,55],[530,55,560,55]]);

const qs=M.dg(700,150,[
[10,25,200,70,'Plan cache|compiled plans with|running totals',0],[250,25,200,70,'dm_exec_query_stats|CPU, reads, duration,|executions',2],[490,25,200,70,'Resets when the plan|leaves the cache|or at restart',0]],
[[210,60,250,60],[450,60,490,60]]);

/* ---------- 0: How waits work ---------- */
L['mss-perf:1:0']={blocks:[
{p:'Section 2 of Core DBA showed that a request moves between **RUNNING**, **SUSPENDED** and **RUNNABLE**. Every time it is suspended, SQL Server records **why** and **how long**. That record is the wait statistics.'},
{svg:kinds},
{h:'What is recorded'},
{t:[['Field','Meaning'],
['`wait_type`','The reason'],
['`waiting_tasks_count`','How many times a task waited'],
['`wait_time_ms`','Total time, including signal wait'],
['`signal_wait_time_ms`','Time spent waiting for a CPU after the resource was ready'],
['`max_wait_time_ms`','Longest single wait']]},
{h:'Three important ideas'},
{ul:['Waits are **cumulative** since the last restart or since you cleared them.','A big number can be **normal**: background threads wait all the time on purpose.','Waits are about **time**, not count: look at total and average.']},
{code:`-- Reset the counters (for a controlled test)
DBCC SQLPERF ('sys.dm_os_wait_stats', CLEAR);`},
{note:'Clearing waits loses history that is useful for comparison. Capture a snapshot to a table first, or use deltas instead of clearing.'}],
src:[['sys.dm_os_wait_stats',M.RD+'system-dynamic-management-views/sys-dm-os-wait-stats-transact-sql'],['SQL Server wait types library','https://www.sqlskills.com/help/waits/']]};

/* ---------- 1: dm_os_wait_stats ---------- */
L['mss-perf:1:1']={blocks:[
{p:'Raw `sys.dm_os_wait_stats` is dominated by **benign** waits. Filter them out, then read the top few. This is the single most useful query in tuning.'},
{code:`WITH w AS (
  SELECT wait_type, wait_time_ms, signal_wait_time_ms, waiting_tasks_count,
         100.0 * wait_time_ms / SUM(wait_time_ms) OVER () AS pct
  FROM   sys.dm_os_wait_stats
  WHERE  wait_type NOT IN (
    'SLEEP_TASK','LAZYWRITER_SLEEP','XE_TIMER_EVENT','XE_DISPATCHER_WAIT','BROKER_TASK_STOP',
    'BROKER_TO_FLUSH','BROKER_EVENTHANDLER','SQLTRACE_BUFFER_FLUSH','CHECKPOINT_QUEUE',
    'REQUEST_FOR_DEADLOCK_SEARCH','DIRTY_PAGE_POLL','HADR_FILESTREAM_IOMGR_IOCOMPLETION',
    'LOGMGR_QUEUE','ONDEMAND_TASK_QUEUE','FT_IFTS_SCHEDULER_IDLE_WAIT','CLR_AUTO_EVENT',
    'SP_SERVER_DIAGNOSTICS_SLEEP','WAITFOR','SLEEP_SYSTEMTASK','QDS_PERSIST_TASK_MAIN_LOOP_SLEEP')
    AND wait_time_ms > 0)
SELECT TOP (10) wait_type,
       CAST(wait_time_ms/1000.0 AS decimal(18,1)) AS wait_s,
       CAST(pct AS decimal(5,1)) AS pct,
       CAST(wait_time_ms*1.0/NULLIF(waiting_tasks_count,0) AS decimal(18,2)) AS avg_ms,
       CAST(signal_wait_time_ms*100.0/NULLIF(wait_time_ms,0) AS decimal(5,1)) AS signal_pct
FROM   w
ORDER  BY wait_time_ms DESC;`},
{svg:delta},
{h:'Use a delta for a live problem'},
{p:'Since-restart totals hide a problem that started an hour ago. Take two samples a few minutes apart and subtract.'},
{code:`SELECT wait_type, wait_time_ms, waiting_tasks_count INTO #w1 FROM sys.dm_os_wait_stats;
WAITFOR DELAY '00:00:30';
SELECT b.wait_type, b.wait_time_ms - a.wait_time_ms AS delta_ms
FROM   sys.dm_os_wait_stats b JOIN #w1 a ON a.wait_type = b.wait_type
WHERE  b.wait_time_ms - a.wait_time_ms > 0
ORDER  BY delta_ms DESC;`},
{note:'The filter list above is shortened. Use a maintained list from a trusted community script for a full filter.'}],
src:[['sys.dm_os_wait_stats',M.RD+'system-dynamic-management-views/sys-dm-os-wait-stats-transact-sql'],['SQL Server wait types library','https://www.sqlskills.com/help/waits/']]};

/* ---------- 2: dm_exec_requests ---------- */
L['mss-perf:1:2']={blocks:[
{p:'`sys.dm_exec_requests` shows **what is running right now**. It is the live view you use during an incident.'},
{svg:req},
{code:`SELECT r.session_id, r.status, r.command, r.wait_type, r.wait_time,
       r.blocking_session_id, r.cpu_time, r.logical_reads, r.total_elapsed_time,
       r.granted_query_memory*8/1024 AS grant_mb,
       DB_NAME(r.database_id) AS db,
       SUBSTRING(t.text, (r.statement_start_offset/2)+1,
         ((CASE r.statement_end_offset WHEN -1 THEN DATALENGTH(t.text)
           ELSE r.statement_end_offset END - r.statement_start_offset)/2)+1) AS running_statement,
       s.login_name, s.host_name, s.program_name
FROM   sys.dm_exec_requests r
JOIN   sys.dm_exec_sessions s ON s.session_id = r.session_id
CROSS  APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE  r.session_id <> @@SPID AND s.is_user_process = 1
ORDER  BY r.total_elapsed_time DESC;`},
{h:'What to look at'},
{t:[['Column','Reading it'],
['`wait_type`, `wait_time`','What it is waiting for, right now'],
['`blocking_session_id`','Non-zero: someone else blocks it'],
['`cpu_time`, `logical_reads`','Cost so far'],
['`granted_query_memory`','Workspace memory held'],
['`percent_complete`','For backups, restores, rebuilds'],
['`statement_start_offset`','Cuts the current statement from the batch']]},
{note:'Community procedures such as sp_WhoIsActive present the same data in a ready-made form. Learn the DMVs first so you understand what they show.'}],
src:[['sys.dm_exec_requests',M.RD+'system-dynamic-management-views/sys-dm-exec-requests-transact-sql'],['sys.dm_exec_sql_text',M.RD+'system-dynamic-management-views/sys-dm-exec-sql-text-transact-sql']]};

/* ---------- 3: dm_exec_query_stats ---------- */
L['mss-perf:1:3']={blocks:[
{p:'`sys.dm_exec_query_stats` keeps **running totals per cached plan**. It answers: which queries cost the most **overall**?'},
{svg:qs},
{code:`-- Top 10 by total CPU
SELECT TOP (10)
       qs.total_worker_time/1000 AS total_cpu_ms,
       qs.execution_count,
       qs.total_worker_time/qs.execution_count/1000 AS avg_cpu_ms,
       qs.total_logical_reads/qs.execution_count AS avg_reads,
       qs.total_elapsed_time/qs.execution_count/1000 AS avg_ms,
       DB_NAME(st.dbid) AS db,
       SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
         ((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text)
           ELSE qs.statement_end_offset END - qs.statement_start_offset)/2)+1) AS statement_text
FROM   sys.dm_exec_query_stats qs
CROSS  APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER  BY qs.total_worker_time DESC;`},
{h:'How to use it'},
{ul:['Sort by **total CPU**, **total reads** and **total duration** in turn. Each shows a different kind of cost.','A cheap query run a million times can cost more than one slow report.','Group by **query_hash** to combine statements that differ only in literals.']},
{h:'Limits'},
{ul:['Data exists only while the **plan stays in cache**. A restart, memory pressure or a recompile removes it.','No history: use **Query Store** (next section) for trends and regressions.']}],
src:[['sys.dm_exec_query_stats',M.RD+'system-dynamic-management-views/sys-dm-exec-query-stats-transact-sql'],['Query Store overview',M.RD+'performance/monitoring-performance-by-using-the-query-store']]};

/* ---------- 4: Common waits ---------- */
L['mss-perf:1:4']={blocks:[
{p:'A handful of wait types appear in most investigations. Learn what each means and what to check **first**.'},
{t:[['Wait type','Meaning','First check'],
['**PAGEIOLATCH_SH / EX**','Reading a data page from disk','Missing indexes, scans, storage latency, memory'],
['**WRITELOG**','Waiting for log flush at commit','Log disk latency, many tiny commits'],
['**LCK_M_***','Waiting for a lock','Blocking chain, long transactions'],
['**SOS_SCHEDULER_YIELD**','Running out of CPU quantum','CPU pressure, expensive queries'],
['**CXPACKET / CXCONSUMER**','Parallel threads waiting on each other','MAXDOP, cost threshold, skewed data'],
['**ASYNC_NETWORK_IO**','Client slow to consume results','Application, large result sets'],
['**RESOURCE_SEMAPHORE**','Waiting for a memory grant','Big sorts or hashes, bad estimates'],
['**PAGELATCH_UP / EX**','Contention on in-memory pages','tempdb allocation, hot insert page'],
['**THREADPOOL**','No worker threads available','Blocking storms, connection spikes'],
['**HADR_SYNC_COMMIT**','Waiting for a synchronous replica','Network latency to secondary']]},
{note:'CXCONSUMER was split from CXPACKET in newer versions. CXPACKET alone is often normal on a parallel server, so check how long and how often.'}],
src:[['sys.dm_os_wait_stats: wait type descriptions',M.RD+'system-dynamic-management-views/sys-dm-os-wait-stats-transact-sql'],['SQL Server wait types library','https://www.sqlskills.com/help/waits/']]};

})();
