/* LearnSphere - SQL Server High Availability & DR quiz, Section 1: HA/DR Concepts.
   Format: see pg-quiz.js. window.QUIZZES['mss-ha:0']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-ha:0']={qs:[
{q:'What does **RPO** describe?',
 o:['Maximum acceptable data loss, as time','Maximum acceptable downtime','Number of replicas','Network speed'],
 a:0,why:'RPO is how much data you can afford to lose. RTO is how long you can be down.',lec:0},
{q:'What does **RTO** describe?',
 o:['Maximum acceptable time to restore service','Maximum data loss','Backup size','Number of nodes'],
 a:0,why:'RTO is the recovery time objective.',lec:0},
{q:'About how much downtime per year does **99.99%** availability allow?',
 o:['About 52 minutes','About 8.8 hours','About 5 minutes','About 3.65 days'],
 a:0,why:'99.99 percent is roughly 52 minutes per year. 99.9 percent is 8.8 hours.',lec:0},
{q:'Why do HA and DR **not replace backups**?',
 o:['They copy mistakes such as a dropped table','They are always slower','They need more licenses','They are not allowed'],
 a:0,why:'A change on the primary, including a mistake, is sent to the replicas.',lec:1},
{q:'Which failure is **DR** designed for?',
 o:['Loss of a whole site or region','A single query','A missing index','An expired password'],
 a:0,why:'DR addresses loss of the primary site and needs copies elsewhere.',lec:1},
{q:'Which feature protects the **whole instance**, including jobs and logins?',
 o:['Failover cluster instance','Availability group','Log shipping','Replication'],
 a:0,why:'An FCI fails over the entire instance, so server-level objects move with it.',lec:2},
{q:'Which feature offers a **readable secondary** copy with separate storage?',
 o:['Availability group (Enterprise)','FCI','Basic log shipping only','Backup'],
 a:0,why:'AGs keep their own copy on each replica and can make secondaries readable.',lec:2},
{q:'Which edition allows a **basic availability group**?',
 o:['Standard','Express','Web only','Evaluation only'],
 a:0,why:'Basic AGs are the Standard edition HA option, with limits.',lec:3},
{q:'What should you do before building because **licensing** may differ?',
 o:['Confirm current product terms and Software Assurance benefits','Skip it','Assume passive is free','Ask the network team'],
 a:0,why:'Rules for passive replicas have conditions and change by version and model.',lec:3}
]};
