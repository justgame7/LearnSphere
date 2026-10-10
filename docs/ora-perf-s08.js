/* LearnSphere - Performance, Section 08: Instance & Memory Tuning.
   Lectures 0-7 are core, 8+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const PT=O.D+'tgdba/';

/* ---------- diagrams ---------- */
const mem=O.dg(700,230,[
[10,10,420,210,'SGA (shared by all sessions)',1],
[30,45,180,45,'Buffer cache|data blocks',2],[230,45,180,45,'Shared pool|SQL, dictionary',2],
[30,105,180,45,'Redo log buffer',0],[230,105,180,45,'Large pool, Java, Streams',0],
[30,165,380,40,'In-Memory area (optional)',0],
[470,10,220,210,'PGA (per session)',1],
[490,50,180,50,'Sort and hash work areas',2],[490,120,180,50,'Session and cursor state',0]],[]);

const redo=O.dg(700,160,[
[10,40,130,70,'Session|COMMIT',0],
[190,40,130,70,'Log buffer',0],
[370,40,130,70,'LGWR writes|redo to disk',2],
[550,40,140,70,'Commit returns|(log file sync)',0]],
[[140,75,190,75],[320,75,370,75],[500,75,550,75]]);

/* ---------- 0: SGA and PGA sizing ---------- */
L['ora-perf:7:0']={blocks:[
{p:'Two memory areas matter: the **SGA** (shared by the instance) and the **PGA** (private per session). Size them with advisors, not guesses.'},
{svg:mem},
{t:[['Parameter','Controls'],
['`MEMORY_TARGET`','Total SGA+PGA (AMM). Not used with HugePages.'],
['`SGA_TARGET` / `SGA_MAX_SIZE`','SGA total (ASMM). Preferred on Linux with HugePages.'],
['`PGA_AGGREGATE_TARGET`','Target for total PGA memory'],
['`PGA_AGGREGATE_LIMIT`','Hard limit. Sessions are stopped beyond it.']]},
{code:`SELECT sga_size, sga_size_factor, estd_db_time FROM v$sga_target_advice;
SELECT pga_target_for_estimate/1024/1024 mb, estd_pga_cache_hit_percentage, estd_overalloc_count
FROM v$pga_target_advice;`},
{h:'Rules'},
{ul:['Use **HugePages** on Linux for large SGAs (and ASMM, not AMM).','Increase memory only when advisors show a gain in DB Time.','Leave memory for the OS and for the number of sessions times PGA.']},
{note:'Bigger SGA is not always faster. After the working set fits, more memory gives nothing.'}],
src:[['Memory configuration',PT]]};

/* ---------- 1: Buffer cache and shared pool ---------- */
L['ora-perf:7:1']={blocks:[
{p:'The **buffer cache** holds data blocks. The **shared pool** holds parsed SQL, PL/SQL and dictionary data.'},
{t:[['','Buffer cache','Shared pool'],
['**Holds**','Table and index blocks','Cursors, library cache, dictionary cache'],
['**Healthy sign**','Physical reads low compared with logical reads','Few hard parses, no reloads'],
['**Trouble sign**','`free buffer waits`, `db file sequential read` high','`library cache` waits, ORA-04031'],
['**Advisor**','`V$DB_CACHE_ADVICE`','`V$SHARED_POOL_ADVICE`']]},
{code:`SELECT size_for_estimate mb, size_factor, estd_physical_read_factor
FROM v$db_cache_advice WHERE name=\'DEFAULT\' AND block_size=8192;

SELECT shared_pool_size_for_estimate mb, estd_lc_load_time
FROM v$shared_pool_advice;`},
{h:'Do not chase the hit ratio'},
{p:'A 99% buffer hit ratio can hide a SQL that reads the same block millions of times. Reduce **logical reads** in the SQL first, then size the cache.'},
{note:'ORA-04031 usually means too many **literals** (hard parses) or fragmentation, not only too little memory.'}],
src:[['Buffer cache and shared pool',PT]]};

/* ---------- 2: Library cache, hard parse ---------- */
L['ora-perf:7:2']={blocks:[
{p:'A **hard parse** compiles and optimizes a SQL from scratch. It is expensive and serializes on latches. A **soft parse** finds an existing cursor.'},
{t:[['Parse','What happens','Cost'],
['**Hard**','Check syntax, privileges, optimize, store','High CPU and latches'],
['**Soft**','Find the cursor in the library cache','Low'],
['**Session cursor cache**','Cursor remembered by the session','Lowest']]},
{code:`SELECT name, value FROM v$sysstat WHERE name IN (\'parse count (total)\',\'parse count (hard)\',\'execute count\');

-- statements that differ only in literals
SELECT force_matching_signature, COUNT(*) FROM v$sql
GROUP BY force_matching_signature HAVING COUNT(*) > 100 ORDER BY 2 DESC FETCH FIRST 5 ROWS ONLY;`},
{h:'Fixes in order'},
{flow:['Use **bind variables** in the application','Set `SESSION_CACHED_CURSORS` suitably','As a stopgap only: `CURSOR_SHARING=FORCE`','Avoid DDL and statistics gathering on hot objects during load']},
{note:'Many entries with the same `FORCE_MATCHING_SIGNATURE` means literals. The real fix is in the code.'}],
src:[['Parsing',O.D+'tgsql/']]};

/* ---------- 3: Redo and commit ---------- */
L['ora-perf:7:3']={blocks:[
{p:'Every commit must wait until **LGWR** has written its redo to disk. That wait is **log file sync**.'},
{svg:redo},
{t:[['Symptom','Cause','Fix'],
['High `log file sync` and `log file parallel write`','Slow redo disk','Faster storage, separate disk group for redo'],
['High `log file sync`, fast `parallel write`','Too many commits, or CPU starved LGWR','Batch commits, fix CPU'],
['`log file switch (checkpoint incomplete)`','Redo logs too small or too few','Add or enlarge logs'],
['`log buffer space`','Log buffer small or LGWR slow','Check the disk first']]},
{code:`SELECT group#, bytes/1024/1024 mb, members, status FROM v$log;
SELECT event, total_waits, ROUND(time_waited_micro/1e6) s FROM v$system_event WHERE event LIKE \'log file%\';`},
{h:'Guidelines'},
{ul:['Log switches about every **15–30 minutes** at peak. Size logs for that.','Application: commit once per business transaction, not per row.','Redo on fast, low-latency storage.']},
{note:'Do not remove commits that are needed for correctness. Fix the loop that commits per row, not the commit.'}],
src:[['Redo tuning',PT]]};

/* ---------- 4: Undo and temp ---------- */
L['ora-perf:7:4']={blocks:[
{p:'**Undo** serves rollback and read consistency. **Temp** serves sorts, hash joins and temporary tables.'},
{t:[['','Undo','Temp'],
['**Used for**','Rollback, read consistency, Flashback','Sort, hash, global temporary tables'],
['**Key setting**','`UNDO_RETENTION`, undo tablespace size','Temp tablespace size, `PGA_AGGREGATE_TARGET`'],
['**Trouble**','ORA-01555 snapshot too old, long transactions','ORA-01652 unable to extend temp'],
['**Check**','`V$UNDOSTAT`, undo advisor','`V$TEMPSEG_USAGE`, `V$SORT_USAGE`']]},
{code:`SELECT begin_time, undoblks, txncount, maxquerylen, nospaceerrcnt, ssolderrcnt
FROM v$undostat ORDER BY begin_time DESC FETCH FIRST 6 ROWS ONLY;

SELECT s.sid, s.username, t.tablespace, t.blocks*8/1024 mb
FROM v$tempseg_usage t JOIN v$session s ON s.saddr=t.session_addr ORDER BY mb DESC;`},
{h:'Actions'},
{ul:['**ORA-01555:** raise `UNDO_RETENTION` to exceed the longest query, or fix the query.','**Temp growth:** find the SQL using it, fix its plan and PGA.','Use **automatic undo management** and a temp tablespace group for parallel work.']},
{note:'A huge temp use is usually a plan symptom (wrong estimates). Fix the plan, not just the tablespace size.'}],
src:[['Undo and temp',PT]]};

/* ---------- 5: CPU, latches, mutexes ---------- */
L['ora-perf:7:5']={blocks:[
{p:'**Latches** and **mutexes** are short locks on shared memory. Contention shows as CPU burn and waits like `latch: ...` or `cursor: pin S wait on X`.'},
{t:[['Wait','Often means','Look at'],
['`latch: cache buffers chains`','Hot blocks read by many sessions','The SQL and the segment (hot block)'],
['`latch: shared pool`, `library cache`','Hard parse storm','Literals, invalidations'],
['`cursor: pin S wait on X`','Hard parse of a cursor others use','Invalidations by DDL or statistics'],
['`latch: redo copy`, `redo allocation`','Heavy redo generation','Reduce logging, batch work'],
['`buffer busy waits`','Hot block or index leaf','Reverse key, hash partitioning']]},
{h:'CPU'},
{ul:['If **DB CPU** is most of DB Time, find the SQL by CPU time, not waits.','Run queue longer than cores slows everything. Check the OS (`vmstat`, `top`).','More cores help only if the SQL is parallel or sessions queue.']},
{code:`SELECT sql_id, ROUND(cpu_time/1e6) cpu_s, executions FROM v$sqlarea ORDER BY cpu_time DESC FETCH FIRST 5 ROWS ONLY;`},
{note:'Latch waits are symptoms of too much work in a small area. Reduce the **number of operations** (logical reads, parses) rather than tuning latch parameters.'}],
src:[['Latches and mutexes',PT]]};

/* ---------- 6: Resource Manager ---------- */
L['ora-perf:7:6']={blocks:[
{p:'**Resource Manager** divides CPU, parallel servers and I/O among workloads, so one group cannot starve another.'},
{t:[['Concept','Meaning'],
['**Consumer group**','A set of sessions (OLTP, REPORTS, BATCH)'],
['**Plan**','How resources are shared among groups'],
['**Directive**','Rules for one group: CPU share, limits, thresholds'],
['**Mapping**','Which sessions go to which group (user, service, program)']]},
{code:`BEGIN
  DBMS_RESOURCE_MANAGER.CREATE_PENDING_AREA;
  DBMS_RESOURCE_MANAGER.CREATE_PLAN(\'DAY_PLAN\',\'OLTP first\');
  DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP(\'OLTP_GRP\',\'Online\');
  DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP(\'RPT_GRP\',\'Reports\');
  DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(\'DAY_PLAN\',\'OLTP_GRP\',\'OLTP\',mgmt_p1=>70);
  DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(\'DAY_PLAN\',\'RPT_GRP\',\'Reports\',mgmt_p1=>20);
  DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(\'DAY_PLAN\',\'OTHER_GROUPS\',\'Rest\',mgmt_p1=>10);
  DBMS_RESOURCE_MANAGER.SUBMIT_PENDING_AREA;
END;
/
ALTER SYSTEM SET resource_manager_plan=\'DAY_PLAN\';`},
{note:'In a CDB, Resource Manager also shares resources among **PDBs** with shares and limits. Plans act only when CPU is scarce.'}],
src:[['Resource Manager',O.AD]]};

/* ---------- 7: Practical ---------- */
L['ora-perf:7:7']={blocks:[
{p:'**Tune a memory-starved instance.** Start from a deliberately small configuration and use advisors.'},
{code:`-- 1. make it small (test only)
ALTER SYSTEM SET sga_target=400M SCOPE=BOTH;
ALTER SYSTEM SET pga_aggregate_target=100M SCOPE=BOTH;

-- 2. run a mixed workload for 15 minutes (queries with sorts, joins)

-- 3. diagnose
SELECT event, wait_class, total_waits, ROUND(time_waited_micro/1e6) s FROM v$system_event
WHERE wait_class <> \'Idle\' ORDER BY time_waited_micro DESC FETCH FIRST 8 ROWS ONLY;
SELECT * FROM v$pga_target_advice;
SELECT * FROM v$sga_target_advice;

-- 4. adjust with the advice and repeat step 2`},
{h:'Check your result'},
{t:[['Check','Expected'],
['Before','`direct path read/write temp` and `db file sequential read` high'],
['PGA advice','Estimated over-allocation count above zero at the small size'],
['After increasing PGA','Less temp I/O, shorter sorts'],
['DB Time','Lower for the same workload'],
['Stop point','More memory gives no further gain']]},
{note:'Record DB Time per run in a small table. The point where it stops falling is your size, and you can justify it with data.'}],
src:[['Memory advisors',PT]]};

})();
