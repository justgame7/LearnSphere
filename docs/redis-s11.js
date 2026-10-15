/* LearnSphere - Redis, Section 11: High Availability with Sentinel.
   Lectures 0-5 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const arch=K.dg(700,240,[
[10,10,680,220,'Sentinel deployment',1],
[30,70,110,50,'Sentinel 1',0],[30,135,110,50,'Sentinel 2',0],[30,190,110,30,'Sentinel 3',0],
[260,90,140,60,'Primary',2],[480,50,170,50,'Replica 1',0],[480,130,170,50,'Replica 2',0]],
[[140,95,260,110],[140,160,260,125],[400,110,480,80],[400,125,480,150]]);

const down=K.dg(700,220,[
[10,10,680,200,'From subjectively down to failover',1],
[30,60,140,60,'Sentinel misses|replies for 30 s|= SDOWN',0],[220,60,140,60,'Quorum of Sentinels|agree = ODOWN',2],[410,60,130,60,'Majority elects|a leader',0],[590,60,80,60,'Promote',2],
[220,150,320,36,'Leader promotes the best replica',0]],
[[170,90,220,90],[360,90,410,90],[540,90,590,90],[630,120,540,168]]);

const client=K.dg(700,200,[
[10,10,680,180,'A Sentinel-aware client',1],
[30,70,130,60,'Client',0],[230,70,160,60,'Ask Sentinels:|get-master-addr-by-name',2],[460,70,130,60,'Connect to|the primary',0],[620,70,60,60,'Watch|+switch-master',0]],
[[160,100,230,100],[390,100,460,100],[590,100,620,100]]);

/* ---------- 0 ---------- */
L['redis:10:0']={blocks:[
{p:'Replication alone does not fail over. If the primary dies, someone must promote a replica and redirect clients. **Redis Sentinel** is a set of processes that does this automatically.'},
{h:'What Sentinel does'},
{t:[['Function','Meaning'],
['Monitoring','Checks that primaries and replicas work as expected'],
['Notification','Can run scripts or publish events on problems'],
['Automatic failover','Promotes a replica when the primary is unreachable'],
['Configuration provider','Tells clients the address of the current primary']]},
{h:'What it does not do'},
{ul:['It does not shard data. One primary holds the whole dataset.','It does not make writes safe: asynchronous replication can still lose the last writes.','It does not run on its own host alone. You need several Sentinels to avoid a single point of failure.']},
{note:'Sentinel is the right choice for one dataset that fits on one node and needs automatic failover. For data beyond one node, see Redis Cluster.'}],
src:[['Sentinel',K.OPS+'management/sentinel/']]};

/* ---------- 1 ---------- */
L['redis:10:1']={blocks:[
{p:'Sentinels are distributed. They agree about failures through a **quorum**, and elect a **leader** by **majority** before failing over.'},
{svg:arch},
{svg:down},
{h:'Terms'},
{t:[['Term','Meaning'],
['SDOWN (subjectively down)','One Sentinel cannot reach the node within down-after-milliseconds'],
['ODOWN (objectively down)','At least quorum Sentinels agree it is down'],
['Quorum','Sentinels needed to mark ODOWN. Configured per primary'],
['Majority','More than half of **all** Sentinels, needed to authorise a failover'],
['Epoch','A counter that orders failovers and configurations']]},
{note:'The quorum only detects failure. The failover itself needs a **majority** of Sentinels, so with 3 Sentinels two must be reachable, whatever the quorum value.'}],
src:[['Sentinel',K.OPS+'management/sentinel/']]};

/* ---------- 2 ---------- */
L['redis:10:2']={blocks:[
{p:'Sentinel is part of the Redis server binary and has its own configuration file.'},
{code:`# sentinel.conf
port 26379
sentinel monitor mymaster 10.0.0.10 6379 2
sentinel auth-pass mymaster secret
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1

# start
redis-sentinel /etc/redis/sentinel.conf`},
{t:[['Directive','Meaning'],
['monitor name host port quorum','Primary to watch and the quorum'],
['down-after-milliseconds','Unreachable time before SDOWN'],
['failover-timeout','Time limits for steps of the failover'],
['parallel-syncs','How many replicas resync with the new primary at once'],
['auth-pass, auth-user','Credentials for the monitored nodes']]},
{h:'Placement rules'},
{ul:['**At least three** Sentinels, on different hosts and failure domains.','Do not place all Sentinels on the primary host.','Give Sentinels a writable config path: they rewrite their file with discovered replicas and state.','Sentinels find replicas and each other automatically from the primary.']},
{note:'With NAT, containers or cloud networks, set announce addresses (`sentinel announce-ip`, `replica-announce-ip`) so the addresses Sentinel reports are reachable by clients.'}],
src:[['Sentinel configuration',K.OPS+'management/sentinel/#configuring-sentinel']]};

/* ---------- 3 ---------- */
L['redis:10:3']={blocks:[
{p:'When a primary is objectively down, the Sentinels run a failover.'},
{flow:['A Sentinel marks the primary ODOWN with the quorum agreeing','Sentinels elect a leader. It needs a majority of all Sentinels','The leader chooses the best replica','The chosen replica gets REPLICAOF NO ONE and becomes primary','Other replicas are reconfigured to follow it, up to parallel-syncs at a time','The configuration is published with a higher epoch, and the old primary becomes a replica when it returns']},
{h:'How the replica is chosen'},
{t:[['Order','Criterion'],
['1','Exclude replicas that were disconnected too long or are not healthy'],
['2','Lowest replica-priority wins (0 means never promote)'],
['3','Most replicated data, largest offset'],
['4','Lowest run ID as a tie breaker']]},
{h:'Where writes can be lost'},
{p:'Writes the old primary accepted but did not replicate are lost. If the old primary was only partitioned and later returns, it is demoted and its extra writes are discarded.'},
{code:`SENTINEL get-master-addr-by-name mymaster
SENTINEL failover mymaster          # manual failover
SENTINEL masters
SENTINEL replicas mymaster`}],
src:[['Failover',K.OPS+'management/sentinel/#sentinel-state-and-failover']]};

/* ---------- 4 ---------- */
L['redis:10:4']={blocks:[
{p:'With Sentinel, clients do not hard-code the primary address. They ask Sentinel and follow it when it changes.'},
{svg:client},
{h:'What a client library does'},
{ul:['Connects to a list of Sentinel addresses, not to Redis nodes.','Calls `SENTINEL get-master-addr-by-name <name>` to find the primary.','Verifies the role of the node it reaches, because it could be a demoted primary.','Subscribes to `+switch-master` or retries on connection errors, then asks again.']},
{h:'During a failover'},
{t:[['Phase','Client sees','Good practice'],
['Primary down','Connection errors, timeouts','Short timeouts, retry with backoff'],
['Election','Primary not yet known','Retry for a few seconds'],
['New primary up','Connections succeed again','Reconnect and verify role'],
['Pooled connections','Stale connections to the old node','Close pools on switch-master']]},
{note:'Use a client that supports Sentinel and test failover with your application. Many outages with Sentinel are client bugs, such as a pool that keeps the address of the old primary.'}],
src:[['Sentinel clients',K.OPS+'management/sentinel/#sentinel-clients']]};

/* ---------- 5 ---------- */
L['redis:10:5']={blocks:[
{p:'Sentinel needs a little care to operate, and its safety features should be understood before an incident.'},
{code:`redis-cli -p 26379 SENTINEL masters
redis-cli -p 26379 SENTINEL replicas mymaster
redis-cli -p 26379 SENTINEL sentinels mymaster
redis-cli -p 26379 SENTINEL ckquorum mymaster
redis-cli -p 26379 SENTINEL failover mymaster
redis-cli -p 26379 SENTINEL reset mymaster`},
{t:[['Command','Use'],
['SENTINEL ckquorum','Checks that quorum and majority can be reached'],
['SENTINEL failover','Forces a failover without agreement of other Sentinels about failure'],
['SENTINEL reset','Forget replicas and Sentinels and rediscover'],
['SENTINEL simulate-failure','Test crash handling (testing builds and flags)']]},
{h:'Protective behaviours'},
{ul:['**TILT mode**: if the Sentinel process notices large time jumps or stalls, it stops acting for a while to avoid wrong decisions.','**Split brain**: an isolated old primary can accept writes that are lost. Use `min-replicas-to-write` so it stops.','**Down-after-milliseconds** too low causes false failovers during GC or network blips. Too high delays recovery.']},
{h:'Rehearse'},
{p:'Kill the primary process in a test environment and measure: time to detect, time to promote, client recovery and lost writes. Repeat after any change to timeouts or client libraries.'}],
src:[['Sentinel commands',K.OPS+'management/sentinel/#sentinel-commands']]};
})();
