/* LearnSphere - GoldenGate, Section 05: Unidirectional Replication.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const ie=O.dg(700,220,[
[10,20,200,180,'Source database',1],[30,55,160,40,'Redo log',0],[30,110,160,70,'Database log mining|server (inside the DB)|reads and formats',2],
[260,70,160,70,'Integrated Extract|receives logical|change records',2],[470,70,100,70,'Local|trail|aa',0],[610,70,80,70,'Next:|distribution|path',0]],
[[190,145,260,110],[420,105,470,105],[570,105,610,105]]);

const load=O.dg(700,200,[
[10,40,140,70,'1 Note the SCN|(start point)',2],[180,40,140,70,'2 Start Extract|from that SCN|(captures changes)',2],[350,40,150,70,'3 Initial load|Data Pump with|FLASHBACK_SCN',2],[530,40,160,70,'4 Start Replicat|after the SCN|(applies changes)',2],
[10,130,680,55,'The SCN links the snapshot and the change stream, so no change is lost or applied twice',1]],
[[150,75,180,75],[320,75,350,75],[500,75,530,75]]);

/* ---------- 0: Integrated Extract ---------- */
L['ora-gg:4:0']={blocks:[
{p:'**Integrated Extract** is the standard capture method for Oracle. It uses a **log mining server** inside the database to read the redo, and the Extract receives clean **logical change records**.'},
{svg:ie},
{h:'Why integrated'},
{ul:['Supports the most data types and features, including compression and TDE.','The database handles the redo format details, so upgrades are simpler.','Works with multitenant databases and RAC.']},
{h:'Create it (Admin Client)'},
{code:`OGG> DBLOGIN USERIDALIAS src_alias DOMAIN OracleGoldenGate
OGG> ADD EXTRACT ext1 INTEGRATED TRANLOG BEGIN NOW
OGG> REGISTER EXTRACT ext1 DATABASE CONTAINER (pdb1)
OGG> ADD EXTTRAIL aa EXTRACT ext1 MEGABYTES 500
OGG> EDIT PARAMS ext1
OGG> START EXTRACT ext1
OGG> INFO EXTRACT ext1, DETAIL`},
{h:'A parameter file'},
{code:`EXTRACT ext1
USERIDALIAS src_alias DOMAIN OracleGoldenGate
EXTTRAIL aa
TRANLOGOPTIONS INTEGRATEDPARAMS (MAX_SGA_SIZE 512, PARALLELISM 2)
DDL INCLUDE MAPPED
TABLE pdb1.shop.*;`},
{t:[['Part','Meaning'],
['`INTEGRATED TRANLOG`','Use the log mining server'],
['`BEGIN NOW`','Start capturing from now'],
['`REGISTER EXTRACT`','Create the capture in the database for the PDB'],
['`EXTTRAIL aa`','Write the local trail with prefix aa'],
['`TABLE`','Which tables to capture'],
['`MAX_SGA_SIZE`, `PARALLELISM`','Memory and parallelism of the log mining server']]},
{flow:['Prepare logging and the user','Create and register the Extract','Create the trail','Start the Extract and check it reads redo']},
{note:'The registration creates a capture in the database. If you remove an Extract, also unregister it, so no capture is left behind.'}],
src:[['Integrated Extract',O.GG]]};

/* ---------- 1: Trails and paths ---------- */
L['ora-gg:4:1']={blocks:[
{p:'The **trail** is the file set between capture and apply. A **distribution path** moves it from the source deployment to the target.'},
{h:'Trail files'},
{t:[['Item','Meaning'],
['**Name**','A two-letter prefix plus a sequence number, for example `aa000000001`'],
['**Size**','Set when created (`MEGABYTES 500`). A new file starts when the current one is full.'],
['**Content**','Committed transactions in commit order, in a compact format'],
['**Local trail**','Written by Extract on the source'],
['**Remote trail**','Written on the target side by the Receiver Server']]},
{h:'Distribution path'},
{code:`# Illustrative: create a path from the source to the target
OGG> ADD DISTPATH dp1 SOURCE trail://ggsrc.example.com:9011/services/v2/sources?trail=aa
     TARGET wss://ggtgt.example.com:9021/services/v2/targets?trail=ba BEGIN NOW
OGG> START DISTPATH dp1
OGG> INFO DISTPATH dp1`},
{p:'You can also create the path in the Web UI, which is easier when you start. Check the Admin Client reference for the exact syntax of your release.'},
{t:[['Setting','Notes'],
['`ws://` or `wss://`','Plain or secure WebSocket. Use `wss://` outside a lab.'],
['`trail=ba`','The trail prefix on the target'],
['Compression and filters','Can be set on the path (section 8)']]},
{flow:['Extract writes trail aa on the source','The path reads aa and sends it','The Receiver Server on the target writes trail ba','Replicat reads trail ba']},
{note:'Purge old trail files after they have been read by all paths and Replicats. Set a purge rule, so disk space does not fill.'}],
src:[['Trails and distribution paths',O.GG]]};

/* ---------- 2: Replicat types ---------- */
L['ora-gg:4:2']={blocks:[
{p:'The **Replicat** applies the trail to the target. There are several types. Each uses a different way to apply, and you choose by workload.'},
{t:[['Type','How it applies','Use'],
['**Parallel Replicat** (recommended)','Several apply threads, with dependencies tracked automatically. Can be integrated or non-integrated.','The default choice for most Oracle targets'],
['**Integrated Replicat**','Uses the database apply engine and parallelism inside the database','Large Oracle workloads that fit it'],
['**Coordinated Replicat**','Several Replicats under one coordinator, split by tables','Large systems where you split by table'],
['**Classic Replicat**','One thread applying SQL','Simple flows, small volume, non-Oracle targets']]},
{h:'Create a parallel Replicat'},
{code:`OGG> DBLOGIN USERIDALIAS tgt_alias DOMAIN OracleGoldenGate
OGG> ADD REPLICAT rep1 PARALLEL INTEGRATED EXTTRAIL ba
OGG> EDIT PARAMS rep1
OGG> START REPLICAT rep1
OGG> INFO REPLICAT rep1, DETAIL`},
{code:`REPLICAT rep1
USERIDALIAS tgt_alias DOMAIN OracleGoldenGate
MAP_PARALLELISM 4
MAX_APPLY_PARALLELISM 16
MAP pdb1.shop.*, TARGET shop.*;`},
{p:'Check the Admin Client reference for the exact options of the ADD REPLICAT command in your release.'},
{h:'Choosing'},
{flow:['Oracle target and modest to high volume? Parallel Replicat','Very high volume and complex? Test Integrated or Coordinated','Non-Oracle target or very simple needs? Classic']},
{note:'Start with parallel Replicat and measure. You can change the type later by recreating the Replicat from its checkpoint position.'}],
src:[['Replicat types',O.GG]]};

/* ---------- 3: Initial load ---------- */
L['ora-gg:4:3']={blocks:[
{p:'Replication carries **changes**. The target also needs the **existing data**. This is the **initial load**. The challenge is that data keeps changing while you load it.'},
{svg:load},
{h:'Methods'},
{t:[['Method','Notes'],
['**Data Pump with FLASHBACK_SCN**','Export a consistent copy as of an SCN and import it. Most common for Oracle to Oracle.'],
['**GoldenGate initial load**','Extract reads the source tables directly and Replicat writes them. Works across database types.'],
['**RMAN duplicate or restore**','Physical copy for same-platform, large databases'],
['**Database link or other ETL**','For small tables']]},
{h:'The pattern with Data Pump'},
{flow:['Start the Extract so changes are captured from now on','Note the current SCN: `SELECT current_scn FROM v$database;`','Export with `FLASHBACK_SCN` = that SCN','Import into the target','Start the Replicat to apply changes made after that SCN']},
{code:`SELECT current_scn FROM v$database;      -- for example 4893412

expdp system@//src/pdb1 schemas=shop directory=dp_dir dumpfile=shop.dmp flashback_scn=4893412
impdp system@//tgt/tgtpdb schemas=shop directory=dp_dir dumpfile=shop.dmp`},
{note:'Capture first, then export. If you export first, changes made in between are lost. Starting Extract first guarantees overlap, which the next lecture handles.'}],
src:[['Initial load',O.GG]]};

/* ---------- 4: Instantiation and cutover SCN ---------- */
L['ora-gg:4:4']={blocks:[
{p:'**Instantiation** is making the target a consistent copy and telling Replicat **where in the change stream to start**. The SCN of the export decides the start point.'},
{h:'Start the Replicat at the right place'},
{code:`# Apply only transactions committed AFTER the export SCN
OGG> START REPLICAT rep1 AFTERCSN 4893412

# Or include the transaction at that SCN
OGG> START REPLICAT rep1 ATCSN 4893412`},
{t:[['Option','Meaning'],
['`AFTERCSN scn`','Start with transactions committed after that SCN (usual for a Data Pump export at that SCN)'],
['`ATCSN scn`','Start with the transaction at that SCN']]},
{h:'Other ways to handle overlap'},
{t:[['Setting','Use'],
['`HANDLECOLLISIONS`','Temporary. Resolves duplicate or missing rows during the catch-up. **Turn it off after the first catch-up.**'],
['`FILTERDUPTRANSACTIONS`','Ignores transactions already applied by the load, when the position is not exact']]},
{code:`REPLICAT rep1
...
HANDLECOLLISIONS            -- remove this once Replicat is caught up
MAP pdb1.shop.*, TARGET shop.*;`},
{flow:['Export at an SCN','Import on the target','Start Replicat AFTERCSN that SCN','Wait until lag is near zero','Remove HANDLECOLLISIONS if you used it']},
{note:'HANDLECOLLISIONS hides real errors. Use it only during instantiation, and never leave it on in production.'}],
src:[['Instantiation',O.GG]]};

/* ---------- 5: Verify consistency ---------- */
L['ora-gg:4:5']={blocks:[
{p:'Do not assume the target equals the source. **Verify**. The method depends on size and risk.'},
{t:[['Method','How','Use'],
['**Row counts**','`SELECT COUNT(*)` on both sides','Quick check. Does not catch changed values.'],
['**Checksums**','A hash of a column or a table region, on both sides','Fast value check'],
['**DBMS_COMPARISON**','Oracle package that compares and converges tables','Oracle to Oracle, small and medium tables'],
['**GoldenGate Veridata**','Compares large data sets, even while they change, and can repair','Large and critical data'],
['**Process statistics**','`STATS REPLICAT` shows inserts, updates, deletes, discards','Ongoing health']]},
{code:`-- Quick count and sum on both sides
SELECT COUNT(*), SUM(total) FROM shop.orders;

-- Statistics for the Replicat
OGG> STATS REPLICAT rep1, TOTAL
OGG> INFO REPLICAT rep1`},
{h:'What to compare'},
{ul:['Row counts for each table.','A sum or hash of important columns.','The latest rows changed on the source, since they should arrive in seconds.','Discard files: rows that were rejected.']},
{flow:['Pause or note lag at the time of the check','Compare counts and checksums','Investigate any difference','Fix and repeat until equal']},
{note:'Verification before cutover is part of the migration. Plan for time to compare and fix, not only for the replication itself.'}],
src:[['Verifying data',O.GG]]};

/* ---------- 6: Practical ---------- */
L['ora-gg:4:6']={blocks:[
{p:'Build and validate a **one-way replication** from the source `shop.orders` to the target. Use the lab from sections 3 and 4.'},
{h:'Steps'},
{flow:['Create the Extract, register the PDB, create the local trail','Create the distribution path to the target deployment','Create the Replicat for the remote trail','Do the initial load with Data Pump and an SCN','Start Replicat after the SCN and watch it catch up','Insert, update and delete on the source and check the target']},
{code:`# Source deployment
OGG> DBLOGIN USERIDALIAS src_alias DOMAIN OracleGoldenGate
OGG> ADD EXTRACT ext1 INTEGRATED TRANLOG BEGIN NOW
OGG> REGISTER EXTRACT ext1 DATABASE CONTAINER (pdb1)
OGG> ADD EXTTRAIL aa EXTRACT ext1 MEGABYTES 100
OGG> START EXTRACT ext1

# Target deployment
OGG> DBLOGIN USERIDALIAS tgt_alias DOMAIN OracleGoldenGate
OGG> ADD REPLICAT rep1 PARALLEL INTEGRATED EXTTRAIL ba
OGG> START REPLICAT rep1 AFTERCSN <scn>`},
{h:'Test'},
{code:`-- Source
INSERT INTO shop.orders VALUES (1, 'Acme', 100);
INSERT INTO shop.orders VALUES (2, 'Beta', 200);
UPDATE shop.orders SET total = 250 WHERE id = 2;
DELETE FROM shop.orders WHERE id = 1;
COMMIT;

-- Target, after a few seconds
SELECT * FROM shop.orders;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`INFO ALL` on both deployments','Extract, path and Replicat RUNNING'],
['Lag','Seconds or less'],
['Target `shop.orders`','Equal to the source'],
['`STATS REPLICAT rep1`','Counts of inserts, updates and deletes match your test']]},
{h:'Challenge'},
{ul:['Stop the Replicat, add 1000 rows on the source, and start it again. Watch the lag fall.','Find the trail files on disk and relate them to the checkpoint.']},
{note:'Keep this replication for the next sections. You will add filtering, transformation and monitoring to it.'}],
src:[['Unidirectional replication',O.GG]]};

})();
