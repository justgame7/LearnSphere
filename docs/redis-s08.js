/* LearnSphere - Redis, Section 08: Memory Management and Eviction.
   Lectures 0-6 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const mem=K.dg(700,220,[
[10,10,680,200,'Where memory goes',1],
[30,55,200,50,'Dataset|keys and values',2],[260,55,200,50,'Overhead|per key, dict, metadata',0],[490,55,180,50,'Buffers|clients, replication, AOF',0],
[30,135,200,50,'Fragmentation|allocator gaps',0],[260,135,200,50,'Fork copy-on-write|during RDB and rewrite',0],[490,135,180,50,'Lua and functions,|pubsub, modules',0]],
[]);

const enc=K.dg(700,190,[
[10,10,680,170,'Small collections use a compact encoding',1],
[30,60,170,60,'Small|listpack or intset',2],[260,60,170,60,'Grows past a|threshold',0],[490,60,170,60,'Hash table,|skip list or quicklist',0]],
[[200,90,260,90],[430,90,490,90]]);

const evict=K.dg(700,220,[
[10,10,680,200,'When used memory reaches maxmemory',1],
[30,80,130,60,'Write command|arrives',0],[210,80,140,60,'Over limit?',0],[400,40,170,50,'No: run the command',0],[400,130,170,50,'Policy: evict keys until|under limit, or return OOM',2]],
[[160,110,210,110],[350,95,400,65],[350,125,400,155]]);

/* ---------- 0 ---------- */
L['redis:7:0']={blocks:[
{p:'Redis stores everything in RAM, so memory is the main resource to plan and monitor. The dataset is only part of the footprint.'},
{svg:mem},
{h:'Key numbers in INFO memory'},
{t:[['Field','Meaning'],
['used_memory','Bytes the allocator has handed to Redis. Compare with maxmemory'],
['used_memory_rss','Bytes the operating system says the process occupies'],
['mem_fragmentation_ratio','rss divided by used_memory'],
['used_memory_peak','Highest value seen'],
['used_memory_overhead','Non-data structures: buffers, dictionaries'],
['used_memory_dataset','The data itself']]},
{h:'Rules of thumb'},
{ul:['Every key has overhead, often 50 to 100 bytes or more. Millions of tiny keys cost more than their content.','A fork for RDB or AOF rewrite shares memory copy-on-write. Under heavy writes, memory can grow by up to the size of the dataset.','A ratio above about 1.5 suggests fragmentation. A ratio below 1 means the process is swapping, which is serious.']},
{note:'`used_memory` can be far lower than the host total. Reserve headroom for the OS, buffers and the fork, rather than setting `maxmemory` to all of RAM.'}],
src:[['Memory optimization',K.MGT+'optimization/memory-optimization/'],['INFO',K.CMD+'info/']]};

/* ---------- 1 ---------- */
L['redis:7:1']={blocks:[
{p:'Redis picks an **internal encoding** for each value. Small values use compact encodings that save a lot of memory. When a collection grows, Redis converts it to a faster general structure.'},
{svg:enc},
{t:[['Type','Compact encoding','General encoding','Threshold settings'],
['String','int, embstr (up to 44 bytes)','raw','-'],
['List','listpack (small)','quicklist (linked listpacks)','list-max-listpack-size'],
['Hash','listpack','hashtable','hash-max-listpack-entries, hash-max-listpack-value'],
['Set','intset (integers) or listpack','hashtable','set-max-intset-entries, set-max-listpack-entries'],
['Sorted set','listpack','skiplist plus hashtable','zset-max-listpack-entries, zset-max-listpack-value'],
['Stream','Radix tree of listpacks','-','stream-node-max-bytes, stream-node-max-entries']]},
{code:`OBJECT ENCODING user:1       # listpack
CONFIG GET hash-max-listpack-*`},
{h:'Practical effect'},
{ul:['Many small hashes use far less memory than the same data as many string keys.','Raising the thresholds saves memory but makes operations on larger listpacks slower, because they are scanned linearly.','The conversion to a general encoding is one way: shrinking a collection does not convert it back.']},
{note:'Older versions used ziplist. The setting names `hash-max-ziplist-*` still work as aliases of the listpack ones.'}],
src:[['Memory optimization',K.MGT+'optimization/memory-optimization/']]};

/* ---------- 2 ---------- */
L['redis:7:2']={blocks:[
{p:'Before you tune, measure. Redis offers commands to see memory use at the server and key level.'},
{code:`INFO memory
MEMORY STATS
MEMORY DOCTOR
MEMORY USAGE user:1 SAMPLES 0
MEMORY MALLOC-STATS
MEMORY PURGE
redis-cli --bigkeys
redis-cli --memkeys`},
{t:[['Command','Use'],
['INFO memory','Headline numbers'],
['MEMORY STATS','Detailed breakdown: dataset, overhead, per database'],
['MEMORY USAGE key [SAMPLES n]','Bytes for one key. SAMPLES 0 inspects all elements'],
['MEMORY DOCTOR','Human readable hints'],
['MEMORY PURGE','Ask the allocator to return memory to the OS (jemalloc)'],
['--bigkeys, --memkeys','Sample the keyspace for the largest keys']]},
{h:'Sizing a dataset'},
{flow:['Load a representative sample (for example one percent) into a test instance','Compare used_memory before and after, and divide by the number of keys','Check MEMORY USAGE on typical and largest keys','Project to full size and add headroom for buffers and fork']},
{note:'`MEMORY USAGE` with default sampling estimates big collections. Use `SAMPLES 0` for an exact figure on one key, at the cost of scanning it.'}],
src:[['MEMORY USAGE',K.CMD+'memory-usage/'],['MEMORY STATS',K.CMD+'memory-stats/']]};

/* ---------- 3 ---------- */
L['redis:7:3']={blocks:[
{p:'`maxmemory` sets a limit on dataset memory. When reached, the **eviction policy** decides what happens on the next write that needs memory.'},
{svg:evict},
{code:`CONFIG SET maxmemory 4gb
CONFIG SET maxmemory-policy allkeys-lru
CONFIG SET maxmemory-samples 10`},
{t:[['Policy','Evicts','Use when'],
['noeviction (default)','Nothing. Writes fail with OOM, reads continue','Redis is a database, data must not vanish'],
['allkeys-lru','Least recently used among all keys','General cache'],
['allkeys-lfu','Least frequently used among all keys','Cache with stable popular keys'],
['allkeys-random','Random keys','Uniform access'],
['volatile-lru, volatile-lfu','As above, only keys with a TTL','Mixed cache and permanent data'],
['volatile-random','Random keys with a TTL','Rare'],
['volatile-ttl','Keys closest to expiry','Short-lived data first']]},
{h:'Notes'},
{ul:['LRU and LFU are **approximate**: Redis samples keys (`maxmemory-samples`, default 5) instead of tracking exact order.','A `volatile-*` policy with no keys that have a TTL behaves like `noeviction`.','Replica and client output buffers are not counted toward the eviction limit, so leave headroom.','Evicting can cost time. A heavy write burst with a tight limit raises latency.']},
{note:'Choose the policy from the role of the instance. A cache uses an `allkeys-*` policy. A database that also holds some cache keys uses `volatile-*` with TTLs on cache keys only.'}],
src:[['Eviction',K.D+'develop/reference/eviction/']]};

/* ---------- 4 ---------- */
L['redis:7:4']={blocks:[
{p:'Deleting a large key frees many allocations. Doing this on the main thread can stall every client. **Lazy freeing** moves that work to a background thread.'},
{h:'Explicit and automatic'},
{t:[['Mechanism','Effect'],
['UNLINK, FLUSHALL ASYNC, FLUSHDB ASYNC','Free in the background when you ask'],
['lazyfree-lazy-eviction','Free evicted keys in the background'],
['lazyfree-lazy-expire','Free expired keys in the background'],
['lazyfree-lazy-server-del','Free keys replaced by RENAME, SET and similar'],
['lazyfree-lazy-user-del','Make DEL behave as UNLINK'],
['replica-lazy-flush','Flush the replica dataset in the background before a full sync']]},
{code:`CONFIG SET lazyfree-lazy-eviction yes
CONFIG SET lazyfree-lazy-expire yes
CONFIG SET lazyfree-lazy-server-del yes
CONFIG SET lazyfree-lazy-user-del yes`},
{h:'Active defragmentation'},
{p:'After many writes and deletes, free memory is scattered. The allocator may not give it back. **Active defragmentation** moves values into compact space while Redis runs, so memory can be returned. It needs a jemalloc build, which is the default on Linux.'},
{code:`CONFIG SET activedefrag yes
CONFIG SET active-defrag-ignore-bytes 100mb
CONFIG SET active-defrag-threshold-lower 10
CONFIG SET active-defrag-cycle-max 25`},
{note:'Defrag uses CPU. The thresholds start work only when fragmentation is above a size and percentage. Check defaults for your version, as the lazy free settings changed defaults in some releases and forks.'}],
src:[['Lazy freeing',K.CMD+'unlink/'],['Memory optimization',K.MGT+'optimization/memory-optimization/']]};

/* ---------- 5 ---------- */
L['redis:7:5']={blocks:[
{p:'A **big key** is a key with a very large value or collection. A **hot key** is one that receives a disproportionate share of requests. Both break the assumption that load is spread evenly.'},
{h:'Why big keys hurt'},
{ul:['Deleting, expiring or loading them stalls the main thread.','Transferring them through replication or migration is slow and spikes buffers.','In Cluster they unbalance one shard.','Commands like `HGETALL` or `SMEMBERS` return huge replies.']},
{h:'Finding them'},
{code:`redis-cli --bigkeys
redis-cli --memkeys
MEMORY USAGE key SAMPLES 0
OBJECT FREQ key          # needs an LFU policy
redis-cli --hotkeys      # needs maxmemory-policy allkeys-lfu or volatile-lfu`},
{h:'Fixing them'},
{t:[['Problem','Remedy'],
['One huge hash, list or set','Split by bucket: user:{id}:{n} with n from a hash of the field'],
['Unbounded growth','Trim, expire or cap with MAXLEN, LTRIM, ZREMRANGEBYRANK'],
['Slow delete','UNLINK, or delete elements in batches with SCAN family commands'],
['Hot key reads','Local in-process cache, client-side caching, replicas, key replication under several names'],
['Hot key writes','Shard the counter across several keys and sum on read']]},
{note:'Keep individual collections to a few thousand elements where you can. There is no hard limit, but operations on collections of millions are the common cause of latency incidents.'}],
src:[['redis-cli key statistics',K.D+'develop/tools/cli/#get-a-list-of-keys']]};

/* ---------- 6 ---------- */
L['redis:7:6']={blocks:[
{p:'Capacity planning is mostly about leaving room. A host that looks 90 percent full will fail during a fork or a traffic spike.'},
{h:'Fragmentation'},
{t:[['mem_fragmentation_ratio','Reading','Action'],
['Below 1.0','Redis uses swap or memory is compressed','Urgent: add RAM, stop swapping'],
['1.0 to 1.5','Healthy','None'],
['Above 1.5','Fragmentation','Enable active defrag or restart in a controlled way']]},
{h:'Overcommit and the fork'},
{p:'The fork used for RDB and AOF rewrite needs the kernel to allow a large virtual allocation. Set `vm.overcommit_memory = 1`. Without it a fork can fail even when physical memory is available.'},
{code:`sysctl vm.overcommit_memory=1
echo never > /sys/kernel/mm/transparent_hugepage/enabled`},
{h:'A sizing recipe'},
{flow:['Estimate dataset size from a sample load','Add 20 to 30 percent for overhead and growth','Add headroom for copy-on-write during a snapshot, up to the dataset size for write-heavy workloads','Add buffers for replicas and clients','Set maxmemory below host RAM with a margin for the OS']},
{note:'Disable transparent huge pages. With THP a fork copies two megabyte pages for a single small write, which inflates memory and latency.'}],
src:[['Admin',K.MGT+'admin/'],['Memory optimization',K.MGT+'optimization/memory-optimization/']]};
})();
