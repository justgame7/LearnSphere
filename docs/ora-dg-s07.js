/* LearnSphere - Data Guard, Section 07: Fast-Start Failover & Observers.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const fsfo=O.dg(700,250,[
[10,20,200,100,'Site A|Primary prod',0],[490,20,200,100,'Site B|Standby stby|(failover target)',0],
[250,150,200,90,'Site C|Observer|(third location)',2],
[210,60,280,40,'redo transport (Data Guard)',0]],
[[130,120,300,170],[560,120,400,170],[210,80,490,80]]);

const timeline=O.dg(700,150,[
[10,40,140,70,'Primary becomes|unreachable',0],[190,40,150,70,'Observer and standby|both lose it for the|threshold (30 s)',2],[380,40,140,70,'Observer starts|failover',2],[560,40,130,70,'Standby is the|new primary',0]],
[[150,75,190,75],[340,75,380,75],[520,75,560,75]]);

/* ---------- 0: Concepts ---------- */
L['ora-dg:6:0']={blocks:[
{p:'**Fast-start failover (FSFO)** makes a failover **automatic**. A small process called the **observer** watches the primary. If the primary is lost, the observer starts the failover, with no human decision. This cuts the detection and decision parts of the RTO to seconds.'},
{svg:fsfo},
{h:'How it decides'},
{flow:['The observer, the standby and the primary talk to each other regularly','If the observer and the standby both lose the primary for the threshold time','And the standby is in a state where failover is safe (see lecture 3)','The observer tells the broker to fail over','The standby becomes the primary, and the old primary is reinstated later']},
{svg:timeline},
{h:'Requirements'},
{t:[['Requirement','Why'],
['**Data Guard broker**','The observer talks to the broker'],
['**Flashback Database on both**','To reinstate the old primary automatically'],
['**Standby with a clear target**','The `FastStartFailoverTarget` property'],
['**Observer on a third system**','So a site failure does not take the observer with it'],
['**Suitable protection mode**','Max Availability (sync) for zero loss, or Max Performance with a lag limit']]},
{h:'Conditions that can trigger it'},
{ul:['Loss of connectivity (the main case).','Selected failure conditions you enable, such as a corrupted control file.','An application asking for it with `DBMS_DG.INITIATE_FS_FAILOVER`.']},
{note:'FSFO is the usual way to meet a short RTO, and it needs careful testing. A badly set threshold can cause a failover for a short network glitch.'}],
src:[['Fast-start failover',O.BKR]]};

/* ---------- 1: Targets, thresholds, lag ---------- */
L['ora-dg:6:1']={blocks:[
{p:'A few properties control **when** and **to which database** FSFO fails over.'},
{t:[['Property','Meaning','Notes'],
['`FastStartFailoverTarget`','Standby (or ordered list) that takes over','Set on the primary'],
['`FastStartFailoverThreshold`','Seconds the primary must be unreachable before failover','Default 30. Lower is faster, but riskier for network blips.'],
['`FastStartFailoverLagLimit`','Maximum data loss allowed (seconds) in Max Performance mode','Default 30'],
['`FastStartFailoverAutoReinstate`','Reinstate the old primary automatically','Default TRUE'],
['`FastStartFailoverPmyShutdown`','Primary shuts itself down if it cannot reach the observer or standby','Default TRUE, prevents split brain'],
['`ObserverReconnect`','Seconds the observer waits before reconnecting after a lost connection','Tune for your network'],
['`ObserverPingInterval` / `ObserverPingRetry`','How the observer checks the primary','Defaults are fine to start']]},
{code:`DGMGRL> EDIT DATABASE prod SET PROPERTY FastStartFailoverTarget = 'stby';
DGMGRL> EDIT DATABASE stby SET PROPERTY FastStartFailoverTarget = 'prod';
DGMGRL> EDIT CONFIGURATION SET PROPERTY FastStartFailoverThreshold = 30;
DGMGRL> EDIT CONFIGURATION SET PROPERTY FastStartFailoverLagLimit = 30;
DGMGRL> SHOW FAST_START FAILOVER;`},
{h:'Choosing the threshold'},
{t:[['Setting','Trade-off'],
['**Low (for example 15 s)**','Faster failover, but a short network problem may trigger it'],
['**Default (30 s)**','A good start'],
['**High (60 s or more)**','Fewer false failovers, slower recovery']]},
{h:'Why the primary shuts down'},
{p:'If the primary loses contact with **both** the observer and the standby, it assumes it has been isolated and a failover may happen. It then **shuts itself down** after the threshold, so two primaries cannot run at once (split brain).'},
{flow:['Set the target on both databases (the other member)','Choose threshold and lag limit from your RTO and RPO','Test with a simulated outage','Adjust and write down the values']},
{note:'Do not set the threshold below what your network can reliably guarantee. Test with real network failures, not only database failures.'}],
src:[['FSFO properties',O.BKR]]};

/* ---------- 2: Observer ---------- */
L['ora-dg:6:2']={blocks:[
{p:'The **observer** is a lightweight DGMGRL process. It does not hold data. It only watches and decides. Where it runs is an important design choice.'},
{h:'Where to run it'},
{t:[['Placement','Result'],
['**Third site**','Best. Neither site failure takes it with it.'],
['**On the standby site**','Acceptable, but if the standby site fails, there is no automatic failover (which is correct) but if the site is cut off from the primary you cannot tell the difference'],
['**On the primary site**','Poor: a site failure kills both primary and observer']]},
{h:'Install and start'},
{ul:['Install the Oracle client or database software on the observer host (the DGMGRL tool).','Create a wallet or secure login so the observer can connect to the databases.','Make sure the host has network access to both databases.']},
{code:`# Foreground
dgmgrl sys@prod
DGMGRL> ENABLE FAST_START FAILOVER;
DGMGRL> START OBSERVER;

# Background, with files (12.2 and later)
DGMGRL> START OBSERVER obs1 IN BACKGROUND FILE IS /u01/obs/fsfo.dat LOGFILE IS /u01/obs/obs1.log;
DGMGRL> SHOW OBSERVER;
DGMGRL> STOP OBSERVER obs1;`},
{h:'Multiple observers'},
{p:'You can run several observers (up to three) at different places. One is the **master**. If it fails, a backup observer takes over.'},
{code:`DGMGRL> SET MASTEROBSERVER TO obs2;
DGMGRL> SHOW OBSERVER;`},
{h:'Run it as a service'},
{ul:['Start the observer at boot with systemd or a similar manager.','Monitor it. A dead observer means no automatic failover.','Keep its log files and rotate them.']},
{note:'Treat the observer like a production component. A silent, dead observer is the most common reason that FSFO does not work in a real disaster.'}],
src:[['Observer',O.BKR]]};

/* ---------- 3: Modes ---------- */
L['ora-dg:6:3']={blocks:[
{p:'FSFO behaves differently in the two protection modes that support it. This decides how much data you can lose, and when failover is allowed.'},
{t:[['','Maximum Availability','Maximum Performance'],
['**Transport**','SYNC (or FASTSYNC)','ASYNC'],
['**FSFO allowed when**','The standby is synchronised (no data loss)','The standby lag is within `FastStartFailoverLagLimit`'],
['**Data loss at failover**','None','Up to the lag limit'],
['**Failover blocked when**','The standby is not synchronised','The lag exceeds the limit'],
['**Cost**','Commit waits for the standby','No effect on primary speed']]},
{h:'How to choose'},
{flow:['RPO is zero? Maximum Availability with SYNC, and a standby within a few milliseconds','RPO of seconds is acceptable, or the distance is long? Maximum Performance with a lag limit','Check that failover is not blocked in normal operation: look at SHOW FAST_START FAILOVER']},
{h:'What the broker shows'},
{code:`DGMGRL> SHOW FAST_START FAILOVER;

Fast-Start Failover: Enabled in Zero Data Loss Mode
  Protection Mode:    MaxAvailability
  Lag Limit:          0 seconds (not in use)
  Threshold:          30 seconds
  Active Target:      stby
  Potential Targets:  "stby"
  Observer:           obs1`},
{t:[['Display','Meaning'],
['Zero Data Loss Mode','Max Availability with a synchronised standby'],
['Potential Data Loss Mode','Max Performance. Data loss up to the lag limit is possible.']]},
{note:'In Maximum Availability, if the standby is temporarily out of sync (for example after a network blip), automatic failover is **blocked** until it is synchronised again. That protects data, but can delay recovery.'}],
src:[['FSFO and protection modes',O.BKR]]};

/* ---------- 4: Auto reinstate ---------- */
L['ora-dg:6:4']={blocks:[
{p:'After an automatic failover, the old primary should return as a standby **without manual work**. This is **automatic reinstate**.'},
{flow:['The old primary is repaired or its host starts again','It starts in MOUNT (this is set by Oracle Restart or clusterware, or by the start-up script)','The observer finds it and asks the broker to reinstate it','Flashback Database takes it back to the divergence point','It becomes a standby and catches up from the new primary']},
{t:[['Needs','Detail'],
['`FastStartFailoverAutoReinstate = TRUE`','Default'],
['Flashback Database on the old primary','Logs must cover the divergence time'],
['The database starts in MOUNT','Not OPEN, so the broker can convert it'],
['The observer is running','It starts the reinstate']]},
{code:`DGMGRL> SHOW CONFIGURATION;
-- after reinstate:
--   stby - Primary database
--     prod - (*) Physical standby database
-- (*) Fast-Start Failover target`},
{h:'Make the database start in MOUNT'},
{code:`# With Oracle Restart or clusterware, register the standby start option
srvctl modify database -db prod -startoption MOUNT`},
{p:'After the reinstate, the broker sets the correct role for the resource, so services and restarts follow the new role.'},
{h:'If it does not reinstate'},
{ul:['Check `SHOW CONFIGURATION` and the observer log for the reason.','Flashback logs may be gone. Then rebuild with RMAN duplicate.','The old primary may be started OPEN by a script. Stop it and mount it.']},
{note:'Test the whole cycle: failover, return of the old primary, reinstate. Most problems appear only when you do the second half.'}],
src:[['Automatic reinstate',O.BKR]]};

/* ---------- 5: VALIDATE FAST_START FAILOVER [26ai] ---------- */
L['ora-dg:6:5']={blocks:[
{p:'Before you rely on FSFO, you must know that it **will work**. A validation command checks the configuration without starting a failover **[26ai]**.'},
{h:'What the check covers'},
{t:[['Item','Question'],
['**Observer**','Is a master observer running and connected?'],
['**Target**','Is a valid target configured and healthy?'],
['**Flashback**','Is Flashback Database on, so reinstate will work?'],
['**Protection mode and lag**','Is the standby in a state where failover is allowed now?'],
['**Properties**','Are threshold and lag limit set as intended?']]},
{code:`DGMGRL> VALIDATE FAST_START FAILOVER;      -- 26ai: checks that FSFO is ready to act

-- Commands that exist in earlier releases and help in 19c
DGMGRL> SHOW FAST_START FAILOVER;
DGMGRL> SHOW OBSERVER;
DGMGRL> VALIDATE DATABASE stby;`},
{h:'How to use it'},
{flow:['Run the check after every configuration change','Run it on a schedule (for example daily) and alert on a bad result','Run it before planned maintenance that touches the observer or the standby','Fix findings and run it again']},
{h:'In 19c'},
{p:'The `VALIDATE FAST_START FAILOVER` command is new in 26ai. In 19c you reach the same assurance by combining `SHOW FAST_START FAILOVER`, `SHOW OBSERVER`, `VALIDATE DATABASE` and the observer log.'},
{note:'Check the Data Guard Broker reference for the exact output and options in your release. Details can change between release updates.'}],
src:[['Data Guard Broker',O.BKR]]};

/* ---------- 6: Practical ---------- */
L['ora-dg:6:6']={blocks:[
{p:'Configure fast-start failover and trigger an **automatic failover** in your lab. You need a working broker configuration (section 5) with flashback on both databases, and a third host (or a third session) for the observer.'},
{h:'Step 1: Prepare'},
{code:`DGMGRL> SHOW CONFIGURATION;
DGMGRL> EDIT CONFIGURATION SET PROTECTION MODE AS MAXAVAILABILITY;
DGMGRL> EDIT DATABASE prod SET PROPERTY LogXptMode = 'SYNC';
DGMGRL> EDIT DATABASE stby SET PROPERTY LogXptMode = 'SYNC';
DGMGRL> EDIT DATABASE prod SET PROPERTY FastStartFailoverTarget = 'stby';
DGMGRL> EDIT DATABASE stby SET PROPERTY FastStartFailoverTarget = 'prod';
DGMGRL> VALIDATE DATABASE stby;`},
{h:'Step 2: Enable and start the observer'},
{code:`DGMGRL> ENABLE FAST_START FAILOVER;
DGMGRL> START OBSERVER obs1 IN BACKGROUND FILE IS /u01/obs/fsfo.dat LOGFILE IS /u01/obs/obs1.log;
DGMGRL> SHOW FAST_START FAILOVER;
DGMGRL> SHOW OBSERVER;`},
{h:'Step 3: Trigger a failure (lab only)'},
{code:`-- On the primary host
SHUTDOWN ABORT
-- Watch the observer log and, on the standby host
tail -f /u01/obs/obs1.log`},
{h:'Step 4: Observe the failover'},
{flow:['After the threshold (about 30 s), the observer starts failover','The standby becomes primary','Check SHOW CONFIGURATION','Start the old primary in MOUNT','Watch it be reinstated automatically']},
{code:`DGMGRL> SHOW CONFIGURATION;
-- on the old primary
STARTUP MOUNT`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`SHOW FAST_START FAILOVER`','Enabled in Zero Data Loss Mode, observer present'],
['After the abort','Automatic failover after about the threshold time'],
['New primary','`stby`, open read write'],
['Old primary mounted','Reinstated automatically as a standby'],
['Total time','Your measured RTO']]},
{h:'Questions'},
{ul:['What was the total outage seen by an application?','What would change with a lower threshold?','What if the observer had been on the primary site?']},
{note:'Stop the observer or disable FSFO after the lab (`DISABLE FAST_START FAILOVER`) so that a later test does not cause a surprise failover.'}],
src:[['Configuring fast-start failover',O.BKR]]};

})();
