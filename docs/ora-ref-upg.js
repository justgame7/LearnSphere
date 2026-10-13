/* LearnSphere - Oracle Upgrade, Patching & Migration Quick Reference (cheat sheet).
   window.QREF['ora-upg'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Values are for Oracle Database 19c on Linux unless stated; 26ai items are marked [26ai].
   Support dates and patch cadence change: confirm on My Oracle Support (Doc ID 742060.1) and in the release Upgrade Guide. */
window.QREF=window.QREF||{};
window.QREF['ora-upg']={title:'Upgrade, Patching & Migration Quick Reference',blurb:'Patch types, tool commands, AutoUpgrade settings, views, errors and checklists on one page each.',hint:'datapatch or autoupgrade',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas behind Oracle patching, upgrades and migration that you should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command or query to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Releases and patch types'},
{acc:[
{t:'The release model',s:'Long-term and innovation releases.',
 a:'Oracle ships **long-term releases** (such as 19c and 26ai), with years of support, and **innovation releases** with a shorter life. Version names have a release part (19c) and a patch level (19.24). You normally stay on a long-term release and move to the next one on a planned upgrade.',
 w:'It decides how long your version is supported and how often you have a major project.',
 c:`SELECT version_full, banner_full FROM v$instance, v$version WHERE banner_full LIKE 'Oracle%' FETCH FIRST 1 ROW ONLY;`,see:[0,0,'The release model: long-term, innovation and version naming']},
{t:'Patch types',s:'RU, MRP, one-off, bundle, CPU.',
 a:'A **Release Update (RU)** is the regular quarterly bundle of fixes and security fixes. A **Monthly Recommended Patch (MRP)** adds fixes on top of an RU. A **one-off** fixes a single bug. **Bundle patches** are product-specific sets. The **Critical Patch Update** programme is the security content on a fixed schedule.',
 w:'Knowing which type you hold tells you the risk, the testing effort and what to put in the change record.',
 c:`SELECT patch_id, patch_type, action, status, description FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 5 ROWS ONLY;`,see:[0,1,'Patch types: Release Update, MRP, one-off, bundle and CPU']},
{t:'Security patch cadence',s:'Quarterly, and monthly security updates.',
 a:'Security fixes are published on a regular schedule, quarterly for the Critical Patch Update and, from 2026, with a more frequent security-focused patch (the CSPU). Your own cadence should keep you within a small number of releases of the latest.',
 w:'A patch policy is a security control. The window of exposure is the time between publication and your installation.',
 c:`SELECT TO_CHAR(MAX(action_time),'YYYY-MM-DD') AS last_patch FROM dba_registry_sqlpatch WHERE status = 'SUCCESS';`,see:[0,2,'Monthly CSPUs and the quarterly CPU cycle (2026 change)']},
{t:'Support timelines',s:'Premier, extended and sustaining.',
 a:'Each release has dates for premier support, extended support and sustaining support. After premier support new fixes become harder to obtain or cost extra. These dates drive your upgrade plan, and the plan should start a year before the deadline.',
 w:'It is better to schedule an upgrade than to be forced into one.',
 c:`SELECT version_full FROM v$instance;`,see:[0,3,'Support timelines and what they mean for planning']},
{t:'A patch strategy',s:'Cadence, environments, risk.',
 a:'A strategy states how often you patch, in which order (development, test, pre-production, production), what testing each step needs and who approves. It balances the risk of patching (a regression) against the risk of not patching (a vulnerability).',
 w:'Without a written cadence patching is done in a crisis, which is the worst time.',
 c:`SELECT instance_name, host_name, version_full FROM v$instance;`,see:[0,5,'A patch strategy: cadence, environments and risk']},
{t:'Reading a patch README',s:'Prerequisites and steps are in it.',
 a:'The **README** of a patch lists prerequisites (OPatch version, other patches), the exact steps, whether the patch is rolling, whether `datapatch` is needed and the rollback steps. Reading it is not optional.',
 w:'Most failed patches are a skipped prerequisite or a missed post-step.',
 c:`$ opatch version
$ opatch prereq CheckConflictAgainstOHWithDetail -ph ./36000000`,see:[0,4,'Finding and reading patch READMEs on My Oracle Support']}
]},

{h:'Patching mechanics'},
{acc:[
{t:'The Oracle home and inventory',s:'What is installed and where.',
 a:'The **Oracle home** holds the software (binaries). The **central inventory** and the home inventory record what is installed and which patches are applied. `opatch lsinventory` reads them. Patching changes the home and the inventory, not the database files.',
 w:'A damaged inventory blocks patching, so back it up and keep it consistent.',
 c:`$ $ORACLE_HOME/OPatch/opatch lspatches
$ $ORACLE_HOME/OPatch/opatch lsinventory`,see:[1,0,'Oracle home inventory and OPatch basics']},
{t:'OPatch and conflict checks',s:'Binaries first.',
 a:'**OPatch** applies patches to the home. Before applying, it can check for **conflicts** with patches already installed. A conflict means two patches change the same object, and you need a merge patch or a different set.',
 w:'Always run the prerequisite and conflict checks, ideally on a copy of the home.',
 c:`$ opatch prereq CheckConflictAgainstOHWithDetail -ph ./36000000
$ opatch apply`,see:[1,1,'Pre-checks and conflict detection']},
{t:'Datapatch',s:'The SQL half of a patch.',
 a:'A patch changes both the **binaries** and, often, **database objects** such as the data dictionary or PL/SQL packages. **datapatch** applies the SQL side after the instance runs on the new home. The result is recorded in `DBA_REGISTRY_SQLPATCH`.',
 w:'A patched home with no datapatch leaves the database half-patched. Always check the registry.',
 c:`$ $ORACLE_HOME/OPatch/datapatch -verbose
SELECT patch_id, action, status FROM dba_registry_sqlpatch ORDER BY action_time DESC;`,see:[1,3,'Running datapatch and verifying SQL patches']},
{t:'In-place vs out-of-place patching',s:'Change the home, or switch to a new one.',
 a:'**In-place** patching modifies the existing home, requiring downtime while it is stopped. **Out-of-place** patching installs a new home from a gold image or a patched copy, then moves the database to it. The old home stays untouched, and rollback is a switch back.',
 w:'Out-of-place is the recommended method: shorter outage, easy rollback, and a tested image to reuse.',
 c:`SELECT instance_name, host_name FROM v$instance;
$ srvctl modify database -db orcl -oraclehome /u01/app/oracle/product/19.24/dbhome_1`,see:[1,4,'Out-of-place patching with gold images']},
{t:'Gold images',s:'A tested, standard home.',
 a:'A **gold image** is an Oracle home with the chosen patches already applied and tested, saved as a zip. New homes are created from it, so every server gets exactly the same software, and a new patch level is a new image.',
 w:'It replaces "apply the patches to each server" with "deploy the same image".',
 c:`$ gridSetup.sh -createGoldImage -destinationLocation /images
$ $ORACLE_HOME/runInstaller -createGoldImage`,see:[5,0,'Gold images and standardized Oracle homes']},
{t:'Rollback',s:'Know how to undo it.',
 a:'Most patches can be rolled back with `opatch rollback` and `datapatch`, or by switching back to the old home. Rollback has its own prerequisites, and some changes (such as a database upgrade or a time zone update) cannot simply be undone.',
 w:'The question "how do we go back" must have an answer before the change begins.',
 c:`$ opatch rollback -id 36000000
$ datapatch -verbose`,see:[1,5,'Rollback and troubleshooting failed patches']},
{t:'AutoUpgrade for patching',s:'One tool for upgrade and patch.',
 a:'**AutoUpgrade** can also patch: you give it a configuration file naming the target patches and it downloads, creates a new home, and moves the database. It uses the same analyse, deploy flow as an upgrade.',
 w:'It automates the steps and the checks, so a patch is reproducible.',
 c:`$ java -jar autoupgrade.jar -config patch.cfg -patch -mode deploy`,see:[1,6,'AutoUpgrade patching mode']}
]},

{h:'Upgrade planning'},
{acc:[
{t:'Upgrade paths',s:'Where you can go directly.',
 a:'Supported paths are listed for each release. From 19c you can upgrade **directly to 26ai**, with no intermediate release. A path is only supported from a minimum patch level and platform, so check the matrix before you plan.',
 w:'A direct path saves a project. Check source patch level, platform and options.',
 c:`SELECT version_full FROM v$instance;
SELECT * FROM v$database;`,see:[2,0,'Supported upgrade paths: 19c directly to 26ai']},
{t:'Desupported and deprecated features',s:'What will not come with you.',
 a:'Each release removes features. For 26ai the important ones for many sites are the **non-CDB architecture** (databases must be multitenant), the **GIMR** in Grid Infrastructure and **policy-managed** RAC databases. Check what you use against the list before committing to a date.',
 w:'A desupported feature is a project in its own right, so find it early.',
 c:`SELECT cdb FROM v$database;
SELECT name, detected_usages FROM dba_feature_usage_statistics WHERE detected_usages > 0 FETCH FIRST 20 ROWS ONLY;`,see:[2,1,'Desupported and deprecated features checklist']},
{t:'Pre-upgrade analysis',s:'Find the issues before the window.',
 a:'The **AutoUpgrade analyze** mode checks the database against the target release and lists problems with a severity and, where possible, a **fixup** to correct them. Run it early and repeat it, since findings change as the database does.',
 w:'It turns unknown risks into a list you can work through.',
 c:`$ java -jar autoupgrade.jar -config upg.cfg -mode analyze`,see:[2,2,'Pre-upgrade analysis with AutoUpgrade']},
{t:'COMPATIBLE, time zone and character set',s:'Settings that are hard to undo.',
 a:'`COMPATIBLE` should be raised only after the upgrade is accepted, because raising it prevents a downgrade. **Time zone file** versions affect TIMESTAMP WITH TIME ZONE data and need an update step. The **character set** is a deeper decision and a change is a project.',
 w:'Raising COMPATIBLE too early removes your fallback.',
 c:`SHOW PARAMETER compatible
SELECT version FROM v$timezone_file;
SELECT value FROM nls_database_parameters WHERE parameter = 'NLS_CHARACTERSET';`,see:[2,3,'COMPATIBLE, time zone and character set planning']},
{t:'Fallback options',s:'How to go back.',
 a:'Before an upgrade you create a **guaranteed restore point** (Flashback Database), take a **backup**, and know the **downgrade** procedure. Each has a different point of no return: after COMPATIBLE is raised or the data changes, flashback is lost without data loss.',
 w:'Decide in advance by when a rollback is still a rollback, and not a restore from backup.',
 c:`CREATE RESTORE POINT before_upgrade GUARANTEE FLASHBACK DATABASE;
SELECT name, scn, time FROM v$restore_point;`,see:[2,4,'Fallback options: restore points, backup and downgrade']},
{t:'Testing the upgrade',s:'Real workload, real plans.',
 a:'**Real Application Testing** replays a captured workload on the upgraded copy, and **SQL Performance Analyzer** compares SQL performance before and after. Together they find regressions before production does.',
 w:'The commonest upgrade problem is a plan that changed. Find it in test.',
 c:`SELECT task_name, status FROM dba_advisor_tasks WHERE advisor_name = 'SQL Performance Analyzer';`,see:[2,5,'Testing with Real Application Testing and SQL Performance Analyzer']}
]},

{h:'Performing an upgrade'},
{acc:[
{t:'AutoUpgrade',s:'The supported way.',
 a:'**AutoUpgrade** is a Java tool driven by a configuration file. It performs analysis, fixes, upgrade and post-upgrade steps, with logging and restore points, for many databases at once. It is Oracle\'s recommended method for upgrades.',
 w:'It encodes the checks and the order of steps, which reduces human error.',
 c:`$ cat upg.cfg
global.autoupg_log_dir=/u01/autoupgrade/logs
upg1.source_home=/u01/app/oracle/product/19.0.0/dbhome_1
upg1.target_home=/u01/app/oracle/product/26.0.0/dbhome_1
upg1.sid=ORCL`,see:[3,0,'AutoUpgrade architecture and configuration files']},
{t:'AutoUpgrade modes',s:'Analyze, fixups, deploy.',
 a:'**analyze** only reports. **fixups** applies the automatic fixes. **deploy** runs the whole process: pre-checks, fixups, restore point, upgrade, post-upgrade fixups and checks. **upgrade** runs the upgrade steps only. Each can be restarted if it stops.',
 w:'Run analyze early and often, and deploy in the window.',
 c:`$ java -jar autoupgrade.jar -config upg.cfg -mode deploy
> lsj
> status -job 100`,see:[3,1,'Modes: analyze, fixups, deploy and upgrade']},
{t:'Upgrading a CDB and its PDBs',s:'Root first, then the PDBs.',
 a:'In a multitenant database the **root** and the **seed** are upgraded, and then each **PDB**, in parallel if wanted. PDBs can also be upgraded separately by unplugging them and plugging them into an already-upgraded CDB.',
 w:'It lets you upgrade PDBs one at a time, or move them to a new CDB.',
 c:`SELECT con_id, name, open_mode FROM v$pdbs;`,see:[3,2,'Upgrading a CDB and its PDBs']},
{t:'Converting a non-CDB to a PDB',s:'The step to multitenant.',
 a:'A **non-CDB** is plugged into a CDB as a **PDB**. AutoUpgrade can do the upgrade and the conversion together, and it runs the conversion script to turn the plugged-in database into a proper PDB. After this, the database is managed as a PDB.',
 w:'It is a required step on the path to a release without non-CDB support.',
 c:`SELECT cdb FROM v$database;`,see:[3,3,'Converting a non-CDB to a PDB during upgrade']},
{t:'Post-upgrade tasks',s:'The upgrade is not the end.',
 a:'After the upgrade you gather statistics, update the time zone file if needed, check invalid objects, review the changed parameters, take a new backup, and only then raise `COMPATIBLE`. You also keep the restore point until you accept the result, then drop it.',
 w:'A forgotten restore point fills the FRA, and a premature COMPATIBLE change removes the fallback.',
 c:`SELECT COUNT(*) FROM dba_objects WHERE status = 'INVALID';
SELECT name FROM v$restore_point;`,see:[3,5,'Post-upgrade tasks and validation']},
{t:'Downgrade and rollback',s:'Only before the point of no return.',
 a:'You can **flash back** to the restore point if COMPATIBLE is unchanged, or **downgrade** with the supported procedure if it is allowed for the path. After that, only a restore from backup works.',
 w:'Know this boundary and write it into the plan. It is the answer to "can we go back".',
 c:`$ java -jar autoupgrade.jar -config upg.cfg -restore -jobs 100`,see:[3,6,'Downgrade and rollback']}
]},

{h:'Migration and lifecycle'},
{acc:[
{t:'Choosing a method',s:'Downtime, size and platform decide.',
 a:'The method follows from three questions: how much downtime is allowed, how big is the data, and does the platform or the endianness change. In-place upgrade, Data Pump, transportable tablespaces, RMAN cross-platform, Data Guard and GoldenGate each fit a different answer.',
 w:'There is rarely a best method, only one that fits your constraints.',
 c:`SELECT platform_name, endian_format FROM v$transportable_platform WHERE platform_name = (SELECT platform_name FROM v$database);`,see:[4,0,'Choosing a migration method: downtime, size and platform']},
{t:'Data Pump',s:'Logical export and import.',
 a:'**Data Pump** exports objects and data to dump files and imports them into another database, across versions and platforms. It is simple and flexible and takes time proportional to the data size. It is a good fit for smaller databases or for selected schemas.',
 w:'It needs downtime for the export-import window, unless combined with GoldenGate for the changes.',
 c:`$ expdp system schemas=hr directory=dp_dir dumpfile=hr.dmp logfile=hr_exp.log parallel=4`,see:[4,1,'Data Pump migrations']},
{t:'Transportable tablespaces',s:'Move the files, export the metadata.',
 a:'With **transportable tablespaces** (and **full transportable export/import**) the datafiles are copied, and only the metadata is exported and imported. It is much faster for large data than Data Pump, and can combine with incremental backups to reduce downtime.',
 w:'It suits large databases where Data Pump would take too long.',
 c:`$ expdp system full=y transportable=always directory=dp_dir dumpfile=full_tts.dmp`,see:[4,2,'Transportable tablespaces and full transportable export/import']},
{t:'Cross-platform migration with RMAN',s:'Change endianness with incrementals.',
 a:'**RMAN cross-platform** transport converts datafiles between platforms and applies incremental backups, so the final outage is only the last increment and the metadata move. It is the standard way to move across endianness with a short outage.',
 w:'The downtime is minutes to hours, not days, and the process is rehearsable.',
 c:`RMAN> BACKUP FOR TRANSPORT ALLOW INCONSISTENT INCREMENTAL LEVEL 0 TABLESPACE users FORMAT '/stage/users_%U';`,see:[4,3,'Cross-platform and cross-endian migration with RMAN']},
{t:'Migrating with Data Guard',s:'Use a standby as the move.',
 a:'You build a standby on the target (same platform and version family), keep it synchronised, then switch over. A **rolling upgrade** with a transient logical standby, or `DBMS_ROLLING`, upgrades with very short downtime.',
 w:'It is the least disruptive method when the platform is unchanged.',
 c:`DGMGRL> VALIDATE DATABASE stby;
DGMGRL> SWITCHOVER TO stby;`,see:[4,4,'Migrating with Data Guard']},
{t:'Zero Downtime Migration',s:'Automated, to the cloud.',
 a:'**Zero Downtime Migration (ZDM)** orchestrates a migration to Oracle cloud targets using backups and Data Guard, or Data Pump and GoldenGate, with checks and a defined sequence. It handles the repeated, standard cases.',
 w:'Use it to move many databases to the same kind of target without hand-building each plan.',
 c:`$ zdmcli migrate database -rsp migrate.rsp -sourcenode srchost`,see:[4,6,'Oracle Zero Downtime Migration to cloud']},
{t:'Fleet patching and compliance',s:'Many databases, one process.',
 a:'**Fleet Patching and Provisioning** (or Ansible and scripts) deploy gold images across many hosts, track which database is on which patch level, and report on compliance. Coordination covers RAC rolling, Data Guard standby-first and GoldenGate processes.',
 w:'At scale the question changes from "how to patch" to "which databases are behind and why".',
 c:`SELECT patch_id, status FROM dba_registry_sqlpatch WHERE patch_id = &required_patch;`,see:[5,1,'Fleet Patching and Provisioning concepts']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Five small maps of how the parts fit together: what a patch changes, the AutoUpgrade modes, choosing a method, out-of-place patching and the patch lifecycle.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why a DBA cares, one query or command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. What a patch changes'},
{map:{title:'Patch anatomy map',h:328,trace:'Apply a Release Update',
 hint:'Tap any box, or press Apply a Release Update to see which part of the system each step changes.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'readme',x:21,y:24,w:194,h:56,c:'ext',t:'README',s:'instructions',d:'The patch README states prerequisites, steps, rolling support and rollback.',why:'It is the contract for the patch.',chk:`$ less README.txt`,see:[0,4,'Finding and reading patch READMEs on My Oracle Support']},
 {id:'prereq',x:243,y:24,w:194,h:56,c:'mem',t:'Prerequisites',s:'OPatch, conflicts',d:'Check the OPatch version, space and conflicts with installed patches.',why:'Most failures are caught here.',chk:`$ opatch prereq CheckConflictAgainstOHWithDetail -ph ./36000000`,see:[1,1,'Pre-checks and conflict detection']},
 {id:'stop',x:465,y:24,w:194,h:56,c:'warn',t:'Stop services',s:'database, listener',d:'Stop the instances and listeners that use the home.',why:'In-place patching needs the home to be unused.',chk:`$ srvctl stop database -db orcl
$ lsnrctl stop`,see:[1,2,'Applying a Release Update in-place']},
 {id:'opatch',x:21,y:136,w:194,h:56,c:'proc',t:'OPatch apply',s:'binaries',d:'OPatch copies the new binaries into the Oracle home and updates the inventory.',why:'It changes files on disk, not the database.',chk:`$ cd 36000000
$ opatch apply`,see:[1,0,'Oracle home inventory and OPatch basics']},
 {id:'start',x:243,y:136,w:194,h:56,c:'proc',t:'Start',s:'on the new binaries',d:'Start the instance from the patched home.',why:'The instance now runs the new code, with the old dictionary.',chk:`SQL> STARTUP`,see:[1,2,'Applying a Release Update in-place']},
 {id:'dp',x:465,y:136,w:194,h:56,c:'proc',t:'datapatch',s:'SQL changes',d:'Apply the SQL side of the patch to the database, from the patched home.',why:'It finishes the patch inside the database.',chk:`$ $ORACLE_HOME/OPatch/datapatch -verbose`,see:[1,3,'Running datapatch and verifying SQL patches']},
 {id:'reg',x:126,y:248,w:200,h:56,c:'disk',t:'Registry',s:'DBA_REGISTRY_SQLPATCH',d:'The database records every SQL patch with its action and status.',why:'This is how you prove a database is patched.',chk:`SELECT patch_id, action, status, action_time FROM dba_registry_sqlpatch ORDER BY action_time DESC;`,see:[1,3,'Running datapatch and verifying SQL patches']},
 {id:'inv',x:354,y:248,w:200,h:56,c:'disk',t:'Inventory',s:'lspatches',d:'The Oracle inventory records which patches are in the home.',why:'It must match the registry.',chk:`$ opatch lspatches`,see:[1,0,'Oracle home inventory and OPatch basics']}],
 steps:[
 {ids:['readme','prereq'],t:'1. Read the README and run the prerequisite and conflict checks. Update OPatch if it is too old.',w:'You find a problem before changing anything.',s:'OPatch version, MOS notes.',x:'Skipping the README misses a required one-off or a post-step.',c:`$ opatch version
$ opatch prereq CheckConflictAgainstOHWithDetail -ph ./36000000`},
 {ids:['stop'],t:'2. Stop the database and listeners that use the home, and take backups of the home and the database.',w:'The files must not be in use, and you need a way back.',s:'Maintenance window, backups.',x:'A forgotten process (listener, agent) still using the home breaks the patch.',c:`$ ps -ef | grep -E 'pmon|tnslsnr'`},
 {ids:['opatch','inv'],t:'3. OPatch applies the binary changes and records the patch in the inventory.',w:'The home is now patched.',s:'`opatch apply`, `-silent`.',x:'A failed apply leaves a partly patched home, and the log says where.',c:`$ opatch lspatches`},
 {ids:['start','dp'],t:'4. Start the database from the home and run datapatch, which applies the SQL changes inside the database.',w:'The database content is brought in step with the binaries.',s:'`datapatch -verbose`.',x:'For a CDB, run datapatch so it covers all open PDBs.',c:`$ datapatch -verbose`},
 {ids:['reg'],t:'5. Check the registry shows the patch as successful, and the inventory agrees.',w:'It is the evidence for the change record.',s:'`DBA_REGISTRY_SQLPATCH`, `lspatches`.',x:'A PDB opened later still needs datapatch.',c:`SELECT con_id, patch_id, status FROM cdb_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 10 ROWS ONLY;`}]}},

{h:'2. AutoUpgrade and its modes'},
{map:{title:'AutoUpgrade map',h:328,trace:'Run an upgrade',
 hint:'Tap any box, or press Run an upgrade to see what AutoUpgrade does at each stage.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'cfg',x:21,y:24,w:194,h:56,c:'ext',t:'Config file',s:'what to upgrade',d:'A text file with the source home, target home, SID and options for each database.',why:'It is what makes an upgrade repeatable and reviewable.',chk:`$ cat upg.cfg`,see:[3,0,'AutoUpgrade architecture and configuration files']},
 {id:'an',x:243,y:24,w:194,h:56,c:'mem',t:'analyze',s:'report only',d:'Checks the database against the target release and writes a report. It changes nothing.',why:'Run it early and often.',chk:`$ java -jar autoupgrade.jar -config upg.cfg -mode analyze`,see:[3,1,'Modes: analyze, fixups, deploy and upgrade']},
 {id:'fix',x:465,y:24,w:194,h:56,c:'proc',t:'fixups',s:'pre-upgrade fixes',d:'Applies the automatic fixes found by analysis, such as statistics and parameters.',why:'It reduces the work in the window.',chk:`$ java -jar autoupgrade.jar -config upg.cfg -mode fixups`,see:[3,1,'Modes: analyze, fixups, deploy and upgrade']},
 {id:'dep',x:21,y:136,w:194,h:56,c:'proc',t:'deploy',s:'the whole job',d:'Runs all stages: analysis, fixups, restore point, upgrade, post-fixups.',why:'Use this in the window.',chk:`$ java -jar autoupgrade.jar -config upg.cfg -mode deploy`,see:[3,1,'Modes: analyze, fixups, deploy and upgrade']},
 {id:'rp',x:243,y:136,w:194,h:56,c:'disk',t:'Restore point',s:'fallback',d:'A guaranteed restore point is created before the upgrade begins.',why:'It is your way back, until you raise COMPATIBLE.',chk:`SELECT name, scn, guarantee_flashback_database FROM v$restore_point;`,see:[2,4,'Fallback options: restore points, backup and downgrade']},
 {id:'up',x:465,y:136,w:194,h:56,c:'proc',t:'Upgrade',s:'catupgrd',d:'The database is started in upgrade mode on the new home and the dictionary is upgraded.',why:'The longest step, and the outage.',chk:`SELECT version FROM v$instance;`,see:[3,2,'Upgrading a CDB and its PDBs']},
 {id:'post',x:126,y:248,w:200,h:56,c:'proc',t:'Post-upgrade',s:'fixups and checks',d:'Post-fixups, time zone, recompilation of objects and a final health check.',why:'It completes the upgrade, and leaves a report.',chk:`SELECT COUNT(*) FROM dba_objects WHERE status = 'INVALID';`,see:[3,5,'Post-upgrade tasks and validation']},
 {id:'log',x:354,y:248,w:200,h:56,c:'disk',t:'Logs and status',s:'one place',d:'Job logs and a status console, with a restart option for a failed job.',why:'You can resume instead of starting again.',chk:`$ java -jar autoupgrade.jar -config upg.cfg -mode deploy
upg> status -job 100`,see:[3,1,'Modes: analyze, fixups, deploy and upgrade']}],
 steps:[
 {ids:['cfg','an'],t:'1. Write the configuration and run analyze. Read the report and work through the findings.',w:'It is the first and cheapest step.',s:'`source_home`, `target_home`, `sid`.',x:'Running analyze on a copy that differs from production.',c:`$ java -jar autoupgrade.jar -config upg.cfg -mode analyze`},
 {ids:['fix'],t:'2. Apply the automatic fixes before the window and repeat the analysis until it is clean.',w:'The window is then only the upgrade itself.',s:'`-mode fixups`.',x:'Fixes that need your decision are left for you.',c:`$ java -jar autoupgrade.jar -config upg.cfg -mode fixups`},
 {ids:['dep','rp'],t:'3. In the window run deploy. AutoUpgrade creates the restore point and begins.',w:'You are protected from this moment.',s:'Restore point settings.',x:'A small FRA fills during the upgrade.',c:`SELECT * FROM v$recovery_file_dest;`},
 {ids:['up'],t:'4. It upgrades the database on the new home, root and PDBs, in parallel where it can.',w:'This is the downtime.',s:'Parallelism, `catctl` options.',x:'A failure leaves a restartable state, and the log says which step.',c:`upg> status -job 100`},
 {ids:['post','log'],t:'5. Post-upgrade fixups and checks run, and the results are in the logs. You validate the application.',w:'The job ends with evidence.',s:'Post-fixups, time zone upgrade.',x:'Raising COMPATIBLE too soon removes the fallback.',c:`SELECT comp_name, status, version FROM dba_registry;`}]}},

{h:'3. Choosing an upgrade or migration method'},
{map:{title:'Method choice map',h:328,trace:'Choose by downtime',
 hint:'Tap any box, or press Choose by downtime to see which method fits each set of constraints.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134','M562 80 L562 107 L340 107 L340 134',[562,80,562,134],'M340 80 L340 163 L118 163 L118 246','M562 80 L562 163 L340 163 L340 246',[437,276,463,276]],
 nodes:[
 {id:'need',x:21,y:24,w:194,h:56,c:'ext',t:'Requirement',s:'downtime, size',d:'The business limit on downtime, the data volume and the target.',why:'It is the input to every decision here.',chk:`SELECT ROUND(SUM(bytes)/1024/1024/1024) AS gb FROM dba_data_files;`,see:[4,0,'Choosing a migration method: downtime, size and platform']},
 {id:'same',x:243,y:24,w:194,h:56,c:'mem',t:'Same platform?',s:'endianness',d:'Is the target platform and endian format the same as the source?',why:'It decides whether files can be used directly.',chk:`SELECT platform_name, endian_format FROM v$transportable_platform WHERE platform_name = (SELECT platform_name FROM v$database);`,see:[4,3,'Cross-platform and cross-endian migration with RMAN']},
 {id:'chg',x:465,y:24,w:194,h:56,c:'mem',t:'Change anything else?',s:'version, architecture',d:'Are you also changing version, character set, architecture (non-CDB to PDB)?',why:'More change means a logical method.',chk:`SELECT cdb, version FROM v$database, v$instance;`,see:[4,0,'Choosing a migration method: downtime, size and platform']},
 {id:'inpl',x:21,y:136,w:194,h:56,c:'proc',t:'In-place AutoUpgrade',s:'same host',d:'Upgrade the database on the same server with the new home.',why:'The simplest, with an outage of the upgrade time.',chk:`$ java -jar autoupgrade.jar -config upg.cfg -mode deploy`,see:[3,0,'AutoUpgrade architecture and configuration files']},
 {id:'dg',x:243,y:136,w:194,h:56,c:'proc',t:'Data Guard rolling',s:'switchover',d:'Build a standby and switch over, or use a rolling upgrade.',why:'Downtime is a switchover, if the platform is the same.',chk:`DGMGRL> SWITCHOVER TO stby;`,see:[4,4,'Migrating with Data Guard']},
 {id:'tts',x:465,y:136,w:194,h:56,c:'proc',t:'Transportable',s:'copy files, move metadata',d:'Copy the datafiles and move metadata, with incremental backups.',why:'Fast for large data across versions.',chk:`$ expdp system full=y transportable=always`,see:[4,2,'Transportable tablespaces and full transportable export/import']},
 {id:'rman',x:21,y:248,w:194,h:56,c:'proc',t:'RMAN cross-platform',s:'endian conversion',d:'Convert and roll forward datafiles with incrementals, for a different platform.',why:'The way to cross endian boundaries with a short outage.',chk:`RMAN> BACKUP FOR TRANSPORT INCREMENTAL LEVEL 1 ...`,see:[4,3,'Cross-platform and cross-endian migration with RMAN']},
 {id:'dp',x:243,y:248,w:194,h:56,c:'proc',t:'Data Pump',s:'logical',d:'Export and import the data. Flexible and simple, and slow for large data.',why:'Good for schemas and smaller databases.',chk:`$ expdp system schemas=hr directory=dp_dir dumpfile=hr.dmp`,see:[4,1,'Data Pump migrations']},
 {id:'gg',x:465,y:248,w:194,h:56,c:'proc',t:'GoldenGate',s:'replicate changes',d:'Load the target and replicate changes until cutover.',why:'Minutes of downtime, with a fallback.',chk:`OGG> START REPLICAT rep1`,see:[4,5,'Zero-downtime migration with GoldenGate (pointer)']}],
 steps:[
 {ids:['need','same'],t:'1. Start with the constraints: how much downtime, how much data, and whether the platform changes.',w:'They eliminate most methods immediately.',s:'Business requirements.',x:'Choosing a tool first and the requirement later.',c:`SELECT ROUND(SUM(bytes)/1024/1024/1024) FROM dba_data_files;`},
 {ids:['chg','inpl'],t:'2. If only the release changes on the same platform and a normal outage is acceptable, upgrade in place with AutoUpgrade.',w:'It is the simplest and the best tested.',s:'Maintenance window.',x:'An in-place upgrade has no second copy to fall back to except the restore point.',c:`$ java -jar autoupgrade.jar -config upg.cfg -mode analyze`},
 {ids:['dg'],t:'3. If the outage must be short and the platform is the same, build a standby and switch over.',w:'The work is done in advance on the copy.',s:'Data Guard setup, rolling upgrade.',x:'Mixed versions need a rolling method, not a plain standby.',c:`DGMGRL> VALIDATE DATABASE stby;`},
 {ids:['tts','rman'],t:'4. For large data or a different platform use transportable methods, or RMAN cross-platform with incrementals.',w:'Files are copied, and the final step is small.',s:'Incremental backups, transport sets.',x:'Unsupported data types or objects in the transport set.',c:`SELECT * FROM v$transportable_platform;`},
 {ids:['dp','gg'],t:'5. For logical changes use Data Pump, and for near-zero downtime add GoldenGate to carry the changes.',w:'Logical methods allow any change at the cost of complexity.',s:'Data Pump parallelism, GoldenGate.',x:'Data Pump needs the data to be quiet for the export, unless GoldenGate bridges it.',c:`$ expdp system full=y`}]}},

{h:'4. Out-of-place patching'},
{map:{title:'Out-of-place patch map',h:216,trace:'Patch with a new home',
 hint:'Tap any box, or press Patch with a new home to see how a database moves between Oracle homes.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'gold',x:21,y:24,w:194,h:56,c:'disk',t:'Gold image',s:'patched and tested',d:'A zip of an Oracle home with the chosen patches applied and tested.',why:'It is built once and used on many servers.',chk:`$ ls -l /images/db_19_24.zip`,see:[5,0,'Gold images and standardized Oracle homes']},
 {id:'new',x:243,y:24,w:194,h:56,c:'proc',t:'New home',s:'unzip and relink',d:'Unzip the image to a new directory and run the setup to register it.',why:'The old home keeps running during this.',chk:`$ unzip /images/db_19_24.zip -d /u01/app/oracle/product/19.24/dbhome_1
$ ./runInstaller -silent -responseFile db.rsp`,see:[1,4,'Out-of-place patching with gold images']},
 {id:'run',x:465,y:24,w:194,h:56,c:'mem',t:'Pre-checks',s:'new home',d:'Run checks against the new home, and test an application in a copy if possible.',why:'It is done with no downtime.',chk:`$ $NEW_HOME/OPatch/opatch lspatches`,see:[1,1,'Pre-checks and conflict detection']},
 {id:'sw',x:21,y:136,w:194,h:56,c:'warn',t:'Switch',s:'stop, start on new home',d:'Stop the database on the old home and start it on the new home (srvctl modify, or oratab).',why:'This is the only outage.',chk:`$ srvctl stop database -db orcl
$ srvctl modify database -db orcl -oraclehome /u01/app/oracle/product/19.24/dbhome_1
$ srvctl start database -db orcl`,see:[1,4,'Out-of-place patching with gold images']},
 {id:'old',x:243,y:136,w:194,h:56,c:'disk',t:'Old home',s:'kept',d:'The old home is left untouched for a while.',why:'It is the rollback path.',chk:`$ ls -d /u01/app/oracle/product/*`,see:[1,5,'Rollback and troubleshooting failed patches']},
 {id:'back',x:465,y:136,w:194,h:56,c:'proc',t:'Rollback',s:'switch back',d:'If there is a problem, move the database back to the old home.',why:'It is minutes, not hours.',chk:`$ srvctl modify database -db orcl -oraclehome /u01/app/oracle/product/19.23/dbhome_1`,see:[1,5,'Rollback and troubleshooting failed patches']}],
 steps:[
 {ids:['gold','new'],t:'1. Build the gold image once and unzip it to a new home on each server. No downtime so far.',w:'The software is prepared in advance.',s:'`createGoldImage`, `runInstaller`.',x:'A home with different options than the old one causes surprises.',c:`$ unzip /images/db_19_24.zip -d /u01/app/oracle/product/19.24/dbhome_1`},
 {ids:['run'],t:'2. Check the new home and test the application where you can, using a copy.',w:'It reduces risk before the window.',s:'Test environment.',x:'Skipping this moves the risk into the window.',c:`$ $NEW_HOME/OPatch/opatch lspatches`},
 {ids:['sw'],t:'3. In the window stop the database, point it to the new home and start it. Then run datapatch.',w:'The outage is a restart.',s:'`srvctl modify database`, `datapatch`.',x:'Forgetting to update oratab and scripts.',c:`$ datapatch -verbose`},
 {ids:['old'],t:'4. Keep the old home during the observation period.',w:'It is the quick way back.',s:'Disk space, retention policy.',x:'Removing the old home too early removes the rollback.',c:`$ du -sh /u01/app/oracle/product/*`},
 {ids:['back'],t:'5. If something is wrong, switch back to the old home (and roll back datapatch if the SQL changes need it).',w:'The decision is quick.',s:'`srvctl modify`, `datapatch -rollback`.',x:'A SQL patch applied to the database may need a rollback step, so check the README.',c:`SELECT patch_id, action, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 3 ROWS ONLY;`}]}},

{h:'5. A patching cycle across environments'},
{map:{title:'Patch lifecycle map',h:328,trace:'Follow a quarterly cycle',
 hint:'Tap any box, or press Follow a quarterly cycle to see one patch move from release to production.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'rel',x:21,y:24,w:194,h:56,c:'ext',t:'Release',s:'new RU published',d:'A new Release Update or security patch is published.',why:'The clock for your exposure starts.',chk:`SELECT version_full FROM v$instance;`,see:[0,2,'Monthly CSPUs and the quarterly CPU cycle (2026 change)']},
 {id:'eval',x:243,y:24,w:194,h:56,c:'mem',t:'Evaluate',s:'read the notes',d:'Read the release notes and known issues, and decide scope and urgency.',why:'A critical vulnerability changes the schedule.',chk:`SELECT patch_id FROM dba_registry_sqlpatch WHERE status = 'SUCCESS' ORDER BY action_time DESC FETCH FIRST 1 ROW ONLY;`,see:[0,4,'Finding and reading patch READMEs on My Oracle Support']},
 {id:'dev',x:465,y:24,w:194,h:56,c:'proc',t:'Development',s:'first',d:'Apply to a development or a sandbox environment.',why:'It finds installation problems early.',chk:`$ opatch lspatches`,see:[0,5,'A patch strategy: cadence, environments and risk']},
 {id:'test',x:21,y:136,w:194,h:56,c:'proc',t:'Test',s:'with workload',d:'Apply to a test system and run the regression and performance tests.',why:'It finds functional and plan regressions.',chk:`SELECT task_name, status FROM dba_advisor_tasks WHERE advisor_name = 'SQL Performance Analyzer';`,see:[6,1,'Testing, validation and performance comparison']},
 {id:'pre',x:243,y:136,w:194,h:56,c:'proc',t:'Pre-production',s:'rehearse',d:'Rehearse the production procedure, with timing.',why:'It confirms the window and the rollback.',chk:`$ srvctl status database -d orcl -v`,see:[6,0,'Runbook: patch, upgrade and convert end to end']},
 {id:'prod',x:465,y:136,w:194,h:56,c:'warn',t:'Production',s:'the change window',d:'Apply to production, using the rehearsed runbook, out of place where possible.',why:'By now it is a routine.',chk:`$ datapatch -verbose`,see:[6,2,'Communication, change records and rollback decisions']},
 {id:'cmp',x:126,y:248,w:200,h:56,c:'mem',t:'Compliance',s:'who is behind',d:'Check the whole estate against the target patch level.',why:'It shows the databases that were missed.',chk:`SELECT patch_id, status FROM dba_registry_sqlpatch WHERE patch_id = &required_patch;`,see:[5,3,'Patch compliance and inventory reporting']},
 {id:'rep',x:354,y:248,w:200,h:56,c:'ext',t:'Report',s:'to the owners',d:'Report patch levels and exceptions to the owners and auditors.',why:'It closes the loop and records exceptions.',chk:`SELECT host_name, version_full FROM v$instance;`,see:[5,3,'Patch compliance and inventory reporting']}],
 steps:[
 {ids:['rel','eval'],t:'1. A patch is published. Read the notes, decide scope, and set a target date against your policy.',w:'The time to a decision is part of your exposure.',s:'Patch policy, severity.',x:'No owner for reading the release notes means nobody does.',c:`SELECT version_full FROM v$instance;`},
 {ids:['dev','test'],t:'2. Apply to development and test systems, run regression and performance tests (SPA, workload replay).',w:'Regressions are found where it is cheap.',s:'Test plans, RAT, SPA.',x:'A test system that is not like production misses plan changes.',c:`SELECT sql_id, plan_hash_value FROM v$sql WHERE executions > 100 FETCH FIRST 5 ROWS ONLY;`},
 {ids:['pre'],t:'3. Rehearse in pre-production with the production runbook and measure the time.',w:'The rehearsal gives the window and finds the missing step.',s:'Runbook, timings.',x:'A rehearsal skipped because "it is the same as last quarter".',c:`$ date`},
 {ids:['prod'],t:'4. Apply in production in the window and verify with the registry and the application checks.',w:'It is the same work, done again.',s:'Change record, backups.',x:'A rollback decision made late, under pressure.',c:`SELECT patch_id, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 3 ROWS ONLY;`},
 {ids:['cmp','rep'],t:'5. Check the entire estate for compliance, and report the exceptions with a reason and a date.',w:'You cannot manage what you cannot see.',s:'Inventory, reporting.',x:'Databases outside the inventory are not patched at all.',c:`SELECT COUNT(*) FROM dba_registry_sqlpatch WHERE status = 'SUCCESS';`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Seven small maps of how something happens, step by step: an in-place patch, an out-of-place patch and rollback, an AutoUpgrade run, a non-CDB conversion, an upgrade with Data Guard, a migration and a fallback decision.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. An in-place Release Update'},
{map:{title:'In-place patch map',h:216,trace:'Patch in place',
 hint:'Tap any box, or press Patch in place to follow the steps from backup to a verified database.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'bkp',x:20,y:24,w:139,h:56,c:'disk',t:'Back up',s:'home and database',d:'Back up the Oracle home, the inventory and the database (or create a restore point).',why:'It is the rollback of last resort.',chk:`RMAN> BACKUP DATABASE PLUS ARCHIVELOG;
$ tar czf home_backup.tgz $ORACLE_HOME`,see:[1,2,'Applying a Release Update in-place']},
 {id:'chk',x:187,y:24,w:139,h:56,c:'mem',t:'Prechecks',s:'OPatch, conflicts',d:'Update OPatch, check space and conflicts.',why:'Failures here cost nothing.',chk:`$ opatch prereq CheckConflictAgainstOHWithDetail -ph ./36000000`,see:[1,1,'Pre-checks and conflict detection']},
 {id:'stop',x:354,y:24,w:139,h:56,c:'warn',t:'Stop',s:'database and listener',d:'Stop all processes that use the home.',why:'The outage begins.',chk:`$ srvctl stop database -db orcl
$ lsnrctl stop`,see:[1,2,'Applying a Release Update in-place']},
 {id:'apply',x:521,y:24,w:139,h:56,c:'proc',t:'Apply',s:'opatch apply',d:'Apply the patch to the home.',why:'The binaries change.',chk:`$ opatch apply`,see:[1,2,'Applying a Release Update in-place']},
 {id:'start',x:21,y:136,w:194,h:56,c:'proc',t:'Start',s:'database',d:'Start the database and listener from the patched home.',why:'The outage ends when users can connect.',chk:`$ srvctl start database -db orcl`,see:[1,2,'Applying a Release Update in-place']},
 {id:'dp',x:243,y:136,w:194,h:56,c:'proc',t:'datapatch',s:'SQL changes',d:'Apply the SQL changes to the database.',why:'It can run with the database open.',chk:`$ datapatch -verbose`,see:[1,3,'Running datapatch and verifying SQL patches']},
 {id:'ver',x:465,y:136,w:194,h:56,c:'mem',t:'Verify',s:'registry, objects',d:'Check the registry, invalid objects and the application.',why:'It is the proof that the work is complete.',chk:`SELECT COUNT(*) FROM dba_objects WHERE status = 'INVALID';`,see:[1,3,'Running datapatch and verifying SQL patches']}],
 steps:[
 {ids:['bkp','chk'],t:'1. Back up the home and the database, update OPatch and run the prerequisite and conflict checks.',w:'The rollback exists before the change.',s:'RMAN, tar, `opatch prereq`.',x:'A backup you did not check.',c:`RMAN> LIST BACKUP SUMMARY;`},
 {ids:['stop'],t:'2. Stop the database, listeners and any agent using the home. Confirm nothing is running from it.',w:'Files in use cannot be replaced safely.',s:'`srvctl stop`, `fuser`.',x:'A process left running makes OPatch fail midway.',c:`$ fuser $ORACLE_HOME/bin/oracle`},
 {ids:['apply'],t:'3. Apply the patch with OPatch and read the log to the end.',w:'The log is the record of what changed.',s:'OPatch log directory.',x:'A failure partway leaves a partially patched home. Follow the README for recovery.',c:`$ opatch apply`},
 {ids:['start','dp'],t:'4. Start the database from the patched home and run datapatch.',w:'The binaries and the dictionary agree again.',s:'`datapatch -verbose`.',x:'In a CDB all PDBs must be open to be patched.',c:`$ datapatch -verbose`},
 {ids:['ver'],t:'5. Verify the registry, recompile invalid objects, run application checks and keep the logs with the change record.',w:'You can show that it was done.',s:'`utlrp.sql`.',x:'Closing the change without checking the PDBs.',c:`SELECT con_id, patch_id, status FROM cdb_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 5 ROWS ONLY;`}]}},

{h:'2. Out-of-place patching and rollback'},
{map:{title:'Out-of-place and rollback map',h:216,trace:'Patch out of place, then roll back',
 hint:'Tap any box, or press Patch out of place, then roll back to follow a switch to a new home and a return.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'img',x:21,y:24,w:194,h:56,c:'disk',t:'Gold image',s:'build or get',d:'Build a patched home once and save it, or take the image from the repository.',why:'It is the same bits for every server.',chk:`$ runInstaller -createGoldImage -destinationLocation /images`,see:[5,0,'Gold images and standardized Oracle homes']},
 {id:'home',x:243,y:24,w:194,h:56,c:'proc',t:'Install new home',s:'alongside the old',d:'Unzip and register the new home while the database runs from the old one.',why:'There is no downtime in this step.',chk:`$ unzip db_19_24.zip -d $NEW_HOME && $NEW_HOME/runInstaller -silent -responseFile db.rsp`,see:[1,4,'Out-of-place patching with gold images']},
 {id:'chk',x:465,y:24,w:194,h:56,c:'mem',t:'Check',s:'new home',d:'Run checks and test connectivity and tools from the new home.',why:'You find problems with the database still up.',chk:`$ $NEW_HOME/OPatch/opatch lspatches`,see:[1,1,'Pre-checks and conflict detection']},
 {id:'sw',x:20,y:136,w:139,h:56,c:'warn',t:'Switch',s:'to new home',d:'Stop on the old home, change the home in the clusterware or oratab and start on the new one.',why:'The outage is a restart.',chk:`$ srvctl modify database -db orcl -oraclehome $NEW_HOME`,see:[1,4,'Out-of-place patching with gold images']},
 {id:'dpx',x:187,y:136,w:139,h:56,c:'proc',t:'datapatch',s:'SQL changes',d:'Run datapatch from the new home.',why:'It brings the dictionary level with the binaries.',chk:`$ $NEW_HOME/OPatch/datapatch -verbose`,see:[1,3,'Running datapatch and verifying SQL patches']},
 {id:'dec',x:354,y:136,w:139,h:56,c:'mem',t:'Go or no-go',s:'observe',d:'Watch the system for the agreed period with the agreed checks.',why:'The decision to keep or revert is made on criteria.',chk:`SELECT event, total_waits FROM v$system_event ORDER BY time_waited_micro DESC FETCH FIRST 5 ROWS ONLY;`,see:[6,2,'Communication, change records and rollback decisions']},
 {id:'back',x:521,y:136,w:139,h:56,c:'warn',t:'Roll back',s:'if needed',d:'Stop, point the database to the old home, start, and roll back the SQL patch if required.',why:'It is a switch, not a restore.',chk:`$ srvctl modify database -db orcl -oraclehome $OLD_HOME
$ datapatch -rollback ...`,see:[1,5,'Rollback and troubleshooting failed patches']}],
 steps:[
 {ids:['img','home'],t:'1. Obtain the gold image and install a new home next to the old one while the database continues to run.',w:'Almost all of the work is outside the window.',s:'`createGoldImage`, `runInstaller`.',x:'A new home missing a required one-off from the old home.',c:`$ opatch lspatches`},
 {ids:['chk','sw'],t:'2. Check the new home, then in the window stop the database and restart it from the new home.',w:'The outage is only the restart.',s:'`srvctl modify database`.',x:'Scripts and monitoring still pointing at the old home.',c:`$ srvctl config database -db orcl | grep -i home`},
 {ids:['dpx'],t:'3. Run datapatch from the new home and verify the registry.',w:'Binaries and dictionary agree.',s:'`datapatch -verbose`.',x:'Skipping datapatch leaves the database half-patched.',c:`SELECT patch_id, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 3 ROWS ONLY;`},
 {ids:['dec'],t:'4. Observe against the agreed criteria: errors, plan changes, performance, job success. Decide to keep or roll back.',w:'A decision made against criteria is calm.',s:'Success criteria, monitoring.',x:'Deciding by feeling after a long night.',c:`SELECT COUNT(*) FROM dba_objects WHERE status = 'INVALID';`},
 {ids:['back'],t:'5. To roll back, switch to the old home and, where required, roll back the SQL patch. Do this early, not late.',w:'The longer you wait the more data depends on the new patch level.',s:'`datapatch -rollback`, README rollback section.',x:'New data written under the patch may need handling.',c:`$ srvctl modify database -db orcl -oraclehome $OLD_HOME`}]}},

{h:'3. Upgrading from 19c to 26ai with AutoUpgrade'},
{map:{title:'Upgrade run map',h:216,trace:'Upgrade a database',
 hint:'Tap any box, or press Upgrade a database to follow an upgrade from planning to post-upgrade validation.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'plan',x:20,y:24,w:139,h:56,c:'ext',t:'Plan',s:'path and window',d:'Confirm the direct path, the target patch level and the window. Read the new release notes.',why:'A plan that starts with the destination.',chk:`SELECT version_full FROM v$instance;`,see:[2,0,'Supported upgrade paths: 19c directly to 26ai']},
 {id:'feat',x:187,y:24,w:139,h:56,c:'mem',t:'Feature check',s:'desupported',d:'Check for non-CDB, GIMR and other desupported features.',why:'Some need a separate project.',chk:`SELECT cdb FROM v$database;`,see:[2,1,'Desupported and deprecated features checklist']},
 {id:'an',x:354,y:24,w:139,h:56,c:'mem',t:'Analyze',s:'report',d:'Run AutoUpgrade in analyze mode on a copy and on production.',why:'Findings are the work list.',chk:`$ java -jar autoupgrade.jar -config upg.cfg -mode analyze`,see:[2,2,'Pre-upgrade analysis with AutoUpgrade']},
 {id:'fix',x:521,y:24,w:139,h:56,c:'proc',t:'Fixups',s:'before the window',d:'Apply the fixes, gather statistics and test the application against an upgraded copy.',why:'It reduces the downtime window.',chk:`$ java -jar autoupgrade.jar -config upg.cfg -mode fixups`,see:[2,5,'Testing with Real Application Testing and SQL Performance Analyzer']},
 {id:'rp',x:20,y:136,w:139,h:56,c:'disk',t:'Restore point',s:'guaranteed',d:'A guaranteed restore point and a verified backup.',why:'The fallback must exist.',chk:`CREATE RESTORE POINT before_upg GUARANTEE FLASHBACK DATABASE;`,see:[2,4,'Fallback options: restore points, backup and downgrade']},
 {id:'up',x:187,y:136,w:139,h:56,c:'proc',t:'Upgrade',s:'deploy',d:'Run deploy. The database is upgraded on the new home.',why:'The outage.',chk:`$ java -jar autoupgrade.jar -config upg.cfg -mode deploy`,see:[3,1,'Modes: analyze, fixups, deploy and upgrade']},
 {id:'post',x:354,y:136,w:139,h:56,c:'mem',t:'Post-upgrade',s:'checks and statistics',d:'Check components, invalid objects, time zone, statistics and parameters.',why:'The upgrade is not complete until validated.',chk:`SELECT comp_name, status, version FROM dba_registry;`,see:[3,5,'Post-upgrade tasks and validation']},
 {id:'comp',x:521,y:136,w:139,h:56,c:'warn',t:'Raise COMPATIBLE',s:'later',d:'After the acceptance period, raise COMPATIBLE and drop the restore point.',why:'This is the point of no return.',chk:`ALTER SYSTEM SET compatible = '26.0.0' SCOPE = SPFILE;`,see:[2,3,'COMPATIBLE, time zone and character set planning']}],
 steps:[
 {ids:['plan','feat'],t:'1. Confirm the path and target release, and check the desupported feature list against your database.',w:'Blocking issues show up here.',s:'Support matrix, feature usage.',x:'A non-CDB source means a conversion step in the plan.',c:`SELECT cdb FROM v$database;`},
 {ids:['an','fix'],t:'2. Analyze, review findings, fix, and repeat until analysis is clean. Test the application on an upgraded copy.',w:'The window then only has the known work.',s:'AutoUpgrade reports, SPA.',x:'A clean analysis does not test the application.',c:`$ java -jar autoupgrade.jar -config upg.cfg -mode analyze`},
 {ids:['rp'],t:'3. Create the guaranteed restore point and confirm a good backup. Agree the rollback criteria.',w:'You know how to go back.',s:'`CREATE RESTORE POINT`, RMAN.',x:'A restore point that fills the FRA stops the database.',c:`SELECT * FROM v$recovery_file_dest;`},
 {ids:['up'],t:'4. Run deploy in the window, and watch the job status. Resume if a step fails after fixing the cause.',w:'The outage runs here.',s:'`-mode deploy`, `status -job`.',x:'Disk space or an invalid object that blocks a stage.',c:`upg> status -job 100`},
 {ids:['post'],t:'5. Validate components, objects, plans and the application. Update statistics and review changed parameters.',w:'It confirms the system is healthy.',s:'Post-upgrade checklist.',x:'Declaring success after only the registry check.',c:`SELECT COUNT(*) FROM dba_objects WHERE status = 'INVALID';`},
 {ids:['comp'],t:'6. After the acceptance period, raise COMPATIBLE, drop the restore point and take a new backup.',w:'It closes the project and the fallback.',s:'`COMPATIBLE`, `DROP RESTORE POINT`.',x:'Raising COMPATIBLE early removes the downgrade path.',c:`DROP RESTORE POINT before_upg;`}]}},

{h:'4. Converting a non-CDB to a PDB'},
{map:{title:'Non-CDB conversion map',h:216,trace:'Convert a non-CDB',
 hint:'Tap any box, or press Convert a non-CDB to follow a standalone database into a container database.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'an',x:20,y:24,w:139,h:56,c:'mem',t:'Analyze',s:'compatibility',d:'Check that the non-CDB can be plugged in, and find issues.',why:'It is a precondition check.',chk:`$ java -jar autoupgrade.jar -config upg.cfg -mode analyze`,see:[3,3,'Converting a non-CDB to a PDB during upgrade']},
 {id:'tgt',x:187,y:24,w:139,h:56,c:'ext',t:'Target CDB',s:'exists and is ready',d:'A target CDB on the new release, with enough space and matching options.',why:'The PDB will live here.',chk:`SELECT cdb, version FROM v$database, v$instance;`,see:[3,2,'Upgrading a CDB and its PDBs']},
 {id:'manif',x:354,y:24,w:139,h:56,c:'disk',t:'Manifest',s:'XML description',d:'The non-CDB is described by an XML manifest, with its files.',why:'It lets the CDB plug the files in.',chk:`EXEC DBMS_PDB.DESCRIBE(pdb_descr_file => '/tmp/noncdb.xml');`,see:[3,3,'Converting a non-CDB to a PDB during upgrade']},
 {id:'plug',x:521,y:24,w:139,h:56,c:'proc',t:'Plug in',s:'CREATE PLUGGABLE DB',d:'Create the PDB from the manifest and the files, copying or moving them.',why:'The database becomes a PDB of the CDB.',chk:`CREATE PLUGGABLE DATABASE pdb1 USING '/tmp/noncdb.xml' COPY FILE_NAME_CONVERT = ('/oradata/orcl/','/oradata/cdb/pdb1/');`,see:[3,3,'Converting a non-CDB to a PDB during upgrade']},
 {id:'conv',x:21,y:136,w:194,h:56,c:'proc',t:'Conversion script',s:'noncdb_to_pdb',d:'Run noncdb_to_pdb.sql inside the PDB to remove the non-CDB specific objects.',why:'It makes it a proper PDB.',chk:`ALTER SESSION SET CONTAINER = pdb1;
@$ORACLE_HOME/rdbms/admin/noncdb_to_pdb.sql`,see:[3,3,'Converting a non-CDB to a PDB during upgrade']},
 {id:'open',x:243,y:136,w:194,h:56,c:'proc',t:'Open and save state',s:'normal mode',d:'Open the PDB and save its state so it opens at startup.',why:'A PDB left closed is a common surprise.',chk:`ALTER PLUGGABLE DATABASE pdb1 OPEN;
ALTER PLUGGABLE DATABASE pdb1 SAVE STATE;`,see:[3,3,'Converting a non-CDB to a PDB during upgrade']},
 {id:'chk',x:465,y:136,w:194,h:56,c:'mem',t:'Check',s:'services and objects',d:'Check services, users, invalid objects and the application connection.',why:'Applications connect to a PDB service now.',chk:`SELECT name, open_mode, restricted FROM v$pdbs;`,see:[3,5,'Post-upgrade tasks and validation']}],
 steps:[
 {ids:['an','tgt'],t:'1. Analyze the non-CDB, and prepare the target CDB with the right release, options and space.',w:'It avoids a failed plug-in.',s:'Pre-checks.',x:'Different character sets or options block the plug-in.',c:`SELECT value FROM nls_database_parameters WHERE parameter = 'NLS_CHARACTERSET';`},
 {ids:['manif'],t:'2. Open the non-CDB read-only and generate the XML manifest that describes it.',w:'The CDB needs a description of the files to plug in.',s:'`DBMS_PDB.DESCRIBE`.',x:'The non-CDB must not be written to after the manifest.',c:`SHUTDOWN IMMEDIATE
STARTUP MOUNT
ALTER DATABASE OPEN READ ONLY;`},
 {ids:['plug'],t:'3. Create the pluggable database from the manifest, with COPY or MOVE.',w:'The data is now inside the CDB.',s:'`CREATE PLUGGABLE DATABASE ... USING`.',x:'NOCOPY leaves the PDB depending on the original files.',c:`SELECT con_id, name, open_mode FROM v$pdbs;`},
 {ids:['conv'],t:'4. Run noncdb_to_pdb.sql in the PDB, and then open it.',w:'It cleans the dictionary of non-CDB objects.',s:'`noncdb_to_pdb.sql`.',x:'A PDB that is plugged in but not converted stays restricted.',c:`SELECT name, open_mode, restricted FROM v$pdbs;`},
 {ids:['open','chk'],t:'5. Open it normally, save its state, then check services and the application.',w:'It is now an ordinary PDB.',s:'`SAVE STATE`, service names.',x:'Application connection strings must change to the PDB service.',c:`SELECT name FROM v$services WHERE con_id > 2;`}]}},

{h:'5. Upgrading a primary and standby with fallback'},
{map:{title:'Upgrade with Data Guard map',h:216,trace:'Upgrade with a standby',
 hint:'Tap any box, or press Upgrade with a standby to follow an upgrade that keeps a standby protected.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'pre',x:20,y:24,w:139,h:56,c:'mem',t:'Prepare',s:'health and backups',d:'Verify the configuration is synchronised, and back up both databases.',why:'You start from a healthy pair.',chk:`DGMGRL> VALIDATE DATABASE stby;`,see:[2,4,'Fallback options: restore points, backup and downgrade']},
 {id:'rp',x:187,y:24,w:139,h:56,c:'disk',t:'Restore points',s:'both databases',d:'Create guaranteed restore points on the primary and the standby.',why:'It lets you go back on both sides.',chk:`CREATE RESTORE POINT before_upg GUARANTEE FLASHBACK DATABASE;`,see:[2,4,'Fallback options: restore points, backup and downgrade']},
 {id:'stby',x:354,y:24,w:139,h:56,c:'proc',t:'Stop apply',s:'standby',d:'Stop redo apply on the standby, keeping it as the fallback copy of the old release.',why:'It stays at the old version.',chk:`DGMGRL> EDIT DATABASE stby SET STATE = 'APPLY-OFF';`,see:[3,2,'Upgrading a CDB and its PDBs']},
 {id:'sw',x:521,y:24,w:139,h:56,c:'proc',t:'Install new home',s:'on both hosts',d:'Install the new release home on both servers.',why:'Done in advance, with no downtime.',chk:`$ ./runInstaller -silent -responseFile db.rsp`,see:[1,4,'Out-of-place patching with gold images']},
 {id:'up',x:20,y:136,w:139,h:56,c:'warn',t:'Upgrade primary',s:'AutoUpgrade',d:'Upgrade the primary with AutoUpgrade. The standby does not apply the upgrade redo yet.',why:'The primary is unavailable for the upgrade time.',chk:`$ java -jar autoupgrade.jar -config upg.cfg -mode deploy`,see:[3,1,'Modes: analyze, fixups, deploy and upgrade']},
 {id:'sync',x:187,y:136,w:139,h:56,c:'proc',t:'Upgrade standby',s:'start on new home',d:'Start the standby on the new home and resume apply so it catches up.',why:'It then stays in step.',chk:`DGMGRL> EDIT DATABASE stby SET STATE = 'APPLY-ON';`,see:[4,4,'Migrating with Data Guard']},
 {id:'val',x:354,y:136,w:139,h:56,c:'mem',t:'Validate',s:'application and lag',d:'Validate the application and check that the standby is applying.',why:'Both sides must be healthy before you drop the fallback.',chk:`DGMGRL> SHOW CONFIGURATION;`,see:[6,1,'Testing, validation and performance comparison']},
 {id:'fb',x:521,y:136,w:139,h:56,c:'warn',t:'Drop fallback',s:'when accepted',d:'After acceptance, drop the restore points and raise COMPATIBLE.',why:'It frees the FRA and closes the fallback.',chk:`DROP RESTORE POINT before_upg;`,see:[6,2,'Communication, change records and rollback decisions']}],
 steps:[
 {ids:['pre','rp'],t:'1. Validate the configuration and create guaranteed restore points on the primary and the standby.',w:'Both sides can return to this moment.',s:'`VALIDATE DATABASE`, `CREATE RESTORE POINT`.',x:'A standby that is behind at this point is not a valid fallback.',c:`SELECT name FROM v$restore_point;`},
 {ids:['stby','sw'],t:'2. Install the new home on both hosts. Stop redo apply on the standby so it remains the old release.',w:'The standby is your untouched copy.',s:'Broker apply state.',x:'Letting apply run through the upgrade redo on an old home fails.',c:`DGMGRL> SHOW DATABASE stby;`},
 {ids:['up'],t:'3. Upgrade the primary with AutoUpgrade. This is the outage.',w:'The work is done on one database.',s:'AutoUpgrade deploy.',x:'If the upgrade fails, flashback the primary and the standby is unchanged.',c:`upg> status -job 100`},
 {ids:['sync'],t:'4. Start the standby on the new home and restart apply, so it recovers the upgrade redo.',w:'It is protected again.',s:'Broker, `datapatch`.',x:'Slow apply of the upgrade redo means a longer period unprotected.',c:`SELECT name, value FROM v$dataguard_stats WHERE name = 'apply lag';`},
 {ids:['val','fb'],t:'5. Validate the application and the standby. After the acceptance period raise COMPATIBLE and drop the restore points.',w:'The fallback is gone only when you choose.',s:'`COMPATIBLE`, `DROP RESTORE POINT`.',x:'Dropping the restore point before acceptance removes the quick rollback.',c:`SELECT name, guarantee_flashback_database FROM v$restore_point;`}]}},

{h:'6. Migrating a schema with minimal downtime'},
{map:{title:'Data Pump migration map',h:216,trace:'Migrate a schema',
 hint:'Tap any box, or press Migrate a schema to follow a Data Pump migration from preparation to cutover.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'inv',x:20,y:24,w:139,h:56,c:'mem',t:'Inventory',s:'what moves',d:'List the schemas, objects, sizes, dependencies and external references.',why:'You need to know what is in scope.',chk:`SELECT owner, ROUND(SUM(bytes)/1024/1024) AS mb FROM dba_segments WHERE owner = 'APP' GROUP BY owner;`,see:[4,1,'Data Pump migrations']},
 {id:'pre',x:187,y:24,w:139,h:56,c:'proc',t:'Prepare target',s:'users, tablespaces',d:'Create tablespaces, users and roles on the target.',why:'The import expects them.',chk:`CREATE TABLESPACE app_data DATAFILE SIZE 10G AUTOEXTEND ON;`,see:[4,1,'Data Pump migrations']},
 {id:'exp',x:354,y:24,w:139,h:56,c:'proc',t:'Export',s:'consistent',d:'Export with a consistent SCN and parallelism.',why:'It gives a point-in-time copy.',chk:`$ expdp system schemas=app flashback_scn=4829107 parallel=8 directory=dp_dir dumpfile=app_%U.dmp`,see:[4,1,'Data Pump migrations']},
 {id:'cut',x:521,y:24,w:139,h:56,c:'warn',t:'Quiesce',s:'at cutover',d:'Stop the application and take the final export, or apply changes with GoldenGate.',why:'It sets the downtime.',chk:`SELECT COUNT(*) FROM v$session WHERE username = 'APP';`,see:[4,7,'Practical: Migrate a schema with minimal downtime']},
 {id:'imp',x:20,y:136,w:139,h:56,c:'proc',t:'Import',s:'on the target',d:'Import the data, then indexes and constraints.',why:'This is the long step. Parallel import helps.',chk:`$ impdp system schemas=app directory=dp_dir dumpfile=app_%U.dmp parallel=8`,see:[4,1,'Data Pump migrations']},
 {id:'val',x:187,y:136,w:139,h:56,c:'mem',t:'Validate',s:'counts and objects',d:'Compare row counts and invalid objects, run the application tests.',why:'It confirms nothing was lost.',chk:`SELECT COUNT(*) FROM dba_objects WHERE owner = 'APP' AND status = 'INVALID';`,see:[4,7,'Practical: Migrate a schema with minimal downtime']},
 {id:'sw',x:354,y:136,w:139,h:56,c:'proc',t:'Switch',s:'point the application',d:'Change the connection strings and resume the application.',why:'Downtime ends.',chk:`$ tnsping target`,see:[4,7,'Practical: Migrate a schema with minimal downtime']},
 {id:'back',x:521,y:136,w:139,h:56,c:'warn',t:'Fallback',s:'keep the source',d:'Keep the source intact and unchanged for the agreed period.',why:'It is the way back.',chk:`SELECT status FROM v$instance;`,see:[6,2,'Communication, change records and rollback decisions']}],
 steps:[
 {ids:['inv','pre'],t:'1. Inventory what moves and prepare the target: tablespaces, users, roles and grants.',w:'The import should have no surprises.',s:'`expdp ... CONTENT=METADATA_ONLY` to test.',x:'Missing roles cause grant errors in the import log.',c:`$ expdp system schemas=app content=metadata_only directory=dp_dir dumpfile=app_meta.dmp`},
 {ids:['exp'],t:'2. Export with a consistent SCN and parallelism. Rehearse it for timing.',w:'The rehearsal gives you the window.',s:'`FLASHBACK_SCN`, `PARALLEL`.',x:'ORA-01555 if undo is too small for the duration.',c:`SELECT current_scn FROM v$database;`},
 {ids:['cut','imp'],t:'3. At cutover, stop the application, take the final export and import it. Downtime equals export plus import.',w:'It is the whole outage for this method.',s:'Window, parallelism, network.',x:'A long import is why large databases use other methods.',c:`$ impdp system parfile=imp.par`},
 {ids:['val'],t:'4. Validate counts, objects and application behaviour. Recompile invalid objects and gather statistics.',w:'You prove that the data is intact.',s:'`utlrp.sql`, `DBMS_STATS`.',x:'Skipping statistics gives bad plans on day one.',c:`EXEC DBMS_STATS.GATHER_SCHEMA_STATS('APP');`},
 {ids:['sw','back'],t:'5. Switch the application, and keep the source unchanged for the agreed fallback period.',w:'It lets you go back without data loss.',s:'Connection strings, fallback plan.',x:'Changes made on the target cannot return to the source without a reverse path.',c:`SELECT COUNT(*) FROM app.orders;`}]}},

{h:'7. The go or no-go and fallback decision'},
{map:{title:'Fallback decision map',h:216,trace:'Decide to keep or go back',
 hint:'Tap any box, or press Decide to keep or go back to follow the checks that decide a rollback.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'crit',x:20,y:24,w:139,h:56,c:'ext',t:'Criteria',s:'agreed before',d:'Written success criteria: errors, response times, batch completion, key reports.',why:'Agree them before the change, not after.',chk:`SELECT name, value FROM v$sysstat WHERE name IN ('user commits','execute count');`,see:[6,2,'Communication, change records and rollback decisions']},
 {id:'mon',x:187,y:24,w:139,h:56,c:'mem',t:'Monitor',s:'observation period',d:'Watch the system against the criteria for the period.',why:'Include the daily peak and the batch window.',chk:`SELECT event, total_waits FROM v$system_event ORDER BY time_waited_micro DESC FETCH FIRST 5 ROWS ONLY;`,see:[6,1,'Testing, validation and performance comparison']},
 {id:'cmp',x:354,y:24,w:139,h:56,c:'mem',t:'Compare',s:'to baseline',d:'Compare AWR and application metrics with the pre-change baseline.',why:'A comparison is more reliable than an impression.',chk:`@?/rdbms/admin/awrddrpt.sql`,see:[6,1,'Testing, validation and performance comparison']},
 {id:'dec',x:521,y:24,w:139,h:56,c:'warn',t:'Decide',s:'keep or revert',d:'The named owner decides using the criteria and the evidence.',why:'A decision with a name and a time.',chk:`SELECT name, time FROM v$restore_point;`,see:[6,2,'Communication, change records and rollback decisions']},
 {id:'rb',x:21,y:136,w:194,h:56,c:'proc',t:'Roll back',s:'by the runbook',d:'Run the rollback procedure: switch home, flashback or restore, depending on how far you are.',why:'The earlier, the easier.',chk:`FLASHBACK DATABASE TO RESTORE POINT before_upg;`,see:[2,4,'Fallback options: restore points, backup and downgrade']},
 {id:'ver',x:243,y:136,w:194,h:56,c:'mem',t:'Verify',s:'after rollback',d:'Check the system is back to its previous state and working.',why:'The rollback must be tested too.',chk:`SELECT version_full FROM v$instance;`,see:[6,0,'Runbook: patch, upgrade and convert end to end']},
 {id:'cls',x:465,y:136,w:194,h:56,c:'ext',t:'Close',s:'record and learn',d:'Close the change record, drop restore points and write what you learned.',why:'It leaves the system clean and the team wiser.',chk:`DROP RESTORE POINT before_upg;`,see:[6,3,'Capstone: Upgrade a primary and standby from 19c to 26ai with fallback']}],
 steps:[
 {ids:['crit','mon'],t:'1. Agree the success criteria and rollback triggers before the change, and monitor against them after.',w:'It removes argument in the middle of the night.',s:'Change record, monitoring.',x:'Criteria written after the change are bent to fit.',c:`SELECT name, value FROM v$sysstat WHERE name = 'execute count';`},
 {ids:['cmp'],t:'2. Compare with the baseline: AWR differences, plan changes, error rates and batch durations.',w:'It separates real regressions from noise.',s:'AWR baseline, SPA.',x:'Comparing different business days.',c:`SELECT sql_id, plan_hash_value FROM v$sql ORDER BY elapsed_time DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['dec'],t:'3. The decision owner chooses to keep the change or revert. Record the decision and the evidence.',w:'A named decision is accountable.',s:'Escalation path.',x:'Waiting beyond the point where flashback is still possible.',c:`SELECT name, time, guarantee_flashback_database FROM v$restore_point;`},
 {ids:['rb','ver'],t:'4. If reverting, follow the runbook: switch homes, flashback or restore. Then verify the system.',w:'A rehearsed rollback is a routine.',s:'Runbook, restore points.',x:'Raised COMPATIBLE or new data limits the options. Check first.',c:`SELECT version_full FROM v$instance;`},
 {ids:['cls'],t:'5. Close the change: remove temporary objects, drop restore points, update the inventory and write the review.',w:'It stops leftovers from filling the FRA.',s:'Change closure checklist.',x:'A forgotten guaranteed restore point.',c:`SELECT name FROM v$restore_point;`}]}},

]},

/* 1 ---------------------------------------------------------------- terms */
{t:'Patch and release terms',d:'The words used for releases, patches and support, and what each means.',see:[[0,0,'The release model'],[0,1,'Patch types']],b:[
{t:[['Term','Meaning','Use'],
['Long-Term Release','Release with years of support and regular updates (19c, 26ai)','Production target'],
['Innovation Release','Newer features, shorter support (21c, 23ai)','Evaluation, short-lived systems'],
['Release Update (RU)','Quarterly cumulative bundle of security, bug and regression fixes','Standard patching'],
['Release Update Revision (RUR)','Earlier model: RU plus security and critical fixes only','Where still offered'],
['Monthly Recommended Patches (MRP)','Platform fixes between RUs','Where offered'],
['CPU / CSPU','Critical Patch Update (quarterly) and monthly security patch stream','Security compliance [26ai]'],
['One-off (interim) patch','Fix for one bug','Specific problem'],
['Merge patch (MLR)','Combination of two conflicting one-offs','When a conflict exists'],
['Bundle patch','Component or platform bundle (Exadata, Windows)','Platform'],
['OJVM patch','Patch for the embedded Java VM','If Java in the database is used'],
['Gold image','Packaged, tested Oracle home','Standard homes'],
['In-place patching','Patch the existing home','Small systems'],
['Out-of-place patching','New home from image, switch databases to it','Production'],
['Upgrade','Move to a new release (19c to 26ai)','Project'],
['Migration','Move data to another platform or architecture','Project'],
['COMPATIBLE','Feature level; raising it blocks downgrade','Last step']]},
{note:'Names and cadence for security patches change. Read the current announcement on My Oracle Support before planning.'}
]},

/* 2 ---------------------------------------------------------------- files */
{t:'Files and directories',d:'The directories involved in patching and upgrading, and what each holds.',see:[[1,0,'Inventory and OPatch'],[3,0,'AutoUpgrade architecture']],b:[
{t:[['Path','Content'],
['`$ORACLE_HOME`','The software being patched'],
['`$ORACLE_HOME/OPatch`','OPatch and `datapatch` tools'],
['`$ORACLE_HOME/.patch_storage`','Backup copies for rollback. Do not delete.'],
['`oraInventory` (`/etc/oraInst.loc`)','Central inventory of homes'],
['`$ORACLE_HOME/inventory`','Home inventory: components and patches'],
['`$ORACLE_HOME/cfgtoollogs/opatch`','OPatch logs'],
['`$ORACLE_BASE/cfgtoollogs/sqlpatch`','Datapatch logs'],
['`<global_log_dir>/<job>`','AutoUpgrade logs, reports and status'],
['`<log_dir>/<sid>/<job>/prechecks`','AutoUpgrade analyze reports (HTML and text)'],
['`$ORACLE_BASE/cfgtoollogs/dbua` or `.../upgrade`','Upgrade logs'],
['`/stage/<patch_id>`','Your unzipped patch (convention)'],
['Gold image zip','Packaged home (`db_home.zip`)']]},
{note:'`.patch_storage` is what makes rollback possible. If it is cleaned, the patch cannot be removed with OPatch.'}
]},

/* 3 ---------------------------------------------------------------- logs */
{t:'Log files and where to find them',d:'Where to look when a patch or upgrade step fails.',see:[[1,5,'Rollback and troubleshooting'],[3,5,'Post-upgrade']],b:[
{t:[['Step','Log','Where'],
['OPatch apply or rollback','`opatch<date>.log`','`$ORACLE_HOME/cfgtoollogs/opatch`'],
['Datapatch','`sqlpatch_invocation.log`, `sqlpatch_<id>_apply.log`','`$ORACLE_BASE/cfgtoollogs/sqlpatch/<patch_id>`'],
['AutoUpgrade','`autoupgrade_<date>.log`, `status.log`, job directories','`global.global_log_dir`'],
['AutoUpgrade analyze','`<db>_preupgrade.html`','Job `prechecks` folder'],
['Database upgrade (dbupgrade)','`upg_summary.log`, `catupgrd*.log`','Upgrade log directory'],
['Alert log','Startup, upgrade mode, errors','ADR `trace`'],
['Installer','`installActions<date>.log`','`oraInventory/logs`'],
['Post-upgrade fixups','Reports in the job folder','Job `postfixups` folder']]},
{code:`# latest datapatch result in the database
SELECT patch_id, action, status, action_time, description
FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 10 ROWS ONLY;

# OPatch history
opatch lsinventory | grep -i "Patch  "`}
]},

/* 4 ---------------------------------------------------------------- settings */
{t:'AutoUpgrade settings and parameters',d:'The AutoUpgrade configuration keys you use most, and database parameters that matter at upgrade time.',see:[[3,0,'AutoUpgrade configuration'],[2,3,'COMPATIBLE and planning']],b:[
{h:'AutoUpgrade configuration file'},
{t:[['Key','Meaning'],
['`global.global_log_dir`','Folder for all logs and status'],
['`global.keystore`','Folder of the secure keystore (MOS credentials and passwords)'],
['`global.folder`','Folder for downloaded patches'],
['`upgN.sid`','SID of the database'],
['`upgN.source_home`, `upgN.target_home`','Old and new Oracle homes'],
['`upgN.log_dir`','Logs for this job'],
['`upgN.target_version`','Version you upgrade to'],
['`upgN.start_time`','`NOW` or a time'],
['`upgN.restoration`','`yes` to create a restore point (default)'],
['`upgN.timezone_upg`','Upgrade time zone data'],
['`upgN.pdbs`','Which PDBs to include'],
['`upgN.target_cdb`, `upgN.target_pdb_name.<sid>`','Convert a non-CDB into a PDB of a target CDB [26ai]'],
['`upgN.run_utlrp`','`yes` to recompile invalid objects at the end'],
['`patchN.patch`','`RECOMMENDED` or a list (patch mode)']]},
{h:'Database parameters to review'},
{t:[['Parameter','Note'],
['`compatible`','Keep the old value until the new release is proven'],
['`optimizer_features_enable`','Set to the old release only as a short-term plan freeze'],
['`sga_target`, `pga_aggregate_target`','Check sizes: new release may need more'],
['`processes`','Parallel upgrade uses many processes'],
['`job_queue_processes`','Set to 0 during upgrade (AutoUpgrade does this)'],
['`cluster_database`','Set to FALSE during upgrade of RAC'],
['Deprecated or removed parameters','Remove from SPFILE before upgrade'],
['`undo_tablespace`, `db_recovery_file_dest_size`','Needed for restore points']]}
]},

/* 5 ---------------------------------------------------------------- views */
{t:'System views',d:'Which view answers which patch or upgrade question.',see:[[1,3,'Datapatch'],[3,5,'Post-upgrade checks']],b:[
{t:[['Question','View'],
['Which release is running?','`V$VERSION`, `PRODUCT_COMPONENT_VERSION`'],
['Which SQL patches are applied?','`DBA_REGISTRY_SQLPATCH`'],
['What is the history of upgrades?','`DBA_REGISTRY_HISTORY`'],
['Which components and their status?','`DBA_REGISTRY`, `DBA_REGISTRY_ERROR`'],
['Which time zone file?','`V$TIMEZONE_FILE`, `DATABASE_PROPERTIES`'],
['COMPATIBLE value','`V$PARAMETER` (`name = \'compatible\'`)'],
['Invalid objects','`DBA_OBJECTS`, `DBA_ERRORS`'],
['Is this a CDB, PDB state?','`V$DATABASE`, `V$PDBS`'],
['Incarnations (after RESETLOGS)','`V$DATABASE_INCARNATION`'],
['Restore points','`V$RESTORE_POINT`'],
['Deprecated parameters in use','`V$PARAMETER` (`isdeprecated = \'TRUE\'`)'],
['Unsupported features in use','`DBA_FEATURE_USAGE_STATISTICS`'],
['Database options installed','`V$OPTION`, `DBA_REGISTRY`']]}
]},

/* 6 ---------------------------------------------------------------- tools */
{t:'Command-line tools',d:'Tools used for patching, upgrading and migrating, with a typical command.',see:[[1,0,'OPatch'],[3,1,'AutoUpgrade modes']],b:[
{t:[['Tool','Use','Typical command'],
['`opatch version`','Check OPatch version','`opatch version`'],
['`opatch lspatches`','List patches in a home','`opatch lspatches`'],
['`opatch prereq`','Conflict and space checks','`opatch prereq CheckConflictAgainstOHWithDetail -ph ./`'],
['`opatch apply`','Apply a patch','`opatch apply`'],
['`opatch rollback`','Remove a patch','`opatch rollback -id <patch_id>`'],
['`opatchauto`','Patch Grid Infrastructure and RAC homes','`opatchauto apply <patch dir>`'],
['`datapatch`','Apply or roll back SQL changes','`datapatch -verbose`'],
['`autoupgrade.jar`','Analyze, fix, upgrade, patch','`java -jar autoupgrade.jar -config c.cfg -mode deploy`'],
['`runInstaller -createGoldImage`','Package a home','`-destinationLocation /stage/gold`'],
['`dbupgrade`','Parallel upgrade engine','Used by AutoUpgrade'],
['`dbdowngrade`','Downgrade script runner','Per Upgrade Guide'],
['`expdp`, `impdp`','Logical migration','`expdp ... full=y`'],
['`rman CONVERT`','Cross-platform conversion','`CONVERT DATAFILE ...`'],
['`zdmcli`','Zero Downtime Migration','`zdmcli migrate database ... -eval`']]},
{h:'AutoUpgrade console'},
{t:[['Command','Meaning'],
['`lsj`','List jobs'],
['`status -job n`','Detail of a job'],
['`tasks`','Running tasks'],
['`abort -job n`','Stop a job'],
['`restore -jobs n`','Fallback with restore point'],
['`resume -job n`','Continue after a fix']]}
]},

/* 7 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'Patching method, upgrade method, migration method and fallback choices.',see:[[0,5,'Patch strategy'],[4,0,'Choosing a migration method']],b:[
{h:'Patching method'},
{t:[['Method','Outage','Rollback','Use'],
['In-place','Longer','`opatch rollback`','Small or test systems'],
['Out-of-place with gold image','Short','Switch back to old home','Production'],
['Rolling (RAC)','Per node, service stays up','Per node','RAC and Grid Infrastructure'],
['Standby-first (Data Guard)','Switchover only','Switch back','Critical systems']]},
{h:'Upgrade method'},
{t:[['Method','Outage','Notes'],
['AutoUpgrade deploy','Minutes to hours','Standard path'],
['Unplug and plug PDB','Minutes per PDB','PDB by PDB'],
['Data Guard rolling (DBMS_ROLLING)','Seconds to minutes','Needs standby and tested procedure'],
['GoldenGate','Seconds to minutes','Any platform or version, licence needed'],
['Data Pump to a new database','Hours','Logical rebuild']]},
{h:'Migration method'},
{t:[['Situation','Use'],
['Small database, downtime is acceptable','Data Pump'],
['Large, same endian, short window','Transportable tablespaces with incrementals'],
['Same platform to new hardware','Data Guard and switchover'],
['Different platform, near zero downtime','GoldenGate'],
['To Oracle cloud','Zero Downtime Migration']]},
{h:'Fallback'},
{t:[['Option','Speed','Limit'],
['Guaranteed restore point','Fast','Loses changes since; needs COMPATIBLE unchanged'],
['Downgrade','Medium','Not after COMPATIBLE is raised'],
['Restore from backup','Slow','Always possible'],
['Keep old database as standby or clone','Instant','Needs a plan for new data']]}
]},

/* 8 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, likely cause and fix.',see:[[1,5,'Rollback and troubleshooting'],[3,6,'Downgrade and rollback']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['OPatch prereq fails on conflict','Output names the conflicting patch','One-off conflicts with RU','Get merge patch or newer RU'],
['OPatch says active files or processes','`fuser`, `ps` on the home','Instance, listener or tools still running','Stop everything using the home'],
['OPatch version too old','README minimum','Old OPatch','Install patch 6880880 for the release'],
['OPatch cannot lock inventory','`oraInst.loc`, ownership','Wrong user or stale lock','Run as software owner, check inventory'],
['Datapatch fails or hangs','`sqlpatch` logs','PDB closed, jobs, locks','Open PDBs, fix error, rerun `datapatch -verbose`'],
['Datapatch says already applied','`DBA_REGISTRY_SQLPATCH`','Normal','Nothing to do'],
['AutoUpgrade analyze reports errors','HTML report','Unsupported feature, invalid objects, space','Fix each and rerun'],
['Upgrade slow','Number of components, parallelism','Many PDBs, low CPU','Increase parallelism, rehearse'],
['Many invalid objects after upgrade','`utlrp.sql`, `DBA_ERRORS`','Not yet recompiled','Recompile, fix real errors'],
['Application slower after upgrade','AWR compare, plans','Plan regression','SPM baselines, statistics'],
['PDB restricted after plug-in','`PDB_PLUG_IN_VIOLATIONS`','Not upgraded or patch mismatch','Upgrade PDB or run datapatch'],
['Cannot downgrade','`V$PARAMETER compatible`','COMPATIBLE raised','Restore from backup instead']]}
]},

/* 9 ---------------------------------------------------------------- errors */
{t:'Common error messages',d:'Messages seen during patching and upgrading, with meaning and fix.',see:[[1,5,'Rollback and troubleshooting'],[2,2,'Pre-upgrade analysis']],b:[
{t:[['Message','Meaning','Fix'],
['Prerequisite check "CheckConflictAgainstOHWithDetail" failed','Conflicting patches in the home','Merge patch or newer RU'],
['Prerequisite check "CheckActiveFilesAndExecutables" failed','Files in use','Stop processes using the home'],
['"OPatch version is not supported"','Old OPatch','Update OPatch'],
['"OUI-67xxx" errors','OPatch or OUI internal or inventory error','Read the log named in the message'],
['ORA-39700','Database must be opened with UPGRADE option','Start `STARTUP UPGRADE`'],
['ORA-01092','Instance terminated, disconnection forced','Read alert log; often a failed upgrade step'],
['ORA-00704 / ORA-00604','Bootstrap or recursive SQL failure','Mismatched dictionary and binaries'],
['ORA-65040 / ORA-65090','Operation not allowed from a PDB or needs the root','Run in the right container'],
['ORA-65054','Invalid state for PDB operation','Check PDB state'],
['ORA-01190','File from before the last RESETLOGS','Use correct incarnation or backup'],
['ORA-38760 / 38761','Flashback Database not enabled or not enough logs','Use restore from backup'],
['ORA-19809','Recovery area limit exceeded (restore point logs)','Raise FRA size'],
['"datapatch: database is not open"','Instance or PDBs closed','Open them and rerun'],
['"UPG-..." messages (AutoUpgrade)','Job-level errors','See the job log and HTML report']]},
{note:'Only the message texts that Oracle prints are reliable. Search the exact text in My Oracle Support before you act on a guess.'}
]},

/* 10 ---------------------------------------------------------------- health check */
{t:'Health-check SQL pack',d:'Paste-ready queries to verify patch and upgrade state.',see:[[0,6,'Patch calendar and inventory'],[3,5,'Post-upgrade']],b:[
{h:'What am I running?'},
{code:`SELECT banner_full FROM v$version;
SELECT name, cdb, open_mode, database_role FROM v$database;
SELECT comp_id, comp_name, version, status FROM dba_registry ORDER BY comp_id;`},
{h:'Patch level'},
{code:`SELECT patch_id, patch_uid, action, status, action_time, description
FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 10 ROWS ONLY;

SELECT status, COUNT(*) FROM dba_registry_sqlpatch GROUP BY status;`},
{h:'Objects and errors'},
{code:`SELECT owner, object_type, COUNT(*) FROM dba_objects WHERE status = 'INVALID' GROUP BY owner, object_type ORDER BY 3 DESC;
SELECT * FROM dba_registry_error FETCH FIRST 10 ROWS ONLY;`},
{h:'Time zone and compatibility'},
{code:`SELECT * FROM v$timezone_file;
SELECT name, value FROM v$parameter WHERE name IN ('compatible','optimizer_features_enable');`},
{h:'PDB plug-in problems'},
{code:`SELECT name, cause, type, status, message FROM pdb_plug_in_violations WHERE status <> 'RESOLVED' ORDER BY time;`},
{h:'Before the window'},
{code:`SELECT log_mode, flashback_on FROM v$database;
SELECT name, scn, guarantee_flashback_database FROM v$restore_point;
SELECT name, space_limit/1048576 limit_mb, space_used/1048576 used_mb FROM v$recovery_file_dest;`}
]},

/* 11 ---------------------------------------------------------------- naming decoder */
{t:'Version and patch naming decoder',d:'How to read version strings, patch IDs and AutoUpgrade names.',see:[[0,0,'The release model'],[0,4,'Reading READMEs']],b:[
{t:[['Item','Looks like','Meaning'],
['Long version','`19.24.0.0.0`','Release 19, Release Update 24, then build numbers'],
['Short version','`19.24`','Release and RU'],
['Year-based (26ai)','`26.1` and later','Release and update number; read the release notes'],
['Patch ID','`36582781`','Number of one patch on My Oracle Support'],
['Patch UID','`26000000`','Unique ID of a patch instance in a home'],
['RU patch for DB','Named "Database Release Update"','Includes security fixes of the quarter'],
['GI RU','Named "GI Release Update"','Includes the DB RU for the same level'],
['OJVM patch','Named "OJVM Release Update"','Separate patch'],
['Merge patch','`Merge Label Request`','Combines one-offs'],
['AutoUpgrade job','`100`, `101`','Job number from `lsj`'],
['Restore point name','`AUTOUPGRADE_...`','Created by AutoUpgrade for fallback'],
['Home names','`dbhome_1`, `dbhome_2`','Convention for out-of-place patching']]},
{note:'GI RUs usually include the matching database RU. Read the README of the patch you download to know what it contains.'}
]},

/* 12 ---------------------------------------------------------------- checklist */
{t:'Upgrade and patch checklist',d:'A timeline checklist you can copy into a change record.',see:[[6,0,'Runbook'],[6,3,'Capstone']],b:[
{t:[['When','Task'],
['T-90 days','Inventory, support dates, application certification, project plan'],
['T-60 days','AutoUpgrade analyze, fix errors, gold image built'],
['T-30 days','Full rehearsal on a copy, measure time, test application and performance'],
['T-14 days','Approvals, communication, fallback tested'],
['T-7 days','Fixups, backups verified, restore points planned, space checked'],
['T-1 day','Final checks, contacts, runbook frozen'],
['T-0','Backup, stop applications, deploy, verify, go or no-go'],
['T+0','Smoke tests, performance comparison, monitoring'],
['T+7 days','Stabilize, statistics and plans reviewed'],
['T+30 days','Raise COMPATIBLE, drop restore points, retire old home']]},
{h:'Go or no-go'},
{t:[['Check','Pass'],
['Components valid','All VALID, version expected'],
['Invalid objects','Not above baseline'],
['Application smoke test','Passes'],
['Key transactions','Within agreed limits'],
['Data Guard and backups','Working']]}
]}

]};
