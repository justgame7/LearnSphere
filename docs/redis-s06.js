/* LearnSphere - Redis, Section 06: Pub/Sub, Pipelining, Transactions and Scripting.
   Lectures 0-7 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const pubsub=K.dg(700,210,[
[10,10,680,190,'Pub/Sub: fire and forget fan-out',1],
[30,80,110,50,'Publisher',0],[230,70,140,70,'Channel|news',2],[480,30,160,40,'Subscriber 1',0],[480,85,160,40,'Subscriber 2',0],[480,140,160,40,'Subscriber 3 (offline)|misses it',0]],
[[140,105,230,105],[370,90,480,50],[370,105,480,105]]);

const pipe=K.dg(700,200,[
[10,10,680,180,'Round trips: sequential versus pipelined',1],
[30,55,300,40,'Sequential: send, wait, send, wait ...',0],[30,115,300,40,'Pipelined: send many, then read all replies',2],
[380,55,290,40,'N commands = N round trips',0],[380,115,290,40,'N commands = about 1 round trip',2]],
[]);

const txn=K.dg(700,200,[
[10,10,680,180,'MULTI and EXEC',1],
[30,70,100,50,'MULTI',0],[170,70,150,50,'Commands queued|(QUEUED)',0],[360,70,100,50,'EXEC',2],[500,70,170,50,'All run in order,|no interleaving',0]],
[[130,95,170,95],[320,95,360,95],[460,95,500,95]]);

const watch=K.dg(700,210,[
[10,10,680,190,'WATCH: optimistic locking',1],
[30,60,110,50,'WATCH key',0],[190,60,110,50,'GET key',0],[350,60,110,50,'MULTI, SET',0],[510,60,100,50,'EXEC',2],
[510,135,160,36,'nil = key changed, retry',0]],
[[140,85,190,85],[300,85,350,85],[460,85,510,85],[560,110,560,135]]);

/* ---------- 0 ---------- */
L['redis:5:0']={blocks:[
{p:'**Pub/Sub** lets publishers send messages to named channels and subscribers receive them in real time. Redis does not store messages: a subscriber sees only what is published while it is connected.'},
{svg:pubsub},
{code:`# client A
SUBSCRIBE news
PSUBSCRIBE sport.*

# client B
PUBLISH news "hello"
PUBSUB CHANNELS
PUBSUB NUMSUB news`},
{t:[['Property','Behaviour'],
['Delivery','At most once. No acknowledgement, no replay'],
['Persistence','None'],
['Patterns','PSUBSCRIBE with glob patterns'],
['Keyspace','Channels are not part of any database'],
['Slow subscribers','Disconnected when their output buffer passes the pubsub limit']]},
{h:'Notes'},
{ul:['With RESP2 a connection in subscribe mode can only issue subscription commands, so use a dedicated connection. RESP3 lifts this.','Publishing is O(N + M): N subscribers and M matching patterns.','Messages published during a failover or a reconnect are lost.']},
{note:'Pub/Sub is excellent for cache invalidation hints, live notifications and presence. If a missed message causes harm, use a stream.'}],
src:[['Pub/Sub',K.D+'develop/pubsub/'],['PUBLISH',K.CMD+'publish/']]};

/* ---------- 1 ---------- */
L['redis:5:1']={blocks:[
{p:'In a cluster, a classic `PUBLISH` is broadcast to every node, which does not scale. **Sharded Pub/Sub** (Redis 7.0+) maps a channel to a hash slot, so a message goes only to the shard that owns the slot.'},
{code:`SSUBSCRIBE orders:{eu}
SPUBLISH orders:{eu} "new order"
PUBSUB SHARDCHANNELS`},
{t:[['','Classic','Sharded'],
['Commands','SUBSCRIBE, PUBLISH','SSUBSCRIBE, SPUBLISH'],
['Cluster traffic','Broadcast to all nodes','Only the owning shard and its replicas'],
['Pattern subscribe','Yes','No'],
['Best for','Standalone, small clusters','Large clusters with many channels']]},
{h:'Keyspace notifications'},
{p:'Redis can publish events when keys change. They are off by default because of CPU cost, and enabled with `notify-keyspace-events`.'},
{code:`CONFIG SET notify-keyspace-events KEA
PSUBSCRIBE __keyevent@0__:expired
PSUBSCRIBE __keyspace@0__:session:*`},
{ul:['`K` publishes on `__keyspace@db__:key` with the event name as message.','`E` publishes on `__keyevent@db__:event` with the key name as message.','`x` is expired events, `e` is evicted, `g` is generic, `A` is all classes.']},
{note:'An expired event fires when Redis actually deletes the key, which can be later than the TTL moment. Do not use it as a precise timer, and remember notifications are also fire-and-forget.'}],
src:[['Keyspace notifications',K.D+'develop/pubsub/keyspace-notifications/'],['SPUBLISH',K.CMD+'spublish/']]};

/* ---------- 2 ---------- */
L['redis:5:2']={blocks:[
{p:'Each command normally costs a network **round trip** (RTT). On a fast server, the time is dominated by waiting for the network, not by Redis. **Pipelining** sends many commands without waiting for each reply, then reads the replies in order.'},
{svg:pipe},
{code:`# redis-cli
printf 'SET a 1\\nSET b 2\\nINCR a\\n' | redis-cli --pipe

# conceptual client code
pipeline = client.pipeline(transaction=False)
for i in range(1000):
    pipeline.set("k:%d" % i, i)
pipeline.execute()`},
{h:'What it is and is not'},
{t:[['Property','Pipeline'],
['Atomic?','No. Other clients can run between your commands'],
['Order','Commands run in the order sent on one connection'],
['Failure','Each command succeeds or fails on its own'],
['Memory','The server queues replies, so use batches of a few thousand'],
['Gain','Often 5 to 10 times throughput on a network path']]},
{note:'Pipelining is a client and network optimisation. Use `MGET` and `MSET` when one command can do the job. Use transactions or scripts when you need atomicity.'}],
src:[['Pipelining',K.D+'develop/use/pipelining/']]};

/* ---------- 3 ---------- */
L['redis:5:3']={blocks:[
{p:'A **transaction** groups commands so they run **one after another, with nothing in between**. It is started by `MULTI` and run by `EXEC`.'},
{svg:txn},
{code:`MULTI
INCR   stock:item:5
LPUSH  orders:log "item:5"
SADD   buyers "user:9"
EXEC`},
{h:'What is guaranteed'},
{ul:['**Isolation**: no other client command runs between your queued commands.','**Single execution**: either all queued commands run (EXEC), or none (DISCARD or disconnect).']},
{h:'What is not guaranteed'},
{t:[['Situation','Result'],
['Syntax error or unknown command while queueing','The whole transaction is aborted at EXEC (EXECABORT)'],
['Runtime error in one command (wrong type)','Other commands still run. There is no rollback'],
['Server crash mid-transaction','Depends on persistence. The AOF records the transaction as one unit'],
['Reading a value and deciding','Not possible inside MULTI. Replies come only at EXEC']]},
{note:'A Redis transaction is not a SQL transaction. There is no rollback and no isolation level choice. Use WATCH for check-and-set, or a script when logic must read then write.'}],
src:[['Transactions',K.D+'develop/using-commands/transactions/'],['MULTI',K.CMD+'multi/']]};

/* ---------- 4 ---------- */
L['redis:5:4']={blocks:[
{p:'`WATCH` adds **optimistic locking**. You watch keys, read them, and queue changes. If any watched key changed before `EXEC`, the transaction is not applied and `EXEC` returns nil. You retry.'},
{svg:watch},
{code:`WATCH balance:ana
GET   balance:ana          # 100
MULTI
SET   balance:ana 80
EXEC                       # nil if someone changed balance:ana`},
{flow:['WATCH the keys that the decision depends on','Read them in normal commands','Compute the new value in the client','MULTI, queue the writes, EXEC','If EXEC returns nil, repeat from the start']},
{h:'Details'},
{ul:['`UNWATCH` and `DISCARD` clear watches. `EXEC` clears them too.','A key that expires or is evicted during the watch counts as a change.','Under heavy contention retries can starve. A Lua script avoids this by doing the read and write in one step.']},
{note:'Most atomic read-modify-write needs are simpler with a script, or with a single built-in command such as INCR, HINCRBY or SET NX.'}],
src:[['Optimistic locking',K.D+'develop/using-commands/transactions/#optimistic-locking-using-watch']]};

/* ---------- 5 ---------- */
L['redis:5:5']={blocks:[
{p:'Redis embeds a **Lua** interpreter. A script runs on the server as **one atomic step**, so it can read, decide and write without races and with a single round trip.'},
{code:`EVAL "
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1])
return 1
" 1 hiscore:ana 500`},
{h:'Structure of EVAL'},
{t:[['Part','Meaning'],
['Script text','Lua code'],
['numkeys','How many of the following arguments are key names'],
['KEYS[1..n]','Key names. Declare every key you touch so Cluster can route it'],
['ARGV[1..m]','Other arguments'],
['redis.call','Run a command, raise an error on failure'],
['redis.pcall','Run a command, return the error as a value']]},
{h:'Caching scripts'},
{code:`SCRIPT LOAD "return redis.call('GET', KEYS[1])"
EVALSHA <sha1> 1 mykey`},
{p:'`EVALSHA` sends the SHA1 of a loaded script instead of the text. If the script cache was flushed or the server restarted, the call returns `NOSCRIPT` and the client loads it again.'},
{h:'Rules'},
{ul:['A script blocks the server while it runs. Keep it short and avoid unbounded loops.','Blocking commands inside a script do not wait: they behave like their non-blocking forms.','A script running too long is reported as busy. `SCRIPT KILL` stops one that has not written yet.']},
{note:'Lua is great for compare-and-set, token buckets and multi-key invariants. For anything long-lived, prefer functions, the next lesson.'}],
src:[['Lua scripting',K.D+'develop/programmability/eval-intro/'],['EVAL',K.CMD+'eval/']]};

/* ---------- 6 ---------- */
L['redis:5:6']={blocks:[
{p:'**Redis Functions** (7.0+) are the managed successor to scripts. Code is organised in **libraries**, stored in the server and **persisted and replicated** with the data, so there is no need for clients to load scripts or handle `NOSCRIPT`.'},
{code:`FUNCTION LOAD "#!lua name=mylib
redis.register_function('setmax', function(keys, args)
  local cur = redis.call('GET', keys[1])
  if not cur or tonumber(cur) < tonumber(args[1]) then
    redis.call('SET', keys[1], args[1])
    return 1
  end
  return 0
end)"

FCALL setmax 1 hiscore:ana 500
FCALL_RO fn 1 key arg
FUNCTION LIST
FUNCTION DELETE mylib`},
{t:[['','EVAL scripts','Functions'],
['Stored where','Client sends or loads, in a cache','In the database, in RDB and AOF'],
['Replicated','As effects of calls','Library itself is replicated'],
['Lifecycle','Cache is lost on restart','Managed with FUNCTION commands'],
['Organisation','Anonymous snippets','Named libraries with several functions'],
['Call','EVAL or EVALSHA','FCALL, FCALL_RO']]},
{h:'Operations'},
{ul:['`FUNCTION DUMP` and `FUNCTION RESTORE` move libraries between servers.','Use flags such as `no-writes` to allow a function on replicas through `FCALL_RO`.','Deploy functions like code: version the library name or use `FUNCTION LOAD REPLACE` in a controlled step.']}],
src:[['Functions',K.D+'develop/programmability/functions-intro/'],['FUNCTION LOAD',K.CMD+'function-load/']]};

/* ---------- 7 ---------- */
L['redis:5:7']={blocks:[
{p:'Pipelines, transactions and scripts solve different problems. Choose by what must be true.'},
{t:[['Need','Use','Why'],
['Fewer round trips for independent commands','Pipeline','No atomicity needed'],
['Several writes that must run together','MULTI and EXEC','Isolated and all-or-nothing queueing'],
['Check a value, then write, with rare conflicts','WATCH, MULTI, EXEC','Optimistic locking with retry'],
['Read, branch, write with conflicts or complex logic','Lua script or function','One atomic step, one round trip'],
['One reusable server-side API','Function library','Persisted and replicated']]},
{h:'Combined use'},
{ul:['Pipeline several transactions or script calls for throughput.','A transaction may contain `EVALSHA` or `FCALL`.','In Cluster, all keys used together must live in one slot (hash tags).']},
{note:'Do not use a heavy script to avoid modelling. Long scripts block every client. Keep them to a few commands and test them with realistic data sizes.'}],
src:[['Programmability',K.D+'develop/programmability/']]};
})();
