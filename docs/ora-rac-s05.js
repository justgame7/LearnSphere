/* LearnSphere - Grid Infrastructure, ASM & RAC, Section 05: ASM Administration.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const asm=O.dg(700,260,[
[10,10,200,110,'Database instance|asks ASM where the|file extents are',0],
[250,10,200,110,'ASM instance|manages disk groups|and extent maps',2],
[490,10,200,110,'Clients|RMAN, dbca, ACFS|also use ASM',0],
[10,140,680,110,'Disk group DATA (a pool of disks, mirrored by failure group)',1],
[30,175,190,55,'Failure group 1|disk A, disk B',0],[250,175,190,55,'Failure group 2|disk C, disk D',0],[470,175,200,55,'Files are cut into extents|and spread across all disks',2]],
[[210,65,250,65],[450,65,490,65]]);

const mirror=O.dg(700,170,[
[10,20,210,130,'External',1],[25,55,180,35,'No ASM mirror',0],[25,100,180,35,'Storage array mirrors',0],
[245,20,210,130,'Normal',1],[260,55,180,35,'2 copies of each extent',0],[260,100,180,35,'At least 2 failure groups',0],
[480,20,210,130,'High',1],[495,55,180,35,'3 copies of each extent',0],[495,100,180,35,'At least 3 failure groups',0]],[]);

/* ---------- 0: ASM architecture ---------- */
L['ora-rac:4:0']={blocks:[
{p:'**Automatic Storage Management (ASM)** is Oracle volume manager and file system for database files. It takes raw disks, groups them, mirrors and balances the data, and presents the result to the database as files.'},
{svg:asm},
{h:'The building blocks'},
{t:[['Term','Meaning'],
['**ASM instance**','A small instance (`+ASM1`, `+ASM2`) that manages disk groups. It does not store your data itself.'],
['**Disk group**','A pool of disks managed as one unit. The database sees disk groups, not disks.'],
['**ASM disk**','A LUN or partition given to ASM'],
['**Failure group**','Disks that fail together, for example all disks on one controller. ASM never puts both mirror copies in one failure group.'],
['**Allocation unit (AU)**','The basic unit of space (default 1 MB, often 4 MB for large databases)'],
['**Extent**','A group of AUs that make a piece of a file']]},
{h:'How a database uses ASM'},
{flow:['The database instance opens a file in +DATA','ASM tells it where the extents are','The database reads and writes the disks directly (I/O does not go through the ASM instance)','ASM keeps mirrors in step and rebalances when disks change']},
{h:'File names in ASM'},
{code:`+DATA/ORCL/DATAFILE/USERS.259.1157234567
+FRA/ORCL/ARCHIVELOG/2026_01_15/thread_1_seq_42.261.1157234890`},
{p:'You almost never type these names. Oracle Managed Files creates and tracks them for you.'},
{note:'ASM spreads every file across all disks of the group (striping), so there is no hot disk to tune. Add a disk and ASM rebalances automatically.'}],
src:[['ASM concepts',O.ASM],['ASM Administrator Guide',O.ASM]]};

/* ---------- 1: Redundancy ---------- */
L['ora-rac:4:1']={blocks:[
{p:'**Redundancy** decides how many copies ASM keeps of each extent. You choose it when you create the disk group.'},
{svg:mirror},
{t:[['Redundancy','Copies','Failure groups needed','Usable space','Use'],
['**External**','1 (storage mirrors)','Any','100 percent of raw','Storage array already protects the data'],
['**Normal**','2','At least 2','About 50 percent','Most production systems'],
['**High**','3','At least 3','About 33 percent','Critical systems, stretched clusters'],
['**Flex**','Per file group','At least 3','Varies','Different protection for each database or file']]},
{h:'Failure groups'},
{p:'ASM puts the copies of an extent in **different failure groups**. By default each disk is its own failure group. For disks on the same controller or shelf, group them manually so a hardware failure cannot take both copies.'},
{code:`CREATE DISKGROUP DATA NORMAL REDUNDANCY
  FAILGROUP fg1 DISK '/dev/oracleasm/d1','/dev/oracleasm/d2'
  FAILGROUP fg2 DISK '/dev/oracleasm/d3','/dev/oracleasm/d4';`},
{h:'Free space for recovery'},
{t:[['Column in V$ASM_DISKGROUP','Meaning'],
['`FREE_MB`','Raw free space'],
['`REQUIRED_MIRROR_FREE_MB`','Space that must stay free to rebuild after a failure'],
['`USABLE_FILE_MB`','Space you can really use for new files (can go negative)']]},
{note:'If `USABLE_FILE_MB` goes negative, a disk failure may leave ASM without room to restore redundancy. Monitor it, not just FREE_MB.'}],
src:[['ASM disk group redundancy',O.ASM]]};

/* ---------- 2: Disk discovery ---------- */
L['ora-rac:4:2']={blocks:[
{p:'ASM must find its disks. It looks at the paths named by `ASM_DISKSTRING` and reads the **header** of each disk to learn its role.'},
{h:'asm_diskstring'},
{code:`SHOW PARAMETER asm_diskstring
-- /dev/oracleasm/*

ALTER SYSTEM SET asm_diskstring = '/dev/oracleasm/*' SCOPE = BOTH SID = '*';`},
{p:'Make the string match the persistent names from section 2 (udev) or the AFD labels, and nothing else. A string that is too wide can list disks you never meant to use.'},
{h:'Disk header status'},
{t:[['HEADER_STATUS','Meaning'],
['`CANDIDATE`','Never used by ASM. Free to add.'],
['`PROVISIONED`','Prepared by AFD or ASMLib. Free to add.'],
['`MEMBER`','Belongs to a mounted disk group'],
['`FORMER`','Was a member, now dropped. Can be reused.'],
['`FOREIGN`','Used by something else. Do not use.']]},
{code:`SELECT path, header_status, mount_status, mode_status, total_mb FROM v$asm_disk ORDER BY path;
asmcmd lsdsk -k`},
{h:'ASM Filter Driver (AFD)'},
{p:'**AFD** is an Oracle kernel driver that labels disks and **blocks writes that do not come from Oracle** (for example a stray `dd` command). It replaces ASMLib and udev rules where it is available.'},
{code:`asmcmd afd_lslbl                              # list labels
asmcmd afd_label DATA1 /dev/sdd --migrate      # label a disk (as root, with the right environment)`},
{flow:['Disks are presented to all nodes','Persistent names or AFD labels make them stable','ASM_DISKSTRING lets ASM find them','Header status tells you whether they are free']},
{note:'Never reuse a disk with header status MEMBER or FOREIGN. Check V$ASM_DISK before you add a disk to a disk group.'}],
src:[['ASM disk discovery',O.ASM],['ASM Filter Driver',O.ASM]]};

/* ---------- 3: Create and alter ---------- */
L['ora-rac:4:3']={blocks:[
{p:'Disk group changes are normal SQL, run as `SYSASM` in the ASM instance. Most are **online**: users keep working while ASM moves data.'},
{h:'Create'},
{code:`CREATE DISKGROUP DATA NORMAL REDUNDANCY
  FAILGROUP fg1 DISK '/dev/oracleasm/d1','/dev/oracleasm/d2'
  FAILGROUP fg2 DISK '/dev/oracleasm/d3','/dev/oracleasm/d4'
  ATTRIBUTE 'au_size'='4M','compatible.asm'='19.0','compatible.rdbms'='19.0';`},
{h:'Change'},
{t:[['Task','Statement'],
['Add a disk','`ALTER DISKGROUP DATA ADD DISK \'/dev/oracleasm/d5\' REBALANCE POWER 4;`'],
['Drop a disk','`ALTER DISKGROUP DATA DROP DISK DATA_0004;`'],
['Add and drop together','`ALTER DISKGROUP DATA ADD DISK \'/dev/oracleasm/d6\' DROP DISK DATA_0001;`'],
['Resize disks','`ALTER DISKGROUP DATA RESIZE ALL SIZE 200G;`'],
['Dismount / mount','`ALTER DISKGROUP DATA DISMOUNT;` and `MOUNT;`'],
['Drop a disk group','`DROP DISKGROUP DATA INCLUDING CONTENTS;` (empty first or use INCLUDING)']]},
{h:'Check'},
{code:`SELECT name, state, type, total_mb, free_mb, usable_file_mb FROM v$asm_diskgroup;
SELECT group_number, disk_number, name, path, state, failgroup FROM v$asm_disk ORDER BY group_number, disk_number;`},
{flow:['Add the new disk to the disk group','ASM starts a rebalance automatically','Users keep working during it','When the rebalance finishes, the data is spread over all disks']},
{note:'Do the add and drop in one statement when replacing a disk. ASM then rebalances once instead of twice. Check that the disk group has enough free space to hold the data without the dropped disk.'}],
src:[['Administering ASM disk groups',O.ASM]]};

/* ---------- 4: Rebalance ---------- */
L['ora-rac:4:4']={blocks:[
{p:'When disks are added or dropped, ASM **rebalances**: it moves extents so that data and I/O are spread evenly again. You control the speed with the **power**.'},
{h:'Power'},
{t:[['Setting','Meaning'],
['`ASM_POWER_LIMIT` (parameter)','Default power when none is given. Default is 1.'],
['`REBALANCE POWER n`','Power for this operation (0 to 1024)'],
['`POWER 0`','Pause the rebalance']]},
{code:`ALTER DISKGROUP DATA REBALANCE POWER 8;

-- Watch it
SELECT group_number, operation, state, power, sofar, est_work, est_rate, est_minutes
FROM   v$asm_operation;`},
{t:[['Power','Effect'],
['Low (1 to 2)','Slow, small impact on users. Good in busy hours.'],
['Medium (4 to 8)','A balance'],
['High (16 and above)','Fast, but competes with the workload for I/O']]},
{h:'What happens during a rebalance'},
{flow:['A disk is added or dropped','ASM computes where extents should move','It copies extents in small steps, keeping mirrors correct','V$ASM_OPERATION shows progress','The disk group is balanced and the operation disappears from the view']},
{h:'Practical advice'},
{ul:['Start low in business hours, raise it overnight.','Do not stack many changes. Wait for the rebalance to end.','Always check free space first, especially before a drop.','If `V$ASM_OPERATION` is empty, no rebalance is running.']},
{note:'If the rebalance is slow because of high load, do not kill it. Lower the power and let it continue. An interrupted rebalance restarts later and leaves the disk group less protected until it finishes.'}],
src:[['ASM rebalance',O.ASM]]};

/* ---------- 5: Attributes ---------- */
L['ora-rac:4:5']={blocks:[
{p:'Disk group **attributes** control features and compatibility. Some can only be set at creation, and compatibility attributes can only go **up**.'},
{t:[['Attribute','Meaning','Notes'],
['`compatible.asm`','Minimum ASM software version that can mount the group','Raise, never lower'],
['`compatible.rdbms`','Minimum database version that can use the group','Raise, never lower'],
['`au_size`','Allocation unit size (1, 2, 4, 8, 16, 32, 64 MB)','Set at **creation only**'],
['`disk_repair_time`','How long a disk may be offline before ASM drops it','Default 3.6 hours'],
['`sector_size`','Logical sector size (512 or 4096)','Set at creation'],
['`access_control.enabled`','Use file-level ACLs','Off by default']]},
{code:`SELECT name, value FROM v$asm_attribute a JOIN v$asm_diskgroup g ON g.group_number = a.group_number WHERE g.name = 'DATA';

ALTER DISKGROUP DATA SET ATTRIBUTE 'compatible.asm' = '19.0';
ALTER DISKGROUP DATA SET ATTRIBUTE 'disk_repair_time' = '8h';`},
{h:'Fast mirror resync'},
{p:'If a disk goes offline for a short time (a cable or controller problem), ASM remembers the changes. When the disk returns within `disk_repair_time`, it only **resynchronises the changed extents** instead of rebuilding the whole disk.'},
{flow:['A disk becomes unavailable','ASM takes it offline and tracks changes','The disk returns within the repair time: fast resync','The disk does not return in time: ASM drops it and rebalances']},
{h:'Compatibility'},
{ul:['Raise `compatible.asm` and `compatible.rdbms` only after all software uses the new release.','Features such as Flex redundancy need a high enough `compatible.asm`.','Setting too low blocks new features, setting too high blocks old databases.']},
{note:'Compatibility changes cannot be undone. Test the effect on a copy, and write down the values before and after.'}],
src:[['Disk group attributes',O.ASM]]};

/* ---------- 6: ASMCMD ---------- */
L['ora-rac:4:6']={blocks:[
{p:'**ASMCMD** is a command-line tool that looks like a shell for ASM. It is the quickest way to see and manage files. **SQL*Plus as SYSASM** does the structural work.'},
{h:'Start it'},
{code:`# As grid, with the ASM environment
. oraenv                 # ORACLE_SID=+ASM1
asmcmd
ASMCMD> lsdg`},
{h:'Useful ASMCMD commands'},
{t:[['Command','Use'],
['`lsdg`','List disk groups with sizes and state'],
['`lsdsk -k`','List disks and their details'],
['`ls +DATA/ORCL/`','List files and folders'],
['`du +DATA/ORCL`','Space used'],
['`find +DATA "*.dbf"`','Search by pattern'],
['`cp`','Copy files in or out of ASM'],
['`lsct`','List the database clients of ASM'],
['`spget` / `pwget`','Show the SPFILE and password file locations'],
['`md_backup`','Back up disk group metadata']]},
{h:'SQL views for ASM'},
{t:[['View','Shows'],
['`V$ASM_DISKGROUP`','Disk groups, free and usable space'],
['`V$ASM_DISK`','Each disk and its status'],
['`V$ASM_FILE`','Files in each disk group'],
['`V$ASM_CLIENT`','Databases using ASM'],
['`V$ASM_OPERATION`','Rebalances in progress']]},
{code:`sqlplus / as sysasm
SELECT name, free_mb, usable_file_mb FROM v$asm_diskgroup;
SELECT * FROM v$asm_client;

srvctl status asm
srvctl config asm`},
{flow:['Use asmcmd to look around','Use SQL*Plus for create, add and drop','Use srvctl for starting and stopping ASM','Back up the disk group metadata after major changes']},
{note:'Take an md_backup of each disk group after major changes. If a disk group is damaged, the backup helps to recreate its structure before restoring data.'}],
src:[['ASMCMD',O.ASM+'asmcmd-asm-command-line-utility.html']]};

/* ---------- 7: Practical ---------- */
L['ora-rac:4:7']={blocks:[
{p:'On your cluster, add a disk to a disk group, drop one, and simulate replacing a failing disk. All changes are made **online**.'},
{h:'Step 1: Look first'},
{code:`sqlplus / as sysasm
SELECT name, total_mb, free_mb, usable_file_mb FROM v$asm_diskgroup;
SELECT name, path, header_status, state FROM v$asm_disk ORDER BY name;`},
{h:'Step 2: Add a disk'},
{code:`ALTER DISKGROUP DATA ADD DISK '/dev/oracleasm/data3' REBALANCE POWER 4;
SELECT operation, state, power, est_minutes FROM v$asm_operation;`},
{h:'Step 3: Replace a disk'},
{code:`SELECT name FROM v$asm_disk WHERE group_number = (SELECT group_number FROM v$asm_diskgroup WHERE name = 'DATA');

ALTER DISKGROUP DATA ADD DISK '/dev/oracleasm/data4' DROP DISK DATA_0001 REBALANCE POWER 6;`},
{h:'Step 4: Fast resync'},
{code:`ALTER DISKGROUP DATA OFFLINE DISK DATA_0002;
SELECT name, mode_status, mount_status FROM v$asm_disk WHERE name = 'DATA_0002';
ALTER DISKGROUP DATA ONLINE DISK DATA_0002;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['After step 2','`V$ASM_OPERATION` shows a REBALANCE, then it disappears'],
['After step 3','`DATA_0001` is gone, the new disk is a MEMBER'],
['After step 4','The disk returns ONLINE and resyncs quickly'],
['`USABLE_FILE_MB`','Still positive']]},
{h:'Challenge'},
{ul:['Run a database workload while you rebalance with power 1, then 10, and compare.','Run `asmcmd md_backup` before and after the changes.','Find which database uses the disk group with `asmcmd lsct`.']},
{note:'Always check that enough free space exists before dropping a disk. ASM must be able to place all the data on the remaining disks.'}],
src:[['ASM Administrator Guide',O.ASM]]};

})();
