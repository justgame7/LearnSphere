/* LearnSphere - SQL Server High Availability & DR quiz, Section 10: Capstone.
   Format: see pg-quiz.js. window.QUIZZES['mss-ha:9']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-ha:9']={qs:[
{q:'What should pass before the capstone **cluster** is used?',
 o:['Validate Configuration','A backup only','A restore only','Statistics update'],
 a:0,why:'A clean validation report is the basis for a supported cluster.',lec:0},
{q:'How should test connections reach the AG?',
 o:['Through the listener','Through node names','Through the witness','Through the endpoint port'],
 a:0,why:'The listener always points to the current primary.',lec:0},
{q:'In the capstone, how do you measure **failover impact**?',
 o:['Time to first successful application query','CPU temperature','Backup size','Number of logins'],
 a:0,why:'Application recovery time is what the business experiences.',lec:0},
{q:'During a **network partition**, what decides which side keeps running?',
 o:['Quorum','The alphabet','The listener name','The backup job'],
 a:0,why:'Only the side with a majority of votes keeps the cluster roles.',lec:1},
{q:'What is a **good runbook structure**?',
 o:['Detect, decide, act, verify, report','Only act','Only report','Only verify'],
 a:0,why:'A complete runbook covers recognition through communication.',lec:1},
{q:'Which are **production readiness** items?',
 o:['Alerts on health and queue sizes','Tested rolling patch procedure','Logins and jobs synchronized','Default passwords left in place'],
 a:[0,1,2],why:'Default passwords are never acceptable. The other items are readiness checks.',lec:2}
]};
