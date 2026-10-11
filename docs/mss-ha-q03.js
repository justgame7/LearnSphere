/* LearnSphere - SQL Server High Availability & DR quiz, Section 3: Failover Cluster Instances.
   Format: see pg-quiz.js. window.QUIZZES['mss-ha:2']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-ha:2']={qs:[
{q:'How many nodes run an FCI at the **same time**?',
 o:['One','All','Two','Depends on edition only'],
 a:0,why:'Only one node owns the storage and runs the instance at a time.',lec:0},
{q:'What does an FCI **not** protect against?',
 o:['Loss of the shared storage','Node failure','OS failure','SQL service stop'],
 a:0,why:'All nodes use one copy of the data, so storage loss is a single point of failure.',lec:0},
{q:'Which are valid **FCI storage** options?',
 o:['SAN','Storage Spaces Direct','SMB 3 file share','Local C: drive of one node'],
 a:[0,1,2],why:'Local disk of one node cannot be shared for failover.',lec:0},
{q:'Where should applications connect to an FCI?',
 o:['The virtual network name','Node 1 name','Node 2 name','Any IP'],
 a:0,why:'The virtual name moves with the instance.',lec:1},
{q:'Which Setup action adds a **second node**?',
 o:['Add node to a SQL Server failover cluster','New standalone installation','Repair','Upgrade'],
 a:0,why:'Setup has a separate action to add a node to an existing FCI.',lec:1},
{q:'What does **failover** time consist of?',
 o:['Detection, moving resources, starting SQL Server and recovery','Only network time','Only backup time','Only DNS time'],
 a:0,why:'The outage includes crash recovery on the new node.',lec:2},
{q:'Which test is **most realistic** for an unplanned failure?',
 o:['Isolate or power off the active node in a lab','Click Move in cluster manager','Rename the instance','Run CHECKDB'],
 a:0,why:'A planned move does not show detection time and behavior on a real failure.',lec:2},
{q:'In a rolling update of a two-node FCI, which node is patched **first**?',
 o:['The passive node','The active node','Both at once','Neither'],
 a:0,why:'Patch passive, fail over, then patch the former active node.',lec:3},
{q:'Why is rollback hard after a CU?',
 o:['Databases are upgraded when started, so you cannot go back without a restore','Setup blocks it','Licensing blocks it','The cluster forbids it'],
 a:0,why:'Test the update first and keep backups.',lec:3}
]};
