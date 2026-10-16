/* LearnSphere - MySQL, Section 15: Replication.
   Lectures 0-7 are core. Needs mysql-common.js. Uses the MySQL 8.4 terminology (source, replica). Commands written from product knowledge, not run against a server. */
(function(){
const K=window.MY,L=window.LESSONS;

const flowd=K.dg(700,260,[
[10,10,680,240,'Asynchronous replication',1],
[25,45,250,170,'Source|clients write|transaction commits|binary log written',2],[425,45,250,170,'Replica|receiver thread writes relay log|applier threads execute it|replica data',2],
[290,65,120,54,'Binlog dump|thread sends|events',0],[290,140,120,44,'Relay log|local copy',0]],
[[275,92,290,92],[410,92,425,92],[350,119,350,140],[410,162,425,162]]);

const gtid=K.dg(700,170,[
[10,10,680,150,'GTID = source_uuid : transaction_id',1],
[25,60,200,50,'3E11FA47-71CA-11E1-...|server that first committed',0],[255,60,120,50,': 23|sequence number',2],[405,60,270,50,'gtid_executed on the replica|3E11FA47-...:1-23',0]],
[[225,85,255,85],[375,85,405,85]]);

const lag=K.dg(700,190,[
[10,10,680,170,'Where replication lag can appear',1],
[25,60,120,50,'Source|commit',0],[175,60,120,50,'Network|send events',0],[325,60,130,50,'Receiver|relay log write',0],[485,60,190,50,'Applier|execute in parallel or alone',2],
[25,125,650,36,'Lag: time between commit on the source and apply on the replica.',0]],
[[145,85,175,85],[295,85,325,85],[455,85,485,85]]);

const topo=K.dg(700,260,[
[10,10,680,240,'Common topologies',1],
[25,45,200,80,'Source with replicas|read scaling, backups|most common',2],[250,45,200,80,'Chain|source, replica, replica of replica|needs log_replica_updates',0],[475,45,200,80,'Multi-source|one replica, several sources|channels',0],
[25,145,200,80,'Delayed replica|deliberately behind|protection from mistakes',0],[250,145,200,80,'Cross-region replica|disaster recovery|higher latency',0],[475,145,200,80,'Group Replication|next section|automatic failover',0]],[]);

/* ---------- 0 ---------- */
L['mysql:14:0']={blocks:[
{p:'**Replication** copies data changes from one MySQL server, the **source**, to one or more others, the **replicas**. It provides read scaling, a hot copy for backups and reporting, a base for failover and a safety net against hardware loss. It is the foundation of every high availability design in the next section.'},
{svg:flowd},
{h:'How it works'},
{flow:['A client commits a transaction on the source','The source writes the change to its **binary log**','A **binlog dump** thread on the source sends new events to each connected replica','The replica **receiver** (I/O) thread writes them to a local **relay log**','One or more **applier** (SQL) threads read the relay log and apply the changes to the replica data']},
{t:[['Component','Role'],
['Binary log (source)','Ordered record of committed changes'],
['Binlog dump thread (source)','One per connected replica, sends events'],
['Receiver thread (replica)','Connects to the source, copies events'],
['Relay log (replica)','Buffer between receive and apply'],
['Applier threads (replica)','Replay the events. Several in parallel in modern setups'],
['Replication metadata','Stored in `mysql` tables, crash safe']]},
{h:'Terminology'},
{p:'Current terms are **source** and **replica**. The old words (master, slave) and the matching statements were **removed in MySQL 8.4**: use `CHANGE REPLICATION SOURCE TO`, `START REPLICA`, `SHOW REPLICA STATUS`, `SHOW BINARY LOG STATUS` and variables named `source_*` and `replica_*`.'},
{h:'Properties'},
{ul:['**Asynchronous** by default: the source does not wait for replicas. A failure can lose transactions that were not yet sent. Semi-synchronous options reduce this.','Replicas are **eventually consistent**. A read right after a write may not see it.','Each server needs a unique `server_id`.','Replication is **not** a backup: harmful changes replicate too.','Replicas can have different indexes, storage and settings, which is useful for reporting.']},
{h:'Typical uses'},
{ul:['Scale **reads** across several replicas.','Run **backups and heavy reports** on a replica.','Keep a **standby** to promote after a failure.','Replicate to another **region**.','Test an **upgrade** on a replica before touching the source.']},
{note:'Statements that write must go to the source. Replicas should have `read_only = ON` and `super_read_only = ON` to prevent accidental writes that create differences.'}],
src:[['Replication',K.D+'replication.html'],['Replication implementation',K.D+'replication-implementation.html']]};

/* ---------- 1 ---------- */
L['mysql:14:1']={blocks:[
{p:'The **binary log** records every change to data and structure in commit order. Its format decides **what** is written, and that choice affects safety, size and compatibility.'},
{t:[['binlog_format','What is logged','Notes'],
['`ROW` (default)','The actual changed rows, before and after images','Safe and deterministic. Larger for bulk changes. Recommended and required by features such as Group Replication'],
['`STATEMENT`','The SQL text','Small, but some statements are unsafe (non-deterministic functions, `LIMIT` without `ORDER BY`, `UUID()`), so replicas can differ'],
['`MIXED`','Statement by default, switches to row for unsafe cases','A compromise. Not recommended for new designs']]},
{p:'Use **ROW** format. It guarantees the replica makes the same change as the source and works with every other replication feature. Statement-based replication is the cause of many silent inconsistencies.'},
{h:'Row events'},
{code:`SHOW BINARY LOGS;
SHOW BINLOG EVENTS IN 'binlog.000123' LIMIT 10;
mysqlbinlog --base64-output=DECODE-ROWS -vv binlog.000123 | less`},
{p:'In row format an UPDATE appears as an `Update_rows` event with a **before image** and an **after image**. The size is controlled by `binlog_row_image`.'},
{t:[['binlog_row_image','Contains'],
['`FULL` (default)','All columns in both images'],
['`MINIMAL`','Only the primary key (before) and the changed columns (after). Smaller logs, needs a primary key'],
['`NOBLOB`','Full, but leaves out unchanged BLOB and TEXT columns']]},
{h:'Why every table needs a primary key'},
{p:'With row events the replica must **find the row** to change. With a primary key this is one lookup. Without one the replica scans the whole table for every changed row, which makes replication extremely slow on big tables. Set `sql_require_primary_key = ON` on the source to enforce it.'},
{h:'Other settings'},
{t:[['Variable','Notes'],
['`binlog_expire_logs_seconds`','Retention, default 30 days'],
['`max_binlog_size`','Rotation size, default 1 GB'],
['`sync_binlog`','1 (default) flushes at each commit'],
['`binlog_transaction_compression`','Compresses transaction payloads with zstd (8.0.20 and later), saving space and network'],
['`log_replica_updates`','A replica writes events it applies to its own binary log, needed for chains and for failover (default ON)'],
['`binlog_row_metadata`','Extra column metadata in row events']]},
{note:'Large single statements such as `DELETE` of millions of rows produce huge row events and a large transaction that replicas apply only after it commits on the source. Break big changes into batches.'}],
src:[['Binary logging formats',K.D+'replication-formats.html'],['Binary log options and variables',K.D+'replication-options-binary-log.html']]};

/* ---------- 2 ---------- */
L['mysql:14:2']={blocks:[
{p:'This is the basic procedure to start replication from a source to one new replica using binary log coordinates or GTIDs. The later lesson on GTIDs makes the same steps simpler.'},
{h:'1. Configure the source'},
{code:`[mysqld]
server_id = 1
log_bin = binlog
binlog_format = ROW
gtid_mode = ON
enforce_gtid_consistency = ON
sync_binlog = 1
innodb_flush_log_at_trx_commit = 1`},
{code:`CREATE USER 'repl'@'10.0.0.%' IDENTIFIED BY '...' REQUIRE SSL;
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'10.0.0.%';     -- the privilege keeps its historical name`},
{h:'2. Configure the replica'},
{code:`[mysqld]
server_id = 2
relay_log = relay
gtid_mode = ON
enforce_gtid_consistency = ON
read_only = ON
super_read_only = ON
log_replica_updates = ON`},
{h:'3. Copy the data'},
{p:'The replica needs the same data as the source at a known point. Use the **clone plugin** (fastest), a physical backup (XtraBackup), or a consistent dump taken with `--source-data`.'},
{code:`-- on the replica, with the clone plugin
INSTALL PLUGIN clone SONAME 'mysql_clone.so';
SET GLOBAL clone_valid_donor_list = '10.0.0.1:3306';
CLONE INSTANCE FROM 'clone_user'@'10.0.0.1':3306 IDENTIFIED BY '...';   -- restarts the replica`},
{h:'4. Point the replica at the source'},
{code:`CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = '10.0.0.1',
  SOURCE_USER = 'repl',
  SOURCE_PASSWORD = '...',
  SOURCE_SSL = 1,
  SOURCE_AUTO_POSITION = 1;     -- with GTIDs. Otherwise give SOURCE_LOG_FILE and SOURCE_LOG_POS

START REPLICA;
SHOW REPLICA STATUS\\G`},
{h:'5. Verify'},
{t:[['Field in SHOW REPLICA STATUS','Healthy value'],
['`Replica_IO_Running`','Yes'],
['`Replica_SQL_Running`','Yes'],
['`Seconds_Behind_Source`','Small number, or 0'],
['`Last_IO_Error`, `Last_SQL_Error`','Empty'],
['`Retrieved_Gtid_Set`, `Executed_Gtid_Set`','Growing and close to the source `gtid_executed`']]},
{code:`-- on the source
CREATE DATABASE repl_test; USE repl_test; CREATE TABLE t (id INT PRIMARY KEY); INSERT INTO t VALUES (1);
-- on the replica
SELECT * FROM repl_test.t;`},
{note:'The replication password is stored in the `mysql.slave_master_info` table in clear text unless you use an authentication plugin that avoids it. Restrict access to the replica data directory and use a dedicated replication account with only the replication privilege.'}],
src:[['Setting up replication',K.D+'replication-howto.html'],['CHANGE REPLICATION SOURCE TO',K.D+'change-replication-source-to.html']]};

/* ---------- 3 ---------- */
L['mysql:14:3']={blocks:[
{p:'A **GTID (global transaction identifier)** is a unique id for every committed transaction: `source_uuid:sequence`. With GTIDs a replica does not need to know a file name and position. It tells the source which transactions it already has, and the source sends the rest. This makes setup, failover and re-pointing replicas much simpler.'},
{svg:gtid},
{code:`SELECT @@server_uuid;
SELECT @@GLOBAL.gtid_executed;            -- e.g. 3E11FA47-71CA-11E1-9E33-C80AA9429562:1-23
SELECT @@GLOBAL.gtid_purged;              -- GTIDs no longer in the binary logs
SHOW REPLICA STATUS\\G                     -- Retrieved_Gtid_Set, Executed_Gtid_Set`},
{h:'Enabling'},
{ul:['`gtid_mode = ON` and `enforce_gtid_consistency = ON` on every server in the topology.','On a running topology you can change the mode online in steps (`OFF` to `OFF_PERMISSIVE` to `ON_PERMISSIVE` to `ON`), waiting for anonymous transactions to drain.','`enforce_gtid_consistency` blocks statements that cannot be logged safely with GTIDs, for example `CREATE TABLE ... SELECT` in older forms and temporary tables inside transactions.']},
{h:'Auto-positioning'},
{code:`CHANGE REPLICATION SOURCE TO SOURCE_HOST = 'new-source', SOURCE_USER = 'repl', SOURCE_PASSWORD = '...', SOURCE_AUTO_POSITION = 1;
START REPLICA;`},
{p:'With `SOURCE_AUTO_POSITION = 1` the replica sends its `gtid_executed` set and the source streams whatever is missing. After a **failover** you simply repoint the other replicas to the new source. No file and position arithmetic is needed.'},
{h:'Errant transactions'},
{p:'An **errant** transaction is one that exists on a replica but not on the source, usually because someone wrote on the replica. If that replica is later promoted, the others see a GTID they do not have. Detect it before failover:'},
{code:`SELECT GTID_SUBTRACT(@@GLOBAL.gtid_executed, '<source gtid_executed>');   -- non-empty means errant GTIDs`},
{h:'Skipping a failing transaction safely'},
{p:'With GTIDs you cannot use `sql_replica_skip_counter`. Instead, commit an **empty transaction** with the same GTID, so the replica believes it applied it. Understand why it failed first, because a skipped change leaves the replica different from the source.'},
{code:`STOP REPLICA;
SET GTID_NEXT = '3E11FA47-71CA-11E1-9E33-C80AA9429562:24';
BEGIN; COMMIT;
SET GTID_NEXT = 'AUTOMATIC';
START REPLICA;`},
{h:'Benefits and costs'},
{t:[['Benefit','Cost'],
['Simple failover and re-pointing','Every server must use GTIDs'],
['Safe automatic positioning','Restrictions on some statements'],
['Easy tracking of what is applied where','Needs a good habit for errant transactions'],
['Required by Group Replication and InnoDB Cluster','']]}],
src:[['Replication with GTIDs',K.D+'replication-gtids.html'],['GTID concepts',K.D+'replication-gtids-concepts.html']]};

/* ---------- 4 ---------- */
L['mysql:14:4']={blocks:[
{h:'Semi-synchronous replication'},
{p:'In asynchronous replication a commit returns as soon as the source has it. **Semi-synchronous** replication makes the source wait until **at least one replica has received and written** the transaction to its relay log, before returning to the client. A failure of the source then cannot lose an acknowledged transaction that no replica has.'},
{code:`-- source
INSTALL PLUGIN rpl_semi_sync_source SONAME 'semisync_source.so';
SET PERSIST rpl_semi_sync_source_enabled = ON;
SET PERSIST rpl_semi_sync_source_wait_for_replica_count = 1;
SET PERSIST rpl_semi_sync_source_timeout = 10000;      -- ms before falling back to async

-- replica
INSTALL PLUGIN rpl_semi_sync_replica SONAME 'semisync_replica.so';
SET PERSIST rpl_semi_sync_replica_enabled = ON;
STOP REPLICA IO_THREAD; START REPLICA IO_THREAD;

SHOW STATUS LIKE 'Rpl_semi_sync%';`},
{ul:['The default wait point `AFTER_SYNC` makes the transaction durable on a replica **before** it becomes visible to other sessions on the source (lossless).','If no replica acknowledges within the timeout, the source **falls back to asynchronous** mode. The guarantee is therefore not absolute.','It adds a network round trip to every commit, so latency rises.','It guarantees receipt, not that the replica has **applied** the change.']},
{h:'Delayed replication'},
{p:'A **delayed replica** deliberately stays behind by a fixed time. If someone drops a table by mistake, the replica still has the data and you can stop it before the bad change is applied.'},
{code:`STOP REPLICA;
CHANGE REPLICATION SOURCE TO SOURCE_DELAY = 3600;      -- one hour
START REPLICA;
-- recovery: STOP REPLICA; then START REPLICA UNTIL SQL_BEFORE_GTIDS = '...';`},
{p:'Use it as one layer of protection against human error. It does not replace backups.'},
{h:'Multi-source replication'},
{p:'A replica can receive changes from **several sources** at once, each on its own **channel**. It is used for consolidating data from multiple servers into one reporting server.'},
{code:`CHANGE REPLICATION SOURCE TO SOURCE_HOST = 'src1', SOURCE_USER = 'repl', SOURCE_PASSWORD = '...', SOURCE_AUTO_POSITION = 1 FOR CHANNEL 'src1';
CHANGE REPLICATION SOURCE TO SOURCE_HOST = 'src2', SOURCE_USER = 'repl', SOURCE_PASSWORD = '...', SOURCE_AUTO_POSITION = 1 FOR CHANNEL 'src2';
START REPLICA FOR CHANNEL 'src1';
SHOW REPLICA STATUS FOR CHANNEL 'src1'\\G`},
{ul:['Each channel has its own relay log and applier. The data sets of the sources should not conflict (different schemas or key ranges).','Check each channel separately.','Group Replication offers synchronous multi-primary with conflict detection if you need writes in several places.']},
{t:[['Option','Goal','Trade-off'],
['Semi-synchronous','Fewer lost commits on source failure','Latency, fallback to async'],
['Delayed','Recover from human error','Stale data, not for reads'],
['Multi-source','Consolidate several sources','Careful design of conflicts and channels']]}],
src:[['Semisynchronous replication',K.D+'replication-semisync.html'],['Delayed replication',K.D+'replication-delayed.html'],['Multi-source replication',K.D+'replication-multi-source.html']]};

/* ---------- 5 ---------- */
L['mysql:14:5']={blocks:[
{p:'**Replication lag** is the delay between a commit on the source and its application on the replica. Reads from a lagging replica return old data, and a failover can lose the transactions that were not yet applied. Understand where lag comes from and how to reduce it.'},
{svg:lag},
{h:'Parallel appliers'},
{p:'Originally one thread applied all changes, so a busy multi-core source easily outran a replica. Modern replication applies transactions **in parallel**. The source marks which transactions did not conflict, using **commit timestamps or write sets**, and the replica runs those at the same time.'},
{code:`[mysqld]
replica_parallel_workers = 8
replica_parallel_type = LOGICAL_CLOCK
replica_preserve_commit_order = ON         # same commit order as the source
binlog_transaction_dependency_tracking = WRITESET   # on the source. Check the manual for your version`},
{ul:['More workers help only if the workload has independent transactions. A single hot row cannot be parallelised.','`replica_preserve_commit_order = ON` keeps the replica state consistent with a possible state of the source.','Check parallel workers with `performance_schema.replication_applier_status_by_worker`.']},
{h:'Common causes of lag'},
{t:[['Cause','Check','Remedy'],
['Large transactions (bulk deletes, big batches)','Binary log event sizes, long applier time','Break into small batches'],
['Missing primary key on a table','Table scans on the applier','Add a primary key, enable `sql_require_primary_key`'],
['Slow replica storage or too little memory','I/O wait, low buffer pool hit rate','Equal or better hardware than the source'],
['Single-threaded apply','`replica_parallel_workers = 0 or 1`','Enable parallel workers'],
['Heavy reads on the replica competing with the applier','Long queries on the replica','Separate reporting replica, tune queries'],
['Network or distance','Receiver behind, relay log small','Faster link, compression'],
['Long DDL','Applier busy on ALTER','Online DDL, schedule off-peak'],
['Locks held by long transactions on the replica','`data_lock_waits`','Shorten the reads']]},
{h:'Measuring lag'},
{code:`SHOW REPLICA STATUS\\G              -- Seconds_Behind_Source
SELECT * FROM performance_schema.replication_applier_status_by_worker\\G
SELECT * FROM performance_schema.replication_connection_status\\G`},
{p:'`Seconds_Behind_Source` is an approximation. It can show 0 when the receiver is stuck, and it jumps with large transactions. For reliable lag use a **heartbeat**: a table the source updates every second with a timestamp, compared on the replica (`pt-heartbeat`). The Performance Schema also reports **applier and transaction timestamps** more accurately.'},
{h:'Reading your own writes'},
{p:'If an application writes and immediately reads from a replica it may not find the row. Options: read from the source for a short time after a write, route session reads to the source, or wait for the GTID to be applied: `SELECT WAIT_FOR_EXECUTED_GTID_SET(\'uuid:123\', 1)`.'}],
src:[['Replication performance and lag',K.D+'replication-solutions-performance.html'],['Multithreaded replica',K.D+'replication-options-replica.html']]};

/* ---------- 6 ---------- */
L['mysql:14:6']={blocks:[
{p:'Replication problems fall into a few categories. A calm routine beats guessing: read the status, find the cause and choose the safest fix.'},
{h:'Step 1: read the status'},
{code:`SHOW REPLICA STATUS\\G
SELECT * FROM performance_schema.replication_applier_status_by_worker WHERE LAST_ERROR_NUMBER <> 0\\G
SELECT * FROM performance_schema.replication_connection_status\\G`},
{t:[['Symptom','Meaning'],
['`Replica_IO_Running: No` with Last_IO_Error','Cannot connect or read from the source: network, credentials, TLS, firewall, source binary log purged'],
['`Replica_SQL_Running: No` with Last_SQL_Error','The applier hit an error applying an event'],
['Both Yes but `Seconds_Behind_Source` growing','Lag: slow apply'],
['`Replica_IO_Running: Connecting`','Retrying the connection']]},
{h:'Common errors'},
{t:[['Error','Cause','Fix'],
['1062 Duplicate entry','The row already exists on the replica, often from writes on the replica or a bad copy','Find out why they differ. Fix data or skip one transaction, then check consistency'],
['1032 Can\'t find record','The row to update or delete is missing on the replica','Same: investigate drift'],
['1236 Could not find first log file','The source purged binary logs the replica still needs','Rebuild the replica (clone or backup)'],
['1594, 1872','Relay log or metadata corruption','`RESET REPLICA` and reconnect, or rebuild'],
['2003, 1045','Cannot connect, access denied','Network, user, host, password, TLS'],
['Duplicate server_id or server_uuid','A cloned data directory kept the same id','Give each server a unique server_id. Remove `auto.cnf` before the first start']]},
{h:'Skipping an event'},
{p:'Skipping hides a difference and risks more errors later. Do it only after you know what the event was and that the difference is harmless.'},
{code:`-- GTID: inject an empty transaction (see the GTID lesson)
STOP REPLICA;
SET GTID_NEXT='uuid:42'; BEGIN; COMMIT; SET GTID_NEXT='AUTOMATIC';
START REPLICA;`},
{p:'`replica_skip_errors` skips whole classes of errors permanently. It is very dangerous and rarely correct.'},
{h:'Detecting and fixing drift'},
{ul:['`pt-table-checksum` compares tables between source and replicas with checksums.','`pt-table-sync` generates statements to fix differences.','When differences are widespread, **rebuild** the replica from a clone or backup. It is faster and safer than patching.']},
{h:'Rebuilding a replica'},
{flow:['Stop and reset the replica: `STOP REPLICA; RESET REPLICA ALL;`','Clone from the source or another healthy replica, or restore a backup','Set the replication source with auto-position and start replication','Verify status, lag and a checksum of important tables']},
{h:'Prevention'},
{ul:['`read_only` and `super_read_only` on replicas.','Row-based logging and primary keys on all tables.','Monitor `Replica_IO_Running`, `Replica_SQL_Running`, lag and errors, and alert on them.','Keep binary log retention longer than your longest expected replica outage.']}],
src:[['Troubleshooting replication',K.D+'replication-problems.html'],['SHOW REPLICA STATUS',K.D+'show-replica-status.html']]};

/* ---------- 7 ---------- */
L['mysql:14:7']={blocks:[
{p:'Replicas can be arranged in several ways. Choose the topology from the goal: read scaling, backups, disaster recovery or consolidation.'},
{svg:topo},
{h:'Filters'},
{p:'Replication can be limited to some databases or tables with filter options. They are easy to get wrong.'},
{code:`CHANGE REPLICATION FILTER REPLICATE_DO_DB = (shop), REPLICATE_IGNORE_TABLE = (shop.audit_log) FOR CHANNEL '';
-- or in my.cnf: replicate_wild_do_table = shop.%`},
{ul:['Filtering with row-based replication is safer than with statements, where the current default database decides what is replicated.','A filtered replica is **not a full copy**: it cannot be used for failover or full backups.','Prefer replicating everything and ignoring what you do not need on the application side.']},
{h:'Using replicas for reads'},
{t:[['Approach','Notes'],
['Application chooses a connection for reads and one for writes','Simple and explicit. Handle stale reads yourself'],
['ProxySQL','Rules route SELECTs to replicas and writes to the source, and can watch replica lag'],
['MySQL Router read/write splitting','Available in recent Router versions (8.2 and later) for InnoDB Cluster and ReplicaSet'],
['DNS or load balancer for a read pool','Needs health checks that consider lag']]},
{h:'What replicas are good at'},
{ul:['Reads that tolerate slightly old data: dashboards, search lists, reports.','Heavy analytic queries that you do not want on the source.','Backups and consistency checks.','Testing upgrades and schema changes.']},
{h:'What they cannot do'},
{ul:['They do **not** scale writes. Every replica applies every write, so write capacity is bounded by what a single server can apply.','Reads that must see their own latest writes should go to the source, or wait for the GTID.','Adding replicas increases the load on the source, as each replica needs its own dump thread. Use a chain or an intermediate relay replica for many replicas.']},
{h:'Failover with plain replication'},
{flow:['Detect that the source is down and confirm it is not a network split','Choose the replica with the most applied transactions (compare `gtid_executed`)','Let it apply its relay log, then stop replication and promote it: `STOP REPLICA; RESET REPLICA ALL; SET GLOBAL read_only = OFF;`','Repoint the other replicas to it with auto-position and update the application endpoint','Fence the old source so it cannot accept writes if it comes back']},
{p:'Doing this by hand is slow and error prone, and a mistake risks **split brain** (two writers). Production setups use an automation layer. That is the purpose of the next section: Group Replication, InnoDB Cluster and MySQL Router.'},
{note:'Keep read replicas at least as strong as the source, with the same indexes. A weaker replica lags and then cannot take over when needed.'}],
src:[['Replication solutions',K.D+'replication-solutions.html'],['Replication filter rules',K.D+'replication-rules.html']]};
})();
