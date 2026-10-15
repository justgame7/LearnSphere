/* LearnSphere - Redis, Section 16: Application Patterns and Clients.
   Lectures 0-9 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const aside=K.dg(700,230,[
[10,10,680,210,'Cache-aside',1],
[30,85,110,60,'Application',0],[230,40,150,50,'1. GET from Redis',2],[230,130,150,50,'2. On miss, read DB',0],[470,40,190,50,'Hit: return value',0],[470,130,190,50,'3. SET with TTL, return',0]],
[[140,100,230,65],[140,115,230,155],[380,65,470,65],[380,155,470,155]]);

const stampede=K.dg(700,200,[
[10,10,680,180,'Cache stampede and the defence',1],
[30,60,160,60,'Hot key expires,|many requests miss',0],[230,60,200,60,'One request takes a lock|and rebuilds',2],[470,60,200,60,'Others wait briefly or|serve stale value',0]],
[[190,90,230,90],[430,90,470,90]]);

const lock=K.dg(700,200,[
[10,10,680,180,'Lock with a token',1],
[30,60,150,60,'SET lock token|NX PX 30000',2],[220,60,150,60,'Do the work|(shorter than TTL)',0],[410,60,150,60,'Release only if|token matches (Lua)',2],[590,60,80,60,'Done',0]],
[[180,90,220,90],[370,90,410,90],[560,90,590,90]]);

const tracking=K.dg(700,200,[
[10,10,680,180,'Client-side caching with tracking',1],
[30,60,140,60,'App local|cache',0],[230,60,140,60,'First read|asks Redis',0],[430,60,110,60,'Redis remembers|keys per client',2],[580,60,90,60,'Push|invalidation',0]],
[[170,90,230,90],[370,90,430,90],[540,90,580,90]]);

/* ---------- 0 ---------- */
L['redis:15:0']={blocks:[
{p:'The client library is part of your Redis deployment. Many outages are client behaviour: too many connections, no timeouts or ignoring failover.'},
{t:[['Language','Common clients'],
['Python','redis-py'],
['Java','Jedis, Lettuce, Redisson'],
['JavaScript','node-redis, ioredis'],
['Go','go-redis, rueidis'],
['.NET','StackExchange.Redis'],
['Rust','redis-rs']]},
{h:'Pooling or multiplexing'},
{t:[['Model','How it works','Notes'],
['Connection pool','Each request borrows a connection','Size it, return it, avoid blocking commands on shared connections'],
['Multiplexing','One connection carries many commands','Efficient. Blocking commands and transactions need care']]},
{h:'Settings every client needs'},
{ul:['**Connect and command timeouts**, short and explicit.','**Retries** with exponential backoff and jitter, only for idempotent commands.','**Keepalive** and health checks so dead connections are noticed.','**Topology awareness**: Sentinel or Cluster support, and DNS refresh for managed endpoints.','**Naming**: set a client name for diagnostics.']},
{note:'Blocking commands such as `BLPOP` or `XREAD BLOCK` hold a connection. Give them dedicated connections so they do not starve the rest of the pool.'}],
src:[['Client libraries',K.CL]]};

/* ---------- 1 ---------- */
L['redis:15:1']={blocks:[
{p:'A cache holds a copy of data from a slower system. The strategy decides who fills it and who keeps it correct.'},
{svg:aside},
{t:[['Pattern','How it works','Strengths','Weaknesses'],
['Cache-aside','Application reads cache, on miss reads DB and fills cache','Simple, only needed data cached','First request is slow, possible staleness'],
['Read-through','Cache layer loads on miss','App code simpler','Needs a loader component'],
['Write-through','Write to cache and DB together','Cache is fresh','Slower writes, cache may hold unused data'],
['Write-behind','Write to cache, persist to DB later','Fast writes','Risk of loss, complex'],
['Refresh-ahead','Reload hot keys before expiry','Few misses','Extra load, complexity']]},
{h:'Invalidation'},
{ul:['Short TTLs: easy, bounded staleness.','Delete or update the cache entry on write, after the database commit.','Versioned keys, such as `product:42:v7`, avoid races.','Cache negative results briefly to protect the database.']},
{code:`# cache-aside in outline
value = GET product:42
if value is nil:
    value = db.read(42)
    SET product:42 value EX 300
return value`},
{note:'Invalidation is the hard part. Decide how stale each kind of data may be, and write that down next to the TTL.'}],
src:[['Caching with Redis',K.D+'develop/use/patterns/'],['SET',K.CMD+'set/']]};

/* ---------- 2 ---------- */
L['redis:15:2']={blocks:[
{p:'Caches fail in predictable ways under load.'},
{svg:stampede},
{t:[['Problem','What happens','Defences'],
['Stampede (dog-pile)','A hot key expires and many requests hit the database at once','Single-flight lock per key, serve stale while refreshing, refresh ahead'],
['Penetration','Requests for keys that do not exist bypass the cache every time','Cache negative results, Bloom filter, input validation'],
['Avalanche','Many keys expire together or the cache is lost','TTL jitter, warm-up, rate limit the database, replicas'],
['Hot key','One key takes too much traffic','Local cache, client-side caching, key replication'],
['Stale reads','Cache older than the data','Shorter TTL, explicit invalidation, versioned keys']]},
{code:`SET lock:product:42 <token> NX PX 5000     # one rebuilder
# others: wait 50 ms and retry GET, or serve the stale copy`},
{note:'A cache restart or eviction storm is a capacity event for the database. Test that the database can survive a cold cache at peak, or add rate limiting in front of it.'}],
src:[['Caching patterns',K.D+'develop/use/patterns/']]};

/* ---------- 3 ---------- */
L['redis:15:3']={blocks:[
{p:'Session data is small, short-lived and read on every request, which suits Redis well.'},
{code:`# session as a hash, 30 minutes sliding expiry
HSET session:af3 user_id 1001 role admin csrf x9
EXPIRE session:af3 1800

# on each request: read and extend
HGETALL session:af3
EXPIRE session:af3 1800

# index sessions of one user for logout everywhere
SADD user:1001:sessions af3
DEL session:af3
SREM user:1001:sessions af3`},
{h:'Design choices'},
{t:[['Choice','Options'],
['Format','Hash for fields, or a serialised string'],
['Expiry','Absolute (SET EX) or sliding (extend on use, GETEX)'],
['Revocation','Delete the key, or a per-user set to list and remove all'],
['Tokens','Opaque ids in Redis, or signed tokens plus a deny list with TTL'],
['Durability','AOF everysec and a replica so users are not logged out on failure']]},
{ul:['Use unguessable session ids from a secure random source.','Keep the session small. Put big data elsewhere and reference it.','Limit the lifetime and re-authenticate for sensitive actions.']}],
src:[['Redis data types',K.DT]]};

/* ---------- 4 ---------- */
L['redis:15:4']={blocks:[
{p:'Rate limiting counts events per identity within a time window. Redis is a good fit because of atomic counters and expiry.'},
{h:'Fixed window'},
{code:`# 100 requests per minute per user
INCR rl:user:42:202610151230
EXPIRE rl:user:42:202610151230 60 NX`},
{p:'Simple and cheap, but a burst at the window boundary can double the allowed rate.'},
{h:'Sliding window log'},
{p:'A sorted set holds one entry per request with the timestamp as score. Exact, but memory grows with the limit.'},
{h:'Sliding window counter and token bucket'},
{p:'A token bucket stores tokens and a last refill time. Update both in a **Lua script** so the check and the update are atomic.'},
{code:`-- token bucket (outline)
local tokens = tonumber(redis.call('HGET', KEYS[1], 't') or ARGV[1])
local last   = tonumber(redis.call('HGET', KEYS[1], 'ts') or ARGV[3])
tokens = math.min(ARGV[1], tokens + (ARGV[3]-last) * ARGV[2])
if tokens >= 1 then
  redis.call('HSET', KEYS[1], 't', tokens-1, 'ts', ARGV[3])
  redis.call('EXPIRE', KEYS[1], 120)
  return 1
end
return 0`},
{t:[['Method','Accuracy','Memory','Use'],
['Fixed window','Low at boundaries','Tiny','Coarse limits'],
['Sliding log','Exact','High','Strict, low volume'],
['Sliding counter','Good','Small','General APIs'],
['Token bucket','Allows bursts','Small','Smooth with burst allowance']]}],
src:[['Rate limiting',K.D+'develop/use/patterns/']]};

/* ---------- 5 ---------- */
L['redis:15:5']={blocks:[
{p:'A **distributed lock** gives one process at a time the right to do something. A single Redis node can implement it safely enough for many uses if you follow the rules.'},
{svg:lock},
{code:`# acquire: unique token, only if free, with expiry
SET lock:report <random-token> NX PX 30000

# release: only if still the owner (Lua, atomic)
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`},
{h:'Rules'},
{ul:['Always set an expiry, so a crashed owner does not hold the lock forever.','Use a unique token and release only if it matches.','Keep the work shorter than the TTL, or extend the lease while working.','Do not assume the lock is held after a long pause. A paused process can resume after expiry.']},
{h:'Redlock and its limits'},
{p:'**Redlock** uses several independent nodes and requires a majority. It improves availability, but it does not give correctness under process pauses and clock jumps. For correctness (for example protecting a write to another system), add a **fencing token** checked by the resource being protected, or use a system with real consensus.'},
{note:'Locks for efficiency, such as avoiding duplicate work, are fine with a single node. Locks that protect correctness need fencing at the resource.'}],
src:[['Distributed locks',K.D+'develop/use/patterns/distributed-locks/']]};

/* ---------- 6 ---------- */
L['redis:15:6']={blocks:[
{p:'Queues move work from producers to workers. Redis supports simple and reliable variants.'},
{t:[['Need','Pattern'],
['Simple background jobs','List: LPUSH, BRPOP'],
['No lost jobs when a worker dies','List with LMOVE to a processing list, or a stream with consumer groups'],
['Retries, history, several consumer groups','Stream'],
['Delayed or scheduled jobs','Sorted set with due time as score'],
['Priorities','Several lists, or a sorted set with ZPOPMIN'],
['Exactly-once effect','At-least-once delivery plus idempotent handlers']]},
{h:'Reliable stream worker loop'},
{flow:['XREADGROUP with > for new entries','Process the entry. Make the handler idempotent','XACK on success','Periodically XAUTOCLAIM entries idle too long, count deliveries','Move poison entries to a dead letter stream after N attempts']},
{h:'Use a library'},
{p:'Mature libraries implement retries, delays, rate limits and dashboards on Redis: for example BullMQ (Node.js), Sidekiq (Ruby), RQ and Celery (Python). Prefer them unless your needs are small.'},
{note:'Redis is an excellent queue for moderate volumes. If you need long retention, strict ordering across partitions or replay for days, compare with a log system built for it.'}],
src:[['Streams',K.DT+'streams/']]};

/* ---------- 7 ---------- */
L['redis:15:7']={blocks:[
{p:'Real-time numbers are a combination of the structures you already know.'},
{t:[['Need','Structure','Commands'],
['Top N players or items','Sorted set','ZINCRBY, ZRANGE REV'],
['A player rank','Sorted set','ZREVRANK'],
['Unique visitors per day','HyperLogLog','PFADD, PFCOUNT, PFMERGE'],
['Daily active users by id','Bitmap','SETBIT, BITCOUNT, BITOP'],
['Counters per page and hour','String or hash counters','INCR, HINCRBY with expiry'],
['Metrics over time','Time series','TS.ADD, TS.RANGE'],
['Trending items','Top-K or sorted set with decay','TOPK.ADD, ZADD']]},
{code:`ZINCRBY lb:2026-10 25 "player:9"
ZREVRANGE lb:2026-10 0 9 WITHSCORES
PFADD uv:2026-10-15 "u1" "u2"
SETBIT dau:2026-10-15 1001 1
BITCOUNT dau:2026-10-15`},
{h:'Design tips'},
{ul:['Put the period in the key (`...:2026-10-15`) and set an expiry, so old data disappears by itself.','Roll up small buckets into larger ones in the background.','Write the raw events to a durable store if you may need to recompute.']}],
src:[['Redis patterns',K.D+'develop/use/patterns/']]};

/* ---------- 8 ---------- */
L['redis:15:8']={blocks:[
{p:'The fastest read is one that never leaves the application process. **Client-side caching** keeps hot values in local memory and relies on Redis to tell the client when they change.'},
{svg:tracking},
{code:`CLIENT TRACKING ON
CLIENT TRACKING ON BCAST PREFIX user: PREFIX session:
CLIENT TRACKING ON OPTIN
CLIENT CACHING YES`},
{t:[['Mode','How it works','Memory on the server'],
['Default','Server remembers which keys each client read, and sends an invalidation on change','Uses a tracking table'],
['Broadcast (BCAST)','Client subscribes to key prefixes and gets every change under them','Small'],
['OPTIN, OPTOUT','Client chooses which reads are tracked','Controlled'],
['NOLOOP','Do not send invalidations for the client own writes','Same']]},
{h:'Points to know'},
{ul:['Invalidations arrive as push messages on RESP3, or through a redirect connection with RESP2.','On disconnect the client must clear its local cache.','Server memory for tracking is bounded by `tracking-table-max-keys`.','Supported by many modern client libraries as a built-in feature.']},
{note:'Use it for read-heavy, rarely changing data such as configuration or product details. It adds complexity, so measure the gain first.'}],
src:[['Client-side caching',K.D+'develop/clients/client-side-caching/']]};

/* ---------- 9 ---------- */
L['redis:15:9']={blocks:[
{p:'Redis can be the **primary database** for the right data. The decision rests on durability, size and query needs.'},
{h:'When it works well'},
{ul:['The working set fits in memory, or in memory plus tiered storage on an enterprise product.','Access is by key or by a few indexed fields.','Latency is the priority: sessions, carts, gaming state, feature stores, real-time scoring.','You accept the durability characteristics you configure.']},
{h:'Making it durable'},
{t:[['Concern','Setting or practice'],
['Restart safety','AOF everysec (or always), plus RDB'],
['Host loss','Replicas in other zones, off-host backups'],
['Failover safety','Sentinel or Cluster, WAIT for important writes, min-replicas'],
['Recovery','Tested restore and a documented runbook']]},
{h:'Modelling'},
{ul:['Design keys around the queries you will run. There are no joins.','Maintain secondary access paths yourself with sets or sorted sets, or use the Query Engine on JSON or hashes.','Keep each key a manageable size and split big collections.','Version your data format so it can evolve.']},
{h:'When to keep another system of record'},
{ul:['You need ad hoc queries, joins or reporting.','Data is far larger than affordable memory and mostly cold.','Any acknowledged write must never be lost.']},
{note:'A hybrid is common: a database as the source of truth, Redis for fast state and derived views. Redis then can be rebuilt, which simplifies operations.'}],
src:[['Redis as a primary database',K.D+'develop/']]};
})();
