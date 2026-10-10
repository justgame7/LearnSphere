/* LearnSphere - Grid Infrastructure, ASM & RAC, Section 04: Installing Grid Infrastructure.
   Lectures 0-6 are core, 7-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const steps=O.dg(700,120,[
[10,30,100,60,'1 Plan|disks, networks|names',0],[130,30,100,60,'2 Unzip|Grid home on|node 1',0],[250,30,100,60,'3 gridSetup.sh|GUI or silent',2],[370,30,100,60,'4 root.sh|node 1, then|node 2',2],[490,30,100,60,'5 Verify|cluvfy post,|crsctl',0],[610,30,80,60,'6 Add|DATA, FRA',0]],
[[110,60,130,60],[230,60,250,60],[350,60,370,60],[470,60,490,60],[590,60,610,60]]);

const scan=O.dg(700,190,[
[10,70,110,55,'Client|rac-scan',0],[170,70,140,55,'SCAN listener|one of three|any node',2],[360,10,150,50,'Local listener|node 1 (VIP)',0],[360,130,150,50,'Local listener|node 2 (VIP)',0],[560,10,130,50,'Instance 1',0],[560,130,130,50,'Instance 2',0]],
[[120,97,170,97],[310,85,360,35],[310,110,360,155],[510,35,560,35],[510,155,560,155]]);

/* ---------- 0: Planning ---------- */
L['ora-rac:3:0']={blocks:[
{p:'Make the key decisions before you start the installer. Changing disk groups or role separation later is much harder than choosing well now.'},
{svg:steps},
{h:'Decisions to make'},
{t:[['Decision','Typical choice'],
['**Cluster type**','Standalone cluster (the default for most sites)'],
['**Role separation**','Yes: `grid` owns Grid, `oracle` owns the database'],
['**ASM mode**','Flex ASM: not every node needs an ASM instance'],
['**Disk group for OCR and voting files**','`+OCR` (or `+GRID`), NORMAL redundancy, 3 disks'],
['**Disk groups for data**','`+DATA`, `+FRA` created after or during the install'],
['**Network classification**','One public network, one private (interconnect) network'],
['**Names**','Cluster name, SCAN name and port 1521']]},
{h:'Disk group redundancy for the OCR group'},
{t:[['Redundancy','Disks needed','Voting files','Use'],
['**External**','1','1','Lab, or storage that mirrors'],
['**Normal**','3 (3 failure groups)','3','Most production systems'],
['**High**','5','5','Highest protection']]},
{h:'Before you start'},
{ul:['Section 2 checks have passed: cluvfy pre-install is clean.','You have the Grid software zip and the latest Release Update (optional at install).','You know the passwords for ASM (`SYS`, `ASMSNMP`).','A VM snapshot exists (in a lab).']},
{flow:['Confirm hardware, OS and network ready','Choose disks for OCR and voting files','Decide cluster, SCAN and VIP names','Unzip the Grid software','Run the installer']},
{note:'Keep the OCR and voting files in their own small disk group. Database disk groups can then be created, resized and dropped without touching the cluster configuration.'}],
src:[['Installing Oracle Grid Infrastructure',D+'cwlin/']]};

/* ---------- 1: gridSetup.sh ---------- */
L['ora-rac:3:1']={blocks:[
{p:'Since 19c, the Grid software is delivered as a zip file that you unzip **straight into the Grid home**. You run `gridSetup.sh` from it, as the `grid` user, on the **first node only**. The installer copies and configures the other nodes through SSH.'},
{code:`# As grid, on rac1
cd /u01/app/19.0.0/grid
unzip -q /stage/LINUX.X64_193000_grid_home.zip
./gridSetup.sh`},
{h:'The GUI steps (short version)'},
{flow:['Configure Oracle Grid Infrastructure for a New Cluster','Standalone cluster','Cluster name, SCAN name and port','Add the second node (name and VIP) and test SSH','Network: mark public and private interfaces','Storage: Flex ASM, create the OCR disk group from the disks','Passwords, groups, locations','Run prerequisite checks, then Install','Run root.sh on each node when asked']},
{h:'Silent install with a response file'},
{code:`./gridSetup.sh -silent -responseFile /home/grid/grid.rsp -ignorePrereqFailure

# Important keys in grid.rsp
oracle.install.option=CRS_CONFIG
ORACLE_BASE=/u01/app/grid
oracle.install.crs.config.clusterName=racdemo
oracle.install.crs.config.scanType=LOCAL_SCAN
oracle.install.crs.config.gpnp.scanName=rac-scan
oracle.install.crs.config.gpnp.scanPort=1521
oracle.install.crs.config.clusterNodes=rac1:rac1-vip:HUB,rac2:rac2-vip:HUB
oracle.install.crs.config.networkInterfaceList=eth0:192.168.56.0:1,eth1:10.10.10.0:5
oracle.install.crs.config.storageOption=FLEX_ASM_STORAGE
oracle.install.asm.diskGroup.name=OCR
oracle.install.asm.diskGroup.redundancy=NORMAL
oracle.install.asm.diskGroup.disksWithFailureGroupNames=/dev/oracleasm/ocr1,,/dev/oracleasm/ocr2,,/dev/oracleasm/ocr3,
oracle.install.asm.diskGroup.diskDiscoveryString=/dev/oracleasm/*`},
{t:[['Interface code','Meaning'],
['`1`','Public network'],
['`5`','ASM and private (interconnect)'],
['`3`','Do not use']]},
{h:'The root scripts'},
{p:'When the installer asks, run the root scripts as **root**, **one node at a time**, first on rac1 and then on rac2. They configure and start Clusterware.'},
{code:`/u01/app/oraInventory/orainstRoot.sh     # as root on each node, if asked
/u01/app/19.0.0/grid/root.sh              # as root, rac1 first, then rac2`},
{note:'Do not run root.sh on two nodes at once. The first node must finish before the second starts. Avoid -ignorePrereqFailure except in a lab where you understand the failed check.'}],
src:[['Installing Grid Infrastructure',D+'cwlin/'],['Response files',D+'cwlin/']]};

/* ---------- 2: SCAN, VIPs, listener ---------- */
L['ora-rac:3:2']={blocks:[
{p:'The installer creates the **network resources** your clients will use. Understand how they work together, because every RAC connection goes through them.'},
{svg:scan},
{h:'How a client connects'},
{flow:['The client connects to the SCAN name','DNS returns one of the SCAN addresses','The SCAN listener there picks the least loaded instance that offers the service','It redirects the client to that node local listener (on its VIP)','The client connects directly to the instance']},
{t:[['Resource','What it is'],
['**SCAN VIP and SCAN listener**','Entry point for clients. Up to three, spread over the nodes.'],
['**Node VIP**','An address per node that fails over if the node fails'],
['**Local listener**','Listener on each node VIP, port 1521'],
['**Network resource**','`ora.net1.network` describes the subnet']]},
{h:'Check them'},
{code:`srvctl config scan
srvctl status scan_listener
srvctl config vip -n rac1
srvctl status listener
srvctl config network

nslookup rac-scan                  # should return the SCAN addresses
lsnrctl status LISTENER_SCAN1      # run with the Grid environment`},
{h:'Client connect string'},
{code:`orcl =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = rac-scan.example.com)(PORT = 1521))
    (CONNECT_DATA = (SERVICE_NAME = orcl_svc))
  )`},
{p:'The client only knows the SCAN. You can add or remove nodes and clients do not need any change.'},
{note:'Use the Grid environment (with the ASM instance as the SID) to run lsnrctl for the SCAN listener and the listener resource. Using the database environment may show the wrong listener.'}],
src:[['SCAN and VIPs',O.CW],['Oracle Net and RAC',O.RAC]]};

/* ---------- 3: First ASM disk groups ---------- */
L['ora-rac:3:3']={blocks:[
{p:'The installer creates one ASM disk group for the **OCR and voting files**. You then create more disk groups for the database and the Fast Recovery Area.'},
{h:'The first disk group'},
{code:`asmcmd lsdg
-- State    Type    Rebal  Sector  AU_Size  Total_MB  Free_MB  Usable_file_MB  Name
-- MOUNTED  NORMAL  N      512     4194304  15360     14448    ...             OCR/

crsctl query css votedisk
ocrcheck`},
{h:'Create DATA and FRA'},
{code:`-- As SYSASM, connected to the ASM instance
. oraenv                     # ORACLE_SID=+ASM1
sqlplus / as sysasm

CREATE DISKGROUP DATA EXTERNAL REDUNDANCY DISK '/dev/oracleasm/data1', '/dev/oracleasm/data2'
  ATTRIBUTE 'compatible.asm'='19.0', 'compatible.rdbms'='19.0';

CREATE DISKGROUP FRA EXTERNAL REDUNDANCY DISK '/dev/oracleasm/fra1'
  ATTRIBUTE 'compatible.asm'='19.0', 'compatible.rdbms'='19.0';`},
{p:'You can also use **`asmca`**, the graphical tool, or `asmcmd mkdg` with an XML file.'},
{h:'Make them available to all nodes'},
{p:'A new disk group is created on one ASM instance. Mount it on the other nodes (this happens automatically as a cluster resource).'},
{code:`srvctl status diskgroup -diskgroup DATA
crsctl stat res ora.DATA.dg -t`},
{t:[['Disk group','Typical use','Redundancy in production'],
['`OCR`','OCR and voting files','NORMAL'],
['`DATA`','Datafiles, redo, control files','NORMAL or HIGH (or EXTERNAL on mirrored storage)'],
['`FRA`','Backups, archive logs, flashback','NORMAL or HIGH']]},
{flow:['Installer creates the OCR disk group','You create DATA and FRA with asmca or SQL','The new groups mount on every node','Databases use +DATA and +FRA']}],
src:[['Creating disk groups',O.ASM],['asmca',O.ASM]]};

/* ---------- 4: Post-install verification ---------- */
L['ora-rac:3:4']={blocks:[
{p:'Do not assume a clean install. Run a short set of checks as soon as it finishes, and keep the output as your baseline.'},
{h:'The checks'},
{code:`# Cluster and resources
crsctl check cluster -all
crsctl stat res -t
olsnodes -n -s

# OCR, voting files, networks
ocrcheck
crsctl query css votedisk
oifcfg getif

# ASM
srvctl status asm
asmcmd lsdg

# Full cluster check
cluvfy stage -post crsinst -n all -verbose`},
{t:[['Check','Good result'],
['`crsctl check cluster -all`','CRS, CSS and EVM online on both nodes'],
['`crsctl stat res -t`','All resources ONLINE or intentionally OFFLINE'],
['`ocrcheck`','Succeeded, and no corruption'],
['`crsctl query css votedisk`','Three voting files ONLINE for normal redundancy'],
['`srvctl status asm`','ASM running on the nodes in the cluster'],
['`cluvfy stage -post crsinst`','All PASSED']]},
{h:'Where the install logs are'},
{t:[['Log','Location'],
['Installer','`/u01/app/oraInventory/logs/GridSetupActions<date>`'],
['root.sh','`$GRID_HOME/install/root_<node>_<date>.log`'],
['Clusterware','`$ORACLE_BASE/diag/crs/<node>/crs/trace/alert.log`']]},
{h:'Set the Grid environment'},
{code:`# ~/.bash_profile of the grid user on rac1
export ORACLE_BASE=/u01/app/grid
export ORACLE_HOME=/u01/app/19.0.0/grid
export ORACLE_SID=+ASM1
export PATH=$ORACLE_HOME/bin:$PATH
# on rac2 use +ASM2`},
{flow:['Run the checks on node 1','Run them from node 2 as well','Save the output as the baseline','Fix any warning','Snapshot the lab, then install the database software']},
{note:'Keep the root.sh output and the installer log. They are the first things Oracle Support will ask for if the cluster has a problem later.'}],
src:[['Post-installation tasks',D+'cwlin/']]};

/* ---------- 5: 26ai changes ---------- */
L['ora-rac:3:5']={blocks:[
{p:'Grid Infrastructure for **26ai** is installed in the same way as 19c, with `gridSetup.sh`. This lecture lists what changes for the installer. Always check the **26ai installation guide** for the exact steps, since details move between release updates **[26ai]**.'},
{h:'What stays the same'},
{ul:['The Grid software is unzipped into the Grid home and configured with `gridSetup.sh`.','Role separation, SCAN, VIPs, ASM disk groups and root scripts work as before.','`cluvfy` is run before and after the install.']},
{h:'What changes'},
{t:[['Item','19c','26ai'],
['**config.sh** (the old configuration wizard)','Deprecated, `gridSetup.sh` replaces it','**Desupported**: use gridSetup.sh and its configuration tools'],
['**Policy-managed databases**','Supported','Desupported. Use administrator-managed databases.'],
['**Pluggable-only databases**','Non-CDB possible','Databases are CDBs, so plan PDB services']]},
{h:'What this means for your scripts'},
{ul:['Remove calls to `config.sh` from automation. Use `gridSetup.sh -executeConfigTools` or the response file flow.','Check existing databases: if any are policy-managed, plan to convert them to administrator-managed before moving to 26ai.','Test the install in a lab and keep the 26ai response file under version control.']},
{flow:['Read the 26ai installation guide and release notes','Test the install in a lab with your response file','Update automation that used config.sh','Convert policy-managed databases before the upgrade','Plan the move from 19c with a rolling upgrade']},
{note:'A new release changes small things in the installer. Do not carry old scripts forward without a test run.'}],
src:[['Oracle Grid Infrastructure 26ai documentation',O.D26+'cwlin/'],['Release notes',O.D26]]};

/* ---------- 6: Practical ---------- */
L['ora-rac:3:6']={blocks:[
{p:'Install Grid Infrastructure on your two-node lab. Take your time and note every screen choice. You will use the result in all later sections.'},
{h:'Steps'},
{flow:['Take a snapshot of both nodes','Log in as grid on rac1, unzip the Grid software into the Grid home','Run gridSetup.sh and use the plan from your notes','Fix any prerequisite failures reported by the installer','Run root.sh on rac1 and wait for it to finish','Run root.sh on rac2','Run the post-install checks']},
{h:'Your values (example)'},
{t:[['Setting','Value'],
['Cluster name','`racdemo`'],
['SCAN','`rac-scan`, port 1521'],
['Nodes','`rac1`, `rac2` with their VIPs'],
['Networks','public `192.168.56.0`, private `10.10.10.0`'],
['OCR disk group','`OCR`, NORMAL, three disks'],
['Passwords','Lab values only, kept out of notes shared with others']]},
{h:'After the install'},
{code:`crsctl check cluster -all
crsctl stat res -t
ocrcheck
crsctl query css votedisk
cluvfy stage -post crsinst -n rac1,rac2 -verbose

# Create the database disk groups
sqlplus / as sysasm
CREATE DISKGROUP DATA EXTERNAL REDUNDANCY DISK '/dev/oracleasm/data1';
CREATE DISKGROUP FRA  EXTERNAL REDUNDANCY DISK '/dev/oracleasm/fra1';`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`crsctl check cluster -all`','Online on both nodes'],
['`olsnodes -n -s`','rac1 and rac2 Active'],
['`asmcmd lsdg`','OCR, DATA and FRA MOUNTED'],
['`srvctl config scan`','Three SCAN VIPs (or one in a simple lab)'],
['`cluvfy stage -post crsinst`','PASSED']]},
{h:'If root.sh fails'},
{ul:['Read the root log named in the failure message.','Typical causes: a disk not visible, wrong network settings or the clock not in sync.','Deconfigure with the documented rootcrs.sh -deconfig tool and start again. Do not delete files by hand.']},
{note:'Take another snapshot after a successful install. It is the starting point for the rest of the RAC labs.'}],
src:[['Grid Infrastructure Installation Guide',D+'cwlin/']]};

})();
