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
{t:'Big-picture maps',d:'Four small maps that show how the parts fit together. Tap any box, or use the trace button to follow one action step by step.',see:[],b:[
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
 {ids:['backend'],t:'1. A backend receives UPDATE ... and finds the row. It needs the table page.'},
 {ids:['backend','sbuf'],t:'2. The page is read through shared buffers (loaded from the data file on a miss). A new row version is written there, so the page is now dirty.'},
 {ids:['sbuf','wbuf'],t:'3. A WAL record that describes the change is placed in the WAL buffers.'},
 {ids:['wbuf','wal'],t:'4. At COMMIT the WAL is flushed to the WAL segments. Only now does the client get its COMMIT.'},
 {ids:['bg','sbuf','data'],t:'5. Later the checkpointer and background writer write the dirty page to the data file.'},
 {ids:['wal','archive','standby'],t:'6. The same WAL is archived and streamed to the standby, which replays it.'}]}},

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
 {ids:['p-back'],t:'1. A backend commits a transaction on the primary.'},
 {ids:['p-back','p-wal'],t:'2. The change is written to the WAL and flushed to disk.'},
 {ids:['p-wal','p-send','p-slot'],t:'3. The WAL sender streams the new WAL to the standby. The slot remembers how far the standby has read.'},
 {ids:['p-send','s-recv'],t:'4. The WAL receiver writes it to the standby WAL. With synchronous replication the primary waits for this confirmation before the commit returns.'},
 {ids:['s-recv','s-replay','s-data'],t:'5. The startup process replays the record into the standby data files.'},
 {ids:['s-data','s-read'],t:'6. A read-only query on the standby now sees the change. The gap between steps 2 and 5 is replication lag.'}]}},

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
 {ids:['cluster','basebackup','basecopy','archive'],t:'Before the mistake: a base backup was taken and every WAL segment since then has been archived.'},
 {ids:['basecopy','replay'],t:'1. A DELETE at 10:43 destroyed data. Copy the base backup back to a new data directory.'},
 {ids:['replay','archive'],t:'2. Create recovery.signal and set restore_command and recovery_target_time = 10:42.'},
 {ids:['replay','archive'],t:'3. Start the server. It replays archived WAL up to 10:42 and stops there.'},
 {ids:['replay','recovered'],t:'4. Check the data, then promote. A new timeline begins, so the old history cannot be mixed in.'}]}},

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
 {ids:['insert'],t:'1. INSERT writes row version v1.'},
 {ids:['insert','update'],t:'2. UPDATE writes v2 and leaves v1 in place for older snapshots.'},
 {ids:['update','dead'],t:'3. When no snapshot needs v1 any more it becomes a dead tuple.'},
 {ids:['dead','blocker'],t:'Warning: an old transaction or slot can keep v1 alive, and the table keeps growing.'},
 {ids:['dead','vacuum'],t:'4. VACUUM (usually autovacuum) removes v1 and its index entries.'},
 {ids:['vacuum','reuse'],t:'5. The space is reused by new row versions.'}]}}
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
