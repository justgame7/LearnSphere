/* LearnSphere - SQL Server Backup, Restore & Recovery, Section 10: Recovery Drills.
   Lectures 0-4 are core, 5 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const drill=M.dg(700,150,[
[10,25,120,70,'1. Break|safely, in a lab',0],[150,25,120,70,'2. Detect|alert, error log',0],[290,25,120,70,'3. Decide|runbook',2],[430,25,120,70,'4. Recover|timed',2],[570,25,120,70,'5. Prove|CHECKDB, queries',0]],
[[130,60,150,60],[270,60,290,60],[410,60,430,60],[550,60,570,60]]);

const drive=M.dg(700,170,[
[10,25,150,70,'Data drive lost|database SUSPECT or|OFFLINE',0],[190,25,170,70,'Tail-log backup|log file on another|drive',2],[390,25,150,70,'Restore full,|diff, logs WITH MOVE|to a new drive',2],[570,25,120,70,'RECOVERY and|CHECKDB',0]],
[[160,60,190,60],[360,60,390,60],[540,60,570,60]]);

const drop=M.dg(700,150,[
[10,25,150,70,'DROP TABLE|ran at 14:20',0],[190,25,180,70,'Restore copy to|14:19 under a new name',2],[400,25,150,70,'Script table and|copy data back',2],[580,25,110,70,'Indexes, keys,|permissions',0]],
[[160,60,190,60],[370,60,400,60],[550,60,580,60]]);

const pg=M.dg(700,150,[
[10,25,150,70,'Query fails|error 824',0],[190,25,170,70,'suspect_pages|and CHECKDB name|the page',0],[390,25,150,70,'Page restore from|full and logs',2],[570,25,120,70,'CHECKDB clean|alert closed',0]],
[[160,60,190,60],[360,60,390,60],[540,60,570,60]]);

const cer=M.dg(700,150,[
[10,25,170,70,'Restore fails|cannot find|certificate',0],[210,25,170,70,'Find certificate|and key backup|and password',2],[410,25,150,70,'CREATE CERTIFICATE|FROM FILE',2],[590,25,100,70,'Restore|succeeds',0]],
[[180,60,210,60],[380,60,410,60],[560,60,590,60]]);

/* ---------- 0: Drill, lost data drive ---------- */
L['mss-bkp:9:0']={blocks:[
{p:'A **drill** is a rehearsed failure. You learn what your backups and runbook really do while nothing is at stake. Run these only in a **lab**.'},
{svg:drill},
{h:'Drill 1: the data drive is lost'},
{svg:drive},
{h:'Set up'},
{ul:['A database `DrillDB` with data on `D:` and log on `L:`, FULL recovery.','A full backup, a differential and two log backups, plus some changes after the last log backup.']},
{h:'Break it'},
{p:'Take the `D:` volume offline, or stop the service and rename the data file folder. The database becomes unavailable.'},
{h:'Recover'},
{code:`-- 1. Save the tail (log file still on L:)
BACKUP LOG DrillDB TO DISK = 'E:\\Backup\\DrillDB_tail.trn' WITH NO_TRUNCATE, CONTINUE_AFTER_ERROR;

-- 2. Restore the chain to a new drive
RESTORE DATABASE DrillDB FROM DISK = 'E:\\Backup\\DrillDB_full.bak'
  WITH MOVE 'DrillDB_d1' TO 'F:\\Data\\DrillDB_d1.mdf', MOVE 'DrillDB_log' TO 'L:\\Log\\DrillDB_log.ldf',
       REPLACE, NORECOVERY;
RESTORE DATABASE DrillDB FROM DISK = 'E:\\Backup\\DrillDB_diff.bak' WITH NORECOVERY;
RESTORE LOG DrillDB FROM DISK = 'E:\\Backup\\DrillDB_log_1.trn' WITH NORECOVERY;
RESTORE LOG DrillDB FROM DISK = 'E:\\Backup\\DrillDB_tail.trn'  WITH RECOVERY;

-- 3. Prove
DBCC CHECKDB (DrillDB) WITH NO_INFOMSGS;`},
{h:'Success looks like'},
{ul:['All committed rows, including those after the last log backup, are present.','CHECKDB is clean.','You recorded the **time taken** and any command you had to look up.']}],
src:[['Complete database restores in FULL recovery',M.RD+'backup-restore/complete-database-restores-full-recovery-model'],['Tail-log backups',M.RD+'backup-restore/tail-log-backups-sql-server']]};

/* ---------- 1: Drill, dropped table ---------- */
L['mss-bkp:9:1']={blocks:[
{p:'**Drill 2: a table is dropped.** The most common human error. The answer is a side-by-side point-in-time restore, then a controlled copy back.'},
{svg:drop},
{h:'Set up and break'},
{code:`-- Lab only
CREATE TABLE dbo.Customers (CustomerID int PRIMARY KEY, Name nvarchar(100));
INSERT dbo.Customers VALUES (1,'Alpha'),(2,'Beta'),(3,'Gamma');
-- take log backup here, then:
SELECT GETDATE() AS time_before_drop;
DROP TABLE dbo.Customers;`},
{h:'Recover'},
{flow:['Take a log backup now: keep the chain whole','Restore full, diff and logs to a new database with STOPAT just before the DROP','Create the table in production from the copy (script it) and insert the data','Recreate indexes, constraints, triggers and permissions from the script','Check dependent views and procedures']},
{code:`RESTORE DATABASE DrillDB_Pit FROM DISK = 'E:\\Backup\\DrillDB_full.bak'
  WITH MOVE 'DrillDB_d1' TO 'F:\\Data\\Pit.mdf', MOVE 'DrillDB_log' TO 'L:\\Log\\Pit.ldf', NORECOVERY;
RESTORE LOG DrillDB_Pit FROM DISK = 'E:\\Backup\\DrillDB_log_1.trn'
  WITH STOPAT = '2026-10-10 14:19:00', RECOVERY;

SELECT * INTO DrillDB.dbo.Customers FROM DrillDB_Pit.dbo.Customers;`},
{note:'SELECT INTO does not copy indexes, keys or permissions. Script the original table from the copy and run that script instead.'}],
src:[['Restore to a point in time',M.RD+'backup-restore/restore-a-sql-server-database-to-a-point-in-time-full-recovery-model'],['Generate scripts',M.RD+'scripting/generate-scripts-sql-server-management-studio']]};

/* ---------- 2: Drill, corrupted page ---------- */
L['mss-bkp:9:2']={blocks:[
{p:'**Drill 3: a page is corrupt.** You detect it, find which page it is and repair it with a page restore, without restoring the whole database.'},
{svg:pg},
{h:'Break (disposable lab database only)'},
{ul:['Create a small database in FULL recovery, take a full backup, add rows, take a log backup.','Stop the instance and change a few bytes of a data page in the file with a hex editor, or use documented lab techniques for corrupting a page.','Start the instance. Reading the damaged page now raises error 824.']},
{h:'Recover'},
{code:`-- 1. Find it
SELECT * FROM msdb.dbo.suspect_pages;
DBCC CHECKDB (DrillDB) WITH NO_INFOMSGS, ALL_ERRORMSGS;

-- 2. Restore the page from the full backup
RESTORE DATABASE DrillDB PAGE = '1:312'
  FROM DISK = 'E:\\Backup\\DrillDB_full.bak' WITH NORECOVERY;

-- 3. Apply the log chain and a tail backup
RESTORE LOG DrillDB FROM DISK = 'E:\\Backup\\DrillDB_log_1.trn' WITH NORECOVERY;
BACKUP LOG DrillDB TO DISK = 'E:\\Backup\\DrillDB_tail.trn';
RESTORE LOG DrillDB FROM DISK = 'E:\\Backup\\DrillDB_tail.trn' WITH RECOVERY;

-- 4. Prove
DBCC CHECKDB (DrillDB) WITH NO_INFOMSGS;`},
{note:'Never practice page corruption on a real database. After the drill, delete the lab database and any damaged files.'}],
src:[['Restore pages',M.RD+'backup-restore/restore-pages-sql-server'],['MSSQLSERVER_824',M.RD+'errors-events/mssqlserver-824-database-engine-error']]};

/* ---------- 3: Drill, lost certificate ---------- */
L['mss-bkp:9:3']={blocks:[
{p:'**Drill 4: a certificate is lost.** A TDE or encrypted backup is restored on a new server, and it fails because the certificate is missing. This drill shows why certificate backups are part of the backup plan.'},
{svg:cer},
{h:'Break'},
{p:'On a fresh lab instance, try to restore a TDE-protected backup before importing the certificate. SQL Server reports that it **cannot find the server certificate with the thumbprint**.'},
{h:'Recover'},
{flow:['Find the certificate backup files (.cer, .pvk) and the password in the secret manager','Create a database master key on the new server','CREATE CERTIFICATE ... FROM FILE ... WITH PRIVATE KEY','Retry the restore','Take a fresh certificate backup and record where it is stored']},
{code:`USE master;
CREATE MASTER KEY ENCRYPTION BY PASSWORD = '<strong password>';
CREATE CERTIFICATE TdeCert FROM FILE = 'S:\\Keys\\TdeCert.cer'
  WITH PRIVATE KEY (FILE = 'S:\\Keys\\TdeCert.pvk', DECRYPTION BY PASSWORD = '<password>');`},
{h:'If there is no certificate backup'},
{p:'The data in the TDE database and its backups **cannot be recovered**. That is the point of encryption. This is why the certificate and key backups, stored apart and tested, are non-negotiable.'}],
src:[['Move a TDE protected database to another SQL Server',M.RD+'security/encryption/move-a-tde-protected-database-to-another-sql-server'],['Transparent data encryption',M.RD+'security/encryption/transparent-data-encryption']]};

/* ---------- 4: Capstone ---------- */
L['mss-bkp:9:4']={blocks:[
{p:'**Capstone.** Turn the drills into a **recovery runbook** that another DBA could follow at 3 a.m.'},
{h:'Runbook outline'},
{t:[['Section','Contents'],
['**Scope**','Servers, databases, RPO and RTO per database'],
['**Backup schedule**','Jobs, targets, retention, who owns them'],
['**Where things are**','Backup locations, certificates and keys, credentials'],
['**Scenarios**','Lost drive, dropped table, corrupt page, lost certificate, lost instance'],
['**Steps per scenario**','Numbered, exact commands, expected output, rollback'],
['**Verification**','Queries and checks that prove success'],
['**Contacts**','Owners, escalation, vendors'],
['**Test log**','Date, who ran it, time taken, problems found']]},
{h:'Acceptance checklist'},
{ul:['Each database has a **written RPO and RTO** that your design meets.','Every scenario was **timed** and the result is in the test log.','**Alerts** fire for a failed job and for a missing backup.','**Keys and certificates** are backed up and a restore with them was tested.','A **different person** followed the runbook successfully.']},
{flow:['Write the runbook','Run each drill from the runbook only','Fix every step that needed outside knowledge','Review with the application owner','Schedule the next drill']},
{note:'Next: Performance & Tuning, Security & Compliance and High Availability build on a recoverable base. Do not skip the drills.'}],
src:[['Back up and restore of SQL Server databases',M.RD+'backup-restore/back-up-and-restore-of-sql-server-databases'],['Disaster recovery',M.RD+'backup-restore/disaster-recovery-sql-server']]};

})();
