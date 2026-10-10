/* LearnSphere - SQL Server Core DBA, Section 02: SQL Server Architecture.
   Lectures 0-5 are core, 6-7 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const hier=M.dg(700,230,[
[10,10,680,210,'Server (host) can run several instances',1],
[30,45,200,60,'Default instance|MSSQLSERVER',0],[260,45,200,60,'Named instance|HOST\\SALES',2],
[30,125,200,40,'Database',0],[260,125,200,40,'Database',0],[490,125,170,40,'Schema: dbo, sales',0],
[490,175,170,36,'Table, view, procedure',0]],
[[360,105,360,125],[460,145,490,145],[575,165,575,175]]);

const sqlos=M.dg(700,200,[
[10,10,680,180,'SQLOS: scheduling and resources for the engine',1],
[30,45,140,60,'Scheduler 0|one per CPU',2],[190,45,140,60,'Scheduler 1|one per CPU',2],[350,45,140,60,'Scheduler n|one per CPU',2],
[510,45,160,60,'Memory manager|buffer pool, clerks',0],
[30,120,640,50,'Workers (threads) run tasks: each request gets a worker, one runs at a time per scheduler',0]],
[[100,105,100,120],[260,105,260,120],[420,105,420,120]]);

const sysdb=M.dg(700,200,[
[10,15,130,70,'master|logins, config,|database list',2],[150,15,130,70,'model|template for|new databases',0],
[290,15,130,70,'msdb|Agent, backup|history, mail',0],[430,15,130,70,'tempdb|temp objects,|sorts, versions',2],
[570,15,120,70,'Resource|hidden system|objects',0],
[10,110,680,70,'master and msdb must be backed up. model and tempdb shape new databases. tempdb is rebuilt at every start.',0]],
[]);

const pages=M.dg(700,180,[
[10,30,160,60,'Page|8 KB|the smallest unit of I/O',2],
[210,30,200,60,'Extent|8 pages = 64 KB|the unit of allocation',0],
[450,30,230,60,'Allocation unit|IN_ROW_DATA|LOB_DATA, ROW_OVERFLOW_DATA',0],
[10,115,670,45,'A table or index = one or more allocation units made of extents made of pages',0]],
[[170,60,210,60],[410,60,450,60]]);

const qp=M.dg(700,240,[
[10,10,120,50,'T-SQL text',0],[160,10,100,50,'Parser',0],[290,10,120,50,'Algebrizer|names, types',0],[440,10,110,50,'Optimizer|picks a plan',2],
[580,10,110,50,'Plan cache',0],
[160,100,250,50,'Executor: runs the plan operators',2],
[10,100,120,50,'Result to client',0],
[160,180,250,45,'Storage engine:|access methods, buffer manager',0],[440,180,120,45,'Data files',0]],
[[130,35,160,35],[260,35,290,35],[410,35,440,35],[550,35,580,35],[490,60,350,100],[160,125,130,125],[285,150,285,180],[410,202,440,202]]);

const bp=M.dg(700,200,[
[10,10,680,180,'Memory of the SQL Server process',1],
[30,45,200,60,'Buffer pool|cached data and index pages',2],[250,45,200,60,'Plan cache|compiled plans',0],[470,45,200,60,'Memory grants|sorts and hash joins',0],
[30,125,200,45,'Other clerks: locks, CLR',0],[250,125,420,45,'Limit: max server memory (MB). Leave room for the operating system.',0]],
[]);

/* ---------- 0: Hierarchy ---------- */
L['mss-core:1:0']={blocks:[
{p:'Before you tune or secure anything, know **what contains what**. SQL Server is organized as a hierarchy from the machine down to a single column.'},
{svg:hier},
{h:'The levels'},
{t:[['Level','What it is','Example'],
['**Server / host**','The machine or container','SQLPROD01'],
['**Instance**','A running copy of the engine with its own settings, logins and databases','`SQLPROD01\\SALES`'],
['**Database**','Files, schemas and objects','`SalesDB`'],
['**Schema**','A namespace and ownership boundary inside a database','`sales`'],
['**Object**','Table, view, procedure, function','`sales.Orders`']]},
{h:'Default and named instances'},
{ul:['A host has at most one **default instance**. Clients connect with just the host name.','A host can have many **named instances**, each reached as `HOST\\NAME`.','Each instance has its own service, its own memory and its own system databases.']},
{note:'On Linux and in containers you normally run one instance per container or host. Named instances are a Windows feature.'},
{h:'Naming an object'},
{code:`-- Four-part name: server.database.schema.object
SELECT TOP (5) * FROM SQLPROD01.SalesDB.sales.Orders;

-- Usual three-part name
SELECT TOP (5) * FROM SalesDB.sales.Orders;

-- Databases and the instance name
SELECT name, state_desc, compatibility_level FROM sys.databases;
SELECT SERVERPROPERTY('InstanceName') AS instance_name, @@SERVERNAME AS server_name;`}],
src:[['Database Engine instances',M.DE+'configure-windows/database-engine-instances-sql-server'],['Databases',M.RD+'databases/databases']]};

/* ---------- 1: SQLOS ---------- */
L['mss-core:1:1']={blocks:[
{p:'SQL Server does not rely on the operating system to schedule its work. It carries its own small operating system layer, **SQLOS**, that manages **schedulers, threads, memory and I/O**. Understanding it explains most CPU and wait-related behavior.'},
{svg:sqlos},
{h:'The vocabulary'},
{t:[['Term','Meaning'],
['**Scheduler**','One per logical CPU. Decides which worker runs next.'],
['**Worker**','A thread that runs a task.'],
['**Task**','A unit of work, such as a piece of a query.'],
['**Request**','A query or batch from a session.'],
['**Session**','A client connection, identified by a session id (SPID).']]},
{h:'Cooperative scheduling'},
{p:'Workers run until they need something they must wait for: a lock, a disk read or a network packet. They then **yield** and another runnable worker gets the CPU. This is called **cooperative** scheduling and it is why SQL Server records **wait statistics**.'},
{flow:['RUNNING: using the CPU','SUSPENDED: waiting for a resource (the wait type is recorded)','RUNNABLE: resource ready, waiting in the queue for CPU','RUNNING again']},
{h:'See it'},
{code:`-- Schedulers (one per CPU plus special ones)
SELECT scheduler_id, cpu_id, status, current_tasks_count, runnable_tasks_count
FROM   sys.dm_os_schedulers
WHERE  scheduler_id < 255;

-- Active requests and what they wait on
SELECT session_id, status, command, wait_type, wait_time
FROM   sys.dm_exec_requests
WHERE  session_id > 50;`},
{note:'If runnable_tasks_count is regularly above zero on many schedulers, queries are waiting for CPU. That is CPU pressure, covered in the Performance sub-course.'}],
src:[['Thread and task architecture guide',M.RD+'thread-and-task-architecture-guide'],['sys.dm_os_schedulers',M.RD+'system-dynamic-management-views/sys-dm-os-schedulers-transact-sql']]};

/* ---------- 2: System databases ---------- */
L['mss-core:1:2']={blocks:[
{p:'Every instance has a fixed set of **system databases**. If one is damaged or missing, the instance may not start, so a DBA must know what each holds and which ones to back up.'},
{svg:sysdb},
{t:[['Database','Holds','Back up?','If lost'],
['**master**','Logins, server settings, database list, endpoints','Yes, always','Instance will not start: restore or rebuild'],
['**model**','Template for every new database and tempdb','Yes','New databases get defaults'],
['**msdb**','SQL Server Agent jobs, backup history, Database Mail','Yes','Jobs and history lost'],
['**tempdb**','Temp tables, sorts, row versions, work files','No','Recreated at every start'],
['**Resource**','Read-only system objects, hidden','No (part of the binaries)','Reinstall or repair']]},
{h:'Notes on each'},
{ul:['**master** is critical. Back it up after every login, setting or database change.','**model** changes apply to every new database: its recovery model and file sizes become the defaults.','**msdb** grows over time because of backup and job history. Clean it with `sp_delete_backuphistory`.','**tempdb** is shared by everyone. It is the most common source of contention (see Section 5).']},
{h:'Look at them'},
{code:`SELECT name, database_id, recovery_model_desc, state_desc
FROM   sys.databases
WHERE  database_id <= 4;       -- master, tempdb, model, msdb

-- Where do they live?
SELECT DB_NAME(database_id) AS db, name, physical_name
FROM   sys.master_files
WHERE  database_id <= 4;`},
{note:'The Resource database is not listed in sys.databases and cannot be queried directly. The engine stores system objects there so service packs can replace them in one step.'}],
src:[['System databases',M.RD+'databases/system-databases'],['master database',M.RD+'databases/master-database']]};

/* ---------- 3: Pages and extents ---------- */
L['mss-core:1:3']={blocks:[
{p:'SQL Server stores everything in **8 KB pages**. Pages are grouped into **extents** of eight pages. Almost every performance topic comes back to how many pages a query must read.'},
{svg:pages},
{h:'Facts to remember'},
{t:[['Item','Size','Note'],
['**Page**','8 KB','96-byte header, up to 8,060 bytes of row data'],
['**Extent**','64 KB (8 pages)','Allocation unit for space'],
['**Row**','At most 8,060 bytes in-row','Larger values go off-row (LOB or overflow)'],
['**Data file**','Pages numbered from 0','Each file has its own page numbers']]},
{h:'Page types you will see'},
{t:[['Type','Purpose'],
['**Data / index**','Rows and index entries'],
['**IAM**','Index Allocation Map: which extents belong to an object'],
['**PFS**','Page Free Space: how full each page is'],
['**GAM / SGAM**','Which extents are free or mixed'],
['**Boot page**','Database information at page 9 of file 1']]},
{h:'Extents: uniform and mixed'},
{p:'A **uniform extent** belongs to one object. A **mixed extent** is shared by up to eight objects and used for very small objects in older versions. Since SQL Server 2016, new user databases use uniform extents by default, and tempdb always does, which reduces allocation contention.'},
{h:'Allocation units'},
{ul:['**IN_ROW_DATA**: normal rows.','**LOB_DATA**: large values such as varchar(max) and xml.','**ROW_OVERFLOW_DATA**: variable-length values that no longer fit in a row.']},
{h:'See it'},
{code:`-- Pages used by each object in the current database
SELECT o.name, i.name AS index_name, au.type_desc, au.total_pages
FROM   sys.allocation_units au
JOIN   sys.partitions p ON p.hobt_id = au.container_id
JOIN   sys.objects o    ON o.object_id = p.object_id
JOIN   sys.indexes i    ON i.object_id = p.object_id AND i.index_id = p.index_id
WHERE  o.is_ms_shipped = 0
ORDER  BY au.total_pages DESC;`}],
src:[['Pages and extents architecture guide',M.RD+'pages-and-extents-architecture-guide'],['sys.allocation_units',M.RD+'system-catalog-views/sys-allocation-units-transact-sql']]};

/* ---------- 4: Query processing ---------- */
L['mss-core:1:4']={blocks:[
{p:'When a query arrives, the **relational engine** checks it, finds a plan and runs it. The **storage engine** gets the data. Knowing the steps tells you where to look when something is slow.'},
{svg:qp},
{h:'The steps'},
{flow:['Parse: check syntax and build a tree','Bind (algebrizer): resolve names, check permissions and data types','Optimize: choose the cheapest plan, using statistics','Execute: run the operators, request rows from the storage engine','Return results to the client']},
{t:[['Stage','Output','What can go wrong'],
['**Parse**','Query tree','Syntax errors'],
['**Bind**','Resolved objects','Invalid object name, permission denied'],
['**Optimize**','Execution plan','Bad estimates from stale statistics'],
['**Execute**','Rows','Blocking, spills, slow I/O']]},
{h:'The plan cache'},
{p:'Optimization is costly, so SQL Server stores compiled plans in the **plan cache** and reuses them for the same query text and parameters. Many ad hoc queries with different literal text can bloat the cache.'},
{h:'Cost-based optimization'},
{p:'The optimizer does not try every plan. It uses **statistics** to estimate how many rows each step will return, costs a limited number of plans and picks the cheapest. Wrong estimates are the most common cause of a bad plan.'},
{h:'See what is cached'},
{code:`SELECT TOP (10)
       qs.execution_count,
       qs.total_worker_time / 1000 AS total_cpu_ms,
       SUBSTRING(st.text, 1, 100)   AS query_text
FROM   sys.dm_exec_query_stats qs
CROSS  APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER  BY qs.total_worker_time DESC;`},
{note:'The Performance and Tuning sub-course teaches how to read plans, fix estimates and use Query Store. Here you only need the pipeline.'}],
src:[['Query processing architecture guide',M.RD+'query-processing-architecture-guide'],['sys.dm_exec_query_stats',M.RD+'system-dynamic-management-views/sys-dm-exec-query-stats-transact-sql']]};

/* ---------- 5: Buffer pool and memory ---------- */
L['mss-core:1:5']={blocks:[
{p:'SQL Server reads pages from disk into memory and works there. Disks are far slower than RAM, so the amount and use of memory is a main performance factor.'},
{svg:bp},
{h:'Main memory consumers'},
{t:[['Consumer','What it holds','Controlled by'],
['**Buffer pool**','Cached data and index pages','Grows to max server memory'],
['**Plan cache**','Compiled query plans','Automatic, with limits'],
['**Memory grants**','Workspace for sorts, hashes, parallel plans','Per query, by the optimizer'],
['**Other clerks**','Locks, CLR, connections, caches','Automatic']]},
{h:'How pages get in and out'},
{flow:['A query needs a page','Buffer pool has it: logical read (fast)','Not there: physical read from disk into the pool','Changed pages are dirty until written by checkpoint or lazy writer']},
{h:'Two writers'},
{ul:['**Checkpoint** writes dirty pages regularly so recovery after a crash is short.','**Lazy writer** frees pages when memory is needed, removing the least recently used.']},
{h:'The setting every DBA must set'},
{p:'By default **max server memory** is effectively unlimited, so SQL Server can take all RAM and starve the operating system. Set it explicitly.'},
{code:`-- Show current memory and the setting
SELECT physical_memory_in_use_kb/1024 AS mb_in_use
FROM   sys.dm_os_process_memory;

EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'max server memory (MB)';

-- Example: leave about 4 GB for the OS on a 32 GB server
EXEC sp_configure 'max server memory (MB)', 28672; RECONFIGURE;`},
{note:'A common start is to leave 10 to 20 percent of RAM, at least 4 GB, for the operating system and other software, then adjust from observation. Do not read this as a fixed formula.'}],
src:[['Memory management architecture guide',M.RD+'memory-management-architecture-guide'],['Server memory options',M.DE+'configure-windows/server-memory-server-configuration-options']]};

})();
