/* LearnSphere - MySQL, Section 17: Operations, Upgrades & Cloud.
   Lectures 0-7 are core. Needs mysql-common.js. Version statements are written from product knowledge. Check release notes and provider documentation for your exact versions. */
(function(){
const K=window.MY,L=window.LESSONS;

const stop=K.dg(700,190,[
[10,10,680,170,'Shutdown modes (innodb_fast_shutdown)',1],
[25,55,200,70,'0 slow|full purge and change|buffer merge, slowest,|cleanest files',0],[250,55,200,70,'1 fast (default)|flush dirty pages and|redo, skip purge|normal choice',2],[475,55,200,70,'2 crash-like|flush logs only|recovery on next start|emergencies',0]],[]);

const path=K.dg(700,170,[
[10,10,680,150,'LTS to LTS upgrade path',1],
[25,60,150,50,'8.0|end of life Apr 2026',0],[215,60,130,50,'8.4 LTS|baseline',2],[385,60,130,50,'9.x|innovation',0],[555,60,120,50,'9.7 LTS|next LTS',2]],
[[175,85,215,85],[345,85,385,85],[515,85,555,85]]);

const trouble=K.dg(700,190,[
[10,10,680,170,'Troubleshooting loop',1],
[20,60,115,60,'Define the|symptom and|when it began',0],[155,60,115,60,'Check recent|changes',0],[290,60,115,60,'Gather|evidence: logs,|metrics, status',2],[425,60,115,60,'Form and test|one hypothesis',0],[560,60,115,60,'Fix, verify,|write it down',0]],
[[135,90,155,90],[270,90,290,90],[405,90,425,90],[540,90,560,90]]);

const cloud=K.dg(700,220,[
[10,10,680,200,'Shared responsibility for managed MySQL',1],
[25,50,310,140,'The provider runs|hardware, OS, patching|backups and snapshots|failover and replication|monitoring basics',2],[365,50,310,140,'You still own|schema and queries|indexes and tuning|users and privileges|application connectivity|cost, capacity, restore tests',0]],[]);

/* ---------- 0 ---------- */
L['mysql:16:0']={blocks:[
{p:'Starting and stopping a server should be boring and safe. Know the service commands, the shutdown modes and what to check afterwards.'},
{h:'Service management on Linux'},
{code:`sudo systemctl status mysqld          # on Debian and Ubuntu the unit is called mysql
sudo systemctl start mysqld
sudo systemctl stop mysqld
sudo systemctl restart mysqld
sudo journalctl -u mysqld -n 100 --no-pager
mysqladmin -u admin -p ping            # mysqld is alive?
mysqladmin -u admin -p status`},
{p:'The service uses `systemd`, which restarts the server after a crash according to the unit settings. Use the service manager, not `kill -9` or running `mysqld` by hand, so the process stays supervised.'},
{h:'Stopping safely'},
{code:`SHUTDOWN;                              -- as a privileged user
mysqladmin -u admin -p shutdown
SET GLOBAL innodb_fast_shutdown = 1;   -- before shutdown if you want to choose`},
{svg:stop},
{ul:['A normal shutdown waits for running transactions to finish or **roll back**. A huge uncommitted transaction can make shutdown (and the next start) slow.','Check for long transactions before a planned stop: `SELECT * FROM information_schema.innodb_trx;`.','Use `0` (slow shutdown) before a major upgrade or a physical copy when you want the files as clean as possible. Use `1` normally.','`SIGKILL` or a power cut triggers **crash recovery** at the next start. InnoDB handles it, but it takes time and is avoidable.']},
{h:'First start of a new data directory'},
{code:`mysqld --initialize --user=mysql --datadir=/var/lib/mysql       # creates files, writes a temporary root password to the error log
mysqld --initialize-insecure --user=mysql                        # root with an empty password: lab use only
mysqld --validate-config                                         # check options without starting`},
{h:'Checks after a start'},
{ul:['Read the **error log** for warnings and for the line that says the server is ready for connections.','Confirm `SELECT VERSION()`, replication status and that expected variables took effect.','On a cluster member, check it rejoined and caught up.','Watch the buffer pool warm up. Queries may be slow for a few minutes.']},
{h:'Restart without a shell'},
{code:`RESTART;      -- needs a supervisor such as systemd that restarts mysqld, and the SHUTDOWN privilege`},
{note:'Before a restart, check backups are current, connections can be drained (or redirected by Router or a proxy) and that no long DDL or purge is running.'}],
src:[['Starting and stopping the server',K.D+'starting-server.html'],['innodb_fast_shutdown',K.D+'innodb-parameters.html#sysvar_innodb_fast_shutdown']]};

/* ---------- 1 ---------- */
L['mysql:16:1']={blocks:[
{h:'Information Schema and the data dictionary'},
{p:'The **Information Schema** (`information_schema`) is a set of read-only views of metadata: databases, tables, columns, indexes, privileges, running transactions. Since MySQL 8.0 the metadata itself lives in a transactional **data dictionary** stored in InnoDB tables (`mysql.ibd`), which makes DDL atomic and removes the old `.frm` files.'},
{code:`SELECT table_name, engine, table_rows, data_length, index_length, data_free, update_time
FROM information_schema.tables WHERE table_schema = 'shop';

SELECT * FROM information_schema.columns WHERE table_schema = 'shop' AND table_name = 'orders';
SELECT * FROM information_schema.statistics WHERE table_schema = 'shop' AND table_name = 'orders';
SELECT * FROM information_schema.innodb_trx;
SELECT * FROM information_schema.key_column_usage WHERE referenced_table_name = 'customers';`},
{ul:['Statistics columns such as `table_rows`, `data_length` and `update_time` are **cached** for `information_schema_stats_expiry` seconds (default 86400, one day). Set it to 0 to read fresh values, with more cost.','`table_rows` is an **estimate** for InnoDB, not an exact count.','`information_schema.processlist` is deprecated. Use `performance_schema.processlist` or `SHOW PROCESSLIST` and the `sys.session` view.','Queries against `information_schema` over thousands of tables can be slow. Filter by schema and table.']},
{h:'Table maintenance'},
{t:[['Statement','What it does','When to use'],
['`ANALYZE TABLE t`','Recomputes index statistics (and builds histograms with the `UPDATE HISTOGRAM` clause)','After large data changes or when plans look wrong. Quick, takes a short lock'],
['`OPTIMIZE TABLE t`','Rebuilds the table, defragments, reclaims free space and updates statistics. For InnoDB it maps to a rebuild plus analyze','After deleting a large share of rows, when `data_free` is large. Heavy'],
['`ALTER TABLE t ENGINE=InnoDB` (or `FORCE`)','Rebuilds the table in place','Same as OPTIMIZE for InnoDB'],
['`CHECK TABLE t`','Verifies the table structure','When corruption is suspected'],
['`mysqlcheck`','Command-line wrapper for check, analyze and optimize across many tables','Maintenance scripts']]},
{code:`ANALYZE TABLE shop.orders;
OPTIMIZE TABLE shop.events;
CHECK TABLE shop.orders;
SELECT table_name, ROUND(data_free/1024/1024) AS free_mb, ROUND((data_length+index_length)/1024/1024) AS size_mb
FROM information_schema.tables WHERE table_schema = 'shop' AND data_free > 100*1024*1024;`},
{h:'How much maintenance is really needed'},
{ul:['InnoDB keeps **persistent statistics** and refreshes them automatically. Routine nightly `ANALYZE` on everything is usually unnecessary. Use it for specific tables after bulk loads.','Rebuilding tables to reclaim space helps after a large purge. Do it with an online approach on big tables (the online schema change tools) because `OPTIMIZE` copies the table.','Fragmentation is rarely the reason for slowness. Look at queries and indexes first.','Statistics and `OPTIMIZE` are replicated by default, so they also run on replicas. Use `NO_WRITE_TO_BINLOG` to run on one server only.']},
{note:'Do not run OPTIMIZE TABLE on a very large table in business hours without an estimate. It needs free disk space for a second copy of the table and holds locks briefly at the start and end.'}],
src:[['INFORMATION_SCHEMA',K.D+'information-schema.html'],['Table maintenance statements',K.D+'table-maintenance-statements.html'],['MySQL data dictionary',K.D+'data-dictionary.html']]};

/* ---------- 2 ---------- */
L['mysql:16:2']={blocks:[
{p:'Upgrading is a project with a plan, not a command. The plan starts from the release model and the end-of-life dates of the version you run.'},
{svg:path},
{t:[['Series','Status','What to do'],
['5.7 and earlier','End of life','Upgrade in stages to 8.0, then to 8.4. Do not skip supported paths'],
['8.0','End of life since April 2026','Move to 8.4 LTS now'],
['8.4 LTS','Long-term support','Current baseline for production'],
['9.0 to 9.6','Innovation, short-lived','For testing new features. Move to the next LTS rather than staying on them'],
['9.7 LTS','Long-term support, released April 2026','The next LTS target after 8.4']]},
{p:'MySQL supports upgrades **within a series** (patch to patch), **between LTS releases** (for example 8.4 to 9.7) and **from the previous LTS to the next**. Check the upgrade paths in the manual before planning. Always read the release notes of every version in between. **Downgrades are generally not supported** across series, so your rollback is a restore or a replica that was not upgraded.'},
{h:'What typically changes'},
{t:[['Area','Examples'],
['Authentication','`mysql_native_password` disabled by default in 8.4 and removed in 9.0. Update clients and connectors, or accounts that still use it'],
['Replication','Master and slave terms removed in 8.4. Scripts using `SHOW MASTER STATUS`, `START SLAVE`, `CHANGE MASTER TO` must use the new statements'],
['Defaults','Some InnoDB defaults changed in 8.4 (for example the adaptive hash index and change buffering). Compare variable defaults between versions'],
['Removed or deprecated','Variables, options and SQL features. Applications and monitoring queries that reference them fail or warn'],
['Reserved words','New keywords can break unquoted identifiers'],
['Behaviour','Optimizer changes, collation changes, stricter checks. Plans can change, so test performance']]},
{h:'Planning checklist'},
{flow:['Read the release notes and the "upgrading" chapter for the target version, and list changes that affect you','Run the **upgrade checker** (`util.checkForServerUpgrade()` in MySQL Shell) against the current server','Inventory clients, connectors, tools (backup, monitoring, ORM) and check their support for the target version and authentication','Build a **test environment** from a recent backup of production and run the application test suite and key queries','Compare **performance** before and after with real or replayed workload','Decide the method and rollback, then rehearse','Schedule the production change, upgrade replicas first, and keep the old version available until you are confident']},
{ul:['Upgrade **client libraries** before or together with the server.','Document and communicate the maintenance window and the rollback criteria.','Keep a verified backup taken right before the upgrade.']},
{note:'End of life means no more security fixes. Running an unsupported version is a risk. Plan upgrades as a routine, at least once between LTS releases, rather than as an emergency.'}],
src:[['Upgrading MySQL',K.D+'upgrading.html'],['Upgrade paths',K.D+'upgrade-paths.html'],['MySQL release notes','https://dev.mysql.com/doc/relnotes/mysql/8.4/en/']]};

/* ---------- 3 ---------- */
L['mysql:16:3']={blocks:[
{p:'Three methods exist. Choose by downtime tolerance, size and risk appetite.'},
{t:[['Method','How','Downtime','Notes'],
['**In-place**','Stop the server, replace the binaries, start the new version on the same data directory','Short, minutes to an hour','The server upgrades the data dictionary and system tables automatically at startup. No rollback except restoring the old files'],
['**Logical**','Dump from the old server and load into a new server of the target version','Long for large data (use Shell utilities)','Clean new instance. Works across big version gaps and platforms'],
['**Replication-based**','Build or upgrade a replica to the new version, then promote it','Seconds at switchover','Lowest risk. The old source stays as a rollback. A replica of a **newer** version can follow an older source, not the other way round']]},
{h:'Run the upgrade checker'},
{code:`mysqlsh admin@db1:3306
util.checkForServerUpgrade('admin@db1:3306', {targetVersion: '8.4.0', outputFormat: 'JSON'})`},
{p:'It reports errors that block the upgrade (removed features, invalid names, old authentication), warnings and notices (deprecated settings, changed defaults). Fix every error before you start.'},
{h:'In-place procedure'},
{flow:['Take a full backup and confirm a restore works','Run the upgrade checker and fix issues. Check disk space','Set `innodb_fast_shutdown = 0`, then stop the server cleanly','Install the new binaries and keep the data directory and configuration (review the configuration for removed options)','Start the new server. It upgrades the data dictionary and system schemas automatically','Read the error log for the upgrade steps and warnings','Run `ANALYZE TABLE` on key tables, test the application, monitor']},
{p:'Since 8.0.16 the server performs the upgrade steps itself. The old `mysql_upgrade` program is no longer needed. The option `--upgrade` (AUTO, NONE, MINIMAL, FORCE) controls it.'},
{h:'Replication-based (rolling) upgrade'},
{flow:['Upgrade a replica to the new version and let it catch up','Verify queries and replication on it. Upgrade the other replicas','Switch over: promote an upgraded replica (or switch the InnoDB Cluster primary to an upgraded member)','Point applications to the new primary, and upgrade the old primary last','Keep the old servers available for a while. Replication from a newer source to an older replica is generally not supported, so the usual rollback is a restore or the untouched old primary']},
{ul:['For **InnoDB Cluster**, follow the rolling upgrade steps: upgrade secondaries, switch the primary, upgrade the former primary, then MySQL Router and Shell.','Replicas of an **older** version cannot follow a **newer** source reliably. Plan the direction accordingly.','During a mixed-version period avoid using features that exist only in the new version.']},
{h:'After the upgrade'},
{ul:['Compare slow query digests and key metrics with those before the upgrade.','Rebuild statistics where plans differ, add histograms or hints for regressions.','Remove compatibility workarounds once all clients are updated.','Keep the old backup until the new version has run through a full business cycle.']},
{note:'Practise the rollback as well as the upgrade. Rolling back a failed in-place upgrade means restoring the backup, which can take hours, so rehearse and measure it.'}],
src:[['In-place upgrade',K.D+'upgrade-binary-package.html'],['Upgrade checker (MySQL Shell)',K.SH+'mysql-shell-utilities-upgrade.html']]};

/* ---------- 4 ---------- */
L['mysql:16:4']={blocks:[
{p:'Troubleshooting is easier with a method. Under pressure people change many things at once and lose the evidence. Follow a loop, collect facts and change one thing at a time.'},
{svg:trouble},
{h:'First look: five commands'},
{code:`SHOW FULL PROCESSLIST;                                    -- what is running right now
SHOW GLOBAL STATUS LIKE 'Threads_%';                      -- connected, running
SELECT * FROM sys.innodb_lock_waits\\G                     -- blocking
SHOW ENGINE INNODB STATUS\\G                               -- deadlocks, transactions, I/O
SELECT * FROM performance_schema.error_log ORDER BY logged DESC LIMIT 20;
-- and at the OS: top / vmstat / iostat -x / df -h / free -m`},
{h:'Symptom guide'},
{t:[['Symptom','Likely causes','First steps'],
['Cannot connect','Server down, port or firewall, max_connections, TLS or auth plugin change, host blocked','`systemctl status`, error log, `SHOW STATUS LIKE \'Connection_errors%\'`, test from the same network'],
['Everything slow suddenly','One bad query, lock pile-up, I/O saturation, a plan change, replica or backup load','Processlist for long or many identical statements, `sys.statement_analysis`, `iostat`'],
['Statements stuck "Waiting for ... lock"','Metadata lock behind a long transaction, row lock wait','`sys.schema_table_lock_waits`, `sys.innodb_lock_waits`, find and end the blocker'],
['High CPU','Missing indexes, heavy queries, too many concurrent threads','Digests by total time, `Threads_running`, EXPLAIN the top statements'],
['High memory or OOM kill','Too many connections, large per-session buffers, temp tables, undersized host','`sys.memory_global_by_current_bytes`, settings, connection count'],
['Disk full','Binary logs, slow or general logs, temp files, big transactions, undo growth','`df -h`, `du`, `SHOW BINARY LOGS`, purge logs safely, find long transactions'],
['Replication lag or stopped','Big transaction, no primary key, slow replica, errors','`SHOW REPLICA STATUS`, applier worker table, lag causes'],
['Server crash or restart loop','Corruption, out of memory, bug, bad configuration','Error log before the crash, OS logs (`dmesg`), `innodb_force_recovery` only as a last resort'],
['Connection storms','App restart or leak, no pooling','Pool settings, `Aborted_connects`, proxy, limit per user'],
['Deadlocks rising','New code path or hot rows','`innodb_print_all_deadlocks`, deadlock report, lock order']]},
{h:'Collect evidence before you act'},
{ul:['Save the processlist, `SHOW ENGINE INNODB STATUS`, key status counters and relevant logs **before** killing or restarting. Restarting destroys the evidence.','Compare with a **baseline** from monitoring: what changed and when? Deployments, data growth, a batch job, a failover.','Check the **application** side as well: new queries, retries, connection pool settings, timeouts.']},
{h:'Mitigate, then fix'},
{ul:['`KILL` the offending query or session to restore service, then fix the cause (index, query, code).','Add capacity or redirect load only after you know the bottleneck.','After the incident, write down timeline, root cause, fix and prevention. Add a monitor or alert that would have caught it.']},
{note:'Keep a runbook for your top ten incidents with the exact commands and decision points. It turns a stressful guess into a checklist.'}],
src:[['Optimizing and troubleshooting',K.D+'optimization.html'],['Problems and common errors',K.D+'error-handling.html']]};

/* ---------- 5 ---------- */
L['mysql:16:5']={blocks:[
{p:'Most new MySQL deployments run as a **managed service**. The provider operates the servers, and you operate the data and the application. Knowing the split and the limits avoids surprises.'},
{svg:cloud},
{h:'Main options'},
{t:[['Service','Notes'],
['**Amazon RDS for MySQL**','Managed MySQL instances. Single-AZ, Multi-AZ (a standby, or a Multi-AZ DB cluster with two readable standbys), read replicas, automated backups with point-in-time restore, snapshots, parameter groups'],
['**Amazon Aurora MySQL**','MySQL-compatible engine with a shared, distributed storage layer that keeps six copies across zones. Fast failover, up to 15 read replicas, Serverless v2, Global Database. Compatibility is with a specific MySQL version line. It is not the same as community MySQL internally'],
['**Azure Database for MySQL (Flexible Server)**','Zone-redundant high availability, burstable and general purpose tiers, read replicas'],
['**Google Cloud SQL for MySQL**','Regional high availability, read replicas, automated backups and point-in-time recovery'],
['**Oracle MySQL HeatWave on OCI**','Oracle managed MySQL with the HeatWave analytics engine. Also offered on AWS and Azure'],
['Self-managed on VMs or Kubernetes','Full control and full responsibility. Operators exist for Kubernetes, with care for storage and failover']]},
{h:'What the service gives you'},
{ul:['Provisioning, patching and minor version upgrades on a schedule.','Automated backups, snapshots and point-in-time restore within a retention window.','High availability options with automatic failover, and managed read replicas.','Monitoring dashboards and storage scaling.']},
{h:'Typical restrictions'},
{ul:['**No SUPER** or direct OS access. Administrative tasks go through provider procedures, for example `CALL mysql.rds_kill(id)` or `CALL mysql.rds_set_configuration(\'binlog retention hours\', 24)` on RDS.','Settings are changed with **parameter groups**, and some require a restart.','Some features, plugins and replication topologies are limited or differ. Check compatibility lists.','Failover and maintenance windows are managed by the provider. Your application must tolerate a short interruption and reconnect.','You may not choose the exact minor version of every component, and the upgrade timing is partly set by the provider.']},
{h:'Choosing'},
{t:[['Priority','Lean toward'],
['Fewest operations, standard MySQL','RDS, Azure Flexible Server or Cloud SQL'],
['Highest read scale, fast failover, large storage in AWS','Aurora MySQL'],
['Analytics next to OLTP in one service','MySQL HeatWave'],
['Full control, custom plugins, special topologies','Self-managed']]},
{h:'Do not forget'},
{ul:['**Test restores** from provider backups. They are only a service you must still verify.','Set **alerts** on storage, CPU, connections, replica lag and failed backups.','Use **private networking**, TLS, least privilege accounts and secret management.','Watch **cost**: instance size, IOPS, storage, backup retention, data transfer and replicas.','Keep the schema and the queries healthy. A managed service does not fix a missing index.']}],
src:[['Amazon RDS for MySQL','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_MySQL.html'],['Amazon Aurora MySQL','https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.AuroraMySQL.html'],['Azure Database for MySQL','https://learn.microsoft.com/azure/mysql/'],['Cloud SQL for MySQL','https://cloud.google.com/sql/docs/mysql']]};

/* ---------- 6 ---------- */
L['mysql:16:6']={blocks:[
{p:'**MySQL HeatWave** is Oracle in-memory query accelerator and machine learning engine attached to MySQL. It speeds up analytical queries over data that already lives in MySQL, without a separate warehouse or an ETL pipeline. It is available as a managed service on Oracle Cloud and also on AWS and Azure.'},
{h:'How it works'},
{flow:['A MySQL DB system holds the transactional data in InnoDB as usual','A **HeatWave cluster** of nodes loads selected tables into memory in a columnar, compressed format','Changes in InnoDB are propagated to the cluster automatically','When you run a query, the optimizer decides whether HeatWave can run it faster, and offloads it transparently','Transactions and small queries keep running in InnoDB, so applications use the same connection and SQL']},
{code:`ALTER TABLE shop.orders SECONDARY_ENGINE = RAPID;
ALTER TABLE shop.orders SECONDARY_LOAD;
EXPLAIN SELECT status, SUM(total) FROM shop.orders GROUP BY status;     -- shows use of the secondary engine
SET SESSION use_secondary_engine = FORCED;                              -- force or test offload`},
{h:'Capabilities'},
{t:[['Capability','What it offers'],
['Analytics acceleration','Massively parallel, in-memory execution for aggregations, joins and scans'],
['Lakehouse','Query data files (CSV, Parquet) in object storage with SQL, combined with MySQL tables'],
['AutoML','Train and use machine learning models with SQL procedures'],
['Vector store and generative AI','Create vector embeddings, store them and run similarity search in the database. The `VECTOR` data type exists in MySQL 9 releases, while the large-scale similarity features are part of the HeatWave offering. Check current documentation for what each edition includes'],
['Autopilot','Automation for provisioning, loading, query tuning and scaling decisions']]},
{h:'When it is a good fit'},
{ul:['You need real-time reporting on transactional data and do not want a second system.','Queries scan large tables with aggregations that are slow in InnoDB, even with indexes.','You already run MySQL in Oracle Cloud, or AWS and Azure support suits your platform.']},
{h:'Alternatives'},
{t:[['Option','Notes'],
['Read replica for reporting','Cheap and often enough for moderate analytics'],
['Data warehouse (BigQuery, Snowflake, Redshift, ClickHouse)','Best for very large, multi-source analytics, needs a data pipeline'],
['Summary tables and indexes','Many reports become fast with good schema design and precomputation'],
['Columnar extensions or separate OLAP stores','More moving parts, strong performance']]},
{note:'HeatWave is a commercial managed feature. Community Server does not include it. Evaluate it against the cost and the effort of a replica or a warehouse for your workload.'}],
src:[['MySQL HeatWave','https://dev.mysql.com/doc/heatwave/en/'],['MySQL 9 innovation releases',K.D+'mysql-nutshell.html']]};

/* ---------- 7 ---------- */
L['mysql:16:7']={blocks:[
{p:'Most production MySQL problems visible to users start in the **application connection layer**: wrong character sets, time zones, exhausted pools, missing timeouts and no retry logic. Getting this layer right is part of running MySQL well.'},
{h:'Connectors'},
{t:[['Language','Common connector'],
['Java','MySQL Connector/J, with HikariCP pool'],
['Python','mysqlclient, PyMySQL, MySQL Connector/Python'],
['Node.js','mysql2'],
['PHP','PDO MySQL (mysqlnd)'],
['Go','go-sql-driver/mysql'],
['.NET','MySqlConnector, MySQL Connector/NET']]},
{h:'The connection settings that matter'},
{ul:['**Character set:** `utf8mb4` on the connection, not only on the table.','**Time zone:** agree on UTC. Make the driver and the session time zone consistent, and know how it converts TIMESTAMP and DATETIME values.','**TLS:** `sslMode=VERIFY_IDENTITY` (or the equivalent) with the CA certificate.','**Timeouts:** connect timeout and read (socket) timeout, so a stalled server does not hang threads forever.','**Prepared statements:** use server-side or client-side parameter binding (never string concatenation).','**Autocommit and transactions:** know whether your framework starts transactions for you.']},
{code:`# Java JDBC
jdbc:mysql://router1:6446/shop?sslMode=VERIFY_IDENTITY&connectionTimeZone=UTC&characterEncoding=utf8mb4&connectTimeout=3000&socketTimeout=30000

# Python
mysql.connector.connect(host="router1", port=6446, user="app", database="shop", charset="utf8mb4", use_pure=False, ssl_ca="ca.pem", connection_timeout=3)`},
{h:'Connection pooling'},
{p:'Opening a connection is expensive (TCP, TLS, authentication). A **pool** keeps a set of open connections and lends them to requests.'},
{ul:['Keep the pool **small**. Starting points of 10 to 30 connections per application instance are common. Total connections across all instances must stay under `max_connections`.','More connections do not give more throughput once the server is busy. They add queueing and memory.','Set the pool **max lifetime** lower than the server `wait_timeout` and any proxy or firewall idle limit, so the pool never hands out a connection the server has already closed.','Validate or test connections on borrow, or use keep-alive.','Always **return** connections to the pool. Leaks are a leading cause of "Too many connections".']},
{h:'Failure handling'},
{ul:['Treat errors `2006`, `2013`, `1213`, `1205` and failover disconnects as **retryable**, with limited tries and backoff. Make operations idempotent.','Connect through **MySQL Router, ProxySQL or a DNS name** with a short TTL, so failover is followed.','Do not cache resolved addresses forever in the client.','Set application timeouts shorter than the load balancer and proxy timeouts so errors surface cleanly.']},
{h:'ORM pitfalls'},
{ul:['**N+1 queries:** lazy loading in a loop. Use eager joins or batch loading.','**`SELECT *`** loading wide columns. Select only needed fields.','**Unbounded result sets:** always paginate, stream large results.','**Hidden transactions** and long sessions that stay open across user think time.','Log the **slow queries from the application** side too and tag them with the code path (a comment or connection attribute), so the DBA can find the owner.']},
{code:`SELECT * FROM performance_schema.session_connect_attrs WHERE processlist_id = CONNECTION_ID();   -- program_name, _client_name, _os
SELECT /* checkout-service order-lookup */ id, status FROM orders WHERE id = ?;`},
{note:'Agree on a short connection checklist with every application team: charset, time zone, TLS, timeouts, pool size, retries and query tagging. It prevents many incidents.'}],
src:[['Connectors and APIs',K.MGT+'connectors-apis/'],['MySQL Connector/J','https://dev.mysql.com/doc/connector-j/en/']]};
})();
