/* LearnSphere - Amazon Redshift, Section 14: Data Lake, Data Sharing & Integrations.
   Lectures 0-5 are core, 6-11 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const lake=R.dg(700,250,[
[10,10,680,230,'One SQL query over warehouse and lake',1],
[30,60,150,60,'BI tool or|SQL client',0],[250,60,170,60,'Redshift|local tables and|external schema',2],[480,45,190,40,'S3 data lake|(Parquet, Iceberg)',0],[480,100,190,40,'Glue Data Catalog|table definitions',0],
[250,155,170,50,'Spectrum layer (RA3, DC2) or|built-in lake engine (RG, Serverless)',0]],
[[180,90,250,90],[420,80,480,65],[420,100,480,120],[335,120,335,155]]);

const share=R.dg(700,260,[
[10,10,300,240,'Producer warehouse',1],[390,10,300,240,'Consumer warehouses',1],
[30,50,260,45,'Tables, views, schemas|(the only copy of the data)',2],[30,110,260,45,'Datashare: a list of objects',0],[30,170,260,45,'GRANT USAGE to consumers',0],
[410,50,260,45,'BI warehouse|(its own compute)',0],[410,110,260,45,'Data science warehouse|(its own compute)',0],[410,170,260,45,'Another account or Region',0]],
[[290,132,410,72],[290,132,410,132],[290,132,410,192]]);

/* ================= LECTURE 0 ================= */
L['rs:13:0']={blocks:[
{p:'**Redshift Spectrum** and the newer built-in data lake engine let you query files in **Amazon S3** with SQL, without loading them into Redshift tables. You describe the files with an **external schema** and **external tables**, and then query them like any other table.'},
{svg:lake},
{h:'Which engine runs the lake query?'},
{t:[['Platform','Lake query engine','Charge'],
['**RA3 and DC2** provisioned','**Redshift Spectrum**: dedicated servers outside your cluster that scale with the query','Spectrum charges (by data scanned, see pricing)'],
['**RG** provisioned and **Serverless**','An **integrated** lake engine on your own compute','No separate Spectrum charge. Cross-Region S3 queries add data transfer cost']]},
{p:'The engine is chosen for you. SQL is the same on both.'},
{h:'Set it up'},
{code:`-- 1. Attach an IAM role that can read S3 and the Glue catalog (next lectures)

-- 2. Create an external schema that points to a Glue database
CREATE EXTERNAL SCHEMA lake
FROM DATA CATALOG DATABASE 'salesdb'
IAM_ROLE 'arn:aws:iam::111122223333:role/RedshiftLakeRole'
CREATE EXTERNAL DATABASE IF NOT EXISTS;

-- 3. See what exists
SELECT * FROM svv_external_schemas;
SELECT * FROM svv_external_tables WHERE schemaname='lake';`},
{h:'Things to know'},
{ul:['The external catalog can be the **AWS Glue Data Catalog**, the Athena catalog, or your own Hive metastore. Changes in the catalog are available to all clusters immediately.','External tables are **read-only for updates**: Spectrum does not support `UPDATE` or `DELETE` on them.','External tables do not appear in `PG_TABLE_DEF`, `information_schema` or `STV_TBL_PERM`. Use `SVV_EXTERNAL_TABLES` and `SVV_EXTERNAL_COLUMNS`, and tell BI tools to use them.','Many clusters can query the same S3 data in the same Region at once, with no copies.','Use it for **large, rarely used or raw data**, and keep hot data in Redshift tables for speed.']},
{note:'A lake query reads files and has no sort keys or zone maps. It is excellent for flexibility and low storage cost, but not a substitute for well-designed local tables for hot dashboards.'}],
src:[['Querying your data lake','https://docs.aws.amazon.com/redshift/latest/gsg/data-lake.html'],['Redshift Spectrum overview',DG+'c-spectrum-overview.html'],['External schemas',DG+'c-spectrum-external-schemas.html']]};

/* ================= LECTURE 1 ================= */
L['rs:13:1']={blocks:[
{p:'An **external table** is only a definition: column names and types, the S3 location, the file format, and optionally partitions. The data stays in S3.'},
{code:`CREATE EXTERNAL TABLE lake.events (
  event_id   bigint,
  user_id    bigint,
  event_type varchar(40),
  payload    varchar(2000)
)
PARTITIONED BY (event_date date)
STORED AS PARQUET
LOCATION 's3://my-lake-bucket/events/';

-- Tell Redshift (and Glue) about a partition folder
ALTER TABLE lake.events ADD IF NOT EXISTS PARTITION (event_date='2026-10-01')
LOCATION 's3://my-lake-bucket/events/event_date=2026-10-01/';`},
{h:'File formats'},
{p:'Redshift can read Parquet, ORC, Avro, text and CSV (OpenCSV), JSON and several others, plus Iceberg (lecture 7). Choose the format first, because it decides speed and cost.'},
{t:[['Format','Good for','Notes'],
['**Parquet** (or ORC)','Analytics','Columnar, compressed. Redshift reads only the columns you need. **Best default**'],
['Text, CSV, JSON','Raw landing data','Reads the whole file even if you need one column. Convert to Parquet for repeated use'],
['Avro','Streaming exports','Row oriented']]},
{h:'Partitioning'},
{ul:['Partition by the column you filter on most, usually a **date**, with folders such as `event_date=2026-10-01/`.','The planner skips partitions that do not match your `WHERE` clause. Check it with `SVL_S3PARTITION` (total vs qualified partitions).','Avoid too many tiny partitions. Thousands of small files per partition are slower than a few large files.','Glue crawlers, Athena `MSCK REPAIR TABLE` or partition projection can add partitions automatically. Do not leave it to chance.']},
{h:'Useful extras'},
{code:`-- Which file did a row come from? (pseudocolumns)
SELECT "$path", "$size", COUNT(*) FROM lake.events GROUP BY 1,2;

-- Help the planner: it does not analyze external tables
ALTER TABLE lake.events SET TABLE PROPERTIES ('numRows'='170000000');`},
{note:'Redshift does not collect statistics for external tables. If you do not set `numRows`, the planner assumes external tables are the large ones and local tables are small, which may be wrong. Glue column statistics are used automatically when they exist.'}],
src:[['External tables',DG+'c-spectrum-external-tables.html'],['Data files for Spectrum',DG+'c-spectrum-data-files.html'],['Spectrum query performance',DG+'c-spectrum-external-performance.html']]};

/* ================= LECTURE 2 ================= */
L['rs:13:2']={blocks:[
{p:'Lake access goes wrong in two places: the **catalog** (can Redshift see the table definition?) and **IAM** (can Redshift read the files?). Keep them separate when you troubleshoot.'},
{h:'The role'},
{ul:['Create an **IAM role** that Redshift can assume (trust principal `redshift.amazonaws.com`) and attach it to the cluster or namespace (Section 3).','Give it `s3:GetObject` and `s3:ListBucket` on the lake bucket and prefixes **only**, and read access to the Glue catalog (`glue:GetDatabase`, `GetTable`, `GetPartitions` and the create/update calls if Redshift will create external databases or tables).','If the data or the catalog is encrypted with KMS, the role also needs `kms:Decrypt` on that key.','Name the role in `CREATE EXTERNAL SCHEMA ... IAM_ROLE`. A second role can be chained when the data is in another account.']},
{code:`{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:GetObject","s3:ListBucket"],
      "Resource": ["arn:aws:s3:::my-lake-bucket","arn:aws:s3:::my-lake-bucket/*"] },
    { "Effect": "Allow", "Action": ["glue:GetDatabase","glue:GetDatabases","glue:GetTable","glue:GetTables","glue:GetPartition","glue:GetPartitions"],
      "Resource": "*" }
  ]
}`},
{h:'Who may use the schema?'},
{p:'Database permissions still apply on top of IAM.'},
{code:`GRANT USAGE ON SCHEMA lake TO ROLE analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA lake TO ROLE analyst;     -- check support for your table types
GRANT ASSUMEROLE ON 'arn:aws:iam::111122223333:role/RedshiftLakeRole' TO ROLE etl_runner FOR ALL;   -- control who may use the IAM role`},
{h:'Lake Formation'},
{p:'If your Glue databases are managed by **AWS Lake Formation**, Lake Formation grants decide what the role may see, including column and row filters. Redshift supports Lake Formation fine-grained access control on Iceberg tables. Plan the permissions in Lake Formation instead of duplicating them in IAM.'},
{h:'Common errors'},
{t:[['Symptom','Likely cause'],
['Access denied reading S3','Role lacks `s3:GetObject` or `ListBucket`, a bucket policy blocks it, or the KMS key is missing'],
['Catalog or database not found','Wrong Glue database name, wrong Region, or role lacks Glue permissions'],
['Table exists but returns no rows','Partitions not added, wrong `LOCATION`, empty prefix'],
['Query works for admin but not an analyst','Missing `USAGE` on the schema or `ASSUMEROLE` rule'],
['Bucket in another Region','Spectrum needs the bucket in the same Region. The integrated engine on RG and Serverless can cross Regions with transfer cost']]},
{note:'Use least privilege. A role with `AmazonS3FullAccess` on a warehouse that many people can query turns every analyst into a reader of your whole S3 estate.'}],
src:[['IAM policies for Spectrum',DG+'c-spectrum-iam-policies.html'],['Spectrum and Lake Formation',DG+'spectrum-lake-formation.html'],['CREATE EXTERNAL SCHEMA',DG+'r_CREATE_EXTERNAL_SCHEMA.html']]};

/* ================= LECTURE 3 ================= */
L['rs:13:3']={blocks:[
{p:'The big benefit of a lake link is joining **recent hot data in Redshift** with **large history in S3** in one query. Done well it is cheap and fast. Done badly it scans the whole lake.'},
{code:`-- Dimension in Redshift, large fact in S3
SELECT d.region, SUM(f.amount) AS revenue
FROM   lake.sales_history f                -- external, partitioned by sale_date
JOIN   dim_store d ON d.store_id = f.store_id   -- local, small
WHERE  f.sale_date BETWEEN '2026-01-01' AND '2026-03-31'   -- partition filter
GROUP BY d.region;`},
{h:'Rules that keep it efficient'},
{ul:['**Put the filter on the partition column**, so only the needed folders are read.','Select only the columns you need. With Parquet, unused columns are not read.','Keep **large facts in S3 and small, often used dimensions in Redshift**, so the join sends little data around.','Let filters and aggregations run in the lake layer. `GROUP BY`, comparisons, `LIKE`, `COUNT`, `SUM`, `AVG`, `MIN`, `MAX` and string functions can be pushed down. `DISTINCT` and `ORDER BY` cannot.','Set `numRows` so the plan puts the right table on the right side of a join.','Check the plan with `EXPLAIN`: `S3 Seq Scan`, `S3 HashAggregate` and `S3 Query Scan` steps show work done in the lake layer. A `Filter` above `S3 Query Scan` means filtering happened in Redshift after the data came back.']},
{h:'Hot and cold design (a common pattern)'},
{flow:['Load recent data (last 13 months) into local tables','UNLOAD older data to S3 as partitioned Parquet','Drop or archive the old local rows','Create a view that UNIONs the local table and the external table']},
{code:`UNLOAD ('SELECT * FROM sales WHERE sale_date < DATEADD(month,-13,CURRENT_DATE)')
TO 's3://my-lake-bucket/sales_history/' IAM_ROLE 'arn:aws:iam::111122223333:role/RedshiftLakeRole'
FORMAT PARQUET PARTITION BY (sale_date);

CREATE VIEW sales_all AS
  SELECT sale_id, store_id, sale_date, amount FROM public.sales
  UNION ALL
  SELECT sale_id, store_id, sale_date, amount FROM lake.sales_history
WITH NO SCHEMA BINDING;                    -- required for views on external tables`},
{note:'Views over external tables must be **late binding** (`WITH NO SCHEMA BINDING`), and you refer to the table by its schema name. You can also build a **materialized view** on a lake table to speed up repeated queries.'},
{h:'Cost watch'},
{ul:['On RA3 and DC2 you pay Spectrum charges for data scanned. A missing partition filter makes every query read everything. Usage limits for Spectrum can cap it (Section 4).','On RG and Serverless the lake query uses your compute, so an expensive scan shows up as RPU or node load.']}],
src:[['Spectrum query performance',DG+'c-spectrum-external-performance.html'],['Materialized views on external tables',DG+'materialized-view-external-table.html'],['UNLOAD',DG+'r_UNLOAD.html']]};

/* ================= LECTURE 4 ================= */
L['rs:13:4']={blocks:[
{p:'**Data sharing** lets one warehouse (the **producer**) give other warehouses (the **consumers**) live access to its data. No copy, no ETL. Each consumer uses its **own compute**, so workloads do not slow each other down.'},
{svg:share},
{h:'Producer steps'},
{code:`CREATE DATASHARE sales_share;

ALTER DATASHARE sales_share ADD SCHEMA sales;
ALTER DATASHARE sales_share ADD TABLE sales.orders;
ALTER DATASHARE sales_share ADD ALL TABLES IN SCHEMA sales;
ALTER DATASHARE sales_share SET INCLUDENEW = TRUE FOR SCHEMA sales;   -- future tables in the schema

GRANT USAGE ON DATASHARE sales_share TO NAMESPACE '<consumer-namespace-guid>';

SELECT * FROM svv_datashares;  SELECT * FROM svv_datashare_objects;  SELECT * FROM svv_datashare_consumers;`},
{h:'Consumer steps'},
{code:`-- Find the producer namespace
SELECT * FROM svv_datashares;

CREATE DATABASE sales_db FROM DATASHARE sales_share OF NAMESPACE '<producer-namespace-guid>';

GRANT USAGE ON DATABASE sales_db TO ROLE analyst;
SELECT COUNT(*) FROM sales_db.sales.orders;          -- three-part name`},
{h:'Facts to remember'},
{ul:['You can share **schemas, tables, views (including late-binding and materialized views) and SQL UDFs**.','Sharing works across **provisioned and Serverless**, between clusters, workgroups, AZs, accounts and Regions.','The data is **live and transactionally consistent**: a consumer transaction sees one state of the producer data, and new transactions see committed changes at once.','**Billing**: the producer pays for storage. The consumer pays for compute and, across Regions, for transfer.','Within **one** cluster you do not need a datashare: use `database.schema.table`.','If the producer and consumer are in different accounts, **both must be encrypted**. In the same account both must have the same encryption type.','Consumers see only what the producer shared, and the producer can remove objects or revoke access at any time.']},
{h:'Typical uses'},
{ul:['A central ETL warehouse sharing curated tables with several BI and analytics warehouses, each sized for its own workload.','Dev and test environments reading production data safely.','Charge-back: each team pays for its own consumer warehouse.']},
{note:'Data sharing gives workload isolation, not data isolation by itself. Use the consumer database permissions, row-level security and masking (Section 10) to control who sees what.'}],
src:[['Data sharing overview',DG+'datashare-overview.html'],['Data sharing considerations',DG+'datashare-considerations.html'],['General considerations',DG+'considerations-datashare-general.html']]};

/* ================= LECTURE 5 ================= */
L['rs:13:5']={blocks:[
{p:'**Federated queries** let Redshift query live data in operational databases without ETL. Supported sources are **Amazon RDS and Aurora PostgreSQL, and RDS and Aurora MySQL**. Redshift pushes parts of the work, such as filters, down to the remote database.'},
{h:'Set-up'},
{flow:['Store the remote user name and password in AWS Secrets Manager','Create an IAM role that can read the secret, attach it to the warehouse','Allow network access: the warehouse must reach the database (same VPC or peered)','Create an external schema','Query it like a local table']},
{code:`-- Secret JSON: {"username":"redshift_ro","password":"..."}

CREATE EXTERNAL SCHEMA orders_pg
FROM POSTGRES
DATABASE 'orders' SCHEMA 'public'
URI 'orders-cluster.cluster-xyz.eu-west-1.rds.amazonaws.com' PORT 5432
IAM_ROLE 'arn:aws:iam::111122223333:role/RedshiftFederatedRole'
SECRET_ARN 'arn:aws:secretsmanager:eu-west-1:111122223333:secret:orders-ro-AbCdEf';

SELECT o.order_id, o.status, c.segment
FROM   orders_pg.orders o                       -- live data from PostgreSQL
JOIN   dim_customer c ON c.customer_id = o.customer_id
WHERE  o.created_at > CURRENT_DATE - 1;`},
{p:'For MySQL, use `FROM MYSQL` with the MySQL port (3306 if you leave it out).'},
{h:'Limits and cautions'},
{ul:['**Read-only**: you cannot write to the remote database.','Does **not** work with **concurrency scaling**, and does not support `ALTER SCHEMA` (drop and recreate the external schema instead).','Each query adds **load to the operational database** and cost on Aurora (IOPS). Use a **read replica** and filter hard.','A Redshift query using PostgreSQL federation starts a `REPEATABLE READ` transaction on the remote database. With an Aurora **reader endpoint** you may see an "invalid snapshot" error. Use a specific instance endpoint, or set `pg_federation_repeatable_read` to false for the session (the data is then read at the READ COMMITTED level).','MySQL federation supports `READ COMMITTED`, and zero dates become NULL.','Data in another Region adds latency and transfer cost.','Check queries sent to PostgreSQL in `SVL_FEDERATED_QUERY`.','Use a **dedicated read-only database user** with access to only the needed tables.']},
{h:'When to use it'},
{t:[['Use federated query','Use a load or zero-ETL instead'],
['Small, fresh lookups, such as current order status','Large scans or repeated heavy joins'],
['One-off checks and data validation','Dashboards that run all day'],
['Before you build a pipeline','Anything that must not touch the source system']]},
{code:`-- A common pattern: use federation to load a snapshot into a local table
CREATE TABLE stg_orders AS SELECT * FROM orders_pg.orders WHERE updated_at >= CURRENT_DATE - 1;`}],
src:[['Federated queries',DG+'federated-overview.html'],['Considerations',DG+'federated-limitations.html'],['Creating a secret and IAM role',DG+'federated-create-secret-iam-role.html']]};

/* ================= LECTURE 6 ================= */
L['rs:13:6']={blocks:[
{p:'Sharing across **AWS accounts** and **Regions** uses the same datashare, with extra authorization steps so that both sides agree.'},
{h:'Across accounts'},
{flow:['Producer admin grants usage to the consumer ACCOUNT','Producer authorizes the datashare (console or CLI)','Consumer admin associates a cluster, workgroup or the whole account','Consumer creates a database from the datashare']},
{code:`-- Producer
GRANT USAGE ON DATASHARE sales_share TO ACCOUNT '444455556666';
-- Or share through the AWS Glue Data Catalog and Lake Formation:
-- GRANT USAGE ON DATASHARE sales_share TO ACCOUNT '444455556666' VIA DATA CATALOG;`},
{code:`aws redshift authorize-data-share --data-share-arn <share-arn> --consumer-identifier 444455556666

# Consumer account
aws redshift associate-data-share-consumer --data-share-arn <share-arn> --consumer-arn <consumer-cluster-or-namespace-arn>

-- Consumer SQL
CREATE DATABASE sales_db FROM DATASHARE sales_share OF ACCOUNT '111122223333' NAMESPACE '<producer-namespace-guid>';`},
{h:'Across Regions'},
{ul:['Supported between provisioned clusters and Serverless in different Regions.','The consumer pays the **cross-Region data transfer** from the producer Region. Usage limits can cap cross-Region sharing (Section 4).','Latency is higher than in the same Region. Keep the consumer near its users and test.','Check that the Regions you use support data sharing in the list in the documentation.']},
{h:'Governance'},
{ul:['Use `svv_datashare_consumers`, `svv_datashare_privileges` and `SHOW GRANTS` to review who can use a share.','Producers can see metadata about consumer use (counts and objects), but not consumer SQL.','Keep each datashare small and purpose-built. One share per consumer group is easier to audit than one share for everything.','Revoke when a project ends: `REVOKE USAGE ON DATASHARE sales_share FROM ACCOUNT ...`.','Alert on `AuthorizeDataShare` and `AssociateDataShareConsumer` in CloudTrail (Section 11).','Both sides must be encrypted for cross-account sharing, and the KMS keys do not have to be the same.']},
{h:'Writes (multi-warehouse writes)'},
{p:'A producer can also grant **write** permissions, so a consumer can run `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `COPY` (without `COMPUPDATE`), `CTAS` and `TRUNCATE` on shared tables. For cross-account sharing the producer must authorize the share **for writes** and the consumer must associate the specific cluster or workgroup for writes. It needs a recent patch level, so check the patch and the "getting started with writes" page.'},
{ul:['Not supported on the consumer: writing through **concurrency scaling**, **auto-copy** or **streaming** jobs, creating **zero-ETL** tables on the producer, writing to **interleaved sort key** tables, to **stored procedures** or **UDFs**, and multi-statement queries to the producer.','Plan write ownership clearly so two warehouses do not fight over the same rows.']}],
src:[['Sharing write access',DG+'getting-started-datashare-writes.html'],['Considerations for reads and writes',DG+'considerations-datashare-reads-writes.html'],['Supported SQL for writes',DG+'multi-warehouse-writes-sql-statements.html']]};

/* ================= LECTURE 7 ================= */
L['rs:13:7']={blocks:[
{p:'**Apache Iceberg** is an open table format for data lakes. Iceberg tables in S3 add things plain Parquet folders lack: transactions, schema changes, hidden partitioning and row-level changes. Redshift reads them directly.'},
{h:'Use Iceberg tables from Redshift'},
{flow:['Create the Iceberg table in the Glue Data Catalog (Athena or EMR)','Give Redshift an IAM role for S3 and Glue','Create an external schema on the Glue database','Query it','Optionally load a copy into a local table']},
{code:`CREATE EXTERNAL SCHEMA iceberg_lake
FROM DATA CATALOG DATABASE 'iceberg_db'
IAM_ROLE 'arn:aws:iam::111122223333:role/RedshiftLakeRole';

SELECT customer_id, SUM(amount) FROM iceberg_lake.orders WHERE order_date >= '2026-09-01' GROUP BY 1;

-- Copy into Redshift (INSERT or CTAS works; COPY does not read Iceberg)
CREATE TABLE local_orders AS SELECT * FROM iceberg_lake.orders WHERE order_date >= '2026-01-01';`},
{h:'What the AWS docs say'},
{ul:['Redshift reads Iceberg format **versions 1, 2 and 3**, with transactionally consistent reads while Athena or EMR change the table.','**New partitions are detected automatically**, and partition changes apply without any action.','Redshift uses statistics in the Iceberg metadata. For best performance, **generate column statistics in AWS Glue**.','You can build **materialized views** on Iceberg tables. Automatic query rewriting and automatic materialized views on data lake tables are not supported.','**Lake Formation fine-grained access control** works with Iceberg tables.','Time travel queries are **not supported**.','Federated identity (`IAM_ROLE` with the `SESSION` keyword) is not supported when writing to Iceberg tables.','On RA3 you pay Spectrum pricing. On RG and Serverless there is no separate data lake query charge.']},
{h:'Lakehouse catalogs and Lake Formation'},
{ul:['The **Glue Data Catalog** is the shared catalog for Redshift, Athena, EMR and others. **Lake Formation** adds central permissions: database, table, column and row-level rules.','Redshift can also query **Amazon S3 Tables** (Iceberg in table buckets) and is itself able to write system table history to S3 Tables (Section 11).','AWS has announced Iceberg materialized views in Redshift (October 2026). Read the current documentation for the supported statements before you design with them.']},
{note:'Keep one place where permissions are defined. If you grant in IAM, Lake Formation and the database, nobody will know the real access any more.'}],
src:[['Using Apache Iceberg tables with Redshift',DG+'querying-iceberg.html'],['Redshift and Lake Formation',DG+'spectrum-lake-formation.html'],['Querying S3 Tables',DG+'querying-s3Tables.html']]};

/* ================= LECTURE 8 ================= */
L['rs:13:8']={blocks:[
{p:'Lake queries are billed and sized differently depending on platform. Understand both so that you can tune the right thing.'},
{h:'Spectrum on RA3 and DC2'},
{ul:['Work such as filtering and aggregation is **pushed to the Spectrum layer** outside your cluster, so it uses little of your cluster capacity, and scales with demand.','You pay by **data scanned** (see the pricing page). Less scanned data means a lower bill and faster queries.','Usage limits for Spectrum can alert or stop queries once a daily, weekly or monthly TB limit is reached (Section 4).']},
{h:'The integrated engine on RG and Serverless'},
{ul:['Runs on **your own compute**. There are **no Spectrum charges**, but lake queries compete with your other work for the same capacity.','It can read S3 buckets in **another Region**, with data transfer charges.','AWS notes that RG can sometimes be slower than RA3 with Spectrum for lake-heavy work, since Spectrum scales on its own dedicated servers. If you see this, add nodes or use a larger RG size.','On Serverless, a heavy lake scan raises RPU use, so monitor it (Section 12).']},
{h:'Tuning checklist'},
{t:[['Action','Why'],
['Use **Parquet or ORC**','Columnar files let Redshift skip unneeded columns'],
['Files **larger than 64 MB**, similar in size, several per partition','Good parallelism, no skew'],
['Partition on the usual filter and filter on it','Skips whole folders. Check `SVL_S3PARTITION`'],
['Select only needed columns','Less data read'],
['Large facts in S3, small dimensions local','Cheap joins'],
['Set `numRows`, or generate Glue column statistics','Better join order'],
['Push down filters and aggregates; avoid `DISTINCT` and `ORDER BY` on the huge side','They cannot run in the lake layer'],
['Compact small files, and remove old ones','Many tiny files are slow']]},
{code:`EXPLAIN SELECT ... FROM lake.events WHERE event_date = '2026-10-01';
-- Look for: S3 Seq Scan, S3 HashAggregate, and the partition counts

SELECT * FROM svl_s3partition WHERE query = pg_last_query_id();   -- total vs qualified partitions`},
{note:'Measure before and after each change: bytes scanned, runtime and, on RA3, the bill. A tuning step that does not change those numbers did not help.'}],
src:[['Spectrum query performance',DG+'c-spectrum-external-performance.html'],['Querying your data lake','https://docs.aws.amazon.com/redshift/latest/gsg/data-lake.html'],['Redshift pricing','https://aws.amazon.com/redshift/pricing/']]};

/* ================= LECTURE 9 ================= */
L['rs:13:9']={blocks:[
{p:'**Redshift ML** lets SQL users create, train and use machine learning models with a `CREATE MODEL` statement. Redshift sends the training data to **Amazon SageMaker**, receives the trained model, and then runs predictions **inside the warehouse** as an ordinary SQL function.'},
{h:'Set-up'},
{ul:['An **IAM role** attached to the warehouse that can use S3 and SageMaker (and Bedrock if you use foundation models). Its trust policy must allow `redshift.amazonaws.com` and `sagemaker.amazonaws.com`. The console can create a default role for you.','An **S3 bucket** for training data and artifacts, and optionally a KMS key.','Enable **enhanced VPC routing** if traffic between Redshift ML and S3 must stay in your VPC. Inference calls to remote SageMaker models do not go through your VPC.']},
{code:`CREATE MODEL customer_churn_model
FROM (SELECT age, plan, tenure_months, support_calls, churned FROM customer_activity)
TARGET churned
FUNCTION predict_churn
IAM_ROLE 'arn:aws:iam::111122223333:role/RedshiftMLRole'
SETTINGS (S3_BUCKET 'my-redshift-ml-bucket', MAX_RUNTIME 3600);

SHOW MODEL customer_churn_model;                      -- status, metrics, function name

-- Predict inside SQL
SELECT customer_id, predict_churn(age, plan, tenure_months, support_calls) AS will_churn
FROM customers_now;

-- For classification, a second function returns probabilities
SELECT predict_churn_probabilities(age, plan, tenure_months, support_calls) FROM customers_now;`},
{h:'Choices'},
{ul:['**Automatic** (`AUTO ON`, the default): SageMaker finds a good model. For binary and multiclass classification Redshift also creates the `_probabilities` function.','**You choose**: XGBoost with `AUTO OFF` and your own hyperparameters. The supported algorithms include XGBoost, multilayer perceptron, K-Means and Linear Learner.','**Bring your own** SageMaker model or call a remote endpoint, and use Bedrock foundation models where supported. Check the `CREATE MODEL` page for syntax.','`EXPLAIN_MODEL` returns feature importance, which helps explain the model to others.']},
{h:'Permissions'},
{code:`GRANT CREATE MODEL TO ROLE data_scientist;
GRANT CREATE, USAGE ON SCHEMA ml TO ROLE data_scientist;
GRANT EXECUTE ON MODEL ml.customer_churn_model TO ROLE marketing_analyst;`},
{h:'Cost and cautions'},
{ul:['You pay for **SageMaker training and endpoints**, **S3**, and the Redshift compute used. Training can be expensive on big data sets, so limit the rows (`MAX_CELLS`) and runtime while you experiment.','Clean data first. A model is only as good as its features.','Do not send sensitive columns to a model without a governance decision. Masking policies and permissions still apply to the training query.','Predictions reflect the data at training time. Plan **retraining** when data drifts, and version the model names.']}],
src:[['Getting started with Redshift ML',DG+'getting-started-machine-learning.html'],['CREATE MODEL',DG+'r_CREATE_MODEL.html'],['Redshift ML overview',DG+'machine_learning.html']]};

/* ================= LECTURE 10 ================= */
L['rs:13:10']={blocks:[
{p:'Once warehouses share data, you will want consumers to build their own **materialized views** and, where the producer allows it, to change **table structure** on shared data. Both have clear rules.'},
{h:'Materialized views on shared data'},
{ul:['A consumer can create a **materialized view over tables from a datashare**, placing the datashare database name in the view name in `CREATE MATERIALIZED VIEW`.','Redshift supports **automatic and incremental refresh** of materialized views in a consumer datashare when the base tables are shared. The view should reference **only one database** (local or remote), and incremental refresh applies to **newly created** views.','Using a materialized view stores a result copy on the consumer, so queries read local data and are fast. You pay for that storage and for the refresh.','The producer can also share its own materialized views. Consumers then read the pre-computed result without building anything.']},
{code:`-- Consumer: build a local summary of shared sales data (names are illustrative)
CREATE MATERIALIZED VIEW daily_sales_summary AS
SELECT order_date, store_id, SUM(amount) AS revenue
FROM sales_db.sales.orders
GROUP BY 1,2;

REFRESH MATERIALIZED VIEW daily_sales_summary;
SELECT * FROM sys_mv_refresh_history ORDER BY 1 DESC LIMIT 5;`},
{p:'Confirm the exact syntax for a view over a remote database in the `CREATE MATERIALIZED VIEW` page, because the placement of the database name matters.'},
{h:'DDL on shared objects (multi-warehouse writes)'},
{p:'If the producer grants write privileges, a consumer can run these data definition statements on the producer data through the share:'},
{ul:['`CREATE` and `DROP` schema, `CREATE` and `DROP TABLE`, `CREATE TABLE AS`.','`ALTER TABLE` rename, rename column, `ADD COLUMN` and `DROP COLUMN`, and `ALTER SCHEMA RENAME`.','`TRUNCATE`, and transactions with `BEGIN`, `COMMIT` and `ROLLBACK`.','`GRANT` and `REVOKE` on objects, and `SHOW GRANTS`.']},
{p:'Not supported through the share: interleaved sort key tables, stored procedures and UDFs, auto-copy, streaming and concurrency-scaled queries writing to the producer, and multi-statement requests to the producer.'},
{h:'Governance advice'},
{ul:['Grant `CREATE` on a **dedicated schema** for consumer work, not on the whole database.','Name consumer-created objects clearly, so the producer team can tell them apart.','Monitor with the data sharing system views and the audit log (Section 11) so you can see who changed what.','Write operations need a recent patch level. Check the minimum version in the documentation.']},
{note:'A producer that allows remote DDL is handing out part of its administration. Start with read-only sharing, and add write permissions only for a clear business reason and a named owner.'}],
src:[['CREATE MATERIALIZED VIEW',DG+'materialized-view-create-sql-command.html'],['Supported SQL statements for writes',DG+'multi-warehouse-writes-sql-statements.html'],['Unsupported SQL statements for writes',DG+'multi-warehouse-writes-sql-statements-unsupported.html']]};

/* ================= LECTURE 11 ================= */
L['rs:13:11']={blocks:[
{p:'**AWS Data Exchange** is a marketplace for data. Providers can list Redshift datashares as products. Subscribers find the product, subscribe, and query the data in their own warehouse as a datashare, with no copy or ETL.'},
{h:'As a subscriber'},
{flow:['Find a product with a Redshift datashare in AWS Data Exchange','Subscribe and accept the terms','Add the datashare to your warehouse','CREATE DATABASE FROM DATASHARE','Query, and join with your own data']},
{ul:['You do **not** need to register as a provider to find, subscribe to and query data.','Your warehouse must be **RG or RA3** (or Serverless) and **encrypted**.','Queries run on **your** compute. Check the subscription fee and your compute cost.','The provider cannot see your SQL. They see only metadata, such as query counts and the objects used.','Subscription cancellation or expiry removes your access, so do not build critical processes on data you cannot keep.']},
{h:'As a provider'},
{ul:['You must be **registered as an AWS Data Exchange provider** to list products.','Your producer warehouse must be on the RG or RA3 type with the latest version, and **encrypted**.','Create the datashare as **publicly accessible**, so that subscribers with publicly accessible warehouses can use it. Turning that setting off needs a special session setting and is not recommended.','You cannot add or remove consumers by hand. Access depends on an **active subscription**.','**Do not drop a datashare** that subscribers use. They would lose access, which is irreversible and can breach your product terms.','Cross-Region sharing is supported. The subscriber pays the cross-Region transfer.']},
{h:'Risk checklist for a subscriber'},
{ul:['Who owns the data, and how often is it updated? Read the product description.','What are the licence limits for storing, copying or re-sharing results?','Which permissions do your analysts need? Give them a role and a schema for the subscribed database only (Section 10).','Is the data personal or regulated? Involve legal and security before you join it to your own data.']},
{note:'A subscribed datashare is read-only data owned by someone else. Treat it like any external source: record where it came from, test its quality and be ready for it to change.'}],
src:[['Data sharing with AWS Data Exchange',DG+'adx-considerations.html'],['AWS Data Exchange user guide','https://docs.aws.amazon.com/data-exchange/latest/userguide/what-is.html']]};
})();
