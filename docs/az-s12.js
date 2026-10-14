/* LearnSphere - Azure Administrator, Section 12: Network Security, DNS & Load Balancing.
   Lectures 0-10 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const nsg=K.dg(700,240,[
[10,10,680,220,'Where an NSG applies',1],
[30,70,120,70,'Internet',0],[200,50,160,110,'Subnet NSG|evaluated first|for inbound',0],[400,70,140,70,'NIC NSG|evaluated second',0],[580,70,90,70,'VM',2]],
[[150,105,200,105],[360,105,400,105],[540,105,580,105]]);

const bast=K.dg(700,220,[
[10,10,680,200,'Azure Bastion',1],
[30,60,130,70,'Admin|browser or|native client',0],[210,50,150,90,'Bastion host|AzureBastionSubnet',2],[410,50,130,90,'VMs|private IPs only',0],[580,60,90,70,'No public IP',0]],
[[160,95,210,95],[360,95,410,95]]);

const pe=K.dg(700,220,[
[10,10,680,200,'Service endpoint compared with private endpoint',1],
[30,50,300,140,'Service endpoint|Subnet reaches the service public IP|over the Azure backbone|Rule on the service firewall',0],
[370,50,300,140,'Private endpoint|A private IP in your subnet|maps to one resource|Public path can be closed',2]],
[]);

const lbx=K.dg(700,240,[
[10,10,680,220,'Which load balancer',1],
[30,60,150,130,'Load Balancer|layer 4|regional',0],[200,60,150,130,'Application Gateway|layer 7, WAF|regional',2],[370,60,150,130,'Front Door|layer 7, WAF|global',0],[540,60,130,130,'Traffic Manager|DNS based|global',0]],
[]);

const lb=K.dg(700,220,[
[10,10,680,200,'Standard Load Balancer',1],
[30,70,120,70,'Frontend IP',2],[190,70,120,70,'LB rule|port 80',0],[350,50,130,40,'Health probe',0],[350,110,130,40,'Backend pool',0],[530,50,130,40,'VM 1',0],[530,110,130,40,'VM 2',0]],
[[150,105,190,105],[310,105,350,130],[480,130,530,70],[480,130,530,130]]);

/* ---------- 0 ---------- */
L['az:11:0']={blocks:[
{p:'A **network security group (NSG)** is a list of allow and deny rules that filter traffic to and from Azure resources in a VNet. It is stateful, so return traffic for allowed connections is allowed automatically.'},
{svg:nsg},
{h:'Rule properties'},
{t:[['Property','Meaning'],
['**Priority**','100 to 4096. Lower numbers are evaluated first'],
['**Source / destination**','IP, CIDR, service tag, or application security group'],
['**Protocol and port**','TCP, UDP, ICMP, any, with ports or ranges'],
['**Action**','Allow or Deny'],
['**Direction**','Inbound or outbound']]},
{h:'Default rules'},
{t:[['Name','Priority','Effect'],
['AllowVnetInBound','65000','Traffic within the VNet'],
['AllowAzureLoadBalancerInBound','65001','Load balancer probes'],
['DenyAllInBound','65500','All other inbound'],
['AllowVnetOutBound','65000','Traffic within the VNet'],
['AllowInternetOutBound','65001','Outbound to the internet'],
['DenyAllOutBound','65500','All other outbound']]},
{h:'Application security groups'},
{p:'An **ASG** groups NICs by role, such as `asg-web`. You write rules with the ASG as source or destination, so rules follow the VMs and not IP addresses.'},
{code:`az network nsg create -g rg-net -n nsg-web
az network asg create -g rg-net -n asg-web
az network nsg rule create -g rg-net --nsg-name nsg-web -n allow-https --priority 100 --direction Inbound --access Allow --protocol Tcp --source-address-prefixes Internet --destination-asgs asg-web --destination-port-ranges 443
az network vnet subnet update -g rg-net --vnet-name vnet-app -n snet-web --network-security-group nsg-web`}],
src:[['Network security groups',K.NET+'network-security-groups-overview'],['Application security groups',K.NET+'application-security-groups']]};

/* ---------- 1 ---------- */
L['az:11:1']={blocks:[
{p:'A NIC can be covered by **two** NSGs: one on its subnet and one on the NIC. Their rules combine, so you must read the **effective** result.'},
{h:'Evaluation order'},
{t:[['Direction','First','Second'],
['**Inbound**','Subnet NSG','NIC NSG'],
['**Outbound**','NIC NSG','Subnet NSG']]},
{ul:['Traffic must be allowed by **both** NSGs to pass.','Within one NSG, the **lowest priority number** that matches wins and evaluation stops.','Default rules are evaluated last.']},
{h:'Effective security rules'},
{code:`az network nic list-effective-nsg -g rg-net -n nic-vm1 -o table
az network watcher test-ip-flow -g rg-net --vm vm1 --direction Inbound --protocol TCP --local 10.10.1.4:443 --remote 203.0.113.5:50000`},
{p:'In the portal, open the VM NIC and choose **Effective security rules**. It shows every rule from both NSGs and which one wins.'},
{h:'Typical mistakes'},
{t:[['Symptom','Cause'],
['Rule allows 443 but connection fails','Subnet NSG denies it, or a lower number deny exists'],
['Cannot reach a VM from the load balancer','Probe source 168.63.129.16 not allowed'],
['Outbound to the internet blocked','Custom deny rule before the default allow'],
['Rule uses IP of a VM that changed','Use ASGs or static addresses']]}],
src:[['How NSGs filter traffic',K.NET+'network-security-group-how-it-works']]};

/* ---------- 2 ---------- */
L['az:11:2']={blocks:[
{p:'**Azure Bastion** is a managed service that lets you RDP and SSH to VMs over TLS, directly from the portal or a native client, with **no public IP** and no open management ports on the VMs.'},
{svg:bast},
{h:'SKUs'},
{t:[['SKU','Highlights'],
['**Developer**','Free, shared pool, one VM at a time, learning and test'],
['**Basic**','Dedicated host, standard RDP and SSH from the portal'],
['**Standard**','Native client, IP-based connection, shareable links, scale units, file transfer'],
['**Premium**','Session recording and private-only deployment']]},
{h:'Deployment'},
{ul:['Needs a subnet named **AzureBastionSubnet**, minimum **/26**.','Deployed in the VNet, and works with peered VNets (Basic and higher).','Needs a Standard public IP for Basic and Standard SKUs.','The VM NSG must allow RDP or SSH from the Bastion subnet.']},
{code:`az network vnet subnet create -g rg-net --vnet-name vnet-hub -n AzureBastionSubnet --address-prefixes 10.0.250.0/26
az network public-ip create -g rg-net -n pip-bastion --sku Standard --allocation-method Static
az network bastion create -g rg-net -n bastion-hub --vnet-name vnet-hub --public-ip-address pip-bastion --sku Standard`},
{note:'Bastion bills hourly for as long as it exists. Delete it when it is not needed in a lab.'}],
src:[['Azure Bastion',K.D+'bastion/bastion-overview']]};

/* ---------- 3 ---------- */
L['az:11:3']={blocks:[
{p:'**Service endpoints** extend your VNet identity to selected Azure PaaS services, so those services can accept traffic only from your subnets.'},
{flow:['Enable the service endpoint, such as Microsoft.Storage, on a subnet','Add that subnet to the network rules of the PaaS resource','Traffic from the subnet reaches the service over the Azure backbone','The service sees the subnet identity and allows it','Other networks are denied by the firewall']},
{h:'Characteristics'},
{ul:['The service still has a **public IP**, but access is limited by your rule.','Enabled **per subnet and per service type**.','No additional cost.','On-premises traffic through a gateway does not use the endpoint.']},
{code:`az network vnet subnet update -g rg-net --vnet-name vnet-app -n snet-app --service-endpoints Microsoft.Storage
az storage account network-rule add -g rg-storage --account-name stdemoapp001 --vnet-name vnet-app --subnet snet-app
az storage account update -g rg-storage -n stdemoapp001 --default-action Deny`},
{note:'If a subnet is not allowed by the PaaS firewall, you receive an authorization failure even if the service endpoint is enabled.'}],
src:[['Virtual network service endpoints',K.NET+'virtual-network-service-endpoints-overview']]};

/* ---------- 4 ---------- */
L['az:11:4']={blocks:[
{p:'A **private endpoint** is a network interface in your subnet with a **private IP** that connects to a specific Azure resource through **Private Link**. The resource becomes reachable inside your network as if it were deployed there.'},
{svg:pe},
{t:[['','Service endpoint','Private endpoint'],
['**Address used**','Service public IP','Private IP in your subnet'],
['**Scope**','Whole service type in a region','One specific resource'],
['**On-premises access**','No','Yes, over VPN or ExpressRoute'],
['**Public access can be closed**','No, still public','Yes'],
['**Cost**','Free','Hourly plus data processed']]},
{h:'Parts needed'},
{flow:['Create the private endpoint, choosing resource and sub-resource such as blob','Approve the connection if the resource is in another tenant','Create a private DNS zone, for example privatelink.blob.core.windows.net','Link the zone to the VNet and add records','Clients resolve the normal name to the private IP']},
{code:`az network private-endpoint create -g rg-net -n pe-blob --vnet-name vnet-app --subnet snet-pe --private-connection-resource-id $(az storage account show -n stdemoapp001 -g rg-storage --query id -o tsv) --group-id blob --connection-name pe-blob-conn
az network private-dns zone create -g rg-net -n privatelink.blob.core.windows.net
az network private-dns link vnet create -g rg-net -z privatelink.blob.core.windows.net -n link-app -v vnet-app -e false`},
{note:'Private endpoints fail in practice because of DNS more than anything else. Always test name resolution from inside the network.'}],
src:[['Private Link',K.D+'private-link/private-link-overview'],['Private endpoint DNS',K.D+'private-link/private-endpoint-dns']]};

/* ---------- 5 ---------- */
L['az:11:5']={blocks:[
{p:'**Azure DNS** hosts your DNS zones on Azure name servers. It does not register domains, you buy those from a registrar and then delegate the zone to Azure.'},
{h:'Zone and records'},
{t:[['Record','Purpose'],
['**A / AAAA**','Name to IPv4 or IPv6'],
['**CNAME**','Alias to another name'],
['**MX**','Mail routing'],
['**TXT**','Verification and policies such as SPF'],
['**NS**','Name servers of the zone or a delegated child'],
['**Alias record**','Points to an Azure resource such as a public IP and follows it']]},
{flow:['Create the DNS zone in Azure','Note the four name servers Azure assigns','At the registrar, set the domain NS records to those servers','Create records in the Azure zone','Test with nslookup against the Azure name server']},
{code:`az network dns zone create -g rg-dns -n contoso.com
az network dns zone show -g rg-dns -n contoso.com --query nameServers
az network dns record-set a add-record -g rg-dns -z contoso.com -n www --ipv4-address 203.0.113.20
az network dns record-set cname set-record -g rg-dns -z contoso.com -n app --cname webapp-demo-001.azurewebsites.net`},
{note:'The root of a domain cannot hold a CNAME. Use an alias record to point the apex at an Azure resource.'}],
src:[['Azure DNS',K.D+'dns/dns-overview'],['Delegate a domain',K.D+'dns/dns-delegate-domain-azure-dns']]};

/* ---------- 6 ---------- */
L['az:11:6']={blocks:[
{p:'**Private DNS zones** provide name resolution inside virtual networks without running your own DNS servers.'},
{h:'Concepts'},
{ul:['A **private DNS zone** holds records visible only to **linked** VNets.','A **virtual network link** connects a zone to a VNet. A link can enable **auto-registration** of VM records, and each VNet can auto-register in only one zone.','Many services use **privatelink** zones for private endpoints.']},
{code:`az network private-dns zone create -g rg-dns -n corp.internal
az network private-dns link vnet create -g rg-dns -z corp.internal -n link-app -v vnet-app -e true
az network private-dns record-set a add-record -g rg-dns -z corp.internal -n db01 -a 10.10.3.10`},
{h:'Name resolution options'},
{t:[['Option','Use'],
['**Azure-provided DNS** (168.63.129.16)','Default, resolves VM names in the VNet and linked private zones'],
['**Custom DNS server**','Your own DNS servers set on the VNet'],
['**DNS Private Resolver**','Managed resolver for hybrid, forwards between on premises and Azure']]},
{note:'If you set custom DNS on a VNet, those servers must forward unresolved Azure names to 168.63.129.16 or private zones will not resolve.'}],
src:[['Private DNS zones',K.D+'dns/private-dns-overview'],['Name resolution for resources in VNets',K.NET+'virtual-networks-name-resolution-for-vms-and-role-instances']]};

/* ---------- 7 ---------- */
L['az:11:7']={blocks:[
{p:'Azure has four main load-balancing services. They differ in **layer**, **scope** and **features**.'},
{svg:lbx},
{t:[['Service','Layer','Scope','Use'],
['**Azure Load Balancer**','4, TCP and UDP','Regional','Distribute traffic to VMs and scale sets, internal or public'],
['**Application Gateway**','7, HTTP and HTTPS','Regional','Path and host routing, TLS offload, WAF'],
['**Front Door**','7, HTTP and HTTPS','Global','Global entry, acceleration, WAF, caching'],
['**Traffic Manager**','DNS','Global','DNS-based routing across regions and endpoints']]},
{h:'Choosing'},
{flow:['Is the traffic HTTP or HTTPS?','If no, regional: Load Balancer, global: Traffic Manager','If yes and regional: Application Gateway','If yes and global: Front Door','Combine: Front Door in front of regional Application Gateways']},
{note:'The exam favors the global versus regional and HTTP versus non-HTTP distinction. Remember that Traffic Manager does not proxy traffic, it only answers DNS.'}],
src:[['Load-balancing options',K.D+'architecture/guide/technology-choices/load-balancing-overview']]};

/* ---------- 8 ---------- */
L['az:11:8']={blocks:[
{p:'**Azure Load Balancer** distributes inbound flows at layer 4 to healthy instances in a backend pool. Use the **Standard** SKU. Basic was retired.'},
{svg:lb},
{h:'Components'},
{t:[['Part','Role'],
['**Frontend IP configuration**','Public or private address clients use'],
['**Backend pool**','The VMs or scale set instances'],
['**Health probe**','TCP, HTTP or HTTPS check that decides who is healthy'],
['**Load balancing rule**','Maps frontend port to backend port and pool'],
['**Inbound NAT rule**','Maps a frontend port to one specific VM'],
['**Outbound rule**','Controls SNAT for pool members']]},
{h:'Public and internal'},
{ul:['**Public** has a public IP frontend, for internet traffic.','**Internal** has a private IP frontend, for tier-to-tier traffic.','Standard is **zone-redundant** when its IP is.','Distribution is by a **5-tuple hash** by default. Session persistence options use fewer tuples.']},
{code:`az network lb create -g rg-lb -n lb-web --sku Standard --public-ip-address pip-lb --frontend-ip-name fe --backend-pool-name be
az network lb probe create -g rg-lb --lb-name lb-web -n probe80 --protocol Http --port 80 --path /
az network lb rule create -g rg-lb --lb-name lb-web -n rule80 --protocol Tcp --frontend-port 80 --backend-port 80 --frontend-ip-name fe --backend-pool-name be --probe-name probe80`}],
src:[['Azure Load Balancer',K.D+'load-balancer/load-balancer-overview']]};

/* ---------- 9 ---------- */
L['az:11:9']={blocks:[
{p:'When a load-balanced service fails, check the same few things in order.'},
{t:[['Symptom','Likely cause','Check'],
['All backends shown **unhealthy**','Probe port or path wrong, or app not listening','Probe settings, run curl on the VM'],
['Probe fails but app works','NSG blocks 168.63.129.16','Allow the AzureLoadBalancer service tag'],
['Cannot reach frontend at all','NSG on subnet or NIC denies the port, Standard is closed by default','Effective security rules'],
['Some users hit a dead VM','Probe interval too long or wrong protocol','Probe interval and unhealthy threshold'],
['Backend cannot reach internet','No outbound rule or NAT gateway','Outbound configuration'],
['Session sticks to one VM','Session persistence is enabled','Persistence mode']]},
{flow:['Confirm the frontend IP and listener port','Check the health probe result per instance','Check NSGs, including the AzureLoadBalancer tag','Check the guest firewall and that the app listens on the port','Check metrics: data path availability and health probe status']},
{code:`az network lb show -g rg-lb -n lb-web -o table
az network lb probe list -g rg-lb --lb-name lb-web -o table
az monitor metrics list --resource <lb-id> --metric DipAvailability --interval PT1M`},
{note:'Azure Monitor load balancer metrics need the Standard SKU. Use them to see which instance has lost its health.'}],
src:[['Troubleshoot Load Balancer',K.D+'load-balancer/load-balancer-troubleshoot']]};

/* ---------- 10 ---------- */
L['az:11:10']={blocks:[
{p:'Secure and load-balance a two-VM web application: NSG rules, a Standard Load Balancer and Bastion for management, with no public IP on the VMs.'},
{flow:['Create a VNet with web and bastion subnets','Create two VMs with no public IP','Create an NSG that allows port 80 from the internet and attach it to the web subnet','Create a Standard public load balancer with a probe and rule','Deploy Bastion and connect to both VMs to install a web server','Browse the load balancer IP and observe different responses']},
{code:`az network vnet create -g rg-lbp -n vnet-web --address-prefixes 10.30.0.0/16 --subnet-name snet-web --subnet-prefixes 10.30.1.0/24
az network nsg create -g rg-lbp -n nsg-web
az network nsg rule create -g rg-lbp --nsg-name nsg-web -n http --priority 100 --access Allow --protocol Tcp --destination-port-ranges 80 --source-address-prefixes Internet --direction Inbound
az network vnet subnet update -g rg-lbp --vnet-name vnet-web -n snet-web --network-security-group nsg-web
az vm create -g rg-lbp -n vm-web1 --image Ubuntu2204 --vnet-name vnet-web --subnet snet-web --public-ip-address "" --nsg "" --generate-ssh-keys --zone 1
az vm create -g rg-lbp -n vm-web2 --image Ubuntu2204 --vnet-name vnet-web --subnet snet-web --public-ip-address "" --nsg "" --generate-ssh-keys --zone 2`},
{h:'Checks'},
{t:[['Test','Expected'],
['Direct access to a VM from the internet','Impossible, no public IP'],
['Browse the load balancer IP','Page served by either VM'],
['Stop the web service on one VM','Probe marks it unhealthy and traffic goes to the other'],
['Remove the NSG allow rule','Frontend stops responding']]},
{note:'Delete Bastion and the resource group after the lab. Bastion and the load balancer bill by the hour.'}],
src:[['Tutorial: load balance VMs',K.D+'load-balancer/tutorial-load-balancer-standard-public-zonal-portal']]};

})();
