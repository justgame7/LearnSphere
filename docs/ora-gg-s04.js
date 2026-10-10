/* LearnSphere - GoldenGate, Section 04: Database Preparation.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const prep=O.dg(700,160,[
[10,30,150,70,'1 Database settings|ARCHIVELOG,|FORCE LOGGING',0],[190,30,150,70,'2 Parameter|ENABLE_GOLDENGATE_|REPLICATION',2],[370,30,150,70,'3 Supplemental|logging|(minimal, schema, table)',2],[550,30,140,70,'4 GoldenGate user|and privileges|(source and target)',0],
[10,115,680,40,'Do these on the source. The target needs steps 2 and 4.',1]],
[[160,65,190,65],[340,65,370,65],[520,65,550,65]]);

const cdb=O.dg(700,200,[
[10,10,330,180,'Source CDB',1],[30,45,140,50,'CDB$ROOT|C##GGADMIN|Extract connects',2],[190,45,130,50,'PDB1|data to replicate',0],[30,115,290,50,'Register PDB1 with the Extract|REGISTER EXTRACT ... CONTAINER (pdb1)',0],
[370,10,320,180,'Target PDB (or non-CDB)',1],[390,45,280,50,'Replicat connects to the target PDB|with a local user (GGADMIN)',2],[390,115,280,50,'MAP pdb1.hr.*, TARGET hr.*',0]],
[[320,70,390,70]]);

/* ---------- 0: Oracle requirements ---------- */
L['ora-gg:3:0']={blocks:[
{p:'Before GoldenGate can capture from an Oracle database, the database must be set up. The requirements are few and clear.'},
{svg:prep},
{t:[['Requirement','Source','Target'],
['**Supported database version** (check the matrix)','Yes','Yes'],
['**ARCHIVELOG mode**','Yes (for capture)','Not needed for apply'],
['**FORCE LOGGING**','Recommended','Optional'],
['**ENABLE_GOLDENGATE_REPLICATION = TRUE**','Yes','Yes'],
['**Supplemental logging**','Yes','No'],
['**GoldenGate user** with privileges','Yes','Yes'],
['**Streams pool** (for integrated capture)','Yes: automatic with SGA_TARGET, or set `STREAMS_POOL_SIZE`','No']]},
{h:'Integrated Extract needs memory'},
{p:'Integrated Extract uses a database log mining server. It takes memory from the **streams pool**. If you use `SGA_TARGET`, it is sized automatically. Otherwise set `STREAMS_POOL_SIZE` yourself.'},
{code:`SHOW PARAMETER streams_pool_size
SHOW PARAMETER sga_target`},
{flow:['Check the version is supported','Set archive, logging and the parameter','Prepare supplemental logging for the data you replicate','Create the GoldenGate users','Verify the support level of your tables']},
{note:'The target needs fewer settings, but it still needs the parameter and a user. Prepare both sides before you build the replication.'}],
src:[['Preparing the Oracle database',O.GG]]};

/* ---------- 1: ARCHIVELOG etc ---------- */
L['ora-gg:3:1']={blocks:[
{p:'Three database settings are the base for capture.'},
{t:[['Setting','Why','Command'],
['**ARCHIVELOG**','Extract needs the redo available, including archived logs, if it falls behind','`ALTER DATABASE ARCHIVELOG;` (in MOUNT)'],
['**FORCE LOGGING**','Makes sure every change produces redo, so nothing is missed by NOLOGGING operations','`ALTER DATABASE FORCE LOGGING;`'],
['**ENABLE_GOLDENGATE_REPLICATION**','Turns on the database features GoldenGate needs','`ALTER SYSTEM SET enable_goldengate_replication=TRUE SCOPE=BOTH;`']]},
{code:`SELECT log_mode, force_logging, supplemental_log_data_min FROM v$database;

ALTER DATABASE FORCE LOGGING;
ALTER SYSTEM SET enable_goldengate_replication = TRUE SCOPE = BOTH;

SHOW PARAMETER enable_goldengate_replication`},
{h:'Keep archive logs long enough'},
{p:'If Extract is stopped for a while, it must still find the redo. Keep archived logs until Extract has read them. Check the RMAN deletion policy.'},
{ul:['Do not delete archived logs before they are mined.','Monitor the Extract lag, so you know how far back it needs.','Keep enough space in the recovery area.']},
{flow:['Turn on ARCHIVELOG and FORCE LOGGING','Set the GoldenGate parameter','Review how long archive logs are kept','Check with the V$DATABASE query']},
{note:'FORCE LOGGING is part of the design of most Oracle features that read redo. It is the same prerequisite as for Data Guard.'}],
src:[['Database settings for GoldenGate',O.GG]]};

/* ---------- 2: Supplemental logging ---------- */
L['ora-gg:3:2']={blocks:[
{p:'Oracle redo normally holds only the **changed columns** of an update. To find the same row on the target, GoldenGate needs the **key columns** too. **Supplemental logging** adds them to the redo.'},
{h:'Three levels'},
{t:[['Level','What it does','Command'],
['**Minimal (database level)**','Allows the log miner to identify rows. Required.','`ALTER DATABASE ADD SUPPLEMENTAL LOG DATA;`'],
['**Schema level**','Logs key columns for all tables of a schema, including future ones','`ADD SCHEMATRANDATA hr` (in the Admin Client)'],
['**Table level**','Logs key columns for one table','`ADD TRANDATA hr.employees`']]},
{code:`-- Database
ALTER DATABASE ADD SUPPLEMENTAL LOG DATA;
SELECT supplemental_log_data_min FROM v$database;     -- YES

# Admin Client, after DBLOGIN with the credential alias
OGG> DBLOGIN USERIDALIAS src_alias DOMAIN OracleGoldenGate
OGG> ADD SCHEMATRANDATA hr
OGG> ADD TRANDATA sales.orders ALLCOLS         -- all columns, needed for conflict detection
OGG> INFO SCHEMATRANDATA hr
OGG> INFO TRANDATA sales.orders`},
{h:'Which columns'},
{t:[['Option','Logs'],
['Default','Primary key (or a unique key, or all columns when there is no key)'],
['`ALLCOLS`','All columns. Needed for conflict detection and some transformations.']]},
{flow:['Turn on minimal supplemental logging at the database','Add schema-level logging for the schemas you replicate','Add table-level logging where you need ALLCOLS','Check with INFO commands']},
{note:'Use schema-level logging. It covers tables created later. A table without logging would replicate with missing key data and cause errors.'}],
src:[['Supplemental logging',O.GG]]};

/* ---------- 3: Users and privileges ---------- */
L['ora-gg:3:3']={blocks:[
{p:'GoldenGate connects to the database with its own user. Create one on each side, with the **right privileges and no more**.'},
{h:'Create the user (non-CDB or PDB)'},
{code:`CREATE USER ggadmin IDENTIFIED BY <password> DEFAULT TABLESPACE users QUOTA UNLIMITED ON users;
GRANT CREATE SESSION, ALTER SESSION, CONNECT, RESOURCE TO ggadmin;
EXEC DBMS_GOLDENGATE_AUTH.GRANT_ADMIN_PRIVILEGE(grantee => 'GGADMIN', privilege_type => '*', grant_optional_privileges => '*');`},
{t:[['privilege_type','For'],
['`CAPTURE`','Extract (source)'],
['`APPLY`','Replicat (target)'],
['`*`','Both (lab convenience: use narrower in production)']]},
{h:'Container database (source)'},
{p:'In a CDB, Extract connects to the **root** with a **common user**, which has the privilege in all containers.'},
{code:`-- In CDB$ROOT
CREATE USER c##ggadmin IDENTIFIED BY <password> CONTAINER = ALL;
GRANT CREATE SESSION, ALTER SESSION TO c##ggadmin CONTAINER = ALL;
EXEC DBMS_GOLDENGATE_AUTH.GRANT_ADMIN_PRIVILEGE(grantee => 'C##GGADMIN', privilege_type => 'CAPTURE', grant_optional_privileges => '*', container => 'ALL');`},
{h:'Store the credentials safely'},
{code:`OGG> ALTER CREDENTIALSTORE ADD USER c##ggadmin@orclcdb PASSWORD <password> ALIAS src_alias DOMAIN OracleGoldenGate
OGG> ALTER CREDENTIALSTORE ADD USER ggadmin@tgtpdb PASSWORD <password> ALIAS tgt_alias DOMAIN OracleGoldenGate
OGG> INFO CREDENTIALSTORE`},
{ul:['Parameter files then use `USERIDALIAS src_alias`, never a password.','Use a strong, unique password. Rotate it by changing the credential store entry.','Grant only the capture privilege on the source and apply on the target.']},
{note:'The GoldenGate user can read or change a lot of data. Treat it as a privileged account: restrict network access to it and audit its use.'}],
src:[['GoldenGate users and privileges',O.GG],['DBMS_GOLDENGATE_AUTH',D+'arpls/DBMS_GOLDENGATE_AUTH.html']]};

/* ---------- 4: Multitenant ---------- */
L['ora-gg:3:4']={blocks:[
{p:'GoldenGate works with **container databases**. The Extract reads the redo of the whole CDB, and you tell it which PDBs to capture. Names use **three parts**.'},
{svg:cdb},
{h:'Source'},
{ul:['Extract connects to **CDB$ROOT** with a common user.','Register the PDBs: `REGISTER EXTRACT ext1 DATABASE CONTAINER (pdb1)`.','Supplemental logging is set inside each PDB (`ADD SCHEMATRANDATA pdb1.hr`).']},
{h:'Target'},
{ul:['Replicat connects to the **target PDB** (or non-CDB) with a local user.','Map source tables with three-part names.']},
{code:`# Extract parameter file (source)
EXTRACT ext1
USERIDALIAS src_alias DOMAIN OracleGoldenGate
EXTTRAIL aa
TABLE pdb1.hr.*;

# Replicat parameter file (target PDB)
REPLICAT rep1
USERIDALIAS tgt_alias DOMAIN OracleGoldenGate
MAP pdb1.hr.*, TARGET hr.*;`},
{t:[['Name','Meaning'],
['`pdb1.hr.employees`','PDB name, schema, table'],
['Container clause','`DATABASE CONTAINER (pdb1)` in REGISTER EXTRACT']]},
{flow:['Create the common user and grant privileges in the root','Prepare supplemental logging in each PDB','Register the PDBs with the Extract','Use three-part names in TABLE and MAP']},
{note:'A single Extract can capture from several PDBs of one CDB. Consider one Extract per PDB or group, for easier tuning and recovery.'}],
src:[['GoldenGate and multitenant',O.GG]]};

/* ---------- 5: TDE, character sets, data types ---------- */
L['ora-gg:3:5']={blocks:[
{p:'Three topics cause surprises: **encrypted data**, **character sets** and **unsupported data types**. Check them before you design the replication.'},
{h:'TDE'},
{ul:['Integrated Extract reads redo through the database, so the database decrypts TDE data for it.','The Extract needs access to the open TDE keystore on the source.','On the target, the Replicat writes through SQL, so target encryption is handled by the target database.']},
{h:'Character sets'},
{t:[['Case','Result'],
['Same character set on both','Simple'],
['Different, but target can hold all characters (for example source WE8 to target AL32UTF8)','Works. Conversion is automatic.'],
['Target cannot hold some source characters','Data loss or errors. Avoid it.']]},
{p:'AL32UTF8 on the target is the safest choice.'},
{h:'Data type and object support'},
{code:`-- What is supported for capture, per table
SELECT owner, object_name, support_mode FROM dba_goldengate_support_mode WHERE owner = 'HR';`},
{t:[['support_mode','Meaning'],
['`FULL`','Fully supported'],
['`ID KEY`','Supported, with a key to identify the rows'],
['`PLSQL`','Supported through the log mining server'],
['`NONE`','Not supported by integrated capture']]},
{h:'Typical things to check'},
{ul:['Tables without a key: GoldenGate needs a unique identifier, or all columns.','Large objects (LOBs): supported, with tuning needs.','Special types (some XML, user-defined types): check the support list.','Sequences and triggers on the target: see the design lecture in section 7.']},
{flow:['List the tables to replicate','Check support mode for each','Check keys and character sets','Plan how to handle the exceptions']},
{note:'Find unsupported objects at the start of the project, not at cutover. Redesign or exclude them early.'}],
src:[['Data type support',O.GG]]};

/* ---------- 6: Practical ---------- */
L['ora-gg:3:6']={blocks:[
{p:'Prepare a **source** and a **target** Oracle database for replication. You will use them in the next sections. The Free container or two PDBs work for the lab.'},
{h:'Source'},
{code:`-- As SYSDBA in the source CDB
ALTER DATABASE FORCE LOGGING;
ALTER DATABASE ADD SUPPLEMENTAL LOG DATA;
ALTER SYSTEM SET enable_goldengate_replication = TRUE SCOPE = BOTH;

CREATE USER c##ggadmin IDENTIFIED BY <password> CONTAINER = ALL;
GRANT CREATE SESSION, ALTER SESSION TO c##ggadmin CONTAINER = ALL;
EXEC DBMS_GOLDENGATE_AUTH.GRANT_ADMIN_PRIVILEGE('C##GGADMIN','CAPTURE','*',container=>'ALL');

-- A schema to replicate, in PDB1
ALTER SESSION SET CONTAINER = pdb1;
CREATE USER shop IDENTIFIED BY <password> QUOTA UNLIMITED ON users;
CREATE TABLE shop.orders (id NUMBER PRIMARY KEY, customer VARCHAR2(50), total NUMBER);`},
{h:'Target'},
{code:`ALTER SYSTEM SET enable_goldengate_replication = TRUE SCOPE = BOTH;
ALTER SESSION SET CONTAINER = tgtpdb;
CREATE USER ggadmin IDENTIFIED BY <password> QUOTA UNLIMITED ON users;
GRANT CREATE SESSION, ALTER SESSION, CONNECT, RESOURCE TO ggadmin;
EXEC DBMS_GOLDENGATE_AUTH.GRANT_ADMIN_PRIVILEGE('GGADMIN','APPLY','*');
CREATE USER shop IDENTIFIED BY <password> QUOTA UNLIMITED ON users;
CREATE TABLE shop.orders (id NUMBER PRIMARY KEY, customer VARCHAR2(50), total NUMBER);`},
{h:'Admin Client'},
{code:`OGG> CONNECT https://host:9011 DEPLOYMENT src_dep AS oggadmin PASSWORD <password>
OGG> ALTER CREDENTIALSTORE ADD USER c##ggadmin@srccdb PASSWORD <password> ALIAS src_alias DOMAIN OracleGoldenGate
OGG> DBLOGIN USERIDALIAS src_alias DOMAIN OracleGoldenGate
OGG> ADD SCHEMATRANDATA pdb1.shop
OGG> INFO SCHEMATRANDATA pdb1.shop`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`V$DATABASE`','FORCE_LOGGING YES, SUPPLEMENTAL_LOG_DATA_MIN YES'],
['`SHOW PARAMETER enable_goldengate_replication`','TRUE on both'],
['`INFO SCHEMATRANDATA pdb1.shop`','Logging enabled'],
['`DBA_GOLDENGATE_SUPPORT_MODE` for SHOP','FULL'],
['`DBLOGIN`','Succeeds with the alias']]},
{note:'Use lab passwords only. In production, passwords come from your secrets process, never from scripts you share.'}],
src:[['Preparing databases for GoldenGate',O.GG]]};

})();
