/* LearnSphere - Amazon Redshift, Section 06: Table Design - Distribution, Sort & Compression.
   Lectures 0-5 are core, 6-10 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const skew=R.dg(700,260,[
[10,10,330,240,'Even distribution: 4 slices',1],[360,10,330,240,'Skewed distribution: one slice does the work',1],
[30,50,60,150,'Slice 1|25%',2],[100,50,60,150,'Slice 2|25%',2],[170,50,60,150,'Slice 3|25%',2],[240,50,60,150,'Slice 4|25%',2],
[380,50,60,150,'Slice 1|70%',2],[450,50,60,50,'Slice 2|10%',0],[520,50,60,50,'Slice 3|10%',0],[590,50,60,50,'Slice 4|10%',0],
[30,210,280,30,'All slices finish together',0],[380,210,290,30,'Query waits for the slowest slice',0]],
[]);

const joinplan=R.dg(700,250,[
[10,10,330,230,'Join on the distribution key',1],[360,10,330,230,'Join on a different column',1],
[30,45,130,50,'sales|DISTKEY listid',0],[180,45,130,50,'listing|DISTKEY listid',0],
[30,120,280,40,'Matching rows already on the same slice',0],[30,175,280,45,'DS_DIST_NONE: no data movement',2],
[380,45,130,50,'sales|DISTKEY listid',0],[530,45,130,50,'event|DISTKEY eventid',0],
[380,120,280,40,'Rows must travel between nodes',0],[380,175,280,45,'DS_BCAST_INNER or DS_DIST_BOTH: slow',2]],
[]);

const inter=R.dg(700,230,[
[10,10,330,210,'Compound sort key (a, b, c)',1],[360,10,330,210,'Interleaved sort key (a, b, c)',1],
[30,45,290,40,'Sorted by a, then b within a, then c',0],
[30,95,290,40,'Filter on a (or a, b): excellent',2],
[30,145,290,40,'Filter on b or c alone: little skipping',0],
[380,45,290,40,'Equal weight to every column',0],
[380,95,290,40,'Filter on any one column: good skipping',2],
[380,145,290,40,'Higher load and VACUUM cost',0]],
[]);

/* ================= LECTURE 0 ================= */
L['rs:5:0']={blocks:[
{p:'Table design is the biggest lever you have over Redshift performance. A good design makes queries touch less data and keeps every slice equally busy. A bad one makes the whole warehouse wait.'},
{h:'Two ideas to hold on to'},
{ul:['**Distribution**: how a table rows are spread across the slices. It decides how evenly work is shared and how much data must move between nodes during joins.','**Sort order**: how rows are ordered on disk. It decides how many blocks a filter can skip (Section 2, zone maps).','**Compression**: how small each column is stored. It decides how much I/O a scan needs.']},
{h:'Skew: the slowest slice sets the pace'},
{p:'Every query step finishes only when its **slowest slice** finishes. If most rows land on one slice, that slice does most of the work while the others sit idle. This is **data skew**.'},
{svg:skew},
{h:'Data movement: the hidden cost of joins'},
{p:'To join two tables, matching rows must be on the same slice. If they are not, Redshift must **redistribute** rows across the network, or **broadcast** a whole table to every node, while the query runs. That movement costs time and network capacity, and it grows with data size. The right distribution design places matching rows together in advance so nothing has to move.'},
{h:'Recognizing the symptoms'},
{t:[['Symptom','Likely cause','Where to look'],
['A step runs on one slice much longer than the others','Skewed distribution key','`SVV_TABLE_INFO.skew_rows`; `SYS_QUERY_DETAIL.data_skewness`, `time_skewness`'],
['Plans show `DS_BCAST_INNER` or `DS_DIST_BOTH`','Tables joined on columns that are not their distribution keys','`EXPLAIN` (lecture on data movement)'],
['Filters scan many blocks','No useful sort key, or table is unsorted','`SVV_TABLE_INFO.unsorted`, `sortkey1`'],
['Tables take far more space than expected','Poor or missing compression, oversized columns','`SVV_TABLE_INFO.size`, `encoded`, `max_varchar`'],
['Plans look wrong','Stale statistics','`SVV_TABLE_INFO.stats_off`']]},
{code:`-- Is this table skewed? skew_rows = rows on the fullest slice / rows on the emptiest
SELECT "schema", "table", diststyle, skew_rows, tbl_rows
FROM   svv_table_info
WHERE  skew_rows > 2
ORDER  BY skew_rows DESC;

-- Is the intended distribution key unevenly populated? Look for heavy values.
SELECT customer_id, COUNT(*) AS n
FROM   fact_sales
GROUP  BY customer_id
ORDER  BY n DESC LIMIT 10;`},
{note:'Skew only matters on large tables. A table of a few thousand rows can look badly skewed in a ratio and still cost nothing. Check size before you worry.'},
{h:'What the rest of this section does'},
{flow:['Pick distribution styles','Pick sort keys','Let compression be automatic','Let automation help','Verify with plans and system views']},
{p:'Start with **AUTO** for everything and add deliberate keys only where you can show a benefit. AUTO is the default and often good enough, and it gets adjusted as your tables and queries change.'}],
src:[['Data distribution for query optimization',DG+'t_Distributing_data.html'],['Best practices for designing tables',DG+'c_designing-tables-best-practices.html'],['SVV_TABLE_INFO',DG+'r_SVV_TABLE_INFO.html']]};

/* ================= LECTURE 1 ================= */
L['rs:5:1']={blocks:[
{p:'Redshift offers four distribution styles. They decide which slice stores each row of a table.'},
{t:[['Style','How rows are placed','Best for','Cost'],
['**AUTO** (default)','Redshift chooses and changes the style as the table grows','Most tables, especially when unsure','You give up manual control'],
['**EVEN**','Round-robin across slices regardless of values','Tables that do not join, or when there is no clear key','Joins on this table usually need redistribution'],
['**KEY**','Rows with the same value in the DISTKEY column go to the same slice','Large tables that join on a common column','A skewed or low-cardinality key causes skew'],
['**ALL**','A full copy on every node','Slow-moving dimension tables that cannot collocate with the fact table','Storage multiplies by the node count; slower loads and updates']]},
{h:'How AUTO works'},
{ul:['A small table starts as **ALL**.','As it grows Redshift may switch it to **KEY**, using the primary key (or a column of a composite primary key) as the DISTKEY.','If it keeps growing and no column suits as a key, Redshift switches it to **EVEN**.','Changes happen in the background with minimal impact on queries.','If you set a style yourself, the table is no longer managed automatically.']},
{h:'KEY: collocating a join'},
{p:'If two tables are distributed on their **join columns**, rows with matching values land on the same slice and the join needs no data movement. A fact table can have only one distribution key, so choose the join that matters most.'},
{code:`CREATE TABLE fact_sales (
  sale_id     BIGINT,
  customer_id INTEGER,
  date_key    INTEGER,
  amount      DECIMAL(12,2)
)
DISTSTYLE KEY DISTKEY (customer_id)
SORTKEY (date_key);

CREATE TABLE dim_customer (
  customer_id INTEGER,
  name        VARCHAR(100)
)
DISTSTYLE KEY DISTKEY (customer_id);   -- same key: joins are collocated`},
{h:'How to choose'},
{p:'AWS suggests working through these steps:'},
{flow:['Distribute the fact table and one dimension on their common column','Pick the largest dimension by size after filtering','Use a high-cardinality column','Make other dimensions ALL if they cannot collocate','Or use AUTO']},
{ul:['**Fact table plus one dimension**: set both the dimension primary key and the fact table foreign key as DISTKEY.','**Largest dimension, measured after filtering**: only the rows used in the join must move, so the filtered size is what counts.','**High cardinality in the filtered result**: if you distribute on a date column and queries filter to a narrow date range, most filtered rows land on a few slices and the query is skewed.','**Avoid keys with very uneven or many null values**, since all rows with the same value go to one slice.','**ALL for the rest**: dimensions that cannot collocate can be made ALL, trading storage and maintenance time for join speed.']},
{note:'DISTSTYLE ALL for a small dimension brings little benefit, because redistributing a small table during a query is cheap. Reserve ALL for dimensions big enough to matter and rarely updated.'},
{h:'See what a table uses'},
{code:`SELECT "schema", "table", diststyle FROM svv_table_info ORDER BY 1, 2;
-- Values: EVEN, KEY(column), ALL, AUTO(ALL), AUTO(EVEN), AUTO(KEY(column))`},
{p:'Redshift manages distribution across the whole cluster. There is no partitioning to define and no tablespaces to create.'}],
src:[['Distribution styles',DG+'c_choosing_dist_sort.html'],['Choose the best distribution style',DG+'c_best-practices-best-dist-key.html'],['CREATE TABLE',DG+'r_CREATE_TABLE_NEW.html']]};

/* ================= LECTURE 2 ================= */
L['rs:5:2']={blocks:[
{p:'A **sort key** stores a table rows on disk in sorted order. Because each 1 MB block records its minimum and maximum values (zone maps), a filter on the sort key can skip most blocks (Section 2).'},
{h:'Three choices'},
{t:[['Choice','What it does','Use when'],
['**SORTKEY AUTO** (default)','Redshift picks, and may change, the sort key from your queries. Starts with none','Unsure, or you want automation'],
['**COMPOUND** (default when you list columns)','Sorts by the first column, then the second within it, and so on','Queries filter on the leading column(s); the common case'],
['**INTERLEAVED**','Gives equal weight to each column, up to eight','Different queries filter on different columns; large tables only (additional lecture)']]},
{h:'Choosing a sort key'},
{ul:['**Recent data queried most?** Put the timestamp or date column **first**. Queries skip whole blocks outside the time range.','**Frequent range or equality filter on one column?** Make it the sort key. Redshift tracks the min and max per block and skips blocks that cannot match.','**A table you join often?** Make the join column both the **sort key and the distribution key**. The optimizer can then pick a faster **merge join** and skip the sort step of the join.','**Small tables** may be better with no sort key, to avoid the storage overhead.']},
{code:`-- Compound sort key: date first because most queries filter on a date range
CREATE TABLE fact_events (
  event_time TIMESTAMP,
  user_id    INTEGER,
  event_type SMALLINT,
  payload    VARCHAR(500)
)
SORTKEY (event_time, user_id);

-- Redshift chooses and adjusts for you
CREATE TABLE fact_events2 (LIKE fact_events);
ALTER TABLE fact_events2 ALTER SORTKEY AUTO;`},
{h:'How compound keys behave'},
{p:'A compound key is most useful when queries filter on the **prefix** of the key: the first column, or the first two, in order. A filter that skips the leading column gets little benefit, because the later columns are only sorted within each value of the earlier ones.'},
{svg:inter},
{h:'Things to remember'},
{ul:['Sort key columns are stored **uncompressed (RAW)** by default. That is intentional: heavily compressed sort keys can slow range scans.','You can name up to **400** columns in a compound sort key (8 for interleaved).','New rows arrive in load order, so the unsorted region grows as data is added. **VACUUM** restores order (Section 8), and automatic table sort does this in the background.','Sort order on its own does not change results, only speed.','A table whose rows are loaded in sort key order (for example time-ordered events) stays well sorted with little work.']},
{h:'Check what you have'},
{code:`SELECT "table", sortkey1, sortkey_num, unsorted, vacuum_sort_benefit
FROM   svv_table_info
WHERE  "schema" = 'public'
ORDER  BY size DESC;
-- sortkey1 shows a column, AUTO(SORTKEY) or AUTO(SORTKEY(column)); blank means none`},
{note:'In the real world a good time column as the first sort key is the single most valuable design choice for fact tables.'}],
src:[['Sort keys',DG+'t_Sorting_data.html'],['Choose the best sort key',DG+'c_best-practices-sort-key.html'],['Compound sort key',DG+'t_Sorting_data-compound.html']]};

/* ================= LECTURE 3 ================= */
L['rs:5:3']={blocks:[
{p:'**Compression encodings** shrink each column on disk. Smaller columns mean less I/O and less memory per scan, so compression improves speed as well as cost.'},
{h:'The easy answer: ENCODE AUTO'},
{ul:['**ENCODE AUTO is the default.** Redshift picks an encoding for each column and can change it later if another would perform better.','If you set an encoding for **any** column in `CREATE TABLE`, the table is no longer on ENCODE AUTO and Redshift stops managing the other columns.','You can turn it on again with `ALTER TABLE ... ALTER ENCODE AUTO`.']},
{h:'Initial encodings Redshift assigns'},
{t:[['Column','Initial encoding'],
['Sort key columns','RAW (none)'],
['BOOLEAN, REAL, DOUBLE PRECISION','RAW'],
['SMALLINT, INTEGER, BIGINT, DECIMAL, DATE, TIME, TIMESTAMP, TIMESTAMPTZ','AZ64'],
['CHAR, VARCHAR','LZO'],
['Everything in a temporary table','RAW']]},
{h:'The encodings'},
{t:[['Encoding','Good for','Notes'],
['**RAW**','Sort keys and data that does not compress','No compression'],
['**AZ64**','Numbers, dates and timestamps','Amazon-designed; high ratio and fast processing'],
['**ZSTD**','Wide range of data, especially long and short text, logs and JSON','High ratio, very good speed; unlikely to use more space than raw'],
['**LZO**','Long text such as descriptions and comments','High ratio, good speed'],
['**BYTEDICT**','Columns with fewer than 256 distinct values','One dictionary per 1 MB block; values beyond 256 stay raw'],
['**RUNLENGTH**','Values repeated consecutively, for example a sorted low-cardinality column','Do not use on a sort key column'],
['**DELTA, DELTA32K**','Dates, timestamps, near-sequential numbers','Stores differences between neighbors'],
['**MOSTLY8/16/32**','Columns declared wider than most values need','Outliers stay raw; can be worse than none if many values do not fit'],
['**TEXT255, TEXT32K**','VARCHAR with recurring words','Dictionary of words per block']]},
{h:'ANALYZE COMPRESSION: an advisor'},
{p:'`ANALYZE COMPRESSION` samples a table and reports the encoding it would suggest for each column and the estimated space saved compared with raw. It does **not** change the table.'},
{code:`ANALYZE COMPRESSION sales;
ANALYZE COMPRESSION sales (qtysold, commission, saletime) COMPROWS 1000000;
--  Table | Column  | Encoding | Est_reduction_pct
--  sales | qtysold | az64     | 83.06`},
{ul:['It takes an **exclusive lock**, blocking reads and writes, so run it on an idle table.','The default sample is **100,000 rows per slice**; smaller `COMPROWS` values are raised to that. It gives no recommendation when the table is too small to sample meaningfully.','It skips sort key columns and returns their current encoding.']},
{h:'Changing an encoding'},
{code:`-- Table stays available for queries while the encoding changes
ALTER TABLE fact_events ALTER COLUMN payload ENCODE ZSTD;
ALTER TABLE fact_events ALTER COLUMN event_type ENCODE AZ64, ALTER COLUMN user_id ENCODE AZ64;
ALTER TABLE fact_events ALTER ENCODE AUTO;   -- hand control back to Redshift`},
{ul:['You cannot change an encoding to the one it already has.','You cannot alter the encoding of a column in a table with an **interleaved** sort key.']},
{h:'Compression during COPY'},
{p:'When you COPY into an **empty** table whose columns have no encoding declared, Redshift can analyze a sample and apply encodings. That analysis takes time. For repeatable ETL define encodings (or rely on ENCODE AUTO) when you create staging tables, or add `COMPUPDATE OFF` to the COPY.'},
{note:'Leave compression to Redshift unless you have a measured reason. The usual wins are: check that nothing important is RAW by accident, and keep VARCHAR columns no wider than needed.'}],
src:[['Compression encodings',DG+'c_Compression_encodings.html'],['ANALYZE COMPRESSION',DG+'r_ANALYZE_COMPRESSION.html'],['ALTER TABLE',DG+'r_ALTER_TABLE.html']]};

/* ================= LECTURE 4 ================= */
L['rs:5:4']={blocks:[
{p:'You can set distribution and sort keys by hand, but Redshift can also do it for you. **Automatic table optimization (ATO)** watches how queries use your tables and applies sort and distribution keys that suit the workload. **Advisor** gives recommendations for things automation does not do.'},
{h:'Automatic table optimization'},
{ul:['It continuously observes query activity and uses AI methods to choose sort and distribution keys for your workload.','A table is automated when its **distribution style and/or sort key is AUTO**. Tables created without explicit keys are AUTO by default.','Initially a table has no distribution key or sort key. The style is EVEN or ALL depending on size. As it grows and queries run, Redshift applies keys. Optimizations arrive **within hours** once a minimum number of queries have run.','For sort keys it tries to reduce the data blocks read during scans. For distribution it tries to reduce the bytes transferred between nodes.','You can automate sort keys but not distribution, or the reverse.']},
{h:'Turning it on and off'},
{code:`-- Opt an existing table in. Current keys are kept at first.
ALTER TABLE sales ALTER SORTKEY AUTO;
ALTER TABLE sales ALTER DISTSTYLE AUTO;

-- Opt out by choosing a style or key yourself
ALTER TABLE sales ALTER DISTSTYLE KEY DISTKEY listid;
ALTER TABLE sales ALTER SORTKEY (saletime);
ALTER TABLE sales ALTER SORTKEY NONE;`},
{h:'Watching what it does'},
{t:[['View','Shows'],
['`SVV_TABLE_INFO`','Whether each table distribution style and sort key is AUTO (`AUTO(...)` in `diststyle` and `sortkey1`)'],
['`SVV_ALTER_TABLE_RECOMMENDATIONS`','Current recommendations for **all** tables, automated or not, with the ALTER statements. Added twice a day; once applied they disappear'],
['`SVL_AUTO_WORKER_ACTION`','Audit log of every action Redshift took and the previous state of the table (provisioned)'],
['`SYS_AUTO_TABLE_OPTIMIZATION`','Monitoring view of automatic table optimization activity']]},
{code:`SELECT * FROM svv_alter_table_recommendations;
SELECT * FROM svl_auto_worker_action ORDER BY eventtime DESC LIMIT 20;   -- provisioned`},
{p:'After a recommendation is available, Redshift starts it within an hour. A table that you configure yourself is not managed automatically, though its recommendations still appear in the view for you to apply.'},
{h:'Amazon Redshift Advisor'},
{p:'Advisor analyzes performance and usage metrics for your warehouse and shows **observations and ranked recommendations**, in the console and through system views. It is available in a long list of AWS Regions and supports Serverless, keeping its learning across pause and resume.'},
{t:[['Advisor recommendation','What it suggests'],
['Compress S3 objects loaded by COPY','Compress large source files'],
['Split S3 objects loaded by COPY','Load multiple files, a multiple of the slice count'],
['Skip compression analysis during COPY','Define encodings or use `COMPUPDATE OFF`'],
['Update table statistics','Run `ANALYZE` on tables with stale or missing statistics'],
['Enable short query acceleration','Turn on SQA (Section 8)'],
['Alter distribution keys, sort keys and compression encodings','Gives ready-made `ALTER TABLE` statements'],
['Reallocate WLM memory, isolate active databases','Workload design (Section 9)'],
['Data type recommendations','Add a column with a better data type']]},
{ul:['Advisor does not recommend anything when there is too little data or the expected benefit is small, so no recommendation does not prove a design is perfect.','Apply recommendation groups during **light workload**: they use cluster resources and take temporary locks.','If Advisor flags staging or temporary tables, change your ETL to create them with the recommended keys.','For data sharing, Advisor combines query patterns from consumer warehouses so keys fit all users of the data.']},
{note:'A sensible policy: leave new and small tables on AUTO, review SVV_ALTER_TABLE_RECOMMENDATIONS weekly, and hand-tune only the few largest, most important tables where you can measure the gain.'}],
src:[['Automatic table optimization',DG+'t_Creating_tables.html'],['Enabling, disabling, and monitoring ATO',DG+'c_ato-enabling-disabling-monitoring.html'],['Amazon Redshift Advisor',DG+'advisor.html'],['Advisor recommendations',DG+'advisor-recommendations.html']]};

/* ================= LECTURE 5 ================= */
L['rs:5:5']={blocks:[
{p:'A table design review is a small, repeatable routine: find the tables that cost you most, diagnose each one, fix it, and measure. This practical uses only system views, so it works on Provisioned and Serverless.'},
{h:'Step 1: list the biggest tables'},
{code:`SELECT "schema", "table", size AS mb, tbl_rows, diststyle, sortkey1, encoded,
       unsorted, stats_off, skew_rows
FROM   svv_table_info
ORDER  BY size DESC
LIMIT  25;`},
{p:'Work from the top. Ten large tables usually account for almost all the data and cost.'},
{h:'Step 2: find the problems'},
{t:[['Finding','Query filter','Fix'],
['Skewed','`skew_rows > 2` on a large table','Change the distribution key or style; check the key for heavy or null values'],
['Unsorted','`unsorted > 20`','`VACUUM SORT ONLY`, or let automatic table sort handle it; add a sort key if there is none (Section 8)'],
['Stale statistics','`stats_off > 10`','`ANALYZE` the table (Section 8)'],
['No sort key on a large table','`sortkey1 IS NULL`','Add a sort key on the common filter column, or `ALTER SORTKEY AUTO`'],
['Uncompressed','`encoded = \'N\'`','`ALTER ENCODE AUTO` or set encodings'],
['Oversized columns','large `max_varchar`','Shrink VARCHAR widths to the data'],
['Ghost rows','`tbl_rows` much larger than `estimated_visible_rows`','`VACUUM DELETE ONLY`']]},
{code:`SELECT "schema", "table", size, skew_rows, unsorted, stats_off, vacuum_sort_benefit,
       tbl_rows - estimated_visible_rows AS ghost_rows
FROM   svv_table_info
WHERE  size > 1024               -- over about 1 GB
  AND (skew_rows > 2 OR unsorted > 20 OR stats_off > 10 OR sortkey1 IS NULL)
ORDER  BY size DESC;`},
{p:'The thresholds are rules of thumb for you to adjust, not official limits.'},
{h:'Step 3: ask Redshift for advice'},
{code:`SELECT * FROM svv_alter_table_recommendations;`},
{h:'Step 4: fix the worst offenders'},
{code:`-- A big fact table with no sort key, and queries that filter on sale date
ALTER TABLE public.sales ALTER SORTKEY (saletime);

-- A dimension that joins to a large fact table but was EVEN
ALTER TABLE public.users ALTER DISTSTYLE KEY DISTKEY userid;

-- Refresh statistics afterwards
ANALYZE public.sales;
ANALYZE public.users;`},
{ul:['Run changes in a quiet period and one table at a time (an `ALTER` consumes resources and takes temporary locks).','Take a note of the **before** numbers so you can prove the change helped.']},
{h:'Step 5: measure'},
{code:`SET enable_result_cache_for_session TO off;
-- Run a representative query twice and keep the second timing
SELECT query_id, elapsed_time/1000000.0 AS seconds, compile_time/1000000.0 AS compile_s
FROM   sys_query_history
WHERE  query_text LIKE '%your marker comment%'
ORDER  BY start_time DESC LIMIT 3;`},
{h:'Keep the habit'},
{flow:['Run the review weekly','Fix the top three issues','Re-run to confirm','Record results','Repeat']},
{note:'Save the output of the Step 1 query into a table each week. Trends (a table growing faster than expected, skew creeping up) are as valuable as snapshots.'}],
src:[['SVV_TABLE_INFO',DG+'r_SVV_TABLE_INFO.html'],['SVV_ALTER_TABLE_RECOMMENDATIONS',DG+'r_SVV_ALTER_TABLE_RECOMMENDATIONS.html'],['Best practices for designing tables',DG+'c_designing-tables-best-practices.html']]};

/* ================= ADDITIONAL 6 ================= */
L['rs:5:6']={blocks:[
{p:'This lecture walks through realistic cases to show how join and filter patterns turn into key choices. The model is a sales star schema: a large `fact_sales` and dimensions for customer, product, date and store.'},
{h:'The method'},
{flow:['List the most important queries','Note which tables join on which columns','Note which columns filter','Pick the fact table DISTKEY from the joins','Pick the sort key from the filters','Handle remaining dimensions']},
{h:'Case 1: one big dimension dominates'},
{p:'Most queries join `fact_sales` to `dim_customer` (200 million rows), and a few join to small dimensions.'},
{code:`CREATE TABLE fact_sales (...) DISTSTYLE KEY DISTKEY (customer_id) SORTKEY (sale_date);
CREATE TABLE dim_customer (...) DISTSTYLE KEY DISTKEY (customer_id);
CREATE TABLE dim_product  (...) DISTSTYLE ALL;     -- 50,000 rows, rarely changes
CREATE TABLE dim_date     (...) DISTSTYLE ALL;`},
{p:'The customer join is collocated. The small dimensions are copied to every node so their joins need no movement either.'},
{h:'Case 2: two big tables, two competing joins'},
{p:'`fact_sales` joins `dim_customer` (big) and `fact_returns` (big) on different columns. A fact table has only one distribution key, so one join must move data.'},
{ul:['Pick the join that is used **more often** or moves **more data** after filtering.','Distribute `fact_sales` and `fact_returns` on `order_id` if that join is the heavy one; accept some movement for the customer join, or make `dim_customer` ALL if it is small enough.','Do not try to collocate everything. Measure the plan before and after.']},
{h:'Case 3: the key is skewed'},
{p:'`fact_events` is distributed on `user_id`, but 15 percent of rows have `user_id = 0` for anonymous visitors. All those rows land on one slice.'},
{code:`SELECT user_id, COUNT(*) FROM fact_events GROUP BY 1 ORDER BY 2 DESC LIMIT 5;   -- shows the hot value
-- Fix: choose a more even key, or use EVEN distribution if the table joins rarely
ALTER TABLE fact_events ALTER DISTSTYLE EVEN;`},
{h:'Case 4: filter-driven sort key'},
{p:'Dashboards always filter `WHERE event_time >= current_date - 30`.'},
{code:`ALTER TABLE fact_events ALTER SORTKEY (event_time);`},
{p:'Only the blocks for the last 30 days are read. If queries also filter by `tenant_id`, put it **second**, or first if every query filters on it.'},
{h:'Case 5: filters on many different columns'},
{p:'Analysts filter a big customer table by region, segment or signup year in unpredictable ways. A compound key on one of them helps only queries that use it first. This is where an interleaved key can help (next lectures), or you let `SORTKEY AUTO` learn the pattern.'},
{h:'Case 6: join column and filter column are the same'},
{p:'When a big table is joined on `order_id` and the join column is also the sort key, the optimizer can choose a merge join without re-sorting. Use `order_id` as both distribution key and sort key.'},
{h:'Checklist'},
{ul:['Is the DISTKEY high cardinality and evenly populated **in the filtered data**?','Does it match the most important join?','Is the sort key the column used in range filters, with the date or time first for fact tables?','Do the small dimensions use ALL or AUTO?','Did you compare `EXPLAIN` and timings before and after?']}],
src:[['Choose the best distribution style',DG+'c_best-practices-best-dist-key.html'],['Choose the best sort key',DG+'c_best-practices-sort-key.html'],['Advanced table design playbook (AWS blog)','https://aws.amazon.com/blogs/big-data/amazon-redshift-engineerings-advanced-table-design-playbook-preamble-prerequisites-and-prioritization/']]};

/* ================= ADDITIONAL 7 ================= */
L['rs:5:7']={blocks:[
{p:'Designs need to change as data and queries change. Redshift lets you change distribution and sort keys with `ALTER TABLE`, and when you need a full rebuild you use a **deep copy**.'},
{h:'Changing keys with ALTER TABLE'},
{code:`ALTER TABLE sales ALTER DISTSTYLE EVEN;
ALTER TABLE sales ALTER DISTSTYLE ALL;
ALTER TABLE sales ALTER DISTSTYLE KEY DISTKEY listid;   -- or: ALTER DISTKEY listid
ALTER TABLE sales ALTER DISTSTYLE AUTO;

ALTER TABLE sales ALTER SORTKEY (saletime, listid);     -- compound
ALTER TABLE sales ALTER SORTKEY AUTO;
ALTER TABLE sales ALTER SORTKEY NONE;

-- Combine to do the work in one pass
ALTER TABLE sales ALTER SORTKEY (saletime), ALTER DISTKEY listid;`},
{p:'Supported combinations are a sort key change together with `ALTER DISTKEY` or `ALTER DISTSTYLE ALL`.'},
{h:'Rules and limits'},
{ul:['`ALTER TABLE` locks the table for reads and writes unless the documentation says otherwise. Redshift redistributes the data in the background, but changes use cluster resources and take **temporary table locks**, so run them during a light period.','`ALTER DISTSTYLE`, `ALTER DISTKEY`, `ALTER SORTKEY` and `VACUUM` **cannot run at the same time on one table**. A running VACUUM makes the ALTER fail, and a running ALTER stops background vacuum from starting.','Only **one `ALTER DISTKEY`** can run on a table at a time.','`ALTER DISTKEY` and `ALTER DISTSTYLE` ALL or EVEN are **not supported on tables with interleaved sort keys**, and `ALTER DISTSTYLE` is not supported on temporary tables. `ALTER SORTKEY` is not supported on temporary tables.','You can alter an **interleaved** sort key to compound or none, but **not** a compound key to interleaved.','Changing a column to a sort key sets its encoding to **RAW**, which can increase storage.','A table that you alter from AUTO to a chosen style is no longer a candidate for automatic table optimization.','You cannot add a column that is the distribution key or a sort key, nor drop one.']},
{h:'Deep copy'},
{p:'A deep copy recreates and refills a table with a bulk insert, which sorts it. For a table with a large unsorted region it is much faster than `VACUUM`. Choose one of three methods.'},
{t:[['Method','Use when','Notes'],
['**Original DDL**','You have the `CREATE TABLE` statement (`SHOW TABLE` prints it)','Fastest and preferred; you can set every attribute, including keys'],
['**CREATE TABLE LIKE**','No DDL available','Inherits encoding, DISTKEY, SORTKEY and NOT NULL, but not primary or foreign keys'],
['**Temp table, truncate, reinsert**','The table has dependencies you must keep','Fast, but **TRUNCATE commits immediately**; if the session dies before the insert finishes, the data is lost']]},
{code:`-- Deep copy with new keys
CREATE TABLE sales_new (LIKE sales);        -- or full DDL with the new DISTKEY / SORTKEY
INSERT INTO sales_new SELECT * FROM sales;

-- Re-grant what the old table had (see SVV_RELATION_PRIVILEGES)
SELECT * FROM svv_relation_privileges WHERE namespace_name = 'public' AND relation_name = 'sales';
GRANT SELECT ON TABLE sales_new TO group analysts;

DROP TABLE sales;
ALTER TABLE sales_new RENAME TO sales;
ANALYZE sales;`},
{ul:['Track writes made to the original **during** the copy and apply them to the new table afterwards. A VACUUM supports concurrent updates automatically; a deep copy does not.','If the copy lives in a different schema, grant `USAGE` on that schema.','Views that depend on the old table block `DROP TABLE`; late-binding views avoid this.']},
{note:'Prefer ALTER TABLE for key changes, since it is simpler and keeps the table in place. Use a deep copy when ALTER is not allowed, for example to get from compound to interleaved, or to rebuild a badly unsorted table quickly.'}],
src:[['ALTER TABLE',DG+'r_ALTER_TABLE.html'],['Performing a deep copy',DG+'performing-a-deep-copy.html'],['Advisor recommendations',DG+'advisor-recommendations.html']]};

/* ================= ADDITIONAL 8 ================= */
L['rs:5:8']={blocks:[
{p:'An **interleaved sort key** gives equal weight to each of up to eight columns, so a filter on **any** of them can skip blocks. It is powerful in a narrow set of cases and costly in the rest, which is why AWS now steers most tables toward compound or AUTO keys.'},
{svg:inter},
{h:'When it helps'},
{ul:['Many different queries filter on **different columns** of the same large table, and no single column leads.','Queries use **highly selective** predicates on one or more of the key columns, such as `WHERE c_region = \'ASIA\'`. The more key columns a query restricts, the bigger the benefit.','The table is **large**: sorting is applied per slice, so it needs multiple 1 MB blocks per slice before skipping pays off.','A single column with values that share a **long common prefix**, such as URLs beginning `http://www`: interleaved zone maps can tell such values apart better than a compound key.']},
{h:'When not to use it'},
{ul:['**Never on monotonically increasing columns** such as identity columns, dates and timestamps.','Tables with regular `INSERT`, `UPDATE` and `DELETE` activity: compound keys are recommended there.','Small tables.','When you cannot afford slower loads and vacuums.']},
{h:'The cost: VACUUM REINDEX'},
{ul:['Performance drifts as rows are added for both key types, but more for interleaved. A `VACUUM` restores order, and merging new interleaved data can mean **changing every data block**, so it takes longer.','The distribution of key values can change over time (especially dates). If the skew grows, run `VACUUM REINDEX` to re-analyze the key. It takes an extra pass and is slower than a normal vacuum.','See key skew and last reindex time in `SVV_INTERLEAVED_COLUMNS`.']},
{code:`CREATE TABLE customer (
  c_custkey INTEGER, c_region VARCHAR(20), c_nation VARCHAR(20), c_mktsegment VARCHAR(20)
)
INTERLEAVED SORTKEY (c_region, c_nation, c_mktsegment);

VACUUM REINDEX customer;
SELECT * FROM svv_interleaved_columns;`},
{h:'Restrictions to know'},
{ul:['An interleaved key supports a **maximum of 8 columns**.','You cannot change the encoding of columns in a table with an interleaved key, nor use `ALTER DISTKEY`, `ALTER DISTSTYLE ALL` or `ALTER DISTSTYLE EVEN` on it.','You can alter an interleaved key to compound or none, never the reverse.','Concurrency scaling does not support queries on tables with interleaved sort keys.']},
{h:'Resizing and migration'},
{ul:['Resizing from **dc2.large to ra3.large** automatically converts interleaved sort keys to compound so the tables can use concurrency scaling. You can recreate the interleaved key afterwards, but then those tables cannot use concurrency scaling.','Moving from a provisioned cluster to **Serverless** converts tables that have both an interleaved key and `DISTSTYLE KEY` to compound sort keys; tables with only an interleaved key stay unchanged.','Advisor recommends changing interleaved keys to compound or none because compound keys need no expensive `VACUUM REINDEX`.']},
{note:'Default to SORTKEY AUTO or a compound key. Reach for interleaved only after you have measured a large table with unpredictable filters and confirmed that you can afford the maintenance.'}],
src:[['Interleaved sort key',DG+'t_Sorting_data-interleaved.html'],['Sort keys',DG+'t_Sorting_data.html'],['SVV_INTERLEAVED_COLUMNS',DG+'r_SVV_INTERLEAVED_COLUMNS.html']]};

/* ================= ADDITIONAL 9 ================= */
L['rs:5:9']={blocks:[
{p:'`EXPLAIN` shows you what a table design is costing. The join labels beginning `DS_` tell you whether data had to move between nodes for that join.'},
{svg:joinplan},
{h:'The labels'},
{t:[['Label','Meaning','Verdict'],
['`DS_DIST_NONE`','No redistribution; matching slices are already collocated','Good'],
['`DS_DIST_ALL_NONE`','No redistribution; the inner table is DISTSTYLE ALL, so it is on every node','Good'],
['`DS_DIST_INNER`','The inner table is redistributed','Probably costly'],
['`DS_DIST_OUTER`','The outer table is redistributed','Probably costly'],
['`DS_BCAST_INNER`','A copy of the whole inner table is broadcast to all nodes','Not good'],
['`DS_DIST_BOTH`','Both tables are redistributed','Not good'],
['`DS_DIST_ALL_INNER`','The whole inner table is sent to one slice because the outer table is ALL','Not good: the join runs serially on one node'],
['`DS_DIST_ERR`','The table has no distribution style selected','Check the table']]},
{h:'What to do about each'},
{ul:['**DS_DIST_INNER**: the outer table is already distributed on the join key. Make the **inner** table distribute on the join key too and it becomes DS_DIST_NONE. If that is impossible, consider DISTSTYLE ALL for the inner table.','**DS_BCAST_INNER or DS_DIST_BOTH**: usually the tables are not joined on their distribution keys. Distribute both on the join column, or make the inner table ALL.','**DS_DIST_ALL_INNER**: DISTSTYLE ALL is meant only for the inner table of a join. Give the outer table a distribution key or EVEN distribution.']},
{h:'Reading a real plan'},
{p:'In AWS documentation, a plan for a TICKIT query with broadcast steps:'},
{code:`->  XN Hash Join DS_BCAST_INNER  (cost=112.50..3272334142.59 rows=170771 width=84)
      Hash Cond: ("outer".venueid = "inner".venueid)
      ->  XN Hash Join DS_BCAST_INNER  (cost=109.98..3167290276.71 ...)
            ->  XN Merge Join DS_DIST_NONE  (cost=0.00..6286.47 ...)
                  ->  XN Seq Scan on listing
                  ->  XN Seq Scan on sales`},
{p:'After changing the dimension tables to `DISTSTYLE ALL`, the broadcast steps became `DS_DIST_ALL_NONE` and the total cost fell from `3272334142.59` to `14142.59`.'},
{code:`->  XN Hash Join DS_DIST_ALL_NONE  (cost=112.50..14142.59 rows=170771 width=84)
      ->  XN Hash Join DS_DIST_ALL_NONE  (cost=109.98..10276.71 ...)
            ->  XN Merge Join DS_DIST_NONE  (cost=0.00..6286.47 ...)`},
{ul:['Cost is a **relative estimate**, not seconds, and AWS notes it is not a reliable way to compare different plans. The huge drop above is a useful sign that the movement is gone, but always confirm with real timings.','Typically only one join, between the fact table and one dimension, is `DS_DIST_NONE`.','Read plans from the innermost, most indented step outward.']},
{h:'A routine'},
{flow:['Run EXPLAIN on important queries','Look for DS_BCAST and DS_DIST_BOTH','Change keys on the table involved','Re-run EXPLAIN','Confirm with timings']},
{note:'Compare timings of the second run of a query: the first includes compilation. Turn the result cache off when you benchmark.'}],
src:[['Evaluating the query plan',DG+'c_data_redistribution.html'],['EXPLAIN',DG+'r_EXPLAIN.html'],['Query planning and execution workflow',DG+'c-query-planning.html']]};

/* ================= ADDITIONAL 10 ================= */
L['rs:5:10']={blocks:[
{p:'A hands-on lab that follows the whole loop: **baseline, redesign, measure**. You will build two copies of the TICKIT `sales` and `listing` tables, one poorly designed and one designed on purpose, and compare them. Use the sample data from Section 3 and a small warehouse, and delete everything at the end.'},
{note:'The TICKIT tables are small, so timings may be close. The point is the method, and the plan and cost differences are visible even when seconds are not. Repeat the lab on a larger table to see timings diverge.'},
{h:'Step 1: baseline design'},
{code:`CREATE TABLE sales_base   DISTSTYLE EVEN SORTKEY NONE AS SELECT * FROM sales;
CREATE TABLE listing_base DISTSTYLE EVEN SORTKEY NONE AS SELECT * FROM listing;

ANALYZE sales_base;
ANALYZE listing_base;`},
{h:'Step 2: the tuned design'},
{p:'Both tables join on `listid`, and queries filter on `dateid`. So distribute both on `listid` and sort the fact table by `dateid`.'},
{code:`CREATE TABLE sales_tuned
  DISTSTYLE KEY DISTKEY (listid) SORTKEY (dateid) AS SELECT * FROM sales;
CREATE TABLE listing_tuned
  DISTSTYLE KEY DISTKEY (listid) AS SELECT * FROM listing;

ANALYZE sales_tuned;
ANALYZE listing_tuned;`},
{h:'Step 3: one query, two designs'},
{code:`SET enable_result_cache_for_session TO off;

-- baseline
SELECT /* base */ l.sellerid, SUM(s.pricepaid) AS revenue
FROM   sales_base s JOIN listing_base l ON s.listid = l.listid
WHERE  s.dateid BETWEEN 1900 AND 1950
GROUP  BY l.sellerid ORDER BY revenue DESC LIMIT 10;

-- tuned
SELECT /* tuned */ l.sellerid, SUM(s.pricepaid) AS revenue
FROM   sales_tuned s JOIN listing_tuned l ON s.listid = l.listid
WHERE  s.dateid BETWEEN 1900 AND 1950
GROUP  BY l.sellerid ORDER BY revenue DESC LIMIT 10;`},
{p:'Run each statement **twice** and compare the second run, so compilation is not counted.'},
{h:'Step 4: compare plans'},
{code:`EXPLAIN SELECT l.sellerid, SUM(s.pricepaid)
FROM sales_base s JOIN listing_base l ON s.listid = l.listid
WHERE s.dateid BETWEEN 1900 AND 1950 GROUP BY l.sellerid;

EXPLAIN SELECT l.sellerid, SUM(s.pricepaid)
FROM sales_tuned s JOIN listing_tuned l ON s.listid = l.listid
WHERE s.dateid BETWEEN 1900 AND 1950 GROUP BY l.sellerid;`},
{p:'Expect the baseline plan to show a redistribution or broadcast label (`DS_DIST_BOTH`, `DS_BCAST_INNER` or similar) and the tuned plan to show `DS_DIST_NONE` for the join. The estimated cost is usually much lower for the tuned design, but treat that as a hint and rely on the timings.'},
{h:'Step 5: compare timings and storage'},
{code:`SELECT CASE WHEN query_text LIKE '%/* base */%' THEN 'baseline' ELSE 'tuned' END AS design,
       query_id, elapsed_time/1000000.0 AS seconds,
       execution_time/1000000.0 AS exec_s, compile_time/1000000.0 AS compile_s
FROM   sys_query_history
WHERE  query_text LIKE '%/* base */%' OR query_text LIKE '%/* tuned */%'
ORDER  BY start_time DESC LIMIT 6;

SELECT "table", size, diststyle, sortkey1, skew_rows
FROM   svv_table_info
WHERE  "table" IN ('sales_base', 'sales_tuned', 'listing_base', 'listing_tuned');`},
{h:'Step 6: write it up'},
{t:[['Metric','Baseline','Tuned'],
['Join label in EXPLAIN','',''],
['Estimated cost (hint only)','',''],
['Second-run seconds','',''],
['Table size (MB)','',''],
['Skew (skew_rows)','','']]},
{p:'Fill in the table from your own results, then decide whether the redesign is worth applying to the real tables. Remember that a design that helps one query can hurt another, so test your most important queries, not just one.'},
{h:'Clean up'},
{code:`DROP TABLE sales_base; DROP TABLE listing_base;
DROP TABLE sales_tuned; DROP TABLE listing_tuned;`},
{ul:['Stretch goal: make `sales_tuned` use `SORTKEY AUTO` and `DISTSTYLE AUTO`, run a workload, and see what Redshift recommends in `SVV_ALTER_TABLE_RECOMMENDATIONS`.','Stretch goal: scale the data up (insert the table into itself several times) and repeat to watch the timing gap grow.']}],
src:[['Evaluating the query plan',DG+'c_data_redistribution.html'],['Sample database',DG+'c_sampledb.html'],['SYS_QUERY_HISTORY',DG+'SYS_QUERY_HISTORY.html']]};
})();
