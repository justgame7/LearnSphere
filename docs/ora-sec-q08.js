/* LearnSphere - Security quiz, Section 08: SQL Firewall & Modern Protections.
   window.QUIZZES['ora-sec:7']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-sec:7']={qs:[
{q:'What is **SQL injection**?',o:['User input changes the meaning of SQL','A backup method','A patch','An index'],a:0,why:'Caused by concatenation.',lec:0},
{q:'What is the **main fix**?',o:['Bind variables in application code','More memory','Firewall only','More CPUs'],a:0,why:'Input as data, not code.',lec:0},
{q:'Which package validates **object names**?',o:['DBMS_ASSERT','DBMS_STATS','DBMS_LOCK','DBMS_JOB'],a:0,why:'Input validation.',lec:0},
{q:'Least privilege limits:',o:['Damage if injection succeeds','Query speed','Backups','Network'],a:0,why:'Limits impact.',lec:0},
{q:'What does SQL Firewall **learn**?',o:['Normal SQL and session context','Passwords','Backups','Index names'],a:0,why:'Capture phase.',lec:1},
{q:'What is the **allow-list**?',o:['Approved SQL and contexts','A user list','A table list','A backup list'],a:0,why:'Everything else is a violation.',lec:1},
{q:'SQL Firewall is a:',o:['26ai feature','11g feature','OS feature','Storage feature'],a:0,why:'Check the release.',lec:1},
{q:'Where should you verify **exact names**?',o:['26ai Security Guide','Blogs','Memory','Alert log'],a:0,why:'Release specific.',lec:1},
{q:'Which mode should you **start** with?',o:['Log only','Block','Disabled','Delete'],a:0,why:'Reduce false positives.',lec:2},
{q:'What do you do with a **legitimate** violation?',o:['Add to the allow-list via change control','Ignore','Block users','Drop the table'],a:0,why:'Keep it controlled.',lec:2},
{q:'When should you **re-capture**?',o:['After each application release','Never','Every second','At startup only'],a:0,why:'New SQL appears.',lec:2},
{q:'Where should violations be **sent**?',o:['The SIEM','Nowhere','Email only to nobody','The trace file'],a:0,why:'Response process.',lec:2},
{q:'What is an **immutable table**?',o:['Rows cannot be changed after insert','A temporary table','A view','An index'],a:0,why:'WORM.',lec:3},
{q:'What does a **blockchain table** add?',o:['Cryptographic hash chaining','Compression','Partitioning','Encryption'],a:0,why:'Tamper detection.',lec:3},
{q:'Can you delete rows **before** the retention ends?',o:['No, even with powerful privileges','Yes','As DBA','As SYS'],a:0,why:'Choose retention carefully.',lec:3},
{q:'What does a **schema privilege** replace?',o:['Database-wide ANY privileges','Passwords','Profiles','Roles'],a:0,why:'Smaller blast radius.',lec:4},
{q:'Does a schema privilege cover **new objects**?',o:['Yes','No','Only tables','Only views'],a:0,why:'Automatically.',lec:4},
{q:'Which view lists **schema privileges**?',o:['DBA_SCHEMA_PRIVS','DBA_USERS','V$LOG','DBA_JOBS'],a:0,why:'Per schema.',lec:4},
{q:'In the practical, what happens to an **injected** query?',o:['Logged then blocked','Runs','Deletes table','Nothing'],a:0,why:'Not in the allow-list.',lec:5},
{q:'Does Firewall **replace** secure code?',o:['No, it is a safety net','Yes','Only in 26ai','Only for DDL'],a:0,why:'Turns a bug into an alert.',lec:5},
{q:'What should be documented for **releases**?',o:['The allow-list refresh process','Passwords','Backups','Indexes'],a:0,why:'Operational.',lec:5},
{q:'Which clause protects a table from **DROP** for a period?',o:['NO DROP UNTIL n DAYS IDLE','CASCADE','PURGE','HASHING'],a:0,why:'Immutable tables.',lec:3},
{q:'What is **not** a defense against injection?',o:['Larger SGA','Bind variables','Least privilege','Validation'],a:0,why:'Unrelated.',lec:0},
{q:'Which security view also shows **client IP** of violations?',o:['The firewall violation view','V$LOG','DBA_TABLES','V$LOCK'],a:0,why:'Context information.',lec:5}
]};
