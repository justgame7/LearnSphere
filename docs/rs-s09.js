/* LearnSphere - Amazon Redshift, Section 09: Workload Management & Concurrency.
   Lectures 0-5 are core, 6-10 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const wlm=R.dg(700,290,[
[10,100,120,60,'Queries|from users, jobs, tools',0],
[170,50,160,160,'Routing rules',1],
[185,80,130,40,'user group or role',0],[185,130,130,40,'query group label',0],
[370,10,320,270,'Queues (each with its own settings)',1],
[385,45,290,55,'ETL queue|priority high, no scaling',2],
[385,110,290,55,'Dashboards queue|priority normal, concurrency scaling',2],
[385,175,290,55,'Ad hoc queue|priority low, limits via monitoring rules',2],
[385,240,290,30,'Default queue: everything else',0]],
[[130,130,170,130],[330,100,385,70],[330,150,385,135],[330,160,385,195]]);

const patt=R.dg(700,260,[
[10,10,215,240,'ETL and loads',1],[240,10,215,240,'Dashboards and BI',1],[470,10,220,240,'Ad hoc analysis',1],
[25,45,185,45,'High priority',2],[25,100,185,45,'Predictable window',0],[25,155,185,45,'Own warehouse or queue',0],
[255,45,185,45,'Normal priority',2],[255,100,185,45,'Concurrency scaling',0],[255,155,185,45,'Short queries first (SQA)',0],
[485,45,190,45,'Low priority',2],[485,100,190,45,'Guardrails: time and spill limits',0],[485,155,190,45,'Separate consumer warehouse',0]],
[]);

/* ================= LECTURE 0 ================= */
L['rs:8:0']={blocks:[
{p:'A warehouse is shared. Dashboards, nightly loads and analysts all want resources at once. **Workload management (WLM)** decides who runs now, who waits and how much each query gets, so one heavy job cannot starve everything else.'},
{svg:wlm},
{h:'The core ideas'},
{ul:['**Queues**: queries are routed into queues. Each queue has its own settings: how many queries run at once, how much memory, what priority, and what rules apply.','**Routing**: Redshift decides which queue a query goes to from the **user group** or **user role** of the person running it, or from a **query group** label the session sets.','**Concurrency**: how many queries in a queue run at the same time. Extra queries **wait** in the queue.','**Rules and priorities**: you can limit runaway queries and rank workloads by importance.']},
{h:'Two modes (provisioned)'},
{t:[['','Automatic WLM','Manual WLM'],
['Who decides concurrency and memory','Redshift, from what each query needs','You set slots and memory percent per queue'],
['Priorities','Yes: five levels per queue','No'],
['Best for','Almost everyone: AWS recommends it in most cases','Specialised cases that need fixed control'],
['Queues','Up to 8 user queues (service classes 100 to 107)','Up to 8 user queues (service classes 6 to 13)']]},
{p:'With **automatic WLM** the number of concurrent queries changes with the workload: fewer when heavy queries (such as hash joins on large tables) are running, more when light queries (inserts, simple scans) arrive. A cluster does not always run the manual maximum of 50 at once.'},
{h:'Built-in queues'},
{ul:['**Superuser queue**: reserved for superusers, for emergencies and troubleshooting (such as cancelling a runaway query). Use it by running `SET query_group TO \'superuser\'`. It cannot be configured and is not for routine work.','**Default queue**: catches every query not routed elsewhere. It must be the last queue in the configuration.','**Short query acceleration** has its own fast lane for short read queries (Section 8).']},
{h:'Where the configuration lives'},
{p:'WLM is configured in the **`wlm_json_configuration`** parameter of a **parameter group** (Section 4). The console builds the JSON for you, and you can also use the CLI. Switching between automatic and manual WLM puts the cluster in `pending reboot`: the change takes effect after the next reboot.'},
{h:'Serverless'},
{p:'Serverless does not use slots or memory percentages: it scales compute automatically. It does support **query queues with monitoring rules** assigned by user role or query group, plus base and maximum capacity and usage limits (later lecture).'},
{h:'The levers, in order of preference'},
{flow:['Good table design and SQL (Sections 6 and 8)','Automatic WLM with priorities','Concurrency scaling for bursts','Rules to stop runaway queries','Separate warehouses for hard isolation']},
{note:'WLM is for sharing one warehouse fairly. It cannot make an under-sized or badly designed warehouse fast. Fix design first, then tune workload management.'}],
src:[['Workload management',DG+'cm-c-implementing-workload-management.html'],['Implementing automatic WLM',DG+'automatic-wlm.html'],['WLM system tables and views',DG+'cm-c-wlm-system-tables-and-views.html']]};

/* ================= LECTURE 1 ================= */
L['rs:8:1']={blocks:[
{p:'**Automatic WLM** is the recommended mode. You define queues, say who goes where and how important each is, and Redshift handles concurrency and memory. This applies to Provisioned only.'},
{h:'What automatic WLM does'},
{ul:['Redshift works out how many queries run at once and how much memory each gets, from what the running **and queued** queries need.','It runs **fewer** big queries or **more** light queries as the mix changes. Concurrency and memory are **not configurable** in auto mode.','It works alongside **short query acceleration (SQA)** so short queries are not stuck behind long ones.','If your clusters use the **default parameter group**, automatic WLM is already on. For a custom group, set it up in the group `wlm_json_configuration`.']},
{h:'What you configure per queue'},
{t:[['Setting','Meaning'],
['**Priority**','`HIGHEST`, `HIGH`, `NORMAL` (default), `LOW`, `LOWEST`'],
['**Concurrency scaling mode**','`auto` sends eligible queries to extra capacity instead of waiting; `off` keeps them on the main cluster'],
['**User groups and user roles**','Queries by members go to this queue; names or wildcards'],
['**Query groups**','A label a session sets at run time'],
['**Wildcards**','Off by default; with them `dba_*` matches `dba_admin`; matching is case-insensitive'],
['**Query monitoring rules**','Log, abort or change priority on conditions (next lectures)']]},
{ul:['You can have up to **eight** user queues.','The **timeout** field is not available in automatic WLM: use a query monitoring rule on `query_execution_time` instead.','The **hop** action does not apply; use **change priority**.','Do not mix automatic and manual queues in one parameter group.']},
{h:'An example configuration'},
{p:'Three workloads: loading jobs run as the group `etl`, BI users are in `bi`, analysts use a query group label `adhoc`.'},
{code:`[
  { "name": "etl",        "user_group": ["etl"],  "priority": "high",   "queue_type": "auto", "auto_wlm": true, "concurrency_scaling": "off" },
  { "name": "dashboards", "user_group": ["bi"],   "priority": "normal", "queue_type": "auto", "concurrency_scaling": "auto" },
  { "name": "adhoc",      "query_group": ["adhoc"], "priority": "low",  "queue_type": "auto", "concurrency_scaling": "auto" },
  { "short_query_queue": true }
]`},
{p:'Apply it from a file. The parameter value is itself a JSON string, so build the file with the console output if you can.'},
{code:`# params.json
[ { "ParameterName": "wlm_json_configuration",
    "ParameterValue": "[{\\"name\\":\\"etl\\",\\"user_group\\":[\\"etl\\"],\\"priority\\":\\"high\\",\\"queue_type\\":\\"auto\\",\\"auto_wlm\\":true},{\\"short_query_queue\\":true}]" } ]

aws redshift modify-cluster-parameter-group --parameter-group-name prod-params --parameters file://params.json`},
{h:'Static and dynamic changes'},
{ul:['**Dynamic** (no reboot) in automatic WLM: user groups and roles, query groups, wildcards, concurrency scaling mode, priority, SQA maximum runtime, adding or removing queues, and query monitoring rules.','**Static**: switching between automatic and manual WLM, which needs a reboot. If you change static and dynamic properties together, reboot for all of them to apply.']},
{h:'Check what is in force'},
{code:`-- Returns rows when automatic WLM is on (service classes 100 to 107)
SELECT * FROM stv_wlm_service_class_config WHERE service_class >= 100;

-- Queries per queue with average run time and queue time (microseconds)
SELECT final_state, service_class, COUNT(*), AVG(total_exec_time) AS avg_exec,
       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY total_queue_time) AS p90_queue,
       AVG(total_queue_time) AS avg_queue
FROM   stl_wlm_query WHERE userid >= 100 GROUP BY 1, 2 ORDER BY 2, 1;`},
{note:'Start simple: keep the default automatic queue and SQA, then add one queue per workload that needs a different priority. Many small queues make the system harder to reason about.'}],
src:[['Implementing automatic WLM',DG+'automatic-wlm.html'],['WLM dynamic and static properties',DG+'cm-c-wlm-dynamic-properties.html'],['Configuring workload management',MG+'workload-mgmt-config.html']]};

/* ================= LECTURE 2 ================= */
L['rs:8:2']={blocks:[
{p:'Queues only help if the right queries land in the right queue. There are three ways to route a query, and a priority system that tells Redshift which workload matters most. This applies to Provisioned only (Serverless queues route by role and query group).'},
{h:'1. User groups'},
{p:'Put users in groups and list the group in a queue. Everything those users run goes to that queue, with no change to their queries.'},
{code:`CREATE GROUP etl_group WITH USER etl_loader, etl_scheduler;
CREATE GROUP bi_group  WITH USER tableau_svc, quicksight_svc;
ALTER GROUP bi_group ADD USER report_user;`},
{h:'2. User roles'},
{p:'If a user has a role and the role is listed on a queue, the user queries go to that queue. Roles can be nested, and `SVV_USER_GRANTS` and `SVV_ROLE_GRANTS` show who has what (Section 10).'},
{code:`CREATE ROLE analyst_role;
GRANT ROLE analyst_role TO test_user;
SELECT * FROM svv_user_grants;`},
{h:'3. Query groups: a label you set'},
{p:'A query group is just a **label**. A session sets it, and queries that follow run in the queue that lists that label until you reset it or the session ends. The label must be listed in the WLM configuration or the command has no effect. The label is also recorded in query logs, which helps troubleshooting.'},
{code:`SET query_group TO 'adhoc';
SELECT COUNT(*) FROM curated.fact_sales;
RESET query_group;

-- Superuser queue (emergency work only)
SET query_group TO 'superuser';
VACUUM curated.fact_sales;
RESET query_group;`},
{t:[['Method','Best for','Notes'],
['User group or role','Whole teams or application accounts','Transparent; set once'],
['Query group','Different kinds of work from the same user or tool','The application must set the label'],
['Superuser queue','Emergencies and maintenance','Never routine queries']]},
{h:'Priority'},
{ul:['Each queue in automatic WLM has a priority: `HIGHEST`, `HIGH`, `NORMAL` (default), `LOW`, `LOWEST`. All queries in the queue inherit it.','Redshift uses priority when **admitting** queries and when deciding **how many resources** a query gets. A high-priority workload gets the right of way, and low-priority workloads run longer, but they do not starve: they keep making progress.','Superusers also have **CRITICAL**, above HIGHEST, set with `CHANGE_QUERY_PRIORITY`, `CHANGE_SESSION_PRIORITY` or `CHANGE_USER_PRIORITY`. Only one CRITICAL query runs at a time, and rollbacks always run at CRITICAL.','Priority can change while a query runs, with a query monitoring rule using `change_query_priority`.']},
{code:`-- Priority of waiting and running queries (provisioned)
SELECT query, service_class, state, queue_time, query_priority FROM stv_wlm_query_state ORDER BY query;

-- Priority of completed queries
SELECT query, service_class, query_priority FROM stl_wlm_query ORDER BY service_class_start_time DESC LIMIT 10;`},
{h:'A worked example'},
{p:'ETL runs every six hours and must finish on time. Analytics runs all day. Give ETL **high** priority and analytics **normal**. When only analytics is running it gets the whole warehouse; when ETL starts it gets the right of way and finishes predictably. Add **concurrency scaling** to the analytics queue so its users keep steady performance while ETL runs.'},
{note:'Redshift may adjust query priority itself to improve throughput, but only when automatic WLM is on, there is a single queue and you have no rules that set priority. Defining your own priorities turns that off.'}],
src:[['Assigning queries to queues',DG+'cm-c-executing-queries.html'],['Query priority',DG+'query-priority.html'],['WLM queue assignment rules',DG+'cm-c-wlm-queue-assignment-rules.html']]};

/* ================= LECTURE 3 ================= */
L['rs:8:3']={blocks:[
{p:'**Query monitoring rules (QMR)** are guardrails. They watch queries while they run and act when one crosses a limit: log it, change its priority, or stop it. They work on Provisioned and Serverless.'},
{h:'Anatomy of a rule'},
{ul:['A **rule name**: unique, up to 32 letters, digits or underscores.','Up to **three predicates**: each is a metric, an operator (`=`, `<`, `>`) and a value. **All** predicates must be true for the rule to fire.','**One action**.','Up to **25 rules per queue** and **25 in total**.','WLM checks metrics **every 10 seconds**. If several rules fire, the most severe action wins.']},
{h:'Actions'},
{t:[['Action','Effect','Mode'],
['**log**','Writes a record to `STL_WLM_RULE_ACTION`; the query keeps running. At most one log per query per rule','Both'],
['**change_query_priority**','Changes the priority of the query','Provisioned, automatic WLM'],
['**hop**','Moves the query to the next matching queue, or cancels it if none. Only for `SELECT` and CTAS; not supported with `query_queue_time`','Provisioned, manual WLM'],
['**abort**','Cancels the query. Does not stop `COPY` or maintenance such as `ALTER`, `ANALYZE` and `VACUUM`','Both']]},
{h:'Useful metrics'},
{t:[['Metric','What it measures'],
['`query_execution_time`','Run time in seconds (excludes queue time)'],
['`query_queue_time`','Seconds waiting in a queue'],
['`query_cpu_time`, `query_cpu_usage_percent`','CPU seconds, and percent of CPU capacity'],
['`query_blocks_read`','1 MB blocks read'],
['`query_temp_blocks_to_disk`','Temporary disk used for intermediate results (spill), in 1 MB blocks'],
['`scan_row_count`, `join_row_count`, `return_row_count`','Rows scanned, joined or returned'],
['`nested_loop_join_row_count`','Rows in a nested loop join'],
['`cpu_skew`, `io_skew`, `segment_execution_time`','Skew ratios and segment run time (add `segment_execution_time > 10` to avoid sampling errors)'],
['`spectrum_scan_row_count`, `spectrum_scan_size_mb`','Data lake rows and MB scanned'],
['`query_priority`','`HIGHEST` to `LOWEST`']]},
{h:'Example rules'},
{code:`"rules": [
  { "rule_name": "stop_long_queries",
    "predicate": [ { "metric_name": "query_execution_time", "operator": ">", "value": 3600 } ],
    "action": "abort" },
  { "rule_name": "log_nested_loops",
    "predicate": [ { "metric_name": "nested_loop_join_row_count", "operator": ">", "value": 100 } ],
    "action": "log" },
  { "rule_name": "demote_heavy_spill",
    "predicate": [ { "metric_name": "query_temp_blocks_to_disk", "operator": ">", "value": 1000000 },
                   { "metric_name": "query_priority", "operator": "=", "value": "normal" } ],
    "action": "change_query_priority", "value": "lowest" }
]`},
{p:'The console offers **templates**: nested loop join (`nested_loop_join_row_count > 100`), high return rows (`return_row_count > 1000000`), high join rows (`join_row_count > 1000000000`), heavy disk spill (`query_temp_blocks_to_disk > 100000`, about 100 GB) and long runtime with high I/O skew. Start with `log`, watch the log for a while, then promote to `abort` where it is safe.'},
{ul:['For limiting run time use a **QMR on `query_execution_time`** rather than the deprecated WLM timeout.','Adding, changing or deleting a rule takes effect **without a reboot**.','Rules apply at the **child query** level when Redshift rewrites a query.']},
{h:'Where the evidence is'},
{code:`SELECT * FROM stl_wlm_rule_action ORDER BY recordtime DESC LIMIT 20;       -- provisioned: what fired
SELECT * FROM svl_query_metrics_summary ORDER BY query DESC LIMIT 20;      -- peak metrics per query
SELECT * FROM stv_query_metrics;                                           -- running queries now`},
{p:'Use the maximum values in `SVL_QUERY_METRICS_SUMMARY` to pick sensible thresholds: set a limit just above what normal healthy queries reach.'},
{h:'Serverless'},
{p:'On Serverless, monitoring rules live in **queues** in the workgroup `wlm_json_configuration` (next lectures). Actions are **log** and **abort** only. The metrics are named with a `max_` prefix in the console (for example `max_query_execution_time`, `max_query_temp_blocks_to_disk`).'},
{note:'Rules should catch mistakes, not normal work. A runaway Cartesian join or a query that spills a terabyte is a mistake; a big nightly report is not.'}],
src:[['WLM query monitoring rules',DG+'cm-c-wlm-query-monitoring-rules.html'],['STL_WLM_RULE_ACTION',DG+'r_STL_WLM_RULE_ACTION.html'],['SVL_QUERY_METRICS_SUMMARY',DG+'r_SVL_QUERY_METRICS_SUMMARY.html']]};

/* ================= LECTURE 4 ================= */
L['rs:8:4']={blocks:[
{p:'**Concurrency scaling** adds temporary clusters when queries pile up. Eligible queries run there instead of waiting, and you see the same up-to-date data either way. It is the answer to **bursts** of concurrent users, not to a single slow query.'},
{h:'How it works'},
{flow:['Queue is full on the main cluster','Eligible queries go to a scaling cluster','They read the same current data','Scaling clusters disappear when demand drops']},
{ul:['You turn it on **per WLM queue** by setting its concurrency scaling mode to **auto**. When the queue is full, eligible queries run on a scaling cluster instead of waiting; when slots free up they use the main cluster.','It handles **reads** (dashboards) and common **writes**: `COPY`, `INSERT`, `DELETE`, `UPDATE`, `CTAS`, `VACUUM`, manual refresh of materialized views and automatic vacuum. Write support needs **RG or RA3** nodes.','The default number of scaling clusters is **1**, set with `max_concurrency_scaling_clusters`. The account quota is 10 and can be raised.','You can send queries there by user group, role, query group or by a rule (for example, anything over five seconds).']},
{h:'Is my query eligible?'},
{ul:['The cluster must be on EC2-VPC, use a supported node type, and **not** be single-node. For RG and RA3 it must have **at most 32 compute nodes**, and must have been created with at most 32.','**Not supported**: tables with interleaved sort keys, temporary tables, no-backup tables, queries on system or catalog tables, queries with Python or Lambda UDFs, and COPY or UNLOAD that touch external resources protected by restrictive VPC, VPC endpoint or IP policies.','Writes are **not** supported on `DISTSTYLE ALL` targets or tables with identity columns, and most DDL is not supported. A non-supported write earlier in a transaction keeps the whole transaction on the main cluster.']},
{h:'Billing'},
{ul:['You pay only while scaling clusters **actively run queries**, per second, at the on-demand rate for the node type and count, with a one-minute minimum each time they start.','Each main cluster earns about **one free hour per day**, accumulating up to **30 hours**. Credits apply to reads and writes.','Cap spend with `max_concurrency_scaling_clusters` and by enabling scaling only on the queues that need it.']},
{h:'Check it is working'},
{code:`-- Which queries ran on scaling clusters? (primary = main, primary-scale = scaling)
SELECT query_id, compute_type, queue_time/1000000.0 AS queue_s, execution_time/1000000.0 AS exec_s
FROM   sys_query_history WHERE compute_type = 'primary-scale' ORDER BY start_time DESC LIMIT 20;

SELECT * FROM svcs_concurrency_scaling_usage ORDER BY start_time DESC LIMIT 10;`},
{p:'Compare **queue time** for queries on the main cluster and on scaling clusters. If queue time on the main cluster is still high, the queries may not be eligible: check the list above.'},
{h:'Serverless'},
{p:'Concurrency scaling as a separate feature is a provisioned concept. Serverless scales its own compute with the workload, up to the **maximum capacity** you set, and bills in RPU-hours (Section 4).'},
{note:'Use concurrency scaling for unpredictable spikes of read queries. For steady load, a bigger cluster or a separate warehouse is cheaper than paying for scaling hours every day.'}],
src:[['Concurrency scaling',DG+'concurrency-scaling.html'],['max_concurrency_scaling_clusters',DG+'r_max_concurrency_scaling_clusters.html'],['Redshift pricing: concurrency scaling','https://aws.amazon.com/redshift/pricing/']]};

/* ================= LECTURE 5 ================= */
L['rs:8:5']={blocks:[
{p:'Serverless has no slots, memory percentages or node counts to tune. You control workloads with **capacity**, **limits** and **query queues with monitoring rules**. This lecture applies to Serverless only.'},
{h:'Capacity controls (Section 4)'},
{t:[['Control','Effect'],
['**Base capacity**','The starting compute for the workgroup (4 to 512 RPUs, more in some Regions)'],
['**Maximum capacity**','The ceiling for scaling; the simplest cost cap'],
['**Price-performance target**','How aggressively Serverless scales; Balanced by default'],
['**Usage limits**','RPU-hour limits per day, week or month with `log`, `emit-metric` or `deactivate`']]},
{h:'Query monitoring rules, without queues'},
{p:'By default a monitoring rule applies to **every query** in the workgroup. Available metrics include `max_query_execution_time`, `max_query_queue_time`, `max_query_blocks_read`, `max_scan_row_count`, `max_join_row_count`, `max_nested_loop_join_row_count` and `max_query_temp_blocks_to_disk`. Actions are **log** and **abort**. Exceeding the execution time stops the query.'},
{h:'Query queues (optional)'},
{p:'You can also create **queues** in the workgroup under the **Limits** tab, each with its own rules, assigned by **user role** and **query group**. Rules in a queue affect only that queue queries.'},
{code:`aws redshift-serverless update-workgroup --workgroup-name lab-wg --config-parameters \\
 '[{"parameterKey":"wlm_json_configuration","parameterValue":"[{\\"name\\":\\"dashboard\\",\\"user_role\\":[\\"analyst\\"],\\"query_group\\":[\\"reporting\\"],\\"rules\\":[{\\"rule_name\\":\\"short_timeout\\",\\"predicate\\":[{\\"metric_name\\":\\"query_execution_time\\",\\"operator\\":\\">\\",\\"value\\":60}],\\"action\\":\\"abort\\"}]},{\\"name\\":\\"etl\\",\\"user_role\\":[\\"loader\\"],\\"rules\\":[{\\"rule_name\\":\\"spill\\",\\"predicate\\":[{\\"metric_name\\":\\"query_temp_blocks_to_disk\\",\\"operator\\":\\">\\",\\"value\\":100000}],\\"action\\":\\"abort\\"}]}]"}]'`},
{ul:['Queue fields: `name`, `user_role`, `query_group`, `query_group_wild_card`, `rules`.','Rule fields: `rule_name` (unique), 1 to 3 `predicate` entries and an `action` of `abort` or `log`.','Limits: **8 queues**, **25 rules** across all queues, 3 predicates per rule.','**Enabling queues is permanent**: you cannot go back to queue-less monitoring afterwards.']},
{h:'What is not supported on Serverless'},
{ul:['Queue **priorities**, `change_query_priority` and `hop`.','The provisioned keys `auto_wlm`, `concurrency_scaling`, `priority`, `queue_type`, `query_concurrency`, `memory_percent_to_use`, `user_group`, `short_query_queue` and `max_execution_time`.','Serverless manages scaling and resource allocation itself, so there is no priority to configure.']},
{h:'Practical controls for different workloads'},
{t:[['Goal','Use'],
['Stop runaway queries','A monitoring rule: `query_execution_time` or `query_temp_blocks_to_disk` with `abort`'],
['Keep dashboards snappy while ETL runs','Give each its own **workgroup** (sharing data between them) or size base capacity for the peak'],
['Cap monthly spend','Maximum capacity and a monthly usage limit'],
['Different limits per team','Queues keyed by user role']]},
{note:'Because Serverless has no priorities, hard isolation between heavy ETL and dashboards is best done with separate workgroups that share data (see the isolation lecture).'}],
src:[['Setting query queues (Serverless)',MG+'serverless-workgroup-query-queues.html'],['Query monitoring rules',DG+'cm-c-wlm-query-monitoring-rules.html'],['Compute capacity for Serverless',MG+'serverless-capacity.html']]};

/* ================= ADDITIONAL 6 ================= */
L['rs:8:6']={blocks:[
{p:'**Manual WLM** gives you fixed control over queues, slots and memory. Most workloads do better on automatic WLM, but you will meet manual configurations, so you must understand them and know how to move off them safely.'},
{h:'How manual WLM works'},
{ul:['A **queue** has a number of **slots**, its **concurrency level**. Queries run until all slots are busy; the rest **wait**.','Each queue gets a share of cluster memory, **divided evenly among its slots**. A queue with 20 percent of memory and 10 slots gives each query 2 percent, and the share is fixed whatever the queue is doing.','**Defaults**: one reserved superuser queue, plus one default user queue running **5** queries at once. The default queue must be last and cannot have user or query groups.','You can add queues up to **eight user queues**. The maximum total slots across all user queues is **50**, but AWS recommends **15 or fewer**.','`WLM memory percent to use`: set an integer percent per queue (total up to 100); unallocated memory is managed by Redshift and lent out when needed.','**Timeout** (`max_execution_time`) is deprecated: use a query monitoring rule on `query_execution_time`. The lower of `statement_timeout` and WLM timeout applies.']},
{h:'Dynamic and static'},
{ul:['**Dynamic** in manual WLM: concurrency, memory percent, timeout, concurrency scaling mode, SQA settings.','**Static** (reboot needed): user groups, query groups, wildcards and adding or removing queues.']},
{h:'Giving one query more memory'},
{code:`-- Use 3 slots (and so 3x the memory) for the next statements in this session
SET wlm_query_slot_count TO 3;
VACUUM curated.fact_sales;
RESET wlm_query_slot_count;`},
{p:'This borrows slots from the queue, so other queries wait. It is useful for a one-off heavy statement, especially `VACUUM`, and is not available as a parameter-group setting.'},
{h:'Migrating from manual to automatic WLM'},
{flow:['Create a new parameter group','Switch it to automatic WLM','Add a queue per workload using the same user groups','Set priorities from business importance','Turn on concurrency scaling where useful','Attach the group and reboot']},
{ul:['The change needs a **reboot**, so plan a quiet window.','Example: an ETL queue becomes **high**, analytics **normal**, data science **low**. When only analytics runs it now gets the whole warehouse instead of a fixed share, which is the main gain.','The **timeout** and **hop** options do not exist in automatic WLM. Replace timeouts with a `query_execution_time` rule and hops with `change_query_priority`.','Do not mix automatic and manual queues in one parameter group.','Keep the old parameter group so you can switch back if needed.']},
{t:[['Manual setting','Automatic equivalent'],
['Slots per queue','Automatic concurrency'],
['Memory percent','Automatic memory'],
['Timeout','QMR `query_execution_time` with abort'],
['Hop action','QMR `change_query_priority`'],
['Separate short-query queue','Short query acceleration']]},
{note:'Before you migrate, record queue time and run time for your key queries so you can show the effect afterwards.'}],
src:[['Implementing manual WLM',DG+'cm-c-defining-query-queues.html'],['Migrating from manual to automatic WLM',DG+'cm-c-implementing-workload-management.html'],['wlm_query_slot_count',DG+'r_wlm_query_slot_count.html']]};

/* ================= ADDITIONAL 7 ================= */
L['rs:8:7']={blocks:[
{p:'In manual WLM, **slots** and **memory** are the two numbers that decide whether queries wait or spill. Getting them wrong has clear symptoms.'},
{h:'The trade-off'},
{t:[['Too few slots','Too many slots'],
['Queries **queue** behind each other','More queries run at once, but each gets **less memory**'],
['Memory per query is large','Queries that fit in memory at 5 slots may **spill to disk** at 20'],
['Low throughput for short queries','Disk I/O rises, queries slow down, and the cluster has contention'],
['Fix: more slots or SQA, or send short queries elsewhere','Fix: fewer slots, or more memory to the queue']]},
{ul:['Memory per slot = queue memory / slots, and it is **fixed**. Raising the slot count lowers each query share.','Above about **15 total slots** contention for system resources can limit throughput: for more parallelism use **concurrency scaling** instead of more slots.','Queries that touch one slice (for example a simple aggregate with a predicate on the distribution key) can run well in a queue with a higher concurrency, since different queries use different slices.']},
{h:'Symptoms'},
{t:[['Symptom','Likely cause','Check'],
['High `queue_time`, low `execution_time`','Not enough slots for the workload','Queue time by queue (next lecture)'],
['Queries spill (`spilled_block_*`, `query_temp_blocks_to_disk`)','Too many slots for the memory, or a heavy query in a small slot','Spill per query'],
['A queue never uses all its slots','Slots wasting memory','Advisor: reallocate WLM memory'],
['One query needs much more memory','Standard slot too small for it','`wlm_query_slot_count` for that statement']]},
{h:'Measure before you change'},
{code:`-- Spill per query (works on provisioned and Serverless)
SELECT query_id, SUM(spilled_block_local_disk) AS local_blocks, SUM(spilled_block_remote_disk) AS remote_blocks
FROM   sys_query_detail
WHERE  start_time > DATEADD(day, -1, GETDATE())
GROUP  BY query_id HAVING SUM(spilled_block_local_disk) + SUM(spilled_block_remote_disk) > 0
ORDER  BY 2 DESC LIMIT 20;

-- Provisioned: current queue state and slot use
SELECT service_class, num_queued_queries, num_executing_queries, num_query_tasks
FROM   stv_wlm_service_class_state WHERE service_class > 5 ORDER BY service_class;`},
{h:'Advisor guidance'},
{p:'Advisor recommends **reducing the slots** of a queue when it finds a queue with slots that were completely inactive, or a queue with more than four slots that had at least two inactive slots. Cutting unused slots hands their memory to the slots that are used. Make sure its analysis captured a **peak** period before you act.'},
{h:'A tuning loop'},
{flow:['Measure queue time and spill per queue','Change one queue slots or memory','Wait for a full business cycle','Compare queue time and run time','Keep or revert']},
{ul:['Prefer **automatic WLM**, which does this continuously.','Keep the total slots at 15 or fewer and use concurrency scaling for more.','Use SQA instead of a dedicated short-query queue.','Use a QMR to log queries that spill heavily so you can fix their SQL.']},
{note:'Do not use memory-hungry settings to hide a bad query. A query that needs ten times the memory because of a missing filter should be fixed at the source.'}],
src:[['Implementing manual WLM',DG+'cm-c-defining-query-queues.html'],['Advisor: reallocate WLM memory',DG+'advisor-recommendations.html'],['SYS_QUERY_DETAIL',DG+'SYS_QUERY_DETAIL.html']]};

/* ================= ADDITIONAL 8 ================= */
L['rs:8:8']={blocks:[
{p:'A user says the warehouse is slow. First find out whether queries are **running slowly** or **waiting to start**. These are different problems with different fixes, and `SYS_QUERY_HISTORY` separates them.'},
{h:'Queue time vs run time'},
{code:`-- Times in microseconds. Works on provisioned and Serverless.
SELECT DATE_TRUNC('hour', start_time) AS hour,
       COUNT(*) AS queries,
       AVG(queue_time)/1000000.0     AS avg_queue_s,
       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY queue_time)/1000000.0 AS p90_queue_s,
       AVG(execution_time)/1000000.0 AS avg_run_s
FROM   sys_query_history
WHERE  query_type = 'SELECT' AND start_time > DATEADD(day, -1, GETDATE())
GROUP  BY 1 ORDER BY 1;`},
{t:[['Pattern','Meaning','Action'],
['Queue time high, run time normal','Workload outgrew its queue or capacity','More concurrency scaling, priority, a separate warehouse, or more capacity'],
['Queue time near zero, run time high','Queries are slow themselves','Tuning: Sections 6 and 8'],
['Queue time spikes at fixed hours','A scheduled job collides with users','Reschedule, or isolate'],
['Both high','Overloaded system','Check spill, skew and sizing']]},
{h:'By queue'},
{code:`-- Provisioned: queue time and run time per queue, and priority
SELECT service_class_name, query_priority, COUNT(*) AS queries,
       AVG(queue_time)/1000000.0 AS avg_queue_s,
       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY queue_time)/1000000.0 AS p90_queue_s,
       AVG(execution_time)/1000000.0 AS avg_run_s
FROM   sys_query_history
WHERE  start_time > DATEADD(day, -1, GETDATE()) AND query_type = 'SELECT'
GROUP  BY 1, 2 ORDER BY p90_queue_s DESC;`},
{p:'`service_class_name` and `query_priority` are filled for provisioned clusters only. A queue with a long **90th-percentile queue time** while others are quiet is **starving**: it has too few slots or too low a priority for its demand.'},
{h:'Now: who is waiting?'},
{code:`SELECT query_id, user_id, username, status, queue_time/1000000.0 AS queued_s, LEFT(query_text, 80) AS q
FROM   sys_query_history WHERE status IN ('queued', 'running') ORDER BY start_time;

-- Provisioned: queue state per service class
SELECT * FROM stv_wlm_query_state ORDER BY service_class, queue_time DESC;`},
{h:'Finding starving queues'},
{ul:['Look for a queue whose p90 queue time is many times its average run time.','Check its **priority**: a low-priority queue behind a high one waits longer by design. Decide whether that is acceptable.','Check whether its queries are **eligible for concurrency scaling** and whether scaling is on.','Check slots in manual WLM: all slots busy with long queries means short ones wait. Turn on SQA.']},
{h:'Make it routine'},
{flow:['Report p90 queue time per queue daily','Alert when it passes your target','Investigate by hour and by user','Change one thing','Review the next week']},
{ul:['Set a **service target** such as "dashboard queries start within 2 seconds, 95 percent of the time", and measure against it.','Keep the history: `SYS_` views keep limited history, so copy the summary to a table.','Share the report with teams: it explains why a job feels slow without anyone guessing.']},
{note:'Queue time is often invisible to users, who only see total elapsed time. Report queue and run time separately and the right owner can act.'}],
src:[['SYS_QUERY_HISTORY',DG+'SYS_QUERY_HISTORY.html'],['WLM system tables and views',DG+'cm-c-wlm-system-tables-and-views.html']]};

/* ================= ADDITIONAL 9 ================= */
L['rs:8:9']={blocks:[
{p:'Queues share one set of resources. When workloads must not affect each other at all, give each its own **warehouse** and share the data between them with **data sharing**.'},
{h:'When queues are not enough'},
{ul:['A heavy ETL job still competes with dashboards for the same CPU, memory and I/O, even with priorities.','Teams need **separate cost reporting** (chargeback).','Workloads need **different sizes or schedules**: a steady ETL warehouse and a spiky analyst warehouse.','A single warehouse has **several active, unrelated databases**: Advisor recommends moving them to separate warehouses to cut contention.']},
{h:'The pattern'},
{flow:['Producer warehouse owns and loads the data','Share schemas and tables as a datashare','Consumer warehouses read the live data','Each consumer is sized and paused independently','Dashboards and ad hoc never touch the ETL compute']},
{code:`-- Producer
CREATE DATASHARE curated_share;
ALTER DATASHARE curated_share ADD SCHEMA curated;
ALTER DATASHARE curated_share ADD ALL TABLES IN SCHEMA curated;
GRANT USAGE ON DATASHARE curated_share TO NAMESPACE '<bi-namespace-id>';

-- Consumer
CREATE DATABASE curated FROM DATASHARE curated_share OF NAMESPACE '<etl-namespace-id>';
SELECT COUNT(*) FROM curated.curated.fact_sales;`},
{h:'What you get and what to watch'},
{t:[['Benefit','Watch out for'],
['True **isolation**: a runaway ad hoc query cannot slow ETL','More warehouses to manage and monitor'],
['Each team pays for its own compute','Data sharing permissions and who owns schema changes (Section 14)'],
['Different node types, Serverless vs provisioned, Regions or accounts','Consumers see the producer data, so design curated shared schemas, not raw ones'],
['Live data: committed changes are visible to new consumer transactions','Cross-Region sharing has transfer costs'],
['Pause or scale consumers separately','Producer maintenance and resizes briefly affect consumers']]},
{h:'Mixing deployment models'},
{p:'A common design keeps a **provisioned** producer warehouse with reserved nodes for the steady ETL load, and **Serverless** consumers for dashboards and analysts with spiky demand: each gets the model that suits its load.'},
{h:'Choosing: queues, scaling or separate warehouses'},
{t:[['Situation','Choice'],
['Mixed workloads, moderate size, occasional bursts','Automatic WLM with priorities and concurrency scaling'],
['Heavy ETL must never delay dashboards','Separate warehouses with data sharing'],
['Teams need cost transparency','Separate warehouses or workgroups with tags'],
['Highly variable analyst demand','Serverless consumer warehouse']]},
{note:'Start with queues. Move a workload to its own warehouse only when you can show queues are not enough or cost separation matters. More warehouses are easy to create and hard to retire.'}],
src:[['Data sharing in Amazon Redshift',DG+'datashare-overview.html'],['Advisor: isolate multiple active databases',DG+'advisor-recommendations.html']]};

/* ================= ADDITIONAL 10 ================= */
L['rs:8:10']={blocks:[
{p:'Most warehouses serve three kinds of work: loading (ETL), dashboards and ad hoc analysis. Their needs differ, so plan for each.'},
{svg:patt},
{h:'The three workloads'},
{t:[['','ETL and loads','Dashboards and BI','Ad hoc analysis'],
['Pattern','Scheduled, heavy, predictable','Many short, repeated queries','Unpredictable, sometimes huge'],
['What matters','Finish on time','Fast and consistent response','Do not hurt others'],
['Priority','High','Normal','Low'],
['Concurrency scaling','Writes only if bursts collide with reports','On, for peak hours','On or off by budget'],
['Guardrails','Spill and run-time rules with log first','Short timeout rule; SQA','Abort on runaway time, spill and nested loops'],
['Isolation','Own warehouse for large ETL','Own warehouse or queue','Consumer warehouse with data sharing'],
['Table support','Staging tables, MERGE (Section 7)','Materialized views, result cache','Curated schemas only']]},
{h:'A starting configuration (provisioned)'},
{ul:['**Automatic WLM** with three queues: `etl` (high), `bi` (normal), `adhoc` (low), routed by user group or role.','**SQA on** with the dynamic maximum runtime.','**Concurrency scaling** on `bi` and `adhoc`, with `max_concurrency_scaling_clusters` set to a budgeted number.','**Monitoring rules**: log nested loops and heavy spill everywhere; abort `adhoc` queries running over a set time or spilling over a set size.','**Materialized views** for the dashboard queries.']},
{h:'A starting configuration (Serverless)'},
{ul:['One **workgroup per workload** if isolation matters, sharing data from a producer, or one workgroup with **queues** by role.','**Base capacity** sized for the steady load, **maximum capacity** as the cost cap.','**Monitoring rules** in queues: short timeout on dashboards, spill limits on ETL, abort on runaway ad hoc.','A **monthly usage limit** with an alert.']},
{h:'Allocating capacity'},
{flow:['Measure each workload current use','Protect ETL deadlines first','Size the BI share for peak concurrency','Leave the remainder for ad hoc','Review monthly with real queue times']},
{ul:['With automatic WLM you do not divide memory by hand: **priority** expresses the order, and idle capacity is used by whoever needs it.','Set the **ETL window** to avoid the busiest dashboard hours and the **maintenance window**.','Keep **raw data** out of the analyst schemas: expose curated tables and views only.']},
{h:'Review checklist'},
{ul:['Is each workload mapped to a queue, role or workgroup?','Are priorities consistent with business importance?','Do guardrail rules exist, and did they fire?','Is p90 queue time within target for each queue?','Is concurrency scaling spend within budget?','Could a workload move to its own warehouse?']},
{note:'Revisit the design every quarter. New teams, new dashboards and data growth quietly change the mix, and settings that were right a year ago may now be wrong.'}],
src:[['Workload management',DG+'cm-c-implementing-workload-management.html'],['Query priority',DG+'query-priority.html'],['Concurrency scaling',DG+'concurrency-scaling.html'],['Data sharing',DG+'datashare-overview.html']]};
})();
