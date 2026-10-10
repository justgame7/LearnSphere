/* LearnSphere - Exadata, Section 10: Migration, Best Practices & Capstone.
   Lectures 0-6 are core, 7-10 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const mig=O.dg(700,190,[
[10,20,150,70,'Source database|(any platform)',0],[210,20,150,70,'Choose a method|downtime, version,|platform',2],
[410,20,130,70,'Prepare target|on Exadata',0],[580,20,110,70,'Cut over|and verify',2],
[10,110,680,65,'Methods: RMAN restore, Data Guard, GoldenGate, ZDM, Data Pump, transportable tablespaces',1]],
[[160,55,210,55],[360,55,410,55],[540,55,580,55]]);

const trouble=O.dg(700,210,[
[10,20,130,60,'Slow query|or slow I/O',0],
[180,20,150,60,'Offloaded?|(Smart Scan stats)',2],[370,20,150,60,'Flash cache|hit rate',2],[560,20,130,60,'Cell I/O|utilisation',2],
[180,110,150,60,'No: check scan type,|storage, parameters',0],[370,110,150,60,'Low: check size,|KEEP, workload',0],[560,110,130,60,'High: IORM,|tuning, add cells',0]],
[[140,50,180,50],[330,50,370,50],[520,50,560,50],[255,80,255,110],[445,80,445,110],[625,80,625,110]]);

/* ---------- 0: Migrating ---------- */
L['ora-exa:9:0']={blocks:[
{p:'Moving databases to Exadata is a project of its own. The method depends on **how much downtime you can accept**, whether **version or platform** changes, and the **size** of the data.'},
{svg:mig},
{t:[['Method','Downtime','Works across','Notes'],
['**RMAN backup and restore / duplicate**','Hours (proportional to size)','Same endianness','Simple, well known'],
['**Data Guard (physical standby)**','Minutes (switchover)','Same platform and endianness, compatible versions','Good for large databases'],
['**GoldenGate**','Minutes or less','Different versions, platforms, endianness','Most flexible, more work'],
['**Zero Downtime Migration (ZDM)**','Minutes (online) or hours (offline)','Several modes','Automates the steps of the methods above'],
['**Data Pump**','Hours to days','Any version, any platform','Logical copy, rebuilds objects'],
['**Transportable tablespaces**','Hours','Cross-platform with conversion','Fast for large data']]},
{h:'ZDM modes'},
{t:[['Mode','How','Typical'],
['**Physical online**','Data Guard based, then switchover','Same platform, minimal downtime'],
['**Physical offline**','Backup and restore','Downtime acceptable'],
['**Logical online**','Data Pump plus GoldenGate','Different versions or platforms'],
['**Logical offline**','Data Pump only','Small databases']]},
{h:'Steps of any migration'},
{flow:['Assess the source: size, version, platform, features, downtime limit','Choose the method','Prepare the target on Exadata and test the method on a copy','Rehearse the cutover and the fallback','Cut over, verify and keep the source until you are sure']},
{note:'Always plan a fallback. For online methods, reverse replication can keep the old system current for a period after the cutover.'}],
src:[['Zero Downtime Migration','https://docs.oracle.com/en/database/oracle/zero-downtime-migration/'],['Exadata migration',O.EXA]]};

/* ---------- 1: Consolidation ---------- */
L['ora-exa:9:1']={blocks:[
{p:'Exadata shines when many databases share it. Good consolidation uses **multitenant** for databases and **IORM and instance caging** for resources.'},
{h:'Design choices'},
{t:[['Choice','Guidance'],
['**One CDB or several**','Few CDBs reduce memory and patching work. Several CDBs reduce the blast radius and allow different patch times.'],
['**Which PDBs together**','Group by criticality, patch schedule and owner. Do not mix production and test in one CDB.'],
['**CPU**','Instance caging per CDB, PDB-level limits inside it'],
['**I/O**','IORM database plan per CDB, PDB plans inside'],
['**Memory**','SGA per CDB with HugePages. Do not oversubscribe memory.']]},
{h:'A typical layout'},
{t:[['CDB','Content','Resources'],
['`PRODOLTP`','Critical OLTP PDBs','High IORM shares, guaranteed CPU'],
['`PRODDW`','Warehouse PDBs','High throughput objective, more storage'],
['`NONPROD`','Dev and test PDBs, thin clones','Low shares, caps']]},
{flow:['List the databases and their needs','Group them into CDBs','Assign CPU, I/O and memory','Set the plans and monitor','Review monthly and adjust']},
{h:'Watch'},
{ul:['**Noisy neighbours:** one workload slowing others. IORM and caging stop it.','**Capacity:** sum of all workloads at peak, not the average.','**Patching:** all PDBs in a CDB move together.']},
{note:'Consolidation saves hardware and licences, but it also concentrates risk. Keep a standby and tested backups for the shared platform.'}],
src:[['Consolidation on Exadata',O.EXA]]};

/* ---------- 2: Indexes and compression ---------- */
L['ora-exa:9:2']={blocks:[
{p:'Many databases moving to Exadata carry **too many indexes** that were built to avoid scans on slow storage. On Exadata, fast scans change what you need.'},
{h:'Index strategy'},
{t:[['Index type','Keep?'],
['Primary key, unique, foreign key for OLTP','Keep'],
['Indexes for selective OLTP lookups','Keep'],
['Indexes only added to avoid full scans in reporting queries','Test removing: Smart Scan may serve them better'],
['Rarely used or duplicate indexes','Remove']]},
{code:`-- Test first: make it invisible and watch the workload
ALTER INDEX orders_status_ix INVISIBLE;
-- If everything is fine after a full business cycle
DROP INDEX orders_status_ix;`},
{h:'Compression strategy'},
{t:[['Data','Compression'],
['Hot OLTP tables','Advanced Row Compression (licensed option) or none'],
['Warehouse tables, loaded in bulk','HCC `QUERY HIGH`'],
['Old, rarely read partitions','HCC `ARCHIVE LOW` or `HIGH`']]},
{code:`-- Move an old partition to a higher compression level
ALTER TABLE sales MOVE PARTITION p_2022 COMPRESS FOR ARCHIVE LOW ONLINE;`},
{h:'Partition and age'},
{flow:['Partition large tables by date','Keep the newest partitions lightly compressed','Compress older partitions with HCC','Drop or archive the oldest partitions']},
{note:'Always test with representative queries. Removing indexes and compressing data change plans, so compare timings before and after.'}],
src:[['Exadata best practices',O.EXA],['Hybrid Columnar Compression',O.EXA]]};

/* ---------- 3: MAA ---------- */
L['ora-exa:9:3']={blocks:[
{p:'Exadata is the base of Oracle **Maximum Availability Architecture (MAA)** Gold and Platinum designs. Two additions complete it: **Data Guard** for disaster recovery and the **Zero Data Loss Recovery Appliance (ZDLRA)** for backup.'},
{t:[['Component','Role'],
['**Exadata with RAC**','Server and storage redundancy, rolling patching'],
['**Active Data Guard**','A standby Exadata at another site, with real-time query and automatic block repair'],
['**Recovery Appliance (ZDLRA)**','Backups with real-time redo protection and incremental-forever strategy'],
['**Application Continuity**','Users do not see errors during planned and unplanned events'],
['**GoldenGate**','Zero-downtime upgrades and active-active, in Platinum designs']]},
{h:'The common design'},
{flow:['Production Exadata (RAC) at site A','Data Guard ships redo to Exadata at site B','Recovery Appliance receives real-time redo and incremental backups','Services and Application Continuity hide failovers from users','Regular DR tests prove it works']},
{h:'Points for Exadata'},
{ul:['The standby does not need to be the same size, but must handle the production workload after failover.','Use the same Exadata software versions where possible, within the supported matrix.','RoCE protects within the rack. Use enough network bandwidth between sites for redo.','Use FORCE LOGGING, Flashback and Data Guard broker as in the Data Guard sub-course.']},
{note:'Exadata hardware is highly redundant, but a site is still a single point of failure. Disaster recovery needs a second site.'}],
src:[['MAA on Exadata','https://www.oracle.com/database/technologies/maximum-availability-architecture/']]};

/* ---------- 4: Troubleshooting ---------- */
L['ora-exa:9:4']={blocks:[
{p:'Troubleshooting on Exadata adds the storage layer. A short method helps you split the problem quickly: **database**, **offload**, **flash** or **cell I/O**.'},
{svg:trouble},
{h:'Wait events you will see'},
{t:[['Event','Meaning'],
['`cell smart table scan`','A Smart Scan on a table: offload is working'],
['`cell smart index scan`','Smart Scan on an index'],
['`cell single block physical read`','A single-block read from a cell (index lookups)'],
['`cell multiblock physical read`','Multi-block reads that are not offloaded'],
['`cell list of blocks physical read`','Reads of several non-contiguous blocks']]},
{h:'Method'},
{flow:['Define the symptom: which SQL, which database, since when','Check top wait events of the database','Large scans slow? Check offload statistics for that SQL','Reads slow? Check flash cache hit rate and cell disk utilisation','Everything slow? Check IORM, network and cell alerts']},
{code:`-- Top waits right now
SELECT event, COUNT(*) FROM v$session WHERE wait_class <> 'Idle' GROUP BY event ORDER BY 2 DESC;

-- Offload statistics for the session
SELECT name, value FROM v$mystat s JOIN v$statname n USING (statistic#) WHERE name LIKE 'cell physical IO%';

-- On the cells
dcli -g ~/cell_group -l root "cellcli -e list metriccurrent where name like 'CD_IO_UTIL_.*' and metricValue > 80"`},
{t:[['Finding','Next step'],
['Not offloaded, large scan','Check scan type, direct reads, offload settings'],
['Low flash cache hit rate','Check working set size, KEEP settings'],
['Cell disks above 80 percent','Tune the SQL, IORM, or add storage'],
['Network errors','Check RoCE counters and the switch']]},
{note:'Often the problem is the SQL. An inefficient plan on Exadata is still inefficient. Fix the plan first, then look at the platform.'}],
src:[['Troubleshooting Exadata performance',O.EXA]]};

/* ---------- 5: Readiness ---------- */
L['ora-exa:9:5']={blocks:[
{p:'Before production, check each area and keep the evidence.'},
{t:[['Area','Check','How'],
['**Hardware and network**','All components healthy, redundant paths','Alerts, `cellcli`, switch status'],
['**Software versions**','Supported and consistent versions','`imageinfo`, Doc ID 888828.1'],
['**ASM and storage**','DATA, RECO sized, HIGH or NORMAL redundancy, `USABLE_FILE_MB` positive','`V$ASM_DISKGROUP`'],
['**Database**','CDB design, parameters, HugePages, ARCHIVELOG, FORCE LOGGING','Checklist from the Core DBA sub-course'],
['**Resources**','IORM plan and instance caging','`list iormplan`, `cpu_count`'],
['**Offload**','Key queries offloaded as expected','Statistics and SQL Monitor'],
['**Backup and DR**','Tested restore, standby with tested switchover','Test reports'],
['**Patching**','Plan and rehearsal done','Runbook'],
['**Monitoring**','Cell, ASM, database and network alerts reach a person','Alert test'],
['**Health check**','EXAchk with no open FAIL','Report'],
['**Documentation**','Network plan, runbooks, contacts, support details','Documents']]},
{flow:['Walk the checklist with a second engineer','Collect evidence for each item','Fix and repeat for failures','Run a failure test: disk, cell and node','Go live']},
{note:'Treat the readiness checklist as a gate. A failed item means not ready, not "we will fix it later".'}],
src:[['Exadata best practices',O.EXA]]};

/* ---------- 6: Capstone ---------- */
L['ora-exa:9:6']={blocks:[
{p:'**Capstone.** Design and review an Exadata **consolidation platform** for a company. You produce a written design, then review it against a checklist.'},
{h:'The scenario'},
{t:[['Item','Value'],
['Databases','120: 30 critical OLTP, 10 data warehouses, 80 dev and test'],
['Data volume','90 TB now, growing 25 percent per year'],
['Availability','OLTP: RTO 15 minutes, RPO close to zero. Warehouses: RTO 4 hours. Dev and test: no DR.'],
['Sources','Mixed 12c and 19c, Linux and some AIX'],
['Constraint','Move in 12 months with at most 30 minutes of downtime for OLTP']]},
{h:'Deliverables'},
{ul:['Platform choice: model, size, deployment (on-premises, Cloud@Customer, cloud).','Storage design: disk groups, redundancy, capacity forecast for three years.','Database design: CDBs and PDBs, resource plans (IORM, caging).','Backup and DR design with RTO and RPO met.','Migration plan per workload type, with methods and downtime.','Patching and monitoring plan.']},
{h:'Sample approach'},
{t:[['Area','Suggestion'],
['Platform','Two Exadata systems in two sites (production and DR), sized for production workload'],
['Storage','HIGH redundancy for DATA, RECO sized for local backups or ZDLRA, SPARSE for dev and test clones'],
['Databases','`PRODOLTP`, `PRODDW`, `NONPROD` CDBs with IORM shares and caps'],
['DR','Active Data Guard with fast-start failover for OLTP, restore-based for the warehouses'],
['Migration','ZDM or Data Guard for same-platform OLTP, GoldenGate for AIX to Linux, Data Pump for small databases'],
['Operations','Quarterly rolling patching, EXAchk, alert routing and runbooks']]},
{h:'Review checklist'},
{t:[['Question','Pass if'],
['Does storage cover growth for three years with positive USABLE_FILE_MB?','Yes, with reserve for one cell'],
['Are RTO and RPO met for each class?','Yes, tested in the design'],
['Is noisy-neighbour risk controlled?','IORM and caging in the design'],
['Is each migration method matched to downtime and platform?','Yes'],
['Is patching rolling for OLTP?','Yes, rehearsed'],
['Are monitoring and runbooks included?','Yes']]},
{h:'Self-assessment'},
{t:[['Level','Meaning'],
['**Foundation**','The design covers every area'],
['**Solid**','Each decision has a reason and a risk noted'],
['**Ready**','A colleague could build and operate the platform from your document']]},
{note:'After this sub-course, deepen with Data Guard and GoldenGate for disaster recovery and zero-downtime migration, which this capstone depends on.'}],
src:[['Exadata documentation',O.EXA],['MAA','https://www.oracle.com/database/technologies/maximum-availability-architecture/']]};

})();
