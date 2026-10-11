/* LearnSphere - SQL Server High Availability & DR, Section 05: AG Operations & Troubleshooting.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const fo=M.dg(700,200,[
[10,20,200,70,'Planned manual failover|synchronized secondary|no data loss',2],[250,20,200,70,'Automatic failover|sync replica, healthy|cluster decides',0],[490,20,200,70,'Forced failover|may lose data|disaster only',2],
[10,115,680,70,'Choose the type by what you know about the secondary: synchronized means safe, unsynchronized means data loss',0]],
[]);

const mon=M.dg(700,190,[
[10,20,200,70,'Send queue|log not yet sent|primary side',0],[250,20,200,70,'Redo queue|log received, not yet|applied on secondary',2],[490,20,200,70,'Commit time lag|last_commit_time|difference',0],
[10,115,680,60,'Send queue size = data you could lose. Redo queue size = time to recover after failover.',0]],
[]);

const bk=M.dg(700,170,[
[10,25,200,70,'Backup preference|set on the AG|PRIMARY, SECONDARY,|SECONDARY ONLY',0],[250,25,200,70,'Check at run time|sys.fn_hadr_backup_|is_preferred_replica',2],[490,25,200,70,'Run backup|same job on every|replica, only one runs',0]],
[[210,60,250,60],[450,60,490,60]]);

const add=M.dg(700,150,[
[10,25,150,70,'Database|FULL recovery|full backup',0],[190,25,150,70,'ADD DATABASE|on primary',2],[370,25,150,70,'Seed|auto or manual',0],[550,25,140,70,'JOIN on|secondary,|verify',2]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

const tr=M.dg(700,170,[
[10,20,150,70,'1. State|dashboard,|DMVs',0],[190,20,150,70,'2. Health|cluster, endpoint,|network',2],[370,20,150,70,'3. Log|error logs,|cluster log',0],[550,20,140,70,'4. Fix and|resume data|movement',2],
[10,110,680,50,'Suspended, disconnected, not synchronizing: each has a few common causes',0]],
[[160,55,190,55],[340,55,370,55],[520,55,550,55]]);

/* ---------- 0: Failover ---------- */
L['mss-ha:4:0']={blocks:[
{p:'**Failover** moves the primary role to a secondary. There are three kinds, and they differ in **data loss risk**.'},
{svg:fo},
{t:[['Type','Requires','Data loss','When'],
['**Planned manual**','Target is synchronous and synchronized','None','Patching, maintenance'],
['**Automatic**','Synchronous replica, automatic failover mode, healthy cluster','None','Failure of the primary'],
['**Forced**','Nothing, you accept the risk','Possible','Primary lost, no synchronized secondary']]},
{code:`-- Planned manual failover: run on the target secondary
ALTER AVAILABILITY GROUP AG_Sales FAILOVER;

-- Forced failover (may lose data): disaster only
ALTER AVAILABILITY GROUP AG_Sales FORCE_FAILOVER_ALLOW_DATA_LOSS;`},
{h:'After a failover'},
{ul:['Check the **new primary** and replica health on the dashboard.','After a **forced failover**, secondaries are **suspended**: review, then **resume** data movement database by database.','Verify **applications** reconnect through the listener, and run smoke tests.','Check **jobs**: some should run only on the primary.']},
{note:'Do not use forced failover while the old primary may still be alive and writing. That causes two diverging copies. Ensure the old primary is down or isolated first.'}],
src:[['Failover and failover modes',M.SS+'availability-groups/windows/failover-and-failover-modes-always-on-availability-groups'],['Perform a planned manual failover',M.SS+'availability-groups/windows/perform-a-planned-manual-failover-of-an-availability-group-sql-server']]};

/* ---------- 1: Monitoring ---------- */
L['mss-ha:4:1']={blocks:[
{p:'An AG can look healthy while it is far behind. Watch **queue sizes** and **synchronization state**, not only a green icon.'},
{svg:mon},
{code:`SELECT ag.name AS ag, ar.replica_server_name, DB_NAME(drs.database_id) AS db,
       drs.synchronization_state_desc, drs.synchronization_health_desc,
       drs.log_send_queue_size AS send_queue_kb, drs.redo_queue_size AS redo_queue_kb,
       drs.log_send_rate, drs.redo_rate, drs.last_commit_time
FROM   sys.dm_hadr_database_replica_states drs
JOIN   sys.availability_replicas ar ON ar.replica_id = drs.replica_id
JOIN   sys.availability_groups   ag ON ag.group_id   = drs.group_id
ORDER  BY ag.name, ar.replica_server_name, db;`},
{t:[['Measure','Meaning','Concern when'],
['**synchronization_state_desc**','SYNCHRONIZED, SYNCHRONIZING, NOT SYNCHRONIZING','Not what you expect for the mode'],
['**log_send_queue_size**','Unsent log in KB','Growing: possible data loss'],
['**redo_queue_size**','Unapplied log in KB','Growing: slower recovery'],
['**last_commit_time**','Last transaction applied','Far behind the primary']]},
{note:'The AG dashboard in SSMS and the built-in policies are a start. Add alerts on queue growth and on role or state changes.'}],
src:[['Monitor availability groups',M.SS+'availability-groups/windows/monitoring-of-availability-groups-sql-server'],['sys.dm_hadr_database_replica_states',M.RD+'system-dynamic-management-views/sys-dm-hadr-database-replica-states-transact-sql']]};

/* ---------- 2: Backups on secondaries ---------- */
L['mss-ha:4:2']={blocks:[
{p:'You can run backups on **secondary replicas** to take load off the primary. The rules are specific, so know what is allowed.'},
{svg:bk},
{t:[['Backup type','On a secondary'],
['**Full**','Only **copy-only** full backups'],
['**Differential**','Not supported in versions before 2025'],
['**Log**','Allowed, regular log backups; the chain stays valid across replicas'],
['**Copy-only log**','Allowed']]},
{code:`-- Backup preference, set on the AG
ALTER AVAILABILITY GROUP AG_Sales SET (AUTOMATED_BACKUP_PREFERENCE = SECONDARY);

-- In every backup job: only run on the preferred replica
IF sys.fn_hadr_backup_is_preferred_replica(N'SalesDB') = 1
  BACKUP LOG SalesDB TO DISK = N'\\\\backupsrv\\sql\\SalesDB_log.trn' WITH CHECKSUM, COMPRESSION;`},
{h:'Important'},
{ul:['Put backup files on a **shared location**: log backups from different replicas form one chain.','Create the **same job** on every replica so a failover does not leave you unprotected.','Backup preference is only a **hint**: your script must test it.','SQL Server 2025 adds more backup types on secondaries: check the release notes for your version.']}],
src:[['Offload supported backups to secondary replicas',M.SS+'availability-groups/windows/active-secondaries-backup-on-secondary-replicas-always-on-availability-groups'],['sys.fn_hadr_backup_is_preferred_replica',M.RD+'system-functions/sys-fn-hadr-backup-is-preferred-replica-transact-sql']]};

/* ---------- 3: Adding databases and replicas ---------- */
L['mss-ha:4:3']={blocks:[
{p:'An AG grows over time. Adding a **database** or a **replica** follows a clear sequence.'},
{svg:add},
{h:'Add a database'},
{code:`-- Database must be FULL recovery with a full backup
ALTER AVAILABILITY GROUP AG_Sales ADD DATABASE NewDB;

-- With manual seeding: restore WITH NORECOVERY on the secondary, then
ALTER DATABASE NewDB SET HADR AVAILABILITY GROUP = AG_Sales;`},
{h:'Add a replica'},
{flow:['Install SQL Server and enable Always On, create the endpoint','Add the replica with ALTER AVAILABILITY GROUP ... ADD REPLICA ON','Join the new replica and grant CREATE ANY DATABASE (automatic seeding)','Add routing and backup preferences, create logins and jobs','Run a test failover to confirm']},
{note:'Server-level objects such as logins, Agent jobs and linked servers are not part of the AG. Keep them aligned with a script or tool, or use a contained AG.'}],
src:[['Add a database to an availability group',M.SS+'availability-groups/windows/add-a-database-to-an-availability-group-sql-server'],['Add a replica',M.SS+'availability-groups/windows/add-a-secondary-replica-to-an-availability-group-sql-server']]};

/* ---------- 4: Troubleshooting ---------- */
L['mss-ha:4:4']={blocks:[
{p:'AG problems show up as a handful of states. Match the state to the usual causes and check in order.'},
{svg:tr},
{t:[['State','Common causes','Check'],
['**NOT SYNCHRONIZING / disconnected**','Endpoint down, firewall, certificate or permissions, cluster issue','Endpoint state, port 5022, service account CONNECT'],
['**SUSPENDED**','Manual suspend, error on redo, disk full on secondary','`suspend_reason_desc`, secondary disk and error log'],
['**Log not truncating on primary**','Secondary behind, `AVAILABILITY_REPLICA` wait','`log_reuse_wait_desc`, redo and send queues'],
['**Cannot failover**','Not synchronized, cluster quorum, role mismatch','Replica states, WSFC state'],
['**Listener not reachable**','Network name offline, DNS, wrong subnet','Cluster resources, DNS records']]},
{code:`SELECT DB_NAME(database_id) AS db, is_suspended, suspend_reason_desc, synchronization_state_desc
FROM   sys.dm_hadr_database_replica_states WHERE is_local = 1;

-- Resume data movement
ALTER DATABASE SalesDB SET HADR RESUME;

SELECT name, log_reuse_wait_desc FROM sys.databases WHERE name = 'SalesDB';`},
{note:'Do not remove a database from the AG just because it is suspended. Find out why. Removing and re-adding can take hours for a large database.'}],
src:[['Troubleshoot AG configuration',M.SS+'availability-groups/windows/troubleshoot-always-on-availability-groups-configuration-sql-server'],['Troubleshoot AG data movement',M.SS+'availability-groups/windows/troubleshoot-always-on-availability-groups-configuration-sql-server']]};

})();
