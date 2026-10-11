/* LearnSphere - SQL Server Operations, Monitoring & Automation quiz, Section 5: Resource Governor & Capacity.
   Format: see pg-quiz.js. window.QUIZZES['mss-ops:4']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-ops:4']={qs:[
{q:'What does the **classifier function** do?',
 o:['Chooses the workload group for a new session','Encrypts logins','Creates indexes','Takes backups'],
 a:0,why:'It runs at login and returns the group name.',lec:0},
{q:'Which edition provides **Resource Governor**?',
 o:['Enterprise','Express','Web','All, free'],
 a:0,why:'Resource Governor is an Enterprise feature.',lec:0},
{q:'Which object defines a **slice of CPU and memory**?',
 o:['Resource pool','Workload group','Classifier','Login'],
 a:0,why:'Pools hold the resource limits that groups use.',lec:1},
{q:'Which statement applies Resource Governor **changes**?',
 o:['ALTER RESOURCE GOVERNOR RECONFIGURE','CHECKPOINT','DBCC FREEPROCCACHE','RECONFIGURE WITH OVERRIDE'],
 a:0,why:'Changes take effect after ALTER RESOURCE GOVERNOR RECONFIGURE.',lec:1},
{q:'Why must the classifier be **fast**?',
 o:['It runs on every login','It runs once a year','It runs on backups','It runs on restarts only'],
 a:0,why:'A slow classifier slows every connection.',lec:1},
{q:'Where can you find **historical database size** without extra collection?',
 o:['msdb.dbo.backupset','tempdb','master.dbo.sysdatabases only','Agent history'],
 a:0,why:'Backup history records backup size over time.',lec:2},
{q:'What makes a capacity forecast **reliable**?',
 o:['History plus business drivers','One day of data','Random numbers','Opinions'],
 a:0,why:'Trend and business context improve accuracy.',lec:2},
{q:'Why does **right-sizing** often reduce cost in SQL Server?',
 o:['Licenses are per core','Disks are free','It speeds backups','It removes patching'],
 a:0,why:'Removing unneeded cores reduces per-core license cost.',lec:3},
{q:'Which DMV shows **Enterprise-only features** used by a database?',
 o:['sys.dm_db_persisted_sku_features','sys.dm_os_wait_stats','sys.indexes','sys.objects'],
 a:0,why:'It lists features that restrict restoring on a lower edition.',lec:3}
]};
