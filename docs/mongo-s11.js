/* LearnSphere - MongoDB, Section 11: Sharding & Horizontal Scaling.
   Lectures 0-6 are core, 7-8 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const ladder=M.dg(700,130,[
[10,10,680,110,'Try these before sharding',1],
[30,50,120,50,'Indexes and|query fixes',2],[170,50,120,50,'Schema|changes',0],[310,50,120,50,'Bigger|machine',0],[450,50,100,50,'Read|replicas',0],[570,50,100,50,'Shard',2]],
[[150,75,170,75],[290,75,310,75],[430,75,450,75],[550,75,570,75]]);

const arch=M.dg(700,250,[
[10,10,680,230,'Sharded cluster',1],
[30,95,110,55,'Application|driver',0],
[180,60,130,45,'mongos',2],[180,140,130,45,'mongos',2],
[360,25,150,50,'Config servers|replica set',0],
[360,110,90,60,'Shard 1|replica set',0],[470,110,90,60,'Shard 2|replica set',0],[580,110,90,60,'Shard 3|replica set',0],
[360,190,310,35,'Each shard holds a subset of the data (chunks)',0]],
[[140,115,180,85],[140,125,180,160],[310,75,360,50],[310,85,360,130],[310,85,470,130],[310,85,580,130]]);

const key=M.dg(700,150,[
[10,10,680,130,'A good shard key',1],
[30,55,190,55,'High cardinality|many distinct values',2],[255,55,190,55,'Even frequency|no hot values',2],[480,55,190,55,'Not monotonic|not always increasing',2]],
[]);

const chunk=M.dg(700,150,[
[10,10,680,130,'Chunks and the balancer',1],
[30,55,170,55,'Shard 1|many chunks',0],[265,55,170,55,'Balancer|moves chunks',2],[500,55,170,55,'Shard 2|few chunks',0]],
[[200,82,265,82],[435,82,500,82]]);

const route=M.dg(700,150,[
[10,10,330,130,'Targeted: shard key in filter',1],[360,10,330,130,'Scatter-gather: no shard key',1],
[30,55,100,50,'mongos',2],[200,55,120,50,'One shard',0],
[380,55,80,50,'mongos',2],[520,35,150,30,'Shard 1',0],[520,75,150,30,'Shard 2, 3 ...',0]],
[[130,80,200,80],[460,70,520,50],[460,80,520,90]]);

/* ---------- 0: why and when ---------- */
L['mongo:10:0']={blocks:[
{p:'**Sharding** splits a collection across several servers (shards) so that data size and throughput are no longer limited by one machine. It is powerful, but it adds complexity, so it is a **last resort**, not a starting point.'},
{svg:ladder},
{h:'Signs you may need it'},
{ul:['Data size exceeds what one server can store or **back up and restore in time**.','Write throughput exceeds a single primary, and a bigger machine is no longer possible.','The **working set** no longer fits in RAM of the largest affordable machine.','Data must be **placed by location** for latency or compliance (zone sharding).']},
{h:'What sharding costs'},
{t:[['Aspect','Impact'],
['**Complexity**','More processes, config servers, routing, balancing'],
['**Design**','Requires a good shard key; a poor one is painful to fix'],
['**Queries**','Queries without the shard key hit all shards'],
['**Operations**','Backups, upgrades and monitoring are more involved'],
['**Cost**','At least 3 shards x 3 members plus config servers and routers in a typical production layout']]},
{note:'Many systems run happily on a single replica set with good indexes. Shard when you can name the limit you are hitting and have tried the simpler options.'}],
src:[['Sharding',MAN+'sharding/'],['Sharding reference',MAN+'reference/sharding/']]};

/* ---------- 1: architecture ---------- */
L['mongo:10:1']={blocks:[
{p:'A sharded cluster combines three kinds of components. Applications connect to **mongos** and never talk to shards directly.'},
{svg:arch},
{t:[['Component','Role','Notes'],
['**Shard**','Stores a subset of the data','Each is a replica set (production)'],
['**mongos**','Query router','Stateless; run several, often one per application host'],
['**Config servers**','Store cluster metadata: shard key ranges and which chunk lives where','A replica set (CSRS), 3 members'],
['**Shard key**','The field(s) that decide data placement','Chosen when you shard a collection']]},
{h:'Data distribution'},
{ul:['A sharded collection is split into **chunks**: contiguous ranges of shard key values (default maximum size 128 MB).','The **balancer** moves chunks so shards hold similar amounts of data.','Each database has a **primary shard** that holds its unsharded collections (in 8.0 unsharded collections can also be moved between shards).','Collections you do not shard stay on one shard.']},
{h:'Request flow'},
{flow:['The driver sends the operation to a mongos','mongos reads the routing table from the config servers (cached)','It sends the operation to the shard or shards that own the data','Shards execute it and return results','mongos merges results and replies']},
{note:'MongoDB 8.0 can also embed the config server role in a shard (config shard) to reduce the number of servers. Check the release notes for your version.'}],
src:[['Sharded cluster components',MAN+'core/sharded-cluster-components/'],['Config servers',MAN+'core/sharded-cluster-config-servers/']]};

/* ---------- 2: shard key ---------- */
L['mongo:10:2']={blocks:[
{p:'The **shard key** decides which shard owns each document. It affects data distribution, write scalability and query cost for the life of the collection. It is the most important sharding decision.'},
{svg:key},
{h:'Properties of a good key'},
{t:[['Property','Why','Bad example'],
['**High cardinality**','Many distinct values let data split into many chunks','A field with 3 values'],
['**Low frequency**','No single value is very common, avoiding jumbo chunks','Country when most users are one country'],
['**Non-monotonic**','New writes spread over many shards, not one hot shard','Timestamp or ObjectId as a ranged key'],
['**Used in queries**','Queries including the key go to one shard','A key that queries never filter on']]},
{h:'Strategies'},
{t:[['Strategy','Effect','Good for'],
['**Ranged**','Nearby values live together','Range queries on the key; risk of hot spots with increasing keys'],
['**Hashed**','Values spread evenly by hash','Even write distribution; poor for range queries'],
['**Compound**','Combines a coarse and a fine field','Balance locality and distribution (for example tenantId, _id)']]},
{h:'Commands'},
{code:`// Optional on 6.0+: databases are enabled for sharding implicitly
sh.shardCollection("shop.orders", { customerId: 1, _id: 1 })

// Hashed key for even distribution of writes
sh.shardCollection("shop.events", { deviceId: "hashed" })`},
{h:'Rules and facts'},
{ul:['A shard key must be supported by an **index** (created for you if the collection is empty).','Since 4.2 a document shard key value can be **changed**, with limits.','Since 4.4 you can **refine** a key by adding suffix fields, and since 5.0 you can **reshard** a collection online.','**Unique** indexes on a sharded collection must include the shard key as a prefix.']},
{note:'Test the shard key with realistic data and queries before sharding production data.'}],
src:[['Choose a shard key',MAN+'core/sharding-choose-a-shard-key/'],['shardCollection',MAN+'reference/method/sh.shardCollection/']]};

/* ---------- 3: hashed, ranged, zones ---------- */
L['mongo:10:3']={blocks:[
{p:'How the key is used for placement is called the **sharding strategy**. You can also pin ranges of data to specific shards with **zones**.'},
{h:'Ranged vs hashed'},
{t:[['','Ranged','Hashed'],
['**Placement**','By key value order','By hash of the value'],
['**Range queries**','Targeted to few shards','Scatter-gather'],
['**Equality queries**','Targeted','Targeted'],
['**Write distribution**','Hot spot if key increases','Even'],
['**Chunk splitting**','Natural ranges','Pre-split by hash ranges']]},
{h:'Zone sharding'},
{p:'**Zones** associate ranges of shard key values with groups of shards. Use them to keep data close to users or in a required region, or to place archived data on cheaper hardware.'},
{code:`sh.addShardToZone("shardEU1", "EU")
sh.addShardToZone("shardUS1", "US")

// Shard key is { region: 1, userId: 1 }
sh.updateZoneKeyRange("app.users", { region: "EU", userId: MinKey }, { region: "EU", userId: MaxKey }, "EU")
sh.updateZoneKeyRange("app.users", { region: "US", userId: MinKey }, { region: "US", userId: MaxKey }, "US")`},
{h:'Typical zone use cases'},
{ul:['**Data residency**: EU customer data stays on EU shards.','**Tiering**: new data on fast storage, old data on cheaper storage.','**Multi-tenant isolation**: big tenants on dedicated shards.']},
{note:'Zones are enforced by the balancer, so data moves in the background after you define them.'}],
src:[['Hashed sharding',MAN+'core/hashed-sharding/'],['Ranged sharding',MAN+'core/ranged-sharding/'],['Zones',MAN+'core/zone-sharding/']]};

/* ---------- 4: chunks and balancer ---------- */
L['mongo:10:4']={blocks:[
{p:'As data grows, chunks are **split**, and the **balancer** moves chunks between shards so each has a similar share.'},
{svg:chunk},
{h:'How it works'},
{flow:['A chunk grows past the maximum size and is split into two','Shard chunk counts become uneven','The balancer picks a chunk and starts a migration','Data is copied to the destination, then ownership switches in the config servers','The old copy is deleted in the background']},
{h:'Key facts'},
{ul:['Default chunk size is **128 MB**.','A chunk that cannot be split because all its documents share one shard key value is a **jumbo chunk**.','The balancer runs on the config server primary, and migrations take a **range lock** only briefly.','You can schedule a **balancing window** to avoid peak hours.']},
{code:`sh.status()                       // shards, databases, chunk distribution
sh.getBalancerState()             // is the balancer enabled
sh.stopBalancer()                 // before a cluster backup or maintenance
sh.startBalancer()

// Allow balancing only at night
use config
db.settings.updateOne({ _id: "balancer" },
  { $set: { activeWindow: { start: "01:00", stop: "05:00" } } }, { upsert: true })`},
{h:'Resharding'},
{p:'To change the shard key of an existing collection use `reshardCollection` (5.0 and later). It copies data into a new layout online, but needs extra disk space and time, so plan capacity first.'},
{code:`db.adminCommand({ reshardCollection: "shop.orders", key: { customerId: "hashed" } })`}],
src:[['Balancer',MAN+'core/sharding-balancer-administration/'],['Resharding',MAN+'core/sharding-reshard-a-collection/']]};

/* ---------- 5: deploying ---------- */
L['mongo:10:5']={blocks:[
{p:'A lab sharded cluster has the same parts as production: a config server replica set, one or more shard replica sets and a mongos. The order matters.'},
{flow:['Start the config server replica set and initiate it','Start each shard replica set and initiate it','Start mongos pointing at the config servers','Add the shards with sh.addShard()','Shard a database collection with sh.shardCollection()']},
{code:`# Config server replica set members
mongod --configsvr --replSet cfg --port 27019 --dbpath /data/cfg1

# Shard replica set members
mongod --shardsvr --replSet shard1 --port 27018 --dbpath /data/s1a

# Router
mongos --configdb cfg/cfg1.example.net:27019,cfg2.example.net:27019,cfg3.example.net:27019 --port 27017`},
{code:`// On mongos
sh.addShard("shard1/s1a.example.net:27018,s1b.example.net:27018,s1c.example.net:27018")
sh.addShard("shard2/s2a.example.net:27018,s2b.example.net:27018,s2c.example.net:27018")

sh.shardCollection("shop.orders", { customerId: "hashed" })
sh.status()`},
{h:'Production layout checklist'},
{ul:['**3 config server members**, on separate machines, with their own resources.','Each **shard is a 3-member replica set** across failure domains.','At least **two mongos** routers for availability, close to the applications.','Use a **key file** or x.509 and TLS between all components.','Monitor chunk balance, migration queue and config server health.']},
{note:'Ports 27018 (shards) and 27019 (config servers) are the conventional defaults for the `--shardsvr` and `--configsvr` roles.'}],
src:[['Deploy a sharded cluster',MAN+'tutorial/deploy-shard-cluster/'],['sh.addShard',MAN+'reference/method/sh.addShard/']]};

/* ---------- 6: querying ---------- */
L['mongo:10:6']={blocks:[
{p:'Whether a query is **targeted** or **scatter-gather** decides its cost on a sharded cluster.'},
{svg:route},
{t:[['Query','Routing','Cost'],
['Filter includes the shard key (equality)','One shard','Low'],
['Filter includes a prefix of a compound key','One or few shards','Low'],
['Filter has no shard key field','All shards (broadcast)','Grows with number of shards'],
['Sort without the shard key','All shards, merge sort on mongos','Higher'],
['Write with the shard key','One shard','Low'],
['`updateMany` or `deleteMany` without the key','All shards','Higher']]},
{h:'Check routing with explain'},
{code:`db.orders.find({ customerId: 7 }).explain()
// winningPlan.stage: SINGLE_SHARD  -> targeted
// winningPlan.stage: SHARD_MERGE   -> scatter-gather`},
{h:'Practical rules'},
{ul:['Include the **shard key** (or its prefix) in every frequent query.','Design the key around your **most frequent** queries and writes.','Single-document writes need the shard key or `_id` in the filter on a sharded collection.','Avoid cross-shard transactions where possible; they are supported but costlier.','Joins with `$lookup` involving sharded collections have restrictions; check the docs for your version.']},
{note:'Adding shards increases capacity for targeted operations, but scatter-gather queries get no faster, and may cost more.'}],
src:[['Query routing',MAN+'core/sharded-cluster-query-router/'],['Targeted vs broadcast operations',MAN+'core/sharded-cluster-query-router/#shard-key-and-routing']]};
})();
