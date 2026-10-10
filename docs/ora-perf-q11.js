/* LearnSphere - Performance quiz, Section 11: Proactive Management & Capstone.
   window.QUIZZES['ora-perf:10']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-perf:10']={qs:[
{q:'What is the point of **thresholds**?',o:['To be warned before users complain','To slow the database','To delete data','To lock users'],a:0,why:'Proactive.',lec:0},
{q:'Which package sets **server alert** thresholds?',o:['DBMS_SERVER_ALERT','DBMS_STATS','DBMS_LOCK','UTL_FILE'],a:0,why:'SET_THRESHOLD.',lec:0},
{q:'Which view shows **outstanding alerts**?',o:['DBA_OUTSTANDING_ALERTS','V$LOG','V$LOCK','DBA_USERS'],a:0,why:'Active alerts.',lec:0},
{q:'An alert nobody acts on is:',o:['Noise','Useful','Required','Free'],a:0,why:'Start small and tune.',lec:0},
{q:'Capacity plans use:',o:['Trends','Feelings','Averages only','Guesses'],a:0,why:'Plan with peaks.',lec:1},
{q:'Which view has **tablespace size history**?',o:['DBA_HIST_TBSPC_SPACE_USAGE','V$SESSION','V$LOG','DBA_JOBS'],a:0,why:'In AWR.',lec:1},
{q:'Should you plan with **peaks or averages**?',o:['Peaks','Averages','Minimum','Random'],a:0,why:'Plus lead time.',lec:1},
{q:'What should you add to growth projections?',o:['Planned business events','Nothing','Random numbers','Old logs'],a:0,why:'New customers, releases.',lec:1},
{q:'How many changes **at a time**?',o:['One','All','Ten','None'],a:0,why:'So you know the effect.',lec:2},
{q:'Which tool compares **SQL before and after** a change?',o:['SQL Performance Analyzer','Data Pump','RMAN','OPatch'],a:0,why:'Part of Real Application Testing.',lec:2},
{q:'Which replays a **captured workload**?',o:['Database Replay','AWR','ASH','Statspack'],a:0,why:'On a test system.',lec:2},
{q:'What should every change test include?',o:['Top SQL and key transactions','Only a ping','Nothing','Only memory'],a:0,why:'Representative.',lec:2},
{q:'What does a **performance runbook** start with?',o:['Triage: who, since when, what changed','A restart','A backup','Updates'],a:0,why:'Numbers first.',lec:3},
{q:'How long should a runbook be?',o:['One or two pages usable at 3 a.m.','100 pages','One word','Unlimited'],a:0,why:'Usability.',lec:3},
{q:'Who approves **safe actions**?',o:['A defined owner in the runbook','Nobody','Anyone','The user'],a:0,why:'Specified in advance.',lec:3},
{q:'What is the **first** capstone step?',o:['Define the symptom and baseline','Add CPUs','Restart','Drop indexes'],a:0,why:'Measure first.',lec:4},
{q:'What protects OLTP from **reports**?',o:['Resource Manager','Bigger SGA','More indexes','Reboot'],a:0,why:'Shares per group.',lec:4},
{q:'Which fix goes **first**?',o:['The highest impact cause','The easiest','The newest','The oldest'],a:0,why:'By DB Time.',lec:4},
{q:'How do you **verify** success?',o:['Compare with the baseline','Ask one user','Restart','Nothing'],a:0,why:'Same measure.',lec:4},
{q:'Which self-assessment says **another DBA can repeat** it?',o:['Ready','Foundation','Solid','None'],a:0,why:'Runbook quality.',lec:4},
{q:'Which metric warns of **bottleneck** emergence?',o:['A wait with a high share of DB Time','The server name','The OS name','The DBID'],a:0,why:'Compare with baseline.',lec:0},
{q:'What threshold is typical for **space**?',o:['80% warning, 90% critical','5%','100% only','None'],a:0,why:'Leave time to react.',lec:0},
{q:'What should you do **monthly**?',o:['Review capacity, SQL and incidents','Reinstall','Drop everything','Nothing'],a:0,why:'Continuous improvement.',lec:3},
{q:'After a fix you **document**:',o:['Reason, change and rollback','Nothing','Passwords','Only the date'],a:0,why:'Future you needs it.',lec:4}
]};
