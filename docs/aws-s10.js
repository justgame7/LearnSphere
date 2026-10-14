/* LearnSphere - AWS Administrator, Section 10: DNS & Content Delivery: Route 53, CloudFront and Global Accelerator.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const dns=K.dg(700,220,[
[10,10,680,200,'DNS resolution',1],
[25,70,100,60,'Client',0],[155,70,120,60,'Recursive|resolver',0],[305,40,110,40,'Root',0],[305,90,110,40,'TLD (.com)',0],[305,140,110,40,'Authoritative|Route 53',2],[470,70,200,60,'Answer is cached for|the record TTL',0]],
[[125,100,155,100],[275,100,305,60],[275,100,305,110],[275,100,305,160],[415,160,470,110]]);

const policy=K.dg(700,200,[
[10,10,680,180,'Route 53 routing policies',1],
[25,50,100,50,'Simple',0],[135,50,100,50,'Weighted',0],[245,50,100,50,'Latency',0],[355,50,100,50,'Failover',2],[465,50,100,50,'Geolocation',0],[575,50,100,50,'Geoproximity|IP-based|Multivalue',0],
[25,120,650,45,'Health checks make Weighted, Latency, Failover and Multivalue skip unhealthy endpoints',0]],
[]);

const cf=K.dg(700,210,[
[10,10,680,190,'CloudFront request flow',1],
[25,70,90,60,'Viewer',0],[150,70,120,60,'Edge location|cache lookup',2],[305,70,110,60,'Regional|edge cache',0],[450,70,100,60,'Origin|S3 or ALB',0],[585,70,90,60,'Response|cached',0]],
[[115,100,150,100],[270,100,305,100],[415,100,450,100],[550,100,585,100]]);

/* ---------- 0 ---------- */
L['aws:9:0']={blocks:[
{p:'**DNS** translates names to addresses. **Amazon Route 53** is AWS highly available DNS service, a domain registrar and a health-checking service.'},
{svg:dns},
{h:'Record types you will meet'},
{t:[['Type','Maps to','Notes'],
['A','IPv4 address',''],
['AAAA','IPv6 address',''],
['CNAME','Another name','Not allowed at the zone apex'],
['MX','Mail servers','With priority'],
['TXT','Text','SPF, verification'],
['NS','Name servers for a zone','Delegation'],
['SOA','Zone authority information','Created automatically'],
['Alias (Route 53)','AWS resource','Works at the apex, no query charge for many targets']]},
{h:'What Route 53 provides'},
{ul:['Authoritative DNS in **public** and **private** hosted zones.','Domain registration and transfer.','Health checks and DNS failover.','Resolver for hybrid DNS between VPCs and on premises.']},
{note:'**TTL** is how long resolvers cache an answer. Lower it before a planned change, wait out the old TTL, then switch.'}],
src:[['What is Route 53',K.R53+'Welcome.html']]};

/* ---------- 1 ---------- */
L['aws:9:1']={blocks:[
{p:'A **hosted zone** holds the records for a domain. A **public** zone answers on the internet. A **private** zone answers only to the VPCs you associate.'},
{h:'Alias records'},
{p:'An **alias record** is a Route 53 extension that points a name at an AWS resource such as CloudFront, an ELB, S3 website endpoint, API Gateway or another record in the same zone.'},
{t:[['','CNAME','Alias'],
['Zone apex (example.com)','Not allowed','Allowed'],
['Query charge','Charged','Free for AWS targets'],
['Targets','Any name','Supported AWS resources'],
['Health follows target','No','Optional (Evaluate target health)']]},
{code:`aws route53 create-hosted-zone --name example.com --caller-reference $(date +%s)
aws route53 change-resource-record-sets --hosted-zone-id Z123 --change-batch '{
  "Changes":[{"Action":"UPSERT","ResourceRecordSet":{
    "Name":"www.example.com","Type":"A",
    "AliasTarget":{"HostedZoneId":"Z32O12XQLNTSW2","DNSName":"my-alb-123.eu-west-1.elb.amazonaws.com","EvaluateTargetHealth":true}}}]}'`},
{note:'After registering or moving a domain, the registrar must list the four name servers of the hosted zone. A wrong NS set is the most common reason a new zone does not resolve.'}],
src:[['Hosted zones',K.R53+'hosted-zones-working-with.html'],['Alias records',K.R53+'resource-record-sets-choosing-alias-non-alias.html']]};

/* ---------- 2 ---------- */
L['aws:9:2']={blocks:[
{p:'A **routing policy** decides which record answers a query. Policies other than Simple can be combined with health checks.'},
{svg:policy},
{t:[['Policy','Solves','Example'],
['Simple','One resource','A single web server'],
['Weighted','Split traffic by weight','10% to a canary'],
['Latency','Send users to the lowest-latency Region','Multi-Region app'],
['Failover','Active-passive','Primary site and standby'],
['Geolocation','By user country or continent','Data residency, localization'],
['Geoproximity','By distance with bias','Shift load toward a Region'],
['IP-based','By client CIDR','Route known networks'],
['Multivalue answer','Up to 8 healthy answers','Simple client-side balancing']]},
{note:'Routing policy is about DNS answers, not live traffic. Cached answers keep users on the old target until the TTL expires.'}],
src:[['Routing policies',K.R53+'routing-policy.html']]};

/* ---------- 3 ---------- */
L['aws:9:3']={blocks:[
{p:'**Route 53 health checks** test endpoints from several global locations and feed failover and other policies.'},
{t:[['Type','Checks'],
['Endpoint','HTTP, HTTPS or TCP to an address or domain, optional string match'],
['Calculated','Combines other health checks with AND, OR or a threshold'],
['CloudWatch alarm','Status of an alarm, for resources that Route 53 cannot reach (private resources)']]},
{h:'Failover pattern'},
{flow:['Primary record is associated with a health check','Standby record is marked as secondary','Route 53 checkers probe the primary endpoint','When it fails, DNS answers switch to the secondary','Recovery of the primary returns traffic after the TTL']},
{code:`aws route53 create-health-check --caller-reference hc-1 --health-check-config \\
  '{"Type":"HTTPS","FullyQualifiedDomainName":"app.example.com","Port":443,"ResourcePath":"/health","RequestInterval":30,"FailureThreshold":3}'`},
{note:'Health checkers must be allowed in your security groups. For private endpoints, health check a CloudWatch alarm instead.'}],
src:[['Health checks',K.R53+'health-checks-creating.html']]};

/* ---------- 4 ---------- */
L['aws:9:4']={blocks:[
{p:'Each VPC has a built-in resolver (the Route 53 Resolver at the **VPC base address + 2**). **Resolver endpoints** and **rules** extend name resolution to and from on-premises networks.'},
{t:[['Piece','Direction','Use'],
['Inbound endpoint','On premises to VPC','On-premises servers resolve private hosted zone names and AWS names'],
['Outbound endpoint','VPC to on premises','VPC instances resolve corporate names'],
['Forwarding rule','Matches a domain','Send queries for corp.example.com to on-premises DNS'],
['Private hosted zone','Inside associated VPCs','Internal names such as db.internal']]},
{h:'Requirements'},
{ul:['Enable **DNS hostnames** and **DNS resolution** on the VPC.','Endpoints are ENIs in at least two subnets, with security groups allowing TCP and UDP 53.','Associate private hosted zones and rules to every VPC that needs them, or share rules with RAM.']},
{code:`aws route53resolver create-resolver-endpoint --name out --direction OUTBOUND \\
  --security-group-ids sg-0abc --ip-addresses SubnetId=subnet-a SubnetId=subnet-b --creator-request-id out1
aws route53resolver create-resolver-rule --rule-type FORWARD --domain-name corp.example.com \\
  --target-ips Ip=10.200.0.2,Port=53 --resolver-endpoint-id rslvr-out-0abc --creator-request-id r1`},
{note:'Resolver endpoints cost per ENI per hour and per query, so share them across VPCs with Resource Access Manager rather than creating one in every VPC.'}],
src:[['Route 53 Resolver',K.R53+'resolver.html']]};

/* ---------- 5 ---------- */
L['aws:9:5']={blocks:[
{p:'**Query logging** records DNS queries for troubleshooting and security.'},
{t:[['Log','Records','Destination'],
['Public DNS query logging','Queries for your public hosted zone','CloudWatch Logs (us-east-1)'],
['Resolver query logging','Queries made by resources in your VPCs','CloudWatch Logs, S3, Firehose']]},
{h:'What a record shows'},
{ul:['Time, query name and type, response code (NOERROR, NXDOMAIN, SERVFAIL).','Source: edge location (public) or source IP and VPC (resolver).','Answers returned.']},
{code:`aws route53 create-query-logging-config --hosted-zone-id Z123 --cloud-watch-logs-log-group-arn <arn>
aws route53resolver create-resolver-query-log-config --name vpc-dns --destination-arn <s3-or-logs-arn> --creator-request-id q1
aws route53resolver associate-resolver-query-log-config --resolver-query-log-config-id rqlc-0abc --resource-id vpc-0abc`},
{note:'Use resolver logs to spot instances querying suspicious domains and to find which service an application depends on before you restrict egress.'}],
src:[['Resolver query logging',K.R53+'resolver-query-logs.html']]};

/* ---------- 6 ---------- */
L['aws:9:6']={blocks:[
{p:'**Amazon CloudFront** is a content delivery network. A **distribution** serves content from edge locations and fetches from an **origin** on a cache miss.'},
{svg:cf},
{h:'Concepts'},
{t:[['Piece','Meaning'],
['Distribution','The configuration with a domain name such as d123.cloudfront.net'],
['Origin','Where content comes from: S3, ALB, EC2, API Gateway, custom HTTP'],
['Behavior','Path pattern rule: which origin, cache policy, viewer protocol and allowed methods'],
['Cache policy','What makes a cache key and how long objects stay'],
['Origin Access Control (OAC)','Lets CloudFront sign requests so the S3 bucket stays private']]},
{h:'Keep the origin private'},
{flow:['Create an OAC for the S3 origin','Attach it to the distribution origin','Add a bucket policy allowing the CloudFront service principal for that distribution','Keep Block Public Access on']},
{code:`{"Effect":"Allow","Principal":{"Service":"cloudfront.amazonaws.com"},"Action":"s3:GetObject",
 "Resource":"arn:aws:s3:::my-site/*",
 "Condition":{"StringEquals":{"AWS:SourceArn":"arn:aws:cloudfront::111122223333:distribution/E123"}}}`},
{note:'For ALB origins, restrict the load balancer to CloudFront using the managed prefix list in the security group, and add a secret header check if needed.'}],
src:[['Amazon CloudFront','https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html']]};

/* ---------- 7 ---------- */
L['aws:9:7']={blocks:[
{p:'CloudFront caches by a **cache key**. A bigger key means fewer hits. The **TTL** and your origin headers set how long content stays.'},
{h:'Controls'},
{t:[['Control','Effect'],
['Cache policy','Which headers, cookies and query strings are in the cache key, and min/default/max TTL'],
['Origin request policy','What is forwarded to the origin without being in the key'],
['Cache-Control and Expires','Origin hints, bounded by the policy TTLs'],
['Invalidation','Remove objects before TTL. First 1,000 paths per month free'],
['Versioned file names','Best practice: new name per change, no invalidation needed']]},
{h:'Troubleshooting'},
{t:[['Symptom','Likely cause'],
['Always Miss from cloudfront','Cache key includes too much, or origin sends no-cache'],
['Stale content','TTL too long, no invalidation or versioning'],
['403 from S3 origin','OAC and bucket policy mismatch or missing object'],
['502 or 504','Origin unreachable, TLS mismatch or timeout']]},
{code:`aws cloudfront create-invalidation --distribution-id E123 --paths "/index.html" "/css/*"
curl -sI https://www.example.com/app.js | grep -i -E "x-cache|age|via"`},
{note:'The header **X-Cache** shows Hit, Miss or RefreshHit from cloudfront. Use it first when diagnosing cache behaviour.'}],
src:[['Managing cache expiration','https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html']]};

/* ---------- 8 ---------- */
L['aws:9:8']={blocks:[
{p:'**AWS Global Accelerator** gives you **two static anycast IP addresses** that route users onto the AWS global network at the nearest edge, then to the best healthy endpoint in one or more Regions.'},
{h:'How it differs from CloudFront'},
{t:[['','CloudFront','Global Accelerator'],
['Purpose','Cache and deliver HTTP content','Improve the network path for TCP and UDP'],
['Caching','Yes','No'],
['Addresses','DNS name, changing IPs','Two static anycast IPs'],
['Best for','Websites, media, APIs with cacheable content','Gaming, VoIP, non-HTTP, fast regional failover, IP allow-listing'],
['Failover','By origin groups','Health-based traffic shift in seconds']]},
{h:'Components'},
{ul:['**Accelerator** with static IPs.','**Listener** for protocols and ports.','**Endpoint groups** per Region with traffic dials.','Endpoints: ALB, NLB, EC2 instance or Elastic IP.']},
{note:'Static IPs help partners who allow-list your addresses. Failover does not wait for DNS TTLs because the IPs stay the same.'}],
src:[['Global Accelerator','https://docs.aws.amazon.com/global-accelerator/latest/dg/what-is-global-accelerator.html']]};

/* ---------- 9 ---------- */
L['aws:9:9']={blocks:[
{p:'**Practical:** serve a site globally and prove failover works.'},
{flow:['Create a private S3 bucket with an index page and a CloudFront distribution using OAC','Verify the object is reachable through CloudFront and not directly from S3','Create a Route 53 alias record for your domain pointing at the distribution','Create a second origin or a regional endpoint and a health check on the primary','Configure failover records, then break the primary and watch the answer change','Invalidate a changed file and confirm the new version is served','Delete the distribution, records and buckets']},
{t:[['Test','Expected'],
['Direct S3 URL','403 Access Denied'],
['CloudFront URL','200 with X-Cache header'],
['Failover','Answer switches to secondary after the health check fails'],
['Invalidation','New content visible after completion']]},
{note:'A CloudFront distribution takes several minutes to deploy and delete. Disable it before deleting.'}],
src:[['CloudFront getting started','https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GettingStarted.SimpleDistribution.html']]};
})();
