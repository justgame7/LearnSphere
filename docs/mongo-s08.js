/* LearnSphere - MongoDB, Section 08: Query Performance & Tuning.
   Lectures 0-5 are core, 6-7 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const loop=M.dg(700,150,[
[10,10,680,130,'The tuning loop',1],
[30,55,120,55,'Measure|baseline',2],[180,55,120,55,'Find|slow queries',0],[330,55,120,55,'Diagnose|explain',0],[480,55,90,55,'Fix|index, query,|schema',0],[590,55,80,55,'Re-measure',2]],
[[150,82,180,82],[300,82,330,82],[450,82,480,82],[570,82,590,82]]);

const plan=M.dg(700,150,[
[10,10,680,130,'A healthy plan, read from the bottom up',1],
[30,55,150,55,'IXSCAN|index keys read',2],[210,55,150,55,'FETCH|documents read',0],[390,55,130,55,'PROJECTION|fields shaped',0],[550,55,120,55,'Result|nReturned',0]],
[[180,82,210,82],[360,82,390,82],[520,82,550,82]]);

const prof=M.dg(700,140,[
[10,10,680,120,'Where slow operations are recorded',1],
[30,55,190,55,'mongod log|always, above slowms',2],[255,55,190,55,'system.profile|when profiler is on',0],[480,55,190,55,'Atlas Query Profiler|and Performance Advisor',0]],
[]);

const pool=M.dg(700,140,[
[10,10,680,120,'Connections are a shared resource',1],
[30,55,150,55,'Many app|instances',0],[220,55,150,55,'Pool per client|maxPoolSize',2],[410,55,130,55,'Server limit|and memory',0],[570,55,100,55,'Queue and|timeouts',0]],
[[180,82,220,82],[370,82,410,82],[540,82,570,82]]);

/* ---------- 0: workflow ---------- */
L['mongo:7:0']={blocks:[
{p:'Tuning by guessing wastes time. A repeatable method finds the real bottleneck and proves that a change helped.'},
{svg:loop},
{h:'Step by step'},
{t:[['Step','Question','Tools'],
['**Measure**','What is normal? What is slow right now?','serverStatus, Atlas metrics, mongostat'],
['**Find**','Which operations are slow or most frequent?','Slow query log, profiler, currentOp'],
['**Diagnose**','Why is it slow?','explain("executionStats")'],
['**Fix**','Index, rewrite the query, or change the schema','createIndex, query changes, modeling'],
['**Re-measure**','Did it really improve, without side effects?','Same tools, same workload']]},
{h:'Where the time usually goes'},
{ul:['**Missing or wrong index**: a collection scan or a large in-memory sort.','**Too much data returned**: no projection, no limit.','**Schema shape**: many queries or joins for one page.','**Resources**: working set larger than RAM, slow disk, saturated CPU.','**Application behaviour**: connection storms, N+1 query patterns.']},
{h:'Rules'},
{ul:['Change **one thing at a time** and measure again.','Tune the queries that cost the most in total: frequency times duration.','Test on data of **realistic size**; a small dataset hides missing indexes.','Write down what you changed and why.']},
{note:'The fastest query is the one you do not run. Caching, fewer round trips and better data shape often beat micro-optimizing a query.'}],
src:[['Optimize query performance',MAN+'core/query-optimization/'],['Analyze query performance',MAN+'tutorial/analyze-query-plan/']]};

/* ---------- 1: explain ---------- */
L['mongo:7:1']={blocks:[
{p:'`explain` shows how the server runs a query: which plan it chose and, with execution statistics, how much work it did. It is the main diagnostic tool.'},
{code:`db.orders.find({ status: "paid", customerId: 7 })
  .sort({ createdAt: -1 })
  .explain("executionStats")`},
{h:'Verbosity modes'},
{t:[['Mode','What you get','Runs the query?'],
['`queryPlanner`','The winning plan only','No'],
['`executionStats`','Plan plus counts and timing','Yes'],
['`allPlansExecution`','Also the rejected candidate plans','Yes']]},
{h:'Reading the plan'},
{svg:plan},
{t:[['Field','Meaning','Good sign'],
['`winningPlan.stage`','Top-level operation','IXSCAN under FETCH'],
['`nReturned`','Documents returned','n/a'],
['`totalKeysExamined`','Index entries read','Close to nReturned'],
['`totalDocsExamined`','Documents read','Close to nReturned (0 for covered)'],
['`executionTimeMillis`','Total time','Low'],
['SORT stage','An in-memory sort happened','Absent (index supplies the order)'],
['COLLSCAN','Whole collection read','Absent for selective queries']]},
{h:'Common findings and fixes'},
{t:[['Finding','Likely fix'],
['COLLSCAN with few results','Add an index on the filter fields'],
['IXSCAN but keys examined much larger than returned','Better compound index (ESR), more selective leading field'],
['SORT stage','Add the sort field to the index after equality fields'],
['FETCH of many documents with a small projection','Create a covering index'],
['High executionTimeMillis, plan looks fine','Check memory, disk, concurrent load']]},
{note:'Explain on an aggregation: `db.orders.explain("executionStats").aggregate([...])`. Compare keys and documents examined with the number of documents the pipeline returns.'}],
src:[['explain results',MAN+'reference/explain-results/'],['cursor.explain',MAN+'reference/method/cursor.explain/']]};

/* ---------- 2: profiler and slow log ---------- */
L['mongo:7:2']={blocks:[
{p:'To tune, you first need to know **which** operations are slow. MongoDB records operations that take longer than a threshold.'},
{svg:prof},
{h:'The slow query log'},
{ul:['Every operation slower than `slowms` (default **100 ms**) is written to the mongod log as a structured JSON line.','The log is always on; no extra overhead to enable it.','Logs are JSON, so you can filter with `jq` or a log platform.']},
{code:`# Slow queries in the log (structured JSON, 4.4 and later)
grep '"Slow query"' /var/log/mongodb/mongod.log | jq '.attr | {ns, durationMillis, planSummary, docsExamined, keysExamined}'`},
{h:'The database profiler'},
{t:[['Level','Records'],
['`0`','Nothing (default)'],
['`1`','Only operations slower than `slowms`'],
['`2`','All operations (high overhead, short use only)']]},
{code:`db.setProfilingLevel(1, { slowms: 50 })     // current database
db.getProfilingStatus()

// The slowest recent operations
db.system.profile.find().sort({ millis: -1 }).limit(5)`},
{ul:['Profile data lives in a **capped collection** `system.profile` per database (small, 1 MB by default).','Use the **sampleRate** to reduce overhead on busy systems.','On Atlas, the **Query Profiler** and **Performance Advisor** read this data for you.']},
{h:'What to look for'},
{t:[['Field','Meaning'],
['`ns`','Namespace (database.collection)'],
['`millis` or `durationMillis`','Time taken'],
['`planSummary`','Plan used, for example COLLSCAN or IXSCAN { ... }'],
['`docsExamined`, `keysExamined`','Work done'],
['`nreturned`','Documents returned'],
['`queryHash`','Groups queries of the same shape']]}],
src:[['Database profiler',MAN+'tutorial/manage-the-database-profiler/'],['Log messages',MAN+'reference/log-messages/']]};

/* ---------- 3: common patterns ---------- */
L['mongo:7:3']={blocks:[
{p:'Most slow queries fall into a handful of patterns. Learn to recognise them quickly.'},
{t:[['Symptom','Cause','Fix'],
['**COLLSCAN** on a filter','No usable index','Create an index on the filter fields in ESR order'],
['**In-memory SORT**','Sort field not in an index, or index order mismatch','Add the sort to a compound index; avoid sorting large result sets'],
['**Large skip**','`skip(100000)` walks and discards documents','Use range (keyset) pagination'],
['**Unanchored or case-insensitive regex**','Examines every key or document','Use a text or Atlas Search index, or store a normalized field'],
['**$or with unindexed branches**','Each branch needs its own index','Index every branch, or restructure'],
['**Returning whole documents**','Network and memory cost','Use projection; consider covering indexes'],
['**$lookup without index**','Foreign collection scanned per document','Index the foreign field'],
['**Low-selectivity index**','Index on a field with few distinct values','Combine with a more selective field in a compound index'],
['**Negation operators ($ne, $nin, $not)**','Cannot narrow the index range','Reformulate positively where possible'],
['**Regex on large text**','Not a search engine','Atlas Search or a text index']]},
{h:'Quick check of selectivity'},
{code:`// How many distinct values does a field have?
db.orders.distinct("status").length

// Fraction of documents matching a filter
db.orders.countDocuments({ status: "paid" }) / db.orders.estimatedDocumentCount()`},
{note:'An index on a boolean or a field with 3 values rarely helps on its own. Put it **after** a selective field in a compound index.'}],
src:[['Query optimization',MAN+'core/query-optimization/'],['Indexing strategies',MAN+'applications/indexes/']]};

/* ---------- 4: working set and hardware ---------- */
L['mongo:7:4']={blocks:[
{p:'Even perfect queries are slow if the machine is short of memory, disk speed or CPU. Check resources before blaming the queries.'},
{h:'Is the working set in memory?'},
{code:`const c = db.serverStatus().wiredTiger.cache
printjson({
  configuredBytes: c["maximum bytes configured"],
  usedBytes:       c["bytes currently in the cache"],
  dirtyBytes:      c["tracked dirty bytes in the cache"],
  pagesReadIn:     c["pages read into cache"]
})`},
{h:'Signals of pressure'},
{t:[['Signal','Meaning','Action'],
['Cache used near the configured size','Normal when data is larger than the cache','Look at the next signals'],
['High, rising **pages read into cache**','Working set does not fit; disk reads on queries','More RAM, better indexes, smaller documents'],
['High **dirty** cache share','Writes faster than the engine flushes','Faster disk, review write load'],
['Application threads doing **eviction**','Cache is under heavy pressure and operations are slowed','Add memory or reduce load'],
['High disk read latency, high queue','Storage is the bottleneck','Faster storage or provisioned IOPS'],
['CPU near 100%','Compute-bound','Optimize queries, scale up or out']]},
{h:'Sizing guidance'},
{ul:['**RAM**: fit indexes and the hot part of the data. Add headroom for connections, sorts and the OS.','**Storage**: SSD or NVMe with low latency. Use XFS on Linux.','**CPU**: more cores for concurrent operations and compression.','**Network**: enough bandwidth for replication and large results.']},
{h:'Scale up, scale out, or fix the data'},
{t:[['Option','When'],
['Optimize queries and indexes','Always first'],
['Bigger machine (vertical)','Working set or CPU limit, simplest option'],
['Read from secondaries','Read-heavy, tolerates a little staleness'],
['Sharding (horizontal)','Data or writes exceed one server (Section 11)']]}],
src:[['serverStatus',MAN+'reference/command/serverStatus/'],['Production notes',MAN+'administration/production-notes/']]};

/* ---------- 5: connections ---------- */
L['mongo:7:5']={blocks:[
{p:'Each connection costs the server memory and a thread. Too many connections, or sudden bursts of new ones, can slow or overload an otherwise healthy database.'},
{svg:pool},
{h:'Where the numbers live'},
{code:`db.serverStatus().connections
// { current: 215, available: 51985, totalCreated: 48201, active: 12 }

// Who is connected
db.aggregate([ { $currentOp: { allUsers: true, idleConnections: true } },
               { $group: { _id: "$appName", n: { $sum: 1 } } } ])`},
{h:'Driver pool settings'},
{t:[['Setting','Meaning','Notes'],
['`maxPoolSize`','Maximum connections per server per client','Default 100'],
['`minPoolSize`','Connections kept ready','Avoids cold starts'],
['`maxIdleTimeMS`','Close idle connections after this time','Frees server resources'],
['`waitQueueTimeoutMS`','How long an operation waits for a free connection','Fails fast under overload'],
['`maxConnecting`','Limit how many connections are opened at once','Smooths storms']]},
{h:'Sizing the total'},
{flow:['Count application instances (including every pod and serverless function)','Multiply by maxPoolSize for the worst case','Compare with the server limit and what the machine can handle','Lower maxPoolSize or add a proxy layer if the total is too high']},
{h:'Common causes of trouble'},
{ul:['Creating a **new client per request** instead of reusing one.','Serverless functions each opening a pool at scale.','Leaked cursors or sessions holding connections.','A slow query makes every connection busy and the pool queues up.']},
{note:'The server limit is `net.maxIncomingConnections` (very high by default) but memory and CPU are the practical limit. Atlas tiers have their own connection limits.'}],
src:[['Connection pool settings',MAN+'reference/connection-string-options/'],['Connection limits on Atlas',M.ATLAS+'connection-limits/']]};
})();
