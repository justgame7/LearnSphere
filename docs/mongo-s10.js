/* LearnSphere - MongoDB, Section 10: Replication & High Availability.
   Lectures 0-6 are core, 7-8 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const rs=M.dg(700,220,[
[10,10,680,200,'A three-member replica set',1],
[40,50,150,60,'Client|driver',0],
[270,40,160,70,'Primary|accepts all writes',2],[210,140,130,50,'Secondary|replicates',0],[420,140,130,50,'Secondary|replicates',0],
[560,60,110,50,'Heartbeats|every 2 s',0]],
[[190,80,270,75],[330,110,290,140],[380,110,450,140],[340,165,420,165]]);

const elect=M.dg(700,130,[
[10,10,680,110,'Failover',1],
[30,45,130,55,'Primary|fails',0],[190,45,160,55,'Secondaries miss|heartbeats (10 s)',0],[380,45,130,55,'Election|majority votes',2],[540,45,130,55,'New primary|clients reconnect',0]],
[[160,72,190,72],[350,72,380,72],[510,72,540,72]]);

const topo=M.dg(700,200,[
[10,10,680,180,'Typical 5-member, 3-site layout',1],
[30,50,190,120,'Site A|Primary candidate|Secondary',2],[255,50,190,120,'Site B|Secondary|Secondary',0],[480,50,190,120,'Site C|Secondary or hidden|(tie-breaker site)',0]],
[]);

/* ---------- 0: architecture ---------- */
L['mongo:9:0']={blocks:[
{p:'A **replica set** is a group of mongod processes that hold the same data. One member is the **primary** and accepts all writes. The others are **secondaries** that copy the primary data by replaying its **oplog**.'},
{svg:rs},
{h:'Why use one'},
{ul:['**High availability**: if the primary fails, another member is elected automatically.','**Data safety**: several copies on different machines.','**Read scaling and workload isolation**: reads can go to secondaries or special members.','**Required** for transactions, change streams and most other modern features.']},
{h:'Member types'},
{t:[['Member','Holds data','Can be primary','Notes'],
['**Primary**','Yes','Is the primary','Only member that accepts writes'],
['**Secondary**','Yes','Yes (if priority > 0)','Replicates; can serve reads'],
['**Priority 0**','Yes','No','Never becomes primary, still votes'],
['**Hidden**','Yes','No','Not visible to drivers; for analytics or backup'],
['**Delayed**','Yes','No','Applies changes late as a protection against mistakes'],
['**Arbiter**','No','No','Votes only; use is discouraged']]},
{h:'Facts to remember'},
{ul:['A replica set can have up to **50 members**, of which at most **7 can vote**.','Use an **odd number of voting members** so a majority is always possible.','A **majority** of voting members is needed to elect a primary.','Members are configured with a **priority** and number of **votes**.']},
{note:'Replica set members should be on separate machines (and ideally in separate failure domains). Three members on one host protect only against a process crash.'}],
src:[['Replication',MAN+'replication/'],['Replica set members',MAN+'core/replica-set-members/']]};

/* ---------- 1: elections ---------- */
L['mongo:9:1']={blocks:[
{p:'Members send **heartbeats** to each other every 2 seconds. If the primary is unreachable for the election timeout (default **10 seconds**), an eligible secondary calls an **election**. A candidate needs votes from a **majority** of voting members.'},
{svg:elect},
{h:'What happens during failover'},
{flow:['Primary stops responding','Secondaries wait for the election timeout','The most up-to-date eligible member with the highest priority calls an election','A majority votes for it and it becomes primary','Drivers detect the new primary and retry retryable operations']},
{ul:['Writes are unavailable during the election, usually **a few seconds to about 12 seconds**.','Reads from secondaries continue if the read preference allows it.','A **planned step down** (`rs.stepDown()`) is faster because the primary hands over cleanly.']},
{h:'Rollback'},
{p:'If the old primary had accepted writes that were **not replicated** before it failed, those writes are **rolled back** when it rejoins: it reverts them and saves them in a rollback folder.'},
{t:[['Write concern','Rollback risk'],
['`w: 1`','Writes not yet replicated may be rolled back after failover'],
['`w: "majority"`','Acknowledged writes are not rolled back']]},
{h:'Controlling elections'},
{ul:['**Priority** decides who is preferred as primary (higher is preferred).','**Votes** decide who participates; most members have 1.','Keep members within **similar latency**; a slow link causes unnecessary elections.']},
{code:`rs.status().members.map(m => ({ name: m.name, state: m.stateStr, health: m.health }))
rs.stepDown(120)   // step down the primary, no re-election for 120 seconds`}],
src:[['Replica set elections',MAN+'core/replica-set-elections/'],['Rollbacks',MAN+'core/replica-set-rollbacks/']]};

/* ---------- 2: deploy ---------- */
L['mongo:9:2']={blocks:[
{p:'A basic three-node replica set can be built on three hosts, or three ports on one machine for a lab. These steps use a **key file** for internal authentication, which also enforces access control.'},
{h:'Steps'},
{flow:['Create a shared key file and copy it to every member','Configure replication.replSetName on every mongod','Start all members','Connect to one and run rs.initiate()','Verify with rs.status()','Create the first admin user']},
{code:`# 1. key file (same on every member, permission 400, owned by the mongod user)
openssl rand -base64 756 > /etc/mongo-keyfile
chmod 400 /etc/mongo-keyfile`},
{code:`# 2. mongod.conf on every member
replication:
  replSetName: rs0
security:
  keyFile: /etc/mongo-keyfile
net:
  bindIp: 0.0.0.0     # restrict with firewall rules and use private networks
  port: 27017`},
{code:`// 3. on one member (localhost exception allows the first steps)
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1.example.net:27017", priority: 2 },
    { _id: 1, host: "mongo2.example.net:27017" },
    { _id: 2, host: "mongo3.example.net:27017" }
  ]
})

rs.status()   // wait until one member is PRIMARY
rs.conf()     // show the configuration`},
{h:'Checks after deploying'},
{ul:['Every member shows `stateStr` PRIMARY or SECONDARY and `health: 1`.','Hostnames resolve between members and the clients.','A test write on the primary appears on the secondaries.','Connection string lists several members and the `replicaSet` name.']},
{note:'Use DNS names, not IP addresses, in the configuration. You can then replace a machine without changing the set configuration.'}],
src:[['Deploy a replica set',MAN+'tutorial/deploy-replica-set/'],['rs.initiate',MAN+'reference/method/rs.initiate/']]};

/* ---------- 3: lag, oplog, initial sync ---------- */
L['mongo:9:3']={blocks:[
{p:'**Replication lag** is how far a secondary is behind the primary. Small lag is normal. Persistent or growing lag means reads from that member are stale and failover could lose data.'},
{h:'Measuring lag'},
{code:`rs.printSecondaryReplicationInfo()
// source: mongo2:27017  syncedTo: ...  0 secs (0 hrs) behind the primary

rs.printReplicationInfo()
// configured oplog size, log length start to end (the oplog window)`},
{h:'Common causes'},
{t:[['Cause','What to check'],
['Secondary is slower than the primary','CPU, disk and network of the secondary'],
['Large bulk writes or index builds','Operation volume at the time'],
['Network latency or packet loss','Network between members'],
['Long-running reads on the secondary','`currentOp` on the secondary'],
['Write rate above what a secondary can apply','Scale hardware; reduce write amplification']]},
{h:'Oplog size'},
{ul:['The oplog **window** must cover the longest maintenance or outage a secondary may have.','If a member falls behind longer than the window it needs a **full resync**.','Resize with `replSetResizeOplog` or by setting `oplogMinRetentionHours`.']},
{h:'Initial sync'},
{p:'A new or rebuilt member performs an **initial sync**: it copies all data from another member, then applies oplog entries made during the copy, then becomes a secondary. Large data sets take a long time, so plan disk, network and the oplog window.'},
{flow:['Member starts empty (STARTUP2)','Clone every database from a sync source','Build indexes','Apply oplog entries that arrived during the copy','Member becomes SECONDARY']},
{h:'Flow control'},
{p:'Since 4.2 the primary slows writes slightly when the majority commit point lags too far, so a lagging majority does not hurt the cluster (`flowControlTargetLagSeconds`, default 10).'}],
src:[['Replication lag',MAN+'tutorial/troubleshoot-replica-sets/#replication-lag'],['Replica set initial sync',MAN+'core/replica-set-sync/'],['Flow control',MAN+'replication/#flow-control']]};

/* ---------- 4: topologies ---------- */
L['mongo:9:4']={blocks:[
{p:'The default three-member set is only the beginning. Members can be arranged and typed to support analytics, protection from mistakes and multi-region resilience.'},
{h:'Special members'},
{t:[['Type','Configuration','Use case'],
['**Hidden**','`hidden: true, priority: 0`','Reporting and backups without affecting application reads'],
['**Delayed**','`secondaryDelaySecs: 3600, hidden: true, priority: 0`','A time-shifted copy to recover from accidental deletes (does not replace backups)'],
['**Priority 0**','`priority: 0`','Remote member that must never become primary'],
['**Tagged**','`tags: { dc: "east" }`','Route reads and writes by location (read preference tag sets)']]},
{h:'Choose a topology'},
{svg:topo},
{t:[['Goal','Layout'],
['Survive one machine failure','3 members, 1 per machine or zone'],
['Survive loss of a whole site','Voting members spread over 3 sites so any 2 form a majority'],
['Offload analytics','Add a hidden or tagged secondary for reporting'],
['Protect against human error','Add a delayed member plus real backups'],
['Low-latency regional reads','Members in each region with tagged read preference']]},
{h:'About arbiters'},
{ul:['An arbiter votes but holds no data, so it does not provide a copy.','With a **primary-secondary-arbiter** layout, if the secondary is down, `w: "majority"` cannot be satisfied and the majority commit point may stall.','Prefer a third **data-bearing** member.']},
{code:`cfg = rs.conf()
cfg.members[3].hidden = true
cfg.members[3].priority = 0
cfg.members[3].tags = { use: "analytics" }
rs.reconfig(cfg)`}],
src:[['Replica set architectures',MAN+'core/replica-set-architectures/'],['Replica set configuration',MAN+'reference/replica-configuration/']]};

/* ---------- 5: maintaining ---------- */
L['mongo:9:5']={blocks:[
{p:'Replica sets let you maintain members **one at a time** without downtime. The rule is: do secondaries first, primary last, and always keep a majority healthy.'},
{h:'Rolling maintenance'},
{flow:['Check rs.status() and replication lag','Take one secondary out: shut it down cleanly, patch or change it, start it','Wait until it is SECONDARY and caught up','Repeat for each secondary','Step down the primary with rs.stepDown()','Maintain the former primary the same way']},
{h:'Everyday operations'},
{t:[['Task','Command'],
['Add a member','`rs.add("mongo4.example.net:27017")`'],
['Remove a member','`rs.remove("mongo4.example.net:27017")`'],
['Change priority or votes','Edit `rs.conf()` then `rs.reconfig(cfg)`'],
['Step down the primary','`rs.stepDown(60)`'],
['Prevent a member from running for primary','`rs.freeze(300)` on that member'],
['See state and lag','`rs.status()`, `rs.printSecondaryReplicationInfo()`'],
['Change the oplog size','`replSetResizeOplog`']]},
{h:'Rules'},
{ul:['Never take down more members than the set can lose while keeping a **majority**.','Reconfigure with **small changes**: one member or one setting at a time.','Prefer `rs.stepDown()` to killing the primary, so clients see a clean switch.','Keep **mongod versions compatible** across members during upgrades (Section 15).']},
{note:'Before maintenance on a secondary, check that the remaining members have enough capacity to carry the whole workload.'}],
src:[['Replica set maintenance',MAN+'administration/replica-set-maintenance/'],['rs.stepDown',MAN+'reference/method/rs.stepDown/']]};

/* ---------- 6: failure scenarios ---------- */
L['mongo:9:6']={blocks:[
{p:'Practising failures in a lab removes fear in production. These are the three situations to understand.'},
{h:'Scenario 1: the primary fails'},
{flow:['Primary machine stops','Secondaries elect a new primary after the timeout','Drivers retry retryable writes automatically','Old primary rejoins as a secondary and may roll back unreplicated writes']},
{t:[['Check','Expected'],
['`rs.status()` on a survivor','A new PRIMARY, old member shown unhealthy or STARTUP2'],
['Application errors','A short burst of connection or not-primary errors, then recovery']]},
{h:'Scenario 2: a majority is lost'},
{p:'In a three-member set, if two members are down the survivor cannot reach a majority. It **steps down to secondary** and the set becomes **read-only** for reads that allow secondaries.'},
{ul:['Best response: **bring failed members back**.','If that is impossible, an administrator can force a reconfiguration on the survivor, accepting possible data loss.']},
{code:`// Emergency only: force a one-member configuration on the survivor
cfg = rs.conf()
cfg.members = [ cfg.members[0] ]
rs.reconfig(cfg, { force: true })`},
{h:'Scenario 3: a member has corrupt or lost data'},
{flow:['Stop mongod on the member','Move or delete the contents of dbPath','Start mongod','The member performs an initial sync from another member']},
{ul:['Ensure the oplog window and network can handle a full sync.','If the data is huge, restoring a recent snapshot to that member first shortens the catch-up.']},
{h:'Practice drill'},
{ul:['Stop the primary process and watch `rs.status()` on another member.','Insert data with `w: "majority"` and verify it survives.','Restart the old primary and confirm it rejoins.']},
{note:'Document these runbooks and rehearse them. The fastest recovery is the one the team has already done once.'}],
src:[['Troubleshoot replica sets',MAN+'tutorial/troubleshoot-replica-sets/'],['Reconfigure with a majority loss',MAN+'tutorial/reconfigure-replica-set-with-unavailable-members/']]};
})();
