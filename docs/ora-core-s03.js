/* LearnSphere - Oracle Core DBA, Section 03: Architecture: Instance, Memory & Processes.
   Lectures 0-8 are core, 9-13 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const big=O.dg(700,290,[
[10,100,110,60,'User process|SQL*Plus, app',0],
[160,100,110,60,'Server process|(one per session)|with its PGA',2],
[310,10,380,270,'Oracle instance and database',1],
[330,45,350,110,'SGA (shared memory)|buffer cache | shared pool | redo buffer | large pool',2],
[330,170,170,95,'Background processes|DBWn LGWR CKPT|SMON PMON',0],
[520,170,160,95,'Database files|datafiles, redo logs,|control files',0]],
[[120,130,160,130],[270,115,330,100],[270,150,330,215],[500,217,520,217]]);

const sga=O.dg(700,250,[
[10,10,680,230,'System Global Area (SGA): memory shared by all processes',1],
[30,45,200,70,'Database buffer cache|copies of data blocks',2],[250,45,200,70,'Shared pool|library cache, dictionary cache|SQL and PL/SQL',2],[470,45,200,70,'Redo log buffer|changes waiting for LGWR',2],
[30,135,200,60,'Large pool|RMAN, shared server memory',0],[250,135,200,60,'Java pool, Streams pool',0],[470,135,200,60,'In-Memory area (optional)',0],
[30,205,640,25,'Fixed SGA: bookkeeping of the instance',0]],[]);

const logical=O.dg(700,160,[
[10,50,140,60,'Tablespace|logical container',2],[190,50,140,60,'Segment|a table or index',0],[370,50,140,60,'Extent|set of blocks',0],[550,50,140,60,'Data block|8 KB by default',0],
[10,125,680,28,'Each tablespace is stored physically in one or more datafiles',0]],
[[150,80,190,80],[330,80,370,80],[510,80,550,80]]);

/* ---------- 0: Big picture ---------- */
L['ora-core:2:0']={blocks:[
{p:'Everything in Oracle follows one pattern: a **user process** asks, a **server process** does the work, the **instance** holds memory and background workers, and the **database** is the files on disk.'},
{svg:big},
{h:'The four parts'},
{t:[['Part','What it is','Lives in'],
['**User process**','Your tool or application (SQL*Plus, a Java app)','Client machine'],
['**Server process**','Does the work for one session: parses, reads, changes','Database server'],
['**Instance**','SGA memory plus background processes','Server memory'],
['**Database**','Datafiles, redo logs, control files','Disk']]},
{h:'Connection and session'},
{ul:['A **connection** is the network path between the user process and the server.','A **session** is one logged-in user inside the instance.','One connection can carry one session, and the server process handles it.']},
{h:'A request in order'},
{flow:['User process connects through the listener','Listener starts or assigns a server process','Server process allocates its PGA','Server process uses the SGA to read and change data','Background processes write data and redo to disk']},
{h:'Memory in two groups'},
{t:[['','SGA','PGA'],
['**Shared by**','All sessions','One server process only'],
['**Holds**','Cached data blocks, SQL, redo','Sorts, hash joins, session state'],
['**Created**','At instance startup','When a session connects']]},
{note:'Keep this picture in mind. Every later lecture in this section zooms into one box of it.'}],
src:[['Oracle Database Concepts: Oracle Database Instance',O.CN+'oracle-database-instance.html'],['Memory architecture',O.CN+'memory-architecture.html']]};

/* ---------- 1: SGA ---------- */
L['ora-core:2:1']={blocks:[
{p:'The **System Global Area (SGA)** is the big block of shared memory created when the instance starts. All sessions and background processes use it.'},
{svg:sga},
{h:'Main components'},
{t:[['Component','Job','Parameter'],
['**Database buffer cache**','Holds copies of data blocks so repeated reads avoid the disk','`DB_CACHE_SIZE`'],
['**Shared pool**','Stores parsed SQL (library cache) and data dictionary information (dictionary cache)','`SHARED_POOL_SIZE`'],
['**Redo log buffer**','Collects redo entries before LGWR writes them','`LOG_BUFFER`'],
['**Large pool**','Memory for RMAN, parallel execution and shared server','`LARGE_POOL_SIZE`'],
['**Java pool**','Memory for Java code inside the database','`JAVA_POOL_SIZE`'],
['**In-Memory area**','Optional column store (extra cost option)','`INMEMORY_SIZE`']]},
{h:'The two that matter most'},
{ul:['**Buffer cache hit:** the block is in memory, no disk read. This is fast.','**Shared pool hit:** the SQL is already parsed, so a soft parse reuses it. A new statement needs a hard parse, which is costly.']},
{flow:['SQL arrives','Look in the library cache','Found: soft parse, reuse the plan','Not found: hard parse, build a plan and store it']},
{h:'Sizing is automatic by default'},
{p:'With `SGA_TARGET` set, Oracle shares the memory between the components automatically. Section 5 covers it.'},
{h:'Look at your SGA'},
{code:`SHOW SGA

SELECT component, ROUND(current_size/1024/1024) AS mb
FROM   v$sga_dynamic_components
WHERE  current_size > 0;

SELECT name, ROUND(bytes/1024/1024) AS mb FROM v$sgainfo;`},
{note:'Bigger is not always better. An oversized SGA can starve the operating system and cause swapping, which is far slower than a smaller cache.'}],
src:[['SGA',O.CN+'memory-architecture.html'],['V$SGAINFO',O.RF+'V-SGAINFO.html']]};

/* ---------- 2: PGA ---------- */
L['ora-core:2:2']={blocks:[
{p:'The **Program Global Area (PGA)** is private memory owned by one server process. Other sessions cannot read it. It holds the working data of your own statements.'},
{h:'What lives in the PGA'},
{t:[['Area','Use'],
['**Sort area**','ORDER BY, GROUP BY, index builds'],
['**Hash area**','Hash joins'],
['**Session memory**','Variables and settings of the session (in dedicated server mode)'],
['**Cursor state**','Current position of open cursors']]},
{h:'Work areas'},
{p:'A **work area** is the part of the PGA a memory-heavy operation uses. Oracle gives each one as much memory as is reasonable, and the operation runs in three ways:'},
{t:[['Mode','What happens','Speed'],
['**Optimal**','Everything fits in memory','Fastest'],
['**One-pass**','Spills to temp once','Slower'],
['**Multi-pass**','Spills to temp repeatedly','Slowest']]},
{h:'Automatic PGA management'},
{t:[['Parameter','Meaning'],
['`PGA_AGGREGATE_TARGET`','Soft target for all PGA memory of the instance'],
['`PGA_AGGREGATE_LIMIT`','Hard limit. Oracle ends sessions that push total PGA above it.'],
['`MEMORY_TARGET`','One setting for SGA and PGA together (automatic memory management)']]},
{flow:['A session starts a large sort','Oracle checks the work area budget','Enough memory: sort in memory (optimal)','Not enough: spill to the temporary tablespace']},
{h:'Look at your PGA'},
{code:`SELECT name, ROUND(value/1024/1024) AS mb
FROM   v$pgastat
WHERE  name IN ('aggregate PGA target parameter','total PGA allocated','maximum PGA allocated');

SHOW PARAMETER pga`},
{note:'Many sessions with big sorts can exhaust memory. This is why `PGA_AGGREGATE_LIMIT` exists: it protects the server from a runaway session.'}],
src:[['PGA',O.CN+'memory-architecture.html'],['Managing memory',O.AD+'managing-memory.html']]};

/* ---------- 3: Background processes ---------- */
L['ora-core:2:3']={blocks:[
{p:'Background processes are the workers that keep the instance healthy. You can see them with `ps -ef | grep ora_`, and each name tells you its job.'},
{h:'The processes you must know'},
{t:[['Process','Full name','Job'],
['**DBWn**','Database Writer','Writes changed (dirty) blocks from the buffer cache to the datafiles'],
['**LGWR**','Log Writer','Writes redo from the redo buffer to the online redo log files'],
['**CKPT**','Checkpoint','Signals a checkpoint and records it in the control file and datafile headers'],
['**SMON**','System Monitor','Instance recovery at startup and cleaning of temporary space'],
['**PMON**','Process Monitor','Cleans up after failed sessions and releases their locks'],
['**LREG**','Listener Registration','Registers services with the listener'],
['**ARCn**','Archiver','Copies filled redo logs to archive logs (in ARCHIVELOG mode)'],
['**MMON / MMNL**','Manageability monitor','Collect statistics and AWR snapshots']]},
{h:'When do they write?'},
{t:[['Process','Writes when'],
['**LGWR**','A user commits, every 3 seconds, when the redo buffer is one third full, or before DBWn writes dirty blocks'],
['**DBWn**','A checkpoint occurs, the buffer cache needs free buffers, or a tablespace goes offline'],
['**CKPT**','Regularly, and at log switches']]},
{flow:['Commit','LGWR writes redo to disk (the commit is now durable)','DBWn writes the data blocks later','CKPT records how far recovery would need to start']},
{note:'Key idea: Oracle writes the redo immediately and the data blocks lazily. This is why commits are fast and why a crash can be recovered from redo.'},
{h:'See them'},
{code:`# On Linux
ps -ef | grep ora_ | grep FREE

-- In SQL
SELECT name, description FROM v$bgprocess WHERE paddr <> '00' ORDER BY name;`},
{p:'If PMON, SMON, DBWn, LGWR or CKPT dies, the instance stops. Others are restarted automatically.'}],
src:[['Background processes',O.CN+'process-architecture.html'],['V$BGPROCESS',O.RF+'V-BGPROCESS.html']]};

/* ---------- 4: SELECT, DML, COMMIT ---------- */
L['ora-core:2:4']={blocks:[
{p:'Follow three simple statements through the instance and you will understand most of Oracle architecture.'},
{h:'SELECT'},
{flow:['Parse: check syntax and find or create the plan in the shared pool','Find the block in the buffer cache','Cache miss: read the block from the datafile into the cache','If the block changed since the query began, rebuild the old version from undo (read consistency)','Return the rows']},
{h:'DML (INSERT, UPDATE, DELETE)'},
{flow:['Parse and find the block, as for SELECT','Lock the rows','Write the old values to undo (so it can be rolled back)','Change the block in the buffer cache (it becomes dirty)','Write redo for both the change and the undo to the redo buffer']},
{h:'COMMIT'},
{flow:['Server process asks LGWR to write the redo to disk','LGWR writes and confirms (the wait is called log file sync)','Oracle records the commit and releases the locks','The user gets Commit complete','DBWn writes the dirty blocks later']},
{h:'ROLLBACK'},
{p:'Rollback restores the old values from **undo** and releases the locks. The redo for the rollback is written too, so the change and its reversal are both recoverable.'},
{h:'Why this design is fast and safe'},
{t:[['Feature','Reason'],
['Redo written at commit, data blocks later','One small sequential write instead of many random ones'],
['Undo kept in the database','Rollback and read consistency without blocking readers'],
['Dirty blocks stay in cache','Hot data is rewritten in memory many times before it reaches disk']]},
{h:'What if the server crashes before DBWn writes?'},
{flow:['Crash: committed changes exist in redo but not in the datafiles','Restart: SMON performs instance recovery','Roll forward: redo is applied to the datafiles','Roll back: uncommitted changes are removed using undo']},
{note:'A commit is durable once its redo is on disk. The datafiles do not need to be up to date.'}],
src:[['Transactions',O.CN+'transactions.html'],['Instance recovery',O.CN+'oracle-database-instance.html']]};

/* ---------- 5: Dedicated vs shared ---------- */
L['ora-core:2:5']={blocks:[
{p:'Every session needs a server process. Oracle offers two ways to provide it: **dedicated** and **shared**.'},
{h:'The two models'},
{t:[['','Dedicated server','Shared server'],
['**Server process**','One per session','A small pool shared by many sessions'],
['**Memory (session)**','In the PGA','In the SGA (large pool)'],
['**Default**','**Yes**','No, you configure it'],
['**Best for**','Most workloads, long queries, batch jobs','Very many mostly idle connections'],
['**Extra processes**','None','Dispatchers (Dnnn) and shared servers (Snnn)']]},
{h:'How a shared server request flows'},
{flow:['Client connects to a dispatcher through the listener','Dispatcher puts the request on a queue','A free shared server process takes it','The shared server runs it and returns the result to the dispatcher','Dispatcher sends the answer to the client']},
{h:'Checking which one a session uses'},
{code:`SELECT username, server FROM v$session WHERE username IS NOT NULL;
-- DEDICATED or SHARED or NONE`},
{h:'Configure shared server'},
{code:`ALTER SYSTEM SET shared_servers = 5;
ALTER SYSTEM SET dispatchers = '(PROTOCOL=TCP)(DISPATCHERS=2)';`},
{p:'A client can force a dedicated server even if shared is on, by adding `(SERVER=DEDICATED)` to its connect descriptor. DBAs and batch jobs usually do this.'},
{note:'Modern systems with many connections often use connection pools in the application or Database Resident Connection Pooling (DRCP) instead of shared server. Section 6 shows where this fits.'}],
src:[['Configuring shared server',D+'admin/configuring-a-database-for-shared-server.html'],['Process architecture',O.CN+'process-architecture.html']]};

/* ---------- 6: Physical structures ---------- */
L['ora-core:2:6']={blocks:[
{p:'The **physical structures** are the files that make up a database. A DBA must know what each file is, where it is and what happens if it is lost.'},
{t:[['File','What it holds','If lost'],
['**Datafiles** (`.dbf`)','Tables, indexes and undo','Restore from backup and recover'],
['**Control file** (`.ctl`)','Database name, file locations, checkpoint, backup info','Restore a copy. Keep several copies.'],
['**Online redo logs**','Recent changes, used for recovery','Recover from a surviving member, or restore'],
['**Archived redo logs**','Copies of filled redo logs','Needed for recovery from a backup'],
['**Parameter file** (`spfile` or `pfile`)','Instance settings','Re-create from a pfile or backup'],
['**Password file**','Passwords for administrative users','Re-create with `orapwd`'],
['**Temp files**','Sort and temporary data','Re-create (no data to restore)'],
['**Alert log and traces**','Messages and diagnostics (in the ADR)','Not needed to run, but needed to troubleshoot']]},
{h:'How they work together'},
{flow:['Instance starts and reads the parameter file','It reads the control file to find all other files','It opens datafiles and online redo logs','Changes go to the buffer cache and the redo log','Datafiles are updated at checkpoints']},
{h:'See your files'},
{code:`SELECT name FROM v$datafile;
SELECT member FROM v$logfile;
SELECT name FROM v$controlfile;
SELECT name FROM v$tempfile;
SHOW PARAMETER spfile
SELECT * FROM v$pwfile_users;`},
{note:'Rule of thumb: datafiles can be restored, but the control file and redo logs are the heart of recovery. Multiplex them on separate disks.'}],
src:[['Physical storage structures',O.CN+'physical-storage-structures.html'],['Managing control files',O.AD+'managing-control-files.html']]};

/* ---------- 7: Logical structures ---------- */
L['ora-core:2:7']={blocks:[
{p:'**Logical structures** describe how Oracle organises data inside the files. You think in tablespaces, segments and extents, while the files stay hidden behind them.'},
{svg:logical},
{h:'The hierarchy'},
{t:[['Level','Meaning','Example'],
['**Tablespace**','A named storage area. Holds segments.','`USERS`, `SYSTEM`, `UNDOTBS1`'],
['**Segment**','All the storage of one object','A table, an index, an undo segment'],
['**Extent**','A set of contiguous blocks given to a segment together','Grows as the table grows'],
['**Data block**','Smallest unit Oracle reads or writes','8 KB by default']]},
{h:'Standard tablespaces'},
{t:[['Tablespace','Purpose'],
['`SYSTEM`','Data dictionary. Never store user data here.'],
['`SYSAUX`','Auxiliary data: AWR, scheduler, many components'],
['`UNDO`','Old values for rollback and read consistency'],
['`TEMP`','Temporary sort space'],
['`USERS`','Default place for user objects']]},
{h:'Query it'},
{code:`SELECT tablespace_name, block_size, status FROM dba_tablespaces;

SELECT segment_type, COUNT(*) FROM dba_segments
WHERE  owner = 'HR' GROUP BY segment_type;

SELECT segment_name, extent_id, blocks
FROM   dba_extents WHERE owner = 'HR' AND segment_name = 'EMPLOYEES';`},
{flow:['You create a table in a tablespace','Oracle creates a segment for it','The segment gets extents as rows are added','Extents consist of blocks in the tablespace datafiles']},
{note:'The block size is set when the database is created (`DB_BLOCK_SIZE`, normally 8192) and cannot be changed afterwards.'}],
src:[['Logical storage structures',O.CN+'logical-storage-structures.html']]};

/* ---------- 8: Data dictionary ---------- */
L['ora-core:2:8']={blocks:[
{p:'Oracle describes itself in tables. These tables and the views on top of them are the **data dictionary**. As a DBA you will query it all day.'},
{h:'Two kinds of views'},
{t:[['','Static data dictionary','Dynamic performance views'],
['**Names**','`USER_`, `ALL_`, `DBA_`, `CDB_`','`V$` and `GV$`'],
['**Information**','Objects, users, privileges, storage','Live state of the instance'],
['**Source**','Real tables in the SYSTEM tablespace','Memory structures and the control file'],
['**Available when**','Database is **open**','As soon as the instance is **started**'],
['**Resets on restart?**','No','Yes, counters start again']]},
{h:'The prefixes'},
{t:[['Prefix','Shows'],
['`USER_`','Objects you own'],
['`ALL_`','Objects you can access'],
['`DBA_`','Everything (needs DBA privilege)'],
['`CDB_`','`DBA_` data for all containers (from the root)'],
['`V$`','Instance data. `GV$` adds the instance number for RAC.']]},
{flow:['Instance started, not mounted: V$ views for the instance only','Mounted: V$ views that read the control file work','Open: DBA_ views work too']},
{h:'How to find the right view'},
{code:`-- List dictionary views by name
SELECT table_name, comments FROM dictionary
WHERE  table_name LIKE 'DBA_TAB%';

-- Describe columns of a view
DESC dba_tablespaces

-- Which views exist for sessions?
SELECT table_name FROM dictionary WHERE table_name LIKE 'V$SESS%';`},
{h:'Four views to remember'},
{t:[['View','Question it answers'],
['`V$INSTANCE`','Is the instance up, and which version?'],
['`V$SESSION`','Who is connected and what are they running?'],
['`DBA_USERS`','Which accounts exist?'],
['`DBA_TABLESPACES`','Which storage areas exist?']]},
{note:'Never change dictionary tables directly. Only Oracle code and DDL such as CREATE TABLE are allowed to. Direct changes can corrupt the database and void support.'}],
src:[['Data dictionary and dynamic performance views',O.CN+'data-dictionary-and-dynamic-performance-views.html'],['Database Reference',O.RF]]};

})();
