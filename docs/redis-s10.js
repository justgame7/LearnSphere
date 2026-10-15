/* LearnSphere - Redis, Section 10: Replication.
   Lectures 0-6 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const topo=K.dg(700,220,[
[10,10,680,200,'Primary and replicas',1],
[30,85,130,60,'Clients|writes',0],[240,85,140,60,'Primary|read and write',2],[490,40,170,50,'Replica 1|reads',0],[490,130,170,50,'Replica 2|reads',0]],
[[160,115,240,115],[380,100,490,65],[380,130,490,155]]);

const sync=K.dg(700,240,[
[10,10,680,220,'Connecting a replica',1],
[30,60,160,50,'Replica sends PSYNC|replid offset',0],[260,60,160,50,'Can continue from|backlog?',2],
[500,40,170,44,'Yes: partial resync,|send missing commands',0],[500,110,170,44,'No: full resync,|send RDB then buffer',0],[260,160,160,44,'Replica is online|and streams',0]],
[[190,85,260,85],[420,75,500,62],[420,95,500,132],[585,154,420,180]]);

const wait=K.dg(700,190,[
[10,10,680,170,'WAIT: ask for acknowledgement from replicas',1],
[30,60,130,60,'Client SET',0],[210,60,130,60,'Primary applies,|propagates',0],[390,60,130,60,'Replicas ACK|offset',2],[570,60,100,60,'WAIT returns|count',0]],
[[160,90,210,90],[340,90,390,90],[520,90,570,90]]);

/* ---------- 0 ---------- */
L['redis:9:0']={blocks:[
{p:'**Replication** keeps one or more **replicas** as copies of a **primary**. Clients write to the primary and may read from replicas. The replica connects, receives the dataset and then follows a stream of the primary writes.'},
{svg:topo},
{h:'Key properties'},
{ul:['**Asynchronous by default**: the primary acknowledges a write before replicas have it.','**Non-blocking** on the primary: replicas sync while the primary keeps serving.','A replica can have its own replicas, forming a chain that reduces load on the primary.','Replicas are read-only by default.']},
{h:'Why replicate'},
{t:[['Goal','How replication helps'],
['Availability','A replica can be promoted if the primary fails (with Sentinel or Cluster)'],
['Read scaling','Spread reads across replicas, accepting some staleness'],
['Offload persistence or backups','Run snapshots on a replica'],
['Data copies','A second in-memory copy on another host']]},
{note:'Replication is not a backup. A bad write or a flush is replicated within milliseconds.'}],
src:[['Replication',K.MGT+'replication/']]};

/* ---------- 1 ---------- */
L['redis:9:1']={blocks:[
{p:'A replica is created by pointing a server at a primary.'},
{code:`# on the replica
REPLICAOF 10.0.0.10 6379
CONFIG SET masterauth "secret"
CONFIG SET masteruser repl

# stop replicating and become a primary
REPLICAOF NO ONE

# check
INFO replication`},
{t:[['Setting','Purpose'],
['replicaof host port','Make this node a replica at start'],
['masterauth, masteruser','Credentials to authenticate to the primary'],
['replica-read-only yes','Reject writes on the replica (default)'],
['replica-serve-stale-data yes','Answer reads while out of sync'],
['replica-priority','Preference for promotion, lower is preferred, 0 never']]},
{h:'Checking the link'},
{code:`role:slave
master_host:10.0.0.10
master_link_status:up
master_last_io_seconds_ago:1
master_sync_in_progress:0
slave_repl_offset:128734`},
{note:'`SLAVEOF` is the legacy name of `REPLICAOF`. If the primary uses `requirepass` or ACLs, the replica needs `masterauth`, otherwise the link stays down.'}],
src:[['REPLICAOF',K.CMD+'replicaof/'],['Replication',K.MGT+'replication/']]};

/* ---------- 2 ---------- */
L['redis:9:2']={blocks:[
{p:'Every primary has a **replication ID** and an **offset** that increases with each byte of the replication stream. A replica remembers both. After a disconnect it asks to continue from its offset.'},
{svg:sync},
{h:'Full resynchronisation'},
{flow:['The primary starts a BGSAVE, or streams the RDB directly to the socket (diskless)','Writes made meanwhile are buffered','The replica loads the RDB','The primary sends the buffered commands','The replica now follows the live stream']},
{h:'Partial resynchronisation'},
{p:'The primary keeps a **replication backlog**, a circular in-memory buffer. If the replica offset is still in it, only the missing part is sent, which is cheap.'},
{code:`CONFIG SET repl-backlog-size 256mb
CONFIG SET repl-backlog-ttl 3600
INFO replication      # repl_backlog_size, master_repl_offset`},
{ul:['After a failover, the promoted replica keeps the old ID as a secondary ID, so other replicas can resync partially.','A backlog that is too small for the write rate and outage length forces expensive full syncs.','Size the backlog for the longest outage you want to bridge multiplied by write throughput.']}],
src:[['Replication',K.MGT+'replication/#how-redis-replication-works']]};

/* ---------- 3 ---------- */
L['redis:9:3']={blocks:[
{p:'A full sync has to move the dataset. Two settings affect how: **diskless** replication and the buffers that bound slow replicas.'},
{h:'Diskless'},
{t:[['Setting','Meaning'],
['repl-diskless-sync yes','Child writes the RDB straight to replica sockets, no file on the primary (default since 7.0)'],
['repl-diskless-sync-delay 5','Wait a few seconds so several replicas can share one transfer'],
['repl-diskless-load disabled|on-empty-db|swapdb','How the replica loads: from disk, direct when empty, or into a temporary copy and swap']]},
{h:'Buffers and limits'},
{code:`CONFIG GET client-output-buffer-limit
# replica 256mb 64mb 60`},
{p:'If a replica cannot keep up, the primary stores the pending stream in an output buffer for it. When the buffer passes the hard limit (or the soft limit for the soft period) the primary closes the connection, which starts another full sync. A cycle of full syncs can overload a primary.'},
{h:'Tuning checklist'},
{ul:['Network bandwidth and RDB size decide the sync time. Plan for it.','Stagger replica restarts so they do not all full sync together.','Raise the replica output buffer for large datasets with heavy writes, balanced against memory.','Check `INFO stats` for `sync_full` and `sync_partial_ok`, `sync_partial_err`.']}],
src:[['Replication tuning',K.MGT+'replication/'],['Configuration',K.MGT+'config/']]};

/* ---------- 4 ---------- */
L['redis:9:4']={blocks:[
{p:'Because replication is asynchronous, a failover can lose writes the primary accepted but did not send. Two controls reduce the risk.'},
{h:'WAIT and WAITAOF'},
{svg:wait},
{code:`SET order:77 "paid"
WAIT 1 100            # wait for 1 replica, up to 100 ms
WAITAOF 1 1 100       # 1 local fsync and 1 replica fsync (7.2+)`},
{p:'`WAIT` returns the number of replicas that acknowledged. It does **not** make the system strongly consistent: if fewer replicas answered you decide what to do, and a failover can still choose a replica that missed the write.'},
{h:'Refusing writes when replicas are missing'},
{code:`CONFIG SET min-replicas-to-write 1
CONFIG SET min-replicas-max-lag 10`},
{p:'With these settings the primary stops accepting writes if fewer than one replica is connected with a lag under ten seconds. This bounds the loss window during a network partition.'},
{note:'Choose consistency intentionally. Redis favours availability and speed. If a lost write is unacceptable, keep the system of record in a database designed for that, and use Redis as a derived copy.'}],
src:[['WAIT',K.CMD+'wait/'],['WAITAOF',K.CMD+'waitaof/']]};

/* ---------- 5 ---------- */
L['redis:9:5']={blocks:[
{p:'Healthy replication means every replica is connected and close to the primary offset.'},
{code:`# on the primary
INFO replication
# slave0:ip=10.0.0.11,port=6379,state=online,offset=9084,lag=0

# on a replica
INFO replication
# master_link_status:up
# master_last_io_seconds_ago:0
# slave_repl_offset:9084`},
{t:[['Signal','Healthy','Problem sign'],
['master_link_status','up','down'],
['Offset difference','Close to zero','Growing steadily'],
['lag in seconds','0 to 1','Large or rising'],
['sync_full in INFO stats','Rarely changes','Rising means repeated full syncs'],
['Output buffer memory for replicas','Small','Near the limit'],
['Replicas connected','As expected','Fewer than expected']]},
{h:'Typical failures'},
{ul:['**Link down**: network, authentication or the primary restarted.','**Repeated full syncs**: backlog too small or output buffer limit hit.','**Replica stuck loading**: a very large RDB or slow disk.','**Replica out of memory**: it needs at least the primary memory.']}],
src:[['INFO replication',K.CMD+'info/']]};

/* ---------- 6 ---------- */
L['redis:9:6']={blocks:[
{p:'Replicas can take reads away from the primary, but they come with caveats.'},
{h:'Staleness'},
{p:'Replication is asynchronous, so a read just after a write may not see it. For read-your-writes needs, read from the primary or use `WAIT`. Choose which reads can tolerate staleness, such as product pages, and which cannot, such as balances.'},
{h:'Expiry on replicas'},
{ul:['Replicas do not expire keys by themselves. The primary sends `DEL`.','A replica treats a logically expired key as missing for reads, even before the delete arrives.','The count of keys in `DBSIZE` on a replica may include keys that are expired but not yet deleted.']},
{h:'Other points'},
{t:[['Topic','Note'],
['Writable replicas','Possible with replica-read-only no, but writes are local and not propagated. Avoid'],
['Chained replicas','Reduce load on the primary, increase lag and failure paths'],
['Cluster','Reads on replicas need the READONLY command on the connection'],
['Heavy commands on replicas','Slow commands there still cause replication lag'],
['Memory','A replica needs as much memory as the primary']]},
{note:'Before adding replicas to scale reads, check whether a larger primary, pipelining or a local cache would be simpler. Every replica adds a full sync risk and an output buffer.'}],
src:[['Replication',K.MGT+'replication/']]};
})();
