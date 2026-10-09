/* LearnSphere - Amazon Redshift, Section 04: Capacity, Scaling & Cost Management.
   Lectures 0-6 are core, 7-10 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const resize=R.dg(700,260,[
[10,10,330,240,'Elastic resize',1],[360,10,330,240,'Classic resize',1],
[30,45,290,40,'1. Snapshot, then migrate metadata',0],[30,95,290,40,'2. Brief pause; most queries held',0],
[30,145,290,40,'3. Data redistributed in the background',0],[30,195,290,40,'Typical: about ten minutes',2],
[380,45,290,40,'1. New target cluster is built',0],[380,95,290,40,'2. Data and metadata copied across',0],
[380,145,290,40,'3. Endpoint switches; old cluster dropped',0],[380,195,290,40,'Takes longer; for big changes',2]],
[]);

const scale=R.dg(700,260,[
[10,10,680,240,'Redshift Serverless capacity (RPUs)',1],
[30,170,640,60,'Base capacity: the starting point (default 128 RPUs, minimum 4)',2],
[30,100,640,50,'Scaling headroom: Redshift adds RPUs when the workload needs them',0],
[30,40,640,45,'Maximum capacity: the ceiling you set to cap cost',2]],
[[350,170,350,150],[350,100,350,85]]);

/* ================= LECTURE 0 ================= */
L['rs:3:0']={blocks:[
{p:'A provisioned cluster has a lifecycle: you modify it, reboot it, pause it and eventually delete it. Knowing which action causes downtime keeps you from surprising your users. This lecture applies to Provisioned only.'},
{h:'Cluster states'},
{t:[['Status','Meaning'],
['`available`','Running and ready'],
['`modifying`','Redshift is applying changes'],
['`rebooting`','Being rebooted; connections are dropped'],
['`resizing`','A resize is in progress; only read queries run during some resizes'],
['`paused`','Paused; no on-demand compute billing'],
['`final-snapshot`','Taking a final snapshot before deletion'],
['`storage-full`','No storage left; resize to add nodes or change node size'],
['`hardware-failure`','A node failed; a single-node cluster must be restored from a snapshot'],
['`incompatible-parameters`','A parameter value in the attached group cannot be applied']]},
{h:'Modify'},
{p:'`modify-cluster` changes settings such as the maintenance window, security groups, public accessibility, parameter group, automated snapshot retention, node type and node count. Some changes apply at once, some at the next reboot, and a change to node type or node count starts a **resize** (next lectures).'},
{code:`aws redshift modify-cluster --cluster-identifier lab-cluster \\
  --automated-snapshot-retention-period 7 \\
  --preferred-maintenance-window "sun:03:00-sun:03:30"

aws redshift describe-clusters --cluster-identifier lab-cluster \\
  --query "Clusters[0].[ClusterStatus,ClusterParameterGroups[0].ParameterApplyStatus]" --output text`},
{h:'Reboot'},
{ul:['`aws redshift reboot-cluster --cluster-identifier lab-cluster` restarts the cluster. All connections are dropped and running queries fail, so do it in a quiet window.','Static parameter changes need a reboot to take effect. The status `pending-reboot` on the parameter group tells you one is needed.','If the cluster fails and Redshift restarts it, pending changes are applied then. Changes are not applied by a reboot during maintenance.']},
{h:'Pause and resume'},
{ul:['`pause-cluster` suspends on-demand compute billing. While paused you pay only for storage and backups, and nobody can connect.','`resume-cluster` brings it back with the same endpoint. Resuming takes a few minutes.','You can **schedule** pause and resume with scheduled actions, which is an easy saving for development clusters that sit idle at night and weekends.','Reserved nodes are charged whether the cluster runs or is paused, so pausing saves nothing on reserved capacity.']},
{code:`aws redshift pause-cluster  --cluster-identifier dev-cluster
aws redshift resume-cluster --cluster-identifier dev-cluster`},
{h:'Delete'},
{code:`# Keep a last copy of the data
aws redshift delete-cluster --cluster-identifier lab-cluster \\
  --final-cluster-snapshot-identifier lab-cluster-final

# Throwaway labs only: no copy is kept
aws redshift delete-cluster --cluster-identifier lab-cluster --skip-final-cluster-snapshot`},
{note:'The final snapshot is a manual snapshot that you keep paying for until you delete it. Name it clearly and add a reminder to clean up.'},
{h:'What causes downtime?'},
{t:[['Action','Impact'],
['Reboot','Connections dropped, queries fail, a few minutes'],
['Static parameter change','Needs a reboot to apply'],
['Elastic resize','A short pause while metadata moves; some queries can be dropped'],
['Classic resize','Restart at the start and a switch at the end; long background migration'],
['Pause and resume','Unavailable while paused and for a few minutes on resume'],
['Maintenance patching','Brief unavailability during the maintenance window']]}],
src:[['Amazon Redshift provisioned clusters (cluster status)',MG+'working-with-clusters.html'],['Pausing and resuming a cluster',MG+'rs-mgmt-pause-resume-cluster.html'],['Modifying a cluster',MG+'modify-cluster.html']]};

/* ================= LECTURE 1 ================= */
L['rs:3:1']={blocks:[
{p:'A **parameter group** is a set of database settings that applies to every database in a provisioned cluster, such as the query timeout and date style. Every cluster is attached to exactly one. This lecture applies to Provisioned only; Serverless uses configuration parameters on the workgroup instead.'},
{h:'Default and custom groups'},
{ul:['Redshift provides one **default** group per parameter group family, for example `default.redshift-2.0`. **You cannot modify it.**','To change anything, create a **custom** group in the same family, change its values, and attach it to the cluster.','A new custom group starts with the default values. A changed parameter shows `source = user`; untouched ones show `engine-default`. The console does not display the source; the CLI and API do.','Limits: 20 parameter groups per account per Region; names are lowercase, 1 to 255 letters, digits or hyphens.']},
{h:'Important defaults (family redshift-2.0)'},
{t:[['Parameter','Default','What it does'],
['`require_ssl`','true (since January 10, 2025)','Rejects connections that do not use SSL'],
['`enable_user_activity_logging`','false','Audit log of every query text; needs audit logging turned on (Section 11)'],
['`wlm_json_configuration`','`[{"auto_wlm":true}]`','Workload management; automatic by default (Section 9)'],
['`search_path`','`$user, public`','Schemas searched for unqualified names'],
['`statement_timeout`','0','Maximum query run time in milliseconds; 0 means no limit'],
['`auto_analyze`','true','Automatic statistics maintenance (Section 8)'],
['`auto_mv`','true','Automated materialized views'],
['`max_concurrency_scaling_clusters`','1','How many extra clusters concurrency scaling may add'],
['`enable_case_sensitive_identifier`','false','Identifiers are case-insensitive by default'],
['`datestyle`','ISO, MDY','Date display format'],
['`use_fips_ssl`','false','Turn on only when FIPS-compliant SSL is required']]},
{h:'Dynamic vs static'},
{p:'Some parameter changes take effect immediately. Others, called **static**, take effect only after a reboot. After you change a group attached to a running cluster, check the apply status; `pending-reboot` means a reboot is needed.'},
{h:'Create, change and attach a group'},
{code:`aws redshift create-cluster-parameter-group \\
  --parameter-group-name prod-params \\
  --parameter-group-family redshift-2.0 \\
  --description "Production settings"

aws redshift modify-cluster-parameter-group --parameter-group-name prod-params \\
  --parameters ParameterName=statement_timeout,ParameterValue=3600000

aws redshift modify-cluster --cluster-identifier prod-cluster \\
  --cluster-parameter-group-name prod-params

# See which values you changed (Source = user)
aws redshift describe-cluster-parameters --parameter-group-name prod-params \\
  --query "Parameters[?Source=='user'].[ParameterName,ParameterValue]" --output table

aws redshift reboot-cluster --cluster-identifier prod-cluster   # only if pending-reboot`},
{h:'Session-level overrides'},
{p:'You can change many settings for just your own session with `SET`, which lasts until the session ends. This is the safe way to experiment.'},
{code:`SET statement_timeout TO 60000;          -- 60 seconds, this session only
SET enable_result_cache_for_session TO off;
SHOW search_path;`},
{note:'Keep parameter groups in infrastructure code and review changes. A single wrong value, such as a very short statement_timeout, can break every job on the cluster.'},
{h:'Serverless'},
{p:'On Serverless you set the equivalent options as workgroup configuration parameters. For example, `aws redshift-serverless update-workgroup --workgroup-name lab-wg --config-parameters parameterKey=require_ssl,parameterValue=true` (Redshift restarts the workgroup when you change `require_ssl`).'}],
src:[['Amazon Redshift parameter groups',MG+'working-with-parameter-groups.html'],['Configuring the server',DG+'t_Modifying_the_default_settings.html']]};

/* ================= LECTURE 2 ================= */
L['rs:3:2']={blocks:[
{p:'**Resizing** changes the node type, the number of nodes, or both. Redshift offers two methods. Start with elastic resize and use classic resize only when elastic cannot do what you need. This lecture applies to Provisioned only.'},
{svg:resize},
{h:'Elastic resize'},
{ul:['Adds or removes nodes, or changes the node type. It usually completes in about **ten minutes**, so it is the first choice.','**Same node type (in-place)**: some running queries finish and others can be dropped. Sessions and queries are mostly retained.','**New node type**: a snapshot is taken, a new cluster is built and data is copied in the background (read-only meanwhile). When it finishes the endpoint points to the new cluster and **running queries are dropped**.','It redistributes data across the node slices. It does **not** sort tables or reclaim space, so it is not a substitute for VACUUM.','You cannot cancel an elastic resize.']},
{h:'Elastic resize limits'},
{t:[['Original node type','Growth limit','Reduction limit'],
['rg.12xlarge, rg.4xlarge, ra3.4xlarge, ra3.16xlarge','4x','To one quarter'],
['rg.xlarge, rg.large, ra3.large','2x','To one half'],
['ra3.xlplus','2x','To one quarter']]},
{p:'The limits are based on the original node count (or the count at the last classic resize). If an elastic resize would exceed them, use classic resize. To see what is valid for a particular cluster:'},
{code:`aws redshift describe-node-configuration-options \\
  --cluster-identifier mycluster --action-type resize-cluster

aws redshift resize-cluster --cluster-identifier mycluster \\
  --cluster-type multi-node --node-type ra3.xlplus --number-of-nodes 6`},
{h:'Classic resize'},
{ul:['Creates a target cluster and migrates data and metadata. Use it when the change is outside elastic limits, such as a very large change in node count.','Classic resize **to RG or RA3** is improved: the source restarts briefly, then reads and writes work while data migrates in the background. This needs data under 2 PB, a manual snapshot no more than 10 hours old, and the cluster in a VPC.','Classic resize to other targets keeps the cluster **read-only** and can take days or even weeks for large data.','You can cancel a classic resize before it completes, except to RG or RA3 targets.','It does not keep system table data; elastic resize does.']},
{code:`aws redshift resize-cluster --cluster-identifier mycluster \\
  --cluster-type multi-node --node-type ra3.4xlarge --number-of-nodes 12 --classic`},
{h:'Elastic vs classic at a glance'},
{t:[['Behavior','Elastic','Classic'],
['Speed','About ten minutes','Slower, depends on data size'],
['Queries during resize','Mostly held (same node type); dropped when node type changes','Dropped; reads and writes continue for RG or RA3 targets'],
['System table history','Kept','Not kept'],
['Cancel','No','Yes (not to RG or RA3)'],
['Best for','Everyday scale up or down','Changes beyond elastic limits']]},
{h:'Snapshot, restore and rename'},
{p:'If you need near-constant write access, you can restore a snapshot into a new cluster, resize it, replay loads that happened after the snapshot, then rename the clusters so applications keep the same endpoint. The old cluster becomes `name-source` until you are sure and delete it.'},
{h:'Schedule it'},
{p:'You can schedule resizes to scale up before a busy period and back down afterwards. Use the console or `aws redshift create-scheduled-action`.'},
{note:'Before any resize take a manual snapshot, run it in a quiet period and check that the new configuration has enough storage for your data. A resize from RG or RA3 to a legacy node type such as DC2 is not supported.'}],
src:[['Resizing a cluster',MG+'resizing-cluster.html'],['describe-node-configuration-options','https://docs.aws.amazon.com/cli/latest/reference/redshift/describe-node-configuration-options.html']]};

/* ================= LECTURE 3 ================= */
L['rs:3:3']={blocks:[
{p:'Serverless capacity is measured in **Redshift Processing Units (RPUs)**. One RPU provides 16 GB of memory. You set a **base capacity** and an optional **maximum capacity**, and Redshift scales within those bounds. This lecture applies to Serverless only.'},
{svg:scale},
{h:'Base capacity'},
{ul:['The default is **128 RPUs**. You can set it from 4 to 512 RPUs: 4, then steps of 8 (8, 16, 24 ... 512). In certain Regions the maximum base capacity is 1024, set in steps of 32 above 512.','A larger base gives more compute and memory for heavy queries, large tables with many columns, many joins and big data lake scans.','Scaling steps are 4 RPUs from 4 to 8, 8 RPUs from 8 to 512 and 32 RPUs from 512 to 1024.','**Editing the base capacity can cancel running queries**, so change it in a quiet period.']},
{h:'Small base capacities'},
{t:[['Base capacity','Supports','Notes'],
['4 RPUs','Up to 32 TB managed storage; 64 GB memory','Tables with more than about 100 columns can exhaust memory; available only in certain Regions'],
['8, 16 or 24 RPUs','Up to 128 TB managed storage','Good for small and moderate warehouses and labs'],
['32 RPUs or more','Required above 128 TB; recommended for wide tables and higher concurrency','Needed for large data']]},
{note:'Once Serverless scales above 4 RPUs it does not scale back down to 4. If a 4 RPU warehouse hits its limits, raise the base capacity yourself.'},
{h:'Maximum capacity: your cost ceiling'},
{p:'**Maximum capacity** limits how far Redshift can scale a workgroup. Because you pay per RPU-hour, it is the simplest cost cap. It is always honored, whatever the price-performance target is.'},
{code:`# Set base and maximum capacity on an existing workgroup
aws redshift-serverless update-workgroup --workgroup-name lab-wg \\
  --base-capacity 32 --max-capacity 256

aws redshift-serverless get-workgroup --workgroup-name lab-wg \\
  --query "workgroup.[baseCapacity,maxCapacity]" --output text`},
{h:'Choosing a starting point'},
{flow:['Start at the default or a bit lower','Run a representative workload for a few days','Watch RPU use and query times','Raise base for steady heavy work','Set max capacity to cap spend']},
{h:'Account-level quota'},
{p:'The total base RPUs across your account is limited to the greater of 3,200 RPUs or 1.5 times your maximum aggregate base RPUs over the previous six months. Request an increase through Service Quotas if you need more.'},
{h:'Watching usage'},
{code:`-- RPUs used over time (compute_capacity) for the workgroup
SELECT * FROM sys_serverless_usage ORDER BY end_time DESC LIMIT 20;`},
{p:'The CloudWatch metric `ComputeCapacity` (namespace `AWS/Redshift-Serverless`, dimension Workgroup) and the console RPU graph show the same information.'},
{note:'VACUUM boost is supported only at 8 RPUs and above. For 8 RPUs and less use a regular VACUUM command.'}],
src:[['Compute capacity for Redshift Serverless',MG+'serverless-capacity.html'],['Quotas for Serverless',MG+'amazon-redshift-limits.html'],['SYS_SERVERLESS_USAGE',DG+'SYS_SERVERLESS_USAGE.html']]};

/* ================= LECTURE 4 ================= */
L['rs:3:4']={blocks:[
{p:'Two controls keep Serverless performance and spend in balance: the **price-performance target**, which tells Redshift how aggressively to scale, and **usage limits**, which cap consumption. This lecture applies to Serverless only.'},
{h:'AI-driven scaling and optimization'},
{p:'Instead of making you guess a base capacity, Serverless can scale RPUs automatically with query complexity and data growth, aiming at a **price-performance target** you choose. It learns from your workload over time, so improvement is gradual.'},
{h:'The price-performance target'},
{t:[['Setting','Behavior'],
['**Optimizes for cost**','Scales up only when that is likely to lower cost; may scale down and lengthen runtimes'],
['**Balanced** (default)','Balances cost and performance; recommended for most warehouses'],
['**Optimizes for performance**','Scales aggressively for speed, possibly at higher cost'],
['Two intermediate positions','Between Balanced and each extreme']]},
{ul:['It is **on by default** for new workgroups and set to **Balanced**. You configure it in the console under the workgroup **Performance** tab.','It is a **per-workgroup** setting.','Changing it does not take effect at once. Monitor the workgroup for **one to three days** to see the effect.','It works best for base capacities from **8 to 512 RPUs**; AWS does not recommend it below or above that range.','**Maximum capacity** and **Max RPU-hours** are always enforced, whatever the target.']},
{h:'Usage limits'},
{p:'A usage limit watches consumption and takes an action when it is crossed.'},
{t:[['Property','Values'],
['Usage type','`serverless-compute` (RPU-hours) or `cross-region-datasharing`'],
['Amount','For compute, RPU-hours'],
['Period','`daily`, `weekly` (begins Sunday) or `monthly` (default)'],
['Breach action','`log` (default), `emit-metric`, or `deactivate`']]},
{code:`# Alert (CloudWatch metric) when a workgroup passes 500 RPU-hours in a month
aws redshift-serverless create-usage-limit \\
  --resource-arn arn:aws:redshift-serverless:us-east-1:123456789012:workgroup/<id> \\
  --usage-type serverless-compute --amount 500 \\
  --period monthly --breach-action emit-metric

aws redshift-serverless list-usage-limits`},
{ul:['Start with `log` or `emit-metric` and an alarm so you learn your real usage.','`deactivate` disables query processing for the workgroup when the limit is reached. Use it deliberately, for example on a sandbox, and read the current documentation for its exact behavior before using it on anything business critical.']},
{h:'Check what scaling did'},
{code:`SELECT query_id, start_time, elapsed_time/1000000.0 AS seconds
FROM sys_query_history
WHERE query_text LIKE '%my_report%' AND query_text NOT LIKE '%sys_query_history%'
ORDER BY start_time DESC LIMIT 5;

-- Then look at the RPUs scaled to during that period
SELECT * FROM sys_serverless_usage
WHERE end_time >= '<start_time>' AND end_time <= DATEADD(minute, 1, '<end_time>')
ORDER BY end_time;`}],
src:[['Compute capacity for Serverless (AI-driven scaling)',MG+'serverless-capacity.html'],['create-usage-limit','https://docs.aws.amazon.com/cli/latest/reference/redshift-serverless/create-usage-limit.html'],['SYS_SERVERLESS_USAGE',DG+'SYS_SERVERLESS_USAGE.html']]};

/* ================= LECTURE 5 ================= */
L['rs:3:5']={blocks:[
{p:'AWS regularly patches Redshift. On provisioned clusters you control **when** patching happens with a **maintenance window**, and you can **defer** maintenance for a limited time.'},
{h:'The maintenance window'},
{ul:['It is a weekly time slot, expressed in UTC, during which Redshift may apply patches and other maintenance. A window of about 30 minutes is typical.','Choose a quiet time for your users and for your ETL schedule, and avoid overlap with your heaviest loads.','Set it with `--preferred-maintenance-window`, using the form `ddd:hh24:mi-ddd:hh24:mi`.']},
{code:`aws redshift modify-cluster --cluster-identifier prod-cluster \\
  --preferred-maintenance-window "sun:03:00-sun:03:30"

aws redshift describe-clusters --cluster-identifier prod-cluster \\
  --query "Clusters[0].[PreferredMaintenanceWindow,ClusterVersion,MaintenanceTrackName]" --output text`},
{h:'Deferring maintenance'},
{ul:['You can **defer** a cluster maintenance window by up to **60 days**.','Hardware updates and mandatory security updates are **still applied** even if you defer.','You cannot defer maintenance after it has started.','The maintenance window that follows a deferral **cannot itself be deferred**.']},
{code:`aws redshift modify-cluster-maintenance --cluster-identifier prod-cluster \\
  --defer-maintenance --defer-maintenance-duration 30

# Cancel the deferral
aws redshift modify-cluster-maintenance --cluster-identifier prod-cluster \\
  --no-defer-maintenance`},
{h:'Current and trailing tracks'},
{p:'The **maintenance track** (Section 2) decides which release a cluster receives. Pair it with the window: put test clusters on the **current** track so releases hit them first, and production on the **trailing** track.'},
{h:'What users notice'},
{ul:['A brief interruption while the cluster is patched, usually a reboot, so connections drop and running queries can fail.','Design clients to retry on connection errors and keep long jobs restartable.']},
{h:'Serverless'},
{p:'Serverless has no nodes to patch and AWS applies releases to workgroups itself. Check the Serverless documentation for any maintenance window option available in your Region, and rely on retry logic in clients regardless.'},
{note:'Add the maintenance window to your team calendar and to your ETL scheduler so loads are not running when a patch lands.'}],
src:[['Managing cluster maintenance',MG+'managing-cluster-considerations.html'],['ModifyClusterMaintenance API','https://docs.aws.amazon.com/redshift/latest/APIReference/API_ModifyClusterMaintenance.html'],['Cluster version history',MG+'cluster-versions.html']]};

/* ================= LECTURE 6 ================= */
L['rs:3:6']={blocks:[
{p:'Redshift cost has a few separate parts. Know what you are paying for and which of them you control. Prices change and differ by Region, so always check the official pricing page; the numbers below are examples only.'},
{h:'The components'},
{t:[['Component','How it is billed','Notes'],
['**Provisioned on-demand**','Per hour for each node type and node count; no commitment','Partial hours billed in one-second increments after a status change such as create, pause or resume. Paused clusters pay only for backup storage'],
['**Provisioned reserved nodes**','One or three year term; No, Partial or All Upfront','Discounted; charged whether the cluster is running or paused. Best for steady workloads'],
['**Serverless**','Per RPU-hour, billed per second with a **60-second minimum**','No charge for startup time or while idle. Concurrency scaling and Spectrum are included in the RPU charge'],
['**Serverless Reservations**','Commit to RPU hours for one or three years','Purchased at the payer account level and shareable across linked accounts; usage above the reservation is billed on demand'],
['**Managed storage**','Per GB-month, for RA3, RG and Serverless','Same price whether data is on SSD or S3; billed separately from compute'],
['**Concurrency scaling** (provisioned)','Per second after free credits','Each cluster earns up to one free hour of credits per day, accumulating up to 30 hours'],
['**Spectrum** (provisioned RA3)','Per TB scanned in S3, 10 MB minimum per query','Not billed separately for Serverless or RG'],
['**Backups**','Automated snapshots are free for the retention period within limits; manual snapshots are billed','Delete manual snapshots you no longer need'],
['**Data transfer**','Same-Region traffic to S3 is free; cross-Region data sharing and snapshot copy are billed','']]},
{h:'Worked examples (illustrative only)'},
{p:'These use the US East (N. Virginia) rates shown on the AWS pricing page when this lesson was written: $0.375 per RPU-hour for Serverless and $0.024 per GB-month for managed storage. Always check current prices.'},
{code:`Serverless compute:  32 RPUs x 2 hours x $0.375  = $24.00
Managed storage:     10 TB = 10,240 GB x $0.024  = $245.76 per month
Provisioned (any):   nodes x hourly rate x hours = steady, predictable
                     (about 730 hours in a month if it runs all the time)`},
{h:'Where the money goes and what you control'},
{ul:['**Idle compute** is the biggest waste: pause provisioned dev clusters, or use Serverless so idle time is free.','**Oversizing**: more nodes or a bigger base RPU than the workload needs.','**Storage growth**: old tables, temporary tables left behind, and snapshots.','**Reserved capacity** saves most when usage is steady and predictable.','**Scanning too much data**: good table design (Section 6) lowers compute because queries finish faster.']},
{note:'For Serverless the maximum capacity and usage limits are your seat belts. For Provisioned they are pause schedules, right-sizing and reserved nodes.'}],
src:[['Amazon Redshift pricing','https://aws.amazon.com/redshift/pricing/'],['Billing for Redshift Serverless',MG+'serverless-billing.html'],['Reserved nodes',MG+'purchase-reserved-node-instance.html']]};

/* ================= ADDITIONAL 7 ================= */
L['rs:3:7']={blocks:[
{p:'Moving from DC2 to a current node family (RA3 or RG) is one of the most common provisioned-cluster projects. This playbook gives a safe order of work. AWS has announced DC2 deprecation and recommends RA3, RG or Serverless, and creating or resizing DC2 clusters may already be blocked in your account, so plan the move now.'},
{h:'Why move'},
{ul:['RA3 and RG separate compute from storage, so you stop adding nodes just to hold data.','Newer features, such as concurrency scaling on all tables and current instance types, need the newer families. RG adds Graviton instances and an integrated data lake engine.','DC2 is on its way out; waiting only shrinks your options.']},
{h:'Choose the method'},
{t:[['Method','Use when','Notes'],
['**Elastic resize** to the new node type','Supported configuration, short downtime acceptable','Fast, endpoint stays the same, queries are dropped at the end'],
['**Snapshot, restore and rename**','Elastic does not support your node and slice combination, or you want to test first','Restore into a new cluster, validate, then swap names so the endpoint is unchanged'],
['**Classic resize**','Elastic limits do not allow it','Slower; improved when the target is RG or RA3'],
['**Move to Serverless**','Spiky load, you want to stop managing capacity','Restore the snapshot into a namespace']]},
{h:'Sizing the target'},
{p:'Do not map node counts one to one. The console resize page and `describe-node-configuration-options` recommend valid targets, and AWS publishes a sizing recommendation table. As an example from a published migration, four dc2.8xlarge nodes were recommended to move to ra3.4xlarge. Size RA3 and RG for the data you process each day, not total stored data.'},
{code:`# Which target configurations are valid for this cluster?
aws redshift describe-node-configuration-options \\
  --cluster-identifier dc2-prod --action-type resize-cluster`},
{h:'Step by step'},
{flow:['Inventory tables, sizes, workloads','Test the target with a real workload','Take a manual snapshot','Resize or restore','Validate data and queries','Cut over, keep the old one briefly','Delete the old cluster']},
{ul:['**Inventory**: table sizes and design from `SVV_TABLE_INFO`, peak query load, and who connects.','**Test**: replay a representative workload on a restored copy before changing production. AWS provides the Redshift Test Drive tool for this.','**Interleaved sort keys**: resizing from dc2.large to ra3.large converts them to compound keys automatically so concurrency scaling can work. Check query times afterwards.','**Reserved nodes**: you can convert DC2 reserved nodes to RA3 or RG reserved nodes when you use the console for an elastic resize or a snapshot restore.','**Cut over**: with snapshot and restore, rename the old cluster to `name-source` and the new one to the original name so applications keep the same endpoint and your CloudWatch alarms continue to apply.','**Roll back plan**: keep the source until the new cluster has run a full business cycle.']},
{note:'You cannot resize from RA3 or RG back to a legacy node type. Treat the move as one-way.'}],
src:[['Resizing a cluster',MG+'resizing-cluster.html'],['Upgrading to RA3 node types',MG+'managing-cluster-considerations.html'],['Migrate Redshift from DC2 to RA3 (AWS blog)','https://aws.amazon.com/blogs/big-data/migrate-amazon-redshift-from-dc2-to-ra3-to-accommodate-increasing-data-volumes-and-analytics-demands']]};

/* ================= ADDITIONAL 8 ================= */
L['rs:3:8']={blocks:[
{p:'Choosing between Provisioned and Serverless is mostly a question of how steady your workload is. This lecture gives a decision framework and a break-even calculation.'},
{h:'Decision framework'},
{t:[['Question','Leans Provisioned','Leans Serverless'],
['How busy is it?','Busy most of the day, every day','Intermittent, spiky or unknown'],
['How predictable?','Stable and well understood','Growing, seasonal or experimental'],
['Do you need fine control?','Custom WLM queues, parameter groups, node choice','Prefer AWS to manage scaling'],
['Commitment','Comfortable with reserved nodes for savings','Prefer pay-per-use, or Serverless Reservations'],
['Admin effort','Have people to size and tune','Small team'],
['Idle time','Can pause on a schedule','Long idle periods you want free']]},
{h:'The break-even idea'},
{p:'Serverless costs `RPUs x hours used x rate`. Provisioned costs a fixed monthly amount if it runs all the time. They are equal at the number of hours where the Serverless bill catches up to the provisioned bill.'},
{code:`break-even hours per month  =  provisioned monthly cost / (average RPUs x rate per RPU-hour)

Assumed example (use your own numbers):
  provisioned monthly cost (24/7)   = $5,000   (assumption)
  average RPUs while queries run    = 64
  rate per RPU-hour                 = $0.375   (example Region rate)

  5,000 / (64 x 0.375) = about 208 hours per month, roughly 7 hours per day

Below about 7 busy hours a day Serverless is cheaper in this example;
above that, Provisioned (especially with reserved nodes) is cheaper.`},
{h:'Things that move the break-even'},
{ul:['**Pausing** a provisioned cluster on a schedule lowers its effective cost.','**Reserved nodes** and **Serverless Reservations** both lower the rate and move the point.','**Concurrency**: many users at once raise Serverless RPU use, while a provisioned cluster is a fixed size.','**Data size**: managed storage cost is the same for both, so ignore it in the comparison.','**Operations time**: Serverless saves tuning effort, which has a real cost.']},
{h:'A practical way to decide'},
{flow:['Measure real usage','Estimate RPUs and busy hours','Apply the formula with real prices','Pilot on Serverless for a month','Reserve or switch once usage is steady']},
{ul:['On a provisioned cluster, look at CPU and queue metrics to see how many nodes you really use.','On Serverless, use `SYS_SERVERLESS_USAGE` and the cost report to see actual RPU-hours.','You can restore a snapshot between the two models, so the choice is reversible.']},
{note:'Mixed designs are common: a provisioned warehouse with reserved nodes for the steady ETL load, sharing data with Serverless warehouses for spiky analysts and dashboards (Section 2, multi-warehouse patterns).'}],
src:[['Amazon Redshift pricing','https://aws.amazon.com/redshift/pricing/'],['Billing for Redshift Serverless',MG+'serverless-billing.html'],['SYS_SERVERLESS_USAGE',DG+'SYS_SERVERLESS_USAGE.html']]};

/* ================= ADDITIONAL 9 ================= */
L['rs:3:9']={blocks:[
{p:'Every AWS service has quotas. Knowing the ones that affect Redshift design lets you avoid hitting a hard wall in production. Values here are the defaults at the time of writing; confirm current values in the Management Guide.'},
{h:'Account and cluster quotas (per Region)'},
{t:[['Quota','Default','Adjustable'],
['Nodes across all clusters','200','Yes'],
['RA3, RG or DC2 nodes in one cluster','128','Yes'],
['Reserved nodes','200','Yes'],
['Parameter groups','20','No'],
['Subnet groups / subnets per group','50 / 20','Yes'],
['Security groups','20','Yes'],
['Manual snapshots','700','Yes'],
['IAM roles per cluster','50','No'],
['Concurrency scaling clusters','10','Yes'],
['Event subscriptions','20','Yes'],
['Redshift-managed VPC endpoints per cluster','30','Yes']]},
{h:'Database design limits'},
{t:[['Limit','Provisioned','Serverless'],
['Databases','60 per cluster (excluding datashare databases)','100 per namespace'],
['Schemas per database','9,900','9,900'],
['Tables','By node type: 9,900 for ra3.large and single-node types; 20,000 for rg.xlarge and multi-node rg.large and ra3.xlplus; 200,000 for 4xlarge, 12xlarge and 16xlarge','200,000 per namespace'],
['Stored procedures per database','10,000','10,000'],
['Roles','1,000 per cluster (adjustable)','1,000 per workgroup (adjustable)'],
['Row size when loading with COPY','64 MB','64 MB']]},
{p:'The table limit counts permanent, temporary and datashare tables and materialized views. External tables count as temporary tables, and Redshift also creates temporary tables during query processing. Views and system tables are not counted.'},
{h:'Connection and time limits'},
{t:[['Limit','Provisioned','Serverless'],
['Maximum connections','2,000 (RA3 and RG)','2,000'],
['Idle session timeout','4 hours','1 hour'],
['Idle transaction timeout','6 hours','6 hours'],
['Longest running query','Set by statement_timeout','24 hours']]},
{h:'Serverless specific'},
{ul:['Namespaces and workgroups: 25 each by default (adjustable).','Managed storage caps by base capacity: 32 TB at 4 RPUs, 128 TB at 8 to 24 RPUs.','Total base RPUs per account: the greater of 3,200 or 1.5 times your maximum aggregate base RPUs of the past six months.']},
{h:'Naming rules that trip people up'},
{ul:['Cluster identifier: lowercase, 1 to 63 letters, digits and hyphens, starts with a letter, no trailing or double hyphens.','Database name (at creation): 1 to 64 lowercase letters and digits; not a reserved word.','Admin user: lowercase, 1 to 128 characters, starts with a letter, not a reserved word.','Parameter group, subnet group and snapshot names: lowercase letters, digits and hyphens.']},
{h:'Requesting an increase'},
{code:`# List Redshift quotas and their values
aws service-quotas list-service-quotas --service-code redshift
aws service-quotas list-service-quotas --service-code redshift-serverless

# Ask for more of an adjustable quota
aws service-quotas request-service-quota-increase \\
  --service-code redshift --quota-code <code> --desired-value <value>`},
{note:'Quotas marked No are hard limits. If you are close to one, such as tables per node type or 2,000 connections, the fix is design: larger node types, fewer tables, pooling or splitting workloads across warehouses.'}],
src:[['Quotas and limits in Amazon Redshift',MG+'amazon-redshift-limits.html'],['Service Quotas','https://docs.aws.amazon.com/servicequotas/latest/userguide/intro.html']]};

/* ================= ADDITIONAL 10 ================= */
L['rs:3:10']={blocks:[
{p:'Cost governance is the routine that keeps a warehouse affordable as it grows: tag everything, set budgets and alerts, cap usage, and audit regularly for idle or oversized resources.'},
{h:'1. Tag everything'},
{ul:['Tag clusters, workgroups, namespaces and snapshots with keys such as `project`, `team`, `environment` and `owner`.','**Activate cost allocation tags** in the Billing console so they appear in cost reports.','Enforce tagging in your infrastructure code.']},
{h:'2. Budgets and alerts'},
{ul:['Create AWS Budgets scoped by tag, such as one per team or environment, with email alerts at 50, 80 and 100 percent.','Add a forecast alert so you hear about overspend before month end.','For Serverless add a **usage limit** with `emit-metric` and a CloudWatch alarm.']},
{h:'3. Caps'},
{t:[['Model','Cap'],
['Serverless','Maximum capacity, usage limits (daily, weekly or monthly), small base capacity for non-production'],
['Provisioned','Right-sized node count, scheduled pause and resume, reserved nodes for steady loads, a limit on concurrency scaling clusters']]},
{h:'4. Audit routine (weekly or monthly)'},
{ul:['**Idle provisioned clusters**: find them and pause or delete them.','**Oversized warehouses**: low CPU and little queueing for weeks means you can shrink.','**Serverless base capacity** higher than the usage you see.','**Old snapshots** and final snapshots nobody needs.','**Forgotten lab resources**: anything tagged `lab` older than a few days.']},
{code:`# Provisioned clusters with their size and tags
aws redshift describe-clusters \\
  --query "Clusters[].[ClusterIdentifier,NodeType,NumberOfNodes,ClusterStatus,Tags[?Key=='owner']|[0].Value]" \\
  --output table

# Average connections over the last 7 days (near zero = idle)
aws cloudwatch get-metric-statistics --namespace AWS/Redshift \\
  --metric-name DatabaseConnections \\
  --dimensions Name=ClusterIdentifier,Value=lab-cluster \\
  --start-time $(date -u -d "7 days ago" +%FT%TZ) --end-time $(date -u +%FT%TZ) \\
  --period 86400 --statistics Average

# Manual snapshots, oldest first
aws redshift describe-cluster-snapshots --snapshot-type manual \\
  --query "sort_by(Snapshots,&SnapshotCreateTime)[].[SnapshotIdentifier,SnapshotCreateTime,TotalBackupSizeInMegaBytes]" \\
  --output table`},
{code:`-- Serverless: RPU use by day
SELECT DATE_TRUNC('day', end_time) AS day,
       SUM(charged_seconds)/3600.0 AS charged_hours,
       AVG(compute_capacity)        AS avg_rpus
FROM sys_serverless_usage
GROUP BY 1 ORDER BY 1 DESC LIMIT 14;`},
{h:'5. Review and act'},
{flow:['Run the audit','Rank by cost','Pause, shrink or delete','Record the decision','Repeat on a schedule']},
{note:'Make one person the owner of the warehouse bill. Cost problems nobody owns do not get fixed.'}],
src:[['AWS Budgets','https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html'],['Monitoring Serverless usage',MG+'serverless-monitoring.html'],['Amazon Redshift pricing','https://aws.amazon.com/redshift/pricing/']]};
})();
