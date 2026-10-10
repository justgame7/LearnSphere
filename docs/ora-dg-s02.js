/* LearnSphere - Data Guard, Section 02: Data Guard Architecture & Redo Transport.
   Lectures 0-7 are core, 8-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const flow=O.dg(700,270,[
[10,10,320,250,'Primary',1],[30,45,140,40,'User commits',0],[30,100,140,40,'LGWR writes|online redo',2],[30,155,140,40,'LNS reads redo|and ships it',2],[190,100,120,40,'Archiver|ARCn',0],
[370,10,320,250,'Standby',1],[390,45,140,40,'RFS receives|redo',2],[390,100,140,40,'Standby redo|logs (SRL)',2],[390,155,140,40,'MRP applies|redo',2],[550,100,120,40,'Standby|datafiles',0],[550,155,120,40,'Archived logs|(ARCn)',0]],
[[100,85,100,100],[100,140,100,155],[170,175,390,65],[460,85,460,100],[460,140,460,155],[530,175,550,120]]);

/* ---------- 0: Full flow ---------- */
L['ora-dg:1:0']={blocks:[
{p:'To understand Data Guard, follow one transaction from commit on the primary to being applied on the standby.'},
{svg:flow},
{h:'Step by step'},
{flow:['A transaction commits. LGWR writes its redo to the online redo log.','The Log Network Server (LNS) sends the redo to the standby over the network.','On the standby, the Remote File Server (RFS) receives it and writes it to a standby redo log (SRL).','The Managed Recovery Process (MRP) reads the SRL and applies the changes to the standby datafiles.','Archiver processes on both sides archive full logs, which also helps in gap resolution.']},
{h:'Where redo is read from'},
{t:[['Transport','Source','Meaning'],
['**SYNC**','The redo buffer in memory (LGWR sends it)','Commit waits for the standby'],
['**ASYNC**','The online redo log or memory','Commit does not wait. Redo is sent shortly after.'],
['**Archive-based** (ARCn)','Archived redo logs','Fills gaps. Not real-time.']]},
{h:'Real-time apply'},
{p:'With **standby redo logs**, MRP applies redo as it arrives, without waiting for a log to switch. This keeps the standby almost up to date, and failover is fast.'},
{h:'Key terms'},
{t:[['Term','Meaning'],
['**Transport lag**','How far the redo received by the standby is behind the primary'],
['**Apply lag**','How far applied redo is behind the primary'],
['**Gap**','Archived logs the standby has not received']]},
{note:'Two separate steps can be late: receiving redo (transport) and applying it (apply). Tuning and troubleshooting start by finding out which one is behind.'}],
src:[['Redo transport and apply',O.DG]]};

/* ---------- 1: Processes ---------- */
L['ora-dg:1:1']={blocks:[
{p:'Several background processes do the work. Each has one job.'},
{t:[['Process','Runs on','Job'],
['**LGWR**','Primary','Writes online redo. In SYNC mode it also sends redo.'],
['**LNS / NSS / NSA**','Primary','Network server processes that send redo (NSS for sync, NSA for async)'],
['**ARCn**','Both','Archive redo logs. On the primary also ships archived logs to fill gaps.'],
['**RFS**','Standby','Receives redo from the primary and writes it to standby redo logs'],
['**MRP**','Physical standby','Applies redo (managed recovery)'],
['**LSP**','Logical standby','Applies SQL (logical standby)'],
['**DMON**','Both','Broker monitor process']]},
{h:'See them'},
{code:`# On the primary
SELECT process, status, thread#, sequence# FROM v$dataguard_process;

# On the standby
SELECT process, status, client_process, thread#, sequence#, block# FROM v$managed_standby ORDER BY process;
ps -ef | grep -E "ora_(rfs|mrp|arc)"`},
{h:'Typical status values'},
{t:[['Process and status','Meaning'],
['RFS `IDLE` or `RECEIVING`','Standby is receiving redo'],
['MRP `APPLYING_LOG`','Redo is being applied'],
['MRP `WAIT_FOR_LOG`','Apply has caught up and is waiting for new redo'],
['ARCH `CLOSING`','Archiving a finished log']]},
{flow:['Primary sends with LGWR or LNS','RFS receives into SRLs','MRP applies','ARCn archives completed logs on both sides']},
{note:'`V$MANAGED_STANDBY` still works in current releases. `V$DATAGUARD_PROCESS` is the newer view that works on both primary and standby.'}],
src:[['Data Guard processes',O.DG]]};

/* ---------- 2: SRL and real-time apply ---------- */
L['ora-dg:1:2']={blocks:[
{p:'**Standby redo logs (SRLs)** are files on the standby where incoming redo is written first. They are required for real-time apply and for the protection modes that need them.'},
{h:'How many and how big'},
{t:[['Rule','Value'],
['**Size**','The same as the largest online redo log of the primary'],
['**Count per thread**','Number of online redo groups on the primary for that thread **plus one**'],
['**Threads**','One set of SRLs for each primary thread (every RAC instance)'],
['**Where**','Standby, and also on the primary so that it is ready for a switchover']]},
{code:`-- Primary with 3 online groups per thread, 1 thread -> 4 SRLs
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 11 SIZE 1G;
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 12 SIZE 1G;
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 13 SIZE 1G;
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 14 SIZE 1G;

SELECT group#, thread#, bytes/1024/1024 AS mb, status FROM v$standby_log;`},
{h:'Real-time apply'},
{code:`-- Start redo apply (real-time apply is used when SRLs exist)
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT FROM SESSION;

-- Stop it
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE CANCEL;

SELECT recovery_mode FROM v$archive_dest_status WHERE dest_id = 1;
-- MANAGED REAL TIME APPLY`},
{t:[['Mode','Meaning'],
['MANAGED REAL TIME APPLY','Redo is applied as it arrives'],
['MANAGED','Redo is applied only from archived logs (slower, no SRLs)']]},
{flow:['Create SRLs with the same size as ORLs','Start managed recovery on the standby','Check RECOVERY_MODE for real time apply','Verify apply lag is small']},
{note:'If you use the Data Guard broker, it starts and stops apply for you. Do not start apply by hand on a broker-managed standby unless you know what you are doing.'}],
src:[['Standby redo logs',O.DG]]};

/* ---------- 3: SYNC vs ASYNC ---------- */
L['ora-dg:1:3']={blocks:[
{p:'Redo transport can **wait for the standby** (synchronous) or **not wait** (asynchronous). The choice decides how much data you can lose, and how much distance affects commit time.'},
{t:[['Transport','Commit waits for','Data loss on primary failure','Speed impact'],
['**SYNC AFFIRM**','Standby has written the redo to disk','None (zero data loss)','Higher commit time, grows with distance'],
['**SYNC NOAFFIRM** (Fast Sync)','Standby has received the redo in memory','Almost none: only if both the primary and the standby fail together','Lower than SYNC AFFIRM'],
['**ASYNC**','Nothing','Small: whatever was not yet sent','None on the primary']]},
{h:'Configure'},
{code:`ALTER SYSTEM SET log_archive_dest_2 =
 'SERVICE=stby SYNC AFFIRM NET_TIMEOUT=30 VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=stby' SCOPE=BOTH;

-- Asynchronous
ALTER SYSTEM SET log_archive_dest_2 =
 'SERVICE=stby ASYNC VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=stby' SCOPE=BOTH;

-- With the broker
DGMGRL> EDIT DATABASE stby SET PROPERTY LogXptMode = 'FASTSYNC';   -- or SYNC, ASYNC`},
{h:'Distance and latency'},
{t:[['Round-trip time','Suitable transport'],
['Under about 5 ms (same metro area)','SYNC is practical'],
['5 to 20 ms','SYNC with care, or Fast Sync'],
['Over 20 ms (long distance)','ASYNC, or far sync near the primary']]},
{flow:['A commit needs the redo to be safe','SYNC: wait for the standby to confirm','ASYNC: continue immediately','Choose by RPO and by network latency']},
{h:'What happens when the network fails'},
{ul:['In **Maximum Availability**, the primary continues in an unsynchronised state, and resynchronises later.','In **Maximum Protection**, the primary stops to avoid any data loss (see the next lecture).']},
{note:'Measure the effect of SYNC on commit time with your real workload before you decide. Averages hide the cost for log file sync waits.'}],
src:[['Redo transport services',O.DG]]};

/* ---------- 4: Protection modes ---------- */
L['ora-dg:1:4']={blocks:[
{p:'A **protection mode** is a rule for what the primary does about the standby. There are three. Each is a tradeoff between data protection and availability.'},
{t:[['Mode','Transport','If the standby is unreachable','Data loss on failure'],
['**Maximum Protection**','SYNC AFFIRM','Primary **shuts down** to avoid divergence','Zero'],
['**Maximum Availability**','SYNC (AFFIRM or NOAFFIRM)','Primary continues, then resynchronises','Zero if the standby is synchronised at the failure'],
['**Maximum Performance** (default)','ASYNC','Primary continues','Small (not yet sent redo)']]},
{h:'Set the mode'},
{code:`-- SQL
ALTER DATABASE SET STANDBY DATABASE TO MAXIMIZE AVAILABILITY;
SELECT protection_mode, protection_level FROM v$database;

-- Broker
DGMGRL> EDIT CONFIGURATION SET PROTECTION MODE AS MAXAVAILABILITY;`},
{t:[['Column','Meaning'],
['`PROTECTION_MODE`','The mode you asked for'],
['`PROTECTION_LEVEL`','What is in effect now. For example MAXIMUM AVAILABILITY can show RESYNCHRONIZATION when the standby is behind.']]},
{h:'How to choose'},
{flow:['Need zero data loss and automatic failover? Maximum Availability','Cannot tolerate any divergence at all, even at the cost of downtime? Maximum Protection with at least two standbys','Distance is long or performance is key? Maximum Performance']},
{note:'Maximum Protection is rare. It stops the primary if the only standby is lost. Use it only with two or more standbys, or when stopping is better than any data loss.'}],
src:[['Data protection modes',O.DG]]};

/* ---------- 5: Gaps ---------- */
L['ora-dg:1:5']={blocks:[
{p:'A **gap** means the standby is missing some archived redo logs. This can happen after a network outage or when the standby was down. Data Guard detects and fixes most gaps by itself.'},
{h:'Detection and automatic resolution'},
{flow:['The standby notices a missing sequence number','It asks the primary through the FAL server (Fetch Archive Log)','The primary sends the missing archived log','Redo apply continues']},
{code:`-- Parameters on the standby
fal_server  = 'prod'
fal_client  = 'stby'

-- Check for gaps on the standby
SELECT thread#, low_sequence#, high_sequence# FROM v$archive_gap;
SELECT message FROM v$dataguard_status WHERE severity IN ('Error','Warning') ORDER BY timestamp DESC;`},
{h:'Manual resolution'},
{code:`-- Copy the missing archive log to the standby, then register it
ALTER DATABASE REGISTER LOGFILE '/arch/1_1234_1157234567.arc';`},
{h:'A very large gap'},
{p:'If the archive logs are gone from the primary, you can **roll the standby forward** with an incremental backup from the primary service (12c and later).'},
{code:`RMAN> RECOVER STANDBY DATABASE FROM SERVICE prod;      -- on the standby, applies incrementals over the network`},
{t:[['Gap size','Action'],
['Few logs','Automatic FAL, or copy and register'],
['Many logs, still on the primary','Let FAL fetch them, increase network bandwidth if needed'],
['Logs deleted from the primary','`RECOVER STANDBY DATABASE FROM SERVICE` (roll forward)'],
['Standby unrecoverable','Rebuild with RMAN duplicate']]},
{note:'Do not delete archived logs on the primary until they are applied on all standbys. Set an archive log deletion policy: `APPLIED ON ALL STANDBY`.'}],
src:[['Gap detection and resolution',O.DG]]};

/* ---------- 6: Roles and role-based services ---------- */
L['ora-dg:1:6']={blocks:[
{p:'Every database in a Data Guard configuration has a **role**. Applications must follow the role, so they connect to the current primary.'},
{t:[['Role (`V$DATABASE.DATABASE_ROLE`)','Open mode','Meaning'],
['**PRIMARY**','READ WRITE','The production database'],
['**PHYSICAL STANDBY**','MOUNTED, or READ ONLY WITH APPLY (ADG)','Receives and applies redo'],
['**SNAPSHOT STANDBY**','READ WRITE','Temporary test copy'],
['**LOGICAL STANDBY**','READ WRITE','SQL Apply copy']]},
{code:`SELECT name, db_unique_name, database_role, open_mode, switchover_status FROM v$database;`},
{h:'Role-based services'},
{p:'A **service with a role** starts only when the database has that role. After a switchover, the service stops on the old primary and starts on the new one, so applications reconnect to the right place.'},
{code:`# With Grid Infrastructure (Oracle Restart or RAC)
srvctl add service -db prod -service shop_svc -role PRIMARY
srvctl add service -db prod -service shop_ro  -role PHYSICAL_STANDBY`},
{h:'Without Grid Infrastructure'},
{p:'A database trigger can start the service according to the role.'},
{code:`CREATE OR REPLACE TRIGGER manage_services AFTER STARTUP OR DB_ROLE_CHANGE ON DATABASE
DECLARE r VARCHAR2(30);
BEGIN
  SELECT database_role INTO r FROM v$database;
  IF r = 'PRIMARY' THEN
    DBMS_SERVICE.START_SERVICE('shop_svc');
  ELSE
    DBMS_SERVICE.STOP_SERVICE('shop_svc');
  END IF;
END;
/`},
{h:'Client connect string'},
{code:`shop =
  (DESCRIPTION =
    (CONNECT_TIMEOUT = 10)(RETRY_COUNT = 30)(RETRY_DELAY = 5)
    (ADDRESS_LIST = (LOAD_BALANCE = OFF)(FAILOVER = ON)
      (ADDRESS = (PROTOCOL = TCP)(HOST = prod-scan)(PORT = 1521))
      (ADDRESS = (PROTOCOL = TCP)(HOST = stby-scan)(PORT = 1521)))
    (CONNECT_DATA = (SERVICE_NAME = shop_svc)))`},
{note:'The client list contains both sites. With retries, the client keeps trying until the service appears on the new primary.'}],
src:[['Role-based services',O.DG]]};

/* ---------- 7: Practical ---------- */
L['ora-dg:1:7']={blocks:[
{p:'Observe redo going from a primary to a standby. You need an existing Data Guard pair (you will build one in section 4). If you do not have one yet, read the expected output now and repeat the steps later.'},
{h:'Step 1: Check the setup on both sides'},
{code:`-- Primary
SELECT name, database_role, protection_mode, switchover_status FROM v$database;
SHOW PARAMETER log_archive_dest_2
SELECT dest_id, status, error FROM v$archive_dest WHERE dest_id = 2;

-- Standby
SELECT name, database_role, open_mode FROM v$database;
SELECT process, status, thread#, sequence# FROM v$managed_standby;`},
{h:'Step 2: Create redo and follow it'},
{code:`-- Primary
ALTER SYSTEM SWITCH LOGFILE;
SELECT thread#, MAX(sequence#) FROM v$archived_log GROUP BY thread#;

-- Standby
SELECT thread#, MAX(sequence#) AS received FROM v$archived_log GROUP BY thread#;
SELECT thread#, MAX(sequence#) AS applied FROM v$archived_log WHERE applied = 'YES' GROUP BY thread#;`},
{h:'Step 3: Measure the lag'},
{code:`-- Standby
SELECT name, value, time_computed FROM v$dataguard_stats WHERE name IN ('transport lag','apply lag');`},
{h:'Step 4: Insert data and see it arrive (with Active Data Guard)'},
{code:`-- Primary
INSERT INTO lab.t VALUES (SYSDATE); COMMIT;
-- Standby (open read only with apply)
SELECT COUNT(*) FROM lab.t;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['Primary role','PRIMARY, protection mode as configured'],
['Standby role','PHYSICAL STANDBY, MRP `APPLYING_LOG` or `WAIT_FOR_LOG`'],
['Latest received and applied sequence','Equal or differing by one or two'],
['Transport and apply lag','A few seconds or less'],
['Row count (ADG only)','Matches the primary after a short time']]},
{note:'If the sequence on the standby is behind, run the check again in a minute. If it stays behind, look at V$DATAGUARD_STATUS and the alert logs of both sides.'}],
src:[['Monitoring Data Guard',O.DG]]};

})();
