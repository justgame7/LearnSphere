/* LearnSphere - Oracle Backup, Recovery & Flashback Quick Reference (cheat sheet).
   window.QREF['ora-bkp'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Values are for Oracle Database 19c on Linux unless stated. RMAN syntax is the same in 26ai unless marked.
   Check a setting on your own system with: SHOW ALL; (RMAN) or SELECT name, value FROM v$rman_configuration; */
window.QREF=window.QREF||{};
window.QREF['ora-bkp']={title:'Backup, Recovery & Flashback Quick Reference',blurb:'RMAN, the Fast Recovery Area, recovery sequences and Flashback on one page each.',hint:'archivelog or flashback',pages:[

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
