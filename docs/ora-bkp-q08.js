/* LearnSphere - Backup & Recovery quiz, Section 08: Duplication, Cloning & Transport.
   window.QUIZZES['ora-bkp:7']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-bkp:7']={qs:[
{q:'What does RMAN **DUPLICATE** create?',o:['A separate database with a new DBID','A backup','A tablespace','A PDB only'],a:0,why:'It is an independent copy.',lec:0},
{q:'Which are **uses** of duplication?',o:['Test copy','Upgrade rehearsal','Standby creation','Restore test'],a:[0,1,2,3],why:'All valid.',lec:0},
{q:'Why **mask** data in a test copy?',o:['It contains production data in a less protected place','It is faster','It is required for RMAN','It saves space'],a:0,why:'Protect sensitive data.',lec:0},
{q:'Which duplication has **no load** on the source?',o:['Backup-based','Active','Both','Neither'],a:0,why:'It reads backups only.',lec:1},
{q:'What does **active duplication** need?',o:['Network between source and target, and SYS password','Only backups','A tape','Nothing'],a:0,why:'Source is read live.',lec:1},
{q:'Which is the **best restore test**?',o:['Backup-based duplicate','Active duplicate','Data Pump','A cold copy'],a:0,why:'It proves the backups work.',lec:1},
{q:'In what state is the **auxiliary** instance started?',o:['NOMOUNT','OPEN','MOUNT','READ ONLY'],a:0,why:'Before DUPLICATE.',lec:2},
{q:'What is the **most common** first error?',o:['A name clash with the source','Wrong tablespace','No SGA','Missing listener port'],a:0,why:'Use a different db_name.',lec:2},
{q:'What helps map **file paths**?',o:['DB_FILE_NAME_CONVERT or SET NEWNAME','ALTER USER','CREATE LINK','GRANT'],a:0,why:'Or use OMF destinations.',lec:2},
{q:'Does the duplicate have the **same DBID**?',o:['No, new DBID','Yes','Only the first time','Only in RAC'],a:0,why:'It is a separate database.',lec:3},
{q:'Which option makes a **point-in-time** copy?',o:['UNTIL TIME or SCN','SKIP','NOFILENAMECHECK','SPFILE'],a:0,why:'Pick a time.',lec:3},
{q:'What should you do **after** duplication?',o:['Review database links and disable jobs','Nothing','Drop the SYSTEM','Move to production'],a:0,why:'Avoid wired-to-prod effects.',lec:3},
{q:'What is **TSPITR**?',o:['Point-in-time recovery of tablespaces while the DB runs','Full database PITR','A table rename','A tablespace export'],a:0,why:'Uses an auxiliary instance.',lec:4},
{q:'Which tablespace sets can be used with TSPITR?',o:['Self-contained','Any','Only SYSTEM','Only UNDO'],a:0,why:'No references outside.',lec:4},
{q:'What does TSPITR **lose**?',o:['Changes after the target time in those tablespaces','Everything','Nothing','Only indexes'],a:0,why:'Others remain current.',lec:4},
{q:'Which command recovers **one table** to a past time?',o:['RECOVER TABLE','RESTORE TABLE','FLASHBACK DATABASE','DUPLICATE TABLE'],a:0,why:'Needs an auxiliary destination.',lec:5},
{q:'What does **REMAP TABLE** do?',o:['Imports under another name','Deletes the table','Moves a tablespace','Renames a user'],a:0,why:'Production is untouched.',lec:5},
{q:'For a **recent** table mistake, the cheapest tool is:',o:['Flashback Table','RECOVER TABLE','TSPITR','Duplicate'],a:0,why:'Undo based.',lec:5},
{q:'What does **NOTABLEIMPORT** do?',o:['Creates only the dump file','Imports the table','Skips recovery','Deletes the dump'],a:0,why:'You import later.',lec:5},
{q:'What must be **different** in a duplicate on the same host?',o:['db_name or SID','The OS','The SGA','The charset'],a:0,why:'Avoid clash.',lec:6},
{q:'In the practical, what should **differ** from production?',o:['DBID','Row counts','Table names','Schema'],a:0,why:'New DBID.',lec:6},
{q:'In the practical, what must you **review**?',o:['Database links and scheduler jobs','The OS','Backups only','Nothing'],a:0,why:'They may point to production.',lec:6},
{q:'Which duplicate option creates a **standby**?',o:['FOR STANDBY','SKIP','UNTIL','NOFILENAMECHECK'],a:0,why:'Data Guard.',lec:3},
{q:'Which parameter lets **OMF** place files?',o:['db_create_file_dest','sga_target','processes','open_cursors'],a:0,why:'No per-file mapping.',lec:2},
{q:'A storage snapshot clone usually keeps:',o:['The same DBID unless changed','A new DBID automatically','No data','Only logs'],a:0,why:'Rename needed.',lec:0}
]};
