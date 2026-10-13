/* LearnSphere - Oracle Performance & Tuning Quick Reference (cheat sheet).
   window.QREF['ora-perf'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Values are for Oracle Database 19c on Linux unless stated. AWR, ASH, ADDM, SQL Monitor and advisors need the Diagnostics Pack or Tuning Pack:
   check the Licensing Information User Manual before you use them. */
window.QREF=window.QREF||{};
window.QREF['ora-perf']={title:'Performance & Tuning Quick Reference',blurb:'Tools, wait events, views, parameters, plan operations and fixes for tuning on one page each.',hint:'wait or optimizer',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas behind Oracle performance tuning that you should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one query or command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Method and measurement'},
{acc:[
{t:'A tuning method',s:'Measure, find the bottleneck, fix, verify.',
 a:'Tuning is a loop. **Measure** where the time goes, **find** the single biggest bottleneck, **change one thing**, then **verify** with the same measurement. Skipping the measurement leads to changing parameters at random, and changing several things at once leaves you unable to tell what helped.',
 w:'The method is what separates a repeatable result from a lucky one. It also gives you the evidence for the change record.',
 c:`SELECT stat_name, ROUND(value/1000000) AS seconds FROM v$sys_time_model WHERE stat_name IN ('DB time','DB CPU') ORDER BY value DESC;`,see:[0,0,'A tuning methodology: measure, find the bottleneck, fix, verify']},
{t:'DB time and the time model',s:'One number that adds up.',
 a:'**DB time** is the total time sessions spend in database calls, either on CPU or waiting. The **time model** breaks it into parts such as parse, SQL execute and PL/SQL. Comparing DB time with elapsed time and the number of CPUs tells you whether the instance is busy or idle.',
 w:'It lets you rank problems by how much of DB time they take, instead of by how loud the complaint is.',
 c:`SELECT stat_name, ROUND(value/1000000,1) AS seconds FROM v$sys_time_model ORDER BY value DESC FETCH FIRST 8 ROWS ONLY;`,see:[0,1,'DB time, the time model and wait classes']},
{t:'Wait events and wait classes',s:'What sessions were waiting for.',
 a:'When a session is not on CPU it is **waiting**, and Oracle records the **wait event** and its class (User I/O, Commit, Concurrency, Network, Application and so on). The time spent in each event is the main lens for finding a bottleneck.',
 w:'Start with the class, then the event, then the object or SQL behind it.',
 c:`SELECT wait_class, ROUND(SUM(time_waited_micro)/1000000) AS seconds FROM v$system_event WHERE wait_class <> 'Idle' GROUP BY wait_class ORDER BY 2 DESC;`,see:[1,0,'The wait interface: events, classes and statistics']},
{t:'Baselines',s:'You cannot judge a number without a normal.',
 a:'A **baseline** is a saved set of statistics from a period when the system was healthy. Comparing a bad period to it shows what changed. AWR baselines can be fixed periods or moving windows, and can drive adaptive thresholds.',
 w:'Most "it is slow today" questions are answered by one comparison with last week.',
 c:`SELECT baseline_name, start_snap_id, end_snap_id, baseline_type FROM dba_hist_baseline;`,see:[0,2,'Proactive vs reactive tuning and baselines']},
{t:'The diagnostic tools map',s:'Which tool for which question.',
 a:'**V$ views** show the present. **AWR** keeps history as snapshots. **ASH** samples active sessions every second. **ADDM** analyses AWR and gives findings. **SQL Monitor** shows one long statement live. **Advisors** suggest changes. Pick the tool for the time scale of your problem.',
 w:'Right now: V$ and ASH. Last night: ASH and AWR. A single statement: SQL Monitor and the plan.',
 c:`SELECT snap_id, begin_interval_time FROM dba_hist_snapshot ORDER BY snap_id DESC FETCH FIRST 3 ROWS ONLY;`,see:[0,3,'The tools map: AWR, ASH, ADDM, SQL Monitor and advisors']},
{t:'The Diagnostics and Tuning Pack licence',s:'Features that cost extra.',
 a:'AWR, ASH, ADDM and the related views are part of the **Diagnostics Pack**. SQL Tuning Advisor, SQL Monitor and the SQL Access Advisor need the **Tuning Pack**. The views exist whether or not you are licensed, and the parameter `CONTROL_MANAGEMENT_PACK_ACCESS` controls access.',
 w:'Using them without the licence is an audit finding. Statspack and V$ views are the free route.',
 c:`SHOW PARAMETER control_management_pack_access`,see:[0,4,'Licensing: what needs the Diagnostics and Tuning Packs']}
]},

{h:'Reading the evidence'},
{acc:[
{t:'Active Session History',s:'A film of what sessions were doing.',
 a:'**ASH** samples every active session once per second and records its SQL, event, object and more. The recent data is in memory and a sample of it is kept in AWR. It answers "what was the database doing at 02:15" without having traced anything.',
 w:'ASH is the best tool for short, intermittent problems that a snapshot average would hide.',
 c:`SELECT sample_time, session_id, sql_id, event FROM v$active_session_history WHERE sample_time > SYSDATE - 5/1440 ORDER BY sample_time DESC FETCH FIRST 10 ROWS ONLY;`,see:[2,2,'Active Session History and ASH reports']},
{t:'AWR snapshots and reports',s:'Two snapshots, one difference.',
 a:'**AWR** takes a snapshot of the cumulative statistics every hour by default and keeps them for eight days. An AWR report is the difference between two snapshots, giving load profile, top events, top SQL and more.',
 w:'Read it top-down: load profile, top foreground events, then top SQL for the dominant event. A report over too long a period hides spikes.',
 c:`SELECT snap_id, begin_interval_time FROM dba_hist_snapshot ORDER BY snap_id DESC FETCH FIRST 5 ROWS ONLY;
@?/rdbms/admin/awrrpt.sql`,see:[2,1,'Generating and reading AWR reports']},
{t:'ADDM',s:'Automatic findings from AWR.',
 a:'**ADDM** runs after each snapshot and analyses DB time, producing findings ranked by impact, with recommendations. It is a good first reader of a period, and its findings point at the same top events you would find by hand.',
 w:'Use it to confirm your diagnosis, and for the less obvious findings such as too many parses.',
 c:`SELECT task_name, description, status FROM dba_advisor_tasks WHERE advisor_name = 'ADDM' ORDER BY created DESC FETCH FIRST 3 ROWS ONLY;`,see:[2,3,'ADDM: findings, recommendations and reports']},
{t:'Common waits',s:'A short list covers most cases.',
 a:'**db file sequential read** is single-block reads, usually index access. **db file scattered read** and **direct path read** are scans. **log file sync** is commit waits on LGWR. **enq: TX - row lock contention** is application locking. **library cache** and **cursor** mutex waits are parsing. Each one points at a different part of the system.',
 w:'Learn the dozen common ones and what drives them. Everything else you look up.',
 c:`SELECT event, total_waits, ROUND(time_waited_micro/1000000) AS seconds FROM v$system_event WHERE wait_class <> 'Idle' ORDER BY time_waited_micro DESC FETCH FIRST 10 ROWS ONLY;`,see:[1,3,'The most common waits and what they mean']},
{t:'Finding expensive SQL',s:'Rank by elapsed time, then by executions.',
 a:'`V$SQL` and `V$SQLSTATS` hold cumulative statistics per cursor. Rank by elapsed time or CPU for the biggest consumers, then look at executions and the time per execution. A fast statement run a million times can cost more than one slow report.',
 w:'The right unit to tune is the statement that uses the most of the resource that is short.',
 c:`SELECT sql_id, executions, ROUND(elapsed_time/1000000) AS elapsed_s, ROUND(elapsed_time/NULLIF(executions,0)/1000) AS ms_per_exec, SUBSTR(sql_text,1,60) FROM v$sql ORDER BY elapsed_time DESC FETCH FIRST 10 ROWS ONLY;`,see:[1,4,'V$SQL, V$SQLAREA and finding expensive SQL']}
]},

{h:'The optimizer'},
{acc:[
{t:'The cost-based optimizer',s:'It chooses the cheapest plan it can estimate.',
 a:'For each statement the **optimizer** considers access paths, join orders and join methods, estimates a cost for each using statistics, and picks the lowest. A bad plan almost always comes from a bad estimate, which comes from missing or stale statistics, skew, or correlation it cannot see.',
 w:'When a plan is wrong, ask what the optimizer believed. Compare estimated and actual rows.',
 c:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id', NULL, 'ALLSTATS LAST'));`,see:[3,0,'How the cost-based optimizer works']},
{t:'Optimizer statistics',s:'What the optimizer knows.',
 a:'**Statistics** describe tables (rows, blocks), columns (distinct values, nulls, histograms) and indexes (levels, clustering factor). They are gathered by an automatic job and by `DBMS_STATS`. Stale or missing statistics are the commonest cause of plan changes.',
 w:'Do not gather statistics at random. Know what is gathered, when, and keep the previous versions so you can restore.',
 c:`SELECT table_name, num_rows, last_analyzed, stale_stats FROM dba_tab_statistics WHERE owner = 'HR';`,see:[3,1,'Optimizer statistics: tables, indexes and columns']},
{t:'Histograms and extended statistics',s:'Skew and correlated columns.',
 a:'**Histograms** describe uneven data distribution, so the optimizer knows that a value is rare or very common. **Extended statistics** describe column groups or expressions, so correlated predicates are not multiplied as if independent.',
 w:'They fix the most common cardinality errors without hints.',
 c:`SELECT column_name, num_distinct, histogram FROM dba_tab_col_statistics WHERE owner = 'HR' AND table_name = 'EMPLOYEES';`,see:[3,3,'Histograms and extended statistics']},
{t:'Execution plans',s:'The steps the database will take.',
 a:'A **plan** is a tree of row-source operations. Read it from the innermost, indented step outward. The useful columns are **E-Rows** (estimated) against **A-Rows** (actual), **Buffers** and **Starts**. A large gap between estimate and actual is where to look.',
 w:'You tune the plan, not the SQL text. A plan with actual rows is worth ten with only estimates.',
 c:`SELECT /*+ GATHER_PLAN_STATISTICS */ COUNT(*) FROM hr.employees WHERE department_id = 50;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST'));`,see:[4,0,'Reading execution plans with EXPLAIN PLAN and DBMS_XPLAN']},
{t:'Access paths and joins',s:'How rows are found and combined.',
 a:'Rows are read by **full scan**, **index range scan**, **index fast full scan** and others. Tables are joined by **nested loops** (good for few rows with an index), **hash join** (good for large sets) or **sort merge**. The right choice depends on how many rows each step returns.',
 w:'An index is not always better than a full scan. For large fractions of a table, scanning wins.',
 c:`SELECT operation, options, object_name, cardinality, cost FROM v$sql_plan WHERE sql_id = '&sql_id' ORDER BY id;`,see:[4,1,'Access paths: full scan, index range, fast full and skip scan']},
{t:'Bind variables and adaptive cursor sharing',s:'One text, different plans.',
 a:'**Bind peeking** lets the optimizer see the first bind values when it parses. **Adaptive cursor sharing** lets it create several plans for one statement when the values give very different row counts. Literals instead of binds make many cursors and many hard parses.',
 w:'Binds protect the shared pool and the CPU, and adaptive sharing protects against skewed data.',
 c:`SELECT sql_id, child_number, is_bind_sensitive, is_bind_aware, executions FROM v$sql WHERE sql_id = '&sql_id';`,see:[4,6,'Bind variables, peeking and adaptive cursor sharing']}
]},

{h:'Fixing and stabilising'},
{acc:[
{t:'SQL Tuning Advisor and SQL profiles',s:'Let the optimizer analyse a statement.',
 a:'The **SQL Tuning Advisor** examines one statement in depth, tries alternative plans, and may recommend gathering statistics, creating an index or accepting a **SQL profile**. A profile is a set of corrections to the optimizer estimates that is stored outside the SQL text, so no code change is needed.',
 w:'It is a good first attempt on a single statement, and it needs the Tuning Pack.',
 c:`DECLARE t VARCHAR2(64); BEGIN t := DBMS_SQLTUNE.CREATE_TUNING_TASK(sql_id => '&sql_id'); DBMS_SQLTUNE.EXECUTE_TUNING_TASK(t); END;
/`,see:[5,0,'SQL Tuning Advisor and SQL profiles']},
{t:'SQL Plan Management',s:'Do not let a good plan get worse.',
 a:'**SQL plan baselines** record accepted plans for a statement. The optimizer will use only accepted plans, and new plans are held until **evolved** (verified as no worse). This stops a statistics gather or an upgrade from changing a plan without proof.',
 w:'It is the tool for plan stability, for example before an upgrade, and it works without changing code.',
 c:`SELECT sql_handle, plan_name, enabled, accepted, fixed FROM dba_sql_plan_baselines ORDER BY created DESC FETCH FIRST 10 ROWS ONLY;`,see:[5,2,'SQL Plan Management: baselines and evolution']},
{t:'Hints',s:'Instructions, used sparingly.',
 a:'A **hint** tells the optimizer to use a particular access path, join order or method. Hints are fragile: they bind the SQL to a plan that may stop being right as data changes. Prefer fixing statistics, and use hints, SQL patches or baselines when you need to control a plan.',
 w:'A hint is a symptom treatment. Record why it exists and revisit it after data growth.',
 c:`SELECT /*+ INDEX(e emp_department_ix) */ * FROM hr.employees e WHERE department_id = 50;`,see:[5,3,'Hints: when to use them and why']},
{t:'SQL patches and SQL quarantine',s:'Targeted, no-code controls.',
 a:'A **SQL patch** attaches a hint to a statement without changing the code. **SQL Quarantine** stops a statement from running again when it exceeded a resource limit, so a runaway query does not repeat its damage.',
 w:'They are emergency tools. They solve a production problem now, and the root cause still needs fixing.',
 c:`SELECT name, status, created FROM dba_sql_patches;
SELECT sql_text, name, last_executed FROM dba_sql_quarantine;`,see:[5,5,'SQL patches and SQL quarantine']},
{t:'Indexes',s:'The right structure for the access path.',
 a:'A **B-tree** index suits selective lookups and range scans, a **bitmap** index suits low-cardinality columns in read-mostly data, a **function-based** index serves an expression, and a **composite** index serves several columns, with the order of columns important. Each index costs space and write time.',
 w:'Do not index everything. Add an index for a measured access path and check it is used.',
 c:`SELECT index_name, index_type, status, visibility, last_analyzed FROM dba_indexes WHERE owner = 'HR';`,see:[6,0,'Choosing indexes: B-tree, bitmap, function-based and composite']},
{t:'Partitioning and pruning',s:'Read less, manage smaller pieces.',
 a:'**Partitioning** divides a table by range, list or hash. With a predicate on the key, the optimizer **prunes** partitions, so only some are read. It also makes loading, purging and maintenance operate on partitions instead of the whole table.',
 w:'It helps when queries filter on the partition key, and it adds licensing and design cost.',
 c:`SELECT partition_name, high_value, num_rows FROM dba_tab_partitions WHERE table_owner = 'HR' AND table_name = 'ORDERS';`,see:[6,2,'Partitioning for performance and pruning']}
]},

{h:'Instance, I/O and concurrency'},
{acc:[
{t:'SGA and PGA sizing',s:'Memory that fits the workload.',
 a:'The **SGA** holds the buffer cache, shared pool and redo buffer, and the **PGA** holds the work areas for sorts and hashes. Advisors (`V$SGA_TARGET_ADVICE`, `V$PGA_TARGET_ADVICE`) estimate the effect of changing the size. Too little memory means more physical I/O, parsing and temp spills.',
 w:'Size from the advisors and the evidence, not from a rule of thumb.',
 c:`SELECT sga_size, sga_size_factor, estd_db_time FROM v$sga_target_advice ORDER BY sga_size;`,see:[7,0,'Sizing the SGA and PGA with advisors']},
{t:'Parsing and the shared pool',s:'Parse once, run many times.',
 a:'A **hard parse** compiles a statement and uses the shared pool, and a **soft parse** reuses a cursor. Many hard parses cause library cache and shared pool contention. Bind variables, reasonable `CURSOR_SHARING` and session cursor caching reduce them.',
 w:'The parse rate and the hard parse ratio are in every AWR report load profile.',
 c:`SELECT name, value FROM v$sysstat WHERE name IN ('parse count (total)','parse count (hard)','execute count');`,see:[7,2,'Library cache, cursor sharing and hard parse control']},
{t:'Commit and redo',s:'The cost of making a change durable.',
 a:'A commit waits for **LGWR** to write the redo to disk (`log file sync`). Slow redo storage, very frequent commits and large redo volume all raise it. Batching commits and putting redo on fast storage are the fixes.',
 w:'If `log file sync` is high and `log file parallel write` is slow, the problem is the redo disk.',
 c:`SELECT event, total_waits, ROUND(time_waited_micro/NULLIF(total_waits,0)/1000,2) AS avg_ms FROM v$system_event WHERE event IN ('log file sync','log file parallel write');`,see:[7,3,'Redo, LGWR and commit performance']},
{t:'I/O: IOPS, throughput and latency',s:'Three different measures.',
 a:'**IOPS** is operations per second, **throughput** is MB per second, and **latency** is time per operation. OLTP cares about latency and IOPS, analytics about throughput. A system can be fine on one and saturated on another.',
 w:'Measure latency per file and per event. Averages across the whole system hide a single slow device.',
 c:`SELECT event, ROUND(time_waited_micro/NULLIF(total_waits,0)/1000,2) AS avg_ms FROM v$system_event WHERE event LIKE 'db file%read' OR event LIKE 'direct path read%';`,see:[8,0,'I/O basics: IOPS, throughput and latency']},
{t:'Locks and enqueues',s:'Sessions queuing for the same row.',
 a:'Oracle uses **row locks** (TX) held until commit or rollback, and table locks (TM) to protect them. A session waiting for a row held by another waits on `enq: TX - row lock contention`. Blocking is normally an application behaviour: a long transaction or a forgotten commit.',
 w:'Find the **root blocker** and ask what it is doing. Killing waiters does not help.',
 c:`SELECT blocking_session, sid, serial#, event, seconds_in_wait FROM v$session WHERE blocking_session IS NOT NULL;`,see:[9,0,'Locks and enqueues: TX, TM and UL']},
{t:'Resource Manager',s:'Protect important work from the rest.',
 a:'**Resource Manager** allocates CPU, I/O and parallel servers among consumer groups using plans. It can also cancel or throttle runaway sessions. In a CDB it shares resources among PDBs.',
 w:'It turns "reports slow down the order system" into a rule that the order system always gets its share.',
 c:`SELECT plan, group_or_subplan, mgmt_p1, mgmt_p2 FROM dba_rsrc_plan_directives WHERE plan = (SELECT name FROM v$rsrc_plan WHERE is_top_plan = 'TRUE');`,see:[7,6,'Using Resource Manager to protect workloads']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Five small maps of how the parts fit together: the tuning loop, the wait interface, what the optimizer uses, how AWR and ASH data is produced and the SQL tuning toolbox.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why a DBA cares, one query or command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. The tuning loop'},
{map:{title:'Tuning method map',h:328,trace:'Work one problem',
 hint:'Tap any box, or press Work one problem to follow the loop from a complaint to a verified fix.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L340 219 L340 246'],
 nodes:[
 {id:'sym',x:21,y:24,w:194,h:56,c:'warn',t:'Symptom',s:'what users report',d:'A complaint such as "the report is slow" or an alert such as high load.',why:'It tells you where to look, not what is wrong.',chk:`SELECT username, status, last_call_et FROM v$session WHERE status = 'ACTIVE' AND type = 'USER';`,see:[0,0,'A tuning methodology: measure, find the bottleneck, fix, verify']},
 {id:'scope',x:243,y:24,w:194,h:56,c:'mem',t:'Scope',s:'who, what, when',d:'Define the problem: which users, which statement, which time period, and what normal looked like.',why:'A problem you cannot scope cannot be measured.',chk:`SELECT module, COUNT(*) FROM v$session WHERE type = 'USER' GROUP BY module ORDER BY 2 DESC;`,see:[0,0,'A tuning methodology: measure, find the bottleneck, fix, verify']},
 {id:'tool',x:465,y:24,w:194,h:56,c:'proc',t:'Right tool',s:'V$, ASH, AWR',d:'Choose the tool that matches the time scale: V$ and ASH now, AWR for hours or days, SQL Monitor for one statement.',why:'A tool with the wrong time scale shows an average of nothing.',chk:`SELECT snap_id, begin_interval_time FROM dba_hist_snapshot ORDER BY snap_id DESC FETCH FIRST 3 ROWS ONLY;`,see:[0,3,'The tools map: AWR, ASH, ADDM, SQL Monitor and advisors']},
 {id:'find',x:21,y:136,w:194,h:56,c:'proc',t:'Find bottleneck',s:'top DB time',d:'Rank where DB time went: top events, then top SQL for the event.',why:'Take the biggest one first. The rest may disappear with it.',chk:`SELECT event, COUNT(*) FROM v$active_session_history WHERE sample_time > SYSDATE - 15/1440 GROUP BY event ORDER BY 2 DESC FETCH FIRST 5 ROWS ONLY;`,see:[0,1,'DB time, the time model and wait classes']},
 {id:'fix',x:243,y:136,w:194,h:56,c:'proc',t:'Change one thing',s:'smallest fix',d:'Choose the least invasive change that addresses the cause: statistics, an index, a baseline, a setting.',why:'One change at a time so the effect can be attributed.',chk:`EXEC DBMS_STATS.GATHER_TABLE_STATS('HR','EMPLOYEES');`,see:[5,0,'SQL Tuning Advisor and SQL profiles']},
 {id:'ver',x:465,y:136,w:194,h:56,c:'mem',t:'Verify',s:'same measurement',d:'Repeat the same measurement and compare with the first.',why:'If it did not help, undo it and try the next.',chk:`SELECT sql_id, executions, ROUND(elapsed_time/NULLIF(executions,0)/1000) AS ms FROM v$sql WHERE sql_id = '&sql_id';`,see:[0,0,'A tuning methodology: measure, find the bottleneck, fix, verify']},
 {id:'rec',x:240,y:248,w:200,h:56,c:'ext',t:'Record',s:'baseline and notes',d:'Write down the finding, the change and the before and after numbers, and keep a baseline.',why:'It is the evidence and the next person\'s starting point.',chk:`EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_BASELINE(100, 110, 'after_fix');`,see:[0,2,'Proactive vs reactive tuning and baselines']}],
 steps:[
 {ids:['sym','scope'],t:'1. A symptom arrives. Turn it into a scoped question: which statement or user, which time, and what was normal.',w:'The scope sets what you measure.',s:'Baselines, change records.',x:'A symptom with no time range makes AWR data useless.',c:`SELECT sql_id, module, event FROM v$session WHERE username = 'APP' AND status = 'ACTIVE';`},
 {ids:['tool'],t:'2. Pick the tool for the time scale: ASH for a live or recent problem, AWR for a period, SQL Monitor for one long statement.',w:'The right tool shows the bottleneck directly.',s:'Licensing of AWR and ASH.',x:'Reading a daily AWR report for a 3-minute spike averages it away.',c:`SELECT MIN(sample_time), MAX(sample_time) FROM v$active_session_history;`},
 {ids:['find'],t:'3. Find the biggest consumer of DB time. Note the wait class, the event and the SQL behind it.',w:'It is the part of the system worth your attention.',s:'Time model, top events.',x:'Chasing a small event because it looks unusual.',c:`SELECT sql_id, COUNT(*) FROM v$active_session_history WHERE sample_time > SYSDATE - 15/1440 GROUP BY sql_id ORDER BY 2 DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['fix'],t:'4. Make the smallest change that addresses the cause, and write down exactly what you changed.',w:'It keeps the change reversible.',s:'Change control, SQL profile, statistics, index.',x:'Several simultaneous changes cannot be separated afterwards.',c:`EXEC DBMS_STATS.GATHER_TABLE_STATS('HR','EMPLOYEES');`},
 {ids:['ver'],t:'5. Measure again in the same way and compare to the first measurement. Keep the change only if it improved things.',w:'You prove the effect.',s:'AWR compare, SQL Monitor.',x:'Judging success by "it feels faster".',c:`SELECT sql_id, plan_hash_value, executions FROM v$sql WHERE sql_id = '&sql_id';`},
 {ids:['rec'],t:'6. Record the finding and create a baseline. The next incident starts from a known good point.',w:'It turns one fix into institutional knowledge.',s:'AWR baselines, runbook.',x:'No record means the same investigation next quarter.',c:`SELECT baseline_name FROM dba_hist_baseline;`}]}},

{h:'2. Where a session\'s time goes'},
{map:{title:'Wait interface map',h:328,trace:'Classify a slow session',
 hint:'Tap any box, or press Classify a slow session to follow a session from a complaint to a cause.',
 lines:[[215,52,241,52],[215,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],[118,192,118,246],[340,192,340,246],[562,192,562,246]],
 nodes:[
 {id:'sess',x:21,y:24,w:194,h:56,c:'ext',t:'Session',s:'active call',d:'A session that is executing a call. Its time is either CPU or waiting.',why:'Idle sessions do not matter. Only active time counts.',chk:`SELECT sid, serial#, status, sql_id, event, state FROM v$session WHERE type = 'USER' AND status = 'ACTIVE';`,see:[1,1,'V$SESSION, V$SESSION_WAIT and V$ACTIVE_SESSION_HISTORY']},
 {id:'cpu',x:243,y:24,w:194,h:56,c:'proc',t:'On CPU',s:'doing work',d:'The session is running on a CPU: parsing, executing, reading cached blocks.',why:'High CPU points at SQL that does too much logical I/O, or at too little CPU.',chk:`SELECT stat_name, ROUND(value/1000000) AS s FROM v$sess_time_model WHERE sid = &sid;`,see:[0,1,'DB time, the time model and wait classes']},
 {id:'wait',x:465,y:24,w:194,h:56,c:'warn',t:'Waiting',s:'on an event',d:'The session is blocked on something: a disk read, a lock, a latch, a commit.',why:'The event name says what.',chk:`SELECT event, wait_class, seconds_in_wait FROM v$session WHERE sid = &sid;`,see:[1,0,'The wait interface: events, classes and statistics']},
 {id:'cls',x:21,y:136,w:194,h:56,c:'mem',t:'Wait class',s:'User I/O, Commit...',d:'The group an event belongs to: User I/O, System I/O, Commit, Concurrency, Application, Network and so on.',why:'The class gives the area, in one step.',chk:`SELECT wait_class, COUNT(*) FROM v$session WHERE wait_class <> 'Idle' GROUP BY wait_class;`,see:[1,0,'The wait interface: events, classes and statistics']},
 {id:'evt',x:243,y:136,w:194,h:56,c:'mem',t:'Event',s:'log file sync...',d:'The specific wait, such as db file sequential read or enq: TX - row lock contention.',why:'Each event has a typical cause and fix.',chk:`SELECT event, total_waits, time_waited_micro FROM v$system_event ORDER BY time_waited_micro DESC FETCH FIRST 5 ROWS ONLY;`,see:[1,3,'The most common waits and what they mean']},
 {id:'obj',x:465,y:136,w:194,h:56,c:'disk',t:'Object or SQL',s:'P1, P2, P3',d:'The parameters of the wait say which file, block, lock or latch. ASH adds the SQL and object.',why:'It turns "I/O wait" into "this index on this table".',chk:`SELECT sql_id, current_obj#, COUNT(*) FROM v$active_session_history WHERE event = 'db file sequential read' GROUP BY sql_id, current_obj# ORDER BY 3 DESC FETCH FIRST 5 ROWS ONLY;`,see:[2,2,'Active Session History and ASH reports']},
 {id:'vsess',x:21,y:248,w:194,h:56,c:'mem',t:'V$SESSION',s:'now',d:'The current state of every session, including the event it is on.',why:'Good for what is happening this second.',chk:`SELECT sid, event, state, wait_time, seconds_in_wait FROM v$session WHERE type = 'USER';`,see:[1,1,'V$SESSION, V$SESSION_WAIT and V$ACTIVE_SESSION_HISTORY']},
 {id:'vsys',x:243,y:248,w:194,h:56,c:'mem',t:'V$SYSTEM_EVENT',s:'since startup',d:'Cumulative waits for the whole instance since startup.',why:'Compare two readings to get a rate.',chk:`SELECT event, total_waits, time_waited_micro FROM v$system_event ORDER BY time_waited_micro DESC FETCH FIRST 5 ROWS ONLY;`,see:[1,2,'V$SYSSTAT, V$SYSTEM_EVENT and time model views']},
 {id:'ash',x:465,y:248,w:194,h:56,c:'disk',t:'ASH',s:'sampled history',d:'One sample per second per active session, with SQL, event and object.',why:'The best view of short problems.',chk:`SELECT sample_time, sql_id, event FROM v$active_session_history ORDER BY sample_time DESC FETCH FIRST 5 ROWS ONLY;`,see:[2,2,'Active Session History and ASH reports']}],
 steps:[
 {ids:['sess'],t:'1. Look at sessions that are active. Idle sessions do not consume DB time.',w:'It reduces the set to those that matter.',s:'`V$SESSION.STATUS`, `LAST_CALL_ET`.',x:'Counting idle sessions as load gives the wrong picture.',c:`SELECT COUNT(*) FROM v$session WHERE type = 'USER' AND status = 'ACTIVE';`},
 {ids:['cpu','wait'],t:'2. For each active session decide: on CPU or waiting. The state column and the time model say which.',w:'The remedy differs completely.',s:'`V$SESSION.STATE`, `V$SESS_TIME_MODEL`.',x:'A CPU-bound system is not fixed by faster disks.',c:`SELECT state, COUNT(*) FROM v$session WHERE status = 'ACTIVE' AND type = 'USER' GROUP BY state;`},
 {ids:['cls','evt'],t:'3. For waiters, find the class and then the event. Rank them by total time, not by count.',w:'The event name tells you the area to look at.',s:'`V$SYSTEM_EVENT`, `V$EVENT_NAME`.',x:'A frequent short wait can matter less than a rare long one.',c:`SELECT wait_class, ROUND(SUM(time_waited_micro)/1000000) AS s FROM v$system_event WHERE wait_class <> 'Idle' GROUP BY wait_class ORDER BY 2 DESC;`},
 {ids:['evt','obj'],t:'4. Use the wait parameters and ASH to learn which object, SQL or lock is involved.',w:'It points to the specific table, index or statement.',s:'`P1`, `P2`, `P3`, `CURRENT_OBJ#`.',x:'Parameters mean different things for each event. Check the event definition.',c:`SELECT event, p1text, p1, p2text, p2 FROM v$session WHERE sid = &sid;`},
 {ids:['vsess','vsys','ash'],t:'5. Choose the view for the time scale: V$SESSION for now, V$SYSTEM_EVENT for totals, ASH for the recent past.',w:'Each answers a different question.',s:'AWR for history older than ASH memory.',x:'Using cumulative totals for a new problem is dominated by history.',c:`SELECT MIN(sample_time) FROM v$active_session_history;`}]}},

{h:'3. What the optimizer uses to choose a plan'},
{map:{title:'Optimizer inputs map',h:328,trace:'Why did it choose this plan?',
 hint:'Tap any box, or press Why did it choose this plan? to follow a statement through the optimizer.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L118 219 L118 246',[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'sql',x:21,y:24,w:194,h:56,c:'ext',t:'SQL text',s:'what you wrote',d:'The statement as submitted: tables, predicates, joins, hints.',why:'Two texts that differ in a space or literal are different cursors.',chk:`SELECT sql_id, sql_text FROM v$sql WHERE sql_id = '&sql_id';`,see:[3,0,'How the cost-based optimizer works']},
 {id:'parse',x:243,y:24,w:194,h:56,c:'proc',t:'Parse',s:'syntax and names',d:'Checks syntax, resolves object names and privileges, and rewrites the query (views, subqueries).',why:'Errors such as ORA-00942 come from here.',chk:`SELECT parse_calls, loads, invalidations FROM v$sqlarea WHERE sql_id = '&sql_id';`,see:[3,0,'How the cost-based optimizer works']},
 {id:'cur',x:465,y:24,w:194,h:56,c:'mem',t:'Cursor cache',s:'reuse or build',d:'Looks for an existing cursor in the library cache. If found it is reused (soft parse).',why:'A hit avoids optimization altogether.',chk:`SELECT sql_id, child_number, plan_hash_value, executions FROM v$sql WHERE sql_id = '&sql_id';`,see:[7,2,'Library cache, cursor sharing and hard parse control']},
 {id:'stat',x:21,y:136,w:194,h:56,c:'disk',t:'Statistics',s:'tables, columns, indexes',d:'Row counts, distinct values, histograms and index statistics used for cardinality estimates.',why:'Wrong statistics mean wrong estimates and a wrong plan.',chk:`SELECT table_name, num_rows, last_analyzed FROM dba_tables WHERE owner = 'HR';`,see:[3,1,'Optimizer statistics: tables, indexes and columns']},
 {id:'bind',x:243,y:136,w:194,h:56,c:'mem',t:'Bind values',s:'peeked at parse',d:'The values of bind variables at the first hard parse, used for estimation.',why:'Skewed data makes the first value decide the plan, unless cursor sharing adapts.',chk:`SELECT name, value_string FROM v$sql_bind_capture WHERE sql_id = '&sql_id';`,see:[4,6,'Bind variables, peeking and adaptive cursor sharing']},
 {id:'env',x:465,y:136,w:194,h:56,c:'mem',t:'Environment',s:'parameters and system stats',d:'Optimizer parameters, system statistics and session settings that change costs.',why:'A changed parameter can change many plans at once.',chk:`SELECT name, value FROM v$sys_optimizer_env WHERE name IN ('optimizer_mode','optimizer_features_enable');`,see:[3,5,'System statistics and optimizer environment parameters']},
 {id:'opt',x:21,y:248,w:194,h:56,c:'proc',t:'Optimizer',s:'chooses lowest cost',d:'Generates candidate plans and estimates a cost for each using the inputs above. It picks the lowest.',why:'It is a cost model, not a measurement.',chk:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id'));`,see:[3,0,'How the cost-based optimizer works']},
 {id:'plan',x:243,y:248,w:194,h:56,c:'mem',t:'Plan',s:'the chosen steps',d:'The tree of operations that will run, stored in the cursor.',why:'This is the thing you read and tune.',chk:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id', NULL, 'ALLSTATS LAST'));`,see:[4,0,'Reading execution plans with EXPLAIN PLAN and DBMS_XPLAN']},
 {id:'run',x:465,y:248,w:194,h:56,c:'proc',t:'Execute',s:'actual rows',d:'The plan runs. The actual row counts and times can be compared with the estimates.',why:'A big difference is the clue to the cause.',chk:`SELECT operation_id, operation, starts, output_rows, elapsed_time FROM v$sql_plan_statistics_all WHERE sql_id = '&sql_id' ORDER BY id;`,see:[4,4,'Real-Time SQL Monitoring']}],
 steps:[
 {ids:['sql','parse'],t:'1. The statement arrives. It is parsed, names are resolved and privileges are checked.',w:'Nothing is optimized yet.',s:'Schema, privileges.',x:'Differences in literals produce separate cursors.',c:`SELECT COUNT(*) FROM v$sql WHERE sql_text LIKE 'SELECT * FROM orders WHERE id =%';`},
 {ids:['parse','cur'],t:'2. The library cache is searched. A matching cursor is reused, otherwise the statement is hard parsed.',w:'Reuse is the cheap path.',s:'`CURSOR_SHARING`, bind variables, shared pool size.',x:'Thousands of literals fill the pool and cause mutex waits.',c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'parse count%';`},
 {ids:['stat','bind','env'],t:'3. For a hard parse the optimizer gathers its inputs: statistics, peeked bind values and the optimizer environment.',w:'These three decide the estimates.',s:'`DBMS_STATS`, `OPTIMIZER_*` parameters.',x:'Stale statistics, or a value that is not typical, leads the plan astray.',c:`SELECT table_name, stale_stats FROM dba_tab_statistics WHERE owner = 'HR';`},
 {ids:['opt','plan'],t:'4. The optimizer builds candidate plans, costs them and keeps the cheapest. The plan is stored with the cursor.',w:'This is a search under uncertainty, so errors are normal.',s:'Optimizer parameters and features.',x:'The cheapest estimated plan may be far from the cheapest real one.',c:`SELECT plan_hash_value, optimizer_cost FROM v$sql WHERE sql_id = '&sql_id';`},
 {ids:['run'],t:'5. The plan executes. Comparing estimated rows with actual rows at each step shows where the optimizer was wrong.',w:'That step is where to concentrate.',s:'`GATHER_PLAN_STATISTICS`, SQL Monitor.',x:'A mis-estimate early in a join tree is multiplied through the later steps.',c:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id', NULL, 'ALLSTATS LAST'));`}]}},

{h:'4. How AWR, ASH and ADDM data is produced'},
{map:{title:'AWR data flow map',h:328,trace:'From a session to a report',
 hint:'Tap any box, or press From a session to a report to see how performance data becomes something you can read.',
 lines:[[215,52,241,52],[215,52,463,52],'M340 80 L340 107 L118 107 L118 134',[215,164,241,164],[562,80,562,134],'M340 192 L340 219 L118 219 L118 246',[340,192,340,246],[437,276,463,276]],
 nodes:[
 {id:'sess',x:21,y:24,w:194,h:56,c:'ext',t:'Sessions',s:'do the work',d:'User sessions and background processes execute and wait, updating counters as they go.',why:'Every statistic starts here.',chk:`SELECT COUNT(*) FROM v$session;`,see:[0,1,'DB time, the time model and wait classes']},
 {id:'sga',x:243,y:24,w:194,h:56,c:'mem',t:'V$ views in SGA',s:'cumulative counters',d:'Counters and wait totals held in memory since startup, such as V$SYSSTAT and V$SQL.',why:'They are the raw material of AWR, and they reset on restart.',chk:`SELECT name, value FROM v$sysstat WHERE name = 'user commits';`,see:[1,2,'V$SYSSTAT, V$SYSTEM_EVENT and time model views']},
 {id:'ashm',x:465,y:24,w:194,h:56,c:'mem',t:'ASH buffer',s:'one sample per second',d:'Active sessions are sampled each second into a circular buffer in the SGA.',why:'It gives a short-term view that aggregates cannot.',chk:`SELECT COUNT(*) FROM v$active_session_history;`,see:[2,2,'Active Session History and ASH reports']},
 {id:'mmon',x:21,y:136,w:194,h:56,c:'proc',t:'MMON',s:'snapshot job',d:'The manageability monitor takes a snapshot of the counters every hour and writes it to AWR.',why:'It is the process that must run for AWR to have data.',chk:`SELECT snap_interval, retention FROM dba_hist_wr_control;`,see:[2,0,'Automatic Workload Repository: snapshots and retention']},
 {id:'snap',x:243,y:136,w:194,h:56,c:'disk',t:'AWR in SYSAUX',s:'DBA_HIST_*',d:'The snapshots are stored in tables in SYSAUX and kept for the retention period.',why:'This is why AWR can be a space consumer.',chk:`SELECT COUNT(*) FROM dba_hist_snapshot;`,see:[2,0,'Automatic Workload Repository: snapshots and retention']},
 {id:'ashd',x:465,y:136,w:194,h:56,c:'disk',t:'ASH on disk',s:'sampled subset',d:'A subset of the ASH samples is written into AWR with the snapshots.',why:'It gives history beyond the memory buffer.',chk:`SELECT COUNT(*) FROM dba_hist_active_sess_history;`,see:[2,2,'Active Session History and ASH reports']},
 {id:'addm',x:21,y:248,w:194,h:56,c:'mem',t:'ADDM',s:'findings',d:'After each snapshot ADDM analyses the period and records findings and recommendations.',why:'A fast first read of every hour.',chk:`SELECT task_name, status FROM dba_advisor_tasks WHERE advisor_name = 'ADDM' ORDER BY created DESC FETCH FIRST 3 ROWS ONLY;`,see:[2,3,'ADDM: findings, recommendations and reports']},
 {id:'rep',x:243,y:248,w:194,h:56,c:'ext',t:'AWR report',s:'between snapshots',d:'The difference between two snapshots, formatted as load profile, top events, SQL and more.',why:'Choose a short interval around the problem.',chk:`@?/rdbms/admin/awrrpt.sql`,see:[2,1,'Generating and reading AWR reports']},
 {id:'base',x:465,y:248,w:194,h:56,c:'disk',t:'Baselines',s:'kept snapshots',d:'Sets of snapshots marked to be kept beyond retention, for comparison.',why:'They are your "normal".',chk:`SELECT baseline_name, start_snap_id, end_snap_id FROM dba_hist_baseline;`,see:[2,4,'AWR baselines, moving windows and thresholds']}],
 steps:[
 {ids:['sess','sga'],t:'1. Sessions run and the instance updates cumulative counters: statistics, wait totals and per-SQL statistics.',w:'It is automatic and cheap.',s:'`STATISTICS_LEVEL`.',x:'Setting STATISTICS_LEVEL to BASIC disables most of this.',c:`SHOW PARAMETER statistics_level`},
 {ids:['sess','ashm'],t:'2. Once per second the ASH sampler records each active session with its SQL, event and object.',w:'It is a statistical film of the instance.',s:'`_ash_*` (internal), SGA memory.',x:'ASH covers only active sessions, so idle waits are absent.',c:`SELECT MIN(sample_time) FROM v$active_session_history;`},
 {ids:['mmon','snap'],t:'3. MMON takes a snapshot every hour and writes the counters into the AWR tables in SYSAUX.',w:'The snapshots make history possible.',s:'`DBMS_WORKLOAD_REPOSITORY.MODIFY_SNAPSHOT_SETTINGS`.',x:'Snapshots can be missed if MMON is stuck or SYSAUX is full.',c:`SELECT MAX(end_interval_time) FROM dba_hist_snapshot;`},
 {ids:['snap','ashd'],t:'4. With each snapshot a sample of the ASH data is saved with it, so history has detail.',w:'It keeps the film long enough to look back.',s:'AWR retention, ASH flush rate.',x:'Short retention loses history before the question arrives.',c:`SELECT MIN(sample_time) FROM dba_hist_active_sess_history;`},
 {ids:['addm','rep'],t:'5. ADDM analyses each interval, and you generate AWR reports for the periods you care about.',w:'Two automatic and one manual reading of the same data.',s:'`awrrpt.sql`, `awrddrpt.sql`.',x:'A report over 24 hours smooths away the problem.',c:`@?/rdbms/admin/awrrpt.sql`},
 {ids:['base'],t:'6. Baselines protect good periods from being purged, so there is always something to compare against.',w:'It is the reference for regressions.',s:'`CREATE_BASELINE`, moving window.',x:'No baseline taken in good times means no reference in bad ones.',c:`EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_BASELINE(100, 110, 'month_end');`}]}},

{h:'5. Choosing a SQL fix'},
{map:{title:'SQL tuning toolbox map',h:328,trace:'Choose the least invasive fix',
 hint:'Tap any box, or press Choose the least invasive fix to see the order in which to try the options.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L118 219 L118 246',[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'plan',x:21,y:24,w:194,h:56,c:'warn',t:'Bad plan',s:'the problem',d:'A statement is slow or unstable because of its plan.',why:'First establish it is the plan, and not the data volume or contention.',chk:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id', NULL, 'ALLSTATS LAST'));`,see:[4,0,'Reading execution plans with EXPLAIN PLAN and DBMS_XPLAN']},
 {id:'stats',x:243,y:24,w:194,h:56,c:'proc',t:'Fix statistics',s:'first try',d:'Gather statistics, add a histogram or extended statistics, or restore earlier statistics.',why:'It repairs the cause, benefits every statement and needs no code change.',chk:`EXEC DBMS_STATS.GATHER_TABLE_STATS('HR','EMPLOYEES', method_opt => 'FOR ALL COLUMNS SIZE AUTO');`,see:[3,2,'Gathering statistics with DBMS_STATS and automatic jobs']},
 {id:'adv',x:465,y:24,w:194,h:56,c:'proc',t:'Tuning advisor',s:'profile',d:'The SQL Tuning Advisor analyses the statement and may offer a SQL profile or an index.',why:'A profile fixes one statement without code change. Needs the Tuning Pack.',chk:`SELECT * FROM TABLE(DBMS_SQLTUNE.REPORT_TUNING_TASK('&task_name'));`,see:[5,0,'SQL Tuning Advisor and SQL profiles']},
 {id:'idx',x:21,y:136,w:194,h:56,c:'proc',t:'Index or structure',s:'access path',d:'Add or change an index, partitioning or materialized view so a good access path exists.',why:'It helps everyone, and costs space and write time.',chk:`CREATE INDEX hr.emp_dept_ix ON hr.employees(department_id) INVISIBLE;`,see:[6,0,'Choosing indexes: B-tree, bitmap, function-based and composite']},
 {id:'spm',x:243,y:136,w:194,h:56,c:'proc',t:'SQL baseline',s:'lock a good plan',d:'Load the good plan into a SQL plan baseline, so the optimizer uses only accepted plans.',why:'It prevents regressions, with no code change.',chk:`EXEC DBMS_SPM.LOAD_PLANS_FROM_CURSOR_CACHE(sql_id => '&sql_id');`,see:[5,2,'SQL Plan Management: baselines and evolution']},
 {id:'hint',x:465,y:136,w:194,h:56,c:'proc',t:'Hint',s:'in the code',d:'Add a hint to the statement to force an access path or join.',why:'It needs a code change and can become wrong as data grows.',chk:`SELECT /*+ INDEX(e emp_dept_ix) */ * FROM hr.employees e WHERE department_id = 50;`,see:[5,3,'Hints: when to use them and why']},
 {id:'patch',x:21,y:248,w:194,h:56,c:'proc',t:'SQL patch',s:'hint without code',d:'Attach a hint to a statement from outside, when the code cannot be changed.',why:'It is the escape for packaged applications.',chk:`SELECT DBMS_SQLDIAG.CREATE_SQL_PATCH(sql_id => '&sql_id', hint_text => 'NO_PARALLEL') FROM dual;`,see:[5,5,'SQL patches and SQL quarantine']},
 {id:'quar',x:243,y:248,w:194,h:56,c:'warn',t:'Quarantine',s:'stop a runaway',d:'Prevent a statement from running again once it exceeded a resource limit.',why:'A damage limiter, not a fix.',chk:`SELECT name, sql_text FROM dba_sql_quarantine;`,see:[5,5,'SQL patches and SQL quarantine']},
 {id:'code',x:465,y:248,w:194,h:56,c:'ext',t:'Change the SQL',s:'rewrite',d:'Rewrite the statement or the application logic.',why:'Often the biggest gain, and the slowest to deliver.',chk:`SELECT sql_id, executions FROM v$sql WHERE sql_id = '&sql_id';`,see:[4,7,'Practical: Diagnose five slow queries']}],
 steps:[
 {ids:['plan'],t:'1. Confirm that the plan is the problem: compare estimated with actual rows, and check that waits are not elsewhere.',w:'Do not tune a plan if the time goes to locks.',s:'Plan statistics, ASH.',x:'Tuning a statement that is only slow because it was blocked.',c:`SELECT event, COUNT(*) FROM v$active_session_history WHERE sql_id = '&sql_id' GROUP BY event;`},
 {ids:['stats'],t:'2. Fix the inputs: statistics, histograms and extended statistics. This repairs the estimate for all statements that use the tables.',w:'It is the cleanest cure.',s:'`DBMS_STATS`, `METHOD_OPT`, extended statistics.',x:'Gathering statistics on a hot table in peak hours has its own cost.',c:`EXEC DBMS_STATS.GATHER_TABLE_STATS('HR','EMPLOYEES');`},
 {ids:['adv','idx'],t:'3. If statistics are good, let the advisor suggest a profile or an index, or design the access structure yourself.',w:'You add a capability the optimizer can use.',s:'Tuning Pack, index design.',x:'An index that is created and never used still slows every write.',c:`SELECT index_name, visibility FROM dba_indexes WHERE owner = 'HR';`},
 {ids:['spm'],t:'4. Lock in a known good plan with a SQL plan baseline so it cannot regress silently.',w:'Stability without touching code.',s:'`DBMS_SPM`, `OPTIMIZER_CAPTURE_SQL_PLAN_BASELINES`.',x:'A fixed baseline plan that is no longer good will still be used.',c:`SELECT sql_handle, plan_name, accepted FROM dba_sql_plan_baselines;`},
 {ids:['hint','patch'],t:'5. If the code cannot change, a SQL patch carries the hint from outside. If it can, a hint in the code is possible.',w:'Targeted, but it must be maintained.',s:'`DBMS_SQLDIAG.CREATE_SQL_PATCH`.',x:'Hints survive after the data has changed and then hurt.',c:`SELECT name, status FROM dba_sql_patches;`},
 {ids:['quar','code'],t:'6. For a runaway, quarantine it while you fix the cause, and rewrite the statement when the fix is a design change.',w:'It protects production first.',s:'`DBMS_SQLQ`, resource limits.',x:'Leaving a quarantine in place forever hides the fault.',c:`SELECT name, status FROM dba_sql_quarantine;`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Seven small maps of how something happens, step by step: a slow database, a slow statement, a statistics fix, plan stabilisation, a blocking chain, a hang and an AWR comparison.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Diagnosing a slow database right now'},
{map:{title:'Slow database map',h:216,trace:'Find out what it is doing',
 hint:'Tap any box, or press Find out what it is doing to follow a live diagnosis from load to the first fix.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'load',x:21,y:24,w:194,h:56,c:'mem',t:'Load and CPU',s:'is it busy?',d:'Check OS load, CPU and the number of active sessions against the CPU count.',why:'It tells you whether this is CPU-bound or waiting.',chk:`SELECT metric_name, ROUND(value,1) FROM v$sysmetric WHERE metric_name IN ('Average Active Sessions','Host CPU Utilization (%)') AND group_id = 2;`,see:[1,5,'Practical: Find what a slow database is waiting on']},
 {id:'cls',x:243,y:24,w:194,h:56,c:'mem',t:'Top wait class',s:'ASH, last 15 min',d:'Group recent ASH samples by wait class, and compare CPU with waiting.',why:'It tells you which area to explore.',chk:`SELECT NVL(wait_class,'ON CPU') AS cls, COUNT(*) FROM v$active_session_history WHERE sample_time > SYSDATE - 15/1440 GROUP BY wait_class ORDER BY 2 DESC;`,see:[1,1,'V$SESSION, V$SESSION_WAIT and V$ACTIVE_SESSION_HISTORY']},
 {id:'evt',x:465,y:24,w:194,h:56,c:'mem',t:'Top event',s:'inside the class',d:'Within the dominant class, find the dominant event.',why:'It points to the mechanism.',chk:`SELECT event, COUNT(*) FROM v$active_session_history WHERE sample_time > SYSDATE - 15/1440 GROUP BY event ORDER BY 2 DESC FETCH FIRST 5 ROWS ONLY;`,see:[1,3,'The most common waits and what they mean']},
 {id:'sql',x:21,y:136,w:194,h:56,c:'proc',t:'Top SQL',s:'for that event',d:'Find the statements that account for the event.',why:'This is what you can change.',chk:`SELECT sql_id, COUNT(*) FROM v$active_session_history WHERE event = '&event' AND sample_time > SYSDATE - 15/1440 GROUP BY sql_id ORDER BY 2 DESC FETCH FIRST 5 ROWS ONLY;`,see:[1,4,'V$SQL, V$SQLAREA and finding expensive SQL']},
 {id:'why',x:243,y:136,w:194,h:56,c:'proc',t:'Why',s:'plan, data or lock',d:'Look at the plan and actual rows, the data volume, or the blocker.',why:'It decides the type of fix.',chk:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id', NULL, 'ALLSTATS LAST'));`,see:[4,0,'Reading execution plans with EXPLAIN PLAN and DBMS_XPLAN']},
 {id:'act',x:465,y:136,w:194,h:56,c:'warn',t:'Act',s:'smallest change',d:'Apply the smallest effective change, or relieve the pressure (kill a runaway, add a limit).',why:'In an emergency stabilise first, then investigate.',chk:`ALTER SYSTEM KILL SESSION '&sid,&serial#' IMMEDIATE;`,see:[10,3,'Building a performance runbook']}],
 steps:[
 {ids:['load'],t:'1. Check how busy the instance is: average active sessions against CPU count, and host CPU.',w:'AAS above the CPU count means queuing.',s:'`V$SYSMETRIC`, OS tools.',x:'Looking at CPU alone misses waits for I/O or locks.',c:`SELECT value FROM v$osstat WHERE stat_name = 'NUM_CPUS';`},
 {ids:['cls'],t:'2. Group the last 15 minutes of ASH by wait class, including CPU as its own bucket.',w:'The biggest bucket is the area to look at.',s:'ASH retention.',x:'A narrow window can miss the start of the problem.',c:`SELECT NVL(wait_class,'ON CPU'), COUNT(*) FROM v$active_session_history WHERE sample_time > SYSDATE - 15/1440 GROUP BY wait_class ORDER BY 2 DESC;`},
 {ids:['evt','sql'],t:'3. In the top class find the top event, then the SQL and objects that cause it.',w:'This narrows from a symptom to a statement.',s:'ASH columns `SQL_ID`, `CURRENT_OBJ#`.',x:'A SQL ID that is null in ASH is a background or recursive call.',c:`SELECT sql_id, event, COUNT(*) FROM v$active_session_history WHERE sample_time > SYSDATE - 15/1440 GROUP BY sql_id, event ORDER BY 3 DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['why'],t:'4. Examine the statement: plan against actual rows, a recent change, or a blocker.',w:'You find the actual cause, not just the symptom.',s:'DBMS_XPLAN, SQL Monitor.',x:'Assuming the plan is at fault when the session is blocked.',c:`SELECT sql_id, plan_hash_value, executions FROM v$sql WHERE sql_id = '&sql_id';`},
 {ids:['act'],t:'5. Act: fix the cause if you can, or relieve the pressure for now. Measure again afterwards.',w:'The system recovers and you have the evidence.',s:'Change control, Resource Manager.',x:'Killing sessions without understanding them only hides the problem.',c:`SELECT COUNT(*) FROM v$session WHERE status = 'ACTIVE' AND type = 'USER';`}]}},

{h:'2. Diagnosing one slow SQL statement'},
{map:{title:'Slow SQL map',h:216,trace:'Find out why one statement is slow',
 hint:'Tap any box, or press Find out why one statement is slow to follow a statement from its ID to a verified fix.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'id',x:20,y:24,w:139,h:56,c:'ext',t:'Identify',s:'SQL_ID',d:'Find the SQL_ID from the application, ASH or V$SQL.',why:'Everything else hangs from this.',chk:`SELECT sql_id, plan_hash_value, executions FROM v$sql WHERE sql_text LIKE '%orders%' FETCH FIRST 5 ROWS ONLY;`,see:[1,4,'V$SQL, V$SQLAREA and finding expensive SQL']},
 {id:'plan',x:187,y:24,w:139,h:56,c:'mem',t:'Get the plan',s:'with actual rows',d:'Run it with GATHER_PLAN_STATISTICS or use SQL Monitor, and display ALLSTATS LAST.',why:'Actual rows are the evidence.',chk:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id', NULL, 'ALLSTATS LAST'));`,see:[4,0,'Reading execution plans with EXPLAIN PLAN and DBMS_XPLAN']},
 {id:'est',x:354,y:24,w:139,h:56,c:'mem',t:'Compare E and A',s:'estimate vs actual',d:'Find the first step where actual rows differ greatly from the estimate.',why:'It is where the optimizer was misled.',chk:`SELECT id, operation, cardinality, last_output_rows FROM v$sql_plan_statistics_all WHERE sql_id = '&sql_id';`,see:[4,0,'Reading execution plans with EXPLAIN PLAN and DBMS_XPLAN']},
 {id:'time',x:521,y:24,w:139,h:56,c:'mem',t:'Where is the time',s:'which step',d:'Find the steps with the most time or buffers.',why:'A correct estimate can still be slow because of volume.',chk:`SELECT id, operation, last_elapsed_time, last_cr_buffer_gets FROM v$sql_plan_statistics_all WHERE sql_id = '&sql_id' ORDER BY last_elapsed_time DESC;`,see:[4,4,'Real-Time SQL Monitoring']},
 {id:'cause',x:21,y:136,w:194,h:56,c:'proc',t:'Cause',s:'stats, binds, structure',d:'Missing or stale statistics, skew, correlated columns, binds, a missing index, or a poor query.',why:'Each leads to a different fix.',chk:`SELECT column_name, num_distinct, histogram FROM dba_tab_col_statistics WHERE table_name = '&table';`,see:[3,3,'Histograms and extended statistics']},
 {id:'fix',x:243,y:136,w:194,h:56,c:'proc',t:'Fix',s:'smallest change',d:'Statistics, an extended statistic, an index, a baseline, or a rewrite.',why:'Choose the least invasive effective change.',chk:`EXEC DBMS_STATS.GATHER_TABLE_STATS('APP','ORDERS', method_opt => 'FOR ALL COLUMNS SIZE AUTO');`,see:[5,0,'SQL Tuning Advisor and SQL profiles']},
 {id:'chk',x:465,y:136,w:194,h:56,c:'mem',t:'Verify',s:'same test',d:'Run it again and compare time, buffers and plan hash.',why:'It confirms the fix and shows the effect size.',chk:`SELECT sql_id, child_number, plan_hash_value, elapsed_time/executions FROM v$sql WHERE sql_id = '&sql_id';`,see:[4,7,'Practical: Diagnose five slow queries']}],
 steps:[
 {ids:['id','plan'],t:'1. Find the SQL_ID and display the plan with actual row counts and buffers.',w:'You need measurements, not the text of the query.',s:'`GATHER_PLAN_STATISTICS`, `STATISTICS_LEVEL`.',x:'EXPLAIN PLAN shows an estimate, which may differ from what ran.',c:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id', NULL, 'ALLSTATS LAST'));`},
 {ids:['est'],t:'2. Compare estimated and actual rows step by step. The first big difference is the root of the error.',w:'Later errors are usually consequences of it.',s:'Statistics, histograms.',x:'Starting at the last step instead of the first mismatch.',c:`SELECT id, operation, cardinality, last_output_rows FROM v$sql_plan_statistics_all WHERE sql_id = '&sql_id' ORDER BY id;`},
 {ids:['time'],t:'3. Find the step with the most elapsed time or buffer gets and check whether it is a full scan, a hash join or a nested loop.',w:'It shows where the work really is.',s:'Access paths, joins.',x:'A fast step executed a million times can dominate.',c:`SELECT id, operation, starts, last_cr_buffer_gets FROM v$sql_plan_statistics_all WHERE sql_id = '&sql_id' ORDER BY last_cr_buffer_gets DESC;`},
 {ids:['cause'],t:'4. Decide the cause: stale statistics, skew, correlated predicates, a missing index, bind peeking or the query itself.',w:'The cause picks the fix.',s:'Column statistics, bind capture.',x:'Applying a hint without knowing why the estimate is wrong.',c:`SELECT name, value_string FROM v$sql_bind_capture WHERE sql_id = '&sql_id';`},
 {ids:['fix'],t:'5. Apply the smallest change that corrects the cause, ideally statistics.',w:'A cause-based fix lasts.',s:'`DBMS_STATS`, extended statistics, index.',x:'A new index benefits one query and slows many writes.',c:`EXEC DBMS_STATS.CREATE_EXTENDED_STATS('APP','ORDERS','(CUSTOMER_ID, STATUS)');`},
 {ids:['chk'],t:'6. Run the statement again and compare plan, time and buffers with the first run. Record the result.',w:'It shows the improvement and guards against regression.',s:'AWR, SQL Monitor.',x:'Cached blocks can make a second run look faster than it is.',c:`SELECT plan_hash_value, executions, buffer_gets/executions FROM v$sql WHERE sql_id = '&sql_id';`}]}},

{h:'3. Fixing a plan with better statistics'},
{map:{title:'Statistics fix map',h:216,trace:'Repair the estimate',
 hint:'Tap any box, or press Repair the estimate to follow a change from a bad plan to a stable good one.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'bad',x:20,y:24,w:139,h:56,c:'warn',t:'Bad plan',s:'wrong estimate',d:'A plan whose estimated rows are far from actual.',why:'The plan follows the estimate.',chk:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id', NULL, 'ALLSTATS LAST'));`,see:[3,6,'Practical: Fix a bad plan with better statistics']},
 {id:'stale',x:187,y:24,w:139,h:56,c:'mem',t:'Stale?',s:'last gathered',d:'Check whether statistics are old or missing for the tables and partitions involved.',why:'A large data change after the gather is the common cause.',chk:`SELECT table_name, num_rows, last_analyzed, stale_stats FROM dba_tab_statistics WHERE owner = 'APP';`,see:[3,1,'Optimizer statistics: tables, indexes and columns']},
 {id:'hist',x:354,y:24,w:139,h:56,c:'mem',t:'Skew?',s:'histogram',d:'Check if the column is skewed and has no histogram.',why:'Without it, every value looks equally likely.',chk:`SELECT column_name, num_distinct, histogram, num_buckets FROM dba_tab_col_statistics WHERE table_name = '&table';`,see:[3,3,'Histograms and extended statistics']},
 {id:'ext',x:521,y:24,w:139,h:56,c:'mem',t:'Correlated?',s:'extended statistics',d:'Check for predicates on related columns (city and country) that are estimated as independent.',why:'The estimate is the product of two selectivities.',chk:`SELECT DBMS_STATS.CREATE_EXTENDED_STATS('APP','CUSTOMERS','(CITY, COUNTRY)') FROM dual;`,see:[3,3,'Histograms and extended statistics']},
 {id:'gath',x:21,y:136,w:194,h:56,c:'proc',t:'Gather',s:'in a controlled way',d:'Gather statistics for the table with the right options, ideally as pending first.',why:'Gathering is the change, so treat it like one.',chk:`EXEC DBMS_STATS.GATHER_TABLE_STATS('APP','ORDERS', method_opt => 'FOR ALL COLUMNS SIZE AUTO', no_invalidate => FALSE);`,see:[3,2,'Gathering statistics with DBMS_STATS and automatic jobs']},
 {id:'comp',x:243,y:136,w:194,h:56,c:'mem',t:'Compare',s:'before and after',d:'Run the statement and compare the plan and times with the earlier run.',why:'It confirms the estimate was the cause.',chk:`SELECT sql_id, plan_hash_value, elapsed_time/NULLIF(executions,0) FROM v$sql WHERE sql_id = '&sql_id';`,see:[3,4,'Pending, locked and restored statistics']},
 {id:'lock',x:465,y:136,w:194,h:56,c:'proc',t:'Protect',s:'lock or baseline',d:'If the result is good, lock the statistics, or add a baseline, so they do not drift.',why:'It stops the next automatic gather from undoing it.',chk:`EXEC DBMS_STATS.LOCK_TABLE_STATS('APP','ORDERS');`,see:[3,4,'Pending, locked and restored statistics']}],
 steps:[
 {ids:['bad','stale'],t:'1. Compare estimated and actual rows in the plan, then check how old the statistics are.',w:'It points straight at the statistics.',s:'`DBA_TAB_STATISTICS`, `DBA_TAB_MODIFICATIONS`.',x:'Stale statistics are detected only after modifications are flushed.',c:`SELECT table_name, inserts, updates, deletes FROM dba_tab_modifications WHERE table_owner = 'APP';`},
 {ids:['hist','ext'],t:'2. Check for skew (no histogram) and for correlated columns (no extended statistics) on the filter columns.',w:'These are the two classic estimate errors.',s:'`METHOD_OPT`, extended statistics.',x:'Adding histograms to every column grows parse time and cost.',c:`SELECT column_name, histogram FROM dba_tab_col_statistics WHERE table_name = '&table';`},
 {ids:['gath'],t:'3. Gather statistics with the right options. Test them as pending statistics first, if the table is critical.',w:'You can check the result without exposing everyone.',s:'`PUBLISH => FALSE`, `OPTIMIZER_USE_PENDING_STATISTICS`.',x:'A gather that invalidates cursors in peak time causes a parse storm.',c:`EXEC DBMS_STATS.SET_TABLE_PREFS('APP','ORDERS','PUBLISH','FALSE');`},
 {ids:['comp'],t:'4. Run the statement with the new statistics and compare the plan, rows and time with before.',w:'It is a test of the hypothesis.',s:'Pending statistics session setting.',x:'Comparing different data (a second run after caching).',c:`ALTER SESSION SET optimizer_use_pending_statistics = TRUE;`},
 {ids:['lock'],t:'5. If better, publish the statistics, and consider locking them or adding a SQL baseline so they stay.',w:'It makes the improvement durable.',s:'`PUBLISH_PENDING_STATS`, `LOCK_TABLE_STATS`.',x:'Locked statistics on a growing table go stale.',c:`EXEC DBMS_STATS.PUBLISH_PENDING_STATS('APP','ORDERS');`}]}},

{h:'4. Stabilising a plan with SQL Plan Management'},
{map:{title:'Plan baseline map',h:216,trace:'Capture and evolve a plan',
 hint:'Tap any box, or press Capture and evolve a plan to follow a plan from capture to controlled change.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'good',x:21,y:24,w:194,h:56,c:'ext',t:'Good plan',s:'known good',d:'A plan that you know performs well, in the cursor cache or in AWR.',why:'It is the plan you want to preserve.',chk:`SELECT sql_id, plan_hash_value, ROUND(elapsed_time/NULLIF(executions,0)/1000) AS ms FROM v$sql WHERE sql_id = '&sql_id';`,see:[5,2,'SQL Plan Management: baselines and evolution']},
 {id:'load',x:243,y:24,w:194,h:56,c:'proc',t:'Load baseline',s:'from cache',d:'Load the plan as a SQL plan baseline from the cursor cache or from a SQL tuning set.',why:'The plan becomes accepted.',chk:`DECLARE n PLS_INTEGER; BEGIN n := DBMS_SPM.LOAD_PLANS_FROM_CURSOR_CACHE(sql_id => '&sql_id', plan_hash_value => &phv); END;
/`,see:[5,6,'Practical: Stabilize a plan with SQL Plan Management']},
 {id:'acc',x:465,y:24,w:194,h:56,c:'mem',t:'Accepted',s:'only these run',d:'The optimizer will use only accepted plans for this statement.',why:'It cannot regress to an unknown plan.',chk:`SELECT sql_handle, plan_name, enabled, accepted, fixed FROM dba_sql_plan_baselines;`,see:[5,2,'SQL Plan Management: baselines and evolution']},
 {id:'new',x:21,y:136,w:194,h:56,c:'warn',t:'New plan found',s:'not accepted',d:'After a change, the optimizer may find a different plan. It is recorded but not used.',why:'It waits for verification.',chk:`SELECT plan_name, accepted, origin FROM dba_sql_plan_baselines WHERE accepted = 'NO';`,see:[5,2,'SQL Plan Management: baselines and evolution']},
 {id:'ver',x:243,y:136,w:194,h:56,c:'mem',t:'Verify',s:'test it',d:'The evolve task runs the new plan and compares its performance with the accepted plans.',why:'Proof before acceptance.',chk:`SELECT DBMS_SPM.EVOLVE_SQL_PLAN_BASELINE(sql_handle => '&handle') FROM dual;`,see:[5,2,'SQL Plan Management: baselines and evolution']},
 {id:'evo',x:465,y:136,w:194,h:56,c:'proc',t:'Accept',s:'if better',d:'If the new plan is verified as better, it is accepted. Otherwise it stays unused.',why:'The plan changes under control.',chk:`SELECT DBMS_SPM.ACCEPT_SQL_PLAN_BASELINE(task_name => '&task') FROM dual;`,see:[5,2,'SQL Plan Management: baselines and evolution']}],
 steps:[
 {ids:['good','load'],t:'1. Identify a plan that performs well and load it into a baseline from the cursor cache.',w:'It creates the accepted reference.',s:'`DBMS_SPM.LOAD_PLANS_FROM_CURSOR_CACHE`.',x:'Loading the wrong plan hash makes the wrong plan permanent.',c:`SELECT sql_id, plan_hash_value FROM v$sql WHERE sql_id = '&sql_id';`},
 {ids:['acc'],t:'2. From now on the optimizer may use only accepted plans for the statement.',w:'The plan is stable across statistics and upgrades.',s:'Baseline status, `FIXED`.',x:'A fixed plan that becomes bad has to be changed by hand.',c:`SELECT plan_name, accepted, fixed FROM dba_sql_plan_baselines;`},
 {ids:['new'],t:'3. When conditions change the optimizer may produce a different plan. It is stored as not accepted and the accepted plan is used.',w:'There is no sudden regression.',s:'`OPTIMIZER_CAPTURE_SQL_PLAN_BASELINES`.',x:'Accumulating many unaccepted plans shows a statement whose plan keeps changing.',c:`SELECT COUNT(*) FROM dba_sql_plan_baselines WHERE accepted = 'NO';`},
 {ids:['ver'],t:'4. Evolve: the new plan is run and compared with the accepted ones on the same data.',w:'Only evidence changes the plan.',s:'`DBMS_SPM.EVOLVE_SQL_PLAN_BASELINE`, evolve task.',x:'Evolve consumes resources, so run it off peak.',c:`SELECT DBMS_SPM.REPORT_AUTO_EVOLVE_TASK FROM dual;`},
 {ids:['evo'],t:'5. If the new plan wins, accept it, and it joins the accepted set. Review baselines on a regular schedule.',w:'Plan changes are a managed event.',s:'Automatic evolve task, retention of baselines.',x:'Never reviewing baselines leaves old plans in force after the data changed.',c:`SELECT sql_handle, plan_name, last_executed FROM dba_sql_plan_baselines ORDER BY last_executed;`}]}},

{h:'5. Resolving a blocking chain'},
{map:{title:'Blocking chain map',h:216,trace:'Find the root blocker',
 hint:'Tap any box, or press Find the root blocker to follow a chain of waiting sessions to its cause.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'wait',x:21,y:24,w:194,h:56,c:'warn',t:'Waiters',s:'row lock waits',d:'Sessions waiting on enq: TX - row lock contention, with a growing wait time.',why:'Users see an application that hangs.',chk:`SELECT sid, serial#, blocking_session, event, seconds_in_wait FROM v$session WHERE blocking_session IS NOT NULL;`,see:[9,1,'Finding blockers and waiters']},
 {id:'chain',x:243,y:24,w:194,h:56,c:'mem',t:'Follow the chain',s:'blocker of blocker',d:'Follow BLOCKING_SESSION until you reach a session that is not itself blocked.',why:'Several waiters often share one root.',chk:`SELECT sid, blocking_session, final_blocking_session FROM v$session WHERE final_blocking_session IS NOT NULL;`,see:[9,1,'Finding blockers and waiters']},
 {id:'root',x:465,y:24,w:194,h:56,c:'proc',t:'Root blocker',s:'holds the lock',d:'The session at the head of the chain that holds the lock and is not waiting.',why:'It is the only session worth examining.',chk:`SELECT sid, serial#, username, status, sql_id, prev_sql_id, last_call_et FROM v$session WHERE sid = &root_sid;`,see:[9,1,'Finding blockers and waiters']},
 {id:'what',x:21,y:136,w:194,h:56,c:'mem',t:'What is it doing',s:'idle or busy',d:'Check whether it is idle in a transaction (a forgotten commit), running a long job, or itself slow.',why:'The cause decides the action.',chk:`SELECT s.sid, t.start_time, t.used_ublk FROM v$session s JOIN v$transaction t ON t.addr = s.taddr WHERE s.sid = &root_sid;`,see:[9,0,'Locks and enqueues: TX, TM and UL']},
 {id:'ask',x:243,y:136,w:194,h:56,c:'ext',t:'Ask the owner',s:'application or user',d:'Contact the owner. Idle transactions are usually an application bug or a user who left a session open.',why:'Killing someone work is a business decision.',chk:`SELECT username, osuser, machine, program FROM v$session WHERE sid = &root_sid;`,see:[9,5,'Practical: Resolve a production blocking chain']},
 {id:'act',x:465,y:136,w:194,h:56,c:'warn',t:'Act',s:'commit, wait or kill',d:'Ask them to commit or roll back. If not possible and agreed, kill the session, which rolls back its work.',why:'A rollback of a big transaction can take as long as it ran.',chk:`ALTER SYSTEM KILL SESSION '&root_sid,&root_serial' IMMEDIATE;`,see:[9,1,'Finding blockers and waiters']}],
 steps:[
 {ids:['wait','chain'],t:'1. List sessions with a blocking session, and follow each one up the chain with FINAL_BLOCKING_SESSION.',w:'It reduces a large number of waiters to a few roots.',s:'`V$SESSION`, `DBA_WAITERS`.',x:'Starting by killing the longest waiter does nothing.',c:`SELECT final_blocking_session, COUNT(*) FROM v$session WHERE final_blocking_session IS NOT NULL GROUP BY final_blocking_session;`},
 {ids:['root'],t:'2. Look at the root blocker: its SQL, what it ran last, how long since its last call and its transaction.',w:'It shows whether it is active or forgotten.',s:'`V$SESSION`, `V$TRANSACTION`.',x:'The current SQL may be innocent. The blocking statement was an earlier one.',c:`SELECT sql_id, prev_sql_id, last_call_et, status FROM v$session WHERE sid = &root_sid;`},
 {ids:['what','ask'],t:'3. Decide: an idle transaction means a missing commit, and a busy one means a long job. Ask the owner.',w:'The business impact is theirs to judge.',s:'Application timeouts, idle transaction limits.',x:'Assuming ownership and killing without asking.',c:`SELECT username, program, machine FROM v$session WHERE sid = &root_sid;`},
 {ids:['act'],t:'4. Have the owner commit or roll back. If you must, kill the session and watch the rollback complete.',w:'Releasing the lock releases the chain.',s:'`ALTER SYSTEM KILL SESSION`, `V$TRANSACTION`.',x:'Rollback of a huge transaction keeps the locks until done.',c:`SELECT used_ublk, used_urec FROM v$transaction;`},
 {ids:['wait'],t:'5. Confirm the waiters have proceeded, then find why it happened and prevent it: shorter transactions, commits, timeouts.',w:'A repeat is a design problem.',s:'`IDLE_TIME`, `FOR UPDATE WAIT`, application changes.',x:'Without prevention the same chain returns next week.',c:`SELECT COUNT(*) FROM v$session WHERE blocking_session IS NOT NULL;`}]}},

{h:'6. Diagnosing a hung database'},
{map:{title:'Hang diagnosis map',h:216,trace:'Find out what is stuck',
 hint:'Tap any box, or press Find out what is stuck to follow a diagnosis when normal connections do not work.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'conn',x:21,y:24,w:194,h:56,c:'warn',t:'Cannot connect?',s:'or very slow',d:'New connections hang or are very slow, and existing sessions do not respond.',why:'First separate a hung instance from a slow listener or the network.',chk:`$ tnsping orcl
$ sqlplus / as sysdba`,see:[9,4,'A method for diagnosing a hung database']},
 {id:'pre',x:243,y:24,w:194,h:56,c:'proc',t:'Prelim connection',s:'sqlplus -prelim',d:'A preliminary connection attaches to the SGA without creating a session, so it works when the instance is hung.',why:'It lets you run oradebug when nothing else does.',chk:`$ sqlplus -prelim / as sysdba`,see:[9,4,'A method for diagnosing a hung database']},
 {id:'ash',x:465,y:24,w:194,h:56,c:'mem',t:'Look at ASH',s:'what waits',d:'If you can connect, look at recent ASH: which events and sessions dominate.',why:'A single event across many sessions is a strong clue.',chk:`SELECT event, COUNT(*) FROM v$active_session_history WHERE sample_time > SYSDATE - 10/1440 GROUP BY event ORDER BY 2 DESC FETCH FIRST 5 ROWS ONLY;`,see:[9,4,'A method for diagnosing a hung database']},
 {id:'hang',x:21,y:136,w:194,h:56,c:'proc',t:'Hang analysis',s:'oradebug',d:'Run hanganalyze to build a wait-for graph and identify blockers across the instance.',why:'It finds the head of the chain even with no SQL access.',chk:`SQL> oradebug setmypid
SQL> oradebug hanganalyze 3`,see:[9,4,'A method for diagnosing a hung database']},
 {id:'fin',x:243,y:136,w:194,h:56,c:'mem',t:'Final blocker',s:'who is at the root',d:'Identify the session or process at the root of the chain: a user session, LGWR, a stuck archiver or an OS issue.',why:'The role of the blocker decides the fix.',chk:`SELECT sid, event, final_blocking_session FROM v$session WHERE final_blocking_session IS NOT NULL;`,see:[9,4,'A method for diagnosing a hung database']},
 {id:'act',x:465,y:136,w:194,h:56,c:'warn',t:'Act',s:'targeted',d:'Resolve the root: free archive space, commit or kill a session, fix the storage. Restart only as the last resort.',why:'A restart loses the evidence and may repeat.',chk:`SELECT * FROM v$recovery_area_usage;`,see:[9,3,'Library cache and row lock contention']}],
 steps:[
 {ids:['conn'],t:'1. Establish what is hung: the listener, the network, the host or the instance. Try tnsping, a local bequeath connection and an OS check.',w:'It narrows the scope before you dig.',s:'Listener, OS load, memory.',x:'A full file system or swapping host looks like a database hang.',c:`$ vmstat 1 5
$ df -h`},
 {ids:['pre','ash'],t:'2. If connections hang, use a prelim connection. If you can connect, look at the recent ASH events.',w:'Evidence without creating more load.',s:'`sqlplus -prelim`, ASH.',x:'Running heavy diagnostic queries makes it worse.',c:`$ sqlplus -prelim / as sysdba`},
 {ids:['hang'],t:'3. Run hanganalyze and save the trace. It shows the wait-for graph and the blockers.',w:'It is the tool for an instance that is not answering.',s:'`oradebug hanganalyze`, `systemstate dump`.',x:'Level too high on a huge instance takes a long time.',c:`SQL> oradebug hanganalyze 3`},
 {ids:['fin'],t:'4. Find the final blocker and its type: a user session, a background process, or a resource limit such as the archive destination.',w:'The fix depends on what the blocker is.',s:'Trace files, alert log.',x:'LGWR or ARCn at the head means storage or space.',c:`SELECT program, event FROM v$session WHERE sid = &root_sid;`},
 {ids:['act'],t:'5. Resolve the root cause in the least disruptive way, and keep the trace files for the post-incident review.',w:'You restore service and keep the evidence.',s:'FRA space, session kill, storage repair.',x:'Restarting without collecting traces loses the cause.',c:`SELECT * FROM v$recovery_file_dest;`}]}},

{h:'7. Comparing a bad period with a good one'},
{map:{title:'AWR compare map',h:216,trace:'Find what changed',
 hint:'Tap any box, or press Find what changed to follow a regression from the two periods to the difference.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'good',x:21,y:24,w:194,h:56,c:'ext',t:'Good period',s:'baseline',d:'A period of the same length and similar workload when performance was acceptable.',why:'It must be comparable: same time of day and day type.',chk:`SELECT baseline_name, start_snap_id, end_snap_id FROM dba_hist_baseline;`,see:[2,5,'Comparing two periods with AWR Compare']},
 {id:'bad',x:243,y:24,w:194,h:56,c:'warn',t:'Bad period',s:'the incident',d:'The period when users saw the problem, as narrowly as possible.',why:'A short window gives a sharper signal.',chk:`SELECT snap_id, begin_interval_time FROM dba_hist_snapshot ORDER BY snap_id DESC FETCH FIRST 10 ROWS ONLY;`,see:[2,1,'Generating and reading AWR reports']},
 {id:'cmp',x:465,y:24,w:194,h:56,c:'proc',t:'AWR compare',s:'awrddrpt',d:'Generate the AWR compare periods report. It shows the two periods side by side with differences.',why:'It highlights what is different, not just what is big.',chk:`@?/rdbms/admin/awrddrpt.sql`,see:[2,5,'Comparing two periods with AWR Compare']},
 {id:'top',x:20,y:136,w:139,h:56,c:'mem',t:'Load and events',s:'what changed',d:'Compare load profile (more executions? more parses?) and top events.',why:'The workload may have changed, not the system.',chk:`SELECT stat_name, ROUND(value/1000000) FROM dba_hist_sys_time_model WHERE snap_id = &snap AND stat_name = 'DB time';`,see:[2,5,'Comparing two periods with AWR Compare']},
 {id:'sql',x:187,y:136,w:139,h:56,c:'mem',t:'SQL differences',s:'plans and elapsed',d:'Look for SQL whose elapsed time per execution or plan hash value changed.',why:'A plan change is the commonest regression.',chk:`SELECT sql_id, plan_hash_value, executions_delta, elapsed_time_delta FROM dba_hist_sqlstat WHERE snap_id BETWEEN &b AND &e ORDER BY elapsed_time_delta DESC FETCH FIRST 10 ROWS ONLY;`,see:[2,7,'Practical: Diagnose a regression with AWR and ASH']},
 {id:'plan',x:354,y:136,w:139,h:56,c:'proc',t:'Plan history',s:'what changed',d:'Display the plans from AWR for the statement and compare the old and new plan.',why:'It shows which step changed.',chk:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_AWR('&sql_id'));`,see:[4,3,'Plans from the cursor cache and AWR']},
 {id:'fix',x:521,y:136,w:139,h:56,c:'proc',t:'Fix and baseline',s:'restore the good plan',d:'Restore the previous plan with a baseline or fix the cause, then keep a new baseline.',why:'It makes the recovery durable.',chk:`EXEC DBMS_SPM.LOAD_PLANS_FROM_AWR(begin_snap => &b, end_snap => &e);`,see:[5,2,'SQL Plan Management: baselines and evolution']}],
 steps:[
 {ids:['good','bad'],t:'1. Choose a bad period and a comparable good one of the same length, from a baseline or last week.',w:'The comparison is only fair for like with like.',s:'AWR retention, baselines.',x:'Comparing a Monday morning to a Sunday night.',c:`SELECT baseline_name FROM dba_hist_baseline;`},
 {ids:['cmp'],t:'2. Generate the AWR compare report and read the summary of differences.',w:'It is much faster than two reports by eye.',s:'`awrddrpt.sql`.',x:'Different instance restarts between the periods spoil the comparison.',c:`@?/rdbms/admin/awrddrpt.sql`},
 {ids:['top'],t:'3. Compare load profile and top events: did the workload change (more executions) or the efficiency (more time per execution)?',w:'It separates "more load" from "worse performance".',s:'Load profile, time model.',x:'A rise in transactions per second is not a regression.',c:`SELECT stat_name, value FROM dba_hist_sysstat WHERE snap_id = &snap AND stat_name = 'execute count';`},
 {ids:['sql','plan'],t:'4. Find the SQL with changed elapsed time per execution or a new plan hash, and compare its plans from AWR.',w:'Plan changes after statistics, upgrades and parameter changes are common.',s:'`DBA_HIST_SQLSTAT`, `DISPLAY_AWR`.',x:'A statement that is new in the bad period is a change of workload.',c:`SELECT sql_id, plan_hash_value, COUNT(*) FROM dba_hist_sqlstat GROUP BY sql_id, plan_hash_value HAVING COUNT(*) > 0 ORDER BY 3 DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['fix'],t:'5. Restore the good plan with a baseline from AWR, or fix the cause, and take a new baseline of the healthy period.',w:'You recover and protect against a repeat.',s:'`DBMS_SPM.LOAD_PLANS_FROM_AWR`.',x:'Fixing the symptom with a baseline and never asking what changed.',c:`EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_BASELINE(&b, &e, 'post_fix');`}]}},

]},

/* 1 ---------------------------------------------------------------- tools map */
{t:'Tools map and licensing',d:'Which tool answers which question, and whether it needs a licensed pack.',see:[[0,3,'The tools map'],[0,4,'Licensing']],b:[
{t:[['Question','Tool','Granularity','License'],
['What is happening right now?','`V$SESSION`, `V$SQL`, `V$SESSION_LONGOPS`','Instant','Included'],
['Where is time going over a period?','AWR report (`awrrpt.sql`)','Hourly snapshots','Diagnostics Pack'],
['Same, without a pack','Statspack (`spreport.sql`)','Snapshots you take','Included'],
['What was each session doing, second by second?','ASH (`V$ACTIVE_SESSION_HISTORY`, `ashrpt.sql`)','1 second samples','Diagnostics Pack'],
['What is the likely cause and fix?','ADDM (`addmrpt.sql`)','An AWR period','Diagnostics Pack'],
['Compare two periods','AWR Compare (`awrddrpt.sql`)','Two periods','Diagnostics Pack'],
['How is this long SQL running?','Real-Time SQL Monitoring','One execution','Tuning Pack'],
['How can I improve this SQL?','SQL Tuning Advisor','One SQL','Tuning Pack'],
['Which structures help the workload?','SQL Access Advisor','A workload','Tuning Pack'],
['What did the plan look like?','`DBMS_XPLAN.DISPLAY_CURSOR`','One cursor','Included (cursor cache)'],
['Per-statement detail','SQL trace and TKPROF','One session','Included'],
['Keep a plan stable','SQL Plan Management','Per SQL','Included in Enterprise Edition'],
['Test a change with real SQL or workload','SQL Performance Analyzer, Database Replay','Workload','Real Application Testing'],
['Protect OLTP from reports','Resource Manager','Consumer groups','Included in Enterprise Edition']]},
{code:`-- stop accidental use of licensed packs
ALTER SYSTEM SET control_management_pack_access = 'NONE' SCOPE = BOTH;   -- NONE | DIAGNOSTIC | DIAGNOSTIC+TUNING`},
{note:'Packs apply when you **use** the feature, including querying `DBA_HIST_*` and `V$ACTIVE_SESSION_HISTORY`. Always confirm for your release in the Licensing Information User Manual.'}
]},

/* 2 ---------------------------------------------------------------- processes/components */
{t:'Processes and components',d:'The parts of the instance that collect performance data or make performance happen.',see:[[7,0,'SGA and PGA'],[2,0,'AWR snapshots']],b:[
{t:[['Component','Role','Look here'],
['MMON','Takes AWR snapshots every hour (default), raises threshold alerts','`DBA_HIST_SNAPSHOT`, `DBA_OUTSTANDING_ALERTS`'],
['MMNL','Writes ASH data to AWR and computes short-interval metrics','`V$ACTIVE_SESSION_HISTORY`'],
['LGWR','Writes redo; commit speed','`log file sync`, `log file parallel write`'],
['DBWn','Writes dirty buffers','`free buffer waits`, `V$BH`'],
['CKPT','Checkpoints; limits instance recovery time','`V$INSTANCE_RECOVERY`'],
['SMCO / Wnnn','Space management','`DBA_AUTO_SEGADV_SUMMARY`'],
['Maintenance windows','Statistics gathering, Segment Advisor, SQL tuning (nightly)','`DBA_AUTOTASK_CLIENT`'],
['DBRM','Resource Manager scheduling of CPU','`V$RSRC_CONSUMER_GROUP`'],
['PGA work areas','Sorts, hashes, bitmaps in memory','`V$PGASTAT`, `V$SQL_WORKAREA`'],
['Buffer cache','Data block cache','`V$DB_CACHE_ADVICE`'],
['Shared pool','Cursors, dictionary cache','`V$SHARED_POOL_ADVICE`, `V$LIBRARYCACHE`'],
['In-Memory column store','Columnar copy of chosen tables (licensed)','`V$IM_SEGMENTS`']]},
{note:'`statistics_level` must stay at `TYPICAL` or `ALL`. At `BASIC` AWR, ADDM and most advisors stop collecting.'}
]},

/* 3 ---------------------------------------------------------------- wait events */
{t:'Wait event field guide',d:'The events you meet most often, what each means and where to look next.',see:[[1,3,'The most common waits'],[1,0,'The wait interface']],b:[
{t:[['Wait event','Class','Meaning','Look at'],
['`db file sequential read`','User I/O','Single-block read: index lookups, access by ROWID','Top SQL, index design, storage latency'],
['`db file scattered read`','User I/O','Multiblock read into cache: full scans','Missing index, scan size, statistics'],
['`direct path read`','User I/O','Large read bypassing cache (parallel or big scans)','Normal for analytics; check PGA and plans'],
['`direct path read temp` / `write temp`','User I/O','Sort or hash spill to temp','`PGA_AGGREGATE_TARGET`, estimates, plan'],
['`log file sync`','Commit','Commit waiting for LGWR','Redo disk latency, commit rate'],
['`log file parallel write`','System I/O','LGWR write time','Redo storage'],
['`log file switch (checkpoint incomplete)`','Configuration','Log reuse blocked by checkpoint','Larger or more redo logs, DBWR speed'],
['`free buffer waits`','Configuration','No clean buffer available','DBWR throughput, cache size'],
['`buffer busy waits`','Concurrency','Block in use by another session','Hot block, index leaf, segment design'],
['`enq: TX - row lock contention`','Application','Waiting for a row lock','Blocking session, transaction length'],
['`enq: TM - contention`','Application','Table lock conflict','Missing foreign key index, DDL'],
['`enq: TX - index contention`','Concurrency','Index block split','Sequence key, reverse key, partitioning'],
['`library cache lock` / `pin`','Concurrency','DDL or invalidation on a used object','Quiet window for DDL and statistics'],
['`cursor: pin S wait on X`','Concurrency','Hard parse of a busy cursor','Literals, invalidations'],
['`latch: cache buffers chains`','Concurrency','Hot block read by many sessions','Reduce logical reads, hot segment'],
['`latch: shared pool`','Concurrency','Shared pool allocation pressure','Literals, memory'],
['`read by other session`','User I/O','Waiting for another session to read the same block','Same as hot block'],
['`SQL*Net message from client`','Idle','Waiting for the application','Usually ignore; check round trips'],
['`SQL*Net more data to client`','Network','Large results sent','SDU, array size'],
['`gc buffer busy acquire/release`, `gc cr block 2-way`','Cluster','RAC block transfers','See the RAC reference'],
['`resmgr:cpu quantum`','Scheduler','Throttled by Resource Manager','Plan directives']]},
{note:'A wait is a problem only when it takes a large share of **DB Time**. Judge by share, not by the name.'}
]},

/* 4 ---------------------------------------------------------------- parameters */
{t:'Important parameters',d:'Parameters that affect performance, with default and how to change them safely.',see:[[3,5,'System statistics and parameters'],[7,0,'SGA and PGA sizing']],b:[
{t:[['Parameter','Default','Note'],
['`sga_target`, `sga_max_size`','Set at creation','Total SGA; resize online up to the max'],
['`pga_aggregate_target`, `pga_aggregate_limit`','Computed','Work areas; limit terminates sessions'],
['`memory_target`','0','Prefer SGA and PGA targets with HugePages'],
['`optimizer_mode`','`ALL_ROWS`','Leave unless a clear reason'],
['`optimizer_features_enable`','Release','Set to an older value only to freeze plans during upgrade'],
['`optimizer_adaptive_plans`','`TRUE`','Adaptive join and parallel distribution'],
['`optimizer_adaptive_statistics`','`FALSE`','Turn on only after testing'],
['`optimizer_capture_sql_plan_baselines`','`FALSE`','Automatic baseline capture'],
['`optimizer_use_sql_plan_baselines`','`TRUE`','Use accepted baselines'],
['`optimizer_index_cost_adj`, `optimizer_index_caching`','100, 0','Avoid changing; fix statistics instead'],
['`cursor_sharing`','`EXACT`','`FORCE` only as a stopgap for literal SQL'],
['`session_cached_cursors`','50','Raise for busy applications'],
['`open_cursors`','50','Commonly 300 or more'],
['`db_file_multiblock_read_count`','Self-tuned','Leave unset'],
['`parallel_degree_policy`','`MANUAL`','`AUTO` enables auto DOP and statement queuing'],
['`parallel_max_servers`, `parallel_servers_target`','CPU based','Protect OLTP from parallel queries'],
['`db_cache_size`, `shared_pool_size`','0 (auto)','Minimum floors under automatic sizing'],
['`inmemory_size`','0','Size of the In-Memory area'],
['`statistics_level`','`TYPICAL`','Do not set `BASIC`'],
['`undo_retention`','900','Raise for long queries (ORA-01555)'],
['`filesystemio_options`','Platform dependent','`SETALL` on filesystems'],
['`resource_manager_plan`','`DEFAULT_PLAN` or unset','Plan that shares CPU']]},
{code:`-- test a parameter in one session before the system
ALTER SESSION SET optimizer_adaptive_statistics = TRUE;
-- and see what differs from default
SELECT name, value FROM v$parameter WHERE isdefault = 'FALSE' ORDER BY name;`}
]},

/* 5 ---------------------------------------------------------------- views */
{t:'System views',d:'Which view answers which performance question.',see:[[1,1,'V$SESSION and ASH'],[1,2,'V$SYSSTAT and V$SYSTEM_EVENT']],b:[
{t:[['Question','View'],
['What is each session waiting for now?','`V$SESSION` (`EVENT`, `WAIT_CLASS`, `BLOCKING_SESSION`)'],
['What did sessions do in the last minutes?','`V$ACTIVE_SESSION_HISTORY`'],
['Instance-wide waits since startup','`V$SYSTEM_EVENT`, `V$EVENT_HISTOGRAM`'],
['Counters and load','`V$SYSSTAT`, `V$SESSTAT`, `V$OSSTAT`'],
['DB Time and CPU split','`V$SYS_TIME_MODEL`, `V$SESS_TIME_MODEL`'],
['Metrics over intervals','`V$SYSMETRIC`, `V$SYSMETRIC_HISTORY`, `V$SYSMETRIC_SUMMARY`'],
['SQL statistics','`V$SQL`, `V$SQLAREA`, `V$SQLSTATS`, `V$SQL_PLAN_STATISTICS_ALL`'],
['Long operations','`V$SESSION_LONGOPS`, `V$SQL_MONITOR`'],
['Workarea use','`V$SQL_WORKAREA_ACTIVE`, `V$PGASTAT`'],
['Memory advisors','`V$DB_CACHE_ADVICE`, `V$SHARED_POOL_ADVICE`, `V$PGA_TARGET_ADVICE`, `V$SGA_TARGET_ADVICE`'],
['Library cache and parse','`V$LIBRARYCACHE`, `V$SQLCOMMAND`'],
['I/O by file','`V$FILESTAT`, `V$IOSTAT_FILE`, `V$IOSTAT_FUNCTION`'],
['History (AWR)','`DBA_HIST_SNAPSHOT`, `DBA_HIST_SYSSTAT`, `DBA_HIST_SQLSTAT`, `DBA_HIST_ACTIVE_SESS_HISTORY`'],
['Statistics state','`DBA_TAB_STATISTICS`, `DBA_TAB_COL_STATISTICS`, `DBA_TAB_STATS_HISTORY`'],
['Plan baselines and profiles','`DBA_SQL_PLAN_BASELINES`, `DBA_SQL_PROFILES`, `DBA_SQL_PATCHES`'],
['Advisor results','`DBA_ADVISOR_TASKS`, `DBA_ADVISOR_FINDINGS`'],
['Locks','`V$LOCK`, `DBA_BLOCKERS`, `DBA_WAITERS`, `V$ENQUEUE_STAT`'],
['Resource Manager','`V$RSRC_CONSUMER_GROUP`, `V$RSRC_PLAN`']]}
]},

/* 6 ---------------------------------------------------------------- tools and scripts */
{t:'Scripts and command-line tools',d:'The scripts and utilities you run for performance work, and the OS counterparts.',see:[[2,1,'Reading AWR reports'],[8,2,'Linux tools']],b:[
{t:[['Tool','Use','How'],
['`awrrpt.sql`','AWR report for a snapshot range','`@?/rdbms/admin/awrrpt.sql`'],
['`awrgrpt.sql`','AWR report across a RAC cluster','`@?/rdbms/admin/awrgrpt.sql`'],
['`awrddrpt.sql`','Compare two periods','`@?/rdbms/admin/awrddrpt.sql`'],
['`ashrpt.sql`','ASH report for minutes','`@?/rdbms/admin/ashrpt.sql`'],
['`addmrpt.sql`','ADDM report','`@?/rdbms/admin/addmrpt.sql`'],
['`awrsqrpt.sql`','AWR report for one SQL','`@?/rdbms/admin/awrsqrpt.sql`'],
['`DBMS_XPLAN`','Show plans','`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL,NULL,\'ALLSTATS LAST\'));`'],
['`DBMS_MONITOR`','Enable SQL trace','`EXEC DBMS_MONITOR.SESSION_TRACE_ENABLE(waits=>TRUE, binds=>TRUE);`'],
['`tkprof`','Format a trace file','`tkprof in.trc out.txt sys=no sort=exeela`'],
['`trcsess`','Combine traces by service or module','`trcsess output=all.trc service=APP *.trc`'],
['`DBMS_STATS`','Gather and manage statistics','`EXEC DBMS_STATS.GATHER_TABLE_STATS(...)`'],
['`DBMS_SQLTUNE`','Tuning Advisor and SQL Monitor reports','`DBMS_SQLTUNE.REPORT_SQL_MONITOR(...)`'],
['`DBMS_SPM`','Plan baselines','`LOAD_PLANS_FROM_CURSOR_CACHE`'],
['`top`, `vmstat 5`','CPU, run queue, swap','`si/so` above zero means swapping'],
['`iostat -x 5`','Device latency and utilization','`await`, `%util`'],
['`sar`','History of OS counters','`sar -u 1 5`'],
['`orion`, `CALIBRATE_IO`','Storage capability','`DBMS_RESOURCE_MANAGER.CALIBRATE_IO`']]},
{code:`-- AWR from SQL*Plus, scripted
@?/rdbms/admin/awrrpt.sql
-- choose html, number of days, begin and end snapshot, file name`}
]},

/* 7 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'Index type, join method, access path, partitioning and when to gather statistics.',see:[[6,0,'Index types'],[4,2,'Join methods']],b:[
{h:'Index type'},
{t:[['Need','Use'],
['Selective column, equality or range','B-tree'],
['Several columns used together','Composite B-tree, equality columns first'],
['`WHERE UPPER(col) = ...`','Function-based index'],
['Low cardinality, warehouse, ad hoc combinations','Bitmap (not for OLTP DML)'],
['Right-hand hot spot on sequence keys','Reverse key or hash partitioning'],
['Test dropping an index','Make it `INVISIBLE` first']]},
{h:'Join method'},
{t:[['Method','Good when','Risk'],
['Nested loops','Few outer rows, index on inner','Huge outer set'],
['Hash join','Large sets, equality join','Spills to temp when estimates are low'],
['Sort merge','Non-equality joins, sorted inputs','Sorts both sides']]},
{h:'Access path'},
{t:[['Path','Choose when'],
['Full table scan','Most rows needed, small table, Smart Scan or In-Memory'],
['Index range scan','Selective filter'],
['Index fast full scan','Index covers the query'],
['Unique scan','Single-row key lookup']]},
{h:'Partitioning'},
{t:[['Method','Use'],
['Range or interval','Dates and time-based archiving'],
['List','Known categories (region)'],
['Hash','Even spread, parallel joins'],
['Composite','Large and mixed needs']]},
{h:'When to gather statistics'},
{t:[['Situation','Action'],
['Normal operation','Leave the automatic job on'],
['After a bulk load','Gather on that table at once'],
['A plan regressed','Check history, restore previous statistics, then find the cause'],
['Skewed or correlated columns','Histograms, extended statistics'],
['Volatile temporary data','Lock statistics or set them yourself']]}
]},

/* 8 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, likely cause and fix.',see:[[0,0,'A tuning method'],[9,4,'Diagnosing a hung database']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['Everything slow now','AAS vs cores, top waits (ASH)','CPU saturation or one bad SQL or a lock','Find top SQL and blockers'],
['One report slow','SQL Monitor, plan, estimated vs actual rows','Wrong estimates, missing statistics','Statistics, index, SQL Profile'],
['Fast then slow, same SQL','`V$SQL` plan hash values, bind peeking','Plan change or skew','SPM baseline, histograms'],
['Slow after upgrade or patch','AWR compare, optimizer parameters','Plan regression','SPM, `optimizer_features_enable`'],
['High `log file sync`','Redo latency, commit rate','Slow disk or commit per row','Faster redo, batch commits'],
['High `enq: TX - row lock`','`BLOCKING_SESSION`','Open transaction','Contact owner, shorten transactions'],
['High parse time','Hard parse count, literals','No bind variables','Binds, `session_cached_cursors`'],
['Temp growth, `direct path write temp`','`V$TEMPSEG_USAGE`','Spilling hash or sort','Fix estimates, size PGA'],
['ORA-01555','`V$UNDOSTAT`','Undo too small or short retention','Raise `undo_retention`, tune the query'],
['High CPU, low waits','Top SQL by CPU, OS','Inefficient SQL, many logical reads','Reduce logical I/O'],
['Swapping','`vmstat` `si/so`','Memory over-allocated','Reduce SGA or sessions'],
['Slow only over WAN','SQL*Net waits, round trips','Latency x calls','Array size, fewer calls']]}
]},

/* 9 ---------------------------------------------------------------- errors */
{t:'Common error messages',d:'Messages that point to performance or resource problems.',see:[[7,4,'Undo and temp'],[9,2,'Deadlocks']],b:[
{t:[['Error','Meaning','Fix'],
['ORA-01555','Snapshot too old (undo overwritten)','More undo, longer retention, shorter queries'],
['ORA-01652','Unable to extend temp segment','Find the SQL, add temp'],
['ORA-04031','Unable to allocate shared memory','Binds, pool size, check for leaks'],
['ORA-04030','Out of process memory','PGA settings, large sorts, OS memory'],
['ORA-00060','Deadlock detected','Fix lock order in the application'],
['ORA-00054','Resource busy, NOWAIT','Retry or `DDL_LOCK_TIMEOUT`'],
['ORA-00018 / 00020','Sessions or processes exceeded','Find leaks, raise `processes`'],
['ORA-04036','PGA memory used by the instance exceeds PGA_AGGREGATE_LIMIT','Find heavy work areas, raise the limit or fix SQL'],
['ORA-01000','Maximum open cursors exceeded','Close cursors in the application, raise `open_cursors`'],
['ORA-00051','Timeout waiting for a resource','Find the holder (often an RAC or library cache contention)'],
['ORA-08177','Cannot serialize access for this transaction','Retry; serializable isolation conflict'],
['ORA-01013','User requested cancel of current operation','Not a fault: a cancel or a timeout in the client']]},
{note:'The performance errors above come with a lesson: they are symptoms of design or sizing. Fix the cause, not only the message.'}
]},

/* 10 ---------------------------------------------------------------- health check */
{t:'Health-check SQL pack',d:'Paste-ready queries for a quick performance check.',see:[[1,5,'Find what a slow database waits on'],[10,0,'Thresholds and alerts']],b:[
{h:'Load now'},
{code:`SELECT ROUND(value) AS cpu_cores FROM v$osstat WHERE stat_name = 'NUM_CPU_CORES';

SELECT metric_name, ROUND(value,2) value
FROM v$sysmetric WHERE group_id = 2
AND metric_name IN ('Average Active Sessions','Host CPU Utilization (%)','Database Wait Time Ratio','User Transaction Per Sec');`},
{h:'Top waits in the last 15 minutes (ASH)'},
{code:`SELECT NVL(event,'ON CPU') event, wait_class, COUNT(*) samples
FROM v$active_session_history
WHERE sample_time > SYSDATE - 15/1440
GROUP BY event, wait_class ORDER BY samples DESC FETCH FIRST 10 ROWS ONLY;`},
{h:'Top SQL by elapsed time'},
{code:`SELECT sql_id, plan_hash_value, executions,
       ROUND(elapsed_time/1e6) elapsed_s, ROUND(cpu_time/1e6) cpu_s, buffer_gets, disk_reads
FROM v$sqlstats ORDER BY elapsed_time DESC FETCH FIRST 10 ROWS ONLY;`},
{h:'Blocking'},
{code:`SELECT sid, serial#, username, blocking_session, event, seconds_in_wait, sql_id
FROM v$session WHERE blocking_session IS NOT NULL;`},
{h:'Statistics freshness'},
{code:`SELECT owner, table_name, num_rows, last_analyzed, stale_stats
FROM dba_tab_statistics WHERE stale_stats = 'YES' AND owner NOT IN ('SYS','SYSTEM') FETCH FIRST 20 ROWS ONLY;`},
{h:'Memory advisors'},
{code:`SELECT sga_size, sga_size_factor, estd_db_time FROM v$sga_target_advice;
SELECT pga_target_for_estimate/1048576 mb, estd_pga_cache_hit_percentage, estd_overalloc_count FROM v$pga_target_advice;`}
]},

/* 11 ---------------------------------------------------------------- plan decoder */
{t:'Execution plan decoder',d:'The plan operations you meet most, what they do and when they are a worry.',see:[[4,0,'Reading plans'],[4,1,'Access paths']],b:[
{t:[['Operation','Meaning','Worry when'],
['`TABLE ACCESS FULL`','Scan all blocks','Selective query on large table'],
['`TABLE ACCESS BY INDEX ROWID`','Fetch row after index','Very many rows (single-block reads)'],
['`INDEX UNIQUE SCAN`','One entry','Never'],
['`INDEX RANGE SCAN`','A range of entries','Low selectivity'],
['`INDEX FAST FULL SCAN`','Read index with multiblock reads','Index much larger than needed'],
['`NESTED LOOPS`','For each outer row, probe inner','Outer set is large'],
['`HASH JOIN`','Build hash on smaller input, probe','Spills (temp) when estimate is low'],
['`MERGE JOIN`','Sort and merge','Both sides large'],
['`SORT ORDER BY`, `SORT GROUP BY`, `HASH GROUP BY`','Sort or aggregate','Spills to temp'],
['`VIEW`, `COUNT STOPKEY`','View merge boundary, row limit','Unexpected materialization'],
['`PARTITION RANGE ITERATOR`, `SINGLE`','Partition pruning','Pruning missing (ALL)'],
['`PX COORDINATOR`, `PX SEND`','Parallel query steps','Skew between servers'],
['`TABLE ACCESS STORAGE FULL`','Exadata Smart Scan eligible scan','Direct path not used'],
['`LOAD AS SELECT`','Direct path insert','Unexpected: locks table']]},
{h:'DBMS_XPLAN formats'},
{t:[['Format','Shows'],
['`TYPICAL`','Plan with estimates and predicates'],
['`ALLSTATS LAST`','Estimates and actuals for last run (needs row source statistics)'],
['`ADVANCED`','Outline, peeked binds, query blocks'],
['`+PEEKED_BINDS`','Bind values used at hard parse'],
['`+NOTE`','Notes such as baseline used, dynamic sampling']]},
{h:'Common hints'},
{t:[['Hint','Effect'],
['`/*+ FULL(t) */`','Full scan'],
['`/*+ INDEX(t ix) */`','Use index'],
['`/*+ LEADING(a b) */`','Join order'],
['`/*+ USE_HASH(b) */`, `USE_NL`','Join method'],
['`/*+ PARALLEL(t 4) */`','Parallel degree'],
['`/*+ GATHER_PLAN_STATISTICS */`','Collect actual rows (testing)']]}
]}

]};
