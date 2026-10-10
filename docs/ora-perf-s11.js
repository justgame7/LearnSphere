/* LearnSphere - Performance, Section 11: Proactive Management & Capstone.
   Lectures 0-4 are core, 5+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const PT=O.D+'tgdba/';

/* ---------- diagrams ---------- */
const loop=O.dg(700,190,[
[10,60,130,70,'Monitor|thresholds,|trends',2],
[190,60,130,70,'Detect|deviation from|baseline',0],
[370,60,130,70,'Diagnose|AWR, ASH, SQL|Monitor',0],
[550,60,140,70,'Fix and|document|(runbook)',0],
[200,150,300,30,'Review monthly: capacity, SQL, incidents',1]],
[[140,95,190,95],[320,95,370,95],[500,95,550,95]]);

/* ---------- 0: Thresholds and alerts ---------- */
L['ora-perf:10:0']={blocks:[
{p:'Do not wait for users. Set **thresholds** so that the database warns you.'},
{t:[['Metric','Why','Typical alert'],
['**Average Active Sessions**','Overall load','Above number of cores for several minutes'],
['**Response time per transaction**','User experience','Above baseline by a set percent'],
['**Top wait share**','Bottleneck appears','A wait above 30% of DB Time'],
['**Tablespace and FRA usage**','Space','80% warning, 90% critical'],
['**Blocked sessions**','Locking','Blocked for over 2 minutes'],
['**Hard parses per second**','Literal SQL','Above normal baseline'],
['**Failed backups, archive lag**','Protection','Any']]},
{code:`-- server-generated alert for a metric
BEGIN
  DBMS_SERVER_ALERT.SET_THRESHOLD(
    metrics_id => DBMS_SERVER_ALERT.TABLESPACE_PCT_FULL,
    warning_operator => DBMS_SERVER_ALERT.OPERATOR_GE, warning_value => \'80\',
    critical_operator => DBMS_SERVER_ALERT.OPERATOR_GE, critical_value => \'90\',
    observation_period => 1, consecutive_occurrences => 1,
    instance_name => NULL, object_type => DBMS_SERVER_ALERT.OBJECT_TYPE_TABLESPACE, object_name => \'USERS\');
END;
/
SELECT reason, creation_time FROM dba_outstanding_alerts;`},
{note:'An alert nobody acts on is noise. Start with a few, tune them from the baseline, and add more.'}],
src:[['Alerts and thresholds',PT]]};

/* ---------- 1: Capacity planning ---------- */
L['ora-perf:10:1']={blocks:[
{p:'**Capacity planning** is estimating when resources run out, from **trends**, not a feeling.'},
{t:[['Resource','Measure','Source'],
['**CPU**','Peak AAS vs cores','AWR `DBA_HIST_SYSMETRIC_SUMMARY`'],
['**Memory**','PGA peak, SGA advice, swap','`V$PGASTAT`, advisors'],
['**Storage**','Database size growth per month','`DBA_HIST_TBSPC_SPACE_USAGE`'],
['**I/O**','Peak IOPS and MB/s','`DBA_HIST_SYSSTAT`'],
['**Sessions**','Peak concurrent sessions','`DBA_HIST_SYSMETRIC_SUMMARY`']]},
{code:`-- monthly growth of the database
SELECT TO_CHAR(TRUNC(TO_DATE(rtime,\'MM/DD/YYYY HH24:MI:SS\'),\'MM\'),\'YYYY-MM\') month,
       ROUND(MAX(tablespace_usedsize*8192)/1024/1024/1024,1) used_gb
FROM dba_hist_tbspc_space_usage GROUP BY TRUNC(TO_DATE(rtime,\'MM/DD/YYYY HH24:MI:SS\'),\'MM\') ORDER BY 1;`},
{flow:['Collect peak values per week or month','Draw the trend and growth rate','Add planned business events (new customers, releases)','Estimate the date a limit is reached','Plan the action with lead time']},
{note:'Plan with the **peak**, not the average. Add lead time for purchase and change windows.'}],
src:[['Capacity planning',PT]]};

/* ---------- 2: Before and after change ---------- */
L['ora-perf:10:2']={blocks:[
{p:'Every change is a performance risk. Measure before and after, in the **same way**.'},
{t:[['Step','Action'],
['**Before**','Baseline snapshots and top SQL, a fixed set of test queries with timings'],
['**Change**','One change, with a rollback ready'],
['**After**','Same workload, same measures'],
['**Compare**','AWR compare, SQL timing, plan changes, resource use'],
['**Decide**','Keep, adjust or roll back']]},
{h:'Tools for change testing'},
{t:[['Tool','Use'],
['**SQL Performance Analyzer**','Compare SQL before and after a change (needs RAT)'],
['**Database Replay**','Replay a captured workload on a test system (needs RAT)'],
['**SQL Plan Management**','Prevent plan regressions after upgrades'],
['**AWR Compare**','Compare the real periods']]},
{note:'Include the **top 20 SQL** and the key business transactions in every test. If they are not worse, the change is probably safe.'}],
src:[['Testing changes',PT]]};

/* ---------- 3: Runbook ---------- */
L['ora-perf:10:3']={blocks:[
{p:'A **performance runbook** is the checklist that lets any DBA start diagnosing in the right order.'},
{svg:loop},
{h:'Contents'},
{t:[['Section','Content'],
['**Triage**','Who is affected, since when, what changed, how bad (numbers)'],
['**Host check**','CPU, memory, swap, disk, network'],
['**Database check**','AAS, top waits, top SQL, blockers, errors in the alert log'],
['**Decision tree**','Waits mapping to actions (I/O, locks, parse, CPU)'],
['**Safe actions**','What can be done at once (kill blocker, add space) and who approves'],
['**Escalation**','Who to call: application, storage, network'],
['**After**','Record, root cause, prevention']]},
{note:'Keep it short enough to use at 3 a.m.: one or two pages with copy-ready queries.'}],
src:[['Performance management',PT]]};

/* ---------- 4: Capstone ---------- */
L['ora-perf:10:4']={blocks:[
{p:'**Capstone.** Tune a **degrading application** end to end. You get a test database with a workload that gets slower over time. Keep a log: the log is your deliverable.'},
{h:'Scenario'},
{p:'Order entry has doubled in response time over two weeks. Nobody changed code. Reports run at the same time as order entry.'},
{h:'Steps'},
{flow:['Define the symptom with numbers and take a baseline (AWR)','Find the top waits and top SQL (AWR, ASH)','Check statistics, plans and recent changes (AWR compare, plan history)','Fix the highest impact cause first: statistics, index, SQL or memory','Protect the OLTP workload with Resource Manager','Verify against the baseline and write the runbook and alerts']},
{h:'Acceptance'},
{t:[['Test','Pass condition'],
['Order entry response time','Back to baseline or better'],
['Top wait','Understood, with its share of DB Time before and after'],
['Changes','Each documented with reason and rollback'],
['Plans','Critical SQL stable (baseline or statistics)'],
['Reports','Cannot starve order entry (Resource Manager)'],
['Monitoring','Thresholds and alerts for the findings'],
['Runbook','Written and reviewed']]},
{h:'Self-assessment'},
{t:[['Level','Meaning'],
['**Foundation**','You found the problem and fixed it by following the steps'],
['**Solid**','You also explained why with data and avoided side effects'],
['**Ready**','You can show before and after, and another DBA can repeat it from your runbook']]},
{note:'You have now finished the Performance Tuning sub-course. Next: combine it with Backup (cost of backups on I/O) and Security (auditing overhead) in your own environment.'}],
src:[['Performance Tuning Guide',PT],['Oracle Database 19c documentation',D]]};

})();
