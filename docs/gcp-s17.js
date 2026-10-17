/* LearnSphere - Google Cloud, Section 17: Architecture, Migration & Cost Optimization.
   Lectures 0-6 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const pillars=K.dg(700,260,[
[10,10,680,240,'Well-Architected Framework pillars',1],
[25,60,125,100,'Operational|excellence|automate, observe,|improve',0],[165,60,125,100,'Security,|privacy and|compliance',0],[305,60,125,100,'Reliability|survive failure,|recover fast',2],[445,60,115,100,'Cost|optimization|pay for value',0],[575,60,100,100,'Performance|optimization|right resources',0],
[25,185,650,40,'Trade-offs are normal: choose deliberately and write down why',2]],
[]);

const dr=K.dg(700,260,[
[10,10,680,240,'Disaster recovery patterns: cost against recovery time',1],
[30,70,190,120,'Backup and restore|cold|RTO hours to days|lowest cost',0],
[255,70,190,120,'Warm standby|scaled-down copy|RTO minutes to an hour|medium cost',0],
[480,70,190,120,'Hot / active-active|full capacity in two regions|RTO near zero|highest cost',2]],
[]);

const zone=K.dg(700,330,[
[10,10,680,310,'Landing zone',1],
[30,45,640,40,'Organization, folders, naming, labels, org policies',2],
[30,95,310,40,'Identity: groups, SSO, break-glass admins',0],[360,95,310,40,'Networking: Shared VPC, hybrid, DNS, egress',0],
[30,145,310,40,'Security: logging sinks, SCC, KMS, perimeters',0],[360,145,310,40,'Billing: budgets, export, labels',0],
[30,195,640,40,'Automation: Terraform, CI/CD, review process',2],
[30,250,640,40,'Workload projects: dev, test, prod per application',0]],
[]);

const mig=K.dg(700,200,[
[10,10,680,180,'Migration phases',1],
[20,70,150,60,'Assess|discover, size, cost',0],[200,70,150,60,'Plan|landing zone, tools',0],[380,70,150,60,'Migrate|move and test',2],[560,70,110,60,'Optimize|tune, cost',0]],
[[170,100,200,100],[350,100,380,100],[530,100,560,100]]);

const three=K.dg(700,360,[
[10,10,680,340,'Three-tier web application',1],
[250,35,200,40,'Users, Cloud DNS',0],
[250,90,200,40,'Global Application LB|Cloud Armor, CDN',2],
[40,150,290,60,'Web tier|regional MIG across 3 zones|no external IPs',0],[370,150,290,60,'App tier|Cloud Run or MIG|internal LB',0],
[40,230,290,50,'Memorystore|cache',0],[370,230,290,50,'Cloud SQL HA|regional, private IP',2],
[40,295,620,40,'Cloud NAT, Cloud Logging and Monitoring, Secret Manager, Cloud KMS, Cloud Storage backups',0]],
[[350,75,350,90],[350,130,185,150],[350,130,515,150],[185,210,185,230],[515,210,515,230]]);

const evt=K.dg(700,260,[
[10,10,680,240,'Serverless event-driven application',1],
[25,90,100,60,'Client|web or mobile',0],[150,90,120,60,'Cloud Run API|IAM, identity',2],[295,40,120,50,'Firestore|app data',0],[295,110,120,50,'Pub/Sub|events',2],[440,110,110,50,'Eventarc|or push',0],[575,70,100,50,'Worker|Cloud Run job',0],[575,140,100,50,'BigQuery|analytics',0]],
[[125,120,150,120],[270,105,295,65],[270,130,295,135],[415,135,440,135],[550,135,575,95],[550,140,575,165]]);

/* ---------- 0 ---------- */
L['gcp:16:0']={blocks:[
{p:'The **Google Cloud Well-Architected Framework** (formerly the Architecture Framework) is Google\'s guidance for designing and operating good systems. It organizes best practice into pillars you can use as a review checklist.'},
{svg:pillars},
{h:'The pillars'},
{t:[['Pillar','Question it asks','Examples'],
['Operational excellence','Can we run, observe and change it safely?','Infrastructure as code, CI/CD, monitoring, runbooks, incident reviews'],
['Security, privacy and compliance','Is it protected and compliant?','Least privilege, encryption, perimeters, audit logs, data residency'],
['Reliability','Does it keep working and recover quickly?','Multiple zones, health checks, backups, SLOs, graceful degradation'],
['Cost optimization','Do we pay for value?','Rightsizing, commitments, autoscaling, budgets, labels'],
['Performance optimization','Is it fast enough, efficiently?','Caching, CDN, right database, load testing']]},
{h:'Design principles that cut across'},
{ul:['**Design for failure.** Assume zones, instances and dependencies will fail.','**Use managed services** so Google runs undifferentiated work.','**Loose coupling** with queues and APIs, so parts fail and scale independently.','**Stateless compute, durable data.** Keep state in managed storage.','**Automate** everything repeatable and keep it in version control.','**Least privilege** and secure by default.','**Measure.** Define SLOs and watch them.']},
{h:'Trade-offs'},
{p:'Pillars pull against each other. More redundancy raises reliability and cost. Stricter security can slow delivery. A good architect makes the trade-off explicit, based on business needs, and records the decision.'},
{flow:['Gather requirements: users, data, availability, latency, compliance, budget','Propose an architecture and list the services','Review against each pillar and note the risks','Decide, document the reasoning, and plan to revisit','Test with load, failure and recovery exercises']},
{note:'Use the Architecture Center reference architectures and the Cloud Architecture Center diagrams as starting points rather than designing from nothing.'}],
src:[['Well-Architected Framework','https://cloud.google.com/architecture/framework'],['Architecture Center','https://cloud.google.com/architecture']]};

/* ---------- 1 ---------- */
L['gcp:16:1']={blocks:[
{p:'Everything fails eventually. **High availability (HA)** keeps a service running through common failures. **Disaster recovery (DR)** restores service after a large failure such as the loss of a region. Both start from targets.'},
{h:'Key terms'},
{t:[['Term','Meaning'],
['RPO (recovery point objective)','The maximum acceptable data loss, measured in time. RPO of 5 minutes means you can lose up to 5 minutes of data'],
['RTO (recovery time objective)','The maximum acceptable time to restore service'],
['Availability','Percent of time the service works. 99.9 percent allows about 43 minutes of downtime per month. 99.99 percent about 4 minutes'],
['Failure domain','A set of resources that can fail together: instance, zone, region']]},
{h:'Levels of protection'},
{t:[['Failure','Protection'],
['Instance','MIG autohealing, health checks, replicas'],
['Zone','Regional MIGs, regional GKE, Cloud SQL HA, regional disks, load balancer across zones'],
['Region','Multi-region data (dual- or multi-region storage, Spanner multi-region), cross-region replicas, global load balancing, DR plan'],
['Human error or corruption','Backups, versioning, retention, PITR, deletion protection'],
['Provider-level','Multicloud or hybrid only when business needs justify the complexity']]},
{svg:dr},
{h:'DR patterns'},
{t:[['Pattern','How it works','RTO / cost'],
['Backup and restore','Back up data to another region. Rebuild infrastructure from code during a disaster','Longest, cheapest'],
['Pilot light / warm standby','Core data is replicated and a small environment runs. Scale up on failure','Medium'],
['Hot standby / active-active','Full capacity in two or more regions, traffic shared','Shortest, most expensive']]},
{h:'Practical steps'},
{ul:['Set RPO and RTO per service together with the business.','Automate environment creation with Terraform so rebuilds are quick.','Replicate or back up data across regions at a frequency matching RPO.','Use health-checked global load balancing and low DNS TTLs for failover.','**Test** failover and restore regularly. An untested plan is a hope.']},
{note:'Multi-region design adds data consistency, latency and cost issues. Many workloads are well served by multi-zone HA plus tested cross-region backups.'}],
src:[['Disaster recovery planning guide','https://cloud.google.com/architecture/dr-scenarios-planning-guide'],['Reliability pillar','https://cloud.google.com/architecture/framework/reliability']]};

/* ---------- 2 ---------- */
L['gcp:16:2']={blocks:[
{p:'A **landing zone** is the prepared foundation in which workloads are deployed: organization structure, identity, networking, security and billing configured consistently. Building it first prevents risky shortcuts and expensive redesign.'},
{svg:zone},
{h:'Parts of a landing zone'},
{t:[['Area','Decisions'],
['Resource hierarchy','Folders for environments or business units, naming standards, project factory'],
['Identity and access','Groups and roles per function, SSO, admin separation, no service account keys'],
['Networking','Shared VPC or hub-and-spoke, IP plan, hybrid connectivity, DNS, egress control'],
['Security','Organization policies, central log sink, Security Command Center, VPC Service Controls, KMS'],
['Billing and cost','Billing accounts, budgets, labels, export to BigQuery'],
['Operations','Central monitoring, alert routing, backup standards'],
['Automation','Terraform repositories, pipelines, review and approval']]},
{h:'Blueprints'},
{p:'Google publishes the **enterprise foundations blueprint** and a Terraform **example foundation** that create a recommended set of folders, projects, policies and networks. Use them as a starting point and adapt.'},
{h:'Build order'},
{flow:['Set up Cloud Identity, the organization and admin groups','Create the bootstrap project and Terraform state, then pipelines','Apply organization policies and the folder structure','Create shared networking and central logging projects','Enable security services and billing controls','Provide a project factory so teams get compliant projects quickly']},
{h:'Common mistakes'},
{ul:['Starting in a single project with the default network and Owner roles, then trying to fix it later.','No IP plan, leading to overlapping ranges.','Allowing every team to create service account keys and external IPs.','No central logging, so audit evidence is scattered.']},
{note:'A landing zone is also a product. Give it an owner, a backlog and versions, and communicate changes to the teams that depend on it.'}],
src:[['Landing zone design','https://cloud.google.com/architecture/landing-zones'],['Enterprise foundations blueprint','https://cloud.google.com/architecture/security-foundations']]};

/* ---------- 3 ---------- */
L['gcp:16:3']={blocks:[
{p:'Moving existing systems to Google Cloud is a project with phases, strategies and tools. Skipping assessment or planning is the most common cause of surprises.'},
{svg:mig},
{h:'Phases'},
{t:[['Phase','Work'],
['Assess','Discover servers, applications and dependencies, size workloads, estimate cost, choose strategies'],
['Plan','Build the landing zone, decide waves and order, set up connectivity, define success'],
['Migrate','Move workloads, test, cut over, keep rollback plans'],
['Optimize','Rightsize, adopt managed services, improve operations and cost']]},
{h:'Strategies (the Rs)'},
{t:[['Strategy','Meaning','Effort'],
['Rehost (lift and shift)','Move VMs as they are to Compute Engine','Low'],
['Replatform','Small changes for managed services, such as a managed database','Medium'],
['Refactor','Redesign for cloud-native services like Cloud Run or GKE','High'],
['Repurchase','Replace with SaaS','Varies'],
['Retire','Switch off what is not needed','Saves cost'],
['Retain','Leave on premises for now','None']]},
{h:'Google Cloud tools'},
{t:[['Tool','Use'],
['Migration Center','Discovery, assessment and cost estimates of the current estate'],
['Migrate to Virtual Machines','Replicate and cut over VMs from VMware, AWS, Azure or physical servers to Compute Engine'],
['Database Migration Service','Move databases with minimal downtime'],
['Storage Transfer Service and Transfer Appliance','Move object and file data'],
['Migrate to Containers','Convert VM workloads into containers'],
['Google Cloud VMware Engine','Run VMware workloads as-is on Google Cloud']]},
{ul:['Migrate in **waves**: start with low-risk, independent systems to build experience.','Plan **data** movement carefully: size, bandwidth, cutover window.','Test performance and security before cutover and keep the source until verified.','Train the team and update runbooks and monitoring.']},
{note:'Most cost savings come after migration, from rightsizing and moving to managed services. Plan the optimization phase from the start.'}],
src:[['Migration to Google Cloud','https://cloud.google.com/architecture/migration-to-gcp-getting-started'],['Migration Center','https://cloud.google.com/migration-center/docs/overview']]};

/* ---------- 4 ---------- */
L['gcp:16:4']={blocks:[
{p:'Cost optimization is a continuous practice, often called **FinOps**, where engineering, finance and business share responsibility for cloud spend. The goal is value for money, not simply the lowest bill.'},
{h:'Where savings usually come from'},
{t:[['Area','Action'],
['Compute','Rightsize VMs, use autoscaling, schedule dev/test off-hours, use Spot for fault-tolerant work, commit to steady usage'],
['Storage','Choose the right class, lifecycle rules or Autoclass, delete old snapshots, disks and buckets'],
['Databases','Right-size instances, remove unused replicas, use read replicas only when needed, stop dev instances'],
['Network','Keep traffic in region, use CDN and caching, release unused IPs, review egress'],
['Analytics','Partition and cluster tables, avoid SELECT *, choose capacity pricing for heavy use, set quotas'],
['Observability','Exclude noisy logs, set retention, sample traces'],
['Licensing','Use sole-tenant BYOL or open source where it fits']]},
{h:'A repeatable review'},
{flow:['Allocate cost: labels, projects and folders map spend to teams and applications','Report: dashboards from billing export and shared with owners','Find waste: Recommender idle resources, unattached disks, old snapshots','Reduce: rightsize, schedule, tier, delete','Commit: buy commitments for the steady baseline only','Prevent: budgets, alerts, policies and a forecast']},
{h:'Guardrails'},
{ul:['Budgets with alerts per project and team.','Quota limits to bound runaway usage (for example BigQuery bytes billed limit).','Organization policy to restrict expensive machine types or regions where needed.','Required labels enforced in Terraform modules.','Cost estimate in pull requests for infrastructure changes.']},
{h:'Metrics to watch'},
{ul:['Cost per customer, transaction or environment (unit cost).','Commitment coverage and utilization.','Percent of spend with proper labels.','Idle and untagged resource counts.']},
{note:'Do not cut cost at the expense of reliability or security. Optimization means removing waste, not removing safety.'}],
src:[['Cost optimization pillar','https://cloud.google.com/architecture/framework/cost-optimization'],['FinOps hub','https://cloud.google.com/billing/docs/how-to/finops-hub']]};

/* ---------- 5 ---------- */
L['gcp:16:5']={blocks:[
{p:'This reference design combines many services from the course into the classic **three-tier web application**: a presentation tier, an application tier and a data tier.'},
{svg:three},
{h:'Request path'},
{flow:['A user resolves the name in Cloud DNS and reaches the global external Application Load Balancer','Cloud Armor and Cloud CDN filter and cache at the edge','The load balancer sends traffic to the web tier in a regional managed instance group across three zones','The web tier calls the application tier through an internal load balancer','The application reads cached data from Memorystore and uses Cloud SQL (HA, private IP) for persistent data','Logs and metrics flow to Cloud Logging and Monitoring']},
{h:'Design decisions'},
{t:[['Area','Choice and reason'],
['Compute','Regional MIGs with autoscaling and autohealing for zone resilience'],
['Network','Custom VPC with separate subnets per tier, no external IPs, Cloud NAT for outbound'],
['Security','Firewall rules by service account or tag, IAP for admin access, Cloud Armor, Secret Manager for credentials'],
['Data','Cloud SQL regional HA with automated backups and PITR, read replica for reporting'],
['Static content','Cloud Storage with CDN through a backend bucket'],
['Operations','SLOs, alert policies, uptime check, dashboards, Terraform for all of it'],
['DR','Cross-region backups and replica, infrastructure rebuilt from code']]},
{h:'Variations'},
{ul:['Replace the VM tiers with **Cloud Run** to reduce operations.','Use **GKE** when you have many services and Kubernetes skills.','Use **AlloyDB** or **Spanner** when scale or availability demands exceed Cloud SQL.']},
{code:`gcloud compute instance-groups managed create web-mig --template=web-tpl --size=3 --region=us-central1 --zones=us-central1-a,us-central1-b,us-central1-c
gcloud sql instances create app-db --database-version=POSTGRES_16 --region=us-central1 --availability-type=REGIONAL --network=prod-vpc --no-assign-ip --enable-point-in-time-recovery
gcloud compute routers nats create nat-config --router=nat-router --region=us-central1 --auto-allocate-nat-external-ips --nat-all-subnet-ip-ranges`},
{note:'Read the diagram as a checklist: for each box, ask what happens if it fails, who can access it, how it scales, how you will see problems and what it costs.'}],
src:[['Three-tier web app','https://cloud.google.com/architecture/application-development'],['Architecture Center','https://cloud.google.com/architecture']]};

/* ---------- 6 ---------- */
L['gcp:16:6']={blocks:[
{p:'Many modern systems are built from small pieces that react to events. This reference design uses serverless services, so there are no servers to manage, it scales to zero, and cost follows use.'},
{svg:evt},
{h:'Flow'},
{flow:['A client calls the Cloud Run API, authenticated with Identity Platform or IAM','The API stores application data in Firestore and publishes an event to Pub/Sub','A push subscription (or Eventarc) delivers the event to a worker on Cloud Run','The worker performs long or retried work, such as sending email or processing files','Events and results also stream to BigQuery for analytics','Cloud Logging, Monitoring and Trace show the whole path']},
{h:'Design decisions'},
{t:[['Area','Choice and reason'],
['API','Cloud Run: container, autoscale, IAM or public with a load balancer and Cloud Armor'],
['Data','Firestore for flexible app data with automatic scale; BigQuery for analysis'],
['Messaging','Pub/Sub to decouple and absorb bursts; dead-letter topic for failures'],
['Background work','Cloud Run services or jobs triggered by events or Cloud Scheduler'],
['Security','Dedicated service accounts per service, Secret Manager, VPC egress only when needed'],
['Reliability','Idempotent handlers, retries with backoff, regional services, SLOs'],
['Delivery','Cloud Build, Artifact Registry, Cloud Deploy and Terraform']]},
{h:'Watch for'},
{ul:['Event delivery is at least once: make consumers idempotent.','Set maximum instances to protect downstream databases.','Cold starts: use minimum instances for latency-sensitive paths.','Quotas and per-request limits (timeouts, payload size).','Cost at very high volume: compare with always-on options.']},
{h:'Choosing between the two reference designs'},
{t:[['Pick','When'],
['Three-tier on VMs or MIGs','Existing apps, special software, predictable steady load, full OS control'],
['Serverless event-driven','New cloud-native apps, spiky load, small teams, fast delivery']]},
{note:'You can mix both. A VM-based legacy core can be surrounded by serverless services that add features around it.'}],
src:[['Serverless web apps','https://cloud.google.com/architecture/serverless-overview'],['Event-driven architectures','https://cloud.google.com/eventarc/docs/overview']]};
})();
