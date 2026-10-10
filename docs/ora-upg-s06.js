/* LearnSphere - Upgrade, Patching & Migration, Section 06: Fleet Patching & Lifecycle Automation.
   Lectures 0-5 are core, 6+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const UG=O.D+'upgrd/';

/* ---------- diagrams ---------- */
const gold=O.dg(700,190,[
[10,50,140,90,'Gold image|19.24 + approved|one-offs, tested',2],
[200,10,130,60,'Host A|home from image',0],[200,80,130,60,'Host B|home from image',0],[200,150,130,35,'Host C',0],
[390,50,140,90,'Databases|move to the|new home',0],
[580,50,110,90,'Old homes|removed after|stability',0]],
[[150,95,200,40],[150,95,200,110],[330,40,390,80],[330,110,390,100],[530,95,580,95]]);

const fleet=O.dg(700,190,[
[10,50,150,90,'Fleet manager|(FPP or script|or Ansible)',2],
[230,10,150,50,'Standard images',0],[230,70,150,50,'Inventory and|compliance data',0],[230,130,150,50,'Orchestration',0],
[450,30,110,60,'Cluster 1',0],[450,110,110,60,'Cluster 2',0],
[600,30,90,60,'DG standby',0],[600,110,90,60,'Single DBs',0]],
[[160,95,230,35],[160,95,230,95],[160,95,230,155],[380,155,450,60],[380,155,450,140],[560,60,600,60],[560,140,600,140]]);

/* ---------- 0: Gold images ---------- */
L['ora-upg:5:0']={blocks:[
{p:'A **gold image** is a tested, patched Oracle home packaged as a file. Every host builds its home from the **same** image.'},
{svg:gold},
{t:[['Benefit','Why'],
['**Consistency**','Every home is identical. No "works on host A only".'],
['**Speed**','Unzip and attach instead of patching each file'],
['**Quality**','The image is tested once, then reused'],
['**Rollback**','The old home is still there']]},
{h:'Standardize'},
{ul:['**One** image per release and patch level, per platform.','A naming convention that includes release, RU and date: `db19_24_20260110`.','A change process for new images, and a list of which one is current.','An **OFA-style** directory layout on every host.']},
{note:'Build the image in a clean environment from the base release, apply the RU and one-offs, run your tests, and then create the image. Do not capture a home that was patched ad hoc.'}],
src:[['Gold images',UG]]};

/* ---------- 1: FPP concepts ---------- */
L['ora-upg:5:1']={blocks:[
{p:'**Fleet Patching and Provisioning (FPP)** is Oracle software for managing many homes and databases from one place. It stores images and does patching and provisioning at scale.'},
{t:[['Concept','Meaning'],
['**FPP server**','Central host holding images and the repository'],
['**Working copy**','A home built from an image on a target'],
['**Image series**','Versions of one image over time'],
['**Move database**','Switch a database from one home to another (patch) with a command'],
['**Targets**','Hosts and clusters managed by FPP']]},
{code:`# outline (see the FPP documentation for exact syntax)
rhpctl import image -image db19_24 -path /stage/goldimage
rhpctl add workingcopy -workingcopy wc19_24 -image db19_24 -client host1
rhpctl move database -sourcewc wc19_20 -patchedwc wc19_24 -dbname orcl`},
{h:'Without FPP'},
{ul:['Scripts + Ansible + gold images can do much of the same.','FPP adds integrated checks, RAC and Data Guard aware ordering.']},
{note:'FPP is part of Oracle Grid Infrastructure, with some features being licensed or depending on platform. Check the licensing guide for your use.'}],
src:[['Fleet Patching and Provisioning',O.CW]]};

/* ---------- 2: Ansible and scripts ---------- */
L['ora-upg:5:2']={blocks:[
{p:'You do not need FPP to automate. A small set of **scripts and Ansible** automates the repeated steps.'},
{t:[['Step','Automate with'],
['Create user, directories, kernel settings','Ansible role'],
['Install home from gold image','`runInstaller` silent, from a template'],
['Pre-checks','Script running `opatch prereq`, space and backup checks'],
['Switch home and patch','AutoUpgrade patch mode or `srvctl modify` and `datapatch`'],
['Verification','SQL checks and a smoke test'],
['Reporting','Output written to a central location']]},
{code:`# Ansible outline
- name: Patch database
  hosts: dbservers
  serial: 1                 # one host at a time
  tasks:
    - name: Pre-checks
      command: /opt/dba/precheck.sh {{ db_name }}
    - name: Patch with AutoUpgrade
      command: java -jar /opt/dba/autoupgrade.jar -config /opt/dba/{{ db_name }}.cfg -patch -mode deploy
    - name: Verify
      command: /opt/dba/verify.sh {{ db_name }}`},
{h:'Rules'},
{ul:['Scripts are code: version control, review and tests.','Idempotent steps: running twice does no harm.','Always include a **dry-run** or evaluation mode.','Never store passwords in playbooks. Use a vault.']},
{note:'Automate the **checks** first. They are the safest part and the part people skip when they are in a hurry.'}],
src:[['AutoUpgrade patch mode',UG]]};

/* ---------- 3: Compliance and inventory ---------- */
L['ora-upg:5:3']={blocks:[
{p:'Patching is only as good as your **knowledge of what you have**. Keep an inventory and report compliance.'},
{t:[['Inventory item','Source'],
['Host, OS version','Ansible facts or CMDB'],
['Oracle homes and their patches','`opatch lsinventory`, `opatch lspatches`'],
['Database release and RU','`V$VERSION`, `DBA_REGISTRY_SQLPATCH`'],
['PDBs, open mode, role','`V$DATABASE`, `V$PDBS`'],
['Data Guard role and lag','`V$DATABASE`, `V$DATAGUARD_STATS`'],
['Owner, environment, criticality','CMDB'],
['Support end date','Release table']]},
{code:`-- a compliance query to run on each database and store centrally
SELECT d.name, d.open_mode, d.database_role,
       (SELECT MAX(action_time) FROM dba_registry_sqlpatch) last_patch_time,
       (SELECT version_full FROM v$instance) version_full
FROM v$database d;`},
{h:'Compliance report'},
{t:[['Metric','Target'],
['% of databases within one RU of current','Above 90 percent'],
['Count of databases out of support','Zero'],
['Average days to apply a critical security patch','Below your policy (for example 30)']]},
{note:'Automate collection daily. A monthly report from live data beats a manual spreadsheet every time.'}],
src:[['Inventory',UG]]};

/* ---------- 4: Coordinating ---------- */
L['ora-upg:5:4']={blocks:[
{p:'Patching a database that is also **RAC**, has a **Data Guard standby** and a **GoldenGate** replication needs an order.'},
{svg:fleet},
{t:[['Component','Order and notes'],
['**Standby (Data Guard)**','Patch the standby first (apply stops, binaries, restart). Then switchover for primary or patch primary with the standby ready. Rolling method available.'],
['**RAC**','Rolling, node by node. Grid Infrastructure first, then the database home. `datapatch` once at the end.'],
['**GoldenGate**','Check version compatibility with the database RU. Stop Extract before the outage, restart after.'],
['**Applications**','Use Application Continuity or planned drain of services so sessions move before each node stops']]},
{flow:['Read the READMEs for every component','Patch non-production in the same order as production','Patch standby and secondary nodes first','Switch roles or fail over services','Patch the remaining nodes','Run datapatch once, verify, run the smoke test']},
{note:'Draw the order for your own estate and keep it in the runbook. The order depends on your design, and mistakes happen at 2 a.m.'}],
src:[['Rolling patching',O.RAC],['Data Guard',O.DG]]};

/* ---------- 5: Practical ---------- */
L['ora-upg:5:5']={blocks:[
{p:'**Automate a patch cycle on three databases.** Build the pipeline in your lab.'},
{flow:['Collect inventory from three databases (query script)','Build or download a gold image with the next RU','Write a pre-check script (OPatch version, space, backup age, restore point)','Write the patch step (AutoUpgrade patch mode or script)','Write the verification script (patch level, components, invalid objects, smoke test)','Run it on the first database, review, then on the other two']},
{code:`#!/bin/bash
# precheck.sh <db>
set -e
echo "OPatch: $($ORACLE_HOME/OPatch/opatch version | head -1)"
df -h $ORACLE_HOME | tail -1
echo "Last backup:"
rman target / <<EOF | grep -i "completion time" | tail -1
LIST BACKUP SUMMARY;
EOF`},
{h:'Check your result'},
{t:[['Check','Expected'],
['Inventory report','Three databases with release and patch level'],
['Run on database 1','All steps succeed, logged'],
['Verification','Patch level changed, components valid, smoke test passes'],
['Runs 2 and 3','No manual steps'],
['Rollback','Documented and tested on one database']]},
{note:'The aim is not the script itself. It is that a patch cycle becomes **repeatable and auditable** and stops depending on one person.'}],
src:[['Patching',UG]]};

})();
