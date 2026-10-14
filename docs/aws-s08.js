/* LearnSphere - AWS Administrator, Section 08: VPC Fundamentals.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const vpc=K.dg(700,320,[
[10,10,680,300,'VPC 10.0.0.0/16',1],
[30,45,300,115,'Availability Zone A',1],[360,45,310,115,'Availability Zone B',1],
[45,75,130,60,'Public subnet|10.0.0.0/24',2],[190,75,125,60,'Private subnet|10.0.10.0/24',0],
[375,75,130,60,'Public subnet|10.0.1.0/24',2],[520,75,135,60,'Private subnet|10.0.11.0/24',0],
[30,185,640,40,'Route tables decide where each subnet sends traffic',0],
[130,245,150,45,'Internet gateway',2],[420,245,150,45,'NAT gateway',0]],
[]);

const routing=K.dg(700,260,[
[10,10,680,240,'Public versus private subnet',1],
[30,50,300,85,'Public subnet route table|10.0.0.0/16 local|0.0.0.0/0 to igw-xxx',2],
[370,50,300,85,'Private subnet route table|10.0.0.0/16 local|0.0.0.0/0 to nat-xxx',0],
[30,165,300,60,'Instance needs a public IP|and an allowing security group',0],
[370,165,300,60,'No inbound from internet|outbound through NAT',0]],
[]);

const path=K.dg(700,220,[
[10,10,680,200,'Inbound packet path',1],
[25,70,105,60,'Internet',0],[150,70,105,60,'Internet|gateway',0],[275,70,105,60,'Route|table',0],[400,70,105,60,'Network ACL|stateless',2],[525,70,150,60,'Security group|stateful|then instance',2]],
[[130,100,150,100],[255,100,275,100],[380,100,400,100],[505,100,525,100]]);

/* ---------- 0 ---------- */
L['aws:7:0']={blocks:[
{p:'A **Virtual Private Cloud (VPC)** is your isolated, logically defined network in a Region. You choose its **CIDR block**, divide it into **subnets** in Availability Zones and control traffic with routes and firewalls.'},
{svg:vpc},
{h:'Planning addresses'},
{ul:['Use private ranges from RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.','A VPC CIDR is between **/16 and /28**. Plan so ranges do not overlap with other VPCs or on-premises networks you may connect.','Each subnet lives in **one AZ** and takes a slice of the VPC range.','AWS reserves **5 addresses** in every subnet (network, router, DNS, future use, broadcast).']},
{t:[['Subnet size','Total addresses','Usable'],
['/28','16','11'],
['/24','256','251'],
['/20','4,096','4,091']]},
{note:'Leave room to grow. Moving to a larger range later usually means adding a secondary CIDR or rebuilding. Spread subnets across at least two AZs.'}],
src:[['How VPC works',K.VPC+'how-it-works.html'],['VPC CIDR blocks',K.VPC+'vpc-cidr-blocks.html']]};

/* ---------- 1 ---------- */
L['aws:7:1']={blocks:[
{p:'A subnet is **public** if its route table has a route to an **internet gateway**. Otherwise it is **private**. Nothing else makes it public.'},
{svg:routing},
{h:'Create the network'},
{code:`VPC=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query Vpc.VpcId --output text)
aws ec2 create-tags --resources $VPC --tags Key=Name,Value=lab-vpc
SUB=$(aws ec2 create-subnet --vpc-id $VPC --cidr-block 10.0.0.0/24 \\
  --availability-zone eu-west-1a --query Subnet.SubnetId --output text)
aws ec2 modify-subnet-attribute --subnet-id $SUB --map-public-ip-on-launch`},
{h:'What an instance needs for internet access'},
{flow:['The subnet route table has 0.0.0.0/0 to an internet gateway','The instance has a public IPv4 address or Elastic IP (or IPv6)','The security group allows the traffic','The network ACL allows the traffic in both directions']},
{note:'Placing a resource in a public subnet is not the same as exposing it. A security group with no inbound rules keeps it closed. Put databases and application tiers in private subnets anyway.'}],
src:[['Subnets',K.VPC+'configure-subnets.html']]};

/* ---------- 2 ---------- */
L['aws:7:2']={blocks:[
{p:'A **route table** decides where traffic from a subnet is sent. The **most specific route** (longest prefix) wins. Each subnet is associated with exactly one route table, and the **main route table** applies to subnets that have no explicit association.'},
{t:[['Destination','Target','Meaning'],
['10.0.0.0/16','local','Traffic inside the VPC (always present)'],
['0.0.0.0/0','igw-0abc','Internet via the internet gateway'],
['0.0.0.0/0','nat-0abc','Internet via NAT for private subnets'],
['10.1.0.0/16','pcx-0abc','Peered VPC'],
['192.168.0.0/16','vgw-0abc or tgw-0abc','On-premises via VPN or Transit Gateway'],
['pl-xxxx','vpce-0abc','Gateway endpoint for S3 or DynamoDB']]},
{code:`aws ec2 create-internet-gateway
aws ec2 attach-internet-gateway --internet-gateway-id igw-0abc --vpc-id vpc-0abc
RT=$(aws ec2 create-route-table --vpc-id vpc-0abc --query RouteTable.RouteTableId --output text)
aws ec2 create-route --route-table-id $RT --destination-cidr-block 0.0.0.0/0 --gateway-id igw-0abc
aws ec2 associate-route-table --route-table-id $RT --subnet-id subnet-0abc`},
{note:'Keep the main route table private (no internet route) so a forgotten subnet is not accidentally public. Create explicit public route tables.'}],
src:[['Route tables',K.VPC+'VPC_Route_Tables.html'],['Internet gateways',K.VPC+'VPC_Internet_Gateway.html']]};

/* ---------- 3 ---------- */
L['aws:7:3']={blocks:[
{p:'Private instances often need **outbound** internet access (patches, APIs) without being reachable from the internet. That is the job of a **NAT gateway** for IPv4 and an **egress-only internet gateway** for IPv6.'},
{t:[['Gateway','IP version','Placement'],
['NAT gateway','IPv4','In a **public** subnet, with an Elastic IP, routed from private subnets'],
['Egress-only internet gateway','IPv6','Attached to the VPC, routed from subnets'],
['NAT instance','IPv4','Self-managed, legacy']]},
{h:'High availability'},
{p:'A NAT gateway lives in **one AZ**. For resilience, create one per AZ and route each private subnet to the NAT gateway in its own AZ. This also avoids cross-AZ data charges.'},
{h:'Cost'},
{ul:['Hourly charge per NAT gateway.','**Per GB processed** through it, in addition to normal data transfer.','Traffic to S3 and DynamoDB should use **gateway endpoints**, which are free, instead of going through NAT.']},
{code:`aws ec2 allocate-address --domain vpc
aws ec2 create-nat-gateway --subnet-id subnet-public-a --allocation-id eipalloc-0abc
aws ec2 create-route --route-table-id rtb-private-a --destination-cidr-block 0.0.0.0/0 --nat-gateway-id nat-0abc`},
{note:'NAT gateways are one of the most common unexpected bills. Delete them after lab use and check data processed per NAT in CloudWatch.'}],
src:[['NAT gateways',K.VPC+'vpc-nat-gateway.html'],['Egress-only internet gateway',K.VPC+'egress-only-internet-gateway.html']]};

/* ---------- 4 ---------- */
L['aws:7:4']={blocks:[
{p:'Addresses and network interfaces are how instances become reachable. AWS now **charges for every public IPv4 address**, whether attached or not.'},
{t:[['Item','What it is'],
['Private IPv4','Assigned from the subnet, stays for the life of the interface'],
['Auto-assigned public IPv4','Released on stop, charged hourly'],
['Elastic IP','A static public IPv4 you own until released, charged hourly'],
['Elastic network interface (ENI)','Virtual NIC with IPs, security groups and MAC; can be moved between instances'],
['IPv6','Globally unique addresses, no NAT needed, no per-address charge']]},
{h:'Reducing public IPv4 cost'},
{ul:['Remove public addresses from instances that sit behind load balancers or NAT.','Use **Session Manager** and private endpoints instead of public IPs for administration.','Move to **IPv6** for dual-stack where clients support it.','Release unattached Elastic IPs. Use the Public IP Insights feature in VPC IPAM to find usage.']},
{code:`aws ec2 describe-addresses --query "Addresses[?AssociationId==null].PublicIp"
aws ec2 release-address --allocation-id eipalloc-0abc
aws ec2 describe-network-interfaces --filters Name=status,Values=available`},
{note:'Elastic IPs are an AZ-independent way to keep an address if an instance is replaced, but a load balancer DNS name is usually a better design.'}],
src:[['Elastic IP addresses',K.EC2+'elastic-ip-addresses-eip.html'],['Public IPv4 charge','https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights/']]};

/* ---------- 5 ---------- */
L['aws:7:5']={blocks:[
{p:'A **security group** is a **stateful** virtual firewall attached to network interfaces. It has **allow rules only**: everything not allowed is denied.'},
{h:'Behaviour'},
{ul:['**Stateful**: if a request is allowed in, the response is allowed out automatically, and the reverse.','Rules can reference an **IP range, a prefix list or another security group**.','Default group: allows all traffic from members of the same group, and all outbound.','A network interface can have several groups, and all their rules are combined.','Changes take effect immediately.']},
{h:'Design with group references'},
{code:`aws ec2 create-security-group --group-name web --description "web tier" --vpc-id vpc-0abc
aws ec2 authorize-security-group-ingress --group-id sg-web --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id sg-db --protocol tcp --port 5432 --source-group sg-app`},
{t:[['Tier','Inbound rule','Source'],
['Load balancer','TCP 443','Internet'],
['Application','TCP 8080','Load balancer security group'],
['Database','TCP 5432','Application security group']]},
{note:'Referencing a security group instead of CIDR ranges keeps rules correct as instances come and go. Avoid 0.0.0.0/0 on administrative ports such as 22 and 3389.'}],
src:[['Security groups',K.VPC+'vpc-security-groups.html']]};

/* ---------- 6 ---------- */
L['aws:7:6']={blocks:[
{p:'A **network ACL (NACL)** is a **stateless** firewall at the **subnet** boundary. It has numbered **allow and deny** rules, evaluated in order from the lowest number, and the first match decides.'},
{h:'Behaviour'},
{ul:['**Stateless**: you must allow both the request and the response, including **ephemeral ports** (1024-65535) for return traffic.','Separate inbound and outbound rule sets.','A final rule `*` denies anything not matched.','The default NACL allows all traffic. A custom NACL denies all until you add rules.','One NACL per subnet, one NACL can serve many subnets.']},
{t:[['Rule','Type','Protocol','Port','Source','Action'],
['100','HTTPS','TCP','443','0.0.0.0/0','ALLOW'],
['110','Custom TCP','TCP','1024-65535','0.0.0.0/0','ALLOW (return traffic)'],
['120','All','All','All','198.51.100.7/32','DENY'],
['*','All','All','All','0.0.0.0/0','DENY']]},
{note:'Use NACLs for coarse, subnet-wide deny rules such as blocking an abusive IP. Use security groups for everyday access control.'}],
src:[['Network ACLs',K.VPC+'vpc-network-acls.html']]};

/* ---------- 7 ---------- */
L['aws:7:7']={blocks:[
{p:'When connectivity fails, walk the packet through every control **in both directions**.'},
{svg:path},
{h:'Comparison'},
{t:[['','Security group','Network ACL'],
['Level','Network interface','Subnet'],
['State','Stateful','Stateless'],
['Rules','Allow only','Allow and deny'],
['Evaluation','All rules together','Ordered, first match'],
['Return traffic','Automatic','Must be allowed explicitly']]},
{h:'Checklist for a failed connection'},
{flow:['Source and destination addresses and ports are correct','Route table at the source has a route to the destination','Destination security group allows the source and port','Both NACLs allow request and response (ephemeral ports)','The service listens on the port and the guest firewall allows it','Reachability Analyzer or Flow Logs confirm where the packet stops']},
{code:`aws ec2 create-network-insights-path --source i-0abc --destination i-0def --protocol tcp --destination-port 443
aws ec2 start-network-insights-analysis --network-insights-path-id nip-0abc`},
{note:'In flow logs, ACCEPT on the inbound leg and REJECT on the return usually points to a NACL missing ephemeral ports.'}],
src:[['Reachability Analyzer','https://docs.aws.amazon.com/vpc/latest/reachability/what-is-reachability-analyzer.html']]};

/* ---------- 8 ---------- */
L['aws:7:8']={blocks:[
{p:'**VPC Flow Logs** record metadata about IP traffic (not payload) for an interface, subnet or VPC. Use them to investigate connectivity and detect unusual traffic.'},
{h:'Destinations and fields'},
{t:[['Destination','Use'],
['CloudWatch Logs','Search with Logs Insights, metric filters'],
['S3','Cheap storage, query with Athena'],
['Firehose','Stream to third-party tools']]},
{p:'A default record shows version, account, interface, source and destination address and port, protocol, packets, bytes, start and end time, **action (ACCEPT or REJECT)** and log status.'},
{code:`aws ec2 create-flow-logs --resource-type VPC --resource-ids vpc-0abc --traffic-type ALL \\
  --log-destination-type cloud-watch-logs --log-group-name /vpc/flow \\
  --deliver-logs-permission-arn arn:aws:iam::111122223333:role/flowlogs

fields @timestamp, srcAddr, dstAddr, dstPort, action
| filter action = "REJECT" and dstPort = 22
| stats count() by srcAddr
| sort count desc`},
{note:'Flow logs do not include traffic to the Amazon DNS server, DHCP, instance metadata or Windows license activation. They are delivered with a delay of minutes.'}],
src:[['VPC Flow Logs',K.VPC+'flow-logs.html']]};

/* ---------- 9 ---------- */
L['aws:7:9']={blocks:[
{p:'**Practical:** build a three-tier VPC and test the traffic paths.'},
{flow:['Create VPC 10.0.0.0/16 with public, application and data subnets in two AZs','Attach an internet gateway and create a public route table','Create one NAT gateway in a public subnet and a private route table pointing to it','Create security groups for load balancer, application and database tiers with group references','Launch a test instance in a private subnet with an SSM role and confirm outbound access','Enable flow logs and run Reachability Analyzer from the application tier to the database','Delete NAT gateways, Elastic IPs and the VPC']},
{h:'What to prove'},
{t:[['Test','Expected'],
['Private instance reaches the internet','Succeeds through NAT'],
['Internet reaches the private instance','Fails, no route and no public IP'],
['App tier reaches database port','Succeeds'],
['Another subnet reaches database port','Fails, not in the source group']]},
{note:'Delete the NAT gateway before the subnets and release the Elastic IP, or you will pay for both.'}],
src:[['VPC tutorials',K.VPC+'getting-started.html']]};
})();
