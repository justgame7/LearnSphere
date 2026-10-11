/* LearnSphere - SQL Server Upgrade, Patching & Migration quiz, Section 4: Migrating to Azure.
   Format: see pg-quiz.js. window.QUIZZES['mss-upg:3']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-upg:3']={qs:[
{q:'Which Azure target keeps **full SQL Server and OS control**?',
 o:['SQL Server on Azure VM','Azure SQL Database','Azure SQL Managed Instance','Azure Synapse'],
 a:0,why:'On a VM you manage the OS and SQL Server yourself.',lec:0},
{q:'What does an Azure assessment recommend?',
 o:['Readiness, size and estimated cost','Backup file names','Login passwords','Index names'],
 a:0,why:'The assessment shows which targets fit and how to size them.',lec:0},
{q:'What is the **difference** between offline and online DMS migration?',
 o:['Online keeps applying log so downtime is short','Offline is faster always','Online needs no network','Offline keeps users connected'],
 a:0,why:'Online mode synchronizes continuously until cutover.',lec:1},
{q:'What should be done **separately** from the database move?',
 o:['Logins and jobs','Table rows','Indexes','Stored procedures in the database'],
 a:0,why:'Server-level objects may need separate migration steps.',lec:1},
{q:'Which target is the closest **PaaS match** to an on-premises instance?',
 o:['Azure SQL Managed Instance','Azure SQL Database single','Azure Cosmos DB','Azure Storage'],
 a:0,why:'Managed Instance supports SQL Agent and many instance features.',lec:2},
{q:'Which option supports **online** migration to Managed Instance with log restore?',
 o:['Log Replay Service','Detach and attach','DBCC CHECKDB','Profiler'],
 a:0,why:'LRS applies log backups continuously from Blob storage.',lec:2},
{q:'What does the **SQL IaaS Agent extension** provide for VMs?',
 o:['Portal management, automated backup and patching','New hardware','A free license','Auto tuning of queries'],
 a:0,why:'It integrates the VM with Azure management features.',lec:3},
{q:'What remains **your responsibility** on an Azure VM?',
 o:['OS and SQL Server patching, backups, security','Hardware power','Datacenter cooling','Azure region creation'],
 a:0,why:'A VM is IaaS, so you manage the software stack.',lec:3}
]};
