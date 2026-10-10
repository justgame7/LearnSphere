/* LearnSphere - Data Guard, Section 01: HA, DR & Data Guard Foundations.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const arch=O.dg(700,250,[
[10,20,300,210,'Primary site',1],[30,55,260,50,'Primary database (open read write)',2],[30,120,260,40,'LGWR / LNS ship redo',0],[30,175,260,40,'Online redo and archive logs',0],
[390,20,300,210,'Standby site',1],[410,55,260,50,'Standby database (receives redo)',2],[410,120,260,40,'RFS receives, MRP applies',0],[410,175,260,40,'Standby redo logs, datafiles',0],
[310,90,80,40,'redo',0]],
[[290,80,410,80],[290,140,410,140]]);

const types=O.dg(700,190,[
[10,30,200,130,'Physical standby',1],[25,65,170,40,'Same blocks as primary',0],[25,110,170,40,'Redo Apply (recovery)',0],
[250,30,200,130,'Snapshot standby',1],[265,65,170,40,'Physical, opened read write',0],[265,110,170,40,'Redo is kept, not applied',0],
[490,30,200,130,'Logical standby',1],[505,65,170,40,'Same data, different layout',0],[505,110,170,40,'SQL Apply',0]],[]);

/* ---------- 0: HA vs DR ---------- */
L['ora-dg:0:0']={blocks:[
{p:'**High availability (HA)** keeps a service running when a component fails. **Disaster recovery (DR)** gets the service back after a **site** is lost. Two numbers set the goal: **RPO** and **RTO**.'},
{h:'RPO and RTO'},
{t:[['Term','Meaning','Example'],
['**RPO**','How much data you can lose, measured as time','RPO 0 = no committed data lost. RPO 15 minutes = up to 15 minutes lost.'],
['**RTO**','How long you can be down','RTO 1 hour = service back within an hour']]},
{h:'What RTO is made of'},
{flow:['Detect the failure','Decide to fail over','Do the failover','Check the new primary','Applications reconnect']},
{p:'Fast detection and a fast decision matter as much as the technical failover. Automation, such as fast-start failover, cuts the first two steps.'},
{h:'HA vs DR in practice'},
{t:[['','HA (for example RAC)','DR (Data Guard)'],
['**Failure covered**','Server or instance','Site, storage array, data corruption'],
['**Where**','Same site','Another site'],
['**Data loss on failure**','None','None to a few seconds, depending on mode'],
['**Typical recovery**','Seconds','Seconds (automatic) to minutes']]},
{h:'Backups are not DR'},
{p:'A backup restores data, but a restore of a large database takes hours. A standby already has the data and only needs to be activated, so the **RTO** is minutes. You still need backups, since a standby copies mistakes too.'},
{note:'Always write RPO and RTO down for each system and test against them. A number that has never been tested is a promise nobody can rely on.'}],
src:[['Data Guard Concepts and Administration',O.DG],['MAA','https://www.oracle.com/database/technologies/maximum-availability-architecture/']]};

/* ---------- 1: MAA tiers ---------- */
L['ora-dg:0:1']={blocks:[
{p:'Oracle **MAA** describes tested designs in four tiers. **Data Guard** appears from the Gold tier, as the answer to site failure.'},
{t:[['Tier','Design','Typical RTO','Typical RPO'],
['**Bronze**','Single instance, backups','Hours to days','Up to the last backup'],
['**Silver**','RAC or Oracle Restart, Flashback','Minutes for server failure, hours for site loss','Up to the last backup for site loss'],
['**Gold**','Silver + **Data Guard** standby','Minutes (seconds with fast-start failover)','Zero to seconds'],
['**Platinum**','Gold + GoldenGate, rolling upgrades, Application Continuity','Seconds or none','Zero']]},
{h:'Typical Data Guard designs'},
{t:[['Design','Description'],
['**Single instance + standby**','Small systems. Simple and affordable.'],
['**RAC + RAC standby**','Server HA at both sites and DR between them'],
['**Standby + fast-start failover**','Automatic failover with an observer'],
['**Cross-region standby**','A standby far away for regional disasters, usually asynchronous'],
['**Far sync + remote standby**','Zero data loss to a nearby far sync instance, long distance to the standby']]},
{flow:['Define RTO and RPO from the business impact','Choose the tier','Add the Data Guard components it needs','Test and document failover and switchover']},
{note:'The tier names are a planning language. When someone says "we need Gold", they mean a standby at another site with a short, tested failover.'}],
src:[['MAA Reference Architectures','https://www.oracle.com/database/technologies/maximum-availability-architecture/'],['Data Guard overview',O.DG]]};

/* ---------- 2: DG vs others ---------- */
L['ora-dg:0:2']={blocks:[
{p:'Data Guard is one tool in the HA and DR toolbox. Know where it fits against backups, RAC and GoldenGate.'},
{t:[['','Backups (RMAN)','RAC','Data Guard','GoldenGate'],
['**Protects against**','Loss of data, human error','Server failure','Site loss, corruption','Planned change, heterogeneous replication'],
['**RPO**','Last backup (plus logs)','Zero','Zero to seconds','Seconds'],
['**RTO**','Hours (restore time)','Seconds','Minutes (or seconds)','Seconds to minutes'],
['**Copy of data**','Backups','One database','Physical standby copy','Different database'],
['**Different version**','No','No','No (rolling upgrade is possible)','**Yes**'],
['**Cost**','Low','RAC licence','Included (ADG option extra)','Separate product']]},
{h:'Choose by need'},
{flow:['Need to restore data after a mistake: backups and Flashback','Need to survive a server failure: RAC','Need to survive a site failure: Data Guard','Need to upgrade or migrate with minimal downtime, or replicate to another database type: GoldenGate']},
{h:'Data Guard and backups together'},
{ul:['A standby copies logical mistakes. A dropped table also disappears on the standby, unless you use a delay or Flashback.','Backups can be taken from the standby to reduce load on the primary.','Use both: the standby for fast recovery from a site loss, backups for data recovery and history.']},
{note:'Data Guard is designed for disaster recovery and data protection. If your main concern is human error, Flashback Database and a delayed standby are more useful than a plain standby.'}],
src:[['Data Guard Concepts',O.DG]]};

/* ---------- 3: Standby types ---------- */
L['ora-dg:0:3']={blocks:[
{p:'A standby is a copy of the primary database. There are three kinds, with different ways of applying the changes.'},
{svg:types},
{t:[['Type','How it works','Use'],
['**Physical standby**','Identical, block for block. Apply redo with media recovery.','The standard choice for DR. Can be opened read only with Active Data Guard.'],
['**Snapshot standby**','A physical standby converted to read write. Redo is received but not applied until converted back.','Testing with real data, then discard the changes'],
['**Logical standby**','Redo is turned into SQL and applied. Structure can differ.','Special cases: rolling upgrades with DBMS_ROLLING, reporting with extra objects']]},
{h:'Physical standby: the default'},
{ul:['Exactly the same data and structure as the primary.','Supports every data type.','Simple to build, simple to operate.','Can be a source for backups.']},
{h:'Logical standby limits'},
{ul:['Not every data type or feature is supported.','Primary keys or unique indexes matter.','It is more complex and rarely used for plain DR.']},
{flow:['For DR, start with a physical standby','Need a test copy: convert to snapshot standby, then convert back','Need rolling upgrade: use the DBMS_ROLLING process, which uses a transient logical standby']},
{note:'When people say "a Data Guard standby" without a type, they almost always mean a physical standby.'}],
src:[['Types of standby databases',O.DG]]};

/* ---------- 4: Architecture ---------- */
L['ora-dg:0:4']={blocks:[
{p:'Data Guard has a simple structure: a **primary**, one or more **standby databases**, **redo transport** from the first to the others and **apply services** on the standby.'},
{svg:arch},
{h:'The pieces'},
{t:[['Piece','Role'],
['**Primary database**','The production database. Generates redo.'],
['**Standby database**','A synchronised copy. Receives and applies redo.'],
['**Redo transport services**','Send redo from primary to standby (LNS, ARCn)'],
['**Redo apply (MRP)**','Applies redo to the physical standby'],
['**Role transitions**','Switchover (planned) and failover (unplanned)'],
['**Broker (DMON, DGMGRL)**','Configures and manages everything from one place'],
['**Observer**','A small process that decides automatic failover (fast-start failover)']]},
{h:'The flow'},
{flow:['A transaction commits on the primary and writes redo','Redo transport sends the redo to the standby','The standby writes it to standby redo logs','Redo apply replays it on the standby datafiles','The standby is ready to take over']},
{h:'Up to 30 standbys'},
{p:'A primary can feed several standbys, and standbys can feed other standbys (cascading), which saves bandwidth from the primary.'},
{note:'The next section follows this flow in detail. Keep this picture in mind: primary, redo, standby.'}],
src:[['Data Guard architecture',O.DG]]};

/* ---------- 5: Licensing ---------- */
L['ora-dg:0:5']={blocks:[
{p:'Basic Data Guard is **included** with Enterprise Edition. **Active Data Guard (ADG)** is an extra-cost option. This is a summary, not legal advice. Check the Licensing Information User Manual.'},
{t:[['Feature','Included in EE?','Notes'],
['**Physical standby, redo transport and apply**','Yes','The core of Data Guard'],
['**Snapshot standby**','Yes','Test copy that can be converted back'],
['**Logical standby**','Yes','Special use'],
['**Data Guard broker, switchover, failover, fast-start failover**','Yes','Management and automation'],
['**Real-time query** (standby open read only while applying)','**ADG option**','Offload reporting'],
['**Automatic block repair**','**ADG option**','Repair corrupt blocks from the other side'],
['**DML redirection**','**ADG option**','Writes on the standby are redirected to the primary'],
['**Far sync**','**ADG option**','Zero data loss over long distance'],
['**Real-time cascade, rolling apply features**','**ADG option** for some','Check the manual']]},
{h:'Standard Edition 2'},
{p:'SE2 does not include Data Guard. You can keep a standby manually with scripts, or use third-party tools, but it is not the same product.'},
{h:'Practical advice'},
{ul:['Opening a standby read only **without** ADG means redo apply stops. If you only need a DR copy, you do not need ADG.','Check usage: `DBA_FEATURE_USAGE_STATISTICS` shows if ADG features have been used.','Licence both primary and standby systems for the options in use.']},
{note:'A standby counts for licences like any other server running Oracle Database. Include it in the licence plan.'}],
src:[['Licensing Information User Manual',O.LIC],['Data Guard',O.DG]]};

/* ---------- 6: Practical ---------- */
L['ora-dg:0:6']={blocks:[
{p:'Choose a DR design for three businesses. Decide first, then compare with the sample answers.'},
{h:'The cases'},
{t:[['Case','Requirements'],
['**A. Online shop**','One data centre now. Can be down for 1 hour in a site disaster. Can lose a few minutes of orders. Moderate budget.'],
['**B. Payment platform**','Two sites 50 km apart. No data loss. Back within 2 minutes. Cannot use manual decisions at night.'],
['**C. Reporting system**','Single site. Daily reports hit the production database and slow it. DR within a day is acceptable.']]},
{h:'Questions to ask'},
{ul:['What are RPO and RTO?','Where is the second site, and how fast is the link?','Can failover be automatic?','Is a read-only copy for reports useful (ADG)?']},
{h:'Sample answers'},
{t:[['Case','Design','Why'],
['**A**','Physical standby in another site or region, **Maximum Performance** (async), manual failover with a runbook, backups','Few minutes of loss is acceptable. Async protects primary speed over distance.'],
['**B**','Physical standby at the second site, **Maximum Availability** (sync), **fast-start failover** with an observer at a third location, application continuity','Zero loss with synchronous transport at 50 km. Automatic failover meets 2 minutes.'],
['**C**','Standby with **Active Data Guard** open read only for reports. Keep a standby for DR in another place if needed.','Offloads reports and gives a DR copy. A day of RTO allows a simple design.']]},
{flow:['Write RPO and RTO','Choose protection mode and transport','Choose manual or automatic failover','Decide whether the standby also serves reports','List what the design does not cover']},
{h:'Challenge'},
{p:'Pick a real database at work. Write its RPO and RTO and decide whether Data Guard, and in which mode, would meet them.'},
{note:'A good answer states the reasons. The same requirement can have more than one correct design.'}],
src:[['Data Guard Concepts and Administration',O.DG]]};

})();
