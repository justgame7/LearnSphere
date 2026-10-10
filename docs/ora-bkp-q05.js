/* LearnSphere - Backup & Recovery quiz, Section 05: Restore & Recovery.
   window.QUIZZES['ora-bkp:4']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-bkp:4']={qs:[
{q:'What does **RESTORE** do?',o:['Copies files from backup back to disk','Applies redo','Opens the database','Deletes logs'],a:0,why:'RECOVER applies redo.',lec:0},
{q:'What does **RECOVER** do?',o:['Applies redo to bring files current','Copies backups','Creates users','Resizes files'],a:0,why:'It follows the restore.',lec:0},
{q:'After RESTORE only, can the database open the old file?',o:['No, it needs RECOVER','Yes','Yes with a hint','Only on RAC'],a:0,why:'The file is older than the control file.',lec:0},
{q:'A **non-system datafile** is lost. The database can:',o:['Stay open, with the file offline','Never open','Only run read-only','Only restart'],a:0,why:'Only that file is unavailable.',lec:1},
{q:'Which command set recovers a **datafile online**?',o:['OFFLINE, RESTORE, RECOVER, ONLINE','SHUTDOWN, DROP','RESTORE only','OPEN RESETLOGS'],a:0,why:'Standard flow.',lec:1},
{q:'Which commands help **diagnose** failures?',o:['LIST FAILURE and ADVISE FAILURE','SHOW ALL','CROSSCHECK','LIST BACKUP'],a:0,why:'Data Recovery Advisor.',lec:1},
{q:'Can **SYSTEM** be taken offline for recovery?',o:['No, the database must be closed','Yes','Only in RAC','Only for tables'],a:0,why:'Recovery is offline.',lec:2},
{q:'What do you restore for **TEMP**?',o:['Nothing, recreate the tempfile','The tempfile from backup','The SYSTEM tablespace','The undo'],a:0,why:'Temp is not backed up.',lec:2},
{q:'What is lost with an **active UNDO** file lost?',o:['Rollback ability, so the database must be closed','Nothing','Only indexes','Only logs'],a:0,why:'Treat like SYSTEM.',lec:2},
{q:'All **control files** are lost. What do you need?',o:['Autobackup of the control file and the DBID','Only the listener','An export','A new SPFILE'],a:0,why:'RESTORE CONTROLFILE FROM AUTOBACKUP.',lec:3},
{q:'How does the database open after a **restored control file**?',o:['OPEN RESETLOGS after recovery','Normal OPEN','READ ONLY','Never'],a:0,why:'The control file is older.',lec:3},
{q:'What is the best prevention for control file loss?',o:['Multiplex on different disks','Smaller control file','Remove autobackup','Use tape'],a:0,why:'It costs nothing.',lec:3},
{q:'What is the first step with a lost **SPFILE**?',o:['Start NOMOUNT with a minimal PFILE','Open the database','Restore datafiles','Change DBID'],a:0,why:'Then restore the SPFILE.',lec:4},
{q:'Which online log status is **safe** to clear?',o:['INACTIVE','CURRENT','Active with data','None'],a:0,why:'Already checkpointed.',lec:4},
{q:'A lost **CURRENT** redo log with one member means:',o:['Possible data loss and incomplete recovery','Nothing','Only a warning','A restart'],a:0,why:'Multiplex redo logs.',lec:4},
{q:'Which are **incomplete recovery** targets?',o:['UNTIL TIME','UNTIL SCN','UNTIL SEQUENCE','UNTIL LATEST'],a:[0,1,2],why:'Latest is complete recovery.',lec:5},
{q:'Which command opens after **incomplete recovery**?',o:['ALTER DATABASE OPEN RESETLOGS','ALTER DATABASE OPEN','STARTUP','RECOVER'],a:0,why:'A new incarnation starts.',lec:5},
{q:'What does incomplete recovery **discard**?',o:['Everything after the target point','Everything before','Only logs','Nothing'],a:0,why:'Choose the point carefully.',lec:5},
{q:'What does **RESETLOGS** create?',o:['A new incarnation','A new user','A new PDB','A standby'],a:0,why:'Log sequence restarts.',lec:6},
{q:'What should you do **right after** RESETLOGS?',o:['Take a new full backup','Nothing','Delete old backups','Drop the FRA'],a:0,why:'Remove doubt.',lec:6},
{q:'Which command shows the **history** of incarnations?',o:['LIST INCARNATION OF DATABASE','LIST BACKUP','SHOW ALL','REPORT SCHEMA'],a:0,why:'Also V$DATABASE_INCARNATION.',lec:6},
{q:'What must be the same on the **new host**?',o:['Oracle software release and patch level','The OS hostname','The disk size','The user names'],a:0,why:'Compatible binaries.',lec:7},
{q:'What do you **need** with no repository?',o:['The DBID','The password','The tablespace name','The OS user'],a:0,why:'To find the autobackup.',lec:7},
{q:'Where should disaster **instructions** be stored?',o:['Outside the data center','Only on the server','On the primary disk','Nowhere'],a:0,why:'They must survive the disaster.',lec:7},
{q:'What does `SET NEWNAME` help with?',o:['Restoring to different file paths','Renaming users','Changing the SID','Compressing'],a:0,why:'Followed by SWITCH.',lec:7},
{q:'What is the **real RTO** in the practical?',o:['The measured time of each recovery','Zero','A guess','The backup duration'],a:0,why:'Measure it.',lec:8}
]};
