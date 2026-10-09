/* LearnSphere - Amazon Redshift, Section 02: Architecture & Deployment Options.
   Lectures 0-5 are core, 6-8 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const cluster=R.dg(700,290,[
[10,110,110,50,'Client|JDBC / ODBC / psql',0],
[165,95,150,80,'Leader node|parse, optimize,|compile, coordinate',2],
[360,10,330,270,'Compute nodes (private, isolated network)',1],
[375,40,145,100,'Compute node 1',1],[385,62,60,30,'Slice 1',0],[450,62,60,30,'Slice 2',0],[385,100,60,30,'Slice 3',0],[450,100,60,30,'Slice 4',0],
[530,40,145,100,'Compute node 2',1],[540,62,60,30,'Slice 5',0],[605,62,60,30,'Slice 6',0],[540,100,60,30,'Slice 7',0],[605,100,60,30,'Slice 8',0],
[375,165,300,45,'Each slice: its own share of CPU, memory and data',0],
[375,225,300,40,'Results flow back to the leader node for final merge',0]],
[[120,135,165,135],[315,120,360,120],[315,150,360,150]]);

const blocks=R.dg(700,230,[
[10,10,680,210,'Column: order_date, table sorted by order_date. Query: WHERE order_date BETWEEN 2024-03-01 AND 2024-03-31',1],
[25,45,100,70,'Block 1|min 2022-01|max 2022-07',0],[135,45,100,70,'Block 2|min 2022-07|max 2023-01',0],[245,45,100,70,'Block 3|min 2023-01|max 2023-08',0],
[355,45,100,70,'Block 4|min 2023-08|max 2024-02',0],[465,45,100,70,'Block 5|min 2024-02|max 2024-04',2],[575,45,100,70,'Block 6|min 2024-04|max 2024-12',0],
[25,135,430,40,'Zone maps rule out these blocks: they are never read from disk',0],[465,135,210,40,'Only this block can match: read it',2],
[25,182,650,30,'Each block is 1 MB and stores values of one column; its min and max values are kept as metadata',0]],
[]);

const rms=R.dg(700,260,[
[10,10,330,240,'Compute (billed per node or RPU)',1],
[30,45,290,50,'Compute nodes / Serverless workgroup|run queries on slices',2],
[30,110,290,50,'Local SSD cache|hot, recently used data blocks',0],
[30,175,290,50,'Memory|intermediate results',0],
[380,10,310,240,'Redshift managed storage (billed per GB-month)',1],
[400,45,270,70,'Amazon S3|durable copy of all data blocks',2],
[400,135,270,90,'Automatic tiering|block temperature, age and|workload patterns decide what stays local',0]],
[[320,135,400,95],[400,185,320,150]]);

const sl=R.dg(700,270,[
[10,10,330,250,'Provisioned',1],[360,10,330,250,'Serverless',1],
[30,45,290,60,'Cluster|leader + compute nodes|one endpoint, one set of settings',2],
[30,125,290,40,'Node type + node count = capacity',0],
[30,175,290,40,'Parameter group, WLM, maintenance window',0],
[30,225,290,25,'You resize it',0],
[380,45,140,60,'Namespace|data side: databases,|users, KMS key, snapshots',2],[540,45,135,60,'Workgroup|compute side: RPUs,|VPC, security groups',2],
[380,125,295,40,'Base capacity in RPUs; scales around it',0],
[380,175,295,40,'One namespace is paired with one workgroup',0],
[380,225,295,25,'AWS scales it for you',0]],
[[520,75,540,75]]);

const multi=R.dg(700,290,[
[10,100,200,90,'ETL warehouse (producer)|loads and transforms data,|owns the tables',2],
[260,10,200,70,'BI warehouse (consumer)|dashboards, steady load',0],
[260,110,200,70,'Ad hoc warehouse (consumer)|analysts, spiky load',0],
[260,210,200,70,'Data science warehouse|(consumer) heavy scans',0],
[510,100,180,90,'Same live data,|no copies,|separate compute per team',0]],
[[210,125,260,50],[210,145,260,145],[210,165,260,240]]);

/* ================= LECTURE 0 ================= */
L['rs:1:0']={blocks:[
{p:'A Redshift warehouse is a group of computers working as one database. Understanding its three layers (leader node, compute nodes and slices) explains almost every performance decision you will make later.'},
{svg:cluster},
{h:'The leader node'},
{ul:['It is the only part your client talks to. Applications, BI tools and `psql` connect to the leader endpoint and never to a compute node.','It parses the SQL, builds an execution plan, compiles code for each step and sends it to the compute nodes.','It collects the intermediate results, does the final merge, sorting or aggregation, and returns the result.','Queries that do not touch user tables run only on the leader node. A few SQL functions are leader-node only and return an error if a query that uses them also reads tables stored on the compute nodes.']},
{h:'Compute nodes'},
{ul:['Each compute node has its own dedicated CPU and memory, set by the node type. They run the compiled code and exchange data with each other when a query needs it.','They sit on a separate, isolated network that clients never reach directly.','You add compute by increasing the node count, changing the node type, or both.']},
{h:'Slices: the unit of parallel work'},
{p:'Each compute node is divided into **slices**. A slice is given a share of the node memory and storage and works on its portion of the data. All slices run the same compiled code on different rows at the same time. The slice is why **table design** matters: if rows are spread evenly across slices, the work is shared evenly; if one slice holds far more rows than the others, the whole query waits for it.'},
{t:[['Term','What it is','Why you care'],
['Cluster','Leader node plus compute nodes','The unit you create, size and pay for (Provisioned)'],
['Node','One computer; type sets CPU, RAM and storage','Add or change nodes to scale'],
['Slice','A share of a node memory, CPU and data','Rows are distributed across slices by the table distribution style'],
['Distribution key','Optional column that decides which slice gets each row','Covered in Section 6']]},
{note:'A single-node cluster shares one node between leader and compute work and is not recommended for production. With two or more nodes the leader is separate and you pay only for the compute nodes.'},
{h:'Serverless uses the same architecture'},
{p:'Redshift Serverless hides the nodes: you set capacity in RPUs and AWS manages the leader, compute and slices behind the scenes. The query engine, SQL and storage model are the same, so everything you learn here still applies.'}],
src:[['Data warehouse system architecture',DG+'c_high_level_system_architecture.html'],['Amazon Redshift provisioned clusters',MG+'working-with-clusters.html']]};

/* ================= LECTURE 1 ================= */
L['rs:1:1']={blocks:[
{p:'Redshift stores each column of a table separately and compresses it. It also keeps a tiny summary of every block so that a query can skip blocks it does not need. Together these replace the indexes you may know from PostgreSQL.'},
{h:'Columns, blocks and compression'},
{ul:['Each data block holds values of **one column** for many rows, so reading one column does not read the others.','The block size is **1 MB**, much larger than the 2 KB to 32 KB common in other databases, so fewer I/O requests are needed.','Because a block holds one data type, Redshift can apply an encoding chosen for that column, reducing storage and I/O (Section 6).','With 100 columns, a query that uses five reads roughly five percent of the table. A row store would read the other 95 columns too.']},
{h:'Zone maps: skipping blocks'},
{p:'For every 1 MB block Redshift stores the **minimum and maximum** value as metadata. These summaries are called **zone maps**. When a query has a range filter, the engine compares the filter to each block min and max and skips every block that cannot contain matching rows.'},
{svg:blocks},
{p:'AWS gives the example of a table holding five years of data sorted by date: a query for one month can remove up to 98 percent of the disk blocks from the scan. If the data is not sorted, matching values are spread across all blocks and few or none can be skipped.'},
{h:'Why sort keys replace indexes'},
{p:'Zone maps only work well when similar values sit together in the same blocks. That is exactly what a **sort key** does: it stores the rows on disk in sorted order. So in Redshift you do not create an index on a column; you choose a sort key so the data is physically ordered for the filters you use most.'},
{t:[['PostgreSQL','Redshift'],
['Create a B-tree index on `order_date`','Make `order_date` the sort key'],
['Index points to the rows','Block min and max skip whole blocks'],
['Indexes cost write time and space','Sort order is part of how data is stored; keep it healthy with VACUUM (Section 8)']]},
{code:`-- SORTKEY AUTO lets Redshift choose and adjust the sort key from your queries
CREATE TABLE fact_sales (
  sale_id    BIGINT,
  order_date DATE,
  customer_id INT,
  amount     DECIMAL(12,2)
)
SORTKEY AUTO;`},
{note:'You will choose sort keys properly in Section 6. For now remember the idea: filter on the column the table is sorted by, and most of the data is never read.'}],
src:[['Columnar storage',DG+'c_columnar_storage_disk_mem_mgmnt.html'],['Sort keys',DG+'t_Sorting_data.html']]};

/* ================= LECTURE 2 ================= */
L['rs:1:2']={blocks:[
{p:'**Redshift managed storage (RMS)** separates where data lives from where queries run. It is used by RA3 and RG nodes and by Serverless.'},
{svg:rms},
{h:'How it works'},
{ul:['The durable copy of your data is kept in **Amazon S3**, managed by Redshift. You never see these S3 objects or create the bucket.','Each node uses large, fast **local SSD** as a tier-1 cache for the data it uses most.','Redshift decides what stays on SSD using data block temperature, block age and workload patterns. If data outgrows local SSD, it moves to S3 automatically without any action from you.']},
{h:'What this changes for you'},
{t:[['Topic','Older local-storage nodes','Managed storage (RA3, RG, Serverless)'],
['Scaling','Storage grows only by adding compute nodes','Compute and storage scale independently'],
['Billing','Storage included in the node price','Compute billed per node or RPU, storage billed per GB-month'],
['Storage price','Not applicable','Same rate whether the data sits on SSD or S3'],
['Capacity planning','Choose nodes to fit the data','Choose nodes for performance; storage grows as needed'],
['Durability','Copies on other nodes plus backups','Data lives in S3']]},
{p:'Because storage is billed separately, you size a cluster for the amount of data your queries process each day, not for the total data you keep. Cold history can grow into the petabytes without adding compute.'},
{h:'Limits to know'},
{ul:['Each RA3 or RG node type has a **managed storage limit per node**. For example, a multi-node `ra3.xlplus` supports up to 32 TB per node and `ra3.4xlarge` up to 128 TB per node. This is a hard limit that also caps the total storage of a cluster.','In Serverless, the smallest base capacities cap managed storage: a 4 RPU base supports up to 32 TB, 8 or 16 RPU up to 128 TB, and more than 128 TB needs a base of at least 32 RPU.']},
{note:'Paused provisioned clusters stop on-demand compute billing but you still pay for managed storage and snapshots, because the data is still stored.'}],
src:[['Data warehouse system architecture',DG+'c_high_level_system_architecture.html'],['Amazon Redshift provisioned clusters',MG+'working-with-clusters.html'],['Compute capacity for Serverless',MG+'serverless-capacity.html']]};

/* ================= LECTURE 3 ================= */
L['rs:1:3']={blocks:[
{p:'You can run Redshift in two deployment models. They share the same SQL engine and managed storage, but you create, size, tune and pay for them differently.'},
{svg:sl},
{h:'Side by side'},
{t:[['','Provisioned','Serverless'],
['You create','A cluster','A namespace and a workgroup'],
['Capacity unit','Node type and node count','Redshift Processing Units (RPUs); 1 RPU = 16 GB of memory'],
['Sizing','You choose and resize','Base capacity (default 128 RPUs), AWS scales around it; optional maximum capacity'],
['Billing','Per node-hour while the cluster runs','Per RPU-hour used; no compute charge while idle'],
['Pause','You pause and resume manually','Idle capacity is not billed'],
['Tuning knobs','Parameter groups, WLM queues, maintenance window, node type','Fewer: base and maximum capacity, price-performance target, usage limits'],
['Maintenance','You choose a window and maintenance track','Managed by AWS'],
['Typical fit','Steady, predictable, heavy workloads','Spiky, unpredictable, intermittent or new workloads']]},
{h:'Namespace and workgroup'},
{p:'Serverless splits the warehouse in two:'},
{ul:['A **namespace** is the storage side: schemas, tables, users, the admin user and password, the KMS encryption key, datashares and recovery points.','A **workgroup** is the compute side: RPU capacity, VPC subnet groups and security groups, and network and access settings.','Each namespace is associated with exactly one workgroup and each workgroup with exactly one namespace.']},
{code:`# Provisioned: look at your clusters
aws redshift describe-clusters --query "Clusters[].[ClusterIdentifier,NodeType,NumberOfNodes,ClusterStatus]" --output table

# Serverless: look at your workgroups and namespaces
aws redshift-serverless list-workgroups
aws redshift-serverless list-namespaces`},
{h:'Administration that disappears in Serverless'},
{ul:['Choosing node types and node counts and resizing.','Editing parameter groups and manual WLM queues.','Scheduling most maintenance.']},
{p:'You still own table design, loading, access control, security, monitoring and cost. Serverless removes infrastructure choices, not responsibility.'},
{h:'How to choose'},
{flow:['Is the workload steady all day?','Yes: Provisioned with reserved nodes can cost less','Spiky or unknown?','Yes: Serverless','Need fine control of queues?','Yes: Provisioned']},
{note:'You are not locked in: a snapshot taken from a provisioned cluster can be restored into a Serverless namespace and the reverse. Section 4 adds a cost model for comparing them.'}],
src:[['Workgroups and namespaces',MG+'serverless-workgroup-namespace.html'],['Compute capacity for Serverless',MG+'serverless-capacity.html'],['What is Amazon Redshift?',MG+'welcome.html']]};

/* ================= LECTURE 4 ================= */
L['rs:1:4']={blocks:[
{p:'A provisioned cluster is built from nodes of one **node type**. The node type sets each node CPU, memory and storage, and which family it belongs to decides how storage and compute scale. This lecture applies to Provisioned only; Serverless hides node types.'},
{h:'The three families'},
{t:[['Family','Storage','Notes'],
['**RG**','Redshift managed storage','Graviton-based instances. Includes an integrated data lake query engine that runs on the cluster own compute'],
['**RA3**','Redshift managed storage','Compute and storage scale and bill separately. Data lake queries use Redshift Spectrum'],
['**DC2**','Local SSD only','Older compute-dense nodes. AWS has announced its deprecation and points customers to RA3, RG or Serverless']]},
{p:'AWS recommends choosing **RG or RA3** depending on the performance you need, the data size and expected growth. RG adds Graviton price-performance and an integrated lake query engine over RA3.'},
{h:'Sizes (from the current Management Guide)'},
{t:[['Node type','vCPU','RAM (GiB)','Default slices per node','Managed storage limit per node','Node range at create'],
['rg.large','2','16','2','1 TB (single node) / 8 TB (multi-node)','1 / 2 to 16'],
['rg.xlarge','4','32','2','32 TB','2 to 16'],
['rg.4xlarge','16','128','8','128 TB','2 to 32'],
['rg.12xlarge','48','384','16','128 TB','2 to 128'],
['ra3.large','2','16','2','1 TB (single) / 8 TB (multi)','1 / 2 to 16'],
['ra3.xlplus','4','32','2','4 TB (single) / 32 TB (multi)','1 / 2 to 16'],
['ra3.4xlarge','12','96','4','128 TB','2 to 32'],
['ra3.16xlarge','48','384','16','128 TB','2 to 128']]},
{p:'Elastic resize can grow some sizes further (for example rg.4xlarge and ra3.4xlarge up to 64 nodes). The node counts and limits above change over time and by Region, so always confirm in the console or the Management Guide.'},
{h:'DC2 status'},
{p:'DC2 clusters keep their data on local SSD, so storage grows only by adding nodes. AWS has announced that DC2 is being retired and recommends moving to RA3, RG or Serverless. The Management Guide still lists dc2.large and dc2.8xlarge specifications, but you should treat DC2 as legacy: do not start new designs on it, and check the retirement notices in your AWS Health Dashboard and console for the dates that apply to your account.'},
{t:[['Path from DC2','When to use'],
['Elastic resize to RA3','Quick, endpoint stays the same; works only for supported node and slice combinations'],
['Snapshot and restore into a new RA3 cluster','When elastic resize is not available; rename the new cluster to keep the endpoint'],
['Move to Serverless','Spiky workloads or when you want to stop managing capacity']]},
{h:'Choosing and checking'},
{code:`# Which node types can you order in this Region?
aws redshift describe-orderable-cluster-options \\
  --query "OrderableClusterOptions[].NodeType" --output text | tr '\\t' '\\n' | sort -u

# Create a small two-node RA3 lab cluster (remember to delete it)
aws redshift create-cluster --cluster-identifier lab-cluster \\
  --node-type ra3.xlplus --number-of-nodes 2 \\
  --master-username awsuser --manage-master-password \\
  --tags Key=project,Value=learnsphere-lab`},
{note:'The console also has a Help me choose sizing calculator that recommends a configuration from your data size and query characteristics in Regions that support RG or RA3.'}],
src:[['Amazon Redshift provisioned clusters (node type details)',MG+'working-with-clusters.html'],['Upgrading to RA3 node types',MG+'rs-upgrading-to-ra3.html']]};

/* ================= LECTURE 5 ================= */
L['rs:1:5']={blocks:[
{p:'Follow one query from the moment you press Enter to the moment results come back. Knowing the path tells you where time is spent and which tool to reach for when a query is slow.'},
{flow:['Leader node receives and parses the SQL','Result cache check: identical query already answered?','Optimizer rewrites and builds a plan','Engine turns the plan into steps, segments, streams','Compiled code is sent to compute nodes','Slices run the segments in parallel','Results return to the leader node','Leader merges, sorts, aggregates and replies']},
{h:'1. Parse and cache check'},
{p:'The leader node parses the SQL into a logical query tree. Before doing any real work Redshift checks the **result cache**: if an identical query ran before and nothing it depends on has changed, the stored result is returned immediately and the query never runs.'},
{p:'A cached result is used only when all of these are true:'},
{ul:['The user has permission on the objects in the query.','The tables and views in the query have not been modified.','The query does not use a function that must be evaluated each time, such as `GETDATE`.','The query does not reference Redshift Spectrum external tables.','Configuration parameters that could change the result are unchanged.','The query text matches the cached query.']},
{h:'2. Optimize and plan'},
{p:'The optimizer, which understands both parallel processing and column storage, may rewrite the query and then produces the plan: join types, join order, aggregation method and how data must be redistributed between nodes. You can see it with `EXPLAIN`.'},
{h:'3. Compile and run'},
{p:'The execution engine turns the plan into steps, segments and streams (see the additional lecture) and compiles code. The code goes to the compute nodes, where every slice runs it on its own share of the data. Intermediate results move between steps over the internal network.'},
{h:'4. Return'},
{p:'Compute nodes send their partial results to the leader node, which merges them, applies final sorting or aggregation and returns one result set to the client. Some work happens on the leader mid-query too; for example, a LIMIT in a subquery is applied on the leader before data is redistributed.'},
{h:'See it in the system view'},
{code:`-- Times are in microseconds
SELECT query_id, status, result_cache_hit,
       planning_time, compile_time, queue_time, execution_time, elapsed_time
FROM   sys_query_history
WHERE  query_type = 'SELECT'
ORDER  BY start_time DESC
LIMIT  5;

-- Turn the result cache off for this session when you benchmark
SET enable_result_cache_for_session TO off;`},
{t:[['Column','What it tells you'],
['result_cache_hit','true means the answer came from the cache'],
['planning_time','Time spent building the plan'],
['compile_time','Time spent compiling code for this query'],
['queue_time','Time waiting for capacity or a queue slot'],
['execution_time','Time actually running on the slices']]},
{note:'When you benchmark, turn the result cache off or you will measure the cache, not your design. SYS_QUERY_HISTORY works on both Provisioned and Serverless.'}],
src:[['Query planning and execution workflow',DG+'c-query-planning.html'],['Performance: result caching and compiled code',DG+'c_challenges_achieving_high_performance_queries.html'],['SYS_QUERY_HISTORY',DG+'SYS_QUERY_HISTORY.html']]};

/* ================= ADDITIONAL 6 ================= */
L['rs:1:6']={blocks:[
{p:'After planning, the engine breaks the work into three nested units. Knowing them lets you read query plans and system views without guessing.'},
{t:[['Unit','Definition','Remember it as'],
['**Step**','One operation, such as scan, join, aggregate or sort','A single action'],
['**Segment**','Several steps one process can do together; the smallest compilation unit a slice can run','What gets compiled'],
['**Stream**','A collection of segments handed out across the slices; segments in a stream run in parallel','A batch of work for all slices']]},
{h:'How a stream is processed'},
{ul:['The engine generates executable segments for **one stream**, sends them to the compute nodes, and waits for them to finish.','Only then does it generate the segments for the **next stream**. This lets it use what happened in the previous stream (for example, whether an operation spilled to disk) when generating the next one.']},
{h:'Compilation and the compile cache'},
{p:'Compiled code runs faster and uses less compute than interpreted code, but compiling takes time. Redshift reduces that cost in several ways:'},
{ul:['**Composition**: for a new query it can immediately run a lightweight arrangement of pre-existing logic while it compiles optimized query-specific code in the background, so a new query starts quickly.','A **compilation service** outside your cluster compiles code in parallel, so compiling does not compete with your queries for cluster resources.','**Compiled segments are cached** locally on the cluster and in a large remote cache that survives cluster reboots, so repeated queries can skip compilation.']},
{note:'Older guidance says to compare the second run of a query because the first includes compile time. That is still a safe habit when benchmarking, even though composition reduces the first-run penalty.'},
{h:'Where you see this in practice'},
{code:`-- A simplified plan: read it from the innermost, most-indented step outward.
-- (Costs and row counts will differ on your data.)
EXPLAIN
SELECT d.year, SUM(f.amount)
FROM   fact_sales f
JOIN   dim_date d ON f.date_key = d.date_key
GROUP  BY d.year;

-- XN HashAggregate
--   -> XN Hash Join DS_DIST_ALL_NONE
--        Hash Cond: (f.date_key = d.date_key)
--        -> XN Seq Scan on fact_sales f
--        -> XN Hash
--             -> XN Seq Scan on dim_date d`},
{ul:['`XN` marks a step run on the compute nodes.','`DS_DIST_ALL_NONE` says no data movement was needed for the join, which is the best outcome. Other `DS_` labels show data being redistributed or broadcast; Section 6 shows how table design removes them.','`compile_time` in `SYS_QUERY_HISTORY` shows how long compilation took for a query.']}],
src:[['Query planning and execution workflow',DG+'c-query-planning.html'],['Performance: compiled code',DG+'c_challenges_achieving_high_performance_queries.html'],['EXPLAIN',DG+'r_EXPLAIN.html']]};

/* ================= ADDITIONAL 7 ================= */
L['rs:1:7']={blocks:[
{p:'Redshift software is updated by AWS in numbered releases called patches. On provisioned clusters you choose how quickly you receive them by selecting a **maintenance track**.'},
{h:'Versions and patches'},
{ul:['A cluster version looks like `1.0.<build>`, for example `1.0.358853`.','Builds are grouped into numbered **patches** in the Redshift cluster version history, with the release date and the track each build is on.','One build can appear on more than one track, and some entries apply to Serverless only.']},
{code:`-- What version is this warehouse running?
SELECT version();

-- Provisioned: version and track from the CLI
aws redshift describe-clusters \\
  --query "Clusters[].[ClusterIdentifier,ClusterVersion,MaintenanceTrackName]" --output table`},
{h:'Current vs trailing'},
{t:[['Track','Behavior','Use it for'],
['**Current**','Receives the newest release first, with the latest features and fixes','Development, test and workloads that want new features early'],
['**Trailing**','Stays behind the current track, so releases reach it later','Production systems where you want newer releases proven elsewhere first']]},
{p:'A common practice is to run test and development clusters on the current track and production on trailing, so a release meets your own workload in test before it reaches production.'},
{code:`# Switch a cluster to the trailing track
aws redshift modify-cluster --cluster-identifier prod-cluster \\
  --maintenance-track-name trailing`},
{h:'How patches are applied'},
{ul:['Clusters are patched during the **maintenance window** for the Region and the window you set (Section 4).','New instance types and features are tied to specific patch versions; the version history lists the minimum version a feature needs, for example the minimum version required for single-node `rg.large`.','Serverless has no nodes to patch: AWS applies releases to workgroups, and the version history marks entries that apply to Serverless. Check the Serverless documentation for the patching options your workgroup offers.']},
{note:'Before relying on a new feature, check the cluster version history to confirm your warehouse patch level includes it.'}],
src:[['Cluster version history',MG+'cluster-versions.html'],['Cluster maintenance',MG+'rs-mgmt-maintenance-tracks.html']]};

/* ================= ADDITIONAL 8 ================= */
L['rs:1:8']={blocks:[
{p:'One warehouse running everything is simple, but ETL loads, dashboards and analysts compete for the same compute. A common design gives each workload its own warehouse and shares the data between them.'},
{svg:multi},
{h:'Why split warehouses'},
{ul:['**Isolation**: a heavy ad hoc query cannot slow the executive dashboard.','**Right-sizing**: each warehouse gets the capacity its workload needs, and you can scale or pause each independently.','**Chargeback**: each team compute cost is separate and visible.','**One copy of the data**: consumers read the producer live data through **data sharing**, so there is nothing to copy or keep in sync.']},
{h:'The basic mechanism'},
{p:'The warehouse that owns the data is the **producer**. Other warehouses are **consumers**. Sharing works across provisioned clusters, Serverless workgroups, AWS accounts and Regions, and between provisioned and Serverless.'},
{code:`-- On the producer
CREATE DATASHARE sales_share;
ALTER DATASHARE sales_share ADD SCHEMA public;
ALTER DATASHARE sales_share ADD ALL TABLES IN SCHEMA public;
GRANT USAGE ON DATASHARE sales_share TO NAMESPACE '<consumer-namespace-id>';

-- On the consumer
CREATE DATABASE sales_db FROM DATASHARE sales_share OF NAMESPACE '<producer-namespace-id>';
SELECT COUNT(*) FROM sales_db.public.fact_sales;`},
{h:'Common patterns'},
{t:[['Pattern','Producer','Consumers','Good for'],
['Hub and spoke','Central ETL warehouse','BI, ad hoc, data science warehouses','Most organizations; clean workload isolation'],
['Dev, test and prod','Production','Test and development','Testing against real data without copying it'],
['Data as a service','Domain team warehouse','Other teams or accounts','Teams publish curated data for others'],
['Mixed deployment','Provisioned with reserved nodes (steady load)','Serverless (spiky load)','Optimizing cost per workload']]},
{note:'Consumers see transactionally consistent data: a query reads the same snapshot throughout its transaction, and committed producer changes are visible to new consumer transactions straight away. Permissions, write access and cross-account sharing are covered in Section 14.'}],
src:[['Data sharing in Amazon Redshift',DG+'datashare-overview.html']]};
})();
