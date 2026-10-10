/* LearnSphere - Backup & Recovery quiz, Section 02: RMAN Architecture & Configuration.
   window.QUIZZES['ora-bkp:1']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-bkp:1']={qs:[
{q:'What does the **RMAN client** do?',o:['Sends commands. Server sessions do the work.','Copies files at OS level','Stores backups','Runs the database'],a:0,why:'Channels on the target do the I/O.',lec:0},
{q:'What is an RMAN **channel**?',o:['A server session that reads or writes backup data','A network port','A tablespace','A redo thread'],a:0,why:'One channel is one parallel stream.',lec:0},
{q:'Where is the RMAN **repository** always kept?',o:['In the target control file','In the SPFILE','In the alert log','In the listener'],a:0,why:'A catalog is optional.',lec:0},
{q:'What can RMAN do that an **OS copy** cannot?',o:['Skip unused blocks and detect corruption','Copy faster always','Nothing','Run without Oracle'],a:0,why:'RMAN understands Oracle blocks.',lec:0},
{q:'Which privilege is **least-privileged** for backup tasks?',o:['SYSBACKUP','SYSDBA','DBA role','PUBLIC'],a:0,why:'It cannot read user data.',lec:1},
{q:'Which command connects RMAN **locally** with OS authentication?',o:['rman target /','rman catalog /','rman aux','sqlplus / as rman'],a:0,why:'Target connects to the database.',lec:1},
{q:'What does the **auxiliary** connection serve?',o:['DUPLICATE and TSPITR','Normal backups','Listener control','Patching'],a:0,why:'The auxiliary is the new or helper instance.',lec:1},
{q:'Which command lists **current persistent settings**?',o:['SHOW ALL','LIST ALL','REPORT ALL','DESCRIBE'],a:0,why:'Shows CONFIGURE values.',lec:1},
{q:'How long does the **control file** keep RMAN history by default?',o:['7 days (CONTROL_FILE_RECORD_KEEP_TIME)','Forever','1 hour','30 years'],a:0,why:'A catalog keeps it longer.',lec:2},
{q:'When is a **recovery catalog** most useful?',o:['Many databases or long retention','A single small test database','No backups','Never'],a:0,why:'Central history and stored scripts.',lec:2},
{q:'Where should the **catalog** NOT be placed?',o:['In the database it protects','In its own database','On another server','In a PDB of a separate CDB'],a:0,why:'A loss would take both.',lec:2},
{q:'Which role is granted to the **catalog owner**?',o:['RECOVERY_CATALOG_OWNER','DBA','SYSBACKUP','RESOURCE only'],a:0,why:'Then CREATE CATALOG.',lec:2},
{q:'Which setting is a **must-have**?',o:['CONTROLFILE AUTOBACKUP ON','BACKUP OPTIMIZATION ON','COMPRESSION','PARALLELISM 16'],a:0,why:'It saves the control file and SPFILE with each backup.',lec:3},
{q:'What does a **recovery window of 7 days** mean?',o:['Keep what is needed to recover to any point in 7 days','Keep 7 copies','Delete after 7 days always','Backup every 7 days'],a:0,why:'Redundancy N is the other style.',lec:3},
{q:'Which CONFIGURE sets the **number of channels**?',o:['DEVICE TYPE DISK PARALLELISM n','RETENTION','AUTOBACKUP','COMPRESSION'],a:0,why:'Parallelism = channels.',lec:3},
{q:'Which backup compression levels may need an **extra license**?',o:['Compression other than BASIC','None','All logging','Only tape'],a:0,why:'Advanced Compression option.',lec:3},
{q:'What is `db_recovery_file_dest_size`?',o:['A quota, not disk space','Disk space itself','A datafile size','A log size'],a:0,why:'The disk must still exist.',lec:4},
{q:'Which view shows **FRA usage**?',o:['V$RECOVERY_FILE_DEST','V$DATAFILE','V$PGASTAT','V$LOCK'],a:0,why:'Also V$FLASH_RECOVERY_AREA_USAGE.',lec:4},
{q:'When does Oracle **delete** files in the FRA?',o:['When it needs space and they are reclaimable','Never','Daily','At startup'],a:0,why:'Obsolete and backed up files are reclaimable.',lec:4},
{q:'Which form of backup **skips unused blocks**?',o:['Backup set','Image copy','Both','Neither'],a:0,why:'Image copies include everything.',lec:5},
{q:'Which allows **switching** to the backup without a restore?',o:['Image copy','Backup set','Archived log','Export'],a:0,why:'SWITCH DATABASE TO COPY.',lec:5},
{q:'Which backup form is needed for **tape**?',o:['Backup set','Image copy','Both','Neither'],a:0,why:'Image copies are disk only.',lec:5},
{q:'In the practical, what should `REPORT NEED BACKUP` return after the first backup?',o:['Nothing needs backup','All files need backup','An error','The control file only'],a:0,why:'A full backup was just taken.',lec:6},
{q:'What does `BACKUP DATABASE PLUS ARCHIVELOG` do?',o:['Backs up the database and archived logs','Only logs','Deletes logs','Starts Data Guard'],a:0,why:'It also switches the log first.',lec:6}
]};
