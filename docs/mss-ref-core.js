/* LearnSphere - SQL Server Core DBA Quick Reference (cheat sheet).
   window.QREF['mss-core'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for SQL Server 2019 to 2022 and current Azure SQL; verify syntax against your build. Check build-specific behaviour in the release notes. */
window.QREF=window.QREF||{};
window.QREF['mss-core']={title:'SQL Server Core DBA Quick Reference',blurb:'Instance settings, diagnostic queries and fixes for SQL Server, plus maps of the instance, storage, the log and everyday tasks.',hint:'log reuse wait',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every SQL Server DBA should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Architecture'},
{acc:[
{t:'Instance, database and objects',s:'The hierarchy.',
 a:'An **instance** is one SQL Server engine with its own system databases, configuration and ports. It holds many **databases**, each with schemas, tables and other objects. Several instances can share a host.',
 w:'Security, memory and patching are per instance. Know which instance you are on.',
 c:`SELECT @@SERVERNAME, @@VERSION;`,see:[1,0,'Instance, database and object hierarchy']},
{t:'SQLOS and schedulers',s:'The engine\'s own operating system.',
 a:'SQLOS schedules **workers** on one **scheduler** per logical CPU, manages memory and I/O, and uses cooperative scheduling. A worker waits when it needs a resource, and the wait type tells you which.',
 w:'Wait statistics are the basis of performance diagnosis.',
 c:`SELECT TOP 10 wait_type, wait_time_ms FROM sys.dm_os_wait_stats ORDER BY wait_time_ms DESC;`,see:[1,1,'SQLOS, schedulers and workers']},
{t:'System databases',s:'master, model, msdb, tempdb, Resource.',
 a:'**master** holds instance metadata and logins, **model** is the template for new databases, **msdb** holds Agent jobs and backup history, **tempdb** is scratch space re-created at start, and the hidden **Resource** database holds system objects.',
 w:'Back up master, model and msdb. Never store user data in them.',
 c:`SELECT name, state_desc, recovery_model_desc FROM sys.databases WHERE database_id <= 4;`,see:[1,2,'System databases: master, model, msdb, tempdb and Resource']},
{t:'Pages and extents',s:'8 KB pages, 64 KB extents.',
 a:'Data is stored in 8 KB **pages**, grouped into 8-page **extents**. Allocation maps (GAM, SGAM, PFS, IAM) track free space. A row must fit in a page, with overflow for large values.',
 w:'Page counts drive I/O and buffer pool use.',
 c:`SELECT index_id, in_row_data_page_count, used_page_count FROM sys.dm_db_partition_stats WHERE object_id = OBJECT_ID('dbo.Orders');`,see:[1,3,'Pages, extents and allocation units']},
{t:'Query processing',s:'Parse, bind, optimise, execute.',
 a:'A statement is parsed, bound to objects, optimised into a plan (cost-based, using statistics) and executed. Plans are cached and reused. Poor estimates lead to poor plans.',
 w:'Most tuning is about helping the optimiser choose well.',
 c:`SELECT TOP 5 total_worker_time, execution_count, text FROM sys.dm_exec_query_stats CROSS APPLY sys.dm_exec_sql_text(sql_handle) ORDER BY total_worker_time DESC;`,see:[1,4,'How a query is processed: parse, optimize, execute']},
{t:'Buffer pool',s:'The data cache.',
 a:'The **buffer pool** caches data pages in memory. Pages are changed in memory (dirty), written to disk by checkpoint and lazy writer. **Page life expectancy** and buffer hit ratio hint at pressure, but waits are better evidence.',
 w:'Set `max server memory` so the OS keeps room.',
 c:`SELECT counter_name, cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Page life expectancy';`,see:[1,5,'Buffer pool and the memory architecture']}
]},

{h:'Configuration and connectivity'},
{acc:[
{t:'Service accounts',s:'Least privilege for the service.',
 a:'Run the engine and Agent under dedicated low-privilege accounts (or gMSA). Grant only the rights needed, such as *Perform volume maintenance tasks*.',
 w:'A compromised service account becomes a compromised server.',
 c:`SELECT servicename, service_account FROM sys.dm_server_services;`,see:[2,4,'Service accounts and permissions']},
{t:'sp_configure',s:'Instance settings.',
 a:'`sp_configure` shows and sets options such as `max server memory`, `max degree of parallelism` and `cost threshold for parallelism`. Advanced options need `show advanced options`.',
 w:'Defaults for MAXDOP and cost threshold are rarely right for production.',
 c:`EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure;`,see:[2,5,'Instance settings with sp_configure']},
{t:'Memory and MAXDOP',s:'Three settings to set on every instance.',
 a:'Cap `max server memory` below physical RAM, set `max degree of parallelism` to a sensible value (often up to 8 per NUMA node) and raise `cost threshold for parallelism` from 5 (often 25 to 50).',
 w:'These prevent starved operating systems and excess parallelism.',
 c:`SELECT name, value_in_use FROM sys.configurations WHERE name IN ('max server memory (MB)','max degree of parallelism','cost threshold for parallelism');`,see:[2,6,'Memory, MAXDOP and cost threshold for parallelism']},
{t:'Connectivity',s:'Protocols, ports and names.',
 a:'TCP/IP on port 1433 for the default instance, dynamic ports and SQL Browser (UDP 1434) for named instances. Check protocols in Configuration Manager and test with `sqlcmd`.',
 w:'Most connection problems are network, firewall, name or protocol.',
 c:`sqlcmd -S tcp:server,1433 -E -Q "SELECT 1"`,see:[3,3,'Connection strings, ports and troubleshooting connectivity']},
{t:'DMVs',s:'The instance\'s live telemetry.',
 a:'Dynamic management views expose sessions, requests, waits, I/O and memory. Many are cumulative since restart, so compare snapshots.',
 w:'They are the first stop for any investigation.',
 c:`SELECT session_id, status, wait_type, blocking_session_id FROM sys.dm_exec_requests WHERE session_id > 50;`,see:[3,4,'Dynamic management views overview']}
]},

{h:'Files, log and recovery'},
{acc:[
{t:'Files and filegroups',s:'Where data lives.',
 a:'A database has one **primary** data file (`.mdf`), optional secondary files (`.ndf`) in **filegroups**, and a **log** file (`.ldf`). Tables and indexes are placed on filegroups.',
 w:'The log is sequential and the data files are random: they have different storage needs.',
 c:`SELECT name, physical_name, size*8/1024 AS size_mb, growth FROM sys.master_files WHERE database_id = DB_ID();`,see:[4,0,'Data files, log files and filegroups']},
{t:'Autogrowth and IFI',s:'Avoid growth stalls.',
 a:'Pre-size files and set fixed-size growth increments. **Instant file initialization** lets data files grow without zeroing (log files are always zeroed).',
 w:'Percentage growth and tiny increments cause fragmentation and pauses.',
 c:`SELECT instant_file_initialization_enabled FROM sys.dm_server_services;`,see:[4,2,'Autogrowth, initial size and instant file initialization']},
{t:'Recovery models',s:'SIMPLE, FULL, BULK_LOGGED.',
 a:'**SIMPLE** reuses log space after checkpoint and allows no log backups. **FULL** keeps the log until it is backed up and allows point-in-time recovery. **BULK_LOGGED** minimally logs bulk operations.',
 w:'FULL without log backups fills the disk with log.',
 c:`SELECT name, recovery_model_desc, log_reuse_wait_desc FROM sys.databases;`,see:[4,3,'Recovery models']},
{t:'tempdb',s:'Shared scratch space.',
 a:'**tempdb** holds temporary objects, sort and hash work tables and the version store. Use several equal-sized data files, pre-size them and place on fast storage.',
 w:'Contention and runaway use here affect every database.',
 c:`SELECT SUM(unallocated_extent_page_count)*8/1024 AS free_mb FROM tempdb.sys.dm_db_file_space_usage;`,see:[4,4,'tempdb architecture and configuration']},
{t:'Write-ahead logging',s:'Log first, data later.',
 a:'A change is written to the transaction log before the transaction commits. Data pages are written later by checkpoint. This makes commits fast and crash recovery possible.',
 w:'A slow log disk slows every commit (WRITELOG waits).',
 c:`SELECT TOP 5 wait_type, wait_time_ms FROM sys.dm_os_wait_stats WHERE wait_type = 'WRITELOG';`,see:[5,0,'Write-ahead logging and how the log works']},
{t:'Log reuse wait',s:'Why the log will not shrink.',
 a:'`log_reuse_wait_desc` states what prevents log space reuse: `LOG_BACKUP`, `ACTIVE_TRANSACTION`, `REPLICATION`, `AVAILABILITY_REPLICA` and others.',
 w:'Fix the reason, not the symptom. Shrinking does not help.',
 c:`SELECT name, log_reuse_wait_desc FROM sys.databases;`,see:[5,2,'Log truncation and reuse wait reasons']},
{t:'Crash recovery',s:'Analysis, redo, undo.',
 a:'After a crash, recovery reads the log from the last checkpoint: **analysis** finds what was in flight, **redo** replays committed changes, **undo** rolls back uncommitted ones.',
 w:'It explains long database startup after a crash with a big open transaction.',
 c:`EXEC sp_readerrorlog 0, 1, 'Recovery of database';`,see:[5,4,'Checkpoints and crash recovery']}
]},

{h:'Data, concurrency and maintenance'},
{acc:[
{t:'Indexes',s:'Heap, clustered, nonclustered.',
 a:'A **clustered** index defines the table\'s order and stores the data. **Nonclustered** indexes are separate structures pointing to rows. A heap has no clustered index.',
 w:'Choose a narrow, ever-increasing, unique clustering key.',
 c:`SELECT i.name, i.type_desc FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.Orders');`,see:[6,1,'Heaps, clustered and nonclustered indexes']},
{t:'Isolation levels',s:'What readers see.',
 a:'READ COMMITTED (default) blocks on uncommitted changes. **RCSI** and **SNAPSHOT** use row versions in tempdb so readers do not block writers.',
 w:'RCSI removes much reader-writer blocking at a tempdb cost.',
 c:`SELECT name, is_read_committed_snapshot_on FROM sys.databases;`,see:[7,3,'Read committed snapshot and snapshot isolation']},
{t:'Blocking and deadlocks',s:'Waiting versus a cycle.',
 a:'**Blocking** is one session waiting for another\'s lock. A **deadlock** is a cycle: SQL Server kills one victim (error 1205). Short transactions and good indexes reduce both.',
 w:'Find the head blocker first.',
 c:`SELECT blocking_session_id, session_id, wait_type FROM sys.dm_exec_requests WHERE blocking_session_id <> 0;`,see:[7,4,'Blocking and deadlocks basics']},
{t:'Index and statistics maintenance',s:'Reorganise, rebuild, update.',
 a:'Reorganise lightly fragmented indexes, rebuild heavily fragmented ones and update statistics regularly. Fragmentation matters less on SSDs than outdated statistics do.',
 w:'Use a tested solution such as Ola Hallengren\'s scripts.',
 c:`SELECT TOP 10 * FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED');`,see:[8,0,'Index maintenance: reorganize and rebuild']},
{t:'DBCC CHECKDB',s:'Integrity checks.',
 a:'`DBCC CHECKDB` verifies allocation and structure and detects corruption. Run it regularly, and with `PAGE_VERIFY CHECKSUM` enabled. Restore from backup rather than repair.',
 w:'Corruption found late means older backups are also affected.',
 c:`DBCC CHECKDB (N'MyDb') WITH NO_INFOMSGS, ALL_ERRORMSGS;`,see:[8,2,'DBCC CHECKDB and corruption detection']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Three small maps of how the parts fit together: the instance, storage structure and the log and recovery.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. Instance architecture'},
{map:{title:'Instance map',h:328,trace:'Follow a read and a write',
 hint:'Tap any box, or press Follow a read and a write to see where data and the log go.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[454,80,454,134],[226,192,226,246],[454,80,454,246]],
 nodes:[
 {id:'cli',x:126,y:24,w:200,h:56,c:'ext',t:'Client',s:'TDS over TCP',d:'An application or tool sends T-SQL over the Tabular Data Stream protocol.',why:'Port 1433 by default.',chk:`SELECT client_net_address, encrypt_option FROM sys.dm_exec_connections;`,see:[3,3,'Connection strings, ports and troubleshooting connectivity']},
 {id:'sql',x:354,y:24,w:200,h:56,c:'proc',t:'Relational engine',s:'parse, optimise, execute',d:'Compiles the statement into a plan and executes it, calling the storage engine.',why:'Plans are cached.',chk:`SELECT TOP 5 text FROM sys.dm_exec_cached_plans CROSS APPLY sys.dm_exec_sql_text(plan_handle);`,see:[1,4,'How a query is processed']},
 {id:'bp',x:126,y:136,w:200,h:56,c:'mem',t:'Buffer pool',s:'cached pages',d:'Pages are read here from disk and changed here.',why:'Set max server memory.',chk:`SELECT COUNT(*)*8/1024 AS cached_mb FROM sys.dm_os_buffer_descriptors;`,see:[1,5,'Buffer pool and the memory architecture']},
 {id:'log',x:354,y:136,w:200,h:56,c:'disk',t:'Transaction log',s:'write-ahead',d:'Every change is hardened here before commit.',why:'Sequential, latency-sensitive.',chk:`SELECT * FROM sys.dm_io_virtual_file_stats(DB_ID(), 2);`,see:[5,0,'Write-ahead logging']},
 {id:'mdf',x:126,y:248,w:200,h:56,c:'disk',t:'Data files',s:'pages on disk',d:'Dirty pages are written by checkpoint and lazy writer.',why:'Random I/O.',chk:`SELECT * FROM sys.dm_io_virtual_file_stats(DB_ID(), 1);`,see:[4,0,'Data files, log files and filegroups']},
 {id:'tmp',x:354,y:248,w:200,h:56,c:'disk',t:'tempdb',s:'scratch',d:'Work tables, sorts, temp tables and row versions.',why:'Many equal files.',chk:`SELECT * FROM sys.dm_db_session_space_usage;`,see:[4,4,'tempdb architecture and configuration']}],
 steps:[
 {ids:['cli','sql'],t:'1. The client sends a request and the engine compiles it.',w:'Plan reuse saves CPU.',s:'Plan cache.',x:'Plan bloat.',c:`SELECT COUNT(*) FROM sys.dm_exec_cached_plans;`},
 {ids:['bp','mdf'],t:'2. A read looks in the buffer pool first, and goes to disk if the page is missing.',w:'Cache hit is fast.',s:'Memory.',x:'Memory pressure.',c:`SELECT * FROM sys.dm_os_wait_stats WHERE wait_type LIKE 'PAGEIOLATCH%';`},
 {ids:['log'],t:'3. A write changes the page in memory and writes the log record before commit.',w:'Durable at commit.',s:'Log disk.',x:'WRITELOG waits.',c:`SELECT * FROM sys.dm_io_virtual_file_stats(DB_ID(), 2);`},
 {ids:['mdf','tmp'],t:'4. Checkpoint later writes dirty pages to the data files. Sorts and versions use tempdb.',w:'Lazy data write.',s:'Checkpoint.',x:'tempdb full.',c:`SELECT * FROM sys.dm_db_file_space_usage;`}]}},

{h:'2. Storage structure'},
{map:{title:'Storage map',h:216,trace:'From database to row',
 hint:'Tap any box, or press From database to row to follow the storage hierarchy.',
 lines:[[326,52,352,52],'M454 80 L454 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'db',x:126,y:24,w:200,h:56,c:'ext',t:'Database',s:'files and filegroups',d:'A set of data and log files.',why:'One log, many data files.',chk:`SELECT * FROM sys.database_files;`,see:[4,0,'Data files, log files and filegroups']},
 {id:'fg',x:354,y:24,w:200,h:56,c:'mem',t:'Filegroup',s:'placement',d:'A named group of files on which objects are placed.',why:'PRIMARY is the default.',chk:`SELECT * FROM sys.filegroups;`,see:[4,0,'Data files, log files and filegroups']},
 {id:'file',x:20,y:136,w:139,h:56,c:'disk',t:'Data file',s:'.mdf or .ndf',d:'The file on disk, with proportional fill across a filegroup.',why:'Equal sizes.',chk:`SELECT name, size, growth FROM sys.database_files;`,see:[4,2,'Autogrowth, initial size and instant file initialization']},
 {id:'ext',x:187,y:136,w:139,h:56,c:'mem',t:'Extent',s:'8 pages',d:'A 64 KB allocation unit: uniform or mixed.',why:'Allocation maps track it.',chk:`DBCC EXTENTINFO (0, 0, -1);`,see:[1,3,'Pages, extents and allocation units']},
 {id:'pg',x:354,y:136,w:139,h:56,c:'mem',t:'Page',s:'8 KB',d:'The unit of I/O and caching.',why:'Header, rows, slot array.',chk:`DBCC PAGE (0, 1, 1, 3);`,see:[1,3,'Pages, extents and allocation units']},
 {id:'row',x:521,y:136,w:139,h:56,c:'mem',t:'Row',s:'record',d:'Fixed and variable-length columns, up to about 8 KB in row.',why:'Large values go off row.',chk:`SELECT * FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'DETAILED');`,see:[6,0,'Choosing data types']}],
 steps:[
 {ids:['db','fg'],t:'1. A database owns filegroups, and filegroups own files.',w:'Placement control.',s:'Filegroups.',x:'Everything in PRIMARY.',c:`SELECT * FROM sys.filegroups;`},
 {ids:['file','ext'],t:'2. Files are carved into extents.',w:'Allocation unit.',s:'Growth.',x:'Mixed extents in small tables.',c:`SELECT * FROM sys.database_files;`},
 {ids:['pg','row'],t:'3. Extents hold pages and pages hold rows.',w:'The lowest level.',s:'Page size.',x:'Wide rows waste space.',c:`DBCC PAGE (0, 1, 1, 3);`}]}},

{h:'3. Log and recovery'},
{map:{title:'Log and recovery map',h:328,trace:'How a commit survives a crash',
 hint:'Tap any box, or press How a commit survives a crash to follow a change from memory to a recovered database.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'tx',x:126,y:24,w:200,h:56,c:'ext',t:'Transaction',s:'begin, change, commit',d:'Work against pages in the buffer pool.',why:'Short transactions.',chk:`SELECT * FROM sys.dm_tran_active_transactions;`,see:[7,0,'ACID and transactions']},
 {id:'lb',x:354,y:24,w:200,h:56,c:'mem',t:'Log buffer',s:'in memory',d:'Log records accumulate here.',why:'Flushed at commit.',chk:`SELECT cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Log Flushes/sec';`,see:[5,0,'Write-ahead logging']},
 {id:'lf',x:126,y:136,w:200,h:56,c:'disk',t:'Log file',s:'VLFs',d:'Records are written sequentially in virtual log files.',why:'Too many VLFs slow recovery.',chk:`SELECT * FROM sys.dm_db_log_info(DB_ID());`,see:[5,1,'Virtual log files and sizing']},
 {id:'chk',x:354,y:136,w:200,h:56,c:'proc',t:'Checkpoint',s:'writes dirty pages',d:'Writes dirty data pages to the data files periodically.',why:'Bounds recovery time.',chk:`CHECKPOINT;`,see:[5,4,'Checkpoints and crash recovery']},
 {id:'dpg',x:126,y:248,w:200,h:56,c:'disk',t:'Data pages',s:'on disk',d:'Updated after commit, not at commit.',why:'Crash leaves some stale.',chk:`SELECT * FROM sys.dm_io_virtual_file_stats(DB_ID(), 1);`,see:[4,0,'Data files, log files and filegroups']},
 {id:'rec',x:354,y:248,w:200,h:56,c:'proc',t:'Recovery',s:'analysis, redo, undo',d:'After a crash, redo committed work and undo uncommitted work.',why:'Time depends on the open work.',chk:`EXEC sp_readerrorlog 0, 1, 'Recovery';`,see:[5,4,'Checkpoints and crash recovery']}],
 steps:[
 {ids:['tx','lb'],t:'1. A transaction changes pages and writes log records to the log buffer.',w:'Logging precedes data.',s:'Log buffer.',x:'Large transactions.',c:`SELECT * FROM sys.dm_tran_database_transactions;`},
 {ids:['lf'],t:'2. At commit, the buffer is flushed to the log file.',w:'Durable.',s:'Log latency.',x:'WRITELOG waits.',c:`SELECT * FROM sys.dm_io_virtual_file_stats(DB_ID(), 2);`},
 {ids:['chk','dpg'],t:'3. Checkpoint later writes the data pages.',w:'Recovery point moves forward.',s:'Recovery interval.',x:'Long checkpoints.',c:`CHECKPOINT;`},
 {ids:['rec'],t:'4. After a crash, recovery replays the log from the checkpoint.',w:'Consistent state.',s:'VLF count.',x:'Long undo.',c:`EXEC sp_readerrorlog;`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Three small maps of how something happens, step by step: a query, a full log and a daily health check.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Life of a query'},
{map:{title:'Query map',h:216,trace:'From T-SQL to results',
 hint:'Tap any box, or press From T-SQL to results to follow a statement.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'parse',x:21,y:24,w:194,h:56,c:'mem',t:'Parse',s:'syntax',d:'Check the syntax and build a parse tree.',why:'Errors stop here.',chk:`SET PARSEONLY ON;`,see:[1,4,'How a query is processed']},
 {id:'bind',x:243,y:24,w:194,h:56,c:'mem',t:'Bind',s:'objects and permissions',d:'Resolve names and check permissions.',why:'Invalid object name errors.',chk:`SELECT OBJECT_ID('dbo.Orders');`,see:[1,4,'How a query is processed']},
 {id:'opt',x:465,y:24,w:194,h:56,c:'proc',t:'Optimise',s:'cost-based',d:'Choose a plan using statistics and costs.',why:'Estimates matter.',chk:`SET SHOWPLAN_XML ON;`,see:[1,4,'How a query is processed']},
 {id:'cache',x:21,y:136,w:194,h:56,c:'mem',t:'Plan cache',s:'reuse',d:'Plans are cached by query text and parameters.',why:'Parameterise.',chk:`SELECT usecounts, size_in_bytes FROM sys.dm_exec_cached_plans;`,see:[1,4,'How a query is processed']},
 {id:'exec',x:243,y:136,w:194,h:56,c:'proc',t:'Execute',s:'operators',d:'The plan\'s operators run and pull pages through the buffer pool.',why:'Waits show here.',chk:`SELECT * FROM sys.dm_exec_requests;`,see:[1,1,'SQLOS, schedulers and workers']},
 {id:'res',x:465,y:136,w:194,h:56,c:'ext',t:'Results',s:'returned',d:'Rows stream to the client, subject to network speed and client reads.',why:'ASYNC_NETWORK_IO means a slow client.',chk:`SELECT wait_type FROM sys.dm_os_wait_stats WHERE wait_type='ASYNC_NETWORK_IO';`,see:[1,1,'SQLOS, schedulers and workers']}],
 steps:[
 {ids:['parse','bind'],t:'1. Parse and bind the statement.',w:'Valid and permitted.',s:'Permissions.',x:'Missing object.',c:`SELECT OBJECT_ID('dbo.Orders');`},
 {ids:['opt','cache'],t:'2. Optimise, or reuse a cached plan.',w:'Compile cost saved.',s:'Parameterisation.',x:'Plan bloat.',c:`SELECT COUNT(*) FROM sys.dm_exec_cached_plans;`},
 {ids:['exec','res'],t:'3. Execute and return results.',w:'Waits and I/O show here.',s:'Memory grant.',x:'Spills to tempdb.',c:`SELECT * FROM sys.dm_exec_query_memory_grants;`}]}},

{h:'2. Troubleshooting a full transaction log'},
{map:{title:'Full log map',h:328,trace:'Find why the log cannot be reused',
 hint:'Tap any box, or press Find why the log cannot be reused to follow the checks.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'err',x:126,y:24,w:200,h:56,c:'warn',t:'Error 9002',s:'log is full',d:'The log cannot grow or has no reusable space.',why:'Do not restart first.',chk:`SELECT name, log_reuse_wait_desc FROM sys.databases;`,see:[5,3,'Troubleshooting a full transaction log']},
 {id:'rw',x:354,y:24,w:200,h:56,c:'mem',t:'log_reuse_wait_desc',s:'the reason',d:'Names what blocks log truncation.',why:'Fix that reason.',chk:`SELECT name, log_reuse_wait_desc FROM sys.databases;`,see:[5,2,'Log truncation and reuse wait reasons']},
 {id:'bk',x:126,y:136,w:200,h:56,c:'proc',t:'LOG_BACKUP',s:'take a log backup',d:'In FULL recovery, truncation waits for a log backup.',why:'Schedule them often.',chk:`BACKUP LOG MyDb TO DISK = N'X:\\bk\\MyDb.trn';`,see:[5,2,'Log truncation and reuse wait reasons']},
 {id:'tx',x:354,y:136,w:200,h:56,c:'warn',t:'ACTIVE_TRANSACTION',s:'open transaction',d:'A long transaction holds the log.',why:'Find and end it.',chk:`DBCC OPENTRAN;`,see:[5,3,'Troubleshooting a full transaction log']},
 {id:'fix',x:240,y:248,w:200,h:56,c:'proc',t:'Fix and resize',s:'right-size the log',d:'Resolve the cause, then size the log for the real workload.',why:'Avoid shrink cycles.',chk:`ALTER DATABASE MyDb MODIFY FILE (NAME = MyDb_log, SIZE = 8GB);`,see:[5,1,'Virtual log files and sizing']}],
 steps:[
 {ids:['err','rw'],t:'1. Read the reuse wait for the database.',w:'It says what to fix.',s:'DMVs.',x:'Shrinking blindly.',c:`SELECT name, log_reuse_wait_desc FROM sys.databases;`},
 {ids:['bk','tx'],t:'2. Take a log backup or end the open transaction.',w:'Space becomes reusable.',s:'Backup chain.',x:'Breaking the chain.',c:`DBCC OPENTRAN;`},
 {ids:['fix'],t:'3. Size the log properly and monitor.',w:'No repeat.',s:'Alerts.',x:'Growth on a full disk.',c:`SELECT * FROM sys.dm_db_log_space_usage;`}]}},

{h:'3. Daily health check'},
{map:{title:'Health check map',h:216,trace:'A short daily routine',
 hint:'Tap any box, or press A short daily routine to follow the checks.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'jobs',x:126,y:24,w:200,h:56,c:'mem',t:'Agent jobs',s:'failures',d:'Review failed jobs in the last day.',why:'Alert on failure.',chk:`SELECT TOP 20 j.name, h.run_status FROM msdb.dbo.sysjobhistory h JOIN msdb.dbo.sysjobs j ON j.job_id = h.job_id WHERE h.run_status = 0 ORDER BY h.instance_id DESC;`,see:[9,3,'DBA daily, weekly and monthly routines']},
 {id:'bk',x:354,y:24,w:200,h:56,c:'mem',t:'Backups',s:'age',d:'Check the age of the last full and log backups.',why:'Compare to RPO.',chk:`SELECT database_name, MAX(backup_finish_date) FROM msdb.dbo.backupset GROUP BY database_name;`,see:[9,0,'Production readiness checklist']},
 {id:'err',x:21,y:136,w:194,h:56,c:'warn',t:'Error log',s:'severity 17+',d:'Scan the error log for errors and I/O warnings.',why:'Look for 823, 824, 825.',chk:`EXEC sp_readerrorlog 0, 1, 'error';`,see:[9,3,'DBA daily, weekly and monthly routines']},
 {id:'sp',x:243,y:136,w:194,h:56,c:'mem',t:'Space',s:'files and disks',d:'Check free space in files and on volumes.',why:'Track growth.',chk:`SELECT * FROM sys.dm_os_volume_stats(DB_ID(), 1);`,see:[4,2,'Autogrowth, initial size and instant file initialization']},
 {id:'dsk',x:465,y:136,w:194,h:56,c:'mem',t:'Performance',s:'waits and blocking',d:'Look for blocking and top waits.',why:'Compare to baseline.',chk:`SELECT TOP 5 * FROM sys.dm_os_wait_stats ORDER BY wait_time_ms DESC;`,see:[9,1,'Baselines and documentation']}],
 steps:[
 {ids:['jobs','bk'],t:'1. Check failed jobs and backup age.',w:'Protects recovery.',s:'Alerts.',x:'Silent failures.',c:`SELECT * FROM msdb.dbo.sysjobhistory WHERE run_status = 0;`},
 {ids:['err','sp'],t:'2. Scan the error log and space.',w:'Early warnings.',s:'Thresholds.',x:'Disk fills.',c:`EXEC sp_readerrorlog;`},
 {ids:['dsk'],t:'3. Compare performance with the baseline.',w:'Spot drift.',s:'Baseline.',x:'No baseline.',c:`SELECT * FROM sys.dm_os_wait_stats;`}]}},

]},

{t:'Instance settings and defaults',d:'Settings to review on every new instance and the values usually recommended.',see:[[2,5,'Instance settings with sp_configure'],[2,6,'Memory, MAXDOP and cost threshold for parallelism']],b:[
{t:[['Setting','Default','Typical production value','Note'],['`max server memory (MB)`','2147483647','RAM minus OS and other needs','Leave 10 to 20 percent'],['`max degree of parallelism`','0','Up to 8, per NUMA node','Test with the workload'],['`cost threshold for parallelism`','5','25 to 50','Reduces trivial parallel plans'],['`optimize for ad hoc workloads`','0','1','Reduces plan cache bloat'],['`backup compression default`','0','1','Saves space and time'],['`remote admin connections`','0','1','Enables the DAC remotely'],['Instant file initialization','Off','On','Grant the volume maintenance right'],['tempdb files','1 to 8','Equal-sized, 4 to 8','Pre-size'],['Database `PAGE_VERIFY`','CHECKSUM','CHECKSUM','Never NONE'],['Database `AUTO_SHRINK`','OFF','OFF','Fragments and wastes I/O'],['Database `AUTO_CLOSE`','OFF','OFF','Avoid on servers']]}
]},
{t:'Diagnostic queries',d:'A short list of queries that answer common questions quickly.',see:[[3,4,'Dynamic management views overview'],[7,4,'Blocking and deadlocks basics']],b:[
{t:[['Question','Query'],['Who is connected?','`SELECT * FROM sys.dm_exec_sessions WHERE is_user_process = 1;`'],['What is running now?','`SELECT * FROM sys.dm_exec_requests;`'],['Who is blocking?','`SELECT blocking_session_id, session_id FROM sys.dm_exec_requests WHERE blocking_session_id > 0;`'],['Top waits','`SELECT TOP 10 wait_type, wait_time_ms FROM sys.dm_os_wait_stats ORDER BY wait_time_ms DESC;`'],['File latency','`SELECT * FROM sys.dm_io_virtual_file_stats(NULL, NULL);`'],['Log reuse reason','`SELECT name, log_reuse_wait_desc FROM sys.databases;`'],['Last backups','`SELECT database_name, MAX(backup_finish_date) FROM msdb.dbo.backupset GROUP BY database_name;`'],['Open transactions','`DBCC OPENTRAN;`'],['Error log','`EXEC sp_readerrorlog;`'],['Configuration','`SELECT name, value_in_use FROM sys.configurations ORDER BY name;`']]}
]},
]};
