/* LearnSphere - SQL Server Azure SQL & Hybrid quiz, Section 6: Hybrid & Fabric.
   Format: see pg-quiz.js. window.QUIZZES['mss-az:5']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-az:5']={qs:[
{q:'What does **Azure Arc-enabled SQL Server** do?',
 o:['Projects non-Azure instances into Azure as resources','Moves them to Azure automatically','Replaces SQL Server','Encrypts backups only'],
 a:0,why:'Arc connects instances outside Azure so you can manage and govern them from Azure.',lec:0},
{q:'What is needed on the server for Arc?',
 o:['An agent and outbound connectivity to Azure','A new CPU','A domain controller replacement','A tape drive'],
 a:0,why:'The Arc agent connects to Azure endpoints.',lec:0},
{q:'Where do **Best practices assessment** results appear?',
 o:['Log Analytics workspace','tempdb','Error log only','Agent history'],
 a:0,why:'Results are stored in a workspace for review.',lec:1},
{q:'How should findings be **treated**?',
 o:['As a prioritized to-do list with recorded exceptions','Ignored','Applied blindly','Deleted'],
 a:0,why:'Not every rule applies, so record decisions.',lec:1},
{q:'Which hybrid DR pattern gives **near real-time** replication to PaaS?',
 o:['Managed Instance link','Backup to URL only','Log shipping to tape','Replication snapshot'],
 a:0,why:'The link uses AG technology to replicate to a Managed Instance.',lec:2},
{q:'What is a necessary part of a **hybrid DR plan**?',
 o:['Network path and failback','Only a license','Only a VM','Nothing'],
 a:0,why:'Connectivity and returning are part of the plan.',lec:2},
{q:'What format does **Fabric mirroring** use in OneLake?',
 o:['Delta Parquet','CSV only','MDF','BAK'],
 a:0,why:'Mirrored data is stored as Delta tables in Parquet files.',lec:3},
{q:'What does mirroring avoid?',
 o:['Building an ETL pipeline','Having a database','Using SQL','Having security'],
 a:0,why:'Mirroring replicates data continuously without custom ETL.',lec:3}
]};
