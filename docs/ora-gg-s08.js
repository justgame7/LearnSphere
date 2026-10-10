/* LearnSphere - GoldenGate, Section 08: Performance & Tuning.
   Lectures 0-6 are core, 7-10 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const lag=O.dg(700,210,[
[10,30,130,70,'Source commit|at time T',0],[190,30,140,70,'Extract|captures it|(capture lag)',2],[380,30,140,70,'Path and network|moves the trail|(transport lag)',2],[570,30,120,70,'Replicat|applies it|(apply lag)',2],
[10,120,680,80,'End-to-end lag = capture lag + transport lag + apply lag. Measure each stage to find the slow one.',1]],
[[140,65,190,65],[330,65,380,65],[520,65,570,65]]);

/* ---------- 0: Measuring lag ---------- */
L['ora-gg:7:0']={blocks:[
{p:'**Lag** is the time between a change on the source and the same change on the target. It is the main health number of a replication.'},
{svg:lag},
{h:'Where to see lag'},
{code:`OGG> LAG EXTRACT ext1
OGG> LAG REPLICAT rep1
OGG> INFO ALL                 -- shows lag at checkpoint for each process`},
{h:'A heartbeat table gives true end-to-end lag'},
{p:'A **heartbeat table** records a timestamp on the source at regular intervals. As it passes through Extract and Replicat, each stage adds its timestamp. The result is an exact lag per stage.'},
{code:`OGG> ADD HEARTBEATTABLE
OGG> INFO HEARTBEATTABLE`},
{t:[['Lag','Meaning'],
['**Capture lag**','Change at the source to Extract'],
['**Transport lag**','Extract to the target (path and network)'],
['**Apply lag**','Trail on the target to the committed change in the target database'],
['**End-to-end**','Total of the three']]},
{h:'Reading it'},
{ul:['Low and stable: healthy.','Rising lag: the slowest stage cannot keep up.','Spikes after batch jobs: normal if they recover quickly.']},
{flow:['Add a heartbeat table and let it run','Look at the lag of each stage','Find the stage where it grows','Tune that stage (next lectures)']},
{note:'Set an alert on lag. A lag of minutes is often a warning of a stopped or stuck process.'}],
src:[['Heartbeat table and lag',O.GG]]};

/* ---------- 1: Integrated Extract tuning ---------- */
L['ora-gg:7:1']={blocks:[
{p:'If **capture lag** is high, the Extract or the log mining server is slower than the source generates redo.'},
{h:'What to check'},
{t:[['Area','Check','Action'],
['**Memory**','Streams pool use, `MAX_SGA_SIZE`','Increase `MAX_SGA_SIZE` and the streams pool'],
['**Parallelism**','`PARALLELISM` of the log mining server','Increase, with CPU available'],
['**Redo volume**','Large batch jobs, NOLOGGING','Separate heavy tables into another Extract'],
['**Archived logs**','Extract reading old logs from disk','Keep the logs it needs online, on fast storage'],
['**Tables**','Capture only what you need','Remove unneeded tables and columns'],
['**RAC**','Each thread is read','Make sure all instances are visible and healthy']]},
{code:`TRANLOGOPTIONS INTEGRATEDPARAMS (MAX_SGA_SIZE 2048, PARALLELISM 4)

SELECT capture_name, state, total_messages_captured FROM v$goldengate_capture;
SELECT * FROM v$goldengate_capture;`},
{h:'Split the work'},
{flow:['Find the busiest tables with a redo or change count','Move them to a separate Extract and trail','Give each Extract its own memory and parallelism','Compare lag before and after']},
{note:'Do not give the log mining server more memory than the streams pool can hold. Check the database for streams pool errors in the alert log.'}],
src:[['Tuning Extract',O.GG]]};

/* ---------- 2: Parallel Replicat tuning ---------- */
L['ora-gg:7:2']={blocks:[
{p:'If **apply lag** is high, the Replicat cannot write to the target fast enough. A parallel Replicat has several knobs.'},
{h:'Parallelism and batching'},
{t:[['Parameter','Effect'],
['`MAP_PARALLELISM`','Number of mapper threads that read and prepare the trail'],
['`MIN_APPLY_PARALLELISM` / `MAX_APPLY_PARALLELISM`','Range of apply threads, which scale with load'],
['`APPLY_PARALLELISM`','Fixed number of apply threads'],
['`BATCHSQL`','Group similar statements and apply them in arrays'],
['`GROUPTRANSOPS`','How many operations to group per transaction commit']]},
{code:`REPLICAT rep1
USERIDALIAS tgt_alias DOMAIN OracleGoldenGate
MAP_PARALLELISM 4
MIN_APPLY_PARALLELISM 4
MAX_APPLY_PARALLELISM 16
BATCHSQL
MAP pdb1.shop.*, TARGET shop.*;`},
{h:'The target database matters'},
{t:[['Check','Why'],
['**Indexes** on target tables','Each index slows inserts and updates. Keep only needed ones.'],
['**Constraints and triggers**','Extra work on each row'],
['**Storage and redo**','Apply is a write workload. Check log file sync and I/O waits on the target.'],
['**Foreign keys**','The Replicat respects dependencies, which limits parallelism']]},
{flow:['Check where apply is slow: database waits on the target','Increase parallelism if the database has headroom','Use BATCHSQL for many small statements','Remove needless indexes and triggers on the target']},
{note:'More threads do not help if the target database is the bottleneck. Look at its waits first.'}],
src:[['Tuning Replicat',O.GG]]};

/* ---------- 3: Trails, network, compression ---------- */
L['ora-gg:7:3']={blocks:[
{p:'If **transport lag** is high, look at the trail files and the network between source and target.'},
{h:'Trail files'},
{t:[['Item','Advice'],
['**Location**','Fast, local, protected storage. Not on a slow network share.'],
['**Size**','Not too small, so file switches are rare (for example 500 MB to 2 GB)'],
['**Retention**','Purge after all readers are done, but long enough for recovery needs']]},
{h:'Network'},
{t:[['Setting','Effect'],
['**Compression on the path**','Less data over the wire, more CPU'],
['**Bandwidth**','Must carry the peak change rate. Measure it.'],
['**Latency and TCP buffers**','On long links, large buffers help fill the pipe'],
['**Several paths**','Split tables over several paths and trails to use more connections']]},
{code:`# Illustrative: enable compression when creating or altering the path in the Web UI,
# or check the option in the Admin Client reference
OGG> INFO DISTPATH dp1, DETAIL`},
{flow:['Measure the change rate in MB per second','Compare with the bandwidth and latency','Compress or split paths if the link is the limit','Keep trails on fast local disks']},
{note:'The change volume is often smaller than people expect, because only changed columns are in the trail for updates. Measure it before you buy bandwidth.'}],
src:[['Trails and network',O.GG]]};

/* ---------- 4: Large transactions and LOBs ---------- */
L['ora-gg:7:4']={blocks:[
{p:'Two things create lag spikes: **very large transactions** and **large objects (LOBs)**.'},
{h:'Large transactions'},
{ul:['GoldenGate applies a transaction **only after it commits** on the source. A batch job that changes millions of rows in one transaction appears all at once.','Apply starts only after the whole transaction is read, and the transaction is applied as a unit by default.','Memory and temporary space hold the transaction while it is processed.']},
{code:`# Extract: control memory for large transactions
CACHEMGR CACHESIZE 4GB, CACHEDIRECTORY /u01/ogg/dirtmp

# Replicat (classic and parallel): split very large transactions
SPLIT_TRANS_RECS 10000`},
{t:[['Option','Effect'],
['`CACHEMGR`','Memory and disk used to hold open transactions in Extract'],
['`SPLIT_TRANS_RECS`','Apply a huge transaction in pieces (note: loses the atomicity of that one transaction)']]},
{h:'LOBs'},
{t:[['Topic','Advice'],
['**Size**','Large LOBs are read separately and take time'],
['**Capture**','Integrated Extract supports LOBs. Check the support mode.'],
['**Apply**','Use the parallel Replicat and test the speed with real LOB sizes'],
['**Tuning**','LOB chunk size and storage on the target matter']]},
{h:'Practical advice'},
{ul:['Ask developers to commit in **smaller batches**. It helps the database and GoldenGate.','Plan big loads: replicate them in a window, or exclude the staging tables.']},
{note:'Splitting a transaction trades safety for speed. Use it only when you accept that the target may show part of the transaction for a short time.'}],
src:[['Large transactions and LOBs',O.GG]]};

/* ---------- 5: Performance Metrics ---------- */
L['ora-gg:7:5']={blocks:[
{p:'The **Performance Metrics Server** collects numbers about every process and shows them in the Web UI, so you can see where time goes.'},
{t:[['Metric','What it tells you'],
['**Lag**','Capture, transport and apply lag over time'],
['**Throughput**','Records and bytes per second at each stage'],
['**Operations**','Inserts, updates, deletes per table'],
['**Process state**','Running, stopped, abended'],
['**CPU and memory of the process**','Resource use']]},
{h:'Using it'},
{flow:['Open the Performance Metrics view in the Web UI','Select the process or path','Look at lag and throughput for the last hours','Compare normal days with a bad day','Export or stream the metrics to your monitoring system']},
{code:`# Metrics are also available through the REST API
curl -k -u oggadmin:<password> https://host:9011/services/v2/deployments/src_dep/...`},
{h:'Good practice'},
{ul:['Keep history for at least a few weeks, to compare with the past.','Alert on lag and on process state.','Use the metrics to prove the effect of every tuning change.']},
{note:'A metric that nobody looks at is useless. Put the most important ones (lag and state) on a dashboard that the team sees every day.'}],
src:[['Performance Metrics Service',O.GG]]};

/* ---------- 6: Practical ---------- */
L['ora-gg:7:6']={blocks:[
{p:'Tune a slow pipeline. Make a slow flow on purpose, find the stage that is slow, and improve it.'},
{h:'Create the load'},
{code:`-- Source: generate changes
INSERT INTO shop.orders SELECT level + 1000, 'Cust' || level, MOD(level, 1000) FROM dual CONNECT BY level <= 500000;
COMMIT;
UPDATE shop.orders SET total = total + 1;
COMMIT;`},
{h:'Steps'},
{flow:['Add a heartbeat table and watch the lag','Run the load and see which lag grows','Identify the slow stage: capture, transport or apply','Change one thing: parallelism, BATCHSQL or index on the target','Measure again']},
{t:[['If this lag is high','Try'],
['Capture lag','More `MAX_SGA_SIZE` and `PARALLELISM`, split tables'],
['Transport lag','Compression, more paths, check bandwidth'],
['Apply lag','`MAP_PARALLELISM`, apply parallelism, `BATCHSQL`, fewer indexes on the target']]},
{code:`OGG> LAG EXTRACT ext1
OGG> LAG REPLICAT rep1
OGG> STATS REPLICAT rep1, LATEST`},
{h:'Check your result'},
{t:[['Check','Expected'],
['Before tuning','A lag that grows during the load'],
['After one change','A lower peak lag, or faster catch-up'],
['Your notes','Which change helped, how much']]},
{note:'Change one thing at a time, and write down the numbers. Without a baseline you cannot prove that a change helped.'}],
src:[['GoldenGate performance',O.GG]]};

})();
