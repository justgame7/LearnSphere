/* LearnSphere - Backup & Recovery, Section 01: Backup & Recovery Foundations.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const BR=O.D+'bradv/',BRB=O.D+'bradv/';

/* ---------- diagrams ---------- */
const rec=O.dg(700,190,[
[10,50,150,80,'Backup|(old copy of data)',0],
[200,50,150,80,'Roll forward|apply redo|(redo logs)',2],
[390,50,150,80,'Roll back|undo uncommitted|(undo)',2],
[580,50,110,80,'Consistent|database',0]],
[[160,90,200,90],[350,90,390,90],[540,90,580,90]]);

/* ---------- 0: Failure types ---------- */
L['ora-bkp:0:0']={blocks:[
{p:'Before choosing a backup method, know **what can fail**. Each failure type has a different fix, and only some need a backup.'},
{t:[['Failure','Example','Who fixes it','Needs a backup?'],
['**Statement**','A bad INSERT, a full tablespace','Oracle rolls the statement back. You fix the cause (space, privilege).','No'],
['**Process**','A user session or server process dies','**PMON** cleans up and rolls back its transaction','No'],
['**User error**','`DROP TABLE`, a wrong `DELETE` committed','You: **Flashback**, or recover from backup','Sometimes'],
['**Instance**','Power loss, `SHUTDOWN ABORT`, OS crash','**SMON** performs instance recovery at the next startup, automatically','No'],
['**Network**','Listener down, network break','Fix the network. Sessions reconnect.','No'],
['**Media**','Disk or datafile lost or corrupt','You: **restore** from backup and **recover** with redo','**Yes**']]},
{flow:['A failure happens','Classify it: statement, process, user, instance, network or media','Use the matching fix','Only for media and some user errors, restore and recover']},
{note:'Instance recovery is automatic and needs no backup, because the online redo logs hold every committed change. Backups are for **media** failure and for user errors you cannot flash back.'}],
src:[['Backup and Recovery User\'s Guide',BR]]};

/* ---------- 1: RTO, RPO, strategy ---------- */
L['ora-bkp:0:1']={blocks:[
{p:'A backup strategy starts from two business numbers, not from a tool.'},
{t:[['Term','Question it answers','Drives'],
['**RPO**','How much data can we lose?','Backup frequency, archived log backups, standby (Data Guard)'],
['**RTO**','How long can we be down?','Restore speed: backup type, parallelism, storage, standby']]},
{h:'From numbers to design'},
{t:[['If the business says','Then consider'],
['RPO of 24 hours','Daily backup'],
['RPO of 15 minutes','Frequent archived log backups'],
['RPO near 0','Data Guard (synchronous) or Recovery Appliance real-time redo'],
['RTO of hours','Backups to disk, incremental, parallel restore'],
['RTO of minutes','Standby database, Flashback Database, image copy switch']]},
{h:'Also decide'},
{ul:['**Retention:** how far back you can restore (days, weeks, years for compliance).','**Where:** disk, tape, object storage, and a second site.','**Who tests restores**, and how often.']},
{note:'Write RPO and RTO per database, get the business to sign, then design. A strategy that was never tested against its RTO is a guess.'}],
src:[['Backup and Recovery User\'s Guide',BR]]};

/* ---------- 2: Backup types ---------- */
L['ora-bkp:0:2']={blocks:[
{p:'Backups are described along several independent axes. You combine one value from each.'},
{t:[['Axis','Choices','Meaning'],
['**Physical vs logical**','Physical: datafile blocks (RMAN). Logical: rows and objects (Data Pump export).','Physical restores the whole database. Logical moves or restores objects.'],
['**Full vs incremental**','Full: all used blocks. Incremental: only blocks changed since a previous backup.','Incremental saves time and space'],
['**Whole vs partial**','Whole database, or tablespace, datafile, PDB','Partial is faster for one object'],
['**Consistent vs inconsistent**','Consistent: taken with the database closed cleanly (all SCNs equal). Inconsistent: taken while open.','Inconsistent needs **redo** applied at recovery'],
['**Online vs offline**','Taken while open (hot) or closed (cold)','Online needs ARCHIVELOG mode']]},
{h:'What this means in practice'},
{ul:['Almost all production backups are **physical, online, inconsistent**. RMAN plus archived redo makes them recoverable.','A **consistent** backup is usable without any redo, but needs downtime.','Logical backups (Data Pump) are **not** a substitute for physical backups. They cannot do point-in-time recovery of the whole database.']},
{note:'An inconsistent backup is perfectly valid, as long as you also have the archived redo logs from the time of the backup onward. Lose a log and the recovery stops at that point.'}],
src:[['Backup and Recovery concepts',BR]]};

/* ---------- 3: How recovery works ---------- */
L['ora-bkp:0:3']={blocks:[
{p:'Recovery is two steps. Oracle first **rolls forward** by replaying redo, then **rolls back** uncommitted work using undo. The **SCN** is the clock that keeps it all in order.'},
{svg:rec},
{t:[['Piece','Role in recovery'],
['**Redo log**','Every change made. Used to roll forward. Archived copies are the history.'],
['**Undo**','Before images of changed data. Used to roll back uncommitted transactions.'],
['**SCN**','System Change Number, the database timestamp. Recovery targets an SCN or a time.'],
['**Checkpoint**','Writes dirty blocks to the datafiles and records an SCN. Recovery starts from there.'],
['**Control file**','Holds the checkpoint SCNs and the list of files and backups']]},
{h:'Two recovery kinds'},
{t:[['Kind','Needs','Result'],
['**Instance recovery**','Online redo logs','Automatic at open'],
['**Media recovery**','Restored datafile + archived and online redo','You run `RECOVER`. **Complete** (to the latest) or **incomplete** (to a chosen point).']]},
{note:'Never delete archived logs that a backup still needs. The restored datafile is old, and only the redo from that point forward can bring it current.'}],
src:[['Backup and Recovery User\'s Guide',BR],['Concepts: instance recovery',O.CN]]};

/* ---------- 4: The toolbox ---------- */
L['ora-bkp:0:4']={blocks:[
{p:'Oracle gives several tools. Each answers a different question. Use the **right one**, not just RMAN.'},
{t:[['Tool','Best for','Not for'],
['**RMAN**','Physical backup, restore, recover, duplicate','Moving single rows between systems'],
['**Data Pump**','Logical export and import, migration, refreshing test data','Point-in-time recovery of a database'],
['**Flashback**','Undo recent logical errors fast (query, table, database)','Media failure. Flashback needs the files.'],
['**Data Guard**','Site failure and near-zero RPO and RTO','Protect against a mistake that was already shipped (use a delayed apply or Flashback)'],
['**Recovery Appliance (ZDLRA)**','Fleet backups, real-time redo, zero data loss','Small single databases']]},
{h:'How they combine'},
{flow:['Backups (RMAN) protect against media failure','Flashback fixes recent human error','Data Guard survives a site loss','Data Pump moves and refreshes data']},
{note:'Backup and DR are two different layers. A standby does not replace a backup, because it copies a bad `DROP` as faithfully as a good change.'}],
src:[['Backup and Recovery User\'s Guide',BR],['Data Guard',O.DG]]};

/* ---------- 5: ARCHIVELOG and FRA ---------- */
L['ora-bkp:0:5']={blocks:[
{p:'Without **ARCHIVELOG mode**, old redo is overwritten and only cold, consistent backups work. Production databases must run in ARCHIVELOG mode. The **Fast Recovery Area (FRA)** is the default landing place for backups, archived logs and flashback logs.'},
{h:'Check and enable'},
{code:`SELECT log_mode, flashback_on FROM v$database;
ARCHIVE LOG LIST;

-- set the FRA first
ALTER SYSTEM SET db_recovery_file_dest_size=200G SCOPE=BOTH;
ALTER SYSTEM SET db_recovery_file_dest='+FRA' SCOPE=BOTH;

-- switch to ARCHIVELOG (needs a restart to MOUNT)
SHUTDOWN IMMEDIATE
STARTUP MOUNT
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;`},
{h:'What the FRA holds'},
{t:[['Content','Notes'],
['Archived redo logs','Deleted automatically when no longer needed (and backed up)'],
['RMAN backups and copies','Subject to the retention policy'],
['Flashback logs','Only if Flashback Database is on'],
['Control file and redo copies','Multiplexed copies']]},
{h:'Watch the space'},
{code:`SELECT * FROM v$recovery_file_dest;
SELECT * FROM v$flash_recovery_area_usage;`},
{note:'If the FRA fills up, the database can hang with ORA-19809 or ORA-00257 because it cannot archive. Size it for backups plus archived logs, and monitor it.'}],
src:[['Fast Recovery Area',BR]]};

/* ---------- 6: Practical ---------- */
L['ora-bkp:0:6']={blocks:[
{p:'Write a **backup strategy** for a sample business. This is a paper exercise. The result is a one-page plan you can defend.'},
{h:'The business'},
{t:[['Item','Value'],
['System','Online orders database, 800 GB, 24x7'],
['Business says','We can lose up to 15 minutes. We must be back within 2 hours.'],
['Peak change','About 20 GB of redo per day'],
['Legal','Keep 1 year of monthly backups'],
['Sites','Primary data center, plus a second site 50 km away']]},
{h:'Fill in the plan'},
{t:[['Decision','Your answer'],
['RPO and RTO','From the table above'],
['Mode','ARCHIVELOG, FRA size?'],
['Weekly / daily backup','Level 0 weekly, level 1 daily?'],
['Archived log backup frequency','Every how many minutes?'],
['Where backups go','Disk + second site + object storage?'],
['Retention','Recovery window of how many days?'],
['DR','Do you need a standby to meet RTO?'],
['Test','When do you rehearse a full restore?']]},
{h:'Check your result'},
{ul:['Archived logs are backed up at least every 15 minutes (RPO).','A full restore plus apply fits in 2 hours, or a standby is added.','Backups exist at a second site.','Long-term retention is covered separately from the recovery window.']},
{note:'A plan with no restore test date is incomplete. Put a date in the table.'}],
src:[['Backup and Recovery User\'s Guide',BR]]};

})();
