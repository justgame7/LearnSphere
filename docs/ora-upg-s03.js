/* LearnSphere - Upgrade, Patching & Migration, Section 03: Upgrade Planning & Compatibility.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const UG26=O.D26+'upgrd/';
const UG=O.D+'upgrd/';

/* ---------- diagrams ---------- */
const path=O.dg(700,180,[
[10,50,140,80,'19c|(19.x RU)|(non-CDB or CDB)',2],
[210,50,150,80,'Direct upgrade|AutoUpgrade',0],
[420,50,130,80,'26ai|(CDB only)',2],
[600,50,90,80,'PDBs|plugged in',0]],
[[150,90,210,90],[360,90,420,90],[550,90,600,90]]);

const fb=O.dg(700,190,[
[10,50,200,100,'Restore point|(guaranteed)|fast, same hardware',2],
[250,50,200,100,'Backup|always valid but slow',0],
[490,50,200,100,'Downgrade|limited by release,|COMPATIBLE unchanged',0]],[]);

/* ---------- 0: Supported paths ---------- */
L['ora-upg:2:0']={blocks:[
{p:'Check the **supported upgrade paths** for your source and target. For 26ai, 19c is a direct source.'},
{svg:path},
{t:[['Source','Target 26ai','Notes'],
['**19c** (supported RU)','**Direct**','Recommended path. Must meet minimum patch level.'],
['**21c**','Direct (check)','Innovation release. Check the guide.'],
['**18c, 12.2, 12.1, 11.2.0.4**','Upgrade to 19c first, then to 26ai','Or consider transport or Data Pump migration'],
['**Older than 11.2.0.4**','Migrate (export/import, GoldenGate)','No direct path']]},
{h:'Before you decide'},
{ul:['Read the **Upgrade Guide** for the target release and its "supported paths" table.','Check the minimum RU on the source.','Check platform: operating system version, hardware, 32-bit and 64-bit.','Check application and middleware certification.']},
{note:'Paths and minimum versions are stated in the Upgrade Guide and MOS notes. Always confirm in the release you target. **[26ai]**'}],
src:[['Upgrade Guide (26ai)',UG26],['Upgrade Guide (19c)',UG]]};

/* ---------- 1: Desupported features ---------- */
L['ora-upg:2:1']={blocks:[
{p:'A new release removes features. Check your use of each **before** you upgrade. **[26ai]**'},
{t:[['Area','Change','Action'],
['**Non-CDB architecture**','26ai supports only the multitenant architecture (CDB)','Convert non-CDBs to PDBs during upgrade'],
['**Grid Infrastructure Management Repository (GIMR)**','Removed or no longer required','Plan Clusterware without it (see RAC course)'],
['**Policy-managed RAC databases**','Not supported in newer releases','Move to administrator-managed'],
['**Old features**','Various deprecated parameters and views','Review the "Desupported" list'],
['**Deprecated features**','Still work, removal planned','Plan replacement'],
['**Oracle Net and client**','Old clients and protocols may be refused','Test client versions']]},
{code:`-- find non-CDB, and check deprecated parameters in use
SELECT name, cdb FROM v$database;
SELECT name FROM v$parameter WHERE isdeprecated=\'TRUE\' AND isdefault=\'FALSE\';`},
{h:'How to check'},
{ul:['Run the **AutoUpgrade analyze** mode (next lecture): it reports issues.','Read the "Changes" and "Desupported features" chapters of the target release.','Search your scripts for removed parameters.']},
{note:'Exact lists change per release. Treat this as a starting list, then check the current guide for your target.'}],
src:[['Desupported features (26ai)',UG26]]};

/* ---------- 2: Pre-upgrade analysis ---------- */
L['ora-upg:2:2']={blocks:[
{p:'**AutoUpgrade** replaces the old `preupgrade.jar` workflow. In **analyze** mode it checks the database and says what to fix.'},
{code:`# config.cfg
global.autoupg_log_dir=/u01/app/oracle/autoupgrade/log
upg1.source_home=/u01/app/oracle/product/19.0.0/dbhome_1
upg1.target_home=/u01/app/oracle/product/26.0.0/dbhome_1
upg1.sid=orcl
upg1.log_dir=/u01/app/oracle/autoupgrade/orcl
upg1.target_version=26

java -jar autoupgrade.jar -config config.cfg -mode analyze`},
{t:[['Report item','Meaning'],
['**Errors**','Must be fixed before upgrade'],
['**Warnings**','Review. May need action or acceptance.'],
['**Fixups**','Automatic changes done by AutoUpgrade at "fixups" or "deploy" mode'],
['**Manual**','Items you must do yourself, such as removing unsupported options']]},
{flow:['Run analyze','Read the HTML or text report','Fix errors and warnings','Rerun until clean','Plan the upgrade window']},
{note:'Run analyze **early** and repeatedly. It costs nothing and shows the size of the project in a day.'}],
src:[['AutoUpgrade analyze',UG]]};

/* ---------- 3: COMPATIBLE etc ---------- */
L['ora-upg:2:3']={blocks:[
{p:'Three settings need a decision **before** the upgrade and cannot be easily reversed.'},
{t:[['Setting','What it is','Decision'],
['**COMPATIBLE**','The release level whose features the database may use. Once raised, you cannot downgrade the database.','Keep the old value until the new release is proven, then raise (a separate change)'],
['**Time zone file**','Version of time zone rules used for TIMESTAMP WITH TIME ZONE','Upgrade time zone data in a planned step, check data using affected types'],
['**Character set**','How text is stored','26ai: AL32UTF8 is recommended. Convert separately with DMU or alternate methods.']]},
{code:`SELECT name, value FROM v$parameter WHERE name=\'compatible\';
SELECT * FROM v$timezone_file;
SELECT parameter, value FROM nls_database_parameters WHERE parameter LIKE \'NLS_CHARACTERSET\';`},
{h:'Typical sequence'},
{flow:['Upgrade the software and database with COMPATIBLE unchanged','Stabilise for a period (a few weeks)','Raise COMPATIBLE (point of no downgrade)','Upgrade time zone data if needed']},
{note:'Raising COMPATIBLE is the commitment point. Make it a separate, deliberate change after the new release has proven itself.'}],
src:[['COMPATIBLE and upgrade planning',UG]]};

/* ---------- 4: Fallback ---------- */
L['ora-upg:2:4']={blocks:[
{p:'Decide the **fallback** before you start. Each option has a different cost and a different limit.'},
{svg:fb},
{t:[['Option','Speed','Limit'],
['**Guaranteed restore point**','Fast','Must keep COMPATIBLE unchanged, and no data entered after upgrade is kept'],
['**Backup restore**','Slow','Always possible. Loses all changes after the backup.'],
['**Downgrade**','Medium','Only if COMPATIBLE unchanged, and not for all combinations'],
['**Keep old database (clone or standby)**','Instant switch','Needs space and a plan for changes made on the new one']]},
{code:`-- guaranteed restore point before upgrade (database must be in ARCHIVELOG)
CREATE RESTORE POINT before_upgrade GUARANTEE FLASHBACK DATABASE;
-- AutoUpgrade can create it for you with restoration=yes (default in deploy mode)
-- fallback:
SHUTDOWN IMMEDIATE
-- start with the old home, then
STARTUP MOUNT
FLASHBACK DATABASE TO RESTORE POINT before_upgrade;
ALTER DATABASE OPEN RESETLOGS;`},
{note:'Rehearse the fallback in the test upgrade. A rollback that was never practised is a hope, not a plan.'}],
src:[['Downgrade and fallback',UG]]};

/* ---------- 5: RAT and SPA ---------- */
L['ora-upg:2:5']={blocks:[
{p:'The biggest upgrade risk is **performance regression**. Use real workloads to test.'},
{t:[['Tool','What it does','Needs'],
['**SQL Performance Analyzer (SPA)**','Runs your SQL workload before and after, compares plans and times','Real Application Testing option'],
['**Database Replay**','Captures real production workload and replays it on the upgraded test copy','Real Application Testing option'],
['**SQL Plan Management**','Pins known good plans so plans do not regress','Included in Enterprise Edition'],
['**AWR Compare**','Compare periods before and after','Diagnostics Pack']]},
{flow:['Capture the workload in production (SQL tuning set or Replay capture)','Restore a copy of production on the new release','Replay or run SPA, compare','Fix regressions: statistics, SPM baselines, SQL tuning','Repeat until acceptable']},
{h:'Without RAT'},
{ul:['Use the SQL tuning set and a custom script of key queries.','Compare plans and timings with `DBMS_XPLAN` and AWR.']},
{note:'SPM baselines loaded **before** the upgrade keep old plans in place, and the optimizer proposes better ones for evolution after.'}],
src:[['Real Application Testing',O.D+'ratug/']]};

/* ---------- 6: Practical ---------- */
L['ora-upg:2:6']={blocks:[
{p:'**Analyze a 19c database for 26ai.** Use a test 19c database and the latest AutoUpgrade.'},
{code:`# 1. get AutoUpgrade
curl -o autoupgrade.jar https://download.oracle.com/otn-pub/otn_software/autoupgrade.jar   # check the current download page
java -jar autoupgrade.jar -version

# 2. sample config
java -jar autoupgrade.jar -create_sample_file config

# 3. edit, then analyze
java -jar autoupgrade.jar -config config.cfg -mode analyze`},
{h:'Fill this table from the report'},
{t:[['Item','Result'],
['Errors that stop the upgrade',''],
['Warnings to review',''],
['Automatic fixups',''],
['Manual actions',''],
['Non-CDB? (needs conversion)',''],
['Deprecated parameters in use',''],
['Time zone file version',''],
['COMPATIBLE value','']]},
{h:'Check your result'},
{ul:['You have a list of actions with an owner for each.','You know whether the database is a non-CDB and how to convert it.','You can estimate the effort for the real upgrade.']},
{note:'Run the same analysis on every database in the estate. The totals are your project plan.'}],
src:[['AutoUpgrade',UG26]]};

})();
