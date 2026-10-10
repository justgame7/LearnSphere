/* LearnSphere - Oracle Core DBA, Section 08: Redo, Control Files & Archiving.
   Lectures 0-7 are core, 8-13 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const redo=O.dg(700,230,[
[10,10,420,210,'Online redo log groups, used in a circle',1],
[30,50,110,60,'Group 1|CURRENT|LGWR writes here',2],[165,50,110,60,'Group 2|INACTIVE|ready to reuse',0],[300,50,110,60,'Group 3|ACTIVE|ckpt pending',0],
[30,140,110,60,'Member 1a|disk A',0],[165,140,110,60,'Member 1b|disk B',0],
[470,50,220,60,'Archiver (ARCn)|copies a filled group|to an archived log',2],[470,140,220,60,'Archived logs|kept for recovery',0]],
[[140,80,165,80],[275,80,300,80],[410,80,470,80],[580,110,580,140],[85,110,85,140],[120,110,200,140]]);

const crash=O.dg(700,110,[
[10,25,150,60,'Crash|committed data only|in redo',0],[200,25,150,60,'Roll forward|apply redo from the|last checkpoint',2],[390,25,150,60,'Roll back|undo changes that|were not committed',2],[580,25,110,60,'Database|open and|consistent',0]],
[[160,55,200,55],[350,55,390,55],[540,55,580,55]]);

/* ---------- 0: Redo logging ---------- */
L['ora-core:7:0']={blocks:[
{p:'**Redo** is a record of every change made to the database. If the instance crashes, Oracle replays the redo to bring the files back to a consistent state. LGWR writes redo to the **online redo logs**.'},
{svg:redo},
{h:'Groups and members'},
{t:[['Term','Meaning'],
['**Redo log group**','One log file unit that LGWR writes to. A database needs at least two groups.'],
['**Member**','One copy of a group. Members of one group are identical and should be on different disks.'],
['**Log switch**','LGWR moves from a full group to the next one.'],
['**Log sequence number**','Each time a group is used it gets a new, ever-increasing number.']]},
{h:'Group status'},
{t:[['Status','Meaning'],
['`CURRENT`','LGWR is writing to this group now'],
['`ACTIVE`','Not current, but still needed for instance recovery (checkpoint not finished)'],
['`INACTIVE`','No longer needed for instance recovery. Can be reused, once archived.'],
['`UNUSED`','Never used yet']]},
{h:'The cycle'},
{flow:['LGWR writes to the CURRENT group, to all its members at once','The group fills and a log switch happens','A checkpoint starts so the old group becomes INACTIVE','In ARCHIVELOG mode ARCn copies the old group to an archived log','After archiving and the checkpoint, the group can be reused']},
{code:`SELECT group#, thread#, sequence#, bytes/1024/1024 AS mb, members, status, archived
FROM   v$log ORDER BY group#;

SELECT group#, member FROM v$logfile ORDER BY group#;

ALTER SYSTEM SWITCH LOGFILE;      -- force a switch`},
{note:'If LGWR needs the next group and it is still ACTIVE or not archived, the database waits. The alert log then shows "Checkpoint not complete" or an archiving wait. More or larger groups fix it.'}],
src:[['Managing the redo log',O.AD+'managing-the-redo-log.html'],['Redo log files',O.CN+'physical-storage-structures.html']]};

/* ---------- 1: Managing redo logs ---------- */
L['ora-core:7:1']={blocks:[
{p:'A DBA keeps redo logs **multiplexed** (two or more members per group) and **sized well**. You manage them while the database is open.'},
{h:'Add, multiplex and drop'},
{code:`-- Add a new group with two members on different disks
ALTER DATABASE ADD LOGFILE GROUP 4
  ('/u02/oradata/ORCL/redo04a.log', '/u03/oradata/ORCL/redo04b.log') SIZE 1G;

-- Add a second member to an existing group
ALTER DATABASE ADD LOGFILE MEMBER '/u03/oradata/ORCL/redo01b.log' TO GROUP 1;

-- Drop a group that is INACTIVE (and archived)
ALTER DATABASE DROP LOGFILE GROUP 1;`},
{t:[['You cannot drop','Because'],
['A `CURRENT` or `ACTIVE` group','Oracle still needs it'],
['A group that is not archived (in ARCHIVELOG mode)','Its content would be lost for recovery'],
['The last two groups','A database needs at least two']]},
{h:'Resize: add new, drop old'},
{p:'You cannot change the size of an existing group. Create new, larger groups and remove the old ones.'},
{flow:['Add new groups of the new size','Switch logs until an old group is INACTIVE','Drop the old groups','Delete the old files from disk if not OMF']},
{h:'How big should they be?'},
{p:'Aim for a log switch every **15 to 30 minutes at peak load**. Switching every few seconds causes waits, and switching only once a day means a long recovery.'},
{code:`SELECT TO_CHAR(first_time,'YYYY-MM-DD HH24') AS hour, COUNT(*) AS switches
FROM   v$log_history
WHERE  first_time > SYSDATE - 2
GROUP  BY TO_CHAR(first_time,'YYYY-MM-DD HH24')
ORDER  BY 1;`},
{t:[['Switches per hour','Action'],
['More than 4 at peak','Make the logs bigger'],
['2 to 4','About right'],
['Less than 1','Check that archiving and recovery time are still acceptable']]},
{note:'A common baseline is three or four groups of 1 GB or more, with two members each on separate disks. Size from your own switch rate, not from a fixed rule.'}],
src:[['Managing redo log groups and members',O.AD+'managing-the-redo-log.html']]};

/* ---------- 2: Checkpoints and instance recovery ---------- */
L['ora-core:7:2']={blocks:[
{p:'A **checkpoint** is a point where DBWn has written all changes up to a certain moment to the datafiles. After a crash, recovery only has to replay redo **from the last checkpoint**.'},
{h:'Why checkpoints matter'},
{t:[['Without enough checkpointing','With frequent checkpointing'],
['Many dirty blocks wait in memory','Fewer dirty blocks'],
['Crash recovery takes long','Crash recovery is short'],
['Less write activity','More write activity']]},
{h:'When checkpoints occur'},
{t:[['Type','Trigger'],
['**Incremental (continuous)**','DBWn writes steadily to keep recovery time within the target'],
['**Log switch**','A switch starts a checkpoint for the old group'],
['**Full**','Clean shutdown, or `ALTER SYSTEM CHECKPOINT;`'],
['**Tablespace or file**','Offline, read only, begin backup']]},
{h:'Instance recovery in two steps'},
{svg:crash},
{h:'Control the recovery time'},
{code:`ALTER SYSTEM SET fast_start_mttr_target = 60 SCOPE = BOTH;   -- aim for 60 seconds

SELECT target_mttr, estimated_mttr, optimal_logfile_size
FROM   v$instance_recovery;`},
{t:[['Column','Meaning'],
['`TARGET_MTTR`','Recovery time Oracle is aiming for (seconds)'],
['`ESTIMATED_MTTR`','Time it would take now'],
['`OPTIMAL_LOGFILE_SIZE`','Redo size in MB that matches the target']]},
{flow:['Instance crashes','Next STARTUP finds the files out of date','SMON rolls forward from the last checkpoint','Uncommitted work is rolled back','Database opens']},
{note:'Instance recovery is automatic. Media recovery (a lost file) is different: it needs a backup and archived redo, and you run it yourself.'}],
src:[['Checkpoints and instance recovery',O.CN+'oracle-database-instance.html'],['Tuning instance recovery',D+'tgdba/']]};

/* ---------- 3: Control files ---------- */
L['ora-core:7:3']={blocks:[
{p:'The **control file** is a small binary file that describes the physical database. Without it the instance cannot mount. Keep several copies.'},
{h:'What it contains'},
{t:[['Information','Why it matters'],
['Database name and **DBID**','Identity of the database'],
['Names and locations of datafiles and redo logs','The map used at mount'],
['Checkpoint information and current log sequence','Where recovery starts'],
['Archived log history','Used by RMAN'],
['RMAN backup metadata','What backups exist']]},
{h:'Multiplex it'},
{code:`SHOW PARAMETER control_files
SELECT name FROM v$controlfile;

-- Add a third copy: change the parameter, stop, copy, start
ALTER SYSTEM SET control_files =
 '/u02/oradata/ORCL/control01.ctl','/u03/oradata/ORCL/control02.ctl','/u04/oradata/ORCL/control03.ctl'
 SCOPE = SPFILE;
SHUTDOWN IMMEDIATE
-- cp /u02/oradata/ORCL/control01.ctl /u04/oradata/ORCL/control03.ctl
STARTUP`},
{t:[['Rule','Reason'],
['Two or three copies','One lost copy does not stop recovery'],
['Different disks','A disk failure cannot take them all'],
['Same content','Oracle writes to all copies together']]},
{h:'If you lose a copy'},
{flow:['The instance fails or will not mount (ORA-00205 or ORA-00210)','Check the alert log for the missing file','Copy a surviving control file to the missing path','Start the instance','Check V$CONTROLFILE and fix the cause on the disk']},
{h:'Back it up'},
{code:`-- A binary copy
ALTER DATABASE BACKUP CONTROLFILE TO '/backup/control_backup.ctl';

-- A text script that can re-create it
ALTER DATABASE BACKUP CONTROLFILE TO TRACE;`},
{p:'RMAN can also back it up automatically after each backup (control file autobackup), which the Backup sub-course covers.'},
{note:'`CONTROL_FILE_RECORD_KEEP_TIME` (default 7 days) controls how long reusable records such as backup history are kept. RMAN needs them if you do not use a recovery catalog.'}],
src:[['Managing control files',O.AD+'managing-control-files.html']]};

/* ---------- 4: ARCHIVELOG ---------- */
L['ora-core:7:4']={blocks:[
{p:'Redo logs are reused in a circle. In **NOARCHIVELOG** mode old redo is overwritten. In **ARCHIVELOG** mode each filled log is copied away first, so it is kept.'},
{t:[['','NOARCHIVELOG','ARCHIVELOG'],
['**Old redo**','Overwritten','Archived and kept'],
['**Backups**','Only when the database is closed (cold)','Online (hot) backups possible'],
['**Recovery**','Only to the time of the last backup','To any point in time'],
['**Standby databases**','Not possible','Required'],
['**Use**','Test and disposable data','**Production**']]},
{h:'Check the mode'},
{code:`SELECT log_mode FROM v$database;
ARCHIVE LOG LIST`},
{h:'Switch to ARCHIVELOG'},
{code:`SHUTDOWN IMMEDIATE
STARTUP MOUNT
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;

SELECT log_mode FROM v$database;     -- ARCHIVELOG`},
{flow:['Plan for archive space and a backup plan','Shut down cleanly','Mount, do not open','Enable ARCHIVELOG','Open the database and take a full backup']},
{h:'Where archived logs go'},
{code:`ALTER SYSTEM SET log_archive_dest_1 = 'LOCATION=USE_DB_RECOVERY_FILE_DEST' SCOPE = BOTH;
ALTER SYSTEM SET log_archive_format = '%t_%s_%r.arc' SCOPE = SPFILE;

SELECT sequence#, name, completion_time FROM v$archived_log ORDER BY sequence# DESC FETCH FIRST 5 ROWS ONLY;`},
{h:'If the archive destination fills up'},
{p:'The database hangs and sessions wait with ORA-00257 until space is free. Back up and delete old archived logs, or add space. Plan for it with backups that delete archived logs after they are safe.'},
{note:'In a CDB the archive mode belongs to the whole CDB. PDBs follow it and cannot choose their own.'}],
src:[['Managing archived redo log files',O.AD+'managing-archived-redo-log-files.html']]};

/* ---------- 5: FRA ---------- */
L['ora-core:7:5']={blocks:[
{p:'The **Fast Recovery Area (FRA)** is one managed location for all recovery-related files. Oracle tracks the space and removes files that are no longer needed.'},
{h:'What it holds'},
{ul:['Archived redo logs','RMAN backups and image copies','Flashback logs','Control file autobackups','Optionally a multiplexed copy of redo logs and the control file']},
{h:'Set it up'},
{code:`-- Size first, then location
ALTER SYSTEM SET db_recovery_file_dest_size = 200G SCOPE = BOTH;
ALTER SYSTEM SET db_recovery_file_dest = '/u03/fast_recovery_area' SCOPE = BOTH;`},
{p:'Always set the size **before** the location. Setting the location first fails.'},
{h:'Watch it'},
{code:`SELECT name, ROUND(space_limit/1024/1024/1024,1) AS limit_gb,
       ROUND(space_used/1024/1024/1024,1)  AS used_gb,
       ROUND(space_reclaimable/1024/1024/1024,1) AS reclaimable_gb
FROM   v$recovery_file_dest;

SELECT file_type, percent_space_used, percent_space_reclaimable
FROM   v$recovery_area_usage;`},
{t:[['Column','Meaning'],
['`SPACE_LIMIT`','Maximum size you allowed'],
['`SPACE_USED`','Currently used'],
['`SPACE_RECLAIMABLE`','Oracle can delete it if space is needed (for example obsolete backups)']]},
{h:'When it is full'},
{flow:['The FRA reaches its limit','Oracle deletes reclaimable files','Still full: operations fail with ORA-19809 or ORA-19804','You fix it: delete obsolete backups in RMAN, enlarge the size, or move files']},
{h:'Sizing'},
{t:[['Include in the estimate','Example'],
['Full backup size times copies kept','Two weekly full backups'],
['Archived logs between backups','Several days of redo'],
['Flashback logs','If flashback database is on'],
['Margin','At least 20 percent']]},
{note:'The size parameter is a limit that Oracle respects, not a reservation. Make sure the disk really has that space.'}],
src:[['Fast Recovery Area',D+'bradv/configuring-the-fast-recovery-area.html'],['V$RECOVERY_FILE_DEST',O.RF+'V-RECOVERY_FILE_DEST.html']]};

/* ---------- 6: FORCE LOGGING and NOLOGGING ---------- */
L['ora-core:7:6']={blocks:[
{p:'Some operations can skip most redo to run faster. That is called **NOLOGGING**. It speeds up bulk loads, but the changes cannot be recovered from the redo, and a standby database will miss them.'},
{h:'NOLOGGING operations'},
{code:`CREATE INDEX big_ix ON big_table(col) NOLOGGING;
INSERT /*+ APPEND */ INTO big_table SELECT * FROM staging;    -- direct-path insert
ALTER TABLE big_table NOLOGGING;`},
{t:[['','LOGGING (default)','NOLOGGING'],
['**Redo generated**','Full','Minimal for direct-path operations'],
['**Speed of bulk loads**','Normal','Faster'],
['**Recovery from archived redo**','Works','**Blocks are lost until you take a new backup**'],
['**Standby database**','Receives the changes','**Receives corrupt or empty blocks**']]},
{h:'FORCE LOGGING'},
{p:'**FORCE LOGGING** makes Oracle write redo for everything, even when a statement says NOLOGGING. It is required for Data Guard and recommended for important production databases.'},
{code:`ALTER DATABASE FORCE LOGGING;

SELECT force_logging FROM v$database;      -- YES

-- Per tablespace
ALTER TABLESPACE app_data FORCE LOGGING;`},
{flow:['A developer runs a NOLOGGING bulk load','Without FORCE LOGGING: minimal redo, data not recoverable from archive logs','With FORCE LOGGING: full redo, recovery and standby stay safe']},
{h:'Find unrecoverable changes'},
{code:`SELECT file#, unrecoverable_change#, unrecoverable_time FROM v$datafile
WHERE  unrecoverable_change# > 0;`},
{t:[['Situation','Choice'],
['Data Guard or any standby','FORCE LOGGING on'],
['Production that must be recoverable','FORCE LOGGING on'],
['Temporary load into a throw-away staging table','NOLOGGING is acceptable, then take a backup'],
['Test database','Either']]},
{note:'FORCE LOGGING costs some load speed. If a team needs fast loads, agree on a backup right after, never on switching it off blindly.'}],
src:[['Controlling the writing of redo records',O.AD+'managing-the-redo-log.html']]};

/* ---------- 7: Practical ---------- */
L['ora-core:7:7']={blocks:[
{p:'In this lab you check redo, add and resize groups, multiplex, set up the Fast Recovery Area, switch the database to ARCHIVELOG and turn on FORCE LOGGING. Take a snapshot first.'},
{h:'Step 1: Look at what you have'},
{code:`SELECT log_mode, force_logging FROM v$database;
SELECT group#, members, bytes/1024/1024 AS mb, status FROM v$log;
SELECT member FROM v$logfile;
SELECT name FROM v$controlfile;`},
{h:'Step 2: Resize redo'},
{code:`ALTER DATABASE ADD LOGFILE GROUP 4 SIZE 512M;
ALTER DATABASE ADD LOGFILE GROUP 5 SIZE 512M;
ALTER DATABASE ADD LOGFILE GROUP 6 SIZE 512M;

ALTER SYSTEM SWITCH LOGFILE;
ALTER SYSTEM CHECKPOINT;
SELECT group#, status FROM v$log;       -- wait until groups 1-3 are INACTIVE

ALTER DATABASE DROP LOGFILE GROUP 1;
ALTER DATABASE DROP LOGFILE GROUP 2;
ALTER DATABASE DROP LOGFILE GROUP 3;`},
{h:'Step 3: Fast Recovery Area'},
{code:`ALTER SYSTEM SET db_recovery_file_dest_size = 10G SCOPE = BOTH;
ALTER SYSTEM SET db_recovery_file_dest = '/opt/oracle/fra' SCOPE = BOTH;`},
{h:'Step 4: Enable ARCHIVELOG and FORCE LOGGING'},
{code:`SHUTDOWN IMMEDIATE
STARTUP MOUNT
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;
ALTER DATABASE FORCE LOGGING;

ALTER SYSTEM SWITCH LOGFILE;
SELECT sequence#, name FROM v$archived_log ORDER BY sequence#;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`LOG_MODE` in V$DATABASE','ARCHIVELOG'],
['`FORCE_LOGGING`','YES'],
['`V$LOG`','Three groups of 512 MB'],
['`V$ARCHIVED_LOG`','New archived logs after each switch'],
['`V$RECOVERY_FILE_DEST`','Used space grows as logs are archived']]},
{h:'Challenge'},
{ul:['Add a second member to each group on a different folder.','Query `V$LOG_HISTORY` to see how often logs switch in your lab.','Fill the FRA with archived logs on purpose and read the alert log message. Then clean it up.']},
{note:'Do this on the lab only. On a real server, plan archive space and a backup schedule before you enable ARCHIVELOG.'}],
src:[['Managing the redo log',O.AD+'managing-the-redo-log.html'],['Managing archived redo log files',O.AD+'managing-archived-redo-log-files.html']]};

})();
