/* LearnSphere - Backup & Recovery, Section 10: Troubleshooting & Recovery Capstone.
   Lectures 0-5 are core, 6+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const BR=O.D+'bradv/';

/* ---------- diagrams ---------- */
const tree=O.dg(700,250,[
[270,10,160,50,'Symptom: error or failure',2],
[10,90,190,50,'RMAN-03002 or RMAN-06023|backup or restore step failed',0],
[255,90,190,50,'ORA-01110 or ORA-01113|file needs recovery',0],
[500,90,190,50,'ORA-01578 or RMAN-06XXX|corruption',0],
[10,170,190,60,'Read the error stack|bottom up. Find|the first real cause',0],
[255,170,190,60,'RESTORE then RECOVER|that file. Check logs.',0],
[500,170,190,60,'Validate, then block|recovery or restore|the file',0]],
[[350,60,105,90],[350,60,350,90],[350,60,595,90],[105,140,105,170],[350,140,350,170],[595,140,595,170]]);

/* ---------- 0: Method ---------- */
L['ora-bkp:9:0']={blocks:[
{p:'When a backup or a restore fails, do not retry blindly. Follow the same short method every time.'},
{flow:['Read the **whole** error stack, bottom up: the first line is the final symptom, the real cause is deeper','Note the time, step, and what changed since the last success','Check the alert log and the RMAN log','Check space, permissions, and the FRA','Fix one thing, rerun the smallest command that proves it']},
{t:[['Check','Where'],
['Full error stack','RMAN log (use `log=`), `V$RMAN_OUTPUT`'],
['Database errors','Alert log, trace files'],
['Space','`V$RECOVERY_FILE_DEST`, `df -h`'],
['Permissions','OS user, backup directory, SBT library'],
['Network or media','SBT logs, storage logs'],
['What changed','Recent patch, new datafile, changed configuration']]},
{h:'Typical root causes'},
{ul:['Out of space in FRA or backup disk.','A file moved or deleted at OS level.','A media manager that is not reachable.','A missing archived log.','A wrong or changed password or key.']},
{note:'The **last** line of an RMAN-03002 error stack is usually the real cause. Read bottom up.'}],
src:[['Troubleshooting RMAN',BR]]};

/* ---------- 1: Common errors ---------- */
L['ora-bkp:9:1']={blocks:[
{p:'A short list of errors you will see often.'},
{svg:tree},
{t:[['Error','Meaning','Usual action'],
['**RMAN-03002**','A command failed. The details are below it in the stack.','Read the lines under it'],
['**RMAN-06023**','No backup or copy of a datafile found to restore','`LIST BACKUP`, `CROSSCHECK`, check the tag, DBID, or the database incarnation'],
['**RMAN-06025 / 06026**','Missing archived log for recovery','Find it (other host, tape, standby), or recover to an earlier point'],
['**RMAN-06054**','Media recovery waiting for a log','Provide the log or `CANCEL` for incomplete recovery'],
['**ORA-01110**','Names the datafile with the problem','Read together with the error before it'],
['**ORA-01113**','A file needs media recovery','`RECOVER` the file'],
['**ORA-01578**','Block corruption','Use validate, block recovery or restore the file'],
['**ORA-19809 / ORA-19804**','FRA limit exceeded','Free or extend FRA, back up and delete logs'],
['**ORA-00257**','Archiver stuck','Same: free the archive destination']]},
{note:'Memorize the pattern, not the number. Error codes are the start of a search, and the message text and the file named are the real clues.'}],
src:[['Error messages',O.ERR],['RMAN messages','https://docs.oracle.com/en/database/oracle/oracle-database/19/rcmrf/']]};

/* ---------- 2: Corruption ---------- */
L['ora-bkp:9:2']={blocks:[
{p:'**Block corruption** means a block on disk does not match what Oracle wrote. Find it early, and repair it with a known good copy.'},
{t:[['Tool','Use'],
['`BACKUP VALIDATE CHECK LOGICAL DATABASE`','Scan online. Fills `V$DATABASE_BLOCK_CORRUPTION`.'],
['`VALIDATE DATAFILE n`','One file'],
['`dbv` (DBVERIFY)','Offline file check at OS level'],
['`V$DATABASE_BLOCK_CORRUPTION`','List of known corrupt blocks'],
['`RECOVER CORRUPTION LIST`','Repair all listed blocks using backups and redo'],
['`RECOVER DATAFILE n BLOCK b`','Repair one block'],
['`DB_BLOCK_CHECKING / DB_BLOCK_CHECKSUM`','Detect corruption earlier at the cost of some CPU']]},
{code:`BACKUP VALIDATE CHECK LOGICAL DATABASE;
SELECT * FROM v$database_block_corruption;

RECOVER CORRUPTION LIST;
RECOVER DATAFILE 7 BLOCK 1234;

-- DBVERIFY
dbv file=/u01/oradata/prod/users01.dbf blocksize=8192`},
{h:'Notes'},
{ul:['Block recovery is **online**: only that block is unavailable while it is repaired.','It needs a good backup and the redo since. Active Data Guard can also repair blocks automatically from the standby.','Find the root cause: storage, controller, memory.']},
{note:'Corruption in a table block affects data. Corruption in an index can often be fixed by rebuilding the index. Find which object it is, from `V$DATABASE_BLOCK_CORRUPTION` and `DBA_EXTENTS`.'}],
src:[['Detecting and repairing corruption',BR]]};

/* ---------- 3: Runbooks and decision trees ---------- */
L['ora-bkp:9:3']={blocks:[
{p:'At night, with the service down, nobody should have to think of the procedure. Write it down as a **decision tree**.'},
{t:[['Situation','Check','Go to'],
['Database is down, files missing','`STARTUP MOUNT`, `V$RECOVER_FILE`','File recovery runbook'],
['Instance will not start NOMOUNT','Alert log, SPFILE, memory','SPFILE runbook'],
['All control files lost','DBID known?','Control file runbook'],
['Wrong data committed','Time of mistake known, Flashback available?','Flashback, then PITR'],
['Site lost','Standby available?','Failover or restore on a new host'],
['Corruption reported','Which object?','Block or file recovery']]},
{h:'A runbook page contains'},
{ul:['Purpose and when to use it.','Pre-checks (what to confirm first).','Numbered commands, copy-ready, with the expected result.','Rollback or stop points.','Who to inform.','Time the steps took in the last drill.']},
{flow:['Failure is detected','Classify it with the decision tree','Open the matching runbook','Execute and note times','Verify, take a backup, write a short report']},
{note:'Keep runbooks in a place that is not on the system they recover. Print the critical ones.'}],
src:[['Recovery planning',BR]]};

/* ---------- 4: Drills ---------- */
L['ora-bkp:9:4']={blocks:[
{p:'A backup is only proven when you **restore** it. Run drills on a schedule.'},
{t:[['Drill','How often','What it proves'],
['`RESTORE ... VALIDATE`','Weekly, automated','Backup pieces are readable'],
['Restore a datafile or PDB to a test host','Monthly','Procedure and speed'],
['Full database restore and recover to a new host','Quarterly or after major change','Whole RTO'],
['Point-in-time recovery to a chosen SCN','Twice a year','Incomplete recovery works'],
['Standby failover and reinstate','Twice a year','DR works'],
['Key and wallet restore','Yearly','You can still decrypt']]},
{h:'After each drill'},
{ul:['Record the time of each phase.','Compare with RTO.','Fix what was missing: a log, a password, a firewall rule.','Update the runbook.']},
{flow:['Plan the drill','Run it in an isolated environment','Measure and compare with RTO','Fix gaps and update documents','Repeat']},
{note:'Drills find problems when they cost nothing. The same problem found during a real incident costs hours.'}],
src:[['Testing recovery',BR]]};

/* ---------- 5: Capstone ---------- */
L['ora-bkp:9:5']={blocks:[
{p:'**Capstone.** Survive a **simulated data center loss**. Work on a test database. Time each phase and keep notes: the notes are the deliverable.'},
{h:'Scenario'},
{p:'The production host and its storage are gone. You have the RMAN backups and archived logs copied to another location, and a new empty host with Oracle software installed.'},
{h:'Tasks'},
{flow:['Document what you need: DBID, SID, backup location, file layout','Prepare the new host (OS user, directories, software, listener)','Restore SPFILE and control file from autobackup','Restore datafiles (with SET NEWNAME if paths differ)','Recover with archived logs. Record the last applied sequence.','Open RESETLOGS, recreate TEMP, check services','Take a new backup and set up the schedule']},
{h:'Acceptance'},
{t:[['Test','Pass condition'],
['Database opens','`OPEN_MODE` READ WRITE'],
['Data check','Row counts match the last known counts, or the loss is documented'],
['Time','Total time is within the RTO, or the gap is explained'],
['Data loss','Measured against the RPO'],
['New backup','Completed and validated'],
['Runbook','Updated with what you learned']]},
{h:'Self-assessment'},
{t:[['Level','Meaning'],
['**Foundation**','You restored the database following instructions'],
['**Solid**','You also diagnosed a missing log or a wrong path alone'],
['**Ready**','Another DBA can recover using only your runbook, and you know the real RTO']]},
{note:'You have now finished the Backup, Recovery & Flashback sub-course. The next step is to combine it with Data Guard for DR and with security for protected keys.'}],
src:[['Backup and Recovery User\'s Guide',BR],['Oracle Database 19c documentation',D]]};

})();
