/* LearnSphere - Oracle Upgrade, Patching & Migration Quick Reference (cheat sheet).
   window.QREF['ora-upg'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Values are for Oracle Database 19c on Linux unless stated; 26ai items are marked [26ai].
   Support dates and patch cadence change: confirm on My Oracle Support (Doc ID 742060.1) and in the release Upgrade Guide. */
window.QREF=window.QREF||{};
window.QREF['ora-upg']={title:'Upgrade, Patching & Migration Quick Reference',blurb:'Patch types, tool commands, AutoUpgrade settings, views, errors and checklists on one page each.',hint:'datapatch or autoupgrade',pages:[

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
