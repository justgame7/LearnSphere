/* LearnSphere - Azure Administrator, Section 05: Governance, Subscriptions & Cost Management.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const mg=K.dg(700,300,[
[10,10,680,280,'A management group hierarchy',1],
[255,35,190,36,'Tenant root group',2],
[90,105,160,36,'MG Platform',0],[450,105,160,36,'MG Landing zones',0],
[30,175,130,36,'Sub: connectivity',0],[180,175,130,36,'Sub: identity',0],[390,175,130,36,'Sub: prod apps',0],[540,175,130,36,'Sub: dev apps',0]],
[[350,71,170,105],[350,71,530,105],[170,141,95,175],[170,141,245,175],[530,141,455,175],[530,141,605,175]]);

const pol=K.dg(700,220,[
[10,10,680,200,'How Azure Policy evaluates',1],
[25,70,120,70,'Definition|the rule',0],[170,70,120,70,'Assignment|rule at a scope',2],[315,70,120,70,'Resource|created or|changed',0],[460,70,100,70,'Effect|deny, audit,|modify...',0],[585,70,90,70,'Compliance|result',0]],
[[145,105,170,105],[290,105,315,105],[435,105,460,105],[560,105,585,105]]);

/* ---------- 0 ---------- */
L['az:4:0']={blocks:[
{p:'A **resource group** is a container for resources that share a lifecycle: they are deployed, updated and deleted together. A good design makes access, cost tracking and cleanup easy.'},
{h:'Design guidance'},
{ul:['Group by **lifecycle and ownership**: one application and one environment per group, such as `rg-shop-prod`.','Put resources that are deleted together in the same group.','Do not put resources of different owners in one group.','Remember that the group **location** only stores metadata. If that region is unavailable, you cannot manage the group metadata, though running resources continue.']},
{h:'Naming conventions'},
{p:'Use a consistent pattern so names are readable and sortable, for example `<type>-<workload>-<environment>-<region>-<instance>`.'},
{t:[['Resource','Example'],
['Resource group','`rg-shop-prod-weu-001`'],
['Virtual network','`vnet-shop-prod-weu-001`'],
['Storage account','`stshopprodweu001` (lowercase letters and digits only, 3-24 characters)'],
['Key Vault','`kv-shop-prod-weu-001`']]},
{h:'Moving resources'},
{p:'Resources can be moved between resource groups and subscriptions, but not every type supports it. The **resource ID changes**, and both source and target groups are **locked for writes** during the move.'},
{code:`az resource move --destination-group rg-new --ids <resource-id>
az resource move --destination-group rg-new --destination-subscription-id <sub-id> --ids <resource-id>`},
{note:'You can move a resource to a different region only for a subset of services, using Azure Resource Mover or by re-creating it. A resource group move does not change region.'}],
src:[['Manage resource groups',K.ARM+'management/manage-resource-groups-portal'],['Move resources',K.ARM+'management/move-resource-group-and-subscription'],['Naming conventions',K.CAF+'ready/azure-best-practices/resource-naming']]};

/* ---------- 1 ---------- */
L['az:4:1']={blocks:[
{p:'A **subscription** is both a **billing boundary** and a **limits boundary**. It is where resources are created and where costs are accumulated.'},
{h:'What a subscription provides'},
{ul:['An invoice scope and cost tracking.','Quotas and service limits, for example a number of cores per region.','An access scope for RBAC and policy.','An isolation unit for environments, teams or regulatory zones.']},
{h:'Offer types'},
{t:[['Offer','For'],
['Free trial','Learning, with credit and time limit'],
['Pay-as-you-go','Individuals and small teams, billed monthly'],
['Enterprise Agreement and Microsoft Customer Agreement','Organizations with commitments and account hierarchy'],
['Cloud Solution Provider (CSP)','Resold and managed by a partner'],
['Visual Studio / dev-test','Developer benefits and lower rates for non-production']]},
{h:'States'},
{t:[['State','Meaning'],
['Enabled','Normal'],
['Warned','Past due or expiring, resources still run'],
['Disabled','Read-only or stopped, depending on cause'],
['Deleted','Removed after cancellation and a retention period']]},
{h:'Transfers'},
{ul:['**Billing ownership** can be transferred to another account.','**Directory** (tenant) can be changed. Role assignments and some features do not move over, so plan it.','**Transferring** resources between subscriptions uses resource move.']},
{p:'When quotas or requirements differ by team or environment, a **separate subscription** is the cleanest boundary.'}],
src:[['Azure subscription and service limits',K.ARM+'management/azure-subscription-service-limits'],['Transfer billing ownership',K.D+'cost-management-billing/manage/billing-subscription-transfer']]};

/* ---------- 2 ---------- */
L['az:4:2']={blocks:[
{p:'**Management groups** organize subscriptions into a hierarchy so you can apply **policy and access once** at a higher level and have it inherited.'},
{svg:mg},
{h:'Facts'},
{ul:['Every tenant has a **root management group**. All subscriptions and groups sit under it.','A hierarchy supports up to **six levels** under the root.','A management group or subscription has **one parent**.','Policy and RBAC assigned to a management group flow down to everything in it.','By default, new subscriptions are placed in the root or a default group you configure.']},
{h:'Working with them'},
{code:`az account management-group create --name mg-platform --display-name "Platform"
az account management-group subscription add --name mg-platform --subscription <sub-id>
az account management-group list -o table
az account management-group show --name mg-platform --expand --recurse`},
{h:'Design principles'},
{ul:['Group by **governance needs**, not by company organization chart.','Keep the hierarchy shallow and stable.','Use a sandbox group for experiments with weaker rules but strong cost limits.','Apply broad policy at the top (allowed regions), specific at lower levels.']},
{note:'Only users with elevated access can see the full tenant hierarchy at first. A Global Administrator can elevate access to manage the root group.'}],
src:[['Management groups overview',K.D+'governance/management-groups/overview']]};

/* ---------- 3 ---------- */
L['az:4:3']={blocks:[
{p:'**Tags** are name-value pairs attached to resources, resource groups and subscriptions. They make cost, ownership and automation easier to manage across the estate.'},
{h:'Typical tag set'},
{t:[['Tag','Example','Used for'],
['`owner`','`sam@contoso.com`','Who to contact'],
['`costcenter`','`CC-1042`','Chargeback and cost analysis'],
['`environment`','`prod`','Filtering and policies'],
['`application`','`shop`','Grouping resources of a workload'],
['`expiry`','`2026-12-31`','Cleanup of temporary resources']]},
{h:'Behavior to know'},
{ul:['Tags are **not inherited** by default. A tag on a resource group does not appear on its resources.','Tag **names** are case-insensitive and **values** are case-sensitive.','Up to **50 tag pairs** can be applied to a resource, resource group or subscription.','Not all resource types support tags, and some tags do not show in billing data.']},
{h:'Applying and enforcing'},
{code:`az tag create --resource-id /subscriptions/<sub>/resourceGroups/rg-app --tags owner=sam environment=prod
az tag update --resource-id <resource-id> --operation merge --tags costcenter=CC-1042
az resource list --tag environment=prod -o table`},
{p:'Use **Azure Policy** to require tags on creation and to **inherit** a tag from the resource group or subscription, so tagging is automatic.'},
{note:'Tags are metadata, not security. Do not store secrets in them, since anyone with read access can see them.'}],
src:[['Tag resources',K.ARM+'management/tag-resources'],['Tag policies',K.POLICY+'tutorials/govern-tags']]};

/* ---------- 4 ---------- */
L['az:4:4']={blocks:[
{p:'**Azure Policy** evaluates your resources against rules and either reports non-compliance or blocks and fixes it. Where RBAC answers "who can act", Policy answers "**what is allowed to exist**".'},
{svg:pol},
{h:'Building blocks'},
{t:[['Term','Meaning'],
['**Definition**','A rule: a condition (if) and an effect (then)'],
['**Initiative**','A set of definitions managed as one'],
['**Assignment**','A definition or initiative applied to a scope, with parameters'],
['**Exemption**','A permitted exception for a scope or resource'],
['**Compliance**','The evaluated result for each resource']]},
{h:'Effects'},
{t:[['Effect','Behavior'],
['**Deny**','Blocks creation or update that violates the rule'],
['**Audit**','Allows it and marks it non-compliant'],
['**Append**','Adds fields to the request, such as tags'],
['**Modify**','Adds, updates or removes properties and tags, can remediate existing resources'],
['**DeployIfNotExists**','Deploys a related resource if missing, such as diagnostics'],
['**AuditIfNotExists**','Audits when a related resource is missing'],
['**Disabled**','Turns the rule off']]},
{code:`{
  "if": {
    "not": { "field": "location", "in": "[parameters('allowedLocations')]" }
  },
  "then": { "effect": "deny" }
}`},
{code:`az policy definition list --query "[?displayName=='Allowed locations'].name" -o tsv
az policy assignment create --name allowed-loc --display-name "Allowed locations" --policy <definition-name> --scope /subscriptions/<sub> --params '{"listOfAllowedLocations":{"value":["westeurope","northeurope"]}}'`},
{note:'Policy evaluates on create, update, and in a full scan roughly every 24 hours. A new assignment does not delete existing resources, it reports them.'}],
src:[['Azure Policy overview',K.POLICY+'overview'],['Policy effects',K.POLICY+'concepts/effects']]};

/* ---------- 5 ---------- */
L['az:4:5']={blocks:[
{p:'After assigning a policy, you read **compliance** and, for some effects, **remediate** resources that already exist.'},
{h:'Reading compliance'},
{ul:['Policy blade, **Compliance**, shows the percentage and the list of non-compliant resources per assignment.','Open a resource to see **why** it is non-compliant, including the evaluated field and value.','A resource can be compliant, non-compliant, exempt, or not started when evaluation has not run.']},
{code:`az policy state list --resource-group rg-app --filter "complianceState eq 'NonCompliant'" -o table
az policy state summarize --resource-group rg-app
az policy state trigger-scan --resource-group rg-app`},
{h:'Remediation'},
{p:'Policies with **Modify** or **DeployIfNotExists** can fix existing resources through a **remediation task**. The task uses a **managed identity** on the assignment, which needs the roles required to make the change.'},
{flow:['Assign the policy with a managed identity','Grant the identity the needed role at the scope','Wait for or trigger evaluation','Create a remediation task for non-compliant resources','Review the task result and recheck compliance']},
{code:`az policy remediation create --name fix-tags --policy-assignment <assignment-id> --resource-group rg-app`},
{note:'Deny and Audit cannot remediate. Deny prevents new violations only, and existing non-compliant resources stay as they are until changed.'}],
src:[['Remediate non-compliant resources',K.POLICY+'how-to/remediate-resources'],['Get compliance data',K.POLICY+'how-to/get-compliance-data']]};

/* ---------- 6 ---------- */
L['az:4:6']={blocks:[
{p:'A **resource lock** prevents accidental deletion or modification of a resource, resource group or subscription, **regardless of RBAC role**. Even an Owner is blocked until the lock is removed.'},
{t:[['Lock','Prevents','Still allows'],
['**CanNotDelete**','Deleting','Reading and modifying'],
['**ReadOnly**','Deleting and modifying','Reading only']]},
{h:'Behavior'},
{ul:['Locks are **inherited** by child resources.','Only users with `Microsoft.Authorization/locks/*` rights, such as Owner or User Access Administrator, can create or remove locks.','Locks apply to **control plane** operations, not data inside a service.','A lock on a resource group also covers resources added to it later, because the lock is inherited.']},
{code:`az lock create --name keep --lock-type CanNotDelete --resource-group rg-prod
az lock list --resource-group rg-prod -o table
az lock delete --name keep --resource-group rg-prod`},
{h:'Gotchas'},
{t:[['Situation','Effect'],
['ReadOnly on a storage account','Listing keys fails, because it is a POST action'],
['ReadOnly on an App Service plan','Scaling is blocked'],
['ReadOnly on a resource group','New resources cannot be created inside it'],
['CanNotDelete on a VM, delete the group','The group delete fails until the lock is removed']]},
{note:'Use CanNotDelete for production resources and test ReadOnly carefully. A lock does not replace backups or access control, it only prevents accidents.'}],
src:[['Lock your resources',K.ARM+'management/lock-resources']]};

/* ---------- 7 ---------- */
L['az:4:7']={blocks:[
{p:'**Cost Management** helps you see where money goes, set limits and act on savings. Three tools cover most administrator work.'},
{h:'Budgets and alerts'},
{ul:['Create a **budget** at a management group, subscription or resource group scope, for a month, quarter or year.','Define **alert thresholds** on actual or forecasted cost, such as 80 and 100 percent.','Alerts go to an **action group** or email. A budget does not stop resources by itself.']},
{h:'Cost analysis'},
{t:[['Group by','Answers'],
['Resource group or service','Which workload or service costs the most'],
['Tag','Which team or cost center spends'],
['Location','Is spend concentrated in an expensive region'],
['Meter','What kind of usage creates the cost']]},
{h:'Azure Advisor'},
{p:'**Advisor** gives personalized recommendations across **cost, security, reliability, operational excellence and performance**. Cost recommendations include right-sizing or shutting down underused VMs and buying reservations.'},
{code:`az advisor recommendation list --category Cost -o table
az costmanagement export list --scope /subscriptions/<sub-id>`},
{t:[['Action','Saves'],
['Delete unattached disks and unused public IPs','Immediate'],
['Right-size VMs with low CPU','Ongoing'],
['Auto-shutdown for non-production','Ongoing'],
['Reservations or savings plans for steady use','Commitment discount']]},
{note:'Cost data can be delayed by several hours and tags only help if applied. Fix tagging early so reports are trustworthy later.'}],
src:[['Cost Management',K.D+'cost-management-billing/costs/'],['Azure Advisor',K.D+'advisor/advisor-overview']]};

/* ---------- 8 ---------- */
L['az:4:8']={blocks:[
{p:'In this practical you turn a plain subscription into a **governed** one by combining the controls from this section.'},
{flow:['Create a management group and move the lab subscription into it','Assign a policy that restricts allowed locations','Assign a policy that requires an owner tag','Create a resource group and a resource, and test the policies','Add a CanNotDelete lock to the production group','Create a budget with alerts']},
{code:`az account management-group create --name mg-lab
az account management-group subscription add --name mg-lab --subscription <sub-id>

az policy assignment create --name allowed-loc --scope /providers/Microsoft.Management/managementGroups/mg-lab --policy e56962a6-4747-49cd-b67b-bf8b01975c4c --params '{"listOfAllowedLocations":{"value":["westeurope"]}}'

az group create --name rg-gov --location westeurope --tags owner=sam
az group create --name rg-denied --location eastus      # expected: denied by policy
az lock create --name nodelete --lock-type CanNotDelete --resource-group rg-gov`},
{h:'Verify'},
{t:[['Test','Expected'],
['Create a group in eastus','Rejected with a RequestDisallowedByPolicy error'],
['Create a resource without owner tag','Rejected or reported by the tag policy'],
['Delete rg-gov','Rejected by the lock'],
['Budget alert','Appears in Cost Management']]},
{note:'The policy ID above is the built-in definition named Allowed locations. Confirm it in your tenant with `az policy definition list` before use.'}],
src:[['Azure governance',K.D+'governance/']]};

})();
