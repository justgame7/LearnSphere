/* LearnSphere - Redis, Section 12: Redis Cluster.
   Lectures 0-9 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const shards=K.dg(700,240,[
[10,10,680,220,'Redis Cluster: 3 shards, each primary with a replica',1],
[30,60,190,60,'Primary A|slots 0 to 5460',2],[255,60,190,60,'Primary B|slots 5461 to 10922',2],[480,60,190,60,'Primary C|slots 10923 to 16383',2],
[30,150,190,50,'Replica of A',0],[255,150,190,50,'Replica of B',0],[480,150,190,50,'Replica of C',0]],
[[125,120,125,150],[350,120,350,150],[575,120,575,150]]);

const slot=K.dg(700,170,[
[10,10,680,150,'Key to node',1],
[30,60,130,50,'key|user:1001',0],[210,60,170,50,'CRC16(key) mod 16384|= slot 7438',2],[430,60,110,50,'Slot 7438|owned by B',0],[590,60,80,50,'Node B',2]],
[[160,85,210,85],[380,85,430,85],[540,85,590,85]]);

const move=K.dg(700,210,[
[10,10,680,190,'MOVED and ASK redirections',1],
[30,70,110,50,'Client',0],[220,40,160,50,'Node A|not owner: MOVED 7438 B',0],[220,120,160,50,'Node B|owner',2],[460,40,200,50,'Slot being migrated:|ASK, then ASKING',0],[460,120,200,50,'Client updates its|slot map after MOVED',0]],
[[140,95,220,65],[300,90,300,120],[380,145,460,145]]);

/* ---------- 0 ---------- */
L['redis:11:0']={blocks:[
{p:'**Redis Cluster** splits the keyspace across several primaries (shards) and adds replication and failover within the same system. It scales **memory and writes** beyond one node, and keeps working when some nodes fail.'},
{svg:shards},
{h:'What you get'},
{ul:['Automatic sharding by hash slot.','Built-in failover with no Sentinel.','Linear scaling of memory and throughput by adding shards.']},
{h:'What it costs'},
{ul:['Multi-key commands work only when keys share a slot.','Only database 0.','Clients must be cluster aware.','More moving parts: more nodes, bus ports and operations.','Not strongly consistent: asynchronous replication can lose acknowledged writes on failover.']},
{note:'A single node can serve very large workloads. Move to Cluster when the dataset or write rate no longer fits one node, not simply for availability, which Sentinel also provides.'}],
src:[['Redis Cluster',K.OPS+'management/scaling/'],['Cluster specification',K.D+'operate/oss_and_stack/reference/cluster-spec/']]};

/* ---------- 1 ---------- */
L['redis:11:1']={blocks:[
{p:'The keyspace is divided into **16384 hash slots**. Each primary owns a subset. A key belongs to the slot `CRC16(key) mod 16384`.'},
{svg:slot},
{code:`CLUSTER KEYSLOT user:1001
CLUSTER COUNTKEYSINSLOT 7438
CLUSTER GETKEYSINSLOT 7438 10
CLUSTER SLOTS
CLUSTER SHARDS`},
{h:'Why slots'},
{ul:['Slots are the unit of movement: adding a node means moving some slots to it.','16384 is small enough for nodes to exchange ownership maps cheaply.','A key is always in exactly one slot, so clients can compute the target node.']},
{t:[['Term','Meaning'],
['Slot','One of 16384 partitions'],
['Shard','A primary and its replicas'],
['Slot map','The table slot to node held by every node and cached by clients']]},
{note:'Slot count is fixed. The practical maximum number of primaries is around 1000, and teams commonly run far fewer.'}],
src:[['Key distribution',K.D+'operate/oss_and_stack/reference/cluster-spec/#key-distribution-model']]};

/* ---------- 2 ---------- */
L['redis:11:2']={blocks:[
{p:'Commands touching several keys (`MGET`, `SUNION`, transactions, scripts) work only if **all keys are in the same slot**. Otherwise you get `CROSSSLOT`.'},
{h:'Hash tags'},
{p:'If a key contains `{...}`, only the text inside the first braces is hashed. Keys with the same tag land in the same slot.'},
{code:`SET user:{1001}:profile "..."
SET user:{1001}:cart "..."
MGET user:{1001}:profile user:{1001}:cart      # same slot

SUNION cart:{1001} wishlist:{1001}             # allowed
MGET a b                                       # CROSSSLOT error likely`},
{h:'Design guidance'},
{t:[['Do','Do not'],
['Tag by an entity that is always accessed together, such as a user id','Use one tag for everything. That creates one giant hot slot'],
['Keep a tagged group small','Put unbounded data under one tag'],
['Design operations around single keys','Rely on cross-key transactions across shards']]},
{note:'Pipelines and scripts must also respect slots. Declare every key a script touches, and keep them in one slot.'}],
src:[['Hash tags',K.D+'operate/oss_and_stack/reference/cluster-spec/#hash-tags']]};

/* ---------- 3 ---------- */
L['redis:11:3']={blocks:[
{p:'Each node needs cluster mode on. Then `redis-cli` can create the cluster.'},
{code:`# redis.conf on every node
port 7000
cluster-enabled yes
cluster-config-file nodes-7000.conf
cluster-node-timeout 15000
appendonly yes

# create 3 primaries with 1 replica each
redis-cli --cluster create \\
  10.0.0.1:7000 10.0.0.2:7000 10.0.0.3:7000 \\
  10.0.0.4:7000 10.0.0.5:7000 10.0.0.6:7000 \\
  --cluster-replicas 1

redis-cli --cluster check 10.0.0.1:7000
redis-cli -c -p 7000 CLUSTER INFO`},
{t:[['Setting','Purpose'],
['cluster-enabled yes','Run in cluster mode'],
['cluster-config-file','State file managed by Redis, do not edit'],
['cluster-node-timeout','Milliseconds before a node is considered failing'],
['cluster-port','Bus port, defaults to port + 10000'],
['cluster-require-full-coverage','Stop serving if any slot is not covered (default yes)']]},
{h:'Network'},
{p:'Every node must reach the others on the client port and on the **cluster bus port**. Open both in firewalls.'},
{note:'Use at least three primaries. With fewer, a majority of primaries is not available to agree on failure.'}],
src:[['Cluster tutorial',K.OPS+'management/scaling/#create-a-redis-cluster']]};

/* ---------- 4 ---------- */
L['redis:11:4']={blocks:[
{p:'Cluster nodes talk to each other directly over a binary **cluster bus** using a **gossip** protocol. There is no central coordinator.'},
{t:[['Mechanism','What it does'],
['PING and PONG','Nodes exchange heartbeats with state about themselves and some peers'],
['MEET','Introduces a node to the cluster'],
['Epochs','Counters that order configuration changes and elections'],
['Failure detection','PFAIL when one node cannot reach another, FAIL when a majority of primaries agree']]},
{code:`CLUSTER NODES
CLUSTER INFO
CLUSTER MYID`},
{h:'Reading CLUSTER NODES'},
{ul:['Each line gives id, address, flags (master, slave, myself, fail), the primary id for replicas, link state and slot ranges.','`cluster_state:ok` in `CLUSTER INFO` means all slots are covered.','`cluster_slots_fail` or `pfail` above zero means trouble.']},
{note:'Slots, nodes and epochs are stored in `nodes.conf` on each node, which is why Redis writes it itself. Never edit it while a node is running.'}],
src:[['Cluster bus',K.D+'operate/oss_and_stack/reference/cluster-spec/#cluster-bus']]};

/* ---------- 5 ---------- */
L['redis:11:5']={blocks:[
{p:'When a primary fails, one of its replicas is elected and promoted by the other primaries. Failover finishes without any external tool.'},
{flow:['Replicas and primaries stop receiving PONGs from the node','A node flags it PFAIL, then the majority of primaries mark it FAIL','Replicas of the failed primary request votes','Primaries vote, and the replica with the best offset usually wins','The replica becomes primary and takes over the slots','Clients learn the new owner through MOVED']},
{h:'Settings that matter'},
{t:[['Setting','Effect'],
['cluster-node-timeout','Failure detection time. Lower is faster but less tolerant to pauses'],
['cluster-replica-validity-factor','How stale a replica may be and still run for election'],
['cluster-migration-barrier','Minimum replicas a primary keeps before one can move to cover an orphan'],
['cluster-require-full-coverage','If yes, the whole cluster stops when any slot has no owner'],
['cluster-allow-reads-when-down','Allow reads while the cluster is down']]},
{h:'When the cluster stops'},
{ul:['A shard loses its primary and all replicas: its slots are uncovered. With full coverage, the cluster refuses queries.','A minority partition cannot reach a majority of primaries, so it stops accepting writes after the timeout.']},
{code:`CLUSTER FAILOVER           # on a replica: planned, coordinated
CLUSTER FAILOVER TAKEOVER  # force without agreement, use rarely`}],
src:[['Failover',K.D+'operate/oss_and_stack/reference/cluster-spec/#replica-election-and-promotion']]};

/* ---------- 6 ---------- */
L['redis:11:6']={blocks:[
{p:'Scaling means moving slots and their keys between nodes while the cluster serves traffic.'},
{code:`# add an empty node and rebalance
redis-cli --cluster add-node 10.0.0.7:7000 10.0.0.1:7000
redis-cli --cluster rebalance 10.0.0.1:7000 --cluster-use-empty-masters

# move a number of slots by hand
redis-cli --cluster reshard 10.0.0.1:7000

# remove a node (after emptying its slots)
redis-cli --cluster del-node 10.0.0.1:7000 <node-id>`},
{h:'How a slot moves'},
{flow:['Target node marks the slot IMPORTING, source marks it MIGRATING','Keys are moved one by one with MIGRATE','Requests for keys already moved get an ASK redirection to the target','After the last key, ownership is assigned to the target','Clients get MOVED for the slot from then on']},
{t:[['Situation','Tip'],
['Large keys','MIGRATE is blocking per key, so a huge key stalls both nodes'],
['Peak traffic','Reshard in off-peak hours and in small steps'],
['Long migrations','Monitor with redis-cli --cluster check and INFO'],
['Newer versions','Atomic slot migration reduces key-by-key issues. Check release notes']]},
{note:'Resharding keys are copied one at a time, so a big-key problem becomes visible here. Fix big keys before scaling out.'}],
src:[['Resharding',K.OPS+'management/scaling/#reshard-the-cluster']]};

/* ---------- 7 ---------- */
L['redis:11:7']={blocks:[
{p:'A cluster-aware client keeps a copy of the slot map, hashes each key itself and connects to the right node. When the map is wrong, the server replies with a redirection.'},
{svg:move},
{t:[['Reply','Meaning','Client action'],
['MOVED slot host:port','Slot permanently lives at another node','Update the slot map and retry there'],
['ASK slot host:port','Slot is moving, this key is already on the target','Send ASKING then the command to the target once, do not update the map'],
['CROSSSLOT','Keys in different slots','Fix the keys or use hash tags'],
['CLUSTERDOWN','Cluster cannot serve the slot','Back off and retry']]},
{h:'Reading from replicas'},
{code:`READONLY      # on a replica connection: allow reads for its slots
READWRITE     # back to default`},
{p:'Reads from replicas can be stale. Most clients expose a read-from-replica option, and routing is handled in the library.'},
{note:'Use a maintained cluster client. Hand-rolled routing breaks during resharding and failover. `redis-cli -c` follows redirections for testing.'}],
src:[['Cluster clients',K.OPS+'management/scaling/']]};

/* ---------- 8 ---------- */
L['redis:11:8']={blocks:[
{p:'Know the limits before designing for Cluster.'},
{t:[['Limitation','Impact','Workaround'],
['Multi-key operations need one slot','CROSSSLOT errors','Hash tags, or redesign'],
['Only database 0','No SELECT based separation','Key prefixes, separate clusters'],
['No cross-slot transactions or scripts','Atomic units are one slot','Model around a tagged entity'],
['Classic Pub/Sub is broadcast','Wasted bus traffic at scale','Sharded Pub/Sub'],
['KEYS and SCAN are per node','Must iterate every primary','Run on each primary'],
['Large keys move slowly','Resharding stalls','Split large keys'],
['Asynchronous replication','Acknowledged writes can be lost on failover','WAIT, accept risk']]},
{h:'Common troubleshooting'},
{ul:['`cluster_state:fail`: check slots with `redis-cli --cluster check` and fix uncovered slots with `--cluster fix` carefully.','Nodes with the wrong address after a restart: set `cluster-announce-ip`, `cluster-announce-port` and bus port.','Persistent `MOVED` loops: client slot map is stale or points at the wrong addresses.','Replicas not promoted: not enough healthy primaries to vote, or stale replica data.']},
{note:'Back up every primary. A cluster backup is a set of per-node snapshots taken close together, and restore needs the same slot layout.'}],
src:[['Cluster limitations',K.OPS+'management/scaling/']]};

/* ---------- 9 ---------- */
L['redis:11:9']={blocks:[
{p:'There are three topologies. Start with the simplest that meets the need.'},
{t:[['','Standalone','Sentinel','Cluster'],
['Data size','One node','One node','Many nodes'],
['Write scaling','One primary','One primary','Many primaries'],
['Automatic failover','No','Yes','Yes'],
['Multi-key operations','Any','Any','Same slot only'],
['Databases','Many','Many','Only 0'],
['Operations effort','Lowest','Medium','Highest'],
['Client support','Anything','Sentinel aware','Cluster aware']]},
{h:'Decision questions'},
{flow:['Does the dataset and write rate fit one node with headroom? If no, Cluster','Do you need automatic failover? If yes, Sentinel (or a managed service)','Is a short outage acceptable and a restore fine? Standalone with backups','Would moving to Cluster later require changing keys and clients? Plan hash tags early']},
{note:'Many managed services offer cluster mode as an option. Check whether your client library and data model are ready for it before enabling.'}],
src:[['Scaling',K.OPS+'management/scaling/']]};
})();
