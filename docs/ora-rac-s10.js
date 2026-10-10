/* LearnSphere - Grid Infrastructure, ASM & RAC, Section 10: Patching, Upgrading & Capstone.
   Lectures 0-6 are core, 7-10 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const rolling=O.dg(700,190,[
[10,20,150,70,'Node 1|stop, patch, start',2],[200,20,150,70,'Node 2 serves users|(service continues)',0],
[390,20,150,70,'Node 2|stop, patch, start',2],[580,20,110,70,'Node 1 serves|users',0],
[10,115,680,60,'After both nodes are patched: run datapatch once to update the database dictionary',1]],
[[160,55,200,55],[350,55,390,55],[540,55,580,55]]);

const oop=O.dg(700,170,[
[10,30,150,70,'Old home|19.25|(in use)',0],[210,30,150,70,'New home|19.27, patched|(prepared beside it)',2],[410,30,130,70,'Switch|move the database|to the new home',2],[580,30,110,70,'Rollback|= switch back',0],
[10,120,680,40,'Test the new home before the switch. The old home stays until you are sure.',1]],
[[160,65,210,65],[360,65,410,65],[540,65,580,65]]);

/* ---------- 0: Rolling patching ---------- */
L['ora-rac:9:0']={blocks:[
{p:'A **rolling patch** updates one node at a time while the others serve users. It is how RAC achieves close to zero downtime for patching. The tool is **opatchauto**.'},
{svg:rolling},
{h:'Before you patch'},
{ul:['Update **OPatch** in every home (the OPatch utility is patch 6880880 on My Oracle Support).','Download the Release Update for Grid Infrastructure and read its README.','Take a backup of the OCR and a database backup. Run cluvfy and note the current patches.','Test on a copy of the cluster first.']},
{h:'Apply with opatchauto'},
{code:`# As root on node 1, with OPatch updated in the Grid and DB homes
export PATH=$GRID_HOME/OPatch:$PATH

opatchauto apply /stage/patch_ru/36912597 -analyze        # dry run
opatchauto apply /stage/patch_ru/36912597                 # patches Grid and DB homes on this node

# Then the same on node 2, after node 1 is back and healthy`},
{t:[['What opatchauto does on a node','Detail'],
['Stops resources on the node','Instances, listeners, Clusterware'],
['Patches the Grid home and the DB homes','Software files'],
['Restarts Clusterware and the database','Instance comes back on the patched home'],
['Leaves the other nodes untouched','They keep serving users']]},
{h:'After all nodes are patched'},
{code:`# As oracle, once, from any node with the database open on all instances
$ORACLE_HOME/OPatch/datapatch -verbose

opatch lspatches
SELECT patch_id, action, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 5 ROWS ONLY;`},
{flow:['Check the cluster is healthy','Patch node 1 with opatchauto','Wait until node 1 is fully back and services are online','Patch node 2','Run datapatch once','Verify patches and cluster state']},
{note:'Do not patch the second node until the first is fully back and checked. If something goes wrong on node 1, you still have the other node serving users.'}],
src:[['Patching Grid Infrastructure and RAC',O.CW],['OPatch',D+'opaty/']]};

/* ---------- 1: GI rolling upgrade ---------- */
L['ora-rac:9:1']={blocks:[
{p:'A **Grid Infrastructure upgrade** moves the cluster to a new release. It is **rolling**: Clusterware keeps running while nodes are upgraded one by one, so the cluster stays available.'},
{h:'The approach'},
{flow:['Install the new Grid software into a new home on every node (out of place)','Run gridSetup.sh from the new home in upgrade mode on node 1','Run rootupgrade.sh on each node, one at a time','The cluster runs in a mixed-version state until the last node is done','The active version is raised and the upgrade is complete']},
{h:'Checks'},
{code:`crsctl query crs activeversion
crsctl query crs releaseversion       # on one node
crsctl query crs softwareversion

cluvfy stage -pre crsinst -upgrade -rolling -src_crshome /u01/app/19.0.0/grid -dest_crshome /u01/app/26.0.0/grid -dest_version 26.0.0.0.0`},
{t:[['Version','Meaning'],
['**Release version**','The software version installed on this node'],
['**Software version**','The software version of a node'],
['**Active version**','The cluster-wide version, raised when all nodes run the new software']]},
{h:'Plan'},
{ul:['Direct upgrade from 19c to 26ai is supported. Confirm in the 26ai upgrade guide **[26ai]**.','Convert policy-managed databases to administrator-managed before upgrading.','Take OCR and database backups. Rehearse in a copy of the cluster.','Raise ASM and database compatibility attributes only after the upgrade is proven.']},
{note:'Do not raise compatible.asm or compatible.rdbms straight away. Keep them where they are until you are sure you will not need to go back.'}],
src:[['Upgrading Grid Infrastructure',O.CW],['26ai upgrade guide',O.D26]]};

/* ---------- 2: Out-of-place patching ---------- */
L['ora-rac:9:2']={blocks:[
{p:'**Out-of-place patching** installs the patched software into a **new home beside the old one**, and then moves the database to it. The old home stays untouched, so rollback means switching back.'},
{svg:oop},
{t:[['','In-place (opatchauto)','Out-of-place'],
['**Where patched**','The existing home','A new home'],
['**Downtime per node**','Longer: the patch is applied while the node is down','Shorter: the new home is prepared in advance'],
['**Rollback**','Roll the patch back','Switch to the old home'],
['**Disk**','Less','One extra home per version'],
['**Best for**','Small patches, quick fixes','Release Updates and regular patching']]},
{h:'Database home'},
{code:`# 1. Prepare: unzip a gold image (an already patched home) into a new path on every node
# 2. Apply datapatch later, after the database runs in the new home

# Move the database resource to the new home
srvctl modify database -db orcl -oraclehome /u01/app/oracle/product/19.0.0/dbhome_2

# Restart instances one by one (rolling) so they start from the new home
srvctl stop instance  -db orcl -instance orcl1 -drain_timeout 120 -stopoption IMMEDIATE
srvctl start instance -db orcl -instance orcl1
# repeat for orcl2, then:
$ORACLE_HOME/OPatch/datapatch -verbose`},
{h:'Grid home'},
{p:'The Grid home can also be switched out of place. The installer can apply a Release Update to a new Grid home before the switch, and it then moves the cluster on node by node. Follow the documented steps for your release, since they are specific.'},
{flow:['Create a patched home from a gold image','Test it with a non-critical database','Move one instance at a time, with draining','Run datapatch once at the end','Keep the old home until the change is proven']},
{note:'Keep the old home for at least one release cycle. If a problem appears after the patch, switching back is quick and safe.'}],
src:[['Out-of-place patching',O.RAC],['Gold images',D+'ladbi/']]};

/* ---------- 3: Backup and recovery ---------- */
L['ora-rac:9:3']={blocks:[
{p:'Backup and recovery in RAC use the same RMAN as for a single instance, with a few points that come from the cluster.'},
{h:'Backup'},
{t:[['Point','What to do'],
['**Where RMAN runs**','From any one node'],
['**Channels**','Spread across nodes to use all CPUs and network paths'],
['**Archive logs**','Back up the logs of **all threads**'],
['**Snapshot control file**','Must be on shared storage'],
['**Backup destination**','Shared (+FRA, or a shared file system) so any node can read it']]},
{code:`CONFIGURE SNAPSHOT CONTROLFILE NAME TO '+FRA/snapcf_orcl.f';
CONFIGURE DEVICE TYPE DISK PARALLELISM 4;
CONFIGURE CHANNEL 1 DEVICE TYPE DISK CONNECT 'sys@rac1:1521/orcl';
CONFIGURE CHANNEL 2 DEVICE TYPE DISK CONNECT 'sys@rac2:1521/orcl';

BACKUP DATABASE PLUS ARCHIVELOG;`},
{h:'Recovery'},
{t:[['Failure','Recovery'],
['An instance fails','Automatic **instance recovery** by a surviving instance. No action needed.'],
['A datafile is lost','Restore and recover with RMAN from one node (often with the rest of the database open)'],
['The whole database is lost','Shut down all instances, mount one, restore and recover, then open and start the others']]},
{flow:['Stop all instances of the database','Start one instance in MOUNT','RESTORE DATABASE and RECOVER DATABASE from RMAN','Open the database','Start the other instances with srvctl']},
{note:'RAC adds no new backup tool. What changes is that every thread must be recoverable, so redo and archive logs of every instance must be available to the node doing the recovery.'}],
src:[['Backup and recovery of RAC',O.RAC],['Backup and Recovery User Guide',D+'bradv/']]};

/* ---------- 4: Data Guard with RAC ---------- */
L['ora-rac:9:4']={blocks:[
{p:'RAC protects against **server** failure. **Data Guard** protects against **site** failure. The two are normally combined. This lecture is a pointer: the Data Guard sub-course covers the full detail.'},
{h:'The combined design'},
{flow:['Primary site: a RAC database with several instances','Redo is shipped to a standby site','Standby site: a RAC standby with one instance applying redo','Role-based services direct clients to the current primary','A broker or observer can fail over automatically']},
{t:[['Topic','What changes with RAC'],
['**Redo transport**','Every primary instance ships its own thread to the standby'],
['**Redo apply**','Only **one** standby instance applies redo at a time (others can be Active Data Guard read-only)'],
['**Broker**','Manages the whole RAC primary and standby configuration'],
['**Services**','Defined with a role: `PRIMARY` or `PHYSICAL_STANDBY`'],
['**Switchover and failover**','Done at database level, with clusterware restarting services in the new role']]},
{code:`# Service that runs only when the database is primary
srvctl add service -db orcl -service shop_svc -role PRIMARY -preferred orcl1,orcl2

# Service for reports on the standby (Active Data Guard)
srvctl add service -db orclstby -service shop_ro -role PHYSICAL_STANDBY -preferred orclstby1,orclstby2`},
{note:'See the Data Guard sub-course, sections 5 to 9, for broker configuration, role transitions and Data Guard on RAC and multitenant.'}],
src:[['Data Guard with RAC',O.DG],['MAA',D+'haovw/']]};

/* ---------- 5: Readiness ---------- */
L['ora-rac:9:5']={blocks:[
{p:'Before a RAC cluster goes into production, check every layer and write the results down.'},
{t:[['Area','Check','How'],
['**Hardware and OS**','Matching nodes, patched OS, time sync','`chronyc tracking`, OS package list'],
['**Network**','Dedicated, redundant interconnect. SCAN in DNS with 3 addresses.','`cluvfy comp nodecon`, `nslookup rac-scan`'],
['**Storage**','Redundant ASM disk groups, multipath, enough free space','`asmcmd lsdg`, `USABLE_FILE_MB`'],
['**Clusterware**','Three voting files, OCR backed up and copied','`crsctl query css votedisk`, `ocrconfig -showbackup`'],
['**Database**','ARCHIVELOG, FORCE LOGGING, shared FRA, redo multiplexed','`V$DATABASE`, `GV$LOG`'],
['**Services**','Custom services with failover, FAN and draining','`srvctl config service`'],
['**Failover tests**','Instance and node failure tested with the real application','Test report'],
['**Patching**','Rolling patch rehearsed, OPatch current','Runbook'],
['**Backup and recovery**','RMAN backup and a restore tested','Restore test'],
['**DR**','Standby site or documented recovery plan','Data Guard checks'],
['**Monitoring**','Alerts on cluster, ASM, services, space','Alert test'],
['**Documentation**','Network plan, runbooks, contacts','Documents']]},
{flow:['Walk the checklist with a second DBA','Keep evidence for each item','Fix and re-check failures','Run a node-failure test with the application team','Go live']},
{note:'A failover that has never been tested is not a feature. Test the loss of an instance, a node and an interconnect link before go-live.'}],
src:[['Oracle RAC best practices','https://www.oracle.com/database/technologies/rac/'],['RAC Administration',O.RAC]]};

/* ---------- 6: Capstone ---------- */
L['ora-rac:9:6']={blocks:[
{p:'**Capstone.** Build a two-node RAC from scratch, show that a node failure does not stop the service, and patch the cluster in a rolling way. Keep notes as you go. They are your deliverable.'},
{h:'Specification'},
{t:[['Requirement','Detail'],
['Cluster','Two nodes, `racdemo`, Grid Infrastructure 19c, role separation'],
['Storage','Disk groups `OCR` (NORMAL), `DATA`, `FRA`'],
['Database','CDB `orcl` with PDB `pdb1`, ARCHIVELOG, FORCE LOGGING'],
['Services','`shop_svc` with TAC settings, preferred on both instances'],
['Test client','A pooled application or script that reconnects through the SCAN'],
['Patching','A Release Update applied rolling with opatchauto, datapatch run once']]},
{h:'Steps'},
{flow:['Prepare nodes, network, storage and run cluvfy (section 2)','Install Grid Infrastructure and create disk groups (sections 4 and 5)','Create the RAC database and the service (sections 7 and 8)','Run a workload through the SCAN','Fail a node: stop the interconnect or crash the node, and diagnose it (section 9)','Patch the cluster node by node (this section)','Document and run the readiness checklist']},
{h:'Acceptance'},
{t:[['Test','Pass condition'],
['`crsctl check cluster -all`','Online on both nodes'],
['`srvctl status database -db orcl -verbose`','Both instances open'],
['Fail one node during the workload','The service continues on the surviving node, and with TAC users see no error'],
['After the node returns','Instance and service come back, check `gv$instance`'],
['After rolling patch','`opatch lspatches` shows the patch on both nodes and `DBA_REGISTRY_SQLPATCH` shows success'],
['Checklist and notes','Complete and reviewed']]},
{h:'Self-assessment'},
{t:[['Level','Meaning'],
['**Foundation**','The cluster works and you can explain every component'],
['**Solid**','You also failed a node on purpose and diagnosed it from the logs'],
['**Ready**','Another engineer can operate and patch the cluster from your runbook']]},
{note:'Next steps: Data Guard for site protection, and the Upgrade, Patching and Migration sub-course for planning a move to 26ai.'}],
src:[['RAC Administration and Deployment Guide',O.RAC],['Clusterware Administration and Deployment Guide',O.CW]]};

})();
