/* LearnSphere - AWS Administrator, Section 19: Troubleshooting & Incident Response.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const method=K.dg(700,200,[
[10,10,680,180,'A repeatable troubleshooting loop',1],
[25,60,110,60,'Scope|who, what,|where',0],[155,60,110,60,'Timeline|when did it|start',0],[285,60,120,60,'Changes|what changed|before it',2],[425,60,110,60,'Evidence|logs, metrics,|traces',0],[555,60,120,60,'Hypothesis|test, fix,|verify',0]],
[[135,90,155,90],[265,90,285,90],[405,90,425,90],[535,90,555,90]]);

const inc=K.dg(700,200,[
[10,10,680,180,'Incident lifecycle',1],
[25,70,110,60,'Detect',0],[155,70,110,60,'Classify|severity',0],[285,70,110,60,'Contain|and mitigate',2],[415,70,110,60,'Remediate|root cause',0],[545,70,130,60,'Review|learn, improve',0]],
[[135,100,155,100],[265,100,285,100],[395,100,415,100],[525,100,545,100]]);

/* ---------- 0 ---------- */
L['aws:18:0']={blocks:[
{p:'Good troubleshooting is a **method**, not a guess. The same loop works for networking, permissions, capacity or application errors.'},
{svg:method},
{h:'The questions'},
{t:[['Step','Ask','Tools'],
['Scope','Who is affected? One user, one AZ, everyone?','Dashboards, user reports'],
['Timeline','When did it start? Is it constant or intermittent?','CloudWatch metrics, alarms history'],
['Changes','What deployments, config or permission changes happened?','CloudTrail, Config timeline, CloudFormation events'],
['Evidence','What do logs and metrics say?','CloudWatch Logs Insights, flow logs, X-Ray'],
['Hypothesis','What is the smallest test that proves or disproves it?','Reachability Analyzer, test calls, policy simulator']]},
{h:'Habits'},
{ul:['Change **one thing at a time** and record it.','Check the **simplest causes first**: Region, account, credentials, quotas.','Prefer **read-only** investigation until you understand the cause.','Write down the timeline as you go.']},
{note:'Most incidents trace to a recent change. Config history and CloudTrail usually answer "what changed" within minutes.'}],
src:[['Operational excellence',K.WA+'operational-excellence.html']]};

/* ---------- 1 ---------- */
L['aws:18:1']={blocks:[
{p:'An **incident** is an unplanned interruption or degradation. A defined lifecycle keeps response calm and consistent.'},
{svg:inc},
{t:[['Severity','Example','Response'],
['Sev 1','Production down, data at risk','Immediate page, incident commander, all hands'],
['Sev 2','Major feature degraded','Page on-call, update stakeholders regularly'],
['Sev 3','Minor, workaround exists','Next business day']]},
{h:'Roles'},
{ul:['**Incident commander** coordinates and decides.','**Operations lead** investigates and applies fixes.','**Communications** updates stakeholders on a schedule.']},
{h:'Detect to learn'},
{flow:['Alarm or report opens the incident and sets severity','Mitigate first: roll back, fail over, scale, block','Investigate the root cause with the timeline','Remediate permanently and verify','Hold a blameless review and track actions to completion']},
{note:'Mitigation comes before root cause. Restore service first, then find out why.'}],
src:[['Security incident response guide','https://docs.aws.amazon.com/whitepapers/latest/aws-security-incident-response-guide/welcome.html']]};

/* ---------- 2 ---------- */
L['aws:18:2']={blocks:[
{p:'Deployments fail for a small set of repeating reasons. Learn to recognise them from the error text.'},
{t:[['Error or symptom','Cause','Fix'],
['LimitExceeded, VcpuLimitExceeded','Service quota reached','Request a quota increase in Service Quotas'],
['InsufficientInstanceCapacity','No capacity of that type in the AZ','Try another type, AZ or capacity reservation'],
['InvalidParameterValue, subnet has no free IPs','Subnet too small or exhausted','Use a larger subnet or another one'],
['UnauthorizedOperation, AccessDenied','Missing permission or SCP deny','Read the message, check policies, SCPs, boundaries'],
['AlreadyExists, name conflict','Name must be unique (S3, IAM)','Choose another name'],
['Template validation, CREATE_FAILED','Invalid property, missing dependency, no capabilities','Read stack events, add CAPABILITY_IAM if creating IAM'],
['InvalidAMIID.NotFound','AMI is in another Region or not shared','Copy or share the AMI'],
['Instance terminates immediately','EBS or KMS key access problem','Check the state reason and key permissions']]},
{code:`aws ec2 describe-instances --instance-ids i-0abc --query "Reservations[].Instances[].StateReason"
aws service-quotas get-service-quota --service-code ec2 --quota-code L-1216C47A
aws ec2 describe-subnets --subnet-ids subnet-0abc --query "Subnets[].AvailableIpAddressCount"`},
{note:'Decode an authorization failure message with `aws sts decode-authorization-message` when the error contains an encoded block.'}],
src:[['Troubleshoot launching instances',K.EC2+'troubleshooting-launch.html']]};

/* ---------- 3 ---------- */
L['aws:18:3']={blocks:[
{p:'Network problems are solved by **finding where traffic stops**. Use the evidence each tool provides.'},
{t:[['Tool','Shows','Use'],
['Reachability Analyzer','Whether a path exists and the blocking component','Config-based, before traffic'],
['VPC Flow Logs','ACCEPT or REJECT per flow and interface','Real traffic evidence'],
['ELB access logs','Request, target, status codes and timings','Load balancer errors'],
['CloudFront logs','Edge results, cache status','CDN issues'],
['WAF logs','Which rule matched and the action','Blocked legitimate requests'],
['Route 53 query logs','Resolution results','DNS issues'],
['Network Access Analyzer','Unintended paths','Security review']]},
{h:'Path walk'},
{flow:['DNS: does the name resolve to the expected address','Route: does the source subnet have a route to the destination','Firewall: security groups and NACLs in both directions','Target: is the service listening and healthy','Application and TLS: certificate, protocol and headers']},
{code:`aws ec2 start-network-insights-analysis --network-insights-path-id nip-0abc
aws ec2 describe-network-insights-analyses --network-insights-analysis-ids nia-0abc --query "NetworkInsightsAnalyses[].[Status,NetworkPathFound,Explanations[0].ExplanationCode]"`},
{note:'Flow logs REJECT plus a matching rule gap is faster than guessing. If there is no record at all, traffic never reached the interface, so look upstream at routes and DNS.'}],
src:[['Reachability Analyzer','https://docs.aws.amazon.com/vpc/latest/reachability/what-is-reachability-analyzer.html']]};

/* ---------- 4 ---------- */
L['aws:18:4']={blocks:[
{p:'Hybrid and private paths add moving parts: tunnels, BGP, attachments, endpoints and DNS.'},
{t:[['Symptom','Likely cause','Check'],
['VPN tunnel down','IKE or IPSec mismatch, device or firewall issue','TunnelState metric, device logs, both tunnels'],
['Tunnel up, no traffic','Missing routes or propagation, overlapping CIDR','Route tables, BGP received routes'],
['Direct Connect VIF down','BGP session or VLAN problem','BGP status, LOA, VIF state'],
['Transit Gateway traffic dropped','Route table association or propagation missing, blackhole route','TGW route table, attachment state'],
['Cannot reach AWS API privately','Endpoint DNS, security group or policy','Private DNS enabled, SG allows 443, endpoint policy'],
['On-premises cannot resolve AWS names','No inbound endpoint or forwarding','Resolver endpoints and rules']]},
{h:'Method'},
{flow:['Verify the underlay: link, tunnel or circuit is up','Verify routing on both sides, including return routes','Verify security controls at each end','Verify DNS resolution for private names','Test with a simple tool such as ping or telnet from both directions']},
{code:`aws ec2 describe-vpn-connections --vpn-connection-ids vpn-0abc --query "VpnConnections[].VgwTelemetry"
aws ec2 search-transit-gateway-routes --transit-gateway-route-table-id tgw-rtb-0abc --filters Name=state,Values=active,blackhole
aws directconnect describe-virtual-interfaces --query "virtualInterfaces[].[virtualInterfaceId,virtualInterfaceState,bgpPeers[0].bgpStatus]"`}],
src:[['VPN troubleshooting','https://docs.aws.amazon.com/vpn/latest/s2svpn/Troubleshooting.html']]};

/* ---------- 5 ---------- */
L['aws:18:5']={blocks:[
{p:'Instances have **two status checks**, and each points at a different layer.'},
{t:[['Check','Tests','Failure usually means','Action'],
['System status','AWS host hardware and network','Underlying host problem','Stop and start to move host, or auto recovery'],
['Instance status','Guest OS and networking','Kernel panic, bad config, full disk, wrong networking','Console output, reboot, fix config or attach volume to a rescue instance']]},
{h:'Tools'},
{ul:['**Get console output** and **screenshot** show boot messages and the login screen.','**EC2 Serial Console** gives text access to the instance even with broken networking (must be enabled).','**Session Manager** works if the agent, role and network are fine.','**EC2 Rescue** and the Systems Manager **AWSSupport-ExecuteEC2Rescue** runbook repair common issues.','**Attach the root volume to a helper instance** to fix files.']},
{code:`aws ec2 describe-instance-status --instance-ids i-0abc --query "InstanceStatuses[].[SystemStatus.Status,InstanceStatus.Status]"
aws ec2 get-console-output --instance-id i-0abc --latest --output text
aws ec2-instance-connect send-serial-console-ssh-public-key --instance-id i-0abc --serial-port 0 --ssh-public-key file://key.pub`},
{note:'Cannot connect over SSH: check security group, route, public IP, key pair, OS firewall and that sshd is running. Work in that order.'}],
src:[['Status checks',K.EC2+'monitoring-system-instance-status-check.html']]};

/* ---------- 6 ---------- */
L['aws:18:6']={blocks:[
{p:'Trace a common **symptom** back to the likely layer.'},
{t:[['Symptom','Most likely causes','First check'],
['403 from S3','Bucket policy, missing key permission, Block Public Access, OAC mismatch','Policy simulator, bucket and key policy, error message'],
['403 from API Gateway or WAF','Authorizer, resource policy or WAF rule','WAF logs and gateway logs'],
['5xx from load balancer','Unhealthy targets, app errors, timeouts','Target health and access logs'],
['Throttling (429, ThrottlingException)','API or service rate limits reached','Quotas, retries with backoff, request spread'],
['Timeouts','Security group or NACL, no route, overloaded target','Reachability Analyzer, target metrics'],
['Slow responses','CPU, memory, I/O or database load','CloudWatch metrics, Performance Insights, X-Ray'],
['Intermittent failures','One bad target, DNS caching, AZ issue','Per-AZ metrics, target health history']]},
{h:'Handling throttling'},
{ul:['Use **exponential backoff with jitter** in clients and scripts.','Reduce call rate or batch operations.','Request **quota increases** where the limit is adjustable.']},
{note:'AccessDenied messages often include the denying policy type. Read them fully before changing anything.'}],
src:[['API request throttling','https://docs.aws.amazon.com/AWSEC2/latest/APIReference/throttling.html']]};

/* ---------- 7 ---------- */
L['aws:18:7']={blocks:[
{p:'**Practical:** diagnose and fix several deliberately broken environments. Use only the method, the logs and the console, not guessing.'},
{h:'Scenarios'},
{t:[['Scenario','What is broken','Hint'],
['1','Instance in a private subnet cannot reach the internet','Route table and NAT'],
['2','Application behind an ALB returns 502','Security group between ALB and target, health check path'],
['3','A Lambda in a VPC times out calling an AWS API','No NAT or endpoint'],
['4','A user can list a bucket but not read objects','Missing object-level permission or KMS'],
['5','Stack update rolls back','Read the first FAILED event'],
['6','Instance fails the instance status check','Console output, full disk']]},
{h:'Record for each'},
{flow:['Scope and timeline','What changed','Evidence you used','Root cause','Fix and how you verified it']},
{note:'After each scenario write a two-line runbook entry. A personal troubleshooting log becomes a strong asset.'}],
src:[['AWS Support knowledge center','https://repost.aws/knowledge-center']]};
})();
