/* LearnSphere - MySQL, Section 11: Indexes & Query Optimization.
   Lectures 0-10 are core. Needs mysql-common.js. Uses the shop sample database; EXPLAIN output is illustrative. */
(function(){
const K=window.MY,L=window.LESSONS;

const btree=K.dg(700,260,[
[10,10,680,240,'A B-tree index (simplified)',1],
[270,40,160,40,'Root page|keys: 40 | 80',2],
[60,115,160,40,'Branch|1 to 39',0],[270,115,160,40,'Branch|40 to 79',0],[480,115,160,40,'Branch|80 and up',0],
[30,190,110,40,'Leaf|1 to 20',0],[150,190,110,40,'Leaf|21 to 39',0],[270,190,160,40,'Leaf|40 to 79',0],[480,190,160,40,'Leaf|80 and up',0]],
[[350,80,140,115],[350,80,350,115],[350,80,560,115],[140,155,85,190],[140,155,205,190],[350,155,350,190],[560,155,560,190]]);

const cluster=K.dg(700,220,[
[10,10,680,200,'Clustered index versus secondary index',1],
[25,50,300,60,'Clustered index (primary key)|leaf pages hold the whole row',2],[375,50,300,60,'Secondary index (customer_id)|leaf holds the key + primary key',0],
[375,130,300,60,'Lookup by customer_id|1. find primary key in secondary index|2. go to clustered index for the row',0]],
[[375,80,325,80],[525,110,525,130]]);

const leftmost=K.dg(700,190,[
[10,10,680,170,'Composite index (country, city, name): leftmost prefix',1],
[25,55,200,50,'country = DE|uses 1 column',2],[245,55,220,50,'country = DE AND city = Berlin|uses 2 columns',2],[485,55,190,50,'city = Berlin only|cannot use the index well',0],
[25,120,650,36,'Order matters: equality columns first, then range, then the sort column',0]],[]);

const plan=K.dg(700,200,[
[10,10,680,180,'Typical tuning loop',1],
[20,60,110,60,'Find slow|statement',0],[150,60,110,60,'EXPLAIN|or ANALYZE',2],[280,60,110,60,'Change index|or query',0],[410,60,110,60,'Measure|before and after',0],[540,60,130,60,'Deploy and|monitor',0]],
[[130,90,150,90],[260,90,280,90],[390,90,410,90],[520,90,540,90]]);

/* ---------- 0 ---------- */
L['mysql:10:0']={blocks:[
{p:'An **index** is a separate sorted structure that lets the server find rows without reading the whole table, like the index of a book. Choosing indexes is the biggest single lever for performance.'},
{svg:btree},
{h:'B-tree indexes'},
{p:'InnoDB indexes are **B+ trees**. Pages at the top hold keys that direct the search, and the **leaf pages** hold the entries in sorted order, linked together. A lookup walks from the root to a leaf in a few steps (usually 3 to 4 levels, even for hundreds of millions of rows). Because leaves are sorted and linked, ranges and ordering are also fast.'},
{t:[['Query shape','Index helps'],
['`WHERE id = 5`','Equality lookup'],
['`WHERE price BETWEEN 10 AND 50`','Range scan'],
['`ORDER BY created_at LIMIT 20`','Reads in index order, no sort'],
['`WHERE name LIKE \'Ana%\'`','Prefix match']]},
{h:'Clustered and secondary indexes'},
{svg:cluster},
{ul:['The **clustered index** is the primary key. Its leaf pages are the table: they hold the full rows. A primary key lookup finds the row in one tree walk.','A **secondary index** stores the indexed columns plus the **primary key** value. A lookup by a secondary index finds the primary key, then does a second lookup in the clustered index (a "bookmark lookup").','Every secondary index therefore carries the primary key. A long primary key makes all indexes bigger.']},
{h:'The cost side'},
{ul:['Each index must be updated on every INSERT, UPDATE of its columns and DELETE. More indexes mean slower writes.','Indexes take disk and buffer pool memory.','An unused index is pure cost. Find and drop them.']},
{code:`SHOW INDEX FROM orders;
SELECT * FROM sys.schema_unused_indexes WHERE object_schema = 'shop';
SELECT * FROM sys.schema_redundant_indexes;`},
{h:'Selectivity'},
{p:'An index helps when it narrows the search. A column with few distinct values (status with 3 values, a boolean) is **low selectivity**: matching 30 percent of the table is no better than a full scan, so the optimizer may ignore the index. A column with many distinct values (email, order id) is highly selective. In a composite index, low-selectivity columns can still be useful as a leading prefix when combined with others.'},
{note:'The primary key and UNIQUE constraints are indexes. A foreign key needs an index on the child columns (created automatically if missing).'}],
src:[['How MySQL uses indexes',K.D+'mysql-indexes.html'],['Clustered and secondary indexes',K.D+'innodb-index-types.html']]};

/* ---------- 1 ---------- */
L['mysql:10:1']={blocks:[
{p:'A **composite index** covers several columns, in a defined order. It serves queries that filter on a **leftmost prefix** of those columns. The column order is the design decision.'},
{svg:leftmost},
{code:`CREATE INDEX idx_cust_city_name ON customers (country, city, name);

-- can use the index
SELECT * FROM customers WHERE country = 'DE';
SELECT * FROM customers WHERE country = 'DE' AND city = 'Berlin';
SELECT * FROM customers WHERE country = 'DE' AND city = 'Berlin' AND name = 'Ana';
SELECT * FROM customers WHERE country = 'DE' AND city > 'B';               -- range on the 2nd column

-- cannot use it efficiently (the first column is missing)
SELECT * FROM customers WHERE city = 'Berlin';
SELECT * FROM customers WHERE name = 'Ana';`},
{p:'The index is sorted by country, then by city within a country, then by name. Searching for only a city would require scanning the whole index because cities are scattered across countries. (MySQL 8.0.13 added **skip scan** for some cases, but do not rely on it.)'},
{h:'How to choose the column order'},
{flow:['Put columns tested with **equality** first','Then one column used in a **range** (`>`, `<`, `BETWEEN`, `LIKE \'x%\'`). Columns after a range column are not used for narrowing','Then columns used for **ORDER BY**, to avoid sorting','Among equality columns, order by how selective and how commonly each one is used alone']},
{code:`-- query:  WHERE status = 'paid' AND order_date >= '2026-01-01' ORDER BY order_date
CREATE INDEX idx_status_date ON orders (status, order_date);
-- equality (status) first, then the range and sort column (order_date)`},
{h:'One composite beats several single-column indexes'},
{p:'MySQL can combine two single-column indexes (**index merge**) but a composite index that matches the query is usually far more efficient. Creating one index per column is a common mistake.'},
{h:'Redundant indexes'},
{p:'An index on `(a)` is redundant when you have `(a, b)`: the composite already serves queries on `a`. Remove the shorter one, unless it is a UNIQUE or foreign key index that you need.'},
{h:'Choosing what to index'},
{ul:['Columns in `WHERE`, `JOIN ... ON` and `ORDER BY` of **frequent and slow** queries.','Foreign key columns used in joins.','Do not index every column. Start from the queries, not the table.']}],
src:[['Multiple-column indexes',K.D+'multiple-column-indexes.html'],['Index merge optimization',K.D+'index-merge-optimization.html']]};

/* ---------- 2 ---------- */
L['mysql:10:2']={blocks:[
{h:'Covering indexes'},
{p:'If an index contains **every column the query needs**, MySQL answers from the index alone and never visits the table rows. This is a **covering index**, shown as `Using index` in EXPLAIN. It avoids the bookmark lookup and is often a big speedup.'},
{code:`-- needs order_date and total for a customer
CREATE INDEX idx_cust_date_total ON orders (customer_id, order_date, total);
SELECT order_date, total FROM orders WHERE customer_id = 1 ORDER BY order_date;   -- Using index`},
{p:'Remember that every secondary index automatically contains the primary key, so the primary key is also covered for free.'},
{h:'Prefix indexes'},
{p:'For long string columns you can index only the first N characters. The index is smaller, but it cannot be a covering index for that column and cannot fully support ORDER BY.'},
{code:`CREATE INDEX idx_email_prefix ON customers (email(20));
-- choose N so that the prefix is nearly as selective as the full column:
SELECT COUNT(DISTINCT LEFT(email, 20)) / COUNT(DISTINCT email) FROM customers;`},
{h:'Descending indexes'},
{p:'Since 8.0, an index can hold a column in descending order, which helps queries that sort mixed directions.'},
{code:`CREATE INDEX idx_cust_date_desc ON orders (customer_id ASC, order_date DESC);
SELECT * FROM orders WHERE customer_id = 1 ORDER BY order_date DESC;`},
{p:'A plain ascending index can also be read backwards for a single descending sort. The descending index is needed for **mixed** directions, such as `ORDER BY a ASC, b DESC`.'},
{h:'Invisible indexes'},
{p:'An **invisible** index is maintained but ignored by the optimizer. It lets you test the effect of dropping an index and bring it back instantly, which is far safer than dropping and rebuilding.'},
{code:`ALTER TABLE orders ALTER INDEX idx_status_date INVISIBLE;
-- watch performance and slow log for a while
ALTER TABLE orders ALTER INDEX idx_status_date VISIBLE;     -- instant rollback
ALTER TABLE orders DROP INDEX idx_status_date;               -- only when sure`},
{h:'Unique indexes and the primary key'},
{ul:['`UNIQUE` indexes enforce uniqueness and also serve as normal indexes.','NULLs are allowed in UNIQUE indexes, and several NULLs do not conflict.','The primary key columns should be small and immutable.']},
{note:'Index key length is limited to 3072 bytes per index entry in InnoDB with DYNAMIC rows. With utf8mb4, 4 bytes per character, a VARCHAR(1000) cannot be fully indexed. Use a prefix.'}],
src:[['Column indexes',K.D+'column-indexes.html'],['Invisible indexes',K.D+'invisible-indexes.html'],['Descending indexes',K.D+'descending-indexes.html']]};

/* ---------- 3 ---------- */
L['mysql:10:3']={blocks:[
{h:'The problem'},
{p:'A normal index stores column values. If you filter by an **expression**, the optimizer cannot use an index on the underlying column:'},
{code:`SELECT * FROM customers WHERE LOWER(email) = 'ana@example.com';   -- index on email is not used
SELECT * FROM orders WHERE YEAR(order_date) = 2026;                    -- index on order_date is not used`},
{p:'The cleanest cure is to rewrite the predicate as a range or to match the column directly. When that is not possible, index the expression itself.'},
{h:'Functional key parts (8.0.13 and later)'},
{code:`CREATE INDEX idx_email_lower ON customers ((LOWER(email)));
SELECT * FROM customers WHERE LOWER(email) = 'ana@example.com';   -- uses idx_email_lower

CREATE INDEX idx_total_cents ON orders ((CAST(total * 100 AS UNSIGNED)));`},
{ul:['Write the expression in **double parentheses** in the index definition.','The query must use the **same expression** to be matched.','Internally MySQL creates a hidden virtual generated column and indexes it.','Functional indexes cannot be primary keys, and the expression must be deterministic.']},
{h:'Indexing JSON fields'},
{code:`-- single value inside a JSON document
CREATE INDEX idx_city ON profiles ((CAST(doc->>'$.address.city' AS CHAR(80))));
SELECT id FROM profiles WHERE doc->>'$.address.city' = 'Paris';`},
{p:'The `->>` expression must match what the index uses, including the cast and collation, otherwise the optimizer will not pick the index. Using a generated column and indexing it is another reliable way (section 6).'},
{h:'Multi-valued indexes (8.0.17 and later)'},
{p:'A JSON **array** has many values per row. A multi-valued index stores one index entry per array element, so queries that test membership can use it.'},
{code:`CREATE TABLE products_j (
  id INT PRIMARY KEY AUTO_INCREMENT,
  doc JSON,
  INDEX idx_tags ((CAST(doc->'$.tags' AS CHAR(30) ARRAY)))
);
INSERT INTO products_j (doc) VALUES ('{"tags":["sale","new"]}'),('{"tags":["used"]}');

SELECT id FROM products_j WHERE 'sale' MEMBER OF (doc->'$.tags');
SELECT id FROM products_j WHERE JSON_CONTAINS(doc->'$.tags', '["sale","new"]');
SELECT id FROM products_j WHERE JSON_OVERLAPS(doc->'$.tags', '["new","used"]');`},
{ul:['Supported by `MEMBER OF()`, `JSON_CONTAINS()` and `JSON_OVERLAPS()`.','An index can contain only one multi-valued key part, and there are limits on how many entries one row may produce. Check the manual for the limits in your version.','Updates to the array rewrite its index entries, so write-heavy documents pay a cost.']},
{note:'If you index many JSON fields or search arrays constantly, consider whether those values should be real columns or a child table instead.'}],
src:[['Functional key parts',K.D+'create-index.html#create-index-functional-key-parts'],['Multi-valued indexes',K.D+'create-index.html#create-index-multi-valued']]};

/* ---------- 4 ---------- */
L['mysql:10:4']={blocks:[
{h:'Full-text indexes'},
{p:'`LIKE \'%word%\'` cannot use a B-tree index and scans every row. A **FULLTEXT** index builds an inverted index of words, so searches over text columns are fast and can be ranked by relevance.'},
{code:`CREATE TABLE articles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200), body TEXT,
  FULLTEXT KEY ft_title_body (title, body)
) ENGINE=InnoDB;

-- natural language mode: ranked by relevance
SELECT id, title, MATCH(title, body) AGAINST ('replication lag') AS score
FROM articles WHERE MATCH(title, body) AGAINST ('replication lag') ORDER BY score DESC;

-- boolean mode: operators
SELECT id FROM articles WHERE MATCH(title, body) AGAINST ('+mysql -oracle "index tuning"*' IN BOOLEAN MODE);`},
{t:[['Boolean operator','Meaning'],
['`+word`','Must be present'],
['`-word`','Must not be present'],
['`"exact phrase"`','Phrase match'],
['`word*`','Prefix wildcard'],
['`>word`, `<word`','Raise or lower the weight']]},
{h:'Things to know'},
{ul:['Words shorter than `innodb_ft_min_token_size` (3 by default) are not indexed, and **stopwords** (common words such as "the") are ignored.','Changes are put in a cache and merged into the index, so very recent rows appear in searches after the transaction commits, but bulk loads should be followed by `OPTIMIZE TABLE` if needed.','Languages without spaces (Chinese, Japanese) need the **ngram parser**: `FULLTEXT (body) WITH PARSER ngram`.','The `MATCH` columns must be exactly those of one FULLTEXT index.','Full-text is not a replacement for a search engine like Elasticsearch when you need faceting, fuzzy matching or heavy ranking control.']},
{h:'Spatial indexes'},
{p:'MySQL supports spatial types (`POINT`, `LINESTRING`, `POLYGON`) with functions that follow OpenGIS. A `SPATIAL INDEX` accelerates queries that test containment, intersection and bounding boxes.'},
{code:`CREATE TABLE shops (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100),
  location POINT NOT NULL SRID 4326,
  SPATIAL INDEX sp_location (location)
);
INSERT INTO shops (name, location) VALUES ('Berlin Shop', ST_SRID(POINT(52.52, 13.405), 4326));

-- distance in metres between two points (geographic SRID 4326, latitude and longitude order)
SELECT name, ST_Distance(location, ST_SRID(POINT(52.50, 13.40), 4326)) AS metres
FROM shops ORDER BY metres LIMIT 5;`},
{ul:['The indexed column must be `NOT NULL` and have an SRID for the index to be used.','Use `ST_Contains`, `ST_Within`, `ST_Intersects` and `MBRContains` for index-assisted filters.','Axis order for SRID 4326 is latitude then longitude in MySQL 8.']}],
src:[['Full-text search functions',K.D+'fulltext-search.html'],['Spatial data types',K.D+'spatial-types.html']]};

/* ---------- 5 ---------- */
L['mysql:10:5']={blocks:[
{p:'`EXPLAIN` shows the **execution plan**: which tables are read in which order, which index each uses and how many rows are expected. It does not run the query (except for ANALYZE). Reading plans is the core skill of tuning.'},
{svg:plan},
{code:`EXPLAIN SELECT o.id, c.name
FROM orders o JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'paid' AND o.order_date >= '2026-02-01'
ORDER BY o.order_date;`},
{t:[['id','select_type','table','type','possible_keys','key','rows','filtered','Extra'],
['1','SIMPLE','o','range','idx_status_date','idx_status_date','3','100.00','Using index condition'],
['1','SIMPLE','c','eq_ref','PRIMARY','PRIMARY','1','100.00','']]},
{h:'The important columns'},
{t:[['Column','Meaning','What to look for'],
['`table`','The table or derived table in this step','Order of the join'],
['`type`','Access method','From best to worst: `system`, `const`, `eq_ref`, `ref`, `range`, `index`, `ALL`. **ALL is a full table scan**'],
['`possible_keys` and `key`','Indexes available and the one chosen','NULL key means no index used'],
['`key_len`','Bytes of the index used','Shows how many columns of a composite index are used'],
['`rows`','Estimated rows to examine','Should be small. Compare to the table size'],
['`filtered`','Percent of examined rows that remain after the other WHERE conditions','Low values mean wasted reads'],
['`Extra`','Extra details','See below']]},
{h:'Access types'},
{t:[['type','Meaning'],
['const, system','At most one row, from a primary or unique key lookup with a constant'],
['eq_ref','One row per row of the previous table, via a unique index (join on primary key)'],
['ref','Several rows via a non-unique index equality'],
['range','An index range scan (`BETWEEN`, `<`, `IN`)'],
['index','A **full index scan**. Better than ALL only if the index is smaller'],
['ALL','Full table scan']]},
{h:'The Extra column'},
{t:[['Extra','Meaning'],
['Using index','Covering index. No table access. Good'],
['Using where','Filter applied after reading rows'],
['Using index condition','Index condition pushdown: filtering inside the index'],
['Using filesort','An explicit sort. Not always on disk. Costly for large sets'],
['Using temporary','Internal temporary table, often for GROUP BY or DISTINCT'],
['Using join buffer (hash join)','No usable index for the join, a hash join is used']]},
{code:`EXPLAIN FORMAT=TREE SELECT ...;     -- readable tree, shows operators
EXPLAIN FORMAT=JSON SELECT ...;     -- cost details`},
{note:'Row counts in EXPLAIN are **estimates** from statistics, not facts. A plan that looks fine can still be slow if the estimates are wrong. Use EXPLAIN ANALYZE to compare estimates and reality.'}],
src:[['EXPLAIN statement',K.D+'explain.html'],['EXPLAIN output format',K.D+'explain-output.html']]};

/* ---------- 6 ---------- */
L['mysql:10:6']={blocks:[
{h:'EXPLAIN ANALYZE'},
{p:'Available since 8.0.18, `EXPLAIN ANALYZE` **runs the query** and reports, for each step of the plan, the estimated and the **actual** rows, time and loop counts. It is the best tool to see where time goes and where the optimizer guessed wrongly.'},
{code:`EXPLAIN ANALYZE
SELECT c.name, SUM(o.total) AS spent
FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'paid'
GROUP BY c.id, c.name;`},
{code:`-> Table scan on <temporary>  (actual time=0.2..0.2 rows=3 loops=1)
    -> Aggregate using temporary table  (actual time=0.2..0.2 rows=3 loops=1)
        -> Nested loop inner join  (cost=2.1 rows=4) (actual time=0.05..0.09 rows=4 loops=1)
            -> Index lookup on o using idx_status_date (status='paid')  (cost=0.9 rows=4) (actual time=0.03..0.04 rows=4 loops=1)
            -> Single-row index lookup on c using PRIMARY (id=o.customer_id)  (cost=0.25 rows=1) (actual time=0.01..0.01 rows=1 loops=4)`},
{h:'How to read it'},
{ul:['Read from the **innermost** (most indented) step outward. Each step feeds its parent.','`cost=... rows=...` is the optimizer estimate. `actual time=first..last rows=... loops=...` is what happened. The time is in milliseconds **per loop**, so multiply by loops.','A large gap between estimated and actual rows points to stale statistics or data skew: run `ANALYZE TABLE` or create a histogram.','Look for steps with many loops and large actual time, such as a table scan executed once per outer row.']},
{note:'`EXPLAIN ANALYZE` executes the statement. Do not run it on a destructive UPDATE or DELETE in production without a transaction you will roll back.'},
{h:'Optimizer trace'},
{p:'To see **why** the optimizer chose a plan (which indexes it considered and their costs), enable the optimizer trace for your session.'},
{code:`SET optimizer_trace = 'enabled=on';
SELECT * FROM orders WHERE status = 'paid' AND order_date >= '2026-02-01';
SELECT trace FROM information_schema.optimizer_trace\\G
SET optimizer_trace = 'enabled=off';`},
{p:'The JSON trace lists the considered access paths, the row estimates and the cost comparisons. Use it when the optimizer ignores an index you expected, or picks a different join order.'},
{h:'A simple method'},
{flow:['Run EXPLAIN. Is a full scan or a filesort on a large table present?','Run EXPLAIN ANALYZE. Which step has the largest actual time?','Compare estimated and actual rows. Are statistics wrong?','Add or adjust an index, or rewrite the query','Re-run EXPLAIN ANALYZE and compare. Check that writes are not hurt']}],
src:[['EXPLAIN ANALYZE',K.D+'explain.html#explain-analyze'],['The optimizer trace',K.D+'optimizer-tracing.html']]};

/* ---------- 7 ---------- */
L['mysql:10:7']={blocks:[
{p:'The **optimizer** chooses a plan by estimating the cost of alternatives and picking the cheapest. Its decisions are only as good as its **statistics** and its **cost model**.'},
{h:'The cost model'},
{p:'Each plan step gets a cost made of disk reads, memory reads, row evaluations and temporary table work. The unit constants live in `mysql.server_cost` and `mysql.engine_cost` and can be tuned, but you rarely need to.'},
{code:`SELECT * FROM mysql.server_cost;
SELECT * FROM mysql.engine_cost;`},
{h:'Statistics'},
{ul:['**Index statistics:** the number of distinct values per index prefix (cardinality). InnoDB samples pages (`innodb_stats_persistent_sample_pages`, default 20) and keeps persistent statistics.','**Table statistics:** estimated row counts.','Statistics are refreshed automatically after about 10 percent of rows change, and with `ANALYZE TABLE`.']},
{code:`ANALYZE TABLE orders;
SHOW INDEX FROM orders;                                      -- Cardinality column
SELECT * FROM mysql.innodb_index_stats WHERE table_name = 'orders';`},
{p:'Because the sample is small and statistics only capture the **number of distinct values**, not how values are distributed, the optimizer can be wrong for **skewed** data: one status value covering 95 percent of the rows looks the same as one covering 1 percent.'},
{h:'Histograms'},
{p:'A **histogram** records the distribution of values in a **non-indexed** (or indexed) column. The optimizer uses it to estimate how many rows a condition matches, and so picks better join orders and access paths.'},
{code:`ANALYZE TABLE orders UPDATE HISTOGRAM ON status, total WITH 32 BUCKETS;
SELECT table_name, column_name, JSON_EXTRACT(histogram, '$."histogram-type"') AS type
FROM information_schema.column_statistics WHERE table_name = 'orders';
ANALYZE TABLE orders DROP HISTOGRAM ON total;`},
{ul:['Histograms are **not updated automatically**. Rebuild them when the data distribution changes.','They help conditions on columns that have no index. For indexed columns the optimizer can use index dives instead.','They do not make queries faster by themselves. They improve the estimates the optimizer uses.']},
{h:'Index dives'},
{p:'For a range or an `IN` list with equality conditions on an index, the optimizer **dives into the index** at plan time to count matching entries. `eq_range_index_dive_limit` (default 200) bounds this for long lists, after which it falls back to statistics.'},
{h:'When the optimizer is wrong'},
{t:[['Symptom','Likely fix'],
['Estimate far from actual rows','`ANALYZE TABLE`, histogram, check for skew'],
['Index exists but is not used','Condition not sargable, type conversion, composite order, low selectivity, check the trace'],
['Plan changed after a restart or a data load','Statistics resampled. Use `ANALYZE TABLE`. Consider hints for the critical query'],
['Join order is poor','Hints such as `JOIN_ORDER`, or better indexes']]}],
src:[['Optimizer statistics',K.D+'optimizer-statistics.html'],['Histogram statistics',K.D+'optimizer-statistics.html'],['Cost model',K.D+'cost-model.html']]};

/* ---------- 8 ---------- */
L['mysql:10:8']={blocks:[
{h:'Join algorithms'},
{t:[['Algorithm','How it works','When it appears'],
['Nested loop join','For each row of the first table, look up matching rows in the next using an index','The standard. Excellent when the inner side has an index on the join column'],
['Hash join (8.0.18 and later)','Build an in-memory hash table from one input, probe it with the other','Equi-joins with **no usable index**. Replaced the old block nested loop in 8.0.20'],
['Batched key access (BKA)','Collects keys from the outer table and does batched index lookups, using multi-range read','Optional, enabled with a hint or switch for disk-bound lookups']]},
{p:'A hash join is fast for large equi-joins without an index and shows as `Using join buffer (hash join)` in EXPLAIN. It is not a replacement for an index when the query runs often: the join column on the inner table should be indexed, so a nested loop with an index lookup is used.'},
{h:'Index hints (older style)'},
{code:`SELECT * FROM orders USE INDEX (idx_status_date) WHERE status = 'paid';
SELECT * FROM orders FORCE INDEX (idx_status_date) WHERE status = 'paid';
SELECT * FROM orders IGNORE INDEX (idx_customer) WHERE customer_id = 1;`},
{h:'Optimizer hints (comment style, 8.0 and later)'},
{p:'Hints are written as `/*+ ... */` right after `SELECT`. They are **scoped to a query block, table or index**, and they are preferred over the older index hints.'},
{code:`SELECT /*+ INDEX(o idx_status_date) */ * FROM orders o WHERE status = 'paid';
SELECT /*+ NO_INDEX(o idx_customer) */ * FROM orders o WHERE customer_id = 1;
SELECT /*+ JOIN_ORDER(c, o) */ c.name, o.total FROM customers c JOIN orders o ON o.customer_id = c.id;
SELECT /*+ HASH_JOIN(o c) */ ...;           SELECT /*+ NO_HASH_JOIN(o c) */ ...;
SELECT /*+ MAX_EXECUTION_TIME(2000) */ * FROM big_table;      -- stop after 2000 ms
SELECT /*+ SET_VAR(sort_buffer_size = 16M) */ * FROM orders ORDER BY total;  -- per statement variable`},
{h:'Switches'},
{code:`SELECT @@optimizer_switch\\G
SET SESSION optimizer_switch = 'index_merge=off';`},
{h:'When to use hints'},
{ul:['As a **last resort** for one critical query where the optimizer is wrong and statistics, histograms and indexes did not help.','Document each hint with a comment explaining why. A hint can become harmful when data changes.','`MAX_EXECUTION_TIME` and `SET_VAR` are good safety tools for reporting queries.','Do not scatter `FORCE INDEX` through an application as a habit.']},
{note:'A forced index that does not exist makes the statement fail after a schema change. Hints bind your code to physical design.'}],
src:[['Optimizer hints',K.D+'optimizer-hints.html'],['Hash join optimization',K.D+'hash-joins.html'],['Index hints',K.D+'index-hints.html']]};

/* ---------- 9 ---------- */
L['mysql:10:9']={blocks:[
{p:'Most slow queries come from a short list of patterns. Recognise them and the fix is usually straightforward.'},
{h:'1. Make predicates sargable'},
{p:'A predicate is **sargable** (search ARGument able) when the optimizer can use an index for it. Keep the column **bare** on one side of the comparison.'},
{t:[['Not sargable','Sargable'],
['`WHERE YEAR(order_date) = 2026`','`WHERE order_date >= \'2026-01-01\' AND order_date < \'2027-01-01\'`'],
['`WHERE total + 10 > 100`','`WHERE total > 90`'],
['`WHERE LEFT(name, 3) = \'Ana\'`','`WHERE name LIKE \'Ana%\'`'],
['`WHERE phone = 5551234` (phone is VARCHAR)','`WHERE phone = \'5551234\'`'],
['`WHERE a = 1 OR b = 2` (separate indexes)','`UNION ALL` of two queries, or an index merge']]},
{h:'2. Select only what you need'},
{p:'Avoid `SELECT *`. A covering index only helps if the select list is covered. Fetching wide TEXT columns for a list screen wastes I/O and memory.'},
{h:'3. Deep pagination'},
{p:'`LIMIT 20 OFFSET 100000` reads and throws away 100,000 rows. Use **keyset pagination**: remember the last key and continue after it (section 3).'},
{h:'4. COUNT(*)'},
{p:'InnoDB has no stored row count, since the count depends on the transaction. `SELECT COUNT(*) FROM big` scans the smallest index. Counting is expensive on huge tables. Options: add a filter, keep a counter table, use approximate counts (`information_schema.tables.table_rows`) where an estimate is acceptable.'},
{h:'5. The N+1 query problem'},
{p:'The application loads a list (one query) and then runs one query per row for related data: 1 + N round trips. Replace it with one **join** or an `IN (...)` query. This is often the biggest win in ORM-based applications.'},
{code:`-- N+1: one query for orders, then for each order:
SELECT * FROM order_items WHERE order_id = ?;
-- Better: a single query
SELECT i.* FROM order_items i WHERE i.order_id IN (1,2,3,4,5);`},
{h:'6. Sorting and grouping'},
{ul:['Provide an index that matches `WHERE` equality columns followed by the `ORDER BY` columns to avoid `Using filesort`.','`GROUP BY` can use an index in order. Otherwise MySQL builds a temporary table.','`ORDER BY RAND()` sorts everything. Choose random ids in another way.']},
{h:'7. OR, IN and subqueries'},
{ul:['`OR` across different columns can block indexes. Test a `UNION ALL` rewrite.','Large `IN (...)` lists are fine up to thousands of values but consider a temporary table beyond that.','Rewrite correlated subqueries as joins if the optimizer does not.']},
{h:'8. Batch your writes'},
{p:'Multi-row inserts, grouped transactions and `INSERT ... ON DUPLICATE KEY UPDATE` reduce round trips and log flushes.'},
{note:'Always measure with the real data size. A query that is instant on 1,000 rows can take minutes on 100 million.'}],
src:[['Optimizing SELECT statements',K.D+'select-optimization.html'],['WHERE clause optimization',K.D+'where-optimization.html']]};

/* ---------- 10 ---------- */
L['mysql:10:10']={blocks:[
{p:'You cannot tune what you cannot find. MySQL offers two complementary sources: the **slow query log** (individual slow statements) and **statement digests** in the Performance Schema (totals by query shape).'},
{h:'Slow query log'},
{code:`SET PERSIST slow_query_log = ON;
SET PERSIST long_query_time = 1;                  -- seconds. 0 logs everything
SET PERSIST log_slow_extra = ON;                  -- extra fields (8.0.14 and later)
SET PERSIST log_queries_not_using_indexes = OFF;  -- noisy, enable only for short periods
SET PERSIST min_examined_row_limit = 100;
SELECT @@slow_query_log_file;`},
{p:'The log records the statement, time, lock time, rows sent and **rows examined**. A statement that examines many rows but returns few is a missing-index candidate.'},
{code:`# Time: 2026-03-10T10:21:14  # User@Host: app[app] @ 10.0.0.5
# Query_time: 4.201  Lock_time: 0.000  Rows_sent: 12  Rows_examined: 3104552
SELECT ... FROM orders WHERE status = 'paid' AND ...;`},
{p:'Summarise a large slow log with `mysqldumpslow` (bundled) or `pt-query-digest` (Percona Toolkit), which groups by query shape and ranks by total time.'},
{h:'Statement digests'},
{p:'The Performance Schema normalises statements (replacing literals with ?) and sums their statistics, so you see which **query shapes** consume the most total time, even if each run is fast.'},
{code:`SELECT schema_name, LEFT(digest_text, 80) AS query, count_star AS calls,
       ROUND(sum_timer_wait/1e12, 2) AS total_s, ROUND(avg_timer_wait/1e9, 2) AS avg_ms,
       sum_rows_examined AS examined, sum_rows_sent AS sent
FROM performance_schema.events_statements_summary_by_digest
ORDER BY sum_timer_wait DESC LIMIT 10;

SELECT * FROM sys.statement_analysis LIMIT 10;
SELECT * FROM sys.statements_with_full_table_scans LIMIT 10;`},
{h:'The tuning loop'},
{flow:['Find the statements that cost the most total time (digest) or are slowest (slow log)','Reproduce with realistic parameters on a copy','EXPLAIN and EXPLAIN ANALYZE to understand the plan','Fix: index, rewrite, statistics, or application change','Test the change, deploy and compare the digest numbers before and after','Repeat for the next biggest item']},
{note:'Optimise by **total time**, not just by the single slowest query. A 20 ms query run 50,000 times a minute costs far more than a rare 5 second report.'}],
src:[['The slow query log',K.D+'slow-query-log.html'],['Statement digests',K.D+'performance-schema-statement-digests.html'],['sys schema statement views',K.D+'sys-statement-analysis.html']]};
})();
