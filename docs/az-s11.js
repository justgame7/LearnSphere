/* LearnSphere - Azure Administrator, Section 11: Virtual Networking.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const vnet=K.dg(700,240,[
[10,10,680,220,'Virtual network 10.10.0.0/16',1],
[30,50,190,70,'Subnet web|10.10.1.0/24',0],[255,50,190,70,'Subnet app|10.10.2.0/24',0],[480,50,190,70,'Subnet data|10.10.3.0/24',0],
[30,140,640,60,'Special subnets: GatewaySubnet, AzureBastionSubnet, AzureFirewallSubnet',2]],
[]);

const nat=K.dg(700,200,[
[10,10,680,180,'Outbound with NAT gateway',1],
[30,60,150,70,'VMs in subnet|private IPs only',0],[270,60,150,70,'NAT gateway|shared static|public IPs',2],[510,60,160,70,'Internet|sees the NAT IP',0]],
[[180,95,270,95],[420,95,510,95]]);

const peer=K.dg(700,200,[
[10,10,680,180,'Peering is not transitive',1],
[30,60,130,70,'Spoke A',0],[285,60,130,70,'Hub',2],[540,60,130,70,'Spoke B',0]],
[[160,95,285,95],[285,110,160,110],[415,95,540,95],[540,110,415,110]]);

const route=K.dg(700,220,[
[10,10,680,200,'Route selection',1],
[30,60,130,70,'Packet to|10.20.0.5',0],[210,50,150,90,'Longest prefix wins|then user route >|BGP > system',2],[410,50,120,40,'Next hop: VNet',0],[410,100,120,40,'Next hop: NVA',0],[570,60,100,70,'Delivered',0]],
[[160,95,210,95],[360,95,410,70],[360,95,410,120],[530,70,570,95],[530,120,570,95]]);

/* ---------- 0 ---------- */
L['az:10:0']={blocks:[
{p:'An Azure **virtual network (VNet)** is your private network in Azure. Resources such as VMs connect to subnets in the VNet and communicate privately with each other.'},
{svg:vnet},
{h:'Planning address space'},
{ul:['Use private ranges from **RFC 1918**: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.','Ranges must **not overlap** with other VNets you will peer or networks you will connect on premises.','Plan for growth. Changing address space later is possible but disruptive.','A VNet belongs to one region, and one subscription.']},
{h:'Subnets'},
{ul:['A subnet is a range inside the VNet address space. Subnets cannot overlap.','Azure reserves **five addresses** in every subnet: network, default gateway, two for DNS, and broadcast.','Some services require **dedicated** subnets with specific names: `GatewaySubnet`, `AzureBastionSubnet`, `AzureFirewallSubnet`.','Use subnets to apply NSGs and route tables to groups of resources.']},
{t:[['Subnet size','Usable addresses'],
['/24','251'],['/26','59'],['/27','27'],['/28','11'],['/29','3 (smallest allowed)']]},
{note:'Choose subnet sizes by what will live there, and leave unused space in the VNet range for future subnets.'}],
src:[['Virtual network concepts',K.NET+'concepts-and-best-practices'],['Plan virtual networks',K.NET+'virtual-network-vnet-plan-design-arm']]};

/* ---------- 1 ---------- */
L['az:10:1']={blocks:[
{p:'Creating a VNet means choosing a name, region, address space and at least one subnet. You can add subnets later.'},
{code:`az network vnet create -g rg-net -n vnet-app -l westeurope --address-prefixes 10.10.0.0/16 --subnet-name snet-web --subnet-prefixes 10.10.1.0/24
az network vnet subnet create -g rg-net --vnet-name vnet-app -n snet-app --address-prefixes 10.10.2.0/24
az network vnet subnet list -g rg-net --vnet-name vnet-app -o table
az network vnet update -g rg-net -n vnet-app --address-prefixes 10.10.0.0/16 10.11.0.0/16`},
{h:'PowerShell'},
{code:`$subnet = New-AzVirtualNetworkSubnetConfig -Name snet-web -AddressPrefix 10.10.1.0/24
New-AzVirtualNetwork -Name vnet-app -ResourceGroupName rg-net -Location westeurope -AddressPrefix 10.10.0.0/16 -Subnet $subnet`},
{h:'Subnet settings'},
{t:[['Setting','Purpose'],
['**NSG** and **route table**','Filter and steer traffic'],
['**Service endpoints**','Private path to selected PaaS services'],
['**Delegation**','Dedicate a subnet to a service such as App Service integration'],
['**NAT gateway**','Outbound addresses for the subnet'],
['**Private endpoint network policies**','Enable NSG and routes on private endpoint traffic']]},
{note:'You cannot resize a subnet that has resources connected to it. Plan sizes before deploying, or move resources.'}],
src:[['Create a virtual network',K.NET+'quick-create-cli'],['Manage subnets',K.NET+'virtual-network-manage-subnet']]};

/* ---------- 2 ---------- */
L['az:10:2']={blocks:[
{p:'IP addresses come in two kinds. **Private IPs** are used inside the VNet and connected networks. **Public IPs** are reachable from the internet.'},
{t:[['','Private IP','Public IP'],
['**Where**','From the subnet range','From Azure public ranges'],
['**Used for**','VM NICs, internal load balancers, private endpoints','Internet-facing VMs, load balancers, gateways'],
['**Allocation**','Dynamic (default) or static','Static for Standard SKU']]},
{h:'Public IP SKUs'},
{t:[['SKU','Notes'],
['**Standard**','Static, zone-redundant option, **secure by default** (closed to inbound until an NSG allows it)'],
['**Basic**','Retired. Existing Basic IPs and Basic load balancers needed upgrade by September 30, 2025']]},
{h:'Allocation'},
{ul:['**Dynamic private** addresses can change when a VM is deallocated and restarted.','**Static private** addresses are reserved for the NIC and are best for DNS servers and domain controllers.','Standard public IPs are always **static**.']},
{code:`az network public-ip create -g rg-net -n pip-web --sku Standard --allocation-method Static --zone 1 2 3
az network nic ip-config update -g rg-net --nic-name nic-vm1 -n ipconfig1 --private-ip-address 10.10.1.10
az network public-ip list -g rg-net -o table`},
{note:'A public IP costs money while it exists, even if unattached. Clean up unused addresses.'}],
src:[['Public IP addresses',K.NET+'ip-services/public-ip-addresses'],['Private IP addresses',K.NET+'ip-services/private-ip-addresses']]};

/* ---------- 3 ---------- */
L['az:10:3']={blocks:[
{p:'VMs often need to reach the internet for updates or APIs. How **outbound** traffic leaves the VNet has changed, so it is important to design it on purpose.'},
{h:'Default outbound access'},
{p:'Historically, a VM with no explicit outbound method got an **implicit default public IP** that Azure assigned and could change. This is being retired: **new virtual networks** created after March 31, 2026 default to **private subnets**, which means no default outbound access and an explicit method is required.'},
{h:'Explicit methods'},
{t:[['Method','Notes'],
['**NAT gateway**','Recommended. Static shared outbound IPs for a subnet, scalable SNAT ports'],
['**Load balancer outbound rules**','Standard load balancer SNAT'],
['**Public IP on the NIC**','Per-VM address, more exposure'],
['**Firewall or virtual appliance**','Central control and inspection with a user-defined route']]},
{svg:nat},
{code:`az network public-ip create -g rg-net -n pip-nat --sku Standard --allocation-method Static
az network nat gateway create -g rg-net -n nat-app --public-ip-addresses pip-nat --idle-timeout 10
az network vnet subnet update -g rg-net --vnet-name vnet-app -n snet-app --nat-gateway nat-app`},
{h:'What to do'},
{ul:['Audit existing subnets for reliance on default outbound access.','Attach a **NAT gateway** to subnets that need internet egress.','Use a single known set of outbound IPs so partners can allow-list you.','Set subnets to **private** (no default outbound) for new designs.']}],
src:[['Default outbound access',K.NET+'ip-services/default-outbound-access'],['NAT gateway',K.NET+'nat-gateway/nat-overview']]};

/* ---------- 4 ---------- */
L['az:10:4']={blocks:[
{p:'**VNet peering** connects two VNets so resources communicate using private IPs over the Microsoft backbone, with low latency and no gateway.'},
{svg:peer},
{h:'Types'},
{t:[['Type','Between'],
['**Regional peering**','VNets in the same region'],
['**Global peering**','VNets in different regions']]},
{h:'Rules'},
{ul:['Peering must be configured in **both directions**. Each side has its own link.','Address spaces **cannot overlap**.','Peering is **not transitive**. A to Hub and Hub to B does not let A reach B, unless traffic goes through a firewall or gateway with routes.','Peering works across subscriptions and tenants with the right permissions.','Option **Allow forwarded traffic** is needed when traffic arrives from a network virtual appliance.']},
{h:'Gateway transit'},
{p:'A spoke can use the VPN or ExpressRoute gateway in the hub. On the hub link enable **Allow gateway transit**. On the spoke link enable **Use remote gateways**.'},
{code:`az network vnet peering create -g rg-net -n hub-to-spoke --vnet-name vnet-hub --remote-vnet vnet-spoke --allow-vnet-access --allow-gateway-transit
az network vnet peering create -g rg-net -n spoke-to-hub --vnet-name vnet-spoke --remote-vnet vnet-hub --allow-vnet-access --use-remote-gateways
az network vnet peering list -g rg-net --vnet-name vnet-hub -o table`}],
src:[['Virtual network peering',K.NET+'virtual-network-peering-overview']]};

/* ---------- 5 ---------- */
L['az:10:5']={blocks:[
{p:'Azure creates **system routes** for each subnet so traffic works without any configuration. You override them with **user-defined routes (UDRs)** when you need to steer traffic.'},
{h:'Default system routes'},
{t:[['Prefix','Next hop','Meaning'],
['VNet address space','Virtual network','Local traffic'],
['`0.0.0.0/0`','Internet','Everything else leaves via the internet'],
['Peered VNet ranges','VNet peering','Added when peering exists'],
['On-premises prefixes','Virtual network gateway','Learned over BGP or static']]},
{svg:route},
{h:'User-defined routes'},
{code:`az network route-table create -g rg-net -n rt-spokes
az network route-table route create -g rg-net --route-table-name rt-spokes -n to-firewall --address-prefix 0.0.0.0/0 --next-hop-type VirtualAppliance --next-hop-ip-address 10.0.0.4
az network vnet subnet update -g rg-net --vnet-name vnet-spoke -n snet-app --route-table rt-spokes`},
{t:[['Next hop type','Use'],
['**Virtual appliance**','Send through a firewall or NVA'],
['**Virtual network gateway**','Send to VPN or ExpressRoute'],
['**Virtual network**','Keep local'],
['**Internet**','Force internet path'],
['**None**','Drop the traffic']]},
{note:'Routes are chosen by **longest prefix match**. If equal, UDR wins over BGP, which wins over system routes.'}],
src:[['Virtual network traffic routing',K.NET+'virtual-networks-udr-overview']]};

/* ---------- 6 ---------- */
L['az:10:6']={blocks:[
{p:'When two resources cannot talk, work through the network path in order: **security rules**, **routes**, then the **destination**. Network Watcher has tools for each step.'},
{t:[['Tool','Answers'],
['**IP flow verify**','Does an NSG rule allow or deny a specific packet to or from a VM?'],
['**Next hop**','Where does traffic from this VM go for a destination?'],
['**Effective routes**','What routes apply on this NIC, and where do they come from?'],
['**Effective security rules**','Which NSG rules apply on this NIC, combined from subnet and NIC?'],
['**Connection troubleshoot / Connection monitor**','Can A reach B on a port, and where does it fail?']]},
{flow:['Confirm both resources are running and get their IPs','Check effective security rules on both NICs','Check effective routes and next hop for the destination','Test the port with connection troubleshoot or from the guest','Check the destination guest firewall and service']},
{code:`az network watcher test-ip-flow -g rg-net --vm vm1 --direction Outbound --protocol TCP --local 10.10.1.4:* --remote 10.10.2.5:443
az network watcher show-next-hop -g rg-net --vm vm1 --source-ip 10.10.1.4 --dest-ip 10.10.2.5
az network nic show-effective-route-table -g rg-net -n nic-vm1 -o table
az network nic list-effective-nsg -g rg-net -n nic-vm1`},
{note:'Network Watcher is enabled per region, and often created automatically. If a command says it is missing, enable it for the region first.'}],
src:[['Network Watcher',K.D+'network-watcher/network-watcher-overview'],['Diagnose VM routing',K.NET+'diagnose-network-routing-problem']]};

/* ---------- 7 ---------- */
L['az:10:7']={blocks:[
{p:'Build a **hub-and-spoke** network: a central hub for shared services and two spokes for workloads, connected with peering.'},
{flow:['Create hub 10.0.0.0/16 and spokes 10.1.0.0/16 and 10.2.0.0/16','Create subnets in each','Peer hub with each spoke in both directions','Deploy a small VM in each spoke','Test spoke-to-hub and observe spoke-to-spoke fails','Add a route and forwarding through the hub to allow spoke-to-spoke']},
{code:`az network vnet create -g rg-hs -n vnet-hub --address-prefixes 10.0.0.0/16 --subnet-name snet-shared --subnet-prefixes 10.0.1.0/24
az network vnet create -g rg-hs -n vnet-s1 --address-prefixes 10.1.0.0/16 --subnet-name snet-app --subnet-prefixes 10.1.1.0/24
az network vnet create -g rg-hs -n vnet-s2 --address-prefixes 10.2.0.0/16 --subnet-name snet-app --subnet-prefixes 10.2.1.0/24
az network vnet peering create -g rg-hs -n hub-s1 --vnet-name vnet-hub --remote-vnet vnet-s1 --allow-vnet-access --allow-forwarded-traffic
az network vnet peering create -g rg-hs -n s1-hub --vnet-name vnet-s1 --remote-vnet vnet-hub --allow-vnet-access --allow-forwarded-traffic`},
{h:'What to observe'},
{t:[['Test','Result'],
['Spoke 1 to hub','Works over the private peering'],
['Spoke 1 to spoke 2','Fails, peering is not transitive'],
['With UDR to hub NVA or firewall','Works when forwarding is enabled on the appliance']]},
{note:'Production hub-and-spoke uses a firewall in the hub and user-defined routes in the spokes. Covered further in the network security section.'}],
src:[['Hub-spoke topology',K.D+'architecture/networking/architecture/hub-spoke']]};

})();
