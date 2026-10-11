/* LearnSphere - SQL Server Backup, Restore & Recovery, Section 03: Restoring Databases.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const seq=M.dg(700,200,[
[10,20,120,60,'RESTORE FULL|NORECOVERY',2],[150,20,120,60,'RESTORE DIFF|NORECOVERY',0],[290,20,120,60,'RESTORE LOG 1|NORECOVERY',0],
[430,20,120,60,'RESTORE LOG n|NORECOVERY',0],[570,20,120,60,'RESTORE ...|WITH RECOVERY',2],
[10,115,680,70,'State while restoring: RESTORING (not usable). After RECOVERY: ONLINE. No more backups can be applied.',0]],
[[130,50,150,50],[270,50,290,50],[410,50,430,50],[550,50,570,50]]);

const mv=M.dg(700,150,[
[10,30,180,70,'Backup file|logical names:|SalesDB_d1, SalesDB_log',0],[230,30,220,70,'RESTORE ... WITH MOVE|map each logical name|to a new path',2],[490,30,200,70,'New files|D:\\Test\\...|on this server',0]],
[[190,65,230,65],[450,65,490,65]]);

const insp=M.dg(700,170,[
[10,20,160,60,'HEADERONLY|what backups are|in this file',2],[190,20,160,60,'FILELISTONLY|database files in|the backup',0],[370,20,160,60,'LABELONLY|media set info',0],[550,20,140,60,'VERIFYONLY|file readable',0],
[10,105,680,50,'Run these first. They read headers only, so they are fast and safe.',0]],
[]);

const pick=M.dg(700,170,[
[10,25,150,70,'1. Latest full|before target',2],[190,25,150,70,'2. Latest diff|after that full',0],[370,25,150,70,'3. All logs after the|diff, in LSN order',0],[550,25,140,70,'4. Stop at|target, RECOVERY',2],
[10,115,680,40,'Skip any step that does not exist. Verify LSNs form an unbroken chain.',0]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

const mig=M.dg(700,180,[
[10,20,200,60,'Restore under a|new name',2],[250,20,200,60,'Fix orphaned|users and logins',0],[490,20,200,60,'Check compatibility|level and settings',0],
[10,110,680,55,'Logins live in master, users live in the database. After moving a database, map them again.',0]],
[[210,50,250,50],[450,50,490,50]]);

/* ---------- 0: RESTORE sequence ---------- */
L['mss-bkp:2:0']={blocks:[
{p:'A restore is a **sequence** of RESTORE statements. All but the last use `NORECOVERY`, so the database stays open for the next backup. The last one uses `RECOVERY` and brings the database online.'},
{svg:seq},
{code:`-- Simplest case: one full backup
RESTORE DATABASE SalesDB FROM DISK = 'E:\\Backup\\SalesDB_full.bak'
  WITH RECOVERY, STATS = 10;

-- Several steps
RESTORE DATABASE SalesDB FROM DISK = 'E:\\Backup\\SalesDB_full.bak'
  WITH NORECOVERY, REPLACE, STATS = 10;
RESTORE DATABASE SalesDB FROM DISK = 'E:\\Backup\\SalesDB_diff.bak'
  WITH NORECOVERY, STATS = 10;
RESTORE LOG SalesDB FROM DISK = 'E:\\Backup\\SalesDB_log_0100.trn' WITH NORECOVERY;
RESTORE LOG SalesDB FROM DISK = 'E:\\Backup\\SalesDB_log_0200.trn' WITH NORECOVERY;

-- Finish
RESTORE DATABASE SalesDB WITH RECOVERY;`},
{h:'Options to know'},
{t:[['Option','Meaning'],
['`RECOVERY`','Finish and bring online'],
['`NORECOVERY`','Stay in RESTORING, ready for more'],
['`STANDBY = file`','Read-only access between log restores'],
['`REPLACE`','Overwrite an existing database of the same name'],
['`STATS = n`','Show progress'],
['`CHECKSUM`','Validate checksums during restore']]},
{note:'REPLACE overwrites a database without asking. Check the database name and server before you run it.'}],
src:[['RESTORE statements',M.TS+'statements/restore-statements-transact-sql'],['Restore a database backup',M.RD+'backup-restore/restore-a-database-backup-using-ssms']]};

/* ---------- 1: MOVE ---------- */
L['mss-bkp:2:1']={blocks:[
{p:'A backup stores the **logical** and the **original physical** names of the files. When the target server has different paths, or you restore next to the original, you use `WITH MOVE` to say where each file goes.'},
{svg:mv},
{flow:['RESTORE FILELISTONLY to read the logical file names','Choose a new path for each file','RESTORE ... WITH MOVE for every file','Verify files with sys.master_files']},
{code:`-- 1. Get logical names
RESTORE FILELISTONLY FROM DISK = 'E:\\Backup\\SalesDB_full.bak';

-- 2. Restore with new paths
RESTORE DATABASE SalesDB_Test
  FROM DISK = 'E:\\Backup\\SalesDB_full.bak'
  WITH MOVE 'SalesDB_sys' TO 'D:\\Test\\SalesDB_Test.mdf',
       MOVE 'SalesDB_d1'  TO 'D:\\Test\\SalesDB_Test_d1.ndf',
       MOVE 'SalesDB_log' TO 'L:\\Test\\SalesDB_Test.ldf',
       RECOVERY, STATS = 10;`},
{ul:['Every file must be moved, or it goes to its original path.','The target folders must exist and be writable by the SQL Server service account.','The new database name must be different if the original still exists and you did not use `REPLACE`.']}],
src:[['Restore a database to a new location',M.RD+'backup-restore/restore-a-database-to-a-new-location-sql-server'],['RESTORE FILELISTONLY',M.TS+'statements/restore-statements-filelistonly-transact-sql']]};

/* ---------- 2: Inspecting backups ---------- */
L['mss-bkp:2:2']={blocks:[
{p:'Before you restore from a file you did not make, **look inside it**. A few lightweight commands tell you what the file holds and whether it is the one you want.'},
{svg:insp},
{code:`RESTORE HEADERONLY    FROM DISK = 'E:\\Backup\\SalesDB_full.bak';
RESTORE FILELISTONLY  FROM DISK = 'E:\\Backup\\SalesDB_full.bak';
RESTORE LABELONLY     FROM DISK = 'E:\\Backup\\SalesDB_full.bak';
RESTORE VERIFYONLY    FROM DISK = 'E:\\Backup\\SalesDB_full.bak' WITH CHECKSUM;`},
{h:'What to read in HEADERONLY'},
{t:[['Column','Why it matters'],
['`BackupType`','1 full, 2 log, 5 differential'],
['`DatabaseName`, `ServerName`','Is it the right database and origin?'],
['`BackupStartDate`, `BackupFinishDate`','How recent is it?'],
['`FirstLSN`, `LastLSN`, `DatabaseBackupLSN`','Does it fit the chain?'],
['`Position`','Which backup in a file that holds several'],
['`IsCopyOnly`, `HasBackupChecksums`','Chain and integrity']]},
{note:'A single .bak file can contain several backups (Position 1, 2, 3...). Use `WITH FILE = n` in RESTORE to choose the one you want.'}],
src:[['RESTORE HEADERONLY',M.TS+'statements/restore-statements-headeronly-transact-sql'],['RESTORE LABELONLY',M.TS+'statements/restore-statements-labelonly-transact-sql']]};

/* ---------- 3: Differentials and log chains ---------- */
L['mss-bkp:2:3']={blocks:[
{p:'The fastest correct restore uses the **fewest backups that cover the target time**: the latest full before it, the latest differential after that, then logs.'},
{svg:pick},
{h:'Choosing the files'},
{code:`-- Candidate files from msdb history, newest first
SELECT bs.type, bs.backup_start_date, bs.backup_finish_date,
       bs.first_lsn, bs.last_lsn, bs.database_backup_lsn, bmf.physical_device_name
FROM   msdb.dbo.backupset bs
JOIN   msdb.dbo.backupmediafamily bmf ON bmf.media_set_id = bs.media_set_id
WHERE  bs.database_name = 'SalesDB' AND bs.is_copy_only = 0
ORDER  BY bs.backup_finish_date DESC;`},
{h:'Rules'},
{ul:['A differential is based on **one specific full**. Use the one whose LSN matches.','Each log backup must start at the LSN where the previous one stopped.','If a log is missing, you can restore only up to the break.','Stop at the last required step with `RECOVERY`.']},
{h:'Scripts that do this for you'},
{p:'Reading LSNs by hand is slow in an emergency. Use `Restore-DbaDatabase` from dbatools or your backup tool to build the sequence from history or from a folder, then **read the plan before running it**.'},
{code:`# Plan a point-in-time restore from a folder of backups, do not run yet
Restore-DbaDatabase -SqlInstance SQLTEST01 -Path E:\\Backup\\SalesDB -OutputScriptOnly`}],
src:[['Restore a differential database backup',M.RD+'backup-restore/restore-a-differential-database-backup-sql-server'],['Apply transaction log backups',M.RD+'backup-restore/apply-transaction-log-backups-sql-server']]};

/* ---------- 4: New name and server ---------- */
L['mss-bkp:2:4']={blocks:[
{p:'Restoring to **another name** or **another server** is how you test backups, build dev copies and recover next to a damaged database. A few extras must be handled.'},
{svg:mig},
{h:'What to check'},
{t:[['Item','Why'],
['**Version**','You can restore to the same or a newer version, never older'],
['**Edition features**','A database using Enterprise-only features may need extra steps on lower editions'],
['**Logins**','Logins are in master. Users in the database lose their match if SIDs differ'],
['**Compatibility level**','Stays as it was until you change it'],
['**Collation**','Database collation is kept; tempdb joins may be affected if the instance differs'],
['**Jobs, linked servers, credentials**','Live outside the database']]},
{h:'Fix orphaned users'},
{code:`-- Users whose login (SID) is not found on this server
SELECT dp.name AS user_name, dp.sid
FROM   sys.database_principals dp
LEFT   JOIN sys.server_principals sp ON sp.sid = dp.sid
WHERE  dp.type IN ('S','U') AND sp.sid IS NULL AND dp.name NOT IN ('guest','INFORMATION_SCHEMA','sys');

-- Re-map a user to a login with the same name
ALTER USER appuser WITH LOGIN = appuser;`},
{note:'Create logins on the target with the same SID, or use contained databases, to avoid orphaned users. The Security sub-course covers both.'}],
src:[['Copy databases with backup and restore',M.RD+'databases/copy-databases-with-backup-and-restore'],['Troubleshoot orphaned users',M.SQL+'sql-server/failover-clusters/troubleshoot-orphaned-users-sql-server']]};

})();
