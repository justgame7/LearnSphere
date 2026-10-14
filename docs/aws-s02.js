/* LearnSphere - AWS Administrator, Section 02: Tools, Lab Setup & Management Interfaces.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const cred=K.dg(700,250,[
[10,10,680,230,'CLI credential lookup order (first match wins)',1],
[30,45,300,35,'1. Command-line options (--profile, --region)',0],
[30,90,300,35,'2. Environment variables (AWS_ACCESS_KEY_ID ...)',0],
[30,135,300,35,'3. Assume-role or Identity Center profile',0],
[30,180,300,35,'4. Shared credentials and config files',0],
[370,45,290,35,'5. Container credentials (ECS task role)',0],
[370,90,290,35,'6. Instance profile (EC2 role)',2]],
[]);

const three=K.dg(700,170,[
[10,10,680,150,'One environment, three ways',1],
[30,55,190,60,'Console|click and inspect',0],[255,55,190,60,'CLI|commands in scripts',0],[480,55,190,60,'CloudFormation|declared and repeatable',2]],
[]);

/* ---------- 0 ---------- */
L['aws:1:0']={blocks:[
{p:'Before building anything, prepare a **safe lab account**: protect the root user, set a budget alert and adopt a cleanup habit. Most surprise AWS bills come from a forgotten resource.'},
{h:'Setup checklist'},
{flow:['Create the account with an email address you control and a strong unique password','Enable MFA on the root user and store recovery details safely','Create an admin identity (Identity Center user or IAM user with MFA) and stop using root','Create a monthly budget with email alerts at 50, 80 and 100 percent','Tag every lab resource and delete everything when the lab ends']},
{h:'Root user hygiene'},
{ul:['Use the root user only for tasks that require it, such as closing the account or changing the support plan.','Enable **MFA** on root and do not create root access keys.','Use a distribution list or shared mailbox as the root email in production.']},
{h:'Budgets and cleanup'},
{code:`# list everything still running, by Region, before closing the lab
aws ec2 describe-instances --query "Reservations[].Instances[?State.Name!='terminated'].[InstanceId,State.Name]" --output table
aws ec2 describe-nat-gateways --query "NatGateways[?State=='available'].NatGatewayId"
aws ec2 describe-addresses --query "Addresses[].PublicIp"`},
{note:'The usual lab cost traps are NAT gateways, idle load balancers, unattached Elastic IPs, running RDS instances and large EBS snapshots.'}],
src:[['Create an AWS account','https://docs.aws.amazon.com/accounts/latest/reference/manage-acct-creating.html'],['AWS Budgets','https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html']]};

/* ---------- 1 ---------- */
L['aws:1:1']={blocks:[
{p:'The **AWS Management Console** is the web interface. Efficiency comes from knowing a few navigation features and, above all, always checking the **Region** in the top bar.'},
{h:'Key features'},
{t:[['Feature','Use'],
['Region selector','Chooses which Regional endpoint the console uses. Many resources only show in their own Region'],
['Search (Alt+S)','Jump to services, features and documentation'],
['Favorites','Pin the services you use daily to the navigation bar'],
['Recently visited','Return to services quickly'],
['Account menu','Switch role, view billing, Organizations, security credentials'],
['Unified settings','Language, default Region and favorites shown across devices'],
['Service Quotas','Check limits from the same console']]},
{h:'Habits that prevent mistakes'},
{ul:['Check the Region and account name before every change.','Use a role-assume with a clear name or color for production accounts.','Prefer read-only roles for investigation.','Use the console to explore and learn, then repeat with CLI or templates.']},
{note:'Global services (IAM, Route 53, CloudFront, Organizations) show their own location indicator. Selecting a Region does not change them.'}],
src:[['AWS Management Console','https://docs.aws.amazon.com/awsconsolehelpdocs/latest/gsg/getting-started.html']]};

/* ---------- 2 ---------- */
L['aws:1:2']={blocks:[
{p:'**AWS CloudShell** is a browser-based shell that is already authenticated as the signed-in console identity. It has the AWS CLI and common tools preinstalled and keeps a small persistent home directory.'},
{h:'What you get'},
{ul:['The AWS CLI v2, Python, Node.js, `git`, `jq` and other utilities.','**1 GB of persistent storage** per Region in the home directory. Files outside it are deleted when the session ends.','Credentials from the console session, so no keys to manage.','Files can be uploaded and downloaded through the interface.']},
{h:'When to use it'},
{t:[['Situation','Use CloudShell','Use a local terminal'],
['Quick check or fix from any browser','Yes','No'],
['Locked-down laptop with no CLI','Yes','No'],
['Long-running or heavy scripts','No','Yes'],
['Access to private VPC resources','Only with a VPC environment','Yes with VPN'],
['Reusable pipelines','No','Use CI']]},
{code:`aws sts get-caller-identity
aws s3 ls
echo "persistent" > ~/note.txt   # kept between sessions in this Region`},
{note:'CloudShell can also be created inside a VPC subnet so you can reach private resources. The identity is still the one you signed in with, so its permissions limit what you can do.'}],
src:[['AWS CloudShell','https://docs.aws.amazon.com/cloudshell/latest/userguide/welcome.html']]};

/* ---------- 3 ---------- */
L['aws:1:3']={blocks:[
{p:'The **AWS CLI v2** gives you a scriptable interface to almost every AWS API. Mastering profiles, output formats and `--query` makes it a fast investigation tool.'},
{h:'Install and configure'},
{code:`aws --version
aws configure --profile lab          # access key, secret, region, output
aws configure list --profile lab
aws configure set region eu-west-1 --profile lab
export AWS_PROFILE=lab               # use this profile by default`},
{h:'Profiles and config files'},
{t:[['File','Contains'],
['~/.aws/config','Regions, output formats, role and SSO profiles'],
['~/.aws/credentials','Access keys. Avoid long-lived keys where you can']]},
{h:'Output formats'},
{t:[['Format','Use'],
['json (default)','Full detail and for piping to jq'],
['table','Human reading'],
['text','Simple scripting with cut or awk'],
['yaml','Readable structure']]},
{h:'Filtering with --query (JMESPath)'},
{code:`aws ec2 describe-instances \\
  --query "Reservations[].Instances[].{id:InstanceId,type:InstanceType,state:State.Name}" \\
  --output table

aws ec2 describe-instances --filters Name=tag:Env,Values=prod \\
  --query "Reservations[].Instances[].InstanceId" --output text`},
{note:'`--filters` is evaluated by the service and reduces what is returned. `--query` is applied on the client after the result arrives. Use filters first for speed, then query to shape the output.'}],
src:[['AWS CLI User Guide',K.CLI+'cli-chap-welcome.html'],['Filtering output',K.CLI+'cli-usage-filter.html']]};

/* ---------- 4 ---------- */
L['aws:1:4']={blocks:[
{p:'Long-lived access keys are a risk. Modern practice is to sign in with **IAM Identity Center** or to assume a **role**, which gives temporary credentials that expire automatically.'},
{svg:cred},
{h:'Preferred patterns'},
{t:[['Pattern','Credentials','Best for'],
['IAM Identity Center (SSO) profile','Temporary, from workforce sign-in','People using many accounts'],
['Assume-role profile','Temporary, from STS','Cross-account or elevated access'],
['Instance, task or function role','Temporary, from the service','Code running on AWS'],
['Environment variables from a session','Temporary','CI jobs and scripts'],
['IAM user access key','Long-lived','Avoid. Only when nothing else works']]},
{h:'Configure SSO and role profiles'},
{code:`aws configure sso                      # sets up an IAM Identity Center profile
aws sso login --profile dev-admin
aws sts get-caller-identity --profile dev-admin

# ~/.aws/config: an assume-role profile
[profile prod-readonly]
role_arn = arn:aws:iam::111122223333:role/ReadOnly
source_profile = dev-admin
region = eu-west-1`},
{note:'Always run `aws sts get-caller-identity` when something is denied. It tells you which identity and account the CLI is actually using.'}],
src:[['Configure AWS CLI authentication',K.CLI+'cli-chap-authentication.html'],['IAM Identity Center','https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html']]};

/* ---------- 5 ---------- */
L['aws:1:5']={blocks:[
{p:'**Tags** are key-value labels on resources. They power cost allocation, access control, automation and clean-up. **Tag Editor** and **Resource Groups** help you apply and find tagged resources at scale.'},
{h:'Typical tag keys'},
{t:[['Key','Example value','Purpose'],
['Name','web-01','Console display name'],
['Environment','prod','Filtering and policy'],
['Owner','team-payments','Accountability'],
['CostCenter','1234','Cost allocation'],
['Expiry','2026-12-31','Lab clean-up']]},
{h:'Working with tags'},
{code:`aws ec2 create-tags --resources i-0abc123 --tags Key=Owner,Value=ops Key=Environment,Value=lab
aws resourcegroupstaggingapi get-resources --tag-filters Key=Environment,Values=lab \\
  --query "ResourceTagMappingList[].ResourceARN"
aws resourcegroupstaggingapi tag-resources --resource-arn-list <arn> --tags Owner=ops`},
{h:'Tag Editor and Resource Groups'},
{ul:['**Tag Editor** searches many resource types across Regions and edits their tags in bulk.','**Resource Groups** define a group by tag query and give you a single place to act (for example Systems Manager actions on a group).','Tags must be **activated as cost allocation tags** in Billing before they appear in cost reports.']},
{note:'Tags are case sensitive and not every resource supports them at creation. Enforce naming with tag policies and check coverage regularly.'}],
src:[['Tagging best practices','https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/tagging-best-practices.html'],['Resource Groups and Tag Editor','https://docs.aws.amazon.com/ARG/latest/userguide/resource-groups.html']]};

/* ---------- 6 ---------- */
L['aws:1:6']={blocks:[
{p:'Creating the **same small environment three ways** shows the strengths of each interface. The console teaches, the CLI scripts, and CloudFormation makes it repeatable and reviewable.'},
{svg:three},
{h:'The lab'},
{flow:['Create an S3 bucket with versioning in the console and inspect its settings','Delete it, then recreate it with the CLI','Delete it again, then create it from a CloudFormation template','Compare effort, repeatability and drift risk','Delete the stack and confirm nothing is left']},
{h:'CLI version'},
{code:`aws s3api create-bucket --bucket lab-demo-12345 --region eu-west-1 \\
  --create-bucket-configuration LocationConstraint=eu-west-1
aws s3api put-bucket-versioning --bucket lab-demo-12345 \\
  --versioning-configuration Status=Enabled`},
{h:'CloudFormation version'},
{code:`AWSTemplateFormatVersion: '2010-09-09'
Resources:
  Bucket:
    Type: AWS::S3::Bucket
    Properties:
      VersioningConfiguration:
        Status: Enabled
Outputs:
  BucketName:
    Value: !Ref Bucket`},
{code:`aws cloudformation deploy --template-file bucket.yaml --stack-name lab-bucket
aws cloudformation delete-stack --stack-name lab-bucket`},
{h:'Comparison'},
{t:[['Interface','Strength','Weakness'],
['Console','Fast to explore, guided','Not repeatable, easy to miss a setting'],
['CLI','Scriptable and quick','Imperative, must handle existing state'],
['CloudFormation','Declarative, reviewable, rollback','Learning curve, slower for one-off fixes']]}],
src:[['CloudFormation getting started',K.CFN+'GettingStarted.html']]};
})();
