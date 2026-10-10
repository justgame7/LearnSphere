/* LearnSphere - Oracle Core DBA, Section 13: Automation & Resource Management.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const sched=O.dg(700,190,[
[10,20,150,50,'Program|WHAT to run',0],[10,110,150,50,'Schedule|WHEN to run',0],
[210,60,150,70,'Job|program + schedule|(or both inline)',2],
[410,20,130,50,'Job class|which resources',0],[410,110,130,50,'Window|when the class|is allowed',0],
[590,60,100,70,'Run|logged in|run details',2]],
[[160,45,210,85],[160,135,210,105],[360,95,410,45],[360,95,410,135],[540,95,590,95]]);

const rm=O.dg(700,220,[
[10,80,130,60,'Users and|services|SHOP_APP, SHOP_RPT',0],
[190,80,140,60,'Mapping|user or service|to a group',0],
[380,10,150,50,'Group OLTP|shares 8',2],[380,85,150,50,'Group BATCH|shares 2, cap 30%',2],[380,160,150,50,'OTHER_GROUPS|everyone else',0],
[580,80,110,60,'Plan|LAB_PLAN|directives',2]],
[[140,110,190,110],[330,100,380,35],[330,110,380,110],[330,120,380,185],[530,35,580,100],[530,110,580,110],[530,185,580,125]]);

/* ---------- 0: Scheduler architecture ---------- */
L['ora-core:12:0']={blocks:[
{p:'The **Oracle Scheduler** (package `DBMS_SCHEDULER`) runs tasks inside the database on a schedule: statistics, cleanup, reports, backups. It replaces cron for database work and keeps its history in the database.'},
{svg:sched},
{h:'The building blocks'},
{t:[['Object','Meaning'],
['**Job**','A scheduled task: what to run and when'],
['**Program**','The "what": a PL/SQL block, a stored procedure or an external program. Can be reused.'],
['**Schedule**','The "when": a start date and a repeat rule. Can be reused.'],
['**Job class**','Groups jobs and links them to a resource consumer group'],
['**Window**','A time range when a resource plan is active'],
['**Chain**','Steps that depend on each other (covered in extra content)']]},
{h:'Job types'},
{t:[['Type','Runs'],
['`PLSQL_BLOCK`','An anonymous PL/SQL block'],
['`STORED_PROCEDURE`','A named procedure'],
['`EXECUTABLE`','An external program or script on the server'],
['`SQL_SCRIPT` and `BACKUP_SCRIPT`','A SQL*Plus or RMAN script']]},
{h:'Repeat rules (calendar syntax)'},
{t:[['Rule','Meaning'],
['`FREQ=DAILY;BYHOUR=2;BYMINUTE=0`','Every day at 02:00'],
['`FREQ=WEEKLY;BYDAY=SUN;BYHOUR=3`','Every Sunday at 03:00'],
['`FREQ=MINUTELY;INTERVAL=15`','Every 15 minutes'],
['`FREQ=MONTHLY;BYMONTHDAY=1`','The first of each month']]},
{h:'How it runs'},
{flow:['The job coordinator process (CJQ0) wakes up and checks the schedule','It starts job slave processes (Jnnn) for jobs that are due','The slave runs the job action','The result is written to the run details views']},
{p:'The number of jobs that can run at once is limited by the parameter `JOB_QUEUE_PROCESSES`. A value of 0 stops all scheduler jobs.'},
{code:`SHOW PARAMETER job_queue_processes`},
{note:'The older DBMS_JOB package still exists for compatibility. Use DBMS_SCHEDULER for new work: it logs more, supports calendars, and works with Resource Manager.'}],
src:[['Scheduler overview',O.AD+'scheduling-jobs-with-oracle-scheduler.html'],['DBMS_SCHEDULER',D+'arpls/DBMS_SCHEDULER.html']]};

/* ---------- 1: Creating and monitoring jobs ---------- */
L['ora-core:12:1']={blocks:[
{p:'Creating a job is one procedure call. Monitoring it is two dictionary views. Learn both and you can automate most routine work.'},
{h:'Create a job'},
{code:`BEGIN
  DBMS_SCHEDULER.CREATE_JOB(
    job_name        => 'SHOP.NIGHTLY_STATS',
    job_type        => 'PLSQL_BLOCK',
    job_action      => 'BEGIN DBMS_STATS.GATHER_SCHEMA_STATS(''SHOP''); END;',
    start_date      => SYSTIMESTAMP,
    repeat_interval => 'FREQ=DAILY;BYHOUR=2;BYMINUTE=0;BYSECOND=0',
    enabled         => TRUE,
    comments        => 'Gather statistics for the SHOP schema every night');
END;
/`},
{p:'The user needs the `CREATE JOB` privilege. Inside a PL/SQL string, a single quote is written twice, as you can see around SHOP in the example.'},
{h:'Control it'},
{code:`EXEC DBMS_SCHEDULER.RUN_JOB('SHOP.NIGHTLY_STATS');          -- run now
EXEC DBMS_SCHEDULER.DISABLE('SHOP.NIGHTLY_STATS');
EXEC DBMS_SCHEDULER.ENABLE('SHOP.NIGHTLY_STATS');
EXEC DBMS_SCHEDULER.SET_ATTRIBUTE('SHOP.NIGHTLY_STATS','repeat_interval','FREQ=DAILY;BYHOUR=3');
EXEC DBMS_SCHEDULER.DROP_JOB('SHOP.NIGHTLY_STATS');`},
{h:'Monitor'},
{code:`-- Definition, state and next run
SELECT owner, job_name, enabled, state, last_start_date, next_run_date
FROM   dba_scheduler_jobs WHERE owner = 'SHOP';

-- History of runs with errors
SELECT job_name, status, error#, actual_start_date, run_duration, additional_info
FROM   dba_scheduler_job_run_details
WHERE  owner = 'SHOP' ORDER BY actual_start_date DESC FETCH FIRST 10 ROWS ONLY;

-- Running right now
SELECT job_name, session_id, elapsed_time FROM dba_scheduler_running_jobs;`},
{t:[['View','Shows'],
['`DBA_SCHEDULER_JOBS`','Every job and its state'],
['`DBA_SCHEDULER_JOB_RUN_DETAILS`','Each run: status, errors, duration'],
['`DBA_SCHEDULER_RUNNING_JOBS`','Jobs that are executing now']]},
{flow:['A job is created and enabled','It runs at the next time due','Success or failure is recorded in the run details','Your monitoring script checks for FAILED status']},
{note:'A job that fails silently is worse than no job. Add a daily check on DBA_SCHEDULER_JOB_RUN_DETAILS for any status other than SUCCEEDED.'}],
src:[['Creating and managing jobs',O.AD+'scheduling-jobs-with-oracle-scheduler.html']]};

/* ---------- 2: Automated maintenance ---------- */
L['ora-core:12:2']={blocks:[
{p:'Oracle runs three maintenance tasks for you in a nightly **maintenance window**. They keep the database healthy without a DBA starting them.'},
{h:'The automatic tasks'},
{t:[['Task','Client name','What it does'],
['**Optimizer statistics**','`auto optimizer stats collection`','Gathers stale or missing statistics'],
['**Segment Advisor**','`auto space advisor`','Looks for space that can be reclaimed'],
['**SQL Tuning Advisor**','`sql tuning advisor`','Analyses high-load SQL and suggests fixes']]},
{note:'The automatic SQL Tuning Advisor belongs to the Tuning Pack. If you are not licensed for it, disable that task (see below).'},
{h:'Maintenance windows'},
{t:[['Window','Default time'],
['Weeknights (Monday to Friday)','Start at 22:00, run for up to 4 hours'],
['Weekend (Saturday and Sunday)','Start at 06:00, run for up to 20 hours']]},
{code:`SELECT client_name, status FROM dba_autotask_client;

SELECT window_name, window_next_time, window_active FROM dba_autotask_window_clients;

SELECT client_name, job_start_time, job_status FROM dba_autotask_job_history
ORDER BY job_start_time DESC FETCH FIRST 10 ROWS ONLY;`},
{h:'Turn a task off or on'},
{code:`BEGIN
  DBMS_AUTO_TASK_ADMIN.DISABLE(client_name => 'sql tuning advisor', operation => NULL, window_name => NULL);
END;
/

BEGIN
  DBMS_AUTO_TASK_ADMIN.ENABLE(client_name => 'sql tuning advisor', operation => NULL, window_name => NULL);
END;
/`},
{flow:['The maintenance window opens','Statistics, space advice and SQL tuning tasks run','The window closes, or all tasks finish','History is available in DBA_AUTOTASK_JOB_HISTORY']},
{note:'Keep the statistics task on. Move the window if it collides with your batch jobs, but do not switch off the tasks to hide a clash.'}],
src:[['Automated maintenance tasks',O.AD+'managing-automated-database-maintenance-tasks.html']]};

/* ---------- 3: Resource Manager ---------- */
L['ora-core:12:3']={blocks:[
{p:'**Resource Manager** stops one group of users from taking all the CPU and other resources. You divide sessions into **consumer groups** and give each group rules in a **plan**.'},
{svg:rm},
{h:'The pieces'},
{t:[['Part','Meaning'],
['**Consumer group**','A set of sessions that share the same resource rules'],
['**Mapping**','Rules that put a session in a group: by user, service, program, module'],
['**Plan directive**','The rule for one group: shares, caps, limits'],
['**Plan**','A set of directives. One plan is active at a time.']]},
{h:'Common directives'},
{t:[['Directive','Effect'],
['`SHARES`','Relative CPU weight when the system is busy'],
['`UTILIZATION_LIMIT`','Hard cap of CPU in percent, even when idle capacity exists'],
['`PARALLEL_DEGREE_LIMIT_P1`','Maximum parallel degree'],
['`ACTIVE_SESS_POOL_P1`','Maximum active sessions. Others queue.'],
['`SWITCH_TIME` and `SWITCH_GROUP`','Move a long call to a lower group'],
['`MAX_IDLE_TIME`','Disconnect idle sessions']]},
{code:`BEGIN
  DBMS_RESOURCE_MANAGER.CREATE_PENDING_AREA();
  DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP('OLTP', 'Interactive users');
  DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP('BATCH', 'Reports and loads');
  DBMS_RESOURCE_MANAGER.CREATE_PLAN('LAB_PLAN', 'Protect OLTP from batch');
  DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE('LAB_PLAN','OLTP', 'Priority work', shares => 8);
  DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE('LAB_PLAN','BATCH','Capped work',   shares => 2, utilization_limit => 30);
  DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE('LAB_PLAN','OTHER_GROUPS','Everyone else', shares => 1);
  DBMS_RESOURCE_MANAGER.VALIDATE_PENDING_AREA();
  DBMS_RESOURCE_MANAGER.SUBMIT_PENDING_AREA();
END;
/`},
{h:'Map users and activate'},
{code:`BEGIN
  DBMS_RESOURCE_MANAGER.CREATE_PENDING_AREA();
  DBMS_RESOURCE_MANAGER.SET_CONSUMER_GROUP_MAPPING(DBMS_RESOURCE_MANAGER.ORACLE_USER, 'SHOP_APP', 'OLTP');
  DBMS_RESOURCE_MANAGER.SET_CONSUMER_GROUP_MAPPING(DBMS_RESOURCE_MANAGER.ORACLE_USER, 'SHOP_RPT', 'BATCH');
  DBMS_RESOURCE_MANAGER.SUBMIT_PENDING_AREA();
END;
/

ALTER SYSTEM SET resource_manager_plan = 'LAB_PLAN' SCOPE = BOTH;

SELECT name, is_top_plan FROM v$rsrc_plan;
SELECT name, consumed_cpu_time, cpu_wait_time FROM v$rsrc_consumer_group;`},
{flow:['Create a pending area','Define groups, a plan and directives','Validate and submit','Map users or services to groups','Activate the plan with RESOURCE_MANAGER_PLAN']},
{note:'Every plan needs a directive for OTHER_GROUPS, or validation fails. Shares only matter when the CPU is busy, and the cap works all the time.'}],
src:[['Managing resources with Resource Manager',O.AD+'managing-resources-with-oracle-database-resource-manager.html'],['DBMS_RESOURCE_MANAGER',D+'arpls/DBMS_RESOURCE_MANAGER.html']]};

/* ---------- 4: Resource Manager with PDBs ---------- */
L['ora-core:12:4']={blocks:[
{p:'In a CDB, Resource Manager works at **two levels**: a **CDB plan** divides resources between PDBs, and a **PDB plan** divides each PDB share between its own users.'},
{t:[['Level','Set in','Divides'],
['**CDB plan**','The root','Resources between PDBs'],
['**PDB plan**','Inside a PDB','The PDB share between consumer groups']]},
{h:'Directives for each PDB'},
{t:[['Directive','Meaning'],
['`SHARES`','Relative weight of the PDB when the CDB is busy'],
['`UTILIZATION_LIMIT`','Maximum CPU percent the PDB may use'],
['`PARALLEL_SERVER_LIMIT`','Cap on parallel execution servers']]},
{code:`-- In the root
BEGIN
  DBMS_RESOURCE_MANAGER.CREATE_PENDING_AREA();
  DBMS_RESOURCE_MANAGER.CREATE_CDB_PLAN('CDB_LAB_PLAN', 'Shares for my PDBs');
  DBMS_RESOURCE_MANAGER.CREATE_CDB_PLAN_DIRECTIVE('CDB_LAB_PLAN','FREEPDB1', shares => 3, utilization_limit => 70);
  DBMS_RESOURCE_MANAGER.CREATE_CDB_PLAN_DIRECTIVE('CDB_LAB_PLAN','LABPDB2',  shares => 1, utilization_limit => 30);
  DBMS_RESOURCE_MANAGER.VALIDATE_PENDING_AREA();
  DBMS_RESOURCE_MANAGER.SUBMIT_PENDING_AREA();
END;
/

ALTER SYSTEM SET resource_manager_plan = 'CDB_LAB_PLAN' SCOPE = BOTH;`},
{h:'How shares work'},
{t:[['PDB','Shares','Share when all are busy'],
['FREEPDB1','3','3 of 4 = 75 percent'],
['LABPDB2','1','1 of 4 = 25 percent']]},
{p:'If LABPDB2 is idle, FREEPDB1 can use more than its share, up to its `UTILIZATION_LIMIT`.'},
{code:`SELECT plan, pluggable_database, shares, utilization_limit FROM dba_cdb_rsrc_plan_directives WHERE plan = 'CDB_LAB_PLAN';`},
{flow:['Decide a share for every PDB at creation time','Create the CDB plan in the root and activate it','Optionally create a PDB plan inside each PDB','Check consumption per PDB and adjust']},
{note:'A CDB plan is active only if it is set as RESOURCE_MANAGER_PLAN in the root. A PDB created later gets default shares until you add a directive for it.'}],
src:[['Resource Manager and multitenant',O.MT],['CREATE_CDB_PLAN',D+'arpls/DBMS_RESOURCE_MANAGER.html']]};

/* ---------- 5: Alerts ---------- */
L['ora-core:12:5']={blocks:[
{p:'Oracle watches itself and raises **server-generated alerts** when a metric crosses a **threshold**. Alerts are the early warning that tells you to act before users notice.'},
{h:'Examples of built-in alerts'},
{t:[['Alert','Default trigger'],
['**Tablespace space usage**','Warning at 85 percent, critical at 97 percent'],
['**Recovery area low on free space**','Warning at 85 percent, critical at 97 percent'],
['**Snapshot too old**','ORA-01555 occurrences'],
['**Resumable session suspended**','A session is waiting for space'],
['**Unusable index**','An index needs a rebuild']]},
{h:'Read alerts'},
{code:`-- Active (outstanding) alerts
SELECT reason, object_name, suggested_action, creation_time FROM dba_outstanding_alerts;

-- What has been raised before
SELECT reason, object_name, creation_time, resolution FROM dba_alert_history ORDER BY creation_time DESC FETCH FIRST 10 ROWS ONLY;`},
{h:'Set your own threshold'},
{code:`BEGIN
  DBMS_SERVER_ALERT.SET_THRESHOLD(
    metrics_id              => DBMS_SERVER_ALERT.TABLESPACE_PCT_FULL,
    warning_operator        => DBMS_SERVER_ALERT.OPERATOR_GE,  warning_value  => '80',
    critical_operator       => DBMS_SERVER_ALERT.OPERATOR_GE,  critical_value => '90',
    observation_period      => 1,
    consecutive_occurrences => 1,
    instance_name           => NULL,
    object_type             => DBMS_SERVER_ALERT.OBJECT_TYPE_TABLESPACE,
    object_name             => 'USERS');
END;
/

SELECT object_name, warning_value, critical_value FROM dba_thresholds WHERE metrics_name LIKE 'Tablespace%';`},
{h:'Getting the message to a person'},
{t:[['Method','How'],
['**Enterprise Manager**','Sends email or SNMP from the alerts'],
['**Your own script**','A job or cron entry that reads DBA_OUTSTANDING_ALERTS and sends mail'],
['**Monitoring tool**','Nagios, Zabbix, Prometheus read the views or the alert log']]},
{flow:['MMON checks the metric','The value crosses a threshold','An alert is stored in DBA_OUTSTANDING_ALERTS','Your notification sends it to a person','The alert clears when the metric returns to normal']},
{note:'Some metric collection relies on the AWR repository. Check your licence for the features you rely on. An alert nobody reads is no alert: make sure it reaches a person.'}],
src:[['Monitoring and alerts',O.AD+'monitoring-the-operation-of-your-database.html'],['DBMS_SERVER_ALERT',D+'arpls/DBMS_SERVER_ALERT.html']]};

/* ---------- 6: Practical ---------- */
L['ora-core:12:6']={blocks:[
{p:'You will schedule a nightly maintenance job and then use Resource Manager to cap a runaway batch workload while an interactive user stays responsive.'},
{h:'Part 1: Schedule maintenance'},
{code:`ALTER SESSION SET CONTAINER = FREEPDB1;
GRANT CREATE JOB TO shop;

BEGIN
  DBMS_SCHEDULER.CREATE_JOB(
    job_name        => 'SHOP.LAB_STATS',
    job_type        => 'PLSQL_BLOCK',
    job_action      => 'BEGIN DBMS_STATS.GATHER_SCHEMA_STATS(''SHOP''); END;',
    start_date      => SYSTIMESTAMP,
    repeat_interval => 'FREQ=MINUTELY;INTERVAL=5',
    enabled         => TRUE);
END;
/
EXEC DBMS_SCHEDULER.RUN_JOB('SHOP.LAB_STATS');

SELECT job_name, status, run_duration FROM dba_scheduler_job_run_details WHERE owner = 'SHOP' ORDER BY actual_start_date DESC;`},
{h:'Part 2: Create the plan'},
{p:'Run the plan and mapping code from the Resource Manager lecture (groups `OLTP` and `BATCH`, plan `LAB_PLAN`, mapping `SHOP_APP` to `OLTP` and `SHOP_RPT` to `BATCH`). Then:'},
{code:`ALTER SYSTEM SET resource_manager_plan = 'LAB_PLAN' SCOPE = BOTH;
SELECT name, is_top_plan FROM v$rsrc_plan;`},
{h:'Part 3: Create a runaway session'},
{code:`-- As SHOP_RPT: burns CPU for about a minute
DECLARE n NUMBER := 0;
BEGIN
  FOR i IN 1..200000000 LOOP n := n + SQRT(i); END LOOP;
END;
/

-- As SYSTEM, in another session, while it runs
SELECT name, consumed_cpu_time, cpu_wait_time, cpu_waits FROM v$rsrc_consumer_group
WHERE  name IN ('OLTP','BATCH');`},
{h:'Part 4: Clean up'},
{code:`ALTER SYSTEM SET resource_manager_plan = '' SCOPE = BOTH;
EXEC DBMS_SCHEDULER.DROP_JOB('SHOP.LAB_STATS');`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`DBA_SCHEDULER_JOB_RUN_DETAILS`','A SUCCEEDED run for `LAB_STATS`'],
['`V$RSRC_PLAN`','`LAB_PLAN` shown as the top plan'],
['`V$RSRC_CONSUMER_GROUP`','BATCH shows CPU wait time while it burns CPU'],
['After clean-up','No lab job and no active plan']]},
{note:'The Free edition has only 2 CPU threads, so the effect is easy to see. On a larger server a single session may not saturate the CPU. Run several busy sessions to make shares visible.'}],
src:[['Scheduler',O.AD+'scheduling-jobs-with-oracle-scheduler.html'],['Resource Manager',O.AD+'managing-resources-with-oracle-database-resource-manager.html']]};

})();
