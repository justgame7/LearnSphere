/* LearnSphere - MongoDB, Section 15: Operations, Upgrades & Migration.
   Lectures 0-5 are core, 6-7 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const upg=M.dg(700,150,[
[10,10,680,130,'Rolling upgrade of a replica set',1],
[30,55,120,55,'Backup and|read notes',0],[180,55,130,55,'Upgrade|secondaries',0],[340,55,120,55,'Step down|primary',2],[490,55,100,55,'Upgrade|old primary',0],[610,55,60,55,'Set FCV',2]],
[[150,82,180,82],[310,82,340,82],[460,82,490,82],[590,82,610,82]]);

const fcv=M.dg(700,130,[
[10,10,680,110,'Binary version and feature compatibility version',1],
[30,50,190,55,'Binaries 8.0|new code installed',0],[255,50,190,55,'FCV 7.0|new features still off|rollback possible',2],[480,50,190,55,'FCV 8.0|new features on|rollback harder',0]],
[[220,77,255,77],[445,77,480,77]]);

const mig=M.dg(700,150,[
[10,10,680,130,'Migration approach',1],
[30,55,120,55,'Design the|document model',2],[180,55,120,55,'Copy data|bulk load',0],[330,55,130,55,'Keep in sync|CDC or dual write',0],[490,55,90,55,'Verify|counts',0],[600,55,70,55,'Cut over',2]],
[[150,82,180,82],[300,82,330,82],[460,82,490,82],[580,82,600,82]]);

/* ---------- 0: routine maintenance ---------- */
L['mongo:14:0']={blocks:[
{p:'A healthy MongoDB deployment is mostly **routine, boring checks** done on a schedule. Writing them down turns tribal knowledge into a repeatable practice.'},
{t:[['Frequency','Task','How'],
['**Daily**','Check alerts, replica set state and lag, disk space, backup success','Monitoring, `rs.status()`'],
['**Weekly**','Review slow queries and new indexes, connection and cache trends','Profiler, Performance Advisor'],
['**Monthly**','Review users and roles, certificate expiry, patch status, capacity forecast','`db.getUsers()`, inventory'],
['**Quarterly**','Restore drill, failover drill, upgrade plan, documentation review','Runbooks'],
['**Yearly**','Major upgrade, disaster recovery test, security review','Change plan']]},
{h:'Standard checks'},
{code:`// Replica set health summary
rs.status().members.map(m => m.name + " " + m.stateStr)

// Storage per database in GB
db.adminCommand({ listDatabases: 1 }).databases.map(d => d.name + " " + (d.sizeOnDisk/1e9).toFixed(2) + " GB")

// Current feature compatibility version
db.adminCommand({ getParameter: 1, featureCompatibilityVersion: 1 })`},
{h:'Change management'},
{flow:['Write the change and the rollback plan','Test in staging with production-like data','Announce a window and get approval','Run with a second person watching','Verify, record, and update the runbook']},
{note:'Automate the checks you repeat (scripts, Ansible, scheduled jobs, Atlas automation) and review the output instead of running commands by hand.'}],
src:[['Administration',MAN+'administration/'],['Production notes',MAN+'administration/production-notes/']]};

/* ---------- 1: users at scale ---------- */
L['mongo:14:1']={blocks:[
{p:'As teams and applications grow, access needs a structure. The goal is that every person and service has **only the access it needs**, and that leaving staff lose access quickly.'},
{h:'Model'},
{t:[['Identity','How to manage','Example'],
['**Human administrators**','Individual accounts through your identity provider (LDAP, OIDC) where possible','Alice has `dbAdmin` on shop'],
['**Applications**','One service account per application, minimal roles, credentials in a secret store','shopapp: `readWrite` on shop'],
['**Tools**','Dedicated accounts per tool','monitoring: `clusterMonitor`; backup: `backup`'],
['**Break-glass**','Rarely used, tightly protected, audited','An emergency admin account']]},
{h:'Standard custom roles'},
{code:`use admin
db.createRole({
  role: "appRW",
  privileges: [ { resource: { db: "shop", collection: "" }, actions: [ "find", "insert", "update", "remove" ] } ],
  roles: []
})
db.createUser({ user: "shopapp", pwd: passwordPrompt(), roles: [ "appRW" ] })`},
{h:'Operations'},
{ul:['**Onboarding**: grant a role, not an individual list of privileges.','**Offboarding**: remove the user the same day and rotate shared secrets.','**Rotation**: change service passwords on a schedule, or use short-lived credentials.','**Review**: list users and roles every quarter and remove unused ones.']},
{code:`db.getSiblingDB("admin").getUsers().map(u => u.user + ": " + u.roles.map(r => r.role + "@" + r.db).join(", "))`},
{note:'Prefer **federated identity** (OIDC or LDAP) over local users for people, so access follows the company directory.'}],
src:[['Manage users and roles',MAN+'tutorial/manage-users-and-roles/'],['Create a role',MAN+'reference/method/db.createRole/']]};

/* ---------- 2: upgrades ---------- */
L['mongo:14:2']={blocks:[
{p:'Upgrades bring security fixes and features. They are safe when planned: read the notes, back up, upgrade in a defined order and let the **feature compatibility version (FCV)** protect your rollback option.'},
{svg:upg},
{h:'Preparation'},
{ul:['Upgrade **one major version at a time**, for example 7.0 to 8.0.','First move to the **latest patch** of your current version.','Read the **release notes** and compatibility changes, including driver compatibility.','Take a **backup** and test the upgrade in staging.','Check that all members run the same current FCV.']},
{h:'Feature compatibility version'},
{svg:fcv},
{code:`// Show current FCV
db.adminCommand({ getParameter: 1, featureCompatibilityVersion: 1 })

// After the binaries are upgraded everywhere and the app has been verified
db.adminCommand({ setFeatureCompatibilityVersion: "8.0", confirm: true })`},
{p:'While FCV stays at the previous version, new features that change on-disk formats are off and you can still **downgrade** the binaries. Raising FCV commits you to the new version.'},
{h:'Replica set order'},
{flow:['Upgrade secondaries one at a time (stop, replace binaries, start, wait for SECONDARY)','Step down the primary with rs.stepDown()','Upgrade the former primary','Verify and run on the new binaries for a while','Set the feature compatibility version']},
{h:'Sharded cluster order'},
{flow:['Stop the balancer','Upgrade the config server replica set','Upgrade each shard replica set (secondaries, then primary)','Upgrade the mongos routers','Set FCV through mongos and restart the balancer']},
{note:'Upgrades on Atlas are started from the console or API and use a rolling process with no planned downtime. Self-managed clusters need the procedure above.'}],
src:[['Upgrade MongoDB',MAN+'release-notes/'],['Feature compatibility version',MAN+'reference/command/setFeatureCompatibilityVersion/']]};

/* ---------- 3: disk space ---------- */
L['mongo:14:3']={blocks:[
{p:'Deleting data does not always shrink files immediately. Understanding **logical vs physical size** avoids surprises.'},
{h:'Logical and physical size'},
{t:[['Term','Meaning'],
['`dataSize`','Size of the documents'],
['`storageSize`','Space allocated to the collection on disk (includes free space inside)'],
['`totalIndexSize`','Space used by indexes'],
['`freeStorageSize`','Space inside the file that WiredTiger can reuse']]},
{code:`db.orders.stats({ scale: 1024*1024 })
// look at size, storageSize, freeStorageSize, totalIndexSize`},
{p:'After deleting many documents, WiredTiger reuses the free space for new data, but the file keeps its size until it is compacted or rebuilt.'},
{h:'Ways to reclaim space'},
{t:[['Method','How it works','Trade-off'],
['**compact**','Rewrites the collection files in place','Run during low traffic, one member at a time; behavior depends on the version, so check the release notes'],
['**Rolling resync**','Delete a secondary data and let it initial sync, then step down and repeat','No downtime, takes time and bandwidth'],
['**TTL index**','Expire data automatically','Prevents growth rather than shrinking it'],
['**Archive and drop**','Move cold data out, drop collections','Dropping returns space immediately']]},
{code:`db.runCommand({ compact: "orders" })   // run on one secondary at a time`},
{h:'Keeping growth under control'},
{ul:['Define a **retention policy** for every large collection.','Use **TTL** for temporary data and **archiving** for history.','Use **time series collections** or the **bucket pattern** for event data.','Alert on disk before it becomes urgent.']},
{note:'Dropping a collection frees space at once, while deleting documents does not shrink files.'}],
src:[['compact',MAN+'reference/command/compact/'],['Reclaim disk space',MAN+'faq/storage/']]};

/* ---------- 4: migration from relational ---------- */
L['mongo:14:4']={blocks:[
{p:'Moving from a relational database is not a table-for-collection copy. The value comes from **re-modeling** the data around your access patterns, then moving it.'},
{svg:mig},
{h:'Steps'},
{flow:['Inventory tables, queries and transactions of the application','Design the document model (Section 6): what to embed, what to reference','Create indexes and validation in MongoDB','Load the data with a transformation job','Keep it in sync while both systems run','Verify and cut over, then retire the old system']},
{h:'Mapping examples'},
{t:[['Relational design','Document design'],
['Order and order_lines tables','One `orders` document with a `lines` array'],
['Customer table referenced by orders','Reference by id plus a few copied fields'],
['Many-to-many join table','Array of ids on one or both sides'],
['Lookup/enum tables','Embedded values or a small reference collection'],
['Stored procedures','Application logic, aggregation pipelines or Atlas triggers']]},
{h:'Tools'},
{t:[['Tool','Use'],
['**Relational Migrator**','Analyze a relational schema, design a document model and generate migration jobs'],
['**mongoimport**','Load CSV or JSON for simple cases'],
['**ETL or CDC pipelines**','Kafka, Debezium, custom jobs, cloud migration services'],
['**Application dual write**','Write to both during transition (needs careful consistency handling)']]},
{h:'Pitfalls'},
{ul:['Copying table structures one to one gives poor performance and complexity.','Underestimating **transactions and constraints** the old database enforced.','No plan for **rollback** and for data written during cutover.','Not testing with **production-sized** data and queries.']}],
src:[['Relational Migrator',M.D+'relational-migrator/'],['Data modeling',MAN+'data-modeling/']]};

/* ---------- 5: self-managed to Atlas ---------- */
L['mongo:14:5']={blocks:[
{p:'Moving an existing MongoDB deployment to Atlas can be done **live**, with a short cutover, using Atlas migration tooling.'},
{t:[['Method','When','Notes'],
['**Atlas Live Migration**','Source is a supported replica set or sharded cluster reachable from Atlas','Atlas pulls data and applies changes continuously until cutover'],
['**mongosync (cluster-to-cluster sync)**','Continuous sync between clusters','For migrations and for ongoing synchronization'],
['**mongodump / mongorestore**','Small data sets, downtime acceptable','Simple and portable'],
['**Application-level migration**','Special cases','Custom jobs']]},
{h:'Live migration flow'},
{flow:['Assess: version, size, features used, network access','Create the destination Atlas cluster with sizing and settings','Configure network access so Atlas can reach the source','Start the live migration and monitor lag','When lag is near zero, stop writes briefly and cut over connection strings','Verify and keep the source read-only for a safety period']},
{h:'Checklist'},
{ul:['Check **version compatibility** and any features not supported on Atlas.','Recreate **users and roles** as Atlas database users.','Replace **IP and network** configuration with Atlas access lists or private endpoints.','Plan **connection string** change in applications, ideally via configuration.','Test performance on Atlas using a copy before the final cutover.','Set up backups, alerts and monitoring after the move.']},
{note:'Always check the current migration documentation. Supported sources, versions and limits change between releases.'}],
src:[['Migrate to Atlas',M.ATLAS+'import/'],['Live migration',M.ATLAS+'import/live-import-source/']]};
})();
