/* LearnSphere - AWS Administrator, Section 03: Identity & Access Management (IAM).
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const iam=K.dg(700,240,[
[10,10,680,220,'IAM building blocks',1],
[30,50,130,50,'Users',0],[30,120,130,50,'Groups',0],
[230,50,150,50,'Roles',2],[230,120,150,50,'Policies',0],
[460,50,200,50,'Principals: users, roles,|services, federated',0],[460,120,200,50,'Resources',0]],
[[160,75,230,75],[160,145,230,145],[380,75,460,75],[380,145,460,145]]);

const eval_=K.dg(700,250,[
[10,10,680,230,'Policy evaluation (same account)',1],
[30,50,150,60,'Explicit deny|anywhere?',0],[220,50,150,60,'SCP and|boundary allow?',0],[410,50,150,60,'Identity or resource|policy allows?',0],
[30,150,150,50,'DENY',2],[220,150,150,50,'DENY',2],[410,150,150,50,'DENY',2],[590,50,90,60,'ALLOW',2]],
[[180,80,220,80],[370,80,410,80],[560,80,590,80],[105,110,105,150],[295,110,295,150],[485,110,485,150]]);

const role=K.dg(700,200,[
[10,10,680,180,'Assuming a role',1],
[30,60,140,60,'Principal|(user or service)',0],[250,60,150,60,'Trust policy|allows who',2],[480,60,170,60,'Temporary credentials|from STS',0]],
[[170,90,250,90],[400,90,480,90]]);

const fed=K.dg(700,200,[
[10,10,680,180,'Workforce federation',1],
[30,60,130,60,'User',0],[210,60,160,60,'Identity provider|SAML or OIDC',0],[420,60,110,60,'AWS STS or|Identity Center',2],[570,60,110,60,'AWS role',0]],
[[160,90,210,90],[370,90,420,90],[530,90,570,90]]);

/* ---------- 0 ---------- */
L['aws:2:0']={blocks:[
{p:'**AWS Identity and Access Management (IAM)** controls **who** (authentication) can do **what** (authorization) on **which resources**. It is global, free and part of every request.'},
{svg:iam},
{h:'Core concepts'},
{t:[['Concept','Meaning'],
['Principal','An entity that can make requests: user, role, federated user, AWS service, anonymous'],
['Identity','A user, group or role that policies attach to'],
['Policy','A JSON document that allows or denies actions'],
['Authentication','Proving who you are'],
['Authorization','Deciding what you may do']]},
{h:'The root user'},
{p:'Every account has a **root user** with complete access that cannot be limited by IAM policies. Use it only for the few tasks that require it, such as changing account settings, closing the account or restoring IAM access. Protect it with MFA and no access keys.'},
{note:'IAM has no Regions: users, roles and policies are available in every Region of the account. Region-specific restrictions are done with policy conditions.'}],
src:[['What is IAM',K.IAM+'introduction.html'],['IAM best practices',K.IAM+'best-practices.html']]};

/* ---------- 1 ---------- */
L['aws:2:1']={blocks:[
{p:'An **IAM user** represents a person or application with long-term credentials. A **group** is a collection of users that policies attach to. Prefer groups for permissions and roles for workloads.'},
{h:'Credentials'},
{t:[['Credential','Used for','Notes'],
['Console password','Sign in to the console','Pair with MFA'],
['Access key (ID plus secret)','CLI and SDK','Long-lived. Rotate or avoid'],
['MFA device','Second factor','Authenticator app, passkey or hardware key'],
['SSH or Git credentials','CodeCommit and similar','Service-specific']]},
{h:'Access key lifecycle'},
{flow:['Create the key and store the secret immediately (it is shown once)','Use it and track last used','Create a second key before rotating','Switch applications to the new key','Deactivate the old key, watch for errors, then delete it']},
{code:`aws iam create-user --user-name alice
aws iam create-group --group-name ops
aws iam add-user-to-group --group-name ops --user-name alice
aws iam list-access-keys --user-name alice
aws iam get-access-key-last-used --access-key-id AKIA...`},
{note:'A user can have at most two access keys, which makes safe rotation possible. For people, prefer IAM Identity Center. For workloads, prefer roles.'}],
src:[['IAM users',K.IAM+'id_users.html'],['Managing access keys',K.IAM+'id-credentials-access-keys-update.html']]};

/* ---------- 2 ---------- */
L['aws:2:2']={blocks:[
{p:'An **account password policy** sets rules for IAM user passwords. **Multi-factor authentication (MFA)** adds a second proof of identity and is the single most effective protection for sign-in.'},
{h:'Password policy settings'},
{ul:['Minimum length and character types.','Expiration and reuse prevention.','Whether users may change their own password.','Whether an administrator must reset after expiry.']},
{h:'MFA factor types'},
{t:[['Factor','Example','Notes'],
['Passkey (FIDO2) and security key','YubiKey, platform passkey','Phishing resistant, preferred'],
['Virtual authenticator app','Authenticator on a phone','Common and low cost'],
['Hardware TOTP token','Key fob','Rare']]},
{h:'Enforcing MFA'},
{p:'A policy can deny everything except MFA setup when the request has no MFA. The condition key is `aws:MultiFactorAuthPresent`.'},
{code:`{
  "Effect": "Deny",
  "NotAction": ["iam:CreateVirtualMFADevice","iam:EnableMFADevice","iam:ListMFADevices","sts:GetSessionToken"],
  "Resource": "*",
  "Condition": {"BoolIfExists": {"aws:MultiFactorAuthPresent": "false"}}
}`},
{note:'Each user can register several MFA devices. Register a backup so a lost phone does not lock someone out.'}],
src:[['MFA in AWS',K.IAM+'id_credentials_mfa.html'],['Account password policy',K.IAM+'id_credentials_passwords_account-policy.html']]};

/* ---------- 3 ---------- */
L['aws:2:3']={blocks:[
{p:'An **IAM policy** is a JSON document of statements. Each statement says **Effect** (Allow or Deny) for **Actions** on **Resources**, optionally with **Conditions**.'},
{h:'Anatomy of a statement'},
{code:`{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "ReadLogsBucket",
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": ["arn:aws:s3:::my-logs", "arn:aws:s3:::my-logs/*"],
    "Condition": {"IpAddress": {"aws:SourceIp": "203.0.113.0/24"}}
  }]
}`},
{t:[['Element','Meaning'],
['Effect','Allow or Deny'],
['Action / NotAction','API operations such as s3:GetObject'],
['Resource / NotResource','ARN the action applies to'],
['Principal','Who, only in resource-based and trust policies'],
['Condition','Extra requirements such as IP, tag or MFA']]},
{h:'Policy types for identities'},
{t:[['Type','Managed by','Reusable'],
['AWS managed','AWS, updated by AWS','Yes'],
['Customer managed','You, versioned','Yes'],
['Inline','Embedded in one identity','No']]},
{h:'Evaluation logic'},
{svg:eval_},
{ul:['Everything is **denied by default**.','An **explicit Deny** in any applicable policy always wins.','Otherwise at least one applicable Allow is needed.']},
{note:'In the same account an identity-based Allow or a resource-based Allow is enough. For cross-account access both sides must allow.'}],
src:[['Policies and permissions',K.IAM+'access_policies.html'],['Policy evaluation logic',K.IAM+'reference_policies_evaluation-logic.html']]};

/* ---------- 4 ---------- */
L['aws:2:4']={blocks:[
{p:'A **resource-based policy** is attached to a resource such as an S3 bucket, SQS queue, KMS key or role trust policy. It names a `Principal` and can grant access to principals in **other accounts**.'},
{h:'Same account versus cross account'},
{t:[['Case','Needed'],
['Same account','Either the identity policy or the resource policy allows (and nothing denies)'],
['Cross account','Resource policy allows the principal AND the principal identity policy allows the action']]},
{h:'Example: bucket policy granting another account read access'},
{code:`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": "arn:aws:iam::222233334444:root"},
    "Action": ["s3:GetObject"],
    "Resource": "arn:aws:s3:::shared-data/*"
  }]
}`},
{p:'The `:root` principal means the **account**. The administrators of account 2222-3333-4444 must then grant their own users or roles permission to call `s3:GetObject`.'},
{h:'Resource policy or role?'},
{t:[['Approach','Behaviour'],
['Resource policy','Principal keeps its own identity and permissions, access is added'],
['Assume a role','Principal gives up its identity and uses the role permissions']]},
{note:'Not every service supports resource policies. Those that do include S3, SQS, SNS, KMS, Lambda, Secrets Manager and ECR.'}],
src:[['Cross-account resource access',K.IAM+'access_policies-cross-account-resource-access.html']]};

/* ---------- 5 ---------- */
L['aws:2:5']={blocks:[
{p:'An **IAM role** is an identity with permissions but no long-term credentials. A principal **assumes** the role and receives **temporary credentials** from the **Security Token Service (STS)**.'},
{svg:role},
{h:'Two policies on every role'},
{t:[['Policy','Question it answers'],
['Trust policy','Who may assume this role?'],
['Permissions policy','What can the role do once assumed?']]},
{code:`# trust policy: let EC2 assume the role
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ec2.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}`},
{h:'STS in practice'},
{code:`aws sts assume-role --role-arn arn:aws:iam::111122223333:role/Deploy \\
  --role-session-name ops-session --duration-seconds 3600
aws sts get-caller-identity`},
{ul:['Session duration defaults to **1 hour**. A role can allow up to 12 hours (role chaining limits it to 1 hour).','**Instance profiles** are the wrapper that attaches a role to an EC2 instance.','Services such as Lambda and ECS use roles through their own execution or task role settings.']},
{note:'Use roles for applications, services and cross-account access. A role never has an access key of its own.'}],
src:[['IAM roles',K.IAM+'id_roles.html'],['Temporary credentials',K.IAM+'id_credentials_temp.html']]};

/* ---------- 6 ---------- */
L['aws:2:6']={blocks:[
{p:'**Conditions** restrict when a statement applies. **Permissions boundaries** set the maximum permissions an identity can have, which allows safe delegation of role creation.'},
{h:'Common condition keys'},
{t:[['Key','Use'],
['aws:SourceIp','Restrict to a network range'],
['aws:MultiFactorAuthPresent','Require MFA'],
['aws:RequestedRegion','Limit Regions'],
['aws:PrincipalTag/Key, aws:ResourceTag/Key','Tag-based control'],
['aws:SecureTransport','Require TLS'],
['aws:CurrentTime','Time windows'],
['aws:PrincipalOrgID','Only principals from your organization']]},
{code:`"Condition": {
  "StringEquals": {"aws:RequestedRegion": ["eu-west-1","eu-central-1"]},
  "Bool": {"aws:MultiFactorAuthPresent": "true"}
}`},
{h:'Permissions boundary'},
{p:'A boundary is a managed policy set on a user or role. The identity gets only what **both** its identity policies **and** its boundary allow. It does not grant anything on its own.'},
{flow:['A developer is allowed to create roles but only with a specific boundary attached','Any role they create is capped by that boundary','They cannot escalate beyond the boundary even with AdministratorAccess on the new role']},
{note:'Boundaries limit; they never add. Service control policies in Organizations provide the same cap at the account and OU level.'}],
src:[['Condition keys',K.IAM+'reference_policies_condition-keys.html'],['Permissions boundaries',K.IAM+'access_policies_boundaries.html']]};

/* ---------- 7 ---------- */
L['aws:2:7']={blocks:[
{p:'**Federation** lets people use an existing identity (corporate directory or a web identity) to get AWS access, without creating an IAM user for each person.'},
{svg:fed},
{h:'Options'},
{t:[['Option','For','Notes'],
['IAM Identity Center','Workforce access to many accounts and applications','Preferred. Connects to your directory or an external IdP'],
['IAM SAML provider','Enterprise single sign-on to the console','Direct federation with a SAML 2.0 IdP'],
['IAM OIDC provider','Web identities, GitHub Actions, Kubernetes service accounts','Exchanges a token for role credentials'],
['Amazon Cognito','Application end users','Not for administrators']]},
{h:'What the administrator configures'},
{ul:['An identity provider entity in IAM or an Identity Center connection.','A role whose **trust policy** names the provider and conditions on claims.','Group or attribute mapping so the right people get the right role.']},
{note:'For CI systems such as GitHub Actions, use an OIDC provider and a role with a trust condition on the repository, rather than storing access keys as secrets.'}],
src:[['Identity providers and federation',K.IAM+'id_roles_providers.html'],['IAM Identity Center','https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html']]};

/* ---------- 8 ---------- */
L['aws:2:8']={blocks:[
{p:'When access is unexpectedly denied or allowed, use the right tool to find out **why** and **who did what**.'},
{t:[['Tool','Answers'],
['Policy Simulator','Would this identity be allowed this action on this resource, and by which statement?'],
['IAM Access Analyzer (external access)','Which resources are shared outside the account or organization?'],
['Access Analyzer (unused access, policy generation)','Which permissions and keys are unused? What policy fits the activity?'],
['Credential report','Account-wide CSV of users, passwords, keys and MFA'],
['Last accessed information','When was a service or action last used by an identity?'],
['CloudTrail','Who called which API, when and from where']]},
{h:'A denied request'},
{flow:['Read the error: it names the principal, action and sometimes the policy type','Confirm the identity with get-caller-identity','Test the action in the policy simulator','Check SCPs, boundaries, session policies and resource policies for a deny','Look up the event in CloudTrail for the exact request']},
{code:`aws iam generate-credential-report
aws iam get-credential-report --query Content --output text | base64 --decode
aws iam simulate-principal-policy --policy-source-arn <role-arn> \\
  --action-names s3:GetObject --resource-arns arn:aws:s3:::my-bucket/*`},
{note:'A message such as "with an explicit deny in a service control policy" tells you where to look. Read the whole error before changing policies.'}],
src:[['Troubleshooting IAM',K.IAM+'troubleshoot.html'],['IAM Access Analyzer',K.IAM+'what-is-access-analyzer.html']]};

/* ---------- 9 ---------- */
L['aws:2:9']={blocks:[
{p:'**Practical:** give an operations team the access it needs, and no more, then prove it works and audit it.'},
{h:'Design'},
{t:[['Need','Mechanism'],
['Operators view everything','Group with ReadOnlyAccess'],
['Operators restart instances tagged for their team','Role with tag-condition policy'],
['No one deletes backups','Explicit deny on backup deletion'],
['Everyone uses MFA','Deny without MFA'],
['Auditors see logs only','Separate read-only role for CloudTrail and logs']]},
{h:'Steps'},
{flow:['Create group ops and attach ReadOnlyAccess','Create a customer managed policy that allows ec2:StartInstances and StopInstances when the resource tag Team equals the principal tag Team','Create a role for the policy and set a trust policy allowing the group users','Test with the policy simulator for a tagged and untagged instance','Run the credential report and an Access Analyzer scan and clean up unused items']},
{code:`{
  "Effect": "Allow",
  "Action": ["ec2:StartInstances","ec2:StopInstances"],
  "Resource": "arn:aws:ec2:*:*:instance/*",
  "Condition": {"StringEquals": {"aws:ResourceTag/Team": "\${aws:PrincipalTag/Team}"}}
}`},
{note:'Tag-based conditions scale better than listing instance ARNs. They are only as strong as your control over who can change tags.'}],
src:[['ABAC for AWS',K.IAM+'introduction_attribute-based-access-control.html']]};
})();
