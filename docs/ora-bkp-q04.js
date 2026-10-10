/* LearnSphere - Backup & Recovery quiz, Section 04: Maintaining Backups & the Repository.
   window.QUIZZES['ora-bkp:3']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-bkp:3']={qs:[
{q:'Which command shows files that **violate** the retention policy?',o:['REPORT NEED BACKUP','LIST BACKUP','REPORT SCHEMA','SHOW ALL'],a:0,why:'An empty result means the policy is met.',lec:0},
{q:'Which command shows the **current structure**?',o:['REPORT SCHEMA','LIST COPY','REPORT OBSOLETE','CROSSCHECK'],a:0,why:'Datafiles and tablespaces.',lec:0},
{q:'LIST shows what **exists**. REPORT shows:',o:['What is needed or obsolete','Nothing','Only logs','Only errors'],a:0,why:'Needs and obsolescence.',lec:0},
{q:'What status does a **missing backup file** get after CROSSCHECK?',o:['EXPIRED','OBSOLETE','AVAILABLE','KEEP'],a:0,why:'RMAN could not find it.',lec:1},
{q:'What does **OBSOLETE** mean?',o:['Exists but not needed by the retention policy','The file is missing','Corrupted','Encrypted'],a:0,why:'Expired is missing.',lec:1},
{q:'Which removes **missing** entries from the repository?',o:['DELETE EXPIRED','DELETE OBSOLETE','DROP','CATALOG'],a:0,why:'After CROSSCHECK.',lec:1},
{q:'What does **recovery window of 14 days** keep?',o:['What is needed to recover to any point in 14 days','14 copies','14 logs','14 files'],a:0,why:'Window, not count.',lec:2},
{q:'Which backups **ignore** the retention policy?',o:['KEEP backups','Level 1','Archived logs','Control file'],a:0,why:'They are self-contained archives.',lec:2},
{q:'Which command **deletes** unneeded backups?',o:['DELETE OBSOLETE','DELETE EXPIRED','CROSSCHECK','DROP BACKUP'],a:0,why:'According to the policy.',lec:2},
{q:'When can an archived log be deleted with a Data Guard policy?',o:['When applied on all standbys','Always','Never','After a day'],a:0,why:'APPLIED ON ALL STANDBY.',lec:3},
{q:'Why not use `rm` on archived logs?',o:['RMAN and the FRA do not know they are gone','It is slow','It is not allowed in Linux','It encrypts them'],a:0,why:'Use DELETE ARCHIVELOG.',lec:3},
{q:'Which policy combines **backup and standby**?',o:['BACKED UP n TIMES ... APPLIED ON ALL STANDBY','NONE','SHIPPED only','COMPRESSED'],a:0,why:'Both must hold.',lec:3},
{q:'What does `RESTORE DATABASE PREVIEW` do?',o:['Lists the backups it would use without reading','Restores','Deletes','Validates'],a:0,why:'It reads nothing.',lec:4},
{q:'What does `RESTORE VALIDATE` add?',o:['Reads the backups to check them','Restores files','Changes retention','Encrypts'],a:0,why:'No restore happens.',lec:4},
{q:'Why use PREVIEW **before** an incident?',o:['To find missing logs while it can be fixed','It is faster','It is required','It deletes logs'],a:0,why:'Know the plan early.',lec:4},
{q:'Which **scheduler** fits many databases?',o:['Enterprise Manager','cron on one host','Manual','None'],a:0,why:'Central schedule and alerts.',lec:5},
{q:'What must a **backup script** do on failure?',o:['Alert someone','Nothing','Delete logs','Restart the database'],a:0,why:'Silent failures are the danger.',lec:5},
{q:'Should two backups for the **same database** overlap?',o:['No','Yes always','Only on weekends','Only compressed'],a:0,why:'Avoid conflicts and load.',lec:5},
{q:'Which view shows **backup jobs**?',o:['V$RMAN_BACKUP_JOB_DETAILS','V$SESSION','V$PARAMETER','V$LOCK'],a:0,why:'One row per job.',lec:6},
{q:'Which view shows **progress** of a long backup step?',o:['V$SESSION_LONGOPS','V$ARCHIVE','V$LOG','V$TABLESPACE'],a:0,why:'Percent done.',lec:6},
{q:'What should you **also alert on**?',o:['No successful backup in N hours','Only failures','Only warnings','Nothing'],a:0,why:'Absence of a job.',lec:6},
{q:'What does CROSSCHECK of an **expected** file show in the practical?',o:['No EXPIRED entries','Many EXPIRED','Obsolete only','Errors'],a:0,why:'Everything present.',lec:7},
{q:'After you rename a log, CROSSCHECK shows it as:',o:['EXPIRED','AVAILABLE','OBSOLETE','KEEP'],a:0,why:'RMAN cannot find the file.',lec:7},
{q:'How often should restorability be **checked**?',o:['Regularly, as a scheduled job','Once','Never','After a failure only'],a:0,why:'The result expires.',lec:7}
]};
