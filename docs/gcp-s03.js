/* LearnSphere - Google Cloud, Section 03: Identity and Access Management (IAM).
   Lectures 0-8 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const model=K.dg(700,220,[
[10,10,680,200,'An allow policy binds principals to roles on a resource',1],
[30,70,150,70,'Principal|who',0],[270,70,150,70,'Role|a set of permissions',0],[510,70,160,70,'Resource|where it applies',2]],
[[180,105,270,105],[420,105,510,105]]);

const inherit=K.dg(700,300,[
[10,10,680,280,'Policies inherit downward (union of allows)',1],
[250,40,200,40,'Organization',0],[250,100,200,40,'Folder',0],[250,160,200,40,'Project',0],[250,220,200,40,'Resource (bucket, VM)',2],
[20,100,180,40,'Group Viewers granted here',0],[500,160,170,40,'Alice Editor here',0]],
[[350,80,350,100],[350,140,350,160],[350,200,350,220],[200,120,250,120],[500,180,450,180]]);

const sa=K.dg(700,230,[
[10,10,680,210,'A workload uses an attached service account, no key needed',1],
[30,70,150,60,'VM, Cloud Run,|GKE pod',0],[230,70,150,60,'Service account|app@proj.iam',2],[430,70,110,60,'Short-lived|token',0],[580,70,90,60,'Google|API',0]],
[[180,100,230,100],[380,100,430,100],[540,100,580,100]]);

const wif=K.dg(700,260,[
[10,10,680,240,'Workload Identity Federation: trust an external identity',1],
[30,90,140,60,'External workload|AWS, Azure, GitHub',0],[210,90,130,60,'Workload|identity pool',2],[380,90,130,60,'Security Token|Service',0],[550,90,120,60,'Short-lived|Google token',0]],
[[170,120,210,120],[340,120,380,120],[510,120,550,120]]);

const evalg=K.dg(700,220,[
[10,10,680,200,'Order of policy evaluation',1],
[30,70,120,60,'Request',0],[190,70,140,60,'Principal access|boundary',0],[370,70,120,60,'Deny|policies',0],[530,70,140,60,'Allow policies|with conditions',2]],
[[150,100,190,100],[330,100,370,100],[490,100,530,100]]);

/* ---------- 0 ---------- */
L['gcp:2:0']={blocks:[
{p:'**IAM (Identity and Access Management)** controls **who** can do **what** on **which resource** in Google Cloud. You do not give permissions directly to a person. You grant a **role** (a bundle of permissions) to a **principal** on a **resource**, and that grant is stored in an **allow policy**.'},
{svg:model},
{h:'The pieces'},
{t:[['Term','Meaning','Example'],
['Principal','An identity that can be granted access','user:ana@example.com, group:ops@example.com, serviceAccount:app@proj.iam.gserviceaccount.com'],
['Permission','A single allowed action, written service.resource.verb','compute.instances.start, storage.objects.get'],
['Role','A named set of permissions','roles/storage.objectViewer'],
['Binding','Links one role to one or more principals (optionally with a condition)','role + members list'],
['Allow policy','The list of bindings attached to a resource','Stored on organizations, folders, projects and many resources']]},
{h:'Types of principal'},
{ul:['**Google Account** for a person, such as a Cloud Identity or Gmail user.','**Google group**, the recommended way to grant access to teams.','**Service account** for applications and VMs.','**Domain** (Cloud Identity or Workspace domain) for everyone in it.','**Federated identities** from an external identity provider, for people (workforce) or workloads.','**Special values**: `allUsers` (anyone on the internet) and `allAuthenticatedUsers` (anyone signed in to a Google account). Avoid these except for deliberately public content.']},
{h:'Reading a policy'},
{code:`bindings:
- members:
  - group:devs@example.com
  role: roles/compute.instanceAdmin.v1
- members:
  - user:ana@example.com
  role: roles/viewer
  condition:
    title: expires-2027
    expression: request.time < timestamp("2027-01-01T00:00:00Z")
etag: BwXXXX=
version: 3`},
{h:'Commands'},
{code:`gcloud projects get-iam-policy my-project
gcloud projects add-iam-policy-binding my-project \\
  --member="group:devs@example.com" --role="roles/compute.instanceAdmin.v1"
gcloud projects remove-iam-policy-binding my-project \\
  --member="user:ana@example.com" --role="roles/viewer"`},
{note:'There is no "deny by listing". Without an allow, access is denied. Two kinds of rule can then restrict: IAM deny policies and organization policy.'}],
src:[['IAM overview',K.IAM+'overview'],['Policies',K.IAM+'policies']]};

/* ---------- 1 ---------- */
L['gcp:2:1']={blocks:[
{p:'Roles come in three kinds. Choosing the right kind is how you apply **least privilege**: give people only the permissions they need.'},
{t:[['Kind','Examples','Use'],
['Basic (formerly primitive)','Owner, Editor, Viewer, Browser','Very broad. Thousands of permissions across all services. Avoid in production'],
['Predefined','roles/compute.instanceAdmin.v1, roles/storage.objectAdmin, roles/cloudsql.client','Maintained by Google for one product or job. First choice'],
['Custom','organizations/123/roles/vmOperator','You pick the exact permissions. Maintained by you']]},
{h:'Basic roles'},
{t:[['Role','What it allows'],
['Viewer','Read-only access to most resources'],
['Editor','Viewer plus change and delete most resources, but not manage roles and billing'],
['Owner','Editor plus manage IAM roles and set up billing'],
['Browser','View the hierarchy and project metadata only']]},
{p:'Editor and Owner give far more than most tasks need. A user with Editor on a project can create VMs, read every bucket and run any query. Use predefined roles for real work.'},
{h:'Finding a predefined role'},
{code:`gcloud iam roles list --filter="name:roles/storage"
gcloud iam roles describe roles/storage.objectViewer
gcloud iam list-testable-permissions //cloudresourcemanager.googleapis.com/projects/my-project --filter="name:compute.instances.start"`},
{h:'Role naming pattern'},
{ul:['`Viewer` or `Reader` roles read.','`User` roles use a resource without changing it, for example `serviceAccountUser`.','`Admin` roles manage a resource fully.','Product `*.admin` roles often exclude IAM changes. Owner-like power is rare.']},
{h:'Custom roles'},
{p:'Create a custom role when no predefined role fits and the difference matters. Custom roles live at the **organization** or **project** and need upkeep as products add permissions.'},
{code:`gcloud iam roles create vmOperator --project=my-project \\
  --title="VM Operator" --description="Start, stop and view VMs" \\
  --permissions=compute.instances.get,compute.instances.list,compute.instances.start,compute.instances.stop \\
  --stage=GA`},
{note:'Not every permission can be put in a custom role, and a few are only usable at the organization level. Prefer predefined roles and use custom roles sparingly.'}],
src:[['Understanding roles',K.IAM+'roles-overview'],['Predefined roles reference',K.IAM+'understanding-roles'],['Custom roles',K.IAM+'creating-custom-roles']]};

/* ---------- 2 ---------- */
L['gcp:2:2']={blocks:[
{p:'Policies are **inherited**. A role granted at the organization, a folder or a project applies to all resources below. The effective permissions on a resource are the **union** of everything granted on it and above it.'},
{svg:inherit},
{h:'What this means'},
{ul:['Granting at a higher level is powerful and simple, and it is also easy to over-grant.','A child policy **cannot remove** a role granted by a parent. You can only add more.','The effective access is the combination of all allow policies up the chain, minus anything blocked by deny policies or organization policy.']},
{h:'Where to grant'},
{t:[['Need','Grant at'],
['A team manages all development projects','The Development folder'],
['One application team manages one app','Their project'],
['One group needs one bucket','The bucket itself'],
['Auditors need to see everything read-only','Organization, with Viewer-type predefined roles']]},
{h:'Resource-level policies'},
{p:'Many resources support their own allow policy, for example buckets, BigQuery datasets and Pub/Sub topics. Granting there is the narrowest scope.'},
{code:`gcloud storage buckets add-iam-policy-binding gs://my-bucket \\
  --member="group:analysts@example.com" --role="roles/storage.objectViewer"
gcloud pubsub topics add-iam-policy-binding orders --member="serviceAccount:svc@proj.iam.gserviceaccount.com" --role="roles/pubsub.publisher"`},
{h:'Safe change habit'},
{flow:['Read the current policy','Make the smallest change that works','Use the etag, so you do not overwrite someone else\'s edit','Check with Policy Troubleshooter or test as the user','Record why the grant exists']},
{note:'Granting a role on the project to a group of 50 is fine. Granting Owner on the organization to one person is a risk. The wider the scope and the stronger the role, the stronger the justification needed.'}],
src:[['Policy inheritance',K.RM+'cloud-platform-resource-hierarchy#inheritance'],['Resource-level policies',K.IAM+'resource-types']]};

/* ---------- 3 ---------- */
L['gcp:2:3']={blocks:[
{p:'Direct grants to individuals do not scale. When someone joins, changes team or leaves, you have to find every project they touch. Use **Google groups** as the unit of access.'},
{h:'The group pattern'},
{flow:['Create a group per job function, such as gcp-payments-developers','Grant predefined roles to the group on the folder or project','Add and remove people from the group only','Review group membership regularly']},
{h:'Benefits'},
{ul:['Onboarding and offboarding is one change.','Policies stay short and readable.','Group membership is easy to audit.','Groups can be managed by owners outside the cloud team.']},
{t:[['Approach','Result'],
['User bindings everywhere','Long policies, easy to forget, risky when people leave'],
['Group bindings','Short policies, central membership, a single place to review']]},
{h:'Leaver process'},
{ul:['Suspend or delete the user in the identity provider. Access ends everywhere because tokens and sessions are revoked.','Remove them from groups.','Look for personal grants and service account keys they created.','Reassign ownership of resources and scheduled jobs.']},
{h:'Cloud Identity setup tasks'},
{ul:['Enforce 2-Step Verification, ideally with security keys for admins.','Use SSO with your identity provider where possible.','Use session length and re-authentication settings for sensitive users.','Restrict sharing outside the domain with `iam.allowedPolicyMemberDomains`.']},
{code:`gcloud identity groups create payments-devs@example.com --organization=example.com --display-name="Payments developers"
gcloud identity groups memberships add --group-email=payments-devs@example.com --member-email=ana@example.com`},
{note:'Granting roles to external accounts such as personal Gmail addresses undermines central control. Block it with the domain restriction constraint unless there is a real need.'}],
src:[['Best practices for using groups',K.IAM+'using-iam-securely'],['Cloud Identity groups','https://cloud.google.com/identity/docs/groups']]};

/* ---------- 4 ---------- */
L['gcp:2:4']={blocks:[
{p:'A **service account** is an identity for an application or a virtual machine, not a person. Programs use it to call Google Cloud APIs. It has an email address such as `app-backend@my-project.iam.gserviceaccount.com` and is itself a **resource** that can be granted roles.'},
{svg:sa},
{h:'Types'},
{t:[['Type','Description','Notes'],
['User-managed','Created by you in a project','Recommended. One per workload, with only the roles it needs'],
['Default','Created by Google for some services such as Compute Engine and App Engine','Historically granted Editor. Avoid using it, and remove broad roles'],
['Service agents','Google-managed identities that let a Google service act in your project','Appear as service-PROJECT_NUMBER@... Do not delete or change them']]},
{h:'Creating and using one'},
{code:`gcloud iam service-accounts create web-backend --display-name="Web backend"
gcloud projects add-iam-policy-binding my-project \\
  --member="serviceAccount:web-backend@my-project.iam.gserviceaccount.com" --role="roles/cloudsql.client"
gcloud compute instances create web-1 --zone=us-central1-a \\
  --service-account=web-backend@my-project.iam.gserviceaccount.com --scopes=cloud-platform`},
{h:'Two sides of access'},
{p:'A service account is both an identity and a resource. So there are two different questions: what can the service account do, and who can use it.'},
{t:[['Question','Role that answers it'],
['What can the account do?','Roles granted to the service account on projects and resources'],
['Who can attach it to a VM or Cloud Run service?','roles/iam.serviceAccountUser on the service account'],
['Who can create tokens as it (impersonate)?','roles/iam.serviceAccountTokenCreator on the service account']]},
{h:'Access scopes on Compute Engine'},
{p:'VMs also have legacy **access scopes**. Today you should set the scope to `cloud-platform` and control access with IAM roles on the service account.'},
{ul:['One service account per workload makes permissions and audit logs clear.','Avoid sharing one account across many unrelated apps.','Review the roles regularly with the IAM Recommender.']},
{note:'Granting serviceAccountUser at the project level lets someone act as every service account in it. Grant it on a specific service account instead.'}],
src:[['Service accounts overview',K.IAM+'service-account-overview'],['Attach service accounts to resources',K.IAM+'attach-service-accounts']]};

/* ---------- 5 ---------- */
L['gcp:2:5']={blocks:[
{p:'Code needs credentials to call Google Cloud. The safest credential is one that is never stored. Several options exist, and they differ a lot in risk.'},
{h:'From best to worst'},
{t:[['Approach','How it works','Risk'],
['Attached service account','The platform gives the workload tokens automatically (VMs, Cloud Run, GKE with Workload Identity)','Lowest. No secret to leak'],
['Impersonation','A user or account with Token Creator creates short-lived tokens as the service account','Low. Short-lived and audited'],
['Workload Identity Federation','An external identity (AWS, Azure, GitHub, OIDC) is exchanged for a short-lived Google token','Low. No key stored'],
['Service account key','A JSON file with a private key that is valid until deleted','High. Can be copied, committed and leaked']]},
{h:'Impersonation'},
{code:`gcloud storage ls gs://my-bucket --impersonate-service-account=deployer@my-project.iam.gserviceaccount.com
gcloud config set auth/impersonate_service_account deployer@my-project.iam.gserviceaccount.com`},
{h:'Workload Identity Federation'},
{svg:wif},
{p:'You create a **workload identity pool** and a **provider** that trusts the outside identity provider. Attribute mappings and a condition restrict which outside identities are accepted, for example a specific GitHub repository. The federated identity is then granted roles directly or permission to impersonate a service account.'},
{code:`gcloud iam workload-identity-pools create github-pool --location=global --display-name="GitHub"
gcloud iam workload-identity-pools providers create-oidc github --location=global \\
  --workload-identity-pool=github-pool --issuer-uri="https://token.actions.githubusercontent.com" \\
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \\
  --attribute-condition="assertion.repository=='my-org/my-repo'"`},
{note:'Workforce Identity Federation is the matching feature for people from an external identity provider. Workload Identity Federation is for programs.'},
{h:'If you must use keys'},
{ul:['Prefer the organization policy that blocks key creation, with exceptions only by approval.','Rotate keys and delete unused ones. A service account can have at most 10 keys.','Store keys in Secret Manager or a CI secret store, never in code or images.','Monitor with the service account key recommender and audit logs.']}],
src:[['Best practices for service accounts',K.IAM+'best-practices-service-accounts'],['Workload Identity Federation',K.IAM+'workload-identity-federation'],['Impersonation',K.IAM+'service-account-impersonation']]};

/* ---------- 6 ---------- */
L['gcp:2:6']={blocks:[
{p:'Allow policies grant. Newer tools refine and limit them: **IAM Conditions** limit when a grant applies, **deny policies** block permissions regardless of allows, and **principal access boundaries** limit which resources principals can ever use.'},
{h:'IAM Conditions'},
{p:'A condition is an expression attached to a binding using the Common Expression Language (CEL). The role applies only when the condition is true.'},
{code:`gcloud projects add-iam-policy-binding my-project \\
  --member="user:contractor@example.com" --role="roles/compute.instanceAdmin.v1" \\
  --condition='expression=request.time < timestamp("2027-06-30T00:00:00Z"),title=temporary-access'

# only buckets whose name starts with a prefix
--condition='expression=resource.name.startsWith("projects/_/buckets/team-a-"),title=team-a-buckets'`},
{t:[['Condition attribute','Use'],
['request.time','Time-limited or scheduled access'],
['resource.name, resource.type, resource.service','Limit to resource names or types'],
['resource.matchTag(...)','Limit by Resource Manager tag, for example only production-tagged resources'],
['Access level (Context-Aware Access)','Require a device or network context']]},
{h:'Deny policies'},
{p:'A **deny policy** lists permissions that selected principals cannot use, no matter what allow policies say. It is attached to an organization, folder or project and is inherited. Use it for guardrails, such as preventing everyone except a security group from deleting log buckets.'},
{code:`# deny.json
{
  "displayName": "Only security can delete log buckets",
  "rules": [{"denyRule": {
    "deniedPrincipals": ["principalSet://goog/public:all"],
    "exceptionPrincipals": ["principalSet://goog/group/security@example.com"],
    "deniedPermissions": ["logging.googleapis.com/buckets.delete"]
  }}]
}
gcloud iam policies create log-guard --attachment-point=cloudresourcemanager.googleapis.com/organizations/987654321 \\
  --kind=denypolicies --policy-file=deny.json`},
{h:'Principal access boundary policies'},
{p:'A **principal access boundary (PAB)** defines the set of resources a group of principals is **eligible** to access. Even if an allow policy exists elsewhere, access outside the boundary is blocked. It helps to keep an identity from using resources in unrelated parts of the organization.'},
{h:'How a request is evaluated'},
{svg:evalg},
{ul:['Organization policy and PAB can block before any allow is considered.','If any applicable deny matches, the request is denied.','Otherwise it needs an applicable allow whose condition, if any, is true.']},
{note:'Conditions work only on some resource types and roles. Check support before relying on them, and test with the Policy Troubleshooter.'}],
src:[['IAM Conditions overview',K.IAM+'conditions-overview'],['Deny policies',K.IAM+'deny-overview'],['Principal access boundary',K.IAM+'principal-access-boundary-policies']]};

/* ---------- 7 ---------- */
L['gcp:2:7']={blocks:[
{p:'Least privilege is not set once. Permissions grow over time, so Google Cloud offers tools that explain access, remove what is unused and answer audit questions.'},
{h:'The tools'},
{t:[['Tool','Question it answers'],
['Policy Troubleshooter','Why can (or cannot) this principal do this on this resource?'],
['Policy Simulator','What would change if I modify this policy?'],
['IAM Recommender','Which roles can be removed or replaced because they are unused?'],
['Policy Analyzer (Cloud Asset Inventory)','Who can access this resource? What can this principal access?'],
['Service account insights','Which service accounts or keys are unused?']]},
{h:'Typical usage'},
{code:`# why was access allowed or denied
gcloud policy-intelligence troubleshoot-policy iam //cloudresourcemanager.googleapis.com/projects/my-project \\
  --principal-email=ana@example.com --permission=compute.instances.start

# role recommendations
gcloud recommender recommendations list --project=my-project --location=global \\
  --recommender=google.iam.policy.Recommender

# who can read this bucket
gcloud asset analyze-iam-policy --organization=987654321 \\
  --full-resource-name=//storage.googleapis.com/projects/_/buckets/my-bucket \\
  --permissions=storage.objects.get`},
{h:'Troubleshooting a 403'},
{flow:['Read the error: it names the permission and often the resource','Confirm which identity made the call with gcloud auth list or the log entry','Run Policy Troubleshooter for that principal and permission','Check deny policies, organization policy and VPC Service Controls','Grant the smallest predefined role that includes the permission']},
{h:'Regular reviews'},
{ul:['Remove Owner and Editor from people whose work does not require them.','Act on IAM Recommender suggestions after reviewing the usage.','Review service accounts and keys quarterly.','Audit external members and `allUsers` bindings.']},
{note:'Recommendations depend on 90 days of observed use. They are advice, not instructions, so review the owner and purpose before removing a role.'}],
src:[['Policy Troubleshooter',K.IAM+'troubleshooting-access'],['IAM Recommender',K.IAM+'recommender-overview'],['Policy Analyzer','https://cloud.google.com/policy-intelligence/docs/analyze-iam-policies']]};

/* ---------- 8 ---------- */
L['gcp:2:8']={blocks:[
{p:'**Cloud Audit Logs** record who did what, where and when in Google Cloud. They are the main evidence for security investigations and compliance.'},
{h:'Types of audit logs'},
{t:[['Log','Records','Default'],
['Admin Activity','Changes to configuration or metadata, such as creating a VM or changing IAM','Always on, cannot be disabled, no charge'],
['Data Access','Reads of configuration and data, and user-driven data changes','Off by default, except BigQuery. Can be enabled per service. May be large and billable'],
['System Event','Google-initiated changes such as live migration','Always on, no charge'],
['Policy Denied','Requests denied by a security policy such as VPC Service Controls','On by default']]},
{h:'Enabling Data Access logs'},
{p:'Data Access logs are configured in the IAM policy (AuditConfig) for a service, with log types DATA_READ, DATA_WRITE and ADMIN_READ. Enable them for sensitive services and exempt noisy service accounts where appropriate.'},
{code:`# the auditConfigs section in a project IAM policy
auditConfigs:
- service: storage.googleapis.com
  auditLogConfigs:
  - logType: DATA_READ
  - logType: DATA_WRITE`},
{h:'Reading logs'},
{code:`gcloud logging read 'logName:"cloudaudit.googleapis.com%2Factivity" AND protoPayload.methodName="SetIamPolicy"' \\
  --project=my-project --limit=5 --format=json
gcloud logging read 'protoPayload.authenticationInfo.principalEmail="ana@example.com"' --freshness=1d`},
{h:'Retention'},
{ul:['Admin Activity logs live in the `_Required` log bucket for 400 days by default.','Data Access logs go to the `_Default` bucket, 30 days by default, and retention can be changed.','For long retention or analysis, route logs to Cloud Storage or BigQuery with a log sink (organization level aggregated sinks work well).']},
{note:'Audit logs show who changed a policy, but only if someone looks. Set log-based alerts for risky events such as new Owner bindings, service account key creation or changes to logging sinks.'}],
src:[['Cloud Audit Logs overview',K.LOG+'audit'],['Configure Data Access logs',K.LOG+'audit/configure-data-access']]};
})();
