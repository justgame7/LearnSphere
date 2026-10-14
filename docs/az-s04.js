/* LearnSphere - Azure Administrator, Section 04: Access to Azure Resources: RBAC.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const two=K.dg(700,230,[
[10,10,330,210,'Entra roles',1],[360,10,330,210,'Azure RBAC roles',1],
[30,50,290,50,'Manage the directory: users, groups, domains',0],[30,115,290,50,'Examples: Global Admin, User Admin',0],
[380,50,290,50,'Manage Azure resources: VMs, storage',0],[380,115,290,50,'Examples: Owner, Contributor, Reader',0]],
[]);

const assign=K.dg(700,220,[
[10,10,680,200,'A role assignment has three parts',1],
[30,70,170,70,'Security principal|who: user, group,|service principal, identity',0],
[265,70,170,70,'Role definition|what: allowed actions',2],
[500,70,170,70,'Scope|where: management group,|subscription, group,|or resource',0]],
[[200,105,265,105],[435,105,500,105]]);

const inherit=K.dg(700,260,[
[10,10,680,240,'Permissions flow down, never up',1],
[230,35,240,36,'Management group',0],[230,85,240,36,'Subscription',0],[230,135,240,36,'Resource group',0],[230,185,240,36,'Resource',0]],
[[350,71,350,85],[350,121,350,135],[350,171,350,185]]);

const mi=K.dg(700,220,[
[10,10,680,200,'Managed identity: no secret in your code',1],
[30,70,150,70,'Azure resource|VM, App, Function',0],[250,70,170,70,'Entra ID|issues a token',2],[500,70,170,70,'Target service|Key Vault, Storage,|SQL',0]],
[[180,105,250,105],[420,105,500,105]]);

/* ---------- 0 ---------- */
L['az:3:0']={blocks:[
{p:'Azure has **two separate role systems**. Mixing them up is the most common source of confusion about who can do what.'},
{svg:two},
{t:[['','Microsoft Entra roles','Azure RBAC roles'],
['**Protects**','Directory objects: users, groups, domains, apps','Azure resources: subscriptions, groups, resources'],
['**Scope**','Tenant, administrative unit or app','Management group, subscription, resource group, resource'],
['**Examples**','Global Administrator, User Administrator, Groups Administrator','Owner, Contributor, Reader'],
['**Where managed**','Entra admin center','Access control (IAM) on a scope'],
['**Custom roles**','Yes, in the directory','Yes, at subscription or management group']]},
{h:'How they interact'},
{ul:['A **Global Administrator** is not automatically an Azure resource owner. They can **elevate access** to manage all subscriptions in the tenant when needed.','An **Owner** of a subscription cannot create users in the directory.','Authentication proves who you are. Authorization decides what you may do.']},
{note:'In the exam and in practice, read the question for what is being protected. Resources, use RBAC. Users and groups, use Entra roles.'}],
src:[['Azure roles, Entra roles and classic admin roles',K.RBAC+'rbac-and-directory-admin-roles']]};

/* ---------- 1 ---------- */
L['az:3:1']={blocks:[
{p:'Azure includes hundreds of **built-in roles**. Four fundamental ones cover most general-purpose access.'},
{t:[['Role','Can do','Cannot do'],
['**Owner**','Everything, including assigning roles','Nothing is excluded'],
['**Contributor**','Create and manage all resources','Assign roles or manage access'],
['**Reader**','View resources','Change anything'],
['**User Access Administrator**','Assign roles and manage access','Manage the resources themselves']]},
{h:'Choosing a role'},
{ul:['Prefer **specific** roles such as Virtual Machine Contributor or Storage Blob Data Reader over Contributor.','Use **Owner** rarely and for few people, preferably time-limited.','Give **Reader** to auditors and support staff.','Separate duty: someone who deploys should not necessarily be able to grant access.']},
{h:'Control plane and data plane'},
{p:'Most roles control the **control plane**: creating, configuring and deleting resources. Reading the data inside a service, such as blob contents, uses **data actions** and needs a data role.'},
{t:[['Plane','Example action','Example role'],
['Control plane','Create a storage account','Storage Account Contributor'],
['Data plane','Read blob content','Storage Blob Data Reader']]},
{code:`az role definition list --name "Contributor" -o json
az role definition list --query "[?contains(roleName,'Virtual Machine')].roleName" -o tsv`},
{note:'Owner and Contributor on a storage account do not allow reading blob data through Entra authorization. They can read account keys though, which is a bypass to remember.'}],
src:[['Azure built-in roles',K.RBAC+'built-in-roles']]};

/* ---------- 2 ---------- */
L['az:3:2']={blocks:[
{p:'Access in Azure is always a **role assignment**: a security principal gets a role at a scope.'},
{svg:assign},
{h:'The role definition'},
{p:'A role definition is a JSON document listing what is allowed.'},
{t:[['Property','Meaning'],
['`Actions`','Control plane operations allowed, with wildcards'],
['`NotActions`','Operations removed from `Actions`'],
['`DataActions`','Data plane operations allowed'],
['`NotDataActions`','Data operations removed'],
['`AssignableScopes`','Where the role can be assigned']]},
{h:'Security principals'},
{ul:['**User** and **group**: people and teams.','**Service principal**: an identity for an application.','**Managed identity**: a service principal managed by Azure for a resource.']},
{p:'Prefer assigning to **groups** so access is changed by membership, not by editing assignments.'},
{code:`az role assignment create --assignee <group-object-id> --role "Reader" --scope /subscriptions/<sub-id>/resourceGroups/rg-app

az role assignment list --assignee <object-id> --all -o table
az role assignment delete --assignee <object-id> --role "Reader" --scope /subscriptions/<sub-id>/resourceGroups/rg-app`},
{note:'A new assignment can take a few minutes to take effect. A token that was issued earlier can also carry old claims until it is refreshed.'}],
src:[['Steps to assign an Azure role',K.RBAC+'role-assignments-steps'],['Understand role definitions',K.RBAC+'role-definitions']]};

/* ---------- 3 ---------- */
L['az:3:3']={blocks:[
{p:'You can assign a role at four scopes. The scope you choose decides how many resources the principal can reach, so choose the **narrowest scope that works**.'},
{svg:inherit},
{t:[['Scope','Typical use','Blast radius'],
['**Management group**','Central teams across many subscriptions','Very large'],
['**Subscription**','Platform or environment owners','Large'],
['**Resource group**','An application team for their workload','Medium'],
['**Resource**','One component, such as one storage account or Key Vault','Small']]},
{h:'Assigning in each place'},
{ul:['Portal: open the scope, then **Access control (IAM)**, **Add**, **Add role assignment**.','CLI and PowerShell: pass `--scope` or `-Scope` with the resource ID of the scope.','Templates: `Microsoft.Authorization/roleAssignments` at the right deployment scope.']},
{code:`# Management group scope
az role assignment create --assignee <id> --role Reader --scope /providers/Microsoft.Management/managementGroups/<mg-id>

# Resource scope
az role assignment create --assignee <id> --role "Storage Blob Data Reader" --scope $(az storage account show -n mystorage -g rg-app --query id -o tsv)`},
{note:'You can only assign at a scope where you have Owner, User Access Administrator or a role that includes `Microsoft.Authorization/roleAssignments/write`.'}],
src:[['Understand scope for Azure RBAC',K.RBAC+'scope-overview']]};

/* ---------- 4 ---------- */
L['az:3:4']={blocks:[
{p:'To explain why someone has or lacks access, you must read assignments **across all scopes above** the resource.'},
{h:'Rules'},
{ul:['Access is **additive**. The effective permission is the union of all assignments that apply.','Assignments are **inherited** from parent scopes. You cannot remove an inherited assignment at a child scope.','A **deny assignment** blocks actions even when a role would allow them. They are created by Azure, for example by deployment stacks and managed applications, not directly by users.','**NotActions** is not a deny. It only removes an operation from that role. Another role can still allow it.']},
{h:'Check access'},
{flow:['Open the resource and choose Access control (IAM)','Select Check access and the user or group','Read the roles listed, with the scope each came from','Open Role assignments to see all, including inherited','Open Deny assignments if access is unexpectedly blocked']},
{code:`az role assignment list --assignee <user-id> --all --include-inherited -o table
az role assignment list --scope /subscriptions/<sub-id>/resourceGroups/rg-app --include-inherited -o table`},
{h:'Common explanations'},
{t:[['Symptom','Likely cause'],
['User has Reader on the group yet cannot change a VM','No write role at that scope'],
['Contributor cannot assign a role','Contributor excludes role assignment'],
['Access still denied after assignment','Propagation delay or an old token'],
['Owner cannot delete a resource','A resource lock or a deny assignment']]}],
src:[['Check access for a user',K.RBAC+'check-access'],['Understand deny assignments',K.RBAC+'deny-assignments']]};

/* ---------- 5 ---------- */
L['az:3:5']={blocks:[
{p:'A **custom role** is a role you define when no built-in role matches the permissions you need. Create one only when a built-in role is too broad or too narrow.'},
{h:'When to create one'},
{ul:['A built-in role gives more than required, such as Contributor for a team that only restarts VMs.','You need to combine a few actions that no single role has.','Never use custom roles just to rename a built-in role.']},
{code:`{
  "Name": "VM Operator",
  "IsCustom": true,
  "Description": "Start, stop and restart virtual machines.",
  "Actions": [
    "Microsoft.Compute/virtualMachines/read",
    "Microsoft.Compute/virtualMachines/start/action",
    "Microsoft.Compute/virtualMachines/restart/action",
    "Microsoft.Compute/virtualMachines/deallocate/action",
    "Microsoft.Resources/subscriptions/resourceGroups/read"
  ],
  "NotActions": [],
  "AssignableScopes": ["/subscriptions/<sub-id>"]
}`},
{code:`az role definition create --role-definition @vm-operator.json
az role definition update --role-definition @vm-operator.json
az role definition delete --name "VM Operator"`},
{h:'Practical tips'},
{ul:['Find operations with `az provider operation show --namespace Microsoft.Compute`.','Start from a built-in role definition and trim it.','Set **AssignableScopes** as narrowly as possible.','Test with a non-admin account before rollout.','Keep custom roles in source control and document why each exists.']},
{note:'There is a limit of custom roles per tenant, and each costs review effort. Fewer, well-named roles are easier to audit.'}],
src:[['Azure custom roles',K.RBAC+'custom-roles'],['Create or update custom roles with CLI',K.RBAC+'custom-roles-cli']]};

/* ---------- 6 ---------- */
L['az:3:6']={blocks:[
{p:'A **managed identity** is an identity in Entra ID that Azure creates and manages for a resource. The resource uses it to authenticate to services that support Entra authentication, with **no password, key or certificate** to store or rotate.'},
{svg:mi},
{h:'Two types'},
{t:[['','System-assigned','User-assigned'],
['**Created**','Enabled on one resource','As a standalone Azure resource'],
['**Lifecycle**','Deleted with the resource','Independent, deleted explicitly'],
['**Sharing**','One resource only','Can be attached to many resources'],
['**Best for**','Single resource with simple needs','Many resources needing the same access, or pre-created access']]},
{h:'Using one'},
{flow:['Enable a managed identity on the resource','Assign the identity an RBAC role on the target, such as Key Vault Secrets User','The code asks the local identity endpoint for a token','The target validates the token and checks the role']},
{code:`# System-assigned on a VM
az vm identity assign --name vm1 --resource-group rg-app

# User-assigned: create, then attach
az identity create --name id-app --resource-group rg-app
az vm identity assign --name vm1 --resource-group rg-app --identities id-app

# Grant access
az role assignment create --assignee-object-id <principalId> --assignee-principal-type ServicePrincipal --role "Storage Blob Data Reader" --scope <storage-id>`},
{note:'Managed identities are not subject to MFA and cannot be used by a person to sign in. They are the preferred way to give automation access to Azure.'}],
src:[['What are managed identities',K.ENTRA+'identity/managed-identities-azure-resources/overview']]};

/* ---------- 7 ---------- */
L['az:3:7']={blocks:[
{p:'Design and assign access for an operations team of three people who must restart virtual machines in one application resource group, read everything else in the subscription, and manage nothing else.'},
{h:'Design'},
{t:[['Need','Role','Scope'],
['Restart VMs in the app','Custom role VM Operator or Virtual Machine Contributor','`rg-app` resource group'],
['Read other resources','Reader','Subscription'],
['Assign access','Nobody on the team. Owner stays with platform admins','n/a']]},
{flow:['Create a security group grp-ops','Add the three users','Assign Reader to the group on the subscription','Assign the VM role to the group on rg-app','Sign in as one user and verify allowed and denied actions']},
{code:`G=$(az ad group show --group grp-ops --query id -o tsv)
SUB=$(az account show --query id -o tsv)
az role assignment create --assignee-object-id $G --assignee-principal-type Group --role Reader --scope /subscriptions/$SUB
az role assignment create --assignee-object-id $G --assignee-principal-type Group --role "Virtual Machine Contributor" --scope /subscriptions/$SUB/resourceGroups/rg-app

az role assignment list --assignee $G --all -o table`},
{h:'Verify'},
{t:[['Test','Expected'],
['Restart a VM in rg-app','Allowed'],
['Delete a VM in rg-app','Allowed with Virtual Machine Contributor, denied with a restart-only custom role'],
['Create a storage account','Denied'],
['View a VM in another group','Allowed']]},
{note:'Review the assignment after a month. Remove or narrow anything not used. Least privilege is a routine, not a one-time setup.'}],
src:[['Best practices for Azure RBAC',K.RBAC+'best-practices']]};

})();
