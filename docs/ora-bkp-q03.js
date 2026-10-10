/* LearnSphere - Backup & Recovery quiz, Section 03: Taking Backups with RMAN.
   window.QUIZZES['ora-bkp:2']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-bkp:2']={qs:[
{q:'Which command **backs up the logs** and the database together?',o:['BACKUP DATABASE PLUS ARCHIVELOG','BACKUP DATABASE ONLY','BACKUP LOGS','BACKUP SPFILE'],a:0,why:'It also switches the log first.',lec:0},
{q:'What does `DELETE INPUT` do?',o:['Removes logs after they are backed up','Deletes datafiles','Deletes the backup','Removes the control file'],a:0,why:'Only after a successful backup.',lec:0},
{q:'Which backup sets the **RPO**?',o:['Archived log backups','Datafile backups','Control file','SPFILE'],a:0,why:'Logs hold the latest changes.',lec:0},
{q:'Which is the **base** for incrementals?',o:['Level 0','A plain full backup','Level 1','Archived log'],a:0,why:'A full backup cannot be a base.',lec:1},
{q:'A **differential** level 1 copies:',o:['Changes since the last level 0 or 1','Changes since level 0 only','All blocks','Nothing'],a:0,why:'Cumulative is since level 0.',lec:1},
{q:'Which gives a **shorter restore chain**?',o:['Cumulative','Differential','Full each hour','Same'],a:0,why:'Level 0 plus the latest cumulative.',lec:1},
{q:'Which is the **default** level 1?',o:['Differential','Cumulative','Level 0','Full'],a:0,why:'Specify CUMULATIVE for the other.',lec:1},
{q:'What does **Block Change Tracking** avoid?',o:['Reading all blocks to find changes','Writing redo','Archiving','Checkpoints'],a:0,why:'It records changed blocks.',lec:2},
{q:'Which view shows **BCT** status?',o:['V$BLOCK_CHANGE_TRACKING','V$BCT','V$BACKUP_BCT','V$LOG'],a:0,why:'Shows file and size.',lec:2},
{q:'Does BCT help a **level 0**?',o:['No, it reads everything','Yes','Only on tape','Only compressed'],a:0,why:'It speeds level 1.',lec:2},
{q:'What does an **incrementally updated** backup keep?',o:['An image copy rolled forward daily','A tape set','Only logs','A dump file'],a:0,why:'RECOVER COPY plus level 1 FOR RECOVER OF COPY.',lec:3},
{q:'What is the **restore advantage**?',o:['Switch to the copy, then recover','No redo needed','No disk needed','No control file'],a:0,why:'Very fast restore.',lec:3},
{q:'What does the strategy **need**?',o:['Disk the size of the database','Tape library','A catalog only','Nothing'],a:0,why:'The copy is full size.',lec:3},
{q:'Which compression levels need the **Advanced Compression option**?',o:['LOW, MEDIUM, HIGH','BASIC only','None','All'],a:0,why:'BASIC is included.',lec:4},
{q:'What is needed to **restore** a TDE-encrypted backup?',o:['The keystore or password','Nothing','The listener','A new DBID'],a:0,why:'Without keys, no restore.',lec:4},
{q:'Which encryption mode does **not need the keystore**?',o:['Password encryption','Transparent','TDE','None'],a:0,why:'You must remember the password.',lec:4},
{q:'Which **file** is not backed up by RMAN?',o:['The password file and wallet','Datafiles','Control file','SPFILE'],a:0,why:'Copy them with the OS.',lec:5},
{q:'What does `%F` in the autobackup format contain?',o:['DBID and time','The SID','The size','The user'],a:0,why:'RMAN finds the control file with DBID.',lec:5},
{q:'What is needed to restore the **control file** on a new host?',o:['The DBID','The user password','The listener name','The OS version'],a:0,why:'Write it down.',lec:5},
{q:'What does **SECTION SIZE** do?',o:['Splits a large file across channels','Compresses','Encrypts','Deletes'],a:0,why:'Multisection backup.',lec:6},
{q:'What is a **tag**?',o:['A name for a backup, used to select it','A password','A tablespace','A role'],a:0,why:'Use it in RESTORE or LIST.',lec:6},
{q:'More channels always help?',o:['No, only if disk and network can keep up','Yes always','Never','Only on tape'],a:0,why:'Measure throughput.',lec:6},
{q:'What does `BACKUP VALIDATE DATABASE` do?',o:['Reads files and reports corruption without writing a backup','Backs up','Restores','Deletes'],a:0,why:'Nothing is written.',lec:7},
{q:'What does `RESTORE DATABASE VALIDATE` prove?',o:['The backup pieces can be read','The whole procedure works','The standby is current','Nothing'],a:0,why:'Only a real restore proves the procedure.',lec:7},
{q:'Where are **corruptions** listed?',o:['V$DATABASE_BLOCK_CORRUPTION','V$LOG','V$SQL','V$PARAMETER'],a:0,why:'After validate.',lec:7},
{q:'How often should **archived logs** be backed up in the practical?',o:['Every 15 minutes','Weekly','Monthly','Never'],a:0,why:'Matches the RPO.',lec:8},
{q:'In the practical, level 1 duration should be:',o:['Much shorter than level 0 with BCT','Longer','Equal','Zero'],a:0,why:'BCT reads only changed blocks.',lec:8}
]};
