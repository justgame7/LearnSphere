/* LearnSphere - SQL Server High Availability & DR, Section 04: Always On Availability Groups.
   Lectures 0-5 are core, 6-7 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const arch=M.dg(700,260,[
[10,10,680,240,'Availability group AG_Sales',1],
[30,50,190,70,'Primary replica|read and write|SQLNODE1',2],[255,50,190,70,'Secondary replica|synchronous|SQLNODE2',0],[480,50,190,70,'Secondary replica|asynchronous|SQLDR1',0],
[30,150,190,60,'Databases SalesDB|own storage',0],[255,150,190,60,'Copy of SalesDB|own storage',0],[480,150,190,60,'Copy of SalesDB|own storage',0],
[30,215,640,26,'The primary sends log records to every secondary. Each replica keeps its own copy.',0]],
[[220,85,255,85],[445,85,480,85]]);

const mode=M.dg(700,190,[
[10,20,330,150,'Synchronous commit',1],[25,55,300,30,'Commit waits for secondary log harden',2],[25,95,300,30,'No data loss, adds latency',0],[25,135,300,28,'Allows automatic failover',2],
[360,20,330,150,'Asynchronous commit',1],[375,55,300,30,'Commit does not wait',0],[375,95,300,30,'Possible data loss, no latency cost',2],[375,135,300,28,'Manual (forced) failover only',0]],
[]);

const build=M.dg(700,120,[
[10,25,120,60,'1. WSFC and|prerequisites',0],[150,25,120,60,'2. Enable|Always On,|endpoints',0],[290,25,120,60,'3. Create AG|replicas,|databases',2],[430,25,120,60,'4. Seed|databases',0],[570,25,120,60,'5. Listener|and test',2]],
[[130,55,150,55],[270,55,290,55],[410,55,430,55],[550,55,570,55]]);

const lis=M.dg(700,170,[
[10,25,170,70,'Client connects to|AGListener|not to a node',0],[210,25,170,70,'Listener|virtual name and IP|owned by the primary',2],[410,25,130,70,'Primary|SQLNODE1',2],[570,25,120,70,'After failover|moves to node 2',0],
[10,115,680,40,'Applications keep the same name. Use MultiSubnetFailover=True across subnets.',0]],
[[180,60,210,60],[380,60,410,60],[540,60,570,60]]);

const ro=M.dg(700,200,[
[10,20,170,70,'Report app|ApplicationIntent=|ReadOnly',0],[10,115,170,70,'OLTP app|read and write',0],
[230,60,170,70,'Listener|read-only routing|list',2],[450,20,240,70,'Readable secondary|queries, reports',0],[450,115,240,70,'Primary|read and write',2]],
[[180,55,230,85],[180,150,230,110],[400,85,450,55],[400,110,450,150]]);

const seed=M.dg(700,150,[
[10,25,200,70,'Manual seeding|backup, copy, restore|NORECOVERY, join',0],[250,25,200,70,'Automatic seeding|SQL Server streams|the data over the endpoint',2],[490,25,200,70,'Monitor|sys.dm_hadr_|automatic_seeding',0]],
[]);

/* ---------- 0: Architecture ---------- */
L['mss-ha:3:0']={blocks:[
{p:'An **availability group (AG)** is a set of **user databases** that fail over **together**, between a **primary replica** and one or more **secondary replicas**. Each replica has its **own copy** of the data, so an AG protects against storage failure too.'},
{svg:arch},
{h:'Key terms'},
{t:[['Term','Meaning'],
['**Replica**','An instance that hosts a copy of the AG databases'],
['**Primary replica**','Accepts reads and writes; sends log to secondaries'],
['**Secondary replica**','Applies the log; can be readable and used for backups'],
['**Availability database**','A database that is part of the group'],
['**Availability mode**','Synchronous or asynchronous commit'],
['**Failover mode**','Automatic or manual'],
['**Listener**','Virtual network name that clients connect to']]},
{h:'How data flows'},
{flow:['A transaction commits on the primary','Log records are sent to each secondary','Secondary **hardens** the log, then **redoes** it to its data files','In synchronous mode the commit waits for the harden acknowledgement']},
{note:'Limits depend on version and edition. SQL Server 2022 Enterprise supports one primary and up to eight secondaries, with up to five synchronous replicas including the primary. Check the current limits for your version.'}],
src:[['What is an Always On availability group',M.SS+'availability-groups/windows/overview-of-always-on-availability-groups-sql-server'],['Availability modes',M.SS+'availability-groups/windows/availability-modes-always-on-availability-groups']]};

/* ---------- 1: Sync vs async ---------- */
L['mss-ha:3:1']={blocks:[
{p:'The **availability mode** of each replica is the most important design choice. It balances **data loss** against **commit latency**.'},
{svg:mode},
{t:[['','Synchronous commit','Asynchronous commit'],
['**Data loss on failover**','None when synchronized','Possible: unsent log is lost'],
['**Commit latency**','Adds a network round trip and a remote log write','No added latency'],
['**Automatic failover**','Yes, with automatic failover mode','No'],
['**Distance**','Same site or very close','Any distance'],
['**Typical role**','Local HA replica','DR replica in another site']]},
{h:'Typical topology'},
{ul:['**Primary and one synchronous secondary** in the same site for automatic failover.','**One asynchronous secondary** in a remote site for DR.','**Readable secondary** for reports, in either mode.']},
{code:`-- Modes and states of all replicas
SELECT ar.replica_server_name, ar.availability_mode_desc, ar.failover_mode_desc,
       ars.role_desc, ars.synchronization_health_desc
FROM   sys.availability_replicas ar
JOIN   sys.dm_hadr_availability_replica_states ars ON ars.replica_id = ar.replica_id;`},
{note:'Synchronous commit over a long distance can slow every transaction. Measure round-trip time first, and use asynchronous mode for far replicas.'}],
src:[['Availability modes',M.SS+'availability-groups/windows/availability-modes-always-on-availability-groups'],['Failover modes',M.SS+'availability-groups/windows/failover-and-failover-modes-always-on-availability-groups']]};

/* ---------- 2: Building an AG ---------- */
L['mss-ha:3:2']={blocks:[
{p:'You can build an AG with the SSMS wizard or with T-SQL. T-SQL is repeatable and easier to review. Both need the same prerequisites.'},
{svg:build},
{h:'Prerequisites'},
{ul:['A **WSFC** with all replica nodes (for a Windows cluster), same SQL Server version and edition features.','**Always On availability groups** feature enabled on each instance (service restart).','Databases in **FULL** recovery and a **full backup** taken.','A **database mirroring endpoint** on each replica, with CONNECT permission for the service accounts.']},
{code:`-- On every replica: endpoint (default port 5022)
CREATE ENDPOINT Hadr_endpoint STATE = STARTED
  AS TCP (LISTENER_PORT = 5022)
  FOR DATABASE_MIRRORING (ROLE = ALL, AUTHENTICATION = WINDOWS NEGOTIATE, ENCRYPTION = REQUIRED ALGORITHM AES);

-- On the primary
CREATE AVAILABILITY GROUP AG_Sales
  WITH (AUTOMATED_BACKUP_PREFERENCE = SECONDARY, DB_FAILOVER = ON)
  FOR DATABASE SalesDB
  REPLICA ON
    N'SQLNODE1' WITH (ENDPOINT_URL = N'TCP://sqlnode1.contoso.com:5022',
        AVAILABILITY_MODE = SYNCHRONOUS_COMMIT, FAILOVER_MODE = AUTOMATIC, SEEDING_MODE = AUTOMATIC),
    N'SQLNODE2' WITH (ENDPOINT_URL = N'TCP://sqlnode2.contoso.com:5022',
        AVAILABILITY_MODE = SYNCHRONOUS_COMMIT, FAILOVER_MODE = AUTOMATIC, SEEDING_MODE = AUTOMATIC);

-- On each secondary
ALTER AVAILABILITY GROUP AG_Sales JOIN;
ALTER AVAILABILITY GROUP AG_Sales GRANT CREATE ANY DATABASE;`},
{note:'The AG does not copy logins, Agent jobs, linked servers or server settings. Keep them in sync yourself, or use a contained AG (2022).'}],
src:[['Create an availability group',M.SS+'availability-groups/windows/create-an-availability-group-transact-sql'],['Prerequisites and restrictions',M.SS+'availability-groups/windows/prereqs-restrictions-recommendations-always-on-availability']]};

/* ---------- 3: Listeners ---------- */
L['mss-ha:3:3']={blocks:[
{p:'An **availability group listener** is a virtual network name with one or more IP addresses. Clients connect to it, and it always points to the **current primary** (or routes read-only requests).'},
{svg:lis},
{code:`ALTER AVAILABILITY GROUP AG_Sales
  ADD LISTENER N'AGListener' (WITH IP ((N'10.0.0.60', N'255.255.255.0')), PORT = 1433);

-- Connection string
-- Server=tcp:AGListener,1433;Database=SalesDB;MultiSubnetFailover=True;`},
{h:'Client settings'},
{t:[['Setting','Why'],
['**MultiSubnetFailover=True**','Tries all IPs in parallel for fast reconnect across subnets'],
['**ApplicationIntent=ReadOnly**','Asks to be routed to a readable secondary'],
['**Connect Timeout** (longer for multi-subnet)','Gives time for failover'],
['**Retry logic in the application**','Failover drops connections: handle transient errors']]},
{note:'Applications that connect to a node name instead of the listener will break at the next failover. Change connection strings, config files and linked servers to use the listener.'}],
src:[['Availability group listeners',M.SS+'availability-groups/windows/listeners-client-connectivity-application-failover'],['Create or configure a listener',M.SS+'availability-groups/windows/create-or-configure-an-availability-group-listener-sql-server']]};

/* ---------- 4: Readable secondaries ---------- */
L['mss-ha:3:4']={blocks:[
{p:'A **readable secondary** lets you run reports and read-only queries against a replica, taking load off the primary. **Read-only routing** sends such connections there automatically.'},
{svg:ro},
{code:`-- Allow read-only connections on a secondary
ALTER AVAILABILITY GROUP AG_Sales
  MODIFY REPLICA ON N'SQLNODE2' WITH (SECONDARY_ROLE (ALLOW_CONNECTIONS = READ_ONLY));

-- Routing URL and routing list
ALTER AVAILABILITY GROUP AG_Sales
  MODIFY REPLICA ON N'SQLNODE2' WITH (SECONDARY_ROLE (READ_ONLY_ROUTING_URL = N'TCP://sqlnode2.contoso.com:1433'));
ALTER AVAILABILITY GROUP AG_Sales
  MODIFY REPLICA ON N'SQLNODE1' WITH (PRIMARY_ROLE (READ_ONLY_ROUTING_LIST = (N'SQLNODE2')));`},
{h:'What to know'},
{ul:['Readable secondaries use **snapshot isolation** on the secondary, so there is **version store use** in tempdb there.','Queries can see data that lags the primary slightly. It is not suitable for reads that need the very latest data.','**Statistics and indexes** must exist on the primary; temporary statistics are created in tempdb on the secondary.','Readable secondaries need **Enterprise edition** and appropriate licensing.']},
{note:'Heavy reports on a secondary can slow redo and cause lag, which affects recovery time and data loss risk. Monitor redo queue size.'}],
src:[['Configure read-only access to a secondary replica',M.SS+'availability-groups/windows/configure-read-only-access-on-an-availability-replica-sql-server'],['Read-only routing',M.SS+'availability-groups/windows/configure-read-only-routing-for-an-availability-group-sql-server']]};

/* ---------- 5: Automatic seeding ---------- */
L['mss-ha:3:5']={blocks:[
{p:'**Seeding** is how a database gets its initial copy on a secondary. **Automatic seeding** lets SQL Server stream the database over the AG endpoint, so you do not have to take, copy and restore backups by hand.'},
{svg:seed},
{t:[['','Manual','Automatic'],
['**Steps**','Backup, copy, restore WITH NORECOVERY, join','Add the database, SQL Server does the rest'],
['**Control**','Full control, can use existing backups','Less control, uses the endpoint network'],
['**Best for**','Very large databases, slow links, existing copies','Small and medium databases, simple setup'],
['**Needs**','File access between servers','Same file paths or a compatible layout, CREATE ANY DATABASE permission']]},
{code:`-- Check automatic seeding progress
SELECT start_time, completion_time, database_name, current_state, failure_state_desc,
       transferred_size_bytes/1048576 AS transferred_mb, database_size_bytes/1048576 AS size_mb
FROM   sys.dm_hadr_automatic_seeding;`},
{note:'Seeding a large database over a slow link can take a long time and use a lot of bandwidth. For those cases, restore a recent backup yourself and then join, so only the log needs to be sent.'}],
src:[['Automatic seeding',M.SS+'availability-groups/windows/automatically-initialize-always-on-availability-group'],['sys.dm_hadr_automatic_seeding',M.RD+'system-dynamic-management-views/sys-dm-hadr-automatic-seeding-transact-sql']]};

})();
