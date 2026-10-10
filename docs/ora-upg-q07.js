/* LearnSphere - Upgrade quiz, Section 07: Upgrade & Patching Capstone.
   window.QUIZZES['ora-upg:6']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-upg:6']={qs:[
{q:'What is a **runbook**?',o:['Ordered steps with owners, commands, checks and fallback','A backup','A log','A license'],a:0,why:'Used under pressure.',lec:0},
{q:'When do you **freeze** the runbook?',o:['Before the change','After','Never','During'],a:0,why:'Stable plan.',lec:0},
{q:'What if a step is **not** in the runbook?',o:['Add it, with a reason, to the log','Do it silently','Ignore the runbook','Stop everything'],a:0,why:'Record deviations.',lec:0},
{q:'Who reviews the runbook?',o:['A second engineer','Nobody','Only the author','Management only'],a:0,why:'Fresh eyes.',lec:0},
{q:'What do **functional** tests prove?',o:['Application features work','Disk speed','Network speed','Licenses'],a:0,why:'Plus performance.',lec:1},
{q:'Which tool compares **SQL before and after**?',o:['SPA','RMAN','OPatch','TKPROF'],a:0,why:'Real Application Testing.',lec:1},
{q:'When should **acceptance criteria** be agreed?',o:['Before the test','After the test','Never','During the incident'],a:0,why:'Avoid opinion debates.',lec:1},
{q:'What fixes **regressions**?',o:['Statistics, SPM baselines, SQL tuning','Reboot','Add disks','Nothing'],a:0,why:'Standard toolbox.',lec:1},
{q:'Who **decides** rollback?',o:['The named decision maker','The executor alone','Anyone','No one'],a:0,why:'Pre-agreed.',lec:2},
{q:'What is the **latest go time**?',o:['Time after which finishing plus fallback no longer fits','The start','Midnight','The end'],a:0,why:'Set in advance.',lec:2},
{q:'What belongs in the **change record**?',o:['Plan, log, evidence, lessons','Passwords','Only the date','Nothing'],a:0,why:'Audit and learning.',lec:2},
{q:'Whom do you inform **weeks before**?',o:['Users and application owners','Nobody','Only DBAs','Only vendors'],a:0,why:'Plan their testing.',lec:2},
{q:'What must be **rehearsed** in the capstone?',o:['The whole procedure on a copy','Only upgrade','Only backups','Nothing'],a:0,why:'Measure the real downtime.',lec:3},
{q:'What is created on **both sites** before the change?',o:['Restore points and backups','New users','New tablespaces','Nothing'],a:0,why:'Fallback.',lec:3},
{q:'When is **COMPATIBLE** raised?',o:['After stabilization','Before','At once','Never'],a:0,why:'Point of no downgrade.',lec:3},
{q:'What does Data Guard acceptance include?',o:['Redo apply works and switchover succeeds','Only backup','Only listener','Nothing'],a:0,why:'Standby verified.',lec:3},
{q:'Which self-assessment level means you **rolled back once**?',o:['Solid','Foundation','Ready','None'],a:0,why:'Rehearsed failures.',lec:3},
{q:'Which shows the target **PDB is open**?',o:['V$PDBS','V$LOG','DBA_USERS','V$LOCK'],a:0,why:'READ WRITE.',lec:3},
{q:'Is **downtime** measured?',o:['Yes, against the budget','No','Only guessed','Only by users'],a:0,why:'Evidence.',lec:3},
{q:'What should the **decision** after verification be?',o:['Go forward or roll back','Wait forever','Ignore','Retest forever'],a:0,why:'Based on criteria.',lec:3},
{q:'What combination do the capstone notes mention?',o:['Backup, Data Guard, GoldenGate and Upgrade','Only RMAN','Only SQL','Only OS'],a:0,why:'A real project uses many.',lec:3}
]};
