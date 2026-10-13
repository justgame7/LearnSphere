/* LearnSphere - PostgreSQL Quick Reference (cheat sheet).
   window.QREF['pg'] = {title, blurb, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Blocks are the same as lessons: {h}, {p}, {t:[header,...rows]}, {code}, {note}, {ul}.
   Values are for PostgreSQL 18 on Linux unless stated. Check a default against your own server with: SELECT name, setting, unit, context FROM pg_settings WHERE name = '...'; */
window.QREF=window.QREF||{};
window.QREF.pg={title:'PostgreSQL Quick Reference',blurb:'Processes, files, locations, logs, parameters, views, tools and fixes on one page each. Use the search box to filter any page.',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every DBA should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one query or command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Architecture'},
{acc:[
{t:'Process-per-connection',s:'One operating-system process serves each client.',
 a:'The postmaster accepts a connection and forks a dedicated **backend** for it. Background processes (checkpointer, WAL writer, autovacuum) run beside the backends and share memory with them.',
 w:'Every connection costs memory and scheduling time. Thousands of idle connections hurt, so put a pooler such as PgBouncer in front.',
 c:`SELECT backend_type, count(*) FROM pg_stat_activity GROUP BY 1 ORDER BY 2 DESC;`,see:[2,1,'Backend process']},
{t:'Shared buffers and the OS cache',s:'PostgreSQL has its own page cache, and the kernel keeps another.',
 a:'Tables and indexes are read in 8 KB pages into `shared_buffers`. The operating system caches the same files too, so a page may exist twice. `effective_cache_size` only tells the planner how much caching to expect; it allocates nothing.',
 w:'`shared_buffers` is usually about a quarter of RAM. The cache hit ratio tells you whether the working set fits.',
 c:`SELECT round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) AS hit_pct
FROM pg_stat_database WHERE datname = current_database();`,see:[2,3,'Memory']},
{t:'Cluster, database, schema',s:'The object hierarchy, and what is shared at each level.',
 a:'A **cluster** is one data directory with one port and one WAL stream. It holds many **databases**, each isolated; a connection belongs to one database. A **schema** is a namespace inside a database. Roles and tablespaces belong to the whole cluster.',
 w:'"Cluster" is not a group of servers. A role you create is visible in every database, but its privileges are granted per object.',
 c:`SHOW data_directory;
SELECT datname FROM pg_database;
SELECT nspname FROM pg_namespace WHERE nspname !~ '^pg_';`,see:[4,3,'Cluster hierarchy']},
{t:'Template databases',s:'The models that CREATE DATABASE copies.',
 a:'`template1` is the editable default model: whatever you add to it appears in every new database. `template0` is a pristine copy that nobody may connect to; use it to create a database with a different encoding or locale.',
 w:'Encoding and locale are fixed when a database is created. Keep `template1` clean and use a named custom template for standard objects.',
 c:`SELECT datname, datistemplate, datallowconn FROM pg_database;`,see:[4,1,'DB creation and templates']}
]},

{h:'Storage and MVCC'},
{acc:[
{t:'MVCC',s:'Readers do not block writers.',
 a:'An `UPDATE` does not change a row in place: it writes a **new row version** and keeps the old one until no snapshot needs it. Each transaction sees a consistent snapshot of the data as it was when the transaction (or statement) began.',
 w:'Table growth, vacuum, long transactions, index-only scans and replication conflicts all follow from this one design choice.',
 c:`SELECT ctid, xmin, xmax, * FROM orders LIMIT 5;   -- row version identifiers`,see:[2,8,'MVCC internals']},
{t:'Dead tuples and bloat',s:'Space held by row versions nobody can see any more.',
 a:'Old versions become **dead tuples** once no transaction needs them. Until vacuum reclaims the space, tables and indexes keep growing. That extra, unused space is **bloat**.',
 w:'Bloat slows scans, wastes disk and pollutes the cache. A very high dead-tuple count usually means vacuum is blocked or too slow.',
 c:`SELECT relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 5;`,see:[4,9,'Table storage and bloat']},
{t:'VACUUM and autovacuum',s:'Cleanup, statistics and freezing, mostly automatic.',
 a:'`VACUUM` makes dead space reusable, updates the visibility and free space maps and freezes old rows. **Autovacuum** runs it by itself when a table crosses a threshold: `autovacuum_vacuum_threshold` + `autovacuum_vacuum_scale_factor` x rows (50 + 0.2 by default).',
 w:'The default scale factor is far too lazy for very large tables, so tune it per table. Plain `VACUUM` does not shrink the file; `VACUUM FULL` does but locks the table.',
 c:`SELECT pid, relid::regclass, phase, heap_blks_scanned, heap_blks_total FROM pg_stat_progress_vacuum;`,see:[10,1,'Autovacuum and VACUUM']},
{t:'Transaction ID wraparound',s:'32-bit transaction ids must be frozen.',
 a:'Transaction ids are 32-bit numbers compared in a circle, so a row older than about 2 billion transactions would look like it is from the future. **Freezing** marks old rows as visible to everyone. Anti-wraparound autovacuum is forced at `autovacuum_freeze_max_age` (200 million).',
 w:'If freezing is blocked long enough, PostgreSQL stops accepting writes to protect the data. Watch `age(datfrozenxid)` and alert early.',
 c:`SELECT datname, age(datfrozenxid) AS xid_age FROM pg_database ORDER BY 2 DESC;`,see:[10,1,'Autovacuum and VACUUM']},
{t:'HOT updates and fillfactor',s:'Updates that leave the indexes alone.',
 a:'If an update changes no indexed column and the page has free room, the new row version stays in the same page (a **heap-only tuple**), so no index entries are added. `fillfactor` below 100 leaves that room.',
 w:'Lowering `fillfactor` (for example to 85) on update-heavy tables reduces index bloat and write work.',
 c:`SELECT relname, n_tup_upd, n_tup_hot_upd FROM pg_stat_user_tables ORDER BY n_tup_upd DESC LIMIT 5;`,see:[4,9,'Table storage and bloat']},
{t:'TOAST',s:'Large values are stored out of line.',
 a:'A row must fit in an 8 KB page, so values over about 2 KB are compressed or moved to a separate **TOAST** table and replaced by a pointer. This is automatic.',
 w:'Wide text or `jsonb` columns make `SELECT *` expensive and add to the table size. `pg_total_relation_size` includes TOAST; `pg_relation_size` does not.',
 c:`SELECT pg_size_pretty(pg_relation_size('orders')) AS heap,
       pg_size_pretty(pg_table_size('orders')) AS with_toast,
       pg_size_pretty(pg_total_relation_size('orders')) AS with_indexes;`,see:[2,6,'PGDATA layout']}
]},

{h:'WAL and recovery'},
{acc:[
{t:'Write-ahead log (WAL)',s:'Record the change in the log first, write the data page later.',
 a:'Every change is described in a WAL record that must reach disk before the changed data page does. Commit only waits for the sequential WAL flush, not for the scattered data-file writes.',
 w:'One mechanism gives durability, crash recovery, point-in-time recovery and replication. A full WAL volume stops the database.',
 c:`SELECT pg_current_wal_lsn(), pg_walfile_name(pg_current_wal_lsn());`,see:[2,4,'WAL']},
{t:'Checkpoint',s:'The point where the data files catch up with the log.',
 a:'The checkpointer writes all dirty buffers to the data files and records a checkpoint in WAL. It runs every `checkpoint_timeout` (5 minutes) or when WAL reaches `max_wal_size`.',
 w:'Frequent forced checkpoints cause I/O spikes. Longer intervals smooth I/O but lengthen crash recovery.',
 c:`SELECT num_timed, num_requested, write_time, sync_time FROM pg_stat_checkpointer;`,see:[5,6,'WAL and checkpoint parameters']},
{t:'Crash recovery',s:'Replay the log from the last checkpoint.',
 a:'After an unclean shutdown the startup process reads WAL from the last checkpoint and redoes every logged change. Committed work reappears; uncommitted work leaves no effect.',
 w:'A fast or smart shutdown ends cleanly. An immediate shutdown, `kill -9` or a power cut forces recovery on the next start.',
 c:`pg_controldata $PGDATA | grep -i "cluster state"`,see:[2,11,'Crash recovery and timelines']},
{t:'Timelines',s:'Numbered branches of WAL history.',
 a:'Each promotion or point-in-time recovery starts a new timeline, so the new history cannot be confused with the old one. The timeline id is the first part of every WAL file name, and `.history` files record where branches split.',
 w:'Timelines matter for PITR targets, `pg_rewind` and rebuilding an old primary after a failover.',
 c:`pg_controldata $PGDATA | grep -i timeline`,see:[8,11,'PITR and timelines']}
]},

{h:'Backup and recovery'},
{acc:[
{t:'Logical vs physical backup',s:'Objects as SQL, or the files themselves.',
 a:'`pg_dump` writes the definition and data of one database (plain SQL or an archive) and restores into the same or a newer version. `pg_basebackup` copies the data files of the whole cluster, restores fast and is the base for PITR and standbys, but only to the same major version.',
 w:'Use both: dumps for selective, portable restores; base backups plus WAL for fast and point-in-time recovery.',
 c:`pg_dump -Fd -j 4 -f /backup/appdb appdb
pg_basebackup -D /backup/base -X stream -P`,see:[8,0,'Backup and restore']},
{t:'Point-in-time recovery (PITR)',s:'Restore a base backup, replay WAL to a chosen moment.',
 a:'Take a base backup, archive every WAL segment, and later replay the archive up to a time, an LSN, a transaction or a named restore point. Recovery needs `recovery.signal`, a `restore_command` and a `recovery_target_*` setting.',
 w:'It is the only way to return to the moment before a mistaken `DELETE` or `DROP`. Archiving must be running before the mistake.',
 c:`SHOW archive_mode;
SELECT archived_count, failed_count, last_archived_wal FROM pg_stat_archiver;`,see:[8,11,'Point-in-time recovery']},
{t:'RPO and RTO',s:'How much data you may lose, and how long you may be down.',
 a:'**RPO** (recovery point objective) is the data-loss target. **RTO** (recovery time objective) is the downtime target. A nightly dump gives an RPO up to a day; WAL archiving brings it to minutes; synchronous replication to about zero.',
 w:'The two numbers decide the method, the frequency, the retention and the cost. A backup that has never been restored is not yet a strategy.',
 c:`-- no query: write the targets down, then test a restore against them`,see:[8,8,'Backup strategy']},
{t:'Incremental backup (17 and later)',s:'Copy only the blocks that changed.',
 a:'With `summarize_wal` on, the server keeps WAL summaries. `pg_basebackup --incremental` then sends only changed blocks, and `pg_combinebackup` joins a chain into a normal full backup. Every backup has a manifest that `pg_verifybackup` checks.',
 w:'Daily backups of large clusters become much smaller and faster.',
 c:`SHOW summarize_wal;`,see:[8,12,'Incremental backups']}
]},

{h:'Replication and high availability'},
{acc:[
{t:'Physical vs logical replication',s:'A byte-for-byte copy, or row changes of chosen tables.',
 a:'**Physical** (streaming) replication ships WAL, and the standby is an identical copy of the whole cluster at the same major version. **Logical** replication decodes row changes of selected tables into publish and subscribe, and can cross versions.',
 w:'Use physical for high availability and read replicas, logical for selective copies and near-zero-downtime upgrades. A replica is never a backup.',
 c:`SELECT application_name, state, sync_state FROM pg_stat_replication;
SELECT * FROM pg_publication;`,see:[9,1,'Replication theory']},
{t:'Replication slots',s:'The primary keeps WAL until the consumer confirms it.',
 a:'A slot remembers how far a standby or subscriber has read, so the primary does not recycle WAL it still needs. `max_slot_wal_keep_size` limits how much an idle slot may hold.',
 w:'An abandoned slot is the most common cause of a full `pg_wal` disk. Monitor `wal_status` and drop slots nobody uses.',
 c:`SELECT slot_name, slot_type, active, wal_status,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained
FROM pg_replication_slots;`,see:[9,7,'Replication slots']},
{t:'Hot standby',s:'A standby that answers read-only queries.',
 a:'With `hot_standby = on` the standby serves reads while it replays WAL. A replayed record can conflict with a running query; replay then waits up to `max_standby_streaming_delay` before the query is cancelled.',
 w:'`hot_standby_feedback` reduces cancellations but lets a long standby query keep dead rows alive on the primary.',
 c:`SELECT pg_is_in_recovery();
SELECT datname, confl_snapshot, confl_lock FROM pg_stat_database_conflicts;`,see:[9,8,'Hot standby']},
{t:'Synchronous commit',s:'Trade commit latency for durability.',
 a:'By default replication is asynchronous: a commit is acknowledged once WAL is on the primary disk. With `synchronous_standby_names` set, commits wait for a standby, and `synchronous_commit` chooses how far (`local`, `remote_write`, `on`, `remote_apply`).',
 w:'Asynchronous replication can lose the last few transactions on failover. Synchronous replication closes that gap at the cost of latency and a hard dependency on the standby.',
 c:`SHOW synchronous_commit;
SELECT application_name, sync_state FROM pg_stat_replication;`,see:[9,9,'Synchronous replication']},
{t:'Switchover vs failover',s:'Planned role change, or emergency promotion.',
 a:'A **switchover** is planned: clean shutdown of the old primary, no data loss, and it can rejoin as a standby almost at once. A **failover** is unplanned: a standby is promoted and unreplicated transactions may be lost. Promotion starts a new timeline.',
 w:'PostgreSQL gives the building blocks; a failover manager (Patroni, repmgr) or a runbook decides when to use them.',
 c:`SELECT pg_promote();   -- or: pg_ctl promote -D $PGDATA`,see:[9,10,'Failover and switchover']},
{t:'Split brain and fencing',s:'Two primaries accepting writes.',
 a:'If the old primary is still reachable after a failover, both servers may accept writes and the data diverges beyond automatic repair. **Fencing** (STONITH) makes sure the old primary cannot write: power it off, cut its network or stop the VM.',
 w:'Fence first, then promote. Rebuild or `pg_rewind` the old primary before it rejoins.',
 c:`SELECT pg_is_in_recovery();   -- run on both servers: only one may say false`,see:[9,15,'Unplanned failover and fencing']}
]},

{h:'Security'},
{acc:[
{t:'Roles',s:'One concept for users and groups.',
 a:'A role can own objects and hold privileges. A "user" is a role with `LOGIN`; a "group" is a role that others are members of. Roles are cluster-wide, and names starting with `pg_` are reserved for predefined roles.',
 w:'Applications should not use superusers. Give each duty a role with only the privileges it needs.',
 c:`SELECT rolname, rolsuper, rolcanlogin, rolvaliduntil FROM pg_roles WHERE rolname !~ '^pg_';`,see:[6,0,'User management introduction']},
{t:'pg_hba.conf',s:'Who may connect from where, and how they prove it.',
 a:'Each line is `type database user address method`. Rules are checked from top to bottom and the **first match wins**. Methods include `scram-sha-256`, `peer`, `cert`, `reject` and the dangerous `trust`.',
 w:'A missing or wrong rule is the most common cause of "no pg_hba.conf entry". Check the file with `pg_hba_file_rules` before you reload.',
 c:`SELECT line_number, type, database, user_name, address, auth_method, error FROM pg_hba_file_rules;`,see:[6,1,'Authentication and authorization']},
{t:'SCRAM-SHA-256',s:'Password authentication that never sends the password.',
 a:'The server stores a salted, iterated verifier and the client proves it knows the password through a challenge. It is the default for new passwords since version 14; `md5` is deprecated in 18.',
 w:'A stored hash cannot be converted, so each user must set the password again when you migrate.',
 c:`SHOW password_encryption;
SELECT rolname FROM pg_authid WHERE rolpassword LIKE 'md5%';`,see:[6,9,'Passwords, SCRAM and TLS']},
{t:'The PUBLIC role',s:'A pseudo-role that contains every role, now and in the future.',
 a:'Privileges granted to `PUBLIC` apply to everyone. A new database gives `PUBLIC` the right to connect and create temporary tables, and new functions are executable by everyone.',
 w:'Revoke what you do not want shared, then grant to named roles. Since version 15 only the database owner can create objects in the `public` schema by default.',
 c:`SELECT datname, datacl FROM pg_database;`,see:[6,2,'Public role']},
{t:'Row-level security',s:'Per-row access rules inside one table.',
 a:'Once enabled on a table, every access must be allowed by a **policy**. `USING` filters existing rows; `WITH CHECK` validates new or changed ones. With no policy, nobody sees any row. Owners and superusers bypass it unless `FORCE ROW LEVEL SECURITY` is set.',
 w:'It is the standard tool for multi-tenant tables. With connection pooling set the tenant with `SET LOCAL` inside a transaction.',
 c:`SELECT schemaname, tablename, policyname, cmd FROM pg_policies;`,see:[6,6,'Row level security']},
{t:'Ownership and default privileges',s:'Who owns objects, and what future objects receive.',
 a:'Each object has one owner, who can alter and drop it and grant access. `GRANT ... ON ALL TABLES` only affects existing tables; `ALTER DEFAULT PRIVILEGES` decides what future tables receive.',
 w:'Own objects with a `NOLOGIN` role and let applications hold only DML privileges, so a compromised app cannot drop or grant.',
 c:`SELECT defaclrole::regrole, defaclobjtype, defaclacl FROM pg_default_acl;`,see:[6,8,'Ownership and default privileges']}
]},

{h:'Performance'},
{acc:[
{t:'Planner and statistics',s:'The cost-based optimizer chooses a plan from estimates.',
 a:'For each query the planner compares possible plans and picks the cheapest according to table statistics gathered by `ANALYZE` and cost settings such as `random_page_cost`. If the row estimates are wrong, the plan is wrong.',
 w:'Most "sudden slow query" cases are stale statistics or a changed plan. Compare estimated and actual rows in `EXPLAIN ANALYZE`.',
 c:`SELECT attname, n_distinct, null_frac FROM pg_stats WHERE tablename = 'orders';`,see:[2,9,'Query planner and EXPLAIN']},
{t:'EXPLAIN',s:'Shows the plan, and with ANALYZE the real timings.',
 a:'`EXPLAIN` prints the plan the planner chose. `EXPLAIN (ANALYZE, BUFFERS)` runs the statement and adds actual rows, time and buffer use. Look for large gaps between estimated and actual rows, sequential scans on big tables and sorts that spill to disk.',
 w:'`ANALYZE` really executes the statement, so wrap `INSERT`, `UPDATE` and `DELETE` in a transaction you roll back.',
 c:`EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE customer_id = 42;`,see:[10,2,'Performance tuning workflow']},
{t:'Index types',s:'Choose the structure that fits the query.',
 a:'`btree` is the default and handles equality, ranges and sorting. `gin` suits arrays, `jsonb` and text search, `gist` geometry and ranges, `brin` huge naturally ordered tables, `hash` equality only. Partial, expression and covering indexes narrow or widen what an index serves.',
 w:'Every index costs writes and space. Build with `CONCURRENTLY` on busy tables and remove unused ones.',
 c:`SELECT indexrelname, idx_scan FROM pg_stat_user_indexes WHERE relname = 'orders';`,see:[10,0,'Indexing']},
{t:'Isolation levels, locks and deadlocks',s:'How concurrent transactions see and block each other.',
 a:'The default level is `READ COMMITTED`: each statement sees a fresh snapshot. `REPEATABLE READ` keeps one snapshot per transaction, and `SERIALIZABLE` adds conflict detection and can fail with a serialization error. Writers on the same row wait for each other; two transactions waiting in a circle are a **deadlock**, and one is cancelled.',
 w:'Keep transactions short, lock rows in the same order and retry on `40001` and `40P01`.',
 c:`SHOW default_transaction_isolation;
SELECT pid, pg_blocking_pids(pid) AS blocked_by FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;`,see:[2,10,'Transactions, locking and deadlocks']},
{t:'work_mem',s:'Memory for each sort or hash, not for each connection.',
 a:'`work_mem` (4 MB by default) is granted per sort or hash operation in a query. A query with several such steps on many connections can use many times the value; when it does not fit, the operation spills to temporary files.',
 w:'Keep the global value modest and raise it per role or session for reporting work. `Sort Method: external merge  Disk` in a plan means it spilled.',
 c:`SHOW work_mem;
SELECT datname, temp_files, pg_size_pretty(temp_bytes) FROM pg_stat_database;`,see:[5,5,'Memory tuning parameters']},
{t:'Connection pooling',s:'Many clients, few server connections.',
 a:'Each connection is a process, so a pooler such as PgBouncer sits in front and reuses a small number of server connections. In **transaction** mode a server connection returns to the pool at the end of each transaction.',
 w:'Session state does not survive between transactions: use `SET LOCAL`, avoid session advisory locks and temporary tables.',
 c:`SELECT count(*) AS used, current_setting('max_connections')::int AS max FROM pg_stat_activity;`,see:[10,3,'Connection pooling with PgBouncer']},
{t:'Partitioning',s:'Split one big table into smaller physical pieces.',
 a:'Declarative partitioning (range, list or hash) routes each row to a partition by the partition key. Queries that filter on the bare key read only the matching partitions (**pruning**), and old data is removed by detaching or dropping a partition.',
 w:'Primary keys must include the partition key. Keep to tens or hundreds of partitions, and run `ANALYZE` on the parent yourself.',
 c:`SELECT * FROM pg_partition_tree('orders');`,see:[10,4,'Table partitioning']}
]},

{h:'Operations'},
{acc:[
{t:'Reload vs restart',s:'The parameter context decides.',
 a:'Each parameter has a **context**. `postmaster` parameters (for example `shared_buffers`, `max_connections`, `wal_level`) need a restart. `sighup` parameters and `pg_hba.conf` need only a reload. `user` and `superuser` parameters can also be set per session.',
 w:'A needless restart drops every connection; a missed restart leaves the old value in force. `pending_restart` shows what is waiting.',
 c:`SELECT name, setting, context, pending_restart FROM pg_settings WHERE pending_restart;
SELECT pg_reload_conf();`,see:[5,3,'Parameter reload or restart']},
{t:'Parameter precedence',s:'The most specific, latest setting wins.',
 a:'From lowest to highest: built-in default, `postgresql.conf`, `postgresql.auto.conf` (from `ALTER SYSTEM`), command line, database setting, role setting, role-in-database, connection options and finally session `SET`.',
 w:'This explains "I changed the file but `SHOW` still shows the old value". `pg_settings.source` and `pg_file_settings` show where a value came from.',
 c:`SELECT name, setting, source, sourcefile FROM pg_settings WHERE name = 'work_mem';`,see:[5,9,'Parameter precedence']},
{t:'Extensions',s:'Packaged add-ons installed per database.',
 a:'An extension bundles SQL objects (and often a library) and is installed with `CREATE EXTENSION`, once per database. Files must exist on the server for that major version. Some, such as `pg_stat_statements`, also need `shared_preload_libraries` and a restart.',
 w:'Check extension availability before an upgrade, because the new version needs its own libraries.',
 c:`SELECT extname, extversion FROM pg_extension;
SELECT name, default_version FROM pg_available_extensions ORDER BY 1 LIMIT 10;`,see:[4,7,'Contrib modules']},
{t:'Minor vs major upgrade',s:'Replace binaries, or migrate the data.',
 a:'A **minor** release (18.1 to 18.2) changes only code: install the new binaries and restart. A **major** release (17 to 18) can change the catalog format, so the old data directory cannot simply start: use `pg_upgrade`, dump and restore, or logical replication.',
 w:'Apply minor releases promptly (security and corruption fixes). Plan major upgrades before a version reaches end of life, which is five years after its release.',
 c:`SHOW server_version;`,see:[9,3,'Upgrade strategy']},
{t:'pg_upgrade',s:'In-place major upgrade that reuses the user data files.',
 a:'`pg_upgrade` creates the new catalogs and reuses (or copies, or hard-links with `--link`) the old data files, so even large databases upgrade in minutes. Run `--check` first, and refresh planner statistics afterwards.',
 w:'The new cluster needs its own binaries, matching extension libraries and compatible settings. Take a verified backup before you start.',
 c:`pg_upgrade --check -b /usr/pgsql-17/bin -B /usr/pgsql-18/bin -d /var/lib/pgsql/17/data -D /var/lib/pgsql/18/data`,see:[9,0,'Upgrade from 17 to 18']}
]}
]},



/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Eight small maps of how the parts fit together: the server, replication, backups, a row, a table on disk, pooling, partitions and upgrades.',see:[],b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why a DBA cares, one query to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. How a server fits together'},
{map:{title:'PostgreSQL server map',h:470,trace:'Trace an UPDATE',
 hint:'Tap any box, or press Trace an UPDATE to follow one write through the server.',
 groups:[{x:40,y:96,w:470,h:118,l:'Shared memory'},{x:40,y:246,w:600,h:108,l:'Disk'}],
 lines:[[170,42,228,42],[370,42,428,42],[460,64,460,94],[150,190,150,282],[350,190,350,282],[426,312,448,312],[350,340,350,388],[520,155,512,155]],
 nodes:[
 {id:'client',x:40,y:20,w:130,h:44,c:'ext',t:'Client apps',d:'Applications, psql, pgAdmin or a pooler. Each opens a connection to the server, by default on port 5432.',why:'Thousands of idle clients cost real memory, so a pooler such as PgBouncer sits here.',chk:`SELECT usename, state, count(*) FROM pg_stat_activity GROUP BY 1, 2;`,see:[10,3,'Connection pooling with PgBouncer']},
 {id:'postmaster',x:230,y:20,w:140,h:44,c:'proc',t:'Postmaster',d:'The parent of every server process. It reads the configuration, creates shared memory, starts the background processes and forks one backend per connection.',why:'It stays deliberately simple. If a child dies abnormally it resets shared memory and runs recovery, which clients see as a short disconnect.',chk:`head -1 $PGDATA/postmaster.pid`,see:[2,0,'The postmaster process']},
 {id:'backend',x:430,y:20,w:140,h:44,c:'proc',t:'Backends',d:'One process per client connection. It parses, plans and executes statements, reads pages through shared buffers and writes WAL records for changes.',why:'Each backend uses its own work_mem for sorts and hashes, so memory use scales with connections.',chk:`SELECT pid, state, wait_event, left(query, 40) FROM pg_stat_activity WHERE backend_type = 'client backend';`,see:[2,1,'The backend process']},
 {id:'sbuf',x:60,y:128,w:180,h:62,c:'mem',t:'Shared buffers',s:'8 KB page cache',d:'PostgreSQL page cache in shared memory. A backend reads a table page here; on a miss it is loaded from the data file, usually through the operating system cache.',why:'About a quarter of RAM is the usual start. The hit ratio tells you whether the working set fits.',chk:`SELECT round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) AS hit_pct FROM pg_stat_database WHERE datname = current_database();`,see:[2,3,'Memory']},
 {id:'wbuf',x:260,y:128,w:180,h:62,c:'mem',t:'WAL buffers',s:'Log not yet on disk',d:'A small shared area where backends place WAL records before they are flushed to the WAL files by the WAL writer or at commit.',why:'Commit speed depends on this flush reaching disk, not on data pages being written.',chk:`SELECT wal_records, wal_fpi, pg_size_pretty(wal_bytes) AS wal FROM pg_stat_wal;`,see:[2,4,'WAL']},
 {id:'bg',x:522,y:96,w:118,h:118,c:'proc',t:'Background',s:'checkpoint, vacuum',d:'Checkpointer (writes dirty pages and records a checkpoint), background writer, WAL writer, autovacuum, archiver and the WAL senders for replication.',why:'They keep the system durable and clean. When one falls behind you see bloat, forced checkpoints or WAL piling up.',chk:`SELECT backend_type, count(*) FROM pg_stat_activity GROUP BY 1 ORDER BY 2 DESC;`,see:[2,2,'Background processes']},
 {id:'data',x:60,y:282,w:170,h:58,c:'disk',t:'Data files',s:'base/, tables and indexes',d:'Tables and indexes as 8 KB pages under PGDATA/base, one folder per database. Pages are written here lazily by the checkpointer and background writer.',why:'They can lag behind the WAL. After a crash, WAL replay brings them up to date, which is why commits are safe.',chk:`SELECT pg_relation_filepath('orders');`,see:[2,6,'PGDATA layout']},
 {id:'wal',x:260,y:282,w:166,h:58,c:'disk',t:'WAL segments',s:'pg_wal, 16 MB each',d:'The write-ahead log. A change is recorded here before its data page is written, and a commit waits for this flush.',why:'It powers crash recovery, point-in-time recovery and replication. A full pg_wal volume stops the database.',chk:`SELECT pg_current_wal_lsn(), pg_walfile_name(pg_current_wal_lsn());`,see:[7,0,'WAL format']},
 {id:'archive',x:450,y:282,w:170,h:58,c:'disk',t:'WAL archive',s:'for PITR and standbys',d:'Completed WAL segments copied away by archive_command or an archive module. With a base backup it enables point-in-time recovery.',why:'If archiving fails, segments stay in pg_wal until it recovers, so watch it.',chk:`SELECT archived_count, failed_count, last_archived_wal FROM pg_stat_archiver;`,see:[8,11,'Point-in-time recovery']},
 {id:'standby',x:250,y:390,w:200,h:58,c:'ext',t:'Standby server',s:'replays the same WAL',d:'Another server that receives the WAL stream through a WAL sender and WAL receiver and replays it. Hot standby also serves read-only queries.',why:'It is your failover target and read replica, but never a backup: a bad DELETE is replicated too.',chk:`SELECT application_name, state, sync_state, replay_lag FROM pg_stat_replication;`,see:[9,2,'Streaming replication setup']}],
 steps:[
 {ids:['backend'],t:'1. The statement arrives and the row is found. The backend parses it, the planner picks a plan (usually an index scan on the key) and the executor asks for the table page. The transaction has a virtual id until its first write; a real transaction id is assigned then.',
  w:'Everything that follows depends on a good plan: the same UPDATE with a stale statistic can turn into a sequential scan of the whole table.',
  s:'Planner statistics (`ANALYZE`), `random_page_cost`, the indexes on the table.',
  x:'A stale plan shows as a long-running UPDATE and many `DataFileRead` waits. A row held by another transaction shows as a lock wait on `transactionid`.',
  c:`BEGIN;
EXPLAIN (ANALYZE, BUFFERS) UPDATE orders SET status = 'paid' WHERE id = 42;
ROLLBACK;`},
 {ids:['backend','sbuf'],t:'2. The page is read through shared buffers and a new row version is written. The buffer manager looks the page up; on a hit it is pinned, on a miss the 8 KB page is read from the data file (usually via the OS cache). The old version is marked ended (`xmax`) and the new version is written in the same page if there is room (a HOT update). The page is now dirty.',
  w:'Nothing is changed in place, so older snapshots still see the old row and no reader is blocked.',
  s:'`shared_buffers`, `fillfactor`, `effective_io_concurrency`.',
  x:'A low cache hit ratio shows as `DataFileRead` waits. A page without room forces a non-HOT update and extra index entries.',
  c:`SELECT round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) AS hit_pct
FROM pg_stat_database WHERE datname = current_database();`},
 {ids:['sbuf','wbuf'],t:'3. A WAL record is written. The change is described in a WAL record (heap update, plus an index entry if the update was not HOT) and placed in the WAL buffers, which assigns it a position (LSN). The first change to a page after a checkpoint also logs the whole page (a full-page image).',
  w:'The log must describe a change before the changed data page can reach disk, so recovery can always repeat it.',
  s:'`wal_level`, `full_page_writes`, `wal_compression`, `wal_buffers`.',
  x:'A burst of WAL after each checkpoint is the full-page images. Many concurrent writers can contend for the insert lock (`WALInsert` wait event).',
  c:`SELECT wal_records, wal_fpi, pg_size_pretty(wal_bytes) AS wal_written FROM pg_stat_wal;`},
 {ids:['wbuf','wal'],t:'4. COMMIT flushes the WAL. A commit record is written, then the WAL is flushed to disk up to that position. Only after the flush returns does the client receive COMMIT.',
  w:'One sequential flush is cheap. The data page may be scattered across the table and can be written later, because the WAL can always rebuild it.',
  s:'`synchronous_commit`, `wal_sync_method`, `commit_delay`, and `fsync` (never off in production).',
  x:'A slow WAL disk shows as `WALWrite` and `WALSync` waits on every session. With a synchronous standby, commits wait for it (`SyncRep`). A full `pg_wal` volume stops all writes.',
  c:`SELECT wait_event, count(*) FROM pg_stat_activity
WHERE wait_event IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;`},
 {ids:['bg','sbuf','data'],t:'5. The page reaches the data file later. The background writer trickles out dirty pages. The checkpointer writes all remaining ones, spread over `checkpoint_completion_target` of the interval, syncs the files and records a checkpoint.',
  w:'Spreading writes keeps I/O smooth, and the checkpoint tells recovery where to start replaying.',
  s:'`checkpoint_timeout`, `max_wal_size`, `checkpoint_completion_target`, `bgwriter_*`.',
  x:'Forced checkpoints (WAL reached `max_wal_size`) cause I/O spikes. Backends writing buffers themselves means the writers are not keeping up.',
  c:`SELECT num_timed, num_requested, write_time, sync_time FROM pg_stat_checkpointer;`},
 {ids:['wal','archive','standby'],t:'6. The WAL is archived and streamed. A WAL sender streams records to the standby as they are flushed. The archiver copies each full segment with `archive_command`. A segment is recycled once the checkpoint, the slots, the standbys and the archive no longer need it.',
  w:'The same log serves crash recovery, point-in-time recovery and replication, which is why it is never deleted by hand.',
  s:'`archive_mode`, `archive_command`, `max_wal_senders`, `wal_keep_size`, `max_slot_wal_keep_size`.',
  x:'A failing `archive_command` or an abandoned slot makes `pg_wal` grow until the disk is full.',
  c:`SELECT archived_count, failed_count, last_failed_wal FROM pg_stat_archiver;
SELECT slot_name, active, wal_status FROM pg_replication_slots;`}]}},

{h:'2. Replication and failover'},
{map:{title:'Streaming replication map',h:470,trace:'Trace a commit',
 hint:'Tap any box, or press Trace a commit to follow a transaction from the primary to a read on the standby.',
 groups:[{x:20,y:40,w:300,h:310,l:'Primary server'},{x:360,y:40,w:300,h:310,l:'Standby server'}],
 lines:[[150,106,178,106],[235,136,235,172],[190,136,110,172],[235,258,235,236],'M290 202 H340 V106 H388',[500,106,528,106],[585,136,585,172],[528,202,502,202],[95,234,95,378],[465,380,465,352]],
 nodes:[
 {id:'p-back',x:40,y:76,w:110,h:60,c:'proc',t:'Backends',s:'write, commit',d:'Client sessions on the primary. Every change is recorded as a WAL record, and a commit waits for the WAL flush.',why:'With synchronous replication a commit also waits for a standby to confirm, which is where replication affects latency.',chk:`SHOW synchronous_commit;`,see:[9,9,'Synchronous replication']},
 {id:'p-wal',x:180,y:76,w:110,h:60,c:'disk',t:'WAL',s:'pg_wal',d:'The write-ahead log on the primary. It is the single source for replication, archiving and crash recovery.',why:'It is kept until the archiver, the standbys and the slots no longer need it, so a lagging or abandoned consumer fills the disk.',chk:`SELECT pg_current_wal_lsn();`,see:[7,6,'WAL lifecycle']},
 {id:'p-arch',x:40,y:172,w:110,h:60,c:'proc',t:'Archiver',s:'archive_command',d:'Copies each full WAL segment to the archive.',why:'It lets a standby that fell too far behind catch up, and it is the base of point-in-time recovery.',chk:`SELECT last_archived_wal, last_failed_wal FROM pg_stat_archiver;`,see:[8,10,'Continuous archiving']},
 {id:'p-send',x:180,y:172,w:110,h:60,c:'proc',t:'WAL sender',s:'one per standby',d:'Streams WAL records to a standby over a replication connection as they are written.',why:'Check lag here. max_wal_senders must allow one per standby plus backups.',chk:`SELECT application_name, state, sync_state, replay_lag FROM pg_stat_replication;`,see:[9,1,'Replication theory']},
 {id:'p-slot',x:180,y:260,w:110,h:60,c:'warn',t:'Slot',s:'keeps the WAL',d:'A replication slot remembers how far a standby has read, so the primary does not recycle WAL it still needs.',why:'An abandoned slot is the most common cause of a full pg_wal. Limit it with max_slot_wal_keep_size.',chk:`SELECT slot_name, active, wal_status FROM pg_replication_slots;`,see:[9,7,'Replication slots']},
 {id:'s-recv',x:390,y:76,w:110,h:60,c:'proc',t:'WAL receiver',s:'writes WAL',d:'Receives the stream, writes it to the standby WAL and tells the primary how far it got.',why:'It is the standby end of the connection defined by primary_conninfo.',chk:`SELECT status, received_lsn, latest_end_lsn FROM pg_stat_wal_receiver;`,see:[9,2,'Streaming replication setup']},
 {id:'s-replay',x:530,y:76,w:110,h:60,c:'proc',t:'Startup',s:'replays WAL',d:'The startup process replays received WAL into the standby data files, continuously.',why:'Replay can be delayed by a conflicting query on a hot standby (see max_standby_streaming_delay).',chk:`SELECT pg_last_wal_replay_lsn(), now() - pg_last_xact_replay_timestamp() AS delay;`,see:[9,8,'Hot standby']},
 {id:'s-data',x:530,y:172,w:110,h:60,c:'disk',t:'Data files',s:'same as primary',d:'The standby copy of the data files, kept up to date by replay.',why:'Physical replication copies the whole cluster, so versions, architecture and paths must match.',chk:`SELECT pg_is_in_recovery();`,see:[9,1,'Replication theory']},
 {id:'s-read',x:390,y:172,w:110,h:60,c:'ext',t:'Read queries',s:'hot standby',d:'With hot_standby on, the standby answers read-only queries while it replays.',why:'A replica is a read scaler and a failover target, never a backup. A mistaken DELETE is replicated too.',chk:`SELECT datname, confl_snapshot, confl_lock FROM pg_stat_database_conflicts;`,see:[9,8,'Hot standby']},
 {id:'archive',x:40,y:380,w:150,h:58,c:'disk',t:'WAL archive',s:'for PITR and catch-up',d:'Long-term store of WAL segments, with base backups it enables point-in-time recovery.',why:'Keep it on separate storage and monitor it.',chk:`ls -l /archive | tail`,see:[8,11,'Point-in-time recovery']},
 {id:'manager',x:390,y:380,w:190,h:58,c:'ext',t:'Failover manager',s:'Patroni, repmgr, runbook',d:'PostgreSQL gives you promotion, timelines and pg_rewind but does not decide by itself that a primary is dead. A failover manager or a DBA following a runbook does.',why:'Fence the old primary before you promote, or you risk split brain.',chk:`SELECT pg_promote();`,see:[9,10,'Failover and switchover']}],
 steps:[
 {ids:['p-back'],t:'1. A transaction commits on the primary. The backend writes a commit record into the WAL buffers; the data pages stay in shared buffers.',
  w:'Replication ships the log, not data pages, so the log is all the standby needs.',
  s:'`wal_level` (replica or higher), `synchronous_commit`.',
  x:'With `wal_level = minimal` nothing can be streamed and a standby cannot connect.',
  c:`SHOW wal_level;
SHOW synchronous_commit;`},
 {ids:['p-back','p-wal'],t:'2. The WAL is flushed to disk in pg_wal. The commit is now durable on the primary.',
  w:'Durability on the primary comes first. Shipping to a standby is a separate step.',
  s:'`fsync`, `wal_sync_method`, `wal_writer_delay`.',
  x:'A slow WAL disk slows every commit (`WALWrite` and `WALSync` waits).',
  c:`SELECT pg_current_wal_flush_lsn();`},
 {ids:['p-wal','p-send','p-slot'],t:'3. A WAL sender streams the new records to the standby over a replication connection as soon as they are flushed. The slot remembers how far this standby has read.',
  w:'Streaming does not wait for a full 16 MB segment, so lag is normally well under a second.',
  s:'`max_wal_senders`, `max_replication_slots`, `wal_sender_timeout`, `max_slot_wal_keep_size`.',
  x:'No free WAL sender: the standby cannot connect. A slot nobody consumes keeps WAL and can fill pg_wal.',
  c:`SELECT application_name, state, sent_lsn, write_lsn, flush_lsn, replay_lsn FROM pg_stat_replication;`},
 {ids:['p-send','s-recv'],t:'4. The WAL receiver on the standby writes the records to its own WAL and reports its positions back. With synchronous replication the primary waits for this report before it tells the client that COMMIT succeeded.',
  w:'This is the only point where replication can slow the primary. `synchronous_commit` chooses how far the wait goes: `remote_write`, `on` or `remote_apply`.',
  s:'`synchronous_standby_names`, `synchronous_commit`, `primary_conninfo`, `wal_receiver_timeout`.',
  x:'A slow or unreachable synchronous standby makes commits wait (`SyncRep` wait event) until it returns or is removed from the list.',
  c:`SELECT application_name, sync_state, sync_priority FROM pg_stat_replication;`},
 {ids:['s-recv','s-replay','s-data'],t:'5. The startup process on the standby replays each record into the standby data files, in the same order as on the primary.',
  w:'Replay is a single process applying changes exactly as logged, which is why the standby is an exact copy.',
  s:'`hot_standby`, `max_standby_streaming_delay`, `recovery_min_apply_delay`.',
  x:'A long query that conflicts with replay either delays replay or is cancelled. A heavy write load can make the single replay process fall behind.',
  c:`SELECT pg_last_wal_replay_lsn(), now() - pg_last_xact_replay_timestamp() AS replay_delay;`},
 {ids:['s-data','s-read'],t:'6. A read-only query on the standby now sees the change. The gap between steps 2 and 5 is the replication lag.',
  w:'Reads on a standby are eventually consistent, unless you use `remote_apply`.',
  s:'`hot_standby_feedback`, `max_standby_streaming_delay`.',
  x:'Reading your own write from a replica right after commit can return the old data.',
  c:`SELECT now() - pg_last_xact_replay_timestamp() AS lag;   -- run on the standby`}]}},

{h:'3. Backup and recovery'},
{map:{title:'Backup and recovery map',h:490,trace:'Trace a recovery to 10:42',
 hint:'Tap any box, or press Trace a recovery to follow a point-in-time recovery.',
 groups:[],
 lines:[[340,72,105,128],[340,72,340,128],[105,178,105,226],[340,178,340,226],'M410 46 H570 V226',[105,276,105,326],[340,276,340,326],'M570 276 V351 H417',[340,376,340,414],[105,376,105,414]],
 nodes:[
 {id:'cluster',x:270,y:20,w:140,h:52,c:'disk',t:'Running cluster',s:'your data',d:'The live PostgreSQL cluster that you want to protect.',why:'Plan from the recovery goal backwards: RPO is how much you may lose, RTO is how long you may be down.',chk:`SHOW data_directory;`,see:[8,8,'Backup strategy']},
 {id:'dump',x:30,y:128,w:150,h:50,c:'proc',t:'pg_dump',s:'logical, per database',d:'Writes the definition and data of one database as SQL or an archive. Restores into the same or a newer major version.',why:'Portable and selective, but it cannot do point-in-time recovery.',chk:`pg_dump -Fd -j 4 -f /backup/appdb appdb`,see:[8,0,'Backup and restore']},
 {id:'basebackup',x:265,y:128,w:150,h:50,c:'proc',t:'pg_basebackup',s:'physical, whole cluster',d:'Copies the data files of the whole cluster while it runs, with the WAL needed to make the copy consistent.',why:'Fast to restore and the base for PITR and standbys, but only for the same major version.',chk:`pg_basebackup -D /backup/base -X stream -P`,see:[8,7,'Physical backup']},
 {id:'dumpfile',x:30,y:226,w:150,h:50,c:'disk',t:'Dump file',s:'SQL or archive',d:'The logical backup file or directory.',why:'Store a copy off the server and test that it restores.',chk:`file /backup/appdb`,see:[8,1,'Backup formats']},
 {id:'basecopy',x:265,y:226,w:150,h:50,c:'disk',t:'Base backup',s:'a copy of PGDATA',d:'A consistent copy of the cluster at one moment in time, with a backup label.',why:'On its own it restores to the end of the backup. With archived WAL it restores to any later moment.',chk:`ls /backup/base`,see:[8,7,'Physical backup']},
 {id:'archive',x:500,y:226,w:140,h:50,c:'disk',t:'WAL archive',s:'every WAL segment',d:'Every completed WAL segment, copied by archive_command as it fills.',why:'It must exist before the mistake. You cannot add history afterwards.',chk:`SELECT archived_count, failed_count FROM pg_stat_archiver;`,see:[8,10,'Continuous archiving']},
 {id:'restore',x:30,y:326,w:150,h:50,c:'proc',t:'pg_restore',s:'or psql for plain dumps',d:'Replays a plain dump with psql or an archive dump with pg_restore, optionally in parallel.',why:'Restore into a new database created from template0, then run ANALYZE.',chk:`pg_restore -j 4 -d appdb_new /backup/appdb`,see:[8,3,'Restore']},
 {id:'replay',x:265,y:326,w:150,h:50,c:'proc',t:'Recovery',s:'copy back, replay WAL',d:'Copy the base backup back, create recovery.signal, set restore_command and a recovery target, then start the server. It replays archived WAL up to the target.',why:'This is how you return to the moment before a bad DELETE or DROP.',chk:`SELECT pg_is_in_recovery();`,see:[8,11,'Point-in-time recovery']},
 {id:'newdb',x:30,y:414,w:150,h:50,c:'mem',t:'Restored database',s:'to the dump moment',d:'The database as it was when the dump started.',why:'Anything after the dump is lost, which is the RPO of a logical backup.',chk:`SELECT count(*) FROM orders;`,see:[8,5,'Restore practicals']},
 {id:'recovered',x:265,y:414,w:150,h:50,c:'mem',t:'Recovered cluster',s:'to the target time',d:'The whole cluster at the target you chose, running on a new timeline after promotion.',why:'Check the data before you promote and reopen it to applications.',chk:`SELECT pg_wal_replay_resume();`,see:[8,11,'Point-in-time recovery']}],
 steps:[
 {ids:['cluster','basebackup','basecopy','archive'],t:'Before the mistake: a base backup exists and every WAL segment since it started has been archived.',
  w:'Point-in-time recovery needs both. The base backup is the starting state and the WAL holds every change after it.',
  s:'`archive_mode = on`, `archive_command`, `wal_level`.',
  x:'If archiving failed for some period there is a gap in the WAL, and recovery cannot pass it.',
  c:`SELECT last_archived_wal, last_failed_wal FROM pg_stat_archiver;`},
 {ids:['basecopy','replay'],t:'1. A DELETE at 10:43 removed data. Copy the base backup into an empty data directory, on a new host or beside the damaged one.',
  w:'Never restore over the only copy of the damaged cluster. Keep it until the recovery is proven.',
  s:'`pg_basebackup` plain or tar format, `tablespace_map` for tablespaces.',
  x:'Wrong owner or a mode other than 0700 stops the server from starting.',
  c:`ls -ld /var/lib/pgsql/18/data    # must be 0700 and owned by postgres`},
 {ids:['replay','archive'],t:'2. Create `recovery.signal` and set `restore_command` (how to fetch archived WAL) and a target such as `recovery_target_time = 2026-10-13 10:42:00`.',
  w:'The signal file tells the server to recover instead of starting normally. The target tells it where to stop.',
  s:'`restore_command`, `recovery_target_time`, `recovery_target_lsn`, `recovery_target_name`, `recovery_target_action`.',
  x:'A wrong `restore_command` shows as "could not restore file" in the log and recovery stops at the end of the base backup.',
  c:`grep -E "restore_command|recovery_target" $PGDATA/postgresql.auto.conf`},
 {ids:['replay','archive'],t:'3. Start the server. It replays the archived WAL in order from the base backup position and stops at the target. The log shows each file it restored.',
  w:'Replay repeats exactly what happened, so the cluster reaches the state it had at 10:42.',
  s:'`recovery_prefetch`, `hot_standby` (read-only access while recovering).',
  x:'A missing WAL segment ends recovery early and the server may stay in recovery mode.',
  c:`SELECT pg_is_in_recovery(), pg_last_wal_replay_lsn();`},
 {ids:['replay','recovered'],t:'4. Check the data while recovery is paused at the target, then promote. A new timeline begins, so the old history cannot be mixed in.',
  w:'If the target was wrong, restore the base backup again and try another time, because the archive is untouched.',
  s:'`recovery_target_action` (pause, promote, shutdown), `recovery_target_timeline`.',
  x:'Promoting before checking makes the new timeline final.',
  c:`SELECT pg_wal_replay_resume();    -- or: SELECT pg_promote();`}]}},

{h:'4. Life of a row: MVCC and vacuum'},
{map:{title:'Life of a row map',h:330,trace:'Follow one row',
 hint:'Tap any box, or press Follow one row to see what happens to a row over time.',
 groups:[],
 lines:[[170,60,188,60],[320,60,338,60],[470,60,488,60],[555,92,555,180],[405,210,405,92]],
 nodes:[
 {id:'insert',x:40,y:30,w:130,h:60,c:'mem',t:'INSERT',s:'row version v1',d:'A new row is written as version v1, stamped with the transaction that created it (xmin).',why:'The row is visible to transactions whose snapshot is later than that xmin.',chk:`SELECT ctid, xmin, xmax, * FROM orders LIMIT 3;`,see:[2,8,'MVCC internals']},
 {id:'update',x:190,y:30,w:130,h:60,c:'mem',t:'UPDATE',s:'v2 added, v1 kept',d:'An update does not change v1. It writes a new version v2 and marks v1 as ended by this transaction (xmax).',why:'Readers that started earlier still see v1; nobody is blocked. Indexes may also get new entries unless the update is HOT.',chk:`SELECT n_tup_upd, n_tup_hot_upd FROM pg_stat_user_tables WHERE relname = 'orders';`,see:[4,9,'Table storage']},
 {id:'dead',x:340,y:30,w:130,h:60,c:'warn',t:'Dead tuple',s:'v1, nobody needs it',d:'Once no running snapshot can see v1, it is a dead tuple. It still occupies space in the page and in the indexes.',why:'This is bloat in the making. Dead tuples cannot be removed while an older transaction might need them.',chk:`SELECT relname, n_dead_tup, last_autovacuum FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 5;`,see:[4,9,'Table storage and bloat']},
 {id:'vacuum',x:490,y:30,w:130,h:60,c:'proc',t:'VACUUM',s:'cleans, freezes',d:'Removes dead tuples and their index entries, updates the free space and visibility maps and freezes old rows. Autovacuum starts it by thresholds.',why:'Plain VACUUM makes space reusable inside the table. It does not shrink the file; VACUUM FULL does but locks the table.',chk:`SELECT pid, relid::regclass, phase FROM pg_stat_progress_vacuum;`,see:[10,1,'Autovacuum and VACUUM']},
 {id:'reuse',x:490,y:180,w:130,h:60,c:'mem',t:'Space reused',s:'by new row versions',d:'The cleaned space goes back to the free space map and new row versions are written into it.',why:'A healthy table stops growing once vacuum keeps up with updates.',chk:`SELECT pg_size_pretty(pg_relation_size('orders'));`,see:[10,1,'Autovacuum and VACUUM']},
 {id:'blocker',x:330,y:210,w:150,h:60,c:'warn',t:'Blockers',s:'old transactions, slots',d:'A long-running transaction, an idle-in-transaction session, an abandoned replication slot or a standby with feedback holds back the oldest snapshot.',why:'While they exist vacuum cannot remove the dead tuples, so the table keeps growing. Find and end them first.',chk:`SELECT pid, state, now() - xact_start AS age FROM pg_stat_activity WHERE xact_start IS NOT NULL ORDER BY xact_start LIMIT 5;`,see:[10,1,'Autovacuum and VACUUM']}],
 steps:[
 {ids:['insert'],t:'1. INSERT writes row version v1 into a heap page and stamps it with the creating transaction id (`xmin`).',
  w:'Visibility is decided by comparing these stamps with each transaction snapshot.',
  s:'`fillfactor` (room left free in each page).',
  x:'Wide values move to the TOAST table. A full page means the row goes to a new page.',
  c:`SELECT ctid, xmin, xmax FROM orders WHERE id = 1;`},
 {ids:['insert','update'],t:'2. UPDATE does not change v1. It writes a new version v2 and sets `xmax` on v1 to the updating transaction. Older snapshots still see v1.',
  w:'This is MVCC: writers never block readers.',
  s:'`fillfactor`. A HOT update needs that no indexed column changes and that the page has room.',
  x:'Non-HOT updates also add index entries, so heavily updated and indexed tables bloat quickly.',
  c:`SELECT n_tup_upd, n_tup_hot_upd FROM pg_stat_user_tables WHERE relname = 'orders';`},
 {ids:['update','dead'],t:'3. Once no running transaction can see v1, it is a dead tuple. It still takes space in the page and in the indexes.',
  w:'Dead tuples are not removed at commit. Cleaning is a separate, batched job.',
  s:'`autovacuum_vacuum_scale_factor`, `autovacuum_vacuum_threshold`.',
  x:'A high `n_dead_tup` together with a recent `last_autovacuum` usually means something blocks the cleanup.',
  c:`SELECT relname, n_dead_tup, last_autovacuum FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 5;`},
 {ids:['dead','blocker'],t:'Warning: the oldest running transaction, an idle-in-transaction session, a replication slot or a standby with feedback holds back the cleanup horizon. v1 cannot be removed while something might still need it.',
  w:'The horizon is cluster-wide, so one forgotten session can bloat every table.',
  s:'`idle_in_transaction_session_timeout`, `transaction_timeout` (17+), `max_slot_wal_keep_size`.',
  x:'Tables keep growing although autovacuum runs, and the log says "oldest xmin is far in the past".',
  c:`SELECT pid, state, now() - xact_start AS age FROM pg_stat_activity
WHERE xact_start IS NOT NULL ORDER BY xact_start LIMIT 5;`},
 {ids:['dead','vacuum'],t:'4. VACUUM removes dead tuples and their index entries, records free space in the free space map and sets visibility map bits. Autovacuum starts it when the threshold is crossed.',
  w:'Index entries must go too, which is why vacuum scans the indexes (in parallel if enabled).',
  s:'`autovacuum_max_workers`, `autovacuum_vacuum_cost_limit`, `maintenance_work_mem`.',
  x:'Throttled vacuum on a very large table can run for hours. The default scale factor of 0.2 waits for 20 percent dead rows.',
  c:`SELECT pid, relid::regclass, phase, heap_blks_scanned, heap_blks_total FROM pg_stat_progress_vacuum;`},
 {ids:['vacuum','reuse'],t:'5. New row versions are written into the freed space. The file does not shrink, but it stops growing.',
  w:'Giving space back to the operating system needs a rewrite (`VACUUM FULL` or an online tool).',
  s:'`vacuum_truncate`; `pg_repack` for an online rewrite.',
  x:'`VACUUM FULL` takes an exclusive lock for the whole rewrite and needs room for a full copy.',
  c:`SELECT pg_size_pretty(pg_relation_size('orders'));`}]}},

{h:'5. Where a table lives on disk'},
{map:{title:'Where a table lives on disk',h:350,trace:'Follow orders to a file',
 hint:'Tap any box, or press Follow orders to a file to walk from the table name to the bytes on disk.',
 groups:[],
 lines:[[210,58,248,58],[420,58,458,58],[125,150,330,88],[500,86,380,148],[550,86,550,148],'M460 72 H440 V278 H422','M640 58 H662 V278 H642'],
 nodes:[
 {id:'pgclass',x:40,y:30,w:170,h:56,c:'ext',t:'pg_class',s:'oid and relfilenode',d:'The catalog row for every table, index and sequence. Its oid is the permanent identity; relfilenode is the number of the file that holds it right now.',why:'relfilenode changes when the relation is rewritten (VACUUM FULL, TRUNCATE, CLUSTER, REINDEX), so never hard-code a file name.',chk:`SELECT oid, relname, relfilenode, reltablespace FROM pg_class WHERE relname = 'orders';`,see:[4,0,'Catalog views']},
 {id:'dbdir',x:250,y:30,w:170,h:56,c:'disk',t:'base/ folder',s:'one per database oid',d:'Every database has a folder named by its oid under PGDATA/base. Tables in the default tablespace live inside it.',why:'Knowing this lets you map a file on disk to a database and a table when you investigate space or corruption.',chk:`SELECT oid, datname FROM pg_database;`,see:[2,6,'PGDATA layout']},
 {id:'main',x:460,y:30,w:180,h:56,c:'disk',t:'Main file',s:'8 KB pages, 1 GB per file',d:'The table data as numbered 8 KB pages. Past 1 GB the file continues as .1, .2 and so on. A row is addressed by ctid: (page number, item number).',why:'The page is the unit of I/O and caching, so wide rows and low fillfactor directly change how many pages a query reads.',chk:`SELECT pg_relation_filepath('orders'), pg_size_pretty(pg_relation_size('orders'));`,see:[4,9,'Table storage']},
 {id:'tblspc',x:40,y:150,w:170,h:56,c:'ext',t:'Tablespace',s:'pg_tblspc symlink',d:'A named directory outside PGDATA. For a table in a user tablespace the path goes through a symbolic link in pg_tblspc to that directory.',why:'Tablespaces are a placement tool for disks. They must be included in every physical backup and replicated to standbys with the same paths.',chk:`SELECT spcname, pg_tablespace_location(oid) FROM pg_tablespace;`,see:[7,1,'Tablespace creation']},
 {id:'fsm',x:250,y:150,w:170,h:56,c:'disk',t:'Free space map',s:'_fsm fork',d:'A small companion file that records how much free space each page has, so inserts can find room without scanning the table.',why:'Vacuum keeps it current. After heavy deletes without vacuum, inserts keep extending the file.',chk:`SELECT pg_size_pretty(pg_relation_size('orders', 'fsm'));`,see:[4,9,'Table storage']},
 {id:'vm',x:460,y:150,w:180,h:56,c:'disk',t:'Visibility map',s:'_vm fork',d:'Two bits per page: all rows visible to everyone, and all rows frozen. Vacuum sets them.',why:'Index-only scans skip the table when the page is all-visible, and vacuum skips those pages too.',chk:`SELECT pg_size_pretty(pg_relation_size('orders', 'vm'));`,see:[10,0,'Indexing']},
 {id:'toast',x:250,y:250,w:170,h:56,c:'disk',t:'TOAST table',s:'values over about 2 KB',d:'Large values are compressed or moved out of line into a separate table, and the main row keeps only a pointer.',why:'SELECT * on a table with wide jsonb or text columns reads the TOAST data too; select only the columns you need.',chk:`SELECT reltoastrelid::regclass FROM pg_class WHERE relname = 'orders';`,see:[2,6,'PGDATA layout']},
 {id:'index',x:460,y:250,w:180,h:56,c:'disk',t:'Index files',s:'own relfilenode each',d:'Each index is a separate relation with its own file and forks, in the same database folder.',why:'Index size counts toward the total size of the table. pg_total_relation_size includes them.',chk:`SELECT indexrelid::regclass, pg_size_pretty(pg_relation_size(indexrelid)) FROM pg_index WHERE indrelid = 'orders'::regclass;`,see:[10,0,'Indexing']}],
 steps:[
 {ids:['pgclass'],t:'1. Look the table up in pg_class. Its oid and relfilenode say which file holds it, and reltablespace says where.',w:'The name of a table never appears on disk, only numbers.',s:'`pg_relation_filepath()`, `oid2name`.',x:'Using an old relfilenode after a rewrite points at a file that no longer exists.',c:`SELECT pg_relation_filepath('orders');`},
 {ids:['pgclass','tblspc','dbdir'],t:'2. Find the folder. The database oid gives base/<oid>. A table in a user tablespace goes through a symlink in pg_tblspc to the tablespace directory.',w:'A tablespace is only a directory, so moving one is a file operation plus one link.',s:'`default_tablespace`, `temp_tablespaces`.',x:'A missing tablespace directory on a standby stops WAL replay.',c:`SELECT oid, datname FROM pg_database;`},
 {ids:['dbdir','main'],t:'3. Read the main file. It is a series of 8 KB pages numbered from 0; a row address (ctid) is (page, item). After 1 GB the file continues in .1, .2.',w:'The page is what the buffer cache and the disk handle, so page count is what scans cost.',s:'`fillfactor`, block size (fixed at build time).',x:'Corruption is reported as "invalid page in block N of relation".',c:`SELECT ctid, * FROM orders LIMIT 3;`},
 {ids:['main','fsm','vm'],t:'4. Companion forks sit next to it. The free space map tells inserts where there is room. The visibility map marks pages whose rows are all visible, which index-only scans and vacuum use.',w:'They are small, rebuilt by vacuum and safe to ignore until something is slow or bloated.',s:'`vacuum_truncate`, autovacuum settings.',x:'Index-only scans fall back to the table when the visibility map is stale.',c:`SELECT relname, n_dead_tup, last_autovacuum FROM pg_stat_user_tables WHERE relname = 'orders';`},
 {ids:['main','toast','index'],t:'5. Large values live in the TOAST table, and each index is its own file. pg_total_relation_size adds the table, TOAST and indexes together.',w:'This explains why a table can look small in a dump but large on disk.',s:'Column `STORAGE` settings, `toast_tuple_target`.',x:'Unexpected size is often TOAST or index bloat, not the heap.',c:`SELECT pg_size_pretty(pg_table_size('orders')) AS table_toast, pg_size_pretty(pg_indexes_size('orders')) AS indexes;`}]}},

{h:'6. Connection pooling'},
{map:{title:'Connection pooling map',h:340,trace:'Follow one transaction',
 hint:'Tap any box, or press Follow one transaction to see how a pooler shares a few connections.',
 groups:[],
 lines:[[190,58,258,58],[420,58,488,58],[340,86,340,148],[190,178,258,178],[420,178,488,178],[340,260,340,208]],
 nodes:[
 {id:'apps',x:40,y:30,w:150,h:56,c:'ext',t:'Clients',s:'say 1,000 connections',d:'Application servers and tools. Many of them keep a connection open all day and use it only briefly.',why:'Each direct connection is a PostgreSQL process, so idle clients still cost memory and scheduling.',chk:`SELECT count(*) FROM pg_stat_activity WHERE backend_type = 'client backend';`,see:[10,3,'Connection pooling']},
 {id:'pgb',x:260,y:30,w:160,h:56,c:'proc',t:'PgBouncer',s:'port 6432',d:'A lightweight pooler. It accepts client connections itself and borrows server connections only when a client has work to do.',why:'It lets you run hundreds or thousands of clients against a small, efficient set of backends.',chk:`psql -p 6432 -U pgbadmin pgbouncer -c "SHOW POOLS;"`,see:[10,3,'Connection pooling']},
 {id:'pg',x:490,y:30,w:150,h:56,c:'proc',t:'PostgreSQL',s:'port 5432',d:'The database server. It now sees only the pooler connections, so max_connections can stay modest.',why:'More active backends than CPU cores adds contention, not throughput.',chk:`SHOW max_connections;`,see:[5,11,'Connection parameters']},
 {id:'queue',x:40,y:150,w:150,h:56,c:'warn',t:'Waiting clients',s:'cl_waiting',d:'Clients that asked for work while every server connection in the pool was busy. They wait here, in order.',why:'A growing queue means the pool is too small or queries are too slow. This is the number to alert on.',chk:`SHOW POOLS;   -- cl_waiting, maxwait`,see:[10,3,'Connection pooling']},
 {id:'pool',x:260,y:150,w:160,h:56,c:'mem',t:'Pool',s:'default_pool_size',d:'A set of ready server connections per database and user pair. A client gets one for the length of a transaction in transaction mode.',why:'Pool size is roughly two to four times the number of CPU cores, then tuned by measuring.',chk:`SHOW CONFIG;   -- default_pool_size, pool_mode`,see:[10,3,'Connection pooling']},
 {id:'backends',x:490,y:150,w:150,h:56,c:'proc',t:'Backends',s:'a few dozen',d:'The real PostgreSQL processes serving the pool. They stay open and are reused, so connection setup cost is paid once.',why:'The sum of all pools plus reserved connections must stay below max_connections.',chk:`SELECT usename, count(*) FROM pg_stat_activity GROUP BY 1;`,see:[5,11,'Connection parameters']},
 {id:'admin',x:260,y:260,w:160,h:56,c:'ext',t:'Admin console',s:'database pgbouncer',d:'A virtual database where SHOW POOLS, SHOW STATS, RELOAD, PAUSE and RESUME are available.',why:'PAUSE is how you drain connections for a switchover or maintenance without errors in the application.',chk:`PAUSE appdb;
RESUME appdb;`,see:[10,3,'Connection pooling']}],
 steps:[
 {ids:['apps','pgb'],t:'1. A client connects to PgBouncer, not to PostgreSQL. PgBouncer authenticates it with auth_file or auth_query. This costs almost nothing, so thousands of clients are fine.',w:'The expensive part (a process, memory, TLS to the server) is not paid per client.',s:'`max_client_conn`, `auth_type`, `auth_query`.',x:'Hitting `max_client_conn` rejects clients with "no more connections allowed".',c:`SHOW CLIENTS;`},
 {ids:['pgb','pool'],t:'2. The client sends BEGIN and a statement. PgBouncer takes a free server connection from the pool and attaches it to this client. If none is free, the client waits in the queue.',w:'In transaction mode a server connection is held only for the length of a transaction.',s:'`pool_mode`, `default_pool_size`, `reserve_pool_size`, `query_wait_timeout`.',x:'A full pool shows as `cl_waiting` above zero and rising `maxwait`.',c:`SHOW POOLS;`},
 {ids:['pool','backends','pg'],t:'3. The statements run on a real backend. Session state such as SET (without LOCAL), temporary tables, advisory session locks and LISTEN belongs to that server connection, not to the client.',w:'This is the compromise of transaction pooling: efficient, but the session is not private.',s:'Use `SET LOCAL`, avoid session-level features, or choose session pool mode.',x:'Settings that vanish between transactions, or prepared statements that "do not exist" with older PgBouncer versions.',c:`SHOW CONFIG;   -- max_prepared_statements`},
 {ids:['backends','pool'],t:'4. COMMIT ends the transaction and the server connection goes straight back to the pool, ready for another client.',w:'A short transaction frees the connection at once, which is why short transactions scale.',s:'`server_idle_timeout`, `server_lifetime`.',x:'An application that holds a transaction open (idle in transaction) keeps its server connection and starves the pool.',c:`SELECT state, count(*) FROM pg_stat_activity GROUP BY 1;`},
 {ids:['queue','pool'],t:'5. The next waiting client takes it. Under load a few dozen backends serve thousands of clients, because most clients are idle most of the time.',w:'Throughput is set by cores and I/O, not by the number of connections.',s:'`default_pool_size`, `max_db_connections`.',x:'A pool larger than the server can run just moves the queue into PostgreSQL.',c:`SHOW STATS;   -- avg_query_time, avg_wait_time`}]}},

{h:'7. Partitioning and pruning'},
{map:{title:'Partitioning map',h:360,trace:'Run a query for February',
 hint:'Tap any box, or press Run a query for February to see which partitions are read.',
 groups:[],
 lines:[[210,58,258,58],[420,58,488,58],[340,86,105,150],[340,86,255,150],[340,86,405,150],[340,86,565,150],[255,206,255,258]],
 nodes:[
 {id:'query',x:40,y:30,w:170,h:56,c:'ext',t:'Query',s:'WHERE created_at in Feb',d:'A normal SQL statement. It does not name a partition; it filters on the partition key.',why:'Filtering on the bare key column is what makes pruning possible.',chk:`EXPLAIN SELECT * FROM orders WHERE created_at >= '2026-02-01' AND created_at < '2026-03-01';`,see:[10,4,'Table partitioning']},
 {id:'parent',x:260,y:30,w:160,h:56,c:'proc',t:'Parent table',s:'holds no rows',d:'The logical table that applications use. It only stores the partitioning rule and routes rows to partitions.',why:'Primary keys and unique constraints must include the partition key, because there is no global index.',chk:`SELECT * FROM pg_partition_tree('orders');`,see:[10,4,'Table partitioning']},
 {id:'planner',x:490,y:30,w:150,h:56,c:'proc',t:'Planner',s:'partition pruning',d:'Compares the filter with each partition bound and keeps only partitions that can hold matching rows. It also prunes at run time for parameters.',why:'Pruning is the main query benefit of partitioning. Without a filter on the key, every partition is scanned.',chk:`SHOW enable_partition_pruning;`,see:[2,9,'Query planner']},
 {id:'p1',x:40,y:150,w:130,h:56,c:'disk',t:'orders_2026_01',s:'Jan',d:'A partition is an ordinary table with its own files, indexes and vacuum. This one is outside the filter and is skipped.',why:'Small partitions vacuum and index faster and fit in cache.',chk:`SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) FROM pg_class WHERE relname LIKE 'orders_2026%';`,see:[10,4,'Table partitioning']},
 {id:'p2',x:190,y:150,w:130,h:56,c:'mem',t:'orders_2026_02',s:'Feb: read',d:'The only partition whose range overlaps the filter, so the only one scanned.',why:'The upper bound of a range partition is exclusive: 1 March belongs to the next partition.',chk:`EXPLAIN SELECT count(*) FROM orders WHERE created_at >= '2026-02-01' AND created_at < '2026-03-01';`,see:[10,4,'Table partitioning']},
 {id:'p3',x:340,y:150,w:130,h:56,c:'disk',t:'orders_2026_03',s:'Mar',d:'Another partition, skipped for this query.',why:'Create the next partitions ahead of time. A row with no matching partition fails unless a default partition exists.',chk:`SELECT inhrelid::regclass FROM pg_inherits WHERE inhparent = 'orders'::regclass ORDER BY 1;`,see:[10,4,'Table partitioning']},
 {id:'pdef',x:490,y:150,w:150,h:56,c:'warn',t:'Default partition',s:'rows with no home',d:'Catches rows that fit no other partition. It is a safety net, not a place to keep data.',why:'A large default partition slows attaching new partitions, because it must be scanned for conflicting rows.',chk:`SELECT count(*) FROM orders_default;`,see:[10,4,'Table partitioning']},
 {id:'detach',x:155,y:258,w:200,h:56,c:'proc',t:'Detach and drop',s:'retention in seconds',d:'ALTER TABLE ... DETACH PARTITION ... CONCURRENTLY removes a partition from the table without blocking queries; then archive or drop it.',why:'Deleting a month with DELETE writes WAL, leaves bloat and takes hours; detaching takes seconds.',chk:`ALTER TABLE orders DETACH PARTITION orders_2025_01 CONCURRENTLY;`,see:[10,4,'Table partitioning']}],
 steps:[
 {ids:['query','parent'],t:'1. The application queries the parent table with a filter on the partition key. It never mentions a partition name.',w:'Partitioning is invisible to the application, which is why existing queries keep working.',s:'The partition key and method (range, list, hash) fixed when the table was created.',x:'A query without a filter on the key reads every partition.',c:`EXPLAIN SELECT * FROM orders WHERE created_at >= '2026-02-01' AND created_at < '2026-03-01';`},
 {ids:['parent','planner'],t:'2. The planner compares the filter with every partition bound and prunes the partitions that cannot match.',w:'Pruning happens at plan time for constants and at run time for parameters.',s:'`enable_partition_pruning` (on), `plan_cache_mode`.',x:'Wrapping the key in a function or cast prevents pruning.',c:`SHOW enable_partition_pruning;`},
 {ids:['planner','p2'],t:'3. Only the February partition is scanned. EXPLAIN lists one partition, and the others do not appear.',w:'Smaller scan, smaller indexes, better cache hit rate.',s:'Partition-wise join and aggregate (`enable_partitionwise_join`, `enable_partitionwise_aggregate`, off by default).',x:'Thousands of partitions make planning slow even when pruning works.',c:`EXPLAIN (COSTS OFF) SELECT count(*) FROM orders WHERE created_at >= '2026-02-01' AND created_at < '2026-03-01';`},
 {ids:['parent','p1','p2','p3','pdef'],t:'4. An INSERT is routed to the matching partition by its key value. A row that fits no partition goes to the default partition, or fails if there is none.',w:'Routing is automatic; the application inserts into the parent.',s:'Default partition, `ALTER TABLE ... ATTACH PARTITION`.',x:'An updated key value moves the row to another partition (a delete plus an insert).',c:`INSERT INTO orders (customer_id, created_at, total) VALUES (1, '2026-02-15', 10);`},
 {ids:['detach'],t:'5. Retention: detach the oldest partition concurrently, then archive it or drop it. ANALYZE the parent after bulk loads, because autovacuum does not do it for the parent.',w:'This turns a heavy purge into a metadata change.',s:'`pg_partman` or `pg_cron` to create and drop on a schedule.',x:'A forgotten next-month partition makes inserts fail at midnight on the 1st.',c:`ANALYZE orders;`}]}},

{h:'8. Upgrade paths'},
{map:{title:'Upgrade paths map',h:350,trace:'Compare the methods',
 hint:'Tap any box, or press Compare the methods to step through the choices.',
 groups:[],
 lines:[[190,58,268,58],[190,70,268,148],[190,80,268,238],[460,58,560,118],[460,148,518,148],[460,238,560,178]],
 nodes:[
 {id:'old',x:40,y:30,w:150,h:56,c:'disk',t:'Version 17',s:'running now',d:'The current production cluster. All three methods start from it and end on a new major version.',why:'Check the end-of-life date of this version, because it sets how long you can wait.',chk:`SHOW server_version;`,see:[9,3,'Upgrade strategy']},
 {id:'pgup',x:270,y:30,w:190,h:56,c:'proc',t:'pg_upgrade',s:'minutes, in place or link',d:'Creates new system catalogs and reuses the old user data files (copy, hard link or clone). Needs a short outage.',why:'The fastest route for large databases. Run --check first and refresh statistics afterwards.',chk:`pg_upgrade --check -b /usr/pgsql-17/bin -B /usr/pgsql-18/bin -d /var/lib/pgsql/17/data -D /var/lib/pgsql/18/data`,see:[9,0,'Upgrade from 17 to 18']},
 {id:'dump',x:270,y:120,w:190,h:56,c:'proc',t:'Dump and restore',s:'hours, any version',d:'pg_dump from the old cluster, pg_restore into the new one. Works across any versions and platforms.',why:'Simple and clean, but downtime grows with the size of the data.',chk:`pg_dumpall -g -f globals.sql`,see:[8,0,'Backup and restore']},
 {id:'logical',x:270,y:210,w:190,h:56,c:'proc',t:'Logical replication',s:'near-zero downtime',d:'Copy the data to a new cluster with publish and subscribe, keep it in sync, then switch the application.',why:'The shortest outage, but needs primary keys, a plan for sequences and DDL, and more work.',chk:`SELECT * FROM pg_publication;`,see:[9,6,'Logical replication']},
 {id:'new',x:520,y:120,w:120,h:56,c:'mem',t:'Version 18',s:'new cluster',d:'The target cluster, with its own binaries and data directory.',why:'Install the matching extension libraries and compare settings before the cut-over.',chk:`SELECT extname, extversion FROM pg_extension;`,see:[9,13,'Upgrade planning']},
 {id:'minor',x:40,y:290,w:190,h:56,c:'ext',t:'Minor release',s:'binaries and restart',d:'A change like 17.4 to 17.5 only replaces binaries and restarts the server. The data format is the same.',why:'Do these promptly; they carry security and data-corruption fixes.',chk:`SELECT version();`,see:[0,3,'Versions and release cycle']}],
 steps:[
 {ids:['old','minor'],t:'1. First decide the kind of upgrade. A minor release (17.4 to 17.5) is only new binaries and a restart. A major release (17 to 18) changes the catalogs and needs one of the three methods.',w:'The version number tells you which one applies: the first part is the major version.',s:'Package manager, `systemctl restart`.',x:'Skipping minor releases leaves known security and corruption bugs in place.',c:`SHOW server_version;`},
 {ids:['old','pgup','new'],t:'2. pg_upgrade: install the new binaries, run initdb for the new cluster, run --check, stop the old one and run pg_upgrade (--link is fastest). Start the new cluster and refresh statistics.',w:'Only the catalogs are rebuilt, so the time depends on the number of objects, not on data size when --link is used.',s:'`--link`, `--clone`, `--jobs`, `--check`.',x:'With --link the old cluster must not be started once the new one has been, so take a backup first. A missing extension library fails the check.',c:`pg_upgrade --check -b /usr/pgsql-17/bin -B /usr/pgsql-18/bin -d /var/lib/pgsql/17/data -D /var/lib/pgsql/18/data`},
 {ids:['old','dump','new'],t:'3. Dump and restore: take pg_dumpall -g for the roles, pg_dump for each database, restore into the new cluster, run ANALYZE. Simple, and it also works across platforms.',w:'A dump is a logical copy, so it carries no hidden binary assumptions.',s:'`pg_dump -Fd -j`, `pg_restore -j`, `maintenance_work_mem`.',x:'Time and downtime grow with the data size.',c:`pg_dump -Fd -j 4 -f /backup/appdb appdb`},
 {ids:['old','logical','new'],t:'4. Logical replication: create the new cluster, copy the schema, publish tables on the old one, subscribe on the new one, wait for catch-up, then switch the application and move sequences.',w:'The two clusters run side by side, so the outage is only the switch.',s:'`wal_level = logical`, publications, subscriptions.',x:'Tables without a primary key, schema changes during the copy and sequences that are not replicated.',c:`CREATE PUBLICATION p_all FOR ALL TABLES;`},
 {ids:['new'],t:'5. Whatever the method, plan the way back before you start: keep the old cluster until the new one is verified, test applications against a copy, and write the rollback in the runbook.',w:'Most upgrade incidents are not from the tool but from missing rehearsal and rollback.',s:'A restore-tested backup, a rehearsal on a copy, a maintenance window.',x:'Extensions without libraries for the new version, changed defaults, and application queries that rely on removed behaviour.',c:`SELECT name, setting FROM pg_settings WHERE source <> 'default';`}]}}
]},

{t:'Process maps',d:'Eight small maps of how something happens, step by step: a query, a login, a crash recovery, a lock pile-up, a failover.',see:[],jump:true,b:[
{p:'These maps follow one action from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Life of a query'},
{map:{title:'Life of a query map',h:350,trace:'Follow a SELECT',
 hint:'Tap any box, or press Follow a SELECT to walk one query through the stages.',
 groups:[],
 lines:[[180,58,268,58],[410,58,498,58],[570,86,570,148],[498,178,412,178],[268,178,182,178],[340,268,340,206],[110,206,110,268],'M40 178 H22 V58 H38'],
 nodes:[
 {id:'client',x:40,y:30,w:140,h:56,c:'ext',t:'Client',s:'sends SQL text',d:'The application sends the statement over the frontend/backend protocol. It can be a simple query (text) or an extended query (parse, bind, execute).',why:'Prepared statements reuse the parsed statement, and may reuse the plan, which saves planning time.',chk:`SELECT query FROM pg_stat_activity WHERE pid = pg_backend_pid();`,see:[2,13,'Backend internals']},
 {id:'parser',x:270,y:30,w:140,h:56,c:'proc',t:'Parser',s:'syntax check',d:'Turns the text into a raw parse tree and checks only the syntax.',why:'A typo is caught here with an error such as syntax error at or near.',chk:`SELECT 1 FRM t;   -- fails in the parser`,see:[2,17,'Query stages']},
 {id:'analyzer',x:500,y:30,w:140,h:56,c:'proc',t:'Analyzer',s:'names and types',d:'Looks up tables, columns, functions and types in the catalogs and resolves them.',why:'Errors such as relation does not exist or column does not exist come from this stage.',chk:`SELECT * FROM no_such_table;`,see:[2,17,'Query stages']},
 {id:'rewriter',x:500,y:150,w:140,h:56,c:'proc',t:'Rewriter',s:'views and rules',d:'Expands views and applies rules, so the planner sees a query on real tables.',why:'A view is not a stored result; it is rewritten into the underlying query each time.',chk:`SELECT definition FROM pg_views WHERE viewname = 'my_view';`,see:[2,17,'Query stages']},
 {id:'planner',x:270,y:150,w:140,h:56,c:'proc',t:'Planner',s:'cheapest plan',d:'Builds candidate plans (scan types, join order and methods), estimates their cost from statistics and chooses the cheapest.',why:'Most slow-query problems are plans that are wrong for the data, usually from stale statistics.',chk:`EXPLAIN SELECT * FROM orders WHERE id = 42;`,see:[2,9,'Query planner']},
 {id:'executor',x:40,y:150,w:140,h:56,c:'proc',t:'Executor',s:'runs the plan',d:'Runs the plan tree node by node, pulling rows up from the scans. Sorts and hashes use work_mem and spill to temp files when they do not fit.',why:'This is where time is actually spent. EXPLAIN ANALYZE shows real rows and time per node.',chk:`EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE id = 42;`,see:[10,2,'Performance tuning workflow']},
 {id:'stats',x:270,y:270,w:140,h:56,c:'mem',t:'Statistics',s:'pg_statistic',d:'Column distributions gathered by ANALYZE: distinct values, most common values, histograms.',why:'The planner is only as good as these. Raise the statistics target for skewed columns.',chk:`SELECT attname, n_distinct, null_frac FROM pg_stats WHERE tablename = 'orders';`,see:[2,9,'Query planner']},
 {id:'buffers',x:40,y:270,w:140,h:56,c:'mem',t:'Shared buffers',s:'pages in, rows out',d:'The executor reads table and index pages through the buffer cache.',why:'A high hit ratio means the working set fits in memory.',chk:`SELECT round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) FROM pg_stat_database WHERE datname = current_database();`,see:[2,3,'Memory']}],
 steps:[
 {ids:['client','parser'],t:'1. Parse. The text is turned into a raw parse tree. Only the syntax is checked.',w:'The cheapest errors to catch come first.',s:'`standard_conforming_strings`, nothing else; syntax is fixed.',x:'syntax error at or near "..." (SQLSTATE 42601).',c:`SELECT 1 FRM t;`},
 {ids:['parser','analyzer'],t:'2. Analyze. Every table, column, function and type name is looked up in the catalogs, privileges on them are checked and types are resolved.',w:'After this the query refers to real objects, not names.',s:'`search_path` decides which schema an unqualified name resolves to.',x:'relation "x" does not exist (42P01), column does not exist (42703), permission denied (42501).',c:`SHOW search_path;`},
 {ids:['analyzer','rewriter'],t:'3. Rewrite. Views are replaced by their definitions and rules are applied.',w:'The planner works on base tables only.',s:'Rules and views in the catalog.',x:'Surprising plans when a view hides expensive joins.',c:`SELECT definition FROM pg_views WHERE viewname = 'v_orders';`},
 {ids:['rewriter','planner','stats'],t:'4. Plan. The planner generates paths (sequential, index, bitmap scans; nested loop, hash and merge joins), estimates their cost using the statistics and picks the cheapest.',w:'Cost is an estimate in arbitrary units, so a wrong row estimate gives a wrong plan.',s:'`random_page_cost`, `seq_page_cost`, `effective_cache_size`, `default_statistics_target`, `enable_*`.',x:'Seq scan on a big table: missing index or stale statistics. Estimated rows far from actual rows: run ANALYZE.',c:`EXPLAIN SELECT * FROM orders WHERE customer_id = 42;`},
 {ids:['planner','executor','buffers'],t:'5. Execute. The executor runs the plan, reading pages through shared buffers. Sort and hash nodes use `work_mem` and spill to temporary files if they do not fit.',w:'Rows are produced on demand, so a LIMIT can stop the work early.',s:'`work_mem`, `hash_mem_multiplier`, `max_parallel_workers_per_gather`, `jit`.',x:'Sort Method: external merge Disk means it spilled; many loops on a nested loop means a misestimate.',c:`EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE customer_id = 42;`},
 {ids:['executor','client'],t:'6. Result. Rows are sent to the client as they are produced. The transaction ends at COMMIT or ROLLBACK.',w:'A client that reads slowly keeps the backend (and its snapshot) busy.',s:'`statement_timeout`, `idle_in_transaction_session_timeout`.',x:'Huge result sets over a slow network look like a slow query on the server.',c:`SELECT pid, state, wait_event FROM pg_stat_activity WHERE pid = pg_backend_pid();`}]}},

{h:'2. Connection and login path'},
{map:{title:'Connection and login path map',h:350,trace:'Why permission denied?',
 hint:'Tap any gate, or press Why permission denied? to walk a request through every check.',
 groups:[],
 lines:[[210,58,253,58],[425,58,468,58],[555,86,555,148],[468,178,427,178],[253,178,212,178],[125,206,125,268],[210,298,253,298]],
 nodes:[
 {id:'hba',x:40,y:30,w:170,h:56,c:'proc',t:'pg_hba.conf',s:'first matching line',d:'Matches connection type, database, user and address. The first matching line decides the method.',why:'No line, no connection, and the error says so.',chk:`SELECT line_number, type, database, user_name, address, auth_method FROM pg_hba_file_rules;`,see:[6,1,'Authentication and authorization']},
 {id:'auth',x:255,y:30,w:170,h:56,c:'proc',t:'Authentication',s:'scram, cert, peer',d:'Proves who you are with the method on that line.',why:'SCRAM never sends the password. md5 is deprecated in 18.',chk:`SHOW password_encryption;`,see:[6,9,'Passwords, SCRAM and TLS']},
 {id:'role',x:470,y:30,w:170,h:56,c:'proc',t:'Role state',s:'LOGIN, expiry, limit',d:'The role must be able to log in, not be expired, and be under its connection limit.',why:'A role without LOGIN is a group, not a user.',chk:`SELECT rolname, rolcanlogin, rolvaliduntil, rolconnlimit FROM pg_roles WHERE rolname = 'app';`,see:[6,3,'User creation']},
 {id:'conn',x:470,y:150,w:170,h:56,c:'mem',t:'CONNECT',s:'database privilege',d:'The role needs CONNECT on the database. By default PUBLIC has it.',why:'Revoke it from PUBLIC and grant it to named roles to restrict who can enter which database.',chk:`SELECT datname, datacl FROM pg_database;`,see:[6,2,'Public role']},
 {id:'usage',x:255,y:150,w:170,h:56,c:'mem',t:'Schema USAGE',s:'to reach the objects',d:'Without USAGE on the schema, objects inside it cannot be reached at all.',why:'A common cause of permission denied when the table grant is correct.',chk:`SELECT nspname, nspacl FROM pg_namespace WHERE nspname = 'app';`,see:[6,4,'Grant and revoke']},
 {id:'table',x:40,y:150,w:170,h:56,c:'mem',t:'Table privilege',s:'SELECT, INSERT, ...',d:'The statement needs the matching privilege on the table, or on the columns it touches.',why:'GRANT on ALL TABLES covers only existing tables; use default privileges for future ones.',chk:`SELECT grantee, privilege_type FROM information_schema.table_privileges WHERE table_name = 'orders';`,see:[6,4,'Grant and revoke']},
 {id:'rls',x:40,y:270,w:170,h:56,c:'warn',t:'Row-level security',s:'policy USING',d:'If enabled, each row must pass a policy. Rows that fail are simply not visible. There is no error.',why:'Owners and superusers bypass it unless FORCE ROW LEVEL SECURITY is set.',chk:`SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'orders';`,see:[6,6,'Row level security']},
 {id:'rows',x:255,y:270,w:170,h:56,c:'ext',t:'Rows returned',s:'what you may see',d:'The result of the statement, after every gate.',why:'If rows are missing and there is no error, suspect row-level security or a view that filters.',chk:`SELECT current_user, session_user;`,see:[6,0,'User management']}],
 steps:[
 {ids:['hba'],t:'1. The server reads pg_hba.conf from the top and picks the first line that matches the connection type, database, user and address. No matching line rejects the connection.',w:'It is evaluated before any password is asked.',s:'`pg_hba.conf`, `listen_addresses`. Reload applies changes.',x:'FATAL: no pg_hba.conf entry for host "x", user "u", database "d" (28000).',c:`SELECT * FROM pg_hba_file_rules WHERE error IS NOT NULL;`},
 {ids:['hba','auth'],t:'2. The method on that line is run: SCRAM exchange, certificate check, peer identity or an external service.',w:'The method is chosen per line, so the same user may use different methods from different addresses.',s:'`password_encryption`, `ssl`, `pg_ident.conf`.',x:'FATAL: password authentication failed for user "u" (28P01). Often a wrong password or an md5 versus SCRAM mismatch.',c:`SELECT rolname, left(rolpassword, 14) FROM pg_authid WHERE rolname = 'app';`},
 {ids:['auth','role'],t:'3. The role must be allowed to log in, not expired and under its connection limit.',w:'These are role attributes, not network rules.',s:'`ALTER ROLE ... LOGIN VALID UNTIL CONNECTION LIMIT`.',x:'role "u" is not permitted to log in. too many connections for role "u".',c:`SELECT rolcanlogin, rolvaliduntil, rolconnlimit FROM pg_roles WHERE rolname = 'app';`},
 {ids:['role','conn'],t:'4. The role needs CONNECT on the database.',w:'This is the first privilege gate, applied per database.',s:'`GRANT CONNECT`, `REVOKE ... FROM PUBLIC`, `pg_database.datacl`.',x:'permission denied for database "d".',c:`SELECT has_database_privilege('app', 'appdb', 'CONNECT');`},
 {ids:['conn','usage'],t:'5. For each schema in the statement the role needs USAGE.',w:'Without it the objects inside cannot be seen at all.',s:'`GRANT USAGE ON SCHEMA`, `search_path`.',x:'permission denied for schema "app".',c:`SELECT has_schema_privilege('app', 'app', 'USAGE');`},
 {ids:['usage','table'],t:'6. The statement needs the matching privilege on the table or columns.',w:'SELECT, INSERT, UPDATE and DELETE are separate privileges.',s:'`GRANT`, `ALTER DEFAULT PRIVILEGES`, column privileges.',x:'permission denied for table "orders" (42501).',c:`SELECT has_table_privilege('app', 'app.orders', 'SELECT');`},
 {ids:['table','rls','rows'],t:'7. Row-level security filters the rows last. Rows that fail the policy are not returned, and there is no error.',w:'This is why "the table is there but my rows are missing" is not a privilege error.',s:'`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `FORCE`, `BYPASSRLS`.',x:'An empty result for one role and a full result for another.',c:`SELECT * FROM pg_policies WHERE tablename = 'orders';`}]}},

{h:'3. Checkpoint and crash recovery'},
{map:{title:'Checkpoint and crash recovery map',h:350,trace:'Pull the plug',
 hint:'Tap any box, or press Pull the plug to follow a crash and the recovery that repairs it.',
 groups:[],
 lines:[[190,58,258,58],[430,58,498,58],[115,86,115,148],'M520 86 V118 H350 V148',[570,86,570,148],[190,298,258,298],'M165 206 V232 H320 V268','M570 206 V246 H370 V268',[430,298,498,298]],
 nodes:[
 {id:'back',x:40,y:30,w:150,h:56,c:'proc',t:'Backends',s:'change pages',d:'Sessions that modify data. Each change goes to a shared buffer page and to the WAL.',why:'Pages are changed in memory first, so memory and disk can differ at any time.',chk:`SELECT pg_current_wal_lsn();`,see:[2,4,'WAL']},
 {id:'dirty',x:260,y:30,w:170,h:56,c:'mem',t:'Dirty pages',s:'in shared buffers',d:'Pages that were changed in memory but not yet written to the data files.',why:'They are the reason crash recovery is needed at all.',chk:`SELECT count(*) FILTER (WHERE isdirty) AS dirty FROM pg_buffercache;   -- needs pg_buffercache`,see:[4,7,'Contrib modules']},
 {id:'ckpt',x:500,y:30,w:140,h:56,c:'proc',t:'Checkpointer',s:'writes dirty pages',d:'At every checkpoint it writes all dirty pages and records a checkpoint, so recovery needs to replay only WAL after that point.',why:'Frequency is a trade: frequent means little replay but more I/O; rare means long recovery.',chk:`SELECT num_timed, num_requested FROM pg_stat_checkpointer;`,see:[5,6,'WAL and checkpoint parameters']},
 {id:'wal',x:40,y:150,w:150,h:56,c:'disk',t:'WAL',s:'flushed at commit',d:'The log on disk. A commit is durable once its WAL is flushed.',why:'It is what recovery replays, so it is the only thing that must survive a crash.',chk:`SELECT pg_walfile_name(pg_current_wal_lsn());`,see:[7,0,'WAL format']},
 {id:'data',x:260,y:150,w:170,h:56,c:'disk',t:'Data files',s:'old and new pages mixed',d:'After a crash they hold a mixture: some pages at the latest state and some at older states, plus possibly torn pages.',why:'That is why recovery is needed and why full-page images are logged.',chk:`SHOW full_page_writes;`,see:[2,4,'WAL']},
 {id:'control',x:500,y:150,w:140,h:56,c:'disk',t:'pg_control',s:'last checkpoint',d:'A small file that records the location of the last checkpoint and the cluster state.',why:'Startup reads it first to know where to start replaying.',chk:`pg_controldata $PGDATA | grep -i "checkpoint location"`,see:[2,11,'Crash recovery']},
 {id:'crash',x:40,y:270,w:150,h:56,c:'warn',t:'Crash',s:'power cut, kill -9',d:'The server stops without a clean shutdown. Memory contents are lost.',why:'A fast or smart shutdown writes a checkpoint first, so only abnormal stops need recovery.',chk:`pg_controldata $PGDATA | grep -i "cluster state"`,see:[3,2,'Shutdown modes']},
 {id:'startup',x:260,y:270,w:170,h:56,c:'proc',t:'Startup process',s:'replays WAL (redo)',d:'Reads WAL from the last checkpoint and reapplies each record. Full-page images repair torn pages.',why:'Replay time depends on how much WAL was written since the last checkpoint.',chk:`grep -E "redo starts|redo done|database system is ready" $PGDATA/log/*.log`,see:[2,11,'Crash recovery']},
 {id:'ready',x:500,y:270,w:140,h:56,c:'mem',t:'Consistent',s:'open for clients',d:'Replay is finished. Uncommitted work leaves no effect and the server accepts connections.',why:'During replay clients see "the database system is starting up".',chk:`SELECT pg_is_in_recovery();`,see:[2,11,'Crash recovery']}],
 steps:[
 {ids:['back','dirty','wal'],t:'1. A backend changes a page in memory and writes a WAL record. The page is now dirty.',w:'Nothing is written to the data file yet. Only the sequential log is needed for durability.',s:'`shared_buffers`, `wal_buffers`.',x:'None yet. This is normal operation.',c:`SELECT wal_records, wal_fpi FROM pg_stat_wal;`},
 {ids:['wal'],t:'2. COMMIT flushes the WAL to disk. The change is durable even though the data page is still dirty.',w:'This is write-ahead logging: the log first, the page later.',s:'`synchronous_commit`, `fsync`.',x:'Turning fsync off makes this step a lie and can corrupt the cluster after a crash.',c:`SHOW fsync;`},
 {ids:['dirty','ckpt','data','control'],t:'3. A checkpoint writes every dirty page to the data files, syncs them and records the checkpoint location in WAL and in pg_control.',w:'After this point, WAL older than the checkpoint is no longer needed for crash recovery.',s:'`checkpoint_timeout`, `max_wal_size`, `checkpoint_completion_target`.',x:'Forced checkpoints from WAL volume cause I/O spikes. Very long intervals mean long crash recovery.',c:`SELECT * FROM pg_stat_checkpointer;`},
 {ids:['crash','data'],t:'4. The server crashes. Memory is lost. The data files contain a mixture of pages from different moments, and some pages may be only partly written.',w:'The WAL on disk is intact up to the last flush, so nothing committed is lost.',s:'`full_page_writes`, `data_checksums`.',x:'Hardware that lies about flushes (volatile write cache) can lose acknowledged commits.',c:`pg_controldata $PGDATA | grep -i "cluster state"`},
 {ids:['control','startup','wal'],t:'5. On start, the startup process reads pg_control, finds the last checkpoint and replays the WAL from there, record by record, repairing torn pages from full-page images.',w:'Replaying is safe to repeat, so a crash during recovery is also recoverable.',s:'`recovery_prefetch`, `restart_after_crash`.',x:'A missing or damaged WAL segment stops recovery with a PANIC. Restore from backup.',c:`SELECT pg_is_in_recovery();`},
 {ids:['startup','ready'],t:'6. Replay finishes, the cluster is consistent and the server opens for clients. Unlogged tables are reset to empty.',w:'Everything committed before the crash is present and nothing uncommitted is.',s:'`log_checkpoints`, `log_min_messages`.',x:'Recovery time is proportional to the WAL since the last checkpoint, so size `max_wal_size` with it in mind.',c:`SHOW max_wal_size;`}]}},

{h:'4. WAL lifecycle'},
{map:{title:'WAL lifecycle map',h:350,trace:'Why is pg_wal growing?',
 hint:'Tap any box, or press Why is pg_wal growing? to follow a segment and see what keeps it.',
 groups:[],
 lines:[[210,58,258,58],[430,58,498,58],[345,86,345,148],[210,178,258,178],[430,178,498,178],[345,206,345,268]],
 nodes:[
 {id:'cur',x:40,y:30,w:170,h:56,c:'disk',t:'Current segment',s:'filling, 16 MB',d:'The WAL file currently being written. It is full at 16 MB (the default size) or when a switch is forced.',why:'Segment size is chosen at initdb.',chk:`SELECT pg_walfile_name(pg_current_wal_lsn());`,see:[7,0,'WAL format']},
 {id:'full',x:260,y:30,w:170,h:56,c:'disk',t:'Full segment',s:'.ready until archived',d:'A completed segment. With archiving on, a .ready marker is created in archive_status.',why:'The marker stays until archive_command has succeeded.',chk:`ls $PGDATA/pg_wal/archive_status | head`,see:[7,6,'WAL lifecycle']},
 {id:'arch',x:500,y:30,w:140,h:56,c:'proc',t:'Archiver',s:'archive_command',d:'Copies the full segment to the archive and then renames the marker to .done.',why:'Failure here keeps the segment, and everything after it, in pg_wal.',chk:`SELECT archived_count, failed_count, last_failed_wal FROM pg_stat_archiver;`,see:[8,10,'Continuous archiving']},
 {id:'ckpt',x:40,y:150,w:170,h:56,c:'proc',t:'Checkpoint',s:'moves the redo point',d:'After a checkpoint, WAL before its redo point is no longer needed for crash recovery.',why:'It does not delete anything itself; it only makes segments eligible.',chk:`SELECT num_timed, num_requested FROM pg_stat_checkpointer;`,see:[5,6,'WAL and checkpoint parameters']},
 {id:'hold',x:260,y:150,w:170,h:56,c:'warn',t:'Who still needs it?',s:'archive, slot, standby, size',d:'A segment stays while any of these needs it: archiving not done, a replication slot (restart_lsn), a standby still streaming, or wal_keep_size.',why:'This question answers almost every "why is pg_wal big" case.',chk:`SELECT slot_name, active, wal_status, restart_lsn FROM pg_replication_slots;`,see:[9,7,'Replication slots']},
 {id:'recycle',x:500,y:150,w:140,h:56,c:'mem',t:'Recycle',s:'rename, or remove',d:'Old segments are renamed for future use (recycled) up to a limit, or removed.',why:'Recycling avoids file creation cost and keeps pg_wal near max_wal_size in steady state.',chk:`SHOW min_wal_size;`,see:[7,6,'WAL lifecycle']},
 {id:'full2',x:260,y:270,w:170,h:56,c:'warn',t:'pg_wal grows',s:'until the disk is full',d:'If something holds the WAL, files accumulate until the volume is full. The database then stops accepting writes.',why:'The most common causes are an abandoned slot or a failing archive_command.',chk:`SELECT pg_size_pretty(sum(size)) FROM pg_ls_waldir();`,see:[7,6,'WAL lifecycle']}],
 steps:[
 {ids:['cur'],t:'1. WAL records are appended to the current segment, a 16 MB file in pg_wal.',w:'Sequential appends are fast, which is why the log is the commit path.',s:'`wal_segment_size` (initdb), `wal_level`.',x:'Heavy write load fills segments quickly and increases archiving work.',c:`SELECT pg_walfile_name(pg_current_wal_lsn());`},
 {ids:['cur','full'],t:'2. The segment fills (or is switched by archive_timeout or pg_switch_wal) and a new one begins. With archiving on, a .ready marker appears for the finished one.',w:'The finished segment is now immutable.',s:'`archive_mode`, `archive_timeout`.',x:'archive_mode off means no markers and no archive.',c:`SELECT pg_switch_wal();`},
 {ids:['full','arch'],t:'3. The archiver runs archive_command for the segment. When it succeeds the marker becomes .done.',w:'WAL is never deleted until it has been archived, so you cannot lose history by accident.',s:'`archive_command`, `archive_library`.',x:'A failing command retries forever and the backlog builds up in pg_wal.',c:`SELECT last_archived_wal, last_failed_wal, failed_count FROM pg_stat_archiver;`},
 {ids:['ckpt'],t:'4. A checkpoint finishes and moves the redo point forward. Segments before it are no longer needed for crash recovery.',w:'This is why WAL volume is bounded by max_wal_size in the healthy case.',s:'`max_wal_size`, `min_wal_size`, `checkpoint_timeout`.',x:'Long-running checkpoints keep older segments longer.',c:`SHOW max_wal_size;`},
 {ids:['hold'],t:'5. Before a segment is recycled the server asks who still needs it: the archive (not .done), a replication slot (restart_lsn), a standby that is streaming, or wal_keep_size.',w:'Any one of them is enough to keep it.',s:'`max_slot_wal_keep_size`, `wal_keep_size`, `max_wal_senders`.',x:'An inactive slot keeps WAL with no limit by default. A standby that is down for a day holds a day of WAL.',c:`SELECT slot_name, active, wal_status,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained
FROM pg_replication_slots;`},
 {ids:['hold','recycle','full2'],t:'6. If nobody needs it, the segment is recycled (renamed for future use) or removed. If something does, it stays, and pg_wal grows until you fix the holder.',w:'Never delete files in pg_wal by hand. Fix the holder and the server cleans up.',s:'`max_slot_wal_keep_size` to cap slot damage; monitoring of `pg_ls_waldir()`.',x:'A full volume stops all writes. Dropping the slot or fixing archiving is the cure, not removing files.',c:`SELECT count(*), pg_size_pretty(sum(size)) FROM pg_ls_waldir();`}]}},

{h:'5. Transaction ID wraparound'},
{map:{title:'Transaction ID wraparound map',h:350,trace:'Watch the age grow',
 hint:'Tap any box, or press Watch the age grow to see how freezing keeps the counter safe.',
 groups:[],
 lines:[[190,58,228,58],[380,58,418,58],[232,178,248,178],[442,178,458,178],'M550 206 V298 H442'],
 nodes:[
 {id:'xid',x:40,y:30,w:150,h:56,c:'mem',t:'Transaction id',s:'32-bit counter',d:'Every write transaction gets the next number. After about 4.2 billion the counter wraps; ids are compared in a circle, so only about 2 billion are in the past.',why:'This is a hard design limit, handled by freezing.',chk:`SELECT txid_current();`,see:[10,1,'Autovacuum and VACUUM']},
 {id:'old',x:230,y:30,w:150,h:56,c:'disk',t:'Row xmin',s:'its age grows',d:'Each row version records the creating transaction id. Its age is how many transactions have passed since.',why:'An old unfrozen row would eventually look like it is from the future.',chk:`SELECT age(xmin) FROM orders LIMIT 5;`,see:[2,8,'MVCC internals']},
 {id:'freeze',x:420,y:30,w:150,h:56,c:'proc',t:'Freeze',s:'visible to all, forever',d:'VACUUM replaces the creation id of an old row with a special frozen marker, so its age no longer matters.',why:'Freezing is the only protection against wraparound.',chk:`VACUUM (FREEZE, VERBOSE) orders;`,see:[10,1,'Autovacuum and VACUUM']},
 {id:'minage',x:40,y:150,w:190,h:56,c:'mem',t:'vacuum_freeze_min_age',s:'50 million: freeze rows older',d:'During any vacuum, rows older than this are frozen.',why:'Keeps freezing a normal side effect of vacuum.',chk:`SHOW vacuum_freeze_min_age;`,see:[10,1,'Autovacuum and VACUUM']},
 {id:'maxage',x:250,y:150,w:190,h:56,c:'proc',t:'freeze_max_age',s:'autovacuum forced at 200M',d:'When a table passes this age, autovacuum starts an anti-wraparound vacuum even if autovacuum is off.',why:'It scans the whole table and is not cancelled by lock requests.',chk:`SHOW autovacuum_freeze_max_age;`,see:[10,1,'Autovacuum and VACUUM']},
 {id:'failsafe',x:460,y:150,w:180,h:56,c:'warn',t:'vacuum_failsafe_age',s:'1.6 billion: emergency',d:'Vacuum switches to an emergency mode that skips index cleanup and other optional work.',why:'It buys time when freezing has fallen far behind.',chk:`SHOW vacuum_failsafe_age;`,see:[10,1,'Autovacuum and VACUUM']},
 {id:'stop',x:250,y:270,w:190,h:56,c:'warn',t:'Writes refused',s:'a few million before the limit',d:'The server refuses new transaction ids to avoid data loss and tells you to vacuum.',why:'Recovery needs a vacuum of the oldest tables, sometimes in single-user mode.',chk:`SELECT datname, age(datfrozenxid) FROM pg_database ORDER BY 2 DESC;`,see:[10,1,'Autovacuum and VACUUM']}],
 steps:[
 {ids:['xid'],t:'1. Each write transaction takes the next 32-bit transaction id. Read-only transactions do not use one.',w:'The counter is shared by the whole cluster, so it advances with total write activity.',s:'Not configurable: it is part of the design.',x:'Very high transaction rates reach the thresholds faster.',c:`SELECT txid_current();`},
 {ids:['xid','old'],t:'2. Rows carry the id of the transaction that created them. Their age is how many transactions have passed since. Age is compared in a circle, so about 2 billion is the limit.',w:'A row older than the limit would suddenly look like it is from the future and become invisible.',s:'Monitor `age(datfrozenxid)` and `age(relfrozenxid)`.',x:'A table that is never vacuumed keeps aging silently.',c:`SELECT datname, age(datfrozenxid) FROM pg_database ORDER BY 2 DESC;`},
 {ids:['minage','freeze'],t:'3. Every normal vacuum freezes rows older than vacuum_freeze_min_age (50 million). Frozen rows are visible to everyone and never age again.',w:'Most tables are frozen without anyone noticing, as a by-product of vacuum.',s:'`vacuum_freeze_min_age`, `vacuum_freeze_table_age`.',x:'Insert-only tables rely on the insert threshold (13+) to be vacuumed and frozen at all.',c:`SELECT relname, age(relfrozenxid) FROM pg_class WHERE relkind = 'r' ORDER BY 2 DESC LIMIT 5;`},
 {ids:['maxage','freeze'],t:'4. At autovacuum_freeze_max_age (200 million) PostgreSQL forces an anti-wraparound autovacuum on the table, even with autovacuum disabled. It scans the whole table and is not cancelled by conflicting locks.',w:'It is the safety net behind everything else.',s:'`autovacuum_freeze_max_age` (restart), `autovacuum_multixact_freeze_max_age`.',x:'It can run for hours on very large tables and cause I/O load at an unexpected time.',c:`SELECT pid, query FROM pg_stat_activity WHERE query LIKE '%to prevent wraparound%';`},
 {ids:['failsafe'],t:'5. If the age keeps growing and reaches vacuum_failsafe_age (1.6 billion), vacuum drops optional work such as index cleanup so it can finish quickly.',w:'At this point speed matters more than tidiness.',s:'`vacuum_failsafe_age`.',x:'You are close to the limit. Find what blocks freezing: old transactions, replication slots, prepared transactions.',c:`SELECT * FROM pg_prepared_xacts;`},
 {ids:['stop'],t:'6. A few million transactions before the limit the server refuses new write transactions: "database is not accepting commands to avoid wraparound data loss". Only a vacuum of the oldest tables brings it back.',w:'It protects data at the price of availability.',s:'Alert early on `age(datfrozenxid)`: a few hundred million is already a warning.',x:'Recovery can need single-user mode and a manual VACUUM of the oldest tables.',c:`SELECT datname, age(datfrozenxid) FROM pg_database ORDER BY 2 DESC;`}]}},

{h:'6. Locks and blocking'},
{map:{title:'Locks and blocking map',h:350,trace:'Build a pile-up',
 hint:'Tap any box, or press Build a pile-up to see how one idle transaction can freeze a table.',
 groups:[],
 lines:[[210,58,258,58],[430,58,478,58],[345,86,345,148],[258,178,212,178],[430,178,478,178],[345,206,345,268],[560,206,560,268]],
 nodes:[
 {id:'a',x:40,y:30,w:170,h:56,c:'proc',t:'Session A',s:'long transaction, idle',d:'Updated a row and never committed. It holds a row lock and a ROW EXCLUSIVE lock on the table.',why:'Idle in transaction is the classic origin of lock pile-ups.',chk:`SELECT pid, state, now() - xact_start AS age FROM pg_stat_activity WHERE state LIKE 'idle in transaction%';`,see:[2,10,'Transactions and locking']},
 {id:'c',x:260,y:30,w:170,h:56,c:'warn',t:'Session C',s:'ALTER TABLE waits',d:'DDL needs ACCESS EXCLUSIVE, which conflicts with A. It waits, and its request is now in the lock queue.',why:'Queued requests block later, otherwise harmless, queries.',chk:`SELECT pid, wait_event_type, wait_event, left(query, 40) FROM pg_stat_activity WHERE wait_event_type = 'Lock';`,see:[2,19,'Locking in depth']},
 {id:'d',x:480,y:30,w:160,h:56,c:'warn',t:'Sessions D, E',s:'SELECT queues',d:'Plain SELECTs need ACCESS SHARE, which conflicts with the waiting ACCESS EXCLUSIVE request, so they queue behind C.',why:'This is why the table appears frozen to everyone, though only A and C conflict directly.',chk:`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock';`,see:[2,19,'Locking in depth']},
 {id:'locks',x:260,y:150,w:170,h:56,c:'mem',t:'pg_locks',s:'granted = false',d:'Shows every lock held and requested. The ones with granted = false are waiting.',why:'It is the ground truth for who is waiting for what.',chk:`SELECT pid, mode, granted, relation::regclass FROM pg_locks WHERE NOT granted;`,see:[2,10,'Transactions and locking']},
 {id:'find',x:40,y:150,w:170,h:56,c:'ext',t:'Find the blocker',s:'pg_blocking_pids',d:'pg_blocking_pids(pid) returns the sessions that block a given session.',why:'Follow it to the root: the blocker that is not itself waiting.',chk:`SELECT pid, pg_blocking_pids(pid) FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;`,see:[2,10,'Transactions and locking']},
 {id:'fix',x:480,y:150,w:160,h:56,c:'proc',t:'End the blocker',s:'terminate or commit',d:'Cancel or terminate the root blocker, or ask its owner to commit or roll back.',why:'Do not kill sessions blindly; a long transaction may be doing a legitimate bulk job.',chk:`SELECT pg_terminate_backend(12345);`,see:[4,4,'Kill sessions']},
 {id:'dead',x:260,y:270,w:170,h:56,c:'warn',t:'Deadlock',s:'a cycle: one is cancelled',d:'Two sessions each wait for a lock the other holds. After deadlock_timeout (1 s) PostgreSQL cancels one of them.',why:'The fix is in the application: lock rows in the same order and retry.',chk:`SHOW deadlock_timeout;`,see:[2,10,'Deadlocks']},
 {id:'timeout',x:480,y:270,w:160,h:56,c:'mem',t:'lock_timeout',s:'give up waiting',d:'A session setting that makes a statement fail after waiting this long for a lock.',why:'Set it for migrations, so a DDL never freezes the application while it waits.',chk:`SET lock_timeout = '5s';`,see:[5,11,'Timeout parameters']}],
 steps:[
 {ids:['a'],t:'1. Session A starts a transaction, updates a row and then sits idle (perhaps the application forgot to commit). It holds a row lock and a ROW EXCLUSIVE lock on the table.',w:'Nothing is wrong yet. Normal writes and reads continue.',s:'`idle_in_transaction_session_timeout`.',x:'It also holds back vacuum, so the table starts to bloat.',c:`SELECT pid, state, xact_start FROM pg_stat_activity WHERE state = 'idle in transaction';`},
 {ids:['a','c'],t:'2. Session C runs ALTER TABLE. It needs ACCESS EXCLUSIVE, which conflicts with A’s lock. C waits.',w:'DDL needs to be alone on the table.',s:'`lock_timeout`, `statement_timeout`.',x:'C can wait indefinitely if A never ends.',c:`SELECT pid, mode, granted FROM pg_locks WHERE relation = 'orders'::regclass;`},
 {ids:['c','d'],t:'3. New SELECTs need ACCESS SHARE, which conflicts with C’s pending request, so they queue behind C. The table now looks frozen to every user.',w:'The lock queue is fair: a waiting request blocks later ones that conflict with it.',s:'Application connection pool limits make this worse by filling with waiting sessions.',x:'Pool exhausted, application timeouts, "too many clients".',c:`SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock';`},
 {ids:['locks','find'],t:'4. Find the root blocker. pg_locks shows requests with granted = false, and pg_blocking_pids shows who blocks whom. Follow it to the session that is not waiting.',w:'There can be a chain: D waits for C, which waits for A. A is the root.',s:'`log_lock_waits` (logs waits longer than `deadlock_timeout`).',x:'Ending C or D does not help; A is the cause.',c:`SELECT pid, pg_blocking_pids(pid) AS blocked_by, left(query, 40) FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;`},
 {ids:['fix','timeout'],t:'5. Resolve it: ask the owner of A to commit or roll back, or use pg_terminate_backend. Prevent a repeat with idle_in_transaction_session_timeout and a lock_timeout on DDL.',w:'Short transactions and timeouts turn a stuck system into a failed statement.',s:'`idle_in_transaction_session_timeout`, `lock_timeout`, `statement_timeout`.',x:'Killing a session rolls back its work, which can take as long as the work did.',c:`SELECT pg_terminate_backend(12345);`},
 {ids:['dead'],t:'6. A deadlock is different: two sessions each wait for a lock the other holds. After deadlock_timeout PostgreSQL detects the cycle and cancels one session with an error.',w:'PostgreSQL resolves it automatically, but the application must retry.',s:'`deadlock_timeout`.',x:'ERROR: deadlock detected (40P01). Repeated deadlocks mean rows are locked in different orders.',c:`SELECT deadlocks FROM pg_stat_database WHERE datname = current_database();`}]}},

{h:'7. Failover timeline'},
{map:{title:'Failover timeline map',h:350,trace:'Run a failover',
 hint:'Tap any box, or press Run a failover to follow an emergency promotion from failure to a healthy cluster.',
 groups:[],
 lines:[[190,58,228,58],[380,58,418,58],'M495 86 V118 H135 V148',[232,178,258,178],[430,178,458,178],[345,206,345,268],[432,298,458,298]],
 nodes:[
 {id:'fail',x:40,y:30,w:150,h:56,c:'warn',t:'Primary lost',s:'crash or network',d:'The primary stops responding. It may be down or only unreachable, and you do not know which yet.',why:'That uncertainty is the whole problem, and it is why fencing exists.',chk:`pg_isready -h primary -p 5432`,see:[9,10,'Failover and switchover']},
 {id:'detect',x:230,y:30,w:150,h:56,c:'ext',t:'Decision',s:'manager or DBA',d:'A failover manager or a person confirms the primary is really gone and decides to fail over.',why:'PostgreSQL itself never decides this. Automatic managers use quorum and timeouts.',chk:`patronictl list`,see:[9,11,'High availability architecture']},
 {id:'fence',x:420,y:30,w:150,h:56,c:'warn',t:'Fence',s:'stop the old primary',d:'Make sure the old primary cannot accept writes: power off, stop the VM, remove its network or virtual IP.',why:'Without this, two servers may both accept writes (split brain) and the data cannot be merged.',chk:`-- fencing is done outside PostgreSQL`,see:[9,15,'Unplanned failover and fencing']},
 {id:'choose',x:40,y:150,w:190,h:56,c:'proc',t:'Choose a standby',s:'most WAL received',d:'Pick the standby with the highest received and replayed position, or the synchronous one.',why:'It limits how many committed transactions are lost (the RPO).',chk:`SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();`,see:[9,10,'Failover and switchover']},
 {id:'promote',x:260,y:150,w:170,h:56,c:'proc',t:'Promote',s:'new timeline begins',d:'pg_promote() or pg_ctl promote finishes replay and makes the standby read-write on a new timeline.',why:'The new timeline keeps the new history separate from the old one.',chk:`SELECT pg_promote();`,see:[9,10,'Failover and switchover']},
 {id:'redirect',x:460,y:150,w:180,h:56,c:'ext',t:'Redirect clients',s:'VIP, DNS or pooler',d:'Point applications at the new primary: virtual IP, DNS record, connection string or the pooler target.',why:'Applications that cache DNS or hold old connections keep failing until they reconnect.',chk:`SELECT inet_server_addr(), pg_is_in_recovery();`,see:[10,3,'Connection pooling']},
 {id:'rewind',x:260,y:270,w:170,h:56,c:'proc',t:'Rewind or rebuild',s:'old primary rejoins',d:'pg_rewind makes the old primary follow the new timeline without a full copy. If it cannot, rebuild it with pg_basebackup.',why:'The old primary may hold transactions the new one never saw; they must be discarded.',chk:`pg_rewind --target-pgdata=$PGDATA --source-server="host=newprimary user=postgres"`,see:[9,15,'pg_rewind']},
 {id:'verify',x:460,y:270,w:180,h:56,c:'mem',t:'After checklist',s:'lag, slots, backups',d:'Verify replication from the new primary, recreate slots, restart backups and archiving, and review what was lost.',why:'The cluster is exposed until a new standby exists.',chk:`SELECT application_name, state, replay_lag FROM pg_stat_replication;`,see:[9,15,'Unplanned failover']}],
 steps:[
 {ids:['fail'],t:'1. The primary stops responding. At this moment you do not know whether it crashed, froze or only lost its network.',w:'A partitioned primary may still accept writes.',s:'`wal_sender_timeout`, `tcp_keepalives_*`, manager timeouts.',x:'Acting on a false failure creates two primaries.',c:`pg_isready -h primary`},
 {ids:['detect'],t:'2. A failover manager or the on-call DBA confirms the primary is really gone and decides to fail over, considering how much data may be lost.',w:'This is a business decision as well as a technical one.',s:'Patroni or repmgr timeouts, a runbook.',x:'Manual steps are slow and error-prone at night, which is why they are written down.',c:`patronictl list`},
 {ids:['fence'],t:'3. Fence the old primary so that it cannot accept writes.',w:'Promoting first and fencing later is how split brain happens.',s:'STONITH, cloud API, network isolation, virtual IP removal.',x:'If fencing fails, do not promote.',c:`-- fencing is outside PostgreSQL`},
 {ids:['choose'],t:'4. Choose the standby that has received the most WAL (or the synchronous one) so that the least data is lost.',w:'The difference is the RPO of this failover.',s:'`synchronous_standby_names`, `recovery_min_apply_delay` (a delayed standby is not a candidate).',x:'A standby that is far behind turns into data loss.',c:`SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();`},
 {ids:['promote','redirect'],t:'5. Promote it. It replays the WAL it has, leaves recovery and starts a new timeline. Then redirect applications to it.',w:'The timeline number increases so that old and new WAL histories cannot be confused.',s:'`pg_promote()`, `pg_ctl promote`, `recovery_target_timeline`.',x:'Applications with cached connections or DNS keep failing until they reconnect.',c:`SELECT pg_promote();
SELECT pg_is_in_recovery();   -- false`},
 {ids:['rewind','verify'],t:'6. Bring the old primary back as a standby with pg_rewind (or rebuild it), recreate slots and backups, and run the after-failover checklist.',w:'Until a new standby exists you have no redundancy.',s:'`wal_log_hints` or data checksums (required by pg_rewind).',x:'pg_rewind fails if the old primary has no checksums or wal_log_hints and was not shut down cleanly; rebuild instead.',c:`SELECT application_name, state, replay_lag FROM pg_stat_replication;`}]}},

{h:'8. Where did this setting come from?'},
{map:{title:'Configuration precedence map',h:370,trace:'Walk the precedence',
 hint:'Tap any box, or press Walk the precedence to see which source wins and how a change is applied.',
 groups:[{x:30,y:244,w:620,h:116,l:'Then the context decides how a change is applied'}],
 lines:[[180,58,198,58],[340,58,358,58],[500,58,518,58],'M580 86 V118 H110 V148',[182,178,198,178],[342,178,358,178],[502,178,518,178]],
 nodes:[
 {id:'def',x:40,y:30,w:140,h:56,c:'ext',t:'Default',s:'built in',d:'The value compiled into the server.',why:'Always the starting point, and what pg_settings reports as boot_val.',chk:`SELECT name, boot_val, setting FROM pg_settings WHERE name = 'work_mem';`,see:[5,1,'Parameters basic']},
 {id:'conf',x:200,y:30,w:140,h:56,c:'disk',t:'postgresql.conf',s:'edited by hand',d:'The main file, read at start and on reload. It can include other files.',why:'Good for the baseline settings you version-control.',chk:`SHOW config_file;`,see:[3,3,'Configuration files']},
 {id:'auto',x:360,y:30,w:140,h:56,c:'disk',t:'auto.conf',s:'ALTER SYSTEM',d:'postgresql.auto.conf, written by ALTER SYSTEM and read after postgresql.conf, so it wins.',why:'Explains "I edited the file but SHOW shows the old value".',chk:`SELECT name, setting, sourcefile FROM pg_settings WHERE sourcefile LIKE '%auto.conf';`,see:[5,4,'ALTER SYSTEM']},
 {id:'cmd',x:520,y:30,w:120,h:56,c:'ext',t:'Command line',s:'postgres -c',d:'Options given when the server is started, for example by a service unit.',why:'Beats both files, which can confuse people.',chk:`SELECT name, setting FROM pg_settings WHERE source = 'command line';`,see:[5,9,'Parameter precedence']},
 {id:'db',x:40,y:150,w:140,h:56,c:'mem',t:'Database',s:'ALTER DATABASE SET',d:'A default for every new session in that database.',why:'Useful for per-application tuning without touching the server-wide setting.',chk:`SELECT * FROM pg_db_role_setting;`,see:[5,9,'Parameter precedence']},
 {id:'role',x:200,y:150,w:140,h:56,c:'mem',t:'Role',s:'ALTER ROLE SET',d:'A default for every new session of that role, optionally in one database.',why:'The usual place for work_mem on a reporting role.',chk:`SELECT setrole::regrole, setdatabase, setconfig FROM pg_db_role_setting;`,see:[5,9,'Parameter precedence']},
 {id:'sess',x:360,y:150,w:140,h:56,c:'mem',t:'Session',s:'SET, SET LOCAL',d:'Set by the client for this session or this transaction. Highest precedence.',why:'Only for parameters whose context is user or superuser.',chk:`SET work_mem = '64MB';
SHOW work_mem;`,see:[5,9,'Parameter precedence']},
 {id:'inuse',x:520,y:150,w:120,h:56,c:'proc',t:'Value in use',s:'SHOW, pg_settings',d:'The effective value, with its source and file in pg_settings.',why:'Always check source and sourcefile before you change anything.',chk:`SELECT name, setting, source, sourcefile, sourceline FROM pg_settings WHERE name = 'work_mem';`,see:[5,2,'Parameter types']},
 {id:'pm',x:50,y:270,w:180,h:56,c:'warn',t:'postmaster',s:'restart needed',d:'Read at server start only: shared_buffers, max_connections, wal_level and others that size shared memory or start processes.',why:'A reload leaves the old value in force, and pending_restart shows it.',chk:`SELECT name, pending_restart FROM pg_settings WHERE pending_restart;`,see:[5,3,'Reload or restart']},
 {id:'sighup',x:250,y:270,w:170,h:56,c:'proc',t:'sighup',s:'reload is enough',d:'Applied when the postmaster re-reads its files on a reload (SIGHUP).',why:'Includes checkpoint_timeout, max_wal_size and autovacuum settings, and pg_hba.conf.',chk:`SELECT pg_reload_conf();`,see:[5,3,'Reload or restart']},
 {id:'user',x:440,y:270,w:190,h:56,c:'mem',t:'user and superuser',s:'also per session',d:'Can be changed in a session. A superuser setting needs privileges (or a GRANT SET ON PARAMETER).',why:'This is what makes per-role and per-database defaults possible.',chk:`SELECT name, context FROM pg_settings WHERE name IN ('work_mem', 'shared_buffers', 'log_statement');`,see:[5,2,'Parameter types']}],
 steps:[
 {ids:['def'],t:'1. Start from the built-in default.',w:'Everything not set elsewhere is this value.',s:'`pg_settings.boot_val`.',x:'None.',c:`SELECT name, boot_val FROM pg_settings WHERE name = 'work_mem';`},
 {ids:['conf'],t:'2. postgresql.conf overrides the default. It is read at start and on reload, together with any included files.',w:'This is the baseline for the server.',s:'`include`, `include_if_exists`, `include_dir`.',x:'A syntax error leaves the old value and logs the error.',c:`SELECT * FROM pg_file_settings WHERE error IS NOT NULL;`},
 {ids:['auto'],t:'3. postgresql.auto.conf is read after it, so ALTER SYSTEM overrides your hand edits.',w:'It is machine-written; edit it only through SQL.',s:'`ALTER SYSTEM SET`, `ALTER SYSTEM RESET`.',x:'An old ALTER SYSTEM silently beats a new edit in postgresql.conf.',c:`SELECT name, setting, sourcefile FROM pg_settings WHERE sourcefile LIKE '%auto.conf';`},
 {ids:['cmd'],t:'4. Options on the postgres command line (for example from a service unit) override both files.',w:'They are easy to forget and hard to see in the files.',s:'Service unit `ExecStart`, `pg_ctl -o`.',x:'A change in the files has no effect, and nothing in them says why.',c:`SELECT name, setting FROM pg_settings WHERE source = 'command line';`},
 {ids:['db','role'],t:'5. Database and role defaults apply to new sessions: ALTER DATABASE ... SET, ALTER ROLE ... SET, or both together.',w:'They let one cluster serve different workloads with different tuning.',s:'`pg_db_role_setting`.',x:'They apply to new sessions only, so existing connections keep the old value.',c:`ALTER ROLE report SET work_mem = '256MB';`},
 {ids:['sess','inuse'],t:'6. The session can set its own value with SET (for the session) or SET LOCAL (for the transaction). This wins over everything above. SHOW and pg_settings tell you what is in force.',w:'Only parameters whose context is user or superuser can be changed this way.',s:'`SET`, `SET LOCAL`, `RESET`, `set_config()`.',x:'A pooler in transaction mode loses plain SET between transactions.',c:`SELECT name, setting, source FROM pg_settings WHERE name = 'work_mem';`},
 {ids:['pm','sighup','user'],t:'7. Finally the parameter context decides how a change is applied: postmaster needs a restart, sighup needs a reload, user and superuser can also be changed per session.',w:'It prevents both needless restarts and changes that never take effect.',s:'`pg_settings.context`, `pending_restart`.',x:'A reload that "did nothing" is nearly always a postmaster parameter.',c:`SELECT name, context, pending_restart FROM pg_settings WHERE name IN ('shared_buffers', 'work_mem', 'checkpoint_timeout');`}]}}
]},

/* 1 ---------------------------------------------------------------- processes */
{t:'Server processes',d:'Every process in a running cluster, how it appears in pg_stat_activity and where to look when it misbehaves.',see:[[2,0,'Postmaster'],[2,2,'Background processes']],b:[
{t:[['Process','`backend_type`','Job','Look here'],
['postmaster','(parent `postgres`)','Starts and restarts everything, accepts connections, forks one backend per client','`postmaster.pid`, server log start-up lines'],
['client backend','`client backend`','Serves one client connection: parse, plan, execute','`pg_stat_activity`, `pg_locks`'],
['startup','`startup`','Replays WAL for crash recovery, archive recovery and on a standby','Log: "redo starts at", "consistent recovery state"'],
['checkpointer','`checkpointer`','Writes all dirty buffers and records a checkpoint','`pg_stat_checkpointer`, `log_checkpoints`'],
['background writer','`background writer`','Writes some dirty buffers early so backends find clean ones','`pg_stat_bgwriter`'],
['WAL writer','`walwriter`','Flushes WAL buffers in the background','`pg_stat_wal`'],
['autovacuum launcher','`autovacuum launcher`','Decides which database needs a worker','`pg_stat_activity`'],
['autovacuum worker','`autovacuum worker`','Runs VACUUM and ANALYZE on one table','`pg_stat_progress_vacuum`, `log_autovacuum_min_duration`'],
['archiver','`archiver`','Runs `archive_command` for each full WAL segment','`pg_stat_archiver`, `pg_wal/archive_status`'],
['WAL sender','`walsender`','Streams WAL to a standby, a base backup or a logical subscriber','`pg_stat_replication`, `pg_replication_slots`'],
['WAL receiver','`walreceiver`','On a standby: receives WAL from the primary','`pg_stat_wal_receiver`'],
['logical replication launcher','`logical replication launcher`','Starts apply workers for subscriptions','`pg_stat_subscription`'],
['logical apply or sync worker','`logical replication apply worker`','Applies changes on a subscriber','`pg_stat_subscription`'],
['parallel worker','`parallel worker`','Helps one query use several cores','`pg_stat_activity.leader_pid`'],
['WAL summarizer (17+)','`walsummarizer`','Summarises WAL for incremental backups when `summarize_wal` is on','`pg_stat_activity`'],
['slot sync worker (17+)','`slotsync worker`','Keeps failover slots on a standby in step','`pg_replication_slots`'],
['I/O worker (18)','`io worker`','Asynchronous reads when `io_method = worker`','`pg_stat_io`'],
['background worker','extension-defined','Custom jobs (for example `pg_cron`)','Extension documentation']]},
{note:'There is no stats collector process any more: since version 15 statistics live in shared memory and are saved at clean shutdown.'},
{code:`-- what is running right now, by kind
SELECT backend_type, count(*) FROM pg_stat_activity GROUP BY 1 ORDER BY 2 DESC;

# from the OS
ps -ef | grep postgres | head -20`}
]},

/* 2 ---------------------------------------------------------------- files */
{t:'Files and directories in PGDATA',d:'What every entry in the data directory is, and whether you may touch it.',see:[[2,6,'PGDATA directory layout']],b:[
{h:'Directories'},
{t:[['Path','Contents','Touch?'],
['`base/`','One folder per database (named by OID) with table and index files','Never by hand'],
['`global/`','Cluster-wide catalogs (`pg_database`, `pg_authid`) and `pg_control`','Never'],
['`pg_wal/`','WAL segments (16 MB by default), `archive_status/`, `summaries/` (17+)','Never delete files by hand'],
['`pg_xact/`','Transaction commit status','Never'],
['`pg_multixact/`','Multixact state for shared row locks','Never'],
['`pg_subtrans/`','Subtransaction parents','Never'],
['`pg_commit_ts/`','Commit timestamps if `track_commit_timestamp` is on','Never'],
['`pg_tblspc/`','Symbolic links to tablespace directories','Re-point only in an offline move'],
['`pg_replslot/`','Replication slot state','Use `pg_drop_replication_slot()`'],
['`pg_logical/`','Logical decoding and replication origin state','Never'],
['`pg_twophase/`','Prepared transaction state','Use `COMMIT PREPARED` or `ROLLBACK PREPARED`'],
['`pg_stat/`','Statistics saved at clean shutdown','Never'],
['`pg_snapshots/`, `pg_dynshmem/`, `pg_notify/`, `pg_serial/`','Exported snapshots, dynamic shared memory, `NOTIFY` queue, serializable state','Never'],
['`log/`','Server log files when the collector writes into `PGDATA`','Rotate or archive; safe to remove old files']]},
{h:'Files'},
{t:[['File','Purpose','Touch?'],
['`PG_VERSION`','Major version that created the cluster','No'],
['`postgresql.conf`','Main settings','Edit, then reload or restart'],
['`postgresql.auto.conf`','Written by `ALTER SYSTEM`; read last, so it wins','Use `ALTER SYSTEM`, not an editor'],
['`pg_hba.conf`','Who may connect from where, with which method','Edit, then reload'],
['`pg_ident.conf`','User name maps for `pg_hba.conf`','Edit, then reload'],
['`postmaster.pid`','PID, data directory and port of the running server','Delete only if the server is certainly down'],
['`postmaster.opts`','Options the server was started with','No'],
['`global/pg_control`','Checkpoint position, timeline, state (see `pg_controldata`)','Never; `pg_resetwal` only as a last resort'],
['`backup_label`','Present while restoring from an online base backup','Never remove during recovery'],
['`tablespace_map`','Tablespace paths for a base backup','No'],
['`standby.signal`','Start in standby mode','Create or remove deliberately'],
['`recovery.signal`','Start in targeted archive recovery (PITR)','Create to recover; removed after'],
['`current_logfiles`','Name of the log file in use (collector on)','No'],
['`pg_wal/*.backup`','Backup history file (start and stop LSN, label)','Keep with the backup']]},
{h:'Files of one table'},
{t:[['File','Meaning'],
['`base/<db OID>/<relfilenode>`','Main fork: the table or index data (8 KB pages)'],
['`<relfilenode>.1`, `.2` ...','Next 1 GB segments of the same relation'],
['`<relfilenode>_fsm`','Free space map'],
['`<relfilenode>_vm`','Visibility map (used by index-only scans and vacuum)'],
['`<relfilenode>_init`','Initialisation fork of an unlogged relation'],
['TOAST table','Separate relation (`pg_toast.pg_toast_<oid>`) for large values']]},
{code:`SELECT pg_relation_filepath('public.orders');   -- base/16384/16397
SHOW data_directory;
SHOW config_file;
SHOW hba_file;`}
]},

/* 3 ---------------------------------------------------------------- locations */
{t:'Locations by platform',d:'Where binaries, data, configuration, logs and the service live for each installation method.',see:[[1,2,'Yum installation'],[1,0,'Installation overview']],b:[
{t:[['Item','RHEL family (PGDG)','Debian / Ubuntu','Windows installer','Source build (default)'],
['Binaries','`/usr/pgsql-18/bin`','`/usr/lib/postgresql/18/bin`','`C:\\Program Files\\PostgreSQL\\18\\bin`','`/usr/local/pgsql/bin`'],
['Data directory','`/var/lib/pgsql/18/data`','`/var/lib/postgresql/18/main`','`C:\\Program Files\\PostgreSQL\\18\\data`','`/usr/local/pgsql/data` (you choose)'],
['`postgresql.conf` and `pg_hba.conf`','Inside the data directory','`/etc/postgresql/18/main/`','Inside the data directory','Inside the data directory'],
['Server log','`log/` in the data directory, or the journal','`/var/log/postgresql/postgresql-18-main.log`','`log\\` in the data directory','None unless started with `-l` or the collector is on'],
['Service name','`postgresql-18`','`postgresql@18-main`','`postgresql-x64-18`','Your own unit file'],
['Unix socket','`/var/run/postgresql` and `/tmp`','`/var/run/postgresql`','Not used','`/tmp`'],
['Default port','`5432`','`5432` (next cluster `5433`)','`5432`','`5432`'],
['OS account','`postgres`','`postgres`','`postgres` service account','`postgres` (create it)'],
['Extension files','`/usr/pgsql-18/share/extension`','`/usr/share/postgresql/18/extension`','`...\\share\\extension`','`share/extension` under the prefix']]},
{h:'Other ports and names'},
{t:[['Thing','Default'],
['PostgreSQL','`5432`'],
['PgBouncer','`6432`'],
['Pgpool-II','`9999` (backend `5432`)'],
['Patroni REST API','`8008`'],
['postgres_exporter (Prometheus)','`9187`'],
['Maintenance database','`postgres`'],
['Template databases','`template1` (editable model), `template0` (pristine, no connections)']]},
{note:'Official Docker images keep data in a volume. The path moved in newer image versions, so read the image documentation for the tag you use and mount the volume at the data path it states.'},
{code:`SHOW data_directory;
SHOW config_file;
SHOW unix_socket_directories;
SHOW port;

pg_lsclusters          # Debian and Ubuntu: every cluster with port and paths`}
]},

/* 4 ---------------------------------------------------------------- logs */
{t:'Log files and where to find them',d:'Every log you may need during an incident, and the settings that control the server log.',see:[[5,0,'Enable logging'],[5,10,'Reading the log']],b:[
{t:[['Log','Where','How to find or read'],
['Server log (collector on)','`log_directory` (default `log` under `PGDATA`)','`SELECT pg_current_logfile();`, file `current_logfiles`'],
['Server log (collector off)','stderr of the postmaster: terminal, journal or the file given to `pg_ctl -l`','`journalctl -u postgresql-18 -n 100`'],
['Debian / Ubuntu','`/var/log/postgresql/postgresql-18-main.log`','`pg_lsclusters` shows the log path'],
['CSV or JSON log','`.csv` or `.json` next to the text log when `csvlog` or `jsonlog` is in `log_destination`','Load the CSV into a table or use `jq`'],
['Windows','`log\\` folder in the data directory, or Event Viewer with `eventlog`','Event Viewer, Application log'],
['`pg_upgrade` output','`pg_upgrade_output.d/` in the new cluster directory','Read the `.log` files after a failed check'],
['Archive status','`pg_wal/archive_status/` (`.ready`, `.done`)','`ls pg_wal/archive_status/*.ready | wc -l`'],
['Backup history','`pg_wal/*.backup`','`cat` the file for the start and stop LSN'],
['Operating system','`/var/log/messages` or `journalctl -k` (OOM killer, disk errors)','`dmesg -T | tail`'],
['SELinux','`/var/log/audit/audit.log`','`ausearch -m avc -ts recent`'],
['PgBouncer','`logfile` in `pgbouncer.ini`, often `/var/log/pgbouncer/pgbouncer.log`','Admin console `SHOW STATS`'],
['pgBackRest','`/var/log/pgbackrest/`','`pgbackrest info`']]},
{h:'Server log settings'},
{t:[['Parameter','Default','Note'],
['`logging_collector`','off','Needs a restart; captures stderr into files'],
['`log_destination`','`stderr`','Also `csvlog`, `jsonlog`, `syslog`, `eventlog`'],
['`log_directory`','`log`','Relative to `PGDATA`'],
['`log_filename`','`postgresql-%Y-%m-%d_%H%M%S.log`','Use a fixed name pattern with rotation if you prefer'],
['`log_rotation_age`','`1d`',''],
['`log_rotation_size`','`10MB`',''],
['`log_line_prefix`','`%m [%p] `','Better: `%m [%p] %u@%d app=%a host=%h `'],
['`log_min_duration_statement`','`-1` (off)','`0` logs everything; `500ms` is a common start'],
['`log_statement`','`none`','`ddl`, `mod`, `all`'],
['`log_connections` / `log_disconnections`','off','Session audit trail'],
['`log_checkpoints`','on (15+)','Shows checkpoint timing and counts'],
['`log_lock_waits`','off','Logs waits longer than `deadlock_timeout`'],
['`log_temp_files`','`-1` (off)','`0` logs every temporary file'],
['`log_autovacuum_min_duration`','`10min`','`0` logs every run']]}
]},

/* 5 ---------------------------------------------------------------- parameters */
{t:'Important parameters',d:'The settings a DBA changes most, with default, when a change applies and a sensible starting point.',see:[[5,1,'Parameters basic'],[5,3,'Reload or restart']],b:[
{p:'Context: **R** = restart (`postmaster`), **L** = reload (`sighup`), **S** = per session or role (`user`, `superuser`). Check with `SELECT name, context, pending_restart FROM pg_settings;`'},
{h:'Connections and timeouts'},
{t:[['Parameter','Default','Ctx','Note'],
['`listen_addresses`','`localhost`','R','`*` for all interfaces'],
['`port`','`5432`','R',''],
['`max_connections`','`100`','R','Use a pooler instead of a very large value'],
['`superuser_reserved_connections`','`3`','R','Slots kept for superusers'],
['`statement_timeout`','`0`','S','`30s` for application roles'],
['`lock_timeout`','`0`','S','`5s` for migrations'],
['`idle_in_transaction_session_timeout`','`0`','S','`5min` protects vacuum'],
['`tcp_keepalives_idle`','OS default','S','Finds dead clients behind firewalls']]},
{h:'Memory'},
{t:[['Parameter','Default','Ctx','Starting point'],
['`shared_buffers`','`128MB`','R','About 25 percent of RAM'],
['`work_mem`','`4MB`','S','Per sort or hash node, per query. Raise per role'],
['`maintenance_work_mem`','`64MB`','S','512 MB to 2 GB'],
['`effective_cache_size`','`4GB`','S','50 to 75 percent of RAM; allocates nothing'],
['`hash_mem_multiplier`','`2.0`','S','Hash operations may use `work_mem` x this'],
['`huge_pages`','`try`','R','Set the OS pool first'],
['`temp_buffers`','`8MB`','S','Temporary tables, per session']]},
{h:'WAL and checkpoints'},
{t:[['Parameter','Default','Ctx','Note'],
['`wal_level`','`replica`','R','`logical` for logical replication'],
['`fsync`','`on`','L','Never turn off on real data'],
['`synchronous_commit`','`on`','S','`off` can lose recent commits, never corrupts'],
['`wal_buffers`','`-1` (auto)','R','1/32 of `shared_buffers`, at most 16 MB'],
['`checkpoint_timeout`','`5min`','L','15 to 30 min on busy servers'],
['`max_wal_size`','`1GB`','L','Large enough that checkpoints are timed'],
['`min_wal_size`','`80MB`','L','WAL kept for recycling'],
['`checkpoint_completion_target`','`0.9`','L',''],
['`full_page_writes`','`on`','L','Protects against torn pages'],
['`wal_compression`','`off`','S','`lz4` or `zstd` if CPU allows'],
['`archive_mode`','`off`','R','`on` for continuous archiving'],
['`archive_command` / `archive_library`','empty','L','Must return success only when the file is safe'],
['`wal_keep_size`','`0`','L','Extra WAL kept for standbys']]},
{h:'Replication'},
{t:[['Parameter','Default','Ctx','Note'],
['`max_wal_senders`','`10`','R','One per standby or backup'],
['`max_replication_slots`','`10`','R',''],
['`hot_standby`','`on`','R','Read queries on a standby'],
['`hot_standby_feedback`','`off`','L','On: fewer conflicts, more bloat on the primary'],
['`max_standby_streaming_delay`','`30s`','L','How long replay waits for conflicting queries'],
['`synchronous_standby_names`','empty','L','Turns on synchronous replication'],
['`max_slot_wal_keep_size`','`-1`','L','Limit WAL an abandoned slot can hold'],
['`primary_conninfo`','empty','L','On a standby: how to reach the primary'],
['`idle_replication_slot_timeout` (18)','`0`','L','Invalidate slots idle for this long']]},
{h:'Autovacuum'},
{t:[['Parameter','Default','Ctx','Note'],
['`autovacuum`','`on`','L','Do not disable'],
['`autovacuum_max_workers`','`3`','R (before 18)','Raise for many large tables'],
['`autovacuum_naptime`','`1min`','L',''],
['`autovacuum_vacuum_scale_factor`','`0.2`','L','Lower per table on big tables'],
['`autovacuum_vacuum_threshold`','`50`','L',''],
['`autovacuum_analyze_scale_factor`','`0.1`','L',''],
['`autovacuum_vacuum_cost_limit`','`-1` (uses 200)','L','Raise on fast storage'],
['`autovacuum_vacuum_cost_delay`','`2ms`','L',''],
['`autovacuum_freeze_max_age`','`200000000`','R','Forces anti-wraparound vacuum']]},
{h:'Planner and parallelism'},
{t:[['Parameter','Default','Ctx','Note'],
['`random_page_cost`','`4.0`','S','About 1.1 on SSD or NVMe'],
['`seq_page_cost`','`1.0`','S',''],
['`default_statistics_target`','`100`','S','Raise per column for skewed data'],
['`max_worker_processes`','`8`','R','Pool for all background workers'],
['`max_parallel_workers_per_gather`','`2`','S',''],
['`jit`','`on`','S','Helps only long analytic queries'],
['`io_method` (18)','`worker`','R','`io_uring` or `sync` also possible']]},
{h:'Security'},
{t:[['Parameter','Default','Ctx','Note'],
['`password_encryption`','`scram-sha-256`','S','`md5` deprecated in 18'],
['`ssl`','`off`','L','Also set `ssl_cert_file`, `ssl_key_file`'],
['`ssl_min_protocol_version`','`TLSv1.2`','L',''],
['`row_security`','`on`','S',''],
['`log_connections`','`off`','R (before 18)','Session audit trail']]}
]},

/* 6 ---------------------------------------------------------------- views and functions */
{t:'System views and functions',d:'Which view answers which question, and the functions a DBA calls every week.',see:[[4,0,'Catalog views'],[4,10,'Statistics views']],b:[
{h:'Which view answers what'},
{t:[['Question','View'],
['Who is connected and what are they running?','`pg_stat_activity`'],
['Who is blocking whom?','`pg_locks`, `pg_blocking_pids(pid)`'],
['How is a database doing (commits, cache hits, deadlocks, temp files)?','`pg_stat_database`'],
['Which tables are scanned, dead, vacuumed?','`pg_stat_user_tables`'],
['Which indexes are never used?','`pg_stat_user_indexes`'],
['Which statements cost the most?','`pg_stat_statements` (extension)'],
['Are checkpoints forced by WAL volume?','`pg_stat_checkpointer` (17+), `pg_stat_bgwriter`'],
['How much WAL is produced?','`pg_stat_wal`'],
['Where does I/O come from?','`pg_stat_io` (16+)'],
['Is archiving working?','`pg_stat_archiver`'],
['How far behind is each standby?','`pg_stat_replication` (primary), `pg_stat_wal_receiver` (standby)'],
['Which slots hold WAL?','`pg_replication_slots`'],
['What is running a long operation?','`pg_stat_progress_vacuum`, `_create_index`, `_basebackup`, `_copy`'],
['Which settings are active and where from?','`pg_settings`, `pg_file_settings`'],
['Which `pg_hba.conf` rules are loaded?','`pg_hba_file_rules`'],
['Which roles and memberships exist?','`pg_roles`, `pg_auth_members`'],
['Which extensions are installed or available?','`pg_extension`, `pg_available_extensions`'],
['How big is it?','`pg_database_size()`, `pg_total_relation_size()`, `pg_size_pretty()`']]},
{h:'Functions you will use'},
{t:[['Function','Does'],
['`pg_reload_conf()`','Reload configuration files'],
['`pg_cancel_backend(pid)`','Cancel the current query of a session'],
['`pg_terminate_backend(pid)`','End a session'],
['`pg_is_in_recovery()`','True on a standby'],
['`pg_current_wal_lsn()`','Current write position (primary)'],
['`pg_last_wal_replay_lsn()`','Last replayed position (standby)'],
['`pg_wal_lsn_diff(a, b)`','Bytes between two LSNs'],
['`pg_switch_wal()`','Close the current WAL segment'],
['`pg_create_restore_point(name)`','Named point for PITR'],
['`pg_promote()`','Promote a standby'],
['`pg_backup_start()` / `pg_backup_stop()`','Low-level online backup (15+ names)'],
['`pg_relation_filepath(rel)`','File of a relation'],
['`pg_stat_reset()`','Reset statistics of the current database'],
['`pg_current_logfile()`','Name of the current log file']]}
]},

/* 7 ---------------------------------------------------------------- tools */
{t:'Command-line tools',d:'Utilities that ship with PostgreSQL, what each is for and a typical command.',see:[[4,2,'Environment variables'],[3,4,'psql essentials']],b:[
{t:[['Tool','Purpose','Typical use'],
['`initdb`','Create a new cluster','`initdb -D /data/pg18 --data-checksums`'],
['`pg_ctl`','Start, stop, reload, promote','`pg_ctl -D $PGDATA stop -m fast`'],
['`psql`','Interactive client','`psql -h host -U user -d db`'],
['`createdb`, `dropdb`, `createuser`','Wrappers for SQL commands','`createdb -T template0 -E UTF8 appdb`'],
['`pg_isready`','Is the server accepting connections?','`pg_isready -h host -p 5432`'],
['`pg_dump`','Logical backup of one database','`pg_dump -Fd -j 4 -f dir appdb`'],
['`pg_dumpall`','Roles, tablespaces and all databases','`pg_dumpall -g -f globals.sql`'],
['`pg_restore`','Restore archive formats','`pg_restore -j 4 -d appdb dir`'],
['`pg_basebackup`','Physical backup or new standby','`pg_basebackup -D /backup -X stream -R -P`'],
['`pg_combinebackup` (17+)','Combine incremental backups','`pg_combinebackup full incr1 -o out`'],
['`pg_verifybackup`','Check a base backup against its manifest','`pg_verifybackup /backup`'],
['`pg_upgrade`','In-place major upgrade','`pg_upgrade --check ...`'],
['`pg_rewind`','Resynchronise an old primary','`pg_rewind --target-pgdata=... --source-server=...`'],
['`pg_receivewal`','Stream WAL to a directory','`pg_receivewal -D /archive -S slot1`'],
['`pg_waldump`','Print WAL records','`pg_waldump -p pg_wal 000000010000000000000001`'],
['`pg_controldata`','Show the control file','`pg_controldata $PGDATA`'],
['`pg_resetwal`','Last resort: reset WAL after severe damage','Never without a backup of the directory'],
['`pg_amcheck`','Check heap and B-tree integrity','`pg_amcheck -d appdb`'],
['`pg_checksums`','Enable, disable or verify data checksums (cluster stopped)','`pg_checksums --check -D $PGDATA`'],
['`vacuumdb`','VACUUM or ANALYZE from the shell','`vacuumdb -d appdb -j 4 --analyze-in-stages`'],
['`reindexdb`','REINDEX from the shell','`reindexdb --concurrently -d appdb`'],
['`pgbench`','Benchmark','`pgbench -c 32 -j 4 -T 60 appdb`'],
['`pg_test_fsync`, `pg_test_timing`','Disk sync and timer overhead','Run before tuning WAL settings']]},
{h:'psql meta-commands'},
{t:[['Command','Shows'],
['`\\l`, `\\c db`','Databases, connect to another'],
['`\\dn`, `\\dt`, `\\di`, `\\dv`, `\\df`','Schemas, tables, indexes, views, functions (add `+` for size or details)'],
['`\\d table`','Columns, indexes, constraints'],
['`\\du`, `\\dp`','Roles, privileges'],
['`\\db`, `\\dx`','Tablespaces, extensions'],
['`\\x`, `\\timing`','Expanded output, query time'],
['`\\i file`, `\\copy`','Run a script, client-side copy'],
['`\\conninfo`, `\\q`','Connection details, quit']]}
]},

/* 8 ---------------------------------------------------------------- decision tables */
{t:'Decision tables',d:'Shutdown modes, reload or restart, which backup, which restore, how to promote.',see:[[3,2,'Shutdown modes'],[8,0,'Backup and restore']],b:[
{h:'Shutdown modes'},
{t:[['Mode','Signal','Sessions','Next start'],
['smart','`SIGTERM`','Waits for clients to leave','Clean'],
['fast (default)','`SIGINT`','Rolls back and disconnects, then checkpoints','Clean'],
['immediate','`SIGQUIT`','Aborts all processes, no checkpoint','Crash recovery']]},
{h:'Reload or restart?'},
{t:[['Context in `pg_settings`','Action','Examples'],
['`postmaster`','Restart','`shared_buffers`, `max_connections`, `wal_level`, `listen_addresses`'],
['`sighup`','Reload','`checkpoint_timeout`, `max_wal_size`, `autovacuum_*`'],
['`superuser`, `user`','Reload or per-session `SET`','`work_mem`, `log_min_duration_statement`'],
['`backend`','Applies to new connections','`log_connections` (before 18)'],
['`pg_hba.conf`, `pg_ident.conf`','Reload','']]},
{h:'Which backup?'},
{t:[['Need','Use'],
['One database, one schema or one table','`pg_dump`'],
['Roles and tablespaces','`pg_dumpall -g`'],
['Whole cluster, fast restore, standby','`pg_basebackup`'],
['Recover to a point in time','Base backup plus WAL archive'],
['Move to a newer major version','`pg_dump`, `pg_upgrade` or logical replication'],
['Parallel dump','`pg_dump -Fd -j N`'],
['Smaller daily backups on big clusters (17+)','Incremental backups with `pg_combinebackup`']]},
{h:'Which restore tool?'},
{t:[['Dump file','Tool'],
['Plain `.sql`','`psql -X -v ON_ERROR_STOP=1 -f file`'],
['Custom `-Fc`, directory `-Fd`, tar `-Ft`','`pg_restore`'],
['Base backup','Copy files back, add `recovery.signal` (PITR) or `standby.signal`, start']]},
{h:'Recovery and standby signals'},
{t:[['File or setting','Effect'],
['`recovery.signal`','Archive recovery, ends at the target and then promotes (with `recovery_target_action`)'],
['`standby.signal`','Start as a standby and keep replaying'],
['`restore_command`','How to fetch archived WAL'],
['`recovery_target_time`, `_lsn`, `_xid`, `_name`, `immediate`','Where to stop'],
['`recovery_target_timeline`','Which timeline to follow (`latest` is the default)']]},
{h:'Promote and switch over'},
{code:`pg_ctl promote -D $PGDATA              # or SELECT pg_promote();
SELECT pg_is_in_recovery();             -- false after promotion

# planned switchover: stop clients, stop the old primary cleanly, promote the standby,
# then rebuild or pg_rewind the old primary as a standby`}
]},

/* 9 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, the likely cause and the fix, grouped by area.',see:[[1,14,'Installation troubleshooting'],[5,10,'Reading the log'],[9,10,'Failover']],b:[
{h:'Start-up and connections'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Server will not start','Foreground: `postgres -D $PGDATA`; last lines of the log','Stale `postmaster.pid`, permissions not `0700`, port in use, bad parameter, missing preload library','Fix the cause; remove the PID file only if no postgres process runs'],
['Starts, then stops at once','`journalctl -u postgresql-18`, `pg_controldata`','Invalid value in `postgresql.conf`, WAL or control file damage, out of disk','`postgres -C data_directory` to test the config; free space'],
['`connection refused`','`ss -ltnp | grep 5432`, `SHOW listen_addresses;`','Not listening on that interface, firewall, server down','Set `listen_addresses`, restart, open the port'],
['Connection hangs (timeout)','`telnet host 5432`, cloud security groups','Firewall or routing drops packets','Open the path; set `connect_timeout` in clients'],
['`no pg_hba.conf entry`','Log line with host, user, database, SSL','No matching rule, or rule needs `hostssl`','Add a rule above any broader one, reload'],
['`password authentication failed`','`SELECT rolpassword IS NULL FROM pg_authid WHERE rolname = ...`','Wrong password, no password, method mismatch (md5 vs SCRAM)','Reset the password; use SCRAM end to end'],
['`too many clients` / slots reserved','`SELECT count(*) FROM pg_stat_activity;`','`max_connections` reached, leaking pools','Close idle sessions, size the pool, add PgBouncer'],
['Cannot log in as `postgres` (password lost)','Local `peer` works with `sudo -u postgres psql`','Password unknown','`ALTER ROLE postgres PASSWORD ...` from the local socket; never leave `trust` in place']]},
{h:'Performance'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Query suddenly slow','`EXPLAIN (ANALYZE, BUFFERS)`, `last_autoanalyze`','Stale statistics, plan change, missing index','`ANALYZE`, add an index, check parameters'],
['High CPU','`pg_stat_statements` by `total_exec_time`, `pg_stat_activity`','A few heavy queries, seq scans, too much parallelism','Fix the top query; index; limit workers'],
['High I/O wait, low cache hit','`pg_stat_io`, `pg_statio_user_tables`','Working set larger than memory, big scans, bloat','Indexes, more RAM, partition, vacuum'],
['Latency spikes every few minutes','`log_checkpoints`, `pg_stat_checkpointer`','Forced checkpoints, WAL volume','Raise `max_wal_size`, `checkpoint_timeout`'],
['Many connections, high load average','`pg_stat_activity` by state','Too many active backends for the cores','Connection pool, lower `max_connections`'],
['Temporary files in the log','`log_temp_files = 0`, `pg_stat_database.temp_bytes`','`work_mem` too small for a sort or hash','Raise `work_mem` for that role; fix the query'],
['Slow commits','`wait_event` of `WALWrite` / `SyncRep`','Slow WAL disk, synchronous standby lagging','Faster WAL volume; check standby; relax `synchronous_commit`'],
['Slow after upgrade or restore','`pg_stat_user_tables.last_analyze` is empty','No statistics yet','`vacuumdb --all --analyze-in-stages`'],
['Out of memory error','Log, `dmesg`, `work_mem` x connections','Too many large sorts at once','Lower `work_mem`, reduce connections, add pooler']]},
{h:'Locks, transactions and vacuum'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Sessions waiting','`wait_event_type = \'Lock\'`, `pg_blocking_pids(pid)`','Long transaction holds a lock','End the blocker, shorten transactions'],
['`ALTER TABLE` hangs and everything queues behind it','`pg_locks` with `granted = false`','DDL waits for an old transaction while new queries queue','Set `lock_timeout`, retry in a quiet moment, end the blocker'],
['Deadlock detected','Log `DETAIL` lines','Transactions lock rows in different order','Same order everywhere; retry on `40P01`'],
['`idle in transaction` sessions pile up','`pg_stat_activity` state','Application forgot to commit or roll back','Fix the app; `idle_in_transaction_session_timeout`'],
['Table keeps growing','`n_dead_tup`, `last_autovacuum`, oldest xmin','Vacuum blocked or too slow','End old transaction or slot; tune per table'],
['Vacuum never finishes','`pg_stat_progress_vacuum`','Huge table, low cost limit, many indexes','Raise cost limit and `maintenance_work_mem`; `VACUUM (PARALLEL n)`'],
['Wraparound warning','`age(datfrozenxid)`','Freezing fell behind','Find blockers; `VACUUM (FREEZE)` the oldest tables'],
['Orphaned prepared transactions','`pg_prepared_xacts`','Two-phase commit manager lost','`COMMIT PREPARED` or `ROLLBACK PREPARED`']]},
{h:'Storage and WAL'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Disk full on `pg_wal`','`pg_replication_slots`, `pg_stat_archiver`','Abandoned slot or failing `archive_command`','Drop the slot, fix archiving; never delete WAL by hand'],
['Disk full on the data volume','`pg_database_size`, `du -sh base/*`, temp files','Bloat, runaway temp files, big logs','Remove bloat, set `temp_file_limit`, rotate logs'],
['Archive command failing','`pg_stat_archiver.last_failed_wal`, log','Destination unreachable or full, permissions','Fix the target; keep WAL until archived'],
['`invalid page in block` / checksum failure','Log, `pg_amcheck`, `data_checksums`','Storage corruption, memory fault','Restore from backup or standby; check hardware'],
['Database will not drop','`pg_stat_activity` for that database','Active connections','`DROP DATABASE ... WITH (FORCE)` or end sessions'],
['Collation version warning','`SELECT datname, datcollversion FROM pg_database;`','OS library upgraded','`REINDEX`, then `ALTER DATABASE ... REFRESH COLLATION VERSION`']]},
{h:'Replication and failover'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Standby lags','`pg_stat_replication` lag columns','Slow network or I/O, long queries, conflicts','Check network and disks; tune `max_standby_streaming_delay`'],
['`requested WAL segment has already been removed`','Standby log, `pg_replication_slots`','Standby fell behind and WAL was recycled','Use a slot or archive; rebuild with `pg_basebackup`'],
['Standby queries cancelled','`pg_stat_database_conflicts`','Replay conflicts with a query','Shorter queries, `hot_standby_feedback`, larger delay'],
['Standby will not start','Log, `standby.signal`, `primary_conninfo`','Wrong settings, version mismatch, missing tablespace path','Fix settings; same major version and paths'],
['Old primary will not rejoin','Timeline in log','Diverged WAL after failover','`pg_rewind` or rebuild; fence the old primary first'],
['Two primaries (split brain)','`pg_is_in_recovery()` on both','Failover without fencing','Stop one, decide which data wins, rebuild the other'],
['Logical replication stuck','`pg_stat_subscription`, `pg_replication_slots`','Conflict on a row, missing table or permission','Fix the conflict on the subscriber; skip with care']]},
{h:'Upgrade and restore'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['`pg_upgrade --check` fails','`pg_upgrade_output.d/*.log`','Missing extension library, reg* column types, incompatible settings','Install libraries in the new version; drop or fix the objects'],
['Restore errors `role does not exist`','Dump header','Globals not restored first','Restore `pg_dumpall -g` first'],
['Restore very slow','`pg_restore -v`','Single thread, small `maintenance_work_mem`, many indexes','`-j N`, raise memory, `--no-sync`; tune `max_wal_size`'],
['Restore stops at first error','`psql` output','Default `psql` continues; or constraint order','`-v ON_ERROR_STOP=1`; use `-1`']]}
]},

/* 10 ---------------------------------------------------------------- error messages */
{t:'Common error messages',d:'The messages you will see most, with the SQLSTATE code, the usual cause and the fix.',see:[[3,0,'Remote connection'],[5,10,'Reading the log']],b:[
{h:'Connection and authentication'},
{t:[['Message','SQLSTATE','Cause','Fix'],
['`FATAL: password authentication failed for user "x"`','28P01','Wrong password, or the stored hash type does not match the method','Reset the password; check `password_encryption` and `pg_hba.conf`'],
['`FATAL: no pg_hba.conf entry for host "h", user "u", database "d"`','28000','No rule matches this client','Add a rule, reload'],
['`FATAL: role "x" does not exist`','28000','Wrong role name, or wrong cluster or port','Check `\\du` and the port'],
['`FATAL: database "x" does not exist`','3D000','Wrong name, or connected to another cluster','`\\l`; check the port'],
['`FATAL: sorry, too many clients already`','53300','`max_connections` reached','Close idle sessions; add a pooler'],
['`FATAL: remaining connection slots are reserved for non-replication superuser connections`','53300','Only reserved slots left','Same; log in as a superuser to clear sessions'],
['`FATAL: the database system is starting up` or `is in recovery mode`','57P03','Crash recovery or standby start in progress','Wait; watch the log for "consistent recovery state"'],
['`could not connect to server: Connection refused`','client','Server down or not listening there','Start it; check `listen_addresses`, port, firewall'],
['`FATAL: terminating connection due to administrator command`','57P01','`pg_terminate_backend` or a shutdown','Expected during restarts; check who ended it'],
['`FATAL: data directory "..." has invalid permissions`','start-up','Mode not `0700` or `0750`','`chmod 700 $PGDATA`'],
['`FATAL: lock file "postmaster.pid" already exists`','start-up','Another server runs, or stale file after a crash','Check for running postgres; remove only if none'],
['`could not bind IPv4 address: Address already in use`','start-up','Port taken by another process','Change `port` or stop the other process']]},
{h:'Queries and data'},
{t:[['Message','SQLSTATE','Cause','Fix'],
['`ERROR: permission denied for table x`','42501','Missing privilege, or schema `USAGE`','`GRANT`; check schema and default privileges'],
['`ERROR: relation "x" does not exist`','42P01','Wrong name, wrong `search_path`, wrong database','Qualify with the schema; check `search_path`'],
['`ERROR: column "x" does not exist`','42703','Typo, or case-sensitive quoted name','Check `\\d table`'],
['`ERROR: duplicate key value violates unique constraint`','23505','Insert or update repeats a key','Fix the data; use `ON CONFLICT`'],
['`ERROR: null value in column "x" violates not-null constraint`','23502','Missing value','Supply a value or default'],
['`ERROR: insert or update on table violates foreign key constraint`','23503','Parent row missing','Insert the parent first'],
['`ERROR: invalid input syntax for type integer: "abc"`','22P02','Bad literal or cast','Clean or validate the input'],
['`ERROR: value too long for type character varying(n)`','22001','Text longer than the column','Shorten or widen the column'],
['`ERROR: current transaction is aborted, commands ignored until end of transaction block`','25P02','An earlier statement failed in this transaction','`ROLLBACK`; handle the first error']]},
{h:'Concurrency and limits'},
{t:[['Message','SQLSTATE','Cause','Fix'],
['`ERROR: deadlock detected`','40P01','Circular lock wait','Lock rows in the same order; retry'],
['`ERROR: could not serialize access due to concurrent update`','40001','`REPEATABLE READ` or `SERIALIZABLE` conflict','Retry the transaction'],
['`ERROR: canceling statement due to statement timeout`','57014','`statement_timeout` reached','Tune the query or the timeout'],
['`ERROR: canceling statement due to lock timeout`','55P03','`lock_timeout` reached','Find the blocker; retry'],
['`ERROR: out of shared memory` with `max_locks_per_transaction` hint','53200','Too many locks in one transaction (many partitions or tables)','Raise `max_locks_per_transaction` (restart)'],
['`ERROR: could not extend file "...": No space left on device`','53100','Data volume full','Free space; find bloat or temp files'],
['`PANIC: could not write to file "pg_wal/...": No space left on device`','53100','WAL volume full','Free space or add a disk; fix slot or archive; restart']]},
{h:'Replication, WAL and operations'},
{t:[['Message','SQLSTATE','Cause','Fix'],
['`ERROR: requested WAL segment ... has already been removed`','58P01','Standby too far behind and no slot or archive','Rebuild the standby; add a slot or archive'],
['`ERROR: canceling statement due to conflict with recovery`','40001','Replay conflicts with a standby query','Shorter queries; `hot_standby_feedback`'],
['`WARNING: archive command failed with exit code 1`','log','Archive target unavailable or wrong command','Test `archive_command` as `postgres`; fix and keep WAL'],
['`LOG: checkpoints are occurring too frequently`','log','`max_wal_size` too small for the write rate','Raise `max_wal_size`'],
['`WARNING: oldest xmin is far in the past`','log','Old transaction or slot blocks vacuum','End it; check `pg_replication_slots`'],
['`ERROR: database is not accepting commands to avoid wraparound data loss`','54000','Transaction ID wraparound is near','Vacuum the oldest tables (single-user mode if needed)'],
['`ERROR: could not open extension control file "...x.control"`','58P01','Extension files not installed for this version','Install the package; `CREATE EXTENSION`'],
['`FATAL: could not load library "...": cannot open shared object file`','58P01','Wrong name in `shared_preload_libraries`, library missing','Fix the list; install the package; restart']]}
]},

/* 11 ---------------------------------------------------------------- health queries */
{t:'Health-check SQL pack',d:'Paste-ready queries for the daily and weekly checks, grouped by what you are checking.',see:[[4,10,'Statistics views'],[5,10,'Reading the log']],b:[
{p:'Run as a role with `pg_monitor` (or a superuser). Statistics counters grow since the last reset, so compare two readings when you need a rate.'},
{h:'1. Instance basics'},
{code:`SELECT version();
SELECT pg_postmaster_start_time() AS started, now() - pg_postmaster_start_time() AS uptime;
SELECT pg_is_in_recovery() AS is_standby;

-- settings that differ from the defaults, and anything waiting for a restart
SELECT name, setting, unit, source FROM pg_settings
WHERE source NOT IN ('default', 'override') ORDER BY name;
SELECT name, setting, pending_restart FROM pg_settings WHERE pending_restart;`},
{h:'2. Connections and sessions'},
{code:`SELECT count(*) AS used, current_setting('max_connections')::int AS max,
       round(100.0 * count(*) / current_setting('max_connections')::int, 1) AS pct_used
FROM pg_stat_activity WHERE backend_type = 'client backend';

SELECT datname, usename, application_name, state, count(*)
FROM pg_stat_activity WHERE backend_type = 'client backend'
GROUP BY 1, 2, 3, 4 ORDER BY 5 DESC;

-- idle in transaction: the usual vacuum blocker
SELECT pid, usename, application_name, client_addr, now() - state_change AS idle_for, left(query, 60) AS last_query
FROM pg_stat_activity WHERE state LIKE 'idle in transaction%' ORDER BY state_change;

-- queries running longer than 5 minutes
SELECT pid, usename, now() - query_start AS runtime, wait_event_type, wait_event, left(query, 70) AS query
FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > interval '5 minutes'
ORDER BY runtime DESC;`},
{h:'3. Locks and blockers'},
{code:`SELECT blocked.pid AS blocked_pid, blocked.usename AS blocked_user,
       blocking.pid AS blocking_pid, blocking.usename AS blocking_user,
       now() - blocked.query_start AS waiting_for,
       left(blocked.query, 50) AS blocked_query, left(blocking.query, 50) AS blocking_query
FROM pg_stat_activity blocked
JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS b(pid) ON true
JOIN pg_stat_activity blocking ON blocking.pid = b.pid;

-- left-over prepared transactions
SELECT gid, prepared, owner, database FROM pg_prepared_xacts;`},
{h:'4. Size and growth'},
{code:`SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database ORDER BY pg_database_size(datname) DESC;

SELECT relid::regclass AS table_name,
       pg_size_pretty(pg_table_size(relid)) AS table_size,
       pg_size_pretty(pg_indexes_size(relid)) AS index_size,
       pg_size_pretty(pg_total_relation_size(relid)) AS total
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;

SELECT indexrelid::regclass AS index_name, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_index ORDER BY pg_relation_size(indexrelid) DESC LIMIT 10;`},
{h:'5. Vacuum, bloat and wraparound'},
{code:`SELECT relname, n_live_tup, n_dead_tup,
       round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;

-- how close each big table is to its autovacuum threshold (global settings only)
SELECT s.relname, s.n_dead_tup,
       round(current_setting('autovacuum_vacuum_threshold')::numeric
           + current_setting('autovacuum_vacuum_scale_factor')::numeric * c.reltuples) AS vacuum_at
FROM pg_stat_user_tables s JOIN pg_class c ON c.oid = s.relid
ORDER BY s.n_dead_tup DESC LIMIT 10;

-- exact bloat for one table (extension pgstattuple)
SELECT * FROM pgstattuple('public.orders');

SELECT datname, age(datfrozenxid) AS xid_age, mxid_age(datminmxid) AS multixact_age
FROM pg_database ORDER BY 2 DESC;

SELECT c.oid::regclass AS table_name, age(c.relfrozenxid) AS xid_age
FROM pg_class c WHERE c.relkind IN ('r', 'm', 't') ORDER BY 2 DESC LIMIT 10;`},
{h:'6. Indexes and schema quality'},
{code:`-- indexes never used (excluding unique and primary keys)
SELECT s.relname AS table_name, s.indexrelname AS index_name, s.idx_scan,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
FROM pg_stat_user_indexes s JOIN pg_index i USING (indexrelid)
WHERE s.idx_scan = 0 AND NOT i.indisunique ORDER BY pg_relation_size(s.indexrelid) DESC LIMIT 10;

-- invalid indexes left by a failed CONCURRENTLY build
SELECT indexrelid::regclass AS index_name, indrelid::regclass AS table_name FROM pg_index WHERE NOT indisvalid;

-- foreign keys whose first column has no index
SELECT c.conrelid::regclass AS table_name, c.conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.contype = 'f'
  AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]);

-- tables without a primary key
SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p') AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid AND i.indisprimary);

-- tables read mostly by sequential scan
SELECT relname, seq_scan, seq_tup_read, idx_scan, n_live_tup
FROM pg_stat_user_tables WHERE seq_scan > 0 ORDER BY seq_tup_read DESC LIMIT 10;

-- sequences running out of room (integer overflow)
SELECT schemaname, sequencename, last_value, max_value,
       round(100.0 * last_value / max_value, 2) AS pct_used
FROM pg_sequences WHERE last_value IS NOT NULL ORDER BY pct_used DESC LIMIT 10;`},
{h:'7. Cache, I/O and statements'},
{code:`SELECT datname, round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) AS hit_pct,
       xact_commit, xact_rollback, deadlocks, temp_files, pg_size_pretty(temp_bytes) AS temp_size
FROM pg_stat_database WHERE datname = current_database();

SELECT relname, heap_blks_read, heap_blks_hit,
       round(100.0 * heap_blks_hit / nullif(heap_blks_hit + heap_blks_read, 0), 1) AS hit_pct
FROM pg_statio_user_tables ORDER BY heap_blks_read DESC LIMIT 10;

SELECT num_timed, num_requested, write_time, sync_time FROM pg_stat_checkpointer;
SELECT wal_records, wal_fpi, pg_size_pretty(wal_bytes) AS wal_written, stats_reset FROM pg_stat_wal;

-- statements (extension pg_stat_statements)
SELECT calls, round(total_exec_time::numeric) AS total_ms, round(mean_exec_time::numeric, 2) AS mean_ms,
       rows, left(query, 70) AS query
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;

SELECT calls, pg_size_pretty(wal_bytes) AS wal, temp_blks_written, left(query, 70) AS query
FROM pg_stat_statements ORDER BY wal_bytes DESC LIMIT 10;`},
{h:'8. Replication, WAL and archiving'},
{code:`-- on the primary
SELECT application_name, client_addr, state, sync_state,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS replay_lag_bytes,
       replay_lag
FROM pg_stat_replication;

SELECT slot_name, slot_type, active, wal_status,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained
FROM pg_replication_slots;

-- on a standby
SELECT now() - pg_last_xact_replay_timestamp() AS replay_delay,
       pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn(), pg_is_wal_replay_paused();
SELECT datname, confl_snapshot, confl_lock, confl_bufferpin, confl_deadlock FROM pg_stat_database_conflicts;

-- archiving
SELECT archived_count, failed_count, last_archived_wal, last_archived_time, last_failed_wal, last_failed_time
FROM pg_stat_archiver;`},
{h:'9. Security audit'},
{code:`SELECT rolname FROM pg_roles WHERE rolsuper;                                   -- superusers
SELECT rolname FROM pg_authid WHERE rolcanlogin AND rolpassword IS NULL;       -- login roles with no password
SELECT rolname FROM pg_authid WHERE rolpassword LIKE 'md5%';                   -- roles still on md5
SELECT rolname, rolvaliduntil FROM pg_roles WHERE rolvaliduntil IS NOT NULL ORDER BY 2;

-- risky rules in pg_hba.conf, and any syntax errors
SELECT line_number, type, database, user_name, address, auth_method, error
FROM pg_hba_file_rules WHERE error IS NOT NULL OR auth_method IN ('trust', 'md5', 'password');

SELECT extname, extversion FROM pg_extension ORDER BY 1;
SELECT relname FROM pg_class WHERE relpersistence = 'u' AND relkind = 'r';     -- unlogged tables: lost after a crash`}
]},

/* 12 ---------------------------------------------------------------- naming decoder */
{t:'Naming decoder',d:'How to read WAL file names, LSNs, timelines, relfilenodes, OIDs, ctids and log prefixes.',see:[[2,4,'WAL'],[7,0,'WAL format'],[2,6,'PGDATA layout']],b:[
{h:'WAL file name: 24 hex characters'},
{t:[['Part','Characters','Meaning','Example `000000010000000A000000C3`'],
['Timeline','1 to 8','History branch; starts at 1, increases after each promotion or PITR','`00000001` = timeline 1'],
['Log (high LSN)','9 to 16','High 32 bits of the LSN','`0000000A`'],
['Segment','17 to 24','Segment number inside that log (with 16 MB segments, `00` to `FF`)','`000000C3`']]},
{p:'So `000000010000000A000000C3` holds LSNs from `A/C3000000` to `A/C3FFFFFF` on timeline 1. With the default 16 MB segment size, the last two hex digits of the segment number change every 16 MB.'},
{h:'LSN: Log Sequence Number'},
{t:[['Form','Meaning'],
['`A/C3001F28`','High part `A`, low part `C3001F28`, both hex. Total position is a 64-bit byte offset into the WAL stream'],
['Offset in segment','Low 24 bits of the LSN (with 16 MB segments): `001F28`'],
['Difference in bytes','`pg_wal_lsn_diff(lsn1, lsn2)`'],
['File for an LSN','`pg_walfile_name(lsn)` and `pg_walfile_name_offset(lsn)`'],
['Current positions','`pg_current_wal_lsn()` (write), `pg_current_wal_flush_lsn()`, `pg_last_wal_replay_lsn()` (standby)']]},
{h:'Other files in pg_wal'},
{t:[['File','Meaning'],
['`00000002.history`','Timeline history: where timeline 2 branched from timeline 1'],
['`000000010000000000000010.00000028.backup`','Backup history: start segment, offset, label and times'],
['`....partial`','Last, incomplete segment of an old timeline kept after promotion'],
['`archive_status/<segment>.ready`','Segment waiting for `archive_command`'],
['`archive_status/<segment>.done`','Segment already archived'],
['`summaries/`','WAL summaries for incremental backups (17+)']]},
{h:'Objects and files'},
{t:[['Term','Meaning','Find it'],
['OID','Object identifier: the permanent id of a catalog row (table, index, type, role)','`SELECT oid, relname FROM pg_class`'],
['relfilenode','Name of the data file. Starts equal to the OID but changes when the relation is rewritten (`VACUUM FULL`, `TRUNCATE`, `CLUSTER`, `REINDEX`, some `ALTER TABLE`)','`pg_class.relfilenode`, `pg_relation_filepath(rel)`'],
['Database folder','`base/<database OID>/`','`SELECT oid, datname FROM pg_database`'],
['Tablespace id','`1663` is `pg_default`, `1664` is `pg_global`; others are user tablespaces under `pg_tblspc/<OID>`','`SELECT oid, spcname FROM pg_tablespace`'],
['Tablespace subdirectory','`PG_<major>_<catalog version>` inside a tablespace location','`ls <location>`'],
['File to table','Reverse lookup of a file number','`SELECT pg_filenode_relation(0, 16397);` or the `oid2name` tool'],
['Forks','`_fsm`, `_vm`, `_init`; segments `.1`, `.2` at every 1 GB','`pg_relation_size(rel, \'vm\')`'],
['System identifier','Unique id of the cluster; must match between primary and physical standby','`pg_controldata`, `pg_control_system()`']]},
{h:'Row and transaction identifiers'},
{t:[['Term','Meaning'],
['`ctid`','Physical location of a row version: (page number, line pointer). Changes on update'],
['`xmin` / `xmax`','Transaction that created / deleted or locked the row version'],
['xid','32-bit transaction id, assigned at the first write; wraps around, so it is frozen by vacuum'],
['Virtual xid','`backend/counter`, for read-only transactions, no wraparound cost'],
['`age(xid)`','How many transactions old an xid is; compare with `autovacuum_freeze_max_age`'],
['Timeline id','Number in the WAL file name and `.history` file; shown by `pg_controldata`']]},
{h:'log_line_prefix codes'},
{t:[['Code','Value'],
['`%m` / `%t`','Timestamp with / without milliseconds'],
['`%p`','Process id of the backend'],
['`%u` / `%d`','User / database'],
['`%a`','`application_name`'],
['`%h`','Client host or address'],
['`%x` / `%v`','Transaction id / virtual transaction id'],
['`%l` / `%s`','Line number in the session / session start time'],
['`%e`','SQLSTATE of the message'],
['`%q`','Stop here in non-session processes'],
['`%i`','Command tag, such as `SELECT` or `idle`']]},
{h:'Sizes to remember'},
{t:[['Thing','Default size'],
['Page','8 kB'],
['Table or index file segment','1 GB'],
['WAL segment','16 MB (`initdb --wal-segsize`)'],
['`shared_buffers`','128 MB']]}
]},

/* 13 ---------------------------------------------------------------- security checklist */
{t:'Security checklist',d:'pg_hba.conf methods, the PUBLIC clean-up, the MD5 to SCRAM migration and a hardening checklist.',see:[[6,1,'Authentication and authorization'],[6,2,'Public role'],[6,9,'Passwords, SCRAM and TLS']],b:[
{h:'pg_hba.conf authentication methods'},
{t:[['Method','Use','Notes'],
['`scram-sha-256`','Password logins over the network','The recommended password method'],
['`peer`','Local socket, OS user must match the role','Good for the local `postgres` admin'],
['`cert`','TLS client certificates','Strong; needs a certificate authority'],
['`gss` / `sspi`','Kerberos / Windows single sign-on','Enterprise environments'],
['`ldap`, `pam`, `radius`','Use an external directory or service','Password goes to that service; use TLS'],
['`oauth` (18)','OAuth 2.0 bearer tokens','New in 18; needs a validator library'],
['`md5`','Legacy password hashing','Deprecated in 18; migrate to SCRAM'],
['`password`','Clear-text password on the wire','Only inside TLS; prefer SCRAM'],
['`ident`','TCP ident lookup','Rarely used; relies on a remote service'],
['`reject`','Always refuse','Put before broader rules to block a user or network'],
['`trust`','Accept without a password','Never on a reachable network']]},
{h:'pg_hba.conf rules of thumb'},
{ul:['First match wins: put specific rules (and `reject`) above general ones.','Use `hostssl` for remote clients and a narrow CIDR, never `0.0.0.0/0` with `trust`.','Keep a separate `replication` line per standby or backup host.','Use roles in the user column (`+groupname`), not `all`, for sensitive databases.','Test with `SELECT * FROM pg_hba_file_rules;` before reloading.']},
{h:'Clean up the PUBLIC role'},
{code:`-- stop everyone connecting to every database
REVOKE ALL ON DATABASE appdb FROM PUBLIC;
GRANT CONNECT ON DATABASE appdb TO app_rw, app_ro;

-- stop everyone creating objects in public (already the default from 15, but check upgraded clusters)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- stop new functions being executable by everyone
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC;

-- see what PUBLIC holds today
SELECT datname, datacl FROM pg_database;
SELECT nspname, nspacl FROM pg_namespace WHERE nspname !~ '^pg_';`},
{h:'Migrate from MD5 to SCRAM'},
{flow:['Update clients and drivers to support SCRAM','Set `password_encryption = scram-sha-256`','Find roles still on md5','Reset each password','Change `pg_hba.conf` from md5 to scram-sha-256 and reload','Verify no md5 hashes remain']},
{code:`SHOW password_encryption;
SELECT rolname FROM pg_authid WHERE rolpassword LIKE 'md5%';

ALTER SYSTEM SET password_encryption = 'scram-sha-256';
SELECT pg_reload_conf();

ALTER ROLE app_user PASSWORD 'new-strong-password';   -- stored as SCRAM now
-- then edit pg_hba.conf: md5 -> scram-sha-256, and reload`},
{note:'A stored hash cannot be converted. Every user must set the password again, so plan the change with the application owners. A `md5` rule in `pg_hba.conf` also accepts SCRAM-stored passwords, so you can switch the rule last.'},
{h:'Hardening checklist'},
{t:[['Area','Check','Why'],
['Accounts','No application uses a superuser; one named break-glass superuser','Limits damage from injection'],
['Ownership','Objects owned by a `NOLOGIN` role; apps hold only DML grants','A compromised app cannot drop or grant'],
['Network','`listen_addresses` limited; firewall allows only needed hosts','Reduces exposure'],
['Encryption','`ssl = on`, `hostssl` rules, `sslmode=verify-full` on clients','Protects data and passwords on the wire'],
['Passwords','SCRAM, expiry (`VALID UNTIL`) for people, secrets in a vault','Weak hashes are replayable'],
['Privileges','PUBLIC cleaned; `REVOKE` first, then grant; default privileges set','Least privilege'],
['Row security','RLS on shared tables; `FORCE ROW LEVEL SECURITY`; no `BYPASSRLS` for apps','Tenant isolation'],
['Functions','`SECURITY DEFINER` with a fixed `search_path`; `EXECUTE` revoked from PUBLIC','Prevents privilege escalation'],
['Auditing','`log_connections`, `log_disconnections`, `log_statement = ddl`, pgAudit','Evidence after an incident'],
['Files','`PGDATA` mode `0700`, backups encrypted and off-site, WAL archive protected','Backups hold everything'],
['Timeouts','`statement_timeout`, `idle_in_transaction_session_timeout` per role','Limit runaway sessions'],
['Patching','Latest minor release; supported major version','Security fixes only land in supported branches'],
['Extensions','Install only what you need; review `trusted` extensions','Extensions run inside the server']]}
]},

/* 14 ---------------------------------------------------------------- OS settings */
{t:'OS settings',d:'Kernel parameters, limits, file system, SELinux, firewall and systemd settings that matter on a Linux database server.',see:[[1,7,'Pre-installation planning'],[1,11,'Managing PostgreSQL with systemd']],b:[
{p:'Values are starting points for a dedicated server. Make kernel settings permanent in `/etc/sysctl.d/99-postgresql.conf` and apply with `sysctl --system`.'},
{h:'Kernel parameters'},
{t:[['Parameter','Suggested','Why'],
['`vm.swappiness`','`1` to `10`','Avoid swapping database memory'],
['`vm.overcommit_memory`','`2` with `vm.overcommit_ratio` about `80`','Allocation fails cleanly instead of the OOM killer picking the postmaster'],
['`vm.nr_hugepages`','Enough for `shared_buffers` plus slack','Fewer page-table entries; used when `huge_pages = on` or `try`'],
['`/sys/kernel/mm/transparent_hugepage/enabled`','`never`','Transparent huge pages cause stalls'],
['`vm.dirty_background_ratio` / `vm.dirty_ratio`','`5` / `10` (or use `_bytes` on large RAM)','Smooths writeback and avoids long fsync stalls'],
['`vm.zone_reclaim_mode`','`0`','NUMA hosts: do not reclaim local cache first'],
['`net.ipv4.tcp_keepalive_time`','`300` or lower','Detect dead clients behind firewalls'],
['`net.core.somaxconn`','`1024` or higher','Larger listen backlog for connection bursts'],
['`fs.file-max`','High (for example `1000000`)','System-wide open files']]},
{h:'Limits and systemd'},
{t:[['Setting','Where','Value','Note'],
['Open files','`LimitNOFILE` in the unit','`65536` or more','Each connection and file needs a descriptor'],
['Processes','`LimitNPROC`','High enough for `max_connections`','Backends are processes'],
['Locked memory','`LimitMEMLOCK`','`infinity` if huge pages are locked','Needed in some container setups'],
['OOM protection','`OOMScoreAdjust=-900` plus `PG_OOM_ADJUST_FILE=/proc/self/oom_score_adj` and `PG_OOM_ADJUST_VALUE=0`','Postmaster protected, backends killable','Keep `vm.overcommit_memory = 2` as the main control'],
['Environment','`Environment=PGDATA=/data/pg18`','Data directory','Use `systemctl edit postgresql-18`'],
['Start timeout','`TimeoutSec=`','`0` or long for big recovery','Prevents systemd killing slow start-up']]},
{code:`# see the effective unit and drop-in
systemctl cat postgresql-18
sudo systemctl edit postgresql-18        # creates /etc/systemd/system/postgresql-18.service.d/override.conf

# example override
[Service]
LimitNOFILE=65536
OOMScoreAdjust=-900
Environment=PG_OOM_ADJUST_FILE=/proc/self/oom_score_adj
Environment=PG_OOM_ADJUST_VALUE=0
Environment=PGDATA=/data/pg18/data`},
{h:'File system and storage'},
{t:[['Topic','Recommendation'],
['File system','XFS or ext4; mount data with `noatime`'],
['Layout','Separate volumes for data, `pg_wal`, backups and logs where possible'],
['I/O scheduler','`none` for NVMe, `mq-deadline` for SSD or HDD'],
['Write cache','Battery-backed or disabled; never trust volatile write caches without flushes'],
['Free space','Keep more than 20 percent free on each volume'],
['Network storage','Use only if it honours `fsync`; test with `pg_test_fsync`']]},
{h:'SELinux'},
{t:[['Item','Value or command'],
['Data directory context','`postgresql_db_t`'],
['Port types','`postgresql_port_t` (5432 and others)'],
['Label a custom data path','`semanage fcontext -a -t postgresql_db_t "/data/pg18(/.*)?"` then `restorecon -Rv /data/pg18`'],
['Allow another port','`semanage port -a -t postgresql_port_t -p tcp 5433`'],
['Find denials','`ausearch -m avc -ts recent`, `sealert -a /var/log/audit/audit.log`'],
['Check mode','`getenforce`; do not disable it, fix the labels']]},
{h:'Firewall'},
{t:[['Tool','Command'],
['firewalld, service','`firewall-cmd --permanent --add-service=postgresql && firewall-cmd --reload`'],
['firewalld, custom port or source','`firewall-cmd --permanent --add-rich-rule=\'rule family="ipv4" source address="10.0.0.0/24" port port="5432" protocol="tcp" accept\'`'],
['ufw','`ufw allow from 10.0.0.0/24 to any port 5432 proto tcp`'],
['iptables or nftables','Allow TCP 5432 only from application and admin subnets'],
['Test','`ss -ltnp | grep 5432`, `nc -vz host 5432`, `pg_isready -h host`']]},
{h:'Check what is in effect'},
{code:`sysctl vm.swappiness vm.overcommit_memory vm.nr_hugepages
cat /sys/kernel/mm/transparent_hugepage/enabled
grep -i huge /proc/meminfo
ulimit -n
cat /proc/$(head -1 $PGDATA/postmaster.pid)/limits | grep -i "open files"
mount | grep -E "pgdata|pgsql"`}
]},

/* 15 ---------------------------------------------------------------- version table */
{t:'Versions: 15 to 18 and support dates',d:'What each recent major release brought and when each version stops receiving fixes.',see:[[0,3,'Versions and release cycle'],[0,13,'Release calendar and support lifecycle']],b:[
{h:'Support dates'},
{t:[['Version','Released','Final minor release (end of community support)','Status in October 2026'],
['13','Sep 2020','13 Nov 2025','Unsupported'],
['14','Sep 2021','12 Nov 2026','Supported, ends next month'],
['15','Oct 2022','11 Nov 2027','Supported'],
['16','Sep 2023','9 Nov 2028','Supported'],
['17','Sep 2024','8 Nov 2029','Supported'],
['18','Sep 2025','14 Nov 2030','Current in this course']]},
{note:'Each major version is supported for five years. These dates follow the project policy page (postgresql.org/support/versioning), which is the authority. Check it for versions newer than 18 and for exact release numbers.'},
{h:'What arrived in each version'},
{t:[['Area','15','16','17','18'],
['SQL and queries','`MERGE`; `UNIQUE NULLS NOT DISTINCT`','SQL/JSON constructors and `IS JSON`; parallel `FULL` and `RIGHT` joins','`JSON_TABLE`; `MERGE ... RETURNING`','Virtual generated columns; `OLD` and `NEW` in `RETURNING`; `uuidv7()`; temporal constraints'],
['Performance','Sort improvements; `recovery_prefetch`','Faster bulk load and vacuum options (`vacuum_buffer_usage_limit`)','New vacuum memory structure; faster `IN` and B-tree scans','Asynchronous I/O (`io_method`); B-tree skip scan'],
['Replication','Row filters and column lists; 2PC in logical replication','Logical decoding on standbys; parallel apply','Failover slots; `pg_createsubscriber`','`idle_replication_slot_timeout`; more logical replication conflict detail'],
['Backup and recovery','Server-side compression in `pg_basebackup`; `archive_library`','`pg_dump` lz4 and zstd','Incremental backups, `pg_combinebackup`, `summarize_wal`','`pg_upgrade` keeps planner statistics and has `--swap`'],
['Security','Public schema no longer creatable by everyone; `GRANT` on parameters','Role membership rework (`INHERIT`, `SET` options); `scram_iterations`; regex in `pg_hba.conf`','`MAINTAIN` privilege and `pg_maintain` role','OAuth authentication; `md5` deprecated; data checksums on by default'],
['Monitoring and ops','Statistics in shared memory (no collector); `jsonlog`; `log_checkpoints` on by default','`pg_stat_io`; `last_seq_scan` columns','`pg_stat_checkpointer`; `transaction_timeout`; `EXPLAIN` memory and serialize','`autovacuum_worker_slots`; richer `pg_stat_io`; `log_connections` takes a list']]},
{note:'The table lists headlines taken from the release notes. Read the notes of every version you skip before a major upgrade: they also list incompatibilities and removed features.'},
{h:'Changes that can break an upgrade'},
{t:[['Version','Watch for'],
['15','Public schema privileges changed; exclusive backup mode removed (`pg_start_backup` became `pg_backup_start`); `pg_upgrade` output directory'],
['16','Role membership behaviour changed (`INHERIT` and `SET` per grant); `CREATEROLE` is much weaker'],
['17','Checkpoint columns moved from `pg_stat_bgwriter` to `pg_stat_checkpointer`; check monitoring queries and dashboards'],
['18','`md5` deprecation warnings; data checksums are on by default only for new clusters (old clusters are unchanged); rebuild or reinstall extension libraries for 18']]}
]}

]};
