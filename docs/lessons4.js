/* LearnSphere: Section 05 - Database and Storage Management (lectures 1-8 + bonus lectures 9-11)
   Load AFTER lessons2.js / lessons3.js. Docs links target PostgreSQL 18. */
(function(){
const D='https://www.postgresql.org/docs/18/';
/* shared SVG helper (reused by lessons5-8.js) */
if(!window.LS_DG){window.LS_DG=(w,h,B,A)=>{const t=(x,y,l)=>l.split('|').map((s,i,a)=>`<text x="${x}" y="${y+(i-(a.length-1)/2)*14}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="var(--tx)">${s}</text>`).join('');
return `<svg viewBox="0 0 ${w} ${h}" font-family="Space Grotesk,sans-serif"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--accent)"/></marker></defs>`+
B.map(([x,y,bw,bh,l,k])=>k==1?`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="12" fill="none" stroke="var(--accent)" stroke-dasharray="5 4"/><text x="${x+10}" y="${y+16}" font-size="11" fill="var(--accent)">${l}</text>`:`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="9" fill="${k==2?'color-mix(in srgb,var(--accent) 22%,var(--panel2))':'var(--panel2)'}" stroke="var(--line)"/>`+t(x+bw/2,y+bh/2,l)).join('')+
A.map(([a,b,c,d])=>`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#ah)"/>`).join('')+'</svg>'}}
const dg=window.LS_DG;

const hierSvg=dg(700,200,[
[10,20,120,60,'Cluster|PGDATA',2],[160,20,120,60,'Database|pg_database',0],[310,20,120,60,'Schema|pg_namespace',0],[460,20,120,60,'Table / Index|pg_class',0],[590,20,100,60,'Row / Column|pg_attribute',0],
[10,130,120,50,'Roles, tablespaces|are cluster-wide',0],[160,130,120,50,'Folder base/OID',0],[310,130,120,50,'Namespace only|no file of its own',0],[460,130,120,50,'File named by|relfilenode',0],[590,130,100,50,'8 KB pages',0]],
[[130,50,160,50],[280,50,310,50],[430,50,460,50],[580,50,590,50],[70,80,70,130],[220,80,220,130],[370,80,370,130],[520,80,520,130],[640,80,640,130]]);
const tplSvg=dg(700,250,[
[10,50,150,55,'template0|pristine, never edit',0],[10,150,150,55,'template1|default model, editable',2],
[220,100,160,55,'CREATE DATABASE|copies the template',2],
[450,30,150,50,'appdb',0],[450,100,150,50,'reportdb',0],[450,170,150,50,'testdb',0]],
[[160,78,220,118],[160,178,220,140],[380,115,450,55],[380,128,450,125],[380,140,450,195]]);
const killSvg=dg(700,150,[
[10,50,130,50,'Find the session|pg_stat_activity',0],[190,50,130,50,'Cancel the query|pg_cancel_backend',2],[370,50,130,50,'Still stuck?|pg_terminate_backend',2],[550,50,140,50,'Verify and fix|root cause',0]],
[[140,75,190,75],[320,75,370,75],[500,75,550,75]]);

window.EXTRA_LECTURES=window.EXTRA_LECTURES||{};
window.EXTRA_LECTURES[4]=[
['Encoding, Locale and Collation','0:00','How character encoding and collation are chosen per database, why they cannot be changed later, and the collation-version trap after OS upgrades.'],
['Table Storage: Pages, TOAST, VACUUM and Bloat','0:00','How rows are physically stored in 8 KB pages, what dead tuples and bloat are, and what VACUUM does.'],
['Monitoring with the Statistics Views','0:00','The pg_stat_* views every DBA queries: cache hit ratio, index usage, long transactions and progress reporting.']];

Object.assign(window.LESSONS,{

/* ---------------------------------------------------------------- 4:0 */
'pg:4:0':{blocks:[
{p:'Every PostgreSQL server stores **data about its own objects** (which tables exist, their columns, owners, indexes, privileges) inside ordinary tables. These are the **system catalogs**. The PostgreSQL documentation calls them the place where a relational database management system stores schema metadata, such as information about tables and columns, and internal bookkeeping information. Catalog **views** present that raw data in a readable form. Together they are the server\'s **data dictionary**, and querying them is how a DBA audits, documents and monitors a cluster with plain SQL.'},
{h:'Three layers of metadata'},
{t:[['Layer','Schema','What it is','When to use'],['System catalog tables','`pg_catalog`','Real tables such as `pg_class`, `pg_attribute`, `pg_database`. Source of truth, PostgreSQL-specific, complete.','Deep or exact information; scripts that must see everything'],['System views','`pg_catalog`','Friendly views built on the catalogs: `pg_tables`, `pg_indexes`, `pg_roles`, `pg_settings`, `pg_stat_activity`.','Everyday administration and monitoring'],['Information schema','`information_schema`','SQL-standard views (`tables`, `columns`, `table_privileges`, `routines`). Shows only objects the current user can access.','Portable queries and tools that must also work on other databases']]},
{note:'`pg_catalog` is always searched first, even if it is not listed in `search_path`. That is why you can call `now()` or query `pg_class` without a schema prefix.'},
{h:'The most important catalogs'},
{t:[['Catalog / view','Scope','Holds'],['`pg_database`','Cluster-wide','One row per database: encoding, collation, template flag, connection limit, default tablespace'],['`pg_roles` / `pg_authid`','Cluster-wide','Roles and attributes (`pg_authid` also holds password hashes and is superuser-only; `pg_roles` hides them)'],['`pg_tablespace`','Cluster-wide','Tablespaces and owners'],['`pg_namespace`','Per database','Schemas'],['`pg_class`','Per database','Every relation: tables, indexes, sequences, views, materialized views'],['`pg_attribute`','Per database','Columns of every relation'],['`pg_index`, `pg_constraint`','Per database','Index and constraint definitions'],['`pg_proc`, `pg_type`','Per database','Functions/procedures and data types'],['`pg_depend`','Per database','Dependencies between objects (why `DROP` needs `CASCADE`)'],['`pg_settings`','Server','All configuration parameters with current value and context']]},
{h:'Decoding `pg_class.relkind`'},
{t:[['Code','Object','Code','Object'],['`r`','Ordinary table','`i`','Index'],['`p`','Partitioned table','`I`','Partitioned index'],['`v`','View','`m`','Materialized view'],['`S`','Sequence','`t`','TOAST table'],['`f`','Foreign table','`c`','Composite type']]},
{h:'Practical queries'},
{code:`-- 1. Databases, owners, encoding and size
SELECT datname, pg_get_userbyid(datdba) AS owner,
       pg_encoding_to_char(encoding) AS enc, datistemplate,
       pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database ORDER BY datname;

-- 2. User tables with owner and row estimate
SELECT n.nspname AS schema, c.relname AS table, pg_get_userbyid(c.relowner) AS owner,
       c.reltuples::bigint AS est_rows
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY n.nspname, c.relname;

-- 3. Columns of one table (information_schema, portable)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
ORDER BY ordinal_position;

-- 4. Who can do what on a table
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name = 'orders';

-- 5. Indexes of a table with their definitions
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'orders';

-- 6. Convert between name and OID with the reg* types
SELECT 'public.orders'::regclass::oid;     -- name -> OID
SELECT 16385::regclass;                    -- OID  -> name`},
{h:'Learn the catalogs from psql itself'},
{p:'Every backslash command in `psql` is just a catalog query. Start psql with `-E` (or run `\\\\set ECHO_HIDDEN on`) and it prints the SQL it sends. Reading those queries is the quickest way to learn which catalog holds what.'},
{code:`psql -E -d appdb
appdb=# \\\\dt
********* QUERY **********
SELECT n.nspname, c.relname, ... FROM pg_catalog.pg_class c ...`},
{note:'Never run `UPDATE` or `DELETE` on catalog tables. A wrong edit can corrupt the cluster. Use DDL (`CREATE`, `ALTER`, `DROP`) and let the server maintain the catalogs.'}],
src:[['System Catalogs',D+'catalogs.html'],['System Views',D+'views.html'],['The Information Schema',D+'information-schema.html'],['Object identifier types',D+'datatype-oid.html']]},

/* ---------------------------------------------------------------- 4:1 */
'pg:4:1':{blocks:[
{p:'A **database** is a named collection of schemas and objects inside a cluster. A client connects to **exactly one database** at a time, and objects in one database cannot be referenced directly from another. New databases are created by **copying a template database**, which is why template management is a core DBA skill.'},
{h:'The three databases created by initdb'},
{t:[['Database','Purpose','Rules'],['`template1`','Default model copied by `CREATE DATABASE`.','Editable. Anything you add here (extensions, functions, schemas) appears in every future database.'],['`template0`','Pristine, read-only copy of the original `template1`.','Marked `datallowconn = false`. Use it when you need a different encoding or locale, or a clean database with none of your template1 changes.'],['`postgres`','Default maintenance database for utilities and tools.','Safe to drop but you should not. Many tools connect to it first.']]},
{svg:tplSvg},
{h:'Creating a database'},
{code:`-- simplest form: copies template1
CREATE DATABASE appdb;

-- production-style: explicit owner, encoding, locale, limits
CREATE DATABASE appdb
  OWNER app_owner
  TEMPLATE template0
  ENCODING 'UTF8'
  LOCALE_PROVIDER libc
  LC_COLLATE 'en_US.UTF-8'
  LC_CTYPE   'en_US.UTF-8'
  TABLESPACE pg_default
  CONNECTION LIMIT 100;

-- from the shell
createdb -U postgres -O app_owner -T template0 -E UTF8 appdb`},
{t:[['Option','Meaning'],['`OWNER`','Role that owns the database (default: the creating role)'],['`TEMPLATE`','Database to copy (default `template1`)'],['`ENCODING`','Character set. Cannot be changed after creation'],['`LOCALE_PROVIDER`','`libc`, `icu` or `builtin` (builtin added in v17)'],['`LC_COLLATE` / `LC_CTYPE`','Sort order and character classification (libc provider)'],['`TABLESPACE`','Default tablespace for objects in this database'],['`ALLOW_CONNECTIONS`','If `false`, nobody can connect (used by `template0`)'],['`CONNECTION LIMIT`','Maximum concurrent connections to this database (`-1` = unlimited)'],['`IS_TEMPLATE`','If `true`, any user with CREATEDB can clone it'],['`STRATEGY`','`WAL_LOG` (default since v15) or `FILE_COPY`; v18 adds `file_copy_method` to allow fast cloning on supporting file systems']]},
{h:'How the copy works'},
{flow:['Check no other session is connected to the template','Take a checkpoint (FILE_COPY) or WAL-log blocks (WAL_LOG)','Copy all files of the template','Register the new database in `pg_database`','New database is ready']},
{note:'If you see `source database "template1" is being accessed by other users`, someone is connected to the template. Find and end that session (see the Kill Sessions lesson) and retry.'},
{h:'Using your own template'},
{code:`-- Prepare a "golden" template with extensions and standard schemas
CREATE DATABASE tpl_app TEMPLATE template0;
\\\\c tpl_app
CREATE EXTENSION pg_stat_statements;
CREATE SCHEMA app AUTHORIZATION app_owner;
\\\\c postgres
ALTER DATABASE tpl_app WITH IS_TEMPLATE true ALLOW_CONNECTIONS false;

-- every new tenant database starts identical
CREATE DATABASE customer42 TEMPLATE tpl_app;`},
{h:'Altering, renaming and dropping'},
{code:`ALTER DATABASE appdb RENAME TO appdb_old;      -- no sessions allowed
ALTER DATABASE appdb OWNER TO new_owner;
ALTER DATABASE appdb SET work_mem = '32MB';    -- per-database default
ALTER DATABASE appdb CONNECTION LIMIT 50;

DROP DATABASE IF EXISTS appdb_old;
DROP DATABASE appdb_old WITH (FORCE);          -- v13+: terminates sessions first`},
{ul:['`DROP DATABASE` cannot run inside a transaction and cannot drop the database you are connected to. Connect to `postgres` first.','Dropping is **irreversible** and deletes the files on disk. Back up first.','`WITH (FORCE)` disconnects other sessions automatically; without it the command fails if anyone is connected.']},
{h:'Template hygiene (production rules)'},
{ul:['Do not casually modify `template1`. Keep it clean and use a **named custom template** instead.','Never connect to or edit `template0`.','When restoring a dump with `pg_restore -C`, the database is created from `template0` by default in the dump, so encoding settings are reproduced exactly.','Check `datistemplate`, `datallowconn` and `datconnlimit` in `pg_database` during audits.']}],
src:[['CREATE DATABASE',D+'sql-createdatabase.html'],['Template Databases',D+'manage-ag-templatedbs.html'],['DROP DATABASE',D+'sql-dropdatabase.html'],['ALTER DATABASE',D+'sql-alterdatabase.html']]},

/* ---------------------------------------------------------------- 4:2 */
'pg:4:2':{blocks:[
{p:'Environment variables let client programs (`psql`, `pg_dump`, `pg_restore`, `pg_basebackup`) and server utilities (`pg_ctl`, `initdb`) find the right server, database and data directory **without typing long command lines**. They are the foundation of a clean multi-cluster setup: switch one profile and every tool points to a different cluster.'},
{h:'Client variables (libpq)'},
{t:[['Variable','Equivalent option','Meaning'],['`PGHOST`','`-h`','Server host name or socket directory'],['`PGPORT`','`-p`','Server port (default `5432`)'],['`PGDATABASE`','`-d`','Database to connect to'],['`PGUSER`','`-U`','Role name to connect as'],['`PGPASSWORD`','(none)','Password. **Discouraged**: visible to other processes on some systems. Use `~/.pgpass` instead'],['`PGPASSFILE`','(none)','Path of the password file (default `~/.pgpass`)'],['`PGSERVICE`','`service=`','Named connection defined in `pg_service.conf`'],['`PGSSLMODE`','`sslmode=`','`disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`'],['`PGCONNECT_TIMEOUT`','`connect_timeout=`','Seconds to wait for a connection'],['`PGOPTIONS`','`options=`','Server settings sent at connect, e.g. `-c statement_timeout=30s`'],['`PGAPPNAME`','`application_name=`','Label shown in `pg_stat_activity`']]},
{h:'Server-side utility variables'},
{t:[['Variable','Used by','Meaning'],['`PGDATA`','`pg_ctl`, `initdb`, `postgres`, `pg_controldata`','Data directory of the cluster. Replaces `-D`'],['`PATH`','Shell','Must include the `bin` directory of the PostgreSQL version you intend to use'],['`PGTZ`, `PGCLIENTENCODING`','libpq clients','Session time zone and client encoding'],['`PSQLRC`, `PAGER`, `EDITOR`','`psql`','Startup file, pager (e.g. `less -S`), editor for `\\\\e`']]},
{h:'Precedence'},
{flow:['Explicit command-line option (`-h`, `-p`)','Connection string / `service`','Environment variable','Compiled-in default']},
{h:'Setting them permanently'},
{code:`# per user: ~/.bash_profile
export PGDATA=/var/lib/pgsql/18/data
export PATH=/usr/pgsql-18/bin:$PATH
export PGPORT=5432
export PGUSER=postgres

# system wide: /etc/profile.d/pgsql.sh  (same lines)

# apply and verify
source ~/.bash_profile
env | grep ^PG
which psql pg_ctl
psql -c "\\\\conninfo"`},
{h:'Multi-cluster profiles with an environment script'},
{p:'Graphical installers create a script (commonly `pg_env.sh`) that exports `PGDATA`, `PGPORT`, `PGUSER`, `PGLOCALEDIR` and `PATH`. On package installs you can create the same thing yourself, one file per cluster, and **source** the one you want.'},
{code:`# /opt/pgenv/pg18_5432.env
export PGHOME=/usr/pgsql-18
export PGDATA=/var/lib/pgsql/18/data
export PGPORT=5432
export PATH=$PGHOME/bin:$PATH

# /opt/pgenv/pg18_5433.env
export PGHOME=/usr/pgsql-18
export PGDATA=/pgdata/cluster2
export PGPORT=5433
export PATH=$PGHOME/bin:$PATH

# switch cluster in the current shell
source /opt/pgenv/pg18_5433.env
pg_ctl status            # now talks to cluster 2
psql -c "SHOW data_directory;"`},
{h:'Password file and service file (safer than PGPASSWORD)'},
{code:`# ~/.pgpass  (chmod 0600)   host:port:database:user:password
localhost:5432:*:postgres:S3cret!
10.0.0.5:5433:appdb:appuser:Another#Pass

# ~/.pg_service.conf
[prod_report]
host=10.0.0.5
port=5433
dbname=appdb
user=report_ro

psql "service=prod_report"        # or: PGSERVICE=prod_report psql`},
{note:'`libpq` ignores `~/.pgpass` if its permissions are more open than `0600`. If prompts keep appearing, check `ls -l ~/.pgpass`.'},
{ul:['Keep a **standard data path convention** such as `/pgdata/<version>/<cluster>` so scripts, monitoring and backups can derive paths from variables.','Batch jobs and cron do not read your interactive profile. Source the env file explicitly at the top of each script.','`PGDATA` must point to the right cluster before you run `pg_ctl stop`. Many outages come from stopping the wrong instance.']}],
src:[['Environment Variables (libpq)',D+'libpq-envars.html'],['The Password File',D+'libpq-pgpass.html'],['The Connection Service File',D+'libpq-pgservice.html'],['Server Setup and Operation',D+'runtime.html']]},

/* ---------------------------------------------------------------- 4:3 */
'pg:4:3':{blocks:[
{p:'PostgreSQL organises objects in a strict **hierarchy**. Understanding it explains where data lives, what is shared between databases, and which commands affect which level.'},
{svg:hierSvg},
{h:'Logical hierarchy'},
{t:[['Level','Definition','Key facts'],['**Cluster**','All databases managed by one server instance and stored in one data directory (`PGDATA`).','One postmaster, one port. Roles, tablespaces and some catalogs are shared by every database in the cluster.'],['**Database**','A named, isolated container of schemas.','A connection is bound to one database. No cross-database queries; use `dblink` or `postgres_fdw`.'],['**Schema**','A namespace inside a database.','Groups objects, controls access, avoids name clashes. Not a separate file.'],['**Table / index / view / sequence**','Relations stored or defined inside a schema.','Tables and indexes are files; views are stored queries.'],['**Row (tuple) and column**','Data inside a table.','Rows are stored in 8 KB pages with a per-row header.']]},
{h:'What is global and what is local'},
{t:[['Cluster-wide (shared)','Per database'],['Roles (users and groups)','Schemas'],['Tablespaces','Tables, indexes, sequences, views'],['Database list (`pg_database`)','Functions, types, extensions'],['Cluster configuration','Per-database settings (`ALTER DATABASE ... SET`)']]},
{note:'Creating a role once makes it visible in every database, but its **privileges** are granted per object inside each database. `CONNECT` on the database is the first gate.'},
{h:'Physical hierarchy on disk'},
{flow:['`PGDATA`','`base/`','`base/<database OID>/`','`<relfilenode>` file','`_fsm`, `_vm`, `.1` segments']},
{t:[['Logical object','Physical location'],['Cluster','`PGDATA` directory'],['Database','`PGDATA/base/<db OID>/` (or the folder inside a tablespace)'],['Table or index','One or more files named by **relfilenode**; split into 1 GB segments (`.1`, `.2`)'],['Extra forks','`_fsm` free space map, `_vm` visibility map, `_init` for unlogged tables'],['Large values','Stored out of line in the table\'s TOAST table'],['Shared catalogs','`PGDATA/global/`'],['Non-default tablespace','Symbolic link in `PGDATA/pg_tblspc/<tablespace OID>`']]},
{h:'Finding the file behind an object'},
{code:`SELECT oid, datname FROM pg_database;                    -- database OIDs
SELECT pg_relation_filepath('public.orders');            -- e.g. base/16384/16402
SELECT pg_relation_filenode('public.orders');
SELECT relname, oid, relfilenode, reltablespace
FROM pg_class WHERE relname = 'orders';`},
{ul:['**OID** is a permanent object identifier. **relfilenode** is the current file name. They start equal but diverge after `TRUNCATE`, `VACUUM FULL`, `CLUSTER` or `REINDEX`, which write a new file.','`reltablespace = 0` means the database\'s default tablespace.','`oid2name` (a contrib tool) maps OIDs and file names back to object names from the shell.']},
{h:'Fully qualified names'},
{p:'Inside one database an object is addressed as `schema.table` (for example `sales.orders`). A third part, the database name, is accepted syntactically but only for the current database. To read data in another database you need an extension such as `postgres_fdw`.'}],
src:[['Database Physical Storage',D+'storage.html'],['Database File Layout',D+'storage-file-layout.html'],['Managing Databases',D+'managing-databases.html'],['Schemas',D+'ddl-schemas.html']]},

/* ---------------------------------------------------------------- 4:4 */
'pg:4:4':{blocks:[
{p:'Every client connection is a **backend process** with a process ID (PID). When a query runs too long, a transaction sits open or a session blocks others, a DBA can stop it from SQL. The server provides two functions, and knowing the difference between them is the whole lesson.'},
{svg:killSvg},
{h:'Step 1: Find the session'},
{code:`SELECT pid, usename, datname, application_name, client_addr,
       state, wait_event_type, wait_event,
       now() - query_start  AS query_age,
       now() - xact_start   AS xact_age,
       left(query, 60)      AS query
FROM pg_stat_activity
WHERE backend_type = 'client backend' AND pid <> pg_backend_pid()
ORDER BY query_start;`},
{t:[['`state`','Meaning','Concern'],['`active`','Running a query now','Long ones may need review'],['`idle`','Connected, waiting for a command','Harmless except for connection slots'],['`idle in transaction`','Transaction open, doing nothing','**Dangerous**: holds locks and blocks VACUUM from removing dead rows'],['`idle in transaction (aborted)`','An error occurred, still in the transaction','Client must ROLLBACK'],['`fastpath function call`','Executing a fast-path function','Rare']]},
{h:'Step 2: Cancel or terminate'},
{t:[['Method','Effect','Session','Use when'],['`pg_cancel_backend(pid)`','Sends SIGINT: cancels the **current query** only','Stays connected','Runaway query; you want the application to continue'],['`pg_terminate_backend(pid [, timeout])`','Sends SIGTERM: ends the **whole session** and rolls back its transaction','Disconnected','Idle-in-transaction, stuck client, or cancel was ignored'],['`kill -9 <pid>` (OS)','Kills the process abruptly','Whole server restarts','**Never.** The postmaster treats it as a crash, disconnects everyone and runs crash recovery']]},
{code:`SELECT pg_cancel_backend(12345);
SELECT pg_terminate_backend(12345);

-- bulk: end every session of one database (e.g. before DROP or RENAME)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'appdb' AND pid <> pg_backend_pid();

-- end sessions idle in transaction for more than 10 minutes
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND now() - state_change > interval '10 minutes';`},
{h:'Who is allowed?'},
{ul:['A **superuser** can signal any backend.','A role can signal backends of **its own role** or of roles it is a member of.','Membership in the predefined role **`pg_signal_backend`** lets a non-superuser signal other non-superuser sessions. It cannot touch superuser sessions.']},
{h:'Finding the blocker'},
{p:'When a session waits (`wait_event_type = Lock`), the culprit is the session holding the conflicting lock. Do not kill the waiter; find the holder.'},
{code:`SELECT a.pid AS waiting_pid, a.usename, left(a.query,40) AS waiting_query,
       pg_blocking_pids(a.pid) AS blocked_by
FROM pg_stat_activity a
WHERE cardinality(pg_blocking_pids(a.pid)) > 0;

-- details of the blocker
SELECT pid, usename, state, xact_start, left(query,60)
FROM pg_stat_activity WHERE pid = ANY (pg_blocking_pids(<waiting_pid>));`},
{h:'Worked scenario'},
{flow:['Session A: `BEGIN; UPDATE orders SET status=\'X\' WHERE id=1;` (no COMMIT)','Session B: `UPDATE orders ... WHERE id=1;` waits','`pg_blocking_pids(B)` returns A','A is `idle in transaction`: terminate A','B proceeds immediately']},
{h:'Prevent it instead of fixing it'},
{t:[['Parameter','Effect'],['`statement_timeout`','Cancels any statement running longer than the limit'],['`lock_timeout`','Cancels a statement that waits too long for a lock'],['`idle_in_transaction_session_timeout`','Terminates sessions idle inside a transaction too long'],['`idle_session_timeout` (v14+)','Terminates sessions idle outside a transaction'],['`ALTER ROLE r CONNECTION LIMIT n`','Limits concurrent sessions per role']]},
{code:`ALTER ROLE app_user SET idle_in_transaction_session_timeout = '5min';
ALTER ROLE app_user SET statement_timeout = '60s';`},
{note:'Record the PID, user, query and age **before** terminating. After a termination the evidence is gone, and you will need it for the root-cause report.'}],
src:[['Server Signaling Functions',D+'functions-admin.html#FUNCTIONS-ADMIN-SIGNAL'],['pg_stat_activity',D+'monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW'],['Explicit Locking',D+'explicit-locking.html'],['Predefined Roles',D+'predefined-roles.html']]},

/* ---------------------------------------------------------------- 4:5 */
'pg:4:5':{blocks:[
{p:'A **schema** is a namespace inside a database that contains tables, views, functions, types, sequences and other objects. Two objects can share a name if they live in different schemas (`sales.orders` and `archive.orders`). The documentation lists the reasons to use schemas: to allow many users to use one database without interfering, to organise objects into logical groups, and to separate third-party applications so names do not collide.'},
{h:'Schemas versus databases'},
{t:[['','Database','Schema'],['Isolation','Strong: separate connection, no cross queries','Logical: same connection, cross-schema queries and joins allowed'],['Backup unit','`pg_dump` per database','`pg_dump -n schema`'],['Privilege gate','`CONNECT`','`USAGE` and `CREATE` on schema'],['Typical use','One per application or tenant needing hard separation','Modules, environments, tenants, staging areas']]},
{h:'Built-in schemas'},
{t:[['Schema','Purpose'],['`public`','Default schema of new databases. From v15 only the database owner (via `pg_database_owner`) may create objects here by default'],['`pg_catalog`','System catalogs and built-in functions. Always searched first'],['`information_schema`','SQL-standard metadata views'],['`pg_toast`','TOAST tables for large values'],['`pg_temp_N`','Temporary tables of session N']]},
{h:'Working with schemas'},
{code:`CREATE SCHEMA sales AUTHORIZATION sales_owner;
CREATE SCHEMA IF NOT EXISTS archive;

-- create schema and objects in one statement
CREATE SCHEMA hr
  CREATE TABLE employee (id int PRIMARY KEY, name text)
  CREATE VIEW v_names AS SELECT name FROM employee;

CREATE TABLE sales.orders (id bigint PRIMARY KEY, total numeric);
SELECT * FROM sales.orders;

ALTER SCHEMA sales RENAME TO sales_v2;
ALTER SCHEMA sales OWNER TO new_owner;
ALTER TABLE sales.orders SET SCHEMA archive;      -- move an object

DROP SCHEMA archive;                              -- fails if not empty
DROP SCHEMA archive CASCADE;                      -- drops everything inside`},
{h:'How names are resolved: search_path'},
{p:'When you write an unqualified name such as `orders`, PostgreSQL walks the schemas in `search_path` and uses the first match. The default is `"$user", public`, meaning a schema named after the current role, then `public`. New objects are created in the **first existing schema** of the path.'},
{flow:['Query uses name `orders`','`pg_catalog` (implicit, first)','Schemas in `search_path` in order','First match wins','No match: `relation does not exist`']},
{code:`SHOW search_path;
SET search_path = sales, public;                  -- this session
ALTER ROLE app_user SET search_path = sales;      -- every new session of the role
ALTER DATABASE appdb SET search_path = sales, public;
SELECT current_schema(), current_schemas(true);`},
{h:'Privileges on schemas'},
{t:[['Privilege','Allows'],['`USAGE`','Look up objects in the schema (needed in addition to object-level privileges)'],['`CREATE`','Create new objects in the schema']]},
{code:`REVOKE ALL ON SCHEMA sales FROM PUBLIC;
GRANT USAGE ON SCHEMA sales TO app_ro;
GRANT USAGE, CREATE ON SCHEMA sales TO app_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA sales TO app_ro;`},
{note:'A role needs `USAGE` on the schema **and** a privilege on the table. Forgetting `USAGE` produces `permission denied for schema` even if the table grant exists.'},
{h:'Governance best practices'},
{ul:['Do **not** put application objects in `public`. Create one schema per application or module and an owner role for it.','Always schema-qualify objects in scripts, migrations and `SECURITY DEFINER` functions.','Set `search_path` per role or database instead of relying on defaults.','For multi-tenant systems, schema-per-tenant is simple at tens of tenants; with thousands, catalog size and migration time grow, so consider a tenant-id column with Row Level Security.','Install extensions into a dedicated schema (for example `extensions`) and add it to `search_path`.']}],
src:[['Schemas',D+'ddl-schemas.html'],['CREATE SCHEMA',D+'sql-createschema.html'],['Schema Search Path',D+'ddl-schemas.html#DDL-SCHEMAS-PATH'],['Secure Schema Usage Pattern',D+'ddl-schemas.html#DDL-SCHEMAS-PATTERNS']]},

/* ---------------------------------------------------------------- 4:6 */
'pg:4:6':{blocks:[
{p:'Knowing how big things are is basic capacity management: it drives disk planning, backup duration and restore time. PostgreSQL provides size functions that return **bytes**, and `pg_size_pretty()` converts them to KB, MB, GB.'},
{h:'Size functions'},
{t:[['Function','Returns'],['`pg_database_size(name)`','Total size of a database on disk'],['`pg_tablespace_size(name)`','Size of a tablespace'],['`pg_relation_size(rel [, fork])`','One fork of a relation. Default `main` fork only: **table heap without indexes or TOAST**'],['`pg_table_size(rel)`','Table + TOAST + free space map + visibility map (no indexes)'],['`pg_indexes_size(rel)`','All indexes of a table'],['`pg_total_relation_size(rel)`','Table + TOAST + indexes. The number to use for "how big is this table"'],['`pg_size_pretty(bigint)`','Human-readable text'],['`pg_size_bytes(text)`','Parses `\'512 MB\'` back to bytes']]},
{code:`SELECT pg_size_pretty(pg_database_size('appdb'));

SELECT pg_size_pretty(pg_relation_size('public.orders'))        AS heap_only,
       pg_size_pretty(pg_table_size('public.orders'))           AS table_toast,
       pg_size_pretty(pg_indexes_size('public.orders'))         AS indexes,
       pg_size_pretty(pg_total_relation_size('public.orders'))  AS total;`},
{h:'Using psql meta-commands'},
{t:[['Command','Shows'],['`\\\\l+`','Databases with **size**, tablespace and description'],['`\\\\dt+`','Tables with size (table + TOAST, excluding indexes)'],['`\\\\di+`','Indexes with size'],['`\\\\db+`','Tablespaces with size'],['`\\\\dn+`','Schemas with owner, privileges and description (**not** size)']]},
{note:'`\\\\dn+` does not display schema size. To size a schema you must add up its relations with a query, as shown below.'},
{h:'Reports a DBA keeps handy'},
{code:`-- all databases, largest first
SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database ORDER BY pg_database_size(datname) DESC;

-- size of every schema in the current database
SELECT n.nspname AS schema,
       pg_size_pretty(sum(pg_total_relation_size(c.oid))) AS size
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','m','p') AND n.nspname NOT IN ('pg_catalog','information_schema')
GROUP BY n.nspname ORDER BY sum(pg_total_relation_size(c.oid)) DESC;

-- top 10 tables with split between data and indexes
SELECT n.nspname||'.'||c.relname AS table_name,
       pg_size_pretty(pg_table_size(c.oid))         AS data,
       pg_size_pretty(pg_indexes_size(c.oid))       AS idx,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 10;

-- the individual forks of one table
SELECT fork, pg_size_pretty(pg_relation_size('public.orders', fork))
FROM unnest(ARRAY['main','fsm','vm']) AS fork;`},
{h:'Interpreting the numbers'},
{ul:['Size on disk includes **dead tuples and bloat**, so it can be much larger than the live data. Compare with `n_live_tup` and run `VACUUM`.','A dump file is usually smaller than the database because it holds no indexes and is often compressed.','`pg_database_size` needs `CONNECT` privilege on the database; reading all table sizes is not restricted.','Also watch the **WAL directory** and **log directory**: they are outside the database size figure.','OS view for comparison: `du -sh $PGDATA/base`, `df -h`.']}],
src:[['Database Object Size Functions',D+'functions-admin.html#FUNCTIONS-ADMIN-DBSIZE'],['psql meta-commands',D+'app-psql.html'],['Disk Usage',D+'diskusage.html']]},

/* ---------------------------------------------------------------- 4:7 */
'pg:4:7':{blocks:[
{p:'PostgreSQL ships with a set of optional add-on modules, collectively called **contrib** (the `contrib` directory of the source, documented as "Additional Supplied Modules and Extensions"). Most are packaged as **extensions**: a bundle of SQL objects installed into a database with one command. Some are command-line tools, such as `pgbench` and `oid2name`.'},
{h:'Getting the contrib modules'},
{t:[['Installation method','How contrib is provided'],['PGDG yum/RPM','Install `postgresql18-contrib`'],['Debian / Ubuntu','Included with `postgresql-18` or the separate `postgresql-contrib` package'],['Windows GUI installer','Included'],['Source build','`cd contrib && make && sudo make install` (or `make world`)']]},
{h:'Managing extensions'},
{code:`SELECT name, default_version, installed_version, comment
FROM pg_available_extensions WHERE name LIKE 'pg_%' ORDER BY name;

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION pgcrypto SCHEMA extensions;     -- install into a chosen schema
ALTER EXTENSION pg_stat_statements UPDATE;
DROP EXTENSION pgcrypto;
\\\\dx                                             -- list installed in this database`},
{ul:['Extensions are installed **per database**, not per cluster. Use `template1` or a custom template to preinstall them everywhere.','Installing usually requires superuser. Since v13, extensions marked **trusted** can be installed by any role with `CREATE` on the database.','Some modules need to load code at startup through `shared_preload_libraries`, which needs a **restart**.']},
{h:'Frequently used modules'},
{t:[['Module','Purpose','Preload needed'],['`pg_stat_statements`','Execution statistics of every normalised SQL statement','Yes'],['`auto_explain`','Logs execution plans of slow queries','Yes (or `LOAD`)'],['`pg_buffercache`','Inspect what is in `shared_buffers`','No'],['`pg_prewarm`','Load relations into cache; can restore cache after restart','Optional'],['`pgstattuple`','Measure table and index bloat precisely','No'],['`pageinspect`','Look inside raw pages','No'],['`amcheck`','Verify B-tree and heap integrity','No'],['`pg_walinspect`','Read WAL records with SQL','No'],['`pgcrypto`','Hashing and encryption functions','No'],['`pg_trgm`','Fuzzy text search, fast `LIKE \'%x%\'`','No'],['`postgres_fdw`, `dblink`','Query other PostgreSQL databases','No'],['`file_fdw`','Read server-side files as tables','No'],['`pgbench`, `oid2name`, `vacuumlo`','Command-line tools','n/a']]},
{h:'Worked example: pg_stat_statements'},
{flow:['Add to `shared_buffers`-style preload list in `postgresql.conf`','Restart the cluster','`CREATE EXTENSION` in the database','Run workload','Query the view']},
{code:`# postgresql.conf   (restart required)
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
compute_query_id = auto                 # on is also fine

sudo systemctl restart postgresql-18

-- in psql
CREATE EXTENSION pg_stat_statements;

SELECT left(query,60) AS query, calls,
       round(total_exec_time::numeric,1) AS total_ms,
       round(mean_exec_time::numeric,2)  AS mean_ms, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 10;

SELECT pg_stat_statements_reset();      -- start a new measuring window`},
{note:'If `shared_preload_libraries` already lists other libraries, **append** the new name to the comma-separated list. Replacing the value silently stops the others from loading. Check first with `SHOW shared_preload_libraries;`.'},
{h:'Verify'},
{code:`SHOW shared_preload_libraries;
SELECT * FROM pg_extension;
SELECT count(*) FROM pg_stat_statements;`}],
src:[['Additional Supplied Modules',D+'contrib.html'],['CREATE EXTENSION',D+'sql-createextension.html'],['pg_stat_statements',D+'pgstatstatements.html'],['shared_preload_libraries',D+'runtime-config-client.html#GUC-SHARED-PRELOAD-LIBRARIES']]},

/* ---------------------------------------------------------------- 4:8 bonus */
'pg:4:8':{blocks:[
{p:'Two settings are fixed **when a database is created** and decide how every text value is stored and compared: the **character encoding** and the **locale** (collation and character classification). Choosing them badly is one of the few mistakes that cannot be fixed in place.'},
{h:'Encoding'},
{t:[['Encoding','Notes'],['`UTF8`','Recommended default. Stores all of Unicode, 1 to 4 bytes per character'],['`LATIN1` ... `LATIN9`, `WIN1252`','Single-byte, limited alphabets'],['`SQL_ASCII`','No encoding validation. Accepts any bytes, so garbage can be stored. Avoid for new systems']]},
{p:'Server encoding is set per database. The **client encoding** (`client_encoding`) can differ, and the server converts between them automatically.'},
{h:'Locale and collation'},
{t:[['Setting','Controls'],['`LC_COLLATE`','Sort order of text (`ORDER BY`, `<`, `>`, B-tree index order)'],['`LC_CTYPE`','Which characters are letters, digits, upper or lower case'],['`lc_messages`, `lc_monetary`, `lc_numeric`, `lc_time`','Language of messages and formatting; can change per session']]},
{h:'Locale providers'},
{t:[['Provider','Source','Characteristics'],['`libc`','Operating system C library','Default. Ordering can change when the OS or glibc is upgraded'],['`icu`','ICU library built into PostgreSQL','Versioned, more consistent across platforms'],['`builtin` (v17+)','PostgreSQL itself','Simple, stable `C` and `C.UTF-8` behaviour, no external dependency']]},
{h:'Why it matters in practice'},
{ul:['**Index use for prefix searches.** `LIKE \'abc%\'` can use a plain B-tree index only under the `C` collation. With another locale create the index with `text_pattern_ops`.','**Uniqueness and sorting** follow the collation. `\'a\'` and `\'A\'` may sort differently between servers.','**Collation version drift.** After an OS upgrade the library may sort differently, silently invalidating text indexes. PostgreSQL records the collation version and warns on mismatch.']},
{code:`SELECT datname, pg_encoding_to_char(encoding) AS encoding,
       datlocprovider, datcollate, datctype
FROM pg_database;

-- different encoding requires template0
CREATE DATABASE legacy TEMPLATE template0 ENCODING 'LATIN1'
  LC_COLLATE 'en_US.iso88591' LC_CTYPE 'en_US.iso88591';

-- after an OS / ICU upgrade shows a version mismatch warning
REINDEX DATABASE appdb;
ALTER DATABASE appdb REFRESH COLLATION VERSION;

-- at cluster creation
initdb -D /pgdata/c3 --encoding=UTF8 --locale=en_US.UTF-8 --locale-provider=icu --icu-locale=en-US`},
{flow:['Plan encoding and locale','Create database from `template0`','Verify in `pg_database`','OS upgrade? check collation version','`REINDEX` then `REFRESH COLLATION VERSION`']},
{note:'You cannot change encoding of an existing database. The only path is dump, create a new database with the right settings, and restore. `pg_upgrade` requires the new cluster to use the same encoding and locale as the old one.'}],
src:[['Character Set Support',D+'multibyte.html'],['Locale Support',D+'locale.html'],['Collation Support',D+'collation.html']]},

/* ---------------------------------------------------------------- 4:9 bonus */
'pg:4:9':{blocks:[
{p:'To size, tune and vacuum tables intelligently you need to know how a row is stored. PostgreSQL keeps table data in a **heap**: a file divided into fixed **8 KB pages**, each holding many rows.'},
{h:'Anatomy of a page'},
{t:[['Part','Contents'],['Page header (24 bytes)','LSN of last change, checksum, pointers to free space'],['Line pointer array','Small entries that point to each row, growing from the top'],['Free space','The gap between pointers and rows'],['Row versions (tuples)','Stored from the bottom up. Each has a **header** with `xmin`, `xmax`, `ctid` and flags, followed by column data']]},
{code:`SELECT ctid, xmin, xmax, * FROM orders LIMIT 5;
-- ctid = (page number, line pointer), xmin = creating transaction, xmax = deleting/locking one`},
{h:'UPDATE and DELETE leave dead rows'},
{p:'Because of MVCC, an `UPDATE` writes a **new row version** and marks the old one as ended by that transaction. A `DELETE` only marks the row. Old versions remain until no running transaction can still see them; then they are **dead tuples**. If dead space is not reclaimed the table grows: this is **bloat**.'},
{flow:['UPDATE writes new version','Old version still visible to older snapshots','Snapshots finish','Old version is dead','VACUUM marks space reusable']},
{ul:['**HOT updates** (heap-only tuples): if no indexed column changes and there is room in the same page, the new version stays in the page without touching indexes. A lower `fillfactor` (for example 80) leaves room for this.','The **free space map** (`_fsm`) tells inserts where space is available; the **visibility map** (`_vm`) marks pages whose rows are all visible, allowing index-only scans and letting VACUUM skip them.']},
{h:'VACUUM, ANALYZE and VACUUM FULL'},
{t:[['Command','What it does','Lock','Returns space to OS'],['`VACUUM`','Removes dead tuples, updates FSM/VM, freezes old rows','Does not block reads or writes','Only trailing empty pages'],['`VACUUM (ANALYZE)`','Same, plus refreshes planner statistics','Same','Same'],['`ANALYZE`','Refreshes statistics only','Light','No'],['`VACUUM FULL`','Rewrites the whole table into a new file','`ACCESS EXCLUSIVE` (blocks everything)','Yes, fully'],['`autovacuum`','Runs the above automatically in the background','Same as VACUUM','Same as VACUUM']]},
{code:`VACUUM (VERBOSE, ANALYZE) orders;

SELECT relname, n_live_tup, n_dead_tup,
       round(100.0*n_dead_tup/nullif(n_live_tup+n_dead_tup,0),1) AS dead_pct,
       last_vacuum, last_autovacuum, last_analyze
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;

-- accurate bloat numbers (contrib)
CREATE EXTENSION pgstattuple;
SELECT * FROM pgstattuple('public.orders');`},
{h:'TOAST: storing large values'},
{p:'A row must fit in a page, so values larger than about **2 KB** are compressed and/or moved to a hidden **TOAST table** (The Oversized-Attribute Storage Technique). The main row keeps a small pointer. This is automatic.'},
{t:[['Strategy','Meaning'],['`PLAIN`','Never compress or move out of line'],['`EXTENDED`','Compress, then move out of line (default for text, bytea, jsonb)'],['`EXTERNAL`','Move out of line without compressing; faster substring access'],['`MAIN`','Compress, move out only as a last resort']]},
{h:'Transaction ID wraparound (why autovacuum is not optional)'},
{p:'Row versions are stamped with a 32-bit transaction ID. After about 2 billion transactions the numbering would wrap and old rows would appear to be in the future. VACUUM prevents this by **freezing** old rows. If the age of a database approaches the limit, PostgreSQL forces aggressive vacuums and finally stops accepting writes.'},
{code:`SELECT datname, age(datfrozenxid) AS xid_age FROM pg_database ORDER BY 2 DESC;
SHOW autovacuum_freeze_max_age;       -- default 200000000`},
{note:'Long-open transactions, abandoned replication slots and prepared transactions hold back the "oldest visible" horizon. VACUUM then cannot remove rows and bloat grows. Always look for them first when a table keeps growing.'}],
src:[['Database Page Layout',D+'storage-page-layout.html'],['TOAST',D+'storage-toast.html'],['Routine Vacuuming',D+'routine-vacuuming.html'],['VACUUM',D+'sql-vacuum.html'],['pgstattuple',D+'pgstattuple.html']]},

/* ---------------------------------------------------------------- 4:10 bonus */
'pg:4:10':{blocks:[
{p:'PostgreSQL\'s **cumulative statistics system** collects counters about activity (rows read, blocks hit, scans, vacuums, WAL, I/O) and exposes them as `pg_stat_*` views. Since v15 they live in **shared memory** (the old stats collector process is gone) and are saved at clean shutdown. Counters only grow, so compare two readings or reset them to measure an interval.'},
{h:'The views to know'},
{t:[['View','Tells you'],['`pg_stat_activity`','Current sessions and what they run'],['`pg_stat_database`','Per database: commits, rollbacks, blocks read vs hit, deadlocks, temp files'],['`pg_stat_user_tables`','Per table: sequential vs index scans, inserts/updates/deletes, dead tuples, vacuum times'],['`pg_stat_user_indexes`','Per index: number of scans (find unused indexes)'],['`pg_statio_user_tables`','Per table: heap and index block hits vs reads'],['`pg_stat_checkpointer` (v17+) / `pg_stat_bgwriter`','Checkpoint counts and timing; background writer activity'],['`pg_stat_wal`','WAL records, bytes, full-page images'],['`pg_stat_io` (v16+)','I/O by backend type and context'],['`pg_stat_replication`','Standbys connected and their lag'],['`pg_stat_statements`','Per-query statistics (extension)'],['`pg_locks`','Locks held and awaited'],['`pg_stat_progress_*`','Live progress of VACUUM, CREATE INDEX, CLUSTER, base backup, COPY']]},
{h:'Ready-to-use health queries'},
{code:`-- 1. buffer cache hit ratio per database (aim for > 99% on OLTP)
SELECT datname,
       round(100.0*blks_hit/nullif(blks_hit+blks_read,0),2) AS hit_pct,
       xact_commit, xact_rollback, deadlocks, temp_files
FROM pg_stat_database WHERE datname IS NOT NULL;

-- 2. tables read mostly by sequential scan (index candidates)
SELECT relname, seq_scan, idx_scan, n_live_tup
FROM pg_stat_user_tables
WHERE seq_scan > 100 AND n_live_tup > 10000
ORDER BY seq_tup_read DESC LIMIT 10;

-- 3. indexes never used since stats reset (review before dropping)
SELECT s.schemaname, s.relname, s.indexrelname, s.idx_scan,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.idx_scan = 0 AND NOT i.indisunique
ORDER BY pg_relation_size(s.indexrelid) DESC;

-- 4. oldest open transactions
SELECT pid, usename, state, now()-xact_start AS xact_age, left(query,50)
FROM pg_stat_activity WHERE xact_start IS NOT NULL ORDER BY xact_start LIMIT 5;

-- 5. live progress of a running VACUUM
SELECT relid::regclass, phase, heap_blks_total, heap_blks_scanned, heap_blks_vacuumed
FROM pg_stat_progress_vacuum;`},
{h:'Controlling statistics collection'},
{t:[['Parameter','Default','Purpose'],['`track_counts`','on','Row and block counters. Autovacuum needs it'],['`track_activities`','on','Shows current command in `pg_stat_activity`'],['`track_io_timing`','off','Adds read/write timing. Small overhead; test with `pg_test_timing`'],['`track_functions`','none','`pl` or `all` to track function calls'],['`stats_fetch_consistency`','cache','Whether repeated reads in a transaction give a stable snapshot']]},
{code:`SELECT pg_stat_reset();                    -- current database counters
SELECT pg_stat_reset_shared('bgwriter');   -- cluster-wide counters
SELECT stats_reset FROM pg_stat_database WHERE datname = current_database();`},
{note:'Always read a counter together with its `stats_reset` time. "Zero scans" of an index means nothing if statistics were reset an hour ago.'}],
src:[['The Cumulative Statistics System',D+'monitoring-stats.html'],['Progress Reporting',D+'progress-reporting.html'],['pg_locks',D+'view-pg-locks.html'],['Statistics Collection settings',D+'runtime-config-statistics.html']]}

});
})();
