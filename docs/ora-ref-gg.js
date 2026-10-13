/* LearnSphere - GoldenGate Quick Reference (cheat sheet).
   window.QREF['ora-gg'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for Oracle GoldenGate Microservices Architecture (21c and later, 23ai and 26ai marked). Command and parameter names are the
   common ones; check the reference for your exact version (HELP in Admin Client, the Parameters reference, the REST API reference). */
window.QREF=window.QREF||{};
window.QREF['ora-gg']={title:'GoldenGate Quick Reference',blurb:'Services, files, parameters, commands, views, error messages and checklists for GoldenGate Microservices on one page each.',hint:'extract or lag',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas behind Oracle GoldenGate that you should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command, query or file to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Foundations'},
{acc:[
{t:'Log-based change data capture',s:'Read the redo, not the tables.',
 a:'**GoldenGate** captures committed changes by reading the database transaction log (redo for Oracle), turns them into a database-independent form in **trail files**, and applies them to a target. It does not query the tables, so the impact on the source is small and the change stream is in commit order.',
 w:'It is why GoldenGate can run between different versions, platforms and even database vendors, while the source stays online.',
 c:`SELECT capture_name, status, captured_scn FROM dba_capture;`,see:[0,0,'What GoldenGate is: log-based change data capture and replication']},
{t:'GoldenGate vs Data Guard',s:'Logical copy, or physical copy.',
 a:'**Data Guard** keeps a block-identical physical copy of the whole database and is the answer for disaster recovery. **GoldenGate** replicates chosen tables as logical changes, so the target can be a different version, platform or product, can be open read-write and can hold extra objects.',
 w:'For DR use Data Guard. For migration, upgrade, integration and multi-master use GoldenGate.',
 c:`SELECT database_role, open_mode FROM v$database;`,see:[0,1,'GoldenGate vs Data Guard, Streams and other replication tools']},
{t:'Use cases',s:'Why people deploy it.',
 a:'The common uses are **zero-downtime migration and upgrade**, **active-active** replication, **data distribution** to reporting and analytics systems, and **streaming** changes into Kafka or a lake. All rely on the same capture, trail and apply mechanism.',
 w:'Knowing the use case chooses the topology, the initial load method and how much lag is acceptable.',
 c:`INFO ALL`,see:[0,2,'Use cases: zero-downtime migration, upgrade, active-active and data distribution']},
{t:'Product family, versions and licensing',s:'What is installed, and what you may use.',
 a:'Core GoldenGate comes in an **Oracle** edition and a **heterogeneous** (non-Oracle) edition. Related products include **Veridata** (comparison), **Stream Analytics** and the managed **OCI GoldenGate** service. 23ai and 26ai continue the Microservices architecture. Licensing is per processor on source and target, with separate terms for OCI GoldenGate.',
 w:'Confirm the licence before replicating, particularly when extra products or non-Oracle targets are involved.',
 c:`$ ogg_home/bin/adminclient
OGG> VERSION`,see:[0,3,'Product family: Core, Veridata, Stream Analytics and OCI GoldenGate']}
]},

{h:'Architecture'},
{acc:[
{t:'Microservices Architecture',s:'Services with a REST interface.',
 a:'GoldenGate runs as a set of services in a **deployment**: the **Service Manager** (starts and manages deployments), the **Administration Service** (Extracts, Replicats, credentials), the **Distribution Service** (sends trails), the **Receiver Service** (receives trails) and the **Performance Metrics Service**. Everything is available through a web UI, the Admin Client and a REST API.',
 w:'Because it is REST, everything can be automated and monitored with ordinary tools.',
 c:`OGG> CONNECT https://ogg.example.com:9011 DEPLOYMENT ogg_src AS oggadmin
OGG> INFO ALL`,see:[1,0,'Services: Service Manager, Administration, Distribution, Receiver and Performance Metrics']},
{t:'Deployments and homes',s:'Software once, data per deployment.',
 a:'`OGG_HOME` holds the installed software and is shared. Each **deployment** has its own configuration, trails, checkpoints and logs in its own directories (`etc`, `var`). One Service Manager can manage several deployments, such as a source and a target on the same host.',
 w:'When you back up or patch, you treat the software home and the deployment directories differently.',
 c:`$ ls $OGG_DEPLOY_HOME/etc/conf/ogg $OGG_DEPLOY_HOME/var/lib/data | head`,see:[1,1,'Deployments and homes: OGG_HOME and deployment variables']},
{t:'Extract',s:'Capture the changes.',
 a:'An **Extract** reads the transaction log and writes committed changes to a **trail**. **Integrated Extract** uses the database log mining server and is the standard for Oracle. An **initial load Extract** reads the tables directly for the first copy.',
 w:'It is the process whose position, in the redo, decides how far behind the source you are.',
 c:`INFO EXTRACT EXT1 DETAIL
SELECT capture_name, state, capture_time FROM v$goldengate_capture;`,see:[4,0,'Integrated Extract: concepts and configuration']},
{t:'Trail files',s:'The durable queue between processes.',
 a:'A **trail** is a sequence of files on disk holding the captured changes in a compact format. It decouples capture from apply: if the target is down, changes pile up in the trail and nothing is lost. Trails have a two-character prefix and a sequence number.',
 w:'Trail disk space is the buffer during an outage. Size it, monitor it and purge old trails.',
 c:`$ ls -l $OGG_DEPLOY_HOME/var/lib/data/aa*`,see:[4,1,'Trail files and distribution paths']},
{t:'Distribution path and Receiver',s:'Move the trail to the target.',
 a:'A **distribution path** on the source reads a local trail and sends it over the network to the **Receiver Service** on the target, which writes a **remote trail**. Paths can be secured with TLS, can filter, and can restart independently of Extract and Replicat.',
 w:'A path is its own process with its own lag, so it appears in the lag chain between Extract and Replicat.',
 c:`INFO PATH path1`,see:[4,1,'Trail files and distribution paths']},
{t:'Replicat',s:'Apply the changes.',
 a:'A **Replicat** reads the trail and applies the changes to the target. **Parallel Replicat** (the default in current releases) splits the work across several appliers while preserving transaction dependencies. Integrated and coordinated Replicats are older alternatives.',
 w:'Replicat speed is usually the limit on the end-to-end lag, so its tuning matters most.',
 c:`INFO REPLICAT REP1 DETAIL
LAG REPLICAT REP1`,see:[4,2,'Replicat types: parallel, integrated and coordinated']},
{t:'Checkpoints',s:'How a process remembers where it was.',
 a:'Each Extract and Replicat writes **checkpoints**: the position it has read and the position it has written. After a stop or crash it restarts from its checkpoint, with no loss and no duplicates. Replicat also keeps its checkpoint in a table in the target database.',
 w:'Checkpoints are why you never copy trail files by hand, and why you back them up.',
 c:`INFO EXTRACT EXT1, SHOWCH`,see:[1,3,'Checkpoints and recovery concepts']},
{t:'High availability of GoldenGate itself',s:'The replication layer needs protection too.',
 a:'Run GoldenGate under clusterware or the **Configuration Service** in 23ai and later, so a deployment can move to another node, using shared storage for its trails and checkpoints. Back up the deployment directories and plan the recovery of the replication layer.',
 w:'If the replication layer is a single point of failure, the data protection around it is weaker than it looks.',
 c:`$ crsctl stat res -t | grep -i ogg`,see:[9,3,'Making GoldenGate highly available: Configuration Service and clusterware agents']}
]},

{h:'Preparing the databases'},
{acc:[
{t:'Database requirements',s:'ARCHIVELOG, FORCE LOGGING and a setting.',
 a:'The source database must be in **ARCHIVELOG** mode, normally with **FORCE LOGGING** so no change is skipped, and `ENABLE_GOLDENGATE_REPLICATION` set to TRUE. These are database settings, not GoldenGate settings, and are needed on the target as well for Replicat.',
 w:'A change made with NOLOGGING never reaches the target. This is a classic cause of silent divergence.',
 c:`SELECT log_mode, force_logging, supplemental_log_data_min FROM v$database;
SHOW PARAMETER enable_goldengate_replication`,see:[3,1,'ARCHIVELOG, FORCE LOGGING and ENABLE_GOLDENGATE_REPLICATION']},
{t:'Supplemental logging',s:'Extra columns in the redo.',
 a:'By default redo holds only the changed columns. **Supplemental logging** adds the columns GoldenGate needs to identify the row on the target, usually the primary key. You enable minimal supplemental logging at database level, and **TRANDATA** or **SCHEMATRANDATA** per table or schema.',
 w:'Without it, updates cannot find the target row and Replicat abends or applies wrongly.',
 c:`SELECT supplemental_log_data_min FROM v$database;
OGG> INFO TRANDATA hr.employees`,see:[3,2,'Supplemental logging: minimal, schema and table level']},
{t:'GoldenGate users and privileges',s:'One user per side, minimal rights.',
 a:'GoldenGate uses a dedicated database user, created by you, on each side. The privileges are granted with `DBMS_GOLDENGATE_AUTH.GRANT_ADMIN_PRIVILEGE`. Credentials are stored in the **credential store** under an **alias**, so parameter files never contain passwords.',
 w:'It is both the security model and the way connections are managed. Use an alias per database and per role.',
 c:`OGG> ALTER CREDENTIALSTORE ADD USER ggadmin@srcpdb ALIAS src_alias
OGG> INFO CREDENTIALSTORE`,see:[3,3,'GoldenGate users and privileges']},
{t:'Multitenant',s:'Capture from the PDB, connect to the root.',
 a:'In a CDB, Integrated Extract is registered in the **root** (container) and can capture from one or more PDBs. The Replicat connects to the target PDB. Names include the PDB, such as `pdb1.hr.employees`.',
 w:'A wrong container in a connection or a name is the most common multitenant mistake.',
 c:`SHOW CON_NAME
REGISTER EXTRACT EXT1 DATABASE CONTAINER (pdb1)`,see:[3,4,'Multitenant: container and PDB considerations']},
{t:'TDE, character sets and data types',s:'Check before you start.',
 a:'If tables use **TDE**, the Extract needs access to the wallet. Source and target **character sets** must be compatible, or conversion must be planned. Some data types have limited or no support, and the **support matrix** and `DBA_GOLDENGATE_SUPPORT_MODE` show it.',
 w:'It is the checklist that prevents surprises in the middle of an initial load.',
 c:`SELECT owner, table_name, support_mode FROM dba_goldengate_support_mode WHERE support_mode <> 'FULL' FETCH FIRST 10 ROWS ONLY;`,see:[3,5,'TDE, character sets and data type support']}
]},

{h:'Designing the replication'},
{acc:[
{t:'Initial load and instantiation',s:'Start the target at a known point.',
 a:'Replication applies **changes**, so the target must start with a copy of the data as of a known **SCN** (or CSN). You take the copy with Data Pump (with `FLASHBACK_SCN`), RMAN or a GoldenGate initial load, and tell Replicat to start applying changes after that SCN.',
 w:'Getting the SCN wrong gives missing or duplicate changes. It is the most delicate step in a migration.',
 c:`SELECT current_scn FROM v$database;
START REPLICAT REP1 ATCSN 4829107`,see:[4,3,'Initial load methods: Data Pump with SCN, GoldenGate load and RMAN']},
{t:'Mapping and filtering',s:'Choose what and where.',
 a:'Parameter files say which source tables go where with `TABLE` (Extract) and `MAP` (Replicat). You can filter rows with `FILTER`, select columns with `COLS` and `COLSEXCEPT`, and transform with conversion functions and `SQLEXEC`.',
 w:'Keep transformations on the apply side so the trail stays a faithful copy of the source.',
 c:`MAP hr.employees, TARGET hr.employees, FILTER (@STREQ(status, 'ACTIVE'));`,see:[5,0,'TABLE and MAP parameters']},
{t:'DDL replication',s:'Structure changes travel too, if you allow it.',
 a:'With DDL replication, GoldenGate can capture changes such as CREATE and ALTER and apply them on the target. It is controlled with the `DDL` parameter, with options to include or exclude objects and operations.',
 w:'Mixed DDL and DML ordering matters. Test it, and be selective about what is replicated.',
 c:`DDL INCLUDE MAPPED OBJNAME hr.*`,see:[5,5,'DDL replication']},
{t:'Topologies',s:'One way, two way, many.',
 a:'**Unidirectional** is one source and one target. **Bidirectional** (active-active) replicates both ways and needs conflict handling. **Hub-and-spoke** and **cascading** distribute to many targets. Each adds design work: keys, sequences, conflicts and loops.',
 w:'Pick the simplest topology that meets the need. Active-active is a design commitment, not a switch.',
 c:`OGG> INFO ALL`,see:[6,0,'Topologies: one-way, bidirectional, hub-and-spoke and cascading']},
{t:'Loop prevention',s:'Do not replicate a replicated change.',
 a:'In a bidirectional setup a change applied by Replicat must not be captured again by the other side\'s Extract. GoldenGate does this by **tagging** applied transactions, or by excluding the replication user, so Extract ignores them.',
 w:'Without it a single insert bounces between the databases indefinitely.',
 c:`-- Replicat parameter file
DBOPTIONS SETTAG 0A
-- Extract parameter file on the same database
TRANLOGOPTIONS EXCLUDETAG 0A`,see:[6,1,'Loop prevention and tagging']},
{t:'Conflict detection and resolution',s:'Two sites changed the same row.',
 a:'**CDR** compares the before image from the source with the current row on the target. If they differ there is a conflict, and rules such as latest timestamp, delta or an exception table decide what happens. **Automatic CDR** handles the common cases for you.',
 w:'The best conflict handling is a design that avoids conflicts: partition the data by site and use unique key ranges.',
 c:`MAP hr.orders, TARGET hr.orders, COMPARECOLS (ON UPDATE ALL), RESOLVECONFLICT (UPDATEROWEXISTS, (DEFAULT, USEMAX (last_updated)));`,see:[6,2,'Conflict detection and resolution (CDR)']}
]},

{h:'Operating and securing'},
{acc:[
{t:'Lag',s:'How far behind is the target.',
 a:'**Lag** is the time between a change being committed on the source and applied on the target. It is the sum of capture lag (Extract), transport lag (the path) and apply lag (Replicat). Each process reports its own, so you can see which stage is slow.',
 w:'Alert on lag per stage. A rising lag is a capacity or error problem, a constant one is a design limit.',
 c:`LAG EXTRACT EXT1
LAG REPLICAT REP1`,see:[7,0,'Measuring lag: capture, transport and apply']},
{t:'Discard files and error handling',s:'What happens when a row fails.',
 a:'When a record cannot be applied, Replicat can **abend**, **discard** the record to a discard file, or take another action defined by `REPERROR`. The discard file holds the failed operation and the reason.',
 w:'Decide your error policy on purpose. Silently discarding rows hides divergence.',
 c:`REPERROR (DEFAULT, ABEND)
VIEW DISCARD REP1`,see:[5,4,'DML handling and error handling parameters']},
{t:'Restart and reposition',s:'Resume safely.',
 a:'A stopped process restarts from its checkpoint. If you must skip or re-read data you can reposition Extract or Replicat to a trail sequence and RBA, or to a CSN, with `ALTER` commands. Doing it wrongly skips or repeats changes.',
 w:'Repositioning is a last resort and needs a record of what you did.',
 c:`ALTER REPLICAT REP1, EXTSEQNO 12, EXTRBA 0`,see:[8,3,'Restarting, repositioning and recovering processes']},
{t:'Trail management',s:'Do not fill the disk, do not purge too early.',
 a:'Trails are purged after they have been fully consumed by all readers. Purge rules in the deployment keep a minimum number of days and never remove a trail that a process still needs. A full trail disk stops Extract.',
 w:'The disk size of the trail directory is the outage buffer. Alert at 70%.',
 c:`$ df -h $OGG_DEPLOY_HOME/var/lib/data`,see:[8,4,'Trail management and purge policies']},
{t:'Security',s:'Encrypt, authenticate, limit.',
 a:'Use **TLS** for service and distribution path traffic, roles and OAuth or LDAP for users, the **credential store** for secrets, and TDE or trail encryption for data at rest. Limit who can reach the Service Manager and the REST API.',
 w:'The trail contains your data, in a readable format. Treat it like the database files.',
 c:`OGG> INFO CREDENTIALSTORE
OGG> INFO PATH path1 DETAIL`,see:[9,0,'TLS, certificates and secure distribution paths']},
{t:'Zero-downtime migration',s:'Load, replicate, verify, cut over.',
 a:'The standard pattern: capture changes, load the target at a known SCN, start Replicat and let it catch up, **verify** the data, then stop application writes briefly, let the last changes drain and switch. **Reverse replication** from the new system back to the old one gives a fallback.',
 w:'The downtime is the drain and switch, in minutes, not the copy time. The fallback is what makes it a safe decision.',
 c:`OGG> LAG REPLICAT REP1`,see:[10,0,'The zero-downtime pattern: load, replicate, verify, cut over']},
{t:'Verifying with Veridata',s:'Prove the two sides match.',
 a:'**Veridata** compares source and target data while replication runs, and reports and repairs differences. Simpler count checks and checksums are used for a first look. Comparison is done before cutover and as an ongoing control.',
 w:'Trust, but verify. A replication that shows no lag can still be wrong.',
 c:`SELECT COUNT(*), SUM(ORA_HASH(employee_id || last_name)) FROM hr.employees;`,see:[10,5,'Verifying with Veridata and count checks']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Five small maps of how the parts fit together: the services, the data flow, database preparation, a bidirectional topology and the files of a deployment.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why a DBA cares, one query or command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. The Microservices Architecture'},
{map:{title:'GoldenGate services map',h:328,trace:'Create and start an Extract',
 hint:'Tap any box, or press Create and start an Extract to see which service does which part of a task.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M118 192 L118 219 L226 219 L226 246','M562 80 L562 163 L454 163 L454 246'],
 nodes:[
 {id:'user',x:21,y:24,w:194,h:56,c:'ext',t:'You',s:'UI, Admin Client, REST',d:'A person using the web UI or the Admin Client, or a script calling the REST API.',why:'All three do the same thing through the same REST interface.',chk:`OGG> CONNECT https://ogg.example.com DEPLOYMENT ogg_src AS oggadmin`,see:[1,4,'Web UI, Admin Client and REST API']},
 {id:'proxy',x:243,y:24,w:194,h:56,c:'net',t:'Reverse proxy',s:'one entry point',d:'An NGINX or similar proxy that presents one address and port and routes to the services, with TLS.',why:'It is the recommended way to expose the services securely.',chk:`$ curl -k https://ogg.example.com/services/v2/config/health`,see:[2,3,'Configuring the reverse proxy and security basics']},
 {id:'sm',x:465,y:24,w:194,h:56,c:'proc',t:'Service Manager',s:'starts deployments',d:'The service that runs on each host. It starts, stops and monitors deployments and their services.',why:'If it is down, none of the deployments it manages are reachable.',chk:`$ systemctl status OracleGoldenGate`,see:[1,0,'Services: Service Manager, Administration, Distribution, Receiver and Performance Metrics']},
 {id:'adm',x:21,y:136,w:194,h:56,c:'proc',t:'Administration Service',s:'Extract and Replicat',d:'Creates and manages Extracts, Replicats, parameter files, credentials and checkpoints for a deployment.',why:'Most day-to-day work is done here.',chk:`OGG> INFO ALL`,see:[1,0,'Services: Service Manager, Administration, Distribution, Receiver and Performance Metrics']},
 {id:'dist',x:243,y:136,w:194,h:56,c:'proc',t:'Distribution Service',s:'sends trails',d:'Manages distribution paths that send trail data to a Receiver Service on another deployment.',why:'It is the source side of the network link.',chk:`INFO PATH ALL`,see:[4,1,'Trail files and distribution paths']},
 {id:'recv',x:465,y:136,w:194,h:56,c:'proc',t:'Receiver Service',s:'receives trails',d:'Receives trail data from distribution paths and writes remote trail files.',why:'It is the target side of the link.',chk:`OGG> INFO ALL`,see:[1,0,'Services: Service Manager, Administration, Distribution, Receiver and Performance Metrics']},
 {id:'perf',x:126,y:248,w:200,h:56,c:'mem',t:'Performance Metrics',s:'history and rates',d:'Collects and stores lag and throughput metrics for the deployment.',why:'It shows trends over time, not only the present value.',chk:`$ curl -k https://ogg.example.com/pmsrvr/`,see:[7,5,'Using Performance Metrics Service']},
 {id:'dep',x:354,y:248,w:200,h:56,c:'disk',t:'Deployment',s:'config and data',d:'A set of services with their own configuration, trails, checkpoints and logs. One host can have several.',why:'Source and target deployments can run on the same Service Manager in a lab.',chk:`$ ls $OGG_DEPLOY_HOME`,see:[1,1,'Deployments and homes: OGG_HOME and deployment variables']}],
 steps:[
 {ids:['user','proxy'],t:'1. You open the web UI or run the Admin Client and connect to the reverse proxy URL for the deployment.',w:'One address serves every service of the deployment.',s:'Reverse proxy configuration, TLS certificate.',x:'A certificate that does not match the host name stops the Admin Client from connecting.',c:`OGG> CONNECT https://ogg.example.com DEPLOYMENT ogg_src AS oggadmin`},
 {ids:['proxy','sm'],t:'2. The proxy forwards the request to the right service. The Service Manager makes sure the deployment and its services are running.',w:'The request reaches the deployment you named.',s:'Service Manager, deployments.',x:'A stopped Service Manager shows as a 502 or a connection error.',c:`$ systemctl status OracleGoldenGate`},
 {ids:['adm'],t:'3. The Administration Service creates the Extract: it stores the parameter file and registers the process and its checkpoint files.',w:'This is where the definition lives.',s:'`ADD EXTRACT`, `REGISTER EXTRACT`, parameter file.',x:'Missing credentials or privileges fail the registration with a database error.',c:`OGG> ADD EXTRACT ext1 INTEGRATED TRANLOG BEGIN NOW
OGG> ADD EXTTRAIL aa EXTRACT ext1`},
 {ids:['adm','dep'],t:'4. START EXTRACT launches the process. It writes to the trail in the deployment data directory and reports to the service.',w:'The process runs inside the deployment, under the Service Manager.',s:'`START EXTRACT`, process logs.',x:'ABENDED status with a report file containing the error.',c:`OGG> START EXTRACT ext1
OGG> INFO EXTRACT ext1`},
 {ids:['dist','recv'],t:'5. A distribution path then sends the trail to a Receiver Service on the target deployment, which writes it as a remote trail.',w:'Replicat will read it there.',s:'Path definition, TLS, network.',x:'A path that cannot connect to the receiver stays in a retry state.',c:`OGG> INFO PATH path1`},
 {ids:['perf'],t:'6. The Performance Metrics Service records lag and rates, so you can see the pipeline over time.',w:'Trends find the problem that a single reading hides.',s:'Metrics retention, the metrics UDP port.',x:'A blocked metrics port means no graphs but no replication problem.',c:`OGG> LAG EXTRACT ext1`}]}},

{h:'2. The data flow from source to target'},
{map:{title:'Data flow map',h:216,trace:'Follow a committed row',
 hint:'Tap any box, or press Follow a committed row to see a change travel from the source database to the target.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],[590,80,590,134],[521,164,495,164],[354,164,328,164],[187,164,161,164]],
 nodes:[
 {id:'src',x:20,y:24,w:139,h:56,c:'disk',t:'Source database',s:'redo log',d:'The source database records every committed change in its redo log.',why:'GoldenGate reads this log and not the tables.',chk:`SELECT group#, sequence#, status FROM v$log;`,see:[0,0,'What GoldenGate is']},
 {id:'ext',x:187,y:24,w:139,h:56,c:'proc',t:'Extract',s:'capture',d:'Integrated Extract receives committed changes from the database log mining server, in commit order.',why:'It writes only committed transactions to the trail.',chk:`INFO EXTRACT ext1 DETAIL`,see:[4,0,'Integrated Extract: concepts and configuration']},
 {id:'ltr',x:354,y:24,w:139,h:56,c:'disk',t:'Local trail',s:'aa000001',d:'The trail files on the source side holding the captured changes.',why:'It is the queue that survives an outage of the network or the target.',chk:`$ ls -l $OGG_DEPLOY_HOME/var/lib/data/aa*`,see:[4,1,'Trail files and distribution paths']},
 {id:'path',x:521,y:24,w:139,h:56,c:'proc',t:'Distribution path',s:'sends the trail',d:'Reads the local trail and sends it over the network to the target Receiver Service.',why:'Can compress and encrypt, and has its own lag.',chk:`INFO PATH path1`,see:[4,1,'Trail files and distribution paths']},
 {id:'rcv',x:521,y:136,w:139,h:56,c:'proc',t:'Receiver Service',s:'writes remote trail',d:'Accepts the data from the path and writes it into a remote trail on the target host.',why:'It is the target end of the network link.',chk:`OGG> INFO ALL`,see:[1,2,'Extract, trail files, distribution paths and Replicat: the data flow']},
 {id:'rtr',x:354,y:136,w:139,h:56,c:'disk',t:'Remote trail',s:'bb000001',d:'The trail on the target side, with its own sequence and its own checkpoint for Replicat.',why:'Replicat can run behind it without anything being lost.',chk:`$ ls -l $OGG_DEPLOY_HOME/var/lib/data/bb*`,see:[4,1,'Trail files and distribution paths']},
 {id:'rep',x:187,y:136,w:139,h:56,c:'proc',t:'Replicat',s:'apply',d:'Reads the remote trail and applies the changes to the target database as SQL, in dependency order.',why:'Parallel Replicat applies independent transactions in parallel.',chk:`INFO REPLICAT rep1 DETAIL`,see:[4,2,'Replicat types: parallel, integrated and coordinated']},
 {id:'tgt',x:20,y:136,w:139,h:56,c:'disk',t:'Target database',s:'tables',d:'The target tables now hold the change. The Replicat checkpoint is stored in a table in the target in the same transaction.',why:'That makes the apply exactly-once after a restart.',chk:`SELECT * FROM ggadmin.checkpoint FETCH FIRST 3 ROWS ONLY;`,see:[1,3,'Checkpoints and recovery concepts']}],
 steps:[
 {ids:['src','ext'],t:'1. A transaction commits on the source. Its redo is read by the log mining server and handed to Extract in commit order.',w:'Only committed changes are sent; rolled back work never leaves the source.',s:'`TRANLOGOPTIONS`, `LOGALLSUPCOLS`, `STREAMS_POOL_SIZE`.',x:'Extract lagging far behind needs archived logs to be still available.',c:`SELECT capture_name, state, capture_time FROM v$goldengate_capture;`},
 {ids:['ext','ltr'],t:'2. Extract writes the change into the local trail file and records its checkpoint.',w:'The trail is the durable buffer.',s:'`EXTTRAIL`, trail file size, `ROLLOVER`.',x:'A full trail disk stops Extract.',c:`$ df -h $OGG_DEPLOY_HOME/var/lib/data`},
 {ids:['ltr','path'],t:'3. The distribution path reads the local trail and sends the data to the target, with compression and TLS if configured.',w:'It decouples the network from capture.',s:'Path options, `COMPRESS`, TLS.',x:'A network break leaves the path retrying while the trail grows.',c:`INFO PATH path1`},
 {ids:['rcv','rtr'],t:'4. The Receiver Service writes the data into the remote trail on the target host.',w:'The data is now on the target side, on disk.',s:'Receiver Service, trail directory.',x:'A disk full on the target blocks the path.',c:`$ ls -l $OGG_DEPLOY_HOME/var/lib/data/bb*`},
 {ids:['rep','tgt'],t:'5. Replicat reads the remote trail and applies the transaction to the target database, then commits and saves its checkpoint.',w:'This is the step that decides the end-to-end lag.',s:'`MAP`, `MAP_PARALLELISM`, `BATCHSQL`.',x:'A missing row or constraint violation abends Replicat with the error in the report.',c:`LAG REPLICAT rep1`},
 {ids:['tgt'],t:'6. The change is on the target. The whole path may take seconds, and each stage reports its own lag.',w:'It is the proof that the pipeline works.',s:'Lag alerts per stage.',x:'A small lag at Replicat can hide a large lag at Extract. Check both.',c:`LAG EXTRACT ext1
LAG REPLICAT rep1`}]}},

{h:'3. Preparing a source database'},
{map:{title:'Database preparation map',h:328,trace:'Prepare a source',
 hint:'Tap any box, or press Prepare a source to see the things that must be true before an Extract can run.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L118 219 L118 246',[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'arch',x:21,y:24,w:194,h:56,c:'disk',t:'ARCHIVELOG',s:'required',d:'The source must be in ARCHIVELOG mode so redo is retained long enough for Extract to read.',why:'Extract can fall behind and still catch up from archived logs.',chk:`SELECT log_mode FROM v$database;`,see:[3,1,'ARCHIVELOG, FORCE LOGGING and ENABLE_GOLDENGATE_REPLICATION']},
 {id:'force',x:243,y:24,w:194,h:56,c:'proc',t:'FORCE LOGGING',s:'every change logged',d:'Makes every change generate redo, including NOLOGGING operations.',why:'Without it, a NOLOGGING load never reaches the target.',chk:`SELECT force_logging FROM v$database;`,see:[3,1,'ARCHIVELOG, FORCE LOGGING and ENABLE_GOLDENGATE_REPLICATION']},
 {id:'enable',x:465,y:24,w:194,h:56,c:'proc',t:'Enable replication',s:'parameter',d:'ENABLE_GOLDENGATE_REPLICATION = TRUE allows the database to support Extract and Replicat features.',why:'It is dynamic and needs to be set on both ends.',chk:`SHOW PARAMETER enable_goldengate_replication`,see:[3,1,'ARCHIVELOG, FORCE LOGGING and ENABLE_GOLDENGATE_REPLICATION']},
 {id:'supp',x:21,y:136,w:194,h:56,c:'mem',t:'Supplemental logging',s:'database level',d:'Minimal supplemental logging at database level, so the redo has the information that log mining needs.',why:'It is a prerequisite for table-level logging.',chk:`SELECT supplemental_log_data_min FROM v$database;`,see:[3,2,'Supplemental logging: minimal, schema and table level']},
 {id:'user',x:243,y:136,w:194,h:56,c:'ext',t:'GoldenGate user',s:'dedicated',d:'A database user created for GoldenGate, with its own tablespace and quota.',why:'Do not use SYSTEM. Use one user per role and database.',chk:`SELECT username, account_status FROM dba_users WHERE username = 'GGADMIN';`,see:[3,3,'GoldenGate users and privileges']},
 {id:'priv',x:465,y:136,w:194,h:56,c:'mem',t:'Privileges',s:'DBMS_GOLDENGATE_AUTH',d:'Granted with GRANT_ADMIN_PRIVILEGE, so the user can capture and apply.',why:'Direct grants are not enough for integrated processes.',chk:`EXEC DBMS_GOLDENGATE_AUTH.GRANT_ADMIN_PRIVILEGE('GGADMIN');`,see:[3,3,'GoldenGate users and privileges']},
 {id:'cred',x:21,y:248,w:194,h:56,c:'disk',t:'Credential store',s:'aliases',d:'Stores the database login under an alias in an encrypted store, so parameter files hold no passwords.',why:'Parameters use USERIDALIAS.',chk:`OGG> ALTER CREDENTIALSTORE ADD USER ggadmin@srcpdb ALIAS src_alias
OGG> INFO CREDENTIALSTORE`,see:[9,2,'Credential store and secrets handling']},
 {id:'reg',x:243,y:248,w:194,h:56,c:'proc',t:'TRANDATA',s:'per schema or table',d:'Adds supplemental logging for the tables to be replicated, so the key is in the redo.',why:'SCHEMATRANDATA also covers tables created later.',chk:`OGG> DBLOGIN USERIDALIAS src_alias
OGG> ADD SCHEMATRANDATA hr`,see:[3,2,'Supplemental logging: minimal, schema and table level']},
 {id:'chk',x:465,y:248,w:194,h:56,c:'mem',t:'Check support',s:'data types',d:'Check that the tables and data types are supported, and that they have a usable key.',why:'Do it before the project, not after.',chk:`SELECT table_name, support_mode FROM dba_goldengate_support_mode WHERE owner = 'HR' AND support_mode <> 'FULL';`,see:[3,5,'TDE, character sets and data type support']}],
 steps:[
 {ids:['arch','force'],t:'1. Put the source in ARCHIVELOG mode and turn on FORCE LOGGING. These are database settings.',w:'They are what make the redo complete and available.',s:'`ALTER DATABASE ARCHIVELOG`, `FORCE LOGGING`.',x:'Changing the archive mode needs a restart, so plan the window.',c:`SELECT log_mode, force_logging FROM v$database;`},
 {ids:['enable','supp'],t:'2. Set ENABLE_GOLDENGATE_REPLICATION and enable minimal supplemental logging.',w:'The database can now provide change data to log mining.',s:'`ALTER SYSTEM SET ENABLE_GOLDENGATE_REPLICATION=TRUE`.',x:'Missing on the target stops Replicat from applying DDL and integrated features.',c:`ALTER DATABASE ADD SUPPLEMENTAL LOG DATA;`},
 {ids:['user','priv'],t:'3. Create the GoldenGate user and grant it the administrative privileges with the package.',w:'The user is the identity of every GoldenGate process.',s:'`DBMS_GOLDENGATE_AUTH`, quotas.',x:'Privilege errors show as ORA-01031 or OGG-xxxx at registration.',c:`EXEC DBMS_GOLDENGATE_AUTH.GRANT_ADMIN_PRIVILEGE('GGADMIN');`},
 {ids:['cred'],t:'4. Store the login in the credential store under an alias, and use the alias in every parameter file and DBLOGIN.',w:'Secrets stay out of files and logs.',s:'`ALTER CREDENTIALSTORE`, aliases.',x:'Aliases that differ between deployments give "alias not found" errors.',c:`OGG> INFO CREDENTIALSTORE`},
 {ids:['reg'],t:'5. Add schema or table-level supplemental logging for the objects to be replicated.',w:'Without it the key columns are missing from the redo.',s:'`ADD SCHEMATRANDATA`, `ADD TRANDATA`.',x:'Tables with no key need `KEYCOLS` or all-column logging.',c:`OGG> INFO SCHEMATRANDATA hr`},
 {ids:['chk'],t:'6. Verify data type support and keys for every table, and fix or exclude those that fail.',w:'Surprises later are expensive.',s:'`DBA_GOLDENGATE_SUPPORT_MODE`.',x:'Unsupported types are silently dropped or abend depending on the setting.',c:`SELECT COUNT(*) FROM dba_goldengate_support_mode WHERE owner = 'HR' AND support_mode <> 'FULL';`}]}},

{h:'4. Bidirectional replication'},
{map:{title:'Bidirectional topology map',h:328,trace:'A change on site A',
 hint:'Tap any box, or press A change on site A to see how it reaches site B without bouncing back.',
 lines:[[215,52,241,52],[437,52,463,52],[215,164,241,164],[437,164,463,164],[326,276,352,276]],
 nodes:[
 {id:'dba',x:21,y:24,w:194,h:56,c:'disk',t:'Database A',s:'site A',d:'One of the two active databases. Applications write here.',why:'Both sides accept changes.',chk:`SELECT global_name FROM global_name;`,see:[6,0,'Topologies: one-way, bidirectional, hub-and-spoke and cascading']},
 {id:'exa',x:243,y:24,w:194,h:56,c:'proc',t:'Extract A',s:'captures A',d:'Captures changes on A, except those applied by the local Replicat.',why:'Exclusion is what prevents loops.',chk:`INFO EXTRACT exta DETAIL`,see:[6,1,'Loop prevention and tagging']},
 {id:'repb',x:465,y:24,w:194,h:56,c:'proc',t:'Replicat B',s:'applies to B',d:'Applies A\'s changes to B, and tags them so Extract B ignores them.',why:'It writes through the replication user.',chk:`INFO REPLICAT repb`,see:[6,1,'Loop prevention and tagging']},
 {id:'dbb',x:21,y:136,w:194,h:56,c:'disk',t:'Database B',s:'site B',d:'The second active database.',why:'Applications may write here at the same time.',chk:`SELECT global_name FROM global_name;`,see:[6,0,'Topologies: one-way, bidirectional, hub-and-spoke and cascading']},
 {id:'exb',x:243,y:136,w:194,h:56,c:'proc',t:'Extract B',s:'captures B',d:'Captures changes on B, except those applied by the local Replicat.',why:'It mirrors Extract A.',chk:`INFO EXTRACT extb DETAIL`,see:[6,1,'Loop prevention and tagging']},
 {id:'repa',x:465,y:136,w:194,h:56,c:'proc',t:'Replicat A',s:'applies to A',d:'Applies B\'s changes to A.',why:'The same design in the opposite direction.',chk:`INFO REPLICAT repa`,see:[6,1,'Loop prevention and tagging']},
 {id:'tag',x:126,y:248,w:200,h:56,c:'mem',t:'Tagging',s:'loop prevention',d:'Applied changes carry a tag. Extract is told to ignore changes with that tag.',why:'A single change would otherwise bounce forever.',chk:`DBOPTIONS SETTAG 0A
TRANLOGOPTIONS EXCLUDETAG 0A`,see:[6,1,'Loop prevention and tagging']},
 {id:'cdr',x:354,y:248,w:200,h:56,c:'warn',t:'Conflict detection',s:'CDR rules',d:'If the same row changed on both sides, the before image will not match. Rules decide the winner.',why:'Design to avoid conflicts, and handle the rest.',chk:`MAP hr.orders, TARGET hr.orders, RESOLVECONFLICT (UPDATEROWEXISTS, (DEFAULT, USEMAX (last_updated)));`,see:[6,2,'Conflict detection and resolution (CDR)']}],
 steps:[
 {ids:['dba','exa'],t:'1. An application commits a change on database A. Extract A captures it and writes it to its trail.',w:'The same as one-way replication.',s:'Extract parameters, trail.',x:'A change made by an excluded user is not captured.',c:`LAG EXTRACT exta`},
 {ids:['exa','repb','dbb'],t:'2. The trail goes to B, where Replicat B applies the change to database B, using a tag.',w:'B now has A\'s change.',s:'Path, `DBOPTIONS SETTAG`.',x:'Apply errors here are usually key or constraint problems.',c:`LAG REPLICAT repb`},
 {ids:['dbb','tag','exb'],t:'3. The change on B is in the redo of B. Extract B sees the tag and skips it, so the change does not return to A.',w:'Without this step there is an endless loop.',s:'`TRANLOGOPTIONS EXCLUDETAG`.',x:'A missing or mismatched tag causes a flood of duplicate key errors.',c:`TRANLOGOPTIONS EXCLUDETAG 0A`},
 {ids:['dbb','exb','repa'],t:'4. Meanwhile an application on B changes another row. It flows to A by the other pair of processes.',w:'Both directions run at once.',s:'Same parameters in mirror.',x:'Both sides need the same table structure and keys.',c:`LAG EXTRACT extb`},
 {ids:['cdr','dba','dbb'],t:'5. If both sides change the same row at the same time, Replicat finds that the before image does not match. A rule picks the winner or logs the conflict.',w:'Without a rule, one side overwrites the other.',s:'`COMPARECOLS`, `RESOLVECONFLICT`, exception table.',x:'Using a rule such as latest timestamp needs reliable clocks.',c:`SELECT * FROM ggadmin.exceptions FETCH FIRST 5 ROWS ONLY;`}]}},

{h:'5. Where a deployment keeps its files'},
{map:{title:'Deployment files map',h:328,trace:'Find the right file',
 hint:'Tap any box, or press Find the right file to see where to look for each kind of question.',
 lines:[[215,52,241,52],[437,52,463,52],[215,164,241,164],[437,164,463,164],[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'home',x:21,y:24,w:194,h:56,c:'disk',t:'OGG_HOME',s:'software',d:'The installed GoldenGate binaries, shared by the deployments on the host.',why:'Patch it with OPatch. It holds no replication state.',chk:`$ $OGG_HOME/OPatch/opatch lspatches`,see:[2,4,'Patching GoldenGate with OPatch']},
 {id:'etc',x:243,y:24,w:194,h:56,c:'disk',t:'etc',s:'deployment config',d:'Configuration of the deployment: parameter files, certificates and service settings.',why:'Back it up. It is the definition of your replication.',chk:`$ ls $OGG_DEPLOY_HOME/etc`,see:[1,1,'Deployments and homes: OGG_HOME and deployment variables']},
 {id:'prm',x:465,y:24,w:194,h:56,c:'mem',t:'etc/conf/ogg',s:'parameter files',d:'The `.prm` files of Extracts and Replicats.',why:'A parameter change takes effect on restart.',chk:`$ ls $OGG_DEPLOY_HOME/etc/conf/ogg/*.prm`,see:[5,0,'TABLE and MAP parameters']},
 {id:'data',x:21,y:136,w:194,h:56,c:'disk',t:'var/lib/data',s:'trail files',d:'The trail files, local and remote.',why:'Size this directory for the longest outage you will tolerate.',chk:`$ du -sh $OGG_DEPLOY_HOME/var/lib/data`,see:[4,1,'Trail files and distribution paths']},
 {id:'chk',x:243,y:136,w:194,h:56,c:'mem',t:'var/lib/checkpt',s:'checkpoints',d:'The checkpoint files of processes.',why:'They record exactly where each process stopped.',chk:`$ ls $OGG_DEPLOY_HOME/var/lib/checkpt`,see:[1,3,'Checkpoints and recovery concepts']},
 {id:'wal',x:465,y:136,w:194,h:56,c:'mem',t:'var/lib/wallet',s:'credential store',d:'The encrypted credential store with the database aliases.',why:'Back it up separately and protect it.',chk:`OGG> INFO CREDENTIALSTORE`,see:[9,2,'Credential store and secrets handling']},
 {id:'log',x:21,y:248,w:194,h:56,c:'warn',t:'var/log',s:'ggserr.log',d:'The deployment log with starts, stops and errors.',why:'First place to look when something stops.',chk:`$ tail -50 $OGG_DEPLOY_HOME/var/log/ggserr.log`,see:[8,1,'Reports, logs and discard files']},
 {id:'rpt',x:243,y:248,w:194,h:56,c:'mem',t:'var/lib/report',s:'process reports',d:'One report per process with parameters, statistics and the last error.',why:'The detail of an abend is here.',chk:`OGG> VIEW REPORT EXT1`,see:[8,1,'Reports, logs and discard files']},
 {id:'dsc',x:465,y:248,w:194,h:56,c:'mem',t:'discard',s:'failed records',d:'Records that Replicat could not apply, with the reason.',why:'Review it as part of the daily check.',chk:`OGG> VIEW DISCARD REP1`,see:[8,1,'Reports, logs and discard files']}],
 steps:[
 {ids:['home','etc'],t:'1. The software is in OGG_HOME, and each deployment has its own etc and var directories.',w:'You can patch the software without touching the data.',s:'`OGG_HOME`, `OGG_ETC_HOME`, `OGG_VAR_HOME`.',x:'Backing up only the software home loses your configuration.',c:`$ echo $OGG_HOME $OGG_DEPLOY_HOME`},
 {ids:['prm'],t:'2. The parameter files describe what each process does. They are in etc/conf/ogg and are edited through the UI or REST.',w:'They are your replication design.',s:'Parameter files, versioning in git.',x:'Editing a file while the process runs changes nothing until restart.',c:`$ cat $OGG_DEPLOY_HOME/etc/conf/ogg/ext1.prm`},
 {ids:['data','chk'],t:'3. Trails are in var/lib/data and checkpoints in var/lib/checkpt. Together they are the state of the pipeline.',w:'They let each process restart without loss.',s:'Disk space, backups.',x:'Deleting a trail a process still needs gives an OGG-01028 style error on restart.',c:`$ ls -lt $OGG_DEPLOY_HOME/var/lib/data | head`},
 {ids:['wal'],t:'4. Credentials are in the encrypted store under the wallet directory. Aliases are used everywhere else.',w:'Secrets are in one place.',s:'Credential store and its master key.',x:'Loss of the store means you must re-add every alias.',c:`OGG> INFO CREDENTIALSTORE`},
 {ids:['log','rpt','dsc'],t:'5. When something fails, check ggserr.log first, then the process report, then the discard file.',w:'It goes from "what happened" to "why" to "which row".',s:'Report file settings, discard options.',x:'Reports rotate, so collect them when an incident happens.',c:`$ tail -50 $OGG_DEPLOY_HOME/var/log/ggserr.log`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Seven small maps of how something happens, step by step: building a one-way replication, an initial load and cutover, restarting after a failure, resolving a conflict, tuning lag, a zero-downtime migration and securing a deployment.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Building a one-way replication'},
{map:{title:'One-way build map',h:216,trace:'Build a replication',
 hint:'Tap any box, or press Build a replication to follow the commands from a prepared database to applied changes.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'cred',x:20,y:24,w:139,h:56,c:'disk',t:'Credentials',s:'aliases',d:'Add the database login for source and target to the credential store.',why:'Parameters use aliases only.',chk:`OGG> ALTER CREDENTIALSTORE ADD USER ggadmin@srcpdb ALIAS src_alias`,see:[3,3,'GoldenGate users and privileges']},
 {id:'trd',x:187,y:24,w:139,h:56,c:'proc',t:'TRANDATA',s:'supplemental log',d:'Enable supplemental logging for the schema or tables.',why:'Without it, updates cannot be applied.',chk:`OGG> DBLOGIN USERIDALIAS src_alias
OGG> ADD SCHEMATRANDATA hr`,see:[3,2,'Supplemental logging: minimal, schema and table level']},
 {id:'reg',x:354,y:24,w:139,h:56,c:'proc',t:'Extract',s:'register and add',d:'Register the integrated Extract and add it with its trail.',why:'Registration creates the capture in the database.',chk:`OGG> REGISTER EXTRACT ext1 DATABASE
OGG> ADD EXTRACT ext1 INTEGRATED TRANLOG BEGIN NOW
OGG> ADD EXTTRAIL aa EXTRACT ext1`,see:[4,0,'Integrated Extract: concepts and configuration']},
 {id:'path',x:521,y:24,w:139,h:56,c:'proc',t:'Path',s:'to the target',d:'Create the distribution path from the source trail to the target Receiver Service.',why:'The network link of the pipeline.',chk:`INFO PATH path1`,see:[4,1,'Trail files and distribution paths']},
 {id:'rep',x:21,y:136,w:194,h:56,c:'proc',t:'Replicat',s:'add on target',d:'Add a parallel Replicat on the target reading the remote trail, with a checkpoint table.',why:'It is the process that writes to the target.',chk:`OGG> DBLOGIN USERIDALIAS tgt_alias
OGG> ADD CHECKPOINTTABLE ggadmin.chkpt
OGG> ADD REPLICAT rep1 PARALLEL EXTTRAIL bb CHECKPOINTTABLE ggadmin.chkpt`,see:[4,2,'Replicat types: parallel, integrated and coordinated']},
 {id:'start',x:243,y:136,w:194,h:56,c:'warn',t:'Start',s:'in order',d:'Start Extract first, then the path, and then Replicat (after the initial load is in place).',why:'Order matters when an initial load is involved.',chk:`OGG> START EXTRACT ext1
OGG> START REPLICAT rep1`,see:[4,6,'Practical: Build and validate a one-way replication']},
 {id:'ver',x:465,y:136,w:194,h:56,c:'mem',t:'Verify',s:'insert and check',d:'Insert a row on the source and confirm it arrives. Check lag and statistics.',why:'Prove the whole path before you trust it.',chk:`OGG> STATS REPLICAT rep1, TOTAL
OGG> LAG REPLICAT rep1`,see:[4,5,'Verifying data consistency']}],
 steps:[
 {ids:['cred','trd'],t:'1. Add credentials and enable supplemental logging for the objects to be replicated.',w:'These are prerequisites for Extract.',s:'`CREDENTIALSTORE`, `ADD SCHEMATRANDATA`.',x:'ORA-01031 here means the user lacks privileges.',c:`OGG> INFO SCHEMATRANDATA hr`},
 {ids:['reg'],t:'2. Register and add the integrated Extract with a trail, and write its parameter file with the TABLE statements.',w:'This defines what is captured.',s:'`REGISTER EXTRACT`, `TABLE hr.*;`.',x:'Without registration the Extract abends at start.',c:`OGG> INFO EXTRACT ext1`},
 {ids:['path'],t:'3. Create the distribution path to the target deployment. Use TLS if it crosses an untrusted network.',w:'The path moves the trail between hosts.',s:'Path source and target, TLS.',x:'Certificate or hostname mismatch leaves the path in an error state.',c:`OGG> INFO PATH path1`},
 {ids:['rep'],t:'4. On the target, add the checkpoint table and the parallel Replicat, and write its MAP statements.',w:'Replicat will apply what is in the remote trail.',s:'`ADD REPLICAT ... PARALLEL`, `MAP`.',x:'A missing target table or privilege abends Replicat on the first record.',c:`OGG> INFO REPLICAT rep1`},
 {ids:['start'],t:'5. Start Extract and the path. If an initial load is needed, load first and then start Replicat at the right SCN.',w:'The sequence decides whether data is lost or duplicated.',s:'`START EXTRACT`, `START REPLICAT ... ATCSN`.',x:'Starting Replicat before the load causes key errors.',c:`OGG> START EXTRACT ext1`},
 {ids:['ver'],t:'6. Insert a test row on the source, look for it on the target, and check statistics and lag.',w:'The check closes the build.',s:'`STATS`, `LAG`.',x:'No lag but no rows usually means the table is not mapped.',c:`OGG> STATS EXTRACT ext1, TOTAL`}]}},

{h:'2. Initial load and cutover SCN'},
{map:{title:'Instantiation map',h:216,trace:'Instantiate the target',
 hint:'Tap any box, or press Instantiate the target to follow how a target is loaded and brought into step with changes.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'cap',x:20,y:24,w:139,h:56,c:'proc',t:'Start capture',s:'before the copy',d:'Start Extract first so every change from now on is captured in the trail.',why:'It must start before the data copy begins.',chk:`OGG> START EXTRACT ext1`,see:[4,4,'Instantiation and handling the cutover SCN']},
 {id:'scn',x:187,y:24,w:139,h:56,c:'mem',t:'Note the SCN',s:'consistent point',d:'Record a source SCN after Extract is running. The copy will be as of that SCN.',why:'Replicat will apply changes after this point.',chk:`SELECT current_scn FROM v$database;`,see:[4,4,'Instantiation and handling the cutover SCN']},
 {id:'dump',x:354,y:24,w:139,h:56,c:'proc',t:'Export',s:'FLASHBACK_SCN',d:'Run Data Pump export with FLASHBACK_SCN so the dump is consistent as of that SCN.',why:'It gives a consistent copy while the source stays online.',chk:`$ expdp system schemas=hr flashback_scn=4829107 directory=dp_dir dumpfile=hr.dmp`,see:[4,3,'Initial load methods: Data Pump with SCN, GoldenGate load and RMAN']},
 {id:'load',x:521,y:24,w:139,h:56,c:'proc',t:'Import',s:'on target',d:'Import the dump into the target database.',why:'It is the longest step for big databases.',chk:`$ impdp system schemas=hr directory=dp_dir dumpfile=hr.dmp`,see:[4,3,'Initial load methods: Data Pump with SCN, GoldenGate load and RMAN']},
 {id:'rep',x:21,y:136,w:194,h:56,c:'proc',t:'Start Replicat',s:'AFTERCSN',d:'Start Replicat so it applies changes made after the export SCN, and nothing before it.',why:'It prevents both loss and duplicates.',chk:`OGG> START REPLICAT rep1 AFTERCSN 4829107`,see:[4,4,'Instantiation and handling the cutover SCN']},
 {id:'catch',x:243,y:136,w:194,h:56,c:'mem',t:'Catch up',s:'lag falls',d:'Replicat applies the backlog that built up during the load, and lag falls to seconds.',why:'This is when you watch throughput.',chk:`LAG REPLICAT rep1`,see:[7,0,'Measuring lag: capture, transport and apply']},
 {id:'chk',x:465,y:136,w:194,h:56,c:'ext',t:'Verify',s:'counts and compare',d:'Compare row counts and checksums, or run Veridata, before you rely on the target.',why:'Do it before any cutover.',chk:`SELECT COUNT(*) FROM hr.employees;`,see:[4,5,'Verifying data consistency']}],
 steps:[
 {ids:['cap'],t:'1. Start Extract and let it write to the trail before any copy begins.',w:'If you load first, changes made during the load are lost.',s:'`START EXTRACT`.',x:'Extract started after the export misses the changes in between.',c:`OGG> INFO EXTRACT ext1`},
 {ids:['scn','dump'],t:'2. Take the SCN and export with FLASHBACK_SCN set to it. The export is consistent at that SCN.',w:'That SCN is the cutover point for Replicat.',s:'`FLASHBACK_SCN`, undo retention.',x:'ORA-01555 during the export means undo is too small for the duration.',c:`SELECT current_scn FROM v$database;`},
 {ids:['load'],t:'3. Import into the target. Create indexes and constraints as appropriate for apply.',w:'The target now matches the source as of the SCN.',s:'Data Pump parallelism, `TABLE_EXISTS_ACTION`.',x:'Triggers and cascading constraints on the target can fire on apply. Disable them where needed.',c:`$ impdp system parfile=hr.par`},
 {ids:['rep'],t:'4. Start Replicat to apply changes after the SCN. It reads the trail from the start and skips what is before the SCN.',w:'The SCN decides what is skipped and what is applied.',s:'`START REPLICAT ... AFTERCSN`, `HANDLECOLLISIONS` (short-term only).',x:'Leaving HANDLECOLLISIONS on hides real data errors.',c:`OGG> START REPLICAT rep1 AFTERCSN 4829107`},
 {ids:['catch'],t:'5. The backlog is applied and lag falls. When it is steady and small, the target is in sync.',w:'It marks the target ready for use or for cutover.',s:'Parallel Replicat settings.',x:'Lag that does not fall means Replicat is slower than the source rate.',c:`LAG REPLICAT rep1`},
 {ids:['chk'],t:'6. Verify counts and data. Remove HANDLECOLLISIONS if used, and take a baseline.',w:'You can now trust the target.',s:'Veridata or checksum queries.',x:'A difference found here is far cheaper than one found after cutover.',c:`SELECT COUNT(*) FROM hr.employees;`}]}},

{h:'3. A Replicat that stops with an error'},
{map:{title:'Abend recovery map',h:216,trace:'Recover an abended Replicat',
 hint:'Tap any box, or press Recover an abended Replicat to follow the diagnosis from the alert to a safe restart.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'alert',x:21,y:24,w:194,h:56,c:'warn',t:'Alert',s:'status ABENDED',d:'The process stopped. A dashboard, an alert or the lag showing growth tells you.',why:'The source continues. The trail grows.',chk:`INFO ALL`,see:[8,0,'Administration Service dashboards and alerts']},
 {id:'rpt',x:243,y:24,w:194,h:56,c:'mem',t:'Read the report',s:'error text',d:'Open the process report and the ggserr.log for the OGG error and the database error under it.',why:'The last lines of the report usually name the record and the error.',chk:`VIEW REPORT REP1`,see:[8,1,'Reports, logs and discard files']},
 {id:'cause',x:465,y:24,w:194,h:56,c:'proc',t:'Find the cause',s:'data or structure',d:'Typical causes are a missing row, a duplicate key, a missing object or privilege, or a constraint.',why:'The cause decides the fix, so do not skip it.',chk:`VIEW DISCARD REP1`,see:[8,2,'Reading error messages and common failures']},
 {id:'fix',x:21,y:136,w:194,h:56,c:'proc',t:'Fix the cause',s:'target or parameters',d:'Fix the data or object on the target, or change the parameter for the case, such as REPERROR.',why:'Skipping a record is a data decision.',chk:`OGG> EDIT PARAMS REP1`,see:[8,3,'Restarting, repositioning and recovering processes']},
 {id:'start',x:243,y:136,w:194,h:56,c:'proc',t:'Restart',s:'from checkpoint',d:'Start Replicat. It resumes from its checkpoint and retries the failed transaction.',why:'No repositioning is needed in the usual case.',chk:`OGG> START REPLICAT rep1`,see:[8,3,'Restarting, repositioning and recovering processes']},
 {id:'watch',x:465,y:136,w:194,h:56,c:'mem',t:'Watch and prevent',s:'lag and alerts',d:'Watch lag fall back, and add an alert for ABENDED and for lag, so the next one is caught sooner.',why:'A fix is not done until it is watched.',chk:`LAG REPLICAT rep1`,see:[8,0,'Administration Service dashboards and alerts']}],
 steps:[
 {ids:['alert'],t:'1. Replicat shows ABENDED. Lag is growing because the trail is full of unapplied changes.',w:'The source is not affected, the target is falling behind.',s:'Alerts on process status.',x:'Nobody noticing for hours turns a small problem into a large backlog.',c:`INFO ALL`},
 {ids:['rpt'],t:'2. Read the report and ggserr.log. Find the OGG error, the failing table and the database error.',w:'The exact error is the starting point.',s:'Report and log locations.',x:'Looking only at the status misses the error text.',c:`VIEW REPORT REP1`},
 {ids:['cause'],t:'3. Decide whether it is a data problem (a row missing or duplicate), a structure problem (a changed table) or an environment problem (space, privilege).',w:'Each has a different fix.',s:'Discard file, `REPERROR` rules.',x:'Applying a fix before knowing why risks hiding divergence.',c:`VIEW DISCARD REP1`},
 {ids:['fix'],t:'4. Fix the cause: repair the target data or structure, or set an error rule if it is expected. Record what you did.',w:'The record helps the next person.',s:'`REPERROR`, `HANDLECOLLISIONS` (temporary), SQL fix.',x:'A blanket REPERROR (DEFAULT, DISCARD) hides every future error.',c:`OGG> VIEW PARAMS REP1`},
 {ids:['start'],t:'5. Start Replicat. It resumes from its checkpoint and applies the failed transaction and the backlog.',w:'Checkpoints give exactly-once application.',s:'`START REPLICAT`, parallelism.',x:'Repositioning without need can skip or repeat data.',c:`OGG> START REPLICAT rep1`},
 {ids:['watch'],t:'6. Watch lag until it returns to normal and verify the affected tables, for example with counts or a compare.',w:'It proves the target is consistent again.',s:'Veridata, count checks.',x:'Lag back to zero does not prove no rows were skipped.',c:`LAG REPLICAT rep1`}]}},

{h:'4. Resolving an active-active conflict'},
{map:{title:'Conflict resolution map',h:216,trace:'Follow a conflict',
 hint:'Tap any box, or press Follow a conflict to see how GoldenGate detects and handles a row changed on both sides.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'upd',x:21,y:24,w:194,h:56,c:'ext',t:'Update on A',s:'at 10:00:01',d:'A user on site A updates a row.',why:'This is a normal change.',chk:`UPDATE orders SET status = 'SHIPPED' WHERE order_id = 100;`,see:[6,2,'Conflict detection and resolution (CDR)']},
 {id:'chg',x:243,y:24,w:194,h:56,c:'ext',t:'Update on B',s:'at 10:00:02',d:'A user on site B updates the same row before A\'s change arrives.',why:'Both sides now hold a different value.',chk:`UPDATE orders SET status = 'CANCELLED' WHERE order_id = 100;`,see:[6,2,'Conflict detection and resolution (CDR)']},
 {id:'rep',x:465,y:24,w:194,h:56,c:'proc',t:'Replicat applies',s:'A\'s change on B',d:'Replicat B tries to apply A\'s update and compares the before image with the current row.',why:'The before image is what the row looked like when A changed it.',chk:`INFO REPLICAT repb`,see:[6,2,'Conflict detection and resolution (CDR)']},
 {id:'cmp',x:21,y:136,w:194,h:56,c:'warn',t:'Mismatch',s:'conflict detected',d:'The current row on B does not match the before image, so there is a conflict.',why:'Without CDR it would be a silent overwrite or an error.',chk:`STATS REPLICAT repb, REPORTCDR`,see:[6,2,'Conflict detection and resolution (CDR)']},
 {id:'rule',x:243,y:136,w:194,h:56,c:'proc',t:'Rule',s:'resolution',d:'A configured rule decides the winner: latest timestamp, delta, a site priority or an exception.',why:'The rules are defined per table and per column group.',chk:`MAP hr.orders, TARGET hr.orders, RESOLVECONFLICT (UPDATEROWEXISTS, (DEFAULT, USEMAX (last_updated)));`,see:[6,2,'Conflict detection and resolution (CDR)']},
 {id:'log',x:465,y:136,w:194,h:56,c:'mem',t:'Log',s:'exception table',d:'The conflict and its outcome are written to an exception table or report.',why:'You review them. A high rate means the design needs work.',chk:`SELECT * FROM ggadmin.exceptions FETCH FIRST 5 ROWS ONLY;`,see:[6,3,'Automatic CDR']}],
 steps:[
 {ids:['upd','chg'],t:'1. Two sites change the same row within the replication delay. Neither knows about the other yet.',w:'It is possible whenever both sides write to the same data.',s:'Application design, data ownership.',x:'The bigger the lag the more conflicts.',c:`SELECT order_id, status, last_updated FROM orders WHERE order_id = 100;`},
 {ids:['rep','cmp'],t:'2. Replicat applies A\'s change on B and compares its before image with the current B row. They differ.',w:'This is how a conflict is detected.',s:'`COMPARECOLS`, supplemental logging of columns.',x:'No before-image columns logged means no detection.',c:`STATS REPLICAT repb, REPORTCDR`},
 {ids:['rule'],t:'3. The rule for this table decides: for example the row with the latest timestamp wins.',w:'It makes the result deterministic and the same on both sides.',s:'`RESOLVECONFLICT`, timestamp columns.',x:'Clock skew between sites decides the wrong winner.',c:`MAP hr.orders, TARGET hr.orders, RESOLVECONFLICT (UPDATEROWEXISTS, (DEFAULT, USEMAX (last_updated)));`},
 {ids:['log'],t:'4. The conflict and the chosen outcome are recorded, so you can audit them and measure the rate.',w:'The record is how you find a design problem.',s:'Exception table, `REPORTCDR`.',x:'No exception logging means silent data loss.',c:`SELECT COUNT(*) FROM ggadmin.exceptions;`},
 {ids:['rule','log'],t:'5. Reduce the conflicts: partition data ownership by site, use unique key ranges per site, and avoid updating the same rows from both sides.',w:'Prevention beats resolution.',s:'Key design, sequences with increments per site.',x:'Automatic CDR is a safety net, not a design.',c:`SELECT sequence_name, increment_by FROM user_sequences;`}]}},

{h:'5. Tuning a slow pipeline'},
{map:{title:'Lag tuning map',h:216,trace:'Find the slow stage',
 hint:'Tap any box, or press Find the slow stage to follow the lag chain to the part that needs tuning.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'meas',x:21,y:24,w:194,h:56,c:'mem',t:'Measure lag',s:'each stage',d:'Read lag per process: Extract, path, Replicat, and the total.',why:'It shows which stage grows and which is flat.',chk:`LAG EXTRACT ext1
LAG REPLICAT rep1`,see:[7,0,'Measuring lag: capture, transport and apply']},
 {id:'ext',x:243,y:24,w:194,h:56,c:'proc',t:'Capture lag',s:'Extract',d:'Extract is behind the source redo. Look at log mining throughput, large transactions and memory.',why:'Large transactions are cached until commit.',chk:`SELECT capture_name, state, bytes_sent FROM v$goldengate_capture;`,see:[7,1,'Integrated Extract tuning']},
 {id:'path',x:465,y:24,w:194,h:56,c:'proc',t:'Transport lag',s:'network',d:'The path is slow: bandwidth, latency or no compression.',why:'Compression often helps on a WAN.',chk:`INFO PATH path1`,see:[7,3,'Trail files, network and compression']},
 {id:'rep',x:21,y:136,w:194,h:56,c:'proc',t:'Apply lag',s:'Replicat',d:'Replicat applies slower than the trail arrives. Check parallelism, batching and commit rate.',why:'It is the most common bottleneck.',chk:`STATS REPLICAT rep1, TOTAL`,see:[7,2,'Parallel Replicat tuning and batching']},
 {id:'db',x:243,y:136,w:194,h:56,c:'disk',t:'Target database',s:'I/O and indexes',d:'The target database limits the apply: slow storage, missing indexes for the update keys, triggers.',why:'Replicat is a database client like any other.',chk:`SELECT event, total_waits FROM v$system_event ORDER BY time_waited DESC FETCH FIRST 5 ROWS ONLY;`,see:[7,2,'Parallel Replicat tuning and batching']},
 {id:'fix',x:465,y:136,w:194,h:56,c:'ext',t:'Change and re-measure',s:'one at a time',d:'Make one change, then measure the lag chain again to see its effect.',why:'Evidence over assumption.',chk:`LAG REPLICAT rep1`,see:[7,6,'Practical: Tune a slow pipeline']}],
 steps:[
 {ids:['meas'],t:'1. Measure lag per stage over time with Performance Metrics, not once. Note the rate of change as well as the value.',w:'A growing lag is different from a steady one.',s:'Performance Metrics Service.',x:'Looking only at total lag sends you to the wrong place.',c:`LAG EXTRACT ext1`},
 {ids:['ext'],t:'2. If capture lag is high, check Extract: the log mining server, memory for large transactions, and the redo rate.',w:'Extract cannot send what it has not read.',s:'`TRANLOGOPTIONS INTEGRATEDPARAMS`, `STREAMS_POOL_SIZE`.',x:'Long transactions delay everything behind them.',c:`SELECT capture_name, capture_time FROM v$goldengate_capture;`},
 {ids:['path'],t:'3. If transport lag is high, check the network: throughput against the change rate, latency, and compression.',w:'The path is limited by the link.',s:'`COMPRESS`, network tuning.',x:'Compression costs CPU on both ends.',c:`INFO PATH path1`},
 {ids:['rep','db'],t:'4. If apply lag is high, check Replicat parallelism and batching and look at the target database waits and indexes.',w:'The target is where most delay is.',s:'`MAP_PARALLELISM`, `MAX_APPLY_PARALLELISM`, `BATCHSQL`.',x:'Missing indexes on target key columns force full scans for each update.',c:`SELECT sql_id, executions, elapsed_time FROM v$sql ORDER BY elapsed_time DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['fix'],t:'5. Change one setting and measure again after a representative period.',w:'It tells you whether it worked.',s:'A tuning log.',x:'Several changes together hide which one helped.',c:`LAG REPLICAT rep1`}]}},

{h:'6. A zero-downtime migration with fallback'},
{map:{title:'Migration map',h:216,trace:'Migrate with minutes of downtime',
 hint:'Tap any box, or press Migrate with minutes of downtime to follow the pattern from load to cutover and fallback.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'load',x:21,y:24,w:194,h:56,c:'proc',t:'Load',s:'target at SCN',d:'Create the target and load it as of a known SCN while the source stays online.',why:'The source is in use throughout.',chk:`$ expdp system full=y flashback_scn=4829107`,see:[10,0,'The zero-downtime pattern: load, replicate, verify, cut over']},
 {id:'repl',x:243,y:24,w:194,h:56,c:'proc',t:'Replicate',s:'catch up',d:'Run replication so the target stays within seconds of the source.',why:'The gap between source and target is now small and steady.',chk:`LAG REPLICAT rep1`,see:[10,0,'The zero-downtime pattern: load, replicate, verify, cut over']},
 {id:'veri',x:465,y:24,w:194,h:56,c:'mem',t:'Verify',s:'compare',d:'Compare the source and the target while they are in sync, and test the application against the target.',why:'This is where you find problems cheaply.',chk:`SELECT COUNT(*) FROM hr.employees;`,see:[10,5,'Verifying with Veridata and count checks']},
 {id:'quiet',x:20,y:136,w:139,h:56,c:'warn',t:'Quiesce',s:'stop writes',d:'At the chosen moment stop application writes to the source.',why:'The downtime begins.',chk:`ALTER SYSTEM ENABLE RESTRICTED SESSION;`,see:[10,0,'The zero-downtime pattern: load, replicate, verify, cut over']},
 {id:'drain',x:187,y:136,w:139,h:56,c:'proc',t:'Drain',s:'last changes',d:'Wait for lag to reach zero so the last changes are applied.',why:'It takes seconds when lag is small.',chk:`LAG REPLICAT rep1`,see:[10,0,'The zero-downtime pattern: load, replicate, verify, cut over']},
 {id:'sw',x:354,y:136,w:139,h:56,c:'ext',t:'Switch',s:'applications',d:'Point applications at the target and open it for writes.',why:'The downtime ends here.',chk:`$ srvctl modify service ...`,see:[10,0,'The zero-downtime pattern: load, replicate, verify, cut over']},
 {id:'rev',x:521,y:136,w:139,h:56,c:'proc',t:'Reverse replication',s:'fallback',d:'Start replication from the new system back to the old one, so you can switch back without data loss.',why:'It gives the safety net for the decision.',chk:`OGG> START EXTRACT extr`,see:[10,1,'Reverse replication for fallback']}],
 steps:[
 {ids:['load'],t:'1. Load the target from the source at a known SCN while the source stays in use, and start capturing changes.',w:'There is no downtime in this step.',s:'Data Pump, `FLASHBACK_SCN`.',x:'A copy not taken at a known SCN cannot be synchronised.',c:`SELECT current_scn FROM v$database;`},
 {ids:['repl'],t:'2. Start Replicat after the SCN and let it catch up. Run like this for as long as needed.',w:'You can test and rehearse in the meantime.',s:'Replicat parallelism.',x:'A rising lag means the target cannot keep up. Fix before cutover.',c:`LAG REPLICAT rep1`},
 {ids:['veri'],t:'3. Verify the data and run the application tests against the target while replication continues.',w:'It builds confidence before the cutover.',s:'Veridata, application tests.',x:'Skipping this is how migrations fail on the night.',c:`SELECT COUNT(*) FROM hr.employees;`},
 {ids:['quiet','drain'],t:'4. At the window, stop writes to the source and wait for lag to reach zero. All changes are now on the target.',w:'This is the only period of unavailability.',s:'Application stop procedure.',x:'Background jobs and batch writers are easy to forget.',c:`LAG REPLICAT rep1`},
 {ids:['sw'],t:'5. Switch the applications to the target, and open it for writes. Downtime is the time since step 4.',w:'Minutes, regardless of database size.',s:'Services, connection strings.',x:'Cached DNS or connection pools pointing at the old system.',c:`SELECT name, open_mode FROM v$database;`},
 {ids:['rev'],t:'6. Start reverse replication so the old system receives the new changes. Keep it until you are sure you will not go back.',w:'It turns the cutover into a reversible decision.',s:'Reverse Extract and Replicat, loop prevention.',x:'Forgetting loop prevention here causes a bounce.',c:`OGG> INFO ALL`}]}},

{h:'7. Securing a deployment'},
{map:{title:'Security map',h:216,trace:'Secure a deployment',
 hint:'Tap any box, or press Secure a deployment to follow the controls from the front door to the data at rest.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'net',x:21,y:24,w:194,h:56,c:'net',t:'Network exposure',s:'proxy only',d:'Expose only the reverse proxy and keep the service ports internal.',why:'It reduces what can be attacked.',chk:`$ ss -ltnp | grep -E '9001|901'`,see:[2,3,'Configuring the reverse proxy and security basics']},
 {id:'tls',x:243,y:24,w:194,h:56,c:'net',t:'TLS',s:'certificates',d:'Use certificates for the services and for distribution paths between deployments.',why:'Trails carry your data over the network.',chk:`INFO PATH path1 DETAIL`,see:[9,0,'TLS, certificates and secure distribution paths']},
 {id:'auth',x:465,y:24,w:194,h:56,c:'ext',t:'Authentication',s:'users and roles',d:'Use named users with roles (Security, Administrator, Operator, User) or connect to your identity provider.',why:'Separate who can view from who can change.',chk:`OGG> INFO USERS`,see:[9,1,'Authentication, roles and OAuth integration']},
 {id:'cred',x:21,y:136,w:194,h:56,c:'disk',t:'Credential store',s:'no passwords in files',d:'Database logins are in the encrypted store and used by alias.',why:'Parameter files and scripts then contain no secrets.',chk:`OGG> INFO CREDENTIALSTORE`,see:[9,2,'Credential store and secrets handling']},
 {id:'role',x:243,y:136,w:194,h:56,c:'mem',t:'Least privilege',s:'database user',d:'The database user has only the privileges it needs, on the objects it replicates.',why:'It limits what a compromise can do.',chk:`SELECT privilege FROM dba_sys_privs WHERE grantee = 'GGADMIN';`,see:[3,3,'GoldenGate users and privileges']},
 {id:'test',x:465,y:136,w:194,h:56,c:'proc',t:'Test and monitor',s:'audit',d:'Test the failure path, review the access logs and set alerts for failed logins and changes.',why:'A control that is not tested is a belief.',chk:`$ grep -i 'login' $OGG_DEPLOY_HOME/var/log/ggserr.log | tail`,see:[9,6,'Practical: Secure and fail over a deployment']}],
 steps:[
 {ids:['net'],t:'1. Put the services behind the reverse proxy and close the direct service ports at the firewall.',w:'One controlled entry point.',s:'NGINX config, firewall rules.',x:'Direct service ports left open bypass the proxy controls.',c:`$ ss -ltn`},
 {ids:['tls'],t:'2. Configure TLS on the proxy and on distribution paths, using certificates from your CA with the right host names.',w:'It protects the data in motion and authenticates the endpoints.',s:'Certificates, `wallet`, path security.',x:'An expired certificate stops replication at an inconvenient moment. Monitor expiry.',c:`OGG> INFO PATH path1 DETAIL`},
 {ids:['auth'],t:'3. Create named users with the lowest role they need, or integrate with your identity provider.',w:'Access is attributable and limited.',s:'Roles, OAuth or LDAP integration.',x:'Shared admin accounts make the audit trail useless.',c:`OGG> INFO USERS`},
 {ids:['cred','role'],t:'4. Store database logins in the credential store and grant the database user only the privileges it needs.',w:'A leaked parameter file reveals nothing.',s:'Credential store, `DBMS_GOLDENGATE_AUTH`.',x:'A password in a script is a password everywhere that script goes.',c:`SELECT privilege FROM dba_sys_privs WHERE grantee = 'GGADMIN';`},
 {ids:['test'],t:'5. Test a failover, rotate a certificate, and check the logs and alerts. Record the results.',w:'It proves that security does not break replication.',s:'Runbook, calendar for rotations.',x:'Untested rotation is how replication stops on the day the certificate expires.',c:`$ openssl x509 -enddate -noout -in server.crt`}]}},

]},

/* 1 ---------------------------------------------------------------- services/processes */
{t:'Services and processes',d:'The services of a deployment and the replication processes, and where to look when one misbehaves.',see:[[1,0,'The five services'],[1,2,'The data flow']],b:[
{h:'Services'},
{t:[['Service','Role','Typical port'],
['Service Manager','Starts, stops and monitors deployments and their services','Set at install (for example 9001)'],
['Administration Server','Create and manage Extracts, Replicats, credentials, parameters','Set per deployment (for example 9011)'],
['Distribution Server','Sends trail data to remote Receiver Servers with paths','For example 9012'],
['Receiver Server','Receives trail data from a Distribution Server','For example 9013'],
['Performance Metrics Server','Collects and stores metrics','For example 9014 (plus a UDP port for metrics collection)']]},
{h:'Replication processes'},
{t:[['Process','Job','Look here'],
['Extract (integrated)','Captures changes through the database log mining server','`INFO EXTRACT`, report, `V$GOLDENGATE_CAPTURE`'],
['Extract (initial load)','Reads source tables for an initial copy','Report file'],
['Path (Distribution)','Sends a trail from source to target','Distribution Server UI, `INFO PATH`'],
['Replicat (parallel, integrated, coordinated, classic)','Reads a trail and applies to the target','`INFO REPLICAT`, report, discard file'],
['Collector / Receiver','Writes received data into a remote trail','Receiver Server']]},
{note:'Ports are chosen when you create the deployments. They are shown on the Service Manager home page and in the `oggca.sh` response file.'}
]},

/* 2 ---------------------------------------------------------------- files */
{t:'Files and directories',d:'What each directory of a deployment contains.',see:[[1,1,'Deployments and homes'],[4,1,'Trail files']],b:[
{t:[['Path','Contents'],
['`OGG_HOME`','Installed software (binaries), shared by deployments'],
['`OGG_ETC_HOME` / `etc`','Configuration of the deployment'],
['`etc/conf/ogg`','Parameter files (`*.prm`) for Extract and Replicat'],
['`OGG_VAR_HOME` / `var`','Variable data of the deployment'],
['`var/lib/data`','Trail files'],
['`var/lib/checkpt`','Checkpoint files (`*.cpe`, `*.cpr`) used for restart'],
['`var/lib/wallet` (credential store)','Encrypted database credentials (aliases)'],
['`var/log`','`ggserr.log` and service logs'],
['`var/lib/report`','Process report files (`*.rpt`)'],
['`var/lib/discard` (or the path in `DISCARDFILE`)','Discard files (`*.dsc`)'],
['`ServiceManager` home','Service Manager configuration and logs'],
['Reverse proxy configuration','NGINX or similar mapping to services']]},
{note:'Back up `etc`, the credential store and checkpoint files. Without checkpoints you must reposition processes by SCN or timestamp.'}
]},

/* 3 ---------------------------------------------------------------- logs */
{t:'Log files and where to find them',d:'Where each kind of event is recorded.',see:[[8,1,'Reports, logs and discard files'],[8,2,'Reading error messages']],b:[
{t:[['Log','Contains','Where'],
['`ggserr.log`','Process starts, stops, warnings and errors for the deployment','`var/log/ggserr.log`'],
['Process report','Parameters, statistics, errors of one Extract or Replicat (`EXT1.rpt`)','`var/lib/report`, UI: Details > Report'],
['Discard file','Records that failed to apply and why','`DISCARDFILE` path, `*.dsc`'],
['Service logs','Service Manager and service events','`var/log` of the Service Manager and deployment'],
['REST API log','Calls made through the REST API','Service log (restapi)'],
['Database alert log','Log mining server and capture errors','ADR `alert_<SID>.log`'],
['Performance Metrics','Lag, throughput, rate history','Performance Metrics Server UI']]},
{code:`-- Admin Client
VIEW REPORT EXT1
VIEW DISCARD REP1
INFO ALL
LAG EXTRACT EXT1
STATS EXTRACT EXT1, TOTAL, DAILY`}
]},

/* 4 ---------------------------------------------------------------- parameters */
{t:'Important parameters',d:'The Extract, Replicat and database parameters you set most.',see:[[5,0,'TABLE and MAP'],[4,0,'Integrated Extract']],b:[
{h:'Extract'},
{t:[['Parameter','Meaning'],
['`EXTRACT name`','Name the process'],
['`USERIDALIAS alias DOMAIN OracleGoldenGate`','Database credentials from the credential store'],
['`EXTTRAIL aa`','Local trail prefix (two characters)'],
['`TABLE schema.*;`','Tables to capture (in a PDB use `pdb.schema.table`)'],
['`TABLEEXCLUDE`','Exclude tables'],
['`DDL INCLUDE MAPPED`','Capture DDL for mapped objects'],
['`TRANLOGOPTIONS INTEGRATEDPARAMS (max_sga_size 1024, parallelism 4)`','Log mining server settings'],
['`WARNLONGTRANS 1H, CHECKINTERVAL 5M`','Warn about long open transactions'],
['`LOGALLSUPCOLS`, `UPDATERECORDFORMAT COMPACT`','Capture supplemental columns and format updates'],
['`REPORTCOUNT EVERY 5 MINUTES, RATE`','Periodic statistics in the report']]},
{h:'Replicat'},
{t:[['Parameter','Meaning'],
['`REPLICAT name`','Name the process'],
['`MAP src.*, TARGET tgt.*;`','Mapping source to target'],
['`DBOPTIONS INTEGRATEDPARAMS(parallelism 4)`','Integrated Replicat apply settings'],
['`APPLY_PARALLELISM`, `MIN_/MAX_APPLY_PARALLELISM`','Parallel Replicat apply threads'],
['`BATCHSQL`','Batch similar statements'],
['`REPERROR (DEFAULT, ABEND)`, `REPERROR (1403, DISCARD)`','Error handling rules'],
['`HANDLECOLLISIONS`','Tolerate missing and duplicate rows during initial load catch-up (turn off after)'],
['`DISCARDFILE path, APPEND, MEGABYTES 100`','Record failed operations'],
['`MAXTRANSOPS`, `SPLIT_TRANS_RECS`','Break up large transactions'],
['`ASSUMETARGETDEFS`','Source and target structures are identical']]},
{h:'Database parameters'},
{t:[['Parameter','Typical'],
['`enable_goldengate_replication`','`TRUE` (source and target)'],
['`streams_pool_size`','Sized for integrated capture and apply, or leave to automatic SGA'],
['`compatible`','At least the level required by the GoldenGate release'],
['Supplemental logging','`ALTER DATABASE ADD SUPPLEMENTAL LOG DATA;` plus table or schema level']]}
]},

/* 5 ---------------------------------------------------------------- views */
{t:'Database views and Admin Client status',d:'Which view or command answers which GoldenGate question.',see:[[3,2,'Supplemental logging'],[8,0,'Dashboards and alerts']],b:[
{t:[['Question','View or command'],
['Is a table supported for integrated capture?','`DBA_GOLDENGATE_SUPPORT_MODE`'],
['Who has GoldenGate privileges?','`DBA_GOLDENGATE_PRIVILEGES`'],
['Is capture running, how far is it?','`V$GOLDENGATE_CAPTURE`'],
['Open transactions seen by capture','`V$GOLDENGATE_TRANSACTION`'],
['Apply side activity','`V$GG_APPLY_COORDINATOR`, `V$GG_APPLY_READER`, `V$GG_APPLY_SERVER`'],
['Capture and apply definitions','`DBA_CAPTURE`, `DBA_APPLY`'],
['Supplemental logging state','`V$DATABASE` (`SUPPLEMENTAL_LOG_DATA_MIN`, `..._PK`, `..._ALL`), `DBA_LOG_GROUPS`'],
['Which Extracts and Replicats exist?','`INFO ALL`'],
['Process detail and checkpoints','`INFO EXTRACT EXT1, DETAIL`, `INFO REPLICAT REP1, SHOWCH`'],
['Lag now','`LAG EXTRACT EXT1`, `LAG REPLICAT REP1`'],
['Statistics','`STATS EXTRACT EXT1, TOTAL`'],
['Credential store contents','`INFO CREDENTIALSTORE`'],
['Heartbeat lag','Heartbeat table views `GG_LAG`, `GG_HEARTBEAT_HISTORY`']]}
]},

/* 6 ---------------------------------------------------------------- tools */
{t:'Admin Client and REST commands',d:'The commands used to build and run a replication, in the order you use them.',see:[[2,2,'oggca and deployments'],[4,0,'Integrated Extract']],b:[
{h:'Build a one-way replication (Admin Client)'},
{code:`CONNECT https://host:9011 DEPLOYMENT src AS oggadmin PASSWORD ******
DBLOGIN USERIDALIAS srcdb DOMAIN OracleGoldenGate
ADD SCHEMATRANDATA pdb1.shop ALLCOLS
REGISTER EXTRACT ext1 DATABASE CONTAINER (pdb1)
ADD EXTRACT ext1, INTEGRATED TRANLOG, BEGIN NOW
ADD EXTTRAIL aa, EXTRACT ext1
START EXTRACT ext1

-- target
DBLOGIN USERIDALIAS tgtdb DOMAIN OracleGoldenGate
ADD REPLICAT rep1, PARALLEL, EXTTRAIL ab, CHECKPOINTTABLE ggadmin.chkpt
START REPLICAT rep1, ATCSN 1234567`},
{t:[['Command','Use'],
['`INFO ALL`','State of all processes'],
['`INFO EXTRACT ext1, DETAIL`','Details, trail, checkpoint position'],
['`STOP / START / KILL EXTRACT ext1`','Control'],
['`ALTER EXTRACT ext1, BEGIN <timestamp>`','Reposition by time'],
['`ALTER REPLICAT rep1, EXTSEQNO 12, EXTRBA 0`','Reposition in a trail'],
['`DELETE EXTRACT ext1`','Remove (after unregistering)'],
['`UNREGISTER EXTRACT ext1 DATABASE`','Remove capture from the database'],
['`ADD CREDENTIALSTORE`, `ALTER CREDENTIALSTORE ADD USER ... ALIAS ...`','Credential aliases'],
['`ADD HEARTBEATTABLE`','Create heartbeat objects for end-to-end lag'],
['`SEND EXTRACT ext1, STATUS`','Ask a running process for status'],
['`VIEW PARAMS ext1`, `EDIT PARAMS ext1`','Parameter file']]},
{note:'Syntax differs a little between versions. Use `HELP <command>` in the Admin Client and the REST API reference of your release for the exact form.'}
]},

/* 7 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'Which Extract, which Replicat, which load method and which topology.',see:[[4,0,'Integrated Extract'],[4,2,'Replicat types']],b:[
{h:'Extract type'},
{t:[['Type','Use'],
['Integrated Extract (database log mining)','Oracle source, default and recommended'],
['Classic Extract','Older releases or non-Oracle sources only; where integrated is not supported'],
['Initial load Extract','One-time copy of existing data'],
['Pump (path)','Move trail data between servers']]},
{h:'Replicat type'},
{t:[['Type','Use'],
['Parallel Replicat','Default for high throughput, dependency-aware apply'],
['Integrated Replicat','Oracle target, uses the database apply server'],
['Coordinated Replicat','Split work by tables or ranges (older approach)'],
['Classic Replicat','Simple or non-Oracle targets']]},
{h:'Initial load method'},
{t:[['Method','Use'],
['Data Pump with SCN (`FLASHBACK_SCN`)','Oracle to Oracle, most common'],
['GoldenGate initial load Extract and Replicat','Heterogeneous targets'],
['RMAN duplicate or Data Guard then switch to GG','Very large Oracle databases (specific cases)'],
['Database native tools','Non-Oracle targets']]},
{h:'Topology'},
{t:[['Need','Use'],
['Migration or upgrade','One-way with reverse replication for fallback'],
['Reporting copy','One-way, filtered'],
['Active-active','Bidirectional with conflict detection and loop prevention'],
['One to many','Hub and spoke'],
['Consolidation','Many to one']]},
{h:'Supplemental logging level'},
{t:[['Level','What to add'],
['Minimal (database)','Always: `ADD SUPPLEMENTAL LOG DATA`'],
['Schema level','`ADD SCHEMATRANDATA` for schemas to be captured'],
['Table level','`ADD TRANDATA` for tables not in schema scope, with key or all columns']]}
]},

/* 8 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, likely cause and fix.',see:[[8,2,'Reading error messages'],[8,6,'Five broken replications']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['Extract ABENDED at start','Report, `ggserr.log`','Not registered, privileges, supplemental logging','`REGISTER EXTRACT`, grant privileges, add trandata'],
['Replicat ABENDED, discard has rows','Discard file, ORA error','Missing row (ORA-01403), duplicate (ORA-00001), constraint','`REPERROR`, repair data, handle collisions, reposition'],
['Lag grows at capture','`LAG EXTRACT`, `V$GOLDENGATE_CAPTURE`','Long transaction, redo volume, log mining memory','Check `WARNLONGTRANS`, `max_sga_size`, parallelism'],
['Lag grows at apply','`INFO REPLICAT`, apply views','Slow target, large transactions, no batching','Parallel Replicat, `BATCHSQL`, indexes on target'],
['Lag grows at network','Path state, bandwidth','Latency or limited bandwidth','Compression, TCP tuning'],
['No data at target but running','`STATS`, mapping','Wrong `TABLE` or `MAP`, filter','Fix parameters, restart'],
['Path stops, certificate error','Distribution log, certificate dates','Expired or wrong certificate','Renew and update'],
['ORA-01291 missing log file','Archived log availability','Logs deleted before capture read them','Restore the log, change deletion policy'],
['Trail disk full','`df`, trail purge settings','No purge, slow consumers','Purge policy, extend space, fix slow Replicat'],
['Cannot connect to service','Reverse proxy, ports, firewall','Proxy mapping or service down','Check Service Manager, certificates'],
['Data differs','Veridata or count and checksum','Collisions hidden, missed DDL','Compare, repair, review DDL handling']]}
]},

/* 9 ---------------------------------------------------------------- errors */
{t:'Common error messages',d:'Messages and database errors seen most often, with first action.',see:[[8,2,'Reading error messages'],[8,3,'Restarting and repositioning']],b:[
{t:[['Message','Meaning','First action'],
['ORA-01403','No data found: target row missing for an update or delete','Check discard file; initial load or resync'],
['ORA-00001','Unique constraint violated on apply','Duplicate or collision; handle collisions or fix data'],
['ORA-01291','Missing log file','Restore archived log, check retention'],
['ORA-01031','Insufficient privileges (database user)','Grant GoldenGate privileges (`DBMS_GOLDENGATE_AUTH`)'],
['ORA-26687','Instantiation SCN not set','Use `START REPLICAT ... ATCSN` or set instantiation'],
['ORA-26786 / 26787','Row exists with conflicting columns / row does not exist','Conflict detection or data difference'],
['ORA-00060','Deadlock on apply','Parallelism and ordering; retry settings'],
['ORA-01555','Snapshot too old during capture or initial load','Increase undo retention'],
['OGG-00664','OCI error beginning session','Check credentials and connectivity'],
['OGG-01154','SQL error mapping a record','Read the ORA code inside the message'],
['OGG-01163','Bad column index in a mapping','Source and target definitions differ'],
['OGG-01168','Update without all key columns','Add key columns or supplemental logging'],
['OGG-01296','Error mapping source column to target','Check column mapping and types'],
['OGG-02022','Log mining server does not exist','Re-register the Extract']]},
{note:'Read the complete message text in `ggserr.log` and the report, not only the number. The same OGG code can have different details.'}
]},

/* 10 ---------------------------------------------------------------- health check */
{t:'Health-check pack',d:'Admin Client and SQL checks for the daily review.',see:[[8,0,'Dashboards and alerts'],[12,1,'Sizing, monitoring and alerting']],b:[
{h:'Admin Client'},
{code:`INFO ALL
LAG EXTRACT *
LAG REPLICAT *
STATS EXTRACT ext1, LATEST
INFO PATH *
INFO CREDENTIALSTORE`},
{h:'Capture (source database)'},
{code:`SELECT capture_name, state, total_messages_captured, capture_time, enqueue_message_create_time
FROM v$goldengate_capture;

SELECT xidusn, xidslt, xidsqn, cumulative_message_count, first_message_time
FROM v$goldengate_transaction ORDER BY first_message_time FETCH FIRST 10 ROWS ONLY;`},
{h:'Supplemental logging and archived logs'},
{code:`SELECT supplemental_log_data_min, supplemental_log_data_pk, supplemental_log_data_all, force_logging FROM v$database;
SELECT name, value FROM v$parameter WHERE name = 'enable_goldengate_replication';`},
{h:'Apply (target database)'},
{code:`SELECT apply_name, state, total_applied, total_errors FROM v$gg_apply_coordinator;
SELECT * FROM dba_apply_error ORDER BY error_creation_time DESC FETCH FIRST 10 ROWS ONLY;`},
{h:'Host'},
{code:`df -h /u01/ogg/var/lib/data
ls -ltr /u01/ogg/var/log | tail
tail -50 /u01/ogg/var/log/ggserr.log`}
]},

/* 11 ---------------------------------------------------------------- naming decoder */
{t:'Naming decoder',d:'How trails, processes, paths and checkpoints are named.',see:[[4,1,'Trail files'],[1,1,'Deployments']],b:[
{t:[['Item','Looks like','Meaning'],
['Trail prefix','`aa`','Two characters you choose when adding the trail'],
['Trail file','`aa000000012`','Prefix plus sequence number (9 digits)'],
['Trail position','`SEQNO 12, RBA 3817`','Trail sequence and byte offset'],
['Extract name','`EXT1`, `EXTSHOP`','Up to eight characters'],
['Replicat name','`REP1`','Up to eight characters'],
['Path name','`src_to_tgt`','Distribution path from source to target'],
['Credential alias','`srcdb`','Name for stored credentials, used in `USERIDALIAS`'],
['Domain','`OracleGoldenGate`','Credential store domain'],
['Checkpoint files','`EXT1.cpe`, `REP1.cpr`','Extract and Replicat restart positions'],
['Report file','`EXT1.rpt`, `EXT1_0.rpt`','Current and aged reports'],
['Discard file','`REP1.dsc`','Failed operations'],
['SCN / CSN','`1234567`','Commit sequence number used in `ATCSN`, `AFTERCSN`'],
['Deployment','`src`, `tgt`','A set of services and a home inside Service Manager'],
['Heartbeat table','`GG_HEARTBEAT`, `GG_LAG`','End-to-end lag measurement objects'],
['REST path','`/services/v2/extracts/EXT1`','Resource in the REST API']]}
]},

/* 12 ---------------------------------------------------------------- security/HA */
{t:'Security and HA checklist',d:'A short checklist for a deployment before go-live.',see:[[9,0,'TLS and certificates'],[9,3,'High availability']],b:[
{t:[['Area','Check'],
['Transport','HTTPS on all services and `wss://` for distribution paths'],
['Identity','Named users with roles (Security, Administrator, Operator, User), no shared admin'],
['Secrets','Credentials only in the credential store, no passwords in parameter files or scripts'],
['Certificates','Expiry dates tracked and alerts at 30 and 7 days'],
['Network','Services behind a reverse proxy, only needed ports open'],
['Database user','Least privilege, separate source and target GoldenGate users'],
['Trail files','File permissions restricted, encryption if required'],
['Backup','Deployment `etc`, wallet, checkpoints backed up and restore tested'],
['HA','Clusterware agent or Configuration Service, failover tested'],
['DR','Replication layer documented in the DR plan'],
['Monitoring','State, lag, discard, trail disk and certificate alerts routed to on-call']]}
]},

/* 13 ---------------------------------------------------------------- versions */
{t:'Versions and architecture notes',d:'Which architecture and which release you are likely to meet, and what changed.',see:[[0,4,'Versions'],[1,5,'Configuration Service']],b:[
{t:[['Item','Note'],
['Microservices Architecture','The current architecture: services with REST API and Web UI'],
['Classic Architecture','Older GGSCI-based deployments; deprecated and removed in newer releases. Plan migration.'],
['19c','Last release that was widely used in classic mode; supports microservices too'],
['21c, 23ai, 26ai','Microservices Architecture; feature additions (Configuration Service, new targets, AI related). Check release notes.'],
['Configuration Service','High availability for deployment configuration (23ai and later)'],
['Veridata','Separate product for comparing and repairing data'],
['OCI GoldenGate','Managed service, you create connections and deployments'],
['Licensing','Per-core licence or service-based; check for your use']]},
{note:'Version support and feature lists change. Read the release notes of the exact version before upgrading GoldenGate or the database it replicates.'}
]}

]};
