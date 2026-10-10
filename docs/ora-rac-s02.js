/* LearnSphere - Grid Infrastructure, ASM & RAC, Section 02: Lab Preparation & Prerequisites.
   Lectures 0-7 are core, 8-13 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const lab=O.dg(700,270,[
[10,10,330,175,'Node 1: rac1',1],[30,45,130,50,'Grid + DB software|OS: Oracle Linux',0],[180,45,140,50,'Public NIC|Private NIC',2],
[360,10,330,175,'Node 2: rac2',1],[380,45,130,50,'Grid + DB software|OS: Oracle Linux',0],[530,45,140,50,'Public NIC|Private NIC',2],
[30,115,290,55,'Public network: clients, VIPs, SCAN',0],[380,115,290,55,'Private network: interconnect only',0],
[10,200,680,60,'Shared storage: disks seen by both nodes (voting, OCR, DATA, FRA)',2]],[]);

const net=O.dg(700,160,[
[10,20,130,55,'Client|connects to SCAN',0],[190,20,150,55,'SCAN|3 addresses|rac-scan',2],[390,20,140,55,'Node VIP|rac1-vip|rac2-vip',0],[580,20,110,55,'Node public IP|rac1, rac2',0],
[10,100,680,45,'Private interconnect: separate subnet, no gateway, used only between nodes',0]],
[[140,47,190,47],[340,47,390,47],[530,47,580,47]]);

/* ---------- 0: Lab architecture ---------- */
L['ora-rac:1:0']={blocks:[
{p:'A RAC lab needs more planning than a single database. You need **at least two nodes**, **three kinds of network** and **disks that both nodes can see**. This lecture shows the target design before you build it.'},
{svg:lab},
{h:'The pieces'},
{t:[['Piece','Purpose'],
['**Two nodes**','Servers (or virtual machines) named for example `rac1` and `rac2`'],
['**Public network**','Clients, the node IPs, VIPs and the SCAN'],
['**Private network**','Cache Fusion and cluster heartbeat. Nodes only.'],
['**Shared storage**','The same disks visible from both nodes (voting files, OCR, database)']]},
{h:'Lab options'},
{t:[['Option','Good for','Watch out'],
['**VirtualBox or VMware**','Learning on a single PC','Needs about 16 GB RAM for two nodes. Shared disks need special settings.'],
['**Cloud virtual machines**','Realistic networks','Shared block storage rules differ per cloud, and cost accumulates'],
['**Containers**','Not suitable','Clusterware needs full OS control']]},
{h:'Naming used in this course'},
{t:[['Item','Name'],
['Nodes','`rac1`, `rac2`'],
['Cluster','`racdemo`'],
['SCAN','`rac-scan`'],
['Database','`orcl` (instances `orcl1`, `orcl2`)']]},
{flow:['Decide node names and the IP plan','Build one VM and prepare the OS','Clone it for the second node','Attach the shared disks to both','Check everything with cluvfy before installing']},
{note:'Every mistake in a prerequisite shows up later as an installer failure. Take your time here: a good lab design saves hours.'}],
src:[['Grid Infrastructure Installation Guide for Linux',D+'cwlin/'],['RAC Administration',O.RAC]]};

/* ---------- 1: Hardware ---------- */
L['ora-rac:1:1']={blocks:[
{p:'Grid Infrastructure and a database instance together need more memory and disk than a single database. Check the figures against the installation guide for your release before you buy or allocate.'},
{h:'Per node (lab guideline for 19c)'},
{t:[['Resource','Minimum','Comfortable lab'],
['**RAM**','8 GB','12 GB'],
['**Swap**','Per the guide (about the size of RAM for small servers)','8 GB'],
['**Grid home disk**','About 12 GB','30 GB with room for patches'],
['**Database home disk**','About 10 GB','20 GB'],
['**/tmp**','1 GB free','5 GB'],
['**CPUs**','2','2 to 4'],
['**Network adapters**','2 (public and private)','2 (3 if you add storage network)']]},
{h:'Shared disks'},
{t:[['Use','Size in a lab','Notes'],
['**OCR and voting files**','3 disks of 5 GB for NORMAL redundancy','One disk of 10 GB is enough for EXTERNAL in a lab'],
['**DATA** disk group','20 GB or more','Database files'],
['**FRA** disk group','10 GB or more','Backups and archive logs']]},
{flow:['Add up RAM for the OS, Grid and the database SGA','Check disk for homes, logs and patches','Plan shared disks for the disk groups','Check the planned sizes against the installation guide']},
{h:'Estimating RAM'},
{t:[['Consumer','Typical'],
['Operating system','1 GB'],
['Grid Infrastructure (ASM, Clusterware)','2 to 3 GB'],
['Database SGA and PGA','2 to 3 GB for a lab']]},
{note:'A node that swaps will miss its heartbeat and be evicted. In a RAC lab, too little RAM causes strange eviction errors, so give the nodes enough memory and avoid overcommitting the host.'}],
src:[['Hardware requirements',D+'cwlin/']]};

/* ---------- 2: OS preparation ---------- */
L['ora-rac:1:2']={blocks:[
{p:'On each node, prepare the operating system the same way. The **preinstall package** does most of the work on Oracle Linux. You then add the grid user and ASM groups.'},
{h:'Packages and kernel settings'},
{code:`sudo dnf install -y oracle-database-preinstall-19c
sudo systemctl disable --now firewalld          # or open the required ports
sudo sed -i 's/^SELINUX=.*/SELINUX=permissive/' /etc/selinux/config
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled`},
{h:'Users and groups'},
{p:'User and group **IDs must be identical on all nodes**. Different IDs cause permission errors on shared storage.'},
{t:[['Group','Used for'],
['`oinstall`','Install owner and inventory'],
['`dba`','SYSDBA'],
['`asmadmin`','SYSASM (ASM administration)'],
['`asmdba`','Database access to ASM'],
['`asmoper`','ASM start and stop'],
['`racdba`, `backupdba`, `dgdba`, `kmdba`, `oper`','Narrow administrative roles']]},
{code:`groupadd -g 54327 asmdba
groupadd -g 54328 asmoper
groupadd -g 54329 asmadmin
useradd -u 54331 -g oinstall -G dba,asmadmin,asmdba,asmoper,racdba grid
usermod -a -G asmdba oracle`},
{h:'Directories'},
{code:`mkdir -p /u01/app/19.0.0/grid /u01/app/grid /u01/app/oracle
chown -R grid:oinstall /u01/app/19.0.0 /u01/app/grid
chown -R oracle:oinstall /u01/app/oracle
chmod -R 775 /u01`},
{t:[['Path','Meaning'],
['`/u01/app/19.0.0/grid`','Grid home (software)'],
['`/u01/app/grid`','Grid base (logs and diagnostics)'],
['`/u01/app/oracle`','Database base']]},
{flow:['Run the preinstall package on every node','Create the same users, groups and IDs on every node','Create the same directories with the correct owner','Set limits and kernel parameters','Reboot and check']},
{note:'The Grid home must be on a local disk of each node and not on shared storage. Keep paths identical on all nodes.'}],
src:[['Preparing the OS for Grid Infrastructure',D+'cwlin/']]};

/* ---------- 3: Networking ---------- */
L['ora-rac:1:3']={blocks:[
{p:'RAC networking is the most common source of install problems. Know each address type and where it lives.'},
{svg:net},
{t:[['Address','Count','Network','Notes'],
['**Public IP**','1 per node','Public','Static, fixed hostname'],
['**VIP**','1 per node','Public subnet, unused address','Moves to another node if its node fails'],
['**SCAN**','**3** addresses recommended','Public subnet','One name for the whole cluster. Resolve with DNS round robin.'],
['**Private IP**','1 per node','Private only','Interconnect. No gateway, no DNS needed.']]},
{h:'Rules'},
{ul:['The public and private networks use **different subnets**.','The VIP and SCAN addresses must be **unused** and in the public subnet.','The private network is a **dedicated** network: no other traffic, ideally 10 Gb or faster in production.','Never use the public NIC for the interconnect. Heartbeat delays would evict nodes.']},
{h:'Example plan'},
{t:[['Name','IP','Type'],
['rac1','192.168.56.101','public'],
['rac2','192.168.56.102','public'],
['rac1-vip','192.168.56.111','VIP'],
['rac2-vip','192.168.56.112','VIP'],
['rac-scan','192.168.56.121, .122, .123','SCAN (DNS)'],
['rac1-priv','10.10.10.1','private'],
['rac2-priv','10.10.10.2','private']]},
{p:'Production needs DNS for the SCAN. In a small lab, many people use one SCAN address in `/etc/hosts`, which works with a cluvfy warning.'},
{code:`# /etc/hosts (lab)
192.168.56.101 rac1.example.com rac1
192.168.56.102 rac2.example.com rac2
192.168.56.111 rac1-vip.example.com rac1-vip
192.168.56.112 rac2-vip.example.com rac2-vip
192.168.56.121 rac-scan.example.com rac-scan
10.10.10.1     rac1-priv
10.10.10.2     rac2-priv`},
{note:'The VIPs and SCAN do not need to be configured on any interface before the installation. Grid Infrastructure creates them. They only need to be free and resolvable.'}],
src:[['Network configuration',D+'cwlin/']]};

/* ---------- 4: Time sync ---------- */
L['ora-rac:1:4']={blocks:[
{p:'All nodes must agree on the time. Clocks that drift cause confusing log timestamps and, worse, eviction problems. Use **chrony** (or NTP) on every node.'},
{h:'Two ways to keep time'},
{t:[['Method','Meaning'],
['**chrony or NTP**','The OS keeps time from a time server. Clusterware CTSS runs in observer mode.'],
['**CTSS active mode**','If no time service exists, Oracle Cluster Time Synchronization Service keeps the nodes in step with each other.']]},
{p:'Oracle recommends an OS time service such as chrony in production.'},
{code:`sudo dnf install -y chrony
sudo systemctl enable --now chronyd

chronyc tracking             # offset from the reference
chronyc sources -v           # time servers in use`},
{h:'Verify with cluvfy'},
{code:`cluvfy comp clocksync -n rac1,rac2 -verbose`},
{flow:['Install and enable chrony on every node','Point all nodes at the same time sources','Check the offset is small (milliseconds)','Run the clock synchronisation check in cluvfy']},
{note:'Never step the clock backwards on a running cluster node. Large jumps can cause evictions. Let chrony slew the time slowly.'}],
src:[['Time synchronisation',D+'cwlin/']]};

/* ---------- 5: Shared storage ---------- */
L['ora-rac:1:5']={blocks:[
{p:'Both nodes must see the same disks, and the device names must stay the same after a reboot. Linux can rename devices (`/dev/sdb` may become `/dev/sdc`), so use a **persistent naming** method.'},
{h:'Persistence options'},
{t:[['Method','How it works','Notes'],
['**udev rules**','A rule matches the disk by its unique ID and gives it a stable name and owner','Simple and common'],
['**ASM Filter Driver (AFD)**','Oracle driver labels the disk and filters invalid writes','Recommended by Oracle where available'],
['**ASMLib**','Oracle kernel module and tools','Older approach']]},
{h:'udev example'},
{code:`# Find the unique ID of each shared disk
/usr/lib/udev/scsi_id -g -u -d /dev/sdb

# /etc/udev/rules.d/99-oracle-asm.rules
KERNEL=="sd?", SUBSYSTEM=="block", PROGRAM=="/usr/lib/udev/scsi_id -g -u -d /dev/$name", RESULT=="<id-of-disk>", SYMLINK+="oracleasm/ocr1", OWNER="grid", GROUP="asmadmin", MODE="0660"

udevadm control --reload-rules
udevadm trigger
ls -l /dev/oracleasm/`},
{p:'Use the **same rules on every node**, so each node shows the disks with the same names.'},
{h:'Rules for ASM disks'},
{ul:['Give ASM whole disks or a single partition. No file system on them.','Owner `grid`, group `asmadmin`, mode `0660`.','Disks of one disk group should be the same size and speed.','Do not use the same disk for the OS or for anything else.']},
{flow:['Present the same disks to every node','Create persistent names (udev, AFD or ASMLib)','Set owner and permissions','Check the names on all nodes','Use the names in the installer']},
{note:'A wrongly assigned disk can be overwritten by the installer. Check the disk IDs twice before you give a disk to ASM.'}],
src:[['Configuring storage for ASM',D+'cwlin/'],['ASM Administrator Guide',O.ASM]]};

/* ---------- 6: SSH and CVU ---------- */
L['ora-rac:1:6']={blocks:[
{p:'The installer copies files and runs commands on the other nodes using SSH. It needs **passwordless SSH** for the grid and oracle users. The **Cluster Verification Utility (cluvfy)** then checks that everything is ready.'},
{h:'Passwordless SSH'},
{code:`# As grid, on rac1
ssh-keygen -t rsa -b 4096
ssh-copy-id grid@rac1
ssh-copy-id grid@rac2

ssh rac2 date           # must not prompt for a password`},
{p:'`gridSetup.sh` can also set up the equivalence for you from its own screen. Repeat for the **oracle** user before the database install.'},
{h:'Cluster Verification Utility'},
{p:'`runcluvfy.sh` is in the unzipped Grid home. Run it before the install.'},
{code:`cd /u01/app/19.0.0/grid
./runcluvfy.sh stage -pre crsinst -n rac1,rac2 -verbose

# Let it generate fix-up scripts for failed checks
./runcluvfy.sh stage -pre crsinst -n rac1,rac2 -fixup`},
{t:[['Result','Meaning'],
['**PASSED**','Check succeeded'],
['**WARNING**','Allowed but not ideal. Read it.'],
['**FAILED**','Fix before you continue']]},
{h:'Common checks'},
{t:[['Check','Verifies'],
['Node connectivity','Public and private networks'],
['SCAN and VIP','Names resolve to the right addresses'],
['Shared storage','Disks are visible and accessible on every node'],
['Time and kernel','Clock sync and parameters'],
['Users and groups','Same IDs on all nodes']]},
{flow:['Set up SSH for each user','Run cluvfy for the pre-install stage','Fix every FAILED item','Repeat until nothing fails','Start the installer']},
{note:'cluvfy is cheap to run and catches most problems before they become failed installs. Run it again after every change.'}],
src:[['Cluster Verification Utility',O.CW]]};

/* ---------- 7: Practical ---------- */
L['ora-rac:1:7']={blocks:[
{p:'Build a two-node lab up to the point where `cluvfy` passes. Do not install Grid Infrastructure yet. That is the next section.'},
{h:'Checklist'},
{flow:['Create VM rac1 with two NICs and the shared disks','Install Oracle Linux and the preinstall package','Create the grid user, groups, directories','Set up hosts, chrony, udev rules','Clone the VM as rac2 and change names and addresses','Set up SSH for grid and oracle','Run cluvfy and fix everything that fails']},
{h:'Commands to run on each node'},
{code:`hostname -f
ip addr show | grep inet
ping -c 2 rac1; ping -c 2 rac2
ping -c 2 rac1-priv; ping -c 2 rac2-priv
chronyc tracking | head -3
ls -l /dev/oracleasm/
id grid; id oracle`},
{h:'Final check'},
{code:`cd /u01/app/19.0.0/grid
./runcluvfy.sh stage -pre crsinst -n rac1,rac2 -verbose`},
{h:'What a pass looks like'},
{t:[['Check','Expected'],
['Node connectivity','PASSED for public and private'],
['Time synchronisation','PASSED'],
['Shared storage','PASSED for each disk'],
['User and group IDs','PASSED, identical on both nodes'],
['SCAN','PASSED or a warning for a single SCAN address in a lab']]},
{h:'Common problems'},
{t:[['Symptom','Likely cause'],
['Node connectivity fails on the private network','Wrong subnet, firewall, or wrong NIC'],
['Disks not found on the second node','Not attached as shared, or udev rule missing'],
['SSH asks for a password','Keys not copied for that user'],
['Time check fails','chrony not running or different sources']]},
{note:'Take a VM snapshot at this point. If the install later goes wrong, you can return to this clean state.'}],
src:[['Grid Infrastructure Installation Guide',D+'cwlin/']]};

})();
