/* LearnSphere - SQL Server High Availability & DR, Section 03: Failover Cluster Instances.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const arch=M.dg(700,240,[
[10,10,680,220,'One SQL Server instance, many possible hosts',1],
[30,50,180,70,'Node 1|SQL Server runs here|active',2],[260,50,180,70,'Node 2|passive until failover',0],[490,50,180,70,'Virtual network name|SQLFCI01 and IP',0],
[30,150,640,60,'Shared storage: SAN, Storage Spaces Direct, Azure shared disk or SMB share. Only the active node owns it.',0]],
[[210,85,260,85],[440,85,490,85],[120,120,120,150],[350,120,350,150]]);

const inst=M.dg(700,120,[
[10,25,120,60,'1. Cluster ready|storage added',0],[150,25,140,60,'2. New SQL Server|failover cluster|installation',2],[310,25,140,60,'3. Add node|to SQL Server|failover cluster',2],[470,25,100,60,'4. Test|failover',0],[590,25,100,60,'5. Patch|plan',0]],
[[130,55,150,55],[290,55,310,55],[450,55,470,55],[570,55,590,55]]);

const fail=M.dg(700,170,[
[10,25,150,70,'Node 1 fails|or service stops|health check fails',2],[190,25,150,70,'Cluster moves|storage and name|to node 2',0],[370,25,150,70,'SQL Server starts|on node 2|crash recovery',2],[550,25,140,70,'Clients reconnect|same name|brief outage',0],
[10,115,680,40,'Outage is the time to detect, move resources, start and recover databases',0]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

const patch=M.dg(700,150,[
[10,25,150,70,'1. Patch passive|node 2',0],[190,25,150,70,'2. Fail over to|node 2',2],[370,25,150,70,'3. Patch|node 1',0],[550,25,140,70,'4. Optional|fail back',0]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

/* ---------- 0: Architecture ---------- */
L['mss-ha:2:0']={blocks:[
{p:'A **failover cluster instance (FCI)** is a single SQL Server instance installed across several WSFC nodes. Only one node runs it at a time. If that node fails, the instance starts on another node, using the **same storage**.'},
{svg:arch},
{h:'What an FCI protects'},
{t:[['Protected','Not protected'],
['The **whole instance**: databases, logins, jobs, linked servers, server settings','**Shared storage**: if the storage fails, the FCI fails'],
['Failure of a node, OS or SQL Server service','**Data corruption**, user errors: use backups'],
['Planned patching with brief downtime','Databases on a **readable secondary**: an FCI has none']]},
{h:'Storage options'},
{ul:['**SAN** shared between nodes.','**Storage Spaces Direct** using local disks in each node.','**SMB 3** file share, including Azure Files.','**Azure shared disks** for FCIs on Azure VMs.']},
{note:'Because all nodes use one copy of the data, an FCI does not protect against storage loss. For that, combine it with an availability group or log shipping to another storage.'}],
src:[['Always On failover cluster instances',M.SS+'failover-clusters/windows/always-on-failover-cluster-instances-sql-server'],['Storage Spaces Direct','https://learn.microsoft.com/en-us/azure-stack/hci/concepts/storage-spaces-direct-overview']]};

/* ---------- 1: Installing an FCI ---------- */
L['mss-ha:2:1']={blocks:[
{p:'Installing an FCI uses the normal SQL Server Setup, run **once to create** the instance on the first node and **once per additional node** to add it.'},
{svg:inst},
{h:'On the first node'},
{flow:['In Setup choose **New SQL Server failover cluster installation**','Select features, give the **SQL Server network name** and IP','Choose the **cluster disks** for data, log and tempdb','Set service accounts (domain accounts or gMSA, not local)','Finish and check the cluster resources are online']},
{h:'On each other node'},
{flow:['In Setup choose **Add node to a SQL Server failover cluster**','Choose the instance, review accounts and complete']},
{code:`-- Is this an FCI, and where is it running?
SELECT SERVERPROPERTY('IsClustered')            AS is_clustered,
       SERVERPROPERTY('ComputerNamePhysicalNetBIOS') AS current_node;

SELECT NodeName, status_description, is_current_owner FROM sys.dm_os_cluster_nodes;`},
{note:'Use the same service accounts, drive letters and file paths on every node, and keep tempdb on local or fast disk if supported. Applications connect to the **virtual network name**, never to a node name.'}],
src:[['Create a new SQL Server failover cluster',M.SS+'failover-clusters/install/create-a-new-sql-server-failover-cluster-setup'],['sys.dm_os_cluster_nodes',M.RD+'system-dynamic-management-views/sys-dm-os-cluster-nodes-transact-sql']]};

/* ---------- 2: Failover testing ---------- */
L['mss-ha:2:2']={blocks:[
{p:'An FCI that has never been failed over is an assumption, not a design. Test both **planned** and **unplanned** failover before production.'},
{svg:fail},
{t:[['Test','How','What you learn'],
['**Planned move**','Failover Cluster Manager, Move to another node','Normal maintenance outage time, client behavior'],
['**Service stop**','Stop the SQL Server service on the active node','Cluster response to a service failure'],
['**Node failure**','Power off or isolate the active node (in a lab)','Detection time, quorum behavior'],
['**Storage path loss**','Disconnect storage from the active node (lab)','Failover on storage failure']]},
{h:'What to record'},
{ul:['**Time** from failure to first successful application query.','**Errors** applications saw, and whether they reconnected by themselves.','Whether **jobs, logins and linked servers** worked after the move.']},
{h:'Health check'},
{p:'The cluster uses a lease and health check (`sp_server_diagnostics`) to decide when SQL Server is unhealthy. The **failure condition level** controls how sensitive it is. Default is level 3.'},
{code:`SELECT FailureConditionLevel, HealthCheckTimeout FROM sys.dm_os_cluster_properties;`},
{note:'Do not lower the health check to make failover faster until you have measured false positives. A sensitive setting can cause failovers during short stalls.'}],
src:[['Failover policy for FCIs',M.SS+'failover-clusters/windows/failover-policy-for-failover-cluster-instances'],['sp_server_diagnostics',M.RD+'system-stored-procedures/sp-server-diagnostics-transact-sql']]};

/* ---------- 3: Patching an FCI ---------- */
L['mss-ha:2:3']={blocks:[
{p:'An FCI reduces maintenance outage to a **failover**, if you patch in the right order.'},
{svg:patch},
{h:'Rolling update steps'},
{flow:['Confirm the cluster is healthy and the instance is online','Apply the update to the **passive** node and restart it if needed','**Fail over** to the updated node: this is the short outage','Update the former active node','Optionally fail back, then verify']},
{h:'Things to watch'},
{ul:['**Databases upgrade** their internal version when the first updated node starts them: you cannot go back to an older node without a restore, so test first.','Setup updates on a **cluster** update the passive nodes first, then the active one: follow the guide for your update type.','Check **application reconnect** and **jobs** after each move.']},
{note:'Take a full backup and keep a rollback plan. A cumulative update is not designed to be uninstalled once databases have been upgraded.'}],
src:[['Update an FCI',M.SS+'failover-clusters/windows/upgrade-a-sql-server-failover-cluster-instance'],['Servicing SQL Server',M.SS+'install/install-sql-server-servicing-updates']]};

})();
