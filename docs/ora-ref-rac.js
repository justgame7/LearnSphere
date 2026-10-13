/* LearnSphere - Grid Infrastructure, ASM & RAC Quick Reference (cheat sheet).
   window.QREF['ora-rac'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Values are for Oracle Grid Infrastructure and RAC 19c on Linux unless stated; 26ai differences are marked [26ai].
   Command output differs slightly by release. Check the Clusterware and RAC guides for your release. */
window.QREF=window.QREF||{};
window.QREF['ora-rac']={title:'Grid Infrastructure, ASM & RAC Quick Reference',blurb:'Clusterware stack, ASM, RAC processes, files, logs, commands and fixes on one page each.',hint:'crsctl or asm',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas behind Oracle RAC and Grid Infrastructure that you should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command or query to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Foundations'},
{acc:[
{t:'HA, scalability and DR',s:'Three different problems.',
 a:'**High availability** keeps service running when a component fails. **Scalability** adds capacity as load grows. **Disaster recovery** restores service after a site is lost. RAC addresses the first two inside one site: if a node fails the others carry on, and you can add nodes. It does not protect against the loss of the whole site or the storage.',
 w:'Choose the technology for the problem. RAC plus Data Guard together cover local failure and site loss.',
 c:`SELECT inst_id, instance_name, host_name, status FROM gv$instance ORDER BY inst_id;`,see:[0,0,'HA, scalability and DR: what each technology solves']},
{t:'Shared-everything cluster',s:'Many instances, one database.',
 a:'In **RAC**, several instances on different servers open the **same database** on shared storage. Every instance can read and write any block. Cache Fusion keeps the caches consistent over a private network, and each instance has its own redo thread and undo tablespace.',
 w:'This is what separates RAC from Data Guard (two databases) and from sharding (many databases). One set of data, several engines.',
 c:`SELECT name, value FROM v$parameter WHERE name IN ('cluster_database','cluster_database_instances');`,see:[0,1,'Shared-everything clusters and why Oracle RAC exists']},
{t:'Grid Infrastructure',s:'Clusterware plus ASM.',
 a:'**Grid Infrastructure** is the software layer under RAC. It contains **Clusterware** (node membership, resource management, failover) and **ASM** (the storage layer). It runs from its own home, separate from the database home, and it starts before any database.',
 w:'Most cluster problems are Grid Infrastructure problems, not database problems. Learn to check it first.',
 c:`$ crsctl check cluster -all
$ crsctl stat res -t`,see:[0,2,'Grid Infrastructure components: Clusterware, ASM and ACFS']},
{t:'RAC, Data Guard, GoldenGate and sharding',s:'What each one is for.',
 a:'**RAC** gives local HA and scale-out on one database. **Data Guard** gives a second copy at another site. **GoldenGate** replicates data logically between different databases. **Sharding** spreads data across independent databases. They are often combined: RAC at each site with Data Guard between them.',
 w:'The most common design mistake is expecting RAC to be a DR solution.',
 c:`SELECT database_role, protection_mode FROM v$database;`,see:[0,3,'RAC vs Data Guard vs GoldenGate vs Sharding']},
{t:'RAC One Node and licensing',s:'Same software, different footprint.',
 a:'**RAC One Node** runs a single instance that can be relocated to another node online, for rolling maintenance. Full **RAC** is an option on Enterprise Edition and is licensed per processor. The cluster software itself, Grid Infrastructure, is included.',
 w:'If you need failover but not scale-out, RAC One Node is cheaper. Check the option before you enable cluster mode.',
 c:`SELECT parameter, value FROM v$option WHERE parameter LIKE 'Real Application%';`,see:[0,5,'RAC licensing and RAC One Node']}
]},

{h:'Clusterware'},
{acc:[
{t:'The clusterware stack',s:'OHASD starts everything.',
 a:'**OHASD** is started by init and in turn starts the lower stack: the agents, **CSSD** (membership), **CRSD** (resource management), **EVMD** (events), ASM and the networks. CRSD then manages the resources: databases, listeners, VIPs, services. The startup order is why you check from the bottom up.',
 w:'If CRSD is down but OHASD is up, `crsctl check crs` shows exactly which layer failed.',
 c:`$ crsctl check crs
$ crsctl stat res -t -init`,see:[2,0,'The clusterware stack: OHASD, CRSD, CSSD and EVMD']},
{t:'Voting files and the OCR',s:'Who is in the cluster, and what is it running.',
 a:'The **voting files** are the disk heartbeat and tie-breaker: a node must reach a majority of them to stay in the cluster. The **Oracle Cluster Registry (OCR)** is the cluster configuration: resources, their attributes and dependencies. Both normally live in an ASM disk group.',
 w:'Lose a voting-file majority and nodes are evicted. Lose the OCR and the cluster cannot start resources. Back them up and keep an odd number of voting files.',
 c:`$ crsctl query css votedisk
$ ocrcheck`,see:[2,1,'Voting files and the Oracle Cluster Registry']},
{t:'Node membership and heartbeats',s:'How the cluster knows who is alive.',
 a:'Nodes prove they are alive with a **network heartbeat** over the private interconnect and a **disk heartbeat** in the voting files. If a node misses heartbeats for longer than `misscount` (30 seconds by default) the cluster removes it. This is the basis of eviction.',
 w:'A short network blip on the interconnect can look like a dead node. Reliable, redundant private networking is a requirement, not an option.',
 c:`$ crsctl get css misscount
$ crsctl get css disktimeout`,see:[2,3,'Node membership, heartbeats and eviction basics']},
{t:'Node eviction and fencing',s:'A node that cannot be trusted is removed.',
 a:'To protect data, the cluster **evicts** a node that stops responding, and **fences** it so it cannot write to shared storage, normally by rebooting it. Typical causes are a lost interconnect, a hung or starved node, or a lost storage path to the voting files.',
 w:'An eviction looks like a node reboot. The cause is in the Clusterware logs of the surviving nodes and the evicted node.',
 c:`$ grep -i 'evict\\|reboot' $ORACLE_BASE/diag/crs/$(hostname -s)/crs/trace/ocssd.trc | tail`,see:[8,2,'Node eviction: causes and diagnosis']},
{t:'Resources and dependencies',s:'Everything is a resource.',
 a:'Clusterware manages everything as a **resource** with a type, state, placement policy and dependencies: a VIP, a listener, an ASM instance, a database, a service. Dependencies decide start order, for example a database starts only after its disk groups are mounted.',
 w:'When a database will not start, check its dependent resources before you look at the instance.',
 c:`$ crsctl stat res ora.orcl.db -p | grep -i depend`,see:[2,4,'Clusterware resources and dependencies']},
{t:'Grid Plug and Play',s:'A node finds its configuration itself.',
 a:'**GPnP** keeps a small profile (an XML file) on each node that tells it the cluster name, network classification and where the ASM discovery string and voting files are. A node joining the cluster uses it to find everything else without manual files.',
 w:'It is why adding a node is a few commands, and why the profile must match between nodes.',
 c:`$ gpnptool get`,see:[2,2,'Grid Plug and Play and the cluster profile']}
]},

{h:'Networks and storage'},
{acc:[
{t:'Public, VIP, SCAN and private networks',s:'Each network has one job.',
 a:'The **public** network carries client traffic and the node VIPs. The **SCAN** is one name that resolves to three addresses and always reaches a healthy node. The **private interconnect** carries cluster heartbeat and Cache Fusion traffic and must be fast, isolated and redundant (HAIP).',
 w:'Clients should connect only to the SCAN. A slow interconnect is felt as slow queries everywhere.',
 c:`$ srvctl config scan
$ oifcfg getif`,see:[1,3,'Networking: public, virtual, SCAN and private interconnect']},
{t:'ASM architecture',s:'A volume manager and file system for Oracle files.',
 a:'**ASM** runs as an instance on the nodes and manages **disk groups** made of disks. It stripes files across the disks and mirrors them according to the redundancy, and the database talks to ASM for file placement. Datafiles, redo, control files and the OCR can all be in ASM.',
 w:'ASM replaces a file system and a volume manager. Capacity and I/O balance are administered at the disk group level.',
 c:`SELECT name, state, type, total_mb, free_mb FROM v$asm_diskgroup;`,see:[4,0,'ASM architecture: instances, disk groups, disks and failure groups']},
{t:'ASM redundancy and failure groups',s:'Where the copies go.',
 a:'With **normal** redundancy each extent is stored twice, with **high** three times, and with **external** once, relying on the array. **Failure groups** are sets of disks that fail together, such as a controller or an array, and ASM never puts two copies of an extent in the same failure group.',
 w:'The redundancy decision is made at disk group creation and cannot be changed without a rebuild. Keep free space for re-mirroring after a failure.',
 c:`SELECT g.name, d.failgroup, d.name, d.state FROM v$asm_disk d JOIN v$asm_diskgroup g USING (group_number) ORDER BY 1, 2;`,see:[4,1,'Redundancy: external, normal, high and flex']},
{t:'ASM rebalance',s:'Move data when disks change.',
 a:'When a disk is added, dropped or lost, ASM **rebalances** the extents across the disks of the group in the background. The **power** limit controls how fast, trading speed for I/O impact. While it runs, redundancy may be reduced.',
 w:'A rebalance after a disk failure is a window of reduced protection. Watch it to completion.',
 c:`SELECT group_number, operation, state, power, sofar, est_work, est_minutes FROM v$asm_operation;`,see:[4,4,'Rebalance: power, monitoring and behavior']},
{t:'Flex ASM',s:'Fewer ASM instances than nodes.',
 a:'With **Flex ASM** a cluster runs a few ASM instances (cardinality 3 by default) and database instances on other nodes connect to them over the network. If an ASM instance fails, its clients move to another one.',
 w:'It reduces memory used by ASM and removes the dependency of each database node on a local ASM instance.',
 c:`SELECT inst_id, instance_name, status FROM gv$instance WHERE instance_name LIKE '+ASM%';`,see:[4,0,'ASM architecture']}
]},

{h:'RAC database'},
{acc:[
{t:'Shared vs per-instance',s:'Know what is common to all instances.',
 a:'Datafiles, control files, and the SPFILE are **shared**. Each instance has its **own** redo log thread, undo tablespace, SGA and background processes. Parameters can be set for all instances (`*`) or for one (`orcl1`). The shared parts are what make RAC one database.',
 w:'Many RAC problems come from forgetting that each instance needs its own redo and undo, and that some parameters must match on all nodes.',
 c:`SELECT inst_id, thread#, status, enabled FROM gv$thread;
SELECT inst_id, name, value FROM gv$parameter WHERE name = 'undo_tablespace';`,see:[5,0,'What is shared and what is per-instance in RAC']},
{t:'Redo threads and instance recovery',s:'A survivor recovers the failed node.',
 a:'Each instance writes its own **redo thread**. If an instance fails, a surviving instance reads the failed one\'s redo and undo and performs **instance recovery**, so the database stays available. Block locks held by the dead instance are released as part of the recovery.',
 w:'This is why RAC failover is a matter of seconds for the database, not minutes.',
 c:`SELECT inst_id, thread#, sequence#, status FROM gv$log WHERE status = 'CURRENT';`,see:[5,1,'Instances, threads, redo and undo per node']},
{t:'Cache Fusion',s:'Blocks move between caches, not through disk.',
 a:'When an instance needs a block that another instance has cached, the block is sent over the **interconnect** directly from memory rather than being written to disk and read back. **GCS** (LMS processes) coordinates block transfers and **GES** (LMD, LMON) coordinates other global resources.',
 w:'It is what makes RAC scale, and it is why the interconnect and "gc" wait events matter.',
 c:`SELECT inst_id, name, value FROM gv$sysstat WHERE name LIKE 'gc%received' ORDER BY 1, 2;`,see:[5,3,'Cache Fusion: how blocks move between nodes']},
{t:'Global Resource Directory',s:'Who holds which block.',
 a:'The **GRD** is a distributed record of every cached block: its mode (shared, exclusive), its master instance and its holders. Mastering is spread across instances, and is remastered when an instance joins or leaves. A request goes to the block master, which tells the holder to send it.',
 w:'Remastering after a node change is a short pause. Affinity and partitioning by service reduce cross-instance traffic.',
 c:`SELECT inst_id, event, total_waits, time_waited_micro FROM gv$system_event WHERE event LIKE 'gc%' ORDER BY time_waited_micro DESC FETCH FIRST 8 ROWS ONLY;`,see:[5,2,'Global Cache Services and Global Enqueue Services']},
{t:'srvctl and administrator-managed databases',s:'Use the cluster tools, not SQL*Plus.',
 a:'In an **administrator-managed** database you assign instances to nodes yourself. All management goes through `srvctl`, which talks to Clusterware, so that start, stop and relocation respect resource dependencies. SQL*Plus `STARTUP` works but bypasses the cluster view of state.',
 w:'Always stop and start RAC databases with `srvctl`. Policy-managed databases were an option in earlier releases and are desupported in 26ai.',
 c:`$ srvctl status database -d orcl -v
$ srvctl config database -d orcl`,see:[6,1,'srvctl: starting, stopping and status']}
]},

{h:'Services and clients'},
{acc:[
{t:'Database services',s:'The unit of work placement.',
 a:'A **service** is a named workload with its own preferred and available instances, failover and load-balancing goals. Clients connect to a service, not to an instance. Moving or stopping a service changes where work runs without touching clients.',
 w:'Create one service per application or role. Never connect applications to the default database service.',
 c:`$ srvctl add service -db orcl -service app_rw -preferred orcl1,orcl2
SELECT name, goal, clb_goal FROM dba_services;`,see:[7,0,'Database services: creating and managing with srvctl']},
{t:'Load balancing',s:'Connection and runtime.',
 a:'**Client-side** load balancing picks among the SCAN listeners. **Server-side** load balancing lets the listener direct each new connection to the least loaded instance that offers the service. The **load balancing advisory** gives connection pools run-time hints about which instance has capacity.',
 w:'It spreads connections, not queries. A single long query still runs on the one instance.',
 c:`SELECT inst_id, name, value FROM gv$parameter WHERE name IN ('local_listener','remote_listener');`,see:[7,1,'Client-side and server-side connection load balancing']},
{t:'FAN, ONS and Fast Connection Failover',s:'Tell clients at once.',
 a:'**Fast Application Notification** sends events about service and instance up/down through **ONS**. Clients using **Fast Connection Failover** (or the UCP and JDBC drivers) clean up dead connections and reconnect immediately, instead of waiting for a TCP timeout.',
 w:'Without FAN, applications take minutes to notice a failure. With it, it takes seconds.',
 c:`$ srvctl config nodeapps
$ onsctl ping`,see:[7,2,'Fast Application Notification and ONS']},
{t:'Application Continuity',s:'Replay, so users do not see the failure.',
 a:'**Application Continuity** records the calls of a session and, after a recoverable outage, replays them on another instance so the application sees no error. **Transparent Application Continuity** does this without code changes by tracking session state.',
 w:'It turns an instance failure into a brief delay rather than an error page. It needs the right driver and service attributes.',
 c:`SELECT name, failover_type, commit_outcome, session_state_consistency FROM dba_services WHERE name = 'APP_RW';`,see:[7,4,'Application Continuity and Transparent Application Continuity']},
{t:'Draining sessions',s:'Move users off before maintenance.',
 a:'Before planned maintenance you stop the service with a **drain timeout**. New connections go to other instances, existing sessions are allowed to finish their work and are then moved or disconnected at a safe point, and the instance can be stopped without errors.',
 w:'Draining is what makes rolling patching invisible to users.',
 c:`$ srvctl stop service -db orcl -service app_rw -instance orcl1 -drain_timeout 60 -stopoption IMMEDIATE`,see:[7,5,'Draining sessions before maintenance']}
]},

{h:'Operations'},
{acc:[
{t:'Rolling patching',s:'Patch one node at a time.',
 a:'In a **rolling** patch you take one node out of service (draining its services), patch its Grid and database homes, bring it back, and then do the next. The cluster remains available throughout. `opatchauto` automates the order, and **out-of-place** patching installs a new home and switches to it.',
 w:'The only outage users see is the brief drain and reconnect, if services and clients are set up correctly.',
 c:`$ opatchauto apply /patches/36000000 -oh $ORACLE_HOME
$ crsctl query crs activeversion -f`,see:[9,0,'Rolling patching with opatchauto']},
{t:'OCR and voting file backups',s:'Know where your cluster config is.',
 a:'Clusterware backs up the **OCR** automatically (every four hours by default) and you can take manual backups. Voting file contents are backed up in the OCR backup. Restoring means starting the cluster in exclusive mode and using `ocrconfig -restore` and `crsctl replace votedisk`.',
 w:'When the disk group holding the OCR is lost, those backups are the only way back. Keep them off the cluster.',
 c:`$ ocrconfig -showbackup
$ ocrconfig -manualbackup`,see:[8,1,'OCR and voting file backup and recovery']},
{t:'Diagnostics: TFA, AHF and CVU',s:'Collect first, then argue.',
 a:'**Trace File Analyzer** (part of **Autonomous Health Framework**) collects the right logs from all nodes at once for a time window. **ORAchk** compares the cluster against best practices. **CVU** (`cluvfy`) verifies prerequisites before install and after changes.',
 w:'A support request without a TFA collection starts with a request for one. Run cluvfy before and after every change.',
 c:`$ tfactl diagcollect -from "2026-10-10 02:00:00" -to "2026-10-10 03:00:00"
$ cluvfy comp nodecon -n all -verbose`,see:[8,4,'Cluster logs, TFA and AHF']},
{t:'Backup and Data Guard for RAC',s:'Same tools, a few extra rules.',
 a:'RMAN backs up a RAC database like a single instance, but all instances must be able to see the backup location, and archived logs from all threads are needed for recovery. Data Guard with RAC can have a RAC primary and a RAC or single-instance standby; only one standby instance applies redo.',
 w:'Test a restore, not just a backup, and check that the archive destination is reachable from every node.',
 c:`SELECT thread#, MAX(sequence#) FROM v$archived_log GROUP BY thread#;`,see:[9,3,'Backup and recovery for RAC']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Five small maps of how the parts fit together: the clusterware stack, a two-node database, Cache Fusion, an ASM disk group and services with failover.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why a DBA cares, one query or command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. The clusterware stack on a node'},
{map:{title:'Clusterware stack map',h:328,trace:'Start a cluster node',
 hint:'Tap any box, or press Start a cluster node to see the order in which the stack comes up.',
 lines:[[215,52,241,52],[437,52,463,52],'M340 80 L340 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L118 219 L118 246','M562 192 L562 219 L340 219 L340 246',[437,276,463,276]],
 nodes:[
 {id:'init',x:21,y:24,w:194,h:56,c:'ext',t:'init.ohasd',s:'OS start',d:'The operating system starts the Oracle High Availability Services daemon at boot, through systemd or init.',why:'If the node boots and the stack does not come up, check this is enabled first.',chk:`$ crsctl config has
$ systemctl status oracle-ohasd`,see:[2,5,'Startup sequence and log locations']},
 {id:'ohasd',x:243,y:24,w:194,h:56,c:'proc',t:'OHASD',s:'bottom of the stack',d:'The Oracle High Availability Services daemon. It starts and monitors the lower-stack resources through agents.',why:'It is the only thing the OS starts. Everything else is started by it.',chk:`$ crsctl check has
$ crsctl stat res -t -init`,see:[2,0,'The clusterware stack: OHASD, CRSD, CSSD and EVMD']},
 {id:'gpnp',x:465,y:24,w:194,h:56,c:'mem',t:'GPnP profile',s:'cluster settings',d:'The Grid Plug and Play profile gives the node the cluster name, network layout and where the voting files are.',why:'It lets a node start without a hand-written configuration.',chk:`$ gpnptool get`,see:[2,2,'Grid Plug and Play and the cluster profile']},
 {id:'cssd',x:21,y:136,w:194,h:56,c:'proc',t:'CSSD',s:'membership',d:'Cluster Synchronization Services. It joins the node to the cluster and runs the network and disk heartbeats.',why:'If CSSD cannot reach the voting files it cannot join, and nothing above it can start.',chk:`$ crsctl check css
$ crsctl query css votedisk`,see:[2,3,'Node membership, heartbeats and eviction basics']},
 {id:'asm',x:243,y:136,w:194,h:56,c:'proc',t:'ASM instance',s:'storage',d:'The ASM instance mounts the disk groups, including the one that holds the OCR and the voting files.',why:'CRSD needs the OCR, so ASM must be up first (or the OCR is read directly).',chk:`SELECT name, state FROM v$asm_diskgroup;`,see:[4,0,'ASM architecture']},
 {id:'crsd',x:465,y:136,w:194,h:56,c:'proc',t:'CRSD',s:'resource manager',d:'Cluster Ready Services reads the OCR and starts, stops and monitors the resources of the cluster.',why:'It restarts failed resources, and relocates them when a node is lost.',chk:`$ crsctl check crs
$ crsctl stat res -t`,see:[2,0,'The clusterware stack: OHASD, CRSD, CSSD and EVMD']},
 {id:'evmd',x:21,y:248,w:194,h:56,c:'proc',t:'EVMD',s:'events',d:'The Event Manager daemon publishes cluster events to other processes and nodes.',why:'It carries the notifications that clients and tools react to.',chk:`$ crsctl check evm`,see:[2,0,'The clusterware stack: OHASD, CRSD, CSSD and EVMD']},
 {id:'res',x:243,y:248,w:194,h:56,c:'mem',t:'Resources',s:'VIP, listeners, services',d:'The cluster resources managed by CRSD: network, VIPs, SCAN, listeners, ONS and so on.',why:'These are what clients actually connect to.',chk:`$ crsctl stat res -t | head -40`,see:[2,4,'Clusterware resources and dependencies']},
 {id:'db',x:465,y:248,w:194,h:56,c:'ext',t:'Databases',s:'instances and services',d:'Database instances and their services, started as resources once their dependencies are online.',why:'The last layer, so the cluster can be healthy while a database is down.',chk:`$ srvctl status database -d orcl -v`,see:[6,1,'srvctl: starting, stopping and status']}],
 steps:[
 {ids:['init','ohasd'],t:'1. The OS starts OHASD at boot. It then starts the lower-stack agents and the lower-stack resources.',w:'This is the only step the operating system takes.',s:'`crsctl enable has`, `/etc/oracle/scls_scr`.',x:'If auto-start is disabled the node comes up with no stack and no error.',c:`$ crsctl config has`},
 {ids:['ohasd','gpnp'],t:'2. OHASD starts GPnP so the node can read the cluster profile: names, networks and the voting file location.',w:'Without it the node does not know which cluster it belongs to.',s:'GPnP profile and wallet.',x:'A profile out of step with the cluster prevents the node from joining.',c:`$ gpnptool get`},
 {ids:['cssd'],t:'3. CSSD starts and joins the node to the cluster. It reads the voting files and begins exchanging heartbeats with the other nodes.',w:'Membership is decided here and nothing above it can start.',s:'`misscount`, `disktimeout`, voting files.',x:'CRS-1714 or "no voting files" means the storage path or the disk group is not available.',c:`$ crsctl check css`},
 {ids:['asm'],t:'4. The ASM instance starts and mounts the disk groups. The OCR and voting files are normally in one of them.',w:'Storage must be available before resources can be read.',s:'`asm_diskstring`, `asm_diskgroups`.',x:'A missed disk path means the disk group does not mount, and so no OCR.',c:`SELECT name, state FROM v$asm_diskgroup;`},
 {ids:['crsd','evmd'],t:'5. CRSD starts, reads the OCR and learns what it should manage. EVMD starts and begins publishing events.',w:'The cluster now has its configuration and an event channel.',s:'OCR, `crsctl`.',x:'A damaged or unreachable OCR stops CRSD from starting.',c:`$ ocrcheck`},
 {ids:['res','db'],t:'6. CRSD starts the resources in dependency order: networks, VIPs, SCAN, listeners, then databases and services.',w:'Clients can connect only when this layer is online.',s:'Resource dependencies and start policies.',x:'A database that does not start usually has an unmet dependency, such as an unmounted disk group.',c:`$ crsctl stat res -t`}]}},

{h:'2. A two-node RAC database'},
{map:{title:'Two-node RAC map',h:440,trace:'Connect through the SCAN',
 hint:'Tap any box, or press Connect through the SCAN to follow a client connection into a two-node cluster.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[454,80,454,134],'M226 192 L226 219 L118 219 L118 246','M454 192 L454 219 L562 219 L562 246',[215,276,241,276],[437,276,463,276],'M118 304 L118 331 L226 331 L226 358','M562 304 L562 331 L454 331 L454 358'],
 nodes:[
 {id:'client',x:126,y:24,w:200,h:56,c:'ext',t:'Client',s:'application',d:'An application or user connecting by the SCAN name and a service name.',why:'It never needs to know node names.',chk:`$ sqlplus app@//rac-scan.example.com:1521/app_rw`,see:[5,5,'Services, SCAN and VIPs from the client view']},
 {id:'scan',x:354,y:24,w:200,h:56,c:'proc',t:'SCAN',s:'three addresses',d:'The Single Client Access Name resolves to up to three addresses, each served by a SCAN listener.',why:'Nodes can be added or removed without client changes.',chk:`$ srvctl config scan
$ srvctl status scan_listener`,see:[1,3,'Networking: public, virtual, SCAN and private interconnect']},
 {id:'ln1',x:126,y:136,w:200,h:56,c:'proc',t:'Listener node 1',s:'local listener + VIP',d:'The node listener on node 1 and its virtual IP. The SCAN listener redirects connections to it.',why:'The VIP moves to another node if this node fails.',chk:`$ srvctl status listener
$ srvctl status vip -n node1`,see:[5,5,'Services, SCAN and VIPs from the client view']},
 {id:'ln2',x:354,y:136,w:200,h:56,c:'proc',t:'Listener node 2',s:'local listener + VIP',d:'The node listener on node 2 and its virtual IP.',why:'Each node has its own, so each can be stopped independently.',chk:`$ lsnrctl services`,see:[5,5,'Services, SCAN and VIPs from the client view']},
 {id:'i1',x:21,y:248,w:194,h:56,c:'mem',t:'Instance 1',s:'SGA, redo thread 1',d:'The first instance: its own SGA, background processes, redo thread and undo tablespace.',why:'It can run any query against the whole database.',chk:`SELECT instance_name, host_name, status FROM gv$instance;`,see:[5,1,'Instances, threads, redo and undo per node']},
 {id:'ic',x:243,y:248,w:194,h:56,c:'ext',t:'Interconnect',s:'private network',d:'The private network between nodes. It carries Cache Fusion block transfers and cluster heartbeats.',why:'Treat it as a database component, with redundancy and enough bandwidth.',chk:`SELECT inst_id, name, ip_address FROM gv$cluster_interconnects;`,see:[5,4,'The interconnect and why it matters']},
 {id:'i2',x:465,y:248,w:194,h:56,c:'mem',t:'Instance 2',s:'SGA, redo thread 2',d:'The second instance. It has its own redo and undo and shares everything else.',why:'If instance 1 fails it recovers the instance 1 redo.',chk:`SELECT inst_id, thread#, status FROM gv$thread;`,see:[5,1,'Instances, threads, redo and undo per node']},
 {id:'asm',x:126,y:360,w:200,h:56,c:'disk',t:'ASM disk groups',s:'shared storage',d:'Disk groups visible from all nodes, with ASM instances managing the placement.',why:'Shared storage is what makes it one database.',chk:`SELECT name, type, total_mb, free_mb FROM v$asm_diskgroup;`,see:[4,0,'ASM architecture: instances, disk groups, disks and failure groups']},
 {id:'files',x:354,y:360,w:200,h:56,c:'disk',t:'Database files',s:'one set',d:'One set of datafiles, control files and SPFILE, plus a redo thread and undo tablespace for each instance.',why:'Every instance reads and writes the same files.',chk:`SELECT name FROM v$datafile FETCH FIRST 3 ROWS ONLY;`,see:[5,0,'What is shared and what is per-instance in RAC']}],
 steps:[
 {ids:['client','scan'],t:'1. The client resolves the SCAN name and connects to one of its addresses, asking for a service.',w:'It needs no knowledge of the nodes.',s:'DNS round robin or GNS, `SCAN` setup.',x:'A SCAN that resolves to one address in /etc/hosts loses its redundancy.',c:`$ nslookup rac-scan.example.com`},
 {ids:['scan','ln1','ln2'],t:'2. The SCAN listener picks the best instance for that service, using load information, and redirects the client to the node listener.',w:'It is how connections are balanced.',s:'`REMOTE_LISTENER`, `CLB_GOAL`, load balancing advisory.',x:'ORA-12514 means the service is not registered with the listener you reached.',c:`SELECT name, value FROM v$parameter WHERE name IN ('remote_listener','local_listener');`},
 {ids:['ln1','i1'],t:'3. The node listener hands the connection to a server process of that instance, and the session starts.',w:'The client now has a normal session on one instance.',s:'Dedicated or shared server, `SERVICE_NAMES`.',x:'A node listener down means connections to that node fail.',c:`SELECT inst_id, COUNT(*) FROM gv$session WHERE type = 'USER' GROUP BY inst_id;`},
 {ids:['i1','ic','i2'],t:'4. When the session needs a block cached by the other instance, it is sent over the interconnect, not through disk.',w:'This is Cache Fusion. It is why the private network matters.',s:'`CLUSTER_INTERCONNECTS`, MTU, network speed.',x:'Packet loss on the interconnect shows as gc waits and evictions.',c:`SELECT inst_id, name, value FROM gv$sysstat WHERE name LIKE 'gc %received';`},
 {ids:['i1','i2','asm','files'],t:'5. Both instances read and write the same database files in ASM, and each writes its own redo thread.',w:'One database, two engines.',s:'ASM disk groups, `THREAD`, `UNDO_TABLESPACE`.',x:'A file visible to one node only is a storage or udev problem.',c:`SELECT thread#, group#, status FROM v$log ORDER BY thread#, group#;`}]}},

{h:'3. Cache Fusion'},
{map:{title:'Cache Fusion map',h:328,trace:'Move a block between instances',
 hint:'Tap any box, or press Move a block between instances to follow a remote cache read.',
 lines:[[215,52,241,52],[437,52,463,52],[562,80,562,134],[465,164,439,164],[243,164,217,164],'M118 136 L118 109 L340 109 L340 82','M562 192 L562 219 L226 219 L226 246','M340 80 L340 163 L454 163 L454 246'],
 nodes:[
 {id:'sess',x:21,y:24,w:194,h:56,c:'ext',t:'Session',s:'on instance 1',d:'A user session on instance 1 that needs a data block for a query or change.',why:'It first looks in its own buffer cache.',chk:`SELECT inst_id, sid, event FROM gv$session WHERE wait_class <> 'Idle' AND type = 'USER';`,see:[5,3,'Cache Fusion: how blocks move between nodes']},
 {id:'c1',x:243,y:24,w:194,h:56,c:'mem',t:'Local cache',s:'buffer cache 1',d:'The buffer cache of instance 1. A hit here needs no global traffic.',why:'A miss leads to a global cache request.',chk:`SELECT name, value FROM gv$sysstat WHERE inst_id = 1 AND name IN ('gc cr blocks received','gc current blocks received');`,see:[5,3,'Cache Fusion: how blocks move between nodes']},
 {id:'lms1',x:465,y:24,w:194,h:56,c:'proc',t:'LMS (inst 1)',s:'global cache service',d:'The Global Cache Service process on instance 1 sends the request on behalf of the session.',why:'LMS processes are high priority and busy ones show as gc waits.',chk:`SELECT inst_id, program FROM gv$process WHERE program LIKE '%LMS%';`,see:[5,2,'Global Cache Services and Global Enqueue Services']},
 {id:'grd',x:465,y:136,w:194,h:56,c:'mem',t:'Block master',s:'GRD',d:'The instance that masters this block in the Global Resource Directory knows who holds it and in which mode.',why:'Mastering is spread across instances and moves with load.',chk:`SELECT inst_id, event, total_waits FROM gv$system_event WHERE event LIKE 'gc%' ORDER BY total_waits DESC FETCH FIRST 5 ROWS ONLY;`,see:[5,2,'Global Cache Services and Global Enqueue Services']},
 {id:'lms2',x:243,y:136,w:194,h:56,c:'proc',t:'LMS (holder)',s:'ships the block',d:'The LMS on the instance that has the block in its cache. It sends the block over the interconnect.',why:'It may first have to flush redo for a dirty block.',chk:`SELECT inst_id, name, value FROM gv$sysstat WHERE name LIKE 'gc %served';`,see:[5,3,'Cache Fusion: how blocks move between nodes']},
 {id:'c2',x:21,y:136,w:194,h:56,c:'mem',t:'Holder cache',s:'buffer cache 2',d:'The buffer cache of the instance that holds the current or a consistent copy.',why:'Transfer from memory is faster than disk.',chk:`SELECT inst_id, COUNT(*) FROM gv$bh WHERE status <> 'free' GROUP BY inst_id;`,see:[5,3,'Cache Fusion: how blocks move between nodes']},
 {id:'disk',x:126,y:248,w:200,h:56,c:'disk',t:'Disk',s:'ASM datafiles',d:'If no instance caches the block it is read from disk, as in a single instance.',why:'The master grants the block directly in that case.',chk:`SELECT event, total_waits FROM v$system_event WHERE event LIKE 'db file%read';`,see:[5,0,'What is shared and what is per-instance in RAC']},
 {id:'wait',x:354,y:248,w:200,h:56,c:'warn',t:'gc waits',s:'what you see',d:'Wait events starting with gc: gc cr block 2-way, gc current block 3-way, gc buffer busy acquire and others.',why:'High values mean heavy cross-instance traffic, a slow interconnect or hot blocks.',chk:`SELECT event, total_waits, ROUND(time_waited_micro/total_waits) AS avg_us FROM gv$system_event WHERE event LIKE 'gc%' AND total_waits > 0 ORDER BY time_waited_micro DESC FETCH FIRST 8 ROWS ONLY;`,see:[8,3,'Interconnect and gc wait troubleshooting']}],
 steps:[
 {ids:['sess','c1'],t:'1. A session on instance 1 needs a block. It looks in the local buffer cache and does not find it.',w:'A local hit stays local and costs no global resources.',s:'`DB_CACHE_SIZE`, data locality.',x:'A small cache makes more requests go global.',c:`SELECT name, value FROM v$sysstat WHERE name IN ('session logical reads','physical reads');`},
 {ids:['c1','lms1','grd'],t:'2. Instance 1 asks the block master through LMS. The master looks in the GRD to see which instance holds the block.',w:'The request is a small message over the interconnect.',s:'GRD mastering, `_gc_policy_time` (internal), service affinity.',x:'High latency on the interconnect slows every request here.',c:`SELECT event, average_wait FROM v$system_event WHERE event LIKE 'gc cr request%';`},
 {ids:['grd','lms2','c2'],t:'3. The master forwards the request to the holder. The holder LMS sends the block directly to the requester.',w:'It is a 3-way transfer if the master and holder differ, 2-way if they are the same instance.',s:'Block mode, `LMS` priority.',x:'Overloaded LMS processes (CPU starved) cause gc waits even on a healthy network.',c:`SELECT inst_id, event, total_waits FROM gv$system_event WHERE event LIKE 'gc%block%way' ORDER BY 3 DESC;`},
 {ids:['c2','c1'],t:'4. The block arrives in the requester cache over the interconnect and the session continues. The wait is recorded as a gc event.',w:'The data came from memory, in microseconds to a few milliseconds.',s:'Interconnect bandwidth and MTU.',x:'Dropped or retransmitted packets show as `gc cr block lost`.',c:`SELECT inst_id, name, value FROM gv$sysstat WHERE name LIKE 'gc blocks lost';`},
 {ids:['grd','disk'],t:'5. If no instance has the block, the master tells the requester to read it from disk. This is the same as a single-instance read.',w:'Only blocks cached somewhere take the fusion path.',s:'`DB_FILE_MULTIBLOCK_READ_COUNT`, storage speed.',x:'Disk read waits dominating mean the working set does not fit in the caches.',c:`SELECT event, total_waits FROM v$system_event WHERE event LIKE 'db file%read';`},
 {ids:['wait'],t:'6. You see the cost as gc wait events. Compare them with I/O waits to decide whether the cluster or the application design is the problem.',w:'Waits identify what to measure next.',s:'AWR, ASH.',x:'Hot blocks (sequences, last-block inserts) show as gc buffer busy waits.',c:`SELECT event, total_waits FROM gv$system_event WHERE event LIKE 'gc buffer busy%';`}]}},

{h:'4. An ASM disk group and a failed disk'},
{map:{title:'ASM disk group map',h:328,trace:'A disk fails',
 hint:'Tap any box, or press A disk fails to see how ASM keeps the data available and rebuilds redundancy.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L340 107 L340 134',[243,164,217,164],[437,164,463,164],[118,192,118,246],[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'db',x:21,y:24,w:194,h:56,c:'ext',t:'Database',s:'reads and writes',d:'The database instance issues I/O to ASM files directly. ASM is not in the data path.',why:'ASM tells it where the extents are, then it reads and writes the disks itself.',chk:`SELECT name, state FROM v$asm_diskgroup;`,see:[4,0,'ASM architecture: instances, disk groups, disks and failure groups']},
 {id:'asmi',x:243,y:24,w:194,h:56,c:'proc',t:'ASM instance',s:'metadata',d:'Manages the disk group metadata: which extents are on which disks and which copies are current.',why:'If it is down, new files cannot be created and failures cannot be handled.',chk:`SELECT instance_name, status FROM gv$instance WHERE instance_name LIKE '+ASM%';`,see:[4,0,'ASM architecture: instances, disk groups, disks and failure groups']},
 {id:'dg',x:465,y:24,w:194,h:56,c:'mem',t:'Disk group',s:'DATA, NORMAL',d:'A named collection of disks managed as one unit. The unit of redundancy, space and rebalance.',why:'Files are striped across all of its disks.',chk:`SELECT name, type, total_mb, free_mb, required_mirror_free_mb FROM v$asm_diskgroup;`,see:[4,3,'Creating and altering disk groups']},
 {id:'fg1',x:21,y:136,w:194,h:56,c:'disk',t:'Failure group 1',s:'array or controller A',d:'A set of disks that can fail together. The primary extent copy of some data is here.',why:'Choose failure groups to match real fault domains.',chk:`SELECT failgroup, name, state FROM v$asm_disk WHERE failgroup = 'FG1';`,see:[4,1,'Redundancy: external, normal, high and flex']},
 {id:'ext',x:243,y:136,w:194,h:56,c:'mem',t:'Extents',s:'mirrored pairs',d:'File data is split into extents. With normal redundancy each extent has a copy in a different failure group.',why:'This is how one disk can fail without data loss.',chk:`SELECT group_number, file_number, COUNT(*) FROM v$asm_file GROUP BY group_number, file_number FETCH FIRST 5 ROWS ONLY;`,see:[4,1,'Redundancy: external, normal, high and flex']},
 {id:'fg2',x:465,y:136,w:194,h:56,c:'disk',t:'Failure group 2',s:'array or controller B',d:'The second fault domain. It holds the mirror copies of the extents in group 1.',why:'It must have enough free space to take over.',chk:`SELECT failgroup, name, state FROM v$asm_disk WHERE failgroup = 'FG2';`,see:[4,1,'Redundancy: external, normal, high and flex']},
 {id:'off',x:21,y:248,w:194,h:56,c:'warn',t:'Disk offline',s:'repair timer',d:'A disk with an error is taken offline. ASM keeps track of changes and waits DISK_REPAIR_TIME (default 12 hours) before dropping it.',why:'A short outage is resynchronised quickly, without a full rebalance.',chk:`SELECT name, mode_status, mount_status, repair_timer FROM v$asm_disk WHERE mode_status <> 'ONLINE';`,see:[4,5,'Disk group attributes and compatibility']},
 {id:'reb',x:243,y:248,w:194,h:56,c:'proc',t:'Rebalance',s:'rebuild mirrors',d:'After a drop or an add, ASM moves extents so every one again has the required copies and the load is even.',why:'Until it finishes, you have less redundancy than designed.',chk:`SELECT operation, state, power, sofar, est_work, est_minutes FROM v$asm_operation;`,see:[4,4,'Rebalance: power, monitoring and behavior']},
 {id:'mon',x:465,y:248,w:194,h:56,c:'mem',t:'Monitor',s:'alerts and views',d:'The ASM alert log, V$ASM_OPERATION and V$ASM_DISK tell you what ASM is doing.',why:'Watch for it to complete before the next failure.',chk:`SELECT name, state, offline_disks FROM v$asm_diskgroup;`,see:[4,6,'ASMCMD and SQL*Plus administration']}],
 steps:[
 {ids:['db','asmi','dg'],t:'1. The database opens an ASM file. ASM provides the extent map, and the database reads and writes the disks directly.',w:'ASM is a control path, not a data path.',s:'Disk group, file templates.',x:'When ASM is down, open files keep working but nothing can change.',c:`SELECT name, state FROM v$asm_diskgroup;`},
 {ids:['fg1','ext','fg2'],t:'2. Each extent is stored in two failure groups, so a single disk or array failure leaves one good copy.',w:'It is how normal redundancy protects data.',s:'Redundancy (`NORMAL`, `HIGH`), failure groups.',x:'Two disks in the same failure group do not protect each other.',c:`SELECT failgroup, COUNT(*) FROM v$asm_disk GROUP BY failgroup;`},
 {ids:['fg1','off'],t:'3. A disk in failure group 1 returns I/O errors. ASM takes it offline and writes go to the mirror copies only.',w:'The database sees no error, because the other copy is good.',s:'`DISK_REPAIR_TIME`, `compatible.asm` of 11.1 or higher.',x:'A second failure in group 2 during this time loses data.',c:`SELECT name, mode_status, mount_status FROM v$asm_disk WHERE mode_status <> 'ONLINE';`},
 {ids:['off','ext','fg2'],t:'4. Reads continue from the mirror copies in failure group 2. Changed extents are tracked for a fast resync if the disk comes back.',w:'It avoids a full rebuild for short outages.',s:'Fast mirror resync.',x:'Free space on the surviving group must be sufficient.',c:`SELECT group_number, name, repair_timer FROM v$asm_disk WHERE repair_timer > 0;`},
 {ids:['off','reb'],t:'5. If the disk is replaced in time, only changed extents are copied. If the timer expires it is dropped and a full rebalance re-mirrors the data across the remaining disks.',w:'The data returns to full redundancy.',s:'`ALTER DISKGROUP ... ONLINE DISK`, `DROP DISK`, `REBALANCE POWER`.',x:'A high power value on busy storage hurts the workload.',c:`ALTER DISKGROUP data ONLINE DISK data_0003;`},
 {ids:['mon','dg'],t:'6. You watch the rebalance finish and confirm that the disk group shows no offline disks and enough free space.',w:'Until then another failure is a risk.',s:'`V$ASM_OPERATION`, free space and required mirror free.',x:'A group with less free space than the largest disk cannot restore redundancy.',c:`SELECT name, free_mb, required_mirror_free_mb, usable_file_mb FROM v$asm_diskgroup;`}]}},

{h:'5. Services, notification and failover'},
{map:{title:'Services and failover map',h:328,trace:'An instance fails',
 hint:'Tap any box, or press An instance fails to see how clients are told and how work continues.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'app',x:21,y:24,w:194,h:56,c:'ext',t:'Application',s:'connection pool',d:'An application pool (UCP, OCI session pool, JDBC) connecting by SCAN and service, with FAN enabled.',why:'FAN-aware pools react in seconds. Others wait for timeouts.',chk:`SELECT service_name, COUNT(*) FROM gv$session WHERE type = 'USER' GROUP BY service_name;`,see:[7,3,'Fast Connection Failover and Transparent Application Failover']},
 {id:'scan',x:243,y:24,w:194,h:56,c:'proc',t:'SCAN',s:'entry point',d:'SCAN listeners direct new connections to a running instance of the service.',why:'They always know the current location of a service.',chk:`$ srvctl status scan_listener`,see:[7,1,'Client-side and server-side connection load balancing']},
 {id:'svc',x:465,y:24,w:194,h:56,c:'mem',t:'Service',s:'app_rw',d:'A named workload with preferred and available instances and failover attributes.',why:'It decides where the work runs and what happens on failure.',chk:`$ srvctl config service -db orcl -service app_rw`,see:[7,0,'Database services: creating and managing with srvctl']},
 {id:'i1',x:21,y:136,w:194,h:56,c:'warn',t:'Instance 1',s:'fails',d:'The instance that was running the service stops or its node is lost.',why:'Sessions connected to it are lost.',chk:`SELECT inst_id, status FROM gv$instance;`,see:[5,1,'Instances, threads, redo and undo per node']},
 {id:'ons',x:243,y:136,w:194,h:56,c:'proc',t:'ONS and FAN',s:'events',d:'The Oracle Notification Service carries Fast Application Notification events to subscribed clients.',why:'Events arrive in under a second, rather than waiting for TCP timeouts.',chk:`$ onsctl ping
$ srvctl config ons`,see:[7,2,'Fast Application Notification and ONS']},
 {id:'i2',x:465,y:136,w:194,h:56,c:'mem',t:'Instance 2',s:'takes over',d:'A surviving instance. The service is available there, and new connections arrive here.',why:'It must have the capacity for the whole workload.',chk:`SELECT name, inst_id FROM gv$active_services WHERE name = 'APP_RW';`,see:[7,0,'Database services: creating and managing with srvctl']},
 {id:'crs',x:126,y:248,w:200,h:56,c:'proc',t:'Clusterware',s:'detects and acts',d:'Clusterware notices the failure, relocates VIPs and restarts or relocates the service resources.',why:'It also restarts the failed instance when it can.',chk:`$ crsctl stat res -t | grep -A2 orcl`,see:[2,4,'Clusterware resources and dependencies']},
 {id:'ac',x:354,y:248,w:200,h:56,c:'mem',t:'Application Continuity',s:'replay',d:'The driver replays the calls of the interrupted session on the new instance and checks the results match.',why:'Users see a delay instead of an error.',chk:`SELECT name, failover_type, commit_outcome FROM dba_services WHERE name = 'APP_RW';`,see:[7,4,'Application Continuity and Transparent Application Continuity']}],
 steps:[
 {ids:['app','scan','svc'],t:'1. Before the failure: the pool is connected through the SCAN to the service, with sessions on both instances.',w:'This is the normal, balanced state.',s:'Service preferred instances, `CLB_GOAL`, `RLB_GOAL`.',x:'Clients using an instance name or a node name miss all of the following steps.',c:`SELECT inst_id, COUNT(*) FROM gv$session WHERE service_name = 'APP_RW' GROUP BY inst_id;`},
 {ids:['i1'],t:'2. Instance 1 fails, for example its node crashes. Its sessions are lost and its in-flight transactions are not committed.',w:'Uncommitted work is rolled back by instance recovery.',s:'None. This is the event.',x:'A hung node can cause long timeouts if the heartbeat takes time to detect it.',c:`SELECT inst_id, status FROM gv$instance;`},
 {ids:['crs','ons'],t:'3. Clusterware detects the failure and publishes a FAN event through ONS saying that the service is down on instance 1.',w:'The event is the trigger for the client.',s:'ONS configuration, `notification` attribute of the service.',x:'ONS blocked by a firewall means no FAN, and the clients only notice by timeout.',c:`$ srvctl config service -db orcl -service app_rw | grep -i notif`},
 {ids:['ons','app'],t:'4. The pool receives the event, closes the dead connections at once, and stops handing them out.',w:'Fast Connection Failover avoids errors caused by stale connections.',s:'UCP FCF, `fastConnectionFailoverEnabled`.',x:'Pools without FCF return dead connections to applications.',c:`SELECT COUNT(*) FROM gv$session WHERE service_name = 'APP_RW';`},
 {ids:['svc','i2'],t:'5. The service is up on instance 2 (as an available instance or already preferred). New connections are redirected there.',w:'The workload continues on the surviving node.',s:'Preferred and available instances, failback attribute.',x:'No available instance means the service is simply offline.',c:`SELECT name, inst_id FROM gv$active_services WHERE name = 'APP_RW';`},
 {ids:['ac','app'],t:'6. With Application Continuity the driver replays the interrupted request on instance 2 and the user sees no error.',w:'It is the difference between a hiccup and an incident.',s:'`FAILOVER_TYPE=TRANSACTION`, `COMMIT_OUTCOME`, replay driver.',x:'Calls with side effects outside the database cannot be replayed.',c:`SELECT failover_type, commit_outcome, session_state_consistency FROM dba_services WHERE name = 'APP_RW';`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Seven small maps of how something happens, step by step: a Grid install, a connection through the SCAN, a node eviction, instance recovery, planned maintenance, rolling patching and gc wait diagnosis.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Installing Grid Infrastructure on two nodes'},
{map:{title:'Grid install map',h:216,trace:'Install the cluster',
 hint:'Tap any box, or press Install the cluster to follow the steps from a bare node to a running stack.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'os',x:20,y:24,w:139,h:56,c:'proc',t:'OS preparation',s:'users and kernel',d:'Create the grid and oracle users and groups, set kernel parameters and install the packages (the preinstall package does most of it).',why:'Most failed installs are failed prerequisites.',chk:`$ dnf install oracle-database-preinstall-19c`,see:[1,2,'OS preparation: packages, users, groups and kernel parameters']},
 {id:'net',x:187,y:24,w:139,h:56,c:'ext',t:'Networks',s:'public, private, SCAN',d:'Configure public and private interfaces and the SCAN name resolving to three addresses in DNS.',why:'It cannot be changed easily afterwards.',chk:`$ nslookup rac-scan.example.com`,see:[1,3,'Networking: public, virtual, SCAN and private interconnect']},
 {id:'stor',x:354,y:24,w:139,h:56,c:'disk',t:'Shared storage',s:'udev or AFD',d:'Present shared disks to all nodes with persistent names and correct ownership.',why:'Names that change after reboot break ASM.',chk:`$ ls -l /dev/oracleasm/ /dev/disk/by-id | head`,see:[1,5,'Shared storage and device persistence (udev, AFD)']},
 {id:'cvu',x:521,y:24,w:139,h:56,c:'mem',t:'cluvfy',s:'verify',d:'Run the Cluster Verification Utility to check every requirement on every node.',why:'It finds the problem before the installer does.',chk:`$ ./runcluvfy.sh stage -pre crsinst -n node1,node2 -verbose`,see:[1,6,'Passwordless SSH and Cluster Verification Utility']},
 {id:'inst',x:20,y:136,w:139,h:56,c:'proc',t:'gridSetup.sh',s:'installer',d:'Run the installer from the grid home on node 1. It copies software to the other nodes and configures the cluster.',why:'It asks for the cluster name, SCAN, networks and the first disk group.',chk:`$ ./gridSetup.sh`,see:[3,1,'Installing with gridSetup.sh: GUI and response file']},
 {id:'root',x:187,y:136,w:139,h:56,c:'warn',t:'root.sh',s:'on each node',d:'Run root.sh as root on each node, one at a time, when the installer asks.',why:'It starts the stack for the first time.',chk:`# /u01/app/19.0.0/grid/root.sh`,see:[3,1,'Installing with gridSetup.sh: GUI and response file']},
 {id:'chk',x:354,y:136,w:139,h:56,c:'mem',t:'Verify',s:'crsctl, cluvfy',d:'Check that all resources are online on all nodes and run the post-install cluvfy.',why:'It confirms that the cluster is ready for databases.',chk:`$ crsctl stat res -t
$ cluvfy stage -post crsinst -n all`,see:[3,4,'Post-installation verification']},
 {id:'db',x:521,y:136,w:139,h:56,c:'ext',t:'Create database',s:'DBCA',d:'Install the database software on all nodes and create a RAC database with DBCA.',why:'The cluster is only the platform.',chk:`$ dbca -silent -createDatabase -databaseConfigType RAC ...`,see:[6,0,'Creating a RAC database with DBCA']}],
 steps:[
 {ids:['os'],t:'1. Prepare each node: users, groups, kernel parameters, packages and limits. Keep the same UIDs and GIDs on all nodes.',w:'A mismatch causes confusing permission errors.',s:'`/etc/sysctl.conf`, `/etc/security/limits.conf`, preinstall package.',x:'Differing group IDs between nodes break shared file access.',c:`$ id grid; id oracle`},
 {ids:['net','stor'],t:'2. Set up the networks and the shared storage with stable device names. Make sure the private network is isolated.',w:'The cluster is only as reliable as these.',s:'DNS, `/etc/hosts`, udev rules, AFD.',x:'SCAN in a single hosts file entry works but loses the redundancy.',c:`$ oifcfg iflist`},
 {ids:['cvu'],t:'3. Run cluvfy for the pre-install stage on all nodes and fix every FAILED item.',w:'It saves a failed install and a cleanup.',s:'`runcluvfy.sh stage -pre crsinst`.',x:'Ignoring warnings about time sync or memory comes back as evictions.',c:`$ ./runcluvfy.sh stage -pre crsinst -n node1,node2 -verbose`},
 {ids:['inst'],t:'4. Run gridSetup.sh. Choose the cluster configuration, the nodes, the networks and the disk group for the OCR and voting files.',w:'These choices are hard to change later.',s:'Response file for silent installs.',x:'Choosing external redundancy for voting files on a single array is a hidden single point of failure.',c:`$ ./gridSetup.sh -silent -responseFile /tmp/grid.rsp`},
 {ids:['root'],t:'5. Run root.sh on each node when asked, the first node first and then the others, one at a time.',w:'It configures and starts the stack for the first time.',s:'Order matters: finish node 1 before node 2.',x:'Running root.sh on two nodes at once causes failures.',c:`# /u01/app/19.0.0/grid/root.sh`},
 {ids:['chk','db'],t:'6. Verify the stack on every node, then install the database software and create the RAC database.',w:'You now have a cluster you can trust to host a database.',s:'`crsctl stat res -t`, DBCA.',x:'A resource OFFLINE after install is the thing to fix before continuing.',c:`$ crsctl stat res -t`}]}},

{h:'2. Connecting through the SCAN and load balancing'},
{map:{title:'Connection flow map',h:216,trace:'Follow a connection',
 hint:'Tap any box, or press Follow a connection to see how a new session finds an instance.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'dns',x:21,y:24,w:194,h:56,c:'ext',t:'Name lookup',s:'SCAN in DNS',d:'The client resolves the SCAN name and receives up to three addresses in rotating order.',why:'It is what spreads connections over the SCAN listeners.',chk:`$ nslookup rac-scan.example.com`,see:[5,5,'Services, SCAN and VIPs from the client view']},
 {id:'scanl',x:243,y:24,w:194,h:56,c:'proc',t:'SCAN listener',s:'receives the request',d:'The client connects to one of the SCAN listeners and asks for a service name.',why:'SCAN listeners run on up to three nodes.',chk:`$ lsnrctl status LISTENER_SCAN1`,see:[5,5,'Services, SCAN and VIPs from the client view']},
 {id:'load',x:465,y:24,w:194,h:56,c:'mem',t:'Load information',s:'from instances',d:'Each instance registers its services and its load with all SCAN listeners through REMOTE_LISTENER.',why:'It lets the listener choose the least loaded instance.',chk:`SHOW PARAMETER remote_listener`,see:[7,1,'Client-side and server-side connection load balancing']},
 {id:'redir',x:21,y:136,w:194,h:56,c:'proc',t:'Redirect',s:'to a node listener',d:'The SCAN listener replies with the address of the node VIP and listener of the chosen instance.',why:'The client reconnects there.',chk:`$ srvctl status listener`,see:[7,1,'Client-side and server-side connection load balancing']},
 {id:'locl',x:243,y:136,w:194,h:56,c:'proc',t:'Local listener',s:'on the chosen node',d:'The node listener receives the redirected connection for the service.',why:'If this listener is down the connection fails after the redirect.',chk:`$ lsnrctl services`,see:[5,5,'Services, SCAN and VIPs from the client view']},
 {id:'srv',x:465,y:136,w:194,h:56,c:'mem',t:'Server process',s:'session starts',d:'A server process starts on that instance and the client session is established.',why:'The connection is now bound to this instance.',chk:`SELECT inst_id, service_name, COUNT(*) FROM gv$session WHERE type = 'USER' GROUP BY inst_id, service_name;`,see:[5,5,'Services, SCAN and VIPs from the client view']}],
 steps:[
 {ids:['dns','scanl'],t:'1. The client resolves the SCAN name and connects to the first address returned, requesting a service.',w:'It needs only the SCAN name and the service.',s:'DNS round robin, `LOAD_BALANCE` in the client descriptor.',x:'Using a node name here defeats the whole mechanism.',c:`$ tnsping rac-scan.example.com`},
 {ids:['scanl','load'],t:'2. The SCAN listener looks at which instances offer the service and which are least loaded.',w:'The decision uses data pushed by the instances.',s:'`CLB_GOAL` (SHORT or LONG), `RLB_GOAL`.',x:'Stale registration shows as ORA-12514 or connections always going to one node.',c:`SELECT name, goal, clb_goal FROM dba_services;`},
 {ids:['redir'],t:'3. The SCAN listener redirects the client to the VIP and listener of the chosen node.',w:'The redirect is quick and transparent.',s:'Node VIPs, `LOCAL_LISTENER`.',x:'A VIP that is on the wrong node or offline fails the redirect.',c:`$ srvctl status vip -n node1`},
 {ids:['locl','srv'],t:'4. The node listener starts a server process and hands the connection to it. The session begins.',w:'The client has a normal session.',s:'Dedicated or shared server configuration.',x:'ORA-12516 or ORA-12520 mean the instance has no capacity for new processes.',c:`SELECT name, value FROM v$parameter WHERE name IN ('processes','sessions');`},
 {ids:['srv'],t:'5. For long-lived pools, the load balancing advisory keeps adjusting which instance new connections favour.',w:'It stops a pool from piling onto the slower node.',s:'RLB_GOAL (SERVICE_TIME, THROUGHPUT).',x:'A static pool that never refreshes ignores the advisory.',c:`SELECT inst_id, COUNT(*) FROM gv$session WHERE service_name = 'APP_RW' GROUP BY inst_id;`}]}},

{h:'3. A node eviction'},
{map:{title:'Node eviction map',h:216,trace:'Follow an eviction',
 hint:'Tap any box, or press Follow an eviction to see what the cluster does when a node stops responding.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'miss',x:21,y:24,w:194,h:56,c:'warn',t:'Heartbeat missed',s:'network or disk',d:'A node stops sending network heartbeats, or cannot update its disk heartbeat in the voting files.',why:'Typical causes: private network loss, a hung node, or lost storage path.',chk:`$ grep -i 'heartbeat' $ORACLE_BASE/diag/crs/$(hostname -s)/crs/trace/ocssd.trc | tail`,see:[8,2,'Node eviction: causes and diagnosis']},
 {id:'timer',x:243,y:24,w:194,h:56,c:'mem',t:'Timeout',s:'misscount, 30 s',d:'CSSD waits for the timeout. The network heartbeat limit is misscount, and the disk heartbeat limit is disktimeout.',why:'The cluster waits so that short blips do not cause evictions.',chk:`$ crsctl get css misscount
$ crsctl get css disktimeout`,see:[2,3,'Node membership, heartbeats and eviction basics']},
 {id:'vote',x:465,y:24,w:194,h:56,c:'proc',t:'Decision',s:'the voting files',d:'The surviving nodes agree on the new membership using the voting files, so only one sub-cluster survives.',why:'This avoids a split brain where two halves both write to storage.',chk:`$ crsctl query css votedisk`,see:[2,1,'Voting files and the Oracle Cluster Registry']},
 {id:'fence',x:21,y:136,w:194,h:56,c:'warn',t:'Fencing',s:'stop or reboot',d:'The evicted node is stopped. Newer releases first try to stop the stack without a reboot, and reboot if that fails.',why:'It guarantees that the node cannot write to shared storage.',chk:`$ last reboot | head -3`,see:[8,2,'Node eviction: causes and diagnosis']},
 {id:'rest',x:243,y:136,w:194,h:56,c:'proc',t:'Recovery',s:'surviving nodes',d:'The survivors remaster the Global Resource Directory, recover the lost instance redo and relocate VIPs and services.',why:'Work continues on the remaining nodes.',chk:`SELECT inst_id, status FROM gv$instance;`,see:[5,1,'Instances, threads, redo and undo per node']},
 {id:'rej',x:465,y:136,w:194,h:56,c:'ext',t:'Rejoin',s:'after repair',d:'When the node is healthy again it restarts the stack, rejoins the cluster and its resources start.',why:'Confirm the cause is fixed before this, or it repeats.',chk:`$ crsctl check cluster -all`,see:[8,2,'Node eviction: causes and diagnosis']}],
 steps:[
 {ids:['miss'],t:'1. A node stops responding on the private network. Its heartbeat messages no longer reach the other nodes.',w:'The cluster cannot tell a dead node from an unreachable one.',s:'Private network health, `misscount`.',x:'A bad NIC, switch or MTU mismatch is the usual cause.',c:`$ oifcfg getif`},
 {ids:['timer'],t:'2. CSSD waits for the misscount time (30 seconds by default), counting down while it keeps trying.',w:'It prevents false evictions from short pauses.',s:'`crsctl set css misscount` (only on advice from support).',x:'A node that is paused by the VM or by swapping looks identical to a dead one.',c:`$ crsctl get css misscount`},
 {ids:['vote'],t:'3. The nodes use the voting files to decide which nodes form the surviving cluster. The majority wins, and a single node loses.',w:'It prevents two groups from writing at once.',s:'Number and placement of voting files.',x:'Two voting files on one array give no protection from that array failing.',c:`$ crsctl query css votedisk`},
 {ids:['fence'],t:'4. The losing node is evicted and fenced: its stack is stopped, and it is rebooted if needed.',w:'The shared storage is protected.',s:'Reboot-less fencing, IPMI fencing.',x:'The reboot looks like a crash. The reason is in the logs of both nodes.',c:`$ grep -i 'evict' $ORACLE_BASE/diag/crs/*/crs/trace/alert*.log | tail`},
 {ids:['rest'],t:'5. The survivors recover the failed instance, remaster resources and relocate VIPs and services. Users reconnect.',w:'The database stays available.',s:'Instance recovery, FAN, services.',x:'An overloaded surviving node can then be evicted too.',c:`SELECT inst_id, status FROM gv$instance;`},
 {ids:['rej'],t:'6. After the fix the node restarts its stack and rejoins. You collect the logs with TFA first, to prove the cause.',w:'An eviction with an unknown cause will come back.',s:'`tfactl diagcollect`, `crsctl start cluster`.',x:'Skipping the diagnosis and restarting is how evictions become routine.',c:`$ tfactl diagcollect -last 2h`}]}},

{h:'4. An instance fails and is recovered'},
{map:{title:'Instance recovery map',h:216,trace:'Recover a failed instance',
 hint:'Tap any box, or press Recover a failed instance to follow what the surviving instance does.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'fail',x:21,y:24,w:194,h:56,c:'warn',t:'Instance fails',s:'crash or abort',d:'An instance stops: a process dies, SHUTDOWN ABORT, or the node fails.',why:'Its cached blocks and locks are gone.',chk:`SELECT inst_id, status FROM gv$instance;`,see:[5,1,'Instances, threads, redo and undo per node']},
 {id:'lmon',x:243,y:24,w:194,h:56,c:'proc',t:'LMON detects',s:'membership',d:'The Global Enqueue Service monitor on a surviving instance notices that a member has left.',why:'It starts a reconfiguration.',chk:`SELECT event, total_waits FROM v$system_event WHERE event LIKE 'reconfiguration%';`,see:[5,2,'Global Cache Services and Global Enqueue Services']},
 {id:'freeze',x:465,y:24,w:194,h:56,c:'mem',t:'GRD frozen',s:'brief pause',d:'The Global Resource Directory is frozen briefly while it is rebuilt without the failed instance.',why:'Cluster-wide operations pause for a few seconds.',chk:`SELECT event, total_waits FROM gv$system_event WHERE event LIKE 'gcs%freeze%';`,see:[5,2,'Global Cache Services and Global Enqueue Services']},
 {id:'recov',x:21,y:136,w:194,h:56,c:'proc',t:'Instance recovery',s:'by a survivor',d:'A surviving instance reads the redo thread of the failed instance, rolls forward and rolls back uncommitted work.',why:'It can run in parallel with ongoing user work.',chk:`SELECT inst_id, thread#, status FROM gv$thread;`,see:[5,1,'Instances, threads, redo and undo per node']},
 {id:'done',x:243,y:136,w:194,h:56,c:'mem',t:'GRD unfrozen',s:'locks released',d:'Once the blocks needing recovery are fixed the resources are available again.',why:'Blocks the failed instance had locked now become available.',chk:`SELECT inst_id, name, value FROM gv$sysstat WHERE name LIKE 'recovery%';`,see:[5,2,'Global Cache Services and Global Enqueue Services']},
 {id:'svc',x:465,y:136,w:194,h:56,c:'ext',t:'Services and clients',s:'reconnect',d:'Services run on the survivors, FAN has told clients and they reconnect. Clusterware restarts the failed instance.',why:'Full capacity returns when the instance is back.',chk:`$ srvctl status database -d orcl -v`,see:[7,2,'Fast Application Notification and ONS']}],
 steps:[
 {ids:['fail'],t:'1. An instance fails abruptly. Sessions on it are lost and uncommitted work is not committed.',w:'It could be a node, a process, or a software fault.',s:'None. It is the event.',x:'The cause is in the instance alert log.',c:`$ tail -100 $ORACLE_BASE/diag/rdbms/orcl/orcl1/trace/alert_orcl1.log`},
 {ids:['lmon','freeze'],t:'2. LMON on a surviving instance detects the loss and starts a reconfiguration. The GRD is frozen for a short time.',w:'The cluster agrees on who is left and who masters what.',s:'Instance membership, `_lm_*` parameters (internal).',x:'Long freezes point to an overloaded interconnect or CPU starvation.',c:`SELECT * FROM v$dlm_misc WHERE name LIKE '%reconf%';`},
 {ids:['recov'],t:'3. A surviving instance recovers the failed one: it applies the redo of the failed thread and rolls back uncommitted transactions.',w:'It restores consistency of the shared database.',s:'`FAST_START_MTTR_TARGET`, `FAST_START_PARALLEL_ROLLBACK`, redo size.',x:'A large redo thread or long transactions lengthen recovery.',c:`SELECT * FROM gv$instance_recovery;`},
 {ids:['done'],t:'4. The affected blocks are recovered and the locks are released. Other sessions are not blocked for long.',w:'Only blocks needing recovery are unavailable, and only until fixed.',s:'Parallel recovery.',x:'Sessions touching those blocks wait, so some slow requests are expected.',c:`SELECT event, total_waits FROM gv$system_event WHERE event LIKE 'gc%' ORDER BY 2 DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['svc'],t:'5. Services run on the survivors, clients reconnect, and Clusterware restarts the failed instance, which then rejoins.',w:'The cluster returns to full capacity.',s:'Service failback, `srvctl`, restart policy.',x:'A crash loop means there is a persistent fault to find.',c:`$ srvctl status service -db orcl`}]}},

{h:'5. Planned maintenance with draining'},
{map:{title:'Drain and maintain map',h:216,trace:'Take a node out cleanly',
 hint:'Tap any box, or press Take a node out cleanly to follow a planned stop with no errors for users.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'plan',x:21,y:24,w:194,h:56,c:'ext',t:'Plan',s:'window and capacity',d:'Confirm the other nodes can carry the whole workload and tell the owners.',why:'The remaining nodes must hold the load.',chk:`SELECT inst_id, COUNT(*) FROM gv$session WHERE type = 'USER' GROUP BY inst_id;`,see:[6,6,'Rolling restarts and maintenance']},
 {id:'drain',x:243,y:24,w:194,h:56,c:'proc',t:'Drain',s:'stop the service',d:'Stop the service on the node with a drain timeout. New connections go to other instances.',why:'Existing sessions are given time to finish.',chk:`$ srvctl stop service -db orcl -service app_rw -instance orcl1 -drain_timeout 60 -stopoption IMMEDIATE`,see:[7,5,'Draining sessions before maintenance']},
 {id:'wait',x:465,y:24,w:194,h:56,c:'mem',t:'Wait',s:'sessions leave',d:'Sessions end their requests and are moved or closed at a safe point. FAN tells pools to release them.',why:'Only long idle sessions remain.',chk:`SELECT inst_id, COUNT(*) FROM gv$session WHERE service_name = 'APP_RW' GROUP BY inst_id;`,see:[7,5,'Draining sessions before maintenance']},
 {id:'stop',x:21,y:136,w:194,h:56,c:'proc',t:'Stop instance',s:'srvctl',d:'Stop the instance with srvctl, so Clusterware knows it was intentional.',why:'Do not use SQL*Plus SHUTDOWN here.',chk:`$ srvctl stop instance -db orcl -instance orcl1 -stopoption IMMEDIATE`,see:[6,1,'srvctl: starting, stopping and status']},
 {id:'work',x:243,y:136,w:194,h:56,c:'warn',t:'Maintenance',s:'patch or change',d:'Patch, change or repair the node while the others serve users.',why:'Keep the window short, because there is no node redundancy now.',chk:`$ opatchauto apply /patches/36000000`,see:[9,0,'Rolling patching with opatchauto']},
 {id:'back',x:465,y:136,w:194,h:56,c:'proc',t:'Start and rebalance',s:'services back',d:'Start the instance and its services, and let load return.',why:'Check the services are on the right instances.',chk:`$ srvctl start instance -db orcl -instance orcl1
$ srvctl start service -db orcl`,see:[6,6,'Rolling restarts and maintenance']}],
 steps:[
 {ids:['plan'],t:'1. Check capacity: what the remaining nodes can carry, what is running on the node and who must be told.',w:'A drain with insufficient capacity is an outage.',s:'Capacity and service design.',x:'Batch jobs pinned to the node will be cut off.',c:`SELECT service_name, inst_id FROM gv$session GROUP BY service_name, inst_id;`},
 {ids:['drain'],t:'2. Stop the service on the node with a drain timeout. Clients stop receiving new connections there.',w:'It is the step that makes the rest invisible.',s:'`-drain_timeout`, `-stopoption`.',x:'Applications not using a service cannot be drained.',c:`$ srvctl stop service -db orcl -service app_rw -instance orcl1 -drain_timeout 60`},
 {ids:['wait'],t:'3. Wait for sessions to leave. Pools using FAN release them as they become idle.',w:'Users keep working on the other nodes.',s:'Drain timeout, connection pool settings.',x:'Sessions that never go idle must be killed or are cut at the timeout.',c:`SELECT COUNT(*) FROM gv$session WHERE inst_id = 1 AND service_name = 'APP_RW';`},
 {ids:['stop','work'],t:'4. Stop the instance with srvctl and do the maintenance, such as a rolling patch of the Grid and database homes.',w:'The rest of the cluster is not affected.',s:'`srvctl stop instance`, `opatchauto`.',x:'A forgotten step leaves the node in an unusual state for clusterware.',c:`$ srvctl status database -d orcl -v`},
 {ids:['back'],t:'5. Start the instance and services, check resources and the load, and then move to the next node if there is one.',w:'The cluster returns to full capacity.',s:'`srvctl start`, `crsctl stat res -t`.',x:'Services that failed back to the wrong place need a relocate.',c:`$ srvctl status service -db orcl`}]}},

{h:'6. Rolling patching with opatchauto'},
{map:{title:'Rolling patch map',h:216,trace:'Patch a cluster node by node',
 hint:'Tap any box, or press Patch a cluster node by node to follow a release update through two nodes.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'pre',x:20,y:24,w:139,h:56,c:'ext',t:'Prepare',s:'backup and check',d:'Read the README, check OPatch version, take backups and run the pre-checks.',why:'Know the way back before you start.',chk:`$ opatchauto apply /patches/36000000 -analyze`,see:[9,0,'Rolling patching with opatchauto']},
 {id:'n1',x:187,y:24,w:139,h:56,c:'proc',t:'Patch node 1',s:'opatchauto as root',d:'opatchauto stops the stack on the node, patches the Grid home and database homes, and restarts the stack.',why:'The other node serves all users meanwhile.',chk:`# opatchauto apply /patches/36000000`,see:[9,0,'Rolling patching with opatchauto']},
 {id:'chk1',x:354,y:24,w:139,h:56,c:'mem',t:'Verify node 1',s:'resources up',d:'Check the stack, the resources and the patch level before moving on.',why:'A problem here is easy to fix, on one node.',chk:`$ crsctl check cluster -all
$ opatch lspatches`,see:[9,0,'Rolling patching with opatchauto']},
 {id:'n2',x:521,y:24,w:139,h:56,c:'proc',t:'Patch node 2',s:'same again',d:'Repeat on the second node, which now serves users from the patched first node.',why:'The cluster is in mixed versions for the duration of the window.',chk:`# opatchauto apply /patches/36000000`,see:[9,0,'Rolling patching with opatchauto']},
 {id:'chk2',x:21,y:136,w:194,h:56,c:'mem',t:'Verify all',s:'cluster level',d:'Confirm the active and release versions of the cluster.',why:'It shows that everything is patched.',chk:`$ crsctl query crs activeversion -f
$ crsctl query crs releasepatch`,see:[9,0,'Rolling patching with opatchauto']},
 {id:'dp',x:243,y:136,w:194,h:56,c:'proc',t:'datapatch',s:'once, on one node',d:'Run datapatch to apply the SQL part of the patch to the database, from one instance only.',why:'It is done once for the database, not per node.',chk:`$ $ORACLE_HOME/OPatch/datapatch -verbose`,see:[9,0,'Rolling patching with opatchauto']},
 {id:'rb',x:465,y:136,w:194,h:56,c:'warn',t:'Fallback',s:'rollback plan',d:'If a node fails verification, roll its patch back with opatchauto rollback, or switch back to the old home for out-of-place patching.',why:'Out-of-place patching makes the fallback trivial.',chk:`# opatchauto rollback /patches/36000000`,see:[9,2,'Out-of-place patching and switching homes']}],
 steps:[
 {ids:['pre'],t:'1. Prepare: read the README, update OPatch, check space, back up the homes and run opatchauto in analyze mode.',w:'Most failures are found here and not mid-patch.',s:'OPatch version, free space, `-analyze`.',x:'An old OPatch is the most common cause of a failed start.',c:`$ opatchauto apply /patches/36000000 -analyze`},
 {ids:['n1'],t:'2. Patch node 1: services drain, the stack stops, homes are patched and the stack restarts.',w:'The cluster keeps running on the other node.',s:'`opatchauto apply`, drain settings.',x:'If services are not defined, users see errors on the node being stopped.',c:`# opatchauto apply /patches/36000000`},
 {ids:['chk1'],t:'3. Verify node 1 completely before touching node 2.',w:'It limits a problem to one node.',s:'`crsctl check cluster`, `opatch lspatches`.',x:'Moving on with an unhealthy node 1 leaves no good node.',c:`$ crsctl stat res -t`},
 {ids:['n2'],t:'4. Patch node 2 in the same way. Users run on node 1, which already has the patch.',w:'The second half of the rolling window.',s:'Same procedure.',x:'Mixed patch levels are supported only for the rolling patches documented as such.',c:`# opatchauto apply /patches/36000000`},
 {ids:['chk2','dp'],t:'5. Check the cluster versions and run datapatch once to update the database dictionary.',w:'The binaries and the data dictionary must agree.',s:'`datapatch -verbose`, `dba_registry_sqlpatch`.',x:'Forgetting datapatch leaves the SQL side unpatched and shows later.',c:`SELECT patch_id, action, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 3 ROWS ONLY;`},
 {ids:['rb'],t:'6. If a problem appears, roll back the patch on the affected node, or switch back to the old home if you patched out of place.',w:'A tested fallback keeps a patch from becoming an incident.',s:'`opatchauto rollback`, `gridSetup.sh -switchGridHome`.',x:'Rollback of a patch that datapatch already applied needs a rollback of the SQL part too.',c:`# opatchauto rollback /patches/36000000`}]}},

{h:'7. Diagnosing slow cluster waits'},
{map:{title:'Cluster wait diagnosis map',h:216,trace:'Find the cause of gc waits',
 hint:'Tap any box, or press Find the cause of gc waits to follow the checks from a symptom to a cause.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'top',x:21,y:24,w:194,h:56,c:'warn',t:'Top events',s:'AWR or ASH',d:'Look at the top wait events. Which gc events are in the top five and what is their average wait?',why:'Averages above a few milliseconds point at infrastructure.',chk:`SELECT event, total_waits, ROUND(time_waited_micro/NULLIF(total_waits,0)) AS avg_us FROM gv$system_event WHERE event LIKE 'gc%' ORDER BY time_waited_micro DESC FETCH FIRST 8 ROWS ONLY;`,see:[8,3,'Interconnect and gc wait troubleshooting']},
 {id:'kind',x:243,y:24,w:194,h:56,c:'mem',t:'Which kind',s:'cr, current, busy',d:'gc cr and gc current waits are block transfers. gc buffer busy waits mean contention for the same block.',why:'The fix differs: infrastructure versus application design.',chk:`SELECT event, total_waits FROM gv$system_event WHERE event LIKE 'gc buffer busy%' OR event LIKE 'gc cr%' OR event LIKE 'gc current%';`,see:[5,3,'Cache Fusion: how blocks move between nodes']},
 {id:'net',x:465,y:24,w:194,h:56,c:'ext',t:'Interconnect',s:'latency and loss',d:'Check latency, bandwidth, packet loss and MTU on the private network. A lost block shows in gc blocks lost.',why:'It is the commonest cause of high averages.',chk:`SELECT inst_id, name, value FROM gv$sysstat WHERE name IN ('gc blocks lost','gc blocks corrupt');`,see:[5,4,'The interconnect and why it matters']},
 {id:'cpu',x:21,y:136,w:194,h:56,c:'proc',t:'LMS and CPU',s:'starved servers',d:'LMS processes need CPU promptly. A node at 100% CPU delays block transfers for everyone.',why:'Fix the CPU load before blaming the network.',chk:`SELECT inst_id, name, value FROM gv$osstat WHERE stat_name IN ('LOAD','NUM_CPUS');`,see:[8,3,'Interconnect and gc wait troubleshooting']},
 {id:'hot',x:243,y:136,w:194,h:56,c:'proc',t:'Hot blocks',s:'application design',d:'The same blocks being changed from many instances: sequences without cache, right-growing indexes, small hot tables.',why:'These are application patterns, and the fix is design, not hardware.',chk:`SELECT owner, object_name, statistic_name, value FROM v$segment_statistics WHERE statistic_name LIKE 'gc%' ORDER BY value DESC FETCH FIRST 5 ROWS ONLY;`,see:[5,3,'Cache Fusion: how blocks move between nodes']},
 {id:'fix',x:465,y:136,w:194,h:56,c:'ext',t:'Fix and re-measure',s:'one change at a time',d:'Fix the network, move work with services, cache sequences, hash partition hot indexes, and measure again.',why:'Without a measurement before and after, you cannot tell it worked.',chk:`SELECT service_name, inst_id FROM gv$session WHERE type = 'USER' GROUP BY service_name, inst_id;`,see:[8,6,'Troubleshooting method for cluster problems']}],
 steps:[
 {ids:['top'],t:'1. Take the top events for the period of the complaint. Note the gc events and compare their average wait with the I/O waits.',w:'It frames the problem in numbers.',s:'AWR report, ASH, `GV$SYSTEM_EVENT`.',x:'Looking at totals only and not averages hides the difference between a slow and a busy interconnect.',c:`SELECT event, average_wait FROM v$system_event WHERE event LIKE 'gc%';`},
 {ids:['kind'],t:'2. Separate transfer waits (gc cr, gc current) from contention waits (gc buffer busy).',w:'They have different causes.',s:'AWR RAC statistics section.',x:'Treating busy waits as network problems wastes days.',c:`SELECT event, total_waits FROM gv$system_event WHERE event LIKE 'gc buffer busy%';`},
 {ids:['net'],t:'3. For slow or lost transfers, check the interconnect: latency, packet drops, MTU and bandwidth.',w:'It is the physical layer under Cache Fusion.',s:'Jumbo frames, bonding, `CLUSTER_INTERCONNECTS`.',x:'An MTU mismatch fragments large blocks and looks like random slowness.',c:`$ ping -M do -s 8972 node2-priv`},
 {ids:['cpu'],t:'4. Check CPU on each node and the state of LMS processes. A starved LMS delays everyone.',w:'Slow servers look like a slow network.',s:'`_lms_*` and `LMS` priority, CPU capacity.',x:'A node doing a heavy batch can slow the whole cluster.',c:`SELECT inst_id, ROUND(value,1) FROM gv$osstat WHERE stat_name = 'LOAD';`},
 {ids:['hot'],t:'5. For busy waits, find the hot segments and the SQL that touches them. Common patterns are sequences, right-growing indexes and small tables.',w:'The fix is in the application or the design.',s:'`CACHE` for sequences, hash partitioning, services for affinity.',x:'Adding nodes makes hot-block contention worse, not better.',c:`SELECT object_name, value FROM v$segment_statistics WHERE statistic_name = 'gc buffer busy acquire' ORDER BY value DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['fix'],t:'6. Change one thing, then measure again with the same report. Keep the before and after for the record.',w:'It proves the change helped.',s:'AWR baselines.',x:'Several changes at once make the result uninterpretable.',c:`SELECT snap_id, begin_interval_time FROM dba_hist_snapshot ORDER BY snap_id DESC FETCH FIRST 5 ROWS ONLY;`}]}},

]},

/* 1 ---------------------------------------------------------------- processes */
{t:'Clusterware, ASM and RAC processes',d:'The daemons on each node, who starts whom and where to look when one misbehaves.',see:[[2,0,'The Clusterware stack'],[5,2,'GCS and GES']],b:[
{h:'Clusterware stack'},
{t:[['Daemon','Layer','Job','Look here'],
['`ohasd`','Lower stack','Oracle High Availability Services: starts the whole stack at boot, root-owned','`crsctl check has`, `ohasd.log`'],
['`orarootagent`, `oraagent`','Both','Agents that start and monitor resources as root and as the software owner','Agent logs'],
['`cssd`, `cssdagent`, `cssdmonitor`','Lower','Cluster Synchronization Services: node membership, voting files, heartbeats','`ocssd.trc`'],
['`gpnpd`','Lower','Grid Plug and Play profile','`gpnpd.trc`'],
['`mdnsd`','Lower','Multicast DNS name resolution','`mdnsd.trc`'],
['`gipcd`','Lower','Grid IPC, interconnect messaging','`gipcd.trc`'],
['`octssd`','Lower','Cluster Time Synchronization (observer or active)','`octssd.trc`'],
['`evmd`','Upper','Event manager, publishes cluster events','`evmd.trc`'],
['`crsd`','Upper','Cluster Ready Services: manages resources (databases, services, VIPs, SCAN)','`crsd.trc`'],
['`ons`','Upper','Oracle Notification Service for FAN events','`ons.log`'],
['`tnslsnr`','Upper','Node and SCAN listeners','listener logs'],
['`asm_*`','Upper','ASM instance background processes','ASM alert log']]},
{h:'RAC instance processes'},
{t:[['Process','Job'],
['LMON','Global enqueue service monitor, membership of instances'],
['LMD','Global enqueue service daemon (lock requests)'],
['LMSn','Global cache service: ships blocks between instances (Cache Fusion)'],
['LCK0','Instance enqueue process for non-Cache Fusion resources'],
['DIAG, DIA0','Diagnostics across instances'],
['RMSn, LGWR, DBWn and the usual set','As on a single instance']]},
{note:'Lower stack runs as root and starts first. The upper stack (CRSD) needs the shared storage and the voting files to be available.'}
]},

/* 2 ---------------------------------------------------------------- files */
{t:'Files and what they hold',d:'The cluster-wide and node-local files you must know and how to back them up.',see:[[2,1,'Voting files and OCR'],[2,2,'GPnP and the profile']],b:[
{t:[['File','Holds','Where','Backup'],
['OCR (Oracle Cluster Registry)','Cluster configuration: resources, nodes, databases, services','ASM disk group (often `+CRS` or `+DATA`)','Automatic every 4 hours, plus `ocrconfig -manualbackup`'],
['Voting files','Node membership heartbeats on disk','ASM disk group (odd number of copies)','Included with the disk group metadata; restore via `crsctl`'],
['OLR (Oracle Local Registry)','Local node resource info for the lower stack','`$GRID_HOME/cdata/<host>.olr`, see `/etc/oracle/olr.loc`','`ocrconfig -local -manualbackup`'],
['GPnP profile','Cluster name, networks, ASM discovery string, voting location','`$GRID_HOME/gpnp/<host>/profiles/peer/profile.xml`','Copy kept on each node'],
['ASM SPFILE','ASM parameters','In ASM (`+CRS`)','Part of OCR backup scope with `asmcmd spget`'],
['ASM password file','Administrative users for ASM','In ASM or on shared storage','`asmcmd pwget`'],
['Database SPFILE, control files, redo, datafiles','Shared database','ASM disk groups','RMAN'],
['`/etc/oratab`','Local homes and `+ASM1`, database SIDs','Each node','OS backup'],
['`$GRID_HOME`','Grid Infrastructure software','Local disk (or ACFS in some designs)','Gold image'],
['`$ORACLE_BASE/diag/crs/<host>`','Cluster logs and traces','Local','Logs']]},
{code:`ocrcheck
ocrcheck -local
ocrconfig -showbackup
crsctl query css votedisk
asmcmd spget
asmcmd pwget --asm`}
]},

/* 3 ---------------------------------------------------------------- logs */
{t:'Log files and where to find them',d:'Where each daemon and each tool writes, and the tool that collects them.',see:[[8,4,'Cluster logs, TFA and AHF'],[2,5,'Startup sequence and log locations']],b:[
{t:[['Log','Contents','Location'],
['Clusterware alert','Main cluster event log: start, stop, evictions','`$ORACLE_BASE/diag/crs/<host>/crs/trace/alert.log`'],
['CSS','Heartbeat, membership, eviction details','`.../crs/trace/ocssd.trc`'],
['CRS','Resource start, stop, failures','`.../crs/trace/crsd.trc`'],
['EVM','Cluster events','`.../crs/trace/evmd.trc`'],
['OHASD','Lower stack start-up','`.../crs/trace/ohasd.trc`'],
['Agents','Resource agent actions','`.../crs/trace/crsd_oraagent_<user>.trc`'],
['ASM alert','Disk group mount, rebalance, errors','`$ORACLE_BASE/diag/asm/+asm/+ASM1/trace/alert_+ASM1.log`'],
['Database alert','Instance events, GCS errors','`.../diag/rdbms/<db>/<SID>/trace/alert_<SID>.log`'],
['Listener and SCAN listener','Connections and services','`.../diag/tnslsnr/<host>/<listener>/trace/`'],
['Install and root script logs','`gridSetup`, `root.sh`','`oraInventory/logs`, `$GRID_HOME/install`'],
['Cluster Health Advisor','Model diagnoses','`chactl` output'],
['AHF / TFA collections','Diagnostic bundles','`tfactl diagcollect`']]},
{code:`# the cluster alert, last lines
tail -100 $ORACLE_BASE/diag/crs/$(hostname -s)/crs/trace/alert.log

# collect everything for a Service Request
tfactl diagcollect -since 4h
ahfctl compliance`}
]},

/* 4 ---------------------------------------------------------------- parameters */
{t:'Important parameters',d:'RAC database parameters, ASM parameters and key disk group attributes.',see:[[6,2,'Shared and instance-specific parameters'],[4,5,'Disk group attributes']],b:[
{h:'RAC database'},
{t:[['Parameter','Scope','Note'],
['`cluster_database`','Shared','`TRUE` for RAC'],
['`cluster_database_instances`','Shared','Number of instances'],
['`instance_number`, `thread`','Per instance','Unique per instance'],
['`instance_name`','Per instance','`ORCL1`, `ORCL2`'],
['`undo_tablespace`','Per instance','One undo tablespace per instance'],
['`local_listener`','Per instance','Node VIP listener'],
['`remote_listener`','Shared','SCAN name and port'],
['`cluster_interconnects`','Per instance','Only to override the default interconnect'],
['`gcs_server_processes`','Shared','LMS process count'],
['`parallel_force_local`','Shared','Keep parallel slaves on one instance'],
['`db_unique_name`, `service_names`','Shared','Use services, not this parameter']]},
{h:'ASM instance'},
{t:[['Parameter','Typical','Note'],
['`instance_type`','`ASM`','Fixed'],
['`asm_diskstring`','`/dev/oracleasm/*` or `AFD:*`','Where to find disks'],
['`asm_diskgroups`','Auto','Disk groups to mount at start'],
['`asm_power_limit`','1','Default rebalance power (1 to 1024)'],
['`asm_preferred_read_failure_groups`','Unset','Read from local failure group (stretch clusters)'],
['`sga_target`, `memory_target`','Check sizing for your release','Small, but not too small']]},
{h:'Disk group attributes'},
{t:[['Attribute','Meaning'],
['`compatible.asm`, `compatible.rdbms`','Feature level; raise only as needed (one way)'],
['`au_size`','Allocation unit size (fixed at creation)'],
['`disk_repair_time`','How long a failed disk may be offline before drop (default 3.6 h)'],
['`content.type`','`DATA`, `RECOVERY`, `SYSTEM` for failure group placement'],
['`cell.smart_scan_capable`','Exadata storage offload']]}
]},

/* 5 ---------------------------------------------------------------- views */
{t:'System views',d:'Which view answers which cluster or ASM question. GV$ views span all instances.',see:[[5,1,'Instances, threads, redo and undo'],[4,6,'ASMCMD and SQL*Plus administration']],b:[
{t:[['Question','View or command'],
['Which instances are up?','`GV$INSTANCE`'],
['Cluster-wide sessions','`GV$SESSION`'],
['Interconnect in use?','`V$CLUSTER_INTERCONNECTS`, `GV$CLUSTER_INTERCONNECTS`'],
['Which services are active?','`GV$ACTIVE_SERVICES`, `DBA_SERVICES`'],
['Global cache activity','`GV$CR_BLOCK_SERVER`, `GV$CURRENT_BLOCK_SERVER`, `GV$GC_ELEMENT`'],
['Global enqueues','`GV$GES_ENQUEUE`, `GV$GES_BLOCKING_ENQUEUE`'],
['Wait events across nodes','`GV$SYSTEM_EVENT`, `GV$ACTIVE_SESSION_HISTORY`'],
['Which disk groups?','`V$ASM_DISKGROUP`, `V$ASM_DISKGROUP_STAT`'],
['Which disks?','`V$ASM_DISK`, `V$ASM_DISK_STAT`'],
['Rebalance progress','`V$ASM_OPERATION`'],
['Clients of ASM','`V$ASM_CLIENT`'],
['Disk group attributes','`V$ASM_ATTRIBUTE`'],
['Files in ASM','`V$ASM_FILE`, `V$ASM_ALIAS`'],
['Templates and redundancy','`V$ASM_TEMPLATE`'],
['Global enqueue statistics','`GV$GES_STATISTICS`'],
['Cluster resources from the OS','`crsctl stat res -t`']]},
{note:'Always add `inst_id` to GV$ output. An interpretation without the instance is a guess.'}
]},

/* 6 ---------------------------------------------------------------- tools */
{t:'Command-line tools',d:'The cluster tools you use daily and a typical command for each.',see:[[8,0,'crsctl, ocrcheck, ocrconfig'],[6,1,'srvctl']],b:[
{t:[['Tool','Use','Typical command'],
['`crsctl`','Control the clusterware stack and resources','`crsctl check cluster -all`'],
['`crsctl stat res -t`','All resources in a table','`crsctl stat res -t`'],
['`crsctl stop/start crs`','Stop or start the stack on a node (as root)','`crsctl stop crs`'],
['`srvctl`','Manage databases, instances, services, listeners, SCAN, ASM','`srvctl status database -db orcl -v`'],
['`olsnodes`','List nodes','`olsnodes -n -i -s -t`'],
['`ocrcheck`, `ocrconfig`','OCR integrity, backups, restore','`ocrcheck`; `ocrconfig -showbackup`'],
['`oifcfg`','Network interfaces for the cluster','`oifcfg getif`'],
['`cluvfy`','Verify prerequisites and health','`cluvfy stage -pre crsinst -n n1,n2`'],
['`asmcmd`','ASM file and disk group commands','`asmcmd lsdg`, `asmcmd lsdsk`'],
['`asmca`','ASM GUI and silent mode','`asmca -silent -createDiskGroup ...`'],
['`gridSetup.sh`','Grid Infrastructure installer','`./gridSetup.sh -silent -responseFile ...`'],
['`tfactl` / `ahfctl`','Trace File Analyzer, AHF','`tfactl diagcollect`'],
['`chactl`','Cluster Health Advisor','`chactl query diagnosis`'],
['`opatchauto`','Patch GI and database homes, rolling','`opatchauto apply <patch dir>`'],
['`dbca`','Create and configure RAC databases','`dbca -silent -createDatabase ...`']]},
{h:'The commands you will type most'},
{code:`crsctl check cluster -all
crsctl stat res -t
srvctl status database -db orcl
srvctl status service -db orcl
srvctl config scan
olsnodes -n -s
asmcmd lsdg
ocrcheck`}
]},

/* 7 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'ASM redundancy, service design, failover technology and patching approach.',see:[[4,1,'Redundancy'],[7,3,'FCF and TAF']],b:[
{h:'ASM redundancy'},
{t:[['Type','Copies','Use'],
['External','1 (storage provides protection)','Enterprise arrays with RAID'],
['Normal','2 (mirrored)','Default for local disks and JBOD'],
['High','3','Critical data, stretch clusters'],
['Flex / Extended','Per file group','Multiple databases with different needs']]},
{h:'Failover technology'},
{t:[['Technology','What it does','Use'],
['FAN / ONS','Notifies clients of up and down events','Always on'],
['Fast Connection Failover','Pool reconnects on FAN events','Java and OCI pools'],
['TAF','Reconnects, optionally replays SELECT','Legacy, simple apps'],
['Application Continuity','Replays in-flight work transparently','Preferred for supported drivers'],
['Transparent Application Continuity','Same, with less application change','Newer releases'],
['Service drain','Moves sessions gracefully before maintenance','Planned work']]},
{h:'Patching approach'},
{t:[['Approach','Outage','Use'],
['Rolling `opatchauto`','None for service','Standard for GI and RU'],
['Out-of-place switch home','Short per node','Preferred for production'],
['Non-rolling','Whole cluster','Only if the patch requires it'],
['Standby first','Switchover only','With Data Guard']]},
{h:'Instance caging vs services vs preferred nodes'},
{t:[['Goal','Use'],
['Workload isolation','Separate services, preferred and available instances'],
['Limit CPU per instance','Instance caging (`cpu_count` and Resource Manager)'],
['Keep a batch on one node','Singleton service on one preferred instance']]}
]},

/* 8 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, likely cause and fix.',see:[[8,6,'A troubleshooting method'],[8,2,'Node eviction']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['Node evicted or rebooted','CRS alert log, `ocssd.trc`, OS logs','Missed network heartbeat or disk heartbeat, node hang','Fix interconnect or storage; see eviction notes'],
['CRS will not start','`crsctl check has`, `ohasd.log`, `crsctl check crs`','Storage or voting files unreachable, time, GPnP','Fix storage, start lower stack then upper'],
['Instance will not start on one node','Database and ASM alert logs','ASM not up, SPFILE path, permissions','Start ASM, check `srvctl config`'],
['Disk group will not mount','ASM alert log','Missing disk, wrong `asm_diskstring`','Fix discovery, `ALTER DISKGROUP ... MOUNT`'],
['Slow `gc` waits','`GV$SYSTEM_EVENT`, interconnect','Slow or busy interconnect, hot blocks','Check network, packet loss, jumbo frames, application affinity'],
['Services not on expected node','`srvctl status service`','Preferred instance down or manual relocation','`srvctl relocate service`'],
['Client cannot connect via SCAN','`srvctl status scan_listener`, DNS','SCAN listener or DNS problem','Check DNS round robin, listener'],
['VIP not failing over','`crsctl stat res -t`','Network resource offline','Fix network, `srvctl start vip`'],
['Rebalance very slow','`V$ASM_OPERATION`','Low power limit','Raise `asm_power_limit` for a while'],
['Patch rollback needed','`opatchauto rollback`','Failed or wrong patch','Roll back per README'],
['Time drift between nodes','`crsctl check ctss`, `chronyc tracking`','NTP or chrony down','Fix time sync']]}
]},

/* 9 ---------------------------------------------------------------- errors */
{t:'Common error messages',d:'Clusterware, ASM and RAC messages with meaning and first action.',see:[[8,6,'A troubleshooting method'],[4,6,'ASMCMD and SQL*Plus']],b:[
{t:[['Message','Meaning','First action'],
['CRS-4639','Could not contact Oracle High Availability Services','Start ohasd or the OS service (`crsctl start has`)'],
['CRS-4535','Cannot communicate with Cluster Ready Services','Check `crsd.trc`, storage'],
['CRS-4529','Cluster Synchronization Services is online (info)','Not an error'],
['CRS-4530','Communications failure contacting CSS','Check network and voting files'],
['CRS-5017','Resource action failed','Read the agent log'],
['CRS-2674 / 2632','Start of resource failed','Dependency or environment problem'],
['CRS-1607','Node is being evicted from the cluster','See eviction analysis in `ocssd.trc`'],
['PRVF-xxxx','CLUVFY failure message','Fix named prerequisite'],
['ORA-15001','Diskgroup does not exist or is not mounted','Mount it, check ASM'],
['ORA-15032 / 15040 / 15042','Disk group operation failed, disk missing or ASM disk issue','Read the messages that follow'],
['ORA-15063','Discovered disk missing','Check discovery string, permissions'],
['ORA-15186','ASMLIB error','Check OS device and ASMLib or AFD'],
['ORA-15077','Could not locate ASM instance','Start ASM, check `ORACLE_SID`'],
['ORA-29701','Unable to connect to Cluster Manager','Cluster stack not running'],
['ORA-12545','Connect failed, target host or object does not exist','VIP or SCAN issue'],
['ORA-01105','Mount is incompatible with mounts by other instances','Check RAC parameters that must match'],
['ORA-00600 [kjxx]','Internal GES/GCS error','Open a Service Request with AHF collection']]}
]},

/* 10 ---------------------------------------------------------------- health check */
{t:'Health-check pack',d:'Commands and queries for the daily and weekly cluster check.',see:[[8,5,'CVU and ORAchk'],[9,5,'Production readiness']],b:[
{h:'Cluster state (as grid or root)'},
{code:`crsctl check cluster -all
crsctl check crs
crsctl stat res -t -init
crsctl stat res -t
olsnodes -n -s -t
crsctl query css votedisk
ocrcheck
oifcfg getif
cluvfy comp healthcheck -collect cluster`},
{h:'Services and databases'},
{code:`srvctl status database -db orcl -v
srvctl status service -db orcl
srvctl status scan_listener
srvctl status vip -n node1
srvctl status asm`},
{h:'ASM'},
{code:`asmcmd lsdg
SELECT name, state, type, total_mb, free_mb, usable_file_mb, offline_disks FROM v$asm_diskgroup;
SELECT group_number, operation, state, power, est_minutes FROM v$asm_operation;
SELECT path, header_status, mode_status, state FROM v$asm_disk WHERE mode_status <> 'ONLINE';`},
{h:'RAC database'},
{code:`SELECT inst_id, instance_name, host_name, status, startup_time FROM gv$instance;
SELECT inst_id, name, value FROM gv$sysstat WHERE name IN ('gc cr blocks received','gc current blocks received');
SELECT inst_id, event, total_waits, ROUND(time_waited_micro/1e6) s FROM gv$system_event
WHERE wait_class = 'Cluster' ORDER BY time_waited_micro DESC FETCH FIRST 10 ROWS ONLY;`}
]},

/* 11 ---------------------------------------------------------------- naming */
{t:'Resource and naming decoder',d:'How cluster resources, networks and ASM files are named.',see:[[2,4,'Clusterware resources'],[3,2,'SCAN, VIPs and listeners']],b:[
{t:[['Name','Meaning'],
['`ora.<db>.db`','The database resource'],
['`ora.<db>.<service>.svc`','A database service'],
['`ora.<node>.vip`','Node VIP'],
['`ora.scan1.vip`, `ora.LISTENER_SCAN1.lsnr`','SCAN VIP and its listener'],
['`ora.net1.network`','Public network resource'],
['`ora.LISTENER.lsnr`','Node listener'],
['`ora.asm`, `ora.DATA.dg`','ASM and a disk group resource'],
['`ora.ons`, `ora.cvu`','ONS and Cluster Verification Utility resources'],
['`ora.crsd`, `ora.cssd`, `ora.ctssd`, `ora.gipcd`, `ora.mdnsd`, `ora.gpnpd`, `ora.evmd`','Lower-stack init resources'],
['`+ASM1`, `+ASM2`','ASM instances per node'],
['`ORCL1`, `ORCL2`','Database instances'],
['`inst_id`','Instance number in GV$ views'],
['`+DATA/ORCL/DATAFILE/users.259.123456789`','ASM file: disk group, db, type, file and incarnation numbers'],
['`DATA_0000`','ASM disk name in a disk group'],
['169.254.x.x','HAIP address of the private interconnect (if used)']]},
{h:'Networks'},
{t:[['Network','Role'],
['Public','Client access, node VIP and SCAN VIPs'],
['Private (interconnect)','Cache Fusion and heartbeat, dedicated and fast'],
['Storage','SAN, NFS or iSCSI, separate when possible'],
['Management','ILOM, SSH, monitoring']]}
]},

/* 12 ---------------------------------------------------------------- 26ai notes */
{t:'Release notes and 26ai changes',d:'Cluster features that changed or were removed in newer releases. Verify against the guide for your release.',see:[[3,5,'26ai installer changes'],[5,6,'Administrator-managed databases']],b:[
{t:[['Topic','Change','Action'],
['Policy-managed databases','Not supported in newer releases [26ai]','Use administrator-managed databases'],
['Grid Infrastructure Management Repository (GIMR)','Changed or removed [26ai]','Check monitoring and CHA dependency in your design'],
['Installer','`config.sh` desupported, use `gridSetup.sh` [26ai]','Update automation'],
['Multitenant','Only CDB architecture [26ai]','Convert non-CDBs before or during upgrade'],
['Flex ASM','Default in newer releases','Clients may connect to remote ASM instances'],
['ASM Filter Driver (AFD)','Preferred over ASMLib on newer releases','Plan migration of device handling'],
['Cluster upgrades','Rolling upgrade supported from 19c','Read the upgrade guide for steps']]},
{note:'Release changes are listed in the Upgrade Guide and in the Clusterware Administration Guide for each release. This page gives the direction, not the final word.'}
]}

]};
