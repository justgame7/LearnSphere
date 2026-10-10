/* LearnSphere - Performance, Section 10: Concurrency, Locking & Hang Analysis.
   Lectures 0-5 are core, 6+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const PT=O.D+'tgdba/';

/* ---------- diagrams ---------- */
const chain=O.dg(700,170,[
[10,50,130,70,'Session A|holds row lock|(idle, no commit)',2],
[190,50,130,70,'Session B|waits for A',0],
[370,50,130,70,'Session C|waits for B|(or A)',0],
[550,50,140,70,'Application|appears hung',0]],
[[140,85,190,85],[320,85,370,85],[500,85,550,85]]);

/* ---------- 0: Locks and enqueues ---------- */
L['ora-perf:9:0']={blocks:[
{p:'Oracle uses **enqueues** (locks) to protect data and structures. Readers do not block writers, and writers do not block readers.'},
{t:[['Lock','Protects','Common wait'],
['**TX** (transaction)','A row or a transaction slot','`enq: TX - row lock contention`'],
['**TM** (table)','Table structure during DML/DDL','`enq: TM - contention` (missing foreign key index)'],
['**UL** (user)','Application locks (`DBMS_LOCK`)','`enq: UL - contention`'],
['**ST**, **HW**, **CF**','Space, high-water mark, control file','Space management, contention'],
['**TX - allocate ITL**','No free transaction slot in a block','Tune `INITRANS`, `PCTFREE`']]},
{h:'Modes'},
{ul:['**Row exclusive** (DML): many sessions can hold it on a table.','**Share, exclusive** (DDL, some operations): block others.']},
{h:'Typical causes'},
{ul:['An application holds a transaction open (no commit), often after an error.','A foreign key without an index causes table locks on the parent.','Batch jobs updating the same rows as online work.']},
{note:'Most "locking" problems are about **transaction length**. Keep transactions short and commit, or roll back, on errors.'}],
src:[['Locks',O.CN]]};

/* ---------- 1: Blockers and waiters ---------- */
L['ora-perf:9:1']={blocks:[
{p:'To resolve a blocking problem, find the **root blocker**, not the first waiter.'},
{svg:chain},
{code:`-- who waits for whom
SELECT sid, serial#, username, event, blocking_session, final_blocking_session, seconds_in_wait, sql_id
FROM v$session WHERE blocking_session IS NOT NULL;

-- the root blockers
SELECT DISTINCT final_blocking_session FROM v$session WHERE final_blocking_session IS NOT NULL;

-- what is the blocker doing, and when did the transaction start?
SELECT s.sid, s.status, s.machine, s.program, s.last_call_et, t.start_time, s.sql_id, s.prev_sql_id
FROM v$session s LEFT JOIN v$transaction t ON t.addr = s.taddr WHERE s.sid = &root_sid;`},
{t:[['Blocker state','Meaning','Action'],
['**INACTIVE**, long `last_call_et`','Idle, holding a transaction','Contact the owner. Kill only if justified.'],
['**ACTIVE**','Running a long statement','Wait, or investigate the SQL'],
['Not in the DB (a lock from a link or XA)','Distributed transaction','Check `DBA_2PC_PENDING`']]},
{code:`ALTER SYSTEM KILL SESSION \'sid,serial#,@inst\' IMMEDIATE;`},
{note:'Killing a session rolls back its work, which may take as long as the work took. Prefer asking the owner to commit or roll back.'}],
src:[['Locks and blockers',PT]]};

/* ---------- 2: Deadlocks ---------- */
L['ora-perf:9:2']={blocks:[
{p:'A **deadlock** is two sessions each holding what the other needs. Oracle detects it and **rolls back one statement** of one session (ORA-00060).'},
{flow:['Session 1 locks row A','Session 2 locks row B','Session 1 wants row B and waits','Session 2 wants row A and waits','Oracle detects the cycle after about 3 seconds','One statement fails with ORA-00060, the other continues']},
{h:'Where to look'},
{ul:['**Alert log** shows `ORA-00060: Deadlock detected` and a trace file name.','The **trace file** has the deadlock graph: sessions, locks, the SQL, and the row.']},
{h:'How to prevent'},
{t:[['Cause','Fix'],
['Different order of updates','Always update tables and rows in the same order'],
['Missing foreign key index','Index the foreign key columns'],
['Bitmap index concurrent DML','Avoid bitmap indexes in OLTP'],
['No free ITL slot','Increase `INITRANS`'],
['Long transactions','Commit sooner']]},
{note:'A deadlock is an **application bug**. Oracle resolves it for you, but only the code can stop it from happening again.'}],
src:[['Deadlocks',O.CN]]};

/* ---------- 3: Library cache / row lock contention ---------- */
L['ora-perf:9:3']={blocks:[
{p:'Two other families of contention show up in hangs and slowdowns.'},
{t:[['','Library cache contention','Row lock contention'],
['**Waits**','`library cache lock`, `library cache pin`, `cursor: pin S wait on X`','`enq: TX - row lock contention`'],
['**Cause**','DDL or statistics gathering on busy objects, invalidation, hard parse storms','Concurrent updates of the same rows'],
['**Find**','`V$SESSION` with `P1RAW`, `V$SQL` invalidations, `DBA_DDL_LOCKS`','Blocker from `V$SESSION`'],
['**Fix**','Do DDL in quiet windows, avoid invalidation, use binds','Shorter transactions, redesign hot rows (counters)']]},
{code:`-- objects with many invalidations
SELECT sql_id, invalidations, loads, parse_calls, SUBSTR(sql_text,1,60) FROM v$sql ORDER BY invalidations DESC FETCH FIRST 5 ROWS ONLY;

-- sessions waiting on library cache
SELECT sid, event, p1raw, p2raw FROM v$session WHERE event LIKE \'%library cache%\' OR event LIKE \'cursor:%\';`},
{h:'Hot rows'},
{ul:['A single counter row updated by every transaction becomes a queue. Use a **sequence** or partition the counter.','`SELECT ... FOR UPDATE` over many rows holds more locks than needed. Use `SKIP LOCKED` for queues.']},
{note:'Gathering statistics on a hot table at peak invalidates cursors. Use `NO_INVALIDATE` options and a quiet window.'}],
src:[['Contention',PT]]};

/* ---------- 4: Hang method ---------- */
L['ora-perf:9:4']={blocks:[
{p:'When the database "hangs", follow a fixed method. Do not restart first, because you lose the evidence.'},
{flow:['Can you connect? Use a preliminary connection if not','Is the host healthy? CPU, memory, swap, disk full','Look at the wait events of all sessions (ASH, V$SESSION)','Find the root blocker and what it waits for','Take hang analysis and systemstate dumps if still stuck','Act: resolve the blocker, free space, or restart as a last step']},
{code:`-- when normal connection hangs
sqlplus -prelim / as sysdba
ORADEBUG SETMYPID
ORADEBUG HANGANALYZE 3
ORADEBUG DUMP SYSTEMSTATE 258
ORADEBUG TRACEFILE_NAME`},
{t:[['Common cause','Check'],
['Archive destination full / FRA full','Alert log, `V$RECOVERY_FILE_DEST`'],
['Blocking chain','`V$SESSION.FINAL_BLOCKING_SESSION`'],
['Host out of memory or swapping','`vmstat`, `free`'],
['Runaway SQL using all CPU','Top SQL, ASH'],
['Storage problem','`iostat`, alert log I/O errors'],
['Resource limit (PROCESSES, SESSIONS)','`V$RESOURCE_LIMIT`']]},
{note:'The **alert log** is the first file to read. In most hangs, the reason (archive full, ORA-00257, blocker) is written there.'}],
src:[['Hang analysis',O.AD]]};

/* ---------- 5: Practical ---------- */
L['ora-perf:9:5']={blocks:[
{p:'**Resolve a production blocking chain.** Build one on a test database.'},
{code:`-- Session 1 (the culprit): update and wait, do not commit
UPDATE app.orders SET total = total WHERE id = 1;

-- Sessions 2 and 3: try to update the same row
UPDATE app.orders SET total = total + 1 WHERE id = 1;

-- Session 4 (you): diagnose
SELECT sid, serial#, event, blocking_session, final_blocking_session, seconds_in_wait
FROM v$session WHERE blocking_session IS NOT NULL;

SELECT s.sid, s.status, s.machine, s.program, s.last_call_et
FROM v$session s WHERE s.sid = &root;`},
{h:'Decision'},
{flow:['Identify the root blocker','Find the owner and the program','Ask them to commit or roll back','If they cannot be reached and the business impact is high, kill the session','Confirm the waiters continue','Write a one-paragraph incident note']},
{h:'Check your result'},
{t:[['Check','Expected'],
['Root blocker identified','Session 1 (not the first waiter)'],
['Waiters','Continue after commit or kill'],
['Note','Cause, impact, time, prevention (shorter transactions, timeouts)']]},
{note:'Consider preventing it: application timeouts, `ddl_lock_timeout`, and monitoring alerts for sessions blocking for more than a few minutes.'}],
src:[['Locks and blockers',PT]]};

})();
