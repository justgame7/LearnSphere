/* LearnSphere - Performance quiz, Section 04: Optimizer Fundamentals & Statistics.
   window.QUIZZES['ora-perf:3']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-perf:3']={qs:[
{q:'What does the **CBO** choose?',o:['The cheapest estimated plan','The newest plan','A random plan','The first plan'],a:0,why:'Based on cost estimates.',lec:0},
{q:'What is the root of **most bad plans**?',o:['Wrong cardinality estimates','Too much memory','Fast disks','Many users'],a:0,why:'Check estimated versus actual rows.',lec:0},
{q:'Which are **optimizer inputs**?',o:['Object statistics','System statistics','Parameters','Bind values'],a:[0,1,2,3],why:'All affect the plan.',lec:0},
{q:'What should you ask **first** about a bad plan?',o:['Were estimated rows close to actual rows?','Is the disk full?','Who wrote it?','What time is it?'],a:0,why:'Points to statistics or design.',lec:0},
{q:'Which view shows **table statistics**?',o:['DBA_TAB_STATISTICS','DBA_USERS','V$SESSION','DBA_JOBS'],a:0,why:'Includes last_analyzed.',lec:1},
{q:'What is the **clustering factor**?',o:['How scattered rows are relative to index order','Index size','Table size','Row length'],a:0,why:'Near blocks is good.',lec:1},
{q:'What happens with **stale** statistics?',o:['Wrong plans','Faster plans','No effect','Errors'],a:0,why:'Row counts are wrong.',lec:1},
{q:'Which package should you use to **gather** statistics?',o:['DBMS_STATS','ANALYZE','DBMS_JOB','UTL_FILE'],a:0,why:'ANALYZE is legacy.',lec:2},
{q:'What is the recommended **ESTIMATE_PERCENT**?',o:['AUTO_SAMPLE_SIZE','1','100 always','0'],a:0,why:'Accurate and fast.',lec:2},
{q:'Why not gather **every night** blindly?',o:['It invalidates cursors and may change good plans','It is illegal','It deletes data','It stops RMAN'],a:0,why:'Gather when data changed.',lec:2},
{q:'Which option gathers only **changed partitions**?',o:['INCREMENTAL','CASCADE','DEGREE','GRANULARITY ALL'],a:0,why:'For partitioned tables.',lec:2},
{q:'When is a **histogram** useful?',o:['Skewed data','Unique keys only','Empty tables','Never'],a:0,why:'Better estimates.',lec:3},
{q:'What do **extended statistics** help with?',o:['Correlated columns and expressions','Backups','Locks','Network'],a:0,why:'Column groups.',lec:3},
{q:'Which function creates a **column group**?',o:['DBMS_STATS.CREATE_EXTENDED_STATS','ANALYZE TABLE','CREATE INDEX','ALTER TABLE'],a:0,why:'Then gather.',lec:3},
{q:'What does **locking statistics** do?',o:['Prevents gathering for that table','Deletes statistics','Compresses','Moves the table'],a:0,why:'Stable data.',lec:4},
{q:'What are **pending statistics**?',o:['Gathered but unpublished, test first','Deleted','Old','System only'],a:0,why:'Safe change process.',lec:4},
{q:'Which parameter lets a session **use pending** statistics?',o:['optimizer_use_pending_statistics','optimizer_mode','cursor_sharing','sga_target'],a:0,why:'Test queries safely.',lec:4},
{q:'How long is **statistics history** kept by default?',o:['31 days','1 day','1 year','Forever'],a:0,why:'Restore if worse.',lec:4},
{q:'Which is the safest place to **test** a parameter change?',o:['A session','The whole system','The OS','The listener'],a:0,why:'System-wide changes affect every plan.',lec:5},
{q:'What does **OPTIMIZER_FEATURES_ENABLE** control?',o:['Which optimizer version behavior is used','Memory','Redo','Users'],a:0,why:'Helps during upgrades.',lec:5},
{q:'Should you set **DB_FILE_MULTIBLOCK_READ_COUNT**?',o:['Leave unset so Oracle tunes it','Always 128','Always 1','Always 1024'],a:0,why:'Default is self-tuned.',lec:5},
{q:'In the practical, why was the first plan **wrong**?',o:['Statistics said the table was tiny','The index was broken','Memory','Network'],a:0,why:'Forced bad numbers.',lec:6},
{q:'After a histogram, the query for the **rare** value should use:',o:['Index range scan','Full scan','Hash join','Cartesian'],a:0,why:'Few rows.',lec:6},
{q:'In the practical, what did you **change** to fix the plan?',o:['The statistics, not the SQL','The SQL','The disk','The user'],a:0,why:'Cheapest fix.',lec:6},
{q:'Which command shows the **plan** without running the query?',o:['EXPLAIN PLAN with DBMS_XPLAN.DISPLAY','SELECT *','ANALYZE','TRUNCATE'],a:0,why:'Estimated plan.',lec:6}
]};
