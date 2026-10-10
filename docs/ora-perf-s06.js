/* LearnSphere - Performance, Section 06: SQL Tuning Tools.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const TG=O.D+'tgsql/';

/* ---------- diagrams ---------- */
const spm=O.dg(700,190,[
[10,50,140,80,'New plan|found by|optimizer',0],
[200,50,150,80,'Plan history|(all known plans)',0],
[400,50,140,80,'Accepted|baseline plans',2],
[590,50,100,80,'Evolve|(verify better)',0]],
[[150,90,200,90],[350,90,400,90],[540,90,590,90],[640,50,500,50]]);

/* ---------- 0: SQL Tuning Advisor ---------- */
L['ora-perf:5:0']={blocks:[
{p:'The **SQL Tuning Advisor** analyses one or more statements and recommends fixes: statistics, a better access structure, a SQL rewrite, or a **SQL Profile**.'},
{code:`DECLARE
  t VARCHAR2(64);
BEGIN
  t := DBMS_SQLTUNE.CREATE_TUNING_TASK(sql_id=>\'abcd1234efgh5\', time_limit=>300, task_name=>\'tune_q1\');
  DBMS_SQLTUNE.EXECUTE_TUNING_TASK(\'tune_q1\');
END;
/
SELECT DBMS_SQLTUNE.REPORT_TUNING_TASK(\'tune_q1\') FROM dual;

-- accept a recommended profile
EXEC DBMS_SQLTUNE.ACCEPT_SQL_PROFILE(task_name=>\'tune_q1\', name=>\'prof_q1\');`},
{t:[['Recommendation','Meaning'],
['**Statistics**','Gather missing or stale statistics'],
['**Index**','Create an index (verify with Access Advisor)'],
['**SQL restructure**','Rewrite part of the statement'],
['**SQL Profile**','Extra statistics stored in the dictionary that correct estimates. The SQL text does not change.']]},
{h:'SQL Profile'},
{ul:['Helpful when you **cannot change** the SQL (packaged application).','It adjusts estimates, not the plan itself, so it adapts to data changes better than hints.']},
{note:'Needs the **Tuning Pack**. Always compare the new plan with the old before accepting a profile in production.'}],
src:[['SQL Tuning Advisor',TG]]};

/* ---------- 1: Access Advisor ---------- */
L['ora-perf:5:1']={blocks:[
{p:'The **SQL Access Advisor** looks at a **workload**, not one SQL, and recommends **structures**: indexes, materialized views, partitioning.'},
{t:[['','Tuning Advisor','Access Advisor'],
['**Input**','One or a few statements','A workload (cache, AWR, STS, hypothetical)'],
['**Output**','Profile, stats, index hint','Indexes, MVs, partitions with benefit estimates'],
['**Question**','Why is this SQL slow?','Which structures help the workload?']]},
{code:`-- quick, from the cursor cache
DECLARE
  t_name VARCHAR2(30) := \'access1\';
BEGIN
  DBMS_ADVISOR.QUICK_TUNE(DBMS_ADVISOR.SQLACCESS_ADVISOR, t_name,
     \'SELECT * FROM app.orders WHERE cust_id = 100\');
END;
/
SELECT DBMS_ADVISOR.GET_TASK_SCRIPT(\'access1\') FROM dual;`},
{h:'Use it carefully'},
{ul:['Each index costs space and slows DML. Check the write side.','Review the script. Apply to a test system first.','A workload from a normal period gives better advice than one quiet hour.']},
{note:'Needs the **Tuning Pack**. The advice is only as good as the workload you give it.'}],
src:[['SQL Access Advisor',TG]]};

/* ---------- 2: SPM ---------- */
L['ora-perf:5:2']={blocks:[
{p:'**SQL Plan Management (SPM)** keeps plans **stable**. Only plans you have **accepted** are used. Better new plans are used only after they are verified.'},
{svg:spm},
{code:`-- capture baselines automatically for repeating SQL
ALTER SYSTEM SET optimizer_capture_sql_plan_baselines=TRUE;

-- load a good plan from the cursor cache
DECLARE n PLS_INTEGER;
BEGIN
  n := DBMS_SPM.LOAD_PLANS_FROM_CURSOR_CACHE(sql_id=>\'abcd1234efgh5\', plan_hash_value=>1234567890);
END;
/
SELECT sql_handle, plan_name, enabled, accepted, fixed FROM dba_sql_plan_baselines;

-- verify and accept better plans
DECLARE r CLOB;
BEGIN r := DBMS_SPM.EVOLVE_SQL_PLAN_BASELINE(sql_handle=>\'SQL_abc\'); END;
/`},
{t:[['Attribute','Meaning'],
['**ENABLED**','Can be used'],
['**ACCEPTED**','Verified, may be used by the optimizer'],
['**FIXED**','Prefer over non-fixed']]},
{note:'SPM is the standard way to **freeze a good plan** after an upgrade or a statistics change. In 19c, automatic evolve runs as a task if enabled.'}],
src:[['SQL Plan Management',TG]]};

/* ---------- 3: Hints ---------- */
L['ora-perf:5:3']={blocks:[
{p:'A **hint** is an instruction inside a SQL comment that the optimizer follows if it can. Use hints rarely, and know why.'},
{t:[['Hint','Effect'],
['`/*+ FULL(t) */`','Full scan of table t'],
['`/*+ INDEX(t ix) */`','Use index ix'],
['`/*+ LEADING(a b) */`','Join order'],
['`/*+ USE_HASH(b) */`, `USE_NL`','Join method'],
['`/*+ PARALLEL(t 4) */`','Parallel degree'],
['`/*+ GATHER_PLAN_STATISTICS */`','Collect row source statistics (for diagnosis)']]},
{h:'When a hint is acceptable'},
{ul:['As a **test** to learn what a better plan would be.','As a short-term fix for a critical SQL, with a comment and a ticket.','Never as a permanent habit across the application.']},
{h:'Why hints age badly'},
{ul:['Data grows, the hinted plan is no longer right.','An index is renamed or dropped and the hint is ignored silently.','They hide the real cause: wrong statistics or design.']},
{note:'If a hint helps, use that finding to fix statistics, or capture the plan with SPM, so the code does not carry fragile instructions.'}],
src:[['Hints',D+'sqlrf/']]};

/* ---------- 4: Automatic SQL Tuning ---------- */
L['ora-perf:5:4']={blocks:[
{p:'**Automatic SQL Tuning** runs in the nightly **maintenance window**, picks high-load SQL from AWR, tests tuning options and (optionally) accepts safe profiles.'},
{t:[['Task','What it does','Needs'],
['**Automatic SQL Tuning Advisor**','Tunes top SQL, can auto-accept profiles that improve by 3x or more','Tuning Pack'],
['**Automatic Statistics Gathering**','Keeps statistics fresh','Included'],
['**Segment Advisor**','Finds space to reclaim','Diagnostics/Tuning'],
['**Automatic SPM Evolve** (19c)','Verifies and accepts better plans','SPM']]},
{code:`SELECT client_name, status FROM dba_autotask_client;

EXEC DBMS_AUTO_TASK_ADMIN.ENABLE(client_name=>\'sql tuning advisor\', operation=>NULL, window_name=>NULL);

-- results of the latest run
SELECT DBMS_SQLTUNE.REPORT_AUTO_TUNING_TASK(NULL, NULL, \'TEXT\') FROM dual;`},
{h:'Maintenance windows'},
{ul:['Weekday windows at night, a longer window on weekends.','Resource Manager limits the CPU used by maintenance.','Change the window if it overlaps with batch jobs.']},
{note:'Review what automatic tuning accepted. Automation is a good helper, but you own the plans.'}],
src:[['Automatic SQL tuning',TG]]};

/* ---------- 5: SQL Patches and Quarantine ---------- */
L['ora-perf:5:5']={blocks:[
{p:'Two tools for **special cases**.'},
{t:[['','SQL Patch','SQL Quarantine'],
['**Goal**','Add hints to a SQL **without changing the application**','Stop a SQL from running again when it breached resource limits'],
['**Typical use**','A bug workaround: disable a feature for one statement','A runaway statement that caused an outage'],
['**Mechanism**','Stored hints attached to the SQL text or ID','Resource Manager limit + execution plan; Oracle skips the plan'],
['**Creates**','`DBMS_SQLDIAG.CREATE_SQL_PATCH`','Automatic with Resource Manager, or `DBMS_SQLQ`']]},
{code:`-- patch: add a hint
DECLARE p VARCHAR2(30);
BEGIN
  p := DBMS_SQLDIAG.CREATE_SQL_PATCH(sql_id=>\'abcd1234efgh5\', hint_text=>\'FULL(o)\', name=>\'patch_q1\');
END;
/
SELECT name, status FROM dba_sql_patches;

-- quarantine lists
SELECT sql_text, plan_hash_value, elapsed_time FROM dba_sql_quarantine;`},
{note:'SQL Quarantine is available on Exadata and with newer releases and licensing. Check the Licensing guide for your platform before depending on it.'}],
src:[['SQL Patch and Quarantine',TG]]};

/* ---------- 6: Practical ---------- */
L['ora-perf:5:6']={blocks:[
{p:'**Stabilize a plan** with SQL Plan Management.'},
{code:`-- 1. run the SQL a few times so it is in the cursor cache
SELECT /* spmtest */ COUNT(*) FROM app.orders WHERE status=\'NEW\';
SELECT sql_id, plan_hash_value FROM v$sql WHERE sql_text LIKE \'%spmtest%\' AND sql_text NOT LIKE \'%v$sql%\';

-- 2. load this good plan as a baseline
DECLARE n PLS_INTEGER;
BEGIN n := DBMS_SPM.LOAD_PLANS_FROM_CURSOR_CACHE(sql_id=>\'&sql_id\'); END;
/
SELECT sql_handle, plan_name, accepted FROM dba_sql_plan_baselines;

-- 3. change something that would alter the plan
EXEC DBMS_STATS.GATHER_TABLE_STATS(\'APP\',\'ORDERS\');
DROP INDEX app.orders_status_ix;

-- 4. run again and check the plan note
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL,NULL,\'TYPICAL\'));`},
{h:'Check your result'},
{t:[['Check','Expected'],
['Baseline','Exists with ACCEPTED = YES'],
['Plan note','`SQL plan baseline "SQL_PLAN_..." used for this statement`'],
['After dropping the index','The optimizer cannot use the baseline plan, but evolves a new plan as not accepted'],
['Recreate the index','The baseline plan is used again']]},
{note:'SPM does not make a bad plan good. It stops a **good plan** from being replaced by an unproven one.'}],
src:[['SQL Plan Management',TG]]};

})();
