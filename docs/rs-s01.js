/* LearnSphere - Amazon Redshift, Section 01: Introduction & Data Warehouse Foundations.
   Lectures 0-4 are core, 5-6 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const rowCol=R.dg(700,250,[
[10,10,330,230,'Row store (OLTP, e.g. PostgreSQL)',1],[360,10,330,230,'Column store (OLAP, Redshift)',1],
[30,45,290,34,'order 1 | id, date, customer, amount, status',0],[30,89,290,34,'order 2 | id, date, customer, amount, status',0],[30,133,290,34,'order 3 | id, date, customer, amount, status',0],
[30,185,290,44,'SELECT SUM(amount): reads every whole row|(all 5 columns) to use one',2],
[380,45,140,34,'id | 1, 2, 3 ...',0],[380,89,140,34,'date | ...',0],[380,133,140,34,'customer | ...',0],
[535,45,140,34,'amount | ...',2],[535,89,140,34,'status | ...',0],
[380,185,295,44,'SELECT SUM(amount): reads only the amount|column; the other 4 stay on disk',2]],
[]);

const overview=R.dg(700,260,[
[10,100,110,50,'Client / BI|tool / SQL',0],
[170,90,150,70,'Leader node|parse, plan, coordinate',2],
[370,20,320,150,'Compute nodes (MPP)',1],
[385,50,90,50,'Slice 1|Slice 2',0],[490,50,90,50,'Slice 3|Slice 4',0],[595,50,85,50,'Slice ...',0],
[385,110,295,45,'Local SSD cache of hot data',0],
[370,205,320,45,'Amazon S3: durable managed storage + data lake',2]],
[[120,125,170,125],[320,110,385,90],[320,140,385,130],[525,170,525,205]]);

const shared=R.dg(700,260,[
[10,10,330,240,'AWS manages',1],[360,10,330,240,'You manage (the DBA)',1],
[30,45,290,34,'Hardware, data centers, networking',0],[30,89,290,34,'Redshift software patching and upgrades',0],[30,133,290,34,'Replacing failed nodes automatically',0],[30,177,290,34,'Storage durability and automated snapshots',0],
[380,45,290,34,'Table design: distribution, sort keys',2],[380,89,290,34,'Loading data and keeping it clean',2],[380,133,290,34,'Users, roles, permissions, encryption choices',2],[380,177,290,34,'Workload control, monitoring and cost',2]],
[]);

const landscape=R.dg(700,280,[
[10,95,125,50,'Sources|apps, databases,|streams',0],
[170,95,140,50,'Ingest|Glue, DMS, Kinesis',0],
[345,10,215,215,'Store and process',1],
[360,40,185,45,'Amazon S3|data lake',0],[360,100,185,45,'Amazon Redshift|warehouse',2],[360,160,185,50,'Athena, EMR|query / process S3',0],
[590,55,100,50,'QuickSight|BI tools',0],[590,135,100,50,'SageMaker|ML',0],
[10,240,680,32,'Governance across all of it: Glue Data Catalog, Lake Formation, IAM',0]],
[[135,120,170,120],[310,120,345,120],[560,80,590,80],[560,160,590,160]]);

L['rs:0:0']={blocks:[
{p:'This course takes you from zero to a working **Amazon Redshift DBA**: you will understand how a cloud data warehouse stores and processes data, create and size one, design tables that run fast, load and protect data, and keep the warehouse healthy and affordable.'},
{h:'Course roadmap'},
{flow:['Foundations and architecture','Set up, connect, size and cost','Design tables and load data','Query tuning and workload control','Security, monitoring, backup and DR','Data lake, sharing and integrations']},
{h:'The fourteen sections at a glance'},
{t:[['#','Section','What you will be able to do'],
['1','Introduction & Data Warehouse Foundations','Explain OLTP vs OLAP and where Redshift fits'],
['2','Architecture & Deployment Options','Describe leader node, compute nodes, slices, columnar storage and managed storage; choose Provisioned or Serverless'],
['3','Setup, Networking & Connectivity','Create a warehouse, place it in a VPC and connect from tools and applications'],
['4','Capacity, Scaling & Cost Management','Resize, pause, set capacity limits and govern spend'],
['5','Databases, Schemas & System Catalog','Organise objects and read the system views'],
['6','Table Design','Pick distribution style, sort keys and compression'],
['7','Data Loading, Unloading & Ingestion','COPY, UNLOAD, upsert, streaming and zero-ETL'],
['8','Query Processing, Statistics & Maintenance','Read EXPLAIN, run ANALYZE and VACUUM, use caches and materialized views'],
['9','Workload Management & Concurrency','Isolate workloads with queues, rules and concurrency scaling'],
['10','User Management & Access Control','Design roles and least-privilege access'],
['11','Security Hardening, Encryption & Auditing','Encrypt, isolate and audit the warehouse'],
['12','Monitoring & Troubleshooting','Find slow, queued and failing queries'],
['13','Backup, Recovery & High Availability','Snapshots, restores, Multi-AZ and disaster recovery'],
['14','Data Lake, Data Sharing & Integrations','Spectrum, data sharing, federated queries and ML']]},
{h:'How the lessons work'},
{ul:['Every lecture tells you whether it applies to **Provisioned**, **Serverless** or both. The two share one SQL engine but differ in how you create, size, tune and pay for them.','Lectures under **Additional content** are optional deep dives; the core path stands on its own.','Hands-on lectures end with a clean-up step. A running warehouse bills you, so always finish the clean-up.']},
{h:'Prerequisites self-check'},
{p:'You do not need prior Redshift or PostgreSQL experience, but you should be comfortable with the items below. If two or more feel shaky, spend a few hours on them first.'},
{ul:['Write `SELECT` queries with `WHERE`, `JOIN`, `GROUP BY` and `ORDER BY`.','Know what a primary key, foreign key and index are.','Have an AWS account and understand that AWS resources cost money while they exist.','Can use a terminal and run a command such as `aws --version`.']},
{note:'Section 1 is mostly concepts. Sections 3 onward need an AWS account, so set up a budget alert before you create anything (see the lab cost safety lecture in Additional content).'}],
src:[['What is Amazon Redshift?',MG+'welcome.html'],['Amazon Redshift Database Developer Guide',DG]]};

L['rs:0:1']={blocks:[
{p:'To understand why Redshift is built the way it is, you first need to see how analytic work differs from the transactional work most databases (including PostgreSQL) are designed for.'},
{h:'OLTP vs OLAP'},
{t:[['','OLTP (transactions)','OLAP (analytics)'],
['Typical task','Place an order, update a balance','Total sales by region and month'],
['Rows touched','A few, found by key','Millions or billions, scanned'],
['Columns touched','Most columns of a row','A few columns of many rows'],
['Queries','Short, simple, very many per second','Long, complex, fewer at a time'],
['Writes','Constant small inserts and updates','Periodic bulk loads, rare updates'],
['Data','Current state','History kept over years'],
['Storage layout','Row-oriented','Column-oriented'],
['Example','PostgreSQL, Aurora, RDS','Redshift']]},
{h:'Why column storage wins for analytics'},
{p:'A row store keeps all columns of a row together, which is ideal for fetching one order. A column store keeps each column together. A report that sums one column of a billion-row table reads only that column, and because a column holds similar values it also compresses very well.'},
{svg:rowCol},
{h:'Facts and dimensions: the star schema'},
{p:'Warehouse data is usually modelled as a **star schema**. A central **fact table** holds measurable events (sales, clicks, shipments) with a foreign key to each **dimension table** that describes them (customer, product, date, store). Facts are large and grow constantly; dimensions are small and change slowly.'},
{code:`-- A typical warehouse question: facts joined to dimensions, aggregated
SELECT d.year, p.category, SUM(f.amount) AS revenue
FROM   fact_sales f
JOIN   dim_date    d ON f.date_key    = d.date_key
JOIN   dim_product p ON f.product_key = p.product_key
WHERE  d.year >= 2024
GROUP  BY d.year, p.category
ORDER  BY revenue DESC;`},
{p:'This shape matters for you as DBA: in Section 6 you will place the big fact table and the small dimension tables across the cluster so that joins like this one need as little data movement as possible.'},
{h:'ETL vs ELT'},
{t:[['','ETL','ELT'],
['Order','Extract, Transform, then Load','Extract, Load, then Transform'],
['Where transforms run','A separate ETL server','Inside the warehouse, using its parallel engine'],
['Fits Redshift because','Fine for small data','Redshift is fast at set-based SQL, so loading raw data and transforming with SQL is the common pattern']]},
{h:'Batch vs near-real-time loading'},
{ul:['**Batch**: files land in Amazon S3 on a schedule and a `COPY` loads them. Simple, cheap and the default choice.','**Near-real-time**: streaming ingestion and zero-ETL integrations keep the warehouse seconds to minutes behind the source. You will meet both in Section 7.']},
{note:'A common mistake is to run a warehouse like an OLTP database: single-row inserts, point lookups and frequent updates. Redshift can do them, but it is the slowest way to use it.'}],
src:[['Amazon Redshift and PostgreSQL',DG+'c_redshift-and-postgres-sql.html'],['Columnar storage',DG+'c_columnar_storage_disk_mem_mgmnt.html']]};

L['rs:0:2']={blocks:[
{p:'**Amazon Redshift** is a fully managed, petabyte-scale cloud data warehouse from AWS. You send it standard SQL; it spreads the data and the work over many processors so that large analytic queries finish in seconds or minutes rather than hours.'},
{h:'The core ideas'},
{ul:['**Massively parallel processing (MPP)**: data is split across many processing units that each work on their share at the same time.','**Columnar storage**: each column is stored and compressed separately, so a query reads only the columns it needs.','**SQL and PostgreSQL protocol**: connect with standard JDBC/ODBC drivers or `psql`; the SQL dialect is based on PostgreSQL.','**Managed**: AWS handles hardware, patching and replacement of failed nodes.']},
{svg:overview},
{h:'Two ways to run it'},
{t:[['','Provisioned cluster','Serverless'],
['You choose','Node type and number of nodes','Base capacity in Redshift Processing Units (RPUs)'],
['Capacity','Fixed until you resize','Scales automatically around the base, up to an optional maximum'],
['Billing','Per node-hour while running; paused clusters stop on-demand compute billing','Per RPU-hour used; no compute charge while idle'],
['Best for','Steady, predictable, heavy workloads','Spiky, unpredictable or new workloads'],
['Admin effort','More tuning knobs (resize, WLM, parameter groups)','Fewer knobs; AWS manages scaling']]},
{p:'Both store data in **Redshift managed storage** on current node types, and both run the same SQL engine. You will learn the details in Section 2 and the cost trade-offs in Section 4.'},
{h:'Where Redshift fits'},
{ul:['**Use it** for dashboards, reporting, large aggregations, ELT pipelines and combining warehouse data with data in Amazon S3.','**Do not use it** as the database behind an application that does many single-row reads and writes; use RDS or Aurora for that.']},
{h:'A first look'},
{p:'Once you have a warehouse (Section 3) this is all it takes to confirm what you are talking to:'},
{code:`SELECT version();
SELECT current_database(), current_user;`},
{p:'The version string mentions both PostgreSQL and Redshift, which reflects its history: Redshift started from a fork of an old PostgreSQL release and has been rebuilt for analytics since.'}],
src:[['What is Amazon Redshift?',MG+'welcome.html'],['Data warehouse system architecture',DG+'c_high_level_system_architecture.html'],['Redshift Serverless',MG+'serverless-whatis.html']]};

L['rs:0:3']={blocks:[
{p:'Redshift is a managed service, so the DBA job is different from running PostgreSQL yourself. There is no operating system to patch and no disk to replace. The work moves up the stack to design, data, access and cost.'},
{svg:shared},
{h:'What the DBA does day to day'},
{t:[['Area','Typical tasks','Section'],
['Design','Choose distribution and sort keys; keep statistics fresh','6, 8'],
['Loading','Build reliable COPY and upsert pipelines; handle load errors','7'],
['Workload','Keep dashboards fast while ETL runs; set queues and limits','9'],
['Access','Create roles and grant least privilege','10'],
['Security','Encryption, network isolation, audit logs','11'],
['Operations','Monitor, find slow queries, plan capacity','4, 12'],
['Recovery','Snapshots, restores, disaster recovery drills','13'],
['Cost','Right-size, pause, budgets and usage limits','4']]},
{h:'How this differs from PostgreSQL DBA work'},
{ul:['No installation, `postgresql.conf`, `pg_hba.conf` or OS tuning. Settings live in parameter groups (Provisioned) or workgroup configuration (Serverless).','No indexes to design. You choose sort keys and distribution instead.','Backups are automated snapshots rather than `pg_dump` scripts.','Cost is a daily concern, because capacity is something you rent by the hour.']},
{h:'Skills to build'},
{ul:['SQL, including joins, window functions and reading query plans.','AWS fundamentals: IAM, VPC, S3, CloudWatch.','Data modelling for analytics.','Operating discipline: runbooks, monitoring and tested recovery.']},
{note:'Shared responsibility has a security side too: AWS secures the infrastructure, but you decide who can connect and what they can read. Misconfigured access is the most common real-world failure.'}],
src:[['Amazon Redshift management overview',MG+'welcome.html'],['Security in Amazon Redshift',MG+'iam-redshift-user-mgmt.html']]};

L['rs:0:4']={blocks:[
{p:'Redshift is built on PostgreSQL and speaks the PostgreSQL wire protocol, so it feels familiar. Underneath, the storage and execution engine were replaced for analytics, and that changes what you can and should do.'},
{h:'Redshift vs PostgreSQL'},
{t:[['Topic','PostgreSQL','Redshift'],
['Purpose','General purpose, mostly OLTP','Analytics (OLAP)'],
['Storage','Row-oriented heap','Column-oriented, compressed'],
['Indexes','B-tree, GIN, GiST and more','No secondary indexes; sort keys and zone maps'],
['Constraints','Primary, foreign and unique keys enforced','Defined but **not enforced**; used as hints by the planner'],
['Scaling','One server, plus replicas','Many nodes working in parallel'],
['Data placement','Not applicable','Distribution style decides which node holds each row'],
['Single-row writes','Fast','Slow; bulk loads with `COPY` are the right way'],
['Ops','You manage the server','AWS manages the infrastructure']]},
{note:'Because Redshift does not enforce primary or unique keys, duplicate rows are possible. Your load process must protect integrity. Section 5 and Section 7 cover this.'},
{h:'Redshift vs RDS, Aurora and Athena'},
{t:[['Service','Type','Use it for'],
['Amazon RDS / Aurora (PostgreSQL)','Managed OLTP database','Application back ends, many small transactions'],
['Amazon Redshift','Managed MPP data warehouse','Fast, repeated, complex analytics on large structured data'],
['Amazon Athena','Serverless SQL directly on files in S3','Occasional ad hoc queries on a data lake, paying per data scanned']]},
{h:'How to choose'},
{flow:['Many small reads and writes?','Yes: RDS or Aurora','No: analytics','Occasional, on files in S3?','Yes: Athena','Heavy and frequent: Redshift']},
{p:'These services combine well. A common pattern is Aurora for the application, replicated into Redshift for reporting, with S3 holding raw history that both Athena and Redshift can query.'},
{h:'Habits to unlearn from PostgreSQL'},
{ul:['Adding an index to speed up a query. In Redshift you design the sort key and distribution instead.','Relying on constraints to reject bad data.','Inserting rows one at a time.','Running frequent small `UPDATE` and `DELETE` statements.']}],
src:[['Amazon Redshift and PostgreSQL',DG+'c_redshift-and-postgres-sql.html'],['Unsupported PostgreSQL features',DG+'c_unsupported-postgresql-features.html'],['Defining table constraints',DG+'t_Defining_constraints.html']]};

/* ---------- additional content ---------- */
L['rs:0:5']={blocks:[
{p:'A realistic plan, the capstone you will build as you go, and the habits that keep a learning budget from turning into a surprise bill.'},
{h:'Suggested study plan (about 8 weeks)'},
{t:[['Week','Sections','Goal'],
['1','1, 2','Understand the concepts and architecture; no AWS spend yet'],
['2','3','Create a warehouse, connect, run first queries, clean up'],
['3','4, 5','Sizing, cost controls, schemas and catalog'],
['4','6','Table design: the most important performance skill'],
['5','7','Loading and unloading data'],
['6','8, 9','Query tuning, maintenance, workload management'],
['7','10, 11, 12','Access control, security, monitoring'],
['8','13, 14, capstone','Backup and DR, data lake and sharing; finish the capstone']]},
{h:'Capstone project: a small sales warehouse'},
{p:'You will build one warehouse step by step and keep improving it as the course advances.'},
{ul:['**Model**: a star schema with `fact_sales` and dimensions for date, product, customer and store.','**Load**: generate or download sample CSV/Parquet files into S3 and load them with `COPY`.','**Design**: choose distribution and sort keys, then prove the choice by comparing query times.','**Operate**: create read-only and ETL roles, a monitoring query set and a weekly maintenance routine.','**Protect**: take a snapshot, restore it, and write a one-page recovery runbook.']},
{h:'Lab cost safety'},
{p:'A warehouse bills for as long as it exists in a running state. Most surprise bills come from forgetting resources, not from heavy use.'},
{ul:['Create a **budget alert** first: in the AWS Billing console, set a monthly budget (for example 20 USD) with email alerts at 50 and 100 percent.','Use **Serverless** for labs where possible, with a low base capacity and a **usage limit**, so spend is capped.','**Tag** everything you create, for example `project=learnsphere-lab`, so you can find leftovers.','**Pause or delete** at the end of every session. Write down the commands below before you start.']},
{code:`# Provisioned: pause (compute billing stops, storage and snapshots still bill)
aws redshift pause-cluster --cluster-identifier lab-cluster

# Provisioned: delete when finished
aws redshift delete-cluster --cluster-identifier lab-cluster --skip-final-cluster-snapshot

# Serverless: delete the workgroup, then the namespace
aws redshift-serverless delete-workgroup --workgroup-name lab-wg
aws redshift-serverless delete-namespace --namespace-name lab-ns`},
{code:`# Serverless: cap compute at 100 RPU-hours per day and just log if exceeded
aws redshift-serverless create-usage-limit \\
  --resource-arn <workgroup-arn> \\
  --usage-type serverless-compute --amount 100 \\
  --period daily --breach-action log`},
{note:'--skip-final-cluster-snapshot permanently discards the data. That is fine for a throwaway lab and wrong for anything you care about. Also check for leftover snapshots, S3 buckets and Elastic IPs after deleting.'},
{h:'End-of-session checklist'},
{ul:['Cluster paused or deleted, or Serverless workgroup idle with a usage limit.','No unexpected running queries or open sessions.','Billing console checked for yesterday cost.','Notes saved: what you built and what you learned.']}],
src:[['Pausing and resuming a cluster',MG+'rs-mgmt-pause-resume-cluster.html'],['Usage limits in Redshift Serverless',MG+'serverless-monitoring.html'],['Amazon Redshift pricing','https://aws.amazon.com/redshift/pricing/']]};

L['rs:0:6']={blocks:[
{p:'Redshift is one part of a larger AWS analytics toolkit. Knowing the neighbours helps you decide what belongs in the warehouse and what does not.'},
{svg:landscape},
{h:'The main services'},
{t:[['Service','Role','How it relates to Redshift'],
['Amazon S3','Durable object storage; the data lake','Source for `COPY`, target for `UNLOAD`, queried in place through Spectrum'],
['AWS Glue','ETL jobs and the Data Catalog','Moves and transforms data; the catalog describes lake tables Redshift can query'],
['Amazon Athena','Serverless SQL on S3','Ad hoc queries on the same lake data; no warehouse to manage'],
['Amazon EMR','Managed Spark/Hadoop','Heavy transformations or ML preparation before or after the warehouse'],
['AWS Lake Formation','Permissions for the data lake','Central access control over lake tables'],
['Amazon QuickSight','Dashboards and BI','Connects directly to Redshift'],
['Amazon SageMaker','Machine learning','Train on warehouse data; Redshift ML can call it from SQL'],
['AWS DMS, Kinesis, MSK','Migration and streaming','Feed data into Redshift continuously']]},
{h:'A typical modern flow'},
{flow:['Operational databases and apps','Raw files and streams land in S3','Glue or SQL cleans and models data','Redshift serves curated data','BI, dashboards and ML consume it']},
{p:'Keep **raw and rarely queried** data cheaply in S3 and **curated, frequently queried** data in Redshift. Spectrum and data sharing (Section 14) let you query across both without copying everything.'}],
src:[['Amazon Redshift Spectrum',DG+'c-using-spectrum.html'],['AWS analytics services','https://aws.amazon.com/big-data/datalakes-and-analytics/']]};
})();
