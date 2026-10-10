/* LearnSphere - Backup & Recovery, Section 06: Multitenant Backup & Recovery.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const BR=O.D+'bradv/';

/* ---------- diagrams ---------- */
const cdb=O.dg(700,230,[
[10,10,680,210,'CDB (one set of redo, undo and control file)',1],
[30,45,180,60,'CDB$ROOT|(system, undo)',2],
[240,45,130,60,'PDB1|datafiles',0],[390,45,130,60,'PDB2|datafiles',0],[540,45,130,60,'PDB3|datafiles',0],
[30,130,640,70,'One RMAN backup can include the root and every PDB.|A PDB can also be backed up, restored and recovered alone.',0]],
[]);

/* ---------- 0: Backing up CDB and PDB ---------- */
L['ora-bkp:5:0']={blocks:[
{p:'A **CDB** is one database to RMAN. You can back up the whole CDB, only the root, or individual PDBs.'},
{svg:cdb},
{code:`rman target /

BACKUP DATABASE;                         -- root + all PDBs
BACKUP DATABASE ROOT;                    -- only CDB$ROOT
BACKUP PLUGGABLE DATABASE pdb1, pdb2;    -- specific PDBs
BACKUP TABLESPACE pdb1:users;            -- one tablespace in a PDB
BACKUP ARCHIVELOG ALL;`},
{t:[['What','Command'],
['Everything','`BACKUP DATABASE`'],
['Only the root','`BACKUP DATABASE ROOT`'],
['One or more PDBs','`BACKUP PLUGGABLE DATABASE name`'],
['A tablespace in a PDB','`BACKUP TABLESPACE pdb:ts`']]},
{note:'Redo, undo and control files belong to the **CDB**. There is only one archivelog stream, so archived logs are backed up at CDB level.'}],
src:[['Backup and recovery in CDBs',O.MT]]};

/* ---------- 1: Root vs PDB connection ---------- */
L['ora-bkp:5:1']={blocks:[
{p:'RMAN can connect to the **root** or directly to a **PDB**. What you can do depends on that choice.'},
{t:[['Connect to','Can do','Cannot do'],
['**CDB root** (`target /`)','Back up and recover the whole CDB, root or any PDB','Nothing blocked'],
['**A PDB** (`target sys@pdb1`)','Back up and recover **that PDB**, point-in-time of that PDB','Back up or recover other PDBs, the root, or archivelogs. No `RECOVER DATABASE` of the CDB.']]},
{code:`# from the root
rman target /
BACKUP PLUGGABLE DATABASE pdb1;

# connected to the PDB
rman target sys@pdb1
BACKUP DATABASE;            -- backs up pdb1 only
RESTORE DATABASE;           -- restores pdb1 only`},
{h:'Which to use?'},
{ul:['**DBA of the whole CDB:** connect to the root.','**A PDB administrator** with limited rights: connect to the PDB.','Local recovery of a PDB is faster and isolates the impact.']},
{note:'A common error: connecting to a PDB and expecting archived logs to be backed up. They belong to the CDB, so connect to the root for that.'}],
src:[['RMAN in multitenant',BR]]};

/* ---------- 2: Recover PDB datafile ---------- */
L['ora-bkp:5:2']={blocks:[
{p:'Recovering one PDB leaves the other PDBs and the root **fully open**.'},
{code:`-- a datafile of pdb1
rman target /
ALTER PLUGGABLE DATABASE pdb1 CLOSE IMMEDIATE;     -- if needed
RESTORE PLUGGABLE DATABASE pdb1;
RECOVER PLUGGABLE DATABASE pdb1;
ALTER PLUGGABLE DATABASE pdb1 OPEN;

-- only one datafile (with the PDB open if the file is not critical)
ALTER SESSION SET CONTAINER=pdb1;     -- in SQL*Plus
ALTER DATABASE DATAFILE 12 OFFLINE;
-- in RMAN:
RESTORE DATAFILE 12;
RECOVER DATAFILE 12;
-- back in SQL*Plus:
ALTER DATABASE DATAFILE 12 ONLINE;`},
{t:[['Scope','Others affected?'],
['A PDB datafile','No'],
['The whole PDB','No'],
['Root SYSTEM or UNDO','Yes, the whole CDB']]},
{note:'PDB-level recovery is one of the big operational advantages of multitenant. Practice it, since it makes outages smaller.'}],
src:[['Recovering a PDB',BR]]};

/* ---------- 3: PDB PITR ---------- */
L['ora-bkp:5:3']={blocks:[
{p:'You can return **one PDB** to a past time without touching any other PDB. This is **PDB point-in-time recovery (PDB PITR)**.'},
{code:`ALTER PLUGGABLE DATABASE pdb1 CLOSE IMMEDIATE;

RUN {
  SET UNTIL TIME "TO_DATE(\'2026-10-01 10:30:00\',\'YYYY-MM-DD HH24:MI:SS\')";
  RESTORE PLUGGABLE DATABASE pdb1;
  RECOVER PLUGGABLE DATABASE pdb1;
}
ALTER PLUGGABLE DATABASE pdb1 OPEN RESETLOGS;`},
{flow:['Close the PDB','Restore its datafiles from a backup before the target','Recover until the target time','Open with RESETLOGS (a PDB incarnation)','Take a new backup of the PDB']},
{h:'What happens behind the scenes'},
{ul:['RMAN restores an **auxiliary instance** with the root, undo and SYSAUX to apply the redo, then removes it. Needs temporary space.','Only the PDB gets a new incarnation.','Backups from before the PITR remain usable.']},
{note:'An alternative with less effort is **Flashback PDB** with a restore point, covered in the Flashback section.'}],
src:[['PDB point-in-time recovery',BR]]};

/* ---------- 4: Root and CDB ---------- */
L['ora-bkp:5:4']={blocks:[
{p:'When **root** files are lost, the **whole CDB** is down, because the root holds the dictionary and undo.'},
{t:[['Lost','Fix','Others affected'],
['Root SYSTEM or UNDO','Mount the CDB, restore and recover the root tablespace, open','All PDBs unavailable until open'],
['Root SYSAUX','Restore and recover, often with the CDB open','Limited'],
['Control file','Restore control file, mount, recover, RESETLOGS','Whole CDB'],
['Whole CDB','Restore everything, recover, RESETLOGS','Everything']]},
{code:`STARTUP MOUNT;
RESTORE DATABASE ROOT;
RECOVER DATABASE ROOT;
ALTER DATABASE OPEN;
-- then the PDBs:
RESTORE PLUGGABLE DATABASE pdb1, pdb2;
RECOVER PLUGGABLE DATABASE pdb1, pdb2;
ALTER PLUGGABLE DATABASE ALL OPEN;`},
{note:'Back up the root as carefully as any PDB. Because PDBs depend on it, a lost root is a lost CDB.'}],
src:[['Recovering the root',BR]]};

/* ---------- 5: Restore PDB to another CDB ---------- */
L['ora-bkp:5:5']={blocks:[
{p:'RMAN can **restore a PDB into another CDB**. This is a way to clone or to recover into a different environment.'},
{flow:['Take a backup of the PDB with metadata','On the target CDB, restore the PDB (it is plugged in)','Recover with archived logs','Open the PDB']},
{code:`-- source CDB
BACKUP PLUGGABLE DATABASE pdb1 PLUS ARCHIVELOG;

-- unplug is not needed. Use DUPLICATE with the PDB option on the target CDB:
rman target sys@srcCDB auxiliary sys@tgtCDB
DUPLICATE PLUGGABLE DATABASE pdb1 AS pdb1_copy
  FROM ACTIVE DATABASE;`},
{t:[['Method','Use'],
['`DUPLICATE PLUGGABLE DATABASE`','Create a copy in another CDB, from backup or active'],
['Unplug / plug with a manifest','Move a PDB'],
['`CREATE PLUGGABLE DATABASE ... FROM`','Remote clone through a database link']]},
{note:'Check version compatibility between the CDBs. The target must have the same or a higher release and patches that the PDB requires.'}],
src:[['Duplicating PDBs',BR]]};

/* ---------- 6: Practical ---------- */
L['ora-bkp:5:6']={blocks:[
{p:'Practise a **PDB point-in-time recovery**.'},
{code:`-- in SQL*Plus as sysdba, in the PDB
ALTER SESSION SET CONTAINER=pdb1;
CREATE TABLE app.important (id NUMBER, note VARCHAR2(50));
INSERT INTO app.important VALUES (1,\'before\'); COMMIT;
SELECT TO_CHAR(SYSDATE,\'YYYY-MM-DD HH24:MI:SS\') FROM dual;   -- note this time
DROP TABLE app.important PURGE;

-- in RMAN as root, after BACKUP PLUGGABLE DATABASE pdb1 PLUS ARCHIVELOG
ALTER PLUGGABLE DATABASE pdb1 CLOSE IMMEDIATE;
RUN {
  SET UNTIL TIME "TO_DATE(\'<time you noted>\',\'YYYY-MM-DD HH24:MI:SS\')";
  RESTORE PLUGGABLE DATABASE pdb1;
  RECOVER PLUGGABLE DATABASE pdb1;
}
ALTER PLUGGABLE DATABASE pdb1 OPEN RESETLOGS;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`app.important` exists','Yes, with the row "before"'],
['Other PDBs','Stayed open during the recovery'],
['`V$PDB_INCARNATION`','A new incarnation for pdb1'],
['New backup','Taken after the PITR']]},
{note:'You needed a time you wrote down, a backup before it, and archived logs after it. The same three things are needed in real life.'}],
src:[['PDB point-in-time recovery',BR]]};

})();
