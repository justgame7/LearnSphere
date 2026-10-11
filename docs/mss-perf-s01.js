/* LearnSphere - SQL Server Performance & Tuning, Section 01: Performance Methodology.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const loop=M.dg(700,170,[
[10,35,130,70,'1. Define|what is slow,|for whom, when',0],[170,35,130,70,'2. Measure|waits, DMVs,|Query Store',2],[330,35,130,70,'3. Find|biggest|bottleneck',2],
[490,35,100,70,'4. Fix|one change|at a time',0],[620,35,70,70,'5. Verify|same metric',0],
[10,125,680,32,'Repeat until the goal is met. Stop when the next gain is not worth the cost.',0]],
[[140,70,170,70],[300,70,330,70],[460,70,490,70],[590,70,620,70]]);

const base=M.dg(700,160,[
[10,25,200,70,'Capture normal|CPU, waits, I/O,|batch requests',0],[250,25,200,70,'Store with time|a table or a|monitoring tool',2],[490,25,200,70,'Compare|today vs normal|find the change',0],
[10,115,680,34,'Without a baseline, you only know a number, not whether it is bad',0]],
[[210,60,250,60],[450,60,490,60]]);

const wt=M.dg(700,170,[
[10,25,150,70,'RUNNING|using CPU',2],[210,25,170,70,'SUSPENDED|waiting for a resource|lock, I/O, memory',0],[430,25,150,70,'RUNNABLE|resource ready,|waiting for CPU',0],
[10,115,680,40,'Total time = running + waiting. Waits show where the time went.',0]],
[[160,60,210,60],[380,60,430,60],[580,90,100,90],[100,95,100,95]]);

const layer=M.dg(700,220,[
[10,10,680,200,'Layers where time can be lost',1],
[30,45,200,50,'Application|chatty calls, bad queries',2],[250,45,200,50,'Database design|indexes, statistics',2],[470,45,200,50,'Instance settings|memory, MAXDOP',0],
[30,115,200,50,'Operating system|power plan, drivers',0],[250,115,200,50,'Storage|latency, IOPS',0],[470,115,200,50,'Network|latency, bandwidth',0],
[30,175,640,26,'Most gains come from queries and indexes, so start there',0]],
[]);

/* ---------- 0: Method ---------- */
L['mss-perf:0:0']={blocks:[
{p:'Tuning by guesswork wastes time and can make things worse. A simple **repeatable method** finds the real problem and proves the fix.'},
{svg:loop},
{h:'Step 1: define the problem'},
{t:[['Question','Why'],
['**What is slow?** (a page, a report, everything)','Narrows the scope'],
['**Since when?** (always, after a change)','Points to the trigger'],
['**For whom?** (one user, all users)','Separates server from client issues'],
['**How slow, and what is acceptable?**','Defines the goal']]},
{h:'Rules'},
{ul:['**One change at a time**, so you know what worked.','**Measure before and after** with the same method.','Keep a **change log** and a way to roll back.','Fix the **biggest** cost first, not the easiest one.']},
{note:'If the database is not the bottleneck, no amount of tuning helps. Check how much time a request spends in the database compared with the application and network before you start.'}],
src:[['Monitor and tune for performance',M.RD+'performance/monitor-and-tune-for-performance'],['Performance center for SQL Server',M.RD+'performance/performance-center-for-sql-server-database-engine-and-azure-sql-database']]};

/* ---------- 1: Baselines ---------- */
L['mss-perf:0:1']={blocks:[
{p:'A **baseline** records what normal looks like. A **benchmark** is a repeatable test used to compare before and after a change.'},
{svg:base},
{h:'Counters worth collecting'},
{t:[['Counter','Meaning','Source'],
['**Batch Requests/sec**','Workload rate','`SQLServer:SQL Statistics`'],
['**SQL Compilations/sec**','Compile pressure','`SQLServer:SQL Statistics`'],
['**Page life expectancy**','How long a page stays in memory','`SQLServer:Buffer Manager`'],
['**Memory Grants Pending**','Queries waiting for workspace memory','`SQLServer:Memory Manager`'],
['**% Processor Time**','CPU use','Windows `Processor`'],
['**Avg. Disk sec/Read and Write**','Storage latency','Windows `PhysicalDisk`'],
['**User Connections**','Concurrency','`SQLServer:General Statistics`']]},
{code:`-- Counters from inside SQL Server
SELECT object_name, counter_name, instance_name, cntr_value
FROM   sys.dm_os_performance_counters
WHERE  counter_name IN ('Batch Requests/sec', 'Page life expectancy', 'Memory Grants Pending');`},
{h:'Benchmarks'},
{ul:['Use a **copy of production data** and a **replayable workload**.','Run it several times and compare **averages**, not one result.','Tools: Database Experimentation Assistant, RML Utilities, HammerDB, or your own scripts.']},
{note:'Counters such as Batch Requests/sec are cumulative. Take two samples and divide the difference by the elapsed seconds.'}],
src:[['sys.dm_os_performance_counters',M.RD+'system-dynamic-management-views/sys-dm-os-performance-counters-transact-sql'],['Use SQL Server objects',M.RD+'performance-monitor/use-sql-server-objects']]};

/* ---------- 2: Wait-based tuning ---------- */
L['mss-perf:0:2']={blocks:[
{p:'**Wait-based tuning** asks one question: what is SQL Server **waiting for** the most? The answer points to the resource that limits you.'},
{svg:wt},
{h:'From wait type to area'},
{t:[['Wait family','Area','Likely direction'],
['`PAGEIOLATCH_*`, `IO_COMPLETION`, `WRITELOG`','Storage / I/O','Slow reads or writes, missing indexes, memory'],
['`LCK_M_*`','Locking','Blocking, long transactions'],
['`SOS_SCHEDULER_YIELD`, `CXPACKET`','CPU / parallelism','CPU pressure, plan or MAXDOP'],
['`RESOURCE_SEMAPHORE`','Memory grants','Large sorts or hashes, estimates'],
['`ASYNC_NETWORK_IO`','Client','Application reads results slowly'],
['`PAGELATCH_*`','Allocation contention','tempdb files, hot pages']]},
{h:'Resource wait vs signal wait'},
{ul:['**Resource wait**: time waiting for the resource itself.','**Signal wait**: time after the resource was ready, waiting for a CPU.','A high share of **signal wait** suggests **CPU pressure**.']},
{note:'Wait statistics tell you where to look, not what to change. Use them to pick the area, then use plans, indexes and configuration to fix it.'}],
src:[['sys.dm_os_wait_stats',M.RD+'system-dynamic-management-views/sys-dm-os-wait-stats-transact-sql'],['Troubleshoot slow queries','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/performance/troubleshoot-slow-running-queries']]};

/* ---------- 3: Where problems come from ---------- */
L['mss-perf:0:3']={blocks:[
{p:'Before you open a DMV, know the **usual suspects**. This saves hours of looking at the wrong layer.'},
{svg:layer},
{h:'Symptoms and common causes'},
{t:[['Symptom','Common cause'],
['One query slow, others fine','Bad plan, missing index, outdated statistics, parameter sniffing'],
['Everything slow at once','CPU, memory pressure, storage latency, a blocker'],
['Slow after a release','Changed query, changed plan, compatibility level'],
['Slow only at some hours','Backups, jobs, batch loads, competing workloads'],
['Timeouts','Blocking, long-running queries, network'],
['Slow in the app only','Application, network, driver, `ASYNC_NETWORK_IO`']]},
{h:'The 80/20 rule'},
{p:'Most database performance work is about **queries and indexes**. Hardware and settings matter, but a bad query on fast hardware is still a bad query.'},
{ul:['**Fix queries first**: reduce reads, avoid scans, use the right indexes.','**Fix configuration second**: memory, MAXDOP, tempdb.','**Add hardware last**: and only after you know which resource limits you.']}],
src:[['Query processing architecture guide',M.RD+'query-processing-architecture-guide'],['Performance monitoring and tuning tools',M.RD+'performance/performance-monitoring-and-tuning-tools']]};

})();
