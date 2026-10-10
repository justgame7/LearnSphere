/* LearnSphere - Grid Infrastructure, ASM & RAC, Section 01: High Availability & Cluster Concepts.
   Lectures 0-6 are core, 7-13 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const rac=O.dg(700,250,[
[10,10,330,115,'Single instance',1],[30,45,120,60,'One server|one instance',0],[190,45,130,60,'Storage|one database',0],
[360,10,330,230,'Oracle RAC (shared everything)',1],[380,45,130,60,'Node 1|instance 1',2],[540,45,130,60,'Node 2|instance 2',2],
[380,120,290,34,'Private interconnect (Cache Fusion)',0],[380,170,290,55,'Shared storage (ASM)|one database, seen by every node',0]],
[[150,75,190,75],[445,105,445,170],[605,105,605,170]]);

const maa=O.dg(700,210,[
[10,150,160,50,'Bronze|single instance|+ backups',0],[190,110,160,90,'Silver|+ RAC or Oracle Restart|+ Flashback',0],[370,70,160,130,'Gold|+ Data Guard|disaster recovery',2],[550,30,140,170,'Platinum|+ GoldenGate,|zero data loss,|rolling upgrades',2]],
[[170,175,190,160],[350,165,370,140],[530,135,550,110]]);

/* ---------- 0: What each technology solves ---------- */
L['ora-rac:0:0']={blocks:[
{p:'**High availability (HA)** means the service keeps running when something fails. Each Oracle technology protects against a different kind of failure. Choosing well starts with knowing what you must survive.'},
{h:'Key terms'},
{t:[['Term','Meaning'],
['**HA**','Keep running through a component failure, with little or no outage'],
['**Scalability**','Add capacity (CPU, memory) as the workload grows'],
['**DR (disaster recovery)**','Recover the service after a whole site is lost'],
['**RTO**','Recovery Time Objective: how long the business can be down'],
['**RPO**','Recovery Point Objective: how much data the business can lose, measured in time']]},
{h:'Failure types and the technology that answers them'},
{t:[['Failure','Example','Best answer'],
['**Server or instance failure**','A node crashes','RAC (or Oracle Restart for single instance)'],
['**Site failure**','Data centre fire, flood','Data Guard (a standby at another site)'],
['**Storage or media failure**','A disk group is lost','ASM redundancy, backups, standby'],
['**Human error**','A table is dropped','Flashback, backups'],
['**Data corruption**','A block is damaged','Backups, Active Data Guard block repair'],
['**Planned maintenance**','Patching, upgrades','RAC rolling patches, Data Guard rolling upgrade, GoldenGate']]},
{flow:['Decide RTO and RPO with the business','List the failures you must survive','Match each to a technology','Combine them into one architecture','Test it regularly']},
{note:'No single product covers everything. RAC protects against a server failing, but if the whole site is lost, RAC is lost with it. That is why RAC and Data Guard are usually combined.'}],
src:[['High Availability Overview and Best Practices',D+'haovw/'],['Oracle MAA','https://www.oracle.com/database/technologies/maximum-availability-architecture/']]};

/* ---------- 1: Shared-everything clusters ---------- */
L['ora-rac:0:1']={blocks:[
{p:'In **Oracle Real Application Clusters (RAC)**, several servers (**nodes**) each run an **instance**, and all of them open the **same database** on shared storage. If one node fails, the others keep serving users.'},
{svg:rac},
{h:'Shared everything vs shared nothing'},
{t:[['','Shared everything (Oracle RAC)','Shared nothing (sharded systems)'],
['**Data**','All nodes can read and write all data','Each node owns a slice of the data'],
['**Node failure**','Surviving nodes still access all data','Data on the failed node must be recovered or replicated'],
['**Adding a node**','Add an instance, no data redistribution','Data must be re-partitioned'],
['**Coordination**','Cache Fusion moves blocks between nodes','Application routes to the right shard']]},
{h:'What RAC gives you'},
{ul:['**Availability:** sessions on a failed node reconnect to a survivor, and the database stays open.','**Scalability:** add nodes to add CPU and memory for suitable workloads.','**Maintenance:** patch and restart one node at a time (rolling).']},
{h:'What RAC does not do'},
{ul:['It does not protect against loss of the site or the shared storage.','It does not fix a badly designed application. Hot blocks used by every node cause waits.','It does not make one slow query faster, except through parallel query across nodes.']},
{flow:['A node crashes','Clusterware detects the missing heartbeat','The node is removed from the cluster','A surviving instance recovers the failed instance redo','Users reconnect to a surviving node']},
{note:'RAC is about keeping the service up when a server fails. It is not a disaster recovery tool.'}],
src:[['RAC overview',O.RAC+'introduction-to-oracle-rac.html'],['Oracle RAC',O.CN+'']]};

/* ---------- 2: Grid Infrastructure components ---------- */
L['ora-rac:0:2']={blocks:[
{p:'**Oracle Grid Infrastructure** is the software layer underneath RAC. It is installed in its own home, usually under a separate OS user called `grid`. It brings three things: **Clusterware**, **ASM** and **ACFS**.'},
{t:[['Component','Role'],
['**Oracle Clusterware**','Joins nodes into a cluster, monitors them, and restarts or relocates resources'],
['**Oracle ASM**','Storage manager: disk groups for database files, OCR and voting files'],
['**ACFS**','A cluster file system on ASM for non-database files'],
['**SCAN and VIPs**','Single client access name and virtual addresses for connections'],
['**OCR and voting files**','The cluster configuration and the membership arbiter']]},
{h:'Two homes, two owners'},
{t:[['Home','Contains','Typical owner'],
['**Grid home**','Clusterware, ASM, listeners','`grid`'],
['**Database home**','Database software','`oracle`']]},
{p:'Grid Infrastructure also works on a single server as **Oracle Restart**. It then starts ASM, the listener and the database automatically after a reboot or failure.'},
{h:'The layers'},
{flow:['Hardware: nodes, private network, shared storage','Clusterware: membership and resource management','ASM: storage for OCR, voting files and database','Database instances and listeners run as cluster resources']},
{t:[['Without Grid Infrastructure','With Grid Infrastructure'],
['No RAC possible','RAC possible'],
['Manual start after reboot (or scripts)','Automatic start and restart'],
['File system or raw storage','ASM disk groups']]},
{note:'Install Grid Infrastructure first, then the database software. Since 19c, the grid user and the database user are normally separate (role separation).'}],
src:[['Grid Infrastructure',O.CW],['Oracle Restart',D+'ladbi/']]};

/* ---------- 3: RAC vs DG vs GG vs Sharding ---------- */
L['ora-rac:0:3']={blocks:[
{p:'Four Oracle technologies sound similar but do different jobs. Compare them by what each protects and what it costs.'},
{t:[['','RAC','Data Guard','GoldenGate','Sharding'],
['**Main purpose**','Server HA and scale','Disaster recovery, data protection','Replication and zero-downtime change','Horizontal scale and data placement'],
['**Copies of data**','One','One or more standby copies','Another database, often different','Data split across shards'],
['**Survives node loss**','Yes','Yes, via failover','Yes, if the target is used','Yes, shard-level'],
['**Survives site loss**','No','**Yes**','Yes','If shards are in several sites'],
['**Data loss on failure (RPO)**','Zero','Zero or small','Small','Depends on design'],
['**Different versions or platforms**','No','No (physical)','**Yes**','No'],
['**Writes on both sides**','Yes (one DB)','Standby is read only (Active DG)','Yes (active-active)','Yes, each shard owns its data']]},
{h:'Choose by question'},
{flow:['Must a server failure be invisible? Add RAC','Must you survive a site loss? Add Data Guard','Must you migrate or upgrade with minutes of downtime, or replicate to another type of database? Add GoldenGate','Must data live in many places for scale or law? Consider sharding']},
{h:'They combine well'},
{t:[['Combination','Result'],
['RAC + Data Guard','Server HA and DR (the common Gold design)'],
['Data Guard + GoldenGate','DR plus a zero-downtime path for upgrades'],
['RAC + Data Guard + GoldenGate','Highest availability, with active-active options']]},
{note:'A standby is not a backup, and a backup is not a standby. Data Guard replays your mistakes too, so keep backups and Flashback in the design.'}],
src:[['High Availability Overview',D+'haovw/']]};

/* ---------- 4: MAA tiers ---------- */
L['ora-rac:0:4']={blocks:[
{p:'**Maximum Availability Architecture (MAA)** is Oracle blueprint of tested HA designs. It groups them into four tiers. Each tier adds protection and cost.'},
{svg:maa},
{t:[['Tier','What you add','Typical protection'],
['**Bronze**','Single instance with backups','Recovery from failures after restore. Downtime of hours.'],
['**Silver**','RAC or Oracle Restart, Flashback, ASM','Server failure and planned maintenance with little downtime'],
['**Gold**','Active Data Guard standby, Real-Time Apply','Site failure with minutes of downtime and near-zero data loss'],
['**Platinum**','GoldenGate active-active, rolling upgrades, Application Continuity','Zero downtime for most failures and changes']]},
{h:'How to use the tiers'},
{ul:['Start from the business RTO and RPO, not from the product list.','Not every database needs Platinum. Many internal systems are Silver.','Move up one tier at a time as the cost is justified.']},
{flow:['Classify each database by business impact','Assign it a tier','Build the design from the tier','Test failover and recovery at the tier promise','Review when the business changes']},
{note:'The tier names are a planning language. The same words mean the same design to Oracle architects and support.'}],
src:[['MAA Reference Architectures','https://www.oracle.com/database/technologies/maximum-availability-architecture/'],['High Availability Overview',D+'haovw/']]};

/* ---------- 5: Licensing ---------- */
L['ora-rac:0:5']={blocks:[
{p:'Licensing decides what you may build. This lecture is a summary, not legal advice. Always confirm with Oracle or your licence manager.'},
{h:'What costs extra'},
{t:[['Item','Licence'],
['**Oracle RAC**','Enterprise Edition option, licensed for every processor where it runs'],
['**RAC One Node**','Separate option, cheaper, one active instance'],
['**Grid Infrastructure (Clusterware, ASM)**','Included with the database licence, for the cluster hosting that database'],
['**Active Data Guard**','Enterprise Edition option'],
['**Data Guard (physical standby)**','Included with Enterprise Edition'],
['**Standard Edition 2**','RAC is **not** available from 19c']]},
{h:'RAC One Node'},
{p:'**RAC One Node** runs the database on **one node at a time** inside a cluster. You can relocate it to another node online, which helps with maintenance and gives automatic restart on failure.'},
{code:`srvctl relocate database -db orcl -node node2     # move online`},
{t:[['','RAC','RAC One Node'],
['**Active instances**','All nodes at once','One (two briefly during a move)'],
['**Scaling out**','Yes','No, only move to a bigger node'],
['**Failover**','Surviving instances continue','Restart on another node'],
['**Cost**','Higher','Lower']]},
{h:'Licence traps'},
{ul:['Licence every node that can run the database instance, not just nodes currently used.','The metric is by processor with a core factor, like other options.','Virtualisation and cloud rules differ. Ask before you size.']},
{note:'Check this decision early. Learning RAC is free with the development licence, but a production RAC needs the paid option.'}],
src:[['Licensing Information User Manual',O.LIC],['RAC One Node',O.RAC]]};

/* ---------- 6: Practical ---------- */
L['ora-rac:0:6']={blocks:[
{p:'Pick an architecture for three businesses. Decide first, then compare with the sample answers.'},
{h:'The three cases'},
{t:[['Case','Requirements'],
['**A. Online shop**','One data centre. Can be down for up to 1 hour. Can lose up to 5 minutes of orders. Budget is moderate.'],
['**B. Bank core ledger**','Two sites. Must lose no committed data. Back within minutes after a site loss. Maintenance with almost no outage.'],
['**C. Internal reporting**','Used during business hours. A day of downtime is acceptable. Low budget.']]},
{h:'Questions to ask for each'},
{ul:['What are RTO and RPO?','Which failures must be survived: server, site, human error?','Can maintenance windows exist?','What is the budget?']},
{h:'Suggested answers'},
{t:[['Case','Tier','Design','Why'],
['**A**','Silver','RAC (or RAC One Node), ASM, nightly backups, Flashback','Handles server failure and rolling patches. A site loss is covered by restoring from offsite backup within 1 hour.'],
['**B**','Gold or Platinum','RAC at both sites, Data Guard with Max Availability (SYNC), fast-start failover, backups','No data loss and fast site failover. Platinum adds GoldenGate for zero-downtime upgrades.'],
['**C**','Bronze','Single instance with Oracle Restart, regular RMAN backups','Backup and restore meets the day of downtime, at the lowest cost.']]},
{flow:['Write RTO and RPO for the case','Pick the tier that meets both','List the Oracle products it needs','Estimate the cost, including licences','Write one sentence on what the design does NOT protect against']},
{h:'Challenge'},
{p:'Take a real database at your workplace. Write its RTO and RPO, name its tier today, and say whether the current design meets them.'},
{note:'There is no single correct answer. The skill is to justify the choice from the requirements.'}],
src:[['High Availability Overview',D+'haovw/']]};

})();
