/* LearnSphere - Oracle Core DBA, Section 09: Multitenant Architecture (CDB & PDB).
   Lectures 0-8 are core, 9-14 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const before=O.dg(700,190,[
[10,10,320,170,'Before: one database per server stack',1],
[30,45,85,50,'DB 1|instance',0],[135,45,85,50,'DB 2|instance',0],[240,45,75,50,'DB 3|instance',0],
[30,110,285,55,'3 sets of memory, processes, patches',0],
[370,10,320,170,'Multitenant: one instance, many PDBs',1],
[390,45,85,50,'PDB 1',2],[495,45,85,50,'PDB 2',2],[600,45,75,50,'PDB 3',2],
[390,110,285,55,'One set of memory. Patch once.',0]],[]);

const cdb=O.dg(700,300,[
[10,10,680,280,'Container database (CDB)',1],
[30,40,640,60,'Shared by all: instance (SGA and background processes), redo logs, control files, SPFILE',0],
[30,120,190,150,'CDB$ROOT  (CON_ID 1)|Oracle code and metadata|common users',2],
[240,120,120,150,'PDB$SEED|(CON_ID 2)|template',0],
[380,120,140,150,'PDB1  (CON_ID 3)|own users, tables,|datafiles',2],
[540,120,130,150,'PDB2  (CON_ID 4)|own users, tables,|datafiles',2]],[]);

const mv=O.dg(700,120,[
[10,30,150,60,'PDB on server A|CLOSE it',0],[200,30,150,60,'UNPLUG|writes an XML or|.pdb file',2],[390,30,140,60,'Copy files and|the XML to server B',0],[570,30,120,60,'PLUG IN|CREATE PLUGGABLE|DATABASE USING',2]],
[[160,60,200,60],[350,60,390,60],[530,60,570,60]]);

/* ---------- 0: Why multitenant ---------- */
L['ora-core:8:0']={blocks:[
{p:'**Multitenant** lets one Oracle instance host many databases. The container (CDB) holds shared things once, and each **pluggable database (PDB)** looks like a normal, separate database to the application.'},
{svg:before},
{h:'What you gain'},
{t:[['Benefit','Meaning'],
['**Consolidation**','Many databases share memory, processes and redo. Fewer servers.'],
['**Fast provisioning**','Create or clone a PDB in seconds instead of installing a database.'],
['**Patch once**','Patch or upgrade the CDB and every PDB benefits.'],
['**Easy move**','Unplug a PDB and plug it into another CDB.'],
['**Isolation**','Each PDB has its own users, objects and can be limited separately.']]},
{h:'CDB vs non-CDB'},
{t:[['','Non-CDB (old style)','CDB with PDBs'],
['**Instances for 10 databases**','10','1'],
['**Clone a database**','Backup and restore, hours','`CREATE PLUGGABLE DATABASE ... FROM`, minutes'],
['**Patch 10 databases**','10 times','Once for the CDB'],
['**Status**','Deprecated, not supported in 26ai','The standard']]},
{note:'Non-CDB databases are still allowed in 19c, but the architecture is deprecated and was desupported in 21c. Oracle 26ai supports only CDBs. All new databases should be CDBs **[26ai]**.'},
{h:'Licensing in one line'},
{p:'In 19c and later, a CDB can hold up to **three user-created PDBs** without the Multitenant option. More than three needs the licensed option.'},
{flow:['Create a CDB once','Create a PDB for each application or customer','Manage the shared parts once at the CDB','Manage the application parts inside each PDB']}],
src:[['Multitenant Administrator Guide',O.MT],['Oracle Multitenant',O.CN+'CDBs-and-PDBs.html']]};

/* ---------- 1: CDB architecture ---------- */
L['ora-core:8:1']={blocks:[
{p:'A CDB contains several **containers**. Each container has a number, its **CON_ID**. Learn which parts are shared and which belong to one container.'},
{svg:cdb},
{h:'The containers'},
{t:[['Container','CON_ID','Role'],
['**CDB$ROOT**','1','Holds Oracle-supplied code and metadata and the common users. No application data.'],
['**PDB$SEED**','2','Read-only template for new PDBs'],
['**Your PDBs**','3 and up','Application data, users and objects']]},
{h:'What is shared and what is not'},
{t:[['Shared by the whole CDB','Owned by each PDB'],
['Instance: SGA and background processes','Its own SYSTEM, SYSAUX and datafiles'],
['Redo logs and control files','Its own users, schemas and tables'],
['SPFILE and most parameters','Its own default tablespaces'],
['Undo (unless local undo mode is on)','Its own services']]},
{p:'In a new database, **local undo mode** is on, so each PDB has its own undo tablespace.'},
{h:'See it'},
{code:`SELECT con_id, name, open_mode FROM v$containers;
SELECT con_id, name, open_mode, restricted FROM v$pdbs;
SELECT con_id, file_name FROM cdb_data_files ORDER BY con_id;`},
{h:'The dictionary in a CDB'},
{t:[['View','Shows'],
['`DBA_xxx`','The current container only'],
['`CDB_xxx`','All containers (queried from the root)'],
['`V$CONTAINERS`','All containers']]},
{note:'Oracle metadata is stored once in the root. Each PDB links to it, so PDBs stay small and upgrades stay quick.'}],
src:[['CDB architecture',O.CN+'CDBs-and-PDBs.html'],['Overview of the multitenant architecture',O.MT]]};

/* ---------- 2: Connecting ---------- */
L['ora-core:8:2']={blocks:[
{p:'Section 2 showed the basic connection. Here you see the tools a multitenant DBA uses to **know and change the current container**.'},
{h:'Where am I?'},
{code:`SHOW CON_NAME
SHOW CON_ID
SELECT SYS_CONTEXT('USERENV','CON_NAME') AS container FROM dual;`},
{h:'Three ways to reach a PDB'},
{t:[['Method','Command','Use'],
['**Service name**','`sqlplus app@//host:1521/pdb1`','Applications and normal users'],
['**Switch container**','`ALTER SESSION SET CONTAINER = pdb1;`','A DBA already connected to the root'],
['**Local OS login then switch**','`sqlplus / as sysdba` then `ALTER SESSION SET CONTAINER = pdb1;`','Server maintenance']]},
{h:'Switching needs a privilege'},
{p:'A user needs the `SET CONTAINER` privilege (included for SYS and DBA-type common users) to switch. A local user in a PDB cannot go to the root.'},
{h:'Querying all containers at once'},
{code:`-- From the root: users across all PDBs
SELECT con_id, username FROM cdb_users WHERE oracle_maintained = 'N' ORDER BY con_id;

-- CONTAINERS clause with a normal view
SELECT con_id, username FROM CONTAINERS(dba_users) WHERE oracle_maintained = 'N';`},
{flow:['Connect to the right service','Run SHOW CON_NAME before changes','Use ALTER SESSION SET CONTAINER only for admin work','Switch back to the root when finished']},
{h:'Common error'},
{t:[['Error','Meaning'],
['ORA-65040','Operation not allowed from within a pluggable database'],
['ORA-65096','Invalid common user or role name (use the C## prefix in the root)'],
['ORA-12514 on a PDB service','The PDB is closed, so its service is not registered']]},
{note:'Most DBA mistakes in a CDB come from running a command in the wrong container. Check the container first, every time.'}],
src:[['Connecting to a CDB',O.MT],['ALTER SESSION SET CONTAINER',D+'sqlrf/ALTER-SESSION.html']]};

/* ---------- 3: Creating PDBs ---------- */
L['ora-core:8:3']={blocks:[
{p:'There are three ways to get a new PDB: from the **seed**, as a **clone** of another PDB, or by **plugging in** one that was unplugged elsewhere.'},
{h:'From the seed'},
{code:`CREATE PLUGGABLE DATABASE pdb2
  ADMIN USER pdbadmin IDENTIFIED BY ChooseAPassword1
  FILE_NAME_CONVERT = ('/pdbseed/', '/pdb2/');

ALTER PLUGGABLE DATABASE pdb2 OPEN;`},
{p:'If `DB_CREATE_FILE_DEST` is set (OMF), you can leave out `FILE_NAME_CONVERT`.'},
{h:'Clone another PDB'},
{code:`CREATE PLUGGABLE DATABASE pdb3 FROM pdb2;
ALTER PLUGGABLE DATABASE pdb3 OPEN;`},
{p:'With local undo and ARCHIVELOG mode, the source PDB can stay open during the clone (hot clone). Otherwise the source must be read only.'},
{h:'Unplug and plug in'},
{svg:mv},
{code:`-- Source CDB
ALTER PLUGGABLE DATABASE pdb2 CLOSE IMMEDIATE;
ALTER PLUGGABLE DATABASE pdb2 UNPLUG INTO '/tmp/pdb2.xml';
DROP PLUGGABLE DATABASE pdb2 KEEP DATAFILES;

-- Target CDB: check, then plug in
SET SERVEROUTPUT ON
DECLARE ok BOOLEAN;
BEGIN
  ok := DBMS_PDB.CHECK_PLUG_COMPATIBILITY(pdb_descr_file => '/tmp/pdb2.xml', pdb_name => 'PDB2');
  DBMS_OUTPUT.PUT_LINE(CASE WHEN ok THEN 'compatible' ELSE 'check PDB_PLUG_IN_VIOLATIONS' END);
END;
/
CREATE PLUGGABLE DATABASE pdb2 USING '/tmp/pdb2.xml' COPY;
ALTER PLUGGABLE DATABASE pdb2 OPEN;`},
{t:[['Plug-in option','Meaning'],
['`COPY`','Copy the files to the new location'],
['`MOVE`','Move the files'],
['`NOCOPY`','Use the files where they are']]},
{note:'If plugging in reports warnings, read the view PDB_PLUG_IN_VIOLATIONS. Differences in version or patch level are the usual cause.'}],
src:[['Creating and removing PDBs',O.MT],['DBMS_PDB',D+'arpls/DBMS_PDB.html']]};

/* ---------- 4: Open, close, save state ---------- */
L['ora-core:8:4']={blocks:[
{p:'Each PDB has its own open mode. Starting the CDB does **not** always open every PDB, which surprises many new DBAs.'},
{h:'PDB open modes'},
{t:[['Mode','Meaning'],
['`MOUNTED`','Closed. The service is not registered, users cannot connect.'],
['`READ WRITE`','Normal open'],
['`READ ONLY`','Open for queries only'],
['`MIGRATE`','Open for upgrade work']]},
{code:`ALTER PLUGGABLE DATABASE pdb1 OPEN;
ALTER PLUGGABLE DATABASE pdb1 OPEN READ ONLY;
ALTER PLUGGABLE DATABASE pdb1 CLOSE IMMEDIATE;

ALTER PLUGGABLE DATABASE ALL OPEN;
ALTER PLUGGABLE DATABASE ALL EXCEPT pdb2 OPEN;

-- Inside a PDB you can also use
STARTUP
SHUTDOWN IMMEDIATE`},
{h:'The restart problem'},
{flow:['The CDB is restarted','Without saved state the PDBs come back MOUNTED','Applications get ORA-12514','You open the PDBs by hand']},
{h:'Save the state'},
{code:`ALTER PLUGGABLE DATABASE pdb1 SAVE STATE;
ALTER PLUGGABLE DATABASE ALL SAVE STATE;
ALTER PLUGGABLE DATABASE pdb1 DISCARD STATE;

SELECT con_name, state FROM dba_pdb_saved_states;
SELECT name, open_mode FROM v$pdbs;`},
{t:[['Situation','Do'],
['PDBs must come up with the CDB','`SAVE STATE` after opening each one'],
['A PDB should stay closed after restart','`DISCARD STATE` or save it while closed'],
['After you change a PDB open mode','Save it again']]},
{note:'Saved state records the mode at the moment you save. If you open a PDB later, run SAVE STATE again.'}],
src:[['Modifying a PDB',O.MT]]};

/* ---------- 5: Common and local users ---------- */
L['ora-core:8:5']={blocks:[
{p:'In a CDB there are two kinds of users, depending on **where they exist**.'},
{t:[['','Common user','Local user'],
['**Exists in**','The root and every PDB','One PDB only'],
['**Name**','Starts with `C##` (for user-created ones)','Any normal name'],
['**Created in**','The root','The PDB'],
['**Examples**','`SYS`, `SYSTEM`, `C##BACKUP`','`APP_USER`, `HR`'],
['**Use**','CDB-wide administration','Applications and PDB admins']]},
{code:`-- In the root
CREATE USER c##dba_ops IDENTIFIED BY ChooseAPassword1 CONTAINER = ALL;
GRANT CREATE SESSION, SET CONTAINER TO c##dba_ops CONTAINER = ALL;

-- In a PDB
ALTER SESSION SET CONTAINER = pdb1;
CREATE USER app_user IDENTIFIED BY ChooseAPassword1;
GRANT CREATE SESSION, CREATE TABLE TO app_user;`},
{h:'Grants have a scope'},
{t:[['Clause','Where the privilege applies'],
['`CONTAINER = CURRENT`','Only in the current container (default inside a PDB)'],
['`CONTAINER = ALL`','In every container (only from the root)']]},
{h:'Rules to remember'},
{ul:['You cannot create local users in the root.','Common roles and privileges follow the same C## rule.','A local user in a PDB cannot see or change other PDBs.','Application schemas belong in a PDB as **local** users.']},
{code:`SELECT username, common, con_id FROM cdb_users WHERE oracle_maintained = 'N' ORDER BY con_id;`},
{flow:['Need one person to manage the whole CDB: create a common user in the root','Need an application owner: create a local user in the PDB','Grant the smallest privilege, with the narrowest scope']},
{note:'ORA-65096 (invalid common user name) means you tried to create an ordinary name in the root. Use C## or go to a PDB.'}],
src:[['Managing common and local users',O.MT],['Users in a CDB',O.AD+'managing-users-and-securing-the-database.html']]};

/* ---------- 6: Parameters and resources ---------- */
L['ora-core:8:6']={blocks:[
{p:'Most parameters belong to the whole CDB, but you can **limit or set some per PDB**. This is how you stop one PDB from using everything.'},
{h:'Setting a parameter for one PDB'},
{code:`-- Which parameters can differ per PDB?
SELECT name, ispdb_modifiable FROM v$parameter WHERE ispdb_modifiable = 'TRUE' AND name LIKE '%target%';

ALTER SESSION SET CONTAINER = pdb1;
ALTER SYSTEM SET open_cursors = 600 SCOPE = BOTH;     -- applies to this PDB only

SELECT name, value, con_id FROM v$system_parameter WHERE name = 'open_cursors';`},
{p:'Inside a PDB, `ALTER SYSTEM` only works for parameters marked `ISPDB_MODIFIABLE = TRUE`, and the value is stored for that PDB.'},
{h:'Limit what a PDB can use'},
{t:[['Resource','How to limit','Notes'],
['**SGA and PGA**','`SGA_TARGET`, `PGA_AGGREGATE_LIMIT` set inside the PDB','Upper limits within the CDB totals'],
['**CPU**','`CPU_COUNT` in the PDB, or Resource Manager shares','Section 13 covers it'],
['**Storage**','`ALTER PLUGGABLE DATABASE STORAGE (MAXSIZE 20G)`','Caps total datafile size'],
['**I/O**','Resource Manager (`MAX_IOPS` and `MAX_MBPS` on Exadata and supported storage)','Platform dependent']]},
{code:`ALTER SESSION SET CONTAINER = pdb1;
ALTER PLUGGABLE DATABASE STORAGE (MAXSIZE 20G);
ALTER SYSTEM SET sga_target = 2G SCOPE = BOTH;`},
{flow:['The CDB has a fixed amount of memory and CPU','Each PDB gets limits so it cannot use more than its share','Resource Manager decides who wins when the CDB is busy']},
{note:'Without limits, a heavy PDB can slow every other PDB. Decide a share for each PDB at creation time.'}],
src:[['Administering a CDB: parameters and resources',O.MT]]};

/* ---------- 7: Dropping, cloning, refreshing ---------- */
L['ora-core:8:7']={blocks:[
{p:'PDBs are easy to create and remove. Cloning from another database over a link, and **refreshable clones**, make dev and test copies simple.'},
{h:'Drop a PDB'},
{code:`ALTER PLUGGABLE DATABASE pdb3 CLOSE IMMEDIATE;
DROP PLUGGABLE DATABASE pdb3 INCLUDING DATAFILES;`},
{p:'`KEEP DATAFILES` leaves the files. With `INCLUDING DATAFILES` the data is gone, so check the name first.'},
{h:'Clone from another CDB'},
{code:`-- In the target CDB: a database link to the source
CREATE DATABASE LINK src_link CONNECT TO c##clone IDENTIFIED BY ChooseAPassword1 USING 'sourcecdb';

CREATE PLUGGABLE DATABASE pdb_copy FROM pdb1@src_link;
ALTER PLUGGABLE DATABASE pdb_copy OPEN;`},
{h:'Refreshable clone'},
{p:'A refreshable clone is a copy that you can **refresh** from the source on demand or on a schedule. It is good for reporting copies and dev refreshes.'},
{code:`CREATE PLUGGABLE DATABASE pdb_report FROM pdb1@src_link REFRESH MODE MANUAL;

-- Later, to bring it up to date
ALTER PLUGGABLE DATABASE pdb_report CLOSE IMMEDIATE;
ALTER PLUGGABLE DATABASE pdb_report REFRESH;
ALTER PLUGGABLE DATABASE pdb_report OPEN READ ONLY;`},
{t:[['Clone type','Source open?','Use'],
['**Local clone**','Yes with local undo and ARCHIVELOG','Quick dev copy'],
['**Remote clone**','Yes with local undo and ARCHIVELOG','Copy from another CDB'],
['**Refreshable clone**','Yes','Reporting or refreshed test data']]},
{flow:['Create a link to the source','Create a refreshable clone','Open it read only for reports','Refresh on a schedule or when needed']},
{note:'A copy of production contains production data. Mask or remove sensitive data before developers use it.'}],
src:[['Cloning a PDB',O.MT],['Refreshable clone PDB',O.MT]]};

/* ---------- 8: Practical ---------- */
L['ora-core:8:8']={blocks:[
{p:'Build a PDB, make it survive a restart, clone it, then simulate moving it by unplugging and plugging it back in. The Free lab uses OMF, so you can skip file name conversion.'},
{h:'Step 1: Create and open'},
{code:`-- In the root
SHOW CON_NAME
CREATE PLUGGABLE DATABASE labpdb ADMIN USER pdbadmin IDENTIFIED BY ChooseAPassword1;
ALTER PLUGGABLE DATABASE labpdb OPEN;
ALTER PLUGGABLE DATABASE labpdb SAVE STATE;
SELECT name, open_mode FROM v$pdbs;`},
{h:'Step 2: Put something in it'},
{code:`ALTER SESSION SET CONTAINER = labpdb;
CREATE USER demo IDENTIFIED BY ChooseAPassword1 QUOTA UNLIMITED ON users;
GRANT CREATE SESSION, CREATE TABLE TO demo;
CREATE TABLE demo.t AS SELECT level id FROM dual CONNECT BY level <= 1000;`},
{h:'Step 3: Clone'},
{code:`ALTER SESSION SET CONTAINER = CDB$ROOT;
CREATE PLUGGABLE DATABASE labclone FROM labpdb;
ALTER PLUGGABLE DATABASE labclone OPEN;
ALTER SESSION SET CONTAINER = labclone;
SELECT COUNT(*) FROM demo.t;        -- 1000`},
{h:'Step 4: Unplug and plug back'},
{code:`ALTER SESSION SET CONTAINER = CDB$ROOT;
ALTER PLUGGABLE DATABASE labclone CLOSE IMMEDIATE;
ALTER PLUGGABLE DATABASE labclone UNPLUG INTO '/tmp/labclone.xml';
DROP PLUGGABLE DATABASE labclone KEEP DATAFILES;

CREATE PLUGGABLE DATABASE labmoved USING '/tmp/labclone.xml' NOCOPY TEMPFILE REUSE;
ALTER PLUGGABLE DATABASE labmoved OPEN;`},
{h:'Step 5: Clean up'},
{code:`ALTER PLUGGABLE DATABASE labmoved CLOSE IMMEDIATE;
DROP PLUGGABLE DATABASE labmoved INCLUDING DATAFILES;
ALTER PLUGGABLE DATABASE labpdb CLOSE IMMEDIATE;
DROP PLUGGABLE DATABASE labpdb INCLUDING DATAFILES;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['After step 1','`LABPDB` is READ WRITE'],
['After saving state and restarting the CDB','`LABPDB` opens again by itself'],
['Count in the clone','1000'],
['After plug-in','`LABMOVED` opens with the same data']]},
{note:'Always read the container name in the prompt or with SHOW CON_NAME before a DROP. A DROP in the wrong container is the classic mistake.'}],
src:[['Multitenant Administrator Guide',O.MT]]};

})();
