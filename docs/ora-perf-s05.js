/* LearnSphere - Performance, Section 05: Execution Plans & SQL Diagnostics.
   Lectures 0-7 are core, 8+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const TG=O.D+'tgsql/';

/* ---------- diagrams ---------- */
const joins=O.dg(700,200,[
[10,20,210,160,'Nested loops',1],[25,55,180,40,'For each outer row...',0],[25,105,180,55,'probe inner by index.|Good: few rows.',0],
[245,20,210,160,'Hash join',1],[260,55,180,40,'Build hash on small side',0],[260,105,180,55,'Probe with big side.|Good: large sets.',0],
[480,20,210,160,'Sort merge',1],[495,55,180,40,'Sort both inputs',0],[495,105,180,55,'Merge. Good: sorted,|non-equality joins.',0]],[]);

/* ---------- 0: EXPLAIN PLAN and DBMS_XPLAN ---------- */
L['ora-perf:4:0']={blocks:[
{p:'An **execution plan** is the tree of steps Oracle uses to run a SQL. Read it from the **innermost, most indented** step outward.'},
{code:`EXPLAIN PLAN FOR
SELECT c.name, SUM(o.total)
FROM app.customers c JOIN app.orders o ON o.cust_id = c.id
WHERE o.order_date > SYSDATE - 30
GROUP BY c.name;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, \'TYPICAL\'));`},
{t:[['Column','Meaning'],
['**Id / Operation**','Step number and what it does (`TABLE ACCESS FULL`, `INDEX RANGE SCAN`, `HASH JOIN`)'],
['**Name**','Table or index used'],
['**Rows (E-Rows)**','**Estimated** rows'],
['**Cost**','Optimizer cost units'],
['**Predicate Information**','Where each filter and join is applied: `access` vs `filter`']]},
{h:'Reading order'},
{ul:['The deepest indented step runs first.','Siblings at the same level run top to bottom.','Parents consume the output of their children.']},
{note:'`EXPLAIN PLAN` shows the **expected** plan, not necessarily the one actually used (bind peeking, session settings). For the real plan use the cursor cache, the next lectures.'}],
src:[['EXPLAIN PLAN',TG]]};

/* ---------- 1: Access paths ---------- */
L['ora-perf:4:1']={blocks:[
{p:'The **access path** is how Oracle reads a table.'},
{t:[['Access path','How','Best when'],
['**TABLE ACCESS FULL**','Reads all blocks below the high-water mark','Most rows needed, or small table'],
['**INDEX UNIQUE SCAN**','One index entry by unique key','Single-row lookup'],
['**INDEX RANGE SCAN**','A range of index entries','Selective predicate on indexed column'],
['**INDEX FULL SCAN / FAST FULL SCAN**','Read the whole index (ordered, or multiblock unordered)','Index covers the query, avoids the table'],
['**INDEX SKIP SCAN**','Skips the leading column when it has few values','Few distinct values in the leading column'],
['**TABLE ACCESS BY ROWID**','Fetch the row after the index','After any index access']]},
{h:'Common mistakes'},
{ul:['A full scan is **not** always bad. For 30% of rows it is usually best.','An index is not used if you apply a function to the column: `WHERE TRUNC(d)=...`. Use a range, or a function-based index.','A type mismatch (comparing a string column to a number) disables the index.']},
{note:'Read `E-Rows` first. If the optimizer thought 10 rows and there are 1 million, the access path was chosen for the wrong reason.'}],
src:[['Access paths',TG]]};

/* ---------- 2: Join methods ---------- */
L['ora-perf:4:2']={blocks:[
{p:'Three join methods. The optimizer picks one for each join based on row estimates.'},
{svg:joins},
{t:[['Method','Cost grows with','Needs','Risk'],
['**Nested loops**','Outer rows x cost of inner lookup','An index on the inner join column','Terrible if outer is large'],
['**Hash join**','Size of both inputs','Memory (PGA) for the hash table','Spills to temp if too large'],
['**Sort merge**','Sorting both sides','Sort area, ordered inputs help','Rare. Used for non-equi joins.']]},
{h:'Practical rules'},
{ul:['A **nested loops** with a big outer and a full scan inner is a classic disaster.','A **hash join** with small estimated rows but real big data spills to temp. Check estimates.','Join **order** matters: smaller, filtered tables first.']},
{note:'You rarely force a join method. Fix the **estimates** (statistics) or the **SQL**, and the optimizer picks the right one.'}],
src:[['Joins',TG]]};

/* ---------- 3: Plans from cursor cache and AWR ---------- */
L['ora-perf:4:3']={blocks:[
{p:'To see the plan a statement **really used**, read it from the cursor cache or AWR.'},
{code:`-- last executed statement of this session
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, \'ALLSTATS LAST\'));

-- by SQL_ID, with actual rows (needs gather_plan_statistics hint or STATISTICS_LEVEL=ALL)
SELECT /*+ gather_plan_statistics */ COUNT(*) FROM app.orders WHERE status=\'NEW\';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(\'&sql_id\', 0, \'ALLSTATS LAST\'));

-- from AWR (history)
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_AWR(\'&sql_id\'));`},
{t:[['Format','Shows'],
['`TYPICAL`','Plan with estimates and predicates'],
['`ALLSTATS LAST`','Estimates **and actuals** (A-Rows, A-Time, buffers) for the last run'],
['`ADVANCED`','Outline, query blocks, and bind values peeked']]},
{h:'Find mismatches'},
{p:'Compare **E-Rows** with **A-Rows** step by step. The first step where they differ widely is where the optimizer started to be wrong.'},
{note:'Use the `gather_plan_statistics` hint in test, not in production code. It adds overhead for each execution.'}],
src:[['DBMS_XPLAN',TG]]};

/* ---------- 4: SQL Monitor ---------- */
L['ora-perf:4:4']={blocks:[
{p:'**Real-time SQL Monitoring** tracks long-running SQL (over 5 seconds of CPU or I/O, or parallel) and shows **where time goes** in the plan, while it runs.'},
{code:`-- text report
SELECT DBMS_SQLTUNE.REPORT_SQL_MONITOR(sql_id=>\'&sql_id\', type=>\'TEXT\', report_level=>\'ALL\') FROM dual;

-- HTML or Active report (best)
SELECT DBMS_SQLTUNE.REPORT_SQL_MONITOR(sql_id=>\'&sql_id\', type=>\'ACTIVE\') FROM dual;

SELECT sql_id, status, elapsed_time/1e6 s FROM v$sql_monitor ORDER BY sql_exec_start DESC;`},
{t:[['What you see','Why it helps'],
['**Time per plan line**','Find the step that costs most'],
['**Estimated vs actual rows**','Spot wrong estimates'],
['**Progress while running**','Know if it is stuck or nearly done'],
['**Parallel server details**','Skew between parallel processes']]},
{note:'This needs the **Tuning Pack**. It is the best single tool for one slow SQL, since it shows plan, time and rows together.'}],
src:[['SQL Monitor',TG]]};

/* ---------- 5: SQL Trace and TKPROF ---------- */
L['ora-perf:4:5']={blocks:[
{p:'**SQL trace** records every call of a session: parse, execute, fetch, waits and binds. **TKPROF** formats the trace file. It needs no extra license.'},
{code:`-- trace your own session with waits and binds
ALTER SESSION SET tracefile_identifier=\'mytest\';
EXEC DBMS_MONITOR.SESSION_TRACE_ENABLE(waits=>TRUE, binds=>TRUE);
-- run the work
EXEC DBMS_MONITOR.SESSION_TRACE_DISABLE;

-- another session
EXEC DBMS_MONITOR.SESSION_TRACE_ENABLE(session_id=>123, serial_num=>4567, waits=>TRUE, binds=>FALSE);

SELECT value FROM v$diag_info WHERE name=\'Default Trace File\';`},
{code:`tkprof orcl_ora_12345_mytest.trc out.txt sys=no sort=exeela,fchela`},
{t:[['TKPROF column','Meaning'],
['**parse / execute / fetch**','Calls, CPU, elapsed, disk, query (consistent gets), current, rows'],
['**Misses in library cache**','Hard parses'],
['**Wait event summary**','Where elapsed time went']]},
{h:'Read it'},
{ul:['Compare **elapsed** with **cpu**. A big gap means waiting.','Many **parse** counts mean the application does not reuse cursors.','Large **query** counts per row point to inefficient access.']},
{note:'Trace shows **one session in detail**. Use it when AWR and ASH have narrowed the problem to a specific program.'}],
src:[['SQL trace and TKPROF',TG]]};

/* ---------- 6: Bind peeking and ACS ---------- */
L['ora-perf:4:6']={blocks:[
{p:'**Bind variables** let many executions share one cursor. They also make the optimizer choose a plan from the **first** bind value, which can be wrong for others.'},
{t:[['Concept','Meaning'],
['**Bind peeking**','On hard parse, the optimizer looks at the actual bind value to estimate rows'],
['**Plan instability**','The plan is great for a rare value and terrible for a common one (or reverse)'],
['**Adaptive Cursor Sharing (ACS)**','After a poor run, Oracle marks the cursor **bind-sensitive**, later creates several plans (**bind-aware**) per range of values'],
['**Skewed columns**','Where it matters: a histogram exists and values have very different counts']]},
{code:`SELECT sql_id, child_number, plan_hash_value, is_bind_sensitive, is_bind_aware, is_shareable
FROM v$sql WHERE sql_id=\'&sql_id\';`},
{flow:['First execution peeks the bind and picks a plan','Later executions with other values run poorly','Oracle sees large changes in work, marks bind-sensitive','Next hard parse creates a bind-aware child cursor with a better plan']},
{note:'If a SQL alternates between fast and slow with the same text, suspect bind peeking. Compare plan hash values per child cursor.'}],
src:[['Adaptive cursor sharing',TG]]};

/* ---------- 7: Practical ---------- */
L['ora-perf:4:7']={blocks:[
{p:'**Diagnose five slow queries.** For each, find the cause and name the fix.'},
{t:[['#','Symptom','Likely cause','Fix to try'],
['1','Index exists, full scan used for a selective filter','Function on column (`TRUNC(d)`)','Rewrite as range or function-based index'],
['2','Nested loops with huge outer','Estimates too low','Gather statistics, extended statistics'],
['3','Hash join spilling to temp','Estimates too low or PGA too small','Fix estimates, size PGA'],
['4','Same SQL fast then slow','Bind peeking on skewed column','Histogram, ACS, or SQL plan baseline'],
['5','Thousands of executions, each fast','Application loops row by row','Set-based SQL, array processing']]},
{h:'Tools to use for each'},
{code:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(\'&sql_id\',NULL,\'ALLSTATS LAST +PEEKED_BINDS\'));
SELECT sql_id, executions, ROUND(elapsed_time/1e6,1) s, buffer_gets FROM v$sql WHERE sql_id=\'&sql_id\';`},
{h:'Check your result'},
{ul:['For each query: estimated rows compared with actual rows.','A named cause and one fix, tested.','Before and after elapsed time recorded.']},
{note:'Write the five diagnoses as a one-page checklist. It becomes your first look at any slow SQL.'}],
src:[['SQL diagnostics',TG]]};

})();
