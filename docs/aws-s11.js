/* LearnSphere - AWS Administrator, Section 11: Load Balancing, Auto Scaling & High Availability.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const ha=K.dg(700,250,[
[10,10,680,230,'Highly available web tier',1],
[270,35,160,45,'Load balancer|across two AZs',2],
[40,115,280,100,'AZ A',1],[380,115,280,100,'AZ B',1],
[70,150,100,45,'Instance',0],[190,150,100,45,'Instance',0],[410,150,100,45,'Instance',0],[530,150,100,45,'Instance',0]],
[[320,80,120,115],[330,80,240,150],[370,80,460,150],[380,80,580,150]]);

const elb=K.dg(700,210,[
[10,10,680,190,'Choose the balancer by layer',1],
[25,55,200,110,'Application (ALB)|HTTP, HTTPS, gRPC|path and host rules|Layer 7',2],[250,55,200,110,'Network (NLB)|TCP, UDP, TLS|static IP, very low latency|Layer 4',0],[475,55,200,110,'Gateway (GWLB)|inline appliances|firewalls and inspection|Layer 3',0]],
[]);

const asg=K.dg(700,200,[
[10,10,680,180,'Auto Scaling group',1],
[30,60,140,60,'Launch template|what to launch',0],[210,60,160,60,'Min / Desired / Max|how many',2],[410,60,130,60,'Scaling policy|when to change',0],[580,60,90,60,'Health check|replace',0]],
[[170,90,210,90],[370,90,410,90],[540,90,580,90]]);

/* ---------- 0 ---------- */
L['aws:10:0']={blocks:[
{p:'Three related ideas shape resilient designs, and they are not the same.'},
{t:[['Concept','Meaning','AWS mechanism'],
['Scalability','Handle more load by adding capacity','Larger instances (vertical) or more instances (horizontal)'],
['Elasticity','Capacity follows demand up and down automatically','Auto Scaling, serverless'],
['High availability','Keeps working when a component fails','Multiple AZs, load balancing, health checks'],
['Fault tolerance','Continues with no interruption','Redundancy at every layer'],
['Resilience','Recovers quickly from disruption','Backups, automation, DR']]},
{svg:ha},
{h:'Design rules'},
{ul:['Remove **single points of failure**: more than one instance, AZ and path.','Make instances **stateless**: sessions in a cache or database, files in S3 or EFS.','Use **health checks** so failed components are removed and replaced.','Decouple with queues so a slow tier does not take down a fast one.']},
{note:'High availability is about AZ failure inside a Region. Disaster recovery is about Region loss, and is covered in the recovery section.'}],
src:[['Reliability pillar',K.WA+'reliability.html']]};

/* ---------- 1 ---------- */
L['aws:10:1']={blocks:[
{p:'**Elastic Load Balancing** distributes incoming traffic across targets in several AZs and checks their health. Choose the type by protocol and requirement.'},
{svg:elb},
{t:[['','ALB','NLB','GWLB'],
['Layer','7','4','3'],
['Protocols','HTTP, HTTPS, gRPC, WebSocket','TCP, UDP, TLS','IP packets (GENEVE)'],
['Routing','Path, host, header, query, method','Port','Transparent to appliances'],
['Static IP','No (use Global Accelerator)','Yes, one per AZ, Elastic IP supported','n/a'],
['Targets','Instances, IPs, Lambda','Instances, IPs, ALB','Appliance instances and IPs'],
['Security groups','Yes','Yes','No']]},
{note:'The Classic Load Balancer is legacy. Plan migration to ALB or NLB for new work and for older environments.'}],
src:[['Elastic Load Balancing',K.ELB+'what-is-load-balancing.html']]};

/* ---------- 2 ---------- */
L['aws:10:2']={blocks:[
{p:'An **Application Load Balancer** receives requests on **listeners**, evaluates **rules** and forwards to **target groups**, which hold the targets and run health checks.'},
{flow:['A client sends a request to the load balancer DNS name','A listener on 443 receives it and terminates TLS with an ACM certificate','Rules are evaluated by priority (host, path, header and so on)','The matching action forwards to a target group, redirects or returns a fixed response','The load balancer picks a healthy target and returns the response']},
{h:'Target group health checks'},
{t:[['Setting','Notes'],
['Protocol, port, path','Use a lightweight path such as /health that checks real dependencies reasonably'],
['Healthy / unhealthy threshold','Consecutive successes or failures'],
['Interval and timeout','How often and how long to wait'],
['Success codes','For example 200-299'],
['Deregistration delay','Time to drain connections before removal, default 300 seconds']]},
{code:`aws elbv2 create-target-group --name web --protocol HTTP --port 8080 --vpc-id vpc-0abc \\
  --health-check-path /health --target-type instance
aws elbv2 create-listener --load-balancer-arn <alb> --protocol HTTPS --port 443 \\
  --certificates CertificateArn=<acm-arn> --default-actions Type=forward,TargetGroupArn=<tg>
aws elbv2 describe-target-health --target-group-arn <tg>`},
{note:'The target security group must allow traffic from the **load balancer security group**, on the traffic port and the health check port.'}],
src:[['Application Load Balancers',K.ELB+'application/introduction.html']]};

/* ---------- 3 ---------- */
L['aws:10:3']={blocks:[
{p:'A **Network Load Balancer** works at layer 4. It handles millions of requests per second with very low latency and provides a **static IP per AZ**.'},
{h:'Features'},
{ul:['TCP, UDP, TCP_UDP and **TLS** listeners, with TLS termination and ACM certificates.','**Static IP** or **Elastic IP** per AZ, which suits firewall allow-lists.','Preserves the **client source IP** when targets are instances.','Supports **PrivateLink** services, so a NLB is the front of an endpoint service.','Security groups are supported on newer NLBs.']},
{h:'Cross-zone load balancing'},
{t:[['','Behaviour'],
['Off (NLB default)','Each node sends traffic only to targets in its own AZ, so unequal target counts give uneven load'],
['On (ALB default)','Each node spreads across targets in all AZs, with possible inter-AZ data charges for NLB']]},
{code:`aws elbv2 modify-load-balancer-attributes --load-balancer-arn <nlb> \\
  --attributes Key=load_balancing.cross_zone.enabled,Value=true`},
{note:'With cross-zone off, keep the number of healthy targets even across AZs or one AZ will be overloaded.'}],
src:[['Network Load Balancers',K.ELB+'network/introduction.html']]};

/* ---------- 4 ---------- */
L['aws:10:4']={blocks:[
{p:'Learn the error code, then check **who** generated it: the load balancer or the target.'},
{t:[['Code','Meaning','Common causes'],
['400','Bad request','Malformed request, header too large'],
['403','Forbidden','WAF block or listener rule fixed response'],
['502 Bad Gateway','Invalid response from target','Target closed connection, app crash, TLS or protocol mismatch'],
['503 Service Unavailable','No healthy targets','All targets unhealthy, target group empty'],
['504 Gateway Timeout','Target did not answer in time','Security group or NACL blocks, slow app, idle timeout too low']]},
{h:'Method'},
{flow:['Check target health in the target group and read the reason code','Confirm security groups and NACLs between the load balancer and targets','Test the health path directly from an instance in the VPC','Enable access logs and read elb_status_code against target_status_code','Check the idle timeout against long requests (default 60 seconds)']},
{code:`aws elbv2 modify-load-balancer-attributes --load-balancer-arn <alb> \\
  --attributes Key=access_logs.s3.enabled,Value=true Key=access_logs.s3.bucket,Value=my-elb-logs
aws elbv2 describe-target-health --target-group-arn <tg> --query "TargetHealthDescriptions[].[Target.Id,TargetHealth.State,TargetHealth.Reason]"`},
{note:'If `elb_status_code` is 502 and `target_status_code` is a dash, the target never responded. If both are 5xx, the application returned the error.'}],
src:[['Troubleshoot ALB',K.ELB+'application/load-balancer-troubleshooting.html']]};

/* ---------- 5 ---------- */
L['aws:10:5']={blocks:[
{p:'An **Auto Scaling group (ASG)** keeps a fleet at the right size. It launches from a **launch template**, spreads across subnets and AZs, and replaces unhealthy instances.'},
{svg:asg},
{h:'Capacity settings'},
{t:[['Setting','Meaning'],
['Minimum','Never fewer than this'],
['Desired','The number the group tries to maintain right now'],
['Maximum','Never more than this']]},
{h:'Health and replacement'},
{ul:['Default health check is **EC2** (instance status). Add **ELB** health checks so unhealthy targets are replaced.','Set a **health check grace period** so new instances can start before being judged.','An unhealthy instance is terminated and a new one launched to meet desired capacity.','Spread across at least two AZs. The group rebalances after an AZ recovers.']},
{code:`aws autoscaling create-auto-scaling-group --auto-scaling-group-name web \\
  --launch-template LaunchTemplateName=web,Version='$Latest' \\
  --min-size 2 --max-size 6 --desired-capacity 2 \\
  --vpc-zone-identifier "subnet-a,subnet-b" --target-group-arns <tg> --health-check-type ELB --health-check-grace-period 120`}],
src:[['Amazon EC2 Auto Scaling',K.ASG+'what-is-amazon-ec2-auto-scaling.html']]};

/* ---------- 6 ---------- */
L['aws:10:6']={blocks:[
{p:'**Scaling policies** change desired capacity. Use the simplest one that matches the pattern.'},
{t:[['Policy','How it works','Use'],
['Target tracking','Keep a metric near a target, for example average CPU 50%','Default choice, simple and self-tuning'],
['Step scaling','Different adjustments for different alarm breach sizes','Fine control with alarms'],
['Simple scaling','One adjustment per alarm with a cooldown','Legacy, prefer step or target tracking'],
['Scheduled','Change capacity at a time','Known peaks'],
['Predictive','Forecasts from history and scales ahead','Cyclical, recurring load']]},
{h:'Metrics worth tracking'},
{ul:['Average CPU utilization.','**Request count per target** for web tiers (ALBRequestCountPerTarget).','Queue depth per instance for worker fleets (custom metric).']},
{h:'Stability'},
{ul:['**Instance warmup** stops new instances being counted before they are ready.','**Cooldown** prevents rapid repeated actions.','Scale-in should be slower than scale-out. Protect critical instances with scale-in protection.']},
{code:`aws autoscaling put-scaling-policy --auto-scaling-group-name web --policy-name cpu50 \\
  --policy-type TargetTrackingScaling --target-tracking-configuration \\
  '{"PredefinedMetricSpecification":{"PredefinedMetricType":"ASGAverageCPUUtilization"},"TargetValue":50.0}'`}],
src:[['Scaling policies',K.ASG+'as-scale-based-on-demand.html']]};

/* ---------- 7 ---------- */
L['aws:10:7']={blocks:[
{p:'Three features control what happens during instance **launch**, **termination** and **rollout**.'},
{h:'Lifecycle hooks'},
{p:'A hook **pauses** an instance in `Pending:Wait` or `Terminating:Wait` so you can run an action, for example install software at launch or drain and upload logs before termination. The action finishes with `CONTINUE` or `ABANDON`, or the timeout expires.'},
{flow:['The ASG launches or selects an instance to terminate','It enters a wait state and a notification goes to EventBridge, SNS or SQS','Automation (Lambda or Systems Manager) does the work','The automation calls complete-lifecycle-action','The instance moves on to InService or Terminated']},
{h:'Instance refresh'},
{p:'**Instance refresh** replaces instances in a rolling way to roll out a new AMI or launch template version. You set the **minimum healthy percentage** and **warmup**, and can enable checkpoints or automatic rollback with alarms.'},
{h:'Warm pools'},
{p:'A **warm pool** holds pre-initialized instances in a stopped or running state so scale-out is faster for applications with long start times. You pay for storage and any running instances while they wait.'},
{code:`aws autoscaling start-instance-refresh --auto-scaling-group-name web \\
  --preferences '{"MinHealthyPercentage":90,"InstanceWarmup":120}'
aws autoscaling complete-lifecycle-action --lifecycle-hook-name drain --auto-scaling-group-name web \\
  --lifecycle-action-result CONTINUE --instance-id i-0abc`}],
src:[['Lifecycle hooks',K.ASG+'lifecycle-hooks.html'],['Instance refresh',K.ASG+'asg-instance-refresh.html']]};

/* ---------- 8 ---------- */
L['aws:10:8']={blocks:[
{p:'A fault-tolerant design survives the loss of an instance and of an **entire AZ**.'},
{t:[['Layer','Single point of failure','Fix'],
['Compute','One instance','ASG across two or more AZs'],
['Entry','One server with a public IP','ALB or NLB across AZs'],
['Database','One DB instance','Multi-AZ RDS or Aurora'],
['Network egress','One NAT gateway','NAT gateway per AZ'],
['Shared files','Local disk','EFS or S3'],
['Sessions','In instance memory','ElastiCache, DynamoDB or sticky avoidance'],
['Capacity','Enough for N, not N-1','Run at N+1 so one AZ loss is absorbed']]},
{h:'Capacity during an AZ loss'},
{p:'If two AZs each carry half the load, losing one doubles the load on the other. Size or scale so the **remaining AZs can take the traffic**, or use three AZs to reduce the extra.'},
{h:'Test it'},
{ul:['Terminate instances and watch replacement.','Fail a database over.','Use **AWS Fault Injection Service** to inject controlled failures such as stopping instances or throttling APIs.']},
{note:'A design that was never tested is a hypothesis. Run failure tests in a non-production environment first.'}],
src:[['AWS Fault Injection Service','https://docs.aws.amazon.com/fis/latest/userguide/what-is.html']]};

/* ---------- 9 ---------- */
L['aws:10:9']={blocks:[
{p:'**Practical:** build a self-healing, auto-scaling web tier and watch it react.'},
{flow:['Create a launch template that installs a simple web server through user data','Create an ALB with a target group and health check on /health','Create an ASG across two AZs with min 2, max 4 and target tracking at 40% CPU','Terminate one instance and watch the ASG replace it','Install a load tool or run a CPU stress command to push CPU above the target','Observe scale-out in activity history, then scale-in after the load ends','Delete the ASG, load balancer, target group and launch template']},
{h:'What to record'},
{t:[['Event','Where to look'],
['Replacement','ASG activity history'],
['Scale-out','CloudWatch alarms created by target tracking'],
['Target health','Target group Targets tab'],
['Failure','Stop all instances in one AZ and confirm traffic continues']]},
{note:'Setting min equals desired equals max makes a fixed fleet that still self-heals. Many production tiers use this for simple resilience.'}],
src:[['ASG tutorial',K.ASG+'GettingStartedTutorial.html']]};
})();
