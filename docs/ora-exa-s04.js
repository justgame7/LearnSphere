/* LearnSphere - Exadata, Section 04: Smart Features & Offload.
   Lectures 0-8 are core, 9-13 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const scan=O.dg(700,210,[
[10,60,130,70,'SELECT order_id|FROM orders|WHERE amount>1000',0],
[190,60,140,70,'Database server|sends the request|with the predicate',0],
[380,20,150,60,'Cell 1|reads, filters rows,|picks columns',2],[380,95,150,60,'Cell 2|same work in parallel',2],[380,170,150,35,'Cell 3',2],
[580,60,110,70,'Only matching|rows and columns|come back',0]],
[[140,95,190,95],[330,80,380,50],[330,100,380,125],[330,120,380,185],[530,50,580,80],[530,125,580,100]]);

const hcc=O.dg(700,150,[
[10,25,150,70,'Row format|each row stored|together',0],[210,25,150,70,'HCC compression unit|columns grouped,|then compressed',2],[410,25,130,70,'Fewer blocks|to read and|store',0],[590,25,100,70,'Faster scans|less storage',2]],
[[160,60,210,60],[360,60,410,60],[540,60,590,60]]);

/* ---------- 0: Smart Scan ---------- */
L['ora-exa:3:0']={blocks:[
{p:'**Smart Scan** is the best-known Exadata feature. Instead of sending every block to the database server, the **cells filter** the data and send back only what the query needs.'},
{svg:scan},
{h:'What the cells do'},
{t:[['Offload type','Meaning'],
['**Predicate filtering**','Cells apply the `WHERE` conditions and return only matching rows'],
['**Column projection**','Cells return only the columns the query selects'],
['**Join filtering**','Cells apply Bloom filters from hash joins (next lectures)'],
['**Function offload**','Many SQL functions and operators can be evaluated in the cell']]},
{h:'When Smart Scan is used'},
{ul:['The query does a **full table scan** or **fast full index scan**.','The scan uses **direct path reads** (it bypasses the buffer cache). Large scans do this automatically.','The data lives in an ASM disk group on Exadata with `cell.smart_scan_capable=TRUE`.','`CELL_OFFLOAD_PROCESSING` is TRUE (the default).']},
{h:'How to see it in a plan'},
{code:`EXPLAIN PLAN FOR SELECT order_id FROM orders WHERE amount > 1000;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- Look for:
-- | TABLE ACCESS STORAGE FULL | ORDERS |
-- Predicate Information:  2 - storage("AMOUNT">1000)
--                            filter("AMOUNT">1000)`},
{p:'`TABLE ACCESS STORAGE FULL` and a `storage(...)` predicate mean **offload is possible**. It does not prove that it happened at run time, since that is measured with statistics (lecture 7).'},
{flow:['The optimizer picks a full scan','The database sends the predicate and column list to the cells','Each cell scans its own disks in parallel and filters','Only the result rows return over RoCE','The database server finishes the query']},
{note:'Smart Scan helps queries that read a lot and return a little. A query that needs every row has nothing to filter.'}],
src:[['Smart Scan',O.EXA],['Exadata features',O.EXA]]};

/* ---------- 1: Storage indexes ---------- */
L['ora-exa:3:1']={blocks:[
{p:'**Storage indexes** are not indexes you create. Each cell keeps, in memory, the **minimum and maximum values** of each column for each region of storage (about 1 MB). If a query asks for values outside that range, the cell **skips the region** without reading it.'},
{h:'Example'},
{t:[['Region','min(order_date)','max(order_date)','Query: order_date = 2026-03-15'],
['A','2026-01-01','2026-01-31','Skipped'],
['B','2026-02-01','2026-02-28','Skipped'],
['C','2026-03-01','2026-03-31','Read'],
['D','2026-04-01','2026-04-30','Skipped']]},
{h:'Key facts'},
{ul:['They are **automatic**. There is no DDL and nothing to maintain.','They work with Smart Scan, on offloaded scans.','They live in cell memory and are rebuilt after a cell restart.','They track a limited number of columns per table (a few), chosen by use.']},
{h:'When they work well'},
{t:[['Data','Effect'],
['Values arrive in sorted or clustered order (dates, increasing keys)','Very effective: regions have narrow ranges'],
['Data is randomly spread','Little effect: every region has a wide range'],
['Columns with many nulls','Less effective']]},
{code:`SELECT name, value FROM v$sysstat WHERE name = 'cell physical IO bytes saved by storage index';`},
{flow:['A scan with a predicate is offloaded','The cell checks min and max of each region','Regions that cannot match are skipped','Less data is read from disk']},
{note:'To help storage indexes, load or reorganise data so related values sit together, for example ordered by date. The result is fewer regions touched per query.'}],
src:[['Storage indexes',O.EXA]]};

/* ---------- 2: Flash cache and write-back ---------- */
L['ora-exa:3:2']={blocks:[
{p:'Section 3 introduced the flash cache. Here is how it behaves for the **database workload**, and how to influence it.'},
{h:'Write-back mode'},
{p:'In **write-back** mode, writes of data blocks go to flash and reach disk later. Many writes to hot blocks are merged in flash, which gives a big gain for write-heavy OLTP.'},
{t:[['','Write-through','Write-back'],
['**Reads cached**','Yes','Yes'],
['**Writes cached**','No','**Yes**'],
['**Data in flash only (not yet on disk)**','Never','Yes, protected by mirroring'],
['**Best for**','Read-mostly workloads','Write-heavy OLTP']]},
{h:'Control for one object'},
{code:`ALTER TABLE orders STORAGE (CELL_FLASH_CACHE KEEP);       -- try to keep in flash
ALTER TABLE audit_log STORAGE (CELL_FLASH_CACHE NONE);    -- do not cache
ALTER TABLE customers STORAGE (CELL_FLASH_CACHE DEFAULT); -- normal behaviour`},
{h:'Columnar caching'},
{p:'For HCC data, flash cache can keep a **columnar copy**, so analytic scans can be served from flash in the same compact format.'},
{h:'See the effect'},
{code:`SELECT name, value FROM v$sysstat
WHERE  name IN ('physical read total IO requests','physical read requests optimized','cell flash cache read hits');`},
{flow:['A read or write arrives at a cell','Flash cache decides if the data is hot','Hot data is served or kept in flash','Cold data goes to disk']},
{note:'Do not pin large tables with KEEP. The keep area is limited, and over-pinning pushes out data that would be cached automatically.'}],
src:[['Smart Flash Cache',O.EXA]]};

/* ---------- 3: Flash log ---------- */
L['ora-exa:3:3']={blocks:[
{p:'Commits in Oracle wait for the redo write. **Smart Flash Log** makes that write faster and more predictable.'},
{h:'How it works'},
{flow:['LGWR sends a redo write to the cell','The cell writes it to the flash log and to the disk at the same time','The first write to complete is acknowledged to LGWR','The other copy finishes in the background','The commit returns to the user']},
{t:[['Without Flash Log','With Flash Log'],
['Redo write waits for a spinning disk, with occasional slow writes','Redo write usually completes on flash, and slow disk writes are hidden'],
['`log file sync` can show outliers','Lower and steadier `log file sync`']]},
{h:'Check it'},
{code:`cellcli -e list flashlog detail
cellcli -e list metriccurrent where name like 'FL_.*'

SELECT event, total_waits, ROUND(time_waited_micro/total_waits) AS avg_us
FROM   v$system_event WHERE event IN ('log file sync','log file parallel write');`},
{h:'Notes'},
{ul:['It uses only a small part of each flash device.','It is automatic. You do not configure it.','All-flash storage servers get fast redo writes anyway, so the feature matters most with disk-based cells.','Metrics starting with `FL_` show how often flash or disk won the race.']},
{note:'If `log file sync` is slow on Exadata, look at the cell metrics and the network before the database. The usual causes are overloaded cells or redo writes waiting on other I/O.'}],
src:[['Smart Flash Log',O.EXA]]};

/* ---------- 4: HCC ---------- */
L['ora-exa:3:4']={blocks:[
{p:'**Hybrid Columnar Compression (HCC)** stores table data in **compression units** that group values by column and compress them. Similar values compress very well, so tables become much smaller and scans read less data.'},
{svg:hcc},
{h:'The levels'},
{t:[['Type','Level','Use','Compression'],
['**Warehouse**','`QUERY LOW`, `QUERY HIGH`','Active warehouse data, frequent queries','Good, fast decompression'],
['**Archive**','`ARCHIVE LOW`, `ARCHIVE HIGH`','Rarely used historical data','Highest, slower to read']]},
{code:`CREATE TABLE sales_hist COMPRESS FOR QUERY HIGH AS SELECT * FROM sales WHERE sale_date < DATE '2025-01-01';

ALTER TABLE sales_2022 MOVE COMPRESS FOR ARCHIVE LOW;

-- Estimate the saving first
-- DBMS_COMPRESSION.GET_COMPRESSION_RATIO(...)`},
{h:'Rules'},
{ul:['HCC is created by **direct-path loads** (CTAS, `INSERT /*+ APPEND */`, `ALTER TABLE MOVE`).','Ordinary single-row DML does not use HCC. Updated rows move to a less compressed format.','HCC suits read-mostly data. It is not for hot, constantly updated tables.','It requires storage that supports it: Exadata (and other Oracle storage products).']},
{t:[['Workload','Choice'],
['Constantly updated OLTP table','Do not use HCC (use Advanced Row Compression if licensed)'],
['Warehouse fact table, loaded nightly','`QUERY HIGH`'],
['Old partitions kept for law','`ARCHIVE LOW` or `HIGH`']]},
{flow:['Pick tables or partitions that are loaded in bulk and then read','Estimate the ratio','Move or create with the chosen level','Test query times','Keep newest partitions at a lighter level']},
{note:'Typical savings are several times smaller than uncompressed, but results vary with the data. Always test with your own tables.'}],
src:[['Hybrid Columnar Compression',O.EXA]]};

/* ---------- 5: Joins and Bloom filters ---------- */
L['ora-exa:3:5']={blocks:[
{p:'Many warehouse queries join a **large fact table** to **small dimension tables**. Exadata can offload part of that join to the cells with a **Bloom filter**.'},
{h:'How it works'},
{flow:['The database reads the small dimension table and applies its filters','It builds a Bloom filter: a compact summary of the join keys that matter','The filter is sent to the cells with the scan of the fact table','Cells discard fact rows whose keys cannot match','Only candidate rows return, and the database does the real join']},
{t:[['Term','Meaning'],
['**Bloom filter**','A small structure that says "definitely not in the set" or "might be in the set"'],
['**False positive**','A row that passes the filter but does not match. The join removes it later.'],
['**Offloaded join filter**','The Bloom filter is evaluated in the cell']]},
{code:`SELECT /*+ PARALLEL(8) */ d.region, SUM(f.amount)
FROM   sales_fact f JOIN region_dim d ON d.id = f.region_id
WHERE  d.country = 'DE'
GROUP  BY d.region;

-- In the plan, in the storage predicate:
-- storage(SYS_OP_BLOOM_FILTER(:BF0000,"F"."REGION_ID"))`},
{h:'Conditions'},
{ul:['The join uses a hash join, usually with parallel execution.','The fact table is scanned with a Smart Scan.','The dimension filters reduce the number of keys.']},
{h:'Check'},
{code:`SELECT name, value FROM v$sysstat WHERE name LIKE 'cell physical IO bytes %';`},
{note:'Bloom filter offload helps most when the dimension filter is selective. If the filter keeps almost every key, it saves little.'}],
src:[['Join offload and Bloom filters',O.EXA]]};

/* ---------- 6: AI Smart Scan ---------- */
L['ora-exa:3:6']={blocks:[
{p:'AI Vector Search compares **vectors** (lists of numbers that describe text, images or other data) to find the closest ones. The comparison reads a lot of data. Newer Exadata software extends Smart Scan to this work **[26ai]**.'},
{h:'The idea'},
{t:[['Step','Without offload','With AI Smart Scan'],
['Read vectors','All vectors travel to the database server','Cells read them in storage'],
['Compute distances','The database server computes every distance','Cells compute distances and keep only the closest candidates'],
['Return','All vectors or distances','Only the top candidates']]},
{flow:['A query asks for the nearest vectors to a given vector','The database sends the query vector to the cells','Each cell computes distances on its own data','Cells return only the best candidates','The database merges and returns the final top results']},
{h:'What you need'},
{ul:['Oracle Database with AI Vector Search (23ai or 26ai).','Exadata System Software that supports vector offload.','Data stored on Exadata storage.']},
{h:'What to check'},
{code:`-- In the SQL monitor and the plan, look for storage-side activity for the vector scan.
-- Compare the statistics before and after, as you do for ordinary Smart Scan.
SELECT name, value FROM v$sysstat WHERE name LIKE 'cell physical IO%';`},
{note:'Supported index types and conditions change between releases. Read the current Exadata System Software release notes and the 26ai documentation before you plan a vector workload.'}],
src:[['Exadata System Software release notes',O.EXA],['AI Vector Search',O.D26]]};

/* ---------- 7: Verifying offload ---------- */
L['ora-exa:3:7']={blocks:[
{p:'A plan with `STORAGE` is a promise. The **statistics** show whether it happened and how much it saved.'},
{h:'Key statistics'},
{t:[['Statistic','Meaning'],
['`cell physical IO bytes eligible for predicate offload`','Data the cells could filter'],
['`cell physical IO interconnect bytes returned by smart scan`','Data actually returned after filtering'],
['`cell physical IO bytes saved by storage index`','Data skipped thanks to storage indexes'],
['`physical read total bytes`','All data read from storage']]},
{code:`-- Per statement
SELECT sql_id,
       ROUND(io_cell_offload_eligible_bytes/1024/1024) AS eligible_mb,
       ROUND(io_interconnect_bytes/1024/1024)          AS returned_mb,
       ROUND(100*(1 - io_interconnect_bytes/NULLIF(io_cell_offload_eligible_bytes,0)),1) AS offload_pct
FROM   v$sql WHERE sql_id = '&sql_id';`},
{p:'**Offload efficiency** = 1 minus (data returned divided by eligible data). A high value means the cells filtered out most of the data.'},
{h:'SQL Monitor'},
{code:`SELECT DBMS_SQLTUNE.REPORT_SQL_MONITOR(sql_id => '&sql_id', type => 'TEXT') FROM dual;`},
{p:'The report shows **cell offload** and I/O bytes per plan line. It is part of the Tuning Pack, so check the licence before use.'},
{flow:['Run the query','Look at statistics for that session or statement','Compute the offload percentage','If low, look for the cause: next lecture practical']},
{note:'Compare numbers before and after for the same query. A single value alone does not tell you much without context.'}],
src:[['Monitoring Smart Scan',O.EXA],['V$SQL',O.RF+'V-SQL.html']]};

/* ---------- 8: Practical ---------- */
L['ora-exa:3:8']={blocks:[
{p:'Prove that a query is offloaded, then find out why another one is **not**. If you have no Exadata, use the expected results as a worksheet.'},
{h:'Step 1: A statistics helper'},
{code:`CREATE OR REPLACE VIEW my_cell_stats AS
SELECT n.name, s.value FROM v$mystat s JOIN v$statname n ON n.statistic# = s.statistic#
WHERE  n.name IN ('cell physical IO bytes eligible for predicate offload',
                  'cell physical IO interconnect bytes returned by smart scan',
                  'cell physical IO bytes saved by storage index','physical read total bytes');`},
{h:'Step 2: A query that should offload'},
{code:`SELECT COUNT(*) FROM big_orders WHERE amount > 9999;     -- large table, selective filter
SELECT * FROM my_cell_stats;`},
{h:'Step 3: A query that should not'},
{code:`SELECT COUNT(*) FROM small_lookup WHERE id > 5;          -- small table: read through the buffer cache
SELECT * FROM my_cell_stats;`},
{h:'Step 4: Find the reason'},
{t:[['Reason offload did not happen','How to check'],
['Table is small, so the scan uses the buffer cache','Compare size with the direct read threshold'],
['Object is cached and read through buffer cache','Check `physical reads direct` statistics'],
['Query uses an index range scan','Plan shows `INDEX RANGE SCAN`, not STORAGE'],
['Disk group is not smart-scan capable','Check `cell.smart_scan_capable`'],
['Function cannot be evaluated in the cell','See `V$SQLFN_METADATA` for offloadable functions'],
['Offload disabled','`SHOW PARAMETER cell_offload_processing`']]},
{code:`SHOW PARAMETER cell_offload_processing
SELECT name, offloadable FROM v$sqlfn_metadata WHERE name = 'UPPER';`},
{h:'What to expect'},
{t:[['Query','Expected'],
['Big scan with filter','Eligible bytes large, returned bytes small: high offload percent'],
['Small table','Eligible bytes zero: no offload'],
['Same big scan with a non-offloadable function','Eligible may stay high, but returned bytes also high']]},
{note:'Smart Scan is a tool, not a goal. If a query is already fast without it, no action is needed. Focus on the slow ones.'}],
src:[['Smart Scan',O.EXA]]};

})();
