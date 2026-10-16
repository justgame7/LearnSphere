/* LearnSphere - MySQL, Section 12: Server Configuration, Performance & Monitoring.
   Lectures 0-8 are core. Needs mysql-common.js. Defaults are for MySQL 8.4 unless stated. */
(function(){
const K=window.MY,L=window.LESSONS;

const scope=K.dg(700,190,[
[10,10,680,170,'Variable scope',1],
[25,55,200,60,'GLOBAL|server wide default|SET GLOBAL',0],[250,55,200,60,'SESSION|this connection only|copied from global at connect',2],[475,55,200,60,'Option file|my.cnf, mysqld-auto.cnf|read at startup',0],
[25,130,650,30,'A new connection copies GLOBAL values. Later changes to GLOBAL do not affect open sessions.',0]],
[[225,85,250,85],[450,85,475,85]]);

const mem=K.dg(700,210,[
[10,10,680,190,'Where server memory goes',1],
[25,50,300,70,'Global: buffer pool, log buffer,|table caches, Performance Schema|allocated once',2],[350,50,325,70,'Per connection: thread stack, network buffers|allocated on demand',0],
[350,130,325,50,'Per operation: sort, join, tmp tables|only when a query needs them',0],
[25,130,300,50,'Peak = global + connections x per-thread',0]],[]);

const ps=K.dg(700,170,[
[10,10,680,150,'Performance Schema data flow',1],
[25,60,150,50,'Instruments|measure events',2],[215,60,150,50,'Consumers|decide what is kept',0],[405,60,130,50,'Event tables|in memory',0],[575,60,100,50,'sys views|readable',0]],
[[175,85,215,85],[365,85,405,85],[535,85,575,85]]);

/* ---------- 0 ---------- */
L['mysql:11:0']={blocks:[
{p:'A MySQL server is controlled by **system variables** (settings) and reports its activity through **status variables** (counters). Understanding scope and how to read counters is the base of all tuning and monitoring.'},
{svg:scope},
{h:'System variables'},
{code:`SHOW GLOBAL VARIABLES LIKE 'max_connections';
SHOW SESSION VARIABLES LIKE 'sort_buffer_size';
SELECT @@global.innodb_buffer_pool_size, @@session.sql_mode;
SET GLOBAL max_connections = 400;            -- running server, new connections
SET SESSION sort_buffer_size = 1048576;      -- this connection only
SET PERSIST max_connections = 400;           -- now and after restart`},
{t:[['Type','Changeable while running','How to apply'],
['Dynamic','Yes','`SET GLOBAL` or `SET SESSION`. Use `SET PERSIST` to keep it'],
['Static (read only)','No','Option file or `SET PERSIST_ONLY`, then restart'],
['Session only','Per connection','`SET SESSION`']]},
{p:'Some variables have only a global scope (such as `innodb_buffer_pool_size`), some only a session scope, and some both. The manual lists scope and dynamic status for each. Changes to GLOBAL do not affect **existing** sessions.'},
{h:'Status variables'},
{p:'Status variables are **counters since startup** (or since the last `FLUSH STATUS`). A single value says little. The interesting number is the **change over time**: sample twice and compute a rate.'},
{code:`SHOW GLOBAL STATUS LIKE 'Questions';
SHOW GLOBAL STATUS LIKE 'Threads%';
SHOW GLOBAL STATUS LIKE 'Created_tmp%';
SHOW GLOBAL STATUS LIKE 'Innodb_row_lock%';
SELECT * FROM performance_schema.global_status WHERE variable_name IN ('Uptime','Threads_running');`},
{h:'Useful counters'},
{t:[['Counter','Meaning'],
['`Uptime`','Seconds since start'],
['`Questions`, `Com_select`, `Com_insert`...','Statements executed, by type'],
['`Threads_connected`, `Threads_running`','Open connections and those executing right now'],
['`Aborted_connects`, `Aborted_clients`','Failed logins, dropped connections'],
['`Created_tmp_disk_tables`','Temporary tables that spilled to disk'],
['`Select_full_join`, `Handler_read_rnd_next`','Signs of scans and missing indexes'],
['`Innodb_buffer_pool_reads`','Page reads from disk'],
['`Innodb_row_lock_waits`, `Innodb_row_lock_time_avg`','Row lock waiting'],
['`Slow_queries`','Statements over long_query_time']]},
{note:'Do not tune from a generic checklist. Find the bottleneck first (CPU, disk, memory, locks or one bad query), then change the setting that addresses it, one change at a time.'}],
src:[['Server system variables',K.D+'server-system-variables.html'],['Server status variables',K.D+'server-status-variables.html']]};

/* ---------- 1 ---------- */
L['mysql:11:1']={blocks:[
{p:'Hundreds of settings exist, but a small group decides most of the memory use and I/O behaviour. Know these first.'},
{h:'The core InnoDB settings'},
{t:[['Variable','Purpose','Guidance'],
['`innodb_buffer_pool_size`','Cache for data and index pages','The most important. 50 to 75 percent of RAM on a dedicated server'],
['`innodb_redo_log_capacity`','Total size of redo logs','Large enough for 30 to 60 minutes of write load. Dynamic (8.0.30 and later)'],
['`innodb_log_buffer_size`','Memory for redo before flushing','A few tens of MB. Larger if transactions are big'],
['`innodb_flush_log_at_trx_commit`','Durability at commit','1 for safety (default)'],
['`innodb_flush_method`','How data files are written','`O_DIRECT` on Linux avoids double caching in the OS cache'],
['`innodb_io_capacity` and `innodb_io_capacity_max`','I/O budget for background flushing','Set to match the storage. SSD and NVMe can use thousands'],
['`innodb_file_per_table`','One tablespace file per table','ON (default)'],
['`innodb_dedicated_server`','Auto-sizes buffer pool and redo log from RAM','Convenient for a dedicated host. Check the values it picks']]},
{h:'Other important server settings'},
{t:[['Variable','Default','Notes'],
['`max_connections`','151','Each connection uses memory. Raise with care, prefer pooling'],
['`table_open_cache`','4000','Open table handles. Watch `Table_open_cache_misses`'],
['`max_allowed_packet`','64 MB','Largest packet or row. Must be big enough for BLOB inserts'],
['`tmp_table_size`, `max_heap_table_size`','16 MB','Limit for in-memory internal temp tables'],
['`sync_binlog`','1','Flush the binary log at each commit'],
['`binlog_expire_logs_seconds`','2592000 (30 days)','How long binary logs are kept'],
['`wait_timeout`','28800 (8 hours)','Idle connection timeout. Lower for pooled apps with leaks'],
['`open_files_limit`','Auto','The operating system limit must allow it']]},
{h:'Per-session buffers: handle with care'},
{p:'`sort_buffer_size`, `join_buffer_size`, `read_buffer_size` and `read_rnd_buffer_size` are allocated **per operation that needs them**. Raising them globally to large values multiplies by the number of concurrent queries and can exhaust memory. Leave them at their defaults and raise them for one session or one query when needed (`SET_VAR` hint).'},
{svg:mem},
{h:'A conservative starting point for a 16 GB dedicated server'},
{code:`[mysqld]
innodb_buffer_pool_size = 10G
innodb_redo_log_capacity = 4G
innodb_flush_method = O_DIRECT
innodb_io_capacity = 2000
max_connections = 300
slow_query_log = ON
long_query_time = 1
skip_name_resolve = ON      # authenticate by IP, avoids DNS delays`},
{note:'This is a starting point, not a recipe. Measure with your own workload and change one variable at a time. Managed services set many of these through parameter groups.'}],
src:[['InnoDB startup options',K.D+'innodb-parameters.html'],['How MySQL uses memory',K.D+'memory-use.html']]};

/* ---------- 2 ---------- */
L['mysql:11:2']={blocks:[
{p:'Every client connection is served by a **thread** inside the server. Connections consume memory and scheduler time, so how you manage them matters for stability.'},
{h:'Connection lifecycle'},
{flow:['The client opens a TCP connection to port 3306','The server accepts it and assigns a thread (a cached one if available)','Authentication and TLS negotiation','The session runs statements until the client closes or a timeout expires','The thread returns to the thread cache for reuse']},
{h:'Limits and settings'},
{t:[['Setting','Role'],
['`max_connections` (151)','Maximum simultaneous connections. One extra is reserved for admin users with `CONNECTION_ADMIN`'],
['`admin_address`, `admin_port`','A separate admin interface for emergencies when the limit is reached'],
['`thread_cache_size`','How many idle threads to keep. Avoids the cost of creating threads'],
['`wait_timeout`, `interactive_timeout`','Idle time before the server closes a connection'],
['`connect_timeout`','Time allowed for the handshake'],
['`max_connect_errors`','Blocks a host after repeated failed handshakes'],
['`back_log`','Queue of pending TCP connections'],
['`skip_name_resolve`','Do not use DNS for client hosts. Recommended']]},
{code:`SHOW GLOBAL STATUS LIKE 'Threads_%';           -- connected, running, cached, created
SHOW GLOBAL STATUS LIKE 'Max_used_connections';
SHOW GLOBAL STATUS LIKE 'Connection_errors%';
SHOW FULL PROCESSLIST;
SELECT * FROM performance_schema.threads WHERE type = 'FOREGROUND';`},
{h:'Connected versus running'},
{p:'`Threads_connected` is how many sessions are open. `Threads_running` is how many are executing a statement at this moment. A server can have 2,000 connections with only 8 running. A **high `Threads_running`** (many more than the CPU cores) means queries are queuing for CPU, locks or I/O, and is a stronger signal of trouble than the connection count.'},
{h:'Too many connections'},
{ul:['Error 1040 `Too many connections` means `max_connections` is reached.','Causes: connection leaks, no pooling, a traffic spike or a stalled database making requests pile up.','Raising the limit is a **temporary relief**. If the database is slow, more connections make it slower.','Fix the cause: use a **connection pool** in each application with a sensible maximum, set timeouts and add a proxy such as ProxySQL for many application instances.']},
{code:`-- during an incident, as an admin with a spare connection
SHOW FULL PROCESSLIST;
SELECT * FROM sys.session ORDER BY time DESC LIMIT 20;
KILL QUERY 1234;        -- stop the statement, keep the connection
KILL 1234;              -- close the connection`},
{note:'The thread pool (MySQL Enterprise and Percona Server) groups connections onto a limited number of worker threads, which protects servers with thousands of connections. Community Server uses one thread per connection.'}],
src:[['Connection management',K.D+'connection-management.html'],['Too many connections',K.D+'too-many-connections.html']]};

/* ---------- 3 ---------- */
L['mysql:11:3']={blocks:[
{h:'Internal temporary tables'},
{p:'MySQL sometimes builds a **temporary table** inside a query to hold intermediate results: for `GROUP BY` or `DISTINCT` that cannot use an index, `UNION`, derived tables, some sorts, and window functions. EXPLAIN shows `Using temporary`.'},
{t:[['Aspect','Detail'],
['Engine','The **TempTable** engine (default `internal_tmp_mem_storage_engine`) for in-memory tables'],
['Memory limit','`temptable_max_ram` (default 1 GB) for the whole server, plus mapped files up to `temptable_max_mmap`'],
['Overflow','Beyond the limit, tables are written to disk as InnoDB on-disk temporary tables'],
['Per table cap','`tmp_table_size` limits an in-memory table before it converts'],
['Disk location','`tmpdir` and the session temporary tablespaces']]},
{code:`SHOW GLOBAL STATUS LIKE 'Created_tmp%';
-- Created_tmp_tables, Created_tmp_disk_tables, Created_tmp_files
SELECT @@tmp_table_size, @@temptable_max_ram, @@tmpdir;`},
{p:'A rising count of **disk** temporary tables means queries create big intermediate sets. The fix is usually in the query (add an index, reduce rows early, avoid wide select lists, avoid TEXT and BLOB in grouped queries) rather than raising memory.'},
{h:'Sorting (filesort)'},
{p:'When no index provides the ordering, MySQL sorts rows with **filesort**, despite the name not always on disk. It uses the `sort_buffer_size` per sort. If the data does not fit, it sorts chunks and merges them from temporary files.'},
{code:`SHOW GLOBAL STATUS LIKE 'Sort%';
-- Sort_merge_passes: high values mean sorts spilled to disk
-- Sort_rows, Sort_range, Sort_scan`},
{ul:['Provide an index in the `ORDER BY` order to avoid sorting.','With `LIMIT`, MySQL uses a priority queue, keeping only the top rows, which is cheap.','Selecting fewer and narrower columns makes sorts cheaper. Wide TEXT columns are sorted by a pointer and fetched afterwards.','Increase `sort_buffer_size` only for sessions that need it.']},
{h:'Where memory goes per query'},
{ul:['Sort buffer, join buffer (for hash joins without an index), read buffers and temporary tables are **per query**. Several of them can be active for one statement.','A few heavy reporting queries can use gigabytes. Limit them with `MAX_EXECUTION_TIME` hints, a separate reporting replica and resource groups.']},
{code:`SELECT event_name, current_alloc FROM sys.memory_global_by_current_bytes LIMIT 10;
SELECT * FROM sys.memory_by_thread_by_current_bytes LIMIT 10;`},
{note:'Out-of-memory kills of mysqld by the operating system are usually caused by a total memory plan that ignored per-connection allocations. Calculate a worst case, not an average.'}],
src:[['Internal temporary table use',K.D+'internal-temporary-tables.html'],['ORDER BY optimization',K.D+'order-by-optimization.html']]};

/* ---------- 4 ---------- */
L['mysql:11:4']={blocks:[
{p:'The **Performance Schema** is MySQL built-in instrumentation. It records where time is spent (statements, waits, locks, I/O, memory) with low overhead and exposes the data as tables in the `performance_schema` database. It is enabled by default.'},
{svg:ps},
{h:'Concepts'},
{t:[['Concept','Meaning'],
['Instrument','A named measuring point in the server code, such as `statement/sql/select` or `wait/io/file/innodb/innodb_data_file`'],
['Consumer','A table or destination that stores the collected events. Instruments run only if a consumer needs them'],
['Event','One timed occurrence, recorded with start, end and context'],
['Summary table','Aggregated counters by object, user, host or statement digest'],
['Actor and object filters','Limit what is monitored by user, host or table']]},
{h:'The tables you will use most'},
{t:[['Question','Table'],
['Which statement shapes cost the most?','`events_statements_summary_by_digest`'],
['What is each session doing right now?','`threads`, `events_statements_current`'],
['What are the latest statements?','`events_statements_history`, `events_statements_history_long`'],
['Where do waits occur (I/O, locks, mutexes)?','`events_waits_summary_global_by_event_name`'],
['Which tables have the most I/O?','`table_io_waits_summary_by_table`'],
['Which rows are locked or waiting?','`data_locks`, `data_lock_waits`, `metadata_locks`'],
['Where is the memory?','`memory_summary_global_by_event_name`'],
['Replication state','`replication_connection_status`, `replication_applier_status_by_worker`']]},
{code:`SELECT thread_id, processlist_user, processlist_command, processlist_time, processlist_info
FROM performance_schema.threads WHERE type = 'FOREGROUND' AND processlist_command <> 'Sleep';

SELECT object_schema, object_name, count_read, count_write, sum_timer_wait/1e12 AS total_s
FROM performance_schema.table_io_waits_summary_by_table
ORDER BY sum_timer_wait DESC LIMIT 5;

SELECT event_name, count_star, sum_timer_wait/1e12 AS total_s
FROM performance_schema.events_waits_summary_global_by_event_name
WHERE count_star > 0 ORDER BY sum_timer_wait DESC LIMIT 5;`},
{p:'Timers are in **picoseconds**. Divide by `1e12` for seconds or `1e9` for milliseconds.'},
{h:'Configuration'},
{code:`SELECT * FROM performance_schema.setup_instruments WHERE name LIKE 'memory/%' LIMIT 3;
UPDATE performance_schema.setup_instruments SET enabled = 'YES', timed = 'YES' WHERE name LIKE 'wait/lock/%';
UPDATE performance_schema.setup_consumers SET enabled = 'YES' WHERE name = 'events_waits_current';`},
{ul:['`performance_schema` itself can be switched on or off only at startup. Individual instruments and consumers can be changed at runtime.','Memory and some wait instruments are off by default. Turn on extras briefly while investigating, then switch them off again.','The overhead of the default configuration is small. Enabling everything is not free.','The tables live in memory and are emptied on restart.']}],
src:[['MySQL Performance Schema',K.D+'performance-schema.html'],['Performance Schema quick start',K.D+'performance-schema-quick-start.html']]};

/* ---------- 5 ---------- */
L['mysql:11:5']={blocks:[
{p:'The **sys schema** is a set of views, functions and procedures on top of the Performance Schema and Information Schema. It answers common questions without having to remember the underlying tables. It is installed by default.'},
{t:[['Question','sys view'],
['Which statements are slowest or most costly?','`statement_analysis`, `statements_with_runtimes_in_95th_percentile`'],
['Which statements scan whole tables?','`statements_with_full_table_scans`'],
['Which statements create temp tables or sort a lot?','`statements_with_temp_tables`, `statements_with_sorting`'],
['Who is blocking whom (rows)?','`innodb_lock_waits`'],
['Who is blocking DDL (metadata)?','`schema_table_lock_waits`'],
['Which indexes are never used?','`schema_unused_indexes`'],
['Which indexes are redundant?','`schema_redundant_indexes`'],
['Which tables are scanned most?','`schema_tables_with_full_table_scans`'],
['Which files and tables generate I/O?','`io_global_by_file_by_bytes`, `io_global_by_file_by_latency`'],
['What are the top waits?','`waits_global_by_latency`'],
['Where is memory used?','`memory_global_by_current_bytes`'],
['What is each user or host doing?','`user_summary`, `host_summary`'],
['Current sessions with details','`session`, `processlist`']]},
{code:`SELECT * FROM sys.statement_analysis ORDER BY total_latency DESC LIMIT 5\\G
SELECT * FROM sys.schema_unused_indexes WHERE object_schema = 'shop';
SELECT * FROM sys.innodb_lock_waits\\G
SELECT sys.format_bytes(@@innodb_buffer_pool_size), sys.format_time(5000000000);`},
{h:'x$ views'},
{p:'Each view has an `x$` twin that returns **raw numbers** (picoseconds, bytes) instead of formatted text, which is better for scripts and graphs: `sys.x$statement_analysis`.'},
{h:'Diagnostics report'},
{code:`CALL sys.diagnostics(60, 10, 'current');     -- 60 s run, snapshot every 10 s, writes a large report
CALL sys.ps_setup_enable_instrument('wait/lock');
SELECT sys.ps_thread_id(CONNECTION_ID());`},
{p:'`sys.diagnostics` collects many views over a period and is handy to attach to a support case.'},
{note:'Unused-index results depend on how long the server has been running and whether the workload includes month-end or yearly jobs. Wait a full business cycle before dropping an index.'}],
src:[['MySQL sys schema',K.D+'sys-schema.html'],['sys schema views',K.D+'sys-schema-views.html']]};

/* ---------- 6 ---------- */
L['mysql:11:6']={blocks:[
{p:'Logs are your first source of truth when something goes wrong. MySQL has several, each with a different purpose.'},
{t:[['Log','Contains','Enable in production?','Control'],
['Error log','Startup, shutdown, crashes, warnings, replication errors, InnoDB messages','Always','`log_error`, `log_error_verbosity` (1 errors, 2 plus warnings, 3 plus notes)'],
['Slow query log','Statements slower than a threshold','Yes, with `long_query_time` 0.5 to 2 s','`slow_query_log`, `long_query_time`'],
['Binary log','Every data change, for replication and recovery','Yes (on by default in 8.x)','`log_bin`, `binlog_format`, `binlog_expire_logs_seconds`'],
['General query log','Every statement received','No, only briefly for debugging. Heavy and logs passwords in plain text for some statements','`general_log`'],
['Relay log','Binary log events received by a replica','Automatic on replicas','`relay_log`'],
['Audit log','Connections and statements for compliance','Enterprise or plugin','Plugin-specific'],
['DDL log, redo and undo logs','Internal crash safety','Internal','Not read directly']]},
{h:'Error log'},
{code:`SELECT @@log_error, @@log_error_verbosity;
SET PERSIST log_error_verbosity = 3;
SELECT logged, prio, error_code, subsystem, LEFT(data, 100) FROM performance_schema.error_log ORDER BY logged DESC LIMIT 10;`},
{p:'The error log is also readable as a table, `performance_schema.error_log`. Read it first for crashes (look for the last lines before restart), `[Warning]` messages about aborted connections, and InnoDB recovery messages. Logging to JSON is available through the log components.'},
{h:'Binary log'},
{ul:['Written by default in MySQL 8. Needed for replication and point-in-time recovery.','Rotated when `max_binlog_size` (1 GB) is reached or on `FLUSH BINARY LOGS`.','Removed after `binlog_expire_logs_seconds` (default 30 days). Keep at least as long as your oldest backup plus the recovery window.','Do **not** delete binary log files by hand: use `PURGE BINARY LOGS` so the index stays consistent and replicas are not broken.']},
{code:`SHOW BINARY LOGS;
SHOW BINARY LOG STATUS;                      -- current file and position (8.4 name, was SHOW MASTER STATUS)
PURGE BINARY LOGS BEFORE NOW() - INTERVAL 7 DAY;`},
{h:'Rotation'},
{p:'Use `FLUSH LOGS` (or `FLUSH ERROR LOGS`, `FLUSH SLOW LOGS`) after a log rotation tool moves a file, so the server reopens a fresh one. Make sure the disk holding the logs cannot fill up: alert on free space.'},
{note:'The general log can fill a disk in minutes on a busy server. If you enable it to debug, set a reminder to switch it off.'}],
src:[['MySQL server logs',K.D+'server-logs.html'],['The error log',K.D+'error-log.html'],['The binary log',K.D+'binary-log.html']]};

/* ---------- 7 ---------- */
L['mysql:11:7']={blocks:[
{p:'Monitoring means collecting metrics continuously, so you see trends, get alerted before users notice and have history when you investigate an incident. A few dozen well-chosen metrics are enough.'},
{h:'Metrics worth collecting'},
{t:[['Area','Metrics'],
['Availability','Is mysqld reachable, uptime, restarts, `Aborted_connects`'],
['Load','Queries per second, `Threads_running`, `Threads_connected` against `max_connections`'],
['Latency','Statement latency percentiles from digests, slow query count'],
['InnoDB','Buffer pool reads versus requests, dirty page percent, row lock waits, history list length, checkpoint age'],
['Locking','Deadlock count, lock waits, longest open transaction'],
['Replication','Lag in seconds, applier status, errors, GTID gaps'],
['Resources','CPU, memory and swap, disk space and I/O latency, network'],
['Backups','Last successful backup time, restore test result']]},
{h:'Tools'},
{t:[['Tool','Notes'],
['Percona Monitoring and Management (PMM)','Free, MySQL-focused. Includes Query Analytics, dashboards and alerting'],
['Prometheus with `mysqld_exporter` and Grafana','Popular open source stack. Alertmanager for alerts'],
['MySQL Enterprise Monitor','Oracle commercial product with advisors'],
['Cloud provider tools','CloudWatch, Azure Monitor, Cloud Monitoring and database-specific insights for managed MySQL'],
['Zabbix, Datadog, New Relic','General monitoring platforms with MySQL integrations']]},
{h:'Alert design'},
{ul:['Alert on **symptoms and risks**: replication lag over a threshold, disk above 80 percent, no successful backup in 24 hours, connections above 80 percent of max, deadlocks rising, a transaction open for more than a few minutes.','Alert on **rates and trends**, not single samples.','Every alert needs an owner and a runbook step. An alert nobody acts on trains people to ignore alerts.','Keep a few **dashboards** for health: load, latency, InnoDB, replication, resources.']},
{code:`-- rates must be computed from two samples
SELECT variable_value FROM performance_schema.global_status WHERE variable_name = 'Questions';

-- age of the oldest transaction
SELECT MAX(TIMESTAMPDIFF(SECOND, trx_started, NOW())) AS oldest_trx_s FROM information_schema.innodb_trx;`},
{note:'Monitor from outside the database, too. A synthetic check that logs in and runs a simple query from the application network catches problems that internal metrics miss.'}],
src:[['Monitoring (Performance Schema)',K.D+'performance-schema.html'],['Percona Monitoring and Management','https://docs.percona.com/percona-monitoring-and-management/']]};

/* ---------- 8 ---------- */
L['mysql:11:8']={blocks:[
{p:'**Benchmarking** measures how a server behaves under a defined load. Done carefully it answers questions like: how many transactions per second can this hardware handle, does a setting change help, and when will we run out of capacity. Done carelessly it gives confident wrong answers.'},
{h:'sysbench'},
{p:'**sysbench** is the standard tool. It creates tables and runs OLTP-style workloads with many threads.'},
{code:`sysbench oltp_read_write --mysql-host=127.0.0.1 --mysql-user=bench --mysql-password=... \\
  --mysql-db=sbtest --tables=16 --table-size=1000000 prepare

sysbench oltp_read_write --mysql-host=127.0.0.1 --mysql-user=bench --mysql-password=... \\
  --mysql-db=sbtest --tables=16 --table-size=1000000 \\
  --threads=32 --time=300 --report-interval=10 --percentile=95 run

sysbench oltp_read_write ... cleanup`},
{t:[['Output','Meaning'],
['`tps`, `qps`','Transactions and queries per second'],
['`lat (ms,95%)`','95th percentile latency. Watch it, not just the average'],
['`reconnects`, `errors`','Should be zero']]},
{h:'Rules for honest tests'},
{ul:['**Use realistic data size.** A dataset that fits entirely in memory measures the CPU, not the storage. Make the data larger than the buffer pool if production is.','**Warm up** before measuring, and run long enough (minutes) to include flushing and checkpoint effects.','**Change one thing at a time**, and repeat each test to see run-to-run variation.','**Match the workload** to yours: read/write mix, transaction size, concurrency. The generic OLTP test is only a proxy.','Test on hardware like production. Cloud instances have burst credits that distort short tests.','Record versions, configuration and results so tests can be compared.']},
{h:'Other approaches'},
{ul:['`mysqlslap` (bundled) runs generated or custom queries concurrently. Simple but limited.','**Replay** real traffic: capture queries from the slow log or binary log and replay them on a copy with tools such as Percona Playback or application-level replay.','**Load testing the application** end to end with a tool like k6 or JMeter finds problems benchmarks miss.']},
{h:'Interpreting results'},
{flow:['Throughput rises as threads increase, then flattens: the saturation point','Latency starts to climb sharply near saturation','Past that point more concurrency only adds queueing','Plan production load below the knee of the curve with headroom for spikes']},
{note:'A benchmark tells you what the system can do on the test data and workload. Treat the numbers as relative comparisons between configurations, not promises about production.'}],
src:[['mysqlslap',K.D+'mysqlslap.html'],['sysbench','https://github.com/akopytov/sysbench']]};
})();
