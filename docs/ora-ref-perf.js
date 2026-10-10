/* LearnSphere - Oracle Performance & Tuning Quick Reference (cheat sheet).
   window.QREF['ora-perf'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Values are for Oracle Database 19c on Linux unless stated. AWR, ASH, ADDM, SQL Monitor and advisors need the Diagnostics Pack or Tuning Pack:
   check the Licensing Information User Manual before you use them. */
window.QREF=window.QREF||{};
window.QREF['ora-perf']={title:'Performance & Tuning Quick Reference',blurb:'Tools, wait events, views, parameters, plan operations and fixes for tuning on one page each.',hint:'wait or optimizer',pages:[

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
