/* LearnSphere - SQL Server High Availability & DR, Section 08: Replication.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const arch=M.dg(700,240,[
[10,15,200,200,'Publisher',1],[25,55,170,50,'Publication',2],[25,115,170,50,'Articles|tables, procedures',0],
[250,15,200,200,'Distributor',1],[265,55,170,50,'Distribution database',2],[265,115,170,50,'Agents run here|or at subscriber',0],
[490,15,200,200,'Subscribers',1],[505,55,170,50,'Subscription',2],[505,115,170,50,'Local copy of data',0]],
[[195,80,265,80],[435,80,505,80]]);

const types=M.dg(700,200,[
[10,15,215,170,'Snapshot',1],[25,50,185,30,'Whole data set copied',2],[25,90,185,30,'Periodic, simple',0],[25,130,185,30,'Small, rarely changing',0],
[245,15,215,170,'Transactional',1],[260,50,185,30,'Changes sent near real time',2],[260,90,185,30,'One-way, low latency',0],[260,130,185,30,'Reporting, distribution',0],
[480,15,210,170,'Merge',1],[495,50,180,30,'Changes in both directions',2],[495,90,180,30,'Conflict resolution',0],[495,130,180,30,'Disconnected users',0]],
[]);

const agent=M.dg(700,180,[
[10,25,150,70,'Snapshot Agent|creates initial|snapshot files',0],[190,25,150,70,'Log Reader Agent|reads the log,|writes commands',2],[370,25,150,70,'Distribution Agent|applies commands|to subscribers',2],[550,25,140,70,'Merge Agent|for merge|replication',0],
[10,115,680,50,'Agents run as SQL Server Agent jobs.|Their schedule and account are the first things to check when replication stops.',0]],
[]);

const mon=M.dg(700,150,[
[10,25,200,70,'Replication Monitor|status, latency,|errors per agent',2],[250,25,200,70,'Tracer tokens|measure end to end|latency',0],[490,25,200,70,'Distribution DB|history and|undelivered commands',0]],
[]);

/* ---------- 0: Components ---------- */
L['mss-ha:7:0']={blocks:[
{p:'**Replication** copies and distributes data and database objects from one database to others, and keeps them in sync. It is mainly a **data distribution** technology, not a failover feature.'},
{svg:arch},
{h:'Roles and objects'},
{t:[['Term','Meaning'],
['**Publisher**','The source database that makes data available'],
['**Distributor**','Holds the distribution database and metadata, and runs agents'],
['**Subscriber**','The destination that receives the data'],
['**Publication**','A set of articles replicated as a unit'],
['**Article**','A table, view, procedure or other object in a publication'],
['**Subscription**','Defines which publication goes to which subscriber, push or pull']]},
{h:'Push and pull'},
{ul:['**Push**: the distributor runs the agent and pushes changes: central control.','**Pull**: the subscriber runs the agent and pulls changes: offloads the distributor.']},
{note:'Replication is flexible but has many moving parts. Each agent, job, permission and schedule is a place for something to fail, so monitoring is not optional.'}],
src:[['SQL Server replication',M.SS+'replication/sql-server-replication'],['Replication concepts',M.SS+'replication/replication-architecture']]};

/* ---------- 1: Snapshot and transactional ---------- */
L['mss-ha:7:1']={blocks:[
{p:'**Snapshot** and **transactional** replication cover most one-way distribution needs.'},
{svg:types},
{t:[['','Snapshot','Transactional'],
['**What moves**','Entire articles at each run','Initial snapshot, then individual changes'],
['**Latency**','Hours or days','Seconds to minutes'],
['**Load**','Heavy during snapshot','Steady, small'],
['**Requires**','Nothing special','Primary key on replicated tables'],
['**Typical use**','Small reference data','Reporting copies, data distribution, near real time feeds']]},
{h:'How transactional works'},
{flow:['The snapshot agent creates the initial copy and it is applied to the subscriber','The log reader agent reads committed changes from the publisher log','Changes go to the distribution database','The distribution agent applies them to subscribers in commit order']},
{note:'The log reader must read the log before it can be truncated. If it stops, the publisher log grows with the wait reason REPLICATION. Monitor agent health to protect the log.'}],
src:[['Snapshot replication',M.SS+'replication/snapshot-replication'],['Transactional replication',M.SS+'replication/transactional/transactional-replication']]};

/* ---------- 2: Merge ---------- */
L['mss-ha:7:2']={blocks:[
{p:'**Merge replication** allows changes at both the publisher and subscribers, and **merges** them, resolving conflicts. It was built for **occasionally connected** users and devices.'},
{h:'How it works'},
{flow:['Each replicated table gets tracking columns and triggers','Changes at any site are recorded locally','The merge agent exchanges and merges changes','Conflicts are resolved by a rule, such as publisher wins or latest change wins']},
{t:[['Aspect','Merge replication'],
['**Direction**','Both'],
['**Conflicts**','Possible, resolvers decide'],
['**Schema impact**','Adds rowguid column and triggers'],
['**Good for**','Mobile or branch databases that work offline'],
['**Less suitable**','High-volume OLTP with many updates']]},
{note:'Merge replication adds complexity and overhead. Newer designs often use other patterns, such as APIs or sync services, but you will meet it in existing systems.'}],
src:[['Merge replication',M.SS+'replication/merge/merge-replication'],['Detect and resolve merge conflicts',M.SS+'replication/merge/advanced-merge-replication-conflict-detection-and-resolution']]};

/* ---------- 3: Monitoring ---------- */
L['mss-ha:7:3']={blocks:[
{p:'Replication has several **agents** and several places for delay. Know the standard tools and the usual causes.'},
{svg:agent},
{svg:mon},
{h:'Replication Monitor'},
{ul:['Shows each **publication**, **subscription** and **agent** with status and latency.','Lets you view **errors** and the last commands.','Supports **tracer tokens**: post a token on the publisher and see when it reaches the distributor and subscriber.']},
{h:'Common issues'},
{t:[['Symptom','Likely cause'],
['Subscriber behind','Distribution agent slow or stopped, blocking at subscriber, network'],
['Publisher log grows','Log reader not running, `REPLICATION` log reuse wait'],
['Agent fails with permission error','Account or password changed'],
['Row not found, PK violation','Data changed directly at the subscriber'],
['Snapshot fails or very slow','Large tables, locks, disk space on the distributor']]},
{code:`-- Publisher: is the log waiting for replication?
SELECT name, log_reuse_wait_desc FROM sys.databases WHERE name = 'SalesDB';

-- Distributor: pending commands per subscription
SELECT * FROM distribution.dbo.MSdistribution_status;`}],
src:[['Monitor replication',M.SS+'replication/monitor/monitoring-replication'],['Measure latency with tracer tokens',M.SS+'replication/monitor/measure-latency-and-validate-connections-for-transactional-replication']]};

})();
