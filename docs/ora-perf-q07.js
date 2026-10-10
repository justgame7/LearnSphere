/* LearnSphere - Performance quiz, Section 07: Indexing, Partitioning & Access Structures.
   window.QUIZZES['ora-perf:6']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-perf:6']={qs:[
{q:'Which index is best for **low-cardinality** columns in a warehouse?',o:['Bitmap','Reverse key','Unique','Function-based'],a:0,why:'Avoid in OLTP with DML.',lec:0},
{q:'In a composite index, which column goes **first**?',o:['The one used in equality filters','Any','The widest','The last'],a:0,why:'Then range columns.',lec:0},
{q:'Which index supports `WHERE UPPER(name)=...`?',o:['Function-based','Bitmap','Reverse key','Descending'],a:0,why:'Matches the expression.',lec:0},
{q:'What does an extra index **cost**?',o:['Slower DML and space','Nothing','Faster DML','Less space'],a:0,why:'Every write maintains it.',lec:0},
{q:'How do you **test removing** an index safely?',o:['Make it invisible','Drop it','Rename it','Truncate it'],a:0,why:'Reversible instantly.',lec:1},
{q:'Which view shows **index usage**?',o:['DBA_INDEX_USAGE','DBA_USERS','V$LOG','DBA_JOBS'],a:0,why:'12.2 and later.',lec:1},
{q:'Do B-tree indexes need **regular rebuilds**?',o:['No, not in normal use','Yes weekly','Yes daily','Yes hourly'],a:0,why:'Rebuild for specific reasons.',lec:1},
{q:'Which rebuild is **online**?',o:['ALTER INDEX ... REBUILD ONLINE','DROP and CREATE','TRUNCATE','EXPORT'],a:0,why:'No long locks.',lec:1},
{q:'What is **partition pruning**?',o:['Reading only the needed partitions','Deleting partitions','Compressing','Moving'],a:0,why:'Needs a predicate on the key.',lec:2},
{q:'Which partition method **creates partitions automatically**?',o:['Interval','List','Hash','Reference'],a:0,why:'Based on range.',lec:2},
{q:'Partitioning is a:',o:['Licensed option','Free feature','Hardware feature','OS feature'],a:0,why:'Enterprise Edition option.',lec:2},
{q:'What does partitioning help with **maintenance**?',o:['Drop or archive old partitions quickly','Nothing','Passwords','Networking'],a:0,why:'Operations per partition.',lec:2},
{q:'What is an **index-organized table**?',o:['A table stored in a B-tree by primary key','A view','An index only','A cluster'],a:0,why:'Good for key lookups.',lec:3},
{q:'Which is the **default** table organization?',o:['Heap','IOT','Hash cluster','External'],a:0,why:'Most common.',lec:3},
{q:'Attribute clustering needs:',o:['Direct-path loads','Row-by-row inserts','No data','Indexes only'],a:0,why:'Physical ordering at load.',lec:3},
{q:'What does **In-Memory** keep?',o:['A columnar copy in memory','Redo logs','Backups','Undo'],a:0,why:'Row format stays.',lec:4},
{q:'Which parameter sizes the **In-Memory area**?',o:['INMEMORY_SIZE','SGA_TARGET only','PGA_AGGREGATE_TARGET','DB_CACHE_SIZE'],a:0,why:'SGA component.',lec:4},
{q:'In-Memory is **not for**:',o:['Single-row lookups','Aggregations','Large scans','Filters on few columns'],a:0,why:'Indexes handle those.',lec:4},
{q:'What does **query rewrite** do?',o:['Uses an MV transparently','Rewrites SQL text in the app','Deletes MVs','Compresses'],a:0,why:'If the MV can answer.',lec:5},
{q:'Which refresh uses **MV logs**?',o:['FAST','COMPLETE','NEVER','FORCE only'],a:0,why:'Applies changes.',lec:5},
{q:'What does **ON COMMIT** refresh add?',o:['Commit cost','Nothing','Free speed','Less space'],a:0,why:'Trade-off.',lec:5},
{q:'In the practical, which index serves **cust_id and date range**?',o:['(cust_id, order_date)','(order_date) only','Bitmap on id','Reverse key'],a:0,why:'Equality then range.',lec:6},
{q:'Which fits **Q4 single-row lookup**?',o:['Unique index or IOT','Bitmap','MV','Partition'],a:0,why:'Key lookup.',lec:6},
{q:'What should you **document** for each structure?',o:['The reason it exists','The password','The IP','Nothing'],a:0,why:'Later maintenance.',lec:6},
{q:'Which structure helps **monthly aggregates over a year**?',o:['Partitioning with MV or In-Memory','Reverse key index','Bitmap on key','IOT'],a:0,why:'Pruning and pre-aggregation.',lec:6}
]};
