/* LearnSphere - Performance quiz, Section 01: Performance Foundations & Method.
   window.QUIZZES['ora-perf:0']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-perf:0']={qs:[
{q:'What is the **first step** of the tuning method?',o:['Measure','Change parameters','Add CPUs','Restart'],a:0,why:'Baseline and symptom.',lec:0},
{q:'How many **changes at a time**?',o:['One','As many as possible','Ten','All'],a:0,why:'Otherwise you cannot tell what helped.',lec:0},
{q:'What do you tune **first**?',o:['The application and SQL','Hardware','The OS','Network cables'],a:0,why:'Most problems are SQL and design.',lec:0},
{q:'What defines **success**?',o:['A number, such as under 30 seconds','It feels fast','Nothing','More CPU'],a:0,why:'Measurable goals.',lec:0},
{q:'What is **DB Time**?',o:['CPU time plus non-idle wait time of sessions','Wall clock','Backup time','Only CPU'],a:0,why:'Reduce DB Time to speed users.',lec:1},
{q:'What does **AAS** equal?',o:['DB Time divided by elapsed time','CPU cores','Sessions logged in','Wait count'],a:0,why:'Compare with number of cores.',lec:1},
{q:'Which are **wait classes**?',o:['User I/O','Concurrency','Commit','Idle'],a:[0,1,2,3],why:'All are classes.',lec:1},
{q:'How do you judge a **wait event**?',o:['By its share of DB Time','By its name','By its length of text','By alphabet'],a:0,why:'Not all waits matter.',lec:1},
{q:'What is a **baseline**?',o:['A saved set of normal numbers','A backup','An index','A user'],a:0,why:'Compare with normal.',lec:2},
{q:'When should you take a baseline?',o:['Before every change','Never','After the outage only','Only yearly'],a:0,why:'To show what a change did.',lec:2},
{q:'What does **proactive** tuning mean?',o:['Find problems before users do','Wait for complaints','Reboot nightly','Add memory'],a:0,why:'Uses history and thresholds.',lec:2},
{q:'Which tool shows **one SQL** running now?',o:['SQL Monitor','AWR','ADDM','Statspack'],a:0,why:'Needs the Tuning Pack.',lec:3},
{q:'Which samples sessions **every second**?',o:['ASH','AWR snapshots','Statspack levels','EXPLAIN'],a:0,why:'Active Session History.',lec:3},
{q:'Which analyses an AWR period and **recommends**?',o:['ADDM','V$SESSION','TKPROF','Export'],a:0,why:'Automatic Database Diagnostic Monitor.',lec:3},
{q:'Which pack contains **AWR and ASH**?',o:['Diagnostics Pack','Tuning Pack','Advanced Security','RAT only'],a:0,why:'Licensed option.',lec:4},
{q:'Which pack requires the **Diagnostics Pack**?',o:['Tuning Pack','Partitioning','Compression','RAC'],a:0,why:'SQL Monitor, Tuning Advisor.',lec:4},
{q:'Which is a **free** alternative to AWR?',o:['Statspack','ADDM','ASH','SQL Access Advisor'],a:0,why:'Included, no pack.',lec:4},
{q:'Which parameter **disables** pack use?',o:['CONTROL_MANAGEMENT_PACK_ACCESS','OPTIMIZER_MODE','SGA_TARGET','DB_FILES'],a:0,why:'Set to NONE.',lec:4},
{q:'A typical **OLTP** wait is:',o:['Commit and row locks','Large parallel scans','Temp for sorts only','None'],a:0,why:'Short transactions.',lec:5},
{q:'Which helps **analytics** most?',o:['Partitioning and parallel execution','Bitmap logging','More sessions','Smaller blocks'],a:0,why:'Scans and aggregates.',lec:5},
{q:'What protects OLTP from **reports** on a mixed system?',o:['Resource Manager','Larger SGA only','More indexes','Restart'],a:0,why:'Prioritize workloads.',lec:5},
{q:'In the practical, what do you create **before and after** the workload?',o:['AWR snapshots','Backups','Users','Indexes'],a:0,why:'To get a report.',lec:6},
{q:'Which view lists **snapshots**?',o:['DBA_HIST_SNAPSHOT','V$SESSION','DBA_USERS','V$LOG'],a:0,why:'Use the IDs for a baseline.',lec:6},
{q:'Which script produces an **AWR report**?',o:['awrrpt.sql','catalog.sql','utlrp.sql','dbmspool.sql'],a:0,why:'In rdbms/admin.',lec:6}
]};
