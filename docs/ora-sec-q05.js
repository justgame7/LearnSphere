/* LearnSphere - Security quiz, Section 05: Data at Rest: Transparent Data Encryption.
   window.QUIZZES['ora-sec:4']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-sec:4']={qs:[
{q:'What does **TDE** protect?',o:['Data on disk and in backups','Data in memory','Data on the wire','Passwords'],a:0,why:'Use TLS for the wire.',lec:0},
{q:'What is the **master encryption key** held in?',o:['The keystore','The SPFILE','The listener','The alert log'],a:0,why:'Wallet or HSM.',lec:0},
{q:'Does TDE hide data from **authorized users**?',o:['No','Yes','Only DBAs','Only in PDBs'],a:0,why:'Access control does that.',lec:0},
{q:'Does TDE need **application changes**?',o:['No, it is transparent','Yes always','Only in Java','Only in PL/SQL'],a:0,why:'Decrypts on read.',lec:0},
{q:'Which keystore opens automatically only on **the same host**?',o:['Local auto-login','Auto-login','Password','HSM'],a:0,why:'Safer than auto-login.',lec:1},
{q:'Which keystore needs a **manual open** after restart?',o:['Password keystore','Local auto-login','Auto-login','None'],a:0,why:'SET KEYSTORE OPEN.',lec:1},
{q:'What happens if the keystore is **lost**?',o:['Encrypted data is lost','Nothing','Faster restore','Free keys'],a:0,why:'Back it up separately.',lec:1},
{q:'Which view shows the **wallet status**?',o:['V$ENCRYPTION_WALLET','V$LOG','V$LOCK','DBA_USERS'],a:0,why:'Status and type.',lec:1},
{q:'Which is the **usual choice**?',o:['Tablespace encryption','Column encryption','No encryption','Backup only'],a:0,why:'Low overhead and full index support.',lec:2},
{q:'What limits **column encryption**?',o:['Index use is limited','Backups fail','Redo fails','Undo fails'],a:0,why:'Equality only.',lec:2},
{q:'Which parameter encrypts **new tablespaces** by default?',o:['ENCRYPT_NEW_TABLESPACES','TDE_DEFAULT','AUTO_ENCRYPT','SECURE_TS'],a:0,why:'Set to ALWAYS.',lec:2},
{q:'Can an existing tablespace be encrypted **online**?',o:['Yes since 12.2','No','Only offline','Only in 11g'],a:0,why:'Needs temporary space.',lec:3},
{q:'What must you do with **old plain copies**?',o:['Securely delete them','Keep them','Rename','Ignore'],a:0,why:'Or the benefit is lost.',lec:3},
{q:'Which is done **last** when converting?',o:['SYSTEM, SYSAUX, UNDO','Application data first','Nothing','Temp'],a:0,why:'Plan the order.',lec:3},
{q:'Which rekey is **quick**?',o:['Master key','Tablespace key','Both heavy','None'],a:0,why:'Only re-wraps keys.',lec:4},
{q:'Why keep **old keystore backups**?',o:['Old backups need old keys','They are free','They are faster','Required for patches'],a:0,why:'Restore needs them.',lec:4},
{q:'Which rekey rewrites **data**?',o:['Tablespace key REKEY','Master key','Neither','Both'],a:0,why:'Online but heavy.',lec:4},
{q:'In **united mode**, there is:',o:['One keystore for the CDB','One per PDB always','None','Only per user'],a:0,why:'Isolated has one per PDB.',lec:5},
{q:'What does a PDB unplug need at the target?',o:['The exported encryption keys','Nothing','A new DBID','A password file'],a:0,why:'Otherwise unusable.',lec:5},
{q:'Which mode suits **hosting** with separate tenants?',o:['Isolated','United','Neither','Both'],a:0,why:'Separation.',lec:5},
{q:'What does an **RMAN backup** of an encrypted tablespace contain?',o:['Encrypted data','Plain data','Nothing','Keys only'],a:0,why:'Stays encrypted.',lec:6},
{q:'What does a **standby** need?',o:['The same keystore and keys','No keys','Only a password','Only a profile'],a:0,why:'Keep it in sync after rekey.',lec:6},
{q:'Common TDE incident:',o:['Failover to a standby without a current keystore','Disk full','Slow query','Lock'],a:0,why:'Test failover.',lec:6},
{q:'How do you verify **no readable data**?',o:['Run strings on a datafile','Run SELECT','Run ping','Run top'],a:0,why:'No business text.',lec:7},
{q:'What does the restore test **without** keystore prove?',o:['Backups are protected','Nothing','Speed','Space'],a:0,why:'It must fail.',lec:7},
{q:'What should be **stored separately**?',o:['The keystore backup','The datafiles','The SGA','Logs'],a:0,why:'Not with the data.',lec:7}
]};
