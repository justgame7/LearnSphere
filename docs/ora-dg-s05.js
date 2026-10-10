/* LearnSphere - Data Guard, Section 05: Data Guard Broker & DGMGRL.
   Lectures 0-7 are core, 8-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const brk=O.dg(700,230,[
[10,10,330,210,'Primary prod',1],[30,45,140,40,'DMON process',2],[190,45,130,40,'Broker config|files (2 copies)',0],[30,110,290,40,'Database and redo transport|managed by the broker',0],[30,165,290,40,'DGMGRL connects here',0],
[360,10,330,210,'Standby stby',1],[380,45,140,40,'DMON process',2],[540,45,130,40,'Broker config|files (2 copies)',0],[380,110,290,40,'Database and redo apply|managed by the broker',0],[380,165,290,40,'Observer (optional, third site)',0]],
[[340,65,380,65]]);

/* ---------- 0: Broker architecture ---------- */
L['ora-dg:4:0']={blocks:[
{p:'The **Data Guard broker** is a management layer that runs inside the databases. It replaces many manual SQL commands with a few consistent ones, and it is **required** for fast-start failover.'},
{svg:brk},
{h:'The pieces'},
{t:[['Piece','Role'],
['**DMON**','Background process on every member. Keeps the configuration and runs commands.'],
['**Configuration files**','Two copies per database that hold the broker configuration (`dr1<db>.dat`, `dr2<db>.dat`)'],
['**DGMGRL**','Command-line client you use to talk to the broker'],
['**Properties**','Settings of the configuration and of each member, such as `LogXptMode`'],
['**Observer**','A process for automatic failover (fast-start failover)']]},
{h:'What the broker does for you'},
{ul:['Sets the redo transport and apply parameters on each member from its properties.','Switchover, failover and reinstate with one command.','Monitors health and reports it in one place.','Keeps the configuration the same after role changes.']},
{h:'Parameters that matter'},
{code:`SHOW PARAMETER dg_broker
-- dg_broker_start        TRUE
-- dg_broker_config_file1 .../dr1prod.dat
-- dg_broker_config_file2 .../dr2prod.dat`},
{h:'Statuses'},
{t:[['Status','Meaning'],
['**SUCCESS**','Everything is fine'],
['**WARNING**','Something needs attention, such as lag over a threshold'],
['**ERROR**','A real problem, such as a stopped transport']]},
{note:'Once a database is under broker control, do not change redo transport parameters by hand. The broker will overwrite them. Change properties with DGMGRL.'}],
src:[['Data Guard Broker',O.BKR]]};

/* ---------- 1: Create configuration ---------- */
L['ora-dg:4:1']={blocks:[
{p:'Creating a configuration takes four steps: start DMON, create the configuration, add the standby, and enable it.'},
{h:'Step 1: Start the broker on both databases'},
{code:`ALTER SYSTEM SET dg_broker_start = TRUE SCOPE = BOTH;`},
{p:'If the databases use ASM or RAC, set `DG_BROKER_CONFIG_FILE1` and `2` to shared locations first (see the RAC and ASM lecture).'},
{h:'Step 2: Create the configuration (on the primary)'},
{code:`dgmgrl sys@prod
DGMGRL> CREATE CONFIGURATION dg_conf AS PRIMARY DATABASE IS prod CONNECT IDENTIFIER IS prod;
DGMGRL> ADD DATABASE stby AS CONNECT IDENTIFIER IS stby MAINTAINED AS PHYSICAL;
DGMGRL> ENABLE CONFIGURATION;`},
{h:'Step 3: Check'},
{code:`DGMGRL> SHOW CONFIGURATION;

Configuration - dg_conf
  Protection Mode: MaxPerformance
  Members:
  prod - Primary database
    stby - Physical standby database
Fast-Start Failover:  Disabled
Configuration Status:
SUCCESS   (status updated 12 seconds ago)`},
{h:'Clean up manual settings'},
{ul:['Remove or leave `LOG_ARCHIVE_DEST_2`: the broker manages it from now on.','Leave `FAL_SERVER` and `STANDBY_FILE_MANAGEMENT` set as before.','Do not start or stop redo apply by hand any more. Use the broker state.']},
{flow:['Start DMON on both','Create the configuration with the primary','Add the standby','Enable the configuration and check it']},
{note:'The configuration is created on the primary and copied to every member. Use `SHOW CONFIGURATION` after each step.'}],
src:[['Creating a broker configuration',O.BKR]]};

/* ---------- 2: Properties ---------- */
L['ora-dg:4:2']={blocks:[
{p:'**Properties** are the broker way to set what used to be parameters. Some belong to the configuration, others to each database.'},
{h:'Common database properties'},
{t:[['Property','Meaning','Example value'],
['`LogXptMode`','Redo transport mode','`ASYNC`, `SYNC`, `FASTSYNC`'],
['`DelayMins`','Apply delay in minutes','`0` (no delay)'],
['`Binding`','Whether transport failure stops the primary','`OPTIONAL` or `MANDATORY`'],
['`NetTimeout`','Seconds to wait for the network','`30`'],
['`MaxFailure`','Failures allowed before the destination is dropped','`0`'],
['`RedoCompression`','Compress redo in transit (Advanced Compression)','`DISABLE` or `ENABLE`'],
['`ApplyParallel`','Number of apply processes','`AUTO`'],
['`StandbyFileManagement`','Automatic datafile creation','`AUTO`'],
['`FastStartFailoverTarget`','Which standby takes over in fast-start failover','`stby`'],
['`RedoRoutes`','Where redo goes (cascading, far sync)','`(prod : stby ASYNC)`'],
['`StaticConnectIdentifier`','How the broker connects when the instance is down','Set by the broker']]},
{code:`DGMGRL> SHOW DATABASE stby;
DGMGRL> SHOW DATABASE VERBOSE stby;
DGMGRL> EDIT DATABASE stby SET PROPERTY LogXptMode = 'SYNC';
DGMGRL> EDIT DATABASE stby SET PROPERTY DelayMins = 0;
DGMGRL> EDIT CONFIGURATION SET PROTECTION MODE AS MAXAVAILABILITY;`},
{h:'States'},
{code:`DGMGRL> EDIT DATABASE stby SET STATE = 'APPLY-OFF';   -- stop apply (for maintenance)
DGMGRL> EDIT DATABASE stby SET STATE = 'APPLY-ON';     -- start again
DGMGRL> EDIT DATABASE stby SET STATE = 'TRANSPORT-OFF';  -- stop transport on the primary`},
{flow:['Look at the current properties with SHOW DATABASE VERBOSE','Change one property with EDIT DATABASE','Check with SHOW CONFIGURATION','The broker updates parameters on the members']},
{note:'Change one thing at a time and check the result. A mistaken property such as `Binding=MANDATORY` with a lost standby can halt the primary.'}],
src:[['Broker properties',O.BKR]]};

/* ---------- 3: Daily commands ---------- */
L['ora-dg:4:3']={blocks:[
{p:'These are the DGMGRL commands you will use every day. Learn them by heart.'},
{t:[['Task','Command'],
['Overall status','`SHOW CONFIGURATION;`'],
['A database in detail','`SHOW DATABASE stby;` or `VERBOSE`'],
['Planned role change','`SWITCHOVER TO stby;`'],
['Unplanned role change','`FAILOVER TO stby;`'],
['Bring a failed primary back as a standby','`REINSTATE DATABASE prod;`'],
['Stop or start apply','`EDIT DATABASE stby SET STATE = \'APPLY-OFF\';`'],
['Check readiness','`VALIDATE DATABASE stby;`'],
['Test copy','`CONVERT DATABASE stby TO SNAPSHOT STANDBY;` and `... TO PHYSICAL STANDBY;`'],
['Remove a member','`REMOVE DATABASE stby;`'],
['Fast-start failover','`ENABLE FAST_START FAILOVER;`, `SHOW FAST_START FAILOVER;`']]},
{h:'Use DGMGRL in scripts'},
{code:`dgmgrl -silent sys@prod "show configuration"
dgmgrl -silent sys@prod "validate database stby"

# A simple health check
STATUS=$(dgmgrl -silent sys@prod "show configuration" | grep -E "^(SUCCESS|WARNING|ERROR)")
echo $STATUS`},
{p:'Use a **wallet** or an OS-authenticated connection (for example `dgmgrl /`) so you do not put passwords in scripts.'},
{flow:['SHOW CONFIGURATION: is it SUCCESS?','VALIDATE DATABASE before any role change','Run the change with one command','Check SHOW CONFIGURATION again']},
{note:'Always run SHOW CONFIGURATION before and after every change. It tells you whether the broker agrees with what you think.'}],
src:[['DGMGRL commands',O.BKR]]};

/* ---------- 4: VALIDATE DATABASE ---------- */
L['ora-dg:4:4']={blocks:[
{p:'`VALIDATE DATABASE` checks whether a standby is ready for a role change. It is the quickest way to find problems **before** you need to switch.'},
{code:`DGMGRL> VALIDATE DATABASE stby;

  Database Role:     Physical standby database
  Primary Database:  prod

  Ready for Switchover:  Yes
  Ready for Failover:    Yes (Primary Running)

  Flashback Database Status:
    prod:  On
    stby:  On

  Capacity Information:
    Database  Instances        Threads
    prod      1                1
    stby      1                1

  Standby Redo Log Files:  Online redo logs: 4 / Standby redo logs: 4   OK`},
{t:[['Line','What to check'],
['**Ready for Switchover**','Yes. If No, read the reason.'],
['**Ready for Failover**','Yes'],
['**Flashback Database Status**','On at both (needed for reinstate)'],
['**Capacity**','Same number of instances and threads'],
['**Standby redo logs**','Enough and the right size']]},
{h:'More checks'},
{code:`DGMGRL> VALIDATE DATABASE VERBOSE stby;
DGMGRL> VALIDATE NETWORK CONFIGURATION FOR ALL;
DGMGRL> VALIDATE STATIC CONNECT IDENTIFIER FOR ALL;`},
{h:'Common warnings'},
{t:[['Message','Meaning'],
['**ORA-16809** multiple warnings for the member','See `SHOW DATABASE` for each warning'],
['**ORA-16810** multiple errors or warnings detected for the database','Same, but errors'],
['**ORA-16766** Redo Apply is stopped','Start apply with `SET STATE = \'APPLY-ON\'`'],
['**ORA-16789** standby redo logs not configured','Add SRLs']]},
{flow:['Run VALIDATE DATABASE regularly (for example daily)','Fix every No and every warning','Run it again before any planned switchover']},
{note:'A good routine is to run VALIDATE DATABASE and SHOW CONFIGURATION from a monitoring script every day and send the result to the DBA team.'}],
src:[['VALIDATE command',O.BKR]]};

/* ---------- 5: Broker with RAC and ASM ---------- */
L['ora-dg:4:5']={blocks:[
{p:'On RAC or ASM, a few settings are needed so that the broker works across all instances and nodes.'},
{h:'Configuration files in shared storage'},
{code:`-- On every RAC database, in ASM
ALTER SYSTEM SET dg_broker_config_file1 = '+DATA/prod/dr1prod.dat' SCOPE = BOTH SID = '*';
ALTER SYSTEM SET dg_broker_config_file2 = '+FRA/prod/dr2prod.dat'  SCOPE = BOTH SID = '*';
ALTER SYSTEM SET dg_broker_start = TRUE SCOPE = BOTH SID = '*';`},
{p:'The files must be reachable by **all instances**, so they go in ASM (or a cluster file system), not in a local folder.'},
{h:'How the broker works with RAC'},
{t:[['Aspect','Detail'],
['**DMON**','Runs on each instance. One acts as the monitor for the database.'],
['**Role change**','The broker restarts instances using clusterware (`srvctl`) when needed'],
['**Services**','Role-based services start and stop with the role'],
['**Static listener entries**','The `_DGMGRL` entry matters for non-clusterware databases. For Grid-managed databases clusterware restarts instances.']]},
{h:'ASM notes'},
{ul:['The standby uses its own disk groups. Name convert is not needed with OMF.','Configuration files in different disk groups are good for redundancy.','Add the standby with `ADD DATABASE ... MAINTAINED AS PHYSICAL` as usual.']},
{flow:['Put both broker configuration files in ASM','Start the broker on all instances','Create the configuration','Check that every instance shows in SHOW DATABASE']},
{note:'If a broker file is lost or damaged, the broker reports an error. Both files exist for redundancy, so keep them in different places.'}],
src:[['Broker with RAC',O.BKR]]};

/* ---------- 6: DBMS_DG [26ai] ---------- */
L['ora-dg:4:6']={blocks:[
{p:'Besides DGMGRL, the broker can be controlled from **PL/SQL** through the `DBMS_DG` package, and its state can be read from **views**. This helps applications, scripts and monitoring tools that cannot use the command line. Newer releases add more of both **[26ai]**.'},
{h:'What DBMS_DG offers'},
{t:[['Procedure','Purpose'],
['`DBMS_DG.INITIATE_FS_FAILOVER`','An application asks the observer to start a fast-start failover when it detects a condition you define'],
['Status and role-change helpers','Read broker state from SQL (check the package reference for your release)']]},
{code:`DECLARE
  status INTEGER;
BEGIN
  status := DBMS_DG.INITIATE_FS_FAILOVER('Application lost its connection to storage');
  DBMS_OUTPUT.PUT_LINE('status = ' || status);
END;
/`},
{h:'Views'},
{t:[['View','Shows'],
['`V$DG_BROKER_CONFIG`','The broker configuration and its members'],
['`V$DG_BROKER_ROLE_CHANGE`','History of role changes'],
['`V$DATAGUARD_STATUS`','Messages about Data Guard activity']]},
{code:`SELECT * FROM v$dg_broker_config;
SELECT * FROM v$dg_broker_role_change;`},
{h:'What is new in 26ai'},
{p:'26ai adds more broker information and controls in PL/SQL and views, so that monitoring and automation can use SQL only. The exact list changes between release updates. Check the **Data Guard Broker** and **PL/SQL Packages** references for 26ai.'},
{flow:['Decide if you need SQL access to the broker','Check the package and view references for your release','Wrap the calls in a small, tested procedure','Keep DGMGRL as the normal interface for DBAs']},
{note:'Application-initiated failover is powerful. Define the conditions with the application team, and test it carefully, since it can start a real failover.'}],
src:[['DBMS_DG',D+'arpls/DBMS_DG.html'],['Data Guard Broker',O.BKR]]};

/* ---------- 7: Practical ---------- */
L['ora-dg:4:7']={blocks:[
{p:'You have a working standby that was built by hand (section 4). Bring it under **broker control**.'},
{h:'Steps'},
{flow:['Check that apply works and that SRLs exist on both sides','Start DMON on both databases','Create the configuration and add the standby','Enable the configuration','Check status and validate']},
{code:`-- Both databases
ALTER SYSTEM SET dg_broker_start = TRUE SCOPE = BOTH;

dgmgrl sys@prod
DGMGRL> CREATE CONFIGURATION dg_conf AS PRIMARY DATABASE IS prod CONNECT IDENTIFIER IS prod;
DGMGRL> ADD DATABASE stby AS CONNECT IDENTIFIER IS stby MAINTAINED AS PHYSICAL;
DGMGRL> ENABLE CONFIGURATION;
DGMGRL> SHOW CONFIGURATION;
DGMGRL> SHOW DATABASE VERBOSE stby;
DGMGRL> VALIDATE DATABASE stby;
DGMGRL> VALIDATE NETWORK CONFIGURATION FOR ALL;`},
{h:'Change a property and see the effect'},
{code:`DGMGRL> EDIT DATABASE stby SET PROPERTY LogXptMode = 'SYNC';
DGMGRL> EDIT CONFIGURATION SET PROTECTION MODE AS MAXAVAILABILITY;
DGMGRL> SHOW CONFIGURATION;

-- On the primary: the broker changed the destination parameter
SHOW PARAMETER log_archive_dest_2`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`SHOW CONFIGURATION`','SUCCESS'],
['`VALIDATE DATABASE stby`','Ready for Switchover: Yes, Ready for Failover: Yes'],
['Flashback status','On at both'],
['After changing LogXptMode','`log_archive_dest_2` shows SYNC'],
['Apply','Started by the broker, not by hand']]},
{h:'Challenge'},
{ul:['Stop apply with `SET STATE = \'APPLY-OFF\'`, watch the warning in SHOW CONFIGURATION, then start it again.','Run VALIDATE DATABASE VERBOSE and read every line.']},
{note:'If the configuration status is WARNING or ERROR, read SHOW DATABASE for the member named. The messages state what to do.'}],
src:[['Data Guard Broker',O.BKR]]};

})();
