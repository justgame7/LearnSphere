/* LearnSphere: extended lessons for sections 1-4 (merged into window.LESSONS) + bonus lectures */
(function(){
const D='https://www.postgresql.org/docs/current/';
const dg=(w,h,B,A)=>{const t=(x,y,l)=>l.split('|').map((s,i,a)=>`<text x="${x}" y="${y+(i-(a.length-1)/2)*14}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="var(--tx)">${s}</text>`).join('');
return `<svg viewBox="0 0 ${w} ${h}" font-family="Space Grotesk,sans-serif"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--accent)"/></marker></defs>`+
B.map(([x,y,bw,bh,l,k])=>k==1?`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="12" fill="none" stroke="var(--accent)" stroke-dasharray="5 4"/><text x="${x+10}" y="${y+16}" font-size="11" fill="var(--accent)">${l}</text>`:`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="9" fill="${k==2?'color-mix(in srgb,var(--accent) 22%,var(--panel2))':'var(--panel2)'}" stroke="var(--line)"/>`+t(x+bw/2,y+bh/2,l)).join('')+
A.map(([a,b,c,d])=>`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#ah)"/>`).join('')+'</svg>'};

const archSvg=dg(700,400,[
[400,70,290,170,'Shared memory',1],
[10,125,110,50,'Client|(psql / app)',0],[180,15,170,40,'postmaster',2],[180,125,170,50,'Backend process|one per connection',2],
[415,100,125,45,'shared_buffers',0],[550,100,125,45,'WAL buffers',0],[415,165,125,45,'CLOG / SLRU',0],[550,165,125,45,'Lock tables',0],
[10,265,125,40,'checkpointer',0],[145,265,125,40,'bgwriter',0],[280,265,125,40,'WAL writer',0],[415,265,125,40,'autovacuum|launcher',0],[550,265,125,40,'archiver',0],
[10,345,330,40,'Data files (base/, global/)',2],[360,345,330,40,'WAL files (pg_wal/)',2]],
[[120,150,180,150],[265,55,265,125],[350,150,415,150],[545,240,545,265],[72,305,72,345],[207,305,150,345],[342,305,500,345],[477,305,520,345],[612,305,612,345]]);
const memSvg=dg(700,210,[
[10,10,340,190,'Shared memory (all processes)',1],[380,10,310,190,'Local memory (per backend)',1],
[30,40,140,60,'shared_buffers|8 KB page cache',2],[190,40,140,60,'WAL buffers',0],[30,120,140,50,'CLOG / SLRU caches',0],[190,120,140,50,'Lock tables|proc array',0],
[400,40,130,50,'work_mem|sort / hash',2],[550,40,125,50,'maintenance_|work_mem',0],[400,110,130,50,'temp_buffers',0],[550,110,125,50,'Catalog and|plan caches',0]],
[[380,105,350,105]]);
const walSvg=dg(700,210,[
[10,70,110,50,'Backend|(COMMIT)',0],[160,70,110,50,'WAL buffers',2],[310,70,110,50,'WAL segment|pg_wal/',2],[460,140,110,50,'shared_buffers|dirty pages',0],[580,70,110,50,'Data files|base/',2]],
[[120,95,160,95],[270,95,310,95],[65,120,460,165],[570,165,635,120]]);

window.EXTRA_LECTURES={
0:[['PostgreSQL Versions and Release Cycle','0:00','Major and minor versions, yearly releases, 5-year support window and upgrade paths.']],
1:[['Post-Installation Checklist','0:00','What to verify and configure after any installation method.']],
2:[['Configuration Files: postgresql.conf and pg_hba.conf','0:00','The files that control server behaviour and client authentication.'],['psql Essentials','0:00','Connection options and the meta-commands every DBA uses daily.']],
3:[['Life of a Query: Read and Write Path','0:00','How a SELECT and an UPDATE travel through memory, WAL and disk.'],['PGDATA Directory Layout','0:00','What each folder and file in the data directory is for.']]
};

Object.assign(window.LESSONS,{
'pg:0:3':{blocks:[
{p:'PostgreSQL follows a predictable calendar. Knowing it tells you **which version to install, how long it is supported, and what an upgrade involves**.'},
{h:'Version numbers'},
{t:[['Format','Example','Meaning'],['Major.minor (v10 and later)','`18.1`','`18` = major release, `.1` = minor (bug and security fixes only)'],['Older scheme (before v10)','`9.6.24`','`9.6` was the major release, `.24` the minor']]},
{ul:['A **major** release arrives about once a year (around September) and may change on-disk format.','**Minor** releases come roughly quarterly and are always safe in-place updates.','Each major version is supported for **5 years** after its first release, then reaches end of life (EOL).']},
{h:'Which upgrade type?'},
{flow:['Minor (18.1 → 18.2)','Install new binaries','Restart server','Done: same data directory']},
{flow:['Major (17 → 18)','Install new binaries side by side','`pg_upgrade` or dump/restore','Test, then switch']},
{code:`SHOW server_version;
SELECT version();`},
{note:'Always read the release notes of every version you skip when planning a major upgrade. Official policy: postgresql.org/support/versioning.'}],
src:[['Versioning policy','https://www.postgresql.org/support/versioning/'],['Release notes',D+'release.html']]},

'pg:1:6':{blocks:[
{p:'Whatever method you used, finish with the same checklist. A server that merely starts is not yet a server ready for use.'},
{t:[['Check','How','Why'],['Correct version','`SELECT version();`','Confirms the binaries you intended'],['Data directory','`SHOW data_directory;`','Know what to back up'],['Config files','`SHOW config_file;` `SHOW hba_file;`','Where to edit settings'],['Service starts at boot','`systemctl is-enabled postgresql-18`','Survives reboots'],['Superuser password','`ALTER ROLE postgres PASSWORD \'...\';`','No password means local-only trust'],['Listening address','`SHOW listen_addresses;`','Default is `localhost` only'],['Locale and encoding','`\\l`','Hard to change later'],['Logging enabled','`SHOW logging_collector;`','You need logs when things fail'],['First backup','`pg_dumpall -f all.sql`','Baseline before any real data']]},
{flow:['Verify version','Set passwords','Review `pg_hba.conf`','Enable logging','Configure firewall','Take first backup']},
{note:'Run PostgreSQL as the non-root `postgres` OS user and keep the data directory permissions at `0700` (`0750` is also accepted); the server refuses to start with looser permissions.'}],
src:[['Post-installation setup',D+'install-post.html']]},

'pg:2:0':{blocks:[
{p:'By default PostgreSQL accepts connections only from the same machine. To use **pgAdmin on Windows** against a **Linux server**, three layers must all allow the connection: the network/firewall, the server listener, and client authentication.'},
{flow:['Server listens on a network address','Firewall allows port 5432','`pg_hba.conf` allows the client','Role has a password','Register server in pgAdmin']},
{h:'Step by step (on the Linux server)'},
{code:`# 1. listen on the network (postgresql.conf), needs restart
listen_addresses = '*'

# 2. allow the client subnet (pg_hba.conf), needs reload
host    all    all    192.168.1.0/24    scram-sha-256

# 3. open the firewall
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --reload

# 4. apply and verify
sudo systemctl restart postgresql-18
ss -ltnp | grep 5432
psql -h 192.168.1.50 -U postgres -c "SELECT 1"`},
{h:'Register in pgAdmin 4'},
{ul:['Right-click **Servers → Register → Server**.','General tab: any name. Connection tab: server IP, port `5432`, maintenance database `postgres`, username and password.','Save: the server tree appears if the connection works.']},
{h:'Troubleshooting'},
{t:[['Error','Likely cause','Fix'],['Connection refused','Service down, or `listen_addresses` is `localhost`','Start service, set `listen_addresses`, restart'],['Timeout','Firewall or network route','Open port 5432, test with `telnet`'],['no pg_hba.conf entry','No matching rule for client IP, user, database','Add a `host` line and reload'],['password authentication failed','Wrong password or no password set','`ALTER ROLE ... PASSWORD`']]},
{note:'Never use `0.0.0.0/0` with `trust` on a reachable network. Restrict the CIDR to your admin subnet.'}],
src:[['Connections and Authentication',D+'runtime-config-connection.html'],['The pg_hba.conf File',D+'auth-pg-hba-conf.html']]},

'pg:2:1':{blocks:[
{p:'A **cluster** is one data directory managed by one postmaster. You can run several clusters on one machine (different versions or isolated workloads) as long as each has its **own data directory and port**.'},
{t:[['Must be unique per cluster','Example cluster 1','Example cluster 2'],['Data directory (`PGDATA`)','`/var/lib/pgsql/18/data`','`/pgdata/cluster2`'],['Port','`5432`','`5433`'],['Service name','`postgresql-18`','`postgresql-18-c2`'],['Log location','default','own `log_directory`']]},
{flow:['Create directory','`initdb`','Set unique port','Create service','Start','Connect with `-p`']},
{code:`sudo mkdir -p /pgdata/cluster2 && sudo chown postgres:postgres /pgdata/cluster2
sudo chmod 700 /pgdata/cluster2
sudo -u postgres /usr/pgsql-18/bin/initdb -D /pgdata/cluster2

echo "port = 5433" | sudo -u postgres tee -a /pgdata/cluster2/postgresql.conf

# systemd unit based on the packaged one
sudo cp /usr/lib/systemd/system/postgresql-18.service /etc/systemd/system/postgresql-18-c2.service
#   edit: Environment=PGDATA=/pgdata/cluster2
sudo systemctl daemon-reload
sudo systemctl enable --now postgresql-18-c2

psql -p 5433 -U postgres -c "SHOW data_directory;"`},
{ul:['Each cluster has its own users, databases, WAL and config. Nothing is shared.','Size `shared_buffers` per cluster so the total fits in RAM.','Debian/Ubuntu users have `pg_lsclusters` and `pg_createcluster` as wrappers around the same idea.']}],
src:[['Creating a Database Cluster',D+'creating-cluster.html']]},

'pg:2:2':{blocks:[
{p:'Stopping the server cleanly matters: a clean stop writes a shutdown checkpoint, so the next start needs **no crash recovery**.'},
{t:[['Mode','Signal','Behaviour','Next start'],['smart','SIGTERM','Blocks new connections, waits for all sessions to disconnect','Clean'],['fast','SIGINT','Rolls back active transactions, disconnects clients, then checkpoints','Clean'],['immediate','SIGQUIT','Aborts all processes with no checkpoint','Crash recovery (WAL replay)']]},
{note:'`pg_ctl stop` defaults to **fast** (since PostgreSQL 9.5), not smart. Smart can hang forever on an idle but open session.'},
{flow:['`CHECKPOINT;` (optional, shortens stop)','`pg_ctl stop -m fast`','Verify with `pg_ctl status`','Start again']},
{code:`pg_ctl -D $PGDATA stop -m fast
pg_ctl -D $PGDATA stop -m immediate   # last resort
sudo systemctl stop postgresql-18      # service stop (fast)`},
{h:'Restart vs reload'},
{t:[['Action','Command','Applies'],['Reload','`pg_ctl reload` or `SELECT pg_reload_conf();`','Parameters with context `sighup`, and `pg_hba.conf`'],['Restart','`pg_ctl restart -m fast`','Parameters with context `postmaster` (e.g. `shared_buffers`)']]}],
src:[['Server Shutdown',D+'server-shutdown.html'],['pg_ctl',D+'app-pg-ctl.html']]},

'pg:2:3':{blocks:[
{p:'Server behaviour is controlled by a few plain-text files, all inside `PGDATA` by default.'},
{t:[['File','Purpose','Change takes effect'],['`postgresql.conf`','Main settings: memory, ports, logging, WAL','Reload or restart (per parameter)'],['`postgresql.auto.conf`','Written by `ALTER SYSTEM`; overrides the main file','Reload or restart'],['`pg_hba.conf`','Host-based authentication: who may connect from where','Reload'],['`pg_ident.conf`','Maps OS or external user names to database roles','Reload']]},
{h:'pg_hba.conf format'},
{p:'Each line has the form `TYPE DATABASE USER ADDRESS METHOD`. Rules are checked **top to bottom and the first match wins**.'},
{code:`# TYPE  DATABASE  USER      ADDRESS          METHOD
local   all       postgres                   peer
host    all       all       127.0.0.1/32     scram-sha-256
host    appdb     appuser   10.0.0.0/24      scram-sha-256
host    all       all       0.0.0.0/0        reject`},
{t:[['Method','Meaning'],['`trust`','Allow with no password. Unsafe outside a lab'],['`scram-sha-256`','Password check with SCRAM. Recommended'],['`md5`','Legacy password hashing, deprecated'],['`peer`','Local only: OS user name must match role'],['`reject`','Always refuse']]},
{code:`SHOW config_file;
SHOW hba_file;
SELECT line_number, type, database, user_name, address, auth_method
FROM pg_hba_file_rules;     -- also shows syntax errors`}],
src:[['Configuration file',D+'config-setting.html'],['pg_hba.conf',D+'auth-pg-hba-conf.html']]},

'pg:2:4':{blocks:[
{p:'`psql` is the interactive terminal for PostgreSQL. Its **meta-commands** start with a backslash and are handled by psql itself, not the server.'},
{h:'Connecting'},
{code:`psql -h 192.168.1.50 -p 5432 -U appuser -d appdb
psql "postgresql://appuser@192.168.1.50:5432/appdb"
export PGHOST=192.168.1.50 PGPORT=5432 PGUSER=appuser PGDATABASE=appdb
psql   # picks up the variables`},
{p:'Store passwords in `~/.pgpass` (format `host:port:db:user:password`, mode `0600`) instead of typing them.'},
{h:'Meta-commands'},
{t:[['Command','Shows'],['`\\l`','Databases'],['`\\c dbname`','Connect to another database'],['`\\dn`','Schemas'],['`\\dt` / `\\dt+`','Tables (with sizes)'],['`\\d table`','Columns, indexes, constraints'],['`\\du`','Roles'],['`\\dx`','Installed extensions'],['`\\conninfo`','Current connection'],['`\\x`','Toggle expanded output'],['`\\timing`','Show query time'],['`\\i file.sql`','Run a script'],['`\\? / \\h CMD`','Help, SQL syntax help'],['`\\q`','Quit']]}],
src:[['psql',D+'app-psql.html']]},

'pg:3:0':{blocks:[
{p:'PostgreSQL uses a **process-per-connection** model. Every running server is a tree of OS processes, all descended from one parent: the **postmaster**.'},
{svg:archSvg},
{h:'What the postmaster does'},
{flow:['Read `postgresql.conf`, `pg_hba.conf`','Allocate shared memory','Start startup/recovery process','Start background processes','Listen on port 5432','Fork a backend per client']},
{ul:['It does **not** run queries or touch shared data itself, which keeps it very unlikely to crash.','If any child crashes, the postmaster stops the others, resets shared memory and runs crash recovery.','It writes `postmaster.pid` in `PGDATA` (PID, data directory, port, start time) and removes it at clean shutdown.']},
{code:`ps -ef | grep postgres
head -1 $PGDATA/postmaster.pid     # postmaster PID`},
{note:'Stale `postmaster.pid` after a crash can block startup; check no postgres process is running before removing it.'}],
src:[['Architectural fundamentals',D+'tutorial-arch.html'],['Server setup and operation',D+'runtime.html']]},

'pg:3:1':{blocks:[
{p:'A **backend** (also called a server process) serves exactly one client connection. It is forked by the postmaster after the client connects and ends when the client disconnects.'},
{flow:['Client connects (TCP / socket)','Postmaster forks backend','Authentication via `pg_hba.conf`','Attach to shared memory','Query loop until disconnect']},
{h:'Inside the query loop'},
{flow:['Parse (syntax)','Analyze (names, types)','Rewrite (rules, views)','Plan (cheapest path)','Execute']},
{t:[['Stage','Output'],['Parser','Raw parse tree'],['Analyzer','Query tree with resolved tables and columns'],['Rewriter','Query tree after view/rule expansion'],['Planner/optimizer','Execution plan chosen using table statistics'],['Executor','Result rows, buffer reads and writes']]},
{h:'Why connections cost something'},
{ul:['Each backend uses memory (local caches, `work_mem` per operation) and an OS process slot.','`max_connections` (default 100) caps the total. Thousands of clients need a **pooler** such as PgBouncer.']},
{code:`SELECT pid, usename, datname, state, left(query,40) AS query
FROM pg_stat_activity
WHERE backend_type = 'client backend';
SHOW max_connections;`}],
src:[['How connections are established',D+'connect-estab.html'],['Overview of PostgreSQL internals',D+'overview.html']]},

'pg:3:2':{blocks:[
{p:'Besides client backends, the postmaster starts **background processes** that keep the cluster durable, clean and healthy.'},
{t:[['Process','Job'],['startup','Replays WAL during crash recovery or on a standby'],['checkpointer','Periodically flushes all dirty buffers and writes a checkpoint record'],['background writer','Writes some dirty buffers early so backends rarely wait'],['WAL writer','Flushes WAL buffers to disk in the background'],['autovacuum launcher / workers','Remove dead rows, refresh statistics, prevent transaction ID wraparound'],['archiver','Copies completed WAL segments to the archive (when `archive_mode` is on)'],['logger','Collects server logs when `logging_collector = on`'],['WAL sender / receiver','Stream WAL between primary and standby'],['io workers (v18)','Perform asynchronous reads when `io_method = worker`']]},
{note:'Older material mentions a **stats collector** process. It was removed in PostgreSQL 15; statistics now live in shared memory.'},
{code:`SELECT pid, backend_type FROM pg_stat_activity ORDER BY backend_type;
SELECT * FROM pg_stat_bgwriter;
SELECT * FROM pg_stat_checkpointer;   -- v17+`}],
src:[['Monitoring: pg_stat_activity',D+'monitoring-stats.html'],['Resource consumption',D+'runtime-config-resource.html']]},

'pg:3:3':{blocks:[
{p:'PostgreSQL memory is split into **shared memory**, allocated once at startup and used by every process, and **local memory** that each backend allocates for itself.'},
{svg:memSvg},
{t:[['Area','Parameter','Default','Notes'],['Shared buffer cache','`shared_buffers`','128MB','Common starting point: about 25% of RAM. Needs restart'],['WAL buffers','`wal_buffers`','-1 (auto)','About 1/32 of `shared_buffers`'],['Sort / hash memory','`work_mem`','4MB','**Per operation, per query**, so many sessions multiply it'],['Maintenance memory','`maintenance_work_mem`','64MB','VACUUM, CREATE INDEX'],['Temp tables','`temp_buffers`','8MB','Per session'],['Planner hint','`effective_cache_size`','4GB','Not allocated; tells the planner how much OS cache to expect']]},
{h:'How the buffer cache works'},
{ul:['Data files are divided into **8 KB pages**; shared buffers hold copies of those pages.','A backend needing a page checks the buffer mapping: a **hit** returns it, a **miss** reads it from disk (usually via the OS cache).','Modified pages are marked **dirty** and written later by the background writer or checkpointer.','When full, buffers are reused with a **clock-sweep** algorithm that evicts rarely used pages.']},
{code:`SHOW shared_buffers;
SELECT name, setting, unit, context FROM pg_settings
WHERE name IN ('shared_buffers','work_mem','maintenance_work_mem');`}],
src:[['Resource consumption: memory',D+'runtime-config-resource.html#RUNTIME-CONFIG-RESOURCE-MEMORY'],['Reliability and the WAL',D+'wal.html']]},

'pg:3:4':{blocks:[
{p:'**Write-Ahead Logging (WAL)** is the rule that a change must be recorded in the log **before** the data page is written. It gives durability, crash recovery, point-in-time recovery and replication from one mechanism.'},
{svg:walSvg},
{flow:['Backend changes a page in `shared_buffers`','Writes a WAL record to WAL buffers','COMMIT flushes WAL to `pg_wal` (fsync)','Commit returns to client','Checkpointer later writes dirty pages to data files']},
{ul:['Writing WAL is sequential and cheap; writing scattered data pages can wait. That is why commits are fast and still safe.','After a crash, recovery starts at the last checkpoint and **redoes** WAL, restoring every committed change.']},
{t:[['Concept','Detail'],['LSN','Log Sequence Number: a byte position in the WAL stream'],['Segment file','16 MB by default, in `pg_wal/`'],['File name','24 hex characters: timeline (8) + log (8) + segment (8)'],['Checkpoint','Triggered by `checkpoint_timeout` (default 5 min) or `max_wal_size` (default 1GB)'],['`wal_level`','`minimal`, `replica` (default), `logical`'],['`synchronous_commit`','`on` waits for WAL flush; `off` risks losing last transactions but never corrupts']]},
{code:`SELECT pg_current_wal_lsn();
SELECT pg_walfile_name(pg_current_wal_lsn());
CHECKPOINT;
SHOW wal_level;`},
{note:'Never delete files from `pg_wal` by hand. Use archiving settings and replication slots, and let PostgreSQL recycle segments.'}],
src:[['Write-Ahead Logging',D+'wal-intro.html'],['WAL configuration',D+'wal-configuration.html']]},

'pg:3:5':{blocks:[
{p:'Putting the pieces together: this is what happens between pressing Enter and getting a result.'},
{h:'Read path (SELECT)'},
{flow:['Backend parses and plans','Executor asks for a page','Found in `shared_buffers`? → return','Else read 8 KB page from disk into a buffer','Return rows to client']},
{h:'Write path (UPDATE / INSERT / DELETE)'},
{flow:['Find or read the page','Create new row version (MVCC) in buffer, mark page dirty','Write WAL record','COMMIT: flush WAL, mark transaction committed','Checkpointer / bgwriter write page later']},
{t:[['Component','Role in the path'],['Backend','Does the work for the client'],['`shared_buffers`','Caches pages; writes happen here first'],['WAL','Guarantees committed changes survive a crash'],['Checkpointer / bgwriter','Move dirty pages to data files'],['Autovacuum','Removes old row versions left by MVCC'],['Data files','Final home of table and index data']]},
{code:`EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM pg_class LIMIT 10;
-- "shared hit" = found in cache, "read" = fetched from disk`}],
src:[['Concurrency control',D+'mvcc.html'],['Using EXPLAIN',D+'using-explain.html']]},

'pg:3:6':{blocks:[
{p:'`PGDATA` is the cluster directory. Knowing its layout is essential for backups, disk planning and troubleshooting.'},
{t:[['Path','Contents'],['`base/`','One subdirectory per database (named by OID) holding table and index files'],['`global/`','Cluster-wide catalogs such as `pg_database`, `pg_authid`'],['`pg_wal/`','Write-ahead log segments'],['`pg_xact/`','Transaction commit status'],['`pg_tblspc/`','Symbolic links to tablespaces'],['`pg_stat/`','Persisted statistics'],['`pg_replslot/`','Replication slot data'],['`log/`','Server logs (if the log collector is on)'],['`PG_VERSION`','Major version of the cluster'],['`postmaster.pid`','Lock and PID file of the running server'],['`postgresql.conf` etc.','Configuration files']]},
{code:`SELECT oid, datname FROM pg_database;
SELECT pg_relation_filepath('pg_class');      -- e.g. base/5/1259
SELECT pg_size_pretty(pg_database_size(current_database()));`},
{note:'Treat `PGDATA` as a unit: copying individual files from a running cluster gives an inconsistent backup. Use `pg_basebackup` instead.'}],
src:[['Database physical storage',D+'storage.html'],['File layout',D+'storage-file-layout.html']]}
});
})();
