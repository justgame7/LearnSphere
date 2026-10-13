/* LearnSphere - Amazon Redshift Quick Reference (cheat sheet).
   window.QREF['rs'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Blocks: {h}, {p}, {t:[header,...rows]}, {code}, {note}, {ul}, {flow}. Lazy-loaded through REFLAZY in index.html.
   Pages that only make sense for a self-managed database server (data directory, install locations, OS settings) are left out because Redshift is a managed service.
   Facts follow the AWS documentation at the time of writing. Quotas, prices and dates change, so confirm in the console or the docs. */
window.QREF=window.QREF||{};
window.QREF.rs={title:'Amazon Redshift Quick Reference',blurb:'Components, logs, parameters, views, tools, limits and fixes on one page each. Use the search box to filter any page.',hint:'wlm or require_ssl',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas behind Amazon Redshift that you should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one query or command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Architecture and storage'},
{acc:[
{t:'Columnar storage and OLAP',s:'Read only the columns a query needs.',
 a:'Redshift stores each **column** separately in compressed 1 MB **blocks**. An analytic query that touches 5 of 100 columns reads only those 5 and skips the rest, and similar values in a column compress very well. It is the opposite trade-off to a row store, which is best for single-row lookups and updates.',
 w:'It is why a warehouse is fast on scans and aggregations, and slow on one-row-at-a-time updates.',
 c:`SELECT "table", size, tbl_rows, pct_used FROM svv_table_info ORDER BY size DESC LIMIT 10;`,see:[0,1,'OLTP vs OLAP and data warehouse concepts']},
{t:'Leader node, compute nodes and slices',s:'MPP: many workers, one coordinator.',
 a:'The **leader node** accepts connections, parses and plans SQL, and combines the final result. **Compute nodes** hold or cache the data and run query steps in parallel. Each node is divided into **slices**, and each slice processes its own share of every table.',
 w:'Performance depends on how evenly rows are spread over slices. One busy slice slows the whole step.',
 c:`SELECT node, slice FROM stv_slices ORDER BY node, slice LIMIT 8;`,see:[1,0,'Cluster architecture: leader node, compute nodes and slices']},
{t:'Zone maps',s:'Skip blocks that cannot match.',
 a:'Redshift keeps the minimum and maximum value of every column for every block (a **zone map**). With a filter on a sorted column, whole blocks are skipped without being read. The effect is strongest when data is physically sorted on the filter column.',
 w:'It is the reason sort keys matter more than indexes, which Redshift does not have.',
 c:`EXPLAIN SELECT count(*) FROM sales WHERE sale_date >= '2026-09-01';`,see:[1,1,'Columnar storage, blocks and zone maps']},
{t:'Redshift Managed Storage',s:'Compute and storage scale apart.',
 a:'On **RA3** nodes and in **Serverless**, data lives in Redshift Managed Storage (S3-backed) and the nodes keep a fast local cache of hot blocks. You can change compute without moving data, and you pay for storage by GB.',
 w:'It removes the old need to resize just to get more disk.',
 c:`SELECT SUM(size) AS blocks_mb FROM svv_table_info;`,see:[1,2,'Redshift Managed Storage']},
{t:'Provisioned vs Serverless',s:'Pick a cluster or pick a workgroup.',
 a:'**Provisioned** clusters have a node type and count that you manage, with resize and pause. **Serverless** has a **namespace** (data and users) and a **workgroup** (compute in RPUs) that scale automatically, billed per second of use. Both run the same engine and SQL.',
 w:'Use Serverless for spiky or small use, provisioned for steady heavy use and fine control.',
 c:`SELECT current_database(), version();`,see:[1,3,'Provisioned vs Serverless']},
{t:'Shared responsibility',s:'What AWS runs and what you run.',
 a:'AWS runs hardware, the engine, patching, backups and node replacement. You own **table design, loading, workload control, access, cost and monitoring**. Nothing about a managed warehouse fixes a bad distribution key or a full table scan.',
 w:'The DBA role is the same on Redshift. The work moves from servers to design and control.',
 c:`SELECT * FROM svv_redshift_tables LIMIT 5;`,see:[0,3,'DBA role and shared responsibility']}
]},

{h:'Table design'},
{acc:[
{t:'Distribution styles',s:'Where each row lives.',
 a:'`KEY` places rows with the same key value on the same slice, so joins on that key need no data movement. `ALL` copies a small table to every node. `EVEN` spreads rows round robin. `AUTO` (the default) lets Redshift choose and change as the table grows.',
 w:'Distribution is the biggest lever on join speed. A wrong choice shows up as `DS_BCAST` and `DS_DIST` steps in `EXPLAIN`.',
 c:`SELECT "table", diststyle, skew_rows, size FROM svv_table_info ORDER BY size DESC LIMIT 10;`,see:[5,1,'Distribution styles: AUTO, EVEN, KEY and ALL']},
{t:'Data skew',s:'One slice doing all the work.',
 a:'If a distribution key has a few very common values, those rows land on a few slices and the rest stay idle. The query runs only as fast as the busiest slice. `skew_rows` in `SVV_TABLE_INFO` shows the ratio between the largest and smallest slice.',
 w:'High skew is a design problem that more nodes do not solve.',
 c:`SELECT "table", skew_rows FROM svv_table_info WHERE skew_rows > 2 ORDER BY skew_rows DESC;`,see:[5,0,'Why table design matters: distribution and skew']},
{t:'Sort keys',s:'Physical order for the filter column.',
 a:'A **sort key** orders rows on disk. With the usual filter column (often a date) as the leading sort column, zone maps let Redshift skip most blocks. **Compound** keys are the normal choice, **AUTO** lets Redshift choose, and interleaved keys are rarely worth it.',
 w:'Unsorted rows, left after loads, are why VACUUM and automatic sorting exist.',
 c:`SELECT "table", sortkey1, unsorted, vacuum_sort_benefit FROM svv_table_info ORDER BY unsorted DESC NULLS LAST LIMIT 10;`,see:[5,2,'Sort keys: compound, interleaved and AUTO']},
{t:'Compression encodings',s:'Smaller blocks, less I/O.',
 a:'Each column has an **encoding** such as `AZ64` for numbers and dates, `ZSTD` as a general purpose choice, `LZO`, `BYTEDICT` and `RUNLENGTH`. Compression reduces storage and I/O. `ENCODE AUTO` and a first `COPY` into an empty table choose encodings for you.',
 w:'Leave encodings to AUTO unless you have measured a better choice.',
 c:`SELECT "column", type, encoding FROM pg_table_def WHERE tablename = 'sales';`,see:[5,3,'Compression encodings']},
{t:'Automatic Table Optimization',s:'Let the system tune the design.',
 a:'With `DISTSTYLE AUTO` and `SORTKEY AUTO`, Redshift watches the workload and applies distribution and sort key changes in the background. **Advisor** recommendations list other changes you may want to apply yourself.',
 w:'Start with AUTO. Take over only for tables you understand and measure.',
 c:`SELECT * FROM svv_alter_table_recommendations LIMIT 10;`,see:[5,4,'Automatic table optimization and Advisor']}
]},

{h:'Loading and unloading'},
{acc:[
{t:'COPY from S3',s:'The fast way in.',
 a:'`COPY` loads data from S3 in **parallel**, with each slice reading its own files. A `COPY` is much faster than a series of `INSERT` statements, which go through the leader one row at a time. Source files can be CSV, JSON, Parquet, ORC and others.',
 w:'Every bulk load should use `COPY`. Row-by-row inserts are the most common cause of "slow load".',
 c:`COPY sales FROM 's3://my-bucket/sales/2026/10/' IAM_ROLE default FORMAT AS PARQUET;`,see:[6,1,'COPY from Amazon S3']},
{t:'File preparation',s:'Many evenly sized files.',
 a:'For the best parallelism split input into **many files of similar size** (a multiple of the number of slices), each roughly 100 MB to 1 GB compressed. Use **compression** (gzip, zstd) and a **manifest** to control exactly which files are loaded.',
 w:'One giant file means one slice does the work.',
 c:`COPY sales FROM 's3://my-bucket/manifests/sales.manifest' IAM_ROLE default MANIFEST GZIP CSV;`,see:[6,2,'Preparing files: splitting, compression and manifests']},
{t:'Load errors',s:'Find the bad row.',
 a:'Failed rows are recorded in `STL_LOAD_ERRORS` (and `SYS_LOAD_ERROR_DETAIL`) with the file, line, column and reason. `MAXERROR` lets a load continue past some errors, and should be used knowingly.',
 w:'Always check the load error views after a bulk load, even when `COPY` reports success.',
 c:`SELECT starttime, filename, line_number, colname, err_reason FROM stl_load_errors ORDER BY starttime DESC LIMIT 10;`,see:[6,3,'Load errors and troubleshooting']},
{t:'Upsert and MERGE',s:'No UPDATE-in-place in a column store.',
 a:'Redshift supports `MERGE` to insert, update and delete from a staging table in one statement. The older pattern is a staging table, a `DELETE ... USING` of matching keys and an `INSERT`, inside one transaction. Both leave deleted rows that `VACUUM` later removes.',
 w:'Stage first, merge once. Do not update row by row.',
 c:`MERGE INTO sales USING sales_stage s ON sales.sale_id = s.sale_id
WHEN MATCHED THEN UPDATE SET amount = s.amount
WHEN NOT MATCHED THEN INSERT VALUES (s.sale_id, s.sale_date, s.amount);`,see:[6,4,'Upsert and merge patterns']},
{t:'UNLOAD',s:'Export in parallel.',
 a:'`UNLOAD` writes the result of a query to S3 in parallel, as many files, optionally in Parquet. It is the standard way to feed other systems or to archive cold data.',
 w:'It costs compute and S3 requests, so it is also the right tool for moving data out, not `SELECT` over a client.',
 c:`UNLOAD ('SELECT * FROM sales WHERE sale_date < ''2025-01-01''') TO 's3://my-bucket/archive/sales_' IAM_ROLE default FORMAT PARQUET;`,see:[6,5,'UNLOAD to Amazon S3']}
]},

{h:'Query processing and maintenance'},
{acc:[
{t:'The query lifecycle',s:'From SQL text to result.',
 a:'The leader node parses and rewrites the query, checks the **result cache**, builds a plan, compiles code for the steps (with a **compile cache**), and sends segments to the slices. Intermediate results move between nodes only when the distribution requires it, and the leader returns the final result.',
 w:'Knowing the stages tells you where a slow query spent its time: queue, compile, scan, network or return.',
 c:`SELECT query_id, status, queue_time, compile_time, execution_time FROM sys_query_history ORDER BY start_time DESC LIMIT 5;`,see:[1,5,'Query lifecycle end to end']},
{t:'EXPLAIN and data movement',s:'The expensive steps have names.',
 a:'`EXPLAIN` shows join types and **data movement**: `DS_DIST_NONE` and `DS_DIST_ALL_NONE` are good (no movement), `DS_BCAST_INNER` and `DS_DIST_BOTH` are expensive because they ship large amounts of data.',
 w:'A plan full of `DS_BCAST` is a distribution design problem, not a cluster-size problem.',
 c:`EXPLAIN SELECT c.region, sum(s.amount) FROM sales s JOIN customers c ON s.customer_id = c.customer_id GROUP BY 1;`,see:[7,0,'Reading EXPLAIN']},
{t:'Statistics and ANALYZE',s:'What the planner knows.',
 a:'The planner uses table statistics (row counts, value distributions). **Automatic analyze** keeps them fresh in the background, and you run `ANALYZE` after large loads when a query must be right immediately. Stale statistics cause bad join orders.',
 w:'After a big load, a wrong plan is far more likely to be stale statistics than anything else.',
 c:`SELECT "table", stats_off FROM svv_table_info WHERE stats_off > 10 ORDER BY stats_off DESC;`,see:[7,1,'Statistics and ANALYZE']},
{t:'VACUUM',s:'Reclaim space, restore sort order.',
 a:'Deleted rows are only marked, and new rows land in an **unsorted region**. `VACUUM` removes deleted rows and re-sorts. Redshift runs **automatic vacuum** in the background, and you run a manual one for heavy-change tables.',
 w:'High `unsorted` and `tbl_rows` much larger than real rows signal vacuum debt.',
 c:`SELECT "table", unsorted, tbl_rows, estimated_visible_rows FROM svv_table_info WHERE unsorted > 10;`,see:[7,3,'VACUUM and automatic vacuum']},
{t:'Result and compile caches',s:'The fastest query is a repeat.',
 a:'If an identical query was run and the underlying data has not changed, the **result cache** returns the stored answer without executing. The **compile cache** reuses compiled segments, so a new query that shares structure compiles faster.',
 w:'A repeated dashboard is cheap. Benchmark with `enable_result_cache_for_session` off.',
 c:`SET enable_result_cache_for_session TO off;`,see:[7,4,'Result cache and compile cache']},
{t:'Materialized views',s:'Precompute the expensive part.',
 a:'A **materialized view** stores the result of a query and can **refresh automatically**. Redshift can also **rewrite** queries to use it. It suits repeated aggregations on large tables.',
 w:'Refresh cost and staleness are the trade-off. Monitor them.',
 c:`CREATE MATERIALIZED VIEW daily_sales AUTO REFRESH YES AS SELECT sale_date, sum(amount) AS total FROM sales GROUP BY sale_date;`,see:[7,6,'Materialized views']}
]},

{h:'Workload and capacity'},
{acc:[
{t:'Workload management',s:'Queues and priorities.',
 a:'**Automatic WLM** manages queues and memory for you and assigns **priorities** to queries by user group or query group. **Manual WLM** gives fixed queues and memory percentages. Short queries should not wait behind long reports.',
 w:'A mixed dashboard and ETL workload is the classic reason to set up queues.',
 c:`SELECT service_class, num_query_tasks, query_working_mem FROM stv_wlm_service_class_config WHERE service_class > 5;`,see:[8,1,'Automatic WLM and queue setup']},
{t:'Query monitoring rules',s:'Stop the runaway.',
 a:'**QMR** watch metrics such as execution time, rows returned or nested loop joins, and take an **action**: log, change priority or **abort**. They protect the cluster from a single bad query.',
 w:'Rules are guardrails. Start with log, then add abort for clear cases.',
 c:`SELECT rule_name, action, query_id FROM stl_wlm_rule_action ORDER BY recordtime DESC LIMIT 10;`,see:[8,3,'Query monitoring rules']},
{t:'Concurrency scaling',s:'Burst out when queues build.',
 a:'When queries queue, Redshift can add **concurrency scaling** clusters for eligible queries and removes them afterwards. Each main cluster earns free scaling time per day, and usage above that is billed per second.',
 w:'It handles peaks without permanent over-sizing. Set a maximum to cap cost.',
 c:`SELECT start_time, end_time, queries FROM svcs_concurrency_scaling_usage ORDER BY start_time DESC LIMIT 5;`,see:[8,4,'Concurrency scaling']},
{t:'Resize and serverless capacity',s:'Change compute safely.',
 a:'On provisioned clusters an **elastic resize** changes node count in minutes with a brief pause, and a **classic resize** rebuilds the cluster for bigger changes. In Serverless you set **base capacity** and a **maximum capacity** in RPUs, plus **usage limits** to cap spend.',
 w:'Plan the resize window, and set usage limits before they are needed.',
 c:`SELECT * FROM sys_serverless_usage ORDER BY start_time DESC LIMIT 5;`,see:[3,2,'Resize: elastic vs classic']}
]},

{h:'Security, availability and the data lake'},
{acc:[
{t:'IAM and database permissions',s:'Two layers of access.',
 a:'**IAM** controls who can call the Redshift API and obtain credentials (including federated sign-in and temporary credentials). **Database permissions** (users, groups, roles, grants) control what they can read and change after they connect. You need both.',
 w:'IAM alone never grants table access, and database grants alone never allow API actions.',
 c:`SELECT usename, usesuper FROM pg_user ORDER BY usename;`,see:[9,0,'Security model: IAM vs database permissions']},
{t:'RBAC',s:'Roles over users.',
 a:'**Role-based access control** lets you create roles, grant privileges to roles and grant roles to users or other roles. It scales better than per-user grants, and system roles such as `sys:monitor` give least-privilege administration.',
 w:'Prefer roles to users and groups for new designs.',
 c:`SELECT role_name, role_owner FROM svv_roles;`,see:[9,2,'Roles and RBAC']},
{t:'Encryption and network isolation',s:'Data and paths protected.',
 a:'Data at rest is encrypted with **KMS**, and connections can require **SSL** (`require_ssl`). Clusters live in a VPC, and **enhanced VPC routing** forces COPY, UNLOAD and Spectrum traffic through your VPC so you can control and log it.',
 w:'Decide encryption and public accessibility at creation, and test the network path for S3.',
 c:`aws redshift describe-clusters --cluster-identifier my-cluster --query 'Clusters[0].[Encrypted,KmsKeyId,PubliclyAccessible,EnhancedVpcRouting]'`,see:[10,0,'Encryption at rest']},
{t:'Audit logging',s:'Who connected and what they ran.',
 a:'The **connection log**, **user log** and **user activity log** can be written to S3 or CloudWatch Logs. System tables such as `SYS_CONNECTION_LOG` and `SYS_QUERY_HISTORY` hold shorter-term history. CloudTrail records API calls.',
 w:'Enable it before an incident. Logs that were never turned on do not exist.',
 c:`SELECT event, recordtime, username, remotehost FROM sys_connection_log ORDER BY recordtime DESC LIMIT 10;`,see:[10,3,'Audit logging']},
{t:'Snapshots and restore',s:'Backups that become new clusters.',
 a:'Automated snapshots run roughly every eight hours or after a set amount of change, with a retention you choose (1 to 35 days). Manual snapshots are kept until deleted. A restore creates a **new** cluster or namespace, and a single table can be restored to a new name.',
 w:'Test a restore, and know your RPO. Snapshots are not instantly continuous.',
 c:`aws redshift describe-cluster-snapshots --cluster-identifier my-cluster --query 'Snapshots[].[SnapshotIdentifier,SnapshotCreateTime,SnapshotType]' --output table`,see:[12,0,'Automated and manual snapshots']},
{t:'Multi-AZ and disaster recovery',s:'Survive an AZ failure.',
 a:'Multi-AZ on RA3 provisioned clusters runs compute in two AZs for automatic recovery with no data loss. For Region failure use **cross-Region snapshot copy** and a tested runbook. RPO and RTO are decisions, not defaults.',
 w:'Write down your RPO and RTO first, then choose the feature.',
 c:`aws redshift describe-clusters --cluster-identifier my-cluster --query 'Clusters[0].MultiAZ'`,see:[12,6,'Multi-AZ and node failure']},
{t:'Spectrum and data sharing',s:'Query beyond the warehouse.',
 a:'**Redshift Spectrum** queries data in S3 through external schemas and the Glue Data Catalog, billed by data scanned. **Data sharing** gives another cluster or account live read access to your data with no copy.',
 w:'Use Spectrum for cold, large or lake data and data sharing for separate teams and workloads.',
 c:`CREATE EXTERNAL SCHEMA lake FROM DATA CATALOG DATABASE 'sales_lake' IAM_ROLE default;`,see:[13,0,'Redshift Spectrum and external schemas']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Five small maps of how the parts fit together: the architecture, distribution and sort keys, the loading path, workload management and the access and network path.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why a DBA cares, one query or command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. How a Redshift warehouse fits together'},
{map:{title:'Redshift architecture map',h:216,trace:'Follow a query',
 hint:'Tap any box, or press Follow a query to see where a SQL statement goes in a provisioned cluster or a Serverless workgroup.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[562,80,562,134]],
 nodes:[
 {id:'cli',x:21,y:24,w:194,h:56,c:'ext',t:'Client or BI tool',s:'JDBC, ODBC, Data API',d:'Any SQL client, BI tool, Query Editor v2 or the Redshift Data API. It talks PostgreSQL protocol to the endpoint.',why:'Each connection uses a session on the leader node.',chk:`SELECT pid, user_name, db_name, start_time FROM sys_connection_log WHERE event = 'initiating session' ORDER BY recordtime DESC LIMIT 5;`,see:[2,4,'Connecting with Query Editor v2 and psql']},
 {id:'lead',x:243,y:24,w:194,h:56,c:'proc',t:'Leader node',s:'parse, plan, return',d:'Accepts connections, parses the SQL, builds the plan, compiles code, sends work to compute nodes and returns the combined result.',why:'Large result sets returned to a client pass through it. Use UNLOAD for big exports.',chk:`SELECT query_id, status, queue_time, compile_time FROM sys_query_history ORDER BY start_time DESC LIMIT 3;`,see:[1,0,'Cluster architecture: leader node, compute nodes and slices']},
 {id:'comp',x:465,y:24,w:194,h:56,c:'proc',t:'Compute nodes',s:'run the steps',d:'Each compute node is divided into slices that scan, join and aggregate their share of the data in parallel.',why:'Adding nodes helps only when work is evenly spread across slices.',chk:`SELECT node, count(*) AS slices FROM stv_slices GROUP BY node ORDER BY node;`,see:[1,0,'Cluster architecture: leader node, compute nodes and slices']},
 {id:'sl',x:21,y:136,w:194,h:56,c:'mem',t:'Slices',s:'unit of parallelism',d:'A share of a node CPU, memory and disk. Rows are placed on slices by the distribution style.',why:'A hot slice is the slowest step of the whole query.',chk:`SELECT slice, count(*) FROM stv_blocklist GROUP BY slice ORDER BY 2 DESC LIMIT 5;`,see:[5,0,'Why table design matters: distribution and skew']},
 {id:'rms',x:243,y:136,w:194,h:56,c:'disk',t:'Managed storage',s:'S3-backed, cached',d:'On RA3 and Serverless data lives in managed storage, with hot blocks cached on local SSD of the compute nodes.',why:'Storage and compute are billed and scaled separately.',chk:`SELECT SUM(size) AS mb FROM svv_table_info;`,see:[1,2,'Redshift Managed Storage']},
 {id:'spec',x:465,y:136,w:194,h:56,c:'ext',t:'Spectrum and the lake',s:'S3, Glue, other sources',d:'Spectrum reads open-format files in S3 through external schemas. Federated queries and data sharing reach other databases and clusters.',why:'Data is scanned outside the cluster and billed by the amount scanned.',chk:`SELECT schemaname, tablename FROM svv_external_tables LIMIT 5;`,see:[13,0,'Redshift Spectrum and external schemas']}],
 steps:[
 {ids:['cli','lead'],t:'1. A client connects to the endpoint and submits a SQL statement. The leader node authenticates the session and parses the statement.',w:'The leader node is a single coordinator for every query.',s:'Endpoint, security group, IAM or password authentication.',x:'A session limit or a blocked port stops the connection before SQL starts.',c:`SELECT current_user, current_database();`},
 {ids:['lead'],t:'2. The leader checks the result cache, then builds a plan using table statistics, and compiles code for the steps (or reuses compiled code).',w:'A cache hit skips execution entirely.',s:'Result cache, compile cache, statistics.',x:'Stale statistics produce a poor join order.',c:`EXPLAIN SELECT count(*) FROM sales;`},
 {ids:['lead','comp','sl'],t:'3. Plan segments go to the slices. Each slice works on its own data in parallel, and rows move between nodes only when a join or aggregation needs them.',w:'This is the massively parallel step.',s:'Distribution style, sort key, workload management.',x:'Data movement steps (`DS_BCAST`, `DS_DIST`) and skew.',c:`SELECT query, step, label, rows FROM svl_query_summary WHERE query = pg_last_query_id() ORDER BY step;`},
 {ids:['comp','rms'],t:'4. Slices read blocks from local cache, or from managed storage if they are not cached. Zone maps let them skip blocks that cannot match.',w:'Sorted data means fewer blocks read.',s:'Sort key, cache size (node type).',x:'A cold cache after a resize makes the first runs slower.',c:`SELECT query, segment, step, rows_pre_filter, rows FROM svl_query_summary WHERE query = pg_last_query_id();`},
 {ids:['comp','spec'],t:'5. If the query references an external table, the work for that part goes to the Spectrum layer, which reads the S3 files and returns filtered rows.',w:'It extends the warehouse over the lake.',s:'External schema, file format, partitioning.',x:'Scanning un-partitioned CSV in S3 is slow and costly.',c:`SELECT query, external_table_name, s3_scanned_bytes FROM svl_s3query_summary ORDER BY endtime DESC LIMIT 5;`},
 {ids:['lead','cli'],t:'6. The leader node merges the partial results and returns them to the client. The result is stored in the result cache for an identical later query.',w:'The client sees one result from many workers.',s:'Result cache setting, result size.',x:'Returning millions of rows through the leader node.',c:`SELECT query_id, result_cache_hit, elapsed_time FROM sys_query_history ORDER BY start_time DESC LIMIT 3;`}]}},

{h:'2. Distribution and sort keys'},
{map:{title:'Table design map',h:328,trace:'Join and filter two tables',
 hint:'Tap any box, or press Join and filter two tables to see how distribution and sort keys decide how much work a query does.',
 lines:[[215,52,241,52],[437,52,463,52],[215,164,241,164],[437,164,463,164],'M562 80 L562 163 L118 163 L118 246',[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'row',x:21,y:24,w:194,h:56,c:'ext',t:'A row arrives',s:'INSERT or COPY',d:'Each new row has to be placed on a slice. Where it goes depends on the table distribution style.',why:'Placement happens at load time, not at query time.',chk:`SELECT "table", diststyle FROM svv_table_info WHERE "table" = 'sales';`,see:[5,1,'Distribution styles: AUTO, EVEN, KEY and ALL']},
 {id:'key',x:243,y:24,w:194,h:56,c:'proc',t:'Distribution style',s:'KEY, ALL, EVEN, AUTO',d:'KEY hashes a column to choose the slice. ALL copies the table to every node. EVEN round-robins. AUTO picks and adapts.',why:'The same style on two joined tables is what avoids data movement.',chk:`ALTER TABLE sales ALTER DISTSTYLE KEY DISTKEY customer_id;`,see:[5,1,'Distribution styles: AUTO, EVEN, KEY and ALL']},
 {id:'slice',x:465,y:24,w:194,h:56,c:'mem',t:'Slices',s:'each holds its share',d:'Rows with the same key value are together. A skewed key puts too many rows on a few slices.',why:'Check skew before blaming the cluster size.',chk:`SELECT "table", skew_rows FROM svv_table_info ORDER BY skew_rows DESC NULLS LAST LIMIT 5;`,see:[5,0,'Why table design matters: distribution and skew']},
 {id:'zone',x:21,y:136,w:194,h:56,c:'mem',t:'Blocks and zone maps',s:'min and max per block',d:'Each 1 MB block records the lowest and highest value of the column. A filter outside the range skips the block.',why:'Only sorted columns give tight ranges.',chk:`SELECT "table", sortkey1, unsorted FROM svv_table_info WHERE "table" = 'sales';`,see:[1,1,'Columnar storage, blocks and zone maps']},
 {id:'sort',x:243,y:136,w:194,h:56,c:'proc',t:'Sort key',s:'physical order',d:'Rows are stored in sort key order within each slice. A date sort key lets a date range read few blocks.',why:'New loads create an unsorted region until vacuum merges it.',chk:`ALTER TABLE sales ALTER SORTKEY (sale_date);`,see:[5,2,'Sort keys: compound, interleaved and AUTO']},
 {id:'sk',x:465,y:136,w:194,h:56,c:'warn',t:'Skew',s:'one slice is slow',d:'A few slices hold most rows (a popular key value, NULLs) and the step waits for them.',why:'Choose a higher-cardinality key, or EVEN.',chk:`SELECT slice, count(*) FROM stv_blocklist b JOIN stv_tbl_perm p ON p.id = b.tbl WHERE p.name = 'sales' GROUP BY slice ORDER BY 2 DESC LIMIT 5;`,see:[5,0,'Why table design matters: distribution and skew']},
 {id:'join',x:21,y:248,w:194,h:56,c:'proc',t:'Join',s:'co-located or moved',d:'If both tables are distributed on the join key, each slice joins locally. Otherwise one side is broadcast or redistributed.',why:'The plan label says which: `DS_DIST_NONE` is good.',chk:`EXPLAIN SELECT * FROM sales s JOIN customers c USING (customer_id);`,see:[7,0,'Reading EXPLAIN']},
 {id:'move',x:243,y:248,w:194,h:56,c:'warn',t:'Data movement',s:'DS_BCAST, DS_DIST',d:'Large intermediate results sent across the network between nodes.',why:'It is the cost to remove by redesign, not by resize.',chk:`SELECT query, label, rows, bytes FROM svl_query_summary WHERE label LIKE 'DS_%' ORDER BY bytes DESC LIMIT 5;`,see:[7,0,'Reading EXPLAIN']},
 {id:'fix',x:465,y:248,w:194,h:56,c:'ext',t:'Fix the design',s:'key, ALL, AUTO',d:'Make the large fact table KEY on the join column, make small dimensions ALL, or leave both AUTO and let Redshift learn.',why:'Verify with EXPLAIN and the system views afterwards.',chk:`SELECT * FROM svv_alter_table_recommendations;`,see:[5,4,'Automatic table optimization and Advisor']}],
 steps:[
 {ids:['row','key'],t:'1. A row is loaded. The distribution style decides which slice stores it. KEY uses a hash of the column value.',w:'Placement is permanent until you redistribute.',s:'`DISTSTYLE`, `DISTKEY`.',x:'A key with few values or many NULLs.',c:`SELECT "table", diststyle, skew_rows FROM svv_table_info;`},
 {ids:['slice','sk'],t:'2. Rows are counted per slice. An even spread means all slices finish together. A skewed spread means one slice finishes last.',w:'Step time equals the slowest slice.',s:'Distribution key cardinality.',x:'Resizing the cluster does not fix skew.',c:`SELECT slice, count(*) FROM stv_blocklist GROUP BY slice ORDER BY 2 DESC LIMIT 5;`},
 {ids:['sort','zone'],t:'3. Within a slice rows follow the sort key, so blocks have tight min and max values and a filter can skip most of them.',w:'Less data read means faster scans.',s:'`SORTKEY`, `VACUUM`.',x:'A large unsorted region after loads weakens zone maps.',c:`SELECT "table", unsorted FROM svv_table_info ORDER BY unsorted DESC NULLS LAST LIMIT 5;`},
 {ids:['join'],t:'4. Two tables joined on their distribution key meet on the same slice, and the join needs no network movement.',w:'Co-location is the cheapest join.',s:'Same `DISTKEY` or `ALL` on the small side.',x:'Joining on a column that is not the distribution key.',c:`EXPLAIN SELECT count(*) FROM sales s JOIN customers c ON s.customer_id = c.customer_id;`},
 {ids:['move'],t:'5. If the join key is not the distribution key, a side is broadcast or redistributed. The labels `DS_BCAST_INNER` and `DS_DIST_BOTH` warn that large data crosses the network.',w:'These steps dominate slow joins.',s:'Table design.',x:'Broadcasting a large table to every node.',c:`SELECT label, sum(bytes) FROM svl_query_summary WHERE query = pg_last_query_id() GROUP BY label;`},
 {ids:['fix'],t:'6. Fix the design: KEY the large table on the main join column, ALL for small dimensions, or let AUTO and Advisor adjust. Re-run EXPLAIN to confirm.',w:'A design change beats more nodes.',s:'`ALTER TABLE ... ALTER DISTSTYLE`, ATO.',x:'Changing a huge table during peak hours.',c:`ALTER TABLE customers ALTER DISTSTYLE ALL;`}]}},

{h:'3. The loading path'},
{map:{title:'Data loading map',h:328,trace:'Load a file set with COPY',
 hint:'Tap any box, or press Load a file set with COPY to follow data from S3 files to queryable, sorted rows.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'src',x:21,y:24,w:194,h:56,c:'ext',t:'Source files in S3',s:'many, similar size',d:'The data to load, written to S3 by an ETL job, an export or a stream.',why:'Split into many files of similar size so every slice has work.',chk:`aws s3 ls s3://my-bucket/sales/2026/10/ --recursive --human-readable | head`,see:[6,0,'Loading overview and best practices']},
 {id:'prep',x:243,y:24,w:194,h:56,c:'proc',t:'Prepare',s:'compress, manifest',d:'Compress the files (gzip or zstd), and write a manifest if you need to control exactly which files load.',why:'Parquet and other columnar formats load fast and carry types.',chk:`COPY sales FROM 's3://my-bucket/manifests/sales.manifest' IAM_ROLE default MANIFEST CSV GZIP;`,see:[6,2,'Preparing files: splitting, compression and manifests']},
 {id:'copy',x:465,y:24,w:194,h:56,c:'proc',t:'COPY command',s:'IAM role, format',d:'COPY reads the files in parallel across all slices using the IAM role for S3 access.',why:'It is the only fast way to bulk load.',chk:`COPY sales FROM 's3://my-bucket/sales/2026/10/' IAM_ROLE default FORMAT AS PARQUET;`,see:[6,1,'COPY from Amazon S3']},
 {id:'slc',x:21,y:136,w:194,h:56,c:'mem',t:'Slices load in parallel',s:'one stream per slice',d:'Each slice takes some of the files and loads its share, then rows are distributed by the table distribution style.',why:'More files than slices keeps all slices busy.',chk:`SELECT query, slice, num_files, sum(num_rows) FROM stl_load_commits GROUP BY 1,2,3 ORDER BY query DESC LIMIT 5;`,see:[6,1,'COPY from Amazon S3']},
 {id:'stat',x:243,y:136,w:194,h:56,c:'mem',t:'Statistics',s:'ANALYZE on load',d:'COPY into an empty table updates statistics (COMPUPDATE and STATUPDATE) and can choose compression.',why:'Into a populated table, run `ANALYZE` yourself or rely on auto analyze.',chk:`ANALYZE sales;`,see:[7,1,'Statistics and ANALYZE']},
 {id:'err',x:465,y:136,w:194,h:56,c:'warn',t:'Load errors',s:'STL_LOAD_ERRORS',d:'Rows that fail are recorded with file, line and reason. The load fails or continues depending on MAXERROR.',why:'Check the view after every load.',chk:`SELECT filename, line_number, colname, err_reason FROM stl_load_errors ORDER BY starttime DESC LIMIT 5;`,see:[6,3,'Load errors and troubleshooting']},
 {id:'merge',x:126,y:248,w:200,h:56,c:'proc',t:'Upsert with MERGE',s:'stage then merge',d:'Load into a staging table first and then MERGE into the target to insert, update or delete.',why:'Avoid row-by-row changes.',chk:`MERGE INTO sales USING sales_stage s ON sales.sale_id = s.sale_id WHEN MATCHED THEN UPDATE SET amount = s.amount WHEN NOT MATCHED THEN INSERT VALUES (s.sale_id, s.sale_date, s.amount);`,see:[6,4,'Upsert and merge patterns']},
 {id:'vac',x:354,y:248,w:200,h:56,c:'proc',t:'Sort and vacuum',s:'auto vacuum',d:'Loaded rows are in an unsorted region. Automatic vacuum merges them into sort order and removes deleted rows.',why:'For big loads, a manual `VACUUM` may be justified.',chk:`VACUUM SORT ONLY sales;`,see:[7,3,'VACUUM and automatic vacuum']}],
 steps:[
 {ids:['src','prep'],t:'1. Produce files in S3: split into many files of similar size, compressed, ideally in Parquet. Optionally write a manifest.',w:'File layout decides load speed.',s:'File size, count, format.',x:'One huge file loads on one slice.',c:`aws s3 ls s3://my-bucket/sales/2026/10/ --summarize`},
 {ids:['copy'],t:'2. Run COPY with an IAM role that can read the bucket (and use the KMS key, if any).',w:'Credentials are the role, not keys in SQL.',s:'`IAM_ROLE`, bucket policy, KMS permissions.',x:'Access denied because the role is not associated with the cluster.',c:`COPY sales FROM 's3://my-bucket/sales/2026/10/' IAM_ROLE default FORMAT AS PARQUET;`},
 {ids:['slc'],t:'3. Slices read files in parallel. Each row is hashed or placed by the distribution style and appended to blocks.',w:'The load scales with the number of slices.',s:'Number of files, node size.',x:'Fewer files than slices leaves slices idle.',c:`SELECT query, count(*) AS files, sum(lines_scanned) FROM stl_load_commits WHERE query = pg_last_query_id() GROUP BY 1;`},
 {ids:['stat','err'],t:'4. After the load, statistics are updated and errors are recorded. Check the error view even when COPY reports success.',w:'Silent bad rows are worse than a failed load.',s:'`MAXERROR`, `COMPUPDATE`, `STATUPDATE`.',x:'MAXERROR set high hides data problems.',c:`SELECT count(*) FROM stl_load_errors WHERE query = pg_last_query_id();`},
 {ids:['merge'],t:'5. For incremental loads, COPY into a staging table, then MERGE (or delete and insert) into the target in one transaction.',w:'One set-based statement instead of many.',s:'Staging table, primary key columns.',x:'Duplicates in staging make MERGE fail or mis-match.',c:`BEGIN; MERGE INTO sales USING sales_stage s ON sales.sale_id = s.sale_id WHEN MATCHED THEN UPDATE SET amount = s.amount WHEN NOT MATCHED THEN INSERT VALUES (s.sale_id, s.sale_date, s.amount); COMMIT;`},
 {ids:['vac'],t:'6. New rows sit in an unsorted region and deleted rows remain until vacuum runs. Automatic vacuum handles it, and a manual run helps after very large loads.',w:'Sort order is what makes zone maps work.',s:'Auto vacuum, `VACUUM` options.',x:'Ignoring unsorted percent for weeks.',c:`SELECT "table", unsorted FROM svv_table_info WHERE "table" = 'sales';`}]}},

{h:'4. Workload management'},
{map:{title:'Workload management map',h:328,trace:'Follow a short and a long query',
 hint:'Tap any box, or press Follow a short and a long query to see how queues, priority, rules and scaling treat each.',
 lines:[[215,52,241,52],[215,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L340 219 L340 246'],
 nodes:[
 {id:'q',x:21,y:24,w:194,h:56,c:'ext',t:'Query arrives',s:'user, group, label',d:'A query arrives with a user, user group and optional query group. These attributes decide the queue and priority.',why:'Set query groups for important jobs.',chk:`SET query_group TO 'etl';`,see:[8,2,'User groups, query groups and query priority']},
 {id:'sqa',x:243,y:24,w:194,h:56,c:'proc',t:'Short query acceleration',s:'fast lane',d:'A short query that SQA predicts will be quick runs in a dedicated space and does not wait behind long ones.',why:'Keep it on. Dashboards benefit most.',chk:`SELECT query_id, query_type, elapsed_time FROM sys_query_history WHERE query_type = 'SELECT' ORDER BY start_time DESC LIMIT 5;`,see:[7,5,'Short query acceleration']},
 {id:'auto',x:465,y:24,w:194,h:56,c:'proc',t:'Automatic WLM',s:'queues and memory',d:'Redshift assigns memory and concurrency to queues dynamically, based on the workload and the queue priority.',why:'You set the priority and rules, not the numbers.',chk:`SELECT service_class, name FROM stv_wlm_service_class_config WHERE service_class > 5;`,see:[8,1,'Automatic WLM and queue setup']},
 {id:'pri',x:21,y:136,w:194,h:56,c:'mem',t:'Query priority',s:'HIGHEST to LOWEST',d:'Queries in higher-priority queues get resources first. Priority can be set per queue or per query.',why:'Reserve HIGHEST for critical short queries.',chk:`SELECT service_class, priority FROM stv_wlm_service_class_config WHERE service_class > 5;`,see:[8,2,'User groups, query groups and query priority']},
 {id:'qmr',x:243,y:136,w:194,h:56,c:'warn',t:'Query monitoring rules',s:'log, hop, abort',d:'Rules watch metrics (execution time, rows, spill, nested loop) and take an action when a threshold is crossed.',why:'Start with log, then abort for clear cases.',chk:`SELECT rule, action, query FROM stl_wlm_rule_action ORDER BY recordtime DESC LIMIT 5;`,see:[8,3,'Query monitoring rules']},
 {id:'cs',x:465,y:136,w:194,h:56,c:'proc',t:'Concurrency scaling',s:'extra clusters',d:'When queries queue, eligible queries run on added clusters that are billed per second beyond free credits.',why:'Cap the number of scaling clusters.',chk:`SELECT start_time, queries FROM svcs_concurrency_scaling_usage ORDER BY start_time DESC LIMIT 5;`,see:[8,4,'Concurrency scaling']},
 {id:'sl',x:240,y:248,w:200,h:56,c:'mem',t:'Serverless controls',s:'RPU limits, usage limits',d:'In Serverless the workgroup scales compute within a base and maximum RPU, with usage limits and query limits for cost and runaway control.',why:'Set a maximum before you need it.',chk:`SELECT * FROM sys_serverless_usage ORDER BY start_time DESC LIMIT 5;`,see:[8,5,'Serverless workload controls']}],
 steps:[
 {ids:['q','sqa'],t:'1. A short, simple query arrives. SQA predicts it is fast and sends it to the short query queue immediately.',w:'It does not wait behind reports.',s:'SQA enabled (default).',x:'Disabling SQA on a mixed workload.',c:`SELECT query_id, queue_time, execution_time FROM sys_query_history ORDER BY start_time DESC LIMIT 5;`},
 {ids:['q','auto','pri'],t:'2. A long report arrives in a user group queue. Automatic WLM assigns memory and concurrency, and priority decides who goes first when resources are short.',w:'Important work is not starved.',s:'Queue priority, user group mapping.',x:'Everything at the same priority.',c:`SELECT query, service_class, queue_start_time, queue_end_time FROM stl_wlm_query ORDER BY queue_start_time DESC LIMIT 5;`},
 {ids:['qmr'],t:'3. The report runs for much longer than expected. A rule on execution time logs it or aborts it, so it cannot hold the queue.',w:'A guardrail against runaway queries.',s:'QMR rule metric and action.',x:'An abort rule without checking real report times.',c:`SELECT rule, action, query FROM stl_wlm_rule_action ORDER BY recordtime DESC LIMIT 5;`},
 {ids:['cs'],t:'4. At month end many reports arrive and queue. Concurrency scaling adds clusters for eligible queries, and they are removed when the queue drains.',w:'Peaks are absorbed without a permanent bigger cluster.',s:'`max_concurrency_scaling_clusters`.',x:'An uncapped maximum on a bursty workload.',c:`SELECT * FROM svcs_concurrency_scaling_usage ORDER BY start_time DESC LIMIT 5;`},
 {ids:['sl'],t:'5. In Serverless the workgroup scales its RPUs for the load, within the base and maximum capacity you set. Usage limits stop spend at a threshold.',w:'Cost and performance are both bounded.',s:'Base capacity, max capacity, usage limits.',x:'No usage limit on a development workgroup.',c:`SELECT start_time, charged_seconds FROM sys_serverless_usage ORDER BY start_time DESC LIMIT 5;`}]}},

{h:'5. Access and network path'},
{map:{title:'Security path map',h:328,trace:'Connect and run a query securely',
 hint:'Tap any box, or press Connect and run a query securely to follow the controls from identity to audit.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L118 219 L118 246',[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'idp',x:21,y:24,w:194,h:56,c:'ext',t:'Identity provider',s:'SSO or IAM user',d:'The person or service signs in with corporate SSO, an IAM role, or a database user and password.',why:'Prefer federated identity and temporary credentials.',chk:`aws sts get-caller-identity`,see:[9,5,'Authentication: passwords, IAM and federated SSO']},
 {id:'iam',x:243,y:24,w:194,h:56,c:'proc',t:'IAM permissions',s:'API and credentials',d:'IAM policies decide who may call Redshift APIs and obtain temporary database credentials.',why:'It does not grant access to tables.',chk:`aws redshift get-cluster-credentials --cluster-identifier my-cluster --db-user analyst --db-name dev`,see:[9,0,'Security model: IAM vs database permissions']},
 {id:'vpc',x:465,y:24,w:194,h:56,c:'net',t:'VPC and subnets',s:'private placement',d:'The cluster or workgroup sits in your VPC subnets. Public accessibility is a choice, and private is the safer default.',why:'Enhanced VPC routing sends COPY and UNLOAD through the VPC.',chk:`aws redshift describe-clusters --cluster-identifier my-cluster --query 'Clusters[0].[PubliclyAccessible,EnhancedVpcRouting,VpcId]'`,see:[10,2,'Network isolation and public access']},
 {id:'sg',x:21,y:136,w:194,h:56,c:'net',t:'Security group',s:'port 5439',d:'A firewall that allows the Redshift port only from the sources you list.',why:'Reference application security groups, not wide CIDR ranges.',chk:`aws ec2 describe-security-groups --group-ids sg-0abc --query 'SecurityGroups[0].IpPermissions'`,see:[10,2,'Network isolation and public access']},
 {id:'ssl',x:243,y:136,w:194,h:56,c:'net',t:'TLS',s:'require_ssl',d:'Connections are encrypted in transit when `require_ssl` is on in the parameter group.',why:'Make clients verify the certificate.',chk:`SELECT event, username, sslversion, sslcipher FROM stl_connection_log ORDER BY recordtime DESC LIMIT 3;`,see:[10,1,'Encryption in transit']},
 {id:'auth',x:465,y:136,w:194,h:56,c:'proc',t:'Database authentication',s:'user, role',d:'The database identifies the session as a user and applies its role memberships.',why:'Use roles and short-lived credentials.',chk:`SELECT current_user, session_user;`,see:[9,1,'Users, groups and superuser']},
 {id:'rbac',x:21,y:248,w:194,h:56,c:'proc',t:'Roles and grants',s:'least privilege',d:'Privileges on schemas, tables and columns are granted to roles. Row- and column-level controls can restrict further.',why:'Prefer roles to individual grants.',chk:`SELECT * FROM svv_role_grants LIMIT 10;`,see:[9,2,'Roles and RBAC']},
 {id:'enc',x:243,y:248,w:194,h:56,c:'disk',t:'Encryption at rest',s:'KMS',d:'Data blocks, backups and snapshots are encrypted with a KMS key.',why:'It must be chosen at creation (or migrated).',chk:`aws redshift describe-clusters --cluster-identifier my-cluster --query 'Clusters[0].[Encrypted,KmsKeyId]'`,see:[10,0,'Encryption at rest']},
 {id:'aud',x:465,y:248,w:194,h:56,c:'mem',t:'Audit logging',s:'connection, user, activity',d:'Connection, user and user-activity logs go to S3 or CloudWatch. System tables keep recent history, and CloudTrail records API calls.',why:'Enable it before you need it.',chk:`SELECT event, username, remotehost, recordtime FROM sys_connection_log ORDER BY recordtime DESC LIMIT 5;`,see:[10,3,'Audit logging']}],
 steps:[
 {ids:['idp','iam'],t:'1. The user signs in through SSO. IAM verifies the identity and returns temporary credentials for the database user.',w:'No long-lived password is shared.',s:'Federation, IAM policy `redshift:GetClusterCredentials`.',x:'A missing IAM permission shows as an authentication failure.',c:`aws sts get-caller-identity`},
 {ids:['vpc','sg'],t:'2. The connection reaches the endpoint only if the VPC routes to it and the security group allows the source on the Redshift port.',w:'Network rules come before any SQL.',s:'Subnets, security groups, public accessibility.',x:'A timeout means a network rule, not a database rule.',c:`nc -zv my-cluster.abc123.eu-west-1.redshift.amazonaws.com 5439`},
 {ids:['ssl'],t:'3. The client negotiates TLS. With `require_ssl` on, a client that does not use it is refused.',w:'Credentials and data are encrypted in transit.',s:'`require_ssl`, driver `sslmode`.',x:'Clients configured with `sslmode=disable`.',c:`SELECT event, recordtime, sslversion FROM sys_connection_log ORDER BY recordtime DESC LIMIT 3;`},
 {ids:['auth','rbac'],t:'4. The database authenticates the user and applies their roles and grants. Only permitted objects can be read or changed.',w:'The second layer of access control.',s:'Roles, grants, default privileges.',x:'Granting to PUBLIC or to a wide group.',c:`SELECT * FROM svv_user_grants LIMIT 10;`},
 {ids:['enc','aud'],t:'5. Data on disk and in snapshots is encrypted with KMS, and every connection and query is recorded for review.',w:'Protection at rest and evidence afterwards.',s:'KMS key, audit logging destination.',x:'Audit logging not enabled when the incident happens.',c:`SELECT username, query_text FROM sys_query_history ORDER BY start_time DESC LIMIT 3;`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Seven small maps of how something happens, step by step: creating a warehouse, a slow query, load errors, a resize, a restore, weekly maintenance and data sharing with Spectrum.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Creating a warehouse'},
{map:{title:'Create warehouse map',h:216,trace:'Build a provisioned cluster or a workgroup',
 hint:'Tap any box, or press Build a provisioned cluster or a workgroup to follow the steps of a new deployment.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'plan',x:21,y:24,w:194,h:56,c:'mem',t:'Plan',s:'model and size',d:'Choose provisioned or Serverless, node type and count or base RPUs, Region and security needs.',why:'Start small and measure. You can resize.',chk:`aws redshift describe-orderable-cluster-options --query 'OrderableClusterOptions[].NodeType' --max-items 5`,see:[1,3,'Provisioned vs Serverless']},
 {id:'iam',x:243,y:24,w:194,h:56,c:'proc',t:'IAM role',s:'for COPY and Spectrum',d:'Create an IAM role that Redshift can assume to read S3 and the Glue catalog, and attach it to the cluster or namespace.',why:'Least privilege on the buckets you use.',chk:`aws iam create-role --role-name RedshiftLoadRole --assume-role-policy-document file://trust.json`,see:[2,0,'AWS prerequisites: account, IAM and Regions']},
 {id:'net',x:465,y:24,w:194,h:56,c:'net',t:'Network',s:'subnet group, security group',d:'Create a subnet group in private subnets and a security group that allows port 5439 from approved sources.',why:'Decide public accessibility at creation.',chk:`aws redshift create-cluster-subnet-group --cluster-subnet-group-name rs-private --description private --subnet-ids subnet-0a subnet-0b`,see:[2,3,'VPC networking for Redshift']},
 {id:'create',x:21,y:136,w:194,h:56,c:'proc',t:'Create',s:'cluster or namespace',d:'Create the provisioned cluster, or the Serverless namespace and workgroup, with encryption and IAM roles.',why:'It takes a few minutes.',chk:`aws redshift create-cluster --cluster-identifier my-cluster --node-type ra3.xlplus --number-of-nodes 2 --master-username admin --manage-master-password --encrypted`,see:[2,1,'Create a provisioned cluster']},
 {id:'conn',x:243,y:136,w:194,h:56,c:'ext',t:'Connect',s:'Query Editor v2 or psql',d:'Connect with Query Editor v2, psql or a driver, with TLS.',why:'Test from where the application will run.',chk:`psql "host=<endpoint> port=5439 dbname=dev user=admin sslmode=verify-full"`,see:[2,4,'Connecting with Query Editor v2 and psql']},
 {id:'base',x:465,y:136,w:194,h:56,c:'proc',t:'Baseline',s:'users, roles, schemas',d:'Create roles, schemas, groups and a first test table, and load sample data.',why:'Do not use the admin user for applications.',chk:`CREATE ROLE analyst; CREATE SCHEMA sales; GRANT USAGE ON SCHEMA sales TO ROLE analyst;`,see:[9,2,'Roles and RBAC']}],
 steps:[
 {ids:['plan'],t:'1. Decide provisioned or Serverless, then node type and count or RPUs, and note the RPO and security requirements.',w:'These choices are cheap to make now and costly later.',s:'Workload size, budget.',x:'Starting too large and paying for idle capacity.',c:`SELECT current_database();`},
 {ids:['iam','net'],t:'2. Create the IAM role and the network objects. Attach the role to the cluster so COPY can read S3.',w:'Access to data and network exposure are set here.',s:'Role trust policy, subnet group.',x:'A role that is not attached to the cluster gives access denied on COPY.',c:`aws redshift describe-clusters --query 'Clusters[0].IamRoles'`},
 {ids:['create'],t:'3. Create the cluster or workgroup with encryption on and the managed admin password.',w:'Encryption and public access are decided here.',s:'`--encrypted`, `--manage-master-password`.',x:'Enabling public access by default.',c:`aws redshift describe-clusters --cluster-identifier my-cluster --query 'Clusters[0].ClusterStatus'`},
 {ids:['conn'],t:'4. Connect with a client and TLS. Confirm the version, the database and the encryption status.',w:'It proves the path and credentials.',s:'Endpoint, port 5439, security group.',x:'Connecting from a network the security group does not allow.',c:`SELECT version();`},
 {ids:['base'],t:'5. Create roles and schemas, grant least privilege and load a sample dataset to test.',w:'A secure baseline before data arrives.',s:'RBAC, default privileges.',x:'Leaving applications on the admin user.',c:`SELECT * FROM svv_roles;`}]}},

{h:'2. Diagnosing a slow query'},
{map:{title:'Slow query map',h:216,trace:'Find why a query is slow',
 hint:'Tap any box, or press Find why a query is slow to follow the checks from the symptom to a fix.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'sym',x:21,y:24,w:194,h:56,c:'warn',t:'Symptom',s:'which query, when',d:'A user or dashboard reports a slow query. Get the query ID or text and the time.',why:'Without the ID you are guessing.',chk:`SELECT query_id, status, elapsed_time/1000000 AS secs FROM sys_query_history ORDER BY elapsed_time DESC LIMIT 5;`,see:[11,2,'Long-running and queued queries']},
 {id:'time',x:243,y:24,w:194,h:56,c:'mem',t:'Where did the time go',s:'queue, compile, run',d:'Split the elapsed time into queue time, compile time and execution time.',why:'A long queue time is a capacity or priority problem, not a SQL problem.',chk:`SELECT query_id, queue_time, compile_time, execution_time FROM sys_query_history WHERE query_id = <id>;`,see:[11,1,'SYS monitoring views']},
 {id:'plan',x:465,y:24,w:194,h:56,c:'mem',t:'Read the plan',s:'EXPLAIN',d:'Look for large scans, nested loops, and data movement steps.',why:'Compare estimated rows with actual rows.',chk:`EXPLAIN <query>;`,see:[7,0,'Reading EXPLAIN']},
 {id:'move',x:21,y:136,w:194,h:56,c:'warn',t:'Data movement',s:'DS_BCAST, DS_DIST',d:'Large redistribution or broadcast steps usually mean a distribution key mismatch.',why:'The cure is table design, not nodes.',chk:`SELECT label, rows, bytes FROM svl_query_summary WHERE query = <id> ORDER BY bytes DESC;`,see:[5,1,'Distribution styles: AUTO, EVEN, KEY and ALL']},
 {id:'skew',x:243,y:136,w:194,h:56,c:'warn',t:'Skew or stale stats',s:'slices uneven',d:'Check `skew_rows`, `stats_off` and `unsorted` for the tables involved.',why:'Stale statistics or heavy unsorted data degrade plans.',chk:`SELECT "table", skew_rows, stats_off, unsorted FROM svv_table_info ORDER BY skew_rows DESC NULLS LAST LIMIT 10;`,see:[7,1,'Statistics and ANALYZE']},
 {id:'fix',x:465,y:136,w:194,h:56,c:'ext',t:'Fix and re-run',s:'one change at a time',d:'ANALYZE, VACUUM, change distribution or sort key, add a materialized view, or move to a better queue.',why:'Measure again with the result cache off.',chk:`SET enable_result_cache_for_session TO off;`,see:[7,6,'Materialized views']}],
 steps:[
 {ids:['sym','time'],t:'1. Identify the query and split its elapsed time into queue, compile and execution time.',w:'It tells you which layer to investigate.',s:'`SYS_QUERY_HISTORY` columns.',x:'Tuning SQL for a query that was only queued.',c:`SELECT query_id, queue_time, compile_time, execution_time FROM sys_query_history ORDER BY start_time DESC LIMIT 5;`},
 {ids:['plan','move'],t:'2. If execution is long, read EXPLAIN and the step summary. Look for large data movement and full scans.',w:'The expensive step is visible.',s:'`EXPLAIN`, `SVL_QUERY_SUMMARY`.',x:'Looking only at the final cost number.',c:`SELECT label, sum(bytes) FROM svl_query_summary WHERE query = pg_last_query_id() GROUP BY label;`},
 {ids:['skew'],t:'3. Check skew, statistics and sort status for the tables. They explain slow steps that the plan alone does not.',w:'A good plan on bad data is still slow.',s:'`SVV_TABLE_INFO`.',x:'Ignoring `stats_off` after a large load.',c:`SELECT "table", skew_rows, stats_off, unsorted FROM svv_table_info WHERE "table" IN ('sales','customers');`},
 {ids:['fix'],t:'4. Apply the smallest fix (ANALYZE, VACUUM, a key change) and re-run with the result cache off. Compare the times.',w:'The change must be proven.',s:'One change at a time.',x:'A cached result looking like an improvement.',c:`ANALYZE sales;`}]}},

{h:'3. Handling load errors'},
{map:{title:'Load error map',h:216,trace:'Recover from a failed COPY',
 hint:'Tap any box, or press Recover from a failed COPY to follow the checks from an error message to a clean load.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'err',x:21,y:24,w:194,h:56,c:'warn',t:'COPY fails',s:'error message',d:'COPY returns an error such as a data type mismatch, access denied, or "load into table failed".',why:'The message gives a short reason and a query ID.',chk:`SELECT pg_last_copy_id();`,see:[6,3,'Load errors and troubleshooting']},
 {id:'view',x:243,y:24,w:194,h:56,c:'mem',t:'Error views',s:'STL_LOAD_ERRORS',d:'The view shows the file, line, column, raw value and reason for each rejected row.',why:'Also check `SYS_LOAD_ERROR_DETAIL`.',chk:`SELECT filename, line_number, colname, raw_field_value, err_reason FROM stl_load_errors ORDER BY starttime DESC LIMIT 10;`,see:[6,3,'Load errors and troubleshooting']},
 {id:'cause',x:465,y:24,w:194,h:56,c:'proc',t:'Find the cause',s:'data, format or access',d:'Typical causes: wrong delimiter, bad dates, over-long strings, missing IAM permission, or an encoding issue.',why:'Group errors by reason to see a pattern.',chk:`SELECT err_reason, count(*) FROM stl_load_errors GROUP BY 1 ORDER BY 2 DESC LIMIT 5;`,see:[6,3,'Load errors and troubleshooting']},
 {id:'fix',x:21,y:136,w:194,h:56,c:'proc',t:'Fix the source or the options',s:'clean data or COPY options',d:'Fix the file, or adjust COPY options (DATEFORMAT, NULL AS, TRUNCATECOLUMNS, MAXERROR) knowingly.',why:'Do not hide errors with a high MAXERROR.',chk:`COPY sales FROM 's3://my-bucket/sales/' IAM_ROLE default CSV DATEFORMAT 'auto' IGNOREHEADER 1;`,see:[6,1,'COPY from Amazon S3']},
 {id:'retry',x:243,y:136,w:194,h:56,c:'proc',t:'Retry in a transaction',s:'idempotent load',d:'Reload into a staging table, check counts, then merge, so a retry cannot duplicate data.',why:'Idempotent loads are safe to repeat.',chk:`BEGIN; TRUNCATE sales_stage; COPY sales_stage FROM ...; COMMIT;`,see:[6,4,'Upsert and merge patterns']},
 {id:'chk',x:465,y:136,w:194,h:56,c:'mem',t:'Verify',s:'counts and errors',d:'Compare row counts with the source and confirm that the error view has no new rows for this load.',why:'Close the loop with evidence.',chk:`SELECT count(*) FROM sales_stage;`,see:[6,7,'Loading practical']}],
 steps:[
 {ids:['err','view'],t:'1. Take the failed COPY and read the error view for it: file, line, column and reason.',w:'It tells you exactly where to look.',s:'`STL_LOAD_ERRORS`, `pg_last_copy_id()`.',x:'Views keep a limited history. Read them promptly.',c:`SELECT * FROM stl_load_errors WHERE query = pg_last_copy_id();`},
 {ids:['cause'],t:'2. Group the errors by reason. One bad file or one type mismatch usually explains most of them.',w:'Pattern first, rows second.',s:'Source schema, encoding.',x:'Fixing rows by hand instead of the producer.',c:`SELECT err_reason, count(*) FROM stl_load_errors GROUP BY 1 ORDER BY 2 DESC;`},
 {ids:['fix'],t:'3. Correct the source or the COPY options. Use MAXERROR only for a conscious tolerance.',w:'Keep quality rules explicit.',s:'COPY options.',x:'MAXERROR 100000 masking a broken feed.',c:`COPY sales FROM 's3://my-bucket/sales/' IAM_ROLE default CSV IGNOREHEADER 1 MAXERROR 10;`},
 {ids:['retry','chk'],t:'4. Reload into staging, verify counts, then merge into the target. Check that no new errors were logged.',w:'A clean, repeatable result.',s:'Staging table, transaction.',x:'Reloading directly into the target and duplicating rows.',c:`SELECT count(*) FROM stl_load_errors WHERE query = pg_last_copy_id();`}]}},

{h:'4. Resizing a cluster'},
{map:{title:'Resize map',h:216,trace:'Choose and run a resize',
 hint:'Tap any box, or press Choose and run a resize to follow the decision between elastic and classic resize and the checks around it.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'need',x:21,y:24,w:194,h:56,c:'mem',t:'Why resize',s:'capacity or cost',d:'Queries queue, storage is nearly full, or the cluster is oversized and costly.',why:'Check design and WLM before adding nodes.',chk:`SELECT service_class, count(*) FROM stl_wlm_query WHERE queue_start_time > dateadd(hour, -1, getdate()) GROUP BY 1;`,see:[3,2,'Resize: elastic vs classic']},
 {id:'pick',x:243,y:24,w:194,h:56,c:'proc',t:'Elastic or classic',s:'size of the change',d:'Elastic resize changes node count quickly with a brief pause. Classic resize rebuilds the cluster for bigger changes, with a longer read-only period.',why:'Use elastic where the change is within its limits.',chk:`aws redshift describe-node-configuration-options --action-type resize-cluster --cluster-identifier my-cluster`,see:[3,2,'Resize: elastic vs classic']},
 {id:'snap',x:465,y:24,w:194,h:56,c:'disk',t:'Snapshot first',s:'safety',d:'Take a manual snapshot before the resize.',why:'It is the way back.',chk:`aws redshift create-cluster-snapshot --cluster-identifier my-cluster --snapshot-identifier before-resize`,see:[12,0,'Automated and manual snapshots']},
 {id:'run',x:21,y:136,w:194,h:56,c:'warn',t:'Run the resize',s:'in the window',d:'Start the resize in a quiet period. Connections drop briefly on elastic resize.',why:'Applications must reconnect.',chk:`aws redshift resize-cluster --cluster-identifier my-cluster --number-of-nodes 4 --classic false`,see:[3,2,'Resize: elastic vs classic']},
 {id:'wait',x:243,y:136,w:194,h:56,c:'mem',t:'Wait',s:'status resizing',d:'Watch the cluster status and events until it is available.',why:'Do not run heavy jobs during the resize.',chk:`aws redshift describe-clusters --cluster-identifier my-cluster --query 'Clusters[0].ClusterStatus'`,see:[3,0,'Cluster lifecycle: modify, reboot, pause and delete']},
 {id:'chk',x:465,y:136,w:194,h:56,c:'mem',t:'Check',s:'performance and skew',d:'Re-check query times, skew and queueing. New slices change data placement.',why:'Cold caches make the first queries slower.',chk:`SELECT "table", skew_rows FROM svv_table_info ORDER BY skew_rows DESC NULLS LAST LIMIT 5;`,see:[3,2,'Resize: elastic vs classic']}],
 steps:[
 {ids:['need','pick'],t:'1. Confirm the need. Then pick elastic or classic by the size of the change and whether a longer read-only window is acceptable.',w:'The right method limits downtime.',s:'Node type, target node count.',x:'Choosing classic by habit.',c:`aws redshift describe-node-configuration-options --action-type resize-cluster --cluster-identifier my-cluster`},
 {ids:['snap'],t:'2. Take a manual snapshot, and tell users about the window.',w:'A resize is a major change.',s:'Snapshot retention.',x:'No snapshot, and a problem during the resize.',c:`aws redshift create-cluster-snapshot --cluster-identifier my-cluster --snapshot-identifier before-resize`},
 {ids:['run','wait'],t:'3. Start the resize and watch the status until it returns to available. Connections reset at the cut-over.',w:'Elastic resize usually takes minutes.',s:'Status and events.',x:'Long transactions delaying the start.',c:`aws redshift describe-resize --cluster-identifier my-cluster`},
 {ids:['chk'],t:'4. Verify performance and data distribution, then update monitoring thresholds for the new size.',w:'The new size has a new baseline.',s:'WLM, alarms.',x:'Alarms still tuned for the old size.',c:`SELECT count(*) FROM stv_slices;`}]}},

{h:'5. Restoring data'},
{map:{title:'Restore map',h:216,trace:'Restore a cluster or a single table',
 hint:'Tap any box, or press Restore a cluster or a single table to follow the options and why a restore creates a new target.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'need',x:21,y:24,w:194,h:56,c:'warn',t:'What was lost',s:'object and time',d:'Identify the object and the time just before the loss: a table, a schema, or the whole warehouse.',why:'The scope decides the method.',chk:`SELECT now();`,see:[12,2,'Restore a cluster or namespace']},
 {id:'snap',x:243,y:24,w:194,h:56,c:'disk',t:'Pick the snapshot',s:'automated or manual',d:'Choose the most recent snapshot before the loss (or a recovery point in Serverless).',why:'Automated snapshots are periodic, not continuous.',chk:`aws redshift describe-cluster-snapshots --cluster-identifier my-cluster --query 'Snapshots[].[SnapshotIdentifier,SnapshotCreateTime]' --output table`,see:[12,0,'Automated and manual snapshots']},
 {id:'pick',x:465,y:24,w:194,h:56,c:'proc',t:'Whole or table',s:'cluster or one table',d:'Restore the full cluster to a new one, or restore one table from the snapshot to a new table name.',why:'Table restore is quick for a single loss.',chk:`aws redshift restore-table-from-cluster-snapshot --cluster-identifier my-cluster --snapshot-identifier snap1 --source-database-name dev --source-table-name sales --new-table-name sales_restored`,see:[12,3,'Restore a single table']},
 {id:'new',x:21,y:136,w:194,h:56,c:'proc',t:'New target',s:'never in place',d:'A cluster restore creates a new cluster with a new endpoint. A table restore creates a new table.',why:'The original is untouched.',chk:`aws redshift restore-from-cluster-snapshot --cluster-identifier my-cluster-restored --snapshot-identifier snap1`,see:[12,2,'Restore a cluster or namespace']},
 {id:'tbl',x:243,y:136,w:194,h:56,c:'mem',t:'Verify',s:'check the data',d:'Check counts and sample rows in the restored object.',why:'Make sure the loss is actually inside it.',chk:`SELECT count(*) FROM sales_restored;`,see:[12,2,'Restore a cluster or namespace']},
 {id:'cut',x:465,y:136,w:194,h:56,c:'ext',t:'Swap or copy back',s:'finish',d:'Rename the restored table into place, copy rows back, or repoint applications to the new cluster.',why:'Prefer the least disruptive way.',chk:`BEGIN; ALTER TABLE sales RENAME TO sales_old; ALTER TABLE sales_restored RENAME TO sales; COMMIT;`,see:[12,3,'Restore a single table']}],
 steps:[
 {ids:['need','snap'],t:'1. Decide what must be recovered and when it was last correct. List snapshots before that time.',w:'It sets the restore point.',s:'Snapshot schedule and retention.',x:'Retention shorter than the time to notice.',c:`aws redshift describe-cluster-snapshots --cluster-identifier my-cluster`},
 {ids:['pick','new'],t:'2. Restore only what you need: one table to a new name, or the cluster to a new cluster. Never in place.',w:'The original stays available while you verify.',s:'Table restore API, cluster restore.',x:'A table restore across incompatible names or schemas.',c:`aws redshift restore-table-from-cluster-snapshot --cluster-identifier my-cluster --snapshot-identifier snap1 --source-database-name dev --source-table-name sales --new-table-name sales_restored`},
 {ids:['tbl'],t:'3. Check the restored object: counts, dates, key columns.',w:'You prove it contains what you need.',s:'Your validation queries.',x:'Swapping without checking.',c:`SELECT min(sale_date), max(sale_date), count(*) FROM sales_restored;`},
 {ids:['cut'],t:'4. Swap the tables in a transaction, or copy rows back. For a cluster restore, repoint applications and then retire the old cluster.',w:'The change is small and reversible.',s:'Rename, `INSERT SELECT`.',x:'Forgetting dependent views and grants after a rename.',c:`ALTER TABLE sales_restored RENAME TO sales;`}]}},

{h:'6. Weekly maintenance'},
{map:{title:'Maintenance routine map',h:216,trace:'Run the weekly check',
 hint:'Tap any box, or press Run the weekly check to follow the routine that keeps tables, statistics and storage healthy.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'unsort',x:21,y:24,w:194,h:56,c:'mem',t:'Unsorted and skew',s:'table health',d:'List tables with high unsorted percent, skew or vacuum benefit.',why:'These are the first signs of degradation.',chk:`SELECT "table", unsorted, skew_rows, vacuum_sort_benefit FROM svv_table_info ORDER BY unsorted DESC NULLS LAST LIMIT 10;`,see:[7,7,'Weekly maintenance routine practical']},
 {id:'stats',x:243,y:24,w:194,h:56,c:'mem',t:'Statistics',s:'stats_off',d:'Find tables whose statistics are stale after loads.',why:'Auto analyze handles most. Check the exceptions.',chk:`SELECT "table", stats_off FROM svv_table_info WHERE stats_off > 10 ORDER BY stats_off DESC;`,see:[7,2,'Automatic analyze']},
 {id:'vac',x:465,y:24,w:194,h:56,c:'proc',t:'Vacuum',s:'if needed',d:'Run a targeted `VACUUM` on tables that auto vacuum has not caught up with.',why:'Do it off peak.',chk:`VACUUM SORT ONLY sales;`,see:[7,3,'VACUUM and automatic vacuum']},
 {id:'space',x:21,y:136,w:194,h:56,c:'disk',t:'Disk and storage',s:'headroom',d:'Check disk usage and managed storage growth and large tables.',why:'Full disk stops loads and queries.',chk:`SELECT sum(used)/sum(capacity)*100 AS pct FROM stv_partitions WHERE part_begin = 0;`,see:[11,3,'Disk space and storage monitoring']},
 {id:'adv',x:243,y:136,w:194,h:56,c:'mem',t:'Advisor',s:'recommendations',d:'Review Advisor recommendations for distribution, sort keys and encodings.',why:'Apply those with clear benefit.',chk:`SELECT * FROM svv_alter_table_recommendations;`,see:[11,5,'Advisor recommendations']},
 {id:'cost',x:465,y:136,w:194,h:56,c:'ext',t:'Cost and usage',s:'trend and limits',d:'Review usage, concurrency scaling and Serverless charges against budget.',why:'Set usage limits and alarms.',chk:`SELECT start_time, charged_seconds FROM sys_serverless_usage ORDER BY start_time DESC LIMIT 7;`,see:[3,4,'Price-performance target and usage limits']}],
 steps:[
 {ids:['unsort','stats'],t:'1. List tables by unsorted percent, skew and stale statistics. Work from the biggest and most queried.',w:'It focuses the maintenance on what matters.',s:'`SVV_TABLE_INFO`.',x:'Looking at all tables equally.',c:`SELECT "table", unsorted, stats_off, skew_rows FROM svv_table_info ORDER BY unsorted DESC NULLS LAST LIMIT 10;`},
 {ids:['vac'],t:'2. For tables auto vacuum has not caught up with, run a targeted vacuum off peak and re-check.',w:'Restores sort order and reclaims space.',s:'`VACUUM` options.',x:'A full vacuum on a very large table at peak.',c:`VACUUM DELETE ONLY sales;`},
 {ids:['space'],t:'3. Check disk and managed storage use, and the largest tables and their growth.',w:'Capacity needs lead time.',s:'`STV_PARTITIONS`, `SVV_TABLE_INFO`.',x:'Waiting for a disk full alarm.',c:`SELECT "table", size FROM svv_table_info ORDER BY size DESC LIMIT 10;`},
 {ids:['adv'],t:'4. Review Advisor recommendations and apply the safe ones in a window.',w:'Design improvements over time.',s:'Advisor, ATO.',x:'Applying everything blindly.',c:`SELECT * FROM svv_alter_table_recommendations;`},
 {ids:['cost'],t:'5. Review cost and usage, adjust limits and document changes.',w:'A routine closes with a record.',s:'Usage limits, budgets.',x:'No review, and a surprise bill.',c:`SELECT * FROM sys_serverless_usage ORDER BY start_time DESC LIMIT 7;`}]}},

{h:'7. Sharing data and querying the lake'},
{map:{title:'Data sharing and Spectrum map',h:216,trace:'Share data and query S3',
 hint:'Tap any box, or press Share data and query S3 to follow a datashare from producer to consumer, and an external table over S3.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'prod',x:21,y:24,w:194,h:56,c:'proc',t:'Producer',s:'owns the data',d:'The producer cluster or namespace holds the tables and creates a datashare of selected schemas and tables.',why:'Only the producer pays for storage.',chk:`CREATE DATASHARE sales_share;
ALTER DATASHARE sales_share ADD SCHEMA sales;
ALTER DATASHARE sales_share ADD ALL TABLES IN SCHEMA sales;`,see:[13,4,'Data sharing: producer and consumer']},
 {id:'share',x:243,y:24,w:194,h:56,c:'mem',t:'Datashare',s:'live, no copy',d:'A named set of objects other clusters can read, always showing current data.',why:'There is no copy to load or refresh.',chk:`SELECT share_name, share_owner FROM svv_datashares;`,see:[13,4,'Data sharing: producer and consumer']},
 {id:'grant',x:465,y:24,w:194,h:56,c:'proc',t:'Grant to consumer',s:'namespace or account',d:'Grant usage on the datashare to the consumer namespace (or account).',why:'Cross-account shares need authorisation.',chk:`GRANT USAGE ON DATASHARE sales_share TO NAMESPACE '11111111-2222-3333-4444-555555555555';`,see:[13,4,'Data sharing: producer and consumer']},
 {id:'cons',x:21,y:136,w:194,h:56,c:'proc',t:'Consumer',s:'creates a database',d:'The consumer creates a database from the datashare and queries it like local data, with its own compute.',why:'Workloads are isolated from the producer.',chk:`CREATE DATABASE sales_db FROM DATASHARE sales_share OF NAMESPACE '99999999-aaaa-bbbb-cccc-dddddddddddd';`,see:[13,4,'Data sharing: producer and consumer']},
 {id:'ext',x:243,y:136,w:194,h:56,c:'proc',t:'External schema',s:'Spectrum over S3',d:'Create an external schema from the Glue Data Catalog and external tables over S3 files.',why:'Partition and use Parquet for cost and speed.',chk:`CREATE EXTERNAL SCHEMA lake FROM DATA CATALOG DATABASE 'sales_lake' IAM_ROLE default;`,see:[13,0,'Redshift Spectrum and external schemas']},
 {id:'join',x:465,y:136,w:194,h:56,c:'ext',t:'Join lake and warehouse',s:'one query',d:'Join an external table with a local table in a single query.',why:'Filter early, to limit data scanned.',chk:`SELECT c.region, sum(e.amount) FROM lake.events e JOIN customers c USING (customer_id) GROUP BY 1;`,see:[13,3,'Joining lake and warehouse data']}],
 steps:[
 {ids:['prod','share'],t:'1. On the producer create the datashare and add the schemas and tables to share.',w:'Choose exactly what is exposed.',s:'`CREATE DATASHARE`, `ALTER DATASHARE`.',x:'Sharing a schema containing sensitive columns.',c:`CREATE DATASHARE sales_share;`},
 {ids:['grant'],t:'2. Grant the share to the consumer namespace or account (and authorise it for cross-account use).',w:'Access is explicit.',s:'`GRANT USAGE ON DATASHARE`.',x:'Forgetting authorisation for another account.',c:`GRANT USAGE ON DATASHARE sales_share TO NAMESPACE '11111111-2222-3333-4444-555555555555';`},
 {ids:['cons'],t:'3. On the consumer create a database from the datashare and grant its users access. Queries run on the consumer compute.',w:'No data is copied, and workloads are isolated.',s:'`CREATE DATABASE ... FROM DATASHARE`.',x:'Querying before granting local users.',c:`SELECT * FROM sales_db.sales.sales LIMIT 5;`},
 {ids:['ext'],t:'4. For lake data, create an external schema and tables over S3 with the Glue catalog and an IAM role.',w:'The lake becomes queryable in place.',s:'IAM role, Glue permissions.',x:'Unpartitioned CSV scanned in full.',c:`CREATE EXTERNAL TABLE lake.events (customer_id int, amount decimal(10,2)) PARTITIONED BY (day date) STORED AS PARQUET LOCATION 's3://my-bucket/events/';`},
 {ids:['join'],t:'5. Join external and local tables in one query. Push filters so Spectrum scans less.',w:'It combines hot and cold data.',s:'Partition pruning, file format.',x:'Joining large external data without a filter.',c:`SELECT count(*) FROM lake.events WHERE day >= '2026-10-01';`}]}},

]},

/* 1 ------------------------------------------------------- components */
{t:'Components and where to look',d:'Every moving part of a warehouse, what it does and the view or setting to check when it misbehaves.',see:[[1,0,'Cluster architecture'],[1,2,'Managed storage'],[1,3,'Provisioned vs Serverless']],b:[
{t:[['Component','Applies to','Job','Look here'],
['Leader node','Provisioned','Accepts connections, parses and plans SQL, compiles code, merges final results','`SYS_QUERY_HISTORY`, cluster status in the console'],
['Compute nodes','Provisioned','Store data (or cache it, on RA3 and RG) and run query steps in parallel','CloudWatch node metrics (`NodeID`), `SVV_TABLE_INFO`'],
['Slice','Both','A share of a node memory and disk. Rows are placed on slices by the distribution style','`skew_rows` in `SVV_TABLE_INFO`'],
['Redshift managed storage (RMS)','RA3, RG, Serverless','Durable data in S3-backed storage, hot blocks cached on local SSD','`RedshiftManagedStorageTotalCapacity`, `SVV_TABLE_INFO`'],
['Namespace','Serverless (also provisioned databases in a cluster)','Holds databases, users, encryption key, snapshots','`aws redshift-serverless get-namespace`'],
['Workgroup','Serverless','Compute: RPU capacity, VPC, security groups, endpoint, configuration parameters','`aws redshift-serverless get-workgroup`'],
['Redshift Spectrum layer','RA3, DC2','Dedicated fleet outside the cluster that scans S3 for external tables','`SVL_S3QUERY_SUMMARY`, `SYS_EXTERNAL_QUERY_DETAIL`'],
['Integrated lake engine','RG, Serverless','Runs lake queries on your own compute, with no separate Spectrum charge','`SYS_EXTERNAL_QUERY_DETAIL`'],
['Concurrency scaling cluster','Provisioned','Transient extra capacity that takes queued queries during bursts','`ConcurrencyScalingActiveClusters`, `compute_type` in `SYS_QUERY_HISTORY`'],
['Short query acceleration (SQA)','Provisioned','Fast lane for short queries predicted by a model','`short_query_accelerated` in `SYS_QUERY_HISTORY`'],
['WLM queues','Provisioned (Serverless has queues with rules)','Route, order and limit queries','`wlm_json_configuration`, `STV_WLM_SERVICE_CLASS_CONFIG`'],
['Parameter group','Provisioned','Database settings for the cluster','`describe-cluster-parameters`'],
['Subnet group and security groups','Provisioned','Network placement and firewall','`describe-clusters`, VPC console'],
['Data share','Both','Live read (and optional write) access to objects in another warehouse','`SVV_DATASHARES`, `SVV_DATASHARE_OBJECTS`'],
['Snapshot and recovery point','Provisioned (snapshot), Serverless (both)','Point-in-time backup','`describe-cluster-snapshots`, `list-recovery-points`'],
['Event subscription','Provisioned','Pushes events to SNS','`describe-event-subscriptions`']]},
{note:'On RA3 and RG the local SSD is a cache. A table can be much larger than the local disks of the nodes, so disk-full on those node types usually means temporary query space or skew, not total data size.'}]},

/* 2 ------------------------------------------------------- deployment and sizes */
{t:'Deployment options and sizes',d:'Provisioned versus Serverless, node families, node sizes and Serverless capacity limits.',see:[[1,3,'Provisioned vs Serverless'],[1,4,'Node types'],[3,3,'Serverless capacity']],b:[
{h:'Provisioned or Serverless'},
{t:[['','Provisioned','Serverless'],
['Capacity unit','Node type and node count','RPU (one RPU gives 16 GB memory)'],
['Scaling','Resize, concurrency scaling, pause and resume','Automatic within base and maximum capacity'],
['You tune','Parameter group, WLM, node count, maintenance track','Base and maximum RPU, price-performance target, usage limits, query queues with rules'],
['Billing','Per node-hour (on-demand or reserved) plus storage','Per RPU-hour, per second, with a 60-second minimum, plus storage'],
['Idle time','Billed while running; paused clusters pay for storage and backups','Not billed for compute'],
['Maintenance','Weekly window and track','Managed by the service'],
['Multi-AZ','Optional for RG and RA3','Service managed'],
['Backups','Automated and manual snapshots','Recovery points (24 hours) and snapshots']]},
{h:'Node families (provisioned)'},
{t:[['Family','Storage','Notes'],
['RG','Managed storage','Graviton-based, integrated lake query engine'],
['RA3','Managed storage','Compute and storage separate, lake queries use Spectrum'],
['DC2','Local SSD only','Legacy. AWS recommends moving to RA3, RG or Serverless']]},
{h:'Node sizes'},
{t:[['Node type','vCPU','RAM (GiB)','Default slices','Managed storage per node','Nodes at create'],
['rg.large','2','16','2','1 TB single, 8 TB multi','1, or 2 to 16'],
['rg.xlarge','4','32','2','32 TB','2 to 16'],
['rg.4xlarge','16','128','8','128 TB','2 to 32'],
['rg.12xlarge','48','384','16','128 TB','2 to 128'],
['ra3.large','2','16','2','1 TB single, 8 TB multi','1, or 2 to 16'],
['ra3.xlplus','4','32','2','4 TB single, 32 TB multi','1, or 2 to 16'],
['ra3.4xlarge','12','96','4','128 TB','2 to 32'],
['ra3.16xlarge','48','384','16','128 TB','2 to 128']]},
{h:'Serverless capacity'},
{t:[['Setting','Value'],
['Default base capacity','128 RPUs'],
['Base capacity range','4 to 512 RPUs (steps of 8 above 8). Up to 1024 in some Regions'],
['Memory','16 GB per RPU'],
['Small base capacities','4 RPUs: up to 32 TB storage. 8 to 24 RPUs: up to 128 TB. Above 128 TB needs 32 RPUs or more'],
['Price-performance target','Cost, Balanced (default) or Performance. Works best for 8 to 512 RPUs'],
['Maximum capacity','Hard cost ceiling for the workgroup']]},
{note:'Confirm node ranges and Region availability in the console or with `aws redshift describe-orderable-cluster-options`. They change over time.'}]},

/* 3 ------------------------------------------------------- logs */
{t:'Logs, audit data and where to find them',d:'Every source of evidence during an incident: system views, audit logs, CloudTrail, events and metrics.',see:[[10,3,'Audit logging'],[10,4,'CloudTrail'],[11,0,'Monitoring overview']],b:[
{t:[['Source','Records','Where','Notes'],
['System views (`SYS_*`)','Queries, loads, sessions, maintenance, usage','In the database','Always on. Short history (about a week). Work on provisioned and Serverless'],
['Connection log','Authentication, connect, disconnect, driver, IP','`SYS_CONNECTION_LOG`, and audit log files','Audit export is optional'],
['User log','Create, drop, alter, rename user','`SYS_USERLOG`, and audit log files',''],
['User activity log','Query text before it runs','Audit log files only','Needs audit logging and `enable_user_activity_logging = true`'],
['Audit logs in S3','The three logs above','S3 bucket you own','Provisioned only. SSE-S3 only, Object Lock off, bucket policy for the Redshift service principal'],
['Audit logs in CloudWatch Logs','The three logs above','Log group `/aws/redshift/cluster/<name>/<log_type>`','Recommended by AWS. The only option for Serverless'],
['AWS CloudTrail','API calls: create, modify, restore, share, get credentials','Event history, or a trail to S3','Does not contain SQL'],
['Event notifications','Maintenance, resize, snapshot, node, key, security events','SNS topic through an event subscription','Event IDs look like `REDSHIFT-EVENT-3512`'],
['CloudWatch metrics','CPU, disk, connections, queue length, health','`AWS/Redshift` and `AWS/Redshift-Serverless` namespaces','1-minute data for most metrics'],
['Console query monitoring','Query and load history with metrics','Cluster or workgroup page','Reads system tables'],
['Data API','Statement status and results','`describe-statement`, `get-statement-result`','Results kept for a limited time'],
['Long-term system history','Selected `SYS_*` views kept as Iceberg tables','S3 Tables (announced August 2026)','Read-only, query with an external schema']]},
{h:'S3 audit log object names'},
{code:`[prefix/]AWSLogs/<account-id>/redshift/<region>/<yyyy>/<mm>/<dd>/<account>_redshift_<region>_<cluster>_<logtype>_<timestamp>.gz
# logtype is connectionlog, userlog or useractivitylog`},
{note:'Audit log files lag the system views. For the most current connection and user information query `SYS_CONNECTION_LOG` and `SYS_USERLOG`.'}]},

/* 4 ------------------------------------------------------- parameters */
{t:'Important parameters',d:'The settings a DBA changes most: parameter group values on provisioned clusters and configuration parameters on Serverless.',see:[[3,1,'Parameter groups'],[10,1,'Encryption in transit'],[8,0,'WLM concepts']],b:[
{t:[['Parameter','Default','Applies to','What it does'],
['`require_ssl`','true (new default groups since January 10, 2025)','Both','Reject connections that are not SSL. Static on provisioned (reboot). On Serverless a change restarts the workgroup'],
['`enable_user_activity_logging`','false','Both','Needed for the user activity audit log'],
['`wlm_json_configuration`','`[{"auto_wlm":true}]`','Provisioned','Automatic or manual WLM, queues, priorities, rules'],
['`max_concurrency_scaling_clusters`','1','Provisioned','Upper limit of extra clusters'],
['`statement_timeout`','0 (no limit)','Both','Maximum run time in milliseconds'],
['`max_query_execution_time`','none','Serverless','Cap on run time of a query'],
['`search_path`','`$user, public`','Both','Schemas searched for unqualified names'],
['`enable_case_sensitive_identifier`','false','Both','Case-sensitive object names and SUPER attribute names'],
['`datestyle`','ISO, MDY','Both','Date output and input order'],
['`extra_float_digits`','0','Both','Digits shown for floating point values'],
['`auto_analyze`','true','Provisioned','Background statistics collection'],
['`auto_mv`','true','Both','Automated materialized views'],
['`use_fips_ssl`','false','Both','FIPS-compliant SSL, only when required'],
['`query_group`','none','Session','Label a session so WLM routes it to a queue'],
['`enable_result_cache_for_session`','on','Session','Turn the result cache on or off for your session']]},
{h:'How to change a setting'},
{code:`# Provisioned: custom parameter group (the default group cannot be edited)
aws redshift create-cluster-parameter-group --parameter-group-name prod-params --parameter-group-family redshift-2.0 --description "prod"
aws redshift modify-cluster-parameter-group --parameter-group-name prod-params --parameters ParameterName=statement_timeout,ParameterValue=3600000
aws redshift modify-cluster --cluster-identifier prod-cluster --cluster-parameter-group-name prod-params
aws redshift reboot-cluster --cluster-identifier prod-cluster      # only when status shows pending-reboot

# Serverless: configuration parameters on the workgroup
aws redshift-serverless update-workgroup --workgroup-name lab-wg --config-parameters parameterKey=require_ssl,parameterValue=true

-- Session only
SET statement_timeout TO 60000;
SHOW search_path;`},
{note:'Defaults can differ by parameter group family and over time. Read the current values with `describe-cluster-parameters` (provisioned) or `get-workgroup` (Serverless).'}]},

/* 5 ------------------------------------------------------- views */
{t:'System views and functions',d:'Which view answers which question. SYS views work on both models, SVV views are metadata, STL, STV and SVL are provisioned only.',see:[[4,6,'System catalog overview'],[11,1,'SYS monitoring views'],[11,7,'STL to SYS mapping']],b:[
{h:'Prefix guide'},
{t:[['Prefix','Meaning','Serverless'],
['`SYS_`','Current monitoring views','Yes. Use these first'],
['`SVV_`','Metadata and info views over catalog and system data','Yes, most'],
['`STL_`','Logs kept for a few days','No'],
['`STV_`','Snapshot of the current state','No'],
['`SVL_`','Views built on STL tables','No'],
['`SVCS_`','Like SVL, but include concurrency scaling clusters','No'],
['`PG_` and `information_schema`','PostgreSQL-style catalog','Yes. Not for external tables']]},
{h:'Question to view'},
{t:[['Question','View'],
['What is running or queued, and how long did it take?','`SYS_QUERY_HISTORY` (microsecond time columns)'],
['Where did one query spend its time, step by step?','`SYS_QUERY_DETAIL`'],
['Full SQL text, or the plan','`SYS_QUERY_TEXT`, `SYS_QUERY_EXPLAIN`'],
['Which COPY failed and why?','`SYS_LOAD_ERROR_DETAIL`, `SYS_LOAD_HISTORY`, `SYS_LOAD_DETAIL`'],
['UNLOAD history','`SYS_UNLOAD_HISTORY`'],
['Auto-copy jobs','`SYS_COPY_JOB`, `SYS_COPY_JOB_DETAIL`'],
['Streaming ingestion','`SYS_STREAM_SCAN_STATES`, `SYS_STREAM_SCAN_ERRORS`'],
['Who connected, from where, with which driver?','`SYS_CONNECTION_LOG`'],
['Who created or changed users?','`SYS_USERLOG`'],
['Sessions','`SYS_SESSION_HISTORY`'],
['Analyze and vacuum activity','`SYS_ANALYZE_HISTORY`, `SYS_VACUUM_HISTORY`'],
['Materialized view refreshes','`SYS_MV_REFRESH_HISTORY`'],
['Serverless RPU use and charge','`SYS_SERVERLESS_USAGE` (7 days, superuser)'],
['Table size, skew, unsorted, stats age','`SVV_TABLE_INFO` (superuser or granted)'],
['Pending design changes','`SVV_ALTER_TABLE_RECOMMENDATIONS`'],
['Tables and columns, including external','`SVV_ALL_TABLES`, `SVV_ALL_COLUMNS`, `SVV_TABLES`, `SVV_COLUMNS`'],
['External schemas and tables','`SVV_EXTERNAL_SCHEMAS`, `SVV_EXTERNAL_TABLES`, `SVV_EXTERNAL_COLUMNS`'],
['Who has which privilege?','`SVV_RELATION_PRIVILEGES`, `SVV_USER_GRANTS`, `SVV_ROLE_GRANTS`'],
['Open transactions and locks','`SVV_TRANSACTIONS`'],
['WLM queues and running state','`STV_WLM_SERVICE_CLASS_CONFIG`, `STV_WLM_QUERY_STATE`'],
['Data shares','`SVV_DATASHARES`, `SVV_DATASHARE_OBJECTS`, `SVV_DATASHARE_CONSUMERS`'],
['Federated queries sent to PostgreSQL','`SVL_FEDERATED_QUERY`'],
['Spectrum partitions (total and qualified)','`SVL_S3PARTITION`'],
['Zero-ETL integrations','`SVV_INTEGRATION`']]},
{h:'Functions and statements a DBA uses weekly'},
{code:`SELECT version();  SELECT current_user;  SELECT current_database();  SELECT GETDATE();
SELECT pg_last_query_id();                 -- id of the last query in this session
CANCEL <session_id>;                       -- stop the running statement of a session
SELECT pg_terminate_backend(<session_id>); -- end a session (last resort)
SHOW ALL;  SHOW search_path;  SHOW TABLE sales.orders;
SELECT has_table_privilege('analyst','sales.orders','select');`}]},

/* 6 ------------------------------------------------------- tools */
{t:'Command-line tools and interfaces',d:'The tools you use to manage and query Redshift, and a typical command for each.',see:[[2,4,'Query Editor v2 and psql'],[2,6,'Data API'],[2,9,'Infrastructure as code']],b:[
{t:[['Tool','Use','Typical command or note'],
['`aws redshift`','Manage provisioned clusters, snapshots, parameter groups, data shares','`aws redshift describe-clusters`'],
['`aws redshift-serverless`','Manage namespaces, workgroups, snapshots, recovery points, usage limits','`aws redshift-serverless list-workgroups`'],
['`aws redshift-data`','Run SQL with the Data API (no driver, no open connection)','`aws redshift-data execute-statement --workgroup-name wg --database dev --sql "select 1"`'],
['Query Editor v2','Browser SQL editor, charts, saved and scheduled queries','Console, uses IAM'],
['`psql`','Standard PostgreSQL client','`psql -h <endpoint> -p 5439 -d dev -U awsuser`'],
['Amazon Redshift RSQL','AWS command-line client with Redshift features','`rsql -h <endpoint> -d dev -U awsuser`'],
['JDBC and ODBC drivers','Applications and BI tools','`jdbc:redshift://<endpoint>:5439/dev`'],
['Python connector `redshift_connector`','Python applications','`redshift_connector.connect(host=..., database=...)`'],
['AWS SDK (boto3 and others)','Scripts and automation','`boto3.client("redshift-data")`'],
['AWS CloudFormation, CDK, Terraform','Infrastructure as code','`AWS::Redshift::Cluster`, `AWS::RedshiftServerless::Workgroup`'],
['AWS DMS and Schema Conversion Tool','Migration and replication into Redshift','Replication task, schema conversion'],
['`amazon-redshift-utils` (GitHub)','Admin views and scripts','Review the SQL first. Many use STL views'],
['AWS Backup','Central snapshot policies','Backup plan with a Redshift resource'],
['AWS Service Quotas','Check and raise limits','`aws service-quotas list-service-quotas --service-code redshift`']]},
{h:'Data API three-step pattern'},
{code:`ID=$(aws redshift-data execute-statement --cluster-identifier prod-cluster --database dev \\
      --db-user awsuser --sql "select count(*) from sales.orders" --query Id --output text)
aws redshift-data describe-statement --id $ID --query Status          # SUBMITTED, STARTED, FINISHED, FAILED
aws redshift-data get-statement-result --id $ID`}]},

/* 7 ------------------------------------------------------- SQL cheat sheet */
{t:'SQL command cheat sheet',d:'Redshift-specific statements you will write often, grouped by task.',see:[[6,1,'COPY'],[6,4,'MERGE'],[5,1,'Distribution styles']],b:[
{h:'Load and unload'},
{code:`COPY sales.orders FROM 's3://my-bucket/orders/2026/10/'
IAM_ROLE 'arn:aws:iam::111122223333:role/RedshiftCopyRole'
FORMAT AS PARQUET;

COPY sales.orders FROM 's3://my-bucket/orders/' IAM_ROLE '<role-arn>'
CSV IGNOREHEADER 1 GZIP REGION 'eu-west-1' MAXERROR 10;

COPY sales.orders FROM 's3://my-bucket/orders/' IAM_ROLE '<role-arn>' CSV NOLOAD;   -- validate only

UNLOAD ('SELECT * FROM sales.orders WHERE order_date < ''2026-01-01''')
TO 's3://my-bucket/archive/orders_' IAM_ROLE '<role-arn>'
FORMAT PARQUET PARTITION BY (order_date);

-- auto-copy
COPY sales.orders FROM 's3://my-bucket/orders/' IAM_ROLE '<role-arn>' CSV
JOB CREATE orders_job AUTO ON;`},
{h:'Upsert'},
{code:`MERGE INTO sales.orders t USING stage.orders s ON t.order_id = s.order_id
WHEN MATCHED THEN UPDATE SET status = s.status, amount = s.amount
WHEN NOT MATCHED THEN INSERT VALUES (s.order_id, s.customer_id, s.order_date, s.status, s.amount);`},
{h:'Table design'},
{code:`CREATE TABLE sales.orders (
  order_id bigint NOT NULL, customer_id bigint, order_date date, status varchar(20), amount decimal(12,2),
  PRIMARY KEY (order_id)                         -- informational, not enforced
) DISTSTYLE KEY DISTKEY (customer_id) COMPOUND SORTKEY (order_date);

CREATE TABLE dim_store (...) DISTSTYLE ALL;
CREATE TABLE t2 (LIKE t1);   CREATE TABLE t3 AS SELECT * FROM t1;
CREATE TEMP TABLE scratch (...);

ALTER TABLE sales.orders ALTER DISTSTYLE KEY DISTKEY customer_id;
ALTER TABLE sales.orders ALTER SORTKEY (order_date, status);
ALTER TABLE sales.orders ALTER DISTSTYLE AUTO;   ALTER TABLE sales.orders ALTER SORTKEY AUTO;`},
{h:'Maintenance and plans'},
{code:`ANALYZE sales.orders;   ANALYZE sales.orders PREDICATE COLUMNS;
VACUUM sales.orders;    VACUUM SORT ONLY sales.orders;   VACUUM DELETE ONLY sales.orders;
EXPLAIN SELECT ...;
CREATE MATERIALIZED VIEW mv_daily AUTO REFRESH YES AS SELECT order_date, sum(amount) FROM sales.orders GROUP BY 1;
REFRESH MATERIALIZED VIEW mv_daily;`},
{h:'Access control'},
{code:`CREATE ROLE analyst;   GRANT USAGE ON SCHEMA sales TO ROLE analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA sales TO ROLE analyst;   GRANT ROLE analyst TO USER asha;
ALTER DEFAULT PRIVILEGES FOR USER etl_owner IN SCHEMA sales GRANT SELECT ON TABLES TO ROLE analyst;
GRANT ASSUMEROLE ON '<role-arn>' TO ROLE etl_runner FOR COPY;
GRANT SELECT (name, region) ON sales.customers TO ROLE analyst;     -- column level`},
{h:'Lake, sharing and federation'},
{code:`CREATE EXTERNAL SCHEMA lake FROM DATA CATALOG DATABASE 'salesdb' IAM_ROLE '<role-arn>' CREATE EXTERNAL DATABASE IF NOT EXISTS;
CREATE EXTERNAL TABLE lake.events (id bigint, payload varchar(2000)) PARTITIONED BY (d date) STORED AS PARQUET LOCATION 's3://bucket/events/';

CREATE DATASHARE sales_share;  ALTER DATASHARE sales_share ADD SCHEMA sales;  ALTER DATASHARE sales_share ADD ALL TABLES IN SCHEMA sales;
GRANT USAGE ON DATASHARE sales_share TO NAMESPACE '<consumer-namespace-guid>';
CREATE DATABASE sales_db FROM DATASHARE sales_share OF NAMESPACE '<producer-namespace-guid>';

CREATE EXTERNAL SCHEMA pg FROM POSTGRES DATABASE 'orders' SCHEMA 'public' URI '<host>' PORT 5432 IAM_ROLE '<role-arn>' SECRET_ARN '<secret-arn>';`}]},

/* 8 ------------------------------------------------------- decision tables */
{t:'Decision tables',d:'Which option to choose: deployment, resize, table design, loading, querying data in place, recovery and workload control.',see:[[3,2,'Resize'],[5,1,'Distribution'],[12,7,'RPO and RTO']],b:[
{h:'How to resize or change capacity'},
{t:[['Need','Use','Notes'],
['Add or remove a few nodes quickly','Elastic resize','Minutes, short pause, limited change ratio'],
['Large change or a configuration elastic resize cannot do','Classic resize','Slower, read-only while data is copied'],
['Switch node family, test, or recover','Snapshot restore into a new cluster','New endpoint, plan the cutover'],
['Handle bursts of queued queries','Concurrency scaling','Costs per second after free credits. Set a usage limit'],
['Spiky or unpredictable demand','Serverless','Set base and maximum RPU']]},
{h:'Distribution style'},
{t:[['Table','Style'],
['Large fact joined often to one big table','KEY on the join column (both tables the same key)'],
['Small, rarely changing dimension','ALL'],
['No dominant join, or key would skew','EVEN'],
['Unsure, or workload changes','AUTO and let automatic table optimization decide']]},
{h:'Sort key'},
{t:[['Pattern','Choice'],
['Date or timestamp range filters','Compound, date first'],
['Several equally important filter columns','Compound with the most selective first. Interleaved is rarely worth the upkeep'],
['No clear pattern','AUTO']]},
{h:'How to load data'},
{t:[['Situation','Method'],
['Batch files in S3','`COPY` from many compressed files, preferably Parquet'],
['Files arrive all day','Auto-copy (COPY JOB)'],
['Events from Kinesis or MSK','Streaming ingestion with a materialized view'],
['Operational database data, little engineering','Zero-ETL integration (supported sources)'],
['Small lookup from RDS or Aurora','Federated query and CTAS'],
['Database migration with ongoing changes','AWS DMS'],
['A few rows','`INSERT`. Never row by row for bulk data']]},
{h:'Query data without loading it'},
{t:[['Data lives in','Use','Cost point'],
['S3 files','External schema (Spectrum on RA3, integrated engine on RG and Serverless)','Per TB scanned on RA3, own compute on RG and Serverless'],
['Another Redshift warehouse','Data sharing','Producer storage, consumer compute'],
['RDS or Aurora PostgreSQL or MySQL','Federated query','Load on the source database'],
['Aurora, RDS, DynamoDB or an application','Zero-ETL, then query locally','Replication managed by AWS']]},
{h:'Recovery'},
{t:[['What happened','Use'],
['Bad change in the last day (Serverless)','Restore a recovery point (about 30-minute spacing, kept 24 hours)'],
['Bad change (provisioned)','Restore a snapshot into a new cluster, or restore one table'],
['One table damaged','Table restore from a snapshot (provisioned) or recovery point or snapshot (Serverless)'],
['Availability Zone failure','Multi-AZ (RG, RA3), or AZ relocation'],
['Region failure','Cross-Region snapshot copy and a tested restore plan'],
['Account compromise','Snapshots copied or shared to a separate backup account with a customer managed key']]},
{h:'Workload control (provisioned)'},
{t:[['Need','Use'],
['Default, general case','Automatic WLM with queue priorities'],
['Stop a runaway query','Query monitoring rule (log, then abort)'],
['Short dashboard queries stuck behind long ones','SQA, or separate queue with higher priority'],
['A workload needs guaranteed resources','Separate warehouse with data sharing'],
['Fixed concurrency and memory per queue','Manual WLM (up to 8 queues, 50 slots in total)']]}]},

/* 9 ------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, the likely cause and the fix, grouped by area.',see:[[11,6,'Troubleshooting practical'],[8,8,'Queue-time diagnostics']],b:[
{h:'Connection and access'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Connection times out','Security group, subnet route, public accessibility, port','Port not open to your source, private warehouse, no VPN','Allow your source on the Redshift port, use VPN or Query Editor v2'],
['`no pg_hba.conf entry ... SSL off`','Client SSL mode, `require_ssl`','Client not using SSL','Use `sslmode=require` or `verify-full`'],
['Password authentication failed','`SYS_CONNECTION_LOG`','Wrong or expired password, wrong user','Reset password, check `VALID UNTIL`, use IAM or SSO'],
['Permission denied for relation','`SVV_RELATION_PRIVILEGES`, role membership','Missing `USAGE` on schema or `SELECT` on table','Grant through a role'],
['Too many connections','`DatabaseConnections`, per-user limits','Leaking connections, no pooling','Pool, set `CONNECTION LIMIT`, close idle sessions'],
['Cannot reach from laptop to private warehouse','Network path','Not publicly accessible','Query Editor v2, Data API, bastion or VPN']]},
{h:'Performance'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Dashboard slow','`queue_time` vs `execution_time` in `SYS_QUERY_HISTORY`','Queueing, or heavy scan','Queue: WLM, SQA, capacity. Scan: design and plan'],
['Query slower every day','`stats_off`, `unsorted`, row growth in `SVV_TABLE_INFO`','Stale statistics, unsorted data','`ANALYZE`, `VACUUM SORT`, check automatic maintenance'],
['One slice does all the work','`skew_rows`','Poor distribution key','Change DISTKEY or use EVEN or AUTO'],
['Huge data movement in plan','`EXPLAIN` shows `DS_DIST_BOTH` or `DS_BCAST_INNER`','Join keys not co-located','Distribute on the join key, make small dimensions ALL'],
['Spilling to disk','`spilled_block_*` in `SYS_QUERY_DETAIL`','Large sort or hash, wide VARCHAR','Filter early, narrow columns, split work, more capacity'],
['Waiting on a lock','`lock_wait_time`, `SVV_TRANSACTIONS`','Long or idle transaction','Commit or cancel the blocker, shorten transactions'],
['First run slow, later runs fast','`compile_time`','Compile of a new query shape','Normal. Reuse query shapes'],
['Serverless slow at start of day','`SYS_SERVERLESS_USAGE`','Low base capacity, cold cache','Raise base capacity, review price-performance target']]},
{h:'Loading'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['COPY fails','`SYS_LOAD_ERROR_DETAIL`','Bad delimiter, extra column, bad date, too-long string','Fix data or options. Use `NOLOAD` to validate'],
['COPY access denied','IAM role on the warehouse, bucket policy, KMS','Missing S3 or KMS permission','Grant `s3:GetObject`, `s3:ListBucket`, `kms:Decrypt`'],
['COPY slow','Number of files vs slices','One large file','Split into several similar-size compressed files'],
['Duplicate rows','Load logic','Keys are not enforced','Use `MERGE` or delete-then-insert in a transaction'],
['Auto-copy not loading','`SYS_COPY_JOB`, S3 event integration','Event integration or role problem','Check job status and the S3 event setup']]},
{h:'Storage and cost'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Disk full','`PercentageDiskSpaceUsed`, `SVV_TABLE_INFO`, running queries','Temp spill, skew, dead rows','Cancel the query, vacuum, drop scratch tables, fix skew'],
['Bill suddenly higher','Cost Explorer, `SYS_SERVERLESS_USAGE`, concurrency scaling seconds','More RPUs, concurrency scaling, manual snapshots, cross-Region copy','Max capacity, usage limits, delete old snapshots'],
['Paused cluster still costs','Billing dimensions','Storage, backups and reserved nodes still billed','Delete snapshots, review reservations'],
['Many tiny blocks, big table size','`SVV_TABLE_INFO`','Many small tables or loads','Combine small loads, use CTAS']]},
{h:'Availability and recovery'},
{t:[['Symptom','Check first','Likely cause','Fix'],
['Cluster `inaccessible-kms-key`','KMS key status and policy','Key disabled or access removed','Restore the key within 14 days'],
['Snapshot copy not arriving','Events, copy grant, destination key','Missing grant or key permission','Fix the grant and key policy'],
['Restored cluster slow at first','Restore progress','Blocks stream in on demand','Wait for background load, warm with key queries'],
['Applications fail during maintenance','Maintenance window, events','Short outage','Retry logic, quiet window, maintenance track']]}]},

/* 10 ------------------------------------------------------- errors */
{t:'Common error messages',d:'Messages you will see most often, with the SQLSTATE where it is stable, the usual cause and the fix. Wording can vary slightly by version.',b:[
{t:[['Message (shortened)','SQLSTATE','Usual cause','Fix'],
['`permission denied for relation x`','42501','Missing table privilege','`GRANT SELECT ON x TO ROLE r`'],
['`permission denied for schema x`','42501','Missing `USAGE` on schema','`GRANT USAGE ON SCHEMA x TO ROLE r`'],
['`relation "x" does not exist`','42P01','Wrong name, schema or search_path, or object dropped','Qualify the name, check `search_path`'],
['`relation "x" already exists`','42P07','Create without `IF NOT EXISTS`','Drop first or use `IF NOT EXISTS`'],
['`column "x" does not exist`','42703','Typo, case sensitivity setting','Check names and `enable_case_sensitive_identifier`'],
['`syntax error at or near "..."`','42601','SQL not valid for Redshift','Check the Redshift SQL reference for the command'],
['`Disk Full`','53100','Temp or table space exhausted on a node','Cancel the query, vacuum, drop scratch data, fix skew'],
['`Load into table ... failed. Check stl_load_errors`','XX000','COPY row or file error','Read `SYS_LOAD_ERROR_DETAIL`'],
['`S3ServiceException: Access Denied, Status 403`','XX000','IAM role, bucket policy or KMS key','Allow `s3:GetObject`, `s3:ListBucket`, `kms:Decrypt`'],
['`String length exceeds DDL length`','XX000','Value longer than the VARCHAR','Widen the column or `TRUNCATECOLUMNS`'],
['`Invalid digit, Value ..., Type: Integer`','XX000','Non-numeric data in a numeric column','Clean the data, check delimiter and column order'],
['`Delimiter not found`','XX000','Wrong delimiter or format option','Fix `DELIMITER`, `CSV` or `FORMAT`'],
['`Value too long for character type`','22001','Insert of a long string','Widen the column'],
['`Serializable isolation violation on table - nnn` (1023)','40001','Two transactions conflict under serializable isolation','Retry. Use snapshot isolation where suitable, shorten transactions'],
['`deadlock detected`','40P01','Two transactions wait on each other','Retry, access tables in the same order'],
['`Query ... cancelled on user request`','57014','`CANCEL`, `statement_timeout` or a monitoring rule','Check the timeout and rule settings'],
['`CREATE EXTERNAL TABLE cannot run inside a transaction block`','25001','External DDL in `BEGIN`','Run outside a transaction'],
['`Spectrum Scan Error`','XX000','Bad file, schema mismatch, access problem','Check file format, columns and the S3 permissions'],
['`password authentication failed for user`','28P01','Wrong password','Reset, or use IAM authentication'],
['`no pg_hba.conf entry for host ..., SSL off`','28000','Client connected without SSL','Enable SSL on the client'],
['`database "x" does not exist`','3D000','Wrong database name in the connection','Check the database name'],
['`Cannot insert a NULL value into column`','23502','NOT NULL column received NULL','Fix source data or defaults']]},
{note:'Many Redshift errors use SQLSTATE `XX000` plus a specific message, so match on the text and the detail line. Load errors give the file, line and column in `SYS_LOAD_ERROR_DETAIL`.'}]},

/* 11 ------------------------------------------------------- health SQL */
{t:'Health-check SQL pack',d:'Paste-ready queries for the daily and weekly checks. Time columns in SYS views are microseconds.',see:[[7,7,'Weekly maintenance routine'],[11,2,'Long-running and queued queries']],b:[
{h:'Daily'},
{code:`-- Running and queued now
SELECT query_id, username, status, start_time, elapsed_time/1000000.0 AS secs, queue_time/1000000.0 AS queue_secs, LEFT(query_text,80) AS sql
FROM sys_query_history WHERE status IN ('planning','queued','running','returning') ORDER BY start_time;

-- Failed in the last 24 hours
SELECT query_id, username, error_message, LEFT(query_text,80) AS sql
FROM sys_query_history WHERE status = 'failed' AND start_time > DATEADD(hour,-24,GETDATE()) ORDER BY start_time DESC;

-- Slowest in the last 24 hours, split into where the time went
SELECT query_id, username, elapsed_time/1e6 AS total_s, queue_time/1e6 AS queue_s, lock_wait_time/1e6 AS lock_s,
       compile_time/1e6 AS compile_s, execution_time/1e6 AS exec_s, LEFT(query_text,60) AS sql
FROM sys_query_history WHERE start_time > DATEADD(hour,-24,GETDATE()) ORDER BY elapsed_time DESC LIMIT 20;

-- Failed loads
SELECT * FROM sys_load_error_detail ORDER BY 1 DESC LIMIT 20;`},
{h:'Weekly: table health'},
{code:`-- Stale statistics, unsorted data, skew
SELECT "schema", "table", tbl_rows, size AS mb, unsorted, stats_off, skew_rows, diststyle, vacuum_sort_benefit
FROM svv_table_info
WHERE stats_off > 10 OR unsorted > 20 OR skew_rows > 2
ORDER BY size DESC LIMIT 30;

-- Biggest tables and dead rows
SELECT "schema", "table", size AS mb, tbl_rows, estimated_visible_rows, tbl_rows - estimated_visible_rows AS dead_rows
FROM svv_table_info ORDER BY size DESC LIMIT 20;

-- Pending automatic table optimization suggestions
SELECT * FROM svv_alter_table_recommendations;`},
{h:'Weekly: workload'},
{code:`-- Queue wait by day (microseconds to seconds)
SELECT DATE_TRUNC('day', start_time) AS day, COUNT(*) AS queries,
       AVG(queue_time)/1e6 AS avg_queue_s, PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY queue_time)/1e6 AS p90_queue_s
FROM sys_query_history WHERE start_time > DATEADD(day,-7,GETDATE()) GROUP BY 1 ORDER BY 1;

-- Repeated query shapes that cost the most
SELECT generic_query_hash, COUNT(*) AS runs, SUM(elapsed_time)/1e6 AS total_s, AVG(elapsed_time)/1e6 AS avg_s
FROM sys_query_history WHERE start_time > DATEADD(day,-7,GETDATE()) GROUP BY 1 ORDER BY total_s DESC LIMIT 20;

-- Top users by time
SELECT username, COUNT(*) AS queries, SUM(elapsed_time)/1e6 AS total_s
FROM sys_query_history WHERE start_time > DATEADD(day,-7,GETDATE()) GROUP BY 1 ORDER BY total_s DESC LIMIT 10;`},
{h:'Serverless cost'},
{code:`SELECT TRUNC(start_time) AS day, SUM(charged_seconds)/3600.0 AS rpu_hours
FROM sys_serverless_usage GROUP BY 1 ORDER BY 1;`},
{h:'Security review'},
{code:`SELECT usename, usesuper, usecreatedb FROM pg_user WHERE usesuper OR usecreatedb;       -- superusers and db creators
SELECT * FROM svv_role_grants ORDER BY 1;
SELECT * FROM sys_userlog ORDER BY 1 DESC LIMIT 20;                                        -- recent user changes
SELECT * FROM sys_connection_log ORDER BY 2 DESC LIMIT 20;                                 -- recent connections`}]},

/* 12 ------------------------------------------------------- naming decoder */
{t:'Naming decoder',d:'How to read endpoints, ARNs, identifiers, system prefixes, plan labels and event IDs.',b:[
{h:'Endpoints and ARNs'},
{t:[['Item','Format','Example'],
['Provisioned endpoint','`<cluster>.<id>.<region>.redshift.amazonaws.com:5439`','`prod.abc123xyz.eu-west-1.redshift.amazonaws.com:5439`'],
['Serverless endpoint','`<workgroup>.<account-id>.<region>.redshift-serverless.amazonaws.com:5439`','`lab-wg.111122223333.eu-west-1.redshift-serverless.amazonaws.com:5439`'],
['JDBC URL','`jdbc:redshift://<endpoint>:5439/<database>`',''],
['Cluster ARN','`arn:aws:redshift:<region>:<account>:cluster:<name>`',''],
['Serverless ARN','`arn:aws:redshift-serverless:<region>:<account>:workgroup/<id>` and `namespace/<id>`',''],
['Snapshot (automated)','`rs:<cluster>-<yyyy-mm-dd-hh-mm-ss>`','`rs:prod-2026-10-09-04-02-11`'],
['Serverless recovery point','UUID','Use `list-recovery-points`'],
['Parameter group family','`redshift-2.0`','Default group: `default.redshift-2.0`'],
['Audit log group','`/aws/redshift/cluster/<name>/<log_type>`','`.../connectionlog`'],
['CloudWatch namespaces','`AWS/Redshift`, `AWS/Redshift-Serverless`','']]},
{h:'Database user names for IAM'},
{t:[['Prefix','Identity'],
['`IAM:name`','An IAM user'],
['`IAMR:rolename`','An IAM role session'],
['`awsidc:user`','Common namespace for IAM Identity Center users (check the namespace you set)']]},
{h:'System table families'},
{t:[['Prefix','Meaning'],
['STL','System log, history for a few days (provisioned)'],
['STV','System virtual, current state (provisioned)'],
['SVV','System views over catalog and metadata'],
['SVL','Views over STL'],
['SVCS','Like SVL, includes concurrency scaling clusters'],
['SYS','Current monitoring views for both models']]},
{h:'WLM service classes'},
{t:[['Class','Meaning'],
['1 to 4','Reserved for the system'],
['5','Superuser queue'],
['6 to 13','Manual WLM user queues'],
['14','Short query acceleration'],
['15','Maintenance (for example vacuum)'],
['100 to 107','Automatic WLM user queues']]},
{h:'Plan labels'},
{t:[['Label','Meaning'],
['`DS_DIST_NONE`','No data movement. Join is local'],
['`DS_DIST_ALL_NONE`','Inner table is ALL, so no movement'],
['`DS_BCAST_INNER`','Inner table is broadcast to every node'],
['`DS_DIST_INNER`','Inner table is redistributed'],
['`DS_DIST_OUTER`','Outer table is redistributed'],
['`DS_DIST_ALL_INNER`','Inner ALL table redistributed to one slice'],
['`DS_DIST_BOTH`','Both sides redistributed (usually costly)'],
['`S3 Seq Scan`, `S3 HashAggregate`','Work done in the lake layer for external tables']]},
{h:'Event IDs'},
{t:[['Range','Category'],
['1000 to 1999','Configuration'],
['2000 to 2999','Management and pending maintenance'],
['3000 to 3999','Monitoring (resize, restore, hardware, snapshot copy, Multi-AZ)'],
['4000 to 4999','Security (credentials, security groups, KMS)']]},
{note:'The event ID format is `REDSHIFT-EVENT-<number>`. Use the severity (INFO or ERROR) and the category in your subscription filter.'}]},

/* 13 ------------------------------------------------------- security checklist */
{t:'Security checklist',d:'Controls to confirm before go-live and each quarter, with how to check each one.',see:[[10,5,'Security checklist'],[9,0,'IAM vs database permissions']],b:[
{t:[['Area','Control','How to check'],
['Network','Private subnets, not publicly accessible','`describe-clusters` `PubliclyAccessible`; `get-workgroup`'],
['Network','Security group allows only named sources on the Redshift port','`aws ec2 describe-security-groups`'],
['Network','Enhanced VPC routing and S3 endpoint if traffic must stay private','`describe-clusters` `EnhancedVpcRouting`'],
['Transit','`require_ssl` true, clients on `verify-full`','Parameter group, `SYS_CONNECTION_LOG`'],
['Rest','Encryption on, key policy reviewed, deletion protected','`describe-clusters` `Encrypted`, `KmsKeyId`'],
['Rest','Cross-Region copy uses a grant on a key in the destination Region','`describe-snapshot-copy-grants`'],
['Identity','No application uses the admin or a superuser','`pg_user` where `usesuper`'],
['Identity','People use IAM or SSO, not passwords','`SYS_CONNECTION_LOG` authentication method'],
['Identity','Admin password managed in Secrets Manager','`describe-clusters` `MasterPasswordSecretArn`'],
['Access','Roles with least privilege, no grants to PUBLIC beyond defaults','`SVV_ROLE_GRANTS`, `SVV_RELATION_PRIVILEGES`'],
['Access','`ASSUMEROLE` limits who can use S3 roles','Review grants'],
['Data','Row-level security and masking for regulated columns','RLS and masking policy views'],
['Audit','Audit logs on, user activity log enabled, retention set','`describe-logging-status`'],
['Audit','CloudTrail trail on, protected, alarmed for risky Redshift calls','CloudTrail console'],
['Audit','Event subscription to the security team','`describe-event-subscriptions`'],
['Recovery','Snapshots, retention and cross-Region copy match RPO and RTO','`describe-cluster-snapshots`'],
['Governance','AWS Config or Security Hub controls for Redshift','Security Hub findings']]},
{code:`aws redshift describe-clusters --cluster-identifier prod \\
  --query "Clusters[0].{Public:PubliclyAccessible,Encrypted:Encrypted,Key:KmsKeyId,Vpc:VpcId,Enhanced:EnhancedVpcRouting}"
aws redshift describe-logging-status --cluster-identifier prod
aws redshift describe-cluster-parameters --parameter-group-name prod-params \\
  --query "Parameters[?ParameterName=='require_ssl' || ParameterName=='enable_user_activity_logging']"`}]},

/* 14 ------------------------------------------------------- quotas */
{t:'Quotas and limits',d:'Default limits that shape designs. Confirm the current value with Service Quotas.',see:[[3,9,'Quotas and limits']],b:[
{h:'Account and cluster (per Region)'},
{t:[['Quota','Default','Adjustable'],
['Nodes across all clusters','200','Yes'],
['Nodes in one RA3, RG or DC2 cluster','128','Yes'],
['Reserved nodes','200','Yes'],
['Parameter groups','20','No'],
['Subnet groups / subnets per group','50 / 20','Yes'],
['Security groups','20','Yes'],
['Manual snapshots','700','Yes'],
['IAM roles per cluster','50','No'],
['Concurrency scaling clusters','10','Yes'],
['Event subscriptions','20','Yes'],
['Redshift-managed VPC endpoints per cluster','30','Yes']]},
{h:'Database design'},
{t:[['Limit','Provisioned','Serverless'],
['Databases','60 per cluster','100 per namespace'],
['Schemas per database','9,900','9,900'],
['Tables','9,900 to 200,000 by node type','200,000 per namespace'],
['Stored procedures per database','10,000','10,000'],
['Roles','1,000 (adjustable)','1,000 (adjustable)'],
['Row size in COPY','64 MB','64 MB'],
['Maximum connections','2,000 (RA3, RG)','2,000'],
['Idle session timeout','4 hours','1 hour'],
['Idle transaction timeout','6 hours','6 hours'],
['Longest running query','`statement_timeout`','24 hours']]},
{h:'Serverless'},
{t:[['Limit','Value'],
['Namespaces and workgroups','25 each (adjustable)'],
['Managed storage at 4 RPU base','32 TB'],
['Managed storage at 8 to 24 RPU base','128 TB'],
['Total base RPUs in the account','Greater of 3,200 or 1.5 x the largest aggregate base in six months']]},
{h:'Snapshots and logs'},
{t:[['Item','Value'],
['Automated snapshot default','About every 8 hours or 5 GB per node of change; 1 day retention'],
['Automated retention on RA3 and RG','1 to 35 days, cannot be disabled'],
['Custom schedule frequency','Once an hour at most, once a day at least'],
['Cross-Region copy destinations','One at a time. Copied automated snapshots default to 7 days'],
['Serverless recovery points','About every 30 minutes, kept 24 hours'],
['Audit log S3 prefix','Up to 512 characters'],
['SYS views history','About 7 days']]},
{code:`aws service-quotas list-service-quotas --service-code redshift
aws service-quotas list-service-quotas --service-code redshift-serverless`},
{note:'Limits marked No are hard. If you reach one, such as the table count or 2,000 connections, change the design: larger node type, fewer tables, pooling or more warehouses.'}]},

/* 15 ------------------------------------------------------- cost */
{t:'Cost cheat sheet',d:'What Redshift bills for, what you control and which guard rails to set. Always check the pricing page for your Region.',see:[[3,6,'Pricing basics'],[3,10,'Cost governance']],b:[
{t:[['Component','Billed','You control it with'],
['Provisioned compute','Per node-hour, on demand or reserved','Node type and count, pause and resume, reserved nodes'],
['Serverless compute','Per RPU-hour, per second, 60-second minimum','Base and maximum capacity, usage limits, price-performance target'],
['Managed storage','Per GB-month','Dropping old data, unloading cold data to S3'],
['Concurrency scaling','Per second after free credits','`max_concurrency_scaling_clusters`, usage limit'],
['Spectrum (RA3)','Per TB scanned','Parquet, partitions, usage limit'],
['Snapshots','Manual snapshots and storage over the free allowance','Retention, deleting old ones, copy only what you need'],
['Cross-Region data','Transfer for data sharing and snapshot copy','Keep consumers near the data, limit copy'],
['Zero-ETL and Glue','Under the related services','Check each service pricing']]},
{h:'Guard rails'},
{ul:['Tag every warehouse with owner, environment and cost centre.','Set AWS Budgets with alerts.','Serverless: maximum capacity and a usage limit with `emit-metric` or `log`.','Provisioned: schedule pause and resume for non-production, buy reserved nodes only after sizing.','Review manual snapshots and snapshots of deleted clusters monthly.']},
{code:`# Serverless usage limit: alert after 500 RPU-hours in a month
aws redshift-serverless create-usage-limit --resource-arn <workgroup-arn> --usage-type serverless-compute \\
  --amount 500 --period monthly --breach-action emit-metric

# Provisioned: limit concurrency scaling minutes per month
aws redshift create-usage-limit --cluster-identifier prod --feature-type concurrency-scaling \\
  --limit-type time --amount 600 --period monthly --breach-action log`}]},

/* 16 ------------------------------------------------------- changes */
{t:'Changes and retirements to watch',d:'Behaviour changes and retirements that affect designs and runbooks. Dates come from AWS announcements, so confirm for your account.',b:[
{t:[['Item','What changed','When','What to do'],
['`require_ssl` default','New default parameter groups require SSL','January 10, 2025','Check older custom groups and old clients'],
['Default isolation','Snapshot isolation is the default','Documented as current','Review code that assumed serializable behaviour'],
['DC2 node types','AWS announced deprecation and recommends RA3, RG or Serverless','See AWS Health notices for your account','Plan upgrade (elastic resize or restore)'],
['Python UDFs','AWS states Redshift will no longer support Python UDFs after June 30, 2026, enforced in phases','June 30, 2026','Move to SQL UDFs, stored procedures or Lambda UDFs'],
['Automatic refresh of materialized views','Runs as a normal user query on the current track','From patch 198 (February 27, 2026)','Check refresh timing and queue use'],
['Multi-warehouse writes through data sharing','Consumers can write to shared objects when the producer allows','Needs patch 186 or later on the provisioned track version noted in the docs','Check version, grant write permissions deliberately'],
['Serverless restore keeps integrations','Zero-ETL and S3 event integrations are kept when restoring into the same namespace','July 13, 2026','Test your restore runbook. Other restore types still recreate them'],
['Long-term system table retention','SYS views to S3 Tables as Iceberg','August 20, 2026','Enable for audit history if needed'],
['Iceberg support','Iceberg versions 1, 2 and 3 can be queried. Iceberg materialized views announced','Ongoing, announcement October 2026','Read the current limits before design'],
['CloudHSM Classic','Only CloudHSM Classic is supported for HSM keys and it is closed to new customers. HSM is not supported on RA3, RG or DC2','Ongoing','Use KMS'],
['Interleaved sort keys','Converted to compound when a provisioned snapshot is restored to Serverless','Ongoing','Avoid interleaved keys in new designs']]},
{note:'This page is a starting list. Always read the AWS What is New feed and your AWS Health Dashboard for the notices that apply to your account and Region.'}]}

]};
