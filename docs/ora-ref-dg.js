/* LearnSphere - Data Guard Quick Reference (cheat sheet).
   window.QREF['ora-dg'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Values are for Oracle Data Guard 19c on Linux unless stated; 26ai additions are marked [26ai].
   Check broker property names with SHOW DATABASE VERBOSE <db> in DGMGRL on your release. */
window.QREF=window.QREF||{};
window.QREF['ora-dg']={title:'Data Guard Quick Reference',blurb:'Processes, files, parameters, broker properties, views, role transitions and fixes on one page each.',hint:'lag or switchover',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas behind Data Guard that you should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command or query to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Foundations'},
{acc:[
{t:'HA vs DR, RPO and RTO',s:'Two different problems.',
 a:'**High availability** keeps service running through a local failure such as a node loss (RAC does this). **Disaster recovery** restores service after the whole site or storage is lost (Data Guard does this). **RPO** is how much data you can lose and **RTO** is how long you can be down. Data Guard lets you choose both by protection mode and by automation.',
 w:'It is the question to answer first. A design that meets an RPO of zero but takes four hours to fail over has not met the business need.',
 c:`SELECT database_role, protection_mode, protection_level FROM v$database;`,see:[0,0,'HA vs DR: RPO and RTO in practice']},
{t:'Maximum Availability Architecture',s:'Oracle\'s tiered reference designs.',
 a:'**MAA** describes Bronze, Silver, Gold and Platinum tiers. Bronze is a single instance with backups. Silver adds RAC. Gold adds Data Guard (and Active Data Guard). Platinum adds GoldenGate and application continuity for zero downtime. Each step lowers RTO and RPO and raises cost.',
 w:'It gives you a shared vocabulary with the business: pick the tier from the cost of an hour of downtime.',
 c:`SELECT name, value FROM v$option WHERE parameter IN ('Real Application Clusters','Data Guard');`,see:[0,1,'Maximum Availability Architecture tiers']},
{t:'Standby types',s:'Physical, snapshot and logical.',
 a:'A **physical standby** is a block-for-block copy kept in step by redo apply. A **snapshot standby** is a physical standby opened read-write for testing, then converted back. A **logical standby** applies SQL and can be open for other work, but supports fewer data types. Most sites use physical standbys.',
 w:'Physical is the default and the safest, because it is identical to the primary. Logical standby is now rare, and rolling upgrades are done with `DBMS_ROLLING`.',
 c:`SELECT database_role, open_mode, switchover_status FROM v$database;`,see:[0,3,'Standby types: physical, snapshot and logical']},
{t:'Data Guard, backup, RAC and GoldenGate',s:'What each one is for.',
 a:'**Backup** restores to a point in time. **RAC** protects against node failure inside one site. **Data Guard** keeps a whole database copy at another site. **GoldenGate** replicates selected data, between different versions or platforms, in both directions. They are complements, not substitutes.',
 w:'A standby copies a mistaken DELETE within seconds. You still need Flashback and backups.',
 c:`SELECT instance_name, host_name FROM gv$instance;`,see:[0,2,'Data Guard vs backup, RAC and GoldenGate']},
{t:'Licensing: Data Guard vs Active Data Guard',s:'Which features cost extra.',
 a:'Data Guard (redo transport and apply, broker, switchover and failover) is included with Enterprise Edition. **Active Data Guard** is a separately licensed option. It adds read-only queries while redo apply runs, automatic block repair, DML redirection, Far Sync, real-time cascade and more.',
 w:'Opening a standby read-only while apply runs is the Active Data Guard feature. Check before you turn it on.',
 c:`SELECT open_mode FROM v$database;
SELECT * FROM v$option WHERE parameter LIKE '%Active Data Guard%';`,see:[0,5,'Licensing: Data Guard vs Active Data Guard']}
]},

{h:'Redo transport and apply'},
{acc:[
{t:'The redo flow',s:'Generate, ship, receive, apply.',
 a:'Changes generate **redo** on the primary. The log writer, or a network server process, **ships** it to the standby. The **RFS** process on the standby **receives** it and writes it into standby redo logs. The **MRP** process **applies** it to the standby datafiles. Transport and apply are separate stages with separate lags.',
 w:'When someone says "the standby is behind", ask which stage: transport (redo has not arrived) or apply (it arrived but is not applied).',
 c:`SELECT name, value, unit FROM v$dataguard_stats WHERE name IN ('transport lag','apply lag');`,see:[1,0,'Redo generation, transport and apply: the full flow']},
{t:'Data Guard processes',s:'LNS, ARCn, RFS, MRP.',
 a:'On the primary, **LNS** (the NSSn and NSAn processes in 12c and later) ships redo from the redo buffer and **ARCn** ships archived logs and fills gaps. On the standby, **RFS** receives, **MRP0** applies redo, and **DMON** (with the broker) coordinates. Each one is visible in the process list.',
 w:'When redo stops flowing, these are the processes to check in `V$MANAGED_STANDBY` and the alert log.',
 c:`SELECT process, status, thread#, sequence#, block# FROM v$managed_standby ORDER BY process;`,see:[1,1,'Processes: LNS, ARCn, RFS, MRP and their roles']},
{t:'Standby redo logs',s:'Where incoming redo lands.',
 a:'**Standby redo logs** (SRLs) receive redo from the primary in real time. They should be the same size as the largest online redo log, with one more group than the online groups per thread. They are needed for real-time apply and for synchronous transport.',
 w:'Without SRLs, redo is shipped only as whole archived logs, so lag is at least one log switch. Create them on the primary too, so they exist after a switchover.',
 c:`SELECT group#, thread#, bytes/1024/1024 AS mb, status FROM v$standby_log;`,see:[1,2,'Standby redo logs and real-time apply']},
{t:'SYNC, ASYNC and Fast Sync',s:'Wait, or do not wait.',
 a:'**SYNC** makes the commit wait until the redo is written (or acknowledged) at the standby. **ASYNC** ships redo without waiting. **Fast Sync** (`SYNC NOAFFIRM`) waits only for the standby to receive the redo in memory, not to write it to disk, which lowers commit time.',
 w:'SYNC is what gives zero data loss, and its cost is network round-trip time added to every commit. Far Sync lets you use SYNC over long distances.',
 c:`SELECT dest_id, transmit_mode, affirm, destination FROM v$archive_dest WHERE target = 'STANDBY';`,see:[1,3,'SYNC vs ASYNC transport and Fast Sync']},
{t:'Protection modes',s:'Maximum Protection, Availability, Performance.',
 a:'**Maximum Performance** uses ASYNC and never delays the primary. **Maximum Availability** uses SYNC, and if the standby becomes unreachable the primary keeps running and later resynchronises. **Maximum Protection** uses SYNC and stops the primary rather than allow data loss when no standby can acknowledge.',
 w:'The mode is a business choice. Maximum Availability is the usual choice for zero data loss without a risk to uptime.',
 c:`SELECT protection_mode, protection_level FROM v$database;
ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE AVAILABILITY;`,see:[1,4,'Protection modes']},
{t:'Gaps and FAL',s:'Missing logs are fetched automatically.',
 a:'A **gap** is a range of redo the standby did not receive, for example after a network break. The standby detects it and asks the **FAL server** (the primary or another standby) for the missing archived logs. It resolves itself unless the logs have been deleted.',
 w:'If a gap does not close, check network, `FAL_SERVER` and whether the archived logs still exist. Deleted logs mean a roll forward from the primary.',
 c:`SELECT thread#, low_sequence#, high_sequence# FROM v$archive_gap;`,see:[1,5,'Gap detection and resolution']},
{t:'Roles and DB_UNIQUE_NAME',s:'Same DB_NAME, different identity.',
 a:'Every database in a configuration has the same `DB_NAME` and its own **`DB_UNIQUE_NAME`**. The role (primary or standby) is a state, not a name, and switchover swaps the roles. Services can be started only in a given role, so applications follow the primary.',
 w:'Using DB_UNIQUE_NAME in the connect strings and the broker is how you tell the databases apart.',
 c:`SELECT db_unique_name, database_role FROM v$database;
SHOW PARAMETER db_unique_name`,see:[1,6,'Role-based services and database roles']}
]},

{h:'Setup'},
{acc:[
{t:'FORCE LOGGING and Flashback',s:'Prerequisites for a reliable standby.',
 a:'**ARCHIVELOG** mode is required. **FORCE LOGGING** makes every change generate redo, even NOLOGGING operations, so the standby is never missing data. **Flashback Database** is not required but lets you reinstate a failed primary quickly instead of rebuilding it.',
 w:'A NOLOGGING load without FORCE LOGGING silently leaves unusable blocks on the standby. Turn it on before you build.',
 c:`SELECT log_mode, force_logging, flashback_on FROM v$database;`,see:[2,1,'ARCHIVELOG, FORCE LOGGING and Flashback prerequisites']},
{t:'Key parameters',s:'The handful that define the configuration.',
 a:'`DB_UNIQUE_NAME`, `LOG_ARCHIVE_CONFIG` (the list of databases), `LOG_ARCHIVE_DEST_n` (where redo is sent), `FAL_SERVER`, `STANDBY_FILE_MANAGEMENT=AUTO`, and the file name convert parameters. With the broker, it sets most of these for you.',
 w:'When something is wrong, comparing these parameters on the primary and the standby finds the cause most of the time.',
 c:`SELECT name, value FROM v$parameter WHERE name IN ('db_unique_name','log_archive_config','fal_server','standby_file_management','dg_broker_start');`,see:[2,3,'db_unique_name, log_archive_config and related parameters']},
{t:'Static listener and password file',s:'Needed to restart and to ship redo.',
 a:'The standby needs a **static listener registration** so you can connect to it while it is down or in NOMOUNT, which is when you need it. Redo transport authenticates through the **password file**, which must be the same on every database (copied, not recreated).',
 w:'ORA-01017 on redo transport and ORA-12528 on startup are almost always one of these two.',
 c:`SELECT username, sysdba, sysoper FROM v$pwfile_users;
$ lsnrctl status`,see:[2,5,'Password file and wallet sharing']},
{t:'RMAN duplicate for standby',s:'The usual way to build one.',
 a:'`DUPLICATE TARGET DATABASE FOR STANDBY FROM ACTIVE DATABASE` copies the running primary to the standby over the network, creates the standby control file and leaves it ready for redo apply. A backup-based duplicate avoids the load on the primary.',
 w:'It is the same technique for any standby build or rebuild, including a full re-instantiation after a failed reinstate.',
 c:`RMAN> DUPLICATE TARGET DATABASE FOR STANDBY FROM ACTIVE DATABASE DORECOVER SPFILE SET db_unique_name='stby' NOFILENAMECHECK;`,see:[3,0,'RMAN active duplicate for standby']}
]},

{h:'Broker and role transitions'},
{acc:[
{t:'Data Guard broker',s:'One command line for the configuration.',
 a:'The **broker** is a management layer. **DMON** on each database keeps a shared configuration file and applies changes consistently. You use **DGMGRL** (or Cloud Control) to create the configuration, set properties, switch over and fail over. It also sets the parameters you would otherwise edit by hand.',
 w:'Once the broker manages a standby, change settings through it, not with `ALTER SYSTEM`, or it will revert them.',
 c:`DGMGRL> SHOW CONFIGURATION;
DGMGRL> SHOW DATABASE VERBOSE stby;`,see:[4,0,'Broker architecture: DMON, configuration files and properties']},
{t:'VALIDATE DATABASE',s:'Ask the broker if it is ready.',
 a:'`VALIDATE DATABASE` checks whether a standby is ready for a role change: whether it is applying, how far behind it is, whether SRLs are configured and whether flashback is on. Variants check the network and static connect identifiers.',
 w:'Run it before every switchover and as a regular health check. It turns unknowns into a list.',
 c:`DGMGRL> VALIDATE DATABASE stby;
DGMGRL> VALIDATE NETWORK CONFIGURATION FOR ALL;`,see:[4,4,'VALIDATE DATABASE and configuration health']},
{t:'Switchover',s:'A planned, lossless role swap.',
 a:'A **switchover** exchanges the roles of the primary and a standby with no data loss. The old primary becomes a standby, and you can switch back. It is used for planned maintenance and for drills.',
 w:'It is also the proof that the standby works. Do it regularly, because an untested standby is an assumption.',
 c:`DGMGRL> VALIDATE DATABASE stby;
DGMGRL> SWITCHOVER TO stby;`,see:[5,0,'Switchover: planned role change']},
{t:'Failover and reinstate',s:'An unplanned role change, then recovery of the old primary.',
 a:'A **failover** promotes a standby when the primary is lost. Some data may be lost, depending on the protection mode. The failed primary can later be **reinstated** as a standby using Flashback Database, instead of being rebuilt from scratch.',
 w:'Reinstate is why Flashback Database is on every primary in a Data Guard design.',
 c:`DGMGRL> FAILOVER TO stby;
DGMGRL> REINSTATE DATABASE prim;`,see:[5,1,'Failover: unplanned role change']},
{t:'Fast-Start Failover',s:'Automatic failover decided by an observer.',
 a:'With **Fast-Start Failover** an **observer** process on a third host watches the primary. If the primary is unreachable for the threshold time and the standby agrees, the observer triggers a failover on its own and reinstates the old primary when it returns. Lag limits and the protection mode decide how much data may be lost.',
 w:'It turns an outage at 3 a.m. into a short blip. The observer must be outside both sites.',
 c:`DGMGRL> SHOW FAST_START FAILOVER;
DGMGRL> START OBSERVER;`,see:[6,0,'Fast-Start Failover concepts and requirements']},
{t:'Role-based services',s:'Applications follow the primary.',
 a:'A **database service** can be defined to run only when the database holds a particular role. Applications connect to that service, so after a role change they reach the new primary without a configuration change. A trigger or clusterware starts the right service.',
 w:'Without role-based services a switchover works for the database and fails for the application.',
 c:`SELECT name FROM v$active_services;
srvctl add service -db orcl -service app_rw -role PRIMARY`,see:[5,5,'Application considerations and services']}
]},

{h:'Using the standby and operating it'},
{acc:[
{t:'Real-time query',s:'Read from the standby while it applies.',
 a:'With Active Data Guard a physical standby is **open read-only** while redo apply continues, so reports and queries see data seconds behind the primary. Query SCN and lag decide how current it is.',
 w:'It moves reports and extracts off the primary, and the standby does useful work until it is needed.',
 c:`SELECT open_mode, database_role FROM v$database;
SELECT value FROM v$dataguard_stats WHERE name = 'apply lag';`,see:[7,0,'Active Data Guard: real-time query and offloading']},
{t:'Snapshot standby',s:'A test copy that can go back.',
 a:'A **snapshot standby** is a standby opened read-write after a guaranteed restore point. Redo keeps being received but is not applied. When you convert back, Oracle flashes back to the restore point and catches up on the redo.',
 w:'It gives a realistic test database without a copy. While it is open, your recovery point is only as good as the received logs.',
 c:`DGMGRL> CONVERT DATABASE stby TO SNAPSHOT STANDBY;
DGMGRL> CONVERT DATABASE stby TO PHYSICAL STANDBY;`,see:[7,3,'Snapshot standby for testing']},
{t:'Automatic block repair',s:'A corrupt block is fixed from the other side.',
 a:'When a query on the primary or standby reads a corrupt block, Active Data Guard fetches a good copy from the other database and repairs it, usually without an error reaching the user.',
 w:'It reduces the number of media recoveries. It needs a healthy, synchronised standby.',
 c:`SELECT * FROM v$database_block_corruption;`,see:[7,1,'Automatic block repair']},
{t:'Lag monitoring',s:'Transport lag and apply lag.',
 a:'**Transport lag** is how far behind the redo is that has not reached the standby. **Apply lag** is how far behind the redo is that has arrived but not been applied. `V$DATAGUARD_STATS` reports both, as does the broker.',
 w:'Alert on them. Transport lag points at the network or the primary. Apply lag points at the standby I/O, CPU or a stopped apply.',
 c:`SELECT name, value, time_computed FROM v$dataguard_stats WHERE name LIKE '%lag%';`,see:[10,0,'Monitoring lag: transport vs apply and key views']},
{t:'Standby-first patching',s:'Patch the standby before the primary.',
 a:'With **Standby-First Patch Apply** you install a release update on the standby home first, test it, then switch over and patch the former primary. Database-level SQL changes (`datapatch`) are applied on the primary and flow to the standby as redo.',
 w:'It cuts the outage to one switchover. For major upgrades you use `DBMS_ROLLING` or a transient logical standby.',
 c:`SELECT patch_id, action, status, action_time FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 5 ROWS ONLY;`,see:[9,0,'Standby-first patching strategy']},
{t:'TDE and wallets',s:'The standby needs the keys.',
 a:'When Transparent Data Encryption is used, every database in the configuration needs the **same master key**, in a copied wallet or in a shared key store. If the standby wallet is missing or closed, redo is received but apply fails.',
 w:'Copy the wallet when you build the standby and again after every key rotation.',
 c:`SELECT wrl_type, wrl_parameter, status FROM v$encryption_wallet;`,see:[8,4,'TDE wallets in Data Guard']},
{t:'Backups with Data Guard',s:'Offload them to the standby.',
 a:'A physical standby can be backed up with RMAN, and those backups can restore the primary or the standby because the files are interchangeable. Backing up on the standby takes the load off the primary. The Recovery Catalog keeps track of both.',
 w:'A standby does not replace backups: it copies logical mistakes. Keep both.',
 c:`RMAN> CONNECT TARGET sys@stby
RMAN> BACKUP DATABASE PLUS ARCHIVELOG;`,see:[11,0,'Backup strategy with Data Guard']},
{t:'DR drills',s:'A plan is not a test.',
 a:'Regular **switchover drills**, with a runbook and timing, prove that applications reconnect and that the standby can carry the load. A failover test (on a snapshot standby or a copy) proves the failure path.',
 w:'Record the real times. They tell you whether RTO is a number or a wish.',
 c:`DGMGRL> VALIDATE DATABASE stby;
DGMGRL> SWITCHOVER TO stby;`,see:[11,2,'Regular DR testing and switchover drills']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Five small maps of how the parts fit together: the primary and standby, protection modes, the broker, what a standby can be used for, and the settings it needs.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why a DBA cares, one query or command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. How a primary and a standby fit together'},
{map:{title:'Data Guard architecture map',h:328,trace:'Trace a commit to the standby',
 hint:'Tap any box, or press Trace a commit to the standby to follow one transaction from the primary to the standby datafiles.',
 lines:[[215,52,241,52],[437,52,463,52],[562,80,562,134],[465,164,439,164],[243,164,217,164],[118,192,118,246],[243,276,217,276],[465,276,439,276]],
 nodes:[
 {id:'app',x:21,y:24,w:194,h:56,c:'ext',t:'Application',s:'primary session',d:'A session on the primary that changes data and commits.',why:'Only the primary accepts changes. The standby is read-only or not open.',chk:`SELECT database_role, open_mode FROM v$database;`,see:[0,4,'Data Guard architecture at a glance']},
 {id:'lgwr',x:243,y:24,w:194,h:56,c:'proc',t:'LGWR',s:'writes redo',d:'Writes the redo buffer to the online redo logs, and hands it to the network server for transport.',why:'In SYNC mode the commit waits for the standby acknowledgement as well as the local write.',chk:`SELECT process, status FROM v$managed_standby WHERE process IN ('LGWR','ARCH');`,see:[1,0,'Redo generation, transport and apply']},
 {id:'nss',x:465,y:24,w:194,h:56,c:'proc',t:'NSSn / NSAn',s:'ship redo',d:'Network server processes (LNS in earlier releases) that send redo over the network. NSS sends synchronously, NSA asynchronously.',why:'They give the near real-time shipping instead of waiting for a log switch.',chk:`SELECT dest_id, status, error FROM v$archive_dest WHERE target = 'STANDBY';`,see:[1,1,'Processes: LNS, ARCn, RFS, MRP and their roles']},
 {id:'rfs',x:465,y:136,w:194,h:56,c:'proc',t:'RFS',s:'receives redo',d:'The Remote File Server process on the standby receives redo and writes it to standby redo logs.',why:'One RFS per redo stream. Receipt is independent of apply.',chk:`SELECT process, status, thread#, sequence# FROM v$managed_standby WHERE process = 'RFS';`,see:[1,1,'Processes: LNS, ARCn, RFS, MRP and their roles']},
 {id:'srl',x:243,y:136,w:194,h:56,c:'disk',t:'Standby redo logs',s:'landing area',d:'Log files where received redo is stored until apply and archiving.',why:'They must exist and be the right size for real-time apply and SYNC transport.',chk:`SELECT group#, thread#, bytes/1024/1024 AS mb, status FROM v$standby_log;`,see:[1,2,'Standby redo logs and real-time apply']},
 {id:'mrp',x:21,y:136,w:194,h:56,c:'proc',t:'MRP0',s:'applies redo',d:'The managed recovery process reads redo from the standby redo logs and applies it to the datafiles. Parallel slaves help it.',why:'If it stops, redo piles up unapplied. It is the heart of the standby.',chk:`SELECT process, status, sequence# FROM v$managed_standby WHERE process LIKE 'MRP%';`,see:[1,0,'Redo generation, transport and apply']},
 {id:'sdf',x:21,y:248,w:194,h:56,c:'disk',t:'Standby datafiles',s:'copy of the primary',d:'Datafiles kept in step with the primary by redo apply. They are not independent copies.',why:'A physical standby is block-identical to the primary at the applied SCN.',chk:`SELECT current_scn FROM v$database;`,see:[0,3,'Standby types']},
 {id:'dmon',x:243,y:248,w:194,h:56,c:'proc',t:'Broker (DMON)',s:'coordination',d:'Data Guard monitor process on every database. It keeps the configuration and carries out role changes.',why:'It starts and stops redo transport and apply, and sets parameters for you.',chk:`SELECT value FROM v$parameter WHERE name = 'dg_broker_start';`,see:[4,0,'Broker architecture']},
 {id:'obs',x:465,y:248,w:194,h:56,c:'ext',t:'Observer',s:'Fast-Start Failover',d:'A client process on a third host that watches both databases and triggers an automatic failover.',why:'Place it away from both sites so it can see both failures.',chk:`DGMGRL> SHOW OBSERVER;`,see:[6,2,'Observer setup, placement and high availability']}],
 steps:[
 {ids:['app','lgwr'],t:'1. A session changes data and commits. LGWR writes the redo to the online redo log and at the same time passes it to the network server.',w:'Redo is the only thing the standby needs: it does not read the primary data blocks.',s:'`COMMIT_WRITE`, redo log size, redo disk speed.',x:'A slow redo disk slows both the commit and the shipping.',c:`SELECT name, value FROM v$sysstat WHERE name IN ('redo size','redo writes');`},
 {ids:['lgwr','nss'],t:'2. The network server (NSSn for SYNC, NSAn for ASYNC) sends the redo over the network to the standby.',w:'It happens as the redo is written, not at a log switch.',s:'`LOG_ARCHIVE_DEST_2` attributes `SYNC`, `ASYNC`, `AFFIRM`, `NET_TIMEOUT`.',x:'Network latency adds directly to commit time in SYNC mode.',c:`SELECT dest_id, transmit_mode, affirm, net_timeout FROM v$archive_dest WHERE dest_id = 2;`},
 {ids:['rfs','srl'],t:'3. RFS on the standby receives the redo and writes it into a standby redo log. In SYNC AFFIRM mode the acknowledgement is sent after this write.',w:'Once the redo is on the standby disk, a failure of the primary no longer loses that commit.',s:'Standby redo log size and count, `AFFIRM` or `NOAFFIRM`.',x:'No SRLs means the redo goes only to archived logs and is delayed.',c:`SELECT group#, sequence#, status, archived FROM v$standby_log;`},
 {ids:['srl','mrp','sdf'],t:'4. MRP0 applies the redo from the standby redo log to the datafiles. This is real-time apply: it does not wait for the log to be archived.',w:'Apply decides how fresh the standby is.',s:'`RECOVER MANAGED STANDBY DATABASE`, apply parallelism, standby I/O.',x:'Slow storage on the standby or a stopped MRP shows as apply lag.',c:`SELECT name, value FROM v$dataguard_stats WHERE name = 'apply lag';`},
 {ids:['srl','sdf'],t:'5. When a standby redo log fills, it is archived on the standby so it can be reused and kept for recovery.',w:'It keeps the standby ready to become a primary and ship to others.',s:'`LOG_ARCHIVE_DEST_1`, deletion policy.',x:'A full FRA on the standby stops redo apply.',c:`SELECT sequence#, applied FROM v$archived_log ORDER BY sequence# DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['dmon','obs'],t:'6. The broker monitors both ends and reports the state. With Fast-Start Failover, the observer also watches the primary and can act on its own.',w:'Operations rely on one view of health instead of several queries.',s:'Broker properties, `FastStartFailoverThreshold`.',x:'A broker configuration that disagrees with the parameters is a frequent source of errors.',c:`DGMGRL> SHOW CONFIGURATION;`}]}},

{h:'2. Protection modes and transport'},
{map:{title:'Protection mode map',h:328,trace:'What happens when the standby is lost',
 hint:'Tap any box, or press What happens when the standby is lost to compare how each mode behaves.',
 lines:[[118,80,118,134],[340,80,340,134],[562,80,562,134],[118,192,118,246],[340,192,340,246],[562,192,562,246]],
 nodes:[
 {id:'perf',x:21,y:24,w:194,h:56,c:'mem',t:'Max Performance',s:'default',d:'Redo is shipped asynchronously. The primary never waits for the standby.',why:'Fastest commits. A failover may lose the most recent transactions.',chk:`SELECT protection_mode FROM v$database;`,see:[1,4,'Protection modes']},
 {id:'avail',x:243,y:24,w:194,h:56,c:'proc',t:'Max Availability',s:'SYNC, with fallback',d:'The primary waits for the standby, but continues when the standby is unreachable, then resynchronises.',why:'Zero data loss while the standby is healthy, with no uptime risk.',chk:`ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE AVAILABILITY;`,see:[1,4,'Protection modes']},
 {id:'prot',x:465,y:24,w:194,h:56,c:'warn',t:'Max Protection',s:'SYNC, no fallback',d:'The primary shuts down rather than commit without a synchronised standby.',why:'Zero data loss, even if it means an outage. Use at least two standbys.',chk:`ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE PROTECTION;`,see:[1,4,'Protection modes']},
 {id:'async',x:21,y:136,w:194,h:56,c:'ext',t:'ASYNC',s:'no commit wait',d:'Redo shipping runs behind the commit. Network latency does not affect the commit time.',why:'Suited to long distance and to workloads where small data loss is acceptable.',chk:`SELECT dest_id, transmit_mode FROM v$archive_dest WHERE target = 'STANDBY';`,see:[1,3,'SYNC vs ASYNC transport and Fast Sync']},
 {id:'sync',x:243,y:136,w:194,h:56,c:'ext',t:'SYNC AFFIRM',s:'wait for disk write',d:'The commit waits until the standby has written the redo to its standby redo log.',why:'It gives zero data loss, and adds network round trip plus disk write time to each commit.',chk:`SELECT dest_id, affirm FROM v$archive_dest WHERE dest_id = 2;`,see:[1,3,'SYNC vs ASYNC transport and Fast Sync']},
 {id:'sync2',x:465,y:136,w:194,h:56,c:'ext',t:'Fast Sync',s:'SYNC NOAFFIRM',d:'The commit waits for the redo to reach standby memory, not for the disk write.',why:'Lower commit time with a very small window of risk.',chk:`SELECT dest_id, affirm FROM v$archive_dest WHERE dest_id = 2;`,see:[1,3,'SYNC vs ASYNC transport and Fast Sync']},
 {id:'c1',x:21,y:248,w:194,h:56,c:'proc',t:'Lost standby',s:'primary continues',d:'With no connection to the standby, the primary keeps working and a gap builds up.',why:'Redo is archived locally. When the standby returns, the gap is closed.',chk:`SELECT thread#, low_sequence#, high_sequence# FROM v$archive_gap;`,see:[1,5,'Gap detection and resolution']},
 {id:'c2',x:243,y:248,w:194,h:56,c:'warn',t:'Lost standby',s:'primary waits, then continues',d:'The primary waits up to NET_TIMEOUT, then drops to a degraded state and continues, resynchronising later.',why:'A short pause while it decides. Protection level shows as RESYNCHRONIZATION.',chk:`SELECT protection_mode, protection_level FROM v$database;`,see:[1,4,'Protection modes']},
 {id:'c3',x:465,y:248,w:194,h:56,c:'warn',t:'Lost standby',s:'primary stops',d:'The primary shuts down, because it cannot guarantee zero loss.',why:'The outage is the price of the guarantee.',chk:`SELECT value FROM v$parameter WHERE name = 'log_archive_dest_2';`,see:[1,4,'Protection modes']}],
 steps:[
 {ids:['perf','async','c1'],t:'1. Maximum Performance with ASYNC. A commit is not delayed. If the standby disappears, the primary carries on and builds a gap.',w:'It is the lowest risk to availability and the highest to data.',s:'`ASYNC`, `NET_TIMEOUT`, `MAX_FAILURE`.',x:'A failover loses whatever was not yet shipped, and the apparent lag is the loss.',c:`SELECT name, value FROM v$dataguard_stats WHERE name = 'transport lag';`},
 {ids:['avail','sync','c2'],t:'2. Maximum Availability with SYNC. Commits wait for the standby. If the standby fails, the primary waits NET_TIMEOUT seconds, then carries on unprotected.',w:'It keeps zero loss while healthy and keeps running while not.',s:'`SYNC AFFIRM`, `NET_TIMEOUT`, `LOG_ARCHIVE_DEST_n`.',x:'A small NET_TIMEOUT may give false drops; a large one stalls commits.',c:`SELECT protection_mode, protection_level FROM v$database;`},
 {ids:['avail','sync2'],t:'3. Fast Sync (SYNC NOAFFIRM) in Maximum Availability waits only for memory receipt, which reduces commit time over long distances.',w:'It is a compromise between ASYNC and full SYNC.',s:'`NOAFFIRM`, Far Sync instance.',x:'A simultaneous failure of the primary and the standby host can lose the last transactions.',c:`SELECT dest_id, affirm FROM v$archive_dest WHERE target = 'STANDBY';`},
 {ids:['prot','c3'],t:'4. Maximum Protection with SYNC. If no standby can acknowledge, the primary shuts down.',w:'It makes zero loss a hard rule.',s:'`MAXIMIZE PROTECTION`, redundancy of standbys.',x:'A single network fault takes the production database down.',c:`SELECT protection_mode FROM v$database;`}]}},

{h:'3. The broker configuration'},
{map:{title:'Broker map',h:328,trace:'Follow a DGMGRL command',
 hint:'Tap any box, or press Follow a DGMGRL command to see how a change travels through the broker.',
 lines:[[326,52,352,52],[454,80,454,134],'M454 80 L454 107 L226 107 L226 134','M226 192 L226 219 L118 219 L118 246',[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'cli',x:126,y:24,w:200,h:56,c:'ext',t:'DGMGRL',s:'command line',d:'The broker command line, or Cloud Control. It connects to any member of the configuration.',why:'Connect to the primary with a service, not a local OS login, so commands work after a role change.',chk:`$ dgmgrl sys@prim`,see:[4,3,'DGMGRL commands for daily operations']},
 {id:'dmp',x:354,y:24,w:200,h:56,c:'proc',t:'DMON primary',s:'on the primary',d:'The Data Guard monitor process on the primary. It receives commands and coordinates the members.',why:'Needs DG_BROKER_START = TRUE on each database.',chk:`SHOW PARAMETER dg_broker_start`,see:[4,0,'Broker architecture']},
 {id:'cfg',x:354,y:136,w:200,h:56,c:'disk',t:'Config files',s:'two copies each',d:'Each database keeps broker configuration files (DG_BROKER_CONFIG_FILE1 and 2). They hold the shared view of the configuration.',why:'They must be on storage that survives the instance, and in ASM for a RAC database.',chk:`SELECT name, value FROM v$parameter WHERE name LIKE 'dg_broker_config_file%';`,see:[4,0,'Broker architecture']},
 {id:'dms',x:126,y:136,w:200,h:56,c:'proc',t:'DMON standby',s:'on the standby',d:'The monitor on the standby. It applies the same configuration and starts and stops redo apply.',why:'Both DMONs must agree, and mismatched files produce ORA-16xxx errors.',chk:`DGMGRL> SHOW DATABASE stby;`,see:[4,0,'Broker architecture']},
 {id:'prop',x:21,y:248,w:194,h:56,c:'mem',t:'Properties',s:'the settings',d:'Broker properties such as LogXptMode, DelayMins, RedoRoutes and StaticConnectIdentifier. They drive the parameters.',why:'Change them through DGMGRL, not ALTER SYSTEM, or the broker overwrites your change.',chk:`DGMGRL> SHOW DATABASE VERBOSE stby;`,see:[4,2,'Managing properties']},
 {id:'par',x:243,y:248,w:194,h:56,c:'disk',t:'Parameters',s:'set by the broker',d:'LOG_ARCHIVE_DEST_n, FAL_SERVER and other parameters are written by the broker from the properties.',why:'Manual changes outside the broker produce warnings and mismatch.',chk:`SELECT name, value FROM v$parameter WHERE name IN ('log_archive_dest_2','fal_server');`,see:[4,2,'Managing properties']},
 {id:'obs',x:465,y:248,w:194,h:56,c:'ext',t:'Observer',s:'optional',d:'The process that enables Fast-Start Failover.',why:'It is not part of the broker configuration files; it connects as a client.',chk:`DGMGRL> SHOW OBSERVER;`,see:[6,2,'Observer setup']}],
 steps:[
 {ids:['cli','dmp'],t:'1. You connect DGMGRL to the primary and enter a command, for example EDIT DATABASE stby SET PROPERTY LogXptMode = SYNC.',w:'The broker is the single place to change the configuration.',s:'`dgmgrl` connect string, SYSDG privilege.',x:'Connecting with OS authentication fails after a role change or on another host.',c:`DGMGRL> EDIT DATABASE stby SET PROPERTY LogXptMode = 'SYNC';`},
 {ids:['dmp','cfg'],t:'2. DMON on the primary validates the change and writes it to its configuration file.',w:'The file is the record of the intended state.',s:'Broker configuration files.',x:'A lost or damaged file means re-creating the configuration.',c:`SHOW PARAMETER dg_broker_config`},
 {ids:['dmp','dms'],t:'3. DMON on the primary tells DMON on each standby, which updates its own copy of the configuration.',w:'All members then hold the same view.',s:'Network connectivity between DMON processes.',x:'A member that is unreachable is shown as disabled or with ORA-16xxx errors.',c:`DGMGRL> SHOW CONFIGURATION;`},
 {ids:['prop','par'],t:'4. The property is turned into parameter changes on each database, such as LOG_ARCHIVE_DEST_2 attributes.',w:'You do not edit the parameters yourself.',s:'Property definitions.',x:'Edits made behind the broker are reported as inconsistencies.',c:`SELECT value FROM v$parameter WHERE name = 'log_archive_dest_2';`},
 {ids:['dms','obs'],t:'5. The broker watches health and reports warnings. The observer, if present, uses this state to decide whether a failover is allowed.',w:'It is how monitoring and automation get one source of truth.',s:'`FastStartFailoverTarget`, thresholds.',x:'No observer means no automatic failover, however healthy the broker is.',c:`DGMGRL> VALIDATE DATABASE stby;`}]}},

{h:'4. What a standby can be used for'},
{map:{title:'Standby usage map',h:328,trace:'Use a standby for more than DR',
 hint:'Tap any box, or press Use a standby for more than DR to see the modes a standby can be in and what each one costs.',
 lines:['M340 80 L340 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],[118,192,118,246],[340,192,340,246],[562,192,562,246]],
 nodes:[
 {id:'prim',x:240,y:24,w:200,h:56,c:'proc',t:'Primary',s:'read-write',d:'The database that applications change.',why:'The source of all redo.',chk:`SELECT database_role FROM v$database;`,see:[0,4,'Data Guard architecture at a glance']},
 {id:'phys',x:21,y:136,w:194,h:56,c:'mem',t:'Physical standby',s:'mounted, applying',d:'Redo apply on, not open. The default and simplest state.',why:'No extra licence. Cannot serve queries.',chk:`SELECT open_mode FROM v$database;`,see:[0,3,'Standby types']},
 {id:'adg',x:243,y:136,w:194,h:56,c:'mem',t:'Active Data Guard',s:'open read-only, applying',d:'Open read-only while redo apply continues. Queries see recent data.',why:'Needs the Active Data Guard licence.',chk:`SELECT open_mode FROM v$database;`,see:[7,0,'Active Data Guard: real-time query and offloading']},
 {id:'snap',x:465,y:136,w:194,h:56,c:'proc',t:'Snapshot standby',s:'open read-write',d:'Converted from physical, opened read-write for tests, and converted back with a flashback.',why:'Redo is received but not applied, so the recovery point ages during the test.',chk:`SELECT database_role FROM v$database;`,see:[7,3,'Snapshot standby for testing']},
 {id:'casc',x:21,y:248,w:194,h:56,c:'ext',t:'Cascaded standby',s:'standby of a standby',d:'A standby that receives redo from another standby, not directly from the primary.',why:'It cuts the load and network use on the primary for many standbys.',chk:`SELECT dest_id, target, destination FROM v$archive_dest WHERE target = 'STANDBY';`,see:[7,5,'Cascaded and multiple standbys']},
 {id:'bkp',x:243,y:248,w:194,h:56,c:'disk',t:'Backups here',s:'RMAN on the standby',d:'RMAN backs up the standby, and the backup restores either database.',why:'It takes backup load off the primary.',chk:`RMAN> BACKUP DATABASE PLUS ARCHIVELOG;`,see:[11,0,'Backup strategy with Data Guard']},
 {id:'ltr',x:465,y:248,w:194,h:56,c:'ext',t:'Logical standby',s:'SQL apply',d:'Applies SQL rather than blocks, so it can be open and hold extra objects.',why:'It has data type restrictions, and is used less today.',chk:`SELECT * FROM dba_logstdby_unsupported_table FETCH FIRST 5 ROWS ONLY;`,see:[7,4,'Logical standby concepts and when to use']}],
 steps:[
 {ids:['prim','phys'],t:'1. The default: a physical standby, mounted, applying redo. It exists for failover and nothing else.',w:'No extra licence, and the lowest risk.',s:'`RECOVER MANAGED STANDBY DATABASE`.',x:'It is an unused asset, and you cannot test it without a role change.',c:`SELECT name, open_mode, database_role FROM v$database;`},
 {ids:['phys','adg'],t:'2. With Active Data Guard it is opened read-only while apply continues. Reports and extracts run there.',w:'The standby earns its cost by offloading queries.',s:'`OPEN READ ONLY`, licence, `STANDBY_MAX_DATA_DELAY`.',x:'Queries see data a few seconds behind, so they must tolerate it.',c:`ALTER DATABASE OPEN READ ONLY;`},
 {ids:['phys','snap'],t:'3. A snapshot standby is read-write for tests of a release or a data fix. Redo keeps arriving but is not applied.',w:'You test on real data without making a copy.',s:'`CONVERT DATABASE TO SNAPSHOT STANDBY`, FRA for the restore point.',x:'If the primary fails while it is a snapshot standby, failover takes longer, since the redo has to be applied first.',c:`SELECT guarantee_flashback_database FROM v$restore_point;`},
 {ids:['adg','casc'],t:'4. A cascaded standby receives redo from another standby, so one primary can feed many standbys at far sites.',w:'It relieves the primary network and CPU.',s:'`LOG_ARCHIVE_DEST_n` on the first standby, `REDO ROUTES`.',x:'A failure of the middle standby cuts off the one below it.',c:`DGMGRL> EDIT DATABASE prim SET PROPERTY RedoRoutes = '(LOCAL : stby1 ASYNC)(stby1 : stby2 ASYNC)';`},
 {ids:['phys','bkp'],t:'5. Backups are taken on the standby. The primary does not need a backup window.',w:'It frees the primary and still protects both.',s:'RMAN catalog, `CONFIGURE ... FOR DB_UNIQUE_NAME`.',x:'A standby behind on apply gives a backup that is old.',c:`RMAN> BACKUP DATABASE PLUS ARCHIVELOG;`}]}},

{h:'5. Where the settings and files live'},
{map:{title:'Configuration map',h:328,trace:'What a standby needs configured',
 hint:'Tap any box, or press What a standby needs configured to see the pieces a working standby depends on.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L118 219 L118 246'],
 nodes:[
 {id:'name',x:21,y:24,w:194,h:56,c:'proc',t:'DB_UNIQUE_NAME',s:'identity',d:'The name that identifies this database in the configuration. DB_NAME is the same on every member.',why:'Everything else refers to it.',chk:`SHOW PARAMETER db_unique_name`,see:[2,3,'db_unique_name, log_archive_config and related parameters']},
 {id:'cfg',x:243,y:24,w:194,h:56,c:'proc',t:'LOG_ARCHIVE_CONFIG',s:'DG_CONFIG list',d:'The list of DB_UNIQUE_NAMEs allowed to send and receive redo.',why:'A database not listed is rejected.',chk:`SHOW PARAMETER log_archive_config`,see:[2,3,'db_unique_name, log_archive_config and related parameters']},
 {id:'dest',x:465,y:24,w:194,h:56,c:'proc',t:'LOG_ARCHIVE_DEST_2',s:'SERVICE=standby',d:'Where redo is sent and how: SERVICE, SYNC or ASYNC, VALID_FOR, DB_UNIQUE_NAME.',why:'The most important setting on the primary.',chk:`SELECT value FROM v$parameter WHERE name = 'log_archive_dest_2';`,see:[2,3,'db_unique_name, log_archive_config and related parameters']},
 {id:'fal',x:21,y:136,w:194,h:56,c:'proc',t:'FAL_SERVER',s:'where to get gaps',d:'The service the standby asks for missing redo.',why:'Use a service name that resolves from the standby host.',chk:`SHOW PARAMETER fal_server`,see:[1,5,'Gap detection and resolution']},
 {id:'sfm',x:243,y:136,w:194,h:56,c:'proc',t:'STANDBY_FILE_MANAGEMENT',s:'AUTO',d:'Creates and drops datafiles on the standby as the primary does.',why:'MANUAL stops apply when a datafile is added.',chk:`SHOW PARAMETER standby_file_management`,see:[2,2,'Standby redo logs and parameter settings']},
 {id:'cnv',x:465,y:136,w:194,h:56,c:'proc',t:'File name convert',s:'paths differ',d:'DB_FILE_NAME_CONVERT and LOG_FILE_NAME_CONVERT map primary paths to standby paths.',why:'Not needed with OMF or ASM and the same disk group names.',chk:`SHOW PARAMETER file_name_convert`,see:[8,3,'ASM and file name conversion']},
 {id:'pwd',x:21,y:248,w:194,h:56,c:'disk',t:'Password file',s:'copied, same on all',d:'Used to authenticate redo transport (SYSDG, SYSDBA). It must be the same on every database.',why:'A recreated file with a different password breaks transport.',chk:`SELECT username, sysdba FROM v$pwfile_users;`,see:[2,5,'Password file and wallet sharing']},
 {id:'lsn',x:243,y:248,w:194,h:56,c:'ext',t:'Static listener',s:'always reachable',d:'A static service entry so the database can be reached while it is down or in NOMOUNT.',why:'It is needed for duplicate, restart and the broker restart.',chk:`$ lsnrctl services`,see:[2,4,'Static listener registration and TNS setup']},
 {id:'srl',x:465,y:248,w:194,h:56,c:'disk',t:'Standby redo logs',s:'on both sides',d:'Redo log groups for incoming redo, sized as the online logs plus one group.',why:'Create them on the primary too, so a switchover works.',chk:`SELECT group#, bytes/1024/1024 AS mb FROM v$standby_log;`,see:[2,2,'Standby redo logs and parameter settings']}],
 steps:[
 {ids:['name','cfg'],t:'1. Every database gets a unique name, and the configuration lists all members.',w:'This stops unknown databases from sending or receiving redo.',s:'`DB_UNIQUE_NAME`, `LOG_ARCHIVE_CONFIG`.',x:'A typo here shows as ORA-16057 or redo being rejected.',c:`SHOW PARAMETER log_archive_config`},
 {ids:['dest'],t:'2. The primary gets a redo destination that names the standby service, the transport mode and the role in which it is valid.',w:'This is what starts shipping.',s:'`SERVICE`, `SYNC`, `VALID_FOR`, `DB_UNIQUE_NAME`.',x:'ORA-16191 means the password file or a TNS entry is wrong.',c:`SELECT dest_id, status, error FROM v$archive_dest WHERE dest_id = 2;`},
 {ids:['fal','sfm'],t:'3. The standby knows where to fetch gaps from and manages file additions automatically.',w:'Gaps close themselves and new datafiles do not stop apply.',s:'`FAL_SERVER`, `STANDBY_FILE_MANAGEMENT=AUTO`.',x:'A standby with MANUAL stops on the first ADD DATAFILE on the primary.',c:`SELECT name, value FROM v$parameter WHERE name IN ('fal_server','standby_file_management');`},
 {ids:['pwd','lsn'],t:'4. Authentication and reachability are in place: the same password file and static listeners on every host.',w:'Without them redo cannot be sent or the instance cannot be started remotely.',s:'Password file, `listener.ora`, `tnsnames.ora`.',x:'Silent failures: transport shows an error that looks like a network issue.',c:`SELECT username, sysdba FROM v$pwfile_users;`},
 {ids:['srl','cnv'],t:'5. Standby redo logs exist on all members and the file name conversion is set where paths differ.',w:'Real-time apply and a clean switchover depend on both.',s:'`ALTER DATABASE ADD STANDBY LOGFILE`.',x:'Missing SRLs on the old primary make the new standby fall back to archived log transport.',c:`SELECT thread#, COUNT(*) FROM v$standby_log GROUP BY thread#;`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Seven small maps of how something happens, step by step: building a standby, a switchover, a failover and reinstate, Fast-Start Failover, closing a gap, diagnosing lag and standby-first patching.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Building a physical standby'},
{map:{title:'Build a standby map',h:216,trace:'Build a physical standby',
 hint:'Tap any box, or press Build a physical standby to follow the steps from a prepared primary to applying redo.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'pre',x:20,y:24,w:139,h:56,c:'proc',t:'Prepare primary',s:'logging and SRLs',d:'Turn on ARCHIVELOG, FORCE LOGGING and (recommended) Flashback, add standby redo logs and set the Data Guard parameters.',why:'Most standby problems start with a missing prerequisite.',chk:`SELECT log_mode, force_logging, flashback_on FROM v$database;`,see:[2,6,'Prepare a primary for a physical standby']},
 {id:'net',x:187,y:24,w:139,h:56,c:'ext',t:'Network',s:'listener and TNS',d:'Static listener entries and TNS aliases on both hosts, tested in both directions.',why:'The standby must be reachable while in NOMOUNT.',chk:`$ tnsping stby
$ tnsping prim`,see:[2,4,'Static listener registration and TNS setup']},
 {id:'pwd',x:354,y:24,w:139,h:56,c:'disk',t:'Password file',s:'copy to standby',d:'Copy the primary password file to the standby host.',why:'It must be identical, or redo transport fails authentication.',chk:`$ scp $ORACLE_HOME/dbs/orapwORCL standbyhost:$ORACLE_HOME/dbs/`,see:[2,5,'Password file and wallet sharing']},
 {id:'aux',x:521,y:24,w:139,h:56,c:'proc',t:'Start auxiliary',s:'NOMOUNT',d:'Start the standby instance in NOMOUNT with a minimal parameter file.',why:'RMAN needs a running instance to copy into.',chk:`SQL> STARTUP NOMOUNT PFILE='initstby.ora'`,see:[3,0,'RMAN active duplicate for standby']},
 {id:'dup',x:20,y:136,w:139,h:56,c:'proc',t:'DUPLICATE',s:'FOR STANDBY',d:'RMAN copies the database from the running primary to the standby and creates the standby control file.',why:'It does not interrupt the primary.',chk:`RMAN> DUPLICATE TARGET DATABASE FOR STANDBY FROM ACTIVE DATABASE DORECOVER NOFILENAMECHECK;`,see:[3,0,'RMAN active duplicate for standby']},
 {id:'mnt',x:187,y:136,w:139,h:56,c:'proc',t:'Mount standby',s:'standby control file',d:'The standby is mounted with its standby control file and has the SRLs.',why:'It is now ready to receive redo.',chk:`SELECT database_role, open_mode FROM v$database;`,see:[3,2,'Starting redo apply and verifying sync']},
 {id:'apply',x:354,y:136,w:139,h:56,c:'proc',t:'Start apply',s:'MRP0',d:'Start managed recovery, or enable the broker configuration.',why:'MRP0 begins applying received redo.',chk:`ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT FROM SESSION;`,see:[3,2,'Starting redo apply and verifying sync']},
 {id:'ver',x:521,y:136,w:139,h:56,c:'mem',t:'Verify',s:'lag and sequence',d:'Switch logs on the primary and confirm they arrive and are applied.',why:'The standby is not finished until you have seen redo applied.',chk:`SELECT sequence#, applied FROM v$archived_log ORDER BY sequence# DESC FETCH FIRST 5 ROWS ONLY;`,see:[3,5,'Verifying with views and queries']}],
 steps:[
 {ids:['pre'],t:'1. Prepare the primary: ARCHIVELOG, FORCE LOGGING, Flashback Database, standby redo logs and the Data Guard parameters.',w:'These are the foundation the standby depends on.',s:'`FORCE LOGGING`, `LOG_ARCHIVE_CONFIG`, `STANDBY_FILE_MANAGEMENT`.',x:'Skipping FORCE LOGGING produces unrecoverable blocks after a NOLOGGING load.',c:`ALTER DATABASE FORCE LOGGING;
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 SIZE 1G;`},
 {ids:['net','pwd'],t:'2. Configure the network and copy the password file. Test with tnsping and a SYSDBA connection both ways.',w:'Redo shipping uses the same authentication.',s:'`listener.ora`, `tnsnames.ora`, password file.',x:'ORA-01017 on the first connection means the password file differs.',c:`$ sqlplus sys@stby as sysdba`},
 {ids:['aux'],t:'3. Start the auxiliary instance in NOMOUNT from a minimal parameter file.',w:'It is the target of the copy.',s:'`DB_NAME`, `DB_UNIQUE_NAME`, `STANDBY_FILE_MANAGEMENT`.',x:'ORA-12528 appears when the static listener entry is missing.',c:`SQL> STARTUP NOMOUNT PFILE='initstby.ora'`},
 {ids:['dup'],t:'4. Run RMAN DUPLICATE FOR STANDBY FROM ACTIVE DATABASE. It copies files, builds the standby control file and recovers to a recent point.',w:'It is the only long step, so plan network and channels.',s:'`DORECOVER`, `SPFILE`, `NOFILENAMECHECK`, parallelism.',x:'Network breaks or a full target filesystem stop it, and you must restart.',c:`RMAN> DUPLICATE TARGET DATABASE FOR STANDBY FROM ACTIVE DATABASE DORECOVER SPFILE SET db_unique_name='stby' NOFILENAMECHECK;`},
 {ids:['mnt','apply'],t:'5. Mount the standby and start managed recovery, or create the broker configuration, which starts apply for you.',w:'This is when the standby begins to follow the primary.',s:'`RECOVER MANAGED STANDBY DATABASE`, broker.',x:'If standby redo logs are missing it falls back to archived log shipping.',c:`SELECT process, status, sequence# FROM v$managed_standby WHERE process LIKE 'MRP%';`},
 {ids:['ver'],t:'6. Force log switches on the primary and check that the sequences arrive and are applied. Check lag and the alert log.',w:'It proves the whole path, not just the setup.',s:'`ALTER SYSTEM ARCHIVE LOG CURRENT`.',x:'Sequences that arrive but are not applied point at apply, not transport.',c:`SELECT name, value FROM v$dataguard_stats;`}]}},

{h:'2. A planned switchover'},
{map:{title:'Switchover map',h:216,trace:'Perform a switchover',
 hint:'Tap any box, or press Perform a switchover to follow a planned role change with the broker.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'val',x:21,y:24,w:194,h:56,c:'mem',t:'Validate',s:'VALIDATE DATABASE',d:'The broker checks that the standby is ready: apply running, lag small, SRLs present, flashback status.',why:'It turns surprises into a list before you start.',chk:`DGMGRL> VALIDATE DATABASE stby;`,see:[5,4,'Validating readiness before you switch']},
 {id:'chk',x:243,y:24,w:194,h:56,c:'mem',t:'Check the app',s:'sessions and jobs',d:'Agree the window, quiesce batch jobs and know which connections will be dropped.',why:'A switchover is clean for the database, but sessions still reconnect.',chk:`SELECT username, COUNT(*) FROM v$session WHERE type = 'USER' GROUP BY username;`,see:[5,5,'Application considerations and services']},
 {id:'go',x:465,y:24,w:194,h:56,c:'warn',t:'SWITCHOVER',s:'TO stby',d:'One DGMGRL command that performs the whole role change.',why:'The old primary becomes a standby, and nothing is lost.',chk:`DGMGRL> SWITCHOVER TO stby;`,see:[5,0,'Switchover: planned role change']},
 {id:'old',x:21,y:136,w:194,h:56,c:'proc',t:'Old primary',s:'becomes standby',d:'It is converted to a physical standby and restarted as one, then begins to receive redo from the new primary.',why:'It is now your protection against the loss of the new primary.',chk:`SELECT database_role, switchover_status FROM v$database;`,see:[5,0,'Switchover: planned role change']},
 {id:'new',x:243,y:136,w:194,h:56,c:'proc',t:'New primary',s:'open read-write',d:'The standby is opened read-write as the primary and starts to generate and ship redo.',why:'Applications can connect as soon as the role-based services start.',chk:`SELECT database_role, open_mode FROM v$database;`,see:[5,0,'Switchover: planned role change']},
 {id:'svc',x:465,y:136,w:194,h:56,c:'ext',t:'Services',s:'role-based',d:'Role-based services start on the new primary and clients reconnect through them.',why:'Without role-based services the application still points at the old host.',chk:`SELECT name FROM v$active_services;`,see:[5,5,'Application considerations and services']}],
 steps:[
 {ids:['val'],t:'1. VALIDATE DATABASE for the target standby. Fix every item that is not READY before continuing.',w:'A failed switchover is far worse than a postponed one.',s:'`VALIDATE DATABASE`, `VALIDATE STATIC CONNECT IDENTIFIER`.',x:'Apply lag, missing SRLs and a down listener are the usual findings.',c:`DGMGRL> VALIDATE DATABASE VERBOSE stby;`},
 {ids:['chk'],t:'2. Prepare the application: stop batch jobs, notify users, and confirm that connection strings use a role-based service.',w:'The database change is quick; the application side is what hurts.',s:'Application timeouts, `FAN`, `TAF`.',x:'Hard-coded host names turn a clean switchover into an outage.',c:`SELECT service_name, COUNT(*) FROM v$session GROUP BY service_name;`},
 {ids:['go'],t:'3. Run SWITCHOVER TO stby. The broker converts the primary to a standby and the standby to the primary.',w:'The whole sequence is automated and lossless.',s:'`SWITCHOVER TO`, broker properties.',x:'Open sessions can block it, and the broker reports them.',c:`DGMGRL> SWITCHOVER TO stby;`},
 {ids:['old','new'],t:'4. The old primary restarts as a standby and begins applying redo from the new primary, which is open read-write.',w:'The configuration stays protected throughout.',s:'Broker auto-restart.',x:'An old primary without SRLs falls back to archived log shipping.',c:`DGMGRL> SHOW CONFIGURATION;`},
 {ids:['svc'],t:'5. Role-based services start on the new primary, the application reconnects, and you check workload and lag.',w:'It confirms the whole stack works at the other site.',s:'`srvctl` role-based services, `FAN`.',x:'A service not defined for the new primary leaves the application with no database.',c:`SELECT name FROM v$active_services;`},
 {ids:['old'],t:'6. Leave the roles as they are, or switch back after the maintenance. Record the time and any surprises in the runbook.',w:'It makes the next drill faster.',s:'Runbook, drill schedule.',x:'Doing a switchover and not recording the time defeats the purpose.',c:`DGMGRL> SHOW DATABASE VERBOSE prim;`}]}},

{h:'3. Failover and reinstating the old primary'},
{map:{title:'Failover and reinstate map',h:216,trace:'Fail over and reinstate',
 hint:'Tap any box, or press Fail over and reinstate to follow an unplanned role change and the recovery of the old primary.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'lost',x:21,y:24,w:194,h:56,c:'warn',t:'Primary lost',s:'outage',d:'The primary is unreachable and cannot be brought back quickly: host, storage or site.',why:'Confirm it is really down before you act, and that it cannot come back by itself.',chk:`DGMGRL> SHOW CONFIGURATION;`,see:[5,1,'Failover: unplanned role change']},
 {id:'dec',x:243,y:24,w:194,h:56,c:'mem',t:'Decide',s:'how much loss',d:'Check the standby lag and decide whether to accept the data loss.',why:'Failover is irreversible for the transactions that did not arrive.',chk:`SELECT name, value FROM v$dataguard_stats WHERE name IN ('apply lag','transport lag');`,see:[5,1,'Failover: unplanned role change']},
 {id:'fo',x:465,y:24,w:194,h:56,c:'warn',t:'FAILOVER',s:'TO stby',d:'Finishes applying received redo and opens the standby as the new primary.',why:'Use IMMEDIATE only when time matters more than the last redo.',chk:`DGMGRL> FAILOVER TO stby;`,see:[5,1,'Failover: unplanned role change']},
 {id:'new',x:21,y:136,w:194,h:56,c:'proc',t:'New primary',s:'open',d:'The standby is now the primary. Services start and the applications reconnect.',why:'There is no standby until the old primary is repaired.',chk:`SELECT database_role, open_mode FROM v$database;`,see:[5,1,'Failover: unplanned role change']},
 {id:'back',x:243,y:136,w:194,h:56,c:'proc',t:'Old primary back',s:'mounted',d:'When the old primary host is back, start it in MOUNT.',why:'It must not open as a primary. Two primaries cause a split brain.',chk:`SQL> STARTUP MOUNT`,see:[5,2,'Reinstating a failed primary with Flashback Database']},
 {id:'rein',x:465,y:136,w:194,h:56,c:'proc',t:'REINSTATE',s:'DATABASE old',d:'Flashback Database rewinds the old primary to the failover SCN and it becomes a standby of the new primary.',why:'Without flashback you must rebuild it by duplicate or RMAN roll forward.',chk:`DGMGRL> REINSTATE DATABASE prim;`,see:[5,2,'Reinstating a failed primary with Flashback Database']}],
 steps:[
 {ids:['lost','dec'],t:'1. The primary is down. You confirm with monitoring, and look at the standby transport lag, which is the amount of data you may lose.',w:'The decision balances downtime against loss.',s:'Protection mode, `V$DATAGUARD_STATS`.',x:'Failing over a primary that is only temporarily unreachable creates a split brain.',c:`SELECT name, value FROM v$dataguard_stats;`},
 {ids:['fo'],t:'2. Issue FAILOVER TO the standby. It applies the redo it has, and becomes the primary.',w:'It restores service without the old primary.',s:'`FAILOVER TO`, `IMMEDIATE`.',x:'ORA-16xxx errors if the standby is not ready, such as redo apply not running.',c:`DGMGRL> FAILOVER TO stby;`},
 {ids:['new'],t:'3. Services start on the new primary and applications reconnect. Check that backups, jobs and monitoring point to it.',w:'The database is up, the surrounding systems may not be.',s:'Role-based services, runbook.',x:'Applications with a fixed address stay down.',c:`SELECT name FROM v$active_services;`},
 {ids:['back'],t:'4. When the old primary returns, start it in MOUNT only. Do not open it.',w:'An open old primary is a second primary.',s:'Startup scripts that open by default.',x:'Auto-start scripts open the database and cause a split brain.',c:`SELECT database_role FROM v$database;`},
 {ids:['rein'],t:'5. REINSTATE DATABASE flashes the old primary back to the failover point and turns it into a standby that applies the new primary redo.',w:'It is far faster than a rebuild.',s:'`FLASHBACK ON`, flashback logs, the broker.',x:'No flashback logs, or logs older than the failover, mean you must rebuild the standby.',c:`DGMGRL> REINSTATE DATABASE prim;`},
 {ids:['rein','new'],t:'6. Verify the configuration is protected again, run a backup of the new primary and, if wanted, switch back during a window.',w:'You are exposed until a standby is applying again.',s:'`SHOW CONFIGURATION`, backup schedule.',x:'Stopping at the failover leaves a single database with no protection.',c:`DGMGRL> SHOW CONFIGURATION;`}]}},

{h:'4. Fast-Start Failover'},
{map:{title:'FSFO map',h:328,trace:'Follow an automatic failover',
 hint:'Tap any box, or press Follow an automatic failover to see how the observer decides.',
 lines:[[215,52,241,52],[215,52,463,52],'M340 80 L340 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246','M562 192 L562 219 L454 219 L454 246'],
 nodes:[
 {id:'obs',x:21,y:24,w:194,h:56,c:'ext',t:'Observer',s:'third host',d:'The observer pings the primary and the standby at an interval and keeps track of their state.',why:'It runs outside both sites so it can see either one fail.',chk:`DGMGRL> SHOW OBSERVER;`,see:[6,2,'Observer setup, placement and high availability']},
 {id:'prim',x:243,y:24,w:194,h:56,c:'warn',t:'Primary',s:'becomes unreachable',d:'The primary stops answering the observer and the standby.',why:'Failover needs both to agree it is lost, so a single network fault does not trigger it.',chk:`SELECT database_role FROM v$database;`,see:[6,0,'Fast-Start Failover concepts and requirements']},
 {id:'stby',x:465,y:24,w:194,h:56,c:'proc',t:'Standby',s:'target',d:'The standby that is the FSFO target and is allowed to be promoted.',why:'It must be synchronised or inside the lag limit.',chk:`DGMGRL> SHOW FAST_START FAILOVER;`,see:[6,1,'Configuring targets, thresholds and lag limits']},
 {id:'thr',x:21,y:136,w:194,h:56,c:'mem',t:'Threshold',s:'FastStartFailoverThreshold',d:'The number of seconds the primary must be unreachable before the failover starts.',why:'Short means fast recovery and false alarms. Long means a longer outage.',chk:`DGMGRL> SHOW CONFIGURATION VERBOSE;`,see:[6,1,'Configuring targets, thresholds and lag limits']},
 {id:'cond',x:243,y:136,w:194,h:56,c:'mem',t:'Conditions',s:'lag or zero loss',d:'The failover happens only if loss would be within the limit: zero in Max Availability, or within the lag limit in Max Performance.',why:'It stops an automatic failover that would lose too much data.',chk:`DGMGRL> SHOW CONFIGURATION;`,see:[6,3,'FSFO with Maximum Availability vs Performance']},
 {id:'fo',x:465,y:136,w:194,h:56,c:'warn',t:'Failover',s:'automatic',d:'The observer tells the standby to become primary.',why:'No human is involved.',chk:`DGMGRL> SHOW FAST_START FAILOVER;`,see:[6,0,'Fast-Start Failover concepts and requirements']},
 {id:'rein',x:126,y:248,w:200,h:56,c:'proc',t:'Auto-reinstate',s:'when it returns',d:'When the old primary comes back in MOUNT, the broker flashes it back and makes it a standby.',why:'Needs Flashback Database and FastStartFailoverAutoReinstate.',chk:`DGMGRL> SHOW DATABASE VERBOSE prim;`,see:[6,4,'Reinstating automatically after failover']},
 {id:'app',x:354,y:248,w:200,h:56,c:'ext',t:'Applications',s:'reconnect',d:'Role-based services start on the new primary and clients reconnect, with Application Continuity or retry logic.',why:'Failover is only complete when the application is working.',chk:`SELECT name FROM v$active_services;`,see:[5,5,'Application considerations and services']}],
 steps:[
 {ids:['obs','prim','stby'],t:'1. The observer, the primary and the standby are in contact. The observer pings both and records their state.',w:'Failover can be decided only if the observer can see both.',s:'`FastStartFailoverPingInterval`, observer placement.',x:'An observer on the same host as the primary fails with it.',c:`DGMGRL> SHOW OBSERVER;`},
 {ids:['prim','thr'],t:'2. The primary becomes unreachable. The observer and standby both lose contact and the threshold timer starts.',w:'Requiring agreement avoids acting on a one-sided network fault.',s:'`FastStartFailoverThreshold`.',x:'A threshold below the length of a normal network blip causes false failovers.',c:`DGMGRL> SHOW CONFIGURATION VERBOSE;`},
 {ids:['cond'],t:'3. The conditions are checked: standby synchronised in Max Availability, or lag within the limit in Max Performance.',w:'This is how data loss stays inside what the business accepted.',s:'`FastStartFailoverLagLimit`, protection mode.',x:'If lag is above the limit, failover does not happen and the primary stays down.',c:`SELECT name, value FROM v$dataguard_stats WHERE name = 'apply lag';`},
 {ids:['fo'],t:'4. The observer initiates the failover. The standby applies the redo it has and opens as the primary.',w:'It takes tens of seconds.',s:'Broker, observer.',x:'A missing SRL or stopped apply on the target stops the failover.',c:`DGMGRL> SHOW FAST_START FAILOVER;`},
 {ids:['app'],t:'5. Services start on the new primary and applications reconnect, retrying or replaying through Application Continuity.',w:'The database is back but the application must be too.',s:'Role-based services, connect timeouts.',x:'Connection pools that do not detect the failure keep dead connections.',c:`SELECT name FROM v$active_services;`},
 {ids:['rein'],t:'6. When the old primary returns, the observer and broker reinstate it as a standby of the new primary and protection is restored.',w:'The configuration returns to protected without manual work.',s:'`FastStartFailoverAutoReinstate`, Flashback Database.',x:'If flashback logs have gone, the old primary must be rebuilt.',c:`DGMGRL> SHOW CONFIGURATION;`}]}},

{h:'5. How a gap is detected and closed'},
{map:{title:'Gap resolution map',h:216,trace:'Follow a gap',
 hint:'Tap any box, or press Follow a gap to see how a missing range of redo is found and fetched.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'brk',x:21,y:24,w:194,h:56,c:'warn',t:'Network break',s:'redo not sent',d:'The link between the sites drops or the standby is down for a while.',why:'The primary continues and archives locally, so redo is not lost.',chk:`SELECT dest_id, status, error FROM v$archive_dest WHERE dest_id = 2;`,see:[10,1,'Gap resolution and archive problems']},
 {id:'det',x:243,y:24,w:194,h:56,c:'proc',t:'Detect gap',s:'MRP or RFS',d:'When the next redo that arrives is not the one expected, the standby finds the missing sequence range.',why:'It happens automatically when the link returns.',chk:`SELECT thread#, low_sequence#, high_sequence# FROM v$archive_gap;`,see:[1,5,'Gap detection and resolution']},
 {id:'req',x:465,y:24,w:194,h:56,c:'proc',t:'Request via FAL',s:'FAL_SERVER',d:'The standby asks the FAL server, normally the primary, to send the missing archived logs.',why:'It needs a service name that works from the standby.',chk:`SHOW PARAMETER fal_server`,see:[1,5,'Gap detection and resolution']},
 {id:'arc',x:21,y:136,w:194,h:56,c:'disk',t:'Archived logs',s:'on the primary',d:'The primary must still hold the archived logs in the gap, on disk or restorable from backup.',why:'Deleted logs cannot be sent.',chk:`SELECT sequence#, deleted FROM v$archived_log WHERE sequence# BETWEEN 100 AND 110;`,see:[10,1,'Gap resolution and archive problems']},
 {id:'fetch',x:243,y:136,w:194,h:56,c:'proc',t:'Fetch',s:'ARCn ships',d:'ARCn on the primary sends the logs. RFS receives them.',why:'It runs in parallel with current redo shipping.',chk:`SELECT process, status, sequence# FROM v$managed_standby WHERE process IN ('ARCH','RFS');`,see:[1,1,'Processes: LNS, ARCn, RFS, MRP and their roles']},
 {id:'apply',x:465,y:136,w:194,h:56,c:'mem',t:'Apply and close',s:'MRP applies',d:'MRP applies the gap, and then continues with the current redo. Lag returns to normal.',why:'Confirm with the lag views.',chk:`SELECT name, value FROM v$dataguard_stats WHERE name LIKE '%lag%';`,see:[10,0,'Monitoring lag: transport vs apply and key views']}],
 steps:[
 {ids:['brk'],t:'1. The link fails for 20 minutes. The primary keeps working. Redo is archived locally and a gap starts to build.',w:'The primary is never held back by the standby in Maximum Performance or Availability.',s:'`MAX_FAILURE`, `REOPEN`, `NET_TIMEOUT`.',x:'A full FRA on the primary during this time deletes the logs the standby will need.',c:`SELECT dest_id, status, error FROM v$archive_dest WHERE dest_id = 2;`},
 {ids:['det'],t:'2. When the link returns, the standby finds that a range of sequences is missing and records it as a gap.',w:'It knows exactly what is missing.',s:'Standby redo logs, `V$ARCHIVE_GAP`.',x:'A gap that stays listed for hours means the fetch is failing.',c:`SELECT * FROM v$archive_gap;`},
 {ids:['req'],t:'3. The standby asks its FAL server for the missing logs. With the broker, the FAL server is set for you.',w:'No manual copying is needed in the normal case.',s:'`FAL_SERVER`.',x:'ORA-16191 or ORA-12154 in the alert log mean the FAL service cannot be reached.',c:`SHOW PARAMETER fal_server`},
 {ids:['arc','fetch'],t:'4. The primary ARCn sends the archived logs from the gap. If they are no longer on disk, RMAN can restore them first.',w:'They are the only source.',s:'Archivelog deletion policy `APPLIED ON ALL STANDBY`.',x:'If the logs are gone, the only fix is a roll forward of the standby from the primary.',c:`RMAN> RESTORE ARCHIVELOG FROM SEQUENCE 100 UNTIL SEQUENCE 110;`},
 {ids:['apply'],t:'5. MRP applies the received logs and catches up with the real-time stream. Lag returns to seconds.',w:'The standby is protected again.',s:'Parallel recovery, standby I/O.',x:'Apply may be slow after a big gap, so check the apply rate.',c:`SELECT name, value FROM v$dataguard_stats WHERE name = 'apply lag';`},
 {ids:['apply'],t:'6. If a gap cannot be closed, use RMAN to roll the standby forward from a service with incremental backups, rather than rebuild it.',w:'It is much faster than a full duplicate.',s:'`RECOVER STANDBY DATABASE FROM SERVICE`.',x:'Apply must be stopped on the standby before the roll forward and restarted after it.',c:`RMAN> RECOVER STANDBY DATABASE FROM SERVICE prim NOREDO USING COMPRESSED BACKUPSET;`}]}},

{h:'6. Diagnosing a standby that is behind'},
{map:{title:'Lag diagnosis map',h:328,trace:'Find where the lag is',
 hint:'Tap any box, or press Find where the lag is to follow the checks from a lag alert to a cause.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L340 107 L340 134',[437,164,463,164],[465,164,217,164],[118,192,118,246],[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'alert',x:21,y:24,w:194,h:56,c:'warn',t:'Lag alert',s:'someone notices',d:'A monitoring alert, a broker warning, or a report that shows old data.',why:'Start by measuring, not guessing.',chk:`SELECT name, value, time_computed FROM v$dataguard_stats WHERE name LIKE '%lag%';`,see:[10,0,'Monitoring lag: transport vs apply and key views']},
 {id:'stats',x:243,y:24,w:194,h:56,c:'mem',t:'Which lag?',s:'transport or apply',d:'V$DATAGUARD_STATS separates transport lag (not arrived) from apply lag (arrived, not applied).',why:'The two have different causes and different fixes.',chk:`SELECT name, value FROM v$dataguard_stats;`,see:[10,0,'Monitoring lag: transport vs apply and key views']},
 {id:'tr',x:465,y:24,w:194,h:56,c:'proc',t:'Transport lag',s:'redo not arriving',d:'Redo is not reaching the standby fast enough or at all.',why:'Look at the network, the primary redo rate and the destination state.',chk:`SELECT dest_id, status, error, gap_status FROM v$archive_dest_status WHERE dest_id = 2;`,see:[10,4,'Redo transport and network tuning']},
 {id:'ap',x:21,y:136,w:194,h:56,c:'proc',t:'Apply lag',s:'arrived, not applied',d:'Redo is on the standby but MRP is behind or stopped.',why:'Look at MRP state, standby I/O and recovery parallelism.',chk:`SELECT process, status, sequence#, block# FROM v$managed_standby WHERE process LIKE 'MRP%';`,see:[10,5,'Apply performance and parallel recovery']},
 {id:'net',x:243,y:136,w:194,h:56,c:'ext',t:'Network',s:'bandwidth, latency',d:'Check throughput against redo rate, and latency for SYNC.',why:'Compression or a larger send buffer can help.',chk:`SELECT name, value FROM v$sysstat WHERE name = 'redo size';`,see:[10,4,'Redo transport and network tuning']},
 {id:'lg',x:465,y:136,w:194,h:56,c:'disk',t:'Log and errors',s:'alert log',d:'The alert logs of both databases and the broker log show the actual error.',why:'Often the answer is a plain ORA error.',chk:`SELECT message_text FROM v$diag_alert_ext WHERE originating_timestamp > SYSDATE - 1/24 AND message_text LIKE '%ORA-%' ORDER BY originating_timestamp DESC FETCH FIRST 10 ROWS ONLY;`,see:[10,2,'Common errors']},
 {id:'st',x:21,y:248,w:194,h:56,c:'disk',t:'Standby I/O',s:'storage or CPU',d:'The standby may be slower than the primary: slower disks, fewer CPUs, no parallel apply.',why:'Apply is single-threaded for each instance but uses parallel slaves.',chk:`SELECT event, total_waits FROM v$system_event ORDER BY time_waited DESC FETCH FIRST 5 ROWS ONLY;`,see:[10,5,'Apply performance and parallel recovery']},
 {id:'io',x:243,y:248,w:194,h:56,c:'mem',t:'Compare',s:'primary vs standby',d:'Compare redo rate on the primary with the apply rate on the standby.',why:'If the apply rate is lower than the redo rate, lag grows.',chk:`SELECT item, units, sofar FROM v$recovery_progress WHERE item = 'Active Apply Rate';`,see:[10,5,'Apply performance and parallel recovery']},
 {id:'fix',x:465,y:248,w:194,h:56,c:'proc',t:'Fix',s:'the cause',d:'Network, apply parallelism, storage, or a stuck process.',why:'Re-measure after each change.',chk:`DGMGRL> VALIDATE DATABASE stby;`,see:[10,3,'Standby out of sync: diagnose and repair']}],
 steps:[
 {ids:['alert','stats'],t:'1. A lag alert arrives. First measure: query V$DATAGUARD_STATS or the broker for transport lag and apply lag.',w:'It tells you which half of the pipeline is slow.',s:'`V$DATAGUARD_STATS`, broker `ApplyLag`, `TransportLag`.',x:'Treating both as "lag" sends you to the wrong host.',c:`SELECT name, value FROM v$dataguard_stats WHERE name IN ('transport lag','apply lag');`},
 {ids:['tr','net'],t:'2. If transport lag is high, check the destination status and the network bandwidth against the redo rate.',w:'Redo that has not arrived cannot be applied.',s:'`LOG_ARCHIVE_DEST_n`, `NET_TIMEOUT`, compression.',x:'A saturated link during backups or batch loads shows as short bursts of lag.',c:`SELECT dest_id, status, error FROM v$archive_dest WHERE dest_id = 2;`},
 {ids:['lg'],t:'3. Read the alert log on both sides and the broker log. A concrete ORA error is usually the real cause.',w:'The logs already contain the answer.',s:'`V$DIAG_ALERT_EXT`, `drc<SID>.log`.',x:'ORA-16191 is authentication, ORA-12541 is the listener, ORA-16401 is a duplicate archive log.',c:`SELECT message_text FROM v$diag_alert_ext WHERE message_text LIKE '%ORA-1%' ORDER BY originating_timestamp DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['ap','st'],t:'4. If apply lag is high, check MRP and the standby storage and CPU. Compare the apply rate with the primary redo rate.',w:'Apply cannot keep up if the standby is slower.',s:'Recovery parallelism, `DB_BLOCK_CHECKING`, I/O capability.',x:'Block checking and slow storage on the standby are common hidden costs.',c:`SELECT item, units, sofar FROM v$recovery_progress;`},
 {ids:['io'],t:'5. During a heavy batch the redo rate can exceed the apply rate. Compare the numbers to see whether the lag will recover on its own.',w:'Some lag is expected under load, and you only need to act if it never recovers.',s:'Workload schedule, parallel apply.',x:'Lag that never returns to zero in quiet periods is a real capacity problem.',c:`SELECT name, value FROM v$dataguard_stats;`},
 {ids:['fix'],t:'6. Fix the cause, re-measure, and use VALIDATE DATABASE to confirm the standby is healthy again.',w:'It closes the loop with evidence.',s:'Broker health check.',x:'Changing several things at once makes the cause unclear.',c:`DGMGRL> VALIDATE DATABASE stby;`}]}},

{h:'7. Standby-first patching with Data Guard'},
{map:{title:'Standby-first patching map',h:216,trace:'Patch with minimal downtime',
 hint:'Tap any box, or press Patch with minimal downtime to follow a patch from the standby to the primary.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'plan',x:21,y:24,w:194,h:56,c:'ext',t:'Plan',s:'backup and fallback',d:'Read the patch notes, check compatibility, back up both databases and set a guaranteed restore point if needed.',why:'It decides the way back before you start.',chk:`SELECT patch_id, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 3 ROWS ONLY;`,see:[9,0,'Standby-first patching strategy']},
 {id:'stby',x:243,y:24,w:194,h:56,c:'proc',t:'Patch standby',s:'new home, restart',d:'Install the release update in a new Oracle home on the standby host, move the standby to it and restart apply.',why:'The primary keeps running on the old home. Redo is still applied.',chk:`$ $ORACLE_HOME/OPatch/opatch lspatches`,see:[9,0,'Standby-first patching strategy']},
 {id:'test',x:465,y:24,w:194,h:56,c:'mem',t:'Test',s:'snapshot standby',d:'Optionally convert the patched standby to a snapshot standby and test the application against it.',why:'It finds problems before the primary is touched.',chk:`DGMGRL> CONVERT DATABASE stby TO SNAPSHOT STANDBY;`,see:[9,0,'Standby-first patching strategy']},
 {id:'sw',x:21,y:136,w:194,h:56,c:'warn',t:'Switchover',s:'to patched',d:'Switch over so the patched database becomes the primary.',why:'It is the only application outage.',chk:`DGMGRL> SWITCHOVER TO stby;`,see:[5,0,'Switchover: planned role change']},
 {id:'old',x:243,y:136,w:194,h:56,c:'proc',t:'Patch old primary',s:'now a standby',d:'Patch the former primary, which is now a standby, and restart apply.',why:'Both databases are on the new home.',chk:`$ $ORACLE_HOME/OPatch/opatch lspatches`,see:[9,0,'Standby-first patching strategy']},
 {id:'dp',x:465,y:136,w:194,h:56,c:'proc',t:'datapatch',s:'on the primary',d:'Run datapatch on the primary to apply the SQL part of the patch. It flows to the standby as redo.',why:'It is done once, on the primary.',chk:`$ $ORACLE_HOME/OPatch/datapatch -verbose`,see:[9,0,'Standby-first patching strategy']}],
 steps:[
 {ids:['plan'],t:'1. Plan: read the patch notes, check the MOS notes, take backups and decide the fallback.',w:'A patch without a way back is a gamble.',s:'Backups, guaranteed restore point, runbook.',x:'Skipping this is a cost the next night.',c:`SELECT * FROM v$restore_point;`},
 {ids:['stby'],t:'2. Patch the standby home while the primary stays up. Restart the standby from the new home and resume apply.',w:'There is no application outage so far.',s:'Out-of-place patching, new `ORACLE_HOME`.',x:'The standby must be able to apply redo from an older primary, which is supported only within the documented patch types.',c:`SELECT database_role, open_mode FROM v$database;`},
 {ids:['test'],t:'3. Test on the patched standby, as a snapshot standby if you want read-write tests, then convert it back.',w:'It tests the patch on real data without risk.',s:'`CONVERT DATABASE TO SNAPSHOT STANDBY`.',x:'The standby is not protecting the primary while it is a snapshot standby.',c:`DGMGRL> CONVERT DATABASE stby TO PHYSICAL STANDBY;`},
 {ids:['sw'],t:'4. Switch over. The patched database becomes the primary. This is the short outage.',w:'Downtime is the switchover time, not the patch time.',s:'`SWITCHOVER TO`, role-based services.',x:'An application that does not reconnect extends the outage.',c:`DGMGRL> SWITCHOVER TO stby;`},
 {ids:['old','dp'],t:'5. Patch the former primary and restart it as a standby on the new home. Then run datapatch on the primary once.',w:'Both homes are patched and the dictionary is updated.',s:'`datapatch`, `opatch`.',x:'Forgetting datapatch leaves binaries and the dictionary out of step.',c:`SELECT patch_id, action, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 3 ROWS ONLY;`},
 {ids:['dp'],t:'6. Verify both databases and the configuration, and optionally switch back. Record what you did for the next cycle.',w:'It closes the change.',s:'Broker health check.',x:'Leaving one side on the old home hides a future problem.',c:`DGMGRL> VALIDATE DATABASE stby;`}]}},

]},

/* 1 ---------------------------------------------------------------- processes */
{t:'Processes',d:'Every process that moves or applies redo, and where to look when lag appears.',see:[[1,1,'LNS, ARCn, RFS and MRP'],[1,0,'The full flow']],b:[
{t:[['Process','Where','Job','Look here'],
['LGWR','Primary','Writes redo and, with SYNC, hands it to the transport','`V$LOG`'],
['LNS / NSSn / NSAn','Primary','Network server: ships redo to the standby (SYNC: NSS, ASYNC: NSA)','`V$DATAGUARD_PROCESS`, `V$ARCHIVE_DEST_STATUS`'],
['ARCn','Primary','Ships archived logs, fills gaps (FAL)','`V$ARCHIVE_DEST`'],
['RFS','Standby','Remote file server: receives redo from the primary and writes to standby redo logs','`V$MANAGED_STANDBY`'],
['MRP0','Standby','Managed recovery: applies redo to the physical standby','`V$MANAGED_STANDBY`, `V$DATAGUARD_PROCESS`'],
['PRnn','Standby','Parallel recovery slaves for apply','`V$RECOVERY_PROGRESS`'],
['LSP0, LSPnn','Logical standby','SQL Apply coordinator and workers','`V$LOGSTDBY_PROCESS`'],
['DMON','Both','Broker monitor process','`DG_BROKER_START`, `drc<SID>.log`'],
['NSVn, DRCn','Both','Broker network server and worker processes','Broker log'],
['Observer','Third host','Monitors the primary and standby for Fast-Start Failover','`DGMGRL> SHOW OBSERVER`'],
['FAL client','Standby','Fetches missing logs (`FAL_SERVER`)','Standby alert log']]},
{note:'`V$DATAGUARD_PROCESS` (12.2 and later) replaces the older `V$MANAGED_STANDBY` for most checks, and it shows both transport and apply.'}
]},

/* 2 ---------------------------------------------------------------- files */
{t:'Files and what they hold',d:'Files that exist only because of Data Guard, or that must be in step across sites.',see:[[2,2,'Standby redo logs'],[4,0,'Broker configuration files']],b:[
{t:[['File','Contents','Note'],
['Standby redo logs (SRL)','Received redo, before apply','One more group per thread than online groups; same size as online logs'],
['Standby control file','Control file made `FOR STANDBY`','Created by `RMAN DUPLICATE` or `ALTER DATABASE CREATE STANDBY CONTROLFILE`'],
['Broker configuration files','`dr1<db>.dat`, `dr2<db>.dat`','`DG_BROKER_CONFIG_FILE1/2`, in ASM for RAC'],
['Password file','Admin users for redo transport authentication','Must match across the configuration (copy, or `orapwd` with same SYS password)'],
['SPFILE','Different parameters per role','Keep standby-only parameters documented'],
['Wallet (TDE)','Master key','Same keys needed on every site'],
['Archived redo logs','Transport source and fallback','Deletion policy `APPLIED ON ALL STANDBY`'],
['Observer configuration','`observer.ora`, wallet, log','On the observer host'],
['`tnsnames.ora` and listeners','Static entries for DGMGRL','Static registration for restart ability']]},
{h:'Standby redo log sizing'},
{code:`-- groups = (number of online groups per thread) + 1, same size as online logs
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 11 SIZE 1G;
SELECT group#, thread#, bytes/1048576 mb, status FROM v$standby_log;`}
]},

/* 3 ---------------------------------------------------------------- logs */
{t:'Log files and where to find them',d:'Where the story of a lag or a failed role change is written.',see:[[10,0,'Monitoring lag'],[4,4,'VALIDATE DATABASE']],b:[
{t:[['Log','Contains','Where'],
['Primary alert log','Transport errors, destination status, switchover messages','`.../trace/alert_<SID>.log`'],
['Standby alert log','RFS and MRP messages, gaps, apply progress','`.../trace/alert_<SID>.log` on the standby'],
['Broker log','Broker actions and errors (`drc<SID>.log`)','Same trace directory'],
['Observer log','FSFO decisions, reconnect, failover','`observer.log` or the file named at start'],
['DGMGRL history','Commands entered','Console, or `-logfile`'],
['MRP trace','Apply details','`<SID>_mrp0_<pid>.trc`'],
['`V$DATAGUARD_STATUS`','Recent Data Guard messages as rows','Query on either site'],
['`V$ARCHIVE_DEST_STATUS`','Destination state and errors','Primary']]},
{code:`SELECT timestamp, severity, facility, message
FROM v$dataguard_status WHERE timestamp > SYSDATE - 1/24 ORDER BY timestamp;`}
]},

/* 4 ---------------------------------------------------------------- parameters */
{t:'Important parameters',d:'Initialization parameters and archive destination attributes for Data Guard.',see:[[2,3,'db_unique_name and log_archive_config'],[1,3,'SYNC vs ASYNC']],b:[
{h:'Initialization parameters'},
{t:[['Parameter','Typical','Note'],
['`db_unique_name`','Different per site','Required, unique in the configuration'],
['`log_archive_config`','`DG_CONFIG=(prim,stby)`','Lists all members'],
['`log_archive_dest_n`','`SERVICE=stby ASYNC VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=stby`','Remote destination (broker manages when enabled)'],
['`log_archive_dest_state_n`','`ENABLE`','Use `DEFER` to pause shipping'],
['`fal_server`','TNS name of primary','Where the standby fetches gaps'],
['`standby_file_management`','`AUTO`','New datafiles created on standby automatically'],
['`db_file_name_convert`, `log_file_name_convert`','Paths','Only when paths differ (not with OMF/ASM)'],
['`dg_broker_start`','`TRUE`','Run DMON'],
['`dg_broker_config_file1/2`','Shared location','For RAC, put in ASM'],
['`log_archive_max_processes`','4 or higher','Archiver processes'],
['`archive_lag_target`','0 or seconds','Force log switch to limit loss for ASYNC'],
['`db_lost_write_protect`','`TYPICAL`','Detect lost writes (primary and standby)'],
['`db_flashback_retention_target`','Per policy','Needed to reinstate'],
['`enabled_pdbs_on_standby`','`*` or a list','Which PDBs the standby holds (CDB standby)']]},
{h:'LOG_ARCHIVE_DEST_n attributes'},
{t:[['Attribute','Meaning'],
['`SERVICE`','TNS alias of the standby'],
['`SYNC` / `ASYNC`','Wait for the standby, or not'],
['`AFFIRM` / `NOAFFIRM`','Standby write confirmation before acknowledging'],
['`NET_TIMEOUT`','Seconds to wait for a SYNC destination before giving up'],
['`VALID_FOR`','When the destination applies (log type, role)'],
['`DB_UNIQUE_NAME`','Target database'],
['`COMPRESSION`','`ENABLE` (needs Advanced Compression)'],
['`MAX_FAILURE`, `REOPEN`','Retry behavior'],
['`DELAY`','Minutes before apply (not on real-time apply)'],
['`ALTERNATE`','Fallback destination']]},
{h:'Broker properties (DGMGRL)'},
{t:[['Property','Meaning'],
['`LogXptMode`','`SYNC`, `ASYNC`, `FASTSYNC`'],
['`RedoRoutes`','Who ships to whom (cascading, far sync)'],
['`DelayMins`','Apply delay'],
['`ApplyLagThreshold`, `TransportLagThreshold`','Alert thresholds in seconds'],
['`FastStartFailoverTarget`, `FastStartFailoverThreshold`','FSFO target and wait time'],
['`FastStartFailoverLagLimit`','Maximum lag for automatic failover (Max Performance)'],
['`StaticConnectIdentifier`','Static service for restart by broker'],
['`DGConnectIdentifier`','Connect string between sites'],
['`StandbyFileManagement`, `ArchiveLagTarget`','Broker managed parameters']]}
]},

/* 5 ---------------------------------------------------------------- views */
{t:'System views',d:'Which view answers which Data Guard question.',see:[[3,5,'Verifying with views'],[10,0,'Monitoring lag']],b:[
{t:[['Question','View'],
['Database role and mode','`V$DATABASE` (`DATABASE_ROLE`, `PROTECTION_MODE`, `PROTECTION_LEVEL`, `SWITCHOVER_STATUS`)'],
['Is there a transport or apply lag?','`V$DATAGUARD_STATS` (`transport lag`, `apply lag`)'],
['What are the processes doing?','`V$DATAGUARD_PROCESS`, `V$MANAGED_STANDBY`'],
['Destination state','`V$ARCHIVE_DEST`, `V$ARCHIVE_DEST_STATUS`'],
['Gaps','`V$ARCHIVE_GAP`'],
['Received and applied logs','`V$ARCHIVED_LOG` (`APPLIED`, `STANDBY_DEST`)'],
['Standby redo logs','`V$STANDBY_LOG`'],
['Apply rate','`V$RECOVERY_PROGRESS`'],
['Broker state','`V$DATAGUARD_CONFIG`, DGMGRL `SHOW CONFIGURATION`'],
['Recent messages','`V$DATAGUARD_STATUS`'],
['Standby open mode','`V$DATABASE.OPEN_MODE`'],
['FSFO status','`V$DATABASE` (`FS_FAILOVER_STATUS`, `FS_FAILOVER_CURRENT_TARGET`)'],
['Logical standby apply','`DBA_LOGSTDBY_EVENTS`, `V$LOGSTDBY_STATS`'],
['Flashback and restore points','`V$FLASHBACK_DATABASE_LOG`, `V$RESTORE_POINT`']]},
{code:`SELECT name, value, unit, time_computed FROM v$dataguard_stats
WHERE name IN ('transport lag','apply lag','apply finish time','estimated startup time');`}
]},

/* 6 ---------------------------------------------------------------- tools */
{t:'DGMGRL and other tools',d:'The broker commands you use daily, and the tools around them.',see:[[4,3,'DGMGRL commands'],[4,1,'Creating a broker configuration']],b:[
{t:[['Task','Command'],
['Connect','`dgmgrl sys@prim`'],
['Show configuration','`SHOW CONFIGURATION;`, `SHOW CONFIGURATION VERBOSE;`'],
['Show a database','`SHOW DATABASE stby;`, `SHOW DATABASE VERBOSE stby;`'],
['Check readiness','`VALIDATE DATABASE stby;`, `VALIDATE DATABASE VERBOSE stby;`'],
['Validate static connect','`VALIDATE STATIC CONNECT IDENTIFIER FOR stby;`'],
['Create configuration','`CREATE CONFIGURATION cfg AS PRIMARY DATABASE IS prim CONNECT IDENTIFIER IS prim;`'],
['Add a standby','`ADD DATABASE stby AS CONNECT IDENTIFIER IS stby MAINTAINED AS PHYSICAL;`'],
['Enable or disable','`ENABLE CONFIGURATION;`, `DISABLE DATABASE stby;`'],
['Change a property','`EDIT DATABASE stby SET PROPERTY LogXptMode = \'SYNC\';`'],
['Change protection mode','`EDIT CONFIGURATION SET PROTECTION MODE AS MaxAvailability;`'],
['Switchover','`SWITCHOVER TO stby;`'],
['Failover','`FAILOVER TO stby;`'],
['Reinstate','`REINSTATE DATABASE prim;`'],
['Convert standby','`CONVERT DATABASE stby TO SNAPSHOT STANDBY;`'],
['Start apply','`EDIT DATABASE stby SET STATE = \'APPLY-ON\';`'],
['FSFO','`ENABLE FAST_START FAILOVER;`, `START OBSERVER;`, `SHOW FAST_START FAILOVER;`']]},
{h:'Other tools'},
{t:[['Tool','Use'],
['`rman`','`DUPLICATE ... FOR STANDBY FROM ACTIVE DATABASE`, backups on a standby'],
['`sqlplus`','`ALTER DATABASE RECOVER MANAGED STANDBY DATABASE ...` (manual mode)'],
['`tnsping`, `lsnrctl`','Connectivity and static listener checks'],
['`orapwd`','Recreate a matching password file']]}
]},

/* 7 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'Protection mode, transport, role change and standby type.',see:[[1,4,'Protection modes'],[5,0,'Switchover']],b:[
{h:'Protection modes'},
{t:[['Mode','Transport','Data loss','Primary stops if standby unreachable?'],
['Maximum Protection','`SYNC AFFIRM`','Zero','**Yes**'],
['Maximum Availability','`SYNC` (or `FASTSYNC`)','Zero when synchronized','No, drops to degraded'],
['Maximum Performance','`ASYNC`','Possible (seconds)','No']]},
{h:'Switchover or failover?'},
{t:[['Situation','Use'],
['Planned maintenance, DR test','Switchover'],
['Primary is gone and unrecoverable','Failover'],
['Failed primary can be fixed later','Failover, then reinstate with Flashback Database'],
['Automatic response needed','Fast-Start Failover with an observer']]},
{h:'Standby type'},
{t:[['Type','Use'],
['Physical (redo apply)','Default DR, identical blocks'],
['Active Data Guard (physical, open read only)','Reporting and backups on standby (licensed)'],
['Snapshot standby','Temporary read write testing'],
['Logical standby','Different structure, rolling upgrades (limited data types)'],
['Far sync','Zero data loss to a remote standby via a nearby relay']]},
{h:'Apply modes'},
{t:[['Mode','Meaning'],
['Real-time apply','Apply as redo arrives in standby redo logs (default with SRLs)'],
['Archived log apply','Apply only after the log is archived'],
['Delayed apply','Intentional delay to catch human errors']]}
]},

/* 8 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, likely cause and fix.',see:[[10,3,'Standby out of sync'],[10,7,'Five broken standbys']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['Transport lag grows','`V$DATAGUARD_STATS`, `V$ARCHIVE_DEST_STATUS`, network','Network bandwidth or latency, standby I/O','Check path, SRLs, compression, `NET_TIMEOUT`'],
['Apply lag grows, transport fine','`V$RECOVERY_PROGRESS`, `V$MANAGED_STANDBY`','Slow apply, I/O, parallelism','Tune recovery parallelism, storage'],
['Gap does not close','`V$ARCHIVE_GAP`, `FAL_SERVER`','FAL not set or log removed','Fix FAL, restore the log, recreate standby if needed'],
['ORA-16191 or `PRIMARY_LOG_SHIPPING_CLIENT_NOT_LOGGED_ON`','Password files','Passwords differ','Copy the password file'],
['MRP stopped','Standby alert, `V$MANAGED_STANDBY`','Error such as missing file','Fix and restart `RECOVER MANAGED STANDBY DATABASE`'],
['Broker shows ERROR or WARNING','`SHOW DATABASE VERBOSE`','Property or state mismatch','Follow the ORA-16xxx text'],
['Switchover refused','`V$DATABASE.SWITCHOVER_STATUS`','Not synchronized, sessions, jobs','Resolve status, then retry'],
['Failed primary will not reinstate','Flashback on?','Flashback off or logs gone','Rebuild from the new primary'],
['FSFO not triggering','Observer, thresholds, `VALIDATE FAST_START FAILOVER`','Observer lost, lag over limit','Fix observer or thresholds'],
['Standby will not open read only','Alert log, `OPEN_MODE`','Needs ADG licence, apply running','Stop apply or enable ADG'],
['After adding datafile standby errors','`STANDBY_FILE_MANAGEMENT`','`MANUAL` and file missing','Set `AUTO`, create file']]}
]},

/* 9 ---------------------------------------------------------------- errors */
{t:'Common error messages',d:'The ORA-16xxx series and friends, with meaning and fix.',see:[[10,2,'Common errors'],[5,0,'Role transitions']],b:[
{t:[['Error','Meaning','Fix'],
['ORA-16009','Invalid redo transport destination','Check the destination parameters'],
['ORA-16014','Log not archived: no available destinations','Check destinations and space'],
['ORA-16038 / 16055','Log cannot be archived / FAL request rejected','Check destination errors'],
['ORA-16057','Server not in the Data Guard configuration','Fix `log_archive_config` and `db_unique_name`'],
['ORA-16191','Primary log shipping client not logged on standby','Sync password files'],
['ORA-16198','Timeout on internal channel','Check network, `NET_TIMEOUT`'],
['ORA-16139','Media recovery required','Run recovery or `ALTER DATABASE RECOVER ...`'],
['ORA-16661','Standby database needs to be reinstated','`REINSTATE DATABASE`'],
['ORA-16664','Unable to receive the result from a database','Check connectivity and broker'],
['ORA-16766 / 16747','Redo Apply is stopped / logical standby apply is stopped','Start apply'],
['ORA-16783','Instance not available for management','Check instance, static listener'],
['ORA-16789','Standby redo logs configured incorrectly','Fix SRL count and size'],
['ORA-16809','Multiple warnings detected for the database','`SHOW DATABASE VERBOSE`'],
['ORA-16810','Multiple errors or warnings for the database','Same'],
['ORA-16825','Multiple errors or warnings, including FSFO-related','Check FSFO and observer'],
['ORA-16853','Apply lag exceeded the threshold','Check apply'],
['ORA-16855','Transport lag exceeded the threshold','Check network'],
['ORA-16857','Standby disconnected from redo source too long','Check transport'],
['ORA-01033 / 01034','Not available or initialization in progress','Start or open the database'],
['ORA-00308 / 00279 / 00289','Cannot open archived log / change required / suggestion','Provide the named log'],
['ORA-01669','Standby control file not consistent with datafiles','Refresh control file or rebuild']]},
{note:'Always run `SHOW DATABASE VERBOSE <db>` after an ORA-168xx message. The broker lists what it found.'}
]},

/* 10 ---------------------------------------------------------------- health check */
{t:'Health-check SQL pack',d:'Paste-ready checks for the primary and the standby.',see:[[10,0,'Monitoring lag'],[11,2,'Switchover drills']],b:[
{h:'Role and mode (both sites)'},
{code:`SELECT name, db_unique_name, database_role, open_mode, protection_mode, protection_level, switchover_status
FROM v$database;`},
{h:'Lag (standby)'},
{code:`SELECT name, value, time_computed FROM v$dataguard_stats WHERE name IN ('transport lag','apply lag');
SELECT process, status, thread#, sequence#, block# FROM v$managed_standby ORDER BY process;
SELECT * FROM v$archive_gap;`},
{h:'Destinations (primary)'},
{code:`SELECT dest_id, dest_name, status, error, archived_seq#, applied_seq#, gap_status
FROM v$archive_dest_status WHERE status <> 'INACTIVE';
SELECT dest_id, db_unique_name, destination, status, error FROM v$archive_dest WHERE status <> 'INACTIVE';`},
{h:'Last sequence generated, received and applied'},
{code:`SELECT thread#, MAX(sequence#) last_seq FROM v$archived_log GROUP BY thread#;
SELECT thread#, MAX(sequence#) applied FROM v$archived_log WHERE applied = 'YES' GROUP BY thread#;`},
{h:'Broker'},
{code:`DGMGRL> SHOW CONFIGURATION;
DGMGRL> VALIDATE DATABASE VERBOSE stby;
DGMGRL> SHOW FAST_START FAILOVER;`}
]},

/* 11 ---------------------------------------------------------------- operations */
{t:'Role transition sequences',d:'Short, ordered sequences for switchover, failover and reinstate with the broker, and checks before each.',see:[[5,0,'Switchover'],[5,1,'Failover'],[5,2,'Reinstate']],b:[
{h:'Switchover'},
{code:`DGMGRL> VALIDATE DATABASE stby;
DGMGRL> SWITCHOVER TO stby;
DGMGRL> SHOW CONFIGURATION;`},
{flow:['Validate: ready for switchover = YES, no gaps','Check applications and jobs, drain services','Run SWITCHOVER','Check services start on the new primary','Verify standby (old primary) applies redo']},
{h:'Failover'},
{code:`DGMGRL> FAILOVER TO stby;
-- if the old primary comes back, reinstate it
DGMGRL> REINSTATE DATABASE prim;`},
{h:'Reinstate needs'},
{t:[['Requirement','Why'],
['Flashback Database was on on the failed primary','To rewind it to the failover SCN'],
['Flashback logs still available','Retention covers the divergence'],
['Network between sites','To fetch redo from the new primary'],
['Static listener or reachable instance','Broker must restart it']]},
{h:'Manual (without the broker)'},
{code:`-- on the primary
ALTER DATABASE COMMIT TO SWITCHOVER TO PHYSICAL STANDBY WITH SESSION SHUTDOWN;
-- on the standby
ALTER DATABASE COMMIT TO SWITCHOVER TO PRIMARY WITH SESSION SHUTDOWN;
ALTER DATABASE OPEN;`}
]},

/* 12 ---------------------------------------------------------------- naming / licensing */
{t:'Terms and licensing decoder',d:'Names of states and roles, and which features need Active Data Guard.',see:[[0,5,'Licensing'],[0,3,'Standby types']],b:[
{h:'Broker states'},
{t:[['Term','Meaning'],
['`TRANSPORT-ON` / `TRANSPORT-OFF`','Shipping enabled or paused'],
['`APPLY-ON` / `APPLY-OFF`','Redo Apply running or stopped'],
['`PHYSICAL STANDBY`, `LOGICAL STANDBY`, `SNAPSHOT STANDBY`, `FAR SYNC`','Database roles'],
['`SUCCESS`, `WARNING`, `ERROR`','Broker status of the configuration or database'],
['`SYNCHRONIZED`, `NOT SYNCHRONIZED`','Zero lag in SYNC modes'],
['`TO PRIMARY`, `TO STANDBY`, `SESSIONS ACTIVE`','`SWITCHOVER_STATUS` values']]},
{h:'Data Guard or Active Data Guard?'},
{t:[['Feature','Data Guard','Active Data Guard'],
['Redo transport and apply, switchover, failover, broker','Yes','Yes'],
['Open read only while applying (real-time query)','No','Yes'],
['Automatic block repair','No','Yes'],
['Offload backups to standby (incremental with change tracking)','No','Yes'],
['Far sync (zero data loss over distance)','No','Yes'],
['DML redirection','No','Yes'],
['Snapshot standby','Yes','Yes'],
['Rolling upgrade with `DBMS_ROLLING`','Yes','Yes']]},
{note:'Licensing rules change with releases. Confirm in the Licensing Information User Manual.'}
]}

]};
