/* LearnSphere - Azure Administrator, Section 01: Introduction & Azure Foundations.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const roadmap=K.dg(700,200,[
[10,10,680,180,'The learning path',1],
[25,60,100,60,'Foundations|and tools',0],[145,60,100,60,'Identity,|RBAC and|governance',0],[265,60,100,60,'Automation|and storage',0],[385,60,100,60,'Compute and|containers',0],[505,60,80,60,'Networking',0],[600,60,80,60,'Monitor,|protect,|secure',2]],
[[125,90,145,90],[245,90,265,90],[365,90,385,90],[485,90,505,90],[585,90,600,90]]);

const models=K.dg(700,260,[
[10,10,680,240,'Who manages what',1],
[30,45,150,50,'Applications and data',0],[30,100,150,40,'Runtime and OS',0],[30,145,150,40,'Virtual machines',0],[30,190,150,40,'Network and datacenter',0],
[230,45,120,185,'On premises|you manage all',0],[380,45,120,185,'IaaS|you manage OS|and up',2],[530,45,120,185,'PaaS and SaaS|provider manages|more',0]],
[]);

const regions=K.dg(700,240,[
[10,10,680,220,'Geography: a data residency boundary',1],
[30,50,200,160,'Region A|paired with Region B',0],[250,50,200,160,'Region B|paired with Region A',0],[470,50,200,160,'Region C|another pair',0],
[45,95,170,40,'Availability zone 1',2],[45,145,170,40,'Availability zone 2, 3',0]],
[[230,130,250,130]]);

const hier=K.dg(700,330,[
[10,10,680,310,'Where policy, access and billing attach',1],
[230,40,240,40,'Tenant root management group',2],
[230,95,240,40,'Management groups',0],
[230,150,240,40,'Subscriptions',0],
[230,205,240,40,'Resource groups',0],
[230,260,240,40,'Resources',0]],
[[350,80,350,95],[350,135,350,150],[350,190,350,205],[350,245,350,260]]);

const arm=K.dg(700,220,[
[10,10,680,200,'Every tool talks to the same front door',1],
[25,40,110,40,'Portal',0],[25,90,110,40,'CLI',0],[25,140,110,40,'PowerShell',0],
[200,70,130,80,'Azure Resource|Manager',2],
[390,50,120,50,'Authenticate and|authorize',0],[390,120,120,50,'Policy and locks',0],
[560,70,110,80,'Resource|provider',0]],
[[135,60,200,95],[135,110,200,110],[135,160,200,125],[330,110,390,75],[330,110,390,145],[510,110,560,110]]);

/* ---------- 0: Course overview ---------- */
L['az:0:0']={blocks:[
{p:'This course takes you from **no Azure experience beyond the basics** to managing identities, governance, storage, compute, networking, monitoring and recovery the way a production Azure administrator does. It follows the skills measured by the **AZ-104** exam and goes further wherever real operations need more.'},
{svg:roadmap},
{h:'Who this course is for'},
{ul:['IT administrators moving from on-premises Windows, Linux or networking work to Azure.','Developers and operations engineers who now own Azure subscriptions.','Anyone preparing for **AZ-104: Microsoft Azure Administrator**.']},
{h:'What you will be able to do'},
{ul:['Create and organize users, groups and access with Microsoft Entra ID and Azure RBAC.','Apply governance with management groups, policy, tags, locks and cost controls.','Deploy repeatably with ARM templates and Bicep.','Run storage, virtual machines, containers and web apps securely.','Build and troubleshoot virtual networks, DNS and load balancing.','Monitor, alert, back up, recover and harden a subscription.']},
{h:'The sections at a glance'},
{t:[['Sections','Theme','AZ-104 domain'],
['1 to 2','Foundations, portal, CLI and PowerShell','Supports every domain'],
['3 to 5','Entra ID, RBAC, governance, cost, ARM and Bicep','Manage identities and governance (20-25%)'],
['6 to 8','Storage accounts, blobs and files','Implement and manage storage (15-20%)'],
['9 to 10','Virtual machines, containers, App Service','Deploy and manage compute (20-25%)'],
['11 to 12','Virtual networking, security, DNS, load balancing','Implement and manage virtual networking (15-20%)'],
['13 to 14','Monitoring, backup and recovery','Monitor and maintain (10-15%)'],
['15 to 17','Security, hybrid, operations, production capstone','Beyond the exam for production']]},
{h:'How lectures are tagged'},
{p:'Every lecture description ends with a tag. Most Azure lectures are **Cloud**, meaning they need an Azure subscription. Lectures are written so you can follow the concept even without running the lab.'},
{h:'Prerequisites self-check'},
{t:[['Skill','Quick test'],
['Networking basics','You can explain an IP address, a subnet mask, DNS and a port'],
['An operating system','You can use a Windows or Linux command line'],
['Virtualization','You know what a virtual machine and a disk are'],
['Identity','You know the difference between a user, a group and a permission']]},
{note:'Labs create billable resources. Section 2 sets a budget and a cleanup routine before anything else is built. Do not skip it.'}],
src:[['AZ-104 study guide','https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-104'],['Azure documentation',K.D]]};

/* ---------- 1: What Azure is ---------- */
L['az:0:1']={blocks:[
{p:'**Cloud computing** is renting computing resources over the internet and paying for what you use. Instead of buying servers, you create resources in Microsoft datacenters in minutes and remove them when you no longer need them.'},
{h:'Service models'},
{t:[['Model','You manage','Microsoft manages','Azure example'],
['**IaaS**','OS, patches, runtime, apps, data','Hardware, network, virtualization','Virtual Machines'],
['**PaaS**','Application and data','OS, runtime, platform patching, scaling','App Service, Azure SQL Database'],
['**SaaS**','Your data, users and settings','Everything else','Microsoft 365, Dynamics 365']]},
{svg:models},
{h:'Deployment models'},
{ul:['**Public cloud**: resources run in the provider datacenters and are shared tenants.','**Private cloud**: infrastructure used by one organization, on premises or hosted.','**Hybrid cloud**: on premises plus public cloud, connected. Azure Arc and ExpressRoute support this.','**Multi-cloud**: more than one public cloud provider.']},
{h:'Shared responsibility'},
{p:'Microsoft always secures the physical datacenter, hardware and host. **You are always responsible** for your data, your identities and your access, in every model. The more managed the service, the less you operate, but the responsibility for data and identity never moves.'},
{h:'Main service categories'},
{t:[['Category','Examples'],
['Compute','Virtual Machines, scale sets, App Service, Container Apps, AKS'],
['Storage','Blob, Files, Disks, Queues, Tables'],
['Networking','Virtual Network, Load Balancer, DNS, Application Gateway, VPN Gateway'],
['Databases','Azure SQL, Cosmos DB, PostgreSQL, MySQL'],
['Identity and security','Microsoft Entra ID, Key Vault, Defender for Cloud'],
['Management and monitoring','Azure Monitor, Policy, Backup, Cost Management']]},
{note:'A common exam trap: patching the guest operating system is your job on a VM (IaaS) and Microsoft job on App Service (PaaS).'}],
src:[['Shared responsibility in the cloud',K.D+'security/fundamentals/shared-responsibility'],['Cloud service models',K.D+'cloud-adoption-framework/']]};

/* ---------- 2: Global infrastructure ---------- */
L['az:0:2']={blocks:[
{p:'Azure is a global network of datacenters. Understanding its layout lets you choose where to run a workload and how to survive failures.'},
{svg:regions},
{h:'The building blocks'},
{t:[['Term','What it is','Why it matters'],
['**Geography**','A market area, often a country or group of countries, with a data residency boundary','Keeps data inside a compliance boundary'],
['**Region**','A set of datacenters connected by a low-latency network','The location you choose when you create most resources'],
['**Availability zone**','Physically separate datacenters inside a region, each with independent power, cooling and network','Protects against a datacenter failure'],
['**Region pair**','Two regions in the same geography, paired for recovery','Geo-redundant services and platform updates are sequenced'],
['**Edge location**','Points of presence for content delivery','Lowers latency for end users']]},
{h:'Choosing a region'},
{ul:['**Compliance and data residency**: where must the data legally stay?','**Latency**: pick a region close to users or dependent systems.','**Service and size availability**: not every service or VM size exists in every region.','**Price**: the same resource costs different amounts in different regions.','**Resilience**: does the region support availability zones, and which region is its pair?']},
{h:'Zonal, zone-redundant and regional'},
{t:[['Term','Meaning'],
['**Zonal**','You pin a resource to one specific zone'],
['**Zone-redundant**','Azure spreads and replicates it across zones for you'],
['**Regional / non-zonal**','Resource exists in a region with no zone guarantee']]},
{note:'Pairs are used for geo-replication such as GRS storage. A region without a documented pair, or with data residency rules, may need you to design recovery yourself.'}],
src:[['Azure regions and availability zones',K.D+'reliability/availability-zones-overview'],['Azure geographies','https://azure.microsoft.com/en-us/explore/global-infrastructure/geographies/']]};

/* ---------- 3: Hierarchy ---------- */
L['az:0:3']={blocks:[
{p:'Azure organizes everything in a **hierarchy**. The level at which you apply policy, access or billing decides how far it reaches, so knowing the levels is the basis for the rest of the course.'},
{svg:hier},
{t:[['Level','Purpose','What attaches here'],
['**Tenant**','One Microsoft Entra directory representing an organization','Identities, groups, tenant-wide settings'],
['**Management group**','Container for subscriptions, nestable up to six levels below the root','Policy and RBAC for many subscriptions'],
['**Subscription**','Billing boundary and a scale and limit boundary','Invoice, quotas, RBAC, policy'],
['**Resource group**','Logical container for resources that share a lifecycle','RBAC, locks, tags, policy'],
['**Resource**','A single instance of a service, such as a VM or storage account','Configuration, access, diagnostics']]},
{h:'Inheritance'},
{p:'RBAC assignments, Azure Policy assignments and locks flow **downward**. A role assigned at a management group applies to every subscription, resource group and resource under it. Nothing flows upward.'},
{h:'Rules to remember'},
{ul:['A resource lives in **exactly one** resource group, and can be moved to another.','A subscription trusts **one** Entra tenant at a time.','Deleting a resource group deletes everything inside it.','The resource group has its own location, which only stores metadata. Resources inside can be in other regions.']},
{code:`# See the hierarchy from the CLI
az account management-group list -o table
az account list -o table
az group list -o table`}],
src:[['Organize your resources',K.CAF+'ready/azure-best-practices/organize-subscriptions'],['Management groups',K.D+'governance/management-groups/overview']]};

/* ---------- 4: ARM ---------- */
L['az:0:4']={blocks:[
{p:'**Azure Resource Manager (ARM)** is the management layer of Azure. Every create, update or delete request, from any tool, goes through it. The portal, CLI, PowerShell, SDKs, REST calls and templates are all clients of the same API.'},
{svg:arm},
{h:'What happens to a request'},
{flow:['The client sends a request to the ARM endpoint with a bearer token','ARM authenticates the caller with Microsoft Entra ID','ARM authorizes it against RBAC at the scope of the request','Policy and locks are evaluated','ARM routes the request to the resource provider','The resource provider creates or changes the resource and reports the result']},
{h:'Resource providers and APIs'},
{p:'Each Azure service is implemented by a **resource provider**, for example `Microsoft.Compute` or `Microsoft.Storage`. A provider must be **registered** in a subscription before you can create its resource types. Each resource type has **API versions**, which is why a template pins one.'},
{code:`az provider list --query "[?registrationState=='Registered'].namespace" -o tsv
az provider register --namespace Microsoft.ContainerInstance
az provider show --namespace Microsoft.Compute --query "resourceTypes[?resourceType=='virtualMachines'].apiVersions[0]"`},
{h:'Why this matters to an administrator'},
{ul:['The same permission and policy rules apply no matter which tool you use.','A deployment through a template and a click in the portal are the same API calls.','A "provider not registered" error is fixed by registering the provider, not by changing permissions.','The **activity log** records ARM operations at the subscription level.']}],
src:[['Azure Resource Manager overview',K.ARM+'management/overview'],['Resource providers and types',K.ARM+'management/resource-providers-and-types']]};

/* ---------- 5: Administrator role ---------- */
L['az:0:5']={blocks:[
{p:'An **Azure administrator** implements, manages and monitors the cloud environment that others build on. The role sits between architects who design solutions and developers who build applications.'},
{h:'Responsibilities'},
{ul:['Identities and access: users, groups, roles and licenses.','Governance: structure, policy, tags, locks and cost.','Deploying and configuring compute, storage and networking.','Monitoring, alerting, backup and recovery.','Keeping the environment patched, secured and documented.']},
{h:'How related roles differ'},
{t:[['Role','Focus','Typical certification'],
['**Administrator**','Implement and operate the environment','AZ-104'],
['**Developer**','Build and deploy application code','AZ-204'],
['**Security engineer**','Protect identities, data and networks','AZ-500, SC-300'],
['**Solutions architect**','Design solutions and trade-offs','AZ-305'],
['**DevOps engineer**','Pipelines, automation, release','AZ-400']]},
{h:'Your toolkit'},
{t:[['Tool','Best for'],
['Azure portal','Exploring, one-off tasks, visual inspection'],
['Azure CLI','Scripts and quick commands on any platform'],
['Azure PowerShell','Windows administrators, pipeline and object-based automation'],
['Cloud Shell','A ready browser shell with tools already installed'],
['Bicep and ARM templates','Repeatable, reviewable deployments'],
['Azure Resource Graph','Querying resources across subscriptions']]},
{note:'A good habit: do a task once in the portal to understand it, then capture it in a script or template so it is repeatable.'}],
src:[['AZ-104 skills measured','https://learn.microsoft.com/en-us/credentials/certifications/azure-administrator/'],['Azure management tools',K.D+'azure-resource-manager/management/overview']]};

/* ---------- 6: Pricing, free account, SLAs, support ---------- */
L['az:0:6']={blocks:[
{p:'Cost and reliability are administrator concerns. You should know what drives a bill, what the free account gives you, how an SLA is read and which support plan fits a situation.'},
{h:'What drives cost'},
{ul:['**Resource type and size**: a VM size, a disk tier, a database tier.','**Usage**: hours running, GB stored, operations performed, data transferred out.','**Region**: prices differ by region.','**Commitments**: reservations and savings plans reduce price for steady use.','**Licensing**: Azure Hybrid Benefit lets you reuse eligible licenses.']},
{p:'Inbound data transfer is generally free. **Outbound** transfer to the internet and between some regions is billed. A VM that is **stopped but not deallocated** still bills for compute, while a **deallocated** VM does not (disks and IPs still bill).'},
{h:'Free account'},
{t:[['Part','What you get'],
['Credit','A time-limited credit for the first period of a new account'],
['Free services','A set of services free for 12 months'],
['Always-free','A set of services with free monthly amounts'],
['After credit','Resources can stop unless you upgrade to pay-as-you-go']]},
{h:'Service level agreements'},
{p:'An **SLA** states the monthly uptime Microsoft commits to for a service, for example 99.9% or 99.99%. Downtime beyond the commitment earns **service credits**. A solution built from several services has a **composite SLA** that is the product of each one.'},
{code:`Web app 99.95 percent  x  Database 99.99 percent
= 0.9995 x 0.9999 = 0.9994 (99.94 percent)`},
{p:'Using redundant copies (for example two instances across zones) raises the combined availability above that of a single instance.'},
{h:'Support plans'},
{t:[['Plan','For','Notes'],
['Basic','Everyone','Billing and subscription help, documentation, Service Health'],
['Developer','Non-production','Business-hours technical support'],
['Standard','Production workloads','24x7 support with faster response'],
['Professional Direct','Business-critical','Faster response and guidance from engineers']]},
{note:'Use the Pricing Calculator to estimate before deploying and the Total Cost of Ownership calculator to compare with on-premises. Cost Management (Section 5) shows what you actually spend.'}],
src:[['Pricing calculator','https://azure.microsoft.com/en-us/pricing/calculator/'],['Support plans','https://azure.microsoft.com/en-us/support/plans/'],['SLAs for Azure','https://azure.microsoft.com/en-us/support/legal/sla/']]};

})();
