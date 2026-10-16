/* LearnSphere - PostgreSQL patching lectures.
   Lesson keys pg:9:16 .. pg:9:19 (on-premises, appended to 'Upgrade & Replication' through window.EXTRA_LECTURES[9]) and pg:11:16 .. pg:11:18 (Amazon RDS, Aurora and a comparison, appended to 'Amazon RDS and Aurora PostgreSQL').
   Section 12 rows are added in index.html, quiz questions at the end of pg-quiz.js. Needs pg-lesson.js (window.LS_DG) loaded first.
   Commands are examples: package names, identifiers, ARNs and versions are placeholders. AWS behaviour changes: check the current documentation. */
(function(){
const L=window.LESSONS=window.LESSONS||{};
const dg=window.LS_DG;

L['pg:9:16']={blocks:[
{p:'**Patching** means moving to a newer **minor release** of the same major version, for example 17.5 to 17.6. It is the most frequent maintenance task a PostgreSQL DBA has. It is also the easiest: the data files do not change, so you replace the program files and restart. The skill is in planning, testing and doing it without surprises.'},
{h:'Version numbers'},
{p:'Since PostgreSQL 10 a version has two parts: **major.minor**. In `17.6`, **17** is the major version and **6** is the minor release.'},
{svg:dg(640,180,[[20,70,160,54,'17.5|running now',0],[250,18,190,54,'17.6 (minor)|new binaries + restart',2],[250,108,190,54,'18.0 (major)|pg_upgrade or logical',0],[500,18,120,54,'17.6|running',0],[500,108,120,54,'18.0|running',0]],[[180,97,250,45],[180,97,250,135],[440,45,500,45],[440,135,500,135]])},
{t:[['','Minor release (17.5 to 17.6)','Major release (17 to 18)'],['Contents','Bug fixes and security fixes only','New features, changes in behaviour'],['Data directory format','**Same**','Changed (catalogs differ)'],['How you apply it','Install new binaries, restart','`pg_upgrade`, dump and restore, or logical replication'],['Downtime','A restart (seconds to a minute)','Minutes to hours, or near zero with logical replication'],['Risk','Low','Higher: test thoroughly'],['Rollback','Reinstall the older package (usually possible)','Restore a backup or keep the old cluster']]},
{h:'The release schedule and support policy'},
{ul:['**Minor releases** are planned **quarterly**: the second Thursday of February, May, August and November. Serious security or data-loss bugs can trigger an extra release at any time.','Each **major version is supported for five years** from its first release. The last minor release comes in the November of the fifth year. After that the version receives no fixes.','The project advice is simple: **always run the latest minor release of your major version**. The risk of staying on an old minor is usually larger than the risk of updating.','Security fixes are announced with a CVE number and a severity score. A high-severity fix is a reason to patch outside your normal cycle.']},
{h:'What to read before you install'},
{p:'Every minor release has **release notes**. Read the section *Migration to Version X.Y*. It says when something more than a restart is needed.'},
{t:[['The notes say...','What you do after the restart'],['Nothing special','Nothing. Verify the version.'],['Some index types may be corrupt and need `REINDEX`','Run the listed `REINDEX` (use `CONCURRENTLY` where allowed) for the named index types'],['Extension needs an update','`ALTER EXTENSION name UPDATE;` in each database'],['A catalog fix is needed','Run the SQL given in the notes in each database'],['Several minor versions skipped','Read the notes of **every** release in between, not only the last']]},
{h:'What else gets patched'},
{t:[['Layer','Examples','Typical effect'],['PostgreSQL server','postgresql17-server, postgresql-17','Restart of the server'],['Extensions','PostGIS, pg_stat_statements, pgvector, pg_cron','May need a restart (for preloaded libraries) and `ALTER EXTENSION ... UPDATE`'],['Operating system','Kernel, glibc, OpenSSL, ICU','Often a **reboot**. glibc or ICU changes can change **text sorting**, which needs index checks.'],['Connection pooler and HA tools','PgBouncer, Patroni, HAProxy, pgBackRest','Brief connection pause or a controlled switchover'],['Client drivers','libpq, JDBC, psycopg','Application deployment, not a database restart']]},
{note:'**Plan one patch cycle for the whole stack.** A good rhythm is: read the quarterly notes in the week of release, patch the test environment within two weeks, then production in the following window. Emergency security releases skip the wait but never skip the test.'},
{h:'Patching strategy by environment'},
{flow:['Read release notes','Patch dev and test','Run application tests','Back up production','Patch in a window','Verify and record']},
{ul:['**Standalone server:** you accept a short outage. Choose a quiet window and tell users.','**Primary with standbys:** patch standbys first, then switch over. Outage is a few seconds. (Lecture: Rolling Patching with Replication and Patroni.)','**Amazon RDS and Aurora:** AWS delivers the patched version. You choose the version and the window, and test beforehand. (Lectures at the end of Amazon RDS and Aurora PostgreSQL.)']}
],src:[['PostgreSQL versioning policy','https://www.postgresql.org/support/versioning/'],['PostgreSQL release notes','https://www.postgresql.org/docs/release/'],['Upgrading a PostgreSQL cluster','https://www.postgresql.org/docs/current/upgrading.html']]};

L['pg:9:17']={blocks:[
{p:'This lesson patches **one server with no standby**, which means a short outage is unavoidable: PostgreSQL must restart. The steps are the same on every platform. Only the package commands change.'},
{h:'Before you start'},
{ul:['**Read the release notes** of every release between your version and the target.','**Test first.** Apply the same update on a test server with a restored copy of production, then run the application tests.','**Pick a window** and tell users. The outage is normally under a minute, but long transactions and a large checkpoint can make it longer.','**Check free disk space** for new packages and for the WAL that is written during the final checkpoint.','**Take a backup** and confirm the WAL archive is working. Record the time.']},
{code:`-- 1. record where you are
SELECT version();
SHOW data_directory;

-- 2. anything long-running or in danger?
SELECT pid, now() - xact_start AS xact_age, state, left(query, 60)
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start LIMIT 10;

-- 3. are the extensions you use available in the new packages?
SELECT name, installed_version, default_version
FROM pg_available_extensions WHERE installed_version IS NOT NULL;`},
{h:'Update the packages'},
{t:[['Step','Red Hat family (PGDG RPM)','Debian and Ubuntu (PGDG DEB)'],['Refresh package lists','`sudo dnf makecache`','`sudo apt-get update`'],['List what will change','`dnf check-update \'postgresql17*\'`','`apt list --upgradable 2>/dev/null | grep postgresql`'],['Update','`sudo dnf update \'postgresql17*\'`','`sudo apt-get install --only-upgrade postgresql-17 postgresql-client-17`'],['Restart','**Not automatic.** `sudo systemctl restart postgresql-17`','The package usually **restarts the cluster** during the upgrade. Check with `pg_lsclusters`.'],['Hold a version back','`dnf versionlock add postgresql17-server`','`sudo apt-mark hold postgresql-17`']]},
{note:'On Red Hat family systems the new files are on disk but the **old version keeps running** until you restart. Do not leave a server in that state: the server loads new shared libraries for new sessions, while the main process runs old code.'},
{h:'Restart and verify'},
{code:`-- shorten the shutdown (optional)
CHECKPOINT;`},
{code:`# restart (RPM family). Debian: sudo pg_ctlcluster 17 main restart
sudo systemctl restart postgresql-17
sudo systemctl status postgresql-17 --no-pager

# confirm the binary and the running server agree
/usr/pgsql-17/bin/postgres --version
psql -c "SELECT version(), pg_postmaster_start_time();"`},
{ul:['`pg_postmaster_start_time()` must be **after** your restart. If it is not, the old process is still running.','Check the log for new warnings, for example `grep -iE \'warning|fatal|error\' /var/lib/pgsql/17/data/log/*.log | tail`.','If you have a standby, check `pg_stat_replication` on the primary: the standby should be `streaming` again.','Run a quick application smoke test.']},
{h:'After the restart'},
{ul:['**Extensions:** if the new package contains a newer extension version, run `ALTER EXTENSION name UPDATE;` in each database that uses it. `pg_stat_statements` and others usually do not need this for a minor release, but PostGIS and some others do.','**REINDEX:** only if the release notes say so, and only for the named index types. Prefer `REINDEX INDEX CONCURRENTLY`.','**Record** the new version, the time and the person in your change log.']},
{map:{title:'Standalone patching map',h:328,trace:'Patch a standalone server',
 hint:'Tap any box, or press Patch a standalone server to follow a minor update from the checks to the verification.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L118 219 L118 246',[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'pre',x:126,y:24,w:200,h:56,c:'mem',t:'Pre-checks',s:'version, notes, space',d:'Record the current version, read the release notes, check free disk space, replication state and long-running transactions.',why:'Knowing the starting point lets you prove the result and roll back.',chk:`SELECT version();`,see:[9,17,'Minor Version Patching on a Standalone Server (RPM and DEB)']},
 {id:'bk',x:354,y:24,w:200,h:56,c:'disk',t:'Backup',s:'fresh and verified',d:'Take a base backup or confirm that last night\'s backup and the WAL archive are healthy. Note the time.',why:'A minor update is low risk, but it is still a change to a production system.',chk:`pgbackrest --stanza=main info`,see:[9,17,'Minor Version Patching on a Standalone Server (RPM and DEB)']},
 {id:'pkg',x:126,y:136,w:200,h:56,c:'proc',t:'Update packages',s:'dnf or apt',d:'Update the server, client and contrib packages together so that all files are from the same minor release.',why:'Mixed versions of server and library files cause confusing errors.',chk:`sudo dnf update 'postgresql17*'`,see:[9,17,'Minor Version Patching on a Standalone Server (RPM and DEB)']},
 {id:'rs',x:354,y:136,w:200,h:56,c:'warn',t:'Restart',s:'CHECKPOINT then restart',d:'Run `CHECKPOINT` to shorten shutdown, then restart the service. New processes load the new binaries.',why:'Until the restart, the old version is still running even though new files are installed.',chk:`sudo systemctl restart postgresql-17`,see:[9,17,'Minor Version Patching on a Standalone Server (RPM and DEB)']},
 {id:'ver',x:21,y:248,w:194,h:56,c:'mem',t:'Verify',s:'version and start time',d:'Confirm that the running version is the new one, that the server accepts connections and that replication is streaming.',why:'It proves the update took effect, not just that packages installed.',chk:`SELECT version(), pg_postmaster_start_time();`,see:[9,17,'Minor Version Patching on a Standalone Server (RPM and DEB)']},
 {id:'ext',x:243,y:248,w:194,h:56,c:'proc',t:'Post steps',s:'extensions, REINDEX',d:'Do whatever the release notes ask: update extensions, run listed REINDEX commands, check logs for new warnings.',why:'Some fixes only take effect after these steps.',chk:`SELECT name, installed_version, default_version FROM pg_available_extensions WHERE installed_version IS NOT NULL;`,see:[9,17,'Minor Version Patching on a Standalone Server (RPM and DEB)']},
 {id:'rb',x:465,y:248,w:194,h:56,c:'warn',t:'Rollback plan',s:'downgrade or restore',d:'If there is a problem, reinstall the previous package version and restart. If data is affected, restore from backup.',why:'Decide the rollback trigger before you start.',chk:`sudo dnf downgrade 'postgresql17*'`,see:[9,17,'Minor Version Patching on a Standalone Server (RPM and DEB)']}],
 steps:[
 {ids:['pre','bk'],t:'1. Record the version, read the release notes and check disk space, replication lag and long transactions. Take or verify a backup.',w:'A known starting point and a way back.',s:'Backup tool, monitoring.',x:'No backup before changing production.',c:`SELECT version();`},
 {ids:['pkg'],t:'2. Update the server, client and contrib packages in one command.',w:'Consistent files.',s:'Package repository, version lock.',x:'A partial update leaves mixed versions.',c:`sudo dnf update 'postgresql17*'`},
 {ids:['rs'],t:'3. Run CHECKPOINT and restart the service. On Debian and Ubuntu the package may restart the cluster for you. On Red Hat family systems you restart it yourself.',w:'The new binaries are only used after a restart.',s:'`systemctl`, shutdown mode.',x:'Forgetting the restart: the old version keeps running.',c:`sudo systemctl restart postgresql-17`},
 {ids:['ver','ext'],t:'4. Verify the running version and the start time, then do the post steps from the release notes.',w:'Confirms the change and finishes any extra fixes.',s:'Release notes.',x:'Skipping a required REINDEX.',c:`SELECT version(), pg_postmaster_start_time();`},
 {ids:['rb'],t:'5. If something is wrong, downgrade the packages or restore the backup, and record why.',w:'Predictable recovery.',s:'Rollback trigger.',x:'Deciding what to do only after the failure.',c:`sudo dnf downgrade 'postgresql17*'`}]}},
{h:'Rolling back'},
{t:[['Situation','Action'],['New version starts but an application breaks','Downgrade the packages (`dnf downgrade` or `apt-get install postgresql-17=17.5-...`) and restart. Minor releases keep the same data format, so the data directory stays valid.'],['Server does not start','Read the log. Fix the cause if clear, otherwise downgrade packages. The data directory was not changed by the package update.'],['Data is damaged or an unrelated problem appears','Restore from the backup you took, or use point-in-time recovery to a moment before the change.']]},
{note:'A rollback is easy **only if you decided to do it quickly**. Once users have been writing for hours on the new version, a downgrade still works, but any bug-dependent data needs checking. Set a clear trigger and time limit before you start.'}
],src:[['Upgrading a PostgreSQL cluster','https://www.postgresql.org/docs/current/upgrading.html'],['PostgreSQL Yum repository','https://yum.postgresql.org/'],['PostgreSQL APT repository','https://wiki.postgresql.org/wiki/Apt'],['PostgreSQL release notes','https://www.postgresql.org/docs/release/']]};

L['pg:9:18']={blocks:[
{p:'With **streaming replication** you do not need to take the service down to patch. You update the **standbys first**, then move the primary role to an updated server with a **planned switchover**, then update the old primary. Users see one short interruption instead of a full outage.'},
{h:'Why standbys go first'},
{ul:['A standby on a **newer** minor release can replay WAL from a primary on an **older** one. The reverse is not guaranteed.','If an update goes wrong on a standby, **production is untouched**.','Each standby is validated on real traffic (read queries) before it becomes the primary.']},
{t:[['Step','Plain streaming replication','Patroni cluster'],['Check health','`SELECT * FROM pg_stat_replication;` on the primary','`patronictl list`'],['Stop the standby','`sudo systemctl stop postgresql-17`','`sudo systemctl stop patroni` (Patroni stops PostgreSQL)'],['Update packages','`sudo dnf update \'postgresql17*\'`','same'],['Start the standby','`sudo systemctl start postgresql-17`','`sudo systemctl start patroni`'],['Wait for streaming','Check `pg_stat_replication` on the primary','`patronictl list` shows `streaming` and lag 0'],['Switch role','On the standby: `pg_ctl promote` after stopping the old primary (or use your tooling)','`patronictl switchover --candidate node2`'],['Update the old primary','Stop it, update, **rebuild or re-attach it as a standby** (`pg_rewind` if needed)','Patroni re-attaches it automatically. Update as for a standby.']]},
{h:'The order in a three-node cluster'},
{flow:['Check health','Update standby A','Update standby B','Switchover to A','Update old primary','Switch back (optional)']},
{code:`# Patroni: look at the cluster and its lag
patronictl -c /etc/patroni/patroni.yml list

# planned, graceful role change to a patched node
patronictl -c /etc/patroni/patroni.yml switchover --candidate node2 --scheduled now

# need to restart PostgreSQL parameters or binaries on a node without failover?
patronictl -c /etc/patroni/patroni.yml restart main node3`},
{note:'Use **switchover**, not **failover**. A switchover waits until the standby has all the data and then swaps roles with no loss. A failover is for when the primary is already gone and may lose the last transactions.'},
{h:'Keep applications happy'},
{ul:['**Connection pooler:** with PgBouncer, `PAUSE` holds new queries and `RESUME` releases them after the switchover. Clients see a delay, not an error.','**Load balancer or virtual IP:** HAProxy checks the Patroni REST API (`/primary`, `/replica`) and moves traffic to the new primary within seconds.','**Retry logic:** applications should reconnect and retry on a lost connection. Test this before the window, not during it.','**Maintenance mode:** `patronictl pause` stops Patroni from taking automatic actions while you work, which avoids an unwanted failover. Remember `patronictl resume` when you are done.']},
{map:{title:'Rolling patch map',h:328,trace:'Patch with minimal downtime',
 hint:'Tap any box, or press Patch with minimal downtime to follow a rolling update: standbys first, then a switchover, then the old primary.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'chk',x:126,y:24,w:200,h:56,c:'mem',t:'Check health',s:'lag and state',d:'Confirm every standby is streaming and has little lag, and that a backup is recent.',why:'Never start patching an unhealthy cluster.',chk:`SELECT client_addr, state, replay_lag FROM pg_stat_replication;`,see:[9,18,'Rolling Patching with Replication and Patroni (Minimal Downtime)']},
 {id:'sb1',x:354,y:24,w:200,h:56,c:'proc',t:'Patch standby 1',s:'stop, update, start',d:'Stop the standby, update the packages, start it and wait until it streams again.',why:'Standbys can be updated before the primary: a newer standby can replay WAL from an older primary.',chk:`patronictl list`,see:[9,18,'Rolling Patching with Replication and Patroni (Minimal Downtime)']},
 {id:'sb2',x:126,y:136,w:200,h:56,c:'proc',t:'Patch standby 2',s:'same steps',d:'Repeat for each remaining standby, one at a time.',why:'Keeping at least one standby available protects you if something goes wrong.',chk:`patronictl list`,see:[9,18,'Rolling Patching with Replication and Patroni (Minimal Downtime)']},
 {id:'sw',x:354,y:136,w:200,h:56,c:'warn',t:'Switchover',s:'planned role change',d:'Promote a patched standby and demote the old primary in a controlled way. Applications reconnect to the new primary.',why:'A planned switchover loses no data. The pause is seconds.',chk:`patronictl switchover --candidate node2`,see:[9,18,'Rolling Patching with Replication and Patroni (Minimal Downtime)']},
 {id:'old',x:126,y:248,w:200,h:56,c:'proc',t:'Patch old primary',s:'now a standby',d:'The old primary is now a standby. Patch it as in the first step and let it catch up.',why:'All nodes now run the new version.',chk:`patronictl list`,see:[9,18,'Rolling Patching with Replication and Patroni (Minimal Downtime)']},
 {id:'pool',x:354,y:248,w:200,h:56,c:'net',t:'Pooler and clients',s:'pause and resume',d:'A connection pooler such as PgBouncer can hold clients during the switch so they see a pause instead of errors.',why:'It turns an outage into a short wait.',chk:`PAUSE; (in the pgbouncer admin console)`,see:[9,18,'Rolling Patching with Replication and Patroni (Minimal Downtime)']}],
 steps:[
 {ids:['chk','sb1'],t:'1. Check the cluster is healthy, then update the first standby.',w:'Start from a clean state.',s:'Replication lag, slots.',x:'Patching while a standby is lagging.',c:`SELECT client_addr, state, replay_lag FROM pg_stat_replication;`},
 {ids:['sb2'],t:'2. Update the remaining standbys, one at a time, and let each catch up.',w:'One node out at a time.',s:'Standby count.',x:'Taking two standbys out together.',c:`patronictl list`},
 {ids:['sw','pool'],t:'3. Do a planned switchover to a patched standby, optionally pausing the pooler.',w:'A few seconds of interruption.',s:'Switchover timing, pooler.',x:'Applications without retry logic.',c:`patronictl switchover --candidate node2`},
 {ids:['old'],t:'4. Patch the old primary, which is now a standby, and verify the cluster.',w:'The whole cluster is updated.',s:'Version check.',x:'Forgetting the old primary.',c:`patronictl list`}]}},
{h:'Checks at each stage'},
{t:[['Check','Query or command','Healthy result'],['Standby is streaming','`SELECT state, sync_state, replay_lag FROM pg_stat_replication;`','`streaming`, small lag'],['Replication slots are not stuck','`SELECT slot_name, active, restart_lsn FROM pg_replication_slots;`','`active = t`'],['Version on each node','`SELECT version();` on each node','Same minor release at the end'],['WAL archive works','`SELECT * FROM pg_stat_archiver;`','`last_failed_time` is old or empty']]},
{note:'Rehearse this on a **test cluster** first, including the switchover. A rolling patch is safe when everyone has practised it, and stressful when it is the first time.'}
],src:[['High availability, load balancing and replication','https://www.postgresql.org/docs/current/high-availability.html'],['Patroni documentation','https://patroni.readthedocs.io/'],['PgBouncer','https://www.pgbouncer.org/']]};

L['pg:9:19']={blocks:[
{p:'Patching the database is simple. The **side effects** are what cause incidents. This lesson covers three: operating system updates, extension updates and **collation changes**.'},
{h:'Operating system patching'},
{ul:['A kernel or glibc update normally needs a **reboot**. Plan it like a PostgreSQL restart and do it in the same window.','Stop PostgreSQL cleanly (`systemctl stop`) before a reboot so there is no crash recovery to wait for.','On a cluster, patch the OS on **standbys first**, then switch over, then the old primary, exactly like a PostgreSQL patch.','After a reboot check that the service starts by itself (`systemctl is-enabled postgresql-17`), that mounts are present and that the log is clean.']},
{h:'Extension updates'},
{code:`-- which extensions have a newer version available?
SELECT name, installed_version, default_version
FROM pg_available_extensions
WHERE installed_version IS NOT NULL AND installed_version <> default_version;

-- update one (run in each database where it is installed)
ALTER EXTENSION pg_stat_statements UPDATE;`},
{ul:['Extensions listed in `shared_preload_libraries` need a **restart** to load the new library.','**PostGIS** has its own upgrade steps: after updating packages, run `ALTER EXTENSION postgis UPDATE;` and then `SELECT postgis_extensions_upgrade();` if documented for your version.','Always check the extension\'s own release notes. A new extension version can change function behaviour.']},
{h:'Collation changes: the quiet danger'},
{p:'**Collation** decides how text is sorted and compared. PostgreSQL asks the operating system library (glibc, or ICU if you chose it). If an OS update changes the sorting rules, **existing indexes on text columns were built with the old order**. Searches can then miss rows and unique constraints can fail to catch duplicates.'},
{flow:['OS update changes glibc or ICU','Sort order of some strings changes','Existing text indexes no longer match','Wrong results or missed duplicates','REINDEX the affected indexes']},
{t:[['Step','What to do'],['Detect','PostgreSQL 15 and later records the collation version. A warning appears at connect: *database has a collation version mismatch*. Check `SELECT datname, datcollversion FROM pg_database;`'],['Find at risk indexes','Indexes on text, varchar or char columns that use a non-`C` collation'],['Check for damage','`CREATE EXTENSION amcheck;` then `SELECT bt_index_check(index => \'idx_name\'::regclass);`'],['Repair','`REINDEX INDEX CONCURRENTLY idx_name;` (or `REINDEX DATABASE CONCURRENTLY`)'],['Clear the warning','`ALTER DATABASE mydb REFRESH COLLATION VERSION;` **after** the reindex']]},
{note:'**Streaming standbys must run the same collation library as the primary.** If a standby is on a different OS release (different glibc), queries that use an index can give wrong results there. Keep the whole cluster on the same OS release, or use the built-in `C` or ICU collations with fixed versions.'}
],src:[['Collation support','https://www.postgresql.org/docs/current/collation.html'],['amcheck','https://www.postgresql.org/docs/current/amcheck.html'],['ALTER EXTENSION','https://www.postgresql.org/docs/current/sql-alterextension.html']]};

L['pg:11:16']={blocks:[
{p:'On Amazon RDS for PostgreSQL **AWS builds the patch, and you control when and how it reaches your instance**. You do not install packages. You choose the engine version, the maintenance window and whether minor upgrades are automatic. The restart still happens, so you still plan for it.'},
{h:'Two kinds of maintenance'},
{t:[['Kind','Examples','Pending action name','Can you postpone it?'],['**Operating system or host** maintenance','OS patch, host replacement','`system-update`','Often yes for a while, but required items are eventually applied'],['**Database engine** upgrade','17.4 to 17.6 minor version','`db-upgrade`','Yes, if auto minor version upgrade is off. When a version reaches end of life, AWS upgrades you.']]},
{h:'The controls you have'},
{ul:['**Maintenance window:** a weekly period of at least 30 minutes. Required maintenance and automatic minor upgrades are applied here. Choose a quiet time.','**Auto minor version upgrade:** a flag on each instance. When AWS designates a new preferred minor version, instances with the flag set are upgraded in their next window. A common policy is **on for development and test, off for production** with a planned manual upgrade.','**Apply now or later:** a pending action can be applied immediately or left for the window.','**Choose the version:** you can usually upgrade to any supported later minor version of your major version, not only the newest.','**Events:** subscribe to the *maintenance* category so a person is told before and after.']},
{code:`# see what AWS has scheduled
aws rds describe-pending-maintenance-actions \\
  --query 'PendingMaintenanceActions[].{id:ResourceIdentifier,actions:PendingMaintenanceActionDetails[].[Action,AutoAppliedAfterDate]}'

# which versions can this instance move to?
aws rds describe-db-engine-versions --engine postgres --engine-version 17.4 \\
  --query 'DBEngineVersions[0].ValidUpgradeTarget[].[EngineVersion,IsMajorVersionUpgrade]' --output table

# apply a pending action in the next maintenance window, or right now
aws rds apply-pending-maintenance-action --resource-identifier arn:aws:rds:eu-west-1:123456789012:db:pg-prod \\
  --apply-action system-update --opt-in-type next-maintenance
aws rds apply-pending-maintenance-action --resource-identifier arn:aws:rds:eu-west-1:123456789012:db:pg-prod \\
  --apply-action system-update --opt-in-type immediate

# turn automatic minor upgrades on or off
aws rds modify-db-instance --db-instance-identifier pg-prod --no-auto-minor-version-upgrade`},
{h:'What happens to availability'},
{t:[['Deployment','OS maintenance','Engine minor upgrade','Notes'],['**Single-AZ instance**','Instance is unavailable during the update and reboot','Instance restarts: outage of a few minutes is normal','Schedule a window'],['**Multi-AZ instance** (one standby)','Rolling: standby first, then a failover, then the old primary. Short interruption.','Plan for an outage of a few minutes. Test the duration.','Reconnect after failover (the DNS name stays the same)'],['**Multi-AZ DB cluster** (two readable standbys)','Rolling with short failover','Rolling, usually the shortest interruption of the three','Readers can serve reads during the work'],['**With read replicas**','Each replica is maintained separately','AWS recommends upgrading replicas before the source. Check the current guidance for your versions.','Replicas keep their own endpoint']]},
{note:'The exact duration depends on size, recent write activity and how long the engine takes to recover. **Measure it in a rehearsal** and treat AWS figures as typical, not promised. Check the AWS documentation for the behaviour of your version.'},
{map:{title:'RDS patching map',h:328,trace:'Patch an RDS instance',
 hint:'Tap any box, or press Patch an RDS instance to follow a minor update from the notice to the verification.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L118 219 L118 246',[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'ev',x:126,y:24,w:200,h:56,c:'ext',t:'Notice',s:'event or console',d:'AWS announces new minor versions and required maintenance. Subscribe to RDS events in the *maintenance* category.',why:'You should hear about a change before it happens.',chk:`aws rds create-event-subscription --subscription-name pg-maint --sns-topic-arn arn:aws:sns:eu-west-1:123456789012:dba --source-type db-instance --event-categories maintenance`,see:[11,16,'Patching Amazon RDS for PostgreSQL: Minor Versions, Windows and Multi-AZ']},
 {id:'pend',x:354,y:24,w:200,h:56,c:'mem',t:'Pending actions',s:'what is scheduled',d:'Lists required maintenance such as an OS update or a database engine upgrade, with the date AWS will apply it.',why:'Required items will be applied in the window if you do nothing.',chk:`aws rds describe-pending-maintenance-actions`,see:[11,16,'Patching Amazon RDS for PostgreSQL: Minor Versions, Windows and Multi-AZ']},
 {id:'test',x:126,y:136,w:200,h:56,c:'proc',t:'Rehearse',s:'snapshot copy',d:'Restore the latest snapshot to a test instance, upgrade it to the target version and run the application tests.',why:'It reveals problems and gives a measured duration.',chk:`aws rds restore-db-instance-from-db-snapshot --db-instance-identifier pg-test --db-snapshot-identifier snap1`,see:[11,16,'Patching Amazon RDS for PostgreSQL: Minor Versions, Windows and Multi-AZ']},
 {id:'win',x:354,y:136,w:200,h:56,c:'mem',t:'Choose the window',s:'low traffic',d:'Set the weekly maintenance window to a quiet period, or choose a specific time for this action.',why:'The window is when AWS applies required and automatic changes.',chk:`aws rds modify-db-instance --db-instance-identifier pg-prod --preferred-maintenance-window sun:03:00-sun:03:30`,see:[11,16,'Patching Amazon RDS for PostgreSQL: Minor Versions, Windows and Multi-AZ']},
 {id:'apply',x:21,y:248,w:194,h:56,c:'warn',t:'Apply',s:'now or next window',d:'Apply the action now, or leave it for the window. The instance restarts. On Multi-AZ, OS maintenance is rolling.',why:'A restart or failover means a short outage that applications must survive.',chk:`aws rds modify-db-instance --db-instance-identifier pg-prod --engine-version 17.6 --apply-immediately`,see:[11,16,'Patching Amazon RDS for PostgreSQL: Minor Versions, Windows and Multi-AZ']},
 {id:'ver',x:243,y:248,w:194,h:56,c:'mem',t:'Verify',s:'version and events',d:'Check the engine version, the instance events and the application.',why:'Proves the change and shows any failed step.',chk:`SELECT version();`,see:[11,16,'Patching Amazon RDS for PostgreSQL: Minor Versions, Windows and Multi-AZ']},
 {id:'ext',x:465,y:248,w:194,h:56,c:'proc',t:'Extensions',s:'update after',d:'Run `ALTER EXTENSION ... UPDATE` where the new engine version has newer extension versions.',why:'The engine upgrade does not update extensions for you.',chk:`SELECT name, installed_version, default_version FROM pg_available_extensions WHERE installed_version IS NOT NULL;`,see:[11,16,'Patching Amazon RDS for PostgreSQL: Minor Versions, Windows and Multi-AZ']}],
 steps:[
 {ids:['ev','pend'],t:'1. Learn about the change from events and list the pending maintenance actions.',w:'No surprises.',s:'Event subscription.',x:'Nobody reads the events.',c:`aws rds describe-pending-maintenance-actions`},
 {ids:['test','win'],t:'2. Rehearse on a restored copy, then choose the maintenance window.',w:'Known timing, quiet period.',s:'Window, snapshot.',x:'Skipping the rehearsal.',c:`aws rds describe-db-snapshots --db-instance-identifier pg-prod`},
 {ids:['apply'],t:'3. Apply the update. The instance restarts, or fails over on Multi-AZ for OS maintenance.',w:'The outage happens here.',s:'`--apply-immediately`, auto minor upgrade.',x:'Applications that do not reconnect.',c:`aws rds modify-db-instance --db-instance-identifier pg-prod --engine-version 17.6 --apply-immediately`},
 {ids:['ver','ext'],t:'4. Verify the version, then update extensions.',w:'Completes the patch.',s:'Extension versions.',x:'Forgetting ALTER EXTENSION.',c:`SELECT version();`}]}},
{h:'Lower the impact'},
{ul:['**Use the DNS endpoint**, never an IP address. After a failover the name points to the new primary.','**RDS Proxy** keeps application connections open and shortens the perceived failover.','**Blue/Green deployment** is available for minor upgrades as well as major ones: the new version is tested on a copy and the switchover takes about a minute.','**Application retry:** use a driver or pool that reconnects, with a short back-off.','**Test the restart:** use *Reboot with failover* in a test Multi-AZ environment to see how the application reacts.']},
{h:'After the patch'},
{code:`SELECT version();

-- extension versions are not updated for you
SELECT name, installed_version, default_version
FROM pg_available_extensions
WHERE installed_version IS NOT NULL AND installed_version <> default_version;
ALTER EXTENSION pg_stat_statements UPDATE;`},
{ul:['Check **Events** for the instance to confirm the completed steps.','Compare CloudWatch and Performance Insights with the day before: CPU, connections, latency.','Run `ANALYZE` if the release notes suggest it. A minor update normally keeps statistics.']}
],src:[['Maintaining a DB instance','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_UpgradeDBInstance.Maintenance.html'],['Upgrading the PostgreSQL DB engine for RDS','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_UpgradeDBInstance.PostgreSQL.html'],['Blue/Green Deployments','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments.html']]};

L['pg:11:17']={blocks:[
{p:'Aurora patches the **cluster** as a unit. The writer and the readers share one storage volume, so a minor version change applies to the cluster rather than to each machine separately. The main questions are the same as on RDS: **when**, **how much interruption**, and **how to test first**.'},
{h:'How Aurora differs from RDS and on-premises'},
{t:[['Point','On-premises','RDS for PostgreSQL','Aurora PostgreSQL'],['Who delivers the patch','You install packages','AWS delivers a new engine version','AWS delivers a new cluster engine version'],['Unit of change','One server','One instance','**The whole cluster**'],['Storage','On each server','Per instance (Multi-AZ copy)','Shared cluster volume. Patching does not copy data.'],['Rehearsal copy','Restore a backup (slow)','Restore a snapshot (slow)','**Clone** (copy-on-write, minutes)'],['Interruption','A restart per node','Restart or failover','Writer failover or restart. Zero-downtime patching may reduce it.']]},
{h:'Controls and commands'},
{ul:['**Maintenance window** and **pending actions** work as on RDS. A cluster has a window, and each instance has its own preferred window.','**Auto minor version upgrade** is a setting on the instances. AWS documents that for Aurora the cluster upgrade is applied when the setting is enabled on the instances. Check the current rule before relying on it.','**Target version:** use `describe-db-engine-versions` to see valid targets, including **long-term support (LTS)** versions that receive patches for a longer period and have fewer upgrade events.','**Parameter groups:** a minor upgrade keeps the same family, so your DB and cluster parameter groups stay attached.']},
{code:`# pending maintenance for the cluster
aws rds describe-pending-maintenance-actions --filters Name=db-cluster-id,Values=aurora-pg

# upgrade the cluster to a new minor version now
aws rds modify-db-cluster --db-cluster-identifier aurora-pg \\
  --engine-version 16.6 --apply-immediately

# check each instance after the change
aws rds describe-db-instances --filters Name=db-cluster-id,Values=aurora-pg \\
  --query 'DBInstances[].[DBInstanceIdentifier,EngineVersion,DBInstanceStatus]' --output table

-- inside the database
SELECT aurora_version(), version();`},
{h:'Zero-downtime patching (ZDP)'},
{ul:['Aurora can apply some engine patches while **keeping client connections open** and pausing queries briefly, instead of dropping connections.','It is available only for **some versions and conditions**. Long open transactions, temporary tables or certain settings can prevent it, and then Aurora falls back to a normal restart.','Treat ZDP as a **benefit when it applies, not a promise**. Read the release notes of the target version and test.']},
{h:'Rehearse on a clone'},
{p:'A **clone** is a new cluster that shares the storage pages of the source and only stores changes. It appears in minutes whatever the database size. Upgrade the clone and run your application tests against it.'},
{code:`aws rds restore-db-cluster-to-point-in-time \\
  --source-db-cluster-identifier aurora-pg --db-cluster-identifier aurora-pg-test \\
  --restore-type copy-on-write --use-latest-restorable-time
aws rds create-db-instance --db-instance-identifier aurora-pg-test-1 \\
  --db-cluster-identifier aurora-pg-test --db-instance-class db.r6g.large --engine aurora-postgresql`},
{map:{title:'Aurora patching map',h:328,trace:'Patch an Aurora cluster',
 hint:'Tap any box, or press Patch an Aurora cluster to follow a minor upgrade across the writer and readers.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L118 219 L118 246',[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'cl',x:126,y:24,w:200,h:56,c:'ext',t:'Cluster',s:'writer + readers',d:'An Aurora cluster has one writer and up to 15 readers on one shared storage volume. Patching is planned for the cluster, not for each instance.',why:'Instances share a version, so the cluster is the unit of change.',chk:`aws rds describe-db-clusters --db-cluster-identifier aurora-pg --query 'DBClusters[0].[EngineVersion,Status]'`,see:[11,17,'Patching Aurora PostgreSQL: Cluster Upgrades, Zero-Downtime Patching and Clones']},
 {id:'ver',x:354,y:24,w:200,h:56,c:'mem',t:'Choose target',s:'version and LTS',d:'Pick the target minor version. Aurora also offers long-term support (LTS) versions that receive only patch-level fixes for a longer period.',why:'LTS reduces how often you must upgrade.',chk:`aws rds describe-db-engine-versions --engine aurora-postgresql --engine-version 16.4 --query 'DBEngineVersions[0].ValidUpgradeTarget[].EngineVersion'`,see:[11,17,'Patching Aurora PostgreSQL: Cluster Upgrades, Zero-Downtime Patching and Clones']},
 {id:'clone',x:126,y:136,w:200,h:56,c:'proc',t:'Rehearse on a clone',s:'fast copy',d:'Create a copy-on-write clone of the cluster in minutes, upgrade it and test.',why:'A clone shares storage, so it is quick and cheap to create.',chk:`aws rds restore-db-cluster-to-point-in-time --source-db-cluster-identifier aurora-pg --db-cluster-identifier aurora-pg-test --restore-type copy-on-write --use-latest-restorable-time`,see:[11,17,'Patching Aurora PostgreSQL: Cluster Upgrades, Zero-Downtime Patching and Clones']},
 {id:'wr',x:354,y:136,w:200,h:56,c:'warn',t:'Writer',s:'restarts or fails over',d:'The writer is the instance with the longest interruption. Depending on version and workload, zero-downtime patching may keep connections.',why:'Applications must survive a writer interruption.',chk:`aws rds modify-db-cluster --db-cluster-identifier aurora-pg --engine-version 16.6 --apply-immediately`,see:[11,17,'Patching Aurora PostgreSQL: Cluster Upgrades, Zero-Downtime Patching and Clones']},
 {id:'rd',x:21,y:248,w:194,h:56,c:'proc',t:'Readers',s:'restart',d:'Readers are patched too. Applications using the reader endpoint see a brief disruption.',why:'Keep more than one reader so reads continue.',chk:`aws rds describe-db-instances --filters Name=db-cluster-id,Values=aurora-pg --query 'DBInstances[].[DBInstanceIdentifier,EngineVersion,DBInstanceStatus]'`,see:[11,17,'Patching Aurora PostgreSQL: Cluster Upgrades, Zero-Downtime Patching and Clones']},
 {id:'fo',x:243,y:248,w:194,h:56,c:'net',t:'Endpoints',s:'cluster and reader',d:'The cluster endpoint always points to the writer, the reader endpoint to the readers. DNS moves after any failover.',why:'Use endpoints, never instance addresses.',chk:`nslookup aurora-pg.cluster-abc123.eu-west-1.rds.amazonaws.com`,see:[11,17,'Patching Aurora PostgreSQL: Cluster Upgrades, Zero-Downtime Patching and Clones']},
 {id:'ext',x:465,y:248,w:194,h:56,c:'proc',t:'Verify and extensions',s:'post steps',d:'Check every instance is on the target version, then update extensions.',why:'Extensions are separate from the engine version.',chk:`SELECT aurora_version(), version();`,see:[11,17,'Patching Aurora PostgreSQL: Cluster Upgrades, Zero-Downtime Patching and Clones']}],
 steps:[
 {ids:['cl','ver'],t:'1. Check the cluster version and the valid upgrade targets, including LTS.',w:'Choose a supported path.',s:'Target version, LTS.',x:'Choosing a version that is not on the path.',c:`aws rds describe-db-engine-versions --engine aurora-postgresql --engine-version 16.4`},
 {ids:['clone'],t:'2. Clone the cluster, upgrade the clone and run application tests.',w:'Real data, little cost.',s:'Clone, test traffic.',x:'Testing only on an empty database.',c:`aws rds restore-db-cluster-to-point-in-time --restore-type copy-on-write ...`},
 {ids:['wr','rd'],t:'3. Upgrade the production cluster in the window. The writer and readers are updated, and the writer role may move.',w:'The interruption happens here.',s:'Apply immediately or in the window.',x:'A single reader: reads stop during its update.',c:`aws rds modify-db-cluster --db-cluster-identifier aurora-pg --engine-version 16.6 --apply-immediately`},
 {ids:['fo'],t:'4. Applications reconnect through the cluster endpoint and the reader endpoint.',w:'DNS follows the roles.',s:'Endpoints, DNS cache time.',x:'Connection strings with instance names.',c:`nslookup aurora-pg.cluster-abc123.eu-west-1.rds.amazonaws.com`},
 {ids:['ext'],t:'5. Verify versions on all instances and update extensions.',w:'Finish the job.',s:'Extension versions.',x:'One instance left on the old version.',c:`SELECT aurora_version(), version();`}]}},
{h:'Other cases'},
{t:[['Case','What to know'],['**Aurora Global Database**','Several clusters in different Regions. Check the documented procedure for upgrading a global database: versions across clusters must stay compatible, so secondaries are handled as part of the plan.'],['**Blue/Green deployment**','Available for Aurora PostgreSQL. A staging cluster on the new version is kept in sync and switched over in about a minute. Best when you need the shortest outage.'],['**Only one instance (no readers)**','The cluster has one writer. During the update there is no other instance to take over. Add a reader before patching production.'],['**Applications and DNS**','Use the cluster and reader endpoints. Keep the DNS cache time short so clients follow the failover.']]},
{note:'**Aurora is not maintenance-free.** AWS runs the patches, but the restart or failover still reaches your application. The best protection is a tested reconnect strategy and a rehearsal on a clone.'}
],src:[['Maintaining an Amazon Aurora DB cluster','https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/USER_UpgradeDBInstance.Maintenance.html'],['Database engine updates for Aurora PostgreSQL','https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Updates.html'],['Cloning a volume for an Aurora DB cluster','https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Managing.Clone.html']]};

L['pg:11:18']={blocks:[
{p:'The **method** of patching is the same everywhere: plan, test, protect, apply, verify. What changes is **who performs each step** and **which tools you use**. This lesson puts the three environments side by side.'},
{h:'Side by side'},
{t:[['Question','On-premises','Amazon RDS for PostgreSQL','Aurora PostgreSQL'],['Who provides the patch','PostgreSQL project through your package repository','AWS, as a new engine version','AWS, as a new cluster engine version'],['Who decides when','You','You (window, version, auto minor upgrade). Required items have deadlines.','You (window, version). Required items have deadlines.'],['How it is applied','`dnf update` or `apt install`, then restart','`modify-db-instance` or `apply-pending-maintenance-action`','`modify-db-cluster` or `apply-pending-maintenance-action`'],['Typical interruption','A restart. Seconds with a switchover if you have standbys.','A restart or failover: minutes on Single-AZ and Multi-AZ instance. Less with Blue/Green.','Writer failover or restart. Zero-downtime patching may apply.'],['Operating system','You patch and reboot','AWS patches (pending action `system-update`)','AWS patches'],['Test on a copy','Restore a backup','Restore a snapshot','Create a **clone**'],['Rollback','Downgrade the package or restore a backup','Restore a snapshot or point-in-time to a new instance. You cannot downgrade the engine in place.','Restore or clone back to a point in time. No in-place downgrade.'],['Extensions','`ALTER EXTENSION ... UPDATE`','Same, after the engine upgrade','Same, after the engine upgrade'],['Notice of change','Mailing lists and release notes','Events, console and email','Events, console and email'],['HA protection during patching','Standbys and a switchover','Multi-AZ, Multi-AZ cluster, Blue/Green','Readers, Blue/Green, clones']]},
{note:'On RDS and Aurora **you cannot go back to an older minor version in place**. The way back is a restore, so take the snapshot before you start and test beforehand.'},
{map:{title:'Patching runbook map',h:328,trace:'Run a patch the same way everywhere',
 hint:'Tap any box, or press Run a patch the same way everywhere to follow one runbook that fits on-premises, RDS and Aurora.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'pl',x:126,y:24,w:200,h:56,c:'mem',t:'Plan',s:'notes and window',d:'Read the release notes, decide the target version, the window and the people involved.',why:'The plan is the same in every environment.',chk:`SELECT version();`,see:[11,18,'Patching Compared: On-Premises, RDS and Aurora (Runbook and Checklist)']},
 {id:'tst',x:354,y:24,w:200,h:56,c:'proc',t:'Test',s:'copy of production',d:'On-premises: restore a backup. RDS: restore a snapshot. Aurora: clone the cluster. Patch the copy and run tests.',why:'You find problems before production.',chk:`aws rds restore-db-cluster-to-point-in-time --restore-type copy-on-write ...`,see:[11,18,'Patching Compared: On-Premises, RDS and Aurora (Runbook and Checklist)']},
 {id:'bk',x:126,y:136,w:200,h:56,c:'disk',t:'Protect',s:'backup or snapshot',d:'Take a backup or manual snapshot and note the time. On Aurora the continuous backup also gives point-in-time restore.',why:'It is your way back.',chk:`aws rds create-db-snapshot --db-instance-identifier pg-prod --db-snapshot-identifier before-17-6`,see:[11,18,'Patching Compared: On-Premises, RDS and Aurora (Runbook and Checklist)']},
 {id:'ap',x:354,y:136,w:200,h:56,c:'warn',t:'Apply',s:'package or API call',d:'On-premises: update packages and restart. RDS and Aurora: modify the engine version or apply the pending action.',why:'The interruption happens here.',chk:`sudo dnf update 'postgresql17*'`,see:[11,18,'Patching Compared: On-Premises, RDS and Aurora (Runbook and Checklist)']},
 {id:'vr',x:126,y:248,w:200,h:56,c:'mem',t:'Verify',s:'version and health',d:'Check the version, connections, replication, logs and key queries.',why:'Prove success with evidence.',chk:`SELECT version(), pg_postmaster_start_time();`,see:[11,18,'Patching Compared: On-Premises, RDS and Aurora (Runbook and Checklist)']},
 {id:'rec',x:354,y:248,w:200,h:56,c:'proc',t:'Record',s:'extensions and notes',d:'Update extensions, write down duration and surprises, and improve the runbook.',why:'Next time is easier.',chk:`ALTER EXTENSION pg_stat_statements UPDATE;`,see:[11,18,'Patching Compared: On-Premises, RDS and Aurora (Runbook and Checklist)']}],
 steps:[
 {ids:['pl','tst'],t:'1. Plan, then test on a copy made the right way for your platform.',w:'A rehearsal removes surprises.',s:'Copy method.',x:'Testing on an unrepresentative copy.',c:`SELECT version();`},
 {ids:['bk','ap'],t:'2. Protect with a backup, then apply the patch.',w:'A safe change.',s:'Backup, snapshot.',x:'No recent backup.',c:`aws rds create-db-snapshot --db-instance-identifier pg-prod --db-snapshot-identifier before-17-6`},
 {ids:['vr','rec'],t:'3. Verify, update extensions and record what happened.',w:'Close the change.',s:'Checklist.',x:'No verification.',c:`SELECT version(), pg_postmaster_start_time();`}]}},
{h:'Checklist'},
{t:[['When','Item','Done'],['Before','Read the release notes of every version between current and target','[ ]'],['Before','Check extension availability and driver compatibility','[ ]'],['Before','Patch and test a non-production copy (backup restore, snapshot restore or clone)','[ ]'],['Before','Confirm a fresh backup or snapshot, and note the time','[ ]'],['Before','Agree the window, the rollback trigger and who to call','[ ]'],['During','Apply the patch. Standbys or replicas first where they exist','[ ]'],['During','Watch the logs, events and application errors','[ ]'],['After','Check the version and `pg_postmaster_start_time()` or `aurora_version()`','[ ]'],['After','Update extensions and run any REINDEX in the notes','[ ]'],['After','Check replication, backups and monitoring','[ ]'],['After','Record the duration, problems and improvements','[ ]']]},
{h:'Rules of thumb'},
{ul:['Patch **non-production first**, and keep it only a short time ahead of production.','**Never combine** a minor patch with a major upgrade, a parameter overhaul or a schema change. One change at a time.','Keep an **inventory** of every instance: environment, version, window, owner and next planned patch date.','Prefer **Blue/Green or a rolling switchover** for systems where a few minutes of outage is not acceptable.','Review each patch cycle and **shorten the runbook**: automate checks, keep commands in version control.']}
],src:[['PostgreSQL versioning policy','https://www.postgresql.org/support/versioning/'],['Maintaining a DB instance','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_UpgradeDBInstance.Maintenance.html'],['Maintaining an Amazon Aurora DB cluster','https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/USER_UpgradeDBInstance.Maintenance.html']]};

window.EXTRA_LECTURES=window.EXTRA_LECTURES||{};
(window.EXTRA_LECTURES[9]=window.EXTRA_LECTURES[9]||[]).push(
['Patching PostgreSQL: Minor Releases, Versioning and Planning','0:00','What a minor release is, how often they come, what to read before installing one, and the kinds of patching you must plan for: PostgreSQL, extensions, operating system and drivers.'],
['Minor Version Patching on a Standalone Server (RPM and DEB)','0:00','A step-by-step minor update on a single server with Red Hat family (RPM) and Debian family (DEB) packages: checks, backup, update, restart, verification, extensions and rollback.'],
['Rolling Patching with Replication and Patroni (Minimal Downtime)','0:00','Patch a primary with standbys with only a few seconds of interruption: update standbys first, switch over, update the old primary. With plain streaming replication and with Patroni.'],
['Operating System, Extension and Collation Changes During Patching','0:00','The side effects that surprise DBAs: a reboot after an OS patch, extension updates, and glibc or ICU changes that alter text sort order and can corrupt indexes.']
);
})();
