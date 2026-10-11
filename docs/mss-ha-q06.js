/* LearnSphere - SQL Server High Availability & DR quiz, Section 6: AG Variants.
   Format: see pg-quiz.js. window.QUIZZES['mss-ha:5']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-ha:5']={qs:[
{q:'How many **databases** can a basic AG contain?',
 o:['One','Unlimited','Ten','Two'],
 a:0,why:'A basic AG has one database and two replicas. Create several groups for several databases.',lec:0},
{q:'Which capability is **not** available in a basic AG?',
 o:['Readable secondary','Listener','Automatic failover','Synchronous commit'],
 a:0,why:'Basic AGs have no readable secondary and no backups on the secondary.',lec:0},
{q:'What is a **distributed availability group**?',
 o:['An AG made of two AGs, in separate clusters','Two databases in one AG','A FCI','A replication type'],
 a:0,why:'A distributed AG links two AGs, often across sites or for migration.',lec:1},
{q:'Failover between the two AGs in a distributed AG is:',
 o:['Manual','Always automatic','Impossible','Done by WSFC quorum'],
 a:0,why:'You switch roles with a manual, planned step.',lec:1},
{q:'What does a **contained AG** replicate in addition to user databases?',
 o:['Contained master and msdb: logins and jobs','tempdb','The operating system','Windows registry'],
 a:0,why:'The AG has its own master and msdb that replicate with the group.',lec:2},
{q:'Which SQL Server version introduced **contained availability groups**?',
 o:['2022','2016','2017','2012'],
 a:0,why:'Contained AGs arrived in SQL Server 2022.',lec:2},
{q:'What replaces WSFC in a **Linux** AG for HA?',
 o:['Pacemaker','Active Directory','Hyper-V','Docker'],
 a:0,why:'Pacemaker with Corosync manages the cluster on Linux.',lec:3},
{q:'Which cluster type is used for **read scale** without automatic failover?',
 o:['NONE','EXTERNAL','WSFC','FCI'],
 a:0,why:'CLUSTER_TYPE = NONE has no cluster manager, so no automatic failover.',lec:3},
{q:'Why is **fencing** needed in a Pacemaker cluster?',
 o:['To isolate a failed node so it cannot write','To compress data','To encrypt traffic','To speed up backups'],
 a:0,why:'Fencing prevents split brain by cutting off a node that is not healthy.',lec:3}
]};
