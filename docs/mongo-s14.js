/* LearnSphere - MongoDB, Section 14: Monitoring & Diagnostics.
   Lectures 0-5 are core, 6-7 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const signals=M.dg(700,200,[
[10,10,680,180,'The health signals',1],
[30,50,150,55,'Throughput|opcounters,|latency',2],[200,50,150,55,'Resources|CPU, memory,|disk, I/O',2],[370,50,150,55,'Replication|lag, oplog window,|member state',2],
[540,50,130,55,'Capacity|disk used,|connections',2],
[30,120,640,55,'Application view: error rate, timeouts, slow queries, queue waits',0]],
[]);

const tools=M.dg(700,150,[
[10,10,680,130,'Pick the tool for the question',1],
[30,55,150,55,'Right now?|mongostat, currentOp',2],[210,55,150,55,'Why slow?|profiler, explain,|log',0],[390,55,130,55,'Trend?|Atlas, Ops Manager,|Grafana',0],[550,55,120,55,'Alert|threshold rules',0]],
[]);

const trbl=M.dg(700,140,[
[10,10,680,120,'Incident method',1],
[30,55,120,55,'Detect|alert',0],[180,55,130,55,'Triage|what changed?',0],[340,55,130,55,'Diagnose|currentOp,|logs, metrics',2],[500,55,80,55,'Fix',0],[600,55,70,55,'Review',0]],
[[150,82,180,82],[310,82,340,82],[470,82,500,82],[580,82,600,82]]);

/* ---------- 0: what to monitor ---------- */
L['mongo:13:0']={blocks:[
{p:'Monitoring answers three questions: **is it healthy now**, **what is changing**, and **when will it run out of something**. Collect the right few signals and alert on those that need action.'},
{svg:signals},
{h:'The key metrics'},
{t:[['Area','Metric','Why it matters'],
['**Workload**','Operations per second by type, latency','Baseline and sudden changes'],
['**Queries**','Slow queries, scanned vs returned','Missing indexes'],
['**Connections**','Current vs available','Connection storms, leaks'],
['**Memory**','Cache used, dirty, evictions, page faults','Working set pressure'],
['**Disk**','Used space, free space, IOPS, latency','Capacity and bottlenecks'],
['**Replication**','Lag, oplog window, member state','Failover safety'],
['**Sharding**','Chunk balance, migrations, jumbo chunks','Skew and hot shards'],
['**Locks and queues**','Queued readers and writers, ticket usage','Contention']]},
{h:'Alerts that should wake someone'},
{ul:['**Primary missing** or replica set without a majority.','**Replication lag** above the threshold for several minutes.','**Disk** above about 80 percent and growing.','**Connections** near the limit.','**Backup failed** or snapshot too old.']},
{note:'Alert on **symptoms with action attached**. A metric that goes red every day without anyone acting on it is noise.'}],
src:[['Monitoring for MongoDB',MAN+'administration/monitoring/'],['Atlas monitoring',M.ATLAS+'monitoring-alerts/']]};

/* ---------- 1: built-in commands ---------- */
L['mongo:13:1']={blocks:[
{p:'The server exposes its own counters through commands. These are the source for every monitoring tool.'},
{t:[['Command','Returns','Use'],
['`db.serverStatus()`','Many sections: connections, opcounters, memory, cache, network, replication','General health snapshot'],
['`db.stats()`','Database size, collections, indexes','Capacity per database'],
['`db.coll.stats()` or `$collStats`','Collection size, count, index sizes','Which collection is large'],
['`db.currentOp()`','Operations running now','Find slow or blocking operations'],
['`rs.status()`','Replica set member states and optimes','Health and lag'],
['`sh.status()`','Sharding layout','Balance and zones'],
['`db.adminCommand({ top: 1 })`','Time per collection','Hot collections']]},
{h:'Useful snippets'},
{code:`// Connections and operation counters
const s = db.serverStatus();
printjson({ conn: s.connections, ops: s.opcounters });

// Sizes in GB
db.getSiblingDB("shop").stats(1024*1024*1024)

// Largest collections in the current database
db.getCollectionNames()
  .map(n => ({ n, s: db[n].stats().storageSize }))
  .sort((a, b) => b.s - a.s).slice(0, 5)`},
{h:'Reading opcounters'},
{p:'`opcounters` are cumulative counters since start. Take two samples and divide the difference by the elapsed seconds to get operations per second. Monitoring tools do this for you.'},
{note:'`serverStatus` is lightweight but not free. Poll it every 10 to 60 seconds, not every second.'}],
src:[['serverStatus',MAN+'reference/command/serverStatus/'],['db.stats',MAN+'reference/method/db.stats/'],['currentOp',MAN+'reference/method/db.currentOp/']]};

/* ---------- 2: mongostat, mongotop, logs ---------- */
L['mongo:13:2']={blocks:[
{p:'Two command-line tools give a quick live view, and the log file holds the detail.'},
{h:'mongostat'},
{code:`mongostat --uri "mongodb://localhost:27017" 2
# insert query update delete getmore command dirty used flushes vsize res qrw arw net_in net_out conn`},
{t:[['Column','Meaning'],
['`insert query update delete`','Operations per second by type'],
['`dirty`, `used`','Percent of the WiredTiger cache dirty and used'],
['`qrw`, `arw`','Queued and active readers/writers'],
['`conn`','Open connections'],
['`net_in`, `net_out`','Network bytes per second']]},
{h:'mongotop'},
{code:`mongotop --uri "mongodb://localhost:27017" 5
# ns        total   read   write
# shop.orders  42ms  30ms   12ms`},
{p:'Shows which collections consume read and write time, helping you find the hot collection.'},
{h:'The mongod log'},
{ul:['Written as **structured JSON** (4.4 and later), so tools like `jq` work well.','Contains startup, **slow queries**, connection events, replication and election events, and errors.','Rotate logs with `logRotate` or the OS logrotate to keep them from filling the disk.']},
{code:`# Elections and state changes
grep -E '"c":"ELECTION"|"c":"REPL"' /var/log/mongodb/mongod.log | jq -c '{t: .t."$date", msg}' | tail

# Errors and warnings only
jq -c 'select(.s=="E" or .s=="W") | {t: .t."$date", c, msg}' /var/log/mongodb/mongod.log | tail`},
{note:'Keep logs for long enough to investigate incidents (days or weeks) and ship them to a central place so they survive a host loss.'}],
src:[['mongostat',M.TOOLS+'mongostat/'],['mongotop',M.TOOLS+'mongotop/'],['Log messages',MAN+'reference/log-messages/']]};

/* ---------- 3: problem operations ---------- */
L['mongo:13:3']={blocks:[
{p:'When the database is slow, **currentOp** shows what is running right now. You can then stop an operation that is causing harm.'},
{code:`// Operations running longer than 5 seconds
db.currentOp({ active: true, secs_running: { $gt: 5 } })

// Aggregation form with filters (also lists idle sessions if asked)
db.aggregate([
  { $currentOp: { allUsers: true } },
  { $match: { active: true, secs_running: { $gt: 5 } } },
  { $project: { opid: 1, ns: 1, op: 1, secs_running: 1, planSummary: 1, command: 1 } }
])`},
{h:'Useful fields'},
{t:[['Field','Meaning'],
['`opid`','Identifier used to kill it'],
['`ns`','Namespace being used'],
['`op`','Type: query, update, command and so on'],
['`secs_running`','How long it has run'],
['`planSummary`','COLLSCAN or IXSCAN details'],
['`waitingForLock`','Blocked on a lock'],
['`client`, `appName`','Where it came from']]},
{h:'Stopping an operation'},
{code:`db.killOp(12345)`},
{ul:['Killing a **query** is usually safe.','Killing a **write** may leave a multi-document update half-applied, because the work is not rolled back.','Never kill internal operations such as replication, migrations or index builds without a plan.','Set `maxTimeMS` on queries in application code so runaway queries stop by themselves.']},
{code:`db.orders.find({ status: "paid" }).maxTimeMS(5000)`},
{h:'Finding blockers'},
{flow:['Look for operations with waitingForLock true','Find the operation holding the conflicting lock or transaction','Decide: wait, optimize, or kill','Fix the cause (index, long transaction, batch size)']}],
src:[['$currentOp',MAN+'reference/operator/aggregation/currentOp/'],['killOp',MAN+'reference/method/db.killOp/'],['maxTimeMS',MAN+'reference/method/cursor.maxTimeMS/']]};

/* ---------- 4: alerting and dashboards ---------- */
L['mongo:13:4']={blocks:[
{p:'Raw commands are good for investigation. For continuous operation you need **collection, history, dashboards and alerts**.'},
{svg:tools},
{t:[['Option','Where','Highlights'],
['**Atlas monitoring and alerts**','Atlas','Built-in charts, Query Profiler, Performance Advisor, alert rules and integrations (email, Slack, PagerDuty)'],
['**Ops Manager / Cloud Manager**','Self-managed (Enterprise)','Monitoring, backup and automation for your own servers'],
['**Prometheus and Grafana**','Self-managed','Use an exporter (such as the Percona MongoDB exporter) and build dashboards and alerts'],
['**APM and cloud tools**','Any','Datadog, New Relic, CloudWatch integrations'],
['**Free cloud monitoring**','Community','Basic metrics from MongoDB cloud; it is being retired, so check availability for your version first']]},
{h:'Designing alerts'},
{t:[['Alert','Example threshold','Action'],
['No primary','For 1 minute','Page on-call'],
['Replication lag','> 30 seconds for 5 minutes','Investigate secondary or load'],
['Disk used','> 80 percent','Plan capacity or cleanup'],
['Connections','> 80 percent of limit','Find leaks, tune pools'],
['Slow queries','Spike versus baseline','Check profiler'],
['Cache dirty','> 20 percent sustained','Check disk I/O']]},
{ul:['Every alert should have a **runbook link** and an **owner**.','Use **two levels**: warning (ticket) and critical (page).','Review and prune alerts regularly.']},
{note:'Dashboards show trends. Alerts show problems. Keep both small and focused on decisions.'}],
src:[['Atlas alerts',M.ATLAS+'configure-alerts/'],['Ops Manager','https://www.mongodb.com/docs/ops-manager/current/']]};

/* ---------- 5: troubleshooting playbook ---------- */
L['mongo:13:5']={blocks:[
{p:'Most incidents fall into a few classes. A fixed order of checks avoids guessing under pressure.'},
{svg:trbl},
{h:'High CPU'},
{flow:['Check currentOp for long or many similar operations','Check the profiler or log for COLLSCAN and in-memory sorts','Check for recent deployments or a changed query pattern','Add the missing index, rewrite the query, or scale up']},
{h:'Slow writes'},
{ul:['Check **disk latency** and **IOPS** (journal and checkpoints).','Check the **number of indexes** touched by each write.','Check **majority write concern** waiting on a lagging secondary.','Check for **lock waits** and long transactions.','Look at **dirty cache** and eviction pressure.']},
{h:'Disk full'},
{flow:['Confirm which volume and what is using space (data, journal, logs, oplog, dumps)','Remove non-database files (old logs, dumps) first','Free space inside MongoDB with TTL, deletes plus compact, or by dropping unused data','Extend the volume or add a shard','Fix the root cause and add an alert']},
{ul:['Never delete files inside dbPath by hand.','A full disk can stop mongod and risk corruption: act **before** reaching 100 percent.']},
{h:'Primary keeps changing'},
{ul:['Check network latency and packet loss between members.','Check CPU or I/O stalls on the primary causing missed heartbeats.','Check time sync (NTP) on all members.']},
{note:'Capture evidence before restarting: `currentOp`, `serverStatus`, logs and the `diagnostic.data` folder. A restart clears the clues.'}],
src:[['Troubleshooting',MAN+'faq/diagnostics/'],['Diagnostic data (FTDC)',MAN+'administration/analyzing-mongodb-performance/']]};
})();
