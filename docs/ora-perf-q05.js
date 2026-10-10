/* LearnSphere - Performance quiz, Section 05: Execution Plans & SQL Diagnostics.
   window.QUIZZES['ora-perf:4']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-perf:4']={qs:[
{q:'In which order is a plan **read**?',o:['Innermost, most indented step first','Top line only','Bottom line only','Alphabetically'],a:0,why:'Children run before parents.',lec:0},
{q:'What does **EXPLAIN PLAN** show?',o:['The expected plan','The executed plan always','Row counts','Waits'],a:0,why:'Use the cursor cache for actual.',lec:0},
{q:'What is **E-Rows**?',o:['Estimated rows','Executed rows','Errors','Elapsed'],a:0,why:'Compare with A-Rows.',lec:0},
{q:'What do **access** and **filter** predicates show?',o:['Where conditions are applied','Backups','Users','Memory'],a:0,why:'Under predicate information.',lec:0},
{q:'Is a **full scan** always bad?',o:['No, it is best when many rows are needed','Yes','Only for small tables','Only in RAC'],a:0,why:'About 30% of rows may favor it.',lec:1},
{q:'Why does `WHERE TRUNC(d)=...` **disable** an index?',o:['A function on the column hides the index','TRUNC is slow','Dates are not indexed','Full scans are faster'],a:0,why:'Rewrite as range.',lec:1},
{q:'Which scan reads the **whole index** with multiblock reads?',o:['INDEX FAST FULL SCAN','INDEX UNIQUE SCAN','INDEX RANGE SCAN','TABLE ACCESS FULL'],a:0,why:'Unordered.',lec:1},
{q:'What disables an index by **type mismatch**?',o:['Comparing a string column to a number','Using binds','Using a view','Using hints'],a:0,why:'Implicit conversion.',lec:1},
{q:'Which join needs an **index on the inner** table?',o:['Nested loops','Hash','Sort merge','Cartesian'],a:0,why:'Probes per outer row.',lec:2},
{q:'Which join builds a **hash table in memory**?',o:['Hash join','Nested loops','Sort merge','None'],a:0,why:'Spills to temp if large.',lec:2},
{q:'Nested loops with a **big outer** is:',o:['A classic disaster','Ideal','Always used','Free'],a:0,why:'Cost grows with outer rows.',lec:2},
{q:'How should you fix a **bad join method** choice?',o:['Fix estimates or SQL','Force with hints always','Add CPUs','Restart'],a:0,why:'The optimizer then chooses better.',lec:2},
{q:'Which function shows the **real plan** from cache?',o:['DBMS_XPLAN.DISPLAY_CURSOR','EXPLAIN PLAN','DESCRIBE','LIST'],a:0,why:'Use ALLSTATS LAST.',lec:3},
{q:'Which format shows **actual rows**?',o:['ALLSTATS LAST','TYPICAL','BASIC','SERIAL'],a:0,why:'Needs plan statistics.',lec:3},
{q:'Where do you find **older plans**?',o:['DISPLAY_AWR','V$SESSION','V$LOG','DBA_USERS'],a:0,why:'AWR keeps history.',lec:3},
{q:'Which hint gathers **row statistics** for a test?',o:['gather_plan_statistics','full','parallel','index'],a:0,why:'Overhead, use in test.',lec:3},
{q:'SQL Monitor tracks SQL that is:',o:['Long-running or parallel','Every SQL','Only DDL','Only PL/SQL'],a:0,why:'Over 5 seconds of CPU or I/O.',lec:4},
{q:'SQL Monitor needs which **pack**?',o:['Tuning Pack','Compression','Partitioning','Spatial'],a:0,why:'Plus Diagnostics.',lec:4},
{q:'What does SQL Monitor show **per plan line**?',o:['Time and actual rows','Backup status','Users','Index names only'],a:0,why:'Best single tool for one SQL.',lec:4},
{q:'Which package **enables trace** for a session?',o:['DBMS_MONITOR','DBMS_STATS','DBMS_LOCK','DBMS_JOB'],a:0,why:'SESSION_TRACE_ENABLE.',lec:5},
{q:'What formats a **trace file**?',o:['TKPROF','RMAN','DBVERIFY','OPatch'],a:0,why:'Command line tool.',lec:5},
{q:'A big gap between **elapsed and CPU** means:',o:['Waiting','Fast SQL','No work','Compression'],a:0,why:'Check the wait summary.',lec:5},
{q:'What is **bind peeking**?',o:['Using the first bind value to estimate rows at hard parse','Reading memory','Copying binds','Hiding binds'],a:0,why:'Plan depends on first value.',lec:6},
{q:'What does **bind-aware** mean?',o:['Different plans for different bind ranges','No binds used','Locked cursor','Parallel'],a:0,why:'Adaptive cursor sharing.',lec:6},
{q:'A SQL **alternates** fast and slow with the same text. Suspect:',o:['Bind peeking on skewed data','Network','Backups','Users'],a:0,why:'Check child cursors.',lec:6},
{q:'In the practical, which fix applies to **row-by-row** loops?',o:['Set-based SQL or array processing','A bigger SGA','More CPUs','A hint'],a:0,why:'Reduce calls.',lec:7}
]};
