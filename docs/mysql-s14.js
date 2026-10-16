/* LearnSphere - MySQL, Section 14: Backup & Recovery.
   Lectures 0-6 are core. Needs mysql-common.js. Commands written for MySQL 8.4 from product knowledge, not run against a server. */
(function(){
const K=window.MY,L=window.LESSONS;

const rpo=K.dg(700,170,[
[10,10,680,150,'RPO and RTO on a timeline',1],
[25,60,150,50,'Last good|backup or log',0],[225,60,150,50,'Failure|happens',2],[425,60,130,50,'Service|restored',0],
[25,125,350,26,'RPO: data you can lose (backup interval, log shipping)',0],[225,125,330,26,'RTO: time to recover',0]],
[[175,85,225,85],[375,85,425,85]]);

const families=K.dg(700,200,[
[10,10,680,180,'Two backup families',1],
[25,55,310,110,'Logical|SQL statements or text rows|mysqldump, Shell dump|portable, slower to restore|can restore one table',0],[365,55,310,110,'Physical|copies of data files|XtraBackup, Enterprise Backup, clone, snapshots|fast, same version family|whole instance',2]],[]);

const pitr=K.dg(700,190,[
[10,10,680,170,'Point-in-time recovery',1],
[20,60,130,50,'Full backup|Sunday 02:00',0],[175,60,150,50,'Restore it|to a new server',2],[350,60,170,50,'Replay binary logs|up to just before|the mistake',2],[545,60,130,50,'Server at the|chosen moment',0]],
[[150,85,175,85],[325,85,350,85],[520,85,545,85]]);

const decide=K.dg(700,200,[
[10,10,680,180,'Which tool fits',1],
[25,55,200,50,'One table or schema|dump and restore',0],[250,55,200,50,'Whole server, fast restore|physical backup',2],[475,55,200,50,'Minute-level recovery|full + binary logs',0],
[25,125,200,50,'New replica quickly|clone or physical',0],[250,125,200,50,'Disaster recovery|off-site copy + replica',0],[475,125,200,50,'Migrate versions|logical dump / replication',0]],[]);

/* ---------- 0 ---------- */
L['mysql:13:0']={blocks:[
{p:'A backup is only useful if you can **restore** it, within a time the business accepts, to a point that loses an acceptable amount of data. Start from those two requirements, then choose tools.'},
{svg:rpo},
{t:[['Term','Meaning','Drives'],
['**RPO** (recovery point objective)','The maximum data loss you accept, measured in time','Backup frequency and binary log retention or shipping'],
['**RTO** (recovery time objective)','The maximum time to be running again','Backup type, restore speed, standby servers']]},
{h:'Two families'},
{svg:families},
{t:[['','Logical','Physical'],
['Content','SQL statements or delimited rows','Copies of data files and logs'],
['Tools','`mysqldump`, MySQL Shell dump utilities','Percona XtraBackup, MySQL Enterprise Backup, clone plugin, filesystem or volume snapshots'],
['Restore speed','Slow: rows are re-inserted and indexes rebuilt','Fast: copy files and start'],
['Portability','Across versions, platforms and engines','Same major version family and platform'],
['Granularity','A schema, a table, even selected rows','Usually the whole instance (tables can be restored individually with effort)'],
['Size','Larger as text, compressible','Close to data file size, can be compressed'],
['Best for','Small to medium data, migrations, single table restores','Large databases, fast recovery, new replicas']]},
{h:'Backup types by content'},
{ul:['**Full:** everything. Simple to restore, largest.','**Incremental:** only changes since the last backup (physical tools), or the binary log (all setups). Smaller and faster to take, longer to restore because several pieces are applied.','**Differential:** changes since the last full.','**Hot, warm, cold:** hot runs while the server serves traffic without blocking (InnoDB with the right tool), warm blocks writes, cold needs the server stopped.']},
{h:'What a complete plan protects'},
{ul:['Data (schemas, tables, routines, triggers, events, users and privileges).','The **binary logs** needed for point-in-time recovery.','The configuration file and TLS certificates and keyring keys.','Scripts and runbooks to rebuild the environment.']},
{note:'Back up from a **replica** where possible, so that the backup does not compete with production traffic. The replica must be healthy and current, and you must record its replication position with the backup.'}],
src:[['Backup and recovery',K.D+'backup-and-recovery.html'],['Backup methods',K.D+'backup-methods.html']]};

/* ---------- 1 ---------- */
L['mysql:13:1']={blocks:[
{p:'`mysqldump` is the classic logical backup tool. It writes SQL statements (`CREATE TABLE`, `INSERT`) that recreate the data. It is simple, ships with the server and is a good fit for small to medium databases and for moving data between servers and versions.'},
{h:'A safe, consistent dump of InnoDB'},
{code:`mysqldump -u backup -p \\
  --single-transaction --routines --triggers --events \\
  --source-data=2 --set-gtid-purged=ON \\
  --default-character-set=utf8mb4 \\
  --databases shop reports > shop_$(date +%F).sql

# all databases, compressed
mysqldump -u backup -p --single-transaction --routines --triggers --events --all-databases | gzip > full.sql.gz`},
{t:[['Option','Why it matters'],
['`--single-transaction`','Starts a consistent snapshot transaction, so InnoDB tables are dumped consistently **without locking**. Not suitable for non-transactional tables'],
['`--routines --triggers --events`','Include stored code. Triggers are on by default, routines and events are not'],
['`--source-data=2`','Writes the binary log coordinates as a comment (8.4 name, was `--master-data`). Needed for point-in-time recovery and building replicas. Use 1 to write an executable CHANGE statement'],
['`--set-gtid-purged`','Controls how GTID information is written. AUTO or ON when GTID is enabled'],
['`--databases` or `--all-databases`','Include CREATE DATABASE statements'],
['`--no-data`','Structure only'],
['`--hex-blob`','Write binary data in hex, safer for restore'],
['`--quick`','Stream rows instead of buffering, default through `--opt`'],
['`--default-character-set=utf8mb4`','Avoid character set mix-ups']]},
{h:'Restoring'},
{code:`mysql -u admin -p < shop_2026-03-10.sql
gunzip < full.sql.gz | mysql -u admin -p

# only one database or one table from a big file
mysql -u admin -p shop < shop.sql
sed -n '/^-- Table structure for table \`orders\`/,/^-- Table structure for table \`products\`/p' full.sql | mysql -u admin -p shop`},
{h:'Limits to know'},
{ul:['Single-threaded: both dump and restore are slow for hundreds of GB. Use MySQL Shell utilities or physical backups there.','Restoring rebuilds all indexes, so it takes much longer than the dump.','User accounts live in the `mysql` schema. Dump them with `SHOW CREATE USER` and `SHOW GRANTS` or MySQL Shell `util.dumpInstance`, which includes users.','`mysqlpump` is deprecated. Prefer Shell utilities.','A dump is only point-in-time consistent with `--single-transaction`, and DDL during the dump can break that consistency.']},
{note:'Protect dump files: they contain all the data in readable form (unless encrypted). Restrict file permissions and encrypt copies that leave the server.'}],
src:[['mysqldump',K.D+'mysqldump.html'],['Making a logical backup with mysqldump',K.D+'mysqldump-sql-format.html']]};

/* ---------- 2 ---------- */
L['mysql:13:2']={blocks:[
{p:'MySQL Shell includes **dump and load utilities** that are faster and more capable than `mysqldump`. They work in parallel, split big tables into chunks, compress output and check compatibility. They are the recommended logical backup method for larger data.'},
{code:`mysqlsh admin@db1:3306 --js
util.dumpInstance('/backup/2026-03-10', {threads: 8, compression: 'zstd', consistent: true})
util.dumpSchemas(['shop','reports'], '/backup/shop', {threads: 8})
util.dumpTables('shop', ['orders','customers'], '/backup/tables')

util.loadDump('/backup/2026-03-10', {threads: 8, resetProgress: false})
util.exportTable('shop.orders', '/backup/orders.csv')
util.importTable('/backup/orders.csv', {schema: 'shop', table: 'orders', dialect: 'csv-unix', threads: 8})`},
{h:'What makes them better'},
{ul:['**Parallel** dump and load with `threads`.','**Chunking:** large tables are split by primary key ranges, so several threads work on one table.','**Compression:** zstd (default) or gzip.','**Consistent snapshot** of the whole instance without long locks (`consistent: true`), using a short lock to align the threads.','**Resumable load:** the load keeps a progress file, so an interrupted restore continues where it stopped.','Dumps include **users and grants** with `dumpInstance` (unless excluded), views, routines, triggers and events.','**Compatibility checks** and conversions for targets such as MySQL HeatWave or other managed services (`compatibility` options).']},
{h:'Loading'},
{ul:['The target needs `local_infile = ON` during the load, because the data is loaded with `LOAD DATA LOCAL INFILE`.','For speed, options such as `deferTableIndexes: \'all\'` create secondary indexes after loading data, and `skipBinlog: true` avoids writing to the binary log when loading into a new server that will be cloned or built separately. Use them only when you understand the replication consequences.','`loadDump` can load from object storage (OCI, S3 with the right setup) as well as a local path.']},
{t:[['Need','Use'],
['Backup and restore a few GB with simple tools','mysqldump'],
['Large logical backup, parallel restore, move to a managed service','Shell `dumpInstance` and `loadDump`'],
['Load a CSV quickly in parallel','Shell `importTable`'],
['Export one table to a file','Shell `exportTable` or SELECT INTO OUTFILE']]},
{note:'A logical dump from Shell does not replace the binary log. For point-in-time recovery you still need the binary logs from the dump time onward, and the dump records the position it was taken at in its metadata.'}],
src:[['MySQL Shell dump utilities',K.SH+'mysql-shell-utilities-dump-instance-schema.html'],['MySQL Shell load dump',K.SH+'mysql-shell-utilities-load-dump.html']]};

/* ---------- 3 ---------- */
L['mysql:13:3']={blocks:[
{p:'**Physical backups** copy the data files while the server is running and then make the copy consistent by replaying the redo log. They are much faster than logical backups for large databases, and the restore is a file copy.'},
{h:'Percona XtraBackup'},
{p:'The most widely used open source hot backup tool for InnoDB. It copies data files and the redo log at the same time, without blocking normal transactions.'},
{code:`# 1. full backup
xtrabackup --backup --user=backup --password=... --target-dir=/backup/full

# 2. prepare: apply the redo log so the copy is consistent
xtrabackup --prepare --target-dir=/backup/full

# 3. restore into an empty data directory (mysqld stopped)
xtrabackup --copy-back --target-dir=/backup/full --datadir=/var/lib/mysql
chown -R mysql:mysql /var/lib/mysql

# incremental
xtrabackup --backup --target-dir=/backup/inc1 --incremental-basedir=/backup/full
xtrabackup --prepare --apply-log-only --target-dir=/backup/full
xtrabackup --prepare --apply-log-only --target-dir=/backup/full --incremental-dir=/backup/inc1
xtrabackup --prepare --target-dir=/backup/full

# stream and compress to another host
xtrabackup --backup --stream=xbstream --compress | ssh backup@host "xbstream -x -C /backup/stream"`},
{ul:['Use the XtraBackup **version that matches your MySQL major version** (for 8.4 use the XtraBackup 8.4 series).','The backup is **not usable until prepared**.','It records the binary log position (`xtrabackup_binlog_info`), which seeds replicas and point-in-time recovery.','It supports compression, encryption, streaming and incremental backups.']},
{h:'MySQL Enterprise Backup'},
{p:'Oracle commercial hot backup (`mysqlbackup`), similar in function: full, incremental, compressed, encrypted, single-step `backup-and-apply-log` and restore with `copy-back-and-apply-log`.'},
{h:'The clone plugin'},
{p:'The **clone plugin** (8.0.17 and later) copies the whole InnoDB data from a running server into another server or a local directory, over the network, with minimal blocking. It is the fastest way to create a **new replica** or rebuild one.'},
{code:`INSTALL PLUGIN clone SONAME 'mysql_clone.so';
-- on the recipient (replaces its data and restarts it):
SET GLOBAL clone_valid_donor_list = 'donor.example.com:3306';
CLONE INSTANCE FROM 'clone_user'@'donor.example.com':3306 IDENTIFIED BY '...';
-- local copy to a directory
CLONE LOCAL DATA DIRECTORY = '/backup/clone1';
SELECT stage, state, estimate FROM performance_schema.clone_progress;`},
{ul:['Donor and recipient must run the **same MySQL version and platform**.','Cloning replaces all data on the recipient, which restarts afterwards.','It copies InnoDB data only. It is not a general backup format: no incremental, no compression.']},
{h:'Snapshots and cold copies'},
{ul:['Storage or cloud volume **snapshots** (LVM, EBS, managed service snapshots) are fast. A snapshot taken while the server runs is **crash consistent** and recovers through InnoDB crash recovery if data, redo and undo are all captured in the same instant. Put them on one volume or use a consistency group.','`FLUSH TABLES WITH READ LOCK` or `LOCK INSTANCE FOR BACKUP` can make a snapshot cleaner.','A **cold backup** (stop the server, copy the data directory) is simple and consistent but needs downtime. Use it on replicas.']},
{note:'A backup you have never restored is not a backup. Test physical restores regularly, including the prepare step and the version of the tool.'}],
src:[['Clone plugin',K.D+'clone-plugin.html'],['Percona XtraBackup','https://docs.percona.com/percona-xtrabackup/8.4/'],['MySQL Enterprise Backup',K.MGT+'mysql-enterprise-backup/8.4/en/']]};

/* ---------- 4 ---------- */
L['mysql:13:4']={blocks:[
{p:'A full backup restores the database to the moment it was taken. **Point-in-time recovery (PITR)** goes further: restore the last full backup and then **replay the binary log** up to just before a mistake, such as a bad `DELETE` or `DROP TABLE`.'},
{svg:pitr},
{h:'What you need'},
{ul:['A full backup, and the **binary log position or GTID set** where it was taken (in the dump header, XtraBackup file or Shell metadata).','All binary logs written **since** that position, kept until the next successful backup is verified.','Binary logging enabled with `binlog_format = ROW` (default) and enough retention (`binlog_expire_logs_seconds`).']},
{h:'Procedure'},
{flow:['Stop applications that write, or work on a copy of the server so that production is not changed further','Restore the full backup to a clean server','Find the position of the bad statement in the binary logs','Replay the binary logs from the backup position up to just before that statement','Check the data, then switch applications or copy the missing rows back to production']},
{h:'Finding the bad statement'},
{code:`SHOW BINARY LOGS;
mysqlbinlog --base64-output=DECODE-ROWS -vv --start-datetime='2026-03-10 09:00:00' \\
            --stop-datetime='2026-03-10 11:00:00' binlog.000123 | less
# search for "DROP TABLE" or the DELETE, note its "# at 4711" position`},
{h:'Replaying'},
{code:`# position based
mysqlbinlog --start-position=1234 --stop-position=4711 binlog.000123 binlog.000124 | mysql -u admin -p

# time based
mysqlbinlog --start-datetime='2026-03-10 02:00:00' --stop-datetime='2026-03-10 10:14:59' binlog.000123 | mysql -u admin -p

# GTID based: skip the bad transaction
mysqlbinlog --exclude-gtids='3E11FA47-71CA-11E1-9E33-C80AA9429562:1234' binlog.000123 | mysql -u admin -p`},
{ul:['**Stop just before** the mistake: use `--stop-position` or the time just before it. Positions are exact, times can be ambiguous when many statements occur in a second.','Replay all files in order in one `mysqlbinlog` command so that transaction context stays consistent.','Do not replay the binary log into the **same server** that is still writing to it without care.','Disable binary logging for the replay session if you do not want it re-logged (`--disable-log-bin`).']},
{h:'Continuous binary log backup'},
{p:'To make the **RPO nearly zero**, copy binary logs off the server continuously, not only at backup time. `mysqlbinlog` can stream them from a running server.'},
{code:`mysqlbinlog --read-from-remote-server --host=db1 --user=repl --password --raw --stop-never binlog.000123`},
{note:'A delayed replica (a few hours behind on purpose) is another way to recover from human error: stop it before the mistake arrives, then copy the data back.'}],
src:[['Point-in-time recovery',K.D+'point-in-time-recovery.html'],['mysqlbinlog',K.D+'mysqlbinlog.html']]};

/* ---------- 5 ---------- */
L['mysql:13:5']={blocks:[
{p:'A good backup strategy is a **routine** that runs without attention, is monitored, keeps enough history, stores copies safely elsewhere and is proven by regular restores.'},
{h:'A sample plan'},
{t:[['Item','Example for a mid-size production database'],
['Method','Full physical backup weekly, incremental daily, from a replica'],
['Binary logs','Streamed off-server continuously, kept 14 days'],
['Logical copy','Monthly Shell dump of critical schemas for portability'],
['Retention','Daily for 14 days, weekly for 8 weeks, monthly for 12 months, according to policy and law'],
['Off-site','Copy to another region or account. Follow the **3-2-1 rule**: 3 copies, 2 media types, 1 off-site'],
['Encryption','Encrypt in transit and at rest, protect the keys separately'],
['Verification','Automated restore test weekly, `CHECK TABLE` or checksum comparison, row count checks'],
['Monitoring','Alert if a backup is late, fails or shrinks unexpectedly']]},
{h:'Verification'},
{flow:['The backup job finishes and records size, duration and the binary log position','A scheduled job restores the latest backup to a scratch server','The scratch server is started, recovered and queried: row counts on key tables, a few business queries','Binary logs are replayed to prove the PITR path works','The result is stored and an alert is raised if anything fails']},
{p:'Measure how long the restore takes. That is your real **RTO**. Many teams discover during a disaster that the restore takes much longer than they assumed.'},
{h:'Disaster recovery'},
{ul:['Plan for losing a **server**, a **zone or region**, and **an account** (ransomware or a compromised credential).','Keep a **replica** in another zone or region. Replication is not a backup, because a mistaken change replicates, but it shortens recovery from hardware failure.','Keep **immutable** or offline copies so an intruder cannot delete every backup.','Document the runbook: who decides, how to restore, how to repoint applications, how to verify, how to fail back.','Practise it in a game day. Runbooks that were never tested fail.']},
{h:'Common mistakes'},
{ul:['Backups on the same disk or server as the data.','No test restores.','Missing binary logs, so only the last full backup is recoverable.','Forgetting users, routines, events or configuration.','Keyring or encryption keys not backed up with the data.','A backup account with too many privileges and a password in a script.']},
{note:'Replication and RAID are availability tools. Neither protects against deletion, corruption copied to all nodes, or malicious changes. Backups do.'}],
src:[['Establishing a backup policy',K.D+'backup-policy.html'],['Backup and recovery types',K.D+'backup-types.html']]};

/* ---------- 6 ---------- */
L['mysql:13:6']={blocks:[
{p:'Things go wrong in a few typical ways. This lesson maps each failure to the right recovery path.'},
{svg:decide},
{h:'Decision guide'},
{t:[['Situation','First step','Recovery path'],
['A table was dropped or rows deleted by mistake','Stop writes to the affected data. Note the time','Restore the last backup to a scratch server, replay the binary log to just before the mistake, copy the table or rows back to production'],
['One table needs restoring from a physical backup','Prepared backup on a scratch server','Use transportable tablespaces: `ALTER TABLE t DISCARD TABLESPACE` then copy the `.ibd` and `ALTER TABLE t IMPORT TABLESPACE`, or restore the backup elsewhere and dump the table'],
['The server crashed and will not start','Read the error log','Let InnoDB crash recovery run. If it fails on a corrupt page, use `innodb_force_recovery` to start read-only and dump the data'],
['The disk failed, data directory lost','Provision a new server','Restore the last full and incremental backup, replay binary logs, or promote a replica'],
['A replica is broken or far behind','Check replication errors','Rebuild it with the clone plugin or a backup from another replica, then resume replication with GTID'],
['Data corruption suspected','`CHECK TABLE`, compare with a replica','Restore from backup or rebuild the table from a replica or dump'],
['Ransomware or intrusion','Isolate the server. Preserve evidence','Rebuild from clean images, restore from an off-site immutable backup, rotate all credentials']]},
{h:'innodb_force_recovery'},
{p:'When InnoDB cannot start because of corruption, a **last-resort** setting lets the server start in a degraded mode so that you can export data.'},
{code:`[mysqld]
innodb_force_recovery = 1     # try the smallest value that works. Levels 1 to 6 (6 is the most dangerous)

# then, with the server up in a restricted mode:
mysqldump --all-databases > rescue.sql
# stop, delete the data directory, initialise a new one, restore rescue.sql`},
{ul:['Start at **1** and go up only if needed. Levels 4 and above can permanently damage data.','At levels 1 to 3 the server allows reads. Writes are blocked at 4 and above on many operations.','Always take a file-level copy of the data directory **first**, in case a recovery attempt makes things worse.','After you export, **rebuild the server**. Do not continue running with recovery settings or damaged files.']},
{h:'Checking and repairing'},
{code:`CHECK TABLE shop.orders;
mysqlcheck -u admin -p --check --databases shop
ALTER TABLE shop.orders ENGINE=InnoDB;      -- rebuild a table
-- InnoDB has no REPAIR TABLE. Rebuild from a good source`},
{h:'Practice'},
{ul:['Know in advance where the backups and keys are and who can restore.','Run recovery drills: restore to a scratch server, replay binary logs, restore a single table.','After any recovery, verify data with business queries and compare with a replica.','Write down what happened and fix the process that allowed it.']},
{note:'Speed matters, but so does not making things worse. Copy the evidence (data directory, logs) before attempting risky recovery, work on a copy where possible and change one thing at a time.'}],
src:[['Forcing InnoDB recovery',K.D+'forcing-innodb-recovery.html'],['Importing InnoDB tables (transportable tablespaces)',K.D+'innodb-table-import.html']]};
})();
