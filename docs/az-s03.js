/* LearnSphere - Azure Administrator, Section 03: Microsoft Entra ID: Users, Groups & Licensing.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const tenant=K.dg(700,260,[
[10,10,680,240,'One Microsoft Entra tenant',1],
[30,50,170,50,'Users and guests',0],[30,115,170,50,'Groups',0],[30,180,170,50,'Devices and apps',0],
[270,70,160,110,'Directory|objects, policies,|domains',2],
[500,50,170,50,'Microsoft 365',0],[500,115,170,50,'Azure subscriptions',0],[500,180,170,50,'Other SaaS and apps',0]],
[[200,75,270,110],[200,140,270,125],[200,205,270,140],[430,110,500,75],[430,125,500,140],[430,140,500,205]]);

const dyn=K.dg(700,200,[
[10,10,680,180,'Dynamic membership',1],
[30,60,140,70,'User attribute|department =|Finance',0],[260,60,170,70,'Rule evaluated|by Entra ID',2],[520,60,150,70,'Member added or|removed automatically',0]],
[[170,95,260,95],[430,95,520,95]]);

/* ---------- 0: Concepts ---------- */
L['az:2:0']={blocks:[
{p:'**Microsoft Entra ID** (formerly Azure Active Directory) is the cloud identity service behind Microsoft 365, Azure and thousands of other applications. It stores identities and decides who is who. Azure RBAC then decides what each identity may do.'},
{svg:tenant},
{h:'Core terms'},
{t:[['Term','Meaning'],
['**Tenant**','A dedicated instance of Entra ID for one organization. It has a unique tenant ID.'],
['**Directory**','The data store of a tenant: users, groups, apps and devices. Often used as a synonym for tenant.'],
['**Domain**','A name used for sign-in, such as `contoso.onmicrosoft.com` (initial) or `contoso.com` (custom, verified).'],
['**Subscription**','Azure billing boundary that trusts one tenant.'],
['**Security principal**','An identity that can be given access: user, group, service principal or managed identity.']]},
{h:'Editions'},
{t:[['Edition','Highlights'],
['**Free**','Users, groups, basic reports, SSO, MFA through security defaults'],
['**P1**','Conditional Access, dynamic groups, group-based licensing, SSPR with writeback, hybrid features'],
['**P2**','Everything in P1 plus Privileged Identity Management and Identity Protection'],
['**Governance**','Access reviews, entitlement management and lifecycle features']]},
{h:'Entra roles are not Azure roles'},
{p:'Entra ID has its own **directory roles**, such as User Administrator and Global Administrator. They manage the directory. **Azure RBAC** roles manage Azure resources. They are separate systems (Section 4).'},
{note:'Naming changed in 2023 from Azure Active Directory to Microsoft Entra ID. Older articles, scripts and exam material may still use the old names and the AAD module.'}],
src:[['What is Microsoft Entra ID',K.ENTRA+'fundamentals/whatis'],['Entra ID licensing','https://learn.microsoft.com/en-us/entra/fundamentals/licensing']]};

/* ---------- 1: Users ---------- */
L['az:2:1']={blocks:[
{p:'A **user** is the identity of a person (or a test account) in the tenant. Users sign in with a **user principal name (UPN)** that looks like an email address.'},
{h:'User types'},
{t:[['Type','Source','Notes'],
['**Member, cloud**','Created in Entra ID','Full directory member'],
['**Member, synced**','Created on premises and synchronized','Managed on premises, attributes read-only in the cloud'],
['**Guest**','Invited from another tenant or email provider','Limited default permissions (next lectures)']]},
{h:'Key properties'},
{ul:['**User principal name**: sign-in name, for example `sam@contoso.com`.','**Object ID**: unique GUID that never changes.','**Usage location**: required before a license can be assigned.','**Job info, manager, contact info**: used for rules and directories.','**Authentication methods**: how the user proves identity.']},
{h:'Creating users'},
{code:`# Azure CLI
az ad user create --display-name "Sam Lee" --user-principal-name sam@contoso.onmicrosoft.com --password "<temp-password>" --force-change-password-next-sign-in true

az ad user list --query "[].{upn:userPrincipalName,name:displayName}" -o table
az ad user update --id sam@contoso.onmicrosoft.com --account-enabled false`},
{h:'Bulk operations'},
{ul:['In the portal use **Bulk create**, **Bulk invite** and **Bulk delete** with a CSV template.','Operations run as a background job. Check **Bulk operation results**.','Use Microsoft Graph PowerShell for large scripted changes.']},
{h:'Deleting users'},
{p:'Deleted users go to **Deleted users** and can be restored for 30 days before permanent deletion.'},
{note:'Do not share a single admin account. Give each administrator a named account and assign roles to that account, so actions are attributable.'}],
src:[['Add or delete users',K.ENTRA+'fundamentals/how-to-create-delete-users'],['Bulk create users',K.ENTRA+'identity/users/users-bulk-add']]};

/* ---------- 2: Groups ---------- */
L['az:2:2']={blocks:[
{p:'**Groups** let you give access and licenses to many identities at once. Assign access to a group, then manage membership, rather than assigning to individual users.'},
{h:'Group types'},
{t:[['Type','Use','Can be mail-enabled?'],
['**Security**','Control access to resources and apps','No'],
['**Microsoft 365**','Collaboration: shared mailbox, Teams, SharePoint','Yes (always)']]},
{h:'Membership types'},
{t:[['Membership','How members are added','License'],
['**Assigned**','An administrator adds users manually','Free'],
['**Dynamic user**','A rule on user attributes adds and removes members','P1'],
['**Dynamic device**','A rule on device attributes','P1']]},
{svg:dyn},
{code:`# A dynamic membership rule
(user.department -eq "Finance") -and (user.accountEnabled -eq true)

# CLI: create a security group and add a member
az ad group create --display-name "grp-finance" --mail-nickname grp-finance
az ad group member add --group grp-finance --member-id <user-object-id>`},
{h:'Role-assignable groups'},
{p:'A group can be created as **role-assignable** so it can hold Entra directory roles. Its membership cannot be changed by non-privileged owners, which protects against escalation. This setting can only be chosen at creation.'},
{h:'Owners'},
{p:'Group **owners** manage membership. Guests and service principals can also be owners if allowed. Give groups at least two owners to avoid orphaned groups.'},
{note:'A user cannot be added manually to a dynamic group. To change membership, change the rule or the user attribute.'}],
src:[['Manage groups',K.ENTRA+'fundamentals/how-to-manage-groups'],['Dynamic membership rules',K.ENTRA+'identity/users/groups-dynamic-membership']]};

/* ---------- 3: Licenses ---------- */
L['az:2:3']={blocks:[
{p:'Many Entra and Microsoft 365 features, such as Conditional Access, need a **license** assigned to a user. Licenses can be assigned directly or through a group.'},
{h:'Assignment methods'},
{t:[['Method','How','Good for'],
['**Direct**','Assign a license to a user','Exceptions, one-off needs'],
['**Group-based**','Assign a license to a group. Members inherit it','Role or department standard licensing']]},
{flow:['Create a group such as grp-m365-e5','Assign the license (and chosen service plans) to the group','Add users or define a dynamic rule','Entra processes the group and assigns the license','Check Licenses blade for errors']},
{h:'Prerequisites and behavior'},
{ul:['The user must have a **usage location** set, or assignment fails.','Group-based licensing needs Entra ID **P1** or higher.','A user can receive the same license directly and by group. Remove the direct one when the group takes over.','Removing a user from the group removes the group-derived license.']},
{h:'Common errors'},
{t:[['Error','Cause','Fix'],
['Not enough licenses','Group has more members than available seats','Buy or free licenses, or remove members'],
['Usage location missing','User has no usage location','Set the property'],
['Conflicting service plans','Two licenses have overlapping plans','Disable one plan in one of the licenses']]},
{code:`# Review assigned licenses for a user with Microsoft Graph PowerShell
Connect-MgGraph -Scopes User.Read.All
Get-MgUserLicenseDetail -UserId sam@contoso.com`}],
src:[['Group-based licensing',K.ENTRA+'fundamentals/concept-group-based-licensing'],['Troubleshoot license assignment',K.ENTRA+'fundamentals/licensing-groups-resolve-problems']]};

/* ---------- 4: External users ---------- */
L['az:2:4']={blocks:[
{p:'**B2B collaboration** lets people from other organizations, or with personal email addresses, work with your resources using **their own identity**. They appear in your directory as **guest users**.'},
{flow:['An administrator or allowed member invites an email address','An invitation email (or redeem link) is sent','The guest signs in with their own account and accepts','A guest user object is created in your directory','Access is granted through groups, apps or roles']},
{h:'Guest basics'},
{ul:['User type is **Guest**, and the UPN contains `#EXT#`.','The guest authenticates in **their home tenant** or identity provider.','Default guest permissions are limited: they cannot browse the full directory.','Access to Azure resources uses normal RBAC on the guest object.']},
{h:'Controls'},
{t:[['Setting','Controls'],
['**External collaboration settings**','Who can invite, and guest access level'],
['**Allowed and blocked domains**','Restrict which organizations can be invited'],
['**Cross-tenant access settings**','Trust inbound MFA and device claims from partner tenants'],
['**Access reviews** (governance)','Periodic re-certification of guests']]},
{code:`az ad user list --filter "userType eq 'Guest'" --query "[].{name:displayName,mail:mail}" -o table`},
{note:'Guests are a common source of stale access. Put them in groups, use access reviews where licensed, and remove them when the project ends.'}],
src:[['B2B collaboration overview',K.ENTRA+'external-id/what-is-b2b'],['Invite guest users',K.ENTRA+'external-id/b2b-quickstart-add-guest-users-portal']]};

/* ---------- 5: SSPR ---------- */
L['az:2:5']={blocks:[
{p:'**Self-service password reset (SSPR)** lets users reset or unlock their own password without calling the help desk, after proving who they are with registered methods.'},
{h:'Configuration'},
{t:[['Setting','Options'],
['**Enabled for**','None, Selected group, or All'],
['**Methods required**','1 or 2 methods to reset'],
['**Methods available**','Mobile app notification and code, email, mobile phone, office phone, security questions'],
['**Registration**','Require users to register at sign-in and re-confirm periodically'],
['**Notifications**','Notify users and admins on password resets']]},
{flow:['The user chooses Forgot my password at sign-in','They confirm identity with the required number of methods','They choose a new password that meets policy','The new password is applied and the user signs in']},
{h:'Licensing and scope'},
{ul:['**Free**: cloud-only users can use SSPR for password change and reset.','**P1 or higher** is needed for **password writeback** to on-premises Active Directory.','Administrators have a separate and stricter reset policy that always applies.','Start with a pilot group before enabling for all users.']},
{h:'Unified registration'},
{p:'SSPR and MFA now share one set of **authentication methods**, so users register once for both. Manage them under **Authentication methods** policy.'},
{note:'SSPR with writeback needs Microsoft Entra Connect or Cloud Sync. Without writeback, a synced user cannot change the on-premises password from the cloud.'}],
src:[['Tutorial: enable SSPR',K.ENTRA+'identity/authentication/tutorial-enable-sspr'],['How SSPR works',K.ENTRA+'identity/authentication/concept-sspr-howitworks']]};

/* ---------- 6: Practical ---------- */
L['az:2:6']={blocks:[
{p:'Build a small, realistic directory: two departments, groups for each, a license through a group, and one guest. Everything here can be done with the free edition, except dynamic groups and group licensing, which need P1.'},
{flow:['Create three users: two in Finance, one in Operations, with job department set','Create a security group per department','Add members manually, then replace with a dynamic rule if you have P1','Assign a license to the group (if available)','Invite one guest user and add them to a group','Verify membership and licenses']},
{h:'CLI outline'},
{code:`az ad user create --display-name "Ava Finance" --user-principal-name ava@<tenant>.onmicrosoft.com --password "<temp>" --force-change-password-next-sign-in true
az ad user create --display-name "Ben Finance" --user-principal-name ben@<tenant>.onmicrosoft.com --password "<temp>" --force-change-password-next-sign-in true
az ad group create --display-name grp-finance --mail-nickname grp-finance
az ad group member add --group grp-finance --member-id $(az ad user show --id ava@<tenant>.onmicrosoft.com --query id -o tsv)
az ad group member list --group grp-finance --query "[].displayName" -o tsv`},
{h:'Verification checklist'},
{t:[['Check','Expected'],
['Group members','Both Finance users listed'],
['Guest object','User type Guest, in the external group'],
['License blade (if used)','Users show a license inherited from the group'],
['Audit logs','Entries for user, group and invitation creation']]},
{h:'Clean up'},
{ul:['Delete test users and groups.','Remove the guest user and revoke any pending invitation.','Deleted users stay recoverable for 30 days.']},
{note:'Keep this small directory. It is the identity base for the RBAC and governance practicals that follow.'}],
src:[['Microsoft Entra documentation',K.ENTRA]]};

})();
