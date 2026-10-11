/* LearnSphere - SQL Server Azure SQL & Hybrid, Section 01: Choosing the Platform.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const plat=M.dg(700,240,[
[10,10,680,220,'Azure SQL family: how much do you manage?',1],
[30,50,190,70,'SQL Server on VM|IaaS|you manage OS|and engine',0],[255,50,190,70,'SQL Managed Instance|PaaS|near full engine|compatibility',2],[480,50,190,70,'SQL Database|PaaS|database scope,|most managed',2],
[30,140,640,70,'From left to right: less control, less administration, more built-in HA,|backups and patching. Pick the least control you can live with.',0]],
[[220,85,255,85],[445,85,480,85]]);

const pur=M.dg(700,200,[
[10,15,330,170,'DTU model',1],[25,50,300,30,'Bundled measure of CPU, memory, I/O',2],[25,90,300,30,'Basic, Standard, Premium',0],[25,130,300,40,'Simple, less flexible, SQL Database only',0],
[360,15,330,170,'vCore model',1],[375,50,300,30,'Choose vCores, memory and storage',2],[375,90,300,30,'General Purpose, Business Critical, Hyperscale',0],[375,130,300,40,'Flexible, Hybrid Benefit, reserved capacity',0]],
[]);

const tier=M.dg(700,220,[
[10,15,215,190,'General Purpose',1],[25,50,185,30,'Remote storage',0],[25,90,185,30,'Typical latency ms',0],[25,130,185,30,'Most workloads',2],[25,170,185,28,'Lower cost',0],
[245,15,215,190,'Business Critical',1],[260,50,185,30,'Local SSD, replicas',0],[260,90,185,30,'Low latency',0],[260,130,185,30,'Readable replica',2],[260,170,185,28,'Higher cost',0],
[480,15,210,190,'Hyperscale',1],[495,50,180,30,'Very large databases',0],[495,90,180,30,'Fast scale and restore',0],[495,130,180,30,'Read replicas',2],[495,170,180,28,'Distinct architecture',0]],
[]);

const dec=M.dg(700,260,[
[10,10,680,50,'Do you need OS access, third-party agents or unsupported features?',2],
[10,90,320,50,'Yes: SQL Server on Azure VM',0],[370,90,320,50,'No: continue',0],
[370,160,320,45,'Need instance features such as|Agent or cross-database queries?',2],
[10,230,320,28,'Yes: Managed Instance',0],[370,230,320,28,'No: Azure SQL Database',0]],
[[350,60,350,90],[340,115,370,115],[530,140,530,160],[350,205,170,230],[530,205,530,230]]);

/* ---------- 0: Platform comparison ---------- */
L['mss-az:0:0']={blocks:[
{p:'Azure offers SQL Server as **three** main options. They share the same engine family but differ in **who manages what**.'},
{svg:plat},
{t:[['','SQL Server on Azure VM','Azure SQL Managed Instance','Azure SQL Database'],
['**Model**','IaaS','PaaS','PaaS'],
['**Compatibility**','100 percent','Very high (near 100 percent)','High, database scoped'],
['**You manage**','OS, patching, backups, HA','Databases, security, performance','Database, security, performance'],
['**Agent, cross-DB queries, linked servers**','Yes','Yes (with limits)','No Agent, elastic jobs instead'],
['**Built-in HA and backups**','You build them','Yes','Yes'],
['**Version**','You choose','Always current (evergreen)','Always current'],
['**Best for**','Lift and shift with special needs','Migration of instance-heavy systems','New apps, SaaS, many small databases']]},
{h:'Key definitions'},
{ul:['**IaaS**: you rent virtual machines and manage the stack above them.','**PaaS**: the provider manages the platform: patching, backups and HA are built in.','**Evergreen**: the service is updated by Microsoft, so you do not choose the patch window in detail.']}],
src:[['Azure SQL documentation','https://learn.microsoft.com/en-us/azure/azure-sql/'],['Compare Azure SQL options','https://learn.microsoft.com/en-us/azure/azure-sql/azure-sql-iaas-vs-paas-what-is-overview']]};

/* ---------- 1: DTU vs vCore ---------- */
L['mss-az:0:1']={blocks:[
{p:'Azure SQL Database offers two **purchasing models**. They decide how you choose and pay for resources.'},
{svg:pur},
{h:'What a DTU is'},
{p:'A **DTU (database transaction unit)** is a blended measure of CPU, memory and I/O. A higher DTU level means more of all three. It is simple, but you cannot tune CPU and memory separately.'},
{t:[['','DTU','vCore'],
['**Unit**','DTU (bundle)','vCores, memory per vCore, storage'],
['**Transparency**','Low','High'],
['**Flexibility**','Fixed tiers','Pick compute and storage, serverless, reserved capacity'],
['**Licensing benefit**','No','Azure Hybrid Benefit for existing licenses'],
['**Available for**','SQL Database only','SQL Database and Managed Instance']]},
{note:'Microsoft recommends the vCore model for most new deployments because it is more flexible and transparent. DTU can be fine for small, simple workloads.'}],
src:[['Purchasing models','https://learn.microsoft.com/en-us/azure/azure-sql/database/purchasing-models'],['DTU model','https://learn.microsoft.com/en-us/azure/azure-sql/database/service-tiers-dtu']]};

/* ---------- 2: Service tiers and sizing ---------- */
L['mss-az:0:2']={blocks:[
{p:'In the vCore model you pick a **service tier**, a **compute size** and storage. The tier decides the architecture behind the database.'},
{svg:tier},
{t:[['Tier','Architecture','Strengths'],
['**General Purpose**','Compute separated from remote storage','Balanced, cost effective'],
['**Business Critical**','Local SSD with several replicas (Always On inside)','Lowest latency, readable replica, fast failover'],
['**Hyperscale**','Page servers, log service, distributed storage','Very large databases, fast backup and restore, scale out replicas']]},
{h:'How to size'},
{flow:['Use your **baseline**: CPU, memory, I/O and storage from the current server','Run the **assessment** that recommends a size','Start with the recommendation, **measure** and adjust','Review **monthly**: scaling is quick and reversible']},
{note:'Sizing for the peak minute makes things expensive. Use serverless or scheduled scaling for spiky workloads where it fits.'}],
src:[['vCore service tiers','https://learn.microsoft.com/en-us/azure/azure-sql/database/service-tiers-sql-database-vcore'],['Hyperscale overview','https://learn.microsoft.com/en-us/azure/azure-sql/database/service-tier-hyperscale']]};

/* ---------- 3: Decision tree ---------- */
L['mss-az:0:3']={blocks:[
{p:'A short set of questions leads to a sensible default platform. Always confirm with an assessment of the real workload.'},
{svg:dec},
{h:'Other points that change the answer'},
{t:[['Question','Leans toward'],
['Many small databases with variable load?','SQL Database elastic pool'],
['Single very large database or rapid growth?','Hyperscale'],
['Need features not available in PaaS (some components, custom OS)?','SQL Server on VM'],
['Need minimal admin and fast delivery?','Managed Instance or SQL Database'],
['Strict network isolation?','Managed Instance in a VNet or SQL Database with private endpoint'],
['Need to reuse licenses?','vCore with Azure Hybrid Benefit']]},
{note:'The decision is not final. Moving later between Azure SQL options is possible, but it is a migration, so it is better to choose well at the start.'}],
src:[['Choose the right option','https://learn.microsoft.com/en-us/azure/azure-sql/azure-sql-iaas-vs-paas-what-is-overview'],['Feature comparison','https://learn.microsoft.com/en-us/azure/azure-sql/database/features-comparison']]};

})();
