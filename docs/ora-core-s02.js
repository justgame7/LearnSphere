/* LearnSphere - Oracle Core DBA, Section 02: Lab Setup & Tools.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const labs=O.dg(700,210,[
[10,20,160,70,'Free container|Podman or Docker|fastest start',2],[190,20,160,70,'VM, Enterprise Edition|Oracle Linux|full DBA practice',0],
[370,20,160,70,'Cloud VM or DB service|OCI Base Database|costs money',0],[550,20,140,70,'Always Free ADB|Autonomous|no DBA access',0],
[10,115,680,80,'Practise DBA tasks where you have SYSDBA. Autonomous is for using Oracle, not administering it.',1]],[]);

const conn=O.dg(700,230,[
[10,90,120,50,'Your tool|SQL*Plus / SQLcl',0],
[180,90,130,50,'Listener|localhost:1521',0],
[360,10,330,210,'Container database (CDB)',1],
[380,40,150,50,'Service FREE|root container|CDB$ROOT',2],[550,40,125,50,'Service|FREEPDB1|your PDB',0],
[380,130,295,70,'Rule: DBA work such as|ALTER SYSTEM runs in the root.|Application work runs in a PDB.',0]],
[[130,115,180,115],[310,105,380,70],[310,125,550,70]]);

/* ---------- 0: Lab options ---------- */
L['ora-core:1:0']={blocks:[
{p:'Before you can practise being a DBA, you need a database you are allowed to break. This lecture compares the four common lab options so you can pick one in a few minutes.'},
{svg:labs},
{h:'Comparing the options'},
{t:[['Option','Cost','Good for','Limits'],
['**Oracle AI Database Free (container)**','Free','Almost all Core DBA labs. Starts in minutes.','2 CPU threads, 2 GB RAM, about 12 GB user data. Some Enterprise features missing.'],
['**Virtual machine with Enterprise Edition**','Free for learning (development licence), your hardware','Full practice: RMAN options, Data Guard, RAC (needs more RAM)','You build and patch it yourself. Needs 8 GB RAM or more.'],
['**Cloud VM or Base Database Service**','Pay as you go','Practising on a realistic server','Costs money while it runs. Remember to stop it.'],
['**Always Free Autonomous Database**','Free','Learning SQL, JSON and Oracle APEX','You do not get SYSDBA or the operating system. Not a DBA lab.']]},
{note:'Production use of Enterprise Edition needs a licence. The free development licence is for learning and building applications only. Read the licence terms on the download page.'},
{h:'Which one should I pick?'},
{flow:['Do you have a laptop with 8 GB RAM or more?','Yes: install Podman or Docker','Run the Oracle AI Database Free container','Need Enterprise-only features later (Data Guard, RMAN options)?','Then add a VM with Enterprise Edition for those labs']},
{h:'What this course uses'},
{t:[['Section','Lab'],
['2 to 14','Oracle AI Database Free for nearly everything'],
['Lectures marked as needing Enterprise Edition','The VM option (additional lectures show how to build it)']]},
{p:'Free edition is built on the current release. Commands in this course work on 19c unless a lecture says otherwise, and the differences are small for a lab.'}],
src:[['Oracle AI Database Free','https://www.oracle.com/database/free/'],['Autonomous Database Always Free','https://www.oracle.com/cloud/free/']]};

/* ---------- 1: Lab safety rules ---------- */
L['ora-core:1:1']={blocks:[
{p:'A lab exists so that mistakes cost nothing. A few habits keep it that way and train you for production, where mistakes do cost.'},
{h:'The seven lab rules'},
{t:[['Rule','Why it matters'],
['**1. Never point the lab at a real database**','A wrong connect string is how real data gets dropped.'],
['**2. Snapshot before you break something**','A VM snapshot or a volume copy gives you a way back in a minute.'],
['**3. Keep a backup of the lab data**','You practise restore later, and you need something to restore.'],
['**4. Write commands in script files**','Scripts can be repeated, reviewed and kept in Git.'],
['**5. Read the alert log after each step**','You learn how Oracle reports problems.'],
['**6. Keep lab passwords out of notes and Git**','Bad habits carry over to work.'],
['**7. Clean up when finished**','Old containers and volumes eat disk space.']]},
{h:'Your safety net'},
{flow:['Healthy lab state','Take a snapshot or copy the data volume','Run the risky practice','Works: keep going, or throw the snapshot away','Broken: restore the snapshot and try again']},
{h:'How to snapshot'},
{t:[['Lab type','Snapshot method'],
['**VM**','Use the hypervisor snapshot (VirtualBox, VMware).'],
['**Container**','Stop the container and copy the data volume, or export the database with Data Pump.'],
['**Cloud VM**','Create a boot or block volume backup.']]},
{code:`# Container lab: stop, copy the data volume, start again (Podman)
podman stop oradb
podman volume export oradata -o oradata-backup.tar
podman start oradb

# Restore later by creating a new volume from the tar
podman volume create oradata2
podman volume import oradata2 oradata-backup.tar`},
{h:'Cleaning up'},
{code:`# List what is running and what is stored
podman ps -a
podman volume ls

# Remove a lab completely (this deletes the data)
podman rm -f oradb
podman volume rm oradata`},
{note:'Command names are the same for Docker. Replace podman with docker. A removed volume cannot be brought back, so check the name before you delete it.'}],
src:[['Oracle Database Free container image','https://container-registry.oracle.com/'],['Podman documentation','https://docs.podman.io/']]};

/* ---------- 2: Install Free ---------- */
L['ora-core:1:2']={blocks:[
{p:'The fastest way to get a real Oracle database is the **Free** container image from Oracle. It runs on Intel and AMD (x86-64) and also on Arm64 (Apple silicon and Arm servers). This lecture takes you from nothing to your first connection.'},
{h:'What you need'},
{ul:['Podman or Docker installed (Podman is free and rootless, Docker Desktop may need a licence at work).','About 10 GB of free disk and 2 GB of memory for the container.','Internet access to pull the image from `container-registry.oracle.com`.']},
{h:'Steps'},
{flow:['Pull the image','Create a data volume so data survives container removal','Run the container with a password','Wait until the log says the database is ready','Connect with SQL*Plus or SQLcl']},
{code:`# 1. Pull the image
podman pull container-registry.oracle.com/database/free:latest

# 2. Run it (choose your own password)
podman run -d --name oradb \\
  -p 1521:1521 \\
  -e ORACLE_PWD=ChooseAPassword1 \\
  -v oradata:/opt/oracle/oradata \\
  container-registry.oracle.com/database/free:latest

# 3. Watch the log until you see: DATABASE IS READY TO USE!
podman logs -f oradb`},
{h:'What you get'},
{t:[['Item','Value'],
['Container database (CDB)','`FREE`'],
['Pluggable database (PDB)','`FREEPDB1`'],
['Listener port','`1521`'],
['Password for SYS, SYSTEM and PDBADMIN','The value of `ORACLE_PWD`'],
['Data files','`/opt/oracle/oradata` inside the container (your volume)']]},
{h:'First connection'},
{code:`# From inside the container (OS authentication, lands in the root)
podman exec -it oradb sqlplus / as sysdba

# From your own machine with SQL*Plus or SQLcl installed
sqlplus system/ChooseAPassword1@//localhost:1521/FREEPDB1

SQL> SHOW CON_NAME
CON_NAME
------------------------------
FREEPDB1`},
{h:'Common problems'},
{t:[['Symptom','Likely cause and fix'],
['Container exits straight away','Not enough memory. Give the container runtime at least 2 GB, then run it again.'],
['Port already in use','Another process uses 1521. Map another port: `-p 1522:1521`.'],
['Image pull fails on Arm','Make sure you pull the current Free image, which has an Arm64 build.'],
['Data gone after restart','You forgot `-v`. Without a volume the data lives only in the container.']]},
{note:'Use a throwaway password for the lab only, and never reuse a real password in a container command, because it stays in your shell history.'}],
src:[['Oracle AI Database Free','https://www.oracle.com/database/free/'],['Oracle Container Registry','https://container-registry.oracle.com/']]};

/* ---------- 3: Tools ---------- */
L['ora-core:1:3']={blocks:[
{p:'A DBA works in three kinds of tools: a **command line**, a **modern command line** and a **graphical editor**. Learn the command line first, because it is the only one on every server.'},
{h:'The tools'},
{t:[['Tool','What it is','When to use it'],
['**SQL*Plus**','The classic command-line client, installed with the database','Always available on the server. Scripts and emergencies.'],
['**SQLcl**','A modern command-line client built on Java','Everyday work: command history, auto-complete, nicer output, `DDL` command.'],
['**SQL Developer**','Free graphical tool from Oracle','Browsing objects, writing longer SQL, visual explain plans.'],
['**VS Code with the Oracle extension**','Editor plugin that connects to the database','If you already live in VS Code.']]},
{h:'SQL*Plus: settings you will use every day'},
{code:`-- Make output readable
SET LINESIZE 200
SET PAGESIZE 100
COLUMN name FORMAT A30
SET SERVEROUTPUT ON

-- Everyday commands
SHOW USER              -- who am I?
SHOW CON_NAME          -- which container?
DESCRIBE hr.employees  -- table columns
@/home/oracle/check.sql   -- run a script
SPOOL out.txt          -- save output to a file
SPOOL OFF`},
{note:'Put the SET lines in a file named login.sql in the folder where you start SQL*Plus, and they apply every time.'},
{h:'SQLcl: what you gain'},
{code:`sql system/ChooseAPassword1@//localhost:1521/FREEPDB1

SQL> history                 -- earlier commands, repeat with a number
SQL> ddl hr.employees        -- full CREATE statement of a table
SQL> info hr.employees       -- columns, indexes, notes
SQL> set sqlformat ansiconsole   -- tidy tables`},
{h:'Quick comparison'},
{t:[['Need','SQL*Plus','SQLcl','SQL Developer'],
['On every Oracle server','Yes','Only if installed','No'],
['Command history and editing','Limited','Yes','Yes'],
['Visual plans and object tree','No','No','Yes'],
['Good in a script or cron job','Yes','Yes','No']]},
{flow:['Server problem: use SQL*Plus on the server','Daily work: use SQLcl','Long SQL or reports: use SQL Developer']}],
src:[['SQL*Plus User Guide',D+'sqpug/'],['Oracle SQLcl','https://www.oracle.com/database/sqldeveloper/technologies/sqlcl/'],['SQL Developer','https://www.oracle.com/database/sqldeveloper/']]};

/* ---------- 4: Connecting ---------- */
L['ora-core:1:4']={blocks:[
{p:'Connecting to Oracle needs three things: where (host and port), which service, and who you are. The most common beginner mistake is connecting to the wrong **container**.'},
{svg:conn},
{h:'EZConnect: the short way'},
{p:'EZConnect lets you write the connection without any configuration file. The format is **host:port/service_name**.'},
{code:`sqlplus system@//localhost:1521/FREEPDB1
sqlplus sys@localhost:1521/FREE as sysdba

-- With parameters (EZConnect Plus)
sqlplus system@localhost:1521/FREEPDB1?connect_timeout=10`},
{h:'Service name or SID?'},
{t:[['Term','Meaning','Use for connections?'],
['**Service name**','A named entry point to a database or PDB, registered with the listener','**Yes, always**'],
['**SID**','Name of the instance on the server','Only locally, with the `ORACLE_SID` variable']]},
{h:'Root vs PDB connections'},
{t:[['You connect to','Service','You can'],
['**Root (CDB$ROOT)**','`FREE`','Manage the instance and the CDB, create PDBs, set `ALTER SYSTEM` parameters'],
['**A PDB**','`FREEPDB1`','Create users, tables and run the application']]},
{code:`-- Switch container without reconnecting (needs the right privilege)
ALTER SESSION SET CONTAINER = FREEPDB1;
SHOW CON_NAME

ALTER SESSION SET CONTAINER = CDB$ROOT;`},
{h:'Local OS authentication'},
{p:'On the database server, `sqlplus / as sysdba` needs no password. It connects to the instance named in `ORACLE_SID`, lands in the **root**, and works if your OS user is in the `dba` group.'},
{t:[['Command','Where you land'],
['`sqlplus / as sysdba`','Root of the local instance'],
['`sqlplus user/pw@//host:1521/FREEPDB1`','The PDB through the network'],
['`sqlplus / as sysdba` then `ALTER SESSION SET CONTAINER=FREEPDB1`','The PDB as SYSDBA']]},
{flow:['Know the host and port','Know the service name (list it with lsnrctl services)','Choose root or PDB for the task','Connect and run SHOW CON_NAME to confirm']},
{note:'Habit: after every connect, run `SHOW USER` and `SHOW CON_NAME`. It takes two seconds and prevents most wrong-database mistakes.'}],
src:[['Oracle Net Services: Easy Connect Naming',D+'netag/'],['Administering a CDB',O.MT]]};

/* ---------- 5: Sample schemas ---------- */
L['ora-core:1:5']={blocks:[
{p:'A DBA lab needs data to look at. Oracle provides **sample schemas** with ready-made tables, and you can also generate large tables with a single SQL statement.'},
{h:'Oracle sample schemas'},
{t:[['Schema','Content','Good for practising'],
['**HR**','Employees, departments, jobs (small)','Joins, privileges, simple queries'],
['**SH**','Sales history with partitioned tables (large)','Partitioning, statistics, performance'],
['**OE / CO / BI**','Orders and customer data','Schema objects, Data Pump moves']]},
{p:'The sample schemas are published by Oracle on GitHub (`oracle-samples/db-sample-schemas`). Download them, then run the install script of the schema you want while connected to the **PDB** as a privileged user.'},
{flow:['Download the sample schemas from GitHub','Copy them to the server or container','Connect to the PDB as SYSTEM','Run the install script for the schema','Check with a SELECT on a table']},
{h:'Generate your own test data'},
{p:'Real tables for storage, undo and performance practice should be large. `CONNECT BY LEVEL` produces rows from nothing:'},
{code:`-- A table with 500,000 rows to practise on
CREATE TABLE lab_orders AS
SELECT level                         AS id,
       DBMS_RANDOM.STRING('U', 8)    AS customer,
       TRUNC(DBMS_RANDOM.VALUE(1,1000)) AS amount,
       SYSDATE - DBMS_RANDOM.VALUE(0,365) AS order_date
FROM   dual
CONNECT BY level <= 500000;

SELECT COUNT(*) FROM lab_orders;`},
{t:[['Test data size','Use for'],
['Few hundred rows','Joins, syntax, privileges'],
['100,000 to 1 million rows','Indexes, statistics, explain plans'],
['Several GB','Tablespace sizing, undo growth, backup timing']]},
{note:'Create practice tables in a normal user schema in the PDB, never in SYS or SYSTEM, and never in the root container.'}],
src:[['Oracle sample schemas on GitHub','https://github.com/oracle-samples/db-sample-schemas'],['DBMS_RANDOM',D+'arpls/DBMS_RANDOM.html']]};

/* ---------- 6: Linux skills ---------- */
L['ora-core:1:6']={blocks:[
{p:'Most Oracle servers run **Linux**. You do not have to be a Linux expert, but you must be comfortable with users, files, processes and disk space.'},
{h:'Users and groups'},
{t:[['Name','Role'],
['`oracle`','The OS user that owns the software and runs the database'],
['`oinstall`','Group that owns the inventory and installation'],
['`dba`','Group allowed to connect `/ as sysdba`']]},
{code:`id oracle                # see user and groups
su - oracle              # become oracle with its environment
sudo -u oracle -i        # same, using sudo`},
{h:'Commands a DBA uses daily'},
{t:[['Task','Command'],
['Is the database running?','`ps -ef | grep pmon`'],
['Which Oracle processes run?','`ps -ef | grep ora_`'],
['Free disk space','`df -h`'],
['Which folder is large?','`du -sh /u01/app/oracle/*`'],
['Free memory','`free -m`'],
['Busy processes','`top`'],
['Follow the alert log','`tail -f alert_FREE.log`'],
['Find a file','`find /u01 -name "*.dbf"`'],
['Change file owner and mode','`chown oracle:oinstall file` and `chmod 640 file`']]},
{h:'Permissions in one picture'},
{code:`ls -l spfileFREE.ora
-rw-r----- 1 oracle oinstall 3584 Mar 1 10:00 spfileFREE.ora
 |||||||||
 ||| group: read          (oinstall)
 ||+-- owner: read, write  (oracle)
 +--- type: - means a file`},
{h:'Environment variables'},
{code:`export ORACLE_BASE=/u01/app/oracle
export ORACLE_HOME=$ORACLE_BASE/product/19.0.0/dbhome_1
export ORACLE_SID=FREE
export PATH=$ORACLE_HOME/bin:$PATH`},
{flow:['Log in as the oracle user','Set ORACLE_HOME, ORACLE_SID and PATH','Run sqlplus / as sysdba','Check disk and processes with df and ps']},
{note:'Never run the database as root. Files created by root cannot be used by the oracle user and cause confusing errors.'}],
src:[['Oracle Database Installation Guide for Linux',D+'ladbi/']]};

/* ---------- 7: Practical ---------- */
L['ora-core:1:7']={blocks:[
{p:'Time to use the lab. You will start the database, connect and read the **data dictionary**, which is the database own catalogue of itself. Allow 30 minutes.'},
{h:'Goal'},
{ul:['Start the Free container and confirm it is ready.','Find the version, instance, container and users.','See the tablespaces and datafiles.']},
{h:'Step 1: Start and check'},
{code:`podman start oradb
podman logs oradb | tail -5       # look for: DATABASE IS READY TO USE!
podman exec -it oradb sqlplus / as sysdba`},
{h:'Step 2: Identify the system'},
{code:`SELECT banner_full FROM v$version;
SELECT instance_name, status, host_name FROM v$instance;
SELECT name, cdb, open_mode FROM v$database;
SHOW CON_NAME
SELECT con_id, name, open_mode FROM v$pdbs;`},
{h:'Step 3: Users and storage'},
{code:`ALTER SESSION SET CONTAINER = FREEPDB1;

SELECT username, account_status, created
FROM   dba_users WHERE oracle_maintained = 'N';

SELECT tablespace_name, status, contents FROM dba_tablespaces;

SELECT file_name, ROUND(bytes/1024/1024) AS mb
FROM   dba_data_files;`},
{h:'Step 4: Parameters'},
{code:`SELECT name, value FROM v$parameter
WHERE  name IN ('db_name','sga_target','pga_aggregate_target','processes','compatible');`},
{h:'What you should see'},
{t:[['Question','Expected answer'],
['Is the instance open?','`OPEN` in V$INSTANCE'],
['Which PDBs exist?','`PDB$SEED` and `FREEPDB1`'],
['How many data files in the PDB?','At least system, sysaux and undo'],
['Is `CDB` YES in V$DATABASE?','Yes, the database is a container database']]},
{h:'Challenge'},
{ul:['Create a user `lab` in the PDB with a password of your choice and grant it `CREATE SESSION`.','Connect as `lab` and run `SHOW USER`.','Create the `lab_orders` table from lecture 5 and count its rows.']},
{note:'If a query returns no rows or an error, check SHOW CON_NAME first. Many dictionary views show different rows in the root and in a PDB.'}],
src:[['Static data dictionary views',O.RF+'static-data-dictionary-views.html'],['Dynamic performance views',O.RF+'dynamic-performance-views.html']]};

})();
