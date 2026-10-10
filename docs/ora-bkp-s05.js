/* LearnSphere - Backup & Recovery, Section 05: Restore & Recovery.
   Lectures 0-8 are core, 9+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const BR=O.D+'bradv/';

/* ---------- diagrams ---------- */
const flow=O.dg(700,170,[
[10,50,120,70,'1. Assess|what is lost?',0],
[160,50,120,70,'2. RESTORE|copy files back',2],
[310,50,120,70,'3. RECOVER|apply redo',2],
[460,50,110,70,'4. OPEN|(RESETLOGS|if incomplete)',0],
[600,50,90,70,'5. Verify|and backup',0]],
[[130,85,160,85],[280,85,310,85],[430,85,460,85],[570,85,600,85]]);

const mode=O.dg(700,190,[
[10,30,200,130,'Datafile lost',1],[25,65,170,40,'Database open: offline the file',0],[25,110,170,40,'Restore, recover, online',0],
[250,30,200,130,'SYSTEM / UNDO / control',1],[265,65,170,40,'Database must be closed',0],[265,110,170,40,'Mount, restore, recover, open',0],
[490,30,200,130,'Everything or wrong time',1],[505,65,170,40,'Restore all, UNTIL point',0],[505,110,170,40,'OPEN RESETLOGS',0]],[]);

/* ---------- 0: Restore vs Recover ---------- */
L['ora-bkp:4:0']={blocks:[
{p:'**Restore** and **recover** are different words for different steps. Mixing them up is a classic mistake.'},
{svg:flow},
{t:[['Step','What it does','Source'],
['**RESTORE**','Copies datafiles, control file or SPFILE **from a backup** back to disk','Backup sets or image copies'],
['**RECOVER**','Applies **redo** to bring restored files up to the target SCN','Archived and online redo, incremental backups']]},
{h:'Decide before you type'},
{t:[['Question','Answer decides'],
['What is lost? (one file, a tablespace, everything)','Scope'],
['Is the database open?','Online or offline recovery'],
['Do you want the latest data, or a point in the past?','Complete or incomplete'],
['Are all redo logs available?','Whether complete is possible']]},
{note:'`RESTORE` alone leaves an **old** file. The database will not open it until `RECOVER` has brought it current.'}],
src:[['Restore and recovery',BR]]};

/* ---------- 1: Datafile and tablespace ---------- */
L['ora-bkp:4:1']={blocks:[
{p:'Losing a **non-system datafile** is the most common media failure. The database can usually stay **open**. Only the objects in that file are unavailable.'},
{code:`-- database is open. Find the failure:
LIST FAILURE;
ADVISE FAILURE;

-- online recovery of one datafile
ALTER DATABASE DATAFILE 7 OFFLINE;       -- if not already offline
RESTORE DATAFILE 7;
RECOVER DATAFILE 7;
ALTER DATABASE DATAFILE 7 ONLINE;

-- a whole tablespace
ALTER TABLESPACE users OFFLINE IMMEDIATE;
RESTORE TABLESPACE users;
RECOVER TABLESPACE users;
ALTER TABLESPACE users ONLINE;`},
{flow:['Datafile is lost or damaged','Take it offline','Restore from backup','Recover with redo','Bring online and verify']},
{note:'`LIST FAILURE`, `ADVISE FAILURE` and `REPAIR FAILURE` (Data Recovery Advisor) can find and suggest the steps. Use them as help, but understand each step.'}],
src:[['Datafile recovery',BR]]};

/* ---------- 2: SYSTEM and UNDO ---------- */
L['ora-bkp:4:2']={blocks:[
{p:'**SYSTEM** and the active **UNDO** tablespace cannot be taken offline. The database must be closed, so recovery is **offline**.'},
{code:`STARTUP MOUNT;
RESTORE TABLESPACE system;
RECOVER TABLESPACE system;
ALTER DATABASE OPEN;

-- active undo tablespace
STARTUP MOUNT;
RESTORE TABLESPACE undotbs1;
RECOVER TABLESPACE undotbs1;
ALTER DATABASE OPEN;`},
{t:[['Tablespace','Database can stay open?','Notes'],
['**SYSTEM**','No','Data dictionary. Instance often crashes.'],
['**Active UNDO**','No','Transactions cannot roll back'],
['**SYSAUX**','Yes, with limits','Some features unavailable. Take offline if possible.'],
['**TEMP**','Yes','Not backed up. Recreate the tempfile.'],
['**Other**','Yes','Take offline and recover']]},
{note:'TEMP files hold no permanent data. Recreate them: `ALTER TABLESPACE temp ADD TEMPFILE ...`. There is nothing to restore.'}],
src:[['Recovering SYSTEM and UNDO',BR]]};

/* ---------- 3: Control file ---------- */
L['ora-bkp:4:3']={blocks:[
{p:'If **all** control file copies are lost, the instance cannot go beyond NOMOUNT. With multiplexed copies you only copy a good one.'},
{t:[['Case','Fix'],
['One copy lost','Copy a surviving copy over the lost path. Restart.'],
['All copies lost, autobackup exists','`RESTORE CONTROLFILE FROM AUTOBACKUP`'],
['All lost, no autobackup, no backup','Recreate the control file with `CREATE CONTROLFILE` (hard)']]},
{code:`STARTUP NOMOUNT;
SET DBID 1234567890;
RESTORE CONTROLFILE FROM AUTOBACKUP;
ALTER DATABASE MOUNT;
RECOVER DATABASE;                 -- the control file is older than the datafiles
ALTER DATABASE OPEN RESETLOGS;`},
{h:'Notes'},
{ul:['A restored control file is **older** than the datafiles, so recovery is needed and the database opens with `RESETLOGS`.','Set the **DBID** if you have no repository.','After this, take a new full backup right away.']},
{note:'Multiplex the control file on at least two different disks. It costs nothing and saves this whole lecture.'}],
src:[['Control file recovery',BR]]};

/* ---------- 4: SPFILE and redo ---------- */
L['ora-bkp:4:4']={blocks:[
{p:'Two further losses: the **SPFILE**, and **online redo logs**.'},
{h:'SPFILE lost'},
{code:`STARTUP NOMOUNT PFILE=\'/tmp/init.ora\';   -- minimal pfile with db_name
RESTORE SPFILE FROM AUTOBACKUP;
SHUTDOWN IMMEDIATE
STARTUP`},
{h:'Online redo log lost'},
{t:[['Log state','What it means','Fix'],
['**INACTIVE**','Already checkpointed','`ALTER DATABASE CLEAR LOGFILE GROUP n;`'],
['**ACTIVE**','Still needed for instance recovery','Checkpoint, then clear'],
['**CURRENT**','Being written, lost','Incomplete recovery: restore, recover until the last available log, open RESETLOGS']]},
{code:`SELECT group#, status FROM v$log;
ALTER DATABASE CLEAR LOGFILE GROUP 2;`},
{note:'Multiplex redo logs (2 members per group, on different disks). A lost CURRENT log with a single member means data loss.'}],
src:[['Redo log failure',BR]]};

/* ---------- 5: Incomplete recovery ---------- */
L['ora-bkp:4:5']={blocks:[
{p:'**Incomplete recovery** brings the database to a **chosen point** in the past. Use it after a logical disaster, such as a dropped schema that Flashback cannot fix.'},
{t:[['Variant','Command','Use'],
['**UNTIL TIME**','`RECOVER DATABASE UNTIL TIME \'2026-10-01 10:30:00\';`','You know the time of the mistake'],
['**UNTIL SCN**','`RECOVER DATABASE UNTIL SCN 1234567;`','Exact point from a log miner or alert'],
['**UNTIL SEQUENCE**','`RECOVER DATABASE UNTIL SEQUENCE 205 THREAD 1;`','Up to a log sequence'],
['**UNTIL CANCEL**','SQL*Plus `RECOVER ... UNTIL CANCEL`','Manual, log by log']]},
{code:`SHUTDOWN IMMEDIATE
STARTUP MOUNT

RUN {
  SET UNTIL TIME "TO_DATE(\'2026-10-01 10:30:00\',\'YYYY-MM-DD HH24:MI:SS\')";
  RESTORE DATABASE;
  RECOVER DATABASE;
}
ALTER DATABASE OPEN RESETLOGS;`},
{flow:['Pick the target point (just before the mistake)','Mount the database','Restore all datafiles from a backup older than the target','Recover until the target','OPEN RESETLOGS, then backup']},
{note:'Incomplete recovery discards everything after the target point. Consider Flashback Database, a PDB point-in-time, or restoring only a table first.'}],
src:[['Incomplete recovery',BR]]};

/* ---------- 6: RESETLOGS and incarnations ---------- */
L['ora-bkp:4:6']={blocks:[
{p:'`OPEN RESETLOGS` starts a **new incarnation**: the log sequence restarts and the SCN timeline branches. Old backups still belong to the parent incarnation.'},
{t:[['Term','Meaning'],
['**Incarnation**','A version of the database history. A new one begins at RESETLOGS.'],
['**Current incarnation**','The one the database is running in'],
['**Parent / orphan**','Earlier branches. Their backups are usable for recovery to points before the branch.']]},
{code:`LIST INCARNATION OF DATABASE;
RESET DATABASE TO INCARNATION 2;          -- go back to a branch
SELECT incarnation#, resetlogs_change#, status FROM v$database_incarnation;`},
{h:'After RESETLOGS'},
{ul:['Take a **new full backup** at once. A backup from before is usable, but a new one removes doubt.','Archived logs from the old incarnation are not applied to the new one.','On a standby, you may have to reinstate or flash it back.']},
{note:'Oracle can recover through RESETLOGS, as long as the backups and logs of each incarnation are available. Do not delete the old ones early.'}],
src:[['Database incarnations',BR]]};

/* ---------- 7: Complete disaster ---------- */
L['ora-bkp:4:7']={blocks:[
{p:'The site is gone. You have backups elsewhere and a **new, empty host**. This is the real test of your strategy.'},
{flow:['Install the same Oracle software version and patch level','Create the OS user, directories and ORACLE_HOME','Restore the SPFILE (with DBID) and start NOMOUNT','Restore the control file from autobackup','Mount, then restore the datafiles','Recover with archived logs up to the latest','OPEN RESETLOGS','Recreate TEMP, network files, wallet, jobs and take a new backup']},
{code:`export ORACLE_SID=prod
rman target /
SET DBID 1234567890;
STARTUP NOMOUNT;
RESTORE SPFILE FROM AUTOBACKUP;
STARTUP FORCE NOMOUNT;
RESTORE CONTROLFILE FROM AUTOBACKUP;
ALTER DATABASE MOUNT;
-- if paths differ:
RUN { SET NEWNAME FOR DATABASE TO \'/u02/oradata/%b\'; RESTORE DATABASE; SWITCH DATAFILE ALL; RECOVER DATABASE; }
ALTER DATABASE OPEN RESETLOGS;`},
{t:[['Needed on the new host','Source'],
['DBID, SID, backups and logs','Your documentation and off-site copy'],
['Password file, wallet, listener and TNS files','OS backup'],
['Software of the same release','Your gold image or media']]},
{note:'Store the DBID, SID, file layout and these steps **outside** the data center. In a real disaster, the wiki on the lost server is not available.'}],
src:[['Disaster recovery',BR]]};

/* ---------- 8: Practical ---------- */
L['ora-bkp:4:8']={blocks:[
{p:'**Break and recover** a test database five ways. Take a full backup first. Never do this on production.'},
{t:[['#','Break','Recover'],
['1','Delete a user datafile (OS `rm`) while open','Offline, restore, recover, online'],
['2','Delete the whole `users` tablespace file at mount','Restore and recover tablespace'],
['3','Delete all control files','Restore from autobackup, recover, RESETLOGS'],
['4','Delete the SPFILE','Restore from autobackup'],
['5','Drop a table and commit, then recover to just before it','Incomplete recovery UNTIL TIME, RESETLOGS']]},
{h:'After each recovery'},
{ul:['Run `REPORT SCHEMA` and `SELECT COUNT(*) FROM` an affected table.','Check the alert log for errors.','Take a fresh backup.']},
{h:'Check your result'},
{t:[['Check','Expected'],
['Each scenario','Database open and data present'],
['Time per scenario','Recorded (your real RTO)'],
['Incarnations','`LIST INCARNATION` shows the RESETLOGS branches']]},
{note:'Write down how long each case took. Those numbers are the real RTO of your backup design.'}],
src:[['Recovery scenarios',BR]]};

})();
