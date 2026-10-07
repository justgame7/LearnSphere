/* LearnSphere lesson content. Key = courseId:sectionIndex:lectureIndex */
const D='https://www.postgresql.org/docs/current/';
window.LESSONS={
'pg:0:0':{blocks:[
{p:'This course takes you from zero to a working **PostgreSQL DBA**: installing the server, understanding how it runs, securing it, backing it up, tuning it and replicating it.'},
{h:'Course roadmap'},
{flow:['Install & connect','Architecture (processes, memory, WAL)','Storage & configuration','Users & security','Backup & recovery','Upgrade & replication']},
{h:'What you will be able to do'},
{ul:['Install PostgreSQL from source, yum, RPM or the Windows GUI installer.','Explain what the postmaster, backends, shared buffers and WAL do.','Create roles with least privilege and lock down `pg_hba.conf`.','Take logical (`pg_dump`) and physical (`pg_basebackup`) backups and restore them.','Upgrade with `pg_upgrade` and build a streaming-replication standby.']},
{note:'Tip: practise on a throwaway VM (VirtualBox is fine). Every lesson has commands you should run yourself.'}],
src:[['PostgreSQL documentation',D]]},

'pg:0:1':{blocks:[
{p:'PostgreSQL is an open-source **object-relational database management system** with more than 35 years of active development. It is known for correctness, standards compliance and extensibility.'},
{h:'Core strengths'},
{t:[['Feature','What it means'],['ACID','Transactions are atomic, consistent, isolated and durable (durability comes from WAL).'],['MVCC','Readers never block writers: each transaction sees a snapshot, old row versions are cleaned by VACUUM.'],['Extensibility','Custom types, operators, index methods, procedural languages and extensions (e.g. `pg_stat_statements`).'],['Security','Roles, GRANT/REVOKE, row-level security, SCRAM authentication, TLS.'],['Scalability','Partitioning, parallel query, streaming and logical replication.']]},
{h:'How MVCC works in one picture'},
{flow:['UPDATE creates a new row version','Old version stays visible to older snapshots','Snapshots end','VACUUM reclaims dead tuples']},
{h:'Client / server model'},
{p:'One server process (the postmaster) listens on a port (default `5432`). Each client connection gets its own backend process. All data lives in a single **cluster**, a data directory containing databases.'},
{code:`psql -U postgres -c "SELECT version();"`}],
src:[['About PostgreSQL',D+'intro-whatis.html'],['Concurrency control (MVCC)',D+'mvcc-intro.html']]},

'pg:0:2':{blocks:[
{p:'A **Database Administrator (DBA)** keeps databases available, fast, safe and recoverable. In PostgreSQL the work splits into a few recurring areas.'},
{t:[['Area','Typical tasks'],['Installation & upgrades','Install, patch, run `pg_upgrade`, plan maintenance windows.'],['Security','Roles, `pg_hba.conf`, TLS, auditing, least privilege.'],['Backup & recovery','Schedule dumps and base backups, test restores, point-in-time recovery.'],['Performance','Memory tuning, indexing, autovacuum, query analysis.'],['Availability','Streaming replication, failover, monitoring and alerting.'],['Capacity','Disk growth, bloat, connection limits.']]},
{h:'PostgreSQL vs Oracle vs SQL Server'},
{t:[['','PostgreSQL','Oracle','SQL Server'],['License','Open source (PostgreSQL License)','Commercial','Commercial (free Express tier)'],['Platforms','Linux, Windows, macOS, BSD','Linux, Windows, Unix','Windows, Linux'],['Concurrency','MVCC','MVCC (undo segments)','Locking + optional row versioning'],['HA','Built-in streaming replication','Data Guard / RAC (extra cost)','Always On (edition-dependent)']]},
{note:'The golden rule of DBA work: a backup you have never restored is not a backup.'}],
src:[['Server Administration',D+'admin.html']]},

'pg:1:0':{blocks:[
{p:'There are four routes to a running server. Choose by environment, not preference.'},
{t:[['Method','Best for','Pros','Cons'],['Windows GUI installer','Learning, dev machines','Wizard, bundles pgAdmin','Not for production Linux fleets'],['Package (yum/dnf, RPM)','Production Linux','Easy patching, service files, repos','Version tied to repo'],['Source build','Custom options, newest code','Full control (`--prefix`, `--with-*`)','You maintain everything'],['Containers','Disposable environments','Fast, reproducible','Needs volume/backup planning']]},
{h:'Decision flow'},
{flow:['Windows desktop? → GUI installer','Production Linux? → yum/dnf repo','Need a specific build option? → source','Pinned version & no repo? → RPM files']},
{h:'Practice environment'},
{ul:['Install Linux (e.g. AlmaLinux/Rocky) in VirtualBox.','Connect with PuTTY (SSH terminal) and WinSCP (file transfer).','Take a VM snapshot before each install experiment.']},
{note:'The official docs: Chapter 16 covers binaries, Chapter 17 covers source builds.'}],
src:[['Installation from Source Code',D+'installation.html'],['Download page','https://www.postgresql.org/download/']]},

'pg:1:1':{blocks:[
{p:'Building from source gives full control over install location and compile-time features. Use it when packages do not fit. PostgreSQL supports two build systems: **Autoconf + make** and **Meson**.'},
{h:'Procedure (Autoconf)'},
{flow:['Install build tools & libraries','Download & unpack source','configure','make','make install','Create postgres user & data dir','initdb','Start server']},
{code:`# 1. dependencies (RHEL family)
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y readline-devel zlib-devel openssl-devel

# 2. build
tar xzf postgresql-18.x.tar.gz && cd postgresql-18.x
./configure --prefix=/usr/local/pgsql --with-openssl
make -j4
sudo make install

# 3. user and data directory
sudo useradd postgres
sudo mkdir -p /usr/local/pgsql/data
sudo chown postgres /usr/local/pgsql/data

# 4. initialise and start (as postgres)
sudo -u postgres /usr/local/pgsql/bin/initdb -D /usr/local/pgsql/data
sudo -u postgres /usr/local/pgsql/bin/pg_ctl -D /usr/local/pgsql/data -l logfile start`},
{h:'Common configure options'},
{t:[['Option','Effect'],['`--prefix=PATH`','Install location (default `/usr/local/pgsql`)'],['`--with-openssl`','Enable TLS connections'],['`--with-python` / `--with-perl`','Build PL/Python, PL/Perl'],['`--enable-debug`','Keep debug symbols'],['`--with-llvm`','JIT compilation']]},
{h:'Meson alternative'},
{code:`meson setup build --prefix=/usr/local/pgsql
cd build && ninja && sudo ninja install`},
{h:'Post-install'},
{ul:['Add `/usr/local/pgsql/bin` to `PATH` and set `PGDATA`.','Register shared libraries (`ldconfig`) if installed outside standard paths.','Source builds have no service file: create a systemd unit yourself.']},
{note:'Never run the server as root. PostgreSQL refuses to start as root by design.'}],
src:[['Chapter 17: Installation from Source Code',D+'installation.html'],['Post-installation setup',D+'install-post.html']]},

'pg:1:2':{blocks:[
{p:'On RHEL-family systems the official **PGDG repository** supplies the newest major versions as packages named `postgresqlNN-*`, installed side by side under `/usr/pgsql-NN`.'},
{flow:['Add PGDG repo','Disable distro postgresql module','Install server package','initdb','Enable & start service','Verify']},
{code:`sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
sudo dnf -qy module disable postgresql
sudo dnf install -y postgresql18-server

sudo /usr/pgsql-18/bin/postgresql-18-setup initdb
sudo systemctl enable --now postgresql-18

sudo -u postgres psql -c "SELECT version();"
sudo -u postgres psql -c "SHOW data_directory;"`},
{h:'Where things live'},
{t:[['Item','Path'],['Binaries','`/usr/pgsql-18/bin`'],['Data directory','`/var/lib/pgsql/18/data`'],['Config files','`postgresql.conf`, `pg_hba.conf` inside the data directory'],['Service','`postgresql-18.service`']]},
{note:'Commands use the EL-9 repo URL; adjust `EL-9` and architecture to your OS. Check the PGDG page for the exact link.'}],
src:[['PostgreSQL Yum Repository','https://yum.postgresql.org/'],['Installation from Binaries',D+'install-binaries.html']]},

'pg:1:3':{blocks:[
{p:'Installing from downloaded `.rpm` files suits air-gapped servers or tightly pinned versions. Unlike `dnf` with a repo, you must supply the packages and resolve dependencies yourself (or let `dnf localinstall` do it).'},
{h:'Packages'},
{t:[['Package','Provides'],['`postgresql18-libs`','Shared client libraries (needed first)'],['`postgresql18`','Client programs (`psql`, `pg_dump`)'],['`postgresql18-server`','Server binaries and service file'],['`postgresql18-contrib`','Extra modules and extensions']]},
{code:`sudo rpm -ivh postgresql18-libs-*.rpm
sudo rpm -ivh postgresql18-*.rpm
sudo rpm -ivh postgresql18-server-*.rpm

sudo /usr/pgsql-18/bin/postgresql-18-setup initdb
sudo systemctl enable --now postgresql-18
rpm -qa | grep postgresql      # verify`},
{h:'Install order'},
{flow:['libs','client','server','initdb','start & verify']},
{note:'Use `rpm -Uvh` to upgrade minor versions of the same major release.'}],
src:[['PostgreSQL Yum Repository','https://yum.postgresql.org/']]},

'pg:1:4':{blocks:[
{p:'The graphical installer for Windows is the officially recommended binary route. It installs the server as a Windows service, plus tools.'},
{flow:['Download installer','Choose components','Install & data directories','Set postgres password','Port 5432','Locale','Install','Verify']},
{h:'Components'},
{t:[['Component','Purpose'],['PostgreSQL Server','The database service'],['pgAdmin 4','Graphical admin tool'],['Command Line Tools','`psql`, `pg_dump`, ...'],['Stack Builder','Optional add-ons and drivers']]},
{h:'Production-minded choices'},
{ul:['Keep the default port `5432` unless it is in use.','Choose a strong password for the `postgres` superuser and store it safely.','Put the data directory on a dedicated, backed-up disk if possible.','Allow only required firewall access.']},
{h:'Verify'},
{code:`psql -U postgres -h localhost -p 5432
SELECT version();
SHOW data_directory;`},
{note:'Default data directory is under `C:\\Program Files\\PostgreSQL\\NN\\data`.'}],
src:[['Download page','https://www.postgresql.org/download/windows/']]},

'pg:1:5':{blocks:[
{p:'Uninstalling safely means protecting the data first. Removing binaries does not always remove data, and removing data is irreversible.'},
{flow:['Verify what is installed','pg_dumpall backup','Stop the server','Remove via original method','Clean leftovers (optional)']},
{code:`# 1. know what you have
psql -U postgres -c "SELECT version();"
rpm -qa | grep -i postgres

# 2. back up everything
pg_dumpall -U postgres -f /backup/all.sql

# 3. stop
sudo systemctl stop postgresql-18`},
{h:'Remove by installation method'},
{t:[['Method','Command','Data directory'],['yum / dnf','`sudo dnf remove postgresql18*`','Kept (`/var/lib/pgsql/18`)'],['RPM','`sudo rpm -e postgresql18-server postgresql18 postgresql18-libs`','Kept'],['Source','`sudo make uninstall` in source tree','Kept'],['Windows','Apps & features uninstaller','Often kept, remove manually']]},
{note:'Only delete the data directory after confirming your backup restores.'}],
src:[['pg_dumpall',D+'app-pg-dumpall.html'],['Installation from Binaries',D+'install-binaries.html']]}
};
