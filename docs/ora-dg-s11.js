/* LearnSphere - Data Guard, Section 11: Monitoring, Troubleshooting & Tuning.
   Lectures 0-7 are core, 8-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const lag=O.dg(700,190,[
[10,40,150,70,'Primary|generates redo|at time T',0],[210,40,150,70,'Redo received|by the standby|(RFS, SRL)',2],[410,40,150,70,'Redo applied|to the standby|datafiles (MRP)',2],
[10,130,680,50,'Transport lag = T to received.   Apply lag = T to applied.   Apply lag is always at least the transport lag.',1]],
[[160,75,210,75],[360,75,410,75]]);

const diag=O.dg(700,210,[
[10,20,140,60,'Lag grows',0],
[200,20,150,60,'Transport lag high?|(redo not arriving)',2],[400,20,150,60,'Apply lag high?|(not applied)',2],
[200,120,150,70,'Network, destination,|archive space,|password, listener',0],[400,120,150,70,'Apply stopped?|slow storage?|missing file?',0]],
[[150,50,200,50],[350,50,400,50],[275,80,275,120],[475,80,475,120]]);

/* ---------- 0: Monitoring lag ---------- */
L['ora-dg:10:0']={blocks:[
{p:'The first number to watch in Data Guard is **lag**. It tells you how much data a failover would lose, and how long it would take. There are two kinds.'},
{svg:lag},
{t:[['Lag','Meaning','What a large value suggests'],
['**Transport lag**','Redo generated on the primary but not yet received by the standby','Network, destination, or primary sending problem'],
['**Apply lag**','Redo generated on the primary but not yet applied on the standby','Apply stopped or slow, or a transport problem'],
['**Apply finish time**','Time needed to apply the redo already received','Expected failover time']]},
{h:'Where to see it'},
{code:`-- Standby
SELECT name, value, unit, time_computed FROM v$dataguard_stats
WHERE name IN ('transport lag','apply lag','apply finish time','estimated startup time');

-- Broker
DGMGRL> SHOW DATABASE stby;
--   Transport Lag:      0 seconds
--   Apply Lag:          0 seconds
--   Average Apply Rate: 5.00 MByte/s

SELECT * FROM v$recovery_progress WHERE item IN ('Active Apply Rate','Average Apply Rate','Apply Time per Log');`},
{h:'Thresholds with the broker'},
{code:`DGMGRL> EDIT DATABASE stby SET PROPERTY TransportLagThreshold = 30;   -- seconds, warning above this
DGMGRL> EDIT DATABASE stby SET PROPERTY ApplyLagThreshold = 60;`},
{h:'Which lag first'},
{svg:diag},
{flow:['Look at transport lag and apply lag','Transport high: check the network and the destination','Transport low, apply high: check that apply runs and its speed','Write down the values before and after any change']},
{note:'Lag is a view of the past few seconds. For a real trend, record it every minute in a monitoring tool and keep the history.'}],
src:[['Monitoring Data Guard',O.DG]]};

/* ---------- 1: Gaps and archive problems ---------- */
L['ora-dg:10:1']={blocks:[
{p:'A gap means missing archived logs. Most gaps are fixed automatically. When they are not, the cause is usually one of a short list.'},
{h:'Causes'},
{t:[['Cause','Check'],
['Network outage or slow link','`V$ARCHIVE_DEST_STATUS.ERROR`, `tnsping stby`, ping'],
['Destination disabled or in error','`V$ARCHIVE_DEST` status and error text'],
['Archive logs deleted on the primary before shipping','RMAN deletion policy, FRA usage'],
['Archive space full on the standby','`V$RECOVERY_FILE_DEST`, `df -h`'],
['Wrong `FAL_SERVER`','Parameter on the standby'],
['Authentication problem','Password file, ORA-01017, ORA-16191']]},
{code:`-- Primary
SELECT dest_id, status, error, gap_status FROM v$archive_dest_status WHERE dest_id = 2;
SELECT dest_id, status, error FROM v$archive_dest WHERE dest_id = 2;

-- Standby
SELECT thread#, low_sequence#, high_sequence# FROM v$archive_gap;
SELECT TO_CHAR(timestamp,'DD HH24:MI:SS') t, severity, message FROM v$dataguard_status ORDER BY timestamp DESC FETCH FIRST 20 ROWS ONLY;`},
{h:'Fix by cause'},
{t:[['Cause','Fix'],
['Network','Repair it. Gaps close by themselves when the link returns.'],
['Destination error','Correct the setting, then `ALTER SYSTEM SET log_archive_dest_state_2 = ENABLE;` (or broker `ENABLE DATABASE`)'],
['Logs deleted','`RECOVER STANDBY DATABASE FROM SERVICE prod` in RMAN'],
['Standby disk full','Free space, delete applied logs with RMAN']]},
{flow:['See the gap or error','Find the cause in the destination status and the alert logs','Fix the cause, not only the symptom','Check that the gap closes and the lag falls']},
{note:'Set the archive deletion policy to `APPLIED ON ALL STANDBY` on the primary, so that logs are never deleted before the standby has them.'}],
src:[['Gap resolution',O.DG]]};

/* ---------- 2: Common errors ---------- */
L['ora-dg:10:2']={blocks:[
{p:'Data Guard errors have a pattern. Many start with **ORA-16xxx** (broker and transport) or relate to the standby state.'},
{t:[['Error','Meaning','First check'],
['**ORA-16191**','Primary log shipping client not logged on to the standby','Password files and SYS password on both sides'],
['**ORA-01017**','Invalid username or password','Same'],
['**ORA-12514 / 12541 / 12154**','Connection problems','Listener, static entries, tnsnames.ora'],
['**ORA-16198**','Timeout on a remote archive channel','Network speed, `NET_TIMEOUT`'],
['**ORA-16766**','Redo Apply is stopped','Start apply: `SET STATE = \'APPLY-ON\'`'],
['**ORA-16789**','Standby redo logs not configured','Add SRLs'],
['**ORA-16809 / 16810**','Warnings or errors for a member','`SHOW DATABASE` for details'],
['**ORA-16857**','Standby disconnected from the redo source too long','Network and primary status'],
['**ORA-16778 / 16801**','Redo transport error or inconsistent property','Destination errors, properties'],
['**ORA-01033**','Oracle is initialising or shutting down','Instance state, wait and retry'],
['**ORA-01669**','Standby control file not consistent with the datafiles','Restore or refresh the standby control file'],
['**ORA-01111 / 01157**','A datafile is missing or unknown','`STANDBY_FILE_MANAGEMENT`, create the file']]},
{h:'How to read them'},
{ul:['The **first error** in the alert log is usually the cause. Later errors may be consequences.','Use `SHOW DATABASE` in the broker for a plain-language reason.','Look up the full text in Database Error Messages and My Oracle Support with your release.']},
{flow:['Copy the exact error and the time','Check the alert logs of both databases at that time','Check the broker status','Match it to the table, then verify the fix with SHOW CONFIGURATION']},
{note:'Many errors look the same but come from different causes. Always confirm with the log before you change anything.'}],
src:[['Database Error Messages',O.ERR],['Data Guard Broker',O.BKR]]};

/* ---------- 3: Out of sync ---------- */
L['ora-dg:10:3']={blocks:[
{p:'A standby is **out of sync** when it cannot apply redo, or is too far behind. First find the type of problem, then repair it with the lightest method that works.'},
{t:[['Situation','Symptom','Repair'],
['**Apply stopped**','Apply lag grows, MRP not running','Start apply, check the reason in the alert log'],
['**Gap, logs still on primary**','Gap in `V$ARCHIVE_GAP`','FAL fetches them. Fix the network.'],
['**Logs lost**','Gap does not close','`RECOVER STANDBY DATABASE FROM SERVICE prod` (incremental roll forward)'],
['**Datafile missing on standby**','ORA-01157, ORA-01111, apply stops','Create the file (see below)'],
['**NOLOGGING corruption**','ORA-01578 with ORA-26040','Recover the file from the primary (`RESTORE DATAFILE ... FROM SERVICE`)'],
['**Standby control file bad**','ORA-01669 or similar','Restore a new standby control file from the primary'],
['**Hopelessly behind or damaged**','Repairs fail','Rebuild with RMAN duplicate']]},
{h:'A missing datafile'},
{code:`-- Standby
ALTER SYSTEM SET standby_file_management = MANUAL;
ALTER DATABASE CREATE DATAFILE '/u02/oradata/stby/new01.dbf' AS '/u02/oradata/stby/new01.dbf';
ALTER SYSTEM SET standby_file_management = AUTO;
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT FROM SESSION;`},
{h:'Roll forward from the primary'},
{code:`RMAN> CONNECT TARGET sys@stby
RMAN> RECOVER STANDBY DATABASE FROM SERVICE prod;
-- Standby control file refresh if needed
RMAN> RESTORE STANDBY CONTROLFILE FROM SERVICE prod;`},
{h:'Prevent NOLOGGING problems'},
{ul:['Use `FORCE LOGGING` on the primary (a prerequisite from section 3).','Check `V$DATAFILE.UNRECOVERABLE_CHANGE#` regularly.']},
{flow:['Identify the type of problem','Try the lightest repair first','Verify with lag and SHOW CONFIGURATION','Rebuild only if repairs fail']},
{note:'Always keep a note of what you repaired and why. A repeated problem points to a root cause, such as a full disk or missing FORCE LOGGING.'}],
src:[['Repairing a standby',O.DG]]};

/* ---------- 4: Redo transport and network tuning ---------- */
L['ora-dg:10:4']={blocks:[
{p:'If transport lag is high and the network is working, the link may be **too slow** or **not used well**. Measure first, then tune.'},
{h:'Measure the redo rate'},
{code:`-- Redo per second at peak (from AWR or Statspack)
SELECT ROUND(value/1024/1024) AS redo_mb FROM v$sysstat WHERE name = 'redo size';
-- Compare over time to get MB per second`},
{p:'The link must carry the **peak** redo rate with room to spare. A 100 MB per second redo peak needs about 1 Gbit per second plus margin.'},
{h:'Options'},
{t:[['Setting','Effect'],
['**Redo compression** (`RedoCompression = ENABLE`)','Less bandwidth, more CPU. Needs Advanced Compression.'],
['**TCP buffer sizes**','Buffers must hold the bandwidth-delay product, or the link cannot be filled'],
['**SDU size** (`DEFAULT_SDU_SIZE=65535` in sqlnet.ora)','Larger network packets'],
['**NET_TIMEOUT** / `NetTimeout`','How long to wait before treating the link as failed (default 30)'],
['**ASYNC transport**','The primary does not wait. Use it for long distances.']]},
{h:'Bandwidth-delay product'},
{code:`BDP (bytes) = bandwidth (bytes per second) x round trip time (seconds)
Example: 1 Gbit/s = 125 MB/s, RTT 40 ms (0.04 s) -> BDP = 5 MB
Set the TCP send and receive buffers to at least that.

# Linux
sysctl -w net.core.rmem_max=16777216 net.core.wmem_max=16777216
sysctl -w net.ipv4.tcp_rmem="4096 87380 16777216" net.ipv4.tcp_wmem="4096 65536 16777216"`},
{flow:['Measure peak redo and link capacity','Compare with the bandwidth-delay product','Tune buffers and SDU','Consider compression if bandwidth is short','Re-measure transport lag at peak']},
{note:'Tune one change at a time and measure the effect. Always test at the peak load, not at night when redo is low.'}],
src:[['Redo transport tuning',O.DG]]};

/* ---------- 5: Apply performance ---------- */
L['ora-dg:10:5']={blocks:[
{p:'If transport lag is low but apply lag is high, the standby cannot apply redo as fast as it arrives.'},
{h:'Common causes'},
{t:[['Cause','Check'],
['**Slow standby storage**','I/O wait on datafiles. The standby does as much writing as the primary.'],
['**Single apply instance** in a busy RAC database','Apply rate vs primary redo rate'],
['**Read workload on the standby (ADG)** competes for I/O and CPU','Compare apply rate with and without the load'],
['**Missing parallelism**','Apply parallel setting too low'],
['**Large operations** (index builds, batch loads)','Redo bursts that apply slowly']]},
{h:'What to do'},
{code:`-- Broker: let Oracle choose the parallelism
DGMGRL> EDIT DATABASE stby SET PROPERTY ApplyParallel = AUTO;

-- Multi-instance redo apply for a RAC standby (12.2 and later)
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE USING INSTANCES ALL DISCONNECT FROM SESSION;

SELECT * FROM v$recovery_progress WHERE item LIKE '%Apply Rate%';`},
{t:[['Setting','Notes'],
['`ApplyParallel`','AUTO is usually right'],
['**Multi-instance redo apply**','Uses all RAC standby instances to apply, which can raise the rate a lot'],
['**Faster storage**','Often the real fix'],
['**Move reports**','Run heavy reports off the apply node, or limit them']]},
{flow:['Compare the apply rate with the primary redo rate','If the apply rate is lower, find the bottleneck: I/O, CPU or parallelism','Fix and measure again at peak']},
{note:'The standby does as much I/O as the primary. Do not size it with slower storage than the primary unless you accept more lag.'}],
src:[['Redo apply performance',O.DG]]};

/* ---------- 6: Broker health checks ---------- */
L['ora-dg:10:6']={blocks:[
{p:'A short, regular check catches most problems early. The broker gives it to you in a few commands.'},
{h:'The daily check'},
{t:[['Check','Command','Healthy'],
['Status','`SHOW CONFIGURATION;`','SUCCESS'],
['Readiness','`VALIDATE DATABASE stby;`','Ready for Switchover and Failover: Yes'],
['Lag','`SHOW DATABASE stby;`','Seconds'],
['Network','`VALIDATE NETWORK CONFIGURATION FOR ALL;`','No errors'],
['FSFO (if used)','`SHOW FAST_START FAILOVER;`','Enabled and observer present'],
['Alert logs','`grep ORA-` on both alert logs','No new errors']]},
{code:`#!/bin/bash
# dg_check.sh: run from cron, mail on a bad result
OUT=$(dgmgrl -silent / "show configuration" 2>&1)
echo "$OUT" | grep -q "SUCCESS" || echo "$OUT" | mail -s "Data Guard problem" dba-team@example.com

VAL=$(dgmgrl -silent / "validate database stby" 2>&1)
echo "$VAL" | grep -q "Ready for Switchover:  Yes" || echo "$VAL" | mail -s "Data Guard not ready" dba-team@example.com`},
{h:'Alerts'},
{t:[['Where','How'],
['Broker properties','`TransportLagThreshold`, `ApplyLagThreshold` raise a warning'],
['Enterprise Manager or the cloud console','Alerts and incident rules for Data Guard'],
['Your monitoring tool','Read the views or the output of the script above']]},
{flow:['Run the checks daily from a script','Alert the team on SUCCESS missing or a No in VALIDATE','Keep the output history','Review trends monthly']},
{note:'Include the observer in monitoring. A dead observer is silent until the day you need it.'}],
src:[['Monitoring with the broker',O.BKR]]};

/* ---------- 7: Practical ---------- */
L['ora-dg:10:7']={blocks:[
{p:'Five standbys are broken. For each one, read the symptom, find the cause with the tools from this section, and fix it. Create the faults in a lab, or ask a colleague to break your standby in secret.'},
{h:'Fault 1: Redo does not arrive'},
{t:[['Symptom','Cause to find'],
['`V$ARCHIVE_DEST_STATUS` shows ERROR, ORA-16191 or ORA-01017','Password files differ'],
['Fix','Copy the primary password file to the standby, enable the destination']]},
{h:'Fault 2: Cannot connect to the standby'},
{t:[['Symptom','Cause to find'],
['ORA-12514 or ORA-12541 on connect to stby','The static listener entry is missing, or the listener is down'],
['Fix','Add the entry or start the listener, reload and test with tnsping']]},
{h:'Fault 3: Apply is not real time'},
{t:[['Symptom','Cause to find'],
['ORA-16789, `RECOVERY_MODE` = MANAGED instead of REAL TIME APPLY','Standby redo logs missing or too small'],
['Fix','Add SRLs of the right size and count']]},
{h:'Fault 4: Apply stops after a new datafile'},
{t:[['Symptom','Cause to find'],
['ORA-01157 or ORA-01111 in the standby alert log after `ADD DATAFILE` on the primary','`STANDBY_FILE_MANAGEMENT=MANUAL`'],
['Fix','Create the file as in lecture 3, set the parameter to AUTO, restart apply']]},
{h:'Fault 5: Archive space'},
{t:[['Symptom','Cause to find'],
['ORA-00257 on the primary, or archive errors on the standby','The FRA or archive destination is full'],
['Fix','Back up and delete logs with the right deletion policy, enlarge space, then re-enable the destination']]},
{h:'Method for each fault'},
{flow:['Run SHOW CONFIGURATION and read the status','Check the destination status and alert logs','Form a hypothesis from the error','Fix it and verify with SHOW CONFIGURATION and the lag','Write the cause and the fix']},
{h:'Report'},
{ul:['Time of the fault and what users would see.','Evidence: error numbers and log lines.','Cause and fix.','How you will detect it next time.']},
{note:'The most useful skill here is reading the first error in the alert log. Most faults announce themselves there.'}],
src:[['Troubleshooting Data Guard',O.DG]]};

})();
