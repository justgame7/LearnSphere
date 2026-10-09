/* LearnSphere - Amazon Redshift, Section 12: Monitoring & Troubleshooting.
   Lectures 0-6 are core, 7-10 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const layers=R.dg(700,270,[
[10,10,680,250,'Three places to look, from wide to narrow',1],
[30,50,200,90,'Console and CloudWatch|metrics: CPU, disk, connections,|queue length, usage',2],
[250,50,200,90,'SYS system views|queries, loads, tables,|usage (SQL)',2],
[470,50,200,90,'Logs and events|audit logs, CloudTrail,|event notifications',2],
[30,160,200,80,'Is something wrong?|alarms and graphs',0],[250,160,200,80,'Which query, table or user?|run SQL on SYS views',0],[470,160,200,80,'What changed, and who did it?|logs, events, CloudTrail',0]],
[[130,140,130,160],[350,140,350,160],[570,140,570,160]]);

const triage=R.dg(700,250,[
[10,10,680,230,'Troubleshooting order',1],
[30,60,120,60,'1. State the|symptom',2],[185,60,120,60,'2. Check recent|changes',0],[340,60,120,60,'3. Find the|query or load',0],[495,60,175,60,'4. Split time:|queue, compile, run',0],
[30,150,210,60,'5. Find the cause|skew, spill, locks, stale stats',0],[270,150,180,60,'6. Fix the cause',0],[480,150,190,60,'7. Re-test, then record',2]],
[[150,90,185,90],[305,90,340,90],[460,90,495,90],[580,120,135,150],[240,180,270,180],[450,180,480,180]]);

/* ================= LECTURE 0 ================= */
L['rs:11:0']={blocks:[
{p:'Monitoring answers three questions: **is something wrong**, **what exactly is wrong**, and **what changed**. Redshift gives you tools for each, and they work together.'},
{svg:layers},
{h:'Console views'},
{ul:['The cluster or workgroup page shows health, status and key graphs for a chosen period.','The **Query monitoring** tab (provisioned) and **Query and database monitoring** (Serverless) list queries and loads, with the metric graphs for the same minutes. These come from system tables, not CloudWatch.','**Events** show what Redshift did, for example maintenance, resize or snapshot results (lecture 4).']},
{h:'CloudWatch metrics for provisioned clusters'},
{p:'Redshift publishes metrics to the `AWS/Redshift` namespace, mostly at 1-minute intervals. A few you will use all the time:'},
{t:[['Metric','What it tells you','Typical use'],
['`CPUUtilization`','CPU across leader and compute nodes (per node with `NodeID`)','Sustained high CPU means busy or under-sized'],
['`PercentageDiskSpaceUsed`','Share of disk used','Alarm before storage runs out'],
['`DatabaseConnections`','Number of connections','Spot connection leaks'],
['`HealthStatus`','1 healthy, 0 unhealthy (a simple query run every minute)','Page on-call'],
['`MaintenanceMode`','1 while in maintenance','Explain short outages'],
['`WLMQueueLength`, `WLMQueueWaitTime`, `WLMRunningQueries`','Queueing per queue or priority','Capacity and WLM tuning (Section 9)'],
['`ConcurrencyScalingActiveClusters`, `ConcurrencyScalingSeconds`','Burst capacity in use','Cost watch'],
['`QueryDuration`, `QueriesCompletedPerSecond`','Average duration and throughput by `latency` class (short, medium, long)','Trends'],
['`UsageLimitConsumed`, `UsageLimitAvailable`','Usage-limit progress by feature','Cost guard rails (Section 4)'],
['`CommitQueueLength`','Transactions waiting to commit','Too many small commits']]},
{note:'Some cluster metrics aggregate the leader node with the compute nodes. Look at the `NodeID` dimension before you conclude that a single node is the problem.'},
{h:'Serverless'},
{ul:['Serverless publishes its own metrics, such as compute capacity and compute seconds, in the Redshift Serverless namespace. Open the metrics list in the console for the current names.','Use `SYS_SERVERLESS_USAGE` and `SYS_QUERY_HISTORY` for detail (lectures 1 and 9).']},
{h:'Set a baseline'},
{p:'A graph only means something when you know what normal looks like. Save screenshots or dashboards for a normal week and for peak hours, and compare when something changes.'}],
src:[['Performance data in Amazon Redshift',MG+'metrics-listing.html'],['Monitoring Amazon Redshift',MG+'metrics.html'],['Monitoring Redshift Serverless',MG+'serverless-monitoring.html']]};

/* ================= LECTURE 1 ================= */
L['rs:11:1']={blocks:[
{p:'The **SYS views** are the modern monitoring layer. They work on provisioned clusters **and** Serverless, show all user queries (not just those that fit a queue), and keep a consistent set of column names. Use them first.'},
{h:'The views you will use most'},
{t:[['View','Gives you'],
['`SYS_QUERY_HISTORY`','One row per user query, running or finished: status, start and end, elapsed, queue, execution, compile, planning and lock-wait time, error message, SQL text, queue and priority on provisioned'],
['`SYS_QUERY_DETAIL`','Step-level detail for a query: rows, bytes, spill, per-step time'],
['`SYS_QUERY_TEXT`, `SYS_QUERY_EXPLAIN`','Full SQL text and the plan'],
['`SYS_LOAD_HISTORY`, `SYS_LOAD_DETAIL`, `SYS_LOAD_ERROR_DETAIL`','COPY progress and failures'],
['`SYS_UNLOAD_HISTORY`','UNLOAD runs'],
['`SYS_CONNECTION_LOG`, `SYS_USERLOG`','Connections and user changes'],
['`SYS_SESSION_HISTORY`','Sessions'],
['`SYS_ANALYZE_HISTORY`, `SYS_VACUUM_HISTORY`','Maintenance activity'],
['`SYS_MV_REFRESH_HISTORY`','Materialized view refreshes'],
['`SYS_SERVERLESS_USAGE`','Serverless RPU and storage usage, only on Serverless']]},
{h:'Key facts'},
{ul:['Time columns are in **microseconds**. Divide by 1,000,000 for seconds.','`SYS_QUERY_HISTORY` is visible to everyone: regular users see only their own rows, superusers see all.','Some views, such as `SYS_SERVERLESS_USAGE` and `SVV_TABLE_INFO`, are visible only to superusers. Grant `SELECT` to a monitoring role for them.','History is **short** (roughly a week). Copy what you need to keep to a table, or use the long-term retention feature (Section 11).','`query_text` is limited to 4,000 characters. Use `SYS_QUERY_TEXT` for the full text.','Use `generic_query_hash` to group the same query with different literals, and `user_query_hash` for exact repeats.']},
{h:'Queries to remember'},
{code:`-- What is running or waiting now?
SELECT query_id, username, status, start_time,
       elapsed_time/1000000.0 AS elapsed_s, queue_time/1000000.0 AS queue_s, LEFT(query_text,80) AS sql
FROM sys_query_history
WHERE status IN ('planning','queued','running','returning')
ORDER BY start_time;

-- Failed queries in the last day
SELECT query_id, username, error_message, LEFT(query_text,80) AS sql
FROM sys_query_history
WHERE status = 'failed' AND start_time > DATEADD(day,-1,GETDATE())
ORDER BY start_time DESC;

-- Same query, different literals: who runs it and how often?
SELECT generic_query_hash, COUNT(*) AS runs, AVG(elapsed_time)/1000000.0 AS avg_s
FROM sys_query_history
WHERE start_time > DATEADD(day,-1,GETDATE())
GROUP BY 1 ORDER BY runs DESC LIMIT 20;`},
{note:'`status` can be planning, queued, running, returning, failed, canceled or success. A query stuck in `queued` is a capacity or WLM issue, not a slow-SQL issue.'}],
src:[['SYS_QUERY_HISTORY',DG+'SYS_QUERY_HISTORY.html'],['SYS monitoring views',DG+'serverless_views-monitoring.html'],['System tables and views',DG+'cm_chap_system-tables.html']]};

/* ================= LECTURE 2 ================= */
L['rs:11:2']={blocks:[
{p:'Users report that the warehouse is slow. First decide whether the query is slow because it is **waiting** or because it is **doing a lot of work**. The fix is different.'},
{h:'Where does the time go?'},
{t:[['Part of elapsed time','Column','High value means'],
['Waiting in a queue','`queue_time`','Not enough capacity, or WLM limits (Section 9)'],
['Waiting for a lock','`lock_wait_time`','Another transaction holds a lock (Section 8)'],
['Planning','`planning_time`','Complex SQL, many tables, stale statistics'],
['Compiling','`compile_time`','New query shapes. Second runs are fast'],
['Executing','`execution_time`','Scan volume, joins, skew, spill (next views)']]},
{code:`-- Slowest queries today, split by cause
SELECT query_id, username, status,
       elapsed_time/1000000.0   AS total_s,
       queue_time/1000000.0     AS queue_s,
       lock_wait_time/1000000.0 AS lock_s,
       planning_time/1000000.0  AS plan_s,
       compile_time/1000000.0   AS compile_s,
       execution_time/1000000.0 AS exec_s,
       LEFT(query_text,70) AS sql
FROM sys_query_history
WHERE start_time > DATEADD(hour,-24,GETDATE())
ORDER BY elapsed_time DESC LIMIT 20;`},
{h:'If the problem is queueing'},
{ul:['See which workload is queued and how many slots or priority it has (Section 9).','Check `ConcurrencyScalingActiveClusters` and the concurrency scaling limit (Section 4).','On Serverless, look at the workgroup base and maximum RPU.','Look for one heavy user or job flooding the queue, and move it to its own queue or schedule.']},
{h:'If the problem is a long query'},
{code:`-- Which steps took the time, and did they spill?
SELECT stream_id, segment_id, step_id, step_name, duration/1000000.0 AS step_s,
       input_bytes, output_bytes, spilled_block_local_disk AS spill_local
FROM sys_query_detail
WHERE query_id = 123456
ORDER BY duration DESC LIMIT 10;`},
{p:'Then read `EXPLAIN` (Section 8): look for `DS_BCAST_INNER` or `DS_DIST_BOTH` on large tables, scans without sort key help and stale statistics.'},
{h:'Stopping a runaway query'},
{code:`-- Find the session (process id) running the query
SELECT session_id, query_id, username, status FROM sys_query_history WHERE status IN ('running','queued');

-- Superuser, or the user who owns the session:
CANCEL <session_id>;                 -- stop the current statement of that session
SELECT pg_terminate_backend(<session_id>);   -- end the session as a last resort`},
{note:'Do not cancel loads or maintenance without checking what they are doing. Cancelling a `COPY` rolls back the load. Cancelling a long `VACUUM` is safe but loses its progress.'},
{h:'Prevent a repeat'},
{ul:['Query monitoring rules to log, abort or lower priority of long queries (Section 9).','Serverless **query limits** and usage limits as guard rails.','Fix the common causes in table design (Section 6).']}],
src:[['Troubleshooting queries',DG+'queries-troubleshooting.html'],['Query monitoring rules',DG+'cm-c-wlm-query-monitoring-rules.html'],['SYS_QUERY_DETAIL',DG+'SYS_QUERY_DETAIL.html']]};

/* ================= LECTURE 3 ================= */
L['rs:11:3']={blocks:[
{p:'Running out of space is one of the few Redshift problems that can stop work completely. The meaning of "disk" differs by hardware, so first know what you are measuring.'},
{t:[['Platform','What fills up','Watch'],
['**RA3 and RG** (managed storage)','Local SSD is a **cache**. Data lives in Redshift Managed Storage, which grows as needed','Managed storage size and cost (`RedshiftManagedStorageTotalCapacity`). Local disk pressure from temp data'],
['**DC2** (if you still have it)','Fixed local disk per node','`PercentageDiskSpaceUsed` in a hurry, since you must resize to get more'],
['**Serverless**','Managed storage that grows','Storage used and cost (`data_storage` in `SYS_SERVERLESS_USAGE`)']]},
{h:'Where does space go?'},
{code:`-- Biggest tables (size is in 1 MB blocks)
SELECT "schema", "table", size AS mb, tbl_rows, pct_used, unsorted, stats_off, skew_rows, diststyle
FROM svv_table_info
ORDER BY size DESC LIMIT 20;

-- Space wasted by rows that are deleted but not vacuumed
SELECT "schema", "table", tbl_rows, estimated_visible_rows,
       tbl_rows - estimated_visible_rows AS dead_rows
FROM svv_table_info
WHERE tbl_rows > 0
ORDER BY dead_rows DESC LIMIT 20;`},
{h:'Common causes of sudden growth'},
{ul:['**Temporary space** from a huge join, sort or `DISTINCT` (spill). It appears during a query and vanishes after.','**Skew**: one slice is full while others are not, so a single node fills first (Section 6).','**Deleted rows** not yet reclaimed (`VACUUM DELETE`), or deep copies not cleaned.','**Load staging** tables or many `CREATE TABLE AS` results that nobody dropped.','Cross-Region or unused **snapshots** cost storage, but do not use cluster disk. Check snapshot storage separately (Section 13).']},
{h:'What to do'},
{flow:['Find the top tables and the running queries','Cancel or fix a runaway query if temp space is the cause','Drop unused tables and truncate staging data','Run VACUUM DELETE or rely on automatic vacuum (Section 8)','Resize, add nodes or raise Serverless limits only if usage is real']},
{code:`aws cloudwatch put-metric-alarm --alarm-name redshift-disk-80 \\
  --namespace AWS/Redshift --metric-name PercentageDiskSpaceUsed \\
  --dimensions Name=ClusterIdentifier,Value=dwh-prod \\
  --statistic Maximum --period 300 --evaluation-periods 2 --threshold 80 \\
  --comparison-operator GreaterThanOrEqualToThreshold \\
  --alarm-actions arn:aws:sns:eu-west-1:111122223333:redshift-alerts`},
{note:'Schema quotas (Section 5) stop one team from filling the warehouse. Metrics such as `PercentageQuotaUsed` and `NumExceededSchemaQuotas` help you alarm on them.'}],
src:[['SVV_TABLE_INFO',DG+'r_SVV_TABLE_INFO.html'],['Performance data in Amazon Redshift',MG+'metrics-listing.html'],['Query planning and execution workflow',DG+'c-query-planning.html']]};

/* ================= LECTURE 4 ================= */
L['rs:11:4']={blocks:[
{p:'Graphs help only when someone is looking. **Alarms** and **event notifications** tell you when to look. Redshift offers two separate mechanisms and you usually want both.'},
{t:[['Mechanism','Tells you about','Examples'],
['**CloudWatch alarm**','A metric crossing a threshold','Disk above 80%, CPU above 90% for 15 minutes, `HealthStatus` equals 0, queue length high'],
['**Event subscription**','Things Redshift did or detected','Maintenance, resize result, snapshot failure, node replaced, key problem, audit log delivery error']]},
{h:'Event subscriptions'},
{p:'Event notifications are grouped by **source type** (cluster, parameter group, security group, snapshot) and **category** (for example Configuration, Management, Monitoring, Pending and Security) and **severity** (INFO or ERROR). Choose what goes to an SNS topic, then subscribe email, a chat webhook or a ticketing system to the topic.'},
{code:`aws sns create-topic --name redshift-alerts
aws sns subscribe --topic-arn arn:aws:sns:eu-west-1:111122223333:redshift-alerts \\
  --protocol email --notification-endpoint dba-team@example.com

aws redshift create-event-subscription --subscription-name redshift-errors \\
  --sns-topic-arn arn:aws:sns:eu-west-1:111122223333:redshift-alerts \\
  --source-type cluster --severity ERROR \\
  --event-categories management monitoring security configuration`},
{p:'Examples of events worth acting on: a snapshot failed, the audit log bucket policy is wrong, a node was replaced, a resize failed, KMS key permissions are invalid, a Multi-AZ recovery started or failed.'},
{h:'Alarms to create first'},
{ul:['`PercentageDiskSpaceUsed` above 80% (provisioned).','`HealthStatus` equals 0 for 2 minutes.','`CPUUtilization` high for a long period, as a sign to investigate rather than to page.','`WLMQueueWaitTime` or `WLMQueueLength` rising, for user-facing workloads.','`UsageLimitConsumed` near the limit, for concurrency scaling or Spectrum.','Failed snapshots or copies, through events.']},
{h:'Tips'},
{ul:['Send ERROR severity to a pager and INFO to a log channel, so noisy messages do not hide real ones.','Use **EventBridge** if you want to run automation, for example a Lambda that checks a failed load.','Test the path: a silent alarm that nobody receives is worse than none.','Serverless emits its own set of events and metrics, so create subscriptions and alarms for workgroups too.']},
{note:'Alarms need a sensible threshold and a sensible period. Alarm on sustained conditions (for example 3 of 5 periods), not single spikes, or people will start ignoring them.'}],
src:[['Event notifications',MG+'working-with-event-notifications.html'],['CloudWatch alarms','https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html'],['Performance data',MG+'metrics-listing.html']]};

/* ================= LECTURE 5 ================= */
L['rs:11:5']={blocks:[
{p:'**Amazon Redshift Advisor** analyses your usage and makes ordered recommendations that can improve performance or cut cost. You do not need to configure it. You review and act.'},
{h:'Where you find it'},
{ul:['In the console, the **Advisor** page for your cluster, listing recommendations with an impact rating and the affected tables.','From SQL, `SVV_ALTER_TABLE_RECOMMENDATIONS` shows pending **automatic table optimization** suggestions (Section 6).','Recommendations disappear when they no longer apply.']},
{h:'Typical recommendation types'},
{t:[['Recommendation','What it means','Your action'],
['Distribution key or sort key change','Table design could cut data movement or scan time','Let automatic table optimization apply it, or apply it in a window'],
['Compress table data','Columns are not using the best encoding','Apply a new encoding via a deep copy or let ATO do it'],
['Run VACUUM or ANALYZE','Stale statistics or many unsorted rows','Check automatic maintenance, then run it if it lags'],
['Reallocate workload management memory','Queues are over or under provisioned','Review WLM (Section 9)'],
['Skip compression analysis during COPY','Repeated work on loads into populated tables','Use `COMPUPDATE OFF` where valid'],
['Split COPY files','Fewer files than slices, so load is not parallel','Prepare more files (Section 7)']]},
{p:'Names change between releases. Treat the console as the source of truth for the exact list.'},
{h:'Working method'},
{flow:['Open Advisor weekly','Sort by impact','Test the change on a copy of the table or in a quiet window','Apply and measure','Record the result']},
{code:`-- Pending automatic optimization suggestions
SELECT * FROM svv_alter_table_recommendations ORDER BY 1;

-- Check that an applied change helped: compare runtimes of the same query hash before and after
SELECT DATE_TRUNC('day',start_time) AS d, COUNT(*) AS runs, AVG(elapsed_time)/1000000.0 AS avg_s
FROM sys_query_history
WHERE generic_query_hash = '<hash>'
GROUP BY 1 ORDER BY 1;`},
{note:'Advisor is a guide, not an order. A recommendation based on last week can be wrong for a seasonal workload. Always judge it against what you know about the data.'}],
src:[['Amazon Redshift Advisor',MG+'advisor.html'],['Automatic table optimization',DG+'t_Creating_tables.html'],['SVV_ALTER_TABLE_RECOMMENDATIONS',DG+'r_SVV_ALTER_TABLE_RECOMMENDATIONS.html']]};

/* ================= LECTURE 6 ================= */
L['rs:11:6']={blocks:[
{p:'This practical walks through four common incidents. For each, follow the same order: state the symptom, find the evidence in the system views, name the cause and fix it.'},
{svg:triage},
{h:'Scenario 1: a dashboard query became slow'},
{code:`-- 1. Find the query by hash or text and compare runs over time
SELECT start_time, elapsed_time/1000000.0 AS total_s, queue_time/1000000.0 AS queue_s,
       compile_time/1000000.0 AS compile_s, execution_time/1000000.0 AS exec_s, result_cache_hit
FROM sys_query_history
WHERE generic_query_hash = '<hash>' ORDER BY start_time DESC LIMIT 20;`},
{ul:['Queue time grew: capacity or WLM issue.','Execution grew: check table growth, `stats_off`, `unsorted` in `SVV_TABLE_INFO`, then the plan.','Compile time only on first run: normal for new shapes.']},
{h:'Scenario 2: the disk is nearly full'},
{ul:['Check `PercentageDiskSpaceUsed` per node. One node much higher means **skew** (`skew_rows` in `SVV_TABLE_INFO`).','Find queries with large spill in `SYS_QUERY_DETAIL`. Cancel the worst offender if needed.','Find dead rows and unused tables (lecture 3). Drop, truncate, vacuum.']},
{h:'Scenario 3: a COPY failed'},
{code:`SELECT * FROM sys_load_history ORDER BY start_time DESC LIMIT 5;

SELECT query_id, file_name, line_number, column_name, error_code, error_message
FROM sys_load_error_detail
WHERE query_id = 123456 ORDER BY line_number;`},
{ul:['Wrong delimiter, extra columns, bad dates or too-long strings are the usual causes (Section 7).','Check the IAM role and S3 path if the file cannot be read.','Re-run with `MAXERROR` only after you understand the error.']},
{h:'Scenario 4: users cannot connect'},
{ul:['`SYS_CONNECTION_LOG` for failed events and the reason: wrong password, expired credentials, SSL required, no permission.','Security group, subnet route and **public accessibility** for network failures (Section 11).','Connection limits: user connection limit or too many sessions. Check `DatabaseConnections`.','Status of the warehouse: paused, resizing or in maintenance (`MaintenanceMode`).','IAM: is the identity allowed to get credentials, and does the database user exist or auto-create?']},
{h:'After each incident'},
{ul:['Write a short note: symptom, cause, fix, how you checked.','Add an alarm or a rule if the issue can be detected early next time.','Update the runbook, and share it.']},
{note:'Change one thing at a time and measure after each change. Several changes together leave you with no idea which one worked.'}],
src:[['Troubleshooting queries',DG+'queries-troubleshooting.html'],['Troubleshooting connection issues',MG+'connecting-refusal-failure-issues.html'],['SYS_LOAD_ERROR_DETAIL',DG+'SYS_LOAD_ERROR_DETAIL.html']]};

/* ================= LECTURE 7 ================= */
L['rs:11:7']={blocks:[
{p:'Many existing scripts and tools query the older **STL, SVL and STV** views. Those views are tied to provisioned clusters, and some are not available on Serverless. When you move to Serverless, or simply modernise, you map each one to a **SYS** view.'},
{h:'Common mappings'},
{t:[['Old view','Use now','Notes'],
['`STL_QUERY`, `SVL_QLOG`, `STL_QUERYTEXT`','`SYS_QUERY_HISTORY`, `SYS_QUERY_TEXT`','One row per query with timing and status'],
['`STL_WLM_QUERY` (queue time)','`SYS_QUERY_HISTORY` (`queue_time`, `execution_time`)','Service class columns are only filled on provisioned'],
['`SVL_QUERY_SUMMARY`, `SVL_QUERY_REPORT`, `STL_SCAN`','`SYS_QUERY_DETAIL`','Step-level detail'],
['`STL_LOAD_ERRORS`','`SYS_LOAD_ERROR_DETAIL`',''],
['`STL_LOAD_COMMITS`','`SYS_LOAD_DETAIL`, `SYS_LOAD_HISTORY`',''],
['`STL_CONNECTION_LOG`, `STL_USERLOG`','`SYS_CONNECTION_LOG`, `SYS_USERLOG`','Same data used for audit logging'],
['`STL_VACUUM`, `STL_ANALYZE`','`SYS_VACUUM_HISTORY`, `SYS_ANALYZE_HISTORY`',''],
['`STL_EXPLAIN`','`SYS_QUERY_EXPLAIN`',''],
['`STV_RECENTS`, `STV_INFLIGHT`','`SYS_QUERY_HISTORY` with `status` filter','Running and queued queries']]},
{p:'Always confirm the exact mapping and column names in the AWS **system view mapping** page, because some columns have different names or units.'},
{h:'What stays'},
{ul:['**`SVV_*` views** such as `SVV_TABLE_INFO`, `SVV_ALTER_TABLE_RECOMMENDATIONS` and the grant views stay valid and work on both platforms.','**Catalog views** (`pg_*`, `information_schema`) remain.']},
{h:'Migration steps'},
{flow:['List every script and dashboard that uses STL, SVL or STV','Map each to a SYS view','Rewrite and compare results on provisioned','Fix units: microseconds and different column names','Test on Serverless']},
{code:`-- Old: queue time in seconds from STL_WLM_QUERY
-- SELECT query, total_queue_time/1000000.0 FROM stl_wlm_query WHERE ...
-- New:
SELECT query_id, queue_time/1000000.0 AS queue_s
FROM sys_query_history
WHERE start_time > DATEADD(hour,-1,GETDATE());`},
{note:'STL tables keep only a few days of data and are not on Serverless. Moving the monitoring to SYS also gets you the long-term retention option (Section 11).'}],
src:[['System view mapping for migrating to SYS views',DG+'sys_view_migration.html'],['SYS monitoring views',DG+'serverless_views-monitoring.html']]};

/* ================= LECTURE 8 ================= */
L['rs:11:8']={blocks:[
{p:'AWS publishes **amazon-redshift-utils** on GitHub, a set of scripts and views that DBAs have used for years. The `AdminViews` and `AdminScripts` folders contain ready-made monitoring SQL.'},
{h:'What is inside'},
{ul:['**AdminViews**: views such as `v_get_tbl_scratch_space`, `v_space_used_per_tbl`, `v_check_data_distribution`, `v_get_obj_priv_by_user`, `v_generate_tbl_ddl` and many more. Install them into an `admin` schema.','**AdminScripts**: SQL files for common tasks such as top queries, table information, running queries and lock checks.','**ColumnEncodingUtility**, **AnalyzeVacuumUtility**: older helpers. Automatic table optimization and automatic maintenance have replaced most of what they did, so test before you use them.']},
{h:'Install and use'},
{code:`-- Create a schema and install the views you want
CREATE SCHEMA admin;
-- Run the CREATE VIEW scripts from the AdminViews folder (review each one first)

-- Give a monitoring role read access
GRANT USAGE ON SCHEMA admin TO ROLE ops_monitoring;
GRANT SELECT ON ALL TABLES IN SCHEMA admin TO ROLE ops_monitoring;

-- Example from the views: DDL for a table
SELECT ddl FROM admin.v_generate_tbl_ddl WHERE schemaname='sales' AND tablename='orders';`},
{h:'Cautions'},
{ul:['Many scripts use **STL, SVL and STV** views, which are provisioned-only. On Serverless they may fail or return nothing, so check each one or rewrite it with SYS views (lecture 7).','Read the SQL before you run it. Some scripts change objects or kill sessions.','Pin to a version of the repository and keep your copy in version control. The repository is community maintained by AWS staff and users, not a supported product.','Some scripts duplicate what the service already does. Prefer built-in features: automatic vacuum, automatic analyze, automatic table optimization.']},
{note:'Use the scripts as a library of ideas and starting queries. Your own small, reviewed set of monitoring views is easier to maintain than a full copy of a large repository.'}],
src:[['amazon-redshift-utils on GitHub','https://github.com/awslabs/amazon-redshift-utils'],['System view migration',DG+'sys_view_migration.html']]};

/* ================= LECTURE 9 ================= */
L['rs:11:9']={blocks:[
{p:'Serverless charges for the **RPU-seconds** your workloads use, plus storage. Monitoring usage is both a performance and a **cost-control** activity.'},
{h:'The usage view'},
{p:'`SYS_SERVERLESS_USAGE` gives a 1-minute summary of compute and storage. It is visible only to superusers, applies only to Serverless, and keeps data for **7 days**.'},
{t:[['Column','Meaning'],
['`start_time`, `end_time`','Interval'],
['`compute_seconds`','RPU-seconds consumed'],
['`compute_capacity`','Average RPUs used'],
['`charged_seconds`','RPU-seconds **charged**. Use this one for cost. It is computed after transactions end, so it can be 0 while a transaction runs'],
['`charged_extra_compute_for_automatic_optimization_seconds`','Charged seconds for automatic optimization that used extra compute'],
['`data_storage`','Average managed storage in MB'],
['`cross_region_transferred_data`','Bytes moved for cross-Region data sharing']]},
{note:'`compute_seconds` and `charged_seconds` can disagree for a given row, for example one being 0 while the other is not. AWS says this is expected, so aggregate over hours or days before you draw conclusions.'},
{code:`-- Daily RPU-hours charged (multiply by your Region price per RPU-hour for money)
SELECT TRUNC(start_time) AS day,
       SUM(charged_seconds) / 3600.0 AS rpu_hours
FROM sys_serverless_usage
GROUP BY 1 ORDER BY 1;

-- Which users or queries ran during the busy hour?
SELECT username, COUNT(*) AS queries, SUM(elapsed_time)/1000000.0 AS total_s
FROM sys_query_history
WHERE start_time BETWEEN '2026-10-01 09:00' AND '2026-10-01 10:00'
GROUP BY 1 ORDER BY total_s DESC;`},
{h:'Controls'},
{ul:['**Base capacity** sets the starting point and **maximum RPU capacity** caps the spend (Section 4).','**Usage limits** with an action (log, alert or turn off the feature) guard compute, cross-Region sharing and similar features.','**Price-performance target** lets Serverless decide how aggressively to scale.','Query monitoring rules and query limits stop runaway queries from consuming RPUs (Section 9).','Alarm on usage with CloudWatch metrics for compute seconds, and watch AWS Budgets or Cost Explorer for the full bill.']},
{h:'Keeping history'},
{p:'Seven days is short. Insert a daily summary into a table, or use the system-table retention integration (Section 11) to keep the history for monthly cost reviews.'}],
src:[['SYS_SERVERLESS_USAGE',DG+'SYS_SERVERLESS_USAGE.html'],['Billing for Redshift Serverless',MG+'serverless-billing.html'],['Monitoring Serverless',MG+'serverless-monitoring.html']]};

/* ================= LECTURE 10 ================= */
L['rs:11:10']={blocks:[
{p:'A good dashboard shows the few signals that need action, not every metric. Build one for operators (is it healthy?) and one for managers (cost and usage).'},
{h:'Operations dashboard: panels to include'},
{t:[['Panel','Source'],
['Health and maintenance status','`HealthStatus`, `MaintenanceMode`'],
['CPU and disk by node','`CPUUtilization`, `PercentageDiskSpaceUsed`'],
['Connections and commit queue','`DatabaseConnections`, `CommitQueueLength`'],
['Queue length and wait','`WLMQueueLength`, `WLMQueueWaitTime`'],
['Query duration by class','`QueryDuration` by `latency`'],
['Concurrency scaling and usage limits','`ConcurrencyScalingActiveClusters`, `UsageLimitConsumed`'],
['Recent failures','Count of failed queries and loads from the retained history']]},
{h:'Where to build it'},
{ul:['**CloudWatch dashboards** for metrics and alarms, with a widget for each panel above.','**CloudWatch Logs Insights** for audit logs exported to CloudWatch (Section 11).','**Athena or Redshift** queries over long-term system table data kept in S3 Tables.','**Amazon Managed Grafana**, QuickSight or your BI tool for management views.']},
{h:'Keeping history for trends'},
{flow:['Load or integrate SYS data on a schedule','Keep daily and hourly aggregates','Chart p50, p90 and p99 runtimes','Compare to the baseline']},
{code:`-- Simple daily snapshot table for trends (schedule it)
CREATE TABLE IF NOT EXISTS admin.query_daily (d date, query_type varchar(32), runs bigint, p50_s float, p90_s float, failed bigint);

INSERT INTO admin.query_daily
SELECT start_time::date, query_type, COUNT(*),
       MEDIAN(elapsed_time)/1000000.0,
       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY elapsed_time)/1000000.0,
       SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END)
FROM sys_query_history
WHERE start_time >= CURRENT_DATE - 1 AND start_time < CURRENT_DATE
GROUP BY 1,2;`},
{h:'Dashboard rules'},
{ul:['Each chart answers a question. Remove charts nobody uses.','Show thresholds and the baseline on the chart.','Link each alarm to a runbook.','Review the dashboards in an incident review, and fix what was missing.']},
{note:'Observability is a loop: detect, diagnose, fix, then improve what you can see. After every incident, ask what signal would have warned you sooner.'}],
src:[['Monitoring Amazon Redshift',MG+'metrics.html'],['CloudWatch dashboards','https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Dashboards.html'],['Long-term system table retention','https://aws.amazon.com/blogs/big-data/long-term-system-tables-retention-in-amazon-redshift-with-amazon-s3-tables/']]};
})();
