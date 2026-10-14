/* LearnSphere - AWS Administrator, Section 05: Amazon EC2: Instances, AMIs & Placement.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const stack=K.dg(700,230,[
[10,10,680,210,'What an EC2 instance is made of',1],
[30,50,140,60,'AMI|OS and software',0],[200,50,140,60,'Instance type|CPU, memory, network',0],[370,50,140,60,'Storage|EBS or instance store',0],[540,50,130,60,'Network|ENI, subnet, SG',0],
[30,140,300,50,'IAM instance profile and user data',0],[370,140,300,50,'Key pair, tags, placement, metadata options',0]],
[]);

const states=K.dg(700,230,[
[10,10,680,210,'Instance lifecycle',1],
[30,80,110,50,'pending',0],[180,80,110,50,'running',2],[330,30,120,45,'stopping',0],[330,135,130,45,'shutting-down',0],[500,30,120,45,'stopped',0],[500,135,130,45,'terminated',0]],
[[140,105,180,105],[290,95,330,60],[290,115,330,155],[450,52,500,52],[460,157,500,157],[560,75,560,135]]);

const place=K.dg(700,200,[
[10,10,680,180,'Placement groups',1],
[30,55,190,100,'Cluster|one AZ, closest hosts|lowest latency',0],[255,55,190,100,'Spread|distinct hardware|max 7 per AZ',0],[480,55,190,100,'Partition|groups on separate racks|large distributed systems',0]],
[]);

/* ---------- 0 ---------- */
L['aws:4:0']={blocks:[
{p:'An **EC2 instance** is a virtual server. Its capabilities come from the **instance type**, its software from an **AMI**, its disks from **EBS** or instance store and its connectivity from a **network interface**.'},
{svg:stack},
{h:'Reading an instance type'},
{p:'`m7g.xlarge` = family **m** (general purpose), generation **7**, attribute **g** (Graviton), size **xlarge**.'},
{t:[['Family','Purpose','Examples'],
['M, T','General purpose; T is burstable','m7i, t3'],
['C','Compute optimized','c7g'],
['R, X, z','Memory optimized','r7i, x2'],
['I, D, H','Storage optimized','i4i, d3'],
['P, G, Trn, Inf','Accelerated (GPU, ML chips)','p5, g6, trn1'],
['Hpc','High performance computing','hpc7g']]},
{t:[['Suffix','Meaning'],
['g','AWS Graviton (Arm) processor'],
['a','AMD processor'],
['i','Intel processor'],
['d','Local NVMe instance store'],
['n','Enhanced networking'],
['e','Extra memory or storage']]},
{h:'Graviton'},
{p:'Graviton instances use Arm processors and often give better price-performance. Software must be built for **arm64**, so choose an arm64 AMI and check application support.'},
{code:`aws ec2 describe-instance-types --instance-types m7g.xlarge \\
  --query "InstanceTypes[].[InstanceType,VCpuInfo.DefaultVCpus,MemoryInfo.SizeInMiB,ProcessorInfo.SupportedArchitectures]"`}],
src:[['Instance types',K.EC2+'instance-types.html'],['AWS Graviton','https://aws.amazon.com/ec2/graviton/']]};

/* ---------- 1 ---------- */
L['aws:4:1']={blocks:[
{p:'You can launch instances from the console, CLI or API. A **launch template** stores the settings so every launch is consistent, versioned and reusable by Auto Scaling.'},
{h:'What a launch needs'},
{ul:['AMI and instance type.','Subnet (which sets the AZ) and security group.','Key pair (optional if you use Session Manager).','IAM instance profile, storage, tags and user data.']},
{h:'Launch from the CLI'},
{code:`aws ec2 run-instances --image-id ami-0abcdef1234567890 --instance-type t3.micro \\
  --subnet-id subnet-0abc --security-group-ids sg-0abc \\
  --iam-instance-profile Name=ops-ssm-profile \\
  --metadata-options HttpTokens=required \\
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=web-01}]'`},
{h:'Launch templates'},
{code:`aws ec2 create-launch-template --launch-template-name web \\
  --launch-template-data '{"ImageId":"ami-0abc","InstanceType":"t3.micro","MetadataOptions":{"HttpTokens":"required"}}'
aws ec2 create-launch-template-version --launch-template-name web \\
  --source-version 1 --launch-template-data '{"InstanceType":"t3.small"}'
aws ec2 run-instances --launch-template LaunchTemplateName=web,Version='$Latest'`},
{note:'Launch templates are versioned. Auto Scaling groups reference a specific version or $Latest or $Default, so choose deliberately.'}],
src:[['Launch an instance',K.EC2+'LaunchingAndUsingInstances.html'],['Launch templates',K.EC2+'ec2-launch-templates.html']]};

/* ---------- 2 ---------- */
L['aws:4:2']={blocks:[
{p:'An **Amazon Machine Image (AMI)** packages the root volume snapshot, launch permissions and block device mappings needed to start an instance.'},
{h:'Sources of AMIs'},
{t:[['Source','Notes'],
['AWS provided','Amazon Linux, Windows Server, kept patched by AWS'],
['AWS Marketplace','Vendor images with software license terms'],
['Community','Public images, verify before use'],
['Your own','Golden images you build and control']]},
{h:'Create, copy, share'},
{code:`aws ec2 create-image --instance-id i-0abc --name web-golden-2026-10 --no-reboot
aws ec2 copy-image --source-image-id ami-0abc --source-region eu-west-1 \\
  --region eu-central-1 --name web-golden-2026-10 --encrypted
aws ec2 modify-image-attribute --image-id ami-0abc \\
  --launch-permission "Add=[{UserId=222233334444}]"`},
{ul:['An AMI is **Regional**. Copy it to use it in another Region.','Sharing an AMI with an account also needs access to its **snapshots** and, if encrypted, the **KMS key**.','**Deprecate** old AMIs and use **Recycle Bin** or auto-cleanup to avoid snapshot sprawl.','Use SSM parameters such as the public Amazon Linux AMI parameters to always fetch the latest AMI ID.']},
{note:'`--no-reboot` avoids downtime but cannot guarantee file system consistency. For databases, stop the instance or quiesce first.'}],
src:[['AMIs',K.EC2+'AMIs.html'],['Copy an AMI',K.EC2+'CopyingAMIs.html']]};

/* ---------- 3 ---------- */
L['aws:4:3']={blocks:[
{p:'The **purchase option** decides how much you pay for the same instance. Commitment is traded for discount, and interruption risk for the lowest price.'},
{t:[['Option','Commitment','Discount','Best for','Risk'],
['On-Demand','None','Baseline','Spiky, short or unknown','Highest price'],
['Savings Plans','1 or 3 years of dollars per hour','Up to about 70%','Steady usage, flexible instance choice','Over-commitment'],
['Reserved Instances','1 or 3 years, instance attributes','Up to about 70%','Steady, known configuration','Less flexible'],
['Spot','None','Up to about 90%','Fault-tolerant, batch, stateless','Interruption with 2 minute notice'],
['Dedicated Hosts/Instances','Optional','Varies','Licensing, compliance','Cost']]},
{h:'Savings Plans types'},
{ul:['**Compute Savings Plans** apply across instance families, Regions, Fargate and Lambda.','**EC2 Instance Savings Plans** are tied to a family in a Region for a deeper discount.']},
{h:'Handling Spot interruptions'},
{ul:['Diversify across several instance types and AZs.','React to the interruption notice in instance metadata or EventBridge.','Use Auto Scaling mixed instances policies with a base of On-Demand.']},
{code:`aws ec2 describe-spot-price-history --instance-types m7g.large \\
  --product-descriptions "Linux/UNIX" --max-items 5`},
{note:'Cost Explorer shows commitment coverage and utilization. Buy commitments for the stable baseline and leave spikes On-Demand.'}],
src:[['Instance purchasing options',K.EC2+'instance-purchasing-options.html'],['Savings Plans','https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html']]};

/* ---------- 4 ---------- */
L['aws:4:4']={blocks:[
{p:'Prefer ways to reach an instance that need **no inbound ports and no long-lived keys**.'},
{t:[['Method','Needs','Notes'],
['Session Manager (SSM)','SSM Agent, instance profile with SSM permissions, outbound HTTPS or endpoints','No open port, IAM auth, session logging'],
['EC2 Instance Connect','Instance Connect support, port 22 reachable (or Endpoint)','Pushes a temporary SSH key'],
['EC2 Instance Connect Endpoint','An endpoint in the VPC','Reach private instances without a bastion or public IP'],
['SSH with key pair','Key file, port 22 open','Traditional. Manage keys carefully'],
['RDP (Windows)','Password from key pair, port 3389','Use Fleet Manager or SSM port forwarding']]},
{h:'Key pairs'},
{ul:['AWS stores only the **public** key. The private key file cannot be recovered if lost.','Key pairs are Regional.','The key pair is set at launch and is the default login credential for the AMI user (ec2-user, ubuntu).']},
{code:`aws ssm start-session --target i-0abc123
aws ec2-instance-connect send-ssh-public-key --instance-id i-0abc123 \\
  --instance-os-user ec2-user --ssh-public-key file://~/.ssh/id_ed25519.pub
ssh -i key.pem ec2-user@<ip>`},
{note:'If Session Manager does not connect, check three things: the SSM Agent is running, the instance role allows Systems Manager, and the instance can reach the SSM endpoints.'}],
src:[['Connect to your instance',K.EC2+'connect.html'],['Session Manager',K.SSM+'session-manager.html']]};

/* ---------- 5 ---------- */
L['aws:4:5']={blocks:[
{p:'The **instance metadata service (IMDS)** lets software on an instance read data about itself at `169.254.169.254`, including **temporary role credentials**. **IMDSv2** protects it with session tokens.'},
{h:'IMDSv1 versus IMDSv2'},
{t:[['','IMDSv1','IMDSv2'],
['Request','Simple GET','PUT to get a token, then GET with the token header'],
['SSRF risk','High: a forwarded request can steal credentials','Much lower: a token is required and hop limit is 1'],
['Recommendation','Disable','Require']]},
{code:`TOKEN=$(curl -s -X PUT http://169.254.169.254/latest/api/token \\
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \\
  http://169.254.169.254/latest/meta-data/iam/security-credentials/

aws ec2 modify-instance-metadata-options --instance-id i-0abc \\
  --http-tokens required --http-put-response-hop-limit 1`},
{h:'Instance profiles'},
{ul:['An **instance profile** contains one role and is attached to an instance.','Credentials rotate automatically and are served through IMDS.','Prefer one role per workload with only the permissions it needs.']},
{note:'Containers on an instance with hop limit 1 cannot reach IMDS. Raise the limit to 2 only where needed, or use task roles on ECS and EKS.'}],
src:[['Instance metadata',K.EC2+'ec2-instance-metadata.html'],['IMDSv2',K.EC2+'configuring-instance-metadata-service.html']]};

/* ---------- 6 ---------- */
L['aws:4:6']={blocks:[
{p:'**Placement** decides which hardware your instances run on. A **placement group** shapes this for latency, fault isolation or both.'},
{svg:place},
{t:[['Strategy','Goal','Limits'],
['Cluster','Low latency and high throughput between instances','One AZ. Capacity can be harder to get'],
['Spread','Each instance on distinct hardware','Up to 7 running instances per AZ per group'],
['Partition','Isolate groups of instances on separate racks','Up to 7 partitions per AZ']]},
{h:'Operational tips'},
{ul:['Launch all instances of a cluster group in **one request** and use the same instance type to improve capacity success.','If a launch fails with insufficient capacity, try another type or AZ, or stop and start to move the instance.','Choosing the **subnet** chooses the AZ. Spread across AZs for availability.']},
{code:`aws ec2 create-placement-group --group-name hpc --strategy cluster
aws ec2 run-instances --placement GroupName=hpc --image-id ami-0abc --instance-type c7g.large --count 4`}],
src:[['Placement groups',K.EC2+'placement-groups.html']]};

/* ---------- 7 ---------- */
L['aws:4:7']={blocks:[
{p:'Know what each lifecycle action does to **data, IP addresses and billing**.'},
{svg:states},
{t:[['Action','Effect','Billing'],
['Stop','Shuts down. EBS volumes persist. Instance store data is lost. Public IPv4 changes unless Elastic IP','No compute charge; EBS and Elastic IP still charged'],
['Start','Runs on possibly different hardware','Compute charged again'],
['Reboot','Same host, same IPs, data kept','Continuous'],
['Hibernate','Saves RAM to the encrypted root volume','Like stop; needs supported type and size'],
['Terminate','Instance deleted. Root volume deleted by default','Charges end'],
['Resize','Stop, change instance type, start','Per new type']]},
{h:'Protection and recovery'},
{ul:['**Termination protection** blocks accidental termination through the API and console.','**Stop protection** does the same for stop.','**Auto recovery** restarts an instance on new hardware after a system status check failure, keeping IDs and addresses.','Set `DeleteOnTermination` for extra volumes according to need.']},
{code:`aws ec2 modify-instance-attribute --instance-id i-0abc --disable-api-termination
aws ec2 stop-instances --instance-ids i-0abc
aws ec2 modify-instance-attribute --instance-id i-0abc --instance-type "{\\"Value\\": \\"m7g.large\\"}"
aws ec2 start-instances --instance-ids i-0abc`}],
src:[['Instance lifecycle',K.EC2+'ec2-instance-lifecycle.html']]};

/* ---------- 8 ---------- */
L['aws:4:8']={blocks:[
{p:'Instance performance problems usually come from **CPU**, **memory**, **disk** or **network**. EC2 reports CPU, disk and network by default. **Memory and disk space need the CloudWatch agent.**'},
{h:'Metrics to know'},
{t:[['Metric','Meaning'],
['CPUUtilization','Percent of allocated compute used'],
['CPUCreditBalance (T family)','Credits left. At zero the instance is throttled to baseline'],
['NetworkIn / NetworkOut','Bytes transferred'],
['StatusCheckFailed_System','Underlying host problem'],
['StatusCheckFailed_Instance','Guest OS or configuration problem'],
['EBSReadOps / EBSWriteOps','Volume operations (see EBS lesson)']]},
{h:'Burstable instances'},
{ul:['T instances earn credits when below baseline and spend them above it.','**Standard** mode throttles at zero credits. **Unlimited** mode keeps bursting and charges for surplus credits.']},
{h:'Rightsizing'},
{p:'**AWS Compute Optimizer** analyses utilization and reports instances as **over-provisioned**, **under-provisioned** or **optimized**, with recommended types and estimated savings. It needs about 30 hours of metrics and gets better with agent memory metrics.'},
{code:`aws compute-optimizer get-ec2-instance-recommendations \\
  --query "instanceRecommendations[].[instanceArn,finding,recommendationOptions[0].instanceType]" --output table
aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUCreditBalance \\
  --dimensions Name=InstanceId,Value=i-0abc --statistics Minimum --period 300 \\
  --start-time 2026-10-14T00:00:00Z --end-time 2026-10-15T00:00:00Z`},
{note:'Tag instances so Compute Optimizer and Cost Explorer results can be grouped by owner and application.'}],
src:[['Monitoring EC2',K.EC2+'monitoring_ec2.html'],['Compute Optimizer','https://docs.aws.amazon.com/compute-optimizer/latest/ug/what-is-compute-optimizer.html']]};

/* ---------- 9 ---------- */
L['aws:4:9']={blocks:[
{p:'**Practical:** launch an instance securely, connect without SSH, resize it and build an image.'},
{flow:['Create an IAM role with AmazonSSMManagedInstanceCore and an instance profile','Launch a t3.micro with IMDSv2 required, the profile, a security group with no inbound rules and tags','Connect with Session Manager and confirm the identity with the metadata service','Stop the instance, change it to t3.small, start it and observe the new public IP','Create an AMI, launch a second instance from it and confirm it matches','Enable termination protection, try to terminate it, then clean up everything']},
{code:`aws iam create-role --role-name lab-ssm --assume-role-policy-document file://trust.json
aws iam attach-role-policy --role-name lab-ssm \\
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam create-instance-profile --instance-profile-name lab-ssm
aws iam add-role-to-instance-profile --instance-profile-name lab-ssm --role-name lab-ssm`},
{note:'The security group has no inbound rules. Session Manager works over an outbound connection, so the instance is reachable for administration but not from the internet.'}],
src:[['Session Manager prerequisites',K.SSM+'session-manager-prerequisites.html']]};
})();
