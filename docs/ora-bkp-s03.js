/* LearnSphere - Backup & Recovery, Section 03: Taking Backups with RMAN.
   Lectures 0-8 are core, 9+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const BR=O.D+'bradv/';

/* ---------- diagrams ---------- */
const inc=O.dg(700,210,[
[10,60,120,70,'Sun|Level 0|(base)',2],
[150,60,100,70,'Mon|Level 1',0],[270,60,100,70,'Tue|Level 1',0],[390,60,100,70,'Wed|Level 1',0],[510,60,100,70,'Thu|Level 1',0],
[630,60,60,70,'Fri|...',0],
[150,160,460,40,'Differential: since last backup. Cumulative: since last level 0.',1]],
[[130,95,150,95],[250,95,270,95],[370,95,390,95],[490,95,510,95],[610,95,630,95]]);

/* ---------- 0: Full and archivelog ---------- */
L['ora-bkp:2:0']={blocks:[
{p:'The simplest strategy is a **full backup** plus the **archived logs**. A full backup is not the same as a level 0 incremental. The full backup cannot be a base for incrementals.'},
{code:`BACKUP DATABASE;
BACKUP ARCHIVELOG ALL;
BACKUP DATABASE PLUS ARCHIVELOG;         -- both, switches log first
BACKUP ARCHIVELOG ALL NOT BACKED UP 1 TIMES;
BACKUP ARCHIVELOG ALL DELETE INPUT;       -- remove after a successful backup`},
{t:[['Command','Result'],
['`BACKUP DATABASE`','All datafiles (and control file with autobackup)'],
['`BACKUP ARCHIVELOG ALL`','All archived logs on disk'],
['`PLUS ARCHIVELOG`','Archive the current log, back up the logs, then the database, then new logs'],
['`NOT BACKED UP n TIMES`','Skip logs already saved enough times'],
['`DELETE INPUT`','Remove logs once safely backed up']]},
{note:'Back up archived logs more often than datafiles. Logs set the RPO. Datafile backups set the restore time.'}],
src:[['Backing up the database',BR]]};

/* ---------- 1: Incrementals ---------- */
L['ora-bkp:2:1']={blocks:[
{p:'An **incremental** backup copies only changed blocks. It starts with a **level 0** (a full set, but usable as a base) and continues with **level 1** backups.'},
{svg:inc},
{t:[['Type','Copies','Restore needs','Backup size'],
['**Level 0**','All used blocks (the base)','Itself','Large'],
['**Level 1 differential** (default)','Blocks changed since the last level 0 **or** 1','Level 0 + all level 1s since','Small'],
['**Level 1 cumulative**','Blocks changed since the last level 0','Level 0 + the latest cumulative','Medium, grows daily']]},
{code:`BACKUP INCREMENTAL LEVEL 0 DATABASE;
BACKUP INCREMENTAL LEVEL 1 DATABASE;               -- differential
BACKUP INCREMENTAL LEVEL 1 CUMULATIVE DATABASE;`},
{h:'Which one?'},
{ul:['**Differential:** smallest backups, a longer chain at restore.','**Cumulative:** larger daily backups, shorter chain, faster restore.']},
{note:'Without Block Change Tracking, RMAN must still read every block to find changes. That is why the next lecture matters.'}],
src:[['Incremental backups',BR]]};

/* ---------- 2: BCT ---------- */
L['ora-bkp:2:2']={blocks:[
{p:'**Block Change Tracking (BCT)** keeps a small file that records which blocks changed. A level 1 backup then reads **only those blocks**, not the whole database.'},
{code:`ALTER DATABASE ENABLE BLOCK CHANGE TRACKING
  USING FILE '/u01/oradata/prod/bct.chg';

SELECT status, filename, bytes FROM v$block_change_tracking;

ALTER DATABASE DISABLE BLOCK CHANGE TRACKING;`},
{t:[['Without BCT','With BCT'],
['Reads all blocks to find changed ones','Reads only the changed blocks'],
['Level 1 takes nearly as long as level 0 to scan','Level 1 is quick'],
['No overhead','Small overhead on the primary']]},
{h:'Notes'},
{ul:['The tracking starts when you enable it. The first level 1 after enabling may still read everything.','On Data Guard, you can use BCT on a physical standby with Active Data Guard to offload incrementals.','The file is small, a few percent of the database at most.']},
{note:'Enable BCT on any large database that uses incremental backups. The speed gain is often tenfold or more.'}],
src:[['Block change tracking',BR]]};

/* ---------- 3: Incrementally updated ---------- */
L['ora-bkp:2:3']={blocks:[
{p:'**Incrementally updated backups** keep an **image copy** that you roll forward each day with the latest level 1. The copy is always only one day old, and a restore can be a **switch**.'},
{code:`RUN {
  RECOVER COPY OF DATABASE WITH TAG 'inc_upd';
  BACKUP INCREMENTAL LEVEL 1 FOR RECOVER OF COPY
    WITH TAG 'inc_upd' DATABASE;
}`},
{flow:['Day 1: the first run creates the image copy (level 0 copy)','Day 2: a level 1 backup is taken, the copy is rolled forward with the previous level 1','Day 3 and on: the copy always lags one day','Restore: switch to the copy and recover with the redo since']},
{t:[['Pro','Con'],
['Restore is very fast: switch, then recover','Needs the space of the full database on disk'],
['Only changed blocks are read each day (with BCT)','Single copy, so keep another backup too'],
['Always current within one day','Requires disk, no tape']]},
{note:'This is the strategy that gives the shortest restore time when you have the disk. Combine it with periodic backups to another medium.'}],
src:[['Incrementally updated backups',BR]]};

/* ---------- 4: Compress and encrypt ---------- */
L['ora-bkp:2:4']={blocks:[
{p:'Backups often leave the building, so protect and shrink them.'},
{t:[['Feature','Command','Notes'],
['**Compression**','`BACKUP AS COMPRESSED BACKUPSET DATABASE;`','Levels BASIC, LOW, MEDIUM, HIGH. Non-BASIC needs the Advanced Compression option.'],
['**Transparent encryption**','`SET ENCRYPTION ON;`','Uses the TDE keystore. Needs the keystore open at restore.'],
['**Password encryption**','`SET ENCRYPTION ON IDENTIFIED BY \"pw\" ONLY;`','Does not need the keystore. You must remember the password.'],
['**Dual mode**','`SET ENCRYPTION ON IDENTIFIED BY \"pw\";`','Either keystore or password can restore']]},
{code:`CONFIGURE COMPRESSION ALGORITHM \'MEDIUM\';
CONFIGURE ENCRYPTION FOR DATABASE ON;
BACKUP AS COMPRESSED BACKUPSET DATABASE;`},
{h:'Trade-offs'},
{ul:['Higher compression saves space but uses more CPU. Test with your data.','Already encrypted data (TDE) does not compress well. Use encryption of the backup or the tablespace, not both for size reasons.','Without the key, an encrypted backup cannot be restored. Back up the keystore separately.']},
{note:'Store the keystore password and a copy of the keystore away from the backups. Losing the key makes every encrypted backup unusable.'}],
src:[['Encrypting backups',BR]]};

/* ---------- 5: Control file and SPFILE ---------- */
L['ora-bkp:2:5']={blocks:[
{p:'Without the **control file** and **SPFILE**, restore is much harder. Back them up with every database backup.'},
{code:`BACKUP CURRENT CONTROLFILE;
BACKUP SPFILE;
CONFIGURE CONTROLFILE AUTOBACKUP ON;

-- location and format
CONFIGURE CONTROLFILE AUTOBACKUP FORMAT FOR DEVICE TYPE DISK TO \'/backup/cf_%F\';`},
{t:[['File','Why','How'],
['**Control file**','Knows all datafiles, logs and backups','`CONTROLFILE AUTOBACKUP ON` (also after structural changes)'],
['**SPFILE**','Instance parameters','Included in the autobackup'],
['**Password file / wallet / network files**','Not in RMAN. Copy with the OS.','Separate scripts']]},
{h:'Autobackup format'},
{p:'The `%F` format encodes the DBID and time, so RMAN can find the control file backup with only the **DBID**, even when the repository is gone.'},
{note:'Write down the **DBID** of every database. It is needed when restoring the control file from autobackup on a new host.'}],
src:[['Control file and SPFILE backup',BR]]};

/* ---------- 6: Tags, multisection, parallelism ---------- */
L['ora-bkp:2:6']={blocks:[
{p:'Three small features make backups easier to manage and faster.'},
{t:[['Feature','Use','Example'],
['**Tag**','A name for a backup, to select it later','`BACKUP DATABASE TAG \'weekly_full\';`'],
['**Multisection**','Split a **large file** across channels for parallel backup','`BACKUP SECTION SIZE 20G DATABASE;`'],
['**Parallelism**','Several channels at the same time','`CONFIGURE DEVICE TYPE DISK PARALLELISM 4;`']]},
{h:'Why multisection'},
{p:'A bigfile tablespace of 8 TB is a single file. One channel would back it up alone. With a section size, many channels each take a part of the same file.'},
{code:`RUN {
  ALLOCATE CHANNEL c1 DEVICE TYPE DISK;
  ALLOCATE CHANNEL c2 DEVICE TYPE DISK;
  ALLOCATE CHANNEL c3 DEVICE TYPE DISK;
  ALLOCATE CHANNEL c4 DEVICE TYPE DISK;
  BACKUP SECTION SIZE 50G TABLESPACE users;
}`},
{note:'More channels only help when the disk and network can keep up. Watch the throughput and increase parallelism step by step.'}],
src:[['Multisection backups',BR]]};

/* ---------- 7: Validate ---------- */
L['ora-bkp:2:7']={blocks:[
{p:'A backup you never tested may be useless. RMAN can **check** backups and the database without restoring.'},
{t:[['Command','Checks'],
['`BACKUP VALIDATE DATABASE;`','Reads the datafiles and reports corruption. Writes nothing.'],
['`BACKUP VALIDATE CHECK LOGICAL DATABASE;`','Also logical corruption'],
['`VALIDATE BACKUPSET n;`','A backup set is readable and consistent'],
['`RESTORE DATABASE VALIDATE;`','Reads the backup pieces needed to restore, without restoring'],
['`RESTORE ARCHIVELOG ALL VALIDATE;`','The logs are present and usable']]},
{code:`BACKUP VALIDATE CHECK LOGICAL DATABASE;
RESTORE DATABASE VALIDATE;
SELECT * FROM v$database_block_corruption;`},
{note:'`RESTORE VALIDATE` proves the pieces can be read. Only a full restore to another host proves the whole procedure. Do both.'}],
src:[['VALIDATE',BR]]};

/* ---------- 8: Practical ---------- */
L['ora-bkp:2:8']={blocks:[
{p:'Build and run a **weekly incremental** strategy with BCT and an incrementally updated copy.'},
{code:`-- once
ALTER DATABASE ENABLE BLOCK CHANGE TRACKING USING FILE \'/u01/oradata/prod/bct.chg\';

-- weekly (Sunday): level 0
RUN { BACKUP INCREMENTAL LEVEL 0 DATABASE TAG \'wk0\' PLUS ARCHIVELOG DELETE INPUT; }

-- daily: level 1 differential
RUN { BACKUP INCREMENTAL LEVEL 1 DATABASE TAG \'d1\' PLUS ARCHIVELOG DELETE INPUT; }

-- every 15 minutes: archived logs
RUN { BACKUP ARCHIVELOG ALL NOT BACKED UP 1 TIMES; }

-- validate once a week
BACKUP VALIDATE CHECK LOGICAL DATABASE;
RESTORE DATABASE VALIDATE;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`LIST BACKUP SUMMARY`','Level 0 and level 1 entries with tags'],
['Level 1 duration','Much shorter than level 0 with BCT'],
['`V$BLOCK_CHANGE_TRACKING`','ENABLED'],
['`V$DATABASE_BLOCK_CORRUPTION`','No rows']]},
{note:'Put these commands in a script and run them from cron or the scheduler. A backup that depends on someone typing is not a strategy.'}],
src:[['Backup strategies',BR]]};

})();
