/* LearnSphere - AWS Administrator, Section 01: Introduction & AWS Foundations.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const roadmap=K.dg(700,200,[
[10,10,680,180,'The learning path',1],
[25,60,100,60,'Foundations|and tools',0],[145,60,100,60,'Identity and|governance',0],[265,60,100,60,'Compute and|storage',0],[385,60,100,60,'Networking|and delivery',0],[505,60,80,60,'Operate and|automate',0],[600,60,80,60,'Secure,|recover,|troubleshoot',2]],
[[125,90,145,90],[245,90,265,90],[365,90,385,90],[485,90,505,90],[585,90,600,90]]);

const shared=K.dg(700,250,[
[10,10,680,230,'Shared responsibility',1],
[40,45,620,50,'Customer: your data, identities, configuration, OS and applications  (security IN the cloud)',2],
[40,110,620,50,'AWS: hardware, facilities, network, hypervisor and managed service software  (security OF the cloud)',0],
[40,175,620,45,'Regions, Availability Zones and edge locations',0]],
[]);

const geo=K.dg(700,260,[
[10,10,680,240,'Region: a geographic area, isolated from other Regions',1],
[30,50,190,175,'Availability Zone A',1],[255,50,190,175,'Availability Zone B',1],[480,50,190,175,'Availability Zone C',1],
[50,90,150,40,'One or more|data centers',0],[275,90,150,40,'One or more|data centers',0],[500,90,150,40,'One or more|data centers',0],
[50,150,150,45,'Low-latency|links',2],[275,150,150,45,'Low-latency|links',2],[500,150,150,45,'Low-latency|links',2]],
[]);

const org=K.dg(700,310,[
[10,10,680,290,'Where policy, access and billing attach',1],
[230,40,240,40,'Organization root and management account',2],
[230,95,240,40,'Organizational units (OUs)',0],
[230,150,240,40,'Member accounts',0],
[230,205,240,40,'IAM roles, users and policies',0],
[230,255,240,35,'Resources in Regions',0]],
[[350,80,350,95],[350,135,350,150],[350,190,350,205],[350,245,350,255]]);

const req=K.dg(700,200,[
[10,10,680,180,'Every tool sends the same signed API request',1],
[25,40,100,40,'Console',0],[25,90,100,40,'CLI',0],[25,140,100,35,'SDK',0],
[190,70,140,70,'Regional|service endpoint',2],
[395,50,130,45,'Authenticate',0],[395,110,130,45,'Authorize (IAM)',0],
[580,70,100,70,'Service|does the work',0]],
[[125,60,190,90],[125,110,190,105],[125,157,190,120],[330,105,395,72],[330,105,395,132],[525,105,580,105]]);

const pillars=K.dg(700,200,[
[10,10,680,180,'Six pillars of the Well-Architected Framework',1],
[25,60,100,70,'Operational|excellence',0],[140,60,100,70,'Security',0],[255,60,100,70,'Reliability',0],[370,60,100,70,'Performance|efficiency',0],[485,60,100,70,'Cost|optimization',0],[600,60,80,70,'Sustain-|ability',0]],
[]);

/* ---------- 0 ---------- */
L['aws:0:0']={blocks:[
{p:'This course takes you from **no AWS experience beyond the basics** to operating identity, governance, compute, storage, networking, monitoring, automation, security and recovery the way a production AWS administrator does. It follows the skills of the **AWS Certified CloudOps Engineer Associate (SOA-C03)** exam and goes further wherever real operations need more.'},
{svg:roadmap},
{h:'Who this course is for'},
{ul:['System, network and database administrators moving from on-premises work to AWS.','Developers and DevOps engineers who now operate AWS accounts.','Anyone preparing for **SOA-C03** (the successor to the SysOps Administrator exam).']},
{h:'What you will be able to do'},
{ul:['Control access with IAM, roles, Organizations, service control policies and Identity Center.','Run EC2, EBS, EFS and S3 securely and cost-effectively.','Design, connect and troubleshoot VPCs, DNS, CloudFront and load balancers.','Monitor with CloudWatch, CloudTrail and EventBridge, and automate with Systems Manager and CloudFormation.','Back up, recover, harden and troubleshoot a production environment.']},
{h:'Sections and exam domains'},
{t:[['Sections','Theme','SOA-C03 domain'],
['1 to 4','Foundations, tools, IAM, governance and cost','Security and Compliance (16%)'],
['5 to 7','EC2, EBS, EFS, FSx, S3','Reliability and Performance'],
['8 to 11','VPC, connectivity, DNS, CloudFront, load balancing','Networking and Content Delivery (18%)'],
['12 to 13','Databases, containers, serverless','Reliability and Performance'],
['14 to 15','CloudWatch, CloudTrail, EventBridge, Systems Manager','Monitoring, Logging, Analysis, Remediation (22%)'],
['16','CloudFormation and deployment','Deployment, Provisioning and Automation (22%)'],
['17','Backup and disaster recovery','Reliability and Business Continuity (22%)'],
['18 to 20','Security, troubleshooting, production readiness','Security and across domains']]},
{h:'How lectures are tagged'},
{p:'Every lecture description ends with **Cloud**, **Hybrid** or **Both**. Cloud lectures need only an AWS account. Hybrid lectures involve an on-premises or non-AWS side, which you can follow conceptually.'},
{h:'Prerequisites self-check'},
{t:[['Skill','Quick test'],
['Networking','You can explain an IP address, subnet mask, DNS record and port'],
['Operating systems','You can use a Linux shell or Windows PowerShell'],
['Virtualization','You know what a virtual machine and a disk are'],
['Identity','You know the difference between a user, a group and a permission']]},
{note:'Labs create billable resources. Section 2 sets a budget and a cleanup routine before anything else is built. Do not skip it.'}],
src:[['SOA-C03 exam guide','https://aws.amazon.com/certification/certified-cloudops-engineer-associate/'],['AWS documentation',K.D]]};

/* ---------- 1 ---------- */
L['aws:0:1']={blocks:[
{p:'**Cloud computing** is on-demand access to IT resources over the internet with pay-as-you-go pricing. AWS offers building blocks at several levels, and the level you choose decides how much you manage.'},
{h:'Service models'},
{t:[['Model','You manage','AWS manages','AWS example'],
['IaaS','OS, runtime, apps, data','Hardware, virtualization, network','EC2, EBS, VPC'],
['PaaS','Applications and data','OS, runtime, scaling, patching','Elastic Beanstalk, RDS, Lambda'],
['SaaS','Your use of the product','Everything else','WorkMail, Chime, Amazon Q']]},
{h:'Shared responsibility'},
{p:'AWS is responsible for **security of the cloud**: facilities, hardware, global network and the software of managed services. You are responsible for **security in the cloud**: data, identities, configuration and, for EC2, the guest operating system.'},
{svg:shared},
{note:'The more managed the service, the less you configure. With S3 you still own bucket policy and encryption choices. With RDS you own database users and parameters. With EC2 you also own patching.'},
{h:'Deployment models'},
{ul:['**Cloud**: everything runs on AWS.','**Hybrid**: on-premises systems connected to AWS (VPN, Direct Connect, Storage Gateway).','**On premises**: your own data center, including AWS Outposts which runs AWS hardware in your site.']},
{h:'Service categories you will operate'},
{t:[['Category','Examples'],
['Compute','EC2, Lambda, ECS, EKS, Fargate'],
['Storage','S3, EBS, EFS, FSx, Glacier'],
['Database','RDS, Aurora, DynamoDB, ElastiCache'],
['Networking','VPC, Route 53, CloudFront, ELB, Direct Connect'],
['Management','CloudWatch, CloudTrail, Config, Systems Manager, CloudFormation'],
['Security','IAM, KMS, GuardDuty, Security Hub, WAF']]}],
src:[['Shared responsibility model','https://aws.amazon.com/compliance/shared-responsibility-model/'],['What is cloud computing','https://aws.amazon.com/what-is-cloud-computing/']]};

/* ---------- 2 ---------- */
L['aws:0:2']={blocks:[
{p:'AWS is organized as **Regions**, each made of several **Availability Zones** (AZs), plus a wider network of edge locations. Understanding this layout is the basis for resilience, latency and compliance decisions.'},
{svg:geo},
{h:'The building blocks'},
{t:[['Term','Meaning','Why it matters'],
['Region','A geographic area such as us-east-1 or eu-west-1, independent of other Regions','Data stays in the Region unless you move it'],
['Availability Zone','One or more data centers with separate power, cooling and networking, connected by low-latency links','Spreading across AZs survives a data center failure'],
['Local Zone','An extension of a Region closer to a city','Single-digit millisecond latency for local users'],
['Edge location','A point of presence used by CloudFront, Route 53 and Global Accelerator','Content and DNS near users'],
['Wavelength Zone','Compute embedded in telecom 5G networks','Ultra-low latency mobile apps']]},
{h:'Choosing a Region'},
{ul:['**Compliance and data residency**: where the law lets the data live.','**Latency**: close to users or dependent systems.','**Service availability**: new services and features reach some Regions first.','**Price**: the same service costs different amounts in different Regions.']},
{note:'Most services are Regional: a resource lives in one Region. IAM, Route 53, CloudFront and Organizations are global. Always check the Region selector before creating or searching for resources.'},
{h:'AZ names are not the same across accounts'},
{p:'The AZ name `us-east-1a` in your account may map to a different physical zone than `us-east-1a` in another account. Use the **AZ ID** such as `use1-az1` when you must coordinate zones between accounts.'},
{code:`aws ec2 describe-regions --query "Regions[].RegionName" --output text
aws ec2 describe-availability-zones --region eu-west-1 \\
  --query "AvailabilityZones[].[ZoneName,ZoneId]" --output table`}],
src:[['AWS global infrastructure','https://aws.amazon.com/about-aws/global-infrastructure/'],['Regions and Zones',K.EC2+'using-regions-availability-zones.html']]};

/* ---------- 3 ---------- */
L['aws:0:3']={blocks:[
{p:'An **AWS account** is the basic container for resources, identities and billing. It is also a strong **isolation boundary**: permissions and limits do not cross accounts unless you allow it. **AWS Organizations** groups many accounts under one management point.'},
{svg:org},
{h:'Terms'},
{t:[['Term','Meaning'],
['Account','Resources, identities and a bill. Identified by a 12-digit account ID.'],
['Root user','The account owner identity created with the account. Use it only for a few tasks.'],
['Organization','A set of accounts managed together.'],
['Management account','The account that creates the organization and pays the consolidated bill.'],
['Member account','Any other account in the organization.'],
['Organizational unit (OU)','A group of accounts that policies can target.']]},
{h:'What attaches where'},
{ul:['**Billing**: consolidated into the management account, with volume discounts shared.','**Service control policies**: set the maximum permissions for accounts and OUs.','**IAM policies**: grant permissions to identities and resources inside one account.','**Tags and tag policies**: describe and standardize resources.']},
{note:'Keep workloads out of the management account. Use it for organization-level administration only.'},
{code:`aws organizations describe-organization
aws organizations list-accounts --query "Accounts[].[Id,Name,Status]" --output table`}],
src:[['What is AWS Organizations',K.ORG+'orgs_introduction.html'],['AWS account management','https://docs.aws.amazon.com/accounts/latest/reference/accounts-welcome.html']]};

/* ---------- 4 ---------- */
L['aws:0:4']={blocks:[
{p:'Every console click, CLI command and SDK call becomes an **HTTPS API request** to a **Regional service endpoint**. The request is **signed** with credentials (Signature Version 4), authenticated, then authorized against policies before the service acts.'},
{svg:req},
{h:'The steps'},
{flow:['The client builds an API request and signs it with credentials','It is sent to the endpoint for the service and Region, for example ec2.eu-west-1.amazonaws.com','AWS authenticates the caller from the signature','IAM evaluates every applicable policy for this action on this resource','The service performs the action and CloudTrail records the call']},
{h:'Endpoints and Regions'},
{ul:['Each service has an endpoint per Region: `service.region.amazonaws.com`.','Choosing a Region in the console or `--region` in the CLI chooses the endpoint.','A few services are **global** and use one endpoint, for example IAM and Organizations.','**VPC endpoints** let you reach AWS APIs privately from a VPC.']},
{h:'Authentication versus authorization'},
{t:[['Question','Mechanism'],
['Who is calling?','Authentication: password, access key signature, temporary credentials'],
['Are they allowed to do this?','Authorization: IAM policies, SCPs, resource policies, boundaries']]},
{note:'Default deny: if no policy explicitly allows an action it is refused. An explicit deny always wins.'},
{code:`aws sts get-caller-identity
aws ec2 describe-instances --region eu-west-1 --debug 2>&1 | grep -i "Host:"`}],
src:[['Signing AWS API requests',K.IAM+'reference_sigv.html'],['Service endpoints','https://docs.aws.amazon.com/general/latest/gr/rande.html']]};

/* ---------- 5 ---------- */
L['aws:0:5']={blocks:[
{p:'A **CloudOps engineer** (the former SysOps administrator) keeps AWS workloads running, secure, cost-effective and recoverable. The focus is operating and automating, not designing from scratch and not writing application code.'},
{h:'What the role owns'},
{ul:['Provision and configure resources, preferably with code.','Monitor, alarm and respond to incidents.','Patch, back up, restore and rehearse recovery.','Control access and keep configuration compliant.','Watch cost and rightsize.','Troubleshoot across network, compute, storage and permissions.']},
{h:'Related roles'},
{t:[['Role','Primary focus','Overlap with CloudOps'],
['Solutions architect','Design and trade-offs','Reviews operational feasibility'],
['Developer','Application code, APIs, CI/CD','Deploy and runtime configuration'],
['DevOps engineer','Pipelines and release automation','Automation and observability'],
['Security engineer','Detection, response, compliance','IAM, encryption, logging'],
['Network engineer','Connectivity and routing','VPC, DNS, hybrid links']]},
{h:'The toolkit'},
{t:[['Task','Tools'],
['Interact','Console, CLI, CloudShell, SDKs'],
['Observe','CloudWatch, CloudTrail, Config, X-Ray'],
['Automate','Systems Manager, CloudFormation, EventBridge, Lambda'],
['Govern','Organizations, SCPs, Control Tower, Trusted Advisor'],
['Protect','IAM, KMS, GuardDuty, Security Hub, Backup']]}],
src:[['SOA-C03 exam guide','https://aws.amazon.com/certification/certified-cloudops-engineer-associate/']]};

/* ---------- 6 ---------- */
L['aws:0:6']={blocks:[
{p:'The **AWS Well-Architected Framework** describes good practice as six pillars. For an administrator it works as a review checklist: for any workload, ask what each pillar says and where the gaps are.'},
{svg:pillars},
{h:'The pillars as questions'},
{t:[['Pillar','Question to ask','Typical AWS tools'],
['Operational excellence','Can we deploy, observe and improve safely?','CloudFormation, CloudWatch, Systems Manager'],
['Security','Who can do what, and is data protected?','IAM, KMS, GuardDuty, CloudTrail'],
['Reliability','Does it recover from failure and scale to demand?','Multi-AZ, Auto Scaling, Backup'],
['Performance efficiency','Is the right resource type and size used?','Compute Optimizer, CloudFront, caching'],
['Cost optimization','Do we pay only for what we need?','Cost Explorer, Budgets, Savings Plans'],
['Sustainability','Are we minimizing environmental impact?','Rightsizing, Graviton, storage tiers']]},
{h:'Using it in practice'},
{ul:['Run the **Well-Architected Tool** in the console to record answers and improvement items.','Use **lenses** for specific domains such as serverless or SaaS.','Review before launch and again after major change.']},
{note:'The pillars trade off against each other. More redundancy costs more. Decide per workload, and write the decision down.'}],
src:[['Well-Architected Framework',K.WA+'welcome.html'],['AWS Well-Architected Tool','https://aws.amazon.com/well-architected-tool/']]};

/* ---------- 7 ---------- */
L['aws:0:7']={blocks:[
{p:'AWS pricing is **pay for what you use**, with no minimum for most services. Understanding the main cost dimensions prevents surprises and drives design decisions.'},
{h:'What you are charged for'},
{t:[['Dimension','Examples'],
['Compute time','EC2 per second (Linux), Lambda per millisecond and memory'],
['Storage','GB per month for S3, EBS, snapshots'],
['Requests','S3 GET/PUT, API Gateway, Lambda invocations'],
['Data transfer','Out to the internet, between Regions, sometimes between AZs'],
['Provisioned capacity','RDS instance, NAT gateway hours, provisioned IOPS'],
['Public IPv4 addresses','Charged per hour whether attached or idle in use']]},
{note:'Data transfer **into** AWS is generally free. Data going **out** to the internet and across Regions is charged. Cross-AZ traffic is charged in both directions for most services.'},
{h:'Free Tier and credits'},
{ul:['New accounts get a **free plan** with a credit allowance for a limited time, then must move to a paid plan to continue. Check the current terms when you sign up.','Some services have always-free allowances (for example a monthly quota of Lambda requests and DynamoDB storage).','Free Tier covers only specific usage. Larger instances, NAT gateways and other services are billed.']},
{h:'Support plans'},
{t:[['Plan level','Suited for'],
['Basic','Included. Account and billing support, documentation, Health Dashboard, limited Trusted Advisor checks'],
['Developer','Experimentation. Business-hours email to technical support'],
['Business','Production workloads. 24/7 support, full Trusted Advisor checks'],
['Enterprise','Mission-critical. Technical account manager and fastest response']]},
{p:'Plan names and features are updated over time, so confirm the current list on the AWS support pricing page.'},
{h:'Set up cost visibility first'},
{code:`# create a monthly budget alert before building anything
aws budgets create-budget --account-id <id> --budget file://budget.json \\
  --notifications-with-subscribers file://notifications.json`}],
src:[['AWS pricing','https://aws.amazon.com/pricing/'],['AWS Free Tier','https://aws.amazon.com/free/'],['Compare Support plans','https://aws.amazon.com/premiumsupport/plans/']]};
})();
