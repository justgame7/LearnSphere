/* LearnSphere - Oracle Core DBA Quick Reference (cheat sheet).
   window.QREF['ora-core'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Blocks are the same as lessons: {h}, {p}, {t:[header,...rows]}, {code}, {note}, {ul}, {flow}.
   Values are for Oracle Database 19c on Linux unless stated; 26ai differences are marked. Check a setting on your own system with:
   SELECT name, value, isdefault, issys_modifiable FROM v$parameter WHERE name = '...'; */
window.QREF=window.QREF||{};
window.QREF['ora-core']={title:'Oracle Core DBA Quick Reference',blurb:'Processes, files, locations, logs, parameters, views, tools and fixes for a single Oracle database, one page each.',hint:'redo or listener',pages:[

/* 1 ---------------------------------------------------------------- processes */
{t:'Server processes',d:'The background processes of an instance, what each one does and where to look when it misbehaves.',see:[[2,3,'Background processes'],[2,5,'Dedicated vs shared server']],b:[
{t:[['Process','Job','Look here'],
['PMON','Cleans up after failed user processes: rolls back their transaction, releases locks','Alert log, `V$PROCESS`'],
['SMON','Instance recovery at startup, cleans temporary segments, coalesces free space','Alert log, `V$FAST_START_TRANSACTIONS`'],
['DBWn','Writes dirty buffers from the buffer cache to the datafiles','`V$SYSTEM_EVENT` (`free buffer waits`, `write complete waits`)'],
['LGWR','Writes the redo log buffer to the online redo logs (at commit, every 3 s, when 1/3 full)','`log file sync`, `log file parallel write`'],
['CKPT','Signals DBWn at a checkpoint and updates control file and datafile headers','`V$INSTANCE_RECOVERY`, alert log'],
['ARCn','Copies a filled online redo log to the archive destinations (ARCHIVELOG mode)','`V$ARCHIVE_DEST`, `V$ARCHIVED_LOG`'],
['MMON','Takes AWR snapshots, raises alerts, computes metrics','Alert log, `DBA_HIST_SNAPSHOT`'],
['MMNL','Writes ASH data and short-interval metrics','`V$ACTIVE_SESSION_HISTORY`'],
['MMAN','Manages automatic memory resizing (SGA_TARGET, MEMORY_TARGET)','`V$SGA_RESIZE_OPS`'],
['LREG','Registers services with the listener (replaced PMON for this job in 12c)','`lsnrctl services`'],
['VKTM','Virtual keeper of time, supplies the timer for the instance','Rarely needed'],
['DIAG, DIA0','Diagnostic dumps and hang detection','Trace files in the ADR'],
['RECO','Resolves in-doubt distributed transactions','`DBA_2PC_PENDING`'],
['CJQ0 / Jnnn','Job queue coordinator and job slaves for the scheduler','`DBA_SCHEDULER_JOB_RUN_DETAILS`'],
['SMCO / Wnnn','Space management coordinator and its workers (segment space, autoextend)','Alert log'],
['CTWR','Writes block change tracking data (incremental backups)','`V$BLOCK_CHANGE_TRACKING`'],
['RVWR','Writes flashback logs (when Flashback Database is on)','`V$FLASHBACK_DATABASE_LOG`'],
['Dnnn, Snnn','Dispatchers and shared servers (shared server architecture only)','`V$DISPATCHER`, `V$SHARED_SERVER`']]},
{note:'Every process name above can be listed with `SELECT name, description FROM v$bgprocess WHERE paddr <> HEXTORAW(\'00\')`. In a CDB there is one set of background processes for the whole container database, not one per PDB.'},
{code:`-- which background processes are running
SELECT pname, spid, program FROM v$process WHERE background = 1 ORDER BY pname;

# from the OS (pmon, smon and so on carry the instance name)
ps -ef | grep ora_ | grep -v grep`}
]},

/* 2 ---------------------------------------------------------------- files */
{t:'Database files and what they hold',d:'Every file a database depends on, whether it may be multiplexed and what happens when you lose it.',see:[[2,6,'Physical structures'],[7,3,'Control files']],b:[
{t:[['File','Contents','Lose it and...'],
['Datafile','Tables, indexes and undo (`DBA_DATA_FILES`, `V$DATAFILE`)','Restore and recover that file; the rest of the database may stay open'],
['Tempfile','Sort and hash spill space (`V$TEMPFILE`)','Nothing to restore: drop it and add a new tempfile'],
['Control file','Database name, DBID, file list, checkpoint SCNs, RMAN metadata (`V$CONTROLFILE`)','Instance stops; restore from a copy or autobackup and recover'],
['Online redo log','Changes not yet in datafiles (`V$LOG`, `V$LOGFILE`)','Loss of a current log means incomplete recovery, so multiplex'],
['Archived redo log','Copies of filled redo logs (`V$ARCHIVED_LOG`)','Gaps break media recovery and standbys; keep until backed up'],
['SPFILE','Binary parameter file, changed with `ALTER SYSTEM`','Start with a PFILE, recreate with `CREATE SPFILE FROM PFILE`'],
['PFILE (`init<SID>.ora`)','Text parameter file','Recreate from `V$PARAMETER`'],
['Password file (`orapw<SID>`)','Administrative users for remote SYSDBA connections','`orapwd` to recreate; OS authentication still works'],
['Block change tracking file','Changed block map for incremental backups','Disable and re-enable'],
['Flashback logs','Block pre-images in the FRA','Flashback Database stops working'],
['Wallet (`ewallet.p12`, `cwallet.sso`)','TDE master key','Encrypted data is unreadable without it']]},
{h:'Home and diagnostic directories'},
{t:[['Path (typical)','Meaning'],
['`$ORACLE_BASE`','Top of the Oracle tree (for example `/u01/app/oracle`)'],
['`$ORACLE_HOME`','The installed software (`.../product/19.0.0/dbhome_1`)'],
['`$ORACLE_HOME/dbs`','Default place for `spfile<SID>.ora`, `init<SID>.ora`, `orapw<SID>`'],
['`$ORACLE_HOME/network/admin`','`listener.ora`, `tnsnames.ora`, `sqlnet.ora` (or the `TNS_ADMIN` directory)'],
['`$ORACLE_BASE/diag/rdbms/<db>/<SID>`','The ADR home: `alert`, `trace`, `incident`, `cdump`'],
['`$ORACLE_BASE/oradata/<DB>` or `+DATA`','Datafiles, redo and control files'],
['`/etc/oratab`','List of local databases and homes'],
['`/etc/oraInst.loc`, `oraInventory`','Pointer to and content of the central inventory']]},
{note:'Multiplex control files and online redo logs on different disks. It costs almost nothing and removes the worst recovery scenarios.'}
]},

/* 3 ---------------------------------------------------------------- locations */
{t:'Locations by platform',d:'Where software, data, configuration and services usually live for each way of installing Oracle.',see:[[3,1,'OFA layout'],[3,5,'Starting automatically']],b:[
{t:[['Item','Linux (RPM or installer)','Windows','Container (Oracle AI Database Free)'],
['Software home','`/u01/app/oracle/product/19.0.0/dbhome_1`','`C:\\app\\oracle\\product\\19.0.0\\dbhome_1`','Inside the image (set by `ORACLE_HOME`)'],
['Data files','`/u01/app/oracle/oradata/<DB>`','`C:\\app\\oracle\\oradata\\<DB>`','A volume mounted on `/opt/oracle/oradata`'],
['Parameter file','`$ORACLE_HOME/dbs/spfile<SID>.ora`','`%ORACLE_HOME%\\database\\SPFILE<SID>.ORA`','`$ORACLE_HOME/dbs`'],
['Net configuration','`$ORACLE_HOME/network/admin`','`%ORACLE_HOME%\\network\\admin`','`$ORACLE_HOME/network/admin`'],
['Alert log','`$ORACLE_BASE/diag/rdbms/<db>/<SID>/trace/alert_<SID>.log`','Same under `%ORACLE_BASE%\\diag`','Same under `/opt/oracle/diag`'],
['Instance start at boot','`dbstart` with `/etc/oratab`, a systemd unit, or Oracle Restart','Windows service `OracleService<SID>`','Container entrypoint'],
['Listener service','`lsnrctl start`, systemd or Oracle Restart','`OracleOra...TNSListener`','Started by the container'],
['Default listener port','1521','1521','1521 (map it with `-p`)'],
['Environment','`~/.bash_profile`: `ORACLE_HOME`, `ORACLE_SID`, `PATH`','Registry and service','Image environment'],
['Inventory','`/etc/oraInst.loc` points to `oraInventory`','`C:\\Program Files\\Oracle\\Inventory`','n/a']]},
{note:'The exact paths depend on your OFA choices. Run `echo $ORACLE_HOME $ORACLE_BASE` and `SELECT name FROM v$datafile` to find out what your system really uses.'}
]},

/* 4 ---------------------------------------------------------------- logs */
{t:'Log files and where to find them',d:'Every log you may need during an incident, and how to locate it.',see:[[4,4,'ADR and diagnostic destinations'],[13,2,'Reading the alert log']],b:[
{t:[['Log','What it records','Where'],
['Alert log (text)','Startup, shutdown, ORA- errors, log switches, parameter changes, DDL for tablespaces and files','`$ORACLE_BASE/diag/rdbms/<db>/<SID>/trace/alert_<SID>.log`'],
['Alert log (XML)','The same, in XML for tools','`.../alert/log.xml`'],
['Trace files','Per-process detail and errors (`ora_<proc>_<pid>.trc`)','`.../trace/`'],
['Incident directories','Dumps and traces packaged for one error (`incdir_n`)','`.../incident/`'],
['Listener log','Connections, service registration, errors','`$ORACLE_BASE/diag/tnslsnr/<host>/listener/trace/listener.log`'],
['Audit trail','Unified audit records (`UNIFIED_AUDIT_TRAIL`) and OS audit files for SYS','Database, plus `$ORACLE_BASE/admin/<db>/adump`'],
['Install and DBCA logs','Software installation and database creation','`$ORACLE_BASE/cfgtoollogs`, `oraInventory/logs`'],
['Data Pump log','Export or import progress','The `LOGFILE=` name in the DIRECTORY object'],
['RMAN log','Backup and restore output','The `log=` file or the console']]},
{h:'Find them from SQL'},
{code:`SELECT name, value FROM v$diag_info;
SELECT value FROM v$diag_info WHERE name = 'Diag Trace';
SELECT value FROM v$diag_info WHERE name = 'Default Trace File';

-- recent alert log lines from SQL (19c)
SELECT originating_timestamp, message_text FROM v$diag_alert_ext
WHERE originating_timestamp > SYSTIMESTAMP - INTERVAL '1' HOUR ORDER BY 1;`},
{code:`# ADRCI
adrci
adrci> show home
adrci> set home diag/rdbms/orcl/ORCL
adrci> show alert -tail 50
adrci> show incident
adrci> ips pack incident 12345`}
]},

/* 5 ---------------------------------------------------------------- parameters */
{t:'Important parameters',d:'The initialization parameters a DBA changes most, with default, scope and a sensible starting point.',see:[[4,2,'Parameters every DBA must know'],[4,1,'PFILE vs SPFILE']],b:[
{t:[['Parameter','Default','Change takes effect','Note'],
['`db_name`','none (set at creation)','Restart; never change by hand','Use `nid` or recreate'],
['`db_unique_name`','= `db_name`','Restart','Must differ on every Data Guard member'],
['`compatible`','release default','Restart, one way','Raising it blocks downgrade'],
['`sga_target` / `sga_max_size`','0 (manual) or set by DBCA','Dynamic up to `sga_max_size`','Automatic shared memory management'],
['`pga_aggregate_target`','10 MB or 20% of SGA','Dynamic','Total target for work areas'],
['`pga_aggregate_limit`','larger of 2 GB, 200% of PGA target','Dynamic','Hard limit; sessions are terminated above it'],
['`memory_target`','0','Dynamic','Not usable with HugePages. Prefer `sga_target` on Linux.'],
['`processes`','derived from CPU count','Restart','`sessions` and `transactions` derive from it'],
['`sessions`','1.5 x processes + 22','Restart','Raise with `processes`'],
['`open_cursors`','50','Dynamic','Commonly 300 or more for applications'],
['`session_cached_cursors`','50','Dynamic (session or system)','Reduces soft parse cost'],
['`db_files`','200','Restart','Maximum datafiles'],
['`undo_tablespace`','set at creation','Dynamic','One per instance in RAC'],
['`undo_retention`','900 s','Dynamic','Must cover your longest query'],
['`db_recovery_file_dest` / `_size`','unset','Dynamic','Size first, then the location'],
['`log_archive_dest_n`','unset','Dynamic','Archive and standby destinations'],
['`db_create_file_dest`','unset','Dynamic','Enables Oracle Managed Files'],
['`control_files`','set at creation','Restart','Two or more copies'],
['`db_block_size`','8192','Fixed at creation','Cannot be changed later'],
['`audit_trail`','`DB` (when not unified-only)','Restart','Unified auditing is the standard in 19c and later'],
['`diagnostic_dest`','`$ORACLE_BASE`','Dynamic','Where the ADR lives'],
['`local_listener` / `remote_listener`','unset or default','Dynamic','Registration targets (SCAN in RAC)'],
['`enable_pluggable_database`','TRUE for CDBs','Fixed at creation','Cannot be turned off for a CDB'],
['`max_pdbs`','4098','Dynamic','Cap the number of PDBs'],
['`statistics_level`','`TYPICAL`','Dynamic','`BASIC` disables AWR data; do not use'],
['`optimizer_mode`','`ALL_ROWS`','Dynamic','Rarely changed'],
['`use_large_pages`','`TRUE`','Restart','`ONLY` fails startup if HugePages are short'],
['`filesystemio_options`','`NONE` (platform dependent)','Restart','`SETALL` on filesystems for direct and async I/O']]},
{code:`-- one parameter, with where it can be changed
SELECT name, value, isdefault, issys_modifiable, ispdb_modifiable
FROM v$parameter WHERE name = 'open_cursors';

ALTER SYSTEM SET open_cursors = 300 SCOPE = BOTH;
ALTER SYSTEM SET processes = 800 SCOPE = SPFILE;   -- needs restart`},
{note:'`SCOPE=BOTH` is the default only when the instance was started with an SPFILE. `SCOPE=SPFILE` for static parameters, then restart.'}
]},

/* 6 ---------------------------------------------------------------- views */
{t:'System views and functions',d:'Which view answers which question. V$ views show now, DBA_ views show definitions, CDB_ views span containers.',see:[[2,8,'Data dictionary and dynamic views'],[10,6,'Data dictionary queries']],b:[
{t:[['Question','View or function'],
['What is this instance and database?','`V$INSTANCE`, `V$DATABASE`, `V$VERSION`'],
['Which parameters are set?','`V$PARAMETER`, `V$SPPARAMETER`, `V$SYSTEM_PARAMETER`'],
['Who is connected and doing what?','`V$SESSION`, `V$PROCESS`, `V$TRANSACTION`'],
['Who blocks whom?','`V$SESSION.BLOCKING_SESSION`, `V$LOCK`, `DBA_BLOCKERS`, `DBA_WAITERS`'],
['What are sessions waiting on?','`V$SESSION`, `V$SYSTEM_EVENT`, `V$ACTIVE_SESSION_HISTORY`'],
['How big is the SGA and PGA?','`V$SGAINFO`, `V$SGASTAT`, `V$PGASTAT`, `V$MEMORY_DYNAMIC_COMPONENTS`'],
['Which datafiles and how full?','`DBA_DATA_FILES`, `DBA_FREE_SPACE`, `DBA_TABLESPACE_USAGE_METRICS`'],
['Tablespaces and segments','`DBA_TABLESPACES`, `DBA_SEGMENTS`, `DBA_EXTENTS`'],
['Undo and temp use','`V$UNDOSTAT`, `V$TEMPSEG_USAGE`, `V$SORT_SEGMENT`'],
['Redo and archiving','`V$LOG`, `V$LOGFILE`, `V$ARCHIVED_LOG`, `V$LOG_HISTORY`'],
['Fast Recovery Area space','`V$RECOVERY_FILE_DEST`, `V$RECOVERY_AREA_USAGE`'],
['Backups (RMAN)','`V$RMAN_BACKUP_JOB_DETAILS`, `V$BACKUP_SET`, `V$BACKUP_PIECE`'],
['Users, roles, privileges','`DBA_USERS`, `DBA_ROLE_PRIVS`, `DBA_SYS_PRIVS`, `DBA_TAB_PRIVS`'],
['Objects and invalid code','`DBA_OBJECTS` (filter on `STATUS`), `DBA_ERRORS`'],
['SQL statements and plans','`V$SQL`, `V$SQL_PLAN`, `DBMS_XPLAN.DISPLAY_CURSOR`'],
['Containers and PDBs','`V$CONTAINERS`, `V$PDBS`, `CDB_PDBS`, `CDB_USERS`'],
['Scheduler','`DBA_SCHEDULER_JOBS`, `DBA_SCHEDULER_JOB_RUN_DETAILS`'],
['Alerts and recommendations','`DBA_OUTSTANDING_ALERTS`, `DBA_ALERT_HISTORY`'],
['Which view exists?','`DICT`, `DICT_COLUMNS`, `V$FIXED_TABLE`']]},
{h:'Handy functions'},
{t:[['Call','Returns'],
['`SYS_CONTEXT(\'USERENV\',\'CON_NAME\')`','Current container name'],
['`SYS_CONTEXT(\'USERENV\',\'SESSION_USER\')`','Logged-in user'],
['`SYS_CONTEXT(\'USERENV\',\'SID\')`','Session ID'],
['`DBMS_UTILITY.GET_TIME`','Hundredths of a second counter'],
['`DBMS_METADATA.GET_DDL(\'TABLE\',\'T\',\'OWNER\')`','DDL of an object'],
['`TIMESTAMP_TO_SCN`, `SCN_TO_TIMESTAMP`','Convert between time and SCN']]},
{note:'In a CDB, `DBA_*` shows the current container only. Use `CDB_*` from the root for all containers, and always name the container in your script.'}
]},

/* 7 ---------------------------------------------------------------- tools */
{t:'Command-line tools',d:'Utilities that ship with the database, what each is for and a typical command.',see:[[1,3,'SQL*Plus, SQLcl and VS Code'],[11,1,'Data Pump']],b:[
{t:[['Tool','Use','Typical command'],
['`sqlplus`','Run SQL and scripts','`sqlplus / as sysdba`'],
['`sql` (SQLcl)','Modern SQL client with history and formatting','`sql system@//host:1521/pdb1`'],
['`lsnrctl`','Control the listener','`lsnrctl status`, `lsnrctl reload`'],
['`tnsping`','Test name resolution and listener reachability','`tnsping ORCL`'],
['`dbca`','Create, configure and delete databases','`dbca -silent -createDatabase ...`'],
['`netca`, `netmgr`','Configure Net Services','`netca -silent -responsefile ...`'],
['`rman`','Backup, restore, recover','`rman target /`'],
['`expdp`, `impdp`','Data Pump export and import','`expdp system schemas=app directory=dp_dir dumpfile=app.dmp`'],
['`sqlldr`','Load flat files','`sqlldr userid=app control=load.ctl`'],
['`adrci`','Browse the ADR, package incidents','`adrci exec="show alert -tail 20"`'],
['`orapwd`','Create a password file','`orapwd file=orapwORCL password=... format=12.2`'],
['`dbv`','Verify a datafile offline','`dbv file=users01.dbf`'],
['`tkprof`','Format SQL trace files','`tkprof in.trc out.txt sys=no`'],
['`opatch`','Apply and list patches','`opatch lspatches`'],
['`dbshut`, `dbstart`','Start and stop databases listed in `oratab`','`dbstart $ORACLE_HOME`'],
['`srvctl`, `crsctl`','Oracle Restart or Clusterware control','See the RAC reference']]},
{h:'Start, stop and connect in SQL*Plus'},
{code:`sqlplus / as sysdba
SQL> STARTUP                 -- NOMOUNT, MOUNT, OPEN
SQL> SHUTDOWN IMMEDIATE
SQL> ALTER SESSION SET CONTAINER = pdb1;
SQL> SHOW CON_NAME
SQL> ALTER PLUGGABLE DATABASE pdb1 OPEN;

sqlplus app_user@//dbhost:1521/pdb1`}
]},

/* 8 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'Shutdown modes, startup stages, parameter scope, PDB open modes and which connection to use.',see:[[4,0,'Startup and shutdown'],[8,4,'Opening and closing PDBs']],b:[
{h:'Shutdown modes'},
{t:[['Mode','New connections','Waits for sessions','Rolls back','Needs recovery at start'],
['`NORMAL`','No','Yes, until they disconnect','n/a','No'],
['`TRANSACTIONAL`','No','Until transactions finish','Active transactions complete','No'],
['`IMMEDIATE`','No','No','Yes, then disconnects','No'],
['`ABORT`','No','No','No','**Yes**, instance recovery']]},
{h:'Startup stages'},
{t:[['Stage','What is open','Typical use'],
['`NOMOUNT`','Instance only (parameter file read, memory and processes started)','Create a database, restore a control file'],
['`MOUNT`','Control file read','Rename files, enable ARCHIVELOG, restore and recover datafiles'],
['`OPEN`','Datafiles and redo online','Normal operation'],
['`OPEN READ ONLY`','Datafiles read only','Reporting, standby']]},
{h:'Parameter change scope'},
{t:[['I want...','Use'],
['Change now and keep after restart','`ALTER SYSTEM SET p=v SCOPE=BOTH`'],
['Change only after the next restart','`SCOPE=SPFILE`'],
['Change now, forget at restart','`SCOPE=MEMORY`'],
['Change for one session only','`ALTER SESSION SET p=v`'],
['Different value per PDB','Set it in the PDB (if `ISPDB_MODIFIABLE`)']]},
{h:'PDB open modes'},
{t:[['Mode','Meaning'],
['`MOUNTED`','Closed. Not available to users'],
['`READ WRITE`','Normal use'],
['`READ ONLY`','Queries only'],
['`MIGRATE`','Upgrade mode (`OPEN UPGRADE`)'],
['`RESTRICTED`','Only users with `RESTRICTED SESSION`']]},
{h:'Dedicated or shared server?'},
{t:[['Choose dedicated when','Choose shared when'],
['OLTP with few hundreds of sessions, long-running queries, batch, DBA connections','Thousands of mostly idle sessions where memory per session is the limit']]}
]},

/* 9 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, the likely cause and the fix.',see:[[13,0,'A troubleshooting method'],[13,3,'Common ORA errors']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['Cannot connect, ORA-12541','`lsnrctl status`','Listener not running','`lsnrctl start`'],
['ORA-12514 at connect','`lsnrctl services`, `SHOW PARAMETER service_names`','Service not registered','`ALTER SYSTEM REGISTER`, check `local_listener`'],
['ORA-12154','`tnsnames.ora`, `TNS_ADMIN`, `tnsping`','Alias missing or wrong file used','Fix the alias, or use EZConnect'],
['Instance will not start, ORA-00205 / 00210','Alert log, `control_files`','Control file missing or wrong path','Restore from a copy, fix the parameter'],
['Startup stops at MOUNT with ORA-01157 / 01110','Which file is named','Datafile missing or damaged','Restore and recover the file'],
['Everyone hangs at commit','`V$SYSTEM_EVENT`, alert log','Archive destination or FRA full (ORA-00257)','Free or extend space, back up logs'],
['ORA-01555','`V$UNDOSTAT`, long query','Undo overwritten too soon','Raise `undo_retention`, enlarge undo, fix the query'],
['ORA-01652','`V$TEMPSEG_USAGE`','Temp full','Find the SQL, add tempfile'],
['ORA-01653 / 01654','`DBA_FREE_SPACE`','Tablespace out of space','Add datafile or enable autoextend'],
['ORA-00018 / 00020','`V$RESOURCE_LIMIT`','`sessions` or `processes` exhausted','Find leaks, raise `processes`, restart'],
['ORA-04031','`V$SHARED_POOL_ADVICE`, literals','Shared pool fragmentation or too many literals','Bind variables, size pool'],
['ORA-00054','Who holds the lock','DDL while table in use','Retry, use `DDL_LOCK_TIMEOUT`'],
['ORA-01031','Privileges, role enabled by default?','Missing privilege','Grant a role or privilege'],
['Slow right now','`V$SESSION`, ASH, `V$SQL`','Blocker, bad plan, resource shortage','Section on performance; start with waits'],
['PDB shows MOUNTED after restart','`SELECT * FROM dba_pdb_saved_states`','State not saved','`ALTER PLUGGABLE DATABASE ... SAVE STATE`'],
['Account locked','`DBA_USERS.ACCOUNT_STATUS`','Failed logins or profile','`ALTER USER x ACCOUNT UNLOCK`']]}
]},

/* 10 ---------------------------------------------------------------- errors */
{t:'Common error messages',d:'The messages you will see most, with the usual cause and the fix.',see:[[13,3,'Common ORA errors'],[5,5,'Net troubleshooting']],b:[
{t:[['Error','Meaning','Usual cause','Fix'],
['ORA-00600','Internal error','Software defect or corruption','Open a Service Request with the ADR incident package'],
['ORA-07445','Exception in the OS','Software defect','Same as ORA-00600'],
['ORA-00942','Table or view does not exist','Wrong name, schema or privilege','Check owner and grants'],
['ORA-00001','Unique constraint violated','Duplicate key','Fix the data or the constraint'],
['ORA-01017','Invalid username or password','Wrong credentials, case or verifier','Reset password, check client version'],
['ORA-28000','Account is locked','Too many failures','Unlock the account'],
['ORA-28001','Password has expired','Profile `PASSWORD_LIFE_TIME`','Change the password'],
['ORA-01034','Oracle not available','Instance down or wrong SID','Start the instance; check `ORACLE_SID`'],
['ORA-01033','Initialization or shutdown in progress','Instance is starting or stopping','Wait or finish opening'],
['ORA-01109','Database not open','MOUNT or NOMOUNT','`ALTER DATABASE OPEN`'],
['ORA-01113 / 01110','File needs media recovery / names the file','Restored old file','`RECOVER` the file'],
['ORA-00257','Archiver error','Archive destination full','Free space, back up and delete logs'],
['ORA-19809 / 19815','FRA limit exceeded / about to be full','FRA too small or not cleaned','Raise size, back up and delete obsolete'],
['ORA-01653','Cannot extend table','Tablespace full','Add space'],
['ORA-01922 etc.','CASCADE required','Dropping a user that owns objects','`DROP USER x CASCADE`'],
['ORA-65040','Operation not allowed from a PDB','Run in the wrong container','Switch container'],
['ORA-65096','Invalid common user or role name','Missing `C##` prefix','Use the prefix or create locally'],
['ORA-12545','Connect failed, target host not found','Name or listener address wrong','Check host and port'],
['ORA-12170','TNS connect timeout','Network or firewall','Check route and firewall'],
['ORA-03113','End-of-file on communication channel','Server process died or network cut','Alert log and trace of the server process'],
['ORA-00604 / 00604+','Error at recursive SQL level','Often shows another error below','Read the second error in the stack']]},
{note:'Read the whole error stack. The error on top is the last one raised, and the cause is often the line below it.'}
]},

/* 11 ---------------------------------------------------------------- health check */
{t:'Health-check SQL pack',d:'Paste-ready queries for the daily and weekly checks, grouped by what you check.',see:[[13,4,'Monitoring sessions and locks'],[14,5,'Daily, weekly and monthly routines']],b:[
{h:'Instance and database'},
{code:`SELECT instance_name, status, database_status, startup_time FROM v$instance;
SELECT name, open_mode, log_mode, database_role, cdb FROM v$database;
SELECT con_id, name, open_mode, restricted FROM v$pdbs;`},
{h:'Space'},
{code:`-- tablespace usage including autoextend headroom
SELECT tablespace_name, ROUND(used_percent,1) pct_used
FROM dba_tablespace_usage_metrics ORDER BY 2 DESC;

-- FRA use
SELECT name, ROUND(space_used/1024/1024/1024,1) used_gb,
       ROUND(space_limit/1024/1024/1024,1) limit_gb,
       ROUND(space_reclaimable/1024/1024/1024,1) reclaimable_gb
FROM v$recovery_file_dest;`},
{h:'Sessions and locks'},
{code:`SELECT status, COUNT(*) FROM v$session WHERE type = 'USER' GROUP BY status;

SELECT sid, serial#, username, event, blocking_session, seconds_in_wait, sql_id
FROM v$session WHERE blocking_session IS NOT NULL;

SELECT resource_name, current_utilization, max_utilization, limit_value
FROM v$resource_limit WHERE resource_name IN ('processes','sessions','transactions');`},
{h:'Backups and archiving'},
{code:`SELECT MAX(end_time) last_backup, status FROM v$rman_backup_job_details GROUP BY status;
SELECT sequence#, first_time, applied FROM v$archived_log ORDER BY sequence# DESC FETCH FIRST 5 ROWS ONLY;`},
{h:'Invalid objects and failed jobs'},
{code:`SELECT owner, object_type, COUNT(*) FROM dba_objects WHERE status = 'INVALID' GROUP BY owner, object_type;
SELECT job_name, status, actual_start_date, additional_info
FROM dba_scheduler_job_run_details WHERE status <> 'SUCCEEDED' AND log_date > SYSDATE - 1;`},
{h:'Alerts'},
{code:`SELECT creation_time, object_name, reason FROM dba_outstanding_alerts ORDER BY creation_time DESC;`}
]},

/* 12 ---------------------------------------------------------------- naming decoder */
{t:'Naming decoder',d:'How to read the names, numbers and IDs you meet in files, logs and views.',see:[[2,6,'Physical structures'],[3,4,'Post-installation and environment']],b:[
{t:[['Thing','Looks like','Meaning'],
['SID','`ORCL`','Instance name on one host; part of file names and `ORACLE_SID`'],
['`db_name`','`ORCL`','Name of the database, up to 8 characters; stored in the control file'],
['`db_unique_name`','`orcl_site1`','Name that distinguishes databases with the same `db_name` (Data Guard)'],
['Service name','`pdb1.example.com`','What clients connect to; each PDB has a default service'],
['DBID','`1507283716`','Numeric identity of the database; needed for RMAN restore without a repository'],
['SCN','`2317845`','System change number, the database clock'],
['OMF datafile','`+DATA/ORCL/DATAFILE/users.259.1100000001` or `o1_mf_users_k9x2zz4w_.dbf`','Oracle Managed Files name'],
['Archived log','`1_245_1100000001.arc`','Format `%t_%s_%r`: thread, sequence, resetlogs ID'],
['Redo log group','`redo01.log`','Online redo member; groups and members are numbered'],
['Trace file','`ORCL_ora_12345.trc`','Instance, process type and OS PID'],
['Incident','`incdir_4711`','One diagnostic incident in the ADR'],
['ROWID','`AAAWcjAAHAAAAbKAAA`','Object, file, block, row (base-64)'],
['CON_ID','0, 1, 2, 3...','0 = whole CDB, 1 = root, 2 = seed, 3 and up = PDBs'],
['`C##` prefix','`C##ADMIN`','Common user or role created in the root'],
['Wait event','`db file sequential read`','Name of what a session waits for'],
['Sample schema','`HR`, `SH`, `OE`','Oracle sample data, not for production']]},
{code:`-- a ROWID decoded
SELECT rowid, DBMS_ROWID.ROWID_OBJECT(rowid) obj, DBMS_ROWID.ROWID_RELATIVE_FNO(rowid) fno,
       DBMS_ROWID.ROWID_BLOCK_NUMBER(rowid) blk FROM hr.employees WHERE ROWNUM = 1;`}
]},

/* 13 ---------------------------------------------------------------- OS settings */
{t:'OS settings',d:'Kernel parameters, limits and system settings that matter on a Linux database server.',see:[[3,0,'Planning and kernel parameters'],[3,2,'Installing software']],b:[
{t:[['Setting','Typical value','Why'],
['`fs.file-max`','6815744 or higher','Maximum open files system-wide'],
['`fs.aio-max-nr`','1048576','Asynchronous I/O requests'],
['`kernel.shmmax`, `kernel.shmall`','Half of RAM / RAM in pages (or higher)','Shared memory for the SGA'],
['`kernel.sem`','`250 32000 100 128`','Semaphores for processes'],
['`kernel.panic_on_oops`','1','Reboot on kernel errors'],
['`net.ipv4.ip_local_port_range`','`9000 65500`','Ephemeral ports'],
['`net.core.rmem_max`, `wmem_max`','4194304 / 1048576','Network buffers'],
['`vm.swappiness`','1 to 10','Avoid swapping the SGA'],
['`vm.nr_hugepages`','SGA size / 2 MB, plus margin','HugePages for the SGA'],
['Transparent Huge Pages','`never`','Causes latency and memory problems'],
['`oracle` limits: `nofile`, `nproc`, `stack`, `memlock`','`nofile 65536`, `nproc 16384`, `stack 10240`, `memlock` > SGA','Set in `/etc/security/limits.d`'],
['SELinux','`permissive` or `enforcing` with policies','Check install notes of your release'],
['Firewall','Allow 1521 from clients only','Do not leave the listener open to all'],
['Time sync','`chronyd` running','Clusters, auditing and logs need accurate time']]},
{code:`# the preinstall package sets most of the kernel and limit values for you
dnf install -y oracle-database-preinstall-19c

# check HugePages
grep -i huge /proc/meminfo
cat /sys/kernel/mm/transparent_hugepage/enabled`},
{note:'Values above are common starting points. The installation guide of your exact release is authoritative, and the `oracle-database-preinstall` package applies them for supported Oracle Linux and RHEL-compatible systems.'}
]},

/* 14 ---------------------------------------------------------------- versions */
{t:'Releases and support',d:'The releases you will meet and what each one means. Dates change, so always confirm on My Oracle Support.',see:[[0,2,'Releases and support'],[0,3,'Editions and licensing']],b:[
{t:[['Release','Type','Notes'],
['19c (19.x)','Long-Term Release','The most widely used release. Supports both non-CDB and CDB.'],
['21c','Innovation Release','Short support period. Not a long-term target.'],
['23ai','Innovation Release (first AI release)','New features; the long-term successor was 26ai.'],
['26ai (26.x)','Long-Term Release','CDB (multitenant) only. Non-CDB architecture is desupported.']]},
{h:'Terms'},
{t:[['Term','Meaning'],
['Release Update (RU)','Quarterly bundle of fixes (security, bugs, regressions)'],
['One-off patch','A fix for one bug'],
['Premier / Extended / Sustaining Support','Support levels; a release moves through them'],
['COMPATIBLE','The feature level of the database, raised only after upgrade is proven']]},
{note:'Support end dates are in the Lifetime Support Policy and in My Oracle Support Doc ID 742060.1. This page does not repeat them, because they change.'}
]}

]};
