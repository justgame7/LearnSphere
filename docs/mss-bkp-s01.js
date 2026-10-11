/* LearnSphere - SQL Server Backup, Restore & Recovery, Section 01: Backup & Recovery Foundations.
   Lectures 0-4 are core, 5 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const fail=M.dg(700,220,[
[10,10,680,200,'What can go wrong, from small to large',1],
[30,45,150,55,'Statement fails|rolled back, no restore',0],[200,45,150,55,'Instance crash|crash recovery',0],[370,45,150,55,'User error|DELETE, DROP',2],[540,45,130,55,'Corruption|bad page',2],
[30,125,310,55,'Media failure: disk, volume or LUN lost',2],[370,125,300,55,'Site disaster or ransomware|needs off-site, protected copy',2]],
[]);

const rpo=M.dg(700,150,[
[10,25,200,70,'Last good backup|or transaction',0],[250,25,200,70,'Failure|point of loss',2],[490,25,200,70,'Service restored|data usable again',0],
[10,115,440,28,'RPO: how much data you can lose (time between)',0],[250,115,440,28,'RTO: how long you can be down (time after)',0]],
[[210,60,250,60],[450,60,490,60]]);

const types=M.dg(700,200,[
[10,15,215,80,'Full|all data pages|plus enough log|the base of every chain',2],[245,15,215,80,'Differential|extents changed since|the last full|smaller and quicker',0],[480,15,210,80,'Log|log records since the|previous log backup|FULL or BULK_LOGGED only',2],
[10,115,680,70,'Also: copy-only (outside the chain), file and filegroup, partial, and tail-log backups',0]],
[]);

const rec=M.dg(700,150,[
[10,35,180,70,'Restore data files|copy pages from the|backup',0],[230,35,220,70,'Roll forward (redo)|apply committed log|records',2],[490,35,200,70,'Roll back (undo)|remove uncommitted|work, open database',2]],
[[190,70,230,70],[450,70,490,70]]);

const chain=M.dg(700,170,[
[10,45,110,60,'Full|Sun 00:00',2],[150,45,110,60,'Diff|Mon 00:00',0],[290,45,100,60,'Log|01:00',0],[420,45,100,60,'Log|02:00',0],[550,45,100,60,'Log|03:00',0],
[10,130,640,30,'Each log backup starts at the LSN where the previous one ended: no gaps allowed',0]],
[[120,75,150,75],[260,75,290,75],[390,75,420,75],[520,75,550,75]]);

/* ---------- 0: Failure types ---------- */
L['mss-bkp:0:0']={blocks:[
{p:'A **backup strategy** starts with a question: what could go wrong, and what does each failure need? Different failures need different recovery tools. A backup that covers one kind of failure may be useless for another.'},
{svg:fail},
{t:[['Failure','Example','What recovers it'],
['**Statement failure**','Constraint violation, deadlock victim','Nothing: the statement is rolled back'],
['**Instance or process crash**','Power loss, service kill','Crash recovery at startup (log)'],
['**User error**','`DELETE` without `WHERE`, dropped table','Point-in-time restore from full and log backups'],
['**Corruption**','Bad page, storage bug','Restore from backup, or page restore'],
['**Media failure**','Lost disk or volume','Restore all affected files from backup'],
['**Site disaster / ransomware**','Datacenter loss, encrypted backups','Off-site, immutable or offline copy']]},
{h:'Key idea'},
{ul:['**High availability** features (clusters, availability groups) protect against hardware failure but **replicate mistakes** too: a dropped table is dropped everywhere.','Only **backups** let you go back in time.','A backup you have never restored is a hope, not a plan.']},
{note:'Write down, for each database, which of these failures you plan for and the proof that the plan works.'}],
src:[['Backup overview',M.RD+'backup-restore/backup-overview-sql-server'],['Back up and restore of SQL Server databases',M.RD+'backup-restore/back-up-and-restore-of-sql-server-databases']]};

/* ---------- 1: RPO, RTO ---------- */
L['mss-bkp:0:1']={blocks:[
{p:'Two numbers drive every backup design: **RPO** and **RTO**. They come from the business, not from the DBA.'},
{svg:rpo},
{t:[['Term','Question it answers','Drives'],
['**RPO** (recovery point objective)','How much data can we lose?','How often you back up the log'],
['**RTO** (recovery time objective)','How long can we be down?','Restore speed, backup types, hardware']]},
{h:'From numbers to a schedule'},
{t:[['Requirement','Possible design'],
['RPO 24 hours','Nightly full backup, SIMPLE or FULL recovery'],
['RPO 1 hour','FULL recovery, hourly log backups plus nightly full'],
['RPO 5 to 15 minutes','FULL recovery, log backups every 5 to 15 minutes, daily differential'],
['RPO near zero','Add availability groups, still keep backups'],
['Short RTO','Frequent differentials, fast storage, rehearsed runbook']]},
{h:'Estimate your RTO'},
{p:'Restore time is roughly **copy time of the full backup + the differential + all logs to replay + recovery**. The only honest number is the one you measure in a **test restore**.'},
{code:`-- How long did past backups take and how big are they?
SELECT TOP (10) database_name, type,
       backup_start_date, backup_finish_date,
       DATEDIFF(second, backup_start_date, backup_finish_date) AS seconds,
       backup_size/1048576 AS size_mb, compressed_backup_size/1048576 AS compressed_mb
FROM   msdb.dbo.backupset
ORDER  BY backup_finish_date DESC;`},
{note:'Agree the RPO and RTO in writing with the application owner, and review them at least once a year or after a major change.'}],
src:[['Back up and restore of SQL Server databases',M.RD+'backup-restore/back-up-and-restore-of-sql-server-databases'],['backupset',M.RD+'system-tables/backupset-transact-sql']]};

/* ---------- 2: Recovery models and backup types ---------- */
L['mss-bkp:0:2']={blocks:[
{p:'The **recovery model** (SIMPLE, FULL, BULK_LOGGED) controls the log. The **backup types** you can take depend on it.'},
{svg:types},
{t:[['Backup type','Contains','Needs recovery model','Restore needs'],
['**Full**','All data pages + log needed for consistency','Any','Itself'],
['**Differential**','Extents changed since the last full','Any','The matching full'],
['**Transaction log**','Log records since the last log backup','FULL or BULK_LOGGED','Full, optional diff, all logs in order'],
['**Copy-only**','Full or log, no effect on the chain','Any (log: FULL/BULK)','Itself or as an extra copy'],
['**File / filegroup**','Selected files','Any (read-write files need FULL for log)','Piecemeal and partial restores'],
['**Tail-log**','Log not yet backed up, taken before a restore','FULL or BULK_LOGGED','Last step before a restore']]},
{h:'Rule of thumb'},
{ul:['**SIMPLE**: only full and differential backups. Recovery goes back to the last backup.','**FULL**: full + differential + log. Recovery to any point in time.','**BULK_LOGGED**: like FULL, for short bulk-load windows.']},
{code:`SELECT name, recovery_model_desc, log_reuse_wait_desc FROM sys.databases;`}],
src:[['Backup overview',M.RD+'backup-restore/backup-overview-sql-server'],['Recovery models',M.RD+'backup-restore/recovery-models-sql-server']]};

/* ---------- 3: How recovery works ---------- */
L['mss-bkp:0:3']={blocks:[
{p:'A restore is not just copying files back. SQL Server must make the database **transactionally consistent**. It does this with the same three phases used at crash recovery.'},
{svg:rec},
{h:'The phases'},
{t:[['Phase','What happens'],
['**Copy (data copy)**','Pages are copied from the backup into the database files'],
['**Redo (roll forward)**','Committed changes in the log are reapplied'],
['**Undo (roll back)**','Transactions that were not committed are rolled back']]},
{h:'RECOVERY vs NORECOVERY'},
{flow:['RESTORE ... WITH NORECOVERY: copy and redo, skip undo; database stays in RESTORING','RESTORE the next backup in the chain, again WITH NORECOVERY','RESTORE the last backup WITH RECOVERY: undo, database comes online']},
{note:'Once a database is recovered you cannot apply more backups to it. If you meant to restore a log backup after a full backup and you used RECOVERY, you must start again with the full backup.'},
{h:'See it'},
{code:`SELECT name, state_desc FROM sys.databases;   -- RESTORING, ONLINE, RECOVERING

-- Progress of a running restore
SELECT session_id, command, percent_complete, estimated_completion_time/1000 AS sec_left
FROM   sys.dm_exec_requests
WHERE  command LIKE 'RESTORE%';`}],
src:[['Restore and recovery overview',M.RD+'backup-restore/restore-and-recovery-overview-sql-server'],['RESTORE statements',M.TS+'statements/restore-statements-transact-sql']]};

/* ---------- 4: Chains and LSN ---------- */
L['mss-bkp:0:4']={blocks:[
{p:'Every log record has a **log sequence number (LSN)**. Backups record the LSNs they cover, and SQL Server uses them to check that a restore sequence is complete and in order.'},
{svg:chain},
{h:'Important LSN columns'},
{t:[['Column in backupset','Meaning'],
['`first_lsn`, `last_lsn`','Range of log covered'],
['`checkpoint_lsn`','Checkpoint that the backup is based on'],
['`database_backup_lsn`','The full backup a differential or log backup relates to'],
['`differential_base_lsn`','The full backup a differential is based on'],
['`is_copy_only`','1 when it does not affect the chain']]},
{code:`SELECT TOP (20) database_name, type, backup_start_date,
       first_lsn, last_lsn, database_backup_lsn, differential_base_lsn, is_copy_only
FROM   msdb.dbo.backupset
WHERE  database_name = 'SalesDB'
ORDER  BY backup_finish_date DESC;`},
{h:'What breaks the log chain'},
{ul:['Switching to **SIMPLE** and back to FULL without a new full backup.','A **missing or damaged** log backup.','Restoring a database over itself and continuing without a proper restore sequence.','Another process taking log backups (a tool or a second job) that you do not have.']},
{note:'A regular full backup does not break the log chain. A **copy-only** full backup does not reset the differential base either, so it is safe for ad hoc copies.'}],
src:[['Transaction log backups',M.RD+'backup-restore/transaction-log-backups-sql-server'],['backupset',M.RD+'system-tables/backupset-transact-sql']]};

})();
