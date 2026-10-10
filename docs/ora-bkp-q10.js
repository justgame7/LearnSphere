/* LearnSphere - Backup & Recovery quiz, Section 10: Troubleshooting & Recovery Capstone.
   window.QUIZZES['ora-bkp:9']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-bkp:9']={qs:[
{q:'In which **direction** do you read an RMAN error stack?',o:['Bottom up, the real cause is deeper','Top only','Left to right','Ignore it'],a:0,why:'RMAN-03002 hides the cause below.',lec:0},
{q:'Where do you find the **full RMAN output**?',o:['A log file (log=) or V$RMAN_OUTPUT','The listener','The SPFILE','The OS cron'],a:0,why:'Use log= always.',lec:0},
{q:'Which are typical **root causes**?',o:['No space in FRA','A file moved at OS level','A missing archived log','A changed password'],a:[0,1,2,3],why:'All common.',lec:0},
{q:'What should you do first when a backup **fails**?',o:['Read the full stack and check what changed','Retry blindly','Drop the backup','Restart the server'],a:0,why:'Method before action.',lec:0},
{q:'What does **RMAN-06023** mean?',o:['No backup of a datafile found to restore','Network error','Wrong password','Disk full'],a:0,why:'Check DBID, tag, incarnation.',lec:1},
{q:'What does **ORA-01113** say?',o:['A file needs media recovery','A table is missing','A user is locked','A listener is down'],a:0,why:'Run RECOVER.',lec:1},
{q:'What is **ORA-00257**?',o:['Archiver stuck','Invalid user','Bad SQL','Block corruption'],a:0,why:'Free the archive destination.',lec:1},
{q:'What does **ORA-01578** indicate?',o:['Block corruption','Lock','Space','Network'],a:0,why:'Use validate and block recovery.',lec:1},
{q:'Which command **scans** for corruption online?',o:['BACKUP VALIDATE CHECK LOGICAL DATABASE','LIST BACKUP','REPORT SCHEMA','CROSSCHECK'],a:0,why:'Fills V$DATABASE_BLOCK_CORRUPTION.',lec:2},
{q:'Which command **repairs** listed corrupt blocks?',o:['RECOVER CORRUPTION LIST','RECOVER DATABASE','RESTORE CONTROLFILE','DELETE OBSOLETE'],a:0,why:'Needs backups and redo.',lec:2},
{q:'Is **block recovery** online?',o:['Yes, only the block is unavailable','No','Only in RAC','Only for index'],a:0,why:'Rest of the file stays usable.',lec:2},
{q:'Which tool checks a datafile **offline**?',o:['dbv','sqlplus','lsnrctl','srvctl'],a:0,why:'DBVERIFY.',lec:2},
{q:'What helps repair blocks **automatically**?',o:['Active Data Guard','A larger SGA','A listener','TDE'],a:0,why:'Automatic block repair from the standby.',lec:2},
{q:'What should a **runbook** contain?',o:['Numbered copy-ready commands with expected results','Only theory','Only pictures','A password list'],a:0,why:'Usable under pressure.',lec:3},
{q:'Where should runbooks be kept?',o:['Outside the system they recover','Only on the production server','Only in memory','Nowhere'],a:0,why:'They must survive the incident.',lec:3},
{q:'A **wrong committed update** should first try:',o:['Flashback','Full restore','Failover','Reinstall'],a:0,why:'Cheapest if undo exists.',lec:3},
{q:'What is the **purpose** of a drill?',o:['Prove procedure and measure time','Delete old backups','Test CPU','Create users'],a:0,why:'Untested means unknown.',lec:4},
{q:'How often should a **full restore** drill run?',o:['Quarterly or after major change','Never','Every minute','Once in a decade'],a:0,why:'Keep RTO known.',lec:4},
{q:'What should you do **after** a drill?',o:['Fix gaps and update the runbook','Nothing','Delete the logs','Skip reports'],a:0,why:'Improve every time.',lec:4},
{q:'What is needed first in the **capstone**?',o:['DBID, SID, backup location and file layout','A new license','A bigger SGA','A new user'],a:0,why:'Document before you start.',lec:5},
{q:'In the capstone, which order is right?',o:['SPFILE, control file, datafiles, recover, RESETLOGS','Datafiles, SPFILE','RESETLOGS first','Open first'],a:0,why:'Standard disaster order.',lec:5},
{q:'In the capstone, what must be measured against RTO?',o:['Total time of the recovery','CPU','Network','Users'],a:0,why:'That is the real RTO.',lec:5},
{q:'What should you do **last** in the capstone?',o:['Take a new backup and set the schedule','Delete the old backups','Stop the database','Drop the FRA'],a:0,why:'Back in protection.',lec:5},
{q:'Which self-assessment level means **another DBA** can recover using your notes?',o:['Ready','Foundation','Solid','None'],a:0,why:'Runbook quality.',lec:5},
{q:'Where do you check for **errors** besides the RMAN log?',o:['The alert log','The listener only','Excel','The browser'],a:0,why:'Database side of the failure.',lec:0},
{q:'ORA-19809 means:',o:['FRA limit exceeded','User locked','Network down','Table dropped'],a:0,why:'Free or extend FRA.',lec:1}
]};
