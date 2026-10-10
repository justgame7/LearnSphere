/* LearnSphere - Performance, Section 03: AWR, ADDM & Active Session History.
   Lectures 0-7 are core, 8+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const PT=O.D+'tgdba/';

/* ---------- diagrams ---------- */
const awr=O.dg(700,190,[
[10,50,140,90,'Instance|memory statistics|(V$ views)',0],
[200,50,140,90,'MMON|every 60 min|(default)',2],
[390,50,150,90,'AWR in SYSAUX|snapshots|DBA_HIST_*',2],
[590,10,100,60,'AWR report',0],[590,100,100,60,'ADDM',0]],
[[150,95,200,95],[340,95,390,95],[540,80,590,40],[540,110,590,130]]);

/* ---------- 0: AWR snapshots ---------- */
L['ora-perf:2:0']={blocks:[
{p:'**AWR** (Automatic Workload Repository) saves performance statistics at intervals. It is the **history** that makes before and after comparison possible.'},
{svg:awr},
{t:[['Item','Default','Change with'],
['**Snapshot interval**','60 minutes','`MODIFY_SNAPSHOT_SETTINGS`'],
['**Retention**','8 days (19c)','Same call, in minutes'],
['**Top SQL captured**','By several measures, limited per snapshot','`TOPNSQL`'],
['**Location**','SYSAUX tablespace','Check size growth']]},
{code:`-- interval 30 min, retention 30 days
EXEC DBMS_WORKLOAD_REPOSITORY.MODIFY_SNAPSHOT_SETTINGS(
       retention => 30*24*60, interval => 30);

SELECT snap_interval, retention FROM dba_hist_wr_control;

EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT;   -- manual snapshot`},
{note:'Take a **manual snapshot** just before and after a test or a problem window. It gives exact boundaries for the report.'}],
src:[['AWR',PT]]};

/* ---------- 1: Reading AWR ---------- */
L['ora-perf:2:1']={blocks:[
{p:'An AWR report is long. Read it in a **fixed order**.'},
{code:`-- SQL*Plus, as a DBA
@?/rdbms/admin/awrrpt.sql      -- single instance
@?/rdbms/admin/awrgrpt.sql     -- RAC (global)`},
{t:[['Order','Section','Look for'],
['1','**Report summary**: elapsed time, DB Time, sessions','DB Time / elapsed = AAS. Compare with cores.'],
['2','**Load Profile**','Per second and per transaction: redo, reads, parses, logons'],
['3','**Instance Efficiency**','Soft parse %, buffer hit % (context only)'],
['4','**Top 10 Foreground Events**','Share of DB Time. The core of the report.'],
['5','**Time Model**','DB CPU vs SQL execute vs parse'],
['6','**SQL ordered by Elapsed / CPU / Gets / Reads**','Statements to tune'],
['7','**Segment statistics, IO statistics**','Hot objects and files']]},
{h:'Pitfalls'},
{ul:['Do not judge by **ratios** like buffer cache hit percent. A 99% hit ratio can still be slow.','A long snapshot interval hides short spikes. Use ASH for those.','Compare with a **normal** period, not with zero.']},
{note:'Ask the report three questions: how busy (AAS), what is the top wait or CPU, and which SQL causes it.'}],
src:[['Reading AWR reports',PT]]};

/* ---------- 2: ASH report ---------- */
L['ora-perf:2:2']={blocks:[
{p:'**ASH** gives a detailed view of a **short window** (minutes), down to the second and the session.'},
{code:`-- ASH report for a 10-minute window
@?/rdbms/admin/ashrpt.sql

-- dimension: top SQL in a spike
SELECT sql_id, event, COUNT(*) samples
FROM v$active_session_history
WHERE sample_time BETWEEN TIMESTAMP \'2026-10-01 14:00:00\' AND TIMESTAMP \'2026-10-01 14:10:00\'
GROUP BY sql_id, event ORDER BY samples DESC FETCH FIRST 10 ROWS ONLY;`},
{t:[['Use ASH for','Not for'],
['A spike that AWR averaged out','Long-term trends (use AWR)'],
['Which SQL, module, user or object is at fault','Sessions that are idle'],
['Blocking chains and who waited for whom','Accurate counts of very short events'],
['Problems in the past minutes','Anything older than ASH memory without AWR']]},
{h:'Common dimensions'},
{ul:['`SQL_ID`, `EVENT`, `SESSION_ID`, `MODULE`, `ACTION`, `PROGRAM`','`CURRENT_OBJ#` (object), `BLOCKING_SESSION`, `SQL_PLAN_HASH_VALUE`']},
{note:'AWR answers "was the hour bad?". ASH answers "what exactly was running at 14:03?".'}],
src:[['ASH',PT]]};

/* ---------- 3: ADDM ---------- */
L['ora-perf:2:3']={blocks:[
{p:'**ADDM** analyses AWR snapshots and reports **findings** ranked by DB Time impact, with **recommendations**.'},
{code:`-- latest ADDM report for a range of snapshots
@?/rdbms/admin/addmrpt.sql

-- or from the dictionary
SELECT task_name, status FROM dba_advisor_tasks WHERE advisor_name=\'ADDM\' ORDER BY created DESC;
SELECT DBMS_ADVISOR.GET_TASK_REPORT(\'ADDM:...\') FROM dual;`},
{t:[['Part of a finding','Meaning'],
['**Finding**','The problem and the share of DB Time (for example 42% in I/O)'],
['**Impact**','Estimated active sessions or percent'],
['**Recommendation**','SQL tuning, schema change, parameter, hardware'],
['**Rationale**','Evidence from AWR']]},
{h:'How to use it'},
{ul:['Start with the top finding and its recommendation.','Treat it as a **hint**. Validate before applying.','ADDM runs after every AWR snapshot, automatically.']},
{note:'ADDM is a good first read of a period. It does not know your business, so check each recommendation.'}],
src:[['ADDM',PT]]};

/* ---------- 4: Baselines ---------- */
L['ora-perf:2:4']={blocks:[
{p:'**AWR baselines** keep chosen periods safe from automatic purging, and let the database compare new periods with normal ones.'},
{t:[['Baseline type','Meaning'],
['**Fixed**','A specific period you choose (for example the month-end peak)'],
['**Moving window**','Always the last N days (default 8). Used for adaptive thresholds.'],
['**Repeating template**','Creates baselines on a schedule, such as every Monday 08:00-18:00']]},
{code:`EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_BASELINE(
       start_snap_id=>1200, end_snap_id=>1210, baseline_name=>\'monthend_peak\');

SELECT baseline_name, start_snap_id, end_snap_id FROM dba_hist_baseline;

-- keep for 90 days, then it expires
EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_BASELINE(1200,1210,\'monthend\',90);`},
{h:'Thresholds'},
{p:'With a baseline, you can set **alert thresholds** as a percentage of normal for metrics such as response time per transaction. The alert fires when the system leaves its own pattern.'},
{note:'Create a baseline for every important business peak. When it happens again, you can compare in minutes.'}],
src:[['AWR baselines',PT]]};

/* ---------- 5: AWR compare ---------- */
L['ora-perf:2:5']={blocks:[
{p:'**AWR Compare Periods** shows two periods side by side, with the differences first. It is the fastest way to answer "what changed since last week?".'},
{code:`@?/rdbms/admin/awrddrpt.sql
-- asks: first period (begin, end snapshot), second period (begin, end snapshot)`},
{t:[['Look at','What a difference means'],
['**Load profile** changes','More work (users, transactions) or the same work with more resource'],
['**Top events** change','New bottleneck'],
['**SQL** with different elapsed per execution','Plan change or data growth'],
['**Instance activity** deltas','I/O, redo, parse changes'],
['**Init parameter** changes','Someone changed a setting']]},
{flow:['Choose a good period (baseline)','Choose the bad period of the same length and time of day','Run the compare report','Find the biggest change in DB Time','Investigate that area']},
{note:'Compare like with like: same weekday, same hours, same workload. A Monday morning against a Sunday night proves nothing.'}],
src:[['AWR Compare Periods',PT]]};

/* ---------- 6: AWR in multitenant ---------- */
L['ora-perf:2:6']={blocks:[
{p:'In a **CDB**, AWR data is collected in the **root** and, if enabled, also in each **PDB**.'},
{t:[['Mode','Where data is stored','Notes'],
['**Root AWR (default)**','CDB root, with data for all containers','CDB-level report and per-PDB views with `CON_ID`'],
['**PDB-level AWR**','Inside the PDB','The PDB owner can take snapshots and run reports. Enable with `AWR_PDB_AUTOFLUSH_ENABLED`.']]},
{code:`-- enable automatic snapshots inside a PDB
ALTER SESSION SET CONTAINER=pdb1;
ALTER SYSTEM SET awr_pdb_autoflush_enabled=TRUE;
EXEC DBMS_WORKLOAD_REPOSITORY.MODIFY_SNAPSHOT_SETTINGS(interval=>60);

-- reports use awr_root / awr_pdb views
@?/rdbms/admin/awrrpt.sql   -- choose the location, root or PDB`},
{h:'Views'},
{ul:['`AWR_ROOT_*`: data collected in the root.','`AWR_PDB_*`: data of one PDB.','`AWR_CDB_*`: across containers.']},
{note:'Per-PDB AWR is important when a PDB owner is responsible for their own tuning. Make it a conscious decision, since storage grows.'}],
src:[['AWR in multitenant',PT]]};

/* ---------- 7: Practical ---------- */
L['ora-perf:2:7']={blocks:[
{p:'**Diagnose a regression** with AWR and ASH. Create a before and an after period with a deliberate change.'},
{flow:['Take a snapshot, run a reasonable workload for 10 minutes, take a snapshot (period A)','Introduce a change: drop an index used by the workload','Run the same workload for 10 minutes, with snapshots (period B)','Run `awrddrpt.sql` for A and B','Use ASH on period B to confirm the SQL and event']},
{code:`-- the "bad change"
DROP INDEX app.orders_cust_ix;

-- after period B
SELECT sql_id, event, COUNT(*)
FROM dba_hist_active_sess_history
WHERE snap_id BETWEEN :b1 AND :b2
GROUP BY sql_id, event ORDER BY 3 DESC FETCH FIRST 5 ROWS ONLY;`},
{h:'Check your result'},
{t:[['Question','Expected finding'],
['Top event in B','db file scattered read (full scans) instead of index reads'],
['Which SQL','The one that used the dropped index'],
['ADDM','Recommends an index or SQL tuning on that statement'],
['Fix','Recreate the index, run again (period C) and compare']]},
{note:'You followed the loop: measure, find, fix, verify. In real systems, the fix is rarely a dropped index, but the process is the same.'}],
src:[['Diagnosing with AWR and ASH',PT]]};

})();
