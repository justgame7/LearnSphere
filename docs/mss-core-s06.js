/* LearnSphere - SQL Server Core DBA, Section 06: The Transaction Log.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const wal=M.dg(700,220,[
[10,20,130,60,'Session|UPDATE ... COMMIT',0],
[180,20,150,60,'Log buffer|memory',2],[370,20,150,60,'Log file (.ldf)|hardened on commit',2],
[180,130,150,60,'Buffer pool|dirty data pages',0],[370,130,150,60,'Data files|written later',0],
[560,20,130,60,'Commit returns|to the client',0]],
[[140,50,180,50],[330,50,370,50],[520,50,560,50],[255,80,255,130],[330,160,370,160]]);

const vlf=M.dg(700,170,[
[10,15,680,70,'Log file made of virtual log files (VLFs)',1],
[30,45,100,32,'VLF 1 used',2],[140,45,100,32,'VLF 2 used',2],[250,45,100,32,'VLF 3 active',2],[360,45,100,32,'VLF 4 free',0],[470,45,100,32,'VLF 5 free',0],[580,45,100,32,'VLF 6 free',0],
[10,105,680,50,'Active log cannot be reused. Free VLFs can be reused after truncation. Many tiny VLFs slow recovery.',0]],
[]);

const trunc=M.dg(700,150,[
[10,25,170,70,'SIMPLE|reuse after|checkpoint',0],[210,25,170,70,'FULL|reuse after|log backup',2],
[410,25,280,70,'Truncation marks VLFs reusable|It does not shrink the file',0]],
[[180,60,210,60]]);

const full=M.dg(700,200,[
[10,15,210,55,'1. Read log_reuse_wait_desc',2],
[245,15,210,55,'2. Fix the reason|log backup, transaction,|replica',0],
[480,15,210,55,'3. Add space if urgent|disk or file',0],
[10,100,680,80,'4. Prevent: schedule log backups, alert at 70 percent, right-size the file',0]],
[[220,42,245,42],[455,42,480,42]]);

const rec=M.dg(700,150,[
[10,35,200,70,'Analysis|find dirty pages and|active transactions',0],[250,35,200,70,'Redo|reapply committed|changes',2],[490,35,200,70,'Undo|roll back uncommitted|changes',2]],
[[210,70,250,70],[450,70,490,70]]);

/* ---------- 0: WAL ---------- */
L['mss-core:5:0']={blocks:[
{p:'Every change in SQL Server is written to the **transaction log** before the data page is written to disk. This rule is called **write-ahead logging (WAL)**. It is what makes a commit durable and a crash recoverable.'},
{svg:wal},
{h:'What happens on a commit'},
{flow:['A change is made in the buffer pool and a log record is created','Log records are flushed from the log buffer to the log file','COMMIT returns only after the log write is hardened','Dirty data pages are written later by checkpoint or lazy writer']},
{h:'Why this matters'},
{ul:['**Durability**: committed work survives a crash because the log is on disk.','**Atomicity**: uncommitted work can be rolled back using log records.','**Performance**: commits wait for the log, so log latency limits transaction rate.','**Recovery**: backups and replicas are built from the log.']},
{h:'Look at log activity'},
{code:`-- Log size and percent used for every database
DBCC SQLPERF(LOGSPACE);

-- Same through a DMV for the current database
SELECT total_log_size_in_bytes/1048576 AS total_mb,
       used_log_space_in_bytes/1048576 AS used_mb,
       used_log_space_in_percent
FROM   sys.dm_db_log_space_usage;`},
{note:'Each log record has a log sequence number (LSN). Backups, replication and availability groups all track the LSN to know how far they have progressed.'}],
src:[['SQL Server transaction log architecture and management guide',M.RD+'sql-server-transaction-log-architecture-and-management-guide'],['sys.dm_db_log_space_usage',M.RD+'system-dynamic-management-views/sys-dm-db-log-space-usage-transact-sql']]};

/* ---------- 1: VLFs ---------- */
L['mss-core:5:1']={blocks:[
{p:'Internally the log file is split into **virtual log files (VLFs)**. The engine writes to them in order and reuses them in a circle once they are no longer needed.'},
{svg:vlf},
{h:'How many VLFs are created'},
{t:[['Growth chunk','VLFs added (older rule)'],
['Up to 64 MB','4'],
['64 MB to 1 GB','8'],
['More than 1 GB','16']]},
{p:'SQL Server 2014 and later add **one** VLF when a growth is smaller than one eighth of the current log size. In any case, **many small growths** create **many VLFs**.'},
{h:'Why too many VLFs hurt'},
{ul:['Longer **recovery** and database startup.','Slower **log backups**, log reads and replication.','Harder log management.']},
{h:'Count them'},
{code:`SELECT COUNT(*) AS vlf_count,
       SUM(CASE WHEN vlf_active = 1 THEN 1 ELSE 0 END) AS active_vlfs
FROM   sys.dm_db_log_info(DB_ID());`},
{h:'Sizing rules'},
{ul:['Size the log for the **busiest period plus log backup interval**, then add headroom.','Grow in **large, fixed steps** (for example 512 MB to 8 GB at a time) so each step adds few VLFs.','Do not leave autogrowth at tiny values such as 1 MB or 10 percent.']},
{note:'Rebuilding a log with very many VLFs means a controlled shrink and regrow of the log. Plan it after a log backup and during a quiet period.'}],
src:[['Transaction log architecture: virtual log files',M.RD+'sql-server-transaction-log-architecture-and-management-guide'],['sys.dm_db_log_info',M.RD+'system-dynamic-management-views/sys-dm-db-log-info-transact-sql']]};

/* ---------- 2: Truncation ---------- */
L['mss-core:5:2']={blocks:[
{p:'**Log truncation** frees inactive VLFs so they can be reused. It does **not** make the file smaller. When the log cannot be truncated, it must grow.'},
{svg:trunc},
{h:'What blocks truncation'},
{p:'The column `log_reuse_wait_desc` in `sys.databases` names the current reason. Learn these values:'},
{t:[['Value','Meaning','What to do'],
['**NOTHING**','Space can be reused','Fine'],
['**CHECKPOINT**','Waiting for a checkpoint','Normally clears itself'],
['**LOG_BACKUP**','FULL or BULK_LOGGED: log has not been backed up','Run a log backup, fix the schedule'],
['**ACTIVE_TRANSACTION**','An open transaction holds the log','Find it with DBCC OPENTRAN'],
['**ACTIVE_BACKUP_OR_RESTORE**','A backup or restore is running','Wait'],
['**REPLICATION**','Log reader has not caught up','Check replication agents'],
['**AVAILABILITY_REPLICA**','A secondary has not applied the log','Fix the secondary or network'],
['**OLDEST_PAGE**','Indirect checkpoint or recovery interval','Check settings']]},
{code:`SELECT name, recovery_model_desc, log_reuse_wait_desc FROM sys.databases;

-- Oldest open transaction in the current database
DBCC OPENTRAN;`},
{note:'Do not switch to SIMPLE and shrink in a panic. In FULL recovery that breaks the log backup chain and removes point-in-time recovery until you take a new full backup.'}],
src:[['Factors that can delay log truncation',M.RD+'logs/the-transaction-log-sql-server'],['sys.databases',M.RD+'system-catalog-views/sys-databases-transact-sql']]};

/* ---------- 3: Full log ---------- */
L['mss-core:5:3']={blocks:[
{p:'**Error 9002** (the transaction log is full) stops writes to a database. It is one of the most common production incidents, and the right fix depends on **why** the log was not truncated.'},
{svg:full},
{h:'Triage in order'},
{flow:['Read log_reuse_wait_desc for the database','If LOG_BACKUP: take a log backup (to a disk with space)','If ACTIVE_TRANSACTION: find the session and decide to wait, kill or fix','If AVAILABILITY_REPLICA or REPLICATION: fix the lagging component','If disk is full: add space or move/add a log file temporarily','Verify writes resume, then fix the cause']},
{code:`-- 1. Why?
SELECT name, log_reuse_wait_desc FROM sys.databases WHERE name = 'SalesDB';

-- 2. Fix: log backup (FULL recovery)
BACKUP LOG SalesDB TO DISK = 'E:\\Backup\\SalesDB_log.trn';

-- 3. Open transactions
DBCC OPENTRAN('SalesDB');

-- 4. Emergency space (temporary extra log file, remove later)
ALTER DATABASE SalesDB
  ADD LOG FILE (NAME = SalesDB_log2, FILENAME = 'F:\\SQLLog\\SalesDB_log2.ldf',
                SIZE = 2GB, FILEGROWTH = 512MB);`},
{h:'Do not'},
{ul:['Do not delete or detach the log file.','Do not run `BACKUP LOG ... WITH TRUNCATE_ONLY` (removed) or force SIMPLE without understanding the effect on recovery.','Do not shrink repeatedly. The log will just grow again.']},
{h:'Prevent it'},
{ul:['Schedule **log backups** (every 5 to 15 minutes on busy systems).','**Alert** when log use passes a threshold or when error 9002 occurs.','Size log and disk for peak activity, including index rebuilds and bulk loads.']}],
src:[['Troubleshoot a full transaction log (Error 9002)',M.RD+'logs/troubleshoot-a-full-transaction-log-sql-server-error-9002'],['DBCC OPENTRAN',M.TS+'database-console-commands/dbcc-opentran-transact-sql']]};

/* ---------- 4: Checkpoints and crash recovery ---------- */
L['mss-core:5:4']={blocks:[
{p:'If SQL Server stops suddenly, the data files may be missing changes that were already committed, and may contain changes that were not. At startup the engine uses the log to put things right. This is **crash recovery**, and **checkpoints** keep it short.'},
{h:'Checkpoint'},
{p:'A **checkpoint** writes dirty pages from memory to the data files and records a point in the log. After a checkpoint, recovery only needs log from that point on.'},
{t:[['Type','When it happens'],
['**Automatic**','Based on the recovery interval, by default about one minute of recovery work'],
['**Indirect**','Controlled by `TARGET_RECOVERY_TIME`; default 60 seconds for new databases since 2016'],
['**Manual**','You run `CHECKPOINT`'],
['**Internal**','Backup, database shutdown, adding or removing files']]},
{h:'Crash recovery in three phases'},
{svg:rec},
{ul:['**Analysis**: scan the log to find active transactions and dirty pages.','**Redo**: reapply changes that were committed but not yet in the data files.','**Undo**: roll back transactions that were not committed.']},
{h:'See it in the error log'},
{code:`-- Recovery messages at startup
EXEC sp_readerrorlog 0, 1, 'Recovery';

-- Database recovery target
SELECT name, target_recovery_time_in_seconds FROM sys.databases;

-- Force a checkpoint in the current database
CHECKPOINT;`},
{note:'A long-running transaction that was rolling back when the server stopped makes the undo phase long. Databases show "In recovery" in the log and in sys.databases state until the phase completes.'}],
src:[['Database checkpoints',M.RD+'logs/database-checkpoints-sql-server'],['Accelerated database recovery',M.RD+'accelerated-database-recovery-concepts']]};

})();
