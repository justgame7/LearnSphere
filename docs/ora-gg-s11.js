/* LearnSphere - GoldenGate, Section 11: Zero-Downtime Migrations & Upgrades.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const zdt=O.dg(700,220,[
[10,30,130,70,'1 Prepare|target, GoldenGate,|logging',0],[160,30,130,70,'2 Capture|start Extract|(note SCN)',2],[310,30,130,70,'3 Load|copy the data|as of the SCN',2],[460,30,110,70,'4 Replicate|catch up and|stay in sync',2],[590,30,100,70,'5 Verify|compare data',0],
[10,125,300,85,'6 Cut over|stop writes to source, wait for lag 0,|switch applications to target',2],[360,125,330,85,'7 Fall back (optional)|reverse replication keeps the old|source current for a while',0]],
[[140,65,160,65],[290,65,310,65],[440,65,460,65],[570,65,590,65],[640,100,160,125]]);

const rev=O.dg(700,150,[
[10,40,150,70,'Source (old)|read only after cutover',0],[210,40,130,70,'Forward path|source to target|(until cutover)',0],[390,40,130,70,'Target (new)|takes the writes|after cutover',2],[570,40,120,70,'Reverse path|target to source|(fallback)',2]],
[[160,75,210,75],[340,75,390,75],[520,75,570,75]]);

/* ---------- 0: The pattern ---------- */
L['ora-gg:10:0']={blocks:[
{p:'The **zero-downtime pattern** is the most common GoldenGate project. The application is down only for the short **cutover**, not for the whole move.'},
{svg:zdt},
{h:'The steps'},
{flow:['**Prepare:** the target database, GoldenGate, logging and users','**Capture:** start Extract on the source and note the SCN','**Load:** copy the existing data as of that SCN (Data Pump, RMAN or GoldenGate initial load)','**Replicate:** start Replicat after the SCN and let it catch up','**Verify:** compare source and target while they stay in sync','**Cut over:** stop writes to the source, wait for lag zero, switch the applications to the target']},
{h:'The downtime'},
{t:[['Without GoldenGate','With GoldenGate'],
['Downtime for the full export, copy and import (hours or days)','Downtime for the cutover only (minutes)'],
['No easy fallback','Fallback with reverse replication'],
['Verify after the move','Verify before the move']]},
{h:'Cutover checklist'},
{ul:['Stop application writes on the source (read-only or stop the application).','Wait until the lag is zero and all changes are applied.','Run the final verification.','Point applications to the target and test.','Keep the source (read only) until you are sure.']},
{note:'The cutover is rehearsed several times before the real one. Time each step in the rehearsal, and use that time as your downtime estimate.'}],
src:[['Zero downtime migration with GoldenGate',O.GG]]};

/* ---------- 1: Reverse replication ---------- */
L['ora-gg:10:1']={blocks:[
{p:'After cutover you may find a problem on the new system. **Reverse replication** keeps the old source up to date with changes made on the new target, so you can **go back** without losing data.'},
{svg:rev},
{h:'How'},
{flow:['Before the cutover, prepare a reverse path: Extract on the target and Replicat on the old source','Start the reverse Extract at the cutover point (an SCN on the target)','The old source receives all new changes','If you must fall back, stop the applications, wait for lag zero, switch them back']},
{h:'Points to plan'},
{ul:['The old source must be **writable by GoldenGate** (the Replicat user), but not by users.','Prevent loops: forward replication is stopped after cutover.','Structure on both sides should match for the replicated tables.','Keep the reverse flow for the stabilisation period only.']},
{t:[['Decision','Time'],
['Keep reverse replication for','A few days to a few weeks, according to risk'],
['Remove it after','The new system is proven and backups exist']]},
{note:'A fallback you have never practised may not work. Test the reverse flow in the rehearsal, including the switch back.'}],
src:[['Reverse replication',O.GG]]};

/* ---------- 2: 19c to 26ai ---------- */
L['ora-gg:10:2']={blocks:[
{p:'Use GoldenGate to move from **19c to 26ai** with only a short cutover. The target is a new 26ai database, built and tested while the old one runs.'},
{h:'Plan'},
{flow:['Create the 26ai target (a CDB with a PDB), apply your standards','Prepare source (19c) and target (26ai) for GoldenGate','Do the initial load and start replication','Test the applications on the 26ai target (read-only or copies)','Cut over and keep reverse replication for fallback']},
{t:[['Topic','Notes'],
['**Versions**','GoldenGate supports capture from 19c and apply to 26ai. Check the certification matrix **[26ai]**.'],
['**Architecture**','26ai uses CDBs only: the target is a PDB. The source may be a non-CDB or a PDB.'],
['**Optimizer and behaviour**','Test performance on the new release before cutover. Plans may differ.'],
['**Unsupported features**','Check `DBA_GOLDENGATE_SUPPORT_MODE` on the source for tables with unsupported types.'],
['**Other options**','AutoUpgrade, Data Guard rolling upgrade (see those sections) when the downtime needs are less strict']]},
{h:'Advantages'},
{ul:['The old system stays untouched until the cutover.','You test the new release with real changes flowing.','Fallback is possible with reverse replication.']},
{note:'GoldenGate is not the only way to upgrade. If you can accept a short outage, AutoUpgrade or a Data Guard based upgrade is simpler. Use GoldenGate when the downtime budget is tight.'}],
src:[['Upgrade with GoldenGate',O.GG],['26ai upgrade guide',O.D26]]};

/* ---------- 3: Platforms and cross-endian ---------- */
L['ora-gg:10:3']={blocks:[
{p:'**Endianness** is the byte order of a platform. Moving between different endianness (for example AIX or Solaris SPARC to Linux x86) cannot use a simple physical copy. GoldenGate does not mind: it moves **logical changes**.'},
{t:[['Move','Physical (RMAN, Data Guard)','GoldenGate'],
['Same platform','Yes','Yes'],
['Different platform, same endianness','Often yes, with conversion rules','Yes'],
['**Different endianness**','Needs conversion (transportable tablespaces with conversion)','**Yes, with no special steps**'],
['Different database version','Limited','Yes'],
['Different database type','No','Yes']]},
{h:'Points to check'},
{ul:['**Character sets:** keep AL32UTF8 on the target, or check conversion.','**Data types:** some types have different behaviour (dates, timestamps, numbers).','**Case sensitivity and collation:** especially to non-Oracle targets.','**Sequences and identity columns:** set the target sequences above the source values at cutover.','**Jobs, links, directories and external files:** not replicated. Recreate them.']},
{h:'Typical project'},
{flow:['Build the target on the new platform','Load and replicate','Rehearse cutover and application tests on the target','Cut over, and move jobs and external objects']},
{note:'GoldenGate moves **data**. The rest of the system (schedulers, wallets, scripts, network settings) must be moved by you.'}],
src:[['Platform migration with GoldenGate',O.GG]]};

/* ---------- 4: Consolidating into multitenant ---------- */
L['ora-gg:10:4']={blocks:[
{p:'Many old databases are **non-CDB**. Moving them to a **PDB** in a container database can be done with GoldenGate and almost no downtime. It also upgrades them in the same project.'},
{h:'The idea'},
{flow:['Create a target CDB and a PDB for each source database','Replicate each source into its own PDB','Verify each one','Cut over database by database','Retire the old databases']},
{t:[['Benefit','Notes'],
['**Consolidation**','Many small databases share one CDB'],
['**Upgrade in the same step**','Source 12c or 19c, target 26ai'],
['**Cutover per database**','Each application moves on its own schedule'],
['**Fallback**','Reverse replication per database']]},
{h:'Design points'},
{ul:['One Extract per source and one Replicat per PDB keeps things isolated.','Use three-part names for the target PDB tables.','Plan resources for the CDB: CPU, memory and I/O for all PDBs together.','Set resource plans so a busy PDB does not hurt others (see the Core DBA sub-course).']},
{note:'Do the consolidation in waves. Start with one or two simple databases, learn from them, and then do the rest with a repeatable procedure.'}],
src:[['Migrating to multitenant with GoldenGate',O.GG]]};

/* ---------- 5: Verify with Veridata ---------- */
L['ora-gg:10:5']={blocks:[
{p:'Before the cutover, you need **proof** that the target equals the source. For large critical data, use **GoldenGate Veridata**. For smaller migrations, counts and checks may be enough.'},
{t:[['Method','Strength','Limit'],
['**Row counts**','Fast, simple','Does not detect changed values'],
['**Checksums by table or range**','Good for large tables','Needs care while data changes'],
['**GoldenGate Veridata**','Compares rows while data is changing, reports differences, can repair','Separate licensed product'],
['**Application tests**','Proves business functions work','Does not prove all data is equal']]},
{h:'What to check before cutover'},
{ul:['Row counts per table.','Checksums of key tables.','Latest rows (changed in the last minutes) arrive.','Sequences and identity values.','Object counts: indexes, constraints, procedures, grants.']},
{code:`-- Simple check on both sides
SELECT COUNT(*), SUM(total), MAX(order_date) FROM shop.orders;

-- Compare object counts
SELECT object_type, COUNT(*) FROM dba_objects WHERE owner = 'SHOP' GROUP BY object_type;`},
{flow:['Compare while replication runs','Fix differences found','Repeat until clean','Do a last check at the cutover, after lag zero']},
{note:'Do not wait for the cutover night to compare. Start verification early, so you have time to find and fix problems.'}],
src:[['GoldenGate Veridata',O.GG]]};

/* ---------- 6: Practical ---------- */
L['ora-gg:10:6']={blocks:[
{p:'Migrate a database with **minutes of downtime**. Use your lab: a source database with an application (a test script that writes continuously), and a target database.'},
{h:'Plan'},
{t:[['Step','Task','Check'],
['1','Prepare source and target (section 4)','Logging, users and parameters set'],
['2','Start the application writing to the source','Row counts grow'],
['3','Start Extract, note the SCN, run Data Pump with `FLASHBACK_SCN`, import','Target has the baseline'],
['4','Start Replicat `AFTERCSN`','Lag falls to seconds'],
['5','Verify counts and checksums','Equal'],
['6','Cutover: stop the writer, wait for lag zero, switch it to the target','Writes arrive on the target'],
['7','Time the downtime (stop to restart)','Minutes']]},
{code:`-- Writer: continuous inserts on the source
BEGIN FOR i IN 1..100000 LOOP INSERT INTO shop.orders VALUES (seq.NEXTVAL, 'X', i); COMMIT; DBMS_SESSION.SLEEP(0.05); END LOOP; END;
/

-- Cutover check
OGG> LAG REPLICAT rep1
SELECT MAX(id) FROM shop.orders;    -- on both sides, equal at lag zero`},
{h:'Fallback test'},
{flow:['Start a reverse path from the target to the source','Insert rows on the target','Check that they arrive on the source','Switch the writer back to the source']},
{h:'Check your result'},
{t:[['Check','Expected'],
['Counts at lag zero','Equal on both sides'],
['Downtime','Only the time between stopping the writer and restarting it on the target'],
['Reverse replication','Changes on the target arrive on the source'],
['Notes','Times for each step, ready for a real runbook']]},
{note:'Write the steps with timings as a runbook. A real migration is this exercise with more data and more people.'}],
src:[['Zero downtime migration',O.GG]]};

})();
