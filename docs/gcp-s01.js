/* LearnSphere - Google Cloud, Section 01: Introduction & Google Cloud Foundations.
   Lectures 0-7 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const path=K.dg(700,200,[
[10,10,680,180,'The learning path',1],
[25,60,100,60,'Foundations|projects, IAM',0],[145,60,100,60,'Networking|VPC, balancing',0],[265,60,100,60,'Compute|VMs, GKE, Run',0],[385,60,100,60,'Data|storage, DBs',0],[505,60,80,60,'Operate|and secure',0],[605,60,70,60,'Design',2]],
[[125,90,145,90],[245,90,265,90],[365,90,385,90],[485,90,505,90],[585,90,605,90]]);

const models=K.dg(700,300,[
[10,10,680,280,'Who manages what',1],
[30,45,150,40,'On premises',0],[200,45,150,40,'IaaS|Compute Engine',0],[370,45,150,40,'PaaS / serverless|Cloud Run',0],[540,45,130,40,'SaaS|Workspace',0],
[30,100,150,36,'Applications and data',0],[200,100,150,36,'Applications and data',0],[370,100,150,36,'Your code and data',0],[540,100,130,36,'Your content',0],
[30,150,150,36,'Runtime and OS',0],[200,150,150,36,'Runtime and OS',0],[370,150,150,36,'Google',2],[540,150,130,36,'Google',2],
[30,200,150,36,'Virtualization, servers',0],[200,200,150,36,'Google',2],[370,200,150,36,'Google',2],[540,200,130,36,'Google',2],
[30,246,150,30,'Data center',0],[200,246,150,30,'Google',2],[370,246,150,30,'Google',2],[540,246,130,30,'Google',2]],
[]);

const geo=K.dg(700,260,[
[10,10,680,240,'Geography of Google Cloud',1],
[30,50,200,180,'Multi-region: us, eu, asia',1],
[250,50,430,180,'Region: us-central1',1],
[270,90,120,50,'Zone a|us-central1-a',0],[410,90,120,50,'Zone b|us-central1-b',0],[550,90,110,50,'Zone c|us-central1-c',0],
[270,160,390,50,'Subnets, GKE regional clusters, Cloud SQL HA span zones',2],
[50,100,160,60,'Datasets and buckets|spread across regions',0]],
[]);

const hier=K.dg(700,330,[
[10,10,680,310,'The resource hierarchy',1],
[250,40,200,40,'Organization|example.com',2],
[130,110,150,40,'Folder: Production',0],[420,110,150,40,'Folder: Development',0],
[60,190,130,40,'Project: web-prod',0],[220,190,130,40,'Project: data-prod',0],[390,190,130,40,'Project: web-dev',0],[550,190,120,40,'Project: sandbox',0],
[60,260,130,40,'VM, bucket, DB',0],[220,260,130,40,'BigQuery, Pub/Sub',0],[390,260,130,40,'GKE, Cloud Run',0]],
[[350,80,205,110],[350,80,495,110],[205,150,125,190],[205,150,285,190],[495,150,455,190],[495,150,610,190],[125,230,125,260],[285,230,285,260],[455,230,455,260]]);

const ways=K.dg(700,230,[
[10,10,680,210,'Every tool calls the same APIs',1],
[30,50,120,50,'Console|browser',0],[170,50,120,50,'gcloud|CLI',0],[310,50,120,50,'Cloud Shell|browser CLI',0],[450,50,120,50,'Terraform|code',0],[590,50,80,50,'Libraries',0],
[200,150,300,50,'Google Cloud REST and gRPC APIs',2]],
[[90,100,300,150],[230,100,330,150],[370,100,350,150],[510,100,370,150],[630,100,420,150]]);

/* ---------- 0 ---------- */
L['gcp:0:0']={blocks:[
{p:'**Google Cloud Platform (GCP)** is Google\'s public cloud. It runs on the same infrastructure that serves Search, YouTube and Gmail, and offers hundreds of products for computing, storage, networking, data, security and AI. This course teaches you to set up, run and secure workloads on Google Cloud the way a cloud engineer does, from your first project to production design.'},
{h:'What you will be able to do'},
{ul:['Organize a company\'s cloud with an organization, folders, projects, IAM and billing controls.','Design VPC networks, firewall rules, hybrid links and load balancers.','Choose between Compute Engine, GKE, Cloud Run, Cloud Run functions and App Engine, and deploy to each.','Pick the right storage and database service and operate it, including backups and recovery.','Monitor, log, alert and troubleshoot with Google Cloud Observability.','Apply identity, encryption and perimeter security, and automate with gcloud and Terraform.','Prepare for the **Associate Cloud Engineer** certification and reason about architecture, reliability and cost.']},
{svg:path},
{h:'How the course is organized'},
{t:[['Sections','Topic area'],
['1 to 3','Foundations, projects and billing, IAM'],
['4 to 6','VPC networking, hybrid connectivity, load balancing'],
['7 to 10','Compute Engine, storage, GKE, serverless'],
['11 to 12','Databases, analytics and messaging'],
['13 to 15','Operations, security, DevOps and infrastructure as code'],
['16 to 18','AI essentials, architecture and cost, exam readiness and labs']]},
{h:'Prerequisites'},
{t:[['You should know','If not'],
['Basic command line use','Practise cd, ls and editing files in a terminal'],
['What a server and a network are','Section 1 and the networking sections explain it from the start'],
['Basic IP addresses and ports','The VPC section builds this up'],
['Nothing about cloud','No problem. Section 1 starts with the basics']]},
{h:'How to use the course'},
{ul:['Do sections 1 to 3 first. Everything else depends on projects, billing and IAM.','Practise on a free-trial account. Set a budget alert before you create anything.','Each section ends with a quiz. Use the quick reference for revision and maps for the big picture.','Delete lab resources when finished. Idle load balancers, disks and clusters keep costing money.']},
{note:'Google Cloud changes frequently. Product names, limits and prices move, so this course teaches concepts and the reasons behind them, and links to the official documentation for exact current values. Commands were written from product knowledge, so check the documentation for your version of gcloud.'}],
src:[['Google Cloud documentation',K.D],['Associate Cloud Engineer certification','https://cloud.google.com/learn/certification/cloud-engineer']]};

/* ---------- 1 ---------- */
L['gcp:0:1']={blocks:[
{p:'**Cloud computing** means renting computing resources over the internet and paying for what you use, instead of buying and running your own hardware. Google Cloud provides the resources from large data centers around the world, and you create, change and delete them in minutes through a console, a command line or code.'},
{h:'Five characteristics of cloud'},
{ul:['**On-demand self-service.** Create a server yourself without asking anyone.','**Broad network access.** Reach resources over the network from anywhere.','**Resource pooling.** Many customers share the same physical infrastructure, isolated from each other.','**Rapid elasticity.** Scale out when load rises and in when it falls.','**Measured service.** Usage is metered and billed.']},
{h:'Service models'},
{svg:models},
{t:[['Model','You manage','Google Cloud examples'],
['IaaS (infrastructure)','Operating system, runtime, application, data','Compute Engine, Persistent Disk, VPC'],
['PaaS (platform)','Application code and data','App Engine, Cloud SQL, Cloud Run'],
['Serverless','Code and configuration only. No servers to see','Cloud Run, Cloud Run functions, BigQuery'],
['SaaS (software)','Your content and users','Google Workspace, Looker Studio']]},
{h:'Shared responsibility'},
{p:'Security in the cloud is shared. Google secures the infrastructure: buildings, hardware, the network backbone and the base platform. You secure what you put on top: identities, data, configuration, network rules and your own code. The higher the service level, the more Google handles.'},
{t:[['Area','Google','You'],
['Physical data centers and hardware','Always','Never'],
['Network backbone and hypervisor','Always','Never'],
['Operating system patching','For managed services','On Compute Engine VMs'],
['Identity and access (IAM)','Provides the tools','Configure correctly'],
['Data classification and encryption choices','Encrypts at rest by default','Decide on key control and sharing'],
['Application code and its vulnerabilities','Never','Always']]},
{note:'Most real cloud breaches come from the customer side of the line: a public bucket, an overpermissive role or a leaked key. Section 3 and the security section address exactly these.'}],
src:[['Google Cloud shared responsibility','https://cloud.google.com/architecture/framework/security/shared-responsibility-shared-fate'],['What is cloud computing','https://cloud.google.com/learn/what-is-cloud-computing']]};

/* ---------- 2 ---------- */
L['gcp:0:2']={blocks:[
{p:'Google Cloud resources live in physical locations. Choosing where they live affects **latency** (distance to users), **availability** (how a failure spreads), **compliance** (where data may be stored) and **price**.'},
{svg:geo},
{h:'The building blocks'},
{t:[['Term','Meaning','Example'],
['Region','An independent geographic area made of several zones. Zones in a region are connected by low-latency links','us-central1 (Iowa), europe-west1 (Belgium), asia-south1 (Mumbai)'],
['Zone','A deployment area inside a region and a single failure domain, roughly one cluster of data centers','us-central1-a'],
['Multi-region','A large area containing several regions, offered by some data services','US, EU, ASIA for Cloud Storage and BigQuery'],
['Edge point of presence','A Google network location near users used for caching and fast network entry','Cloud CDN and Cloud Load Balancing front ends']]},
{h:'Resource scope'},
{p:'Each resource type has a scope. This decides where you must place it and where it can be used.'},
{t:[['Scope','Examples'],
['Global','VPC network, global external load balancer, firewall policies, images, snapshots'],
['Regional','Subnets, regional managed instance groups, static regional IPs, Cloud Run services, Cloud SQL instances'],
['Zonal','VM instances, persistent disks (zonal), zonal GKE clusters, zonal instance groups'],
['Multi-regional or global service','Cloud Storage multi-region buckets, BigQuery multi-region datasets, Pub/Sub topics']]},
{h:'Choosing a location'},
{ul:['**Latency.** Pick the region closest to most users or to the systems that call yours.','**Data residency.** Laws may require data to stay in a country or region. Organization policy can enforce this.','**Availability.** Spread across at least two zones for production. Use two regions for disaster recovery.','**Price and features.** Prices differ by region, and some products or machine types are not available everywhere.','**Carbon.** Google publishes the carbon-free energy share per region if sustainability matters.']},
{note:'You cannot move a zonal resource to another zone in place. You recreate it, usually from a snapshot or image. Decide the location early.'}],
src:[['Geography and regions','https://cloud.google.com/about/locations'],['Regions and zones',K.GCE+'regions-zones']]};

/* ---------- 3 ---------- */
L['gcp:0:3']={blocks:[
{p:'Every Google Cloud resource sits in a **hierarchy**. Policy (IAM and organization policy) set on a parent flows down to all of its children, and billing is attached at project level. Understanding this tree is the single most important foundation for the rest of the course.'},
{svg:hier},
{h:'The levels'},
{t:[['Level','What it is','Notes'],
['Organization','The root node, tied to a Cloud Identity or Google Workspace domain','Optional but strongly recommended for any company. Gives central control'],
['Folder','A grouping of projects and other folders','Use for environments, teams or business units. Can nest'],
['Project','The base container for resources, APIs, IAM and billing','Every resource belongs to exactly one project'],
['Resource','A VM, bucket, dataset, topic, cluster and so on','Inherits policy from the project, folders and organization above']]},
{h:'Why projects matter'},
{ul:['**Isolation.** A bug or a leaked key in one project cannot touch another without permission.','**Billing and quota.** Costs and quotas are tracked per project.','**Access.** A project is the usual boundary for IAM roles.','**API enablement.** APIs are turned on per project.','**Lifecycle.** Deleting a project deletes everything inside it (with a 30-day recovery window).']},
{h:'Three identifiers of a project'},
{t:[['Identifier','Rules','Used for'],
['Project name','Human friendly. Can be changed','Display only'],
['Project ID','Globally unique, chosen at creation, cannot be changed or reused','gcloud, APIs, resource names'],
['Project number','Assigned by Google, never changes','Service agents, internal references']]},
{h:'Inheritance in one example'},
{flow:['Grant Viewer to a group on the folder Production','Every project in Production inherits the grant','A new project created in Production inherits it automatically','To remove it, change the folder grant, not each project']},
{note:'Inheritance is additive for allow policies. A child cannot remove a role granted by a parent. Use deny policies, organization policy or better placement of the grant. Section 3 covers this.'}],
src:[['Resource hierarchy',K.RM+'cloud-platform-resource-hierarchy'],['Creating and managing projects',K.RM+'creating-managing-projects']]};

/* ---------- 4 ---------- */
L['gcp:0:4']={blocks:[
{p:'You can manage Google Cloud in several ways. They all end up calling the same **APIs**, so anything possible in one is possible in the others, and the results look the same.'},
{svg:ways},
{h:'The options'},
{t:[['Tool','Best for','Notes'],
['Google Cloud console','Exploring, learning, one-off tasks, dashboards','Browser UI at console.cloud.google.com'],
['Cloud Shell','Quick commands with nothing to install','Browser-based terminal with gcloud, kubectl, Terraform and an editor. 5 GB persistent home disk'],
['gcloud CLI','Scripting, repeatable tasks, automation','Installed locally. Also includes `bq` (BigQuery) and `gsutil` or `gcloud storage`'],
['Client libraries','Application code that calls Google Cloud','Python, Java, Go, Node.js, C#, PHP, Ruby, C++'],
['REST and gRPC APIs','Anything else, custom tooling','Direct calls with an access token'],
['Terraform and Infrastructure Manager','Repeatable, reviewed infrastructure','Declarative code kept in source control'],
['Mobile app','Quick checks and alerts','Console companion on a phone']]},
{h:'Console tips'},
{ul:['Use the **project picker** at the top to see which project you are in. Most mistakes come from working in the wrong project.','The **Equivalent command line** and **Equivalent REST** links at the end of many create pages show the gcloud command for what you configured. This is the fastest way to learn gcloud.','Pin the products you use to the left navigation.']},
{h:'A first command in Cloud Shell'},
{code:`gcloud auth list
gcloud config list project
gcloud projects list`},
{note:'Click console work is fine to learn, but production environments should be created from code, so they are repeatable and reviewable. Section 15 covers Terraform.'}],
src:[['Cloud Shell','https://cloud.google.com/shell/docs'],['Google Cloud CLI overview',K.SDK]]};

/* ---------- 5 ---------- */
L['gcp:0:5']={blocks:[
{p:'To follow along you need a Google Cloud account. New customers get a **free trial credit** and a set of **Always Free** products with monthly usage limits, so you can learn without spending money, if you stay inside the limits.'},
{h:'What you get'},
{t:[['Offer','Detail (check the page for current values)'],
['Free trial credit','Typically $300 of credit valid for 90 days for new customers. It requires a payment method for identity verification but is not charged unless you upgrade'],
['Always Free','Monthly allowances for some products, for example one e2-micro VM in certain US regions, Cloud Storage and BigQuery quotas, Cloud Run requests, and others'],
['Free tier restrictions','Some resources, such as GPUs and certain products, cannot be used during the trial']]},
{h:'Set up in order'},
{flow:['Sign in with a Google account and accept the terms','Start the free trial and add a payment method for verification','Open the console. A default project may be created for you','Create a dedicated learning project with a clear name','Create a billing budget with email alerts at 50%, 90% and 100%','Enable only the APIs you need, as you need them']},
{h:'Protect yourself from surprise cost'},
{ul:['**Budgets are alerts, not limits.** By default they do not stop spending. Use them as early warnings and read Section 2 to see how to act on them.','Delete resources when you finish a lab. Load balancers, reserved IPs, GKE clusters and disks bill while idle.','Prefer small machine types and the cheapest regions for practice.','Turn on two-step verification on the account and avoid using a personal admin account for work.']},
{h:'Create your first project with gcloud'},
{code:`gcloud projects create my-learning-12345 --name="Learning"
gcloud config set project my-learning-12345
gcloud beta billing projects link my-learning-12345 --billing-account=XXXXXX-XXXXXX-XXXXXX`},
{note:'The project ID must be unique worldwide, 6 to 30 characters, with lowercase letters, digits and hyphens. A project without a linked billing account can use only free-of-charge capabilities.'}],
src:[['Free cloud features and trial','https://cloud.google.com/free/docs/free-cloud-features'],['Create a project',K.RM+'creating-managing-projects']]};

/* ---------- 6 ---------- */
L['gcp:0:6']={blocks:[
{p:'The **Google Cloud CLI** (`gcloud`) is the main command line tool. It follows a consistent pattern, so once you learn a few commands you can guess most of the others.'},
{h:'Install and initialise'},
{code:`# Install from https://cloud.google.com/sdk/docs/install (Windows installer, macOS, Linux packages)
gcloud init                    # sign in, choose a project and default region or zone
gcloud auth login              # sign in your user account
gcloud auth application-default login   # credentials for local code using client libraries
gcloud components update`},
{h:'Command shape'},
{code:`gcloud <group> <subgroup> <verb> <name> [--flags]

gcloud compute instances list
gcloud compute instances create web-1 --zone=us-central1-a
gcloud storage buckets create gs://my-bucket --location=US
gcloud projects add-iam-policy-binding my-project --member=... --role=...`},
{p:'The groups match the products. The verbs are mostly `list`, `describe`, `create`, `update`, `delete`. Add `--help` anywhere to see the options.'},
{h:'Named configurations'},
{p:'A **configuration** is a saved set of properties such as account, project, region and zone. Create one per project or customer and switch between them to avoid running a command against the wrong project.'},
{code:`gcloud config configurations create dev
gcloud config set project my-dev-project
gcloud config set compute/region us-central1
gcloud config set compute/zone us-central1-a
gcloud config configurations list
gcloud config configurations activate prod
gcloud compute instances list --project=other-project   # override once`},
{h:'Shaping output'},
{t:[['Flag','Use'],
['`--format=json` or `yaml` or `value()`','Choose output format for scripts'],
['`--format="table(name,zone,status)"`','Pick columns'],
['`--filter="status=RUNNING AND name~web"`','Filter server results in a readable way'],
['`--limit`, `--sort-by`','Trim and order'],
['`--quiet`','Skip prompts in automation']]},
{code:`gcloud compute instances list --filter="status=RUNNING" --format="value(name,zone.basename())"
gcloud projects describe my-project --format="value(projectNumber)"`},
{note:'Authentication choices matter. `gcloud auth login` is for you. Code running on your machine uses application default credentials. Code on Google Cloud should use an attached service account, never a downloaded key. Section 3 covers this.'}],
src:[['gcloud CLI reference','https://cloud.google.com/sdk/gcloud/reference'],['Managing gcloud configurations',K.SDK+'configurations']]};

/* ---------- 7 ---------- */
L['gcp:0:7']={blocks:[
{p:'Google Cloud products are exposed as **APIs**. Before you can use a product in a project, its API must be **enabled** for that project. Limits called **quotas** protect you and Google from runaway usage.'},
{h:'Enabling APIs'},
{code:`gcloud services list --available --filter="name:compute"
gcloud services enable compute.googleapis.com run.googleapis.com
gcloud services list --enabled`},
{ul:['Enabling an API is free by itself. You pay for the resources you create.','The console often offers to enable an API the first time you open a product.','Some APIs depend on others, and enabling one may enable several.','Keep unused APIs disabled: it shrinks what an attacker or a mistake can use.']},
{h:'Quotas and limits'},
{t:[['Type','What it is','Can be changed'],
['Rate quota','Requests per time unit, for example API calls per minute','Yes, by request'],
['Allocation quota','How many of a resource you may hold, for example CPUs per region or static IPs','Yes, by request'],
['System limit','A fixed hard limit of the product, for example a maximum object size','No'],
['Project-level versus organization-level','Quotas apply per project, with some per user or per region','Depends']]},
{p:'Quotas are visible in **IAM & Admin > Quotas & System Limits**. Many beginners meet a quota the first time a managed instance group or GKE cluster fails to grow with an error such as `QUOTA_EXCEEDED`.'},
{h:'Requesting more'},
{flow:['Open Quotas & System Limits and filter by the service and the region','Select the quota and choose Edit quota','Enter the new value with a short business reason','Wait for automatic or manual approval, depending on size','Consider using another region while you wait']},
{h:'Service accounts and the API'},
{p:'Every API request is made by some identity. If a call fails with a **403 (PERMISSION_DENIED)**, check three things: is the API enabled, does the identity have the right role, and is some policy such as organization policy or a perimeter blocking it.'},
{note:'Quota increases are not always instant. For events such as a launch, ask days ahead and test in the same region.'}],
src:[['Enabling services','https://cloud.google.com/service-usage/docs/enable-disable'],['Cloud Quotas','https://cloud.google.com/docs/quotas']]};
})();
