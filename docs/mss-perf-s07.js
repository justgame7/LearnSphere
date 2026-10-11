/* LearnSphere - SQL Server Performance & Tuning, Section 07: Intelligent Query Processing.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const lvl=M.dg(700,200,[
[10,20,130,60,'130|SQL Server 2016',0],[160,20,130,60,'140|SQL Server 2017|adaptive joins',0],[310,20,130,60,'150|SQL Server 2019|batch mode rowstore',2],[460,20,130,60,'160|SQL Server 2022|PSP, feedback',2],[610,20,80,60,'170|2025',0],
[10,110,680,70,'Raising the level turns on that version optimizer behaviors.|No code change is needed, which is also why plans can change.',0]],
[[140,50,160,50],[290,50,310,50],[440,50,460,50],[590,50,610,50]]);

const adp=M.dg(700,170,[
[10,25,160,70,'Adaptive join|decides at run time|after the build input',2],[210,25,150,70,'Few rows|use Nested Loops',0],[400,25,150,70,'Many rows|use Hash Match',0],[590,25,100,70,'Memory grant|feedback adjusts|next run',0],
[10,115,680,40,'Starts from compatibility level 140 (batch mode) and 150 (row mode feedback)',0]],
[[170,50,210,50],[170,70,400,70],[550,60,590,60]]);

const bm=M.dg(700,150,[
[10,25,200,70,'Row mode|one row at a time|older engine',0],[250,25,200,70,'Batch mode|about 900 rows at a time|less CPU',2],[490,25,200,70,'Rowstore tables too|from compat level 150|no columnstore needed',0]],
[[210,60,250,60],[450,60,490,60]]);

const tv=M.dg(700,150,[
[10,25,200,70,'Before 150|table variable|estimated at 1 row',0],[250,25,200,70,'Compat 150|actual row count|used at first compile',2],[490,25,200,70,'Better join|and memory grant|choices',0]],
[[210,60,250,60],[450,60,490,60]]);

const upg=M.dg(700,190,[
[10,20,120,70,'1. Restore at|old compat level',0],[150,20,120,70,'2. Enable|Query Store,|baseline',2],[290,20,120,70,'3. Raise|compat level|in test',0],[430,20,120,70,'4. Compare|force old plans|where needed',2],[570,20,120,70,'5. Raise in|production',0],
[10,115,680,60,'Keep the old level as a rollback: ALTER DATABASE ... SET COMPATIBILITY_LEVEL = old value',0]],
[[130,55,150,55],[270,55,290,55],[410,55,430,55],[550,55,570,55]]);

/* ---------- 0: Compat levels ---------- */
L['mss-perf:6:0']={blocks:[
{p:'**Intelligent Query Processing (IQP)** is a family of features that improve plans without code changes. Most are switched on by the **database compatibility level**.'},
{svg:lvl},
{t:[['Level','IQP features (examples)'],
['**140**','Batch mode adaptive joins, batch mode memory grant feedback, interleaved execution'],
['**150**','Batch mode on rowstore, row mode memory grant feedback, table variable deferred compilation, scalar UDF inlining'],
['**160**','Parameter-sensitive plan optimization, DOP feedback, CE feedback, memory grant persistence'],
['**170**','SQL Server 2025 additions: check the release notes']]},
{code:`SELECT name, compatibility_level FROM sys.databases;

ALTER DATABASE SalesDB SET COMPATIBILITY_LEVEL = 160;

-- Individual features can be turned off without lowering the level
ALTER DATABASE SCOPED CONFIGURATION SET BATCH_MODE_ON_ROWSTORE = OFF;`},
{note:'Compatibility level changes behavior. Always test and compare with Query Store before you raise it in production.'}],
src:[['Intelligent query processing',M.RD+'performance/intelligent-query-processing'],['ALTER DATABASE compatibility level',M.TS+'statements/alter-database-transact-sql-compatibility-level']]};

/* ---------- 1: Adaptive joins and feedback ---------- */
L['mss-perf:6:1']={blocks:[
{p:'Two IQP features fix a very common weakness: a plan built on **wrong row estimates**.'},
{svg:adp},
{h:'Adaptive join'},
{p:'The optimizer prepares **both** a nested loops and a hash join and chooses at **run time**, after it sees how many rows arrive from the first input. It removes the need to guess for queries with highly variable input sizes.'},
{h:'Memory grant feedback'},
{p:'After a query runs, SQL Server compares the **granted** memory with what was **used**. On the next execution it **adjusts** the grant: smaller if wasted, larger if the query spilled.'},
{t:[['Problem','What feedback does'],
['Grant too large','Reduces it, so more queries fit in memory'],
['Grant too small, spill to tempdb','Increases it for the next run'],
['Variable parameters','Stops adjusting if the grant keeps swinging']]},
{note:'Feedback needs a few executions to settle. In SQL Server 2022, grants can also be remembered in Query Store (persistence) across restarts.'}],
src:[['Intelligent query processing: adaptive joins',M.RD+'performance/intelligent-query-processing-adaptive-joins'],['Memory grant feedback',M.RD+'performance/intelligent-query-processing-memory-grant-feedback']]};

/* ---------- 2: Batch mode on rowstore ---------- */
L['mss-perf:6:2']={blocks:[
{p:'Batch mode processes rows in groups, which uses far less CPU for analytical queries. Before SQL Server 2019 it required a columnstore index. At compatibility level **150**, SQL Server can use it on **ordinary rowstore** tables.'},
{svg:bm},
{h:'When it is used'},
{ul:['The optimizer chooses it with **heuristics**: large tables, aggregates, joins and window functions.','It helps **reporting** queries on OLTP tables, with no new index and no code change.','It does not help **small** or point-lookup queries.']},
{code:`-- Is batch mode in the plan? Look for operators with "Batch" execution mode in the actual plan.

-- Turn it off for the database if a regression appears
ALTER DATABASE SCOPED CONFIGURATION SET BATCH_MODE_ON_ROWSTORE = OFF;

-- Or for one query
SELECT ... OPTION (USE HINT('DISALLOW_BATCH_MODE'));`},
{note:'Available in Enterprise and Standard editions in SQL Server 2019 and later with limits. Check the edition feature table for your version.'}],
src:[['Batch mode on rowstore',M.RD+'performance/intelligent-query-processing-batch-mode-rowstore'],['Query processing architecture guide',M.RD+'query-processing-architecture-guide']]};

/* ---------- 3: Table variable deferred compilation ---------- */
L['mss-perf:6:3']={blocks:[
{p:'Table variables used to be estimated at **one row**, which caused bad join and memory choices when they held thousands of rows. **Table variable deferred compilation** fixes this at compatibility level **150**.'},
{svg:tv},
{code:`DECLARE @Ids TABLE (ID int PRIMARY KEY);
INSERT @Ids SELECT OrderID FROM sales.Orders WHERE OrderDate >= '2026-01-01';

SELECT o.*
FROM   sales.Orders o
JOIN   @Ids i ON i.ID = o.OrderID;   -- estimated rows now match actual rows`},
{h:'Also at level 150'},
{ul:['**Scalar UDF inlining**: simple scalar functions are turned into expressions, and run set-based instead of row by row.','**Approximate COUNT DISTINCT**: `APPROX_COUNT_DISTINCT` for fast large counts with small error.']},
{h:'Notes'},
{ul:['The estimate is taken from the **first** compile. A later call with a very different row count may still get an inaccurate estimate.','For heavy use, **temp tables** have full statistics and are often better than table variables.']}],
src:[['Table variable deferred compilation',M.RD+'performance/intelligent-query-processing-table-variable-deferred-compilation'],['Scalar UDF inlining',M.RD+'user-defined-functions/scalar-udf-inlining']]};

/* ---------- 4: Upgrading compat levels safely ---------- */
L['mss-perf:6:4']={blocks:[
{p:'Raising the compatibility level is the main source of **post-upgrade plan regressions**. A careful process keeps the benefits and limits the surprises.'},
{svg:upg},
{flow:['Upgrade the engine but keep the **old** compatibility level','Turn on **Query Store** and let it capture a representative workload','Raise the level in a **test copy** and run the same workload','Compare queries in Query Store, **force** the old plan for regressions','Raise the level in **production** and watch','Fix causes, then **unforce** plans']},
{code:`-- Quick rollback of behavior if needed
ALTER DATABASE SalesDB SET COMPATIBILITY_LEVEL = 150;

-- Use legacy estimator while you investigate a regression
ALTER DATABASE SCOPED CONFIGURATION SET LEGACY_CARDINALITY_ESTIMATION = ON;`},
{t:[['Tool','Use'],
['**Query Store**','Compare before and after, force plans'],
['**Database Experimentation Assistant**','Replay a captured workload on old and new versions'],
['**Query Tuning Assistant**','Guided workflow for regressions in SSMS']]},
{note:'Do the compatibility level change separately from the engine upgrade, so you know which change caused a difference.'}],
src:[['Keep performance stability during the upgrade',M.RD+'performance/query-store-usage-scenarios'],['Query Tuning Assistant',M.SQL+'relational-databases/performance/upgrade-dbcompat-using-qta']]};

})();
