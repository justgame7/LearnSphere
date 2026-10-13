/* LearnSphere - SQL Server Backup and Recovery Quick Reference (cheat sheet).
   window.QREF['mss-bkp'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for SQL Server 2019 to 2022 and current Azure SQL; verify syntax against your build. Check build-specific behaviour in the release notes. */
window.QREF=window.QREF||{};
window.QREF['mss-bkp']={title:'SQL Server Backup and Recovery Quick Reference',blurb:'Backup and restore syntax, a recovery decision table and fixes for SQL Server, plus maps of the backup chain, restore states and common recoveries.',hint:'tail-log backup',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every SQL Server DBA should be able to explain about backup and recovery, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Strategy and chains'},
{acc:[
{t:'RPO and RTO',s:'How much loss, how long down.',
 a:'**RPO** is the maximum data loss you accept and sets how often log backups run. **RTO** is the maximum downtime and sets how fast a restore must be. Both come from the business, not from the DBA.',
 w:'A strategy without numbers cannot be tested.',
 c:`SELECT database_name, MAX(backup_finish_date) AS last_backup, type FROM msdb.dbo.backupset GROUP BY database_name, type;`,see:[0,1,'RPO, RTO and backup strategy design']},
{t:'Recovery models and backup types',s:'What you can back up and restore.',
 a:'FULL recovery enables log backups and point-in-time restore. SIMPLE offers only full and differential backups. Types: **full**, **differential** (changes since the last full), **log** and file or filegroup backups.',
 w:'The recovery model decides the strategy.',
 c:`SELECT name, recovery_model_desc FROM sys.databases;`,see:[0,2,'Recovery models and backup types']},
{t:'Backup chain and LSN',s:'Order matters.',
 a:'Every backup covers a range of **log sequence numbers**. A log backup\'s first LSN must continue from the previous one, or the chain is broken and later logs cannot be applied.',
 w:'A broken chain after a restart or a COPY_ONLY mix-up is a classic surprise.',
 c:`SELECT database_name, type, first_lsn, last_lsn FROM msdb.dbo.backupset ORDER BY backup_start_date DESC;`,see:[0,4,'Backup chains and the LSN']},
{t:'Full, differential and log',s:'The usual pattern.',
 a:'Weekly full, daily differential and frequent log backups is typical. The restore uses the latest full, the latest differential and the log chain after it.',
 w:'More differentials mean fewer logs to apply.',
 c:`BACKUP DATABASE MyDb TO DISK = N'X:\\bk\\MyDb.bak' WITH COMPRESSION, CHECKSUM;`,see:[1,0,'Full, differential and log backups']},
{t:'COPY_ONLY',s:'A backup that does not disturb the chain.',
 a:'A COPY_ONLY full backup does not reset the differential base, and a COPY_ONLY log backup does not truncate the log. Use it for ad hoc copies.',
 w:'A non-copy-only full resets the differential base.',
 c:`BACKUP DATABASE MyDb TO DISK = N'X:\\copy.bak' WITH COPY_ONLY;`,see:[1,2,'COPY_ONLY and backup history in msdb']},
{t:'Verification',s:'A backup is not proven until restored.',
 a:'`RESTORE VERIFYONLY` checks readability and checksums. It does not prove the data restores. Only a real restore with `DBCC CHECKDB` does.',
 w:'Schedule automated test restores.',
 c:`RESTORE VERIFYONLY FROM DISK = N'X:\\bk\\MyDb.bak' WITH CHECKSUM;`,see:[1,3,'Verifying backups with RESTORE VERIFYONLY']}
]},

{h:'Restoring'},
{acc:[
{t:'RECOVERY and NORECOVERY',s:'Is more coming?',
 a:'`WITH NORECOVERY` leaves the database restoring so more backups can be applied. `WITH RECOVERY` runs undo and brings it online, after which no more backups can be applied.',
 w:'Use NORECOVERY on every step except the last.',
 c:`RESTORE DATABASE MyDb FROM DISK = N'X:\\bk\\MyDb.bak' WITH NORECOVERY;`,see:[2,0,'RESTORE sequence and NORECOVERY vs RECOVERY']},
{t:'WITH MOVE',s:'Restore to different paths.',
 a:'`WITH MOVE` places each logical file at a new physical path. Use `RESTORE FILELISTONLY` to see the logical names.',
 w:'Restoring to another server rarely has the same drives.',
 c:`RESTORE FILELISTONLY FROM DISK = N'X:\\bk\\MyDb.bak';`,see:[2,1,'RESTORE with MOVE and relocating files']},
{t:'Inspecting a backup',s:'HEADERONLY, FILELISTONLY, LABELONLY.',
 a:'These commands read a backup\'s metadata: type, dates, LSNs, files and compression. Use them before restoring an unknown file.',
 w:'Know what a file is before you overwrite a database with it.',
 c:`RESTORE HEADERONLY FROM DISK = N'X:\\bk\\MyDb.bak';`,see:[2,2,'Inspecting backups: HEADERONLY, FILELISTONLY, LABELONLY']},
{t:'Tail-log backup',s:'Capture the last transactions.',
 a:'A **tail-log backup** saves log records not yet backed up, before a restore. `WITH NORECOVERY` also puts the damaged database into the restoring state.',
 w:'Skip it and you lose everything since the last log backup.',
 c:`BACKUP LOG MyDb TO DISK = N'X:\\bk\\tail.trn' WITH NORECOVERY;`,see:[3,0,'Tail-log backups']},
{t:'Point-in-time restore',s:'STOPAT.',
 a:'Restore the full, the differential if any, then the log backups, and use `STOPAT` on the last relevant log to stop just before the mistake.',
 w:'It requires FULL recovery and an unbroken chain.',
 c:`RESTORE LOG MyDb FROM DISK = N'X:\\bk\\log3.trn' WITH STOPAT = '2026-03-05T14:29:00', RECOVERY;`,see:[3,1,'Point-in-time restore with STOPAT']},
{t:'Page and piecemeal restore',s:'Restore only what is damaged.',
 a:'A **page restore** repairs a few damaged pages while the rest stays online. **Piecemeal restore** brings filegroups online in stages in large databases.',
 w:'It reduces downtime for partial damage.',
 c:`RESTORE DATABASE MyDb PAGE = '1:57' FROM DISK = N'X:\\bk\\MyDb.bak' WITH NORECOVERY;`,see:[3,2,'Page restore']}
]},

{h:'System databases, corruption and cloud'},
{acc:[
{t:'Restoring master',s:'Single-user mode.',
 a:'Start the instance in single-user mode (`-m`), restore master from backup, and the instance restarts. Logins, linked servers and database registrations are returned to the backup time.',
 w:'Always keep a current master backup.',
 c:`sqlservr.exe -m`,see:[4,1,'Restoring master in single-user mode']},
{t:'CHECKDB and suspect pages',s:'Detect corruption.',
 a:'`DBCC CHECKDB` reports allocation and consistency errors. `msdb.dbo.suspect_pages` lists pages that caused 823 or 824 errors. Restore beats repair.',
 w:'Repair options can lose data.',
 c:`SELECT * FROM msdb.dbo.suspect_pages;`,see:[5,2,'Suspect pages and msdb tables']},
{t:'Repair options',s:'Last resort.',
 a:'`REPAIR_ALLOW_DATA_LOSS` fixes structure by deleting data and breaks constraints and relationships. Use it only when no usable backup exists, and document what was lost.',
 w:'Take a backup first, then repair.',
 c:`ALTER DATABASE MyDb SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
DBCC CHECKDB (N'MyDb', REPAIR_ALLOW_DATA_LOSS);`,see:[5,3,'Repair options and when not to use them']},
{t:'Backup to URL',s:'Azure Blob or S3-compatible storage.',
 a:'`BACKUP ... TO URL` writes directly to Blob or S3-compatible storage with a credential (shared access signature). Use block blobs and striping for large databases.',
 w:'Offsite and immutable copies protect against ransomware.',
 c:`BACKUP DATABASE MyDb TO URL = N'https://acct.blob.core.windows.net/bk/MyDb.bak' WITH COMPRESSION;`,see:[6,0,'Backup to URL with Azure Blob Storage']},
{t:'Backup encryption and TDE certificates',s:'Keys are part of the backup.',
 a:'Backups can be encrypted with a certificate or asymmetric key. A TDE-protected database cannot be restored elsewhere without its certificate and private key.',
 w:'Back up the certificate, and test restoring it on another server.',
 c:`BACKUP CERTIFICATE TdeCert TO FILE = N'X:\\keys\\TdeCert.cer' WITH PRIVATE KEY (FILE = N'X:\\keys\\TdeCert.pvk', ENCRYPTION BY PASSWORD = N'***');`,see:[7,1,'Backing up TDE certificates and keys']},
{t:'Automated test restores',s:'Prove recoverability.',
 a:'A job restores the latest backup to a test server, runs `CHECKDB`, and records time taken. The time is your measured RTO.',
 w:'It is the only real proof of a backup.',
 c:`RESTORE DATABASE MyDb_Test FROM DISK = N'X:\\bk\\MyDb.bak' WITH MOVE 'MyDb' TO N'T:\\MyDb_Test.mdf', MOVE 'MyDb_log' TO N'T:\\MyDb_Test.ldf', STATS = 10;`,see:[8,2,'Automated test restores']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Three small maps of how the parts fit together: the backup chain, restore states and backup protection.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. The backup chain'},
{map:{title:'Backup chain map',h:216,trace:'Full, differential and log',
 hint:'Tap any box, or press Full, differential and log to follow a restore along the chain.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'full',x:126,y:24,w:200,h:56,c:'disk',t:'Full backup',s:'the base',d:'A complete copy of the database as of the end of the backup.',why:'Weekly or daily.',chk:`BACKUP DATABASE MyDb TO DISK = N'X:\\bk\\full.bak' WITH CHECKSUM;`,see:[1,0,'Full, differential and log backups']},
 {id:'diff',x:354,y:24,w:200,h:56,c:'disk',t:'Differential',s:'changes since full',d:'Pages changed since the last full backup.',why:'Restore latest only.',chk:`BACKUP DATABASE MyDb TO DISK = N'X:\\bk\\diff.bak' WITH DIFFERENTIAL;`,see:[1,0,'Full, differential and log backups']},
 {id:'log1',x:21,y:136,w:194,h:56,c:'disk',t:'Log backup 1',s:'continues LSN',d:'Log records since the previous log backup.',why:'Unbroken chain.',chk:`BACKUP LOG MyDb TO DISK = N'X:\\bk\\log1.trn';`,see:[0,4,'Backup chains and the LSN']},
 {id:'log2',x:243,y:136,w:194,h:56,c:'disk',t:'Log backup 2',s:'next link',d:'The next range of log records.',why:'Apply in order.',chk:`BACKUP LOG MyDb TO DISK = N'X:\\bk\\log2.trn';`,see:[0,4,'Backup chains and the LSN']},
 {id:'tail',x:465,y:136,w:194,h:56,c:'warn',t:'Tail-log backup',s:'last records',d:'Captures the log not yet backed up, before a restore.',why:'Needs a readable log.',chk:`BACKUP LOG MyDb TO DISK = N'X:\\bk\\tail.trn' WITH NORECOVERY;`,see:[3,0,'Tail-log backups']}],
 steps:[
 {ids:['full','diff'],t:'1. Start from a full backup, then add the latest differential.',w:'Fewer logs to apply.',s:'Schedule.',x:'A COPY_ONLY full does not reset the base.',c:`RESTORE HEADERONLY FROM DISK = N'X:\\bk\\diff.bak';`},
 {ids:['log1','log2'],t:'2. Apply log backups in order after the differential.',w:'Each continues the LSN.',s:'Interval.',x:'A missing log breaks the chain.',c:`SELECT first_lsn, last_lsn FROM msdb.dbo.backupset;`},
 {ids:['tail'],t:'3. Take a tail-log backup to include the very latest changes.',w:'Minimal loss.',s:'Log availability.',x:'Skipping it.',c:`BACKUP LOG MyDb TO DISK = N'X:\\bk\\tail.trn' WITH NORECOVERY;`}]}},

{h:'2. Restore states'},
{map:{title:'Restore state map',h:216,trace:'From restoring to online',
 hint:'Tap any box, or press From restoring to online to follow a database through a restore.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'bk',x:126,y:24,w:200,h:56,c:'ext',t:'Backup files',s:'chain',d:'The full, differential and log backups to apply.',why:'Check with HEADERONLY.',chk:`RESTORE HEADERONLY FROM DISK = N'X:\\bk\\full.bak';`,see:[2,2,'Inspecting backups']},
 {id:'nor',x:354,y:24,w:200,h:56,c:'mem',t:'RESTORING',s:'NORECOVERY',d:'The database accepts more restores and is not usable.',why:'Expected between steps.',chk:`SELECT name, state_desc FROM sys.databases;`,see:[2,0,'RESTORE sequence and NORECOVERY vs RECOVERY']},
 {id:'more',x:21,y:136,w:194,h:56,c:'proc',t:'Apply the next backup',s:'diff, then logs',d:'Apply each backup in order with NORECOVERY.',why:'Use STOPAT on the last log.',chk:`RESTORE LOG MyDb FROM DISK = N'X:\\bk\\log2.trn' WITH NORECOVERY;`,see:[2,3,'Restoring differentials and log chains']},
 {id:'rec',x:243,y:136,w:194,h:56,c:'proc',t:'RECOVERY',s:'undo and open',d:'Roll back uncommitted work and bring the database online.',why:'No more backups after this.',chk:`RESTORE DATABASE MyDb WITH RECOVERY;`,see:[2,0,'RESTORE sequence and NORECOVERY vs RECOVERY']},
 {id:'on',x:465,y:136,w:194,h:56,c:'mem',t:'ONLINE',s:'usable',d:'The database is available.',why:'Run CHECKDB, check logins.',chk:`SELECT name, state_desc FROM sys.databases;`,see:[3,4,'Recovering from an accidental DELETE']}],
 steps:[
 {ids:['bk','nor'],t:'1. Restore the full backup with NORECOVERY.',w:'Ready for more.',s:'Options.',x:'Using RECOVERY too early.',c:`SELECT state_desc FROM sys.databases WHERE name = 'MyDb';`},
 {ids:['more'],t:'2. Apply the differential and logs with NORECOVERY.',w:'Roll forward.',s:'Order.',x:'Wrong file.',c:`RESTORE HEADERONLY FROM DISK = N'X:\\bk\\log2.trn';`},
 {ids:['rec','on'],t:'3. Recover and verify.',w:'Online.',s:'STOPAT.',x:'No CHECKDB.',c:`DBCC CHECKDB (N'MyDb');`}]}},

{h:'3. Targets and protection'},
{map:{title:'Backup protection map',h:328,trace:'Where backups go and how they are protected',
 hint:'Tap any box, or press Where backups go and how they are protected to follow a backup to safety.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'db',x:126,y:24,w:200,h:56,c:'ext',t:'Database',s:'source',d:'The database being backed up.',why:'Compression and checksum.',chk:`BACKUP DATABASE MyDb TO DISK = N'X:\\bk\\MyDb.bak' WITH COMPRESSION, CHECKSUM;`,see:[1,1,'Backup options: compression, checksum and striping']},
 {id:'enc',x:354,y:24,w:200,h:56,c:'warn',t:'Encryption',s:'certificate',d:'Backup encryption protects files at rest.',why:'Back up the certificate.',chk:`BACKUP DATABASE MyDb TO DISK = N'X:\\bk\\MyDb.bak' WITH ENCRYPTION (ALGORITHM = AES_256, SERVER CERTIFICATE = BkCert);`,see:[7,0,'Backup encryption']},
 {id:'disk',x:126,y:136,w:200,h:56,c:'disk',t:'Local or share',s:'fast restore',d:'A disk or file share for quick restores.',why:'Restrict permissions.',chk:`icacls X:\\bk`,see:[7,3,'Securing backup files and shares']},
 {id:'url',x:354,y:136,w:200,h:56,c:'ext',t:'Cloud storage',s:'offsite',d:'Blob or S3-compatible storage for offsite copies.',why:'Use immutability.',chk:`BACKUP DATABASE MyDb TO URL = N'https://...' ;`,see:[6,0,'Backup to URL with Azure Blob Storage']},
 {id:'key',x:240,y:248,w:200,h:56,c:'warn',t:'Certificate and keys',s:'must be kept',d:'Without the certificate, encrypted and TDE backups cannot be restored elsewhere.',why:'Store in a separate place.',chk:`BACKUP CERTIFICATE BkCert TO FILE = N'X:\\keys\\BkCert.cer';`,see:[7,1,'Backing up TDE certificates and keys']}],
 steps:[
 {ids:['db','enc'],t:'1. Back up with compression, checksum and optional encryption.',w:'Smaller and safer.',s:'Options.',x:'Checksum disabled.',c:`RESTORE HEADERONLY FROM DISK = N'X:\\bk\\MyDb.bak';`},
 {ids:['disk','url'],t:'2. Keep a local copy and an offsite copy.',w:'Two failure domains.',s:'Storage.',x:'Only one location.',c:`SELECT physical_device_name FROM msdb.dbo.backupmediafamily;`},
 {ids:['key'],t:'3. Store certificates and keys separately.',w:'Restorable.',s:'Key backup.',x:'Lost certificate.',c:`SELECT name, expiry_date FROM sys.certificates;`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Three small maps of how something happens, step by step: a point-in-time recovery, an accidental delete and corruption.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Point-in-time recovery'},
{map:{title:'Point-in-time map',h:216,trace:'Restore to just before a mistake',
 hint:'Tap any box, or press Restore to just before a mistake to follow a point-in-time recovery.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'tail',x:126,y:24,w:200,h:56,c:'warn',t:'Tail-log backup',s:'save the latest',d:'Back up the current log with NORECOVERY if possible.',why:'Preserves later work.',chk:`BACKUP LOG MyDb TO DISK = N'X:\\bk\\tail.trn' WITH NORECOVERY;`,see:[3,0,'Tail-log backups']},
 {id:'full',x:354,y:24,w:200,h:56,c:'proc',t:'Restore full',s:'NORECOVERY',d:'Restore the last full backup before the mistake.',why:'Use MOVE if needed.',chk:`RESTORE DATABASE MyDb FROM DISK = N'X:\\bk\\full.bak' WITH NORECOVERY, REPLACE;`,see:[2,0,'RESTORE sequence']},
 {id:'diff',x:21,y:136,w:194,h:56,c:'proc',t:'Restore differential',s:'NORECOVERY',d:'Restore the latest differential taken before the mistake.',why:'Optional.',chk:`RESTORE DATABASE MyDb FROM DISK = N'X:\\bk\\diff.bak' WITH NORECOVERY;`,see:[2,3,'Restoring differentials and log chains']},
 {id:'logs',x:243,y:136,w:194,h:56,c:'proc',t:'Restore logs',s:'in order',d:'Apply log backups in order.',why:'Unbroken chain.',chk:`RESTORE LOG MyDb FROM DISK = N'X:\\bk\\log1.trn' WITH NORECOVERY;`,see:[2,3,'Restoring differentials and log chains']},
 {id:'stop',x:465,y:136,w:194,h:56,c:'proc',t:'STOPAT',s:'RECOVERY',d:'On the last log, stop before the mistake and recover.',why:'Check the time zone.',chk:`RESTORE LOG MyDb FROM DISK = N'X:\\bk\\log5.trn' WITH STOPAT = '2026-03-05T14:29:00', RECOVERY;`,see:[3,1,'Point-in-time restore with STOPAT']}],
 steps:[
 {ids:['tail','full'],t:'1. Tail-log backup, then restore the full backup.',w:'Do not lose the last work.',s:'Tail log.',x:'Missing tail.',c:`RESTORE HEADERONLY FROM DISK = N'X:\\bk\\tail.trn';`},
 {ids:['diff','logs'],t:'2. Restore the differential and logs in order.',w:'Roll forward.',s:'Order.',x:'Wrong sequence.',c:`SELECT * FROM msdb.dbo.backupset;`},
 {ids:['stop'],t:'3. Use STOPAT and recover.',w:'Back to just before the error.',s:'Time.',x:'Wrong time zone.',c:`SELECT name, state_desc FROM sys.databases;`}]}},

{h:'2. Recovering from an accidental delete'},
{map:{title:'Accidental delete map',h:216,trace:'Bring back deleted rows safely',
 hint:'Tap any box, or press Bring back deleted rows safely to follow a restore to a side copy.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'stop',x:126,y:24,w:200,h:56,c:'mem',t:'Note the time',s:'when it happened',d:'Find the time or LSN of the mistake from logs or users.',why:'Be precise.',chk:`SELECT TOP 10 * FROM fn_dblog(NULL, NULL);`,see:[3,4,'Recovering from an accidental DELETE']},
 {id:'side',x:354,y:24,w:200,h:56,c:'proc',t:'Restore a side copy',s:'new name',d:'Restore to a different database name to the time before the mistake.',why:'Production stays online.',chk:`RESTORE DATABASE MyDb_Fix FROM DISK = N'X:\\bk\\full.bak' WITH MOVE ..., NORECOVERY;`,see:[2,4,'Restoring to a new name and server']},
 {id:'find',x:126,y:136,w:200,h:56,c:'mem',t:'Find the rows',s:'query the copy',d:'Query the copy for the deleted rows.',why:'Verify counts.',chk:`SELECT * FROM MyDb_Fix.dbo.Orders WHERE OrderId BETWEEN 1 AND 100;`,see:[3,4,'Recovering from an accidental DELETE']},
 {id:'copy',x:354,y:136,w:200,h:56,c:'proc',t:'Copy them back',s:'INSERT',d:'Insert rows back into production inside a transaction.',why:'Check constraints.',chk:`INSERT INTO MyDb.dbo.Orders SELECT * FROM MyDb_Fix.dbo.Orders WHERE ...;`,see:[3,4,'Recovering from an accidental DELETE']}],
 steps:[
 {ids:['stop','side'],t:'1. Establish the time and restore a side copy to just before it.',w:'Production remains available.',s:'Disk space.',x:'Wrong time.',c:`RESTORE HEADERONLY FROM DISK = N'X:\\bk\\full.bak';`},
 {ids:['find','copy'],t:'2. Locate the rows and copy them back.',w:'Targeted repair.',s:'Transactions.',x:'Foreign key issues.',c:`SELECT COUNT(*) FROM MyDb_Fix.dbo.Orders;`}]}},

{h:'3. Responding to corruption'},
{map:{title:'Corruption map',h:216,trace:'Detect, assess and recover',
 hint:'Tap any box, or press Detect, assess and recover to follow a corruption response.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'det',x:126,y:24,w:200,h:56,c:'warn',t:'Detect',s:'824 or CHECKDB',d:'Errors 823, 824 or 825 or a failed CHECKDB job indicate damage.',why:'Alerts for 823-825.',chk:`SELECT * FROM msdb.dbo.suspect_pages;`,see:[5,0,'Types of corruption and their causes']},
 {id:'chk',x:354,y:24,w:200,h:56,c:'mem',t:'Run CHECKDB',s:'full output',d:'Find the scope of the damage.',why:'Use NO_INFOMSGS.',chk:`DBCC CHECKDB (N'MyDb') WITH NO_INFOMSGS, ALL_ERRORMSGS;`,see:[5,1,'DBCC CHECKDB output and options']},
 {id:'ass',x:21,y:136,w:194,h:56,c:'mem',t:'Assess',s:'which objects',d:'Is it an index (rebuild) or a table or allocation structure?',why:'Nonclustered index damage is easy.',chk:`DBCC CHECKDB (N'MyDb') WITH TABLERESULTS;`,see:[5,1,'DBCC CHECKDB output and options']},
 {id:'res',x:243,y:136,w:194,h:56,c:'proc',t:'Restore',s:'from backups',d:'Restore the damaged pages or database from backups.',why:'Preferred.',chk:`RESTORE DATABASE MyDb PAGE = '1:57' FROM DISK = N'X:\\bk\\full.bak' WITH NORECOVERY;`,see:[5,4,'Recovering from corruption with backups']},
 {id:'rep',x:465,y:136,w:194,h:56,c:'warn',t:'Repair',s:'last resort',d:'Use REPAIR_ALLOW_DATA_LOSS only if no backup works.',why:'Document data loss.',chk:`DBCC CHECKDB (N'MyDb', REPAIR_ALLOW_DATA_LOSS);`,see:[5,3,'Repair options and when not to use them']}],
 steps:[
 {ids:['det','chk'],t:'1. Detect and run CHECKDB for the full picture.',w:'Know the scope.',s:'Alerts.',x:'Ignoring a warning.',c:`DBCC CHECKDB (N'MyDb');`},
 {ids:['ass','res'],t:'2. Decide whether a rebuild or a restore fixes it.',w:'Smallest fix first.',s:'Backups.',x:'No usable backup.',c:`SELECT * FROM msdb.dbo.backupset;`},
 {ids:['rep'],t:'3. Repair only as a last resort and verify the result.',w:'Data may be lost.',s:'Backup first.',x:'Unrecorded loss.',c:`DBCC CHECKDB (N'MyDb');`}]}},

]},

{t:'Backup and restore syntax',d:'The syntax you need most, by task.',see:[[1,0,'Full, differential and log backups'],[2,0,'RESTORE sequence and NORECOVERY vs RECOVERY']],b:[
{t:[['Task','Command'],['Full backup','`BACKUP DATABASE db TO DISK = N\'path\' WITH COMPRESSION, CHECKSUM;`'],['Differential','`BACKUP DATABASE db TO DISK = N\'path\' WITH DIFFERENTIAL;`'],['Log backup','`BACKUP LOG db TO DISK = N\'path\';`'],['Tail-log','`BACKUP LOG db TO DISK = N\'path\' WITH NORECOVERY;`'],['Verify','`RESTORE VERIFYONLY FROM DISK = N\'path\' WITH CHECKSUM;`'],['Inspect','`RESTORE HEADERONLY|FILELISTONLY|LABELONLY FROM DISK = N\'path\';`'],['Restore step','`RESTORE DATABASE db FROM DISK = N\'path\' WITH NORECOVERY;`'],['Finish','`RESTORE DATABASE db WITH RECOVERY;`'],['Relocate files','`... WITH MOVE \'logical\' TO N\'newpath\';`'],['Point in time','`RESTORE LOG db FROM DISK = N\'path\' WITH STOPAT = \'yyyy-mm-ddThh:mi:ss\', RECOVERY;`'],['Page restore','`RESTORE DATABASE db PAGE = \'file:page\' FROM DISK = N\'path\' WITH NORECOVERY;`'],['Backup history','`SELECT * FROM msdb.dbo.backupset ORDER BY backup_finish_date DESC;`']]}
]},
{t:'Recovery decision table',d:'What to do for each kind of failure.',see:[[0,0,'Failure types and what each needs'],[9,4,'Capstone: Documented recovery runbook']],b:[
{t:[['Failure','Recovery','Key backup needed'],['Lost data drive, database offline','Tail-log backup, then restore full, diff and logs','Full, diff, logs, tail'],['Accidental DELETE or DROP','Point-in-time restore to a side copy, copy data back','Full, logs'],['Corrupted page','Page restore, or repair index','Full, logs'],['Lost master','Single-user restore of master','master backup'],['Lost tempdb','Restart the instance (tempdb is re-created)','None'],['Lost msdb','Restore msdb, jobs and history return','msdb backup'],['Lost TDE certificate','Restore the certificate and key first','Certificate and private key'],['Whole server lost','Rebuild the instance, restore system DBs and user DBs','All backups and keys']]}
]},
]};
