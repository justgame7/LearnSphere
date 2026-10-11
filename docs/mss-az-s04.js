/* LearnSphere - SQL Server Azure SQL & Hybrid, Section 04: SQL Server on Azure VMs.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const lay=M.dg(700,220,[
[10,10,680,200,'Storage layout of a SQL Server VM',1],
[30,50,190,60,'Data disks|Premium SSD v2 or P30+|caching ReadOnly',2],[255,50,190,60,'Log disk|separate, caching None|low latency',2],[480,50,190,60,'tempdb|local ephemeral D:|or its own disk',0],
[30,130,640,60,'Stripe several disks (Storage Spaces) for IOPS and throughput.|Choose a VM size that allows the IOPS you provision, because the VM caps disk throughput.',0]],
[]);

const ext=M.dg(700,200,[
[10,15,680,170,'SQL Server IaaS Agent extension',1],
[30,55,200,50,'Portal management|settings and license type',2],[255,55,200,50,'Automated backup|to Azure storage',0],[480,55,190,50,'Automated patching|maintenance window',0],
[30,120,200,50,'Best practices|assessment',0],[255,120,200,50,'Storage configuration|from the portal',0],[480,120,190,50,'Entra and Key Vault|integration',0]],
[]);

const bkp=M.dg(700,160,[
[10,25,200,70,'Automated backup|retention 1 to 90 days|full and log',0],[250,25,200,70,'Backup to URL|to a storage account|encrypted option',2],[490,25,200,70,'Or your own|Agent jobs and|maintenance solution',0]],
[]);

const ha=M.dg(700,220,[
[10,15,330,190,'Availability group in Azure',1],[25,50,300,30,'Replicas in availability zones',2],[25,90,300,30,'Listener via load balancer or DNN',0],[25,130,300,30,'Cloud witness for quorum',0],[25,170,300,28,'Synchronous commit within a region',0],
[360,15,330,190,'FCI in Azure',1],[375,50,300,30,'Azure shared disks or S2D',2],[375,90,300,30,'Multiple zones with shared disk',0],[375,130,300,30,'Same WSFC and FCI concepts',0],[375,170,300,28,'Listener via load balancer or DNN',0]],
[]);

/* ---------- 0: Sizing and storage ---------- */
L['mss-az:3:0']={blocks:[
{p:'On an Azure VM, **VM size** and **disk layout** decide performance. The VM limits IOPS and throughput, and so do the disks, so both must match.'},
{svg:lay},
{h:'Guidelines'},
{t:[['Area','Recommendation'],
['**VM family**','Memory-optimized (E-series) or M-series for large memory; check the SQL Server on Azure VM checklist'],
['**Data disks**','Premium SSD or Premium SSD v2, ReadOnly host caching'],
['**Log disk**','Separate disk, caching None, low latency'],
['**tempdb**','Local temporary disk where suitable, or a dedicated disk'],
['**Striping**','Storage Spaces on Windows or LVM on Linux for more IOPS'],
['**Network**','Accelerated networking enabled']]},
{note:'Check the VM size limits for IOPS and MB/s. A fast disk behind a small VM size still goes slowly.'}],
src:[['Performance guidelines for SQL Server on Azure VMs','https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/performance-guidelines-best-practices-checklist'],['Storage best practices','https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/performance-guidelines-best-practices-storage']]};

/* ---------- 1: IaaS agent extension ---------- */
L['mss-az:3:1']={blocks:[
{p:'The **SQL Server IaaS Agent extension** connects the VM to the Azure portal and adds management features. It registers the VM as a **SQL virtual machine** resource.'},
{svg:ext},
{h:'Modes and what you get'},
{t:[['Feature','Detail'],
['**Registration**','Needed for portal management and license benefits'],
['**License type**','Pay as you go, Azure Hybrid Benefit, or disaster recovery'],
['**Automated backup**','Scheduled backups to a storage account, with retention'],
['**Automated patching**','Windows and SQL Server updates in a maintenance window'],
['**Best practices assessment**','Scheduled checks with a report']]},
{ul:['Register VMs created from marketplace images and **your own** images.','Keep the extension **up to date**.','Understand that it **does not replace** your own monitoring and tested restores.']}],
src:[['SQL Server IaaS Agent extension','https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/sql-server-iaas-agent-extension-automate-management'],['SQL virtual machine resource provider','https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/manage-sql-vm-portal']]};

/* ---------- 2: Backup and patching ---------- */
L['mss-az:3:2']={blocks:[
{p:'On a VM, backups and patching are **your** responsibility, but Azure provides tools that automate them.'},
{svg:bkp},
{h:'Options for backup'},
{t:[['Option','Notes'],
['**Automated Backup** (extension)','Simple, retention up to 90 days, backups to storage account'],
['**Backup to URL** with your own jobs','Full control of schedule and naming'],
['**Azure Backup for SQL in VMs**','Central policies, vault, long retention'],
['**Maintenance solution**','As on-premises, with backup to URL or disk']]},
{h:'Patching'},
{ul:['**Automated patching** applies Windows and SQL updates in a defined window.','For **AGs** and **FCIs**, patch one node at a time with your own procedure.','**Test** updates in a non-production environment first.']},
{note:'Verify restores regardless of the tool. An automated backup that was never restored is the same risk as on-premises.'}],
src:[['Automated backup for SQL Server VMs','https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/automated-backup'],['Azure Backup for SQL in Azure VMs','https://learn.microsoft.com/en-us/azure/backup/backup-azure-sql-database']]};

/* ---------- 3: HA options ---------- */
L['mss-az:3:3']={blocks:[
{p:'High availability on VMs uses the same technologies as on-premises, adapted to Azure networking and storage.'},
{svg:ha},
{t:[['Requirement','Option'],
['**Protect against host failure**','Availability set or zones, with AG or FCI'],
['**Protect against datacenter failure in a region**','Availability zones'],
['**Disaster recovery to another region**','Asynchronous AG replica, or distributed AG, or backup and restore'],
['**Simple HA on Standard edition**','Basic AG']]},
{h:'Azure-specific points'},
{ul:['**Listener** needs an internal load balancer or a **distributed network name (DNN)**.','**Cloud witness** is the simplest quorum witness.','**Azure shared disks** and **Storage Spaces Direct** enable FCIs.','**SLA** depends on the design: zones and multiple VMs give the higher levels.']}],
src:[['High availability for SQL Server on Azure VMs','https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/business-continuity-high-availability-disaster-recovery-hadr-overview'],['AG in Azure with DNN','https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/availability-group-distributed-network-name-dnn-listener-configure']]};

})();
