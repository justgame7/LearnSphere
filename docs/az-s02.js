/* LearnSphere - Azure Administrator, Section 02: Lab Setup, Tools & Management Interfaces.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const lab=K.dg(700,200,[
[10,10,680,180,'A safe lab routine',1],
[25,60,100,60,'Budget and|alert first',2],[145,60,100,60,'One resource|group per lab',0],[265,60,100,60,'Tag owner|and expiry',0],[385,60,100,60,'Build and|learn',0],[505,60,80,60,'Delete the|group',0],[600,60,80,60,'Check the|bill',0]],
[[125,90,145,90],[245,90,265,90],[365,90,385,90],[485,90,505,90],[585,90,600,90]]);

const tools=K.dg(700,220,[
[10,10,680,200,'Four ways to manage the same resource',1],
[30,50,130,45,'Portal',0],[30,110,130,45,'Cloud Shell',0],[30,160,130,35,'CLI and PowerShell',0],
[260,70,150,80,'Azure Resource|Manager',2],
[520,70,140,80,'Your resources',0]],
[[160,72,260,100],[160,132,260,110],[160,178,260,125],[410,110,520,110]]);

/* ---------- 0: Lab safety ---------- */
L['az:1:0']={blocks:[
{p:'Before you build anything, set up a lab environment that **cannot surprise you with a bill**. This lecture is the safety routine used in every later lab.'},
{svg:lab},
{h:'Create the lab subscription'},
{ul:['Use a **free account** or a visual studio or pay-as-you-go subscription that you control.','Use a separate subscription, or at least a separate resource group, for each lab.','Never run experiments in a subscription that holds production resources.']},
{h:'Set a budget first'},
{p:'A **budget** in Cost Management tracks spend against an amount and sends alerts at thresholds you choose. It does not stop spending by itself, so combine it with cleanup.'},
{code:`az consumption budget create-with-rg --help   # budget at resource group scope
# Portal path: Cost Management + Billing > Cost Management > Budgets > Add`},
{t:[['Control','What it does','Stops spend?'],
['Budget alert','Emails at 50, 80 and 100 percent','No'],
['Spending limit (free account)','Disables resources when credit runs out','Yes'],
['Resource group delete','Removes everything inside','Yes'],
['Auto-shutdown on VMs','Deallocates at a set time','Reduces']]},
{h:'Know your quotas'},
{p:'Each subscription has **quotas** per region, such as vCPU cores per VM family. A new account has low limits. If a deployment fails with a quota error, request an increase in **Usage + quotas**.'},
{code:`az vm list-usage --location eastus -o table`},
{h:'Clean up routine'},
{flow:['Put every lab in its own resource group','Tag the group with owner and an expiry date','When finished, delete the resource group','Confirm in the Cost analysis view that nothing is still running']},
{note:'Public IPs, disks and Premium storage cost money even when a VM is stopped. Deleting the resource group is the only reliable cleanup.'}],
src:[['Azure free account','https://azure.microsoft.com/en-us/free/'],['Tutorial: create and manage budgets',K.D+'cost-management-billing/costs/tutorial-acm-create-budgets']]};

/* ---------- 1: Portal ---------- */
L['az:1:1']={blocks:[
{p:'The **Azure portal** at portal.azure.com is the web console for all Azure services. It is the easiest way to explore, and every action in it is an ARM request you can later repeat with a script.'},
{h:'Parts of the portal'},
{t:[['Part','Use'],
['**Search bar** (top)','Find services, resources, documentation and resource groups by name'],
['**Home** and **All resources**','Recent resources and a filtered list of every resource you can see'],
['**Resource group** view','Everything in one group, with deployments, locks and costs'],
['**Resource blade**','Settings, networking, monitoring, access control and more for one resource'],
['**Notifications** (bell)','Status of running and finished operations'],
['**Directories + subscriptions**','Switch tenant and choose which subscriptions are shown'],
['**Dashboards**','Custom pinned tiles of metrics, queries and resources']]},
{h:'The blades you will use constantly'},
{ul:['**Overview**: status, essentials and quick actions.','**Access control (IAM)**: role assignments and check access.','**Activity log**: who did what to this resource.','**Diagnostic settings** and **Metrics**: monitoring.','**Tags**, **Locks** and **Properties**.','**Export template** and **Automation**: get the ARM template of what exists.']},
{h:'Efficiency tips'},
{ul:['Use the filter box and saved **favorites** in the left menu.','The **filter by subscription** setting hides subscriptions you are not using.','Open **JSON view** on a resource to see the exact ARM definition.','Use **Cloud Shell** from the top bar when a command is quicker than clicking.']},
{note:'If you cannot see a subscription or resource, check the directory and subscription filter first, then your role assignments. Both are common causes.'}],
src:[['Azure portal overview',K.D+'azure-portal/azure-portal-overview']]};

/* ---------- 2: Cloud Shell ---------- */
L['az:1:2']={blocks:[
{p:'**Azure Cloud Shell** is an authenticated shell that runs in your browser or in a terminal app. It comes with Azure CLI, Azure PowerShell, Terraform, kubectl, git and editors already installed, and it is already signed in as you.'},
{h:'Bash or PowerShell'},
{t:[['Experience','Typical use'],
['**Bash**','Azure CLI (`az`), Linux tools, scripts'],
['**PowerShell**','Az cmdlets, objects and pipeline, plus the `az` CLI too']]},
{h:'Storage and persistence'},
{p:'The shell itself is a temporary container that ends after about 20 minutes idle. To keep your files, Cloud Shell mounts an **Azure Files share** from a storage account you choose or let it create. Your home directory `$HOME` keeps a 5 GB disk image on that share, and `clouddrive` points directly at the share.'},
{code:`# Bash
ls $HOME
ls ~/clouddrive
az account show -o table`},
{t:[['Option','Result'],
['Mounted storage','Files persist between sessions. A storage account exists and can cost a little'],
['Ephemeral session','No storage account. Files are lost when the session ends']]},
{h:'Things to know'},
{ul:['It is a **per-user** shell. Your Azure role assignments decide what you can do.','The tools are kept up to date for you, so versions may be newer than your laptop.','You can upload and download files from the shell toolbar, and use the built-in editor.','A private network scenario is possible with Cloud Shell in a virtual network.']}],
src:[['Azure Cloud Shell overview',K.D+'cloud-shell/overview'],['Persist files in Cloud Shell',K.D+'cloud-shell/persisting-shell-storage']]};

/* ---------- 3: CLI ---------- */
L['az:1:3']={blocks:[
{p:'The **Azure CLI** (`az`) is a cross-platform command-line tool. Commands are grouped by service and follow the pattern `az <group> <subgroup> <command> --parameters`.'},
{h:'Sign in and choose a subscription'},
{code:`az login                          # opens a browser
az login --use-device-code        # for headless machines
az account list -o table
az account set --subscription "My Subscription"
az account show`},
{p:'Commands run against the **current subscription**. Many mistakes are created by running a correct command in the wrong subscription, so check `az account show` before changes.'},
{h:'Output formats'},
{t:[['Flag','Format','Best for'],
['`-o json`','Full JSON (default)','Reading all properties'],
['`-o table`','Readable table of selected columns','Quick views'],
['`-o tsv`','Tab-separated, no quotes','Assigning to shell variables'],
['`-o yaml`','YAML','Readable nested output'],
['`-o none`','No output','Quiet scripts']]},
{h:'Filtering with `--query`'},
{p:'`--query` takes a **JMESPath** expression and runs on the client after the response arrives.'},
{code:`az vm list --query "[].{name:name, rg:resourceGroup, size:hardwareProfile.vmSize}" -o table
az group list --query "[?location=='westeurope'].name" -o tsv
az storage account list --query "length(@)"`},
{h:'Useful habits'},
{ul:['Use `--help` at any level: `az vm --help`, `az vm create --help`.','Use `az find "keyword"` to discover commands.','Use `--no-wait` to start long operations and continue.','Set defaults with `az config set defaults.group=rg-lab defaults.location=westeurope`.','Use `az interactive` for autocomplete and descriptions.']}],
src:[['Azure CLI documentation',K.CLI],['Query output with JMESPath',K.CLI+'query-azure-cli']]};

/* ---------- 4: PowerShell ---------- */
L['az:1:4']={blocks:[
{p:'**Azure PowerShell** is the `Az` module for PowerShell 7 and Windows PowerShell 5.1. Cmdlets follow **Verb-Noun** naming, with an `Az` prefix, and they return **objects** you can pipe.'},
{h:'Install, connect and select a subscription'},
{code:`Install-Module -Name Az -Scope CurrentUser -Repository PSGallery
Connect-AzAccount
Get-AzSubscription
Set-AzContext -Subscription "My Subscription"
Get-AzContext`},
{h:'Common cmdlets'},
{t:[['Task','Cmdlet'],
['List resource groups','`Get-AzResourceGroup`'],
['Create a resource group','`New-AzResourceGroup -Name rg-lab -Location westeurope`'],
['List VMs','`Get-AzVM`'],
['Start or stop a VM','`Start-AzVM`, `Stop-AzVM`'],
['Remove a resource group','`Remove-AzResourceGroup -Name rg-lab -Force`'],
['List a provider resources','`Get-AzResource -ResourceType Microsoft.Storage/storageAccounts`']]},
{h:'The pipeline'},
{code:`Get-AzVM | Where-Object { $_.Location -eq 'westeurope' } |
  Select-Object Name, ResourceGroupName, @{n='Size';e={$_.HardwareProfile.VmSize}}

Get-AzResourceGroup | Where-Object { $_.Tags.owner -eq 'sam' } | Remove-AzResourceGroup -Force`},
{h:'CLI or PowerShell?'},
{t:[['','Azure CLI','Azure PowerShell'],
['Style','Commands and JSON text','Cmdlets and objects'],
['Shell','Any shell','PowerShell'],
['Best for','Linux and quick scripts','Windows and object pipelines'],
['Skill','Pick whichever your team already uses. Both call the same ARM APIs','']]},
{note:'Use `-WhatIf` and `-Confirm` on cmdlets that change things to preview or confirm the action.'}],
src:[['Azure PowerShell documentation',K.PS],['Get started with Azure PowerShell',K.PS+'get-started-azureps']]};

/* ---------- 5: Mandatory MFA ---------- */
L['az:1:5']={blocks:[
{p:'Microsoft is enforcing **multifactor authentication (MFA)** for Azure management. This affects how people sign in and how automation authenticates, so every administrator needs to understand it.'},
{h:'What is enforced and where'},
{t:[['Phase','Applies to','What changes'],
['**Phase 1**','Azure portal, Microsoft Entra admin center, Intune admin center','Users signing in must complete MFA'],
['**Phase 2**','Azure CLI, Azure PowerShell, Azure mobile app, REST API, SDKs, infrastructure-as-code tools','MFA required for user sign-ins that create, update or delete resources']]},
{p:'Enforcement is applied to **user identities**, in a gradual rollout. Read operations are not affected by phase 2 in the same way. Check the announcement for the exact schedule that applies to your tenant.'},
{h:'What is not affected'},
{ul:['**Workload identities**: managed identities and service principals.','Applications that sign in with their own credentials rather than a person.']},
{h:'What to change'},
{t:[['Situation','Action'],
['Admin signs in interactively','Register an MFA method such as Microsoft Authenticator or a passkey'],
['Script uses a personal account password','Replace with a managed identity or service principal'],
['Pipeline uses a user account','Use a service connection with workload identity federation'],
['Break-glass accounts','Do not exclude them. Use phishing-resistant methods such as FIDO2 keys']]},
{code:`# Automation without a user: managed identity on an Azure resource
az login --identity

# Service principal for a pipeline (prefer federated credentials)
az login --service-principal -u <app-id> --tenant <tenant-id> --federated-token <token>`},
{note:'A script that worked with a user name and password and then fails with an MFA error needs a non-human identity, not an exclusion from MFA.'}],
src:[['Mandatory MFA for Azure',K.D+'azure-portal/mandatory-multifactor-authentication']]};

/* ---------- 6: Practical ---------- */
L['az:1:6']={blocks:[
{p:'In this practical you create, inspect, tag and delete the same resource group three ways: in the portal, with the CLI and with PowerShell. The aim is to see that all three produce identical results.'},
{h:'Steps'},
{flow:['Sign in and confirm the subscription','Create a resource group','Tag it with owner and purpose','List it and read its tags','Delete it and confirm it is gone']},
{h:'Portal'},
{ul:['Search **Resource groups**, choose **Create**, pick your subscription and a name such as `rg-lab-portal`.','On the **Tags** tab add `owner` and `purpose=lab`.','Create, then open the group and read **Overview**.','Delete with **Delete resource group** and type the name to confirm.']},
{h:'Azure CLI'},
{code:`az account show -o table
az group create --name rg-lab-cli --location westeurope --tags owner=sam purpose=lab
az group show --name rg-lab-cli --query "{name:name, tags:tags}" -o json
az group list --tag purpose=lab -o table
az group delete --name rg-lab-cli --yes --no-wait`},
{h:'Azure PowerShell'},
{code:`Get-AzContext
New-AzResourceGroup -Name rg-lab-ps -Location westeurope -Tag @{ owner='sam'; purpose='lab' }
Get-AzResourceGroup -Name rg-lab-ps | Select-Object ResourceGroupName, Location, Tags
Get-AzResourceGroup -Tag @{ purpose='lab' }
Remove-AzResourceGroup -Name rg-lab-ps -Force`},
{h:'What to observe'},
{t:[['Observation','Why it matters'],
['The activity log shows three create operations','Every tool reaches ARM the same way'],
['The tags look identical','The result does not depend on the tool'],
['Deletion removes everything inside','Cleanup by resource group is reliable']]}],
src:[['Manage resource groups',K.ARM+'management/manage-resource-groups-cli']]};

})();
