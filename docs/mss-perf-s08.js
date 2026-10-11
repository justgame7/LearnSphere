/* LearnSphere - SQL Server Performance & Tuning, Section 08: Memory, CPU & I/O.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const mem=M.dg(700,200,[
[10,15,680,170,'Signs of memory pressure',1],
[30,50,200,50,'Page life expectancy|drops and stays low',0],[250,50,200,50,'PAGEIOLATCH waits|rise, more disk reads',2],[470,50,200,50,'RESOURCE_SEMAPHORE|queries wait for grants',2],
[30,120,640,50,'Check memory clerks to see what is using memory, and max server memory against physical RAM',0]],
[]);

const grant=M.dg(700,160,[
[10,25,200,70,'Request|optimizer estimates|memory for sort or hash',0],[250,25,200,70,'Grant|reserved before the|query starts',2],[490,25,200,70,'Wait|if not enough free|RESOURCE_SEMAPHORE',2],
[10,115,680,35,'Too little: spill to tempdb. Too much: other queries wait.',0]],
[[210,60,250,60],[450,60,490,60]]);

const cpu=M.dg(700,170,[
[10,20,200,70,'Signal wait high|SOS_SCHEDULER_YIELD|runnable tasks queue',2],[250,20,200,70,'Find top CPU queries|dm_exec_query_stats|Query Store',0],[490,20,200,70,'Fix the query first|then MAXDOP and|cost threshold',0],
[10,110,680,45,'Adding CPU cores hides a bad query for a while and raises licensing cost',0]],
[[210,55,250,55],[450,55,490,55]]);

const io=M.dg(700,150,[
[10,25,200,70,'Per-file latency|dm_io_virtual_file_stats|read and write ms',2],[250,25,200,70,'Compare to targets|log under 5 ms|data under 10 to 20 ms',0],[490,25,200,70,'Reduce reads|indexes, memory|then storage',0]],
[[210,60,250,60],[450,60,490,60]]);

const tdb=M.dg(700,170,[
[10,20,200,70,'PAGELATCH_UP|on 2:1:1 or 2:1:3|allocation pages',2],[250,20,200,70,'Many sessions create|temp objects at the|same time',0],[490,20,200,70,'Add equal-size files|consider memory-optimized|tempdb metadata',0],
[10,110,680,45,'Database id 2 is tempdb. Page 1, 2 and 3 are the PFS, GAM and SGAM pages.',0]],
[[210,55,250,55],[450,55,490,55]]);

/* ---------- 0: Memory pressure ---------- */
L['mss-perf:7:0']={blocks:[
{p:'Memory is the most useful resource for SQL Server. With enough memory, hot data stays cached and disk reads drop. **Memory pressure** shows as more I/O and slower queries.'},
{svg:mem},
{code:`-- Who uses the memory
SELECT TOP (10) type, name, SUM(pages_kb)/1024 AS mb
FROM   sys.dm_os_memory_clerks
GROUP  BY type, name
ORDER  BY SUM(pages_kb) DESC;

-- Process memory and limits
SELECT physical_memory_in_use_kb/1024 AS used_mb, memory_utilization_percentage,
       process_physical_memory_low, process_virtual_memory_low
FROM   sys.dm_os_process_memory;

SELECT total_physical_memory_kb/1024 AS total_mb, available_physical_memory_kb/1024 AS free_mb,
       system_memory_state_desc
FROM   sys.dm_os_sys_memory;`},
{h:'How to read it'},
{t:[['Observation','Meaning'],
['**Buffer pool dominates clerks**','Normal: it is the cache'],
['**OBJECTSTORE_LOCK_MANAGER or plan cache large**','Check for lock escalation, ad hoc bloat'],
['**system_memory_state_desc = low**','The OS is short: lower max server memory or add RAM'],
['**Page life expectancy low** and falling','Pages leave the cache quickly: scans or too little memory']]},
{note:'Page life expectancy has no single magic value. Compare with your baseline and watch the trend during the problem.'}],
src:[['Memory management architecture guide',M.RD+'memory-management-architecture-guide'],['sys.dm_os_memory_clerks',M.RD+'system-dynamic-management-views/sys-dm-os-memory-clerks-transact-sql']]};

/* ---------- 1: Memory grants ---------- */
L['mss-perf:7:1']={blocks:[
{p:'Sorts, hash joins and similar operators need **workspace memory**. SQL Server reserves it as a **memory grant** before the query starts. If memory is not available, the query waits.'},
{svg:grant},
{code:`SELECT session_id, requested_memory_kb/1024 AS requested_mb,
       granted_memory_kb/1024 AS granted_mb, used_memory_kb/1024 AS used_mb,
       wait_time_ms, query_cost, dop
FROM   sys.dm_exec_query_memory_grants
ORDER  BY requested_memory_kb DESC;`},
{h:'Reading it'},
{ul:['`granted_memory_kb` is **NULL** or the row waits: the query is queued, wait type RESOURCE_SEMAPHORE.','**Granted much larger than used**: estimate too high, wasted memory.','**Spill** in the plan: grant too small for the data.']},
{h:'Fixes'},
{t:[['Cause','Fix'],
['Bad row estimates','Update statistics, review plan, fix parameter sniffing'],
['Big sort or hash','Add an index that returns data in order, reduce columns'],
['Too many large queries at once','Resource Governor limits, schedule heavy jobs'],
['Wasted grants','Memory grant feedback (compat 140/150)']]},
{note:'A single query can by default receive up to a quarter of the available workspace. Several such queries can starve everyone else.'}],
src:[['sys.dm_exec_query_memory_grants',M.RD+'system-dynamic-management-views/sys-dm-exec-query-memory-grants-transact-sql'],['Memory grant explanations','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/performance/troubleshoot-query-memory-grant-issues']]};

/* ---------- 2: CPU ---------- */
L['mss-perf:7:2']={blocks:[
{p:'**CPU pressure** shows up as high processor use, many runnable tasks and a large **signal wait** share. The fix is almost always in the **queries**.'},
{svg:cpu},
{code:`-- Runnable tasks per scheduler: a queue means CPU pressure
SELECT scheduler_id, current_tasks_count, runnable_tasks_count, work_queue_count
FROM   sys.dm_os_schedulers
WHERE  scheduler_id < 255;

-- Signal wait share since restart
SELECT CAST(100.0 * SUM(signal_wait_time_ms) / NULLIF(SUM(wait_time_ms),0) AS decimal(5,2)) AS signal_pct
FROM   sys.dm_os_wait_stats;`},
{h:'Checks'},
{ul:['**Signal wait over 20 to 25 percent** over time suggests a CPU queue.','Find queries with the highest **total CPU** (query stats, Query Store).','Look for **compilations**: high SQL Compilations/sec uses CPU. Parameterize.','Review **MAXDOP** and **cost threshold**: runaway parallelism takes many cores for one query.','Check the **power plan** on Windows: it should be High performance.']},
{note:'CXPACKET waits alone do not mean a problem. A parallel query that finishes quickly and uses many cores is working as designed.'}],
src:[['sys.dm_os_schedulers',M.RD+'system-dynamic-management-views/sys-dm-os-schedulers-transact-sql'],['Troubleshoot high CPU usage','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/performance/troubleshoot-high-cpu-usage-issues']]};

/* ---------- 3: Storage latency ---------- */
L['mss-perf:7:3']={blocks:[
{p:'Storage is slow compared with memory, so **latency per file** is a key number. SQL Server measures it for you.'},
{svg:io},
{code:`SELECT DB_NAME(vfs.database_id) AS db, mf.type_desc, mf.physical_name,
       vfs.num_of_reads, vfs.num_of_writes,
       vfs.io_stall_read_ms  / NULLIF(vfs.num_of_reads, 0)  AS avg_read_ms,
       vfs.io_stall_write_ms / NULLIF(vfs.num_of_writes, 0) AS avg_write_ms
FROM   sys.dm_io_virtual_file_stats(NULL, NULL) vfs
JOIN   sys.master_files mf ON mf.database_id = vfs.database_id AND mf.file_id = vfs.file_id
ORDER  BY avg_read_ms DESC;`},
{t:[['File','Rough target','Meaning if worse'],
['**Log write**','Under 5 ms','Commits wait: WRITELOG'],
['**Data read**','Under 10 to 20 ms','PAGEIOLATCH waits'],
['**tempdb**','Under 10 ms','Sorts, spills, version store']]},
{h:'What to do'},
{flow:['Compare with your baseline and with the waits (PAGEIOLATCH, WRITELOG)','Reduce reads first: indexes, better plans, more memory','Check whether the volume is shared with other workloads','Test the storage with a tool such as DiskSpd and compare with the provider numbers','Move hot files to faster storage']},
{note:'Averages since restart hide short peaks. Sample at intervals during the problem and compute the difference.'}],
src:[['sys.dm_io_virtual_file_stats',M.RD+'system-dynamic-management-views/sys-dm-io-virtual-file-stats-transact-sql'],['Troubleshoot slow SQL Server I/O','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/performance/troubleshoot-sql-io-performance']]};

/* ---------- 4: tempdb contention ---------- */
L['mss-perf:7:4']={blocks:[
{p:'**tempdb** is shared by every session. When many sessions create and drop temp objects at the same time, they queue on the **allocation pages** in memory. This is **PAGELATCH** contention, not disk I/O.'},
{svg:tdb},
{code:`-- Currently waiting on tempdb allocation pages
SELECT session_id, wait_type, wait_time, wait_resource
FROM   sys.dm_exec_requests
WHERE  wait_type LIKE 'PAGELATCH%' AND wait_resource LIKE '2:%';

-- Number and size of tempdb files
SELECT name, size*8/1024 AS size_mb, growth FROM tempdb.sys.database_files;`},
{h:'Fixes'},
{t:[['Fix','Notes'],
['**More equal-size data files**','Up to 8 first, then add in steps if contention persists'],
['**Memory-optimized tempdb metadata**','SQL Server 2019 and later, for metadata contention (restart needed)'],
['**Reduce temp object churn**','Reuse temp tables, avoid unnecessary spills'],
['**Fast storage**','For spills and the version store']]},
{note:'SQL Server 2016 removed the need for trace flags 1117 and 1118 for tempdb. Do not copy old advice that suggests them without checking the version.'}],
src:[['tempdb database',M.RD+'databases/tempdb-database'],['Recommendations to reduce allocation contention','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/performance/recommendations-reduce-allocation-contention']]};

})();
