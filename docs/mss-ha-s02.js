/* LearnSphere - SQL Server High Availability & DR, Section 02: Windows Failover Clustering.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const arch=M.dg(700,240,[
[10,10,680,220,'Windows Server Failover Cluster (WSFC)',1],
[30,50,170,70,'Node 1|cluster service|Windows Server',2],[265,50,170,70,'Node 2|cluster service|Windows Server',2],[500,50,170,70,'Witness|file share, disk or|cloud witness',0],
[30,140,640,35,'Cluster resources: network name, IP addresses, storage, roles that fail over',0],
[30,185,640,35,'Heartbeat over the cluster network decides who is alive',0]],
[[200,85,265,85],[435,85,500,85]]);

const quo=M.dg(700,200,[
[10,15,330,170,'3 votes: node, node, witness',1],[25,55,300,40,'Any 2 votes keep the cluster up',2],[25,105,300,40,'One node lost: 2 of 3, still up',0],[25,155,300,22,'Both nodes cut off: witness decides',0],
[360,15,330,170,'Split brain protection',1],[375,55,300,40,'A partition needs a majority|to keep running',2],[375,105,300,40,'The minority side stops|its cluster roles',0],[375,155,300,22,'Never two primaries',0]],
[]);

const net=M.dg(700,170,[
[10,20,200,70,'Client network|applications connect|to the virtual name',0],[250,20,200,70,'Cluster network|heartbeat and|health checks',2],[490,20,200,70,'Storage network|SAN or SMB|if shared storage',0],
[10,110,680,50,'Separate or redundant paths so one failure does not look like a node failure',0]],
[]);

const build=M.dg(700,120,[
[10,25,120,60,'1. Prepare|nodes, AD, IPs',0],[150,25,120,60,'2. Install role|Failover|Clustering',0],[290,25,120,60,'3. Validate|configuration',2],[430,25,120,60,'4. Create|cluster',0],[570,25,120,60,'5. Add witness|and test',2]],
[[130,55,150,55],[270,55,290,55],[410,55,430,55],[550,55,570,55]]);

/* ---------- 0: Architecture ---------- */
L['mss-ha:1:0']={blocks:[
{p:'**Windows Server Failover Clustering (WSFC)** is the operating system feature that makes a group of servers act as one highly available system. Failover cluster instances and traditional availability groups both depend on it.'},
{svg:arch},
{h:'Key terms'},
{t:[['Term','Meaning'],
['**Node**','A server in the cluster'],
['**Cluster resource**','Something the cluster manages: IP, name, disk, SQL Server service'],
['**Role (group)**','A set of resources that move together'],
['**Quorum**','The voting rule that decides whether the cluster can run'],
['**Witness**','An extra vote, usually a file share, disk or cloud witness'],
['**Cluster network name**','The identity of the cluster in Active Directory']]},
{h:'What the cluster does'},
{ul:['Monitors node and resource **health** with heartbeats.','**Moves** roles to a healthy node when one fails.','Maintains the **configuration** and quorum so there is never more than one active owner.']},
{note:'WSFC needs Active Directory and careful network design. Most "SQL Server cluster problems" are really cluster, network or storage problems underneath.'}],
src:[['Failover clustering in Windows Server','https://learn.microsoft.com/en-us/windows-server/failover-clustering/failover-clustering-overview'],['WSFC with SQL Server',M.SS+'failover-clusters/windows/windows-server-failover-clustering-wsfc-with-sql-server']]};

/* ---------- 1: Quorum ---------- */
L['mss-ha:1:1']={blocks:[
{p:'**Quorum** is the rule that stops two halves of a split cluster from both thinking they are in charge. A cluster runs only while it has **more than half of the votes**.'},
{svg:quo},
{h:'Quorum models'},
{t:[['Model','Votes','Use'],
['**Node majority**','Nodes only','Odd number of nodes'],
['**Node and file share witness**','Nodes plus a share','Even number of nodes, on-premises'],
['**Node and disk witness**','Nodes plus a small shared disk','Shared storage clusters'],
['**Node and cloud witness**','Nodes plus an Azure storage account','Multi-site and cloud, no third site needed']]},
{h:'Dynamic quorum'},
{p:'Windows Server adjusts votes as nodes leave, so a cluster can keep running with fewer nodes than a fixed majority would allow. Dynamic witness also adds or removes the witness vote so the total stays odd.'},
{code:`# PowerShell: current quorum and node votes
Get-ClusterQuorum
Get-ClusterNode | Select-Object Name, State, NodeWeight, DynamicWeight`},
{note:'For two nodes always configure a witness. Without one, losing either node loses the cluster. For multi-site designs, put the witness in a third location or use a cloud witness.'}],
src:[['Quorum in failover clusters','https://learn.microsoft.com/en-us/windows-server/failover-clustering/manage-cluster-quorum'],['WSFC quorum modes and voting configuration',M.SS+'availability-groups/windows/wsfc-quorum-modes-and-voting-configuration-sql-server']]};

/* ---------- 2: Networking ---------- */
L['mss-ha:1:2']={blocks:[
{p:'Cluster stability depends on **networking**. A short network interruption can look like a node failure and trigger an unnecessary failover.'},
{svg:net},
{h:'Design points'},
{ul:['Use **redundant network paths** between nodes (teaming or multiple NICs).','Keep **heartbeat** traffic on reliable links with low latency.','For **multi-site** clusters, use **multi-subnet** design with one IP per subnet.','Set **MultiSubnetFailover=True** in client connection strings for faster reconnects.']},
{h:'Heartbeat settings'},
{t:[['Setting','Meaning'],
['**SameSubnetDelay / SameSubnetThreshold**','How often a heartbeat is sent and how many may be missed in one subnet'],
['**CrossSubnetDelay / CrossSubnetThreshold**','The same, between subnets (more tolerant by default)']]},
{code:`Get-Cluster | Format-List *SubnetDelay*, *SubnetThreshold*
Get-ClusterNetwork | Select-Object Name, Role, Address`},
{note:'Do not loosen heartbeat thresholds to hide a flaky network. Fix the network first; adjust thresholds only for known latency, such as cross-region links.'}],
src:[['Failover cluster networking basics','https://learn.microsoft.com/en-us/windows-server/failover-clustering/clustering-requirements'],['Multi-subnet failover',M.SS+'failover-clusters/windows/sql-server-multi-subnet-clustering-sql-server']]};

/* ---------- 3: Building a cluster ---------- */
L['mss-ha:1:3']={blocks:[
{p:'Building a cluster follows the same pattern whether you use physical servers, virtual machines or cloud instances.'},
{svg:build},
{h:'Steps'},
{flow:['Prepare servers: same OS and patch level, domain joined, static IPs, time in sync','Install the **Failover Clustering** feature on every node','Run **Validate Configuration** and read the whole report','Create the cluster with a name and IP address','Configure the **witness** and check the quorum','Test failover of a test role']},
{code:`# PowerShell example (run on a node as an administrator)
Install-WindowsFeature -Name Failover-Clustering -IncludeManagementTools

Test-Cluster -Node SQLNODE1, SQLNODE2
New-Cluster -Name SQLCLU01 -Node SQLNODE1, SQLNODE2 -StaticAddress 10.0.0.50
Set-ClusterQuorum -CloudWitness -AccountName <storageaccount> -AccessKey <key>`},
{note:'Treat warnings in Validate Configuration as work to do. Microsoft support expects a clean validation report for a supported cluster. Keep the report with your build documentation.'}],
src:[['Create a failover cluster','https://learn.microsoft.com/en-us/windows-server/failover-clustering/create-failover-cluster'],['Validate hardware for a failover cluster','https://learn.microsoft.com/en-us/windows-server/failover-clustering/validate-hardware']]};

})();
