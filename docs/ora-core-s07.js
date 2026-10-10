/* LearnSphere - Oracle Core DBA, Section 07: Storage: Tablespaces, Datafiles & Undo.
   Lectures 0-8 are core, 9-14 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const layout=O.dg(700,230,[
[10,10,330,100,'Oracle system tablespaces',1],[30,45,140,50,'SYSTEM|data dictionary',0],[190,45,140,50,'SYSAUX|AWR, scheduler',0],
[360,10,330,100,'Special purpose',1],[380,45,140,50,'UNDO|rollback data',2],[540,45,130,50,'TEMP|sorts, work space',2],
[10,125,680,100,'Application tablespaces (you design these)',1],
[30,160,200,50,'APP_DATA|tables',2],[250,160,200,50,'APP_IDX|indexes',2],[470,160,200,50,'APP_LOB|large objects',0]],[]);

const undo=O.dg(700,160,[
[10,50,130,55,'Session A|UPDATE salary',0],[200,15,170,50,'Data block|new value 6000',0],[200,95,170,55,'Undo segment|old value 5000',2],[430,50,200,60,'Session B|SELECT reads old|value 5000 from undo',0]],
[[140,70,200,45],[140,90,200,115],[370,120,430,95]]);

/* ---------- 0: Tablespace types ---------- */
L['ora-core:6:0']={blocks:[
{p:'A **tablespace** is a named storage area made of one or more datafiles. Splitting data across several tablespaces gives you control over space, backup and performance.'},
{svg:layout},
{h:'Three kinds of tablespace'},
{t:[['Kind','Holds','Special rules'],
['**Permanent**','Tables, indexes and other objects','Normal data. Backed up and recovered.'],
['**Undo**','Old values of changed rows','Used by the instance only. Do not put tables here.'],
['**Temporary**','Sort and work data for one session','Not recovered. Can be re-created.']]},
{h:'Why separate application data'},
{t:[['Reason','Benefit'],
['**Space control**','One growing application cannot fill the others.'],
['**Backup and recovery**','Restore or move one tablespace without touching the rest.'],
['**Performance**','Place hot tablespaces on faster storage.'],
['**Housekeeping**','Drop a whole tablespace when an application retires.'],
['**Quotas and ownership**','Give each schema its own space limit.']]},
{h:'Do not store user data in SYSTEM or SYSAUX'},
{p:'SYSTEM holds the data dictionary and SYSAUX holds Oracle components such as AWR. If a user fills them, the database can stop working. Always set a default tablespace for each user.'},
{h:'Look at yours'},
{code:`SELECT tablespace_name, contents, status, block_size
FROM   dba_tablespaces ORDER BY tablespace_name;

SELECT property_name, property_value FROM database_properties
WHERE  property_name LIKE 'DEFAULT%TABLESPACE';`},
{flow:['Plan the data: tables, indexes, large objects','Create a tablespace for each group','Create users with a default tablespace and quota','Monitor space and add datafiles as it grows']},
{note:'In a CDB, the root and every PDB have their own SYSTEM, SYSAUX and default tablespaces. Application tablespaces are created inside the PDB.'}],
src:[['Managing tablespaces',O.AD+'managing-tablespaces.html'],['Logical storage structures',O.CN+'logical-storage-structures.html']]};

/* ---------- 1: Create and alter ---------- */
L['ora-core:6:1']={blocks:[
{p:'Tablespaces are created with a short SQL statement. The main choice is **smallfile or bigfile**.'},
{t:[['','Smallfile (default)','Bigfile'],
['**Datafiles per tablespace**','Many','Exactly one'],
['**Max size of a file (8 KB block)**','About 32 GB','About 32 TB (128 TB with 32 KB blocks)'],
['**Best for**','Most databases','Very large databases, ASM, simple management'],
['**Manage with**','Add or resize files','Resize the one file']]},
{h:'Create a tablespace'},
{code:`CREATE TABLESPACE app_data
  DATAFILE '/u02/oradata/ORCL/pdb1/app_data01.dbf' SIZE 1G
  AUTOEXTEND ON NEXT 256M MAXSIZE 10G
  EXTENT MANAGEMENT LOCAL
  SEGMENT SPACE MANAGEMENT AUTO;

CREATE BIGFILE TABLESPACE app_big
  DATAFILE '/u02/oradata/ORCL/pdb1/app_big01.dbf' SIZE 20G;`},
{h:'Change a tablespace'},
{t:[['Task','Statement'],
['Add a datafile','`ALTER TABLESPACE app_data ADD DATAFILE ... SIZE 1G;`'],
['Take offline or online','`ALTER TABLESPACE app_data OFFLINE;` and `ONLINE;`'],
['Make read only','`ALTER TABLESPACE app_data READ ONLY;`'],
['Rename','`ALTER TABLESPACE app_data RENAME TO shop_data;`'],
['Drop with files','`DROP TABLESPACE app_data INCLUDING CONTENTS AND DATAFILES;`']]},
{h:'Set the default for new users'},
{code:`ALTER DATABASE DEFAULT TABLESPACE app_data;        -- non-CDB or root
ALTER PLUGGABLE DATABASE DEFAULT TABLESPACE app_data;   -- inside a PDB
ALTER DATABASE DEFAULT TEMPORARY TABLESPACE temp;`},
{flow:['Decide the size and growth','CREATE TABLESPACE with AUTOEXTEND and a MAXSIZE','Verify in DBA_TABLESPACES and DBA_DATA_FILES','Assign it to users']},
{note:'Always set a MAXSIZE with AUTOEXTEND. Without it, one runaway load can fill the disk and stop everything on the server.'}],
src:[['Creating tablespaces',O.AD+'managing-tablespaces.html'],['CREATE TABLESPACE',D+'sqlrf/CREATE-TABLESPACE.html']]};

/* ---------- 2: Datafile management ---------- */
L['ora-core:6:2']={blocks:[
{p:'Datafiles grow, shrink and sometimes need to move. Oracle can do most of this **while the database is online**.'},
{h:'Autoextend and resize'},
{code:`-- Let a file grow automatically, with a ceiling
ALTER DATABASE DATAFILE '/u02/oradata/ORCL/pdb1/app_data01.dbf'
  AUTOEXTEND ON NEXT 128M MAXSIZE 8G;

-- Resize by hand
ALTER DATABASE DATAFILE '/u02/oradata/ORCL/pdb1/app_data01.dbf' RESIZE 2G;`},
{p:'You cannot shrink a file below the point where data is stored (ORA-03297). Reclaim space inside first (next lectures), then resize.'},
{h:'Move a datafile online'},
{code:`ALTER DATABASE MOVE DATAFILE '/u02/oradata/ORCL/pdb1/app_data01.dbf'
  TO '/u04/oradata/ORCL/pdb1/app_data01.dbf';`},
{flow:['Oracle copies the file while users keep working','Changes made during the copy are applied','The old file is removed (unless you add KEEP)']},
{h:'Check space'},
{code:`-- Used and free per tablespace (percentages include autoextend)
SELECT tablespace_name,
       ROUND(used_percent,1)               AS pct_used,
       ROUND(used_space*8/1024)            AS used_mb
FROM   dba_tablespace_usage_metrics
ORDER  BY used_percent DESC;

SELECT file_name, ROUND(bytes/1024/1024) AS mb, autoextensible, ROUND(maxbytes/1024/1024) AS max_mb
FROM   dba_data_files;`},
{t:[['Situation','Action'],
['Tablespace over 85 percent used','Add or enlarge a datafile'],
['File at MAXSIZE','Raise MAXSIZE or add another file'],
['Disk nearly full','Move the file or add storage first'],
['Space freed inside a tablespace','RESIZE the file down (as far as allowed)']]},
{note:'The usage view reports blocks of the default block size. Multiply by the block size of the tablespace if it is not 8 KB.'}],
src:[['Managing datafiles',O.AD+'managing-datafiles-and-tempfiles.html']]};

/* ---------- 3: OMF ---------- */
L['ora-core:6:3']={blocks:[
{p:'**Oracle Managed Files (OMF)** lets Oracle choose file names and locations. You set a destination once, and every datafile, redo log and control file is created and deleted for you.'},
{h:'Set it up'},
{code:`ALTER SYSTEM SET db_create_file_dest = '/u02/oradata' SCOPE = BOTH;
ALTER SYSTEM SET db_create_online_log_dest_1 = '/u02/oradata' SCOPE = BOTH;
ALTER SYSTEM SET db_recovery_file_dest = '/u03/fast_recovery_area' SCOPE = BOTH;`},
{h:'Use it'},
{code:`-- No file name needed
CREATE TABLESPACE app_data DATAFILE SIZE 1G AUTOEXTEND ON MAXSIZE 10G;

SELECT file_name FROM dba_data_files WHERE tablespace_name = 'APP_DATA';
-- /u02/oradata/ORCL/<GUID>/datafile/o1_mf_app_data_abc123_.dbf`},
{t:[['','Without OMF','With OMF'],
['**File names**','You choose','Oracle generates (o1_mf_...)'],
['**Folders**','You create','Oracle creates'],
['**DROP TABLESPACE**','Files need cleanup','Files are removed too'],
['**Risk**','Typos, wrong paths','Names are hard to read']]},
{h:'OMF parameters'},
{t:[['Parameter','Controls'],
['`DB_CREATE_FILE_DEST`','Default folder for datafiles and tempfiles'],
['`DB_CREATE_ONLINE_LOG_DEST_n`','Folders for redo logs and control files'],
['`DB_RECOVERY_FILE_DEST`','Fast Recovery Area']]},
{flow:['Set the destination parameters','Create objects without file names','Oracle names and places the files','Drop the object and Oracle deletes the files']},
{note:'ASM always uses OMF. If you may move to ASM, OMF now makes that step easier. The cost is file names you cannot read at a glance, so rely on the dictionary views to find files.'}],
src:[['Using Oracle Managed Files',O.AD+'using-oracle-managed-files.html']]};

/* ---------- 4: Extents, segments, ASSM ---------- */
L['ora-core:6:4']={blocks:[
{p:'Inside a tablespace, Oracle gives space to objects in **extents**. Two settings decide how: how extents are tracked, and how free space in blocks is tracked.'},
{h:'Locally managed tablespaces'},
{p:'Extents are tracked in a bitmap inside the datafile. This is the only sensible choice, and it is the default. The old dictionary-managed method is obsolete.'},
{t:[['Extent allocation','Behaviour'],
['`AUTOALLOCATE`','Oracle chooses extent sizes (64 KB, then 1 MB, 8 MB, 64 MB). Default.'],
['`UNIFORM SIZE n`','Every extent has the same size. Predictable.']]},
{h:'Automatic segment space management (ASSM)'},
{p:'ASSM uses bitmaps to track free space in each block. It reduces contention between sessions and removes old settings such as PCTUSED.'},
{h:'Segments you will meet'},
{t:[['Segment type','Example'],
['`TABLE`, `TABLE PARTITION`','Rows of a table'],
['`INDEX`','B-tree and bitmap indexes'],
['`LOBSEGMENT`','Large objects such as documents'],
['`TEMPORARY`','Temp data during a statement'],
['`UNDO`','Rollback data']]},
{h:'Deferred segment creation'},
{p:'A new empty table has **no segment** until the first row is inserted. This saves space when you create thousands of empty tables.'},
{code:`SELECT segment_name, segment_type, bytes/1024/1024 AS mb
FROM   dba_segments WHERE owner = 'HR' ORDER BY bytes DESC;

SELECT extent_id, blocks, bytes/1024 AS kb
FROM   dba_extents WHERE owner = 'HR' AND segment_name = 'EMPLOYEES'
ORDER  BY extent_id;`},
{flow:['A table needs more space','Oracle allocates a new extent from free space in the tablespace','The extent is added to the segment','ASSM tracks which blocks have room']},
{note:'Use the defaults: locally managed, AUTOALLOCATE and ASSM. They work well for almost everything and need no tuning.'}],
src:[['Managing space for schema objects',O.AD+'managing-space-for-schema-objects.html']]};

/* ---------- 5: Reclaiming space ---------- */
L['ora-core:6:5']={blocks:[
{p:'Deleting rows does not give disk space back. The segment keeps its blocks, and the **high-water mark** stays where it was. To return space, you reorganise.'},
{h:'The options'},
{t:[['Method','Command','Notes'],
['**Shrink**','`ALTER TABLE t SHRINK SPACE;`','Online. Needs ASSM and `ENABLE ROW MOVEMENT`.'],
['**Move online**','`ALTER TABLE t MOVE ONLINE;`','Rebuilds the table in place. Indexes are kept usable.'],
['**Rebuild index**','`ALTER INDEX i REBUILD ONLINE;`','Compacts an index without locking users.'],
['**Purge recycle bin**','`PURGE DBA_RECYCLEBIN;`','Dropped tables still occupy space until purged.'],
['**Drop what is unused**','`DROP TABLE ... PURGE;`','Old copies, test tables.']]},
{code:`ALTER TABLE lab_orders ENABLE ROW MOVEMENT;
ALTER TABLE lab_orders SHRINK SPACE CASCADE;     -- table and its indexes

-- Then give the space back to the disk
ALTER DATABASE DATAFILE '/u02/oradata/ORCL/pdb1/app_data01.dbf' RESIZE 2G;`},
{h:'Is there anything to reclaim?'},
{p:'The **Segment Advisor** looks for segments with wasted space. It runs automatically in the maintenance window, and you can run it yourself. Some advisor features belong to licensed packs, so check the Licensing guide before you use them.'},
{code:`-- Findings from the automatic Segment Advisor
SELECT segment_owner, segment_name, recommendations, allocated_space, reclaimable_space
FROM   TABLE(DBMS_SPACE.ASA_RECOMMENDATIONS());`},
{flow:['Find candidates: big segments with deleted data','Shrink or move them online','Rebuild or shrink their indexes','Resize the datafile to give disk space back']},
{note:'Shrink first, resize after. A resize will fail with ORA-03297 if data still sits at the end of the file.'}],
src:[['Reclaiming wasted space',O.AD+'managing-space-for-schema-objects.html'],['DBMS_SPACE',D+'arpls/DBMS_SPACE.html']]};

/* ---------- 6: Undo ---------- */
L['ora-core:6:6']={blocks:[
{p:'**Undo** holds the old version of data before it changes. It makes three things possible: **rollback**, **read consistency** and **flashback**.'},
{svg:undo},
{h:'What undo does'},
{t:[['Use','Meaning'],
['**Rollback**','Undo a transaction that was not committed'],
['**Read consistency**','Readers see data as it was when their query started, and nobody blocks'],
['**Flashback**','Query or restore older versions of data']]},
{h:'Key settings'},
{t:[['Setting','Meaning'],
['`UNDO_MANAGEMENT = AUTO`','Oracle manages undo segments (default)'],
['`UNDO_TABLESPACE`','The tablespace in use'],
['`UNDO_RETENTION`','Seconds to keep undo after commit (default 900)'],
['`RETENTION GUARANTEE`','Never overwrite undo within the retention time, even if DML fails for lack of space']]},
{h:'ORA-01555 snapshot too old'},
{p:'A long query needs old data that undo has already overwritten. Fix it by **raising `UNDO_RETENTION`** and giving the undo tablespace enough space, and by shortening the long query.'},
{h:'Size undo with a formula'},
{code:`undo space = undo_retention (seconds) x undo blocks per second x block size

-- Measure the current rate
SELECT MAX(undoblks/((end_time-begin_time)*86400)) AS blocks_per_sec FROM v$undostat;

-- Look for trouble
SELECT begin_time, undoblks, maxquerylen, ssolderrcnt, nospaceerrcnt, tuned_undoretention
FROM   v$undostat ORDER BY begin_time DESC FETCH FIRST 10 ROWS ONLY;`},
{t:[['V$UNDOSTAT column','Tells you'],
['`MAXQUERYLEN`','Longest query in seconds'],
['`SSOLDERRCNT`','ORA-01555 errors'],
['`NOSPACEERRCNT`','Undo space errors'],
['`TUNED_UNDORETENTION`','Retention Oracle currently achieves']]},
{flow:['Measure the undo rate in V$UNDOSTAT','Choose a retention longer than your longest query','Calculate the size and add margin','Create or resize the undo tablespace','Watch SSOLDERRCNT and NOSPACEERRCNT']},
{note:'In a CDB with local undo mode, each PDB has its own undo tablespace. The extra lecture on Local Undo shows the details.'}],
src:[['Managing undo',O.AD+'managing-undo.html'],['V$UNDOSTAT',O.RF+'V-UNDOSTAT.html']]};

/* ---------- 7: Temp ---------- */
L['ora-core:6:7']={blocks:[
{p:'**Temporary tablespaces** hold work space for sorts, hash joins, index builds and global temporary tables. They use **tempfiles**, which are not recovered after a crash because they hold nothing worth keeping.'},
{h:'Create and manage'},
{code:`CREATE TEMPORARY TABLESPACE temp2
  TEMPFILE '/u02/oradata/ORCL/pdb1/temp02.dbf' SIZE 1G
  AUTOEXTEND ON NEXT 256M MAXSIZE 8G;

ALTER DATABASE DEFAULT TEMPORARY TABLESPACE temp2;

ALTER TABLESPACE temp2 ADD TEMPFILE '/u02/oradata/ORCL/pdb1/temp03.dbf' SIZE 1G;`},
{h:'Temporary tablespace groups'},
{p:'A group is a named set of temp tablespaces. A user or the database can point to the group, and sessions spread across its members. Useful for many parallel sessions.'},
{code:`CREATE TEMPORARY TABLESPACE temp_a TEMPFILE SIZE 1G TABLESPACE GROUP temp_grp;
ALTER DATABASE DEFAULT TEMPORARY TABLESPACE temp_grp;`},
{h:'Who uses temp?'},
{code:`SELECT username, session_addr, tablespace, segtype, blocks*8/1024 AS mb
FROM   v$tempseg_usage;

SELECT tablespace_name, tablespace_size/1024/1024 AS mb, free_space/1024/1024 AS free_mb
FROM   dba_temp_free_space;`},
{h:'When temp runs out'},
{t:[['Symptom','Likely cause','Action'],
['ORA-01652 unable to extend temp segment','Large sort or hash join','Find the session, tune the SQL, or add tempfiles'],
['Temp grew huge and stays large','One heavy query earlier','`ALTER TABLESPACE temp SHRINK SPACE KEEP 2G;`']]},
{flow:['Query needs more memory than its work area allows','It spills to temp','Temp fills up','Find the session in V$TEMPSEG_USAGE and fix the cause']},
{note:'More temp space hides a bad query rather than fixing it. Check the plan of whatever fills temp.'}],
src:[['Managing temporary tablespaces',O.AD+'managing-tablespaces.html']]};

/* ---------- 8: Practical ---------- */
L['ora-core:6:8']={blocks:[
{p:'**Scenario.** A shop application starts with 5 GB of data and grows by about 1 GB per month. Design the storage, then resize it as it fills.'},
{h:'Step 1: Design'},
{t:[['Object type','Tablespace','Why'],
['Tables','`SHOP_DATA`','Main data'],
['Indexes','`SHOP_IDX`','Separate for space control'],
['Large objects (images)','`SHOP_LOB`','Grows differently'],
['Application user','Default `SHOP_DATA`, quota only there','Controls growth']]},
{h:'Step 2: Create'},
{code:`ALTER SESSION SET CONTAINER = FREEPDB1;

CREATE TABLESPACE shop_data DATAFILE SIZE 1G AUTOEXTEND ON NEXT 256M MAXSIZE 8G;
CREATE TABLESPACE shop_idx  DATAFILE SIZE 500M AUTOEXTEND ON NEXT 128M MAXSIZE 4G;

CREATE USER shop IDENTIFIED BY ChooseAPassword1
  DEFAULT TABLESPACE shop_data TEMPORARY TABLESPACE temp
  QUOTA 6G ON shop_data QUOTA 3G ON shop_idx;
GRANT CREATE SESSION, CREATE TABLE TO shop;`},
{h:'Step 3: Load and watch'},
{code:`CREATE TABLE shop.orders TABLESPACE shop_data AS
  SELECT level id, DBMS_RANDOM.STRING('U',20) note FROM dual CONNECT BY level <= 1000000;
CREATE INDEX shop.orders_ix ON shop.orders(id) TABLESPACE shop_idx;

SELECT tablespace_name, ROUND(used_percent,1) pct FROM dba_tablespace_usage_metrics
WHERE  tablespace_name LIKE 'SHOP%';`},
{h:'Step 4: Resize, shrink, move'},
{code:`DELETE FROM shop.orders WHERE id > 500000;  COMMIT;
ALTER TABLE shop.orders ENABLE ROW MOVEMENT;
ALTER TABLE shop.orders SHRINK SPACE CASCADE;

SELECT file_name FROM dba_data_files WHERE tablespace_name = 'SHOP_DATA';
ALTER DATABASE DATAFILE '<that file>' RESIZE 600M;`},
{h:'Step 5: Check undo'},
{code:`SELECT MAX(maxquerylen) AS longest_query_sec, SUM(ssolderrcnt) AS ora_01555
FROM   v$undostat;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`SHOP_DATA` and `SHOP_IDX` exist','Yes, both AUTOEXTEND with a MAXSIZE'],
['User `shop` default tablespace','`SHOP_DATA`'],
['After shrink and resize','The datafile is smaller than at the start'],
['`SSOLDERRCNT`','0']]},
{note:'Remember that this is your lab password only. In production use a strong, unique password stored in a vault.'}],
src:[['Managing tablespaces',O.AD+'managing-tablespaces.html'],['Managing undo',O.AD+'managing-undo.html']]};

})();
