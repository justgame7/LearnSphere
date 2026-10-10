/* LearnSphere - PostgreSQL Quick Reference (cheat sheet).
   window.QREF['pg'] = {title, blurb, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Blocks are the same as lessons: {h}, {p}, {t:[header,...rows]}, {code}, {note}, {ul}.
   Values are for PostgreSQL 18 on Linux unless stated. Check a default against your own server with: SELECT name, setting, unit, context FROM pg_settings WHERE name = '...'; */
window.QREF=window.QREF||{};
window.QREF.pg={title:'PostgreSQL Quick Reference',blurb:'Processes, files, locations, logs, parameters, views, tools and fixes on one page each. Use the search box to filter any page.',pages:[

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
{t:'Troubleshooting lookup',d:'Symptom, what to check first, the likely cause and the fix.',see:[[1,14,'Installation troubleshooting']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['Server will not start','Foreground: `postgres -D $PGDATA`; last lines of the log','Stale `postmaster.pid`, wrong permissions (not `0700`), port in use, bad parameter','Fix the cause; remove the PID file only if no postgres runs'],
['`connection refused`','`ss -ltnp | grep 5432`, `SHOW listen_addresses;`','Not listening on that interface, firewall, server down','Set `listen_addresses`, restart, open the port'],
['`no pg_hba.conf entry`','Log line with host, user and database','No matching rule','Add a rule above any broader one, reload'],
['`password authentication failed`','`password_encryption`, role has a password','Wrong password or method mismatch','Reset the password; use SCRAM'],
['`remaining connection slots are reserved`','`SELECT count(*) FROM pg_stat_activity;`','`max_connections` reached','Close idle sessions, add a pooler'],
['Disk full on `pg_wal`','`pg_replication_slots`, `pg_stat_archiver`','Abandoned slot or failing `archive_command`','Drop the slot, fix archiving; never delete WAL by hand'],
['Query suddenly slow','`EXPLAIN (ANALYZE, BUFFERS)`, `last_autoanalyze`','Stale statistics, bad plan, missing index','`ANALYZE`, add an index, check parameters'],
['Table keeps growing','`n_dead_tup`, `last_autovacuum`, oldest transaction','Vacuum blocked or too slow','End the old transaction or slot; tune per table'],
['Sessions waiting','`pg_stat_activity.wait_event_type = \'Lock\'`','Long transaction holds a lock','`pg_blocking_pids()`, end the blocker, shorten transactions'],
['Deadlock detected','Log `DETAIL` lines','Transactions lock rows in different order','Same order everywhere; retry'],
['Standby lags','`pg_stat_replication` lag columns','Slow network, I/O, long queries, conflicts','Check network and disks; tune `max_standby_streaming_delay`'],
['"database is not accepting commands to avoid wraparound"','`age(datfrozenxid)`','Freezing fell behind','Stop writes, `VACUUM` the oldest tables'],
['Killed by OOM killer','`dmesg -T`','`work_mem` x connections too large, no overcommit control','Lower `work_mem`, use a pooler, `vm.overcommit_memory = 2`'],
['`could not resize shared memory segment`','Kernel and container limits','Huge pages or `/dev/shm` too small','Raise limits or lower `shared_buffers`'],
['Checkpoints too frequent (log)','`pg_stat_checkpointer.num_requested`','`max_wal_size` too small','Raise `max_wal_size`']]}
]},

/* 10 ---------------------------------------------------------------- health queries */
{t:'Health-check SQL pack',d:'Paste-ready queries for the daily and weekly checks.',see:[[4,10,'Statistics views'],[5,10,'Reading the log']],b:[
{h:'Connections and sessions'},
{code:`-- sessions by state against the limit
SELECT state, count(*) FROM pg_stat_activity GROUP BY 1;
SHOW max_connections;

-- longest running transactions
SELECT pid, usename, state, now() - xact_start AS xact_age, left(query, 60) AS query
FROM pg_stat_activity WHERE xact_start IS NOT NULL ORDER BY xact_start LIMIT 10;

-- blocked sessions and their blockers
SELECT pid, pg_blocking_pids(pid) AS blocked_by, wait_event_type, left(query, 60) AS query
FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;`},
{h:'Size and growth'},
{code:`SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database ORDER BY pg_database_size(datname) DESC;

SELECT relid::regclass AS table_name, pg_size_pretty(pg_total_relation_size(relid)) AS total
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;`},
{h:'Vacuum and wraparound'},
{code:`SELECT relname, n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;

SELECT datname, age(datfrozenxid) AS xid_age FROM pg_database ORDER BY 2 DESC;`},
{h:'Cache and I/O'},
{code:`SELECT datname, round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) AS hit_pct,
       temp_files, deadlocks
FROM pg_stat_database WHERE datname = current_database();

SELECT num_timed, num_requested, write_time, sync_time FROM pg_stat_checkpointer;`},
{h:'Statements and indexes'},
{code:`SELECT calls, round(total_exec_time::numeric) AS total_ms, round(mean_exec_time::numeric, 2) AS mean_ms,
       left(query, 70) AS query
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;

SELECT s.relname AS table_name, s.indexrelname AS index_name, s.idx_scan,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
FROM pg_stat_user_indexes s JOIN pg_index i USING (indexrelid)
WHERE s.idx_scan = 0 AND NOT i.indisunique ORDER BY pg_relation_size(s.indexrelid) DESC LIMIT 10;`},
{h:'Replication and WAL'},
{code:`-- on the primary
SELECT application_name, state, sync_state,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS replay_lag
FROM pg_stat_replication;

SELECT slot_name, active, wal_status, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained
FROM pg_replication_slots;

-- archiving
SELECT archived_count, failed_count, last_archived_time, last_failed_time FROM pg_stat_archiver;`}
]}

]};
