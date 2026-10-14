/* LearnSphere - AWS Administrator, Section 04: Multi-Account Governance & Cost Management.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const ou=K.dg(700,290,[
[10,10,680,270,'An organization',1],
[250,35,200,40,'Root',2],
[80,100,170,40,'OU Security',0],[265,100,170,40,'OU Workloads',0],[450,100,170,40,'OU Sandbox',0],
[80,170,170,40,'Log archive|Audit',0],[220,170,120,40,'Prod',0],[355,170,120,40,'Dev',0],[490,170,130,40,'Lab accounts',0],
[40,230,620,35,'SCPs attach to root, OUs and accounts and flow downward',0]],
[[350,75,165,100],[350,75,350,100],[350,75,535,100],[165,140,165,170],[350,140,280,170],[350,140,415,170],[535,140,555,170]]);

const scp=K.dg(700,200,[
[10,10,680,180,'SCPs filter, they never grant',1],
[40,60,180,70,'SCP allows|the action?',0],[260,60,180,70,'IAM policy allows|the action?',0],[480,60,180,70,'Effective|permission',2]],
[[220,95,260,95],[440,95,480,95]]);

const sso=K.dg(700,200,[
[10,10,680,180,'IAM Identity Center',1],
[30,60,120,60,'Users and|groups',0],[190,60,150,60,'Permission sets|(role templates)',2],[380,60,130,60,'Assignments|group + set + account',0],[550,60,110,60,'Roles created|in each account',0]],
[[150,90,190,90],[340,90,380,90],[510,90,550,90]]);

/* ---------- 0 ---------- */
L['aws:3:0']={blocks:[
{p:'Using **multiple accounts** is the main way to isolate environments, limit the blast radius and separate duties. **AWS Organizations** manages them as a group.'},
{svg:ou},
{h:'Why more than one account'},
{ul:['**Security boundary**: a compromise or mistake stays inside the account.','**Cost clarity**: each account has its own bill line.','**Quotas**: limits apply per account and Region.','**Compliance**: separate audit, logging and production scopes.']},
{h:'Organizations features'},
{t:[['Feature','Purpose'],
['Organizational units','Hierarchy of accounts'],
['Consolidated billing','One bill, shared volume and commitment discounts'],
['Service control policies','Maximum permissions for accounts'],
['Policies: tag, backup, declarative','Standardize configuration'],
['Trusted service access','Let services such as Config and CloudTrail work organization-wide'],
['Delegated administrator','Run a service from a member account instead of the management account']]},
{note:'Keep the management account almost empty: no workloads, very few people. Delegate security and operations services to dedicated member accounts.'},
{code:`aws organizations list-roots
aws organizations list-organizational-units-for-parent --parent-id r-abcd
aws organizations list-accounts-for-parent --parent-id ou-abcd-12345678`}],
src:[['AWS Organizations',K.ORG+'orgs_introduction.html'],['Organizing your environment','https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-your-aws-environment.html']]};

/* ---------- 1 ---------- */
L['aws:3:1']={blocks:[
{p:'Accounts join an organization by **creation** or **invitation**. A new member account gets an automatic cross-account administrative role so the management account can reach it.'},
{h:'Lifecycle'},
{flow:['Create an account in the organization (or invite an existing one)','The role OrganizationAccountAccessRole is created in a new account','Move the account to the right OU','Baseline it: roles, logging, guardrails, budgets','Close the account when finished (a 90 day recovery window applies)']},
{h:'Consolidated billing'},
{ul:['All member charges roll up to the management account.','Reserved Instance and Savings Plan discounts can be shared across accounts.','Each account still has its own cost visibility through tags and account filters.']},
{code:`aws organizations create-account --email prod-1@example.com --account-name prod-1
aws organizations describe-create-account-status --create-account-request-id car-123
aws organizations move-account --account-id 111122223333 \\
  --source-parent-id r-abcd --destination-parent-id ou-abcd-12345678`},
{note:'Use unique, monitored email addresses for each account root user. Closing an account has limits on how many can be closed in a period, so plan lab account reuse.'}],
src:[['Managing accounts',K.ORG+'orgs_manage_accounts.html'],['Consolidated billing','https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/consolidated-billing.html']]};

/* ---------- 2 ---------- */
L['aws:3:2']={blocks:[
{p:'A **service control policy (SCP)** sets the **maximum permissions** for the principals in an account or OU. It does not grant anything: effective permission is the intersection of the SCP and the identity or resource policies.'},
{svg:scp},
{h:'Key facts'},
{ul:['SCPs apply to **all principals in member accounts**, including the root user of the account.','They do **not** apply to the management account.','They do not affect service-linked roles.','The default `FullAWSAccess` policy must remain, or you must replace it with your own allow.']},
{h:'Two common styles'},
{t:[['Style','How','Example'],
['Deny list','Keep FullAWSAccess and add explicit Deny statements','Deny leaving the organization, deny unapproved Regions'],
['Allow list','Remove FullAWSAccess and allow only named services','Tightly controlled sandboxes']]},
{code:`{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyOutsideEU",
    "Effect": "Deny",
    "NotAction": ["iam:*","organizations:*","route53:*","cloudfront:*","support:*"],
    "Resource": "*",
    "Condition": {"StringNotEquals": {"aws:RequestedRegion": ["eu-west-1","eu-central-1"]}}
  }]
}`},
{note:'Test an SCP on a sandbox OU first. A wrong SCP can lock out everything, including administrators. Only the management account can fix it.'}],
src:[['Service control policies',K.ORG+'orgs_manage_policies_scps.html']]};

/* ---------- 3 ---------- */
L['aws:3:3']={blocks:[
{p:'**IAM Identity Center** is the recommended way to give your workforce access to many AWS accounts and applications with one sign-in.'},
{svg:sso},
{h:'Concepts'},
{t:[['Concept','Meaning'],
['Identity source','Identity Center directory, Active Directory or an external IdP'],
['Permission set','A template of policies that becomes an IAM role in each assigned account'],
['Assignment','Binds a user or group to a permission set in a specific account'],
['Access portal','The user landing page listing assigned accounts and apps']]},
{h:'Operating it'},
{ul:['Assign **groups**, not individual users, so joiners and leavers are handled in the directory.','Create separate permission sets such as ReadOnly, Operator and Admin.','Session duration is set per permission set.','Access is temporary: the CLI uses `aws sso login` and short-lived credentials.']},
{code:`aws sso-admin list-instances
aws sso-admin list-permission-sets --instance-arn <arn>
aws sso login --profile prod-ops`},
{note:'Enable it once in the organization, in the Region you choose. The Region cannot be changed later without recreating the instance.'}],
src:[['IAM Identity Center','https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html']]};

/* ---------- 4 ---------- */
L['aws:3:4']={blocks:[
{p:'A **tagging strategy** defines which keys exist, which values are allowed and who sets them. **Tag policies** in Organizations enforce consistent keys and values.'},
{h:'Plan the taxonomy'},
{t:[['Category','Example keys'],
['Technical','Name, Environment, Application, Version'],
['Business','Owner, CostCenter, Project'],
['Security','DataClassification, Compliance'],
['Automation','Backup, Schedule, PatchGroup']]},
{h:'Tag policy example'},
{code:`{
  "tags": {
    "Environment": {
      "tag_key": {"@@assign": "Environment"},
      "tag_value": {"@@assign": ["prod","dev","test"]},
      "enforced_for": {"@@assign": ["ec2:instance"]}
    }
  }
}`},
{ul:['A tag policy reports **non-compliance**. With `enforced_for` it can block untagged creation for supported resources.','Combine with an SCP or IAM condition (`aws:RequestTag`) to require a tag at creation.','Activate cost allocation tags in Billing to use them in reports.']},
{note:'Do not put secrets or personal data in tags. They appear in billing data and many APIs.'}],
src:[['Tag policies',K.ORG+'orgs_manage_policies_tag-policies.html']]};

/* ---------- 5 ---------- */
L['aws:3:5']={blocks:[
{p:'**AWS Config** records resource configuration over time and evaluates it against **rules**. Combined with SCPs it helps you control **what** may run and **where**.'},
{h:'Components'},
{t:[['Piece','Role'],
['Configuration recorder','Records changes to resource configuration'],
['Configuration history and snapshots','Timeline of a resource, delivered to S3'],
['Config rule','Evaluates compliance: AWS managed or custom (Guard, Lambda)'],
['Conformance pack','A set of rules and remediation as one deployable unit'],
['Aggregator','View compliance across accounts and Regions'],
['Remediation','Run a Systems Manager Automation document on a non-compliant resource']]},
{code:`aws configservice describe-config-rules --query "ConfigRules[].ConfigRuleName"
aws configservice get-compliance-details-by-config-rule \\
  --config-rule-name s3-bucket-public-read-prohibited --compliance-types NON_COMPLIANT`},
{h:'Restricting Regions and services'},
{ul:['Use an **SCP** to prevent use of unapproved Regions or services (prevention).','Use **Config rules** to find drift and risky settings (detection).','Use **remediation** to fix automatically where safe.']},
{note:'Prevent what you can, detect everything else. Config does not stop an action, it tells you afterwards.'}],
src:[['AWS Config','https://docs.aws.amazon.com/config/latest/developerguide/WhatIsConfig.html']]};

/* ---------- 6 ---------- */
L['aws:3:6']={blocks:[
{p:'**AWS Trusted Advisor** inspects your account against best-practice checks and recommends actions. Available checks depend on your support plan.'},
{h:'Check categories'},
{t:[['Category','Examples'],
['Cost optimization','Idle load balancers, unattached volumes, underused instances'],
['Performance','Overused instances, high-utilization volumes'],
['Security','Open security groups, MFA on root, public snapshots'],
['Fault tolerance','Multi-AZ, backups, health checks'],
['Service limits','Resources approaching quotas'],
['Operational excellence','Recommended operational practices']]},
{h:'Using it'},
{flow:['Review checks and priority recommendations','Exclude items that are intentional','Act on the highest-risk and highest-cost items first','Send check status changes to EventBridge for notification','Track progress over time']},
{code:`aws support describe-trusted-advisor-checks --language en --query "checks[].name" --region us-east-1`},
{note:'Only core security and service limit checks are available on Basic and Developer plans. The full set needs Business or higher. The Support API is served from us-east-1.'}],
src:[['Trusted Advisor','https://docs.aws.amazon.com/awssupport/latest/user/trusted-advisor.html']]};

/* ---------- 7 ---------- */
L['aws:3:7']={blocks:[
{p:'Cost control starts with **seeing** spend. The Billing console, **Cost Explorer**, **Budgets** and **cost allocation tags** form the basic toolkit.'},
{t:[['Tool','Use'],
['Billing and Cost Management console','Bills, payment, credits, free tier usage'],
['Cost Explorer','Graph and filter spend by service, account, tag and usage type'],
['Budgets','Cost, usage, savings plan coverage budgets with alerts and actions'],
['Cost allocation tags','Break costs down by your own labels'],
['Cost and Usage Report','Most detailed data, delivered to S3'],
['Free tier tracking','Shows usage against allowances']]},
{h:'Create a budget with an alert'},
{code:`aws budgets create-budget --account-id 111122223333 \\
  --budget '{"BudgetName":"monthly","BudgetLimit":{"Amount":"100","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}' \\
  --notifications-with-subscribers '[{"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":80},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"ops@example.com"}]}]'`},
{h:'Reading spend'},
{ul:['Group by **service** to find the main cost, then by **usage type** to see what drives it (for example NAT data processing).','Use **forecasts** to see the projected month end.','Check **data transfer** lines, which hide in most bills.']},
{note:'Budgets alert but do not stop spend by default. Budget actions can apply an IAM or SCP policy or stop instances when a threshold is crossed.'}],
src:[['Cost Management','https://docs.aws.amazon.com/cost-management/latest/userguide/what-is-costmanagement.html'],['AWS Budgets','https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html']]};

/* ---------- 8 ---------- */
L['aws:3:8']={blocks:[
{p:'**Practical:** build a small governed organization and test each control.'},
{flow:['Create two OUs: Workloads and Sandbox, and move a test account into Sandbox','Attach an SCP to Sandbox that denies actions outside two Regions','Enable IAM Identity Center, create a group and a ReadOnly permission set and assign it to the account','Create a tag policy requiring an Environment tag with allowed values','Enable AWS Config and add the managed rule required-tags','Create a monthly budget with an 80 percent alert','Test: try to launch an instance in a blocked Region, create an untagged resource and sign in through the access portal']},
{h:'Verification table'},
{t:[['Control','Test','Expected'],
['SCP','Launch EC2 in a denied Region','Explicit deny in a service control policy'],
['Identity Center','Use the portal as the group member','ReadOnly session works, writes fail'],
['Tag policy','Check tag compliance report','Untagged resource reported'],
['Config rule','Open rule compliance','NON_COMPLIANT listed'],
['Budget','Lower the threshold temporarily','Email arrives']]},
{note:'Clean up: remove SCP attachments, delete rules and recorder if not needed and delete the budget.'}],
src:[['Organizations tutorials',K.ORG+'orgs_tutorials.html']]};
})();
