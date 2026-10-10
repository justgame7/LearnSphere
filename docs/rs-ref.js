/* LearnSphere - Amazon Redshift Quick Reference (cheat sheet).
   window.QREF['rs'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Blocks: {h}, {p}, {t:[header,...rows]}, {code}, {note}, {ul}, {flow}. Lazy-loaded through REFLAZY in index.html.
   Pages that only make sense for a self-managed database server (data directory, install locations, OS settings) are left out because Redshift is a managed service.
   Facts follow the AWS documentation at the time of writing. Quotas, prices and dates change, so confirm in the console or the docs. */
window.QREF=window.QREF||{};
window.QREF.rs={title:'Amazon Redshift Quick Reference',blurb:'Components, logs, parameters, views, tools, limits and fixes on one page each. Use the search box to filter any page.',hint:'wlm or require_ssl',pages:[

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
