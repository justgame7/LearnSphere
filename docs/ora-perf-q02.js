/* LearnSphere - Performance quiz, Section 02: Wait Interface & Dynamic Views.
   window.QUIZZES['ora-perf:1']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-perf:1']={qs:[
{q:'What does the **wait interface** record?',o:['Why a session cannot continue','Backups','Users','Disk size'],a:0,why:'Event, parameters and time.',lec:0},
{q:'Is `SQL*Net message from client` a **problem**?',o:['Usually not, it is idle','Always','Only at night','Only in RAC'],a:0,why:'Waiting for the client.',lec:0},
{q:'Which view shows **cumulative** events since startup?',o:['V$SYSTEM_EVENT','V$SESSION','V$LOCK','V$PARAMETER'],a:0,why:'Take two readings and subtract.',lec:0},
{q:'Which gives the **current wait** of each session?',o:['V$SESSION','V$SYSSTAT','DBA_USERS','V$LOG'],a:0,why:'EVENT column.',lec:0},
{q:'Which view samples active sessions **every second**?',o:['V$ACTIVE_SESSION_HISTORY','V$SESSION_WAIT','V$SYSSTAT','V$PGASTAT'],a:0,why:'Needs the Diagnostics Pack.',lec:1},
{q:'One **ASH sample** is roughly:',o:['1 second of DB time','1 minute','1 hour','1 byte'],a:0,why:'Count samples to find time.',lec:1},
{q:'Which column shows the **blocker** in V$SESSION?',o:['BLOCKING_SESSION','SQL_ID','STATUS','MODULE'],a:0,why:'The session holding the resource.',lec:1},
{q:'Which is **in the pack**?',o:['V$ACTIVE_SESSION_HISTORY','V$SESSION','V$SQL','V$SYSSTAT'],a:0,why:'V$SESSION is not.',lec:1},
{q:'How do you see the load of a **period** from cumulative views?',o:['Subtract two readings','Use one reading','Restart the DB','Use EXPLAIN'],a:0,why:'Or use AWR.',lec:2},
{q:'Which view shows **DB Time and DB CPU**?',o:['V$SYS_TIME_MODEL','V$LOG','V$BACKUP','V$LIBRARYCACHE'],a:0,why:'Time model.',lec:2},
{q:'Which view shows **OS CPU**?',o:['V$OSSTAT','V$SQL','V$ASM','V$TEMPFILE'],a:0,why:'Host data.',lec:2},
{q:'What does **db file sequential read** mean?',o:['Single-block read','Full scan','Commit','Network'],a:0,why:'Index or ROWID access.',lec:3},
{q:'What does **db file scattered read** mean?',o:['Multiblock read for a scan','A commit','A lock','A parse'],a:0,why:'Full table scan.',lec:3},
{q:'What causes **log file sync**?',o:['Waiting for commit redo to be written','A full scan','Parsing','Network'],a:0,why:'Slow redo disk or many commits.',lec:3},
{q:'Which event means a **row lock** wait?',o:['enq: TX - row lock contention','db file scattered read','log file sync','direct path read'],a:0,why:'Application locking.',lec:3},
{q:'What should you **tune first**?',o:['The event with most DB Time','The scariest name','The newest event','Any'],a:0,why:'Impact first.',lec:3},
{q:'Which view lists **SQL statistics** in the shared pool?',o:['V$SQL','V$LOG','V$LOCK','V$TEMPSEG_USAGE'],a:0,why:'Also V$SQLAREA.',lec:4},
{q:'Which column is a good **logical cost** measure?',o:['BUFFER_GETS','ROWS_PROCESSED only','SQL_TEXT','USERNAME'],a:0,why:'Logical reads.',lec:4},
{q:'A cheap SQL run **millions of times** is fixed by:',o:['Reducing calls in the application','A bigger SGA only','An index always','A restart'],a:0,why:'Fewer round trips.',lec:4},
{q:'What does a **changed PLAN_HASH_VALUE** tell you?',o:['The plan changed','The user changed','The disk changed','Nothing'],a:0,why:'A common regression cause.',lec:4},
{q:'In the practical, which event do the waiters show?',o:['enq: TX - row lock contention','log file sync','db file scattered read','latch free'],a:0,why:'Same row updated.',lec:5},
{q:'What state is the **blocker** in?',o:['Often idle','Always running','Dropped','Stopped'],a:0,why:'It forgot to commit.',lec:5},
{q:'What releases the waiters?',o:['COMMIT or ROLLBACK by the blocker','Restart the listener','Add an index','Flush the pool'],a:0,why:'Lock released.',lec:5},
{q:'Which view reveals the **SQL of the blocker**?',o:['V$SESSION with SQL_ID and V$SQL','V$SYSSTAT','DBA_TABLES','V$DATAFILE'],a:0,why:'Join on SQL_ID.',lec:5}
]};
