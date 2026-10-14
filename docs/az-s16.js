/* LearnSphere - Azure Administrator, Section 16: Hybrid Management, Automation & Operations.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const sync=K.dg(700,220,[
[10,10,680,200,'Hybrid identity',1],
[30,60,170,80,'On-premises|Active Directory',0],[270,60,160,80,'Entra Connect or|Cloud Sync',2],[500,60,170,80,'Microsoft Entra ID|cloud identities',0]],
[[200,100,270,100],[430,100,500,100]]);

const arc=K.dg(700,240,[
[10,10,680,220,'Azure Arc brings outside machines into Azure management',1],
[30,60,170,60,'On-premises server',0],[30,135,170,60,'Other cloud VM',0],
[290,70,130,110,'Azure Resource|Manager|resource',2],
[500,45,170,40,'Policy and tags',0],[500,100,170,40,'Update Manager',0],[500,155,170,40,'Monitor and Defender',0]],
[[200,90,290,115],[200,165,290,145],[420,110,500,65],[420,125,500,120],[420,140,500,175]]);

const trouble=K.dg(700,220,[
[10,10,680,200,'A troubleshooting loop',1],
[30,60,110,70,'Define the|symptom',0],[170,60,110,70,'Check health|and changes',0],[310,60,110,70,'Isolate|layer',0],[450,60,110,70,'Fix and|verify',2],[590,60,80,70,'Document',0]],
[[140,95,170,95],[280,95,310,95],[420,95,450,95],[560,95,590,95]]);

/* ---------- 0 ---------- */
L['az:15:0']={blocks:[
{p:'Many organizations keep Active Directory on premises while using Azure. **Hybrid identity** synchronizes on-premises identities to Microsoft Entra ID so users have one identity for both.'},
{svg:sync},
{h:'Two tools'},
{t:[['','Microsoft Entra Connect Sync','Microsoft Entra Cloud Sync'],
['**Architecture**','Full sync engine on a server you run','Lightweight agents, configuration in the cloud'],
['**Best for**','Complex needs, device writeback, large filtering','Simple and multi-forest scenarios, easier setup'],
['**Management**','On the sync server','In the Entra admin center'],
['**Availability**','Staging server for failover','Multiple agents for redundancy']]},
{h:'Sign-in methods'},
{t:[['Method','How it works','Notes'],
['**Password hash sync**','A hash of the on-premises hash is synced','Simplest, no on-premises dependency at sign-in'],
['**Pass-through authentication**','Cloud validates against on-premises agents','Passwords never stored in the cloud'],
['**Federation (AD FS)**','Redirect to on-premises federation servers','Most complex, needed for special cases']]},
{note:'Synced users are managed on premises. Edit their attributes in Active Directory, and not in Entra ID.'}],
src:[['Hybrid identity',K.ENTRA+'identity/hybrid/whatis-hybrid-identity'],['Cloud Sync',K.ENTRA+'identity/hybrid/cloud-sync/what-is-cloud-sync']]};

/* ---------- 1 ---------- */
L['az:15:1']={blocks:[
{p:'**Azure Arc** projects resources that run outside Azure, such as on-premises servers and VMs in other clouds, into Azure Resource Manager as resources. You can then manage them with the same tools as Azure resources.'},
{svg:arc},
{h:'What you get'},
{ul:['An **ARM resource** in a resource group, with tags and RBAC.','**Azure Policy** and guest configuration to audit and enforce settings.','**Azure Monitor** and **Defender for Cloud** for monitoring and security.','**Update Manager** for patching.','**Managed identity** for the machine to authenticate to Azure.']},
{h:'Onboarding a server'},
{flow:['Create a resource group and a service principal or use interactive sign-in','Generate the onboarding script from the portal','Run it on the server to install the Connected Machine agent','The agent connects outbound over HTTPS to Azure','The server appears as a Machine - Azure Arc resource']},
{code:`# on the server, after the agent is installed
azcmagent connect --resource-group rg-arc --tenant-id <tenant-id> --subscription-id <sub-id> --location westeurope
azcmagent show`},
{note:'The agent needs only outbound HTTPS connectivity. Plan network rules and proxies, and review costs of extensions you enable.'}],
src:[['Azure Arc overview',K.D+'azure-arc/overview'],['Arc-enabled servers',K.D+'azure-arc/servers/overview']]};

/* ---------- 2 ---------- */
L['az:15:2']={blocks:[
{p:'**Azure Update Manager** assesses and installs operating system updates on Azure VMs and Arc-enabled servers, for Windows and Linux, from one place.'},
{h:'Main capabilities'},
{t:[['Capability','Meaning'],
['**Periodic assessment**','Scans machines and lists missing updates'],
['**One-time update**','Install updates now on selected machines'],
['**Schedules**','Maintenance configurations that run on a recurring window'],
['**Patch orchestration**','Rules for how Azure VMs are patched, such as Azure-orchestrated or manual']]},
{flow:['Enable periodic assessment through policy or the portal','Review missing updates and compliance','Create a maintenance configuration with a window and classifications','Assign machines by subscription, tags or location','Check the history and results after the window']},
{code:`az maintenance configuration create -g rg-ops -n patch-sunday --maintenance-scope InGuestPatch --maintenance-window-start-date-time "2026-11-01 02:00" --maintenance-window-duration "03:00" --maintenance-window-recur-every "Week Sunday" --maintenance-window-time-zone "W. Europe Standard Time" --extension-properties InGuestPatchMode=User`},
{note:'Update Manager replaced the older Update Management in Automation accounts, which was retired in 2024. Plan any remaining migration.'}],
src:[['Azure Update Manager',K.D+'update-manager/overview']]};

/* ---------- 3 ---------- */
L['az:15:3']={blocks:[
{p:'**Azure Automation** runs scripts called **runbooks** on a schedule or on demand, in the cloud or on machines you control, without you hosting a server.'},
{h:'Parts'},
{t:[['Part','Role'],
['**Automation account**','Container for runbooks, schedules, variables, credentials and identity'],
['**Runbook**','A PowerShell, Python or graphical script'],
['**Schedule**','When a runbook runs'],
['**Managed identity**','The identity runbooks use to call Azure with no stored secret'],
['**Hybrid Runbook Worker**','Runs runbooks on your own machines for on-premises or private targets'],
['**Webhook**','Starts a runbook from an HTTP call']]},
{code:`# Runbook using the account managed identity
Connect-AzAccount -Identity
$vms = Get-AzVM -Status | Where-Object { $_.Tags['autoshutdown'] -eq 'true' -and $_.PowerState -eq 'VM running' }
foreach ($vm in $vms) { Stop-AzVM -Name $vm.Name -ResourceGroupName $vm.ResourceGroupName -Force }`},
{ul:['Grant the account identity the minimum role it needs at the narrowest scope.','Use **variables and encrypted values** instead of hard-coded secrets.','Monitor **job status** and alert on failures.']},
{note:'Compare with Logic Apps or Functions: Automation fits operational scripts, whereas those suit event-driven integration and application code.'}],
src:[['Azure Automation',K.D+'automation/overview']]};

/* ---------- 4 ---------- */
L['az:15:4']={blocks:[
{p:'**Azure Migrate** is the hub for discovering, assessing and moving servers, databases and applications to Azure.'},
{flow:['Create an Azure Migrate project','Deploy the Azure Migrate appliance on premises','Discover servers and their dependencies','Assess readiness, right-size and estimate cost','Replicate and migrate the servers','Cut over, test and decommission the source']},
{h:'Components'},
{t:[['Tool','Purpose'],
['**Discovery and assessment**','Inventory, readiness, sizing and cost estimates'],
['**Server migration**','Replicate VMware, Hyper-V and physical servers to Azure'],
['**Dependency analysis**','Find which servers talk to each other so you move them together'],
['**Database and web app tools**','Specialized assessments for SQL and web apps']]},
{h:'Migration strategies'},
{t:[['Strategy','Meaning'],
['**Rehost**','Lift and shift to IaaS VMs'],
['**Replatform**','Move to PaaS with small changes'],
['**Refactor**','Change the application to use cloud-native services']]},
{note:'Always assess before migrating. Right-sizing from performance data usually reduces cost compared with copying on-premises sizes.'}],
src:[['Azure Migrate',K.D+'migrate/migrate-services-overview']]};

/* ---------- 5 ---------- */
L['az:15:5']={blocks:[
{p:'When something is wrong, first find out whether **Azure** is the cause. Three tools answer that and help you reach Microsoft support.'},
{t:[['Tool','Scope','Tells you'],
['**Azure Service Health**','Your subscriptions and regions','Outages, planned maintenance and health advisories affecting your services'],
['**Resource Health**','One resource','Whether Azure platform issues affect this resource now or recently'],
['**Azure status**','Global','Public status of Azure services']]},
{h:'Alerts for health'},
{p:'Create **service health alerts** for your subscriptions, regions and services, and send them to an action group, so you hear about issues before users do.'},
{h:'Support requests'},
{ul:['Create one from **Help + support** with problem type, severity and contact details.','Choose a severity that matches business impact: **A** critical, **B** moderate, **C** minimal. Response times depend on your support plan.','Include resource IDs, time ranges, error messages and what you have already tried.']},
{code:`az support tickets list -o table
az resource show --ids <resource-id> --query "properties" -o json`},
{note:'Billing and subscription support is free for all customers. Technical support needs a paid plan.'}],
src:[['Service Health',K.D+'service-health/overview'],['Create a support request',K.D+'azure-portal/supportability/how-to-create-azure-support-request']]};

/* ---------- 6 ---------- */
L['az:15:6']={blocks:[
{p:'A repeatable method beats guesswork. Work from the outside in, one layer at a time.'},
{svg:trouble},
{flow:['State exactly what fails, for whom, since when, and the exact error','Check Service Health and Resource Health for platform events','Check the activity log for recent changes and deployments','Check configuration: identity and RBAC, policy, locks, quotas','Check the network: NSG, routes, DNS, firewall, load balancer','Check the guest or app logs and metrics','Fix one thing at a time and verify, then document']},
{h:'Questions that narrow it down'},
{t:[['Question','Points to'],
['Did it ever work?','Configuration versus a regression'],
['What changed?','Activity log, deployments, policy'],
['Does it fail for everyone?','Platform or global settings'],
['Does it fail from one place?','Network path, firewall, DNS'],
['Is the error an HTTP or authorization code?','Identity, RBAC, keys, firewall']]},
{note:'Capture the correlation ID or request ID from errors. Support and logs can find the exact operation with it.'}],
src:[['Troubleshooting overview',K.D+'azure-resource-manager/troubleshooting/overview']]};

/* ---------- 7 ---------- */
L['az:15:7']={blocks:[
{p:'Some failures appear again and again. Learn to recognize their messages.'},
{t:[['Error or symptom','Cause','Fix'],
['`QuotaExceeded` or `OperationNotAllowed` core limit','Subscription quota for the region or family reached','Request a quota increase, or use another size or region'],
['`SkuNotAvailable`','Size not available in the region or zone for the subscription','Choose another size, zone or region'],
['`RequestDisallowedByPolicy`','An Azure Policy denies the request','Read the policy name, comply, or request an exemption'],
['`AuthorizationFailed`','The identity lacks the RBAC action at that scope','Assign a suitable role at the right scope'],
['`ScopeLocked`','A resource lock blocks the change','Remove the lock after review, then restore it'],
['`MissingSubscriptionRegistration`','Resource provider not registered','Register the provider'],
['`StorageAccountAlreadyTaken`','Global name conflict','Choose another name'],
['`AnotherOperationInProgress`','Another operation is running on the resource','Wait or cancel it']]},
{h:'Finding the details'},
{code:`az deployment group show -g rg-app -n <deployment> --query properties.error
az deployment operation group list -g rg-app -n <deployment> --query "[?properties.provisioningState=='Failed'].properties.statusMessage"
az monitor activity-log list --resource-group rg-app --status Failed --max-events 20`},
{note:'Read the whole error. It usually names the exact property, policy or limit that caused it.'}],
src:[['Common deployment errors',K.ARM+'troubleshooting/common-deployment-errors']]};

/* ---------- 8 ---------- */
L['az:15:8']={blocks:[
{p:'Practice with break/fix scenarios. For each, follow the troubleshooting method before changing anything.'},
{t:[['Scenario','Introduced fault','What to find'],
['VM unreachable','NSG rule denies port 22 or 3389','Effective security rules or IP flow verify'],
['Deployment fails','Policy denies the location','RequestDisallowedByPolicy in deployment errors'],
['User cannot change a resource','Only Reader assigned at that scope','Check access and role assignments'],
['Cannot delete a group','CanNotDelete lock on a resource inside','Locks blade'],
['Website unreachable via load balancer','Health probe path wrong','Probe status and backend health'],
['Storage access denied from a VM','Firewall allows a different subnet','Network rules and service endpoints']]},
{flow:['Pick a scenario and introduce the fault in a lab','Write down the symptom and the exact message','Use the tools to locate the cause','Fix and verify','Write what you would add to monitoring or policy to prevent it']},
{note:'Create the faults in a separate resource group. After finishing, reset and delete everything to avoid leaving locks or policy changes.'}],
src:[['Azure troubleshooting documentation',K.D+'azure-resource-manager/troubleshooting/overview']]};

})();
