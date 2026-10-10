/* LearnSphere - Exadata, Section 08: Patching & Lifecycle Management.
   Lectures 0-6 are core, 7-10 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const stack=O.dg(700,260,[
[10,10,680,60,'Grid Infrastructure and Database homes: opatchauto (or cloud tools)',2],
[10,80,680,50,'Database servers: operating system and Exadata image (patchmgr -dbnodes)',0],
[10,140,680,50,'Storage servers: Exadata System Software image (patchmgr -cells)',0],
[10,200,680,50,'Switches, firmware (ILOM, disks, flash): patchmgr and bundled firmware updates',0]],[]);

const roll=O.dg(700,150,[
[10,25,150,70,'Cell 1|offline, update,|back online',2],[200,25,150,70,'Wait for ASM resync|check grid disks|ONLINE',0],[390,25,150,70,'Cell 2|offline, update,|back online',2],[580,25,110,70,'Repeat for|each cell',0]],
[[160,60,200,60],[350,60,390,60],[540,60,580,60]]);

/* ---------- 0: What gets patched ---------- */
L['ora-exa:7:0']={blocks:[
{p:'An Exadata has many layers of software and firmware. Each layer has its own patch and its own tool. Knowing the list is the first step of any patching plan.'},
{svg:stack},
{t:[['Component','What is patched','Tool','Rolling possible?'],
['**Storage servers**','Exadata System Software image: OS, cell software, firmware','`patchmgr -cells`','Yes (one cell at a time)'],
['**Database servers**','OS and Exadata image on each server','`patchmgr -dbnodes`','Yes (one node at a time)'],
['**Switches**','RoCE or InfiniBand switch software','`patchmgr` for switches','Yes (one switch at a time)'],
['**Grid Infrastructure**','Clusterware and ASM','`opatchauto` or cloud tooling','Yes'],
['**Database homes**','Database software','`opatchauto`, `datapatch`','Yes with RAC'],
['**Firmware**','ILOM, disks, flash, network adapters','Included in image updates','Per image update']]},
{h:'Quarterly bundles'},
{p:'Oracle ships quarterly bundles that include storage, database server, switch and firmware updates. Read the README of the bundle you apply. It lists the order, the versions and the known issues.'},
{flow:['Read the quarterly README and the support matrix','Plan the order and the window','Patch storage, database servers and switches as advised','Patch Grid and database homes','Run EXAchk and validate']},
{note:'The supported version combinations are in My Oracle Support Doc ID 888828.1 (Exadata Database Machine and Exadata Storage Server Supported Versions). Check it before you mix versions.'}],
src:[['Exadata patching',O.EXA]]};

/* ---------- 1: Order and rolling ---------- */
L['ora-exa:7:1']={blocks:[
{p:'Two decisions shape a patching project: **in which order** you patch layers, and whether you do it **rolling** or **non-rolling**.'},
{h:'Rolling or non-rolling'},
{t:[['','Rolling','Non-rolling'],
['**How**','One server at a time, the others keep working','All servers of a type at once'],
['**Database**','Stays open (RAC and ASM redundancy)','Stopped during the update'],
['**Duration**','Longer in total','Shorter'],
['**Risk**','A second failure during the window is a problem','Planned outage, simpler'],
['**Needs**','HIGH or NORMAL ASM redundancy with healthy disks, RAC','A downtime window']]},
{svg:roll},
{h:'Order'},
{p:'The bundle README gives the exact order. A common sequence is:'},
{flow:['Storage servers','Database servers','Switches','Grid Infrastructure','Database homes and datapatch']},
{note:'The order can change between releases, so always follow the README of your bundle.'},
{h:'Rolling safety check for cells'},
{code:`cellcli -e list griddisk attributes name,asmModeStatus,asmDeactivationOutcome
-- every row must show asmDeactivationOutcome = Yes before the next cell goes offline`},
{h:'Choose'},
{t:[['Situation','Choice'],
['24x7 service with RAC and good redundancy','Rolling'],
['Planned downtime window available','Non-rolling for speed'],
['Dev and test','Non-rolling']]}],
src:[['Patching approach',O.EXA]]};

/* ---------- 2: patchmgr cells ---------- */
L['ora-exa:7:2']={blocks:[
{p:'**patchmgr** is the tool that updates storage servers and switches. You run it from a database server (or admin host) with SSH access to the targets.'},
{h:'Storage servers'},
{code:`# Unzip the patch on the database server and go to the patchmgr folder
cd /u01/stage/patch_cells/patch_xx

# 1. Check prerequisites (no changes)
./patchmgr -cells ~/cell_group -patch_check_prereq -rolling

# 2. Apply, one cell at a time
./patchmgr -cells ~/cell_group -patch -rolling

# 3. If needed, roll back to the previous image
./patchmgr -cells ~/cell_group -rollback -rolling

# Clean up temporary files after success
./patchmgr -cells ~/cell_group -cleanup`},
{t:[['Option','Meaning'],
['`-patch_check_prereq`','Check that the update will work. Changes nothing.'],
['`-patch`','Apply the update'],
['`-rolling`','Do one cell at a time (otherwise all at once)'],
['`-rollback`','Go back to the previous image'],
['`-cleanup`','Remove working files']]},
{h:'Why rollback is possible'},
{p:'Each cell keeps **two system images**: the active one and the previous one. An update installs to the inactive image, then reboots into it. If the update fails or you roll back, the cell boots the old image.'},
{h:'Switches'},
{code:`./patchmgr -roceswitches ~/roceswitch.lst -upgrade       # RoCE switches
./patchmgr -ibswitches ~/ibswitch.lst -upgrade           # InfiniBand switches (older systems)`},
{flow:['Prepare: files, SSH keys, group files','Run the prerequisite check','Run the update (rolling or not)','Watch the log and the cell status','Check ASM disks are online before you continue']},
{note:'Read the patchmgr output. If a cell fails the update, stop and investigate before you continue to the next one.'}],
src:[['patchmgr',O.EXA]]};

/* ---------- 3: Database server updates ---------- */
L['ora-exa:7:3']={blocks:[
{p:'Database servers also have an Exadata **image** (operating system, drivers and firmware). It is updated with **patchmgr** as well, one node at a time in a RAC cluster.'},
{code:`# Precheck from another node or an admin host
./patchmgr -dbnodes ~/dbs_group -precheck -iso_repo /u01/stage/dbserver_patch.zip -target_version <version>

# Update one node at a time
./patchmgr -dbnodes ~/dbs_group -upgrade -iso_repo /u01/stage/dbserver_patch.zip -target_version <version> -rolling

# Check the result
dcli -g ~/dbs_group -l root "imageinfo -ver"`},
{h:'What happens on each node'},
{flow:['The node is taken out: Clusterware stops its resources','A backup of the OS volume is taken','The new image is applied and the node reboots','Clusterware starts again and the node rejoins','The next node is processed']},
{h:'Before you start'},
{ul:['Check that the other nodes are healthy: `crsctl check cluster -all`.','Have the services drain or move before the node is stopped.','Take OCR and database backups.','Free enough space in the root and /u01 file systems.']},
{h:'Virtualised systems'},
{p:'On KVM-based systems there are two levels: the **host** (hypervisor) and the **guest** VMs. Each is updated with its own procedure. In the cloud, Oracle updates the host, and you update the guest.'},
{note:'The patch can take an hour or more per node. Plan for it in the window, and do not run another maintenance task on the same cluster at the same time.'}],
src:[['Updating database servers',O.EXA]]};

/* ---------- 4: GI and DB homes ---------- */
L['ora-exa:7:4']={blocks:[
{p:'Grid Infrastructure and the database homes are patched in the same way as on any RAC (see the RAC sub-course). On Exadata, a few extras apply.'},
{h:'On-premises'},
{code:`# As root, node by node
opatchauto apply /stage/gi_ru/<patch> -analyze
opatchauto apply /stage/gi_ru/<patch>

# After all nodes
$ORACLE_HOME/OPatch/datapatch -verbose`},
{h:'In the cloud'},
{p:'Exadata cloud services provide tools to patch Grid Infrastructure and databases from the **console, APIs or `dbaascli`**. They handle the steps and the rolling order for you.'},
{code:`dbaascli patch db apply --patchid <id> --dbnames orcl      # illustrative: check the current syntax
dbaascli patch db list`},
{h:'Points for Exadata'},
{ul:['Use the **Exadata-specific** bundle patch where the README says so, since it includes tested one-offs.','Keep the Grid home and database homes at supported levels for the Exadata image version.','Run EXAchk before and after, and read its output.','Move databases out of place to a new patched home when you can.']},
{flow:['Check the support matrix for your image version','Patch Grid, node by node','Patch database homes (or switch to a new home)','Run datapatch once','Run EXAchk and test the application']},
{note:'Cloud tools differ from release to release. Follow the current documentation and use the tool the service provides, so that the service can still manage the system.'}],
src:[['Patching Grid and database',O.RAC],['Exadata Cloud patching','https://docs.oracle.com/en-us/iaas/exadatacloud/index.html']]};

/* ---------- 5: Prechecks, rollback, backups ---------- */
L['ora-exa:7:5']={blocks:[
{p:'Good patching is mostly **preparation**. The work during the window is the shorter part.'},
{h:'Prechecks'},
{t:[['Check','How'],
['Supported versions','Support matrix and the bundle README'],
['System health','`exachk`, `crsctl check cluster -all`, `srvctl status database`'],
['Cell and disk health','`cellcli -e list griddisk`, no failed disks, `asmDeactivationOutcome = Yes`'],
['ASM free space and redundancy','`V$ASM_DISKGROUP`, `USABLE_FILE_MB` positive'],
['Prerequisite check by the tool','`patchmgr ... -patch_check_prereq`'],
['Disk space on servers','`df -h` on root and /u01'],
['Open issues','No unresolved hardware faults or alerts']]},
{h:'Backups'},
{ul:['Database backup (RMAN) with a tested restore path.','OCR backup and a copy of the Clusterware configuration.','Copies of important configuration files and group files.','Configuration of cells (`cellcli list` outputs, IORM plan).']},
{h:'Rollback options'},
{t:[['Layer','Rollback'],
['Cells','`patchmgr -rollback` to the previous image'],
['Database servers','Boot the previous image from the backup taken during the update'],
['Grid and database homes','Switch back to the old home (out of place) or roll back the patch with opatchauto'],
['Database dictionary','Datapatch rollback with the matching patch rollback']]},
{flow:['Run all prechecks and fix issues','Take backups','Patch in the planned order','At each step, check health before continuing','If a check fails, stop and decide: fix or roll back']},
{note:'Agree beforehand when you will roll back, for example if a step takes twice as long as planned. Decisions made in the middle of the night are worse than decisions made in the plan.'}],
src:[['Patching prerequisites',O.EXA]]};

/* ---------- 6: Practical ---------- */
L['ora-exa:7:6']={blocks:[
{p:'Plan and **rehearse on paper** a full-stack patching cycle for a half-rack Exadata with 4 database servers, 7 cells and a RAC database. Use illustrative times.'},
{h:'Fill in the plan'},
{t:[['Step','Task','Time (example)','Check after'],
['1','Prechecks, EXAchk, backups','3 hours (before the window)','Report with no failures'],
['2','Cells: rolling update, 7 cells x 45 min','5 to 6 hours','All grid disks ONLINE, asmDeactivationOutcome = Yes'],
['3','Database servers: rolling, 4 x 60 min','4 hours','`crsctl check cluster -all`'],
['4','Switches, one at a time','1 hour','Fabric status ok'],
['5','Grid Infrastructure: rolling','2 hours','`crsctl query crs activeversion`'],
['6','Database homes and datapatch','2 hours','`DBA_REGISTRY_SQLPATCH`'],
['7','EXAchk, application tests','2 hours','No new FAIL, application OK']]},
{h:'Decisions to write down'},
{ul:['Which window and who is on call for each step.','At which time you roll back if a step is late.','How users are drained from each node.','Who tests the application and what they test.','How you tell the business before and after.']},
{h:'Rehearsal'},
{flow:['Run the full plan on a test or lower environment','Record times and issues','Update the plan','Get approval from application and business owners','Run in production with the same plan']},
{h:'Challenge'},
{p:'Rewrite the plan for a non-rolling patch with a 6-hour outage. Which steps can run in parallel?'},
{note:'A plan that has never been rehearsed is a guess. Use the results of the rehearsal to set realistic times.'}],
src:[['Exadata patching',O.EXA]]};

})();
