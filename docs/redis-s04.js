/* LearnSphere - Redis, Section 04: Sorted Sets and Specialized Types.
   Lectures 0-6 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const zset=K.dg(700,190,[
[10,10,680,170,'A sorted set orders members by score',1],
[40,55,100,60,'score 95|"ben"',0],[160,55,100,60,'score 120|"ana"',0],[280,55,100,60,'score 120|"cy"',0],[400,55,100,60,'score 210|"dee"',2],
[540,55,130,60,'rank 0 .. N-1|lowest first',0]],
[]);

const window_=K.dg(700,190,[
[10,10,680,170,'Sliding window with a sorted set (score = timestamp)',1],
[30,60,130,60,'ZREMRANGEBYSCORE|drop old entries',0],[210,60,130,60,'ZCARD|count in window',2],[390,60,130,60,'Under limit?|ZADD now',0],[570,60,100,60,'Allow or|reject',0]],
[[160,90,210,90],[340,90,390,90],[520,90,570,90]]);

const hll=K.dg(700,170,[
[10,10,680,150,'HyperLogLog: count distinct with a fixed small footprint',1],
[40,55,150,60,'PFADD visitors|user1 user2 user1',0],[260,55,150,60,'Up to 12 KB|per key',2],[480,55,180,60,'PFCOUNT visitors|about 2, error near 0.81 percent',0]],
[[190,85,260,85],[410,85,480,85]]);

const geo=K.dg(700,170,[
[10,10,680,150,'Geo data is stored in a sorted set',1],
[40,55,140,60,'GEOADD places|lon lat name',0],[250,55,140,60,'Sorted set|score = geohash',2],[460,55,200,60,'GEOSEARCH|within 5 km of a point',0]],
[[180,85,250,85],[390,85,460,85]]);

/* ---------- 0 ---------- */
L['redis:3:0']={blocks:[
{p:'A **sorted set** is a set of unique members where each member has a **score**, a floating point number. Members are kept ordered by score, and ties are ordered lexicographically. You get fast rank and range queries.'},
{svg:zset},
{code:`ZADD scores 120 "ana" 95 "ben" 210 "dee"
ZSCORE scores "ana"
ZRANK scores "ana"            # 1 (0 = lowest)
ZREVRANK scores "ana"
ZRANGE scores 0 2 WITHSCORES
ZRANGE scores 0 -1 REV LIMIT 0 3
ZRANGE scores 100 +inf BYSCORE
ZINCRBY scores 5 "ben"
ZCOUNT scores 100 200
ZREM scores "ben"`},
{t:[['Command','Purpose'],
['ZADD key [NX|XX] [GT|LT] [CH] score member','Add or update, with conditions'],
['ZRANGE ... BYSCORE|BYLEX|REV|LIMIT','One command for rank, score and lexical ranges'],
['ZRANK, ZREVRANK','Position of a member'],
['ZINCRBY','Add to a score'],
['ZPOPMIN, ZPOPMAX, BZPOPMIN','Remove and return extremes'],
['ZREMRANGEBYSCORE, ZREMRANGEBYRANK','Delete a range']]},
{h:'Complexity'},
{p:'Adding, updating and removing a member are O(log N). Reading a range is O(log N + M) for M members returned. A skip list plus a hash table gives both ordered access and O(1) score lookup, and small sorted sets use a compact listpack.'},
{note:'Scores are 64-bit doubles. Integers above 2^53 lose precision. If you need exact large numbers as ordering keys, store them in the member or use a different scheme.'}],
src:[['Sorted sets',K.DT+'sorted-sets/'],['ZADD',K.CMD+'zadd/']]};

/* ---------- 1 ---------- */
L['redis:3:1']={blocks:[
{p:'Many problems reduce to "keep things ordered by a number". The number can be a game score, a timestamp, a priority or a due time.'},
{h:'Leaderboard'},
{code:`ZINCRBY lb:daily 15 "ana"
ZREVRANGE lb:daily 0 9 WITHSCORES      # top 10 (or ZRANGE ... REV)
ZREVRANK lb:daily "ana"                # position, 0 is first`},
{h:'Sliding window rate limiter'},
{svg:window_},
{code:`ZREMRANGEBYSCORE rl:user:42 0 <now-60s>
ZCARD rl:user:42
ZADD rl:user:42 <now> <unique-id>
EXPIRE rl:user:42 60`},
{h:'Scheduled or delayed jobs'},
{p:'Use the due time as the score. A worker reads `ZRANGE queue 0 <now> BYSCORE LIMIT 0 10`, claims jobs and removes them. Do the claim in a script or `ZPOPMIN` carefully so two workers do not take the same job.'},
{h:'Priority queue'},
{code:`ZADD jobs 1 "urgent-1" 5 "normal-9"
BZPOPMIN jobs 30`},
{note:'Windows hold one entry per event, so memory grows with traffic. Cap with the limit itself, and always set a TTL. A simple counter per window is cheaper if you do not need exact sliding behaviour.'}],
src:[['Sorted set patterns',K.DT+'sorted-sets/']]};

/* ---------- 2 ---------- */
L['redis:3:2']={blocks:[
{p:'Sorted sets can be combined, and ranges can use the member name when scores are equal.'},
{h:'Combining sorted sets'},
{code:`ZADD w1 10 "a" 20 "b"
ZADD w2 5 "b" 7 "c"
ZUNIONSTORE total 2 w1 w2 WEIGHTS 1 2 AGGREGATE SUM
ZINTERSTORE both 2 w1 w2 AGGREGATE MAX
ZUNION 2 w1 w2 WITHSCORES
ZDIFF 2 w1 w2`},
{t:[['Option','Meaning'],
['WEIGHTS','Multiply each input score before combining'],
['AGGREGATE SUM|MIN|MAX','How to merge scores of the same member'],
['STORE variants','Write the result to a key'],
['Plain ZUNION, ZINTER, ZDIFF','Return the result (Redis 6.2+)']]},
{h:'Lexicographic ranges'},
{p:'When every member has the **same score** (usually 0), the set is ordered by the member string. You can then ask for ranges by name. This enables sorted indexes and prefix lookups.'},
{code:`ZADD ac 0 "redis" 0 "redisson" 0 "react" 0 "ruby"
ZRANGE ac "[re" "[re\\xff" BYLEX     # members starting with re
ZLEXCOUNT ac "[re" "(rf"`},
{note:'`[` includes a bound and `(` excludes it. `-` and `+` mean unbounded. Lexical commands give undefined results if scores differ.'}],
src:[['ZUNIONSTORE',K.CMD+'zunionstore/'],['ZRANGE',K.CMD+'zrange/']]};

/* ---------- 3 ---------- */
L['redis:3:3']={blocks:[
{p:'**Bitmaps** are not a separate type. They are bit-level commands on a string. Each bit is addressed by an offset. They suit large sets of yes or no flags indexed by a number.'},
{code:`SETBIT active:2026-10-15 1001 1
GETBIT active:2026-10-15 1001
BITCOUNT active:2026-10-15
BITOP AND active:both active:2026-10-14 active:2026-10-15
BITPOS active:2026-10-15 1`},
{t:[['Command','Purpose'],
['SETBIT, GETBIT','Set and read one bit'],
['BITCOUNT [start end [BYTE|BIT]]','Count set bits'],
['BITPOS','Find the first 0 or 1'],
['BITOP AND|OR|XOR|NOT','Combine bitmaps into a new key'],
['BITFIELD','Read and write several small integers inside a string']]},
{h:'Example: daily active users'},
{p:'If user ids are small dense integers, a bitmap per day costs about one bit per possible user: 1 million users is roughly 125 KB per day. `BITOP AND` across days gives users active on all of them.'},
{h:'Beware sparse offsets'},
{p:'Setting bit 4 billion allocates a string of 512 MB. Bitmaps are efficient only when ids are dense and bounded. Otherwise use a set or HyperLogLog.'},
{h:'BITFIELD'},
{code:`BITFIELD counters SET u8 0 200 INCRBY u8 0 100 OVERFLOW SAT GET u8 0`},
{note:'`OVERFLOW` controls what happens when an integer would wrap: `WRAP`, `SAT` (saturate) or `FAIL`.'}],
src:[['Bitmaps',K.DT+'bitmaps/'],['Bitfields',K.DT+'bitfields/']]};

/* ---------- 4 ---------- */
L['redis:3:4']={blocks:[
{p:'**HyperLogLog (HLL)** estimates the number of **distinct** elements using a small, fixed amount of memory. It never stores the elements, so you cannot list them or test membership.'},
{svg:hll},
{code:`PFADD visitors:2026-10-15 "u1" "u2" "u1"
PFCOUNT visitors:2026-10-15
PFCOUNT visitors:2026-10-14 visitors:2026-10-15
PFMERGE visitors:week visitors:2026-10-14 visitors:2026-10-15`},
{t:[['Property','Value'],
['Memory per key','At most about 12 KB, much less while small'],
['Standard error','About 0.81 percent'],
['Add or count','O(1)'],
['Elements retrievable?','No'],
['Union','PFMERGE, or PFCOUNT over several keys']]},
{h:'Set or HyperLogLog'},
{ul:['Need the exact number or the members: use a set.','Billions of distinct items per day where about 1 percent error is fine: use HLL.','HLL values are stored as strings, so `TYPE` shows `string`.']},
{note:'Error is relative. For a count of 1,000,000 the answer is typically within about 8,000 of the truth.'}],
src:[['HyperLogLog',K.DT+'probabilistic/hyperloglogs/']]};

/* ---------- 5 ---------- */
L['redis:3:5']={blocks:[
{p:'**Geospatial** commands store longitude and latitude pairs and search them by distance. Internally a location is a 52 bit geohash used as the **score** of a sorted set, so geo keys are sorted sets and all `Z*` commands work.'},
{svg:geo},
{code:`GEOADD stores 13.361389 38.115556 "palermo" 15.087269 37.502669 "catania"
GEODIST stores "palermo" "catania" km
GEOPOS stores "palermo"
GEOSEARCH stores FROMLONLAT 15 37 BYRADIUS 200 km ASC WITHDIST COUNT 5
GEOSEARCH stores FROMMEMBER "palermo" BYBOX 300 300 km
GEOSEARCHSTORE near stores FROMMEMBER "palermo" BYRADIUS 100 km`},
{t:[['Command','Purpose'],
['GEOADD','Add members with coordinates'],
['GEOSEARCH, GEOSEARCHSTORE','Search by radius or box'],
['GEODIST','Distance between two members'],
['GEOPOS, GEOHASH','Coordinates or geohash string'],
['ZREM','Remove a member (there is no GEODEL)']]},
{h:'Limits'},
{ul:['Valid latitudes are about -85.05 to 85.05 degrees.','Precision is a few centimetres to a metre.','`GEORADIUS` and `GEORADIUSBYMEMBER` are deprecated in favour of `GEOSEARCH`.','One key holds all points. In a cluster, shard by region or tile to avoid one huge hot key.']}],
src:[['Geospatial',K.DT+'geospatial/'],['GEOSEARCH',K.CMD+'geosearch/']]};

/* ---------- 6 ---------- */
L['redis:3:6']={blocks:[
{p:'Choosing the type is the most important modelling decision. Start from the **question you will ask**, not from the shape of the data.'},
{t:[['You need to...','Use','Why'],
['Store a value or a blob, a counter','String','Simple, atomic counters'],
['Store an object with several fields','Hash','Partial read and write'],
['Keep a short ordered log, a simple queue','List','Fast ends, blocking pops'],
['Ensure uniqueness, tags, relations','Set','O(1) membership, set algebra'],
['Rank, order by number, ranges by score','Sorted set','Rank and range in O(log N)'],
['Flags for dense integer ids','Bitmap','One bit per id'],
['Approximate distinct count','HyperLogLog','12 KB cap'],
['Find places near a point','Geo (sorted set)','Radius and box search'],
['Durable log with consumer groups','Stream','Acknowledgement and replay'],
['Document with nested fields and queries','JSON with Query Engine','Path updates and indexes']]},
{h:'The cost of choosing wrong'},
{ul:['A JSON string for a frequently updated object: every small change rewrites and replicates the whole value.','A list for membership checks: O(N) instead of O(1) with a set.','One huge hash or sorted set for everything: a single big key that is slow to delete, scan and migrate.','A set of objects when an ordering is needed later: you end up sorting in the client.']},
{note:'Split large collections into several keys by a natural bucket (day, region, hash of the id). Smaller keys are easier to expire, move and shard.'}],
src:[['Choosing a data type',K.DT]]};
})();
