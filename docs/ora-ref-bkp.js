/* LearnSphere - Oracle Backup, Recovery & Flashback Quick Reference (cheat sheet).
   window.QREF['ora-bkp'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Values are for Oracle Database 19c on Linux unless stated. RMAN syntax is the same in 26ai unless marked.
   Check a setting on your own system with: SHOW ALL; (RMAN) or SELECT name, value FROM v$rman_configuration; */
window.QREF=window.QREF||{};
window.QREF['ora-bkp']={title:'Backup, Recovery & Flashback Quick Reference',blurb:'RMAN, the Fast Recovery Area, recovery sequences and Flashback on one page each.',hint:'archivelog or flashback',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas behind backup, recovery and Flashback that you should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command or query to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Foundations'},
{acc:[
{t:'Failure types',s:'Not every failure needs a backup.',
 a:'Oracle sorts failures into **statement**, **process**, **user error**, **instance** and **media**. Statement, process and instance failures are repaired by Oracle itself (rollback, PMON, instance recovery). **User error** needs Flashback or a point-in-time restore. **Media** failure (a lost disk or datafile) is the one that needs a backup.',
 w:'Knowing the type tells you the tool: restoring from backup for a bad DELETE is the slowest and most disruptive fix when Flashback Query would do.',
 c:`SELECT file#, error, online_status FROM v$recover_file;
SELECT * FROM v$database_block_corruption;`,see:[0,0,'Failure types']},
{t:'RTO and RPO',s:'How long may it be down, and how much may be lost.',
 a:'**RTO** (recovery time objective) is how long recovery may take. **RPO** (recovery point objective) is how much data you may lose, measured in time. They are business decisions, and they drive every choice that follows: backup frequency, archived log shipping, standby, Flashback.',
 w:'A weekly full backup and daily archived log backup gives an RPO of about one archive interval and an RTO of hours. If the business needs minutes, you need a standby, not a faster backup.',
 c:`SELECT ROUND((SYSDATE - MAX(completion_time)) * 24, 1) AS hours_since_last_archive
FROM v$archived_log;`,see:[0,1,'RTO, RPO and designing a strategy']},
{t:'Backup types',s:'Whole or partial, full or incremental, consistent or not.',
 a:'A **whole** backup covers every datafile and the control file; a **partial** one covers some. **Full** copies all used blocks; **incremental** copies only blocks changed since a base. A **consistent** backup is taken with the database closed (all SCNs equal); an **inconsistent** one is taken while open and needs redo to be made consistent.',
 w:'In ARCHIVELOG mode open (inconsistent) backups are normal and need no downtime. Closed backups are only needed in NOARCHIVELOG mode.',
 c:`SELECT log_mode, controlfile_type FROM v$database;`,see:[0,2,'Backup types']},
{t:'Redo, undo and SCN in recovery',s:'Roll forward, then roll back.',
 a:'Recovery has two phases. **Roll forward** applies redo to bring blocks to the target SCN, including changes that were never committed. **Roll back** then uses undo to remove the uncommitted changes. The **SCN** is the clock that orders everything and decides what a backup contains.',
 w:'This is why you need archived redo from the time of the backup to the point you want to reach, and why a backup alone is only a starting point.',
 c:`SELECT current_scn, checkpoint_change# FROM v$database;`,see:[0,3,'How Oracle recovery works']},
{t:'ARCHIVELOG mode',s:'Keep the redo history.',
 a:'In **ARCHIVELOG** mode a full online redo log group is copied to an archive destination before it can be reused. Those archived logs, plus a backup, let you recover to any point in time. In **NOARCHIVELOG** mode you can only restore the last closed backup and you lose everything after it.',
 w:'It is the first thing to check on any production database. Online backups, point-in-time recovery, Data Guard and Flashback Database all depend on it.',
 c:`SELECT log_mode FROM v$database;
ARCHIVE LOG LIST`,see:[0,5,'ARCHIVELOG and the FRA']},
{t:'Fast Recovery Area',s:'One managed place for backup files.',
 a:'The **FRA** is a disk location (and a size limit) where Oracle puts archived logs, backups, flashback logs, control file autobackups and optionally multiplexed redo. It is set with `DB_RECOVERY_FILE_DEST` and `DB_RECOVERY_FILE_DEST_SIZE`. Oracle deletes files it considers reclaimable when space is needed.',
 w:'A full FRA stops archiving and the database hangs on log switches. Size it for the backups, archives and flashback logs together, and monitor it.',
 c:`SELECT name, space_limit/1024/1024 AS limit_mb, space_used/1024/1024 AS used_mb,
 space_reclaimable/1024/1024 AS reclaimable_mb FROM v$recovery_file_dest;`,see:[1,4,'Fast Recovery Area setup']}
]},

{h:'RMAN and the repository'},
{acc:[
{t:'RMAN architecture',s:'A client that sends commands, server sessions that do the work.',
 a:'The **RMAN client** is a command line. It connects to the **target** database, which starts **server sessions** called **channels**. The channels read datafiles and write backup pieces. Metadata about each backup is stored in the **repository**: always the control file, and optionally a recovery catalog.',
 w:'If a backup is slow, look at the channels, the storage and the network, not at the RMAN client.',
 c:`SELECT sid, serial#, program FROM v$session WHERE program LIKE 'rman%';
SELECT sid, ROUND(sofar/totalwork*100) pct_done, opname
FROM v$session_longops WHERE opname LIKE 'RMAN%' AND totalwork > 0 AND sofar <> totalwork;`,see:[1,0,'RMAN architecture']},
{t:'Control file vs recovery catalog',s:'Where backup metadata lives.',
 a:'The control file always holds the metadata, but only for `CONTROL_FILE_RECORD_KEEP_TIME` days (default 7) and only for one database. A **recovery catalog** is a schema in a separate database that keeps history for many databases and allows stored scripts and longer reporting.',
 w:'Without a catalog the control file is the only record of your backups. Losing it makes recovery harder, which is why control file autobackup matters.',
 c:`SHOW PARAMETER control_file_record_keep_time
SELECT COUNT(*) FROM v$backup_set;`,see:[1,2,'Control file vs recovery catalog']},
{t:'Backup sets and image copies',s:'Two formats, two trade-offs.',
 a:'A **backup set** is a proprietary container of backup pieces. It skips unused blocks and supports compression, encryption and tape. An **image copy** is an exact file copy that can be used directly: `SWITCH TO COPY` makes it the live datafile without a restore.',
 w:'Sets save space and travel to tape or object storage. Copies give the fastest recovery but need the same disk space as the database.',
 c:`SELECT file#, incremental_level, completion_time, ROUND(blocks*block_size/1024/1024) AS mb
FROM v$backup_datafile ORDER BY completion_time DESC FETCH FIRST 5 ROWS ONLY;`,see:[1,5,'Backup sets vs image copies']},
{t:'CONFIGURE settings',s:'Persistent defaults for every RMAN job.',
 a:'`CONFIGURE` stores settings in the repository: retention policy, default device type, parallelism, control file autobackup, compression, encryption, archivelog deletion policy. They apply to every later backup unless a command overrides them.',
 w:'A wrong default (retention, no autobackup, parallelism 1) is the quiet cause of most backup problems. Read `SHOW ALL` before you design anything.',
 c:`RMAN> SHOW ALL;
SELECT name, value FROM v$rman_configuration ORDER BY conf#;`,see:[1,3,'CONFIGURE settings']},
{t:'Control file autobackup',s:'The safety net for the repository.',
 a:'With autobackup on, RMAN backs up the control file and the SPFILE after every backup and after structural changes, to a known name pattern. It lets you restore the control file even when you have no catalog and no other record.',
 w:'Restoring a lost control file without it means hunting for the right backup piece by hand. Turn it on and keep it in the FRA or a second location.',
 c:`RMAN> SHOW CONTROLFILE AUTOBACKUP;
RMAN> CONFIGURE CONTROLFILE AUTOBACKUP ON;`,see:[2,5,'Backing up control files and SPFILE']}
]},

{h:'Taking backups'},
{acc:[
{t:'Incremental backups',s:'Level 0 is the base, level 1 is the change.',
 a:'A **level 0** backup copies every used block and is the base. A **level 1** copies only blocks changed since a previous backup: **differential** (since the last level 0 or 1, the default) or **cumulative** (since the last level 0). Restore needs the level 0, then the level 1s, then archived redo.',
 w:'Incrementals shorten the nightly window and the backup volume. Cumulative level 1s are bigger but make restore simpler and faster.',
 c:`RMAN> BACKUP INCREMENTAL LEVEL 0 DATABASE;
RMAN> BACKUP INCREMENTAL LEVEL 1 DATABASE;
RMAN> BACKUP INCREMENTAL LEVEL 1 CUMULATIVE DATABASE;`,see:[2,1,'Incremental backups']},
{t:'Block change tracking',s:'Do not scan the whole file to find changes.',
 a:'With **block change tracking**, the CTWR process records which blocks changed in a small file. A level 1 backup then reads only those blocks instead of scanning every datafile. It is an Enterprise Edition feature.',
 w:'On a large database it turns a level 1 from hours to minutes. Check `USED_CHANGE_TRACKING` to confirm it is actually used.',
 c:`SELECT status, filename FROM v$block_change_tracking;
SELECT file#, used_change_tracking FROM v$backup_datafile ORDER BY completion_time DESC FETCH FIRST 5 ROWS ONLY;`,see:[2,2,'Block change tracking']},
{t:'Incrementally updated backups',s:'Keep an image copy current.',
 a:'Take a level 0 image copy once, then each day apply the latest level 1 to it (`RECOVER COPY OF DATABASE`). The copy is always recent, so a recovery needs very little redo and `SWITCH TO COPY` gives near-instant restore.',
 w:'This is the "incremental forever" pattern on disk. The cost is one copy of the database on disk and a daily merge.',
 c:`RMAN> BACKUP INCREMENTAL LEVEL 1 FOR RECOVER OF COPY WITH TAG 'DAILY' DATABASE;
RMAN> RECOVER COPY OF DATABASE WITH TAG 'DAILY';`,see:[2,3,'Image copies and incrementally updated backups']},
{t:'Validate and restore validate',s:'Prove a backup can be read before you need it.',
 a:'`BACKUP VALIDATE` reads the database blocks and checks them for corruption without producing a backup. `RESTORE ... VALIDATE` reads the backup pieces that a restore would use and checks they are readable and complete. Neither one writes files.',
 w:'A backup that was never validated is a hope, not a backup. A scheduled restore validate catches missing pieces, bad media and lost archived logs.',
 c:`RMAN> BACKUP VALIDATE CHECK LOGICAL DATABASE;
RMAN> RESTORE DATABASE VALIDATE;
RMAN> RESTORE ARCHIVELOG ALL VALIDATE;`,see:[3,4,'RESTORE VALIDATE and preview']},
{t:'Backup encryption',s:'Transparent, password and dual mode.',
 a:'RMAN can encrypt backup sets with the database master key from the wallet (**transparent**), with a **password**, or **dual** (either works). Transparent encryption needs the wallet open at restore time; password mode does not.',
 w:'Losing the wallet makes transparent-encrypted backups unreadable. Back up the wallet separately and test a restore on another host.',
 c:`RMAN> CONFIGURE ENCRYPTION FOR DATABASE ON;
SELECT encrypted, COUNT(*) FROM v$backup_piece GROUP BY encrypted;`,see:[2,4,'Compressing and encrypting backups']}
]},

{h:'Maintaining the repository'},
{acc:[
{t:'Retention policy',s:'What counts as obsolete.',
 a:'A **retention policy** says how long backups must be kept. It is either a **recovery window** (days, so you can recover to any point in that window) or **redundancy** (number of copies of each file). Backups outside the policy are **obsolete**. RMAN never deletes them on its own except when the FRA needs space.',
 w:'The default is redundancy 1, which is rarely right. A recovery window that matches your RPO and compliance rules is easier to explain.',
 c:`RMAN> SHOW RETENTION POLICY;
RMAN> REPORT OBSOLETE;`,see:[3,2,'Retention policies and DELETE OBSOLETE']},
{t:'Expired vs obsolete',s:'Two different words.',
 a:'**Expired** means the repository has a record but `CROSSCHECK` could not find the file. **Obsolete** means the file exists and is no longer needed by the retention policy. Expired is about missing files; obsolete is about age and redundancy.',
 w:'Run `CROSSCHECK` then `DELETE EXPIRED` to clear dead records, and `DELETE OBSOLETE` to free space.',
 c:`RMAN> CROSSCHECK BACKUP;
RMAN> LIST EXPIRED BACKUP;
RMAN> DELETE NOPROMPT EXPIRED BACKUP;`,see:[3,1,'CROSSCHECK and expired vs obsolete']},
{t:'Archived log deletion policy',s:'Do not delete a log that is still needed.',
 a:'The **archivelog deletion policy** tells RMAN when an archived log may be deleted: only after it is backed up N times, and/or after it was applied to or shipped to standbys. Without a policy, logs can be removed before a standby or a backup has used them.',
 w:'The most common cause of "archived log not found" during recovery is a manual `rm`, not the policy. Use RMAN to delete them.',
 c:`RMAN> SHOW ARCHIVELOG DELETION POLICY;
RMAN> CONFIGURE ARCHIVELOG DELETION POLICY TO BACKED UP 2 TIMES TO DISK;`,see:[3,3,'Archivelog deletion policies']},
{t:'Backup monitoring views',s:'Know the state without opening RMAN.',
 a:'`V$RMAN_BACKUP_JOB_DETAILS` lists each job with status, size and elapsed time. `V$RMAN_STATUS` has the messages, `V$BACKUP_SET` the sets, and `V$RMAN_OUTPUT` the log of a running session.',
 w:'These are what you check each morning and what a monitoring tool should alert on: a failed or missing job.',
 c:`SELECT start_time, input_type, status, ROUND(elapsed_seconds/60) AS min,
 ROUND(output_bytes/1024/1024/1024,1) AS gb
FROM v$rman_backup_job_details ORDER BY start_time DESC FETCH FIRST 7 ROWS ONLY;`,see:[3,6,'Monitoring backups with V$RMAN views']}
]},

{h:'Restore and recovery'},
{acc:[
{t:'Restore vs recover',s:'Two verbs, two jobs.',
 a:'**Restore** copies files back from a backup. **Recover** applies redo to bring them forward to the target time or SCN. A typical datafile loss is `RESTORE DATAFILE n` then `RECOVER DATAFILE n`. Recovery uses archived logs and, where needed, online redo.',
 w:'Saying "I restored it" and expecting it to open is a common mistake. A restored file is old until it is recovered.',
 c:`RMAN> RESTORE DATAFILE 5;
RMAN> RECOVER DATAFILE 5;
SQL> ALTER DATABASE DATAFILE 5 ONLINE;`,see:[4,0,'Restore vs recover: the recovery workflow']},
{t:'Complete vs incomplete recovery',s:'To the end of the redo, or to a chosen point.',
 a:'**Complete** recovery applies all available redo, so nothing is lost. **Incomplete** recovery stops at a time, SCN or log sequence you choose, for example just before a bad batch job. Incomplete recovery always ends with `OPEN RESETLOGS`.',
 w:'Use complete recovery for media failure. Use incomplete recovery (or Flashback Database) when the data is wrong, not missing.',
 c:`RMAN> RUN { SET UNTIL TIME "TO_DATE('2026-10-10 14:30','YYYY-MM-DD HH24:MI')";
 RESTORE DATABASE; RECOVER DATABASE; }
RMAN> ALTER DATABASE OPEN RESETLOGS;`,see:[4,5,'Incomplete recovery']},
{t:'OPEN RESETLOGS and incarnations',s:'A new timeline.',
 a:'`OPEN RESETLOGS` creates a new **incarnation**: redo log sequence numbers start again at 1 and the old redo cannot be applied to the new timeline. Backups from earlier incarnations remain usable, and `RESET DATABASE TO INCARNATION` lets you go back to one.',
 w:'After RESETLOGS take a new full backup. A restore that picks the wrong incarnation is a classic "why does it not find my backup" problem.',
 c:`RMAN> LIST INCARNATION OF DATABASE;
SELECT incarnation#, resetlogs_change#, status FROM v$database_incarnation;`,see:[4,6,'OPEN RESETLOGS and incarnations']},
{t:'Control file and SPFILE loss',s:'The small files that stop everything.',
 a:'If all control file copies are lost the instance cannot mount. You restore the control file from an autobackup (`RESTORE CONTROLFILE FROM AUTOBACKUP`, after `SET DBID` when there is no catalog), mount, recover, and `OPEN RESETLOGS`. A lost SPFILE is restored from autobackup the same way, before the control file.',
 w:'Multiplex the control file and keep autobackups. Record the DBID somewhere outside the database.',
 c:`SELECT dbid, name FROM v$database;
SELECT name FROM v$controlfile;`,see:[4,3,'Control file loss and recovery']},
{t:'Block corruption and block recovery',s:'Repair a block, not a file.',
 a:'When a few blocks are corrupt you can use **block media recovery**, which restores only those blocks from a backup (or from flashback logs) and applies the needed redo while the file stays online. `V$DATABASE_BLOCK_CORRUPTION` lists the damaged blocks that RMAN or a query has found.',
 w:'Repairing 3 blocks beats restoring a 2 TB datafile. Run `BACKUP VALIDATE` regularly so corruption is found before a user finds it.',
 c:`SELECT file#, block#, blocks, corruption_type FROM v$database_block_corruption;
RMAN> RECOVER CORRUPTION LIST;`,see:[9,2,'Detecting and repairing corruption']},
{t:'Recovery in a multitenant database',s:'Per PDB, or the whole CDB.',
 a:'In a CDB you can back up and recover the **whole CDB**, the **root**, or a single **PDB**. A PDB datafile or PDB point-in-time recovery is done with the CDB open and only the PDB closed. PDB point-in-time recovery needs an auxiliary destination unless local undo is in use.',
 w:'It lets you recover one tenant without touching the others. Always know which container your RMAN session is connected to.',
 c:`RMAN> BACKUP PLUGGABLE DATABASE pdb1;
RMAN> RESTORE PLUGGABLE DATABASE pdb1;
RMAN> RECOVER PLUGGABLE DATABASE pdb1;`,see:[5,2,'Recovering a PDB datafile or the whole PDB']}
]},

{h:'Flashback'},
{acc:[
{t:'Flashback technologies',s:'Undo-based or flashback-log-based.',
 a:'Flashback Query, Versions Query, Transaction Query and Flashback Table use **undo**. Flashback Drop uses the **recycle bin**. Flashback Database uses **flashback logs** written by RVWR. Each one is a different cost and reach: undo is cheap and short, flashback logs reach the whole database.',
 w:'Pick the smallest tool that fixes the problem. A wrong UPDATE is a Flashback Query; a dropped table is the recycle bin; a bad release is Flashback Database.',
 c:`SELECT flashback_on, log_mode FROM v$database;
SELECT * FROM employees AS OF TIMESTAMP SYSTIMESTAMP - INTERVAL '15' MINUTE WHERE employee_id = 100;`,see:[6,0,'Flashback overview']},
{t:'Flashback Database',s:'Rewind the whole database.',
 a:'**Flashback Database** returns the database to an earlier time or SCN by undoing block changes recorded in flashback logs. It is much faster than a restore and recover. It needs ARCHIVELOG, `FLASHBACK ON` and the FRA, and ends with `OPEN RESETLOGS`.',
 w:'It is the quickest way to undo a failed upgrade or batch job. It is limited by `DB_FLASHBACK_RETENTION_TARGET` and the space in the FRA, and it cannot fix a lost or shrunk datafile.',
 c:`SELECT oldest_flashback_time, flashback_size/1024/1024 AS mb FROM v$flashback_database_log;
SQL> FLASHBACK DATABASE TO RESTORE POINT before_release;`,see:[6,3,'Flashback Database and flashback logs']},
{t:'Restore points',s:'A named SCN.',
 a:'A **normal restore point** is a name for an SCN and ages out with the control file. A **guaranteed restore point** also forces flashback logs to be kept back to that point until you drop it, so you can always flash back to it.',
 w:'Create a guaranteed restore point before a risky change, and drop it afterwards. Forgotten ones fill the FRA.',
 c:`CREATE RESTORE POINT before_release GUARANTEE FLASHBACK DATABASE;
SELECT name, scn, guarantee_flashback_database, storage_size FROM v$restore_point;`,see:[6,4,'Normal and guaranteed restore points']},
{t:'Recycle bin',s:'A drop is not final.',
 a:'When a table is dropped (without `PURGE`) it is renamed and its space is kept in the **recycle bin** of its tablespace. `FLASHBACK TABLE ... TO BEFORE DROP` brings it back with its indexes and constraints (names may change).',
 w:'Oracle reclaims recycle bin space when the tablespace needs it, so it is not a backup, and a `PURGE` or a user quota issue can remove it.',
 c:`SELECT object_name, original_name, droptime FROM user_recyclebin;
FLASHBACK TABLE orders TO BEFORE DROP;`,see:[6,2,'Flashback Table and the recycle bin']}
]},

{h:'Strategy and protection'},
{acc:[
{t:'RMAN DUPLICATE',s:'Build a copy of a database from backups.',
 a:'`DUPLICATE` creates a new database (or a standby) from backups or directly from the running source (**active duplication**). It creates the control file, restores and recovers the files and opens the copy with a new DBID.',
 w:'It is the standard way to refresh test databases and to build a standby. Active duplication needs network access and CPU on the source; backup-based does not.',
 c:`RMAN> DUPLICATE TARGET DATABASE TO TEST FROM ACTIVE DATABASE SPFILE NOFILENAMECHECK;`,see:[7,1,'RMAN DUPLICATE']},
{t:'Backup is not disaster recovery',s:'They answer different questions.',
 a:'A backup restores **data** to a point in time, often in hours. Disaster recovery keeps a **running copy** (a standby) ready in another site, so recovery is minutes. A standby also copies a logical corruption or a bad DELETE, so you still need backups and Flashback.',
 w:'Use both: Data Guard for site loss and short RTO, backups for point-in-time recovery and long retention.',
 c:`SELECT database_role, protection_mode, open_mode FROM v$database;`,see:[8,4,'DR vs backup: why you need both']},
{t:'Testing restores',s:'The only proof is a restore.',
 a:'A scheduled drill restores to another host, recovers, opens and runs a check query. Each drill measures real RTO and finds missing pieces, a lost wallet, a changed network path or an out-of-date runbook.',
 w:'Record the time. If the drill takes 9 hours and the RTO is 4, you found out for free.',
 c:`RMAN> RESTORE DATABASE PREVIEW SUMMARY;
RMAN> RESTORE DATABASE VALIDATE;`,see:[3,7,'Prove that your backups are restorable']},
{t:'Recovery Appliance',s:'A backup system built for Oracle.',
 a:'The **Zero Data Loss Recovery Appliance** (ZDLRA) receives redo in real time and incremental backups from many databases, stores them as virtual full backups, validates them and replicates or tiers them. Databases send only changes, never a full backup again.',
 w:'It gives near-zero RPO for backups and removes the backup window. It is a large step in cost, so it suits many large databases.',
 c:`SELECT device_type, COUNT(*) AS pieces FROM v$backup_piece GROUP BY device_type;
RMAN> BACKUP DEVICE TYPE SBT INCREMENTAL LEVEL 1 DATABASE;`,see:[8,0,'Zero Data Loss Recovery Appliance']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Five small maps of how the parts fit together: RMAN, the fast recovery area, recovery building blocks, Flashback and the layers of protection.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why a DBA cares, one query or command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. How RMAN, the database and the repository fit together'},
{map:{title:'RMAN architecture map',h:328,trace:'Trace a backup command',
 hint:'Tap any box, or press Trace a backup command to follow one BACKUP DATABASE from the client to the files.',
 lines:['M340 136 L340 109 L226 109 L226 82',[326,52,352,52],[215,164,241,164],[437,164,463,164],[562,192,562,246],'M562 192 L562 219 L340 219 L340 246','M562 192 L562 219 L118 219 L118 246'],
 nodes:[
 {id:'ctl',x:126,y:24,w:200,h:56,c:'disk',t:'Control file',s:'always the repository',d:'The control file holds the backup metadata for this one database, kept for CONTROL_FILE_RECORD_KEEP_TIME days.',why:'It is the only record of your backups when you have no catalog. Autobackup protects it.',chk:`SELECT type, records_used, records_total FROM v$controlfile_record_section WHERE type LIKE 'BACKUP%';`,see:[1,2,'Control file vs recovery catalog']},
 {id:'cat',x:354,y:24,w:200,h:56,c:'ext',t:'Recovery catalog',s:'optional, another database',d:'A schema in a separate database that keeps backup history for many databases for longer than the control file.',why:'It allows stored scripts and a longer history, and it survives the loss of the target.',chk:`RMAN> CONNECT CATALOG rcat@rcatdb
RMAN> LIST INCARNATION OF DATABASE;`,see:[1,2,'Control file vs recovery catalog']},
 {id:'client',x:21,y:136,w:194,h:56,c:'ext',t:'RMAN client',s:'command line',d:'The program you type commands into. It parses commands and sends them to the target. It moves no data itself.',why:'Because it moves no data, a slow backup is never an RMAN-client problem.',chk:`$ rman target / catalog rcat@rcatdb`,see:[1,1,'Connecting to RMAN']},
 {id:'target',x:243,y:136,w:194,h:56,c:'proc',t:'Target database',s:'the one being protected',d:'The database instance that RMAN connects to as SYSDBA or SYSBACKUP. It runs the server sessions that do the work.',why:'It needs to be mounted or open for most operations. Use the SYSBACKUP privilege for least privilege.',chk:`SELECT dbid, name, open_mode, log_mode FROM v$database;`,see:[1,1,'Connecting to RMAN and target types']},
 {id:'chan',x:465,y:136,w:194,h:56,c:'proc',t:'Channels',s:'server sessions',d:'A channel is a server session allocated for a task. Each reads or writes one stream. Parallelism is the number of channels.',why:'Too few channels leaves hardware idle, too many saturates storage or the network.',chk:`SELECT sid, program, status FROM v$session WHERE program LIKE 'rman%';`,see:[1,0,'RMAN architecture']},
 {id:'sbt',x:21,y:248,w:194,h:56,c:'ext',t:'Tape or cloud',s:'SBT media manager',d:'A third-party or Oracle library (for example Oracle Secure Backup or an object storage module) reached through the SBT interface.',why:'Needed when backups must leave the disk subsystem. Requires a licensed media manager.',chk:`RMAN> CONFIGURE CHANNEL DEVICE TYPE SBT PARMS 'SBT_LIBRARY=...';`,see:[8,1,'Backing up to object storage and the cloud']},
 {id:'fra',x:243,y:248,w:194,h:56,c:'disk',t:'Fast Recovery Area',s:'disk backups and logs',d:'The managed disk location for backup sets, image copies, archived logs and flashback logs.',why:'Disk backups land here by default. A full FRA blocks archiving.',chk:`SELECT * FROM v$recovery_area_usage;`,see:[1,4,'Fast Recovery Area setup']},
 {id:'dfile',x:465,y:248,w:194,h:56,c:'disk',t:'Datafiles',s:'source of the blocks',d:'The datafiles, control file and archived logs that channels read to build the backup.',why:'Channels read blocks directly, bypassing the buffer cache, and check them as they go.',chk:`SELECT file#, name, bytes/1024/1024 AS mb FROM v$datafile ORDER BY bytes DESC FETCH FIRST 5 ROWS ONLY;`,see:[0,3,'How Oracle recovery works']}],
 steps:[
 {ids:['client','target'],t:'1. You connect the RMAN client to the target and enter BACKUP DATABASE. The client parses the command and sends it to the target instance.',w:'Nothing is read or written yet. The client only issues instructions.',s:'`rman target`, `CONNECT TARGET`, SYSBACKUP privilege.',x:'Wrong DBID, wrong ORACLE_SID or a missing password file shows as RMAN-04005 or ORA-01017.',c:`$ rman target /
RMAN> BACKUP DATABASE PLUS ARCHIVELOG;`},
 {ids:['target','chan'],t:'2. The target allocates channels, one server session per stream, as set by the configured parallelism and device type.',w:'Parallel channels split the work across files so the job finishes sooner.',s:'`CONFIGURE DEVICE TYPE ... PARALLELISM`, `CONFIGURE CHANNEL`, `ALLOCATE CHANNEL`.',x:'ORA-19554 or an SBT error here means the device or media manager is not configured.',c:`RMAN> SHOW DEVICE TYPE;
RMAN> SHOW CHANNEL;`},
 {ids:['chan','dfile'],t:'3. Each channel reads its assigned datafile blocks, skipping unused blocks for a backup set, or reading only changed blocks for an incremental when block change tracking is on.',w:'It is the actual data movement, and it decides the backup time.',s:'`BACKUP ... SECTION SIZE`, `FILESPERSET`, block change tracking.',x:'A corrupt block fails the backup unless a MAXCORRUPT setting allows it.',c:`SELECT sid, opname, ROUND(sofar/totalwork*100) AS pct FROM v$session_longops WHERE opname LIKE 'RMAN%' AND totalwork > 0 AND sofar <> totalwork;`},
 {ids:['chan','fra','sbt'],t:'4. The channel writes backup pieces to the destination for its device type: the FRA or a disk directory, or tape and cloud through SBT.',w:'The destination is configured separately for disk and SBT, so one command can feed either.',s:'`FORMAT`, `DB_RECOVERY_FILE_DEST`, `CONFIGURE DEFAULT DEVICE TYPE`.',x:'ORA-19809 and ORA-19804 mean the FRA is full. SBT write errors mean the media manager is failing.',c:`SELECT handle, device_type, bytes/1024/1024 AS mb FROM v$backup_piece ORDER BY completion_time DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['target','ctl','cat'],t:'5. The target records the backup in the control file. If a catalog is connected, the metadata is also stored there, at once or at the next resync.',w:'Without this record RMAN could not find the backup to restore.',s:'`CONTROL_FILE_RECORD_KEEP_TIME`, `RESYNC CATALOG`.',x:'Old records can be overwritten if the keep time is too short for the retention window.',c:`RMAN> LIST BACKUP SUMMARY;`},
 {ids:['ctl','fra'],t:'6. With autobackup on, RMAN writes the control file and SPFILE backup as the final step, so the repository itself is protected.',w:'It makes restore possible when everything else is lost.',s:'`CONFIGURE CONTROLFILE AUTOBACKUP ON`, `CONTROLFILE AUTOBACKUP FORMAT`.',x:'Without autobackup you may not find the control file backup when you need it most.',c:`RMAN> LIST BACKUP OF CONTROLFILE;`}]}},

{h:'2. The Fast Recovery Area'},
{map:{title:'Fast Recovery Area map',h:328,trace:'Follow the FRA as it fills',
 hint:'Tap any box, or press Follow the FRA as it fills to see what Oracle does when space runs out.',
 lines:['M89 80 L89 107 L340 107 L340 134','M256 80 L256 107 L340 107 L340 134','M423 80 L423 107 L340 107 L340 134','M590 80 L590 107 L340 107 L340 134','M340 192 L340 219 L118 219 L118 246',[340,192,340,246],[437,276,463,276]],
 nodes:[
 {id:'arch',x:20,y:24,w:139,h:56,c:'disk',t:'Archived logs',s:'redo history',d:'Copies of full online redo logs. Created by ARCn into the FRA when no other destination is set.',why:'They are needed to recover past the last backup and to feed standbys.',chk:`SELECT COUNT(*), ROUND(SUM(blocks*block_size)/1024/1024) AS mb FROM v$archived_log WHERE dest_id = 1 AND deleted = 'NO';`,see:[0,5,'ARCHIVELOG and the Fast Recovery Area']},
 {id:'bkp',x:187,y:24,w:139,h:56,c:'disk',t:'Backups',s:'sets and image copies',d:'Backup sets and image copies taken to disk when no other format is given.',why:'Usually the largest consumer. Retention policy decides how long they stay.',chk:`SELECT file_type, percent_space_used, percent_space_reclaimable FROM v$recovery_area_usage;`,see:[3,2,'Retention policies']},
 {id:'flb',x:354,y:24,w:139,h:56,c:'disk',t:'Flashback logs',s:'Flashback Database',d:'Logs of before images written by RVWR when Flashback Database is on.',why:'Their size follows the change rate and DB_FLASHBACK_RETENTION_TARGET.',chk:`SELECT retention_target, estimated_flashback_size/1024/1024 AS est_mb FROM v$flashback_database_log;`,see:[6,3,'Flashback Database and flashback logs']},
 {id:'auto',x:521,y:24,w:139,h:56,c:'disk',t:'Autobackups',s:'control file and SPFILE',d:'The control file and SPFILE backups written after each backup and structural change.',why:'Small, but they are what lets you restore without a catalog.',chk:`RMAN> LIST BACKUP OF CONTROLFILE;`,see:[2,5,'Backing up control files and SPFILE']},
 {id:'fra',x:240,y:136,w:200,h:56,c:'proc',t:'FRA limit',s:'DB_RECOVERY_FILE_DEST_SIZE',d:'A directory plus a size limit. The limit is a quota Oracle respects; it is not a disk reservation.',why:'The disk can be smaller than the limit, and the limit can be exceeded by non-reclaimable files.',chk:`SELECT name, space_limit/1024/1024 AS limit_mb, space_used/1024/1024 AS used_mb, space_reclaimable/1024/1024 AS reclaim_mb FROM v$recovery_file_dest;`,see:[1,4,'Fast Recovery Area setup']},
 {id:'rec',x:21,y:248,w:194,h:56,c:'mem',t:'Reclaimable',s:'safe to delete',d:'Files that are obsolete under the retention policy, or archived logs that have been backed up and applied as the deletion policy requires.',why:'Oracle deletes these automatically under space pressure.',chk:`SELECT file_type, percent_space_reclaimable FROM v$recovery_area_usage WHERE percent_space_reclaimable > 0;`,see:[3,3,'Archivelog deletion policies']},
 {id:'full',x:243,y:248,w:194,h:56,c:'warn',t:'FRA full',s:'ORA-19809, ORA-19815',d:'The area is at its limit with nothing reclaimable. Archiving stops and the log switch waits.',why:'The database appears hung. Sessions wait, and commits can stall once all redo groups need archiving.',chk:`SELECT message_text FROM v$diag_alert_ext WHERE message_text LIKE '%ORA-19815%' ORDER BY originating_timestamp DESC FETCH FIRST 3 ROWS ONLY;`,see:[9,1,'Common errors']},
 {id:'fix',x:465,y:248,w:194,h:56,c:'proc',t:'Fix',s:'free or grow',d:'Back up the archived logs, run DELETE OBSOLETE, correct the deletion policy, or raise the size limit.',why:'Never remove files by hand: the control file still lists them.',chk:`ALTER SYSTEM SET db_recovery_file_dest_size = 200G SCOPE = BOTH;
RMAN> DELETE NOPROMPT OBSOLETE;`,see:[1,4,'Fast Recovery Area setup']}],
 steps:[
 {ids:['arch','bkp','flb','auto'],t:'1. Every file type that targets the FRA is created in its own subdirectory and counted against the limit.',w:'One quota covers everything, so the pieces compete for space.',s:'`DB_RECOVERY_FILE_DEST`, `DB_RECOVERY_FILE_DEST_SIZE`, `LOG_ARCHIVE_DEST_n`.',x:'Setting the destination without the size first returns ORA-19802.',c:`SELECT file_type, percent_space_used FROM v$recovery_area_usage;`},
 {ids:['fra'],t:'2. Usage climbs as backups, archives and flashback logs accumulate. At around 85% Oracle writes a warning to the alert log, and at 97% a critical alert.',w:'Early warning leaves time to act.',s:'Server-generated alerts, `DBA_OUTSTANDING_ALERTS`.',x:'If nobody monitors the alerts, the first sign is a hang.',c:`SELECT object_type, reason FROM dba_outstanding_alerts WHERE object_type = 'RECOVERY AREA';`},
 {ids:['fra','rec'],t:'3. Under space pressure Oracle deletes files that are reclaimable, oldest first, and that is why used space is never the whole story.',w:'This is the self-maintaining behaviour of the FRA.',s:'Retention policy, archivelog deletion policy, `KEEP` options.',x:'A file with a KEEP clause or still needed by a guaranteed restore point is not reclaimable.',c:`SELECT file_type, percent_space_used, percent_space_reclaimable FROM v$recovery_area_usage;`},
 {ids:['fra','full'],t:'4. If nothing is reclaimable the area is full. The archiver cannot write, and after all redo groups wait for archiving the database stops accepting changes.',w:'Oracle protects recoverability by stopping rather than discarding history.',s:'`DB_RECOVERY_FILE_DEST_SIZE`, an additional `LOG_ARCHIVE_DEST_n`.',x:'Archiver stuck (ORA-00257) with the message to delete files, and the alert log shows ORA-19815.',c:`SELECT dest_id, status, error FROM v$archive_dest WHERE status <> 'INACTIVE';`},
 {ids:['fix'],t:'5. You free space by backing up and deleting archived logs, deleting obsolete backups, fixing the policy that kept them, or raising the size limit (and the disk).',w:'Fix the cause too: a missing archivelog backup job or a standby that is behind.',s:'`RMAN BACKUP ARCHIVELOG ALL DELETE INPUT`, `DELETE OBSOLETE`, size parameter.',x:'Removing files with `rm` leaves the repository wrong and the FRA still counting them until a crosscheck.',c:`RMAN> BACKUP ARCHIVELOG ALL DELETE INPUT;
RMAN> CROSSCHECK ARCHIVELOG ALL;
RMAN> DELETE EXPIRED ARCHIVELOG ALL;`}]}},

{h:'3. What recovery is made of'},
{map:{title:'Recovery building blocks map',h:216,trace:'Recover a lost datafile',
 hint:'Tap any box, or press Recover a lost datafile to see which piece does which part of a recovery.',
 lines:[[89,80,89,134],[256,80,256,134],'M423 80 L423 107 L256 107 L256 134',[159,164,185,164],[326,164,352,164],[493,164,519,164],[590,80,590,134]],
 nodes:[
 {id:'bkp',x:20,y:24,w:139,h:56,c:'disk',t:'Backup',s:'old copy of the file',d:'A backup set or image copy of the datafile. It is a snapshot at some earlier SCN.',why:'On its own it is out of date. It is the starting point.',chk:`RMAN> LIST BACKUP OF DATAFILE 5;`,see:[4,0,'Restore vs recover']},
 {id:'arc',x:187,y:24,w:139,h:56,c:'disk',t:'Archived redo',s:'history since backup',d:'The archived copies of redo logs from the backup time until the last log switch.',why:'A missing log in the sequence stops recovery at that point.',chk:`SELECT sequence#, first_change#, next_change# FROM v$archived_log ORDER BY sequence# DESC FETCH FIRST 5 ROWS ONLY;`,see:[0,3,'How Oracle recovery works']},
 {id:'onl',x:354,y:24,w:139,h:56,c:'disk',t:'Online redo',s:'the last changes',d:'The current redo log group holds changes that were never archived yet.',why:'It is what lets recovery reach the moment of failure with no data loss.',chk:`SELECT group#, sequence#, status, archived FROM v$log;`,see:[0,3,'How Oracle recovery works']},
 {id:'ctl',x:521,y:24,w:139,h:56,c:'disk',t:'Control file',s:'what and where',d:'Lists the datafiles, their checkpoint SCNs and the backup records RMAN uses to plan a restore.',why:'Recovery needs to know which backup and which logs apply.',chk:`SELECT file#, checkpoint_change#, status FROM v$datafile_header;`,see:[4,3,'Control file loss and recovery']},
 {id:'rest',x:20,y:136,w:139,h:56,c:'proc',t:'Restored file',s:'old but back',d:'The datafile copied from the backup into place. Its header SCN says how old it is.',why:'It cannot be used until redo has been applied.',chk:`SELECT file#, error, change# FROM v$recover_file;`,see:[4,0,'Restore vs recover: the recovery workflow']},
 {id:'rf',x:187,y:136,w:139,h:56,c:'proc',t:'Roll forward',s:'apply redo',d:'Redo from the archived and online logs is applied to the restored file to bring it up to the target SCN.',why:'It reapplies every change, committed or not.',chk:`RMAN> RECOVER DATAFILE 5;`,see:[0,3,'How Oracle recovery works']},
 {id:'rb',x:354,y:136,w:139,h:56,c:'proc',t:'Roll back',s:'remove uncommitted',d:'Changes that belonged to transactions not committed at the target SCN are undone using undo.',why:'Done automatically after open for datafile recovery.',chk:`SELECT usn, state FROM v$fast_start_transactions;`,see:[0,3,'How Oracle recovery works']},
 {id:'open',x:521,y:136,w:139,h:56,c:'ext',t:'Consistent file',s:'back online',d:'The file is current and consistent with the rest of the database and can be used.',why:'Bring it online, and the work is done. Take a backup if the recovery used RESETLOGS.',chk:`ALTER DATABASE DATAFILE 5 ONLINE;`,see:[4,1,'Recovering from datafile and tablespace loss']}],
 steps:[
 {ids:['ctl','bkp'],t:'1. RMAN reads the control file (or catalog) to find the best backup of the file and the logs needed after it.',w:'The repository is what turns "restore this file" into a concrete plan.',s:'Retention, incarnation, the SET UNTIL clause.',x:'RMAN-06023 means no usable backup was found for the file.',c:`RMAN> RESTORE DATAFILE 5 PREVIEW;`},
 {ids:['bkp','rest'],t:'2. The backup is restored: the file is copied into place from the backup set or image copy.',w:'This is the slow part for large files, and it is I/O bound.',s:'Channels, `SET NEWNAME`, `SWITCH TO COPY`.',x:'No space at the destination or a missing backup piece stops the restore.',c:`RMAN> RESTORE DATAFILE 5;`},
 {ids:['rest','arc','onl','rf'],t:'3. Redo is applied: archived logs first, then the online redo, moving the file from the backup SCN to the current SCN.',w:'The more redo since the backup, the longer this takes, so frequent incrementals help.',s:'`RECOVER`, `RECOVERY_PARALLELISM`, incremental backups applied first.',x:'A missing or corrupt archived log gives RMAN-06053 or ORA-00308.',c:`RMAN> RECOVER DATAFILE 5;`},
 {ids:['rf','rb'],t:'4. After the roll forward, uncommitted changes are rolled back from undo, as with instance recovery.',w:'It ensures the file reflects only committed work.',s:'Undo tablespace availability, `FAST_START_PARALLEL_ROLLBACK`.',x:'A lost undo tablespace makes this a bigger recovery.',c:`SELECT * FROM v$fast_start_transactions;`},
 {ids:['rb','open'],t:'5. The file is brought back online and users can use it again, with no data lost for a complete recovery.',w:'Complete recovery loses nothing.',s:'`ALTER DATABASE DATAFILE ... ONLINE`.',x:'If the file stays recovering, a log was missing and you must go incomplete.',c:`SELECT file#, online_status FROM v$recover_file;`}]}},

{h:'4. Flashback: which tool undoes which mistake'},
{map:{title:'Flashback tool map',h:328,trace:'Choose the right Flashback tool',
 hint:'Tap any box, or press Choose the right Flashback tool to match a mistake to the smallest fix.',
 lines:[[118,80,118,134],[340,80,340,134],[562,80,562,134],[118,192,118,246],[340,192,340,246],[562,192,562,246]],
 nodes:[
 {id:'p1',x:21,y:24,w:194,h:56,c:'warn',t:'Wrong rows',s:'bad UPDATE or DELETE',d:'A committed statement changed or removed the wrong rows in one or a few tables.',why:'The data is wrong, not missing, so a datafile restore is far too big.',chk:`SELECT * FROM orders VERSIONS BETWEEN TIMESTAMP SYSTIMESTAMP - INTERVAL '30' MINUTE AND SYSTIMESTAMP WHERE order_id = 1001;`,see:[6,1,'Flashback Query, Versions Query']},
 {id:'p2',x:243,y:24,w:194,h:56,c:'warn',t:'Table dropped',s:'DROP TABLE',d:'A table was dropped, with or without its data being needed urgently.',why:'Without PURGE the table is still in the recycle bin.',chk:`SELECT object_name, original_name, droptime FROM user_recyclebin;`,see:[6,2,'Flashback Table and the recycle bin']},
 {id:'p3',x:465,y:24,w:194,h:56,c:'warn',t:'Whole database',s:'bad release or batch',d:'A release or job damaged many tables, or the logical state of the whole database is wrong.',why:'Row-level tools are too slow when thousands of objects are affected.',chk:`SELECT name, scn, time FROM v$restore_point;`,see:[6,3,'Flashback Database and flashback logs']},
 {id:'fq',x:21,y:136,w:194,h:56,c:'proc',t:'Query and Table',s:'AS OF, FLASHBACK TABLE',d:'Flashback Query reads old rows, Versions Query shows each change, and Flashback Table rewinds a table in place.',why:'Use it first for row-level mistakes: no outage, no restore.',chk:`FLASHBACK TABLE orders TO TIMESTAMP SYSTIMESTAMP - INTERVAL '15' MINUTE;`,see:[6,1,'Flashback Query, Versions Query']},
 {id:'rbin',x:243,y:136,w:194,h:56,c:'proc',t:'Flashback Drop',s:'TO BEFORE DROP',d:'Restores a dropped table from the recycle bin together with its indexes and constraints.',why:'It is only available while the space is still held by the recycle bin.',chk:`FLASHBACK TABLE orders TO BEFORE DROP;`,see:[6,2,'Flashback Table and the recycle bin']},
 {id:'fdb',x:465,y:136,w:194,h:56,c:'proc',t:'Flashback Database',s:'FLASHBACK DATABASE',d:'Rewinds the whole database to a time, SCN or restore point and then opens with RESETLOGS.',why:'The fastest way back from a failed release or upgrade.',chk:`FLASHBACK DATABASE TO RESTORE POINT before_release;`,see:[6,3,'Flashback Database and flashback logs']},
 {id:'undo',x:21,y:248,w:194,h:56,c:'mem',t:'Undo data',s:'UNDO_RETENTION',d:'Query and Table rely on undo that is still available. It is overwritten as retention expires.',why:'Larger retention or a retention guarantee extends the window.',chk:`SELECT tablespace_name, retention FROM dba_tablespaces WHERE contents = 'UNDO';`,see:[6,0,'Flashback overview']},
 {id:'space',x:243,y:248,w:194,h:56,c:'disk',t:'Recycle bin space',s:'in the tablespace',d:'Dropped objects stay in their tablespace until space is needed or they are purged.',why:'It is not guaranteed. A PURGE or space pressure removes it.',chk:`SELECT space, COUNT(*) FROM dba_recyclebin GROUP BY space;`,see:[6,2,'Flashback Table and the recycle bin']},
 {id:'flog',x:465,y:248,w:194,h:56,c:'disk',t:'Flashback logs',s:'FRA and RVWR',d:'Before images written by RVWR for Flashback Database, kept for DB_FLASHBACK_RETENTION_TARGET minutes.',why:'They are what you pay in FRA space for the ability to rewind.',chk:`SELECT oldest_flashback_time, flashback_size/1024/1024 AS mb FROM v$flashback_database_log;`,see:[6,3,'Flashback Database and flashback logs']}],
 steps:[
 {ids:['p1','fq','undo'],t:'1. A committed UPDATE changed the wrong rows. Flashback Query shows the old rows, and Flashback Table or an INSERT SELECT from AS OF puts them back.',w:'It repairs only what is wrong and keeps the rest of the database available.',s:'`UNDO_RETENTION`, `RETENTION GUARANTEE`, `ENABLE ROW MOVEMENT` for Flashback Table.',x:'ORA-01555 on the flashback query means the undo has already been reused.',c:`SELECT * FROM orders AS OF TIMESTAMP SYSTIMESTAMP - INTERVAL '20' MINUTE WHERE order_id = 1001;`},
 {ids:['p2','rbin','space'],t:'2. A table was dropped. It sits in the recycle bin under a system name, and FLASHBACK TABLE TO BEFORE DROP brings it back.',w:'No restore or recovery is needed.',s:'`RECYCLEBIN` parameter, tablespace free space, `PURGE`.',x:'DROP TABLE ... PURGE or a purge of the recycle bin removes the way back.',c:`SELECT original_name, object_name FROM user_recyclebin;
FLASHBACK TABLE orders TO BEFORE DROP;`},
 {ids:['p3','fdb','flog'],t:'3. A release damaged the whole database. Flashback Database rewinds it to a restore point taken before the release, using the flashback logs.',w:'It is minutes instead of the hours a restore and recover would take.',s:'`DB_FLASHBACK_RETENTION_TARGET`, guaranteed restore points, FRA size.',x:'You lose everything after the target time, and the rewind ends with OPEN RESETLOGS.',c:`SHUTDOWN IMMEDIATE
STARTUP MOUNT
FLASHBACK DATABASE TO RESTORE POINT before_release;
ALTER DATABASE OPEN RESETLOGS;`},
 {ids:['undo','flog'],t:'4. Each tool is bounded by what it keeps. Undo is short, the recycle bin is opportunistic, flashback logs are limited by the FRA and their retention target.',w:'It tells you how far back you can go and what it costs.',s:'Undo size and retention, FRA size, retention target.',x:'Past those limits only a backup restore can help.',c:`SELECT retention_target, oldest_flashback_time FROM v$flashback_database_log;`}]}},

{h:'5. Layers of protection'},
{map:{title:'Protection layers map',h:216,trace:'Match a failure to its layer',
 hint:'Tap any box, or press Match a failure to its layer to see which protection answers which failure.',
 lines:[],
 nodes:[
 {id:'mux',x:21,y:24,w:194,h:56,c:'disk',t:'Multiplexing',s:'redo and control file',d:'Two or more copies of each redo log group and the control file on different storage.',why:'A single lost member then costs nothing.',chk:`SELECT group#, member FROM v$logfile ORDER BY 1, 2;`,see:[4,4,'SPFILE loss and redo log loss']},
 {id:'fb',x:243,y:24,w:194,h:56,c:'mem',t:'Flashback',s:'undo, bin, logs',d:'The ability to undo user errors without a restore.',why:'It handles the most common failure: people.',chk:`SELECT flashback_on FROM v$database;`,see:[6,0,'Flashback overview']},
 {id:'bkp',x:465,y:24,w:194,h:56,c:'disk',t:'RMAN backups',s:'FRA and disk',d:'Regular full, incremental and archived log backups that can rebuild the database to a point in time.',why:'The base layer for media failure and logical errors outside Flashback range.',chk:`SELECT status, input_type, start_time FROM v$rman_backup_job_details ORDER BY start_time DESC FETCH FIRST 3 ROWS ONLY;`,see:[3,6,'Monitoring backups with V$RMAN views']},
 {id:'sby',x:21,y:136,w:194,h:56,c:'proc',t:'Standby',s:'Data Guard',d:'A synchronised copy in another location, ready to take over in minutes.',why:'It answers site loss, but it copies logical errors too.',chk:`SELECT database_role, protection_mode FROM v$database;`,see:[8,4,'DR vs backup: why you need both']},
 {id:'off',x:243,y:136,w:194,h:56,c:'ext',t:'Offsite copy',s:'tape, cloud, immutable',d:'Backups held outside the primary site and out of reach of normal admin accounts.',why:'It protects against ransomware and against a site loss that takes the backup system too.',chk:`RMAN> LIST BACKUP SUMMARY;`,see:[8,2,'Encrypted and immutable backups']},
 {id:'drill',x:465,y:136,w:194,h:56,c:'ext',t:'Restore drills',s:'prove it works',d:'Scheduled restores to another host with timing and a check of the result.',why:'A backup you have not restored is not yet a backup.',chk:`RMAN> RESTORE DATABASE VALIDATE;`,see:[9,4,'Testing restores and recovery drills']}],
 steps:[
 {ids:['mux'],t:'1. One redo member is lost. The database keeps running on the other member. You drop and re-add the member.',w:'Multiplexing absorbs small hardware failures silently.',s:'`ALTER DATABASE ADD LOGFILE MEMBER`, `V$LOGFILE`.',x:'If both members of a group are on the same disk, one failure takes both.',c:`SELECT group#, status, member FROM v$logfile;`},
 {ids:['fb'],t:'2. A user deletes the wrong rows. Flashback Query and Flashback Table repair them in minutes.',w:'No backup, no outage.',s:'Undo retention, restore points.',x:'The window closes as undo is reused.',c:`SELECT * FROM orders AS OF TIMESTAMP SYSTIMESTAMP - INTERVAL '10' MINUTE;`},
 {ids:['bkp'],t:'3. A datafile or disk is lost. RMAN restores the file from backup and applies redo, with the rest of the database online.',w:'It is the layer that always works, given backups and archived logs.',s:'Retention, archivelog backup frequency.',x:'A missing archived log or an unusable backup piece is the usual failure.',c:`RMAN> RESTORE DATAFILE 5;
RMAN> RECOVER DATAFILE 5;`},
 {ids:['sby'],t:'4. The primary site is lost. The standby takes over as primary in minutes by failover.',w:'Backups alone would take hours.',s:'Data Guard protection mode, Fast-Start Failover.',x:'Logical errors are replicated, so keep Flashback and backups.',c:`SELECT database_role FROM v$database;`},
 {ids:['off'],t:'5. A ransomware attack encrypts or deletes the backups on disk. The offsite immutable copy is untouched.',w:'A backup an attacker can delete is only a convenience.',s:'Retention lock, separate credentials, object lock.',x:'Backups reachable with production credentials are not protected.',c:`RMAN> LIST BACKUP SUMMARY;`},
 {ids:['drill'],t:'6. A scheduled drill restores to another host and times it. You learn the real recovery time and fix gaps before they matter.',w:'It turns the plan into evidence.',s:'A drill calendar, runbooks, automation.',x:'A missing wallet, lost password file or stale runbook shows up here, not in production.',c:`RMAN> RESTORE DATABASE PREVIEW SUMMARY;`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Seven small maps of how something happens, step by step: a weekly backup cycle, a datafile recovery, point-in-time recovery, a disaster restore, a restore point cycle, a duplicate and a PDB recovery.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. A weekly incremental backup cycle'},
{map:{title:'Weekly incremental cycle',h:216,trace:'Follow a week of backups',
 hint:'Tap any box, or press Follow a week of backups to see each job and what it leaves behind.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L562 107 L562 134',[465,164,439,164],[243,164,217,164]],
 nodes:[
 {id:'l0',x:20,y:24,w:139,h:56,c:'proc',t:'Level 0',s:'weekly base',d:'A level 0 incremental copies every used block and is the base for the week.',why:'It is the full backup of an incremental strategy.',chk:`RMAN> BACKUP INCREMENTAL LEVEL 0 DATABASE TAG 'WEEKLY';`,see:[2,1,'Incremental backups']},
 {id:'l1',x:187,y:24,w:139,h:56,c:'proc',t:'Level 1',s:'daily changes',d:'A level 1 backs up only changed blocks, differential by default.',why:'Small and quick, especially with block change tracking.',chk:`RMAN> BACKUP INCREMENTAL LEVEL 1 DATABASE TAG 'DAILY';`,see:[2,1,'Incremental backups']},
 {id:'arc',x:354,y:24,w:139,h:56,c:'proc',t:'Archived logs',s:'every few hours',d:'Archived logs are backed up so recovery can go past the last incremental.',why:'This sets your RPO between database backups.',chk:`RMAN> BACKUP ARCHIVELOG ALL NOT BACKED UP 2 TIMES DELETE INPUT;`,see:[2,0,'Full backups and archived log backups']},
 {id:'mon',x:521,y:24,w:139,h:56,c:'ext',t:'Check the job',s:'status and errors',d:'Confirm each job finished without errors and wrote the expected size.',why:'A silent failure shows up only when you need the backup.',chk:`SELECT start_time, status, input_type FROM v$rman_backup_job_details ORDER BY start_time DESC FETCH FIRST 7 ROWS ONLY;`,see:[3,6,'Monitoring backups with V$RMAN views']},
 {id:'vv',x:243,y:136,w:194,h:56,c:'mem',t:'Restore validate',s:'weekly proof',d:'Reads the backups a restore would use and checks they are complete and readable.',why:'It tests the media and the chain, not just that a job ran.',chk:`RMAN> RESTORE DATABASE VALIDATE;`,see:[3,4,'RESTORE VALIDATE and preview']},
 {id:'del',x:21,y:136,w:194,h:56,c:'proc',t:'Delete obsolete',s:'free space',d:'Removes backups no longer needed by the retention policy.',why:'Run it after a successful level 0, not before.',chk:`RMAN> DELETE NOPROMPT OBSOLETE;`,see:[3,2,'Retention policies and DELETE OBSOLETE']},
 {id:'xchk',x:465,y:136,w:194,h:56,c:'proc',t:'Crosscheck',s:'sync to the files',d:'Compares the repository with the files on disk and marks missing ones expired.',why:'Catches files removed by hand or by storage faults.',chk:`RMAN> CROSSCHECK BACKUP;
RMAN> CROSSCHECK ARCHIVELOG ALL;`,see:[3,1,'CROSSCHECK and expired vs obsolete']}],
 steps:[
 {ids:['l0'],t:'1. On the weekly day a level 0 backup runs. It contains all used blocks and is the base for the following incrementals.',w:'Everything restored this week starts here.',s:'`BACKUP INCREMENTAL LEVEL 0`, `TAG`, parallelism.',x:'Running out of FRA space or a long window are the usual problems.',c:`SELECT incremental_level, COUNT(*) FROM v$backup_datafile GROUP BY incremental_level;`},
 {ids:['l1'],t:'2. Each following night a level 1 backs up only blocks changed since the previous backup.',w:'It makes the nightly job short.',s:'Block change tracking, differential vs cumulative.',x:'Without block change tracking, each level 1 still scans every file.',c:`SELECT status FROM v$block_change_tracking;`},
 {ids:['arc'],t:'3. Through the day archived logs are backed up and removed once safely stored, which keeps the FRA from filling.',w:'It closes the gap between nightly backups.',s:'Archivelog deletion policy, job schedule.',x:'An archivelog job that fails silently fills the FRA.',c:`SELECT COUNT(*) FROM v$archived_log WHERE backup_count = 0 AND deleted = 'NO';`},
 {ids:['mon'],t:'4. Each morning you check the job result and size. A missing or short job is investigated the same day.',w:'It turns a failure into a ticket, not a surprise.',s:'EM, scheduler alerts, your monitoring.',x:'Success in the scheduler does not mean success in RMAN. Check RMAN status.',c:`SELECT status, COUNT(*) FROM v$rman_backup_job_details WHERE start_time > SYSDATE - 7 GROUP BY status;`},
 {ids:['xchk','vv'],t:'5. Weekly you crosscheck the repository against the files and run a restore validate to prove the backups can be read.',w:'It confirms the chain is complete and the media is good.',s:'`CROSSCHECK`, `RESTORE ... VALIDATE`.',x:'RMAN-06025 or missing pieces show here, while there is still time to fix them.',c:`RMAN> CROSSCHECK BACKUP;
RMAN> RESTORE DATABASE VALIDATE;`},
 {ids:['del'],t:'6. Finally the obsolete backups and expired records are deleted. The retention policy decides what goes.',w:'It keeps the FRA and the repository in bounds.',s:'`CONFIGURE RETENTION POLICY`.',x:'Deleting obsolete before a verified new level 0 leaves you with fewer restore points.',c:`RMAN> REPORT OBSOLETE;
RMAN> DELETE NOPROMPT OBSOLETE;`}]}},

{h:'2. Recovering a lost datafile with the database open'},
{map:{title:'Datafile recovery map',h:216,trace:'Recover a datafile',
 hint:'Tap any box, or press Recover a datafile to follow a complete recovery of one file while the database is open.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'detect',x:21,y:24,w:194,h:56,c:'warn',t:'Detect',s:'error or alert',d:'Find which file is lost or corrupt, from the error message, the alert log or V$RECOVER_FILE.',why:'You need the file number, not just a symptom.',chk:`SELECT file#, online_status, error FROM v$recover_file;`,see:[4,1,'Recovering from datafile and tablespace loss']},
 {id:'off',x:243,y:24,w:194,h:56,c:'proc',t:'Offline',s:'ALTER DATABASE',d:'Take the damaged file or tablespace offline so users of other data keep working.',why:'It limits the outage to the objects in that file.',chk:`ALTER DATABASE DATAFILE 5 OFFLINE;`,see:[4,1,'Recovering from datafile and tablespace loss']},
 {id:'rest',x:465,y:24,w:194,h:56,c:'proc',t:'Restore',s:'copy from backup',d:'RMAN copies the file from the best backup to the original or a new location.',why:'It needs the backup piece and enough space.',chk:`RMAN> RESTORE DATAFILE 5;`,see:[4,0,'Restore vs recover: the recovery workflow']},
 {id:'rec',x:21,y:136,w:194,h:56,c:'proc',t:'Recover',s:'apply redo',d:'Redo is applied to bring the file up to the current SCN.',why:'It needs every archived log since the backup.',chk:`RMAN> RECOVER DATAFILE 5;`,see:[4,0,'Restore vs recover: the recovery workflow']},
 {id:'on',x:243,y:136,w:194,h:56,c:'ext',t:'Online',s:'ALTER DATABASE',d:'Bring the file online. Sessions can use its objects again.',why:'Do this only after RECOVER succeeds.',chk:`ALTER DATABASE DATAFILE 5 ONLINE;`,see:[4,1,'Recovering from datafile and tablespace loss']},
 {id:'verify',x:465,y:136,w:194,h:56,c:'mem',t:'Verify',s:'check the data',d:'Confirm the file is clean and back up what you changed.',why:'Do not close the ticket before you have a backup of the recovered file.',chk:`RMAN> VALIDATE DATAFILE 5;
SELECT file#, status FROM v$datafile;`,see:[3,4,'RESTORE VALIDATE and preview']}],
 steps:[
 {ids:['detect'],t:'1. A query fails with ORA-01157 or ORA-01110, or a backup reports a missing file. You identify the file number.',w:'Never restore the wrong file.',s:'Alert log, `V$RECOVER_FILE`, `V$DATAFILE`.',x:'A file on a failed disk can take several tablespaces with it.',c:`SELECT file#, name, status FROM v$datafile WHERE status IN ('OFFLINE','RECOVER');`},
 {ids:['off'],t:'2. Take the file offline. The database stays open and unaffected data remains available.',w:'Only the affected objects are unavailable.',s:'`ALTER DATABASE DATAFILE ... OFFLINE`, `OFFLINE DROP` (NOARCHIVELOG only).',x:'For SYSTEM or UNDO you cannot take the file offline and must mount instead.',c:`ALTER DATABASE DATAFILE 5 OFFLINE;`},
 {ids:['rest'],t:'3. Restore the file from backup. Use `SET NEWNAME` and `SWITCH` if the original location is gone.',w:'It puts back the older copy of the file.',s:'`RESTORE DATAFILE`, `SET NEWNAME`, channels.',x:'RMAN-06023 means no backup of the file was found for the current incarnation.',c:`RMAN> RUN { SET NEWNAME FOR DATAFILE 5 TO '/u03/oradata/users01.dbf';
 RESTORE DATAFILE 5; SWITCH DATAFILE 5; }`},
 {ids:['rec'],t:'4. Recover the file. RMAN applies incrementals then archived and online redo up to the present.',w:'Without this step the file is out of date.',s:'`RECOVER DATAFILE`, `RECOVERY_PARALLELISM`.',x:'ORA-00308 or RMAN-06053 means an archived log is missing.',c:`RMAN> RECOVER DATAFILE 5;`},
 {ids:['on'],t:'5. Bring the file back online. Objects in it are usable again.',w:'It ends the outage for those objects.',s:'`ALTER DATABASE DATAFILE ... ONLINE`.',x:'ORA-01113 on online means recovery was not complete.',c:`ALTER DATABASE DATAFILE 5 ONLINE;`},
 {ids:['verify'],t:'6. Validate the file and take a fresh backup of it so the next failure starts from a current copy.',w:'It closes the loop and confirms no corruption remains.',s:'`VALIDATE`, `BACKUP DATAFILE`.',x:'Skipping this leaves a long recovery chain for the next time.',c:`RMAN> VALIDATE DATAFILE 5;
RMAN> BACKUP DATAFILE 5;`}]}},

{h:'3. Incomplete recovery to a point in time'},
{map:{title:'Point-in-time recovery map',h:216,trace:'Recover to a point in time',
 hint:'Tap any box, or press Recover to a point in time to follow a recovery up to just before a mistake.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'pick',x:20,y:24,w:139,h:56,c:'ext',t:'Pick the target',s:'time, SCN or sequence',d:'Decide the exact point just before the damage, using LogMiner, the alert log or application timestamps.',why:'A target that is too late includes the damage, and too early loses good data.',chk:`SELECT current_scn, TO_CHAR(SYSDATE,'YYYY-MM-DD HH24:MI:SS') FROM v$database;`,see:[4,5,'Incomplete recovery']},
 {id:'shut',x:187,y:24,w:139,h:56,c:'proc',t:'Stop and mount',s:'SHUTDOWN, MOUNT',d:'Shut the database down cleanly and start it in MOUNT mode. Full-database incomplete recovery needs it not open.',why:'Everything is unavailable, so this is a planned outage.',chk:`SHUTDOWN IMMEDIATE
STARTUP MOUNT`,see:[4,5,'Incomplete recovery']},
 {id:'setu',x:354,y:24,w:139,h:56,c:'proc',t:'SET UNTIL',s:'inside a RUN block',d:'Defines the stopping point for restore and recover in the same RUN block.',why:'The restore must choose backups taken before that point.',chk:`RMAN> RUN { SET UNTIL SCN 4829107; ... }`,see:[4,5,'Incomplete recovery']},
 {id:'rest',x:521,y:24,w:139,h:56,c:'proc',t:'Restore',s:'all datafiles',d:'Restore datafiles from a backup taken before the target.',why:'The backup must be older than the target time.',chk:`RMAN> RESTORE DATABASE;`,see:[4,0,'Restore vs recover']},
 {id:'rec',x:21,y:136,w:194,h:56,c:'proc',t:'Recover',s:'redo up to the target',d:'Apply redo until the target and stop.',why:'Everything after it is intentionally discarded.',chk:`RMAN> RECOVER DATABASE;`,see:[4,5,'Incomplete recovery']},
 {id:'reset',x:243,y:136,w:194,h:56,c:'warn',t:'OPEN RESETLOGS',s:'new incarnation',d:'Open the database with a new log sequence. This starts a new incarnation and discards the redo after the target.',why:'It cannot be undone, so confirm the data first with READ ONLY if unsure.',chk:`ALTER DATABASE OPEN RESETLOGS;`,see:[4,6,'OPEN RESETLOGS and incarnations']},
 {id:'bkp',x:465,y:136,w:194,h:56,c:'disk',t:'New backup',s:'right away',d:'Take a full backup of the new incarnation.',why:'Until you do, recovery from a new failure goes through the old chain.',chk:`RMAN> BACKUP INCREMENTAL LEVEL 0 DATABASE;`,see:[4,6,'OPEN RESETLOGS and incarnations']}],
 steps:[
 {ids:['pick'],t:'1. Find the last good moment. Use the alert log, application logs or LogMiner to get a time or SCN just before the error.',w:'Recovery quality depends on this answer.',s:'Supplemental logging, `DBMS_LOGMNR`.',x:'A time zone or clock difference can put the target an hour off.',c:`SELECT timestamp_to_scn(SYSTIMESTAMP - INTERVAL '30' MINUTE) FROM dual;`},
 {ids:['shut'],t:'2. Shut down and mount. Keep a copy of current archived logs and the control file before you start, in case you pick the wrong target.',w:'It is your only way back if the first attempt overshoots.',s:'`SHUTDOWN IMMEDIATE`, `STARTUP MOUNT`.',x:'Overwriting the archived logs you need by running new backups with DELETE INPUT.',c:`SHUTDOWN IMMEDIATE
STARTUP MOUNT`},
 {ids:['setu','rest'],t:'3. Within one RUN block set the target and restore the database, so RMAN selects backups older than the target.',w:'Setting UNTIL in a separate command is a common mistake.',s:'`SET UNTIL TIME`, `SET UNTIL SCN`, `SET UNTIL SEQUENCE`.',x:'Backups newer than the target are ignored, so an old enough backup must exist.',c:`RMAN> RUN { SET UNTIL SCN 4829107; RESTORE DATABASE; RECOVER DATABASE; }`},
 {ids:['rec'],t:'4. Recovery applies redo up to the target and stops. Later changes are not applied.',w:'This is what removes the damage.',s:'`RECOVER DATABASE UNTIL`.',x:'A missing log stops recovery early with ORA-00279 or ORA-00308.',c:`RMAN> LIST ARCHIVELOG ALL;`},
 {ids:['reset'],t:'5. Open with RESETLOGS. The database comes up at the target point, and a new incarnation begins.',w:'You cannot apply old redo to the new timeline.',s:'`ALTER DATABASE OPEN RESETLOGS`, `V$DATABASE_INCARNATION`.',x:'Opening READ ONLY first lets you check the data before you commit to RESETLOGS.',c:`SELECT incarnation#, status FROM v$database_incarnation;`},
 {ids:['bkp'],t:'6. Take a new level 0 backup at once. It becomes the base for the new incarnation.',w:'It closes the exposure window.',s:'Backup schedule, FRA space.',x:'Skipping it leaves you reliant on an older chain that spans the RESETLOGS.',c:`RMAN> BACKUP INCREMENTAL LEVEL 0 DATABASE;`}]}},

{h:'4. Restoring everything to a new host'},
{map:{title:'Disaster restore map',h:216,trace:'Rebuild after a total loss',
 hint:'Tap any box, or press Rebuild after a total loss to follow a restore of the whole database onto a new server.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'sw',x:20,y:24,w:139,h:56,c:'ext',t:'Prepare host',s:'software and dirs',d:'Install the same Oracle home version, create the directories and the oratab entry, and get the backups reachable.',why:'The restore needs the same or compatible software and paths, or SET NEWNAME.',chk:`$ cat /etc/oratab
$ ls -l /backup/ORCL`,see:[4,7,'Complete disaster: restore to a new host']},
 {id:'spf',x:187,y:24,w:139,h:56,c:'disk',t:'SPFILE',s:'from autobackup',d:'Set the DBID, start a dummy instance and restore the SPFILE from the control file autobackup.',why:'It gives the instance its parameters.',chk:`RMAN> SET DBID 1234567890;
RMAN> STARTUP FORCE NOMOUNT;
RMAN> RESTORE SPFILE FROM AUTOBACKUP;`,see:[4,4,'SPFILE loss and redo log loss']},
 {id:'nomnt',x:354,y:24,w:139,h:56,c:'proc',t:'NOMOUNT',s:'real instance',d:'Restart the instance with the restored SPFILE, adjusting paths if the layout changed.',why:'It allocates memory and starts processes without a database.',chk:`RMAN> STARTUP FORCE NOMOUNT;`,see:[4,7,'Complete disaster: restore to a new host']},
 {id:'ctl',x:521,y:24,w:139,h:56,c:'disk',t:'Control file',s:'from autobackup',d:'Restore the control file from the autobackup.',why:'It lists every datafile, so RMAN can plan the restore.',chk:`RMAN> RESTORE CONTROLFILE FROM AUTOBACKUP;`,see:[4,3,'Control file loss and recovery']},
 {id:'mnt',x:20,y:136,w:139,h:56,c:'proc',t:'MOUNT',s:'catalog backups',d:'Mount the database. If backups are in a different place, catalog them so RMAN knows them.',why:'Without the catalog step RMAN cannot find pieces moved to a new path.',chk:`RMAN> ALTER DATABASE MOUNT;
RMAN> CATALOG START WITH '/backup/ORCL/';`,see:[4,7,'Complete disaster: restore to a new host']},
 {id:'rest',x:187,y:136,w:139,h:56,c:'proc',t:'Restore',s:'all datafiles',d:'Restore every datafile, with SET NEWNAME if the paths differ.',why:'This is the long step and sets the RTO.',chk:`RMAN> RESTORE DATABASE;`,see:[4,7,'Complete disaster: restore to a new host']},
 {id:'rec',x:354,y:136,w:139,h:56,c:'proc',t:'Recover',s:'to latest archive',d:'Recover using the archived logs that are available. Without the current online redo, recovery stops at the last archive.',why:'This sets how much data is lost.',chk:`RMAN> RECOVER DATABASE;`,see:[4,7,'Complete disaster: restore to a new host']},
 {id:'opn',x:521,y:136,w:139,h:56,c:'warn',t:'OPEN RESETLOGS',s:'new database',d:'Open with RESETLOGS, recreating the online redo logs. Then fix the listener, the TNS entries and the services.',why:'Applications need to find the new host.',chk:`ALTER DATABASE OPEN RESETLOGS;`,see:[4,6,'OPEN RESETLOGS and incarnations']}],
 steps:[
 {ids:['sw'],t:'1. Prepare the new server with the same Oracle software, directories, OS settings and access to the backup location.',w:'Most surprises in a disaster are environmental.',s:'Oracle home and patch level, ORACLE_BASE, oratab.',x:'A different patch level can block OPEN RESETLOGS or force an upgrade step.',c:`$ $ORACLE_HOME/OPatch/opatch lsinventory | head`},
 {ids:['spf'],t:'2. With the DBID set, start a dummy instance and restore the SPFILE from the control file autobackup.',w:'You do not have a parameter file yet.',s:'`SET DBID`, `RESTORE SPFILE FROM AUTOBACKUP`.',x:'Without the DBID RMAN cannot pick the correct autobackup.',c:`RMAN> SET DBID 1234567890;
RMAN> RESTORE SPFILE FROM AUTOBACKUP;`},
 {ids:['nomnt','ctl'],t:'3. Restart in NOMOUNT with the restored SPFILE and restore the control file from the autobackup.',w:'The control file defines the database.',s:'`STARTUP NOMOUNT`, `RESTORE CONTROLFILE`.',x:'ORA-00205 on mount means the control file path in the SPFILE is wrong.',c:`RMAN> RESTORE CONTROLFILE FROM AUTOBACKUP;`},
 {ids:['mnt'],t:'4. Mount the database and catalog the backup files so RMAN knows where they are on this host.',w:'RMAN must know the pieces before it can restore.',s:'`CATALOG START WITH`, `CROSSCHECK`.',x:'Pieces not catalogued are invisible to RMAN.',c:`RMAN> CATALOG START WITH '/backup/ORCL/' NOPROMPT;
RMAN> LIST BACKUP SUMMARY;`},
 {ids:['rest','rec'],t:'5. Restore the datafiles and recover with all available archived logs. The data reaches the end of the last archived log you have.',w:'This is where RTO and RPO are decided.',s:'Parallel channels, `SET NEWNAME`, archived log availability.',x:'A gap in archived logs ends recovery early. Check the sequence list first.',c:`RMAN> RUN { RESTORE DATABASE; RECOVER DATABASE; }`},
 {ids:['opn'],t:'6. Open with RESETLOGS, recreate temp files, start the listener and register services, and take a new backup.',w:'Applications can only reconnect once the services are registered.',s:'`ALTER DATABASE OPEN RESETLOGS`, listener, `LOCAL_LISTENER`.',x:'Missing temp files and an unregistered service are the usual post-restore faults.',c:`SELECT name, open_mode FROM v$database;`}]}},

{h:'5. Flashback Database around a risky change'},
{map:{title:'Restore point cycle map',h:216,trace:'Protect a release',
 hint:'Tap any box, or press Protect a release to see how a guaranteed restore point is used and cleaned up.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],'M590 80 L590 107 L562 107 L562 134',[437,164,463,164]],
 nodes:[
 {id:'on',x:20,y:24,w:139,h:56,c:'proc',t:'Flashback on',s:'one-time setup',d:'Turn on Flashback Database. The database must be in ARCHIVELOG mode and the FRA configured.',why:'Restore points can be created without it, but guaranteed ones need the FRA.',chk:`ALTER DATABASE FLASHBACK ON;`,see:[6,3,'Flashback Database and flashback logs']},
 {id:'grp',x:187,y:24,w:139,h:56,c:'proc',t:'Restore point',s:'GUARANTEE',d:'A guaranteed restore point forces flashback logs to be kept until you drop it.',why:'It guarantees that you can always go back.',chk:`CREATE RESTORE POINT before_release GUARANTEE FLASHBACK DATABASE;`,see:[6,4,'Normal and guaranteed restore points']},
 {id:'chg',x:354,y:24,w:139,h:56,c:'ext',t:'Run the change',s:'release or batch',d:'Apply the upgrade script, release or data fix.',why:'While it runs, flashback logs accumulate and use FRA space.',chk:`SELECT storage_size/1024/1024 AS mb FROM v$restore_point;`,see:[6,6,'Practical: Undo a bad release with restore points']},
 {id:'dec',x:521,y:24,w:139,h:56,c:'mem',t:'Good or bad',s:'verify',d:'Check the result with application tests and data checks.',why:'The decision must be made before the FRA runs out.',chk:`SELECT name, time, storage_size FROM v$restore_point;`,see:[6,6,'Practical: Undo a bad release with restore points']},
 {id:'fbk',x:21,y:136,w:194,h:56,c:'warn',t:'Flashback',s:'FLASHBACK DATABASE',d:'If the change failed, rewind to the restore point in MOUNT mode.',why:'It is minutes instead of a full restore.',chk:`SHUTDOWN IMMEDIATE
STARTUP MOUNT
FLASHBACK DATABASE TO RESTORE POINT before_release;`,see:[6,3,'Flashback Database and flashback logs']},
 {id:'opn',x:243,y:136,w:194,h:56,c:'warn',t:'OPEN RESETLOGS',s:'new incarnation',d:'Open with RESETLOGS and check the data. The failed change is gone.',why:'You can also open READ ONLY first to check.',chk:`ALTER DATABASE OPEN RESETLOGS;`,see:[4,6,'OPEN RESETLOGS and incarnations']},
 {id:'drp',x:465,y:136,w:194,h:56,c:'proc',t:'Drop the point',s:'always',d:'Whether it worked or not, drop the guaranteed restore point.',why:'Flashback logs are held while it exists, and they fill the FRA.',chk:`DROP RESTORE POINT before_release;`,see:[6,4,'Normal and guaranteed restore points']}],
 steps:[
 {ids:['on'],t:'1. The prerequisites are checked: ARCHIVELOG mode, a sized FRA and flashback on.',w:'Without them the point is not guaranteed.',s:'`LOG_MODE`, `DB_RECOVERY_FILE_DEST_SIZE`, `DB_FLASHBACK_RETENTION_TARGET`.',x:'A small FRA fills quickly during a big batch.',c:`SELECT log_mode, flashback_on FROM v$database;`},
 {ids:['grp'],t:'2. Create the guaranteed restore point immediately before the change.',w:'It marks the exact SCN to return to.',s:'`CREATE RESTORE POINT ... GUARANTEE FLASHBACK DATABASE`.',x:'Forgetting to drop it later will fill the FRA.',c:`CREATE RESTORE POINT before_release GUARANTEE FLASHBACK DATABASE;`},
 {ids:['chg'],t:'3. Run the release. Flashback logs are generated for every block changed, and they are kept.',w:'This is the cost of the safety net.',s:'Release plan, FRA size.',x:'A long batch can fill the FRA before you finish.',c:`SELECT * FROM v$recovery_area_usage;`},
 {ids:['dec'],t:'4. Test the application and the data. Decide: keep the change or undo it.',w:'The decision needs a clear acceptance test, made ahead.',s:'Test plan, sign-off.',x:'Waiting too long costs FRA space and blocks other work.',c:`SELECT name, time FROM v$restore_point;`},
 {ids:['fbk','opn'],t:'5. To undo, mount the database, flash back to the restore point and open with RESETLOGS.',w:'The database is back to its pre-release state.',s:'`FLASHBACK DATABASE TO RESTORE POINT`.',x:'Anything committed after the point is lost, including legitimate user work.',c:`FLASHBACK DATABASE TO RESTORE POINT before_release;
ALTER DATABASE OPEN RESETLOGS;`},
 {ids:['drp'],t:'6. In both cases drop the restore point. Flashback logs held for it are released.',w:'It returns the FRA to normal.',s:'`DROP RESTORE POINT`.',x:'A forgotten guaranteed restore point is a common cause of a full FRA.',c:`SELECT name FROM v$restore_point WHERE guarantee_flashback_database = 'YES';`}]}},

{h:'6. Duplicating a database from its running source'},
{map:{title:'Active duplicate map',h:216,trace:'Duplicate a database',
 hint:'Tap any box, or press Duplicate a database to follow an active duplicate from preparation to an open copy.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'prep',x:20,y:24,w:139,h:56,c:'ext',t:'Prepare',s:'files and network',d:'Create a password file and a minimal parameter file for the auxiliary, create the directories and set up the listener entry.',why:'Active duplication connects over the network as SYSDBA, so it needs both the password file and a static listener entry.',chk:`$ orapwd file=$ORACLE_HOME/dbs/orapwTEST password=*** entries=5`,see:[7,2,'Preparing the auxiliary instance']},
 {id:'nom',x:187,y:24,w:139,h:56,c:'proc',t:'NOMOUNT',s:'auxiliary instance',d:'Start the auxiliary instance in NOMOUNT with the minimal parameter file.',why:'RMAN will fill in the rest.',chk:`SQL> STARTUP NOMOUNT PFILE='initTEST.ora'`,see:[7,2,'Preparing the auxiliary instance']},
 {id:'conn',x:354,y:24,w:139,h:56,c:'proc',t:'Connect',s:'target and auxiliary',d:'Connect RMAN to the source as target and to the new instance as auxiliary.',why:'The auxiliary must be reachable by a service name.',chk:`$ rman target sys@PROD auxiliary sys@TEST`,see:[7,1,'RMAN DUPLICATE']},
 {id:'dup',x:521,y:24,w:139,h:56,c:'proc',t:'DUPLICATE',s:'FROM ACTIVE DATABASE',d:'The command that drives everything. It builds the control file, restores files and recovers the copy.',why:'Options set the SPFILE, file names and whether to open.',chk:`RMAN> DUPLICATE TARGET DATABASE TO TEST FROM ACTIVE DATABASE SPFILE NOFILENAMECHECK;`,see:[7,1,'RMAN DUPLICATE: active vs backup-based']},
 {id:'ctlf',x:20,y:136,w:139,h:56,c:'disk',t:'Control file',s:'created for the copy',d:'RMAN creates a new control file for the duplicate with a new DBID.',why:'The copy will not be mistaken for the source.',chk:`SELECT dbid, name FROM v$database;`,see:[7,3,'Duplicating a database and a PDB']},
 {id:'copy',x:187,y:136,w:139,h:56,c:'disk',t:'Copy files',s:'over the network',d:'The source channels copy the datafiles to the auxiliary, as image copies or backup sets.',why:'Network speed and source CPU decide the time.',chk:`SELECT sid, opname, sofar, totalwork FROM v$session_longops WHERE opname LIKE 'RMAN%' AND sofar <> totalwork;`,see:[7,1,'RMAN DUPLICATE: active vs backup-based']},
 {id:'rcv',x:354,y:136,w:139,h:56,c:'proc',t:'Recover',s:'to a consistent point',d:'The copy is recovered to the source SCN at the time, using archived logs.',why:'It makes the copy consistent.',chk:`RMAN> LIST ARCHIVELOG ALL;`,see:[7,3,'Duplicating a database and a PDB']},
 {id:'opn',x:521,y:136,w:139,h:56,c:'ext',t:'Open',s:'RESETLOGS',d:'RMAN opens the duplicate with RESETLOGS. It is now an independent database.',why:'Then fix jobs, links and passwords so it does not talk to production.',chk:`SELECT name, open_mode, dbid FROM v$database;`,see:[7,6,'Practical: Duplicate production into a test database']}],
 steps:[
 {ids:['prep','nom'],t:'1. Prepare the auxiliary: password file, minimal parameters, directories, listener entry, and start it in NOMOUNT.',w:'RMAN needs a running instance to talk to.',s:'`DB_NAME`, `DB_FILE_NAME_CONVERT`, a static listener entry.',x:'ORA-01017 or ORA-12528 appear when the password file or listener is missing.',c:`$ sqlplus / as sysdba
SQL> STARTUP NOMOUNT PFILE='initTEST.ora'`},
 {ids:['conn','dup'],t:'2. Connect to both and run DUPLICATE ... FROM ACTIVE DATABASE with the options you need.',w:'One command does the whole build.',s:'`DUPLICATE ... SPFILE`, `PARAMETER_VALUE_CONVERT`, `NOFILENAMECHECK`.',x:'NOFILENAMECHECK on the same host overwrites the source files if paths are not changed.',c:`RMAN> DUPLICATE TARGET DATABASE TO TEST FROM ACTIVE DATABASE SPFILE PARAMETER_VALUE_CONVERT 'PROD','TEST' NOFILENAMECHECK;`},
 {ids:['ctlf'],t:'3. A control file is created for the new database with a new DBID.',w:'It makes the copy a different database.',s:'The new `DB_NAME`.',x:'Reusing DB_NAME with a shared catalog confuses backups.',c:`SELECT dbid FROM v$database;`},
 {ids:['copy'],t:'4. The datafiles are copied from the running source to the auxiliary over the network.',w:'The source stays open and in use.',s:'`USING BACKUPSET`, `SECTION SIZE`, parallelism.',x:'Heavy load on the source and the network during the copy.',c:`SELECT opname, ROUND(sofar/totalwork*100) AS pct FROM v$session_longops WHERE totalwork > 0 AND sofar <> totalwork;`},
 {ids:['rcv'],t:'5. The copy is recovered with archived logs to a consistent point, so it matches the source at that SCN.',w:'A datafile copy of a running database is inconsistent until redo is applied.',s:'Archived logs on the source, `UNTIL` options.',x:'A required archived log missing on the source stops the duplicate.',c:`RMAN> LIST ARCHIVELOG FROM TIME 'SYSDATE-1';`},
 {ids:['opn'],t:'6. Open the copy with RESETLOGS and then change what makes it dangerous: scheduler jobs, database links, mail settings, passwords and data masking.',w:'A test database that sends email or writes to production is an incident.',s:'`ALTER SYSTEM`, `DBMS_SCHEDULER`, masking tools.',x:'Forgetting to disable jobs and links.',c:`SELECT job_name, enabled FROM dba_scheduler_jobs WHERE enabled = 'TRUE';`}]}},

{h:'7. Recovering one pluggable database to a point in time'},
{map:{title:'PDB point-in-time map',h:216,trace:'Recover a PDB',
 hint:'Tap any box, or press Recover a PDB to follow a point-in-time recovery of one tenant while the others stay open.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'cls',x:21,y:24,w:194,h:56,c:'proc',t:'Close the PDB',s:'only that PDB',d:'Close the pluggable database. The CDB root and the other PDBs stay open.',why:'It is the whole outage for this recovery.',chk:`ALTER PLUGGABLE DATABASE pdb1 CLOSE IMMEDIATE;`,see:[5,3,'PDB point-in-time recovery']},
 {id:'set',x:243,y:24,w:194,h:56,c:'proc',t:'SET UNTIL',s:'time, SCN or sequence',d:'Choose the point in time inside a RUN block, connected to the root.',why:'Recovery applies to the PDB only.',chk:`RMAN> RUN { SET UNTIL TIME "TO_DATE('2026-10-10 14:30','YYYY-MM-DD HH24:MI')"; ... }`,see:[5,3,'PDB point-in-time recovery']},
 {id:'rst',x:465,y:24,w:194,h:56,c:'proc',t:'Restore PDB',s:'datafiles of the PDB',d:'Restore the PDB datafiles from backup.',why:'Only that PDB files are touched.',chk:`RMAN> RESTORE PLUGGABLE DATABASE pdb1;`,see:[5,2,'Recovering a PDB datafile or the whole PDB']},
 {id:'rcv',x:21,y:136,w:194,h:56,c:'proc',t:'Recover PDB',s:'auxiliary instance',d:'Recover the PDB to the target using redo. Unless local undo is used, RMAN builds a temporary auxiliary instance.',why:'It needs disk space for the auxiliary destination.',chk:`RMAN> RECOVER PLUGGABLE DATABASE pdb1 AUXILIARY DESTINATION '/u02/aux';`,see:[5,3,'PDB point-in-time recovery']},
 {id:'opn',x:243,y:136,w:194,h:56,c:'warn',t:'OPEN RESETLOGS',s:'PDB incarnation',d:'Open the PDB with RESETLOGS, which starts a new incarnation for that PDB only.',why:'The CDB incarnation is unchanged.',chk:`ALTER PLUGGABLE DATABASE pdb1 OPEN RESETLOGS;`,see:[5,3,'PDB point-in-time recovery']},
 {id:'chk',x:465,y:136,w:194,h:56,c:'mem',t:'Check and back up',s:'other PDBs untouched',d:'Verify the PDB data, confirm other PDBs were not affected and take a new backup.',why:'It proves the isolation and starts a new chain.',chk:`SELECT name, open_mode FROM v$pdbs;
RMAN> BACKUP PLUGGABLE DATABASE pdb1;`,see:[5,0,'Backing up a CDB and individual PDBs']}],
 steps:[
 {ids:['cls'],t:'1. Close only the damaged PDB. Other PDBs and the root remain open and available.',w:'It is the main benefit of multitenant recovery.',s:'`ALTER PLUGGABLE DATABASE ... CLOSE`.',x:'A session left in the PDB blocks the close, so use IMMEDIATE.',c:`ALTER PLUGGABLE DATABASE pdb1 CLOSE IMMEDIATE;`},
 {ids:['set','rst'],t:'2. Connected to the root, define the target and restore the PDB datafiles.',w:'The command is issued from the root and names the PDB.',s:'`SET UNTIL`, `RESTORE PLUGGABLE DATABASE`.',x:'Connecting directly to the PDB changes the allowed commands. Check the container.',c:`RMAN> RUN { SET UNTIL SCN 4829107; RESTORE PLUGGABLE DATABASE pdb1; }`},
 {ids:['rcv'],t:'3. Recover the PDB to the target. RMAN uses the auxiliary destination to build a temporary instance when local undo is not used.',w:'It needs the undo from that time.',s:'`AUXILIARY DESTINATION`, `LOCAL UNDO ON`.',x:'Not enough space in the auxiliary destination is the usual failure.',c:`RMAN> RECOVER PLUGGABLE DATABASE pdb1 AUXILIARY DESTINATION '/u02/aux';`},
 {ids:['opn'],t:'4. Open the PDB with RESETLOGS. The PDB has a new incarnation and the CDB is unchanged.',w:'It cannot affect other PDBs.',s:'`V$PDB_INCARNATION`.',x:'Always check whether you recovered the right PDB before opening.',c:`ALTER PLUGGABLE DATABASE pdb1 OPEN RESETLOGS;`},
 {ids:['chk'],t:'5. Check the data, check that the other PDBs are open, and take a new backup of the recovered PDB.',w:'It confirms the scope and starts a new chain.',s:'Backup schedule.',x:'A PDB restored without a new backup repeats the long chain next time.',c:`SELECT con_id, name, open_mode FROM v$pdbs;`}]}},

]},

/* 1 ---------------------------------------------------------------- components */
{t:'Components and processes',d:'The pieces involved in a backup or a recovery and where each one lives.',see:[[1,0,'RMAN architecture'],[0,3,'How recovery works']],b:[
{t:[['Component','Role','Look here'],
['RMAN client','The command line that sends instructions. Moves no data itself.','`rman target /`'],
['Server session (channel)','Reads the datafiles, writes backup pieces. One per parallel stream.','`V$SESSION` (program `rman@host`), `V$PROCESS`'],
['Target database','The database being protected','`V$DATABASE`'],
['Repository','Metadata about backups: always in the control file, optionally in a recovery catalog','`V$BACKUP_SET`, `RC_BACKUP_SET`'],
['Recovery catalog','A schema in a separate database that keeps the metadata longer and for many databases','`rman ... catalog rcat@rcatdb`'],
['Fast Recovery Area (FRA)','Default location for backups, archived logs and flashback logs','`V$RECOVERY_FILE_DEST`'],
['ARCn','Archives online redo logs','`V$ARCHIVED_LOG`'],
['CTWR','Records changed blocks for fast incrementals (block change tracking)','`V$BLOCK_CHANGE_TRACKING`'],
['RVWR','Writes flashback logs','`V$FLASHBACK_DATABASE_LOG`'],
['SBT media manager','Tape or cloud library used through the SBT interface','`CONFIGURE CHANNEL DEVICE TYPE SBT`'],
['Recovery Appliance (ZDLRA)','Central backup system receiving redo and incrementals','Appliance console']]},
{note:'Backup and recovery run in the **server sessions**. If a backup is slow, look at the channels and the storage, not at the RMAN client.'}
]},

/* 2 ---------------------------------------------------------------- files / FRA */
{t:'Files and FRA layout',d:'What each backup-related file is, where the FRA puts it, and how it is named.',see:[[0,5,'ARCHIVELOG and the FRA'],[1,4,'FRA setup']],b:[
{t:[['Item','Contents','Note'],
['Backup set','One or more backup pieces holding file blocks (unused blocks skipped)','Can be compressed, encrypted, sent to tape'],
['Backup piece','One physical file of a backup set','Name from `FORMAT`, default `%U`'],
['Image copy','Exact copy of a datafile, control file or archived log','Disk only; `SWITCH TO COPY` restores in seconds'],
['Control file autobackup','Control file and SPFILE after each backup','Name contains the DBID (`%F`)'],
['Archived log backup','Copies of archived logs in a set','`BACKUP ARCHIVELOG ALL`'],
['Incremental backup','Blocks changed since a reference backup (level 0 or 1)','Faster with block change tracking'],
['Flashback log','Block pre-images (`o1_mf_..._.flb`)','Kept for `db_flashback_retention_target`'],
['Guaranteed restore point','SCN name with forced flashback log retention','Drop it when finished'],
['Block change tracking file','Map of changed blocks','Small; enable on large databases']]},
{h:'FRA directory layout (OMF)'},
{t:[['Path under FRA','Content'],
['`<DB_UNIQUE_NAME>/ARCHIVELOG/<date>/`','Archived redo logs'],
['`<DB_UNIQUE_NAME>/BACKUPSET/<date>/`','Backup pieces'],
['`<DB_UNIQUE_NAME>/AUTOBACKUP/<date>/`','Control file and SPFILE autobackups'],
['`<DB_UNIQUE_NAME>/DATAFILE/`','Image copies of datafiles'],
['`<DB_UNIQUE_NAME>/FLASHBACK/`','Flashback logs'],
['`<DB_UNIQUE_NAME>/CONTROLFILE/`, `ONLINELOG/`','Multiplexed copies']]},
{note:'Do not delete files in the FRA with `rm`. Use RMAN `DELETE` so the repository and the space accounting stay correct.'}
]},

/* 3 ---------------------------------------------------------------- logs */
{t:'Log files and where to find them',d:'Where the evidence is when a backup or restore does not behave.',see:[[9,0,'A troubleshooting method'],[3,6,'Monitoring with V$RMAN views']],b:[
{t:[['Log','Contains','Where'],
['RMAN output','Each command, channel and error','Console, or the file named in `log=`, and `V$RMAN_OUTPUT`'],
['Alert log','Archiving errors, FRA warnings, ORA- errors during recovery','`$ORACLE_BASE/diag/rdbms/<db>/<SID>/trace/alert_<SID>.log`'],
['Server session trace','Channel details (`ora_<pid>.trc`) and media manager messages','`.../trace/`'],
['SBT media manager log','Messages from the tape or cloud library','Vendor path; enable debug with `PARMS`'],
['Job history','One row per backup job with start, end, status','`V$RMAN_BACKUP_JOB_DETAILS`'],
['Per-command status','Each RMAN command and its result','`V$RMAN_STATUS`'],
['Data Pump and DBVERIFY output','For logical backups and offline checks','The files you named']]},
{code:`SELECT start_time, end_time, status, input_type, output_bytes_display
FROM v$rman_backup_job_details WHERE start_time > SYSDATE - 7 ORDER BY start_time;

SELECT operation, status, start_time FROM v$rman_status WHERE start_time > SYSDATE - 1 ORDER BY recid;`}
]},

/* 4 ---------------------------------------------------------------- settings */
{t:'Important settings',d:'The RMAN CONFIGURE settings and the parameters that shape a backup strategy.',see:[[1,3,'CONFIGURE settings'],[0,5,'ARCHIVELOG and FRA']],b:[
{h:'RMAN CONFIGURE'},
{t:[['Setting','Typical','Why'],
['`RETENTION POLICY`','`TO RECOVERY WINDOW OF 7 DAYS` (or `REDUNDANCY 2`)','Decides what is obsolete'],
['`CONTROLFILE AUTOBACKUP`','`ON`','Always on; enables restore with only the DBID'],
['`CONTROLFILE AUTOBACKUP FORMAT`','`FOR DEVICE TYPE DISK TO \'/backup/cf_%F\'`','Known location'],
['`DEVICE TYPE DISK PARALLELISM`','2 to 8','Number of channels'],
['`BACKUP OPTIMIZATION`','`ON`','Skip files already backed up'],
['`DEFAULT DEVICE TYPE`','`DISK` or `SBT`','Where backups go'],
['`COMPRESSION ALGORITHM`','`\'MEDIUM\'` (LOW, MEDIUM, HIGH need Advanced Compression)','Smaller backups'],
['`ENCRYPTION FOR DATABASE`','`ON`','Backups protected with the keystore'],
['`ARCHIVELOG DELETION POLICY`','`TO BACKED UP 1 TIMES TO DISK` or `APPLIED ON ALL STANDBY`','Safe log deletion'],
['`MAXSETSIZE`, `MAXPIECESIZE`','Unset','Limit file size for media'],
['`SNAPSHOT CONTROLFILE NAME`','In shared storage for RAC','Needed by all nodes']]},
{h:'Database parameters'},
{t:[['Parameter','Default','Note'],
['`db_recovery_file_dest_size`','unset','Quota for the FRA, set before the location'],
['`db_recovery_file_dest`','unset','FRA location, such as `+FRA`'],
['`db_flashback_retention_target`','1440 minutes','How far back Flashback Database should reach'],
['`control_file_record_keep_time`','7 days','How long the control file keeps RMAN records'],
['`undo_retention`','900 s','Flashback Query depth (needs undo space)'],
['`log_archive_dest_1`','`USE_DB_RECOVERY_FILE_DEST`','Archive destination'],
['`log_archive_format`','`%t_%s_%r.arc`','Archived log names'],
['`db_block_checking`, `db_block_checksum`','`FALSE`, `TYPICAL`','Corruption detection level']]},
{note:'Show current settings with `SHOW ALL;` and change one back to default with `CONFIGURE ... CLEAR;`.'}
]},

/* 5 ---------------------------------------------------------------- views */
{t:'System views',d:'Which view answers which backup or recovery question.',see:[[3,6,'Monitoring with V$RMAN views'],[6,0,'Flashback overview']],b:[
{t:[['Question','View'],
['Is the database in ARCHIVELOG? Flashback on?','`V$DATABASE` (`LOG_MODE`, `FLASHBACK_ON`)'],
['What backups exist?','`V$BACKUP_SET`, `V$BACKUP_PIECE`, `V$BACKUP_DATAFILE`'],
['How did the last jobs end?','`V$RMAN_BACKUP_JOB_DETAILS`'],
['Which RMAN settings are active?','`V$RMAN_CONFIGURATION`'],
['What needs recovery?','`V$RECOVER_FILE`, `V$DATAFILE_HEADER`'],
['What is the archived log history?','`V$ARCHIVED_LOG`, `V$LOG_HISTORY`, `V$ARCHIVE_DEST`'],
['Is the FRA filling?','`V$RECOVERY_FILE_DEST`, `V$RECOVERY_AREA_USAGE`'],
['Are there corrupt blocks?','`V$DATABASE_BLOCK_CORRUPTION`, `V$BACKUP_CORRUPTION`'],
['Which incarnation am I in?','`V$DATABASE_INCARNATION`'],
['How far back can I flash back?','`V$FLASHBACK_DATABASE_LOG`, `V$FLASHBACK_DATABASE_STAT`'],
['Which restore points exist?','`V$RESTORE_POINT`'],
['Are incrementals using change tracking?','`V$BLOCK_CHANGE_TRACKING`'],
['What is the control file autobackup state?','`V$CONTROLFILE`, `V$RMAN_CONFIGURATION`'],
['Recycle bin contents','`DBA_RECYCLEBIN`'],
['Catalog (if used)','`RC_DATABASE`, `RC_BACKUP_SET`, `RC_RMAN_STATUS`']]}
]},

/* 6 ---------------------------------------------------------------- RMAN commands */
{t:'RMAN commands',d:'The commands you use most, grouped by task.',see:[[2,0,'Taking backups'],[3,0,'LIST and REPORT']],b:[
{h:'Back up'},
{t:[['Task','Command'],
['Whole database with logs','`BACKUP DATABASE PLUS ARCHIVELOG;`'],
['Compressed','`BACKUP AS COMPRESSED BACKUPSET DATABASE;`'],
['Level 0 / level 1','`BACKUP INCREMENTAL LEVEL 0 DATABASE;`, `BACKUP INCREMENTAL LEVEL 1 DATABASE;`'],
['Cumulative level 1','`BACKUP INCREMENTAL LEVEL 1 CUMULATIVE DATABASE;`'],
['Archived logs not yet saved','`BACKUP ARCHIVELOG ALL NOT BACKED UP 1 TIMES DELETE INPUT;`'],
['One PDB','`BACKUP PLUGGABLE DATABASE pdb1;`'],
['Image copy','`BACKUP AS COPY DATABASE;`'],
['Incrementally updated copy','`RECOVER COPY OF DATABASE WITH TAG \'upd\'; BACKUP INCREMENTAL LEVEL 1 FOR RECOVER OF COPY WITH TAG \'upd\' DATABASE;`'],
['Control file, SPFILE','`BACKUP CURRENT CONTROLFILE; BACKUP SPFILE;`'],
['Archive copy for a year','`BACKUP DATABASE KEEP UNTIL TIME \'SYSDATE+365\' TAG \'year_end\';`']]},
{h:'Check and maintain'},
{t:[['Task','Command'],
['What do I have?','`LIST BACKUP SUMMARY;`, `LIST BACKUP OF DATABASE;`, `LIST ARCHIVELOG ALL;`'],
['What is missing or obsolete?','`REPORT NEED BACKUP;`, `REPORT OBSOLETE;`'],
['Reconcile with disk','`CROSSCHECK BACKUP; CROSSCHECK ARCHIVELOG ALL;`'],
['Remove missing entries','`DELETE EXPIRED BACKUP;`'],
['Remove what the policy no longer needs','`DELETE OBSOLETE;`'],
['Test backups without restoring','`RESTORE DATABASE VALIDATE;`, `BACKUP VALIDATE CHECK LOGICAL DATABASE;`'],
['Preview a restore','`RESTORE DATABASE PREVIEW SUMMARY;`']]},
{h:'Restore and recover'},
{t:[['Task','Command'],
['One datafile','`RESTORE DATAFILE 7; RECOVER DATAFILE 7;`'],
['A tablespace','`RESTORE TABLESPACE users; RECOVER TABLESPACE users;`'],
['Whole database, complete','`RESTORE DATABASE; RECOVER DATABASE;`'],
['To a point in time','`RUN { SET UNTIL TIME "TO_DATE(\'...\',\'YYYY-MM-DD HH24:MI:SS\')"; RESTORE DATABASE; RECOVER DATABASE; }` then `ALTER DATABASE OPEN RESETLOGS;`'],
['Control file','`RESTORE CONTROLFILE FROM AUTOBACKUP;`'],
['SPFILE','`RESTORE SPFILE FROM AUTOBACKUP;`'],
['Corrupt blocks','`RECOVER CORRUPTION LIST;`'],
['One table','`RECOVER TABLE app.t UNTIL TIME ... AUXILIARY DESTINATION \'/aux\' REMAP TABLE app.t:t_old;`'],
['Clone a database','`DUPLICATE TARGET DATABASE TO test FROM ACTIVE DATABASE;`']]}
]},

/* 7 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'Which backup form, which recovery path and which Flashback feature to use.',see:[[0,2,'Backup types'],[6,0,'Flashback overview']],b:[
{h:'Which recovery for which loss?'},
{t:[['Loss','Database','Method'],
['One user datafile','Stays open','Offline the file, restore, recover, online'],
['SYSTEM or active UNDO file','Must be mounted','`RESTORE`/`RECOVER` the tablespace, open'],
['TEMP file','Stays open','Recreate the tempfile'],
['One control file copy','Instance stops','Copy a good copy over it'],
['All control files','NOMOUNT','Restore from autobackup, recover, `OPEN RESETLOGS`'],
['SPFILE','NOMOUNT with a PFILE','Restore from autobackup'],
['Inactive or active redo log','Stays or needs mount','Clear or recreate (inactive), checkpoint then clear (active)'],
['Current redo log (only member)','Down','Incomplete recovery'],
['Dropped table, recent','Open','`FLASHBACK TABLE ... TO BEFORE DROP`'],
['Wrong update, recent','Open','Flashback Query, Flashback Table'],
['Bad release or batch','Closed or mounted','`FLASHBACK DATABASE TO RESTORE POINT`'],
['One PDB logical damage','CDB open','PDB point-in-time recovery or Flashback PDB'],
['Everything lost','n/a','New host, restore SPFILE, control file, datafiles, recover, `RESETLOGS`']]},
{h:'Which Flashback feature?'},
{t:[['Need','Use','Depends on'],
['Look at old data','`AS OF TIMESTAMP`','Undo'],
['Find who changed a row','`VERSIONS BETWEEN`, `FLASHBACK_TRANSACTION_QUERY`','Undo'],
['Rewind one table','`FLASHBACK TABLE ... TO TIMESTAMP`','Undo, row movement'],
['Undo `DROP TABLE`','`TO BEFORE DROP`','Recycle bin'],
['Rewind the database','`FLASHBACK DATABASE`','Flashback logs in FRA'],
['Mark a safe point','Guaranteed restore point','FRA space until dropped']]},
{h:'Backup set or image copy?'},
{t:[['Choose backup set when','Choose image copy when'],
['Space, compression, tape or cloud matter','Restore speed matters most and disk is available']]}
]},

/* 8 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, the likely cause and the fix.',see:[[9,0,'A troubleshooting method'],[9,1,'Common errors']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['Backup fails with RMAN-03002','Read the stack below it','Varies; the real cause is in the lines below','Read bottom up'],
['RMAN-06023, no backup found','`LIST BACKUP`, `CROSSCHECK`, DBID, incarnation','Backup expired, wrong DBID or incarnation','Catalog the pieces, `RESET DATABASE TO INCARNATION`'],
['Recovery asks for a missing log','`LIST ARCHIVELOG ALL`, standby, tape','Log deleted before backup','Restore from another copy, or recover to an earlier point'],
['Database hangs, ORA-00257','`V$RECOVERY_FILE_DEST`, alert log','Archive destination or FRA full','Back up and delete logs, raise quota'],
['FRA full of obsolete files','`REPORT OBSOLETE`','Policy not applied','`DELETE OBSOLETE`'],
['Backup is slow','`V$SESSION_LONGOPS`, channels','Few channels, slow disk, no change tracking','More channels, enable BCT, check storage'],
['Restore much slower than backup','Parallelism, tape mounts','Single channel, many pieces','Increase channels, multi-section'],
['Cannot restore encrypted backup','`V$ENCRYPTION_WALLET`','Keystore closed or missing','Open the keystore, restore it from backup'],
['Block corruption found','`V$DATABASE_BLOCK_CORRUPTION`','Storage or memory fault','`RECOVER CORRUPTION LIST`, check hardware'],
['Flashback Database fails','`V$FLASHBACK_DATABASE_LOG`','Retention too short or logs removed','Use restore and recover'],
['RESETLOGS then old backups unusable','`LIST INCARNATION`','Wrong incarnation set','`RESET DATABASE TO INCARNATION n`']]}
]},

/* 9 ---------------------------------------------------------------- errors */
{t:'Common error messages',d:'The messages you will meet most, what they mean and what to do.',see:[[9,1,'Common errors'],[9,2,'Corruption']],b:[
{t:[['Error','Meaning','Fix'],
['RMAN-03002','A command failed. Details are in the lines below.','Read the whole stack'],
['RMAN-03009','Failure of a command on a channel','Check the channel error beneath'],
['RMAN-06023','No backup or copy of a datafile found to restore','Check DBID, tags, `CROSSCHECK`, incarnation'],
['RMAN-06025','No backup of an archived log found','Find the log elsewhere or recover to earlier point'],
['RMAN-06054','Media recovery requesting an unknown log','Provide the log or `CANCEL` for incomplete recovery'],
['RMAN-06004','Error from the recovery catalog database','Check catalog connection and version'],
['RMAN-20xxx','Repository or catalog inconsistency','`RESYNC CATALOG`, `UPGRADE CATALOG`'],
['RMAN-12010 / 12005','Cannot open channel or file','Check storage, permissions, media manager'],
['ORA-19511','Error from the media management layer','Vendor logs and SBT settings'],
['ORA-19504 / 19505','Failed to create or identify a file','Space, permissions or path'],
['ORA-19809','Limit exceeded for recovery files','Free or increase FRA'],
['ORA-19625 / 19624','Error identifying or opening a file','Path or permissions'],
['ORA-01110 / 01113','Names the file / needs media recovery','`RECOVER` the file'],
['ORA-01578','Block corrupted','`RECOVER CORRUPTION LIST`'],
['ORA-01190','Control file or datafile is from before the last RESETLOGS','Use the right incarnation'],
['ORA-38760 / 38761','Flashback Database not enabled / not enough logs','Use restore and recover'],
['ORA-00257','Archiver error','Free archive space']]}
]},

/* 10 ---------------------------------------------------------------- health check */
{t:'Health-check SQL pack',d:'Paste-ready queries for the daily and weekly backup checks.',see:[[3,0,'LIST and REPORT'],[3,7,'Prove backups are restorable']],b:[
{h:'Daily'},
{code:`SELECT log_mode, flashback_on FROM v$database;

-- last jobs
SELECT start_time, end_time, status, input_type
FROM v$rman_backup_job_details WHERE start_time > SYSDATE - 2 ORDER BY start_time DESC;

-- no successful backup in 26 hours?
SELECT CASE WHEN MAX(end_time) < SYSDATE - 26/24 THEN 'ALERT' ELSE 'OK' END state
FROM v$rman_backup_job_details WHERE status = 'COMPLETED' AND input_type LIKE 'DB%';

-- archived logs not yet backed up
SELECT COUNT(*) FROM v$archived_log WHERE backup_count = 0 AND deleted = 'NO';`},
{h:'FRA'},
{code:`SELECT name, ROUND(space_used/1024/1024/1024,1) used_gb, ROUND(space_limit/1024/1024/1024,1) limit_gb,
       ROUND(100*space_used/space_limit) pct
FROM v$recovery_file_dest;
SELECT file_type, percent_space_used, percent_space_reclaimable FROM v$recovery_area_usage;`},
{h:'Corruption and flashback'},
{code:`SELECT * FROM v$database_block_corruption;
SELECT oldest_flashback_scn, oldest_flashback_time, retention_target FROM v$flashback_database_log;
SELECT name, scn, time, guarantee_flashback_database, storage_size FROM v$restore_point;`},
{h:'In RMAN, weekly'},
{code:`REPORT NEED BACKUP;
REPORT OBSOLETE;
CROSSCHECK BACKUP;
RESTORE DATABASE VALIDATE;
RESTORE ARCHIVELOG ALL VALIDATE;`}
]},

/* 11 ---------------------------------------------------------------- naming decoder */
{t:'Naming decoder',d:'FORMAT specifiers, tags and the numbers you see in listings.',see:[[1,5,'Backup sets vs image copies'],[4,6,'Incarnations']],b:[
{t:[['Item','Meaning'],
['`%U`','Unique name (default): set number, piece, copy and timestamp'],
['`%d`, `%n`','Database name, padded name'],
['`%s`, `%p`, `%c`','Backup set number, piece number, copy number'],
['`%t`, `%T`','Set timestamp, date as YYYYMMDD'],
['`%F`','Unique autobackup name including DBID, date and sequence'],
['`%I`','DBID'],
['Tag','Your label, upper-cased, for selecting backups (`TAG \'WK0\'`)'],
['Level 0 / 1','Base incremental / changes since a reference'],
['KEEP','Overrides the retention policy for that backup'],
['DBID','Numeric database identity. Write it down.'],
['Incarnation','A branch of the database timeline, a new one after `RESETLOGS`'],
['RECID, STAMP','Control file record number and time stamp used in listings'],
['Thread, sequence','Identify an archived log: redo thread and log sequence number'],
['SCN','System change number used for `UNTIL SCN`'],
['Restore point','Named SCN, normal or guaranteed']]}
]},

/* 12 ---------------------------------------------------------------- sequences */
{t:'Recovery command sequences',d:'Short, ordered sequences for the common recoveries. Practise each one before you need it.',see:[[4,0,'Restore vs recover'],[4,7,'Complete disaster']],b:[
{h:'Lost user datafile, database open'},
{code:`RMAN> ALTER DATABASE DATAFILE 7 OFFLINE;
RMAN> RESTORE DATAFILE 7;
RMAN> RECOVER DATAFILE 7;
RMAN> ALTER DATABASE DATAFILE 7 ONLINE;`},
{h:'All control files lost'},
{code:`SQL> STARTUP NOMOUNT;
RMAN> SET DBID 1234567890;
RMAN> RESTORE CONTROLFILE FROM AUTOBACKUP;
RMAN> ALTER DATABASE MOUNT;
RMAN> RECOVER DATABASE;
RMAN> ALTER DATABASE OPEN RESETLOGS;`},
{h:'Point in time recovery of the database'},
{code:`RMAN> STARTUP MOUNT;
RMAN> RUN { SET UNTIL TIME "TO_DATE('2026-10-01 10:30:00','YYYY-MM-DD HH24:MI:SS')";
            RESTORE DATABASE; RECOVER DATABASE; }
RMAN> ALTER DATABASE OPEN RESETLOGS;`},
{h:'PDB point in time recovery'},
{code:`RMAN> ALTER PLUGGABLE DATABASE pdb1 CLOSE IMMEDIATE;
RMAN> RUN { SET UNTIL TIME "TO_DATE('2026-10-01 10:30:00','YYYY-MM-DD HH24:MI:SS')";
            RESTORE PLUGGABLE DATABASE pdb1; RECOVER PLUGGABLE DATABASE pdb1; }
RMAN> ALTER PLUGGABLE DATABASE pdb1 OPEN RESETLOGS;`},
{h:'Flashback the database to a restore point'},
{code:`SQL> SHUTDOWN IMMEDIATE
SQL> STARTUP MOUNT
SQL> FLASHBACK DATABASE TO RESTORE POINT before_rel;
SQL> ALTER DATABASE OPEN RESETLOGS;
SQL> DROP RESTORE POINT before_rel;`},
{h:'Restore to a new host'},
{flow:['Install the same software release','Create directories and the OS user','Start NOMOUNT with a minimal PFILE (db_name only)','Restore SPFILE and control file from autobackup (SET DBID first)','Mount, restore datafiles (SET NEWNAME if paths differ), recover','OPEN RESETLOGS, recreate TEMP, take a new backup']}
]},

/* 13 ---------------------------------------------------------------- security */
{t:'Backup security checklist',d:'What to protect around backups so a backup is not the weakest link.',see:[[8,2,'Encrypted and immutable backups'],[8,5,'Backup security']],b:[
{t:[['Control','What to do'],
['Encryption','`CONFIGURE ENCRYPTION FOR DATABASE ON`, or TDE tablespaces; keep the keystore backed up separately'],
['Keys','Store keystore and passwords away from the backups, test a restore with them'],
['Least privilege','Backup users with `SYSBACKUP`, not `SYSDBA`'],
['Credentials','Use a wallet (`/@alias`), not passwords in scripts'],
['Immutability','Retention lock or WORM storage for at least one copy'],
['Separation','Backup admins cannot delete production, production admins cannot delete all backups'],
['Off-site copy','At least one copy outside the data center, and one that is offline or immutable'],
['Audit','Log who changed retention or deleted backups'],
['Test','Restore from the protected copy on a schedule']]},
{note:'The rule of three: three copies, two media, one off site.'}
]}

]};
