/* LearnSphere - SQL Server High Availability & DR, Section 10: Capstone.
   Lectures 0-2 are core, 3 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const lab=M.dg(700,220,[
[10,10,680,200,'Capstone lab',1],
[30,50,170,60,'SQLNODE1|primary',2],[265,50,170,60,'SQLNODE2|secondary, sync',2],[500,50,170,60,'Witness|file share or cloud',0],
[30,130,640,60,'Windows cluster SQLCLU01 with listener AGListener on port 1433.|Database SalesDB in FULL recovery with log backups.',0]],
[[200,80,265,80],[435,80,500,80]]);

const scen=M.dg(700,190,[
[10,20,215,70,'Secondary fails|primary continues|resync later',0],[245,20,215,70,'Primary fails|automatic failover|apps reconnect',2],[480,20,210,70,'Network split|quorum decides|one side runs',0],
[10,115,680,60,'For each scenario write: what you do, how you verify, what you tell the business',0]],
[]);

/* ---------- 0: Capstone build ---------- */
L['mss-ha:9:0']={blocks:[
{p:'**Capstone.** Build a two-node availability group with a listener in a lab, and prove it works.'},
{svg:lab},
{h:'Tasks'},
{t:[['#','Task','Evidence'],
['1','Build the **WSFC**, pass Validate Configuration, add a witness','Validation report, `Get-ClusterQuorum`'],
['2','Install SQL Server on both nodes, enable **Always On**','`SERVERPROPERTY(\'IsHadrEnabled\')`'],
['3','Create the **endpoints** and the **AG** with synchronous commit and automatic failover','`sys.availability_replicas`'],
['4','Create the **listener**','`sys.availability_group_listeners`'],
['5','Add a database with **automatic seeding**','`sys.dm_hadr_automatic_seeding`'],
['6','Configure **backup preference** and a backup job that checks it','Job history'],
['7','Create **logins and jobs** on both replicas and test','Login test from each node'],
['8','Perform a **planned failover** and fail back','Dashboard, application test'],
['9','Run an **automatic failover** by stopping the primary service','Time to first query']]},
{note:'Use a lab. Use the listener in every test connection and record how long applications take to reconnect.'}],
src:[['Create an availability group',M.SS+'availability-groups/windows/create-an-availability-group-transact-sql'],['Availability group listeners',M.SS+'availability-groups/windows/listeners-client-connectivity-application-failover']]};

/* ---------- 1: Failure scenarios and runbooks ---------- */
L['mss-ha:9:1']={blocks:[
{p:'Now break the lab on purpose and write the runbook for each failure.'},
{svg:scen},
{t:[['Scenario','Expected behavior','Verify','Runbook actions'],
['**Secondary down**','Primary continues, secondary shows not synchronized','Queue grows, log may not truncate','Restart or repair, resume data movement, watch log use'],
['**Primary service stopped**','Automatic failover to secondary','Listener works, apps reconnect','Investigate old primary, rejoin as secondary'],
['**Network partition**','Quorum decides which side runs','One primary only','Fix network, check resync'],
['**Witness lost**','Cluster continues if node majority holds','Quorum state','Replace witness'],
['**Primary storage full**','Writes fail, possible failover','Error 9002 or disk alerts','Add space, log backup, fix cause'],
['**Forced failover (DR)**','Possible data loss','Secondary suspended','Resume, reconcile, document loss']]},
{h:'Runbook template'},
{ul:['**Detect**: which alert or symptom.','**Decide**: failover or repair in place.','**Act**: exact commands.','**Verify**: queries and application checks.','**Report**: who to inform, and what to record.']}],
src:[['Troubleshoot AG',M.SS+'availability-groups/windows/troubleshoot-always-on-availability-groups-configuration-sql-server'],['Failover and failover modes',M.SS+'availability-groups/windows/failover-and-failover-modes-always-on-availability-groups']]};

/* ---------- 2: Production readiness ---------- */
L['mss-ha:9:2']={blocks:[
{p:'Before the system carries production load, check it against a list.'},
{t:[['Area','Check'],
['**Requirements**','RPO and RTO agreed and met by design and tests'],
['**Cluster**','Validation clean, quorum with witness, heartbeat configured'],
['**AG**','Modes match requirements, listener used by apps, MultiSubnetFailover set'],
['**Data**','FULL recovery, log backups running, backup preference handled in jobs'],
['**Objects outside the database**','Logins, jobs, linked servers synchronized or contained AG'],
['**Monitoring**','Alerts on health, queue sizes, failover, log growth, cluster events'],
['**Security**','Endpoint encryption, certificates, least privilege service accounts'],
['**Maintenance**','Rolling patch procedure tested'],
['**DR**','Remote replica or backup to remote site, tested restore'],
['**Documentation**','Architecture, runbooks, contacts, last test date']]},
{h:'Sign-off'},
{ul:['Each row has **evidence**: a query, a report or a screenshot.','**Owners** are named for operations and for DR tests.','A **review date** is set for the design and for the next test.']},
{note:'Next: Upgrade, Patching and Migration builds on these designs, using rolling patching and distributed AGs to move with little downtime.'}],
src:[['Always On availability groups best practices',M.SS+'availability-groups/windows/overview-of-always-on-availability-groups-sql-server'],['High availability and DR overview',M.SS+'failover-clusters/high-availability-solutions-overview']]};

})();
