/* LearnSphere - Redis, Section 03: Lists, Hashes and Sets.
   Lectures 0-5 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const list=K.dg(700,180,[
[10,10,680,160,'A list: LPUSH adds at the head, RPUSH at the tail',1],
[40,60,90,50,'head|"c"',0],[150,60,90,50,'"b"',0],[260,60,90,50,'"a"',0],[370,60,90,50,'tail|"z"',0],[530,45,140,36,'LPUSH / LPOP',2],[530,95,140,36,'RPUSH / RPOP',2]],
[[530,63,465,80],[530,113,465,95]]);

const queue=K.dg(700,180,[
[10,10,680,160,'A reliable queue with LMOVE',1],
[30,60,110,60,'Producer|LPUSH jobs',0],[200,60,120,60,'jobs|(list)',2],[390,60,130,60,'Worker|LMOVE to|processing',0],[580,60,100,60,'processing|(list)',2]],
[[140,90,200,90],[320,90,390,90],[520,90,580,90]]);

const hash=K.dg(700,170,[
[10,10,680,150,'A hash stores an object as field and value pairs',1],
[40,50,130,60,'user:1001|(key)',2],[240,45,180,30,'name = Ana',0],[240,80,180,30,'email = ana@x.io',0],[480,45,180,30,'plan = pro',0],[480,80,180,30,'logins = 17',0]],
[[170,80,240,60]]);

const algebra=K.dg(700,170,[
[10,10,680,150,'Set algebra',1],
[40,50,140,60,'tags:a|redis, cache, nosql',0],[220,50,140,60,'tags:b|redis, json, nosql',0],[420,40,240,36,'SINTER = redis, nosql',2],[420,82,240,36,'SUNION = redis, cache, nosql, json',2]],
[[180,80,420,58],[360,80,420,100]]);

/* ---------- 0 ---------- */
L['redis:2:0']={blocks:[
{p:'A **list** is an ordered sequence of strings, implemented as a linked structure of compact nodes. Adding or removing at either end is fast and does not depend on list length.'},
{svg:list},
{code:`RPUSH queue:email "job1" "job2" "job3"
LPUSH recent:views "post:9"
LRANGE recent:views 0 9
LLEN queue:email
LPOP queue:email
RPOP queue:email 2
LINDEX recent:views 0
LTRIM recent:views 0 99`},
{t:[['Operation','Complexity','Note'],
['LPUSH, RPUSH, LPOP, RPOP','O(1)','Per element'],
['LRANGE start stop','O(S + N)','Stop and start may be negative'],
['LINDEX, LSET, LINSERT','O(N)','Slow in the middle of a big list'],
['LTRIM','O(N) removed','Keep only a range']]},
{h:'Keeping a list bounded'},
{p:'A list that only grows becomes a memory problem. Combine a push with a trim to keep the latest N entries.'},
{code:`LPUSH recent:views "post:9"
LTRIM recent:views 0 99     # keep 100 newest`},
{note:'Indexes start at 0 from the head and at -1 from the tail. `LRANGE key 0 -1` returns everything, which is risky on a large list.'}],
src:[['Lists',K.DT+'lists/']]};

/* ---------- 1 ---------- */
L['redis:2:1']={blocks:[
{p:'Because pushes and pops are fast at both ends, a list is a natural **queue** (push left, pop right) or **stack** (push and pop on the same end).'},
{h:'Blocking pops'},
{p:'`BLPOP` and `BRPOP` wait until an element arrives or a timeout passes, so workers do not poll.'},
{code:`# worker
BRPOP jobs 30
# producer
LPUSH jobs "{\\"id\\":42}"`},
{h:'Reliable hand-off with LMOVE'},
{p:'A plain pop removes the job. If the worker dies, the job is lost. `LMOVE` (or `BLMOVE`) atomically moves the job to a processing list instead, so it can be recovered.'},
{svg:queue},
{code:`BLMOVE jobs processing RIGHT LEFT 30
# ... do the work ...
LREM processing 1 "{\\"id\\":42}"      # acknowledge`},
{h:'Limits'},
{ul:['No built-in acknowledgement, retry counts or delayed delivery. You must build them.','Several consumers share one list but cannot all see the same message.','For consumer groups, claiming and history, use **streams**, covered in a later section.']},
{note:'`RPOPLPUSH` and `BRPOPLPUSH` are deprecated forms of LMOVE and BLMOVE.'}],
src:[['BLMOVE',K.CMD+'blmove/'],['BLPOP',K.CMD+'blpop/']]};

/* ---------- 2 ---------- */
L['redis:2:2']={blocks:[
{p:'A **hash** maps field names to values under one key. It is the natural way to store an object: you can read or update a single field without touching the rest.'},
{svg:hash},
{code:`HSET user:1001 name "Ana" email "ana@x.io" plan "pro"
HGET user:1001 name
HMGET user:1001 name plan
HGETALL user:1001
HINCRBY user:1001 logins 1
HDEL user:1001 plan
HEXISTS user:1001 email
HLEN user:1001
HSCAN user:1001 0`},
{h:'String per object or hash'},
{t:[['','JSON string','Hash'],
['Read one field','Parse the whole value','HGET'],
['Update one field','Rewrite the whole value','HSET'],
['Nested data','Natural','Flat only'],
['Memory for small objects','Moderate','Often lower, compact encoding'],
['Atomic field counter','No','HINCRBY']]},
{h:'Notes'},
{ul:['Field values are strings. Numbers are stored as text and `HINCRBY` treats them as integers.','Small hashes use a compact **listpack** encoding. They convert to a hash table when they pass `hash-max-listpack-entries` or `hash-max-listpack-value`.','`HGETALL` on a big hash is O(N) and blocks. Prefer `HSCAN` or ask only for needed fields.','A TTL applies to the whole key, not a field. Field expiry is the next lesson.']},
{note:'`HMSET` is deprecated. `HSET` accepts several field and value pairs.'}],
src:[['Hashes',K.DT+'hashes/']]};

/* ---------- 3 ---------- */
L['redis:2:3']={blocks:[
{p:'Before Redis 7.4, only the whole key could expire. **Hash field expiration** lets individual fields have their own TTL, which suits sessions with several tokens, feature flags with leases or per-field caches in one object.'},
{code:`HSET session:af3 user "ana" csrf "x9y" otp "123456"
HEXPIRE session:af3 300 FIELDS 1 otp
HTTL session:af3 FIELDS 1 otp
HPERSIST session:af3 FIELDS 1 otp
HGETEX session:af3 EX 60 FIELDS 1 user     # read and refresh (8.0+)
HSETEX session:af3 EX 60 FIELDS 1 otp 654321`},
{t:[['Command','Purpose'],
['HEXPIRE, HPEXPIRE','Set TTL in seconds or milliseconds'],
['HEXPIREAT, HPEXPIREAT','Set an absolute expiry time'],
['HTTL, HPTTL, HEXPIRETIME','Read the remaining or absolute time'],
['HPERSIST','Remove a field TTL'],
['HGETEX, HSETEX','Read or write together with expiry (Redis 8.0+)'],
['HGETDEL','Read and delete fields (Redis 8.0+)']]},
{h:'When to use it'},
{ul:['Several short-lived values belong to one logical object.','You want one key to read, replicate and expire as a unit but fields to age out separately.']},
{note:'Fields expire lazily and through background work, like keys. Expired fields are removed from replicas and from the AOF through the primary. An empty hash with all fields expired is deleted. The exact commands depend on your Redis version, so check the release notes.'}],
src:[['HEXPIRE',K.CMD+'hexpire/'],['Hashes',K.DT+'hashes/']]};

/* ---------- 4 ---------- */
L['redis:2:4']={blocks:[
{p:'A **set** is an unordered collection of unique strings. Adding a member that already exists changes nothing. Membership tests, adds and removes are O(1).'},
{code:`SADD tags:post:7 "redis" "cache" "nosql"
SISMEMBER tags:post:7 "redis"
SMISMEMBER tags:post:7 "redis" "sql"
SMEMBERS tags:post:7
SCARD tags:post:7
SREM tags:post:7 "nosql"
SPOP tags:post:7
SRANDMEMBER tags:post:7 2`},
{h:'Typical uses'},
{ul:['Unique visitors, followers, tags and permissions.','Random sampling with `SRANDMEMBER` and `SPOP`.','Tracking processed identifiers.']},
{h:'Notes'},
{ul:['Sets of integers that fit in memory use the compact **intset** encoding, others a **listpack** or **hash table**.','`SMEMBERS` returns everything and blocks on big sets. Use `SSCAN`.','`SPOP` removes and returns random members, so it works as a draw without replacement.']},
{note:'A set stores only presence. To keep counts, use a sorted set or hash. For very large unique counts where an estimate is fine, HyperLogLog uses far less memory.'}],
src:[['Sets',K.DT+'sets/']]};

/* ---------- 5 ---------- */
L['redis:2:5']={blocks:[
{p:'Redis can combine sets on the server, which avoids pulling large sets into the application.'},
{svg:algebra},
{code:`SADD tags:a "redis" "cache" "nosql"
SADD tags:b "redis" "json" "nosql"
SINTER tags:a tags:b            # redis, nosql
SUNION tags:a tags:b
SDIFF  tags:a tags:b            # cache
SINTERCARD 2 tags:a tags:b      # count only
SINTERSTORE common tags:a tags:b`},
{t:[['Command','Result'],
['SINTER, SUNION, SDIFF','Return the combined members'],
['SINTERSTORE, SUNIONSTORE, SDIFFSTORE','Save the result in a key'],
['SINTERCARD','Count the intersection, optionally with LIMIT'],
['SMOVE','Move a member between sets atomically']]},
{h:'Example: mutual friends'},
{code:`SINTER friends:ana friends:ben`},
{note:'Cost grows with set sizes. Intersecting two huge sets can be slow and blocks other clients. Store results with an expiry when they are reused, and use `SINTERCARD ... LIMIT` when you only need to know whether the overlap is large.'}],
src:[['SINTER',K.CMD+'sinter/'],['Sets',K.DT+'sets/']]};
})();
