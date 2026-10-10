/* LearnSphere - Performance quiz, Section 10: Concurrency, Locking & Hang Analysis.
   window.QUIZZES['ora-perf:9']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-perf:9']={qs:[
{q:'Do **readers** block writers in Oracle?',o:['No','Yes','Only on Monday','Only in RAC'],a:0,why:'Read consistency.',lec:0},
{q:'Which lock type protects a **row**?',o:['TX','TM','UL','CF'],a:0,why:'Transaction lock.',lec:0},
{q:'What often causes **TM** contention?',o:['A missing foreign key index','A full disk','A large SGA','A slow network'],a:0,why:'Index FK columns.',lec:0},
{q:'Most locking problems are about:',o:['Transaction length','CPU speed','Disk type','Network'],a:0,why:'Keep transactions short.',lec:0},
{q:'What should you find first in a blocking chain?',o:['The root blocker','The first waiter','The oldest user','The largest table'],a:0,why:'FINAL_BLOCKING_SESSION.',lec:1},
{q:'Which column shows the **root blocker**?',o:['FINAL_BLOCKING_SESSION','STATUS','PROGRAM','LOGON_TIME'],a:0,why:'V$SESSION.',lec:1},
{q:'A blocker with long **last_call_et** and INACTIVE is:',o:['Idle holding a transaction','Running a query','Stopped','Disconnected'],a:0,why:'Contact the owner.',lec:1},
{q:'What happens when you **kill** a session?',o:['Its work is rolled back','Nothing','It commits','It restarts'],a:0,why:'May take a long time.',lec:1},
{q:'What error does a **deadlock** raise?',o:['ORA-00060','ORA-00257','ORA-01555','ORA-04031'],a:0,why:'One statement rolled back.',lec:2},
{q:'Where are **deadlock details** found?',o:['Alert log and trace file','Listener','SPFILE','Control file'],a:0,why:'Deadlock graph.',lec:2},
{q:'What prevents most **deadlocks**?',o:['Same order of updates','More memory','More CPUs','Bigger logs'],a:0,why:'Application design.',lec:2},
{q:'Does Oracle **resolve** a deadlock itself?',o:['Yes, by rolling back one statement','No','Never','Only manually'],a:0,why:'But the app bug stays.',lec:2},
{q:'What causes **library cache** contention?',o:['DDL or stats on busy objects, hard parse storms','Slow disks','Large undo','Network'],a:0,why:'Invalidations.',lec:3},
{q:'How should you handle a **hot counter row**?',o:['Use a sequence or partition the counter','Add more users','Increase SGA','Disable locking'],a:0,why:'Avoid a queue.',lec:3},
{q:'Which clause is useful for **work queues**?',o:['SKIP LOCKED','NOWAIT only','CASCADE','PURGE'],a:0,why:'Take rows others do not hold.',lec:3},
{q:'What should you **not do first** in a hang?',o:['Restart','Read the alert log','Check the host','Find blockers'],a:0,why:'You lose evidence.',lec:4},
{q:'How do you connect when the instance is **unresponsive**?',o:['sqlplus -prelim','Restart listener','Reinstall','Use Excel'],a:0,why:'Preliminary connection.',lec:4},
{q:'Which command takes a **hang analysis**?',o:['ORADEBUG HANGANALYZE','ANALYZE TABLE','EXPLAIN','DESCRIBE'],a:0,why:'After SETMYPID.',lec:4},
{q:'A full **archive destination** causes:',o:['The database to hang','Nothing','Faster writes','Locks only'],a:0,why:'Check the alert log.',lec:4},
{q:'Which view shows **resource limits**?',o:['V$RESOURCE_LIMIT','V$LOG','V$LOCK','V$FILE'],a:0,why:'PROCESSES and SESSIONS.',lec:4},
{q:'In the practical, who is the **root blocker**?',o:['Session 1','Session 2','Session 3','You'],a:0,why:'It holds the lock.',lec:5},
{q:'What do you do **before** killing?',o:['Try to reach the owner','Restart the database','Drop the table','Nothing'],a:0,why:'Least impact.',lec:5},
{q:'What belongs in the **incident note**?',o:['Cause, impact, time, prevention','Only the user name','Nothing','Passwords'],a:0,why:'Learn from it.',lec:5},
{q:'Which setting limits **DDL waiting** on locks?',o:['DDL_LOCK_TIMEOUT','OPEN_CURSORS','UNDO_RETENTION','SGA_TARGET'],a:0,why:'Avoid long waits.',lec:5},
{q:'What should **monitoring** alert on?',o:['Sessions blocked for several minutes','Every commit','Every logon','Nothing'],a:0,why:'Catch chains early.',lec:5}
]};
