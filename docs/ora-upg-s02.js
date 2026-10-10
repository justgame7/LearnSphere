/* LearnSphere - Upgrade, Patching & Migration, Section 02: Patching with OPatch & Datapatch.
   Lectures 0-7 are core, 8+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const UG=O.D+'upgrd/';
const OP='https://docs.oracle.com/en/database/oracle/oracle-database/19/opati/';

/* ---------- diagrams ---------- */
const parts=O.dg(700,200,[
[10,20,300,160,'Binary patching (OPatch)',1],[30,60,260,40,'Updates files in ORACLE_HOME',0],[30,115,260,50,'Database must be down|(or rolling for RAC)',0],
[390,20,300,160,'SQL patching (datapatch)',1],[410,60,260,40,'Updates data dictionary and SQL',0],[410,115,260,50,'Database open, run after|startup of patched home',0]],
[[310,100,390,100]]);

const oop=O.dg(700,190,[
[10,40,150,100,'Current home|19.20|(running)',0],
[220,10,160,70,'Gold image|19.24 patched',2],
[220,110,160,60,'New home|from image',2],
[450,40,120,100,'Switch|database to|new home',0],
[610,40,80,100,'Old home|kept for|rollback',0]],
[[160,90,220,45],[300,80,300,110],[380,140,450,100],[570,90,610,90]]);

/* ---------- 0: Inventory and OPatch ---------- */
L['ora-upg:1:0']={blocks:[
{p:'Every Oracle home has an **inventory** that lists installed software and patches. **OPatch** reads and updates it.'},
{t:[['Item','Meaning'],
['**Central inventory**','`oraInventory`: list of all Oracle homes on the host'],
['**Home inventory**','Components and patches installed in one home'],
['**OPatch**','The tool in `$ORACLE_HOME/OPatch` that applies and rolls back patches']]},
{code:`export ORACLE_HOME=/u01/app/oracle/product/19.0.0/dbhome_1
export PATH=$ORACLE_HOME/OPatch:$PATH

opatch version                # must meet the patch README minimum
opatch lsinventory            # all installed patches
opatch lspatches              # short list
opatch lsinventory -detail    # components`},
{h:'Update OPatch'},
{flow:['Download the latest OPatch (MOS patch 6880880) for your release','Back up the existing OPatch directory','Unzip the new one over the home','Check `opatch version`']},
{note:'Run OPatch as the **Oracle software owner**, never as root (except for Grid Infrastructure root scripts). Patches applied as root break file ownership.'}],
src:[['OPatch User Guide',OP]]};

/* ---------- 1: Pre-checks ---------- */
L['ora-upg:1:1']={blocks:[
{p:'Pre-checks find problems **before** the outage. Run all of them.'},
{code:`# unzip the patch into a stage directory, then
cd /stage/36000000
opatch prereq CheckConflictAgainstOHWithDetail -ph ./
opatch prereq CheckSystemSpace -ph ./

# check free space and OS prerequisites
df -h $ORACLE_HOME /tmp`},
{t:[['Check','Why'],
['**OPatch version**','The README sets a minimum'],
['**Conflicts**','Another patch already changes the same file'],
['**Space**','Home, `/tmp` and inventory space'],
['**Processes**','No Oracle processes using the home (for offline apply)'],
['**Backup**','Home backup or gold image of the old home'],
['**Database backup**','A recent validated backup and a restore point (optional)']]},
{h:'If there is a conflict'},
{ul:['Ask Oracle Support for a **merge patch**, or use the version of the RU that contains the fix.','Never ignore a conflict message.']},
{note:'Check the **datapatch** needs too: the database must be able to start in upgrade-like mode for SQL patch application on some patch types.'}],
src:[['Pre-checks',OP]]};

/* ---------- 2: Apply RU in-place ---------- */
L['ora-upg:1:2']={blocks:[
{p:'**In-place patching** modifies the existing home. It is simple but has a longer outage and a harder rollback.'},
{flow:['Stop listener and database (and CRS resources if any)','Back up the home (tar)','Apply the patch with `opatch apply`','Start the database','Run `datapatch -verbose`','Check and start services']},
{code:`lsnrctl stop
sqlplus / as sysdba <<EOF
SHUTDOWN IMMEDIATE
EOF

cd /stage/36000000
opatch apply

sqlplus / as sysdba <<EOF
STARTUP
EXIT
EOF
$ORACLE_HOME/OPatch/datapatch -verbose
lsnrctl start`},
{t:[['','In-place','Out-of-place'],
['**Outage**','Longer (binaries patched while down)','Short (switch home)'],
['**Rollback**','`opatch rollback`, slower','Switch back to the old home'],
['**Space**','Little','A second home'],
['**Risk**','Home may be left half-patched on failure','Old home untouched']]},
{note:'In-place is acceptable for small systems. For production, prefer out-of-place patching with a gold image.'}],
src:[['Applying patches',OP]]};

/* ---------- 3: datapatch ---------- */
L['ora-upg:1:3']={blocks:[
{p:'Binary patches change files. Many also change **SQL objects** in the data dictionary. **datapatch** applies those, and records them.'},
{svg:parts},
{code:`cd $ORACLE_HOME/OPatch
./datapatch -verbose

-- verify
SELECT patch_id, patch_uid, action, status, action_time, description
FROM dba_registry_sqlpatch ORDER BY action_time DESC;

SELECT * FROM dba_registry_sqlpatch WHERE status <> \'SUCCESS\';`},
{t:[['Point','Notes'],
['**When**','After the database is started from the patched home'],
['**Multitenant**','Patches the root and all open PDBs. Closed PDBs need datapatch later when opened.'],
['**RAC**','Run once, from one node'],
['**Data Guard**','Run on the primary. Changes reach the standby through redo.'],
['**Failures**','Read the log in `$ORACLE_BASE/cfgtoollogs/sqlpatch/`']]},
{note:'A patch is complete only when **datapatch** reports success. Opening an application before that is a common mistake.'}],
src:[['Datapatch',UG]]};

/* ---------- 4: Out-of-place and gold images ---------- */
L['ora-upg:1:4']={blocks:[
{p:'**Out-of-place patching** installs a **new patched home** next to the old one and switches the database to it.'},
{svg:oop},
{flow:['Create a gold image from a patched, tested home (or download a new base and apply RU)','Install the new home from the image on each host (`runInstaller` or `-applyRU` options)','Prepare: pre-checks, backups','Short outage: stop, switch `ORACLE_HOME`, start, `datapatch`','Keep the old home until stable, then remove']},
{code:`# gold image from an existing patched home
$ORACLE_HOME/runInstaller -createGoldImage -destinationLocation /stage/goldimages -silent

# new home from image
unzip db_home_19_24.zip -d /u01/app/oracle/product/19.0.0/dbhome_2
cd /u01/app/oracle/product/19.0.0/dbhome_2
./runInstaller -silent -responseFile ...   # check options in the install guide

# switch with the patch mode of AutoUpgrade (next lectures) or manually:
srvctl modify database -db orcl -oraclehome /u01/app/oracle/product/19.0.0/dbhome_2`},
{note:'Out-of-place is the recommended approach. The outage is the time to restart, plus datapatch, instead of the time to patch the files.'}],
src:[['Gold images and out-of-place patching',UG]]};

/* ---------- 5: Rollback ---------- */
L['ora-upg:1:5']={blocks:[
{p:'Plan the **rollback** before you apply. Know what you do if it fails.'},
{t:[['Situation','Action'],
['**OPatch apply fails midway**','Read the log. Often `opatch apply` can be rerun after fixing the cause, or `opatch rollback`.'],
['**Patched, then a functional problem**','`datapatch -rollback`, then `opatch rollback` (or switch back in out-of-place)'],
['**Datapatch fails**','Fix the cause from `sqlpatch` logs and rerun `datapatch -verbose`'],
['**Wrong patch applied**','Roll back by patch ID: `opatch rollback -id <patch>`'],
['**Complete failure**','Restore the home from backup, database from backup if needed']]},
{code:`# rollback of SQL changes first
$ORACLE_HOME/OPatch/datapatch -rollback <patch_id> -verbose   # if applicable
# then binaries (database down)
opatch rollback -id <patch_id>
# restart and re-run datapatch to confirm consistent state
$ORACLE_HOME/OPatch/datapatch -verbose`},
{h:'Troubleshooting'},
{ul:['`opatch` logs: `$ORACLE_HOME/cfgtoollogs/opatch`.','`opatch lsinventory` after a failure to see the state.','"Inventory corrupted" errors: check `oraInst.loc` and permissions.']},
{note:'With out-of-place patching, rollback is a **switch back** to the old home plus a datapatch rollback. It is the fastest rollback you can get.'}],
src:[['OPatch rollback',OP]]};

/* ---------- 6: AutoUpgrade patch mode ---------- */
L['ora-upg:1:6']={blocks:[
{p:'**AutoUpgrade** can also **patch**. It downloads the patches, builds the new home, patches, and switches the database. One tool and one config file.'},
{code:`# patch.cfg
global.global_log_dir=/u01/app/oracle/autoupgrade/log
global.keystore=/u01/app/oracle/autoupgrade/keystore
global.folder=/u01/app/oracle/autoupgrade/patches
patch1.source_home=/u01/app/oracle/product/19.0.0/dbhome_1
patch1.target_home=/u01/app/oracle/product/19.0.0/dbhome_2
patch1.sid=orcl
patch1.patch=RECOMMENDED

java -jar autoupgrade.jar -config patch.cfg -patch -mode deploy`},
{t:[['Phase','What AutoUpgrade does'],
['**Analyze**','Checks the source and the patches'],
['**Download**','Gets the patches (needs MOS credentials in a keystore)'],
['**Create home**','Installs the target home with the RU and one-offs'],
['**Deploy**','Switches the database and runs datapatch'],
['**Report**','Logs and a summary']]},
{note:'Parameter names can differ between AutoUpgrade versions. Download the latest `autoupgrade.jar` and read its documentation.'}],
src:[['AutoUpgrade',UG]]};

/* ---------- 7: Practical ---------- */
L['ora-upg:1:7']={blocks:[
{p:'**Patch a CDB out of place and roll back.** Use a test system.'},
{flow:['Record the starting patch level (`lspatches`, `DBA_REGISTRY_SQLPATCH`)','Create a new home from a gold image with the new RU','Run pre-checks and take a backup','Stop the database, switch the home, start, run `datapatch -verbose`','Verify patch level and PDBs, run the application test','Roll back: switch to the old home and run datapatch rollback','Record timing for each step']},
{code:`-- before
SELECT banner_full FROM v$version;
opatch lspatches

-- after switch
$ORACLE_HOME/OPatch/datapatch -verbose
SELECT patch_id, action, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 5 ROWS ONLY;
SELECT con_id, name, open_mode FROM v$pdbs;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['New RU applied','Visible in `lspatches` and SQL patch registry (SUCCESS)'],
['PDBs','All open, no errors'],
['Application test','Passes'],
['Rollback','Old release shown again, services running'],
['Outage time','Recorded for each phase']]},
{note:'The timings are your outage estimate for production. Add 50 percent margin to the plan.'}],
src:[['Patching',UG]]};

})();
