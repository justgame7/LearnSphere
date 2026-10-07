/* LearnSphere: Section 06 - Logging and Parameters (lectures 1-9 + bonus lectures 10-12)
   Load AFTER lessons4.js. Docs links target PostgreSQL 18. Also back-fills notes into earlier lessons. */
(function(){
const D='https://www.postgresql.org/docs/18/';
const dg=window.LS_DG;

/* ---------- diagrams ---------- */
const logSvg=dg(700,230,[
[10,15,130,50,'Backend processes|ereport() messages',0],[10,95,130,50,'Postmaster and|background processes',0],
[190,55,130,60,'stderr|(all messages)',0],[370,55,150,60,'Logging collector|logging_collector = on',2],
[570,10,120,45,'log/*.log|stderr text',0],[570,70,120,45,'*.csv / *.json|csvlog, jsonlog',0],[570,130,120,45,'syslog / journal|eventlog on Windows',0],
[190,160,330,50,'Rotation: log_rotation_age, log_rotation_size, log_filename',1]],
[[140,40,190,75],[140,120,190,95],[320,85,370,85],[520,75,570,32],[520,85,570,92],[520,95,570,152]]);
const ctxSvg=dg(700,200,[
[10,20,110,60,'internal|read-only',0],[135,20,125,60,'postmaster|restart required',2],[275,20,110,60,'sighup|reload is enough',2],[400,20,135,60,'backend /|superuser-backend|new sessions only',0],[550,20,140,60,'superuser / user|SET inside a session',0],
[135,120,125,50,'shared_buffers|max_connections',0],[275,120,110,50,'checkpoint_timeout|autovacuum',0],[400,120,135,50,'log_connections|log_disconnections',0],[550,120,140,50,'work_mem|log_statement',0]],
[[197,80,197,120],[330,80,330,120],[467,80,467,120],[620,80,620,120]]);
const precSvg=dg(700,230,[
[10,20,115,55,'1. Built-in|default (boot_val)',0],[140,20,115,55,'2. postgresql.conf|and include files',0],[270,20,125,55,'3. postgresql.auto.conf|ALTER SYSTEM',2],[410,20,125,55,'4. Command line|postgres -c, pg_ctl -o',0],[550,20,140,55,'5. ALTER DATABASE|SET',0],
[10,140,150,55,'6. ALTER ROLE|SET',0],[185,140,170,55,'7. ALTER ROLE IN|DATABASE SET',0],[380,140,150,55,'8. Connection options|PGOPTIONS',0],[555,140,135,55,'9. SET in session|SET LOCAL: txn',2],
[10,100,680,24,'Later steps override earlier ones. Reading left-to-right, top-to-bottom, the last value that applies wins.',1]],
[[125,47,140,47],[255,47,270,47],[395,47,410,47],[535,47,550,47],[620,75,620,100],[160,167,185,167],[355,167,380,167],[530,167,555,167]]);
const memSvg=dg(700,250,[
[10,15,330,215,'Shared memory (one copy, set at startup)',1],
[25,45,140,55,'shared_buffers|cached 8 KB pages',2],[185,45,140,55,'wal_buffers|WAL not yet flushed',0],[25,120,140,50,'Lock tables|max_connections',0],[185,120,140,50,'CLOG, SLRU|small caches',0],
[360,15,330,215,'Per backend / per operation',1],
[375,45,150,55,'work_mem|each sort or hash node',2],[545,45,135,55,'temp_buffers|temporary tables',0],[375,120,150,50,'maintenance_work_mem|VACUUM, CREATE INDEX',2],[545,120,135,50,'effective_cache_size|planner hint only',0],
[200,190,140,30,'Operating system page cache',0]],[]);
const ckSvg=dg(700,200,[
[10,70,110,55,'Checkpoint N|starts',2],[170,70,170,55,'Dirty buffers written|spread over 90 percent|checkpoint_completion_target',0],[390,70,110,55,'Checkpoint N|complete, WAL|recycled',2],[550,70,140,55,'Next checkpoint|timeout or max_wal_size',0],
[10,15,680,30,'Trigger: checkpoint_timeout elapsed, WAL near max_wal_size, CHECKPOINT command, shutdown, base backup',1]],
[[120,97,170,97],[340,97,390,97],[500,97,550,97]]);
const avSvg=dg(700,200,[
[10,70,120,55,'Autovacuum|launcher|every autovacuum_naptime',2],[180,70,120,55,'Pick a database|and start a worker',0],[350,70,140,55,'Worker checks each|table against|threshold + scale x rows',0],[540,20,150,50,'VACUUM|dead tuples above limit',2],[540,110,150,50,'ANALYZE|changes above limit',2]],
[[130,97,180,97],[300,97,350,97],[490,85,540,48],[490,110,540,135]]);

window.EXTRA_LECTURES=window.EXTRA_LECTURES||{};
window.EXTRA_LECTURES[5]=[
['Parameter Precedence, Scope and Per-Role Settings','0:00','The full order in which PostgreSQL resolves a parameter: files, ALTER SYSTEM, ALTER DATABASE/ROLE, session SET. Includes pg_file_settings and pg_db_role_setting.'],
['Reading and Analysing the Server Log','0:00','log_line_prefix, structured csvlog/jsonlog, finding slow queries, lock waits, deadlocks and temp files, and the tools used on logs.'],
['Connection, Timeout and Safety Parameters','0:00','max_connections, listen_addresses, idle and statement timeouts, lock_timeout and deadlock_timeout: parameters that protect a production server.']];

Object.assign(window.LESSONS,{

/* ---------------------------------------------------------------- 5:0 */
'pg:5:0':{blocks:[
{p:'The **server log** is the text record PostgreSQL keeps about its own life: startup and shutdown, errors, warnings, checkpoints, autovacuum activity, failed logins and (if you ask for them) slow or all SQL statements. The PostgreSQL documentation describes chapter "Error Reporting and Logging" as the place where the server sends messages and where you control **where** they go, **when** they are written and **what** they contain. For a DBA the log is the first thing to read when something breaks, the main source for performance troubleshooting, and the basis of an audit trail.'},
{h:'Why logging matters'},
{t:[['Purpose','What the log gives you','Example'],['Troubleshooting','The exact error, the statement and the time it happened','`ERROR: relation "orders" does not exist`'],['Performance analysis','Statements slower than a threshold, temp-file spills, lock waits','`duration: 2413.2 ms statement: SELECT ...`'],['Audit and security','Who connected, from where, which DDL ran, failed authentication','`FATAL: password authentication failed for user "app"`'],['Operations','Checkpoint behaviour, autovacuum runs, replication events','`checkpoint complete: wrote 1204 buffers`']]},
{h:'How a log message travels'},
{svg:logSvg},
{p:'Every server process reports through the same internal routine, so all messages first arrive on **stderr** of the postmaster. What happens next depends on `logging_collector`.'},
{t:[['Setting','Behaviour'],['`logging_collector = off` (upstream default)','Messages stay on the stderr of the postmaster. They go wherever the start command sent them: a file given to `pg_ctl -l`, the terminal, or the systemd journal.'],['`logging_collector = on`','A background **logger** process captures stderr and writes it into files under `log_directory`, handling naming and rotation itself.']]},
{p:'The documentation explains why the collector is preferred over plain syslog: it can capture every message, including those a library writes directly to stderr, and it is the only way to produce the structured `csvlog` and `jsonlog` formats. Many packaged installations (including the PGDG RPMs) ship a `postgresql.conf` that already enables it; a source build usually does not.'},
{h:'log_destination: where messages are sent'},
{t:[['Value','Meaning','Needs collector?'],['`stderr`','Plain text lines (default)','Only to land in files'],['`csvlog`','Comma-separated, one fixed set of columns per line, easy to load into a table','Yes'],['`jsonlog`','One JSON object per line, easy for log shippers (PostgreSQL 15+)','Yes'],['`syslog`','Sent to the OS syslog daemon; see `syslog_facility`, `syslog_ident`','No'],['`eventlog`','Windows Event Log; see `event_source`','No']]},
{p:'You may list several values, for example `log_destination = \'stderr,jsonlog\'`; the collector then writes both a text file and a JSON file side by side.'},
{h:'Procedure to enable and verify logging'},
{flow:['Pick a log directory with free space','Set collector, destination, filename, rotation','Restart (collector is a postmaster setting)','Generate a test message','Confirm the file and its contents']},
{code:`-- 1. choose settings (written to postgresql.auto.conf)
ALTER SYSTEM SET logging_collector = on;                 -- needs restart
ALTER SYSTEM SET log_destination   = 'stderr';
ALTER SYSTEM SET log_directory     = 'log';              -- relative to PGDATA, or an absolute path
ALTER SYSTEM SET log_filename      = 'postgresql-%a.log';
ALTER SYSTEM SET log_truncate_on_rotation = on;
ALTER SYSTEM SET log_rotation_age  = '1d';
ALTER SYSTEM SET log_rotation_size = '100MB';

-- 2. logging_collector only changes at server start
-- shell: sudo systemctl restart postgresql-18

-- 3. verify
SHOW logging_collector;
SELECT pg_current_logfile();            -- path of the file being written now
SELECT 1/0;                             -- raises an error that must appear in the log
-- shell: tail -n 5 $PGDATA/log/postgresql-Wed.log`},
{note:'`pg_current_logfile()` returns the file that the collector is writing right now, so scripts do not have to guess the name. `pg_rotate_logfile()` forces a switch to a new file.'},
{h:'File naming and rotation'},
{t:[['Parameter','Default','Purpose'],['`log_directory`','`log`','Folder for log files; relative paths are under `PGDATA`. Use an absolute path on a separate disk in production.'],['`log_filename`','`postgresql-%Y-%m-%d_%H%M%S.log`','File name pattern; accepts strftime escapes such as `%a` (weekday) or `%d` (day of month).'],['`log_file_mode`','`0600`','Permissions of new files. Logs can contain SQL text and user names, so keep them private.'],['`log_rotation_age`','`1d`','Start a new file after this much time. `0` disables time-based rotation.'],['`log_rotation_size`','`10MB`','Start a new file after this size. `0` disables size-based rotation.'],['`log_truncate_on_rotation`','`off`','When on, an existing file with the same name is overwritten instead of appended.']]},
{h:'Self-cleaning retention pattern'},
{p:'Logs grow without limit unless something removes them. A simple built-in pattern needs no cron job: name files by weekday and truncate on rotation, so each file is overwritten a week later.'},
{t:[['Goal','log_filename','log_rotation_age','log_truncate_on_rotation','Result'],['Keep 7 days','`postgresql-%a.log`','`1d`','`on`','Seven files, Mon to Sun, reused weekly'],['Keep 31 days','`postgresql-%d.log`','`1d`','`on`','One file per day of month'],['Keep everything','`postgresql-%Y-%m-%d.log`','`1d`','`off`','Unique files; archive and delete with your own job']]},
{h:'Severity levels'},
{t:[['Level','Used for','Sent to client?','Written to log?'],['`DEBUG1` to `DEBUG5`','Increasing developer detail','Per `client_min_messages`','Per `log_min_messages`'],['`INFO`','Implicitly requested output such as `VACUUM VERBOSE`','Always','Not by default'],['`NOTICE`','Helpful hints, e.g. identifier truncation','Yes','Not by default'],['`WARNING`','Likely problem, e.g. commit outside a transaction','Yes','Yes (default threshold)'],['`ERROR`','The current command was aborted','Yes','Yes'],['`LOG`','Server activity for administrators: checkpoints, slow statements','Not by default','Yes'],['`FATAL`','The session was terminated','Yes','Yes'],['`PANIC`','All sessions were aborted, server restarts','Yes','Yes']]},
{h:'If the log stays empty'},
{ul:['The collector is on but the server was only reloaded, not restarted. Check `SHOW logging_collector;`.','The OS user `postgres` cannot write to `log_directory`. The server then reports the problem on the original stderr or in the journal.','The disk is full. Logging failures can stall the server, so monitor free space on the log volume.','On systemd installations, messages emitted before the collector started are in `journalctl -u postgresql-18`.']},
{note:'Keep logs on a different filesystem from `PGDATA` and `pg_wal`. A runaway log must never be able to fill the disk that holds your data.'}],
src:[['Error Reporting and Logging',D+'runtime-config-logging.html'],['The Server Log (routine maintenance)',D+'logfile-maintenance.html'],['pg_current_logfile() and system information functions',D+'functions-info.html']]},

/* ---------------------------------------------------------------- 5:1 */
'pg:5:1':{blocks:[
{p:'Almost everything about how a PostgreSQL server behaves is controlled by **configuration parameters**, also called **settings** or **GUCs** (Grand Unified Configuration, the name of the internal subsystem). A parameter has a name, a value, a data type and a **context** that decides when and by whom it can be changed. The documentation (Chapter "Server Configuration") lists several hundred of them, grouped by purpose. Learning how to **read, set and verify** them is the core day-to-day skill of a DBA.'},
{h:'Where parameters live'},
{t:[['File / mechanism','Location','Purpose'],['`postgresql.conf`','`PGDATA` (or `/etc/postgresql/...` on Debian)','Main hand-edited file, created by `initdb` with every parameter listed and commented'],['`postgresql.auto.conf`','`PGDATA`','Written only by `ALTER SYSTEM`. Read **after** `postgresql.conf`, so it wins'],['`pg_hba.conf`','`PGDATA`','Client authentication rules (not a GUC, but reloaded the same way)'],['`pg_ident.conf`','`PGDATA`','User name maps used by `pg_hba.conf`'],['Command line','`postgres -c name=value`, `pg_ctl -o`','Overrides both files for that server run'],['Database / role defaults','`ALTER DATABASE ... SET`, `ALTER ROLE ... SET`','Stored in the catalog `pg_db_role_setting`'],['Session','`SET name = value`','Lasts for the connection (or one transaction with `SET LOCAL`)']]},
{h:'Syntax of postgresql.conf'},
{t:[['Rule','Example'],['One `name = value` per line; the `=` is optional','`max_connections = 200`'],['Names are case-insensitive; values that are strings or contain spaces need single quotes','`log_line_prefix = \'%m [%p] \'`'],['`#` starts a comment, anywhere on a line','`#port = 5432`'],['If a parameter appears twice, the **last** occurrence wins','Later line overrides the earlier one'],['Include other files','`include \'extra.conf\'`, `include_if_exists`, `include_dir \'conf.d\'`'],['Embedded single quote is written doubled','`\'it\'\'s\'`']]},
{h:'Value units'},
{t:[['Kind','Accepted units','Example'],['Memory','`B`, `kB`, `MB`, `GB`, `TB` (binary: 1 kB = 1024 B)','`shared_buffers = 8GB`'],['Time','`us`, `ms`, `s`, `min`, `h`, `d`','`checkpoint_timeout = 30min`'],['Boolean','`on`, `off`, `true`, `false`, `yes`, `no`, `1`, `0` (unique prefixes allowed)','`autovacuum = on`'],['Integer / real','Plain numbers, no thousands separator','`max_connections = 200`'],['Enumerated','One word from a fixed list','`wal_level = replica`']]},
{note:'Without a unit, each parameter has its own base unit (for example `shared_buffers` counts 8 kB blocks, `checkpoint_timeout` counts seconds). Always write the unit explicitly to avoid mistakes.'},
{h:'Parameter groups in the documentation'},
{t:[['Group','Typical parameters'],['File locations','`data_directory`, `hba_file`, `config_file`'],['Connections and authentication','`listen_addresses`, `port`, `max_connections`, `password_encryption`, `ssl`'],['Resource consumption','`shared_buffers`, `work_mem`, `maintenance_work_mem`, `max_worker_processes`'],['Write-ahead log','`wal_level`, `checkpoint_timeout`, `max_wal_size`, `archive_mode`'],['Replication','`max_wal_senders`, `hot_standby`, `primary_conninfo`'],['Query planning','`random_page_cost`, `effective_cache_size`, `enable_*`'],['Error reporting and logging','`log_destination`, `log_min_duration_statement`'],['Run-time statistics','`track_counts`, `track_io_timing`'],['Autovacuum','`autovacuum`, `autovacuum_naptime`, `autovacuum_vacuum_scale_factor`'],['Client connection defaults','`search_path`, `statement_timeout`, `timezone`, `shared_preload_libraries`'],['Lock management','`deadlock_timeout`, `max_locks_per_transaction`'],['Preset (read-only)','`server_version`, `block_size`, `data_checksums`, `wal_segment_size`'],['Customized options','Names with a dot, such as `pg_stat_statements.max`, defined by extensions']]},
{h:'Reading a parameter'},
{code:`SHOW shared_buffers;                         -- one value, as text with unit
SHOW ALL;                                    -- every parameter
SELECT current_setting('work_mem');          -- usable inside SQL
SELECT current_setting('max_connections')::int;

SHOW config_file;     SHOW hba_file;     SHOW data_directory;`},
{h:'Life cycle of a change'},
{flow:['Decide the new value','Edit file or ALTER SYSTEM','Validate (pg_file_settings)','Reload or restart','Verify with SHOW and pg_settings','Record the change']},
{ul:['Always change **one thing at a time** and note the old value, so you can roll back.','Prefer one place for permanent settings. Mixing `postgresql.conf` edits and `ALTER SYSTEM` makes it hard to know which value is active.','Commit `postgresql.conf` to version control or keep dated copies before editing.']},
{h:'Practice'},
{code:`SHOW max_connections;
SHOW shared_buffers;
SHOW checkpoint_timeout;
SELECT name, setting, unit, source FROM pg_settings
WHERE name IN ('max_connections','shared_buffers','checkpoint_timeout');`}],
src:[['Setting Parameters',D+'config-setting.html'],['Server Configuration',D+'runtime-config.html'],['The Configuration File: include directives',D+'config-includes.html']]},

/* ---------------------------------------------------------------- 5:2 */
'pg:5:2':{blocks:[
{p:'The view **`pg_settings`** is the authoritative reference for every parameter. The documentation describes it as another interface to the `SHOW` and `SET` commands, with more information per parameter: the unit, the allowed range, the **context** and the **source** of the current value. Reading its columns correctly tells you what a parameter is, how it may be changed and why it has the value it has.'},
{h:'Data types (vartype)'},
{t:[['vartype','Meaning','Example parameters','Allowed values'],['`bool`','On or off','`autovacuum`, `fsync`, `log_connections` (before 18)','on/off/true/false/yes/no/1/0'],['`integer`','Whole number, often with a unit','`max_connections`, `shared_buffers`, `checkpoint_timeout`','Range in `min_val`..`max_val`'],['`real`','Floating-point number','`autovacuum_vacuum_scale_factor`, `random_page_cost`','Range in `min_val`..`max_val`'],['`string`','Free text','`log_line_prefix`, `log_filename`, `search_path`','Any text'],['`enum`','One of a fixed list','`wal_level`, `log_statement`, `synchronous_commit`','Listed in `enumvals`']]},
{h:'Main columns of pg_settings'},
{t:[['Column','Meaning'],['`name`','Parameter name'],['`setting`','Current value in the **base unit** (no unit text)'],['`unit`','Base unit of `setting`: `8kB`, `kB`, `ms`, `s`, `min`, or empty'],['`category`','Documentation group'],['`short_desc`, `extra_desc`','Built-in description'],['`context`','**When** the parameter can be changed (see below)'],['`vartype`','`bool`, `integer`, `real`, `string`, `enum`'],['`source`','**Where** the current value came from'],['`min_val`, `max_val`, `enumvals`','Valid range or choices'],['`boot_val`','Built-in default'],['`reset_val`','Value a `RESET` in this session would restore'],['`sourcefile`, `sourceline`','File and line that set it (superusers and `pg_read_all_settings` only)'],['`pending_restart`','`true` if the file now holds a new value that only a restart will apply']]},
{h:'Context: the key to reload vs restart'},
{svg:ctxSvg},
{t:[['context','Who may change it, and when it takes effect','Examples'],['`internal`','Fixed at build or `initdb` time. Cannot be changed by configuration.','`block_size`, `wal_segment_size`, `server_version`'],['`postmaster`','Only at **server start**. Changing the file has no effect until restart.','`shared_buffers`, `max_connections`, `wal_level`, `logging_collector`, `shared_preload_libraries`'],['`sighup`','In the file, picked up by **reload**. Cannot be set per session.','`checkpoint_timeout`, `max_wal_size`, `autovacuum`, `log_destination`'],['`superuser-backend`','Reload affects **new** connections only; a superuser may set it at connection time.','`log_connections`, `log_disconnections`'],['`backend`','Reload affects **new** connections only; set at connection start.','`ignore_system_indexes`, `post_auth_delay`'],['`superuser`','Superuser (or granted `SET` privilege) can change it in a session; file change needs reload.','`log_min_duration_statement`, `log_statement`, `track_activities`'],['`user`','Any user can change it in a session; file change needs reload.','`work_mem`, `search_path`, `statement_timeout`']]},
{h:'Source: why the value is what it is'},
{t:[['source','Meaning'],['`default`','Built-in value, never changed'],['`configuration file`','From `postgresql.conf`, an include or `postgresql.auto.conf` (see `sourcefile`)'],['`command line`','From `postgres -c` or `pg_ctl -o`'],['`environment variable`','Read from the postmaster environment (`PGDATA`, `PGPORT`)'],['`database`, `user`, `database user`','From `ALTER DATABASE/ROLE ... SET`'],['`client`','Sent by the client at connect time (`PGOPTIONS`, `options=`)'],['`session`','Changed with `SET` in this session'],['`override`','Forced by the server itself, for example derived from other settings']]},
{h:'Useful queries'},
{code:`-- 1. one parameter in full
SELECT name, setting, unit, context, vartype, source, boot_val, min_val, max_val, pending_restart
FROM pg_settings WHERE name = 'shared_buffers';

-- 2. everything that differs from the built-in default
SELECT name, setting, unit, source, sourcefile
FROM pg_settings WHERE source <> 'default' ORDER BY name;

-- 3. how many parameters fall in each context
SELECT context, count(*) FROM pg_settings GROUP BY context ORDER BY 2 DESC;

-- 4. all parameters that need a restart to change
SELECT name, setting, unit FROM pg_settings WHERE context = 'postmaster' ORDER BY name;

-- 5. pending changes waiting for a restart
SELECT name, setting, pending_restart FROM pg_settings WHERE pending_restart;

-- 6. human-readable size from a base unit
SELECT name, setting, unit,
       pg_size_pretty(setting::bigint * 8192) AS size   -- valid because unit = 8kB
FROM pg_settings WHERE name = 'shared_buffers';`},
{note:'Read `setting` together with `unit`. `shared_buffers` showing `1048576` with unit `8kB` is 8 GB, not 1 million bytes. `SHOW` already formats this for you (`8GB`).'},
{h:'boot_val versus reset_val'},
{p:'`boot_val` is the compiled-in default. `reset_val` is the value `RESET name` would restore in the current session, which includes configuration files and role or database defaults. When `setting <> reset_val` you know someone changed the parameter with `SET` in this session.'}],
src:[['pg_settings view',D+'view-pg-settings.html'],['Setting Parameters',D+'config-setting.html'],['Server Configuration',D+'runtime-config.html']]},

/* ---------------------------------------------------------------- 5:3 */
'pg:5:3':{blocks:[
{p:'After you change a parameter, PostgreSQL does not always notice. Some settings are read while the server runs; others are read **once at startup** because they size shared memory or start processes. The parameter\'s **context** (previous lecture) decides which applies. Choosing wrongly has real cost: a reload that was needed but not done leaves the old value active, while an unnecessary restart disconnects every user.'},
{h:'Reload versus restart'},
{t:[['','Reload','Restart'],['What it does','Postmaster re-reads config files and signals every process (`SIGHUP`)','Stops the whole server and starts it again'],['Connections','Kept open','All dropped'],['Memory caches','Kept','`shared_buffers` starts cold (OS cache usually survives)'],['Downtime','None','Seconds to minutes, plus crash-recovery time if shutdown was not clean'],['Applies to','Contexts `sighup`, `superuser`, `user`, and new sessions for `backend` types; also `pg_hba.conf` and `pg_ident.conf`','Everything, and **required** for context `postmaster`']]},
{h:'Decision flow'},
{flow:['Change the value','Query pg_settings.context','postmaster? → restart in a window','sighup, user, superuser? → reload','Check pending_restart and SHOW']},
{h:'Common parameters by action'},
{t:[['Needs restart (`postmaster`)','Reload is enough (`sighup` or session level)'],['`shared_buffers`, `huge_pages`','`work_mem`, `maintenance_work_mem` (also per session)'],['`max_connections`, `superuser_reserved_connections`','`checkpoint_timeout`, `max_wal_size`, `min_wal_size`'],['`wal_level`, `max_wal_senders`, `max_replication_slots`','`log_min_duration_statement`, `log_statement`, `log_line_prefix`'],['`archive_mode`, `max_worker_processes`','`archive_command`, `autovacuum` and most `autovacuum_*` tuning'],['`logging_collector`, `listen_addresses`, `port`','`log_destination`, `log_rotation_age`, `log_filename`'],['`shared_preload_libraries`','`pg_hba.conf` rules, `hot_standby_feedback`']]},
{note:'PostgreSQL 18 split worker handling for autovacuum: `autovacuum_worker_slots` (restart) reserves slots, while `autovacuum_max_workers` can be raised by reload up to that limit. On older versions `autovacuum_max_workers` itself needs a restart. Always confirm with `pg_settings.context` on your own server.'},
{h:'How to reload'},
{code:`-- from SQL (superuser, or role granted EXECUTE on the function)
SELECT pg_reload_conf();

-- from the shell, any of these
pg_ctl reload -D /var/lib/pgsql/18/data
sudo systemctl reload postgresql-18
kill -HUP $(head -1 /var/lib/pgsql/18/data/postmaster.pid)`},
{h:'How to restart'},
{code:`pg_ctl restart -D /var/lib/pgsql/18/data -m fast
sudo systemctl restart postgresql-18

-- after the restart
SELECT count(*) FROM pg_settings WHERE pending_restart;   -- expect 0`},
{p:'Shutdown modes (`smart`, `fast`, `immediate`) were covered in Section 03. A restart normally uses **fast**: it rolls back running transactions, writes a shutdown checkpoint and exits cleanly, so the next start needs no recovery.'},
{h:'Safe change procedure'},
{flow:['Check pg_file_settings for errors','Record old value','Apply change','Reload or restart','Verify in pg_settings','Watch the log']},
{code:`-- 1. does the new file parse? (applied = false means a problem)
SELECT sourcefile, sourceline, name, setting, applied, error
FROM pg_file_settings WHERE NOT applied OR error IS NOT NULL;

-- 2. after reload: did it take effect, and is anything waiting on a restart?
SELECT name, setting, unit, pending_restart
FROM pg_settings WHERE name IN ('checkpoint_timeout','shared_buffers');`},
{h:'What reload really does to running sessions'},
{ul:['`sighup` parameters change in **existing** sessions as soon as each backend processes the signal, unless that session has overridden the value with `SET`.','`backend` and `superuser-backend` parameters (for example `log_connections`) are read when a connection starts, so only **new** connections see the change.','A restart loads everything fresh. Connection pools reconnect and application errors during the gap are expected, so schedule it.','A reload of a file with a **syntax error** is rejected as a whole and the old settings stay active; an invalid value for one parameter is skipped and logged. Read the log after every reload.']},
{note:'If the server fails to **start** after editing a file, the log says which line is wrong. Keep a copy of the previous `postgresql.conf` and `postgresql.auto.conf` so you can restore them quickly.'}],
src:[['Setting Parameters',D+'config-setting.html'],['pg_ctl',D+'app-pg-ctl.html'],['pg_file_settings view',D+'view-pg-file-settings.html'],['System administration functions (pg_reload_conf)',D+'functions-admin.html']]},

/* ---------------------------------------------------------------- 5:4 */
'pg:5:4':{blocks:[
{p:'`ALTER SYSTEM` is the SQL way to change server-wide parameters without editing a file by hand. The documentation states that it writes the given setting to **`postgresql.auto.conf`**, a file in the data directory, which is read in addition to `postgresql.conf`. Because it is read last, a value in `postgresql.auto.conf` **overrides** the same parameter in `postgresql.conf`. The change is permanent across restarts but does not apply until the server re-reads its configuration.'},
{h:'Syntax'},
{t:[['Command','Effect'],['`ALTER SYSTEM SET name = value;`','Write or replace a line in `postgresql.auto.conf`'],['`ALTER SYSTEM SET name TO DEFAULT;`','Remove that parameter from the file (same as RESET)'],['`ALTER SYSTEM RESET name;`','Remove that parameter from the file'],['`ALTER SYSTEM RESET ALL;`','Remove **every** entry, leaving the file empty']]},
{code:`ALTER SYSTEM SET shared_buffers = '8GB';          -- postmaster: restart needed
ALTER SYSTEM SET checkpoint_timeout = '30min';    -- sighup: reload
ALTER SYSTEM SET log_min_duration_statement = '1s';
ALTER SYSTEM SET search_path = '"$user", public';

SELECT pg_reload_conf();

-- see what ALTER SYSTEM has written
SELECT name, setting, applied FROM pg_file_settings
WHERE sourcefile LIKE '%postgresql.auto.conf';

-- undo one setting, then reload
ALTER SYSTEM RESET log_min_duration_statement;
SELECT pg_reload_conf();`},
{h:'Effect on the files'},
{p:'`postgresql.auto.conf` is machine-written and starts with a comment telling you not to edit it. A typical file after the commands above:'},
{code:`# Do not edit this file manually!
# It will be overwritten by the ALTER SYSTEM command.
shared_buffers = '8GB'
checkpoint_timeout = '30min'`},
{h:'Permissions and restrictions'},
{ul:['By default only **superusers** may run it. Since PostgreSQL 15 a superuser can delegate: `GRANT ALTER SYSTEM ON PARAMETER log_min_duration_statement TO dba_role;`.','It **cannot** run inside a transaction block.','It cannot change preset or `internal` parameters.','Since PostgreSQL 17 the parameter `allow_alter_system` (default `on`) can be set to `off` in `postgresql.conf` to block the command, which suits environments where an external tool owns the configuration. It does not stop anyone who can edit files.','Values containing spaces or special characters are quoted for you, but always supply units as quoted strings.']},
{h:'Choosing a method'},
{t:[['Method','Scope','Persists restart','Best for'],['Edit `postgresql.conf`','Whole cluster','Yes','Baseline reviewed in version control'],['`ALTER SYSTEM`','Whole cluster','Yes','Quick changes, scripts, remote administration'],['`ALTER DATABASE ... SET`','One database','Yes (new sessions)','Different `work_mem` or `search_path` per database'],['`ALTER ROLE ... SET`','One role','Yes (new sessions)','Timeouts for application or reporting users'],['`SET` / `SET LOCAL`','Session / transaction','No','Testing a value, one heavy report'],['`postgres -c` / `pg_ctl -o`','One server run','No','Temporary or emergency override']]},
{h:'Recommended workflow'},
{flow:['ALTER SYSTEM SET','pg_file_settings: applied?','pg_reload_conf()','SHOW and pg_settings','Restart if pending_restart']},
{code:`ALTER SYSTEM SET work_mem = '32MB';
SELECT name, setting, applied, error FROM pg_file_settings WHERE name = 'work_mem';
SELECT pg_reload_conf();
SELECT name, setting, unit, source, sourcefile FROM pg_settings WHERE name = 'work_mem';
-- source = configuration file, sourcefile ends with postgresql.auto.conf`},
{h:'Pitfalls'},
{ul:['**Two places, one parameter.** If `postgresql.conf` says 2GB and `postgresql.auto.conf` says 8GB, 8GB wins and the edit you make in `postgresql.conf` seems to be ignored. Check `sourcefile` in `pg_settings`.','**Lost on rebuild.** `postgresql.auto.conf` lives in `PGDATA`; it is included in a `pg_basebackup` copy, so a standby cloned from a primary inherits the same overrides.','**A bad value** that makes the server refuse to start is fixed by editing or deleting the offending line from `postgresql.auto.conf` while the server is down.']},
{note:'To return the server to a clean state: `ALTER SYSTEM RESET ALL;` followed by a reload. Settings from `postgresql.conf` are then used again.'}],
src:[['ALTER SYSTEM',D+'sql-altersystem.html'],['Setting Parameters',D+'config-setting.html'],['GRANT (privileges on parameters)',D+'sql-grant.html'],['Client Connection Defaults',D+'runtime-config-client.html']]},

/* ---------------------------------------------------------------- 5:5 */
'pg:5:5':{blocks:[
{p:'Memory parameters decide how much RAM PostgreSQL uses to cache data, sort and hash rows, and build indexes. They are the most common performance levers and the most common cause of out-of-memory kills when set carelessly. The documentation (Chapter "Resource Consumption") separates them into **shared** memory, allocated once at start, and **per-operation** memory, allocated by each backend when it needs it.'},
{h:'Memory map'},
{svg:memSvg},
{h:'Parameter reference'},
{t:[['Parameter','Default','Context','Scope','What it does'],['`shared_buffers`','`128MB`','postmaster','Whole server','PostgreSQL\'s own page cache (8 kB pages)'],['`work_mem`','`4MB`','user','**Per sort or hash node**, per query','Memory for sorts, hash joins, hash aggregates before spilling to temp files'],['`hash_mem_multiplier`','`2.0`','user','Per hash node','Hash operations may use `work_mem` x this value'],['`maintenance_work_mem`','`64MB`','user','Per maintenance command','`VACUUM`, `CREATE INDEX`, `ALTER TABLE ADD FOREIGN KEY`'],['`autovacuum_work_mem`','`-1` (use maintenance)','sighup','Per autovacuum worker','Separate limit for autovacuum'],['`effective_cache_size`','`4GB`','user','Planner only','Estimate of cache available (PostgreSQL + OS). **Allocates nothing**'],['`temp_buffers`','`8MB`','user','Per session','Buffers for temporary tables'],['`wal_buffers`','`-1` (auto)','postmaster','Whole server','WAL not yet written; auto = 1/32 of `shared_buffers`, capped at one WAL segment (16MB)'],['`max_connections`','`100`','postmaster','Whole server','Each connection can use memory; also sizes lock tables'],['`huge_pages`','`try`','postmaster','Whole server','Use OS huge pages for shared memory on Linux']]},
{h:'shared_buffers'},
{p:'The docs recommend as a starting point about **25 percent of system RAM** on a dedicated server with 1 GB or more, noting that more than 40 percent seldom helps because PostgreSQL also relies on the operating system cache and values above that duplicate data between the two caches. Changes need a **restart**.'},
{h:'work_mem: the multiplier trap'},
{p:'`work_mem` is **not** a per-connection limit. One query can contain several sort and hash nodes, parallel workers each get their own allowance, and many connections run at once. The documentation warns that total use may be many times `work_mem`.'},
{code:`-- rough worst case (not typical): connections x nodes x work_mem
-- 100 connections x 4 nodes x 32MB = 12.8 GB   -> far more than the "32MB" suggests
-- so raise work_mem per session or role for the few heavy queries instead:
ALTER ROLE reporting SET work_mem = '256MB';
SET work_mem = '512MB';          -- this session only
SET LOCAL work_mem = '1GB';      -- this transaction only`},
{p:'A sort that does not fit in `work_mem` spills to disk. `EXPLAIN (ANALYZE)` then shows `Sort Method: external merge  Disk: ...kB`. Enable `log_temp_files = 0` to log every spill and see which statements need more memory.'},
{h:'Worked example: dedicated 32 GB server'},
{t:[['Parameter','Starting value','Reason'],['`shared_buffers`','`8GB`','About 25 percent of RAM'],['`effective_cache_size`','`24GB`','Planner assumes roughly 50 to 75 percent of RAM is cache'],['`work_mem`','`16MB`','Small global default, raise for specific roles'],['`maintenance_work_mem`','`1GB`','Fast index builds and vacuum; few run at once'],['`autovacuum_work_mem`','`512MB`','Cap total when several workers run'],['`max_connections`','`100`','Use a pooler (PgBouncer) before raising this'],['`huge_pages`','`try`','Lower page-table overhead for a large `shared_buffers`']]},
{code:`ALTER SYSTEM SET shared_buffers = '8GB';
ALTER SYSTEM SET effective_cache_size = '24GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
-- shared_buffers is postmaster context: restart, others: reload
SELECT pg_reload_conf();
-- shell: sudo systemctl restart postgresql-18
SHOW shared_buffers;`},
{h:'Check whether the memory is working'},
{code:`-- cache hit ratio per database (aim for high 90s on OLTP)
SELECT datname,
       round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) AS hit_pct,
       temp_files, pg_size_pretty(temp_bytes) AS temp_spill
FROM pg_stat_database WHERE datname = current_database();

-- what is in shared_buffers? (needs: CREATE EXTENSION pg_buffercache;)
SELECT c.relname, count(*) AS buffers
FROM pg_buffercache b JOIN pg_class c ON c.relfilenode = b.relfilenode
GROUP BY c.relname ORDER BY 2 DESC LIMIT 10;`},
{h:'Tuning method'},
{flow:['Set baseline from RAM','Measure hit ratio and temp spills','Change one parameter','Re-measure under load','Keep or revert']},
{note:'Leave memory for the OS cache, for per-backend overhead and for autovacuum. A server that starts swapping is slower than one with a smaller `shared_buffers`.'}],
src:[['Resource Consumption',D+'runtime-config-resource.html'],['Query Planning (effective_cache_size)',D+'runtime-config-query.html'],['Managing Kernel Resources (huge pages)',D+'kernel-resources.html'],['pg_buffercache',D+'pgbuffercache.html']]},

/* ---------------------------------------------------------------- 5:6 */
'pg:5:6':{blocks:[
{p:'**Write-ahead logging (WAL)** records every change in a sequential log **before** the data pages are changed, so the database can be rebuilt after a crash (Section 04). A **checkpoint** is the point at which PostgreSQL guarantees that all changes made before it have been flushed from `shared_buffers` to the data files. WAL and checkpoint parameters control how much WAL is produced, how often checkpoints happen, how much disk WAL may use and how long crash recovery takes. The documentation chapter "Write Ahead Log" and "Reliability and the Write-Ahead Log" describe the details.'},
{h:'wal_level'},
{t:[['Value','WAL contains','Enables','Typical use'],['`minimal`','Only what crash recovery needs','Nothing beyond recovery; some bulk operations skip WAL','Standalone server with no backups by WAL or replication'],['`replica` (default)','Adds data needed for archiving and physical replication','WAL archiving, `pg_basebackup`, streaming standby, point-in-time recovery','Most production servers'],['`logical`','Adds information for logical decoding','Logical replication, change data capture','Publish/subscribe, CDC tools']]},
{note:'`wal_level` is a **postmaster** parameter and needs a restart. `minimal` also requires `max_wal_senders = 0` and `archive_mode = off`. Raising to `replica` or `logical` is safe; lowering it can break standbys and slots.'},
{h:'Checkpoint parameters'},
{t:[['Parameter','Default','Context','Meaning'],['`checkpoint_timeout`','`5min`','sighup','Maximum time between automatic checkpoints (range 30s to 1d)'],['`max_wal_size`','`1GB`','sighup','Soft limit for WAL growth between checkpoints; reaching it **forces** a checkpoint'],['`min_wal_size`','`80MB`','sighup','WAL below this size is recycled, not removed'],['`checkpoint_completion_target`','`0.9`','sighup','Spread writing across this fraction of the interval to avoid I/O spikes'],['`checkpoint_warning`','`30s`','sighup','Log a hint if size-triggered checkpoints come closer than this'],['`checkpoint_flush_after`','`256kB`','sighup','Ask the OS to flush after this much written']]},
{h:'What starts a checkpoint'},
{svg:ckSvg},
{t:[['Trigger','Visible in log as'],['`checkpoint_timeout` elapsed','`checkpoint starting: time`'],['WAL volume approaches `max_wal_size`','`checkpoint starting: wal`'],['Manual `CHECKPOINT` command','`checkpoint starting: immediate force wait`'],['Clean shutdown','`checkpoint starting: shutdown immediate`'],['`pg_basebackup`, `CREATE DATABASE`, `DROP DATABASE`','`checkpoint starting: force wait`']]},
{h:'The effect of a 30-minute timeout with 1 GB max_wal_size'},
{p:'A common course setting is `wal_level = replica`, `checkpoint_timeout = 30min` and `max_wal_size = 1GB`. Be aware of how they interact: if the workload writes more than a few hundred MB of WAL in 30 minutes, the **size** limit triggers checkpoints long before the 30-minute timer, so the longer timeout changes nothing. On a busy system raise `max_wal_size` together with the timeout.'},
{t:[['Choice','Benefit','Cost'],['Longer interval, larger `max_wal_size`','Fewer checkpoints, less I/O, fewer full-page images written to WAL, better throughput','**Longer crash recovery** (more WAL to replay), more disk used in `pg_wal`'],['Shorter interval, smaller `max_wal_size`','Fast crash recovery, small `pg_wal`','More I/O, more full-page writes, throughput dips'],['Higher `checkpoint_completion_target`','Smoother disk load','Slightly slower completion']]},
{h:'Other WAL parameters worth knowing'},
{t:[['Parameter','Default','Purpose'],['`fsync`','`on`','Force WAL and data to stable storage. **Never** turn off in production: crash can corrupt the cluster'],['`synchronous_commit`','`on`','How long COMMIT waits. `off` risks losing the last moments of commits but not corruption'],['`full_page_writes`','`on`','Write whole page after first change post-checkpoint; protects against torn pages'],['`wal_compression`','`off`','Compress full-page images (`pglz`, `lz4`, `zstd`) to reduce WAL volume'],['`wal_buffers`','`-1`','Memory for unwritten WAL'],['`wal_writer_delay`','`200ms`','How often the WAL writer flushes'],['`archive_mode`, `archive_command`','`off`','Copy finished segments for PITR (`archive_mode` needs restart)'],['`max_wal_senders`','`10`','Concurrent streaming connections for standbys and backups'],['`wal_keep_size`','`0`','Minimum WAL kept for standbys'],['`max_slot_wal_keep_size`','`-1`','Cap WAL held back by replication slots']]},
{h:'synchronous_commit values'},
{t:[['Value','COMMIT returns when','Risk'],['`on`','WAL is flushed locally (and on sync standbys if configured)','None'],['`remote_apply`','Sync standby has replayed it','None, highest latency'],['`remote_write`','Sync standby has written it to OS','Small'],['`local`','Flushed locally only','Standby may lag'],['`off`','Before WAL is flushed','Lose up to about 3x `wal_writer_delay` of commits on crash']]},
{h:'Apply and observe'},
{code:`ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET checkpoint_timeout = '30min';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET log_checkpoints = on;
SELECT pg_reload_conf();            -- wal_level itself needs a restart

-- how many checkpoints were timed vs forced by WAL volume (PostgreSQL 17+)
SELECT num_timed, num_requested, write_time, sync_time, buffers_written
FROM pg_stat_checkpointer;

-- current WAL position, and how much WAL is on disk
SELECT pg_current_wal_lsn();
SELECT count(*) AS files, pg_size_pretty(sum(size)) AS total FROM pg_ls_waldir();`},
{p:'With `log_checkpoints = on` each checkpoint writes two lines:'},
{code:`LOG:  checkpoint starting: time
LOG:  checkpoint complete: wrote 12043 buffers (73.5%); 0 WAL file(s) added,
      0 removed, 4 recycled; write=809.9 s, sync=0.05 s, total=810.2 s;
      distance=65536 kB, estimate=65536 kB`},
{note:'If `num_requested` is much larger than `num_timed`, checkpoints are being forced by WAL volume: increase `max_wal_size`. On PostgreSQL 16 and earlier the same counters are in `pg_stat_bgwriter` (`checkpoints_timed`, `checkpoints_req`).'}],
src:[['Write Ahead Log settings',D+'runtime-config-wal.html'],['WAL Configuration',D+'wal-configuration.html'],['Reliability and the Write-Ahead Log',D+'wal.html'],['pg_stat_checkpointer',D+'monitoring-stats.html']]},

/* ---------------------------------------------------------------- 5:7 */
'pg:5:7':{blocks:[
{p:'This lecture is the **reference and hands-on** companion to "Enable Logging Mechanism". Once the collector is running you decide **what** is worth recording. Too little leaves you blind during an incident; too much hides the signal, costs disk and I/O, and can expose sensitive data. The parameters sit in the documentation chapter "Error Reporting and Logging", in three groups: **where**, **when** and **what**.'},
{h:'When to log: thresholds'},
{t:[['Parameter','Default','Context','Meaning'],['`log_min_messages`','`warning`','superuser','Lowest severity written to the server log'],['`log_min_error_statement`','`error`','superuser','Statement text is added for errors at or above this level'],['`log_min_duration_statement`','`-1` (off)','superuser','Log any statement that takes at least this long; `0` logs all with duration'],['`log_min_duration_sample`','`-1`','superuser','Duration threshold for **sampled** logging'],['`log_statement_sample_rate`','`1.0`','superuser','Fraction of statements over the sample threshold that is logged'],['`log_transaction_sample_rate`','`0`','superuser','Fraction of whole transactions whose statements are all logged']]},
{h:'What to log'},
{t:[['Parameter','Default','Logs'],['`log_connections`','`off`','Connection attempts; PostgreSQL 18 accepts a list (`receipt`, `authentication`, `authorization`, `setup_durations`) as well as `on`'],['`log_disconnections`','`off`','Session end with duration and user'],['`log_statement`','`none`','`none`, `ddl`, `mod` (DDL plus INSERT/UPDATE/DELETE/TRUNCATE/COPY FROM), `all`'],['`log_duration`','`off`','Duration of every completed statement (without text)'],['`log_checkpoints`','`on`','Checkpoint start and end statistics'],['`log_lock_waits`','`off`','A line when a session waits longer than `deadlock_timeout` for a lock'],['`log_temp_files`','`-1`','Temp files at least this big (`0` = all)'],['`log_autovacuum_min_duration`','`10min`','Autovacuum/analyze runs at least this long (`0` = all)'],['`log_replication_commands`','`off`','Replication protocol commands'],['`log_hostname`','`off`','Resolve client IP to host name (adds DNS cost)'],['`log_error_verbosity`','`default`','`terse`, `default` or `verbose` (adds SQLSTATE, source file)'],['`log_parameter_max_length`','`-1`','Bind-parameter values included with statements']]},
{h:'log_statement values'},
{t:[['Value','Records','Typical use'],['`none`','Nothing from this setting','Default'],['`ddl`','`CREATE`, `ALTER`, `DROP`','Change auditing with low volume'],['`mod`','`ddl` plus data-changing statements','Write audit'],['`all`','Every statement','Short debugging windows only']]},
{h:'log_line_prefix: the header on every line'},
{p:'The prefix is text printed at the start of each line, with **escapes** replaced by session facts. The default is `%m [%p] `. A richer prefix makes logs searchable.'},
{t:[['Escape','Value','Escape','Value'],['`%t`','Timestamp','`%m`','Timestamp with milliseconds'],['`%p`','Process ID','`%l`','Line number in session'],['`%u`','User name','`%d`','Database name'],['`%a`','Application name','`%h`','Client host'],['`%r`','Host and port','`%c`','Session ID'],['`%x`','Transaction ID','`%e`','SQLSTATE error code'],['`%Q`','Query ID','`%q`','Stop here for background processes']]},
{code:`ALTER SYSTEM SET log_line_prefix = '%m [%p] %q%u@%d app=%a host=%h ';
-- example output
-- 2026-10-07 10:15:42.318 IST [2841] postgres@sales app=psql host=[local] ERROR:  division by zero`},
{h:'Hands-on: capture query time, errors and disconnections'},
{flow:['Enable collector and restart','Turn on duration, connection logging','Reload','Run test queries','Read the log']},
{code:`-- 1. destination (needs restart for the collector)
ALTER SYSTEM SET logging_collector = on;
ALTER SYSTEM SET log_directory = 'log';
-- restart:  sudo systemctl restart postgresql-18

-- 2. what to record
ALTER SYSTEM SET log_min_duration_statement = 0;       -- log every statement duration (test only)
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_line_prefix = '%m [%p] %q%u@%d ';
SELECT pg_reload_conf();

-- 3. generate events
SELECT pg_sleep(2);
SELECT 1/0;                         -- an error
-- shell: psql -c "select 1" ; (connect and exit)

-- 4. read $PGDATA/log/ and look for:
--   LOG:  duration: 2001.2 ms  statement: SELECT pg_sleep(2);
--   ERROR:  division by zero
--   STATEMENT:  SELECT 1/0;
--   LOG:  disconnection: session time: 0:00:03.1 user=postgres database=postgres host=[local]`},
{note:'After testing, set `log_min_duration_statement` to a sensible value such as `1s` (or `500ms`). Leaving it at `0` on a busy server writes a line for every query and can slow the system.'},
{h:'Production starter profile'},
{t:[['Parameter','Suggested value','Why'],['`logging_collector`','`on`','Own files and rotation'],['`log_min_duration_statement`','`1s` (tune to workload)','Catch slow queries without noise'],['`log_checkpoints`','`on`','See checkpoint pressure'],['`log_connections` / `log_disconnections`','`on`','Audit and connection-storm detection'],['`log_lock_waits`','`on`','Find blocking sessions'],['`log_temp_files`','`0` or `10MB`','Find queries that spill to disk'],['`log_autovacuum_min_duration`','`0` or `1min`','Visibility into autovacuum'],['`log_line_prefix`','`%m [%p] %q%u@%d app=%a `','Searchable, attributable lines'],['`log_statement`','`ddl`','Schema change audit']]},
{h:'Security and privacy'},
{ul:['`log_statement = ddl` or `all` records `CREATE ROLE ... PASSWORD \'secret\'` in clear text. Set passwords from `psql` with `\\password`, which sends a hash, not the statement text.','Logged SQL may contain personal data. Restrict file access (`log_file_mode = 0600`) and protect backups of the log directory.','Only superusers (or roles granted the parameter) can change `log_statement` and `log_min_duration_statement`.']}],
src:[['Error Reporting and Logging',D+'runtime-config-logging.html'],['What to Log',D+'runtime-config-logging.html#RUNTIME-CONFIG-LOGGING-WHAT'],['Lock management settings',D+'runtime-config-locks.html']]},

/* ---------------------------------------------------------------- 5:8 */
'pg:5:8':{blocks:[
{p:'PostgreSQL uses **MVCC**: an `UPDATE` or `DELETE` does not overwrite a row but leaves the old version, a **dead tuple**, until no transaction can see it. Left alone, dead tuples cause **table bloat**, slower scans and, in the extreme, **transaction ID wraparound**. **Autovacuum** is the built-in background service that runs `VACUUM` and `ANALYZE` automatically. The documentation (Routine Vacuuming) says the autovacuum daemon is **highly recommended** for most installations, and it is on by default. Section 05 explained dead tuples and bloat; this lecture shows how to control the automation.'},
{h:'What autovacuum does'},
{t:[['Task','Why it is needed'],['Remove dead tuples and mark space reusable','Stops bloat; keeps scans and indexes small'],['Update the visibility map and free space map','Enables index-only scans and faster inserts'],['`ANALYZE` the table','Keeps planner statistics fresh so plans stay good'],['Freeze old row versions','Prevents transaction ID wraparound, which would otherwise force the server to stop accepting writes']]},
{h:'Architecture'},
{svg:avSvg},
{p:'The **autovacuum launcher** starts a worker for a database about every `autovacuum_naptime`. Each **worker** looks at every table in that database, decides whether it passes a threshold and, if so, vacuums and/or analyzes it. At most `autovacuum_max_workers` workers run at the same time. All of it depends on `track_counts = on`, which is the default.'},
{h:'When does a table qualify?'},
{code:`vacuum threshold  = autovacuum_vacuum_threshold  + autovacuum_vacuum_scale_factor  x reltuples
analyze threshold = autovacuum_analyze_threshold + autovacuum_analyze_scale_factor x reltuples
insert threshold  = autovacuum_vacuum_insert_threshold + autovacuum_vacuum_insert_scale_factor x reltuples
-- a table is vacuumed when dead tuples (or inserts since last vacuum) exceed the threshold`},
{h:'Parameter reference'},
{t:[['Parameter','Default','Context','Meaning'],['`autovacuum`','`on`','sighup','Master switch for the daemon'],['`autovacuum_naptime`','`1min`','sighup','Delay between runs per database'],['`autovacuum_max_workers`','`3`','sighup (18) / postmaster (earlier)','Concurrent workers'],['`autovacuum_vacuum_threshold`','`50`','sighup','Base number of dead tuples'],['`autovacuum_vacuum_scale_factor`','`0.2`','sighup','Fraction of table size added to the threshold'],['`autovacuum_vacuum_insert_threshold`','`1000`','sighup','Inserts that trigger a vacuum on append-only tables'],['`autovacuum_vacuum_insert_scale_factor`','`0.2`','sighup','Fraction of table for the insert trigger'],['`autovacuum_analyze_threshold`','`50`','sighup','Base number of changed rows'],['`autovacuum_analyze_scale_factor`','`0.1`','sighup','Fraction for analyze'],['`autovacuum_vacuum_max_threshold`','`100000000`','sighup','PostgreSQL 18: caps the computed vacuum threshold on huge tables'],['`autovacuum_vacuum_cost_delay`','`2ms`','sighup','Pause when the cost limit is reached (throttling)'],['`autovacuum_vacuum_cost_limit`','`-1` (uses `vacuum_cost_limit`, 200)','sighup','Work allowed before pausing; shared by all workers'],['`autovacuum_work_mem`','`-1` (uses `maintenance_work_mem`)','sighup','Memory per worker for tracking dead tuples'],['`autovacuum_freeze_max_age`','`200000000`','postmaster','Force an anti-wraparound vacuum at this transaction age'],['`log_autovacuum_min_duration`','`10min`','sighup','Log runs at least this long']]},
{h:'Worked example'},
{t:[['Table rows','Default (0.2) trigger','With scale factor 0.01'],['10,000','2,050 dead tuples','150'],['1,000,000','200,050','10,050'],['100,000,000','20,000,050 (capped by max_threshold in 18)','1,000,050']]},
{p:'The default scale factor is fine for small tables but too lax for large ones: a 100-million-row table can accumulate millions of dead rows before autovacuum starts. The standard fix is a **per-table** override rather than changing the cluster default.'},
{code:`ALTER TABLE big_orders SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.005,
  autovacuum_vacuum_cost_limit = 1000);

-- see overrides, and remove them
SELECT relname, reloptions FROM pg_class WHERE reloptions IS NOT NULL;
ALTER TABLE big_orders RESET (autovacuum_vacuum_scale_factor);`},
{h:'Demonstration on a test table'},
{code:`CREATE TABLE av_test (id int PRIMARY KEY, val text);
INSERT INTO av_test SELECT g, md5(g::text) FROM generate_series(1,100000) g;
ANALYZE av_test;

-- make 30000 dead tuples (more than 50 + 0.2 x 100000 = 20050)
DELETE FROM av_test WHERE id <= 30000;

SELECT n_live_tup, n_dead_tup, last_autovacuum, autovacuum_count
FROM pg_stat_user_tables WHERE relname = 'av_test';

-- wait about one autovacuum_naptime (1 min), then repeat the query:
-- n_dead_tup falls toward 0, last_autovacuum is set, autovacuum_count = 1`},
{h:'Monitoring'},
{code:`-- tables with the most dead tuples
SELECT schemaname, relname, n_live_tup, n_dead_tup,
       round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup,0), 1) AS dead_pct,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;

-- running now
SELECT pid, relid::regclass, phase, heap_blks_scanned, heap_blks_total
FROM pg_stat_progress_vacuum;

-- transaction age: how close to wraparound
SELECT datname, age(datfrozenxid) AS xid_age FROM pg_database ORDER BY 2 DESC;`},
{h:'Why autovacuum may not clean'},
{t:[['Blocker','Symptom','Fix'],['Long-running or idle-in-transaction session','Dead tuples stay, `n_dead_tup` grows','Find with `pg_stat_activity`, end it, set `idle_in_transaction_session_timeout`'],['Replication slot or standby feedback holding the horizon','Same','Drop unused slots, review `hot_standby_feedback`'],['Prepared transaction left open','Same, plus wraparound risk','`SELECT * FROM pg_prepared_xacts;` then commit or roll back'],['Workers too slow or too few','Large tables never finish','Raise cost limit or lower delay; more workers; per-table settings'],['Autovacuum disabled','No vacuum at all','Re-enable; never disable globally']]},
{note:'Do not turn autovacuum off to "save I/O". If it is hurting, **tune** it (cost limit, per-table thresholds, off-peak manual `VACUUM`). Disabling it risks bloat and, eventually, an emergency shutdown to prevent wraparound.'}],
src:[['Automatic Vacuuming settings',D+'runtime-config-vacuum.html'],['Routine Vacuuming',D+'routine-vacuuming.html'],['Storage Parameters (per-table)',D+'sql-createtable.html#SQL-CREATETABLE-STORAGE-PARAMETERS'],['Progress Reporting',D+'progress-reporting.html']]},

/* ---------------------------------------------------------------- 5:9  (bonus) */
'pg:5:9':{blocks:[
{p:'The same parameter can be set in many places at once. PostgreSQL resolves the conflict with a fixed order: **the most specific, latest setting wins**. Knowing the order explains puzzles such as "I changed `postgresql.conf` but `SHOW` still shows the old value". This lecture completes the picture started in "Parameter Basics" and "ALTER Command".'},
{h:'Order of precedence (lowest to highest)'},
{svg:precSvg},
{t:[['Level','How it is set','Lasts','pg_settings.source'],['1. Default','Compiled in','Always','`default`'],['2. `postgresql.conf`','Edit file, reload','Until edited','`configuration file`'],['3. `postgresql.auto.conf`','`ALTER SYSTEM`','Until reset','`configuration file`'],['4. Command line','`postgres -c name=value`','One server run','`command line`'],['5. Database default','`ALTER DATABASE db SET ...`','Until reset; new sessions','`database`'],['6. Role default','`ALTER ROLE r SET ...`','Until reset; new sessions','`user`'],['7. Role in database','`ALTER ROLE r IN DATABASE db SET ...`','Until reset; new sessions','`database user`'],['8. Connection options','`PGOPTIONS=\'-c work_mem=64MB\'`, `options=` in conninfo','That connection','`client`'],['9. Session / transaction','`SET`, `SET LOCAL`','Session or transaction','`session`']]},
{note:'A parameter with context `postmaster` or `sighup` cannot be set at levels 5 to 9. Only `user` and `superuser` context parameters can be set per session; `backend` ones at connection time only.'},
{h:'Per-database and per-role defaults'},
{code:`-- different defaults without touching the server-wide file
ALTER DATABASE reporting SET work_mem = '128MB';
ALTER ROLE app_user SET statement_timeout = '30s';
ALTER ROLE app_user IN DATABASE sales SET search_path = 'sales, public';

-- inspect (stored in the catalog pg_db_role_setting)
SELECT s.setdatabase, s.setrole, d.datname, r.rolname, s.setconfig
FROM pg_db_role_setting s
LEFT JOIN pg_database d ON d.oid = s.setdatabase
LEFT JOIN pg_roles    r ON r.oid = s.setrole;

-- remove
ALTER ROLE app_user RESET statement_timeout;
ALTER DATABASE reporting RESET ALL;`},
{p:'These defaults apply to **new** sessions only. They are ideal for giving a reporting role a larger `work_mem` or an application role a statement timeout, without raising global values.'},
{h:'Session and transaction level'},
{code:`SET work_mem = '256MB';                 -- until the session ends or RESET
SET LOCAL work_mem = '1GB';             -- until COMMIT or ROLLBACK
SELECT set_config('work_mem', '64MB', false);   -- function form; true = local
RESET work_mem;                         -- back to what the session started with

-- connection-time option from the shell
PGOPTIONS='-c statement_timeout=5s -c work_mem=64MB' psql -d sales`},
{h:'Debugging "why is this value in effect?"'},
{flow:['SHOW name','pg_settings: source, sourcefile','pg_file_settings: all file entries','pg_db_role_setting: role/db defaults','Check session SET history']},
{code:`SELECT name, setting, source, sourcefile, sourceline FROM pg_settings WHERE name = 'work_mem';

-- every line in every config file, and which one actually applied
SELECT sourcefile, sourceline, seqno, name, setting, applied, error
FROM pg_file_settings WHERE name = 'work_mem' ORDER BY seqno;`},
{p:'`pg_file_settings` shows a row for **each** assignment found in the files, in order, with `applied = true` for the one that won. If a value is invalid, `error` explains why, which makes it a pre-flight check before every reload.'},
{h:'Include files for tidy configuration'},
{code:`# end of postgresql.conf
include_dir 'conf.d'            # loads conf.d/*.conf in file-name order
# conf.d/10-memory.conf
shared_buffers = '8GB'
# conf.d/20-logging.conf
log_min_duration_statement = '1s'`},
{ul:['Files in an include directory load in **alphabetical order**, so use numeric prefixes.','Later lines override earlier ones; `postgresql.auto.conf` is still read last.']}],
src:[['Setting Parameters',D+'config-setting.html'],['ALTER ROLE',D+'sql-alterrole.html'],['ALTER DATABASE',D+'sql-alterdatabase.html'],['SET',D+'sql-set.html'],['pg_db_role_setting',D+'catalog-pg-db-role-setting.html']]},

/* ---------------------------------------------------------------- 5:10 (bonus) */
'pg:5:10':{blocks:[
{p:'Collecting a log is half the job; the other half is **reading it quickly** during an incident and **summarising** it over days. A readable, consistent format is the foundation. This lecture covers structured formats, the patterns to search for and the tools used on server logs.'},
{h:'Anatomy of a log entry'},
{code:`2026-10-07 10:15:42.318 IST [2841] app_user@sales app=api host=10.0.0.12 ERROR:  deadlock detected
2026-10-07 10:15:42.318 IST [2841] app_user@sales DETAIL:  Process 2841 waits for ShareLock on transaction 9012; blocked by process 2850.
2026-10-07 10:15:42.318 IST [2841] app_user@sales HINT:  See server log for query details.
2026-10-07 10:15:42.318 IST [2841] app_user@sales STATEMENT:  UPDATE accounts SET balance = balance - 10 WHERE id = 2;`},
{t:[['Part','Meaning'],['Prefix (from `log_line_prefix`)','When, which backend process, which user and database'],['Severity (`ERROR`)','Level of the message'],['Message','What happened'],['`DETAIL`, `HINT`, `CONTEXT`','Extra lines attached to the same event'],['`STATEMENT`','The SQL that caused it (see `log_min_error_statement`)']]},
{h:'Structured formats'},
{t:[['Format','Strength','Typical use'],['`stderr` text','Human-readable, `grep`-friendly','Daily DBA work'],['`csvlog`','Fixed columns; load into a table with `COPY`','SQL-based log analysis'],['`jsonlog`','One JSON object per line, named fields','Log shippers, Elasticsearch, Loki, `jq`'],['`syslog` / journal','Central OS logging','Fleet-wide aggregation']]},
{code:`-- load a csvlog file into a table for SQL analysis
CREATE TABLE pglog (log_time timestamptz(3), user_name text, database_name text,
  process_id int, connection_from text, session_id text, session_line_num bigint,
  command_tag text, session_start_time timestamptz, virtual_transaction_id text,
  transaction_id bigint, error_severity text, sql_state_code text, message text,
  detail text, hint text, internal_query text, internal_query_pos int, context text,
  query text, query_pos int, location text, application_name text, backend_type text,
  leader_pid int, query_id bigint);
COPY pglog FROM '/var/lib/pgsql/18/data/log/postgresql-Wed.csv' WITH csv;
SELECT error_severity, count(*) FROM pglog GROUP BY 1 ORDER BY 2 DESC;

-- shell, jsonlog:  jq -r 'select(.error_severity=="ERROR") | .message' postgresql-Wed.json`},
{note:'The csvlog column list follows the server version; check "Using CSV-Format Log Output" in the documentation for the exact list of your release before creating the table.'},
{h:'Patterns to search for'},
{t:[['Symptom','Search for','Meaning and action'],['Slow queries','`duration:`','Find top offenders; use `EXPLAIN ANALYZE`, add indexes'],['Spill to disk','`temporary file`','Raise `work_mem` for that role or tune query (needs `log_temp_files`)'],['Blocking','`still waiting for` / `acquired ... after`','Lock waits (needs `log_lock_waits`); find the blocker in `pg_locks`'],['Deadlocks','`deadlock detected`','Make transactions touch rows in the same order'],['Checkpoint pressure','`checkpoints are occurring too frequently`','Increase `max_wal_size`'],['Auth problems','`password authentication failed`, `no pg_hba.conf entry`','Fix `pg_hba.conf` or credentials; possible attack if repeated'],['Connection exhaustion','`remaining connection slots are reserved`','Use a pooler or raise `max_connections`'],['Crashes','`terminated by signal`, `PANIC`','Check OS logs (OOM killer), restart recovery messages'],['Autovacuum','`automatic vacuum of table`','Duration and tuples removed per run']]},
{h:'Quick command-line toolkit'},
{code:`grep -c ERROR   postgresql-Wed.log                 # error count
grep "duration:" postgresql-Wed.log | sort -t: -k4 -n -r | head   # slowest first (approx.)
grep -B2 -A6 "deadlock detected" postgresql-Wed.log
tail -f $PGDATA/log/postgresql-Wed.log                           # follow live
journalctl -u postgresql-18 --since "1 hour ago"                 # systemd installs`},
{h:'Tools'},
{t:[['Tool','Purpose'],['pgBadger','Open-source analyser that turns logs into an HTML report of slow queries, errors, connections, checkpoints and locks. Works best with a full `log_line_prefix` and `log_min_duration_statement`.'],['`pg_stat_statements`','Cumulative statistics per normalised query, without logging. Complements the log.'],['`auto_explain`','Logs execution plans of slow statements (`auto_explain.log_min_duration`).'],['Log shippers (Fluent Bit, Vector, Filebeat)','Forward `jsonlog` to central storage.']]},
{flow:['Log with a rich prefix','Collect csv/json','Analyse with pgBadger or SQL','Confirm with pg_stat_statements','Fix and re-measure']}],
src:[['Using CSV-Format Log Output',D+'runtime-config-logging.html#RUNTIME-CONFIG-LOGGING-CSVLOG'],['Using JSON-Format Log Output',D+'runtime-config-logging.html#RUNTIME-CONFIG-LOGGING-JSONLOG'],['auto_explain',D+'auto-explain.html'],['pg_stat_statements',D+'pgstatstatements.html']]},

/* ---------------------------------------------------------------- 5:11 (bonus) */
'pg:5:11':{blocks:[
{p:'Some parameters do not tune speed; they **protect the server** from runaway sessions, forgotten transactions and connection storms. A production DBA sets these deliberately. They belong in this section because most can be applied per role or per database (see the precedence lecture) and all are visible in `pg_settings`.'},
{h:'Connection parameters'},
{t:[['Parameter','Default','Context','Meaning'],['`listen_addresses`','`localhost`','postmaster','Interfaces the server listens on; `*` for all'],['`port`','`5432`','postmaster','TCP port'],['`max_connections`','`100`','postmaster','Total concurrent connections'],['`superuser_reserved_connections`','`3`','postmaster','Slots kept for superusers during overload'],['`reserved_connections`','`0`','postmaster','Slots kept for roles with `pg_use_reserved_connections` (PostgreSQL 16+)'],['`unix_socket_directories`','`/run/postgresql, /tmp`','postmaster','Where local sockets are created'],['`tcp_keepalives_idle`, `_interval`, `_count`','OS default','user','Detect dead clients behind firewalls']]},
{p:'Each connection is a **process**, so thousands of idle connections waste memory and slow the system. The usual fix is a pooler such as PgBouncer in front of a moderate `max_connections`, not a very large value.'},
{h:'Timeout parameters'},
{t:[['Parameter','Default','Purpose','Common value'],['`statement_timeout`','`0` (off)','Cancel any statement running longer than this','`30s` for application roles'],['`lock_timeout`','`0`','Give up waiting for a lock after this long','`5s` for migrations'],['`idle_in_transaction_session_timeout`','`0`','Terminate sessions idle inside an open transaction (they block vacuum and hold locks)','`1min` to `10min`'],['`idle_session_timeout`','`0`','Terminate sessions idle outside a transaction (PostgreSQL 14+)','Use with care; poolers expect long-lived connections'],['`transaction_timeout`','`0`','Maximum length of a whole transaction (PostgreSQL 17+)','Depends on workload'],['`deadlock_timeout`','`1s`','Wait before checking for deadlock; also threshold for `log_lock_waits`','Keep `1s`'],['`authentication_timeout`','`1min`','Time allowed to complete authentication','Default']]},
{code:`-- protect the whole application, not the DBA
ALTER ROLE app_user SET statement_timeout = '30s';
ALTER ROLE app_user SET idle_in_transaction_session_timeout = '5min';
ALTER ROLE app_user SET lock_timeout = '10s';

-- migrations should fail fast rather than queue behind a lock
ALTER ROLE migrator SET lock_timeout = '3s';

-- connection use right now
SELECT count(*) FILTER (WHERE state = 'active') AS active,
       count(*) FILTER (WHERE state = 'idle') AS idle,
       count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_txn,
       current_setting('max_connections')::int AS max_conn
FROM pg_stat_activity WHERE backend_type = 'client backend';`},
{h:'How these guards interact'},
{flow:['Client connects','Slot available? (max_connections)','Runs statement','statement_timeout / lock_timeout','Idle too long? idle_in_transaction timeout']},
{note:'Do not set `statement_timeout` globally to a low value: long maintenance jobs, backups and migrations will be cancelled. Apply it to application roles and leave administrative roles unrestricted.'},
{h:'Security-related parameters'},
{t:[['Parameter','Default','Note'],['`password_encryption`','`scram-sha-256`','Hash method for new passwords; avoid `md5`'],['`ssl`','`off`','Enable TLS; needs certificate files; reload applies'],['`log_connections`','`off`','Audit trail of who connects'],['`row_security`','`on`','Row-level security enforcement'],['`allow_alter_system`','`on`','Block `ALTER SYSTEM` where config is managed externally']]}],
src:[['Connections and Authentication',D+'runtime-config-connection.html'],['Client Connection Defaults (timeouts)',D+'runtime-config-client.html'],['Lock Management',D+'runtime-config-locks.html'],['Resource Consumption',D+'runtime-config-resource.html']]}

});

/* ------------------------------------------------------------------
   Back-fill: notes added to earlier lessons from what Section 06 teaches
   ------------------------------------------------------------------ */
const X=(k,blocks,src)=>{const L=window.LESSONS[k];if(!L)return;L.blocks.push(...blocks);if(src)L.src=(L.src||[]).concat(src)};

X('pg:2:0',[
{h:'Diagnosing connection failures from the log'},
{p:'When a remote connection is refused, the client message is deliberately vague. The **server log** is precise. Enable `log_connections = on` (Section 06) and read the line produced for the failed attempt.'},
{t:[['Log message','Cause','Fix'],['`no pg_hba.conf entry for host "x", user "u", database "d"`','No matching rule','Add a rule to `pg_hba.conf`, then reload'],['`password authentication failed for user "u"`','Wrong password or method mismatch','Reset password; check `password_encryption`'],['`connection refused` (client side only, nothing in log)','Server not listening on that interface or firewall','Check `listen_addresses`, firewall, port'],['`remaining connection slots are reserved`','`max_connections` reached','Close idle sessions or use a pooler']]},
{note:'`listen_addresses` and `port` are **postmaster** parameters: changing them needs a restart. `pg_hba.conf` changes need only a reload. See "Reload or Restart".'}],
[['Connections and Authentication',D+'runtime-config-connection.html']]);

X('pg:2:2',[
{h:'Shutdown and parameter changes'},
{p:'Restarting the server is required for every parameter whose context is `postmaster` (for example `shared_buffers`, `max_connections`, `wal_level`). Use `fast` mode so a shutdown checkpoint is written and the next start needs no recovery. A reload (`pg_ctl reload`) is enough for `sighup` parameters and for `pg_hba.conf`. Section 06 explains how to tell the two apart with `pg_settings.context` and `pending_restart`.'}],
[['Setting Parameters',D+'config-setting.html']]);

X('pg:2:3',[
{h:'Reading order and the extra file (see Section 06)'},
{p:'The server reads `postgresql.conf` first, then any files named by `include`, `include_if_exists` or `include_dir`, and finally **`postgresql.auto.conf`**, which `ALTER SYSTEM` writes. The last value found wins, so an entry in `postgresql.auto.conf` overrides the same parameter in `postgresql.conf`. Use `pg_file_settings` to see every entry and which one applied, and `pg_settings.sourcefile` to see where the active value came from.'},
{code:`SELECT sourcefile, sourceline, name, setting, applied FROM pg_file_settings ORDER BY seqno LIMIT 20;`}],
[['pg_file_settings',D+'view-pg-file-settings.html']]);

X('pg:3:4',[
{h:'The WAL parameters that control this behaviour'},
{t:[['Parameter','Effect on the WAL mechanism described above'],['`wal_level`','How much information is written: `minimal`, `replica`, `logical` (restart)'],['`wal_buffers`','Size of the in-memory WAL buffer'],['`checkpoint_timeout`, `max_wal_size`','When checkpoints occur and how much WAL accumulates'],['`checkpoint_completion_target`','How evenly checkpoint writes are spread'],['`fsync`, `synchronous_commit`','Whether and when WAL reaches stable storage on COMMIT'],['`archive_mode`, `archive_command`','Copy completed segments for point-in-time recovery']]},
{note:'Tuning guidance, the `log_checkpoints` output and `pg_stat_checkpointer` are covered in "WAL and Checkpoint Parameters" in Section 06.'}],
[['Write Ahead Log settings',D+'runtime-config-wal.html']]);

X('pg:4:2',[
{h:'Passing parameters through the environment'},
{p:'Environment variables can also carry **server parameters**. `PGOPTIONS` is read by `libpq` clients such as `psql` and sends `-c name=value` options at connection time, which sit above role and database defaults in the precedence order (Section 06).'},
{code:`PGOPTIONS='-c work_mem=64MB -c statement_timeout=10s' psql -d postgres -c "SHOW work_mem;"`}],
[['Environment Variables',D+'libpq-envars.html']]);

X('pg:4:7',[
{h:'Why a restart is needed (context postmaster)'},
{p:'`shared_preload_libraries` has context **postmaster**: the libraries are loaded when the server starts, so a reload is not enough. After editing it, restart, then confirm with `SHOW shared_preload_libraries;`. If `pg_settings.pending_restart` is `true` for it, the new value is written but not active yet. Extensions also add their own dotted parameters, for example `pg_stat_statements.max` and `pg_stat_statements.track`, visible in `pg_settings` once loaded.'},
{code:`SELECT name, setting, context, pending_restart FROM pg_settings
WHERE name = 'shared_preload_libraries' OR name LIKE 'pg_stat_statements.%';`}],
[['Setting Parameters',D+'config-setting.html']]);

X('pg:4:9',[
{h:'Controlling vacuum automatically'},
{p:'Autovacuum starts a vacuum when dead tuples exceed `autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor x reltuples` (defaults 50 and 0.2). Large tables often need a lower scale factor set per table. The parameters, a worked example and monitoring queries are in "Autovacuum Parameter" in Section 06.'}],
[['Automatic Vacuuming settings',D+'runtime-config-vacuum.html']]);

X('pg:4:10',[
{h:'Complement statistics with the log'},
{p:'The statistics views show **totals**; the log shows **individual events**. Turn on `log_checkpoints`, `log_lock_waits`, `log_temp_files` and `log_autovacuum_min_duration` (Section 06) so that the counters you read in `pg_stat_database`, `pg_stat_checkpointer` and `pg_stat_user_tables` can be matched to specific lines in the server log.'}],
[['Error Reporting and Logging',D+'runtime-config-logging.html']]);
})();
