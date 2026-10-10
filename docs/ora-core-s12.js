/* LearnSphere - Oracle Core DBA, Section 12: Moving Data.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const dp=O.dg(700,230,[
[10,85,120,60,'expdp / impdp|client commands',0],
[180,10,330,210,'Database server',1],
[200,45,140,60,'Master process|controls the job|master table',2],[360,45,130,60,'Worker processes|read and write|data in parallel',2],
[200,130,290,70,'Directory object DP_DIR|points to a folder on the server',0],
[560,85,130,60,'Dump files|.dmp and log',0]],
[[130,115,200,75],[340,75,360,75],[345,105,345,130],[490,165,560,125]]);

const mvs=O.dg(700,120,[
[10,30,130,60,'Source PDB|schema SHOP',0],[180,30,130,60,'expdp|writes dump file',2],[350,30,130,60,'Dump file|shop_01.dmp',0],[520,30,170,60,'impdp into target PDB|with REMAP if needed',2]],
[[140,60,180,60],[310,60,350,60],[480,60,520,60]]);

/* ---------- 0: Options compared ---------- */
L['ora-core:11:0']={blocks:[
{p:'Moving data is a daily task: refresh a test database, copy a schema, load a file, migrate to a new server. Oracle has several tools, and picking the right one saves hours.'},
{h:'The tools'},
{t:[['Tool','What it does','Best for'],
['**Data Pump** (`expdp`, `impdp`)','Exports and imports objects and data through server-side dump files','Moving schemas, tables or a whole database. The default choice.'],
['**SQL*Loader**','Loads rows from text files into tables','Large flat-file loads'],
['**External tables**','Lets SQL read a file as if it were a table','Loading with SQL, transform while you load'],
['**Transportable tablespaces**','Copies datafiles and moves only the metadata','Very large data, minimal downtime'],
['**Database link**','Query or copy rows from another database','Small and medium copies, `INSERT ... SELECT`'],
['**PDB clone or unplug/plug**','Copies a whole PDB','Moving a complete application database'],
['**GoldenGate**','Replicates changes continuously','Near zero downtime migrations (separate sub-course)']]},
{h:'How to choose'},
{flow:['A whole PDB or application database? Clone or unplug and plug','A schema or a few tables? Data Pump','A text or CSV file? SQL*Loader or an external table','Huge data and short downtime? Transportable tablespaces','Must stay in sync during the move? GoldenGate']},
{h:'Logical vs physical'},
{t:[['','Logical (Data Pump, SQL*Loader)','Physical (clone, transportable)'],
['**What moves**','Rows and object definitions','Datafiles'],
['**Across versions or platforms**','Works well','More limited'],
['**Speed for huge data**','Slower','Fast'],
['**Reorganises data**','Yes, it rebuilds objects','No']]},
{note:'The old exp and imp utilities are desupported for normal use. Use Data Pump.'}],
src:[['Utilities guide',D+'sutil/'],['Moving data',D+'admin/']]};

/* ---------- 1: Data Pump architecture ---------- */
L['ora-core:11:1']={blocks:[
{p:'**Data Pump** runs **on the database server**. The `expdp` and `impdp` programs only send commands. The real work, and the files, are on the server.'},
{svg:dp},
{h:'The parts'},
{t:[['Part','Job'],
['**expdp / impdp**','Client programs that start and watch a job'],
['**Master process (DMnn)**','Controls the job and records it in a **master table**'],
['**Worker processes (DWnn)**','Do the reading, writing and parallel loading'],
['**Directory object**','A database name for a folder on the server where files live'],
['**Dump file set**','Binary `.dmp` files in the directory']]},
{h:'Directory objects'},
{p:'Dump files are read and written only through a **directory object**, never through a raw path. The user needs privileges on it.'},
{code:`CREATE DIRECTORY dp_dir AS '/u03/dpdump';
GRANT READ, WRITE ON DIRECTORY dp_dir TO shop;

SELECT directory_name, directory_path FROM dba_directories;`},
{p:'Oracle also has a default directory named `DATA_PUMP_DIR`. The folder must exist on the server and be writable by the `oracle` OS user.'},
{h:'Who may run it'},
{t:[['Task','Needs'],
['Export your own schema','`CREATE SESSION` and access to the directory'],
['Export other schemas or everything','The role `DATAPUMP_EXP_FULL_DATABASE`'],
['Import other schemas or everything','The role `DATAPUMP_IMP_FULL_DATABASE`']]},
{flow:['The client connects and starts the job','The master process creates its control table','Workers write data in parallel to dump files','The log file records every step','The master table is removed when the job ends']},
{note:'Because files are on the server, you must copy them yourself to move data to another server (scp or shared storage).'}],
src:[['Data Pump overview',D+'sutil/oracle-data-pump-overview.html']]};

/* ---------- 2: Export and import ---------- */
L['ora-core:11:2']={blocks:[
{p:'You choose **what** to export with a mode. Then you import into a database that may already have part of the data.'},
{h:'Export modes'},
{t:[['Mode','Parameter','Exports'],
['**Full**','`FULL=Y`','The whole database (needs a full role)'],
['**Schema**','`SCHEMAS=shop,hr`','All objects of the schemas'],
['**Table**','`TABLES=shop.orders`','Chosen tables'],
['**Tablespace**','`TABLESPACES=app_data`','Tables in those tablespaces']]},
{code:`# Schema export, parallel, with a log
expdp system@//localhost:1521/FREEPDB1 \\
  schemas=shop directory=dp_dir dumpfile=shop_%U.dmp logfile=shop_exp.log \\
  parallel=2 flashback_time=systimestamp

# Metadata only (structure, no rows)
expdp system@//localhost:1521/FREEPDB1 schemas=shop directory=dp_dir dumpfile=shop_meta.dmp content=metadata_only`},
{t:[['Parameter','Meaning'],
['`DUMPFILE=name_%U.dmp`','`%U` makes several numbered files, needed for parallel'],
['`CONTENT`','`ALL`, `METADATA_ONLY` or `DATA_ONLY`'],
['`FLASHBACK_TIME` or `FLASHBACK_SCN`','Gives a consistent export as of one moment'],
['`PARALLEL`','Number of workers'],
['`REUSE_DUMPFILES=Y`','Overwrite existing dump files']]},
{h:'Import'},
{code:`impdp system@//localhost:1521/FREEPDB1 \\
  schemas=shop directory=dp_dir dumpfile=shop_%U.dmp logfile=shop_imp.log \\
  table_exists_action=replace`},
{t:[['TABLE_EXISTS_ACTION','What happens when a table already exists'],
['`SKIP` (default)','The table is left alone'],
['`APPEND`','Rows are added'],
['`TRUNCATE`','Existing rows are removed, then loaded'],
['`REPLACE`','The table is dropped and re-created']]},
{note:'An export without FLASHBACK_TIME or FLASHBACK_SCN is not guaranteed consistent between tables. For a clean copy of changing data, always add one of them. Use a parameter file (`parfile=`) to avoid shell quoting problems.'}],
src:[['Data Pump Export',D+'sutil/oracle-data-pump-export.html'],['Data Pump Import',D+'sutil/oracle-data-pump-import.html']]};

/* ---------- 3: PDBs and network mode ---------- */
L['ora-core:11:3']={blocks:[
{p:'In a CDB, Data Pump works **per PDB**. You connect to the PDB service, and the directory object must exist **inside that PDB**.'},
{h:'Rules for PDBs'},
{t:[['Rule','Why'],
['Connect with the PDB **service name**','Connecting to the root exports the root, not your data'],
['Create the directory object **in the PDB**','Each PDB has its own directory objects'],
['Use a local user with the Data Pump roles, or SYSTEM of the PDB','A common user can also work but must be in the PDB container']]},
{code:`ALTER SESSION SET CONTAINER = FREEPDB1;
CREATE DIRECTORY dp_dir AS '/opt/oracle/dpdump';
GRANT READ, WRITE ON DIRECTORY dp_dir TO system;

expdp system@//localhost:1521/FREEPDB1 schemas=shop directory=dp_dir dumpfile=shop.dmp`},
{h:'Network mode: no dump file'},
{p:'With `NETWORK_LINK`, impdp reads the data **straight from the source database over a database link** and writes it into the target. There is no dump file and no copying of files.'},
{code:`-- In the target PDB
CREATE DATABASE LINK src_link CONNECT TO system IDENTIFIED BY ChooseAPassword1 USING '//sourcehost:1521/PDB1';

impdp system@//localhost:1521/FREEPDB2 \\
  network_link=src_link schemas=shop directory=dp_dir logfile=net_imp.log`},
{flow:['Target creates a link to the source','impdp pulls data over the link','Rows go directly into the target tables','Only a log file is written']},
{h:'Between versions'},
{t:[['Situation','Use'],
['Export from a newer version and import into an older one','`VERSION=19` on the export'],
['Same version, same platform','No special parameters'],
['Different endianness, huge data','Transportable tablespaces']]},
{note:'Network mode is convenient for small and medium schemas. For very large data, dump files with parallelism and compression are often faster and easier to restart.'}],
src:[['Data Pump in a multitenant environment',D+'sutil/oracle-data-pump-overview.html'],['NETWORK_LINK',D+'sutil/oracle-data-pump-import.html']]};

/* ---------- 4: Remap and filter ---------- */
L['ora-core:11:4']={blocks:[
{p:'Real moves rarely copy everything unchanged. You rename schemas, move to other tablespaces, skip objects and filter rows. Data Pump has parameters for all of this.'},
{h:'Remap (rename on import)'},
{t:[['Parameter','Does'],
['`REMAP_SCHEMA=shop:shop_test`','Imports objects of SHOP into SHOP_TEST'],
['`REMAP_TABLESPACE=app_data:users`','Changes the target tablespace'],
['`REMAP_TABLE=orders:orders_copy`','Renames a table'],
['`REMAP_DATAFILE`','Changes datafile paths in definitions']]},
{code:`impdp system@//localhost:1521/FREEPDB2 directory=dp_dir dumpfile=shop_%U.dmp \\
  remap_schema=shop:shop_test remap_tablespace=shop_data:users`},
{h:'Filter (choose what to include)'},
{t:[['Parameter','Example'],
['`EXCLUDE`','`EXCLUDE=STATISTICS`, `EXCLUDE=INDEX`, `EXCLUDE=TABLE:"IN (\'LOG\')"`'],
['`INCLUDE`','`INCLUDE=TABLE:"LIKE \'ORD%\'"`'],
['`QUERY`','`QUERY=shop.orders:"WHERE id < 1000"`'],
['`SAMPLE`','`SAMPLE=10` exports about 10 percent of rows']]},
{p:'Quotes cause trouble in shells. Put these parameters in a **parameter file** and run `expdp ... parfile=shop.par`.'},
{code:`# shop.par
schemas=shop
directory=dp_dir
dumpfile=shop_%U.dmp
logfile=shop_exp.log
exclude=statistics
query=shop.orders:"WHERE order_date > SYSDATE - 90"`},
{h:'See the SQL without running it'},
{code:`impdp system@//localhost:1521/FREEPDB2 directory=dp_dir dumpfile=shop_%U.dmp sqlfile=shop_ddl.sql`},
{p:'`SQLFILE` writes the DDL that import **would** run to a file and loads nothing. It is a good way to review a migration.'},
{flow:['Export with filters if you only need part','Import with REMAP to match the target layout','Use SQLFILE to review the DDL first','Run the import and check the log']},
{note:'Excluding statistics and gathering new ones after the import is often faster and gives better plans than importing old statistics.'}],
src:[['Data Pump parameters',D+'sutil/oracle-data-pump-import.html']]};

/* ---------- 5: SQL*Loader and external tables ---------- */
L['ora-core:11:5']={blocks:[
{p:'Text files such as CSV come from other systems. Oracle can load them with **SQL*Loader** or read them as an **external table**.'},
{h:'SQL*Loader'},
{p:'A **control file** describes the data file and the target table.'},
{code:`-- load.ctl
LOAD DATA
INFILE 'customers.csv'
APPEND INTO TABLE shop.customers
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
TRAILING NULLCOLS
(email, status)

# Run it
sqlldr userid=shop@//localhost:1521/FREEPDB1 control=load.ctl log=load.log bad=load.bad direct=true`},
{t:[['Output file','Content'],
['**Log file**','What happened and counts'],
['**Bad file**','Rows rejected by Oracle or by the control file'],
['**Discard file**','Rows that did not match a condition']]},
{p:'`DIRECT=TRUE` (direct path) is faster for large loads. In 12c and later, **express mode** can load a CSV with one command: `sqlldr shop table=customers`.'},
{h:'External tables'},
{p:'An external table is a table definition over a file. You then use SQL on it.'},
{code:`CREATE DIRECTORY ext_dir AS '/u03/incoming';

CREATE TABLE shop.customers_ext (email VARCHAR2(100), status VARCHAR2(10))
ORGANIZATION EXTERNAL (
  TYPE ORACLE_LOADER
  DEFAULT DIRECTORY ext_dir
  ACCESS PARAMETERS (RECORDS DELIMITED BY NEWLINE FIELDS TERMINATED BY ',')
  LOCATION ('customers.csv')
) REJECT LIMIT UNLIMITED;

INSERT /*+ APPEND */ INTO shop.customers SELECT email, status FROM shop.customers_ext;`},
{t:[['','SQL*Loader','External table'],
['**How**','Separate client tool','SQL inside the database'],
['**Transform while loading**','Limited','Full SQL'],
['**File location**','Client or server','Server directory only'],
['**Best for**','Big, simple loads','Loads with joins, filters and conversions']]},
{note:'Both methods reject bad rows rather than stopping, so always read the log and bad file. A load that completes with errors is still a load that completed.'}],
src:[['SQL*Loader',D+'sutil/oracle-sql-loader.html'],['External tables',O.AD+'managing-tables.html']]};

/* ---------- 6: Monitoring Data Pump ---------- */
L['ora-core:11:6']={blocks:[
{p:'Data Pump jobs run on the server and keep running if your terminal closes. You can **attach** to a running job, pause it, and restart it later.'},
{h:'See running jobs'},
{code:`SELECT owner_name, job_name, operation, job_mode, state FROM dba_datapump_jobs;

SELECT sid, opname, ROUND(sofar/totalwork*100) AS pct
FROM   v$session_longops WHERE opname LIKE '%EXPORT%' OR opname LIKE '%IMPORT%';`},
{h:'Attach and control'},
{code:`expdp system@//localhost:1521/FREEPDB1 attach=SYS_EXPORT_SCHEMA_01

Export> STATUS
Export> STOP_JOB=IMMEDIATE
Export> START_JOB
Export> PARALLEL=4
Export> KILL_JOB`},
{t:[['Command','Effect'],
['`STATUS`','Show progress'],
['`STOP_JOB`','Stop, keep the job so it can restart'],
['`START_JOB`','Resume a stopped job'],
['`PARALLEL=n`','Change the number of workers'],
['`KILL_JOB`','End the job and delete the dump files']]},
{h:'Common errors'},
{t:[['Error','Likely cause'],
['**ORA-39087** directory name invalid','The directory object does not exist or is spelled wrong'],
['**ORA-39002 / ORA-39070** cannot open log file','No privilege on the directory, or the OS folder is missing or not writable'],
['**ORA-39165** schema not found','Wrong schema name or case'],
['**ORA-31626** job does not exist','Wrong job name when attaching'],
['**ORA-39001** invalid argument','A typo in a parameter']]},
{flow:['A job fails or stalls','Read the log file first','Check DBA_DATAPUMP_JOBS for the state','Fix the cause (directory, space, privilege)','Restart with START_JOB or run it again']},
{h:'Orphan jobs'},
{p:'A job in state `NOT RUNNING` with no matching client is an orphan. Its **master table** (named like the job) stays in the schema and uses space. Drop it after you confirm the job is finished or dead.'},
{code:`DROP TABLE system.sys_export_schema_01 PURGE;`},
{note:'Check free space on both the disk of the directory and the tablespaces before large imports. Out-of-space is the most common reason for a long import to fail late.'}],
src:[['Monitoring Data Pump jobs',D+'sutil/oracle-data-pump-overview.html'],['DBA_DATAPUMP_JOBS',O.RF+'DBA_DATAPUMP_JOBS.html']]};

/* ---------- 7: Practical ---------- */
L['ora-core:11:7']={blocks:[
{p:'Move the `SHOP` schema from one PDB to another with Data Pump. The two PDBs act as two databases on one server.'},
{svg:mvs},
{h:'Step 1: Prepare the source and the target'},
{code:`-- In the root
CREATE PLUGGABLE DATABASE labpdb2 ADMIN USER pdbadmin IDENTIFIED BY ChooseAPassword1;
ALTER PLUGGABLE DATABASE labpdb2 OPEN;

-- Directory in each PDB
ALTER SESSION SET CONTAINER = FREEPDB1;
CREATE DIRECTORY lab_dp AS '/opt/oracle/dpdump';
GRANT READ, WRITE ON DIRECTORY lab_dp TO system;

ALTER SESSION SET CONTAINER = labpdb2;
CREATE DIRECTORY lab_dp AS '/opt/oracle/dpdump';
GRANT READ, WRITE ON DIRECTORY lab_dp TO system;`},
{h:'Step 2: Export'},
{code:`# Run on the server (for the Free container: podman exec -it oradb bash)
mkdir -p /opt/oracle/dpdump
expdp system@//localhost:1521/FREEPDB1 schemas=shop directory=lab_dp \\
  dumpfile=shop_%U.dmp logfile=shop_exp.log flashback_time=systimestamp`},
{h:'Step 3: Import with a remap'},
{code:`impdp system@//localhost:1521/LABPDB2 schemas=shop directory=lab_dp \\
  dumpfile=shop_%U.dmp logfile=shop_imp.log remap_schema=shop:shop_copy`},
{h:'Step 4: Compare'},
{code:`ALTER SESSION SET CONTAINER = labpdb2;
SELECT COUNT(*) FROM shop_copy.orders;
SELECT object_type, COUNT(*) FROM dba_objects WHERE owner = 'SHOP_COPY' GROUP BY object_type;

ALTER SESSION SET CONTAINER = FREEPDB1;
SELECT COUNT(*) FROM shop.orders;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['Row counts','Same in both PDBs'],
['Objects in `SHOP_COPY`','Same types and counts as `SHOP`'],
['Import log','Ends with "completed" and no errors, or only known warnings'],
['`DBA_DATAPUMP_JOBS`','No job left in NOT RUNNING state']]},
{h:'Challenge'},
{ul:['Run the import again with `sqlfile=` to read the DDL it would run.','Export only the table `ORDERS` with a `QUERY` that keeps recent rows.','Start an export, then stop and restart it with `ATTACH`.']},
{note:'Clean up when finished: drop the labpdb2 PDB and delete the dump files from the server folder.'}],
src:[['Data Pump overview',D+'sutil/oracle-data-pump-overview.html']]};

})();
