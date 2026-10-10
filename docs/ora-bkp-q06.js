/* LearnSphere - Backup & Recovery quiz, Section 06: Multitenant Backup & Recovery.
   window.QUIZZES['ora-bkp:5']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-bkp:5']={qs:[
{q:'Which command backs up **only the root**?',o:['BACKUP DATABASE ROOT','BACKUP ROOT ALL','BACKUP CDB','BACKUP PLUGGABLE'],a:0,why:'Also available: BACKUP PLUGGABLE DATABASE.',lec:0},
{q:'Which belong to the **CDB**, not a single PDB?',o:['Redo and undo','Control file','Archived logs','Application tables'],a:[0,1,2],why:'Shared among PDBs.',lec:0},
{q:'Which command backs up **one tablespace** in a PDB from the root?',o:['BACKUP TABLESPACE pdb1:users','BACKUP PDB users','BACKUP USERS','BACKUP FILE'],a:0,why:'Use the pdb:ts form.',lec:0},
{q:'Can a **PDB connection** back up archived logs?',o:['No, connect to the root','Yes','Only compressed','Only on RAC'],a:0,why:'Logs belong to the CDB.',lec:1},
{q:'Connecting RMAN to a **PDB** lets you:',o:['Back up and recover that PDB only','Recover the whole CDB','Back up all PDBs','Recover the root'],a:0,why:'Limited scope.',lec:1},
{q:'Who should connect to the **root**?',o:['The DBA of the whole CDB','A PDB application user','A reporting user','Nobody'],a:0,why:'Full scope.',lec:1},
{q:'Recovering one PDB leaves **other PDBs**:',o:['Open and unaffected','Closed','Dropped','Read only'],a:0,why:'This is a multitenant benefit.',lec:2},
{q:'Which sequence recovers a **PDB**?',o:['Close, RESTORE PLUGGABLE, RECOVER PLUGGABLE, open','Drop and create','Restart CDB','Export and import'],a:0,why:'Standard flow.',lec:2},
{q:'A lost **root SYSTEM** tablespace affects:',o:['The whole CDB','Only the root','No one','Only one PDB'],a:0,why:'PDBs depend on the root.',lec:2},
{q:'PDB point-in-time recovery uses:',o:['An auxiliary instance temporarily','A standby','Data Pump','A new CDB'],a:0,why:'To apply redo for that PDB.',lec:3},
{q:'How is a PDB opened after PITR?',o:['OPEN RESETLOGS','Normal open','Read only','Restricted only'],a:0,why:'A PDB incarnation starts.',lec:3},
{q:'Which PDBs are **affected** by PDB PITR?',o:['Only the recovered one','All','The root','None, including it'],a:0,why:'Isolated.',lec:3},
{q:'What happens to the **CDB** when root files are lost?',o:['It is down until recovered','Stays fully open','Only one PDB fails','Restarts by itself'],a:0,why:'Root holds the dictionary and undo.',lec:4},
{q:'In which order do you recover a **whole CDB**?',o:['Root first, then PDBs','PDBs first','Any order','Only the PDBs'],a:0,why:'PDBs depend on the root.',lec:4},
{q:'Which command **copies a PDB** into another CDB with RMAN?',o:['DUPLICATE PLUGGABLE DATABASE','BACKUP PDB','RESTORE ROOT','ALTER PDB'],a:0,why:'From backup or active.',lec:5},
{q:'What must you **check** before restoring a PDB to another CDB?',o:['Version and patch compatibility','Disk colour','The listener','The backup tag'],a:0,why:'Target must be same or newer.',lec:5},
{q:'Which is another way to **clone a PDB**?',o:['CREATE PLUGGABLE DATABASE ... FROM over a link','Copy files with cp while open','Drop it','Only restart'],a:0,why:'Remote clone.',lec:5},
{q:'What three things does a PDB PITR need?',o:['A time, a backup before it, archived logs after it','A tape, a license, a user','A new CDB','Nothing'],a:0,why:'As in the practical.',lec:6},
{q:'Which view shows **PDB incarnations**?',o:['V$PDB_INCARNATION','V$LOG','V$SESSION','V$PARAMETER'],a:0,why:'New one after PITR.',lec:6},
{q:'What should you do **after** PDB PITR?',o:['Take a new backup of the PDB','Delete old backups','Drop the PDB','Restart the CDB'],a:0,why:'Remove doubt.',lec:6},
{q:'Does the **root backup** matter as much as PDB backups?',o:['Yes, PDBs depend on it','No','Only for 26ai','Only on RAC'],a:0,why:'A lost root is a lost CDB.',lec:4},
{q:'Which command opens **all PDBs**?',o:['ALTER PLUGGABLE DATABASE ALL OPEN','OPEN ALL','STARTUP PDB','RECOVER ALL'],a:0,why:'After recovering the root.',lec:4},
{q:'Which is true for **TEMP** in a PDB?',o:['It is recreated, not restored','It is restored from backup','It is exported','It holds data forever'],a:0,why:'Temp is not backed up.',lec:2},
{q:'A PDB administrator with limited rights should connect to:',o:['The PDB','The root as SYSDBA','The ASM instance','The listener'],a:0,why:'Local scope.',lec:1}
]};
