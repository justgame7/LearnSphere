/* LearnSphere - Google Cloud, Section 05: Hybrid Connectivity & Network Services.
   Lectures 0-5 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const options=K.dg(700,260,[
[10,10,680,240,'Connecting on-premises to a VPC',1],
[30,60,200,150,'Over the internet|Cloud VPN (HA VPN)|up to 3 Gbps per tunnel',0],
[250,60,200,150,'Private provider link|Partner Interconnect|50 Mbps to 50 Gbps',0],
[470,60,200,150,'Private direct link|Dedicated Interconnect|10 or 100 Gbps circuits',2]],
[]);

const havpn=K.dg(700,290,[
[10,10,680,270,'HA VPN with two tunnels and BGP',1],
[30,100,140,90,'On-premises|VPN gateway|(or two devices)',0],
[260,100,190,90,'Cloud Router|BGP sessions|exchange routes',2],
[520,100,150,90,'HA VPN gateway|interface 0 and 1|in a Google VPC',0]],
[[170,125,260,125],[170,165,260,165],[450,125,520,125],[450,165,520,165]]);

const bgp=K.dg(700,220,[
[10,10,680,200,'Cloud Router learns and advertises routes with BGP',1],
[30,70,150,70,'On-premises|router|sends 192.168.0.0/16',0],[270,70,160,70,'Cloud Router|regional',2],[520,70,150,70,'VPC routes|subnets advertised|10.10.0.0/16',0]],
[[180,100,270,100],[270,115,180,115],[430,100,520,100],[520,115,430,115]]);

const ic=K.dg(700,260,[
[10,10,680,240,'Dedicated Interconnect, 99.99 percent topology',1],
[30,70,130,110,'Your network|two routers|two sites',0],
[250,50,160,70,'Colocation A|edge availability domain 1',0],[250,140,160,70,'Colocation B|edge availability domain 2',0],
[520,70,150,110,'Google VPC|VLAN attachments|Cloud Routers',2]],
[[160,110,250,85],[160,150,250,175],[410,85,520,110],[410,175,520,150]]);

const ncc=K.dg(700,290,[
[10,10,680,270,'Network Connectivity Center: hub and spokes',1],
[260,110,180,70,'NCC hub|routes between spokes',2],
[30,40,150,50,'VPC spoke',0],[520,40,150,50,'VPN spoke',0],[30,190,150,50,'Interconnect spoke',0],[520,190,150,50,'Router appliance',0]],
[[180,65,260,125],[520,65,440,125],[180,215,260,165],[520,215,440,165]]);

/* ---------- 0 ---------- */
L['gcp:4:0']={blocks:[
{p:'Most companies run some workloads outside Google Cloud, in a data center, a branch office or another cloud. **Hybrid connectivity** links those networks to your VPC so they can reach each other with private addresses.'},
{svg:options},
{h:'The options compared'},
{t:[['Option','Path','Bandwidth','Typical use'],
['Cloud VPN (HA VPN)','Encrypted IPsec over the public internet','Up to 3 Gbps per tunnel, several tunnels','Quick start, small or moderate traffic, backup path'],
['Partner Interconnect','Private connection through a service provider','50 Mbps to 50 Gbps per attachment','No presence in a Google colocation, medium to large traffic'],
['Dedicated Interconnect','Direct physical link in a colocation facility','10 Gbps or 100 Gbps circuits','Large, steady, low-latency traffic'],
['Cross-Cloud Interconnect','Direct link to another cloud provider','10 or 100 Gbps','Multicloud'],
['Direct or Carrier Peering','Peering with Google edge, not into a VPC','Varies','Reaching Google public services such as Workspace. Not for private VPC access']]},
{h:'Choosing'},
{flow:['Start with the bandwidth, latency and availability you need','Under a few Gbps and flexible? Use HA VPN','Need steady high bandwidth or low latency? Use Interconnect','No colocation presence? Use Partner Interconnect','Need high availability? Use redundant connections in different locations and add VPN as backup']},
{p:'Both VPN and Interconnect use **Cloud Router** to exchange routes with BGP, so the networks learn about each other\'s ranges automatically.'},
{note:'Interconnect is private but not encrypted by default. If you need encryption, use MACsec on Dedicated Interconnect or HA VPN over Interconnect.'}],
src:[['Choosing a hybrid connectivity product',K.NET+'how-to/choose-product'],['Hybrid connectivity overview',K.NET+'']]};

/* ---------- 1 ---------- */
L['gcp:4:1']={blocks:[
{p:'**Cloud VPN** connects your VPC to another network with encrypted IPsec tunnels over the internet. **HA VPN** is the current, highly available version.'},
{svg:havpn},
{h:'HA VPN'},
{ul:['A **regional** gateway with **two interfaces**, each with its own external IP.','Requires dynamic routing with **BGP** through a Cloud Router.','Offers a **99.99% SLA** when configured with redundant tunnels to redundant peer devices (or both interfaces of a peer gateway).','Each tunnel supports up to 3 Gbps. Add tunnels for more.','Uses IKEv2 and supports IPv4 and IPv6 traffic.']},
{h:'Set up an HA VPN'},
{code:`gcloud compute vpn-gateways create ha-gw --network=prod-vpc --region=us-central1
gcloud compute routers create vpn-router --network=prod-vpc --region=us-central1 --asn=65001
gcloud compute external-vpn-gateways create onprem-gw --interfaces 0=203.0.113.1,1=203.0.113.2
gcloud compute vpn-tunnels create tunnel0 --region=us-central1 --vpn-gateway=ha-gw --interface=0 \\
  --peer-external-gateway=onprem-gw --peer-external-gateway-interface=0 --shared-secret=SECRET \\
  --router=vpn-router --ike-version=2`},
{h:'Classic VPN'},
{t:[['Feature','HA VPN','Classic VPN'],
['Interfaces','Two','One'],
['SLA','99.99% with correct setup','99.9%'],
['Routing','Dynamic (BGP) only','Static, policy-based or dynamic'],
['Status','Recommended','Being phased out. Migrate to HA VPN']]},
{h:'Design notes'},
{ul:['Keep MTU in mind: IPsec adds overhead, so set a lower MTU (about 1460) to avoid fragmentation.','Use different on-premises devices or interfaces for high availability.','Tunnel traffic and Cloud Router logs help troubleshoot BGP sessions.','Shared secrets belong in a secret store and should be long and random.']},
{note:'A VPN tunnel being up does not mean traffic flows. Also check BGP session state, advertised routes and firewall rules on both sides.'}],
src:[['Cloud VPN overview',K.NET+'vpn/concepts/overview'],['HA VPN topologies',K.NET+'vpn/concepts/topologies']]};

/* ---------- 2 ---------- */
L['gcp:4:2']={blocks:[
{p:'**Cloud Router** is a managed control-plane service that uses **BGP (Border Gateway Protocol)** to exchange routes dynamically between your VPC and an external network. It is not in the data path. It only learns and advertises.'},
{svg:bgp},
{h:'BGP in a few lines'},
{ul:['BGP is the protocol routers use to share which address ranges are reachable through them.','Each side has an **autonomous system number (ASN)**. Use private ASNs (64512 to 65534, or 4200000000 to 4294967294) on your side.','A **BGP session** is a TCP connection between two peers on link-local IPs (169.254.x.x).','Routers advertise prefixes and learn the peer prefixes. Priorities (MED) decide preferred paths.']},
{h:'Dynamic routing mode'},
{t:[['Mode','Behaviour'],
['Regional','Cloud Router only shares routes with subnets in its own region'],
['Global','Cloud Router shares routes with subnets in all regions of the VPC, and learned routes apply to all regions']]},
{code:`gcloud compute networks update prod-vpc --bgp-routing-mode=global
gcloud compute routers update vpn-router --region=us-central1 --advertisement-mode=CUSTOM \\
  --set-advertisement-ranges=10.10.0.0/16,10.20.0.0/16 --set-advertisement-groups=ALL_SUBNETS
gcloud compute routers get-status vpn-router --region=us-central1`},
{h:'Advertisements'},
{ul:['Default: advertise all subnet ranges of the VPC (and peered ones if configured).','Custom: pick groups and individual prefixes. Use it to limit what on-premises sees or to advertise summary ranges.']},
{h:'Troubleshooting BGP'},
{flow:['Check the tunnel or VLAN attachment is up','Check the BGP session is Established','Inspect learned and advertised routes with get-status','Check ASNs, link-local IPs and any MD5 authentication match on both sides','Check firewall rules and the on-premises filters']},
{note:'Cloud Router is also used by Cloud NAT. For NAT only, no BGP sessions are needed.'}],
src:[['Cloud Router overview',K.NET+'router/concepts/overview'],['Advertised routes',K.NET+'router/how-to/advertising-overview']]};

/* ---------- 3 ---------- */
L['gcp:4:3']={blocks:[
{p:'**Cloud Interconnect** provides high-bandwidth, low-latency connections between your network and Google. Traffic does not cross the public internet.'},
{svg:ic},
{h:'Dedicated Interconnect'},
{ul:['A direct physical connection between your router and Google\'s network in a **colocation facility**.','Circuits of 10 Gbps or 100 Gbps, combined into bundles.','You create **VLAN attachments** that connect to a Cloud Router in a region.','You must have equipment in a facility where Google is present, or use a provider to reach it.']},
{h:'Partner Interconnect'},
{ul:['A service provider connects you to Google. Useful when you cannot reach a Google facility.','Capacities from 50 Mbps to 50 Gbps per VLAN attachment.','Layer 2 (you run BGP with Google) or Layer 3 (provider runs BGP) options.']},
{h:'Availability design'},
{t:[['Topology','Setup','SLA target'],
['Non-critical','Single connection in one location','No SLA'],
['99.9%','Two connections in different edge availability domains of one metro','99.9%'],
['99.99%','Four connections: two in each of two metros, with Cloud Routers in the same region','99.99%']]},
{h:'Creating a VLAN attachment'},
{code:`gcloud compute interconnects attachments dedicated create att-1 --region=us-central1 \\
  --router=ic-router --interconnect=my-interconnect --vlan=100 --bandwidth=BPS_1G
gcloud compute interconnects list`},
{h:'Security and cost'},
{ul:['Traffic is private but not encrypted by default. Use MACsec for Dedicated Interconnect, or HA VPN over Interconnect, if encryption is required.','Egress charges are lower than internet egress, and you pay for the port and attachment.','For short or uncertain needs, start with HA VPN and move later.']},
{note:'Lead times for physical circuits are weeks. Plan early and keep a VPN as a backup path during and after migration.'}],
src:[['Cloud Interconnect overview',K.NET+'interconnect/concepts/overview'],['Provisioning overview',K.NET+'interconnect/how-to/dedicated/provisioning-overview']]};

/* ---------- 4 ---------- */
L['gcp:4:4']={blocks:[
{p:'When you have many VPCs, sites and clouds, meshing them with individual peerings and tunnels becomes unmanageable. **Network Connectivity Center (NCC)** provides a central **hub** where you attach **spokes**, so everything can reach everything over one managed fabric.'},
{svg:ncc},
{h:'Spoke types'},
{t:[['Spoke','Connects'],
['VPC spoke','A VPC network, with route sharing between VPCs on the hub'],
['HA VPN spoke','On-premises or other cloud sites through VPN tunnels'],
['Interconnect (VLAN attachment) spoke','Sites over Interconnect'],
['Router appliance spoke','Third-party network virtual appliances such as SD-WAN devices']]},
{h:'What you get'},
{ul:['**Site-to-site data transfer** across Google\'s backbone, so branch offices can communicate through Google.','**Central route management** and visibility of connected sites.','Support for **overlapping IP ranges** with private NAT in some designs.','A simpler alternative to full-mesh peering and tunnels.']},
{code:`gcloud network-connectivity hubs create corp-hub --description="Global hub"
gcloud network-connectivity spokes linked-vpc-network create vpc-spoke --hub=corp-hub --vpc-network=projects/p/global/networks/prod-vpc --global`},
{h:'When to use which'},
{t:[['Situation','Choice'],
['Two VPCs','VPC peering is simple'],
['Many VPCs of one organization','Shared VPC or NCC VPC spokes'],
['Many sites and VPCs needing any-to-any','Network Connectivity Center'],
['One service shared to many','Private Service Connect']]}],
src:[['Network Connectivity Center',K.NET+'network-connectivity-center/concepts/overview']]};

/* ---------- 5 ---------- */
L['gcp:4:5']={blocks:[
{p:'Network traffic leaves your resources through a path and a price. **Network Service Tiers** choose the path for traffic between the internet and Google Cloud. Understanding egress costs prevents bill surprises.'},
{h:'Premium and Standard tier'},
{t:[['Tier','Path','Features','Cost'],
['Premium (default)','Traffic travels on Google\'s private global backbone as close to the user as possible, entering and leaving at the nearest edge','Global load balancing, low latency, high reliability','Higher'],
['Standard','Traffic uses the public internet for most of the path, and enters Google near the resource region','Regional load balancers and IPs only','Lower']]},
{code:`gcloud compute addresses create std-ip --region=us-central1 --network-tier=STANDARD
gcloud compute project-info update --default-network-tier=STANDARD`},
{h:'Where network charges come from'},
{t:[['Traffic','Charged?'],
['Ingress from the internet to Google Cloud','No'],
['Egress to the internet','Yes, by volume and destination, tier dependent'],
['Between VMs in the same zone using internal IPs','No'],
['Between zones in the same region','Yes, small per GB'],
['Between regions','Yes, per GB, varies by pair'],
['To Google APIs and services in the same region','Often free, depends on service'],
['Load balancer processing','Yes, per GB and per forwarding rule hour'],
['Cloud NAT and external IPs','NAT data processing and idle static IP address charges']]},
{h:'Keeping network cost down'},
{ul:['Keep chatty services in the same zone or region where it fits the availability design.','Use Cloud CDN and caching to reduce egress to the internet.','Release unused static external IP addresses.','Compress data and avoid cross-region replication that is not needed.','Check the network cost lines in billing export.']},
{note:'Free tier and inter-zone prices change. Use the pricing calculator and billing export for your own numbers.'}],
src:[['Network Service Tiers','https://cloud.google.com/network-tiers/docs/overview'],['Network pricing','https://cloud.google.com/vpc/network-pricing']]};
})();
