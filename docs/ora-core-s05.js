/* LearnSphere - Oracle Core DBA, Section 05: Instance Management & Parameters.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const stages=O.dg(700,190,[
[10,40,110,60,'SHUTDOWN|nothing running',0],[170,40,120,60,'NOMOUNT|instance started',2],[340,40,120,60,'MOUNT|control file open',2],[510,40,120,60,'OPEN|users connect',2],
[170,125,120,50,'reads SPFILE|allocates SGA|starts processes',0],[340,125,120,50,'reads control file|finds all files',0],[510,125,120,50,'opens datafiles|and redo logs',0]],
[[120,70,170,70],[290,70,340,70],[460,70,510,70],[230,100,230,125],[400,100,400,125],[570,100,570,125]]);

const mem=O.dg(700,190,[
[10,10,215,170,'Manual',1],[30,45,175,40,'db_cache_size|shared_pool_size ...',0],[30,100,175,40,'you tune every pool',0],
[245,10,215,170,'ASMM (recommended)',1],[265,45,175,40,'SGA_TARGET',2],[265,100,175,40,'PGA_AGGREGATE_TARGET',2],
[480,10,210,170,'AMM',1],[500,45,170,40,'MEMORY_TARGET',2],[500,100,170,40,'SGA and PGA together',0]],[]);

/* ---------- 0: Startup and shutdown ---------- */
L['ora-core:4:0']={blocks:[
{p:'Starting an Oracle database happens in **stages**. Each stage opens more of the system, and some admin tasks can only be done at a particular stage.'},
{svg:stages},
{h:'The three startup stages'},
{t:[['Stage','What happens','Tasks that need this stage'],
['**NOMOUNT**','Instance starts: SPFILE is read, SGA allocated, background processes started','Create a database, re-create the control file'],
['**MOUNT**','Control file is opened. Datafiles are known but not open.','Enable ARCHIVELOG, rename or move datafiles, full database recovery'],
['**OPEN**','Datafiles and redo logs open. Users can connect.','Normal operation']]},
{code:`-- One step
STARTUP

-- Or stage by stage
STARTUP NOMOUNT
ALTER DATABASE MOUNT;
ALTER DATABASE OPEN;

-- Check the state
SELECT instance_name, status, database_status FROM v$instance;`},
{h:'Shutdown modes'},
{t:[['Mode','New connections','Existing sessions','Next start'],
['`SHUTDOWN NORMAL`','Refused','Waits until every user disconnects','Clean'],
['`SHUTDOWN TRANSACTIONAL`','Refused','Waits for open transactions to end','Clean'],
['`SHUTDOWN IMMEDIATE`','Refused','Rolls back transactions and disconnects them','Clean'],
['`SHUTDOWN ABORT`','Refused','Killed immediately, no checkpoint','**Instance recovery needed**']]},
{flow:['Use SHUTDOWN IMMEDIATE as the normal choice','If a session will not end, wait a little, then investigate','Use ABORT only when nothing else works','After an ABORT, start up and check the alert log for recovery messages']},
{note:'Never use SHUTDOWN ABORT as routine. It is safe because of redo and undo, but recovery takes time and it hides the real problem. For a planned stop, use IMMEDIATE.'},
{h:'In a CDB'},
{p:'Shutting down the CDB closes all PDBs. A PDB can also be opened and closed on its own, as section 9 shows.'}],
src:[['Starting up a database',O.AD+'starting-up-and-shutting-down.html'],['Shutting down a database',O.AD+'starting-up-and-shutting-down.html']]};

/* ---------- 1: PFILE vs SPFILE ---------- */
L['ora-core:4:1']={blocks:[
{p:'Instance settings are stored in a **parameter file**. There are two kinds, and the difference decides whether your changes survive a restart.'},
{t:[['','PFILE','SPFILE'],
['**Format**','Text file, edit with any editor','Binary file, edit only with SQL'],
['**File name**','`init<SID>.ora`','`spfile<SID>.ora`'],
['**Changes with ALTER SYSTEM**','Do not persist','Can persist'],
['**Location**','`$ORACLE_HOME/dbs`','`$ORACLE_HOME/dbs`, or ASM'],
['**Use**','Emergencies and one-off starts','Normal operation']]},
{p:'At startup Oracle looks for `spfile<SID>.ora`, then `spfile.ora`, then `init<SID>.ora`. The first one found is used.'},
{h:'SCOPE: where a change goes'},
{t:[['SCOPE','Effect','Use for'],
['`MEMORY`','Current instance only. Lost at restart.','Quick test'],
['`SPFILE`','Saved for the next restart. No change now.','**Static** parameters'],
['`BOTH`','Now and after restart (default with an SPFILE)','Normal dynamic changes']]},
{code:`ALTER SYSTEM SET open_cursors = 500 SCOPE = BOTH;          -- dynamic
ALTER SYSTEM SET processes = 600 SCOPE = SPFILE;            -- static: restart needed
ALTER SYSTEM RESET open_cursors SCOPE = SPFILE;             -- go back to default`},
{h:'Is a parameter dynamic?'},
{code:`SELECT name, issys_modifiable FROM v$parameter WHERE name = 'processes';
-- IMMEDIATE = change now, DEFERRED = new sessions only, FALSE = restart needed`},
{h:'Create one from the other'},
{code:`CREATE PFILE = '/tmp/init_backup.ora' FROM SPFILE;   -- readable copy
CREATE SPFILE FROM PFILE = '/tmp/init_backup.ora';   -- after editing it

SHOW PARAMETER spfile       -- which one am I running with?`},
{flow:['Instance will not start after a bad change','Create a PFILE from the SPFILE (or use an old copy)','Edit the PFILE to fix the value','STARTUP PFILE with it','CREATE SPFILE FROM PFILE to make it permanent']},
{note:'Habit: before changing parameters, run CREATE PFILE FROM SPFILE. You keep a copy you can read and start from.'}],
src:[['Managing initialization parameters',O.AD+'creating-and-configuring-an-oracle-database.html'],['ALTER SYSTEM',D+'sqlrf/ALTER-SYSTEM.html']]};

/* ---------- 2: Parameters to know ---------- */
L['ora-core:4:2']={blocks:[
{p:'Oracle has hundreds of parameters. A DBA needs to know a small core set well. Everything else you look up.'},
{h:'Identity and compatibility'},
{t:[['Parameter','Meaning','Notes'],
['`DB_NAME`','Name of the database','Fixed at creation'],
['`DB_UNIQUE_NAME`','Unique name of this copy','Used with Data Guard'],
['`COMPATIBLE`','Release level the database behaves as','Can be raised, **never lowered**'],
['`ENABLE_PLUGGABLE_DATABASE`','TRUE for a CDB','Set by DBCA']]},
{h:'Memory and processes'},
{t:[['Parameter','Meaning'],
['`SGA_TARGET`, `SGA_MAX_SIZE`','Total SGA, and the ceiling it may be raised to'],
['`PGA_AGGREGATE_TARGET`, `PGA_AGGREGATE_LIMIT`','Soft target and hard limit for private memory'],
['`PROCESSES`','Maximum OS processes. `SESSIONS` is derived from it.'],
['`OPEN_CURSORS`','Maximum cursors one session may hold open'],
['`CPU_COUNT`','CPUs the instance uses']]},
{h:'Storage and recovery'},
{t:[['Parameter','Meaning'],
['`DB_BLOCK_SIZE`','Default block size, fixed at creation'],
['`CONTROL_FILES`','Locations of the control file copies'],
['`UNDO_TABLESPACE`, `UNDO_RETENTION`','Undo storage and how long to keep it'],
['`DB_RECOVERY_FILE_DEST`, `_SIZE`','Fast Recovery Area location and size'],
['`DB_CREATE_FILE_DEST`','Folder for Oracle Managed Files'],
['`LOG_ARCHIVE_DEST_1`','Where archived logs go']]},
{h:'Security and operation'},
{t:[['Parameter','Meaning'],
['`REMOTE_LOGIN_PASSWORDFILE`','EXCLUSIVE is the normal value'],
['`AUDIT_TRAIL`','Legacy audit setting (unified auditing is the modern way)'],
['`DIAGNOSTIC_DEST`','Base folder of the ADR'],
['`LOCAL_LISTENER`','Listener the instance registers with']]},
{code:`SHOW PARAMETER sga
SHOW PARAMETER processes

SELECT name, value, isdefault, issys_modifiable
FROM   v$parameter
WHERE  name IN ('compatible','open_cursors','processes','undo_retention');

-- What is stored in the SPFILE (not default values)
SELECT name, value FROM v$spparameter WHERE isspecified = 'TRUE';`},
{note:'Do not change parameters you do not understand because a blog told you to. Check the Reference guide for each one, test on a copy first, and write the change down.'}],
src:[['Database Reference: Initialization parameters',O.RF+'initialization-parameters.html']]};

/* ---------- 3: Automatic memory management ---------- */
L['ora-core:4:3']={blocks:[
{p:'Oracle can size its own memory. There are three levels of automation. Pick one and keep it.'},
{svg:mem},
{t:[['Mode','You set','Oracle manages','Notes'],
['**Manual**','Each pool size','Nothing','Full control but a lot of work'],
['**ASMM** (automatic shared memory management)','`SGA_TARGET` and `PGA_AGGREGATE_TARGET`','Sizes inside the SGA','**Recommended on Linux with HugePages**'],
['**AMM** (automatic memory management)','`MEMORY_TARGET`','SGA and PGA together','Needs a large `/dev/shm`. Not compatible with HugePages.']]},
{h:'How ASMM behaves'},
{flow:['You set SGA_TARGET to a total','Oracle splits it between cache, shared pool, large pool and so on','It moves memory to where it is needed as the workload changes','Parameters like DB_CACHE_SIZE become minimums if you set them']},
{code:`ALTER SYSTEM SET sga_max_size = 4G SCOPE = SPFILE;          -- ceiling, restart needed
ALTER SYSTEM SET sga_target = 3G SCOPE = BOTH;
ALTER SYSTEM SET pga_aggregate_target = 1G SCOPE = BOTH;
ALTER SYSTEM SET memory_target = 0 SCOPE = SPFILE;          -- turn AMM off`},
{h:'Advisors tell you if it is enough'},
{t:[['View','Shows'],
['`V$SGA_TARGET_ADVICE`','Effect of a bigger or smaller SGA'],
['`V$PGA_TARGET_ADVICE`','Effect of a bigger or smaller PGA'],
['`V$MEMORY_TARGET_ADVICE`','The same for AMM']]},
{h:'Which one for which case?'},
{ul:['**Production servers on Linux:** ASMM plus HugePages for stable, efficient memory.','**Small test systems:** AMM is the easiest.','**Special tuning:** manual, set minimums for important pools.']},
{note:'In a CDB, the memory settings are made at the CDB level. PDBs can have limits (covered in section 9), but they do not own memory.'}],
src:[['Managing memory',O.AD+'managing-memory.html']]};

/* ---------- 4: ADR ---------- */
L['ora-core:4:4']={blocks:[
{p:'When something goes wrong, the first place to look is the **alert log**. Oracle stores logs and traces in one structured place: the **Automatic Diagnostic Repository (ADR)**.'},
{h:'Where it is'},
{t:[['Term','Meaning','Example'],
['**ADR base**','Top folder, set by `DIAGNOSTIC_DEST`','`/u01/app/oracle`'],
['**ADR home**','Folder for one instance or listener','`.../diag/rdbms/orcl/ORCL`']]},
{h:'What is inside an ADR home'},
{t:[['Folder','Contents'],
['`trace`','Text alert log (`alert_<SID>.log`), trace files'],
['`alert`','The alert log in XML format'],
['`incident`','Files for serious errors, grouped by incident'],
['`cdump`','Core dump files'],
['`hm`','Health Monitor reports']]},
{h:'Find it from SQL'},
{code:`SELECT name, value FROM v$diag_info;`},
{p:'The row **Diag Trace** is the folder with the alert log. **Default Trace File** is the trace of your own session.'},
{h:'Reading the alert log'},
{code:`# Follow it live
tail -f /u01/app/oracle/diag/rdbms/orcl/ORCL/trace/alert_ORCL.log

# Last 100 lines
tail -100 alert_ORCL.log

# Search for errors
grep -n "ORA-" alert_ORCL.log | tail -20`},
{h:'What the alert log shows'},
{ul:['Startup and shutdown, with all non-default parameters','Log switches and checkpoints','ORA- errors and their trace file names','Structure changes: new datafiles, tablespaces']},
{flow:['Something fails','Read the alert log around that time','Find the ORA- error and the trace file it names','Open the trace for details','Look up the error in the docs or My Oracle Support']},
{note:'Section 14 goes deeper into ADRCI and incident packaging. For now: look at the alert log first, every time.'}],
src:[['Diagnosing and resolving problems',O.AD+'diagnosing-and-resolving-problems.html'],['V$DIAG_INFO',O.RF+'V-DIAG_INFO.html']]};

/* ---------- 5: Restricted, read-only, quiesce ---------- */
L['ora-core:4:5']={blocks:[
{p:'Sometimes you need the database open but for **DBAs only**, or open but **protected from changes**. Oracle has simple switches for this.'},
{t:[['Mode','Who can connect','Changes allowed?','Use for'],
['**Restricted session**','Only users with the RESTRICTED SESSION privilege','Yes, by those users','Maintenance, imports, upgrades'],
['**Read only**','Everyone allowed','No (apart from some system work)','Reporting copy, protecting data during a check'],
['**Quiesced**','DBAs only; other users wait','Only by DBAs','Rare maintenance (needs Resource Manager)']]},
{h:'Restricted mode'},
{code:`STARTUP RESTRICT

-- Or switch on and off while open
ALTER SYSTEM ENABLE RESTRICTED SESSION;
ALTER SYSTEM DISABLE RESTRICTED SESSION;

SELECT logins FROM v$instance;       -- ALLOWED or RESTRICTED`},
{p:'Normal users are refused with ORA-01035 while restricted mode is on. Sessions already connected stay connected.'},
{h:'Read-only database'},
{code:`SHUTDOWN IMMEDIATE
STARTUP MOUNT
ALTER DATABASE OPEN READ ONLY;

SELECT open_mode FROM v$database;    -- READ ONLY`},
{h:'Quiesce'},
{code:`ALTER SYSTEM QUIESCE RESTRICTED;
-- do the maintenance
ALTER SYSTEM UNQUIESCE;`},
{flow:['Plan the maintenance window','Tell users','Switch to restricted mode','Disconnect remaining sessions that should not stay','Do the work, check, and switch back']},
{note:'Always switch back and check `V$INSTANCE.LOGINS`. A database left in restricted mode looks healthy to monitoring but nobody can log in.'}],
src:[['Controlling access to the database',O.AD+'starting-up-and-shutting-down.html']]};

/* ---------- 6: Startup problems ---------- */
L['ora-core:4:6']={blocks:[
{p:'When a database will not start, the **stage** where it stops tells you which file is the problem. Read the alert log, then work from the stage.'},
{h:'Stage and likely cause'},
{t:[['Stops at','Typical error','Likely cause'],
['**NOMOUNT**','ORA-01078, LRM-00109','Bad or missing parameter file, wrong value'],
['**MOUNT**','ORA-00205, ORA-00210','Control file missing or damaged'],
['**OPEN**','ORA-01157, ORA-01110','Datafile missing or cannot be locked'],
['**OPEN**','ORA-01113','A datafile needs media recovery'],
['**OPEN**','ORA-00313, ORA-00312','Online redo log missing']]},
{flow:['STARTUP fails','Read the alert log for the first error','NOMOUNT failure: fix the parameter file','MOUNT failure: restore or use another control file copy','OPEN failure: restore the missing file and recover it']},
{h:'Common cases'},
{t:[['Error','Meaning','First step'],
['**ORA-01078**','Failure in processing system parameters','Read the LRM message above it. Start with a corrected PFILE.'],
['**ORA-00205**','Error identifying control file','Check `CONTROL_FILES` and the files exist and are readable by oracle.'],
['**ORA-01157**','Cannot identify or lock a datafile','See which file in the next line (ORA-01110). Restore it from backup.'],
['**ORA-01034**','Oracle not available','The instance is not running. Check `ORACLE_SID` and `ps -ef | grep pmon`.'],
['**ORA-27101**','Shared memory realm does not exist','Same: no instance for this SID, or wrong environment.']]},
{code:`# Which stage is the instance at?
SELECT status FROM v$instance;     -- STARTED, MOUNTED or OPEN

# Which files are missing?
SELECT file#, name, status FROM v$datafile;
SELECT * FROM v$recover_file;`},
{note:'Do not copy random files in to make the error go away. Restoring from backup is covered in the Backup and Recovery sub-course. Here you learn to find the cause quickly.'}],
src:[['Database Error Messages',O.ERR],['Troubleshooting startup',O.AD+'diagnosing-and-resolving-problems.html']]};

/* ---------- 7: Practical ---------- */
L['ora-core:4:7']={blocks:[
{p:'In this lab you change parameters, restart the instance, and fix a deliberate startup failure. Take a snapshot or copy your data volume first.'},
{h:'Task 1: Keep a readable copy'},
{code:`sqlplus / as sysdba
CREATE PFILE = '/tmp/init_good.ora' FROM SPFILE;
SHOW PARAMETER spfile`},
{h:'Task 2: Dynamic and static change'},
{code:`ALTER SYSTEM SET open_cursors = 400 SCOPE = BOTH;
SHOW PARAMETER open_cursors

SELECT name, issys_modifiable FROM v$parameter WHERE name = 'processes';
ALTER SYSTEM SET processes = 400 SCOPE = SPFILE;

SHUTDOWN IMMEDIATE
STARTUP
SHOW PARAMETER processes`},
{h:'Task 3: Break and fix'},
{flow:['Create a PFILE and add a line with an invalid parameter value','STARTUP PFILE with that file','Read the error and the alert log','Fix the value in the PFILE','Start with the corrected PFILE and re-create the SPFILE']},
{code:`-- Add the bad line (for example sga_target=abc) to /tmp/init_bad.ora, then:
STARTUP PFILE='/tmp/init_bad.ora'
-- ORA-01078 and LRM-00111 are expected

-- Fix the file and start again
STARTUP PFILE='/tmp/init_good.ora'
CREATE SPFILE FROM PFILE = '/tmp/init_good.ora';`},
{h:'Task 4: Find the alert log'},
{code:`SELECT value FROM v$diag_info WHERE name = 'Diag Trace';
-- then in the shell: tail -50 <that folder>/alert_<SID>.log`},
{h:'Check your results'},
{t:[['Check','Expected'],
['`open_cursors` after Task 2','400, and it stays after restart'],
['`processes` after restart','400'],
['Bad PFILE start','Fails with ORA-01078'],
['Alert log','Shows the parameter error and the startup that followed']]},
{note:'In the Free container the database lives inside a container. If the container itself stops when the instance stops, start it again with `podman start oradb` and then run STARTUP.'}],
src:[['Administrator Guide: parameters',O.AD+'creating-and-configuring-an-oracle-database.html']]};

})();
