/* LearnSphere: Section 09 - Backup & Recovery (lectures 1-8 + bonus lectures 9-14)
   Load AFTER lessons7.js. Docs links target PostgreSQL 18. Also back-fills notes into earlier lessons. */
(function(){
const D='https://www.postgresql.org/docs/18/';
const dg=window.LS_DG;

/* ---------- diagrams ---------- */
const methodsSvg=dg(700,250,[
[10,95,170,60,"PostgreSQL cluster|PGDATA + databases",2],
[260,10,230,60,"1. SQL dump (logical)|pg_dump, pg_dumpall",0],[260,95,230,60,"2. File system level (physical)|pg_basebackup, snapshots, cp",0],[260,180,230,60,"3. Continuous archiving|base backup plus WAL archive",2],
[530,10,160,60,"SQL script or archive|selective, portable",0],[530,95,160,60,"Copy of data files|whole cluster only",0],[530,180,160,60,"Restore to any point|PITR, standby seed",2]],
[[180,115,260,40],[180,125,260,125],[180,135,260,210],[490,40,530,40],[490,125,530,125],[490,210,530,210]]);

const formatSvg=dg(700,285,[
[10,115,120,60,"pg_dump|-F p, c, d, t",2],
[190,10,200,50,"plain (p)|SQL script, default",0],[190,80,200,50,"custom (c)|one compressed file",0],[190,150,200,50,"directory (d)|toc.dat + file per table",0],[190,220,200,50,"tar (t)|uncompressed archive",0],
[470,10,220,50,"psql -f|single process",0],[470,80,220,50,"pg_restore|-j parallel, selective",2],[470,150,220,50,"pg_restore|-j parallel, selective",2],[470,220,220,50,"pg_restore|no -j gain, no reorder",0]],
[[130,135,190,35],[130,140,190,105],[130,150,190,175],[130,160,190,245],[390,35,470,35],[390,105,470,105],[390,175,470,175],[390,245,470,245]]);

const connSvg=dg(700,230,[
[5,2,690,105,"Which host, port, user and database?",1],
[20,25,150,70,"Connection string|-d connstr|highest priority",2],[195,25,150,70,"Command-line options|-h -p -U -d",0],[370,25,150,70,"Environment variables|PGHOST, PGPORT,|PGUSER",0],[545,25,140,70,"Compiled defaults|socket, 5432, OS user",0],
[5,115,690,108,"Where does the password come from?",1],
[20,138,150,70,"PGPASSWORD|visible to others|avoid",0],[195,138,150,70,".pgpass file|mode 0600|recommended",2],[370,138,150,70,"pg_service.conf|PGSERVICE|shared settings",0],[545,138,140,70,"Interactive prompt|off with -w|fails in cron",0]],
[[170,60,195,60],[345,60,370,60],[520,60,545,60]]);

const secSvg=dg(700,225,[
[10,30,200,100,"pre-data|CREATE TABLE, TYPE,|FUNCTION, SCHEMA|definitions",0],[250,30,200,100,"data|COPY rows, large objects,|sequence values|slowest, parallel",2],[490,30,200,100,"post-data|indexes, constraints,|triggers, rules|built after the data",0],
[10,150,200,50,"--section=pre-data",0],[250,150,200,50,"--section=data",0],[490,150,200,50,"--section=post-data",0]],
[[210,80,250,80],[450,80,490,80]]);

const listSvg=dg(700,205,[
[10,70,130,60,"db.dump|archive with TOC",0],[190,70,150,60,"pg_restore -l|list the items",2],[390,70,130,60,"db.list|edit this file",2],[560,70,130,60,"pg_restore -L|only listed items",0],
[190,150,330,45,"Remove a line, comment it with ; or reorder it",0]],
[[140,100,190,100],[340,100,390,100],[520,100,560,100],[455,130,455,150]]);

const allSvg=dg(700,250,[
[10,95,150,70,"pg_dumpall|connects to every|database",2],
[220,10,220,55,"Global objects|roles, tablespaces, grants",0],[220,85,220,55,"pg_dump db1|CREATE DATABASE + data",0],[220,160,220,55,"pg_dump db2|one run per database",0],
[500,85,190,70,"One SQL script|restore with psql",2]],
[[160,115,220,37],[160,130,220,112],[160,145,220,187],[440,37,500,105],[440,112,500,120],[440,187,500,135]]);

const pbSvg=dg(700,340,[
[10,10,330,45,"1. Replication connection|REPLICATION role + pg_hba.conf entry",0],[10,65,330,45,"2. Server enters backup mode|waits for a checkpoint: spread or fast",0],[10,120,330,45,"3. Data directory and tablespaces sent|plus backup_label and tablespace_map",2],[10,175,330,45,"4. WAL streamed on a second connection|-X stream, the default",0],[10,230,330,45,"5. Backup mode ends, WAL segment switched|last required segment is closed",0],[10,285,330,45,"6. backup_manifest sent, files synced|check later with pg_verifybackup",2],
[380,10,310,45,"Checked: wal_level, max_wal_senders",0],[380,65,310,45,"Phase: waiting for checkpoint to finish",0],[380,120,310,45,"Phase: streaming database files",2],[380,175,310,45,"Second walsender streams pg_wal",0],[380,230,310,45,"Phase: waiting for wal archiving to finish",0],[380,285,310,45,"Result: directory or tar files + manifest",2]],
[[340,32,380,32],[340,87,380,87],[340,142,380,142],[340,197,380,197],[340,252,380,252],[340,307,380,307]]);

const planSvg=dg(700,200,[
[10,20,150,55,"Weekly|full base backup",2],[180,20,150,55,"Daily|incremental backup",0],[350,20,150,55,"Continuous|WAL archiving",2],[520,20,170,55,"Nightly|pg_dump + globals",0],
[10,115,200,55,"RPO: minutes|set by WAL archiving",0],[250,115,200,55,"RTO: hours|set by restore speed",0],[490,115,200,55,"Offsite copy and|monthly restore test",2]],
[[425,75,350,115],[85,75,110,115],[605,75,590,115]]);

const lowSvg=dg(700,195,[
[10,45,125,60,"pg_backup_start|label, fast?",2],[165,45,130,60,"Copy files|tar, rsync, snapshot",0],[325,45,130,60,"pg_backup_stop|same session",2],[485,45,100,60,"Save files|backup_label|tablespace_map",0],[615,45,75,60,"Archive|last WAL",0],
[165,130,290,45,"Leave out pg_wal, postmaster.pid, pg_replslot, temp files",0]],
[[135,75,165,75],[295,75,325,75],[455,75,485,75],[585,75,615,75]]);

const archSvg=dg(700,200,[
[10,20,120,55,"Backends|write WAL",0],[170,20,130,55,"pg_wal segment|16 MB, filled",2],[340,20,130,55,"archive_status|.ready marker",0],[510,20,180,55,"archiver process|runs archive_command",2],
[510,115,180,55,"Archive directory|file copied, exit 0",2],[340,115,130,55,".done marker|segment recyclable",0],[170,115,130,55,"pg_stat_archiver|counts, last WAL",0],[10,115,120,55,"Exit not 0|retry later",0]],
[[130,47,170,47],[300,47,340,47],[470,47,510,47],[600,75,600,115],[510,142,470,142],[340,142,300,142]]);

const pitrSvg=dg(700,255,[
[10,20,130,50,"Base backup|taken at T0",2],[170,20,150,50,"WAL archive|keeps growing",0],[350,20,140,50,"Mistake|DROP TABLE 14:30",0],[520,20,170,50,"Timeline 1 continues|abandoned branch",0],
[10,130,130,50,"Restore files|recovery.signal",0],[170,130,150,50,"Replay WAL|restore_command",0],[350,130,140,50,"Target 14:29|recovery stops",2],[520,130,170,50,"Timeline 2 starts|WAL 00000002...",2],
[10,205,680,40,"00000002.history records the branch point. WAL names begin with the timeline ID.",0]],
[[140,45,170,45],[320,45,350,45],[490,45,520,45],[75,70,75,130],[140,155,170,155],[320,155,350,155],[490,155,520,155]]);

const incSvg=dg(700,200,[
[10,20,130,55,"Full backup|backup_manifest",2],[170,20,150,55,"Incremental 1|changed blocks|manifest",0],[350,20,150,55,"Incremental 2|changed blocks|manifest",0],[530,20,160,55,"pg_combinebackup|oldest to newest",2],
[10,115,130,55,"WAL summaries|summarize_wal = on",0],[170,115,150,55,"Recovery|recovery.signal + WAL",0],[350,115,150,55,"pg_verifybackup|check the result",0],[530,115,160,55,"Synthetic full|backup + manifest",2]],
[[140,47,170,47],[320,47,350,47],[500,47,530,47],[610,75,610,115],[530,142,500,142],[350,142,320,142],[75,115,75,75]]);

const drSvg=dg(700,250,[
[10,95,130,55,"Incident|what was lost?",2],
[200,10,230,55,"Data changed or deleted|PITR or logical restore",0],[200,95,230,55,"Server or disk lost|base backup + WAL, or standby",0],[200,180,230,55,"Site or account lost|offsite or immutable copy",0],
[490,10,200,55,"Scratch instance|copy rows back",0],[490,95,200,55,"New host, restore|repoint applications",0],[490,180,200,55,"Rebuild from the|remote repository",0]],
[[140,115,200,37],[140,122,200,122],[140,130,200,207],[430,37,490,37],[430,122,490,122],[430,207,490,207]]);

window.EXTRA_LECTURES=window.EXTRA_LECTURES||{};
window.EXTRA_LECTURES[8]=[
['Backup Strategy: RPO, RTO, Retention and Automation','0:00','Turn tools into a strategy: recovery objectives, the 3-2-1 rule, backup layers, retention and storage sizing, a production backup script, monitoring and backup security.'],
['File System Level Backups, Snapshots and the Low-Level API','0:00','Cold copies, rsync two-pass, LVM/ZFS/cloud snapshots and the pg_backup_start / pg_backup_stop API: what must be copied, what must be left out, and where it goes wrong.'],
['Continuous Archiving: Setting Up WAL Archiving','0:00','archive_mode, archive_command and archive modules, safe archive scripts, testing, monitoring with pg_stat_archiver, archive_timeout and cleaning the archive.'],
['Point-in-Time Recovery (PITR) and Timelines','0:00','Recover to a time, a named restore point, a transaction or an LSN: recovery settings, recovery.signal, timelines and a complete DROP TABLE recovery run.'],
['Incremental Backups, Manifests and Backup Verification','0:00','PostgreSQL 17+ incremental backups with WAL summaries and pg_combinebackup, the backup manifest, pg_verifybackup, checksums and restore testing.'],
['Backup Tools, Troubleshooting and the Disaster Recovery Runbook','0:00','pgBackRest, Barman and WAL-G compared, failure scenarios and the right recovery for each, a runbook, version compatibility rules and an error-message troubleshooting matrix.']];

Object.assign(window.LESSONS,{

/* ---------------------------------------------------------------- 8:0 */
'pg:8:0':{blocks:[
{p:"A **backup** is a copy of data, kept somewhere else, from which the data can be rebuilt after a loss. A **restore** is the act of putting that copy back, and **recovery** is the wider process of bringing a damaged system to a usable, consistent state, which for PostgreSQL may include replaying WAL after the files are copied back. The PostgreSQL documentation (Chapter 25, *Backup and Restore*) stresses that the procedures themselves are simple, but that you must understand the techniques and their assumptions before you rely on them. This lecture builds that understanding: the three official backup approaches, how each one achieves a consistent copy, what each one does and does not contain, and how to choose between them. The remaining lectures of this section then work through each tool in detail."},
{h:"The three backup approaches in the official documentation"},
{svg:methodsSvg},
{t:[["Approach","Tools","What you get","Scope","Point-in-time recovery","Cross-version restore"],["**SQL dump** (logical)","`pg_dump`, `pg_dumpall`","SQL commands or an archive that re-creates objects and data","One database, one schema or table, or the whole cluster (`pg_dumpall`)","No: only the moment the dump started","Yes: a dump normally loads into the same or a newer major version"],["**File system level backup** (physical)","`pg_basebackup`, `tar`, `rsync`, storage snapshots","A binary copy of the data directory and tablespaces","Whole cluster only","No (a plain copy is one moment in time)","No: same major version, same CPU architecture and OS family"],["**Continuous archiving**","Base backup plus archived WAL (`archive_command`)","A base backup and every WAL segment written after it","Whole cluster only","**Yes**: any moment after the base backup ended","No: same major version"]]},
{h:"Logical versus physical: the core idea"},
{t:[["","Logical backup","Physical backup"],["What is copied","The **meaning** of the data: `CREATE TABLE`, `COPY` rows, `CREATE INDEX` statements","The **bytes** of the data files, WAL and control files exactly as stored"],["Restore work","The server re-inserts every row and rebuilds every index, so it is slow on large databases","Files are copied back and WAL is replayed, so it is as fast as the disk and network allow"],["Size","Often smaller (no index data, no bloat, compressible text)","About the size of the cluster, including indexes and bloat"],["Selective restore","Yes: one table, one schema, one function","No: the whole cluster comes back"],["Portability","Across major versions, architectures and operating systems","Only to the same major version on a compatible platform"],["Consistency source","A single MVCC snapshot taken when the dump starts","Crash recovery from a checkpoint plus WAL replay"],["Typical use","Migrations, refreshing test data, small and medium databases, per-database protection","Large databases, fast full restore, PITR, building standby servers"]]},
{note:"Neither type replaces the other. A mature setup uses a physical backup with WAL archiving for fast, point-in-time recovery of the whole cluster, **and** regular logical dumps for selective restores, cross-version moves and protection against logical corruption that a physical copy would faithfully preserve."},
{h:"How consistency is achieved"},
{p:"A backup that mixes data from different moments is worthless, because rows would reference parents that do not exist yet. PostgreSQL gets a consistent copy in two different ways, and knowing the difference explains most of the rules in this section."},
{ul:["**pg_dump** is an ordinary client. It opens one transaction with a single snapshot and reads every table inside it. Thanks to MVCC (Section 01), concurrent writers are neither blocked nor visible to the dump, so the result is a consistent picture of the database **as it was when the dump started**. It takes only `ACCESS SHARE` locks, so `SELECT`, `INSERT`, `UPDATE` and `DELETE` continue, but a statement that needs an exclusive lock (for example `ALTER TABLE` or `TRUNCATE`) waits behind the dump.","**Physical backups** copy files while they change, so the copy alone is internally inconsistent. This is acceptable because every change is also in WAL. The backup records the checkpoint at which it started (`backup_label`), and at restore time the server replays WAL from that checkpoint until it reaches the end of the backup. That is the same mechanism as crash recovery (Section 04), so no file system snapshot is required for a base backup."]},
{h:"What is, and is not, inside each backup"},
{t:[["Item","`pg_dump`","`pg_dumpall`","`pg_basebackup`"],["Table data and definitions","Yes (one database)","Yes (all databases)","Yes (all databases, as files)"],["Indexes","Definitions only; rebuilt on restore","Definitions only","Yes, the index files themselves"],["Roles and their passwords","No","Yes (global objects)","Yes (in the shared catalogs)"],["Tablespace definitions","Only the `TABLESPACE` clause of objects","Yes, as `CREATE TABLESPACE` with paths","Yes, and the tablespace **files**"],["Tablespace directories on disk","No","No: the directories must already exist","Yes"],["Large objects","Yes, by default for a whole-database dump","Yes","Yes"],["`postgresql.conf`, `pg_hba.conf`","No","No","Only if they live inside `PGDATA`. Files kept elsewhere (for example `/etc/postgresql`) are not copied"],["Optimizer statistics","Only with `--statistics`","Only with `--statistics`","Yes (they are table data in the catalogs)"],["Unlogged table data","Dumped, unless `--no-unlogged-table-data`","Same","Copied, but unlogged tables are emptied by recovery when the backup is restored"],["Replication slots","No","No","Not useful; slots are better left out of copies"],["Extension **code** (.so, control files)","No: only `CREATE EXTENSION`","No","Not files outside `PGDATA`; the packages must be installed on the new host"]]},
{p:"The table explains two classic surprises: a restored dump needs the **roles** and **extensions** to exist already (see the Restore lecture), and a restored physical backup does not bring back configuration files that were stored outside the data directory."},
{h:"Key terms every DBA must use precisely"},
{t:[["Term","Meaning"],["**RPO** (Recovery Point Objective)","The maximum amount of data loss, measured in time, that the business accepts. A nightly dump gives an RPO of up to 24 hours; continuous WAL archiving gives minutes"],["**RTO** (Recovery Time Objective)","The maximum time the service may stay down. It is set by restore speed, not by backup speed, so you must measure it"],["**Hot backup**","Taken while the server runs and accepts connections (`pg_dump`, `pg_basebackup`)"],["**Cold backup**","Taken with the server stopped; consistent by construction"],["**Base backup**","A physical copy of the cluster that is the starting point for archive recovery or a standby"],["**WAL archive**","A store of completed WAL segments, copied away by `archive_command`"],["**Restore point**","A named position in WAL created with `pg_create_restore_point()` that recovery can stop at"],["**Retention**","How long backups, and the WAL needed for them, are kept before deletion"]]},
{h:"Choosing a method"},
{t:[["If you need to ...","Use","Why"],["Restore one table, one schema or one database","Logical: `pg_dump -Fc` or `-Fd`","Archive formats allow selective restore"],["Move data to a newer major version or another architecture","Logical dump, or `pg_upgrade` (Section 10)","Only logical dumps are portable across versions"],["Bring the whole cluster back as fast as possible","Physical: `pg_basebackup`","Files are copied back; no row-by-row reload"],["Return to an exact moment (for example just before a bad `DELETE`)","Base backup plus WAL archive (PITR)","Only WAL replay can stop at a chosen point"],["Protect roles and tablespace definitions","`pg_dumpall --globals-only`","`pg_dump` does not save global objects"],["Build a standby server","`pg_basebackup -R`","Gives a ready-to-start replica (Section 10)"]]},
{h:"A sound backup programme in seven steps"},
{flow:["Define RPO and RTO","Choose methods","Automate with scripts or a tool","Store a copy off the server","Verify with real restores","Monitor and alert","Document the runbook"]},
{h:"Before you design anything: inspect the cluster"},
{code:`-- version, size and layout drive the choice of method
SELECT version();
SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database WHERE NOT datistemplate ORDER BY pg_database_size(datname) DESC;

-- tablespaces outside PGDATA must be part of a physical backup
SELECT spcname, pg_tablespace_location(oid) FROM pg_tablespace;

-- can this server support WAL archiving and base backups right now?
SHOW wal_level;         -- replica or logical needed for archiving
SHOW archive_mode;      -- on / always for PITR
SHOW max_wal_senders;   -- pg_basebackup needs at least 1 (2 with -X stream)
SHOW data_checksums;    -- on lets pg_basebackup verify pages`},
{note:"The golden rule from Section 01 still applies: a backup that has never been restored is only a hope. Every lecture in this section ends with a way to **verify** the backup, and the last bonus lecture turns that into a runbook."}],
src:[["Chapter 25: Backup and Restore",D+"backup.html"],["25.1 SQL Dump",D+"backup-dump.html"],["25.2 File System Level Backup",D+"backup-file.html"],["25.3 Continuous Archiving and PITR",D+"continuous-archiving.html"]]},

/* ---------------------------------------------------------------- 8:1 */
'pg:8:1':{blocks:[
{p:"`pg_dump` can write its output in four **formats**, chosen with `-F` (`--format`). The choice decides how the dump can be restored, how fast, whether single objects can be picked out, whether the work can be parallelised and how big the files are. The documentation describes two groups: the **script** format (plain), which is a text file of SQL for `psql`, and the **archive** formats (custom, directory, tar), which must be restored with `pg_restore`. This lecture compares them and explains how `pg_dump` and `pg_dumpall` differ in scope."},
{svg:formatSvg},
{h:"The four formats side by side"},
{t:[["","Plain (`-Fp`)","Custom (`-Fc`)","Directory (`-Fd`)","Tar (`-Ft`)"],["Output","One SQL text file (default)","One binary archive file","A directory: `toc.dat` plus one file per table and large object","One tar file"],["Restore tool","`psql`","`pg_restore`","`pg_restore`","`pg_restore`"],["Compressed by default","No (`-Z` compresses the whole file)","Yes, gzip at a moderate level","Yes, gzip at a moderate level","No, and compression is not supported"],["Parallel **dump** (`-j`)","No","No","**Yes**, the only format that supports it","No"],["Parallel **restore** (`pg_restore -j`)","No (psql runs one session)","Yes","Yes","No"],["Select or reorder objects at restore","No (edit the text)","Yes (`-l`, `-L`, `-t`, `-n` ...)","Yes","Selection yes; the order of table data cannot be changed"],["Readable by humans and editable","Yes","No","Partly: `toc.dat` is binary, data files are not text","Extract it to get a directory archive"],["Restore into old servers or other products","Easiest (with editing)","No","No","No"],["Best for","Small databases, migrations, code review, non-PostgreSQL targets","General-purpose backups of one database","Large databases: fastest dump and restore","Special cases, legacy scripts"]]},
{note:"Tar and directory formats are compatible: extracting a tar archive yields a valid directory archive. Tar has an inherent limit of 8 GB for a single member file, so a table larger than that cannot be dumped in tar format. For this reason and because it cannot compress, prefer custom or directory."},
{h:"Why archive formats exist: selective restore"},
{p:"An archive contains a **table of contents** (TOC). `pg_restore -l` prints it, `-L` restores only the listed items in the listed order, and `-t`, `-n`, `-I`, `-P` and `-T` pick tables, schemas, indexes, functions or triggers. With a plain dump you can only restore everything, or cut the text file apart by hand. The TOC also lets `pg_restore` run the slow steps (loading data, building indexes, adding constraints) in parallel."},
{h:"Compression"},
{p:"Compression is controlled by `-Z` (`--compress`). It accepts a level (`-Z 6`) or a method with optional detail (`-Z zstd:5`, `-Z lz4`, `-Z gzip:9`, `-Z none`). Without a method a positive level means gzip and `0` means no compression."},
{t:[["Method","Strength","Weakness","Note"],["`gzip`","Available everywhere; universal tools can read it","Slowest, mediocre ratio at high levels","Default for custom and directory"],["`lz4`","Very fast, light on CPU","Lower compression ratio","Good when the dump is CPU-bound"],["`zstd`","Best balance of speed and ratio; level and `long` mode tunable","Needs a PostgreSQL build with zstd support","Good default for new setups"],["`none`","Fastest dump; lets you compress later with external tools","Largest files","Useful when the storage layer compresses (ZFS, dedup appliance)"]]},
{ul:["For **custom** and **directory** formats the compression applies to each table-data segment inside the archive. For **plain** output a non-zero level compresses the whole file as if piped through the compressor.","`lz4` and `zstd` depend on how the server and client tools were built. If your `pg_dump` reports that the method is unsupported, use `gzip` or install the PGDG packages.","Do not compress an already compressed archive a second time: you save almost nothing and spend CPU."]},
{h:"pg_dump versus pg_dumpall"},
{t:[["","`pg_dump`","`pg_dumpall`"],["Scope","**One database**","**All databases** of the cluster plus global objects"],["Global objects (roles, tablespace definitions, role privilege grants)","Not saved","Saved"],["Output formats","Plain, custom, directory, tar","Plain SQL script only"],["Parallelism and selective restore","Yes (archive formats)","No"],["Connections","One (or `-j` + 1)","Reconnects once per database, so use `~/.pgpass`"],["Typical role in a backup plan","The main tool for each database","Used with `--globals-only` for roles and tablespaces, or for small clusters"]]},
{h:"Production considerations"},
{t:[["Question","Guidance"],["How big will the dump be?","Plan disk space for the largest dump plus the retention you keep. Measure with `pg_size_pretty(pg_database_size(...))`; a compressed dump is often 10-40% of the database size, depending on content"],["How much load does it add?","`pg_dump` reads every table. `-j N` makes it faster but opens N+1 connections, so raise `max_connections` if needed and expect more I/O and CPU on the server"],["Which format for restore speed?","Directory (parallel dump and restore) is fastest. Custom allows parallel restore, but the dump itself is one process. Plain is slowest to restore because indexes are built one at a time"],["Will DDL collide with the dump?","The dump holds `ACCESS SHARE` locks, so schema changes wait. With `-j`, an exclusive-lock request in the middle of the run can make the dump **abort** rather than deadlock. Schedule dumps outside deployment windows and use `--lock-wait-timeout`"],["Where does the file go?","Not on the same disk as the database. Copy it off the server and encrypt it if it leaves your network"],["Which pg_dump version?","Use the newest client available. It can read older servers (the 18 documentation supports servers back to 9.2) but refuses a newer server"]]},
{h:"Hands-on: one database, four formats"},
{code:`# 1. plain SQL script (compressed, here with gzip level 6)
pg_dump -U postgres -d shopdb -f /backup/shopdb.sql
pg_dump -U postgres -d shopdb -Z 6 -f /backup/shopdb.sql.gz

# 2. custom archive
pg_dump -U postgres -d shopdb -Fc -f /backup/shopdb.dump

# 3. directory archive with 4 parallel jobs (the directory must not exist)
pg_dump -U postgres -d shopdb -Fd -j 4 -f /backup/shopdb_dir

# 4. tar archive
pg_dump -U postgres -d shopdb -Ft -f /backup/shopdb.tar

# look at what you got
ls -lh /backup
file /backup/shopdb.dump          # PostgreSQL custom database dump
head -n 25 /backup/shopdb.sql      # header, SET statements, CREATE statements
pg_restore -l /backup/shopdb.dump | head -n 20
ls /backup/shopdb_dir | head       # toc.dat, 1234.dat.gz, ...`},
{h:"Decision flow"},
{t:[["Your situation","Choose"],["Large database, short backup window, many CPU cores","`-Fd -j N` (parallel dump and parallel restore)"],["Medium database, selective or parallel restore wanted, single file is convenient","`-Fc`"],["You must read, review or edit the SQL, or load into another DBMS","`-Fp` (with `--inserts` only for non-PostgreSQL targets)"],["You are unsure","`-Fc`, add `-Z zstd:5` if available"]]},
{h:"Converting between formats"},
{ul:["Archive to script: `pg_restore -f out.sql db.dump` (no database connection needed; this is also the safe way to **inspect** an untrusted dump).","Directory to tar or the reverse: the layouts are compatible, so `tar` and `pg_restore` accept both.","Plain to archive: not possible directly; load the script into a scratch database and dump that in the desired format."]},
{note:"The documentation warns that restoring a dump executes SQL chosen by whoever could write the dump. Inspect dumps from untrusted superusers before loading them; non-plain dumps can be inspected with `pg_restore --file`."}],
src:[["pg_dump",D+"app-pgdump.html"],["pg_restore",D+"app-pgrestore.html"],["pg_dumpall",D+"app-pg-dumpall.html"],["25.1 SQL Dump",D+"backup-dump.html"]]},

/* ---------------------------------------------------------------- 8:2 */
'pg:8:2':{blocks:[
{p:"`pg_dump` is a normal PostgreSQL client. It uses the same connection library (libpq) as `psql`, so the options that say **where to connect and who to be** work the same way, and the same authentication rules in `pg_hba.conf` (Section 07) decide whether the connection is allowed. `pg_dump` does not run with special privileges: it can only dump what the connecting role may read. This lecture covers the connection options (`-d`, `-h`, `-p`, `-U`, `-w`, `-W`), the ways to supply a password safely in scripts, and the output options (`-f`, `-F`, `-j`, `-a`, `-s`, `-c`, `-Z`, `-v`) that are used together with them."},
{svg:connSvg},
{h:"Connection options"},
{t:[["Option","Long form","Meaning","Default if omitted","Environment variable"],["`-d dbname`","`--dbname`","Database to dump. May be a **connection string** (`\"host=db1 dbname=sales sslmode=require\"`); string parameters override conflicting options","`PGDATABASE`, else the user name","`PGDATABASE`"],["`-h host`","`--host`","Server host name or IP. A value starting with `/` is a Unix socket **directory**","Unix socket on the local machine","`PGHOST`"],["`-p port`","`--port`","TCP port, or the socket file extension","`5432` (or the compiled-in default)","`PGPORT`"],["`-U user`","`--username`","Role to connect as","The operating-system user name","`PGUSER`"],["`-w`","`--no-password`","Never prompt. Fails if the server wants a password and none is available from `.pgpass` or the environment. Required in cron and batch jobs","Prompt when the server asks","none"],["`-W`","`--password`","Force a prompt before connecting. Rarely needed because `pg_dump` prompts automatically","Off","none"],["`--role=name`","","Issues `SET ROLE name` after connecting. Lets a login role without enough privileges dump as a role that has them, without logging in as a superuser","None","none"]]},
{note:"The first positional argument that is not an option is the database name, so `pg_dump shopdb` and `pg_dump -d shopdb` are equivalent. If you give neither and `PGDATABASE` is unset, `pg_dump` dumps the database whose name equals the connecting user, a frequent source of the message `database \"postgres\" does not exist` style errors."},
{h:"Providing the password in a script"},
{t:[["Method","How","Assessment"],["`~/.pgpass`","One line per target: `host:port:database:user:password`. Wildcards `*` allowed. File must be mode `0600` or libpq ignores it. `PGPASSFILE` selects another file","**Recommended.** Not visible in process lists; works for `pg_dumpall`, which reconnects once per database"],["`pg_service.conf` and `PGSERVICE`","Named connection profiles (`[prod]` with host, port, dbname, user)","Good for many servers; combine with `.pgpass`"],["`PGPASSWORD` environment variable","`PGPASSWORD=secret pg_dump ...`","**Discouraged.** Can be seen by other users of the system on some platforms and ends up in shell history"],["Password inside the connection string","`\"host=db dbname=x password=...\"`","Avoid: visible in `ps` output"],["Peer or `trust` authentication on the local socket","`pg_hba.conf` rule `local all backup peer`, run the job as that OS user","Passwordless and safe if the OS account is protected (Section 07)"],["Client certificates","`sslmode=verify-full sslcert=... sslkey=...`","Strongest for remote jobs"]]},
{code:`# ~/.pgpass  (chmod 0600)
# hostname:port:database:username:password
db1.example.com:5432:*:backup_user:S3cr3t-from-a-vault
localhost:5432:shopdb:backup_user:another-secret

chmod 0600 ~/.pgpass
pg_dump -h db1.example.com -p 5432 -U backup_user -d shopdb -w -Fc -f shopdb.dump`},
{h:"What the connecting role needs"},
{ul:["`pg_dump` runs `SELECT` statements, so the role needs `SELECT` on every table and sequence to be dumped and `USAGE` on the schemas. The simplest least-privilege setup is a dedicated login role that is a member of the predefined role **`pg_read_all_data`** (PostgreSQL 14+).","A superuser can read everything, but granting superuser to a backup job is a larger risk than needed (Section 07).","Tables protected by **row-level security**: `pg_dump` sets `row_security = off` so that all rows are dumped; if the role cannot bypass it, `pg_dump` fails rather than produce a partial dump. `--enable-row-security` dumps only the rows the role can see (use with `--inserts`).","`pg_dumpall` also reads global objects. Dumping role **password hashes** needs access to `pg_authid` (superuser); with `--no-role-passwords` it reads `pg_roles` instead."]},
{code:`CREATE ROLE backup_user LOGIN PASSWORD 'change-me' CONNECTION LIMIT 4;
GRANT pg_read_all_data TO backup_user;

-- pg_hba.conf: allow it only from the backup host, with SCRAM
-- host  shopdb  backup_user  10.0.0.20/32  scram-sha-256`},
{h:"Output and behaviour options used with the connection"},
{t:[["Option","Meaning","Notes"],["`-f file`","Write to a file instead of standard output","**Required** for `-Fd`; the directory must not exist"],["`-F p|c|d|t`","Output format","See the previous lecture"],["`-j N`","Dump N tables in parallel","Directory format only; opens N+1 connections; needs synchronized snapshots (primary since 9.2, standby since 10)"],["`-a` / `--data-only`","Data only, no definitions","Includes large objects and sequence values"],["`-s` / `--schema-only`","Definitions only, no data","Cannot be combined with `-a`"],["`-c` / `--clean`","Emit `DROP` commands before `CREATE`","**Plain format only**; for archives give `--clean` to `pg_restore`. Add `--if-exists` to hide missing-object errors"],["`-C` / `--create`","Start the output with `CREATE DATABASE` and a reconnect","Also stores database-level settings and privileges"],["`-Z spec`","Compression method and level","`-Z zstd:5`, `-Z 6`, `-Z none`"],["`-v` / `--verbose`","Progress messages on standard error; start and end times in the output","Repeat for debug output"],["`-n` / `-N`, `-t` / `-T`","Include or exclude schemas and tables by pattern","Patterns follow the `psql` `\\d` rules; quote them against the shell"],["`-O`, `-x`","Skip ownership commands, skip privileges (`GRANT`/`REVOKE`)","For archives, give them to `pg_restore`"],["`--lock-wait-timeout=ms`","Fail instead of waiting forever for table locks","Recommended in automated jobs"],["`--no-sync`","Do not wait for files to reach disk","Only for tests; an OS crash could leave the dump damaged"]]},
{h:"Examples"},
{code:`# local, over the Unix socket, as the current OS user (peer authentication)
pg_dump shopdb -Fc -f shopdb.dump

# remote, explicit parameters
pg_dump -h db1.example.com -p 5432 -U backup_user -d shopdb -w -Fc -f shopdb.dump

# connection string with TLS verification (parameters here override other options)
pg_dump -d "host=db1.example.com port=5432 dbname=shopdb user=backup_user sslmode=verify-full sslrootcert=/etc/ssl/certs/ca.pem" -Fc -f shopdb.dump

# service file entry [prod] in ~/.pg_service.conf
PGSERVICE=prod pg_dump -w -Fd -j 4 -f /backup/shopdb_dir

# several clusters on one host (Section 03): choose by port
pg_dump -p 5433 -U postgres -d testdb -Fc -f testdb.dump

# the role has no rights, but may switch to one that does
pg_dump -U alice --role=backup_role -d shopdb -Fc -f shopdb.dump`},
{h:"Troubleshooting connection problems"},
{t:[["Message","Likely cause","Fix"],["`connection to server ... failed: Connection refused`","Server not running, wrong host or port, `listen_addresses` or firewall","Check `pg_isready -h host -p port`, `listen_addresses`, firewall (Section 03)"],["`FATAL: no pg_hba.conf entry for host ...`","No rule matches host, database, user and SSL state","Add a rule and reload; check order, first match wins"],["`FATAL: password authentication failed for user ...`","Wrong password, or a different method than expected","Verify `.pgpass` line matches host, port, database **and** user exactly; check file mode `0600`"],["`fe_sendauth: no password supplied`","`-w` used but no password source available","Provide `.pgpass`, a service file or switch to peer auth"],["`pg_dump: error: aborting because of server version mismatch`","The client is **older** than the server","Install and use a `pg_dump` of the same or a newer major version (for example `/usr/pgsql-18/bin/pg_dump`)"],["`pg_dump: error: query failed: ERROR: permission denied for table ...`","The role cannot read an object","Grant `pg_read_all_data` or use a role that can read everything"],["`FATAL: remaining connection slots are reserved ...` during `-j`","`-j N` needs N+1 connections","Lower `-j` or raise `max_connections`"]]},
{note:"With several PostgreSQL versions installed side by side (Section 02), `which pg_dump` may point at an older client. Call the binary by full path, or put the newest `bin` directory first in `PATH`."}],
src:[["pg_dump (options and connection parameters)",D+"app-pgdump.html"],["Connection Strings",D+"libpq-connect.html#LIBPQ-CONNSTRING"],["The Password File",D+"libpq-pgpass.html"],["Environment Variables (libpq)",D+"libpq-envars.html"],["The Connection Service File",D+"libpq-pgservice.html"]]},

/* ---------------------------------------------------------------- 8:3 */
'pg:8:3':{blocks:[
{p:"**Restore** is the reverse of a logical backup: the dump is turned back into a working database. The tool depends on the **format** (Section 09, Backup Formats): a plain SQL script goes to `psql`, and every archive format (custom, directory, tar) goes to `pg_restore`. `pg_restore` can work in two modes. If you name a database with `-d`, it connects and restores directly into it. If you do not, it writes the SQL script that would have been executed to a file or to standard output, which is useful for review. In both modes it can be selective, can reorder items and, for custom and directory archives, can run the heavy steps in parallel."},
{h:"Which tool for which file"},
{t:[["Dump file","Tool","Command","Parallel","Selective"],["Plain `.sql`, `.sql.gz`","`psql`","`psql -X -d newdb -f db.sql`","No","No"],["Custom `.dump`","`pg_restore`","`pg_restore -d newdb db.dump`","`-j N`","Yes"],["Directory","`pg_restore`","`pg_restore -d newdb -j 4 dumpdir`","`-j N`","Yes"],["Tar `.tar`","`pg_restore`","`pg_restore -d newdb db.tar`","No","Yes"]]},
{note:"Running `pg_restore` on a plain-text file stops with a message that the input appears to be a text format dump and that `psql` must be used. The reverse mistake, feeding a custom archive to `psql`, floods the terminal with binary text. If you are unsure, run `file dumpfile`."},
{h:"The restore procedure"},
{flow:["Check the target server and prerequisites","Create an empty database (from template0) or use -C","Restore with psql or pg_restore","Read the errors, fix, repeat if needed","Run ANALYZE","Verify counts and objects","Re-enable access"]},
{h:"Step 1: prerequisites on the target"},
{t:[["Prerequisite","Why","How to prepare"],["Same or **newer** PostgreSQL major version","A dump normally loads into a newer server; loading into an older one may need manual edits","Use `pg_restore` and `psql` of the newer version"],["The **roles** exist","`pg_dump` does not save roles. Ownership and `GRANT` statements fail if the roles are missing","Restore the global objects first (`pg_dumpall --globals-only`) or create the roles by hand, or use `--no-owner`"],["The **tablespace** directories exist","Objects created `IN TABLESPACE` fail otherwise","Create the directories (Section 08) or use `--no-tablespaces`"],["The **extensions** are installed","`CREATE EXTENSION` needs the extension files on the new host","Install the contrib or third-party packages first (Section 05)"],["Compatible encoding and collation","A different encoding or ICU/libc collation can change index order and unique-constraint behaviour","Create the database with the same encoding and locale (Section 05)"],["Enough disk space and WAL space","Restore writes the data, the indexes and WAL","Size the target for roughly the database size plus WAL"]]},
{h:"Step 2: an empty target database"},
{p:"`pg_dump` output is relative to `template0`. If the cluster has local additions in `template1` (extra objects, extensions), restoring into a database created from `template1` produces duplicate-definition errors. Create the target from `template0`, or let the dump create the database (`-C`)."},
{code:`-- empty, clean database with the same properties as the source
CREATE DATABASE newdb TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER libc LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' OWNER app_owner;

# or from the shell
createdb -T template0 newdb`},
{h:"Step 3: restore"},
{code:`# plain script: stop at the first error, as one transaction
psql -X -v ON_ERROR_STOP=1 --single-transaction -d newdb -f /backup/shopdb.sql

# custom archive into an existing empty database
pg_restore -d newdb /backup/shopdb.dump

# recreate the database named in the dump (connects to postgres only to issue DROP/CREATE DATABASE)
pg_restore -C -d postgres /backup/shopdb.dump

# replace the contents of an existing database: drop objects first, hide "does not exist" errors
pg_restore -d shopdb --clean --if-exists /backup/shopdb.dump

# big restore: parallel, with verbose progress
pg_restore -d newdb -j 4 -v /backup/shopdb_dir

# review without touching any database: create the SQL script
pg_restore -f review.sql /backup/shopdb.dump`},
{ul:["`-X` (`--no-psqlrc`) is recommended by the documentation when loading plain dumps, so that a personal `~/.psqlrc` cannot change the session.","`psql` continues after an error by default. Use `-v ON_ERROR_STOP=1` to stop at the first error, and `--single-transaction` (`-1`) to roll everything back on failure. A plain dump made with `-C` contains `CREATE DATABASE`, which cannot run inside a transaction block, so do not combine `-1` with `-C` dumps.","`pg_restore` also continues after errors by default and prints a count at the end. `-e` (`--exit-on-error`) stops at the first error; `-1` (`--single-transaction`) wraps everything in one transaction and implies `-e`; `--transaction-size=N` commits every N objects, a compromise that keeps the lock table small on very large restores.","`--single-transaction` and `-j` cannot be used together.","Recent minor releases write `\\restrict` and `\\unrestrict` lines into plain dumps as a safety feature (see `--restrict-key`). An old `psql` that does not know them fails on those lines; load such dumps with an up-to-date `psql`. Such scripts are meant for `psql`, not for other clients."]},
{h:"The three sections of a dump"},
{svg:secSvg},
{p:"Every dump is organised into **pre-data**, **data** and **post-data**. Loading data before creating indexes and constraints is much faster than the reverse, which is why `pg_restore` puts indexes and constraints last and can build several indexes in parallel with `-j`. You can restore the sections separately with `--section`, for example schema first so that you can adjust it, then data."},
{h:"Key pg_restore options"},
{t:[["Option","Meaning","Notes"],["`-d dbname`","Restore directly into this database","Without `-d` a script is produced"],["`-C`, `--create`","Create the database first (with its comment, settings and privileges)","The `-d` database is only used to issue `DROP DATABASE` / `CREATE DATABASE`; data goes to the name stored in the dump"],["`-c`, `--clean` with `--if-exists`","Drop objects before recreating them","Destructive. Use only on purpose"],["`-j N`","N parallel jobs for loading data, building indexes, adding constraints","Custom and directory only; input must be a file or directory, not a pipe"],["`-1`, `-e`, `--transaction-size`","Transaction control and error handling","See above"],["`-l`, `-L list`","Print the table of contents; restore only the listed items","See Restore Practicals"],["`-n`, `-N`, `-t`, `-I`, `-P`, `-T`","Schema include/exclude, table, index, function, trigger","`-t` restores the table **without** its indexes; the pg_restore `-t` takes no wildcards and no schema prefix (combine with `-n`)"],["`-a`, `-s`, `--section`","Data only, schema only, or a named section","Use `--disable-triggers` with `-a` into existing tables that have foreign keys (superuser)"],["`-O`, `-x`, `--no-tablespaces`, `--no-comments`, `--no-policies`","Skip ownership, privileges, tablespace clauses, comments, row-security policies","Handy when the target differs from the source"],["`--role=name`","`SET ROLE` before restoring","Own everything with a chosen role together with `-O`"],["`--no-data-for-failed-tables`","Skip data for tables whose creation failed because they exist already","Avoids duplicating data of extension tables"],["`--strict-names`","Fail if a `-n` or `-t` pattern matches nothing","Protects automation against typos"]]},
{h:"Making a large restore fast"},
{p:"The restore is a bulk load. The levers below come from the PostgreSQL guidance on populating a database; use them on a **dedicated** restore, not on a busy production server, and put the values back afterwards."},
{t:[["Lever","Effect","Caution"],["`pg_restore -j N` (about the number of CPU cores)","Loads tables and builds indexes in parallel","More connections and I/O"],["Raise `maintenance_work_mem` (for example 1-2 GB)","Faster `CREATE INDEX` and constraint checks","Memory per index build, multiplied by `-j`"],["Raise `max_wal_size` and `checkpoint_timeout`","Fewer checkpoints during the load","Needs WAL disk space"],["`wal_level = minimal`, `archive_mode = off`, `max_wal_senders = 0` (restart needed)","Lets some commands skip WAL","Only on a server with no archiving or replication; take a fresh base backup afterwards"],["`--transaction-size=1000` or similar","Smaller lock footprint than `-1` with most of its speed","Implies exit on error"],["Run `ANALYZE` afterwards","The planner needs statistics; dumps often do not carry them","Use `vacuumdb --all --analyze-in-stages` for a quick first pass"]]},
{h:"Verification after a restore"},
{code:`-- objects present?
SELECT n.nspname, count(*) FILTER (WHERE c.relkind='r') AS tables,
       count(*) FILTER (WHERE c.relkind='i') AS indexes
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
GROUP BY 1 ORDER BY 1;

-- planner statistics for the new database
ANALYZE VERBOSE;

-- sequences continue after the highest key? (they are restored with their last value)
SELECT schemaname, sequencename, last_value FROM pg_sequences;`},
{h:"Common restore errors"},
{t:[["Message","Cause","Fix"],["`role \"x\" does not exist`","Roles are not part of `pg_dump`","Restore globals first, or `--no-owner`"],["`database \"newdb\" already exists`","Used `-C` against an existing database, or the dump contains `CREATE DATABASE`","Drop it, restore without `-C`, or use `--clean --create`"],["`relation \"t\" already exists`","Restoring into a non-empty database","Restore into an empty database, or use `--clean --if-exists`"],["`extension \"postgis\" is not available`","Package not installed on the target","Install the extension package, then retry"],["`unsupported version (1.16) in file header`","`pg_restore` is older than the `pg_dump` that wrote the archive","Use the `pg_restore` of the same or newer version"],["`permission denied to create extension` / `must be owner of ...`","The restoring role is not allowed to create the object","Restore as a superuser, or use `--no-owner` and `--role`"],["`input file appears to be a text format dump`","A plain script given to `pg_restore`","Use `psql -f`"],["`errors ignored on restore: N`","Normal `pg_restore` summary after non-fatal errors","Read the errors above it; harmless ones such as the existing bootstrap role can be ignored"]]},
{note:"Practise a full restore of your most important database on a scratch server **before** you need it, and note how long it takes. That time is your real RTO."}],
src:[["pg_restore",D+"app-pgrestore.html"],["psql (non-interactive use)",D+"app-psql.html"],["Restoring the Dump (25.1.1)",D+"backup-dump.html#BACKUP-DUMP-RESTORE"],["Populating a Database",D+"populate.html"],["vacuumdb",D+"app-vacuumdb.html"]]},

/* ---------------------------------------------------------------- 8:4 */
'pg:8:4':{blocks:[
{p:"This lecture is a **lab**. You build a small sample database and then take every kind of logical backup that a DBA needs in practice: a whole database in each format, one table, several tables, one schema, everything except some tables, schema only and data only, with compression and with a naming convention that still makes sense a year later. It ends with a production-style backup script that checks its own work. Run every command yourself on a throw-away server; the next lecture restores what you create here."},
{h:"Lab setup: a sample database"},
{code:`-- as postgres
CREATE ROLE backup_user LOGIN PASSWORD 'change-me';
GRANT pg_read_all_data TO backup_user;
CREATE DATABASE shopdb;

\\c shopdb
CREATE SCHEMA sales;
CREATE SCHEMA hr;

CREATE TABLE sales.customers (
  customer_id serial PRIMARY KEY, name text NOT NULL, city text,
  created_at timestamptz DEFAULT now());
CREATE TABLE sales.orders (
  order_id serial PRIMARY KEY,
  customer_id int REFERENCES sales.customers, order_date date NOT NULL,
  amount numeric(10,2) NOT NULL);
CREATE INDEX orders_date_idx ON sales.orders (order_date);
CREATE TABLE hr.employees (emp_id serial PRIMARY KEY, name text, salary numeric(10,2));
CREATE TABLE public.audit_log (id bigserial PRIMARY KEY, event text, logged_at timestamptz DEFAULT now());

INSERT INTO sales.customers (name, city)
SELECT 'Customer ' || g, (ARRAY['Chennai','Mumbai','Delhi','Pune'])[1 + g % 4]
FROM generate_series(1, 10000) g;
INSERT INTO sales.orders (customer_id, order_date, amount)
SELECT 1 + g % 10000, current_date - (g % 365), round((random() * 500)::numeric, 2)
FROM generate_series(1, 100000) g;
INSERT INTO hr.employees (name, salary)
SELECT 'Employee ' || g, 30000 + g * 10 FROM generate_series(1, 200) g;
INSERT INTO public.audit_log (event) SELECT 'event ' || g FROM generate_series(1, 50000) g;

-- a baseline you will compare against after every restore
SELECT 'customers' t, count(*) FROM sales.customers UNION ALL
SELECT 'orders', count(*) FROM sales.orders UNION ALL
SELECT 'employees', count(*) FROM hr.employees UNION ALL
SELECT 'audit_log', count(*) FROM public.audit_log;`},
{p:"Expected baseline: 10000, 100000, 200 and 50000 rows. Write them down. A directory such as `/backup/logical` owned by `postgres` (mode `0700`) will hold the output."},
{code:`sudo mkdir -p /backup/logical && sudo chown postgres:postgres /backup/logical && sudo chmod 700 /backup/logical`},
{h:"1. A whole database in each format"},
{code:`cd /backup/logical
pg_dump -U backup_user -h localhost -d shopdb -f shopdb_plain.sql                  # plain
pg_dump -U backup_user -h localhost -d shopdb -Fc -f shopdb_custom.dump            # custom
pg_dump -U backup_user -h localhost -d shopdb -Ft -f shopdb_tar.tar                # tar
pg_dump -U backup_user -h localhost -d shopdb -Fd -j 4 -f shopdb_dir               # directory, parallel
ls -lh`},
{p:"Compare the sizes. The plain file is the readable one; the custom and directory archives are compressed; the tar file is the largest archive because tar cannot compress. Look inside the plain file to see what a dump is: a header, `SET` statements, `CREATE SCHEMA`, `CREATE TABLE`, then `COPY ... FROM stdin` with the rows, and finally indexes and constraints."},
{code:`head -n 40 shopdb_plain.sql
grep -n "^COPY\\|^CREATE INDEX\\|^ALTER TABLE ONLY" shopdb_plain.sql | head`},
{h:"2. Choose the content: schema only, data only, one section"},
{t:[["Goal","Command","Result"],["Definitions only (no rows)","`pg_dump -d shopdb -s -f shopdb_schema.sql`","`CREATE` statements, indexes, constraints, privileges"],["Rows only (no definitions)","`pg_dump -d shopdb -a -Fc -f shopdb_data.dump`","Data, large objects and sequence values"],["Only the data section, by name","`pg_dump -d shopdb --section=data -Fc -f d.dump`","Table data (close to, not identical to, `-a`)"],["Without comments, privileges and ownership","`pg_dump -d shopdb --no-comments -x -O -f portable.sql`","A script that any role can load and will own"]]},
{h:"3. Select objects: tables and schemas"},
{code:`# one table (schema-qualified)
pg_dump -d shopdb -t sales.orders -Fc -f sales_orders.dump

# several tables, by repeating -t or by wildcard (quote the pattern!)
pg_dump -d shopdb -t sales.customers -t sales.orders -Fc -f sales_two_tables.dump
pg_dump -d shopdb -t 'sales.*' -Fc -f sales_all_tables.dump

# one schema, with everything inside it
pg_dump -d shopdb -n sales -Fc -f schema_sales.dump

# two schemas
pg_dump -d shopdb -n sales -n hr -Fc -f sales_hr.dump

# everything EXCEPT a schema or a table
pg_dump -d shopdb -N hr -Fc -f shopdb_without_hr.dump
pg_dump -d shopdb -T public.audit_log -Fc -f shopdb_without_audit.dump

# keep the table definition but skip its rows (huge log or staging tables)
pg_dump -d shopdb --exclude-table-data=public.audit_log -Fc -f shopdb_audit_empty.dump

# a mixed-case name needs double quotes, which the shell must pass through
pg_dump -d shopdb -t "\\"MixedCase\\"" -f mixed.sql

# fail loudly if a pattern matches nothing (protects scripts from typos)
pg_dump -d shopdb -t 'sales.ordres' --strict-names -f /dev/null`},
{ul:["`-t` and `-n` dump only what you select. The documentation notes that **dependencies are not followed**: a table dump does not include the types, functions or other tables it depends on, so a restore into an empty database may fail. Use `-n` (a whole schema) for self-contained pieces.","`-t` also dumps the table's indexes, constraints and triggers, and matches views, materialized views, foreign tables and sequences, but not the contents of views.","`-n` and `-N` do not apply when `-t` is used.","Large objects are not part of a `-n` or `-t` dump unless you add `-b` (`--large-objects`).","For long lists of patterns use a **filter file**: `pg_dump --filter=filter.txt`, with lines such as `include table sales.*` and `exclude table_data public.audit_log`."]},
{h:"4. Compression and speed"},
{code:`pg_dump -d shopdb -Fc -Z gzip:6 -f shopdb_gzip6.dump
pg_dump -d shopdb -Fc -Z lz4    -f shopdb_lz4.dump       # needs lz4 support
pg_dump -d shopdb -Fc -Z zstd:5 -f shopdb_zstd5.dump     # needs zstd support
pg_dump -d shopdb -Fc -Z none   -f shopdb_none.dump
pg_dump -d shopdb -Fd -j 4 -Z zstd:3 -f shopdb_dir_zstd
time pg_dump -d shopdb -Fd -j 1 -f /tmp/t1 ; time pg_dump -d shopdb -Fd -j 4 -f /tmp/t4`},
{p:"On a database this small the difference between `-j 1` and `-j 4` is minor. On a database of hundreds of gigabytes with several large tables it is large, but only tables are parallelised: one gigantic table is still dumped by a single worker."},
{h:"5. A naming convention that scales"},
{t:[["Element","Example","Why"],["Database or scope","`shopdb`, `cluster_globals`","Tells you what it is without opening it"],["Timestamp, sortable","`20261008_023000`","Lexical order equals time order"],["Type","`full`, `schema`, `data`, `tbl_sales_orders`","Distinguishes purpose"],["Server or environment","`prod01`","Avoids restoring a test dump on production by mistake"],["Extension by format","`.sql`, `.dump`, `_dir/`, `.tar`","Tells you which restore tool to use"]]},
{code:`TS=$(date +%Y%m%d_%H%M%S)
pg_dump -d shopdb -Fc -f /backup/logical/prod01_shopdb_\${TS}_full.dump
# result: prod01_shopdb_20261008_023000_full.dump`},
{h:"6. A production-style script"},
{p:"The script below dumps the global objects and one database, verifies that the archive can be read, records a checksum, and applies a retention rule. It stops on the first error (`set -euo pipefail`) and writes a log. Adapt the paths and add your alerting."},
{code:`#!/bin/bash
# /usr/local/bin/nightly_dump.sh : logical backup with verification and retention
set -euo pipefail

DB=shopdb
BACKUP_DIR=/backup/logical
KEEP_DAYS=14
TS=$(date +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/prod01_\${DB}_\${TS}_full.dump"
LOG="$BACKUP_DIR/prod01_\${DB}_\${TS}.log"
export PGHOST=/var/run/postgresql PGUSER=backup_user     # password from ~/.pgpass or peer

exec >>"$LOG" 2>&1
echo "[$(date -Is)] start $DB"

# 1. the dump (fail instead of waiting forever for locks)
pg_dump -d "$DB" -Fc -Z zstd:5 --lock-wait-timeout=60000 -f "$OUT"

# 2. can the archive be read back?
pg_restore -l "$OUT" > /dev/null

# 3. checksum for later integrity checks and off-site copy
sha256sum "$OUT" > "$OUT.sha256"

# 4. retention: remove old dumps, logs and checksums
find "$BACKUP_DIR" -type f \\( -name "*.dump" -o -name "*.sha256" -o -name "*.log" \\) -mtime +"$KEEP_DAYS" -delete

echo "[$(date -Is)] done $(du -h "$OUT" | cut -f1)"`},
{code:`# schedule it (crontab -e as postgres): every night at 02:30
30 2 * * * /usr/local/bin/nightly_dump.sh || echo "shopdb backup FAILED" | mail -s "backup failure" dba@example.com`},
{h:"7. Verify before you trust"},
{code:`# 1. the files exist and are plausible
ls -lh /backup/logical
sha256sum -c /backup/logical/*.sha256

# 2. the archive table of contents is readable and complete
pg_restore -l shopdb_custom.dump | head -n 30
pg_restore -l shopdb_custom.dump | grep -c "TABLE DATA"       # one entry per table

# 3. the plain script has no obvious problems
grep -c "^COPY" shopdb_plain.sql`},
{note:"A readable table of contents proves the file is not truncated. It does not prove the data loads. The next lecture restores these files and compares row counts with your baseline."}],
src:[["pg_dump (examples and filter files)",D+"app-pgdump.html#PG-DUMP-EXAMPLES"],["pg_restore (-l listing)",D+"app-pgrestore.html"],["25.1 SQL Dump (large databases)",D+"backup-dump.html"]]},

/* ---------------------------------------------------------------- 8:5 */
'pg:8:5':{blocks:[
{p:"This lab restores the backups made in Backup Practicals, using `psql` for the plain file and `pg_restore` for the custom, tar and directory archives. It then goes beyond a full restore: one table, only the data, only the schema, a hand-edited item list, a script generated without any database, and the case that matters most in real life, getting one damaged table back without disturbing the rest of production. Every scenario ends with a check against the baseline row counts (10000, 100000, 200, 50000)."},
{h:"Scenario A: plain script into a new database"},
{code:`createdb -T template0 shop_a
psql -X -v ON_ERROR_STOP=1 -d shop_a -f /backup/logical/shopdb_plain.sql
psql -d shop_a -c "SELECT count(*) FROM sales.orders;"      # 100000`},
{h:"Scenario B: custom, tar and directory archives"},
{code:`createdb -T template0 shop_b
pg_restore -d shop_b -v /backup/logical/shopdb_custom.dump

createdb -T template0 shop_c
pg_restore -d shop_c /backup/logical/shopdb_tar.tar

createdb -T template0 shop_d
pg_restore -d shop_d -j 4 /backup/logical/shopdb_dir      # parallel`},
{p:"The format is detected automatically; you do not need `-F`. With `-v` you see each object as it is created, which is the quickest way to find the slow step."},
{h:"Scenario C: drop and recreate the database from the archive"},
{code:`# connects to 'postgres' only to issue DROP DATABASE shopdb / CREATE DATABASE shopdb,
# then loads into the database NAMED IN THE DUMP
pg_restore -C --clean --if-exists -d postgres /backup/logical/shopdb_custom.dump`},
{note:"This **drops the live database of that name**. Make sure nobody is connected (`SELECT pg_terminate_backend(pid) ...`, Section 05) and that you really intend to replace it."},
{h:"Scenario D: only one table"},
{code:`createdb -T template0 shop_e
# schema first, so that the schema, types and sequences exist
pg_restore -d shop_e --schema-only /backup/logical/shopdb_custom.dump
# then one table's rows (disable triggers so foreign keys do not block the load; needs superuser)
pg_restore -d shop_e --data-only --disable-triggers -n sales -t orders /backup/logical/shopdb_custom.dump
psql -d shop_e -c "SELECT count(*) FROM sales.orders;"`},
{p:"`pg_restore -t` restores the named table but, unlike `pg_dump -t`, **not** its indexes, constraints or triggers, and it accepts no wildcards or schema prefix (use `-n` for the schema). To get one table complete with its indexes and constraints, use a list file (Scenario F)."},
{h:"Scenario E: schema only, then data, in two steps"},
{code:`createdb -T template0 shop_f
pg_restore -d shop_f --section=pre-data /backup/logical/shopdb_custom.dump
pg_restore -d shop_f --section=data     /backup/logical/shopdb_custom.dump
pg_restore -d shop_f --section=post-data /backup/logical/shopdb_custom.dump`},
{p:"Splitting by section lets you stop after `pre-data` to change something (add a partition, change a tablespace) before the data is loaded, and build the indexes last."},
{h:"Scenario F: choose items with a list file"},
{svg:listSvg},
{code:`pg_restore -l /backup/logical/shopdb_custom.dump > shopdb.list
head -n 30 shopdb.list`},
{p:"Each line is one object: its archive ID, type, name and owner. A semicolon at the start turns a line into a comment. The excerpt below keeps the schema, the table, its data and its index, and skips everything else."},
{code:`; shopdb.list (edited)
10; 2615 16390 SCHEMA - sales postgres
212; 1259 16391 TABLE sales orders postgres
3401; 0 16391 TABLE DATA sales orders postgres
; 3402; 0 16395 TABLE DATA sales customers postgres      <- skipped
3120; 1259 16398 INDEX sales orders_date_idx postgres
3150; 2606 16394 CONSTRAINT sales orders orders_pkey postgres`},
{code:`createdb -T template0 shop_g
pg_restore -d shop_g -L shopdb.list /backup/logical/shopdb_custom.dump`},
{p:"`-L` restores only the listed items **in the order they appear in the file**, so you can also reorder. Numbers and sizes above are illustrative; yours will differ. The foreign key to `customers` is not in the list, so it is not created; add its `FK CONSTRAINT` line if you need it."},
{h:"Scenario G: produce a script without any database"},
{code:`pg_restore -f review.sql /backup/logical/shopdb_custom.dump        # whole archive as SQL
pg_restore -f one_table.sql -n sales -t orders /backup/logical/shopdb_custom.dump
less review.sql                                                     # review, edit, then run with psql`},
{h:"Scenario H: restore with a different owner or without privileges"},
{code:`# objects owned by the restoring role instead of the original roles
pg_restore -d shop_h --no-owner --no-privileges /backup/logical/shopdb_custom.dump
# or switch to a specific owner role first
pg_restore -d shop_h --no-owner --role=app_owner /backup/logical/shopdb_custom.dump`},
{h:"Scenario I: rescue one damaged table (the common real case)"},
{p:"Someone ran `DELETE FROM sales.orders` without a `WHERE` at 10:15 and the nightly dump is from 02:30. You do not want to replace the whole database. Restore **into a scratch database** and copy back only what is missing."},
{flow:["Restore the dump into a scratch database","Compare with production","Copy the missing rows back in a transaction","Check counts and constraints","Drop the scratch database"]},
{code:`createdb -T template0 rescue
pg_restore -d rescue -n sales -t orders --data-only /backup/logical/shopdb_custom.dump   # after schema-only restore as in Scenario D

# in production, copy rows that no longer exist (postgres_fdw or dblink, or COPY through a file)
psql -d rescue -c "COPY (SELECT * FROM sales.orders) TO '/tmp/orders_0230.csv' CSV"
psql -d shopdb -c "BEGIN; CREATE TEMP TABLE o_old (LIKE sales.orders); COPY o_old FROM '/tmp/orders_0230.csv' CSV; INSERT INTO sales.orders SELECT * FROM o_old ON CONFLICT DO NOTHING; COMMIT;"`},
{p:"The dump only knows the state at 02:30. Changes made between 02:30 and 10:15 are not in it. To lose nothing, use point-in-time recovery (the PITR lecture) and recover to 10:14 in a scratch instance."},
{h:"Verifying every restore"},
{code:`-- exact row counts of every user table (not the approximate n_live_tup)
SELECT table_schema, table_name,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS row_count
FROM information_schema.tables
WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY 1, 2;

# compare structure of source and restored database
pg_dump -s -d shopdb  | grep -v '^--' > /tmp/src_schema.sql
pg_dump -s -d shop_b  | grep -v '^--' > /tmp/new_schema.sql
diff /tmp/src_schema.sql /tmp/new_schema.sql && echo "schemas identical"`},
{h:"Troubleshooting the practicals"},
{t:[["Symptom","Cause","Fix"],["Restore finishes with `errors ignored on restore: 1`","Often `role ... does not exist` or an existing object","Read the first error; use `--no-owner` or create the role"],["`pg_restore -t orders` created the table with no index","`-t` does not restore subsidiary objects","Use a list file, or restore `--section=post-data` afterwards"],["`-j` restore of a plain file","Not supported","Plain scripts run in one session; use an archive format"],["`COPY ... permission denied` for `/tmp/orders_0230.csv`","Server-side `COPY` reads and writes as the server OS user","Use `\\copy` in `psql` (client side) or put the file where the server may read it"],["Foreign key errors on `--data-only`","Parent rows are not loaded yet","Load in the right order, use `--disable-triggers` as superuser, or restore without `-a`"]]}],
src:[["pg_restore",D+"app-pgrestore.html"],["pg_restore (examples: -l and -L)",D+"app-pgrestore.html#APP-PGRESTORE-EXAMPLES"],["psql",D+"app-psql.html"]]},

/* ---------------------------------------------------------------- 8:6 */
'pg:8:6':{blocks:[
{p:"`pg_dumpall` writes **all databases of a cluster, together with the global objects, into one SQL script**. It does this by first dumping the global objects and then calling `pg_dump` once for every database. The global objects are exactly what `pg_dump` cannot save: **roles** (with their attributes, memberships and password hashes), **tablespace definitions**, and the privilege grants on configuration parameters. In PostgreSQL 18 the output is a plain SQL script written to standard output (or to a file with `-f`), to be fed to `psql`. Because it needs to read every table of every database, you normally run it as a superuser."},
{svg:allSvg},
{h:"What the script contains, in order"},
{flow:["Role definitions: CREATE ROLE, ALTER ROLE, memberships","Tablespace definitions: CREATE TABLESPACE ... LOCATION","Per-role and per-database settings","For each database: CREATE DATABASE, connect, objects and data","Privileges"]},
{h:"Options"},
{t:[["Option","Meaning","Notes"],["`-g`, `--globals-only`","Dump roles and tablespaces only, no databases","Small, fast, and the right companion of per-database `pg_dump`"],["`-r`, `--roles-only`","Dump roles only","Handy when moving users to a new cluster"],["`-t`, `--tablespaces-only`","Dump tablespaces only","Note: `-t` means tablespaces here, not tables as in `pg_dump`"],["`-f file`","Write to a file","Otherwise standard output"],["`-l dbname`, `--database`","Database used for the first connection, where globals are read and the database list is discovered","Default `postgres`, then `template1`"],["`--exclude-database=pattern`, `--filter=file`","Skip databases by pattern","Skip a huge staging database, for instance"],["`-c`, `--clean`, with `--if-exists`","Drop databases, roles and tablespaces before recreating them","Restore the script while connected to `postgres`"],["`--no-role-passwords`","Do not dump password hashes; roles get a null password","Use when moving to a less trusted place; also works when `pg_authid` cannot be read"],["`-s`, `-a`","Schema only, data only","As in `pg_dump`"],["`-O`, `-x`, `--no-tablespaces`, `--no-comments`","Skip ownership, privileges, tablespace commands, comments","As in `pg_dump`"],["`--quote-all-identifiers`","Quote every identifier","Recommended when the target is a different major version"],["`-h`, `-p`, `-U`, `-w`, `-W`, `-d connstr`, `--role`","Connection options","The database name inside a connection string is ignored; use `-l`"],["`--statistics`, `--no-statistics`","Include or skip optimizer statistics","Run `ANALYZE` after the restore either way"],["`-v`","Progress and times","Also passed to `pg_dump`"]]},
{note:"`pg_dumpall` connects once per database and, if the server uses password authentication, asks for the password **each time**. Use `~/.pgpass`, peer authentication or `-w` with a password file in unattended jobs."},
{h:"Basic use"},
{code:`# the whole cluster, to a file
pg_dumpall -U postgres -f /backup/cluster_20261008.sql

# only roles and tablespaces (small; take it every day)
pg_dumpall -U postgres --globals-only -f /backup/globals_20261008.sql

# only roles, without password hashes
pg_dumpall -U postgres --roles-only --no-role-passwords -f /backup/roles_nopw.sql

# everything except one database
pg_dumpall -U postgres --exclude-database=staging -f /backup/cluster_no_staging.sql

# restore: connect to any database; the script creates and connects to the others
psql -X -U postgres -d postgres -f /backup/cluster_20261008.sql 2> restore_errors.log`},
{h:"Restore notes from the documentation"},
{ul:["Expect **errors that are harmless**: the script issues `CREATE ROLE` for every role, so the bootstrap superuser (usually `postgres`) reports that it already exists, unless the new cluster was initialised with a different superuser name.","`pg_dumpall` needs the **tablespace directories to exist** before the restore. Otherwise databases in non-default locations cannot be created (Section 08).","With `--clean`, the script drops the other databases right away, which fails for the database you are connected to. Connect to `postgres` first. `--clean` also lets the script recreate `postgres` and `template1` with the same properties (locale, encoding) as the source.","Use `psql -X` to ignore a personal `.psqlrc`. The script contains `psql` meta-commands, so it may not work with other clients."]},
{h:"The recommended production pattern: globals plus per-database dumps"},
{p:"A single `pg_dumpall` file has no parallelism, cannot restore one database without restoring everything, and cannot be inspected with `pg_restore -l`. For anything but small clusters, combine the two tools: dump the **globals** with `pg_dumpall -g` and every database with `pg_dump` in an archive format."},
{t:[["Approach","Pros","Cons","Choose when"],["`pg_dumpall` alone","One command, one file; simplest to understand","Text only, serial, no selective restore, large file","Small clusters, quick migrations, dev environments"],["`pg_dumpall -g` + `pg_dump -Fc` per database","Selective and parallel restore, per-database retention, compressed","Needs a small script","Production: the standard logical backup"],["`pg_dumpall -g` + `pg_dump -Fd -j` per database","Fastest on large databases","More files to manage","Large databases and short backup windows"]]},
{code:`#!/bin/bash
# /usr/local/bin/cluster_logical_backup.sh
set -euo pipefail
OUT=/backup/logical/$(date +%Y%m%d_%H%M%S)
mkdir -p "$OUT"
export PGUSER=postgres PGHOST=/var/run/postgresql

# 1. roles, tablespace definitions, role settings
pg_dumpall --globals-only -f "$OUT/globals.sql"

# 2. every connectable, non-template database, one archive each
for DB in $(psql -Atc "SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate"); do
  pg_dump -d "$DB" -Fc -Z zstd:5 -f "$OUT/$DB.dump"
done

# 3. restrict permissions: the globals file contains password hashes
chmod -R go-rwx "$OUT"
sha256sum "$OUT"/* > "$OUT/SHA256SUMS"`},
{code:`# restore on a new cluster
psql -X -d postgres -f globals.sql                       # roles and tablespaces first
createdb -T template0 -O shop_owner shopdb
pg_restore -d shopdb -j 4 shopdb.dump`},
{h:"Security of the output"},
{ul:["The globals contain **password hashes** (SCRAM verifiers or, on old clusters, MD5 hashes). Treat the file like a secret: mode `0600`, encrypted if it leaves the server.","Restoring runs arbitrary SQL as a superuser. Do not load a `pg_dumpall` file from an untrusted source without reading it.","`--no-role-passwords` removes the hashes; the restored roles then cannot log in with a password until you set one."]},
{h:"What pg_dumpall is good for"},
{t:[["Use","Why `pg_dumpall` fits"],["Moving a whole cluster to a new server or a newer major version","Brings databases, roles and tablespace definitions together (an alternative to `pg_upgrade`, Section 10)"],["Refreshing a development or test cluster from production","Simple and complete (consider `--no-role-passwords`)"],["A daily copy of roles and tablespaces (`-g`)","Tiny, and it is the only logical record of who the users were"],["Not suitable: point-in-time recovery, very large clusters, selective restore","Use physical backups and per-database archives"]]},
{note:"A dump made with `pg_dumpall` never contains the files of a tablespace, only the `CREATE TABLESPACE` command. Section 08 explains why a restore needs the directories in place."}],
src:[["pg_dumpall",D+"app-pg-dumpall.html"],["pg_dump",D+"app-pgdump.html"],["The Password File",D+"libpq-pgpass.html"]]},

/* ---------------------------------------------------------------- 8:7 */
'pg:8:7':{blocks:[
{p:"**`pg_basebackup`** takes a **base backup** of a running PostgreSQL cluster. The documentation describes it as a backup that does not affect other clients of the database and that can be used both for **point-in-time recovery** and as the starting point of a **log-shipping or streaming-replication standby**. It makes an exact copy of the cluster's files (a full backup) or, since PostgreSQL 17, a smaller copy that contains only the blocks changed since an earlier backup (an incremental backup). It puts the server in and out of backup mode automatically, and the backup is made over a normal connection that speaks the **replication protocol**. Backups are always of the **entire cluster**; individual databases or tables cannot be selected. For that, use `pg_dump`."},
{h:"Prerequisites on the server"},
{t:[["Requirement","Setting or object","Default"],["A role allowed to run replication","`CREATE ROLE repl_backup LOGIN REPLICATION PASSWORD '...'` (or a superuser)","none"],["`pg_hba.conf` must allow a **replication** connection","`host replication repl_backup 10.0.0.20/32 scram-sha-256`. The word `replication` is a keyword for the database column; `all` does not match it","none"],["Enough WAL senders","`max_wal_senders`: at least 1 for the backup plus 1 more for `-X stream`","10"],["`wal_level` of `replica` or higher","`SHOW wal_level;`","`replica`"],["WAL kept for `-X fetch`","`wal_keep_size` large enough to cover the backup duration (not needed for `-X stream`)","0"],["For a PITR-capable backup","WAL archiving enabled and working (`archive_mode`, `archive_command`)","off"]]},
{code:`-- on the server
CREATE ROLE repl_backup LOGIN REPLICATION PASSWORD 'change-me';

# pg_hba.conf  (then: SELECT pg_reload_conf();)
host  replication  repl_backup  10.0.0.20/32  scram-sha-256

# from the backup host, test that the replication login works
pg_isready -h db1 -p 5432
psql "host=db1 user=repl_backup replication=true dbname=postgres" -c "IDENTIFY_SYSTEM;"`},
{h:"How a base backup runs"},
{svg:pbSvg},
{p:"The checkpoint at the start fixes the point from which WAL must be replayed. By default the checkpoint is **spread** over `checkpoint_completion_target` so that the backup does not hammer the disks; `--checkpoint=fast` requests an immediate checkpoint when you are in a hurry. While the backup runs, `pg_basebackup` seems idle until that checkpoint finishes. Full-page writes are effectively forced on during backup mode, so WAL volume rises a little."},
{h:"Output formats"},
{t:[["","Plain (`-Fp`, default)","Tar (`-Ft`)"],["Result","A copy with the **same layout** as the source data directory","`base.tar` (data directory), `pg_wal.tar` (streamed WAL), one `<tablespace OID>.tar` per extra tablespace"],["Tablespaces","Written to the **same absolute path** as on the source unless remapped with `-T old=new`. On the same host as the server this fails unless you remap","Each in its own tar; the symbolic links are re-created from `tablespace_map` when restored"],["Compression","Only server-side (`--compress=server-gzip` etc.)","Client side or server side: gzip, lz4, zstd"],["Standard output","Not possible","`-D -` is allowed if there are no extra tablespaces and no WAL streaming"],["Restore step","Point `PGDATA` at the directory, adjust permissions","Unpack each tar into the right place first"]]},
{h:"Including the WAL: the -X (--wal-method) option"},
{t:[["Method","What happens","Needs","Use"],["`stream` (default)","WAL is streamed on a **second connection** while the data is copied","2 walsenders; a temporary replication slot is created automatically, so the server cannot recycle WAL the backup still needs","Normal choice: the backup is **self-contained** and starts without an archive"],["`fetch`","The WAL files are collected **at the end** of the backup","`wal_keep_size` large enough, or the backup fails and is unusable","When only one connection is available"],["`none`","No WAL in the backup","A working WAL archive and `restore_command` at restore time","PITR setups that archive WAL anyway; you must wait for the last segment to be archived"]]},
{h:"Option reference"},
{t:[["Option","Meaning"],["`-D dir`, `--pgdata`","Target directory (required); created if missing, must be empty if it exists"],["`-F p|t`","Format: plain or tar"],["`-X n|f|s`","WAL method (see above)"],["`-z`, `-Z spec`, `--compress=[client|server]-method[:detail]`","Compression of tar output or server-side transfer: `gzip`, `lz4`, `zstd`, with `level`, `long`, `workers` keywords"],["`-c fast|spread`, `--checkpoint`","How hard to checkpoint at the start"],["`-C`, `-S slot`","Create (`-C`) and use a **permanent replication slot** for WAL streaming; use the same name as `primary_slot_name` on a standby so the primary keeps WAL until streaming starts"],["`--no-slot`","Do not create the temporary slot (when no free slot exists). Almost always worse"],["`-R`, `--write-recovery-conf`","Create `standby.signal` and put connection settings in `postgresql.auto.conf`: a ready-to-start standby (Section 10)"],["`-T old=new`","Relocate a tablespace (plain format)"],["`--waldir=dir`","Put the WAL somewhere else (plain format)"],["`-r rate`, `--max-rate`","Throttle transfer, for example `-r 50M` (32 kB/s to 1024 MB/s)"],["`-P`, `-v`","Progress and verbose output"],["`-l label`","Label stored in `backup_label` (default `pg_basebackup base backup`)"],["`--manifest-checksums=alg`, `--no-manifest`","Manifest checksum algorithm (`NONE`, `CRC32C` default, `SHA224`, `SHA256`, `SHA384`, `SHA512`) or no manifest"],["`--no-verify-checksums`","Do not verify data page checksums while copying (verified by default if checksums are on)"],["`-i manifest`, `--incremental`","Incremental backup relative to an earlier backup (PostgreSQL 17+; see the incremental lecture)"],["`-t server:/path`, `--target`","Store the backup on the **server** (needs `pg_write_server_files`); `blackhole` discards it for tests. Requires `-Xfetch` or `-Xnone`"],["`-N`, `--no-sync`","Return without fsync: tests only"],["`-d connstr`, `-h`, `-p`, `-U`, `-w`, `-W`, `-s interval`","Connection options as for other tools"]]},
{h:"Taking backups"},
{code:`# plain format, WAL streamed, progress shown
pg_basebackup -h db1 -U repl_backup -D /backup/base/20261008 -Fp -Xs -P -c fast

# one gzip-compressed tar per tablespace, WAL included
pg_basebackup -h db1 -U repl_backup -D /backup/base/20261008_tar -Ft -z -P

# zstd compression on the server with 4 workers (the streamed pg_wal.tar stays uncompressed)
pg_basebackup -h db1 -U repl_backup -D /backup/base/20261008_zstd -Ft --compress=server-zstd:workers=4 -P

# relocate a tablespace while copying (plain format)
pg_basebackup -h db1 -U repl_backup -D /backup/base/restore_test -T /pgdata/ts_fast=/backup/base/restore_test_ts

# throttle to protect production, with a permanent slot
pg_basebackup -h db1 -U repl_backup -D /backup/base/20261008_slot -C -S backup_slot -r 100M -P`},
{h:"Watching a backup"},
{code:`-- on the server while the backup runs (needs pg_monitor or superuser)
SELECT pid, phase, pg_size_pretty(backup_total) AS total, pg_size_pretty(backup_streamed) AS streamed,
       tablespaces_total, tablespaces_streamed
FROM pg_stat_progress_basebackup;
-- phases: initializing, waiting for checkpoint to finish, estimating backup size,
--         streaming database files, waiting for wal archiving to finish, transferring wal files`},
{h:"What is inside the backup directory"},
{t:[["File","Meaning"],["`backup_label`","Names the checkpoint WAL replay must start from, the start time and the label. **Vital:** never delete it from a restored backup"],["`backup_manifest`","JSON list of every file with size, modification time and checksum, plus WAL ranges; used by `pg_verifybackup` and incremental backups"],["`tablespace_map`","Maps tablespace OIDs to their original paths (used by tar-format restores)"],["`pg_wal/` or `pg_wal.tar`","The WAL collected during the backup (`-X stream` or `fetch`)"],["`standby.signal`, `postgresql.auto.conf` entries","Only with `-R`"]]},
{h:"Restoring a stand-alone backup (WAL included)"},
{code:`# 1. stop the server and move the damaged cluster aside (keep it until recovery is proven)
sudo systemctl stop postgresql-18
sudo mv /var/lib/pgsql/18/data /var/lib/pgsql/18/data.broken

# 2a. plain format: copy back
sudo cp -a /backup/base/20261008 /var/lib/pgsql/18/data
# 2b. tar format: unpack each file
sudo mkdir /var/lib/pgsql/18/data
sudo tar -xf /backup/base/20261008_tar/base.tar -C /var/lib/pgsql/18/data
sudo tar -xf /backup/base/20261008_tar/pg_wal.tar -C /var/lib/pgsql/18/data/pg_wal

# 3. ownership and permissions: the postgres OS user, mode 0700
sudo chown -R postgres:postgres /var/lib/pgsql/18/data
sudo chmod 700 /var/lib/pgsql/18/data

# 4. start: the server reads backup_label, replays the included WAL, then opens
sudo systemctl start postgresql-18
sudo -u postgres psql -c "SELECT pg_is_in_recovery();"   # f when done`},
{p:"If the backup was taken with `-X none`, there is no WAL inside. The restore then needs `restore_command` pointing at the WAL archive and an empty `recovery.signal` file in the data directory. That is point-in-time recovery, covered in the PITR lecture."},
{h:"Limits and cautions"},
{ul:["**Whole cluster only.** There is no per-database or per-table selection.","**Version.** `pg_basebackup` works with servers of the same or older major version (down to 9.1). Incremental backup needs a 17+ server. A base backup restores only to the **same major version** and a compatible platform.","**From a standby** it works, with limits: no backup history file is created in the backed-up cluster, a promotion during the backup makes it fail, `full_page_writes` must be on at the primary, and with `-X none` you may need `pg_switch_wal()` on the primary to push out the last segment.","**A permanent slot (-C -S) outlives the backup.** If it is not used by a standby afterwards, the primary keeps retaining WAL for it until the disk fills. Drop it with `SELECT pg_drop_replication_slot('backup_slot');` (the temporary slot of the default `-X stream` disappears by itself).","**Only one at a time** is usually better: several in parallel compete for I/O. Take one and copy the result.","**Checksum errors** reported during the copy mean real corruption in a data file; the backup is kept for inspection. Do not ignore them."]},
{h:"Verify the backup"},
{code:`pg_verifybackup /backup/base/20261008                     # manifest, file sizes, checksums, WAL records
pg_controldata /backup/base/20261008 | grep -i "checkpoint location\\|cluster state"`},
{p:"`pg_verifybackup` is not a replacement for a test restore. The only complete proof is starting a server from the backup, on another host or port, and querying it (see the verification lecture)."},
{h:"Logical or physical: combining them"},
{t:[["Layer","Tool","Frequency","Protects against"],["Physical base backup + WAL archive","`pg_basebackup`, archive","Weekly (full), daily (incremental), WAL continuous","Server or disk loss, any-moment recovery"],["Logical archives per database","`pg_dump -Fc/-Fd`","Daily","A dropped table or schema, cross-version moves, selective restore"],["Globals","`pg_dumpall -g`","Daily","Loss of roles and tablespace definitions"],["Config files","Copy of `postgresql.conf`, `pg_hba.conf`, `pg_ident.conf`","On change","Configuration loss (not stored in WAL)"]]},
{note:"Next in this section: the bonus lectures on strategy, file-system-level backups, WAL archiving, point-in-time recovery, incremental backups and the disaster-recovery runbook turn this base backup into a complete, tested recovery plan."}],
src:[["pg_basebackup",D+"app-pgbasebackup.html"],["25.3 Continuous Archiving and PITR",D+"continuous-archiving.html"],["Base Backup Progress Reporting",D+"progress-reporting.html#BASEBACKUP-PROGRESS-REPORTING"],["pg_verifybackup",D+"app-pgverifybackup.html"],["Streaming Replication Protocol",D+"protocol-replication.html"]]},

/* ---------------------------------------------------------------- 8:8 */
'pg:8:8':{blocks:[
{p:"Tools do not make a backup strategy. A strategy answers four questions: **how much data may we lose** (RPO), **how long may we be down** (RTO), **how many copies, where, for how long**, and **how do we know it works**. This lecture turns the tools of the previous lectures into a plan, with sizing arithmetic, an automation script, monitoring and the security measures that backups need as much as the database does."},
{h:"Recovery objectives"},
{t:[["Term","Question it answers","Determined by","Example"],["**RPO** Recovery Point Objective","How much recent data can we afford to lose?","Backup frequency and, for PITR, how fast WAL reaches safe storage","Nightly dump: up to 24 h. WAL archiving with `archive_timeout = 60`: about 1 minute. Synchronous replication: about 0"],["**RTO** Recovery Time Objective","How long can the service be unavailable?","Restore speed: data volume, disk and network throughput, WAL to replay, automation","1 TB base backup restored at 400 MB/s is about 45 minutes plus WAL replay"],["**Retention**","How far back must we be able to go?","Business, legal and audit rules; how long a logical error can stay undetected","Daily for 14 days, weekly for 8 weeks, monthly for 12 months"]]},
{svg:planSvg},
{h:"Match the technique to the objective"},
{t:[["RPO target","Technique","Section"],["24 hours","Nightly `pg_dump` and `pg_dumpall -g`","This section"],["Minutes","Base backups plus **continuous WAL archiving**","Archiving and PITR lectures"],["Seconds to zero","Synchronous streaming replication **and** backups","Section 10"],["Protection against an operator error that is replicated at once","Backups with PITR, optionally a **delayed standby** (`recovery_min_apply_delay`)","PITR lecture, Section 10"]]},
{note:"**Replication is not a backup.** A standby faithfully copies a `DROP TABLE` or a corrupted page within seconds. Replication protects against hardware loss; backups protect against everything else."},
{h:"The 3-2-1 rule (and its modern extension)"},
{t:[["Rule","Meaning in PostgreSQL terms"],["**3** copies","Production data plus at least two backups"],["**2** different media or systems","For example local disk plus object storage, or two storage arrays"],["**1** copy off-site","In another site, region or cloud account, so that a site loss or a compromised account cannot destroy every copy"],["**1** copy immutable or offline","Object lock, WORM storage or tape: ransomware or a mistaken script cannot delete it"],["**0** errors","Backups are verified; a failed verification is an alarm"]]},
{h:"Backup layers in a typical production design"},
{t:[["Layer","Method","Frequency","Keeps","Restores"],["Physical full","`pg_basebackup` (or a tool)","Weekly","4 weeks","Whole cluster, base for PITR"],["Physical incremental","`pg_basebackup --incremental` (17+)","Daily","1 week","Shorter backup window"],["WAL archive","`archive_command`","Continuous","Back to the oldest kept base backup","Any moment since a base backup"],["Logical per database","`pg_dump -Fd` or `-Fc`","Daily","14 days","One table, schema or database; version moves"],["Globals","`pg_dumpall -g`","Daily","30 days","Roles and tablespace definitions"],["Configuration","Copy of `postgresql.conf`, `pg_hba.conf`, `pg_ident.conf`, service files","On every change (version control)","Forever","Server settings, which WAL does not contain"]]},
{h:"Sizing the backup storage"},
{code:`-- 1. database sizes (logical dumps are usually a fraction of this; physical is about this size)
SELECT pg_size_pretty(sum(pg_database_size(datname))) FROM pg_database;

-- 2. WAL volume per day: record the LSN at two points in time, then subtract
SELECT pg_current_wal_lsn();                                   -- at 09:00, e.g. 5/A1000000
SELECT pg_size_pretty(pg_wal_lsn_diff('5/D8000000', '5/A1000000')) AS wal_between_the_two;

-- 3. archive volume actually produced (cumulative counters)
SELECT archived_count, last_archived_wal, last_archived_time FROM pg_stat_archiver;`},
{t:[["Component","Formula (rough)"],["Physical full backups","size of cluster x number of fulls kept (less with compression)"],["Incrementals","changed data per day x days kept"],["WAL archive","WAL per day x days of retention (WAL for the oldest kept base backup must be kept)"],["Logical dumps","compressed dump size x copies kept"],["Headroom","Add 30-50% for growth, for a restore test copy and for bursts"]]},
{p:"The WAL volume depends on write activity and on **full-page writes** after each checkpoint (Section 08). Raising `max_wal_size` and `checkpoint_timeout` lowers it, and `wal_compression` shrinks it further at some CPU cost."},
{h:"Retention rules that actually work"},
{ul:["A base backup can only be recovered with **all WAL from its start onward**. Never delete WAL that a retained base backup still needs. The backup history file (`*.backup`) names the first needed segment: segments with lower names are no longer required for that backup (`pg_archivecleanup` automates the deletion).","Keep **several** base backups, not one, in case the newest turns out to be unusable.","Retention for logical dumps follows how long a mistake may go unnoticed, often weeks.","Privacy rules (for example a request to erase personal data) interact with backup retention; decide and document how erased data ages out of backups."]},
{h:"Automation"},
{p:"Backups must run without a person. A good job: runs as a dedicated role, uses a lock so that two runs never overlap, stops on error, logs, verifies, copies off-site, applies retention and **alerts on failure and on silence** (a job that stopped running reports nothing)."},
{code:`#!/bin/bash
# /usr/local/bin/pg_backup_full.sh : weekly physical backup with verification
set -euo pipefail
exec 9>/var/lock/pg_backup.lock
flock -n 9 || { echo "another backup is running"; exit 1; }       # no overlapping runs

TS=$(date +%Y%m%d_%H%M%S)
DEST=/backup/base/$TS
LOG=/backup/base/$TS.log
export PGHOST=db1 PGUSER=repl_backup

{
  echo "[$(date -Is)] pg_basebackup start"
  pg_basebackup -D "$DEST" -Fp -Xs -c fast --manifest-checksums=SHA256 -r 200M
  pg_verifybackup "$DEST"
  echo "[$(date -Is)] done: $(du -sh "$DEST" | cut -f1)"
  # off-site copy (example): rclone, rsync, aws s3 sync, ...
  # retention: keep the 4 newest base backups
  ls -1dt /backup/base/2* | tail -n +5 | xargs -r rm -rf
} >>"$LOG" 2>&1

# crontab (postgres or a backup user): Sundays 01:00
# 0 1 * * 0 /usr/local/bin/pg_backup_full.sh || mail -s "FULL BACKUP FAILED" dba@example.com < /dev/null`},
{p:"A **systemd timer** is a good alternative to cron: `OnCalendar=`, `Persistent=true` (runs a missed job after downtime), logs in the journal and `OnFailure=` to trigger an alert unit."},
{h:"Monitor the backups, not just the database"},
{t:[["Check","How","Alert when"],["Last successful backup age","File timestamp, tool report, or a heartbeat table/metric written by the job","Older than the schedule plus a margin"],["Backup size trend","Compare today's size with the median","Drops sharply (truncated or empty) or jumps (bloat, new data)"],["WAL archiving health","`SELECT * FROM pg_stat_archiver;` and the number of `.ready` files","`failed_count` grows, `last_failed_time` is newer than `last_archived_time`, or `.ready` files accumulate"],["`pg_wal` growth","Disk usage of `pg_wal`","Above a threshold (a stuck archive or a slot is the usual cause)"],["Verification","`pg_verifybackup` result, `pg_restore -l`, checksums","Any non-zero exit"],["Restore test","Scheduled restore into a scratch instance, row counts compared","Fails, or takes longer than the RTO"],["Off-site copy","Remote listing and checksum","Missing or different"]]},
{h:"Backup security"},
{ul:["**Backups contain everything**, including password hashes and personal data. Restrict the directory (`0700`, owner `postgres` or a backup user), restrict who can read the storage bucket, and use a separate account for off-site writes that cannot delete.","**Encrypt** before the data leaves the server (`gpg`, `age`, or the encryption of your backup tool) and keep the keys apart from the backups. An unreadable encrypted backup is as useless as no backup, so back up the keys too.","Use a role with the minimum rights (`pg_read_all_data` for dumps; `REPLICATION` for base backups) rather than a superuser (Section 07).","Protect the **manifest**: `pg_verifybackup` can only detect tampering if the manifest itself is stored securely elsewhere; use `SHA256` or stronger checksums if tampering is a concern (the default CRC32C only catches accidents).","Test that the backup account **cannot delete** old backups: that is your protection against ransomware and against your own scripts."]},
{h:"Frequent mistakes"},
{t:[["Mistake","Consequence","Prevention"],["Backups on the same disk or host as the database","One failure destroys both","Off-host, off-site copy"],["WAL archiving enabled but never monitored","The archive silently stops; `pg_wal` fills; PITR impossible","Alert on `pg_stat_archiver` and `pg_wal` size"],["Never testing a restore","The first test is the real disaster","Scheduled restore tests with timings"],["Backing up only the database, not the configuration","The restored server cannot start as before","Keep configuration in version control and in the backup"],["Retention shorter than the time to notice an error","The good copy is already deleted","Base retention on detection time"],["No documentation or owner","Nobody knows the procedure at 3 a.m.","Runbook (last lecture) and drills"]]}],
src:[["Chapter 25: Backup and Restore",D+"backup.html"],["25.3 Continuous Archiving and PITR",D+"continuous-archiving.html"],["pg_archivecleanup",D+"pgarchivecleanup.html"],["pg_stat_archiver",D+"monitoring-stats.html#MONITORING-PG-STAT-ARCHIVER-VIEW"],["pg_verifybackup",D+"app-pgverifybackup.html"]]},

/* ---------------------------------------------------------------- 8:9 */
'pg:8:9':{blocks:[
{p:"A **file system level backup** is a copy of the files that make up the cluster: the data directory and every tablespace. The PostgreSQL documentation presents it as the second of the three approaches (Chapter 25, section *File System Level Backup*) and lists its limits: it can only restore the **whole cluster**, it is **tied to the major version and platform** and, most importantly, a copy of files that are changing is **not consistent** unless something makes it so. This lecture covers the three ways to make it consistent: a stopped server (cold backup), an atomic storage snapshot, and PostgreSQL's own **backup mode** through the low-level API. `pg_basebackup`, which automates the third, was covered earlier."},
{h:"The consistency problem"},
{p:"A running server keeps changing files and relies on WAL to repair what is half done. `cp` or `tar` of a running data directory reads different files at different moments, so the copy contains pages from different times and cannot be started reliably. A file system level backup must therefore satisfy **one** of the conditions in the table."},
{t:[["Method","How consistency is achieved","Downtime","Point-in-time recovery","Typical use"],["**Cold backup**","The server is stopped cleanly, so all files agree","Yes, for the whole copy","No (one moment)","Small systems, maintenance windows"],["**Atomic snapshot**","The storage layer freezes **all** volumes at the same instant. Restoring it looks like a power failure, and crash recovery fixes it","None","Only with archived WAL and the API (below)","SAN, LVM, ZFS, Btrfs, cloud volume snapshots"],["**Backup mode (low-level API)**","`pg_backup_start` / `pg_backup_stop` bracket the copy; WAL replay from the recorded checkpoint corrects any inconsistency","None","Yes, with WAL archive","Custom scripts, third-party tools, non-atomic snapshots"],["**`pg_basebackup`**","Same as backup mode, automated and with a manifest","None","Yes, with WAL archive","The standard way"]]},
{h:"1. Cold backup"},
{flow:["Stop applications","Clean shutdown (fast or smart)","Copy PGDATA, tablespaces, configuration","Start the server","Verify and check the log"]},
{code:`# a clean shutdown writes a final checkpoint; do NOT copy after "immediate", which leaves crash recovery to do
sudo -u postgres /usr/pgsql-18/bin/pg_ctl stop -D /var/lib/pgsql/18/data -m fast

# archive, keeping ownership, permissions and symbolic links (tablespaces live behind pg_tblspc links)
sudo tar --xattrs --acls -cpf /backup/cold/pg18_$(date +%Y%m%d).tar /var/lib/pgsql/18/data /pgdata/ts_fast
# configuration kept outside PGDATA (Debian: /etc/postgresql, others: custom)
sudo cp -a /etc/postgresql /backup/cold/etc_postgresql_$(date +%Y%m%d)

sudo systemctl start postgresql-18`},
{p:"Shutdown modes (Section 03) matter here: after `smart` or `fast` the files are complete and need no replay. After `immediate`, the next start performs crash recovery, so a copy taken in that state has to do the same and is only safe if every file, including `pg_wal`, is copied."},
{h:"The two-pass rsync technique"},
{p:"To keep the outage short, copy while the server is running (the copy will be inconsistent but moves most of the bytes), then stop the server and run `rsync` again. The second pass transfers only what changed. The documentation recommends `--checksum` for it, because file modification times alone may be too coarse to detect all changes."},
{code:`# pass 1: server running; result is inconsistent and is only a head start
rsync -a --delete /var/lib/pgsql/18/data/ /backup/cold/data/

sudo systemctl stop postgresql-18
# pass 2: server stopped; short and exact
rsync -a --delete --checksum /var/lib/pgsql/18/data/ /backup/cold/data/
sudo systemctl start postgresql-18`},
{h:"2. Atomic snapshots"},
{p:"Volume managers and storage systems can take a snapshot of a file system at one instant. If **every** file the cluster uses (data directory, `pg_wal`, every tablespace) is covered by the **same atomic snapshot**, restoring it is equivalent to the server losing power at that instant. PostgreSQL then recovers by replaying WAL from the last checkpoint on its first start, exactly as in Section 04, and no backup mode is needed."},
{t:[["Snapshot technology","Atomic across several volumes?","Notes"],["LVM (`lvcreate -s`)","Per logical volume only; use a **single volume** (or a consistency group) for everything","Snapshot must be large enough to hold changes while it exists"],["ZFS / Btrfs","Per dataset; use a recursive snapshot of a parent dataset","Check recordsize and full-page-write interaction in your platform notes"],["SAN or cloud block storage","Only with consistency-group or multi-volume snapshot features","A snapshot of each disk **separately** is not atomic across disks"],["File system with `fsfreeze`","Freezes writes to one file system","Brief pause; still one file system at a time"]]},
{note:"If the data, WAL and tablespaces are on different volumes, taking separate snapshots is **not** safe. Either use a consistency group, put everything on one volume, or wrap the snapshots in `pg_backup_start` / `pg_backup_stop`, which also makes it valid for archive recovery."},
{h:"3. The low-level backup API"},
{svg:lowSvg},
{code:`-- one connection (any database) by a superuser or a role granted EXECUTE on these functions
SELECT pg_backup_start(label => 'nightly_20261008', fast => false);
--   fast => false waits for the next scheduled checkpoint (gentle); true forces an immediate one
--   THIS CONNECTION MUST STAY OPEN until pg_backup_stop, or the backup is aborted

-- ... copy PGDATA and every tablespace with tar, rsync, cpio or a snapshot ...
-- do not use pg_dump or pg_dumpall for this: they are logical and cannot replace the file copy

SELECT * FROM pg_backup_stop(wait_for_archive => true);
-- returns: lsn, labelfile, spcmapfile
--   labelfile  -> save, byte for byte, as backup_label in the ROOT of the backup
--   spcmapfile -> save as tablespace_map (unless empty)`},
{ul:["`backup_label` and `tablespace_map` are **not** optional extras. Recovery uses them to find the start checkpoint and to rebuild tablespace links. Write them exactly as returned, in binary mode.","In PostgreSQL 15 the old *exclusive* mode was removed and the functions were renamed from `pg_start_backup` and `pg_stop_backup` to `pg_backup_start` and `pg_backup_stop`. Old scripts need updating.","On a primary, `pg_backup_stop` switches to a new WAL segment and, with `wait_for_archive => true`, waits until the last segment has been archived. On a standby it cannot switch segments, so run `pg_switch_wal()` on the primary, and `archive_mode` must be `always` for it to wait.","The session that calls `pg_backup_start` has to be the one that calls `pg_backup_stop`, which is why hand-written shell scripts are fragile. Prefer `pg_basebackup` or a backup tool unless you need an exotic copy method.","Several backups may be taken at the same time with this API."]},
{h:"What to copy and what to leave out"},
{t:[["Path","In the backup?","Reason"],["Everything under the cluster directory","**Yes**","Data, catalogs, `global/`, `pg_xact`, `base/`, and so on"],["Every tablespace (follow `pg_tblspc/` links)","**Yes**, and keep the symbolic links as links","Otherwise the restore breaks the tablespaces (Section 08)"],["`pg_wal/` contents","**No**","Reduces mistakes at restore; WAL comes from the archive. Easy when `pg_wal` is a symlink to another disk"],["`postmaster.pid`, `postmaster.opts`","No","Describe the old postmaster and confuse `pg_ctl`"],["`pg_replslot/` contents","No (usually)","Slots from the primary would keep WAL on the new server and cause bloat"],["Contents (not the directories) of `pg_dynshmem`, `pg_notify`, `pg_serial`, `pg_snapshots`, `pg_stat_tmp`, `pg_subtrans`","No","Re-initialised at start"],["Anything starting with `pgsql_tmp`, and `pg_internal.init` files","No","Temporary and rebuilt"],["`postgresql.conf`, `pg_hba.conf`, `pg_ident.conf`","Yes if inside PGDATA; **copy separately** if not","WAL does not contain configuration changes"]]},
{h:"Copy tools and their warnings"},
{ul:["Tools complain when files change while they copy. That is normal for a hot backup, but you must be able to tell it from a real error. GNU `tar` exits with 1 if a file changed and 2 for other errors (version 1.16 and later); version 1.23+ can silence the warnings with `--warning=no-file-changed --warning=no-file-removed`. Some `rsync` versions return a distinct exit code (24) for vanished source files.","Preserve **ownership and permissions**: the data directory must be owned by the PostgreSQL OS user with mode `0700` (or `0750` if group access was enabled at `initdb`).","On SELinux systems restore contexts after copying (`restorecon -Rv /var/lib/pgsql`).","Do not back up with a method that dereferences symbolic links; tablespace links must stay links."]},
{h:"Restoring a file system level backup"},
{t:[["Backup type","Restore","Result"],["Cold backup or atomic snapshot **without** backup mode","Put files back, fix ownership, start","Crash recovery, then normal operation (state as of the copy)"],["Backup taken with backup mode (`backup_label` present)","Put files back, **keep `backup_label`**, make WAL available (archive + `restore_command`, or WAL included in the copy), create `recovery.signal` for archive recovery, start","Recovery from the start checkpoint to the end of the backup or a chosen target (PITR lecture)"]]},
{h:"Pitfalls"},
{t:[["Pitfall","Effect","Remedy"],["Copying a running cluster with plain `cp` and no backup mode","Unusable or silently corrupted restore","Use backup mode or `pg_basebackup`"],["Non-atomic, per-volume snapshots","Data and WAL from different instants","Consistency group, one volume, or backup mode"],["Deleting `backup_label` to \"make it start\"","Server may start from the wrong checkpoint and corrupt data","Never remove it; supply the WAL instead"],["Forgetting tablespaces","Start fails or objects are missing","Follow `pg_tblspc`; list with `pg_tablespace_location`"],["Restoring to a different major version or architecture","Server refuses to start (version file mismatch)","Use a logical dump for such moves"],["Copying `pg_replslot`","Standby retains WAL indefinitely","Exclude it"],["Containers: backing up an anonymous volume","Data lost with the container","Named volumes, and the same rules as above"]]},
{note:"Section 08 (Tablespaces in Backup, Replication and Upgrade) lists the tablespace-specific checks. In production most teams use `pg_basebackup` or a tool built on backup mode instead of hand-written copy scripts."}],
src:[["25.2 File System Level Backup",D+"backup-file.html"],["25.3.4 Making a Base Backup Using the Low Level API",D+"continuous-archiving.html#BACKUP-LOWLEVEL-BASE-BACKUP"],["Backup Control Functions",D+"functions-admin.html#FUNCTIONS-ADMIN-BACKUP"],["Release notes 15 (exclusive backup mode removed)","https://www.postgresql.org/docs/release/15.0/"]]},

/* ---------------------------------------------------------------- 8:10 */
'pg:8:10':{blocks:[
{p:"**Continuous archiving** means copying every completed WAL segment to safe storage as soon as it is full. Combined with a base backup it gives point-in-time recovery, lets you take backups of any size without a perfectly consistent copy, and can feed a warm standby. The documentation lists these benefits explicitly: the base backup need not be consistent (WAL replay repairs it, as in crash recovery), an indefinitely long chain of WAL can be replayed, replay can stop at any moment, and the same WAL stream can feed another machine. The costs are more administration and storage. Because recovery needs an unbroken WAL sequence from the start of the base backup, **set up and test archiving before you take the first base backup**."},
{svg:archSvg},
{h:"Parameters"},
{t:[["Parameter","Value","Context","Meaning"],["`wal_level`","`replica` (default) or `logical`; not `minimal`","restart","With `minimal`, some commands skip WAL, so archive recovery would be incomplete. That is why archiving and replication are impossible at `minimal`"],["`archive_mode`","`off`, `on`, `always`","restart","`on` archives on a primary; `always` also archives on a standby (needed for some standby backup setups)"],["`archive_command`","Shell command with `%p` (path) and `%f` (file name)","reload","Copies one completed segment; `%%` writes a literal `%`. The path is relative to the data directory"],["`archive_library`","Name of an archive module (PostgreSQL 15+)","reload","A C module instead of a shell command, for example the contrib `basic_archive`. Faster and with access to server facilities"],["`archive_timeout`","Seconds (0 = off)","reload","Forces a segment switch at least this often so a quiet server still archives. A switched segment is **still 16 MB** in the archive, so very short values waste space; about one minute is typical"]]},
{h:"Procedure"},
{flow:["Create the archive location with correct ownership","Set wal_level, archive_mode, archive_command","Restart (archive_mode needs it)","Force a switch: pg_switch_wal()","Check pg_stat_archiver and the archive","Test restore_command can fetch a file","Then take the base backup"]},
{code:`# 1. location: owned by postgres, no group or world access (WAL contains all your data)
sudo mkdir -p /backup/wal_archive && sudo chown postgres:postgres /backup/wal_archive && sudo chmod 700 /backup/wal_archive

# 2. postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /backup/wal_archive/%f && cp %p /backup/wal_archive/%f'
archive_timeout = 60

# 3. restart because archive_mode changed
sudo systemctl restart postgresql-18

-- 4. prove it works
SELECT pg_switch_wal();
SELECT archived_count, last_archived_wal, last_archived_time, failed_count, last_failed_wal, last_failed_time FROM pg_stat_archiver;

# 5. the file must be there
ls -l /backup/wal_archive | tail`},
{p:"The command is run by the same OS user as the server. After placeholder expansion it may look like `test ! -f /backup/wal_archive/00000001000000A900000065 && cp pg_wal/00000001000000A900000065 /backup/wal_archive/00000001000000A900000065`. The documentation calls this an **example, not a recommendation**."},
{h:"Rules for a correct archive command"},
{ul:["**Exit status 0 if and only if the file is safely archived.** PostgreSQL then recycles or removes the segment. Any other status means \"try again later\", and the segment stays in `pg_wal`.","**Never overwrite** an existing archive file. That protects you if two servers are accidentally pointed at one directory. But note a subtlety: after a crash PostgreSQL may archive the **same segment again**. If the file already exists with **identical content** and is safely stored, return success; if the content differs, return failure.","GNU `cp -i` returns 0 when the target exists, which is the wrong behaviour; use an explicit `test` or compare.","The file is archived only after it is complete and durable. A plain `cp` does not guarantee the data reached the disk of the archive; production scripts copy to a temporary name, flush, then rename.","The speed of the command is not important as long as it keeps up with the **average** WAL rate; if it falls behind, `pg_wal` grows.","File names are up to 64 characters of letters, digits and dots. Preserve `%f` exactly; `%p` can differ.","If the command is killed by a signal other than SIGTERM, or the shell reports a status above 125 (for example command not found), the **archiver process aborts and is restarted**, and that failure is **not** counted in `pg_stat_archiver`. Look in the server log (Section 06)."]},
{code:`#!/bin/bash
# /usr/local/bin/archive_wal.sh  --  archive_command = '/usr/local/bin/archive_wal.sh "%p" "%f"'
set -u
SRC="$1"; F="$2"; DEST=/backup/wal_archive

if [ -f "$DEST/$F" ]; then
  # re-archival after a crash: succeed only if identical
  cmp -s "$SRC" "$DEST/$F" && exit 0
  echo "archive: $F exists with different content" >&2; exit 1
fi
cp "$SRC" "$DEST/$F.tmp"     || exit 1
sync "$DEST/$F.tmp"          || exit 1       # data on disk before the final name appears
mv "$DEST/$F.tmp" "$DEST/$F" || exit 1
# optional: copy off-site here (rsync, rclone, aws s3 cp); return nonzero if that fails`},
{p:"Messages the script writes to standard error appear in the server log when `logging_collector` is on, which makes failures easy to diagnose."},
{h:"Variants"},
{code:`# compress the archive (the restore side must decompress)
archive_command = 'gzip < %p > /backup/wal_archive/%f.gz'
restore_command = 'gunzip < /backup/wal_archive/%f.gz > %p'

# directly to a remote host
archive_command = 'rsync -a %p backup@arch1:/wal_archive/%f'

# an archive module instead of a shell command (PostgreSQL 15+)
archive_library = 'basic_archive'
basic_archive.archive_directory = '/backup/wal_archive'`},
{h:"Monitoring and what a failure looks like"},
{code:`-- counters and last success or failure
SELECT archived_count, last_archived_wal, last_archived_time,
       failed_count, last_failed_wal, last_failed_time FROM pg_stat_archiver;

-- how many segments wait for the archiver? (.ready markers)
SELECT count(*) AS waiting FROM pg_ls_archive_statusdir() WHERE name LIKE '%.ready';

-- size of pg_wal
SELECT pg_size_pretty(sum(size)) FROM pg_ls_waldir();`},
{t:[["Symptom","Cause","Action"],["`failed_count` rising, `.ready` files accumulating","Command returns non-zero: full disk, permission, network or mount problem","Read the log; fix the cause; the archiver retries by itself"],["`pg_wal` grows toward the disk limit","Archiving stuck, or a replication slot holds WAL (Section 08)","Fix archiving first. If `pg_wal` fills, the server **PANIC**-shuts down (committed data is safe; it stays offline until space is freed)"],["Archive missing a file","Someone deleted it, or two clusters share a directory","The chain is broken: take a new base backup immediately"],["Nothing archived on a quiet server","Segment not full","Set `archive_timeout` or call `pg_switch_wal()`"],["Works manually, fails from the server","The server OS user lacks rights, different `PATH` or environment","Test as the `postgres` user; use full paths"]]},
{note:"To pause archiving temporarily with a shell command, set `archive_command = ''` and reload. WAL then accumulates in `pg_wal` until a working command is set again, so keep the pause short and watch disk space."},
{h:"Cleaning the archive"},
{p:"Each base backup writes a **backup history file** such as `000000010000000000000010.00000028.backup` into the archive. WAL segments with a lower name than the first segment named by the oldest base backup you keep are no longer needed for it and may be deleted. `pg_archivecleanup` does exactly that."},
{code:`# remove everything older than the oldest kept base backup
pg_archivecleanup -d /backup/wal_archive 000000010000000000000010.00000028.backup

# on a standby it is wired in as archive_cleanup_command
archive_cleanup_command = 'pg_archivecleanup /backup/wal_archive %r'`},
{ul:["Timeline history files (`*.history`) are tiny; **keep them indefinitely** (you may add comments to document why a timeline exists).","Configuration files are **not** in WAL. Back up `postgresql.conf`, `pg_hba.conf` and `pg_ident.conf` separately.","Take a **new base backup after** `CREATE TABLESPACE` or `DROP TABLESPACE`: they are logged with absolute paths, and replaying them on another host can be harmful (Section 08).","Do not modify template databases while a base backup is running if a `CREATE DATABASE` copies them at the same time; replay could propagate the change into the new database."]},
{h:"Full-page writes and archive volume"},
{p:"WAL contains whole-page images after each checkpoint (Section 08, WAL Format). That makes archives larger. Longer checkpoint intervals and `wal_compression` reduce volume without affecting PITR; disabling `full_page_writes` also does not prevent PITR but is risky and should be considered only after reading the reliability chapter."}],
src:[["25.3.1 Setting Up WAL Archiving",D+"continuous-archiving.html#BACKUP-ARCHIVING-WAL"],["WAL Configuration: Archiving",D+"runtime-config-wal.html#RUNTIME-CONFIG-WAL-ARCHIVING"],["Archive Modules",D+"archive-modules.html"],["basic_archive",D+"basic-archive.html"],["pg_archivecleanup",D+"pgarchivecleanup.html"],["pg_stat_archiver",D+"monitoring-stats.html#MONITORING-PG-STAT-ARCHIVER-VIEW"]]},

/* ---------------------------------------------------------------- 8:11 */
'pg:8:11':{blocks:[
{p:"**Point-in-time recovery (PITR)** restores a base backup and then replays archived WAL, but stops at a point you choose instead of at the end. This is the only way to get back to the moment before a mistaken `DELETE`, `DROP TABLE` or faulty release. It needs two ingredients that must exist **before** the incident: a base backup and a continuous WAL archive that reaches back to the start of that backup. The stop point is called the **recovery target**. Every recovery that ends creates a new **timeline**, which keeps the WAL of the new history separate from the old one."},
{svg:pitrSvg},
{h:"The recovery procedure (from the documentation)"},
{flow:["Stop the server","Keep a copy of the old data directory and unarchived WAL","Remove the old files (data and tablespaces)","Restore the base backup with correct owner","Empty pg_wal, add saved WAL","Set recovery parameters, create recovery.signal","Start the server","Inspect the result","Open the database to users"]},
{h:"Recovery parameters"},
{t:[["Parameter","Meaning","Context"],["`restore_command`","**Required.** Shell command that fetches a WAL file: `%f` is the file name, `%p` the destination path. Must return **non-zero** when the file does not exist (that is normal at the end of the archive). Also asked for `*.history` files","restart (postmaster)"],["`recovery_target_time`","Stop at a timestamp. Include a **time zone offset**, for example `'2026-10-07 14:29:00+05:30'`; otherwise the server time zone is used","restart"],["`recovery_target_name`","Stop at a restore point created with `pg_create_restore_point('name')`","restart"],["`recovery_target_xid`","Stop at a transaction ID. Hard to identify without WAL inspection","restart"],["`recovery_target_lsn`","Stop at an exact WAL position","restart"],["`recovery_target = 'immediate'`","Stop as soon as a consistent state is reached, that is, at the end of the base backup","restart"],["`recovery_target_inclusive`","`on` (default): stop just **after** the target; `off`: just **before** it","restart"],["`recovery_target_timeline`","`latest` (default), `current`, or a timeline ID","restart"],["`recovery_target_action`","`pause` (default), `promote` or `shutdown` after the target is reached","restart"],["`recovery_end_command`, `archive_cleanup_command`","Commands run at the end of recovery or at restartpoints","reload"]]},
{ul:["Specify **at most one** of the `recovery_target*` settings (except `inclusive`, `timeline`, `action`). If none is set, recovery replays everything available and ends at the end of the archive.","The target must be **after the end of the base backup**. You cannot recover into the interval when the backup was running; use the previous base backup and roll forward.","`recovery.signal` (an empty file in the data directory) asks for **archive recovery**. `standby.signal` asks for a standby. When recovery ends the server **removes `recovery.signal`** so it does not enter recovery again.","During recovery the server runs as a hot standby when `hot_standby = on` (default). Settings such as `max_connections`, `max_worker_processes`, `max_wal_senders`, `max_prepared_transactions` and `max_locks_per_transaction` must be **at least as high as on the server that wrote the WAL**, or recovery stops."]},
{h:"Create restore points before risky changes"},
{code:`-- right before a release, a bulk delete or a migration
SELECT pg_create_restore_point('before_release_42');
-- recovery_target_name = 'before_release_42' stops exactly there`},
{h:"Finding the right target"},
{t:[["Source of information","How it helps"],["Application and change logs, deployment times","The incident time; recover slightly before it"],["Server log with `log_statement` / `log_min_duration_statement` and `log_line_prefix` showing `%t` and `%x` (Section 06)","The time and transaction of the bad statement"],["`pg_waldump --rmgr=Transaction` on archived WAL (Section 08)","The commit record with its xid and timestamp"],["`pg_stat_database`, monitoring graphs","The moment when counters changed abnormally"],["Trial and error with `recovery_target_action = 'pause'`","Look at the data, then move the target forward or back"]]},
{h:"Pause first, then decide"},
{p:"With the default `pause` the server reaches the target and **stops replaying**, in read-only hot-standby mode. Query the data. If this is the right moment, call `pg_wal_replay_resume()`, which ends recovery and promotes the server. If not, shut the server down, change the target (earlier or later, within the same base backup) and start again."},
{code:`SELECT pg_get_wal_replay_pause_state();   -- 'paused' once the target is reached
SELECT pg_last_xact_replay_timestamp();   -- time of the last replayed commit
SELECT count(*) FROM sales.orders;        -- is the data as expected?
SELECT pg_wal_replay_resume();            -- accept: end recovery and open for writes`},
{h:"Timelines"},
{p:"Suppose you drop a table on Tuesday 17:15, notice on Wednesday noon, and recover to Tuesday 17:14. In this new history the table was never dropped. If the server then wrote WAL under the old names, it could overwrite WAL that you may still want from the original history. PostgreSQL prevents this with **timelines**. When archive recovery completes, a **new timeline** begins, and the timeline ID is the **first 8 hexadecimal characters of every WAL file name** (`00000002...` after the first recovery). A small **history file** such as `00000002.history` records the parent timeline and the point where it branched. It is archived like a WAL file and is needed for later recoveries."},
{code:`# 00000002.history (illustrative content; fields are tab-separated)
1	0/3000148	before 2026-10-07 14:30:00+05:30`},
{t:[["Setting","Effect"],["`recovery_target_timeline = 'latest'` (default)","Follow the newest timeline found in the archive"],["`'current'`","Stay on the timeline that was current when the base backup was taken"],["`'2'` (an ID)","Recover into that specific timeline, for example to return to a state reached by an earlier recovery attempt"]]},
{p:"Because old timelines stay in the archive, you can try several recovery targets and still go back to any of them. You cannot recover into a timeline that branched **before** the base backup."},
{h:"Complete worked example: recovering a dropped table"},
{p:"Situation: at 14:30 on 2026-10-07 someone ran `DROP TABLE sales.orders`. Archiving has been running, and the last base backup is `/backup/base/20261004`. We recover to 14:29:00 on a **scratch server first**, which is safer and does not block production."},
{code:`# 0. scratch host or a second cluster: copy the base backup into an empty data directory
sudo -u postgres cp -a /backup/base/20261004 /var/lib/pgsql/18/scratch
sudo rm -rf /var/lib/pgsql/18/scratch/pg_wal/*            # old WAL from the backup is obsolete
sudo chmod 700 /var/lib/pgsql/18/scratch

# 1. recovery settings, appended to postgresql.conf of the scratch cluster
cat >> /var/lib/pgsql/18/scratch/postgresql.conf <<'EOF'
port = 5440
restore_command = 'cp /backup/wal_archive/%f %p'
recovery_target_time = '2026-10-07 14:29:00+05:30'
recovery_target_action = 'pause'
archive_mode = off           # IMPORTANT: the scratch server must not write into the production archive
EOF

# 2. ask for archive recovery and start
sudo -u postgres touch /var/lib/pgsql/18/scratch/recovery.signal
sudo -u postgres /usr/pgsql-18/bin/pg_ctl -D /var/lib/pgsql/18/scratch -l /tmp/scratch.log start
tail -f /tmp/scratch.log`},
{p:"The log shows the progress: the start of redo from the checkpoint in `backup_label`, `consistent recovery state reached`, then `recovery stopping before commit of transaction ...` or `recovery stopping at ... time`, and finally the pause. A message that the file `00000002.history` or the next segment was not found at the end is normal."},
{code:`psql -p 5440 -d shopdb -c "SELECT count(*) FROM sales.orders;"      # the table exists again, 100000 rows
psql -p 5440 -d shopdb -c "SELECT pg_wal_replay_resume();"            # or leave paused and just dump from it

# 3. move only the lost table back to production
pg_dump -p 5440 -d shopdb -t sales.orders -Fc -f /tmp/orders_recovered.dump
pg_restore -p 5432 -d shopdb --clean --if-exists -t orders -n sales /tmp/orders_recovered.dump

# 4. remove the scratch cluster
sudo -u postgres /usr/pgsql-18/bin/pg_ctl -D /var/lib/pgsql/18/scratch stop -m fast`},
{p:"To recover the **production** server itself instead (everything after 14:29 is then discarded), follow the same steps in the real data directory after stopping the server and keeping `data.broken`. Before you reopen it, restrict `pg_hba.conf` so that users cannot connect until you have checked the data. Afterwards **take a new base backup at once**: the old backups belong to timeline 1."},
{h:"Monitoring and verifying recovery"},
{code:`SELECT pg_is_in_recovery();                  -- t while recovering or paused
SELECT pg_last_wal_replay_lsn();             -- how far replay has advanced
SELECT pg_last_xact_replay_timestamp();      -- time of the last replayed transaction
SELECT timeline_id FROM pg_control_checkpoint();   -- the timeline now in use`},
{h:"Recovery problems and fixes"},
{t:[["Message or symptom","Cause","Fix"],["`FATAL: recovery ended before configured recovery target was reached`","The archive has no WAL up to the target (target too late, or WAL missing)","Check the archive for gaps; choose an earlier target"],["`could not locate required checkpoint record` / `could not locate a valid checkpoint record`","`backup_label` missing or wrong, or the needed WAL is not available","Restore the real `backup_label`, supply WAL; never fake it"],["`WAL ends before end of online backup`","WAL needed to reach the end of the backup is missing (for example `-X none` and the last segment was never archived)","Provide the missing segment, or use a base backup with WAL included"],["`requested recovery stop point is before consistent recovery point`","The target lies inside or before the backup interval","Use a target after the backup end, or an older base backup"],["`hot standby is not possible because max_connections = ... is a lower setting than on the primary`","Recovery server has smaller limits","Raise the setting to at least the source value"],["`restore_command` errors for `.history` files","Normal on the first timeline","Ignore unless recovery fails"],["Corrupted WAL record found","Damaged archive file","Recover to a target before the corruption, restore the file from another copy"],["Server starts in recovery and stays in it","Only `standby.signal` present, or `recovery_target_action = 'pause'`","Use `recovery.signal`, or call `pg_wal_replay_resume()`"]]},
{note:"A restored server will start **archiving** with the same `archive_command` as production if you copy `postgresql.conf` unchanged. Set `archive_mode = off` or a different archive path on any scratch or test restore."}],
src:[["25.3.5 Recovering Using a Continuous Archive Backup",D+"continuous-archiving.html#BACKUP-PITR-RECOVERY"],["25.3.6 Timelines",D+"continuous-archiving.html#BACKUP-TIMELINES"],["Archive Recovery settings",D+"runtime-config-wal.html#RUNTIME-CONFIG-WAL-ARCHIVE-RECOVERY"],["Recovery Target settings",D+"runtime-config-wal.html#RUNTIME-CONFIG-WAL-RECOVERY-TARGET"],["Recovery Control Functions",D+"functions-admin.html#FUNCTIONS-RECOVERY-CONTROL"]]},

/* ---------------------------------------------------------------- 8:12 */
'pg:8:12':{blocks:[
{p:"Since **PostgreSQL 17**, `pg_basebackup` can take **incremental backups**: instead of copying every file again, the server sends only the blocks that changed since an earlier backup of the same server. A separate tool, `pg_combinebackup`, later stitches a chain of backups into one ordinary full backup. Every backup also carries a **manifest**, a list of files with checksums, which `pg_verifybackup` uses to check that the backup is intact. This lecture explains the machinery (WAL summaries), the commands, the manifest, the verification tools and why none of them replaces a real test restore."},
{svg:incSvg},
{h:"How an incremental backup knows what changed"},
{p:"The server runs a **WAL summarizer** process that reads WAL and writes small **summary files** into `pg_wal/summaries`, one per range of WAL, recording which blocks of which files were modified. An incremental backup asks for the summaries between the start LSN of the reference backup and the start LSN of the new one. Relation files are then replaced by **incremental files** holding only the changed blocks plus metadata; non-relation files are copied whole."},
{t:[["Setting","Value","Context","Notes"],["`summarize_wal`","`on`","reload (sighup)","Default `off`. Enable it **before** taking the full backup that will be the reference, because summaries must cover the whole interval between backups"],["`wal_summary_keep_time`","Default 10 days","reload","How long summary files are kept. Longer than your longest gap between backups"]]},
{code:`-- enable and verify the summarizer
ALTER SYSTEM SET summarize_wal = on;
SELECT pg_reload_conf();
SELECT * FROM pg_get_wal_summarizer_state();
SELECT * FROM pg_available_wal_summaries() ORDER BY start_lsn DESC LIMIT 5;`},
{h:"Taking a chain of backups"},
{code:`# 1. full backup (its backup_manifest is the reference)
pg_basebackup -h db1 -U repl_backup -D /backup/base/full_mon -Fp -Xs -c fast

# 2. incremental backup relative to the full one: give the OLD manifest
pg_basebackup -h db1 -U repl_backup -D /backup/base/incr_tue -i /backup/base/full_mon/backup_manifest -Xs

# 3. next incremental relative to the previous incremental
pg_basebackup -h db1 -U repl_backup -D /backup/base/incr_wed -i /backup/base/incr_tue/backup_manifest -Xs`},
{h:"Restoring: combine, then recover"},
{code:`# list ALL needed backups, oldest first; output must be a new, empty directory
pg_combinebackup /backup/base/full_mon /backup/base/incr_tue /backup/base/incr_wed -o /backup/base/restored_wed

# faster copy on file systems that support it (XFS or Btrfs with reflink, APFS)
pg_combinebackup --clone /backup/base/full_mon /backup/base/incr_tue -o /backup/base/restored_tue

# check the result, then use it like any full backup
pg_verifybackup /backup/base/restored_wed
sudo chown -R postgres:postgres /backup/base/restored_wed`},
{p:"The combined result is a **synthetic full backup**, and it can itself be used as the first element of a future combine. All the usual requirements of a full backup still apply: the WAL generated during and after the backup must be available (streamed into the backup or in the archive), and you still create `recovery.signal` and perform recovery as in the PITR lecture."},
{h:"pg_combinebackup options"},
{t:[["Option","Meaning"],["`-o dir`, `--output`","Output directory (required)"],["`--copy` (default), `--clone`, `--copy-file-range`","How unchanged blocks are copied: ordinary copy, reflink clone, or the `copy_file_range` system call"],["`-T old=new`","Remap tablespaces in the output"],["`--manifest-checksums=alg`, `--no-manifest`","Manifest of the result"],["`-n`, `-d`","Dry run and debug output (use together)"],["`-N`, `--sync-method`","Control fsync behaviour"]]},
{h:"Rules and limits"},
{ul:["PostgreSQL does **not track** which backups depend on which. You must keep the chain (full plus all following incrementals) and never delete an earlier backup that a later one needs.","`pg_combinebackup` checks that the backups form a valid chain, but **not** that each backup is intact; verify each with `pg_verifybackup`.","If data checksums were enabled or disabled between backups, take a **new full backup**; `pg_combinebackup` does not recompute page checksums.","On a **standby** an incremental backup can fail if too little happened since the previous one (no new restartpoint). On a primary every backup triggers a checkpoint, so this does not occur.","Incremental backups pay off for **large databases where most data is cold**. For small or entirely hot databases the saving is small and a full backup is simpler."]},
{h:"The backup manifest"},
{p:"Unless you pass `--no-manifest`, the server sends a `backup_manifest` file with every base backup. It is JSON: a version, the **system identifier** of the cluster, a list of every file with size, last-modified time and checksum, the **WAL ranges** needed to recover the backup, and a SHA-256 checksum of the manifest itself."},
{code:`{ "PostgreSQL-Backup-Manifest-Version": 2,
  "System-Identifier": 7432198765432109876,
  "Files": [
    { "Path": "base/16384/16391", "Size": 4382720, "Last-Modified": "2026-10-07 09:12:41 GMT",
      "Checksum-Algorithm": "CRC32C", "Checksum": "a1b2c3d4" } ],
  "WAL-Ranges": [ { "Timeline": 1, "Start-LSN": "0/3000028", "End-LSN": "0/3000138" } ],
  "Manifest-Checksum": "..." }       /* abbreviated, illustrative values */`},
{t:[["Checksum algorithm","Use"],["`CRC32C` (default)","Fast; catches accidental damage but not deliberate tampering"],["`SHA224`, `SHA256`, `SHA384`, `SHA512`","Cryptographic; use when someone might alter the backup. Store the manifest securely elsewhere, or the attacker can alter both"],["`NONE`","No file checksums: only sizes are checked"]]},
{h:"pg_verifybackup"},
{p:"`pg_verifybackup` checks a backup made with `pg_basebackup` against its manifest, in four stages: it reads and validates the manifest (including that its system identifier matches `pg_control` in the backup); compares the files present with the manifest, finding **extra and missing files**; recomputes the **checksum** of each file; and finally checks that the **WAL records needed** to recover the backup are present and parsable, by running `pg_waldump` quietly. It ignores `postgresql.auto.conf`, `standby.signal`, `recovery.signal`, the manifest itself and the contents of `pg_wal` where appropriate. In PostgreSQL 18 it also accepts **tar-format** backups, including compressed ones."},
{t:[["Option","Meaning"],["`-e`, `--exit-on-error`","Stop at the first problem (default: report all)"],["`-F p|t`, `--format`","Plain or tar backup"],["`-n`, `--no-parse-wal`","Skip WAL parsing. **Required for tar-format backups**, because WAL verification supports plain format only"],["`-s`, `--skip-checksums`","Check only presence and sizes: much faster"],["`-m path`, `--manifest-path`","Use a manifest stored elsewhere (a good security practice)"],["`-w path`, `--wal-directory`","Parse WAL from this directory, for example the archive, instead of `pg_wal`"],["`-i path`, `--ignore`","Ignore an extra file or directory you added on purpose"],["`-P`, `-q`","Progress, or silence on success"]]},
{code:`pg_verifybackup /backup/base/full_mon
pg_verifybackup -m /secure/manifests/full_mon.manifest -w /backup/wal_archive /backup/base/full_mon
pg_verifybackup -F t -n /backup/base/20261008_tar            # tar-format backup, no WAL check`},
{note:"The documentation is explicit that `pg_verifybackup` cannot do everything a running server does with a backup. It finds missing, extra, truncated and altered files and unreadable WAL. It cannot find a server bug that wrote sensible-looking but wrong WAL, nor logical problems. WAL checking also depends on the version: use the `pg_verifybackup` that matches the backup."},
{h:"Layers of integrity checking"},
{t:[["Layer","What it catches","How"],["Data checksums (`initdb --data-checksums`; the default since PostgreSQL 18; `SHOW data_checksums`)","Bit rot in data pages","`pg_basebackup` verifies pages while copying (disable with `--no-verify-checksums`). `pg_checksums --check` on a stopped cluster"],["Backup manifest and `pg_verifybackup`","Missing, altered or truncated backup files, unreadable WAL","After every backup, and again after copying off-site"],["`sha256sum` on dumps and archives","Damage during storage or transfer","Create at backup time, check before restore"],["`pg_restore -l`","Truncated or unreadable logical archives","After each dump"],["`amcheck` / `pg_amcheck`","Corrupt B-tree indexes and heap structure in a **restored copy**","Run against the test restore"],["**Restore test**","Everything above plus whether the data is right and how long recovery takes","Scheduled, automated, timed"]]},
{h:"Automated restore test"},
{code:`#!/bin/bash
# weekly: restore the newest base backup into a scratch instance, check it, time it
set -euo pipefail
LATEST=$(ls -1dt /backup/base/2* | head -n 1)
SCRATCH=/var/lib/pgsql/18/restore_test
START=$(date +%s)
rm -rf "$SCRATCH"; cp -a "$LATEST" "$SCRATCH"; chmod 700 "$SCRATCH"
echo "port = 5441
archive_mode = off" >> "$SCRATCH/postgresql.conf"
/usr/pgsql-18/bin/pg_ctl -D "$SCRATCH" -w -l /tmp/restore_test.log start
psql -p 5441 -d shopdb -Atc "SELECT count(*) FROM sales.orders"           # compare with expected
pg_amcheck -p 5441 -d shopdb --heapallindexed >/dev/null                  # structural check
/usr/pgsql-18/bin/pg_ctl -D "$SCRATCH" stop -m fast
echo "restore test OK in $(( $(date +%s) - START )) s"                    # your measured RTO input`},
{p:"Record the duration. It is your **measured RTO** for that backup, and growth over the weeks warns you before a real disaster does."}],
src:[["25.3.3 Making an Incremental Backup",D+"continuous-archiving.html#BACKUP-INCREMENTAL-BACKUP"],["pg_combinebackup",D+"app-pgcombinebackup.html"],["pg_verifybackup",D+"app-pgverifybackup.html"],["Backup Manifest Format",D+"backup-manifest-format.html"],["pg_amcheck",D+"app-pgamcheck.html"],["pg_checksums",D+"app-pgchecksums.html"]]},

/* ---------------------------------------------------------------- 8:13 */
'pg:8:13':{blocks:[
{p:"The built-in tools (`pg_dump`, `pg_basebackup`, WAL archiving, `pg_combinebackup`, `pg_verifybackup`) are building blocks. Most production teams add a **backup tool** to orchestrate them, and all teams need a written **disaster recovery runbook**. This lecture compares the common tools, maps failures to the right recovery, gives a runbook you can adapt, states the version-compatibility rules, and ends with a troubleshooting matrix of the error messages you will actually meet."},
{h:"Backup tools around PostgreSQL"},
{t:[["Tool","Typical capabilities","Strengths","Consider"],["**pgBackRest**","Full, differential and incremental backups, parallel and compressed, built-in WAL archiving and retention, backup verification, backup from a standby, repositories on POSIX, S3, GCS or Azure, optional encryption","Mature and fast for large clusters; one tool for backup, archive and restore; PITR","Needs its own configuration and a repository; learn its stanza model"],["**Barman**","Central server managing backups of many PostgreSQL servers, WAL archiving or streaming, retention policies, PITR, hooks and recovery commands","Good for fleets and a central view","Runs on a separate host; setup of SSH or streaming access"],["**WAL-G**","Base backups and WAL archiving to cloud object storage, delta backups, compression and encryption","Cloud-native, simple to wire into `archive_command`","Operational model is storage-centric; test restores carefully"],["**pg_probackup**","Page-level incremental backups, validation, retention, PITR","Efficient incrementals on older versions","Check current support for your major version"],["**Built-in tools only**","Everything in this section","No extra software; fully documented","You write and maintain scripts, retention and monitoring"]]},
{note:"Features and supported versions change between releases of these third-party projects; always read their current documentation. They build on the same PostgreSQL mechanisms (base backup, backup mode, WAL archiving), so everything you learned here still applies to them."},
{h:"When to choose what"},
{t:[["Situation","Reasonable choice"],["Small database, simple needs","`pg_dump` plus `pg_basebackup` with WAL archiving, scripted"],["Large database, short RTO, many databases or servers","A backup tool (pgBackRest or Barman) with PITR"],["Cloud object storage as the repository","pgBackRest, WAL-G or the provider's managed backups (verify how restore and PITR work)"],["Managed database service (RDS, Cloud SQL, Azure)","The service's snapshots and PITR **plus** your own logical dumps for portability and as protection against a provider-side problem"]]},
{h:"Failure scenarios and the right recovery"},
{svg:drSvg},
{t:[["Scenario","Typical cause","Recovery","Lecture"],["Rows or a table deleted or dropped by mistake","Human error, bad deployment","PITR into a **scratch instance** and copy the data back; or restore the table from a dump","PITR, Restore Practicals"],["A table or schema is wrong, but the rest is fine","Faulty migration","Restore that object from a logical archive (`pg_restore -n -t` or a list file)","Restore, Restore Practicals"],["Server or disk lost, standby available","Hardware failure","Promote the standby (Section 10), rebuild a new standby","Section 10"],["Server and standby lost","Site problem, bug, operator error on both","Restore the newest base backup, replay archived WAL, repoint applications","Physical Backup, PITR"],["Whole site or cloud account lost, ransomware or malicious deletion","Disaster, attack","Rebuild from the **off-site or immutable** copy","Backup Strategy"],["Page checksum failure or corrupted block","Storage fault","Restore the file from a backup or a standby, or restore the cluster; never rely on `zero_damaged_pages` for production data","Verification"],["`pg_wal` full, server down","Stuck archiver or slot","Fix archiving or drop the slot, free space, restart (Section 08)","WAL Archiving"],["Wrong major version or platform","Migration planning","Logical dump and restore, or `pg_upgrade`","Section 10"]]},
{h:"Disaster recovery runbook"},
{flow:["Declare the incident and stop writes","Assess: what is lost, when did it start","Choose the recovery type and target","Preserve evidence: copy damaged data and pg_wal","Restore into a clean location","Recover to the target","Verify data and application","Switch users over","Rebuild backups and replication","Write the post-incident review"]},
{t:[["Step","Checklist"],["1. Declare","Name an incident lead; stop applications or put them in read-only mode so more damage is not written; record the time"],["2. Assess","Is it logical (bad data) or physical (hardware)? When was the data last good? Does a standby have the same problem? Check `pg_stat_archiver`, free space and the server log (Section 06)"],["3. Decide","Logical error: PITR target just before the mistake, recovered in a scratch instance. Physical loss: latest base backup plus WAL to the end. Decide acceptable data loss with the business"],["4. Preserve","Copy the damaged data directory and `pg_wal` (space permitting); they may contain WAL that never reached the archive"],["5. Restore","New or cleaned host; install the **same major version**; restore base backup or dump; correct owner `postgres`, mode `0700`; tablespace paths exist; restore configuration files"],["6. Recover","`restore_command`, recovery target, `recovery.signal`; watch the log; use `pause` to check the target"],["7. Verify","Row counts against known values, application smoke tests, `pg_amcheck`, `ANALYZE`; keep `pg_hba.conf` closed to users until done"],["8. Switch","Reopen access, update connection strings or DNS or virtual IP; confirm applications write successfully"],["9. Rebuild","New base backup **immediately** (a new timeline invalidates older chains), re-enable archiving, rebuild standbys"],["10. Review","What failed, how long did recovery take versus RTO, what data was lost versus RPO, what changes follow"]]},
{h:"Version and platform compatibility"},
{t:[["Operation","Compatible with","Not compatible with"],["`pg_dump` / `pg_dumpall` from version N","Servers of version N and older (the 18 tools support servers back to 9.2)","Servers **newer** than N: `pg_dump` refuses"],["Loading a plain or archive dump","The same or a **newer** major version","An older server may need manual edits; not guaranteed"],["`pg_restore`","Archives written by the same or an older `pg_dump`","Archives from a newer `pg_dump` (`unsupported version in file header`)"],["Physical backup, file system copy, WAL archive","The **same major version**, same CPU architecture and compatible OS libraries (glibc or ICU collation versions)","Any other major version, a different architecture or an incompatible C library"],["`pg_basebackup` client","Servers of the same or older major version; incremental needs a 17+ server","Newer servers"],["Incremental chain and `pg_combinebackup`","Backups of the same cluster in order","Backups of different clusters or with a broken chain"]]},
{h:"Backup versus replication versus high availability"},
{t:[["","Backup","Streaming replica","Delayed replica (`recovery_min_apply_delay`)"],["Protects against hardware failure","Yes, slowly","Yes, quickly","Yes"],["Protects against `DROP TABLE` or bad data","**Yes** (PITR)","**No**, it copies the mistake","Yes, within the delay window"],["Protects against site loss","If stored off-site","If located elsewhere","If located elsewhere"],["Recovery time","Minutes to hours","Seconds","Minutes"],["Replaces the other?","No","No","No, it complements backups"]]},
{h:"Troubleshooting matrix"},
{t:[["Tool","Message or symptom","Likely cause","Action"],["`pg_dump`","`aborting because of server version mismatch`","Client older than server","Use the newer `pg_dump`"],["`pg_dump`","`permission denied for table ...`","Role cannot read an object","Use a role with `pg_read_all_data`"],["`pg_dump -j`","Dump aborts, `could not obtain lock`","Exclusive-lock request (DDL) during the dump","Avoid DDL during dumps; `--lock-wait-timeout`; rerun"],["`pg_dump -j`","`too many connections`","N+1 connections needed","Lower `-j` or raise `max_connections`"],["`pg_dump`","`No space left on device`","Backup disk full","Free space, compress (`-Z zstd`), stream to another host"],["`pg_dumpall`","Password prompt for every database","No `.pgpass`","Create it, or use peer authentication"],["`pg_restore`","`role ... does not exist`, `relation already exists`","Missing roles or non-empty target","See the Restore lecture"],["`pg_basebackup`","`no pg_hba.conf entry for replication connection`","Missing replication rule","Add `host replication user addr method`; reload"],["`pg_basebackup`","`number of requested standby connections exceeds max_wal_senders`","Too few WAL senders","Raise `max_wal_senders` (restart) or stop other senders"],["`pg_basebackup -Xf`","`requested WAL segment ... has already been removed`","`wal_keep_size` too small","Use `-X stream`, or raise `wal_keep_size`"],["`pg_basebackup`","`checksum verification failed in file ...`","Real corruption in a data file","Investigate; do not ignore; restore the file from another copy"],["Archiving","`archive command failed with exit code 1`; `.ready` files grow","Command fails (space, permissions, mount)","Fix; check `pg_stat_archiver` and the log"],["Archiving","`pg_wal` filling","Failing archive or a replication slot behind","Fix archiving, advance or drop the slot (Section 08)"],["Recovery","`recovery ended before configured recovery target was reached`","WAL missing before the target","Check archive continuity; choose an earlier target"],["Recovery","`could not locate a valid checkpoint record`","`backup_label` lost, or WAL missing","Restore `backup_label`; supply the WAL"],["Recovery","`WAL ends before end of online backup`","Last WAL segment of the backup not available","Archive it or use a backup with WAL included"],["Recovery","Hot standby limits error","Lower `max_connections` etc. than on the source","Raise to at least the source values"],["`pg_verifybackup`","`checksum mismatch`, `file is missing`, `has size ...`","Damaged or incomplete backup","Take a new backup; investigate storage"],["`pg_combinebackup`","`backup ... is not a valid chain`","Wrong order or missing earlier backup","List all required backups, oldest first"],["Any","`FATAL: data directory has invalid permissions`","Restore left wrong mode or owner","`chown postgres`, `chmod 700`"]]},
{h:"Backup readiness audit"},
{ul:["RPO and RTO are written down and approved.","A physical backup and WAL archiving exist, and `pg_stat_archiver` shows recent success.","Logical dumps per database and `pg_dumpall --globals-only` run daily.","Configuration files are backed up on every change.","A copy exists **off the server** and **off-site**, one immutable, all encrypted where needed.","Every backup is verified (`pg_verifybackup`, `pg_restore -l`, checksums).","A full restore has been **performed and timed** in the last quarter, and it met the RTO.","Alerts exist for backup age, archive failures and `pg_wal` growth.","The runbook is current, stored outside the database server, and the team has practised it.","Section 10 builds on this with replication, failover and `pg_upgrade`."]}],
src:[["Chapter 25: Backup and Restore",D+"backup.html"],["pgBackRest","https://pgbackrest.org/"],["Barman","https://pgbarman.org/"],["WAL-G","https://github.com/wal-g/wal-g"],["Hot Standby and recovery_min_apply_delay",D+"runtime-config-replication.html"],["pg_amcheck",D+"app-pgamcheck.html"]]}

});

/* ---------- back-fill notes into earlier lessons (Section 09) ---------- */
const X=(k,blocks,src)=>{const L=window.LESSONS[k];if(!L)return;L.blocks.push(...blocks);if(src)L.src=(L.src||[]).concat(src)};

X('pg:0:1',[
{h:"MVCC and backups (Section 09)"},
{p:"MVCC is the reason `pg_dump` can produce a **consistent** export without blocking anybody: it reads the whole database inside one snapshot, so concurrent changes are invisible to it. The same mechanism explains why a long-running dump delays `VACUUM` from removing old row versions: the dump's snapshot keeps them alive until it ends."}],
[["SQL Dump",D+"backup-dump.html"]]);

X('pg:0:2',[
{h:"Where backup and recovery duties are taught (Section 09)"},
{t:[["DBA duty","Where to learn it"],["Define RPO, RTO, retention, 3-2-1 copies","Backup and Restore, Backup Strategy (bonus)"],["Logical backups of databases, schemas, tables","Backup Formats, Connection Options, Backup Practicals"],["Restore, selective restore, rescue of one table","Restore, Restore Practicals"],["Roles and tablespace definitions","pg_dumpall"],["Whole-cluster physical backups and standby seeds","Physical Backup"],["Any-moment recovery after a mistake","Continuous Archiving (bonus), Point-in-Time Recovery (bonus)"],["Large databases: incremental backups, verification","Incremental Backups and Verification (bonus)"],["Disaster recovery and runbooks","Backup Tools, Troubleshooting and DR Runbook (bonus)"]]}],
[["Backup and Restore",D+"backup.html"]]);

X('pg:1:2',[
{h:"Client tools on side-by-side installs (Section 09)"},
{p:"PGDG packages install each major version under its own directory (`/usr/pgsql-18/bin`). A backup run with the wrong `pg_dump` fails or, worse, is made by an old client. `pg_dump` refuses servers **newer** than itself, so always call the client of the highest major version on the host by full path, or put that `bin` directory first in `PATH`, and use the same version's `pg_restore` and `psql` when restoring."},
{code:`/usr/pgsql-18/bin/pg_dump --version
/usr/pgsql-18/bin/pg_basebackup --version`}],
[["pg_dump",D+"app-pgdump.html"]]);

X('pg:1:5',[
{h:"Test the backup before you uninstall (Section 09)"},
{ul:["A `pg_dumpall` file contains roles and all databases, but **not the tablespace directories**; use a physical backup (`pg_basebackup`) when files must be preserved.","Prove the backup is usable first: `pg_restore -l` for archives, a trial restore into a scratch instance, and a row-count comparison (Restore Practicals).","Keep the configuration files (`postgresql.conf`, `pg_hba.conf`, `pg_ident.conf`) and a note of the exact version and extensions, so that a later reinstall can match them.","Protect the dump files: `pg_dumpall` output contains role password hashes."]}],
[["Backup and Restore",D+"backup.html"]]);

X('pg:2:0',[
{h:"Replication connections for backups (Section 09)"},
{p:"`pg_basebackup` connects with the **replication protocol**, which is matched by a special keyword in the database column of `pg_hba.conf`. A rule for database `all` does **not** match it. The role also needs the `REPLICATION` attribute (or must be a superuser)."},
{code:`# pg_hba.conf
host  replication  repl_backup  10.0.0.20/32  scram-sha-256
# then reload
SELECT pg_reload_conf();`}],
[["The pg_hba.conf File",D+"auth-pg-hba-conf.html"]]);

X('pg:2:1',[
{h:"One backup set per cluster (Section 09)"},
{ul:["Each cluster on a multi-cluster host needs its **own** backup directory, WAL archive directory and `archive_command`. Two clusters archiving into one directory overwrite or confuse each other's WAL; archive commands that refuse to overwrite will start failing.","Select the cluster in backup scripts with `-p` or `PGPORT`: `pg_dump -p 5433 ...`, `pg_basebackup -p 5433 ...`.","Include the port or cluster name in the backup file name (`prod01_5433_shopdb_...`)."]}],
[["pg_basebackup",D+"app-pgbasebackup.html"]]);

X('pg:2:2',[
{h:"Shutdown modes and file system backups (Section 09)"},
{t:[["Mode","Safe to copy the data directory afterwards?"],["`smart`, `fast`","Yes. A clean shutdown writes a final checkpoint, so the files are consistent and need no WAL replay"],["`immediate`","Only with the **complete** `pg_wal` copied: the next start performs crash recovery"]]},
{p:"A cold backup is simply a clean shutdown followed by a copy of `PGDATA` and every tablespace (File System Level Backups). A hot backup instead uses `pg_basebackup` or backup mode and needs no shutdown."}],
[["File System Level Backup",D+"backup-file.html"]]);

X('pg:2:4',[
{h:"psql options that matter for restores (Section 09)"},
{t:[["Option","Purpose"],["`-X`","Ignore `~/.psqlrc`; recommended when loading dumps"],["`-f file`","Run a script file (a plain dump)"],["`-v ON_ERROR_STOP=1`","Stop at the first error instead of continuing"],["`-1` / `--single-transaction`","Run the whole script as one transaction (not with dumps that create databases)"],["`-q`, `-o file`","Quiet output, redirect output"]]},
{code:`psql -X -v ON_ERROR_STOP=1 -1 -d newdb -f /backup/shopdb.sql`}],
[["psql",D+"app-psql.html"]]);

X('pg:3:2',[
{h:"Processes that serve backups (Section 09)"},
{t:[["Process","Role in backup and recovery"],["**archiver**","Runs `archive_command` for each completed WAL segment (Continuous Archiving)"],["**checkpointer**","A checkpoint starts every base backup and fixes the point from which WAL replay begins"],["**walsender**","Serves `pg_basebackup` and streams WAL; one more is used for `-X stream`"],["**WAL summarizer** (17+)","Writes `pg_wal/summaries` when `summarize_wal = on`, enabling incremental backups"],["**startup process**","Performs crash recovery and archive recovery (PITR) when the server starts"]]}],
[["Continuous Archiving and PITR",D+"continuous-archiving.html"]]);

X('pg:3:4',[
{h:"WAL as the basis of backup (Section 09)"},
{p:"Because every change is in WAL, a base backup does not have to be consistent: replay from the checkpoint recorded in `backup_label` repairs it, exactly as in crash recovery. If the WAL is also archived, replay can stop at any chosen point, which is point-in-time recovery. Section 09 builds on this in Continuous Archiving and Point-in-Time Recovery."}],
[["Continuous Archiving and PITR",D+"continuous-archiving.html"]]);

X('pg:3:6',[
{h:"Files that appear around backups and recovery (Section 09)"},
{t:[["File","Created by","Meaning"],["`backup_label`","Backup mode, `pg_basebackup`","Start checkpoint and label of the backup; required for recovery; never delete it"],["`backup_manifest`","`pg_basebackup`","File list with checksums for `pg_verifybackup`"],["`tablespace_map`","Backup mode, `pg_basebackup`","Tablespace OID to path mapping"],["`recovery.signal`","You","Request archive recovery (PITR); removed when recovery ends"],["`standby.signal`","You or `pg_basebackup -R`","Start as a standby (Section 10)"],["`pg_wal/archive_status/*.ready`","Server","Segments waiting for the archiver"]]}],
[["Backup and Restore",D+"backup.html"]]);

X('pg:4:1',[
{h:"template0, template1 and restores (Section 09)"},
{p:"A `pg_dump` is written **relative to `template0`**. Restore into a database created `WITH TEMPLATE template0` (or let `pg_restore -C` create it). If `template1` has local additions, restoring into a database copied from it produces duplicate-object errors. Create the target with the same encoding and locale as the source."},
{code:`CREATE DATABASE restored TEMPLATE template0 ENCODING 'UTF8';
-- or: createdb -T template0 restored`}],
[["pg_restore",D+"app-pgrestore.html"]]);

X('pg:4:4',[
{h:"Backups, locks and sessions (Section 09)"},
{ul:["A running `pg_dump` appears in `pg_stat_activity` (one backend, or N+1 with `-j`) with `application_name = 'pg_dump'`, and holds `ACCESS SHARE` locks on every table it reads.","DDL such as `ALTER TABLE` or `TRUNCATE` queues behind it, and everything else on that table queues behind the DDL. Check `pg_locks` before cancelling anything.","Terminating a dump backend (`pg_terminate_backend`) aborts the dump; the output file is incomplete and must be discarded.","Use `--lock-wait-timeout` in scheduled dumps so they fail rather than wait indefinitely."]},
{code:`SELECT pid, application_name, state, now() - xact_start AS running_for
FROM pg_stat_activity WHERE application_name IN ('pg_dump','pg_basebackup','pg_restore');`}],
[["pg_dump",D+"app-pgdump.html"]]);

X('pg:4:6',[
{h:"Sizing backup storage (Section 09)"},
{p:"Physical backups are about the size of the cluster including indexes and bloat; logical dumps contain no index data and compress well, often to a fraction of the database size. Use `pg_database_size()` and `pg_total_relation_size()` as the starting point and add room for retained copies and WAL archive (Backup Strategy)."}],
[["Database Object Size Functions",D+"functions-admin.html#FUNCTIONS-ADMIN-DBSIZE"]]);

X('pg:4:7',[
{h:"Extensions in dumps (Section 09)"},
{p:"A dump stores `CREATE EXTENSION` and the data of tables the extension marks as configuration tables, **not** the extension's files. The target host must have the same extension packages installed (for example `pg_stat_statements` from contrib, PostGIS), at a compatible version, before the restore."}],
[["pg_dump",D+"app-pgdump.html"]]);

X('pg:4:8',[
{h:"Encoding and collation across restores (Section 09)"},
{ul:["Create the restore target with the **same encoding and locale** as the source; `pg_dump -E` can change the dump encoding, but a mismatch in collation can reorder text and break unique indexes or partition bounds.","When restoring on a server with a different collation definition, `--load-via-partition-root` lets rows be re-routed to the right partition.","Physical backups need the same operating-system library versions (glibc or ICU) for collations to behave identically."]}],
[["pg_dump",D+"app-pgdump.html"]]);

X('pg:4:10',[
{h:"Views that show backup health (Section 09)"},
{t:[["View or function","Shows"],["`pg_stat_archiver`","WAL archiving counters, last archived file, last failure"],["`pg_stat_progress_basebackup`","Phase and progress of a running `pg_basebackup`"],["`pg_stat_replication_slots`, `pg_replication_slots`","Slots that may hold WAL"],["`pg_ls_archive_statusdir()`","Segments waiting to be archived (`.ready`)"],["`pg_control_checkpoint()`","Timeline and last checkpoint"]]}],
[["The Cumulative Statistics System",D+"monitoring-stats.html"]]);

X('pg:5:3',[
{h:"Backup and recovery parameters (Section 09)"},
{t:[["Parameter","Context","Action"],["`archive_command`, `archive_library`, `archive_timeout`, `summarize_wal`, `wal_summary_keep_time`","`sighup`","Reload"],["`archive_mode`, `wal_level`, `max_wal_senders`","`postmaster`","Restart"],["`restore_command`, `recovery_target_*`, `recovery_target_action`","`postmaster`","Restart; set only for the recovery run"],["`archive_cleanup_command`, `recovery_end_command`","`sighup`","Reload"]]}],
[["Archive Recovery",D+"runtime-config-wal.html#RUNTIME-CONFIG-WAL-ARCHIVE-RECOVERY"]]);

X('pg:5:6',[
{h:"Checkpoints, archiving and recovery time (Section 09)"},
{ul:["`pg_basebackup` begins with a checkpoint. By default it is spread over `checkpoint_completion_target`; `--checkpoint=fast` forces an immediate one.","Longer `checkpoint_timeout` and larger `max_wal_size` mean less WAL (fewer full-page images) in the archive, but a longer crash recovery and a longer PITR replay.","`archive_timeout` closes a WAL segment after N seconds so quiet servers still archive; each switched segment is archived at full 16 MB size."]}],
[["WAL Configuration",D+"runtime-config-wal.html"]]);

X('pg:5:7',[
{h:"Logging backup activity (Section 09)"},
{ul:["`log_replication_commands = on` logs replication commands such as the start of a base backup, giving an audit trail of who took one.","`log_checkpoints = on` shows the checkpoint that starts each backup.","Output of an `archive_command` script written to standard error ends up in the server log when `logging_collector` is on, which is the first place to look when archiving fails.","Failures where the archive command is killed or the shell returns a status above 125 are not counted in `pg_stat_archiver`; only the log shows them."]}],
[["Error Reporting and Logging",D+"runtime-config-logging.html"]]);

X('pg:6:1',[
{h:"Authentication for backup jobs (Section 09)"},
{ul:["Give backup jobs their own role and their own `pg_hba.conf` lines, restricted to the backup host and using `scram-sha-256` or certificates.","`pg_dump` needs a rule for the target database; `pg_basebackup` needs a rule in the **replication** column.","Peer authentication on the local socket lets a cron job running as a dedicated OS user connect without storing a password."]}],
[["Client Authentication",D+"client-authentication.html"]]);

X('pg:6:3',[
{h:"Creating backup roles (Section 09)"},
{code:`-- logical backups: read everything, nothing else
CREATE ROLE backup_user LOGIN PASSWORD 'change-me' CONNECTION LIMIT 4;
GRANT pg_read_all_data TO backup_user;

-- physical backups
CREATE ROLE repl_backup LOGIN REPLICATION PASSWORD 'change-me' CONNECTION LIMIT 2;`},
{p:"`pg_read_all_data` is enough for `pg_dump` but not for `pg_dumpall` password hashes (those need a superuser, or use `--no-role-passwords`). Avoid giving backup jobs superuser rights."}],
[["Predefined Roles",D+"predefined-roles.html"]]);

X('pg:6:6',[
{h:"Row-level security and dumps (Section 09)"},
{p:"`pg_dump` sets `row_security = off` so that every row is exported. If the dumping role does not have `BYPASSRLS` (or is not the table owner or a superuser), `pg_dump` fails rather than producing a partial dump. `--enable-row-security` dumps only the rows the role can see, and should be used together with `--inserts` because `COPY` does not support row security. Restores use the same default."}],
[["pg_dump",D+"app-pgdump.html"]]);

X('pg:6:10',[
{h:"Backup security checklist (Section 09)"},
{ul:["Backups hold all data and password hashes: restrict file and bucket permissions, encrypt off-server copies, keep keys separate.","Use least-privilege backup roles and an off-site account that can write but not delete.","Store the backup manifest where an attacker with access to the backup cannot change it, and use `SHA256` checksums if tampering matters.","Never restore a dump from an untrusted superuser without inspecting it (`pg_restore -f`)."]}],
[["Backup Strategy",D+"backup.html"]]);

X('pg:7:6',[
{h:"Archive retention and cleanup (Section 09)"},
{p:"Once a base backup is complete, WAL segments with names lower than the one in its `*.backup` history file are not needed to restore **that** backup. `pg_archivecleanup` removes them. Keep every `.history` file. Section 09 (Continuous Archiving) shows how to monitor the archive with `pg_stat_archiver` and how to write a safe `archive_command`."}],
[["pg_archivecleanup",D+"pgarchivecleanup.html"]]);

X('pg:7:8',[
{h:"Where the full procedures are (Section 09)"},
{t:[["Topic","Lecture in Section 09"],["Taking and restoring base backups, `-T` tablespace mapping","Physical Backup"],["`pg_dumpall` and tablespace definitions","pg_dumpall"],["Replaying `CREATE TABLESPACE` during recovery","Point-in-Time Recovery"],["Verifying a restore","Incremental Backups, Manifests and Backup Verification"]]}],
[["Backup and Restore",D+"backup.html"]]);

})();
