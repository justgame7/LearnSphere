/* LearnSphere - SQL Server Performance & Tuning, Section 11: Performance Drills.
   Lectures 0-4 are core, 5 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const drill=M.dg(700,150,[
[10,25,120,70,'1. Reproduce|in a lab',0],[150,25,120,70,'2. Measure|waits, plan,|Query Store',2],[290,25,120,70,'3. Find|the bottleneck',2],[430,25,120,70,'4. Fix|one change',0],[570,25,120,70,'5. Prove|same metric',0]],
[[130,60,150,60],[270,60,290,60],[410,60,430,60],[550,60,570,60]]);

const upg=M.dg(700,150,[
[10,25,170,70,'Upgrade done|compat raised|from 140 to 160',0],[210,25,170,70,'Query Store shows|regressed query,|new plan',2],[410,25,130,70,'Force old plan|as a bridge',0],[570,25,120,70,'Fix cause,|unforce',2]],
[[180,60,210,60],[380,60,410,60],[540,60,570,60]]);

const blk=M.dg(700,150,[
[10,25,170,70,'One session|open transaction,|idle',2],[210,25,170,70,'Many sessions|LCK_M_S, LCK_M_X|THREADPOOL later',0],[410,25,130,70,'Find head|blocker',0],[570,25,120,70,'Fix the code|or kill with|approval',2]],
[[180,60,210,60],[380,60,410,60],[540,60,570,60]]);

const tmp=M.dg(700,150,[
[10,25,170,70,'tempdb file grows|disk nearly full',2],[210,25,170,70,'Who uses it?|dm_db_session_space_|usage',0],[410,25,130,70,'Query with|huge sort or|spill',0],[570,25,120,70,'Fix plan,|add index,|size tempdb',2]],
[[180,60,210,60],[380,60,410,60],[540,60,570,60]]);

const cap=M.dg(700,170,[
[10,20,150,70,'Workload|captured in|Query Store',0],[190,20,150,70,'Top by CPU, reads,|duration',2],[370,20,150,70,'Plan, stats,|index fixes',0],[550,20,140,70,'Before and after|report',2],
[10,110,680,45,'Deliver numbers, not impressions: baseline, change list, result, rollback',0]],
[[160,55,190,55],[340,55,370,55],[520,55,550,55]]);

/* ---------- 0: Slow after upgrade ---------- */
L['mss-perf:10:0']={blocks:[
{p:'**Drills** are rehearsed incidents. You reproduce the problem in a lab and fix it with the method from Section 1. Use a disposable database.'},
{svg:drill},
{h:'Drill 1: a query is slow after a compatibility level upgrade'},
{svg:upg},
{h:'Set up'},
{code:`-- Lab database at the old level, Query Store on
ALTER DATABASE PerfLab SET COMPATIBILITY_LEVEL = 140;
ALTER DATABASE PerfLab SET QUERY_STORE = ON (OPERATION_MODE = READ_WRITE, QUERY_CAPTURE_MODE = ALL);
-- Run a workload several times so Query Store has a baseline
ALTER DATABASE PerfLab SET COMPATIBILITY_LEVEL = 160;
-- Run the workload again`},
{h:'Steps'},
{flow:['Open Query Store, Regressed Queries, for the last hour','Pick the query with the largest change in duration','Compare the two plans: what operator or join changed','Force the old plan with sp_query_store_force_plan to restore speed','Find the cause: statistics, estimates, a feature such as batch mode','Fix and unforce, or keep the force with a documented reason']},
{h:'You are done when'},
{ul:['Duration is back to the baseline.','You can explain **why** the plan changed.','A note exists in the change log.']}],
src:[['Keep performance stability during upgrade',M.RD+'performance/query-store-usage-scenarios'],['Query Store reports',M.RD+'performance/monitoring-performance-by-using-the-query-store']]};

/* ---------- 1: Blocking storm ---------- */
L['mss-perf:10:1']={blocks:[
{p:'**Drill 2: a blocking storm.** Everything hangs, CPU is low, and connections pile up.'},
{svg:blk},
{h:'Create the problem'},
{code:`-- Session 1: leave this open
BEGIN TRAN;
UPDATE sales.Orders SET TotalDue = TotalDue WHERE OrderID = 1;
-- do not commit

-- Sessions 2..n: each runs
SELECT * FROM sales.Orders WHERE OrderID = 1;   -- blocked if not using RCSI`},
{h:'Diagnose'},
{code:`SELECT session_id, blocking_session_id, wait_type, wait_time, wait_resource
FROM   sys.dm_exec_requests WHERE blocking_session_id <> 0;

SELECT session_id, status, open_transaction_count, last_request_start_time
FROM   sys.dm_exec_sessions WHERE session_id = 55;   -- the head blocker`},
{h:'Fix and prevent'},
{ul:['Commit or roll back the head blocker (after finding its owner).','Turn on **READ_COMMITTED_SNAPSHOT** so readers stop waiting.','Add an **alert** on transactions open for more than 5 minutes.','Review the application: where is a transaction held across a user wait?']}],
src:[['Understand and resolve blocking problems','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/performance/understand-resolve-blocking'],['sys.dm_exec_requests',M.RD+'system-dynamic-management-views/sys-dm-exec-requests-transact-sql']]};

/* ---------- 2: tempdb runaway ---------- */
L['mss-perf:10:2']={blocks:[
{p:'**Drill 3: tempdb is growing and the disk is nearly full.** Find who uses it and why.'},
{svg:tmp},
{h:'Create the problem'},
{code:`-- A sort that cannot fit in its grant, on a big cross join (lab only)
SELECT TOP (50000000) a.object_id, b.object_id
FROM   sys.all_objects a CROSS JOIN sys.all_objects b CROSS JOIN sys.all_objects c
ORDER  BY a.name, b.name;`},
{h:'Diagnose'},
{code:`-- Sessions using tempdb space
SELECT s.session_id, s.login_name, s.program_name,
       (u.user_objects_alloc_page_count - u.user_objects_dealloc_page_count)*8/1024 AS user_mb,
       (u.internal_objects_alloc_page_count - u.internal_objects_dealloc_page_count)*8/1024 AS internal_mb
FROM   sys.dm_db_session_space_usage u
JOIN   sys.dm_exec_sessions s ON s.session_id = u.session_id
ORDER  BY internal_mb + user_mb DESC;

-- Version store use
SELECT SUM(version_store_reserved_page_count)*8/1024 AS version_store_mb
FROM   sys.dm_db_file_space_usage;`},
{h:'Causes and fixes'},
{t:[['Cause','Fix'],
['Big sort or hash spills','Fix estimates, add an index, reduce columns'],
['Large temp tables never dropped','Drop or clean up, review code'],
['Version store grows','Find and end the long transaction'],
['Too small, grows in tiny steps','Pre-size, equal files, fixed growth']]}],
src:[['Troubleshoot insufficient space in tempdb',M.SQL+'relational-databases/databases/tempdb-database'],['sys.dm_db_session_space_usage',M.RD+'system-dynamic-management-views/sys-dm-db-session-space-usage-transact-sql']]};

/* ---------- 3: Parameter sniffing ---------- */
L['mss-perf:10:3']={blocks:[
{p:'**Drill 4: parameter sniffing.** A procedure is fast for most callers and very slow for one.'},
{h:'Create skewed data (lab)'},
{code:`CREATE TABLE dbo.Sales (SaleID int IDENTITY PRIMARY KEY, CustomerID int, Amount money, Pad char(200) DEFAULT 'x');
-- customer 1 has 1,000,000 rows, others have a few
INSERT dbo.Sales (CustomerID, Amount)
SELECT 1, 10 FROM (SELECT TOP (1000000) 1 AS n FROM sys.all_objects a, sys.all_objects b) x;
INSERT dbo.Sales (CustomerID, Amount) SELECT TOP (50000) 2 + ABS(CHECKSUM(NEWID())) % 5000, 10 FROM sys.all_objects a, sys.all_objects b;
CREATE INDEX IX_Sales_Customer ON dbo.Sales (CustomerID);

CREATE OR ALTER PROCEDURE dbo.GetSales @CustomerID int AS
SELECT SaleID, Amount FROM dbo.Sales WHERE CustomerID = @CustomerID;`},
{h:'Reproduce'},
{flow:['Run the procedure for a small customer first (plan: seek and lookup)','Run it for customer 1 (same plan: a million lookups, slow)','Free the plan with sp_recompile and run the large customer first','Run the small customer (scan plan: wasteful)']},
{h:'Fix and compare'},
{t:[['Option','Result'],
['`OPTION (RECOMPILE)`','Correct plan for each call, small compile cost'],
['Covering index `INCLUDE (Amount)`','Both plans cheap'],
['`OPTIMIZE FOR UNKNOWN`','Average plan, predictable but not best'],
['Compat level 160 PSP optimization','Two plans kept by value range']]},
{note:'Record logical reads and duration for each option, in a small table. That is the evidence you would give a developer.'}],
src:[['Parameter sensitive plan optimization',M.RD+'performance/parameter-sensitive-plan-optimization'],['sp_recompile',M.RD+'system-stored-procedures/sp-recompile-transact-sql']]};

/* ---------- 4: Capstone ---------- */
L['mss-perf:10:4']={blocks:[
{p:'**Capstone: tune a workload end to end.** You are handed a database with a mixed workload and a complaint. Produce a short, evidence-based report and a safe set of changes.'},
{svg:cap},
{h:'Brief'},
{ul:['A lab database with a few million rows and a script that runs 20 typical queries in a loop.','The complaint: "reports are slow in the morning and the application times out at midday".','You may change indexes, statistics, configuration and the query text for **up to five** queries.']},
{h:'Tasks'},
{t:[['#','Task','Evidence'],
['1','Capture a **baseline**: waits, top queries, file latency','Saved table or screenshots'],
['2','Name the **top three** bottlenecks','Query Store and wait list'],
['3','Fix each with **one change at a time**','Before/after reads and duration'],
['4','Check **no regressions** elsewhere','Overall consumption report'],
['5','Write the **change log and rollback**','Script file'],
['6','Present **results** in a one-page summary','Table: query, before, after, change']]},
{h:'Acceptance'},
{ul:['Each change has a **measurement** showing benefit.','Indexes added are justified by **reads saved vs writes added**.','Rollback script **tested**.','A second person can **repeat** the test and see the same numbers.']},
{note:'You have now covered methodology, waits, Query Store, plans, statistics, indexing, IQP, resources, blocking and monitoring. Next steps: Security and Compliance, and High Availability.'}],
src:[['Monitor and tune for performance',M.RD+'performance/monitor-and-tune-for-performance'],['Query Store usage scenarios',M.RD+'performance/query-store-usage-scenarios']]};

})();
