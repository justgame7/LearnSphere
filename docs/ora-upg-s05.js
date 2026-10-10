/* LearnSphere - Upgrade, Patching & Migration, Section 05: Migration Methods.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const UG=O.D+'upgrd/';
const ZDM='https://docs.oracle.com/en/database/oracle/zero-downtime-migration/';

/* ---------- diagrams ---------- */
const choose=O.dg(700,220,[
[10,10,680,200,'Choosing a method',1],
[30,45,200,70,'Small, downtime OK|Data Pump',0],
[250,45,200,70,'Large, same endian|RMAN or transportable',0],
[470,45,200,70,'Different platform|cross-endian RMAN or TTS',0],
[30,130,200,60,'Near zero downtime|Data Guard (same platform)',2],
[250,130,200,60,'Near zero, any platform|GoldenGate',2],
[470,130,200,60,'To the cloud|Zero Downtime Migration',2]],[]);

/* ---------- 0: Choosing ---------- */
L['ora-upg:4:0']={blocks:[
{p:'There are many ways to move a database. Choose by **downtime**, **size** and **platform**.'},
{svg:choose},
{t:[['Method','Downtime','Size','Platform change','Notes'],
['**Data Pump**','Hours (grows with size)','Small to medium','Any','Logical: rebuilds structures, also upgrades'],
['**Transportable tablespaces**','Short to medium','Large','Same or cross-platform (with conversion)','Move datafiles, plus metadata'],
['**RMAN duplicate / restore**','Medium','Any','Same endian','Physical copy'],
['**Data Guard**','Minutes (switchover)','Any','Same platform and endian (with some exceptions)','Low risk'],
['**GoldenGate**','Seconds to minutes','Any','Any, any version','Needs licence and design'],
['**ZDM**','Minutes','Any','To Oracle cloud targets','Orchestrates the above']]},
{flow:['Define the downtime budget','Check size, source and target platform and release','Check licences and tools','Pick the simplest method that meets the budget','Rehearse']},
{note:'The simplest method that meets the downtime budget is the best. Do not use GoldenGate when Data Pump fits in the window.'}],
src:[['Migration',UG]]};

/* ---------- 1: Data Pump ---------- */
L['ora-upg:4:1']={blocks:[
{p:'**Data Pump** exports and imports objects and data in a logical form. It works across versions, platforms and architectures.'},
{code:`-- directory object
CREATE DIRECTORY dp_dir AS \'/u01/dp\';
GRANT READ, WRITE ON DIRECTORY dp_dir TO system;

-- export a schema in parallel
expdp system@src schemas=app directory=dp_dir dumpfile=app_%U.dmp logfile=exp_app.log parallel=4 flashback_time=systimestamp compression=all

-- import into the target (PDB)
impdp system@tgt_pdb schemas=app directory=dp_dir dumpfile=app_%U.dmp logfile=imp_app.log parallel=4
  remap_tablespace=users:app_data transform=disable_archive_logging:y`},
{t:[['Option','Use'],
['`PARALLEL`','Speed. Use the same number of dump files (`%U`).'],
['`FLASHBACK_TIME` / `FLASHBACK_SCN`','Consistent export'],
['`REMAP_SCHEMA`, `REMAP_TABLESPACE`','Rename on the way in'],
['`NETWORK_LINK`','Import directly over a database link, no dump file'],
['`TRANSFORM`','Skip storage clauses, disable logging (careful with standby)'],
['`EXCLUDE`, `INCLUDE`, `CONTENT`','Select what to move']]},
{h:'Reduce downtime'},
{ul:['Export with a flashback SCN while the system is live.','Final sync with a second export or with GoldenGate.','Use `NETWORK_LINK` and parallelism for large moves.']},
{note:'`FULL=Y` exports the whole database, but not SYS objects. Plan users, roles, profiles and jobs as well.'}],
src:[['Data Pump',O.D+'sutil/']]};

/* ---------- 2: Transportable ---------- */
L['ora-upg:4:2']={blocks:[
{p:'**Transportable tablespaces (TTS)** move the **datafiles** and only the metadata. It is much faster than copying rows. **Full transportable export/import (FTEX)** moves a whole database this way.'},
{flow:['Check the tablespace set is self-contained','Make tablespaces read only (or use incremental backups to reduce this time)','Export metadata with Data Pump','Copy datafiles to the target (convert endianness if needed)','Import metadata and plug in','Make tablespaces read write']},
{code:`-- source
ALTER TABLESPACE users READ ONLY;
expdp system directory=dp_dir dumpfile=tts.dmp transport_tablespaces=users logfile=tts_exp.log

-- full transportable
expdp system full=y transportable=always directory=dp_dir dumpfile=full_tts.dmp version=19

-- target
impdp system directory=dp_dir dumpfile=tts.dmp transport_datafiles=\'/u02/oradata/users01.dbf\'`},
{t:[['Technique','Benefit'],
['**Cross-platform incremental backups**','Pre-copy most data with RMAN incrementals. Short final read-only window.'],
['**Full transportable**','Moves user and system metadata too'],
['**Cross-endian**','Convert with RMAN `CONVERT`']]},
{note:'The source tablespaces are read only during the final step. The shorter you make that step (with incrementals), the shorter the downtime.'}],
src:[['Transportable tablespaces',O.D+'admin/']]};

/* ---------- 3: Cross-platform ---------- */
L['ora-upg:4:3']={blocks:[
{p:'Moving between platforms (for example **AIX or Solaris to Linux**) means a **different byte order** (endianness) may need conversion.'},
{t:[['Case','Approach'],
['Same endian (Linux x86 to Linux x86)','Direct file copy, no conversion'],
['Different endian (big to little)','RMAN `CONVERT DATAFILE` or `CONVERT TABLESPACE`'],
['Different platform, not whole database','TTS with conversion and cross-platform incrementals'],
['Different platform, any size, near zero downtime','GoldenGate']]},
{code:`-- list platforms and endianness
SELECT platform_id, platform_name, endian_format FROM v$transportable_platform ORDER BY endian_format;

-- convert on the target
RMAN> CONVERT DATAFILE \'/stage/users01.dbf\' FROM PLATFORM \'Solaris[tm] OE (64-bit)\'
      FORMAT \'/u02/oradata/%N_%f.dbf\';`},
{flow:['Check platform names with `V$TRANSPORTABLE_PLATFORM`','Plan to convert on the source or the target (target is usual)','Pre-copy with incrementals (cross-platform incremental backup method)','Final incremental, metadata export and import']},
{note:'Use the Oracle cross-platform migration notes on My Oracle Support for the exact steps of your release. They give prepared scripts.'}],
src:[['Cross-platform migration',O.D+'admin/']]};

/* ---------- 4: Data Guard ---------- */
L['ora-upg:4:4']={blocks:[
{p:'**Data Guard** can move a database with **minutes** of downtime when platforms are compatible.'},
{flow:['Build a physical standby on the new hardware or platform','Let it sync','Switchover: the standby becomes primary','Point applications to the new primary','Retire the old primary (or keep as fallback)']},
{t:[['Variation','Use'],
['**Physical standby to new hardware**','Same OS and architecture, new servers'],
['**Cross-platform standby**','Supported in some combinations (check the support note for your release)'],
['**Rolling upgrade (DBMS_ROLLING)**','Upgrade the release with seconds of downtime'],
['**Add a standby as a migration target to a cloud**','Often used for lift and shift']]},
{code:`-- build with RMAN DUPLICATE ... FOR STANDBY and the broker
DGMGRL> CREATE CONFIGURATION mig AS PRIMARY DATABASE IS src CONNECT IDENTIFIER IS src;
DGMGRL> ADD DATABASE tgt AS CONNECT IDENTIFIER IS tgt MAINTAINED AS PHYSICAL;
DGMGRL> ENABLE CONFIGURATION;
DGMGRL> SWITCHOVER TO tgt;`},
{note:'The simplest low-downtime migration of a database to new hardware is **a standby and a switchover**. Test the switchover and fallback in rehearsal.'}],
src:[['Data Guard',O.DG]]};

/* ---------- 5: GoldenGate pointer ---------- */
L['ora-upg:4:5']={blocks:[
{p:'**GoldenGate** replicates changes between databases of **any release and platform**. It gives near-zero downtime migration and upgrade, and a fallback with reverse replication.'},
{t:[['Strength','Notes'],
['**Any to any**','Different OS, endian, version, architecture'],
['**Near zero downtime**','Cutover in seconds to minutes'],
['**Fallback**','Reverse replication keeps the old system current'],
['**Cost**','Licence and design effort']]},
{flow:['Prepare source and target (supplemental logging, user)','Start the capture','Initial load (Data Pump with SCN)','Start apply, catch up','Verify (comparison)','Cutover and reverse replication']},
{h:'Where to learn it'},
{p:'This is covered in depth in the **GoldenGate sub-course**, section **Zero-Downtime Migrations & Upgrades**. Use that course for design and practicals.'},
{note:'GoldenGate is the right choice when the downtime budget is tight and platforms differ. Otherwise use the simpler tools.'}],
src:[['GoldenGate',O.GG]]};

/* ---------- 6: ZDM ---------- */
L['ora-upg:4:6']={blocks:[
{p:'**Oracle Zero Downtime Migration (ZDM)** is a tool that **orchestrates** a migration to Oracle cloud targets. It uses Data Guard or Data Pump (and GoldenGate for logical online) under one workflow.'},
{t:[['Mode','Underlying method','Downtime'],
['**Physical online**','Data Guard (RMAN backup and restore, redo sync)','Minutes'],
['**Physical offline**','Backup and restore','Hours'],
['**Logical online**','Data Pump plus GoldenGate','Minutes'],
['**Logical offline**','Data Pump','Hours']]},
{code:`# response file outline (names per ZDM documentation)
MIGRATION_METHOD=ONLINE_PHYSICAL
DATA_TRANSFER_MEDIUM=OSS
TGT_DB_UNIQUE_NAME=prodcloud

zdmcli migrate database -sourcedb prod -sourcenode srchost -targetnode tgthost -srcauth zdmauth \\
  -srcarg1 user:opc -srcarg2 identity_file:/home/zdm/key -rsp /home/zdm/zdm.rsp -eval`},
{h:'Typical flow'},
{flow:['Install ZDM service host','Prepare source, target, network and credentials','Run with `-eval` (checks only)','Run the migration (phases can pause)','Switch applications','Cleanup']},
{note:'ZDM changes with each release. Use its current documentation. `-eval` is the safe first command.'}],
src:[['Zero Downtime Migration',ZDM]]};

/* ---------- 7: Practical ---------- */
L['ora-upg:4:7']={blocks:[
{p:'**Migrate a schema with minimal downtime** using Data Pump and an SCN-based method.'},
{code:`-- 1. record an SCN on the source
SELECT current_scn FROM v$database;     -- say 1234567

-- 2. consistent export while live
expdp system@src schemas=app directory=dp_dir dumpfile=app_%U.dmp flashback_scn=1234567 parallel=4 logfile=exp.log

-- 3. import into the target
impdp system@tgt_pdb schemas=app directory=dp_dir dumpfile=app_%U.dmp parallel=4 logfile=imp.log

-- 4. at cutover: stop writes, export only the delta (tables with a change date), import
-- 5. compare
SELECT COUNT(*), SUM(total) FROM app.orders;   -- run on both`},
{flow:['Choose the cutover window and stop the application writes','Export the delta (rows changed after the SCN time)','Import the delta, recompile, gather statistics','Compare row counts and checksums','Switch the application and test']},
{h:'Check your result'},
{t:[['Check','Expected'],
['Row counts and sums','Equal on both systems'],
['Invalid objects','None after `utlrp`'],
['Downtime','Measured (stop to restart on target)'],
['Fallback','Application can be pointed back to the source']]},
{note:'The delta step is simple only for tables with a reliable change timestamp. For a real zero-downtime path, use GoldenGate.'}],
src:[['Data Pump',O.D+'sutil/']]};

})();
