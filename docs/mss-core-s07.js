/* LearnSphere - SQL Server Core DBA, Section 07: Tables, Indexes & Data Types.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const types=M.dg(700,150,[
[10,20,160,60,'Smaller type|less I/O, less memory,|smaller indexes',2],[200,20,160,60,'Right type|exact match for the data|no hidden conversion',2],
[390,20,140,60,'Unicode only|when you need it',0],[560,20,130,60,'Date types|date, datetime2',0],
[10,100,680,38,'Every wasted byte is read, cached, logged and backed up on every row',0]],
[]);

const btree=M.dg(700,240,[
[290,10,120,45,'Root page',2],
[120,85,120,45,'Intermediate',0],[290,85,120,45,'Intermediate',0],[460,85,120,45,'Intermediate',0],
[50,170,120,50,'Leaf pages|clustered: data rows|nonclustered: keys',0],[240,170,120,50,'Leaf pages',0],[430,170,120,50,'Leaf pages',0],
[570,170,120,50,'Leaf pages',0]],
[[350,55,180,85],[350,55,350,85],[350,55,520,85],[180,130,110,170],[350,130,300,170],[520,130,490,170],[520,130,630,170]]);

const kinds=M.dg(700,200,[
[10,20,210,80,'Heap|no clustered index|rows in no order|scan to find rows',0],
[245,20,210,80,'Clustered index|the table itself is the|B-tree, sorted by key|one per table',2],
[480,20,210,80,'Nonclustered index|separate B-tree: key|columns + row locator|many per table',0],
[10,120,680,60,'A table is either a heap or a clustered index. Nonclustered indexes sit beside it.',0]],
[]);

const col=M.dg(700,170,[
[10,20,300,110,'Rowstore: stores by row',1],[30,55,260,60,'row 1 | row 2 | row 3 ...|good for point lookups and OLTP',0],
[390,20,300,110,'Columnstore: stores by column',1],[410,55,260,60,'col A | col B | col C ...|compressed, scans and aggregates',2]],
[]);

const part=M.dg(700,200,[
[10,15,680,170,'Table partitioned by date',1],
[30,55,150,70,'P1: 2024|old data',0],[200,55,150,70,'P2: 2025|older data',0],[370,55,150,70,'P3: 2026|current data',2],[540,55,130,70,'P4: 2027|future',0],
[30,140,640,36,'Switch or truncate one partition in seconds, instead of deleting millions of rows',0]],
[]);

/* ---------- 0: Data types ---------- */
L['mss-core:6:0']={blocks:[
{p:'Choosing data types is a **design decision with long-term cost**. A column that is larger than needed makes every row, index entry, log record and backup larger.'},
{svg:types},
{h:'Pick the smallest type that fits'},
{t:[['Need','Use','Notes'],
['Whole numbers','`tinyint` (1 B), `smallint` (2 B), `int` (4 B), `bigint` (8 B)','Pick by the real range'],
['Exact decimals, money','`decimal(p,s)` / `numeric`','Avoid `float` for money'],
['Approximate numbers','`float`, `real`','Scientific use only'],
['Date only','`date`','3 bytes'],
['Date and time','`datetime2(n)`','Prefer over `datetime`'],
['Time zone aware','`datetimeoffset`','Stores the offset'],
['True/false','`bit`','1 bit'],
['Short text, English/ANSI','`varchar(n)`','1 byte per char'],
['Unicode text','`nvarchar(n)`','2 bytes per char'],
['Unique identifier','`uniqueidentifier`','16 bytes, random if NEWID(): use NEWSEQUENTIALID() or int/bigint where possible'],
['Large values','`varchar(max)`, `nvarchar(max)`, `varbinary(max)`','Stored off-row if large']]},
{h:'Pitfalls'},
{ul:['Avoid `text`, `ntext` and `image`: deprecated, use the `max` types.','Avoid **implicit conversion**: comparing `varchar` with `nvarchar` or `int` with a string can turn an index seek into a scan.','Do not use `nvarchar` everywhere. Use it only when you need Unicode, or use a UTF-8 collation with `varchar` on 2019 and later.','Use `NOT NULL` where the data is always present.']},
{h:'Inspect a table'},
{code:`SELECT c.name, t.name AS type_name, c.max_length, c.precision, c.scale, c.is_nullable
FROM   sys.columns c
JOIN   sys.types   t ON t.user_type_id = c.user_type_id
WHERE  c.object_id = OBJECT_ID('sales.Orders')
ORDER  BY c.column_id;`}],
src:[['Data types (Transact-SQL)',M.TS+'data-types/data-types-transact-sql'],['Data type conversion',M.TS+'data-types/data-type-conversion-database-engine']]};

/* ---------- 1: Index types ---------- */
L['mss-core:6:1']={blocks:[
{p:'An **index** is a structure that lets SQL Server find rows without reading the whole table. Understanding heap, clustered and nonclustered indexes is the base of all tuning.'},
{svg:kinds},
{h:'How a B-tree index looks'},
{svg:btree},
{p:'A search starts at the **root**, follows intermediate pages and reaches a **leaf** page. For a table with millions of rows this is usually only three or four page reads.'},
{h:'Clustered vs nonclustered'},
{t:[['','Clustered','Nonclustered'],
['**Leaf level contains**','The data rows','Index key columns plus a row locator'],
['**How many per table**','One','Many (up to 999)'],
['**Row locator**','n/a','Clustered key, or RID for a heap'],
['**Good key**','Narrow, unique, static, ever-increasing','Columns used in WHERE, JOIN, ORDER BY']]},
{h:'Included columns'},
{p:'A nonclustered index can carry **included columns** at the leaf level. When it holds every column a query needs, it **covers** the query and no lookup into the table is needed.'},
{code:`CREATE CLUSTERED INDEX CIX_Orders_OrderID ON sales.Orders (OrderID);

CREATE NONCLUSTERED INDEX IX_Orders_Customer
  ON sales.Orders (CustomerID, OrderDate)
  INCLUDE (TotalDue);

-- Indexes of a table
SELECT i.name, i.type_desc, i.is_unique, i.fill_factor
FROM   sys.indexes i
WHERE  i.object_id = OBJECT_ID('sales.Orders');`},
{note:'Every extra index speeds some reads and slows every insert, update and delete, and uses space. Index for real queries, not for guesses.'}],
src:[['Clustered and nonclustered indexes described',M.RD+'indexes/clustered-and-nonclustered-indexes-described'],['SQL Server index architecture and design guide',M.RD+'sql-server-index-design-guide']]};

/* ---------- 2: Constraints ---------- */
L['mss-core:6:2']={blocks:[
{p:'**Constraints** make the database enforce its own rules, so bad data is stopped at the door instead of cleaned up later.'},
{h:'Constraint types'},
{t:[['Constraint','Rule','Notes'],
['**PRIMARY KEY**','Unique, not null, one per table','Creates a unique index, clustered by default'],
['**UNIQUE**','No duplicates','Creates a unique index, allows one NULL'],
['**FOREIGN KEY**','Value must exist in the parent table','Does **not** create an index on the child column'],
['**CHECK**','A condition must be true','Keeps values in range'],
['**DEFAULT**','Value used when none is given','Not enforcement, convenience'],
['**NOT NULL**','Value required','Often forgotten']]},
{code:`CREATE TABLE sales.Orders (
  OrderID    int IDENTITY(1,1) NOT NULL
             CONSTRAINT PK_Orders PRIMARY KEY CLUSTERED,
  CustomerID int            NOT NULL
             CONSTRAINT FK_Orders_Customers FOREIGN KEY
             REFERENCES sales.Customers (CustomerID),
  OrderDate  date           NOT NULL CONSTRAINT DF_Orders_Date DEFAULT (SYSDATETIME()),
  TotalDue   decimal(12,2)  NOT NULL CONSTRAINT CK_Orders_Total CHECK (TotalDue >= 0)
);

-- Foreign keys are not indexed automatically
CREATE INDEX IX_Orders_CustomerID ON sales.Orders (CustomerID);`},
{h:'Trusted constraints'},
{p:'A constraint that was created or enabled with `WITH NOCHECK` is **not trusted**, so the optimizer cannot use it. Check regularly.'},
{code:`SELECT OBJECT_NAME(parent_object_id) AS table_name, name, is_not_trusted, is_disabled
FROM   sys.foreign_keys
WHERE  is_not_trusted = 1 OR is_disabled = 1;`},
{note:'Index foreign key columns on the child table. Without that index, deletes on the parent can scan the child table and cause long blocking.'}],
src:[['Primary and foreign key constraints',M.RD+'tables/primary-and-foreign-key-constraints'],['Unique constraints and check constraints',M.RD+'tables/unique-constraints-and-check-constraints']]};

/* ---------- 3: Columnstore ---------- */
L['mss-core:6:3']={blocks:[
{p:'A **columnstore index** stores data **by column** and compresses it heavily. It is made for analytics: scans, aggregates and large fact tables.'},
{svg:col},
{h:'Rowstore vs columnstore'},
{t:[['','Rowstore (B-tree)','Columnstore'],
['**Best for**','OLTP: few rows by key','Analytics: many rows, few columns'],
['**Storage**','Row by row','Column by column, compressed in rowgroups'],
['**Typical compression**','Moderate','Often several times smaller'],
['**Execution**','Row mode','Batch mode: processes rows in batches'],
['**Writes**','Cheap per row','Batches into rowgroups, delta store for small inserts']]},
{h:'How it is organized'},
{ul:['Rows are grouped into **rowgroups** of up to about 1 million rows.','Each column in a rowgroup is compressed as a **segment**.','New rows land in a **delta store** (a small B-tree) until it is full, then a background process compresses it.','**Segment elimination** skips rowgroups that cannot match the filter.']},
{code:`-- Clustered columnstore: the whole table is columnstore
CREATE TABLE dw.FactSales (
  SaleDate date, ProductID int, Qty int, Amount decimal(12,2)
);
CREATE CLUSTERED COLUMNSTORE INDEX CCI_FactSales ON dw.FactSales;

-- Nonclustered columnstore on an OLTP table for reporting
CREATE NONCLUSTERED COLUMNSTORE INDEX NCCI_Orders
  ON sales.Orders (OrderDate, CustomerID, TotalDue);`},
{note:'Columnstore is available in all editions from SQL Server 2016 SP1, with some performance limits in lower editions. Test your workload: it is not a replacement for B-tree indexes on OLTP lookups.'}],
src:[['Columnstore indexes: overview',M.RD+'indexes/columnstore-indexes-overview'],['Columnstore indexes: design guidance',M.RD+'indexes/columnstore-indexes-design-guidance']]};

/* ---------- 4: Partitioning ---------- */
L['mss-core:6:4']={blocks:[
{p:'**Partitioning** splits one large table or index into smaller parts by the value of a column, such as date. To the application it is still one table.'},
{svg:part},
{h:'Parts of a partitioned table'},
{t:[['Object','Role'],
['**Partition function**','Defines the boundary values and how to split'],
['**Partition scheme**','Maps each partition to a filegroup'],
['**Partitioning column**','The column used, such as OrderDate'],
['**Aligned index**','An index partitioned the same way as the table']]},
{h:'Why partition'},
{ul:['**Manageability**: switch a partition in or out, or truncate one partition, instead of deleting rows.','**Maintenance**: rebuild or compress only one partition.','**Sliding window** retention: add new partitions and remove old ones.','**Possible query benefit** through partition elimination, but not guaranteed. It is mainly a management feature.']},
{code:`CREATE PARTITION FUNCTION pf_Year (date)
  AS RANGE RIGHT FOR VALUES ('2025-01-01', '2026-01-01', '2027-01-01');

CREATE PARTITION SCHEME ps_Year
  AS PARTITION pf_Year ALL TO ([PRIMARY]);

CREATE TABLE sales.OrdersP (
  OrderID int NOT NULL, OrderDate date NOT NULL, TotalDue decimal(12,2),
  CONSTRAINT PK_OrdersP PRIMARY KEY (OrderDate, OrderID)
) ON ps_Year (OrderDate);

-- Which partition holds a value?
SELECT $PARTITION.pf_Year('2026-06-01') AS partition_number;`},
{note:'The partitioning column must be part of the clustered key and of every unique index. Plan this before you create the table. Partitioning is available in all editions from SQL Server 2016 SP1.'}],
src:[['Partitioned tables and indexes',M.RD+'partitions/partitioned-tables-and-indexes'],['Create partitioned tables and indexes',M.RD+'partitions/create-partitioned-tables-and-indexes']]};

})();
