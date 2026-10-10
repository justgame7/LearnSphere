/* LearnSphere - Grid Infrastructure, ASM & RAC, Section 08: Services, Load Balancing & Application Continuity.
   Lectures 0-6 are core, 7-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const svc=O.dg(700,210,[
[10,20,150,50,'Service OLTP|preferred: inst 1, 2',2],[10,85,150,50,'Service BATCH|preferred: inst 2|available: inst 1',0],[10,150,150,50,'Service REPORT|preferred: inst 3',0],
[240,20,150,60,'Instance 1',0],[240,95,150,60,'Instance 2',0],[240,170,150,35,'Instance 3',0],
[470,20,220,185,'What a service gives you',1],[490,50,180,40,'Placement of the workload',0],[490,100,180,40,'Resource limits per service',0],[490,150,180,40,'Failover and drain settings',0]],
[[160,45,240,50],[160,110,240,115],[160,175,240,185]]);

const fan=O.dg(700,160,[
[10,50,130,60,'Node fails|or instance stops',0],[190,50,130,60,'Clusterware|raises a FAN event',2],[370,50,130,60,'ONS|delivers the event|to clients',2],[550,50,140,60,'Connection pool|drops bad connections|immediately',0]],
[[140,80,190,80],[320,80,370,80],[500,80,550,80]]);

/* ---------- 0: Database services ---------- */
L['ora-rac:7:0']={blocks:[
{p:'A **service** is a named workload that runs on one or more instances. Applications connect to the service, and the cluster decides where it runs and what happens when something fails.'},
{svg:svc},
{h:'Why use services'},
{t:[['Benefit','Example'],
['**Workload isolation**','OLTP on instances 1 and 2, reports on instance 3'],
['**Targeted monitoring**','Statistics and AWR sections per service'],
['**Failover rules**','OLTP can move, batch may stay down'],
['**Resource limits**','Resource Manager can map a service to a consumer group'],
['**Maintenance**','Move a service away from a node before you stop it']]},
{h:'Create and manage with srvctl'},
{code:`srvctl add service -db orcl -pdb pdb1 -service oltp_svc \\
  -preferred orcl1,orcl2 -role PRIMARY -notification TRUE \\
  -clbgoal SHORT -rlbgoal SERVICE_TIME

srvctl start service  -db orcl -service oltp_svc
srvctl status service -db orcl -service oltp_svc
srvctl config service -db orcl -service oltp_svc
srvctl relocate service -db orcl -service oltp_svc -oldinst orcl1 -newinst orcl2`},
{h:'Preferred and available instances'},
{t:[['Term','Meaning'],
['**Preferred**','Instances where the service runs normally'],
['**Available**','Instances where it moves if a preferred one fails'],
['**Role**','`PRIMARY` or `PHYSICAL_STANDBY`: the database role in which the service runs (Data Guard)']]},
{h:'Important service attributes'},
{t:[['Attribute','Meaning'],
['`-notification TRUE`','Send FAN events to clients'],
['`-clbgoal`, `-rlbgoal`','Connection and runtime load balancing goals'],
['`-failovertype`','`NONE`, `SESSION`, `SELECT`, `TRANSACTION`, `AUTO`'],
['`-commit_outcome TRUE`','Transaction Guard: know whether a commit finished'],
['`-drain_timeout`','Seconds allowed for sessions to drain']]},
{note:'Never use the default database service for applications. Create one service for each application or workload, so you can control it separately.'}],
src:[['Services',O.RAC],['srvctl add service',O.RAC+'server-control-utility-reference.html']]};

/* ---------- 1: Load balancing ---------- */
L['ora-rac:7:1']={blocks:[
{p:'Load balancing spreads connections and work across instances. It happens at **three places**: the client, the listener and the connection pool.'},
{t:[['Level','Where','How'],
['**Client-side**','In the connect string','The client picks a random SCAN address (`LOAD_BALANCE=ON`)'],
['**Server-side (connection)**','SCAN and local listeners','The listener picks the best instance when the connection is made'],
['**Runtime (pool)**','Connection pool','The pool uses advisory data to choose the least loaded instance for each request']]},
{h:'Client-side connect string'},
{code:`orcl_svc =
  (DESCRIPTION =
    (CONNECT_TIMEOUT = 10)(RETRY_COUNT = 3)(RETRY_DELAY = 2)
    (ADDRESS_LIST =
      (LOAD_BALANCE = ON)(FAILOVER = ON)
      (ADDRESS = (PROTOCOL = TCP)(HOST = rac-scan.example.com)(PORT = 1521))
    )
    (CONNECT_DATA = (SERVICE_NAME = oltp_svc))
  )`},
{p:'The SCAN name resolves to several addresses. With `LOAD_BALANCE=ON`, the client tries them in random order.'},
{h:'Server-side goals'},
{t:[['Goal','Used for','Meaning'],
['**CLB: `SHORT`**','Many short connections','Choose the instance by the load advisory'],
['**CLB: `LONG`**','Few long connections','Choose by the number of connections'],
['**RLB: `SERVICE_TIME`**','Pools','Balance by response time'],
['**RLB: `THROUGHPUT`**','Pools','Balance by the work done']]},
{flow:['Client connects to SCAN','SCAN listener checks the load of the instances for the service','It redirects to the best local listener','A pool later uses runtime advisory data for each borrowed connection']},
{note:'Use SHORT for web applications with pools and LONG for fixed connections such as a batch scheduler. The wrong goal causes uneven load.'}],
src:[['Load balancing',O.RAC]]};

/* ---------- 2: FAN and ONS ---------- */
L['ora-rac:7:2']={blocks:[
{p:'When something changes in the cluster, clients should know **immediately**, not after a network timeout. **Fast Application Notification (FAN)** delivers these events using the **Oracle Notification Service (ONS)**.'},
{svg:fan},
{h:'Events'},
{t:[['Event','Meaning'],
['**Instance DOWN / UP**','An instance stopped or started'],
['**Service DOWN / UP**','A service stopped or started on an instance'],
['**Node DOWN**','A node left the cluster'],
['**Planned DOWN**','A drain: the instance is about to stop for maintenance'],
['**Load advisory**','Current load per instance, for runtime balancing']]},
{h:'What clients do with FAN'},
{ul:['Remove connections to a failed instance from the pool at once.','Reconnect to a surviving instance quickly.','Stop sending new work to an instance that is draining.','Balance requests using load data.']},
{h:'Set it up'},
{code:`srvctl add service ... -notification TRUE        # service sends FAN events
srvctl config nodeapps                            # shows the ONS configuration
onsctl ping`},
{p:'Modern clients (JDBC UCP, OCI, ODP.NET) can find the ONS servers automatically from the connect string. Older clients need an explicit list of ONS hosts.'},
{flow:['A node fails','Clusterware posts an event','ONS delivers it to subscribed clients','Pools remove dead connections and reconnect to survivors','Users see a short pause instead of a long hang']},
{note:'Without FAN, a client may wait for the TCP timeout (minutes) to learn that a node died. FAN reduces this to seconds.'}],
src:[['Fast Application Notification',O.RAC]]};

/* ---------- 3: FCF and TAF ---------- */
L['ora-rac:7:3']={blocks:[
{p:'Two older ways to handle failure are **Fast Connection Failover (FCF)** and **Transparent Application Failover (TAF)**. They help, but neither replays a transaction.'},
{t:[['','FCF','TAF'],
['**Where**','Connection pool in the client (UCP, ODP.NET)','Oracle Call Interface and the connect descriptor'],
['**Uses**','FAN events','The error at the time of the next call'],
['**Effect**','Pool removes bad connections and creates new ones','The session reconnects to another instance'],
['**Queries**','Application must retry','`SELECT` can resume where it stopped'],
['**Open transactions**','Lost, application must redo them','**Lost**, application receives an error']]},
{h:'TAF configuration'},
{code:`oltp_taf =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = rac-scan)(PORT = 1521))
    (CONNECT_DATA =
      (SERVICE_NAME = oltp_svc)
      (FAILOVER_MODE = (TYPE = SELECT)(METHOD = BASIC)(RETRIES = 30)(DELAY = 5))
    )
  )

-- Or defined on the service (server side)
srvctl modify service -db orcl -service oltp_svc -failovertype SELECT -failovermethod BASIC -failoverretry 30 -failoverdelay 5`},
{t:[['TAF option','Meaning'],
['`TYPE=SESSION`','Reconnect the session only'],
['`TYPE=SELECT`','Reconnect and resume an open query'],
['`METHOD=BASIC`','Connect after the failure'],
['`METHOD=PRECONNECT`','Pre-connect to the second instance']]},
{h:'Limits of TAF'},
{ul:['DML and uncommitted transactions are **not** replayed.','Session state such as `ALTER SESSION` settings and PL/SQL variables is lost.','Some clients do not support it.']},
{note:'Oracle recommends Application Continuity instead of TAF for new applications. TAF is still useful for simple read-mostly applications.'}],
src:[['Fast Connection Failover and TAF',O.RAC]]};

/* ---------- 4: AC and TAC ---------- */
L['ora-rac:7:4']={blocks:[
{p:'**Application Continuity (AC)** goes further. After a failure it **replays** the work in progress on another instance, so the user sees a short delay and not an error. **Transparent Application Continuity (TAC)** does this without any application changes.'},
{h:'How AC works'},
{flow:['The client driver records the calls of the current request','A failure occurs (instance, node or network)','The driver connects to a surviving instance','It checks with Transaction Guard whether the last commit completed','It replays the recorded calls and continues']},
{h:'AC vs TAC'},
{t:[['','Application Continuity','Transparent Application Continuity'],
['**Request boundaries**','Application or the connection pool marks them','Oracle detects them automatically'],
['**Application change**','Needs a replay-aware driver or pool','None'],
['**Service setting**','`-failovertype TRANSACTION`','`-failovertype AUTO`'],
['**Since**','12.1','18c']]},
{code:`srvctl add service -db orcl -pdb pdb1 -service shop_svc -preferred orcl1,orcl2 \\
  -failovertype AUTO -commit_outcome TRUE -replay_init_time 600 \\
  -retention 86400 -failover_restore AUTO -notification TRUE`},
{t:[['Setting','Meaning'],
['`-commit_outcome TRUE`','Enable Transaction Guard (find out if a commit happened)'],
['`-replay_init_time`','Seconds after the failure during which replay is allowed'],
['`-retention`','How long the commit outcome is kept'],
['`-failover_restore`','Restore session state after failover']]},
{h:'Transaction Guard'},
{p:'**Transaction Guard** gives a reliable answer to the question: "did my last transaction commit?" The driver uses a logical transaction ID (LTXID) so a replay never duplicates a commit.'},
{h:'What cannot be replayed'},
{ul:['Work that depends on non-repeatable input, such as `SYSDATE` or random values, unless the application opts into keeping it.','Calls that change non-database state (for example sending an email).','Operations that are not marked as safe to replay.']},
{note:'AC is part of the RAC and Active Data Guard feature set. Check your licence before you rely on it, and test with your application and driver version.'}],
src:[['Application Continuity',O.RAC],['Transaction Guard',O.RAC]]};

/* ---------- 5: Draining ---------- */
L['ora-rac:7:5']={blocks:[
{p:'**Draining** removes users from an instance gently before maintenance. It is the planned-failure counterpart of FAN.'},
{h:'How it works'},
{flow:['You stop or relocate a service with a drain timeout','Clusterware sends a planned DOWN event through FAN','Pools stop giving new connections from that instance and let current requests finish','Sessions leave at the end of their requests','After the timeout, remaining sessions are stopped with the chosen option']},
{code:`# Stop a service on one instance with 120 seconds for sessions to finish
srvctl stop service -db orcl -service shop_svc -instance orcl1 -drain_timeout 120 -stopoption IMMEDIATE

# Relocate a service
srvctl relocate service -db orcl -service shop_svc -oldinst orcl1 -newinst orcl2 -drain_timeout 120 -stopoption IMMEDIATE

# Stop the whole instance after draining
srvctl stop instance -db orcl -instance orcl1 -drain_timeout 120 -stopoption IMMEDIATE`},
{t:[['Choice','Effect'],
['Short timeout','Fast maintenance, more users hit the end of the timeout'],
['Long timeout','Gentle, but you wait longer'],
['`-stopoption TRANSACTIONAL`','Wait for open transactions to finish'],
['`-stopoption IMMEDIATE`','Roll back what remains']]},
{h:'What the application must do'},
{ul:['Use a connection pool that understands FAN (UCP, ODP.NET, OCI session pool).','Return connections to the pool at the end of each request.','Keep requests short. A request that runs for hours will not drain.']},
{code:`-- Watch sessions leave
SELECT inst_id, service_name, COUNT(*) FROM gv$session WHERE username IS NOT NULL GROUP BY inst_id, service_name;`},
{note:'Draining works best with short requests and pools that follow FAN. A batch job holding one connection for hours needs to be scheduled around maintenance.'}],
src:[['Planned maintenance',O.RAC]]};

/* ---------- 6: Practical ---------- */
L['ora-rac:7:6']={blocks:[
{p:'Create a service, run a workload through it, and compare what the user experiences in a **planned** change (drain) and an **unplanned** failure (instance stop).'},
{h:'Step 1: Create the service'},
{code:`srvctl add service -db orcl -pdb pdb1 -service shop_svc \\
  -preferred orcl1 -available orcl2 \\
  -failovertype AUTO -commit_outcome TRUE -notification TRUE -drain_timeout 60 -stopoption IMMEDIATE
srvctl start service -db orcl -service shop_svc
srvctl status service -db orcl -service shop_svc`},
{h:'Step 2: Run a workload'},
{code:`sqlplus app_user@//rac-scan:1521/shop_svc
SET TIMING ON
-- run this in a loop (a short script or a pooled test application)
SELECT instance_name, COUNT(*) FROM v$instance, dual GROUP BY instance_name;`},
{h:'Step 3: Planned change (drain)'},
{code:`srvctl relocate service -db orcl -service shop_svc -oldinst orcl1 -newinst orcl2 -drain_timeout 60 -stopoption IMMEDIATE
srvctl status service -db orcl -service shop_svc`},
{h:'Step 4: Unplanned failure'},
{code:`srvctl stop instance -db orcl -instance orcl2 -stopoption ABORT
srvctl status service -db orcl -service shop_svc
srvctl start instance -db orcl -instance orcl2`},
{h:'What to observe'},
{t:[['Test','Expected'],
['After relocation','New work runs on `orcl2`. Existing sessions finish without errors.'],
['After the instance stop','With FAN and a replay-aware pool: a short pause, no error. With a plain sqlplus session: an error and a reconnect.'],
['Service status','Runs on the surviving instance, then fails back if you configured it']]},
{h:'Compare approaches'},
{t:[['Approach','User sees'],
['No FAN, no failover','A hang, then an error'],
['FCF or TAF','A reconnect, and the current work must be retried'],
['AC or TAC','A short delay, no error']]},
{note:'A plain SQL*Plus session cannot replay, so you will see errors. For a full AC demo, use a pooled Java application with the replay data source, and take a snapshot first.'}],
src:[['Services and failover',O.RAC]]};

})();
