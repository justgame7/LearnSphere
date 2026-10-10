/* LearnSphere - Performance, Section 04: Optimizer Fundamentals & Statistics.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const TG=O.D+'tgsql/';

/* ---------- diagrams ---------- */
const opt=O.dg(700,190,[
[10,40,130,90,'SQL text|+ binds',0],
[180,40,130,90,'Parser|syntax, privileges',0],
[350,25,150,120,'Optimizer|transforms,|estimates cost,|picks a plan',2],
[540,10,150,60,'Statistics',0],[540,110,150,60,'Parameters,|system stats',0]],
[[140,85,180,85],[310,85,350,85],[540,40,500,70],[540,140,500,110]]);

/* ---------- 0: How the CBO works ---------- */
L['ora-perf:3:0']={blocks:[
{p:'The **cost-based optimizer (CBO)** chooses an execution plan for each SQL. It estimates the **cost** of many possible plans and picks the cheapest.'},
{svg:opt},
{t:[['Input','Role'],
['**Object statistics**','Row counts, distinct values, data distribution, index depth'],
['**System statistics**','CPU speed and I/O speed of this host'],
['**Parameters**','`OPTIMIZER_MODE`, `OPTIMIZER_FEATURES_ENABLE`, and others'],
['**Bind values**','Used for estimates when peeked'],
['**Hints and baselines**','Instructions that limit its choices']]},
{h:'Key idea'},
{p:'The plan is only as good as the **estimates**. Wrong cardinality (number of rows) is the root of most bad plans. Wrong estimates come from missing or stale statistics, correlated columns, or functions on columns.'},
{flow:['SQL arrives','Optimizer estimates rows at every step','Cost of each plan is computed','Cheapest plan is stored in the shared pool','Executions reuse it']},
{note:'When a plan is bad, ask first "were the estimated rows close to the actual rows?". The answer points you to statistics or SQL design.'}],
src:[['SQL Tuning Guide',TG]]};

/* ---------- 1: Statistics ---------- */
L['ora-perf:3:1']={blocks:[
{p:'Optimizer statistics describe your **data**. The optimizer cannot see the data, only these numbers.'},
{t:[['Level','Examples','Dictionary view'],
['**Table**','Number of rows, blocks, average row length','`DBA_TAB_STATISTICS`'],
['**Column**','Number of distinct values, nulls, low and high value, histogram','`DBA_TAB_COL_STATISTICS`'],
['**Index**','Depth, leaf blocks, distinct keys, clustering factor','`DBA_IND_STATISTICS`'],
['**Partition**','The same, per partition and global','Same views with partition columns'],
['**System**','CPU and I/O performance','`SYS.AUX_STATS$`']]},
{code:`SELECT table_name, num_rows, blocks, last_analyzed, stale_stats
FROM dba_tab_statistics WHERE owner=\'APP\' AND table_name=\'ORDERS\';

SELECT column_name, num_distinct, num_nulls, histogram
FROM dba_tab_col_statistics WHERE owner=\'APP\' AND table_name=\'ORDERS\';`},
{h:'Clustering factor'},
{p:'For an index, the **clustering factor** says how scattered the table rows are compared with the index order. A value near the number of blocks is good. A value near the number of rows makes index range scans expensive.'},
{note:'Old statistics make wrong plans. A table that doubled in size but still says 10 rows will get a nested loop where a hash join was needed.'}],
src:[['Optimizer statistics',TG]]};

/* ---------- 2: Gathering ---------- */
L['ora-perf:3:2']={blocks:[
{p:'Use `DBMS_STATS`, never `ANALYZE`, to gather statistics. Oracle also gathers them automatically in a maintenance window.'},
{code:`-- one table, let Oracle decide sample and histograms
EXEC DBMS_STATS.GATHER_TABLE_STATS(\'APP\',\'ORDERS\');

-- a schema
EXEC DBMS_STATS.GATHER_SCHEMA_STATS(\'APP\', options=>\'GATHER AUTO\');

-- show defaults
SELECT DBMS_STATS.GET_PREFS(\'ESTIMATE_PERCENT\') FROM dual;
SELECT DBMS_STATS.GET_PREFS(\'METHOD_OPT\') FROM dual;

-- automatic job status
SELECT client_name, status FROM dba_autotask_client;`},
{t:[['Setting','Recommendation'],
['`ESTIMATE_PERCENT`','`AUTO_SAMPLE_SIZE` (default). Accurate and fast.'],
['`METHOD_OPT`','`FOR ALL COLUMNS SIZE AUTO` (default) lets Oracle choose histograms'],
['`DEGREE`','Parallel gather on large tables'],
['`CASCADE`','Include indexes (default AUTO)'],
['`INCREMENTAL`','For partitioned tables, gather only changed partitions']]},
{h:'When to gather by hand'},
{ul:['After a large load, in a batch window, before the first query.','After creating a table that is queried at once.','For global temporary tables, set session statistics.']},
{note:'Do not gather every night "just in case". It invalidates cursors and may change good plans. Gather when the data changed enough.'}],
src:[['Gathering statistics',TG]]};

/* ---------- 3: Histograms and extended ---------- */
L['ora-perf:3:3']={blocks:[
{p:'Two tools help the optimizer with **skewed** and **correlated** data.'},
{t:[['','Histogram','Extended statistics'],
['**Problem**','Values are not evenly distributed: 90% of orders are status ACTIVE','Two columns are related: city and zip code'],
['**What it stores**','Distribution of values in buckets','Statistics on a column group or an expression'],
['**Benefit**','Better row estimates for skewed predicates','Better estimates for combined predicates'],
['**Types**','Frequency, height-balanced (older), top-frequency, hybrid','Column group, expression']]},
{code:`-- column group
SELECT DBMS_STATS.CREATE_EXTENDED_STATS(\'APP\',\'CUSTOMERS\',\'(CITY,ZIP)\') FROM dual;
EXEC DBMS_STATS.GATHER_TABLE_STATS(\'APP\',\'CUSTOMERS\');

-- expression
SELECT DBMS_STATS.CREATE_EXTENDED_STATS(\'APP\',\'CUSTOMERS\',\'(UPPER(LAST_NAME))\') FROM dual;

-- see them
SELECT * FROM dba_stat_extensions WHERE owner=\'APP\';`},
{note:'Histograms are created automatically from column usage. Add extended statistics only when a plan shows a bad estimate that is explained by a correlation.'}],
src:[['Histograms and extended statistics',TG]]};

/* ---------- 4: Pending, locked, restored ---------- */
L['ora-perf:3:4']={blocks:[
{p:'Three controls make statistics safer.'},
{t:[['Feature','What it does','Example'],
['**Locked statistics**','Prevent gathering for a table. Good for stable data or special values.','`EXEC DBMS_STATS.LOCK_TABLE_STATS(\'APP\',\'ORDERS\');`'],
['**Pending statistics**','New statistics stay unpublished. You test them with a session setting, then publish.','`ALTER SESSION SET optimizer_use_pending_statistics=TRUE;`'],
['**Restore statistics**','Go back to an older version if new statistics made plans worse','`EXEC DBMS_STATS.RESTORE_TABLE_STATS(\'APP\',\'ORDERS\', SYSTIMESTAMP-1);`']]},
{code:`-- pending workflow
EXEC DBMS_STATS.SET_TABLE_PREFS(\'APP\',\'ORDERS\',\'PUBLISH\',\'FALSE\');
EXEC DBMS_STATS.GATHER_TABLE_STATS(\'APP\',\'ORDERS\');
ALTER SESSION SET optimizer_use_pending_statistics=TRUE;
-- test queries here
EXEC DBMS_STATS.PUBLISH_PENDING_STATS(\'APP\',\'ORDERS\');`},
{flow:['Gather as pending','Test critical SQL with pending statistics','Publish if plans are good','Restore if something regressed']},
{note:'History is kept for 31 days by default (`DBMS_STATS.GET_STATS_HISTORY_RETENTION`). That is your safety net.'}],
src:[['Managing statistics',TG]]};

/* ---------- 5: System stats and parameters ---------- */
L['ora-perf:3:5']={blocks:[
{p:'Beyond object statistics, the optimizer uses **system statistics** and a small group of **parameters**.'},
{t:[['Item','What it affects','Notes'],
['**System statistics**','Relative cost of CPU, single-block and multiblock reads','Default noworkload values often fine. Gather with a real workload on dedicated systems.'],
['`OPTIMIZER_MODE`','ALL_ROWS (throughput) or FIRST_ROWS_n (quick first rows)','Default ALL_ROWS'],
['`OPTIMIZER_FEATURES_ENABLE`','Which optimizer version behavior is used','Used to freeze plans during upgrades'],
['`OPTIMIZER_ADAPTIVE_STATISTICS`','Dynamic statistics and SQL plan directives','Off by default since 12.2'],
['`CURSOR_SHARING`','Replace literals with binds','Prefer binds in the application'],
['`DB_FILE_MULTIBLOCK_READ_COUNT`','Cost of full scans','Leave unset so Oracle self-tunes']]},
{code:`EXEC DBMS_STATS.GATHER_SYSTEM_STATS(\'START\');
-- run a typical workload
EXEC DBMS_STATS.GATHER_SYSTEM_STATS(\'STOP\');
SELECT pname, pval1 FROM sys.aux_stats$ WHERE sname=\'SYSSTATS_MAIN\';`},
{note:'Change parameters at **session** level first and test. A system-wide parameter changes every plan in the database.'}],
src:[['Optimizer environment',TG]]};

/* ---------- 6: Practical ---------- */
L['ora-perf:3:6']={blocks:[
{p:'Fix a **bad plan** with better statistics.'},
{code:`CREATE TABLE app.t_status AS
SELECT level id, CASE WHEN level <= 10 THEN \'RARE\' ELSE \'COMMON\' END status, RPAD(\'x\',100,\'x\') pad
FROM dual CONNECT BY level <= 200000;
CREATE INDEX app.t_status_ix ON app.t_status(status);

-- 1. wrong statistics: tell the optimizer the table is tiny
EXEC DBMS_STATS.SET_TABLE_STATS(\'APP\',\'T_STATUS\', numrows=>100, numblks=>5);

EXPLAIN PLAN FOR SELECT * FROM app.t_status WHERE status=\'COMMON\';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- 2. correct statistics with a histogram
EXEC DBMS_STATS.GATHER_TABLE_STATS(\'APP\',\'T_STATUS\', method_opt=>\'FOR COLUMNS STATUS SIZE 254\');
EXPLAIN PLAN FOR SELECT * FROM app.t_status WHERE status=\'COMMON\';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

EXPLAIN PLAN FOR SELECT * FROM app.t_status WHERE status=\'RARE\';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);`},
{h:'Check your result'},
{t:[['Query','Plan after good statistics'],
['status = COMMON','Full table scan (almost all rows)'],
['status = RARE','Index range scan (few rows)'],
['Estimated rows','Close to the real counts']]},
{note:'The SQL did not change. The data description did. This is the most common, cheapest fix in tuning.'}],
src:[['Optimizer statistics',TG]]};

})();
