/* LearnSphere - Backup & Recovery, Section 08: Duplication, Cloning & Transport.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const BR=O.D+'bradv/';

/* ---------- diagrams ---------- */
const dup=O.dg(700,210,[
[10,50,150,90,'Source|(target)|production',2],
[270,10,170,60,'Active: copy over the|network from the source',0],
[270,120,170,60,'Backup-based: from|backup pieces',0],
[540,50,150,90,'Auxiliary|new database|(duplicate)',2]],
[[160,80,270,40],[160,110,270,150],[440,40,540,80],[440,150,540,110]]);

/* ---------- 0: Why duplicate ---------- */
L['ora-bkp:7:0']={blocks:[
{p:'**Duplication** creates a **separate copy** of a database, with its own DBID. It is built from backups or straight from the running source.'},
{t:[['Use','Why'],
['**Test / development**','A realistic copy of production'],
['**Reporting**','A copy refreshed daily for heavy queries'],
['**Upgrade rehearsal**','Test the upgrade on a real copy'],
['**Standby database**','`DUPLICATE ... FOR STANDBY` creates a Data Guard standby'],
['**Restore test**','Proves that your backups can rebuild a database'],
['**Point-in-time copy**','A copy as of yesterday to investigate or extract data']]},
{h:'Options compared'},
{t:[['Method','New DBID','Source load','Use'],
['**RMAN DUPLICATE**','Yes','Low (backup-based) or some (active)','Test, upgrade rehearsal'],
['**Data Pump**','n/a (logical)','Moderate','Part of the data'],
['**Storage snapshot / clone**','Same, rename','None','Large databases with proper storage'],
['**PDB clone**','n/a','Low','CDB environments']]},
{note:'Mask or remove sensitive data from non-production copies. A copy of production is production data in a less protected place.'}],
src:[['Duplicating databases',BR]]};

/* ---------- 1: Active vs backup-based ---------- */
L['ora-bkp:7:1']={blocks:[
{p:'RMAN `DUPLICATE` has two main modes.'},
{svg:dup},
{t:[['','Active duplication','Backup-based duplication'],
['**Source**','Running source database, copy through the network','Existing backups in a shared location'],
['**Source impact**','Reads data files, uses network','None'],
['**Needs**','Network between source and target, same SYS password','Backups and logs accessible'],
['**Speed**','Parallel channels and sections','Depends on backup location'],
['**Good for**','No recent backup, fresh copy','Production protection, restore test']]},
{code:`-- active
DUPLICATE TARGET DATABASE TO testdb
  FROM ACTIVE DATABASE
  SPFILE SET db_unique_name=\'testdb\'
  NOFILENAMECHECK;

-- backup-based
DUPLICATE DATABASE TO testdb
  BACKUP LOCATION \'/backup/prod\'
  NOFILENAMECHECK;`},
{note:'A backup-based duplicate from production backups is the best restore test: it proves the backups work and puts no load on production.'}],
src:[['DUPLICATE',BR]]};

/* ---------- 2: Prepare auxiliary ---------- */
L['ora-bkp:7:2']={blocks:[
{p:'Prepare the **auxiliary instance** on the destination host before running the command.'},
{flow:['Install the same Oracle software release on the destination','Create a minimal init file with db_name (the new name)','Create a password file with the same SYS password (for active)','Add listener and TNS entries for the auxiliary','Start the instance in NOMOUNT','Make backups reachable (for backup-based)','Create directories for datafiles and logs']},
{code:`# initTESTDB.ora
db_name=testdb
db_unique_name=testdb
db_create_file_dest=\'/u02/oradata\'
db_create_online_log_dest_1=\'/u02/oradata\'
sga_target=2G

export ORACLE_SID=testdb
sqlplus / as sysdba
STARTUP NOMOUNT PFILE=\'/tmp/initTESTDB.ora\';

rman target sys@prod auxiliary sys@testdb`},
{t:[['Rename','Use'],
['`DB_FILE_NAME_CONVERT`','Map old to new paths'],
['`SET NEWNAME`','Per file'],
['`db_create_file_dest`','OMF puts files for you']]},
{note:'The new database must have a **different name** from the source if it uses the same listener or the same host. A clash is the most common first error.'}],
src:[['Preparing the auxiliary',BR]]};

/* ---------- 3: Duplicating DB and PDB ---------- */
L['ora-bkp:7:3']={blocks:[
{p:'Run the duplicate. RMAN restores, recovers, creates a new control file, and opens with `RESETLOGS` and a **new DBID**.'},
{code:`-- whole database to a point in time
DUPLICATE DATABASE TO testdb
  UNTIL TIME "TO_DATE(\'2026-10-01 06:00:00\',\'YYYY-MM-DD HH24:MI:SS\')"
  BACKUP LOCATION \'/backup/prod\'
  NOFILENAMECHECK;

-- skip tablespaces you do not need
DUPLICATE TARGET DATABASE TO testdb FROM ACTIVE DATABASE
  SKIP TABLESPACE big_archive_ts;

-- one PDB into a new CDB
DUPLICATE DATABASE TO newcdb PLUGGABLE DATABASE pdb1;`},
{t:[['Option','Effect'],
['`UNTIL TIME / SCN`','Point-in-time copy'],
['`SKIP TABLESPACE`','Leave out data that is not needed'],
['`PLUGGABLE DATABASE`','Only the listed PDBs (with the root and seed)'],
['`FOR STANDBY`','Create a standby instead of a new database']]},
{h:'After duplication'},
{ul:['Change anything that points to production: database links, jobs, UTL_MAIL, external endpoints.','Mask sensitive data.','Change passwords that differ from production.','Disable scheduler jobs that should not run.']},
{note:'A copy that is still wired to production can send mails to customers or push data back. Disable external integrations first.'}],
src:[['DUPLICATE options',BR]]};

/* ---------- 4: TSPITR ---------- */
L['ora-bkp:7:4']={blocks:[
{p:'**Tablespace point-in-time recovery (TSPITR)** returns one or a few tablespaces to the past while the rest of the database continues. Use it when only a subset needs to be recovered.'},
{code:`RECOVER TABLESPACE users, indexes
  UNTIL TIME "TO_DATE(\'2026-10-01 10:30:00\',\'YYYY-MM-DD HH24:MI:SS\')"
  AUXILIARY DESTINATION \'/u03/aux\';`},
{flow:['RMAN checks that the tablespace set is self-contained','Creates an auxiliary instance in the destination','Restores system, undo and the chosen tablespaces there','Recovers to the target time','Exports metadata and plugs the tablespaces back with transportable tablespace','Takes the tablespaces online. A new backup is needed.']},
{h:'Limits'},
{ul:['The tablespace set must be self-contained: no references to objects outside.','You lose changes made since the target time in those tablespaces.','Space is needed for the auxiliary files.']},
{note:'Check dependencies with `TRANSPORT_SET_CHECK`. Tables with foreign keys or indexes in other tablespaces must be included.'}],
src:[['Tablespace point-in-time recovery',BR]]};

/* ---------- 5: Recover table ---------- */
L['ora-bkp:7:5']={blocks:[
{p:'Since 12c, RMAN can recover **a table** (or partitions) from backups to a past time, without touching the rest of the database.'},
{code:`RECOVER TABLE app.orders
  UNTIL TIME "TO_DATE(\'2026-10-01 10:30:00\',\'YYYY-MM-DD HH24:MI:SS\')"
  AUXILIARY DESTINATION \'/u03/aux\'
  REMAP TABLE app.orders:orders_recovered;

-- only export a dump file
RECOVER TABLE app.orders UNTIL SCN 1234567
  AUXILIARY DESTINATION \'/u03/aux\'
  DATAPUMP DESTINATION \'/u03/dp\'
  DUMP FILE \'orders.dmp\' NOTABLEIMPORT;`},
{t:[['Option','Effect'],
['`REMAP TABLE`','Import under another name, so production is untouched'],
['`NOTABLEIMPORT`','Only create the dump file'],
['`AUXILIARY DESTINATION`','Where the temporary instance is built']]},
{h:'Compare the options'},
{t:[['Need','Tool'],
['A few rows, recent','Flashback Query'],
['One table, recent','Flashback Table'],
['One table, old','**RECOVER TABLE**'],
['A group of tablespaces','TSPITR'],
['Whole database','Incomplete recovery or Flashback Database']]},
{note:'Table recovery builds a temporary database, so it needs time and disk. For recent mistakes, Flashback is much cheaper.'}],
src:[['RECOVER TABLE',BR]]};

/* ---------- 6: Practical ---------- */
L['ora-bkp:7:6']={blocks:[
{p:'**Duplicate** production into a test database from backups, using a second instance.'},
{code:`# on the test host
export ORACLE_SID=testdb
sqlplus / as sysdba
STARTUP NOMOUNT PFILE=\'/tmp/initTESTDB.ora\';
EXIT

rman target sys@prod auxiliary sys@testdb
RUN {
  DUPLICATE TARGET DATABASE TO testdb
    FROM ACTIVE DATABASE
    SPFILE SET db_unique_name=\'testdb\'
    NOFILENAMECHECK;
}`},
{h:'After it finishes'},
{code:`SELECT name, dbid, open_mode FROM v$database;
SELECT COUNT(*) FROM app.orders;
SELECT * FROM dba_db_links;
SELECT job_name, enabled FROM dba_scheduler_jobs WHERE enabled=\'TRUE\';`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`V$DATABASE.DBID`','Different from production'],
['Row counts','Match the source at the copy time'],
['Database links','Reviewed and changed'],
['Scheduler jobs','Disabled where needed'],
['Alert log','No errors']]},
{note:'Write the steps as a script. A refreshable test database is one of the most useful routine tasks for a DBA.'}],
src:[['Duplicating a database',BR]]};

})();
