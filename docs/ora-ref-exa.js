/* LearnSphere - Exadata Quick Reference (cheat sheet).
   window.QREF['ora-exa'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Exadata System Software versions and hardware generations change often. Commands and attribute names shown are the common ones:
   confirm in the Exadata documentation and with `help` in CellCLI for your software release. 26ai and Exascale items are marked. */
window.QREF=window.QREF||{};
window.QREF['ora-exa']={title:'Exadata Quick Reference',blurb:'Cell software, disk hierarchy, offload statistics, tools, patching and fixes on one page each.',hint:'cellcli or smart scan',pages:[

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
