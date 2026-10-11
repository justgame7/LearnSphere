/* LearnSphere - SQL Server Upgrade, Patching & Migration, Section 04: Migrating to Azure.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const path=M.dg(700,220,[
[10,15,680,190,'Azure targets, from most control to most managed',1],
[30,55,190,60,'SQL Server on Azure VM|full SQL Server|you manage OS and engine',0],[255,55,190,60,'Azure SQL Managed Instance|near 100 percent|compatible, managed',2],[480,55,190,60,'Azure SQL Database|single DB or pool|most managed',0],
[30,135,640,55,'More managed means less administration and fewer instance-level features.|The assessment tells you what fits.',0]],
[[220,85,255,85],[445,85,480,85]]);

const mig=M.dg(700,170,[
[10,25,150,70,'Discover|inventory and|assess readiness',0],[185,25,150,70,'Size|recommend target|and cost',0],[360,25,150,70,'Migrate|offline or|online',2],[535,25,155,70,'Optimize|monitor, tune,|cost review',0]],
[[160,60,185,60],[335,60,360,60],[510,60,535,60]]);

const dms=M.dg(700,200,[
[10,20,170,70,'Source SQL Server|backups to Azure storage',0],[215,20,170,70,'Azure Database|Migration Service|orchestrates',2],[420,20,130,70,'Target|MI or VM or DB',0],
[10,115,680,70,'Offline: restore backups, cutover when done. Online: keep applying log until you cut over, so downtime is short.',0]],
[[180,55,215,55],[385,55,420,55]]);

const mi=M.dg(700,170,[
[10,25,170,70,'Assess|Managed Instance|compatibility',0],[205,25,170,70,'Prepare|network, VNet,|storage account',0],[400,25,150,70,'Restore|native from URL,|or LRS, or link',2],[575,25,115,70,'Cutover|and validate',2],
[10,115,680,40,'Managed Instance supports native backup from Azure Blob and keeps most instance features',0]],
[[180,60,205,60],[375,60,400,60],[550,60,575,60]]);

/* ---------- 0: Azure Migrate and assessments ---------- */
L['mss-upg:3:0']={blocks:[
{p:'Moving to Azure starts with **discovery and assessment**. The assessment tells you which target is **ready**, what to change, and what it costs.'},
{svg:path},
{svg:mig},
{h:'What an assessment gives you'},
{t:[['Output','Use'],
['**Readiness** per target (VM, Managed Instance, SQL Database)','Which targets can host the workload'],
['**Blocking issues**','Features that must change'],
['**Recommended size**','Service tier, vCores, storage based on performance data'],
['**Estimated cost**','Compare targets and licensing options']]},
{h:'Typical targets'},
{ul:['**SQL Server on Azure VM**: full compatibility, you manage OS and SQL Server.','**Azure SQL Managed Instance**: very high compatibility, platform managed.','**Azure SQL Database**: most managed, database scoped, fewer instance features.']},
{note:'Collect performance data over a representative period so sizing is based on real load, not on guesses.'}],
src:[['Azure Migrate for SQL Server','https://learn.microsoft.com/en-us/azure/migrate/concepts-azure-sql-assessment-calculation'],['Migrate SQL Server to Azure','https://learn.microsoft.com/en-us/azure/azure-sql/migration-guides/']]};

/* ---------- 1: Azure Database Migration Service ---------- */
L['mss-upg:3:1']={blocks:[
{p:'**Azure Database Migration Service (DMS)** orchestrates the move of databases from SQL Server to Azure targets. It offers **offline** and **online** migration modes.'},
{svg:dms},
{t:[['Mode','How it works','Downtime'],
['**Offline**','Back up, restore, then cut over','Whole restore time'],
['**Online**','Restore a full backup then continuously apply log backups','Only the final cutover']]},
{h:'Typical flow'},
{flow:['Create the target in Azure and the migration service','Point the source to a network share or Azure Blob with backups','Start the migration and monitor progress','At the planned time, **cut over** (stop writes, apply last log, bring online)','Switch connection strings and validate']},
{ul:['Take **backups with CHECKSUM** and regular log backups for online mode.','Plan **network connectivity** between source and Azure (VPN, ExpressRoute or public with firewall).','Move **logins and jobs** separately: DMS has options, but verify.']},
{note:'Tooling and portals change often. Follow the current Microsoft migration guide for your source and target when you plan.'}],
src:[['Azure Database Migration Service','https://learn.microsoft.com/en-us/azure/dms/dms-overview'],['Migration guides for SQL Server to Azure','https://learn.microsoft.com/en-us/data-migration/']]};

/* ---------- 2: Managed Instance ---------- */
L['mss-upg:3:2']={blocks:[
{p:'**Azure SQL Managed Instance** is the closest PaaS match to an on-premises instance: SQL Agent, cross-database queries, linked servers, and native backup and restore are supported.'},
{svg:mi},
{h:'Migration options'},
{t:[['Option','Notes'],
['**Native restore from URL**','Back up to Azure Blob, restore with RESTORE FROM URL: offline'],
['**Log Replay Service (LRS)**','Continuous log restore from Blob: online with a cutover'],
['**Managed Instance link**','Near real-time replication using an AG technology, two-way possible'],
['**DMS**','Orchestrates restore or LRS']]},
{code:`-- On the Managed Instance: restore from Azure Blob using a credential
RESTORE DATABASE SalesDB
  FROM URL = 'https://mystorage.blob.core.windows.net/backups/SalesDB.bak';`},
{h:'Plan for'},
{ul:['**VNet and subnet** design: a Managed Instance lives in your virtual network.','**Deployment time**: creating or scaling can take hours.','**Differences**: some instance-level and OS-level features are not available.','**Costs and licensing**: vCore model, Azure Hybrid Benefit.']}],
src:[['Migrate to Azure SQL Managed Instance','https://learn.microsoft.com/en-us/azure/azure-sql/migration-guides/managed-instance/sql-server-to-managed-instance-guide'],['Managed Instance link','https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-feature-overview']]};

/* ---------- 3: SQL Server on Azure VMs ---------- */
L['mss-upg:3:3']={blocks:[
{p:'Moving to **SQL Server on an Azure VM** keeps full SQL Server and OS control. It is the lowest-change path and a good first step when many instance features are needed.'},
{h:'Common methods'},
{t:[['Method','Notes'],
['**Backup and restore**','Same as on-premises, with backup to Azure Blob for transfer'],
['**Log shipping or AG**','Extend to Azure, then cut over'],
['**Distributed AG**','Cross-site migration with little downtime'],
['**Azure Site Recovery / Azure Migrate**','Lift and shift the whole VM']]},
{h:'Design points'},
{ul:['**VM size and disks**: choose a memory-optimized size and premium or ultra disks with caching settings as recommended.','**SQL IaaS Agent extension**: automated backup, patching and management in the portal.','**Storage layout**: separate data, log and tempdb disks; follow Azure storage guidance.','**High availability**: AG, FCI with Azure shared disks, or availability zones.','**Licensing**: pay as you go, or bring your license with Azure Hybrid Benefit.']},
{note:'A VM is not a managed database. Patching, backups, monitoring and security remain your responsibility, though the extension helps.'}],
src:[['Migrate to SQL Server on Azure VM','https://learn.microsoft.com/en-us/azure/azure-sql/migration-guides/virtual-machines/sql-server-to-sql-on-azure-vm-individual-databases-guide'],['Performance best practices for SQL Server on Azure VMs','https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/performance-guidelines-best-practices-checklist']]};

})();
