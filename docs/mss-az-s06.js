/* LearnSphere - SQL Server Azure SQL & Hybrid, Section 06: Hybrid & Fabric.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const arc=M.dg(700,220,[
[10,15,260,190,'On premises or other cloud',1],[25,55,230,50,'SQL Server instance',0],[25,115,230,50,'Azure Arc agent|and SQL extension',2],
[420,15,270,190,'Azure portal and services',1],[435,55,240,50,'Arc-enabled SQL Server resource',2],[435,115,240,50,'Governance, security,|monitoring, licensing',0]],
[[255,140,435,140]]);

const bpa=M.dg(700,170,[
[10,25,150,70,'Enable|assessment on|Arc server',0],[190,25,150,70,'Scheduled run|checks against best|practice rules',2],[370,25,150,70,'Results in|Log Analytics',0],[550,25,140,70,'Prioritize and|fix findings',2],
[10,115,680,40,'Rule sets cover configuration, performance and security. Use results as a to-do list.',0]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

const hdr=M.dg(700,200,[
[10,15,215,170,'Backup',1],[25,50,185,30,'Backup to URL',2],[25,90,185,30,'Immutable storage',0],[25,130,185,30,'Tested restore',0],
[245,15,215,170,'Replication to Azure',1],[260,50,185,30,'AG or distributed AG',2],[260,90,185,30,'Managed Instance link',0],[260,130,185,30,'Log shipping',0],
[480,15,210,170,'Plan',1],[495,50,180,30,'RPO and RTO',2],[495,90,180,30,'Network path',0],[495,130,180,30,'Failback',0]],
[]);

const fab=M.dg(700,200,[
[10,35,170,70,'SQL Server or|Azure SQL|transactional data',0],[220,35,170,70,'Change feed|committed changes|read from the log',2],[430,35,130,70,'OneLake|Delta Parquet|mirrored copy',2],[600,35,90,70,'Fabric|analytics,|BI, AI',0],
[10,130,680,55,'No ETL pipeline to build. The mirror stays close to real time, and queries on it do not load the source.',0]],
[[180,70,220,70],[390,70,430,70],[560,70,600,70]]);

/* ---------- 0: Azure Arc ---------- */
L['mss-az:5:0']={blocks:[
{p:'**Azure Arc-enabled SQL Server** projects SQL Server instances that run **outside Azure** (on premises, other clouds) into Azure as resources. You get Azure management features for servers you still host yourself.'},
{svg:arc},
{h:'What you get'},
{t:[['Capability','Benefit'],
['**Inventory**','A single view of instances, versions and databases'],
['**Best practices assessment**','Scheduled checks, results in Azure'],
['**Microsoft Defender**','Vulnerability and threat detection'],
['**Entra authentication**','Entra sign-in for SQL Server 2022 and later'],
['**Pay-as-you-go licensing**','Billing through Azure for SQL Server licenses'],
['**Updates and governance**','Azure Policy, tags, monitoring integration']]},
{note:'Arc needs outbound connectivity from the server to Azure endpoints and an agent installed. Review network and security requirements first.'}],
src:[['SQL Server enabled by Azure Arc','https://learn.microsoft.com/en-us/sql/sql-server/azure-arc/overview'],['Connect your SQL Server to Azure Arc','https://learn.microsoft.com/en-us/sql/sql-server/azure-arc/connect']]};

/* ---------- 1: Best practices assessment ---------- */
L['mss-az:5:1']={blocks:[
{p:'The **Best practices assessment** runs a set of checks against an instance and reports where it differs from recommended configuration.'},
{svg:bpa},
{h:'What it covers'},
{ul:['**Configuration**: memory, MAXDOP, tempdb, trace flags.','**Security**: authentication mode, sa, surface area.','**Performance and reliability**: backups, CHECKDB, statistics settings, file layout.','**Version support** and update level.']},
{t:[['Step','Detail'],
['**Enable**','On an Arc-enabled instance, or on an Azure VM with the IaaS extension'],
['**Schedule**','Weekly runs'],
['**Review**','Results in Log Analytics workspace with severity and recommendation'],
['**Act**','Fix, or document why an exception is acceptable']]},
{note:'Treat findings as a prioritized to-do list. Not all will apply to your workload, so record decisions, so the next review is quick.'}],
src:[['Best practices assessment','https://learn.microsoft.com/en-us/sql/sql-server/azure-arc/assess'],['Assessment for Azure VMs','https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/sql-assessment-for-sql-vm']]};

/* ---------- 2: Hybrid backup and DR ---------- */
L['mss-az:5:2']={blocks:[
{p:'Azure can be the **DR site** or the **backup target** for on-premises SQL Server, which avoids building and running a second datacenter.'},
{svg:hdr},
{t:[['Pattern','How','Notes'],
['**Backup to URL**','On-premises backups written to Azure Blob','Off-site copy, tiers and immutability'],
['**AG replica in Azure VM**','Asynchronous replica in a VM, over VPN or ExpressRoute','Failover target with data loss risk of async'],
['**Distributed AG**','On-premises AG to AG in Azure','Cross-cluster DR and migration'],
['**Managed Instance link**','Near real-time replication to a Managed Instance','DR and read offload, PaaS target'],
['**Log shipping**','Logs to a VM or MI','Simple, delayed']]},
{h:'Plan'},
{ul:['**Network**: bandwidth and latency for log traffic and seeding.','**Identity and DNS** in the DR location.','**Runbook and failback**: you will need to return.','**Cost**: running replicas and storage in Azure.']}],
src:[['Hybrid disaster recovery','https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/hadr-cluster-best-practices'],['Managed Instance link','https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-feature-overview']]};

/* ---------- 3: Fabric mirroring ---------- */
L['mss-az:5:3']={blocks:[
{p:'**Mirroring in Microsoft Fabric** continuously replicates operational data into **OneLake** in Delta format, so analytics, BI and AI can use it without an ETL pipeline.'},
{svg:fab},
{h:'Key points'},
{ul:['Available for **Azure SQL Database**, and for **SQL Server 2025** using a **change feed** that reads committed changes from the log.','Data lands as **Delta Parquet** tables in OneLake, queryable through a SQL analytics endpoint and Spark.','**Reads on the mirror** do not use compute of the source database.','Needs **Arc** (for on-premises SQL Server) and appropriate permissions.']},
{h:'Considerations'},
{t:[['Topic','Check'],
['**Supported objects and types**','Tables and data types that can be mirrored'],
['**Latency**','Near real time, not transactional'],
['**Costs**','Storage and Fabric capacity'],
['**Governance**','Who can read the mirrored data']]},
{note:'Features and limits evolve quickly. Use the current Microsoft Fabric and SQL Server 2025 documentation when you design.'}],
src:[['Mirroring in Fabric','https://learn.microsoft.com/en-us/fabric/database/mirrored-database/overview'],['What is new in SQL Server 2025',M.SS+'what-s-new-in-sql-server-2025']]};

})();
