/* LearnSphere - Exadata, Section 05: Storage Configuration & ASM on Exadata.
   Lectures 0-6 are core, 7-10 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const dgs=O.dg(700,230,[
[10,10,680,210,'Typical disk groups built on the same cells',1],
[30,45,200,70,'DATA|datafiles, redo, control files|~80 percent of space',2],[250,45,200,70,'RECO|backups, archive logs, flashback|~20 percent of space',2],[470,45,200,70,'SPARSE (optional)|thin clones and snapshots',0],
[30,135,640,70,'Every disk group is spread over all cells (one failure group per cell)|so each group is mirrored across cells',0]],[]);

const rebuild=O.dg(700,130,[
[10,30,130,60,'Disk fails|in cell 2',0],[180,30,130,60,'ASM drops it|and starts|a rebalance',2],[350,30,130,60,'Data is re-mirrored|from the partner|copies',2],[520,30,170,60,'Redundancy is restored|(needs free space)',0]],
[[140,60,180,60],[310,60,350,60],[480,60,520,60]]);

/* ---------- 0: Disk group design ---------- */
L['ora-exa:4:0']={blocks:[
{p:'Disk group design is done once and is hard to change. Take time to choose sizes, redundancy and purpose.'},
{svg:dgs},
{h:'The usual disk groups'},
{t:[['Disk group','Content','Notes'],
['**DATA**','Datafiles, redo logs, control files','The biggest group'],
['**RECO**','Fast Recovery Area: archive logs, backups, flashback logs','Size depends on where backups go'],
['**SPARSE**','Sparse (space-efficient) clones and snapshots of databases','Only if you use snapshots for dev and test'],
['**DBFS_DG** or **OCR**','Cluster files, if kept separate','Optional']]},
{h:'How to split space'},
{t:[['Backup location','Typical DATA : RECO'],
['Backups on the same Exadata (local FRA)','About 40 : 60'],
['Backups go outside to a Recovery Appliance or object storage','About 80 : 20']]},
{h:'Decisions'},
{t:[['Decision','Guidance'],
['**Redundancy**','HIGH where capacity allows, NORMAL otherwise. Never EXTERNAL on Exadata.'],
['**One or several DATA groups**','One is simplest. Several allow different redundancy or separate production from test.'],
['**Allocation unit**','4 MB'],
['**Cluster files**','Put OCR and voting files in a disk group with HIGH or NORMAL redundancy']]},
{flow:['Estimate data, backup and growth sizes','Decide where backups are kept','Choose redundancy for each group','Choose the split','Create the groups on all cells']},
{note:'Resizing a disk group means moving data. Plan growth before the groups are full, and leave room for the rebuild reserve (lecture 2).'}],
src:[['Exadata storage configuration',O.EXA]]};

/* ---------- 1: Redundancy and failure groups ---------- */
L['ora-exa:4:1']={blocks:[
{p:'On Exadata, **each cell is a failure group**. ASM mirrors every extent across different cells, and each disk has a set of **partner disks** in other cells.'},
{t:[['Redundancy','Copies','Survives','Cells needed'],
['**NORMAL**','2','Loss of one cell (or disks in one failure group)','At least 3 recommended'],
['**HIGH**','3','Loss of one cell plus a disk in another, or two failure groups, when space allows','At least 3, more is better']]},
{h:'Partner disks'},
{p:'ASM does not mirror a whole disk to another whole disk. Each disk has several **partners** in other cells, and its extents are mirrored across them. When a disk fails, all its partners help to rebuild, which makes the rebuild **fast**.'},
{h:'Voting files on small configurations'},
{p:'Voting files in HIGH redundancy need five failure groups. A system with only three cells cannot hold five. Exadata uses **quorum disks** on database servers to supply the extra failure groups.'},
{code:`SELECT g.name AS diskgroup, d.failgroup, COUNT(*) AS disks
FROM   v$asm_disk d JOIN v$asm_diskgroup g ON g.group_number = d.group_number
GROUP  BY g.name, d.failgroup ORDER BY 1, 2;

SELECT name, type, total_mb, free_mb, required_mirror_free_mb, usable_file_mb FROM v$asm_diskgroup;`},
{flow:['A file extent is written','ASM places each copy in a different cell','Partner disks are chosen across cells','A failure is covered by copies in other cells']},
{note:'The partner design means a double failure in specific places can still cause loss. Replace failed disks quickly and watch for repeated failures in the same area.'}],
src:[['ASM redundancy on Exadata',O.EXA]]};

/* ---------- 2: Capacity ---------- */
L['ora-exa:4:2']={blocks:[
{p:'Raw capacity and **usable** capacity are very different. A good plan accounts for mirroring and for the **space needed to rebuild after a failure**.'},
{h:'The formula'},
{code:`usable space = (raw space - rebuild reserve) / number of copies

NORMAL redundancy: number of copies = 2
HIGH redundancy:   number of copies = 3`},
{t:[['Term','Meaning'],
['**Raw**','Total of all grid disks in the group'],
['**Rebuild reserve**','Free space to re-mirror after the largest failure that you want to survive (for example one cell)'],
['**USABLE_FILE_MB**','What ASM reports as safely usable for new files']]},
{h:'Example with illustrative numbers'},
{t:[['Item','Value'],
['Cells','5, each 100 TB raw'],
['Raw total','500 TB'],
['Reserve for one cell failure','100 TB'],
['Usable with NORMAL','(500 - 100) / 2 = 200 TB'],
['Usable with HIGH','(500 - 100) / 3 = about 133 TB']]},
{code:`SELECT name, ROUND(total_mb/1024/1024,1) AS raw_tb,
       ROUND(free_mb/1024/1024,1)         AS free_tb,
       ROUND(required_mirror_free_mb/1024/1024,1) AS reserve_tb,
       ROUND(usable_file_mb/1024/1024,1)  AS usable_tb
FROM   v$asm_diskgroup;`},
{h:'Rules'},
{ul:['Keep `USABLE_FILE_MB` positive. Negative means a failure may not be fully recoverable.','Alert at 80 percent used, and plan expansion well before that.','Compression (HCC) and removing unused data both create capacity.','Include growth for backups, archive logs and flashback in RECO.']},
{flow:['Measure current used space and growth per month','Compute usable space with the formula','Decide at what percent you will order more capacity','Monitor USABLE_FILE_MB and alert early']},
{note:'The numbers above are for learning. Use the real capacity of your storage servers from the data sheet or from `V$ASM_DISKGROUP`.'}],
src:[['ASM disk group space',O.ASM],['Exadata storage',O.EXA]]};

/* ---------- 3: Rebalance ---------- */
L['ora-exa:4:3']={blocks:[
{p:'ASM **rebalance** works as in the RAC sub-course, but on Exadata it matters more because it runs after every disk or cell event and the groups are large.'},
{h:'What triggers a rebalance'},
{t:[['Event','Effect'],
['Disk failure or drop','Re-mirror data from partner copies'],
['Disk or cell added','Spread data onto the new disks'],
['Cell replaced','Rebuild its disks'],
['Disk group resized','Move extents']]},
{h:'Power'},
{code:`ALTER DISKGROUP DATA REBALANCE POWER 8;
SHOW PARAMETER asm_power_limit

SELECT group_number, operation, state, power, est_minutes FROM v$asm_operation;`},
{t:[['Power','Effect'],
['Low','Little impact on users, long rebuild with reduced protection'],
['Medium','A good balance in business hours'],
['High','Fast restore of redundancy, more load on cells']]},
{h:'How to choose'},
{ul:['After a failure, restoring redundancy fast is usually more important, so use a higher power until it finishes.','Add disks or cells in quiet periods, at a lower power if needed.','Check `V$ASM_OPERATION` for the estimate and watch cell I/O metrics during the rebuild.']},
{flow:['A failure or change starts a rebalance','Power sets how fast it runs','V$ASM_OPERATION shows progress','Redundancy is restored when it ends']},
{note:'During a rebalance after a disk failure, the system is exposed to a second failure. Prefer a higher power in that case, and replace the failed disk quickly.'}],
src:[['ASM rebalance',O.ASM]]};

/* ---------- 4: Failure handling ---------- */
L['ora-exa:4:4']={blocks:[
{p:'Exadata is built to **handle failures automatically**. You must know what happens, what you will see and what you must do.'},
{svg:rebuild},
{t:[['Failure','Automatic action','What you do'],
['**Hard disk failure**','The cell reports it, ASM drops the disk and rebalances using partners','Replace the disk. Exadata adds it back to ASM automatically.'],
['**Disk predicted to fail**','ASM can proactively drop it','Replace it when notified'],
['**Flash device failure**','Flash cache shrinks, write-back data stays protected by mirroring','Replace the flash module'],
['**Cell failure**','Disks go offline, ASM keeps running on mirrors, fast resync if it returns quickly','Repair, then bring it back'],
['**Cell reboot (planned)**','Disks go offline for a short time, resync on return','Check asmDeactivationOutcome first']]},
{h:'What to check'},
{code:`cellcli -e list physicaldisk where status != normal
cellcli -e list alerthistory where severity = critical
SELECT name, mode_status, mount_status, repair_timer FROM v$asm_disk WHERE mode_status <> 'ONLINE';
SELECT * FROM v$asm_operation;`},
{h:'Replacement'},
{flow:['A disk fails and an alert is raised','You (or Oracle Field Service) swap the disk','The cell creates the cell disk and grid disks again','ASM adds the disks and rebalances','The system is fully redundant again']},
{note:'Do not remove a healthy disk by mistake. Check the physical disk status and the service LED, and replace only the disk that the alert names.'}],
src:[['Handling disk and flash failures',O.EXA]]};

/* ---------- 5: Storage expansion ---------- */
L['ora-exa:4:5']={blocks:[
{p:'Adding storage servers is a planned project with clear steps. The cells are installed, configured and then **added to the existing disk groups**.'},
{h:'Steps'},
{flow:['Install and cable the new cells, assign IP addresses','Configure the cells with the deployment tools','Create cell disks and grid disks with the same layout as the existing cells','Add the cell IPs to cellip.ora on every database server','Add the new grid disks to each disk group','Rebalance and verify']},
{code:`# On the new cell: grid disks that match the existing layout
cellcli -e create celldisk all
cellcli -e create griddisk all prefix=DATA size=<same size as existing cells>
cellcli -e create griddisk all prefix=RECO size=<same size as existing cells>

# On the database servers: update the cell list on all nodes
dcli -g ~/dbs_group -l root "cat /etc/oracle/cell/network-config/cellip.ora"

-- In ASM
ALTER DISKGROUP DATA ADD DISK 'o/192.168.10.15/DATA_*' REBALANCE POWER 8;
ALTER DISKGROUP RECO ADD DISK 'o/192.168.10.15/RECO_*' REBALANCE POWER 8;`},
{t:[['Check','Expected'],
['`v$asm_disk` for the new cell','All disks ONLINE, new failgroup'],
['`v$asm_operation`','Rebalance runs, then finishes'],
['`V$ASM_DISKGROUP.USABLE_FILE_MB`','Increases']]},
{h:'Planning'},
{ul:['Plan the rebalance window: moving terabytes takes hours.','Use the same hardware generation when possible, and check software compatibility.','Document the new network addresses and update monitoring.']},
{note:'Follow the official Exadata expansion procedure for your release. This lecture is an outline, and details differ between generations and between cloud and on-premises systems.'}],
src:[['Expanding Exadata storage',O.EXA]]};

/* ---------- 6: Practical ---------- */
L['ora-exa:4:6']={blocks:[
{p:'Plan disk groups for a **consolidation project**. Use the numbers below (illustrative).'},
{h:'The project'},
{t:[['Item','Value'],
['Storage servers','5, each with 100 TB raw'],
['Databases','40 databases, 90 TB of data now, growing 20 TB per year'],
['Backups','Kept on a Recovery Appliance, outside this Exadata'],
['Requirement','Survive the loss of one cell. Keep dev and test clones cheaply.']]},
{h:'Tasks'},
{ul:['Choose redundancy for DATA and RECO.','Compute usable space with a one-cell reserve.','Choose the DATA : RECO split.','Decide whether you need SPARSE.','Estimate when you need more capacity.']},
{h:'Sample solution'},
{t:[['Step','Answer'],
['Raw total','5 x 100 = 500 TB'],
['Redundancy','HIGH for DATA (production), NORMAL for RECO if capacity is tight'],
['Reserve','100 TB (one cell)'],
['Usable with HIGH','(500 - 100) / 3 = about 133 TB (if all HIGH)'],
['Split','80 : 20 because backups are outside'],
['SPARSE','Yes, a small group for dev and test clones'],
['Time to full','With 90 TB now and +20 TB a year against ~110 TB usable DATA, plan expansion within about one year']]},
{note:'Adjust the numbers if you mix redundancy: HIGH data uses more raw space than NORMAL data. Calculate each group separately.'},
{flow:['Compute raw and reserve','Choose redundancy per group','Allocate raw space by split','Check growth against usable space','Write the expansion trigger (for example 75 percent of usable)']},
{h:'Challenge'},
{p:'Repeat the exercise for three cells only. What changes for HIGH redundancy and the voting files?'}],
src:[['Exadata storage configuration',O.EXA]]};

})();
