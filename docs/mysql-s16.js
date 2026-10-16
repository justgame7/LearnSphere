/* LearnSphere - MySQL, Section 16: High Availability & Scaling.
   Lectures 0-7 are core. Needs mysql-common.js. Commands written from product knowledge for MySQL 8.4, not run against a cluster. */
(function(){
const K=window.MY,L=window.LESSONS;

const nines=K.dg(700,170,[
[10,10,680,150,'Availability targets: allowed downtime per year',1],
[25,55,125,60,'99%|3.65 days',0],[165,55,125,60,'99.9%|8.8 hours',0],[305,55,125,60,'99.99%|52 minutes',2],[445,55,125,60,'99.999%|5 minutes',0],[585,55,90,60,'cost grows|each step',0]],[]);

const gr=K.dg(700,260,[
[10,10,680,240,'Group Replication, single-primary mode',1],
[270,45,160,50,'PRIMARY|accepts writes',2],[40,165,160,50,'SECONDARY|read only',0],[270,165,160,50,'SECONDARY|read only',0],[500,165,160,50,'SECONDARY|read only',0],
[250,110,200,34,'Paxos group communication',0]],
[[350,95,350,110],[350,144,120,165],[350,144,350,165],[350,144,580,165]]);

const cluster=K.dg(700,270,[
[10,10,680,250,'InnoDB Cluster',1],
[25,45,630,50,'Applications|connect to MySQL Router, not to a server directly',0],
[25,110,630,50,'MySQL Router|6446 read/write to the primary, 6447 read-only to secondaries|reads cluster metadata',2],
[25,175,200,60,'Primary|read/write',2],[250,175,200,60,'Secondary|read-only',0],[475,175,180,60,'Secondary|read-only',0]],
[[340,95,340,110],[125,160,125,175],[350,160,350,175],[565,160,565,175]]);

const cset=K.dg(700,220,[
[10,10,680,200,'InnoDB ClusterSet',1],
[25,50,300,120,'Primary cluster (region A)|3 member InnoDB Cluster|accepts writes',2],[375,50,300,120,'Replica cluster (region B)|3 member InnoDB Cluster|read only, asynchronous copy',0]],
[[325,110,375,110]]);

const prune=K.dg(700,200,[
[10,10,680,180,'RANGE partitioning by month and pruning',1],
[25,55,120,50,'p2026_01',0],[155,55,120,50,'p2026_02',2],[285,55,120,50,'p2026_03',0],[415,55,120,50,'p2026_04',0],[545,55,130,50,'pmax',0],
[25,125,650,40,'A February filter reads only p2026_02. Dropping p2026_01 removes January instantly.',0]],[]);

const ost=K.dg(700,190,[
[10,10,680,170,'Online schema change with a shadow table',1],
[20,60,130,60,'Create empty|shadow table|new schema',0],[170,60,150,60,'Copy rows in chunks|and capture changes|(binlog or triggers)',2],[340,60,130,60,'Throttle by|replica lag and load',0],[490,60,180,60,'Cut over: swap|the tables in|a brief lock',0]],
[[150,90,170,90],[320,90,340,90],[470,90,490,90]]);

/* ---------- 0 ---------- */
L['mysql:15:0']={blocks:[
{p:'**High availability (HA)** means the service keeps working when a component fails. Planning for it starts with a clear target and an honest view of what can fail.'},
{svg:nines},
{t:[['Failure type','Example','Typical protection'],
['Process','mysqld crashes','Automatic restart, crash recovery, a replica to take over'],
['Server','Hardware failure, kernel panic','Replica or cluster member takes over'],
['Storage','Disk or volume fails','RAID, replicated storage, replicas'],
['Zone or datacenter','Power or network loss','Members across zones, a replica in another site'],
['Region','Cloud region outage','Cross-region replica, ClusterSet, disaster recovery plan'],
['Human or software','Bad deployment, dropped table','Backups, delayed replica, change control']]},
{h:'The core problems'},
{ul:['**Detect** the failure quickly and correctly, without false alarms.','**Elect** one new primary. Two primaries at once is **split brain** and corrupts data.','**Redirect** applications to the new primary.','**Recover** the failed node and rejoin it.','Keep **data loss** within the RPO.']},
{h:'Quorum'},
{p:'To avoid split brain, clusters need a **majority** of members to agree. With 3 members, 2 form a majority, so one failure is tolerated. With 5 members two can fail. A cluster of **2 members cannot survive any failure** safely. Use odd numbers, spread across failure domains.'},
{h:'Options for MySQL'},
{t:[['Option','What it is','Failover','Notes'],
['Async replication plus automation','Source and replicas with an external tool (Orchestrator, scripts)','Automated or manual','Data loss possible, flexible, many parts to run'],
['Semi-sync replication','Adds acknowledgement from a replica','With tooling','Reduces loss, not a full HA solution'],
['**InnoDB Cluster**','Group Replication, MySQL Shell AdminAPI and MySQL Router','Automatic','Integrated and supported by Oracle'],
['InnoDB ReplicaSet','AdminAPI managed asynchronous replication','Manual','Simple, no automatic failover'],
['InnoDB ClusterSet','Several InnoDB Clusters in different sites','Manual switch across clusters','Disaster recovery'],
['Percona XtraDB Cluster, Galera','Synchronous multi-primary based on Galera','Automatic','Third-party. Different semantics'],
['MySQL NDB Cluster','Separate distributed in-memory engine','Automatic','Specialised workloads'],
['Cloud managed (RDS Multi-AZ, Aurora, Cloud SQL, Azure)','Provider handles replication and failover','Automatic','Easy, with provider limits']]},
{note:'HA protects against failures of hardware and processes. It does not protect against deletions, corruption or bad releases, which replicate everywhere. Keep backups and tested recovery on top of HA.'}],
src:[['High availability and scalability',K.D+'ha-overview.html']]};

/* ---------- 1 ---------- */
L['mysql:15:1']={blocks:[
{p:'**Group Replication** is the plugin that gives MySQL a replicated group of servers with built-in membership, failure detection and agreed ordering of transactions. It is the engine of InnoDB Cluster.'},
{svg:gr},
{h:'How a transaction commits'},
{flow:['A client executes a transaction on a member','At commit the member sends the transaction write set to the group using a Paxos-based protocol','Every member receives transactions in the same order','Each member runs **certification**: if another transaction already changed the same rows, the later one is rolled back','Certified transactions are applied on all members, and the originating member commits and replies']},
{p:'Transactions run **optimistically** on one member, and conflicts are found at commit. The group is **virtually synchronous**: every member agrees on the order, but applying on secondaries can lag a little, which is controlled by flow control and consistency settings.'},
{h:'Modes'},
{t:[['Mode','Writers','Notes'],
['Single-primary (default)','One primary, others read-only','Simple and safe. A new primary is elected automatically after failure'],
['Multi-primary','All members accept writes','Conflicts roll back transactions. Needs application awareness. Some restrictions']]},
{h:'Requirements and limits'},
{ul:['InnoDB tables with a **primary key**.','GTIDs on, binary log in ROW format.','Network with low latency. Stretching across distant regions slows every commit.','A group has up to **9 members**. Use 3 or 5.','There is a limit on transaction size (`group_replication_transaction_size_limit`). Very large transactions are rejected.']},
{h:'Consistency'},
{t:[['group_replication_consistency','Behaviour'],
['`EVENTUAL` (default)','Reads on a secondary may not see the latest committed writes yet'],
['`BEFORE_ON_PRIMARY_FAILOVER`','After a failover, new reads on the new primary wait until the backlog is applied'],
['`BEFORE`','The transaction waits until prior transactions are applied. Read-your-writes on any member'],
['`AFTER`','The transaction waits until all members applied it'],
['`BEFORE_AND_AFTER`','Both']]},
{h:'Membership and failure'},
{ul:['Members monitor each other. A member that cannot be reached for a while (`group_replication_member_expel_timeout`) is **expelled** and may rejoin later.','If the group loses its **majority**, it blocks writes rather than risk split brain.','A joining or returning member catches up through **distributed recovery**, which can use the clone plugin for a fast full copy.']},
{code:`SELECT member_host, member_state, member_role, member_version FROM performance_schema.replication_group_members;
SELECT * FROM performance_schema.replication_group_member_stats\\G
SELECT @@group_replication_group_name, @@group_replication_single_primary_mode;`},
{note:'You rarely configure Group Replication by hand. MySQL Shell AdminAPI sets it all up for you, covered in the next lesson.'}],
src:[['Group Replication',K.D+'group-replication.html'],['Group Replication requirements and limitations',K.D+'group-replication-requirements.html']]};

/* ---------- 2 ---------- */
L['mysql:15:2']={blocks:[
{p:'**InnoDB Cluster** is the complete, supported HA solution from the MySQL project. It combines three components: **Group Replication** for data and failover, **MySQL Shell** with the **AdminAPI** for management, and **MySQL Router** for transparent connection routing.'},
{svg:cluster},
{t:[['Component','Role'],
['Group Replication','Replicates data, elects the primary, detects failures'],
['MySQL Shell AdminAPI','Creates, configures, monitors and changes the cluster with simple commands'],
['MySQL Router','Lightweight proxy that sends read/write connections to the primary and read connections to secondaries, and follows failovers automatically'],
['Cluster metadata','Stored in the `mysql_innodb_cluster_metadata` schema, read by Shell and Router']]},
{h:'Building a cluster'},
{code:`mysqlsh admin@db1:3306
dba.checkInstanceConfiguration('admin@db1:3306')       // report what must change
dba.configureInstance('admin@db1:3306')                // apply the required settings (repeat for db2, db3)

var cluster = dba.createCluster('prodCluster')
cluster.addInstance('admin@db2:3306')                  // uses clone to copy the data
cluster.addInstance('admin@db3:3306')
cluster.status()`},
{p:'`cluster.status()` shows each member, its role (PRIMARY or SECONDARY), mode and status, and how many failures the group tolerates (for example, `"status": "OK"` with a majority of 3).'},
{h:'MySQL Router'},
{code:`mysqlrouter --bootstrap admin@db1:3306 --directory /opt/router --user=mysqlrouter
/opt/router/start.sh
# applications connect to the Router:
#   read/write  -> router-host:6446   (the primary)
#   read-only   -> router-host:6447   (secondaries, round robin)`},
{ul:['Bootstrap reads the cluster metadata, so Router discovers members and **follows failovers** without reconfiguration.','Run a Router **with each application server** or as a small separate tier, and use several for redundancy.','Recent Router versions add a **read/write splitting** port. Check the Router documentation for your version and the port numbers.','Router performs **no authentication of its own** against the application users: it passes connections through to the servers.']},
{h:'Everyday commands'},
{code:`cluster.describe()                    // topology
cluster.options()                     // settings
cluster.setOption('memberWeight', 80, 'admin@db2:3306')
cluster.removeInstance('admin@db3:3306')
cluster.rescan()                      // update metadata after changes
dba.getCluster('prodCluster')`},
{note:'Use cluster members of equal size and place them in different failure domains (zones). Use at least 3 members so the loss of one is tolerated.'}],
src:[['MySQL InnoDB Cluster',K.SH+'mysql-innodb-cluster.html'],['MySQL Router',K.RT]]};

/* ---------- 3 ---------- */
L['mysql:15:3']={blocks:[
{h:'InnoDB ReplicaSet'},
{p:'A **ReplicaSet** is a primary with asynchronous replicas that you manage through AdminAPI. It is simpler than a cluster, with fewer moving parts and lower overhead, but it has **no automatic failover**: if the primary fails, you must promote a replica yourself.'},
{code:`var rs = dba.createReplicaSet('rset')
rs.addInstance('admin@replica1:3306')
rs.status()
rs.setPrimaryInstance('admin@replica1:3306')        // planned switchover
rs.forcePrimaryInstance('admin@replica1:3306')      // emergency failover, may lose transactions`},
{ul:['Good for read scaling and modest availability needs where manual recovery is acceptable.','Data is replicated asynchronously, so a failure can lose the most recent transactions.','Router can route to a ReplicaSet, following planned changes.']},
{h:'InnoDB ClusterSet'},
{p:'A **ClusterSet** links several InnoDB Clusters, usually in different regions, for **disaster recovery**. One cluster is the **primary cluster**, and the others are **replica clusters** fed by asynchronous replication.'},
{svg:cset},
{code:`var cs = cluster.createClusterSet('myClusterSet')
cs.createReplicaCluster('admin@dr1:3306', 'drCluster')
cs.status()
cs.setPrimaryCluster('drCluster')            // planned switchover between clusters
cs.forcePrimaryCluster('drCluster')          // emergency failover when the primary cluster is lost`},
{t:[['Aspect','Inside a cluster','Between clusters in a ClusterSet'],
['Replication','Group Replication, virtually synchronous','Asynchronous'],
['Failover','Automatic','Manual (switchover or forced failover)'],
['Data loss on failure','None for committed data with majority','Possible: replica clusters can lag'],
['Router','Follows the primary','Can route to the primary cluster and follow a switch']]},
{h:'Choosing'},
{t:[['Need','Choose'],
['Automatic failover within a site','InnoDB Cluster'],
['Simple read scaling with manual recovery','InnoDB ReplicaSet'],
['Survive a full site or region loss','ClusterSet, with a tested runbook'],
['Several writers, conflict tolerant','Group Replication multi-primary (careful)']]},
{note:'ClusterSet is a **disaster recovery** feature, not a write-anywhere setup. Write latency stays local because the replica cluster copies changes afterwards.'}],
src:[['MySQL InnoDB ReplicaSet',K.SH+'mysql-innodb-replicaset.html'],['MySQL InnoDB ClusterSet',K.SH+'innodb-clusterset.html']]};

/* ---------- 4 ---------- */
L['mysql:15:4']={blocks:[
{p:'A cluster is only as good as your ability to **operate** it. Know what happens during a failure, how to change the primary on purpose and how to recover from the worst case.'},
{h:'Automatic failover'},
{flow:['Members detect that the primary is unreachable (heartbeat and `member_expel_timeout`)','The remaining members confirm they still form a **majority**','They elect a new primary. Member weight, then version, then UUID decide the winner','The new primary applies its backlog and becomes writable','MySQL Router notices through the metadata and routes writes to the new primary','The old primary returns as a secondary after it rejoins and catches up']},
{p:'Typical failover takes a few seconds, depending on timeouts. Applications see broken connections and must **reconnect and retry**. Transactions in flight are lost, so make writes idempotent or retryable.'},
{h:'Planned switchover'},
{code:`cluster.setPrimaryInstance('admin@db2:3306')       // graceful, no data loss
cluster.status()`},
{p:'Use it before maintenance of the primary host: move the primary first, then patch or restart the old one.'},
{h:'Rolling maintenance and upgrades'},
{ul:['Upgrade **secondaries first**, one at a time, waiting for each to rejoin.','Switch the primary to an upgraded member, then upgrade the old primary last.','Upgrade **MySQL Router** and **MySQL Shell** as well. Check version compatibility rules in the documentation.','Take a backup before starting. Keep an eye on the cluster status between steps.']},
{h:'When quorum is lost'},
{p:'If more than half of the members fail or are unreachable, the group blocks writes. Do **not** panic and force it. First find out whether the missing members are really gone or just unreachable. Forcing a minority to continue while the others are alive creates split brain.'},
{code:`cluster.status()                                         // who is missing?
cluster.forceQuorumUsingPartitionOf('admin@db1:3306')    // last resort: continue with the visible members

dba.rebootClusterFromCompleteOutage()                    // all members were down: restart the cluster from metadata
cluster.rejoinInstance('admin@db3:3306')                 // bring a member back
cluster.rescan()`},
{h:'Test your failover'},
{ul:['Kill the primary process or stop the VM in a **test environment** and measure recovery time, application errors and data consistency.','Repeat in production during a quiet period if your policy allows. Untested failover is a guess.','Check the clients: connection pools must drop dead connections, DNS or Router endpoints must be refreshed, timeouts must be short.']},
{h:'Monitoring'},
{t:[['Watch','Why'],
['`cluster.status()` member states','Detect RECOVERING, UNREACHABLE, OFFLINE'],
['`replication_group_member_stats`: transactions in queue, conflicts','Flow control and certification pressure'],
['Router logs and connections','Routing health'],
['Disk and network between members','Latency or loss triggers expulsions']]},
{note:'Back up from a secondary, and keep backups and binary logs outside the cluster. A cluster protects availability, not data against logical mistakes.'}],
src:[['Group Replication operations',K.D+'group-replication-administration.html'],['AdminAPI',K.SH+'admin-api.html']]};

/* ---------- 5 ---------- */
L['mysql:15:5']={blocks:[
{p:'**Partitioning** splits one logical table into several physical pieces, partitions, by the value of a column. Each partition has its own data and index. It is useful for very large tables, mainly for **data lifecycle**, and sometimes for performance.'},
{svg:prune},
{code:`CREATE TABLE events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at DATE NOT NULL,
  payload JSON,
  PRIMARY KEY (id, created_at)
)
PARTITION BY RANGE COLUMNS (created_at) (
  PARTITION p2026_01 VALUES LESS THAN ('2026-02-01'),
  PARTITION p2026_02 VALUES LESS THAN ('2026-03-01'),
  PARTITION p2026_03 VALUES LESS THAN ('2026-04-01'),
  PARTITION pmax     VALUES LESS THAN (MAXVALUE)
);`},
{h:'Types'},
{t:[['Type','Rule','Use'],
['RANGE (COLUMNS)','Ranges of values','Time series. Most common'],
['LIST (COLUMNS)','Discrete values','Region or category'],
['HASH','Hash of an integer expression','Spread rows evenly'],
['KEY','MySQL hash of columns','Like HASH, works on any column type'],
['Subpartition','Partitions of partitions','Rare']]},
{h:'Pruning'},
{p:'When the `WHERE` clause constrains the partitioning column, the optimizer reads only the **relevant partitions**. The `partitions` column of EXPLAIN shows which ones.'},
{code:`EXPLAIN SELECT * FROM events WHERE created_at >= '2026-02-10' AND created_at < '2026-02-20';
-- partitions: p2026_02`},
{h:'Maintenance advantages'},
{code:`ALTER TABLE events DROP PARTITION p2026_01;                 -- instant removal of a month of data
ALTER TABLE events REORGANIZE PARTITION pmax INTO (
  PARTITION p2026_04 VALUES LESS THAN ('2026-05-01'),
  PARTITION pmax VALUES LESS THAN (MAXVALUE));              -- add the next month
ALTER TABLE events EXCHANGE PARTITION p2026_02 WITH TABLE events_archive_2026_02;`},
{p:'Dropping a partition is a metadata operation. It is far cheaper than `DELETE` of millions of rows. A scheduled job or event creates future partitions and drops expired ones.'},
{h:'Restrictions and pitfalls'},
{ul:['Every **unique key, including the primary key, must contain the partitioning column**. This is why the primary key above is `(id, created_at)`.','**Foreign keys are not supported** on partitioned InnoDB tables, as a parent or a child.','There are no global indexes: each partition has its own indexes. A query that does not constrain the partition column checks **every** partition, which can be slower than an unpartitioned table.','Do not partition small tables or expect speedups for queries unrelated to the partition key.','There is a limit of 8192 partitions. Hundreds are manageable, thousands add overhead.']},
{note:'Typical good use: a log or event table with time-based retention. Typical misuse: partitioning a medium table by hash hoping for faster queries. Index and query design first.'}],
src:[['Partitioning',K.D+'partitioning.html'],['Partition pruning',K.D+'partitioning-pruning.html']]};

/* ---------- 6 ---------- */
L['mysql:15:6']={blocks:[
{p:'When one primary can no longer handle the write load or the data size, the options are **scale up** (a bigger server), **scale reads** (replicas) and finally **scale out writes** by **sharding**. Each step adds complexity, so go in order.'},
{h:'Before sharding'},
{ul:['Tune queries and indexes. This often yields 10x.','Add RAM so the working set fits in the buffer pool.','Move reads to replicas and add caching.','Archive or purge cold data, partition by time.','Scale up. Modern servers handle terabytes and tens of thousands of transactions per second.']},
{h:'What sharding is'},
{p:'**Sharding** splits data across several independent MySQL clusters, **shards**. Each shard holds a subset of rows chosen by a **shard key**, such as a customer id.'},
{t:[['Strategy','How','Trade-off'],
['Hash','`shard = hash(key) % N`','Even spread, hard to add shards without moving data'],
['Range','Key ranges map to shards','Easy to add shards at the end, risk of hot shards'],
['Directory (lookup table)','A table maps each key to a shard','Flexible and movable, an extra lookup and a component to protect'],
['Tenant per shard','Each customer lives on one shard','Natural for SaaS, uneven sizes']]},
{h:'The hard parts'},
{ul:['**Shard key choice.** Most queries must include it, otherwise they hit all shards. A bad key creates hot spots.','**Cross-shard queries and joins** are slow or impossible. Cross-shard transactions need distributed coordination or compromises.','**Global unique ids** need a generator.','**Resharding** (changing shard count) is a major operation.','**Operations multiply**: backups, upgrades, schema changes and monitoring for every shard.']},
{h:'Tools'},
{t:[['Tool','What it does'],
['**ProxySQL**','A high performance MySQL-aware proxy. Connection pooling, query routing rules (SELECT to replicas), read/write splitting, query mirroring, failover awareness, caching'],
['**MySQL Router**','Routing for InnoDB Cluster and ReplicaSet, including read/write splitting in newer versions'],
['**Vitess**','Sharding and orchestration layer for MySQL, born at YouTube, used by large installations'],
['**TiDB**, distributed SQL','MySQL-compatible distributed database that shards automatically. Different engine, check compatibility'],
['Application-level sharding','Application selects the shard by key. Simple, but the logic lives in code'],
['Cloud options','Managed services with sharding or large single-writer scale (for example Aurora). Check current features']]},
{h:'Read/write splitting'},
{p:'A proxy or the application sends writes to the primary and reads to replicas. Replica **lag** means reads may be stale, so route read-after-write cases to the primary and use a proxy that **removes lagging replicas** from the pool.'},
{code:`-- ProxySQL: route SELECT to the reader hostgroup, everything else to the writer
INSERT INTO mysql_query_rules (rule_id, active, match_digest, destination_hostgroup, apply) VALUES (1, 1, '^SELECT.*FOR UPDATE', 10, 1);
INSERT INTO mysql_query_rules (rule_id, active, match_digest, destination_hostgroup, apply) VALUES (2, 1, '^SELECT', 20, 1);
LOAD MYSQL QUERY RULES TO RUNTIME; SAVE MYSQL QUERY RULES TO DISK;`},
{note:'Sharding is expensive in people and time. Many successful systems never need it. Reach for it only when measured limits of a single primary, after the cheaper options, force it.'}],
src:[['ProxySQL','https://proxysql.com/documentation/'],['Vitess','https://vitess.io/docs/']]};

/* ---------- 7 ---------- */
L['mysql:15:7']={blocks:[
{p:'Tables with hundreds of millions of rows make everyday operations risky: altering the structure, removing old data and backfilling values can lock the table or overload replicas. The skill is to do such work **in small, controlled steps**.'},
{h:'Schema changes'},
{ul:['Check first whether the change is **INSTANT** (`ALGORITHM=INSTANT`): adding or dropping a column, changing a default. No waiting.','Many index changes are **INPLACE** and online: reads and writes continue, with brief metadata locks at the start and end.','Changes that need a **table copy** (column type changes, some charset changes) can run for hours and cause replica lag.','Always set `lock_wait_timeout` low and watch for metadata lock pile-ups (section 10).']},
{h:'Online schema change tools'},
{svg:ost},
{t:[['Tool','How it captures changes','Notes'],
['**gh-ost** (GitHub)','Reads the **binary log**, no triggers','Can pause, throttle on replica lag, test on a replica, and control the cut-over'],
['**pt-online-schema-change** (Percona)','Uses **triggers** on the original table','Mature and simple. Triggers add write cost. Foreign keys complicate it'],
['Native online DDL','Built into InnoDB','Preferred whenever the operation is online']]},
{code:`gh-ost --host=replica1 --database=shop --table=orders --alter="ADD COLUMN source VARCHAR(20) NULL" \\
  --max-lag-millis=1500 --chunk-size=1000 --verbose --execute

pt-online-schema-change --alter "ADD COLUMN source VARCHAR(20) NULL" D=shop,t=orders --execute`},
{h:'Removing old data'},
{flow:['Decide retention: what data is needed and for how long','Prefer **partitioning by date** and dropping old partitions','Otherwise delete in **small batches** (a few thousand rows) with a short pause, watching replica lag','Archive first when the data may be needed: copy to an archive table or object storage (`pt-archiver` does copy and delete in chunks)','Reclaim space afterwards with `OPTIMIZE TABLE` or a table rebuild only if needed']},
{code:`-- batch purge loop (run from a script, check lag between batches)
DELETE FROM events WHERE created_at < NOW() - INTERVAL 180 DAY ORDER BY id LIMIT 5000;
-- repeat while ROW_COUNT() > 0, sleeping 100-500 ms`},
{h:'Backfills and bulk updates'},
{ul:['Update by **primary key ranges**, not by one huge statement: `WHERE id BETWEEN ? AND ?`.','Commit after each chunk and **throttle** based on replica lag and server load.','Make the job restartable: record the last processed id.','Run it during low traffic and be ready to stop it.']},
{h:'General principles'},
{ul:['Rehearse on a copy with production-sized data.','Watch **replica lag**, `Threads_running`, lock waits and disk usage during the change.','Keep transactions short. Avoid big single statements.','Have a rollback plan, and for a schema change a way to return to the old table.','Add monitoring so you can stop quickly when impact rises.']},
{note:'A table that is too big for comfortable operations is a design signal: consider partitioning, archiving, or splitting a hot and a cold table before the size forces an emergency.'}],
src:[['Online DDL',K.D+'innodb-online-ddl.html'],['gh-ost','https://github.com/github/gh-ost'],['Percona Toolkit','https://docs.percona.com/percona-toolkit/']]};
})();
