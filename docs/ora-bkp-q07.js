/* LearnSphere - Backup & Recovery quiz, Section 07: Flashback Technologies.
   window.QUIZZES['ora-bkp:6']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-bkp:6']={qs:[
{q:'Which flashback features use **undo**?',o:['Query, Versions, Table','Flashback Database','Restore points','Data Guard'],a:0,why:'Database uses flashback logs.',lec:0},
{q:'Which uses **flashback logs**?',o:['Flashback Database','Flashback Query','Flashback Table','Versions Query'],a:0,why:'Stored in the FRA.',lec:0},
{q:'Does Flashback replace backups?',o:['No, it cannot fix lost datafiles','Yes','Only for tables','Only on RAC'],a:0,why:'Files must exist.',lec:0},
{q:'How far back do **undo-based** features reach?',o:['As far as undo is retained','Forever','One year','To the last backup'],a:0,why:'UNDO_RETENTION and space.',lec:0},
{q:'Which clause reads data **as of a past time**?',o:['AS OF TIMESTAMP','VERSIONS BETWEEN','FLASHBACK TABLE','RESTORE'],a:0,why:'A read-only query.',lec:1},
{q:'Which shows **every version** of a row?',o:['VERSIONS BETWEEN','AS OF','EXPLAIN PLAN','DESCRIBE'],a:0,why:'With the transaction ID.',lec:1},
{q:'What does **FLASHBACK_TRANSACTION_QUERY** give?',o:['The undo SQL of a transaction','The table size','Backups','Users'],a:0,why:'Needs SELECT ANY TRANSACTION.',lec:1},
{q:'How can you **recover a few rows** without rewinding?',o:['INSERT INTO t SELECT ... AS OF TIMESTAMP','FLASHBACK DATABASE','RESTORE','TRUNCATE'],a:0,why:'Copy from the past.',lec:1},
{q:'What must be **enabled** for FLASHBACK TABLE TO TIMESTAMP?',o:['ROW MOVEMENT','ARCHIVELOG only','Flashback Database','TDE'],a:0,why:'Rows move during the rewind.',lec:2},
{q:'Which brings back a **dropped table**?',o:['FLASHBACK TABLE ... TO BEFORE DROP','RESTORE TABLE','UNDROP','RECOVER TABLE'],a:0,why:'From the recycle bin.',lec:2},
{q:'What stops undrop?',o:['DROP ... PURGE','DROP','TRUNCATE only','ALTER'],a:0,why:'PURGE skips the bin.',lec:2},
{q:'Does Flashback Table undo a **TRUNCATE**?',o:['No','Yes','Only with row movement','Only in PDBs'],a:0,why:'Use Flashback Database or restore.',lec:2},
{q:'Where are **flashback logs** stored?',o:['In the FRA','In the datafiles','In the SPFILE','In /tmp'],a:0,why:'Size the FRA for them.',lec:3},
{q:'Which parameter sets the **flashback window**?',o:['DB_FLASHBACK_RETENTION_TARGET','UNDO_RETENTION','FAST_START_MTTR_TARGET','LOG_BUFFER'],a:0,why:'In minutes.',lec:3},
{q:'After FLASHBACK DATABASE, which opening is used?',o:['OPEN RESETLOGS','Normal OPEN','READ ONLY only','No open needed'],a:0,why:'A new incarnation.',lec:3},
{q:'Which file loss can **Flashback Database not** fix?',o:['A lost datafile','A wrong update','A dropped table','A bad release'],a:0,why:'Flashback needs the files.',lec:3},
{q:'What does a **guaranteed** restore point do?',o:['Keeps flashback logs until you drop it','Backs up the database','Creates a standby','Stops archiving'],a:0,why:'Even with Flashback off.',lec:4},
{q:'What is a **risk** of guaranteed restore points?',o:['They can fill the FRA if forgotten','They delete data','They lock tables','They stop the database'],a:0,why:'Drop them when done.',lec:4},
{q:'Which view lists **restore points**?',o:['V$RESTORE_POINT','V$LOG','V$BACKUP','V$SESSION'],a:0,why:'Includes storage size.',lec:4},
{q:'Can a **PDB** be flashed back alone?',o:['Yes, in local undo mode','No','Only the root','Only with Data Guard'],a:0,why:'Others stay open.',lec:5},
{q:'Which syntax creates a **PDB restore point**?',o:['CREATE RESTORE POINT name FOR PLUGGABLE DATABASE pdb1','CREATE PDB RESTORE','ALTER PDB SAVE','SET POINT'],a:0,why:'Can be guaranteed too.',lec:5},
{q:'Which property shows **local undo**?',o:['LOCAL_UNDO_ENABLED','UNDO_MODE','PDB_UNDO','TEMP_UNDO'],a:0,why:'In DATABASE_PROPERTIES.',lec:5},
{q:'In the practical, what must happen **last**?',o:['Drop the restore point','Create it','Run the release','Open the database'],a:0,why:'Reclaim FRA space.',lec:6},
{q:'When is a **guaranteed restore point** standard?',o:['Before major changes','Never','Only on Monday','Only for tables'],a:0,why:'Fast rollback.',lec:6},
{q:'In the practical, what is gone after flashback?',o:['The new table and column','The orders table','All users','The FRA'],a:0,why:'Back to the restore point.',lec:6}
]};
