/* LearnSphere - Redis, Section 02: Keys, Strings and the Keyspace.
   Lectures 0-6 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const keyspace=K.dg(700,200,[
[10,10,680,180,'One logical database (db 0)',1],
[30,60,120,60,'user:1001|(hash)',0],[170,60,120,60,'session:af3|(string)',0],[310,60,120,60,'feed:1001|(list)',0],[450,60,100,60,'top:scores|(sorted set)',0],[570,60,100,60,'orders|(stream)',0]],
[]);

const expire=K.dg(700,210,[
[10,10,680,190,'How a key with a TTL disappears',1],
[30,60,150,60,'Client reads the key|(passive)',0],[250,60,170,60,'Background sampling|about 10 times per second|(active)',2],[490,60,170,60,'Key removed and|DEL sent to replicas',0],
[30,140,150,36,'Expired: delete, nil',0]],
[[180,90,250,90],[420,90,490,90],[105,120,105,140]]);

const scan=K.dg(700,170,[
[10,10,680,150,'SCAN walks the keyspace in small steps',1],
[30,55,120,50,'SCAN 0|COUNT 100',0],[200,55,150,50,'cursor 4096 and|a batch of keys',2],[400,55,120,50,'SCAN 4096|COUNT 100',0],[570,55,100,50,'cursor 0|= finished',0]],
[[150,80,200,80],[350,80,400,80],[520,80,570,80]]);

/* ---------- 0 ---------- */
L['redis:1:0']={blocks:[
{p:'A Redis **keyspace** is the set of all keys in one logical database. A key is a binary-safe string, and every key maps to one value of a specific type. Good key design matters because the key is the only thing you can look up directly.'},
{svg:keyspace},
{h:'Key naming'},
{p:'Use a consistent convention, usually colon separated, with the entity first and the identifier next. Keep names short enough to save memory, but readable enough to debug.'},
{t:[['Pattern','Example','Notes'],
['entity:id','user:1001','The object itself'],
['entity:id:field','user:1001:cart','A related value'],
['app:env:entity:id','shop:prod:user:1001','Several apps in one instance'],
['entity:{id}:field','cart:{1001}:items','Hash tag for Cluster, see the Cluster section']]},
{h:'Limits and cautions'},
{ul:['A key can be up to 512 MB, but keep keys to tens of bytes. Long keys cost memory and slow comparison.','A keyspace has no folders. The colon is only a convention; there is no way to list keys under a prefix other than scanning.','Do not build keys from unbounded user input without length checks.']},
{h:'Logical databases'},
{p:'A standalone server has 16 numbered databases by default (`databases 16`), chosen with `SELECT n`. They share memory, CPU and persistence and are not an isolation boundary. Redis Cluster supports only database 0. For separation, use separate instances or key prefixes with ACLs.'},
{code:`SELECT 1
DBSIZE
SWAPDB 0 1
FLUSHDB ASYNC`}],
src:[['Keys and the keyspace',K.D+'develop/use/keyspace/'],['SELECT',K.CMD+'select/']]};

/* ---------- 1 ---------- */
L['redis:1:1']={blocks:[
{p:'The **string** is the simplest type and the base for many others. It holds bytes: text, numbers, serialized objects, an image fragment. It is binary safe and up to 512 MB.'},
{h:'Basic commands'},
{code:`SET page:home "<html>..."
GET page:home
APPEND log:today "line one\\n"
STRLEN page:home
GETRANGE page:home 0 5
SETRANGE page:home 0 "<HTML"
GETDEL token:abc
MSET a 1 b 2 c 3
MGET a b c`},
{h:'SET options'},
{t:[['Option','Effect'],
['EX seconds, PX ms','Set a time to live'],
['EXAT, PXAT','Expire at a Unix timestamp'],
['NX','Set only if the key does not exist'],
['XX','Set only if the key already exists'],
['GET','Return the old value'],
['KEEPTTL','Keep the existing time to live']]},
{code:`SET lock:report 1 NX EX 30      # simple lock, see Patterns section
SET cfg:mode "fast" GET         # replace and read old value`},
{note:'`SETNX`, `SETEX` and `PSETEX` still work but are superseded by SET with options. Prefer the single command so the value and TTL are set together atomically.'},
{h:'Choosing how to store an object'},
{ul:['One string per object (a JSON blob): simple, but an update rewrites the whole value.','A hash per object: partial reads and writes, covered in the next section.','The JSON type from Redis 8: path based updates, see the extended types section.']}],
src:[['Strings',K.DT+'strings/'],['SET',K.CMD+'set/']]};

/* ---------- 2 ---------- */
L['redis:1:2']={blocks:[
{p:'If the value of a string looks like an integer, Redis can increment it **atomically**. Because commands run one at a time, many clients can increment the same counter safely with no locking.'},
{code:`SET views:post:7 0
INCR views:post:7            # 1
INCRBY views:post:7 10       # 11
DECR views:post:7            # 10
INCRBYFLOAT price:item:5 0.25`},
{t:[['Command','Behaviour'],
['INCR, DECR','Add or subtract 1'],
['INCRBY, DECRBY','Add or subtract an integer'],
['INCRBYFLOAT','Add a floating point number'],
['Missing key','Treated as 0, so the result is 1 after INCR'],
['Non-numeric value','Returns an error']]},
{p:'Counters are 64-bit signed integers. An increment that would overflow returns an error.'},
{h:'Counting with expiry'},
{p:'A frequent pattern is a counter per time window. Use INCR and set an expiry the first time.'},
{code:`INCR  rate:user:42:202610151230
EXPIRE rate:user:42:202610151230 60 NX`},
{note:'`EXPIRE ... NX` sets the TTL only if the key has none. Both commands can be sent in a transaction or a script to make the pair atomic. Rate limiting patterns appear in the last section.'},
{h:'Why this matters'},
{p:'A read, add and write cycle in application code can lose updates when two clients race. One INCR cannot.'}],
src:[['INCR',K.CMD+'incr/'],['Atomic counters',K.DT+'strings/']]};

/* ---------- 3 ---------- */
L['redis:1:3']={blocks:[
{p:'A key can have a **time to live (TTL)**. When it elapses, Redis removes the key. Expiry is the core of caching, sessions and short-lived counters.'},
{h:'Setting and reading'},
{code:`EXPIRE session:af3 1800
PEXPIRE session:af3 1800000
EXPIREAT session:af3 1790000000
TTL session:af3         # seconds left, -1 no TTL, -2 no key
PTTL session:af3
EXPIRETIME session:af3
PERSIST session:af3     # remove the TTL`},
{t:[['Command','Note'],
['EXPIRE key s NX|XX|GT|LT','Options set only if there is no TTL, there is a TTL, greater or less than the current'],
['SET key v EX s','Value and TTL together'],
['TTL returns -1','Key exists, no expiry'],
['TTL returns -2','Key does not exist']]},
{h:'What clears a TTL'},
{ul:['`SET` without `KEEPTTL` removes the TTL.','`DEL`, `RENAME` and most overwrites clear or move it.','Modifying a value with `INCR`, `LPUSH` or `HSET` keeps the TTL.']},
{h:'How expiry actually works'},
{svg:expire},
{ul:['**Passive**: an expired key is removed when a client touches it.','**Active**: ten times a second Redis samples keys with TTLs and removes expired ones, repeating when many are expired.','**Replicas** do not expire keys on their own. The primary sends a `DEL`.']},
{note:'Millions of keys expiring at the same second creates a latency spike. Add a small random jitter to TTLs for keys written together.'}],
src:[['EXPIRE',K.CMD+'expire/'],['Keys expiration',K.D+'develop/use/keyspace/#key-expiration']]};

/* ---------- 4 ---------- */
L['redis:1:4']={blocks:[
{p:'`KEYS pattern` scans the entire keyspace in one call and **blocks the server** until it finishes. On a large dataset that can mean seconds of lost availability. `SCAN` returns the same information in small batches.'},
{svg:scan},
{code:`SCAN 0 MATCH user:* COUNT 100
SCAN 17 MATCH user:* COUNT 100 TYPE hash
# repeat with the returned cursor until it is 0

SSCAN myset 0 MATCH a* COUNT 50
HSCAN user:1 0
ZSCAN scores 0`},
{h:'Guarantees'},
{t:[['Property','Meaning'],
['Completeness','Elements present for the whole iteration are returned'],
['Duplicates','An element can be returned more than once. Deduplicate in the client'],
['Changes during the scan','Added or removed elements may or may not appear'],
['COUNT','A hint of work per call, not a limit on results'],
['Empty batches','Possible. Only a returned cursor of 0 means finished']]},
{h:'Practical use'},
{ul:['Use `redis-cli --scan --pattern "user:*"` for ad hoc work.','MATCH filters after the batch is read, so a rare pattern can need many calls.','To delete matching keys, scan and `UNLINK` in batches, never `KEYS` piped to `DEL`.']},
{note:'On a Cluster, SCAN runs against one node. Iterate every primary to cover the whole keyspace.'}],
src:[['SCAN',K.CMD+'scan/']]};

/* ---------- 5 ---------- */
L['redis:1:5']={blocks:[
{p:'A handful of commands work on **any** key regardless of type.'},
{t:[['Command','Purpose'],
['EXISTS key ...','Count how many of the keys exist'],
['TYPE key','string, list, set, zset, hash, stream, ReJSON-RL and so on'],
['DEL key ...','Remove keys, freeing memory in the main thread'],
['UNLINK key ...','Remove keys, freeing memory in a background thread'],
['RENAME, RENAMENX','Rename, overwriting or only if the new name is free'],
['COPY src dst [REPLACE]','Copy a value, optionally to another database'],
['RANDOMKEY, DBSIZE','A random key, number of keys'],
['TOUCH','Update last access time'],
['OBJECT ENCODING|IDLETIME|FREQ|REFCOUNT','Internal details of a value']]},
{h:'DEL versus UNLINK'},
{p:'Deleting a key with millions of elements takes time because the memory must be released. `DEL` does the work on the main thread and can stall clients. `UNLINK` removes the key from the keyspace immediately and frees the memory in the background. Prefer `UNLINK` for large values.'},
{code:`UNLINK big:list
OBJECT ENCODING user:1       # listpack, hashtable, ...
TYPE user:1
COPY user:1 user:1:backup
RENAME tmp:build prod:build`},
{note:'`RENAME` overwrites the destination and, when the destination is a large key, pays the cost of freeing it. In Cluster, both keys must be in the same slot.'}],
src:[['UNLINK',K.CMD+'unlink/'],['OBJECT ENCODING',K.CMD+'object-encoding/']]};

/* ---------- 6 ---------- */
L['redis:1:6']={blocks:[
{p:'Replies have **types**. The protocol version decides how rich those types are. **RESP2** is the default, and **RESP3** adds explicit types and out-of-band push messages.'},
{h:'Reply types'},
{t:[['Type','Example','Meaning'],
['Simple string','+OK','Short status'],
['Error','-ERR unknown command','A failed command'],
['Integer','(integer) 12','Counts, flags'],
['Bulk string','"hello"','Binary safe text'],
['Array','1) "a" 2) "b"','A list of values'],
['Null','(nil)','No value']]},
{h:'What RESP3 adds'},
{ul:['Maps, sets, doubles, booleans and big numbers as distinct types.','Verbatim strings that carry a format hint.','**Push** messages, used by client-side caching and Pub/Sub on the same connection.','Clients can use richer return values without guessing from array shapes.']},
{h:'Switching protocol'},
{code:`HELLO 3
HELLO 3 AUTH app secret SETNAME billing-api`},
{p:'`HELLO` negotiates the version, can authenticate and names the connection. Most client libraries select a version for you, so this matters when you read raw output or write a client.'},
{note:'A client that asks for RESP3 receives different shapes for some commands (for example `HGETALL` as a map). Libraries hide the difference. Check the library notes before enabling RESP3 on an existing application.'}],
src:[['RESP3 specification',K.D+'develop/reference/protocol-spec/'],['HELLO',K.CMD+'hello/']]};
})();
