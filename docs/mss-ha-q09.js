/* LearnSphere - SQL Server High Availability & DR quiz, Section 9: Disaster Recovery Planning.
   Format: see pg-quiz.js. window.QUIZZES['mss-ha:8']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-ha:8']={qs:[
{q:'A DR plan should start from:',
 o:['Business impact analysis and agreed RPO and RTO','Choosing the product','The cheapest option','The network diagram'],
 a:0,why:'The business decides what matters and how fast, and technology follows.',lec:0},
{q:'Why group systems into **tiers**?',
 o:['Different systems justify different investment','To use fewer servers','To avoid testing','To avoid backups'],
 a:0,why:'Tiers match cost and effort to business impact.',lec:0},
{q:'What must a **runbook** contain?',
 o:['Exact steps, verification and contacts','Only a policy','Only diagrams','Only vendor names'],
 a:0,why:'Runbooks must be actionable under stress.',lec:1},
{q:'Where should a **copy of the runbook** be kept?',
 o:['Outside the system it describes','Only on the failed server','Only on paper in the same room','Only in email drafts'],
 a:0,why:'If the documentation is in the failed site, no one can read it.',lec:1},
{q:'Which test is the **lowest effort**?',
 o:['Tabletop exercise','Full DR exercise','Failback test','Production failover'],
 a:0,why:'A tabletop is a discussion of the plan with the people involved.',lec:2},
{q:'What is the **main value** of DR testing?',
 o:['Finding real gaps and measuring real RTO and RPO','Passing an audit only','Using hardware','Training the network team only'],
 a:0,why:'Tests reveal what the plan missed and what recovery really takes.',lec:2},
{q:'Why must **failback** be planned?',
 o:['It is another outage and has its own risks','It is automatic','It is not needed','It is free'],
 a:0,why:'Moving back is a change with downtime and data resync.',lec:3},
{q:'Which approach reverses direction **cleanly** with an AG?',
 o:['Make the old primary a secondary, resync, then planned failover','Delete and recreate everything','Restore from tape only','Use replication'],
 a:0,why:'Resynchronizing first allows a planned failover with no data loss.',lec:3}
]};
