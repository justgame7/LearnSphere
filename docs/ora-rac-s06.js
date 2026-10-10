/* LearnSphere - Grid Infrastructure, ASM & RAC, Section 06: RAC Architecture & Cache Fusion.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const sh=O.dg(700,260,[
[10,10,330,150,'Per instance (private to each node)',1],[30,45,140,40,'SGA and PGA',0],[190,45,130,40,'Background|processes',0],[30,100,140,40,'Redo thread',2],[190,100,130,40,'Undo tablespace',2],
[360,10,330,150,'Shared by all instances',1],[380,45,140,40,'Datafiles',0],[540,45,130,40,'Control files',0],[380,100,140,40,'SPFILE (one)',0],[540,100,130,40,'Password file',0],
[10,180,680,70,'All of it lives in ASM disk groups that every node can read: redo of a failed node can be read by the survivors',2]],[]);

const gcs=O.dg(700,210,[
[10,20,200,170,'Instance 1',1],[30,55,160,40,'Buffer cache',0],[30,105,160,35,'LMS (GCS)',2],[30,148,160,32,'LMON, LMD (GES)',0],
[490,20,200,170,'Instance 2',1],[510,55,160,40,'Buffer cache',0],[510,105,160,35,'LMS (GCS)',2],[510,148,160,32,'LMON, LMD (GES)',0],
[250,70,200,70,'Private interconnect|blocks and lock messages',2],
[250,150,200,40,'GRD: who holds which block',0]],
[[190,122,250,105],[450,105,490,122]]);

const cf=O.dg(700,190,[
[10,70,120,60,'Instance A|needs block 100',0],[200,70,130,60,'Master|knows who holds|the block',2],[400,70,130,60,'Instance B|holds block 100|in its cache',2],[570,70,120,60,'Instance A|gets the block|(no disk I/O)',0]],
[[130,100,200,100],[330,100,400,100],[530,100,570,100]]);

/* ---------- 0: Shared vs per-instance ---------- */
L['ora-rac:5:0']={blocks:[
{p:'To understand RAC, know what every node shares and what each node keeps for itself.'},
{svg:sh},
{t:[['Item','Shared or per instance','Notes'],
['**Datafiles**','Shared','One set of files for the whole database'],
['**Control files**','Shared','Same files opened by all instances'],
['**SPFILE**','Shared (usually one)','Entries can apply to all (`*`) or to one instance (`orcl1`)'],
['**Password file**','Shared','Stored in ASM'],
['**Redo logs**','**Per instance** (a "thread")','Each instance writes its own redo, on shared storage'],
['**Undo tablespace**','**Per instance**','Each instance has its own undo'],
['**SGA, PGA, background processes**','**Per instance**','Memory is on each node'],
['**Temporary tablespace**','Shared tablespace, per-instance use','Each instance uses its own part'],
['**Alert log and traces**','Per instance','On each node'],
['**Listener**','Per node, plus SCAN listeners','']]},
{h:'Why this design works'},
{flow:['Every instance writes its own redo, so there is no log contention','Every instance has its own undo, so rollback stays local','All data is shared, so any instance can serve any request','Cache Fusion moves the latest blocks between memory caches']},
{note:'Per-instance redo and undo on shared storage is what allows recovery: a surviving node can read the failed node redo and bring the database back to a consistent state.'}],
src:[['RAC architecture',O.RAC],['Oracle RAC concepts',O.CN]]};

/* ---------- 1: Threads, redo, undo ---------- */
L['ora-rac:5:1']={blocks:[
{p:'Each RAC instance has a **number**, a **thread** (its redo stream) and its own **undo tablespace**. These are set with instance-specific parameters.'},
{t:[['Parameter','Meaning','Example'],
['`CLUSTER_DATABASE`','TRUE for RAC (shared setting)','`*.cluster_database=TRUE`'],
['`INSTANCE_NUMBER`','Unique number of the instance','`orcl1.instance_number=1`'],
['`THREAD`','Redo thread used by the instance','`orcl1.thread=1`'],
['`UNDO_TABLESPACE`','Undo tablespace of the instance','`orcl1.undo_tablespace=UNDOTBS1`'],
['`INSTANCE_NAME`','Name of the instance','`orcl1`']]},
{h:'The SPFILE has two kinds of lines'},
{code:`*.db_name='orcl'
*.sga_target=2G
orcl1.instance_number=1
orcl2.instance_number=2
orcl1.thread=1
orcl2.thread=2
orcl1.undo_tablespace='UNDOTBS1'
orcl2.undo_tablespace='UNDOTBS2'`},
{p:'A line with `*` applies to every instance. A line with a name applies to one instance only.'},
{h:'Check them'},
{code:`SELECT inst_id, instance_name, host_name, status FROM gv$instance;
SELECT thread#, group#, bytes/1024/1024 AS mb, status FROM v$log ORDER BY thread#, group#;
SELECT inst_id, value FROM gv$parameter WHERE name = 'undo_tablespace';

ALTER SYSTEM SET sga_target = 3G SCOPE = BOTH SID = '*';       -- all instances
ALTER SYSTEM SET open_cursors = 600 SCOPE = BOTH SID = 'orcl1'; -- one instance`},
{h:'GV$ and V$'},
{t:[['Prefix','Shows'],
['`V$`','The instance you are connected to'],
['`GV$`','All instances, with an `INST_ID` column']]},
{flow:['Instance 2 crashes','Instance 1 reads thread 2 redo from shared storage','It rolls forward committed changes and rolls back the uncommitted ones','The database stays consistent and open']},
{note:'Each thread needs at least two redo groups. When you add a node, you also add a thread and an undo tablespace for it.'}],
src:[['RAC parameters',O.RAC]]};

/* ---------- 2: GCS and GES ---------- */
L['ora-rac:5:2']={blocks:[
{p:'Several instances may want the same block at the same time. Two services coordinate them: the **Global Cache Service (GCS)** for blocks and the **Global Enqueue Service (GES)** for locks.'},
{svg:gcs},
{h:'The services and their processes'},
{t:[['Service','Processes','Job'],
['**GCS**','LMS (Global Cache Service processes)','Ship blocks between instances and track block ownership'],
['**GES**','LMON, LMD','Manage enqueue (lock) requests and detect deadlocks across nodes'],
['**Membership**','LMON','Monitors instance membership with Clusterware'],
['**Other**','LCK0, DIAG','Library-cache and diagnostic coordination']]},
{h:'Global Resource Directory (GRD)'},
{p:'The **GRD** is a distributed list kept in the SGA of all instances. It records which instance **masters** each resource (block or lock) and which instances hold it, in which mode.'},
{t:[['Term','Meaning'],
['**Master instance**','The instance that tracks one resource'],
['**Holder**','The instance that has the block in its cache'],
['**Requester**','The instance that wants it'],
['**Past image (PI)**','A copy of a modified block kept after it is shipped, for recovery']]},
{h:'Dynamic remastering'},
{p:'Mastership moves to the instance that uses a resource most. This lowers messages between nodes.'},
{code:`SHOW PARAMETER gcs_server_processes
SELECT name FROM v$bgprocess WHERE name LIKE 'LM%' AND paddr <> '00';`},
{flow:['An instance needs a block','It asks the master instance of that block','The master knows which instance holds it','The holder sends the block across the interconnect']},
{note:'GCS and GES are why RAC needs a fast, reliable private network. Every block transfer and lock message crosses it.'}],
src:[['Global Cache Service and Global Enqueue Service',O.RAC]]};

/* ---------- 3: Cache Fusion ---------- */
L['ora-rac:5:3']={blocks:[
{p:'**Cache Fusion** moves blocks **directly from memory to memory** between instances over the interconnect. It avoids writing the block to disk and reading it back, which is why RAC scales.'},
{svg:cf},
{h:'The cases'},
{t:[['Case','What happens','Typical wait event'],
['**Block is in the local cache**','No messages','None'],
['**2-way**','The master also holds the block and sends it','`gc cr block 2-way`, `gc current block 2-way`'],
['**3-way**','The master forwards the request to the holder, which sends the block','`gc cr block 3-way`, `gc current block 3-way`'],
['**Not in any cache**','Read from disk by the requester','`db file sequential read`']]},
{h:'Current and consistent-read blocks'},
{ul:['A **current** block is the latest version, needed to change a row.','A **CR (consistent read)** block is a version as of a point in time, built from undo, for a query.']},
{flow:['Instance A asks the master for block 100','The master tells instance B (the holder) to send it','B sends the block over the interconnect (and keeps a past image if modified)','A has the block in its buffer cache within a fraction of a millisecond']},
{h:'Wait events to know'},
{t:[['Event','Meaning'],
['`gc cr request` / `gc current request`','Waiting for a block from another instance'],
['`gc buffer busy`','A block is being moved and others wait for it'],
['`gc cr multi block request`','Large scans across instances']]},
{code:`SELECT inst_id, name, value FROM gv$sysstat
WHERE  name IN ('gc cr blocks received','gc current blocks received','gc cr blocks served','gc current blocks served');`},
{note:'Some Cache Fusion traffic is normal. Trouble starts when the same hot blocks bounce between nodes all day: that is an application design issue, covered in section 9.'}],
src:[['Cache Fusion',O.RAC],['Oracle RAC Concepts',O.CN]]};

/* ---------- 4: Interconnect ---------- */
L['ora-rac:5:4']={blocks:[
{p:'The **interconnect** is the private network between nodes. Block transfers and cluster messages cross it all the time, so its speed and reliability decide how well RAC performs.'},
{h:'What it needs'},
{t:[['Requirement','Why'],
['**Dedicated**','No client or backup traffic sharing the link'],
['**Low latency**','Block transfers should take well under a millisecond'],
['**High bandwidth**','10 Gb or faster for busy production systems'],
['**No packet loss**','Retries cause slow gc waits'],
['**Redundant**','Two NICs and switches so one failure does not evict a node']]},
{h:'Protocols and redundancy'},
{t:[['Item','Notes'],
['**UDP**','The default for Cache Fusion on Ethernet'],
['**RDMA over Converged Ethernet (RoCE)**','Used on Exadata for very low latency'],
['**HAIP (Highly Available IP)**','Clusterware gives the interconnect link-local addresses (169.254.x.x) over up to four NICs, with automatic failover'],
['**Jumbo frames (MTU 9000)**','Reduce overhead for 8 KB blocks. The MTU must match on every NIC and switch port.']]},
{code:`oifcfg getif
SELECT inst_id, name, ip_address, source FROM gv$cluster_interconnects;

cluvfy comp nodecon -n rac1,rac2 -verbose
ping -M do -s 8972 rac2-priv        # test a 9000 byte MTU path`},
{h:'Common problems'},
{t:[['Symptom','Likely cause'],
['High `gc` waits, slow response','Packet loss, small buffers, MTU mismatch'],
['Node evicted','Interconnect down or too slow'],
['Errors counted on the NIC','Cable, switch or bonding problem']]},
{code:`ip -s link show eth1
ethtool -S eth1 | grep -i -E "drop|error"`},
{flow:['Cache Fusion needs the interconnect','Packet loss or delay shows as gc waits','Fix the network, not the database','Check again with the same views and counters']},
{note:'Never route the interconnect through a firewall or a shared corporate network. Use a dedicated switch or VLAN.'}],
src:[['Interconnect configuration',O.CW],['V$CLUSTER_INTERCONNECTS',O.RF+'V-CLUSTER_INTERCONNECTS.html']]};

/* ---------- 5: Client view ---------- */
L['ora-rac:5:5']={blocks:[
{p:'A client does not choose an instance. It asks for a **service**, and the cluster decides where to run it. This hides the cluster from the application.'},
{h:'Roles'},
{t:[['Part','What the client sees'],
['**SCAN**','One name for the whole cluster'],
['**VIP**','Used by the cluster in redirects. The client never types it.'],
['**Service**','The name that selects the workload and the instances that serve it'],
['**Instance**','Hidden. The cluster picks it.']]},
{flow:['Client connects to the SCAN with a service name','A SCAN listener chooses an instance that offers the service','The client is redirected to that node listener','A server process starts on that instance','Later, if that node fails, a reconnect lands on a surviving instance']},
{h:'Connecting by service or by instance'},
{t:[['Connect by','Result','Use'],
['**Service name**','Cluster picks the instance, failover works','**Normal and recommended**'],
['**Instance name**','Pinned to one instance, no failover','Only for DBA tasks and tests']]},
{code:`-- Normal: any instance that runs the service
sqlplus app@//rac-scan:1521/orcl_svc

-- DBA pinning to one instance for a test
sqlplus system@"(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=rac1-vip)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=orcl)(INSTANCE_NAME=orcl1)))"`},
{note:'Applications should always use a service, never an instance name. Instance pinning removes the main benefit of RAC: the cluster can no longer move your session.'}],
src:[['Services',O.RAC]]};

/* ---------- 6: Admin-managed ---------- */
L['ora-rac:5:6']={blocks:[
{p:'Clusterware can manage a database in two ways. In **26ai only one remains** **[26ai]**.'},
{t:[['','Administrator-managed','Policy-managed'],
['**You define**','Which instances run on which nodes (preferred and available nodes of services)','Server pools with a size, and the cluster decides'],
['**Instance names**','Fixed (`orcl1`, `orcl2`)','Created as needed (`orcl_1`)'],
['**Typical size**','Small clusters','Large clusters'],
['**19c**','Supported','Supported'],
['**26ai**','**Supported**','**Desupported**']]},
{h:'Administrator-managed in practice'},
{p:'You add instances to named nodes, and each service has **preferred** instances (where it normally runs) and **available** instances (where it may fail over).'},
{code:`srvctl config database -db orcl
-- Database is administrator managed

srvctl add service -db orcl -service orcl_svc -preferred orcl1,orcl2`},
{h:'If you have policy-managed databases'},
{flow:['Check which databases are policy-managed','Plan a conversion to administrator-managed','Test in a copy of the cluster','Convert before you upgrade Grid Infrastructure to 26ai']},
{note:'The conversion is a short planned change. Checking early avoids a blocked upgrade later.'}],
src:[['Administrator-managed and policy-managed databases',O.RAC]]};

/* ---------- 7: Practical ---------- */
L['ora-rac:5:7']={blocks:[
{p:'Make Cache Fusion visible. You use two sessions on **different instances** that touch the same block.'},
{h:'Setup'},
{code:`-- On any instance
CREATE TABLE cf_test (id NUMBER PRIMARY KEY, val NUMBER);
INSERT INTO cf_test SELECT level, 0 FROM dual CONNECT BY level <= 10;
COMMIT;

-- Take a baseline of the statistics
SELECT inst_id, name, value FROM gv$sysstat
WHERE  name IN ('gc cr blocks received','gc current blocks received') ORDER BY inst_id, name;`},
{h:'Session 1: instance 1 changes the block'},
{code:`sqlplus system@"(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=rac1-vip)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=orcl)(INSTANCE_NAME=orcl1)))"
SELECT instance_name FROM v$instance;
UPDATE cf_test SET val = val + 1;       -- do not commit yet`},
{h:'Session 2: instance 2 reads it'},
{code:`sqlplus system@"(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=rac2-vip)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=orcl)(INSTANCE_NAME=orcl2)))"
SELECT instance_name FROM v$instance;
SELECT * FROM cf_test;          -- sees the old committed values (a CR block comes from instance 1)`},
{h:'Measure'},
{code:`SELECT inst_id, name, value FROM gv$sysstat
WHERE  name IN ('gc cr blocks received','gc current blocks received') ORDER BY inst_id, name;`},
{h:'What you should see'},
{t:[['Observation','Meaning'],
['`gc cr blocks received` grows on instance 2','Instance 2 got a CR block from instance 1 over the interconnect'],
['`gc current blocks served` grows on instance 1','Instance 1 sent a block'],
['Session 2 query returns old values','Read consistency: uncommitted changes are invisible']]},
{h:'Challenge'},
{ul:['COMMIT in session 1, repeat the query and compare the counters.','Update the same row from both instances in turn and watch `gc current block` waits in `GV$SESSION_EVENT`.']},
{note:'The numbers will be small but visible. In production, tens of thousands of block transfers per second are normal.'}],
src:[['Cache Fusion statistics',O.RAC]]};

})();
