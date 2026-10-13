/* LearnSphere - Oracle in the Cloud Quick Reference (cheat sheet).
   window.QREF['ora-cloud'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for Oracle Database 19c on OCI, Autonomous Database and Amazon RDS for Oracle. Service names, limits and regional availability change:
   confirm in the provider documentation. Commands are examples with placeholder identifiers. */
window.QREF=window.QREF||{};
window.QREF['ora-cloud']={title:'Oracle in the Cloud Quick Reference',blurb:'Service choice, responsibilities, connections, migration, DR, restrictions and fixes for Oracle databases in OCI, Autonomous and RDS.',hint:'wallet or switchover',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas behind running Oracle Database in the cloud that you should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command or query to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Models and responsibility'},
{acc:[
{t:'Operating models',s:'From a VM you manage to a database that manages itself.',
 a:'Oracle in the cloud comes as **self-managed IaaS**, a **managed database service** (Base Database, RDS), an **engineered service** (Exadata Database Service) and an **autonomous service**. Each step to the right moves operations to the provider and removes some of your options.',
 w:'Choosing by habit instead of by requirement is the most common mistake. Decide what you must control, and choose the least-managed model that fits.',
 c:`SELECT name, cdb, open_mode FROM v$database;`,see:[0,0,'Why Oracle databases move to the cloud']},
{t:'Shared responsibility',s:'Your data and access never move.',
 a:'The provider is responsible for hardware, hypervisor and (depending on the service) OS, installation, patching, backups and failover. You are always responsible for **data, schema, SQL, users, network exposure and the decisions** about keys and retention.',
 w:'Write the responsibility table for each database, with names. Gaps in it are risks.',
 c:`SELECT username, account_status FROM dba_users WHERE oracle_maintained = 'N';`,see:[0,1,'The shared responsibility model for Oracle databases']},
{t:'License Included and BYOL',s:'Two ways to pay for the licence.',
 a:'**License Included** puts the Oracle licence in the hourly price. **BYOL** applies licences you already own, at a lower hourly price, with support still due. Options are not carried over unless you own them.',
 w:'A wrong assumption here is the most expensive mistake in a cloud move.',
 c:`SELECT name, detected_usages FROM dba_feature_usage_statistics WHERE detected_usages > 0 ORDER BY detected_usages DESC FETCH FIRST 10 ROWS ONLY;`,see:[0,3,'Licensing in the cloud']},
{t:'Regions, compartments and networks',s:'Where it runs and who may change it.',
 a:'A **Region** holds Availability Domains (zones). **Compartments** (or accounts and subscriptions) group resources and scope IAM. A **VCN or VPC** with private subnets decides how clients reach the listener.',
 w:'Place databases in private subnets and plan compartments by environment before you create anything.',
 c:`oci iam compartment list --compartment-id-in-subtree true --query 'data[].name'`,see:[0,4,'Cloud building blocks']}
]},

{h:'OCI database services'},
{acc:[
{t:'Base Database',s:'A full Oracle Database on a DB system you can log in to.',
 a:'OCI provisions a VM or bare metal DB system with Grid Infrastructure (ASM) or LVM and an Oracle home, and drives backup, patching and Data Guard through its tooling. You keep OS and SYSDBA access.',
 w:'It is the nearest to an on-premises database with cloud lifecycle automation.',
 c:`sudo dbaascli database status --dbname ORCL`,see:[1,0,'Base Database architecture']},
{t:'Backups to Object Storage',s:'RMAN to a bucket, with a retention you set.',
 a:'Automatic backups are RMAN backups written to OCI Object Storage, with a retention of days to about two months, plus manual and long-term backups. Restore to the latest, to a timestamp or SCN, or into a new database.',
 w:'Backups only help if retention matches the time to detect a problem and restores are tested.',
 c:`oci db backup list --database-id <database-ocid> --query 'data[].["display-name","lifecycle-state","time-ended"]'`,see:[1,2,'Backups, restore and recovery with Object Storage']},
{t:'Patching and upgrades',s:'OCI provides, you schedule.',
 a:'Patches apply to the Grid Infrastructure home and each database home after a precheck. **Out-of-place** patching (a new patched home) gives a quick fallback. Version upgrades use AutoUpgrade underneath.',
 w:'Always back up first and rehearse on a clone.',
 c:`SELECT patch_id, status, action_time FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 5 ROWS ONLY;`,see:[1,3,'Patching and upgrading']},
{t:'Data Guard associations',s:'A standby as a service.',
 a:'A **Data Guard association** creates a standby DB system in another AD or Region and manages roles. You choose the protection mode and perform switchover and failover from the console or CLI.',
 w:'It is the cloud form of the standby you know. Test switchovers with the application.',
 c:`SELECT database_role, protection_mode, switchover_status FROM v$database;`,see:[1,4,'Scaling, Data Guard and high availability']},
{t:'Exadata Database Service',s:'Exadata as a service, with your VM cluster.',
 a:'The provider operates the **Exadata infrastructure**. You operate **VM clusters** and the databases in them, with Smart Scan, flash and IORM available.',
 w:'Use it when scale and performance justify Exadata. Otherwise Base Database or Autonomous is more economical.',
 c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'cell physical IO%';`,see:[1,5,'Exadata Database Service in the cloud']}
]},

{h:'Autonomous Database'},
{acc:[
{t:'Autonomous automation',s:'Self-driving, self-securing, self-repairing.',
 a:'Autonomous automates tuning, statistics, indexing, scaling, patching, encryption, backups and failover on Exadata. **Design, SQL, access and data lifecycle remain yours.**',
 w:'It reduces operational work. It does not fix a poor schema or poor SQL.',
 c:`SELECT * FROM dba_auto_index_config;`,see:[2,0,'What Autonomous means']},
{t:'Workload types and deployments',s:'ATP, ADW, JSON, APEX, on serverless or dedicated infrastructure.',
 a:'The **workload type** is chosen at creation. **Serverless** shares managed infrastructure and is billed in ECPUs and TB. **Dedicated** reserves Exadata infrastructure for more control.',
 w:'Pick the type that matches the dominant workload and size compute for the base load.',
 c:`SELECT sys_context('USERENV','SERVICE_NAME') FROM dual;`,see:[2,1,'Workload types and deployment options']},
{t:'Wallet, TLS and services',s:'How clients connect.',
 a:'Clients use **mTLS with a wallet** (default) or **TLS without a wallet** with an ACL or private endpoint. Services `_high`, `_medium`, `_low`, `_tp`, `_tpurgent` map to consumer groups with different priority and parallelism.',
 w:'Use the right service per application, protect wallets and set the ACL before sharing the endpoint.',
 c:`SELECT service_name FROM v$services;`,see:[2,2,'Connecting: wallets, TLS and network access']},
{t:'DBMS_CLOUD',s:'The way in and out for files.',
 a:'With no server file system, data moves through **Object Storage** and `DBMS_CLOUD`: credentials, `COPY_DATA`, external tables and `EXPORT_DATA`. Data Pump uses object storage too.',
 w:'It replaces `UTL_FILE`, host directories and OS copy steps.',
 c:`SELECT table_name, status, rows_loaded FROM user_load_operations ORDER BY start_time DESC FETCH FIRST 5 ROWS ONLY;`,see:[2,3,'Loading and moving data with DBMS_CLOUD']},
{t:'Clones and Autonomous Data Guard',s:'Copies and standbys by request.',
 a:'**Full, metadata and refreshable clones** give test and reporting copies. **Autonomous Data Guard** adds a local or cross-region standby. Backups are automatic with about 60 days of retention.',
 w:'A standby is not a backup, and a clone is not a backup.',
 c:`oci db autonomous-database list --compartment-id <ocid> --query 'data[].["display-name","lifecycle-state"]'`,see:[2,5,'Backups, clones and Autonomous Data Guard']},
{t:'Restrictions',s:'No OS, no SYSDBA, limited parameters.',
 a:'Autonomous removes OS access, SYSDBA and most parameter changes. Tasks use `ADMIN`, Database Actions, `DBMS_CLOUD` and the console.',
 w:'Check the source against the restrictions with the premigration advisor before you move.',
 c:`SELECT name, value FROM v$parameter WHERE isdefault = 'FALSE' FETCH FIRST 10 ROWS ONLY;`,see:[2,6,'What you cannot do']}
]},

{h:'Other clouds'},
{acc:[
{t:'Amazon RDS for Oracle',s:'Managed Oracle on AWS.',
 a:'AWS runs the OS and software. You use SQL and the **`rdsadmin`** packages. Features come through **option groups** and **parameter groups**, and you have no SYSDBA.',
 w:'Great when the application lives in AWS and standard features are enough.',
 c:`SELECT * FROM rdsadmin.rds_alert_log_view FETCH FIRST 5 ROWS ONLY;`,see:[3,1,'Amazon RDS for Oracle']},
{t:'Multi-AZ and read replicas',s:'HA and read scale on RDS.',
 a:'**Multi-AZ** keeps a synchronous standby that fails over automatically and is not readable. **Read replicas** use Data Guard and need Active Data Guard when opened read-only.',
 w:'The standby is for availability, the replica is for reads and DR.',
 c:`aws rds describe-db-instances --db-instance-identifier orcl-prod --query 'DBInstances[0].[MultiAZ,ReadReplicaDBInstanceIdentifiers]'`,see:[3,3,'RDS for Oracle: backup, Multi-AZ and read replicas']},
{t:'Oracle Database@Azure, AWS and Google Cloud',s:'Exadata and Autonomous inside the hyperscaler.',
 a:'Oracle-operated Exadata and Autonomous run in the provider data centre, attached to your network, billed through the marketplace. The operational model is that of the Oracle service.',
 w:'It gives low latency for applications in that cloud. Check regional availability first.',
 c:`SELECT instance_name, host_name FROM v$instance;`,see:[3,4,'Oracle Database@Azure, @AWS and @Google Cloud']},
{t:'RDS Custom and self-managed',s:'More control, more duty.',
 a:'**RDS Custom** gives OS and database access inside a support perimeter. **Self-managed** VMs give everything and make you responsible for install, patching, HA, backup and licence counting.',
 w:'Choose it only when a requirement forces it.',
 c:`SELECT banner_full FROM v$version;`,see:[3,5,'RDS Custom and self-managed Oracle on virtual machines']}
]},

{h:'Migration, DR and operations'},
{acc:[
{t:'Migration methods',s:'Size, downtime and platform decide.',
 a:'**Data Pump** is general. **Physical standby** and **ZDM** suit same-platform large databases. **GoldenGate** and **DMS** suit cross-platform and strict downtime. Assess first with an advisor tool.',
 w:'A rehearsed cut-over with a fallback is what makes a migration safe.',
 c:`SELECT platform_name, endian_format FROM v$transportable_platform WHERE platform_name = (SELECT platform_name FROM v$database);`,see:[4,0,'Choosing a migration method to the cloud']},
{t:'Disaster recovery patterns',s:'In-AD, cross-region and hybrid.',
 a:'Backups in another Region give slow recovery. **Data Guard in another AD or Region** gives minutes. A **hybrid** standby between on-premises and cloud covers site loss. An untested standby is a hope.',
 w:'Write the RPO and RTO first, then choose the pattern.',
 c:`SELECT name, value FROM v$dataguard_stats WHERE name IN ('transport lag','apply lag');`,see:[4,4,'Disaster recovery in the cloud']},
{t:'Backup strategy',s:'Layers and protection from deletion.',
 a:'Use automatic backups for short recovery, manual before changes, long-term for compliance, cross-region copies for regional loss, and limits on who can delete.',
 w:'Test restores on a schedule and keep the result.',
 c:`RMAN> LIST BACKUP SUMMARY;`,see:[4,5,'Backup strategy in the cloud']},
{t:'Cloud security layers',s:'IAM, network, encryption, database, audit.',
 a:'Cloud IAM controls the service, network rules control reachability, TDE and TLS protect data, and the database model (roles, VPD, audit) controls what a session can do.',
 w:'Do not rely on one layer, and keep secrets in a vault.',
 c:`SELECT * FROM v$encryption_wallet;`,see:[5,0,'Security in the cloud']},
{t:'Monitoring and cost',s:'Metrics and budgets before incidents.',
 a:'Use platform metrics and alarms, Performance Hub or CloudWatch, and the usual database views. Tag resources, set budgets, right-size and stop what is idle.',
 w:'Most cost findings are oversized or idle databases and long backup retention.',
 c:`SELECT metric_name, value FROM v$sysmetric WHERE group_id = 2 FETCH FIRST 10 ROWS ONLY;`,see:[5,1,'Monitoring and diagnostics']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Four small maps of how the parts fit together: choosing a service, a Base Database system, Autonomous Database and the paths of a migration.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why a DBA cares, one query or command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. Choosing a service'},
{map:{title:'Service choice map',h:328,trace:'Choose for three workloads',
 hint:'Tap any box, or press Choose for three workloads to apply the questions to an analytics platform, a core ERP and an AWS-based application.',
 lines:[[215,52,241,52],[437,52,463,52],[340,80,340,134],[562,80,562,134],[118,80,118,134],[215,164,241,164],[437,164,463,164],[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'req',x:21,y:24,w:194,h:56,c:'ext',t:'Requirement',s:'location, access, size',d:'Start from where the data and application must be, what access is needed and how large and critical the system is.',why:'A choice without requirements is a preference.',chk:`SELECT ROUND(SUM(bytes)/1024/1024/1024) AS gb FROM dba_data_files;`,see:[0,5,'Practical: Choose a service for three workloads']},
 {id:'acc',x:243,y:24,w:194,h:56,c:'mem',t:'OS or SYSDBA needed?',s:'control',d:'Do agents, custom packages or specific patching require host or SYSDBA access?',why:'Autonomous and RDS give neither.',chk:`SELECT username FROM dba_users WHERE username = 'SYS';`,see:[0,1,'The shared responsibility model']},
 {id:'size',x:465,y:24,w:194,h:56,c:'mem',t:'Large or critical?',s:'scale and SLA',d:'Is it very large, highly consolidated or performance critical enough for Exadata?',why:'Exadata features cost more and pay off at scale.',chk:`SELECT name, value FROM v$sysstat WHERE name = 'physical read total bytes';`,see:[1,5,'Exadata Database Service in the cloud']},
 {id:'adb',x:21,y:136,w:194,h:56,c:'proc',t:'Autonomous',s:'less to operate',d:'Best for new development, analytics and variable load with a small team.',why:'Check restrictions before migrating existing applications.',chk:`oci db autonomous-database create ...`,see:[2,0,'What Autonomous means']},
 {id:'base',x:243,y:136,w:194,h:56,c:'proc',t:'Base Database',s:'closest to on-premises',d:'A DB system with OS and SYSDBA access and cloud automation for backups, patching and Data Guard.',why:'A good lift-and-shift target.',chk:`oci db system launch ...`,see:[1,0,'Base Database architecture']},
 {id:'exa',x:465,y:136,w:194,h:56,c:'proc',t:'Exadata service',s:'scale and performance',d:'Exadata infrastructure with your VM clusters.',why:'For consolidation and heavy workloads.',chk:`oci db cloud-vm-cluster list --compartment-id <ocid>`,see:[1,5,'Exadata Database Service in the cloud']},
 {id:'rds',x:21,y:248,w:194,h:56,c:'proc',t:'RDS for Oracle',s:'in AWS',d:'A managed service for Oracle workloads that stay in AWS.',why:'No OS or SYSDBA, rdsadmin package instead.',chk:`aws rds create-db-instance --engine oracle-ee ...`,see:[3,1,'Amazon RDS for Oracle']},
 {id:'mc',x:243,y:248,w:194,h:56,c:'proc',t:'Database@hyperscaler',s:'Exadata near the app',d:'Oracle-operated Exadata and Autonomous inside Azure, AWS or Google Cloud data centres.',why:'Check availability and networking first.',chk:`SELECT instance_name FROM v$instance;`,see:[3,4,'Oracle Database@Azure, @AWS and @Google Cloud']},
 {id:'self',x:465,y:248,w:194,h:56,c:'warn',t:'Self-managed VM',s:'full control',d:'Oracle installed by you on any cloud VM.',why:'Everything is yours, including licence counting.',chk:`SELECT banner_full FROM v$version;`,see:[3,5,'RDS Custom and self-managed Oracle on virtual machines']}],
 steps:[
 {ids:['req','acc'],t:'1. Capture the requirements, then ask whether OS or SYSDBA access is truly needed.',w:'It eliminates whole families of options.',s:'Application vendor requirements.',x:'Assuming access is needed by habit.',c:`SELECT * FROM v$option WHERE value = 'TRUE';`},
 {ids:['acc','base','self'],t:'2. If it is needed, choose Base Database, an Exadata VM cluster or a self-managed VM.',w:'These give host-level control.',s:'Licensing and operations capacity.',x:'Choosing self-managed without an operations team.',c:`oci db system list --compartment-id <ocid>`},
 {ids:['size','exa'],t:'3. If the system is very large or consolidated, an Exadata service fits.',w:'Exadata features pay off at scale.',s:'Workload measurements.',x:'Choosing Exadata for a small database.',c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'cell%' FETCH FIRST 5 ROWS ONLY;`},
 {ids:['adb'],t:'4. For new, analytic or variable workloads with a small team, choose Autonomous.',w:'It removes most operations.',s:'Restrictions check.',x:'Migrating an application that needs OS access.',c:`oci db autonomous-database list --compartment-id <ocid>`},
 {ids:['rds','mc'],t:'5. If the application is in a hyperscaler, choose RDS, or Database@ for Exadata and Autonomous capabilities.',w:'Closeness to the application matters.',s:'Region availability and cost.',x:'Ignoring regional availability.',c:`aws rds describe-db-instances --query 'DBInstances[].[DBInstanceIdentifier,Engine]'`},
 {ids:['req'],t:'6. Confirm the licence model and cost before you commit, and record the decision.',w:'A decision record prevents re-litigation.',s:'Licence policy, budget.',x:'No record of why.',c:`SELECT name, detected_usages FROM dba_feature_usage_statistics WHERE detected_usages > 0 FETCH FIRST 5 ROWS ONLY;`}]}},

{h:'2. OCI Base Database'},
{map:{title:'Base Database map',h:328,trace:'Follow a backup and a patch',
 hint:'Tap any box, or press Follow a backup and a patch to see how a DB system, its storage and Object Storage work together.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L340 107 L340 134',[243,164,217,164],[437,164,463,164],[340,192,340,246]],
 nodes:[
 {id:'app',x:21,y:24,w:194,h:56,c:'ext',t:'Application',s:'client subnet',d:'An application connects to the database service name inside the VCN, usually through a private address.',why:'Use connection pooling and retry for planned operations.',chk:`tnsping dbhost01.sub.vcn.oraclevcn.com:1521`,see:[1,1,'Creating and connecting to a DB system']},
 {id:'sub',x:243,y:24,w:194,h:56,c:'net',t:'Subnets and rules',s:'client and backup',d:'A client subnet for applications and a backup subnet for traffic to Object Storage, controlled by security lists or NSGs.',why:'A closed backup path shows as failed backups.',chk:`oci network subnet list --compartment-id <ocid>`,see:[0,4,'Cloud building blocks']},
 {id:'node',x:465,y:24,w:194,h:56,c:'proc',t:'Compute node',s:'VM or bare metal',d:'The VM or bare metal server running the Oracle software. You can SSH to it.',why:'OCI automation runs on this node. Do not disturb it.',chk:`ssh opc@dbhost01`,see:[1,0,'Base Database architecture']},
 {id:'asm',x:21,y:136,w:194,h:56,c:'disk',t:'Storage',s:'ASM or LVM',d:'Block storage presented to the node and managed by ASM or LVM.',why:'Can grow online. Cannot be reduced.',chk:`SELECT name, total_mb, free_mb FROM v$asm_diskgroup;`,see:[1,0,'Base Database architecture']},
 {id:'db',x:243,y:136,w:194,h:56,c:'proc',t:'Database',s:'CDB with PDBs',d:'A multitenant database with an Oracle home at a known patch level.',why:'The home can be replaced for out-of-place patching.',chk:`SELECT name, open_mode FROM v$pdbs;`,see:[1,3,'Patching and upgrading']},
 {id:'obj',x:465,y:136,w:194,h:56,c:'disk',t:'Object Storage',s:'backups',d:'RMAN backups and archived logs are written to a bucket.',why:'Retention and restore tests are your responsibility.',chk:`oci db backup list --database-id <ocid>`,see:[1,2,'Backups, restore and recovery with Object Storage']},
 {id:'dg',x:240,y:248,w:200,h:56,c:'proc',t:'Data Guard standby',s:'other AD or Region',d:'A standby DB system associated with the primary, with switchover and failover from the console.',why:'A standby does not replace backups.',chk:`oci db data-guard-association list --database-id <ocid>`,see:[1,4,'Scaling, Data Guard and high availability']}],
 steps:[
 {ids:['app','sub','node'],t:'1. Applications reach the database through the client subnet, subject to the security rules.',w:'Network design is the first access control.',s:'NSG, security list.',x:'Port 1521 open to the world.',c:`lsnrctl status`},
 {ids:['node','db','asm'],t:'2. The node runs the database on ASM storage. Changes are written to redo and data files.',w:'It is a normal Oracle database.',s:'Shape, storage size.',x:'Storage full stops the database.',c:`SELECT name, free_mb FROM v$asm_diskgroup;`},
 {ids:['db','obj'],t:'3. Backups are taken by RMAN to Object Storage through the backup subnet, on the schedule set by the service.',w:'The service automates the commands.',s:'Retention, window.',x:'Backup path blocked.',c:`oci db backup list --database-id <ocid>`},
 {ids:['db'],t:'4. A patch is prechecked and applied to the Grid and database homes, ideally to a new home.',w:'Out-of-place gives a quick fallback.',s:'Precheck, home.',x:'No backup before applying.',c:`SELECT patch_id, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 3 ROWS ONLY;`},
 {ids:['dg'],t:'5. A standby is created in another AD or Region and kept in step. Switchover and failover are driven by the service.',w:'Protection from AD or Region loss.',s:'Protection mode.',x:'Never testing a switchover.',c:`SELECT name, value FROM v$dataguard_stats;`}]}},

{h:'3. Autonomous Database connection and automation'},
{map:{title:'Autonomous map',h:328,trace:'Connect, load and scale',
 hint:'Tap any box, or press Connect, load and scale to follow a client from the wallet to the data and what the platform automates.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'cli',x:21,y:24,w:194,h:56,c:'ext',t:'Client and wallet',s:'mTLS or TLS',d:'A tool or application with the wallet (or a TLS trust) and a service name.',why:'The wallet is a credential. Protect it.',chk:`export TNS_ADMIN=/opt/wallet; sqlplus app_user@sales_tp`,see:[2,2,'Connecting: wallets, TLS and network access']},
 {id:'net',x:243,y:24,w:194,h:56,c:'net',t:'Network access',s:'ACL or private endpoint',d:'A public endpoint restricted by an access control list, or a private endpoint in your VCN.',why:'Set it before you distribute connection details.',chk:`oci db autonomous-database get --autonomous-database-id <ocid> --query 'data."whitelisted-ips"'`,see:[2,2,'Connecting: wallets, TLS and network access']},
 {id:'svc',x:465,y:24,w:194,h:56,c:'proc',t:'Service and consumer group',s:'high, medium, low, tp',d:'The service name decides the resource group, priority and parallelism.',why:'Use LOW for batch and TP for transactions.',chk:`SELECT service_name FROM v$services;`,see:[2,4,'Scaling, consumer groups and performance']},
 {id:'adb',x:21,y:136,w:194,h:56,c:'proc',t:'Autonomous Database',s:'PDB on Exadata',d:'Your database, tuned and patched by the platform.',why:'You manage schema, SQL and users.',chk:`SELECT name, open_mode FROM v$database;`,see:[2,0,'What Autonomous means']},
 {id:'load',x:243,y:136,w:194,h:56,c:'proc',t:'DBMS_CLOUD',s:'files via Object Storage',d:'Data arrives from a bucket with COPY_DATA or external tables.',why:'No server file system.',chk:`SELECT * FROM user_load_operations;`,see:[2,3,'Loading and moving data with DBMS_CLOUD']},
 {id:'auto',x:465,y:136,w:194,h:56,c:'mem',t:'Automation',s:'indexing, scaling, patching',d:'Automatic indexing, statistics, scaling and patching run in the background.',why:'Review auto indexes and maintenance windows.',chk:`SELECT * FROM dba_auto_index_executions FETCH FIRST 5 ROWS ONLY;`,see:[2,4,'Scaling, consumer groups and performance']},
 {id:'bak',x:126,y:248,w:200,h:56,c:'disk',t:'Automatic backups',s:'daily, about 60 days',d:'Backups are taken and kept without a schedule from you.',why:'Restore returns the same database to a point in time.',chk:`oci db autonomous-database-backup list --autonomous-database-id <ocid>`,see:[2,5,'Backups, clones and Autonomous Data Guard']},
 {id:'cln',x:354,y:248,w:200,h:56,c:'proc',t:'Clones and standby',s:'on request',d:'Clones for test and reporting, and Autonomous Data Guard for failover.',why:'Neither is a backup.',chk:`oci db autonomous-database create-from-clone ...`,see:[2,5,'Backups, clones and Autonomous Data Guard']}],
 steps:[
 {ids:['cli','net'],t:'1. A client connects with the wallet to the endpoint. The ACL or private endpoint decides whether it may reach it at all.',w:'Network first, then authentication.',s:'ACL, private endpoint.',x:'Timeouts mean the network, not the database.',c:`nc -zv <adb-host> 1522`},
 {ids:['svc','adb'],t:'2. The service name maps the session to a consumer group, and the session runs in the database.',w:'Priority is chosen by the name you connect to.',s:'Service name.',x:'Everything on HIGH queues.',c:`SELECT sys_context('USERENV','SERVICE_NAME') FROM dual;`},
 {ids:['load'],t:'3. Data is loaded from Object Storage with DBMS_CLOUD, and the load views show the result.',w:'Files come from buckets, not disks.',s:'Credentials, file format.',x:'Missing credential or bad file format.',c:`SELECT table_name, status, rows_loaded FROM user_load_operations;`},
 {ids:['auto'],t:'4. Auto scaling adds compute under load, and automatic indexing and statistics maintain performance.',w:'It reduces tuning work.',s:'Auto scaling setting.',x:'Unbounded auto scaling without a budget.',c:`SELECT * FROM v$resource_limit FETCH FIRST 5 ROWS ONLY;`},
 {ids:['bak','cln'],t:'5. Backups run daily on their own. You create clones and standbys by request.',w:'Protection and copies are services.',s:'Retention, clone type.',x:'Treating a clone as a backup.',c:`oci db autonomous-database list-backups --autonomous-database-id <ocid>`}]}},

{h:'4. Migration paths to the cloud'},
{map:{title:'Migration paths map',h:328,trace:'Move with minimal downtime',
 hint:'Tap any box, or press Move with minimal downtime to follow an assessment, a data move and a cut-over.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'src',x:21,y:24,w:194,h:56,c:'ext',t:'Source database',s:'on-premises or other cloud',d:'The existing database: size, version, platform, options and dependencies.',why:'Collect real numbers: size, change rate and downtime allowed.',chk:`SELECT version_full, platform_name FROM v$instance, v$database;`,see:[4,0,'Choosing a migration method to the cloud']},
 {id:'ass',x:243,y:24,w:194,h:56,c:'mem',t:'Assess',s:'advisor tools',d:'Run the migration advisor for the target and a feature usage report.',why:'It finds unsupported features early.',chk:`java -jar premigration.jar --connectstring ...`,see:[4,0,'Choosing a migration method to the cloud']},
 {id:'pick',x:465,y:24,w:194,h:56,c:'mem',t:'Pick the method',s:'downtime and platform',d:'Data Pump, physical standby, ZDM, GoldenGate or DMS, according to size, downtime and platform.',why:'Document why.',chk:`SELECT endian_format FROM v$transportable_platform WHERE platform_name = (SELECT platform_name FROM v$database);`,see:[4,0,'Choosing a migration method to the cloud']},
 {id:'mov',x:21,y:136,w:194,h:56,c:'proc',t:'Move the data',s:'copy or standby',d:'Create the target and load it, or build a standby, with the bulk copy done while production runs.',why:'Measure the time on a rehearsal.',chk:`expdp system schemas=APP directory=DP_DIR dumpfile=app_%U.dmp parallel=4`,see:[4,1,'Data Pump to the cloud']},
 {id:'syn',x:243,y:136,w:194,h:56,c:'proc',t:'Synchronise',s:'redo or replication',d:'Keep the target in step until the cut-over.',why:'Watch lag and slot or redo retention.',chk:`SELECT name, value FROM v$dataguard_stats;`,see:[4,2,'Data Guard and ZDM for low-downtime migration']},
 {id:'cut',x:465,y:136,w:194,h:56,c:'warn',t:'Cut over',s:'switchover or switch',d:'Stop writes, finish synchronisation, switch the application.',why:'Only this step is downtime.',chk:`SELECT database_role FROM v$database;`,see:[4,6,'Practical: Plan a migration and a DR design']},
 {id:'fb',x:126,y:248,w:200,h:56,c:'proc',t:'Fallback',s:'reverse path',d:'Keep the source and, if needed, reverse replication until the new system is proven.',why:'Agree the criteria for going back.',chk:`-- reverse redo or replication to the old system`,see:[4,3,'GoldenGate and DMS for near-zero downtime']},
 {id:'dr',x:354,y:248,w:200,h:56,c:'proc',t:'DR for the target',s:'standby and backups',d:'Add the standby or replica and the backup policy, then test them.',why:'A migration is not finished until the new system is protected.',chk:`oci db data-guard-association list --database-id <ocid>`,see:[4,4,'Disaster recovery in the cloud']}],
 steps:[
 {ids:['src','ass'],t:'1. Inventory the source and run the target\'s assessment tool.',w:'Problems found now are cheap.',s:'Advisor output.',x:'Skipping assessment for a deadline.',c:`SELECT * FROM dba_feature_usage_statistics WHERE detected_usages > 0 FETCH FIRST 10 ROWS ONLY;`},
 {ids:['pick'],t:'2. Choose the method from size, downtime and platform, and write down the reasons.',w:'It makes the plan reviewable.',s:'Downtime requirement.',x:'Choosing by tool familiarity.',c:`SELECT ROUND(SUM(bytes)/1024/1024/1024) AS gb FROM dba_segments;`},
 {ids:['mov','syn'],t:'3. Move the data and synchronise until the lag is near zero. Rehearse and time it.',w:'The rehearsal gives the window.',s:'Bandwidth, parallelism.',x:'No rehearsal.',c:`SELECT name, value FROM v$dataguard_stats;`},
 {ids:['cut'],t:'4. At the window stop writes, finish synchronisation, switch the application and verify.',w:'The shortest possible outage.',s:'Application stop procedure.',x:'A forgotten writer.',c:`SELECT COUNT(*) FROM v$session WHERE type = 'USER';`},
 {ids:['fb','dr'],t:'5. Keep the fallback for the agreed period, then protect the new system with DR and backups and decommission the source.',w:'A safe finish.',s:'Fallback criteria.',x:'Removing the source too early.',c:`RMAN> LIST BACKUP SUMMARY;`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Five small maps of how something happens, step by step: creating and protecting a DB system, loading Autonomous, switching roles, a ZDM migration and an RDS import.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Create a Base Database and protect it'},
{map:{title:'Create and protect map',h:216,trace:'Create, back up and fail over',
 hint:'Tap any box, or press Create, back up and fail over to follow the build and protection of a DB system.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'net',x:21,y:24,w:194,h:56,c:'net',t:'Network',s:'VCN, subnets, NSG',d:'Prepare subnets and rules for the client and backup paths.',why:'Hard to change later.',chk:`oci network vcn list --compartment-id <ocid>`,see:[1,1,'Creating and connecting to a DB system']},
 {id:'create',x:243,y:24,w:194,h:56,c:'proc',t:'Create DB system',s:'shape, edition, storage',d:'Launch the DB system with edition, version, storage management and admin password.',why:'Some choices are permanent.',chk:`oci db system launch ...`,see:[1,1,'Creating and connecting to a DB system']},
 {id:'conn',x:465,y:24,w:194,h:56,c:'ext',t:'Connect and check',s:'SSH and SQL',d:'Connect, check the database, listener, ARCHIVELOG and encryption.',why:'Prove it before handing over.',chk:`SELECT log_mode FROM v$database;`,see:[1,1,'Creating and connecting to a DB system']},
 {id:'bak',x:21,y:136,w:194,h:56,c:'disk',t:'Backup and test restore',s:'manual backup',d:'Take a manual backup and create a database from it.',why:'A backup is proven only by a restore.',chk:`oci db backup create --database-id <ocid> --display-name first`,see:[1,2,'Backups, restore and recovery with Object Storage']},
 {id:'std',x:243,y:136,w:194,h:56,c:'proc',t:'Standby',s:'Data Guard association',d:'Create a standby in another AD or Region.',why:'Pick the protection mode.',chk:`oci db data-guard-association create ...`,see:[1,4,'Scaling, Data Guard and high availability']},
 {id:'sw',x:465,y:136,w:194,h:56,c:'warn',t:'Switchover test',s:'with the application',d:'Switch roles and reconnect the application, then switch back.',why:'Record the time.',chk:`oci db data-guard-association switchover ...`,see:[1,6,'Practical: Create, back up and fail over a DB system']}],
 steps:[
 {ids:['net','create'],t:'1. Prepare the network and create the DB system with the right edition and storage.',w:'These are the hard-to-change choices.',s:'Shape, edition, VCN.',x:'A public subnet by habit.',c:`oci db system list --compartment-id <ocid>`},
 {ids:['conn'],t:'2. Connect and check the database state and security basics.',w:'Verification before use.',s:'Listener, TDE wallet.',x:'Skipping the checks.',c:`SELECT name, open_mode, log_mode FROM v$database;`},
 {ids:['bak'],t:'3. Back up and create a new database from the backup to prove restore.',w:'Evidence for recovery.',s:'Retention.',x:'Never testing restore.',c:`oci db backup list --database-id <ocid>`},
 {ids:['std','sw'],t:'4. Add a standby, switch over with the application and switch back, recording times.',w:'You learn the real RTO.',s:'Protection mode.',x:'A standby never exercised.',c:`SELECT database_role, switchover_status FROM v$database;`}]}},

{h:'2. Load data into Autonomous Database'},
{map:{title:'Load data map',h:216,trace:'Load a file with DBMS_CLOUD',
 hint:'Tap any box, or press Load a file with DBMS_CLOUD to follow a file from a bucket into a table and its check.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'up',x:21,y:24,w:194,h:56,c:'ext',t:'Upload file',s:'to a bucket',d:'Put the file in an Object Storage bucket.',why:'Use a private bucket.',chk:`oci os object put --bucket-name loads --file sales.csv`,see:[2,3,'Loading and moving data with DBMS_CLOUD']},
 {id:'cred',x:243,y:24,w:194,h:56,c:'proc',t:'Credential',s:'auth token or principal',d:'Create a database credential that can read the bucket.',why:'Prefer resource principals where possible.',chk:`EXEC DBMS_CLOUD.CREATE_CREDENTIAL('OBJ_CRED', 'user', '<token>');`,see:[2,3,'Loading and moving data with DBMS_CLOUD']},
 {id:'copy',x:465,y:24,w:194,h:56,c:'proc',t:'COPY_DATA',s:'into a table',d:'Run COPY_DATA with the file URI and format options.',why:'The target table must exist.',chk:`EXEC DBMS_CLOUD.COPY_DATA(...);`,see:[2,3,'Loading and moving data with DBMS_CLOUD']},
 {id:'chk',x:21,y:136,w:194,h:56,c:'mem',t:'Check the load',s:'views and logs',d:'Read the load operation views and the log and bad file tables.',why:'Always check after a load.',chk:`SELECT * FROM user_load_operations ORDER BY start_time DESC;`,see:[2,3,'Loading and moving data with DBMS_CLOUD']},
 {id:'fix',x:243,y:136,w:194,h:56,c:'proc',t:'Fix and reload',s:'format or data',d:'Correct the file or the format options and run again.',why:'Use a staging table.',chk:`TRUNCATE TABLE sales_stage;`,see:[2,7,'Practical: Create an Autonomous Database and load data']},
 {id:'use',x:465,y:136,w:194,h:56,c:'ext',t:'Use the data',s:'query',d:'Query and index as needed. Check automatic indexing.',why:'Gather statistics for big loads if needed.',chk:`SELECT COUNT(*) FROM sales;`,see:[2,4,'Scaling, consumer groups and performance']}],
 steps:[
 {ids:['up','cred'],t:'1. Upload the file and create the credential that lets the database read it.',w:'Access is through a credential, not a path.',s:'IAM policy, token.',x:'Access denied from a missing policy.',c:`SELECT credential_name FROM user_credentials;`},
 {ids:['copy'],t:'2. Run COPY_DATA with the URI and format.',w:'One call loads the file.',s:'Format options.',x:'Wrong delimiter or date format.',c:`SELECT COUNT(*) FROM sales;`},
 {ids:['chk','fix'],t:'3. Check the load views. Fix any errors and reload.',w:'Silent bad rows are worse than a failed load.',s:'Log and bad tables.',x:'Ignoring the bad file table.',c:`SELECT table_name, status, rows_loaded FROM user_load_operations;`},
 {ids:['use'],t:'4. Use the data and review automatic indexing and performance.',w:'The platform tunes, you verify.',s:'Service name.',x:'Wrong consumer group.',c:`SELECT * FROM dba_auto_index_config;`}]}},

{h:'3. Switchover and failover'},
{map:{title:'Switchover map',h:216,trace:'Switch roles in the cloud',
 hint:'Tap any box, or press Switch roles in the cloud to follow a planned role change and an unplanned failover.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'chk',x:21,y:24,w:194,h:56,c:'mem',t:'Check the standby',s:'lag and status',d:'Confirm the standby is in step and healthy.',why:'It tells you whether data loss is possible.',chk:`SELECT name, value FROM v$dataguard_stats;`,see:[1,4,'Scaling, Data Guard and high availability']},
 {id:'plan',x:243,y:24,w:194,h:56,c:'ext',t:'Plan and notify',s:'window and users',d:'Agree the window, notify users and pause jobs.',why:'A switchover is clean, applications still reconnect.',chk:`SELECT COUNT(*) FROM v$session WHERE type = 'USER';`,see:[4,4,'Disaster recovery in the cloud']},
 {id:'sw',x:465,y:24,w:194,h:56,c:'warn',t:'Switchover',s:'console or CLI',d:'Run the switchover. Roles swap with no data loss.',why:'Use it for drills and planned work.',chk:`oci db data-guard-association switchover ...`,see:[1,4,'Scaling, Data Guard and high availability']},
 {id:'rec',x:21,y:136,w:194,h:56,c:'mem',t:'Reconnect',s:'applications',d:'Applications reconnect through role-based services or a two-site connect descriptor.',why:'Without it the application stays down.',chk:`SELECT name FROM v$active_services;`,see:[4,4,'Disaster recovery in the cloud']},
 {id:'fo',x:243,y:136,w:194,h:56,c:'warn',t:'Failover',s:'unplanned',d:'If the primary is lost, fail over to the standby. Some data loss is possible.',why:'The decision is a business one.',chk:`oci db data-guard-association failover ...`,see:[4,4,'Disaster recovery in the cloud']},
 {id:'ver',x:465,y:136,w:194,h:56,c:'mem',t:'Verify and re-protect',s:'new standby',d:'Verify the application, then rebuild or reinstate a standby.',why:'Without a standby you have no protection.',chk:`SELECT database_role FROM v$database;`,see:[4,6,'Practical: Plan a migration and a DR design']}],
 steps:[
 {ids:['chk','plan'],t:'1. Check lag and status and plan the window.',w:'Preparation prevents surprises.',s:'Standby health.',x:'Switching with a lagging standby.',c:`SELECT * FROM v$dataguard_stats;`},
 {ids:['sw','rec'],t:'2. Switch over and let the applications reconnect.',w:'Zero data loss role change.',s:'Role-based service.',x:'Hard-coded host names.',c:`SELECT database_role FROM v$database;`},
 {ids:['fo'],t:'3. For an unplanned loss, fail over to the standby after confirming the primary is not coming back.',w:'The standby becomes the primary.',s:'Decision criteria.',x:'Failing over too early.',c:`SELECT open_mode FROM v$database;`},
 {ids:['ver'],t:'4. Verify the application and rebuild the missing standby.',w:'Return to a protected state.',s:'Reinstate or recreate.',x:'Staying unprotected.',c:`SELECT name, value FROM v$dataguard_stats;`}]}},

{h:'4. Physical online migration with ZDM'},
{map:{title:'ZDM migration map',h:216,trace:'Migrate with Zero Downtime Migration',
 hint:'Tap any box, or press Migrate with Zero Downtime Migration to follow an evaluated, paused and switched migration.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'rsp',x:21,y:24,w:194,h:56,c:'ext',t:'Response file',s:'source, target, method',d:'Describe the source, target and method in a response file.',why:'It is the plan as code.',chk:`cat physical_online.rsp`,see:[4,2,'Data Guard and ZDM for low-downtime migration']},
 {id:'eval',x:243,y:24,w:194,h:56,c:'mem',t:'Evaluate',s:'prechecks',d:'Run the job in evaluation mode to check prerequisites.',why:'Fix findings before the real run.',chk:`zdmcli migrate database ... -eval`,see:[4,2,'Data Guard and ZDM for low-downtime migration']},
 {id:'dg',x:465,y:24,w:194,h:56,c:'proc',t:'Build the standby',s:'backup and restore',d:'ZDM builds the target as a standby of the source and synchronises it.',why:'Time depends on size and bandwidth.',chk:`zdmcli query job -jobid 17`,see:[4,2,'Data Guard and ZDM for low-downtime migration']},
 {id:'test',x:21,y:136,w:194,h:56,c:'mem',t:'Test the target',s:'pause point',d:'Pause before switchover and test the target and the application.',why:'The best moment to find issues.',chk:`zdmcli migrate database ... -pauseafter ZDM_CONFIGURE_DG_SRC`,see:[4,6,'Practical: Plan a migration and a DR design']},
 {id:'sw',x:243,y:136,w:194,h:56,c:'warn',t:'Switchover',s:'cut-over',d:'Resume the job to switch over and finish.',why:'The only downtime.',chk:`zdmcli resume job -jobid 17`,see:[4,2,'Data Guard and ZDM for low-downtime migration']},
 {id:'fin',x:465,y:136,w:194,h:56,c:'proc',t:'Finish and protect',s:'DR and backups',d:'Add the standby and backups for the new primary and retire the source after the fallback period.',why:'A migration ends with protection.',chk:`oci db backup list --database-id <ocid>`,see:[4,5,'Backup strategy in the cloud']}],
 steps:[
 {ids:['rsp','eval'],t:'1. Write the response file and run an evaluation. Fix every finding.',w:'Prechecks are cheap.',s:'Source and target connectivity.',x:'Skipping evaluation.',c:`zdmcli migrate database ... -eval`},
 {ids:['dg'],t:'2. Run the migration. ZDM builds and synchronises the standby.',w:'The long copy runs while production works.',s:'Bandwidth and parallelism.',x:'A slow network link.',c:`zdmcli query job -jobid 17`},
 {ids:['test'],t:'3. Pause, test the target and the application.',w:'No surprises at cut-over.',s:'Pause points.',x:'Not using the pause.',c:`SELECT open_mode FROM v$database;`},
 {ids:['sw','fin'],t:'4. Resume to switch over, then protect and verify the new system.',w:'Switchover is minutes.',s:'Fallback criteria.',x:'No fallback plan.',c:`SELECT database_role FROM v$database;`}]}},

{h:'5. Import a schema into RDS for Oracle'},
{map:{title:'RDS import map',h:216,trace:'Import with Data Pump and S3',
 hint:'Tap any box, or press Import with Data Pump and S3 to follow the dump file from the source to an RDS database.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'opt',x:21,y:24,w:194,h:56,c:'proc',t:'Option group',s:'S3_INTEGRATION',d:'Create an option group with S3 integration and attach it with an IAM role.',why:'The role needs bucket access.',chk:`aws rds add-option-to-option-group --option-group-name orcl-opts --options OptionName=S3_INTEGRATION`,see:[3,6,'Practical: Create RDS for Oracle and import a schema']},
 {id:'exp',x:243,y:24,w:194,h:56,c:'proc',t:'Export',s:'on the source',d:'Run Data Pump export on the source with parallel dump files.',why:'Exclude objects the target does not support.',chk:`expdp system schemas=APP directory=DP_DIR dumpfile=app_%U.dmp parallel=4`,see:[4,1,'Data Pump to the cloud']},
 {id:'up',x:465,y:24,w:194,h:56,c:'proc',t:'Upload to S3',s:'bucket',d:'Copy the dump files to an S3 bucket.',why:'Use encryption and a private bucket.',chk:`aws s3 cp /u01/dp/ s3://my-dumps/exp/ --recursive`,see:[3,6,'Practical: Create RDS for Oracle and import a schema']},
 {id:'dl',x:21,y:136,w:194,h:56,c:'proc',t:'Download to the instance',s:'DATA_PUMP_DIR',d:'Use the rdsadmin S3 task to download the files into the instance directory.',why:'Check the task log.',chk:`SELECT rdsadmin.rdsadmin_s3_tasks.download_from_s3(...) FROM dual;`,see:[3,6,'Practical: Create RDS for Oracle and import a schema']},
 {id:'imp',x:243,y:136,w:194,h:56,c:'proc',t:'Import',s:'DBMS_DATAPUMP',d:'Run the import using the Data Pump API.',why:'Remap tablespaces and schemas as needed.',chk:`BEGIN DBMS_DATAPUMP.OPEN(...); END;`,see:[3,6,'Practical: Create RDS for Oracle and import a schema']},
 {id:'chk',x:465,y:136,w:194,h:56,c:'mem',t:'Check and tidy',s:'log, counts, stats',d:'Read the log, compare counts, gather statistics and recompile invalid objects.',why:'Remove the dump files from the instance to save space.',chk:`SELECT COUNT(*) FROM dba_objects WHERE status = 'INVALID';`,see:[4,1,'Data Pump to the cloud']}],
 steps:[
 {ids:['opt'],t:'1. Prepare the option group and role so the instance can reach S3.',w:'Without it there is no file path.',s:'IAM role, option group.',x:'Option not attached.',c:`aws rds describe-option-groups --option-group-name orcl-opts`},
 {ids:['exp','up'],t:'2. Export and upload the dump files.',w:'Parallel files help speed.',s:'Parallel, compression.',x:'A single huge file.',c:`aws s3 ls s3://my-dumps/exp/`},
 {ids:['dl','imp'],t:'3. Download into the instance directory and import with the API.',w:'The import log stays in the instance directory.',s:'DATA_PUMP_DIR.',x:'Insufficient space.',c:`SELECT * FROM TABLE(rdsadmin.rds_file_util.listdir('DATA_PUMP_DIR'));`},
 {ids:['chk'],t:'4. Check the log and the data, then clean up.',w:'Verification and tidy.',s:'Statistics.',x:'Leaving dumps.',c:`SELECT COUNT(*) FROM dba_tables WHERE owner = 'APP';`}]}},

]},

{t:'Service comparison',d:'The ways to run Oracle in the cloud side by side: access, who patches, who backs up, high availability and typical fit.',see:[[0,2,'The Oracle Database cloud landscape'],[0,1,'The shared responsibility model']],b:[
{t:[['Service','OS access','SYSDBA','Patching','Backups','HA and DR','Typical fit'],['Self-managed VM','Yes','Yes','You','You','You (Data Guard, RAC)','Full control'],['OCI Base Database','Yes','Yes','You schedule, OCI provides','Automatic and manual to Object Storage','RAC on VM, Data Guard association','Lift and shift'],['Exadata Database Service','Yes (VM cluster)','Yes','You (VM cluster), provider (infrastructure)','You or managed backup','RAC, Data Guard','Large and consolidated'],['Autonomous Database','No','No (ADMIN)','Automatic','Automatic, about 60 days','Autonomous Data Guard','New apps, analytics, variable load'],['Amazon RDS for Oracle','No','No (master user)','AWS in window, major by you','Automated and snapshots, PITR','Multi-AZ, read replicas','Oracle in AWS'],['RDS Custom for Oracle','Yes (perimeter)','Yes (perimeter)','You inside the perimeter','Snapshots','Multi-AZ options','Customised packaged apps'],['Oracle Database@hyperscaler','As Exadata or Autonomous','As the service','As the service','As the service','As the service','Exadata near the app']]},
{note:'Capabilities and regional availability change. Confirm in the provider documentation before a design decision.'}
]},
{t:'Commands: OCI CLI, AWS CLI and SQL',d:'The commands used most for databases in the cloud, grouped by service, with the SQL checks that go with them.',see:[[1,7,'Automation with the OCI CLI and Terraform'],[3,2,'RDS for Oracle administration']],b:[
{h:'OCI Base Database and Exadata'},
{code:`oci db system list --compartment-id <ocid>
oci db database list --compartment-id <ocid> --db-system-id <ocid>
oci db backup create --database-id <ocid> --display-name before-release
oci db database restore --database-id <ocid> --timestamp "2026-10-13T14:31:00.000Z"
oci db database patch list --database-id <ocid>
oci db data-guard-association list --database-id <ocid>
oci db cloud-vm-cluster list --compartment-id <ocid>`},
{h:'Autonomous Database'},
{code:`oci db autonomous-database list --compartment-id <ocid>
oci db autonomous-database stop --autonomous-database-id <ocid>
oci db autonomous-database start --autonomous-database-id <ocid>
oci db autonomous-database update --autonomous-database-id <ocid> --compute-count 4
oci db autonomous-database generate-wallet --autonomous-database-id <ocid> --password '********' --file wallet.zip`},
{h:'Amazon RDS for Oracle'},
{code:`aws rds describe-db-instances --query "DBInstances[?Engine=='oracle-ee'].[DBInstanceIdentifier,DBInstanceStatus]"
aws rds create-db-snapshot --db-instance-identifier orcl-prod --db-snapshot-identifier before-release
aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier orcl-prod --target-db-instance-identifier orcl-pitr --restore-time 2026-10-13T14:31:00Z
aws rds reboot-db-instance --db-instance-identifier orcl-prod --force-failover
aws rds download-db-log-file-portion --db-instance-identifier orcl-prod --log-file-name trace/alert_ORCL.log`},
{h:'SQL on any of them'},
{code:`SELECT name, open_mode, log_mode, cdb FROM v$database;
SELECT con_id, name, open_mode FROM v$pdbs;
SELECT patch_id, action, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 5 ROWS ONLY;
SELECT * FROM v$encryption_wallet;`}
]},
{t:'Restrictions by service',d:'What you cannot do on each managed service, and the alternative.',see:[[2,6,'What you cannot do: restrictions and differences'],[3,2,'RDS for Oracle administration']],b:[
{t:[['Task','Autonomous','RDS for Oracle','Base Database'],['OS login','Not available','Not available','opc then oracle'],['SYSDBA','Not available','Not available (rdsadmin package)','Available'],['`ALTER SYSTEM`','Limited list of parameters','Through parameter groups','Full'],['Create tablespaces','Not needed','Allowed with SQL','Allowed'],['`UTL_FILE` on server paths','Use DBMS_CLOUD and Object Storage','Directories and S3 integration','Allowed'],['RMAN','Not available (automatic)','Not available (snapshots)','Available'],['Data Pump','Through Object Storage','DATA_PUMP_DIR with S3 integration','Server directory'],['Install host agents','Not possible','Not possible','Allowed with care'],['Patch timing','Maintenance schedule','Maintenance window','You choose'],['RAC','Built in on the platform','Not offered','Option on VM shapes']]}
]},
{t:'Troubleshooting lookup',d:'Symptom, likely cause and first action for cloud Oracle databases.',see:[[5,1,'Monitoring and diagnostics'],[4,4,'Disaster recovery in the cloud']],b:[
{t:[['Symptom','Likely cause','First action'],['Connection times out','Security rule, route, private endpoint or ACL','Test the port from the client, check NSG and ACL'],['ORA-12154 or ORA-12514','Wrong TNS entry, wrong service name or wallet location','Check `TNS_ADMIN`, service name, listener status'],['ORA-28759 or wallet errors','Wrong or expired wallet','Download a new wallet, check the wallet password'],['Backups failing','Backup subnet cannot reach Object Storage, or agent down','Check the route, service gateway and agent status'],['Standby lag growing','Network, redo rate, standby size','Check `V$DATAGUARD_STATS`, bandwidth and standby CPU'],['Storage full','Data growth, archive logs, undo, temp','Check usage, scale storage, find the consumer'],['Slow after migration','Missing statistics, different parameters, plan change','Gather statistics, compare plans, check service name or class'],['ORA-01031 on Autonomous','Privilege not available to the restricted ADMIN model','Use the documented alternative, check the grant'],['Unexpected bill','Oversized compute, idle databases, backup retention, egress','Cost report by tag, right-size, set budgets']]}
]},
]};
