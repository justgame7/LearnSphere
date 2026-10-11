/* LearnSphere - MongoDB, Section 02: Architecture & Storage Engine.
   Lectures 0-6 are core, 7-8 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const procs=M.dg(700,250,[
[10,10,680,230,'Sharded deployment: who talks to whom',1],
[30,95,110,55,'Application|driver',0],
[190,95,130,55,'mongos|query router',2],
[380,30,150,50,'Config servers|metadata (replica set)',0],
[380,115,130,50,'Shard 1|mongod replica set',0],[540,115,130,50,'Shard 2|mongod replica set',0],
[380,180,290,40,'Standalone or replica set:|driver talks to mongod directly',0]],
[[140,122,190,122],[320,110,380,55],[320,125,380,140],[320,135,540,140]]);

const idoc=M.dg(700,110,[
[10,25,680,60,'ObjectId, 12 bytes',1],
[30,50,220,28,'4 bytes: creation time (seconds)',0],[260,50,190,28,'5 bytes: random per process',0],[460,50,210,28,'3 bytes: incrementing counter',0]],
[]);

const wt=M.dg(700,200,[
[10,10,680,180,'Life of a write in WiredTiger',1],
[30,70,110,55,'Write from|client',0],[170,70,130,55,'In-memory cache|updated first',2],[340,30,150,50,'Journal|write-ahead log',0],
[340,120,150,50,'Checkpoint|every 60 s',0],[530,70,130,55,'Data files|.wt on disk',0]],
[[140,97,170,97],[300,85,340,55],[300,110,340,145],[490,145,530,110]]);

const oplog=M.dg(700,150,[
[10,10,680,130,'The oplog connects write, replication and recovery',1],
[30,55,120,50,'Write on|primary',0],[190,55,150,50,'local.oplog.rs|ordered log of changes',2],
[400,30,130,40,'Secondary applies',0],[400,85,130,40,'Change streams',0],[560,55,110,50,'Point-in-time|restore',0]],
[[150,80,190,80],[340,75,400,50],[340,85,400,105],[340,80,560,80]]);

const layout=M.dg(700,170,[
[10,10,680,150,'Typical contents of dbPath',1],
[30,50,200,90,'Collection and index files|collection-*.wt|index-*.wt',0],
[250,50,200,90,'Engine metadata|WiredTiger.wt|_mdb_catalog.wt|mongod.lock',0],
[470,50,200,90,'journal/|write-ahead log files|diagnostic.data/',2]],
[]);

const mem=M.dg(700,160,[
[10,10,680,140,'RAM on a MongoDB host',1],
[30,50,190,80,'WiredTiger cache|uncompressed pages|default 50% of (RAM - 1 GB)',2],
[250,50,200,80,'Filesystem cache|compressed pages|read from disk files',0],
[480,50,190,80,'OS, connections,|sorts, aggregations|and other processes',0]],
[]);

/* ---------- 0: Process family ---------- */
L['mongo:1:0']={blocks:[
{p:'A MongoDB deployment is built from just a few programs. Knowing what each one does makes every later topic (replication, sharding, security) easier to follow.'},
{svg:procs},
{h:'The processes'},
{t:[['Process','Role','Default port'],
['**mongod**','The database server. Stores data, handles reads and writes, runs replication and the storage engine.','27017'],
['**mongos**','A query router used only in sharded clusters. Sends each operation to the right shard(s).','27017'],
['**Config server** (mongod with `--configsvr`)','Stores cluster metadata: which data lives on which shard. Runs as a replica set.','27019'],
['**mongosh**','Interactive shell client, not a server.','n/a']]},
{h:'How a request flows'},
{flow:['The application uses a driver and a connection string','The driver connects to mongod (or to a mongos in a sharded cluster)','The server authenticates and authorizes the user','The query planner chooses a plan and the storage engine reads or writes data','The result goes back through the driver']},
{h:'Three common shapes'},
{t:[['Shape','Processes involved'],
['**Standalone**','One mongod. Development only.'],
['**Replica set**','Three or more mongod members. Applications connect to the set and the driver finds the primary.'],
['**Sharded cluster**','mongos routers, a config server replica set, and several shard replica sets.']]},
{note:'A shard is itself a replica set of mongod processes. Sharded clusters add routing and metadata on top of replica sets rather than replacing them.'}],
src:[['MongoDB programs',MAN+'reference/program/'],['Sharding architecture',MAN+'sharding/']]};

/* ---------- 1: BSON ---------- */
L['mongo:1:1']={blocks:[
{p:'MongoDB stores documents in **BSON**, a binary format that extends JSON with more data types and is efficient to traverse. The types you choose affect storage size, sorting and query behavior.'},
{h:'The types you will use most'},
{t:[['Type','Example in mongosh','Notes'],
['**String**','"Asha"','UTF-8'],
['**Int32 / Int64**','NumberInt(5), NumberLong(5)','Plain numbers in the shell are doubles by default'],
['**Double**','3.14','64-bit floating point'],
['**Decimal128**','NumberDecimal("19.99")','Exact decimal. Use for money.'],
['**Boolean**','true','true or false'],
['**Date**','ISODate("2026-01-15T09:30:00Z")','Stored as milliseconds since the Unix epoch, UTC'],
['**ObjectId**','ObjectId()','12-byte unique id, default `_id`'],
['**Array**','[1, 2, 3]','Ordered list, can hold any types'],
['**Object**','{ city: "Pune" }','Embedded document'],
['**Null**','null','Explicit null value'],
['**BinData**','BinData(0, ...)','Binary data'],
['**Timestamp**','Timestamp(...)','Internal use, replication ordering']]},
{h:'ObjectId'},
{svg:idoc},
{p:'An ObjectId is generated by the driver, is **roughly time-ordered** and is unique without coordination, so many clients can insert at once. You may also use your own `_id` value of any type except array.'},
{h:'Limits to remember'},
{t:[['Limit','Value'],
['Maximum document size','**16 MiB**'],
['Maximum nesting depth','100 levels'],
['Field names','Cannot contain the null character; avoid starting with `$` and containing `.`'],
['Larger files','Use **GridFS** to store files bigger than 16 MiB']]},
{h:'Comparing values of different types'},
{p:'MongoDB defines a fixed **comparison order** across types (for example numbers sort before strings). Mixing types in one field makes sorting and range queries surprising, so keep each field to one type.'},
{note:'Store money with Decimal128 or as an integer number of minor units (cents). Doubles cannot represent many decimal fractions exactly.'}],
src:[['BSON types',MAN+'reference/bson-types/'],['Limits and thresholds',MAN+'reference/limits/'],['ObjectId',MAN+'reference/method/ObjectId/']]};

/* ---------- 2: WiredTiger ---------- */
L['mongo:1:2']={blocks:[
{p:'**WiredTiger** is the storage engine MongoDB has used by default since version 3.2. The storage engine decides how data is kept in memory and on disk. It is where most performance and capacity behavior comes from.'},
{svg:wt},
{h:'What WiredTiger gives you'},
{t:[['Feature','What it means'],
['**Document-level concurrency**','Writers lock only the document they change, so many writes to one collection proceed in parallel.'],
['**MVCC snapshots**','Readers see a consistent snapshot and are not blocked by writers.'],
['**Compression**','Collections use **snappy** by default. **zstd** and **zlib** compress more at more CPU cost. Indexes use prefix compression.'],
['**Internal cache**','Default size is the larger of 50% of (RAM minus 1 GB) or 256 MB.'],
['**Journaling and checkpoints**','Durability after a crash (next lecture).']]},
{h:'B-trees and the cache'},
{p:'Collections and indexes are stored as **B-trees** in separate files. Pages are read from disk into the WiredTiger cache, changed in memory and written back at checkpoints. Data in the cache is uncompressed, so the cache holds less than the on-disk size suggests it would.'},
{h:'Choosing a compression level'},
{t:[['Compressor','Compression','CPU','Use when'],
['snappy','Moderate','Low','Default, balanced'],
['zstd','Higher','Medium','Save disk and I/O, CPU is available'],
['zlib','High','Higher','Rarely; zstd is usually better'],
['none','None','Lowest','Data already compressed or maximum speed']]},
{code:`// Create a collection that uses zstd block compression
db.createCollection("events", {
  storageEngine: { wiredTiger: { configString: "block_compressor=zstd" } }
})`},
{note:'Do not change the cache size without evidence. The operating system file cache also holds data, and both matter. Section 8 covers sizing.'}],
src:[['WiredTiger storage engine',MAN+'core/wiredtiger/'],['Storage engines',MAN+'core/storage-engines/']]};

/* ---------- 3: Journal and durability ---------- */
L['mongo:1:3']={blocks:[
{p:'Changes are first applied in memory, so a crash must not lose acknowledged data. Two mechanisms protect it: the **journal** and **checkpoints**.'},
{h:'Journal (write-ahead log)'},
{ul:['Every change is recorded in the journal on disk before the cache change is considered durable.','The journal is flushed on a short interval (default **100 ms**) or immediately for writes that ask for journal acknowledgment (`j: true`).','After a crash, MongoDB **replays the journal** from the last checkpoint to recover recent writes.']},
{h:'Checkpoints'},
{ul:['WiredTiger writes a consistent snapshot of all data files to disk about every **60 seconds**.','A checkpoint is a recovery point: data files are always in a consistent state at the last checkpoint.','Journal files older than the last checkpoint are no longer needed.']},
{h:'Recovery after an unclean shutdown'},
{flow:['Server starts and finds an unclean shutdown','Load data files at the last checkpoint','Replay journal records written after that checkpoint','Open for connections; replication then catches up from other members']},
{h:'Durability settings you control'},
{t:[['Setting','Where','Effect'],
['**j: true** (write concern)','Per operation','Wait until the write is in the on-disk journal'],
['**w: "majority"**','Per operation or default','Wait for a majority of replica set members; the default for most writes since 5.0'],
['**commitIntervalMs**','Server config','How often the journal is flushed'],
['**Replica set**','Deployment','Copies on other machines survive the loss of one machine']]},
{note:'Do not disable journaling in production. Storing journal files on slow or shared storage directly hurts write latency.'}],
src:[['Journaling',MAN+'core/journaling/'],['Write concern',MAN+'reference/write-concern/']]};

/* ---------- 4: Oplog ---------- */
L['mongo:1:4']={blocks:[
{p:'The **oplog** (operations log) is a special capped collection, `local.oplog.rs`, that exists on every replica set member. It records every change that modifies data, in order.'},
{svg:oplog},
{h:'What it is used for'},
{t:[['Use','How the oplog helps'],
['**Replication**','Secondaries copy the primary oplog entries and apply them.'],
['**Change streams**','Applications subscribe to a stream built from oplog entries.'],
['**Point-in-time recovery**','Restoring a backup then replaying the oplog up to a chosen moment.']]},
{h:'Key properties'},
{ul:['**Capped**: fixed size; the oldest entries are overwritten when it is full.','**Idempotent**: applying an entry twice gives the same result, which makes recovery safe.','The oplog **window** is how much time it covers. If a secondary falls behind longer than the window it must do a full resync.','Default size on WiredTiger is **5% of free disk**, between about 1 GB and 50 GB.']},
{h:'Looking at it'},
{code:`// Oplog size and the time window it covers
rs.printReplicationInfo()

// Last few oplog entries
db.getSiblingDB("local").oplog.rs.find().sort({ $natural: -1 }).limit(3)

// Resize the oplog on a member (size in MB)
db.adminCommand({ replSetResizeOplog: 1, size: 16384 })`},
{note:'A standalone mongod has no oplog. Converting a standalone to a replica set is how you enable it. Replication itself is covered in Section 10.'}],
src:[['Replica set oplog',MAN+'core/replica-set-oplog/'],['Change the oplog size',MAN+'tutorial/change-oplog-size/']]};

/* ---------- 5: On-disk layout ---------- */
L['mongo:1:5']={blocks:[
{p:'The **dbPath** directory is where mongod keeps everything. Knowing what is in it helps with sizing, backups and troubleshooting.'},
{svg:layout},
{h:'Files and what they are'},
{t:[['File or folder','Purpose'],
['`collection-*.wt`','One file per collection'],
['`index-*.wt`','One file per index'],
['`WiredTiger`, `WiredTiger.wt`, `WiredTiger.turtle`','Engine metadata and checkpoint information'],
['`_mdb_catalog.wt`','Catalog mapping collection and index names to files'],
['`journal/`','Write-ahead log files'],
['`mongod.lock`','Marks the data directory as in use'],
['`diagnostic.data/`','Rolling metrics for support analysis (FTDC)']]},
{h:'Layout options'},
{t:[['Option','Effect'],
['**directoryPerDB**','A subfolder per database'],
['**wiredTigerDirectoryForIndexes**','Separate `index/` and `collection/` folders so you can put them on different disks'],
['**journal on its own volume**','Isolates the sequential journal I/O (symlink the folder)']]},
{h:'Sizing rules of thumb'},
{ul:['Plan disk for data plus indexes plus **headroom**; do not run a volume near full.','Remember the oplog size and room for backups or snapshots on the same host.','Prefer **XFS** on Linux with SSD or NVMe storage. Avoid network filesystems such as NFS for dbPath.']},
{code:`# Disk used by the data directory
du -sh /var/lib/mongodb

// In mongosh: logical and storage size of one database
db.stats()`},
{note:'Never copy or delete files in dbPath while mongod is running. Use backup tools or a consistent snapshot (Section 13).'}],
src:[['Storage options',MAN+'reference/configuration-options/#storage-options'],['Production notes',MAN+'administration/production-notes/']]};

/* ---------- 6: Memory, CPU, I/O ---------- */
L['mongo:1:6']={blocks:[
{p:'MongoDB performance depends on how well the **working set** (the data and indexes you actually use) fits in memory, and how fast storage can serve what does not.'},
{svg:mem},
{h:'Memory'},
{ul:['Reads hit the WiredTiger cache first, then the filesystem cache, then disk.','If the working set exceeds RAM, performance falls as the system pages data from disk.','**Indexes** should fit in memory in practice, because every query uses them.','Sorts, aggregations and connections also use memory outside the cache.']},
{h:'CPU'},
{ul:['Compression, aggregations, index builds and many concurrent operations use CPU.','More cores help concurrency; a few fast cores often help single slow queries.']},
{h:'Storage I/O'},
{ul:['**Latency** matters more than raw throughput for most workloads.','Use SSD or NVMe, local or provisioned IOPS on cloud volumes.','Spread journal, data and logs only if you can measure a benefit.']},
{h:'Quick sizing table'},
{t:[['Resource','Signal that it is short','First action'],
['RAM','Cache evictions rise, page faults, high disk reads','Add RAM or reduce working set with indexes and schema changes'],
['CPU','CPU near 100%, slow aggregations','Optimize queries, add cores'],
['Disk','High queue depth and latency','Faster storage, more IOPS'],
['Connections','Connection count near limit','Pool connections, fix leaks (Section 8)']]},
{h:'Operating system settings that matter'},
{ul:['Set **Transparent Huge Pages** as the production notes say for your version: they recommend it **disabled for 7.0 and earlier** and **enabled for 8.0 and later**.','Raise open file and process limits (ulimit).','Set low **swappiness**, and keep swap only as a safety net.','Use the `noatime` mount option on the data volume.']},
{note:'Section 8 shows how to measure cache pressure with serverStatus and decide between more RAM and better indexes.'}],
src:[['Production notes',MAN+'administration/production-notes/'],['UNIX ulimit settings',MAN+'reference/ulimit/']]};
})();
