/* LearnSphere - SQL Server Performance & Tuning, Section 06: Indexing Strategy.
   Lectures 0-5 are core, 6-7 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const des=M.dg(700,190,[
[10,20,200,70,'1. Equality columns|WHERE a = x|first in the key',2],[250,20,200,70,'2. Range or sort|WHERE b > y|ORDER BY|next',0],[490,20,200,70,'3. Other columns|SELECT list|go in INCLUDE',0],
[10,115,680,60,'Every index speeds some reads and slows every write, uses space and adds maintenance',0]],
[[210,55,250,55],[450,55,490,55]]);

const cov=M.dg(700,170,[
[10,20,200,70,'Without cover|Seek the index|then a Key Lookup|per row',0],[250,20,200,70,'With cover|Seek the index only|INCLUDE has the|other columns',2],[490,20,200,70,'Trade-off|wider index,|more space and writes',0]],
[[210,55,250,55]]);

const fil=M.dg(700,150,[
[10,25,200,70,'Table: 50 million|orders, 1 percent|are Status = Open',0],[250,25,200,70,'Filtered index|WHERE Status = Open|small and cheap',2],[490,25,200,70,'Query must match|the filter to use it',0]],
[[210,60,250,60],[450,60,490,60]]);

const miss=M.dg(700,170,[
[10,20,200,70,'Optimizer notes|an index would help|during compile',0],[250,20,200,70,'DMV records it|dm_db_missing_index_*|until restart',2],[490,20,200,70,'You decide|merge, name, test|then create',0],
[10,110,680,45,'A hint, not a design. It ignores existing indexes and does not know your writes.',0]],
[[210,55,250,55],[450,55,490,55]]);

const unu=M.dg(700,170,[
[10,25,200,70,'Read activity|seeks, scans, lookups',2],[250,25,200,70,'Write activity|updates to the index',0],[490,25,200,70,'Writes with no reads|candidate to remove|after testing',2],
[10,115,680,40,'Counters reset on restart: check after a full business cycle',0]],
[[210,60,250,60],[450,60,490,60]]);

const cs=M.dg(700,150,[
[10,25,200,70,'Large scans and|aggregates|column compression',2],[250,25,200,70,'Rowgroups of|about 1 million rows|delta store for new rows',0],[490,25,200,70,'Maintain|REORGANIZE compresses|open rowgroups',0]],
[[210,60,250,60],[450,60,490,60]]);

/* ---------- 0: Principles ---------- */
L['mss-perf:5:0']={blocks:[
{p:'Good indexing starts from the **workload**, not from the table. Look at the queries that matter, then design indexes that serve them with the least cost.'},
{svg:des},
{h:'Principles'},
{ul:['Start from the **most expensive queries** (Query Store, query stats).','Put **equality** columns first, then **range or sort** columns.','Choose columns with **good selectivity**: many distinct values.','Keep keys **narrow**: every nonclustered index carries the clustered key.','Aim for **few, well-chosen** indexes, not one per column.','Count the **write cost**: inserts, updates and deletes maintain every index.']},
{t:[['Query pattern','Index key idea'],
['`WHERE a = @x AND b = @y`','`(a, b)` or `(b, a)`, both equality'],
['`WHERE a = @x AND b > @y`','`(a, b)`: equality first'],
['`WHERE a = @x ORDER BY c`','`(a, c)`: avoids a sort'],
['`JOIN ON child.parent_id = parent.id`','Index `parent_id` on the child']]},
{note:'Key column order matters. An index on (a, b) helps queries on a, and on a and b, but not queries on b alone.'}],
src:[['Index design guide',M.RD+'sql-server-index-design-guide'],['Create indexes',M.RD+'indexes/indexes']]};

/* ---------- 1: Covering and included ---------- */
L['mss-perf:5:1']={blocks:[
{p:'An index **covers** a query when it contains every column the query needs. Then SQL Server never touches the table, so no key lookups are needed.'},
{svg:cov},
{code:`-- Query
SELECT OrderID, OrderDate, TotalDue
FROM   sales.Orders WHERE CustomerID = @CustomerID AND OrderDate >= @From;

-- Covering index: key for filtering, INCLUDE for the select list
CREATE NONCLUSTERED INDEX IX_Orders_Cust_Date
  ON sales.Orders (CustomerID, OrderDate)
  INCLUDE (TotalDue);`},
{h:'Key columns vs included columns'},
{t:[['','Key columns','Included columns'],
['**Sorted**','Yes','No'],
['**Used for seek and join**','Yes','No'],
['**Count towards key size limit**','Yes (900 bytes clustered, 1,700 nonclustered)','No'],
['**Purpose**','Find and order rows','Avoid lookups']]},
{ul:['Do not put **large columns** in INCLUDE unless needed: they grow the index.','Check **logical reads** before and after, not only the plan shape.']}],
src:[['Create indexes with included columns',M.RD+'indexes/create-indexes-with-included-columns'],['Index design guide',M.RD+'sql-server-index-design-guide']]};

/* ---------- 2: Filtered indexes ---------- */
L['mss-perf:5:2']={blocks:[
{p:'A **filtered index** covers only some rows, defined by a `WHERE` clause. It is smaller, cheaper to maintain and more selective.'},
{svg:fil},
{code:`CREATE NONCLUSTERED INDEX IX_Orders_Open
  ON sales.Orders (OrderDate)
  INCLUDE (CustomerID, TotalDue)
  WHERE Status = 'Open';

-- Unique values only where present
CREATE UNIQUE NONCLUSTERED INDEX UX_Customers_Email
  ON sales.Customers (Email) WHERE Email IS NOT NULL;`},
{h:'Good uses'},
{ul:['**Active rows** in a table that is mostly history.','**Unique** constraint on a nullable column.','A column that is **NULL** for most rows.']},
{h:'Watch out'},
{ul:['The query predicate must **match the filter**. With a parameter, the optimizer may not be able to use the index unless the plan is recompiled for the value.','Filtered indexes need specific **SET options** for the session to insert or update rows.','They do not help queries that need the other rows.']}],
src:[['Create filtered indexes',M.RD+'indexes/create-filtered-indexes'],['Index design guide',M.RD+'sql-server-index-design-guide']]};

/* ---------- 3: Missing index DMVs ---------- */
L['mss-perf:5:3']={blocks:[
{p:'SQL Server records an index it **would have liked** to have in the **missing index DMVs**. They are a good source of ideas, and a poor source of finished designs.'},
{svg:miss},
{code:`SELECT TOP (15)
       CONVERT(decimal(18,2), gs.avg_total_user_cost * gs.avg_user_impact * (gs.user_seeks + gs.user_scans)) AS score,
       gs.user_seeks, gs.user_scans, gs.avg_user_impact,
       DB_NAME(d.database_id) AS db, d.statement AS table_name,
       d.equality_columns, d.inequality_columns, d.included_columns
FROM   sys.dm_db_missing_index_group_stats gs
JOIN   sys.dm_db_missing_index_groups g ON g.index_group_handle = gs.group_handle
JOIN   sys.dm_db_missing_index_details d ON d.index_handle = g.index_handle
ORDER  BY score DESC;`},
{h:'Limits to remember'},
{ul:['It **does not consider existing indexes**: a small tweak to an existing index may be better than a new one.','**Column order** in the output is not an ideal key order.','Suggestions are **per query shape**: many near duplicates should be merged.','Data is **lost at restart** and limited in size.','It knows nothing about the **write cost** of a new index.']},
{note:'Treat each suggestion as a question, not an answer. Check the queries behind it, compare with existing indexes and test the change.'}],
src:[['Tune nonclustered indexes with missing index suggestions',M.RD+'indexes/tune-nonclustered-missing-index-suggestions'],['sys.dm_db_missing_index_details',M.RD+'system-dynamic-management-views/sys-dm-db-missing-index-details-transact-sql']]};

/* ---------- 4: Unused and duplicate ---------- */
L['mss-perf:5:4']={blocks:[
{p:'Every index costs space and slows writes. Indexes that are **never read** or are **duplicates** are pure cost.'},
{svg:unu},
{code:`SELECT OBJECT_NAME(i.object_id) AS table_name, i.name AS index_name, i.type_desc,
       us.user_seeks, us.user_scans, us.user_lookups, us.user_updates,
       us.last_user_seek, us.last_user_scan
FROM   sys.indexes i
LEFT   JOIN sys.dm_db_index_usage_stats us
       ON us.object_id = i.object_id AND us.index_id = i.index_id AND us.database_id = DB_ID()
WHERE  OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
  AND  i.is_primary_key = 0 AND i.is_unique_constraint = 0 AND i.index_id > 1
  AND  ISNULL(us.user_seeks + us.user_scans + us.user_lookups, 0) = 0
ORDER  BY us.user_updates DESC;`},
{h:'Before you drop'},
{ul:['Check that the server has been up through a **full business cycle** (month end, quarter end).','Never drop indexes that **enforce uniqueness** or support **foreign keys**.','**Script the index**, and **disable** it first. Rebuild it if something breaks.','Look for **duplicates**: same key columns in the same order, with different names.']},
{note:'Usage statistics reset at restart. A server restarted yesterday cannot tell you which indexes are used at month end.'}],
src:[['sys.dm_db_index_usage_stats',M.RD+'system-dynamic-management-views/sys-dm-db-index-usage-stats-transact-sql'],['Disable indexes and constraints',M.RD+'indexes/disable-indexes-and-constraints']]};

/* ---------- 5: Columnstore ---------- */
L['mss-perf:5:5']={blocks:[
{p:'**Columnstore** indexes speed up analytical queries that scan many rows and few columns. Core DBA introduced them. Here is how to use them well.'},
{svg:cs},
{h:'Where it helps'},
{ul:['**Fact tables** and reporting tables with millions of rows.','**Aggregations** such as SUM, COUNT and GROUP BY over large ranges.','A **nonclustered columnstore** on an OLTP table, to run reports without a separate copy.']},
{h:'Keeping it healthy'},
{code:`-- Rowgroup quality
SELECT OBJECT_NAME(object_id) AS table_name, state_desc,
       COUNT(*) AS rowgroups, AVG(total_rows) AS avg_rows, SUM(deleted_rows) AS deleted_rows
FROM   sys.dm_db_column_store_row_group_physical_stats
GROUP  BY object_id, state_desc;

-- Compress open rowgroups and remove deleted rows
ALTER INDEX CCI_FactSales ON dw.FactSales REORGANIZE WITH (COMPRESS_ALL_ROW_GROUPS = ON);`},
{ul:['Load data in **batches of about a million rows** to create full compressed rowgroups.','Many small inserts leave **open or small** rowgroups, which reduces benefit.','**Updates** are delete plus insert: heavy updates need more maintenance.','SQL Server 2022 adds **ordered** clustered columnstore for better segment elimination.']}],
src:[['Columnstore indexes: design guidance',M.RD+'indexes/columnstore-indexes-design-guidance'],['Columnstore indexes: data loading',M.RD+'indexes/columnstore-indexes-data-loading-guidance']]};

})();
