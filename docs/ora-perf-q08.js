/* LearnSphere - Performance quiz, Section 08: Instance & Memory Tuning.
   window.QUIZZES['ora-perf:7']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-perf:7']={qs:[
{q:'Which memory area is **shared** by all sessions?',o:['SGA','PGA','Session','Private'],a:0,why:'PGA is per session.',lec:0},
{q:'Which parameter sets a **hard limit** on PGA?',o:['PGA_AGGREGATE_LIMIT','PGA_AGGREGATE_TARGET','SGA_TARGET','MEMORY_TARGET'],a:0,why:'Target is soft.',lec:0},
{q:'Which is preferred on **Linux with HugePages**?',o:['SGA_TARGET (ASMM)','MEMORY_TARGET','Neither','Both'],a:0,why:'AMM does not use HugePages.',lec:0},
{q:'When should you **increase memory**?',o:['When advisors show a gain in DB Time','Always','Never','After a backup'],a:0,why:'Evidence first.',lec:0},
{q:'What does the **buffer cache** hold?',o:['Data blocks','SQL cursors','Redo','Undo only'],a:0,why:'Shared pool holds cursors.',lec:1},
{q:'Which advisor shows **buffer cache** sizing?',o:['V$DB_CACHE_ADVICE','V$SGA_TARGET_ADVICE','V$PGA_TARGET_ADVICE','V$LOG'],a:0,why:'Estimated physical reads.',lec:1},
{q:'ORA-04031 usually points to:',o:['Too many literals or fragmentation','Full disk','Network','Locks'],a:0,why:'Shared pool problem.',lec:1},
{q:'Should you **target the hit ratio**?',o:['No, reduce logical reads first','Yes always 100%','Only at night','Only for tables'],a:0,why:'Ratios mislead.',lec:1},
{q:'A **hard parse** is:',o:['Full compile and optimize','Reusing a cursor','A commit','A flush'],a:0,why:'Expensive.',lec:2},
{q:'What is the **real fix** for literal SQL?',o:['Bind variables in the application','Bigger shared pool','More CPUs','Restart'],a:0,why:'CURSOR_SHARING is a stopgap.',lec:2},
{q:'Which parameter caches cursors **per session**?',o:['SESSION_CACHED_CURSORS','OPEN_CURSORS','SGA_TARGET','CURSOR_SPACE'],a:0,why:'Reduces soft parse cost.',lec:2},
{q:'What does **log file sync** measure?',o:['Commit wait for redo to be written','Archiving','Checkpoint','Backup'],a:0,why:'LGWR write latency.',lec:3},
{q:'High **log file sync** with fast parallel write suggests:',o:['Too many commits or CPU starvation','Slow disk','Full FRA','Network'],a:0,why:'Check the application.',lec:3},
{q:'How often should logs **switch** at peak?',o:['About every 15 to 30 minutes','Every second','Daily','Never'],a:0,why:'Size accordingly.',lec:3},
{q:'What is `checkpoint incomplete`?',o:['Logs too small or too few','Disk full','Network','Locks'],a:0,why:'Add or enlarge logs.',lec:3},
{q:'What causes **ORA-01555**?',o:['Undo overwritten before a long query finished','Temp full','Lock','Network'],a:0,why:'Snapshot too old.',lec:4},
{q:'Which view shows **temp use** by session?',o:['V$TEMPSEG_USAGE','V$LOG','V$LOCK','V$PARAMETER'],a:0,why:'Join with V$SESSION.',lec:4},
{q:'Large temp use is often a **symptom** of:',o:['A bad plan','A small log','A network issue','An old OS'],a:0,why:'Fix the plan.',lec:4},
{q:'`latch: cache buffers chains` suggests:',o:['Hot blocks','Redo','Network','Backups'],a:0,why:'Find the SQL and segment.',lec:5},
{q:'How do you fix **latch** contention best?',o:['Reduce logical reads and parses','Change latch parameters','Add disks','Reboot'],a:0,why:'Reduce the work.',lec:5},
{q:'When **DB CPU** is most of DB Time, you tune:',o:['SQL by CPU','Disk','Network','Redo'],a:0,why:'Find top CPU SQL.',lec:5},
{q:'What does **Resource Manager** use to group sessions?',o:['Consumer groups','Tablespaces','Roles only','Schemas'],a:0,why:'Mapped by user, service, program.',lec:6},
{q:'When does a plan **act**?',o:['When resources are scarce','Always','Never','At startup only'],a:0,why:'Shares matter under contention.',lec:6},
{q:'In a CDB, Resource Manager also shares among:',o:['PDBs','Datafiles','Users only','Nothing'],a:0,why:'Shares and limits.',lec:6},
{q:'In the practical, what shows PGA is **too small**?',o:['Over-allocation count in the PGA advice','Redo size','Log switches','Index size'],a:0,why:'ESTD_OVERALLOC_COUNT.',lec:7},
{q:'When do you **stop** adding memory?',o:['When DB Time no longer falls','Never','After 1 GB','At 100%'],a:0,why:'Diminishing return.',lec:7}
]};
