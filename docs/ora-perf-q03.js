/* LearnSphere - Performance quiz, Section 03: AWR, ADDM & Active Session History.
   window.QUIZZES['ora-perf:2']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-perf:2']={qs:[
{q:'What is the default AWR **snapshot interval**?',o:['60 minutes','5 minutes','24 hours','1 minute'],a:0,why:'Default retention is 8 days.',lec:0},
{q:'Where is AWR **stored**?',o:['SYSAUX','SYSTEM','TEMP','UNDO'],a:0,why:'Watch its growth.',lec:0},
{q:'Which procedure changes **interval and retention**?',o:['MODIFY_SNAPSHOT_SETTINGS','CREATE_BASELINE','DROP_SNAPSHOT_RANGE','ADD_COLORED_SQL'],a:0,why:'In DBMS_WORKLOAD_REPOSITORY.',lec:0},
{q:'Why take a **manual snapshot**?',o:['Exact boundaries for a test or problem','To free memory','To backup','To patch'],a:0,why:'Cleaner reports.',lec:0},
{q:'What do you read **first** in an AWR report?',o:['Summary and DB Time versus cores','Parameter list','Segment stats','Dictionary'],a:0,why:'Then load profile, events, SQL.',lec:1},
{q:'Is **buffer hit ratio** a good tuning target?',o:['No, it can mislead','Yes always','Only at night','Only in RAC'],a:0,why:'A high ratio can still be slow.',lec:1},
{q:'Which report is for **RAC**?',o:['awrgrpt.sql','awrrpt.sql','ashrpt.sql','addmrpt.sql'],a:0,why:'Global report.',lec:1},
{q:'Which section is **the core**?',o:['Top foreground events','Header','Footer','Alert log'],a:0,why:'Share of DB Time.',lec:1},
{q:'When is **ASH** better than AWR?',o:['A short spike','A trend over months','A backup issue','Licensing'],a:0,why:'AWR averages over an hour.',lec:2},
{q:'Which script produces an **ASH report**?',o:['ashrpt.sql','awrrpt.sql','addmrpt.sql','awrddrpt.sql'],a:0,why:'In rdbms/admin.',lec:2},
{q:'Which are ASH **dimensions**?',o:['SQL_ID','EVENT','MODULE','SESSION_ID'],a:[0,1,2,3],why:'All can be grouped.',lec:2},
{q:'What does **ADDM** produce?',o:['Findings and recommendations ranked by DB Time','A backup','An index','A user'],a:0,why:'Runs after each snapshot.',lec:3},
{q:'How should you treat an ADDM **recommendation**?',o:['As a hint to validate','As an order','Ignore always','Apply blindly'],a:0,why:'Check before applying.',lec:3},
{q:'What does an ADDM finding **impact** show?',o:['Share of DB Time','Disk size','User count','Port'],a:0,why:'Ranked by impact.',lec:3},
{q:'Which baseline type is the **last N days**?',o:['Moving window','Fixed','Template','Archive'],a:0,why:'Used for adaptive thresholds.',lec:4},
{q:'Why create a **fixed baseline**?',o:['Protect a period from purging','Increase speed','Reduce size','Disable ASH'],a:0,why:'Keep a known good or peak.',lec:4},
{q:'What does a **repeating template** do?',o:['Creates baselines on a schedule','Deletes logs','Changes SQL','Starts ADDM'],a:0,why:'For example weekly.',lec:4},
{q:'Which script **compares periods**?',o:['awrddrpt.sql','awrrpt.sql','ashrpt.sql','awrinfo.sql'],a:0,why:'Compare Periods report.',lec:5},
{q:'Which comparison is **valid**?',o:['Same weekday and hours','Monday morning versus Sunday night','Any two','Only random'],a:0,why:'Compare like with like.',lec:5},
{q:'Which in a compare report may reveal a **parameter** change?',o:['Init parameter differences','Load profile','Top SQL','Wait histogram'],a:0,why:'Someone changed settings.',lec:5},
{q:'Which parameter enables **AWR snapshots in a PDB**?',o:['AWR_PDB_AUTOFLUSH_ENABLED','AWR_PDB','SNAPSHOT_PDB','PDB_AWR'],a:0,why:'Then set interval.',lec:6},
{q:'What does `AWR_PDB_*` show?',o:['Data of one PDB','Root only','All CDB','OS data'],a:0,why:'CDB views are AWR_CDB_*.',lec:6},
{q:'What in the practical **caused** the regression?',o:['A dropped index','A new user','A bigger SGA','A restart'],a:0,why:'Full scans appeared.',lec:7},
{q:'What top event do you expect after the **drop**?',o:['db file scattered read','log file sync','latch free','idle'],a:0,why:'Full scans.',lec:7},
{q:'How do you **verify** the fix?',o:['Recreate the index, run again and compare','Guess','Restart','Nothing'],a:0,why:'Measure again.',lec:7}
]};
