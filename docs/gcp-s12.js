/* LearnSphere - Google Cloud, Section 12: Data Analytics & Messaging.
   Lectures 0-7 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const bq=K.dg(700,270,[
[10,10,680,250,'BigQuery separates storage from compute',1],
[30,60,200,60,'Query (SQL)|bq, console, API',0],[270,50,180,80,'Compute|slots, serverless|Dremel engine',2],[490,50,180,80,'Storage|columnar, replicated|tables in datasets',2],
[30,160,640,50,'Project > Dataset (location) > Table, view, routine, model',0]],
[[230,90,270,90],[450,90,490,90]]);

const pubsub=K.dg(700,260,[
[10,10,680,240,'Pub/Sub decouples publishers and subscribers',1],
[30,95,120,60,'Publisher|app, service',0],[200,95,140,60,'Topic|durable log',2],[390,40,140,50,'Subscription A|pull',0],[390,110,140,50,'Subscription B|push',0],[390,180,140,40,'Subscription C|BigQuery',0],[570,95,100,60,'Subscribers',0]],
[[150,125,200,125],[340,115,390,65],[340,125,390,135],[340,135,390,200],[530,65,570,115],[530,135,570,125],[530,200,570,140]]);

const pipeline=K.dg(700,200,[
[10,10,680,180,'A common streaming pipeline',1],
[25,70,100,60,'Sources|apps, devices',0],[150,70,100,60,'Pub/Sub|ingest',0],[275,70,110,60,'Dataflow|transform',2],[410,70,100,60,'BigQuery|analyze',2],[535,70,140,60,'Looker|dashboards, ML',0]],
[[125,100,150,100],[250,100,275,100],[385,100,410,100],[510,100,535,100]]);

/* ---------- 0 ---------- */
L['gcp:11:0']={blocks:[
{p:'**BigQuery** is Google Cloud\'s serverless data warehouse. You load or point to data, write SQL, and BigQuery runs the query across thousands of machines. There are no servers or indexes to manage, and it scales to petabytes.'},
{svg:bq},
{h:'Core concepts'},
{t:[['Concept','Meaning'],
['Project','Billing and access boundary'],
['Dataset','A container for tables and views, with a location (region or multi-region) and access controls'],
['Table','Data stored in columns. Native tables, external tables (data in Cloud Storage, Bigtable, Drive) and views'],
['Job','A query, load, copy or export operation'],
['Slot','A unit of compute used to run queries']]},
{h:'Run a query'},
{code:`bq query --use_legacy_sql=false 'SELECT name, SUM(number) AS total FROM \`bigquery-public-data.usa_names.usa_1910_2013\` GROUP BY name ORDER BY total DESC LIMIT 5'
bq mk --dataset --location=US my-project:sales
bq query --use_legacy_sql=false --dry_run 'SELECT * FROM sales.orders'   # shows bytes that would be scanned`},
{h:'Pricing models'},
{t:[['Model','How you pay','Fits'],
['On-demand (analysis)','Per TiB of data scanned by queries. First TiB each month is free','Unpredictable or light usage'],
['Capacity (editions)','Reserved slots by edition (Standard, Enterprise, Enterprise Plus), with autoscaling','Steady heavy usage and cost control'],
['Storage','Per GiB. Active storage, and cheaper long-term storage for tables not changed for 90 days','All data']]},
{ul:['Columnar storage means a query reads only the columns it references. `SELECT *` scans everything and costs more.','A dry run shows bytes scanned before you pay. Set `maximum_bytes_billed` as a safety limit.','Time travel lets you query or restore a table as it was within the past days (default 7).']},
{note:'BigQuery is for analytics, not for high-rate single-row transactions. Use Cloud SQL, Spanner or Firestore for serving applications.'}],
src:[['BigQuery overview',K.BQ+'introduction'],['Pricing','https://cloud.google.com/bigquery/pricing']]};

/* ---------- 1 ---------- */
L['gcp:11:1']={blocks:[
{p:'Good table design is the main way to control BigQuery cost and speed. Partitioning and clustering reduce how much data a query must read.'},
{h:'Loading data'},
{t:[['Method','Use','Cost'],
['Batch load from Cloud Storage','CSV, JSON, Avro, Parquet, ORC files','Free for the load job'],
['Storage Write API','Streaming rows in real time','Per data ingested'],
['BigQuery Data Transfer Service','Scheduled imports from SaaS (Google Ads, YouTube), S3 and others','Varies'],
['Pub/Sub BigQuery subscription','Messages written directly to a table','Pub/Sub throughput cost'],
['External tables / federated queries','Query data in place','Query cost']]},
{code:`bq load --source_format=PARQUET sales.orders gs://my-bucket/orders/*.parquet
bq load --autodetect --source_format=CSV sales.customers gs://my-bucket/customers.csv`},
{h:'Partitioning'},
{p:'A **partitioned table** is divided by a date, timestamp or integer column (or ingestion time). Queries that filter on the partition column scan only matching partitions.'},
{code:`CREATE TABLE sales.orders_p
PARTITION BY DATE(order_ts)
CLUSTER BY customer_id, country
OPTIONS (partition_expiration_days = 400, require_partition_filter = TRUE) AS
SELECT * FROM sales.orders;`},
{h:'Clustering'},
{p:'**Clustering** sorts data by up to four columns within each partition. Filters on those columns skip blocks, which cuts the data scanned.'},
{h:'Cost controls'},
{ul:['Use **partition filters** and select only needed columns.','Set `require_partition_filter` so queries cannot scan the entire table by accident.','Set **expiration** on temporary tables and old partitions.','Use materialized views for repeated aggregations.','Use quotas and custom cost controls per project or user.','Preview with a dry run. Estimate cost before big queries.']},
{note:'Partitioning pays off when the table is large (tens of GB or more) and queries filter on the partition column. For small tables it adds complexity with little benefit.'}],
src:[['Partitioned tables',K.BQ+'partitioned-tables'],['Clustered tables',K.BQ+'clustered-tables'],['Load data',K.BQ+'loading-data']]};

/* ---------- 2 ---------- */
L['gcp:11:2']={blocks:[
{p:'Access control in BigQuery works at project, dataset, table and, with extra features, row and column level. Sharing data safely is a common task.'},
{h:'Common roles'},
{t:[['Role','Allows'],
['BigQuery Data Viewer','Read table data and metadata'],
['BigQuery Data Editor','Read and write tables'],
['BigQuery Job User','Run queries and jobs in the project (needed in addition to data access)'],
['BigQuery User','Run jobs and create datasets'],
['BigQuery Admin','Full control']]},
{p:'A person needs **Job User** in the project that runs the query and **Data Viewer** on the data. The data and the job can live in different projects, which is useful when cost should be charged to the analyst\'s project.'},
{code:`bq show --format=prettyjson sales
gcloud projects add-iam-policy-binding my-project --member="group:analysts@example.com" --role="roles/bigquery.jobUser"
bq add-iam-policy-binding --member="group:analysts@example.com" --role="roles/bigquery.dataViewer" sales.orders`},
{h:'Fine-grained controls'},
{t:[['Feature','What it does'],
['Authorized view','A view that can read tables the user cannot, exposing only chosen columns and rows'],
['Row-level security','Row access policies filter rows per user or group'],
['Column-level security','Policy tags restrict sensitive columns such as SSN'],
['Dynamic data masking','Return masked values to users without full access'],
['Analytics Hub','Publish and subscribe to shared datasets without copying']]},
{code:`CREATE ROW ACCESS POLICY eu_only ON sales.orders
GRANT TO ("group:eu-analysts@example.com") FILTER USING (region = "EU");`},
{h:'Governance habits'},
{ul:['Control access at the dataset level with groups.','Separate raw, curated and sensitive datasets.','Tag sensitive columns, and use audit logs (BigQuery data access logs are on by default).','Use VPC Service Controls to stop data exfiltration from the project.','Use CMEK where policy requires customer-managed keys.']},
{note:'Granting a user Data Viewer at the project level exposes all datasets in it. Prefer dataset-level grants for sensitive data.'}],
src:[['BigQuery IAM roles',K.BQ+'access-control'],['Authorized views',K.BQ+'authorized-views'],['Row-level security',K.BQ+'row-level-security-intro']]};

/* ---------- 3 ---------- */
L['gcp:11:3']={blocks:[
{p:'**Pub/Sub** is a global, fully managed messaging service. Publishers send messages to a **topic**. Subscribers receive them through **subscriptions**. It decouples systems, absorbs bursts and delivers events to many consumers.'},
{svg:pubsub},
{h:'Concepts'},
{t:[['Term','Meaning'],
['Topic','A named channel that receives messages'],
['Subscription','A stream of messages from a topic for one consumer group. Each subscription receives every message'],
['Message','Data (up to 10 MB) plus attributes'],
['Acknowledgement (ack)','The subscriber confirms processing. Unacked messages are redelivered'],
['Ordering key','Delivers messages with the same key in order']]},
{h:'Delivery types'},
{t:[['Type','Behaviour'],
['Pull','Subscriber asks for messages. Good for workers and batch consumers'],
['Push','Pub/Sub sends HTTP requests to an endpoint such as Cloud Run'],
['BigQuery subscription','Writes messages straight into a table'],
['Cloud Storage subscription','Writes batches of messages to files']]},
{code:`gcloud pubsub topics create orders
gcloud pubsub subscriptions create orders-worker --topic=orders --ack-deadline=30 --dead-letter-topic=orders-dlq --max-delivery-attempts=5
gcloud pubsub topics publish orders --message='{"id": 1}' --attribute=type=created
gcloud pubsub subscriptions pull orders-worker --auto-ack --limit=5`},
{h:'Reliability features'},
{ul:['Delivery is **at least once** by default. Make handlers idempotent. Exactly-once delivery is available for pull subscriptions.','Messages are retained for the subscription retention period (up to 31 days) until acknowledged.','**Dead-letter topics** receive messages that failed too many times. **Retry policy** adds backoff.','**Seek and snapshots** let you replay messages.','Schemas (Avro, Protobuf) can be attached to a topic to validate messages.']},
{note:'Pub/Sub is for messages and events, not for large files. Put the file in Cloud Storage and send the object name in the message.'}],
src:[['Pub/Sub overview','https://cloud.google.com/pubsub/docs/overview'],['Subscription types','https://cloud.google.com/pubsub/docs/subscriber']]};

/* ---------- 4 ---------- */
L['gcp:11:4']={blocks:[
{p:'**Dataflow** is a fully managed service for running data pipelines written with **Apache Beam**. The same code handles batch (a finished dataset) and streaming (data that never ends). Dataflow provisions workers, autoscales and handles failures.'},
{h:'Beam concepts'},
{t:[['Concept','Meaning'],
['Pipeline','The whole data processing job'],
['PCollection','A dataset flowing through the pipeline'],
['Transform','A step such as Map, Filter, GroupByKey, Combine'],
['Window','Groups unbounded data by time, for example 1-minute windows'],
['Trigger and watermark','Decide when results for a window are emitted, handling late data']]},
{h:'A small Python pipeline'},
{code:`import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions

opts = PipelineOptions(runner="DataflowRunner", project="my-project", region="us-central1",
                       temp_location="gs://my-bucket/tmp", streaming=True)
with beam.Pipeline(options=opts) as p:
    (p | "Read" >> beam.io.ReadFromPubSub(topic="projects/my-project/topics/events")
       | "Parse" >> beam.Map(lambda b: json.loads(b.decode()))
       | "Write" >> beam.io.WriteToBigQuery("my-project:analytics.events", write_disposition="WRITE_APPEND"))`},
{h:'Templates'},
{p:'You do not always need to write code. **Google-provided templates** cover common jobs, and you run them with parameters.'},
{code:`gcloud dataflow jobs run pubsub-to-bq --gcs-location=gs://dataflow-templates-us-central1/latest/PubSub_to_BigQuery \\
  --region=us-central1 --parameters=inputTopic=projects/my-project/topics/events,outputTableSpec=my-project:analytics.events
gcloud dataflow jobs list --region=us-central1 --status=active`},
{h:'Operations'},
{ul:['Autoscaling adds and removes workers based on backlog.','Run workers with a **dedicated service account** and in a chosen subnet without public IPs.','Monitor system lag and data freshness. Rising lag means the pipeline cannot keep up.','Drain a streaming job to stop it cleanly. Cancel stops it immediately.']},
{note:'Pick Dataflow for large-scale transformations and streaming. For simple SQL transformations on data already in BigQuery, scheduled queries or Dataform are easier.'}],
src:[['Dataflow overview','https://cloud.google.com/dataflow/docs/overview'],['Dataflow templates','https://cloud.google.com/dataflow/docs/guides/templates/provided-templates']]};

/* ---------- 5 ---------- */
L['gcp:11:5']={blocks:[
{p:'Other managed data services cover big data frameworks, orchestration and integration. You choose them when a team already uses those tools, or when a job does not fit SQL or Beam.'},
{h:'Dataproc'},
{ul:['Managed **Apache Spark, Hadoop, Hive, Flink** and related tools.','Clusters start in about 90 seconds and are usually **ephemeral**: create, run a job, delete.','Data lives in Cloud Storage and BigQuery, not on the cluster, so clusters stay disposable.','**Serverless for Apache Spark** runs Spark jobs without cluster management.','Good for migrating existing Spark and Hadoop code.']},
{code:`gcloud dataproc clusters create etl --region=us-central1 --num-workers=2 --image-version=2.2-debian12
gcloud dataproc jobs submit pyspark gs://my-bucket/job.py --cluster=etl --region=us-central1
gcloud dataproc clusters delete etl --region=us-central1`},
{h:'Cloud Composer'},
{ul:['Managed **Apache Airflow** for orchestrating workflows as code (DAGs).','Schedules and monitors tasks that call BigQuery, Dataflow, Dataproc, Cloud Run and other systems.','Use it when you need dependencies, backfills, retries and a UI over many jobs.']},
{h:'Cloud Data Fusion'},
{ul:['A visual, code-free tool to design data integration pipelines, built on the open source CDAP.','Many connectors for databases and SaaS systems.','Runs on Dataproc under the hood.']},
{h:'Choosing a processing tool'},
{t:[['Need','Tool'],
['SQL transformations on warehouse data','BigQuery (scheduled queries, Dataform)'],
['Streaming or batch pipelines in code','Dataflow'],
['Existing Spark or Hadoop jobs','Dataproc or Serverless for Apache Spark'],
['Visual ETL with connectors','Data Fusion'],
['Schedule and coordinate many tasks','Cloud Composer (or Workflows for simpler cases)']]},
{note:'Do not run Composer for a single job. Cloud Scheduler plus Cloud Run jobs is much cheaper for small schedules.'}],
src:[['Dataproc','https://cloud.google.com/dataproc/docs/concepts/overview'],['Cloud Composer','https://cloud.google.com/composer/docs/composer-3/composer-overview'],['Data Fusion','https://cloud.google.com/data-fusion/docs/concepts/overview']]};

/* ---------- 6 ---------- */
L['gcp:11:6']={blocks:[
{p:'After data is processed, people need to see it and trust it. Google Cloud offers tools for reporting, a governed semantic layer, and data governance.'},
{h:'Reporting and BI'},
{t:[['Product','What it is','Best for'],
['Looker Studio','Free, self-service dashboards and reports connecting to BigQuery, Sheets and many sources','Quick reports and sharing'],
['Looker','Enterprise BI platform with a modeling layer (LookML) that defines metrics once','Governed metrics across an organization, embedded analytics'],
['Connected Sheets','Analyze BigQuery data from Google Sheets','Spreadsheet users'],
['BigQuery BI Engine','In-memory acceleration for dashboards','Fast interactive queries']]},
{h:'Governance with Dataplex'},
{ul:['**Dataplex** (with the universal catalog) provides a single place to discover, manage and govern data across BigQuery, Cloud Storage and other sources.','**Metadata catalog:** search for data assets and see descriptions, owners and tags.','**Data quality:** define rules and scan tables for problems.','**Lineage:** see where data came from and where it goes.','**Policy tags and business glossary** support classification and access rules.']},
{h:'Machine learning close to the data'},
{ul:['**BigQuery ML** creates and runs models using SQL.','**Vertex AI** (see the AI section) offers full ML and generative AI platforms.','**Analytics Hub** shares datasets with partners or internal teams without copying.']},
{code:`CREATE OR REPLACE MODEL sales.churn_model OPTIONS(model_type='logistic_reg', input_label_cols=['churned']) AS
SELECT * FROM sales.customer_features;
SELECT * FROM ML.PREDICT(MODEL sales.churn_model, TABLE sales.new_customers);`},
{note:'Trust matters more than charts. Document owners, definitions and freshness for the key datasets, and monitor data quality.'}],
src:[['Looker Studio','https://cloud.google.com/looker-studio'],['Looker','https://cloud.google.com/looker/docs'],['Dataplex','https://cloud.google.com/dataplex/docs/introduction']]};

/* ---------- 7 ---------- */
L['gcp:11:7']={blocks:[
{p:'A data platform on Google Cloud follows four stages: **ingest**, **process**, **store** and **analyze**. Most designs combine a handful of services, so learn the common pattern.'},
{svg:pipeline},
{h:'Stages and services'},
{t:[['Stage','Services','Notes'],
['Ingest','Pub/Sub, Storage Transfer Service, Datastream (change data capture), BigQuery Data Transfer','Bring in events, files and database changes'],
['Process','Dataflow, Dataproc, BigQuery SQL, Dataform','Clean, enrich, aggregate'],
['Store','Cloud Storage (raw data lake), BigQuery (warehouse), Bigtable (serving)','Layers for raw, cleaned and curated data'],
['Analyze','Looker, Looker Studio, BigQuery ML, Vertex AI','Dashboards and models'],
['Govern and orchestrate','Dataplex, Composer, IAM, VPC Service Controls','Quality, lineage, schedules, access']]},
{h:'Typical batch and streaming flows'},
{flow:['Application events are published to Pub/Sub (streaming) and files land in Cloud Storage (batch)','Dataflow reads, validates and enriches records, sending bad ones to a dead-letter location','Clean data lands in BigQuery partitioned and clustered tables','Scheduled queries or Dataform build curated tables and views','Looker and BigQuery ML consume the curated layer']},
{h:'Layered storage'},
{t:[['Layer','Contents','Typical dataset'],
['Raw (bronze)','Exact copy of the source','raw_orders'],
['Cleaned (silver)','Typed, deduplicated, validated','clean_orders'],
['Curated (gold)','Business-ready aggregates and models','sales_mart']]},
{h:'Design tips'},
{ul:['Keep raw data so you can reprocess when logic changes.','Make pipelines idempotent so retries are safe.','Monitor freshness, lag and failures with alerts.','Use separate projects or datasets per layer and apply least privilege.','Estimate costs: query scanning, slots, streaming ingestion and storage.']},
{note:'Datastream captures changes from databases such as MySQL, PostgreSQL and Oracle and delivers them to BigQuery or Cloud Storage, which is a common way to feed the warehouse from operational systems.'}],
src:[['Data analytics architecture center','https://cloud.google.com/architecture/data-analytics'],['Datastream','https://cloud.google.com/datastream/docs/overview']]};
})();
