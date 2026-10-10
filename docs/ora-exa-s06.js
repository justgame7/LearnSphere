/* LearnSphere - Exadata, Section 06: Exascale.
   Lectures 0-6 are core, 7-10 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const old=O.dg(700,220,[
[10,10,330,200,'Classic: storage tied to a compute cluster',1],[30,45,140,50,'VM cluster|owns its|disk groups',0],[190,45,130,50,'Cells dedicated|to that cluster',0],[30,115,290,70,'Add storage = add cells to this system|Minimum size is large',0],
[360,10,330,200,'Exascale: shared storage pool',1],[380,45,140,50,'Many VM clusters|and databases',2],[540,45,130,50,'Shared pool of|storage cells',2],[380,115,290,70,'Files live in vaults you resize on demand|Small start, grow as needed',2]],
[[170,70,190,70],[520,70,540,70]]);

const arch=O.dg(700,250,[
[10,10,680,100,'Compute: VM clusters with database instances',1],[30,40,200,55,'VM cluster A|DB 1, DB 2',0],[250,40,200,55,'VM cluster B|DB 3',0],[470,40,200,55,'VM cluster C|DB 4, DB 5',0],
[10,130,680,110,'Exascale storage pool (many storage cells, mirrored)',1],[30,160,200,60,'Vault A|files of cluster A',2],[250,160,200,60,'Vault B|files of cluster B',2],[470,160,200,60,'Vault C|files of cluster C|(thin clones here)',2]],
[[130,95,130,160],[350,95,350,160],[570,95,570,160]]);

/* ---------- 0: Why Exascale ---------- */
L['ora-exa:5:0']={blocks:[
{p:'**Exascale** is a newer Exadata storage architecture. It keeps the speed of Exadata (RDMA, flash, Smart Scan) but **decouples storage from compute**, so storage is shared like a pool and can start small. **Note:** the product is evolving. Terms and features are described at a high level here, so check the current Oracle documentation for details.'},
{svg:old},
{h:'What it solves'},
{t:[['Classic Exadata','Exascale'],
['Storage servers belong to one system or VM cluster','A pool of storage cells is shared by many VM clusters'],
['Large minimum size','Small entry size, grow on demand'],
['You plan disk groups and capacity up front','Files are placed by the storage layer, in vaults you can resize'],
['Cloning by copying data','Space-efficient thin clones in seconds'],
['Capacity added in steps of cells','Capacity added to the pool and used by whoever needs it']]},
{h:'Where you meet it'},
{ul:['**Exadata Database Service on Exascale Infrastructure** in Oracle Cloud.','Newer Exadata System Software on systems that support it.']},
{flow:['A pool of storage cells serves many clients','Each client gets a vault for its files','Vaults grow or shrink as needed','The database still reads from cells over RDMA with the same features']},
{note:'Exascale does not change SQL or the database. It changes how storage is allocated and managed behind it.'}],
src:[['Exascale documentation',O.EXA],['Exadata Cloud',  'https://docs.oracle.com/en-us/iaas/exadatacloud/index.html']]};

/* ---------- 1: Architecture ---------- */
L['ora-exa:5:1']={blocks:[
{p:'Exascale has a few new concepts. Learn the names first.'},
{svg:arch},
{t:[['Term','Meaning'],
['**Storage pool**','The set of storage servers that serve all vaults'],
['**Vault**','A logical container for files with its own size limit and settings. The Exascale counterpart of a disk group.'],
['**Exascale files**','Database files placed in a vault, mirrored across cells by the storage layer'],
['**Exascale block volumes**','Block devices carved from the pool, used for example for VM images'],
['**Control services**','Software that tracks pool, vaults and their metadata']]},
{h:'What is the same as before'},
{ul:['Cells run the Exadata System Software, with Smart Scan, flash cache and storage indexes.','Database servers reach cells over the RoCE network with RDMA.','Mirroring and failure handling still protect the data.']},
{h:'What is different for the DBA'},
{t:[['Task','Classic','Exascale'],
['Capacity planning','Disk groups per system','Vault and pool capacity'],
['Add storage','Add grid disks to disk groups','Resize vaults, add cells to the pool'],
['Clone a database','Backup and restore, or sparse snapshot','Thin clone in storage']]},
{flow:['The database asks for a file in its vault','The storage layer places and mirrors extents on cells','The database reads them over RDMA','Smart features run in the cells as before']},
{note:'Names such as vault and pool belong to Exascale. Do not look for ASM disk groups in the same way. Check the documentation for how your service exposes these objects.'}],
src:[['Exascale architecture',O.EXA]]};

/* ---------- 2: Database storage Exascale vs ASM ---------- */
L['ora-exa:5:2']={blocks:[
{p:'Both ASM and Exascale present database files to the database. They differ in **who decides placement**, **how you resize**, and **how you clone**.'},
{t:[['','ASM on Exadata (classic)','Exascale'],
['**Storage unit**','Disk group made of grid disks','Vault in a storage pool'],
['**Sizing**','Planned when disk groups are created','Dynamic: resize a vault'],
['**Redundancy**','Per disk group (NORMAL or HIGH)','Set for the vault (typically high protection)'],
['**Rebalance**','You watch and tune with power','Managed by the storage layer'],
['**Cloning**','Sparse disk groups','Thin clones and snapshots'],
['**Admin tools**','`asmcmd`, SQL*Plus as SYSASM, `cellcli`','Exascale tools and the cloud console or APIs']]},
{h:'What stays the same'},
{ul:['The database does not care: tablespaces, redo and control files work as usual.','Smart Scan, flash cache, HCC and storage indexes continue to apply.','Backup, Data Guard and multitenant work as before.']},
{h:'Do you need to learn ASM?'},
{p:'**Yes.** Most Exadata systems today still use ASM disk groups, and the skills in the earlier sections apply. Exascale is the direction for cloud and new systems, so understanding both is valuable.'},
{flow:['Check which storage your system uses','ASM: use the disk group skills from this course','Exascale: use vault and pool tools from the service','Keep the database tasks (backup, patching, tuning) unchanged']},
{note:'Mixed estates exist: some databases on ASM, others on Exascale. Know which is which before you give advice.'}],
src:[['Exascale and ASM',O.EXA]]};

/* ---------- 3: Thin clones ---------- */
L['ora-exa:5:3']={blocks:[
{p:'A **thin clone** is a writable copy that **shares unchanged blocks** with its source. It is created in seconds, takes almost no space at first, and uses extra space only for what changes.'},
{h:'How it works'},
{flow:['A snapshot of the source PDB is taken at a point in time','The clone points to the same blocks as the snapshot','When the clone changes a block, the new version is written separately','Reads of unchanged data come from the shared blocks']},
{t:[['','Full copy','Thin clone'],
['**Time**','Proportional to size','Seconds'],
['**Space**','Same as source','Only the changes'],
['**Use**','Independent copy','Dev, test, training, reporting']]},
{h:'In SQL (PDB snapshot copy)'},
{code:`-- Thin clone of a PDB (needs storage that supports snapshots, such as Exascale)
CREATE PLUGGABLE DATABASE dev1 FROM prod1 SNAPSHOT COPY;
ALTER PLUGGABLE DATABASE dev1 OPEN;`},
{h:'Points to remember'},
{ul:['The clone depends on its source snapshot. Dropping the source in the wrong order can be blocked.','Many clones from one source make heavy use of the source blocks. Check I/O.','A clone has production data. Mask sensitive data before developers use it.','Check your service for the supported way to create clones (console, API or SQL).']},
{note:'Thin clones make test data cheap, so teams create too many. Set rules for how long they live and who owns them.'}],
src:[['Thin clones and snapshots',O.EXA],['PDB snapshot copy',O.MT]]};

/* ---------- 4: Administration basics ---------- */
L['ora-exa:5:4']={blocks:[
{p:'On Exascale, many administration tasks move to the **cloud console, APIs and a command-line tool** rather than ASM commands. The ideas stay the same: see capacity, change size, check health.'},
{t:[['Task','How (typical)'],
['See pool and vault usage','Console, API, or the Exascale command-line tool'],
['Create or resize a vault','Console or API'],
['Check health of storage servers','Cell metrics and alerts (`cellcli`, `exacli`) where available, and console health'],
['Monitor performance','Cell metrics, database statistics, AWR if licensed'],
['Backup and Data Guard','Database tools such as RMAN and the cloud backup service']]},
{h:'Habits that carry over'},
{ul:['Keep an eye on free space with an alert before it becomes urgent.','Check that vault sizes match the growth plan.','Review storage health regularly, even if Oracle manages the hardware.','Document which tools your site uses for each task.']},
{h:'Checklist'},
{t:[['Check','Why'],
['Vault free space','Avoid hitting a limit'],
['Pool free space','Shared by all clients'],
['Cell alerts','Early warning of hardware issues'],
['Clone count and age','Control space use by thin clones']]},
{flow:['Look at the pool','Look at each vault','Check clones and snapshots','Act on trends, not only on alarms']},
{note:'Tool names and commands for Exascale are still developing. Always follow the current documentation of the service you use.'}],
src:[['Exascale administration',O.EXA]]};

/* ---------- 5: Availability and rebalance ---------- */
L['ora-exa:5:5']={blocks:[
{p:'Exascale protects data in a similar way to classic Exadata: **mirroring across cells** and automatic repair. The details are handled by the storage layer.'},
{t:[['Event','Behaviour'],
['**Disk or flash failure**','Data is served from mirror copies. The storage layer re-mirrors in the background.'],
['**Cell failure**','The pool continues with remaining cells. Data is re-mirrored when capacity allows.'],
['**Pool expansion**','New cells join the pool and data spreads onto them automatically'],
['**Planned maintenance**','Cells are updated one at a time, so service continues']]},
{h:'What you should still watch'},
{ul:['**Free space** in the pool: re-mirroring needs room.','**Alerts** for failed devices.','**Performance** during repair: it uses cell I/O.']},
{flow:['A device fails','The storage layer detects it and uses mirrors','Re-mirroring runs in the background','Alerts tell you and the operator','The pool returns to full redundancy']},
{note:'Automatic does not mean ignorable. Keep monitoring pool capacity and health alerts, and know who owns the response in your service model.'}],
src:[['Exascale availability',O.EXA]]};

/* ---------- 6: Practical ---------- */
L['ora-exa:5:6']={blocks:[
{p:'**Cloud walkthrough.** Create a **thin clone of a PDB** on a system that supports it. If you do not have access, follow along on paper using the steps and expected outputs.'},
{h:'Scenario'},
{p:'A 2 TB PDB `PROD1` must be copied for a test team. A full copy would take hours and 2 TB of space.'},
{h:'Step 1: Check the source'},
{code:`SELECT name, open_mode FROM v$pdbs;
SELECT SUM(bytes)/1024/1024/1024 AS gb FROM dba_data_files;   -- run inside PROD1`},
{h:'Step 2: Create the clone'},
{code:`ALTER SESSION SET CONTAINER = CDB$ROOT;
CREATE PLUGGABLE DATABASE test1 FROM prod1 SNAPSHOT COPY;
ALTER PLUGGABLE DATABASE test1 OPEN;`},
{h:'Step 3: Check space and behaviour'},
{ul:['The clone is created in seconds to minutes, not hours.','Check that the storage used by the clone is small at first (use the console or storage views of your service).','Update some rows in `TEST1` and see that space grows only by the changes.']},
{h:'Step 4: Protect the data'},
{code:`ALTER SESSION SET CONTAINER = test1;
-- mask sensitive columns before developers connect
UPDATE customers SET email = 'user' || id || '@example.com';
COMMIT;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`V$PDBS`','`TEST1` is READ WRITE'],
['Creation time','Seconds or a few minutes'],
['Extra space at first','Close to zero'],
['Sensitive data','Masked before sharing']]},
{h:'Clean up'},
{code:`ALTER PLUGGABLE DATABASE test1 CLOSE IMMEDIATE;
DROP PLUGGABLE DATABASE test1 INCLUDING DATAFILES;`},
{note:'The commands depend on the service and release. Use the console or documented procedure of your Exascale service if SNAPSHOT COPY is not supported.'}],
src:[['Thin clones and snapshots',O.EXA]]};

})();
