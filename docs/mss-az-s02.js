/* LearnSphere - SQL Server Azure SQL & Hybrid, Section 02: Azure SQL Database.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const srv=M.dg(700,220,[
[10,10,680,200,'Logical server sql-sales-prod.database.windows.net',1],
[30,55,190,60,'Admin login|Entra admin',0],[255,45,190,35,'Firewall rules|and network',2],[255,90,190,35,'Database SalesDB',2],[480,45,190,35,'Database CRM',0],[480,90,190,35,'Elastic pool',0],
[30,150,640,45,'A logical server is a connection and management point. It is not a VM and does not host compute by itself.',0]],
[]);

const sls=M.dg(700,200,[
[10,20,200,70,'Active|compute allocated|billed per second',2],[250,20,200,70,'Idle|after delay with no|connections: auto-pause',0],[490,20,200,70,'Resume|on first connection|few seconds delay',0],
[10,115,680,70,'Serverless scales compute between min and max vCores,|and bills compute only while it runs. Storage is billed always.',0]],
[[210,55,250,55],[450,55,490,55]]);

const hs=M.dg(700,220,[
[10,10,680,200,'Hyperscale architecture',1],
[30,55,170,60,'Compute|primary and replicas',2],[240,55,170,60,'Log service|durable log',0],[450,55,220,60,'Page servers|cached data pages',0],
[30,135,640,60,'Azure storage: data files and backups as snapshots.|Compute scales without moving data, and backups do not read the whole database.',0]],
[[200,85,240,85],[410,85,450,85]]);

const bk=M.dg(700,200,[
[10,20,150,70,'Full backup|weekly',0],[185,20,150,70,'Differential|every 12 to 24 h',0],[360,20,150,70,'Log backup|every 5 to 10 min',2],[535,20,155,70,'Long-term|retention|up to 10 years',0],
[10,115,680,70,'Point-in-time restore: any second within retention (1 to 35 days, default 7), to a new database',0]],
[[160,55,185,55],[335,55,360,55],[510,55,535,55]]);

const sc=M.dg(700,170,[
[10,25,200,70,'Scale up or down|change vCores or tier|online, short switch',2],[250,25,200,70,'Scale out reads|replicas, geo-replicas|Business Critical,|Hyperscale',0],[490,25,200,70,'Monitor|metrics, Query Store,|automatic tuning',0]],
[]);

/* ---------- 0: Provisioning ---------- */
L['mss-az:1:0']={blocks:[
{p:'An **Azure SQL Database** lives on a **logical server**, a management and connection endpoint. You create the server, set its admin and network rules, then create databases on it.'},
{svg:srv},
{code:`# Azure CLI
az group create --name rg-sales --location westeurope

az sql server create --name sql-sales-prod --resource-group rg-sales --location westeurope \\
   --enable-ad-only-auth --external-admin-principal-type Group \\
   --external-admin-name "SQL Admins" --external-admin-sid <group-object-id>

az sql db create --resource-group rg-sales --server sql-sales-prod --name SalesDB \\
   --edition GeneralPurpose --family Gen5 --capacity 4 --compute-model Provisioned`},
{h:'Decide at creation'},
{ul:['**Region** close to users and apps, and to paired region for DR.','**Authentication**: Entra only is the preferred setting.','**Network**: private endpoint or firewall rules, and block public access if possible.','**Backup storage redundancy**: local, zone or geo.','**Tags and naming** for cost and ownership.']},
{note:'Infrastructure as code (Bicep, Terraform) is the right way to create environments repeatably. Use the portal to learn, then script.'}],
src:[['Create a database','https://learn.microsoft.com/en-us/azure/azure-sql/database/single-database-create-quickstart'],['Logical servers','https://learn.microsoft.com/en-us/azure/azure-sql/database/logical-servers']]};

/* ---------- 1: Serverless and elastic pools ---------- */
L['mss-az:1:1']={blocks:[
{p:'Two features help with **cost** for variable workloads: **serverless** compute and **elastic pools**.'},
{svg:sls},
{t:[['','Serverless','Elastic pool'],
['**Idea**','One database, compute scales and pauses','Many databases share a resource pool'],
['**Billing**','Per second of compute used, plus storage','Per pool, shared by databases'],
['**Best for**','Intermittent, unpredictable single databases','Many databases with different peak times'],
['**Watch**','Auto-pause resume delay, cold cache','Noisy neighbors: set per database limits']]},
{h:'Choosing'},
{ul:['**Dev and test** or rarely used databases: serverless with auto-pause.','**SaaS** with one database per customer: elastic pool.','**Steady production**: provisioned compute, often cheaper per hour.']},
{note:'After an auto-pause, the first connection waits for the database to resume. Applications must tolerate the delay and retry.'}],
src:[['Serverless compute tier','https://learn.microsoft.com/en-us/azure/azure-sql/database/serverless-tier-overview'],['Elastic pools','https://learn.microsoft.com/en-us/azure/azure-sql/database/elastic-pool-overview']]};

/* ---------- 2: Hyperscale ---------- */
L['mss-az:1:2']={blocks:[
{p:'**Hyperscale** is an architecture designed for very large databases (up to 100 TB) and fast operations. It separates compute from storage into several layers.'},
{svg:hs},
{h:'Layers'},
{t:[['Layer','Role'],
['**Compute**','Primary replica plus optional secondary replicas for reads'],
['**Log service**','Receives log from the primary and makes it durable, feeding page servers'],
['**Page servers**','Own parts of the data and serve pages to compute, each with a local cache'],
['**Azure storage**','Durable data files and snapshot-based backups']]},
{h:'What this means'},
{ul:['**Fast backups and restores** in minutes regardless of size, using storage snapshots.','**Quick scale up and down** of compute.','**Read scale-out** with named replicas.','**Different rules**: no change of tier back to General Purpose in some cases, and storage billed by use. Check the current limits.']}],
src:[['Hyperscale architecture','https://learn.microsoft.com/en-us/azure/azure-sql/database/hyperscale-architecture'],['Hyperscale overview','https://learn.microsoft.com/en-us/azure/azure-sql/database/service-tier-hyperscale']]};

/* ---------- 3: Backups and PITR ---------- */
L['mss-az:1:3']={blocks:[
{p:'Azure SQL Database takes **automatic backups**. You do not schedule them. You choose **retention** and **redundancy**, and you can restore.'},
{svg:bk},
{t:[['Backup','Frequency','Retention'],
['**Full**','Weekly','Part of PITR retention'],
['**Differential**','Every 12 or 24 hours','Part of PITR retention'],
['**Log**','About every 5 to 10 minutes','Part of PITR retention'],
['**Long-term retention (LTR)**','Weekly, monthly, yearly policy','Up to 10 years']]},
{code:`# Point-in-time restore to a NEW database
az sql db restore --dest-name SalesDB_restored --name SalesDB --resource-group rg-sales \\
   --server sql-sales-prod --time "2026-10-10T14:19:00Z"`},
{ul:['Restores always create a **new database**. You then swap names or copy data back.','**Deleted databases** can be restored within the retention period.','**Geo-restore** uses geo-redundant backups for regional disaster.','Backup **storage redundancy** can be local, zone or geo redundant.']}],
src:[['Automated backups','https://learn.microsoft.com/en-us/azure/azure-sql/database/automated-backups-overview'],['Long-term retention','https://learn.microsoft.com/en-us/azure/azure-sql/database/long-term-retention-overview']]};

/* ---------- 4: Scaling and monitoring ---------- */
L['mss-az:1:4']={blocks:[
{p:'Scaling is quick and **monitoring** is built in, so tune with data, not assumptions.'},
{svg:sc},
{h:'Scaling'},
{ul:['**Scale up or down** by changing vCores or tier. A short connection drop can occur at the switch, so use retry logic.','**Read scale-out** and **geo-replicas** distribute reads and provide DR.','**Elastic jobs** and automation can scale on a schedule.']},
{h:'Monitoring'},
{t:[['Tool','Use'],
['**Metrics in Azure Monitor**','CPU, DTU, workers, storage, connections'],
['**Query Store**','On by default: top queries, regressions, plan forcing'],
['**Query Performance Insight**','Portal view of top consumers'],
['**Automatic tuning**','Create or drop indexes, force last good plan'],
['**Alerts and Log Analytics**','Notify and analyze logs']]},
{code:`-- Resource use in the last hour (Azure SQL Database)
SELECT TOP (20) end_time, avg_cpu_percent, avg_data_io_percent, avg_log_write_percent, max_worker_percent
FROM   sys.dm_db_resource_stats ORDER BY end_time DESC;`}],
src:[['Monitor Azure SQL Database','https://learn.microsoft.com/en-us/azure/azure-sql/database/monitor-tune-overview'],['Automatic tuning','https://learn.microsoft.com/en-us/azure/azure-sql/database/automatic-tuning-overview']]};

})();
