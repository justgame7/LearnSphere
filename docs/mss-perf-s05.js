/* LearnSphere - SQL Server Performance & Tuning, Section 05: Statistics & the Optimizer.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const parts=M.dg(700,200,[
[10,15,680,170,'One statistics object',1],
[30,55,190,60,'Header|rows, last updated,|rows sampled',0],[245,55,190,60,'Density vector|how selective the|column(s) are',0],[460,55,210,60,'Histogram|up to 200 steps of|values and row counts',2],
[30,130,640,45,'The optimizer reads these to estimate how many rows each operator returns',0]],
[]);

const thr=M.dg(700,160,[
[10,25,200,70,'Row changes|inserts, updates,|deletes counted',0],[250,25,200,70,'Threshold reached|sqrt(1000 x rows)|at compat 130 and up',2],[490,25,200,70,'Statistics updated|before next compile|or asynchronously',0],
[10,115,680,35,'Legacy rule: 500 rows plus 20 percent. Large tables waited too long.',0]],
[[210,60,250,60],[450,60,490,60]]);

const ce=M.dg(700,170,[
[10,20,200,70,'Legacy CE|compat 110 and lower|simple assumptions',0],[250,20,200,70,'New CE|compat 120 and higher|more modern model',2],[490,20,200,70,'Choose per database|or per query with a hint',0],
[10,110,680,45,'Version of the estimator follows the database compatibility level',0]],
[[210,55,250,55],[450,55,490,55]]);

const sniff=M.dg(700,190,[
[10,20,150,60,'First call|@CustomerID = 7|10 rows',0],[190,20,170,60,'Plan compiled|and cached|for 10 rows',2],[390,20,150,60,'Later call|@CustomerID = 1|2 million rows',0],[570,20,120,60,'Same plan|slow',2],
[10,110,680,65,'The plan fits the first parameter values, not all of them. Skewed data makes this visible.',0]],
[[160,50,190,50],[360,50,390,50],[540,50,570,50]]);

const bloat=M.dg(700,170,[
[10,25,200,70,'Ad hoc queries|literals differ each time|SELECT ... WHERE ID = 1',0],[250,25,200,70,'One plan per text|thousands of single-use|plans in cache',2],[490,25,200,70,'Fix|parameterize in code,|forced parameterization,|ad hoc workloads option',0]],
[[210,60,250,60],[450,60,490,60]]);

/* ---------- 0: How statistics work ---------- */
L['mss-perf:4:0']={blocks:[
{p:'**Statistics** are small summaries of how data is distributed in a column or index. The optimizer uses them to **estimate row counts**, and row estimates drive nearly every plan decision.'},
{svg:parts},
{code:`-- See a statistics object
DBCC SHOW_STATISTICS ('sales.Orders', 'IX_Orders_Customer');

-- Statistics on a table
SELECT s.name, s.auto_created, s.user_created, sp.last_updated, sp.rows, sp.rows_sampled
FROM   sys.stats s
CROSS  APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE  s.object_id = OBJECT_ID('sales.Orders');`},
{h:'Where they come from'},
{t:[['Source','Notes'],
['**Index statistics**','Created with every index, with the index key as leading column'],
['**Auto-created column statistics**','`_WA_Sys_...` names, created when a query filters on an unindexed column'],
['**User-created**','`CREATE STATISTICS`, for example multi-column statistics']]},
{note:'The histogram has a maximum of 200 steps. For columns with many distinct values and skewed data, estimates can still be rough. That is when sampling and filtered statistics help.'}],
src:[['Statistics',M.RD+'statistics/statistics'],['DBCC SHOW_STATISTICS',M.TS+'database-console-commands/dbcc-show-statistics-transact-sql']]};

/* ---------- 1: Auto update and manual ---------- */
L['mss-perf:4:1']={blocks:[
{p:'Statistics become stale as data changes. SQL Server updates them **automatically** when enough rows have changed, but you must know the rule and when to step in.'},
{svg:thr},
{t:[['Setting','Effect','Recommended'],
['`AUTO_CREATE_STATISTICS`','Create column statistics when needed','ON'],
['`AUTO_UPDATE_STATISTICS`','Update when the threshold is reached','ON'],
['`AUTO_UPDATE_STATISTICS_ASYNC`','Do not make the query wait for the update','Consider for OLTP'],
['`PERSIST_SAMPLE_PERCENT`','Keep a chosen sample rate on updates','For large, skewed tables']]},
{code:`-- Full scan for a critical statistic
UPDATE STATISTICS sales.Orders IX_Orders_Customer WITH FULLSCAN;

-- Remember the sample percent
UPDATE STATISTICS sales.Orders IX_Orders_Customer WITH SAMPLE 30 PERCENT, PERSIST_SAMPLE_PERCENT = ON;

-- Whole database, quick
EXEC sp_updatestats;`},
{h:'When to update manually'},
{ul:['After a **large load or purge**, before the first report runs.','On **very large tables** where the automatic threshold is still too high.','When **ascending keys** (dates, identities) make the newest rows invisible to the histogram.','As a **test**: if updating statistics fixes a slow query, estimates were the cause.']},
{note:'Updating statistics invalidates cached plans that use them. On a busy server, do it off-peak, or only for the objects that need it.'}],
src:[['Statistics: when to update',M.RD+'statistics/statistics'],['UPDATE STATISTICS',M.TS+'statements/update-statistics-transact-sql']]};

/* ---------- 2: CE versions ---------- */
L['mss-perf:4:2']={blocks:[
{p:'The **cardinality estimator (CE)** is the part of the optimizer that turns statistics into row estimates. The model changed in SQL Server 2014, and again with newer features. The version in use follows the **database compatibility level**.'},
{svg:ce},
{t:[['Compatibility level','CE model'],
['110 and lower','Legacy CE'],
['120 and higher','New CE (with refinements in later levels)']]},
{h:'What changed'},
{ul:['Different **assumptions about correlation** between columns in multiple predicates.','Different handling of **ascending key** data beyond the histogram.','Different estimates for **joins** and **filter selectivity**.']},
{code:`-- Use the old estimator for a whole database
ALTER DATABASE SCOPED CONFIGURATION SET LEGACY_CARDINALITY_ESTIMATION = ON;

-- Or for one query
SELECT * FROM sales.Orders WHERE CustomerID = 7
OPTION (USE HINT('FORCE_LEGACY_CARDINALITY_ESTIMATION'));

-- Which CE a cached plan used (in the plan XML)
-- CardinalityEstimationModelVersion="160"`},
{note:'The new estimator is better for most workloads. When a query regresses after an upgrade, switch the single query to the legacy estimator or force a plan in Query Store, not the whole instance.'}],
src:[['Cardinality estimation',M.RD+'performance/cardinality-estimation-sql-server'],['Query hints: USE HINT',M.TS+'queries/hints-transact-sql-query']]};

/* ---------- 3: Parameter sniffing ---------- */
L['mss-perf:4:3']={blocks:[
{p:'**Parameter sniffing** means SQL Server builds a plan using the **parameter values of the first call** and then reuses it. It is normal and usually good. It becomes a problem when data is **skewed**.'},
{svg:sniff},
{h:'How to recognize it'},
{ul:['A stored procedure is fast for some parameters and slow for others.','**Recompiling** or clearing its plan fixes it, for a while.','In the actual plan, **Parameter Compiled Value** differs from **Runtime Value**.','Query Store shows **several plans** for one query.']},
{h:'Fixes, from light to heavy'},
{t:[['Fix','Use'],
['`OPTION (RECOMPILE)`','Small, rarely run, or very skewed queries'],
['`OPTIMIZE FOR (@p = value)`','One typical value is good for most calls'],
['`OPTIMIZE FOR UNKNOWN`','Average estimate instead of a specific value'],
['**Split the procedure**','Different code paths for small and large cases'],
['**Better indexes or statistics**','Makes either plan acceptable'],
['**Query Store hints or forced plan**','Change behavior without editing code'],
['**PSP optimization**','SQL Server 2022 at compatibility level 160 can keep several plans per query']]},
{code:`CREATE OR ALTER PROCEDURE sales.GetOrders @CustomerID int AS
SELECT OrderID, OrderDate, TotalDue
FROM   sales.Orders WHERE CustomerID = @CustomerID
OPTION (RECOMPILE);`},
{note:'Do not clear the whole plan cache to fix one query. It makes every query recompile at once and can overload the server.'}],
src:[['Parameter sensitive plan optimization',M.RD+'performance/parameter-sensitive-plan-optimization'],['Troubleshoot parameter sensitivity','https://learn.microsoft.com/en-us/sql/relational-databases/performance/intelligent-query-processing-details']]};

/* ---------- 4: Plan cache bloat ---------- */
L['mss-perf:4:4']={blocks:[
{p:'Every different query text can create its own cached plan. If an application sends **literals** instead of parameters, the plan cache fills with plans used once.'},
{svg:bloat},
{code:`-- How much of the cache is single-use plans?
SELECT objtype, COUNT(*) AS plans, SUM(size_in_bytes)/1048576 AS mb,
       SUM(CASE WHEN usecounts = 1 THEN 1 ELSE 0 END) AS single_use
FROM   sys.dm_exec_cached_plans
GROUP  BY objtype
ORDER  BY mb DESC;`},
{h:'Options, in order'},
{t:[['Option','Effect'],
['**Parameterize in the application**','The real fix: one plan per query shape'],
['**optimize for ad hoc workloads**','Stores only a small stub on first use'],
['**PARAMETERIZATION FORCED**','Database option: auto-parameterizes literals'],
['**Query Store capture mode AUTO**','Avoids filling Query Store with one-off statements']]},
{code:`EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'optimize for ad hoc workloads', 1; RECONFIGURE;

ALTER DATABASE SalesDB SET PARAMETERIZATION FORCED;`},
{note:'Forced parameterization changes how plans are shared and can create parameter sniffing issues. Test it on a copy of the workload before turning it on in production.'}],
src:[['Plan cache and ad hoc workloads',M.DE+'configure-windows/optimize-for-ad-hoc-workloads-server-configuration-option'],['Forced parameterization',M.RD+'query-processing-architecture-guide']]};

})();
