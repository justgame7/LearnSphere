/* LearnSphere - Grid Infrastructure, ASM & RAC Quick Reference (cheat sheet).
   window.QREF['ora-rac'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Values are for Oracle Grid Infrastructure and RAC 19c on Linux unless stated; 26ai differences are marked [26ai].
   Command output differs slightly by release. Check the Clusterware and RAC guides for your release. */
window.QREF=window.QREF||{};
window.QREF['ora-rac']={title:'Grid Infrastructure, ASM & RAC Quick Reference',blurb:'Clusterware stack, ASM, RAC processes, files, logs, commands and fixes on one page each.',hint:'crsctl or asm',pages:[

/* 1 ---------------------------------------------------------------- processes */
{t:'Clusterware, ASM and RAC processes',d:'The daemons on each node, who starts whom and where to look when one misbehaves.',see:[[2,0,'The Clusterware stack'],[5,2,'GCS and GES']],b:[
{h:'Clusterware stack'},
{t:[['Daemon','Layer','Job','Look here'],
['`ohasd`','Lower stack','Oracle High Availability Services: starts the whole stack at boot, root-owned','`crsctl check has`, `ohasd.log`'],
['`orarootagent`, `oraagent`','Both','Agents that start and monitor resources as root and as the software owner','Agent logs'],
['`cssd`, `cssdagent`, `cssdmonitor`','Lower','Cluster Synchronization Services: node membership, voting files, heartbeats','`ocssd.trc`'],
['`gpnpd`','Lower','Grid Plug and Play profile','`gpnpd.trc`'],
['`mdnsd`','Lower','Multicast DNS name resolution','`mdnsd.trc`'],
['`gipcd`','Lower','Grid IPC, interconnect messaging','`gipcd.trc`'],
['`octssd`','Lower','Cluster Time Synchronization (observer or active)','`octssd.trc`'],
['`evmd`','Upper','Event manager, publishes cluster events','`evmd.trc`'],
['`crsd`','Upper','Cluster Ready Services: manages resources (databases, services, VIPs, SCAN)','`crsd.trc`'],
['`ons`','Upper','Oracle Notification Service for FAN events','`ons.log`'],
['`tnslsnr`','Upper','Node and SCAN listeners','listener logs'],
['`asm_*`','Upper','ASM instance background processes','ASM alert log']]},
{h:'RAC instance processes'},
{t:[['Process','Job'],
['LMON','Global enqueue service monitor, membership of instances'],
['LMD','Global enqueue service daemon (lock requests)'],
['LMSn','Global cache service: ships blocks between instances (Cache Fusion)'],
['LCK0','Instance enqueue process for non-Cache Fusion resources'],
['DIAG, DIA0','Diagnostics across instances'],
['RMSn, LGWR, DBWn and the usual set','As on a single instance']]},
{note:'Lower stack runs as root and starts first. The upper stack (CRSD) needs the shared storage and the voting files to be available.'}
]},

/* 2 ---------------------------------------------------------------- files */
{t:'Files and what they hold',d:'The cluster-wide and node-local files you must know and how to back them up.',see:[[2,1,'Voting files and OCR'],[2,2,'GPnP and the profile']],b:[
{t:[['File','Holds','Where','Backup'],
['OCR (Oracle Cluster Registry)','Cluster configuration: resources, nodes, databases, services','ASM disk group (often `+CRS` or `+DATA`)','Automatic every 4 hours, plus `ocrconfig -manualbackup`'],
['Voting files','Node membership heartbeats on disk','ASM disk group (odd number of copies)','Included with the disk group metadata; restore via `crsctl`'],
['OLR (Oracle Local Registry)','Local node resource info for the lower stack','`$GRID_HOME/cdata/<host>.olr`, see `/etc/oracle/olr.loc`','`ocrconfig -local -manualbackup`'],
['GPnP profile','Cluster name, networks, ASM discovery string, voting location','`$GRID_HOME/gpnp/<host>/profiles/peer/profile.xml`','Copy kept on each node'],
['ASM SPFILE','ASM parameters','In ASM (`+CRS`)','Part of OCR backup scope with `asmcmd spget`'],
['ASM password file','Administrative users for ASM','In ASM or on shared storage','`asmcmd pwget`'],
['Database SPFILE, control files, redo, datafiles','Shared database','ASM disk groups','RMAN'],
['`/etc/oratab`','Local homes and `+ASM1`, database SIDs','Each node','OS backup'],
['`$GRID_HOME`','Grid Infrastructure software','Local disk (or ACFS in some designs)','Gold image'],
['`$ORACLE_BASE/diag/crs/<host>`','Cluster logs and traces','Local','Logs']]},
{code:`ocrcheck
ocrcheck -local
ocrconfig -showbackup
crsctl query css votedisk
asmcmd spget
asmcmd pwget --asm`}
]},

/* 3 ---------------------------------------------------------------- logs */
{t:'Log files and where to find them',d:'Where each daemon and each tool writes, and the tool that collects them.',see:[[8,4,'Cluster logs, TFA and AHF'],[2,5,'Startup sequence and log locations']],b:[
{t:[['Log','Contents','Location'],
['Clusterware alert','Main cluster event log: start, stop, evictions','`$ORACLE_BASE/diag/crs/<host>/crs/trace/alert.log`'],
['CSS','Heartbeat, membership, eviction details','`.../crs/trace/ocssd.trc`'],
['CRS','Resource start, stop, failures','`.../crs/trace/crsd.trc`'],
['EVM','Cluster events','`.../crs/trace/evmd.trc`'],
['OHASD','Lower stack start-up','`.../crs/trace/ohasd.trc`'],
['Agents','Resource agent actions','`.../crs/trace/crsd_oraagent_<user>.trc`'],
['ASM alert','Disk group mount, rebalance, errors','`$ORACLE_BASE/diag/asm/+asm/+ASM1/trace/alert_+ASM1.log`'],
['Database alert','Instance events, GCS errors','`.../diag/rdbms/<db>/<SID>/trace/alert_<SID>.log`'],
['Listener and SCAN listener','Connections and services','`.../diag/tnslsnr/<host>/<listener>/trace/`'],
['Install and root script logs','`gridSetup`, `root.sh`','`oraInventory/logs`, `$GRID_HOME/install`'],
['Cluster Health Advisor','Model diagnoses','`chactl` output'],
['AHF / TFA collections','Diagnostic bundles','`tfactl diagcollect`']]},
{code:`# the cluster alert, last lines
tail -100 $ORACLE_BASE/diag/crs/$(hostname -s)/crs/trace/alert.log

# collect everything for a Service Request
tfactl diagcollect -since 4h
ahfctl compliance`}
]},

/* 4 ---------------------------------------------------------------- parameters */
{t:'Important parameters',d:'RAC database parameters, ASM parameters and key disk group attributes.',see:[[6,2,'Shared and instance-specific parameters'],[4,5,'Disk group attributes']],b:[
{h:'RAC database'},
{t:[['Parameter','Scope','Note'],
['`cluster_database`','Shared','`TRUE` for RAC'],
['`cluster_database_instances`','Shared','Number of instances'],
['`instance_number`, `thread`','Per instance','Unique per instance'],
['`instance_name`','Per instance','`ORCL1`, `ORCL2`'],
['`undo_tablespace`','Per instance','One undo tablespace per instance'],
['`local_listener`','Per instance','Node VIP listener'],
['`remote_listener`','Shared','SCAN name and port'],
['`cluster_interconnects`','Per instance','Only to override the default interconnect'],
['`gcs_server_processes`','Shared','LMS process count'],
['`parallel_force_local`','Shared','Keep parallel slaves on one instance'],
['`db_unique_name`, `service_names`','Shared','Use services, not this parameter']]},
{h:'ASM instance'},
{t:[['Parameter','Typical','Note'],
['`instance_type`','`ASM`','Fixed'],
['`asm_diskstring`','`/dev/oracleasm/*` or `AFD:*`','Where to find disks'],
['`asm_diskgroups`','Auto','Disk groups to mount at start'],
['`asm_power_limit`','1','Default rebalance power (1 to 1024)'],
['`asm_preferred_read_failure_groups`','Unset','Read from local failure group (stretch clusters)'],
['`sga_target`, `memory_target`','Check sizing for your release','Small, but not too small']]},
{h:'Disk group attributes'},
{t:[['Attribute','Meaning'],
['`compatible.asm`, `compatible.rdbms`','Feature level; raise only as needed (one way)'],
['`au_size`','Allocation unit size (fixed at creation)'],
['`disk_repair_time`','How long a failed disk may be offline before drop (default 3.6 h)'],
['`content.type`','`DATA`, `RECOVERY`, `SYSTEM` for failure group placement'],
['`cell.smart_scan_capable`','Exadata storage offload']]}
]},

/* 5 ---------------------------------------------------------------- views */
{t:'System views',d:'Which view answers which cluster or ASM question. GV$ views span all instances.',see:[[5,1,'Instances, threads, redo and undo'],[4,6,'ASMCMD and SQL*Plus administration']],b:[
{t:[['Question','View or command'],
['Which instances are up?','`GV$INSTANCE`'],
['Cluster-wide sessions','`GV$SESSION`'],
['Interconnect in use?','`V$CLUSTER_INTERCONNECTS`, `GV$CLUSTER_INTERCONNECTS`'],
['Which services are active?','`GV$ACTIVE_SERVICES`, `DBA_SERVICES`'],
['Global cache activity','`GV$CR_BLOCK_SERVER`, `GV$CURRENT_BLOCK_SERVER`, `GV$GC_ELEMENT`'],
['Global enqueues','`GV$GES_ENQUEUE`, `GV$GES_BLOCKING_ENQUEUE`'],
['Wait events across nodes','`GV$SYSTEM_EVENT`, `GV$ACTIVE_SESSION_HISTORY`'],
['Which disk groups?','`V$ASM_DISKGROUP`, `V$ASM_DISKGROUP_STAT`'],
['Which disks?','`V$ASM_DISK`, `V$ASM_DISK_STAT`'],
['Rebalance progress','`V$ASM_OPERATION`'],
['Clients of ASM','`V$ASM_CLIENT`'],
['Disk group attributes','`V$ASM_ATTRIBUTE`'],
['Files in ASM','`V$ASM_FILE`, `V$ASM_ALIAS`'],
['Templates and redundancy','`V$ASM_TEMPLATE`'],
['Global enqueue statistics','`GV$GES_STATISTICS`'],
['Cluster resources from the OS','`crsctl stat res -t`']]},
{note:'Always add `inst_id` to GV$ output. An interpretation without the instance is a guess.'}
]},

/* 6 ---------------------------------------------------------------- tools */
{t:'Command-line tools',d:'The cluster tools you use daily and a typical command for each.',see:[[8,0,'crsctl, ocrcheck, ocrconfig'],[6,1,'srvctl']],b:[
{t:[['Tool','Use','Typical command'],
['`crsctl`','Control the clusterware stack and resources','`crsctl check cluster -all`'],
['`crsctl stat res -t`','All resources in a table','`crsctl stat res -t`'],
['`crsctl stop/start crs`','Stop or start the stack on a node (as root)','`crsctl stop crs`'],
['`srvctl`','Manage databases, instances, services, listeners, SCAN, ASM','`srvctl status database -db orcl -v`'],
['`olsnodes`','List nodes','`olsnodes -n -i -s -t`'],
['`ocrcheck`, `ocrconfig`','OCR integrity, backups, restore','`ocrcheck`; `ocrconfig -showbackup`'],
['`oifcfg`','Network interfaces for the cluster','`oifcfg getif`'],
['`cluvfy`','Verify prerequisites and health','`cluvfy stage -pre crsinst -n n1,n2`'],
['`asmcmd`','ASM file and disk group commands','`asmcmd lsdg`, `asmcmd lsdsk`'],
['`asmca`','ASM GUI and silent mode','`asmca -silent -createDiskGroup ...`'],
['`gridSetup.sh`','Grid Infrastructure installer','`./gridSetup.sh -silent -responseFile ...`'],
['`tfactl` / `ahfctl`','Trace File Analyzer, AHF','`tfactl diagcollect`'],
['`chactl`','Cluster Health Advisor','`chactl query diagnosis`'],
['`opatchauto`','Patch GI and database homes, rolling','`opatchauto apply <patch dir>`'],
['`dbca`','Create and configure RAC databases','`dbca -silent -createDatabase ...`']]},
{h:'The commands you will type most'},
{code:`crsctl check cluster -all
crsctl stat res -t
srvctl status database -db orcl
srvctl status service -db orcl
srvctl config scan
olsnodes -n -s
asmcmd lsdg
ocrcheck`}
]},

/* 7 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'ASM redundancy, service design, failover technology and patching approach.',see:[[4,1,'Redundancy'],[7,3,'FCF and TAF']],b:[
{h:'ASM redundancy'},
{t:[['Type','Copies','Use'],
['External','1 (storage provides protection)','Enterprise arrays with RAID'],
['Normal','2 (mirrored)','Default for local disks and JBOD'],
['High','3','Critical data, stretch clusters'],
['Flex / Extended','Per file group','Multiple databases with different needs']]},
{h:'Failover technology'},
{t:[['Technology','What it does','Use'],
['FAN / ONS','Notifies clients of up and down events','Always on'],
['Fast Connection Failover','Pool reconnects on FAN events','Java and OCI pools'],
['TAF','Reconnects, optionally replays SELECT','Legacy, simple apps'],
['Application Continuity','Replays in-flight work transparently','Preferred for supported drivers'],
['Transparent Application Continuity','Same, with less application change','Newer releases'],
['Service drain','Moves sessions gracefully before maintenance','Planned work']]},
{h:'Patching approach'},
{t:[['Approach','Outage','Use'],
['Rolling `opatchauto`','None for service','Standard for GI and RU'],
['Out-of-place switch home','Short per node','Preferred for production'],
['Non-rolling','Whole cluster','Only if the patch requires it'],
['Standby first','Switchover only','With Data Guard']]},
{h:'Instance caging vs services vs preferred nodes'},
{t:[['Goal','Use'],
['Workload isolation','Separate services, preferred and available instances'],
['Limit CPU per instance','Instance caging (`cpu_count` and Resource Manager)'],
['Keep a batch on one node','Singleton service on one preferred instance']]}
]},

/* 8 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, likely cause and fix.',see:[[8,6,'A troubleshooting method'],[8,2,'Node eviction']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['Node evicted or rebooted','CRS alert log, `ocssd.trc`, OS logs','Missed network heartbeat or disk heartbeat, node hang','Fix interconnect or storage; see eviction notes'],
['CRS will not start','`crsctl check has`, `ohasd.log`, `crsctl check crs`','Storage or voting files unreachable, time, GPnP','Fix storage, start lower stack then upper'],
['Instance will not start on one node','Database and ASM alert logs','ASM not up, SPFILE path, permissions','Start ASM, check `srvctl config`'],
['Disk group will not mount','ASM alert log','Missing disk, wrong `asm_diskstring`','Fix discovery, `ALTER DISKGROUP ... MOUNT`'],
['Slow `gc` waits','`GV$SYSTEM_EVENT`, interconnect','Slow or busy interconnect, hot blocks','Check network, packet loss, jumbo frames, application affinity'],
['Services not on expected node','`srvctl status service`','Preferred instance down or manual relocation','`srvctl relocate service`'],
['Client cannot connect via SCAN','`srvctl status scan_listener`, DNS','SCAN listener or DNS problem','Check DNS round robin, listener'],
['VIP not failing over','`crsctl stat res -t`','Network resource offline','Fix network, `srvctl start vip`'],
['Rebalance very slow','`V$ASM_OPERATION`','Low power limit','Raise `asm_power_limit` for a while'],
['Patch rollback needed','`opatchauto rollback`','Failed or wrong patch','Roll back per README'],
['Time drift between nodes','`crsctl check ctss`, `chronyc tracking`','NTP or chrony down','Fix time sync']]}
]},

/* 9 ---------------------------------------------------------------- errors */
{t:'Common error messages',d:'Clusterware, ASM and RAC messages with meaning and first action.',see:[[8,6,'A troubleshooting method'],[4,6,'ASMCMD and SQL*Plus']],b:[
{t:[['Message','Meaning','First action'],
['CRS-4639','Could not contact Oracle High Availability Services','Start ohasd or the OS service (`crsctl start has`)'],
['CRS-4535','Cannot communicate with Cluster Ready Services','Check `crsd.trc`, storage'],
['CRS-4529','Cluster Synchronization Services is online (info)','Not an error'],
['CRS-4530','Communications failure contacting CSS','Check network and voting files'],
['CRS-5017','Resource action failed','Read the agent log'],
['CRS-2674 / 2632','Start of resource failed','Dependency or environment problem'],
['CRS-1607','Node is being evicted from the cluster','See eviction analysis in `ocssd.trc`'],
['PRVF-xxxx','CLUVFY failure message','Fix named prerequisite'],
['ORA-15001','Diskgroup does not exist or is not mounted','Mount it, check ASM'],
['ORA-15032 / 15040 / 15042','Disk group operation failed, disk missing or ASM disk issue','Read the messages that follow'],
['ORA-15063','Discovered disk missing','Check discovery string, permissions'],
['ORA-15186','ASMLIB error','Check OS device and ASMLib or AFD'],
['ORA-15077','Could not locate ASM instance','Start ASM, check `ORACLE_SID`'],
['ORA-29701','Unable to connect to Cluster Manager','Cluster stack not running'],
['ORA-12545','Connect failed, target host or object does not exist','VIP or SCAN issue'],
['ORA-01105','Mount is incompatible with mounts by other instances','Check RAC parameters that must match'],
['ORA-00600 [kjxx]','Internal GES/GCS error','Open a Service Request with AHF collection']]}
]},

/* 10 ---------------------------------------------------------------- health check */
{t:'Health-check pack',d:'Commands and queries for the daily and weekly cluster check.',see:[[8,5,'CVU and ORAchk'],[9,5,'Production readiness']],b:[
{h:'Cluster state (as grid or root)'},
{code:`crsctl check cluster -all
crsctl check crs
crsctl stat res -t -init
crsctl stat res -t
olsnodes -n -s -t
crsctl query css votedisk
ocrcheck
oifcfg getif
cluvfy comp healthcheck -collect cluster`},
{h:'Services and databases'},
{code:`srvctl status database -db orcl -v
srvctl status service -db orcl
srvctl status scan_listener
srvctl status vip -n node1
srvctl status asm`},
{h:'ASM'},
{code:`asmcmd lsdg
SELECT name, state, type, total_mb, free_mb, usable_file_mb, offline_disks FROM v$asm_diskgroup;
SELECT group_number, operation, state, power, est_minutes FROM v$asm_operation;
SELECT path, header_status, mode_status, state FROM v$asm_disk WHERE mode_status <> 'ONLINE';`},
{h:'RAC database'},
{code:`SELECT inst_id, instance_name, host_name, status, startup_time FROM gv$instance;
SELECT inst_id, name, value FROM gv$sysstat WHERE name IN ('gc cr blocks received','gc current blocks received');
SELECT inst_id, event, total_waits, ROUND(time_waited_micro/1e6) s FROM gv$system_event
WHERE wait_class = 'Cluster' ORDER BY time_waited_micro DESC FETCH FIRST 10 ROWS ONLY;`}
]},

/* 11 ---------------------------------------------------------------- naming */
{t:'Resource and naming decoder',d:'How cluster resources, networks and ASM files are named.',see:[[2,4,'Clusterware resources'],[3,2,'SCAN, VIPs and listeners']],b:[
{t:[['Name','Meaning'],
['`ora.<db>.db`','The database resource'],
['`ora.<db>.<service>.svc`','A database service'],
['`ora.<node>.vip`','Node VIP'],
['`ora.scan1.vip`, `ora.LISTENER_SCAN1.lsnr`','SCAN VIP and its listener'],
['`ora.net1.network`','Public network resource'],
['`ora.LISTENER.lsnr`','Node listener'],
['`ora.asm`, `ora.DATA.dg`','ASM and a disk group resource'],
['`ora.ons`, `ora.cvu`','ONS and Cluster Verification Utility resources'],
['`ora.crsd`, `ora.cssd`, `ora.ctssd`, `ora.gipcd`, `ora.mdnsd`, `ora.gpnpd`, `ora.evmd`','Lower-stack init resources'],
['`+ASM1`, `+ASM2`','ASM instances per node'],
['`ORCL1`, `ORCL2`','Database instances'],
['`inst_id`','Instance number in GV$ views'],
['`+DATA/ORCL/DATAFILE/users.259.123456789`','ASM file: disk group, db, type, file and incarnation numbers'],
['`DATA_0000`','ASM disk name in a disk group'],
['169.254.x.x','HAIP address of the private interconnect (if used)']]},
{h:'Networks'},
{t:[['Network','Role'],
['Public','Client access, node VIP and SCAN VIPs'],
['Private (interconnect)','Cache Fusion and heartbeat, dedicated and fast'],
['Storage','SAN, NFS or iSCSI, separate when possible'],
['Management','ILOM, SSH, monitoring']]}
]},

/* 12 ---------------------------------------------------------------- 26ai notes */
{t:'Release notes and 26ai changes',d:'Cluster features that changed or were removed in newer releases. Verify against the guide for your release.',see:[[3,5,'26ai installer changes'],[5,6,'Administrator-managed databases']],b:[
{t:[['Topic','Change','Action'],
['Policy-managed databases','Not supported in newer releases [26ai]','Use administrator-managed databases'],
['Grid Infrastructure Management Repository (GIMR)','Changed or removed [26ai]','Check monitoring and CHA dependency in your design'],
['Installer','`config.sh` desupported, use `gridSetup.sh` [26ai]','Update automation'],
['Multitenant','Only CDB architecture [26ai]','Convert non-CDBs before or during upgrade'],
['Flex ASM','Default in newer releases','Clients may connect to remote ASM instances'],
['ASM Filter Driver (AFD)','Preferred over ASMLib on newer releases','Plan migration of device handling'],
['Cluster upgrades','Rolling upgrade supported from 19c','Read the upgrade guide for steps']]},
{note:'Release changes are listed in the Upgrade Guide and in the Clusterware Administration Guide for each release. This page gives the direction, not the final word.'}
]}

]};
