/* LearnSphere - Exadata, Section 02: Hardware & Network Architecture.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const net=O.dg(700,270,[
[10,10,680,60,'RoCE fabric: two leaf switches (private, fast). Database to storage and RAC interconnect.',2],
[10,90,330,70,'Database servers',1],[30,118,140,34,'DB server 1',0],[190,118,130,34,'DB server 2',0],
[360,90,330,70,'Storage servers (cells)',1],[380,118,140,34,'Cell 1',0],[540,118,130,34,'Cell 2, 3 ...',0],
[10,180,330,80,'Client network (bondeth0)|applications connect here|and Backup network (optional)',0],[360,180,330,80,'Admin and ILOM network|SSH, monitoring, power on/off|Power: two PDUs',0]],
[[100,70,100,90],[250,70,250,90],[450,70,450,90],[600,70,600,90]]);

/* ---------- 0: Database servers ---------- */
L['ora-exa:1:0']={blocks:[
{p:'The **database servers** (also called compute nodes) run Oracle Database and Grid Infrastructure. They are powerful general-purpose servers, but with **no local database storage**: data lives on the storage servers.'},
{h:'What a database server has'},
{t:[['Part','Notes'],
['**Processors**','Two-socket servers. The generation decides the CPU family and cores.'],
['**Memory**','Large, expandable. Used for the SGA, PGA and the OS.'],
['**Local disks**','Only for the OS, Oracle homes and logs, mirrored. Not for database files.'],
['**Network ports**','RoCE ports to the fabric, client and backup ports, an admin port and an ILOM port'],
['**Software**','Oracle Linux, Grid Infrastructure, database homes. Optionally a KVM hypervisor with virtual machines.']]},
{h:'Bare metal or virtual'},
{t:[['','Bare metal','Virtualised (KVM)'],
['**What runs on the hardware**','Linux directly','A hypervisor (the KVM host) with one or more virtual machines (guests)'],
['**Isolation**','One OS','Several VM clusters on the same hardware'],
['**Use**','Highest control, simple','Consolidation, separate environments, cloud service']]},
{p:'In the cloud, Exadata database servers are always virtualised. You work in a **guest VM** and Oracle manages the host.'},
{h:'The role of DB servers'},
{flow:['The database instance runs here','It sends I/O requests to cells over RoCE','It receives data, or smart-scan results','Grid Infrastructure and RAC coordinate the cluster']},
{note:'There is no shared local storage between database servers. Everything shared is on the cells, which is why every DB server needs to see the same set of cells.'}],
src:[['Exadata Database Machine Owner Guide',O.EXA]]};

/* ---------- 1: Storage servers ---------- */
L['ora-exa:1:1']={blocks:[
{p:'**Storage servers** (cells) are not simple disk shelves. Each is a server with CPUs, memory, flash and disks, running the **Exadata System Software**. That software is what enables Smart Scan and the other features.'},
{t:[['Type','Media','Use'],
['**High Capacity (HC)**','Large hard disks plus flash cache','Capacity with fast reads from flash cache'],
['**Extreme Flash (EF)**','All-flash','Lowest latency and highest I/O'],
['**Extreme (XT)**','High-capacity disks, no flash cache offload extras','Low-cost storage for backup and archive']]},
{h:'What each cell does'},
{ul:['Serves **grid disks** to ASM over the network.','Filters data for Smart Scan and keeps storage indexes.','Caches hot data in flash and handles redo writes in flash log.','Monitors itself and reports disk and flash failures.']},
{h:'The cell software'},
{t:[['Process','Job'],
['**CELLSRV**','The main service: I/O, offload and caching'],
['**MS (Management Server)**','Configuration, monitoring and alerts'],
['**RS (Restart Server)**','Restarts the other services if they fail']]},
{h:'How many cells'},
{p:'A minimum system has **three storage servers**, so data can be mirrored across failure groups of separate cells. More cells add capacity and I/O bandwidth together.'},
{flow:['A new cell is added to the system','Its grid disks join an ASM disk group','ASM rebalances data across all cells','Capacity and throughput grow together']},
{note:'Think of a cell as a small server dedicated to your data. Patching, monitoring and failure handling all happen per cell.'}],
src:[['Exadata Storage Server',O.EXA]]};

/* ---------- 2: RoCE fabric ---------- */
L['ora-exa:1:2']={blocks:[
{p:'All data between database servers and storage servers, and the RAC interconnect, use one private network: the **RoCE fabric** (RDMA over Converged Ethernet). It is built for very low latency and high bandwidth.'},
{h:'What it is'},
{t:[['Term','Meaning'],
['**RDMA**','Remote Direct Memory Access: a server reads or writes memory of another server without going through its CPU'],
['**RoCE**','RDMA carried over Ethernet'],
['**Leaf switches**','Two switches in each rack, each server connects to both for redundancy'],
['**Spine switches**','Used when several racks are connected into one fabric']]},
{h:'Why it matters'},
{ul:['Low latency for the Cache Fusion traffic and for I/O to cells.','Very high bandwidth for large scans.','Redundant paths: a switch or cable failure does not stop the system.']},
{h:'The cell list on database servers'},
{p:'A database server knows which cells it may use from two small files.'},
{code:`cat /etc/oracle/cell/network-config/cellip.ora
cell="192.168.10.11;192.168.10.12"
cell="192.168.10.13;192.168.10.14"

cat /etc/oracle/cell/network-config/cellinit.ora
ipaddress1=192.168.10.1/22
ipaddress2=192.168.10.2/22`},
{t:[['File','Meaning'],
['`cellip.ora`','The IP addresses of each cell, as seen from the database server'],
['`cellinit.ora`','The local RoCE addresses of this server']]},
{flow:['The database server reads cellip.ora to find the cells','ASM discovers grid disks at o/<cell IP>/*','I/O goes over RoCE to the cells','If one path fails, the other carries the traffic']},
{note:'If cellip.ora is wrong or missing, ASM cannot find its disks and the disk groups will not mount. It is one of the first files to check after a network change.'}],
src:[['Exadata network',O.EXA]]};

/* ---------- 3: Management network ---------- */
L['ora-exa:1:3']={blocks:[
{p:'Besides the fast fabric, an Exadata rack has a separate **management network**. It is for you, not for the database data.'},
{t:[['Part','Purpose'],
['**Admin network**','SSH to servers, monitoring, patching, backups of configuration'],
['**ILOM (Integrated Lights Out Manager)**','Out-of-band management of each server: power on and off, console, hardware health, even when the OS is down'],
['**Management switch**','Connects the admin and ILOM ports in the rack'],
['**PDUs (power distribution units)**','Two in each rack, so each server has two power feeds'],
['**ASR (Automatic Service Request)**','Sends hardware fault reports to Oracle automatically']]},
{h:'Use ILOM when'},
{ul:['A server does not boot and you need the console.','You need to power cycle a server remotely.','You need the hardware event log.']},
{code:`# From the admin network
ssh root@dbnode1-ilom
-> show /SP/faultmgmt
-> start /SP/console`},
{h:'Redundancy'},
{flow:['Two PDUs feed every server from separate circuits','Two leaf switches serve every RoCE port','Mirrored disks hold the operating system','If one fails, the system continues']},
{note:'Keep the ILOM and admin network on a protected management segment. Access to ILOM is access to the hardware itself.'}],
src:[['Exadata management',O.EXA]]};

/* ---------- 4: Client, backup, management networks ---------- */
L['ora-exa:1:4']={blocks:[
{p:'Apart from the private RoCE fabric, each database server connects to the outside world over **several networks**. Know which does what.'},
{t:[['Network','Interface (typical)','Used for'],
['**Client access**','`bondeth0`','Applications, SCAN, VIPs'],
['**Backup** (optional)','`bondeth1` or a dedicated port','Backup and Data Guard traffic, keeping it off the client network'],
['**Admin / management**','`eth0`','SSH, monitoring'],
['**ILOM**','Dedicated port','Out-of-band hardware management'],
['**RoCE private**','RoCE ports (for example `re0`, `re1`)','Cache Fusion and I/O to cells']]},
{h:'Bonding'},
{p:'Network interfaces are **bonded** (two physical ports act as one logical interface) so a cable or switch failure does not break the connection.'},
{code:`ip -br addr
cat /proc/net/bonding/bondeth0 | head
oifcfg getif
srvctl config network`},
{h:'Plan the addresses'},
{t:[['Item','Needs'],
['Client network','One IP per node, one VIP per node, three SCAN IPs'],
['Backup network','One IP per node'],
['Admin network','One IP per server, plus ILOM IPs'],
['RoCE','Private range, set at install']]},
{flow:['Decide which network each application and tool uses','Reserve addresses for all of them','Configure DNS for the SCAN and names','Confirm with the Exadata deployment tool before installation']},
{note:'A common mistake is to send backup traffic over the client network. It slows the application. Use a dedicated backup network whenever you can.'}],
src:[['Exadata network configuration',O.EXA]]};

/* ---------- 5: Rack configs ---------- */
L['ora-exa:1:5']={blocks:[
{p:'Exadata is sold in **standard rack sizes** and in **elastic configurations**. The base idea is simple: choose the number of database servers and the number of storage servers separately.'},
{t:[['Configuration','Typical content'],
['**Base system (quarter rack)**','2 database servers and 3 storage servers'],
['**Eighth rack**','Same hardware with a part of the cores and flash enabled'],
['**Half and full rack**','More servers in the same rack'],
['**Elastic**','Add database or storage servers one at a time, up to the rack limit'],
['**Multi-rack**','Connect racks through spine switches into one system']]},
{h:'What to add when'},
{t:[['Need','Add'],
['More CPU or memory','Database servers'],
['More capacity or scan bandwidth','Storage servers'],
['More of everything','A second rack']]},
{h:'Capacity on demand'},
{p:'Some models allow you to enable only part of the CPU cores and add more later. This matches the database licence cost to what you really use.'},
{flow:['Measure current CPU and I/O use','Forecast growth','Decide whether CPU or storage will limit first','Add the right servers','Rebalance ASM and add RAC instances if needed']},
{note:'Storage and compute grow independently, so you only buy what you need. Check the supported maximum for each rack type in the Owner Guide.'}],
src:[['Exadata rack configurations',O.EXA]]};

/* ---------- 6: Practical ---------- */
L['ora-exa:1:6']={blocks:[
{p:'Read a rack plan like an Exadata engineer. Use the plan below and answer the questions.'},
{h:'The plan'},
{t:[['Component','Count','Notes'],
['Database servers','2','Run RAC database `prod` as one cluster'],
['Storage servers (cells)','3','Normal redundancy ASM, 2 disk groups: DATA and RECO'],
['RoCE leaf switches','2','Each server uses both'],
['Management switch','1','Admin and ILOM ports'],
['PDUs','2','Each server has two power feeds'],
['Client network','`bondeth0`, subnet 10.1.1.0/24','SCAN and VIPs here'],
['Backup network','`bondeth1`, subnet 10.1.2.0/24','Backup server and standby traffic'],
['Admin network','192.168.9.0/24','SSH and ILOM']]},
{h:'Questions'},
{ul:['Which network carries Cache Fusion and I/O to the cells?','What happens if one leaf switch fails?','Which network should the nightly backup use?','How many cell failures can ASM normal redundancy survive at once?','What file on a database server lists the cells?','Which interface do application clients use?']},
{h:'Answers'},
{t:[['Question','Answer'],
['Network for Cache Fusion and cell I/O','The private RoCE fabric'],
['One leaf switch fails','Each server still has a path through the other switch. Performance is reduced but there is no outage.'],
['Network for backup','`bondeth1`, the backup network'],
['Cell failures survived','One cell at a time, as long as free space allows ASM to rebuild redundancy'],
['File listing cells','`/etc/oracle/cell/network-config/cellip.ora`'],
['Client interface','`bondeth0`']]},
{flow:['Identify the networks and their purpose','Look for single points of failure','Check capacity of the cells and free space for rebuild','Match each traffic type to its network']},
{h:'Challenge'},
{p:'Draw your own diagram of this rack with every cable path. Mark the single points of failure, if any.'},
{note:'In a real project this plan is built with Oracle Exadata Deployment Assistant. The same questions apply: networks, redundancy and capacity.'}],
src:[['Exadata Database Machine Owner Guide',O.EXA]]};

})();
