/* LearnSphere - SQL Server Core DBA, Section 05: Databases, Files & Storage.
   Lectures 0-5 are core, 6-7 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const files=M.dg(700,230,[
[10,10,400,210,'Database SalesDB',1],
[30,45,170,60,'PRIMARY filegroup|SalesDB.mdf (primary)',2],[220,45,170,60,'FG_DATA filegroup|Data1.ndf, Data2.ndf',0],
[30,125,360,50,'Transaction log (no filegroup)|SalesDB_log.ldf',2],
[450,45,230,60,'Rule of thumb|data files: random I/O|log file: sequential writes',0],
[450,125,230,50,'One log file is enough for performance',0]],
[]);

const growth=M.dg(700,150,[
[10,25,200,70,'Pre-size files|for the expected|size of 6 to 12 months',2],
[250,25,200,70,'Autogrowth as a|safety net: fixed MB|not percent',0],
[490,25,200,70,'Monitor free space|and grow by plan|not by surprise',0]],
[[210,60,250,60],[450,60,490,60]]);

const rm=M.dg(700,200,[
[10,20,210,70,'SIMPLE|log reused after checkpoint|no point-in-time restore',0],
[245,20,210,70,'FULL|log kept until log backup|point-in-time restore',2],
[480,20,210,70,'BULK_LOGGED|minimal logging for bulk|special use, then back to FULL',0],
[10,115,680,60,'The recovery model decides how long log records are kept and what restores are possible',0]],
[]);

const tdb=M.dg(700,200,[
[10,10,680,180,'tempdb is shared by every database and session',1],
[30,45,200,60,'User objects|#temp tables, @table|variables',0],[250,45,200,60,'Internal objects|sorts, hashes, spools|worktables',0],[470,45,200,60,'Version store|row versioning:|RCSI, snapshot',0],
[30,120,640,50,'Several equal-size data files spread allocation work and reduce latch contention',2]],
[]);

const lay=M.dg(700,180,[
[10,15,160,60,'Data volume|fast random I/O',2],[190,15,160,60,'Log volume|low write latency',2],
[370,15,150,60,'tempdb volume|fast, can be local SSD',0],[540,15,150,60,'Backup volume|separate failure domain',0],
[10,100,680,60,'Measure latency per file with sys.dm_io_virtual_file_stats and watch the trend, not one number',0]],
[]);

/* ---------- 0: Files and filegroups ---------- */
L['mss-core:4:0']={blocks:[
{p:'A SQL Server database is a set of **files** grouped into **filegroups**. Knowing which file is which makes backup, restore, growth and troubleshooting much simpler.'},
{svg:files},
{h:'The three file types'},
{t:[['Type','Extension','Holds'],
['**Primary data file**','`.mdf`','System tables of the database and user data. One per database.'],
['**Secondary data file**','`.ndf`','Extra user data. Optional.'],
['**Transaction log file**','`.ldf`','The log of changes. Not part of any filegroup.']]},
{h:'Filegroups'},
{ul:['A **filegroup** is a named set of data files. Objects are created **on a filegroup**, not on a file.','Every database has a **PRIMARY** filegroup. One filegroup is the **default** for new objects.','SQL Server spreads writes across the files of a filegroup with **proportional fill**.','Filegroups let you place busy tables on faster storage and restore parts of a database independently.']},
{note:'A common design keeps the PRIMARY filegroup for system data only and puts user data in a separate default filegroup. It also makes piecemeal restore possible later.'},
{h:'See your files'},
{code:`SELECT DB_NAME(database_id) AS db, name AS logical_name, type_desc,
       physical_name, size*8/1024 AS size_mb, growth, is_percent_growth
FROM   sys.master_files
ORDER  BY database_id, file_id;

-- Filegroups of the current database
SELECT name, type_desc, is_default FROM sys.filegroups;`}],
src:[['Database files and filegroups',M.RD+'databases/database-files-and-filegroups'],['sys.master_files',M.RD+'system-catalog-views/sys-master-files-transact-sql']]};

/* ---------- 1: Creating and altering ---------- */
L['mss-core:4:1']={blocks:[
{p:'You can create a database from SSMS, but a **T-SQL script** is repeatable and reviewable. A good script states the file layout, sizes and growth explicitly instead of inheriting the defaults from **model**.'},
{h:'Create a database'},
{code:`CREATE DATABASE SalesDB
ON PRIMARY
  (NAME = SalesDB_sys,  FILENAME = 'D:\\SQLData\\SalesDB.mdf',
   SIZE = 256MB, FILEGROWTH = 256MB),
FILEGROUP FG_DATA DEFAULT
  (NAME = SalesDB_d1,   FILENAME = 'D:\\SQLData\\SalesDB_d1.ndf',
   SIZE = 4GB,  FILEGROWTH = 512MB),
  (NAME = SalesDB_d2,   FILENAME = 'D:\\SQLData\\SalesDB_d2.ndf',
   SIZE = 4GB,  FILEGROWTH = 512MB)
LOG ON
  (NAME = SalesDB_log,  FILENAME = 'L:\\SQLLog\\SalesDB_log.ldf',
   SIZE = 2GB,  FILEGROWTH = 512MB);`},
{h:'Alter it'},
{code:`-- Add a file
ALTER DATABASE SalesDB
  ADD FILE (NAME = SalesDB_d3, FILENAME = 'D:\\SQLData\\SalesDB_d3.ndf',
            SIZE = 4GB, FILEGROWTH = 512MB) TO FILEGROUP FG_DATA;

-- Resize
ALTER DATABASE SalesDB MODIFY FILE (NAME = SalesDB_log, SIZE = 4GB);

-- Rename
ALTER DATABASE SalesDB MODIFY NAME = SalesData;`},
{h:'Options worth checking'},
{t:[['Option','Recommended','Why'],
['`PAGE_VERIFY`','CHECKSUM','Detects page corruption'],
['`AUTO_CLOSE`','OFF','Closing and reopening wastes time'],
['`AUTO_SHRINK`','OFF','Causes fragmentation and I/O'],
['`AUTO_CREATE_STATISTICS`, `AUTO_UPDATE_STATISTICS`','ON','Optimizer needs fresh statistics'],
['`COMPATIBILITY_LEVEL`','Current level after testing','Controls optimizer behavior']]},
{code:`SELECT name, page_verify_option_desc, is_auto_close_on, is_auto_shrink_on,
       is_auto_create_stats_on, compatibility_level
FROM   sys.databases;`}],
src:[['CREATE DATABASE',M.TS+'statements/create-database-transact-sql'],['ALTER DATABASE',M.TS+'statements/alter-database-transact-sql']]};

/* ---------- 2: Autogrowth, IFI ---------- */
L['mss-core:4:2']={blocks:[
{p:'Files do not grow by themselves unless **autogrowth** is on, and every growth event pauses work for a moment. Plan sizes first and use autogrowth as a safety net.'},
{svg:growth},
{h:'Rules that work'},
{ul:['Set an **initial size** that fits the expected data for months.','Use **fixed MB growth**, not percent. Percent growth gets slower as files get bigger.','Make files in a filegroup the **same size and growth** so proportional fill stays even.','Keep **some free space** and monitor it. Do not rely on a full disk to tell you.','Never rely on **shrink** to save space routinely.']},
{h:'Instant file initialization (IFI)'},
{p:'When a data file is created or grown, Windows normally writes zeros to the new space. With **IFI** SQL Server skips zeroing, so growth and restore are much faster. It applies to **data files** only. Log files are always zeroed, with small exceptions in newer versions.'},
{flow:['Grant the service account the right: Perform volume maintenance tasks','Restart the instance','Verify with sys.dm_server_services','Data file growth and restore get faster']},
{code:`SELECT servicename, instant_file_initialization_enabled
FROM   sys.dm_server_services;

-- Growth settings of every file
SELECT DB_NAME(database_id) AS db, name, size*8/1024 AS size_mb,
       CASE WHEN is_percent_growth = 1 THEN CAST(growth AS varchar(10)) + ' %'
            ELSE CAST(growth*8/1024 AS varchar(10)) + ' MB' END AS growth_setting
FROM   sys.master_files;`},
{note:'IFI has a small security trade-off: deleted disk content can be seen in newly allocated space if the file is accessed outside SQL Server. For most organizations the speed benefit outweighs it, but follow your policy.'}],
src:[['Database instant file initialization',M.RD+'databases/database-instant-file-initialization'],['Manage the size of the transaction log',M.RD+'logs/manage-the-size-of-the-transaction-log-file']]};

/* ---------- 3: Recovery models ---------- */
L['mss-core:4:3']={blocks:[
{p:'The **recovery model** is set per database and decides how the transaction log is used. It is the most important setting for backup and restore.'},
{svg:rm},
{t:[['Model','Log behavior','Restore options','Use for'],
['**SIMPLE**','Log space reused automatically after checkpoint','Full and differential backups only','Dev, test, data you can reload'],
['**FULL**','Log kept until a **log backup**','Point-in-time restore with log backups','Production OLTP'],
['**BULK_LOGGED**','Like FULL, with minimal logging for bulk operations','Point-in-time is limited around bulk work','Short windows for big loads']]},
{h:'Common trap'},
{flow:['Database is in FULL','No log backups are scheduled','Log cannot be reused','Log file grows until the disk is full']},
{note:'FULL recovery without log backups is the main reason transaction logs fill disks. Either schedule log backups or use SIMPLE if you do not need point-in-time recovery.'},
{h:'Check and change'},
{code:`SELECT name, recovery_model_desc, log_reuse_wait_desc
FROM   sys.databases;

ALTER DATABASE SalesDB SET RECOVERY FULL;
-- After switching to FULL, take a full backup to start the log chain
BACKUP DATABASE SalesDB TO DISK = 'E:\\Backup\\SalesDB_full.bak';`},
{p:'New databases copy the recovery model of **model**. Set it there if your standard is different from FULL.'}],
src:[['Recovery models',M.RD+'backup-restore/recovery-models-sql-server'],['View or change the recovery model',M.RD+'backup-restore/view-or-change-the-recovery-model-of-a-database-sql-server']]};

/* ---------- 4: tempdb ---------- */
L['mss-core:4:4']={blocks:[
{p:'**tempdb** is a shared scratch database. It holds temporary objects, work files for sorts and hashes, and row versions. Its speed and configuration affect every database on the instance.'},
{svg:tdb},
{h:'What it stores'},
{t:[['Content','Examples'],
['**User objects**','`#temp` tables, table variables, temp stored procedures'],
['**Internal objects**','Sort and hash spills, spools, cursors'],
['**Version store**','Row versions for snapshot isolation and RCSI, online index operations']]},
{h:'Configuration'},
{ul:['Create **several data files of equal size and growth**. A usual starting point is one file per logical CPU up to **8**, then add only if you see contention.','Use **one log file**.','Place tempdb on **fast storage**; local SSD is often fine because tempdb is rebuilt at every start.','**Pre-size** it for peak use. Growth during busy time hurts.']},
{h:'Contention symptom'},
{p:'Many sessions creating temp objects at once can wait on **PAGELATCH_UP / PAGELATCH_EX** for allocation pages (PFS, GAM, SGAM). More equal-size files spread that work. SQL Server 2016 and later already use uniform extents in tempdb, and 2022 improves allocation concurrency.'},
{code:`-- Files and sizes
SELECT name, type_desc, size*8/1024 AS size_mb, growth, physical_name
FROM   tempdb.sys.database_files;

-- Who uses tempdb space right now
SELECT session_id,
       (user_objects_alloc_page_count - user_objects_dealloc_page_count)*8/1024 AS user_mb,
       (internal_objects_alloc_page_count - internal_objects_dealloc_page_count)*8/1024 AS internal_mb
FROM   sys.dm_db_session_space_usage
WHERE  session_id > 50
ORDER  BY user_mb + internal_mb DESC;`},
{note:'SQL Server 2019 added memory-optimized tempdb metadata, an option for heavy metadata contention. Test it before enabling because it needs a restart and has limits.'}],
src:[['tempdb database',M.RD+'databases/tempdb-database'],['Recommendations to reduce allocation contention','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/performance/recommendations-reduce-allocation-contention']]};

/* ---------- 5: Storage best practices ---------- */
L['mss-core:4:5']={blocks:[
{p:'Storage is where many SQL Server problems start. Good layout and good **measurement** prevent most of them.'},
{svg:lay},
{h:'Best practices'},
{ul:['Put **log files on low-latency storage**. Log writes are sequential and every commit waits for them.','Keep **data, log, tempdb and backups** on different volumes where possible.','Use **RAID 10 or equivalent** for write-heavy data and log in on-premises storage, and provision enough IOPS in the cloud.','Use an **allocation unit size of 64 KB** on Windows volumes.','Do not use **AUTO_SHRINK** and avoid manual shrink: it fragments and wastes I/O.','Monitor **free space** and **file growth** every day.']},
{h:'Measure I/O latency'},
{code:`SELECT DB_NAME(vfs.database_id) AS db, mf.physical_name, mf.type_desc,
       vfs.num_of_reads, vfs.num_of_writes,
       vfs.io_stall_read_ms  / NULLIF(vfs.num_of_reads, 0)  AS avg_read_ms,
       vfs.io_stall_write_ms / NULLIF(vfs.num_of_writes, 0) AS avg_write_ms
FROM   sys.dm_io_virtual_file_stats(NULL, NULL) vfs
JOIN   sys.master_files mf
  ON   mf.database_id = vfs.database_id AND mf.file_id = vfs.file_id
ORDER  BY avg_write_ms DESC;`},
{t:[['Metric','Rough good level','Meaning if worse'],
['**Log write latency**','Under 5 ms','Commits slow down'],
['**Data read latency**','Under 10 to 20 ms','Queries wait for pages']]},
{note:'These numbers are rules of thumb. Compare against your baseline and against what the storage team promises. Values from DMVs are averages since restart.'}],
src:[['Storage best practices for SQL Server on Azure VMs','https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/performance-guidelines-best-practices-storage'],['sys.dm_io_virtual_file_stats',M.RD+'system-dynamic-management-views/sys-dm-io-virtual-file-stats-transact-sql']]};

})();
