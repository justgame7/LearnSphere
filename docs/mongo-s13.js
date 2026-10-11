/* LearnSphere - MongoDB, Section 13: Backup & Recovery.
   Lectures 0-6 are core, 7-8 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const rpo=M.dg(700,150,[
[10,10,680,130,'RPO and RTO on a timeline',1],
[30,55,150,55,'Last good|backup',0],[230,55,150,55,'Failure|happens',2],[430,55,120,55,'Service|restored',0],
[570,55,100,55,'RPO: data lost|RTO: time down',0]],
[[180,82,230,82],[380,82,430,82]]);

const methods=M.dg(700,170,[
[10,10,680,150,'Backup methods',1],
[30,55,150,80,'Logical|mongodump|small data, portable',0],[210,55,150,80,'Filesystem snapshot|storage or volume|fast, large data',2],[390,55,130,80,'Atlas cloud backup|managed snapshots|and PIT',2],[550,55,120,80,'Ops Manager|managed for|self-managed',0]],
[]);

const pitr=M.dg(700,140,[
[10,10,680,120,'Point-in-time recovery',1],
[30,55,150,55,'Full snapshot|midnight',0],[220,55,150,55,'Oplog entries|since snapshot',0],[410,55,120,55,'Replay to|chosen time',2],[560,55,110,55,'Data as of|that moment',0]],
[[180,82,220,82],[370,82,410,82],[530,82,560,82]]);

const restore=M.dg(700,140,[
[10,10,680,120,'Restore drill',1],
[30,55,130,55,'Pick backup|and target time',0],[190,55,130,55,'Restore into|a separate cluster',2],[350,55,130,55,'Validate counts,|queries, apps',0],[510,55,160,55,'Record time taken|(real RTO)|and fix the runbook',0]],
[[160,82,190,82],[320,82,350,82],[480,82,510,82]]);

/* ---------- 0: strategy ---------- */
L['mongo:12:0']={blocks:[
{p:'A replica set protects you from **hardware failure**. It does **not** protect you from deleting the wrong data, a bad deployment, a software bug or an attacker. **Backups do**. Replicas are not backups: a mistaken delete is replicated within milliseconds.'},
{svg:rpo},
{h:'Two numbers drive the plan'},
{t:[['Term','Meaning','Question to answer'],
['**RPO** (recovery point objective)','How much data you can afford to lose','How often must we back up, or do we need point in time?'],
['**RTO** (recovery time objective)','How long you can be down','How fast must restore be, so which method?']]},
{h:'Choosing a method'},
{svg:methods},
{t:[['Method','Strength','Weakness'],
['**mongodump**','Simple, portable, selective','Slow on big data; heavy read load'],
['**Filesystem or volume snapshot**','Fast for large data','Needs consistency care; whole-volume'],
['**Atlas cloud backup**','Managed, scheduled, point in time','Atlas only; paid tiers'],
['**Ops Manager / Cloud Manager**','Continuous backup for self-managed','Enterprise product to operate']]},
{h:'What to protect'},
{ul:['Data files (all databases), **users and roles** (admin database), and configuration files.','Encryption **keys** and certificates, stored separately.','For sharded clusters: the **config servers** metadata and all shards as one consistent set.','Application changes that reference the data (schema migrations).']},
{note:'A backup you have never restored is only a hope. Section end: restore drills.'}],
src:[['Backup methods',MAN+'core/backups/']]};

/* ---------- 1: mongodump ---------- */
L['mongo:12:1']={blocks:[
{p:'`mongodump` reads data through the server and writes **BSON** files. `mongorestore` loads them back. It is the simplest tool and fine for small and medium data.'},
{code:`# Whole deployment, compressed, one archive file
mongodump --uri "mongodb://backup:***@mongo1.example.net/?replicaSet=rs0&authSource=admin" \\
  --gzip --archive=/backups/full-2026-03-10.gz

# Consistent snapshot of a replica set at one point in time
mongodump --uri "$URI" --oplog --gzip --out /backups/dump-2026-03-10

# One database
mongodump --uri "$URI" --db shop --out /backups/shop`},
{code:`# Restore everything from an archive
mongorestore --uri "$URI" --gzip --archive=/backups/full-2026-03-10.gz

# Restore and replay the captured oplog for consistency
mongorestore --uri "$URI" --oplogReplay /backups/dump-2026-03-10

# Restore one collection under another name, dropping the target first
mongorestore --uri "$URI" --nsInclude "shop.orders" --nsFrom "shop.orders" --nsTo "shop_test.orders" --drop /backups/dump`},
{h:'Key options'},
{t:[['Option','Purpose'],
['`--oplog`','Capture oplog entries during the dump so the result is consistent as of the end of the dump (replica sets, whole instance)'],
['`--oplogReplay`','Apply those entries on restore'],
['`--gzip`, `--archive`','Compress, single file'],
['`--nsInclude`, `--nsExclude`','Select namespaces on restore'],
['`--drop`','Drop existing collections before restoring'],
['`--numParallelCollections`','Parallelism']]},
{h:'Limits to know'},
{ul:['A logical dump is **slow** for large data and puts read load on the server; dump from a **secondary**.','Indexes are **rebuilt** on restore, adding time.','The `local` database is not dumped.','Restoring users and roles requires dumping the `admin` database.','Not suitable as the only method for multi-terabyte or sharded clusters.']}],
src:[['mongodump',M.TOOLS+'mongodump/'],['mongorestore',M.TOOLS+'mongorestore/'],['Back up with mongodump',MAN+'tutorial/backup-and-restore-tools/']]};

/* ---------- 2: snapshots ---------- */
L['mongo:12:2']={blocks:[
{p:'A **snapshot** of the data files taken by the storage layer (LVM, EBS, SAN, cloud disk snapshot) is much faster than a dump for large data and restores by simply attaching or copying the files.'},
{h:'Consistency rules'},
{ul:['With **WiredTiger and journaling**, a snapshot of a single volume that holds both data and journal is consistent at a point in time.','If the **journal is on a separate volume**, or you copy files with a tool, flush and **lock writes** first with `fsyncLock`.','Snapshot a **secondary** to avoid load on the primary.']},
{code:`// If needed: flush and block writes, snapshot, then unlock
db.fsyncLock()
// take the volume snapshot here
db.fsyncUnlock()`},
{flow:['Pick a secondary (hidden if you have one)','Check it is caught up (replication lag near zero)','Take the volume snapshot with the storage tool','Copy the snapshot to another account or region','Record the oplog timestamp for point-in-time recovery']},
{h:'Restoring from a snapshot'},
{flow:['Create a volume from the snapshot','Attach it to a stopped or new host','Start mongod on the restored dbPath (standalone or as the replica set seed)','Rebuild or re-sync the other members if needed']},
{note:'Do not keep your only copy of snapshots on the same disk system or account as the data. A single failure or compromise should not remove both.'}],
src:[['Filesystem snapshots',MAN+'tutorial/backup-with-filesystem-snapshots/'],['fsyncLock',MAN+'reference/method/db.fsyncLock/']]};

/* ---------- 3: PITR ---------- */
L['mongo:12:3']={blocks:[
{p:'**Point-in-time recovery (PITR)** restores a deployment to **any moment** within a retention window, such as the minute before a bad deployment. It combines a base backup with the **oplog**.'},
{svg:pitr},
{h:'Manual PITR with a dump'},
{flow:['Restore the last full backup (snapshot or dump with --oplog)','Obtain oplog entries covering the time after the backup','Replay them up to the chosen timestamp using --oplogLimit','Verify the data and switch applications']},
{code:`# Replay oplog entries only up to the timestamp (seconds since epoch : ordinal)
mongorestore --oplogReplay --oplogLimit 1773140400:1 /backups/dump-2026-03-10`},
{h:'Requirements'},
{ul:['**Continuous oplog capture**, because the oplog itself is capped. Archive oplog segments regularly, or use a tool that streams them.','A base backup older than the target time.','Known timestamp of the incident (log, application, audit).']},
{h:'Managed PITR'},
{ul:['**Atlas continuous cloud backup**: choose a time or oplog timestamp in the UI, API or CLI.','**Ops Manager** continuous backup for self-managed deployments.']},
{note:'Decide the retention window (for example 7 days) from how fast you can detect a problem, not from storage cost alone.'}],
src:[['Restore to a point in time',MAN+'tutorial/backup-and-restore-tools/#point-in-time-recovery'],['Atlas continuous backup',M.ATLAS+'backup/cloud-backup/overview/']]};

/* ---------- 4: sharded ---------- */
L['mongo:12:4']={blocks:[
{p:'A sharded cluster is **one logical dataset** spread over many servers. A good backup must capture the config servers and all shards as of the **same moment**, otherwise restored data can be inconsistent (for example half a chunk migration).'},
{h:'What goes wrong with uncoordinated backups'},
{ul:['Shards backed up minutes apart show **different versions** of related data.','A chunk **migration** during the backup can leave a document on two shards, or on none.','Config server metadata can disagree with shard contents.']},
{h:'Approaches'},
{t:[['Approach','How','Consistency'],
['**Atlas cloud backup**','Coordinated snapshots across all shards and config servers','Managed'],
['**Ops Manager / Cloud Manager**','Backup agent with checkpoints','Managed'],
['**Manual snapshots**','Stop the balancer, lock or quiesce writes, snapshot config servers and all shards close together','You must do it carefully'],
['**mongodump**','Possible only with writes stopped and the balancer stopped','Not practical for large clusters']]},
{h:'Manual procedure outline'},
{flow:['Disable the balancer with sh.stopBalancer()','Wait for migrations in progress to finish','Back up the config server replica set','Back up each shard replica set at about the same time','Re-enable the balancer with sh.startBalancer()']},
{h:'Restoring a sharded cluster'},
{ul:['Restore **config servers first**, then shards, then start mongos.','If hostnames change, update the shard metadata (`config.shards`) as documented.','Validate with `sh.status()` and sample queries.']},
{note:'For anything beyond a small cluster, use a managed solution so consistency is handled for you.'}],
src:[['Backup a sharded cluster',MAN+'tutorial/backup-sharded-cluster-with-filesystem-snapshots/'],['Restore a sharded cluster',MAN+'tutorial/restore-sharded-cluster/']]};

/* ---------- 5: atlas ---------- */
L['mongo:12:5']={blocks:[
{p:'Atlas offers managed backups on dedicated clusters (M10 and larger). You choose a policy, and Atlas takes, stores and restores snapshots.'},
{h:'Features'},
{t:[['Feature','Description'],
['**Cloud backup snapshots**','Scheduled snapshots with hourly, daily, weekly and monthly retention'],
['**Continuous cloud backup**','Adds oplog capture for point-in-time restore within the window'],
['**Cross-region copies**','Copy snapshots to another region for disaster recovery'],
['**On-demand snapshots**','Take a snapshot before a risky change'],
['**Restore options**','To the same or another cluster, or download for local use'],
['**Queryable restore and snapshots**','Check or extract data without a full restore (check current options)']]},
{h:'Typical policy'},
{t:[['Frequency','Retention (example)'],
['Hourly','Every 6 hours, kept 2 days'],
['Daily','Kept 7 days'],
['Weekly','Kept 4 weeks'],
['Monthly','Kept 12 months']]},
{h:'Restoring in Atlas'},
{flow:['Choose the snapshot or point in time','Choose the target: same cluster, another cluster, or download','Atlas restores (the target is overwritten)','Switch the application, or compare data first on a new cluster']},
{ul:['Prefer restoring to a **new cluster** first, check the data, then cut over.','A restore **replaces** data in the target cluster; take a fresh snapshot first if needed.','Free and shared tiers have limited or no cloud backup; check current tier features.']}],
src:[['Atlas backups',M.ATLAS+'backup/cloud-backup/overview/'],['Restore from a snapshot',M.ATLAS+'backup-restore-cluster/']]};

/* ---------- 6: testing ---------- */
L['mongo:12:6']={blocks:[
{p:'Many teams find out their backups do not work only when they need them. A **restore drill** removes the uncertainty and tells you your real RTO.'},
{svg:restore},
{h:'What to test'},
{t:[['Test','Pass criteria'],
['Restore completes without errors','All databases and users present'],
['Data is consistent','Document counts and checksums match expectations'],
['Application works against the restored copy','Key user journeys succeed'],
['Point-in-time restore hits the chosen time','Deleted data back, later data absent'],
['Time to restore','Within your RTO']]},
{h:'Validation commands'},
{code:`// Compare counts with the source
db.getCollectionNames().map(n => ({ n, c: db[n].countDocuments({}) }))

// Check a collection for corruption
db.orders.validate({ full: true })`},
{h:'Runbook contents'},
{ul:['Where backups are, who may restore, how to get credentials and keys.','Exact commands or console steps for each scenario (single collection, full cluster, PITR).','Contact list, decision criteria and communication steps.','Last tested date and measured restore time.']},
{h:'Drill cadence'},
{ul:['At least **quarterly** for production, and after any major change to the topology or tooling.','Rotate who performs the drill so knowledge is shared.']},
{note:'Include a scenario where the primary region is lost and the backup copy in another region is used.'}],
src:[['Backup and restore',MAN+'core/backups/'],['validate',MAN+'reference/command/validate/']]};
})();
