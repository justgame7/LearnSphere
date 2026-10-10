/* LearnSphere - Grid Infrastructure, ASM & RAC, Section 03: Grid Infrastructure Architecture.
   Lectures 0-6 are core, 7-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const stack=O.dg(700,260,[
[10,10,680,100,'Lower stack: started by OHASD at boot (per node)',1],
[30,45,120,50,'OHASD|high availability|services',2],[170,45,120,50,'CSSD|cluster|membership',0],[310,45,120,50,'GPNPD, MDNSD|profile, DNS',0],[450,45,120,50,'GIPCD, EVMD|messaging, events',0],[590,45,90,50,'ASM|instance',0],
[10,130,680,120,'Upper stack: started by CRSD (needs ASM and OCR)',1],
[30,165,120,60,'CRSD|resource manager',2],[170,165,120,60,'Listeners|SCAN, VIP|network',0],[310,165,120,60,'Database|instances',0],[450,165,120,60,'Services|ONS',0],[590,165,90,60,'ACFS|CVU',0]],
[[150,70,170,70],[90,95,90,165]]);

const hb=O.dg(700,160,[
[10,30,130,60,'Node 1|CSSD',0],[560,30,130,60,'Node 2|CSSD',0],
[200,15,300,40,'Network heartbeat (interconnect)',2],[200,70,300,40,'Disk heartbeat through the voting files',2],
[240,125,220,28,'Missing both: node is evicted',0]],
[[140,35,200,35],[500,35,560,35],[140,90,200,90],[500,90,560,90]]);

/* ---------- 0: Clusterware stack ---------- */
L['ora-rac:2:0']={blocks:[
{p:'Oracle Clusterware is a set of **daemons** (background programs) that run on every node. They start in a fixed order, and each has one job.'},
{svg:stack},
{h:'The main daemons'},
{t:[['Daemon','Full name','Job'],
['**OHASD**','Oracle High Availability Services Daemon','Starts first at boot, then starts all other lower-stack resources'],
['**CSSD**','Cluster Synchronization Services','Decides which nodes are members. Handles heartbeats and evictions.'],
['**CRSD**','Cluster Ready Services','Starts, stops and monitors cluster resources: databases, listeners, VIPs, services'],
['**EVMD**','Event Manager','Passes cluster events to other processes'],
['**GPNPD**','Grid Plug and Play','Keeps the cluster profile in step on every node'],
['**GIPCD / MDNSD**','Interprocess communication, multicast DNS','Node-to-node messaging and discovery']]},
{h:'Two stacks'},
{t:[['Stack','Started by','Contains','Needs'],
['**Lower (init) stack**','OHASD','CSSD, GPNPD, ASM, EVMD','The OS only'],
['**Upper stack**','CRSD','Databases, listeners, services, VIPs','ASM and the OCR']]},
{p:'Agents (`oraagent`, `orarootagent`, `cssdagent`) do the real start, stop and check of each resource on behalf of OHASD and CRSD.'},
{flow:['The OS boots and systemd starts OHASD','OHASD starts the lower stack and ASM','CSSD joins the node to the cluster','CRSD starts and reads the OCR','CRSD starts databases, listeners and services']},
{note:'If CRSD cannot start, check the lower stack first: ASM or the voting files may be unavailable, so the upper stack has nothing to stand on.'}],
src:[['Oracle Clusterware architecture',O.CW+'introduction-to-oracle-clusterware.html']]};

/* ---------- 1: Voting files and OCR ---------- */
L['ora-rac:2:1']={blocks:[
{p:'Two small pieces of storage hold the cluster state. Losing them is serious, so you must know what each does.'},
{t:[['','Voting files','OCR (Oracle Cluster Registry)'],
['**Purpose**','Node membership: nodes write heartbeats here, and CSSD uses them to decide who is alive','Cluster configuration: resources, databases, services, networks'],
['**Where**','ASM disk group (normally)','ASM disk group (normally)'],
['**How many**','1 (external), 3 (normal), 5 (high redundancy)','One logical OCR, mirrored by the disk group'],
['**Backup**','Contents are in the OCR backup','Automatic backups every 4 hours'],
['**Tool**','`crsctl query css votedisk`','`ocrcheck`, `ocrconfig`']]},
{h:'Why an odd number of voting files'},
{p:'A node must see a **majority** of voting files to stay in the cluster. With three files it must see two. This stops two halves of a split cluster both claiming to be the real one.'},
{h:'Oracle Local Registry (OLR)'},
{p:'Each node also has an **OLR**, a small local file that OHASD reads at startup before ASM is available. It holds node-specific data.'},
{code:`crsctl query css votedisk
ocrcheck
ocrconfig -showbackup
ocrcheck -local            -- check the OLR`},
{h:'Automatic OCR backups'},
{t:[['Kind','Kept'],
['Every 4 hours','Last 3'],
['Daily','Last 2'],
['Weekly','Last 2']]},
{flow:['A node starts','OHASD reads the local OLR','CSSD reads the voting files to join the cluster','CRSD reads the OCR to know what to start']},
{note:'Always store OCR and voting files in a disk group with redundancy (normal or high) or on a mirrored external system. A single unprotected disk is a single point of failure for the whole cluster.'}],
src:[['Managing OCR and voting files',O.CW+'managing-oracle-cluster-registry-and-voting-files.html']]};

/* ---------- 2: GPnP ---------- */
L['ora-rac:2:2']={blocks:[
{p:'**Grid Plug and Play (GPnP)** lets a new node join the cluster by reading a small **profile**, instead of an administrator configuring it by hand.'},
{h:'The GPnP profile'},
{p:'The profile is an XML file kept on every node (and in the cluster). It tells a starting node what it needs to find the cluster:'},
{t:[['Item in the profile','Why it is needed'],
['Cluster name','Identifies the cluster'],
['Network classification','Which NIC is public and which is the interconnect'],
['ASM discovery string','Where to look for ASM disks'],
['Location of the ASM SPFILE','So the node can start ASM and then read the OCR']]},
{code:`# Show the profile
gpnptool get

# Location (per node)
ls $GRID_HOME/gpnp/rac1/profiles/peer/profile.xml`},
{flow:['A node starts and has no local copy of the cluster state','GPnP reads the profile from its local wallet and the cluster','It learns the network and ASM settings','The node starts ASM, then CRSD reads the OCR','The node joins the cluster']},
{h:'Related: GNS'},
{p:'The **Grid Naming Service (GNS)** is optional. It lets the cluster manage the names and addresses of VIPs and SCAN itself through a delegated DNS subdomain, which reduces manual DNS work in large environments.'},
{note:'You rarely edit the profile by hand. If a change is needed (for example the ASM discovery string), use the supported tool such as `asmca` or `oifcfg`, and Clusterware updates the profile everywhere.'}],
src:[['Grid Plug and Play',O.CW]]};

/* ---------- 3: Heartbeats and eviction ---------- */
L['ora-rac:2:3']={blocks:[
{p:'Each node must prove it is alive. Clusterware checks this with **two heartbeats**. A node that fails both is removed from the cluster, an action called **eviction**.'},
{svg:hb},
{t:[['Heartbeat','Path','Failure means'],
['**Network heartbeat**','The private interconnect','The node cannot be reached by the others'],
['**Disk heartbeat**','Voting files on shared storage','The node cannot reach the shared disks']]},
{h:'Timing'},
{t:[['Setting','Default','Meaning'],
['`misscount`','30 seconds','How long without a network heartbeat before a node is evicted'],
['`disktimeout`','200 seconds','How long without access to voting files']]},
{code:`crsctl get css misscount
crsctl get css disktimeout`},
{h:'Why evict at all?'},
{p:'If a node is hung but still writing to shared disks, it could corrupt the database. Evicting it (and fencing it, often by a restart) **protects the data**.'},
{h:'Split brain'},
{p:'A **split brain** happens if the network breaks and both halves think they are the cluster. The voting files and the majority rule decide: the half that sees the majority survives.'},
{flow:['A node stops sending heartbeats','CSSD of the other nodes waits for misscount','The majority decides the node is gone','The node is evicted and fenced (restarted)','Surviving instances recover its redo']},
{note:'Do not change misscount or disktimeout unless Oracle Support advises. Most evictions are caused by network, CPU starvation or memory pressure, not by the settings.'}],
src:[['Node membership and eviction',O.CW]]};

/* ---------- 4: Resources ---------- */
L['ora-rac:2:4']={blocks:[
{p:'Everything Clusterware manages is a **resource**: a database, an instance, a listener, a VIP, a service, a network. Each resource has a state, a target and rules about when it starts.'},
{h:'Common resources'},
{t:[['Resource name','What it is'],
['`ora.asm`','ASM instance'],
['`ora.<db>.db`','The database'],
['`ora.<node>.vip`','VIP of a node'],
['`ora.scan1.vip`, `ora.LISTENER_SCAN1.lsnr`','SCAN VIP and its listener'],
['`ora.LISTENER.lsnr`','Local listener of a node'],
['`ora.<db>.<service>.svc`','A database service'],
['`ora.net1.network`','A network resource'],
['`ora.DATA.dg`','A disk group']]},
{h:'Attributes that matter'},
{t:[['Attribute','Meaning'],
['**TARGET**','What Clusterware wants: ONLINE or OFFLINE'],
['**STATE**','What it really is now'],
['**START_DEPENDENCIES**','What must be running first (for example the database needs its disk groups)'],
['**RESTART_ATTEMPTS**','How many times to restart before failing over'],
['**Placement**','Which nodes it may run on']]},
{code:`crsctl stat res -t                      # tree view of everything
crsctl stat res ora.orcl.db -p          # all attributes
crsctl stop resource ora.orcl.db        # ask to stop it
crsctl start resource ora.orcl.db`},
{h:'Local vs cluster resources'},
{t:[['Type','Runs','Example'],
['**Local**','On every node','Listener, ASM, network'],
['**Cluster**','On one or some nodes','SCAN VIP, a service, a RAC One Node database']]},
{flow:['A resource fails','CRSD sees the state differ from the target','It tries to restart it locally','If that fails, it relocates the resource to another node','The state matches the target again']},
{note:'Prefer `srvctl` to manage database resources and `crsctl` for the cluster itself. Using the wrong tool can bypass checks and leave resources in a confusing state.'}],
src:[['Clusterware resources',O.CW]]};

/* ---------- 5: Startup and logs ---------- */
L['ora-rac:2:5']={blocks:[
{p:'Knowing the startup order tells you where to look when a node does not join the cluster.'},
{h:'Startup sequence'},
{flow:['The OS boots and systemd starts the OHASD service','OHASD starts agents, then GPNPD, MDNSD and GIPCD','CSSD starts and joins the cluster (voting files)','ASM starts, then the OCR is available','CRSD starts and brings up VIPs, listeners, databases and services']},
{h:'Control the stack'},
{t:[['Command (as root)','Effect'],
['`crsctl check crs`','Status of the local stack'],
['`crsctl check cluster -all`','Status on every node'],
['`crsctl stop crs`','Stop Clusterware on this node'],
['`crsctl start crs`','Start Clusterware on this node'],
['`crsctl disable crs` / `enable crs`','Turn automatic start at boot off or on']]},
{h:'Log locations'},
{t:[['Log','Path (19c)'],
['**Alert log**','`$ORACLE_BASE/diag/crs/<host>/crs/trace/alert.log`'],
['**CSSD**','`.../crs/trace/ocssd.trc`'],
['**CRSD**','`.../crs/trace/crsd.trc`'],
['**OHASD**','`.../crs/trace/ohasd.trc`'],
['**Agent logs**','`.../crs/trace/crsd_oraagent_grid.trc`']]},
{code:`tail -50 /u01/app/grid/diag/crs/rac1/crs/trace/alert.log
grep -i "error\\|evict" /u01/app/grid/diag/crs/rac1/crs/trace/ocssd.trc | tail`},
{h:'Where to look when'},
{t:[['Symptom','Look at'],
['Node will not join','`ocssd.trc`, network, voting files'],
['Resources not starting','`crsd.trc`, agent logs'],
['Stack not starting at all','`ohasd.trc`, systemd status of `oracle-ohasd`']]},
{note:'Always start with the Clusterware alert log of the affected node. It records start, stop, eviction and resource failures in time order.'}],
src:[['Clusterware startup and logs',O.CW]]};

/* ---------- 6: Practical ---------- */
L['ora-rac:2:6']={blocks:[
{p:'On a running cluster, explore each part you have studied. If you do not have a cluster yet, read the expected output now and repeat the commands after the install in section 4.'},
{h:'Step 1: Who is in the cluster?'},
{code:`olsnodes -n -s -t
-- rac1  1  Active  Unpinned
-- rac2  2  Active  Unpinned`},
{h:'Step 2: Is the stack healthy?'},
{code:`crsctl check cluster -all
-- CRS-4537: Cluster Ready Services is online
-- CRS-4529: Cluster Synchronization Services is online
-- CRS-4533: Event Manager is online`},
{h:'Step 3: Resources'},
{code:`crsctl stat res -t
crsctl stat res -t | grep -i vip`},
{h:'Step 4: Voting files, OCR and timing'},
{code:`crsctl query css votedisk
ocrcheck
ocrconfig -showbackup
crsctl get css misscount`},
{h:'Step 5: Logs'},
{code:`ls /u01/app/grid/diag/crs/rac1/crs/trace/ | head
tail -30 /u01/app/grid/diag/crs/rac1/crs/trace/alert.log`},
{h:'Check your understanding'},
{t:[['Question','Where to find the answer'],
['How many voting files are there?','`crsctl query css votedisk`'],
['Where is the OCR?','`ocrcheck`'],
['Which node is running which resource?','`crsctl stat res -t`'],
['What is the eviction timeout?','`crsctl get css misscount`'],
['When did this node last start Clusterware?','Clusterware alert log']]},
{h:'Challenge'},
{ul:['Run `crsctl stop crs` on one node and watch the other with `crsctl stat res -t`.','Start it again and see which resources come back and in which order.']},
{note:'Do not run crsctl stop crs on a production node without a plan. In the lab, it is a safe way to learn how the cluster reacts.'}],
src:[['Clusterware Administration and Deployment Guide',O.CW]]};

})();
