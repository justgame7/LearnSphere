/* LearnSphere - Exadata Quick Reference (cheat sheet).
   window.QREF['ora-exa'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Exadata System Software versions and hardware generations change often. Commands and attribute names shown are the common ones:
   confirm in the Exadata documentation and with `help` in CellCLI for your software release. 26ai and Exascale items are marked. */
window.QREF=window.QREF||{};
window.QREF['ora-exa']={title:'Exadata Quick Reference',blurb:'Cell software, disk hierarchy, offload statistics, tools, patching and fixes on one page each.',hint:'cellcli or smart scan',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas behind Oracle Exadata that you should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one query or command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Foundations'},
{acc:[
{t:'What Exadata is',s:'A database platform, not only a faster server.',
 a:'**Exadata** is an engineered platform that combines database servers, intelligent storage servers and a fast network, with software that makes the database and the storage work together. The storage layer understands database requests and can filter data before it reaches the servers.',
 w:'The gain comes from moving work to storage, so look for it in scans, I/O latency and consolidation, not in raw CPU.',
 c:`SELECT name, value FROM v$parameter WHERE name IN ('cell_offload_processing','cell_offload_plan_display');`,see:[0,0,'What Exadata is and which problems it solves']},
{t:'Deployment models',s:'Where it runs.',
 a:'Exadata runs **on-premises** in your data centre, as **Cloud@Customer** (cloud service in your data centre), in the **Oracle cloud** (OCI), and in **Azure, AWS and Google Cloud** data centres through multicloud partnerships. The database software and the administration model are the same across them, with a different ownership of the hardware.',
 w:'It lets you place the workload by data residency and latency, not by a different product.',
 c:`SELECT instance_name, host_name FROM v$instance;`,see:[0,1,'Deployment models: on-premises, Cloud@Customer, cloud and multicloud']},
{t:'Generations and naming',s:'X9M, X10M, X11M.',
 a:'The hardware is named by generation, such as **X9M**, **X10M** and **X11M**. Each generation raises CPU, memory, flash and network speed and sets which storage server types and software features are available. The **Exadata System Software** release is separate from the hardware generation.',
 w:'Check both the hardware generation and the software release when you read a feature description.',
 c:`$ imageinfo
$ cellcli -e list cell attributes name,releaseVersion,makeModel`,see:[0,2,'Generations and naming: X9M, X10M and X11M']},
{t:'The three layers',s:'Database servers, storage servers, fabric.',
 a:'**Database servers** run the Oracle instances (and RAC). **Storage servers** (cells) hold the disks and flash and run the storage software. The **RoCE fabric** connects them over a private, high-speed network. A fourth, management, network and the client network complete the picture.',
 w:'When you troubleshoot, first decide which layer is involved: compute, storage or network.',
 c:`SELECT inst_id, instance_name, host_name FROM gv$instance;`,see:[0,3,'The three layers: database servers, storage servers and fabric']},
{t:'Offload, flash and consolidation',s:'Why it is faster and cheaper to run.',
 a:'The value comes from three things. **Offload** (Smart Scan) moves filtering to storage. **Flash** serves hot data and commits at low latency. **Consolidation** puts many databases on one platform with resource management. Each one has a different workload where it matters.',
 w:'Know which of the three your workload uses, and measure it. A workload that uses none of them gets little benefit.',
 c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'cell physical IO%' ORDER BY name;`,see:[0,4,'Exadata value: offload, flash and consolidation']},
{t:'Licensing and software features',s:'What is included.',
 a:'Exadata System Software features (Smart Scan, storage indexes, flash cache, IORM) come with the platform. Database options such as partitioning, compression (HCC is included on Exadata), RAC and the In-Memory option are licensed separately. Cloud models change what you license.',
 w:'Check the licensing for a feature before you rely on it, especially for options carried over from other platforms.',
 c:`SELECT parameter, value FROM v$option WHERE parameter IN ('Real Application Clusters','Partitioning','In-Memory Column Store');`,see:[0,5,'Licensing and software features at a glance']}
]},

{h:'Hardware and storage layout'},
{acc:[
{t:'Database servers',s:'Compute with local storage for the OS.',
 a:'Database servers are x86 servers with CPU, memory and a small local disk for the OS and the Oracle homes. They run Grid Infrastructure and the database. In the cloud they usually host VM clusters, so a VM gets a share of the cores.',
 w:'Memory and CPU sizing is per VM or per node, and elastic configurations allow adding more servers.',
 c:`SELECT stat_name, value FROM v$osstat WHERE stat_name IN ('NUM_CPUS','PHYSICAL_MEMORY_BYTES');`,see:[1,0,'Database servers: compute, memory and local storage']},
{t:'Storage server types',s:'High Capacity, Extreme Flash, XT.',
 a:'**High Capacity** servers combine hard disks with flash cache, for capacity at a good price. **Extreme Flash** servers hold only flash, for the lowest latency and highest throughput. **XT** servers are lower-cost, high capacity, for older or archive data.',
 w:'The type decides the capacity, cost and which tier your data lives in.',
 c:`$ cellcli -e list physicaldisk attributes name,diskType,physicalSize`,see:[1,1,'Storage servers: High Capacity, Extreme Flash and XT']},
{t:'RoCE fabric',s:'A private, fast, lossless network.',
 a:'Database servers and storage servers are connected by **RDMA over Converged Ethernet** (RoCE) switches. RDMA moves data between memory on both sides with little CPU involvement and very low latency. The fabric carries storage I/O and the RAC interconnect.',
 w:'A fabric fault slows everything, from storage reads to Cache Fusion.',
 c:`$ ibstatus 2>/dev/null || rdma link show`,see:[1,2,'RoCE fabric and switches']},
{t:'Cell services',s:'CELLSRV, MS and RS.',
 a:'On each storage server, **CELLSRV** serves I/O and does Smart Scan, **MS** (Management Server) handles configuration and alerts, and **RS** (Restart Server) monitors and restarts the other services. The database talks to CELLSRV over the fabric.',
 w:'If a cell misbehaves, these three services are the first things to check.',
 c:`$ cellcli -e list cell detail | grep -i status
$ service celld status`,see:[2,0,'Exadata storage software: CELLSRV, MS and RS']},
{t:'Physical, cell and grid disks',s:'Three layers of disk.',
 a:'A **physical disk** is the device. A **cell disk** is the physical disk as seen by the cell software. A **grid disk** is a slice of a cell disk that is given to ASM. Disk groups are built from grid disks, which is how DATA and RECO share the same physical disks.',
 w:'Understanding the layers is the key to reading any Exadata storage listing.',
 c:`$ cellcli -e list celldisk
$ cellcli -e list griddisk attributes name,size,status`,see:[2,1,'Physical disks, cell disks and grid disks']},
{t:'Flash cache and flash log',s:'Flash in front of disk.',
 a:'**Smart Flash Cache** caches hot reads and, in **write-back** mode, writes too, and is aware of the type of I/O (it avoids caching large scans). **Smart Flash Log** helps commits by writing the redo to flash and disk in parallel and using whichever finishes first.',
 w:'It is how a High Capacity system gets flash latency for the hot working set.',
 c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'cell flash cache%' OR name LIKE 'cell writes to flash cache%';`,see:[2,2,'Flash: Smart Flash Cache, Flash Log and flash grid disks']},
{t:'ASM on Exadata',s:'Disk groups made of grid disks.',
 a:'ASM runs as usual, but its disks are grid disks served by cells. Redundancy is normally **normal** or **high**, and each cell is a **failure group**, so a whole cell can fail with no data loss. DATA and RECO disk groups are typical.',
 w:'The same ASM concepts apply, with the failure group being a storage server.',
 c:`SELECT name, type, total_mb, free_mb FROM v$asm_diskgroup;`,see:[2,3,'ASM on Exadata: disk groups on grid disks']}
]},

{h:'Smart features'},
{acc:[
{t:'Smart Scan',s:'Filter in the storage, not in the database.',
 a:'With **Smart Scan** a full scan is sent to the cells, which apply the predicates and select the columns, and return only the matching data. The database server receives a fraction of the blocks. It applies to full table scans and fast full index scans that use direct path reads.',
 w:'It makes large scans fast and spares the database servers. A query that is not offloaded gets none of this.',
 c:`SELECT name, value FROM v$sysstat WHERE name IN ('cell physical IO bytes eligible for predicate offload','cell physical IO interconnect bytes returned by smart scan');`,see:[3,0,'Smart Scan: predicate and column projection offload']},
{t:'Storage indexes',s:'Skip regions that cannot match.',
 a:'Cells keep, in memory, the minimum and maximum values of columns for each region of disk (about 1 MB). A scan with a predicate on such a column skips regions that cannot contain a match. They are built automatically and need no maintenance.',
 w:'They help when data is naturally clustered on the filter column, such as dates in load order.',
 c:`SELECT name, value FROM v$sysstat WHERE name = 'cell physical IO bytes saved by storage index';`,see:[3,1,'Storage indexes']},
{t:'Hybrid Columnar Compression',s:'Compress columns together.',
 a:'**HCC** stores data in compression units, with columns grouped, and gives high compression for warehouse and archive data. Query-level modes (QUERY LOW/HIGH) suit reporting, and archive-level modes (ARCHIVE LOW/HIGH) suit rarely read data. It is available on Exadata storage.',
 w:'It can reduce storage several times, with a cost on updates and loads.',
 c:`SELECT table_name, compression, compress_for FROM dba_tables WHERE compression = 'ENABLED';`,see:[3,4,'Hybrid Columnar Compression']},
{t:'Join and Bloom filter offload',s:'Use a filter to cut a scan.',
 a:'The database can send a **Bloom filter** built from a small table to the cells, so the large table scan discards rows that cannot match the join. Only the surviving rows travel to the database.',
 w:'It is what makes star-schema queries cheap on a large fact table.',
 c:`SELECT operation, options, object_name FROM v$sql_plan WHERE sql_id = '&sql_id' AND (operation LIKE '%JOIN FILTER%' OR options LIKE '%STORAGE%');`,see:[3,5,'Joins and Bloom filter offload']},
{t:'AI Smart Scan',s:'Offload vector search.',
 a:'In the 26ai release, the cells can also accelerate **vector distance** calculations and filtering for AI vector search, in the same way as predicates. The database sends the work to storage and receives top results.',
 w:'It extends the offload idea to the AI workload. It depends on the software release.',
 c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'cell%vector%';`,see:[3,6,'AI Smart Scan and vector search offload [26ai]']},
{t:'Verifying offload',s:'Look at the plan and the statistics.',
 a:'The plan shows `TABLE ACCESS STORAGE FULL` when offload is possible, and the **predicate information** shows `storage(...)`. The statistics `cell physical IO bytes eligible for predicate offload` and `... returned by smart scan` show whether it happened and how much it saved.',
 w:'Check by measurement. A plan that could offload may not have, for example because a serial scan used the buffer cache.',
 c:`SELECT sql_id, io_cell_offload_eligible_bytes, io_interconnect_bytes FROM v$sql WHERE sql_id = '&sql_id';`,see:[3,7,'Verifying offload with statistics and SQL Monitor']}
]},

{h:'Design, resources and operations'},
{acc:[
{t:'Disk group design',s:'DATA, RECO and sparse.',
 a:'The usual layout is a **DATA** disk group for datafiles and a **RECO** disk group for the fast recovery area, both across all cells. A **sparse** disk group holds space-efficient snapshots for test and development. Free space and rebalance headroom are part of the design.',
 w:'Design to the failure case: enough free space to re-mirror after a disk or cell failure.',
 c:`SELECT name, total_mb, free_mb, required_mirror_free_mb, usable_file_mb FROM v$asm_diskgroup;`,see:[4,0,'Disk group design: DATA, RECO and sparse']},
{t:'Disk and flash failure handling',s:'Failures are routine.',
 a:'When a disk fails, ASM takes it offline, mirrors serve the data, and a **rebalance** restores redundancy onto the remaining disks. The cell software raises alerts and a service request can be opened automatically. Flash failures are handled similarly, and the cache continues with the remaining devices.',
 w:'Failures are expected. The question is whether the design can survive the next one before repair.',
 c:`SELECT name, state, offline_disks FROM v$asm_diskgroup;
SELECT operation, state, est_minutes FROM v$asm_operation;`,see:[4,4,'Disk and flash failure handling']},
{t:'Exascale',s:'Storage as a shared, elastic service.',
 a:'**Exascale** decouples storage from specific servers. Storage servers form **storage pools** holding **vaults**, and databases use **volumes** and files from the vaults. It enables thin clones, elastic capacity and cloud-style management, with the same smart features.',
 w:'It makes provisioning and cloning fast, and it changes how you administer storage, mainly in the cloud.',
 c:`SELECT file_name FROM dba_data_files FETCH FIRST 3 ROWS ONLY;`,see:[5,0,'Why Exascale: decoupling storage from compute']},
{t:'Thin clones',s:'A copy that shares blocks.',
 a:'A **thin clone** (a PDB snapshot) shares unchanged blocks with its source and stores only changes. It creates a full-size test database in seconds with little space. It requires Exascale or sparse disk groups.',
 w:'It is the way to give each developer or test a real copy.',
 c:`CREATE PLUGGABLE DATABASE pdb_test FROM pdb_prod SNAPSHOT COPY;`,see:[5,3,'Thin clones and PDB snapshots']},
{t:'I/O Resource Management',s:'Share the storage between databases.',
 a:'**IORM** controls how database, category and PDB workloads share I/O on the cells, by shares, limits and objectives (balanced, low latency, high throughput). The plan is defined on the cells, and coordinated with the Database Resource Manager.',
 w:'It lets consolidation work without one database starving the others.',
 c:`$ cellcli -e list iormplan detail
$ dcli -g cell_group -l root "cellcli -e alter iormplan objective=auto"`,see:[6,4,'I/O Resource Management: database, category and PDB plans']},
{t:'Instance caging',s:'Limit CPU per instance.',
 a:'**Instance caging** limits an instance to a number of CPUs with `CPU_COUNT` and a resource plan. It stops one database from using all the cores of a server and allows predictable sharing.',
 w:'It is the CPU side of the consolidation picture, alongside IORM.',
 c:`SHOW PARAMETER cpu_count
SHOW PARAMETER resource_manager_plan`,see:[6,5,'Instance caging and consolidation']},
{t:'Monitoring and health checks',s:'Metrics, alerts and EXAchk.',
 a:'The cells and database servers produce **metrics** and **alerts**, and thresholds are set for them. **EXAchk** and **AHF** compare the system with best practices and collect diagnostic data. Enterprise Manager and the cloud console show the fleet.',
 w:'Run the health check before and after any change, and keep the reports.',
 c:`$ exachk
$ cellcli -e list metriccurrent attributes name,metricObjectName,metricValue where name like 'CD_IO_TM_R_SM.*'`,see:[6,3,'EXAchk, AHF and health checks']},
{t:'Patching the stack',s:'Order matters.',
 a:'An Exadata patch covers **storage servers, database servers, RoCE switches, Grid Infrastructure and database homes**. Tools such as **patchmgr** apply storage and switch updates, rolling or non-rolling, and `opatchauto` patches the Grid and database homes. Oracle publishes the supported order.',
 w:'Rolling updates keep the database available but take longer. Rehearse the whole cycle.',
 c:`$ ./patchmgr -cells cell_group -patch_check_prereq -rolling
$ ./patchmgr -cells cell_group -patch -rolling`,see:[7,1,'Patch order and rolling vs non-rolling strategies']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Five small maps of how the parts fit together: the three layers, storage from disk to ASM, a Smart Scan, flash caching and Exascale.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why a DBA cares, one query or command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. The three layers of Exadata'},
{map:{title:'Exadata layers map',h:328,trace:'Follow a read request',
 hint:'Tap any box, or press Follow a read request to see how a request moves between the layers.',
 lines:[[215,52,241,52],[437,52,463,52],'M340 80 L340 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M340 192 L340 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'app',x:21,y:24,w:194,h:56,c:'ext',t:'Application',s:'client network',d:'Applications connect to the database servers through the client network and SCAN.',why:'They never see the storage layer.',chk:`SELECT service_name, COUNT(*) FROM gv$session WHERE type = 'USER' GROUP BY service_name;`,see:[1,4,'Client, backup and management networks']},
 {id:'dbs',x:243,y:24,w:194,h:56,c:'proc',t:'Database servers',s:'Oracle instances',d:'Servers running the database instances, on bare metal or in VMs.',why:'They do the SQL processing and join work.',chk:`SELECT inst_id, instance_name, host_name FROM gv$instance;`,see:[1,0,'Database servers: compute, memory and local storage']},
 {id:'gi',x:465,y:24,w:194,h:56,c:'proc',t:'Grid Infrastructure',s:'clusterware and ASM',d:'Clusterware and ASM make the servers one cluster, with shared disk groups.',why:'It is the same software as on any RAC.',chk:`$ crsctl check cluster -all`,see:[4,0,'Disk group design: DATA, RECO and sparse']},
 {id:'fab',x:21,y:136,w:194,h:56,c:'net',t:'RoCE fabric',s:'private network',d:'The private, high-speed network between database and storage servers.',why:'It carries I/O and RAC traffic with very low latency.',chk:`$ rdma link show`,see:[1,2,'RoCE fabric and switches']},
 {id:'cell',x:243,y:136,w:194,h:56,c:'proc',t:'Storage server',s:'CELLSRV',d:'The cell software that serves I/O and runs Smart Scan on the data it stores.',why:'It understands database requests.',chk:`$ cellcli -e list cell detail | egrep 'name|status|cellsrvStatus'`,see:[2,0,'Exadata storage software: CELLSRV, MS and RS']},
 {id:'flash',x:465,y:136,w:194,h:56,c:'mem',t:'Flash',s:'cache and log',d:'Flash devices that hold the Smart Flash Cache, Smart Flash Log and, optionally, flash grid disks.',why:'It is why latency is low for hot data.',chk:`$ cellcli -e list flashcache detail`,see:[2,2,'Flash: Smart Flash Cache, Flash Log and flash grid disks']},
 {id:'disk',x:126,y:248,w:200,h:56,c:'disk',t:'Disks',s:'cell and grid disks',d:'Physical disks, exposed as cell disks and grid disks to ASM.',why:'The capacity tier.',chk:`$ cellcli -e list griddisk attributes name,status,size`,see:[2,1,'Physical disks, cell disks and grid disks']},
 {id:'mgmt',x:354,y:248,w:200,h:56,c:'ext',t:'Management',s:'ILOM, switches, PDUs',d:'The management network, ILOM service processors and power distribution.',why:'It is used to administer and monitor the hardware.',chk:`$ ipmitool -I lanplus -H ilom-host chassis status`,see:[1,3,'Management network, ILOM and power distribution']}],
 steps:[
 {ids:['app','dbs'],t:'1. An application sends SQL over the client network to a database instance on one of the database servers.',w:'It is an ordinary database connection.',s:'SCAN, services.',x:'Clients connecting by node name lose load balancing.',c:`SELECT inst_id, COUNT(*) FROM gv$session GROUP BY inst_id;`},
 {ids:['dbs','gi'],t:'2. The instance parses and plans the statement, and decides whether to read through the buffer cache or by direct path.',w:'This decides if offload is possible.',s:'`_serial_direct_read`, plan type.',x:'A small table read through the cache misses offload.',c:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id'));`},
 {ids:['fab'],t:'3. The I/O request travels over the RoCE fabric to the storage servers that hold the data.',w:'The fabric gives low latency and high bandwidth.',s:'RoCE configuration, priority flow control.',x:'A degraded switch port slows all I/O.',c:`$ rdma statistic`},
 {ids:['cell','flash'],t:'4. The cell checks flash cache first, and applies predicate and column filtering for a Smart Scan.',w:'Hot data and filtered data are served quickly.',s:'Flash cache mode, Smart Scan.',x:'Flash cache misses go to disk.',c:`$ cellcli -e list metriccurrent where name like 'FC_IO_RQ_R.*'`},
 {ids:['disk'],t:'5. Data not in flash is read from the disks, striped across all cells in the disk group.',w:'Many disks serve one request in parallel.',s:'Disk group striping.',x:'A disk with errors shows slower reads.',c:`$ cellcli -e list physicaldisk attributes name,status`},
 {ids:['dbs'],t:'6. The cell returns the filtered result. The database server completes the query and returns it to the client.',w:'Less data crosses the fabric than in a conventional design.',s:'Offload statistics.',x:'No offload means the whole block set arrives.',c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'cell physical IO interconnect bytes%';`}]}},

{h:'2. From a physical disk to a tablespace'},
{map:{title:'Storage stack map',h:328,trace:'Follow a disk up to a tablespace',
 hint:'Tap any box, or press Follow a disk up to a tablespace to see each layer that Exadata adds to storage.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'pd',x:21,y:24,w:194,h:56,c:'disk',t:'Physical disk',s:'the device',d:'A hard disk or flash device in a storage server.',why:'The cell reports its status and errors.',chk:`$ cellcli -e list physicaldisk attributes name,diskType,status`,see:[2,1,'Physical disks, cell disks and grid disks']},
 {id:'cd',x:243,y:24,w:194,h:56,c:'disk',t:'Cell disk',s:'cell view',d:'The physical disk as managed by the cell software, with its partitions.',why:'It is created automatically for each physical disk.',chk:`$ cellcli -e list celldisk attributes name,size,status`,see:[2,1,'Physical disks, cell disks and grid disks']},
 {id:'gd',x:465,y:24,w:194,h:56,c:'disk',t:'Grid disk',s:'slice for ASM',d:'A slice of a cell disk presented to ASM. DATA and RECO are typically separate grid disks on the same cell disks.',why:'It is what ASM sees as a disk.',chk:`$ cellcli -e list griddisk attributes name,size,asmModeStatus`,see:[2,1,'Physical disks, cell disks and grid disks']},
 {id:'adisk',x:21,y:136,w:194,h:56,c:'mem',t:'ASM disk',s:'one per grid disk',d:'ASM discovers the grid disks over the fabric as disks (o/ addresses).',why:'Discovery uses the cellip.ora file.',chk:`SELECT path, name, failgroup, state FROM v$asm_disk FETCH FIRST 5 ROWS ONLY;`,see:[2,3,'ASM on Exadata: disk groups on grid disks']},
 {id:'dg',x:243,y:136,w:194,h:56,c:'mem',t:'Disk group',s:'DATA, RECO',d:'A set of ASM disks with a redundancy. The failure group is a storage server.',why:'It is the unit you size, mirror and rebalance.',chk:`SELECT name, type, total_mb, free_mb FROM v$asm_diskgroup;`,see:[4,0,'Disk group design: DATA, RECO and sparse']},
 {id:'ts',x:465,y:136,w:194,h:56,c:'proc',t:'Tablespace',s:'database level',d:'A tablespace whose datafiles live in the disk group.',why:'It is where you work as a DBA.',chk:`SELECT tablespace_name, ROUND(SUM(bytes)/1024/1024/1024) AS gb FROM dba_data_files GROUP BY tablespace_name;`,see:[4,2,'Capacity planning and free space']},
 {id:'df',x:126,y:248,w:200,h:56,c:'disk',t:'Datafile',s:'ASM file',d:'A file in ASM, striped over the disks and mirrored per the redundancy.',why:'The same SQL as on any ASM system.',chk:`SELECT name FROM v$datafile FETCH FIRST 3 ROWS ONLY;`,see:[2,3,'ASM on Exadata: disk groups on grid disks']},
 {id:'seg',x:354,y:248,w:200,h:56,c:'ext',t:'Segment',s:'table or index',d:'The table or index stored in the tablespace.',why:'The object that a query reads.',chk:`SELECT segment_name, segment_type, ROUND(bytes/1024/1024) AS mb FROM user_segments FETCH FIRST 5 ROWS ONLY;`,see:[3,0,'Smart Scan: predicate and column projection offload']}],
 steps:[
 {ids:['pd','cd'],t:'1. Each physical disk becomes a cell disk, managed by the cell software.',w:'This is automatic.',s:'Cell disk creation.',x:'A cell disk in a bad status points at the device.',c:`$ cellcli -e list celldisk`},
 {ids:['gd'],t:'2. Cell disks are divided into grid disks, for example DATA and RECO, using a percentage of each disk.',w:'It sets the ratio between DATA and RECO.',s:'`CREATE GRIDDISK`, sizes.',x:'Changing the ratio later is a significant operation.',c:`$ cellcli -e list griddisk attributes name,size`},
 {ids:['adisk','dg'],t:'3. ASM discovers the grid disks and builds disk groups, with each cell as a failure group.',w:'A whole cell can fail without data loss.',s:'`ASM_DISKSTRING`, `cellip.ora`.',x:'A missing cellip.ora entry hides a cell from ASM.',c:`SELECT failgroup, COUNT(*) FROM v$asm_disk GROUP BY failgroup;`},
 {ids:['ts','df'],t:'4. Tablespaces and datafiles are created in the disk group, usually through OMF.',w:'It is the same from the database side.',s:'OMF, `DB_CREATE_FILE_DEST`.',x:'Autoextend on a nearly full disk group.',c:`SHOW PARAMETER db_create_file_dest`},
 {ids:['seg'],t:'5. Tables and indexes are stored in these files, and a scan of them can be offloaded to the cells that hold them.',w:'The physical layout is why offload works.',s:'Segment design.',x:'Partitioning and compression change what is scanned.',c:`SELECT segment_name, bytes FROM user_segments ORDER BY bytes DESC FETCH FIRST 5 ROWS ONLY;`}]}},

{h:'3. A Smart Scan'},
{map:{title:'Smart Scan map',h:328,trace:'Offload a query',
 hint:'Tap any box, or press Offload a query to follow a scan from the SQL to the filtered result.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L340 219 L340 246'],
 nodes:[
 {id:'sql',x:21,y:24,w:194,h:56,c:'ext',t:'SQL',s:'large scan',d:'A query with a predicate on a large table, for example WHERE order_date > ...',why:'A scan of many rows with a selective filter benefits most.',chk:`SELECT /*+ GATHER_PLAN_STATISTICS */ COUNT(*) FROM sales WHERE amount > 1000;`,see:[3,0,'Smart Scan: predicate and column projection offload']},
 {id:'dpr',x:243,y:24,w:194,h:56,c:'mem',t:'Direct path read',s:'bypass the cache',d:'The scan uses direct path reads, which is required for offload.',why:'Small tables read through the cache are not offloaded.',chk:`SELECT event, total_waits FROM v$system_event WHERE event LIKE 'cell smart table scan%' OR event = 'direct path read';`,see:[3,7,'Verifying offload with statistics and SQL Monitor']},
 {id:'req',x:465,y:24,w:194,h:56,c:'proc',t:'Offload request',s:'predicates and columns',d:'The database sends the predicates and the required columns to the cells with the I/O.',why:'The cells know what to return.',chk:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id', NULL, 'TYPICAL')) WHERE plan_table_output LIKE '%storage%';`,see:[3,0,'Smart Scan: predicate and column projection offload']},
 {id:'si',x:21,y:136,w:194,h:56,c:'mem',t:'Storage index',s:'skip regions',d:'The cell checks its in-memory index to skip regions that cannot match.',why:'Free savings when data is clustered.',chk:`SELECT name, value FROM v$sysstat WHERE name = 'cell physical IO bytes saved by storage index';`,see:[3,1,'Storage indexes']},
 {id:'cell',x:243,y:136,w:194,h:56,c:'proc',t:'Cell scan',s:'filter and project',d:'The cell reads the blocks (from flash or disk), applies the predicate and keeps only the needed columns.',why:'The CPU of many cells works in parallel.',chk:`$ cellcli -e list metriccurrent where name like 'IO_RQ_%'`,see:[3,0,'Smart Scan: predicate and column projection offload']},
 {id:'res',x:465,y:136,w:194,h:56,c:'mem',t:'Result rows',s:'compact',d:'Only the matching rows and columns are sent back, in a compact format.',why:'Network and database CPU savings.',chk:`SELECT name, value FROM v$sysstat WHERE name = 'cell physical IO interconnect bytes returned by smart scan';`,see:[3,0,'Smart Scan: predicate and column projection offload']},
 {id:'ret',x:240,y:248,w:200,h:56,c:'ext',t:'Database server',s:'finish the query',d:'The instance combines, aggregates and returns the result to the user.',why:'The remaining work is small.',chk:`SELECT sql_id, io_cell_offload_eligible_bytes, io_cell_offload_returned_bytes FROM v$sql WHERE sql_id = '&sql_id';`,see:[3,7,'Verifying offload with statistics and SQL Monitor']}],
 steps:[
 {ids:['sql','dpr'],t:'1. A large scan starts. The optimizer chooses a full scan, and the runtime decides on direct path reads.',w:'Both are needed for offload.',s:'`_small_table_threshold`, parallel query.',x:'A scan read through the cache is not offloaded.',c:`SELECT operation, options FROM v$sql_plan WHERE sql_id = '&sql_id' AND options LIKE '%STORAGE%';`},
 {ids:['req'],t:'2. The database sends the I/O requests with the predicates and the list of columns to the cells.',w:'It tells the cell what to keep.',s:'`CELL_OFFLOAD_PROCESSING`.',x:'Functions the cell does not support cannot be offloaded.',c:`SHOW PARAMETER cell_offload_processing`},
 {ids:['si','cell'],t:'3. Each cell skips regions with its storage index, reads the others, and filters rows and columns.',w:'The scan is split over all cells.',s:'Storage index, flash cache.',x:'Data that is not clustered gives no storage index saving.',c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'cell physical IO%saved%';`},
 {ids:['res'],t:'4. Only the filtered result returns over the fabric, much smaller than the data scanned.',w:'It saves bandwidth and database CPU.',s:'Compression of results.',x:'Non-selective predicates return most of the data.',c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'cell physical IO bytes eligible%';`},
 {ids:['ret'],t:'5. The database server finishes the query. Compare eligible and returned bytes to see the benefit.',w:'It is the proof that it worked.',s:'SQL Monitor, `V$SQL`.',x:'Eligible bytes of zero means no offload happened.',c:`SELECT sql_id, io_cell_offload_eligible_bytes, io_interconnect_bytes FROM v$sql WHERE sql_id = '&sql_id';`}]}},

{h:'4. Flash cache and flash log'},
{map:{title:'Flash map',h:328,trace:'A commit and a hot read',
 hint:'Tap any box, or press A commit and a hot read to see where flash helps a write and a read.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134','M562 80 L562 107 L340 107 L340 134',[437,164,463,164],'M340 192 L340 219 L454 219 L454 246',[215,164,463,164],'M226 248 L226 221 L340 221 L340 194'],
 nodes:[
 {id:'db',x:21,y:24,w:194,h:56,c:'ext',t:'Database server',s:'sends I/O',d:'The instance issues reads and writes, including redo writes by LGWR.',why:'It marks the type of I/O so the cell can treat it properly.',chk:`SELECT event, total_waits FROM v$system_event WHERE event IN ('log file sync','log file parallel write');`,see:[2,2,'Flash: Smart Flash Cache, Flash Log and flash grid disks']},
 {id:'lgwr',x:243,y:24,w:194,h:56,c:'proc',t:'LGWR',s:'redo write',d:'The log writer sends the redo write for a commit to the cells.',why:'The commit waits on this write.',chk:`SELECT event, ROUND(time_waited_micro/NULLIF(total_waits,0)/1000,2) AS avg_ms FROM v$system_event WHERE event = 'log file parallel write';`,see:[3,3,'Smart Flash Log']},
 {id:'cell',x:465,y:24,w:194,h:56,c:'proc',t:'Cell',s:'CELLSRV',d:'The cell receives the write and decides where to put it.',why:'It issues the redo write to flash and disk in parallel.',chk:`$ cellcli -e list cell detail | grep -i flash`,see:[2,0,'Exadata storage software: CELLSRV, MS and RS']},
 {id:'fl',x:21,y:136,w:194,h:56,c:'mem',t:'Flash log',s:'fast commit',d:'Smart Flash Log writes redo to flash and disk at the same time and acknowledges whichever completes first.',why:'It removes the slow outlier writes from commit time.',chk:`$ cellcli -e list flashlog detail`,see:[3,3,'Smart Flash Log']},
 {id:'fc',x:243,y:136,w:194,h:56,c:'mem',t:'Flash cache',s:'hot blocks',d:'Hot data blocks are kept in flash. The cell decides what to cache by the type of I/O.',why:'Large scans do not flush the cache.',chk:`$ cellcli -e list flashcache detail`,see:[3,2,'Smart Flash Cache and write-back mode']},
 {id:'disk',x:465,y:136,w:194,h:56,c:'disk',t:'Disks',s:'capacity tier',d:'The hard disks hold the full data set, and data is written back to them.',why:'Slower than flash, and bigger.',chk:`$ cellcli -e list griddisk attributes name,cachingPolicy`,see:[2,1,'Physical disks, cell disks and grid disks']},
 {id:'wb',x:126,y:248,w:200,h:56,c:'proc',t:'Write-back',s:'writes in flash',d:'In write-back mode, block writes go to flash first and are written to disk later.',why:'It raises write throughput for write-heavy workloads.',chk:`$ cellcli -e list cell attributes flashCacheMode`,see:[3,2,'Smart Flash Cache and write-back mode']},
 {id:'hit',x:354,y:248,w:200,h:56,c:'ext',t:'Cache hit',s:'read from flash',d:'A later read finds the block in flash and returns without touching the disk.',why:'It is the low-latency path for hot data.',chk:`SELECT name, value FROM v$sysstat WHERE name = 'cell flash cache read hits';`,see:[3,2,'Smart Flash Cache and write-back mode']}],
 steps:[
 {ids:['db','lgwr'],t:'1. A transaction commits and LGWR writes the redo. This write is on the critical path of the commit.',w:'It is the commit latency.',s:'`COMMIT_WRITE`, redo size.',x:'High `log file sync` points to redo write latency.',c:`SELECT event, average_wait FROM v$system_event WHERE event = 'log file sync';`},
 {ids:['cell','fl'],t:'2. The cell writes the redo to flash and to disk simultaneously, and returns when the first write completes.',w:'A slow disk write no longer delays the commit.',s:'Smart Flash Log (automatic).',x:'It helps outliers more than the average.',c:`$ cellcli -e list metriccurrent where name like 'FL_%'`},
 {ids:['db','fc'],t:'3. A block read request arrives. The cell looks in the flash cache first.',w:'Hot data does not need the disk.',s:'Flash cache size and policy.',x:'A working set bigger than flash goes to disk.',c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'cell flash cache read hits';`},
 {ids:['fc','hit'],t:'4. On a hit the block returns from flash in microseconds, and the access pattern keeps hot blocks cached.',w:'It is why a High Capacity system behaves like flash.',s:'Caching policy per grid disk.',x:'A table scan that is not cache-worthy bypasses flash.',c:`$ cellcli -e list metriccurrent where name = 'FC_IO_RQ_R_SKIP'`},
 {ids:['wb','disk'],t:'5. In write-back mode, dirty blocks sit in flash and are flushed to disk later, which speeds up write-heavy work.',w:'Write throughput is bounded by flash, not disks.',s:'`flashCacheMode`.',x:'Losing a flash device with unflushed writes depends on mirroring, which is handled by ASM redundancy.',c:`$ cellcli -e list cell attributes flashCacheMode`}]}},

{h:'5. Exascale compared with classic Exadata storage'},
{map:{title:'Exascale map',h:216,trace:'Create a thin clone',
 hint:'Tap any box, or press Create a thin clone to see how Exascale storage differs from the classic grid disk model.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'cl',x:21,y:24,w:194,h:56,c:'ext',t:'Classic model',s:'cell-bound ASM',d:'Storage is grid disks on specific cells, grouped into ASM disk groups that you size and manage.',why:'Capacity is tied to cells and disk group layout.',chk:`SELECT name, total_mb, free_mb FROM v$asm_diskgroup;`,see:[5,0,'Why Exascale: decoupling storage from compute']},
 {id:'ev',x:243,y:24,w:194,h:56,c:'proc',t:'Exascale services',s:'EGS, EDS',d:'Exascale software manages a pool of storage across cells and presents it as shared services.',why:'It makes storage a service, not a set of disks.',chk:`$ escli lsvault`,see:[5,1,'Exascale architecture: vaults, storage pools and volumes']},
 {id:'pool',x:465,y:24,w:194,h:56,c:'disk',t:'Storage pool',s:'all the cells',d:'A pool built from the disks and flash of the storage servers in the cluster.',why:'Capacity is shared across databases and clusters.',chk:`$ escli lspool`,see:[5,1,'Exascale architecture: vaults, storage pools and volumes']},
 {id:'vault',x:21,y:136,w:194,h:56,c:'mem',t:'Vault',s:'unit of allocation',d:'A vault is a logical container carved from the pool, with policies for redundancy, caching and quotas.',why:'It plays the role that a disk group played.',chk:`$ escli lsvault --detail`,see:[5,1,'Exascale architecture: vaults, storage pools and volumes']},
 {id:'vol',x:243,y:136,w:194,h:56,c:'mem',t:'Volumes and files',s:'database storage',d:'Databases store their files in a vault directly, and block volumes serve other uses.',why:'No ASM disk group layout to plan.',chk:`SELECT name FROM v$datafile FETCH FIRST 3 ROWS ONLY;`,see:[5,2,'Database storage on Exascale vs ASM']},
 {id:'clone',x:465,y:136,w:194,h:56,c:'proc',t:'Thin clone',s:'shared blocks',d:'A snapshot copy of a PDB that shares blocks with the source and stores only changes.',why:'A full-size test copy in seconds.',chk:`CREATE PLUGGABLE DATABASE pdb_test FROM pdb_prod SNAPSHOT COPY;`,see:[5,3,'Thin clones and PDB snapshots']}],
 steps:[
 {ids:['cl','ev'],t:'1. In the classic model you plan grid disks, disk groups and rebalance. In Exascale, services manage the pool for you.',w:'Less layout planning, more automation.',s:'Exascale software release.',x:'Classic and Exascale have different tools and views.',c:`$ escli lsvault`},
 {ids:['pool','vault'],t:'2. The pool holds all the capacity. A vault is created from it with a size, redundancy and caching rules.',w:'It is the new unit of allocation.',s:'`escli mkvault`.',x:'A vault quota that is too small stops growth.',c:`$ escli lsvault --detail`},
 {ids:['vol'],t:'3. The database places its files in the vault. Files are mirrored and striped by the service.',w:'The database sees files, not disks.',s:'Database parameters for the vault location.',x:'A database must use a supported release for Exascale storage.',c:`SELECT name FROM v$controlfile;`},
 {ids:['clone'],t:'4. A thin clone of a PDB is created in seconds. It shares blocks with the source until they are changed.',w:'It is the base for dev and test provisioning.',s:'`SNAPSHOT COPY`, vault capacity.',x:'A clone that changes heavily grows toward a full copy.',c:`SELECT name, snapshot_parent_con_id FROM v$pdbs;`},
 {ids:['vault'],t:'5. Capacity is added to the pool by adding storage servers, and it is available to every vault at once.',w:'Elastic growth without rebuilding disk groups.',s:'Pool management.',x:'The pool rebalances in the background and it takes time.',c:`$ escli lspool`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Seven small maps of how something happens, step by step: proving offload, a disk failure, an IORM plan, a full-stack patch, a cell inspection, provisioning in the cloud and a migration.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Proving that a query is offloaded'},
{map:{title:'Offload check map',h:216,trace:'Check offload',
 hint:'Tap any box, or press Check offload to follow the checks from a plan to a conclusion.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'plan',x:21,y:24,w:194,h:56,c:'mem',t:'Plan',s:'STORAGE FULL',d:'Display the plan and look for TABLE ACCESS STORAGE FULL or INDEX STORAGE FAST FULL SCAN.',why:'The word STORAGE means offload is possible.',chk:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id', NULL, 'TYPICAL'));`,see:[3,7,'Verifying offload with statistics and SQL Monitor']},
 {id:'pred',x:243,y:24,w:194,h:56,c:'mem',t:'Predicate info',s:'storage(...)',d:'The predicate section should show predicates marked storage(...).',why:'Those are what the cell applies.',chk:`SELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id')) WHERE plan_table_output LIKE '%storage(%';`,see:[3,7,'Verifying offload with statistics and SQL Monitor']},
 {id:'stat',x:465,y:24,w:194,h:56,c:'mem',t:'Statistics',s:'eligible and returned',d:'Compare bytes eligible for offload with bytes returned by Smart Scan.',why:'It shows whether it happened and the saving.',chk:`SELECT io_cell_offload_eligible_bytes, io_cell_offload_returned_bytes, io_interconnect_bytes FROM v$sql WHERE sql_id = '&sql_id';`,see:[3,7,'Verifying offload with statistics and SQL Monitor']},
 {id:'why',x:126,y:136,w:200,h:56,c:'warn',t:'If not offloaded',s:'find the reason',d:'Check serial direct read, small table, function not supported, row-by-row access, a cached scan or a parameter.',why:'Each has a specific fix.',chk:`SHOW PARAMETER cell_offload_processing
SELECT name, value FROM v$sysstat WHERE name LIKE 'cell physical IO%';`,see:[9,4,'Troubleshooting method: offload, flash and I/O']},
 {id:'fix',x:354,y:136,w:200,h:56,c:'proc',t:'Change and recheck',s:'measure again',d:'Fix the cause, for example enable parallel query, and measure again.',why:'The statistics should now change.',chk:`SELECT /*+ PARALLEL(4) */ COUNT(*) FROM sales WHERE amount > 1000;`,see:[3,8,'Practical: Prove a query is offloaded and explain why not']}],
 steps:[
 {ids:['plan','pred'],t:'1. Display the plan with the predicate information. Look for STORAGE in the access step and storage(...) in the predicates.',w:'It tells you whether offload is possible.',s:'`DISPLAY_CURSOR`, format `TYPICAL`.',x:'EXPLAIN PLAN output can differ from the actual run.',c:`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('&sql_id'));`},
 {ids:['stat'],t:'2. Check the offload statistics for the statement: eligible bytes and bytes returned by Smart Scan.',w:'Eligible bytes of zero means it was not offloaded.',s:'`V$SQL`, SQL Monitor.',x:'A small returned/eligible ratio means a very selective filter, which is good.',c:`SELECT io_cell_offload_eligible_bytes FROM v$sql WHERE sql_id = '&sql_id';`},
 {ids:['why'],t:'3. If not offloaded, find the cause: no direct read, a table below the threshold, an unsupported function, or offload turned off.',w:'The cause determines the fix.',s:'`CELL_OFFLOAD_PROCESSING`, `_serial_direct_read`.',x:'A cached table read through the buffer cache is expected and fine.',c:`SELECT event, total_waits FROM v$system_event WHERE event LIKE 'cell smart%';`},
 {ids:['fix'],t:'4. Apply the fix and run the statement again. Compare the elapsed time and the statistics.',w:'The change must be shown to work.',s:'Parallel query, hints, parameter.',x:'Forcing offload for a small table wastes work.',c:`SELECT elapsed_time/1000000 AS secs FROM v$sql WHERE sql_id = '&sql_id';`}]}},

{h:'2. A disk fails'},
{map:{title:'Disk failure map',h:216,trace:'Handle a disk failure',
 hint:'Tap any box, or press Handle a disk failure to follow a failure from the alert to restored redundancy.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'err',x:21,y:24,w:194,h:56,c:'warn',t:'I/O errors',s:'disk fails',d:'A physical disk reports errors or stops responding.',why:'The cell detects it first.',chk:`$ cellcli -e list physicaldisk where status != normal`,see:[4,4,'Disk and flash failure handling']},
 {id:'alert',x:243,y:24,w:194,h:56,c:'mem',t:'Alert',s:'cell and ASR',d:'The cell raises an alert, and Automatic Service Request can open a case with the failed part.',why:'You are told before users are.',chk:`$ cellcli -e list alerthistory where severity = 'critical'`,see:[6,6,'Automatic Service Request and support']},
 {id:'off',x:465,y:24,w:194,h:56,c:'proc',t:'ASM offline',s:'grid disks',d:'ASM takes the grid disks of that disk offline, and the disk group stays available.',why:'There is no outage.',chk:`SELECT name, mode_status, mount_status FROM v$asm_disk WHERE mode_status <> 'ONLINE';`,see:[4,4,'Disk and flash failure handling']},
 {id:'mir',x:20,y:136,w:139,h:56,c:'mem',t:'Mirror serves',s:'other failure group',d:'Reads and writes use the mirror copies on other cells.',why:'It protects the data while repair is pending.',chk:`SELECT name, state, offline_disks FROM v$asm_diskgroup;`,see:[4,1,'Redundancy and failure groups on Exadata']},
 {id:'rep',x:187,y:136,w:139,h:56,c:'proc',t:'Replace',s:'hot swap',d:'The disk is replaced, usually by Oracle support, with the system running.',why:'No downtime needed.',chk:`$ cellcli -e list physicaldisk attributes name,status`,see:[4,4,'Disk and flash failure handling']},
 {id:'reb',x:354,y:136,w:139,h:56,c:'proc',t:'Rebalance',s:'restore redundancy',d:'The new disk is added back and ASM rebalances the data.',why:'It runs in the background with a power limit.',chk:`SELECT operation, state, power, est_minutes FROM v$asm_operation;`,see:[4,3,'Rebalance and automatic rebalance tuning']},
 {id:'ver',x:521,y:136,w:139,h:56,c:'mem',t:'Verify',s:'status and free space',d:'Confirm all grid disks are online, the rebalance is complete and free space is sufficient.',why:'You are protected again.',chk:`SELECT name, free_mb, required_mirror_free_mb FROM v$asm_diskgroup;`,see:[4,2,'Capacity planning and free space']}],
 steps:[
 {ids:['err','alert'],t:'1. The cell detects the failing disk and raises an alert. ASR may open a service request automatically.',w:'Detection and the parts order are automatic.',s:'Alert thresholds, ASR configuration.',x:'ASR not configured means nobody orders the part.',c:`$ cellcli -e list alerthistory`},
 {ids:['off','mir'],t:'2. ASM takes the affected grid disks offline. The mirror copies on other cells serve all I/O, and users notice nothing.',w:'The design absorbs the failure.',s:'`DISK_REPAIR_TIME`, redundancy.',x:'A second failure in the mirror partner during this time loses data on normal redundancy.',c:`SELECT name, mode_status FROM v$asm_disk WHERE mode_status <> 'ONLINE';`},
 {ids:['rep'],t:'3. The disk is replaced online. The cell creates the cell disk and grid disks on it again.',w:'Often it is automatic once the disk is physically replaced.',s:'Service request, replacement process.',x:'Replacing the wrong disk. Check the LED and the name.',c:`$ cellcli -e list celldisk`},
 {ids:['reb'],t:'4. ASM rebalances, copying data onto the new disk until redundancy is restored.',w:'It restores the original protection.',s:'`ASM_POWER_LIMIT`, rebalance power.',x:'A very high power value affects the workload.',c:`SELECT * FROM v$asm_operation;`},
 {ids:['ver'],t:'5. Verify the disk group and cells are healthy and record the event.',w:'It closes the incident.',s:'Health checks.',x:'A rebalance that never ends points to insufficient free space.',c:`SELECT name, state FROM v$asm_diskgroup;`}]}},

{h:'3. Creating an I/O Resource Management plan'},
{map:{title:'IORM plan map',h:216,trace:'Share the I/O',
 hint:'Tap any box, or press Share the I/O to follow the steps from a requirement to a verified plan.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'req',x:20,y:24,w:139,h:56,c:'ext',t:'Requirement',s:'who gets what',d:'Decide the priority between databases or PDBs: production first, test limited.',why:'It is a business decision.',chk:`SELECT name FROM v$database;
SELECT name FROM v$pdbs;`,see:[6,4,'I/O Resource Management: database, category and PDB plans']},
 {id:'obj',x:187,y:24,w:139,h:56,c:'mem',t:'Objective',s:'auto or chosen',d:'Set the IORM objective: auto, balanced, low latency or high throughput.',why:'It tunes the cell scheduling for the workload.',chk:`$ cellcli -e alter iormplan objective=auto`,see:[6,4,'I/O Resource Management: database, category and PDB plans']},
 {id:'plan',x:354,y:24,w:139,h:56,c:'proc',t:'Define the plan',s:'shares and limits',d:'Create the plan with shares per database, and limits where needed.',why:'Shares set the relative priority under contention.',chk:`$ cellcli -e alter iormplan dbplan=((name=prod, share=8), (name=test, share=2, limit=20))`,see:[6,4,'I/O Resource Management: database, category and PDB plans']},
 {id:'apply',x:521,y:24,w:139,h:56,c:'proc',t:'Apply on all cells',s:'dcli',d:'Apply the same plan on every storage server.',why:'A plan differing between cells gives uneven results.',chk:`$ dcli -g cell_group -l celladmin "cellcli -e alter iormplan active"`,see:[6,0,'Administration tools: CellCLI, dcli, exacli and dbmcli']},
 {id:'dbrm',x:21,y:136,w:194,h:56,c:'mem',t:'DBRM plans',s:'inside the database',d:'Define consumer groups and plans in the database for CPU and parallelism, and map PDBs.',why:'IORM and DBRM complement each other.',chk:`SELECT plan, group_or_subplan, shares FROM dba_cdb_rsrc_plan_directives;`,see:[6,4,'I/O Resource Management: database, category and PDB plans']},
 {id:'obs',x:243,y:136,w:194,h:56,c:'mem',t:'Observe',s:'IORM metrics',d:'Look at I/O metrics per database to confirm the plan is in effect.',why:'Under contention the shares should show.',chk:`$ cellcli -e list metriccurrent where name like 'DB_IO_WT_%'`,see:[6,7,'Practical: Create an IORM plan and observe its effect']},
 {id:'adj',x:465,y:136,w:194,h:56,c:'proc',t:'Adjust',s:'review',d:'Adjust shares and limits from what you saw, and document the plan.',why:'A plan is a living document.',chk:`$ cellcli -e list iormplan detail`,see:[6,4,'I/O Resource Management: database, category and PDB plans']}],
 steps:[
 {ids:['req','obj'],t:'1. Write the priorities: which databases or PDBs must be protected and which can be limited. Choose the objective.',w:'The plan only encodes a decision.',s:'Business priorities.',x:'A plan with every database at equal share protects nothing.',c:`$ cellcli -e list iormplan detail`},
 {ids:['plan','apply'],t:'2. Define the plan with shares and limits and apply it on every cell with dcli.',w:'The cells enforce it.',s:'`ALTER IORMPLAN`, dcli group.',x:'Applying to only some cells gives inconsistent behaviour.',c:`$ dcli -g cell_group -l celladmin "cellcli -e list iormplan"`},
 {ids:['dbrm'],t:'3. Align the database resource plans (CPU, parallel) with the I/O plan, so the same priorities apply to CPU.',w:'Both resources need the same priorities.',s:'CDB plan, consumer groups.',x:'A CPU limit that conflicts with the I/O share confuses results.',c:`SELECT plan, pluggable_database, shares FROM dba_cdb_rsrc_plan_directives;`},
 {ids:['obs'],t:'4. Generate load and observe the I/O metrics per database. Check that shares apply under contention.',w:'It shows that the plan works.',s:'IORM metrics, AWR.',x:'No contention means no visible effect.',c:`$ cellcli -e list metriccurrent where name like 'DB_IO_%'`},
 {ids:['adj'],t:'5. Adjust and document. Re-check after adding a database or changing hardware.',w:'Plans drift as the estate changes.',s:'Change record, review schedule.',x:'An old plan that omits a new database.',c:`$ cellcli -e list iormplan detail`}]}},

{h:'4. Patching the whole stack'},
{map:{title:'Full-stack patch map',h:216,trace:'Patch in order',
 hint:'Tap any box, or press Patch in order to follow the update of storage, servers, switches and software.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'plan',x:20,y:24,w:139,h:56,c:'ext',t:'Plan',s:'MOS patch guide',d:'Read the release notes and the patch guide for the target software version, and choose rolling or non-rolling.',why:'The order and prerequisites are documented there.',chk:`$ imageinfo`,see:[7,0,'What gets patched: storage, database servers, switches, GI and database']},
 {id:'pre',x:187,y:24,w:139,h:56,c:'mem',t:'Prechecks',s:'patchmgr and EXAchk',d:'Run patchmgr prerequisite checks and EXAchk, and take backups.',why:'Find problems with no outage.',chk:`$ ./patchmgr -cells cell_group -patch_check_prereq -rolling
$ exachk`,see:[7,5,'Prechecks, rollback and backups']},
 {id:'cell',x:354,y:24,w:139,h:56,c:'proc',t:'Storage servers',s:'patchmgr',d:'Update the storage servers, rolling one at a time with ASM keeping data available.',why:'The database stays up, and the update takes longer.',chk:`$ ./patchmgr -cells cell_group -patch -rolling`,see:[7,2,'patchmgr for storage servers and switches']},
 {id:'sw',x:521,y:24,w:139,h:56,c:'proc',t:'Switches',s:'RoCE',d:'Update the RoCE switches, one at a time.',why:'Redundant switches keep the fabric available.',chk:`$ ./patchmgr -roceswitches roce_group -upgrade`,see:[7,2,'patchmgr for storage servers and switches']},
 {id:'dbn',x:20,y:136,w:139,h:56,c:'proc',t:'Database servers',s:'OS update',d:'Update the database servers (OS and firmware), one node at a time.',why:'RAC keeps the database available.',chk:`$ ./patchmgr -dbnodes dbs_group -upgrade -iso_repo /stage/image.zip -target_version 24.1.0`,see:[7,3,'Database server updates']},
 {id:'gi',x:187,y:136,w:139,h:56,c:'proc',t:'Grid Infrastructure',s:'opatchauto',d:'Patch the Grid home, rolling, with services drained.',why:'Clusterware and ASM move to the new level.',chk:`# opatchauto apply /patches/gi -oh /u01/app/19.0.0/grid`,see:[7,4,'Grid Infrastructure and database home patching (opatchauto)']},
 {id:'db',x:354,y:136,w:139,h:56,c:'proc',t:'Database homes',s:'opatchauto, datapatch',d:'Patch the database homes and run datapatch.',why:'The database software is at the target level.',chk:`# opatchauto apply /patches/db -oh $ORACLE_HOME
$ datapatch -verbose`,see:[7,4,'Grid Infrastructure and database home patching (opatchauto)']},
 {id:'ver',x:521,y:136,w:139,h:56,c:'mem',t:'Verify',s:'EXAchk and tests',d:'Run EXAchk and application tests, and record versions.',why:'It is the evidence that the stack is consistent.',chk:`$ exachk
$ imageinfo`,see:[7,6,'Practical: Plan and rehearse a full-stack patching cycle']}],
 steps:[
 {ids:['plan','pre'],t:'1. Read the patch guide and run the prechecks. Rehearse on a non-production system and take backups.',w:'Most problems appear in the rehearsal.',s:'MOS patch guide, `patchmgr -patch_check_prereq`.',x:'Skipping the rehearsal means learning in the window.',c:`$ ./patchmgr -cells cell_group -patch_check_prereq`},
 {ids:['cell','sw'],t:'2. Update the storage servers and the switches, rolling, so the database stays available.',w:'Storage is updated first, as the documented order usually requires.',s:'`-rolling`, `-non_rolling`.',x:'A non-rolling update needs an outage.',c:`$ cellcli -e list cell attributes name,releaseVersion`},
 {ids:['dbn'],t:'3. Update the database servers one node at a time. Services drain and move to the other nodes.',w:'RAC makes it online.',s:'`patchmgr -dbnodes`, service draining.',x:'Too few nodes means the remaining node is overloaded during the update.',c:`$ ./patchmgr -dbnodes dbs_group -precheck -iso_repo /stage/image.zip -target_version 24.1.0`},
 {ids:['gi','db'],t:'4. Patch the Grid and database homes with opatchauto, and run datapatch for the database.',w:'The software above the OS is brought to the new level.',s:'`opatchauto`, `datapatch`.',x:'A patch that needs a one-off for a specific configuration.',c:`SELECT patch_id, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 3 ROWS ONLY;`},
 {ids:['ver'],t:'5. Verify with EXAchk and the application tests, and update your inventory and runbook.',w:'It proves the stack is consistent.',s:'EXAchk, AHF.',x:'A mixed state left because one component was skipped.',c:`$ exachk -a`}]}},

{h:'5. Inspecting a storage server with CellCLI'},
{map:{title:'Cell inspection map',h:216,trace:'Check a cell',
 hint:'Tap any box, or press Check a cell to follow the commands to ask a storage server how it is doing.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'cell',x:20,y:24,w:139,h:56,c:'proc',t:'Cell status',s:'services',d:'Check that CELLSRV, MS and RS are running.',why:'If a service is down, nothing else matters.',chk:`$ cellcli -e list cell attributes name,status,cellsrvStatus,msStatus,rsStatus`,see:[2,4,'CellCLI, dcli and exacli']},
 {id:'disks',x:187,y:24,w:139,h:56,c:'disk',t:'Disks',s:'physical, cell, grid',d:'List the disk layers and their status.',why:'A status not normal is the first thing to chase.',chk:`$ cellcli -e list physicaldisk attributes name,status
$ cellcli -e list griddisk attributes name,status,asmModeStatus`,see:[2,1,'Physical disks, cell disks and grid disks']},
 {id:'flash',x:354,y:24,w:139,h:56,c:'mem',t:'Flash',s:'cache and log',d:'Check flash cache and flash log status and mode.',why:'A degraded flash cache means more disk reads.',chk:`$ cellcli -e list flashcache detail`,see:[2,2,'Flash: Smart Flash Cache, Flash Log and flash grid disks']},
 {id:'alert',x:521,y:24,w:139,h:56,c:'warn',t:'Alerts',s:'history',d:'Read the alert history for warnings and critical items.',why:'The cell has usually already told you.',chk:`$ cellcli -e list alerthistory where severity != 'info'`,see:[2,5,'Cell metrics and alerts basics']},
 {id:'met',x:21,y:136,w:194,h:56,c:'mem',t:'Metrics',s:'current values',d:'List metrics such as I/O latency, throughput and cache hit rates.',why:'It shows load and health over time.',chk:`$ cellcli -e list metriccurrent where objectType = 'CELLDISK'`,see:[2,5,'Cell metrics and alerts basics']},
 {id:'cfg',x:243,y:136,w:194,h:56,c:'mem',t:'Configuration',s:'attributes',d:'Read cell attributes: IORM plan, flash cache mode, network configuration.',why:'Differences between cells cause odd behaviour.',chk:`$ cellcli -e list cell detail`,see:[2,4,'CellCLI, dcli and exacli']},
 {id:'grp',x:465,y:136,w:194,h:56,c:'ext',t:'All cells at once',s:'dcli',d:'Run the same command on all cells with dcli and compare.',why:'It finds the cell that differs.',chk:`$ dcli -g cell_group -l celladmin "cellcli -e list cell attributes name,status"`,see:[2,4,'CellCLI, dcli and exacli']}],
 steps:[
 {ids:['cell'],t:'1. Check the cell and its services first. A service that is not running explains many symptoms.',w:'It is the base of the stack.',s:'`celld`, MS, RS.',x:'A restart loop in RS points to a deeper fault.',c:`$ cellcli -e list cell attributes name,status,cellsrvStatus`},
 {ids:['disks','flash'],t:'2. List the physical disks, cell disks, grid disks and flash, and check their status.',w:'A bad device explains slow or missing I/O.',s:'`list physicaldisk`, `list flashcache`.',x:'A grid disk that is not ONLINE in ASM needs ASM-side checks too.',c:`$ cellcli -e list griddisk attributes name,status`},
 {ids:['alert'],t:'3. Read the alert history for the period of the issue.',w:'The cell often records the cause.',s:'`list alerthistory`.',x:'Unacknowledged old alerts hide new ones. Review them.',c:`$ cellcli -e list alerthistory where beginTime > '2026-10-10T00:00:00-00:00'`},
 {ids:['met'],t:'4. Look at I/O metrics for the same period: latency, throughput and queue.',w:'It tells you whether the cell was busy.',s:'`list metrichistory`.',x:'A saturated cell and a faulty cell look different in the metrics.',c:`$ cellcli -e list metrichistory where name like 'CD_IO_TM_R_SM.*'`},
 {ids:['cfg','grp'],t:'5. Compare configuration across cells with dcli, and fix the one that differs.',w:'Uneven configuration gives uneven performance.',s:'`dcli -g cell_group`.',x:'An IORM plan applied to some cells only.',c:`$ dcli -g cell_group -l celladmin "cellcli -e list iormplan"`}]}},

{h:'6. Provisioning a VM cluster in the cloud'},
{map:{title:'VM cluster map',h:216,trace:'Provision a VM cluster',
 hint:'Tap any box, or press Provision a VM cluster to follow the steps in an Exadata cloud deployment.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'infra',x:21,y:24,w:194,h:56,c:'ext',t:'Infrastructure',s:'compute and storage',d:'Choose the Exadata infrastructure shape: database servers and storage servers.',why:'It sets the capacity you can use.',chk:`SELECT instance_name, host_name FROM v$instance;`,see:[8,0,'Exadata Database Service on Dedicated Infrastructure']},
 {id:'net',x:243,y:24,w:194,h:56,c:'net',t:'Network',s:'VCN and subnets',d:'Define the client and backup subnets and the DNS and security rules.',why:'It cannot easily be changed later.',chk:`$ nslookup scan.example.com`,see:[8,4,'Provisioning VM clusters and scaling']},
 {id:'vmc',x:465,y:24,w:194,h:56,c:'proc',t:'VM cluster',s:'cores and memory',d:'Create the VM cluster with the number of OCPUs/ECPUs, memory, local storage and the Grid version.',why:'It is the cluster your databases run in.',chk:`$ oci db cloud-vm-cluster create ...`,see:[8,4,'Provisioning VM clusters and scaling']},
 {id:'grid',x:20,y:136,w:139,h:56,c:'proc',t:'Grid and ASM',s:'created for you',d:'The service installs Grid Infrastructure and creates the ASM disk groups.',why:'You do not run the installer.',chk:`$ crsctl check cluster -all`,see:[8,4,'Provisioning VM clusters and scaling']},
 {id:'db',x:187,y:136,w:139,h:56,c:'proc',t:'Database',s:'create or migrate',d:'Create a new database home and database, or migrate one into the cluster.',why:'Choose the database version and options.',chk:`$ dbaascli database create --dbname ORCL ...`,see:[8,4,'Provisioning VM clusters and scaling']},
 {id:'scale',x:354,y:136,w:139,h:56,c:'mem',t:'Scale',s:'online',d:'Scale cores up and down as the workload changes.',why:'You pay for what you scale.',chk:`$ oci db cloud-vm-cluster update --cpu-core-count 16`,see:[8,4,'Provisioning VM clusters and scaling']},
 {id:'prot',x:521,y:136,w:139,h:56,c:'disk',t:'Backup and DR',s:'enable',d:'Enable automatic backups to object storage and a standby with Data Guard.',why:'Protection is configured, not assumed.',chk:`$ dbaascli database backup --status`,see:[8,5,'Backup and DR options in cloud Exadata']}],
 steps:[
 {ids:['infra','net'],t:'1. Select the infrastructure and prepare the network, DNS and security rules.',w:'These are the foundations.',s:'Shape, subnets, security lists.',x:'Subnet sizes that are too small for scaling.',c:`$ oci network subnet list --compartment-id ...`},
 {ids:['vmc','grid'],t:'2. Create the VM cluster with cores, memory and storage. The service builds the cluster and Grid Infrastructure.',w:'It is automated, and takes tens of minutes.',s:'Cores, memory, Grid version, storage allocation.',x:'Limits on cores or storage in the service quota.',c:`$ crsctl stat res -t`},
 {ids:['db'],t:'3. Create a database or migrate an existing one into the cluster.',w:'The database is the workload.',s:'`dbaascli`, console.',x:'Version and option mismatch with your licence.',c:`$ dbaascli database status --dbname ORCL`},
 {ids:['scale'],t:'4. Scale cores and storage as the load changes, without downtime.',w:'It matches cost to demand.',s:'Scaling limits, licence type.',x:'Scaling cores up without checking IORM and caging.',c:`SHOW PARAMETER cpu_count`},
 {ids:['prot'],t:'5. Enable backups and a standby, and test a restore. Record the settings.',w:'Protection is part of the deployment.',s:'Backup destination, retention, Data Guard.',x:'Backup configured and never restored.',c:`$ dbaascli database backup --status`}]}},

{h:'7. Migrating a database to Exadata'},
{map:{title:'Migration to Exadata map',h:216,trace:'Migrate to Exadata',
 hint:'Tap any box, or press Migrate to Exadata to follow the steps from assessment to a tuned database on the new platform.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'ass',x:20,y:24,w:139,h:56,c:'mem',t:'Assess',s:'workload and size',d:'Measure the current workload, size, and features in use.',why:'It sizes the target and finds incompatibilities.',chk:`SELECT ROUND(SUM(bytes)/1024/1024/1024) AS gb FROM dba_data_files;`,see:[9,0,'Migrating to Exadata: RMAN, Data Guard, GoldenGate and ZDM']},
 {id:'meth',x:187,y:24,w:139,h:56,c:'mem',t:'Choose method',s:'by downtime',d:'Pick RMAN, Data Guard, GoldenGate or ZDM from the downtime and platform.',why:'Same platform allows physical methods.',chk:`SELECT platform_name, endian_format FROM v$transportable_platform WHERE platform_name = (SELECT platform_name FROM v$database);`,see:[9,0,'Migrating to Exadata: RMAN, Data Guard, GoldenGate and ZDM']},
 {id:'mig',x:354,y:24,w:139,h:56,c:'proc',t:'Migrate',s:'copy and sync',d:'Build the copy on Exadata and keep it synchronised.',why:'The long work happens before the cutover.',chk:`DGMGRL> VALIDATE DATABASE exadata_stby;`,see:[9,0,'Migrating to Exadata: RMAN, Data Guard, GoldenGate and ZDM']},
 {id:'test',x:521,y:24,w:139,h:56,c:'mem',t:'Test',s:'with real workload',d:'Test the application and performance on the new platform.',why:'Plans can change on new hardware.',chk:`SELECT task_name, status FROM dba_advisor_tasks WHERE advisor_name = 'SQL Performance Analyzer';`,see:[9,4,'Troubleshooting method: offload, flash and I/O']},
 {id:'cut',x:20,y:136,w:139,h:56,c:'warn',t:'Cut over',s:'switchover',d:'Switch to Exadata in the planned window.',why:'The downtime is the switch.',chk:`DGMGRL> SWITCHOVER TO exadata_stby;`,see:[9,0,'Migrating to Exadata: RMAN, Data Guard, GoldenGate and ZDM']},
 {id:'tune',x:187,y:136,w:139,h:56,c:'proc',t:'Tune for Exadata',s:'offload and flash',d:'Check offload, flash use and remove indexes that were only there to avoid scans.',why:'Exadata favours some designs that conventional systems avoid.',chk:`SELECT name, value FROM v$sysstat WHERE name LIKE 'cell physical IO%';`,see:[9,2,'Index and compression strategy on Exadata']},
 {id:'idx',x:354,y:136,w:139,h:56,c:'mem',t:'Indexes and HCC',s:'review',d:'Review which indexes are needed, and consider HCC for suitable tables.',why:'Fewer indexes, less storage, faster loads.',chk:`SELECT index_name, visibility FROM dba_indexes WHERE owner = 'APP';`,see:[9,2,'Index and compression strategy on Exadata']},
 {id:'cons',x:521,y:136,w:139,h:56,c:'proc',t:'Consolidate',s:'multitenant and IORM',d:'Place databases as PDBs and protect them with IORM and caging.',why:'It is where the cost benefit is realised.',chk:`SELECT name, open_mode FROM v$pdbs;`,see:[9,1,'Consolidation with multitenant and IORM']}],
 steps:[
 {ids:['ass','meth'],t:'1. Assess the workload, size and features, then choose a migration method that fits the downtime limit.',w:'It is a plan and not a tool selection.',s:'AWR, feature usage.',x:'An endian difference removes the simple methods.',c:`SELECT * FROM v$database;`},
 {ids:['mig'],t:'2. Build the copy on Exadata and synchronise it until cutover, using RMAN, Data Guard or GoldenGate.',w:'The work is done while production runs.',s:'Method-specific.',x:'A copy that is not tested before the cutover.',c:`SELECT name, value FROM v$dataguard_stats;`},
 {ids:['test'],t:'3. Test with a real workload and compare plans and times. Fix regressions before the cutover.',w:'New hardware changes the optimizer environment.',s:'SPA, workload replay.',x:'Testing with a small dataset hides scan behaviour.',c:`SELECT sql_id, plan_hash_value FROM v$sql ORDER BY elapsed_time DESC FETCH FIRST 5 ROWS ONLY;`},
 {ids:['cut'],t:'4. Cut over in the window and watch the system. Keep the source for a defined fallback period.',w:'It keeps the way back.',s:'Switchover or GoldenGate cutover.',x:'Leaving the source writable invites a split brain.',c:`DGMGRL> SWITCHOVER TO exadata_stby;`},
 {ids:['tune','idx'],t:'5. Tune for the platform: confirm offload, review indexes and compression.',w:'The gains come from using the platform features.',s:'Offload statistics, HCC.',x:'Moving a design built for a conventional system unchanged.',c:`SELECT name, value FROM v$sysstat WHERE name LIKE 'cell physical IO%';`},
 {ids:['cons'],t:'6. Consolidate: move other databases in as PDBs and set IORM and caging to protect each tenant.',w:'This is the long-term benefit.',s:'CDB design, resource plans.',x:'Consolidating without resource limits.',c:`SELECT con_id, name FROM v$pdbs;`}]}},

]},

/* 1 ---------------------------------------------------------------- components */
{t:'Components and services',d:'What runs on database servers, storage servers and the fabric, and where to look.',see:[[0,3,'The three layers'],[2,0,'CELLSRV, MS and RS']],b:[
{t:[['Component','Where','Job','Tool'],
['Database server (compute node)','Rack','Runs Oracle Grid Infrastructure and database instances','`dbmcli`, `dcli`, ILOM'],
['Storage server (cell)','Rack','Serves ASM storage with intelligence (offload, flash cache)','`cellcli`, `exacli`'],
['CELLSRV','Cell','Main storage service: I/O, Smart Scan, flash','`cellcli -e list cell detail`'],
['MS (Management Server)','Cell and DB server','Monitoring, alerts, configuration, metrics','`cellcli`, `dbmcli`'],
['RS (Restart Server)','Cell and DB server','Restarts CELLSRV and MS if they fail','`service celld status`'],
['ASM on database servers','DB server','Discovers cell disks over the fabric','`asmcmd lsdg`'],
['RDMA network fabric (RoCE)','Switches','Low-latency server to storage and RAC interconnect','Switch CLI'],
['ILOM','Every server','Out-of-band management and console','`ssh <host>-ilom`'],
['Management and client networks','Rack','Admin, backup and application traffic','OS tools'],
['Exascale services [26ai-era]','Storage and DB servers','Vaults, storage pools, volumes decoupled from compute','Exascale CLI (`escli`)']]},
{note:'On a RoCE system the same fabric carries storage traffic and the RAC interconnect. Older generations used InfiniBand.'}
]},

/* 2 ---------------------------------------------------------------- disk objects */
{t:'Storage objects and hierarchy',d:'How a physical disk becomes an ASM disk, and where flash is used.',see:[[2,1,'Physical, cell and grid disks'],[2,2,'Flash']],b:[
{t:[['Object','Name pattern','Created by','Meaning'],
['Physical disk','`<slot>`, `FLASH_*`','Hardware','Hard disk, flash card'],
['LUN','`0_0`','Cell (auto)','OS device for a physical disk'],
['Cell disk','`CD_00_<cell>`, `FD_00_<cell>`','`CREATE CELLDISK`','Cell-managed storage on a LUN (hard disk or flash)'],
['Grid disk','`DATA_CD_00_<cell>`','`CREATE GRIDDISK`','Slice of a cell disk presented to ASM'],
['ASM disk','`o/<IP>;<IP>/DATA_CD_00_<cell>`','ASM','Grid disk as an ASM member'],
['Flash cache','`<cell>_FLASHCACHE`','`CREATE FLASHCACHE`','Smart Flash Cache on flash cell disks'],
['Flash log','`<cell>_FLASHLOG`','`CREATE FLASHLOG`','Redo write latency reduction'],
['PMEM cache / log (X8M, X9M)','`<cell>_PMEMCACHE`','`CREATE PMEMCACHE`','Persistent memory tier (not on every generation)'],
['Disk group','`DATA`, `RECO`, `SPARSE`','ASM','Set of grid disks across cells'],
['Failure group','One per cell','ASM','Mirrors never in the same cell']]},
{code:`cellcli -e list celldisk attributes name,status,size,diskType
cellcli -e list griddisk attributes name,asmDiskGroupName,status,asmModeStatus,asmDeactivationOutcome
cellcli -e list flashcache detail
cellcli -e list flashlog detail`},
{note:'Generations differ: X10M and X11M do not use persistent memory in the same way as X8M and X9M. Check your hardware in the release documentation.'}
]},

/* 3 ---------------------------------------------------------------- logs */
{t:'Log files and where to find them',d:'Cell, database server, patching and health-check logs.',see:[[2,5,'Cell metrics and alerts'],[6,3,'EXAchk and AHF']],b:[
{t:[['Log or view','Contains','Where'],
['Cell alert log','CELLSRV, hardware, disk, flash events','`/opt/oracle/cell/log/diag/asm/cell/<host>/trace/alert.log` (`$CELLTRACE`)'],
['Alert history','Alerts raised by MS','`cellcli -e list alerthistory`'],
['Cell trace files','Detail for incidents','`$CELLTRACE`'],
['MS and RS logs','Management Server and Restart Server','`/opt/oracle/cell/log/diag/...`'],
['Database server alerts','DB node hardware and software alerts','`dbmcli -e list alerthistory`'],
['ILOM event log','Hardware events','ILOM web or CLI `show /SP/logs/event/list`'],
['`/var/log/messages`','OS events','Each server'],
['Patch logs','`patchmgr` and `dbnodeupdate` output','Directory of the patch plus `patchmgr.log`'],
['EXAchk / AHF output','Health and best practice report','`/opt/oracle.ahf/data/<host>/exachk/` or the output directory'],
['ASM alert log','Disk group and offline events','`$ORACLE_BASE/diag/asm/+asm/...`'],
['Database alert log','Instance events, offload messages','ADR `trace`']]},
{code:`dcli -g cell_group -l root "cellcli -e list alerthistory where severity=critical"
dcli -g cell_group -l root "cellcli -e list metriccurrent where name like 'CL_.*'"`}
]},

/* 4 ---------------------------------------------------------------- settings */
{t:'Important settings',d:'Database, ASM and cell settings that matter for Exadata.',see:[[3,0,'Smart Scan'],[4,0,'Disk group design']],b:[
{h:'Database parameters'},
{t:[['Parameter','Default','Note'],
['`cell_offload_processing`','`TRUE`','`FALSE` disables Smart Scan'],
['`cell_offload_plan_display`','`AUTO`','Shows `STORAGE` predicates in plans'],
['`cell_offload_decryption`','`TRUE`','Decrypt in cells for offload'],
['`use_large_pages`','`ONLY` recommended','HugePages for the SGA'],
['`parallel_degree_policy`','`MANUAL` or `AUTO`','Auto DOP can help scan-heavy workloads'],
['`db_create_file_dest`','`+DATA`','ASM destination'],
['`db_recovery_file_dest`','`+RECO`','FRA'],
['`inmemory_size`','0','In-Memory (licensed) works with Exadata'],
['`compatible`','Release','Often constrained by ASM `compatible`']]},
{h:'ASM disk group attributes'},
{t:[['Attribute','Meaning'],
['`compatible.asm`, `compatible.rdbms`','Feature level'],
['`cell.smart_scan_capable`','`TRUE` for Smart Scan'],
['`au_size`','Typically 4 MB (set at creation)'],
['`disk_repair_time`','Time a failed disk is kept offline before drop'],
['`content.type`','Failure placement hint']]},
{h:'Cell attributes (list with `LIST CELL DETAIL`)'},
{t:[['Attribute','Meaning'],
['`flashCacheMode`','`writeback` or `writethrough`'],
['`interconnect1`, `interconnect2`','Fabric ports'],
['`iormPlan`','Active IORM plan (see `LIST IORMPLAN`)'],
['`smtpServer`, `snmpSubscriber`','Alert notification targets'],
['`hardDiskScrubInterval`','Disk scrub frequency']]},
{note:'Always read an attribute with `LIST CELL DETAIL` or `LIST GRIDDISK DETAIL` before you change it, and change on one cell first.'}
]},

/* 5 ---------------------------------------------------------------- views / statistics */
{t:'Views and offload statistics',d:'The views and statistics that prove a query is offloaded and how well.',see:[[3,7,'Verifying offload'],[3,0,'Smart Scan']],b:[
{t:[['Question','View or statistic'],
['Which cells does the database see?','`V$CELL`, `V$CELL_CONFIG`'],
['Cell state and threads','`V$CELL_STATE`, `V$CELL_THREAD_HISTORY`'],
['ASM disks from cells','`V$ASM_DISK`, `V$ASM_DISKGROUP`'],
['Offload eligible bytes for a SQL','`V$SQL.IO_CELL_OFFLOAD_ELIGIBLE_BYTES`'],
['Bytes returned by the cell','`V$SQL.IO_INTERCONNECT_BYTES`, `IO_CELL_OFFLOAD_RETURNED_BYTES`'],
['Instance statistic for eligible bytes','`cell physical IO bytes eligible for predicate offload`'],
['Bytes sent over interconnect','`cell physical IO interconnect bytes`, `... returned by smart scan`'],
['Storage index saving','`cell physical IO bytes saved by storage index`'],
['Flash cache hits','`cell flash cache read hits`, `physical read requests optimized`'],
['Smart scan and wait events','`cell smart table scan`, `cell smart index scan`, `cell single block physical read`'],
['SQL Monitor offload info','Real-Time SQL Monitoring report (Tuning Pack)'],
['Cluster-wide Exadata statistics','`GV$SYSSTAT`, AWR Exadata section']]},
{code:`-- offload efficiency of top SQL
SELECT sql_id,
       ROUND(io_cell_offload_eligible_bytes/1048576) eligible_mb,
       ROUND(io_interconnect_bytes/1048576) interconnect_mb,
       ROUND(100*(io_cell_offload_eligible_bytes - io_interconnect_bytes)/NULLIF(io_cell_offload_eligible_bytes,0)) pct_saved
FROM v$sql WHERE io_cell_offload_eligible_bytes > 0 ORDER BY io_cell_offload_eligible_bytes DESC FETCH FIRST 10 ROWS ONLY;`}
]},

/* 6 ---------------------------------------------------------------- tools */
{t:'Command-line tools',d:'The tools you use on cells and database servers, with typical commands.',see:[[2,4,'CellCLI, dcli and exacli'],[6,0,'Administration tools']],b:[
{t:[['Tool','Where','Use','Typical command'],
['`cellcli`','Cell','Configure and monitor the cell','`cellcli -e list cell detail`'],
['`dbmcli`','DB server','Same for database server components','`dbmcli -e list dbserver detail`'],
['`dcli`','Anywhere','Run a command on many servers','`dcli -g cell_group -l root "uptime"`'],
['`exacli`','Remote','Run CellCLI remotely over HTTPS','`exacli -c celadm01 -l admin -e "list cell"`'],
['`imageinfo`, `imagehistory`','Cell, DB server','Show software version and history','`imageinfo`'],
['`patchmgr`','Patching host','Patch cells and switches (rolling or not)','`patchmgr -cells cell_group -patch_check_prereq`'],
['`dbnodeupdate.sh`','DB server','Patch database server OS and image','`dbnodeupdate.sh -u -l <zip>`'],
['`opatchauto`','DB server','Patch GI and database homes','`opatchauto apply <dir>`'],
['`exachk` / `ahfctl`','DB server','Health and best practice checks','`exachk -a`'],
['`asmcmd`','DB server','ASM view','`asmcmd lsdg`'],
['`ibstatus`, `ibhosts`','DB server (InfiniBand systems only)','Fabric status','Only on InfiniBand generations'],
['`ipconf`, `ipmitool`, `ilom`','Servers','Network and ILOM configuration','Per documentation'],
['`escli`','Exascale','Manage vaults and volumes [Exascale]','Per Exascale documentation']]},
{h:'Handy CellCLI'},
{code:`cellcli -e list cell attributes name,status,flashCacheMode
cellcli -e list physicaldisk attributes name,status,diskType
cellcli -e list griddisk attributes name,status,asmModeStatus
cellcli -e list iormplan detail
cellcli -e list metriccurrent attributes name,metricObjectName,metricValue where name = 'CD_IO_TM_R_SM'`}
]},

/* 7 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'Choosing a model, a disk group layout, a compression level and a patching order.',see:[[1,1,'Storage servers: HC, EF, XT'],[7,1,'Patch order']],b:[
{h:'Storage server type'},
{t:[['Type','Media','Use'],
['High Capacity (HC)','Hard disks plus flash cache','Mixed workloads, large capacity'],
['Extreme Flash (EF)','All flash','Highest I/O and low latency'],
['Extended (XT)','Hard disks, lower cost, no flash cache','Archive, backups, low-cost capacity']]},
{h:'Disk group layout'},
{t:[['Disk group','Content','Note'],
['`DATA`','Datafiles, online redo','Usually larger share'],
['`RECO`','FRA: backups, archived logs','Separate failure domain from DATA'],
['`SPARSE`','Snapshot clones (sparse)','Test and dev clones'],
['`DBFS`/`CRS`','Clusterware files','Small, high redundancy']]},
{h:'Hybrid Columnar Compression'},
{t:[['Level','Use'],
['`QUERY LOW`','Warehouse data, fast queries'],
['`QUERY HIGH`','Warehouse, better ratio'],
['`ARCHIVE LOW`','Rarely read data'],
['`ARCHIVE HIGH`','Cold archive']]},
{h:'Patch order (full stack, typical)'},
{t:[['Order','Component'],
['1','Check prerequisites and take backups'],
['2','Storage servers (`patchmgr`, rolling if redundancy allows)'],
['3','InfiniBand or RoCE switches (`patchmgr`)'],
['4','Database server OS and firmware (`dbnodeupdate.sh`, rolling)'],
['5','Grid Infrastructure and database homes (`opatchauto`, rolling)'],
['6','Datapatch and verification']]},
{note:'Follow the patch README and the Exadata compatibility matrix (MOS Doc ID 888828.1). The order above is the general pattern, not a replacement.'}
]},

/* 8 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, likely cause and fix.',see:[[9,4,'Troubleshooting method'],[3,8,'Prove offload and explain why not']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['Query not offloaded','Plan has `TABLE ACCESS STORAGE FULL`? `cell_offload_processing`','Serial direct read not chosen, small table, buffer cache hit','Use parallel or direct path, check object size'],
['Offload but little saving','`cell physical IO interconnect bytes` close to eligible','Predicates not offloadable, all columns selected','Rewrite predicates, select fewer columns'],
['Slow after cell restart','Flash cache warm-up','Cache was empty','Wait or pre-warm with workload'],
['Disk failed','`cellcli list physicaldisk`, ASM alert','Disk hardware failure','Replace, ASM rebalances'],
['Griddisk offline','`list griddisk attributes status,asmModeStatus`','Cell reboot, failure','Wait for `ONLINE`, check rebalance'],
['Cannot offline cell for patch','`asmDeactivationOutcome`','Disk group would lose data','Wait for resync or fix failures'],
['High `cell single block physical read`','Metrics `CD_IO_TM_R_SM`','Disk latency or overload','Check IORM, flash, workload'],
['Storage index not helping','Statistic `bytes saved by storage index`','Unsorted data, many columns','Sort or cluster data on load'],
['IORM limits one database too hard','`list iormplan`','Plan shares or limits','Adjust directives'],
['Patch prereq fails','`patchmgr` output','Version, free space, SSH keys','Fix per message']]}
]},

/* 9 ---------------------------------------------------------------- errors */
{t:'Common messages',d:'Messages seen on Exadata and what they usually mean. Exact texts vary by software version.',see:[[2,5,'Cell metrics and alerts'],[9,4,'Troubleshooting method']],b:[
{t:[['Message or state','Meaning','Action'],
['`ORA-27626: Exadata error`','Error returned from the cell on I/O','Read the code after it and the cell alert log'],
['`ORA-15042 ASM disk missing`','Disk or grid disk not available','Check cell and griddisk status'],
['`ORA-15075`, `ORA-15040`','Disks not visible or incomplete disk group','Check discovery, cell services'],
['`ORA-00600 [kcfis...]`','Internal Smart Scan layer error','Collect trace, open Service Request'],
['`asmModeStatus = SYNCING`','Disk is resyncing','Wait. Do not take down another cell.'],
['`asmModeStatus = OFFLINE`','Disk offline in ASM','Check cause, bring online'],
['`asmDeactivationOutcome = Yes`','Safe to stop cell services','Proceed with patch or maintenance'],
['`asmDeactivationOutcome` is an error text','Not safe to stop','Resolve before continuing'],
['`physicaldisk status = critical / failed`','Hard disk fault','Replace the disk'],
['`Cell offline` in alert','Cell unreachable','Check fabric, power, ILOM'],
['`Flash cache disabled`','Flash cache creation or failure','`cellcli -e create flashcache all`, check hardware'],
['`patchmgr` precheck failures','Version, space or SSH','Fix and rerun precheck']]},
{note:'For cell messages use `cellcli -e list alertdefinition` and the Exadata Alert reference for your release. Do not guess at error codes.'}
]},

/* 10 ---------------------------------------------------------------- health check */
{t:'Health-check pack',d:'Commands for a daily and weekly Exadata check.',see:[[6,1,'Monitoring and thresholds'],[6,3,'EXAchk and AHF']],b:[
{h:'On storage servers (via dcli)'},
{code:`dcli -g cell_group -l root "cellcli -e list cell attributes name,status,flashCacheMode"
dcli -g cell_group -l root "cellcli -e list physicaldisk attributes name,status | grep -v normal"
dcli -g cell_group -l root "cellcli -e list griddisk attributes name,status,asmModeStatus | grep -v ONLINE"
dcli -g cell_group -l root "cellcli -e list alerthistory where severity=critical and examinedBy=''"
dcli -g cell_group -l root "imageinfo | grep -i 'Active image version'"`},
{h:'On database servers'},
{code:`dcli -g dbs_group -l root "imageinfo | grep -i 'Image version'"
dcli -g dbs_group -l root "dbmcli -e list dbserver attributes name,status"
exachk -a`},
{h:'ASM and databases'},
{code:`SELECT name, state, total_mb, free_mb, usable_file_mb, offline_disks FROM v$asm_diskgroup;
SELECT group_number, operation, state, power, est_minutes FROM v$asm_operation;
SELECT cell_name FROM v$cell;
SELECT name, value FROM v$sysstat WHERE name LIKE 'cell physical IO%' ORDER BY name;`},
{h:'Capacity'},
{code:`SELECT name, ROUND(100*(total_mb-free_mb)/total_mb) pct_used FROM v$asm_diskgroup;`}
]},

/* 11 ---------------------------------------------------------------- naming */
{t:'Naming decoder',d:'How hosts, disks, models and software versions are named.',see:[[0,2,'Generations and naming'],[2,1,'Cell and grid disks']],b:[
{t:[['Name','Meaning'],
['`X9M-2`, `X10M-2`, `X11M`','Hardware generation and database server socket count (Exadata X9M and later)'],
['`dbadm01`, `celadm01`','Typical host names (customer-defined): database server and cell (admin names)'],
['`dbadm01-ilom`','ILOM of that server'],
['`CD_00_celadm01`','Cell disk 00 on cell celadm01'],
['`FD_00_celadm01`','Flash cell disk'],
['`DATA_CD_00_celadm01`','Grid disk of the DATA group on cell disk 00'],
['`o/192.168.10.3;192.168.10.4/DATA_CD_00_celadm01`','ASM disk path: cell IPs, grid disk'],
['Exadata System Software','`24.1.x`, `25.1.x` style numbers: version indicates year and release'],
['`HC`, `EF`, `XT`','High Capacity, Extreme Flash, Extended'],
['`ExaDB-D`','Exadata Database Service on Dedicated Infrastructure (OCI)'],
['`ExaDB-XS`','Exadata Database Service on Exascale Infrastructure'],
['`ExaC@C`','Exadata Cloud@Customer'],
['IORM','I/O Resource Management plan on cells'],
['RoCE','RDMA over Converged Ethernet (current fabric)'],
['Smart Scan, Smart Flash Cache, Smart Flash Log','Exadata features: offload, caching, log acceleration']]}
]},

/* 12 ---------------------------------------------------------------- cloud / exascale */
{t:'Deployments and Exascale',d:'Where Exadata runs and how Exascale differs from classic ASM on cells.',see:[[8,0,'Exadata in the cloud'],[5,0,'Why Exascale']],b:[
{t:[['Deployment','Who runs the hardware','You manage'],
['On-premises','You','Everything above the rack firmware'],
['Cloud@Customer','Oracle, in your data center','Databases, VM clusters, network'],
['Exadata Database Service (Dedicated)','Oracle, in OCI','VM clusters, databases'],
['Exadata Database Service (Exascale)','Oracle, in OCI','Databases only; storage vaults'],
['Multicloud (Azure, AWS, Google Cloud)','Oracle hardware in partner data centers','Databases and networking']]},
{h:'Exascale vs classic'},
{t:[['','Classic (ASM on grid disks)','Exascale'],
['Storage model','Fixed disk groups on grid disks','Vaults and storage pools with volumes'],
['Provisioning','Plan disk groups','Request storage, elastic'],
['Cloning','Sparse disk groups','Thin clones and PDB snapshots'],
['Compute and storage','Tied to the rack','Decoupled']]},
{note:'Exascale details and feature support vary by service and release. Use the service documentation for current limits.'}
]}

]};
