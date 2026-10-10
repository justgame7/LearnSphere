/* LearnSphere - Data Guard, Section 04: Creating a Physical Standby.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const dup=O.dg(700,190,[
[10,50,150,80,'Primary prod|running, open|(source)',0],[210,50,170,80,'RMAN DUPLICATE|FROM ACTIVE DATABASE|copies files over net',2],[430,50,150,80,'Standby stby|started NOMOUNT|(auxiliary)',0],[620,50,70,80,'Mount,|start apply',2],
[10,145,680,35,'No backup is needed first. The source stays open during the copy.',1]],
[[160,90,210,90],[380,90,430,90],[580,90,620,90]]);

/* ---------- 0: RMAN active duplicate ---------- */
L['ora-dg:3:0']={blocks:[
{p:'The most common way to create a standby is **RMAN active duplicate**. RMAN copies the running primary directly to the standby over the network, and sets up the standby control file and parameters.'},
{svg:dup},
{h:'Step 1: Prepare the standby instance'},
{code:`# On dbhost2, as oracle: a minimal parameter file
echo "db_name=orcl" > $ORACLE_HOME/dbs/initorcl.ora

export ORACLE_SID=orcl
sqlplus / as sysdba
STARTUP NOMOUNT PFILE='$ORACLE_HOME/dbs/initorcl.ora'`},
{h:'Step 2: Duplicate'},
{code:`rman target sys@prod auxiliary sys@stby

RMAN> DUPLICATE TARGET DATABASE
  FOR STANDBY
  FROM ACTIVE DATABASE
  DORECOVER
  SPFILE
    SET db_unique_name='stby'
    SET log_archive_dest_2='SERVICE=prod ASYNC VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=prod'
    SET fal_server='prod'
    SET db_file_name_convert='/u02/oradata/prod','/u02/oradata/stby'
    SET log_file_name_convert='/u02/oradata/prod','/u02/oradata/stby'
  NOFILENAMECHECK;`},
{t:[['Clause','Meaning'],
['`FOR STANDBY`','Create a standby database (not a copy with a new identity)'],
['`FROM ACTIVE DATABASE`','Copy from the running primary, no backup needed'],
['`DORECOVER`','Apply available archived logs after the copy'],
['`SPFILE ... SET`','Create an SPFILE on the standby with the parameters changed'],
['`NOFILENAMECHECK`','Do not stop if the files have the same names (different servers)']]},
{h:'Speed it up'},
{ul:['Run several RMAN channels (`CONFIGURE DEVICE TYPE DISK PARALLELISM 4`).','Use `SECTION SIZE` for big files so several channels share one file.','Use `USING COMPRESSED BACKUPSET` on a slow network (uses CPU).']},
{flow:['Start the standby instance NOMOUNT','Connect RMAN to primary and standby','Run DUPLICATE FOR STANDBY FROM ACTIVE DATABASE','RMAN copies files, restores the control file and mounts the standby']},
{note:'Do not enable `log_archive_dest_state_2` on the primary until the standby is mounted and ready. Then redo apply starts cleanly.'}],
src:[['Creating a physical standby',O.DG],['RMAN DUPLICATE',D+'bradv/']]};

/* ---------- 1: Backup-based ---------- */
L['ora-dg:3:1']={blocks:[
{p:'When the network is slow or the database is large, you can build the standby from a **backup** that you carry to the standby site.'},
{h:'On the primary'},
{code:`RMAN> BACKUP DATABASE PLUS ARCHIVELOG FORMAT '/backup/prod/%U';
RMAN> BACKUP CURRENT CONTROLFILE FOR STANDBY FORMAT '/backup/prod/stby_ctl_%U';
RMAN> BACKUP SPFILE FORMAT '/backup/prod/spfile_%U';

# Copy /backup/prod to the standby host (disk, tape, shared storage)`},
{h:'On the standby'},
{code:`# Standby instance started NOMOUNT, then:
rman auxiliary sys@stby

RMAN> DUPLICATE DATABASE FOR STANDBY
  SPFILE SET db_unique_name='stby'
  BACKUP LOCATION '/backup/prod'
  NOFILENAMECHECK;`},
{p:'Since 12c, RMAN can duplicate from a backup location without a connection to the primary.'},
{h:'Active vs backup-based'},
{t:[['','Active duplicate','Backup-based'],
['**Network**','Copies all data over the link','Only logs and a delta later'],
['**Load on the primary**','Reads all datafiles during the copy','Backup load happens when you choose'],
['**Setup**','Simple','More steps'],
['**Best for**','Good link, small and medium databases','Large databases, slow link, offline transfer']]},
{h:'After the restore'},
{flow:['The standby is restored to the point of the backup','Enable log shipping on the primary','Missing archived logs are fetched through FAL','Redo apply brings the standby up to date']},
{note:'A standby built from a backup needs all archived logs created since the backup. Keep them until the standby has caught up.'}],
src:[['Creating a standby from a backup',O.DG]]};

/* ---------- 2: Start apply ---------- */
L['ora-dg:3:2']={blocks:[
{p:'After the standby is built, enable transport and start redo apply. Then check that both sides agree.'},
{h:'Primary: enable the destination'},
{code:`ALTER SYSTEM SET log_archive_dest_state_2 = ENABLE SCOPE = BOTH;
ALTER SYSTEM SWITCH LOGFILE;`},
{h:'Standby: start apply'},
{code:`SELECT database_role, open_mode FROM v$database;      -- PHYSICAL STANDBY, MOUNTED

ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT FROM SESSION;`},
{h:'Verify'},
{code:`-- Standby
SELECT process, status, thread#, sequence# FROM v$managed_standby;
SELECT name, value FROM v$dataguard_stats WHERE name IN ('transport lag','apply lag');
SELECT MAX(sequence#) FROM v$archived_log WHERE applied = 'YES';

-- Primary
SELECT dest_id, status, error, gap_status FROM v$archive_dest_status WHERE dest_id = 2;
SELECT MAX(sequence#) FROM v$archived_log;`},
{t:[['Check','Healthy'],
['Standby role and mode','PHYSICAL STANDBY, MOUNTED'],
['MRP','APPLYING_LOG or WAIT_FOR_LOG'],
['Transport and apply lag','Seconds'],
['Primary destination 2','VALID, no error, GAP_STATUS NO GAP'],
['Latest applied sequence','Equal to or one behind the primary']]},
{flow:['Enable destination 2 on the primary','Start managed recovery on the standby','Switch a log on the primary','Watch it arrive and be applied']},
{note:'If lag does not fall to a few seconds, check the alert logs of both databases. The first error usually points to the cause.'}],
src:[['Starting redo apply',O.DG]]};

/* ---------- 3: CDB standby ---------- */
L['ora-dg:3:3']={blocks:[
{p:'In a multitenant database, Data Guard protects the whole **CDB**. The standby is a copy of the CDB, and **all its PDBs come with it**. You do not create a standby for each PDB.'},
{t:[['Aspect','What it means'],
['**Scope**','One standby for the CDB. Redo of the root and all PDBs is shipped together.'],
['**Role**','Roles belong to the CDB, not the PDB'],
['**PDBs on the standby**','Present with all data. Closed (MOUNTED), or open read only with Active Data Guard.'],
['**Create and drop PDBs**','Replicated by redo, with some rules (section 9)']]},
{h:'Check PDBs on the standby'},
{code:`-- Standby (mounted)
SELECT name, open_mode, recovery_status FROM v$pdbs;

-- With Active Data Guard: open for read only
ALTER DATABASE OPEN READ ONLY;
ALTER PLUGGABLE DATABASE ALL OPEN READ ONLY;`},
{h:'Excluding PDBs'},
{p:'You can choose which PDBs the standby maintains with the `ENABLED_PDBS_ON_STANDBY` parameter (default `*` for all) when you do not want a copy of every PDB.'},
{code:`ALTER SYSTEM SET enabled_pdbs_on_standby = 'PDB1,PDB2' SCOPE = BOTH;`},
{flow:['Duplicate the CDB as for a single database','All PDBs and their files are copied','Standby applies redo for root and PDBs','Open PDBs read only if you use Active Data Guard']},
{note:'A PDB that is excluded from the standby cannot be recovered by switching over. Exclude only PDBs where that is acceptable, such as test PDBs.'}],
src:[['Data Guard and multitenant',O.DG]]};

/* ---------- 4: ASM and Oracle Restart ---------- */
L['ora-dg:3:4']={blocks:[
{p:'Standbys often use **ASM**, and run under **Oracle Restart** so they come back by themselves after a reboot. A few settings are different.'},
{h:'Parameters for ASM and OMF'},
{code:`# On the standby
db_create_file_dest        = '+DATA'
db_recovery_file_dest      = '+FRA'
db_recovery_file_dest_size = 200G
# With OMF, file name convert parameters are usually not needed`},
{p:'The duplicate then creates files in `+DATA` automatically, with Oracle-managed names.'},
{h:'Register with Oracle Restart'},
{code:`srvctl add database -db stby -dbname orcl \\
  -oraclehome /u01/app/oracle/product/19.0.0/dbhome_1 \\
  -role PHYSICAL_STANDBY -startoption MOUNT \\
  -spfile +DATA/STBY/PARAMETERFILE/spfile.ora -diskgroup DATA,FRA
srvctl start database -db stby
srvctl config database -db stby`},
{t:[['Option','Meaning'],
['`-role PHYSICAL_STANDBY`','Start in standby mode'],
['`-startoption MOUNT`','Do not open it read write'],
['`-diskgroup`','Disk groups the database needs (start order)']]},
{h:'RAC standby'},
{p:'For a RAC standby, register all instances with `srvctl add instance`. Only **one** instance applies redo at a time. The others can be open read only with Active Data Guard.'},
{flow:['Set OMF parameters for ASM','Duplicate the database to the standby','Register it with srvctl with the standby role','Check that it restarts after a reboot']},
{note:'After a role change the resource role should follow. The broker updates the role of a clusterware-managed database, so you do not change it by hand.'}],
src:[['Standby on ASM',O.DG]]};

/* ---------- 5: Verify ---------- */
L['ora-dg:3:5']={blocks:[
{p:'A short set of queries tells you the state of any Data Guard configuration. Keep them in a script.'},
{t:[['Question','View','Healthy answer'],
['What role and mode is this database?','`V$DATABASE`','PRIMARY, or PHYSICAL STANDBY'],
['Is it ready for a switchover?','`V$DATABASE.SWITCHOVER_STATUS`','`TO STANDBY` on the primary, `NOT ALLOWED` or `TO PRIMARY` on a ready standby'],
['Are processes running?','`V$MANAGED_STANDBY` or `V$DATAGUARD_PROCESS`','MRP applying, RFS receiving'],
['How far behind is the standby?','`V$DATAGUARD_STATS`','Lag in seconds'],
['Is the destination healthy?','`V$ARCHIVE_DEST_STATUS`','VALID, no error'],
['Any warnings or errors?','`V$DATAGUARD_STATUS`','No recent errors'],
['Are SRLs present?','`V$STANDBY_LOG`','Present and sized correctly']]},
{code:`SELECT name, db_unique_name, database_role, open_mode, protection_mode, protection_level,
       switchover_status, force_logging, flashback_on FROM v$database;

SELECT dest_id, dest_name, status, target, archiver, error, gap_status
FROM   v$archive_dest_status WHERE status <> 'INACTIVE';

SELECT TO_CHAR(timestamp,'HH24:MI:SS') AS t, severity, message FROM v$dataguard_status
WHERE  timestamp > SYSDATE - 1/24 ORDER BY timestamp;`},
{h:'Alert logs'},
{p:'The alert logs of both databases show redo apply and transport messages. Search for `ORA-` and for words such as `Media Recovery` and `RFS`.'},
{flow:['Check role and switchover status','Check the processes','Check lag and gaps','Read recent Data Guard messages','Look at the alert log if something is off']},
{note:'The broker command `SHOW CONFIGURATION` and `VALIDATE DATABASE` (section 5) summarise most of this in one place.'}],
src:[['Monitoring Data Guard',O.DG]]};

/* ---------- 6: Practical ---------- */
L['ora-dg:3:6']={blocks:[
{p:'Build a physical standby from scratch with RMAN active duplicate. It uses the primary you prepared in section 3.'},
{h:'Steps'},
{flow:['Standby host: create a minimal init file and start the instance NOMOUNT','Run DUPLICATE FOR STANDBY FROM ACTIVE DATABASE','On the primary, enable log_archive_dest_state_2','On the standby, start managed recovery','Switch logs on the primary and verify']},
{h:'Commands'},
{code:`# 1. Standby host
echo "db_name=orcl" > $ORACLE_HOME/dbs/initorcl.ora
sqlplus / as sysdba <<EOF
STARTUP NOMOUNT PFILE='$ORACLE_HOME/dbs/initorcl.ora'
EOF

# 2. Duplicate (from the primary or standby host)
rman target sys@prod auxiliary sys@stby
RMAN> DUPLICATE TARGET DATABASE FOR STANDBY FROM ACTIVE DATABASE DORECOVER
  SPFILE SET db_unique_name='stby' SET fal_server='prod'
    SET log_archive_dest_2='SERVICE=prod ASYNC VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=prod'
  NOFILENAMECHECK;

-- 3. Primary
ALTER SYSTEM SET log_archive_dest_state_2 = ENABLE;
ALTER SYSTEM SWITCH LOGFILE;

-- 4. Standby
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT FROM SESSION;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['Standby `V$DATABASE`','PHYSICAL STANDBY, MOUNTED'],
['`V$MANAGED_STANDBY`','MRP in APPLYING_LOG or WAIT_FOR_LOG'],
['`V$DATAGUARD_STATS`','Lags of seconds'],
['Primary `V$ARCHIVE_DEST_STATUS` for dest 2','VALID, no error'],
['Latest sequence applied','Matches the primary']]},
{h:'Troubleshooting'},
{t:[['Symptom','Likely cause'],
['RMAN cannot connect to the auxiliary','Static listener missing, instance not started, wrong password file'],
['ORA-01017 on destination 2','Password files differ'],
['Gap does not close','FAL_SERVER wrong, archive logs removed on primary'],
['Apply stops with a missing file error','`STANDBY_FILE_MANAGEMENT` not AUTO or paths not converted']]},
{note:'Save the commands you used as a script. Rebuilding a standby is a task you will repeat in practice.'}],
src:[['Creating a physical standby',O.DG]]};

})();
