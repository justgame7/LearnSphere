/* LearnSphere - Azure Administrator, Section 09: Virtual Machines & Scale Sets.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const vm=K.dg(700,260,[
[10,10,680,240,'What a VM is made of',1],
[30,50,150,50,'Image|OS and software',0],[30,115,150,50,'Size|vCPU and memory',0],[30,180,150,50,'Region and zone',0],
[250,60,170,130,'Virtual machine|compute you pay for|while allocated',2],
[490,45,170,45,'OS disk and data disks',0],[490,105,170,45,'Network interface|and IP',0],[490,165,170,45,'Extensions and identity',0]],
[[180,75,250,105],[180,140,250,125],[180,205,250,150],[420,100,490,67],[420,125,490,127],[420,150,490,187]]);

const avail=K.dg(700,260,[
[10,10,680,240,'Spread to survive failures',1],
[30,45,200,190,'Availability zone 1',1],[250,45,200,190,'Availability zone 2',1],[470,45,200,190,'Availability zone 3',1],
[60,90,140,45,'VM A',0],[280,90,140,45,'VM B',0],[500,90,140,45,'VM C',0],
[60,160,140,45,'Own power,|network',0],[280,160,140,45,'Own power,|network',0],[500,160,140,45,'Own power,|network',0]],
[]);

const scale=K.dg(700,220,[
[10,10,680,200,'Autoscale',1],
[30,60,140,80,'Metric or schedule|CPU above 70 percent',0],[220,60,140,80,'Autoscale rule|add 1 instance',2],[410,60,120,80,'Scale set|3 to 4 VMs',0],[580,60,90,80,'Load|balanced',0]],
[[170,100,220,100],[360,100,410,100],[530,100,580,100]]);

/* ---------- 0 ---------- */
L['az:8:0']={blocks:[
{p:'An Azure **virtual machine** gives you a server you manage: you choose the operating system image, how much CPU and memory it has, and the disks and network it uses.'},
{svg:vm},
{h:'Images'},
{ul:['**Marketplace images**: Windows Server, Ubuntu, Red Hat and many vendor images.','**Custom images**: your own captured or built images.','**Azure Compute Gallery**: versioned, shareable images across regions.']},
{h:'Size families'},
{t:[['Family','Optimized for','Example'],
['**B**','Burstable, low baseline CPU','`Standard_B2s`'],
['**D**','General purpose','`Standard_D4s_v5`'],
['**E**','Memory-heavy, databases','`Standard_E8s_v5`'],
['**F**','Compute-heavy','`Standard_F8s_v2`'],
['**L**','High disk throughput','`Standard_L8s_v3`'],
['**N**','GPU','`Standard_NC6s_v3`']]},
{p:'A size name is read as family, vCPU count, features and version. In `Standard_D4s_v5`, **D** is the family, **4** is vCPUs, **s** means premium storage support and **v5** is the generation.'},
{h:'Cost model'},
{ul:['Compute is billed per second **while the VM is allocated**.','Disks, public IPs and snapshots bill separately, even when the VM is deallocated.','Not all sizes are available in every region, zone or subscription quota.']},
{code:`az vm list-sizes --location westeurope --query "[?numberOfCores==\`4\`].name" -o tsv
az vm list-skus --location westeurope --size Standard_D4s --output table`}],
src:[['Sizes for virtual machines',K.VM+'sizes/overview'],['Virtual Machines overview',K.VM+'overview']]};

/* ---------- 1 ---------- */
L['az:8:1']={blocks:[
{p:'A VM needs a resource group, a name, a region, an image, a size, an authentication method and a network. The portal, CLI, PowerShell and templates all create the same resources.'},
{flow:['Choose resource group, name, region and availability option','Choose image and size','Set administrator account (SSH key for Linux, password for Windows)','Configure disks, network interface, subnet, public IP and NSG','Review and create']},
{h:'Linux with a key'},
{code:`az vm create \\
  --resource-group rg-vm --name vm-linux01 --location westeurope \\
  --image Ubuntu2204 --size Standard_B2s \\
  --admin-username azureuser --generate-ssh-keys \\
  --public-ip-sku Standard --nsg-rule SSH`},
{h:'Windows'},
{code:`az vm create --resource-group rg-vm --name vm-win01 --image Win2022Datacenter --size Standard_D2s_v5 --admin-username azadmin --admin-password "<strong-password>"`},
{h:'PowerShell'},
{code:`$cred = Get-Credential
New-AzVM -ResourceGroupName rg-vm -Name vm-win02 -Location westeurope -Image Win2022Datacenter -Size Standard_D2s_v5 -Credential $cred -OpenPorts 3389`},
{h:'What gets created'},
{t:[['Resource','Purpose'],
['Virtual machine','The compute resource'],
['OS disk','Managed disk with the operating system'],
['Network interface','Connects the VM to a subnet'],
['Public IP (optional)','External address, avoid in production'],
['Network security group','Inbound and outbound rules'],
['Virtual network and subnet','Created if none specified']]},
{note:'Deleting a VM does not delete its disks, NIC or public IP by default. Delete the whole resource group, or set delete options when creating.'}],
src:[['Create a Linux VM with CLI',K.VM+'linux/quick-create-cli'],['Create a Windows VM with PowerShell',K.VM+'windows/quick-create-powershell']]};

/* ---------- 2 ---------- */
L['az:8:2']={blocks:[
{p:'VMs use **managed disks**, block storage whose underlying storage accounts Azure manages for you.'},
{h:'Disk roles'},
{t:[['Disk','Notes'],
['**OS disk**','Holds the operating system. Persistent'],
['**Data disk**','Additional persistent storage you attach'],
['**Temporary disk**','Local to the host, lost on redeploy or resize. Never store important data']]},
{h:'Disk types'},
{t:[['Type','Media','Use'],
['**Standard HDD**','HDD','Backups, rarely accessed'],
['**Standard SSD**','SSD','Web servers, light workloads'],
['**Premium SSD**','SSD','Production workloads'],
['**Premium SSD v2**','SSD, configurable IOPS and throughput','Databases, high performance with tuning'],
['**Ultra Disk**','SSD, highest performance','Very demanding, latency-sensitive']]},
{h:'Attach and use'},
{code:`az disk create -g rg-vm -n data01 --size-gb 128 --sku Premium_LRS
az vm disk attach -g rg-vm --vm-name vm-linux01 --name data01
az vm disk detach -g rg-vm --vm-name vm-linux01 --name data01`},
{p:'After attaching, the disk is **raw**. Initialize, partition and format it inside the guest operating system, or it will not appear as usable storage.'},
{h:'Other features'},
{ul:['**Snapshots** and **images** of disks.','**Shared disks** for clustering.','**Ephemeral OS disks** on local storage for stateless workloads.','Disk size controls performance tier for Premium SSD, and data disk count is limited by VM size.']}],
src:[['Managed disk types',K.VM+'disks-types'],['Attach a data disk',K.VM+'linux/attach-disk-portal']]};

/* ---------- 3 ---------- */
L['az:8:3']={blocks:[
{p:'Disks are encrypted at rest by default. Several options add control or end-to-end protection.'},
{t:[['Option','Where encryption happens','Keys','Notes'],
['**Server-side encryption (SSE)**','Storage platform','Platform-managed (default) or customer-managed','Always on'],
['**Encryption at host**','On the VM host, includes temp disk and caches','Platform or customer-managed','Data encrypted before it reaches storage'],
['**Azure Disk Encryption (ADE)**','Inside the guest OS with BitLocker or dm-crypt','Keys in Key Vault','Needs an extension and Key Vault in the same region'],
['**Confidential disk encryption**','Tied to a confidential VM','Platform or customer-managed','Protects the OS disk with the VM TPM']]},
{h:'Choosing'},
{ul:['Default SSE meets most needs with no action.','Use **customer-managed keys** through a **disk encryption set** when you must control and rotate keys.','Use **encryption at host** when you also need temp disk and caches encrypted.','ADE is guest-based and has requirements and limits. Microsoft recommends encryption at host for new work, so check the retirement guidance before choosing ADE.']},
{code:`az vm encryption enable -g rg-vm -n vm-win01 --disk-encryption-keyvault kv-demo
az vm update -g rg-vm -n vm-linux01 --set securityProfile.encryptionAtHost=true`},
{note:'Encryption at host needs the feature registered on the subscription and a supported size, and the VM must be deallocated to change it.'}],
src:[['Disk encryption overview',K.VM+'disk-encryption-overview'],['Server-side encryption of managed disks',K.VM+'disk-encryption']]};

/* ---------- 4 ---------- */
L['az:8:4']={blocks:[
{p:'You connect to Windows VMs with **RDP (3389)** and Linux VMs with **SSH (22)**. The risk is exposing those ports to the internet.'},
{t:[['Method','How','Notes'],
['**Public IP and open port**','Direct RDP or SSH','Easy and risky. Restrict to your IP or avoid'],
['**Just-in-time access**','Defender for Cloud opens a port temporarily','Reduces exposure window'],
['**Azure Bastion**','Browser or native client over TLS to the private IP','No public IP and no open port on the VM'],
['**VPN or ExpressRoute**','Private network path','Common for administrators on premises']]},
{flow:['User opens the VM and chooses Connect','Bastion authenticates the user with Entra and RBAC','Bastion connects to the VM private IP over RDP or SSH','No public IP or inbound rule on the VM is required']},
{code:`# Linux
ssh azureuser@<public-or-private-ip>

# Windows (mstsc), or use az to start a Bastion native client connection
az network bastion rdp --name bastion01 --resource-group rg-net --target-resource-id <vm-id>`},
{note:'Bastion is covered in Section 12. The key idea here is that a production VM should not have a public IP with RDP or SSH open to the world.'}],
src:[['Connect to a Windows VM',K.VM+'windows/connect-rdp'],['Connect to a Linux VM',K.VM+'linux/ssh-from-windows']]};

/* ---------- 5 ---------- */
L['az:8:5']={blocks:[
{p:'To survive failures, deploy more than one VM and spread them so a single fault does not take down all of them.'},
{svg:avail},
{t:[['Option','Protects against','Typical SLA'],
['**Single VM, Premium SSD or Ultra**','Nothing beyond host SLA','99.9%'],
['**Availability set**','Rack failure and planned maintenance within one datacenter','99.95%'],
['**Availability zones**','A whole datacenter failure','99.99%']]},
{h:'Availability set concepts'},
{ul:['**Fault domain**: group of hardware sharing power and network. Spread across up to three fault domains.','**Update domain**: group that is rebooted together during platform maintenance, up to 20.','VMs in a set are placed across them automatically.']},
{h:'Zones'},
{ul:['A zonal VM is **pinned** to a zone. Place copies in different zones and put a load balancer in front.','Zones are chosen at **creation**, you cannot add an existing VM to a zone without recreating it.','Zone-redundant services such as Standard Load Balancer or ZRS disks complete the design.']},
{code:`az vm create -g rg-vm -n vm-a --zone 1 --image Ubuntu2204 --size Standard_B2s --generate-ssh-keys
az vm availability-set create -g rg-vm -n avset1 --platform-fault-domain-count 3 --platform-update-domain-count 5`},
{note:'Use zones when the region supports them, and availability sets where it does not. A set and a zone cannot be combined for the same VM.'}],
src:[['Availability options for VMs',K.VM+'availability'],['Availability sets',K.VM+'availability-set-overview']]};

/* ---------- 6 ---------- */
L['az:8:6']={blocks:[
{p:'You can change a VM **size** when requirements change. Whether it needs a stop depends on whether the new size is available on the cluster hosting the VM.'},
{flow:['List sizes available for the VM','If the target size is listed, resize with a restart','If it is not listed, deallocate the VM first','Resize while deallocated and start again','Confirm the new size and the application']},
{code:`az vm list-vm-resize-options -g rg-vm -n vm-linux01 -o table
az vm resize -g rg-vm -n vm-linux01 --size Standard_D4s_v5

# when the size is not on the current cluster
az vm deallocate -g rg-vm -n vm-linux01
az vm resize -g rg-vm -n vm-linux01 --size Standard_E8s_v5
az vm start -g rg-vm -n vm-linux01`},
{h:'Effects'},
{ul:['A resize **restarts** the VM. Plan the maintenance window.','Deallocating can **change the public IP** if it is dynamic and releases a Basic-style IP assignment.','The **temporary disk** content is lost.','The new size must support the number of data disks and the disk type in use.']},
{note:'Resize failures are usually about quota in the region or a size unavailable in the zone. Check usage with `az vm list-usage`.'}],
src:[['Change the size of a VM',K.VM+'resize-vm']]};

/* ---------- 7 ---------- */
L['az:8:7']={blocks:[
{p:'Moving a VM means different things depending on where it goes.'},
{t:[['Destination','Method','Notes'],
['**Another resource group** or **subscription**','Resource move','Resource ID changes, short outage, related resources move together'],
['**Another region**','Azure Resource Mover, Azure Site Recovery replication or re-creation','A real move involves new resources in the target region'],
['**Another zone**','Re-create from a disk snapshot or replicate','Zones cannot be changed in place']]},
{h:'Moving within a region'},
{code:`az resource move --destination-group rg-new --ids $(az vm show -g rg-vm -n vm-linux01 --query id -o tsv)`},
{ul:['Move the VM with its **dependent** resources: disks, NIC, public IP, NSG, and the virtual network if required.','Both the source and target groups are locked for writes during the move.','Extensions, backup and some features need attention after a move.','Moves across subscriptions must stay in the same Entra tenant.']},
{h:'Moving to another region'},
{flow:['Check the target region supports the VM size and features','Prepare the target network and resources','Replicate the VM with Resource Mover or Site Recovery','Test, then cut over','Remove the source resources after validation']},
{note:'Resource groups do not have a region for their contents, so a group move never changes the region of the VMs.'}],
src:[['Move a VM to another region',K.D+'resource-mover/tutorial-move-region-virtual-machines'],['Move resources',K.ARM+'management/move-resource-group-and-subscription']]};

/* ---------- 8 ---------- */
L['az:8:8']={blocks:[
{p:'A **virtual machine scale set (VMSS)** manages a group of VMs as one unit and can add or remove instances automatically.'},
{svg:scale},
{h:'Orchestration modes'},
{t:[['Mode','Description','Use'],
['**Flexible** (recommended)','Instances are regular VMs with fine control, zones and mixed sizes','Most new deployments'],
['**Uniform**','All instances identical from one model','Large stateless fleets, legacy automation']]},
{h:'Autoscale'},
{ul:['**Metric-based**: add instances when CPU is high, remove when low.','**Schedule-based**: more capacity at known busy times.','Set **minimum, maximum and default** instance counts.','Use a **cool-down** to avoid flapping.']},
{code:`az vmss create -g rg-vmss -n vmss01 --image Ubuntu2204 --vm-sku Standard_B2s --instance-count 2 --orchestration-mode Flexible --zones 1 2 3 --lb lb-vmss --generate-ssh-keys

az monitor autoscale create -g rg-vmss --resource vmss01 --resource-type Microsoft.Compute/virtualMachineScaleSets --name auto1 --min-count 2 --max-count 6 --count 2
az monitor autoscale rule create -g rg-vmss --autoscale-name auto1 --condition "Percentage CPU > 70 avg 5m" --scale out 1
az monitor autoscale rule create -g rg-vmss --autoscale-name auto1 --condition "Percentage CPU < 30 avg 5m" --scale in 1`},
{note:'Scale in must be paired with scale out, with different thresholds. Otherwise instances are added and never removed.'}],
src:[['Virtual machine scale sets overview',K.D+'virtual-machine-scale-sets/overview'],['Autoscale',K.MON+'autoscale/autoscale-overview']]};

/* ---------- 9 ---------- */
L['az:8:9']={blocks:[
{p:'Deploy a VM, resize it, move it to another resource group, and scale a set out and in.'},
{flow:['Create a resource group and an Ubuntu VM with no public IP exposure beyond SSH from your address','Add a data disk, then initialize and mount it','Resize from B2s to D2s_v5','Move the VM and its resources to a new resource group','Create a scale set with autoscale and generate load','Observe instance count change, then delete everything']},
{code:`az group create -n rg-p1 -l westeurope
az vm create -g rg-p1 -n vm1 --image Ubuntu2204 --size Standard_B2s --admin-username azureuser --generate-ssh-keys
az vm disk attach -g rg-p1 --vm-name vm1 --name data1 --size-gb 32 --new
az vm resize -g rg-p1 -n vm1 --size Standard_D2s_v5
az group create -n rg-p2 -l westeurope
az resource move --destination-group rg-p2 --ids $(az resource list -g rg-p1 --query "[].id" -o tsv)`},
{h:'Checks'},
{t:[['Step','Expect'],
['Disk attach','Disk visible as an unformatted device in the guest'],
['Resize','VM restarts and shows the new size'],
['Move','New resource IDs under rg-p2'],
['Autoscale','Instance count rises under CPU load and falls after cool-down']]},
{note:'Move the dependent resources with the VM, or the move validation fails. Delete both resource groups at the end.'}],
src:[['Tutorial: create a scale set',K.D+'virtual-machine-scale-sets/']]};

})();
