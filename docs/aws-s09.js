/* LearnSphere - AWS Administrator, Section 09: Private Connectivity, Network Protection & Hybrid Links.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const peer=K.dg(700,200,[
[10,10,680,180,'VPC peering is not transitive',1],
[30,60,130,70,'VPC A|10.0.0.0/16',0],[285,60,130,70,'VPC B|10.1.0.0/16',2],[540,60,130,70,'VPC C|10.2.0.0/16',0]],
[[160,95,285,95],[415,95,540,95]]);

const ep=K.dg(700,230,[
[10,10,680,210,'Two kinds of VPC endpoint',1],
[30,50,300,70,'Gateway endpoint|S3 and DynamoDB|route table entry, free',2],
[370,50,300,70,'Interface endpoint|PrivateLink, ENI in a subnet|hourly and per GB',0],
[30,140,300,55,'Route 0.0.0.0/0 not used for S3',0],[370,140,300,55,'Private DNS name resolves to ENI IP',0]],
[]);

const tgw=K.dg(700,260,[
[10,10,680,240,'Transit Gateway hub and spoke',1],
[280,95,140,60,'Transit|Gateway',2],
[40,40,130,50,'VPC A',0],[40,170,130,50,'VPC B',0],[530,40,130,50,'VPC C',0],[530,170,130,50,'VPN or|Direct Connect',0]],
[[170,65,280,110],[170,195,280,140],[530,65,420,110],[530,195,420,140]]);

const hybrid=K.dg(700,210,[
[10,10,680,190,'On premises to AWS',1],
[30,70,150,70,'Customer|gateway device',0],[270,50,160,45,'Site-to-Site VPN|encrypted, internet',2],[270,115,160,45,'Direct Connect|dedicated, private',0],[520,70,150,70,'Virtual private or|transit gateway',0]],
[[180,95,270,72],[180,115,270,137],[430,72,520,95],[430,137,520,115]]);

/* ---------- 0 ---------- */
L['aws:8:0']={blocks:[
{p:'**VPC peering** is a private network connection between two VPCs, in the same or different accounts and Regions. Traffic uses private IP addresses over the AWS network.'},
{svg:peer},
{h:'Rules'},
{ul:['CIDR ranges **must not overlap**.','Peering is **not transitive**: A to B and B to C does not give A to C.','You must add **routes** on both sides and allow traffic in security groups.','No edge-to-edge routing: a peer cannot use the other VPC internet gateway or NAT.','Cross-account peering requires the other owner to accept the request.']},
{code:`aws ec2 create-vpc-peering-connection --vpc-id vpc-a --peer-vpc-id vpc-b --peer-owner-id 222233334444
aws ec2 accept-vpc-peering-connection --vpc-peering-connection-id pcx-0abc
aws ec2 create-route --route-table-id rtb-a --destination-cidr-block 10.1.0.0/16 --vpc-peering-connection-id pcx-0abc
aws ec2 create-route --route-table-id rtb-b --destination-cidr-block 10.0.0.0/16 --vpc-peering-connection-id pcx-0abc`},
{note:'For more than a handful of VPCs, peering becomes a mesh that is hard to manage. Use Transit Gateway instead.'}],
src:[['VPC peering','https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html']]};

/* ---------- 1 ---------- */
L['aws:8:1']={blocks:[
{p:'A **gateway endpoint** gives private access to **S3 and DynamoDB** from a VPC through a route table entry. It has **no charge**, which makes it the first thing to add to a VPC with NAT.'},
{h:'How it works'},
{flow:['Create a gateway endpoint for the service in the VPC','Select the route tables of the subnets that need it','AWS adds a route to a managed prefix list pointing at the endpoint','Traffic to the service stays on the AWS network and bypasses NAT and the internet gateway']},
{code:`aws ec2 create-vpc-endpoint --vpc-id vpc-0abc --vpc-endpoint-type Gateway \\
  --service-name com.amazonaws.eu-west-1.s3 --route-table-ids rtb-0abc`},
{h:'Endpoint policy'},
{p:'An endpoint policy limits what can be reached through the endpoint, for example only specific buckets. A bucket policy can in turn require `aws:SourceVpce` so the bucket is only reachable through your endpoint.'},
{code:`{"Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:*",
  "Resource":["arn:aws:s3:::my-bucket","arn:aws:s3:::my-bucket/*"]}]}`},
{note:'Gateway endpoints are Regional, work only from inside the VPC and are not reachable from on premises or other Regions. Use an interface endpoint for S3 in those cases.'}],
src:[['Gateway endpoints','https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html']]};

/* ---------- 2 ---------- */
L['aws:8:2']={blocks:[
{p:'**AWS PrivateLink** provides private connectivity to services using **interface endpoints**: elastic network interfaces with private IPs in your subnets.'},
{svg:ep},
{h:'What you can reach'},
{ul:['Most AWS service APIs (EC2, SSM, KMS, Secrets Manager, ECR and more).','Services offered by other accounts or partners through **endpoint services**.','Your own service behind a Network Load Balancer, shared privately with consumers.']},
{h:'Operational points'},
{ul:['Create endpoints in multiple AZs for resilience and attach **security groups** (allow 443 from clients).','Enable **private DNS** so the standard service name resolves to the endpoint inside the VPC, which requires DNS support and hostnames enabled on the VPC.','An **endpoint policy** can restrict the actions available.','Cost: hourly per endpoint per AZ plus per GB processed.']},
{code:`aws ec2 create-vpc-endpoint --vpc-id vpc-0abc --vpc-endpoint-type Interface \\
  --service-name com.amazonaws.eu-west-1.ssm --subnet-ids subnet-a subnet-b \\
  --security-group-ids sg-0abc --private-dns-enabled`},
{note:'Systems Manager needs three endpoints in a fully private VPC: ssm, ssmmessages and ec2messages.'}],
src:[['AWS PrivateLink','https://docs.aws.amazon.com/vpc/latest/privatelink/what-is-privatelink.html']]};

/* ---------- 3 ---------- */
L['aws:8:3']={blocks:[
{p:'**AWS Transit Gateway** is a Regional network hub. VPCs, VPNs and Direct Connect gateways attach to it, and route tables control which attachments can reach each other.'},
{svg:tgw},
{h:'Concepts'},
{t:[['Piece','Meaning'],
['Attachment','A VPC, VPN, Direct Connect gateway, peering or Connect attachment'],
['Route table','Controls routing between attachments. Association says which table an attachment uses'],
['Propagation','An attachment can advertise its routes into a table automatically'],
['Peering attachment','Connects transit gateways across Regions or accounts']]},
{h:'Typical segmentation'},
{ul:['Separate route tables for production, development and shared services.','Allow shared services to reach everyone while keeping environments isolated.','Inspect traffic centrally by routing through a firewall VPC.']},
{code:`aws ec2 create-transit-gateway --description "hub"
aws ec2 create-transit-gateway-vpc-attachment --transit-gateway-id tgw-0abc --vpc-id vpc-0abc --subnet-ids subnet-a subnet-b
aws ec2 create-route --route-table-id rtb-app --destination-cidr-block 10.0.0.0/8 --transit-gateway-id tgw-0abc`},
{note:'Each VPC subnet route table still needs a route to the transit gateway. Charges are per attachment hour and per GB.'}],
src:[['Transit Gateway','https://docs.aws.amazon.com/vpc/latest/tgw/what-is-transit-gateway.html']]};

/* ---------- 4 ---------- */
L['aws:8:4']={blocks:[
{p:'**Site-to-Site VPN** creates **two encrypted IPSec tunnels** between your network and AWS across the internet. It is quick to set up and fits as primary or backup connectivity.'},
{svg:hybrid},
{h:'Pieces'},
{t:[['Piece','Role'],
['Customer gateway','Describes your on-premises device (IP and ASN)'],
['Virtual private gateway or transit gateway','The AWS end of the connection'],
['VPN connection','Holds two tunnels in different AZs'],
['Routing','Static routes or dynamic routing with BGP']]},
{h:'Operations'},
{ul:['Each connection has **two tunnels** for resilience. Configure both on the device.','Use **BGP** so failover is automatic and routes propagate into route tables.','Throughput is up to about 1.25 Gbps per tunnel. A transit gateway can use ECMP to aggregate.','Monitor **TunnelState** in CloudWatch.']},
{code:`aws ec2 create-customer-gateway --type ipsec.1 --public-ip 203.0.113.10 --bgp-asn 65000
aws ec2 create-vpn-connection --type ipsec.1 --customer-gateway-id cgw-0abc --transit-gateway-id tgw-0abc
aws ec2 describe-vpn-connections --query "VpnConnections[].VgwTelemetry[].[OutsideIpAddress,Status]"`},
{note:'If only one tunnel is up, the connection works but has no redundancy. Alert on a down tunnel, not just a down connection.'}],
src:[['Site-to-Site VPN','https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html']]};

/* ---------- 5 ---------- */
L['aws:8:5']={blocks:[
{p:'**AWS Direct Connect** provides a dedicated private network connection from your premises (or a partner location) to AWS. It offers consistent latency and bandwidth, and does not cross the public internet.'},
{h:'Virtual interfaces'},
{t:[['Type','Reaches'],
['Private VIF','A VPC through a virtual private gateway or Direct Connect gateway'],
['Transit VIF','Transit gateways through a Direct Connect gateway'],
['Public VIF','Public AWS services such as S3 by public IP']]},
{h:'VPN versus Direct Connect'},
{t:[['','Site-to-Site VPN','Direct Connect'],
['Setup time','Minutes to hours','Weeks'],
['Path','Public internet, encrypted','Private circuit'],
['Bandwidth','Up to ~1.25 Gbps per tunnel','1, 10, 100 Gbps (and partner hosted lower)'],
['Latency','Variable','Consistent'],
['Encryption','IPSec','Not by default; add MACsec or VPN over DX'],
['Cost','Low','Port and data transfer, higher']]},
{ul:['For resilience use **two connections at separate locations**, or one DX plus a VPN as backup.','Use a **Direct Connect gateway** to reach VPCs in many Regions.']},
{note:'Direct Connect is not encrypted by default. Where required, use MACsec on dedicated connections or an IPSec VPN over the connection.'}],
src:[['AWS Direct Connect','https://docs.aws.amazon.com/directconnect/latest/UserGuide/Welcome.html']]};

/* ---------- 6 ---------- */
L['aws:8:6']={blocks:[
{p:'Beyond security groups, two managed services inspect and filter traffic: **AWS Network Firewall** for packets and **Route 53 Resolver DNS Firewall** for DNS queries.'},
{t:[['Service','Layer','Does','Placement'],
['Network Firewall','3 to 7','Stateful and stateless rules, domain filtering, Suricata-compatible IPS','Firewall subnets in the VPC, traffic routed through them'],
['DNS Firewall','DNS','Allow, block or alert on domain lists for queries from the VPC','Associated to VPCs, uses the Resolver'],
['Security groups / NACLs','3 to 4','Port and address filtering','Interface and subnet']]},
{h:'Typical use'},
{ul:['Egress filtering to an allow list of domains.','Blocking known malicious domains and DNS tunneling.','Centralized inspection of VPC to VPC and internet traffic.']},
{h:'Auditing'},
{ul:['Firewall alert and flow logs go to S3, CloudWatch Logs or Firehose.','DNS Firewall actions appear in Resolver query logs.','Use **Firewall Manager** to apply policies across the organization.']},
{note:'A firewall in the path needs routes that send traffic through the firewall endpoint and back. Most Network Firewall problems are routing, not rules.'}],
src:[['AWS Network Firewall','https://docs.aws.amazon.com/network-firewall/latest/developerguide/what-is-aws-network-firewall.html'],['DNS Firewall',K.R53+'resolver-dns-firewall.html']]};

/* ---------- 7 ---------- */
L['aws:8:7']={blocks:[
{p:'**AWS WAF** filters HTTP and HTTPS requests with rules. **AWS Shield** protects against DDoS attacks.'},
{h:'AWS WAF'},
{ul:['Attaches to **CloudFront, ALB, API Gateway, AppSync, Cognito** and others.','A **web ACL** contains rules and rule groups, evaluated in priority order.','Rules match IPs, geography, headers, body, rate and managed threat signatures.','Actions: allow, block, count, CAPTCHA and challenge.','**Managed rule groups** from AWS cover common attacks such as SQL injection and cross-site scripting.']},
{h:'Rollout pattern'},
{flow:['Start rules in Count mode','Review sampled requests and logs for false positives','Add exclusions where legitimate traffic matches','Switch to Block and keep monitoring']},
{h:'AWS Shield'},
{t:[['Tier','Protection'],
['Shield Standard','Automatic network and transport layer DDoS protection for all customers at no cost'],
['Shield Advanced','Extra detection and mitigation, application layer with WAF, cost protection and response team access, paid subscription']]},
{note:'WAF acts on requests that reach the associated resource. For a regional ALB, the web ACL must be created in the same Region. For CloudFront it is created in us-east-1.'}],
src:[['AWS WAF','https://docs.aws.amazon.com/waf/latest/developerguide/what-is-aws-waf.html'],['AWS Shield','https://docs.aws.amazon.com/waf/latest/developerguide/shield-chapter.html']]};

/* ---------- 8 ---------- */
L['aws:8:8']={blocks:[
{p:'Network cost mostly comes from **data processing** and **data transfer**. Know where each charge appears.'},
{t:[['Charge','Where it arises','How to reduce'],
['NAT gateway processing','Every GB through NAT','Use gateway endpoints, keep traffic inside the AZ, review what goes through NAT'],
['Cross-AZ transfer','Traffic between AZs (both directions)','Keep chatty tiers in the same AZ where HA allows, use zone-aware routing'],
['Cross-Region transfer','Replication, backups, peering','Replicate only what is needed'],
['Internet egress','Data out to the internet','CloudFront, compression, caching'],
['Interface endpoints','Hourly per AZ plus per GB','Share endpoints centrally when appropriate'],
['Public IPv4','Hourly per address','Remove unneeded addresses, use IPv6']]},
{h:'Find the source'},
{ul:['Cost Explorer: group by **usage type** to see NatGateway-Bytes, DataTransfer-Regional-Bytes and so on.','Flow logs: top talkers through the NAT interface.','CloudWatch: **BytesOutToDestination** for each NAT gateway.']},
{note:'S3 and DynamoDB gateway endpoints are free and remove their traffic from the NAT bill, usually the quickest win.'}],
src:[['Data transfer pricing','https://aws.amazon.com/ec2/pricing/on-demand/#Data_Transfer']]};

/* ---------- 9 ---------- */
L['aws:8:9']={blocks:[
{p:'**Practical:** connect two VPCs privately and give private subnets private access to S3.'},
{flow:['Create two VPCs with non-overlapping ranges and one subnet and instance each','Create and accept a peering connection','Add routes in both route tables and allow ICMP between the security groups','Ping the private IP across the peering','Add an S3 gateway endpoint to VPC A route tables and remove the NAT route','Check that the instance can list a bucket and that the route table shows the prefix list','Clean up the peering, endpoints, instances and VPCs']},
{h:'Verification'},
{t:[['Check','Expected'],
['Ping across peering','Replies from the private address'],
['Route table','Peering route and S3 prefix list present'],
['aws s3 ls from private subnet','Works without NAT']]},
{note:'If the ping fails, check three places in order: routes in both VPCs, security group on the target, then NACLs.'}],
src:[['Peering tutorial','https://docs.aws.amazon.com/vpc/latest/peering/create-vpc-peering-connection.html']]};
})();
