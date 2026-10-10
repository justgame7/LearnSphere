/* LearnSphere - Data Guard, Section 09: Data Guard with Multitenant, RAC & TDE.
   Lectures 0-5 are core, 6-9 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const mt=O.dg(700,230,[
[10,10,320,210,'Primary CDB',1],[30,45,140,40,'CDB$ROOT',2],[190,45,120,40,'PDB1',0],[30,100,140,40,'PDB2',0],[190,100,120,40,'PDB3|STANDBY=NONE',0],
[370,10,320,210,'Standby CDB',1],[390,45,140,40,'CDB$ROOT',2],[550,45,120,40,'PDB1',0],[390,100,140,40,'PDB2',0],[550,100,120,40,'(PDB3 has no copy)',0],
[30,160,640,40,'One redo stream for the whole CDB. Roles belong to the CDB, not to a PDB.',0]],
[[330,65,370,65]]);

const racdg=O.dg(700,220,[
[10,10,330,200,'Primary RAC (2 instances)',1],[30,45,130,40,'Instance 1|thread 1',0],[180,45,130,40,'Instance 2|thread 2',0],[30,110,290,40,'Each instance ships its own redo thread',2],
[360,10,330,200,'Standby RAC (2 instances)',1],[380,45,130,40,'Instance 1|applies redo (MRP)',2],[530,45,130,40,'Instance 2|ADG read only',0],[380,110,290,40,'One instance applies redo',2]],
[[340,130,380,130]]);

/* ---------- 0: Multitenant standby ---------- */
L['ora-dg:8:0']={blocks:[
{p:'Data Guard on a multitenant database works at the **container database (CDB) level**. You protect the whole CDB with one standby. Everything inside it, root and PDBs, follows.'},
{svg:mt},
{h:'What this means'},
{t:[['Aspect','Behaviour'],
['**Standby**','A standby CDB. One per protected CDB.'],
['**Redo**','One stream: root and all PDBs together'],
['**Role change**','Switchover and failover move the whole CDB. All PDBs change role together.'],
['**PDBs**','Present on the standby with all data, closed or open read only (ADG)'],
['**Broker**','One configuration for the CDB']]},
{h:'Check'},
{code:`-- Primary and standby
SELECT con_id, name, open_mode, recovery_status FROM v$pdbs;

-- Standby with ADG
ALTER PLUGGABLE DATABASE ALL OPEN READ ONLY;`},
{h:'Design points'},
{ul:['Group PDBs with the same availability needs in one CDB, because they share one standby.','A PDB that needs a different RPO or RTO belongs in a different CDB.','Patch levels apply to the whole CDB and its standby together.']},
{flow:['Protect the CDB with a standby','All PDBs are copied with it','Switchover and failover act on the CDB','Choose CDB boundaries by availability class']},
{note:'Newer releases add protection at the **PDB level** (per-PDB disaster recovery). Check the 26ai documentation for the current options and limits **[26ai]**.'}],
src:[['Data Guard and multitenant',O.DG]]};

/* ---------- 1: PDB create and drop ---------- */
L['ora-dg:8:1']={blocks:[
{p:'When you create or drop a PDB on the primary, the standby must follow. What happens depends on **how the PDB is created**.'},
{h:'Creating a PDB'},
{t:[['Method on the primary','What the standby needs'],
['**From the seed**','Copies from its own seed automatically. Nothing to do.'],
['**Clone of a PDB in the same CDB**','The standby copies from its own copy of the source PDB (needs space and `STANDBY_FILE_MANAGEMENT=AUTO`)'],
['**Plug in from XML or a remote clone**','The standby needs access to the source files: set `STANDBY_PDB_SOURCE_FILE_DIRECTORY` or `STANDBY_PDB_SOURCE_FILE_DBLINK`'],
['**With `STANDBY=NONE`**','No copy is made on the standby. The PDB is not protected.']]},
{code:`-- Normal: the standby will get a copy
CREATE PLUGGABLE DATABASE app2 FROM pdbseed FILE_NAME_CONVERT=NONE;

-- Do not protect this PDB (for example a test PDB)
CREATE PLUGGABLE DATABASE test1 FROM app1 STANDBY=NONE;

-- Plug in a PDB whose files are not on the standby
ALTER SYSTEM SET standby_pdb_source_file_directory = '/stage/pdbfiles' SCOPE = BOTH;   -- on the standby`},
{h:'Dropping a PDB'},
{code:`ALTER PLUGGABLE DATABASE app2 CLOSE IMMEDIATE;
DROP PLUGGABLE DATABASE app2 INCLUDING DATAFILES;`},
{p:'The drop is replicated by redo. The standby removes the PDB and its files too.'},
{h:'Checks'},
{code:`-- Standby: is the PDB there and enabled for recovery?
SELECT name, open_mode, recovery_status FROM v$pdbs;
SELECT pdb_name, status FROM dba_pdbs;`},
{flow:['Create or clone the PDB on the primary','Check that the standby created its copy','Check recovery status on the standby','For test PDBs use STANDBY=NONE to save space']},
{note:'If a PDB was created without a standby copy, it is not protected after a failover. Check V$PDBS on the standby after each create.'}],
src:[['PDB operations with Data Guard',O.DG]]};

/* ---------- 2: RAC ---------- */
L['ora-dg:8:2']={blocks:[
{p:'RAC and Data Guard work together. The primary can be RAC, the standby can be RAC, or each can be a single instance. The rules are simple.'},
{svg:racdg},
{t:[['Topic','Rule'],
['**Redo transport**','Every primary instance sends its own redo thread to the standby'],
['**Standby redo logs**','One set per thread, on the standby (and on the primary)'],
['**Redo apply**','Runs on **one** standby instance at a time. The others are available (ADG read only) or idle.'],
['**Failure of the apply instance**','Apply restarts on another instance (the broker handles this)'],
['**Instance counts**','They do not have to match between primary and standby']]},
{h:'With the broker'},
{code:`DGMGRL> SHOW DATABASE VERBOSE stby;
-- The output lists the instances and shows where apply is running`},
{p:'The broker picks the apply instance by itself and starts apply on another instance if the first one fails. You usually do not set it by hand.'},
{h:'Services and clusterware'},
{code:`srvctl add database -db stby -oraclehome /u01/app/oracle/product/19.0.0/dbhome_1 -role PHYSICAL_STANDBY -startoption MOUNT
srvctl add instance -db stby -instance stby1 -node dbhost3
srvctl add instance -db stby -instance stby2 -node dbhost4`},
{flow:['Create SRLs for every primary thread','Register the standby RAC database with the standby role','Start the standby on one node and apply on one instance','Open other instances read only if you use ADG']},
{note:'Capacity on the standby must handle the workload after a failover. If the primary has four nodes and the standby only one, plan for reduced capacity or add nodes.'}],
src:[['Data Guard with RAC',O.DG]]};

/* ---------- 3: ASM and file names ---------- */
L['ora-dg:8:3']={blocks:[
{p:'Primary and standby may store files differently. Names and folders differ, and Data Guard must map them. **Oracle Managed Files (OMF)** and **ASM** simplify this.'},
{t:[['Setup','What to set'],
['Both on ASM with OMF','Set `DB_CREATE_FILE_DEST` on each. No convert parameters needed.'],
['Both on file systems with the same paths','Nothing to convert'],
['Different paths','`DB_FILE_NAME_CONVERT` and `LOG_FILE_NAME_CONVERT`'],
['Primary on file system, standby on ASM','Convert from the path to the disk group, for example `\'/u02/oradata/prod\',\'+DATA\'`']]},
{code:`-- Standby on ASM
ALTER SYSTEM SET db_create_file_dest = '+DATA' SCOPE = BOTH;
ALTER SYSTEM SET db_recovery_file_dest = '+FRA' SCOPE = BOTH;
ALTER SYSTEM SET standby_file_management = AUTO SCOPE = BOTH;

-- When primary uses a path and standby uses ASM
ALTER SYSTEM SET db_file_name_convert = '/u02/oradata/prod','+DATA' SCOPE = SPFILE;
ALTER SYSTEM SET log_file_name_convert = '/u02/oradata/prod','+DATA' SCOPE = SPFILE;`},
{h:'Facts about ASM names'},
{ul:['File names differ on each database (they contain a database name and a number).','Do not rely on file names in scripts. Use `V$DATAFILE` and the dictionary.','Disk groups on the standby must exist and have enough space before you add a datafile on the primary.']},
{h:'Check'},
{code:`SELECT file#, name FROM v$datafile ORDER BY file#;
SELECT name, total_mb, free_mb FROM v$asm_diskgroup;       -- on the standby ASM`},
{note:'If STANDBY_FILE_MANAGEMENT=AUTO fails to create a file on the standby, apply stops. A full disk group on the standby is a common reason.'}],
src:[['File names and ASM in Data Guard',O.DG]]};

/* ---------- 4: TDE ---------- */
L['ora-dg:8:4']={blocks:[
{p:'If the primary uses **Transparent Data Encryption (TDE)**, the standby needs the **same encryption keys**. Without them, it cannot read the encrypted blocks that redo apply writes.'},
{h:'What to copy'},
{t:[['Item','Notes'],
['**Keystore (wallet) files**','`ewallet.p12` and `cwallet.sso` from the primary to the standby, to the same configured location'],
['**Auto-login keystore**','Recommended on the standby, so the database can open after a restart without a password'],
['**Key rotation**','When a new master key is created on the primary, the standby needs the updated keystore too']]},
{code:`-- Primary
ADMINISTER KEY MANAGEMENT CREATE AUTO_LOGIN KEYSTORE FROM KEYSTORE '/u01/app/oracle/wallet' IDENTIFIED BY <keystore password>;

# Copy to the standby (same location as in WALLET_ROOT or the sqlnet.ora setting)
scp /u01/app/oracle/wallet/* dbhost2:/u01/app/oracle/wallet/

-- Standby: check the wallet is open
SELECT wrl_type, wrl_parameter, status, wallet_type FROM v$encryption_wallet;`},
{h:'Key changes (rotation)'},
{flow:['Rotate the master key on the primary','The new key appears in the primary keystore','Copy the keystore to the standby (or use a shared key store such as Oracle Key Vault)','If you forget, apply stops with a key-not-found error']},
{h:'Shared key management'},
{p:'**Oracle Key Vault (OKV)** keeps keys in one central place that the primary and the standby both use. This removes the manual copying.'},
{h:'Switchover note'},
{ul:['After a switchover, the new primary keeps its own copy of the keystore.','Keep both keystores in step, and back them up separately from the data.','Do not lose the keystore password: encrypted data cannot be read without it.']},
{note:'Practise a rotation in a test, and watch the standby apply. Many sites find out about the copy step only when apply stops.'}],
src:[['TDE and Data Guard',O.DG],['Database Advanced Security Guide',D+'asoag/']]};

/* ---------- 5: Practical ---------- */
L['ora-dg:8:5']={blocks:[
{p:'Add a PDB to a **protected CDB**. You will create a PDB on the primary, see the standby follow, and test the option to exclude a PDB.'},
{h:'Step 1: Create a PDB on the primary'},
{code:`ALTER SESSION SET CONTAINER = CDB$ROOT;
CREATE PLUGGABLE DATABASE app2 ADMIN USER pdbadmin IDENTIFIED BY ChooseAPassword1;
ALTER PLUGGABLE DATABASE app2 OPEN;
ALTER PLUGGABLE DATABASE app2 SAVE STATE;`},
{h:'Step 2: Check the standby'},
{code:`-- Standby (mounted or ADG)
SELECT name, open_mode, recovery_status FROM v$pdbs;
SELECT file#, name FROM v$datafile WHERE con_id = (SELECT con_id FROM v$pdbs WHERE name = 'APP2');`},
{h:'Step 3: Create an unprotected test PDB'},
{code:`-- Primary
CREATE PLUGGABLE DATABASE test1 FROM app2 STANDBY=NONE;

-- Standby: test1 has no files
SELECT name, recovery_status FROM v$pdbs WHERE name = 'TEST1';`},
{h:'Step 4: Switchover and test'},
{code:`DGMGRL> VALIDATE DATABASE stby;
DGMGRL> SWITCHOVER TO stby;

-- On the new primary: PDBs open?
SELECT name, open_mode FROM v$pdbs;
ALTER PLUGGABLE DATABASE ALL OPEN;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['After step 1','`APP2` open on the primary'],
['After step 2','`APP2` exists on the standby with datafiles'],
['After step 3','`TEST1` exists only on the primary (or is not enabled on the standby)'],
['After step 4','`APP2` opens on the new primary with all data. `TEST1` is not usable there.']]},
{h:'Clean up'},
{code:`DROP PLUGGABLE DATABASE test1 INCLUDING DATAFILES;
-- Switch back to the original primary when done
DGMGRL> SWITCHOVER TO prod;`},
{note:'Remember: a PDB created with STANDBY=NONE is not protected, and cannot be recovered by switching over. Use it only for disposable PDBs.'}],
src:[['Data Guard and multitenant',O.DG]]};

})();
