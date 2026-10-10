/* LearnSphere - Exadata, Section 01: Exadata Foundations.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const cmp=O.dg(700,230,[
[10,10,330,210,'Traditional: servers and a SAN',1],[30,45,140,50,'Database server|filters rows',0],[200,45,120,50,'Storage|sends all blocks',0],[30,115,290,50,'Network carries every block of the table|(terabytes for a big scan)',2],[30,180,290,30,'The database CPU does the filtering',0],
[360,10,330,210,'Exadata: smart storage',1],[380,45,140,50,'Database server|receives results',0],[550,45,120,50,'Storage cells|filter rows',2],[380,115,290,50,'Network carries only matching rows|and needed columns',2],[380,180,290,30,'The storage CPUs do the filtering (offload)',0]],[]);

const layers=O.dg(700,260,[
[10,10,680,70,'Database servers: run Oracle Database, Grid Infrastructure (RAC)',1],[30,38,200,34,'Compute node 1',0],[250,38,200,34,'Compute node 2',0],[470,38,200,34,'... more nodes',0],
[10,100,680,60,'RoCE fabric: fast network between compute and storage (two leaf switches)',2],
[10,180,680,70,'Storage servers (cells): disks, flash and Exadata System Software',1],[30,208,200,34,'Cell 1',0],[250,208,200,34,'Cell 2',0],[470,208,200,34,'Cell 3 ...',0]],
[[350,80,350,100],[350,160,350,180]]);

/* ---------- 0: What Exadata is ---------- */
L['ora-exa:0:0']={blocks:[
{p:'**Oracle Exadata** is a platform made for Oracle Database. It combines **database servers**, **intelligent storage servers**, a **fast network** and **special software** into one engineered system. Everything is designed, tested and supported together.'},
{svg:cmp},
{h:'The problems it solves'},
{t:[['Problem','How Exadata answers it'],
['**Large scans move too much data**','Storage servers filter rows and columns, so only results cross the network (Smart Scan)'],
['**Unpredictable latency**','Flash caching and a dedicated RDMA network keep reads and commits fast'],
['**Many databases, many servers**','Consolidate on one platform, share it with resource limits'],
['**Complex integration**','One supported stack, patched with tested bundles'],
['**Availability**','Redundant components, automatic disk and flash handling, RAC and ASM built in']]},
{h:'What is not different'},
{ul:['It is still Oracle Database. SQL, PL/SQL and your applications run unchanged.','Grid Infrastructure, ASM and RAC work as in section 1 to 10 of the RAC sub-course.','The DBA tasks are the same, with extra tools for the storage layer.']},
{flow:['A query needs a lot of data','The database server asks the cells for it','Cells filter rows and columns in storage','Only the needed data crosses the network','The database server completes the query']},
{note:'Exadata does not change what you write. It changes where the work is done, and how fast data reaches the CPU.'}],
src:[['Exadata documentation',O.EXA],['Exadata overview','https://www.oracle.com/engineered-systems/exadata/']]};

/* ---------- 1: Deployment models ---------- */
L['ora-exa:0:1']={blocks:[
{p:'The same Exadata technology is available in several ways. The difference is **who owns the hardware** and **who operates it**.'},
{t:[['Model','Where it runs','Who runs the hardware','Typical reason'],
['**Exadata Database Machine**','Your data centre','You (with Oracle support)','Full control, existing data centre'],
['**Exadata Cloud@Customer**','Your data centre','Oracle manages the infrastructure','Data must stay on site, but you want cloud operations'],
['**Exadata Database Service on Dedicated Infrastructure**','Oracle Cloud (OCI)','Oracle','Cloud elasticity with dedicated hardware'],
['**Exadata Database Service on Exascale Infrastructure**','Oracle Cloud (OCI)','Oracle','Smaller entry size, pay for what you use'],
['**Oracle Database@Azure, @AWS, @Google Cloud**','Oracle Exadata inside another cloud data centre','Oracle','Run Oracle next to applications in that cloud']]},
{h:'What you manage in each'},
{t:[['Task','On-premises','Cloud@Customer and cloud'],
['Hardware, firmware, storage software','You','Oracle'],
['Database servers OS (VM level)','You','You (the VM), with Oracle tools'],
['Grid, database, patches','You','You, using the cloud console and APIs'],
['Backups and Data Guard','You','Service features, you configure them']]},
{flow:['Start from the data location and compliance needs','Decide who should operate the infrastructure','Choose the model','Learn the console and APIs for cloud, or the CLI tools for on-premises']},
{note:'The DBA skills in this course apply to every model. In the cloud, some storage administration is done for you, but you still need to understand it to troubleshoot.'}],
src:[['Exadata Cloud Infrastructure','https://docs.oracle.com/en-us/iaas/exadatacloud/index.html'],['Exadata documentation',O.EXA]]};

/* ---------- 2: Generations ---------- */
L['ora-exa:0:2']={blocks:[
{p:'Exadata comes in **generations**. The name tells you roughly what you have. Specifications change each generation, so always check the current data sheet for exact numbers.'},
{h:'How to read the name'},
{t:[['Part','Meaning'],
['**X** and a number (X9, X10, X11)','The hardware generation'],
['**M** (X9**M**, X10**M**, X11**M**)','Uses the RDMA over Converged Ethernet (**RoCE**) network fabric'],
['**Rack size**','Eighth, quarter, half, full or elastic combinations of servers']]},
{h:'The recent generations at a glance'},
{t:[['Generation','Main features'],
['**X9M**','RoCE fabric, Intel processors, persistent memory (PMEM) in storage servers'],
['**X10M**','AMD EPYC processors, more cores and memory, RDMA access to flash and a memory cache that replaces PMEM'],
['**X11M**','Newer AMD EPYC processors, more compute and flash, faster interconnect']]},
{note:'The table is a summary. The memory cache layer is called XRMEM in newer generations and PMEM in older ones. Check the data sheet for the exact hardware of your model.'},
{h:'Storage server types'},
{t:[['Type','Content','Best for'],
['**High Capacity (HC)**','Hard disks plus flash cache','Large data volumes, warehouses and mixed workloads'],
['**Extreme Flash (EF)**','All-flash','Very high I/O and low latency'],
['**Extreme (XT)**','Lower-cost high-capacity storage','Backups, archive, dev and test, cold data']]},
{flow:['Look at the model name (for example X10M-2)','Read the data sheet for CPU, memory, flash and disk','Compare storage types against your workload','Plan expansion with the same generation where possible']},
{note:'You can mix generations in one rack in some cases, but check Oracle Support Doc ID 888828.1 (Exadata Database Machine and Exadata Storage Server Supported Versions) for software compatibility.'}],
src:[['Exadata data sheets','https://www.oracle.com/engineered-systems/exadata/'],['Exadata System Software',O.EXA]]};

/* ---------- 3: Three layers ---------- */
L['ora-exa:0:3']={blocks:[
{p:'Every Exadata has three layers. Know what lives in each, because every tool and every problem belongs to one of them.'},
{svg:layers},
{h:'The layers'},
{t:[['Layer','What it contains','You use'],
['**Database servers**','Linux, Grid Infrastructure, ASM, database instances (RAC)','`srvctl`, `crsctl`, SQL*Plus, `dbmcli`'],
['**Network fabric**','RoCE leaf switches, management network, power and cooling','Switch CLI, `patchmgr`'],
['**Storage servers (cells)**','Disks, flash, Exadata System Software (CELLSRV, MS, RS)','`cellcli`, `exacli`, `dcli`']]},
{h:'How they connect'},
{ul:['Each database server connects to the fabric over redundant ports.','Each storage cell connects to the fabric over redundant ports.','A separate management network (ILOM, admin network) is used for administration and monitoring.']},
{h:'Where the ASM disks come from'},
{p:'ASM on Exadata does not use local disks on the database servers. The disks are **grid disks** served by the cells over the network. The path looks like `o/<cell IP>/<griddisk>`.'},
{flow:['Database instance opens a file in +DATA','ASM maps it to grid disks on cells','The database reads from cells over RoCE','Smart features run inside the cells when a scan is offloaded']},
{note:'Treat the cells as part of your database system. You manage their configuration, health and patches as part of the Exadata lifecycle.'}],
src:[['Exadata architecture',O.EXA]]};

/* ---------- 4: Value ---------- */
L['ora-exa:0:4']={blocks:[
{p:'Exadata value comes from a few ideas. Learn them as a short list, and later sections show each in detail.'},
{t:[['Feature','What it does','Benefit'],
['**Smart Scan (offload)**','Cells filter rows and columns','Less data over the network and less CPU on database servers'],
['**Storage Indexes**','Cells remember min and max values per region','Skip reading regions that cannot match'],
['**Smart Flash Cache**','Caches hot data on flash automatically','Memory-like latency for frequent reads'],
['**Smart Flash Log**','Fast commit path for redo writes','Lower commit latency'],
['**Hybrid Columnar Compression**','Column-oriented compression on storage','Smaller tables, faster scans'],
['**IORM / consolidation**','I/O resource limits per database','Share the platform with fair performance'],
['**Built-in availability**','Redundant components, automatic failure handling','High availability without extra design']]},
{h:'When Exadata fits'},
{t:[['Fits well','May not be needed'],
['Large databases and data warehouses','Small, lightly loaded databases'],
['Mixed OLTP and analytics on one platform','Applications that never read much data'],
['Consolidation of many databases','A few small databases with no growth']]},
{flow:['Measure the current bottleneck: I/O, CPU or latency','Match it to the Exadata feature that addresses it','Estimate the benefit with a test or workload analysis','Decide on size and model']},
{note:'Some benefits need the right data structure, for example full scans on large tables for Smart Scan. A query that reads a few rows by index sees less difference.'}],
src:[['Exadata features',O.EXA]]};

/* ---------- 5: Licensing ---------- */
L['ora-exa:0:5']={blocks:[
{p:'Licensing on Exadata has two parts: the **Exadata System Software** and the **Oracle Database software**. This is a summary, not legal advice. Confirm with Oracle.'},
{t:[['Part','Licence'],
['**Exadata hardware**','Purchased (on-premises) or rented (cloud)'],
['**Exadata System Software**','Licensed for the storage drives (per disk or flash drive) in on-premises systems. Included in the service price in the cloud.'],
['**Oracle Database**','Separate licences for processors in use, or included in a cloud license-included service'],
['**Database options**','Partitioning, RAC, Advanced Compression and others are separate options, unless the cloud service includes them'],
['**Management packs**','Diagnostics and Tuning Pack are separate. Some are included in cloud services.']]},
{h:'Features to know and their source'},
{t:[['Feature','Part of'],
['Smart Scan, Storage Indexes, Smart Flash Cache, IORM','Exadata System Software'],
['Hybrid Columnar Compression','Available on Exadata storage, covered by Exadata licensing'],
['RAC, Partitioning, Multitenant (more than 3 PDBs), Advanced Compression','Database options']]},
{h:'Practical advice'},
{ul:['Ask which options are included in your cloud service before you size licences.','Keep a record of options in use: `DBA_FEATURE_USAGE_STATISTICS`.','Plan core counts: you pay for processors enabled, so Exadata allows capacity on demand in some models.']},
{note:'Many Exadata projects fail audits not because of Exadata itself, but because database options were used that were never licensed. Review options early.'}],
src:[['Licensing Information User Manual',O.LIC],['Exadata licensing','https://www.oracle.com/engineered-systems/exadata/']]};

/* ---------- 6: Practical ---------- */
L['ora-exa:0:6']={blocks:[
{p:'Choose an Exadata model and deployment for three workloads. Decide first, then compare with the sample answers.'},
{h:'The workloads'},
{t:[['Workload','Description'],
['**A. Online banking**','Thousands of short transactions per second, strict latency, 5 TB, growing'],
['**B. Data warehouse**','80 TB of history, nightly loads, large analytic queries'],
['**C. Consolidation**','60 small and medium databases from old servers, total 20 TB, several applications']]},
{h:'Questions to ask'},
{ul:['Is it OLTP, analytic or mixed?','How much data and how fast does it grow?','Where must the data live (compliance)?','Who will operate the infrastructure?']},
{h:'Sample answers'},
{t:[['Workload','Suggested design','Why'],
['**A**','Extreme Flash storage, RAC, Exadata (on premises or Dedicated Infrastructure in the cloud)','Low latency for many short I/Os and fast commit. All-flash gives the best response times.'],
['**B**','High Capacity storage, Hybrid Columnar Compression, Smart Scan, plus XT storage for cold data','Large scans benefit from offload. Compression reduces 80 TB and speeds scans.'],
['**C**','Quarter or half rack, multitenant (PDBs), IORM, Exascale or dedicated service','Many databases share the platform. Resource Manager keeps neighbours from interfering.']]},
{flow:['Describe workload type and size','Pick storage type: HC, EF or XT','Pick deployment model from compliance and operations needs','Name the features that give the benefit','Note what will not improve']},
{h:'Challenge'},
{p:'Take a real database. Check its top wait events and its largest tables, and say which Exadata feature would help most and which would not matter.'},
{note:'There is no single correct answer. The skill is to justify the choice from the workload and requirements.'}],
src:[['Exadata documentation',O.EXA]]};

})();
