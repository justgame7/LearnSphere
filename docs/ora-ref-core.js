/* LearnSphere - Oracle Core DBA Quick Reference (cheat sheet).
   window.QREF['ora-core'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Blocks are the same as lessons: {h}, {p}, {t:[header,...rows]}, {code}, {note}, {ul}, {flow}.
   Values are for Oracle Database 19c on Linux unless stated; 26ai differences are marked. Check a setting on your own system with:
   SELECT name, value, isdefault, issys_modifiable FROM v$parameter WHERE name = '...'; */
window.QREF=window.QREF||{};
window.QREF['ora-core']={title:'Oracle Core DBA Quick Reference',blurb:'Processes, files, locations, logs, parameters, views, tools and fixes for a single Oracle database, one page each.',hint:'redo or listener',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every Oracle DBA should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one query or command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Architecture'},
{acc:[
{t:'Instance vs database',s:'Memory and processes, versus files on disk.',
 a:'The **instance** is the SGA plus the background processes. The **database** is the set of files: datafiles, control files and redo logs. An instance opens exactly one database (or one CDB), and in RAC several instances open the same one.',
 w:'Many tasks make sense only when you know which side you are on: startup and shutdown work on the instance, backup and recovery on the database.',
 c:`SELECT instance_name, status, host_name FROM v$instance;
SELECT name, open_mode, cdb FROM v$database;`,see:[0,5,'Instance vs database vs PDB']},
{t:'SGA and PGA',s:'Shared memory, and per-process private memory.',
 a:'The **SGA** is shared by all processes: buffer cache, shared pool, redo log buffer and more. The **PGA** is private to each server process and holds sort and hash work areas and session state.',
 w:'Too small an SGA means disk reads and parsing. Too many sessions with big work areas exhaust server RAM, so `PGA_AGGREGATE_TARGET` is a target, not a hard limit.',
 c:`SELECT component, ROUND(current_size/1024/1024) AS mb FROM v$sga_dynamic_components WHERE current_size > 0;
SELECT name, ROUND(value/1024/1024) AS mb FROM v$pgastat WHERE name IN ('total PGA allocated','aggregate PGA target parameter');`,see:[2,1,'SGA components']},
{t:'Background processes',s:'The instance workers: DBWn, LGWR, CKPT, SMON, PMON.',
 a:'**DBWn** writes dirty buffers to datafiles, **LGWR** writes redo, **CKPT** signals checkpoints and updates headers, **SMON** performs instance recovery and housekeeping, **PMON** cleans up after failed processes, **LREG** registers services with the listener, **ARCn** archives full redo logs.',
 w:'When something hangs, the process that owns the resource (often LGWR or DBWn) is where the wait shows.',
 c:`SELECT pname, description FROM v$process WHERE pname IS NOT NULL ORDER BY pname;`,see:[2,3,'Background processes']},
{t:'Dedicated vs shared server',s:'One server process per session, or a pool of them.',
 a:'In dedicated mode each session gets its own server process (and PGA). In shared server mode sessions are served by a small pool through dispatchers.',
 w:'Dedicated is the default and the right choice for most workloads. Shared server only helps when there are very many mostly idle connections.',
 c:`SELECT server, COUNT(*) FROM v$session WHERE type = 'USER' GROUP BY server;`,see:[2,5,'Dedicated vs shared server']},
{t:'Multitenant: CDB and PDB',s:'One container database, many pluggable databases.',
 a:'A **CDB** has a root (`CDB$ROOT`), a seed (`PDB$SEED`) and any number of **PDBs**. The PDBs share the instance, redo and (optionally) undo, but each has its own datafiles, users and objects.',
 w:'You connect to a PDB through its service name. Common users (`C##`) live in the root; local users live in a PDB. Non-CDB is not available in 23ai and later.',
 c:`SELECT con_id, name, open_mode FROM v$pdbs;
SHOW CON_NAME`,see:[8,1,'CDB architecture']}
]},

{h:'Storage'},
{acc:[
{t:'Block, extent, segment, tablespace',s:'The logical storage hierarchy.',
 a:'Data lives in **blocks** (8 KB by default). Contiguous blocks form an **extent**. The extents of one object form a **segment**. Segments live in a **tablespace**, which is made of one or more datafiles.',
 w:'DBAs add datafiles to tablespaces, not to tables. The object-to-file mapping is how you find where a table really lives.',
 c:`SELECT tablespace_name, segment_type, ROUND(SUM(bytes)/1024/1024) AS mb FROM dba_segments GROUP BY tablespace_name, segment_type ORDER BY mb DESC FETCH FIRST 10 ROWS ONLY;`,see:[2,7,'Logical structures']},
{t:'Tablespaces and datafiles',s:'Containers for segments, mapped to files.',
 a:'A tablespace groups related segments (SYSTEM, SYSAUX, UNDO, TEMP, application data). Datafiles can autoextend, be resized or moved online. Bigfile tablespaces use one very large file.',
 w:'Keep application data out of SYSTEM and SYSAUX, and monitor free space per tablespace, not per disk.',
 c:`SELECT tablespace_name, ROUND(SUM(bytes)/1024/1024) AS mb, SUM(CASE autoextensible WHEN 'YES' THEN 1 ELSE 0 END) AS autoext FROM dba_data_files GROUP BY tablespace_name;`,see:[6,0,'Tablespace types']},
{t:'Undo',s:'Before images for rollback and read consistency.',
 a:'When data changes, the old value is written to the **undo** tablespace. It is used to roll back, to give other sessions a consistent read, and for flashback queries. `UNDO_RETENTION` is the target time to keep committed undo.',
 w:'Too little undo causes ORA-01555 (snapshot too old) for long queries. Too much long-running DML fills the undo tablespace.',
 c:`SELECT begin_time, undoblks, maxquerylen, nospaceerrcnt, ssolderrcnt FROM v$undostat ORDER BY begin_time DESC FETCH FIRST 5 ROWS ONLY;`,see:[6,6,'Undo']},
{t:'Temporary tablespace',s:'Scratch space for sorts, hashes and temp tables.',
 a:'When a sort or hash join does not fit in its PGA work area, it spills to the temporary tablespace. Temp files are not backed up and can be recreated.',
 w:'A runaway query shows up as huge temp usage. Check who is using it before adding space.',
 c:`SELECT s.username, ROUND(u.blocks * 8192 / 1024 / 1024) AS mb, u.segtype FROM v$tempseg_usage u JOIN v$session s ON s.saddr = u.session_addr ORDER BY mb DESC;`,see:[6,7,'Temporary tablespaces']},
{t:'High water mark and space reclaim',s:'Deleting rows does not shrink a segment.',
 a:'A full scan reads up to the **high water mark**, even if rows were deleted below it. Space is returned with `SHRINK SPACE`, `ALTER TABLE ... MOVE` or by rebuilding the segment.',
 w:'A large table that is mostly empty still scans slowly. Segment Advisor finds candidates.',
 c:`SELECT segment_name, ROUND(bytes/1024/1024) AS mb FROM user_segments WHERE segment_type = 'TABLE' ORDER BY bytes DESC FETCH FIRST 5 ROWS ONLY;`,see:[6,5,'Reclaiming space']}
]},

{h:'Redo and recovery'},
{acc:[
{t:'Redo log and log switch',s:'The log of every change.',
 a:'Every change generates **redo** that LGWR writes to the online redo log groups. The groups are used in a circle: when one fills, a **log switch** moves to the next, and the previous one can be archived.',
 w:'Commit is fast because only the sequential redo write must finish. Redo size and group count decide how often switches (and checkpoints) happen.',
 c:`SELECT group#, sequence#, bytes/1024/1024 AS mb, members, status FROM v$log;`,see:[7,0,'Redo logging']},
{t:'Checkpoint',s:'Advances the point recovery has to start from.',
 a:'A **checkpoint** makes DBWn write dirty buffers up to a point and records it in the control file and datafile headers. After it, redo before that point is no longer needed for crash recovery.',
 w:'`FAST_START_MTTR_TARGET` sets how long instance recovery should take, and the database adjusts checkpointing to meet it.',
 c:`SELECT target_mttr, estimated_mttr, recovery_estimated_ios FROM v$instance_recovery;`,see:[7,2,'Checkpoints and instance recovery']},
{t:'Instance recovery',s:'Automatic repair after a crash.',
 a:'After an abnormal stop, startup reads the redo from the last checkpoint and applies it (**roll forward**), then uses undo to undo uncommitted changes (**roll back**). No DBA action is needed.',
 w:'Only SHUTDOWN ABORT or a crash needs it. A clean shutdown writes a final checkpoint first.',
 c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'redo size%';`,see:[7,2,'Checkpoints and instance recovery']},
{t:'Control file',s:'The database registry.',
 a:'A small binary file with the database name, the locations of datafiles and redo logs, checkpoint information, the current log sequence and RMAN backup metadata. It is read at MOUNT.',
 w:'Multiplex it on separate disks. Losing every copy needs a restore or a re-create.',
 c:`SELECT name FROM v$controlfile;
SELECT name, value FROM v$parameter WHERE name = 'control_files';`,see:[7,3,'Control files']},
{t:'ARCHIVELOG mode and the FRA',s:'Keep the redo history for recovery.',
 a:'In ARCHIVELOG mode full redo logs are copied to archive destinations before reuse. This enables point-in-time recovery and online backups. The **Fast Recovery Area** is the managed location for archives, backups and flashback logs.',
 w:'A production database should be in ARCHIVELOG. If the FRA fills, the database stops when it cannot archive.',
 c:`SELECT log_mode FROM v$database;
SELECT space_limit/1024/1024 AS limit_mb, space_used/1024/1024 AS used_mb FROM v$recovery_file_dest;`,see:[7,4,'ARCHIVELOG mode']},
{t:'SCN',s:'The database clock.',
 a:'The **System Change Number** is a monotonically increasing counter that stamps every committed change. Consistent reads, checkpoints, recovery and flashback are all expressed in SCNs.',
 w:'You can convert between SCN and time to define a recovery or flashback target.',
 c:`SELECT current_scn, SCN_TO_TIMESTAMP(current_scn) AS ts FROM v$database;`,see:[7,2,'Checkpoints and instance recovery']}
]},

{h:'Transactions and SQL'},
{acc:[
{t:'Read consistency',s:'Readers do not block writers, and vice versa.',
 a:'A query sees the data as of the SCN at which it started. If a block changed since, Oracle rebuilds the old version from undo. No read locks are taken.',
 w:'This is why long reports can run during busy hours, and why they can fail with ORA-01555 if undo is too small.',
 c:`SELECT sql_id, elapsed_time/1000000 AS secs FROM v$sql ORDER BY elapsed_time DESC FETCH FIRST 5 ROWS ONLY;`,see:[10,7,'Transactions and locks']},
{t:'Locks',s:'Row-level locking, held until commit.',
 a:'A DML statement locks only the rows it changes (and a table lock in row-exclusive mode to protect the structure). Other sessions wait only when they try to change the same row.',
 w:'Blocking comes from uncommitted transactions. Find the blocker, not the waiter.',
 c:`SELECT blocking_session, sid, serial#, seconds_in_wait, event FROM v$session WHERE blocking_session IS NOT NULL;`,see:[10,7,'Transactions and locks']},
{t:'Parse: soft and hard',s:'Parsing is expensive; reuse it.',
 a:'A **hard parse** compiles a new plan and stores it in the shared pool. A **soft parse** finds a matching cursor in the library cache. **Bind variables** let different values share one cursor.',
 w:'Applications that put literals in SQL cause hard parses and shared pool pressure.',
 c:`SELECT name, value FROM v$sysstat WHERE name IN ('parse count (total)', 'parse count (hard)', 'execute count');`,see:[2,4,'SELECT, DML and COMMIT']},
{t:'Optimizer statistics',s:'What the cost-based optimizer knows about your data.',
 a:'The optimizer chooses a plan from statistics: row counts, distinct values, histograms and index stats gathered by `DBMS_STATS`. An automated job refreshes stale ones in the maintenance window.',
 w:'Most sudden regressions after a data load are stale or missing statistics.',
 c:`SELECT table_name, num_rows, last_analyzed, stale_stats FROM user_tab_statistics ORDER BY last_analyzed NULLS FIRST FETCH FIRST 10 ROWS ONLY;`,see:[10,5,'Optimizer statistics']},
{t:'Index types',s:'Choose the structure that fits the access path.',
 a:'**B-tree** is the default. **Bitmap** suits low-cardinality columns in read-mostly systems. **Function-based** indexes support expressions. **Invisible** indexes let you test removal. Online rebuild avoids blocking DML.',
 w:'Every index costs on DML. Remove unused ones and avoid bitmap indexes on busy OLTP tables.',
 c:`SELECT index_name, index_type, visibility, status FROM user_indexes ORDER BY table_name, index_name;`,see:[10,2,'Indexes']},
{t:'Partitioning',s:'Split a big table into manageable pieces.',
 a:'A table is divided by range, list or hash into partitions that can be queried, loaded, archived or dropped separately. The optimizer skips partitions that cannot match (pruning).',
 w:'It is a separately licensed option on Enterprise Edition. Use it for retention and large scans.',
 c:`SELECT table_name, partitioning_type, partition_count FROM user_part_tables;`,see:[10,4,'Partitioning basics']}
]},

{h:'Connectivity'},
{acc:[
{t:'Listener and services',s:'How a client finds a database.',
 a:'The **listener** (port 1521 by default) accepts connections and hands them to a server process. Databases register **services** with it dynamically (LREG), so a client connects to a service name, not to a SID.',
 w:'Most connection errors are naming or registration problems, not database problems.',
 c:`lsnrctl status
SELECT name FROM v$services;`,see:[5,0,'Oracle Net architecture']},
{t:'Name resolution',s:'EZConnect, tnsnames.ora, sqlnet.ora.',
 a:'A connect identifier is resolved by EZConnect (`host:1521/service`), by `tnsnames.ora` or by a directory. `sqlnet.ora` sets the methods and options.',
 w:'ORA-12154 means the name could not be resolved; ORA-12541 no listener; ORA-12514 the listener does not know the service.',
 c:`tnsping mydb
sqlplus app/***@//dbhost:1521/ORCLPDB1`,see:[5,5,'Troubleshooting connections']}
]},

{h:'Security'},
{acc:[
{t:'Users, schemas and privileges',s:'A user owns a schema; privileges grant actions.',
 a:'A user account and its schema (the objects it owns) share a name. **System privileges** allow actions such as `CREATE TABLE`. **Object privileges** allow actions on one object. Both can be granted through roles.',
 w:'Give application users only what they need. Own objects with a schema account that nobody logs in as.',
 c:`SELECT grantee, privilege FROM dba_sys_privs WHERE grantee = 'APP';
SELECT * FROM dba_role_privs WHERE grantee = 'APP';`,see:[9,2,'System and object privileges']},
{t:'Roles and least privilege',s:'Group privileges, then grant the group.',
 a:'A role is a named set of privileges. Predefined roles such as `CONNECT` and `RESOURCE` are old and broad; define your own roles and avoid `DBA` for applications.',
 w:'`SELECT ANY TABLE` and `DBA` are the usual audit findings. Review them regularly.',
 c:`SELECT grantee, granted_role FROM dba_role_privs WHERE granted_role IN ('DBA', 'RESOURCE');`,see:[9,3,'Predefined roles and least privilege']},
{t:'Profiles',s:'Password policy and resource limits per user.',
 a:'A profile defines password lifetime, complexity function, failed-login lockout and resource limits such as sessions per user. Every user has one; the default is `DEFAULT`.',
 w:'Service accounts that must not expire need their own profile rather than a weakened DEFAULT.',
 c:`SELECT profile, resource_name, limit FROM dba_profiles WHERE profile = 'DEFAULT';`,see:[9,4,'Profiles']},
{t:'SYSDBA and administrative privileges',s:'Special privileges that work when the database is closed.',
 a:'`SYSDBA`, `SYSOPER`, `SYSBACKUP`, `SYSDG`, `SYSKM` are connect-time privileges that map to the `SYS` or a special schema. They authenticate through the password file or the operating system and work with the instance down.',
 w:'Day-to-day work should use a named account with only the needed administrative privilege, not `SYSDBA`.',
 c:`SELECT username, sysdba, sysoper, sysbackup FROM v$pwfile_users;`,see:[9,5,'Administrative privileges']}
]},

{h:'Operations and diagnostics'},
{acc:[
{t:'Startup phases and shutdown modes',s:'NOMOUNT, MOUNT, OPEN.',
 a:'`NOMOUNT` reads the parameter file and starts the instance. `MOUNT` reads the control file. `OPEN` opens the datafiles and redo logs. Shutdown modes are `NORMAL`, `TRANSACTIONAL`, `IMMEDIATE` and `ABORT`.',
 w:'Use `IMMEDIATE` as the normal choice. `ABORT` is a last resort and means instance recovery on the next start.',
 c:`SELECT status FROM v$instance;`,see:[4,0,'Startup and shutdown']},
{t:'SPFILE, PFILE and SCOPE',s:'Where parameters live and how a change is stored.',
 a:'The **SPFILE** is a server-maintained binary parameter file. `ALTER SYSTEM SET ... SCOPE=MEMORY|SPFILE|BOTH` chooses the running instance, the file, or both. A PFILE is a text file used for startup or backup of the settings.',
 w:'Static parameters need `SCOPE=SPFILE` and a restart.',
 c:`SELECT name, value, isdefault, issys_modifiable FROM v$parameter WHERE name = 'processes';`,see:[4,1,'PFILE vs SPFILE']},
{t:'ADR and the alert log',s:'Where the evidence is.',
 a:'The **Automatic Diagnostic Repository** keeps the alert log, trace files, incidents and health records under `diagnostic_dest`. `ADRCI` reads and packages them.',
 w:'The alert log is the first place to look for a startup failure, ORA-00600 or a space problem.',
 c:`SELECT name, value FROM v$diag_info WHERE name IN ('Diag Trace', 'Diag Alert');`,see:[4,4,'The ADR']},
{t:'Data Pump',s:'Logical export and import.',
 a:'`expdp` and `impdp` run server-side jobs that read and write dump files in a **directory object**. They support schema, table, tablespace and full exports, parallelism and network mode.',
 w:'Use it for moving schemas, refreshing environments and upgrades. It is not a backup strategy for recovery.',
 c:`SELECT owner_name, job_name, operation, state FROM dba_datapump_jobs;`,see:[11,1,'Data Pump architecture']},
{t:'Scheduler and Resource Manager',s:'Run jobs, and cap what they can use.',
 a:'The **Scheduler** runs jobs on schedules and chains. **Resource Manager** assigns sessions to consumer groups and limits CPU, I/O and parallelism through plans and directives, also across PDBs.',
 w:'A resource plan is how you stop one workload starving another.',
 c:`SELECT job_name, enabled, state, next_run_date FROM dba_scheduler_jobs WHERE owner = 'APP';`,see:[12,3,'Resource Manager']},
{t:'The Diagnostics and Tuning Pack trap',s:'Using AWR and ASH needs a license.',
 a:'AWR, ASH and ADDM are part of the Diagnostics Pack, and SQL Tuning Advisor needs the Tuning Pack. Both are separately licensed on Enterprise Edition, and the views are present whether or not you are licensed.',
 w:'Set `CONTROL_MANAGEMENT_PACK_ACCESS` to match your license, and know the free alternatives (Statspack, `V$` views).',
 c:`SELECT value FROM v$parameter WHERE name = 'control_management_pack_access';`,see:[0,3,'Editions, options and licensing']}
]}
]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Five small maps of how the parts fit together: instance and database, multitenant, storage, redo and undo, and the directory layout.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why a DBA cares, one query to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. How an instance and a database fit together'},
{map:{title:'Instance and database map',h:480,trace:'Trace an UPDATE and COMMIT',
 hint:'Tap any box, or press Trace an UPDATE and COMMIT to follow one change through the instance.',
 groups:[{x:40,y:96,w:470,h:118,l:'SGA: shared memory of the instance'},{x:40,y:246,w:600,h:108,l:'Database: files on disk'}],
 lines:[[170,46,228,46],[380,46,438,46],[305,72,305,94],[140,190,140,280],[400,190,400,280],[338,340,338,388],[520,155,512,155]],
 nodes:[
 {id:'client',x:40,y:20,w:130,h:52,c:'ext',t:'Client',s:'application, SQL*Plus',d:'Any program that connects to a service and sends SQL.',why:'Each connection becomes a session with its own server process (in dedicated mode).',chk:`SELECT username, program, status FROM v$session WHERE type = 'USER';`,see:[2,0,'The big picture']},
 {id:'server',x:230,y:20,w:150,h:52,c:'proc',t:'Server process',s:'one per session',d:'Parses and runs the session SQL, reads blocks through the buffer cache and generates redo and undo for changes.',why:'It uses PGA memory, so session count and work area size drive RAM use.',chk:`SELECT p.spid, s.sid, s.username FROM v$process p JOIN v$session s ON s.paddr = p.addr WHERE s.type = 'USER';`,see:[2,5,'Dedicated vs shared server']},
 {id:'pga',x:440,y:20,w:200,h:52,c:'mem',t:'PGA',s:'private work areas',d:'Memory private to one server process: sort and hash work areas, session variables and cursor state.',why:'Sorts that do not fit spill to the temporary tablespace.',chk:`SELECT name, ROUND(value/1024/1024) AS mb FROM v$pgastat WHERE name IN ('total PGA allocated','total PGA inuse');`,see:[2,2,'PGA and work areas']},
 {id:'bcache',x:60,y:128,w:140,h:62,c:'mem',t:'Buffer cache',s:'data block copies',d:'Cached copies of datafile blocks. A server process reads and changes blocks here, never directly in the file.',why:'A high hit ratio means few physical reads. Dirty buffers are written later by DBWn.',chk:`SELECT name, value FROM v$sysstat WHERE name IN ('db block gets','consistent gets','physical reads');`,see:[2,1,'SGA components']},
 {id:'spool',x:215,y:128,w:140,h:62,c:'mem',t:'Shared pool',s:'SQL and dictionary',d:'The library cache (parsed SQL and PL/SQL), the dictionary cache and the result cache.',why:'Literals in SQL cause hard parses and fill it. Bind variables let statements share cursors.',chk:`SELECT pool, name, ROUND(bytes/1024/1024) AS mb FROM v$sgastat WHERE pool = 'shared pool' ORDER BY bytes DESC FETCH FIRST 5 ROWS ONLY;`,see:[2,1,'SGA components']},
 {id:'lbuf',x:370,y:128,w:130,h:62,c:'mem',t:'Redo buffer',s:'change records',d:'A small circular buffer where redo records are collected before LGWR writes them to the online redo logs.',why:'Commit waits for this buffer to be written, not for the data blocks.',chk:`SELECT name, value FROM v$sysstat WHERE name IN ('redo size','redo writes','redo log space requests');`,see:[2,1,'SGA components']},
 {id:'bg',x:522,y:96,w:118,h:118,c:'proc',t:'Background',s:'DBWn, LGWR, CKPT',d:'DBWn writes dirty buffers, LGWR writes redo, CKPT records checkpoints, SMON recovers, PMON cleans up, ARCn archives redo.',why:'When one lags you see specific waits such as log file sync or free buffer waits.',chk:`SELECT pname, description FROM v$process WHERE pname IS NOT NULL ORDER BY pname;`,see:[2,3,'Background processes']},
 {id:'dfile',x:60,y:282,w:170,h:58,c:'disk',t:'Datafiles',s:'tables, indexes, undo',d:'The files that hold tablespaces: your tables and indexes, the dictionary, undo and temp.',why:'They are written lazily by DBWn, so they can be older than the redo.',chk:`SELECT file#, name, ROUND(bytes/1024/1024) AS mb FROM v$datafile;`,see:[2,6,'Physical structures']},
 {id:'redo',x:255,y:282,w:166,h:58,c:'disk',t:'Online redo logs',s:'groups and members',d:'Circular files that hold every change in sequence. LGWR writes them on commit.',why:'They are what makes a commit durable and what instance recovery replays.',chk:`SELECT group#, sequence#, status, members FROM v$log;`,see:[7,0,'Redo logging']},
 {id:'ctl',x:440,y:282,w:180,h:58,c:'disk',t:'Control file',s:'registry of files',d:'A small file with the database name, the files of the database, checkpoint information and backup metadata.',why:'Losing every copy is a recovery scenario. Multiplex it.',chk:`SELECT name FROM v$controlfile;`,see:[7,3,'Control files']},
 {id:'arch',x:255,y:390,w:200,h:58,c:'disk',t:'Archived redo',s:'ARCHIVELOG history',d:'Copies of full online redo logs kept for point-in-time recovery, standbys and backups.',why:'Without them you can only restore to the time of the last backup.',chk:`SELECT sequence#, name, completion_time FROM v$archived_log ORDER BY sequence# DESC FETCH FIRST 5 ROWS ONLY;`,see:[7,4,'ARCHIVELOG mode']}],
 steps:[
 {ids:['client','server'],t:'1. A session issues UPDATE. Its server process parses the statement (reusing a cached cursor when possible) and finds the rows to change.',w:'Parsing and planning happen before any data is touched.',s:'`CURSOR_SHARING`, bind variables, `SESSION_CACHED_CURSORS`.',x:'A flood of hard parses shows as `library cache` and `cursor: pin S wait on X` waits.',c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'parse count%';`},
 {ids:['server','bcache'],t:'2. The block is read into the buffer cache (from disk on a miss) and changed in memory. Its old values go to undo, and the buffer becomes dirty.',w:'Nothing is written to the datafile yet.',s:'`DB_CACHE_SIZE`, `SGA_TARGET`, `DB_BLOCK_SIZE`.',x:'Many physical reads and `db file sequential read` waits mean the working set does not fit.',c:`SELECT event, total_waits FROM v$system_event WHERE event LIKE 'db file%' ORDER BY total_waits DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['bcache','lbuf'],t:'3. A redo record describing the data change and the undo change is placed in the redo buffer.',w:'Redo is the log. It must describe a change before the changed block can be written.',s:'`LOG_BUFFER`, `NOLOGGING` (limited use), `FORCE LOGGING`.',x:'`log buffer space` waits mean the buffer is too small for the redo rate.',c:`SELECT name, value FROM v$sysstat WHERE name = 'redo size';`},
 {ids:['lbuf','redo'],t:'4. On COMMIT, LGWR writes the redo buffer (including the commit record) to the online redo log. The session waits on log file sync, then gets its commit.',w:'This is why commit is fast and durable: one sequential write.',s:'`COMMIT_WRITE`, redo log size, redo disk speed.',x:'`log file sync` waits point at slow redo storage or too frequent commits.',c:`SELECT event, average_wait FROM v$system_event WHERE event = 'log file sync';`},
 {ids:['bg','bcache','dfile'],t:'5. Later DBWn writes the dirty buffers to the datafiles, driven by checkpoints and the need for free buffers.',w:'Writing lazily batches the I/O and keeps commit fast.',s:'`DB_WRITER_PROCESSES`, `FAST_START_MTTR_TARGET`.',x:'`free buffer waits` and `write complete waits` mean DBWn cannot keep up.',c:`SELECT name, value FROM v$sysstat WHERE name = 'DBWR checkpoints';`},
 {ids:['redo','arch','ctl'],t:'6. When a redo group fills, LGWR switches to the next. ARCn copies the full one to the archive, and the control file records the sequence.',w:'The archive is what extends recovery past the last backup.',s:'`LOG_ARCHIVE_DEST_n`, `DB_RECOVERY_FILE_DEST_SIZE`.',x:'If the archive destination or FRA is full, the database hangs on the log switch.',c:`SELECT dest_id, status, error FROM v$archive_dest WHERE status <> 'INACTIVE';`}]}},

{h:'2. Multitenant: CDB and PDB'},
{map:{title:'Multitenant map',h:420,trace:'Create and connect to a PDB',
 hint:'Tap any box, or press Create and connect to a PDB to see how pluggable databases are made and reached.',
 groups:[{x:20,y:40,w:640,h:250,l:'Container database (CDB): one instance'}],
 lines:[[210,358,258,358],[345,330,345,292],[560,330,560,292]],
 nodes:[
 {id:'root',x:40,y:76,w:170,h:58,c:'proc',t:'CDB$ROOT',s:'common metadata',d:'The root container. It holds the Oracle-supplied dictionary and common users, roles and objects shared by all PDBs.',why:'Do not put application data here. Administrators connect to it for container-wide tasks.',chk:`SHOW CON_NAME
SELECT con_id, name FROM v$containers;`,see:[8,1,'CDB architecture']},
 {id:'seed',x:230,y:76,w:150,h:58,c:'disk',t:'PDB$SEED',s:'template for new PDBs',d:'A read-only template that new PDBs are created from.',why:'Creating a PDB from the seed copies its files and takes seconds to minutes.',chk:`SELECT name, open_mode FROM v$pdbs WHERE name = 'PDB$SEED';`,see:[8,3,'Creating PDBs']},
 {id:'pdb1',x:400,y:76,w:120,h:58,c:'mem',t:'PDB1',s:'application A',d:'A pluggable database: its own datafiles, schemas, users and services, inside the shared instance.',why:'You connect to it through its own service name.',chk:`SELECT name, open_mode, restricted FROM v$pdbs;`,see:[8,2,'Connecting to PDBs']},
 {id:'pdb2',x:540,y:76,w:100,h:58,c:'mem',t:'PDB2',s:'application B',d:'Another PDB. It is isolated from PDB1 for data and users, but shares the instance.',why:'Use Resource Manager so one PDB cannot starve the others.',chk:`SELECT con_id, name FROM v$pdbs;`,see:[12,4,'Resource Manager with PDBs']},
 {id:'shared',x:40,y:170,w:300,h:58,c:'proc',t:'Shared by all containers',s:'SGA, processes, redo, control file',d:'There is one instance: one SGA, one set of background processes, one set of redo logs and one control file for the whole CDB.',why:'This is the consolidation benefit: one instance to patch, monitor and back up.',chk:`SELECT instance_name, version FROM v$instance;`,see:[8,0,'Why multitenant']},
 {id:'local',x:360,y:170,w:280,h:58,c:'disk',t:'Per PDB',s:'datafiles, users, objects, services',d:'Each PDB has its own tablespaces and datafiles, schemas, local users and database service.',why:'This is what you unplug, clone, move or drop as a unit.',chk:`SELECT con_id, name FROM v$datafile ORDER BY 1 FETCH FIRST 5 ROWS ONLY;`,see:[8,3,'Creating PDBs']},
 {id:'clients',x:40,y:330,w:170,h:56,c:'ext',t:'Clients',s:'connect by service name',d:'Applications and users connect to a service that belongs to one PDB, not to the CDB.',why:'Use a service per application so you can relocate or control it independently.',chk:`SELECT name, con_id FROM v$services ORDER BY con_id;`,see:[8,2,'Connecting to PDBs']},
 {id:'lsnr',x:260,y:330,w:170,h:56,c:'proc',t:'Listener',s:'routes to the PDB service',d:'The listener hands the connection to the instance, which attaches the session to the right container.',why:'One listener and one port serve all PDBs.',chk:`lsnrctl services`,see:[5,0,'Oracle Net architecture']},
 {id:'clone',x:480,y:330,w:160,h:56,c:'proc',t:'Clone or plug',s:'new PDB quickly',d:'A new PDB can be created from the seed, cloned from another PDB, or plugged in from an unplugged file set.',why:'This is how you provision test copies or move a database between CDBs.',chk:`CREATE PLUGGABLE DATABASE pdb3 FROM pdb1;`,see:[8,7,'Dropping, cloning and refreshing PDBs']}],
 steps:[
 {ids:['root','shared'],t:'1. The CDB has one instance and one root. The root holds the common dictionary, and everything process-related is shared.',w:'This is why a CDB is cheaper than many separate databases.',s:'`ENABLE_PLUGGABLE_DATABASE`, `CONTAINERS` clause.',x:'Operations in the root affect all PDBs. Check `SHOW CON_NAME` before you run DDL.',c:`SHOW CON_NAME`},
 {ids:['seed','clone','pdb1'],t:'2. Create a PDB from the seed (or clone an existing one). The files are copied or cloned, and the PDB is registered.',w:'A PDB is a portable unit of data and metadata.',s:'`CREATE PLUGGABLE DATABASE`, `FILE_NAME_CONVERT`, `CREATE_FILE_DEST`.',x:'New PDBs are in MOUNTED state until you open them.',c:`CREATE PLUGGABLE DATABASE pdb3 ADMIN USER pdbadmin IDENTIFIED BY "Change_Me_1" FILE_NAME_CONVERT = ('pdbseed', 'pdb3');`},
 {ids:['pdb1','local'],t:'3. Open the PDB and save its state so it opens automatically after the next restart.',w:'By default a PDB does not open by itself.',s:'`ALTER PLUGGABLE DATABASE ... OPEN`, `SAVE STATE`, a startup trigger.',x:'A PDB that is closed after a restart is a very common "database is down" report.',c:`ALTER PLUGGABLE DATABASE pdb3 OPEN;
ALTER PLUGGABLE DATABASE pdb3 SAVE STATE;`},
 {ids:['clients','lsnr','pdb1'],t:'4. Applications connect to the PDB service name. The listener passes the connection to the instance, which attaches the session to that PDB.',w:'Each PDB has its own default service, and you can add more.',s:'`SERVICE_NAMES`, `srvctl`, `DBMS_SERVICE`.',x:'ORA-12514 means the service is not registered, often because the PDB is not open.',c:`sqlplus app/***@//dbhost:1521/pdb3`},
 {ids:['root','pdb1'],t:'5. Users are common (names start with C##, in the root, visible everywhere) or local (inside one PDB). Privileges can be granted commonly or locally.',w:'It decides who can see and change what across containers.',s:'`COMMON_USER_PREFIX`, `CONTAINER = ALL`.',x:'A common privilege given to the wrong role is a cross-PDB security hole.',c:`SELECT username, common, con_id FROM cdb_users WHERE oracle_maintained = 'N';`},
 {ids:['pdb1','pdb2','shared'],t:'6. Because the instance is shared, one busy PDB can affect another. Resource Manager plans cap CPU, sessions and I/O per PDB.',w:'Isolation of data is strong; isolation of resources must be configured.',s:'`CDB` resource plans, `SGA_TARGET` and `PGA_AGGREGATE_LIMIT` per PDB.',x:'No plan means no protection; the noisiest tenant wins.',c:`SELECT plan, pluggable_database, shares, utilization_limit FROM cdb_cdb_rsrc_plan_directives;`}]}},

{h:'3. Storage: from a table to the disk'},
{map:{title:'Storage hierarchy map',h:380,trace:'Follow a table to the disk',
 hint:'Tap any box, or press Follow a table to the disk to see how an object maps onto files.',
 groups:[{x:30,y:236,w:620,h:110,l:'Tablespaces every database has'}],
 lines:[[170,58,198,58],[330,58,358,58],[490,58,518,58],[105,86,135,148],[232,178,258,178]],
 nodes:[
 {id:'tbs',x:40,y:30,w:130,h:56,c:'ext',t:'Tablespace',s:'named container',d:'A logical container for segments. The unit you create, size, back up and take offline.',why:'Separate by purpose and lifecycle (data, indexes, undo, temp).',chk:`SELECT tablespace_name, status, contents FROM dba_tablespaces;`,see:[6,0,'Tablespace types']},
 {id:'seg',x:200,y:30,w:130,h:56,c:'proc',t:'Segment',s:'one object',d:'The storage of one table, index, partition or undo and temp area. It is made of extents.',why:'A segment is what takes space. Tables and their indexes are separate segments.',chk:`SELECT segment_name, segment_type, bytes/1024/1024 AS mb FROM user_segments;`,see:[2,7,'Logical structures']},
 {id:'ext',x:360,y:30,w:130,h:56,c:'proc',t:'Extent',s:'contiguous blocks',d:'A set of contiguous blocks allocated to a segment. Segments grow by extents.',why:'With locally managed tablespaces and ASSM, extent management is automatic.',chk:`SELECT segment_name, extent_id, blocks FROM user_extents FETCH FIRST 5 ROWS ONLY;`,see:[6,4,'Extents and segments']},
 {id:'blk',x:520,y:30,w:120,h:56,c:'mem',t:'Block',s:'8 KB by default',d:'The smallest unit of I/O. Rows live in blocks, and a block belongs to one segment.',why:'Block size is fixed per tablespace and database; changing it is a rebuild.',chk:`SHOW PARAMETER db_block_size`,see:[2,7,'Logical structures']},
 {id:'dfile',x:40,y:150,w:190,h:56,c:'disk',t:'Datafiles',s:'files of a tablespace',d:'Operating system or ASM files. A tablespace has one or more, and datafiles can autoextend.',why:'You add capacity by adding or resizing datafiles, not by changing tables.',chk:`SELECT file_name, bytes/1024/1024 AS mb, autoextensible, maxbytes/1024/1024 AS max_mb FROM dba_data_files;`,see:[6,2,'Datafile management']},
 {id:'osb',x:260,y:150,w:170,h:56,c:'disk',t:'File system or ASM',s:'where bytes live',d:'The datafile is stored on a file system, or in ASM disk groups with striping and mirroring.',why:'Storage speed and layout determine I/O latency.',chk:`SELECT name, state, total_mb, free_mb FROM v$asm_diskgroup;`,see:[6,3,'Oracle Managed Files']},
 {id:'sys',x:50,y:266,w:130,h:56,c:'mem',t:'SYSTEM',s:'data dictionary',d:'Holds the data dictionary. Always online.',why:'Keep user objects out of it.',chk:`SELECT segment_type, COUNT(*) FROM dba_segments WHERE tablespace_name = 'SYSTEM' GROUP BY segment_type;`,see:[6,0,'Tablespace types']},
 {id:'sysaux',x:200,y:266,w:130,h:56,c:'mem',t:'SYSAUX',s:'AWR, options',d:'Auxiliary data: AWR, Spatial, Text and other components.',why:'It can grow large because of AWR retention.',chk:`SELECT occupant_name, ROUND(space_usage_kbytes/1024) AS mb FROM v$sysaux_occupants ORDER BY 2 DESC FETCH FIRST 5 ROWS ONLY;`,see:[6,0,'Tablespace types']},
 {id:'undo',x:350,y:266,w:130,h:56,c:'mem',t:'UNDO',s:'before images',d:'Stores undo for rollback and read consistency.',why:'Sizing decides ORA-01555 behaviour.',chk:`SELECT tablespace_name, status, ROUND(SUM(bytes)/1024/1024) AS mb FROM dba_undo_extents GROUP BY tablespace_name, status;`,see:[6,6,'Undo']},
 {id:'temp',x:500,y:266,w:130,h:56,c:'mem',t:'TEMP',s:'sort spill',d:'Scratch space for sorts, hashes and temporary tables.',why:'It is rebuilt at start. A runaway query fills it.',chk:`SELECT tablespace_name, ROUND(bytes_used/1024/1024) AS used_mb, ROUND(bytes_free/1024/1024) AS free_mb FROM v$temp_space_header;`,see:[6,7,'Temporary tablespaces']}],
 steps:[
 {ids:['seg','tbs'],t:'1. A table is stored as a segment inside a tablespace, chosen at creation (or the user default).',w:'The tablespace is the unit of administration; the segment is the unit of storage.',s:'`DEFAULT TABLESPACE`, `QUOTA`.',x:'ORA-01950 (no privileges on tablespace) means no quota.',c:`SELECT table_name, tablespace_name FROM user_tables;`},
 {ids:['seg','ext'],t:'2. When the segment needs space it receives an extent: a set of contiguous blocks in one of the tablespace datafiles.',w:'Allocation is automatic with locally managed tablespaces.',s:'`AUTOALLOCATE` or `UNIFORM`, `SEGMENT SPACE MANAGEMENT AUTO`.',x:'ORA-01653 (unable to extend) means no free space in any datafile.',c:`SELECT tablespace_name, ROUND(SUM(bytes)/1024/1024) AS free_mb FROM dba_free_space GROUP BY tablespace_name;`},
 {ids:['ext','blk'],t:'3. Extents are made of blocks. Rows are stored in blocks, and a block is the unit read into the buffer cache.',w:'More rows per block means fewer reads.',s:'`PCTFREE`, `INITRANS`, column order and data types.',x:'Row chaining and migration appear when rows are updated to a larger size.',c:`SELECT table_name, num_rows, blocks, avg_row_len, chain_cnt FROM user_tables;`},
 {ids:['tbs','dfile'],t:'4. A tablespace maps to datafiles. Capacity grows by autoextending, resizing or adding a datafile, online.',w:'This is where DBAs add space in practice.',s:'`AUTOEXTEND ON NEXT ... MAXSIZE`, bigfile tablespaces, OMF.',x:'Autoextend without MAXSIZE can fill the file system.',c:`ALTER DATABASE DATAFILE '/u02/oradata/ORCL/users01.dbf' RESIZE 4G;`},
 {ids:['dfile','osb'],t:'5. The datafile lives on a file system or in ASM. Its speed and layout are the storage performance of the tablespace.',w:'Place hot data and redo on fast, separate storage.',s:'File system options, ASM redundancy and striping.',x:'Shared slow storage shows as `db file sequential read` waits.',c:`SELECT name, ROUND(readtim/phyrds * 10, 1) AS avg_read_ms FROM v$filestat f JOIN v$datafile d USING (file#) WHERE phyrds > 0 ORDER BY 2 DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['sys','sysaux','undo','temp'],t:'6. Every database also has system tablespaces: SYSTEM and SYSAUX for the dictionary and components, UNDO for before images and TEMP for scratch space.',w:'They have special rules: they should not hold application data, and they need monitoring.',s:'`UNDO_TABLESPACE`, `DEFAULT TEMPORARY TABLESPACE`, AWR retention.',x:'SYSAUX filling up is usually AWR or audit data; UNDO and TEMP growth are workload symptoms.',c:`SELECT tablespace_name, ROUND(used_percent, 1) AS pct FROM dba_tablespace_usage_metrics ORDER BY 2 DESC;`}]}},

{h:'4. Redo, undo and data: one change, three records'},
{map:{title:'Redo and undo map',h:370,trace:'One UPDATE writes three things',
 hint:'Tap any box, or press One UPDATE writes three things to see why redo and undo are different.',
 groups:[],
 lines:[[190,58,238,58],[410,58,458,58],[325,86,325,148],'M550 86 V118 H400 V148',[600,86,600,268],[325,206,325,268],[115,86,115,268]],
 nodes:[
 {id:'chg',x:40,y:30,w:150,h:56,c:'proc',t:'UPDATE',s:'changes a row',d:'A DML statement. It changes the row in its block, in the buffer cache.',why:'Three things are recorded, each for a different purpose.',chk:`UPDATE emp SET sal = sal + 100 WHERE empno = 7369;`,see:[2,4,'SELECT, DML and COMMIT']},
 {id:'blk',x:240,y:30,w:170,h:56,c:'mem',t:'Data block',s:'new value in cache',d:'The block now contains the new value and is marked dirty.',why:'It will be written to the datafile later, in a batch.',chk:`SELECT dbms_rowid.rowid_block_number(rowid) AS blk, sal FROM emp WHERE empno = 7369;`,see:[2,1,'SGA components']},
 {id:'undo',x:460,y:30,w:180,h:56,c:'mem',t:'Undo record',s:'old value saved',d:'The before image goes to an undo segment, so the change can be undone and old versions rebuilt.',why:'It serves rollback, read consistency and flashback.',chk:`SELECT xidusn, xidslot, used_ublk, used_urec FROM v$transaction;`,see:[6,6,'Undo']},
 {id:'redo',x:240,y:150,w:170,h:56,c:'disk',t:'Redo record',s:'describes both changes',d:'One redo record describes the change to the data block and to the undo block. LGWR writes it to the online redo log.',why:'Redo repeats changes after a crash. It is not used for rollback.',chk:`SELECT name, value FROM v$sysstat WHERE name = 'redo size';`,see:[7,0,'Redo logging']},
 {id:'rb',x:40,y:270,w:170,h:56,c:'proc',t:'ROLLBACK',s:'applies undo',d:'Rollback reads the undo records of the transaction and reverses the changes.',why:'It takes about as long as the original change.',chk:`ROLLBACK;`,see:[10,7,'Transactions and locks']},
 {id:'rec',x:240,y:270,w:170,h:56,c:'proc',t:'Recovery',s:'replays redo',d:'After a crash or restore, redo is applied to bring blocks forward. Uncommitted changes are then undone using undo.',why:'It needs redo (and archives) back to the last checkpoint or backup.',chk:`SELECT name, value FROM v$parameter WHERE name = 'fast_start_mttr_target';`,see:[7,2,'Checkpoints and instance recovery']},
 {id:'cr',x:440,y:270,w:200,h:56,c:'proc',t:'Read consistency',s:'old block rebuilt from undo',d:'A query that started earlier gets the old value by applying undo to a copy of the block.',why:'It is why readers do not block writers. It also needs undo retention.',chk:`SELECT name, value FROM v$sysstat WHERE name = 'consistent changes';`,see:[10,7,'Transactions and locks']}],
 steps:[
 {ids:['chg','blk'],t:'1. UPDATE changes the row in the buffer cache. The block is now dirty, and nothing is written to the datafile yet.',w:'Memory first keeps DML fast.',s:'`DB_CACHE_SIZE`, `DB_WRITER_PROCESSES`.',x:'A cache too small to keep hot blocks turns this into physical reads.',c:`SELECT name, value FROM v$sysstat WHERE name = 'db block changes';`},
 {ids:['blk','undo'],t:'2. The old value is written to an undo record in an undo segment, so the change can be reversed and older versions rebuilt.',w:'Undo is data. It is also changed in the buffer cache and protected by redo.',s:'`UNDO_RETENTION`, `UNDO_TABLESPACE`, `RETENTION GUARANTEE`.',x:'A large transaction fills undo and can end with ORA-30036.',c:`SELECT used_ublk, used_urec, start_time FROM v$transaction;`},
 {ids:['blk','undo','redo'],t:'3. A redo record describing the change to the data block and the undo block is generated.',w:'One record protects both, so recovery can rebuild data and undo together.',s:'`LOG_BUFFER`, `FORCE LOGGING`, `NOLOGGING` on certain operations.',x:'NOLOGGING operations are not recoverable from redo; take a backup afterwards.',c:`SELECT name, value FROM v$sysstat WHERE name IN ('redo entries', 'redo size');`},
 {ids:['redo'],t:'4. On COMMIT, LGWR writes the redo (with the commit record) to the online redo log. The change is now durable even though the datafile is unchanged.',w:'Durability comes from redo, not from datafiles.',s:'Redo log placement and size.',x:'`log file sync` waits mean storage is slow or commits are too frequent.',c:`SELECT event, total_waits, time_waited_micro/1000000 AS secs FROM v$system_event WHERE event = 'log file sync';`},
 {ids:['chg','rb','undo'],t:'5. ROLLBACK (or an error) uses the undo records to put the old value back. Redo is generated for that as well.',w:'Undo is the undo button; redo is the replay button.',s:'Transaction size, `FAST_START_PARALLEL_ROLLBACK`.',x:'Killing a long transaction can take a long time to roll back.',c:`SELECT used_ublk, used_urec FROM v$transaction;`},
 {ids:['redo','rec','blk'],t:'6. After a crash, instance recovery replays redo from the last checkpoint to repeat committed and uncommitted changes, then rolls back the uncommitted ones using undo.',w:'This is why both are needed together.',s:'`FAST_START_MTTR_TARGET`, redo log size.',x:'A very large redo gap since the last checkpoint makes startup slow.',c:`SELECT target_mttr, estimated_mttr FROM v$instance_recovery;`},
 {ids:['undo','cr'],t:'7. A reader that started earlier asks for the block. Oracle makes a copy and applies undo to it until it matches the reader start SCN.',w:'Readers see a consistent snapshot without locking.',s:'`UNDO_RETENTION`, undo tablespace size, long-query tuning.',x:'If the needed undo was overwritten: ORA-01555 snapshot too old.',c:`SELECT maxquerylen, ssolderrcnt, nospaceerrcnt FROM v$undostat ORDER BY begin_time DESC FETCH FIRST 3 ROWS ONLY;`}]}},

{h:'5. Directory layout: where things live'},
{map:{title:'Directory layout map',h:380,trace:'Find it fast',
 hint:'Tap any box, or press Find it fast to follow the questions you ask most often.',
 groups:[{x:30,y:236,w:620,h:110,l:'Usually separate mount points'}],
 lines:[[230,58,258,58],[430,58,458,58],[135,86,135,148],[345,86,345,148]],
 nodes:[
 {id:'base',x:40,y:30,w:190,h:56,c:'disk',t:'ORACLE_BASE',s:'/u01/app/oracle',d:'The top of the Oracle tree. Homes and diagnostic data are below it.',why:'A single base per OS user keeps everything findable.',chk:`echo $ORACLE_BASE`,see:[3,1,'OFA layout']},
 {id:'home',x:260,y:30,w:170,h:56,c:'disk',t:'ORACLE_HOME',s:'the software',d:'The installed binaries, libraries and a few configuration directories. One home per release or patch level.',why:'Never keep datafiles in the home. It is replaced when you patch.',chk:`echo $ORACLE_HOME`,see:[3,1,'OFA layout']},
 {id:'net',x:460,y:30,w:180,h:56,c:'disk',t:'network/admin',s:'listener.ora, tnsnames.ora',d:'The default location of Oracle Net configuration. It can be moved with TNS_ADMIN.',why:'ORA-12154 often comes from the wrong TNS_ADMIN.',chk:`lsnrctl status | grep "Listener Parameter File"`,see:[5,1,'listener.ora and lsnrctl']},
 {id:'diag',x:40,y:150,w:190,h:56,c:'disk',t:'diag (ADR)',s:'alert log, traces',d:'The Automatic Diagnostic Repository: alert log, trace files, incidents and logs for the database and the listener.',why:'It is the first place to look for any ORA error.',chk:`SELECT value FROM v$diag_info WHERE name = 'Diag Trace';`,see:[4,4,'The ADR']},
 {id:'dbs',x:260,y:150,w:170,h:56,c:'disk',t:'dbs',s:'spfile, password file',d:'In the home: the server parameter file, the password file and the init files for each instance.',why:'Loss of the spfile is recoverable from backup or the alert log.',chk:`SHOW PARAMETER spfile`,see:[4,1,'PFILE vs SPFILE']},
 {id:'inv',x:460,y:150,w:180,h:56,c:'disk',t:'oraInventory',s:'installed homes',d:'The central inventory of installed software and patches. It is used by the installer and OPatch.',why:'A broken inventory blocks patching.',chk:`cat /etc/oraInst.loc`,see:[3,1,'OFA layout']},
 {id:'oradata',x:50,y:266,w:190,h:56,c:'disk',t:'oradata',s:'datafiles, redo, control',d:'The database files: datafiles, online redo logs and control files, by convention under a data mount point.',why:'This is what a backup protects and what must survive.',chk:`SELECT name FROM v$datafile UNION ALL SELECT member FROM v$logfile UNION ALL SELECT name FROM v$controlfile;`,see:[3,1,'OFA layout']},
 {id:'fra',x:260,y:266,w:170,h:56,c:'disk',t:'Fast recovery area',s:'archives, backups',d:'A managed area for archived redo, backups and flashback logs, limited by DB_RECOVERY_FILE_DEST_SIZE.',why:'When it is full the database cannot archive.',chk:`SELECT name, space_limit/1024/1024 AS limit_mb, space_used/1024/1024 AS used_mb FROM v$recovery_file_dest;`,see:[7,5,'The Fast Recovery Area']},
 {id:'oratab',x:460,y:266,w:170,h:56,c:'disk',t:'/etc/oratab',s:'SIDs and homes',d:'A text file that lists each instance and its home, used by oraenv and startup scripts.',why:'Scripts break when it is wrong or when autostart flags are mis-set.',chk:`cat /etc/oratab`,see:[3,4,'Post-installation tasks']}],
 steps:[
 {ids:['oratab','home'],t:'1. Which software does this database use? /etc/oratab names the home for each SID, and `oraenv` sets ORACLE_HOME from it.',w:'Environment variables decide which binaries a command runs.',s:'`ORACLE_SID`, `ORACLE_HOME`, `PATH`.',x:'Running the wrong home gives errors such as ORA-01034 or version mismatches.',c:`cat /etc/oratab`},
 {ids:['home','net'],t:'2. Where is the network configuration? Under ORACLE_HOME/network/admin unless TNS_ADMIN points elsewhere.',w:'The listener and the client read different copies.',s:'`TNS_ADMIN`, `sqlnet.ora`.',x:'Edits that "do nothing" are often in the wrong directory.',c:`echo $TNS_ADMIN`},
 {ids:['home','dbs'],t:'3. Where are the parameters? The spfile and password file are in ORACLE_HOME/dbs (or in ASM).',w:'Both are per instance and needed at startup.',s:'`SPFILE`, `orapw<SID>`.',x:'A missing spfile gives "ORA-01078 failure in processing system parameters" at STARTUP.',c:`SELECT value FROM v$parameter WHERE name = 'spfile';`},
 {ids:['base','diag'],t:'4. Where is the alert log? Under ORACLE_BASE/diag/rdbms/<db>/<instance>/trace (the ADR).',w:'All diagnostic data for an instance is in one tree.',s:'`DIAGNOSTIC_DEST`, `ADRCI`.',x:'A full diagnostic destination stops logging and can hang processes.',c:`SELECT value FROM v$diag_info WHERE name = 'Diag Trace';`},
 {ids:['oradata'],t:'5. Where are the datafiles, redo logs and control files? Wherever the dictionary says, by convention under oradata.',w:'The control file and views, not directory names, are the truth.',s:'`DB_CREATE_FILE_DEST`, OMF.',x:'Files outside the usual paths are easy to miss in backups and monitoring.',c:`SELECT 'DATAFILE' AS type, name FROM v$datafile UNION ALL SELECT 'REDO', member FROM v$logfile UNION ALL SELECT 'CONTROL', name FROM v$controlfile;`},
 {ids:['fra','inv'],t:'6. Where are the archives and backups? In the fast recovery area. Where is the installation record? In the central inventory.',w:'Both are required for recovery and patching, and neither is in the home.',s:'`DB_RECOVERY_FILE_DEST`, `DB_RECOVERY_FILE_DEST_SIZE`.',x:'A full FRA stops archiving; a damaged inventory blocks patching.',c:`SELECT * FROM v$recovery_area_usage;`}]}}
]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Eight small maps of how something happens, step by step: a statement, startup and shutdown, recovery, a log switch, a connection, read consistency, a login and Data Pump.',see:[],jump:true,b:[
{p:'These maps follow one action from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Life of a SQL statement'},
{map:{title:'Life of a statement map',h:350,trace:'Follow an UPDATE',
 hint:'Tap any box, or press Follow an UPDATE to walk one statement from parse to commit.',
 groups:[],
 lines:[[180,58,258,58],[410,58,498,58],[570,86,570,148],[498,178,412,178],[258,178,182,178],[110,206,110,268],[335,206,335,268],[412,298,498,298]],
 nodes:[
 {id:'app',x:40,y:30,w:140,h:56,c:'ext',t:'Application',s:'sends SQL',d:'The client sends the statement text, with or without bind variables.',why:'Bind variables are the main way applications avoid unnecessary hard parses.',chk:`SELECT sql_id, executions, parse_calls FROM v$sql ORDER BY parse_calls DESC FETCH FIRST 5 ROWS ONLY;`,see:[2,4,'SELECT, DML and COMMIT']},
 {id:'parse',x:260,y:30,w:150,h:56,c:'proc',t:'Parse',s:'syntax and privileges',d:'Checks syntax, resolves names against the dictionary and checks that the user has the privileges.',why:'ORA-00942 and ORA-01031 are raised here.',chk:`SELECT * FROM no_such_table;`,see:[2,4,'SELECT, DML and COMMIT']},
 {id:'lib',x:500,y:30,w:140,h:56,c:'mem',t:'Library cache',s:'soft or hard parse',d:'Looks for an identical cursor in the shared pool. Found: a soft parse. Not found: a hard parse.',why:'Hard parses cost CPU and latches and flood the shared pool.',chk:`SELECT name, value FROM v$sysstat WHERE name IN ('parse count (total)', 'parse count (hard)');`,see:[2,1,'SGA components']},
 {id:'opt',x:500,y:150,w:140,h:56,c:'proc',t:'Optimizer',s:'cost-based plan',d:'Chooses an execution plan using statistics, indexes and parameters, and stores it with the cursor.',why:'This is where stale statistics cause bad plans.',chk:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'TYPICAL'));`,see:[10,5,'Optimizer statistics']},
 {id:'exec',x:260,y:150,w:150,h:56,c:'proc',t:'Execute',s:'row source tree',d:'Runs the plan step by step and returns or changes rows. A change takes row locks.',why:'Plan steps show how much work each operation does.',chk:`SELECT sql_id, buffer_gets, disk_reads, rows_processed FROM v$sql WHERE sql_id = '&sql_id';`,see:[2,4,'SELECT, DML and COMMIT']},
 {id:'bc',x:40,y:150,w:140,h:56,c:'mem',t:'Buffer cache',s:'read blocks',d:'Blocks are read from here, or from disk on a miss. Changed blocks stay here until DBWn writes them.',why:'Logical reads are cheap, physical reads are slow.',chk:`SELECT name, value FROM v$sysstat WHERE name IN ('session logical reads', 'physical reads');`,see:[2,1,'SGA components']},
 {id:'ur',x:40,y:270,w:140,h:56,c:'mem',t:'Undo and redo',s:'generated by DML',d:'A change writes an undo record and a redo record. SELECT writes neither.',why:'This is the cost of DML and what commit later makes durable.',chk:`SELECT name, value FROM v$mystat m JOIN v$statname n USING (statistic#) WHERE name = 'redo size';`,see:[7,0,'Redo logging']},
 {id:'commit',x:260,y:270,w:150,h:56,c:'proc',t:'COMMIT',s:'LGWR writes redo',d:'Marks the transaction committed. LGWR writes the redo, and the session waits for log file sync.',why:'After this the change survives a crash, though the data file may not have it yet.',chk:`SELECT event, total_waits FROM v$system_event WHERE event = 'log file sync';`,see:[2,4,'SELECT, DML and COMMIT']},
 {id:'fetch',x:500,y:270,w:140,h:56,c:'ext',t:'Fetch',s:'rows to the client',d:'For a query, rows are returned in batches (the array size).',why:'A small array size means many round trips.',chk:`SHOW ARRAYSIZE`,see:[2,4,'SELECT, DML and COMMIT']}],
 steps:[
 {ids:['app','parse'],t:'1. The statement arrives. The server process checks the syntax, resolves names and verifies privileges.',w:'Nothing is run until it is valid and permitted.',s:'Schema and privileges, `CURRENT_SCHEMA`.',x:'ORA-00942 table or view does not exist; ORA-01031 insufficient privileges.',c:`SELECT * FROM no_such_table;`},
 {ids:['parse','lib'],t:'2. The text is hashed and looked up in the library cache. If an identical cursor exists, it is reused (soft parse). If not, it must be compiled (hard parse).',w:'Reuse saves CPU and shared pool memory.',s:'`CURSOR_SHARING`, `SESSION_CACHED_CURSORS`, bind variables.',x:'High hard parse counts and `library cache` latch or mutex waits.',c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'parse count%';`},
 {ids:['lib','opt'],t:'3. On a hard parse the optimizer builds candidate plans, estimates their cost from statistics and picks the cheapest.',w:'A good plan depends on good statistics and the right indexes.',s:'`OPTIMIZER_MODE`, statistics, histograms, adaptive features.',x:'A plan that is wrong for the data: check statistics, bind peeking and plan changes.',c:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST'));`},
 {ids:['opt','exec','bc'],t:'4. The plan is executed. Blocks come from the buffer cache or, on a miss, from disk. A DML statement takes row locks and changes blocks in memory.',w:'Row-level locking lets other sessions keep working.',s:'`DB_CACHE_SIZE`, `PGA_AGGREGATE_TARGET` for work areas.',x:'Another session holding the row lock shows as `enq: TX - row lock contention`.',c:`SELECT event, COUNT(*) FROM v$session WHERE wait_class <> 'Idle' GROUP BY event;`},
 {ids:['bc','ur'],t:'5. For DML the change generates undo and redo records. Nothing is written to the data file yet.',w:'This is the price of being able to roll back and recover.',s:'Undo and redo sizing, `NOLOGGING` for specific loads.',x:'Large updates make large redo and undo; ORA-30036 means undo is full.',c:`SELECT used_ublk, used_urec FROM v$transaction;`},
 {ids:['exec','commit','fetch'],t:'6. COMMIT makes LGWR write the redo to the log, and the session waits for it. A query returns rows to the client in batches.',w:'Commit is fast because it is one sequential write.',s:'`COMMIT_WRITE`, array size, fetch size in the driver.',x:'Frequent tiny commits and slow redo storage inflate `log file sync`.',c:`SELECT event, average_wait FROM v$system_event WHERE event = 'log file sync';`}]}},

{h:'2. Startup and shutdown'},
{map:{title:'Startup and shutdown map',h:370,trace:'Start the database',
 hint:'Tap any box, or press Start the database to see what each startup stage reads and does.',
 groups:[{x:30,y:238,w:620,h:120,l:'Shutdown modes'}],
 lines:[[190,58,228,58],[400,58,438,58],[525,86,525,148],[438,178,402,178],[228,178,212,178]],
 nodes:[
 {id:'down',x:40,y:30,w:150,h:56,c:'ext',t:'SHUTDOWN',s:'no instance',d:'No SGA and no processes. Only a privileged connection can start the instance.',why:'The listener can be up while the database is down.',chk:`ps -ef | grep pmon`,see:[4,0,'Startup and shutdown']},
 {id:'nomount',x:230,y:30,w:170,h:56,c:'proc',t:'NOMOUNT',s:'instance started',d:'The parameter file is read, the SGA is allocated and background processes start. No database yet.',why:'It is the state for creating a database or restoring a control file.',chk:`SELECT status FROM v$instance;`,see:[4,0,'Startup and shutdown']},
 {id:'mount',x:440,y:30,w:170,h:56,c:'proc',t:'MOUNT',s:'control file read',d:'The control file is opened and the instance learns where the datafiles and redo logs are.',why:'Recovery operations, renaming files and enabling ARCHIVELOG happen here.',chk:`SELECT name, open_mode FROM v$database;`,see:[4,0,'Startup and shutdown']},
 {id:'open',x:440,y:150,w:170,h:56,c:'proc',t:'OPEN',s:'datafiles and redo opened',d:'Online datafiles and redo logs are opened and checked. Users can connect.',why:'If the files are inconsistent, instance recovery runs first.',chk:`SELECT instance_name, status, database_status FROM v$instance;`,see:[4,0,'Startup and shutdown']},
 {id:'rec',x:230,y:150,w:170,h:56,c:'warn',t:'Instance recovery',s:'only after a crash',d:'SMON applies redo from the last checkpoint, then rolls back uncommitted transactions.',why:'It happens automatically. Duration depends on the redo since the checkpoint.',chk:`SELECT target_mttr, estimated_mttr FROM v$instance_recovery;`,see:[7,2,'Checkpoints and instance recovery']},
 {id:'ready',x:40,y:150,w:170,h:56,c:'mem',t:'Open for users',s:'sessions allowed',d:'Services are registered with the listener and clients can connect.',why:'Registration can take up to a minute. A PDB is a separate open step.',chk:`SELECT name FROM v$services;`,see:[5,1,'listener.ora and lsnrctl']},
 {id:'abort',x:50,y:272,w:130,h:56,c:'warn',t:'ABORT',s:'no checkpoint',d:'Stops at once. Needs instance recovery at the next start.',why:'A last resort when other modes hang.',chk:`SHUTDOWN ABORT`,see:[4,0,'Startup and shutdown']},
 {id:'imm',x:200,y:272,w:140,h:56,c:'proc',t:'IMMEDIATE',s:'rolls back, clean',d:'Rolls back active transactions, disconnects users and checkpoints. Next start needs no recovery.',why:'The normal choice.',chk:`SHUTDOWN IMMEDIATE`,see:[4,0,'Startup and shutdown']},
 {id:'trans',x:360,y:272,w:150,h:56,c:'mem',t:'TRANSACTIONAL',s:'waits for transactions',d:'Waits for active transactions to finish, then disconnects.',why:'Useful for planned work if transactions are short.',chk:`SHUTDOWN TRANSACTIONAL`,see:[4,0,'Startup and shutdown']},
 {id:'normal',x:530,y:272,w:110,h:56,c:'mem',t:'NORMAL',s:'waits sessions',d:'Waits for every session to disconnect.',why:'Can wait forever; rarely used.',chk:`SHUTDOWN NORMAL`,see:[4,0,'Startup and shutdown']}],
 steps:[
 {ids:['down'],t:'1. The database is shut down. There is no instance, so only a privileged user can start it.',w:'`sqlplus / as sysdba` works because it does not need the listener or the instance.',s:'`ORACLE_SID`, `ORACLE_HOME`, password file or OS authentication.',x:'ORA-01034 "ORACLE not available" when connecting to a stopped instance.',c:`sqlplus / as sysdba`},
 {ids:['nomount'],t:'2. STARTUP NOMOUNT reads the spfile (or pfile), allocates the SGA and starts the background processes.',w:'Parameters are fixed for the life of the instance (static) or changeable (dynamic).',s:'`SPFILE`, `PFILE`, `SGA_TARGET`, `PROCESSES`.',x:'ORA-00205 or ORA-01078: the parameter file is missing or invalid.',c:`STARTUP NOMOUNT;`},
 {ids:['mount'],t:'3. MOUNT reads the control file. The instance now knows the files of the database, but has not opened them.',w:'Many DBA tasks need exactly this state.',s:'`CONTROL_FILES`.',x:'ORA-00205 error in identifying control file: a missing or corrupt control file.',c:`ALTER DATABASE MOUNT;`},
 {ids:['open','rec'],t:'4. OPEN opens the datafiles and redo logs. If the shutdown was not clean, SMON runs instance recovery first.',w:'Recovery is automatic and needs only the online redo.',s:'`FAST_START_MTTR_TARGET`.',x:'ORA-01113 or ORA-01110: a datafile needs media recovery.',c:`ALTER DATABASE OPEN;`},
 {ids:['ready'],t:'5. The database is open. LREG registers the services with the listener, and users can connect.',w:'Applications connect to the service, not to the instance.',s:'`LOCAL_LISTENER`, `SERVICE_NAMES`.',x:'ORA-12514 right after start: services are not registered yet.',c:`ALTER SYSTEM REGISTER;`},
 {ids:['abort','imm','trans','normal'],t:'6. To stop it, choose the mode: IMMEDIATE (normal choice), TRANSACTIONAL (wait for transactions), NORMAL (wait for sessions) or ABORT (last resort).',w:'Only IMMEDIATE, TRANSACTIONAL and NORMAL write a final checkpoint and leave a clean database.',s:'`SHUTDOWN <mode>`.',x:'ABORT means instance recovery at the next start, and often a long shutdown wait beforehand is a sign of a stuck session.',c:`SHUTDOWN IMMEDIATE`}]}},

{h:'3. Checkpoint and instance recovery'},
{map:{title:'Checkpoint and recovery map',h:350,trace:'Pull the plug',
 hint:'Tap any box, or press Pull the plug to follow a crash and the recovery that repairs it.',
 groups:[],
 lines:[[190,58,258,58],[430,58,498,58],[115,86,115,148],'M520 86 V118 H350 V148',[570,86,570,148],[190,298,258,298],'M165 206 V232 H320 V268','M570 206 V246 H370 V268',[430,298,498,298]],
 nodes:[
 {id:'sess',x:40,y:30,w:150,h:56,c:'proc',t:'Sessions',s:'change blocks',d:'Sessions change blocks in the buffer cache and generate redo.',why:'The changes live in memory first.',chk:`SELECT name, value FROM v$sysstat WHERE name = 'db block changes';`,see:[2,4,'SELECT, DML and COMMIT']},
 {id:'dirty',x:260,y:30,w:170,h:56,c:'mem',t:'Dirty buffers',s:'in the buffer cache',d:'Blocks that are newer in memory than on disk.',why:'They are lost in a crash, which is why redo exists.',chk:`SELECT COUNT(*) FROM v$bh WHERE dirty = 'Y';`,see:[2,1,'SGA components']},
 {id:'dbwr',x:500,y:30,w:140,h:56,c:'proc',t:'DBWn',s:'writes to datafiles',d:'Writes dirty buffers to the datafiles, in batches.',why:'Always after the matching redo has been written.',chk:`SELECT name, value FROM v$sysstat WHERE name LIKE 'DBWR%';`,see:[2,3,'Background processes']},
 {id:'redo',x:40,y:150,w:150,h:56,c:'disk',t:'Online redo',s:'written at commit',d:'Redo is written to the log when a transaction commits, and before DBWn writes the blocks.',why:'It is the safe copy of every change.',chk:`SELECT group#, status FROM v$log;`,see:[7,0,'Redo logging']},
 {id:'dfile',x:260,y:150,w:170,h:56,c:'disk',t:'Datafiles',s:'may be older than redo',d:'After a crash they can hold a mix of old and new blocks.',why:'Recovery makes them consistent.',chk:`SELECT file#, checkpoint_change# FROM v$datafile_header;`,see:[2,6,'Physical structures']},
 {id:'ckpt',x:500,y:150,w:140,h:56,c:'proc',t:'CKPT',s:'records the position',d:'Updates the datafile headers and the control file with the checkpoint SCN.',why:'It tells recovery where to begin.',chk:`SELECT checkpoint_change# FROM v$database;`,see:[7,2,'Checkpoints and instance recovery']},
 {id:'crash',x:40,y:270,w:150,h:56,c:'warn',t:'Crash',s:'power cut, ABORT',d:'The instance disappears with its memory.',why:'Committed data is safe in the redo.',chk:`SHUTDOWN ABORT`,see:[4,0,'Startup and shutdown']},
 {id:'smon',x:260,y:270,w:170,h:56,c:'proc',t:'SMON',s:'roll forward, roll back',d:'At the next open, SMON applies redo from the checkpoint to the datafiles, then rolls back uncommitted work using undo.',why:'The database is open for users while rollback finishes in the background.',chk:`SELECT * FROM v$fast_start_transactions;`,see:[7,2,'Checkpoints and instance recovery']},
 {id:'open',x:500,y:270,w:140,h:56,c:'mem',t:'Open',s:'consistent',d:'The database is consistent and available.',why:'No DBA action was needed.',chk:`SELECT status FROM v$instance;`,see:[7,2,'Checkpoints and instance recovery']}],
 steps:[
 {ids:['sess','dirty'],t:'1. Sessions change blocks in the buffer cache. Each change is also described in redo, and the blocks become dirty.',w:'Memory is fast, but not durable.',s:'`DB_CACHE_SIZE`, `LOG_BUFFER`.',x:'None yet. This is normal operation.',c:`SELECT name, value FROM v$sysstat WHERE name = 'db block changes';`},
 {ids:['redo'],t:'2. COMMIT forces the redo to the online log. The change is durable even though the datafile does not have it.',w:'The log is written before the data: write-ahead.',s:'Redo storage speed.',x:'Slow redo disks make commits slow.',c:`SELECT event, average_wait FROM v$system_event WHERE event = 'log file sync';`},
 {ids:['dirty','dbwr','dfile','ckpt'],t:'3. A checkpoint makes DBWn write dirty buffers up to a position, and CKPT records that position in the file headers and the control file.',w:'After this, redo before that position is no longer needed for crash recovery.',s:'`FAST_START_MTTR_TARGET`, redo log size, `LOG_CHECKPOINT_INTERVAL`.',x:'`checkpoint incomplete` waits mean DBWn is behind and the log switch cannot proceed.',c:`SELECT target_mttr, estimated_mttr FROM v$instance_recovery;`},
 {ids:['crash','dfile'],t:'4. The instance crashes. The memory is lost. The datafiles hold a mix of old and new blocks, and the redo log holds every committed change.',w:'The redo has what is missing.',s:'Hardware that honours flushes.',x:'Storage that lies about flushes can lose committed data.',c:`SELECT checkpoint_change#, current_scn FROM v$database;`},
 {ids:['redo','smon','dfile'],t:'5. At the next start, SMON reads the redo from the last checkpoint and applies it to the datafiles (roll forward), then rolls back transactions that were never committed using undo.',w:'This is automatic, and safe to repeat.',s:'`FAST_START_PARALLEL_ROLLBACK`, `RECOVERY_PARALLELISM`.',x:'A lost or corrupt online log needs media recovery or a restore.',c:`SELECT * FROM v$recovery_progress;`},
 {ids:['smon','open'],t:'6. The database opens, consistent. Rolling back the uncommitted work may continue in the background.',w:'Recovery time depends on the redo since the last checkpoint.',s:'`FAST_START_MTTR_TARGET` keeps it bounded.',x:'A very long recovery usually points to an oversized redo gap or huge transactions.',c:`SELECT target_mttr, estimated_mttr FROM v$instance_recovery;`}]}},

{h:'4. Log switch and archiving'},
{map:{title:'Log switch map',h:350,trace:'Why does the database wait on a log switch?',
 hint:'Tap any box, or press the trace button to see why a log switch can stall.',
 groups:[],
 lines:[[210,58,258,58],[430,58,498,58],[125,86,125,148],[345,86,345,148],[430,178,498,178],[570,86,570,148],[345,206,345,268],[430,298,498,298]],
 nodes:[
 {id:'lgwr',x:40,y:30,w:170,h:56,c:'proc',t:'LGWR',s:'writes current group',d:'Writes the redo buffer to the current online log group, sequentially.',why:'It is the process every commit waits for.',chk:`SELECT group#, sequence#, status FROM v$log;`,see:[7,0,'Redo logging']},
 {id:'cur',x:260,y:30,w:170,h:56,c:'disk',t:'Current group',s:'filling',d:'The online log group that is being written. Each group has one or more members on different disks.',why:'Group size decides how often a switch happens.',chk:`SELECT group#, bytes/1024/1024 AS mb, members FROM v$log;`,see:[7,1,'Managing online redo logs']},
 {id:'sw',x:500,y:30,w:140,h:56,c:'proc',t:'Log switch',s:'next group',d:'When the group is full, LGWR moves to the next one and a checkpoint is triggered.',why:'Too many switches per hour mean logs are too small.',chk:`SELECT TRUNC(first_time, 'HH') AS hr, COUNT(*) FROM v$log_history GROUP BY TRUNC(first_time, 'HH') ORDER BY 1 DESC FETCH FIRST 6 ROWS ONLY;`,see:[7,0,'Redo logging']},
 {id:'ckpt',x:40,y:150,w:170,h:56,c:'proc',t:'Checkpoint',s:'on every switch',d:'DBWn must write the buffers protected by the group before it can be reused.',why:'If it is not complete when the ring comes around, LGWR waits.',chk:`SELECT name, value FROM v$sysstat WHERE name = 'background checkpoints completed';`,see:[7,2,'Checkpoints and instance recovery']},
 {id:'arc',x:260,y:150,w:170,h:56,c:'proc',t:'ARCn',s:'copies to the archive',d:'In ARCHIVELOG mode the full group is copied to the archive destinations before it can be reused.',why:'A slow or full destination makes the group wait.',chk:`SELECT dest_id, status, error FROM v$archive_dest WHERE status <> 'INACTIVE';`,see:[7,4,'ARCHIVELOG mode']},
 {id:'reuse',x:500,y:150,w:140,h:56,c:'mem',t:'Group reusable',s:'checkpointed, archived',d:'Only when both are done can the group become the current one again.',why:'This is the condition that stalls the database when it is not met.',chk:`SELECT group#, archived, status FROM v$log;`,see:[7,0,'Redo logging']},
 {id:'wait',x:260,y:270,w:170,h:56,c:'warn',t:'Waits',s:'LGWR cannot continue',d:'Sessions wait on `log file switch (checkpoint incomplete)` or `log file switch (archiving needed)`.',why:'All commits stall, so the application appears to hang.',chk:`SELECT event, total_waits FROM v$system_event WHERE event LIKE 'log file switch%';`,see:[7,5,'The Fast Recovery Area']},
 {id:'fix',x:500,y:270,w:140,h:56,c:'mem',t:'Fix',s:'size, groups, FRA',d:'Add or enlarge groups, fix the archive destination or FRA space, speed up DBWn.',why:'Treat the wait event as the symptom and find the cause.',chk:`ALTER DATABASE ADD LOGFILE GROUP 4 SIZE 1G;`,see:[7,1,'Managing online redo logs']}],
 steps:[
 {ids:['lgwr','cur'],t:'1. LGWR writes redo to the current group, one sequential write after another.',w:'Sequential writes are what keep commit fast.',s:'Redo storage speed, number of members.',x:'Slow redo storage shows as `log file parallel write` and `log file sync`.',c:`SELECT event, average_wait FROM v$system_event WHERE event IN ('log file parallel write', 'log file sync');`},
 {ids:['cur','sw'],t:'2. The group fills and LGWR switches to the next group. A checkpoint starts for the group that was just closed.',w:'Switching is routine, a few times per hour is typical.',s:'Group size, `ARCHIVE_LAG_TARGET`.',x:'Switches every few seconds mean logs are far too small.',c:`SELECT COUNT(*) FROM v$log_history WHERE first_time > SYSDATE - 1/24;`},
 {ids:['sw','arc'],t:'3. In ARCHIVELOG mode ARCn copies the closed group to every archive destination.',w:'The archive is what extends recovery past the last backup.',s:'`LOG_ARCHIVE_DEST_n`, `LOG_ARCHIVE_MAX_PROCESSES`.',x:'A full FRA or an unreachable destination stalls archiving.',c:`SELECT * FROM v$recovery_area_usage;`},
 {ids:['ckpt'],t:'4. DBWn writes all dirty buffers protected by that group, so its redo is no longer needed for crash recovery.',w:'A group can be overwritten only after this.',s:'`DB_WRITER_PROCESSES`, `FAST_START_MTTR_TARGET`.',x:'A slow write path leaves the checkpoint incomplete when the ring wraps.',c:`SELECT group#, status FROM v$log;`},
 {ids:['arc','ckpt','reuse'],t:'5. When the group has been checkpointed and archived, its status becomes INACTIVE and it can be reused.',w:'This is the rule for a safe circular log.',s:'Number of groups (at least three).',x:'ACTIVE and not archived groups cannot be reused.',c:`SELECT group#, archived, status FROM v$log;`},
 {ids:['wait','fix'],t:'6. If LGWR needs the next group and it is not reusable, it waits and every commit waits with it. The cure is capacity: more or larger groups, a working archive destination, faster DBWn.',w:'The wait event names the cause.',s:'`ALTER DATABASE ADD LOGFILE`, FRA size.',x:'Do not clear unarchived logs to unblock; that breaks recoverability.',c:`SELECT event, total_waits FROM v$system_event WHERE event LIKE 'log file switch%';`}]}},

{h:'5. Connecting through the listener'},
{map:{title:'Connection map',h:350,trace:'Connect to a service',
 hint:'Tap any box, or press Connect to a service to follow a connection from the client to a session.',
 groups:[],
 lines:[[190,58,228,58],[400,58,438,58],[525,86,525,148],[438,178,402,178],[228,178,212,178],[125,206,125,268],[402,298,438,298]],
 nodes:[
 {id:'cli',x:40,y:30,w:150,h:56,c:'ext',t:'Client',s:'user and connect string',d:'A program that gives a user, a password and a connect identifier.',why:'The identifier names a service, not an instance.',chk:`sqlplus app/***@//dbhost:1521/ORCLPDB1`,see:[5,3,'EZConnect and service naming']},
 {id:'name',x:230,y:30,w:170,h:56,c:'proc',t:'Name resolution',s:'EZConnect or tnsnames',d:'The identifier is expanded to host, port and service name using EZConnect, tnsnames.ora or a directory.',why:'Failure here is ORA-12154, before any network traffic to the listener.',chk:`tnsping ORCLPDB1`,see:[5,2,'tnsnames.ora and sqlnet.ora']},
 {id:'lis',x:440,y:30,w:170,h:56,c:'proc',t:'Listener',s:'port 1521',d:'Accepts the connection, looks up the requested service and passes the client to the right instance.',why:'No listener gives ORA-12541; an unknown service gives ORA-12514.',chk:`lsnrctl status`,see:[5,1,'listener.ora and lsnrctl']},
 {id:'lreg',x:440,y:150,w:170,h:56,c:'mem',t:'LREG',s:'registers services',d:'The instance process that registers services and load with the listener, dynamically.',why:'It is why a service appears only after the database or PDB is open.',chk:`SELECT name FROM v$services;`,see:[5,0,'Oracle Net architecture']},
 {id:'fork',x:230,y:150,w:170,h:56,c:'proc',t:'Server process',s:'dedicated, started',d:'The listener hands the connection to a new dedicated server process, which takes over the conversation.',why:'After that, the listener is not in the data path.',chk:`SELECT spid, program FROM v$process WHERE background IS NULL;`,see:[5,4,'Dedicated vs shared server']},
 {id:'auth',x:40,y:150,w:170,h:56,c:'proc',t:'Authentication',s:'credentials, privilege',d:'The server verifies the credentials and that the user can create a session.',why:'ORA-01017 invalid username or password; ORA-28000 account locked.',chk:`SELECT username, account_status FROM dba_users WHERE username = 'APP';`,see:[9,0,'Users and authentication']},
 {id:'sess',x:40,y:270,w:170,h:56,c:'mem',t:'Session',s:'in v$session',d:'The session exists with its own PGA and settings.',why:'You can see it, monitor it and kill it.',chk:`SELECT sid, serial#, username, service_name FROM v$session WHERE username = 'APP';`,see:[13,4,'Monitoring sessions and locks']},
 {id:'err',x:230,y:270,w:170,h:56,c:'warn',t:'ORA-12xxx errors',s:'where each one comes from',d:'12154 cannot resolve the name, 12541 no listener, 12514 service unknown to the listener, 12170 connect timeout.',why:'The number tells you which stage failed.',chk:`tnsping ORCLPDB1`,see:[5,5,'Troubleshooting connections']},
 {id:'diag',x:440,y:270,w:170,h:56,c:'ext',t:'Check it',s:'lsnrctl, tnsping',d:'lsnrctl status and services show what the listener knows; tnsping tests the path.',why:'Check the listener log for the exact client and time.',chk:`lsnrctl services`,see:[5,5,'Troubleshooting connections']}],
 steps:[
 {ids:['cli','name'],t:'1. The client resolves the connect identifier into host, port and service name.',w:'A name that does not resolve fails before the network is touched.',s:'`tnsnames.ora`, `sqlnet.ora` (`NAMES.DIRECTORY_PATH`), `TNS_ADMIN`.',x:'ORA-12154: TNS could not resolve the connect identifier.',c:`tnsping ORCLPDB1`},
 {ids:['name','lis'],t:'2. The client opens a TCP connection to the listener on the host and port.',w:'The listener is a separate process, not the database.',s:'`listener.ora`, port, firewall.',x:'ORA-12541 no listener; ORA-12170 connect timeout (firewall or wrong host).',c:`lsnrctl status`},
 {ids:['lis','lreg'],t:'3. The listener checks that the requested service is registered. LREG registered it when the instance (or PDB) opened.',w:'Dynamic registration means no manual listener configuration for services.',s:'`LOCAL_LISTENER`, `REMOTE_LISTENER`, `ALTER SYSTEM REGISTER`.',x:'ORA-12514: the listener does not know the service, usually the database or PDB is not open or registered with another listener.',c:`lsnrctl services`},
 {ids:['lis','fork'],t:'4. For a dedicated connection, a server process is started for the session and the listener hands the connection to it.',w:'The listener is then out of the picture.',s:'`SHARED_SERVERS` and `DISPATCHERS` for shared server mode.',x:'ORA-12516 or ORA-12520: the listener could not find a handler because `PROCESSES` is reached.',c:`SELECT resource_name, current_utilization, limit_value FROM v$resource_limit WHERE resource_name IN ('processes', 'sessions');`},
 {ids:['fork','auth'],t:'5. The server process authenticates the user and checks that the user has CREATE SESSION.',w:'Authentication is by the server, over a protocol that never sends the password in clear.',s:'Profiles, password verifiers, `SQLNET.ALLOWED_LOGON_VERSION_SERVER`.',x:'ORA-01017, ORA-28000 (locked), ORA-28001 (expired), ORA-01045 (no CREATE SESSION).',c:`SELECT username, account_status, expiry_date FROM dba_users WHERE username = 'APP';`},
 {ids:['auth','sess'],t:'6. The session is created. It appears in V$SESSION with its service name, program and machine.',w:'This is where you start when you investigate a session.',s:'`SESSIONS`, `PROCESSES`, resource profiles.',x:'ORA-00018 maximum number of sessions exceeded.',c:`SELECT sid, serial#, username, machine, program, service_name FROM v$session WHERE type = 'USER';`}]}},

{h:'6. Read consistency and ORA-01555'},
{map:{title:'Read consistency map',h:350,trace:'Run a long query',
 hint:'Tap any box, or press Run a long query to see how a reader gets a consistent view, and how it can fail.',
 groups:[],
 lines:[[190,58,228,58],[400,58,438,58],[525,86,525,148],[438,178,402,178],[212,178,228,178],[315,206,315,268],[402,298,438,298],[212,298,228,298]],
 nodes:[
 {id:'q',x:40,y:30,w:150,h:56,c:'proc',t:'Query starts',s:'at SCN 1000',d:'A query records the SCN at which it started. Everything it reads must be as of that SCN.',why:'This is the snapshot the query will see.',chk:`SELECT current_scn FROM v$database;`,see:[10,7,'Transactions and locks']},
 {id:'blk',x:230,y:30,w:170,h:56,c:'mem',t:'Block read',s:'changed at SCN 1050',d:'The query reads a block that another session changed and committed after the query started.',why:'The block is too new for this query.',chk:`SELECT ora_rowscn, empno FROM emp WHERE empno = 7369;`,see:[2,4,'SELECT, DML and COMMIT']},
 {id:'undo',x:440,y:30,w:170,h:56,c:'mem',t:'Undo records',s:'old values',d:'The changes made after the query start are recorded in undo, which can reverse them.',why:'The retention of this undo is the limit for how long a query can run.',chk:`SELECT tablespace_name, status, ROUND(SUM(bytes)/1024/1024) AS mb FROM dba_undo_extents GROUP BY tablespace_name, status;`,see:[6,6,'Undo']},
 {id:'cr',x:440,y:150,w:170,h:56,c:'proc',t:'Build a CR block',s:'copy plus undo applied',d:'Oracle copies the block and applies undo to it until it matches SCN 1000.',why:'The original block in the cache is untouched, so writers are not blocked.',chk:`SELECT name, value FROM v$sysstat WHERE name = 'consistent gets';`,see:[10,7,'Transactions and locks']},
 {id:'ok',x:230,y:150,w:170,h:56,c:'mem',t:'Consistent result',s:'as of the start',d:'The query sees the data exactly as it was when it started, even though others committed since.',why:'This is multiversion read consistency.',chk:`SELECT COUNT(*) FROM emp;`,see:[10,7,'Transactions and locks']},
 {id:'ret',x:40,y:150,w:170,h:56,c:'ext',t:'Retention',s:'UNDO_RETENTION',d:'The target time for which Oracle tries to keep committed undo before reusing it.',why:'It is a target. With a fixed-size undo tablespace it may be shortened under pressure.',chk:`SHOW PARAMETER undo_retention`,see:[6,6,'Undo']},
 {id:'e1555',x:230,y:270,w:170,h:56,c:'warn',t:'ORA-01555',s:'snapshot too old',d:'The undo needed to rebuild the old version was already overwritten, so the query cannot be consistent.',why:'It hits long queries on busy systems, and is also seen with fetch across commit.',chk:`SELECT maxquerylen, ssolderrcnt FROM v$undostat ORDER BY begin_time DESC FETCH FIRST 3 ROWS ONLY;`,see:[6,6,'Undo']},
 {id:'fix',x:440,y:270,w:170,h:56,c:'mem',t:'Fix',s:'undo size, query, commit',d:'Size undo for the longest query, tune the query, and do not commit inside a cursor loop.',why:'The Undo Advisor suggests a size for a target retention.',chk:`SELECT MAX(maxquerylen) AS longest_query_secs FROM v$undostat;`,see:[6,6,'Undo']},
 {id:'wr',x:40,y:270,w:170,h:56,c:'ext',t:'Other sessions',s:'keep committing',d:'Concurrent writers generate undo and commit, which makes old undo reusable.',why:'The busier the system, the faster undo is overwritten.',chk:`SELECT begin_time, undoblks, txncount FROM v$undostat ORDER BY begin_time DESC FETCH FIRST 3 ROWS ONLY;`,see:[6,6,'Undo']}],
 steps:[
 {ids:['q'],t:'1. A query begins. Oracle fixes the SCN of that moment. The query will see the database as of that SCN.',w:'This is how a read stays consistent without locks.',s:'Isolation level (`READ COMMITTED` by default; `SERIALIZABLE`, `READ ONLY`).',x:'None here.',c:`SELECT current_scn FROM v$database;`},
 {ids:['q','blk'],t:'2. While the query runs, other sessions change and commit data. The query reads a block with a newer SCN than its own.',w:'The block is valid, but not for this query.',s:'Workload concurrency.',x:'None yet. This is normal on busy systems.',c:`SELECT sid, event FROM v$session WHERE status = 'ACTIVE' AND type = 'USER';`},
 {ids:['blk','undo','cr'],t:'3. Oracle copies the block and applies undo to the copy until it is as of the query SCN (a consistent read block).',w:'Readers rebuild the past instead of waiting for writers.',s:'Buffer cache size (CR copies live there too).',x:'Many CR copies for a hot block are visible as `consistent gets - examination` and `buffer busy waits`.',c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'consistent%';`},
 {ids:['cr','ok'],t:'4. The query continues with the consistent copy, and returns data as it was at its start.',w:'It does not matter how many changes were committed since.',s:'None.',x:'None.',c:`SELECT COUNT(*) FROM emp;`},
 {ids:['ret','wr','undo'],t:'5. Meanwhile new transactions need undo space. Undo that is no longer needed for active transactions (and past the retention target) can be overwritten.',w:'Retention is a target, not a guarantee, unless `RETENTION GUARANTEE` is set.',s:'`UNDO_RETENTION`, undo tablespace size, `RETENTION GUARANTEE`.',x:'A small undo tablespace on a busy system shortens the real retention.',c:`SELECT tuned_undoretention FROM v$undostat ORDER BY begin_time DESC FETCH FIRST 1 ROW ONLY;`},
 {ids:['e1555','fix'],t:'6. If the query needs undo that was overwritten, it fails with ORA-01555. The fix is undo sized for the longest query, tuned queries, and no commits inside fetch loops.',w:'It is a trade between undo space and query length.',s:'Undo Advisor, `UNDO_RETENTION`, query tuning.',x:'`RETENTION GUARANTEE` can instead make DML fail with out-of-space, so size for it.',c:`SELECT maxquerylen, ssolderrcnt, nospaceerrcnt FROM v$undostat ORDER BY begin_time DESC FETCH FIRST 3 ROWS ONLY;`}]}},

{h:'7. Login and privilege checks'},
{map:{title:'Login and privilege map',h:350,trace:'Why ORA-01031 or ORA-00942?',
 hint:'Tap any gate, or press the trace button to walk a login and a query through every check.',
 groups:[],
 lines:[[210,58,253,58],[425,58,468,58],[555,86,555,148],[468,178,427,178],[253,178,212,178],[125,206,125,268]],
 nodes:[
 {id:'acct',x:40,y:30,w:170,h:56,c:'proc',t:'Account',s:'exists, not locked',d:'The user must exist and be OPEN: not locked and not expired.',why:'Status is in DBA_USERS.',chk:`SELECT username, account_status, lock_date, expiry_date FROM dba_users WHERE username = 'APP';`,see:[9,0,'Users and authentication']},
 {id:'pwd',x:255,y:30,w:170,h:56,c:'proc',t:'Password',s:'authentication',d:'The credentials are verified, or the OS or external identity is accepted.',why:'Password verifiers depend on the allowed logon version.',chk:`SELECT username, authentication_type FROM dba_users WHERE username = 'APP';`,see:[9,0,'Users and authentication']},
 {id:'cs',x:470,y:30,w:170,h:56,c:'proc',t:'CREATE SESSION',s:'system privilege',d:'The user needs this privilege, directly or through a role, to connect.',why:'It is separate from owning objects.',chk:`SELECT * FROM dba_sys_privs WHERE grantee = 'APP';`,see:[9,2,'System and object privileges']},
 {id:'prof',x:470,y:150,w:170,h:56,c:'mem',t:'Profile limits',s:'sessions, password rules',d:'The profile limits sessions per user, password lifetime and failed logins.',why:'A user over the session limit cannot connect.',chk:`SELECT resource_name, limit FROM dba_profiles WHERE profile = (SELECT profile FROM dba_users WHERE username = 'APP');`,see:[9,4,'Profiles']},
 {id:'quota',x:255,y:150,w:170,h:56,c:'mem',t:'Quota',s:'space for new objects',d:'To create or grow a segment the user needs quota on that tablespace, or UNLIMITED TABLESPACE.',why:'Separate from DBA tablespace size.',chk:`SELECT tablespace_name, bytes, max_bytes FROM dba_ts_quotas WHERE username = 'APP';`,see:[9,1,'Creating users and quotas']},
 {id:'objp',x:40,y:150,w:170,h:56,c:'mem',t:'Object privilege',s:'direct or through a role',d:'To read or change another schema object, the user needs a privilege on it, granted directly or through an enabled role.',why:'Roles do not work inside definer-rights PL/SQL.',chk:`SELECT grantee, owner, table_name, privilege FROM dba_tab_privs WHERE grantee = 'APP';`,see:[9,2,'System and object privileges']},
 {id:'ok',x:40,y:270,w:170,h:56,c:'ext',t:'Statement runs',s:'or error',d:'If every check passes the statement runs. If not, an ORA error names the missing piece.',why:'An object you may not see is reported as not existing (ORA-00942).',chk:`SELECT * FROM hr.employees;`,see:[9,3,'Predefined roles and least privilege']}],
 steps:[
 {ids:['acct'],t:'1. The user must exist and its account must be OPEN. A locked or expired account cannot log in.',w:'Account status is the first thing to check for a login failure.',s:'`ALTER USER ... ACCOUNT UNLOCK`, `PASSWORD EXPIRE`.',x:'ORA-28000 account is locked; ORA-28001 password has expired.',c:`SELECT username, account_status FROM dba_users WHERE username = 'APP';`},
 {ids:['acct','pwd'],t:'2. The credentials are verified. Passwords are checked by the server against the stored verifier.',w:'External authentication (OS, Kerberos, certificates) works the same way logically.',s:'`SQLNET.ALLOWED_LOGON_VERSION_SERVER`, verifiers.',x:'ORA-01017 invalid username or password. Often the wrong service or PDB.',c:`SELECT username, password_versions FROM dba_users WHERE username = 'APP';`},
 {ids:['pwd','cs'],t:'3. The user needs CREATE SESSION to connect.',w:'It is a separate privilege from everything else.',s:'`GRANT CREATE SESSION`, roles such as CONNECT (privilege set varies by version).',x:'ORA-01045: user lacks CREATE SESSION privilege; logon denied.',c:`GRANT CREATE SESSION TO app;`},
 {ids:['cs','prof'],t:'4. The profile is applied: failed login limits, password rules and resource limits such as sessions per user.',w:'Profiles apply to all users who use them.',s:'`CREATE PROFILE`, `FAILED_LOGIN_ATTEMPTS`, `SESSIONS_PER_USER`.',x:'ORA-02391 exceeded simultaneous SESSIONS_PER_USER limit.',c:`SELECT * FROM dba_profiles WHERE profile = 'DEFAULT';`},
 {ids:['prof','quota'],t:'5. When the session creates data it needs quota on the tablespace.',w:'Quota is per user and per tablespace.',s:'`ALTER USER ... QUOTA`, default tablespace.',x:'ORA-01950 no privileges on tablespace; ORA-01536 space quota exceeded.',c:`SELECT * FROM dba_ts_quotas WHERE username = 'APP';`},
 {ids:['quota','objp','ok'],t:'6. For each object in a statement, the user needs a privilege on it. If it is missing, Oracle may report the object as not existing.',w:'This avoids revealing which objects exist.',s:'`GRANT ... ON`, roles, `ADMIN OPTION`.',x:'ORA-00942 table or view does not exist; ORA-01031 insufficient privileges.',c:`SELECT * FROM dba_tab_privs WHERE grantee = 'APP' AND table_name = 'EMPLOYEES';`}]}},

{h:'8. Data Pump export and import'},
{map:{title:'Data Pump map',h:350,trace:'Run an export and an import',
 hint:'Tap any box, or press Run an export and an import to follow a Data Pump job.',
 groups:[],
 lines:[[190,58,228,58],[400,58,438,58],[525,86,525,148],[438,178,402,178],[228,178,212,178],[125,206,125,268],[212,298,228,298]],
 nodes:[
 {id:'cl',x:40,y:30,w:150,h:56,c:'ext',t:'expdp, impdp',s:'client program',d:'The client only starts and controls the job. The work runs on the server.',why:'You can disconnect and later ATTACH to the job.',chk:`expdp system@pdb1 schemas=hr directory=dp_dir dumpfile=hr.dmp logfile=hr.log`,see:[11,1,'Data Pump architecture']},
 {id:'mcp',x:230,y:30,w:170,h:56,c:'proc',t:'Master control',s:'master table',d:'The master control process (DMnn) coordinates the job and records its state in a master table.',why:'The master table is what allows a job to be restarted.',chk:`SELECT owner_name, job_name, state FROM dba_datapump_jobs;`,see:[11,6,'Monitoring and restarting jobs']},
 {id:'wk',x:440,y:30,w:170,h:56,c:'proc',t:'Workers',s:'DWnn, parallel',d:'Worker processes read or write metadata and data. With `PARALLEL` there are several.',why:'Parallelism helps only if storage and CPU can use it.',chk:`SELECT owner_name, job_name, session_type FROM dba_datapump_sessions;`,see:[11,1,'Data Pump architecture']},
 {id:'dir',x:440,y:150,w:170,h:56,c:'disk',t:'Directory object',s:'path on the server',d:'A database object that maps a name to a server path. All dump and log files use it.',why:'The database OS user must be able to read and write the path.',chk:`SELECT directory_name, directory_path FROM dba_directories;`,see:[11,1,'Data Pump architecture']},
 {id:'dump',x:230,y:150,w:170,h:56,c:'disk',t:'Dump files',s:'.dmp and log',d:'Binary export files in the directory, plus a log file.',why:'They are not a backup strategy: they are logical and point in time.',chk:`ls -l /u03/dpdump`,see:[11,2,'Export and import']},
 {id:'tgt',x:40,y:150,w:170,h:56,c:'mem',t:'Target database',s:'impdp loads here',d:'The import reads the dump files and creates objects and rows.',why:'REMAP parameters change schema, tablespace or file names on the way in.',chk:`impdp system@pdb2 directory=dp_dir dumpfile=hr.dmp remap_schema=hr:hr_test`,see:[11,4,'Remapping and filtering']},
 {id:'mon',x:40,y:270,w:170,h:56,c:'ext',t:'Monitor',s:'jobs and sessions',d:'DBA_DATAPUMP_JOBS and V$SESSION_LONGOPS show state and progress. ATTACH reconnects.',why:'You can stop and restart a job without losing the work done.',chk:`expdp system@pdb1 attach=SYS_EXPORT_SCHEMA_01`,see:[11,6,'Monitoring and restarting jobs']},
 {id:'net',x:230,y:270,w:170,h:56,c:'proc',t:'Network mode',s:'NETWORK_LINK, no files',d:'The import reads directly from the source database over a database link, with no dump file.',why:'It saves disk and one step, but needs a link and network bandwidth.',chk:`impdp system@pdb2 network_link=src_link schemas=hr`,see:[11,3,'Data Pump with PDBs and network mode']},
 {id:'pdb',x:440,y:270,w:170,h:56,c:'ext',t:'PDB aware',s:'connect to the PDB',d:'Run the job by connecting to the PDB service, not the root.',why:'Directory objects and users belong to the PDB.',chk:`sqlplus system@//dbhost:1521/pdb1`,see:[11,3,'Data Pump with PDBs and network mode']}],
 steps:[
 {ids:['cl','mcp'],t:'1. You start the export. The client asks the database to create the job; the master control process starts and creates the master table.',w:'Everything after this runs inside the database.',s:'`JOB_NAME`, `PARALLEL`, `CLUSTER`.',x:'ORA-31626 job does not exist, ORA-31631 privileges are required.',c:`expdp system@pdb1 schemas=hr directory=dp_dir dumpfile=hr_%U.dmp logfile=hr.log parallel=4`},
 {ids:['mcp','wk'],t:'2. The master process starts workers. They extract metadata first, then the table data, in parallel when configured.',w:'The master table tracks each object, so the job can be resumed.',s:'`PARALLEL`, `INCLUDE`, `EXCLUDE`, `QUERY`, `CONTENT`.',x:'Too much parallelism on slow storage makes things worse.',c:`SELECT * FROM v$session_longops WHERE opname LIKE '%EXPORT%' AND sofar < totalwork;`},
 {ids:['wk','dir','dump'],t:'3. Workers write dump files through the directory object. The log file records the objects and row counts.',w:'The path belongs to the database server, not to your client machine.',s:'`CREATE DIRECTORY`, `READ` and `WRITE` privileges, `DUMPFILE=%U`.',x:'ORA-39002 invalid operation, ORA-39070 cannot open the log file: a directory or permission problem.',c:`SELECT * FROM dba_directories;`},
 {ids:['mon'],t:'4. While it runs you can monitor it, stop it or attach later from another session.',w:'A job survives a client disconnect.',s:'`STOP_JOB`, `START_JOB`, `ATTACH`.',x:'A job left in NOT RUNNING state keeps its master table; clean it up.',c:`SELECT owner_name, job_name, state, attached_sessions FROM dba_datapump_jobs;`},
 {ids:['dump','tgt'],t:'5. Copy the dump files to the target directory and run impdp, remapping schema, tablespace or names where needed.',w:'The target may be another database, version or PDB.',s:'`REMAP_SCHEMA`, `REMAP_TABLESPACE`, `TABLE_EXISTS_ACTION`, `TRANSFORM`.',x:'Existing objects raise errors unless you choose the action; missing tablespaces fail.',c:`impdp system@pdb2 directory=dp_dir dumpfile=hr_%U.dmp remap_schema=hr:hr_test`},
 {ids:['net','pdb'],t:'6. With NETWORK_LINK the import reads directly from the source, without any dump file. In a CDB, connect to the target PDB service.',w:'It removes a copy step and a storage requirement.',s:'`NETWORK_LINK`, `PARALLEL`, link privileges.',x:'A slow link, large LOBs and missing link privileges are the usual problems.',c:`impdp system@pdb2 network_link=src_link schemas=hr`}]}}
]},



/* 1 ---------------------------------------------------------------- processes */
{t:'Server processes',d:'The background processes of an instance, what each one does and where to look when it misbehaves.',see:[[2,3,'Background processes'],[2,5,'Dedicated vs shared server']],b:[
{t:[['Process','Job','Look here'],
['PMON','Cleans up after failed user processes: rolls back their transaction, releases locks','Alert log, `V$PROCESS`'],
['SMON','Instance recovery at startup, cleans temporary segments, coalesces free space','Alert log, `V$FAST_START_TRANSACTIONS`'],
['DBWn','Writes dirty buffers from the buffer cache to the datafiles','`V$SYSTEM_EVENT` (`free buffer waits`, `write complete waits`)'],
['LGWR','Writes the redo log buffer to the online redo logs (at commit, every 3 s, when 1/3 full)','`log file sync`, `log file parallel write`'],
['CKPT','Signals DBWn at a checkpoint and updates control file and datafile headers','`V$INSTANCE_RECOVERY`, alert log'],
['ARCn','Copies a filled online redo log to the archive destinations (ARCHIVELOG mode)','`V$ARCHIVE_DEST`, `V$ARCHIVED_LOG`'],
['MMON','Takes AWR snapshots, raises alerts, computes metrics','Alert log, `DBA_HIST_SNAPSHOT`'],
['MMNL','Writes ASH data and short-interval metrics','`V$ACTIVE_SESSION_HISTORY`'],
['MMAN','Manages automatic memory resizing (SGA_TARGET, MEMORY_TARGET)','`V$SGA_RESIZE_OPS`'],
['LREG','Registers services with the listener (replaced PMON for this job in 12c)','`lsnrctl services`'],
['VKTM','Virtual keeper of time, supplies the timer for the instance','Rarely needed'],
['DIAG, DIA0','Diagnostic dumps and hang detection','Trace files in the ADR'],
['RECO','Resolves in-doubt distributed transactions','`DBA_2PC_PENDING`'],
['CJQ0 / Jnnn','Job queue coordinator and job slaves for the scheduler','`DBA_SCHEDULER_JOB_RUN_DETAILS`'],
['SMCO / Wnnn','Space management coordinator and its workers (segment space, autoextend)','Alert log'],
['CTWR','Writes block change tracking data (incremental backups)','`V$BLOCK_CHANGE_TRACKING`'],
['RVWR','Writes flashback logs (when Flashback Database is on)','`V$FLASHBACK_DATABASE_LOG`'],
['Dnnn, Snnn','Dispatchers and shared servers (shared server architecture only)','`V$DISPATCHER`, `V$SHARED_SERVER`']]},
{note:'Every process name above can be listed with `SELECT name, description FROM v$bgprocess WHERE paddr <> HEXTORAW(\'00\')`. In a CDB there is one set of background processes for the whole container database, not one per PDB.'},
{code:`-- which background processes are running
SELECT pname, spid, program FROM v$process WHERE background = 1 ORDER BY pname;

# from the OS (pmon, smon and so on carry the instance name)
ps -ef | grep ora_ | grep -v grep`}
]},

/* 2 ---------------------------------------------------------------- files */
{t:'Database files and what they hold',d:'Every file a database depends on, whether it may be multiplexed and what happens when you lose it.',see:[[2,6,'Physical structures'],[7,3,'Control files']],b:[
{t:[['File','Contents','Lose it and...'],
['Datafile','Tables, indexes and undo (`DBA_DATA_FILES`, `V$DATAFILE`)','Restore and recover that file; the rest of the database may stay open'],
['Tempfile','Sort and hash spill space (`V$TEMPFILE`)','Nothing to restore: drop it and add a new tempfile'],
['Control file','Database name, DBID, file list, checkpoint SCNs, RMAN metadata (`V$CONTROLFILE`)','Instance stops; restore from a copy or autobackup and recover'],
['Online redo log','Changes not yet in datafiles (`V$LOG`, `V$LOGFILE`)','Loss of a current log means incomplete recovery, so multiplex'],
['Archived redo log','Copies of filled redo logs (`V$ARCHIVED_LOG`)','Gaps break media recovery and standbys; keep until backed up'],
['SPFILE','Binary parameter file, changed with `ALTER SYSTEM`','Start with a PFILE, recreate with `CREATE SPFILE FROM PFILE`'],
['PFILE (`init<SID>.ora`)','Text parameter file','Recreate from `V$PARAMETER`'],
['Password file (`orapw<SID>`)','Administrative users for remote SYSDBA connections','`orapwd` to recreate; OS authentication still works'],
['Block change tracking file','Changed block map for incremental backups','Disable and re-enable'],
['Flashback logs','Block pre-images in the FRA','Flashback Database stops working'],
['Wallet (`ewallet.p12`, `cwallet.sso`)','TDE master key','Encrypted data is unreadable without it']]},
{h:'Home and diagnostic directories'},
{t:[['Path (typical)','Meaning'],
['`$ORACLE_BASE`','Top of the Oracle tree (for example `/u01/app/oracle`)'],
['`$ORACLE_HOME`','The installed software (`.../product/19.0.0/dbhome_1`)'],
['`$ORACLE_HOME/dbs`','Default place for `spfile<SID>.ora`, `init<SID>.ora`, `orapw<SID>`'],
['`$ORACLE_HOME/network/admin`','`listener.ora`, `tnsnames.ora`, `sqlnet.ora` (or the `TNS_ADMIN` directory)'],
['`$ORACLE_BASE/diag/rdbms/<db>/<SID>`','The ADR home: `alert`, `trace`, `incident`, `cdump`'],
['`$ORACLE_BASE/oradata/<DB>` or `+DATA`','Datafiles, redo and control files'],
['`/etc/oratab`','List of local databases and homes'],
['`/etc/oraInst.loc`, `oraInventory`','Pointer to and content of the central inventory']]},
{note:'Multiplex control files and online redo logs on different disks. It costs almost nothing and removes the worst recovery scenarios.'}
]},

/* 3 ---------------------------------------------------------------- locations */
{t:'Locations by platform',d:'Where software, data, configuration and services usually live for each way of installing Oracle.',see:[[3,1,'OFA layout'],[3,5,'Starting automatically']],b:[
{t:[['Item','Linux (RPM or installer)','Windows','Container (Oracle AI Database Free)'],
['Software home','`/u01/app/oracle/product/19.0.0/dbhome_1`','`C:\\app\\oracle\\product\\19.0.0\\dbhome_1`','Inside the image (set by `ORACLE_HOME`)'],
['Data files','`/u01/app/oracle/oradata/<DB>`','`C:\\app\\oracle\\oradata\\<DB>`','A volume mounted on `/opt/oracle/oradata`'],
['Parameter file','`$ORACLE_HOME/dbs/spfile<SID>.ora`','`%ORACLE_HOME%\\database\\SPFILE<SID>.ORA`','`$ORACLE_HOME/dbs`'],
['Net configuration','`$ORACLE_HOME/network/admin`','`%ORACLE_HOME%\\network\\admin`','`$ORACLE_HOME/network/admin`'],
['Alert log','`$ORACLE_BASE/diag/rdbms/<db>/<SID>/trace/alert_<SID>.log`','Same under `%ORACLE_BASE%\\diag`','Same under `/opt/oracle/diag`'],
['Instance start at boot','`dbstart` with `/etc/oratab`, a systemd unit, or Oracle Restart','Windows service `OracleService<SID>`','Container entrypoint'],
['Listener service','`lsnrctl start`, systemd or Oracle Restart','`OracleOra...TNSListener`','Started by the container'],
['Default listener port','1521','1521','1521 (map it with `-p`)'],
['Environment','`~/.bash_profile`: `ORACLE_HOME`, `ORACLE_SID`, `PATH`','Registry and service','Image environment'],
['Inventory','`/etc/oraInst.loc` points to `oraInventory`','`C:\\Program Files\\Oracle\\Inventory`','n/a']]},
{note:'The exact paths depend on your OFA choices. Run `echo $ORACLE_HOME $ORACLE_BASE` and `SELECT name FROM v$datafile` to find out what your system really uses.'}
]},

/* 4 ---------------------------------------------------------------- logs */
{t:'Log files and where to find them',d:'Every log you may need during an incident, and how to locate it.',see:[[4,4,'ADR and diagnostic destinations'],[13,2,'Reading the alert log']],b:[
{t:[['Log','What it records','Where'],
['Alert log (text)','Startup, shutdown, ORA- errors, log switches, parameter changes, DDL for tablespaces and files','`$ORACLE_BASE/diag/rdbms/<db>/<SID>/trace/alert_<SID>.log`'],
['Alert log (XML)','The same, in XML for tools','`.../alert/log.xml`'],
['Trace files','Per-process detail and errors (`ora_<proc>_<pid>.trc`)','`.../trace/`'],
['Incident directories','Dumps and traces packaged for one error (`incdir_n`)','`.../incident/`'],
['Listener log','Connections, service registration, errors','`$ORACLE_BASE/diag/tnslsnr/<host>/listener/trace/listener.log`'],
['Audit trail','Unified audit records (`UNIFIED_AUDIT_TRAIL`) and OS audit files for SYS','Database, plus `$ORACLE_BASE/admin/<db>/adump`'],
['Install and DBCA logs','Software installation and database creation','`$ORACLE_BASE/cfgtoollogs`, `oraInventory/logs`'],
['Data Pump log','Export or import progress','The `LOGFILE=` name in the DIRECTORY object'],
['RMAN log','Backup and restore output','The `log=` file or the console']]},
{h:'Find them from SQL'},
{code:`SELECT name, value FROM v$diag_info;
SELECT value FROM v$diag_info WHERE name = 'Diag Trace';
SELECT value FROM v$diag_info WHERE name = 'Default Trace File';

-- recent alert log lines from SQL (19c)
SELECT originating_timestamp, message_text FROM v$diag_alert_ext
WHERE originating_timestamp > SYSTIMESTAMP - INTERVAL '1' HOUR ORDER BY 1;`},
{code:`# ADRCI
adrci
adrci> show home
adrci> set home diag/rdbms/orcl/ORCL
adrci> show alert -tail 50
adrci> show incident
adrci> ips pack incident 12345`}
]},

/* 5 ---------------------------------------------------------------- parameters */
{t:'Important parameters',d:'The initialization parameters a DBA changes most, with default, scope and a sensible starting point.',see:[[4,2,'Parameters every DBA must know'],[4,1,'PFILE vs SPFILE']],b:[
{t:[['Parameter','Default','Change takes effect','Note'],
['`db_name`','none (set at creation)','Restart; never change by hand','Use `nid` or recreate'],
['`db_unique_name`','= `db_name`','Restart','Must differ on every Data Guard member'],
['`compatible`','release default','Restart, one way','Raising it blocks downgrade'],
['`sga_target` / `sga_max_size`','0 (manual) or set by DBCA','Dynamic up to `sga_max_size`','Automatic shared memory management'],
['`pga_aggregate_target`','10 MB or 20% of SGA','Dynamic','Total target for work areas'],
['`pga_aggregate_limit`','larger of 2 GB, 200% of PGA target','Dynamic','Hard limit; sessions are terminated above it'],
['`memory_target`','0','Dynamic','Not usable with HugePages. Prefer `sga_target` on Linux.'],
['`processes`','derived from CPU count','Restart','`sessions` and `transactions` derive from it'],
['`sessions`','1.5 x processes + 22','Restart','Raise with `processes`'],
['`open_cursors`','50','Dynamic','Commonly 300 or more for applications'],
['`session_cached_cursors`','50','Dynamic (session or system)','Reduces soft parse cost'],
['`db_files`','200','Restart','Maximum datafiles'],
['`undo_tablespace`','set at creation','Dynamic','One per instance in RAC'],
['`undo_retention`','900 s','Dynamic','Must cover your longest query'],
['`db_recovery_file_dest` / `_size`','unset','Dynamic','Size first, then the location'],
['`log_archive_dest_n`','unset','Dynamic','Archive and standby destinations'],
['`db_create_file_dest`','unset','Dynamic','Enables Oracle Managed Files'],
['`control_files`','set at creation','Restart','Two or more copies'],
['`db_block_size`','8192','Fixed at creation','Cannot be changed later'],
['`audit_trail`','`DB` (when not unified-only)','Restart','Unified auditing is the standard in 19c and later'],
['`diagnostic_dest`','`$ORACLE_BASE`','Dynamic','Where the ADR lives'],
['`local_listener` / `remote_listener`','unset or default','Dynamic','Registration targets (SCAN in RAC)'],
['`enable_pluggable_database`','TRUE for CDBs','Fixed at creation','Cannot be turned off for a CDB'],
['`max_pdbs`','4098','Dynamic','Cap the number of PDBs'],
['`statistics_level`','`TYPICAL`','Dynamic','`BASIC` disables AWR data; do not use'],
['`optimizer_mode`','`ALL_ROWS`','Dynamic','Rarely changed'],
['`use_large_pages`','`TRUE`','Restart','`ONLY` fails startup if HugePages are short'],
['`filesystemio_options`','`NONE` (platform dependent)','Restart','`SETALL` on filesystems for direct and async I/O']]},
{code:`-- one parameter, with where it can be changed
SELECT name, value, isdefault, issys_modifiable, ispdb_modifiable
FROM v$parameter WHERE name = 'open_cursors';

ALTER SYSTEM SET open_cursors = 300 SCOPE = BOTH;
ALTER SYSTEM SET processes = 800 SCOPE = SPFILE;   -- needs restart`},
{note:'`SCOPE=BOTH` is the default only when the instance was started with an SPFILE. `SCOPE=SPFILE` for static parameters, then restart.'}
]},

/* 6 ---------------------------------------------------------------- views */
{t:'System views and functions',d:'Which view answers which question. V$ views show now, DBA_ views show definitions, CDB_ views span containers.',see:[[2,8,'Data dictionary and dynamic views'],[10,6,'Data dictionary queries']],b:[
{t:[['Question','View or function'],
['What is this instance and database?','`V$INSTANCE`, `V$DATABASE`, `V$VERSION`'],
['Which parameters are set?','`V$PARAMETER`, `V$SPPARAMETER`, `V$SYSTEM_PARAMETER`'],
['Who is connected and doing what?','`V$SESSION`, `V$PROCESS`, `V$TRANSACTION`'],
['Who blocks whom?','`V$SESSION.BLOCKING_SESSION`, `V$LOCK`, `DBA_BLOCKERS`, `DBA_WAITERS`'],
['What are sessions waiting on?','`V$SESSION`, `V$SYSTEM_EVENT`, `V$ACTIVE_SESSION_HISTORY`'],
['How big is the SGA and PGA?','`V$SGAINFO`, `V$SGASTAT`, `V$PGASTAT`, `V$MEMORY_DYNAMIC_COMPONENTS`'],
['Which datafiles and how full?','`DBA_DATA_FILES`, `DBA_FREE_SPACE`, `DBA_TABLESPACE_USAGE_METRICS`'],
['Tablespaces and segments','`DBA_TABLESPACES`, `DBA_SEGMENTS`, `DBA_EXTENTS`'],
['Undo and temp use','`V$UNDOSTAT`, `V$TEMPSEG_USAGE`, `V$SORT_SEGMENT`'],
['Redo and archiving','`V$LOG`, `V$LOGFILE`, `V$ARCHIVED_LOG`, `V$LOG_HISTORY`'],
['Fast Recovery Area space','`V$RECOVERY_FILE_DEST`, `V$RECOVERY_AREA_USAGE`'],
['Backups (RMAN)','`V$RMAN_BACKUP_JOB_DETAILS`, `V$BACKUP_SET`, `V$BACKUP_PIECE`'],
['Users, roles, privileges','`DBA_USERS`, `DBA_ROLE_PRIVS`, `DBA_SYS_PRIVS`, `DBA_TAB_PRIVS`'],
['Objects and invalid code','`DBA_OBJECTS` (filter on `STATUS`), `DBA_ERRORS`'],
['SQL statements and plans','`V$SQL`, `V$SQL_PLAN`, `DBMS_XPLAN.DISPLAY_CURSOR`'],
['Containers and PDBs','`V$CONTAINERS`, `V$PDBS`, `CDB_PDBS`, `CDB_USERS`'],
['Scheduler','`DBA_SCHEDULER_JOBS`, `DBA_SCHEDULER_JOB_RUN_DETAILS`'],
['Alerts and recommendations','`DBA_OUTSTANDING_ALERTS`, `DBA_ALERT_HISTORY`'],
['Which view exists?','`DICT`, `DICT_COLUMNS`, `V$FIXED_TABLE`']]},
{h:'Handy functions'},
{t:[['Call','Returns'],
['`SYS_CONTEXT(\'USERENV\',\'CON_NAME\')`','Current container name'],
['`SYS_CONTEXT(\'USERENV\',\'SESSION_USER\')`','Logged-in user'],
['`SYS_CONTEXT(\'USERENV\',\'SID\')`','Session ID'],
['`DBMS_UTILITY.GET_TIME`','Hundredths of a second counter'],
['`DBMS_METADATA.GET_DDL(\'TABLE\',\'T\',\'OWNER\')`','DDL of an object'],
['`TIMESTAMP_TO_SCN`, `SCN_TO_TIMESTAMP`','Convert between time and SCN']]},
{note:'In a CDB, `DBA_*` shows the current container only. Use `CDB_*` from the root for all containers, and always name the container in your script.'}
]},

/* 7 ---------------------------------------------------------------- tools */
{t:'Command-line tools',d:'Utilities that ship with the database, what each is for and a typical command.',see:[[1,3,'SQL*Plus, SQLcl and VS Code'],[11,1,'Data Pump']],b:[
{t:[['Tool','Use','Typical command'],
['`sqlplus`','Run SQL and scripts','`sqlplus / as sysdba`'],
['`sql` (SQLcl)','Modern SQL client with history and formatting','`sql system@//host:1521/pdb1`'],
['`lsnrctl`','Control the listener','`lsnrctl status`, `lsnrctl reload`'],
['`tnsping`','Test name resolution and listener reachability','`tnsping ORCL`'],
['`dbca`','Create, configure and delete databases','`dbca -silent -createDatabase ...`'],
['`netca`, `netmgr`','Configure Net Services','`netca -silent -responsefile ...`'],
['`rman`','Backup, restore, recover','`rman target /`'],
['`expdp`, `impdp`','Data Pump export and import','`expdp system schemas=app directory=dp_dir dumpfile=app.dmp`'],
['`sqlldr`','Load flat files','`sqlldr userid=app control=load.ctl`'],
['`adrci`','Browse the ADR, package incidents','`adrci exec="show alert -tail 20"`'],
['`orapwd`','Create a password file','`orapwd file=orapwORCL password=... format=12.2`'],
['`dbv`','Verify a datafile offline','`dbv file=users01.dbf`'],
['`tkprof`','Format SQL trace files','`tkprof in.trc out.txt sys=no`'],
['`opatch`','Apply and list patches','`opatch lspatches`'],
['`dbshut`, `dbstart`','Start and stop databases listed in `oratab`','`dbstart $ORACLE_HOME`'],
['`srvctl`, `crsctl`','Oracle Restart or Clusterware control','See the RAC reference']]},
{h:'Start, stop and connect in SQL*Plus'},
{code:`sqlplus / as sysdba
SQL> STARTUP                 -- NOMOUNT, MOUNT, OPEN
SQL> SHUTDOWN IMMEDIATE
SQL> ALTER SESSION SET CONTAINER = pdb1;
SQL> SHOW CON_NAME
SQL> ALTER PLUGGABLE DATABASE pdb1 OPEN;

sqlplus app_user@//dbhost:1521/pdb1`}
]},

/* 8 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'Shutdown modes, startup stages, parameter scope, PDB open modes and which connection to use.',see:[[4,0,'Startup and shutdown'],[8,4,'Opening and closing PDBs']],b:[
{h:'Shutdown modes'},
{t:[['Mode','New connections','Waits for sessions','Rolls back','Needs recovery at start'],
['`NORMAL`','No','Yes, until they disconnect','n/a','No'],
['`TRANSACTIONAL`','No','Until transactions finish','Active transactions complete','No'],
['`IMMEDIATE`','No','No','Yes, then disconnects','No'],
['`ABORT`','No','No','No','**Yes**, instance recovery']]},
{h:'Startup stages'},
{t:[['Stage','What is open','Typical use'],
['`NOMOUNT`','Instance only (parameter file read, memory and processes started)','Create a database, restore a control file'],
['`MOUNT`','Control file read','Rename files, enable ARCHIVELOG, restore and recover datafiles'],
['`OPEN`','Datafiles and redo online','Normal operation'],
['`OPEN READ ONLY`','Datafiles read only','Reporting, standby']]},
{h:'Parameter change scope'},
{t:[['I want...','Use'],
['Change now and keep after restart','`ALTER SYSTEM SET p=v SCOPE=BOTH`'],
['Change only after the next restart','`SCOPE=SPFILE`'],
['Change now, forget at restart','`SCOPE=MEMORY`'],
['Change for one session only','`ALTER SESSION SET p=v`'],
['Different value per PDB','Set it in the PDB (if `ISPDB_MODIFIABLE`)']]},
{h:'PDB open modes'},
{t:[['Mode','Meaning'],
['`MOUNTED`','Closed. Not available to users'],
['`READ WRITE`','Normal use'],
['`READ ONLY`','Queries only'],
['`MIGRATE`','Upgrade mode (`OPEN UPGRADE`)'],
['`RESTRICTED`','Only users with `RESTRICTED SESSION`']]},
{h:'Dedicated or shared server?'},
{t:[['Choose dedicated when','Choose shared when'],
['OLTP with few hundreds of sessions, long-running queries, batch, DBA connections','Thousands of mostly idle sessions where memory per session is the limit']]}
]},

/* 9 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, the likely cause and the fix.',see:[[13,0,'A troubleshooting method'],[13,3,'Common ORA errors']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['Cannot connect, ORA-12541','`lsnrctl status`','Listener not running','`lsnrctl start`'],
['ORA-12514 at connect','`lsnrctl services`, `SHOW PARAMETER service_names`','Service not registered','`ALTER SYSTEM REGISTER`, check `local_listener`'],
['ORA-12154','`tnsnames.ora`, `TNS_ADMIN`, `tnsping`','Alias missing or wrong file used','Fix the alias, or use EZConnect'],
['Instance will not start, ORA-00205 / 00210','Alert log, `control_files`','Control file missing or wrong path','Restore from a copy, fix the parameter'],
['Startup stops at MOUNT with ORA-01157 / 01110','Which file is named','Datafile missing or damaged','Restore and recover the file'],
['Everyone hangs at commit','`V$SYSTEM_EVENT`, alert log','Archive destination or FRA full (ORA-00257)','Free or extend space, back up logs'],
['ORA-01555','`V$UNDOSTAT`, long query','Undo overwritten too soon','Raise `undo_retention`, enlarge undo, fix the query'],
['ORA-01652','`V$TEMPSEG_USAGE`','Temp full','Find the SQL, add tempfile'],
['ORA-01653 / 01654','`DBA_FREE_SPACE`','Tablespace out of space','Add datafile or enable autoextend'],
['ORA-00018 / 00020','`V$RESOURCE_LIMIT`','`sessions` or `processes` exhausted','Find leaks, raise `processes`, restart'],
['ORA-04031','`V$SHARED_POOL_ADVICE`, literals','Shared pool fragmentation or too many literals','Bind variables, size pool'],
['ORA-00054','Who holds the lock','DDL while table in use','Retry, use `DDL_LOCK_TIMEOUT`'],
['ORA-01031','Privileges, role enabled by default?','Missing privilege','Grant a role or privilege'],
['Slow right now','`V$SESSION`, ASH, `V$SQL`','Blocker, bad plan, resource shortage','Section on performance; start with waits'],
['PDB shows MOUNTED after restart','`SELECT * FROM dba_pdb_saved_states`','State not saved','`ALTER PLUGGABLE DATABASE ... SAVE STATE`'],
['Account locked','`DBA_USERS.ACCOUNT_STATUS`','Failed logins or profile','`ALTER USER x ACCOUNT UNLOCK`']]}
]},

/* 10 ---------------------------------------------------------------- errors */
{t:'Common error messages',d:'The messages you will see most, with the usual cause and the fix.',see:[[13,3,'Common ORA errors'],[5,5,'Net troubleshooting']],b:[
{t:[['Error','Meaning','Usual cause','Fix'],
['ORA-00600','Internal error','Software defect or corruption','Open a Service Request with the ADR incident package'],
['ORA-07445','Exception in the OS','Software defect','Same as ORA-00600'],
['ORA-00942','Table or view does not exist','Wrong name, schema or privilege','Check owner and grants'],
['ORA-00001','Unique constraint violated','Duplicate key','Fix the data or the constraint'],
['ORA-01017','Invalid username or password','Wrong credentials, case or verifier','Reset password, check client version'],
['ORA-28000','Account is locked','Too many failures','Unlock the account'],
['ORA-28001','Password has expired','Profile `PASSWORD_LIFE_TIME`','Change the password'],
['ORA-01034','Oracle not available','Instance down or wrong SID','Start the instance; check `ORACLE_SID`'],
['ORA-01033','Initialization or shutdown in progress','Instance is starting or stopping','Wait or finish opening'],
['ORA-01109','Database not open','MOUNT or NOMOUNT','`ALTER DATABASE OPEN`'],
['ORA-01113 / 01110','File needs media recovery / names the file','Restored old file','`RECOVER` the file'],
['ORA-00257','Archiver error','Archive destination full','Free space, back up and delete logs'],
['ORA-19809 / 19815','FRA limit exceeded / about to be full','FRA too small or not cleaned','Raise size, back up and delete obsolete'],
['ORA-01653','Cannot extend table','Tablespace full','Add space'],
['ORA-01922 etc.','CASCADE required','Dropping a user that owns objects','`DROP USER x CASCADE`'],
['ORA-65040','Operation not allowed from a PDB','Run in the wrong container','Switch container'],
['ORA-65096','Invalid common user or role name','Missing `C##` prefix','Use the prefix or create locally'],
['ORA-12545','Connect failed, target host not found','Name or listener address wrong','Check host and port'],
['ORA-12170','TNS connect timeout','Network or firewall','Check route and firewall'],
['ORA-03113','End-of-file on communication channel','Server process died or network cut','Alert log and trace of the server process'],
['ORA-00604 / 00604+','Error at recursive SQL level','Often shows another error below','Read the second error in the stack']]},
{note:'Read the whole error stack. The error on top is the last one raised, and the cause is often the line below it.'}
]},

/* 11 ---------------------------------------------------------------- health check */
{t:'Health-check SQL pack',d:'Paste-ready queries for the daily and weekly checks, grouped by what you check.',see:[[13,4,'Monitoring sessions and locks'],[14,5,'Daily, weekly and monthly routines']],b:[
{h:'Instance and database'},
{code:`SELECT instance_name, status, database_status, startup_time FROM v$instance;
SELECT name, open_mode, log_mode, database_role, cdb FROM v$database;
SELECT con_id, name, open_mode, restricted FROM v$pdbs;`},
{h:'Space'},
{code:`-- tablespace usage including autoextend headroom
SELECT tablespace_name, ROUND(used_percent,1) pct_used
FROM dba_tablespace_usage_metrics ORDER BY 2 DESC;

-- FRA use
SELECT name, ROUND(space_used/1024/1024/1024,1) used_gb,
       ROUND(space_limit/1024/1024/1024,1) limit_gb,
       ROUND(space_reclaimable/1024/1024/1024,1) reclaimable_gb
FROM v$recovery_file_dest;`},
{h:'Sessions and locks'},
{code:`SELECT status, COUNT(*) FROM v$session WHERE type = 'USER' GROUP BY status;

SELECT sid, serial#, username, event, blocking_session, seconds_in_wait, sql_id
FROM v$session WHERE blocking_session IS NOT NULL;

SELECT resource_name, current_utilization, max_utilization, limit_value
FROM v$resource_limit WHERE resource_name IN ('processes','sessions','transactions');`},
{h:'Backups and archiving'},
{code:`SELECT MAX(end_time) last_backup, status FROM v$rman_backup_job_details GROUP BY status;
SELECT sequence#, first_time, applied FROM v$archived_log ORDER BY sequence# DESC FETCH FIRST 5 ROWS ONLY;`},
{h:'Invalid objects and failed jobs'},
{code:`SELECT owner, object_type, COUNT(*) FROM dba_objects WHERE status = 'INVALID' GROUP BY owner, object_type;
SELECT job_name, status, actual_start_date, additional_info
FROM dba_scheduler_job_run_details WHERE status <> 'SUCCEEDED' AND log_date > SYSDATE - 1;`},
{h:'Alerts'},
{code:`SELECT creation_time, object_name, reason FROM dba_outstanding_alerts ORDER BY creation_time DESC;`}
]},

/* 12 ---------------------------------------------------------------- naming decoder */
{t:'Naming decoder',d:'How to read the names, numbers and IDs you meet in files, logs and views.',see:[[2,6,'Physical structures'],[3,4,'Post-installation and environment']],b:[
{t:[['Thing','Looks like','Meaning'],
['SID','`ORCL`','Instance name on one host; part of file names and `ORACLE_SID`'],
['`db_name`','`ORCL`','Name of the database, up to 8 characters; stored in the control file'],
['`db_unique_name`','`orcl_site1`','Name that distinguishes databases with the same `db_name` (Data Guard)'],
['Service name','`pdb1.example.com`','What clients connect to; each PDB has a default service'],
['DBID','`1507283716`','Numeric identity of the database; needed for RMAN restore without a repository'],
['SCN','`2317845`','System change number, the database clock'],
['OMF datafile','`+DATA/ORCL/DATAFILE/users.259.1100000001` or `o1_mf_users_k9x2zz4w_.dbf`','Oracle Managed Files name'],
['Archived log','`1_245_1100000001.arc`','Format `%t_%s_%r`: thread, sequence, resetlogs ID'],
['Redo log group','`redo01.log`','Online redo member; groups and members are numbered'],
['Trace file','`ORCL_ora_12345.trc`','Instance, process type and OS PID'],
['Incident','`incdir_4711`','One diagnostic incident in the ADR'],
['ROWID','`AAAWcjAAHAAAAbKAAA`','Object, file, block, row (base-64)'],
['CON_ID','0, 1, 2, 3...','0 = whole CDB, 1 = root, 2 = seed, 3 and up = PDBs'],
['`C##` prefix','`C##ADMIN`','Common user or role created in the root'],
['Wait event','`db file sequential read`','Name of what a session waits for'],
['Sample schema','`HR`, `SH`, `OE`','Oracle sample data, not for production']]},
{code:`-- a ROWID decoded
SELECT rowid, DBMS_ROWID.ROWID_OBJECT(rowid) obj, DBMS_ROWID.ROWID_RELATIVE_FNO(rowid) fno,
       DBMS_ROWID.ROWID_BLOCK_NUMBER(rowid) blk FROM hr.employees WHERE ROWNUM = 1;`}
]},

/* 13 ---------------------------------------------------------------- OS settings */
{t:'OS settings',d:'Kernel parameters, limits and system settings that matter on a Linux database server.',see:[[3,0,'Planning and kernel parameters'],[3,2,'Installing software']],b:[
{t:[['Setting','Typical value','Why'],
['`fs.file-max`','6815744 or higher','Maximum open files system-wide'],
['`fs.aio-max-nr`','1048576','Asynchronous I/O requests'],
['`kernel.shmmax`, `kernel.shmall`','Half of RAM / RAM in pages (or higher)','Shared memory for the SGA'],
['`kernel.sem`','`250 32000 100 128`','Semaphores for processes'],
['`kernel.panic_on_oops`','1','Reboot on kernel errors'],
['`net.ipv4.ip_local_port_range`','`9000 65500`','Ephemeral ports'],
['`net.core.rmem_max`, `wmem_max`','4194304 / 1048576','Network buffers'],
['`vm.swappiness`','1 to 10','Avoid swapping the SGA'],
['`vm.nr_hugepages`','SGA size / 2 MB, plus margin','HugePages for the SGA'],
['Transparent Huge Pages','`never`','Causes latency and memory problems'],
['`oracle` limits: `nofile`, `nproc`, `stack`, `memlock`','`nofile 65536`, `nproc 16384`, `stack 10240`, `memlock` > SGA','Set in `/etc/security/limits.d`'],
['SELinux','`permissive` or `enforcing` with policies','Check install notes of your release'],
['Firewall','Allow 1521 from clients only','Do not leave the listener open to all'],
['Time sync','`chronyd` running','Clusters, auditing and logs need accurate time']]},
{code:`# the preinstall package sets most of the kernel and limit values for you
dnf install -y oracle-database-preinstall-19c

# check HugePages
grep -i huge /proc/meminfo
cat /sys/kernel/mm/transparent_hugepage/enabled`},
{note:'Values above are common starting points. The installation guide of your exact release is authoritative, and the `oracle-database-preinstall` package applies them for supported Oracle Linux and RHEL-compatible systems.'}
]},

/* 14 ---------------------------------------------------------------- versions */
{t:'Releases and support',d:'The releases you will meet and what each one means. Dates change, so always confirm on My Oracle Support.',see:[[0,2,'Releases and support'],[0,3,'Editions and licensing']],b:[
{t:[['Release','Type','Notes'],
['19c (19.x)','Long-Term Release','The most widely used release. Supports both non-CDB and CDB.'],
['21c','Innovation Release','Short support period. Not a long-term target.'],
['23ai','Innovation Release (first AI release)','New features; the long-term successor was 26ai.'],
['26ai (26.x)','Long-Term Release','CDB (multitenant) only. Non-CDB architecture is desupported.']]},
{h:'Terms'},
{t:[['Term','Meaning'],
['Release Update (RU)','Quarterly bundle of fixes (security, bugs, regressions)'],
['One-off patch','A fix for one bug'],
['Premier / Extended / Sustaining Support','Support levels; a release moves through them'],
['COMPATIBLE','The feature level of the database, raised only after upgrade is proven']]},
{note:'Support end dates are in the Lifetime Support Policy and in My Oracle Support Doc ID 742060.1. This page does not repeat them, because they change.'}
]}

]};
