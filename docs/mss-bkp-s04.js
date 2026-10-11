/* LearnSphere - SQL Server Backup, Restore & Recovery, Section 04: Point-in-Time & Partial Recovery.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const tail=M.dg(700,150,[
[10,30,160,70,'Database damaged|or about to be|overwritten',0],[210,30,230,70,'BACKUP LOG|WITH NORECOVERY or NO_TRUNCATE|captures the tail',2],[480,30,210,70,'Restore chain|full, diff, logs, tail|then RECOVERY',0]],
[[170,65,210,65],[440,65,480,65]]);

const stopat=M.dg(700,150,[
[10,40,120,60,'Full + diff|restored|NORECOVERY',0],[160,40,120,60,'Log 13:00|NORECOVERY',0],[310,40,150,60,'Log 14:00|STOPAT 13:42|RECOVERY',2],[500,40,190,60,'Database as of 13:42|log after 13:42 not applied',0]],
[[130,70,160,70],[280,70,310,70],[460,70,500,70]]);

const page=M.dg(700,170,[
[10,20,170,70,'Find damaged page|suspect_pages or|CHECKDB',0],[220,20,230,70,'RESTORE DATABASE ... PAGE|from full, then diff and logs|NORECOVERY',2],[490,20,200,70,'Tail-log backup and|restore log WITH RECOVERY',0],
[10,110,680,45,'Few pages, FULL recovery. Online in Enterprise, offline for the page in other editions.',0]],
[[180,55,220,55],[450,55,490,55]]);

const pieces=M.dg(700,170,[
[10,20,200,70,'PRIMARY|restored first with PARTIAL|database online',2],[250,20,200,70,'Current data filegroup|restore second|users can work',2],[490,20,200,70,'Archive filegroups|restore last, from|read-only backups',0],
[10,115,680,40,'Piecemeal restore: bring the important data online first, then the rest',0]],
[[210,55,250,55],[450,55,490,55]]);

const play=M.dg(700,200,[
[10,15,150,60,'1. Stop the|damage',2],[180,15,150,60,'2. Note the time|of the mistake',0],[350,15,150,60,'3. Restore a copy|STOPAT before it',0],[520,15,170,60,'4. Copy rows back|or swap databases',2],
[10,105,680,80,'Do not restart services, do not restore over production in a hurry,|and keep the log chain: take a log backup before you start',0]],
[[160,45,180,45],[330,45,350,45],[500,45,520,45]]);

/* ---------- 0: Tail-log ---------- */
L['mss-bkp:3:0']={blocks:[
{p:'The **tail** of the log is everything written since the last log backup. If you restore over a database without saving it, those transactions are lost. A **tail-log backup** captures them first.'},
{svg:tail},
{code:`-- Database is still readable: back up the tail and leave it restoring
BACKUP LOG SalesDB TO DISK = 'E:\\Backup\\SalesDB_tail.trn'
  WITH NORECOVERY, CHECKSUM;

-- Database is damaged and offline: try to save what you can
BACKUP LOG SalesDB TO DISK = 'E:\\Backup\\SalesDB_tail.trn'
  WITH NO_TRUNCATE, CONTINUE_AFTER_ERROR;`},
{h:'When you need it'},
{ul:['Before restoring over a **FULL recovery** database (SQL Server warns you with error 3159).','When the data files are lost but the **log file** is still intact.','Before a planned failover or migration, to move the final transactions.']},
{note:'`NORECOVERY` puts the database in RESTORING, so no one can change it after the tail backup. That is exactly what you want before a restore.'}],
src:[['Tail-log backups',M.RD+'backup-restore/tail-log-backups-sql-server'],['BACKUP',M.TS+'statements/backup-transact-sql']]};

/* ---------- 1: STOPAT ---------- */
L['mss-bkp:3:1']={blocks:[
{p:'**Point-in-time restore** brings a database back to a chosen moment, usually just before a mistake. It needs **FULL** (or BULK_LOGGED) recovery and an unbroken set of log backups.'},
{svg:stopat},
{code:`RESTORE DATABASE SalesDB_Pit FROM DISK = 'E:\\Backup\\SalesDB_full.bak'
  WITH MOVE 'SalesDB_d1' TO 'D:\\Test\\Pit_d1.ndf',
       MOVE 'SalesDB_sys' TO 'D:\\Test\\Pit.mdf',
       MOVE 'SalesDB_log' TO 'L:\\Test\\Pit.ldf', NORECOVERY;

RESTORE LOG SalesDB_Pit FROM DISK = 'E:\\Backup\\SalesDB_log_1300.trn' WITH NORECOVERY;

RESTORE LOG SalesDB_Pit FROM DISK = 'E:\\Backup\\SalesDB_log_1400.trn'
  WITH STOPAT = '2026-10-10 13:42:00', RECOVERY;`},
{h:'Ways to define the stop point'},
{t:[['Option','Use'],
['`STOPAT = datetime`','A time, rounded as written'],
['`STOPATMARK = name`','Right after a marked transaction'],
['`STOPBEFOREMARK = name`','Just before a marked transaction'],
['`STOPATMARK = lsn:number`','Exact LSN position, when known']]},
{h:'Practical advice'},
{ul:['Restore to a **new name** first, so you can check the result before you touch production.','Use the application log or user report to **find the time**, then restore a minute or two before it.','The last log in the chain must **contain** the stop time.']},
{note:'Time zones matter. The STOPAT value uses the server local time as recorded in the log, not the user time zone.'}],
src:[['Restore a SQL Server database to a point in time',M.RD+'backup-restore/restore-a-sql-server-database-to-a-point-in-time-full-recovery-model'],['RESTORE arguments',M.TS+'statements/restore-statements-arguments-transact-sql']]};

/* ---------- 2: Page restore ---------- */
L['mss-bkp:3:2']={blocks:[
{p:'If only a **few pages** are damaged, restoring the whole database is a waste. A **page restore** replaces just those pages from backup and replays the log to make them current.'},
{svg:page},
{h:'Requirements'},
{ul:['Database in **FULL** or **BULK_LOGGED** recovery.','A full backup that holds good copies of the pages, plus all later log backups, and a **tail-log backup**.','Only data pages: not the allocation pages and not log.']},
{code:`-- Which pages are damaged?
SELECT database_id, file_id, page_id, event_type, last_update_date
FROM   msdb.dbo.suspect_pages;

-- Restore two pages (file:page)
RESTORE DATABASE SalesDB PAGE = '1:57, 1:202'
  FROM DISK = 'E:\\Backup\\SalesDB_full.bak' WITH NORECOVERY;

-- Apply later differentials and logs, then the tail
RESTORE LOG SalesDB FROM DISK = 'E:\\Backup\\SalesDB_log_0100.trn' WITH NORECOVERY;
BACKUP LOG SalesDB TO DISK = 'E:\\Backup\\SalesDB_tail.trn';
RESTORE LOG SalesDB FROM DISK = 'E:\\Backup\\SalesDB_tail.trn' WITH RECOVERY;`},
{note:'In Enterprise edition the rest of the database stays online during a page restore. In other editions the database is offline for the duration. Availability groups can also repair pages automatically from a replica.'}],
src:[['Restore pages',M.RD+'backup-restore/restore-pages-sql-server'],['suspect_pages',M.RD+'system-tables/suspect-pages-transact-sql']]};

/* ---------- 3: Filegroup and piecemeal ---------- */
L['mss-bkp:3:3']={blocks:[
{p:'Very large databases do not need to come back all at once. A **piecemeal restore** brings the **primary** and the most important filegroups online first, then the rest.'},
{svg:pieces},
{t:[['Term','Meaning'],
['**File or filegroup restore**','Restore only some files, then apply logs to make them current'],
['**Partial restore**','Start with PRIMARY and selected filegroups, leave others offline'],
['**Piecemeal**','Several restore steps over time, each bringing more filegroups online']]},
{code:`-- Step 1: PRIMARY and the current-data filegroup
RESTORE DATABASE SalesDB FILEGROUP = 'PRIMARY', FILEGROUP = 'FG_CURRENT'
  FROM DISK = 'E:\\Backup\\SalesDB_full.bak' WITH PARTIAL, NORECOVERY;
RESTORE LOG SalesDB FROM DISK = 'E:\\Backup\\SalesDB_log.trn' WITH RECOVERY;

-- Step 2, database already online: restore an archive filegroup
RESTORE DATABASE SalesDB FILEGROUP = 'FG_ARCHIVE'
  FROM DISK = 'E:\\Backup\\SalesDB_archive.bak' WITH RECOVERY;`},
{h:'Design hint'},
{ul:['Keep **current** and **archive** data in different filegroups.','Mark old filegroups **READ_ONLY** and back them up once.','This also needs FULL recovery for read-write filegroups.']},
{note:'Online restore of filegroups needs Enterprise edition. In other editions the database is offline while the restore runs.'}],
src:[['Piecemeal restores',M.RD+'backup-restore/piecemeal-restores-sql-server'],['Partial backups',M.RD+'backup-restore/partial-backups-sql-server']]};

/* ---------- 4: Accidental DELETE ---------- */
L['mss-bkp:3:4']={blocks:[
{p:'An accidental **DELETE**, **UPDATE** or **DROP** is the most common reason to restore. The aim is to get the lost data back **without** losing the good changes made since.'},
{svg:play},
{h:'Playbook'},
{flow:['Stop the application or the user doing damage; do not restart SQL Server','Write down the time of the mistake and who ran it','Take a log backup now so the chain stays safe','Restore a copy under a new name with STOPAT just before the mistake','Check the data, then copy the rows back into production','Only if the damage is wide, switch to the restored copy or restore over production']},
{code:`-- Rows that existed before the delete, from the restored copy
SET IDENTITY_INSERT sales.Orders ON;

INSERT sales.Orders (OrderID, CustomerID, OrderDate, TotalDue)
SELECT o.OrderID, o.CustomerID, o.OrderDate, o.TotalDue
FROM   SalesDB_Pit.sales.Orders o
WHERE  NOT EXISTS (SELECT 1 FROM SalesDB.sales.Orders p WHERE p.OrderID = o.OrderID);

SET IDENTITY_INSERT sales.Orders OFF;`},
{h:'Decide'},
{t:[['Damage','Best route'],
['**A few rows or one table**','Side-by-side restore, copy the rows back'],
['**Many tables, short outage allowed**','Restore over production with STOPAT after a tail-log backup'],
['**Schema dropped**','Restore a copy, script the objects, deploy them'],
['**Only recent mistake**','Consider the database snapshot or app-level undo, if available']]},
{note:'Always test the copy. Check foreign keys and identity values before you insert rows into production.'}],
src:[['Restore a SQL Server database to a point in time',M.RD+'backup-restore/restore-a-sql-server-database-to-a-point-in-time-full-recovery-model'],['Database snapshots',M.RD+'databases/database-snapshots-sql-server']]};

})();
