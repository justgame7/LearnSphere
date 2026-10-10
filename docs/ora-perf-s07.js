/* LearnSphere - Performance, Section 07: Indexing, Partitioning & Access Structures.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const TG=O.D+'tgsql/';

/* ---------- diagrams ---------- */
const prune=O.dg(700,190,[
[10,30,160,110,'ORDERS|partitioned by month',2],
[230,10,110,40,'Jan',0],[230,60,110,40,'Feb',0],[230,110,110,40,'Mar (read)',2],[230,160,110,25,'...',0],
[420,50,270,80,'WHERE order_date in March|reads only the March partition|(partition pruning)',0]],
[[170,85,230,130],[340,130,420,100]]);

/* ---------- 0: Index types ---------- */
L['ora-perf:6:0']={blocks:[
{p:'An index trades **space and write cost** for **faster reads**. Choose the type by the data and the queries.'},
{t:[['Type','Best for','Avoid when'],
['**B-tree** (default)','High-cardinality columns, equality and range predicates','Very low cardinality'],
['**Composite B-tree**','Queries filtering on several columns','Wrong column order'],
['**Unique / primary key**','Enforce uniqueness and fast lookup','—'],
['**Bitmap**','Low-cardinality columns in warehouses, ad hoc combinations','OLTP with concurrent DML (locks many rows)'],
['**Function-based**','`WHERE UPPER(name)=...`','The function is not used in the queries'],
['**Reverse key**','Reduce right-hand index hot spots on sequences','Range scans needed'],
['**Descending**','Order by descending on that column','—'],
['**Local / global partitioned**','Partitioned tables','—']]},
{h:'Composite index rule'},
{p:'Put the column used in **equality** filters first, then range. An index on `(cust_id, order_date)` serves `cust_id=5` and `cust_id=5 AND order_date > ...`, but not `order_date > ...` alone (except via skip scan).'},
{code:`CREATE INDEX app.orders_cust_date_ix ON app.orders(cust_id, order_date);
CREATE INDEX app.cust_upper_name_ix ON app.customers(UPPER(last_name));`},
{note:'More indexes is not better. Each one slows every `INSERT`, `UPDATE` of its columns and `DELETE`.'}],
src:[['Indexes',O.D+'cncpt/']]};

/* ---------- 1: Index maintenance ---------- */
L['ora-perf:6:1']={blocks:[
{p:'Indexes need a little care: find the unused, test the risky, and rebuild only when it helps.'},
{t:[['Task','How'],
['**Find unused indexes**','`DBA_INDEX_USAGE` (12.2+), or monitoring in earlier releases'],
['**Test removing an index**','Make it **invisible**: `ALTER INDEX ix INVISIBLE;`'],
['**Test adding an index**','Create it invisible, then set `OPTIMIZER_USE_INVISIBLE_INDEXES=TRUE` for a session'],
['**Rebuild online**','`ALTER INDEX ix REBUILD ONLINE;`'],
['**Coalesce**','`ALTER INDEX ix COALESCE;` merges leaf blocks cheaply']]},
{code:`SELECT name, total_access_count, last_used FROM dba_index_usage WHERE owner=\'APP\' ORDER BY total_access_count;

ALTER INDEX app.orders_old_ix INVISIBLE;
-- watch performance for a few days, then
DROP INDEX app.orders_old_ix;`},
{h:'About rebuilding'},
{ul:['Regular rebuilds are **not** needed for B-tree indexes in normal use.','Rebuild after massive deletes, or to move it, or to change storage.','Measure benefit with a query, not by index "height" rules.']},
{note:'Invisible indexes are a safe experiment: DML still maintains them, but the optimizer ignores them. Dropping is instant to undo.'}],
src:[['Managing indexes',O.AD]]};

/* ---------- 2: Partitioning ---------- */
L['ora-perf:6:2']={blocks:[
{p:'**Partitioning** splits a large table into pieces. Queries read only the pieces they need (**pruning**), and maintenance works per piece.'},
{svg:prune},
{t:[['Method','Splits by','Typical use'],
['**Range**','Ranges of a column (dates)','Time-based data'],
['**Interval**','Range that creates partitions automatically','Daily or monthly data without manual adds'],
['**List**','Specific values (region)','Known categories'],
['**Hash**','Hash of a column','Even spread, parallel joins'],
['**Composite**','Two levels (range-hash)','Large, mixed needs']]},
{code:`CREATE TABLE app.orders_p (
  id NUMBER, order_date DATE NOT NULL, cust_id NUMBER, total NUMBER)
PARTITION BY RANGE (order_date) INTERVAL (NUMTOYMINTERVAL(1,\'MONTH\'))
(PARTITION p_before VALUES LESS THAN (DATE \'2026-01-01\'));`},
{h:'Benefits'},
{ul:['**Pruning** for query speed.','**Maintenance:** drop or archive an old partition in seconds.','**Availability:** operations affect one partition.']},
{note:'Partitioning is a licensed option (Enterprise Edition). Check the Licensing guide. Choose the key so that most queries have a predicate on it.'}],
src:[['VLDB and Partitioning Guide',O.D+'vldbg/']]};

/* ---------- 3: Clustering, IOT ---------- */
L['ora-perf:6:3']={blocks:[
{p:'Beyond heap tables, Oracle offers other **table organizations** that store related rows close together.'},
{t:[['Organization','What it is','Good for','Watch out'],
['**Heap table** (default)','Rows anywhere there is space','General use','Random order'],
['**Index-organized table (IOT)**','Table stored in a B-tree by primary key','Lookups by key, small rows','Wide rows, secondary indexes cost more'],
['**Cluster**','Several tables sharing blocks by key','Always-joined tables (rare today)','Hard to change'],
['**Hash cluster**','Rows stored by hash of key','Lookups by exact key','Fixed size planning'],
['**Attribute clustering (12c+)**','Orders data physically by columns on load','Warehouse scans with pruning, zone maps','Needs direct-path loads'],
['**Temporary table**','Private data per session','Work data','Statistics handling']]},
{code:`CREATE TABLE app.codes (code VARCHAR2(10) PRIMARY KEY, descr VARCHAR2(100))
ORGANIZATION INDEX;`},
{note:'For most OLTP systems, heap tables with good indexes are right. Consider the alternatives only for well-understood access patterns.'}],
src:[['Table types',O.D+'cncpt/']]};

/* ---------- 4: In-Memory ---------- */
L['ora-perf:6:4']={blocks:[
{p:'**Oracle Database In-Memory** keeps a **columnar copy** of chosen tables in memory. Analytic queries (scans, aggregates, filters) run much faster. The row format and OLTP are unchanged.'},
{t:[['Aspect','Detail'],
['**Memory area**','`INMEMORY_SIZE` in the SGA (restart needed to size)'],
['**Which objects**','`ALTER TABLE t INMEMORY;` per table, partition or column'],
['**Population**','On first access or at startup, with `PRIORITY`'],
['**Compression**','`MEMCOMPRESS` levels'],
['**Best for**','Large scans, aggregations, selective filters on a few columns of wide tables'],
['**Not for**','Single-row lookups (indexes are good)']]},
{code:`ALTER SYSTEM SET inmemory_size=4G SCOPE=SPFILE;   -- restart
ALTER TABLE app.sales INMEMORY PRIORITY HIGH;

SELECT segment_name, populate_status, inmemory_size, bytes FROM v$im_segments;`},
{h:'Typical gain'},
{ul:['Analytic queries 10x to 100x faster in many cases.','Fewer analytic indexes needed, so DML on OLTP is lighter.']},
{note:'In-Memory is a licensed option. Test with a representative query set. Memory is limited, so choose the hot tables.'}],
src:[['In-Memory Guide',O.D+'inmem/']]};

/* ---------- 5: MVs ---------- */
L['ora-perf:6:5']={blocks:[
{p:'A **materialized view (MV)** stores the result of a query. With **query rewrite**, Oracle transparently uses the MV when a query could be answered from it.'},
{code:`CREATE MATERIALIZED VIEW LOG ON app.orders WITH ROWID, SEQUENCE (cust_id, total) INCLUDING NEW VALUES;

CREATE MATERIALIZED VIEW app.mv_sales_by_cust
  BUILD IMMEDIATE REFRESH FAST ON COMMIT ENABLE QUERY REWRITE AS
SELECT cust_id, COUNT(*) c, COUNT(total) ct, SUM(total) s
FROM app.orders GROUP BY cust_id;

-- parameters
ALTER SESSION SET query_rewrite_enabled=TRUE;
ALTER SESSION SET query_rewrite_integrity=ENFORCED;`},
{t:[['Refresh','When','Notes'],
['**COMPLETE**','Rebuild the whole result','Simple, heavy'],
['**FAST**','Apply only changes from MV logs','Needs logs and supported query shapes'],
['**ON COMMIT**','At each commit of the base table','Adds commit cost'],
['**ON DEMAND**','By a job','Data can be stale']]},
{note:'Query rewrite honors staleness settings. A stale MV may be skipped in `ENFORCED` integrity mode. Decide how fresh the answers must be.'}],
src:[['Materialized views',O.D+'dwhsg/']]};

/* ---------- 6: Practical ---------- */
L['ora-perf:6:6']={blocks:[
{p:'**Design access structures** for a reporting workload.'},
{h:'Workload'},
{t:[['Query','Pattern'],
['Q1','Sum of sales per month for the last year'],
['Q2','Orders of one customer between two dates'],
['Q3','Count of orders by status and region, ad hoc combinations'],
['Q4','Lookup of a product by code']]},
{h:'Decide'},
{t:[['Query','Structure','Why'],
['Q1','Interval-partitioned by month + MV or In-Memory','Pruning and pre-aggregation'],
['Q2','Index on `(cust_id, order_date)`','Equality then range'],
['Q3','In-Memory table or bitmap indexes (warehouse)','Many combinations, low cardinality'],
['Q4','Unique index (or IOT)','Single-row lookup']]},
{h:'Test'},
{code:`EXPLAIN PLAN FOR SELECT * FROM app.orders WHERE cust_id=5 AND order_date BETWEEN DATE \'2026-01-01\' AND DATE \'2026-03-31\';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
-- compare with and without the index (invisible, then visible)
ALTER INDEX app.orders_cust_date_ix VISIBLE;`},
{h:'Check your result'},
{ul:['Each query shows the planned structure in its plan (partition pruning, index range scan, MV rewrite).','Total index count is minimal.','You know the cost of each structure for DML.']},
{note:'Document the reason beside each structure. In a year, nobody remembers why an index exists.'}],
src:[['SQL Tuning Guide',TG]]};

})();
