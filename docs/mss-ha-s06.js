/* LearnSphere - SQL Server High Availability & DR, Section 06: AG Variants.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const basic=M.dg(700,170,[
[10,20,330,130,'Basic availability group (Standard edition)',1],[25,55,300,30,'Two replicas, one database per group',2],[25,95,300,25,'No readable secondary, no backups on it',0],[25,125,300,20,'Automatic failover possible',0],
[360,20,330,130,'Full AG (Enterprise edition)',1],[375,55,300,30,'Many replicas, many databases',2],[375,95,300,25,'Readable secondaries, offload backups',0],[375,125,300,20,'Distributed and contained AG',0]],
[]);

const dag=M.dg(700,220,[
[10,10,330,200,'WSFC 1: AG1 (primary site)',1],[30,50,130,50,'Primary',2],[180,50,140,50,'Secondary',0],
[360,10,330,200,'WSFC 2: AG2 (DR or new platform)',1],[380,50,130,50,'Forwarder|primary of AG2',2],[530,50,140,50,'Secondary',0],
[30,120,640,70,'Distributed AG: AG1 sends log to AG2 once, and the forwarder passes it on.|No shared WSFC and no shared domain needed.',0]],
[[320,75,380,75]]);

const cag=M.dg(700,190,[
[10,15,680,160,'Contained availability group',1],
[30,55,190,50,'User databases',0],[255,45,190,35,'Contained master|logins, permissions',2],[255,90,190,35,'Contained msdb|Agent jobs',2],[480,55,190,50,'Fail over together|with the group',0],
[30,130,640,35,'Logins and jobs travel with the AG, so replicas stay consistent without scripts',0]],
[]);

const lin=M.dg(700,200,[
[10,15,680,170,'AG on Linux with Pacemaker',1],
[30,55,170,50,'mssql-server on|each node',0],[225,55,170,50,'mssql-server-ha|resource agent',2],[420,55,170,50,'Pacemaker + Corosync|cluster manager',2],
[30,125,640,45,'CLUSTER_TYPE = EXTERNAL for HA with Pacemaker. CLUSTER_TYPE = NONE for read scale-out without failover.',0]],
[[200,80,225,80],[395,80,420,80]]);

/* ---------- 0: Basic AGs ---------- */
L['mss-ha:5:0']={blocks:[
{p:'**Basic availability groups** give Standard edition a simple HA solution, replacing database mirroring. They are limited on purpose, so know where the limits are.'},
{svg:basic},
{t:[['Capability','Basic AG'],
['**Replicas**','One primary and one secondary'],
['**Databases**','One database per group (you can create several groups)'],
['**Readable secondary**','No'],
['**Backups on secondary**','No'],
['**Integrity checks on secondary**','No'],
['**Listener**','Yes'],
['**Automatic failover**','Yes, with synchronous commit']]},
{code:`CREATE AVAILABILITY GROUP BAG_Sales
  WITH (BASIC, DB_FAILOVER = ON)
  FOR DATABASE SalesDB
  REPLICA ON
    N'SQLNODE1' WITH (ENDPOINT_URL = N'TCP://sqlnode1.contoso.com:5022', AVAILABILITY_MODE = SYNCHRONOUS_COMMIT, FAILOVER_MODE = AUTOMATIC),
    N'SQLNODE2' WITH (ENDPOINT_URL = N'TCP://sqlnode2.contoso.com:5022', AVAILABILITY_MODE = SYNCHRONOUS_COMMIT, FAILOVER_MODE = AUTOMATIC);`},
{note:'A basic AG cannot be converted to a full AG in place. If you may need readable secondaries later, plan Enterprise from the start or be ready to rebuild the group.'}],
src:[['Basic availability groups',M.SS+'availability-groups/windows/basic-availability-groups-always-on-availability-groups'],['Editions and supported features',M.SS+'editions-and-components-of-sql-server-2022']]};

/* ---------- 1: Distributed AGs ---------- */
L['mss-ha:5:1']={blocks:[
{p:'A **distributed availability group** is an AG made of **two availability groups**, each in its own cluster. It is the tool for DR across sites, and for **migrations** between clusters, domains or versions.'},
{svg:dag},
{h:'Why use it'},
{ul:['**Disaster recovery** in another datacenter, with its own WSFC.','**Migration** to new hardware, a new domain or a later SQL Server version with little downtime.','**Scale** read workloads across more replicas than a single AG allows.']},
{t:[['Piece','Role'],
['**Primary AG**','Handles read and write, sends log to the forwarder'],
['**Forwarder**','Primary replica of the secondary AG: receives log and sends it on to its own secondaries'],
['**Distributed AG**','The logical group that joins the two AGs']]},
{code:`CREATE AVAILABILITY GROUP DAG_Sales WITH (DISTRIBUTED)
  AVAILABILITY GROUP ON
    'AG1' WITH (LISTENER_URL = 'tcp://ag1-listener.contoso.com:5022',
                AVAILABILITY_MODE = ASYNCHRONOUS_COMMIT, FAILOVER_MODE = MANUAL, SEEDING_MODE = AUTOMATIC),
    'AG2' WITH (LISTENER_URL = 'tcp://ag2-listener.dr.contoso.com:5022',
                AVAILABILITY_MODE = ASYNCHRONOUS_COMMIT, FAILOVER_MODE = MANUAL, SEEDING_MODE = AUTOMATIC);`},
{note:'Failover between the two AGs is always manual. Plan application and DNS steps for the switch.'}],
src:[['Distributed availability groups',M.SS+'availability-groups/windows/distributed-availability-groups'],['Create a distributed AG',M.SS+'availability-groups/windows/configure-distributed-availability-groups']]};

/* ---------- 2: Contained AGs ---------- */
L['mss-ha:5:2']={blocks:[
{p:'A normal AG copies only **user databases**. Logins, jobs and permissions stay on each server and drift apart. A **contained availability group** (SQL Server 2022) has its **own copies of master and msdb**, which replicate with the group.'},
{svg:cag},
{code:`CREATE AVAILABILITY GROUP AG_Sales
  WITH (CONTAINED, DB_FAILOVER = ON)
  FOR DATABASE SalesDB
  REPLICA ON ...;

-- Connect to the AG context, not the instance, to manage contained logins and jobs
-- (connect through the listener to see the AG-level master and msdb)`},
{h:'What it solves'},
{ul:['**Logins and permissions** exist on every replica automatically.','**SQL Server Agent jobs** defined in the contained msdb follow the AG.','**Fewer manual steps** after failover.']},
{h:'Cautions'},
{ul:['A **new feature**: check its limits (for example, some objects and features are not supported).','Jobs run on **the instance** that is primary, so design them to run in that context.','Test **backup, restore and migration** paths before relying on it.']}],
src:[['What is a contained availability group',M.SS+'availability-groups/windows/contained-availability-groups-overview'],['Create a contained AG',M.SS+'availability-groups/windows/create-a-contained-availability-group']]};

/* ---------- 3: Linux ---------- */
L['mss-ha:5:3']={blocks:[
{p:'On Linux an AG works the same way, but **Pacemaker** replaces WSFC as the cluster manager. Pacemaker handles health checks, fencing and moving the primary role.'},
{svg:lin},
{t:[['Cluster type','Use'],
['**EXTERNAL**','HA with a cluster manager such as Pacemaker: automatic failover'],
['**NONE**','No cluster manager: read scale-out, or migration, no automatic failover'],
['**WSFC**','Windows only']]},
{h:'Main pieces'},
{ul:['**Corosync** provides cluster membership and messaging.','**Pacemaker** manages resources and decides failover.','**Fencing (STONITH)** isolates a failed node so it cannot write: required for a supported cluster.','A **resource agent** from the mssql-server-ha package controls the AG.']},
{code:`-- Create an AG for an external cluster manager
CREATE AVAILABILITY GROUP AG_Linux
  WITH (CLUSTER_TYPE = EXTERNAL, DB_FAILOVER = ON)
  FOR DATABASE SalesDB
  REPLICA ON ...;`},
{note:'Do not skip fencing or test failover in production first. Lab it carefully, because Linux cluster mistakes can cause split brain.'}],
src:[['AGs on Linux',M.LX+'sql-server-linux-availability-group-overview'],['Configure a Pacemaker cluster',M.LX+'sql-server-linux-availability-group-cluster-pacemaker']]};

})();
