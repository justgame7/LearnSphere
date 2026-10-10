/* LearnSphere - Data Guard, Section 10: Rolling Upgrades & Patching with Data Guard.
   Lectures 0-5 are core, 6-9 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const sf=O.dg(700,200,[
[10,30,150,70,'1 Patch the standby|software only,|redo apply continues',2],[190,30,150,70,'2 Switchover|the patched standby|becomes primary',2],[370,30,150,70,'3 Patch the old|primary (now|standby)',2],[550,30,140,70,'4 Run datapatch|once, on the|new primary',0],
[10,125,680,60,'Downtime is the switchover only: seconds to minutes',1]],
[[160,65,190,65],[340,65,370,65],[520,65,550,65]]);

const roll=O.dg(700,200,[
[10,30,150,70,'1 Start plan|standby becomes a|transient logical|standby',2],[190,30,150,70,'2 Upgrade the|standby|while production runs',2],[370,30,150,70,'3 Switchover|upgraded database|becomes primary',2],[550,30,140,70,'4 Finish plan|old primary is|upgraded, rejoins',0],
[10,125,680,60,'DBMS_ROLLING automates the steps. Downtime is the switchover only.',1]],
[[160,65,190,65],[340,65,370,65],[520,65,550,65]]);

/* ---------- 0: Standby-first ---------- */
L['ora-dg:9:0']={blocks:[
{p:'**Standby-first patching** lets you patch with **minimal downtime**. You patch the **standby**, then switch over to it, then patch the old primary. Users only notice the switchover.'},
{svg:sf},
{h:'The method'},
{flow:['Check that the Release Update README says it supports Standby-First Patch Apply','Stop apply on the standby and patch its software home','Start the standby with the patched software, and restart redo apply','Switch over to the patched standby (it is now the primary)','Patch the old primary (now a standby) and restart it','Run datapatch once on the new primary to update the database dictionary']},
{h:'Commands (outline)'},
{code:`# Standby
DGMGRL> EDIT DATABASE stby SET STATE = 'APPLY-OFF';
# stop the standby, patch the home with opatch, start from the patched home (MOUNT)
DGMGRL> EDIT DATABASE stby SET STATE = 'APPLY-ON';

DGMGRL> VALIDATE DATABASE stby;
DGMGRL> SWITCHOVER TO stby;

# Old primary (now standby): patch, start, apply on
# New primary, once:
$ORACLE_HOME/OPatch/datapatch -verbose`},
{h:'Why it works'},
{ul:['Redo can be applied by a patched standby from an unpatched primary, for certified Release Updates.','The primary keeps running during the whole patching of the standby.','You see the patched software run on the standby before it carries production.']},
{note:'Not every patch supports standby-first. Always read the README for the statement "Data Guard Standby-First Patch Apply". If it is absent, use another method.'}],
src:[['Standby-First patching',O.DG],['My Oracle Support: Data Guard Standby-First Patch Apply','https://support.oracle.com/']]};

/* ---------- 1: DBMS_ROLLING ---------- */
L['ora-dg:9:1']={blocks:[
{p:'For **upgrades to a new release**, standby-first is not enough. **DBMS_ROLLING** automates a rolling upgrade, using a **transient logical standby**, so that the downtime is only a switchover.'},
{svg:roll},
{h:'The steps in PL/SQL'},
{code:`-- On the primary (broker enabled, flashback on)
EXEC DBMS_ROLLING.INIT_PLAN(future_primary => 'stby');
EXEC DBMS_ROLLING.BUILD_PLAN;
EXEC DBMS_ROLLING.START_PLAN;        -- standby becomes a transient logical standby

-- Upgrade the standby (new software, startup in upgrade mode, run the upgrade)
-- Let it catch up, then:
EXEC DBMS_ROLLING.SWITCHOVER;        -- the upgraded standby becomes primary
EXEC DBMS_ROLLING.FINISH_PLAN;       -- the old primary is upgraded by redo and rejoins

SELECT * FROM dba_rolling_status;
SELECT * FROM dba_rolling_plan;`},
{t:[['Step','What happens'],
['`INIT_PLAN`','Name the future primary and set options'],
['`BUILD_PLAN`','Generate the plan and check prerequisites'],
['`START_PLAN`','Convert the standby to a logical standby (keeping its identity)'],
['Upgrade','You upgrade the standby with the new software and run the upgrade scripts'],
['`SWITCHOVER`','Roles swap, applications go to the upgraded database'],
['`FINISH_PLAN`','The old primary is brought to the new version and returned to a physical standby']]},
{h:'Requirements'},
{ul:['A physical standby and the Data Guard broker.','Flashback Database on both databases.','Objects that a logical standby can support (check `DBA_LOGSTDBY_UNSUPPORTED`).','Enough space for the apply backlog during the upgrade.']},
{note:'Practise the whole procedure on a copy first. DBMS_ROLLING has many options and checks, and your first run should not be on production.'}],
src:[['DBMS_ROLLING',D+'arpls/DBMS_ROLLING.html'],['Rolling upgrades',O.DG]]};

/* ---------- 2: Transient logical ---------- */
L['ora-dg:9:2']={blocks:[
{p:'Before DBMS_ROLLING, the same idea was done by hand. Knowing the steps helps you understand what the package does and helps with older documents.'},
{h:'The manual transient logical standby method'},
{flow:['Create a guaranteed restore point on the standby (and primary) as a way back','Convert the physical standby to a logical standby, keeping identity','Upgrade the logical standby to the new release while SQL Apply keeps it in step','Switch over: the upgraded logical standby becomes primary','Convert the old primary to a physical standby of the new release by flashback and redo']},
{code:`-- Standby: stop apply, build the dictionary, then convert, keeping its identity
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE CANCEL;
ALTER DATABASE RECOVER TO LOGICAL STANDBY KEEP IDENTITY;
ALTER DATABASE OPEN;
ALTER DATABASE START LOGICAL STANDBY APPLY IMMEDIATE;`},
{t:[['Manual method','DBMS_ROLLING'],
['Many commands, easy to make mistakes','A plan generated and checked by the package'],
['You track each step','The package tracks and can roll back'],
['Documented in older guides','Documented and supported today']]},
{h:'When you may still need it'},
{ul:['Understanding documents from older releases.','Special situations where DBMS_ROLLING does not fit.']},
{note:'Use DBMS_ROLLING for new work. The manual method is shown for understanding only.'}],
src:[['Rolling upgrade using a transient logical standby',O.DG]]};

/* ---------- 3: 19c to 26ai ---------- */
L['ora-dg:9:3']={blocks:[
{p:'Upgrading from **19c to 26ai** with Data Guard has several options. The choice is between **downtime** and **complexity**. A direct 19c to 26ai upgrade path exists. Confirm it in the 26ai upgrade guide **[26ai]**.'},
{t:[['Method','Downtime','Complexity','Notes'],
['**Standard upgrade with the standby kept in sync**','Primary upgrade time (hours for a large database)','Low','Upgrade the primary. The standby, on the new software, applies the redo.'],
['**DBMS_ROLLING**','Switchover only (minutes)','Medium','Transient logical standby. Needs the supported objects.'],
['**GoldenGate**','Near zero','High','Separate subject, covered in the GoldenGate sub-course']]},
{h:'Standard method with Data Guard'},
{flow:['Install the 26ai software on both servers','Stop apply on the standby and shut it down','Upgrade the primary with AutoUpgrade (the primary opens in the new release)','Start the standby in MOUNT from the new home','Redo apply moves the standby to the new release']},
{h:'Multitenant'},
{p:'26ai supports CDB architecture only. Convert non-CDB databases to PDBs before or as part of the move, as explained in the Upgrade sub-course.'},
{h:'Preparation'},
{ul:['Run the AutoUpgrade analyze mode on the primary.','Check Data Guard broker and parameters on the new release.','Create guaranteed restore points on both databases.','Keep `COMPATIBLE` at the old value until you are sure.']},
{note:'Whatever the method, rehearse it on a copy of production, with the same Data Guard setup. The time you measure becomes your downtime estimate.'}],
src:[['Upgrading with Data Guard',O.DG],['26ai upgrade guide',O.D26]]};

/* ---------- 4: Fallback ---------- */
L['ora-dg:9:4']={blocks:[
{p:'An upgrade needs a **way back**. In a Data Guard setup you have several ways to fall back, depending on how far the change has gone.'},
{h:'Restore points'},
{code:`-- Before the upgrade, on both databases
CREATE RESTORE POINT before_upgrade GUARANTEE FLASHBACK DATABASE;

-- Later, if needed (only if COMPATIBLE was not raised)
FLASHBACK DATABASE TO RESTORE POINT before_upgrade;`},
{t:[['Situation','Fallback'],
['Problem found before the switchover','Stop. The old primary is untouched.'],
['Problem found soon after the switchover','Switch back, or flashback and reinstate'],
['Problem found after COMPATIBLE is raised','Flashback is no longer possible, so recover from backup or rebuild'],
['DBMS_ROLLING plan in progress','`DBMS_ROLLING.ROLLBACK_PLAN` where supported']]},
{h:'Keep the old path open'},
{ul:['Keep the **old Oracle home** and the old software.','Keep **COMPATIBLE** at the old value during the stabilisation period.','Keep the restore points until you are sure, and drop them afterwards (they use space).','Keep backups taken before the upgrade.']},
{flow:['Create guaranteed restore points on both databases','Upgrade and test','Decide: keep going, or flash back','When the new release is stable, raise COMPATIBLE and drop the restore points']},
{note:'A guaranteed restore point holds flashback logs and fills the recovery area if you forget it. Put a calendar reminder to drop it.'}],
src:[['Fallback during upgrades',O.DG]]};

/* ---------- 5: Practical ---------- */
L['ora-dg:9:5']={blocks:[
{p:'Patch a primary and its standby with **minimal downtime** using the standby-first method. Use a lab with a working broker configuration. Use a Release Update that supports standby-first (read its README).'},
{h:'Plan'},
{t:[['Step','Task','Impact'],
['1','Prepare: backups, restore point, `VALIDATE DATABASE`, new OPatch','None'],
['2','Standby: stop apply, patch home, start with the patched home in MOUNT, start apply','None for users'],
['3','Switchover to the standby','Short outage'],
['4','Patch the old primary home and start it as a standby','None'],
['5','Run `datapatch` on the new primary','Short, low impact'],
['6','Switchover back (optional) and verify','Short outage']]},
{h:'Commands to use'},
{code:`# Step 1
DGMGRL> VALIDATE DATABASE stby;
rman target /  ... BACKUP DATABASE PLUS ARCHIVELOG;

# Step 2 (standby host)
DGMGRL> EDIT DATABASE stby SET STATE = 'APPLY-OFF';
$ORACLE_HOME/OPatch/opatch apply /stage/ru/<patch> -oh $ORACLE_HOME     # after the database is shut down
# start the standby from the patched home in MOUNT
DGMGRL> EDIT DATABASE stby SET STATE = 'APPLY-ON';

# Step 3
DGMGRL> SWITCHOVER TO stby;

# Step 5 (new primary)
$ORACLE_HOME/OPatch/datapatch -verbose
SELECT patch_id, action, status FROM dba_registry_sqlpatch ORDER BY action_time DESC;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`opatch lspatches` on both homes','The new patch is listed'],
['`SHOW CONFIGURATION`','SUCCESS, standby applying'],
['`DBA_REGISTRY_SQLPATCH`','SUCCESS for the new patch'],
['Outage','Only the time of the switchover']]},
{h:'Challenge'},
{p:'Write the plan as a runbook with timings. Add a rollback step for each stage.'},
{note:'Time every step in the lab. The real downtime estimate comes from what you measure here.'}],
src:[['Standby-First patching',O.DG]]};

})();
