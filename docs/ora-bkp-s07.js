/* LearnSphere - Backup & Recovery, Section 07: Flashback Technologies.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const BR=O.D+'bradv/';

/* ---------- diagrams ---------- */
const fb=O.dg(700,230,[
[10,10,330,210,'Based on UNDO',1],[30,45,290,40,'Flashback Query / Versions / Transaction',0],[30,100,290,40,'Flashback Table (and Drop via recycle bin)',0],[30,155,290,45,'No special setup. Limited by UNDO_RETENTION.',0],
[360,10,330,210,'Based on FLASHBACK LOGS',1],[380,45,290,40,'Flashback Database',0],[380,100,290,40,'Restore points (normal and guaranteed)',0],[380,155,290,45,'Needs Flashback on, uses the FRA',0]],[]);

/* ---------- 0: Overview ---------- */
L['ora-bkp:6:0']={blocks:[
{p:'**Flashback** fixes **logical errors** quickly, without a restore. Two engines sit under it: **undo** and **flashback logs**.'},
{svg:fb},
{t:[['Feature','Fixes','Uses'],
['**Flashback Query**','Reads old data','Undo'],
['**Flashback Versions / Transaction**','Shows what changed and who did it','Undo (and supplemental logging for transaction query)'],
['**Flashback Table**','Rewinds one table','Undo'],
['**Flashback Drop**','Brings back a dropped table','Recycle bin'],
['**Flashback Database**','Rewinds the whole database','Flashback logs in the FRA']]},
{h:'Limits'},
{ul:['Undo-based features reach back only as far as undo is kept (`UNDO_RETENTION` and space).','Flashback Database reaches back as far as `DB_FLASHBACK_RETENTION_TARGET` and FRA space allow.','Flashback is **not** a backup. It does not help with a lost datafile.']},
{note:'Flashback needs the datafiles to exist. It undoes **changes**, not **loss** of files. A missing datafile still needs restore.'}],
src:[['Flashback technology',BR]]};

/* ---------- 1: Query, versions, transaction ---------- */
L['ora-bkp:6:1']={blocks:[
{p:'Use these three to **find out** what happened and what the data looked like. They are read-only and need no outage.'},
{code:`-- data as of 10 minutes ago
SELECT * FROM app.orders AS OF TIMESTAMP (SYSTIMESTAMP - INTERVAL \'10\' MINUTE)
WHERE id = 42;

-- every version of a row in the last hour
SELECT versions_starttime, versions_operation, versions_xid, total
FROM app.orders
VERSIONS BETWEEN TIMESTAMP SYSTIMESTAMP - INTERVAL \'1\' HOUR AND SYSTIMESTAMP
WHERE id = 42;

-- what a transaction did (needs SELECT ANY TRANSACTION)
SELECT operation, table_name, undo_sql
FROM flashback_transaction_query
WHERE xid = HEXTORAW(\'0A001B00C3050000\');`},
{t:[['Tool','Answers'],
['`AS OF`','What did it look like at that time?'],
['`VERSIONS BETWEEN`','How did this row change, and in which transactions?'],
['`FLASHBACK_TRANSACTION_QUERY`','What did this transaction do? What is the undo SQL?']]},
{note:'You can recover a few rows without any rewind: `INSERT INTO t SELECT * FROM t AS OF TIMESTAMP ... WHERE ...`.'}],
src:[['Flashback Query',BR]]};

/* ---------- 2: Flashback Table and Recycle Bin ---------- */
L['ora-bkp:6:2']={blocks:[
{p:'**Flashback Table** returns one table to an earlier time. **Flashback Drop** brings back a dropped table from the **recycle bin**.'},
{code:`-- rewind a table (row movement must be enabled)
ALTER TABLE app.orders ENABLE ROW MOVEMENT;
FLASHBACK TABLE app.orders TO TIMESTAMP SYSTIMESTAMP - INTERVAL \'15\' MINUTE;

-- undo a drop
SELECT object_name, original_name, droptime FROM user_recyclebin;
FLASHBACK TABLE app.orders TO BEFORE DROP;
FLASHBACK TABLE app.orders TO BEFORE DROP RENAME TO orders_old;

-- clean the bin
PURGE RECYCLEBIN;
DROP TABLE app.orders PURGE;     -- no recycle bin`},
{t:[['Case','Works when'],
['Table rewind','Undo still holds the changes, row movement enabled'],
['Undrop','The table is still in the recycle bin and space was not needed'],
['`DROP ... PURGE`','Not recoverable by flashback']]},
{note:'Flashback Table does not revert DDL such as `TRUNCATE`. Use Flashback Database, or a restore, for that.'}],
src:[['Flashback Table and Drop',BR]]};

/* ---------- 3: Flashback Database ---------- */
L['ora-bkp:6:3']={blocks:[
{p:'**Flashback Database** rewinds the **whole database** to an earlier point, much faster than restore and recover, because it only undoes changed blocks.'},
{code:`-- enable (database in ARCHIVELOG, FRA configured)
ALTER SYSTEM SET db_flashback_retention_target=1440;     -- minutes
ALTER DATABASE FLASHBACK ON;

SELECT flashback_on, oldest_flashback_scn, oldest_flashback_time FROM v$database;

-- rewind
SHUTDOWN IMMEDIATE
STARTUP MOUNT
FLASHBACK DATABASE TO TIMESTAMP SYSDATE - 1/24;
ALTER DATABASE OPEN RESETLOGS;`},
{t:[['','Restore + recover','Flashback Database'],
['**Speed**','Depends on database size','Depends on the amount of change'],
['**Needs**','Backups and archived logs','Flashback logs in FRA'],
['**Granularity**','Any point in the backup window','Within retention target'],
['**Cannot fix**','Nothing about files','Lost or shrunk datafiles']]},
{note:'Flashback logs add I/O and space. Size the FRA for them, and set a retention target that matches how fast you notice mistakes.'}],
src:[['Flashback Database',BR]]};

/* ---------- 4: Restore points ---------- */
L['ora-bkp:6:4']={blocks:[
{p:'A **restore point** is a name for an SCN. A **guaranteed** restore point also forces the database to keep the flashback logs needed to return to it.'},
{code:`-- normal: a label for an SCN, may age out
CREATE RESTORE POINT before_release;

-- guaranteed: logs are kept until you drop it
CREATE RESTORE POINT before_release GUARANTEE FLASHBACK DATABASE;

SELECT name, scn, guarantee_flashback_database, storage_size FROM v$restore_point;

FLASHBACK DATABASE TO RESTORE POINT before_release;
DROP RESTORE POINT before_release;`},
{t:[['','Normal','Guaranteed'],
['**Kept**','Until it ages out of the retention target','Until you drop it'],
['**Requires Flashback ON**','Yes, to use it','No. Works even with Flashback off.'],
['**Risk**','Gone if not used in time','Fills the FRA if forgotten']]},
{h:'Use case'},
{flow:['Before a release or a patch, create a guaranteed restore point','Run the change','If it fails: FLASHBACK DATABASE TO RESTORE POINT','If it succeeds: drop the restore point']},
{note:'Always **drop** guaranteed restore points when done. An old one keeps all flashback logs and can fill the FRA.'}],
src:[['Restore points',BR]]};

/* ---------- 5: Flashback in multitenant ---------- */
L['ora-bkp:6:5']={blocks:[
{p:'In a CDB, flashback works at **CDB level** and also at **PDB level**.'},
{t:[['Feature','In a CDB','Notes'],
['**Flashback Database** of the CDB','Rewinds the root and all PDBs','Flashback on at CDB level'],
['**Flashback a PDB**','Rewinds one PDB to a time or restore point','Other PDBs stay open. PDB incarnation changes.'],
['**PDB restore points**','`CREATE RESTORE POINT name FOR PLUGGABLE DATABASE pdb1`','Also guaranteed variants'],
['**Flashback Query / Table**','Inside a PDB as usual','Undo is local to the PDB in local undo mode']]},
{code:`CREATE RESTORE POINT rp_pdb1 FOR PLUGGABLE DATABASE pdb1 GUARANTEE FLASHBACK DATABASE;

ALTER PLUGGABLE DATABASE pdb1 CLOSE;
FLASHBACK PLUGGABLE DATABASE pdb1 TO RESTORE POINT rp_pdb1;
ALTER PLUGGABLE DATABASE pdb1 OPEN RESETLOGS;`},
{note:'PDB flashback depends on **local undo** mode (default in new CDBs). In shared undo mode it needs more steps. Check `DATABASE_PROPERTIES` for `LOCAL_UNDO_ENABLED`.'}],
src:[['Flashback in multitenant',O.MT]]};

/* ---------- 6: Practical ---------- */
L['ora-bkp:6:6']={blocks:[
{p:'**Undo a bad release** with a guaranteed restore point. Use a test database.'},
{code:`-- 1. protect
CREATE RESTORE POINT before_rel GUARANTEE FLASHBACK DATABASE;

-- 2. the "release"
CREATE TABLE app.new_feature (id NUMBER);
ALTER TABLE app.orders ADD (discount NUMBER);
UPDATE app.orders SET total = total * 0.5; COMMIT;

-- 3. it is wrong. Roll back
SHUTDOWN IMMEDIATE
STARTUP MOUNT
FLASHBACK DATABASE TO RESTORE POINT before_rel;
ALTER DATABASE OPEN RESETLOGS;

-- 4. cleanup
DROP RESTORE POINT before_rel;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`app.new_feature`','Does not exist'],
['`app.orders.discount`','Column gone'],
['`total` values','Original'],
['`V$RESTORE_POINT`','Empty after the drop'],
['FRA space','Reclaimed']]},
{note:'The whole rollback took seconds to minutes, compared with a restore. This is why a guaranteed restore point is standard before major changes.'}],
src:[['Flashback and restore points',BR]]};

})();
