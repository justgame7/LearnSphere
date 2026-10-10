/* LearnSphere - Upgrade, Patching & Migration, Section 04: Upgrading with AutoUpgrade.
   Lectures 0-7 are core, 8+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const UG26=O.D26+'upgrd/';
const UG=O.D+'upgrd/';

/* ---------- diagrams ---------- */
const arch=O.dg(700,200,[
[10,60,140,80,'autoupgrade.jar|(Java, one file)',2],
[200,60,130,80,'config file|source home,|target home, SID',0],
[380,20,150,60,'Job dispatcher|runs stages in order',0],
[380,110,150,60,'Logs and status|log dir, console',0],
[580,50,110,100,'Database|upgraded',2]],
[[150,100,200,100],[330,85,380,50],[330,115,380,140],[530,50,580,90]]);

const modes=O.dg(700,170,[
[10,45,140,80,'analyze|check only',0],
[190,45,140,80,'fixups|pre-upgrade|changes',0],
[370,45,140,80,'deploy|analyze, fixups,|upgrade, post',2],
[550,45,140,80,'upgrade|only the upgrade|stage',0]],
[[150,85,190,85],[330,85,370,85],[510,85,550,85]]);

/* ---------- 0: Architecture and config ---------- */
L['ora-upg:3:0']={blocks:[
{p:'**AutoUpgrade** is a single Java program. It reads a **config file** and runs a sequence of **stages** on each database. It handles analysis, fixes, upgrade, post-upgrade and the fallback.'},
{svg:arch},
{code:`# upgrade.cfg
global.global_log_dir=/u01/app/oracle/autoupgrade/log
global.keystore=/u01/app/oracle/autoupgrade/keystore

upg1.sid=orcl
upg1.source_home=/u01/app/oracle/product/19.0.0/dbhome_1
upg1.target_home=/u01/app/oracle/product/26.0.0/dbhome_1
upg1.log_dir=/u01/app/oracle/autoupgrade/orcl
upg1.start_time=NOW
upg1.restoration=yes
upg1.timezone_upg=yes`},
{t:[['Prefix / parameter','Meaning'],
['`global.*`','Settings for the whole run'],
['`upgN.*`','Settings for one database (N is a label)'],
['`source_home`, `target_home`','Old and new Oracle homes'],
['`sid` / `target_cdb`','The database, and the target CDB when converting'],
['`restoration`','Create a restore point for fallback'],
['`start_time`','When to run (NOW or a time)']]},
{note:'Always download the **latest** `autoupgrade.jar` from My Oracle Support. It is updated more often than the database.'}],
src:[['AutoUpgrade',UG26]]};

/* ---------- 1: Modes ---------- */
L['ora-upg:3:1']={blocks:[
{p:'AutoUpgrade has **modes** that run parts of the process, so you can do the safe parts early.'},
{svg:modes},
{t:[['Mode','What it does','Downtime?'],
['**analyze**','Checks source and target and writes a report','No'],
['**fixups**','Applies the pre-upgrade fixes to the source database','No (some need restart)'],
['**upgrade**','Upgrades the database (stops the source)','Yes'],
['**deploy**','Does all: analyze, fixups, upgrade, post-upgrade','Yes'],
['**postfixups**','Runs post-upgrade fixes after an upgrade','No']]},
{code:`java -jar autoupgrade.jar -config upgrade.cfg -mode analyze
java -jar autoupgrade.jar -config upgrade.cfg -mode fixups
java -jar autoupgrade.jar -config upgrade.cfg -mode deploy

# console: lsj (list jobs), status -job 100, tasks, abort -job 100`},
{note:'Do `analyze` and `fixups` days ahead. On the night, `deploy` has less to do and less to go wrong.'}],
src:[['AutoUpgrade modes',UG]]};

/* ---------- 2: Upgrade CDB ---------- */
L['ora-upg:3:2']={blocks:[
{p:'Upgrading a **CDB** upgrades the root, the seed and all PDBs in one operation.'},
{flow:['Prepare: analyze, fixups, backup, restore point','Stop applications, take the final backup','Start AutoUpgrade `deploy`','Root and seed are upgraded','PDBs are upgraded in parallel (as configured)','Post-upgrade: recompile, timezone, statistics, report']},
{code:`# restrict which PDBs
upg1.pdbs=pdb1,pdb2

# parallelism
upg1.parallel_pdb_upgrades=2

-- after
SELECT con_id, name, open_mode, restricted FROM v$pdbs;
SELECT comp_id, version, status FROM dba_registry ORDER BY comp_id;`},
{t:[['Point','Note'],
['**Order**','Root first, then PDBs'],
['**Parallel PDBs**','Faster, uses more CPU and I/O'],
['**Not upgraded PDBs**','Remain restricted until upgraded or plugged into a higher release'],
['**RAC**','AutoUpgrade handles single instance mode and restarts as RAC at the end (check version notes)']]},
{note:'Time grows with the number of **components** and PDBs. Do a full rehearsal on a copy to measure the real duration.'}],
src:[['Upgrading CDBs',UG]]};

/* ---------- 3: Non-CDB to PDB ---------- */
L['ora-upg:3:3']={blocks:[
{p:'26ai needs a CDB. AutoUpgrade can **upgrade and convert** a non-CDB to a PDB **in one run**. **[26ai]**'},
{svg:O.dg(700,180,[
[10,50,150,80,'19c non-CDB|ORCL',2],
[210,50,150,80,'AutoUpgrade|upgrade +|convert',0],
[410,10,130,60,'26ai CDB|CDB1',2],
[410,100,130,60,'New PDB|ORCL',2],
[590,50,100,80,'Application|connects to|service',0]],
[[160,90,210,90],[360,80,410,40],[360,100,410,130],[540,130,590,100]])},
{code:`# upgrade.cfg for non-CDB to PDB
upg1.sid=orcl
upg1.source_home=/u01/app/oracle/product/19.0.0/dbhome_1
upg1.target_home=/u01/app/oracle/product/26.0.0/dbhome_1
upg1.target_cdb=cdb1
upg1.target_pdb_name.orcl=orcl
upg1.target_pdb_copy_option.orcl=file_name_convert=NONE`},
{t:[['Choice','Meaning'],
['**Target CDB**','An existing 26ai CDB (target_cdb)'],
['**Copy option**','Plug in using the same files (NOCOPY), or copy files'],
['**Service names**','Create a service with the old name so applications keep working'],
['**Backup**','Restore point is not enough after the move. Plan a backup.']]},
{note:'The **same files** option is fastest but makes fallback harder. Choose it only with a verified backup.'}],
src:[['Non-CDB to PDB',UG26]]};

/* ---------- 4: Replay and unplug/plug ---------- */
L['ora-upg:3:4']={blocks:[
{p:'Two other approaches reduce downtime or risk.'},
{t:[['Method','Idea','Use'],
['**Unplug / plug upgrade**','Unplug a PDB from the old CDB, plug it into the new CDB, upgrade it there','Upgrade PDB by PDB, move PDBs at different times'],
['**Replay upgrade**','Upgrade a clone or standby (replay changes), then switch','Reduce the outage and keep the original untouched']]},
{flow:['New 26ai CDB exists and is patched','Close and unplug the PDB from the 19c CDB','Plug it in to the 26ai CDB (restricted)','Run AutoUpgrade for the PDB to upgrade it','Open the PDB, run post-upgrade checks']},
{code:`# AutoUpgrade for unplug/plug
upg1.source_home=/u01/app/oracle/product/19.0.0/dbhome_1
upg1.target_home=/u01/app/oracle/product/26.0.0/dbhome_1
upg1.sid=cdb19
upg1.pdbs=pdb1
upg1.target_cdb=cdb26`},
{h:'Pick'},
{ul:['**Whole CDB upgrade** when all PDBs move together.','**Unplug/plug** when PDBs have different schedules.','Data Guard rolling upgrade (a later sub-section) for near-zero downtime.']},
{note:'A PDB that is plugged into a higher release stays **restricted** until it is upgraded. Never open it for users in that state.'}],
src:[['Unplug and plug upgrade',UG]]};

/* ---------- 5: Post-upgrade ---------- */
L['ora-upg:3:5']={blocks:[
{p:'The upgrade is finished when **post-checks** pass. Do not skip them.'},
{t:[['Check','How'],
['**Components valid**','`SELECT comp_id, status FROM dba_registry;` all VALID'],
['**Invalid objects**','`utlrp.sql` and count of INVALID objects is lower than before'],
['**Time zone**','Upgrade time zone data if planned'],
['**Statistics**','Gather dictionary and fixed object statistics'],
['**Parameters**','Review new defaults, remove obsolete ones'],
['**Services and listener**','Application services start, TNS entries updated'],
['**Backups**','New full backup. RMAN catalog upgrade (`UPGRADE CATALOG`).'],
['**Compatible**','Raise later as a separate change'],
['**Monitoring and jobs**','Scheduled jobs, agents, monitoring point to the new home']]},
{code:`@?/rdbms/admin/utlrp.sql
SELECT COUNT(*) FROM dba_objects WHERE status=\'INVALID\';
EXEC DBMS_STATS.GATHER_DICTIONARY_STATS;
EXEC DBMS_STATS.GATHER_FIXED_OBJECTS_STATS;
SELECT * FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 5 ROWS ONLY;`},
{note:'Compare AWR for a normal day before and after. Performance regression is found by data, not by user complaints.'}],
src:[['Post-upgrade tasks',UG]]};

/* ---------- 6: Downgrade and rollback ---------- */
L['ora-upg:3:6']={blocks:[
{p:'Plan the **way back**. AutoUpgrade supports restoration, and Oracle supports downgrades within limits.'},
{t:[['Method','When','How'],
['**Restore point (flashback)**','Failure during or just after upgrade, before new data matters','AutoUpgrade `-restore -jobs <n>`, or flashback manually'],
['**Downgrade**','After some time on the new release, COMPATIBLE unchanged','Documented downgrade script and the old home'],
['**Restore from backup**','Anything else','RMAN restore into the old home'],
['**Keep a copy**','Zero-risk plan','Upgrade a clone, switch applications when verified']]},
{code:`# restore with AutoUpgrade (if restoration=yes)
java -jar autoupgrade.jar -config upgrade.cfg -restore -jobs 100`},
{h:'Limits of downgrade'},
{ul:['Not possible after `COMPATIBLE` is raised.','Components and data that depend on new features may block it.','Test the exact downgrade path first.']},
{note:'A fallback that loses a week of new data is no fallback for most businesses. Define the cut-off date after which you only go forward.'}],
src:[['Downgrade',UG]]};

/* ---------- 7: Practical ---------- */
L['ora-upg:3:7']={blocks:[
{p:'**Upgrade 19c to 26ai and convert a non-CDB.** Use a test 19c non-CDB and a prepared 26ai CDB.'},
{flow:['Take a backup and verify it','Run `analyze`, fix every error, run `fixups`','Run `deploy` with `target_cdb` and `target_pdb_name`','Watch the job with `lsj` and `status -job`','Run the post-upgrade checklist','Run the application smoke test','Test the fallback on a second copy']},
{code:`java -jar autoupgrade.jar -config upgrade.cfg -mode analyze
java -jar autoupgrade.jar -config upgrade.cfg -mode deploy

-- in the new CDB
SELECT name, open_mode, restricted FROM v$pdbs;
ALTER SESSION SET CONTAINER=orcl;
SELECT comp_id, version, status FROM dba_registry;
SELECT COUNT(*) FROM dba_objects WHERE status=\'INVALID\';`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`V$PDBS`','ORCL, READ WRITE, not restricted'],
['`DBA_REGISTRY`','All components VALID, version 26'],
['Invalid objects','Not more than before'],
['Application','Connects through a service and passes the smoke test'],
['Elapsed time','Recorded per phase']]},
{note:'The AutoUpgrade logs and report are your evidence. Store them with the change record.'}],
src:[['AutoUpgrade',UG26]]};

})();
