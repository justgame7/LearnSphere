/* LearnSphere - SQL Server High Availability & DR, Section 01: HA/DR Concepts.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const terms=M.dg(700,190,[
[10,20,215,80,'High availability|keep the service running|through a local failure|minutes or seconds',2],[245,20,215,80,'Disaster recovery|restore service after loss|of a site or region|longer, planned',0],[480,20,210,80,'Backup|a copy to go back in time|corruption, user error|always needed',2],
[10,115,680,60,'They overlap but are not substitutes. HA and DR copy mistakes too, so only backups undo a mistake.',0]],
[]);

const nines=M.dg(700,170,[
[10,20,150,70,'99%|3.65 days|per year',0],[180,20,150,70,'99.9%|8.8 hours',0],[350,20,150,70,'99.99%|52 minutes',2],[520,20,170,70,'99.999%|5 minutes',0],
[10,110,680,50,'Each extra nine costs more. Counting planned maintenance or not changes the number, so agree the definition first.',0]],
[]);

const choose=M.dg(700,200,[
[10,15,680,170,'What do you need to protect?',1],
[30,50,200,50,'Whole instance, jobs, logins|failover cluster instance',2],[250,50,200,50,'Selected databases,|readable copy|availability group',2],[470,50,200,50,'Cheap DR copy, delay ok|log shipping',0],
[30,120,200,50,'Spread data to other systems|replication',0],[250,120,200,50,'Restore from file|backup and restore',0],[470,120,200,50,'Cloud copy|Managed Instance link',0]],
[]);

/* ---------- 0: RPO, RTO and availability targets ---------- */
L['mss-ha:0:0']={blocks:[
{p:'Every HA and DR design starts from the **business requirement**, expressed as a few numbers. Without them you cannot choose a feature, size it or test it.'},
{h:'Key terms'},
{t:[['Term','Meaning','Question it answers'],
['**RPO** (recovery point objective)','The maximum acceptable data loss, measured in time','How much data can we lose?'],
['**RTO** (recovery time objective)','The maximum acceptable time to restore service','How long can we be down?'],
['**Availability**','Percentage of time the service is usable','How often must it be up?'],
['**SLA**','The agreement with the business or customer, with penalties','What did we promise?']]},
{h:'What "nines" mean'},
{svg:nines},
{h:'Planned and unplanned'},
{ul:['**Unplanned**: hardware failure, crash, power or network loss, software bug.','**Planned**: patching, upgrades, migrations. They are often the larger share of downtime, so HA features that allow rolling maintenance matter.']},
{note:'RPO of zero needs synchronous copies in more than one place. RTO of seconds needs automatic failover and clients that reconnect. Both have a cost, so ask what a minute of downtime really costs the business.'}],
src:[['Business continuity and database recovery',M.RD+'backup-restore/disaster-recovery-sql-server'],['High availability solutions',M.SS+'failover-clusters/high-availability-solutions-overview']]};

/* ---------- 1: HA vs DR vs backup ---------- */
L['mss-ha:0:1']={blocks:[
{p:'These three terms are often mixed up. They protect against **different failures**, and a sound design uses all three.'},
{svg:terms},
{t:[['','High availability','Disaster recovery','Backup'],
['**Protects against**','Server, instance or disk failure','Loss of a site or region','Corruption, user error, ransomware'],
['**Typical distance**','Same site, low latency','Another site or region','Anywhere, off-site copy'],
['**Recovery time**','Seconds to minutes','Minutes to hours','Hours, depends on size'],
['**Data loss**','None or very small','Small, async lag','Back to last backup or log'],
['**Undo a mistake?**','No: it copies the mistake','No','Yes, point in time']]},
{h:'Common mistakes'},
{ul:['"We have an availability group, so we do not need backups." A dropped table is dropped on every replica.','"Our DR site is the same building." A site failure takes both.','"We have backups, so we have DR." Restoring a large database may take days, longer than the business accepts.']},
{note:'A complete strategy: HA for local failures, DR for site loss, backups for everything else, each tested.'}],
src:[['Business continuity',M.RD+'backup-restore/disaster-recovery-sql-server'],['High availability and DR overview',M.SS+'failover-clusters/high-availability-solutions-overview']]};

/* ---------- 2: Choosing the right feature ---------- */
L['mss-ha:0:2']={blocks:[
{p:'SQL Server has several HA and DR features. Each protects at a **different level** and has different trade-offs. Choose by requirement, not by habit.'},
{svg:choose},
{t:[['Feature','Level','Failover','Readable copy','Copies of data','Typical use'],
['**Failover cluster instance (FCI)**','Instance','Automatic','No','One (shared storage)','Local HA, protects jobs and logins'],
['**Availability group (AG)**','Database','Automatic or manual','Yes (Enterprise)','Several, separate storage','HA, DR and read scale'],
['**Basic AG (Standard)**','One database','Automatic or manual','No','Two','Simple HA on Standard edition'],
['**Log shipping**','Database','Manual','Optional (standby)','Several, delayed','Cheap DR, delayed copy'],
['**Replication**','Objects','No','Yes','Subscribers hold subsets','Distribute data, not true HA'],
['**Backup and restore**','Database','Restore','No','Files','Every system, always']]},
{h:'A quick guide'},
{flow:['Need to protect the whole instance with jobs and logins? Consider an FCI','Need databases to fail over with readable copies? Use an availability group','Need low cost DR with delay allowed? Log shipping','Need to feed other systems? Replication','Always: backups and restore tests']},
{note:'Features can be combined: an FCI as the primary of an AG, an AG for HA plus log shipping to a far site, and so on. Keep the design as simple as the requirement allows.'}],
src:[['Compare HA and DR options',M.SS+'failover-clusters/high-availability-solutions-overview'],['Availability groups overview',M.SS+'availability-groups/windows/overview-of-always-on-availability-groups-sql-server']]};

/* ---------- 3: Licensing and editions ---------- */
L['mss-ha:0:3']={blocks:[
{p:'HA features depend on **edition**, and licensing rules for **passive** copies can change cost a lot. Check both before you design.'},
{t:[['Feature','Standard edition','Enterprise edition'],
['**Failover cluster instance**','Yes, 2 nodes','Yes, up to the operating system limit'],
['**Availability group**','Basic AG: 2 replicas, 1 database per group','Full AG: many replicas and databases, readable secondaries, distributed AG'],
['**Log shipping**','Yes','Yes'],
['**Replication**','Yes (some limits)','Yes'],
['**Backup, restore, compression**','Yes','Yes']]},
{h:'Licensing the passive copy'},
{ul:['With **Software Assurance**, a passive replica used only for HA or DR can have **failover rights** and may not need a full license.','**Readable secondaries** or any active work on the copy normally need licenses.','Rules differ by licensing model (per core, server and CAL) and by version.']},
{note:'Licensing rules change and have conditions. Confirm with the current Microsoft product terms or your licensing partner before you build or buy.'}],
src:[['Editions and supported features of SQL Server 2022',M.SS+'editions-and-components-of-sql-server-2022'],['SQL Server licensing','https://www.microsoft.com/en-us/sql-server/sql-server-2022-pricing']]};

})();
