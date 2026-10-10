/* LearnSphere - Performance, Section 02: Wait Interface & Dynamic Views.
   Lectures 0-5 are core, 6+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const PT=O.D+'tgdba/';

/* ---------- diagrams ---------- */
const wi=O.dg(700,170,[
[10,45,130,80,'Session|runs',2],
[190,45,130,80,'Needs a resource|(block, lock, log)',0],
[370,45,130,80,'Must wait|event recorded',2],
[550,45,140,80,'V$SESSION_WAIT,|ASH, AWR|count the time',0]],
[[140,85,190,85],[320,85,370,85],[500,85,550,85]]);

/* ---------- 0: Wait interface ---------- */
L['ora-perf:1:0']={blocks:[
{p:'Every time a session cannot continue, Oracle records **why**. This is the **wait interface**, and it is the base of all Oracle tuning.'},
{svg:wi},
{t:[['Term','Meaning'],
['**Wait event**','Named reason: `db file sequential read`, `log file sync`, `enq: TX - row lock contention`'],
['**P1, P2, P3**','Parameters that identify the object, such as file#, block#, blocks'],
['**Wait class**','Group of events (User I/O, Concurrency, ...)'],
['**Time waited**','Duration of the wait'],
['**Idle events**','Waiting for work, such as `SQL*Net message from client`. Not a problem.']]},
{h:'Three levels of data'},
{t:[['Level','View','Scope'],
['**Now**','`V$SESSION`, `V$SESSION_WAIT`','Current wait of each session'],
['**Since startup**','`V$SYSTEM_EVENT`, `V$SESSION_EVENT`','Cumulative'],
['**History**','`V$ACTIVE_SESSION_HISTORY`, `DBA_HIST_*`','Sampled history']]},
{note:'Since 10g, `V$SESSION` carries the current event, so you often do not need `V$SESSION_WAIT`.'}],
src:[['Wait events',PT]]};

/* ---------- 1: V$SESSION, ASH ---------- */
L['ora-perf:1:1']={blocks:[
{p:'Three views answer "what is happening **right now**" and "what happened a few minutes ago".'},
{code:`-- who is waiting and for what
SELECT sid, serial#, username, status, event, wait_class,
       seconds_in_wait, sql_id, blocking_session
FROM v$session
WHERE type=\'USER\' AND wait_class <> \'Idle\'
ORDER BY seconds_in_wait DESC;

-- last 10 minutes: top events
SELECT event, COUNT(*) samples
FROM v$active_session_history
WHERE sample_time > SYSDATE - 10/1440
GROUP BY event ORDER BY samples DESC;`},
{t:[['View','Strength','Note'],
['`V$SESSION`','Instant state: SQL, event, blocker','Only the present'],
['`V$ACTIVE_SESSION_HISTORY`','Samples of active sessions every second, in memory','Recent. Needs Diagnostics Pack.'],
['`DBA_HIST_ACTIVE_SESS_HISTORY`','One in ten samples saved to AWR','Longer history, needs the pack']]},
{h:'Rule of thumb'},
{p:'**1 ASH sample is roughly 1 second of DB time.** Count samples per event, SQL or user to find where time goes.'},
{note:'`V$ACTIVE_SESSION_HISTORY` is part of the Diagnostics Pack. Without the license use `V$SESSION` sampling by yourself.'}],
src:[['V$SESSION and ASH',O.RF]]};

/* ---------- 2: V$SYSSTAT, V$SYSTEM_EVENT ---------- */
L['ora-perf:1:2']={blocks:[
{p:'**Cumulative** views show totals since startup. Take **two readings** and subtract to see a period.'},
{t:[['View','Content','Use'],
['`V$SYSSTAT`','Counters: user commits, parse count, physical reads, redo size','Load and ratios'],
['`V$SYSTEM_EVENT`','Total waits and time per event','Where the instance waits'],
['`V$SYS_TIME_MODEL`','DB Time, DB CPU, parse time, SQL execute time','Where time goes by activity'],
['`V$OSSTAT`','OS CPU and load','Is the host busy?'],
['`V$SESSTAT`, `V$SESSION_EVENT`','The same for one session','One problem session']]},
{code:`-- top non-idle wait events since startup
SELECT event, wait_class, total_waits,
       ROUND(time_waited_micro/1e6) seconds,
       ROUND(time_waited_micro/NULLIF(total_waits,0)/1000,2) avg_ms
FROM v$system_event
WHERE wait_class <> \'Idle\'
ORDER BY time_waited_micro DESC FETCH FIRST 10 ROWS ONLY;`},
{note:'A single reading since startup mixes quiet nights and busy days. Use the **difference** of two readings, or AWR, which does it for you.'}],
src:[['Statistics views',O.RF]]};

/* ---------- 3: Common waits ---------- */
L['ora-perf:1:3']={blocks:[
{p:'A short field guide to the events you meet most.'},
{t:[['Event','Meaning','Usual direction'],
['**db file sequential read**','Single-block read (index or by ROWID)','Slow I/O, or too many index reads. Check the SQL.'],
['**db file scattered read**','Multiblock read (full scan)','Missing index, or scans are wanted'],
['**direct path read**','Large reads bypassing cache','Parallel or large scan. Normal in analytics.'],
['**log file sync**','Commit waits for redo write','Slow redo disk or too many commits'],
['**log file parallel write**','LGWR writing redo','Redo disk latency'],
['**buffer busy waits**','Many sessions want the same block','Hot block, contention'],
['**enq: TX - row lock contention**','Waiting for a row lock','Application locking. Find the blocker.'],
['**library cache lock/pin**, **cursor: pin S wait on X**','Parse and invalidation contention','Hard parses, DDL on busy objects'],
['**free buffer waits**','No clean buffer in cache','DBWR cannot keep up or cache too small'],
['**SQL*Net message from client**','Idle: waiting for the client','Ignore, unless the app is slow']]},
{note:'Do not tune an event because it looks scary. Tune the event that **consumes the most DB Time** and then ask which SQL causes it.'}],
src:[['Wait event reference',O.RF]]};

/* ---------- 4: V$SQL ---------- */
L['ora-perf:1:4']={blocks:[
{p:'`V$SQL` and `V$SQLAREA` hold statistics for every statement in the **shared pool**. Sort them to find the expensive ones.'},
{code:`-- top 5 by elapsed time per execution and total
SELECT sql_id, plan_hash_value, executions,
       ROUND(elapsed_time/1e6,1) elapsed_s,
       ROUND(elapsed_time/NULLIF(executions,0)/1e6,3) per_exec_s,
       buffer_gets, disk_reads, rows_processed,
       SUBSTR(sql_text,1,60) text
FROM v$sqlarea
ORDER BY elapsed_time DESC FETCH FIRST 5 ROWS ONLY;`},
{t:[['Column','Tells you'],
['`ELAPSED_TIME`','Total time, microseconds'],
['`CPU_TIME`','CPU part'],
['`BUFFER_GETS`','Logical reads, a good cost measure'],
['`DISK_READS`','Physical reads'],
['`EXECUTIONS`','How often'],
['`PLAN_HASH_VALUE`','Which plan, and if it changed']]},
{h:'Two kinds of heavy SQL'},
{ul:['**One slow execution:** a bad plan. Tune that statement.','**Cheap but run millions of times:** reduce calls in the application.']},
{note:'`V$SQL` forgets when a cursor ages out. AWR keeps top SQL history. `V$SQLSTATS` is a lighter alternative with longer retention in memory.'}],
src:[['V$SQL',O.RF]]};

/* ---------- 5: Practical ---------- */
L['ora-perf:1:5']={blocks:[
{p:'Find **what a slow database is waiting on**. Create load, then diagnose it with the views.'},
{code:`-- 1. create a problem: session A holds a row lock
UPDATE app.orders SET total = total WHERE id = 1;   -- do not commit

-- 2. session B and C try the same row (they hang)
UPDATE app.orders SET total = total + 1 WHERE id = 1;

-- 3. session D: diagnose
SELECT sid, event, blocking_session, seconds_in_wait, sql_id
FROM v$session WHERE blocking_session IS NOT NULL;

SELECT event, COUNT(*) FROM v$active_session_history
WHERE sample_time > SYSDATE - 5/1440 GROUP BY event ORDER BY 2 DESC;`},
{h:'Questions'},
{t:[['Question','Where you found it'],
['Which event are B and C waiting on?','`V$SESSION.EVENT`'],
['Who is the blocker?','`BLOCKING_SESSION`'],
['What SQL is the blocker running?','`V$SESSION` or `V$SQL` by `SQL_ID`'],
['What share of recent DB time is this wait?','ASH count']]},
{h:'Check your result'},
{ul:['Waiters show `enq: TX - row lock contention`.','The blocker is idle (waiting for the client) and holds the lock.','After `COMMIT` in session A, B and C continue.']},
{note:'The blocker is **idle**, not busy. A common surprise: the problem is a session that forgot to commit, not a slow query.'}],
src:[['Dynamic views',O.RF]]};

})();
