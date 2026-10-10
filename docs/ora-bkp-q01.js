/* LearnSphere - Backup & Recovery quiz, Section 01: Foundations.
   window.QUIZZES['ora-bkp:0']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-bkp:0']={qs:[
{q:'Which process performs **instance recovery** at the next startup?',o:['SMON','PMON','LGWR','DBWR'],a:0,why:'SMON rolls forward and back using the online redo.',lec:0},
{q:'Which failure needs a **restore from backup**?',o:['Media failure','Statement failure','Process failure','Instance failure'],a:0,why:'Lost datafiles must be restored and recovered.',lec:0},
{q:'Who cleans up after a **failed user process**?',o:['PMON','SMON','CKPT','ARCH'],a:0,why:'PMON releases locks and rolls back the transaction.',lec:0},
{q:'Which are **fixed automatically** by Oracle?',o:['Statement failure','Process failure','Instance failure','Media failure'],a:[0,1,2],why:'Media failure needs you.',lec:0},
{q:'What does **RPO** measure?',o:['How much data can be lost, as time','How long you can be down','Backup size','CPU use'],a:0,why:'RTO is the downtime.',lec:1},
{q:'A business accepts **no more than 15 minutes** of data loss. What do you need?',o:['Archived log backups at least every 15 minutes','A weekly full backup only','Logical export monthly','Nothing'],a:0,why:'Redo backups set the RPO.',lec:1},
{q:'Which gives an **RTO of minutes**?',o:['A standby database','Tape backups','A weekly export','A cold backup'],a:0,why:'A standby is already restored.',lec:1},
{q:'Which design decision comes **first**?',o:['RPO and RTO from the business','Choosing the tool','Choosing the disk','Choosing the schedule'],a:0,why:'Numbers drive the design.',lec:1},
{q:'Which backup type needs **redo** at recovery time?',o:['Inconsistent (online)','Consistent (clean shutdown)','Neither','Both'],a:0,why:'A consistent backup can be opened as is.',lec:2},
{q:'Which is a **physical** backup?',o:['RMAN datafile backup','Data Pump export','CSV export','A table copy'],a:0,why:'Physical means datafile blocks.',lec:2},
{q:'What does an **incremental** backup contain?',o:['Blocks changed since a previous backup','All blocks','Only the control file','Only redo'],a:0,why:'It saves time and space.',lec:2},
{q:'Is Data Pump a **substitute** for physical backups?',o:['No, it cannot do database point-in-time recovery','Yes always','Only for small databases','Only for Windows'],a:0,why:'It is logical.',lec:2},
{q:'Online backups require which **mode**?',o:['ARCHIVELOG','NOARCHIVELOG','READ ONLY','MOUNT only'],a:0,why:'Redo must be archived.',lec:2},
{q:'What does **roll forward** use?',o:['Redo','Undo','Flashback logs','Trace files'],a:0,why:'Redo replays committed and uncommitted changes.',lec:3},
{q:'What does **roll back** use?',o:['Undo','Redo','The control file','The alert log'],a:0,why:'Undo reverses uncommitted work.',lec:3},
{q:'What is the **SCN**?',o:['The system change number, the database clock','A session number','A table ID','A backup name'],a:0,why:'Recovery targets an SCN or time.',lec:3},
{q:'What is **incomplete recovery**?',o:['Recovery to a chosen point before the latest','Recovery to the latest change','Recovery with no redo','Instance recovery'],a:0,why:'It ends with OPEN RESETLOGS.',lec:3},
{q:'Which tool is best for **undoing a recent wrong delete** quickly?',o:['Flashback','A full restore','Data Guard failover','Reinstall'],a:0,why:'Flashback uses undo and flashback logs.',lec:4},
{q:'Does a **standby database** replace backups?',o:['No, it also copies mistakes','Yes','Only for small ones','Yes with Data Pump'],a:0,why:'You still need backups.',lec:4},
{q:'Which tool is for **site failure**?',o:['Data Guard','Flashback Table','Data Pump','SQL*Loader'],a:0,why:'Standby at another site.',lec:4},
{q:'What happens if the **FRA fills up** and archiving cannot continue?',o:['The database can hang','Nothing','It restarts','It deletes the backups'],a:0,why:'ORA-19809 or ORA-00257.',lec:5},
{q:'Which sequence enables **ARCHIVELOG**?',o:['SHUTDOWN, STARTUP MOUNT, ALTER DATABASE ARCHIVELOG, OPEN','ALTER SYSTEM only','STARTUP NOMOUNT, ARCHIVELOG','Restart the listener'],a:0,why:'It must be done in MOUNT.',lec:5},
{q:'Which view shows **FRA space use**?',o:['V$RECOVERY_FILE_DEST','V$LOG','V$SESSION','DBA_USERS'],a:0,why:'Plus V$FLASH_RECOVERY_AREA_USAGE.',lec:5},
{q:'What is in the **FRA**?',o:['Archived logs, backups and flashback logs','Only datafiles','Only trace files','Only the SPFILE'],a:0,why:'It is the default recovery landing place.',lec:5},
{q:'What must a good **plan** include besides backups?',o:['A restore test date','A new license','A larger SGA','More users'],a:0,why:'An untested plan is a guess.',lec:6},
{q:'In the practical, how often must **archived logs** be backed up for a 15-minute RPO?',o:['At least every 15 minutes','Daily','Weekly','Monthly'],a:0,why:'Redo backups set the RPO.',lec:6}
]};
