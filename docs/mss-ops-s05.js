/* LearnSphere - SQL Server Operations, Monitoring & Automation, Section 05: Resource Governor & Capacity.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const rg=M.dg(700,220,[
[10,80,130,60,'New session|login',0],[170,80,150,60,'Classifier function|chooses a group',2],
[360,15,160,55,'Workload group|ReportingGroup',0],[360,85,160,55,'Workload group|AppGroup',0],[360,155,160,55,'Workload group|default',0],
[560,35,130,60,'Resource pool|Reporting|max 30 percent CPU',2],[560,125,130,60,'Resource pool|App|min 40 percent',2]],
[[140,110,170,110],[320,110,360,42],[320,110,360,112],[320,110,360,182],[520,42,560,65],[520,112,560,155]]);

const lim=M.dg(700,200,[
[10,15,215,170,'Pool settings',1],[25,50,185,30,'MIN / MAX CPU percent',2],[25,90,185,30,'MIN / MAX memory percent',0],[25,130,185,30,'MIN / MAX IOPS per volume',0],
[245,15,215,170,'Group settings',1],[260,50,185,30,'MAX_DOP',2],[260,90,185,30,'Memory grant cap',0],[260,130,185,30,'GROUP_MAX_REQUESTS',0],
[480,15,210,170,'Remember',1],[495,50,180,30,'Enterprise edition',2],[495,90,180,30,'Applies at login',0],[495,130,180,30,'Test before enabling',0]],
[]);

const cap=M.dg(700,170,[
[10,25,150,70,'Collect|size, CPU, I/O,|per period',0],[190,25,150,70,'Trend|growth per month',2],[370,25,150,70,'Forecast|when we run out',2],[550,25,140,70,'Act|plan, buy, tune|before it hurts',0],
[10,115,680,40,'Capacity work is mostly arithmetic on history you kept. Without history there is nothing to forecast.',0]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

const size=M.dg(700,170,[
[10,25,200,70,'Measure real use|CPU average and peak,|memory, I/O',2],[250,25,200,70,'Compare to allocation|cores, memory,|edition, tier',0],[490,25,200,70,'Adjust|resize, consolidate,|retire',2],
[10,115,680,40,'In per-core licensing, each unneeded core costs money every year',0]],
[[210,60,250,60],[450,60,490,60]]);

/* ---------- 0: Resource Governor basics ---------- */
L['mss-ops:4:0']={blocks:[
{p:'**Resource Governor** limits how much CPU, memory and I/O a group of sessions can use. It stops one workload, such as a heavy report, from starving others.'},
{svg:rg},
{h:'Parts'},
{t:[['Part','Role'],
['**Classifier function**','Runs at login and returns the workload group name'],
['**Workload group**','Holds sessions, with request-level settings such as MAX_DOP'],
['**Resource pool**','The slice of CPU, memory and I/O that groups use'],
['**Default group and pool**','Used when nothing else matches']]},
{h:'When to use it'},
{ul:['**Reporting** and OLTP share one instance.','A **batch job** must not slow the application.','You must **protect** a critical application and cap everything else.']},
{note:'Resource Governor is an Enterprise edition feature. Try it first in a test environment, because a wrong classifier can place all users in a tight pool.'}],
src:[['Resource Governor',M.RD+'resource-governor/resource-governor'],['Resource Governor concepts',M.RD+'resource-governor/resource-governor-resource-pool']]};

/* ---------- 1: Workload groups and pools ---------- */
L['mss-ops:4:1']={blocks:[
{p:'Pools control **how much** resource is available. Groups control **how each request** behaves. The classifier connects sessions to groups.'},
{svg:lim},
{code:`-- Pools and groups
CREATE RESOURCE POOL ReportPool WITH (MAX_CPU_PERCENT = 30, MAX_MEMORY_PERCENT = 30);
CREATE WORKLOAD GROUP ReportGroup WITH (MAX_DOP = 4, REQUEST_MAX_MEMORY_GRANT_PERCENT = 10)
  USING ReportPool;

-- Classifier in master
GO
CREATE FUNCTION dbo.rg_classifier() RETURNS sysname WITH SCHEMABINDING AS
BEGIN
  RETURN CASE WHEN APP_NAME() LIKE N'ReportingApp%' THEN N'ReportGroup' ELSE N'default' END;
END;
GO
ALTER RESOURCE GOVERNOR WITH (CLASSIFIER_FUNCTION = dbo.rg_classifier);
ALTER RESOURCE GOVERNOR RECONFIGURE;

-- Check
SELECT g.name, g.total_request_count, g.active_request_count, p.name AS pool
FROM   sys.dm_resource_governor_workload_groups g
JOIN   sys.dm_resource_governor_resource_pools p ON p.pool_id = g.pool_id;`},
{h:'Notes'},
{ul:['MAX CPU is a **soft cap** when the CPU is idle. Use CAP_CPU_PERCENT for a hard cap.','The classifier must be **fast and simple**, because it runs on every login.','Use a **dedicated admin connection** if you misconfigure and cannot log in.']}],
src:[['Create a resource pool',M.RD+'resource-governor/create-a-resource-pool'],['Create a classifier function',M.RD+'resource-governor/create-and-test-a-classifier-user-defined-function']]};

/* ---------- 2: Capacity planning ---------- */
L['mss-ops:4:2']={blocks:[
{p:'**Capacity planning** answers: when will we run out of disk, memory, CPU or I/O, and what will we do before that?'},
{svg:cap},
{code:`-- Database size by month from backup history (a free source of history)
SELECT database_name,
       DATEFROMPARTS(YEAR(backup_start_date), MONTH(backup_start_date), 1) AS month_start,
       MAX(backup_size)/1073741824.0 AS size_gb
FROM   msdb.dbo.backupset
WHERE  type = 'D'
GROUP  BY database_name, DATEFROMPARTS(YEAR(backup_start_date), MONTH(backup_start_date), 1)
ORDER  BY database_name, month_start;`},
{h:'What to track'},
{t:[['Resource','Measure','Trend'],
['**Storage**','Data and log size, free space on volumes','GB per month'],
['**CPU**','Average and peak by hour and day','Percent, runnable tasks'],
['**Memory**','PLE, grants pending, buffer pool use','Pressure signs'],
['**I/O**','Latency and throughput per file','Latency growth'],
['**Workload**','Batch requests, users, data volume','Business growth']]},
{note:'Tie technical growth to **business drivers** such as customers or transactions. It makes forecasts more reliable than a straight line.'}],
src:[['backupset',M.RD+'system-tables/backupset-transact-sql'],['sys.dm_db_file_space_usage',M.RD+'system-dynamic-management-views/sys-dm-db-file-space-usage-transact-sql']]};

/* ---------- 3: Right-sizing and cost ---------- */
L['mss-ops:4:3']={blocks:[
{p:'**Right-sizing** matches resources to real need. In SQL Server it often reduces license cost, because Enterprise and Standard editions are licensed **per core**.'},
{svg:size},
{h:'Where savings usually are'},
{t:[['Area','Idea'],
['**Over-provisioned cores**','Reduce vCPU or cores after measuring peaks'],
['**Wrong edition**','Standard instead of Enterprise if features are not used; Developer for non-production'],
['**Idle instances**','Consolidate small ones, retire unused'],
['**Storage**','Compression, archiving, data purging'],
['**Cloud**','Reserved capacity, serverless for spiky workloads, Azure Hybrid Benefit']]},
{h:'Careful with'},
{ul:['**Sizing for averages**: look at peaks, month end and batch windows.','**Removing headroom** completely: leave margin for growth and failover.','**Features in use** that need Enterprise: check usage before downgrading (sys.dm_db_persisted_sku_features).']},
{code:`-- Enterprise-only features in use in this database
SELECT feature_name FROM sys.dm_db_persisted_sku_features;`}],
src:[['SQL Server licensing guidance','https://www.microsoft.com/en-us/licensing/product-licensing/sql-server'],['sys.dm_db_persisted_sku_features',M.RD+'system-dynamic-management-views/sys-dm-db-persisted-sku-features-transact-sql']]};

})();
