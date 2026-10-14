/* LearnSphere - Azure Administrator, Section 17: Production Readiness, Landing Zones & Capstone.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const lz=K.dg(700,330,[
[10,10,680,310,'A landing zone management group layout',1],
[240,35,220,36,'Tenant root group',2],
[250,90,200,36,'Organization group',0],
[40,155,180,36,'Platform',0],[260,155,180,36,'Landing zones',0],[480,155,180,36,'Sandbox and retired',0],
[10,220,120,36,'Identity',0],[140,220,120,36,'Connectivity',0],[270,220,120,36,'Management',0],[400,220,120,36,'Corp apps',0],[530,220,130,36,'Online apps',0]],
[[350,71,350,90],[350,126,130,155],[350,126,350,155],[350,126,570,155],[130,191,70,220],[130,191,200,220],[130,191,330,220],[350,191,460,220],[350,191,595,220]]);

const wafp=K.dg(700,200,[
[10,10,680,180,'Well-Architected pillars',1],
[25,60,120,70,'Reliability',0],[155,60,120,70,'Security',0],[285,60,130,70,'Cost|optimization',0],[425,60,130,70,'Operational|excellence',0],[565,60,110,70,'Performance|efficiency',0]],
[]);

const cap=K.dg(700,220,[
[10,10,680,200,'Capstone build order',1],
[25,60,100,70,'Govern',0],[140,60,100,70,'Network',0],[255,60,100,70,'Identity|and access',0],[370,60,100,70,'Workload',0],[485,60,90,70,'Monitor',0],[590,60,80,70,'Protect',2]],
[[125,95,140,95],[240,95,255,95],[355,95,370,95],[470,95,485,95],[575,95,590,95]]);

/* ---------- 0 ---------- */
L['az:16:0']={blocks:[
{p:'Before a workload goes live, check it against a list. A **production readiness checklist** turns lessons from earlier sections into a repeatable gate.'},
{t:[['Area','Questions to answer'],
['**Identity and access**','Are roles assigned to groups at narrow scopes? Is MFA required? Is PIM used? Are break-glass accounts tested?'],
['**Governance**','Is it in the right management group and subscription? Do policies, tags and locks apply?'],
['**Network**','Is there no public management port? Are private endpoints and NSGs in place? Is DNS planned?'],
['**Compute and data**','Are zones or sets used? Is encryption on? Are secrets in Key Vault with managed identity?'],
['**Monitoring**','Are metrics, logs and alerts defined? Who is on call? Are dashboards available?'],
['**Backup and DR**','Are RPO and RTO defined and tested? Are backups restorable? Is failover documented?'],
['**Cost**','Are budgets, tags and reservations set? Is right-sizing reviewed?'],
['**Operations**','Are runbooks, patching, change process and documentation ready?']]},
{h:'Using it'},
{flow:['Hold a short readiness review before launch','Record answers and owners for each gap','Fix blockers and accept others with an expiry date','Re-run the review after major changes']},
{note:'The goal is not paperwork. A checklist makes sure the same important questions are asked every time, by everyone.'}],
src:[['Azure Well-Architected Framework',K.WAF]]};

/* ---------- 1 ---------- */
L['az:16:1']={blocks:[
{p:'A **landing zone** is a pre-configured, governed environment where workloads are deployed. The **Cloud Adoption Framework (CAF)** gives a reference design for it.'},
{svg:lz},
{h:'Design areas'},
{t:[['Area','Decisions'],
['**Identity**','Tenant, RBAC model, PIM, hybrid identity'],
['**Resource organization**','Management groups, subscriptions, naming, tagging'],
['**Network**','Hub-and-spoke or virtual WAN, connectivity, DNS'],
['**Security**','Policies, Defender, key management'],
['**Management**','Monitoring, backup, update, cost'],
['**Governance**','Policy as code and compliance'],
['**Platform automation**','IaC and pipelines']]},
{h:'Subscription design'},
{ul:['Separate **platform** subscriptions (identity, connectivity, management) from **workload** subscriptions.','Use one subscription per workload and environment where limits and ownership differ.','Apply policy at management groups, so new subscriptions inherit guardrails automatically.','Automate subscription creation, often called **subscription vending**.']},
{note:'Start small. A simple, consistent structure with policies at the right management group is better than a perfect design that no one adopts.'}],
src:[['Azure landing zones',K.CAF+'ready/landing-zone/'],['Management group and subscription organization',K.CAF+'ready/azure-best-practices/organize-subscriptions']]};

/* ---------- 2 ---------- */
L['az:16:2']={blocks:[
{p:'The **Azure Well-Architected Framework** is a set of principles for assessing and improving workloads across five pillars.'},
{svg:wafp},
{t:[['Pillar','Administrator focus'],
['**Reliability**','Zones, backup, DR, health probes, tested recovery'],
['**Security**','Identity, network isolation, encryption, posture'],
['**Cost optimization**','Right-sizing, shutdown, reservations, budgets'],
['**Operational excellence**','IaC, monitoring, runbooks, safe deployment'],
['**Performance efficiency**','Right size, scaling, caching, metrics']]},
{h:'Using it'},
{ul:['Use the **Azure Well-Architected Review** to assess a workload and get recommendations.','**Azure Advisor** surfaces many recommendations by pillar.','Pillars can conflict, for example reliability raises cost. Document the trade-offs and the decision.']},
{note:'Treat the framework as a conversation starter with owners. The value is in agreeing what matters for each workload.'}],
src:[['Well-Architected Framework',K.WAF],['Azure Advisor',K.D+'advisor/advisor-overview']]};

/* ---------- 3 ---------- */
L['az:16:3']={blocks:[
{p:'Baselines are the minimum standard that every subscription and workload meets. Three baselines matter most: identity, network and policy.'},
{h:'Identity baseline'},
{ul:['MFA for all users, phishing-resistant for admins.','Roles assigned to groups, least privilege, PIM for privileged roles.','Managed identities for workloads, no shared keys.','Two tested break-glass accounts.']},
{h:'Network baseline'},
{ul:['Hub-and-spoke or equivalent with central egress and inspection.','No public IPs on VMs, Bastion for management.','Private endpoints for PaaS, private DNS zones, public access disabled.','NSGs on every subnet and a default deny posture.']},
{h:'Policy baseline'},
{t:[['Policy','Purpose'],
['Allowed locations','Data residency and cost'],
['Required tags and inherit tags','Ownership and cost tracking'],
['Deny public IPs on NICs and storage public access','Reduce exposure'],
['Diagnostic settings DeployIfNotExists','Consistent logging'],
['Require HTTPS and TLS 1.2','Encryption in transit'],
['Allowed VM sizes and SKUs','Cost control']]},
{note:'Apply baselines through management groups and automation, so every new subscription receives them without manual steps.'}],
src:[['Azure security baseline',K.D+'security/benchmark/azure/overview'],['Policy samples',K.POLICY+'samples/']]};

/* ---------- 4 ---------- */
L['az:16:4']={blocks:[
{p:'Production environments should be built from **code** and changed through a **pipeline**, so every change is reviewed, repeatable and traceable.'},
{flow:['Developer or admin changes a Bicep file in a branch','A pull request triggers lint, validate and what-if','Reviewers approve the change and the what-if output','Merge to main deploys to the target scope through a pipeline','Deployment results and activity log record the change']},
{h:'Practices'},
{ul:['Store templates, parameter files and policy in **source control**.','Authenticate pipelines with **workload identity federation**, not stored secrets.','Run **what-if** and require approval for production.','Deploy at the right scope with least privilege service connections.','Keep **drift** small by blocking manual portal changes where possible.']},
{code:`az bicep build --file main.bicep
az deployment group validate -g rg-prod --template-file main.bicep --parameters prod.bicepparam
az deployment group what-if -g rg-prod --template-file main.bicep --parameters prod.bicepparam
az deployment group create -g rg-prod --template-file main.bicep --parameters prod.bicepparam`},
{note:'Tools such as GitHub Actions, Azure DevOps and Terraform can all do this. The principle is the same: code, review, deploy, record.'}],
src:[['Deploy Bicep with GitHub Actions',K.BICEP+'deploy-github-actions']]};

/* ---------- 5 ---------- */
L['az:16:5']={blocks:[
{p:'Reliable operations depend on **change management**, **runbooks** and **documentation** as much as on technology.'},
{h:'Change management'},
{ul:['Classify changes: standard (pre-approved), normal (reviewed), emergency.','Require a plan, a test, a rollback and a window for risky changes.','Use pipelines and what-if as the record of what changed.','Review incidents and changes together to find patterns.']},
{h:'Runbooks'},
{p:'A runbook is a short, tested procedure for a repeated task or incident, with steps, commands, expected results and who to call.'},
{t:[['Runbook','Example contents'],
['Restore a VM','Find the recovery point, restore disks, rebuild the VM, validate'],
['Rotate a secret','Create new version, update consumers, verify, disable old'],
['Failover','Check health, start recovery plan, commit, update DNS'],
['Onboard a user','Create user, add groups, assign license, verify access']]},
{h:'Documentation'},
{ul:['An architecture diagram and a list of resources and owners.','Naming and tagging standards, and the network address plan.','Contact and escalation paths, and links to dashboards and alerts.','Keep documents next to code and review them like code.']},
{note:'Test runbooks on a schedule. A runbook that is not rehearsed will fail at the worst time.'}],
src:[['Operational excellence',K.WAF+'operational-excellence/']]};

/* ---------- 6 ---------- */
L['az:16:6']={blocks:[
{p:'The capstone brings the course together: build a small production-style environment, secure it, monitor it, back it up and recover it.'},
{svg:cap},
{h:'Requirements'},
{t:[['Area','Deliverable'],
['**Governance**','Management group, allowed locations policy, required owner tag, lock on production group'],
['**Identity**','Groups for operators and readers, least-privilege roles, managed identity for the app'],
['**Network**','Hub and one spoke, NSGs, Bastion, no public IP on VMs'],
['**Workload**','Two VMs across zones behind a load balancer, with a storage account behind a private endpoint'],
['**Monitoring**','Log Analytics workspace, VM insights, CPU alert with action group'],
['**Protection**','VM backup policy, restore test, optional Site Recovery test failover'],
['**Automation**','Everything in Bicep and deployed through the CLI or a pipeline']]},
{h:'Acceptance checks'},
{flow:['Policy blocks a deployment in a disallowed region','An operator can restart a VM but cannot create a storage account','No VM has a public IP, and Bastion is the only admin path','Load balancer serves traffic and survives one VM stopped','An alert fires when CPU is high','A file is recovered from backup in a test restore']},
{note:'Document the design and decisions, run the readiness checklist, then tear the environment down with a final cost check.'}],
src:[['Azure Architecture Center',K.D+'architecture/']]};

})();
