/* LearnSphere - SQL Server Azure SQL & Hybrid quiz, Section 7: DP-300 Exam Preparation.
   Format: see pg-quiz.js. window.QUIZZES['mss-az:6']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-az:6']={qs:[
{q:'Which certification does **DP-300** lead to?',
 o:['Azure Database Administrator Associate','Azure Fundamentals','Azure Solutions Architect','Data Scientist'],
 a:0,why:'DP-300 is the exam for the Azure Database Administrator Associate certification.',lec:0},
{q:'Where should you confirm **current exam weightings**?',
 o:['The official skills measured and study guide','A blog from 2019','A forum post','Memory'],
 a:0,why:'Weightings and skills change with updates.',lec:0},
{q:'An app needs SQL Agent and cross-database queries with minimal admin. Which platform?',
 o:['Managed Instance','SQL Database single','Cosmos DB','Storage account'],
 a:0,why:'MI provides these instance features as PaaS.',lec:1},
{q:'A single database with **unpredictable, intermittent** usage. Which option?',
 o:['SQL Database serverless','Hyperscale','Business Critical provisioned','VM'],
 a:0,why:'Serverless pauses and bills per second.',lec:1},
{q:'Which feature **hides data from admins**?',
 o:['Always Encrypted','TDE','Dynamic Data Masking','Firewall'],
 a:0,why:'Always Encrypted keeps keys away from the service and admins.',lec:2},
{q:'Which tool **forces a previous plan** after a regression?',
 o:['Query Store','Query Performance Insight only','Azure Advisor','Resource Governor'],
 a:0,why:'Query Store lets you force a plan, or use automatic plan correction.',lec:2},
{q:'How do you schedule T-SQL on **Azure SQL Database**?',
 o:['Elastic jobs or Azure Automation','SQL Agent','Windows Task Scheduler on the host','Cron on the host'],
 a:0,why:'SQL Database has no SQL Agent. Use elastic jobs or other services.',lec:3},
{q:'Which provides **cross-region DR** with a read-write listener for SQL Database?',
 o:['Auto-failover group','Point-in-time restore','LTR only','Local backup'],
 a:0,why:'Failover groups manage geo-replication and provide listeners.',lec:3}
]};
