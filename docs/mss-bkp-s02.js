/* LearnSphere - SQL Server Backup, Restore & Recovery, Section 02: Performing Backups.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const sched=M.dg(700,170,[
[10,25,150,70,'Sunday|Full backup',2],[185,25,150,70,'Mon to Sat|Differential',0],[360,25,150,70,'Every 15 min|Log backup',0],[535,25,155,70,'Daily|Check history|and verify',0],
[10,115,680,40,'A typical FULL recovery schedule. The right numbers come from RPO and RTO.',0]],
[]);

const opts=M.dg(700,170,[
[10,15,680,140,'BACKUP ... WITH',1],
[30,50,150,40,'COMPRESSION|less I/O, more CPU',0],[200,50,150,40,'CHECKSUM|detect bad pages',2],[370,50,150,40,'STATS = 10|progress',0],[540,50,130,40,'INIT|overwrite set',0],
[30,105,310,40,'TO DISK = a, DISK = b|stripe across files',0],[360,105,310,40,'COPY_ONLY|outside the chain',0]],
[]);

const hist=M.dg(700,160,[
[10,30,170,70,'backupset|one row per backup',2],[230,30,200,70,'backupmediafamily|physical file or URL',0],[480,30,210,70,'restorehistory|restores done here',0],
[10,115,680,32,'All in msdb. History grows: clean it, or the database grows with it.',0]],
[[180,65,230,65],[430,65,480,65]]);

const ver=M.dg(700,130,[
[10,25,150,60,'BACKUP ...|WITH CHECKSUM',2],[200,25,160,60,'VERIFYONLY|header, readable,|checksums',0],[400,25,140,60,'Test restore|the only proof',2],[580,25,110,60,'CHECKDB|on the copy',0]],
[[160,55,200,55],[360,55,400,55],[540,55,580,55]]);

/* ---------- 0: Full, differential, log ---------- */
L['mss-bkp:1:0']={blocks:[
{p:'The three backups you will run every day are **full**, **differential** and **log**. Each has a simple T-SQL command.'},
{svg:sched},
{code:`-- Full
BACKUP DATABASE SalesDB
  TO DISK = 'E:\\Backup\\SalesDB_full_20261010.bak'
  WITH CHECKSUM, COMPRESSION, STATS = 10;

-- Differential (needs a prior full)
BACKUP DATABASE SalesDB
  TO DISK = 'E:\\Backup\\SalesDB_diff_20261010.bak'
  WITH DIFFERENTIAL, CHECKSUM, COMPRESSION, STATS = 10;

-- Transaction log (FULL or BULK_LOGGED recovery)
BACKUP LOG SalesDB
  TO DISK = 'E:\\Backup\\SalesDB_log_20261010_0100.trn'
  WITH CHECKSUM, COMPRESSION, STATS = 10;`},
{h:'How the backup types relate'},
{t:[['Type','Size','Speed to take','Speed to restore'],
['**Full**','Largest','Slowest','Fast alone, but needs logs for point in time'],
['**Differential**','Medium, grows through the week','Faster','One extra restore step'],
['**Log**','Small, depends on activity','Very fast','Many files to replay']]},
{note:'Use unique file names with date and time. Reusing a name with the default options appends to the same file, which makes later restores confusing.'}],
src:[['BACKUP',M.TS+'statements/backup-transact-sql'],['Full database backups',M.RD+'backup-restore/full-database-backups-sql-server'],['Differential backups',M.RD+'backup-restore/differential-backups-sql-server']]};

/* ---------- 1: Options ---------- */
L['mss-bkp:1:1']={blocks:[
{p:'A handful of options decide how fast, safe and large your backups are. Learn these first.'},
{svg:opts},
{t:[['Option','Effect','Recommendation'],
['`CHECKSUM`','Verifies page checksums as pages are read and adds a checksum to the backup','Always use it'],
['`COMPRESSION`','Smaller backup, less I/O, more CPU','Use it, or set `backup compression default`'],
['`STATS = n`','Prints progress every n percent','Handy for jobs and manual runs'],
['`INIT` / `NOINIT`','Overwrite or append to the media set','Prefer unique files with INIT'],
['`FORMAT`','Starts a new media set and overwrites headers','Only on purpose'],
['`COPY_ONLY`','Does not change the backup chain or differential base','For ad hoc copies'],
['`DISK = a, DISK = b`','Stripes the backup over several files','Can speed up large backups'],
['`MAXTRANSFERSIZE`, `BUFFERCOUNT`','I/O tuning','Test before changing'],
['`CONTINUE_AFTER_ERROR`','Continues despite damaged pages','Only for a rescue backup']]},
{code:`-- Make compression the default for the instance
EXEC sp_configure 'backup compression default', 1; RECONFIGURE;

-- Striped backup over two volumes
BACKUP DATABASE SalesDB
  TO DISK = 'E:\\Backup\\SalesDB_1.bak', DISK = 'F:\\Backup\\SalesDB_2.bak'
  WITH CHECKSUM, COMPRESSION, STATS = 10;`},
{note:'SQL Server 2025 adds the ZSTD compression algorithm as an option next to the default. Check the 2025 BACKUP documentation for the syntax and test CPU use before switching.'}],
src:[['BACKUP options',M.TS+'statements/backup-transact-sql'],['Backup compression',M.RD+'backup-restore/backup-compression-sql-server']]};

/* ---------- 2: COPY_ONLY and history ---------- */
L['mss-bkp:1:2']={blocks:[
{p:'Every backup is recorded in **msdb**. The history is what restore scripts, monitoring and your own questions about "when did we last back up?" depend on.'},
{svg:hist},
{h:'Key columns of backupset'},
{t:[['Column','Meaning'],
['`type`','D full, I differential, L log, F file, G file diff, P partial, Q partial diff'],
['`backup_start_date`, `backup_finish_date`','When it ran'],
['`backup_size`, `compressed_backup_size`','Bytes'],
['`is_copy_only`','Does not affect the chain'],
['`has_backup_checksums`','Taken with CHECKSUM']]},
{code:`-- Last full, differential and log backup per database
SELECT d.name,
       MAX(CASE WHEN b.type='D' THEN b.backup_finish_date END) AS last_full,
       MAX(CASE WHEN b.type='I' THEN b.backup_finish_date END) AS last_diff,
       MAX(CASE WHEN b.type='L' THEN b.backup_finish_date END) AS last_log
FROM   sys.databases d
LEFT   JOIN msdb.dbo.backupset b ON b.database_name = d.name
WHERE  d.database_id <> 2
GROUP  BY d.name;

-- File location of a backup
SELECT bs.database_name, bs.backup_finish_date, bmf.physical_device_name
FROM   msdb.dbo.backupset bs
JOIN   msdb.dbo.backupmediafamily bmf ON bmf.media_set_id = bs.media_set_id
ORDER  BY bs.backup_finish_date DESC;

-- Clean old history
EXEC msdb.dbo.sp_delete_backuphistory @oldest_date = '2026-01-01';`},
{note:'COPY_ONLY backups are recorded too. Filter on is_copy_only when you build restore sequences so an ad hoc copy is not mistaken for part of the chain.'}],
src:[['backupset',M.RD+'system-tables/backupset-transact-sql'],['sp_delete_backuphistory',M.RD+'system-stored-procedures/sp-delete-backuphistory-transact-sql']]};

/* ---------- 3: Verifying ---------- */
L['mss-bkp:1:3']={blocks:[
{p:'A backup file can exist and still be useless. Verification comes in **levels**, and only the last one proves recoverability.'},
{svg:ver},
{t:[['Level','What it proves','What it does not prove'],
['`WITH CHECKSUM` at backup','Pages read were not corrupted in storage at that time','Anything after the backup'],
['`RESTORE VERIFYONLY`','The file is readable and complete, checksums validate','That the database restores and is consistent'],
['**Test restore**','The backup restores and runs','Nothing is left unproven'],
['**CHECKDB on the restored copy**','Logical and physical integrity','-']]},
{code:`BACKUP DATABASE SalesDB TO DISK = 'E:\\Backup\\SalesDB.bak' WITH CHECKSUM;

RESTORE VERIFYONLY FROM DISK = 'E:\\Backup\\SalesDB.bak' WITH CHECKSUM;

-- Real proof on a test server or under a different name
RESTORE DATABASE SalesDB_Verify
  FROM DISK = 'E:\\Backup\\SalesDB.bak'
  WITH MOVE 'SalesDB_d1' TO 'D:\\Test\\SalesDB_Verify.mdf',
       MOVE 'SalesDB_log' TO 'D:\\Test\\SalesDB_Verify.ldf', RECOVERY;

DBCC CHECKDB (SalesDB_Verify) WITH NO_INFOMSGS;`},
{note:'VERIFYONLY does not check the structure of data pages. A scheduled test restore plus CHECKDB is the only verification that matches what you need during an incident.'}],
src:[['RESTORE VERIFYONLY',M.TS+'statements/restore-statements-verifyonly-transact-sql'],['Backup checksums',M.RD+'backup-restore/enable-or-disable-backup-checksums-during-backup-or-restore-sql-server']]};

/* ---------- 4: SSMS and PowerShell ---------- */
L['mss-bkp:1:4']={blocks:[
{p:'T-SQL is the base. SSMS and PowerShell are two other ways to run the same backups, useful for one-off tasks and for automation.'},
{h:'SSMS'},
{flow:['Right-click the database, Tasks, Back Up','Choose backup type, destination, options','Click Script to review or save the T-SQL','Run or schedule it']},
{h:'PowerShell: SqlServer module'},
{code:`Import-Module SqlServer

Backup-SqlDatabase -ServerInstance "SQLPROD01" -Database "SalesDB" \`
  -BackupFile "E:\\Backup\\SalesDB_full.bak" -CompressionOption On -Initialize

# Log backup
Backup-SqlDatabase -ServerInstance "SQLPROD01" -Database "SalesDB" \`
  -BackupAction Log -BackupFile "E:\\Backup\\SalesDB_log.trn"`},
{h:'PowerShell: dbatools'},
{code:`# One command for all user databases, file names built for you
Backup-DbaDatabase -SqlInstance SQLPROD01 -Type Full -Path E:\\Backup -CompressBackup -Verify`},
{t:[['Method','Best for'],
['**T-SQL**','Jobs, scripts, full control'],
['**SSMS**','One-off backups, learning (use Script)'],
['**SqlServer module**','Scripts on Windows or Linux with PowerShell'],
['**dbatools**','Fleet operations, restore tests, copy tasks']]},
{note:'Whatever the tool, the engine runs a BACKUP statement. Know the T-SQL first so you can read what any tool is doing.'}],
src:[['Backup-SqlDatabase','https://learn.microsoft.com/en-us/powershell/module/sqlserver/backup-sqldatabase'],['dbatools: Backup-DbaDatabase','https://docs.dbatools.io/Backup-DbaDatabase']]};

})();
