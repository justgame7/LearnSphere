/* LearnSphere - Google Cloud, Section 04: VPC Networking.
   Lectures 0-9 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const vpc=K.dg(700,300,[
[10,10,680,280,'One global VPC network',1],
[30,50,200,220,'Region: us-central1',1],[250,50,200,220,'Region: europe-west1',1],[470,50,200,220,'Region: asia-south1',1],
[45,90,170,50,'Subnet 10.0.1.0/24',2],[45,160,170,50,'VM in zone a and b',0],
[265,90,170,50,'Subnet 10.0.2.0/24',2],[265,160,170,50,'VMs talk by internal IP',0],
[485,90,170,50,'Subnet 10.0.3.0/24',2],[485,160,170,50,'No VPN between regions',0]],
[]);

const fw=K.dg(700,260,[
[10,10,680,240,'Firewall rules are evaluated at each VM network interface',1],
[30,90,100,60,'Internet|or other VPC',0],[180,90,150,60,'Ingress rules|priority, allow or deny',2],[380,90,100,60,'VM',0],[530,90,140,60,'Egress rules|implied allow',0]],
[[130,120,180,120],[330,120,380,120],[480,120,530,120]]);

const route=K.dg(700,230,[
[10,10,680,210,'The most specific route wins, then priority',1],
[30,80,130,60,'Packet to|8.8.8.8',0],[210,50,200,40,'Route 10.0.0.0/16 local subnet',0],[210,110,200,40,'Route 0.0.0.0/0 default gateway',2],[470,80,200,60,'Next hop|internet gateway',0]],
[[160,110,210,130],[410,130,470,110]]);

const shared=K.dg(700,290,[
[10,10,680,270,'Shared VPC',1],
[240,40,220,100,'Host project|owns VPC and subnets|managed by network team',2],
[40,190,190,60,'Service project A|VMs use shared subnet',0],[255,190,190,60,'Service project B|GKE in shared subnet',0],[470,190,190,60,'Service project C|Cloud Run connector',0]],
[[135,190,300,140],[350,190,350,140],[565,190,400,140]]);

const peer=K.dg(700,230,[
[10,10,680,210,'VPC peering is not transitive',1],
[30,80,140,60,'VPC A|10.1.0.0/16',0],[280,80,140,60,'VPC B|10.2.0.0/16',2],[530,80,140,60,'VPC C|10.3.0.0/16',0]],
[[170,110,280,110],[280,125,170,125],[420,110,530,110],[530,125,420,125]]);

const nat=K.dg(700,230,[
[10,10,680,210,'Cloud NAT gives outbound access without external IPs',1],
[30,80,130,60,'VM|private IP only',0],[210,80,130,60,'Cloud Router|plus Cloud NAT',2],[390,80,120,60,'Internet|updates, APIs',0]],
[[160,110,210,110],[340,110,390,110],[390,130,340,130]]);

/* ---------- 0 ---------- */
L['gcp:3:0']={blocks:[
{p:'A **Virtual Private Cloud (VPC) network** is your private, software-defined network inside Google Cloud. It holds subnets, routes, firewall rules and connections to other networks. Unlike many clouds, a Google Cloud VPC is a **global** resource: one VPC can span every region.'},
{svg:vpc},
{h:'What is global and what is regional'},
{t:[['Object','Scope'],
['VPC network','Global'],
['Subnet','Regional (spans all zones of a region)'],
['Firewall rules and routes','Global (applied to the whole VPC)'],
['VM and persistent disk','Zonal']]},
{p:'VMs in different regions of the same VPC communicate over Google\'s private backbone with their internal IP addresses. No VPN or peering is needed.'},
{h:'Auto mode and custom mode'},
{t:[['Mode','How it works','Use'],
['Auto mode','Creates one subnet in every region automatically, using the 10.128.0.0/9 block. New regions get a subnet','Fast start, learning. The default network is auto mode'],
['Custom mode','You create the subnets and ranges you want','Production. Gives planned, non-overlapping addresses']]},
{ul:['An auto mode network can be converted to custom mode. The reverse is not possible.','Auto mode ranges overlap with other auto mode networks, so they cannot be peered together or connected to on-premises networks that use the same space.','Organization policy can stop the **default** network from being created in new projects.']},
{h:'Creating a custom VPC'},
{code:`gcloud compute networks create prod-vpc --subnet-mode=custom
gcloud compute networks subnets create web-us --network=prod-vpc --region=us-central1 --range=10.10.0.0/24
gcloud compute networks list
gcloud compute networks subnets list --network=prod-vpc`},
{note:'Delete or lock down the default network in real projects. It comes with firewall rules that allow SSH, RDP and ICMP from anywhere.'}],
src:[['VPC networks overview',K.VPC+'vpc'],['Create and manage VPC networks',K.VPC+'create-modify-vpc-networks']]};

/* ---------- 1 ---------- */
L['gcp:3:1']={blocks:[
{p:'A **subnet** is a regional IP range inside a VPC. You choose the range in CIDR notation, such as `10.10.0.0/24`. Careful planning of ranges avoids pain later, because overlapping ranges cannot be connected.'},
{h:'Private IP ranges'},
{t:[['Block','Size','Notes'],
['10.0.0.0/8','About 16.7 million addresses','Most common for cloud'],
['172.16.0.0/12','About 1 million','Often used by Docker defaults, avoid collisions'],
['192.168.0.0/16','About 65,000','Common at home, small ranges'],
['Some other ranges','Privately used public IPs and Class E (240.0.0.0/4)','Possible for special cases']]},
{h:'Reserved addresses in a subnet'},
{p:'In every primary IPv4 subnet range, four addresses are reserved: the network address, the default gateway, the second-to-last address and the broadcast address. A `/29` subnet therefore has 4 usable addresses.'},
{h:'Types of IP address on a VM'},
{t:[['Type','Description'],
['Internal (primary)','Assigned from the subnet range. Stays with the VM until deleted. Can be reserved as static'],
['External ephemeral','A public IP assigned for the life of the VM instance. Lost when it stops'],
['External static','A reserved public IP you keep and can move between VMs. Billed when unused'],
['Alias IP ranges','Extra internal addresses for containers and services on one VM'],
['IPv6','Dual-stack subnets can have IPv6 addresses']]},
{code:`gcloud compute addresses create web-ip --region=us-central1
gcloud compute addresses create db-internal --region=us-central1 --subnet=web-us --addresses=10.10.0.50
gcloud compute networks subnets expand-ip-range web-us --region=us-central1 --prefix-length=23
gcloud compute networks subnets update web-us --region=us-central1 --add-secondary-ranges=pods=10.20.0.0/16`},
{h:'Planning tips'},
{ul:['Reserve non-overlapping blocks per environment and region, and document them.','You can expand a subnet range but never shrink it.','Plan secondary ranges for GKE pods and services up front. They are large.','Do not overlap with on-premises ranges you will connect.']},
{note:'Only give a VM an external IP when it must be reachable directly. Most VMs should have none and reach the internet through Cloud NAT.'}],
src:[['Subnets',K.VPC+'subnets'],['IP addresses',K.VPC+'ip-addresses']]};

/* ---------- 2 ---------- */
L['gcp:3:2']={blocks:[
{p:'**VPC firewall rules** control traffic to and from VMs and other resources. They are **stateful**: if a connection is allowed in one direction, the reply is allowed automatically. Rules apply at the VM network interface, even for traffic between VMs in the same subnet.'},
{svg:fw},
{h:'What a rule contains'},
{t:[['Element','Meaning'],
['Direction','Ingress (incoming) or egress (outgoing)'],
['Action','Allow or deny'],
['Priority','0 to 65535. Lower number wins. Default 1000'],
['Source or destination','IP ranges, and for ingress optionally tags or service accounts'],
['Protocols and ports','tcp:80, tcp:443, udp:53, icmp, all'],
['Target','All instances in the network, instances with a network tag, or instances running as a service account'],
['Enforcement','Enabled or disabled']]},
{h:'Implied rules'},
{ul:['**Allow all egress** at the lowest priority (65535).','**Deny all ingress** at the lowest priority (65535).','They cannot be removed. You override them with your own rules with higher priority.']},
{h:'Examples'},
{code:`gcloud compute firewall-rules create allow-web --network=prod-vpc --direction=INGRESS --action=ALLOW \\
  --rules=tcp:80,tcp:443 --source-ranges=0.0.0.0/0 --target-tags=web
gcloud compute firewall-rules create allow-ssh-iap --network=prod-vpc --direction=INGRESS --action=ALLOW \\
  --rules=tcp:22 --source-ranges=35.235.240.0/20 --target-tags=ssh
gcloud compute firewall-rules create deny-egress-db --network=prod-vpc --direction=EGRESS --action=DENY \\
  --rules=all --destination-ranges=203.0.113.0/24 --priority=900`},
{p:'The source range `35.235.240.0/20` is used by **Identity-Aware Proxy (IAP)** TCP forwarding. It lets you SSH to VMs that have no external IP, authenticated through IAM, without opening SSH to the world. Health checks from load balancers use `130.211.0.0/22` and `35.191.0.0/16`, which must be allowed.'},
{h:'Target by tag or by service account'},
{t:[['Method','Pros','Cons'],
['Network tags','Simple','Anyone who can edit the VM can add the tag'],
['Service accounts','Tied to identity, harder to bypass','Requires planning of service accounts']]},
{h:'Firewall policies'},
{p:'For larger organizations, **firewall policies** let you manage rules centrally. A hierarchical policy at the organization or folder is evaluated before VPC rules, and can delegate to lower levels with `goto_next`. **Cloud Next Generation Firewall (NGFW)** adds features such as FQDN and geolocation matching, and threat prevention in higher tiers.'},
{note:'Order of evaluation: organization policy, folder policies, then the VPC level (VPC firewall rules and global network policies), then regional policies, and finally the implied rules. Use Firewall Rules Logging and Firewall Insights to find unused or shadowed rules.'}],
src:[['VPC firewall rules',K.VPC+'firewalls'],['Firewall policies',K.VPC+'firewall-policies-overview']]};

/* ---------- 3 ---------- */
L['gcp:3:3']={blocks:[
{p:'A **route** tells the network where to send traffic for a destination range. Each VPC has routes created by the system, and you can add your own. Routing decides the path. Firewall rules decide whether the traffic is allowed.'},
{svg:route},
{h:'Types of route'},
{t:[['Type','Created by','Purpose'],
['Subnet routes','The system, for each subnet','Local traffic inside the VPC'],
['Default route 0.0.0.0/0','The system','Sends everything else to the default internet gateway'],
['Static custom routes','You','Send a destination range to a next hop such as a VM, VPN tunnel or load balancer'],
['Dynamic routes','Cloud Router with BGP','Learned from on-premises or other networks'],
['Peering routes','VPC Network Peering','Subnet and optional custom routes of the peer']]},
{h:'How a route is chosen'},
{flow:['Take all routes whose destination range contains the packet destination','Choose the one with the longest prefix (most specific range)','If several tie, choose the lowest priority number','If still tied, equal-cost multipath may spread traffic']},
{h:'Creating a custom route'},
{code:`gcloud compute routes create to-onprem --network=prod-vpc --destination-range=192.168.0.0/16 \\
  --next-hop-vpn-tunnel=tunnel1 --next-hop-vpn-tunnel-region=us-central1 --priority=100
gcloud compute routes create via-firewall-vm --network=prod-vpc --destination-range=0.0.0.0/0 \\
  --next-hop-instance=fw-1 --next-hop-instance-zone=us-central1-a --tags=needs-inspection --priority=900
gcloud compute routes list --network=prod-vpc`},
{h:'Notes'},
{ul:['A VM without an external IP cannot use the default internet gateway route to reach the internet. It needs Cloud NAT or a proxy.','Deleting the default route blocks internet egress for VMs with external IPs. Do it only when you plan another path.','Routes may be scoped to instances with network tags.','Use Connectivity Tests to check which route a packet would follow.']},
{note:'Policy-based routes let you override routing by source, destination or protocol, for example to send certain traffic to a network virtual appliance.'}],
src:[['Routes overview',K.VPC+'routes'],['Using routes',K.VPC+'using-routes']]};

/* ---------- 4 ---------- */
L['gcp:3:4']={blocks:[
{p:'**Shared VPC** lets an organization share one VPC network, owned by a central **host project**, with many **service projects**. Resources in service projects use subnets from the shared network, while teams keep their own projects, billing and IAM.'},
{svg:shared},
{h:'Roles'},
{t:[['Role','Held by','Does'],
['Shared VPC Admin (compute.xpnAdmin)','Organization or folder level, usually the network team','Enables the host project and attaches service projects'],
['Network Admin','Network team in the host project','Manages networks, subnets and firewall rules'],
['Compute Network User (compute.networkUser)','Service project users or service accounts','Use specific subnets of the host project']]},
{h:'Setting up'},
{code:`gcloud compute shared-vpc enable host-net-project
gcloud compute shared-vpc associated-projects add app-project --host-project=host-net-project
gcloud projects add-iam-policy-binding host-net-project --member="group:app-team@example.com" \\
  --role="roles/compute.networkUser"`},
{h:'Why use it'},
{ul:['**Central control.** One team manages subnets, routes and firewall rules.','**Delegated work.** App teams deploy to subnets they are allowed to use.','**Fewer connections.** No peering or VPN between each project.','**Consistent security.** Organization-wide network rules and logging.']},
{h:'Limits to know'},
{ul:['A project can be a host or a service project, not both.','A service project attaches to only one host project at a time.','Subnet-level sharing lets you choose which service projects can use which subnet.','Plan quota and IP space for the shared network, as it is a shared resource.']},
{note:'Shared VPC is the standard pattern for production. Use VPC Network Peering when separate organizations or independent networks need to connect.'}],
src:[['Shared VPC overview',K.VPC+'shared-vpc'],['Provision Shared VPC',K.VPC+'provisioning-shared-vpc']]};

/* ---------- 5 ---------- */
L['gcp:3:5']={blocks:[
{p:'There are two common ways to connect networks privately inside Google Cloud: **VPC Network Peering** for connecting whole VPCs, and **Private Service Connect** for reaching a single service.'},
{h:'VPC Network Peering'},
{svg:peer},
{ul:['Each side creates a peering. Both must be active.','Traffic stays on Google\'s network using internal IPs.','**Not transitive.** If A peers with B and B with C, A cannot reach C through B.','Subnet ranges must **not overlap**.','Works across projects and organizations. No bandwidth bottleneck or gateway.','Custom route exchange is optional and must be enabled on both sides.']},
{code:`gcloud compute networks peerings create a-to-b --network=vpc-a --peer-project=proj-b --peer-network=vpc-b --export-custom-routes --import-custom-routes
gcloud compute networks peerings create b-to-a --network=vpc-b --peer-project=proj-a --peer-network=vpc-a`},
{h:'Private Service Connect (PSC)'},
{p:'PSC exposes a service through a private IP address in your VPC. Traffic stays inside Google Cloud and the two sides do not share routes or ranges, so overlapping address space is fine.'},
{t:[['PSC use','What it provides'],
['Endpoint for Google APIs','A private IP for googleapis.com, for example to reach Cloud Storage without public routes'],
['Endpoint for a published service','A private IP for a managed service or a service in another VPC or organization'],
['Backends','Use PSC with a load balancer to reach services in other networks'],
['Producer side','A service attachment publishes your service to consumers']]},
{code:`gcloud compute addresses create psc-ip --global --purpose=PRIVATE_SERVICE_CONNECT --addresses=10.99.0.5 --network=prod-vpc
gcloud compute forwarding-rules create pscapi --global --network=prod-vpc --address=psc-ip --target-google-apis-bundle=all-apis`},
{h:'Choosing'},
{t:[['Need','Use'],
['Connect two of your VPCs with different teams and non-overlapping ranges','VPC Network Peering'],
['Expose one service to many consumers, possibly with overlapping ranges','Private Service Connect'],
['Many VPCs and sites in a hub and spoke','Network Connectivity Center'],
['Managed services such as Cloud SQL private IP','Private services access (a peering) or PSC, per product']]}],
src:[['VPC Network Peering',K.VPC+'vpc-peering'],['Private Service Connect',K.VPC+'private-service-connect']]};

/* ---------- 6 ---------- */
L['gcp:3:6']={blocks:[
{p:'Most Google services, such as Cloud Storage, BigQuery and Pub/Sub, are reached through public API addresses. A VM without an external IP address can still reach them if **Private Google Access** is on for its subnet.'},
{h:'How it works'},
{flow:['The VM has only an internal IP and sits in a subnet with Private Google Access on','The VM calls storage.googleapis.com','The request goes to Google\'s edge over internal routing, not the open internet','Google API access succeeds. Other internet destinations are still unreachable']},
{code:`gcloud compute networks subnets update web-us --region=us-central1 --enable-private-ip-google-access
gcloud compute networks subnets describe web-us --region=us-central1 --format="value(privateIpGoogleAccess)"`},
{h:'Choosing an API access method'},
{t:[['Option','Details'],
['Default domains with Private Google Access','Works for most APIs. DNS returns public addresses reachable privately'],
['private.googleapis.com','199.36.153.8/30. All Google APIs, keep traffic private, may be used for VPC Service Controls'],
['restricted.googleapis.com','199.36.153.4/30. Only APIs supported by VPC Service Controls. Used to block access to unsupported services'],
['Private Service Connect for Google APIs','A private IP address you choose inside your VPC, plus a DNS name. Preferred in new designs and useful from on-premises over VPN or Interconnect']]},
{h:'On-premises access to Google APIs'},
{p:'Private Google Access for on-premises hosts lets machines in your data center reach Google APIs over Cloud VPN or Interconnect, using Cloud DNS to map names to the private VIPs and Cloud Router to advertise the ranges.'},
{h:'Troubleshooting'},
{ul:['Check that the subnet setting is enabled for the VM region.','Make sure there is a route to the API range (the default route is usually enough).','Check egress firewall rules.','Verify DNS resolves the expected names.']},
{note:'Private Google Access is per subnet. Cloud NAT is not needed for Google APIs, but is needed for third-party internet destinations.'}],
src:[['Private Google Access',K.VPC+'private-google-access'],['Private access options',K.VPC+'private-access-options']]};

/* ---------- 7 ---------- */
L['gcp:3:7']={blocks:[
{p:'**Cloud NAT** lets VMs, GKE nodes and serverless connectors that have **no external IP** make **outbound** connections to the internet, for example to download packages or call an external API. It does not allow unsolicited inbound connections.'},
{svg:nat},
{h:'How it works'},
{ul:['Cloud NAT is a **regional**, managed, software-defined service, not a VM. There is no single point of failure and no bandwidth bottleneck.','It is configured on a **Cloud Router**, which only hosts the NAT configuration and does not need BGP for NAT.','It translates private source addresses to external NAT IPs and ports.','Return traffic for established connections comes back. New inbound connections are not allowed.']},
{h:'Configure'},
{code:`gcloud compute routers create nat-router --network=prod-vpc --region=us-central1
gcloud compute routers nats create nat-config --router=nat-router --region=us-central1 \\
  --auto-allocate-nat-external-ips --nat-all-subnet-ip-ranges --enable-logging`},
{h:'Capacity'},
{t:[['Setting','Notes'],
['Minimum ports per VM','Each VM gets a block of ports per NAT IP, 64 by default. Raise it for chatty workloads'],
['NAT IPs','Auto-allocated or manually reserved static IPs. Use static if a partner needs to allow-list your addresses'],
['Dynamic port allocation','Lets a VM use more ports when needed up to a maximum'],
['Subnets covered','All ranges, only primary, or a chosen list']]},
{h:'Symptoms and fixes'},
{ul:['Intermittent failures to the same destination can mean **port exhaustion**. Add NAT IPs or raise ports per VM. Check NAT logs for dropped connections.','No outbound access: check the Cloud NAT covers that subnet and a route to the default gateway exists.','Cloud NAT is not needed for Google APIs when Private Google Access is on.']},
{note:'Public NAT is for outbound internet. For private-to-private address translation between networks there is also private NAT in Network Connectivity Center.'}],
src:[['Cloud NAT overview','https://cloud.google.com/nat/docs/overview'],['Set up Cloud NAT','https://cloud.google.com/nat/docs/set-up-manage-network-address-translation']]};

/* ---------- 8 ---------- */
L['gcp:3:8']={blocks:[
{p:'**Cloud DNS** is a managed, authoritative DNS service running on Google\'s global network. It supports **public zones** that answer for the internet and **private zones** that answer only inside selected VPCs.'},
{h:'Zone types'},
{t:[['Zone','Visible to','Use'],
['Public','The internet','Your domain names, such as www.example.com'],
['Private','Only selected VPC networks','Internal names such as db.corp.internal'],
['Forwarding','VPCs, forwards queries to other DNS servers','Resolve on-premises names from Google Cloud'],
['Peering','VPC that uses another VPC\'s DNS view','Centralize private DNS in one network'],
['Reverse lookup','VPCs','PTR records']]},
{h:'Common commands'},
{code:`gcloud dns managed-zones create example-zone --dns-name="example.com." --description="Public zone"
gcloud dns record-sets create www.example.com. --zone=example-zone --type=A --ttl=300 --rrdatas=203.0.113.10
gcloud dns managed-zones create corp-private --dns-name="corp.internal." --visibility=private \\
  --networks=prod-vpc --description="Internal names"
gcloud dns record-sets list --zone=example-zone`},
{h:'Hybrid DNS'},
{ul:['**Outbound forwarding zone.** Queries for onprem.example.com from Google Cloud go to your data center DNS servers.','**Inbound server policy.** Gives on-premises clients an IP in the VPC that they can query to resolve Google Cloud private names.','Both need routes over VPN or Interconnect and firewall rules that allow DNS (UDP and TCP 53).']},
{h:'Automatic internal DNS'},
{p:'Every VM gets an internal DNS name without any setup, for example `web-1.us-central1-a.c.my-project.internal`. Within a project, VMs can reach each other by name. The metadata server at `169.254.169.254` answers these queries.'},
{h:'Features'},
{ul:['DNSSEC for public zones.','Routing policies (weighted, geolocation, failover) for traffic management.','Response policy zones to override answers.','100% availability SLA for the authoritative service.']},
{note:'Domain registration is a separate product (Cloud Domains or a registrar). Cloud DNS hosts the zone once you point the domain name servers to it.'}],
src:[['Cloud DNS overview','https://cloud.google.com/dns/docs/overview'],['DNS zones','https://cloud.google.com/dns/docs/zones']]};

/* ---------- 9 ---------- */
L['gcp:3:9']={blocks:[
{p:'When networking breaks, you need visibility. Google Cloud provides logs and testing tools to see what traffic flows, what is blocked and where the path fails.'},
{h:'The tools'},
{t:[['Tool','What it shows'],
['VPC Flow Logs','Sampled records of network flows to and from VMs per subnet, with source, destination, ports, bytes and VM metadata'],
['Firewall Rules Logging','Whether a particular firewall rule allowed or denied a connection'],
['Connectivity Tests','Simulates a path and tells you the first place a packet would be dropped, such as firewall, route or missing NAT'],
['Network Topology','A map of your network and traffic volume'],
['Firewall Insights','Unused, shadowed and overly permissive rules'],
['Performance Dashboard','Latency and packet loss between zones and regions'],
['Packet Mirroring','Copies packets to a collector for deep inspection']]},
{h:'Enable logging'},
{code:`gcloud compute networks subnets update web-us --region=us-central1 \\
  --enable-flow-logs --logging-aggregation-interval=interval-5-sec --logging-flow-sampling=0.5
gcloud compute firewall-rules update allow-web --enable-logging
gcloud network-management connectivity-tests create web-to-db --source-instance=projects/p/zones/us-central1-a/instances/web-1 \\
  --destination-instance=projects/p/zones/us-central1-a/instances/db-1 --destination-port=5432 --protocol=TCP`},
{h:'A troubleshooting flow'},
{flow:['Name the source, destination, protocol and port','Run a Connectivity Test to see where the path fails','Check firewall rules in both directions and their priority','Check routes, Cloud NAT and DNS resolution','Confirm with flow and firewall logs, then test from the VM with curl or nc']},
{h:'Cost and noise'},
{ul:['Flow logs can be large. Lower the sampling rate and filter on needed metadata.','Send logs to a bucket or BigQuery, not only to the default log bucket, if you keep them long.','Enable flow logs on sensitive subnets rather than everything, unless you need full coverage.']},
{note:'Connectivity Tests analyze configuration. They do not send real packets in every case, so they find rule and route problems but not application errors.'}],
src:[['VPC Flow Logs',K.VPC+'flow-logs'],['Connectivity Tests','https://cloud.google.com/network-intelligence-center/docs/connectivity-tests/concepts/overview']]};
})();
