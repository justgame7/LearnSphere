/* LearnSphere - SQL Server Upgrade, Patching & Migration, Section 01: Servicing Model & Patching.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const track=M.dg(700,210,[
[10,15,680,180,'Servicing tracks',1],
[30,55,200,60,'RTM|original release|baseline',0],[260,45,200,35,'CU track|fixes and updates',2],[260,90,200,35,'GDR track|security only',0],
[490,55,180,60,'Once on CU, you stay|on the CU track',2],
[30,140,640,40,'Most production systems follow the CU track, with the latest tested CU',0]],
[[230,85,260,62],[230,85,260,108]]);

const build=M.dg(700,150,[
[10,25,130,70,'16.0|major version|SQL Server 2022',0],[160,25,130,70,'4xxx|build number|identifies the CU',2],[310,25,130,70,'Product|UpdateLevel|CU12',0],[460,25,230,70,'ProductUpdateReference|KB article for the update|release notes',0]],
[]);

const proc=M.dg(700,130,[
[10,25,130,70,'1. Plan|read notes,|assess',0],[160,25,130,70,'2. Prepare|backups,|test copy',0],[310,25,130,70,'3. Apply|stop apps,|install, restart',2],[460,25,100,70,'4. Verify|errors, jobs,|apps',2],[580,25,110,70,'5. Record|build,|date',0]],
[[140,60,160,60],[290,60,310,60],[440,60,460,60],[560,60,580,60]]);

const roll=M.dg(700,200,[
[10,15,150,70,'1. Patch|secondary 2|(DR or readable)',0],[180,15,150,70,'2. Patch|secondary 1',0],[350,15,150,70,'3. Fail over|to a patched|replica',2],[520,15,170,70,'4. Patch the|old primary',0],
[10,110,680,75,'At each step check synchronization. Set failover to manual while patching|so the cluster does not move the primary to a half-updated replica.',0]],
[[160,50,180,50],[330,50,350,50],[500,50,520,50]]);

const rb=M.dg(700,170,[
[10,20,200,70,'Before|backups, snapshot,|copy of config',0],[250,20,200,70,'Decision rule|what failure means|go back, who decides',2],[490,20,200,70,'How|restore, failback to old|node, or uninstall CU',0],
[10,110,680,50,'A rollback not tested is not a plan. Know how long it takes.',0]],
[]);

/* ---------- 0: CUs, GDRs, builds ---------- */
L['mss-upg:0:0']={blocks:[
{p:'Microsoft ships fixes for SQL Server in **cumulative updates (CU)** and **security-only updates (GDR)**. There are no service packs for current versions. Knowing the tracks avoids surprises.'},
{svg:track},
{t:[['Package','Contains','Cadence','Use when'],
['**CU** (cumulative update)','All earlier fixes in that branch, bug fixes and security fixes','About every two months in mainstream support','Normal servicing, recommended for most production systems'],
['**GDR** (general distribution release)','Security fixes only','When needed','You want the fewest changes'],
['**Hotfix on demand**','A specific fix','On request','Only for a specific problem you have']]},
{h:'Rules to remember'},
{ul:['CUs are **cumulative**: install the latest one, not each in turn.','You can move from the **GDR track to the CU track**, but not back.','Each CU is tested like a service pack, so staying current is the **supported** approach.','After **mainstream support** ends, only security fixes continue until extended support ends.']},
{note:'Which CU to use is a risk decision. Many teams run the latest CU that has been in the field for a few weeks, after testing it themselves.'}],
src:[['Latest updates for SQL Server',M.SS+'sql-server-2022-release-notes'],['SQL Server servicing model','https://learn.microsoft.com/en-us/troubleshoot/sql/releases/download-and-install-latest-updates']]};

/* ---------- 1: Build numbers and release notes ---------- */
L['mss-upg:0:1']={blocks:[
{p:'Every update changes the **build number**. It tells you the exact patch level, so you can compare servers and look up what has been fixed.'},
{svg:build},
{code:`SELECT SERVERPROPERTY('ProductVersion')         AS build,
       SERVERPROPERTY('ProductLevel')           AS level,
       SERVERPROPERTY('ProductUpdateLevel')     AS update_level,
       SERVERPROPERTY('ProductUpdateReference') AS kb,
       SERVERPROPERTY('Edition')                AS edition;`},
{h:'Where to read what changed'},
{t:[['Source','Use'],
['**Microsoft: latest updates and build versions**','Official list of builds and KB links'],
['**KB article of the CU**','Fixes, known issues, install notes'],
['**Release notes of the version**','New features and behavior changes'],
['**Community build lists**','Quick lookup, verify against Microsoft']]},
{h:'Keep an inventory'},
{ul:['Record **build and date patched** for every server.','Compare to the **latest CU** monthly and plan the next cycle.','Flag servers on an **unsupported** version or an old build.']},
{note:'Read the KB article before you apply a CU, especially the known issues and any extra steps such as updating a component or enabling a trace flag.'}],
src:[['SQL Server 2022 build versions',M.SS+'sql-server-2022-release-notes'],['SERVERPROPERTY',M.TS+'functions/serverproperty-transact-sql']]};

/* ---------- 2: Patching a standalone instance ---------- */
L['mss-upg:0:2']={blocks:[
{p:'A standalone patch is simple, but a few precautions separate a routine task from an incident.'},
{svg:proc},
{h:'Before'},
{ul:['Read the **KB article** and note prerequisites and known issues.','Confirm **recent backups** of all databases and system databases.','Test the update on a **non-production** copy with the same workload.','Agree a **maintenance window** and tell application owners.','Make sure you have **disk space** and a restart is allowed.']},
{h:'During'},
{flow:['Stop or quiesce applications and Agent jobs','Run the update package (it stops and restarts services)','Restart the server if requested','Start services and check the error log']},
{h:'After'},
{code:`SELECT SERVERPROPERTY('ProductVersion') AS build, SERVERPROPERTY('ProductUpdateLevel') AS cu;

-- Look for upgrade messages and errors since the start
EXEC sp_readerrorlog 0, 1, 'upgrade';
EXEC sp_readerrorlog 0, 1, 'error';

SELECT name, state_desc FROM sys.databases;   -- all ONLINE?`},
{note:'On first start after an update SQL Server runs a script upgrade of system and user databases. It can take time, and the instance is not fully usable until it finishes. Look for the "Script level upgrade ... completed" message.'}],
src:[['Install SQL Server updates',M.SS+'install/install-sql-server-servicing-updates'],['Troubleshoot patching issues',M.SS+'install/troubleshoot-installing-sql-server-servicing-updates']]};

/* ---------- 3: Rolling patching ---------- */
L['mss-upg:0:3']={blocks:[
{p:'**Rolling patching** updates a cluster or availability group one node at a time, so the service stays available except for a short failover.'},
{svg:roll},
{h:'Availability group'},
{flow:['Set automatic failover to manual on replicas you are patching (optional, but safer)','Patch **secondary** replicas first, one at a time, and wait until each is synchronized','**Fail over** to a patched, synchronized replica (planned, no data loss)','Patch the **former primary**','Restore failover mode and verify']},
{code:`-- Check before each failover
SELECT ar.replica_server_name, drs.synchronization_state_desc, drs.log_send_queue_size, drs.redo_queue_size
FROM   sys.dm_hadr_database_replica_states drs
JOIN   sys.availability_replicas ar ON ar.replica_id = drs.replica_id;

ALTER AVAILABILITY GROUP AG_Sales MODIFY REPLICA ON N'SQLNODE2' WITH (FAILOVER_MODE = MANUAL);`},
{h:'Failover cluster instance'},
{p:'Patch the passive node, fail over, patch the other node, as shown in the High Availability sub-course.'},
{note:'Once a secondary is on a newer build it can still receive log from an older primary, but you cannot fail back to an older build. Treat the order as one-way.'}],
src:[['Upgrade and update AG replicas',M.SS+'availability-groups/windows/upgrading-always-on-availability-group-replica-instances'],['Rolling updates of FCI',M.SS+'failover-clusters/windows/upgrade-a-sql-server-failover-cluster-instance']]};

/* ---------- 4: Rollback planning ---------- */
L['mss-upg:0:4']={blocks:[
{p:'Hope is not a rollback plan. Decide **before** the change how you would go back, how long it takes and who decides.'},
{svg:rb},
{t:[['Method','Speed','Notes'],
['**Uninstall the update**','Minutes to an hour','Possible for CUs, but databases that were upgraded may not run on the old build, so test the path'],
['**Restore from backup or snapshot**','Hours, size dependent','Reliable, but loses changes made after the change'],
['**Fail back to an unpatched replica**','Minutes','Only if you have kept one, and not for upgraded databases'],
['**Side-by-side with old instance kept**','Minutes','Best for major upgrades']]},
{h:'Decision rule'},
{ul:['Agree **criteria** in advance: errors, performance, failed smoke tests.','Set a **time box**: if not fixed by the deadline, roll back.','Name the **decision maker** and the contact list.']},
{note:'Take a virtual machine snapshot or storage snapshot only if your platform and support allow it, and keep it for hours, not weeks. Always keep database backups as well.'}],
src:[['Uninstall an update',M.SS+'install/uninstall-a-sql-server-update'],['Install SQL Server servicing updates',M.SS+'install/install-sql-server-servicing-updates']]};

})();
