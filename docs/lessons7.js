/* LearnSphere: Section 08 - Tablespaces & Storage (lectures 1-4 + bonus lectures 5-9)
   Load AFTER lessons6.js. Docs links target PostgreSQL 18. Also back-fills notes into earlier lessons. */
(function(){
const D='https://www.postgresql.org/docs/18/';
const dg=window.LS_DG;

/* ---------- diagrams ---------- */
const walFmtSvg=dg(700,290,[
[10,10,210,50,'000000010000000000000003|segment file, 16 MB',2],[245,10,210,50,'000000010000000000000004|segment file, 16 MB',0],[480,10,210,50,'000000010000000000000005|segment file, 16 MB',0],
[10,100,110,60,'Page 0|long header|8 KB',2],[135,100,110,60,'Page 1|short header|8 KB',0],[260,100,110,60,'Page 2|short header|8 KB',0],[385,100,60,60,'...',0],[460,100,110,60,'Page 2047|short header|8 KB',0],
[10,200,135,75,'XLogRecord header|24 bytes: xid,|prev, rmgr, CRC',2],[155,200,125,75,'Block references|ts OID/db/rel,|fork, block no.',0],[290,200,115,75,'Block data or|full-page image|(FPI)',0],[415,200,125,75,'Main data|resource-manager|specific payload',0],[555,200,135,75,'Next record|starts at the next|8-byte boundary',0]],
[[115,60,65,100],[190,160,75,200]]);
const lsnSvg=dg(700,240,[
[10,45,140,60,'LSN|0/3000148',2],[210,10,170,50,'High 32 bits|0x00000000',0],[210,100,170,50,'Low 32 bits|0x03000148',0],
[440,70,240,40,'Segment no = Low / 16 MB = 0x03',2],[440,120,240,40,'Offset = Low mod 16 MB = 0x000148',0],
[10,170,140,50,'Timeline|00000001',0],[210,180,470,45,'File name = 00000001 + 00000000 + 00000003|000000010000000000000003',2]],
[[150,65,210,35],[150,85,210,125],[380,115,440,92],[380,135,440,140],[150,195,210,200]]);
const tsDirSvg=dg(700,235,[
[10,20,150,55,'PGDATA|data directory',0],[200,20,170,55,'pg_tblspc/16400|symbolic link',2],[410,20,280,55,'/pgdata/ts_fast/app|LOCATION (your directory)',2],
[410,100,280,45,'PG_18_<catalog version>|version subdirectory',0],[410,170,135,50,'16384|database OID dir',0],[555,170,135,50,'16401|relfilenode file',0],
[10,110,370,110,'Built-in tablespaces|pg_default: PGDATA/base (OID 1663)|pg_global: PGDATA/global (OID 1664)|user tablespaces: pg_tblspc/OID',0]],
[[160,47,200,47],[370,47,410,47],[550,75,550,100],[477,145,477,170],[545,195,555,195]]);
const moveSvg=dg(700,210,[
[10,70,140,60,'Table orders|files in ts_old',0],[190,70,170,60,'ALTER TABLE SET|TABLESPACE ts_new|ACCESS EXCLUSIVE lock',2],[400,70,140,60,'New files in|ts_new (copied)',0],[580,70,110,60,'Old files|removed at|COMMIT',0],
[190,150,170,40,'Readers and writers wait',0],[400,150,290,40,'Catalog updated:|reltablespace, relfilenode',0]],
[[150,100,190,100],[360,100,400,100],[540,100,580,100],[275,130,275,150],[470,130,470,150]]);
const offSvg=dg(700,250,[
[10,15,320,220,'BEFORE (server stopped)',1],[25,50,290,50,'pg_tblspc/16400|symlink to /ts_old/data',0],[25,125,290,45,'/ts_old/data/PG_18_.../',2],[25,185,290,35,'Files are consistent: clean shutdown',0],
[370,15,320,220,'AFTER (still stopped)',1],[385,50,290,50,'pg_tblspc/16400|same link, new target /ts_new/data',2],[385,125,290,45,'/ts_new/data/PG_18_.../',2],[385,185,290,35,'Old copy kept until verified',0]],
[[170,100,170,125],[530,100,530,125],[330,147,385,147]]);
const pageSvg=dg(700,215,[
[10,10,680,30,'One heap page: 8 KB by default',1],
[10,60,100,85,'Page header|24 bytes|LSN, checksum|lower, upper',2],[120,60,130,85,'Line pointers|4 bytes each|grow rightwards',0],[260,60,170,85,'Free space|pd_lower to pd_upper',0],[440,60,150,85,'Tuples|grow leftwards|from the page end',0],[600,60,90,85,'Special|index pages|only',0],
[10,160,680,45,'Each line pointer gives the offset of one tuple. The 23-byte tuple header holds|xmin, xmax, ctid and flags that MVCC uses. pd_lsn ties the page to the WAL.',0]],
[[250,102,440,102]]);
const holdSvg=dg(700,260,[
[10,10,200,45,'Checkpoint distance|max_wal_size',0],[10,65,200,45,'Archive backlog|failing archive_command',0],[10,120,200,45,'wal_keep_size|extra segments retained',0],[10,175,200,45,'Replication slots|restart_lsn far behind',2],
[290,70,150,110,'pg_wal/|segments cannot be|recycled or removed|while any holder|still needs them',2],
[520,30,170,60,'Directory grows|toward the disk limit',0],[520,150,170,60,'Disk full: PANIC,|server shuts down',0]],
[[210,32,290,100],[210,87,290,115],[210,142,290,135],[210,197,290,155],[440,110,520,62],[440,140,520,178]]);

window.EXTRA_LECTURES=window.EXTRA_LECTURES||{};
window.EXTRA_LECTURES[7]=[
['Storage Layout: Pages, Forks, TOAST and Tablespace Files','0:00','How a table becomes files: relfilenode, forks, 1 GB segments, the 8 KB page layout, TOAST and checksums, and how to map any object to its file.'],
['Using Tablespaces: Defaults, Temporary Files, Privileges and Planning','0:00','default_tablespace, temp_tablespaces, per-tablespace cost settings, the CREATE privilege, hot/warm/cold placement and monitoring tablespace usage.'],
['WAL Lifecycle: Archiving, Retention, Recycling and pg_wal Troubleshooting','0:00','What keeps WAL files on disk, how archiving and slots affect pg_wal, how to diagnose a growing or full pg_wal, and how to relocate it.'],
['Inspecting WAL: pg_waldump, pg_walinspect and pg_controldata','0:00','Read WAL records and cluster control data to see what the server wrote, find large WAL producers and verify checkpoint and timeline state.'],
['Tablespaces in Backup, Replication and Upgrade','0:00','How pg_basebackup, pg_dump, pg_dumpall, standbys and pg_upgrade treat tablespaces, tablespace_map, path mapping and a restore checklist.']];

Object.assign(window.LESSONS,{

/* ---------------------------------------------------------------- 7:0 */
'pg:7:0':{blocks:[
{p:'**Write-Ahead Logging (WAL)** is the standard method PostgreSQL uses to keep data intact. Its central rule, stated in the documentation, is that a change to a data file (a table or index page) may be written to disk only **after** the WAL record describing that change has been flushed to permanent storage. Because the log already holds everything needed to repeat the change, the server does not have to flush every modified data page at commit time; it only flushes the log, which is written **sequentially** and is therefore fast. Section 04 introduced WAL as an architecture component; this lecture opens the files and explains the **format**: how the log is divided into segments, pages and records, how positions (LSNs) and file names are calculated, and which helper files appear next to the segments.'},
{h:'What WAL gives you'},
{t:[['Capability','How WAL provides it','Section where used'],['Crash recovery','After a crash the server replays (redoes) WAL from the last checkpoint, restoring every committed change and ignoring uncommitted ones','04 Architecture'],['Durability (the D in ACID)','`COMMIT` returns only after its WAL is flushed (default `synchronous_commit = on`)','04, 06'],['Point-in-time recovery (PITR)','A base backup plus an archive of WAL segments can be replayed to any chosen moment','09 Backup & Recovery'],['Physical replication','A standby receives the primary WAL stream and replays it (needs `wal_level = replica` or higher)','10 Replication'],['Logical replication and decoding','With `wal_level = logical` extra detail is logged so changes can be decoded into row changes','10 Replication'],['Performance','One sequential flush per commit instead of many random data-page writes; dirty pages are written later by the checkpointer and background writer','06 Parameters']]},
{h:'Where WAL lives: the pg_wal directory'},
{t:[['Item in `pg_wal/`','Meaning'],['Segment files, for example `000000010000000000000003`','The log itself, 16 MB each by default, 24 hexadecimal characters in the name'],['`archive_status/`','Small marker files (`.ready`, `.done`) that tell the archiver which segments still need to be copied away'],['`summaries/`','WAL summary files written by the WAL summarizer when `summarize_wal = on` (used for incremental backups, PostgreSQL 17+)'],['`*.history`','Timeline history files, created when a standby is promoted or recovery ends on a new timeline'],['`*.backup`','Backup history label written at the end of a base backup'],['`*.partial`','Last segment of an old timeline, saved when a standby is promoted']]},
{note:'In a default installation `pg_wal` is a real directory inside `PGDATA`. For performance and safety it is often moved to its own disk and replaced by a symbolic link (shown in the WAL Lifecycle bonus lecture).'},
{h:'The logical structure: segments, pages, records'},
{svg:walFmtSvg},
{p:'The WAL is conceptually one endless byte stream. For storage it is cut into **segment files** of equal size, each segment is cut into **pages**, and the stream is filled with variable-length **records**. A record is the smallest unit that describes a change.'},
{t:[['Level','Default size','How to see or change it','Notes'],['Segment file','16 MB','`SHOW wal_segment_size;` Chosen at `initdb --wal-segsize=N` (power of two from 1 to 1024 MB). `pg_resetwal --wal-segsize` can change it on a stopped cluster','Cannot be changed with `postgresql.conf`; the parameter is read-only'],['WAL page (block)','8 KB','Compile-time option `--with-wal-blocksize`; `pg_controldata` shows `WAL block size`','Unit in which WAL is written to the OS'],['Record','Variable (tens of bytes to several KB, more with full-page images)','`pg_waldump` prints `len (rec/tot)`','May span page and segment boundaries']]},
{p:'A larger segment size means fewer files for archiving and replication to handle on write-heavy systems, but a coarser unit for archiving: with `archive_timeout` unset, a quiet server holds a partly filled 1 GB segment before it is archived. For most installations the 16 MB default is fine.'},
{h:'Page headers'},
{t:[['Header','Where','Important fields'],['Long page header','First page of every segment','`xlp_magic` (format version), `xlp_info` flags, `xlp_tli` (timeline), `xlp_pageaddr` (LSN of the page), `xlp_rem_len` (bytes of a record continued from the previous page), plus the **system identifier**, segment size and block size'],['Short page header','Every other page','The same first fields without the system identifier and sizes']]},
{p:'The system identifier stored in the long header is the same 64-bit number that `pg_controldata` shows as `Database system identifier`. A standby refuses WAL from a server with a different identifier, which prevents mixing logs of unrelated clusters.'},
{h:'Anatomy of a WAL record'},
{t:[['Part','Size','Content'],['`xl_tot_len`','4 bytes','Total record length including header and data'],['`xl_xid`','4 bytes','Transaction ID that made the change'],['`xl_prev`','8 bytes','LSN of the previous record (chains the log and helps detect corruption)'],['`xl_info`','1 byte','Record-type flags, meaning depends on the resource manager'],['`xl_rmid`','1 byte','**Resource manager** that created and will replay the record (Heap, Btree, Transaction, ...)'],['`xl_crc`','4 bytes','CRC-32C checksum of the record; a mismatch stops replay at that point'],['Block references','per block','Which relation (tablespace OID, database OID, relfilenode), fork and block number the record touches'],['Block data / full-page image','variable','Data needed to redo the change on that block, or the whole page'],['Main data','variable','Resource-manager specific payload, for example the new tuple']]},
{p:'The header is 24 bytes (the fields above plus padding). Every record starts on an 8-byte boundary. Because a block reference names the **tablespace OID, database OID and relfilenode**, WAL can be replayed on a standby without any knowledge of table names, which is also why a standby needs matching tablespace directories (see the last lecture of this section).'},
{h:'Resource managers'},
{t:[['Resource manager','Replays changes to'],['`XLOG`','Checkpoints, WAL switches, parameter changes, full-page images'],['`Transaction`','Commit and abort records, two-phase commit'],['`Storage`','Creation and truncation of relation files'],['`Database`, `Tablespace`','`CREATE`/`DROP DATABASE`, `CREATE`/`DROP TABLESPACE`'],['`Heap`, `Heap2`','Table row inserts, updates, deletes, vacuum, freezing'],['`Btree`, `Hash`, `Gin`, `Gist`, `SPGist`, `BRIN`','Index changes by access method'],['`Sequence`, `CLOG`, `MultiXact`, `CommitTs`','Sequences and transaction status data'],['`Standby`','Locks and running-transaction snapshots needed by hot standbys'],['`LogicalMessage`, `ReplicationOrigin`','Logical decoding and replication metadata']]},
{note:'`CREATE TABLESPACE` is itself a WAL record in the `Tablespace` resource manager. It stores the **absolute path**, so a standby replaying it tries to create the same path. That is why tablespace layouts must match on primary and standby.'},
{h:'Full-page images (FPI)'},
{p:'A disk may write only part of an 8 KB page if the machine crashes during the write (a **torn page**). To be able to repair such a page, PostgreSQL writes the **entire page** into WAL the first time the page is modified after a checkpoint (parameter `full_page_writes`, default `on`; unused space inside the page is skipped). Later changes to the same page before the next checkpoint log only the small delta.'},
{t:[['Effect','Consequence for the DBA'],['Right after a checkpoint WAL volume is high, then falls','Very frequent checkpoints inflate WAL because each page is logged in full again'],['`wal_compression` (`off`, `pglz`, `lz4`, `zstd`) compresses FPIs','Trades CPU for less WAL volume, less disk and network use for replicas'],['`pg_waldump --stats` reports `FPI` bytes separately','High FPI share suggests checkpoints are too frequent: raise `max_wal_size` and `checkpoint_timeout`']]},
{h:'LSN: the address of a byte in the WAL'},
{p:'A **Log Sequence Number (LSN)** is a 64-bit unsigned integer, the byte offset in the WAL stream. It is printed as two hexadecimal numbers separated by a slash: the high 32 bits and the low 32 bits. Every data page stores the LSN of the last WAL record that changed it (`pd_lsn`), and the server will not write that page to disk until WAL has been flushed at least up to that LSN. That single rule is the Write-Ahead guarantee.'},
{svg:lsnSvg},
{t:[['Function or operator','Returns'],['`pg_current_wal_lsn()`','Current WAL **write** position'],['`pg_current_wal_insert_lsn()`','Current WAL **insert** position (data placed in WAL buffers)'],['`pg_current_wal_flush_lsn()`','Position flushed to permanent storage'],['`pg_walfile_name(lsn)`','Name of the segment file that holds the LSN'],['`pg_walfile_name_offset(lsn)`','File name and byte offset inside it'],['`pg_split_walfile_name(name)`','Segment number and timeline of a file name (PostgreSQL 16+)'],['`pg_wal_lsn_diff(a, b)`','Number of bytes between two LSNs; the same as `a - b` for `pg_lsn` values'],['`pg_switch_wal()`','Close the current segment and start a new one'],['`pg_last_wal_receive_lsn()`, `pg_last_wal_replay_lsn()`','On a standby: how far WAL has been received and replayed']]},
{h:'How the file name is built'},
{t:[['Characters','Meaning','Example for LSN `0/3000148`'],['1-8','**Timeline ID** (hex)','`00000001`'],['9-16','High 32 bits of the LSN (the "log" number)','`00000000`'],['17-24','Segment number: low 32 bits divided by segment size, within that log','`00000003`']]},
{p:'With 16 MB segments there are 256 segments (`00` to `FF`) per high-32-bit value, so after `...000000FF` the name continues as `000000010000000100000000`. With a different segment size the count per log changes (1 GB segments give only 4 per log), but the 24-character layout stays the same.'},
{t:[['Segment size','Segments per high-32-bit value','Last name before the counter rolls over'],['16 MB','256','`...000000FF`'],['64 MB','64','`...0000003F`'],['256 MB','16','`...0000000F`'],['1 GB','4','`...00000003`']]},
{h:'Timelines'},
{p:'A **timeline** is a branch of WAL history. A new cluster starts on timeline 1. Whenever archive recovery finishes or a standby is promoted, the server starts a **new timeline** (2, 3, ...) so that WAL written after the recovery point can never be confused with WAL of the old branch that continued past it. The new timeline is recorded in a small `.history` file (for example `00000002.history`) that lists where it branched off. Segment names carry the timeline in their first eight characters, so `000000020000000000000007` is different from `000000010000000000000007`.'},
{h:'Hands-on: watch the WAL move'},
{code:`SHOW wal_segment_size;
SHOW wal_level;

-- three positions of the same stream
SELECT pg_current_wal_lsn()       AS write_lsn,
       pg_current_wal_insert_lsn() AS insert_lsn,
       pg_current_wal_flush_lsn()  AS flush_lsn;

-- which file, and where inside it
SELECT * FROM pg_walfile_name_offset(pg_current_wal_lsn());

-- measure the WAL produced by one statement
SELECT pg_current_wal_lsn() AS before \\gset
CREATE TABLE wal_demo AS SELECT g AS id, md5(g::text) AS txt FROM generate_series(1, 200000) g;
SELECT pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), :'before')) AS wal_generated;

-- WAL files on disk
SELECT name, pg_size_pretty(size) AS size, modification
FROM pg_ls_waldir() ORDER BY name DESC LIMIT 5;

-- cumulative WAL statistics (records, full-page images, bytes)
SELECT wal_records, wal_fpi, pg_size_pretty(wal_bytes) AS wal_bytes, wal_buffers_full FROM pg_stat_wal;

SELECT pg_switch_wal();      -- force a new segment (for example before a test archive)
DROP TABLE wal_demo;`},
{code:`# the same from the operating system (as the postgres user)
ls -l $PGDATA/pg_wal
# -rw------- 1 postgres postgres 16777216 Oct  8 10:12 000000010000000000000003
# drwx------ 2 postgres postgres     4096 Oct  8 10:10 archive_status

pg_controldata $PGDATA | egrep "WAL block size|Bytes per WAL segment|TimeLineID|REDO"`},
{note:'On PostgreSQL 18 the counters for WAL write and sync calls and times are reported in `pg_stat_io` (rows with object `wal`); `pg_stat_wal` keeps the record, FPI, byte and buffer-full counters.'},
{h:'Operational rules'},
{ul:['**Never delete or edit files in `pg_wal` by hand.** The server decides which segments are still needed (checkpoint, archiver, standbys, slots). Removing a needed file can make crash recovery impossible.','Segment files are created with mode `0600` and owned by the OS user that runs PostgreSQL.','If the disk holding `pg_wal` becomes full the server cannot write new WAL: it raises a **PANIC** and shuts down. Size and monitor this disk first (see WAL Lifecycle).','New segments are zero-filled by default (`wal_init_zero`) and old ones are renamed and reused (`wal_recycle`), which avoids file-creation cost on busy systems.','`pg_resetwal` can discard WAL to start a damaged cluster, but it may leave inconsistent data. Treat it as a last resort after a backup of the data directory.']}],
src:[['Write-Ahead Logging (WAL)',D+'wal.html'],['WAL Internals',D+'wal-internals.html'],['Reliability',D+'wal-reliability.html'],['WAL Configuration',D+'wal-configuration.html'],['pg_waldump',D+'pgwaldump.html'],['System administration functions (WAL)',D+'functions-admin.html'],['pg_resetwal',D+'app-pgresetwal.html']]},

/* ---------------------------------------------------------------- 7:1 */
'pg:7:1':{blocks:[
{p:'A **tablespace** is a named location in the file system where PostgreSQL stores the files of database objects. The documentation describes tablespaces as a way for the administrator to define where those files live: once a tablespace exists, you refer to it **by name** when you create a table, index or database, and you never repeat the physical path in SQL. Tablespaces separate the **logical** name used by applications from the **physical** directory chosen by the DBA, so storage can be reorganised without changing application code.'},
{h:'Why use tablespaces'},
{t:[['Reason','Example','Remarks'],['Disk is running out of space','The partition holding `PGDATA` is full; create a tablespace on a new disk and move large tables there','Cheaper than rebuilding the cluster'],['Match data to hardware','Hot indexes on NVMe or SSD, rarely used history on large slow disks','Combine with per-tablespace planner costs (see Using Tablespaces)'],['Isolate I/O','Put one busy database or its indexes on a separate volume so it does not compete with others','Also consider `temp_tablespaces` and a separate disk for `pg_wal`'],['Administrative grouping','Per-application or per-tier storage with its own size monitoring','`pg_tablespace_size()` reports usage'],['Different file-system features','A tablespace on a compressed or snapshot-capable volume','Backups still must capture all tablespaces']]},
{note:'Tablespaces are a placement tool, not a security or sharding feature. They do not partition data across servers, they have no quota, and they must be included in every physical backup. If one large volume (LVM, RAID, cloud disk) is enough, you may not need any.'},
{h:'The two built-in tablespaces'},
{t:[['Tablespace','OID','Physical location','Used for'],['`pg_default`','1663','`PGDATA/base/`','Default tablespace of `template1` and `template0`, so every database created from them uses it unless told otherwise'],['`pg_global`','1664','`PGDATA/global/`','Shared system catalogs such as `pg_database` and `pg_authid`']]},
{p:'Neither can be dropped. Every object in a database lives in **one** tablespace: either the tablespace named when it was created, or the default tablespace of the database. A single tablespace may hold objects from **many databases**, and a database may spread its objects over many tablespaces.'},
{h:'How a tablespace is built on disk'},
{svg:tsDirSvg},
{t:[['Path element','Created by','Meaning'],['`LOCATION` directory','You, before the command','Must exist, be empty and be owned by the PostgreSQL operating-system user'],['`PGDATA/pg_tblspc/<OID>`','`CREATE TABLESPACE`','A **symbolic link** whose name is the tablespace OID and whose target is the `LOCATION`'],['`PG_18_<catalog version>`','`CREATE TABLESPACE`','Version subdirectory inside the location. It identifies the server major version and catalog version, so data of different major versions never clash'],['`<database OID>/`','First object created for that database in the tablespace','Each database gets its own subdirectory'],['`<relfilenode>[.N]` and forks','Object creation','The files of tables and indexes (see the Storage Layout bonus lecture)']]},
{p:'Since PostgreSQL 9.2 the path is **not stored in a catalog column**. It is read from the symbolic link by `pg_tablespace_location(oid)`. This is why a tablespace can be relocated offline by moving the directory and re-pointing the link (next lectures). On Windows the link is a directory junction.'},
{h:'Prerequisites checklist'},
{t:[['Requirement','Why','How to check or set'],['Superuser to create','Creating a tablespace creates a file-system link; PostgreSQL restricts it to superusers','Connect as `postgres`'],['Directory exists and is **empty**','`CREATE TABLESPACE` does not create the directory itself','`mkdir`, `ls -A`'],['Owned by the PostgreSQL OS user, mode `0700`','The server must read and write it and refuses a directory others can access','`chown postgres:postgres`, `chmod 700`'],['Absolute path, no single quote in it','Relative paths are rejected','`/pgdata/ts_fast/app`'],['**Outside** `PGDATA`','A location inside the data directory triggers a warning and confuses backups and `pg_upgrade`','Use a different mount point'],['Use a **subdirectory** of a mount point, not the mount point','A mount point contains `lost+found` and has permissions of the file system root','`/pgdata/ts_fast/app` rather than `/pgdata/ts_fast`'],['Enough free space and the right mount options','Data and WAL for moves are written here','`df -h`, `mount`'],['SELinux context (RHEL family)','A wrong label makes the server fail with permission denied even though Unix permissions are right','`semanage fcontext`, `restorecon`']]},
{h:'Procedure to create a tablespace'},
{flow:['Prepare the disk and directory','Set owner, mode and SELinux label','CREATE TABLESPACE (as superuser)','GRANT CREATE to the roles that need it','Create or move objects into it','Verify location, size and objects']},
{code:`# 1. directory on the new volume (as root)
sudo mkdir -p /pgdata/ts_fast/app
sudo chown postgres:postgres /pgdata/ts_fast/app
sudo chmod 700 /pgdata/ts_fast/app

# 2. SELinux label for PostgreSQL data (RHEL family)
sudo semanage fcontext -a -t postgresql_db_t "/pgdata/ts_fast(/.*)?"
sudo restorecon -Rv /pgdata/ts_fast`},
{code:`-- 3. create (superuser)
CREATE TABLESPACE ts_fast LOCATION '/pgdata/ts_fast/app';

-- with planner cost hints for fast storage and a different owner
CREATE TABLESPACE ts_ssd OWNER app_owner LOCATION '/pgdata/ts_ssd/app'
  WITH (random_page_cost = 1.1, effective_io_concurrency = 200);

-- 4. allow a role to create objects there
GRANT CREATE ON TABLESPACE ts_fast TO app_rw;`},
{h:'CREATE TABLESPACE syntax'},
{t:[['Clause','Meaning'],['`name`','Tablespace name; cannot start with `pg_` (reserved)'],['`OWNER new_owner`','Role that owns it; default is the creating superuser'],['`LOCATION \'directory\'`','Absolute path of the prepared directory'],['`WITH (option = value, ...)`','`seq_page_cost`, `random_page_cost`, `effective_io_concurrency`, `maintenance_io_concurrency`: override the global planner and I/O settings for objects in this tablespace']]},
{note:'`CREATE TABLESPACE` and `DROP TABLESPACE` cannot run inside a transaction block.'},
{h:'Placing objects in a tablespace'},
{t:[['Way','Syntax','Scope'],['Explicit clause','`CREATE TABLE t (...) TABLESPACE ts_fast;` `CREATE INDEX i ON t(c) TABLESPACE ts_fast;`','That object only (TOAST data follows its table)'],['Session default','`SET default_tablespace = ts_fast;`','Tables and indexes created later in the session without a clause'],['Role or database default','`ALTER ROLE app_rw SET default_tablespace = ts_fast;`','New sessions of that role'],['Database default','`CREATE DATABASE sales TABLESPACE ts_fast;`','All objects of `sales` without an explicit clause, including its system catalogs'],['Partitioned table','`CREATE TABLE ... PARTITION OF p ... TABLESPACE ts_hot;`','Each partition may use its own tablespace']]},
{flow:['TABLESPACE clause given?','Else default_tablespace set and not empty?','Else database default (pg_database.dattablespace)','Which is normally pg_default']},
{h:'Verify'},
{code:`-- psql meta-commands
\\db                 -- tablespaces and locations
\\db+                -- plus owner privileges, options, size

-- catalog and functions
SELECT oid, spcname, pg_get_userbyid(spcowner) AS owner,
       pg_tablespace_location(oid) AS location, spcoptions
FROM pg_tablespace;

SELECT pg_size_pretty(pg_tablespace_size('ts_fast'));

-- create something and see where it went
CREATE TABLE t_fast (id int, note text) TABLESPACE ts_fast;
INSERT INTO t_fast SELECT g, 'row' || g FROM generate_series(1, 100000) g;
SELECT pg_relation_filepath('t_fast');
-- pg_tblspc/16400/PG_18_<catversion>/16384/16401

SELECT tablename, tablespace FROM pg_tables WHERE tablename = 't_fast';  -- NULL means the database default`},
{code:`# on the operating system
ls -l $PGDATA/pg_tblspc
# lrwxrwxrwx 1 postgres postgres 19 Oct  8 10:30 16400 -> /pgdata/ts_fast/app
ls /pgdata/ts_fast/app            # PG_18_<catalog version>
du -sh /pgdata/ts_fast/app`},
{h:'Changing a tablespace'},
{code:`ALTER TABLESPACE ts_fast RENAME TO ts_hot;
ALTER TABLESPACE ts_hot OWNER TO dba_admin;
ALTER TABLESPACE ts_hot SET (random_page_cost = 1.1, seq_page_cost = 1.0);
ALTER TABLESPACE ts_hot RESET (random_page_cost);`},
{p:'`ALTER TABLESPACE` can rename it, change its owner and set options, but it **cannot change the location**. Relocation is done by moving objects (online) or by moving the directory (offline), covered in the next two lectures.'},
{h:'Dropping a tablespace'},
{p:'`DROP TABLESPACE` removes the tablespace from the system, but only when it is **empty**. "Empty" means that **no database** in the cluster has any object in it, and that no database uses it as its default. Only the owner or a superuser can drop it. The command removes the symbolic link and the `PG_18_...` subdirectory; the `LOCATION` directory you created is left in place for you to remove with operating-system tools.'},
{flow:['Find which databases use it','In each database list the objects','Move or drop the objects (and move default of databases)','Verify it is empty','DROP TABLESPACE','Remove the empty directory and update documentation']},
{code:`-- 1. which databases have anything in it? (includes databases whose default it is)
SELECT d.datname
FROM pg_database d
WHERE d.oid IN (SELECT pg_tablespace_databases(oid) FROM pg_tablespace WHERE spcname = 'ts_hot');

-- databases using it as their default tablespace
SELECT datname FROM pg_database
WHERE dattablespace = (SELECT oid FROM pg_tablespace WHERE spcname = 'ts_hot');

-- 2. inside EACH such database: objects stored there (connect with \\c first)
SELECT n.nspname, c.relname, c.relkind
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.reltablespace = (SELECT oid FROM pg_tablespace WHERE spcname = 'ts_hot')
ORDER BY 1, 2;

-- 3. move or drop them (examples)
ALTER TABLE t_fast SET TABLESPACE pg_default;
ALTER DATABASE sales SET TABLESPACE pg_default;     -- needs no other connections

-- 4. drop
DROP TABLESPACE ts_hot;`},
{note:'Objects that live in the **default** tablespace of their database have `reltablespace = 0`, so a query on `pg_class.reltablespace` does not show them. That is why you also check `pg_database.dattablespace` and `pg_tablespace_databases()` before dropping.'},
{h:'Common errors'},
{t:[['Message (abridged)','Cause','Fix'],['`permission denied to create tablespace`','Not a superuser','Run as superuser'],['`directory ... does not exist`','`LOCATION` was not created first','`mkdir`, then retry'],['`could not set permissions on directory` / `Permission denied`','Directory not owned by the PostgreSQL OS user, or SELinux label wrong','`chown`, `chmod 700`, `restorecon`'],['`directory ... is not empty` / `tablespace location must be empty`','Directory still holds files (for example `lost+found`)','Use a clean subdirectory'],['`tablespace location must be an absolute path`','Relative path used','Give the full path'],['`tablespace location should not be inside the data directory`','Warning: location is under `PGDATA`','Choose a path outside `PGDATA`'],['`tablespace "x" is not empty`','Objects or database defaults still reference it','Follow the drop procedure above'],['`... cannot run inside a transaction block`','Command issued after `BEGIN`','Run it in autocommit mode']]},
{note:'Tablespace creation and removal are WAL-logged, so a streaming standby repeats them. Make sure the same directory path exists and is writable on every standby before you run `CREATE TABLESPACE` on the primary.'}],
src:[['Tablespaces',D+'manage-ag-tablespaces.html'],['CREATE TABLESPACE',D+'sql-createtablespace.html'],['DROP TABLESPACE',D+'sql-droptablespace.html'],['ALTER TABLESPACE',D+'sql-altertablespace.html'],['pg_tablespace catalog',D+'catalog-pg-tablespace.html'],['Database physical storage',D+'storage.html']]},

/* ---------------------------------------------------------------- 7:2 */
'pg:7:2':{blocks:[
{p:'**Online moving** means relocating tables, indexes or materialized views to another tablespace while the PostgreSQL server keeps running: no shutdown and no restart. The word "online" refers to the **instance**, not to the object. The standard command `ALTER TABLE ... SET TABLESPACE` copies the relation files and holds an **ACCESS EXCLUSIVE** lock on the table for the whole copy, so sessions that need that table wait. The art of an online move is to keep each locked window short, to schedule it, and to use the lighter alternatives (`REINDEX ... CONCURRENTLY`, `pg_repack`) where available.'},
{h:'Commands for moving objects'},
{t:[['What you move','Command','Lock held','Notes'],['One table','`ALTER TABLE t SET TABLESPACE ts_new;`','ACCESS EXCLUSIVE on the table','Moves the heap and its **TOAST** table. **Indexes stay behind**'],['One index','`ALTER INDEX i SET TABLESPACE ts_new;`','ACCESS EXCLUSIVE on the index','Index is unusable while it moves'],['Index, rebuilt in the new place','`REINDEX (TABLESPACE ts_new) INDEX CONCURRENTLY i;`','SHARE UPDATE EXCLUSIVE (reads and writes continue)','PostgreSQL 14+. Needs space for the old and the new index at once'],['All indexes of a table','`REINDEX (TABLESPACE ts_new) TABLE CONCURRENTLY t;`','SHARE UPDATE EXCLUSIVE','Moves every index of the table'],['Materialized view','`ALTER MATERIALIZED VIEW mv SET TABLESPACE ts_new;`','ACCESS EXCLUSIVE','Its indexes move separately'],['All tables in a tablespace','`ALTER TABLE ALL IN TABLESPACE ts_old SET TABLESPACE ts_new [OWNED BY role] [NOWAIT];`','ACCESS EXCLUSIVE, table by table','Current database only; **system catalogs are not moved**; `NOWAIT` fails at once if a lock is unavailable'],['All indexes / materialized views in a tablespace','`ALTER INDEX ALL IN TABLESPACE ...`, `ALTER MATERIALIZED VIEW ALL IN TABLESPACE ...`','as above','Same options'],['A partitioned table','`ALTER TABLE p SET TABLESPACE ts_new;`','Brief','Moves **no data**; only sets the tablespace for partitions created later. Move each existing partition separately'],['Database default tablespace','`ALTER DATABASE db SET TABLESPACE ts_new;`','Database must have **no other connections**','Moves everything stored in the old default tablespace; effectively offline for that database']]},
{note:'`VACUUM FULL` and `CLUSTER` rewrite a table but keep it in its current tablespace. Only the commands above change the tablespace.'},
{h:'What happens inside an online move'},
{svg:moveSvg},
{ul:['PostgreSQL takes an **ACCESS EXCLUSIVE** lock, so no query can read or write the table.','It creates a **new file** (a new relfilenode) in the target tablespace and copies the data block by block.','When `wal_level` is `replica` or `logical` the copy is **written to WAL**, so the move produces WAL about the size of the table and a streaming standby copies it too.','It updates `pg_class` (`reltablespace`, `relfilenode`) and commits. Only at commit are the **old files deleted**.','If the session or server fails midway, the transaction rolls back and the half-built new file is removed; the table remains intact in the old place.']},
{h:'Impact of an online move'},
{t:[['Aspect','Effect','What to do'],['Locking','All access to the table blocks for the whole copy','Move small objects first, off-peak; set `lock_timeout`'],['Disk space','Destination needs **table size** free; the source frees space only at commit','Check `pg_relation_size` against `df`'],['WAL and replication','WAL volume about equal to the data moved; replicas must apply it and need the **same tablespace** path','Watch `pg_wal` size and replica lag; raise `max_wal_size` temporarily if needed'],['I/O','Sequential read of the source and write of the target','Run when I/O is quiet'],['Statistics and plans','Row statistics are preserved; the table gets a new file','Usually no `ANALYZE` needed'],['Indexes','Not moved with the table','Move them as well, preferably with `REINDEX ... CONCURRENTLY`'],['Triggers, constraints, privileges, ownership','Unchanged','None']]},
{h:'Procedure'},
{flow:['Inventory objects and sizes','Check free space in the target and WAL headroom','Pick the window; announce it','SET lock_timeout and move small objects first','Move indexes (REINDEX CONCURRENTLY)','Verify and monitor','Optionally drop the old tablespace']},
{code:`-- 1. what is in the old tablespace (run in each database), largest first
SELECT n.nspname, c.relname, c.relkind,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.reltablespace = (SELECT oid FROM pg_tablespace WHERE spcname = 'ts_old')
  AND c.relkind IN ('r', 'm', 'i')
ORDER BY pg_relation_size(c.oid) DESC;

-- 2. headroom
SELECT pg_size_pretty(pg_tablespace_size('ts_old')) AS source_size;
-- and on the OS:  df -h /pgdata/ts_new  /var/lib/pgsql/18/data/pg_wal`},
{code:`-- 3. move one table safely: give up quickly instead of queueing behind long transactions
SET lock_timeout = '5s';
ALTER TABLE public.orders SET TABLESPACE ts_new;

-- 4. move its indexes without blocking readers and writers
REINDEX (TABLESPACE ts_new) TABLE CONCURRENTLY public.orders;

-- 5. new default for the objects you create from now on
ALTER ROLE app_rw SET default_tablespace = ts_new;`},
{code:`-- generate the statements for every ordinary table and run them with psql \\gexec
SELECT format('ALTER TABLE %I.%I SET TABLESPACE ts_new;', n.nspname, c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'm')
  AND c.reltablespace = (SELECT oid FROM pg_tablespace WHERE spcname = 'ts_old')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_relation_size(c.oid)
\\gexec`},
{note:'Materialized views have `relkind = \'m\'` and need `ALTER MATERIALIZED VIEW`, not `ALTER TABLE`. Adjust the generated command for them, or run a second pass.'},
{h:'Monitoring a move in progress'},
{code:`-- who waits for whom
SELECT pid, state, wait_event_type, wait_event, now() - query_start AS running,
       pg_blocking_pids(pid) AS blocked_by, left(query, 60) AS query
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid()
ORDER BY query_start;

-- how big is the target so far
SELECT pg_size_pretty(pg_tablespace_size('ts_new'));

-- confirm after the move
SELECT pg_relation_filepath('public.orders');          -- now under pg_tblspc/<new OID>/...
SELECT tablename, tablespace FROM pg_tables WHERE tablename = 'orders';`},
{h:'Moving the default tablespace of a database'},
{code:`-- connect to another database (for example postgres), not to the one being moved
ALTER DATABASE sales SET TABLESPACE ts_new;`},
{ul:['You must own the database and have `CREATE` on the new tablespace.','No other session may be connected to `sales`; terminate them first (see Kill Sessions).','Objects stored in tablespaces other than the old default are not touched.','The command copies the database files and cannot run inside a transaction block.']},
{h:'Choosing a method for minimum downtime'},
{t:[['Method','Downtime for the table','Source','Notes'],['`ALTER TABLE ... SET TABLESPACE`','Full copy time (no reads or writes)','PostgreSQL core','Simplest. Fine for small and medium tables or a maintenance window'],['`REINDEX (TABLESPACE ...) CONCURRENTLY`','None (indexes only)','PostgreSQL core (14+)','Best way to move indexes online'],['`pg_repack` with the tablespace option','Short exclusive locks at start and end','Third-party extension, not part of PostgreSQL','Needs a primary key or unique index on the table and roughly the table size in extra space; install and test it first'],['Logical replication to a new table or cluster','Seconds at cut-over','PostgreSQL core','Most work; use for very large tables'],['Offline directory move','Whole instance stopped','Operating system','Next lecture: best for moving an entire tablespace']]},
{h:'Pitfalls'},
{ul:['**Forgetting indexes.** After `ALTER TABLE SET TABLESPACE` the indexes still occupy the old tablespace, so it cannot be dropped yet.','**Queueing behind a long transaction.** The `ACCESS EXCLUSIVE` request waits for older transactions, and new queries then queue behind your request. Use `lock_timeout` and retry.','**Filling the target.** If the target fills during the copy, the statement fails and rolls back; the old copy is still intact.','**Replica without the path.** The standby must have the target directory; otherwise WAL replay stops on the standby.','**Counting space too early.** Free space on the source appears only after commit, and after a checkpoint for dropped files.']},
{note:'Rollback is simply the reverse command: `ALTER TABLE t SET TABLESPACE ts_old;`. Keep the old tablespace until the application has run for a full business cycle.'}],
src:[['ALTER TABLE',D+'sql-altertable.html'],['ALTER INDEX',D+'sql-alterindex.html'],['REINDEX',D+'sql-reindex.html'],['ALTER DATABASE',D+'sql-alterdatabase.html'],['Explicit Locking',D+'explicit-locking.html'],['pg_tablespace_size and related functions',D+'functions-admin.html']]},

/* ---------------------------------------------------------------- 7:3 */
'pg:7:3':{blocks:[
{p:'**Offline moving** relocates an entire tablespace directory while the PostgreSQL instance is **stopped**. Because the location of a tablespace is stored only as a **symbolic link** in `PGDATA/pg_tblspc/`, you can move the directory to another disk or path and then **re-point the link**; no SQL and no catalog change is needed. This is the method to use when a disk is full or must be replaced, when thousands of objects must move together, or when the long locks and large WAL volume of an online move are not acceptable. The price is **downtime** for the whole instance.'},
{h:'How PostgreSQL finds a tablespace'},
{svg:offSvg},
{ul:['`pg_tablespace` stores the name, owner, ACL and options. It stores **no path**.','The path is the target of the symbolic link `PGDATA/pg_tblspc/<tablespace OID>`; `pg_tablespace_location(oid)` reads it.','Every relation path (`pg_relation_filepath`) is resolved through that link, so changing the target relocates every object in the tablespace at once.','The directory content must be **byte-for-byte identical** and consistent, which is guaranteed only after a clean shutdown.']},
{note:'This is an operational procedure, not an SQL feature: `ALTER TABLESPACE` has no option to change the location. Always take a verified backup first and rehearse the steps on a test copy.'},
{h:'Online or offline? Choosing the method'},
{t:[['Question','Online move (previous lecture)','Offline move (this lecture)'],['Instance availability','Stays up; each table is locked while it moves','**Down** for the whole operation'],['Granularity','Object by object','The whole tablespace directory'],['Typical use','Rebalance a few large objects, tiering, cleanup','Replace or enlarge a disk, change a mount path, emergency when the disk is full'],['WAL generated','About the size of the data moved','None'],['Risk','Low, rolls back on failure','Human error with files; needs a good backup'],['Replicas','Replay the moves automatically','Must be repeated by hand on every standby, or rebuilt'],['Speed','Depends on object sizes and locks','Speed of the file copy']]},
{h:'Pre-flight checklist'},
{t:[['Check','Command or action'],['Which tablespace and OID','`SELECT oid, spcname, pg_tablespace_location(oid) FROM pg_tablespace;`'],['Size to move','`SELECT pg_size_pretty(pg_tablespace_size(\'ts_data\'));`'],['Free space on the new disk','`df -h /ts_new` (at least the tablespace size plus margin)'],['Verified backup exists','`pg_basebackup` or a storage snapshot taken and tested; plus `pg_dumpall --globals-only`'],['Standbys and archive','Know which standbys use the same path; pause or plan to repeat the move there'],['New directory prepared','Owned by the PostgreSQL OS user, mode `0700`, SELinux label set, mounted at boot (`/etc/fstab`)'],['Applications told','Maintenance window announced; connections will be refused'],['Rollback plan','Old directory is kept untouched until the new one is verified']]},
{h:'Procedure'},
{flow:['Record the OID and current location','Back up','Clean shutdown','Confirm the cluster state is shut down','Copy the directory (rsync) and verify','Re-point the symbolic link','Set owner, mode and SELinux label','Start and verify','Remove the old copy after a retention period']},
{code:`-- 1. while the server is still running: note what you have
SELECT oid, spcname, pg_tablespace_location(oid) AS location
FROM pg_tablespace WHERE spcname = 'ts_data';
--   oid  | spcname |  location
-- -------+---------+-------------
--  16400 | ts_data | /ts_old/data`},
{code:`# 2. stop PostgreSQL cleanly (fast mode checkpoints and disconnects clients)
sudo systemctl stop postgresql-18
#    or: sudo -u postgres /usr/pgsql-18/bin/pg_ctl -D /var/lib/pgsql/18/data stop -m fast

# 3. confirm the shutdown was clean
sudo -u postgres /usr/pgsql-18/bin/pg_controldata /var/lib/pgsql/18/data | grep "cluster state"
#    Database cluster state:               shut down

# 4. copy to the new location, keeping owner, mode, hard links, ACLs and xattrs
sudo mkdir -p /ts_new/data
sudo chown postgres:postgres /ts_new/data && sudo chmod 700 /ts_new/data
sudo rsync -aHAX /ts_old/data/ /ts_new/data/

# 5. verify: a dry run with checksums must list no differences
sudo rsync -aHAXcn --delete --itemize-changes /ts_old/data/ /ts_new/data/

# 6. re-point the link (-n: treat the existing link as a file, -f: replace it)
cd /var/lib/pgsql/18/data/pg_tblspc
ls -l 16400                                   # -> /ts_old/data
sudo -u postgres ln -sfn /ts_new/data 16400
ls -l 16400                                   # -> /ts_new/data

# 7. SELinux label on the new location (RHEL family)
sudo semanage fcontext -a -t postgresql_db_t "/ts_new(/.*)?"
sudo restorecon -Rv /ts_new

# 8. start and verify
sudo systemctl start postgresql-18
sudo -u postgres psql -c "SELECT spcname, pg_tablespace_location(oid) FROM pg_tablespace WHERE spcname = 'ts_data';"
sudo -u postgres psql -c "SELECT count(*) FROM app.orders;"      -- a table in that tablespace`},
{code:`# 9. keep the old data for a retention period, but make it impossible to use by accident
sudo mv /ts_old/data /ts_old/data.moved_20261008
# after the application has run cleanly for days and a new backup is verified:
sudo rm -rf /ts_old/data.moved_20261008`},
{note:'If both locations are on the **same file system**, `mv` is an instant rename and needs no copy. Across file systems `mv` is copy-then-delete and cannot be resumed after an interruption, so prefer `rsync`, which can be re-run, and delete the source only after verification.'},
{h:'Copy tools compared'},
{t:[['Tool','Strength','Weakness'],['`mv` on the same file system','Atomic and instant','Not possible across disks'],['`mv` across file systems','Simple','Copy then delete; not resumable; no verification'],['`rsync -aHAX`','Resumable, preserves attributes, verifiable with `-c -n`','Slower than a rename'],['`cp -a`','Always available','No resume or verification'],['Storage snapshot / volume swap','Very fast for large data','Needs storage tooling and a clean, consistent snapshot']]},
{h:'If something goes wrong'},
{t:[['Symptom after start','Likely cause','Remedy'],['`could not open file "pg_tblspc/16400/PG_18_.../..." : No such file or directory`','Link points to the wrong place or the copy is incomplete','Stop, fix the link or re-run `rsync`, start again'],['`Permission denied` for the tablespace files','Owner, mode, or SELinux label wrong on the new path','`chown -R postgres:postgres`, `chmod 700`, `restorecon -Rv`'],['`PANIC` or errors about missing WAL-logged files after crash recovery','Server was not shut down cleanly before the copy','Restore the old copy and link, start once, shut down cleanly, repeat'],['Server starts but queries on moved tables fail','Link points to a **different** tablespace OID','Check `ls -l pg_tblspc` against `SELECT oid, spcname FROM pg_tablespace`'],['Disk of the new path is not mounted at boot','Missing `/etc/fstab` entry','Fix the mount, then restart']]},
{p:'Because the old directory is untouched until you delete it, rollback is simply: stop the server, set the link back (`ln -sfn /ts_old/data 16400`) and start.'},
{h:'Standbys, backups and the Windows variant'},
{ul:['**Standby servers** keep their own `pg_tblspc` links. Moving the primary does not change them. If you also want the new layout there, repeat the procedure on each standby while it is stopped, or rebuild it with `pg_basebackup -T old=new`.','**Backups** taken before the move still contain the old paths. Take a new base backup after the move and keep the `tablespace_map` information with it (see the last lecture).','**Windows** uses junction points: stop the service, copy the directory, then delete and recreate the junction with `mklink /J "C:\\Program Files\\PostgreSQL\\18\\data\\pg_tblspc\\16400" "E:\\ts_new\\data"`.']},
{h:'Offline move versus creating a new tablespace'},
{p:'When the aim is only to **reclaim space on a full disk**, an alternative is to create a new tablespace on another disk and move objects with the online commands (previous lecture), then drop the old tablespace. That is online but slow for large data. The offline move shown here is the fastest way to relocate a **whole** tablespace and is the usual choice when the instance is already stopped, for example after the disk filled up and the server shut itself down.'},
{note:'Free-space rule of thumb: after the move, the old directory still holds the data until you delete it. Do not delete it before the new one has been verified and backed up.'}],
src:[['Tablespaces',D+'manage-ag-tablespaces.html'],['pg_tablespace_location and size functions',D+'functions-admin.html'],['pg_controldata',D+'app-pgcontroldata.html'],['pg_ctl: shutdown modes',D+'app-pg-ctl.html'],['pg_basebackup',D+'app-pgbasebackup.html']]},

/* ---------------------------------------------------------------- 7:4 (bonus) */
'pg:7:4':{blocks:[
{p:'The earlier lectures treat a tablespace as a directory. To plan storage, diagnose bloat or understand WAL records you also need to know **what is inside** those directories: which files a table becomes, how a data page is organised, and where large values go. This lecture follows one table from its SQL name down to bytes on disk, using the documentation chapter "Database Physical Storage".'},
{h:'From object to file'},
{t:[['Step','Catalog or function','Example'],['Object name to OID','`pg_class.oid`','`\'orders\'::regclass`'],['OID to **relfilenode** (file name)','`pg_class.relfilenode`, `pg_relation_filenode(rel)`','16401'],['Tablespace','`pg_class.reltablespace` (0 = database default)','16400 or 0'],['Database','`pg_database.oid`','16384'],['Full relative path','`pg_relation_filepath(rel)`','`pg_tblspc/16400/PG_18_.../16384/16401`'],['File back to object','`pg_filenode_relation(tablespace_oid, filenode)`','`orders`']]},
{ul:['**OID** is permanent; **relfilenode** changes whenever the table is rewritten (`TRUNCATE`, `VACUUM FULL`, `CLUSTER`, `REINDEX`, `ALTER TABLE ... SET TABLESPACE`).','Some system catalogs are **mapped**: their `relfilenode` column is 0 and the real number is in a `pg_filenode.map` file. Use `pg_relation_filenode()`, which handles both.','Files are named by number only. Use `oid2name` (contrib) or the functions above to translate them to names.']},
{h:'Forks and segments'},
{t:[['File','Fork','Content','Created for'],['`16401`','main','The data pages (rows or index entries)','Every table and index'],['`16401_fsm`','free space map','How much free space each page has, so inserts find room fast','Tables and most indexes'],['`16401_vm`','visibility map','Two bits per page: all-visible and all-frozen; enables index-only scans and speeds vacuum','Tables'],['`16401_init`','initialization','An empty copy of the relation used to reset it after a crash','**Unlogged** tables and their indexes only'],['`16401.1`, `16401.2`, ...','main (segments)','Next 1 GB pieces of a relation that exceeds 1 GB','Large relations']]},
{p:'A relation is split into **1 GB segment files** (a compile-time default) so that file systems with size limits and backup tools handle it easily. All forks and segments of one relation are stored in the **same tablespace**.'},
{h:'The 8 KB page'},
{svg:pageSvg},
{t:[['Part','Size','Purpose'],['Page header','24 bytes','`pd_lsn` (LSN of the last WAL record that changed the page), `pd_checksum`, `pd_flags`, `pd_lower`, `pd_upper`, `pd_special`, page size and layout version, `pd_prune_xid`'],['Line pointers (item identifiers)','4 bytes each','Array growing from the front; each gives offset, length and state of one tuple. States: normal, redirect, dead, unused'],['Free space','between `pd_lower` and `pd_upper`','Room for new line pointers and tuples'],['Tuples (rows)','variable','Stored from the **end** of the page backwards. Each starts with a 23-byte header: `t_xmin`, `t_xmax`, `t_cid`, `t_ctid`, `t_infomask`, `t_infomask2`, `t_hoff`'],['Special space','0 for tables','Used by index access methods (for example B-tree sibling pointers)']]},
{ul:['A row that does not fit in one page is not split: large values are moved to the **TOAST** table (below).','`pd_lsn` is the link between data and WAL: the page may be written only after WAL is flushed up to this LSN.','Since PostgreSQL 18 `initdb` enables **data checksums** by default (`--no-data-checksums` disables them). `SHOW data_checksums;` tells you; checksum failures are counted in `pg_stat_database`.','The table property `fillfactor` leaves free space in each page for updates, reducing page splits and enabling HOT updates.']},
{h:'TOAST: storing large values'},
{p:'**TOAST** (The Oversized-Attribute Storage Technique) handles values too large for a page. When a row grows beyond about **2 KB**, PostgreSQL first tries to compress the largest variable-length columns and, if still too big, moves them **out of line** into a separate TOAST table (`pg_toast.pg_toast_<table OID>`) in chunks of roughly 2 KB. The main row keeps only a small pointer. A single value can be up to 1 GB. The TOAST table is stored in the **same tablespace** as its parent table and moves with it.'},
{t:[['Column storage strategy','Compress','Out of line','Typical use'],['`PLAIN`','No','No','Fixed-length types'],['`EXTENDED` (default for text, bytea, jsonb ...)','Yes','Yes','General'],['`EXTERNAL`','No','Yes','Large values with frequent substring access (no decompression)'],['`MAIN`','Yes','Only as last resort','Keep in the row if possible']]},
{code:`ALTER TABLE docs ALTER COLUMN body SET STORAGE EXTERNAL;
ALTER TABLE docs ALTER COLUMN body SET COMPRESSION lz4;      -- or pglz; default_toast_compression sets the default
SELECT reltoastrelid::regclass FROM pg_class WHERE relname = 'docs';   -- pg_toast.pg_toast_16410`},
{h:'Size functions'},
{t:[['Function','Counts'],['`pg_relation_size(rel [, fork])`','One fork only; default is the main fork'],['`pg_table_size(rel)`','Table + TOAST + free space map + visibility map (no indexes)'],['`pg_indexes_size(rel)`','All indexes of the table'],['`pg_total_relation_size(rel)`','Everything above together'],['`pg_database_size(db)`, `pg_tablespace_size(ts)`','Whole database or tablespace']]},
{h:'Hands-on'},
{code:`CREATE TABLE st_demo (id int PRIMARY KEY, note text);
INSERT INTO st_demo SELECT g, repeat('x', 100) FROM generate_series(1, 50000) g;
VACUUM st_demo;

SELECT pg_relation_filepath('st_demo');
SELECT pg_relation_filenode('st_demo');

SELECT pg_size_pretty(pg_relation_size('st_demo', 'main')) AS main,
       pg_size_pretty(pg_relation_size('st_demo', 'fsm'))  AS fsm,
       pg_size_pretty(pg_relation_size('st_demo', 'vm'))   AS vm,
       pg_size_pretty(pg_total_relation_size('st_demo'))   AS total;

-- name of the file for a given object and the reverse lookup
SELECT pg_filenode_relation(0, pg_relation_filenode('st_demo'));   -- 0 = database default tablespace

-- look inside a page (superuser; extension from contrib)
CREATE EXTENSION IF NOT EXISTS pageinspect;
SELECT lsn, checksum, lower, upper, special, pagesize FROM page_header(get_raw_page('st_demo', 0));
SELECT lp, lp_off, lp_len, t_xmin, t_xmax, t_ctid FROM heap_page_items(get_raw_page('st_demo', 0)) LIMIT 5;

-- free space and data checksums
CREATE EXTENSION IF NOT EXISTS pg_freespacemap;
SELECT * FROM pg_freespace('st_demo') LIMIT 3;
SHOW data_checksums;
DROP TABLE st_demo;`},
{code:`# on the OS: all files that belong to one relation (default tablespace)
ls -l $PGDATA/base/16384/ | grep 16401
# 16401   16401_fsm   16401_vm      (and 16401.1 once the table passes 1 GB)

# data checksum tool (cluster must be shut down)
pg_checksums --check -D $PGDATA`},
{note:'Do not edit relation files by hand. The tools above are read-only helpers for diagnosis. `get_raw_page()` reads through shared buffers, so it shows what the server currently sees.'}],
src:[['Database Physical Storage',D+'storage.html'],['Database File Layout',D+'storage-file-layout.html'],['TOAST',D+'storage-toast.html'],['Free Space Map',D+'storage-fsm.html'],['Visibility Map',D+'storage-vm.html'],['The Initialization Fork',D+'storage-init.html'],['Database Page Layout',D+'storage-page-layout.html'],['pageinspect',D+'pageinspect.html'],['Data Checksums',D+'checksums.html']]},

/* ---------------------------------------------------------------- 7:5 (bonus) */
'pg:7:5':{blocks:[
{p:'Creating a tablespace is only the start. Day-to-day use depends on where **new** objects go by default, where **temporary** files are written, who may use the tablespace, how the planner treats its speed, and how you monitor and plan capacity. This lecture covers those settings, taken from the documentation chapters on tablespaces and client-connection defaults.'},
{h:'Where does a new object go?'},
{flow:['TABLESPACE clause in the command','Else non-empty default_tablespace','Else dattablespace of the current database','Normally pg_default']},
{t:[['Setting','Context','Default','Effect'],['`default_tablespace`','`user` (session, role, database, file)','empty string','Tablespace for tables, indexes and materialized views created without a `TABLESPACE` clause. Empty means the database default. Ignored for temporary objects'],['`temp_tablespaces`','`user`','empty','List of tablespaces for temporary tables, their indexes and **temporary files** (sorts, hash joins, spilling queries)'],['`temp_file_limit`','`superuser`','`-1` (no limit)','Maximum temporary-file space per process; a query exceeding it is cancelled'],['`log_temp_files`','`superuser`','`-1` (off)','Log every temporary file at or above this size; `0` logs all']]},
{ul:['`default_tablespace` only affects objects created **afterwards**. Existing objects stay where they are.','An invalid or inaccessible name in `default_tablespace` makes `CREATE TABLE` fail, unless the command names a tablespace itself.','When `temp_tablespaces` lists several names, PostgreSQL picks **at random** for each new temporary object, but within one transaction successive objects go to successive list entries. This spreads load over several disks. A name for which the role lacks `CREATE` is skipped.','Temporary files are placed in a `pgsql_tmp` directory: `base/pgsql_tmp` for the default tablespace, or `pg_tblspc/<OID>/PG_18_.../pgsql_tmp` for a user tablespace. They are removed at server start.']},
{code:`-- sorts and hash joins that spill to disk go to a dedicated fast disk
CREATE TABLESPACE ts_temp LOCATION '/pgdata/ts_temp/app';
GRANT CREATE ON TABLESPACE ts_temp TO PUBLIC;           -- temp use needs CREATE
ALTER SYSTEM SET temp_tablespaces = 'ts_temp';
SELECT pg_reload_conf();

-- watch temporary-file use per database
SELECT datname, temp_files, pg_size_pretty(temp_bytes) AS temp_bytes
FROM pg_stat_database WHERE datname = current_database();
ALTER SYSTEM SET log_temp_files = '10MB';`},
{h:'Per-tablespace planner and I/O settings'},
{p:'The planner assumes the same cost for every page unless told otherwise. If one tablespace is on SSD and another on spinning disks, tell the planner. The four options below can be set on a tablespace and **override** the global values for objects stored in it.'},
{t:[['Option','Global default','Meaning','Typical value on SSD'],['`seq_page_cost`','`1.0`','Cost of reading a page sequentially','`1.0`'],['`random_page_cost`','`4.0`','Cost of a non-sequential page read; lower values make index scans more attractive','`1.1`'],['`effective_io_concurrency`','server setting','Number of concurrent I/O requests to prefetch','higher on SSD'],['`maintenance_io_concurrency`','server setting','Same for maintenance work such as index builds','higher on SSD']]},
{code:`ALTER TABLESPACE ts_ssd SET (random_page_cost = 1.1, effective_io_concurrency = 200);
SELECT spcname, spcoptions FROM pg_tablespace;`},
{h:'Privileges on tablespaces'},
{t:[['Aspect','Rule'],['Who can create or drop','Creation: superuser only. Drop, rename, change options: owner or superuser'],['Using a tablespace','The `CREATE` privilege on it. Needed to create objects there, to move objects there, and to use it in `temp_tablespaces`'],['Default','A new user tablespace can be used only by its owner and superusers until `CREATE` is granted. `pg_default` is open to every role, which is why ordinary users can create tables without any grant'],['Existing objects','Reading and writing data does not need any tablespace privilege; only creating or moving does'],['Ownership matters','A role that owns a tablespace cannot be dropped until `REASSIGN OWNED` or an owner change']]},
{code:`GRANT CREATE ON TABLESPACE ts_ssd TO app_rw;
REVOKE CREATE ON TABLESPACE ts_ssd FROM app_rw;
SELECT has_tablespace_privilege('app_rw', 'ts_ssd', 'CREATE');
\\db+                                    -- the Access privileges column shows the ACL`},
{h:'Planning placement'},
{t:[['Workload','Placement idea','Remarks'],['OLTP with a small hot set','Hot tables and **all indexes** on SSD or NVMe; large rarely read tables on cheaper disks','Indexes are read randomly, so they benefit most from fast storage'],['Time-series or log data','Recent partitions on fast storage, old partitions moved to a cold tablespace','Move a partition with `ALTER TABLE ... SET TABLESPACE` as it ages'],['Heavy sorting, reporting','`temp_tablespaces` on a dedicated disk','Avoids competing with data and WAL I/O'],['Write-heavy system','Separate disk for **`pg_wal`** (it is not a tablespace; use `initdb --waldir` or a symbolic link)','Sequential WAL writes do not disturb random data I/O'],['Several applications in one cluster','One tablespace per application or tier, named by purpose','Makes ownership and growth visible']]},
{code:`CREATE TABLESPACE ts_hot  LOCATION '/pgdata/ts_hot/app';
CREATE TABLESPACE ts_cold LOCATION '/pgdata/ts_cold/app';

CREATE TABLE events (id bigint, created date NOT NULL, payload text) PARTITION BY RANGE (created);
CREATE TABLE events_2026_10 PARTITION OF events
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01') TABLESPACE ts_hot;
CREATE TABLE events_2025 PARTITION OF events
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01') TABLESPACE ts_cold;

-- when a month ages, move its partition (and rebuild its indexes there)
ALTER TABLE events_2026_09 SET TABLESPACE ts_cold;
REINDEX (TABLESPACE ts_cold) TABLE CONCURRENTLY events_2026_09;`},
{h:'Monitoring tablespaces'},
{code:`-- size per tablespace (cluster-wide)
SELECT spcname, pg_size_pretty(pg_tablespace_size(oid)) AS size
FROM pg_tablespace ORDER BY pg_tablespace_size(oid) DESC;

-- objects and size per tablespace in the CURRENT database
SELECT ts.spcname, count(*) AS objects,
       pg_size_pretty(sum(pg_relation_size(c.oid))) AS size
FROM pg_class c
JOIN pg_tablespace ts ON ts.oid = COALESCE(NULLIF(c.reltablespace, 0),
     (SELECT dattablespace FROM pg_database WHERE datname = current_database()))
WHERE c.relkind IN ('r', 'i', 'm', 't')
GROUP BY ts.spcname ORDER BY sum(pg_relation_size(c.oid)) DESC;`},
{p:'Also monitor the **operating system**: `df -h` on each tablespace volume, inode use, and mount state. PostgreSQL itself has no per-tablespace quota; when a tablespace volume fills, writes to objects in it fail with `No space left on device`, while other tablespaces keep working.'},
{h:'Limits and good practice'},
{ul:['No SQL command sets a size limit on a tablespace; use file-system or volume quotas.','A tablespace is **cluster-wide** while objects belong to one database: always check every database before dropping or moving.','Tablespaces are not independent: a database cannot be restored from only some of its tablespaces. Back up all of them together.','Keep the same directory layout on primary, standbys, test and disaster-recovery servers.','Name tablespaces by **purpose** (`ts_hot`, `ts_cold`, `ts_temp`), not by disk (`ts_sdb1`), because disks change.','Avoid network file systems for data directories unless you fully understand the consistency and locking guarantees; the documentation lists the risks.','Document the mapping tablespace to path to purpose in your runbook.']}],
src:[['Tablespaces',D+'manage-ag-tablespaces.html'],['Client Connection Defaults: Statement Behavior',D+'runtime-config-client.html'],['Resource Consumption',D+'runtime-config-resource.html'],['Query Planning: planner cost constants',D+'runtime-config-query.html'],['GRANT',D+'sql-grant.html'],['Creating a Database Cluster (file systems)',D+'creating-cluster.html']]},

/* ---------------------------------------------------------------- 7:6 (bonus) */
'pg:7:6':{blocks:[
{p:'A WAL segment goes through a **lifecycle**: it is created or reused, filled, closed, optionally archived, and finally recycled or removed. PostgreSQL keeps a segment only while something still needs it. When the directory `pg_wal` grows unexpectedly, one of a small number of **retention holders** is almost always the cause. This lecture explains the lifecycle, the holders, how to diagnose each one and how to relocate `pg_wal`. Checkpoint tuning itself is covered in Section 06 (WAL and Checkpoint Parameters).'},
{h:'Lifecycle of a segment'},
{flow:['Current segment is filled with records','Segment is full or pg_switch_wal / archive_timeout closes it','archive_mode on: .ready marker, archive_command copies it, marker becomes .done','Checkpoint finishes: older segments are no longer needed for crash recovery','Needed by a slot, wal_keep_size or a standby? Then it stays','Otherwise it is recycled (renamed as a future segment) or removed']},
{p:'**Recycling** means renaming an old file to a future segment number instead of deleting it and creating a new one, which saves file-system work. The number of segments kept for reuse is estimated from recent activity and bounded by `min_wal_size` and `max_wal_size`. The `checkpoint complete` log line reports how many files were added, removed and recycled.'},
{h:'What keeps WAL in pg_wal'},
{svg:holdSvg},
{t:[['Holder','Setting','How to check','How to release'],['Distance since the last checkpoint','`max_wal_size` (soft limit), `checkpoint_timeout`','`log_checkpoints`, `pg_stat_checkpointer`','Normal. Tune the settings (Section 06)'],['Archiving not keeping up or failing','`archive_mode`, `archive_command` or `archive_library`','`pg_stat_archiver`, `ls pg_wal/archive_status/*.ready`','Fix the command, the target disk or network; segments are removed after they are archived'],['Extra segments kept for standbys','`wal_keep_size` (default 0)','`SHOW wal_keep_size;`','Lower the value; takes effect at the next checkpoint'],['Replication slots','`max_slot_wal_keep_size` (default `-1`, unlimited)','`pg_replication_slots`: `active`, `restart_lsn`, `wal_status`, `safe_wal_size`','Reconnect the consumer, or drop an abandoned slot; set `max_slot_wal_keep_size` as a safety cap'],['Long-running base backup','none','`pg_stat_progress_basebackup`','Finish or cancel the backup'],['Heavy write burst','workload','`pg_stat_wal`, `pg_ls_waldir()`','Wait; consider larger `max_wal_size`']]},
{note:'`max_wal_size` is a **soft** limit. It is exceeded when archiving fails, when slots or `wal_keep_size` retain files, or under extreme load. It does not protect the disk by itself.'},
{h:'Archiving: configuration and checks'},
{code:`# postgresql.conf
wal_level = replica
archive_mode = on                               # restart required
archive_command = 'test ! -f /backup/wal_archive/%f && cp %p /backup/wal_archive/%f'
archive_timeout = 15min                         # optional: force a segment switch on quiet systems
# %p = path of the segment, %f = file name only
# PostgreSQL 15+ also offers archive_library for a shared module instead of a shell command`},
{ul:['The command must return **exit status 0 only if the file was safely archived**. Any other status makes PostgreSQL retry and keep the segment.','It must not overwrite an existing archive file; the `test ! -f` guard prevents silent loss.','`archive_mode` needs a **restart**; `archive_command` only a reload.','Test it by hand as the postgres user, and monitor `pg_stat_archiver`.']},
{code:`SELECT archived_count, last_archived_wal, last_archived_time,
       failed_count,   last_failed_wal,   last_failed_time
FROM pg_stat_archiver;

SELECT slot_name, slot_type, active, restart_lsn, wal_status,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained,
       pg_size_pretty(safe_wal_size) AS safe_wal_size
FROM pg_replication_slots;`},
{t:[['`wal_status` of a slot','Meaning'],['`reserved`','Within `max_wal_size`; WAL is safe'],['`extended`','Beyond `max_wal_size` but still kept by the slot or `wal_keep_size`'],['`unreserved`','About to be removed at the next checkpoint (when `max_slot_wal_keep_size` is set)'],['`lost`','Required WAL is gone; the consumer must be rebuilt']]},
{h:'Troubleshooting a growing or full pg_wal'},
{flow:['Alert: pg_wal growing','Measure: pg_ls_waldir() size and df','Archiver failing? Fix archive_command','Inactive slot? Reconnect or drop it','wal_keep_size too high? Lower it','Checkpoints too rare or load too high? Tune and add disk','Confirm: size falls after next checkpoint']},
{code:`-- how much WAL is on disk
SELECT count(*) AS files, pg_size_pretty(sum(size)) AS total FROM pg_ls_waldir();

-- segments waiting to be archived (run in a shell)
--   ls $PGDATA/pg_wal/archive_status | grep -c '\\.ready$'

-- drop an abandoned slot (it must be inactive)
SELECT pg_drop_replication_slot('old_standby_slot');

-- cap what a slot may retain, then reload
ALTER SYSTEM SET max_slot_wal_keep_size = '50GB';
SELECT pg_reload_conf();
CHECKPOINT;       -- lets PostgreSQL remove or recycle segments that are no longer held`},
{h:'When the disk is already full'},
{t:[['Situation','Symptoms','Action'],['Almost full, server still running','Alerts, `pg_wal` near the disk size','Free space elsewhere on the same volume (old logs, dumps); fix the holder (archiver, slot); never remove WAL by hand'],['Full','`PANIC: could not write to file "pg_wal/xlogtemp.NNNN": No space left on device`; server stops','Add space or move `pg_wal` to a larger volume (below), then start; crash recovery runs automatically'],['Damaged WAL, server will not start','Errors about missing or invalid WAL records','Restore from backup. `pg_resetwal` is the last resort and may leave inconsistent data']]},
{h:'Sizing the pg_wal volume'},
{t:[['Component','Contribution'],['`max_wal_size`','Normal ceiling between checkpoints (soft)'],['`wal_keep_size`','Added on top'],['Archive backlog','Seconds or minutes of WAL if the archive target is slow, more if it is down'],['Slot retention','Unlimited unless `max_slot_wal_keep_size` is set'],['Safety margin','At least 20-30 percent free']]},
{h:'Moving pg_wal to another disk'},
{code:`# at cluster creation
initdb -D /var/lib/pgsql/18/data --waldir=/walvol/pg_wal

# on an existing cluster (short downtime)
sudo systemctl stop postgresql-18
sudo mkdir -p /walvol && sudo mv /var/lib/pgsql/18/data/pg_wal /walvol/pg_wal
sudo ln -s /walvol/pg_wal /var/lib/pgsql/18/data/pg_wal
sudo chown -h postgres:postgres /var/lib/pgsql/18/data/pg_wal
sudo chmod 700 /walvol/pg_wal
sudo restorecon -Rv /walvol                      # SELinux (RHEL family)
sudo systemctl start postgresql-18
ls -ld /var/lib/pgsql/18/data/pg_wal`},
{note:'`pg_wal` is not a tablespace. It is moved with `initdb --waldir` or a symbolic link as shown, and a physical backup must capture it (`pg_basebackup -X stream` does).'},
{h:'Monitoring checklist'},
{ul:['Free space on the `pg_wal` volume (alert at 70 percent and 85 percent).','`pg_stat_archiver.failed_count` increasing, or `last_archived_time` older than your target.','Slots with `active = false` or `wal_status` other than `reserved`.','`pg_stat_checkpointer.num_requested` much larger than `num_timed`.','Replication lag on every standby.']}],
src:[['WAL Configuration',D+'wal-configuration.html'],['Continuous Archiving and PITR',D+'continuous-archiving.html'],['Replication Slots',D+'warm-standby.html'],['pg_replication_slots',D+'view-pg-replication-slots.html'],['pg_stat_archiver',D+'monitoring-stats.html'],['Write Ahead Log settings',D+'runtime-config-wal.html'],['initdb',D+'app-initdb.html'],['pg_resetwal',D+'app-pgresetwal.html']]},

/* ---------------------------------------------------------------- 7:7 (bonus) */
'pg:7:7':{blocks:[
{p:'WAL is not a black box. Three tools let you **read** what the server wrote and what state it recorded: **`pg_waldump`** prints WAL records from segment files, the **`pg_walinspect`** extension does the same through SQL, and **`pg_controldata`** shows the control file (checkpoint position, timeline, segment size). They answer questions such as "what generates so much WAL?", "where did the last checkpoint start?" and "which timeline is this cluster on?". All three are read-only.'},
{h:'pg_waldump'},
{p:'`pg_waldump` is a command-line program that decodes WAL files and displays one line per record. It works on files, so it can read the live `pg_wal` directory, an archive, or a copy. It does not need the server running, but it must run as an OS user that can read the files (normally `postgres`). A record that is still being written at the end of the log may appear as incomplete; this is normal.'},
{code:`# records of one segment
pg_waldump -p $PGDATA/pg_wal 000000010000000000000003

# a range of LSNs, only 20 records
pg_waldump -p $PGDATA/pg_wal -s 0/3000148 -e 0/3010000 -n 20

# typical output
# rmgr: Heap        len (rec/tot):     59/    59, tx:        742, lsn: 0/03000148, prev 0/03000110, desc: INSERT off: 1, flags: 0x00, blkref #0: rel 1663/16384/16401 blk 0
# rmgr: Transaction len (rec/tot):     34/    34, tx:        742, lsn: 0/03000188, prev 0/03000148, desc: COMMIT 2026-10-08 10:31:02.114516 IST`},
{t:[['Field in the output','Meaning'],['`rmgr`','Resource manager that owns the record (Heap, Btree, Transaction, XLOG ...)'],['`len (rec/tot)`','Record data length / total length including full-page images'],['`tx`','Transaction ID (0 for records not tied to a transaction)'],['`lsn`, `prev`','Position of this record and of the previous one'],['`desc`','Human-readable description (`INSERT`, `COMMIT`, `CHECKPOINT_ONLINE` ...)'],['`blkref #0: rel 1663/16384/16401 blk 0`','Block touched: **tablespace OID / database OID / relfilenode**, block number. 1663 is `pg_default`; a user tablespace shows its own OID']]},
{t:[['Option','Purpose'],['`-p path`','Directory with the WAL files'],['`-s`, `-e`','Start and end LSN'],['`-n N`','Stop after N records'],['`-t N`','Timeline to read'],['`-r rmgr`','Only records of one resource manager; `-r list` shows names'],['`-x xid`','Only records of one transaction'],['`-R tblspc/db/rel`, `-B`, `-F`','Only records touching one relation, block or fork'],['`-b`','Show block references in detail'],['`-w` / `--fullpage`','Only records with full-page images'],['`-f`','Follow: keep reading as new WAL arrives'],['`--stats[=record]` (or `-z`)','Summary table instead of records']]},
{code:`# who generates the WAL? summary by resource manager
pg_waldump -p $PGDATA/pg_wal --stats 000000010000000000000003 000000010000000000000008
# Type            N   (%)   Record size  (%)   FPI size  (%)   Combined size (%)
# Heap       120045 (61.2)     9604620 (58.1)  4096000 (71.0)  13700620 (61.4)
# Btree       41000 (20.9)     ...

# every change to one table: tablespace/database/relfilenode from pg_relation_filepath
pg_waldump -p $PGDATA/pg_wal -R 1663/16384/16401 000000010000000000000003`},
{ul:['A large **FPI size** share means checkpoints are frequent: raise `max_wal_size` and `checkpoint_timeout`, consider `wal_compression`.','Many `Btree` and `Heap` records for one table point to an update-heavy table with many indexes.','Use the **three-part relation number** to connect a WAL record to a table: that is the link between WAL format and tablespaces.']},
{h:'pg_walinspect (SQL access to WAL)'},
{p:'The contrib extension **`pg_walinspect`** (PostgreSQL 15 and later) exposes similar information as SQL functions. It reads the WAL of the **running server**. Execute permission is limited to superusers and members of the predefined role `pg_read_server_files`.'},
{t:[['Function','Returns'],['`pg_get_wal_record_info(lsn)`','One record at or after the LSN'],['`pg_get_wal_records_info(start_lsn, end_lsn)`','All records in the range (type, length, FPI length, description, block references)'],['`pg_get_wal_stats(start_lsn, end_lsn [, per_record])`','Statistics by resource manager or record type'],['`pg_get_wal_block_info(start_lsn, end_lsn [, show_data])`','One row per block reference; useful to find which relation a record touched']]},
{code:`CREATE EXTENSION pg_walinspect;

SELECT pg_current_wal_flush_lsn() AS start_lsn \\gset
-- ... run some workload, then:
SELECT resource_manager, record_type, count(*) AS records,
       pg_size_pretty(sum(record_length)) AS bytes, pg_size_pretty(sum(fpi_length)) AS fpi_bytes
FROM pg_get_wal_records_info(:'start_lsn', pg_current_wal_flush_lsn())
GROUP BY 1, 2 ORDER BY sum(record_length) DESC LIMIT 10;

SELECT * FROM pg_get_wal_stats(:'start_lsn', pg_current_wal_flush_lsn())
WHERE count > 0 ORDER BY combined_size DESC;`},
{h:'pg_controldata and pg_control_* functions'},
{p:'The **control file** `global/pg_control` is a small file that the server updates at every checkpoint. It tells startup where crash recovery must begin. `pg_controldata` prints it, and it works even when the server is stopped.'},
{code:`pg_controldata $PGDATA
# pg_control version number:            1800
# Database system identifier:           <64-bit number>
# Database cluster state:               in production
# Latest checkpoint location:           0/3000110
# Latest checkpoint's REDO location:    0/30000D8
# Latest checkpoint's REDO WAL file:    000000010000000000000003
# Latest checkpoint's TimeLineID:       1
# Latest checkpoint's full_page_writes: on
# Time of latest checkpoint:            Thu 08 Oct 2026 10:25:41 AM IST
# Bytes per WAL segment:                16777216
# WAL block size:                       8192
# Data page checksum version:           1`},
{t:[['Field','What it tells you'],['`Database cluster state`','`in production`, `shut down`, `in crash recovery`, `in archive recovery`, `shut down in recovery`'],['`Latest checkpoint location` / `REDO location`','Where crash recovery starts replaying WAL'],['`REDO WAL file`','The oldest segment crash recovery needs'],['`TimeLineID`','Current timeline (changes after promotion or point-in-time recovery)'],['`Minimum recovery ending location`','Non-zero on a standby or during recovery; the point to reach for consistency'],['`Bytes per WAL segment`, `WAL block size`','Confirm the sizes chosen at `initdb`'],['`Data page checksum version`','`1` when data checksums are enabled'],['`Database system identifier`','Unique cluster ID; must match across primary and standbys']]},
{code:`-- the same information from SQL (works while the server runs)
SELECT checkpoint_lsn, redo_lsn, redo_wal_file, timeline_id, checkpoint_time FROM pg_control_checkpoint();
SELECT system_identifier, pg_control_last_modified FROM pg_control_system();
SELECT bytes_per_wal_segment, wal_block_size, data_page_checksum_version FROM pg_control_init();
SELECT * FROM pg_control_recovery();`},
{note:'Use these tools to **observe**. Never edit `pg_control` or WAL files; `pg_resetwal` is the only supported way to rewrite control data and it is a last-resort recovery tool.'}],
src:[['pg_waldump',D+'pgwaldump.html'],['pg_walinspect',D+'pgwalinspect.html'],['pg_controldata',D+'app-pgcontroldata.html'],['Control data functions',D+'functions-info.html'],['WAL Internals',D+'wal-internals.html'],['pg_resetwal',D+'app-pgresetwal.html']]},

/* ---------------------------------------------------------------- 7:8 (bonus) */
'pg:7:8':{blocks:[
{p:'A tablespace lives **outside** `PGDATA`, so every tool that copies, restores, replicates or upgrades a cluster must handle it explicitly. Forgetting a tablespace is a classic cause of failed restores and broken standbys. This lecture is the bridge to Section 09 (Backup & Recovery) and Section 10 (Upgrade & Replication): it shows how each tool treats tablespaces and what to check beforehand.'},
{h:'Behaviour of each tool'},
{t:[['Tool or feature','What it does with tablespaces','What you must do'],['`pg_basebackup` (plain format)','Copies `PGDATA` and every tablespace directory to the **same absolute paths** by default','On the same host or when paths differ use `-T OLD=NEW` for each tablespace'],['`pg_basebackup` (tar format `-Ft`)','Writes `base.tar` plus one `<tablespace OID>.tar` per tablespace','Keep all tar files together; extract each to its target path'],['File-system / snapshot backup with `pg_backup_start` and `pg_backup_stop`','`pg_backup_stop` returns `backup_label` **and** `tablespace_map`','Store both with the backup; at restore place them in `PGDATA`'],['`pg_dump`','Logical dump of one database. Emits `SET default_tablespace = ...` for objects outside the default tablespace; does **not** create tablespaces','Create the tablespaces on the target first, or use `--no-tablespaces`'],['`pg_dumpall`','Also dumps global objects, including `CREATE TABLESPACE ... LOCATION ...` with the original paths','Edit the paths for a different server, or use `--globals-only` / `--no-tablespaces`'],['Physical standby','Replays `CREATE TABLESPACE` from WAL using the **same path**','Prepare identical directories on the standby before creating tablespaces on the primary'],['Logical replication','Replicates table data only, not tablespaces or DDL','Create tablespaces and tables on the subscriber yourself'],['`pg_upgrade`','Reuses tablespace directories; each major version gets its own `PG_<ver>_<catversion>` subdirectory','Check free space on every tablespace volume when using copy mode']]},
{h:'pg_basebackup with tablespaces'},
{code:`# plain format, tablespace /ts_old/data restored to /restore/ts_data
pg_basebackup -h primary -U replicator -D /restore/pgdata \\
  -Fp -X stream -P \\
  -T /ts_old/data=/restore/ts_data

# several tablespaces: repeat -T
pg_basebackup -D /restore/pgdata -X stream -T /ts_a=/restore/ts_a -T /ts_b=/restore/ts_b

# tar format: one tar per tablespace
pg_basebackup -D /backup/b1 -Ft -z -X stream -P
ls /backup/b1
# base.tar.gz  16400.tar.gz  16401.tar.gz  pg_wal.tar.gz`},
{ul:['In plain format on the **same host** as the source, a backup without `-T` would try to write into the live tablespace directory and fails, which protects you from overwriting data.','The OLD path in `-T` must match the location exactly as shown by `pg_tablespace_location()`. Use `-T` once per tablespace.','`base.tar` contains the `tablespace_map` file. When the restored server starts, it creates the symbolic links named in it. To restore to **different paths**, edit `tablespace_map` before the first start.']},
{h:'Logical backups'},
{code:`pg_dump -Fc -d sales -f sales.dump                         # SET default_tablespace statements inside
pg_dump -Fc --no-tablespaces -d sales -f sales_nots.dump   # everything goes to the target default

pg_dumpall --globals-only -f globals.sql                    # roles and CREATE TABLESPACE lines
pg_dumpall --tablespaces-only -f tablespaces.sql            # only CREATE TABLESPACE (edit the paths)

pg_restore --no-tablespaces -d sales_new sales_nots.dump`},
{h:'Standby servers'},
{flow:['Plan identical tablespace paths on primary and standby','Create the directories on the standby, owned by postgres','Build the standby with pg_basebackup -R (and -T if paths differ)','Run CREATE TABLESPACE on the primary','Standby replays it from WAL','Check pg_tablespace_location on both']},
{note:'If the directory for a new tablespace cannot be created on a standby, WAL replay on that standby stops with an error. Fix the directory permissions or path and replay resumes; do not skip the record.'},
{h:'pg_upgrade'},
{ul:['The new cluster **reuses** the tablespace locations of the old one. Because each major version has its own `PG_<version>_<catalog version>` subdirectory, old and new data coexist, so in `--copy` mode every tablespace volume needs room for a second copy; `--link`, `--clone` and `--swap` need much less.','Take a backup of every tablespace volume before upgrading. In `--link` and `--swap` modes the old cluster cannot be started again once the new one has run.','After a successful upgrade the generated delete script removes the old cluster, including the old-version subdirectories inside the tablespaces.','Compare `\\db+` and the object counts before and after.']},
{h:'Restore checklist for clusters with tablespaces'},
{t:[['Step','Check'],['1','Inventory: `SELECT oid, spcname, pg_tablespace_location(oid) FROM pg_tablespace;` saved with every backup'],['2','Target server has the same (or mapped) directories, owned by postgres, mode 0700, SELinux label set'],['3','Backup includes **all** tablespaces (tar files or `-T` mappings) and `tablespace_map`'],['4','After restore: `ls -l pg_tblspc` links point where you expect; `\\db` shows the right locations'],['5','Run a count or checksum query on a table from each tablespace'],['6','Confirm standbys and monitoring use the same layout']]},
{note:'Section 09 shows complete backup and restore runs. Keep the inventory query in every backup job so the paths are recorded next to the data.'}],
src:[['pg_basebackup',D+'app-pgbasebackup.html'],['Continuous Archiving and PITR (tablespace_map)',D+'continuous-archiving.html'],['pg_dump',D+'app-pgdump.html'],['pg_dumpall',D+'app-pg-dumpall.html'],['pg_restore',D+'app-pgrestore.html'],['pg_upgrade',D+'pgupgrade.html'],['Log-Shipping Standby Servers',D+'warm-standby.html']]}

});

/* ---------- back-fill notes into earlier lessons (Section 08) ---------- */
const X=(k,blocks,src)=>{const L=window.LESSONS[k];if(!L)return;L.blocks.push(...blocks);if(src)L.src=(L.src||[]).concat(src)};

X('pg:0:2',[
{h:'Where storage and WAL duties are taught (Section 08)'},
{t:[['DBA duty','Where to learn it'],['Capacity: a disk is filling up','Tablespace Creation and Drop, Tablespace Online Moving, Tablespace Offline Moving'],['Availability: crash recovery and WAL disk space','WAL Format, WAL Lifecycle (bonus)'],['Performance: hot data, indexes and temporary files on fast storage','Using Tablespaces (bonus), Storage Layout (bonus)'],['Recoverability: every tablespace must be in every backup','Tablespaces in Backup, Replication and Upgrade (bonus)'],['Diagnosis: what is the server writing?','Inspecting WAL (bonus)']]}],
[['Tablespaces',D+'manage-ag-tablespaces.html']]);

X('pg:1:5',[
{h:'Tablespace directories are not in PGDATA (Section 08)'},
{p:'Removing the packages or deleting `PGDATA` does **not** remove the directories of user-defined tablespaces. They live elsewhere (for example `/pgdata/ts_fast/app`), keep occupying disk space, and still contain `PG_18_...` subdirectories with data files. Before an uninstall, list them, include them in the backup and decide explicitly what happens to them.'},
{code:`-- while the server is still running: record every tablespace and its path
SELECT oid, spcname, pg_tablespace_location(oid) AS location
FROM pg_tablespace WHERE spcname NOT LIKE 'pg\\_%';

# offline equivalent (server stopped): the links name the locations
ls -l $PGDATA/pg_tblspc`},
{ul:['`pg_dumpall` records `CREATE TABLESPACE` statements, but not the files; a physical backup (`pg_basebackup`) copies the files of every tablespace as well.','After the uninstall, remove each tablespace directory yourself, only once the backup has been restored and verified.','A forgotten tablespace directory is a common reason why a later reinstall refuses to create a tablespace at the same path.']}],
[['Tablespaces',D+'manage-ag-tablespaces.html']]);

X('pg:2:1',[
{h:'Tablespaces on a host with several clusters (Section 08)'},
{ul:['Each cluster has its own `pg_tblspc` and its own tablespace OIDs. The same OID (for example 16400) can mean different tablespaces in different clusters; identify a tablespace by the **link target**, not by the number alone.','Never let two clusters of the **same major version** share one `LOCATION`. Both would write into the same `PG_18_<catalog version>` subdirectory and overwrite each other\'s files. Clusters of different major versions have different subdirectory names, but separate directories are still the safe rule.','Use a naming convention that contains the cluster, for example `/pgdata/c5433/ts_fast/app` and `/pgdata/c5434/ts_fast/app`, and give each cluster its own SELinux label rule and mount.','`CREATE TABLESPACE` in one cluster is not visible to another cluster. Document tablespaces per cluster.']}],
[['Tablespaces',D+'manage-ag-tablespaces.html']]);

X('pg:3:4',[
{h:'WAL files, names and LSNs in detail (Section 08)'},
{p:'The summary above is expanded in Section 08. The key facts: WAL is cut into segment files of `wal_segment_size` (16 MB default, fixed at `initdb`), each made of 8 KB pages holding variable-length records; every record carries a CRC and a resource-manager ID. A file name is **timeline + high 32 bits of the LSN + segment number**, so LSN `0/3000148` lives in `000000010000000000000003` at offset `0x148`. Each data page remembers the LSN of its last change (`pd_lsn`) and may be written only after WAL has been flushed up to it.'},
{t:[['Topic','Lecture in Section 08'],['Segment, page and record layout, full-page images, timelines','WAL Format'],['Archiving, retention, slots, a full `pg_wal`','WAL Lifecycle (bonus)'],['Reading WAL with `pg_waldump` and `pg_walinspect`','Inspecting WAL (bonus)']]},
{note:'`CREATE TABLESPACE` and `DROP TABLESPACE` are WAL-logged with the absolute path, so a standby must have the same directory layout.'}],
[['WAL Internals',D+'wal-internals.html']]);

X('pg:3:6',[
{h:'Directories that point outside PGDATA (Section 08)'},
{t:[['Entry','What it really is'],['`pg_tblspc/<OID>`','Symbolic link to a user tablespace directory **outside** `PGDATA`. A copy of `PGDATA` alone does not contain this data'],['`pg_wal/`','Normally a directory, but often a symbolic link to a dedicated disk'],['`pg_wal/archive_status/`','`.ready` and `.done` markers for the archiver'],['`pg_wal/summaries/`','WAL summary files (PostgreSQL 17+, used for incremental backups)'],['`global/pg_control`','The control file read by `pg_controldata`; names the last checkpoint']]},
{p:'Inside each tablespace location the layout is `PG_18_<catalog version>/<database OID>/<relfilenode>`. A backup or restore plan must therefore cover `PGDATA` **plus** every directory reachable from `pg_tblspc` and from `pg_wal`.'}],
[['Database File Layout',D+'storage-file-layout.html']]);

X('pg:4:1',[
{h:'Databases and tablespaces (Section 08)'},
{code:`CREATE DATABASE sales TABLESPACE ts_fast;                   -- default tablespace of the new database
CREATE DATABASE sales_copy TEMPLATE sales STRATEGY = wal_log; -- PostgreSQL 15+: wal_log (default) or file_copy
ALTER DATABASE sales SET TABLESPACE pg_default;            -- needs no other connections
SELECT datname, pg_tablespace.spcname AS default_tablespace
FROM pg_database JOIN pg_tablespace ON pg_tablespace.oid = pg_database.dattablespace;`},
{ul:['`TABLESPACE` in `CREATE DATABASE` sets the database default; objects without an explicit clause go there, including the new database\'s system catalogs.','When a template contains objects in other tablespaces, the copy keeps them in the **same tablespaces**, so the target server must have those tablespaces.','`STRATEGY = file_copy` copies files directly and issues checkpoints before and after; `wal_log` copies block by block through WAL, which is cheaper for small templates and friendlier to replicas.','A tablespace cannot be dropped while any database uses it as its default tablespace.']}],
[['CREATE DATABASE',D+'sql-createdatabase.html']]);

X('pg:4:3',[
{h:'Tablespaces in the hierarchy (Section 08)'},
{t:[['Question','Answer'],['Scope of a tablespace','**Cluster-wide**, like roles. One tablespace may hold objects of many databases'],['Scope of an object','One database; stored in one tablespace (plus its TOAST table and forks)'],['Where is the object\'s file?','`pg_tblspc/<tablespace OID>/PG_18_<catversion>/<database OID>/<relfilenode>`, or `base/<database OID>/<relfilenode>` for the default'],['What does `reltablespace = 0` mean?','The object is in the **default tablespace of its database**, not necessarily `pg_default`'],['How do I find the tablespace of a table?','`SELECT tablename, tablespace FROM pg_tables;` (NULL means the database default) or `pg_relation_filepath()`']]},
{p:'Section 08 describes how to create, move and drop tablespaces and how pages, forks and TOAST tables appear in these files.'}],
[['Tablespaces',D+'manage-ag-tablespaces.html']]);

X('pg:5:3',[
{h:'Tablespace, temporary-file and WAL retention parameters (Section 08)'},
{t:[['Parameter','Context','Action'],['`default_tablespace`, `temp_tablespaces`','`user`','`SET` in a session, `ALTER ROLE ... SET`, or file plus reload'],['`temp_file_limit`, `wal_compression`','`superuser`','`SET` by a superuser or reload'],['`wal_keep_size`, `max_slot_wal_keep_size`, `archive_command`, `summarize_wal`','`sighup`','Reload'],['`archive_mode`, `wal_log_hints`','`postmaster`','Restart'],['`wal_segment_size`','`internal`','Read-only; chosen at `initdb` (see WAL Format)']]}],
[['Setting Parameters',D+'config-setting.html']]);

X('pg:5:6',[
{h:'More WAL parameters: retention, archiving and recycling (Section 08)'},
{t:[['Parameter','Default','Context','Purpose'],['`wal_segment_size`','16MB','internal','Segment size, fixed at `initdb --wal-segsize`; shown by `SHOW`'],['`wal_keep_size`','0','sighup','Minimum WAL kept in `pg_wal` for standbys that do not use slots'],['`max_slot_wal_keep_size`','-1','sighup','Cap on WAL a replication slot may retain; protects the disk from abandoned slots'],['`wal_recycle`','on','sighup','Rename old segments for reuse instead of deleting them'],['`wal_init_zero`','on','superuser','Zero-fill new segment files'],['`archive_mode`, `archive_command`, `archive_timeout`','off, empty, 0','postmaster, sighup, sighup','Copy completed segments away; force a segment switch on quiet servers'],['`summarize_wal`','off','sighup','Write WAL summaries needed for incremental backups (PostgreSQL 17+)']]},
{p:'Why a segment stays or goes, and how to diagnose a growing `pg_wal`, is covered in WAL Lifecycle in Section 08.'}],
[['Write Ahead Log settings',D+'runtime-config-wal.html']]);

X('pg:6:4',[
{h:'Privileges on tablespaces (Section 08)'},
{t:[['Object','Privilege','Command','Effect'],['Tablespace','`CREATE`','`GRANT CREATE ON TABLESPACE ts_fast TO app_rw;`','May create tables, indexes and temporary files there, and move objects into it'],['Tablespace','`CREATE`','`REVOKE CREATE ON TABLESPACE ts_fast FROM app_rw;`','Existing objects keep working; no new objects there']]},
{p:'A new tablespace is usable only by its owner and superusers until you grant `CREATE`. `pg_default` is open to all roles. `\\db+` shows the **Access privileges** column, and `has_tablespace_privilege(role, tablespace, \'CREATE\')` tests it.'}],
[['GRANT',D+'sql-grant.html']]);

})();
