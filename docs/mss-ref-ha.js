/* LearnSphere - SQL Server HA and DR Quick Reference (cheat sheet).
   window.QREF['mss-ha'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for SQL Server 2019 to 2022 and current Azure SQL; verify syntax against your build. Check build-specific behaviour in the release notes. */
window.QREF=window.QREF||{};
window.QREF['mss-ha']={title:'SQL Server HA and DR Quick Reference',blurb:'Feature comparison, AG commands and monitoring views for SQL Server high availability and disaster recovery, plus maps of features, AGs, quorum and failovers.',hint:'quorum',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every SQL Server DBA should be able to explain about HA and DR, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Concepts and choosing a feature'},
{acc:[
{t:'RPO, RTO and availability targets',s:'Numbers before technology.',
 a:'**RPO** is acceptable data loss, **RTO** is acceptable downtime. Availability targets (99.9, 99.99 percent) translate to allowed downtime per year. Features are chosen to meet them.',
 w:'Without targets, you cannot say whether a design is enough.',
 c:`SELECT 365*24*60*(1-0.999) AS minutes_down_per_year;`,see:[0,0,'RPO, RTO and availability targets']},
{t:'HA, DR and backup',s:'Three different things.',
 a:'**HA** keeps service during local failures. **DR** restores service after a site loss. **Backup** protects against logical errors and corruption, which HA copies instantly. You need all three.',
 w:'An Availability Group replicates a bad DELETE as faithfully as a good one.',
 c:`SELECT name, recovery_model_desc FROM sys.databases;`,see:[0,1,'HA vs DR vs backup']},
{t:'Choosing a feature',s:'Match the need.',
 a:'**FCI** protects the instance with shared storage. **Availability Groups** protect databases with separate storage and readable secondaries. **Log shipping** is simple, asynchronous DR. **Replication** moves data subsets.',
 w:'Combine them: an AG for HA and log shipping or a distributed AG for DR.',
 c:`SELECT SERVERPROPERTY('IsHadrEnabled') AS hadr, SERVERPROPERTY('IsClustered') AS clustered;`,see:[0,2,'Choosing the right feature']},
{t:'Editions and licensing',s:'What each edition allows.',
 a:'Enterprise supports full AGs, readable secondaries and many replicas. Standard supports Basic Availability Groups (one database, no readable secondary) and FCI with two nodes. Passive replicas for HA can be covered by Software Assurance.',
 w:'Check licensing before designing.',
 c:`SELECT SERVERPROPERTY('Edition');`,see:[0,3,'Licensing and editions for HA']}
]},

{h:'Clustering and Availability Groups'},
{acc:[
{t:'WSFC and quorum',s:'The cluster underneath.',
 a:'A Windows Server Failover Cluster uses **quorum** (majority of votes, including a witness) to decide which nodes may run roles. Losing quorum stops the cluster to avoid split brain.',
 w:'Always use an odd number of votes with a witness.',
 c:`SELECT * FROM sys.dm_hadr_cluster_members;`,see:[1,1,'Quorum and witnesses']},
{t:'Failover Cluster Instance',s:'One instance, shared storage.',
 a:'An FCI is one SQL Server instance that moves between nodes with shared storage and a virtual name. It protects against node failure but not storage failure.',
 w:'Failover restarts the instance, so connections drop and recovery runs.',
 c:`SELECT * FROM sys.dm_os_cluster_nodes;`,see:[2,0,'FCI architecture and shared storage']},
{t:'Availability Group architecture',s:'Replicas, roles and modes.',
 a:'A **primary** replica sends log records to up to eight **secondary** replicas. **Synchronous commit** waits for hardening on the secondary, **asynchronous** does not. A **listener** gives clients a stable name.',
 w:'Sync mode gives no data loss but adds commit latency.',
 c:`SELECT ag.name, r.replica_server_name, r.availability_mode_desc, r.failover_mode_desc FROM sys.availability_groups ag JOIN sys.availability_replicas r ON r.group_id = ag.group_id;`,see:[3,0,'AG architecture: replicas, roles and modes']},
{t:'Listener and read-only routing',s:'Clients find the right replica.',
 a:'The listener (a cluster name and IP) routes connections. With `ApplicationIntent=ReadOnly` and read-only routing, reads go to a readable secondary.',
 w:'Applications must specify intent and use MultiSubnetFailover.',
 c:`SELECT * FROM sys.availability_group_listeners;`,see:[3,3,'Listeners and client connectivity']},
{t:'Synchronization health',s:'Is it keeping up?',
 a:'`sys.dm_hadr_database_replica_states` shows state, log send queue and redo queue. A growing send queue means network or primary problems, a growing redo queue means a slow secondary.',
 w:'Alert on queue sizes, not just state.',
 c:`SELECT database_id, synchronization_state_desc, log_send_queue_size, redo_queue_size FROM sys.dm_hadr_database_replica_states;`,see:[4,1,'Monitoring synchronization']},
{t:'Failover',s:'Planned versus forced.',
 a:'A **planned manual failover** (sync, synchronized) loses no data. **Automatic failover** needs sync commit and a healthy secondary. **Forced failover** with data loss is a last resort.',
 w:'Always check the replica is synchronized first.',
 c:`ALTER AVAILABILITY GROUP MyAG FAILOVER;`,see:[4,0,'Manual and automatic failover']},
{t:'Backups on secondaries',s:'Offload with care.',
 a:'Log backups and COPY_ONLY full backups can run on secondaries based on the AG\'s backup preference. Run backup jobs on every replica and let the function decide.',
 w:'Use `sys.fn_hadr_backup_is_preferred_replica`.',
 c:`SELECT sys.fn_hadr_backup_is_preferred_replica(N'MyDb');`,see:[4,2,'Backups on secondaries']}
]},

{h:'Other features and DR'},
{acc:[
{t:'Basic and distributed AGs',s:'Variants.',
 a:'A **Basic AG** (Standard Edition) has two replicas, one database and no read access. A **distributed AG** links two AGs across clusters or domains for DR and migration.',
 w:'Distributed AGs are the usual cross-site DR design.',
 c:`SELECT * FROM sys.availability_groups WHERE is_distributed = 1;`,see:[5,1,'Distributed Availability Groups']},
{t:'Log shipping',s:'Backup, copy, restore.',
 a:'Three jobs: **backup** on the primary, **copy** to the secondary and **restore** there. It is simple and asynchronous, with a delay you can configure. Failover is manual.',
 w:'A delay protects against logical errors.',
 c:`SELECT * FROM msdb.dbo.log_shipping_monitor_primary;`,see:[6,0,'Log shipping architecture']},
{t:'Replication',s:'Move data, not whole databases.',
 a:'A **publisher** has articles in publications, a **distributor** stores changes, and **subscribers** receive them through agents (snapshot, log reader, distribution). It is not a high-availability feature.',
 w:'Use it when subscribers need subsets or different schemas.',
 c:`SELECT * FROM distribution.dbo.MSreplication_monitordata;`,see:[7,0,'Replication components and agents']},
{t:'DR runbooks and drills',s:'Practised, written down.',
 a:'A runbook lists who decides, the steps, the checks and how to fail back. Drills prove the RTO and find gaps.',
 w:'An untested DR plan is a hope, not a plan.',
 c:`SELECT * FROM sys.dm_hadr_availability_replica_states;`,see:[8,1,'DR runbooks']},
{t:'Failback',s:'Returning to the original site.',
 a:'Re-establish synchronization to the original site, wait until it is synchronized, then fail over in a planned window. Reconfigure backups and monitoring.',
 w:'Failback is a second outage if unplanned.',
 c:`ALTER AVAILABILITY GROUP MyAG SET (ROLE = SECONDARY);`,see:[8,3,'Failback procedures']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Three small maps of how the parts fit together: feature choice, Availability Group architecture and quorum.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. Choosing a HA/DR feature'},
{map:{title:'Feature map',h:328,trace:'Which protects what',
 hint:'Tap any box, or press Which protects what to compare the features.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'fci',x:126,y:24,w:200,h:56,c:'proc',t:'Failover Cluster Instance',s:'instance level',d:'Moves the whole instance between nodes with shared storage.',why:'Protects against node failure.',chk:`SELECT * FROM sys.dm_os_cluster_nodes;`,see:[2,0,'FCI architecture and shared storage']},
 {id:'ag',x:354,y:24,w:200,h:56,c:'proc',t:'Availability Group',s:'database level',d:'Replicates databases to secondaries with readable replicas.',why:'Separate storage.',chk:`SELECT * FROM sys.availability_groups;`,see:[3,0,'AG architecture']},
 {id:'ls',x:126,y:136,w:200,h:56,c:'disk',t:'Log shipping',s:'backup copy restore',d:'Simple asynchronous copies with a delay.',why:'Manual failover.',chk:`SELECT * FROM msdb.dbo.log_shipping_monitor_secondary;`,see:[6,0,'Log shipping architecture']},
 {id:'rep',x:354,y:136,w:200,h:56,c:'net',t:'Replication',s:'data subsets',d:'Moves selected data to subscribers.',why:'Not an HA feature.',chk:`SELECT * FROM sys.publications;`,see:[7,0,'Replication components and agents']},
 {id:'bk',x:240,y:248,w:200,h:56,c:'warn',t:'Backups',s:'always needed',d:'Protect against logical errors and corruption that HA copies.',why:'Test restores.',chk:`SELECT TOP 5 * FROM msdb.dbo.backupset ORDER BY backup_finish_date DESC;`,see:[0,1,'HA vs DR vs backup']}],
 steps:[
 {ids:['fci','ag'],t:'1. FCI protects the instance, AG protects databases.',w:'Different scopes.',s:'Storage.',x:'Shared storage as a single point.',c:`SELECT SERVERPROPERTY('IsClustered');`},
 {ids:['ls','rep'],t:'2. Log shipping gives simple DR and replication moves data.',w:'Different goals.',s:'Delay.',x:'Using replication for HA.',c:`SELECT * FROM msdb.dbo.log_shipping_monitor_primary;`},
 {ids:['bk'],t:'3. Backups remain essential in every design.',w:'Logical errors.',s:'Schedule.',x:'Relying on HA only.',c:`SELECT TOP 5 * FROM msdb.dbo.backupset;`}]}},

{h:'2. Availability Group architecture'},
{map:{title:'AG map',h:328,trace:'A commit travels to a secondary',
 hint:'Tap any box, or press A commit travels to a secondary to follow log records through an AG.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'cli',x:126,y:24,w:200,h:56,c:'ext',t:'Client',s:'application',d:'Connects to the listener name.',why:'MultiSubnetFailover.',chk:`SELECT client_net_address FROM sys.dm_exec_connections;`,see:[3,3,'Listeners and client connectivity']},
 {id:'lis',x:354,y:24,w:200,h:56,c:'net',t:'Listener',s:'stable name',d:'A cluster name and IP that points to the primary.',why:'Read-only routing.',chk:`SELECT * FROM sys.availability_group_listeners;`,see:[3,3,'Listeners and client connectivity']},
 {id:'pri',x:126,y:136,w:200,h:56,c:'proc',t:'Primary replica',s:'read-write',d:'Accepts changes and sends log records.',why:'One per AG.',chk:`SELECT * FROM sys.dm_hadr_availability_replica_states WHERE role_desc = 'PRIMARY';`,see:[3,0,'AG architecture']},
 {id:'sec',x:354,y:136,w:200,h:56,c:'proc',t:'Secondary replica',s:'hardens and redoes',d:'Receives log, hardens it, then redoes it on its data files.',why:'Sync or async.',chk:`SELECT * FROM sys.dm_hadr_database_replica_states;`,see:[3,1,'Synchronous vs asynchronous commit']},
 {id:'wsfc',x:240,y:248,w:200,h:56,c:'mem',t:'WSFC',s:'cluster and quorum',d:'Provides health, voting and failover orchestration.',why:'Quorum and witness.',chk:`SELECT * FROM sys.dm_hadr_cluster;`,see:[1,1,'Quorum and witnesses']}],
 steps:[
 {ids:['cli','lis'],t:'1. Clients connect to the listener, which routes to the primary or a readable secondary.',w:'A stable name.',s:'Routing.',x:'Direct server names.',c:`SELECT * FROM sys.availability_group_listeners;`},
 {ids:['pri','sec'],t:'2. The primary sends log records and sync secondaries harden them before the commit completes.',w:'No data loss in sync mode.',s:'Commit mode.',x:'Latency and queues.',c:`SELECT log_send_queue_size, redo_queue_size FROM sys.dm_hadr_database_replica_states;`},
 {ids:['wsfc'],t:'3. WSFC monitors health and orchestrates failover.',w:'Automatic failover.',s:'Quorum.',x:'Quorum loss.',c:`SELECT * FROM sys.dm_hadr_cluster_members;`}]}},

{h:'3. Quorum'},
{map:{title:'Quorum map',h:216,trace:'Why a witness matters',
 hint:'Tap any box, or press Why a witness matters to see how quorum decides.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'n1',x:126,y:24,w:200,h:56,c:'proc',t:'Node 1',s:'one vote',d:'Each node has a vote.',why:'Dynamic quorum adjusts.',chk:`SELECT member_name, number_of_quorum_votes FROM sys.dm_hadr_cluster_members;`,see:[1,1,'Quorum and witnesses']},
 {id:'n2',x:354,y:24,w:200,h:56,c:'proc',t:'Node 2',s:'one vote',d:'A second node.',why:'Two nodes need a witness.',chk:`SELECT member_name, member_state_desc FROM sys.dm_hadr_cluster_members;`,see:[1,1,'Quorum and witnesses']},
 {id:'wit',x:126,y:136,w:200,h:56,c:'ext',t:'Witness',s:'disk, file share or cloud',d:'A tie-breaking vote.',why:'Cloud witness is simple.',chk:`SELECT * FROM sys.dm_hadr_cluster;`,see:[1,1,'Quorum and witnesses']},
 {id:'q',x:354,y:136,w:200,h:56,c:'warn',t:'Quorum',s:'majority',d:'More than half of votes must be online, or the cluster stops.',why:'Prevents split brain.',chk:`SELECT quorum_type_desc, quorum_state_desc FROM sys.dm_hadr_cluster;`,see:[1,1,'Quorum and witnesses']}],
 steps:[
 {ids:['n1','n2'],t:'1. Nodes each hold a vote.',w:'Majority needed.',s:'Votes.',x:'Even number.',c:`SELECT * FROM sys.dm_hadr_cluster_members;`},
 {ids:['wit','q'],t:'2. A witness breaks ties, and quorum is the majority.',w:'Safe operation.',s:'Witness type.',x:'Lost witness and a node.',c:`SELECT * FROM sys.dm_hadr_cluster;`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Three small maps of how something happens, step by step: a planned failover, a log shipping cycle and a lagging AG.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. A planned AG failover'},
{map:{title:'AG failover map',h:328,trace:'Switch roles without data loss',
 hint:'Tap any box, or press Switch roles without data loss to follow a planned failover.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'chk',x:126,y:24,w:200,h:56,c:'mem',t:'Check health',s:'synchronized',d:'Confirm the target secondary is SYNCHRONIZED.',why:'Check queues too.',chk:`SELECT synchronization_state_desc FROM sys.dm_hadr_database_replica_states;`,see:[4,1,'Monitoring synchronization']},
 {id:'sync',x:354,y:24,w:200,h:56,c:'mem',t:'Sync commit',s:'set if needed',d:'Temporarily switch the target to synchronous commit for a no-loss failover.',why:'Switch back after.',chk:`ALTER AVAILABILITY GROUP MyAG MODIFY REPLICA ON 'N2' WITH (AVAILABILITY_MODE = SYNCHRONOUS_COMMIT);`,see:[3,1,'Synchronous vs asynchronous commit']},
 {id:'fo',x:126,y:136,w:200,h:56,c:'proc',t:'Fail over',s:'on the target',d:'Run the failover command on the target secondary.',why:'Connections drop briefly.',chk:`ALTER AVAILABILITY GROUP MyAG FAILOVER;`,see:[4,0,'Manual and automatic failover']},
 {id:'clt',x:354,y:136,w:200,h:56,c:'ext',t:'Clients reconnect',s:'listener',d:'Clients reconnect through the listener.',why:'Retry logic.',chk:`SELECT * FROM sys.dm_exec_connections;`,see:[3,3,'Listeners and client connectivity']},
 {id:'post',x:240,y:248,w:200,h:56,c:'mem',t:'Post checks',s:'jobs and sync',d:'Verify synchronization, backups preference and jobs on the new primary.',why:'Agent jobs differ per replica.',chk:`SELECT * FROM sys.dm_hadr_availability_replica_states;`,see:[4,2,'Backups on secondaries']}],
 steps:[
 {ids:['chk','sync'],t:'1. Check synchronization and set sync commit if needed.',w:'No data loss.',s:'Mode.',x:'Failing over an unsynchronized replica.',c:`SELECT synchronization_state_desc FROM sys.dm_hadr_database_replica_states;`},
 {ids:['fo','clt'],t:'2. Fail over on the target and let clients reconnect.',w:'Short interruption.',s:'Listener.',x:'Hard-coded server names.',c:`ALTER AVAILABILITY GROUP MyAG FAILOVER;`},
 {ids:['post'],t:'3. Verify health and jobs.',w:'Complete.',s:'Jobs.',x:'Jobs not enabled on the new primary.',c:`SELECT * FROM sys.dm_hadr_availability_replica_states;`}]}},

{h:'2. Log shipping cycle'},
{map:{title:'Log shipping map',h:216,trace:'Backup, copy, restore',
 hint:'Tap any box, or press Backup, copy, restore to follow one cycle of log shipping.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'bk',x:126,y:24,w:200,h:56,c:'proc',t:'Backup job',s:'primary',d:'Back up the transaction log to a share.',why:'Interval sets RPO.',chk:`SELECT * FROM msdb.dbo.log_shipping_primary_databases;`,see:[6,1,'Configuring log shipping']},
 {id:'cp',x:354,y:24,w:200,h:56,c:'proc',t:'Copy job',s:'secondary',d:'Copy backup files to the secondary.',why:'Network and share.',chk:`SELECT * FROM msdb.dbo.log_shipping_secondary;`,see:[6,1,'Configuring log shipping']},
 {id:'rs',x:126,y:136,w:200,h:56,c:'proc',t:'Restore job',s:'NORECOVERY or STANDBY',d:'Restore the files in order, optionally with a delay.',why:'Standby allows reads between restores.',chk:`SELECT * FROM msdb.dbo.log_shipping_secondary_databases;`,see:[6,1,'Configuring log shipping']},
 {id:'mon',x:354,y:136,w:200,h:56,c:'mem',t:'Monitor',s:'thresholds',d:'Alert when backup or restore falls behind.',why:'Alert on latency.',chk:`SELECT * FROM msdb.dbo.log_shipping_monitor_secondary;`,see:[6,2,'Monitoring and alerts']}],
 steps:[
 {ids:['bk','cp'],t:'1. The primary backs up the log and the secondary copies the file.',w:'Two jobs.',s:'Share.',x:'Share unavailable.',c:`SELECT * FROM msdb.dbo.log_shipping_monitor_primary;`},
 {ids:['rs','mon'],t:'2. The secondary restores and the monitor checks thresholds.',w:'Alerts on delay.',s:'Threshold.',x:'Silent failure.',c:`SELECT * FROM msdb.dbo.log_shipping_monitor_secondary;`}]}},

{h:'3. Diagnosing an AG that is not synchronizing'},
{map:{title:'AG troubleshooting map',h:328,trace:'Find where log is stuck',
 hint:'Tap any box, or press Find where log is stuck to follow the checks.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'st',x:126,y:24,w:200,h:56,c:'mem',t:'Replica state',s:'DMV',d:'Check connection state and synchronization health.',why:'Disconnected or not synchronizing.',chk:`SELECT * FROM sys.dm_hadr_availability_replica_states;`,see:[4,4,'Troubleshooting common AG problems']},
 {id:'qs',x:354,y:24,w:200,h:56,c:'mem',t:'Queues',s:'send and redo',d:'Large send queue is a network or primary issue. Large redo queue is a secondary issue.',why:'Separate the two.',chk:`SELECT log_send_queue_size, redo_queue_size FROM sys.dm_hadr_database_replica_states;`,see:[4,1,'Monitoring synchronization']},
 {id:'net',x:126,y:136,w:200,h:56,c:'net',t:'Network and endpoint',s:'5022',d:'Firewall, endpoint permissions and certificates.',why:'Test the endpoint port.',chk:`Test-NetConnection secondary -Port 5022`,see:[4,4,'Troubleshooting common AG problems']},
 {id:'dsk',x:354,y:136,w:200,h:56,c:'disk',t:'Secondary disk and CPU',s:'redo speed',d:'A slow secondary falls behind on redo.',why:'Check I/O latency there.',chk:`SELECT * FROM sys.dm_io_virtual_file_stats(NULL, NULL);`,see:[4,4,'Troubleshooting common AG problems']},
 {id:'log',x:240,y:248,w:200,h:56,c:'warn',t:'Log growth on primary',s:'AVAILABILITY_REPLICA',d:'The primary cannot truncate log while a replica lags.',why:'Fix or remove the lagging replica.',chk:`SELECT name, log_reuse_wait_desc FROM sys.databases;`,see:[4,4,'Troubleshooting common AG problems']}],
 steps:[
 {ids:['st','qs'],t:'1. Check state and queues to see which side is slow.',w:'Narrows the cause.',s:'DMVs.',x:'Guessing.',c:`SELECT * FROM sys.dm_hadr_database_replica_states;`},
 {ids:['net','dsk'],t:'2. Check the network, endpoint and the secondary\'s resources.',w:'Where the delay is.',s:'Firewall.',x:'Blocked endpoint.',c:`Test-NetConnection secondary -Port 5022`},
 {ids:['log'],t:'3. Watch primary log growth until the replica catches up.',w:'Avoid a full log.',s:'Reuse wait.',x:'Log fills the disk.',c:`SELECT log_reuse_wait_desc FROM sys.databases;`}]}},

]},

{t:'HA/DR feature comparison',d:'What each feature protects, its limits and typical use.',see:[[0,2,'Choosing the right feature'],[5,1,'Distributed Availability Groups']],b:[
{t:[['Feature','Scope','Data loss','Failover','Readable copy','Typical use'],['Failover Cluster Instance','Instance','None (shared storage)','Automatic','No','Local HA'],['Availability Group (sync)','Databases','None','Automatic or manual','Yes','Local HA'],['Availability Group (async)','Databases','Possible','Manual (forced)','Yes','DR'],['Distributed AG','Databases across AGs','Possible','Manual','Yes','Cross-site DR, migration'],['Log shipping','Database','Delay-based','Manual','Standby mode only','Simple DR'],['Replication','Articles','Not applicable','None','Yes','Data distribution'],['Backup and restore','Database','Since last backup','Manual','No','Always required']]}
]},
{t:'AG monitoring and commands',d:'Queries and commands used to watch and run Availability Groups.',see:[[4,1,'Monitoring synchronization'],[4,0,'Manual and automatic failover']],b:[
{t:[['Task','Command or view'],['Replica health','`sys.dm_hadr_availability_replica_states`'],['Database sync and queues','`sys.dm_hadr_database_replica_states`'],['Cluster and quorum','`sys.dm_hadr_cluster`, `sys.dm_hadr_cluster_members`'],['Listener','`sys.availability_group_listeners`'],['Failover','`ALTER AVAILABILITY GROUP ag FAILOVER;`'],['Forced failover','`ALTER AVAILABILITY GROUP ag FORCE_FAILOVER_ALLOW_DATA_LOSS;`'],['Suspend and resume data movement','`ALTER DATABASE db SET HADR SUSPEND|RESUME;`'],['Add a database','`ALTER AVAILABILITY GROUP ag ADD DATABASE db;`'],['Preferred backup replica','`sys.fn_hadr_backup_is_preferred_replica(\'db\')`'],['Extended Events','`AlwaysOn_health` session']]}
]},
]};
