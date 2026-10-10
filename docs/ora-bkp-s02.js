/* LearnSphere - Backup & Recovery, Section 02: RMAN Architecture & Configuration.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const BR=O.D+'bradv/';

/* ---------- diagrams ---------- */
const arch=O.dg(700,230,[
[10,70,130,80,'RMAN client|(the command)',2],
[190,10,200,210,'Target database server',1],[205,45,170,40,'Server session',0],[205,95,170,40,'Channels (disk/tape)',0],[205,145,170,50,'Datafiles, control file|archived logs',0],
[440,20,120,70,'Backup storage|(disk, tape, cloud)',0],
[440,130,120,70,'Repository|control file or|catalog',2],
[600,130,90,70,'Recovery|catalog DB|(optional)',0]],
[[140,110,190,110],[375,115,440,55],[375,170,440,165],[560,165,600,165]]);

/* ---------- 0: Architecture ---------- */
L['ora-bkp:1:0']={blocks:[
{p:'**RMAN** (Recovery Manager) is the Oracle tool for physical backup and recovery. The RMAN client sends commands. The **server sessions** on the database do the work.'},
{svg:arch},
{t:[['Part','Role'],
['**RMAN client**','The command line. It only sends instructions. It does not move data.'],
['**Target database**','The database being backed up or recovered'],
['**Channel**','A server session that reads or writes. One per parallel stream. Disk or tape (SBT).'],
['**Repository**','The metadata about backups: always in the **target control file**, optionally also in a **recovery catalog**'],
['**Media management**','A tape or cloud library through the SBT interface (optional)']]},
{h:'Why it matters'},
{ul:['RMAN knows what is in the database. It skips empty blocks and can check for corruption.','Backups are recorded. `RESTORE` finds the right pieces without you listing files.','Parallelism is set by channels, not by script tricks.']},
{note:'RMAN does not copy files like the OS. It reads Oracle blocks, so it can compress, encrypt, skip unused space and detect corruption.'}],
src:[['RMAN architecture',BR]]};

/* ---------- 1: Connecting ---------- */
L['ora-bkp:1:1']={blocks:[
{p:'Start RMAN and connect to the **target**. Authentication is usually OS authentication with the SYSDBA-equivalent `SYSBACKUP` privilege.'},
{code:`# local, OS authentication
rman target /

# remote, with a password
rman target sys@prod

# with a recovery catalog
rman target / catalog rcat_owner@rcat

# run a command file and log
rman target / cmdfile=backup.rman log=backup.log`},
{t:[['Connection','Meaning'],
['`target`','The database to back up'],
['`catalog`','The recovery catalog database (optional)'],
['`auxiliary`','A database for DUPLICATE or TSPITR'],
['`SYSBACKUP`','A least-privilege administrative privilege for backup and recovery tasks']]},
{h:'First commands'},
{code:`SHOW ALL;
LIST BACKUP SUMMARY;
REPORT SCHEMA;`},
{note:'Use `SYSBACKUP` for backup users instead of `SYSDBA`. It can back up and recover, but it cannot read user data.'}],
src:[['Starting RMAN',BR]]};

/* ---------- 2: Control file vs catalog ---------- */
L['ora-bkp:1:2']={blocks:[
{p:'RMAN records its metadata in the **control file**. A **recovery catalog** is a separate schema that keeps the same metadata longer and in one place.'},
{t:[['','Control file only','Recovery catalog'],
['**Setup**','None','A catalog database and `CREATE CATALOG`'],
['**History**','Limited by `CONTROL_FILE_RECORD_KEEP_TIME` (default 7 days)','As long as you keep it'],
['**Many databases**','Each separate','One place for the whole fleet'],
['**Stored scripts**','No','Yes'],
['**If the control file is lost**','Harder (use autobackup)','Easy: metadata is in the catalog'],
['**Needs backup**','The control file (autobackup)','The catalog database itself']]},
{h:'Create and register'},
{code:`-- in the catalog database
CREATE USER rcat_owner IDENTIFIED BY ...;
GRANT RECOVERY_CATALOG_OWNER TO rcat_owner;

-- in RMAN
rman target / catalog rcat_owner@rcat
CREATE CATALOG;
REGISTER DATABASE;`},
{note:'For one small database the control file is enough. For many databases, or for long retention, use a catalog. Never place the catalog in the database it protects.'}],
src:[['Recovery catalog',BR]]};

/* ---------- 3: CONFIGURE ---------- */
L['ora-bkp:1:3']={blocks:[
{p:'**CONFIGURE** sets persistent defaults, so each backup command can stay short. Check them with `SHOW ALL`.'},
{t:[['Setting','Example','Why'],
['**Retention**','`CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 7 DAYS;`','What RMAN keeps and may delete'],
['**Autobackup**','`CONFIGURE CONTROLFILE AUTOBACKUP ON;`','Saves control file and SPFILE after each backup. A must.'],
['**Parallelism**','`CONFIGURE DEVICE TYPE DISK PARALLELISM 4;`','Number of channels'],
['**Compression**','`CONFIGURE COMPRESSION ALGORITHM \'MEDIUM\';`','Smaller backups, more CPU. Needs the Advanced Compression option for non-BASIC.'],
['**Backup type**','`CONFIGURE DEVICE TYPE DISK BACKUP TYPE TO COMPRESSED BACKUPSET;`','Default backup form'],
['**Backup optimization**','`CONFIGURE BACKUP OPTIMIZATION ON;`','Skip files already backed up'],
['**Archivelog deletion**','`CONFIGURE ARCHIVELOG DELETION POLICY TO BACKED UP 1 TIMES TO DISK;`','Safe deletion of archived logs']]},
{h:'Two retention styles'},
{t:[['Policy','Meaning'],
['**Recovery window of N days**','Keep what is needed to recover to any point within N days'],
['**Redundancy N**','Keep N copies of each file backup']]},
{note:'Always turn **CONTROLFILE AUTOBACKUP ON**. Without it, recovering from a total loss means searching for a control file.'}],
src:[['CONFIGURE',BR]]};

/* ---------- 4: FRA setup ---------- */
L['ora-bkp:1:4']={blocks:[
{p:'RMAN writes to the **FRA** by default. Set it up once, size it, and watch it.'},
{code:`ALTER SYSTEM SET db_recovery_file_dest_size=300G SCOPE=BOTH;
ALTER SYSTEM SET db_recovery_file_dest='/u03/fra' SCOPE=BOTH;
-- ASM example: '+FRA'

SELECT name, space_limit/1024/1024/1024 gb_limit,
       space_used/1024/1024/1024  gb_used,
       space_reclaimable/1024/1024/1024 gb_reclaimable
FROM v$recovery_file_dest;`},
{h:'How the FRA stays within its size'},
{flow:['Space fills with backups, archived logs and flashback logs','At about 85 percent the alert log warns','Obsolete and backed up files become reclaimable','Oracle deletes reclaimable files when it needs space','If nothing is reclaimable, operations that need space fail']},
{h:'Sizing rule of thumb'},
{ul:['Archived logs for the time between backups and deletion.','The full database plus incrementals if you keep backups in the FRA.','Flashback logs for the Flashback window.','Margin for peaks.']},
{note:'A larger `db_recovery_file_dest_size` does not add disk space. It is only a quota. The real disk must exist.'}],
src:[['Fast Recovery Area',BR]]};

/* ---------- 5: Backup sets vs copies ---------- */
L['ora-bkp:1:5']={blocks:[
{p:'RMAN can write backups in two forms.'},
{t:[['','Backup set','Image copy'],
['**Format**','Oracle proprietary, in **pieces**','Exact copy of the file, as the OS file'],
['**Unused blocks**','Skipped','Included'],
['**Compression**','Yes','No'],
['**Tape**','Yes','No (disk only)'],
['**Restore**','Must extract','Can **switch** to the copy and run from it (fast)'],
['**Incremental**','Supported','Supported with **incrementally updated** copies'],
['**Space**','Smaller','Same as the database']]},
{h:'When to use which'},
{ul:['**Backup sets** for most backups, and always for tape or compression.','**Image copies** when restore time matters most. Switching to a copy avoids a restore.']},
{code:`BACKUP DATABASE;                 -- backup set
BACKUP AS COPY DATABASE;         -- image copy
BACKUP AS COMPRESSED BACKUPSET DATABASE PLUS ARCHIVELOG;`},
{note:'Backup sets are the default. Image copies are what you use for the fast-recovery strategy you will build in the next section.'}],
src:[['Backup sets and image copies',BR]]};

/* ---------- 6: Practical ---------- */
L['ora-bkp:1:6']={blocks:[
{p:'Configure RMAN for the first time and take your first full backup.'},
{code:`rman target /

SHOW ALL;
CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 7 DAYS;
CONFIGURE CONTROLFILE AUTOBACKUP ON;
CONFIGURE DEVICE TYPE DISK PARALLELISM 2;
CONFIGURE BACKUP OPTIMIZATION ON;

BACKUP DATABASE PLUS ARCHIVELOG;
LIST BACKUP SUMMARY;
REPORT NEED BACKUP;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`SHOW ALL`','Your settings listed'],
['`LIST BACKUP SUMMARY`','One full backup, archived logs and an autobackup of the control file'],
['`REPORT NEED BACKUP`','Nothing needs backup'],
['`V$RECOVERY_FILE_DEST`','Space used grew by about the database size']]},
{h:'Try'},
{ul:['Run `BACKUP DATABASE` again. Does backup optimization skip anything?','Run `LIST BACKUP OF DATABASE`. Find the tag and the piece names.','Run `BACKUP VALIDATE DATABASE`. What does it check?']},
{note:'Keep this backup. The next sections build on it: incrementals, maintenance, and then breaking things on purpose.'}],
src:[['RMAN quick start',BR]]};

})();
