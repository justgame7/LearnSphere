/* LearnSphere - Exadata, Section 03: Storage Server Software & Cell Architecture.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const disks=O.dg(700,260,[
[10,10,150,50,'Physical disk|12 per HC cell',0],
[10,80,150,50,'LUN',0],
[10,150,150,50,'Cell disk|CD_00_cell01',2],
[220,130,230,40,'Grid disk DATA_CD_00_cell01',2],[220,185,230,40,'Grid disk RECO_CD_00_cell01',2],
[510,130,180,95,'ASM disk groups|+DATA (from DATA grid disks)|+RECO (from RECO grid disks)',0],
[220,10,470,100,'Every cell has the same layout, so ASM spreads data across all cells',1]],
[[85,60,85,80],[85,130,85,150],[160,175,220,150],[160,175,220,200],[450,150,510,170],[450,205,510,190]]);

/* ---------- 0: CELLSRV, MS, RS ---------- */
L['ora-exa:2:0']={blocks:[
{p:'Each storage cell runs three main services. Together they are the **Exadata System Software**.'},
{t:[['Service','Role','If it stops'],
['**CELLSRV**','Serves I/O to the database, runs Smart Scan, caching and storage indexes','The cell cannot serve data. ASM disks on it go offline.'],
['**MS (Management Server)**','Configuration, monitoring, metrics, alerts, `cellcli` access','No new alerts or metrics. Data service continues.'],
['**RS (Restart Server)**','Starts and restarts CELLSRV and MS','Failed services are not restarted automatically']]},
{h:'Check the services'},
{code:`# On a cell, as celladmin or root
cellcli -e list cell attributes name,cellsrvStatus,msStatus,rsStatus
service celld status

-- Typical output
-- cell01  running  running  running`},
{h:'Logs and where to look'},
{t:[['Log','Where'],
['Cell alert log','`/opt/oracle/cell/log/diag/asm/cell/<cell>/trace/alert.log`'],
['Cell OS logs','`/var/log/messages` and `/var/log/cellos`'],
['Alert history (structured)','`cellcli -e list alerthistory`']]},
{flow:['A request arrives from a database server','CELLSRV reads the disks or flash','It filters and returns data (smart scan) or whole blocks','MS records metrics and alerts','RS restarts services if they fail']},
{h:'Control the services'},
{code:`cellcli -e alter cell restart services cellsrv
cellcli -e alter cell restart services all`},
{note:'Restarting CELLSRV on a cell takes its disks offline in ASM for a short time. In production, check ASM redundancy first and use rolling procedures from the patching section.'}],
src:[['Exadata System Software',O.EXA]]};

/* ---------- 1: Disks ---------- */
L['ora-exa:2:1']={blocks:[
{p:'Between the physical drive and the ASM disk, Exadata has two extra layers: **cell disks** and **grid disks**.'},
{svg:disks},
{t:[['Layer','Meaning','Name example'],
['**Physical disk**','The real drive','Hard disk or flash module'],
['**LUN**','The device the OS sees','`/dev/sda`'],
['**Cell disk**','The unit Exadata software manages. One per physical disk.','`CD_00_cell01`'],
['**Grid disk**','A slice of a cell disk, presented to ASM','`DATA_CD_00_cell01`'],
['**ASM disk**','One grid disk, in a disk group','`o/192.168.10.11/DATA_CD_00_cell01`']]},
{h:'Look at them'},
{code:`cellcli -e list physicaldisk attributes name,status,physicalSize
cellcli -e list celldisk attributes name,status,size
cellcli -e list griddisk attributes name,size,status,asmModeStatus,asmDeactivationOutcome`},
{t:[['Column','Meaning'],
['`status`','`active` for a healthy disk'],
['`asmModeStatus`','`ONLINE` if ASM uses it normally'],
['`asmDeactivationOutcome`','`Yes` means it is safe to take the grid disk offline']]},
{h:'Why this design'},
{ul:['Every cell disk is split the same way, so each disk group spreads over every disk of every cell.','All disks share the load, so there are no hot disks.','A failed disk loses only a small piece of each disk group, and rebalance is fast.']},
{note:'Before you take a cell down for maintenance, always check `asmDeactivationOutcome`. If it says anything other than Yes, taking the disk offline could reduce redundancy dangerously.'}],
src:[['Cell disks and grid disks',O.EXA]]};

/* ---------- 2: Flash ---------- */
L['ora-exa:2:2']={blocks:[
{p:'Flash on a cell is used in three ways. Each helps a different part of the workload.'},
{t:[['Use','What it does','Benefit'],
['**Smart Flash Cache**','Automatically caches frequently read and written data','Fast reads, and with write-back mode, fast writes of data blocks'],
['**Smart Flash Log**','A small part of flash that takes redo writes in parallel with the disks','Lower commit latency (the first one to finish wins)'],
['**Flash grid disks**','Part of flash used as ASM disk groups','Directly place hot data on flash']]},
{h:'Flash cache modes'},
{t:[['Mode','Meaning'],
['**Write-through**','Reads are cached. Writes go to disk first.'],
['**Write-back**','Reads and writes are cached. Writes reach disk later. Gives much higher write throughput.']]},
{code:`cellcli -e list flashcache detail
cellcli -e list flashlog detail
cellcli -e list metriccurrent attributes name,metricvalue where name like 'FC_.*'`},
{h:'How flash cache decides'},
{ul:['Hot blocks stay, cold ones are replaced.','Large sequential scans do not flood the cache by default.','You can pin objects with `ALTER TABLE ... STORAGE (CELL_FLASH_CACHE KEEP)`.']},
{flow:['A read arrives','Cell checks flash cache','Hit: return from flash','Miss: read from disk, return it, cache it if useful']},
{note:'Newer generations also keep an RDMA memory cache in the cells in front of flash. It serves the hottest data with very low latency. The details depend on the hardware generation.'}],
src:[['Smart Flash Cache and Flash Log',O.EXA]]};

/* ---------- 3: ASM on Exadata ---------- */
L['ora-exa:2:3']={blocks:[
{p:'ASM on Exadata works as in the RAC sub-course, but the disks come from cells. A few details are different.'},
{h:'Discovery'},
{code:`SHOW PARAMETER asm_diskstring
-- o/*/*

SELECT path, name, failgroup FROM v$asm_disk WHERE path LIKE 'o/%' ORDER BY failgroup, path;`},
{p:'Paths have the form `o/<cell IP>/<griddisk name>`. **Each cell is one failure group**, so ASM never puts both mirror copies on one cell.'},
{h:'Disk groups'},
{t:[['Disk group','Content','Redundancy'],
['`DATA`','Datafiles, redo, control files','NORMAL or HIGH (HIGH recommended for production)'],
['`RECO`','Fast Recovery Area: backups, archive logs, flashback','NORMAL or HIGH'],
['`SPARSE`','Space-efficient clones and snapshots','As needed'],
['`DBFS_DG` or `OCR`','Cluster files (OCR, voting files)','NORMAL or HIGH']]},
{code:`CREATE DISKGROUP DATA NORMAL REDUNDANCY
  DISK 'o/*/DATA_*'
  ATTRIBUTE 'au_size'='4M', 'compatible.asm'='19.0', 'compatible.rdbms'='19.0',
            'cell.smart_scan_capable'='TRUE';`},
{h:'Important attributes'},
{t:[['Attribute','Meaning'],
['`cell.smart_scan_capable`','TRUE lets offload work on this disk group'],
['`au_size`','Typically 4 MB on Exadata'],
['`compatible.rdbms`','Must be high enough for features you need']]},
{flow:['Grid disks exist on every cell','ASM discovers them with o/*/*','CREATE DISKGROUP uses a name pattern','Each cell is a failure group, giving cell-level mirroring']},
{note:'Use HIGH redundancy for production data on Exadata when capacity allows. It survives the loss of a whole cell and a disk in another cell at the same time.'}],
src:[['ASM on Exadata',O.EXA],['ASM Administrator Guide',O.ASM]]};

/* ---------- 4: CellCLI, dcli, exacli ---------- */
L['ora-exa:2:4']={blocks:[
{p:'Exadata has three command-line tools for storage servers and one more for database servers. Learn what each is for.'},
{t:[['Tool','Where it runs','Use'],
['**cellcli**','On a cell, locally','Configure and inspect one cell: `LIST`, `ALTER`, `CREATE`, `DROP`'],
['**dcli**','On a database server (or admin host)','Run one command on **many** servers over SSH'],
['**exacli**','Anywhere with HTTPS access','Run cellcli commands remotely, with role-based users'],
['**dbmcli**','On a database server','The equivalent of cellcli for database servers']]},
{h:'Examples'},
{code:`# cellcli (on one cell)
cellcli
CellCLI> list cell detail
CellCLI> list griddisk where status != active

# dcli (from a DB server): all cells at once
dcli -g ~/cell_group -l root cellcli -e "list cell attributes name,cellsrvStatus"

# exacli (remote, no ssh to the cell)
exacli -c cell01 -l celladmin -e "list cell detail"

# dbmcli (on the DB server)
dbmcli -e "list dbserver detail"`},
{h:'Set up dcli'},
{code:`# group files list the host names, one per line
cat ~/cell_group
cell01
cell02
cell03

# Distribute your SSH key so you can run without a password
dcli -g ~/cell_group -l root -k`},
{flow:['Use cellcli for one cell','Use dcli to check all cells the same way','Use exacli where SSH to cells is not allowed','Keep group files for cells, DB servers and switches']},
{note:'Always read before you change. Use `list` commands to look and `alter` commands only with a plan. A command with dcli runs on every cell at once.'}],
src:[['CellCLI and dcli',O.EXA]]};

/* ---------- 5: Metrics and alerts ---------- */
L['ora-exa:2:5']={blocks:[
{p:'Cells record **metrics** (numbers over time) and raise **alerts** when something needs attention. Both are available through cellcli.'},
{h:'Metrics'},
{t:[['Prefix','Covers'],
['`CL_`','The cell: CPU, memory, network'],
['`CD_`','Cell disks: I/O requests, throughput, latency'],
['`GD_`','Grid disks'],
['`FC_`','Flash cache: hits and misses'],
['`DB_`','Per database: I/O by database'],
['`PDB_`','Per PDB']]},
{code:`cellcli -e list metriccurrent attributes name,metricvalue where name like 'CL_CPUT'
cellcli -e list metriccurrent where objectType = 'FLASHCACHE'
cellcli -e list metrichistory CL_CPUT where collectionTime > '2026-01-15T10:00:00+00:00'`},
{h:'Alerts'},
{t:[['Severity','Meaning'],
['**Critical**','Action needed now: failed disk, hardware fault'],
['**Warning**','Look soon: disk predicted to fail'],
['**Info**','For awareness'],
['**Clear**','The problem is resolved']]},
{code:`cellcli -e list alerthistory where severity = critical
cellcli -e list alertdefinition attributes name,description

# Send alerts to a mailbox
cellcli -e alter cell smtpServer='mail.example.com',smtpFromAddr='cell@example.com',smtpToAddr='dba@example.com',notificationMethod='mail,snmp',notificationPolicy='critical,warning,clear'`},
{flow:['A disk reports errors','The MS raises an alert','Notification goes to mail or SNMP, and ASR for hardware','You check the alert and act','The alert clears when the cause is fixed']},
{note:'Exadata disk failures are handled automatically (ASM rebalance and replacement procedures), but you still need to know about them. Keep alert notification configured on every cell.'}],
src:[['Cell metrics and alerts',O.EXA]]};

/* ---------- 6: Practical ---------- */
L['ora-exa:2:6']={blocks:[
{p:'On an Exadata (on premises or a cloud walkthrough from your instructor), inspect one cell and learn to read its health. If no system is available, use the expected output below as a worksheet.'},
{h:'Step 1: Cell services'},
{code:`cellcli -e list cell attributes name,cellsrvStatus,msStatus,rsStatus`},
{h:'Step 2: Disks'},
{code:`cellcli -e list physicaldisk attributes name,status,physicalSize
cellcli -e list celldisk attributes name,status,size
cellcli -e list griddisk attributes name,size,status,asmModeStatus,asmDeactivationOutcome`},
{h:'Step 3: Flash'},
{code:`cellcli -e list flashcache detail
cellcli -e list flashlog detail`},
{h:'Step 4: Metrics and alerts'},
{code:`cellcli -e list metriccurrent attributes name,metricvalue where name like 'CL_.*'
cellcli -e list alerthistory`},
{h:'Step 5: From the database server'},
{code:`dcli -g ~/cell_group -l root cellcli -e "list cell attributes name,cellsrvStatus"
SELECT failgroup, COUNT(*) FROM v$asm_disk WHERE path LIKE 'o/%' GROUP BY failgroup;`},
{h:'What to look for'},
{t:[['Check','Healthy'],
['Cell services','running, running, running'],
['Physical and cell disks','status `normal` or `active`'],
['Grid disks','`active`, `ONLINE`, deactivation outcome `Yes`'],
['Flash cache','mode WriteBack, status normal'],
['Alerts','No open critical alerts'],
['Failure groups','One per cell, with equal disk counts']]},
{h:'Questions'},
{ul:['How many cells and cell disks are there?','What is the flash cache mode?','Are all grid disks safe to take offline?','Which alerts are open?']},
{note:'Do not change anything on a production cell during this exercise. Use only list commands.'}],
src:[['CellCLI reference',O.EXA]]};

})();
