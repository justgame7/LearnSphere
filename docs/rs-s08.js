/* LearnSphere - Amazon Redshift, Section 08: Query Processing, Statistics & Maintenance.
   Lectures 0-7 are core, 8-11 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const plan=R.dg(700,300,[
[10,10,330,280,'Read the plan from the bottom up',1],
[30,40,290,40,'XN Merge (final sort on the leader)',0],
[45,90,275,40,'XN Network: send to leader',0],
[60,140,260,40,'XN HashAggregate: group the rows',0],
[75,190,245,40,'XN Hash Join DS_DIST_NONE',2],
[90,240,100,35,'Seq Scan: sales',0],[205,240,115,35,'Seq Scan: event',0],
[360,10,330,280,'What to look for',1],
[380,45,290,45,'1. Expensive steps: highest cost values',0],
[380,100,290,45,'2. Data movement: DS_BCAST, DS_DIST_BOTH',0],
[380,155,290,45,'3. Row estimates far from reality: stale statistics',0],
[380,210,290,45,'4. Nested loop joins: usually a missing join condition',0]],
[]);

const mv=R.dg(700,220,[
[10,80,130,60,'Base tables|events, sales',0],
[190,80,140,60,'Materialized view|stored result set',2],
[380,80,140,60,'Query|rewritten to use the view',0],
[570,80,120,60,'Fast answer|no base-table scan',2]],
[[140,110,190,110],[330,110,380,110],[520,110,570,110]]);

/* ================= LECTURE 0 ================= */
L['rs:7:0']={blocks:[
{p:'`EXPLAIN` shows the plan Redshift will use to run a query, without running it. Learning to read it is the fastest way to find out why a query is slow.'},
{svg:plan},
{code:`EXPLAIN SELECT eventname, COUNT(*) FROM event GROUP BY eventname;

XN HashAggregate  (cost=131.97..133.41 rows=576 width=17)
  ->  XN Seq Scan on event  (cost=0.00..87.98 rows=8798 width=17)`},
{h:'What each number means'},
{t:[['Item','Meaning'],
['`cost=A..B`','A is the relative cost of returning the **first** row of the step, B the cost of **finishing** it. Costs accumulate as you read up the plan'],
['`rows`','Estimated rows produced. It is based on statistics, so it is less reliable if `ANALYZE` has not run recently'],
['`width`','Estimated average row width in bytes'],
['Indentation','Read from the **bottom up**. Operators aligned at the same indent can start in parallel']]},
{p:'Cost is **relative**. It compares steps inside one plan to show which step is most expensive. It is not a time in seconds, and it is not a reliable way to compare two different plans. Use it to find the heavy step, then confirm with real timings.'},
{note:'EXPLAIN does not run the query. If you change the table design or run ANALYZE, the plan can change. EXPLAIN is a simplified, high-level view: to see what happened when the query ran, use SYS_QUERY_DETAIL.'},
{h:'The operators you will see most'},
{t:[['Operator','What it does'],
['`XN Seq Scan`','Scans a table: every needed column from start to end, applying the WHERE conditions. Sort keys help it skip blocks'],
['`XN Hash Join` + `XN Hash`','Builds a hash table of the inner table and probes it with the outer table. Used when join columns are not both distribution and sort keys'],
['`XN Merge Join`','Typically the **fastest** join. Needs join columns that are both distribution and sort keys, and less than 20 percent of the tables unsorted'],
['`XN Nested Loop`','The **slowest** join: mainly cross joins and some inequality joins. A warning sign'],
['`XN HashAggregate`','Grouped aggregation on unsorted input'],
['`XN GroupAggregate`','Grouped aggregation on sorted input'],
['`XN Aggregate`','Scalar aggregates such as `SUM` and `AVG`'],
['`XN Sort`, `XN Merge`','Sorting on the slices, then merging the sorted streams on the leader'],
['`XN Network`','Sends intermediate results to the leader node'],
['`XN Unique`, `XN Limit`, `XN Window`','Remove duplicates, apply LIMIT, run window functions']]},
{h:'Joins and data movement'},
{p:'For each join, EXPLAIN also shows how the data is moved: the `DS_` label (`DS_DIST_NONE`, `DS_BCAST_INNER`, `DS_DIST_BOTH` and so on) from Section 6. The **inner** table is scanned first and appears lower in the plan; it is the one probed for matches and held in memory, usually the smaller table. The order of tables in your `FROM` clause does not decide which is inner or outer.'},
{h:'A quick routine'},
{flow:['Run EXPLAIN on the slow query','Find the step with the highest cost','Check its join label and data movement','Compare rows estimates with what you expect','Fix design, statistics or SQL, then re-run']},
{code:`EXPLAIN
SELECT l.sellerid, SUM(s.qtysold)
FROM   sales s JOIN listing l ON s.listid = l.listid
WHERE  l.listtime > '2008-12-01' AND s.saletime > '2008-12-01'
GROUP  BY 1 ORDER BY 1;`}],
src:[['Creating and interpreting a query plan',DG+'c-the-query-plan.html'],['EXPLAIN',DG+'r_EXPLAIN.html'],['Query planning and execution workflow',DG+'c-query-planning.html']]};

/* ================= LECTURE 1 ================= */
L['rs:7:1']={blocks:[
{p:'The optimizer chooses a plan from **statistics**: row counts and the distribution of values in each column. If the statistics are wrong, the plan can be wrong, with bad join orders, wrong data movement and slow queries.'},
{h:'What ANALYZE does'},
{p:'`ANALYZE` samples a table, computes column statistics and stores them for the planner. By default it runs one sampling pass for the distribution key column and one for the other columns.'},
{code:`ANALYZE;                                 -- whole current database (can be costly)
ANALYZE sales;                           -- one table
ANALYZE listing (listid, totalprice, listtime);   -- only some columns
ANALYZE sales PREDICATE COLUMNS;         -- only columns used in queries`},
{h:'When statistics are created and refreshed'},
{ul:['`COPY` into an **empty** table runs an analyze automatically. Force it with `STATUPDATE ON`, skip it with `STATUPDATE OFF`.','Tables created with **CTAS**, **CREATE TEMP TABLE AS** and **SELECT INTO** are analyzed automatically when created.','Redshift also analyzes tables **automatically in the background** (next lecture).','You do **not** need to run ANALYZE after restoring a snapshot or resuming a paused cluster: system table information is preserved.','Only the table owner or a superuser can run ANALYZE.']},
{h:'Symptoms of stale statistics'},
{ul:['A **warning** in `EXPLAIN` results about a table that was never analyzed after its first load.','A missing statistics event in the alert log (`STL_ALERT_EVENT_LOG`, provisioned).','Row estimates in the plan far from the real counts, and unexpected join methods or data movement.','`stats_off` above about 10 in `SVV_TABLE_INFO`.']},
{code:`-- Tables with stale or missing statistics, biggest first
SELECT "schema" || '.' || "table" AS table_name, size AS mb, stats_off
FROM   svv_table_info
WHERE  stats_off > 5
ORDER  BY size DESC;

-- Rows inserted or deleted since the last ANALYZE
SELECT * FROM pg_statistic_indicator;`},
{h:'The threshold'},
{p:'ANALYZE skips a table when fewer than **10 percent** of its rows have changed since the last analyze (`analyze_threshold_percent`, default 10). You can change it for your session with `SET analyze_threshold_percent TO 1;`. Because of this threshold, running ANALYZE at the end of every load is cheap: it will do nothing when nothing material changed.'},
{h:'Which columns matter'},
{ul:['Columns used in **joins**, **filters (predicates)**, and **GROUP BY or ORDER BY** matter most.','Measures and rarely queried columns, such as big VARCHAR fields, rarely need fresh statistics.','`PREDICATE COLUMNS` analyzes only columns that queries used as predicates, plus distribution key and sort key columns. If no column is marked yet (the table has not been queried), it analyzes all columns. If query patterns change, the new predicate columns are picked up the next time you run it.']},
{h:'History'},
{code:`-- Superuser: what ANALYZE has done
SELECT table_name, is_automatic, status, rows, modified_rows, start_time
FROM   sys_analyze_history
ORDER  BY start_time DESC LIMIT 20;
-- status: Full, Skipped, PredicateColumn`},
{note:'ANALYZE is resource intensive. Run it on tables and columns that changed, not on everything on a fixed schedule.'}],
src:[['Analyzing tables',DG+'t_Analyzing_tables.html'],['ANALYZE',DG+'r_ANALYZE.html'],['SYS_ANALYZE_HISTORY',DG+'SYS_ANALYZE_HISTORY.html']]};

/* ================= LECTURE 2 ================= */
L['rs:7:2']={blocks:[
{p:'Most of the time you do not have to run ANALYZE yourself. Redshift watches the workload and analyzes tables **automatically**, in the background.'},
{h:'How automatic analyze behaves'},
{ul:['It is **on by default**, controlled by the `auto_analyze` parameter (provisioned parameter group). Set it to false to turn it off.','It runs when the workload is **light**, to limit impact on your queries.','It **skips tables whose changes are small**, using the same 10 percent threshold.','It skips tables whose statistics are already current. The reverse holds too: an **explicit ANALYZE skips a table that automatic analyze has just updated**, so adding ANALYZE to your ETL is harmless.','Rows in `SYS_ANALYZE_HISTORY` with `is_automatic = true` show what it did.']},
{h:'When to run ANALYZE yourself'},
{t:[['Situation','Why'],
['Right after a **large load** into a non-empty table and before important queries','Background analyze may not have run yet'],
['At the end of an **ETL cycle** that rebuilds or heavily changes tables','Gets accurate plans for the next step immediately'],
['New tables created by `INSERT` rather than CTAS or COPY into an empty table','They have no statistics until analyzed'],
['A specific **join or predicate column** whose distribution changed sharply','Target just those columns']]},
{code:`-- End of an ETL job: cheap if nothing material changed
ANALYZE curated.fact_sales PREDICATE COLUMNS;

-- Check what automatic analyze did on a table recently
SELECT table_name, is_automatic, status, rows, modified_rows, start_time
FROM   sys_analyze_history
WHERE  table_name = 'fact_sales'
ORDER  BY start_time DESC LIMIT 5;`},
{h:'Practical settings'},
{t:[['Setting','Effect'],
['`auto_analyze` = true (default)','Background statistics maintenance'],
['`analyze_threshold_percent`','Share of changed rows needed before ANALYZE does anything (default 10)'],
['`COPY ... STATUPDATE OFF`','Skip the analyze that COPY does for empty tables (for example in staging)'],
['`ANALYZE ... PREDICATE COLUMNS`','Cheaper analyze that targets the useful columns']]},
{note:'If a query plan looks wrong, check stats_off in SVV_TABLE_INFO first. If it is high, run ANALYZE on that table and look at the plan again before changing anything else.'}],
src:[['Analyzing tables (automatic analyze)',DG+'t_Analyzing_tables.html'],['analyze_threshold_percent',DG+'r_analyze_threshold_percent.html'],['SYS_ANALYZE_HISTORY',DG+'SYS_ANALYZE_HISTORY.html']]};

/* ================= LECTURE 3 ================= */
L['rs:7:3']={blocks:[
{p:'Redshift does not overwrite rows in place. Understanding that explains why `VACUUM` exists and what it does.'},
{h:'Why vacuum is needed'},
{ul:['**Deleted and updated rows are not removed straight away.** A `DELETE` marks rows for deletion; an `UPDATE` marks the old row deleted and writes a new one. The marked rows are **ghost rows** and keep taking space and being scanned until they are vacuumed.','**New rows go to an unsorted region at the end of the table.** Over time the share of unsorted rows grows, and sort keys skip fewer blocks.']},
{p:'VACUUM removes ghost rows (reclaiming space) and re-sorts rows into sort key order.'},
{h:'Automatic vacuum'},
{ul:['**Automatic vacuum delete**: Redshift runs `VACUUM DELETE` in the background, based on the number of deleted rows, during periods of reduced load. It pauses during heavy load.','**Automatic table sort**: Redshift keeps tables in sort key order in the background. It tracks which sections of a table scans touch most and sorts those first, including scans from concurrency scaling and from data sharing consumers.','Automatic operations **pause** when a DDL such as `ALTER TABLE` needs a lock on the table, and during high load.','They lessen, but do not remove, the need to vacuum yourself. After a very large load, or when you need a table fully sorted, run VACUUM manually.']},
{h:'The VACUUM options'},
{t:[['Command','What it does','Use when'],
['`VACUUM` or `VACUUM FULL` (default)','Re-sorts and reclaims space','Standard cleanup of a table'],
['`VACUUM SORT ONLY t`','Re-sorts, does not reclaim space','Space is fine, sort order matters'],
['`VACUUM DELETE ONLY t`','Reclaims space, does not sort','Many deletes, order already good (rarely needed: automatic)'],
['`VACUUM RECLUSTER t`','Sorts only the unsorted portions; does not merge with the sorted region','Big tables with frequent ingestion and queries on recent data. Not for interleaved or ALL-distributed tables'],
['`VACUUM REINDEX t`','Re-analyzes interleaved key distribution, then a full vacuum','Interleaved sort keys only; much slower'],
['`... BOOST`','Runs with extra memory and disk, in one window','Quiet periods; blocks concurrent deletes and updates']]},
{h:'The threshold'},
{p:'By default VACUUM **skips the sort phase when the table is already at least 95 percent sorted**, and aims to reclaim space until at least 95 percent of rows are not marked deleted. Change it for one table with `TO n PERCENT`: 100 always sorts and reclaims fully, 0 never does. It needs a table name, and cannot be used with REINDEX or RECLUSTER.'},
{code:`VACUUM curated.fact_sales;                     -- default 95 percent threshold
VACUUM curated.fact_sales TO 100 PERCENT;      -- always sort and reclaim
VACUUM SORT ONLY curated.fact_sales TO 75 PERCENT;
VACUUM RECLUSTER curated.fact_events;          -- big, append-heavy table
VACUUM REINDEX curated.customer;               -- interleaved keys`},
{h:'Rules'},
{ul:['**Not allowed inside a transaction block.**','Queries and writes continue during a vacuum, but both can run slower. Incremental merges briefly block concurrent updates and deletes, and DDL such as `ALTER TABLE` waits until the vacuum finishes with the table.','Two vacuums cannot work on the same table at once, but different tables can be vacuumed concurrently. Start with two and add more only if load allows.','If a vacuum fails midway, the table stays consistent; restart it.','A table can grow slightly after a vacuum if there is nothing to reclaim or the new order compresses worse.','You need table permissions (owner, superuser or the VACUUM privilege). Without them the command succeeds but does nothing.','The Redshift `VACUUM` differs from PostgreSQL: the default here sorts and reclaims space.']},
{h:'Deciding what to vacuum'},
{code:`-- unsorted = physical sort state; vacuum_sort_benefit = estimated query gain from sorting
SELECT "table", unsorted, vacuum_sort_benefit, tbl_rows, estimated_visible_rows
FROM   svv_table_info
WHERE  unsorted > 20 OR tbl_rows > estimated_visible_rows * 1.2
ORDER  BY vacuum_sort_benefit DESC;

SELECT table_name, vacuum_type, is_automatic, status, start_time, duration/1000000.0 AS secs
FROM   sys_vacuum_history ORDER BY start_time DESC LIMIT 20;`},
{p:'Use both columns together. A table can be 86 percent unsorted yet show only a 5 percent benefit, because queries touch little of it. Another at 45 percent unsorted can show a 67 percent benefit. Vacuum the second first.'},
{note:'Run manual vacuums outside the maintenance window and away from heavy loads. The longer you delay, the larger the unsorted region and the longer the vacuum takes.'}],
src:[['Vacuuming tables',DG+'t_Reclaiming_storage_space202.html'],['VACUUM',DG+'r_VACUUM_command.html'],['SYS_VACUUM_HISTORY',DG+'SYS_VACUUM_HISTORY.html']]};

/* ================= LECTURE 4 ================= */
L['rs:7:4']={blocks:[
{p:'The fastest query is the one that does not run. Redshift has two caches that make repeated work cheap: the **result cache** and the **compile cache**.'},
{h:'The result cache'},
{p:'Redshift stores the results of certain queries in memory on the leader node. When the same query arrives again, Redshift checks the cache and, if it finds a valid copy, returns it without running the query. It is on by default and transparent to users.'},
{p:'A cached result is used only when **all** of these are true:'},
{ul:['The user has permission on the objects in the query.','The tables and views used have **not been modified**.','The query uses no function that must be evaluated each time, such as `GETDATE`.','The query does **not** reference Redshift Spectrum external tables.','Configuration parameters that could change the result are unchanged.','The query text **syntactically matches** the cached query.']},
{ul:['Redshift does not cache some very large result sets; whether it does depends on the number of cache entries and the instance type.','Results are shared across users when permissions allow: a dashboard query run by one user can speed the same query for others.']},
{code:`-- Did my query use the cache?
SELECT query_id, result_cache_hit, result_cache_query_id, elapsed_time/1000000.0 AS secs
FROM   sys_query_history
WHERE  query_type = 'SELECT'
ORDER  BY start_time DESC LIMIT 10;

-- Turn the cache off for this session when benchmarking
SET enable_result_cache_for_session TO off;`},
{note:'Benchmark with the cache off, or you will time the cache. Dashboards benefit greatly from it, so do not turn it off globally without a reason.'},
{h:'The compile cache'},
{p:'Redshift generates and compiles code for each query (Section 2). Compiled segments are cached **on the cluster** and in a large **remote cache that survives reboots**. A repeated query can skip compilation. Redshift also uses a technique called composition: a lightweight arrangement of existing logic runs a new query immediately while optimized code compiles in the background.'},
{ul:['`compile_time` in `SYS_QUERY_HISTORY` shows time spent compiling.','Compiled segments are reused when the same query runs again, so repeat runs skip compilation. The result cache is a separate mechanism and needs a syntactically matching query.','When you benchmark, compare the **second run**: the first can include compile time.']},
{h:'Cache vs the other speed-ups'},
{t:[['Mechanism','Saves','Needs'],
['Result cache','The whole query','Identical query, unchanged data'],
['Compile cache','Compilation time','Similar query shape'],
['Materialized view','Heavy joins and aggregates','Predictable, repeated queries (lecture below)'],
['Good table design','Scanning and data movement','Section 6']]}],
src:[['Performance: result caching and compiled code',DG+'c_challenges_achieving_high_performance_queries.html'],['enable_result_cache_for_session',DG+'r_enable_result_cache_for_session.html'],['SYS_QUERY_HISTORY',DG+'SYS_QUERY_HISTORY.html']]};

/* ================= LECTURE 5 ================= */
L['rs:7:5']={blocks:[
{p:'On a busy provisioned warehouse, a quick lookup can wait behind a long report. **Short query acceleration (SQA)** gives short queries their own fast lane.'},
{h:'How it works'},
{ul:['SQA prioritizes selected **short-running queries** ahead of longer ones. They run in a dedicated space instead of waiting in a WLM queue.','**Read-only queries (`SELECT`) and `CREATE TABLE AS`** are eligible, and only queries in a **user-defined queue**.','A machine learning model predicts each eligible query run time. If the prediction is below the **SQA maximum runtime** and the query is waiting, SQA moves it to the front.','If a query runs longer than the maximum runtime, WLM moves it to the first matching WLM queue.','Predictions improve as SQA learns your query patterns.']},
{h:'Maximum runtime'},
{ul:['The default is **dynamic**: WLM picks a value from analysis of your workload. AWS recommends keeping it.','You can set a fixed value from **1 to 20 seconds** if you have a measured reason.']},
{h:'Enabling and checking'},
{ul:['SQA is **enabled by default** in the default parameter group and in all new parameter groups.','To turn it off, edit the WLM configuration in the parameter group and clear **Enable short query acceleration**.','With SQA on you can remove WLM queues that were only for short queries, and run long-query queues with **fewer slots**. AWS recommends a slot count of **15 or fewer** for best overall performance.']},
{code:`-- If this returns a row, SQA is on (service class 14)
SELECT * FROM stv_wlm_service_class_config WHERE service_class = 14;

-- Queries handled by SQA that completed vs were evicted for running too long
SELECT final_state, COUNT(*), AVG(total_exec_time)
FROM   stl_wlm_query WHERE service_class = 14 AND userid >= 100 GROUP BY 1;`},
{p:'Advisor also reports how many recent queries SQA would have helped, with the daily queue time saved, if SQA is off.'},
{h:'Where it applies'},
{p:'SQA is part of workload management on **provisioned** warehouses (Section 9). Serverless has no slots, priorities or SQA setting: it scales compute automatically, and you control it through base and maximum capacity, usage limits and optional query queues with monitoring rules.'},
{note:'SQA and automatic WLM work well together. Turn it on, keep the dynamic maximum runtime, then measure queue times (Section 9) before tuning anything else.'}],
src:[['Short query acceleration',DG+'wlm-short-query-acceleration.html'],['Advisor: enable SQA',DG+'advisor-recommendations.html']]};

/* ================= LECTURE 6 ================= */
L['rs:7:6']={blocks:[
{p:'A **materialized view (MV)** stores the **result** of a query. Repeated, expensive queries (joins and aggregates over billions of rows) can then read a small precomputed result instead of the base tables.'},
{svg:mv},
{h:'Create, query, refresh'},
{code:`CREATE MATERIALIZED VIEW curated.mv_daily_sales
AUTO REFRESH YES
AS
SELECT d.date_key, p.category, SUM(f.amount) AS revenue, COUNT(*) AS orders
FROM   curated.fact_sales f
JOIN   curated.dim_date d    ON f.date_key = d.date_key
JOIN   curated.dim_product p ON f.product_key = p.product_key
GROUP  BY d.date_key, p.category;

SELECT * FROM curated.mv_daily_sales WHERE date_key = 20260101;   -- query it like a table

REFRESH MATERIALIZED VIEW curated.mv_daily_sales;                 -- bring it up to date
ALTER MATERIALIZED VIEW curated.mv_daily_sales AUTO REFRESH YES;  -- turn on later`},
{ul:['An MV is **stale** after the base tables change, until it is refreshed.','You can build an MV on other MVs. Refresh the top one with `REFRESH MATERIALIZED VIEW w CASCADE` to refresh the whole chain in one transaction. Without CASCADE only that view is refreshed.']},
{h:'Incremental or full refresh'},
{p:'Redshift picks the method from the defining query.'},
{t:[['Refresh','What happens','When'],
['**Incremental**','Finds what changed in the base tables and applies only that','Queries with `SELECT`, `FROM`, `JOIN` (inner), `WHERE`, `GROUP BY`, `HAVING`; aggregates `SUM`, `MIN`, `MAX`, `AVG`, `COUNT`; most immutable functions'],
['**Full**','Re-runs the whole query and replaces everything','When incremental is not possible']]},
{p:'Incremental refresh is **not** possible for views that use: outer joins (left, right, full), `UNION`, `INTERSECT`, `EXCEPT`, `MINUS`, aggregates such as `MEDIAN`, `LISTAGG`, `STDDEV`, `APPROXIMATE`, `DISTINCT` aggregates, window functions, subqueries, or Delta Lake and Hudi external tables. Design the defining query to stay incremental when you can.'},
{h:'Automatic refresh'},
{ul:['`AUTO REFRESH YES` refreshes the view soon after the base tables change, using free capacity, weighing system load, refresh cost and how often the view is used.','Redshift **prioritizes your workload** over auto refresh and may stop a refresh, so some views can lag. For a hard freshness requirement use manual or **scheduled refresh** (Section 7).','On provisioned clusters on the **current track** from patch 198, auto refresh now runs as an ordinary user query with the same priority as other queries (from February 27, 2026). This is not enabled on Serverless.','You can always run `REFRESH MATERIALIZED VIEW` by hand.']},
{h:'Automatic query rewriting'},
{p:'Redshift can **rewrite** a query to read an MV even when the query does not mention it. This needs the view to be **up to date**. Check the plan for the view name.'},
{h:'Automated materialized views (AutoMV)'},
{ul:['Redshift watches your workload and **creates and drops MVs by itself** when they would help. It is **on by default**; set the `auto_mv` parameter to false to turn it off.','It works only when the system is quiet and stops if you start work. It uses spare capacity: **no extra compute charge**, but storage is billed normally.','Limit: **200** automated MVs per database. At 80 percent of storage no new ones are created; at 90 percent they may be dropped.','Queries rewritten to use an AutoMV show a name like `mv_tbl__...__auto_mv` in `EXPLAIN` (search for `auto_mv`). Queries always return the latest results; if the view is stale the query reads the base tables.','Candidate queries need a `GROUP BY` or `SUM`, `COUNT`, `MIN`, `MAX`, `AVG`, with no outer joins, `DISTINCT` aggregates, window functions or other MVs.']},
{h:'Monitoring'},
{code:`SELECT mv_name, refresh_type, status, start_time, duration/1000000.0 AS secs
FROM   sys_mv_refresh_history
ORDER  BY start_time DESC LIMIT 20;
-- status examples: "Refresh successfully updated MV incrementally",
--                  "Refresh successfully recomputed MV from scratch",
--                  "Refresh failed due to an internal error"`},
{note:'Use an MV for predictable, repeated queries such as dashboards. Do not create one for every query: each MV costs storage and refresh work.'}],
src:[['Materialized views',DG+'materialized-view-overview.html'],['Refreshing a materialized view',DG+'materialized-view-refresh.html'],['Automated materialized views',DG+'materialized-view-auto-mv.html'],['SYS_MV_REFRESH_HISTORY',DG+'SYS_MV_REFRESH_HISTORY.html']]};

/* ================= LECTURE 7 ================= */
L['rs:7:7']={blocks:[
{p:'A short, repeatable weekly routine keeps a warehouse healthy. Every query below uses views that work on provisioned clusters and Serverless, so you can save them as scheduled queries (Section 7).'},
{h:'1. Statistics'},
{code:`SELECT "schema", "table", size AS mb, stats_off
FROM   svv_table_info
WHERE  stats_off > 10
ORDER  BY size DESC LIMIT 20;
-- Action: ANALYZE <table> PREDICATE COLUMNS;`},
{h:'2. Unsorted data and ghost rows'},
{code:`SELECT "schema", "table", size AS mb, unsorted, vacuum_sort_benefit,
       tbl_rows - estimated_visible_rows AS ghost_rows
FROM   svv_table_info
WHERE  (unsorted > 20 AND vacuum_sort_benefit > 10)
   OR  tbl_rows > estimated_visible_rows * 1.2
ORDER  BY size DESC LIMIT 20;
-- Action: VACUUM <table>; (or SORT ONLY / RECLUSTER for big append-heavy tables)`},
{h:'3. Did automation keep up?'},
{code:`SELECT table_name, vacuum_type, is_automatic, status, start_time
FROM   sys_vacuum_history WHERE start_time > DATEADD(day, -7, GETDATE())
ORDER  BY start_time DESC LIMIT 30;

SELECT table_name, is_automatic, status, modified_rows, start_time
FROM   sys_analyze_history WHERE start_time > DATEADD(day, -7, GETDATE())
ORDER  BY start_time DESC LIMIT 30;`},
{h:'4. Failed materialized view refreshes'},
{code:`SELECT mv_name, refresh_type, status, start_time
FROM   sys_mv_refresh_history
WHERE  start_time > DATEADD(day, -7, GETDATE()) AND status ILIKE '%fail%'
ORDER  BY start_time DESC;`},
{h:'5. Slow and failed queries'},
{code:`SELECT DATE_TRUNC('day', start_time) AS day,
       COUNT(*) AS queries,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
       AVG(elapsed_time)/1000000.0 AS avg_secs,
       MAX(elapsed_time)/1000000.0 AS max_secs
FROM   sys_query_history
WHERE  start_time > DATEADD(day, -7, GETDATE()) AND query_type = 'SELECT'
GROUP  BY 1 ORDER BY 1;

-- Top 10 slowest queries of the week
SELECT query_id, user_id, elapsed_time/1000000.0 AS secs, queue_time/1000000.0 AS queued_secs, LEFT(query_text, 80) AS q
FROM   sys_query_history
WHERE  start_time > DATEADD(day, -7, GETDATE()) AND status = 'success'
ORDER  BY elapsed_time DESC LIMIT 10;`},
{h:'6. Design recommendations'},
{code:`SELECT * FROM svv_alter_table_recommendations;`},
{h:'The weekly routine'},
{flow:['Statistics','Unsorted and ghost rows','Automation history','Failed MV refreshes','Slow and failed queries','Design recommendations','Write down actions and results']},
{ul:['Keep a **runbook** with the exact action for each finding.','Store the results in a table so you can graph trends month over month.','Run manual vacuums and analyzes **outside** the maintenance window and heavy loads.','Make a monthly pass for bigger items: unused tables, oversized columns and old snapshots.']},
{note:'If a finding appears every week for the same table, fix the cause (design or load pattern) instead of repeating the cleanup.'}],
src:[['SVV_TABLE_INFO',DG+'r_SVV_TABLE_INFO.html'],['SYS_VACUUM_HISTORY',DG+'SYS_VACUUM_HISTORY.html'],['SYS_ANALYZE_HISTORY',DG+'SYS_ANALYZE_HISTORY.html'],['SYS_MV_REFRESH_HISTORY',DG+'SYS_MV_REFRESH_HISTORY.html']]};

/* ================= ADDITIONAL 8 ================= */
L['rs:7:8']={blocks:[
{p:'Small plans are easy. Real queries have many joins and aggregates. This lecture shows how to read larger plans and spot the problems that matter.'},
{h:'Read it as a tree'},
{ul:['Each operator takes its inputs from the operators **below** it (more indented).','Costs **accumulate upwards**, so the top node shows the total. Find the step whose own cost jumps most compared with its inputs.','The **inner** table (probed for matches) is scanned first, nearer the bottom; the outer table is the row source.','Operators at the same indent depend on nothing in each other and can start together, though a scan may still wait for a hash to finish.']},
{h:'Join types and what they imply'},
{t:[['Join','When chosen','What to do'],
['**Merge Join**','Join columns are both distribution and sort keys, and under 20 percent unsorted','Best case. Keep tables sorted with VACUUM'],
['**Hash Join**','Join columns are not both distribution and sort keys','Normal. If it dominates, check data movement, the unique-ness of the join column, and consider keys'],
['**Nested Loop**','Cross join (no join condition) or some inequality joins','Almost always a mistake. Add the missing condition']]},
{p:'A hash join whose output row count is much larger than the final result suggests the join is **not on a unique column**, so rows multiply. Check that you join on a primary-key style column.'},
{h:'Data movement'},
{p:'For every join, the `DS_` label tells you what moved. `DS_DIST_NONE` and `DS_DIST_ALL_NONE` are free. `DS_BCAST_INNER` copies the whole inner table to every node, so it is fine for a small table and expensive for a large one; the estimated cost of a bad broadcast can be many orders of magnitude higher. `DS_DIST_BOTH` moves both sides.'},
{code:`XN Hash Join DS_BCAST_INNER  (cost=109.98..3871130276.17 rows=172456 width=132)
  Hash Cond: ("outer".eventid = "inner".eventid)
  ->  XN Merge Join DS_DIST_NONE  (cost=0.00..6285.93 rows=172456 width=97)
        Merge Cond: ("outer".listid = "inner".listid)
        ->  XN Seq Scan on listing  (cost=0.00..1924.97 rows=192497 width=44)
        ->  XN Seq Scan on sales  (cost=0.00..1724.56 rows=172456 width=53)
  ->  XN Hash  (cost=87.98..87.98 rows=8798 width=35)
        ->  XN Seq Scan on event  (cost=0.00..87.98 rows=8798 width=35)`},
{p:'Here `sales` and `listing` join cheaply (`DS_DIST_NONE`), but the third join broadcasts `event` and carries almost all of the plan cost. Fixes: distribute `event` on `eventid` along with `sales`, or make `event` `DISTSTYLE ALL` if it is small and stable.'},
{h:'Cardinality problems'},
{ul:['**Rows estimate far from reality** usually means stale or missing statistics. Run `ANALYZE` and compare again.','**Estimates that stay wrong** after ANALYZE can come from correlated columns or complex expressions in predicates. Simplify expressions, avoid functions on filter columns, or materialize an intermediate result in a temp table with its own statistics.','**Sort and aggregate steps over huge inputs** point to missing filters earlier in the query or a missing sort key.']},
{h:'Aggregation clues'},
{ul:['`HashAggregate` is a grouped aggregate on unsorted input; `GroupAggregate` is on sorted input.','A query whose `GROUP BY` lists only sort key columns, in order from the first, and includes the distribution key, can qualify for **one-phase aggregation**, shown as `XN GroupAggregate`. That is cheaper than a two-phase aggregate with a redistribution.','Put columns in the same order in `GROUP BY` and `ORDER BY` so the planner can avoid an extra sort.']},
{h:'A checklist for a big plan'},
{flow:['Find the costliest step','Check its DS label','Check scan filters and sort keys','Compare estimates with reality','Look for nested loops and big sorts','Change one thing and re-explain']}],
src:[['Creating and interpreting a query plan',DG+'c-the-query-plan.html'],['Evaluating the query plan',DG+'c_data_redistribution.html'],['Query performance improvement',DG+'query-performance-improvement-opportunities.html']]};

/* ================= ADDITIONAL 9 ================= */
L['rs:7:9']={blocks:[
{p:'When someone says a query is slow, work through the same steps every time. This workflow takes you from the complaint to a root cause using views that work on Provisioned and Serverless.'},
{flow:['Find the query','Split its time: queue, plan, compile, run','Find the slow step and its skew or spill','Read the plan','Name the cause and fix it','Re-run and compare']},
{h:'1. Find the query and split its time'},
{code:`SELECT query_id, status, username,
       queue_time/1000000.0     AS queued_s,
       planning_time/1000000.0  AS planning_s,
       compile_time/1000000.0   AS compile_s,
       lock_wait_time/1000000.0 AS lock_wait_s,
       execution_time/1000000.0 AS run_s,
       elapsed_time/1000000.0   AS total_s,
       result_cache_hit, LEFT(query_text, 100) AS q
FROM   sys_query_history
WHERE  query_text ILIKE '%monthly_revenue%' AND query_text NOT ILIKE '%sys_query_history%'
ORDER  BY start_time DESC LIMIT 5;`},
{t:[['Where the time went','Meaning','Go to'],
['High `queued_s`','Waited for a slot or capacity','Workload management (Section 9)'],
['High `lock_wait_s`','Waited for a table lock','Transactions and locks lecture'],
['High `compile_s`','First run of a new shape','Rerun; usually one-off'],
['High `planning_s`','Complex query or many tables','Simplify, check statistics'],
['High `run_s`','Real work is slow','Steps below']]},
{h:'2. Find the slow step'},
{code:`SELECT child_query_sequence AS child, stream_id, segment_id, step_id,
       TRIM(step_name) AS step, TRIM(table_name) AS tbl,
       duration/1000000.0 AS secs, input_rows, output_rows,
       data_skewness, time_skewness,
       spilled_block_local_disk AS spill_local, spilled_block_remote_disk AS spill_remote
FROM   sys_query_detail
WHERE  query_id = 123456 AND step_id <> -1
ORDER  BY duration DESC LIMIT 10;`},
{p:'`SYS_QUERY_DETAIL` has one row per step, segment, stream and child query (a single user query can be rewritten into several child queries). Step rows have a real `step_id`; the `-1` rows are totals at a higher level.'},
{h:'3. Read the signals'},
{t:[['Signal in SYS_QUERY_DETAIL','Likely cause','Fix'],
['`scan` step with `input_rows` far above `output_rows`','Filter not restrictive, or no sort key on the filter column','Add predicates, add or change the sort key, `VACUUM`'],
['`is_rrscan` = f on a big scan','Range-restricted scan not used','Filter on the sort key column'],
['High `data_skewness` or `time_skewness` (toward 100)','Uneven distribution, or one slice has most rows','Change distribution key (Section 6)'],
['Non-zero `spilled_block_*`, especially remote','Not enough memory; step spilled to disk','Filter and aggregate earlier, break into temp tables, more capacity'],
['`distribute` or `broadcast` steps with large `output_bytes`','Data movement for joins','Fix distribution keys'],
['`nestloop` step','Cross join','Add the join condition'],
['`return` step with a huge `output_rows`','Very large result set','Aggregate, or use `UNLOAD`'],
['`alert` text present','Redshift flagged a problem','Read the alert (statistics, nested loop, distribution)']]},
{h:'4. Read the plan'},
{code:`EXPLAIN <the query>;
SELECT * FROM sys_query_explain WHERE query_id = 123456;   -- plan of the query that already ran`},
{h:'5. Fix, then compare'},
{ul:['Change **one** thing at a time: statistics, a predicate, a key, a rewrite.','Compare with `result_cache_hit` false, on the second run.','Record the before and after in a ticket so the fix is known next time.']},
{note:'Queries that look slow are often waiting, not running. Always split queue, lock, compile and run time first: tuning SQL does nothing when the time was spent in a queue.'}],
src:[['SYS_QUERY_DETAIL',DG+'SYS_QUERY_DETAIL.html'],['SYS_QUERY_HISTORY',DG+'SYS_QUERY_HISTORY.html'],['Query performance improvement',DG+'query-performance-improvement-opportunities.html']]};

/* ================= ADDITIONAL 10 ================= */
L['rs:7:10']={blocks:[
{p:'Redshift lets many sessions read and write at once. Isolation and locks explain what each session sees, and why a session sometimes waits, is cancelled, or blocks maintenance.'},
{h:'Snapshot isolation'},
{ul:['Each transaction works from a **snapshot** of the latest committed data, taken at the first of most `SELECT`, DML (`COPY`, `DELETE`, `INSERT`, `UPDATE`, `TRUNCATE`) or some DDL statements in the transaction.','Concurrent transactions are **invisible to each other**: no dirty reads, non-repeatable reads or phantoms.','`SNAPSHOT` is the **default** isolation level for new provisioned clusters and Serverless workgroups. It is more permissive and faster. Two transactions that update **different rows** can both commit.','`SERIALIZABLE` is stricter and slower. It prevents write-skew anomalies by letting only one of two conflicting transactions commit and cancelling the other with **error 1023** (serializable isolation violation).']},
{code:`SELECT * FROM stv_db_isolation_level;    -- which level is the database using? (provisioned)
SELECT * FROM pg_database_info;          -- how many concurrent transactions are supported`},
{h:'Locks'},
{ul:['Reads do not block writes and writes do not block reads in the normal case: a reader sees the committed snapshot.','**Writes take table-level locks.** Concurrent writes to the same table can wait for each other, or one transaction is stopped if it conflicts.','**DDL and some commands need exclusive locks**: `DROP TABLE`, `TRUNCATE` and `ALTER TABLE` operations prevent reads while they hold the lock.','`LOCK table` inside a transaction takes an `ACCESS EXCLUSIVE` lock and makes other reads and writes wait until you commit. You cannot lock views.','When a lock conflict occurs the transaction that loses is stopped, and an entry is written to `STL_TR_CONFLICT`.','Locks are released when the transaction ends, so **long-open transactions block other work**, including `VACUUM`, `ALTER TABLE` and maintenance.']},
{h:'Find blockers'},
{code:`-- Open transactions, lock modes and who is waiting
SELECT txn_owner, txn_db, xid, pid, txn_start, lock_mode, lockable_object_type, relation, granted
FROM   svv_transactions ORDER BY txn_start;

SELECT * FROM pg_locks;

-- Long-open transactions (older than 30 minutes)
SELECT xid, pid, txn_owner, DATEDIFF(minute, txn_start, GETDATE()) AS open_minutes
FROM   svv_transactions WHERE DATEDIFF(minute, txn_start, GETDATE()) > 30;`},
{p:'Ending the session that holds the locks releases them and rolls its transaction back: `SELECT pg_terminate_backend(<pid>)` (Section 5). The cluster also ends sessions with a transaction idle for **six hours**.'},
{h:'Deadlocks'},
{p:'A deadlock happens when two transactions each wait for a lock the other holds. Redshift detects it, **stops one transaction** with a deadlock error and lets the other continue.'},
{ul:['**Lock tables in the same order** in every job.','Keep transactions **short**; do not leave one open while waiting on a person or a slow external step.','Avoid unnecessary `BEGIN` blocks that hold locks across many statements.','**Retry** a failed transaction in your application or orchestrator: serialization and deadlock errors are expected under concurrency.']},
{h:'Rules of thumb'},
{ul:['Run bulk loads and maintenance when readers are few, but readers are rarely blocked.','Do not run DDL on busy tables in business hours.','Commit or roll back promptly; make sure client tools do not leave transactions open (autocommit off with no commit).','A `VACUUM` cannot run inside a transaction block, and DDL waits until a vacuum finishes with the table.','Catalog (`pg_`) tables use read committed behavior, so object lists can change within a transaction: a table you listed can disappear before you query it.']},
{note:'Most "mystery waits" in a warehouse are an idle transaction somebody forgot to commit. Check svv_transactions before you blame the engine.'}],
src:[['Isolation levels in Amazon Redshift',DG+'c_serial_isolation.html'],['LOCK',DG+'r_LOCK.html'],['Managing concurrent write operations',DG+'c_Concurrent_writes.html']]};

/* ================= ADDITIONAL 11 ================= */
L['rs:7:11']={blocks:[
{p:'Some query shapes are slow on any warehouse. This lecture lists the common ones, with the rewrite for each. They come from AWS best practices for designing queries and from what the plan and system views show.'},
{t:[['Anti-pattern','Why it hurts','Rewrite'],
['`SELECT *`','Reads every column, so columnar storage helps nothing; large result sets and memory use','Select only the columns you need'],
['Cross join or missing join condition','Cartesian product, run as the slowest nested loop','Add a join condition; check plans for `XN Nested Loop`'],
['Function on a filter column: `WHERE UPPER(name) = ...`, `WHERE DATE(ts) = ...`','Defeats sort key block skipping and drives up cost','Compare the raw column to a range: `WHERE ts >= \'2026-10-01\' AND ts < \'2026-10-02\'`'],
['No filter on the sort key','Scans every block of the participating columns','Add a predicate on the leading sort key column'],
['Filter on only one side of a join','The other table is scanned in full','Add the predicate to **both** tables, even when it repeats a join filter, so each is filtered before its scan'],
['Many selects from the same table for different conditions','Repeated scans','One scan with `CASE` expressions inside the aggregates'],
['Joining a table only to filter by it','Unneeded join and data movement','If the subquery returns under about 200 rows use `WHERE col IN (SELECT ...)`'],
['`SIMILAR TO` and regex when `LIKE` or `=` would do','More expensive operators','Prefer `=`, then `LIKE`, then `SIMILAR TO` and POSIX'],
['`GROUP BY b, c, a` with `ORDER BY a, b, c`','Extra sort','Use the same column order in both'],
['Returning millions of rows to a client','Slow RETURN step and client memory','Aggregate, filter, or `UNLOAD` to S3'],
['Huge sorts, hash joins and `DISTINCT` on wide data','Spill to disk','Filter first, select fewer columns, pre-aggregate, split into temp tables'],
['Many tiny `INSERT`s and `UPDATE`s','Many small blocks and ghost rows','Batch with `COPY`, `MERGE`, or CTAS'],
['Stale statistics','Poor join order and movement','`ANALYZE`; check `stats_off`']]},
{h:'Rewrites in code'},
{code:`-- Bad: function on the filter column hides the sort key
SELECT SUM(amount) FROM fact_sales WHERE DATE_TRUNC('month', sale_ts) = '2026-10-01';
-- Good: range on the raw column
SELECT SUM(amount) FROM fact_sales
WHERE sale_ts >= '2026-10-01' AND sale_ts < '2026-11-01';

-- Bad: three scans
SELECT COUNT(*) FROM orders WHERE status = 'new';
SELECT COUNT(*) FROM orders WHERE status = 'paid';
SELECT COUNT(*) FROM orders WHERE status = 'shipped';
-- Good: one scan
SELECT SUM(CASE WHEN status = 'new'     THEN 1 ELSE 0 END) AS new_orders,
       SUM(CASE WHEN status = 'paid'    THEN 1 ELSE 0 END) AS paid_orders,
       SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) AS shipped_orders
FROM   orders;

-- Filter both tables of a join
SELECT l.sellerid, SUM(s.qtysold)
FROM   sales s JOIN listing l ON s.salesid = l.listid
WHERE  l.listtime > '2008-12-01' AND s.saletime > '2008-12-01'
GROUP  BY 1;

-- Break a spilling query into steps
CREATE TEMP TABLE step1 AS
SELECT customer_id, SUM(amount) AS total FROM fact_sales WHERE sale_date >= '2026-01-01' GROUP BY 1;
ANALYZE step1;
SELECT c.name, s.total FROM step1 s JOIN dim_customer c USING (customer_id) ORDER BY s.total DESC LIMIT 100;`},
{h:'Spotting them'},
{ul:['**Nested loop**: `EXPLAIN` shows `XN Nested Loop`.','**Spill**: non-zero `spilled_block_local_disk` or `spilled_block_remote_disk` in `SYS_QUERY_DETAIL`.','**Large result**: a big `output_rows` on the `return` step.','**Unfiltered scan**: a `scan` step whose `input_rows` is close to the whole table size while `output_rows` is small.']},
{h:'Guardrails'},
{ul:['Set a `statement_timeout` so a runaway query is stopped.','Use query monitoring rules (Section 9) to log or stop queries that spill heavily, run too long or return too many rows.','Teach analysts the top five rules: columns not `*`, filter on the sort key, no functions on filter columns, no cross joins, and `LIMIT` while exploring.']},
{note:'Review the ten slowest queries each week (Section 8 maintenance practical). Most of them will match a row in the table above.'}],
src:[['Best practices for designing queries',DG+'c_designing-queries-best-practices.html'],['Query performance improvement',DG+'query-performance-improvement-opportunities.html'],['Creating and interpreting a query plan',DG+'c-the-query-plan.html']]};
})();
