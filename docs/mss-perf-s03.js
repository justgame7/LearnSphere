/* LearnSphere - SQL Server Performance & Tuning, Section 03: Query Store.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const qsarch=M.dg(700,200,[
[10,15,680,170,'Query Store: a flight recorder inside each database',1],
[30,55,150,60,'Query text|and context',0],[200,55,150,60,'Plans|for each query',2],[370,55,150,60,'Runtime stats|per time interval',2],[540,55,130,60,'Wait stats|per query',0],
[30,130,640,45,'Stored in the user database, survives restart and failover, shows history and plan changes',0]],
[]);

const top=M.dg(700,150,[
[10,25,200,70,'Choose a metric|duration, CPU,|reads, memory, executions',0],[250,25,200,70,'Choose a time window|last hour, day, week',2],[490,25,200,70,'Open the query|see its plans and|runtime history',0]],
[[210,60,250,60],[450,60,490,60]]);

const reg=M.dg(700,170,[
[10,25,170,70,'Query was fast|plan A',0],[210,25,170,70,'Plan changed|statistics, upgrade,|parameter',0],[410,25,130,70,'Now slow|plan B',2],[570,25,120,70,'Force plan A|sp_query_store_|force_plan',2],
[10,115,680,40,'Forcing a plan is a quick fix. Find the cause so you can remove the force later.',0]],
[[180,60,210,60],[380,60,410,60],[540,60,570,60]]);

const rep=M.dg(700,200,[
[10,15,215,80,'Overall Resource|Consumption|trend of the database',0],[245,15,215,80,'Top Resource|Consuming Queries|who costs the most',2],[480,15,210,80,'Regressed Queries|got worse than before',2],
[10,110,215,80,'Queries With|Forced Plans|check they still work',0],[245,110,215,80,'Queries With High|Variation|unstable duration',0],[480,110,210,80,'Query Wait Statistics|waits per query',0]],
[]);

const cap=M.dg(700,160,[
[10,25,150,70,'ALL|every query',0],[190,25,150,70,'AUTO|skip trivial and|rare queries',2],[370,25,150,70,'CUSTOM|your own cut-offs|2019 and later',0],[550,25,140,70,'NONE|no new queries',0],
[10,115,680,35,'AUTO is the right default for most databases',0]],
[]);

/* ---------- 0: Enable ---------- */
L['mss-perf:2:0']={blocks:[
{p:'**Query Store** records queries, their **plans** and their **runtime statistics** over time, inside the database. It answers questions the plan cache cannot: what changed, and when?'},
{svg:qsarch},
{h:'Enable and configure'},
{code:`ALTER DATABASE SalesDB SET QUERY_STORE = ON
  (OPERATION_MODE = READ_WRITE,
   QUERY_CAPTURE_MODE = AUTO,
   MAX_STORAGE_SIZE_MB = 1024,
   INTERVAL_LENGTH_MINUTES = 60,
   CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30),
   SIZE_BASED_CLEANUP_MODE = AUTO,
   WAIT_STATS_CAPTURE_MODE = ON);

SELECT actual_state_desc, desired_state_desc, current_storage_size_mb,
       max_storage_size_mb, query_capture_mode_desc, readonly_reason
FROM   sys.database_query_store_options;`},
{h:'Key facts'},
{ul:['**SQL Server 2022**: Query Store is on by default for newly created databases. On 2019 and earlier you enable it yourself.','Data is stored in the **user database**, so it moves with backups and failovers.','The **interval length** sets the granularity of history. 60 minutes is a good start.','Wait statistics per query are available from **SQL Server 2017**.']},
{note:'Check actual_state_desc. If it says READ_ONLY, Query Store ran out of space or hit an error, and it is no longer recording.'}],
src:[['Monitor performance by using the Query Store',M.RD+'performance/monitoring-performance-by-using-the-query-store'],['Query Store best practices',M.RD+'performance/best-practice-with-the-query-store']]};

/* ---------- 1: Top consumers ---------- */
L['mss-perf:2:1']={blocks:[
{p:'The first job of Query Store is to show **which queries cost the most** over a period, by a metric you choose.'},
{svg:top},
{code:`-- Top 10 queries by total CPU in the last 24 hours
SELECT TOP (10)
       q.query_id, qt.query_sql_text,
       SUM(rs.count_executions) AS executions,
       SUM(rs.avg_cpu_time * rs.count_executions)/1000 AS total_cpu_ms,
       AVG(rs.avg_duration)/1000 AS avg_duration_ms
FROM   sys.query_store_query q
JOIN   sys.query_store_query_text qt ON qt.query_text_id = q.query_text_id
JOIN   sys.query_store_plan p ON p.query_id = q.query_id
JOIN   sys.query_store_runtime_stats rs ON rs.plan_id = p.plan_id
JOIN   sys.query_store_runtime_stats_interval i ON i.runtime_stats_interval_id = rs.runtime_stats_interval_id
WHERE  i.start_time > DATEADD(hour, -24, SYSDATETIMEOFFSET())
GROUP  BY q.query_id, qt.query_sql_text
ORDER  BY total_cpu_ms DESC;`},
{h:'Pick the right metric'},
{t:[['Metric','Finds'],
['**Duration**','What users feel'],
['**CPU time**','What loads the processor'],
['**Logical reads**','What hits memory and storage'],
['**Memory consumption**','Large grants'],
['**Execution count**','Chatty, small queries that add up']]},
{note:'Always compare totals, not single runs. A query that takes 20 ms but runs 100,000 times an hour can be your biggest consumer.'}],
src:[['sys.query_store_runtime_stats',M.RD+'system-catalog-views/sys-query-store-runtime-stats-transact-sql'],['Query Store catalog views',M.RD+'system-catalog-views/query-store-catalog-views-transact-sql']]};

/* ---------- 2: Regressions and forcing ---------- */
L['mss-perf:2:2']={blocks:[
{p:'A **regression** is a query that became slower, often because its **plan changed**. Query Store shows both plans side by side and lets you **force** the good one.'},
{svg:reg},
{code:`-- Which queries have more than one plan?
SELECT query_id, COUNT(DISTINCT plan_id) AS plans
FROM   sys.query_store_plan
GROUP  BY query_id
HAVING COUNT(DISTINCT plan_id) > 1;

-- Force a plan
EXEC sys.sp_query_store_force_plan @query_id = 42, @plan_id = 17;

-- Remove the force later
EXEC sys.sp_query_store_unforce_plan @query_id = 42, @plan_id = 17;

-- Check forced plans and failures
SELECT query_id, plan_id, is_forced_plan, force_failure_count, last_force_failure_reason_desc
FROM   sys.query_store_plan WHERE is_forced_plan = 1;`},
{h:'Good practice'},
{ul:['Use forcing as a **bridge**: fix the cause (statistics, index, code) and then **unforce**.','Review **forced plans** regularly: a forced plan can fail after a schema change.','**Automatic plan correction** can force the last good plan for you where the edition supports it. Check your edition and version.','Use **Query Store hints** (2022) to change query behavior without editing the application.']},
{note:'Forcing a plan does not stop SQL Server from compiling the query. If forcing fails, it falls back to a new plan and increments the failure count.'}],
src:[['Plan forcing',M.RD+'performance/query-store-usage-scenarios'],['sp_query_store_force_plan',M.RD+'system-stored-procedures/sp-query-store-force-plan-transact-sql']]};

/* ---------- 3: Reports ---------- */
L['mss-perf:2:3']={blocks:[
{p:'SSMS has built-in **Query Store reports** under the database: **Object Explorer, database, Query Store**. They give a visual answer to most common questions.'},
{svg:rep},
{h:'How to use them'},
{flow:['Start with Overall Resource Consumption to see when the load changed','Open Top Resource Consuming Queries for that time window','Select a query and compare its plans in the plan summary','Use Regressed Queries after a release or upgrade','Check Queries With Forced Plans for failures']},
{h:'Tips'},
{ul:['Set the **time range** at the top first: the default may hide the incident.','Switch between **duration, CPU and reads** to see different top lists.','Use **View query** and **Tracked Queries** to follow a single query over time.','Right-click a plan to **force** or **unforce** it from the report.']},
{note:'Reports read from the Query Store views, so they show only what was captured. Capture mode and cleanup settings decide what is available.'}],
src:[['Query Store reports in SSMS',M.RD+'performance/monitoring-performance-by-using-the-query-store'],['Query Store usage scenarios',M.RD+'performance/query-store-usage-scenarios']]};

/* ---------- 4: Capture and cleanup ---------- */
L['mss-perf:2:4']={blocks:[
{p:'Query Store has a **size limit**. Settings decide what it records and how it cleans up, so that it keeps useful data and does not fill up.'},
{svg:cap},
{t:[['Setting','Effect','Recommendation'],
['`QUERY_CAPTURE_MODE = AUTO`','Skips insignificant queries','Use for most databases'],
['`ALL`','Captures everything','Only for a short investigation'],
['`CUSTOM`','Set execution count, CPU and duration thresholds','Large busy systems, 2019 and later'],
['`MAX_STORAGE_SIZE_MB`','Size cap','1 GB or more for busy databases'],
['`SIZE_BASED_CLEANUP_MODE = AUTO`','Removes old data when near the cap','Keep AUTO'],
['`STALE_QUERY_THRESHOLD_DAYS`','Retention in days','30 is a common value']]},
{code:`SELECT actual_state_desc, desired_state_desc, readonly_reason,
       current_storage_size_mb, max_storage_size_mb,
       flush_interval_seconds, interval_length_minutes
FROM   sys.database_query_store_options;

-- If it turned READ_ONLY because of size
ALTER DATABASE SalesDB SET QUERY_STORE (MAX_STORAGE_SIZE_MB = 2048);
ALTER DATABASE SalesDB SET QUERY_STORE (OPERATION_MODE = READ_WRITE);`},
{note:'Queries with unique literal values and no parameters create many query entries. Fix these in code or with forced parameterization so Query Store and the plan cache do not fill up.'}],
src:[['ALTER DATABASE SET QUERY_STORE',M.TS+'statements/alter-database-transact-sql-set-options'],['Query Store best practices',M.RD+'performance/best-practice-with-the-query-store']]};

})();
