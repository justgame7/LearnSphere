/* LearnSphere - Grid Infrastructure, ASM & RAC, Section 09: Cluster Administration & Troubleshooting.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const layers=O.dg(700,230,[
[10,20,110,60,'1 Node|OS, CPU,|memory, disk',0],[145,20,110,60,'2 Network|public and|interconnect',0],[280,20,110,60,'3 Storage|shared disks,|ASM',0],[415,20,110,60,'4 Clusterware|CSSD, CRSD,|resources',2],[550,20,140,60,'5 Database|instances,|services',0],
[10,110,680,105,'Work from the bottom up: ask at each layer what the log says and what changed',1]],
[[120,50,145,50],[255,50,280,50],[390,50,415,50],[525,50,550,50]]);

const evict=O.dg(700,140,[
[10,30,130,60,'Heartbeat missed|(network or disk)',0],[190,30,130,60,'CSSD waits for|misscount seconds',2],[370,30,130,60,'Node is evicted|and rebooted',2],[550,30,140,60,'You read logs,|find the cause',0]],
[[140,60,190,60],[320,60,370,60],[500,60,550,60]]);

/* ---------- 0: crsctl, ocr, voting ---------- */
L['ora-rac:8:0']={blocks:[
{p:'Four tools do most cluster administration: `crsctl` (cluster control), `ocrcheck` and `ocrconfig` (the OCR), and `srvctl` (databases and services). Learn what each one is for.'},
{h:'crsctl'},
{t:[['Command','Use'],
['`crsctl check crs`','Status of the local stack'],
['`crsctl check cluster -all`','Status on every node'],
['`crsctl stat res -t`','All resources'],
['`crsctl stop crs` / `start crs`','Stop or start the stack on this node (as root)'],
['`crsctl query css votedisk`','Voting file locations'],
['`crsctl replace votedisk +NEWDG`','Move voting files to another disk group'],
['`crsctl get css misscount`','Eviction timeout'],
['`crsctl stat res -p`','All resource attributes']]},
{h:'OCR'},
{code:`ocrcheck                          # location, size, integrity
ocrconfig -showbackup             # automatic and manual backups
ocrconfig -manualbackup           # take a backup now
ocrconfig -add +NEWDG             # add an OCR location (as root)
ocrconfig -delete +OLDDG
ocrdump /tmp/ocr.txt              # text dump for reading`},
{h:'Move the OCR and voting files to another disk group'},
{flow:['Create the new disk group with the right redundancy','Add the OCR location in the new disk group','Replace the voting files','Delete the OCR location in the old disk group','Check with ocrcheck and crsctl query css votedisk']},
{code:`# as root
ocrconfig -add +NEWOCR
ocrconfig -delete +OCR
crsctl replace votedisk +NEWOCR
crsctl query css votedisk
ocrcheck`},
{note:'Run OCR and voting file changes as root with a current backup, and one change at a time. Check after each step before you continue.'}],
src:[['Administering Clusterware',O.CW],['OCR and voting files',O.CW+'managing-oracle-cluster-registry-and-voting-files.html']]};

/* ---------- 1: OCR and voting backup/recovery ---------- */
L['ora-rac:8:1']={blocks:[
{p:'The OCR and voting files are small but critical. Know where the backups are and how a restore works **before** you need it.'},
{h:'Backups'},
{t:[['Item','How it is protected'],
['**OCR**','Automatic backups every 4 hours (plus daily and weekly), taken by one node, kept on that node. Manual backups on demand.'],
['**Voting files**','Their contents are included in the OCR backup. In ASM they live in a mirrored disk group.']]},
{code:`ocrconfig -showbackup
-- rac1  2026/01/15 08:00:11  /u01/app/19.0.0/grid/cdata/racdemo/backup00.ocr

ocrconfig -manualbackup
cp /u01/app/19.0.0/grid/cdata/racdemo/backup00.ocr /backup/ocr/   # keep a copy elsewhere`},
{h:'Failure scenarios'},
{t:[['Failure','Result','Action'],
['**One voting file lost** (normal redundancy)','Cluster keeps running (majority remains)','Replace the disk and ASM re-creates the file'],
['**One OCR copy lost**','Cluster keeps running on the other copy','`ocrconfig -replace` or add a new location'],
['**All voting files lost**','Nodes are evicted','Restore as described below'],
['**All OCR copies lost**','Clusterware cannot start resources','Restore from a backup']]},
{h:'Restore outline (OCR)'},
{flow:['Stop Clusterware on all nodes (crsctl stop crs -f)','Start Clusterware on one node in exclusive mode without CRS (crsctl start crs -excl -nocrs)','Restore the OCR (ocrconfig -restore <backup file>)','Restore the voting files with crsctl replace votedisk +DISKGROUP','Stop the exclusive stack, then start the cluster normally on all nodes','Check with ocrcheck and cluvfy']},
{note:'The exact steps depend on where the OCR lives (ASM or not) and the release. Follow the documentation for your version and practise the restore in a lab once. Do not wait for the real failure to learn it.'}],
src:[['Backing up and restoring the OCR',O.CW+'managing-oracle-cluster-registry-and-voting-files.html']]};

/* ---------- 2: Node eviction ---------- */
L['ora-rac:8:2']={blocks:[
{p:'When a node is evicted, the cluster did what it was designed to do. Your job is to find **why the node stopped answering**.'},
{svg:evict},
{h:'Typical causes'},
{t:[['Cause','Evidence'],
['**Interconnect problem**','`ocssd.trc` shows missed network heartbeats. NIC errors or drops.'],
['**Storage or voting file access**','Missed disk heartbeat messages. I/O errors in the OS log.'],
['**CPU or memory starvation**','High load, swapping, OS watchdog or CHM data show the node stalled'],
['**OS hang or kernel issue**','Messages in `/var/log/messages`, no CSSD activity at the time'],
['**Misconfiguration**','Wrong MTU, bonding, firewall or time jump']]},
{h:'Where to look (in this order)'},
{flow:['Clusterware alert log on the evicted node and the survivors (CRS-1607 is an eviction message)','ocssd.trc around the time of the event','OS log: /var/log/messages, dmesg, last reboot','Cluster Health Monitor data for that time','Network counters on NIC and switch']},
{code:`grep -E "CRS-1607|CRS-1601|evict" /u01/app/grid/diag/crs/rac1/crs/trace/alert.log
grep -i "heartbeat" /u01/app/grid/diag/crs/rac1/crs/trace/ocssd.trc | tail -20
last reboot | head
oclumon dumpnodeview -n rac2 -last "00:10:00"`},
{h:'Prevention'},
{ul:['Dedicated, redundant interconnect with matching MTU.','Enough RAM and CPU, with no swapping.','Stable time (chrony), and no firewall on the private network.','Do not change misscount without advice from Oracle Support.']},
{note:'Write down the time of the eviction first, and collect logs from every node for that time. Logs rotate, and evidence disappears quickly.'}],
src:[['Troubleshooting node eviction',O.CW]]};

/* ---------- 3: Interconnect and gc waits ---------- */
L['ora-rac:8:3']={blocks:[
{p:'**gc** wait events show time spent getting blocks from other instances. A little is normal. A lot means a network problem or a **hot block** that every node wants.'},
{h:'Wait events'},
{t:[['Event','Usual meaning'],
['`gc cr block 2-way` / `3-way`','Normal transfer time of a block'],
['`gc current block 2-way` / `3-way`','Same, for a current block'],
['`gc cr block busy`, `gc current block busy`','The holder was busy flushing redo before it could send the block'],
['`gc buffer busy acquire` / `release`','Many sessions on the same block'],
['`gc cr block lost`, `gc current block lost`','**Packet loss** on the interconnect'],
['`gc cr grant 2-way`','Lightweight message: block not in any cache, read from disk']]},
{h:'How to measure'},
{code:`-- Average time to receive a block (per instance)
SELECT b1.inst_id,
       ROUND((b1.value/NULLIF(b2.value,0))*10,2) AS avg_ms_cr_block
FROM   gv$sysstat b1 JOIN gv$sysstat b2 ON b1.inst_id = b2.inst_id
WHERE  b1.name = 'gc cr block receive time' AND b2.name = 'gc cr blocks received';

SELECT inst_id, event, total_waits, ROUND(time_waited_micro/1e6) AS secs
FROM   gv$system_event WHERE event LIKE 'gc%' ORDER BY time_waited_micro DESC FETCH FIRST 10 ROWS ONLY;`},
{t:[['Average receive time','Reading'],
['Up to about 1 to 2 ms','Good'],
['Several ms','Check network and load'],
['Above 10 ms','A serious problem']]},
{h:'Causes and fixes'},
{t:[['Cause','Fix'],
['Lost packets, wrong MTU, small buffers','Fix the network, match MTU, tune the OS buffers'],
['Hot index block (inserts with an increasing key)','Hash or reverse-key index, or partition'],
['Sequence with `ORDER` or small cache','`CACHE 1000 NOORDER` for sequences'],
['Same table updated on all nodes','Route that workload to one instance with a service'],
['Overloaded LMS processes or CPU','Reduce CPU load, review `GCS_SERVER_PROCESSES`']]},
{flow:['Look at average gc block receive time','High: check the interconnect and CPU first','Normal but many waits: find the hot blocks in AWR','Fix the design, or partition the workload by service']},
{note:'AWR global reports for RAC need the Diagnostics Pack. If you are not licensed, use the GV$ views above and Statspack.'}],
src:[['Monitoring RAC performance',O.RAC]]};

/* ---------- 4: Logs, TFA, AHF ---------- */
L['ora-rac:8:4']={blocks:[
{p:'In a cluster, logs are spread across nodes and layers. **Trace File Analyzer (TFA)** collects them for you, and it is part of the **Autonomous Health Framework (AHF)**.'},
{h:'Where logs are'},
{t:[['Component','Location'],
['Clusterware','`$ORACLE_BASE/diag/crs/<host>/crs/trace`'],
['ASM','`$ORACLE_BASE/diag/asm/+asm/+ASM1/trace`'],
['Listeners','`$ORACLE_BASE/diag/tnslsnr/<host>/<listener>/trace`'],
['Database','`$ORACLE_BASE/diag/rdbms/<db>/<instance>/trace`']]},
{h:'TFA and AHF'},
{t:[['Tool','Job'],
['**TFA**','Collects logs and traces from all nodes for a time window, trims them, and packages them'],
['**ORAchk**','Checks best practices and known problems'],
['**Cluster Health Monitor**','Records OS and cluster metrics continuously'],
['**OSWatcher**','Records OS metrics such as vmstat and netstat'],
['**AHF**','The bundle that installs all of these']]},
{code:`tfactl status
tfactl print status
tfactl diagcollect -from "2026-01-15 10:00:00" -to "2026-01-15 10:30:00"

ahfctl statusahf`},
{flow:['A problem happens at a known time','Run diagcollect for that time window','TFA gathers logs from every node','Review the package or attach it to a service request']},
{h:'Good practice'},
{ul:['Install AHF on every node, and keep it updated.','Run diagcollect soon after an event, before logs rotate.','Keep long-term OS metrics (CHM and OSWatcher).','Keep the collection in the case or incident notes.']},
{note:'AHF has its own repository and can use disk space. Check its size and retention settings so it does not fill the file system.'}],
src:[['Autonomous Health Framework','https://docs.oracle.com/en/engineered-systems/health-diagnostics/autonomous-health-framework/'],['Diagnosing Clusterware',O.CW]]};

/* ---------- 5: CVU and ORAchk ---------- */
L['ora-rac:8:5']={blocks:[
{p:'Two tools check the health of the cluster against known good practice. Run them before and after every big change.'},
{h:'Cluster Verification Utility (cluvfy)'},
{code:`cluvfy comp nodecon -n all -verbose            # network connectivity
cluvfy comp ocr -n all                         # OCR integrity
cluvfy comp ssa -n all                         # shared storage
cluvfy comp healthcheck -collect cluster -bestpractice -html
cluvfy stage -pre nodeadd -n rac3
cluvfy stage -post crsinst -n all`},
{t:[['Stage or component','Checks'],
['`stage -pre crsinst`','Before installing Grid'],
['`stage -post crsinst`','After installing Grid'],
['`stage -pre nodeadd`','Before adding a node'],
['`comp nodecon`, `comp ocr`, `comp ssa`','Networks, OCR, shared storage']]},
{h:'ORAchk'},
{p:'**ORAchk** (part of AHF) compares your configuration with Oracle best practice and known issues. It writes an HTML report with a score.'},
{code:`orachk                       # run as the oracle or root user, as the tool asks
orachk -profile dba          # a focused set of checks`},
{t:[['Result','Meaning'],
['**FAIL**','Fix this. It is a known problem or risk.'],
['**WARNING**','Review and decide'],
['**INFO**','For your awareness'],
['**PASS**','As expected']]},
{h:'When to run them'},
{flow:['Before an upgrade or patch','After an upgrade or patch','After adding or removing a node','Regularly (for example weekly or monthly)','Save each report for comparison']},
{note:'A report is only useful if you act on it. Keep a list of accepted exceptions and the reason for each.'}],
src:[['Cluster Verification Utility',O.CW],['ORAchk','https://docs.oracle.com/en/engineered-systems/health-diagnostics/autonomous-health-framework/']]};

/* ---------- 6: Method ---------- */
L['ora-rac:8:6']={blocks:[
{p:'Cluster problems have many layers. A fixed method keeps you from jumping to the wrong one.'},
{svg:layers},
{h:'Seven steps'},
{flow:['State the symptom: which node, which resource, since when','Check what changed: patch, OS update, network, storage, parameter','Check the node: load, memory, disk, OS log','Check the network, then the shared storage','Check Clusterware: stack, resources, alert log, ocssd.trc','Check ASM, then the database and services','Fix one thing, verify, and record the cause']},
{h:'First commands'},
{code:`crsctl check cluster -all
crsctl stat res -t | grep -v ONLINE        # show only what is not online
olsnodes -n -s
ocrcheck
crsctl query css votedisk
asmcmd lsdg
srvctl status database -db orcl -verbose`},
{h:'Symptom to first check'},
{t:[['Symptom','First check'],
['A node left the cluster','Eviction: ocssd.trc, OS log, interconnect'],
['Clusterware will not start','OHASD log, voting files, ASM, network'],
['A resource is not online','Resource log, dependencies, `crsctl stat res -p`'],
['Database slow with gc waits','Interconnect, hot blocks, CPU'],
['Cannot connect to a service','Service status, SCAN and listeners, PDB open']]},
{note:'Collect logs with TFA early. If you need Oracle Support, you will want the data from every node for the same time window.'}],
src:[['Troubleshooting Clusterware',O.CW]]};

/* ---------- 7: Practical ---------- */
L['ora-rac:8:7']={blocks:[
{p:'Break the lab on purpose and diagnose it, using only the logs and views. Do this on the **lab only**, with a snapshot taken first.'},
{h:'Fault 1: A node is evicted'},
{code:`# On rac2, as root: take down the interconnect NIC
ip link set eth1 down`},
{p:'After about 30 seconds (misscount), rac2 is evicted and restarts. After it comes back, find the cause without looking at what you did.'},
{t:[['Check','You expect to find'],
['Clusterware alert log on rac1','CRS-1607 about rac2 being evicted'],
['`ocssd.trc` on rac1','Missed network heartbeats from rac2'],
['`/var/log/messages` on rac2','Interface eth1 down'],
['Fix','Bring the NIC up and check `oifcfg getif`, `cluvfy comp nodecon`']]},
{h:'Fault 2: A resource is hung or keeps failing'},
{code:`# On rac1, as root
pkill -9 -f "tnslsnr LISTENER "
crsctl stat res ora.LISTENER.lsnr -t`},
{p:'Watch Clusterware restart the listener. Then try a stuck resource: stop it with `srvctl` and see its state.'},
{t:[['Check','You expect to find'],
['`crsctl stat res -t`','The listener goes OFFLINE, then ONLINE again'],
['Agent log `crsd_oraagent_grid.trc`','The check failed, restart attempted'],
['Alert log','Resource failure and restart messages']]},
{h:'Write a short report for each fault'},
{ul:['Time of the event','Symptom as users would see it','Evidence you found (log lines, views)','Cause and fix','How to prevent it']},
{note:'You break things in the lab so that, when a real one breaks, you recognise the pattern. Revert the snapshot when you finish.'}],
src:[['Clusterware Administration and Deployment Guide',O.CW]]};

})();
