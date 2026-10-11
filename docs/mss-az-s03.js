/* LearnSphere - SQL Server Azure SQL & Hybrid, Section 03: Azure SQL Managed Instance.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const arch=M.dg(700,240,[
[10,10,680,220,'Your virtual network',1],
[30,45,640,170,'Managed Instance subnet (dedicated, delegated)',1],
[50,85,180,60,'Virtual cluster|managed by Azure',0],[260,85,180,60,'Instance SQLMI01|databases, Agent,|cross-DB queries',2],[470,85,180,60,'Storage and backups|managed',0],
[50,160,600,40,'Tiers: General Purpose (remote storage) and Business Critical (local storage, replicas)',0]],
[[230,115,260,115],[440,115,470,115]]);

const net=M.dg(700,200,[
[10,15,215,170,'Subnet',1],[25,50,185,30,'Dedicated to the MI',2],[25,90,185,30,'Delegated to Microsoft.Sql',0],[25,130,185,30,'Enough IPs: plan size',0],
[245,15,215,170,'Rules',1],[260,50,185,30,'NSG and route table',2],[260,90,185,30,'Managed by the service',0],[260,130,185,30,'Do not remove its rules',0],
[480,15,210,170,'Access',1],[495,50,180,30,'Private endpoint',2],[495,90,180,30,'VNet peering or VPN',0],[495,130,180,30,'Optional public endpoint',0]],
[]);

const mig=M.dg(700,170,[
[10,25,150,70,'Assess|compatibility',0],[180,25,150,70,'Prepare|network, storage|account',0],[350,25,150,70,'Restore|URL, LRS, link,|or DMS',2],[520,25,170,70,'Cutover|and validate',2],
[10,115,680,40,'Pick offline restore for simple cases and LRS or link for short downtime',0]],
[[160,60,180,60],[330,60,350,60],[500,60,520,60]]);

const ops=M.dg(700,170,[
[10,25,150,70,'Create|first in subnet:|can take hours',0],[180,25,150,70,'Scale|change vCores or|storage',0],[350,25,150,70,'Update|maintenance|window',0],[520,25,170,70,'One operation|at a time per|instance and subnet',2],
[10,115,680,40,'Management operations are long. Plan time and avoid overlapping them.',0]],
[]);

/* ---------- 0: Architecture ---------- */
L['mss-az:2:0']={blocks:[
{p:'**Azure SQL Managed Instance** is a managed SQL Server **instance** in Azure. It keeps most instance-level features, including SQL Agent, cross-database queries and linked servers, while Azure manages patching, backups and high availability.'},
{svg:arch},
{h:'Key points'},
{ul:['Lives in **your virtual network**, in a dedicated subnet.','Supports **native backup and restore**, which makes migration easy.','Two tiers: **General Purpose** and **Business Critical** (with a readable replica).','**Instance pools** share resources to host many small instances.']},
{t:[['Feature','Managed Instance'],
['SQL Agent','Yes'],
['Cross-database queries and transactions','Yes'],
['CLR, linked servers, Service Broker','Yes (with some limits)'],
['Restore from Azure Blob','Yes'],
['OS access, custom software','No']]},
{note:'Always check the T-SQL differences list for Managed Instance before you plan a migration.'}],
src:[['What is Azure SQL Managed Instance','https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/sql-managed-instance-paas-overview'],['T-SQL differences','https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/transact-sql-tsql-differences-sql-server']]};

/* ---------- 1: Networking ---------- */
L['mss-az:2:1']={blocks:[
{p:'Managed Instance is **VNet-injected**. Network design is the main upfront task, and mistakes are costly because the subnet cannot easily be changed.'},
{svg:net},
{h:'Requirements'},
{t:[['Item','Requirement'],
['**Dedicated subnet**','Only Managed Instances in it, delegated to Microsoft.Sql/managedInstances'],
['**Address space**','Enough addresses for current and future instances and scale operations'],
['**NSG and route table**','Created and managed by the service. Do not delete its rules'],
['**DNS**','Resolve Azure and your names correctly'],
['**Connectivity**','From apps in the VNet, peered networks, VPN or ExpressRoute']]},
{h:'Endpoints'},
{ul:['**VNet-local endpoint** is the default and recommended.','**Private endpoint** adds private access from other networks.','**Public endpoint** is optional, port 3342, and should be restricted with NSG rules.']}],
src:[['Connectivity architecture','https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connectivity-architecture-overview'],['Configure a subnet','https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/vnet-subnet-determine-size']]};

/* ---------- 2: Migrating ---------- */
L['mss-az:2:2']={blocks:[
{p:'Managed Instance is a common target for on-premises instance migrations because of its compatibility. Choose the method by downtime and size.'},
{svg:mig},
{t:[['Method','Downtime','Notes'],
['**Native RESTORE FROM URL**','Backup, upload and restore time','Simple, offline'],
['**Log Replay Service (LRS)**','Short, at cutover','Continuous log restore from Blob, then cutover'],
['**Managed Instance link**','Very short','Near real-time replication with an AG technology, can also be used for DR and reads'],
['**Azure DMS**','Depends on mode','Orchestrates restore or LRS']]},
{h:'Before migrating'},
{ul:['Run an **assessment** for blocking issues.','Plan **logins**, **jobs**, **linked servers** and **certificates**.','Create the **network path** for apps and for backup upload.','Test with a copy and measure **performance**: compare with baseline.']}],
src:[['Migrate to Managed Instance','https://learn.microsoft.com/en-us/azure/azure-sql/migration-guides/managed-instance/sql-server-to-managed-instance-guide'],['Log Replay Service','https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-overview']]};

/* ---------- 3: Management operations ---------- */
L['mss-az:2:3']={blocks:[
{p:'Creating or changing a Managed Instance is **not instant**. Operations run in the background and can take hours.'},
{svg:ops},
{t:[['Operation','Typical duration','Notes'],
['**First instance in a new subnet**','Up to many hours','Network preparation is included'],
['**Instance creation (existing subnet)**','Hours','Depends on tier'],
['**Scale compute or storage**','Minutes to hours','Business Critical and large storage take longer'],
['**Update or maintenance**','In maintenance windows','Short failover at the end']]},
{code:`az sql mi op list --resource-group rg-sales --managed-instance sqlmi01 -o table
az sql mi op show --resource-group rg-sales --managed-instance sqlmi01 --name <operation-id>`},
{ul:['Only **one management operation** can run at a time on an instance.','Use **maintenance windows** to control when updates happen.','**Retry logic** in applications handles the brief failover at the end of an operation.']},
{note:'Plan production changes with the duration in mind. Do not start a scale operation shortly before a business-critical event.'}],
src:[['Management operations','https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/management-operations-overview'],['Maintenance window','https://learn.microsoft.com/en-us/azure/azure-sql/database/maintenance-window']]};

})();
