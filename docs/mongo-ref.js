/* LearnSphere - MongoDB Quick Reference (cheat sheet).
   window.QREF['mongo'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Blocks: {h}, {p}, {t:[header,...rows]}, {code}, {note}, {ul}, {flow}. Lazy-loaded through REFLAZY in index.html.
   Values are for MongoDB 8.0 unless stated. Check a setting on your own server with db.adminCommand({ getParameter: 1, <name>: 1 }) or db.adminCommand({ getCmdLineOpts: 1 }).
   Pages that only describe PostgreSQL or Redshift internals (PGDATA, WLM, distribution styles) have no MongoDB equivalent and are left out; cost and quota pages for a managed service are folded into the Atlas page.
   Dates, tiers and limits change, so confirm against the MongoDB documentation and the support policy page. */
window.QREF=window.QREF||{};
window.QREF.mongo={title:'MongoDB Quick Reference',blurb:'Processes, files, locations, logs, parameters, commands, tools, limits and fixes on one page each. Use the search box to filter any page.',hint:'writeConcern or maxPoolSize',pages:[

/* 1 ------------------------------------------------------- components */
{t:'Components and where to look',d:'Every moving part of a deployment, what it does and the command or log to check when it misbehaves.',see:[[1,0,'Process family'],[9,0,'Replica sets'],[10,1,'Sharded cluster']],b:[
{t:[['Component','Applies to','Job','Look here'],
['`mongod`','Self-managed, Atlas','Database server: stores data, runs queries, replication and the storage engine. Default port 27017','`mongod.log`, `db.serverStatus()`'],
['`mongos`','Sharded clusters','Query router. Reads shard metadata from the config servers and sends operations to the right shards','`mongos.log`, `sh.status()`'],
['Config server (`--configsvr`)','Sharded clusters','Replica set that stores chunk ranges and shard metadata. Default port 27019','`rs.status()` on the config set, `config` database'],
['Shard server (`--shardsvr`)','Sharded clusters','A shard is a replica set that holds part of the data. Default port 27018','`rs.status()` on each shard'],
['Primary','Replica sets','The only member that accepts writes','`rs.status()`, `db.hello()`'],
['Secondary','Replica sets','Copies the primary oplog and can serve reads','`rs.printSecondaryReplicationInfo()`'],
['Hidden, delayed, priority 0','Replica sets','Special secondaries for reports, protection from mistakes or remote sites','`rs.conf()`'],
['Arbiter','Replica sets','Votes in elections, holds no data (use is discouraged)','`rs.status()` (`ARBITER`)'],
['WiredTiger','Both','Storage engine: cache, B-trees, compression, journal and checkpoints','`db.serverStatus().wiredTiger`'],
['Oplog (`local.oplog.rs`)','Replica sets','Capped log of data changes used by replication, change streams and PITR','`rs.printReplicationInfo()`'],
['Balancer','Sharded clusters','Moves chunks so shards hold similar amounts of data','`sh.getBalancerState()`, `sh.status()`'],
['`mongosh`','Both','Interactive shell and scripting client','`mongosh --version`'],
['Drivers','Both','Connect applications, pool connections, discover topology, retry','Application log, driver monitoring events'],
['`mongot`','Atlas (and newer self-managed releases)','Process that serves Atlas Search and Vector Search indexes','Atlas Search page, search index status'],
['Ops Manager / Cloud Manager','Self-managed (Enterprise)','Monitoring, backup and automation','Ops Manager UI'],
['Atlas control plane','Atlas','Provisioning, backups, scaling, alerts, access control','Atlas UI, API, Atlas CLI']]},
{note:'In a sharded cluster applications connect only to `mongos`. Never write directly to a shard.'}]},

/* 2 ------------------------------------------------------- files */
{t:'Files and directories in dbPath',d:'What every entry in the data directory is, and whether you may touch it.',see:[[1,5,'On-disk layout'],[1,3,'Journal and checkpoints']],b:[
{t:[['Entry','What it is','Touch it?'],
['`collection-<n>-<id>.wt`','Data of one collection','No'],
['`index-<n>-<id>.wt`','One index','No'],
['`_mdb_catalog.wt`','Catalog: maps collection and index names to files','No'],
['`WiredTiger`, `WiredTiger.wt`, `WiredTiger.turtle`','Storage engine version marker, metadata and checkpoint information','No'],
['`WiredTiger.lock`, `mongod.lock`','Lock files showing the directory is in use','Only remove after an unclean stop and when you are sure no process uses it'],
['`sizeStorer.wt`','Cached collection size and count information','No'],
['`storage.bson`','Records the storage engine settings of this data directory','No'],
['`journal/`','Write-ahead log files (`WiredTigerLog.*`)','No. Never delete'],
['`diagnostic.data/`','Rolling server metrics (FTDC) for support analysis','May be copied for support. Safe to leave'],
['`rollback/`','BSON files of writes rolled back after a failover','Keep until reviewed, then archive'],
['`_tmp/`','Temporary files for large sorts and index builds','No. Cleaned by the server'],
['`<db>/` subfolders','Present only with `storage.directoryPerDB: true`','No'],
['`index/`, `collection/` subfolders','Present with `wiredTigerDirectoryForIndexes: true`','No']]},
{h:'Rules'},
{ul:['Never copy, delete or edit files while `mongod` runs. Use backup tools or a consistent snapshot.','Keep dbPath on a dedicated local volume (XFS on Linux).','If the journal is on a separate volume the usual way is a symlink, and snapshots then need `fsyncLock`.']}]},

/* 3 ------------------------------------------------------- locations */
{t:'Locations by platform',d:'Where binaries, data, configuration, logs and the service live for each installation method.',see:[[2,1,'Installing'],[2,2,'mongod.conf']],b:[
{t:[['Item','Debian/Ubuntu (deb)','RHEL family (rpm)','Windows (MSI)','macOS (Homebrew)'],
['Server binaries','`/usr/bin/mongod`','`/usr/bin/mongod`','`C:\\Program Files\\MongoDB\\Server\\8.0\\bin`','`/opt/homebrew/bin` (Apple silicon)'],
['Config file','`/etc/mongod.conf`','`/etc/mongod.conf`','`...\\bin\\mongod.cfg`','`/opt/homebrew/etc/mongod.conf`'],
['Data directory','`/var/lib/mongodb`','`/var/lib/mongo`','`...\\Server\\8.0\\data`','`/opt/homebrew/var/mongodb`'],
['Log file','`/var/log/mongodb/mongod.log`','`/var/log/mongodb/mongod.log`','`...\\Server\\8.0\\log\\mongod.log`','`/opt/homebrew/var/log/mongodb/mongo.log`'],
['Service','`systemctl status mongod`','`systemctl status mongod`','Service named MongoDB Server','`brew services`'],
['Run as user','`mongodb`','`mongod`','Network Service (default)','Your user']]},
{h:'Containers'},
{t:[['Item','Official image'],
['Data directory','`/data/db` (mount a volume here)'],
['Port','`27017` (publish with `-p`)'],
['Config file','Pass `--config` and mount your file, or pass options on the command line'],
['Logs','Standard output: `docker logs <container>`'],
['Shell','`docker exec -it <container> mongosh`']]},
{note:'Paths vary with the package source and version. Confirm with `mongod --version`, `ps -ef | grep mongod` and `db.adminCommand({ getCmdLineOpts: 1 })`.'}]},

/* 4 ------------------------------------------------------- logs */
{t:'Logs and where to find them',d:'Every log you may need during an incident, and the settings that control the server log.',see:[[7,2,'Profiler and slow log'],[13,2,'mongostat and logs']],b:[
{t:[['Log or data','Where','What it shows','Controlled by'],
['Server log (`mongod.log`)','`systemLog.path`','Start-up, connections, slow operations, elections, replication, errors. Structured JSON since 4.4','`systemLog.*`, `db.setLogLevel()`'],
['systemd journal','`journalctl -u mongod`','Service start and stop, crashes of the process','systemd'],
['Slow query lines','In the server log, message `Slow query`','Operations slower than the threshold with plan summary and counts','`operationProfiling.slowOpThresholdMs`'],
['Profiler','`<db>.system.profile` (capped)','Operations at profiling level 1 or 2','`db.setProfilingLevel()`'],
['Audit log','`auditLog.path`','Authentication, privilege and schema events (Enterprise, Atlas dedicated)','`auditLog.*`'],
['Oplog','`local.oplog.rs`','Data changes in order','`replication.oplogSizeMB`'],
['Diagnostic data (FTDC)','`dbPath/diagnostic.data`','Periodic metrics for support','`diagnosticDataCollection*`'],
['Rollback files','`dbPath/rollback`','Writes undone after a failover','Automatic'],
['mongos log','`systemLog.path` of `mongos`','Routing, balancer and metadata refresh messages','`systemLog.*`'],
['Atlas logs','Atlas UI: Logs, API download, Real-time panel','Server logs, audit log and access logs for a cluster','Atlas project settings']]},
{h:'Log fields (structured JSON)'},
{t:[['Field','Meaning','Example'],
['`t`','Timestamp','`{"$date":"2026-03-10T09:15:01.123+00:00"}`'],
['`s`','Severity: `F` fatal, `E` error, `W` warning, `I` info, `D1` to `D5` debug','`I`'],
['`c`','Component','`COMMAND`, `REPL`, `ELECTION`, `NETWORK`, `STORAGE`, `ACCESS`, `SHARDING`'],
['`id`','Unique message id','`51803`'],
['`ctx`','Thread or connection context','`conn27`'],
['`msg`','Message text','`Slow query`'],
['`attr`','Structured details','`{"durationMillis":420,"planSummary":"COLLSCAN"}`']]},
{h:'Useful commands'},
{code:`# Slow queries, formatted
jq -c 'select(.msg=="Slow query") | .attr | {ns, durationMillis, planSummary, docsExamined}' /var/log/mongodb/mongod.log

# Elections and replication state changes
jq -c 'select(.c=="ELECTION" or .c=="REPL") | {t: .t."$date", msg}' /var/log/mongodb/mongod.log | tail -20

// Rotate the log without a restart
db.adminCommand({ logRotate: 1 })

// Raise verbosity for one component, then lower it again
db.setLogLevel(2, "replication")
db.setLogLevel(0, "replication")`}]},

/* 5 ------------------------------------------------------- parameters */
{t:'Important parameters',d:'The settings a DBA changes most, with default, when a change applies and a sensible starting point.',see:[[2,2,'mongod.conf'],[1,2,'WiredTiger'],[9,2,'Deploy a replica set']],b:[
{h:'Configuration file options (mongod.conf)'},
{t:[['Setting','Default','Applies','Notes'],
['`storage.dbPath`','`/data/db` (package: `/var/lib/mongodb`)','Restart','Dedicated local volume, XFS'],
['`net.port`','27017 (27018 shard, 27019 config server)','Restart','Change only with a reason'],
['`net.bindIp`','`127.0.0.1`','Restart','List private interfaces only. Never `0.0.0.0` without firewall and auth'],
['`security.authorization`','`disabled`','Restart','Set `enabled` before opening to a network'],
['`security.keyFile`','none','Restart','Internal auth for replica sets and clusters'],
['`net.tls.mode`','`disabled`','Restart','`requireTLS` in production'],
['`replication.replSetName`','none','Restart','Same name on every member'],
['`replication.oplogSizeMB`','5% of free disk, clamped (WiredTiger)','Restart for initial value','Resize live with `replSetResizeOplog`'],
['`storage.wiredTiger.engineConfig.cacheSizeGB`','Larger of 50% of (RAM minus 1 GB) or 256 MB','Restart','Lower inside containers with memory limits'],
['`storage.wiredTiger.collectionConfig.blockCompressor`','`snappy`','New collections','`zstd` saves more disk'],
['`storage.journal.commitIntervalMs`','100','Restart','Keep the default'],
['`storage.directoryPerDB`','`false`','Set before data is created','Per-database folders'],
['`operationProfiling.slowOpThresholdMs`','100','Restart or runtime','Also sets slow log threshold'],
['`operationProfiling.mode`','`off`','Restart or runtime','`slowOp` records slow operations only'],
['`net.maxIncomingConnections`','65536','Restart','Practical limit is memory and CPU'],
['`systemLog.destination`, `path`, `logAppend`','file settings','Restart','Rotate with `logRotate`'],
['`sharding.clusterRole`','none','Restart','`shardsvr` or `configsvr`']]},
{h:'Runtime parameters (setParameter)'},
{t:[['Parameter','Default','Effect'],
['`transactionLifetimeLimitSeconds`','60','Maximum time a transaction may run'],
['`cursorTimeoutMillis`','600000','Idle cursor timeout (10 minutes)'],
['`maxTransactionLockRequestTimeoutMillis`','5','How long a transaction waits for a lock'],
['`logLevel`','0','Global log verbosity'],
['`slowms`','100','Slow operation threshold (profiler and log)'],
['`internalQueryMaxBlockingSortMemoryUsageBytes`','104857600 (100 MB)','Memory limit for a blocking sort without disk use'],
['`maxIndexBuildMemoryUsageMegabytes`','200','Memory for an index build before spilling']]},
{code:`// Read one value
db.adminCommand({ getParameter: 1, transactionLifetimeLimitSeconds: 1 })

// Change it at runtime (lost at restart unless also in the config file)
db.adminCommand({ setParameter: 1, transactionLifetimeLimitSeconds: 120 })

// Everything that can be read
db.adminCommand({ getParameter: "*" })`}]},

/* 6 ------------------------------------------------------- mongosh cheat sheet */
{t:'mongosh command cheat sheet',d:'The shell commands and methods used every day, grouped by task.',see:[[2,3,'mongosh'],[3,0,'CRUD']],b:[
{h:'Navigate'},
{code:`show dbs                        // databases
use shop                        // switch database
show collections                // collections in the current database
db.getName()                    // current database
db.getSiblingDB("admin")        // use another database in a script
db.hello()                      // topology and primary information
db.version()                    // server version`},
{h:'Create and read'},
{code:`db.createCollection("orders")
db.orders.insertOne({ item: "A", qty: 2 })
db.orders.insertMany([ { item: "B" }, { item: "C" } ])
db.orders.find({ qty: { $gt: 1 } }, { item: 1, _id: 0 }).sort({ qty: -1 }).limit(10)
db.orders.findOne({ item: "A" })
db.orders.countDocuments({ item: "A" })
db.orders.distinct("item")`},
{h:'Update and delete'},
{code:`db.orders.updateOne({ item: "A" }, { $set: { qty: 5 }, $inc: { views: 1 } })
db.orders.updateMany({ qty: 0 }, { $set: { status: "empty" } })
db.orders.updateOne({ item: "Z" }, { $setOnInsert: { qty: 1 } }, { upsert: true })
db.orders.replaceOne({ item: "A" }, { item: "A", qty: 9 })
db.orders.findOneAndUpdate({ item: "A" }, { $inc: { qty: 1 } }, { returnDocument: "after" })
db.orders.deleteOne({ item: "A" })
db.orders.deleteMany({ status: "empty" })`},
{h:'Indexes and plans'},
{code:`db.orders.createIndex({ item: 1, qty: -1 })
db.orders.createIndex({ email: 1 }, { unique: true })
db.orders.createIndex({ at: 1 }, { expireAfterSeconds: 3600 })
db.orders.getIndexes()
db.orders.dropIndex("item_1_qty_-1")
db.orders.hideIndex("item_1_qty_-1")
db.orders.find({ item: "A" }).explain("executionStats")
db.orders.aggregate([ { $indexStats: {} } ])`},
{h:'Aggregation'},
{code:`db.orders.aggregate([
  { $match: { status: "paid" } },
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 5 }
])`},
{h:'Users, roles and security'},
{code:`db.getSiblingDB("admin").createUser({ user: "admin", pwd: passwordPrompt(), roles: [ "root" ] })
db.createUser({ user: "app", pwd: passwordPrompt(), roles: [ { role: "readWrite", db: "shop" } ] })
db.getUsers()
db.grantRolesToUser("app", [ { role: "read", db: "reports" } ])
db.dropUser("app")
db.auth("user", passwordPrompt())`},
{h:'Operations and administration'},
{code:`db.currentOp({ active: true, secs_running: { $gt: 5 } })
db.killOp(<opid>)
db.serverStatus()
db.stats()
db.orders.stats()
db.setProfilingLevel(1, { slowms: 100 })
db.fsyncLock()          // then db.fsyncUnlock()
db.shutdownServer()     // from the admin database
db.adminCommand({ ping: 1 })`}]},

/* 7 ------------------------------------------------------- views / commands */
{t:'Commands, system databases and which one answers what',d:'Which command or system collection answers which question, and what lives in admin, local and config.',see:[[13,1,'Built-in commands'],[9,0,'Replica sets']],b:[
{h:'Which command answers which question'},
{t:[['Question','Command or view'],
['Is the server up and what is its state?','`db.hello()`, `db.adminCommand({ ping: 1 })`'],
['How many connections, operations, how much cache?','`db.serverStatus()`'],
['How big is a database or collection?','`db.stats()`, `db.coll.stats()`, `$collStats`'],
['What is running right now?','`db.currentOp()`, `$currentOp`'],
['What state is the replica set in, and how far behind is each member?','`rs.status()`, `rs.printSecondaryReplicationInfo()`'],
['How large is the oplog and how much time does it cover?','`rs.printReplicationInfo()`'],
['Which index is used and how often?','`$indexStats`, `explain("executionStats")`'],
['Where does the data live in a sharded cluster?','`sh.status()`, `config.chunks`, `config.shards`'],
['Is the balancer on?','`sh.getBalancerState()`, `sh.isBalancerRunning()`'],
['Which users and roles exist?','`db.getUsers()`, `db.getRoles({ showPrivileges: true })`'],
['What are the effective settings?','`db.adminCommand({ getCmdLineOpts: 1 })`, `getParameter`'],
['Which collections are hot?','`mongotop`, `db.adminCommand({ top: 1 })`'],
['Which transactions and sessions are open?','`$currentOp` with `idleSessions`, `config.system.sessions`, `config.transactions`']]},
{h:'System databases and collections'},
{t:[['Namespace','Contents'],
['`admin`','Users and roles for the deployment (`admin.system.users`, `admin.system.roles`), `system.version` (FCV)'],
['`local`','Per-member data that is not replicated: `oplog.rs`, `system.replset` (replica set config), `startup_log`'],
['`config`','Sharding metadata: `shards`, `databases`, `collections`, `chunks`, `settings`, `tags`, `mongos`; plus `system.sessions` and `transactions`'],
['`<db>.system.profile`','Profiler output (capped), per database'],
['`<db>.system.views`','Definitions of views'],
['`<db>.system.buckets.*`','Internal buckets of time series collections']]},
{note:'Do not modify `admin`, `local` or `config` by hand. Use the helper commands (`rs.reconfig`, `sh.*`, `db.createUser`).'}]},

/* 8 ------------------------------------------------------- tools */
{t:'Command-line tools and interfaces',d:'Programs that ship with or alongside MongoDB, what each is for and a typical command.',see:[[2,6,'Database tools'],[2,3,'mongosh']],b:[
{t:[['Tool','Ships with','Use','Typical command'],
['`mongod`','Server package','Run the database server','`mongod --config /etc/mongod.conf`'],
['`mongos`','Server package','Run the query router','`mongos --config /etc/mongos.conf`'],
['`mongosh`','Server package or separate','Shell and scripting','`mongosh "mongodb://host/db"`'],
['`mongodump`','Database Tools','Logical BSON backup','`mongodump --uri "$URI" --gzip --archive=dump.gz`'],
['`mongorestore`','Database Tools','Restore a dump','`mongorestore --uri "$URI" --gzip --archive=dump.gz`'],
['`mongoexport`','Database Tools','Export JSON or CSV','`mongoexport --uri "$URI" -c orders --out orders.json`'],
['`mongoimport`','Database Tools','Import JSON, CSV or TSV','`mongoimport --uri "$URI" -c products --file p.json --jsonArray`'],
['`mongostat`','Database Tools','Live server counters','`mongostat --uri "$URI" 2`'],
['`mongotop`','Database Tools','Time per collection','`mongotop --uri "$URI" 5`'],
['`mongofiles`','Database Tools','GridFS files','`mongofiles --uri "$URI" put manual.pdf`'],
['`bsondump`','Database Tools','Read BSON as JSON','`bsondump dump/shop/orders.bson`'],
['Compass','Separate download','GUI: documents, indexes, explain, aggregation builder','Open and paste the connection string'],
['Atlas CLI','Separate download','Manage Atlas projects, clusters, users, access lists','`atlas clusters list`'],
['`mongosync`','Separate download','Continuous sync between clusters (migration)','See the cluster-to-cluster sync docs'],
['Relational Migrator','Separate download','Plan and run a move from a relational database','GUI application']]},
{h:'Common mongod options'},
{t:[['Option','Meaning'],
['`--config <file>`','Read the configuration file'],
['`--dbpath <dir>`','Data directory'],
['`--port <n>`, `--bind_ip <list>`','Listener'],
['`--replSet <name>`','Replica set name'],
['`--keyFile <file>`','Internal authentication key'],
['`--auth`','Enable access control'],
['`--configsvr`, `--shardsvr`','Cluster role'],
['`--logpath <file>`, `--fork`','Log file and background (not needed under systemd)'],
['`--shutdown`','Stop a running instance (Linux), with `--dbpath`'],
['`--version`','Print the version']]}]},

/* 9 ------------------------------------------------------- operators */
{t:'Operator and stage cheat sheet',d:'Query, update and aggregation operators at a glance, with what each is for.',see:[[3,1,'Find'],[3,3,'Update'],[4,1,'Aggregation stages']],b:[
{h:'Query operators'},
{t:[['Group','Operators'],
['Comparison','`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`'],
['Logical','`$and`, `$or`, `$nor`, `$not`'],
['Element','`$exists`, `$type`'],
['Array','`$all`, `$elemMatch`, `$size`'],
['Evaluation','`$regex`, `$text`, `$expr`, `$mod`, `$jsonSchema`, `$where` (avoid)'],
['Geospatial','`$near`, `$nearSphere`, `$geoWithin`, `$geoIntersects`']]},
{h:'Update operators'},
{t:[['Group','Operators'],
['Fields','`$set`, `$unset`, `$rename`, `$setOnInsert`, `$currentDate`'],
['Numbers','`$inc`, `$mul`, `$min`, `$max`'],
['Arrays','`$push`, `$pull`, `$pop`, `$addToSet`, `$each`, `$position`, `$slice`'],
['Array positions','`$`, `$[]`, `$[<id>]` with `arrayFilters`']]},
{h:'Aggregation stages'},
{t:[['Stage','Job'],
['`$match`','Filter (use first, uses indexes)'],
['`$project`, `$addFields`/`$set`, `$unset`','Choose or compute fields'],
['`$group`','Group and accumulate'],
['`$sort`, `$limit`, `$skip`','Order and window'],
['`$unwind`','One document per array element'],
['`$lookup`','Left outer join, same database'],
['`$facet`, `$bucket`, `$bucketAuto`','Several summaries, ranges'],
['`$setWindowFields`','Window functions: running totals, ranks'],
['`$replaceRoot`, `$replaceWith`','Promote an embedded document'],
['`$out`, `$merge`','Write results to a collection'],
['`$count`, `$sortByCount`','Counts'],
['`$geoNear`','Nearest first, must be first stage'],
['`$search`, `$vectorSearch`','Atlas Search and Vector Search, must be first stage'],
['`$indexStats`, `$collStats`, `$currentOp`','Administrative views, first stage']]},
{h:'Accumulators and expressions'},
{t:[['Kind','Operators'],
['Accumulators','`$sum`, `$avg`, `$min`, `$max`, `$first`, `$last`, `$push`, `$addToSet`, `$count`, `$topN`, `$bottomN`'],
['Arithmetic','`$add`, `$subtract`, `$multiply`, `$divide`, `$round`, `$mod`'],
['Conditional','`$cond`, `$switch`, `$ifNull`'],
['String','`$concat`, `$toUpper`, `$toLower`, `$substrCP`, `$split`, `$trim`'],
['Array','`$size`, `$filter`, `$map`, `$arrayElemAt`, `$in`, `$concatArrays`'],
['Date','`$year`, `$month`, `$dateToString`, `$dateTrunc`, `$dateAdd`, `$dateDiff`'],
['Type','`$toInt`, `$toDecimal`, `$toString`, `$toObjectId`, `$convert`, `$type`']]}]},

/* 10 ------------------------------------------------------ decision tables */
{t:'Decision tables',d:'Shutdown, restart or runtime change, which backup and restore, which consistency settings, embed or reference, which index and shard key.',see:[[12,0,'Backup strategy'],[8,2,'Consistency settings'],[5,1,'Embed or reference']],b:[
{h:'Stopping a server'},
{t:[['Method','Effect','Next start'],
['`db.shutdownServer()`','Clean shutdown: step down, wait for secondaries, close, checkpoint','Clean'],
['`SIGTERM` or `systemctl stop mongod`','Same as a clean shutdown','Clean'],
['`mongod --shutdown --dbpath <dir>`','Clean shutdown from the command line (Linux)','Clean'],
['`db.shutdownServer({ force: true })`','Shuts down even if no secondary is caught up','Clean, but a primary may lose unreplicated writes'],
['`SIGKILL` or power loss','Process ends at once','Journal replay (crash recovery)']]},
{h:'Restart or runtime change?'},
{t:[['Change','Action'],
['Configuration file option (`net`, `storage`, `security`, `replication`)','Restart (one member at a time on a replica set)'],
['Parameter changeable with `setParameter`','Run it, and also add it to the config file'],
['Replica set membership, priority, votes','`rs.reconfig()` (no restart)'],
['Sharding settings and balancer window','`sh.*` helpers or the `config.settings` collection'],
['TLS certificates','Restart, or certificate rotation where supported']]},
{h:'Which backup?'},
{t:[['Need','Use'],
['A few collections or a small database','`mongodump`'],
['Large deployment, fast restore','Volume snapshot (with journal on the same volume or `fsyncLock`)'],
['Restore to a chosen minute','Base backup plus oplog (Atlas continuous backup, Ops Manager, or `--oplogReplay --oplogLimit`)'],
['Sharded cluster','Atlas cloud backup, Ops Manager, or snapshots with the balancer stopped'],
['Managed and hands-off','Atlas cloud backup']]},
{h:'Write concern'},
{t:[['Setting','Use when'],
['`w: "majority"`','Default choice. Survives failover'],
['`w: 1`','Speed matters and loss of a recent write is acceptable'],
['`w: 0`','Almost never'],
['`j: true`','Also wait for journal flush on the primary'],
['`wtimeout` / `wtimeoutMS`','Cap the time waited for acknowledgment']]},
{h:'Read concern and read preference'},
{t:[['Need','Choice'],
['Freshest data','`readPreference: primary`, `readConcern: local`'],
['Never see rolled-back data','`readConcern: majority`'],
['Read your own writes on a secondary','Causal consistency session with majority concerns'],
['Offload reports','`secondary` or a hidden or analytics member'],
['Lowest latency across regions','`nearest` (accept staleness)']]},
{h:'Embed or reference?'},
{t:[['Situation','Choose'],
['One to one or one to few, read together','Embed'],
['One to many, bounded, read together','Embed'],
['One to many, unbounded','Reference (child holds the parent id)'],
['Shared, frequently changing data','Reference'],
['Need a few fields from a parent for lists','Extended reference (copy stable fields)']]},
{h:'Which index?'},
{t:[['Query shape','Index'],
['Equality then sort then range','Compound index in ESR order'],
['Array membership','Multikey (automatic)'],
['Unique business key','Unique index'],
['Subset of documents','Partial index'],
['Expire by age','TTL index'],
['Unknown field names','Wildcard index'],
['Words and relevance','Text index or Atlas Search'],
['Locations','2dsphere'],
['Even write spread when sharding','Hashed']]},
{h:'Shard key strategy'},
{t:[['Goal','Strategy'],
['Range queries on the key','Ranged (avoid monotonic keys)'],
['Even write distribution','Hashed on a high-cardinality field'],
['Locality plus distribution','Compound, coarse field first (for example tenantId, _id)'],
['Data placed by region','Zone sharding']]}]},

/* 11 ------------------------------------------------------ troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, the likely cause and the fix, grouped by area.',see:[[13,5,'Troubleshooting playbook'],[9,6,'Failure scenarios'],[7,0,'Tuning workflow']],b:[
{h:'Connections and access'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Cannot connect from another host','`net.bindIp`, firewall, `ss -ltnp`','Bound to localhost, port blocked','Set `bindIp` to the private IP, open the port for the app hosts'],
['Authentication failed','User, `authSource`, mechanism','Wrong user database or password','Use the right `authSource`; reset the password'],
['Unauthorized to execute command','`db.runCommand({ connectionStatus: 1 })`','Role lacks the action','Grant the minimum needed role'],
['Too many connections','`db.serverStatus().connections`','Client per request, leaks, large pools','One client per process, lower `maxPoolSize`'],
['TLS handshake errors','Certificate names, CA file, expiry','Wrong host name or expired certificate','Reissue with correct SAN, fix `CAFile`']]},
{h:'Performance'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Slow query','`explain("executionStats")`','COLLSCAN or in-memory SORT','Compound index in ESR order'],
['High CPU','`db.currentOp()`, profiler','Unindexed queries, large aggregations','Index, rewrite, move reports to a secondary'],
['Slow writes','Disk latency, index count, `w: majority` lag','Too many indexes, slow disk, lagging secondary','Drop unused indexes, faster storage, fix lag'],
['Reads get slower over time','Cache and page reads in `serverStatus`','Working set exceeds RAM','More RAM, smaller documents, better indexes'],
['Deep pagination is slow','Query uses `skip`','Skip walks entries','Range pagination']]},
{h:'Replication and failover'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Secondary far behind','`rs.printSecondaryReplicationInfo()`','Resources, big batch writes','Fix the member; check oplog window'],
['Member stuck in `RECOVERING`','Log and `rs.status()`','Fell off the oplog window','Initial sync after clearing dbPath'],
['Frequent elections','Latency, clock sync, stalls','Network or time problems','Fix network and NTP'],
['No primary','`rs.status()` on every member','Majority lost','Restore members; force reconfig only as last resort'],
['Writes lost after failover','Write concern used','`w: 1` and rollback','Use `w: "majority"`, review `rollback/`']]},
{h:'Sharding'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['One shard is hot','`sh.status()`, shard key','Monotonic or low-cardinality key','Reshard or refine the key'],
['Balancer not moving data','`sh.getBalancerState()`, jumbo chunks','Disabled, window, jumbo chunk','Enable, adjust window, split or reshard'],
['Queries hit every shard','`explain()` shows `SHARD_MERGE`','Filter lacks the shard key','Add the key to filters or change the key']]},
{h:'Storage'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Disk nearly full','`df`, `db.stats()`','Data and index growth, logs, dumps','Remove non-database files, TTL, archive, grow volume'],
['mongod will not start','Log tail, `mongod.lock`, permissions, disk','Unclean stop, wrong owner, full disk','Fix cause; replay happens automatically'],
['Files do not shrink after delete','`freeStorageSize`','Space reused but not returned','`compact`, rolling resync or drop']]}]},

/* 12 ------------------------------------------------------ errors */
{t:'Common error messages',d:'The messages and error codes you will see most, with the usual cause and the fix.',see:[[13,5,'Troubleshooting'],[8,1,'Transactions']],b:[
{h:'Connection and authentication'},
{t:[['Message or name','Code','Cause','Fix'],
['`AuthenticationFailed`','18','Wrong credentials or `authSource`','Check user, password, database of the user'],
['`Unauthorized` (not authorized on ... to execute command)','13','Role lacks the action','Grant the right role'],
['`MongoServerSelectionError` / `ServerSelectionTimeout`','driver','No suitable server in the time allowed','Check network, replica set name, read preference, DNS'],
['`HostUnreachable`, `HostNotFound`','6, 7','Network or DNS problem','Check hostnames and firewall'],
['`NetworkTimeout`','89','Slow or lost network','Check latency, increase timeouts reasonably'],
['`SocketException` / connection reset','network','Server restarted or network dropped','Driver reconnects; look at server log']]},
{h:'Writes and data'},
{t:[['Message or name','Code','Cause','Fix'],
['`E11000 duplicate key error`','11000','Value exists in a unique index (including `_id`)','Use upsert or handle the error'],
['`DocumentValidationFailure`','121','Document breaks the validator','Fix the document or the rule'],
['`WriteConflict`','112','Two writes or a transaction conflicted','Retry (transactions: retry the transaction)'],
['`BSONObjectTooLarge`','10334','Document over 16 MiB','Split data, use GridFS'],
['`ImmutableField`','66','Tried to change `_id` or shard key value not allowed','Insert a new document'],
['`WriteConcernFailed` / `wtimeout`','64','Not enough members acknowledged in time','Check member health and lag'],
['`NamespaceNotFound`','26','Collection or database missing','Create it or fix the name'],
['`NamespaceExists`','48','Collection already exists','Ignore or drop first'],
['`IndexOptionsConflict`, `IndexKeySpecsConflict`','85, 86','Same keys with different options or name','Drop the old index or use the same options']]},
{h:'Replication and operations'},
{t:[['Message or name','Code','Cause','Fix'],
['`NotWritablePrimary` (was `NotMaster`)','10107','Sent a write to a member that is not primary','Use the replica set connection string; retry'],
['`NotPrimaryNoSecondaryOk`','13435','Read from a secondary without a secondary read preference','Set `readPreference`'],
['`NotPrimaryOrSecondary`','13436','Member is in startup, recovering or rollback','Wait or check state'],
['`PrimarySteppedDown`, `InterruptedDueToReplStateChange`','189, 11602','Failover happened during the operation','Retry (retryable writes do this)'],
['`ShutdownInProgress`','91','Server is stopping','Retry on another member'],
['`CursorNotFound`','43','Cursor expired or server restarted','Iterate faster or restart the query'],
['`MaxTimeMSExpired`','50','Operation hit `maxTimeMS`','Optimize or raise the limit deliberately'],
['`QueryExceededMemoryLimitNoDiskUseAllowed`','292','Blocking stage over 100 MB without disk use','Add an index, allow disk use, reduce data'],
['`NoSuchTransaction`','251','Transaction aborted or expired','Retry the whole transaction'],
['`FailedToSatisfyReadPreference`','133','No member matches the read preference or tags','Check member state and tags']]}]},

/* 13 ------------------------------------------------------ health checks */
{t:'Health-check shell pack',d:'Paste-ready mongosh snippets for the daily and weekly checks, grouped by what you are checking.',see:[[13,1,'Built-in commands'],[14,0,'Routine maintenance']],b:[
{p:'Run as a user with `clusterMonitor` (or higher). Counters grow since the last restart, so compare two readings when you need a rate.'},
{h:'1. Instance basics'},
{code:`db.version()
db.hello()
const s = db.serverStatus();
printjson({ host: s.host, uptimeHours: Math.round(s.uptime / 3600), connections: s.connections })
db.adminCommand({ getParameter: 1, featureCompatibilityVersion: 1 })
db.adminCommand({ getCmdLineOpts: 1 }).parsed`},
{h:'2. Replica set'},
{code:`rs.status().members.map(m => m.name + "  " + m.stateStr + "  health=" + m.health)
rs.printSecondaryReplicationInfo()
rs.printReplicationInfo()
rs.conf().members.map(m => ({ host: m.host, priority: m.priority, votes: m.votes, hidden: m.hidden }))`},
{h:'3. Operations and locks'},
{code:`// Running longer than 5 seconds
db.currentOp({ active: true, secs_running: { $gt: 5 } }).inprog.map(o => ({ opid: o.opid, ns: o.ns, secs: o.secs_running, plan: o.planSummary }))

// Waiting for locks
db.currentOp({ waitingForLock: true }).inprog.length

// Open transactions
db.getSiblingDB("admin").aggregate([ { $currentOp: { allUsers: true, idleSessions: true } }, { $match: { transaction: { $exists: true } } } ])`},
{h:'4. Memory and cache'},
{code:`const c = db.serverStatus().wiredTiger.cache;
printjson({
  configuredGB: c["maximum bytes configured"] / 1e9,
  usedGB: c["bytes currently in the cache"] / 1e9,
  dirtyGB: c["tracked dirty bytes in the cache"] / 1e9,
  pagesReadIn: c["pages read into cache"]
})`},
{h:'5. Storage'},
{code:`db.adminCommand({ listDatabases: 1 }).databases.map(d => ({ db: d.name, GB: +(d.sizeOnDisk / 1e9).toFixed(2) }))

// Largest collections in the current database
db.getCollectionNames().map(n => ({ n, GB: +(db[n].stats().storageSize / 1e9).toFixed(2), docs: db[n].estimatedDocumentCount() })).sort((a, b) => b.GB - a.GB).slice(0, 10)

// Index sizes of one collection
db.orders.stats().indexSizes`},
{h:'6. Indexes'},
{code:`db.orders.getIndexes()
db.orders.aggregate([ { $indexStats: {} }, { $project: { name: 1, ops: "$accesses.ops", since: "$accesses.since" } } ])`},
{h:'7. Sharding'},
{code:`sh.status()
sh.getBalancerState()
use config
db.chunks.aggregate([ { $group: { _id: "$shard", chunks: { $sum: 1 } } } ])`},
{h:'8. Security'},
{code:`db.getSiblingDB("admin").getUsers().map(u => u.user + ": " + u.roles.map(r => r.role + "@" + r.db).join(", "))
db.adminCommand({ getParameter: 1, authenticationMechanisms: 1 })`}]},

/* 14 ------------------------------------------------------ naming decoder */
{t:'Naming decoder',d:'How to read ObjectIds, replication timestamps, oplog entries, namespaces, index names and connection strings.',see:[[1,1,'BSON and ObjectId'],[1,4,'The oplog'],[2,4,'Connection strings']],b:[
{h:'ObjectId: 12 bytes, 24 hex characters'},
{t:[['Part','Bytes','Meaning','Example `66f1a2b3c4d5e6f708192a3b`'],
['Timestamp','4','Seconds since the Unix epoch when it was created','`66f1a2b3`'],
['Random value','5','Random per process','`c4d5e6f708`'],
['Counter','3','Increments for each new id in the process','`192a3b`']]},
{code:`ObjectId("66f1a2b3c4d5e6f708192a3b").getTimestamp()   // creation time as a date
ObjectId.createFromTime(1735689600)                   // smallest ObjectId for a time, useful for range queries`},
{h:'Timestamp type (replication)'},
{t:[['Form','Meaning'],
['`Timestamp({ t: 1773140400, i: 3 })`','Seconds since the epoch and an ordinal within that second. Used in the oplog and for `--oplogLimit`'],
['`operationTime`, `clusterTime`','Logical times used by causal consistency']]},
{h:'Oplog entry fields'},
{t:[['Field','Meaning'],
['`ts`','Timestamp of the operation'],
['`op`','`i` insert, `u` update, `d` delete, `c` command, `n` no-op'],
['`ns`','Namespace `database.collection` (for commands `database.$cmd`)'],
['`o`','The document or the command'],
['`o2`','The filter, such as `{ _id: ... }` for updates'],
['`ui`','UUID of the collection'],
['`wall`','Wall clock time of the operation']]},
{h:'Namespaces and names'},
{t:[['Thing','Form','Notes'],
['Namespace','`shop.orders`','Database name plus collection name'],
['Default index name','`<field>_<dir>` joined by `_`','`item_1_qty_-1`'],
['Text index name','`<field>_text`','`title_text_body_text`'],
['Collection UUID','`UUID("...")`','Stable identity across renames and replication'],
['Internal collections','`system.*`, `system.buckets.*`','Created by the server'],
['Time series buckets','`system.buckets.<name>`','Internal storage of a time series collection']]},
{h:'Connection string anatomy'},
{code:`mongodb+srv://user:pass@cluster0.ab1cd.mongodb.net/shop?retryWrites=true&w=majority&appName=shopapi
|scheme       |credentials|host or SRV name        |db  |options`},
{h:'Server states in rs.status()'},
{t:[['State','Meaning'],
['`PRIMARY`','Accepts writes'],
['`SECONDARY`','Replicating, can serve reads'],
['`STARTUP`, `STARTUP2`','Starting, or running initial sync'],
['`RECOVERING`','Catching up or not ready for reads'],
['`ARBITER`','Votes only'],
['`ROLLBACK`','Reverting writes after a failover'],
['`DOWN`, `UNKNOWN`','Not reachable from this member'],
['`REMOVED`','No longer part of the set']]}]},

/* 15 ------------------------------------------------------ security checklist */
{t:'Security checklist',d:'Authentication, roles, TLS, encryption and network settings in one review list, with a built-in role lookup.',see:[[11,0,'Checklist'],[11,2,'RBAC'],[11,3,'TLS']],b:[
{h:'Review list'},
{t:[['Check','How to verify','Good'],
['Access control is on','`getCmdLineOpts` shows `security.authorization`','`enabled`'],
['Members authenticate internally','`security.keyFile` or x.509 set','Present on every member'],
['Listening only where needed','`net.bindIp` and `ss -ltnp`','Private interfaces only'],
['Firewall limits the port','Security groups or firewall rules','App and admin hosts only'],
['TLS is required','`net.tls.mode`','`requireTLS`'],
['No root-like roles for applications','`db.getUsers()`','Least privilege roles'],
['Passwords are strong and not in code','Secret manager','Yes'],
['Encryption at rest','Enterprise engine, volume or Atlas encryption','On'],
['Auditing for sensitive deployments','`auditLog` settings','On with a filter'],
['Version is supported and patched','`db.version()` and lifecycle page','Latest patch of a supported major'],
['Server runs as a dedicated OS user','`ps -ef`','Not root'],
['Backups and keys are protected','Access review','Restricted']]},
{h:'Built-in roles'},
{t:[['Role','Scope','What it allows'],
['`read`, `readWrite`','One database','Read, or read and write, non-system collections'],
['`dbAdmin`','One database','Indexes, stats, validation, no data access'],
['`userAdmin`','One database','Create users and roles'],
['`dbOwner`','One database','readWrite, dbAdmin and userAdmin'],
['`readAnyDatabase`, `readWriteAnyDatabase`','All databases','Wide access, use rarely'],
['`userAdminAnyDatabase`','All databases','Manage users everywhere'],
['`clusterMonitor`','Cluster','Monitoring commands (read only)'],
['`clusterManager`, `clusterAdmin`','Cluster','Cluster management, admin'],
['`backup`, `restore`','Cluster','Backup and restore tools'],
['`root`','All','Everything. Avoid for applications']]},
{h:'Authentication mechanisms'},
{t:[['Mechanism','Edition'],
['SCRAM-SHA-256 (and SHA-1)','All'],
['x.509 certificates','All'],
['LDAP, Kerberos','Enterprise, Atlas (LDAP)'],
['OpenID Connect','Enterprise, Atlas'],
['AWS IAM','Atlas']]}]},

/* 16 ------------------------------------------------------ OS settings */
{t:'OS settings',d:'Kernel parameters, limits, file system and firewall settings that matter on a Linux database server.',see:[[1,6,'Memory, CPU, I/O'],[2,1,'Installing']],b:[
{p:'Values follow the MongoDB production notes at the time of writing. Check the notes for your version, because recommendations change between releases.'},
{t:[['Setting','Recommended','Check','Why'],
['Open files (`nofile`)','64000 or more','`ulimit -n`, `cat /proc/$(pidof mongod)/limits`','Each connection and file needs a descriptor'],
['Processes (`nproc`)','64000 or more','`ulimit -u`','Threads per connection'],
['Transparent Huge Pages','As the production notes say for your version: disabled for 7.0 and earlier, enabled for 8.0 and later','`cat /sys/kernel/mm/transparent_hugepage/enabled`','Latency and memory behavior of the allocator'],
['`vm.swappiness`','1 (not 0)','`sysctl vm.swappiness`','Avoid swapping the cache'],
['NUMA','Interleave memory on multi-socket hosts (`numactl --interleave=all`) or disable zone reclaim','`numactl --hardware`','Avoid uneven memory use'],
['`vm.zone_reclaim_mode`','0','`sysctl vm.zone_reclaim_mode`','Avoid stalls'],
['File system','XFS (or ext4) on local SSD or NVMe','`df -T`','Avoid network file systems for dbPath'],
['Mount option','`noatime`','`mount`','Fewer metadata writes'],
['Read-ahead','Low value for the data volume, per the production notes','`blockdev --getra <dev>`','Random access pattern'],
['TCP keepalive','`net.ipv4.tcp_keepalive_time` 120 seconds','`sysctl net.ipv4.tcp_keepalive_time`','Detect dead connections sooner'],
['`vm.max_map_count`','High enough for many files (for example 102400 or more)','`sysctl vm.max_map_count`','Memory mappings'],
['Time sync','chrony or ntpd on every member','`chronyc tracking`','Elections, TLS and logs depend on clocks'],
['Swap','Small, only as a safety net','`swapon --show`','Swapping hurts latency badly']]},
{h:'systemd, SELinux and firewall'},
{t:[['Topic','Detail'],
['Service limits','Package unit sets `LimitNOFILE`; override in a drop-in file when needed: `systemctl edit mongod`'],
['SELinux','Custom data or log paths need the right labels, for example `semanage fcontext -a -t mongod_var_lib_t "/data/db(/.*)?"` then `restorecon -Rv /data/db`'],
['Ports','27017 (mongod and mongos), 27018 (shard servers), 27019 (config servers), plus replica set member traffic between hosts'],
['Firewall','Allow only application, admin and member hosts to the ports']]}]},

/* 17 ------------------------------------------------------ limits */
{t:'Limits and thresholds',d:'The hard limits and default thresholds worth knowing when designing or troubleshooting.',see:[[1,1,'BSON limits'],[8,1,'Transactions'],[9,0,'Replica set members']],b:[
{t:[['Limit','Value','Notes'],
['BSON document size','16 MiB','Use GridFS or split data above it'],
['Document nesting depth','100 levels',''],
['Database name','Under 64 characters','No `/ \\ . " $` and spaces'],
['Namespace length','About 255 bytes for `db.collection`','Check the limits page for your version'],
['Indexes per collection','64',''],
['Fields in a compound index','32',''],
['Text indexes per collection','1',''],
['Replica set members','50, with at most 7 voting',''],
['Blocking sort or `$group` memory','100 MB per stage','Spills to disk by default since 6.0 for aggregation'],
['Transaction lifetime','60 seconds by default','`transactionLifetimeLimitSeconds`'],
['Idle cursor timeout','10 minutes',''],
['Default chunk size','128 MB','Sharded collections'],
['First cursor batch','101 documents or 16 MiB',''],
['Default `slowms`','100 ms',''],
['Heartbeat interval','2 seconds','Election timeout default 10 seconds'],
['Connection pool (driver)','`maxPoolSize` 100','Per server and client'],
['Oplog default size','5% of free disk, within bounds','Resize with `replSetResizeOplog`'],
['Capped collection','Fixed size, no sharding, no deletes of single documents','']]},
{note:'Limits change between versions. The manual page Limits and Thresholds for your version is the authority.'}]},

/* 18 ------------------------------------------------------ versions */
{t:'Versions and support',d:'What recent major releases brought and where to confirm support dates.',see:[[0,4,'Versions and lifecycle'],[14,2,'Upgrades']],b:[
{t:[['Release','Released','Notable changes'],
['5.0','July 2021','Time series collections, live resharding, default `w: "majority"`, versioned API, `mongosh` as the shell'],
['6.0','July 2022','Change stream pre and post images, more `$lookup` and `$group` work on sharded data, cluster-to-cluster sync, queryable encryption preview, aggregation spills to disk by default'],
['7.0','August 2023','Queryable Encryption general availability, compound wildcard indexes, shard key analysis tools, search and AI features in Atlas'],
['8.0','October 2024','Performance work for reads and writes, bulk write command, moving and unsharding collections, config server as a shard option, queryable encryption range queries in preview']]},
{h:'Release types'},
{t:[['Type','Example','Use'],
['Major release','7.0, 8.0','Long-term production use'],
['Rapid release','8.1, 8.2','Newest features, shorter support, mainly for Atlas'],
['Patch release','8.0.x','Fixes. Stay on the latest patch']]},
{h:'Support dates'},
{p:'Each major release has an end-of-life date on the MongoDB support policy page. Check it before planning an upgrade. Do not rely on a date copied from a document, including this one.'},
{ul:['Upgrade one major release at a time.','Before raising the feature compatibility version, run the new binaries for a while.','Check driver compatibility tables for the new server version.']},
{note:'Release dates above are approximate and release content is summarized. Use the release notes for the exact list.'}]},

/* 19 ------------------------------------------------------ atlas */
{t:'Atlas: where things are',d:'Where to find features in Atlas and the Atlas CLI commands behind them.',see:[[15,0,'Atlas architecture'],[15,3,'Automation'],[11,6,'Atlas security']],b:[
{t:[['Task','Atlas UI','CLI or API'],
['List clusters','Database, Clusters','`atlas clusters list`'],
['Create a cluster','Create, choose tier and region','`atlas clusters create <name> --provider AWS --region EU_WEST_1 --tier M10`'],
['Add a database user','Database Access','`atlas dbusers create`'],
['Allow an IP address','Network Access, IP access list','`atlas accessLists create`'],
['Private endpoint','Network Access, Private Endpoint','`atlas privateEndpoints`'],
['Metrics and alerts','Cluster, Metrics; Alerts','`atlas alerts list`'],
['Slow queries and index advice','Performance Advisor, Query Profiler','Admin API'],
['Live operations','Real-time panel','Admin API'],
['Backups and restores','Backup','`atlas backups snapshots list`, `atlas backups restores start`'],
['Search and vector indexes','Atlas Search','`atlas clusters search indexes create`'],
['Archive cold data','Online Archive','Admin API'],
['Logs','Cluster, Logs (download)','`atlas logs download`'],
['Billing and budget','Organization, Billing','Admin API']]},
{h:'Habits'},
{ul:['One project per environment, with its own access list and users.','Never use `0.0.0.0/0` in the access list for real data.','Prefer private endpoints for production traffic.','Set auto-scaling limits and billing alerts.','Take an on-demand snapshot before risky changes.']},
{note:'Tier names, limits and CLI command names change over time. Check the Atlas documentation and `atlas --help` for the current form.'}]}
]};
