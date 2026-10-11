/* LearnSphere - SQL Server High Availability & DR quiz, Section 2: Windows Failover Clustering.
   Format: see pg-quiz.js. window.QUIZZES['mss-ha:1']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-ha:1']={qs:[
{q:'What is a **quorum**?',
 o:['The voting rule that decides whether the cluster can run','A backup type','A listener','A database role'],
 a:0,why:'A cluster must hold a majority of votes to keep running.',lec:0},
{q:'Which are **WSFC** concepts?',
 o:['Node','Cluster resource','Witness','Availability database only'],
 a:[0,1,2],why:'Availability databases belong to AGs, not WSFC itself.',lec:0},
{q:'Why is a **witness** needed in a two-node cluster?',
 o:['Without it losing one node loses quorum','To store backups','To speed up logins','To encrypt traffic'],
 a:0,why:'With two nodes, a third vote lets the surviving node keep majority.',lec:1},
{q:'Which witness works well **without a third site**?',
 o:['Cloud witness','Disk witness in each site','Local file share on node 1','No witness'],
 a:0,why:'A cloud witness uses an Azure storage account as the extra vote.',lec:1},
{q:'What does **split brain** mean?',
 o:['Two parts of a cluster both think they are in charge','A failed disk','A slow query','A lost backup'],
 a:0,why:'Quorum prevents this by letting only the majority side run.',lec:1},
{q:'Which client setting speeds up reconnects in **multi-subnet** clusters?',
 o:['MultiSubnetFailover=True','Encrypt=False','ApplicationIntent=ReadOnly','Pooling=False'],
 a:0,why:'It tries all IP addresses of the listener at once.',lec:2},
{q:'Why should **heartbeat thresholds** not be loosened to hide problems?',
 o:['A flaky network should be fixed, not masked','They are fixed in Windows','Thresholds cannot change','It voids licensing'],
 a:0,why:'Higher thresholds only delay detection of real failures.',lec:2},
{q:'What should you do with **warnings** in Validate Configuration?',
 o:['Fix or understand them before creating the cluster','Ignore them','Delete the report','Reboot'],
 a:0,why:'A clean validation is the basis of a supported cluster.',lec:3},
{q:'Which feature must be installed on every node?',
 o:['Failover Clustering','Hyper-V','IIS','Print services'],
 a:0,why:'The Failover Clustering feature provides WSFC.',lec:3}
]};
