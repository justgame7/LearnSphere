/* LearnSphere - Google Cloud, Section 02: Projects, Organization & Billing.
   Lectures 0-6 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const orgSetup=K.dg(700,230,[
[10,10,680,210,'From domain to organization',1],
[30,70,130,60,'Domain|example.com',0],[190,70,150,60,'Cloud Identity or|Workspace',0],[370,70,140,60,'Organization|resource',2],[540,70,130,60,'Admins, groups,|folders, projects',0]],
[[160,100,190,100],[340,100,370,100],[510,100,540,100]]);

const billing=K.dg(700,260,[
[10,10,680,240,'Billing is linked to projects, not to users',1],
[40,60,170,60,'Billing account|payment profile',2],
[270,40,160,40,'Project A',0],[270,110,160,40,'Project B',0],[270,180,160,40,'Project C',0],
[500,60,170,60,'Budgets and|alerts',0],[500,150,170,60,'Billing export|to BigQuery',0]],
[[210,90,270,60],[210,90,270,130],[210,90,270,200],[210,90,500,90],[210,90,500,180]]);

const orgpol=K.dg(700,220,[
[10,10,680,200,'IAM and organization policy answer different questions',1],
[40,60,260,100,'IAM|Who can do what?|Grants permissions to identities',0],
[400,60,260,100,'Organization policy|What is allowed at all?|Restricts configuration',2]],
[[300,110,400,110]]);

/* ---------- 0 ---------- */
L['gcp:1:0']={blocks:[
{p:'Google Cloud needs an identity system to know who your users are. For a company, that system is **Cloud Identity** or **Google Workspace**. When you sign up with a domain you own, Google creates an **organization resource** that becomes the root of your resource hierarchy.'},
{svg:orgSetup},
{h:'Cloud Identity versus Workspace'},
{t:[['Product','What you get','Use when'],
['Cloud Identity Free','Users, groups, SSO, device and security controls, no email or office apps','You only need identity for Google Cloud'],
['Cloud Identity Premium','Adds advanced security, device management and reporting','You need more control of devices and access'],
['Google Workspace','Identity plus Gmail, Drive, Meet and Docs','You also use Google productivity apps']]},
{h:'First tasks for an administrator'},
{flow:['Verify the domain with a DNS TXT record','Create the first super administrator and protect it with security keys','Create an organization admin group and a billing admin group','Grant those groups the organization and billing roles','Create folders for environments and a project for shared services','Connect your identity provider (Entra ID, Okta) for single sign-on if you have one']},
{h:'Roles to know early'},
{t:[['Role','Purpose'],
['Organization Administrator','Manage IAM and policy across the whole organization'],
['Folder Admin and Project Creator','Create and manage folders, create projects'],
['Billing Account Administrator','Control the billing account and who can use it'],
['Billing Account User','Link projects to a billing account']]},
{h:'Why not run without an organization?'},
{ul:['Projects created without one are standalone and cannot be governed centrally.','There are no folders, organization policies or central audit configuration.','Moving standalone projects into an organization later is possible but takes planning.']},
{note:'Keep super administrator accounts for break-glass use only. Daily work should use named accounts in groups with specific roles.'}],
src:[['Creating and managing organization resources',K.RM+'creating-managing-organization'],['Cloud Identity','https://cloud.google.com/identity/docs']]};

/* ---------- 1 ---------- */
L['gcp:1:1']={blocks:[
{p:'Projects are the working unit of Google Cloud. A good folder and project design keeps access, cost and risk contained without making life harder for teams.'},
{h:'Creating and listing'},
{code:`gcloud projects create payments-prod-7421 --folder=123456789012 --name="Payments Prod"
gcloud projects list --filter="parent.id=123456789012"
gcloud projects describe payments-prod-7421
gcloud resource-manager folders create --display-name="Production" --organization=987654321`},
{h:'Project lifecycle'},
{t:[['State','What happens'],
['Active','Normal use'],
['Pending deletion','After shutdown the project stops serving. It can be restored within 30 days with `gcloud projects undelete`'],
['Deleted','After the period, the project ID and its resources are gone. IDs are not reused']]},
{p:'To protect important projects from accidental deletion, place a **lien**. The delete command fails until the lien is removed.'},
{code:`gcloud alpha resource-manager liens create --restrictions=resourcemanager.projects.delete \\
  --reason="Production payments" --project=payments-prod-7421
gcloud projects move payments-prod-7421 --folder=555555555555`},
{h:'Common structure patterns'},
{t:[['Pattern','Layout','Good for'],
['By environment','Folders: Production, Staging, Development','Different access and policy per environment'],
['By team or business unit','Folders per department, projects inside','Large companies with separate owners'],
['By application','A project per app per environment, such as shop-prod and shop-dev','Clear cost and isolation per application'],
['Shared services','Projects for networking, logging, security, CI/CD','Central teams that serve others']]},
{h:'Design tips'},
{ul:['Use one project per application per environment. It gives clean billing, quotas and blast radius.','Name projects consistently, for example `team-app-env`. Project IDs are permanent.','Keep a small number of folders levels. Deep nesting is hard to reason about.','Do not mix production and development resources in one project.','Use a separate project for centralized networking (Shared VPC host) and for logging sinks.']},
{note:'Do not put sensitive information in project IDs or names. They appear in many places, including URLs and logs.'}],
src:[['Managing projects',K.RM+'creating-managing-projects'],['Resource hierarchy best practices','https://cloud.google.com/architecture/landing-zones/decide-resource-hierarchy']]};

/* ---------- 2 ---------- */
L['gcp:1:2']={blocks:[
{p:'**Labels** and **tags** both attach key-value information to resources, but they serve different purposes. Labels are for organizing and reporting. Tags are for governing.'},
{h:'Labels'},
{ul:['Key-value pairs attached to resources, for example `env=prod` and `team=payments`.','They appear in billing data, so you can group costs by label.','They can be used to filter lists and in scripts.','They do not change access or policy.']},
{code:`gcloud compute instances add-labels web-1 --labels=env=prod,team=payments --zone=us-central1-a
gcloud compute instances list --filter="labels.env=prod"
gcloud projects update my-project --update-labels=cost-center=1234`},
{h:'Tags'},
{p:'**Resource Manager tags** are key-value pairs defined at the organization or project level. A tag value is bound to a resource such as a project, folder or VM. Tags can be used in **IAM conditions**, **organization policy** and **firewall rules**, which makes them a policy tool, not just metadata.'},
{code:`gcloud resource-manager tags keys create environment --parent=organizations/987654321 \\
  --purpose=GCE_FIREWALL --purpose-data=network=my-project/my-vpc
gcloud resource-manager tags values create production --parent=987654321/environment`},
{h:'Labels, tags and network tags'},
{t:[['Item','Scope','Purpose','Affects policy'],
['Label','Per resource, free text','Cost reporting, filtering, grouping','No'],
['Resource Manager tag','Defined in the organization or project, restricted values','Conditional IAM, organization policy, firewall policy','Yes'],
['Network tag (Compute Engine)','VM only, simple string','Target firewall rules and routes in older designs','Yes, for networking only']]},
{h:'A sensible labeling standard'},
{ul:['Agree on a small required set: `env`, `app`, `team`, `cost-center`.','Enforce it in Terraform modules and with organization policy where supported.','Check for missing labels in billing reports regularly.']},
{note:'Labels may be visible to many people and in logs. Never put secrets or personal data in them.'}],
src:[['Labels','https://cloud.google.com/resource-manager/docs/labels-overview'],['Tags','https://cloud.google.com/resource-manager/docs/tags/tags-overview']]};

/* ---------- 3 ---------- */
L['gcp:1:3']={blocks:[
{p:'**Organization Policy Service** lets administrators set **constraints** on how resources can be configured across the organization, a folder or a project. Where IAM says who may act, organization policy says what is allowed at all, even for an owner.'},
{svg:orgpol},
{h:'How it works'},
{ul:['A **constraint** is a rule type, such as "restrict where resources can be created". Google defines the list.','A **policy** sets the constraint at a node of the hierarchy and is inherited by children.','Constraints are either **boolean** (enforced or not) or **list** (allowed or denied values).','Children can override or merge with parent policy, depending on the policy setting.']},
{h:'Constraints worth knowing'},
{t:[['Constraint','Effect'],
['`gcp.resourceLocations`','Restrict the regions where resources can be created (data residency)'],
['`iam.disableServiceAccountKeyCreation`','Block downloadable service account keys'],
['`iam.allowedPolicyMemberDomains`','Only allow identities from approved domains in IAM'],
['`compute.vmExternalIpAccess`','Control which VMs may have external IP addresses'],
['`compute.requireOsLogin`','Require OS Login for SSH'],
['`compute.skipDefaultNetworkCreation`','Do not create the default network in new projects'],
['`storage.uniformBucketLevelAccess`','Require uniform access for new buckets'],
['`storage.publicAccessPrevention`','Prevent buckets from being public'],
['`sql.restrictPublicIp`','Block public IPs on Cloud SQL']]},
{h:'Working with policies'},
{code:`# enforce a boolean constraint on an organization
gcloud org-policies set-policy policy.yaml --organization=987654321

# example policy.yaml
name: organizations/987654321/policies/iam.disableServiceAccountKeyCreation
spec:
  rules:
  - enforce: true

gcloud org-policies list --organization=987654321
gcloud org-policies describe compute.vmExternalIpAccess --project=my-project --effective`},
{h:'Rolling out safely'},
{flow:['Pick the constraint and find which projects it would affect','Use a dry-run policy to log violations without blocking','Fix or exempt existing resources','Enforce at a folder first, then widen to the organization','Document exceptions and who approves them']},
{note:'New organizations created after 2024 enforce secure-by-default constraints such as disabling service account key creation. Check the effective policy before assuming a setting is off.'}],
src:[['Organization Policy Service','https://cloud.google.com/resource-manager/docs/organization-policy/overview'],['Constraints list','https://cloud.google.com/resource-manager/docs/organization-policy/org-policy-constraints']]};

/* ---------- 4 ---------- */
L['gcp:1:4']={blocks:[
{p:'**Cloud Billing** separates the people who create resources from the money that pays for them. A **billing account** holds the payment method. **Projects** are linked to it, and every charge is attributed to the project that incurred it.'},
{svg:billing},
{h:'Billing roles'},
{t:[['Role','Can'],
['Billing Account Creator','Create new billing accounts (organization level)'],
['Billing Account Administrator','Manage the account, link and unlink projects, set budgets and payment settings'],
['Billing Account User','Link projects to the account without managing it'],
['Billing Account Viewer','View costs and usage'],
['Project Billing Manager','Link or unlink a specific project to a billing account']]},
{h:'Link and unlink'},
{code:`gcloud billing accounts list
gcloud billing projects link my-project --billing-account=0X0X0X-0X0X0X-0X0X0X
gcloud billing projects describe my-project
gcloud billing projects unlink my-project`},
{note:'A project with no billing account stops all paid services. Unlinking billing is the emergency brake, but it can break production, so use it deliberately.'},
{h:'Budgets and alerts'},
{p:'A **budget** compares spending to an amount you set. It can cover the whole account, selected projects, services or labels. It sends notifications when actual or **forecasted** spend crosses thresholds.'},
{code:`gcloud billing budgets create --billing-account=0X0X0X-0X0X0X-0X0X0X \\
  --display-name="Monthly learning budget" --budget-amount=100USD \\
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0`},
{ul:['Alerts go by email to billing admins, or to a Pub/Sub topic for automation.','A Pub/Sub message can trigger a function that disables billing or shuts down resources. You must build and test that yourself.','Budgets can lag the real usage by hours, so they are not a hard guard.']},
{h:'Payment profile and invoicing'},
{ul:['Self-serve accounts pay by card or bank debit, charged at thresholds or monthly.','Invoiced accounts are for larger customers and pay on terms.','Sub-accounts are used by resellers.']}],
src:[['Cloud Billing documentation',K.BILL],['Budgets and alerts',K.BILL+'budgets/set-budget']]};

/* ---------- 5 ---------- */
L['gcp:1:5']={blocks:[
{p:'Knowing what you spend is the first step of cost control. Google Cloud gives you reports in the console, detailed data in BigQuery, and automated recommendations.'},
{h:'Billing reports and cost tables'},
{ul:['**Reports** chart cost over time and group by project, service, SKU or label.','**Cost table** lists costs and credits for the chosen period.','**Cost breakdown** shows how discounts and credits affect the total.']},
{h:'Billing export to BigQuery'},
{p:'For analysis, export billing data to a BigQuery dataset. It records each usage line with its labels, project, SKU and credits, and can be queried with SQL.'},
{t:[['Export','Contents'],
['Standard usage cost','Daily cost data by project, service and SKU'],
['Detailed usage cost','Adds resource-level information such as VM name or bucket'],
['Pricing export','The list prices for your account']]},
{code:`SELECT service.description AS service, ROUND(SUM(cost), 2) AS cost
FROM \`my-billing-project.billing.gcp_billing_export_v1_XXXXXX\`
WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY service ORDER BY cost DESC LIMIT 10;`},
{h:'Discounts'},
{t:[['Discount','How it works'],
['Sustained use discount','Automatic discount on some VM families (for example N1, N2) the longer they run in a month. E2 does not have it'],
['Committed use discount (CUD)','Commit to a level of usage for 1 or 3 years for a lower price. Resource-based CUDs commit to specific vCPU and memory, spend-based (flexible) CUDs commit to an hourly spend across eligible products'],
['Spot VMs','Large discount for capacity that Google can reclaim'],
['Free tier and credits','Promotional credits appear as negative lines in the billing data']]},
{h:'Recommender and rightsizing'},
{p:'**Recommender** analyses usage and suggests actions. Examples: delete idle VMs and disks, resize over-provisioned VMs, remove unused IAM roles, buy commitments.'},
{code:`gcloud recommender recommendations list --project=my-project --location=us-central1-a \\
  --recommender=google.compute.instance.MachineTypeRecommender`},
{h:'A monthly cost review'},
{flow:['Open the report grouped by service and by project','Check any increase against labels and teams','Review idle and rightsizing recommendations','Check commitment coverage and Spot opportunities','Record actions with an owner and date']}],
src:[['Export Cloud Billing data to BigQuery',K.BILL+'export-data-bigquery'],['Recommender','https://cloud.google.com/recommender/docs/overview'],['Committed use discounts','https://cloud.google.com/docs/cuds']]};

/* ---------- 6 ---------- */
L['gcp:1:6']={blocks:[
{p:'**Cloud Asset Inventory** keeps a record of your Google Cloud resources and their IAM and organization policies across projects, folders and the organization. It answers questions such as "which buckets are public?" and "who has the Owner role anywhere?"'},
{h:'What it offers'},
{t:[['Capability','Use'],
['Search resources','Find resources by name, label, type or location across the organization'],
['Search IAM policies','Find which principals have which roles, including inherited ones'],
['Export','Write a snapshot of assets to BigQuery or Cloud Storage for analysis'],
['Feeds','Send a Pub/Sub message when an asset or policy changes'],
['History','Look back at the past 35 days of changes'],
['Policy analysis','Answer who can access a resource and what a principal can access']]},
{h:'Commands'},
{code:`gcloud asset search-all-resources --scope=organizations/987654321 --query="labels.env=prod AND assetType:storage.googleapis.com/Bucket"
gcloud asset search-all-iam-policies --scope=projects/my-project --query="policy:roles/owner"
gcloud asset export --project=my-project --content-type=resource --bigquery-table=projects/my-project/datasets/assets/tables/snapshot --output-bigquery-force
gcloud asset feeds create public-bucket-feed --project=my-project --content-type=iam-policy \\
  --asset-types=storage.googleapis.com/Bucket --pubsub-topic=projects/my-project/topics/asset-changes`},
{h:'Typical uses'},
{ul:['Security reviews: find external IPs, public buckets and powerful roles.','Audits: prove who had access to a resource on a given date.','Cost: find resources without required labels.','Inventory: keep a current list for a CMDB.']},
{note:'To search across the organization you need the right roles on the organization, such as Cloud Asset Viewer. The Cloud Asset API must be enabled in the project that makes the calls.'}],
src:[['Cloud Asset Inventory','https://cloud.google.com/asset-inventory/docs/overview'],['Searching resources','https://cloud.google.com/asset-inventory/docs/searching-resources']]};
})();
