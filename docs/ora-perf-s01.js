/* LearnSphere - Performance, Section 01: Performance Foundations & Method.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const PT=O.D+'tgdba/';

/* ---------- diagrams ---------- */
const method=O.dg(700,160,[
[10,45,120,70,'1. Measure|baseline and|symptom',2],
[170,45,120,70,'2. Find|where the time|goes',0],
[330,45,120,70,'3. Fix|one change|at a time',0],
[490,45,120,70,'4. Verify|compare with|baseline',0],
[640,45,50,70,'Repeat',0]],
[[130,80,170,80],[290,80,330,80],[450,80,490,80],[610,80,640,80]]);

const dbt=O.dg(700,190,[
[10,30,680,130,'DB Time = time sessions spend in the database',1],
[30,70,300,70,'CPU time|(running on CPU)',2],
[360,70,310,70,'Wait time|(waiting: I/O, locks, network, latches)',0]],[]);

/* ---------- 0: Methodology ---------- */
L['ora-perf:0:0']={blocks:[
{p:'Tuning by guessing wastes time and breaks things. Use one method, every time.'},
{svg:method},
{t:[['Step','Question','Typical tool'],
['**Measure**','What is slow, for whom, how slow compared with before?','Baseline, user report, AWR'],
['**Find**','Where does the database spend its time?','DB Time, wait events, ASH, SQL Monitor'],
['**Fix**','What is the smallest change at the biggest cost?','SQL change, index, statistics, parameter'],
['**Verify**','Did the symptom improve and nothing else get worse?','Same measurement, before and after']]},
{h:'Rules'},
{ul:['Define success in numbers: "report finishes in under 30 s".','Change **one** thing at a time.','Start with the biggest time consumer, not the most interesting one.','Tune the **application** (SQL, design) before the instance, and the instance before the hardware.']},
{note:'Most real performance problems are SQL and design problems. Resizing memory rarely fixes a bad query.'}],
src:[['Performance Tuning Guide',PT]]};

/* ---------- 1: DB Time ---------- */
L['ora-perf:0:1']={blocks:[
{p:'Oracle measures work as **DB Time**: all the time user sessions spend either **on CPU** or **waiting**. Reduce DB Time and users are faster.'},
{svg:dbt},
{t:[['Term','Meaning'],
['**DB Time**','Total time of foreground sessions in database calls (CPU + non-idle waits)'],
['**DB CPU**','Part of DB Time on CPU'],
['**Wait event**','A named reason a session is waiting, such as `db file sequential read`'],
['**Wait class**','A group of events: User I/O, System I/O, Concurrency, Commit, Network, Application, Configuration, Idle'],
['**Average Active Sessions (AAS)**','DB Time divided by elapsed time. If AAS exceeds CPU cores, sessions queue.']]},
{code:`SELECT stat_name, ROUND(value/1000000) seconds
FROM v$sys_time_model
WHERE stat_name IN (\'DB time\',\'DB CPU\',\'sql execute elapsed time\',\'parse time elapsed\');`},
{note:'A long wait is not always a problem. Judge a wait by how large a share of **DB Time** it takes, not by its name.'}],
src:[['Time model and wait classes',PT]]};

/* ---------- 2: Proactive vs reactive, baselines ---------- */
L['ora-perf:0:2']={blocks:[
{p:'You can only call a number "bad" if you know what is **normal**. A **baseline** is a saved set of normal numbers.'},
{t:[['','Reactive','Proactive'],
['**Start**','A user complains','Metrics and trends show a problem first'],
['**Data**','Gathered now, no comparison','Baseline and history exist'],
['**Result**','Slow diagnosis, stress','Fix before users notice']]},
{h:'What to baseline'},
{ul:['Load: transactions per second, user calls, logons.','Time: DB Time per second, AAS, top waits.','Resources: CPU, I/O throughput and latency, memory.','Top SQL and their usual elapsed time.']},
{flow:['Capture AWR baselines for a normal day and peak day','Define thresholds (alerts) from them','Compare new snapshots with the baseline','Investigate deviations before users report']},
{note:'Take a baseline **before** every change (patch, upgrade, new release). Without it, you cannot show what the change did.'}],
src:[['Baselines',PT]]};

/* ---------- 3: Tools map ---------- */
L['ora-perf:0:3']={blocks:[
{p:'Many tools, one map. Pick the tool by the **question**.'},
{t:[['Tool','Question it answers','Granularity'],
['**AWR**','What happened over a period?','Snapshots, usually hourly'],
['**ASH**','What was each session doing, second by second?','Sampled every second'],
['**ADDM**','What is the likely cause and fix?','Analyses an AWR period'],
['**SQL Monitor**','How is this long SQL running right now?','One execution'],
['**SQL Tuning Advisor**','How can this SQL be improved?','One SQL'],
['**Segment / Access Advisor**','Which structures help?','Workload'],
['**V$ views**','What is happening right now?','Instant']]},
{flow:['System slow? Look at AWR or ASH for the top waits','One SQL slow? SQL Monitor and the plan','Need a recommendation? ADDM and advisors','Live emergency? V$ views and ASH']},
{note:'Most of these tools need the **Diagnostics Pack** or **Tuning Pack**. See the next lecture before you use them in production.'}],
src:[['Performance tools',PT]]};

/* ---------- 4: Licensing ---------- */
L['ora-perf:0:4']={blocks:[
{p:'Many performance features are **licensed options**. Using them without a license is a compliance risk. Check before you query these views or run these reports.'},
{t:[['Pack','Includes (examples)'],
['**Diagnostics Pack**','AWR and `DBA_HIST_*` views, ASH and `V$ACTIVE_SESSION_HISTORY`, ADDM, AWR reports, baselines'],
['**Tuning Pack**','SQL Tuning Advisor, SQL Access Advisor, SQL Monitor, SQL Profiles. Requires the Diagnostics Pack.'],
['**Real Application Testing**','Database Replay, SQL Performance Analyzer'],
['**Included in Enterprise Edition**','Statspack, `V$` dynamic views, `EXPLAIN PLAN`, `DBMS_XPLAN` display of cursor cache, SQL trace and TKPROF, SQL Plan Management']]},
{code:`-- Prevent use of the packs if you are not licensed
ALTER SYSTEM SET control_management_pack_access=\'NONE\' SCOPE=BOTH;
-- Values: NONE, DIAGNOSTIC, DIAGNOSTIC+TUNING`},
{h:'Free alternatives'},
{ul:['**Statspack** for snapshot reports, without AWR.','`V$` views and trace files.','Manual SQL tuning with `DBMS_XPLAN` and hints.']},
{note:'Always confirm against the Licensing Information User Manual for your release and your contract. This lecture is a guide, not a legal answer.'}],
src:[['Licensing Information User Manual',O.LIC]]};

/* ---------- 5: Workload types ---------- */
L['ora-perf:0:5']={blocks:[
{p:'Different workloads need different tuning. Know which one you have.'},
{t:[['','OLTP','Analytics (DW)','Mixed'],
['**Typical work**','Many short transactions','Few large queries, scans, aggregates','Both at once'],
['**Key metric**','Response time, transactions per second','Elapsed time, throughput (MB/s)','Both, with priorities'],
['**Typical waits**','Commit, row locks, single-block I/O','Multiblock I/O, temp, parallel waits','All'],
['**Helps**','Indexes, bind variables, small caches','Partitioning, parallel, In-Memory, compression','Resource Manager'],
['**Hurts**','Full scans of big tables','Row-by-row loops','Reports during peak OLTP']]},
{h:'Quick checks'},
{ul:['OLTP: soft parse ratio high, short average SQL time, small I/O sizes.','Analytics: large I/O sizes, high temp and PGA use, parallel execution.']},
{note:'A mixed database needs **Resource Manager** so that a report cannot starve the orders. You will see how in the instance tuning section.'}],
src:[['Workload characteristics',PT]]};

/* ---------- 6: Practical ---------- */
L['ora-perf:0:6']={blocks:[
{p:'Take a **baseline** of a sample workload. You need the Diagnostics Pack (or use Statspack if you do not have it).'},
{code:`-- 1. snapshot before
EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT;

-- 2. run your workload for 10 minutes (any test load)

-- 3. snapshot after
EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT;

-- 4. note the snapshot IDs and create a baseline
SELECT snap_id, begin_interval_time FROM dba_hist_snapshot ORDER BY snap_id DESC FETCH FIRST 5 ROWS ONLY;
EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_BASELINE(100,101,\'normal_load\');

-- 5. report
@?/rdbms/admin/awrrpt.sql`},
{h:'Fill this table from the report'},
{t:[['Metric','Value'],
['Elapsed time and DB Time',''],
['Average active sessions',''],
['Top 3 wait events and their % of DB Time',''],
['Top SQL by elapsed time',''],
['Transactions per second','']]},
{h:'Check your result'},
{ul:['The baseline exists in `DBA_HIST_BASELINE`.','You can say what share of DB Time is CPU and what share is waiting.','You can name the top wait class.']},
{note:'Keep this table. In later sections you will change something and compare against it.'}],
src:[['AWR and baselines',PT]]};

})();
