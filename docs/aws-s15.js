/* LearnSphere - AWS Administrator, Section 15: Systems Manager & Operational Automation.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const suite=K.dg(700,250,[
[10,10,680,230,'Systems Manager capabilities',1],
[25,50,150,50,'Session Manager',0],[195,50,150,50,'Run Command',0],[365,50,150,50,'Patch Manager',2],[535,50,140,50,'State Manager',0],
[25,120,150,50,'Automation',0],[195,120,150,50,'Parameter Store',0],[365,120,150,50,'Inventory',0],[535,120,140,50,'OpsCenter',0],
[25,190,650,35,'All act on managed nodes through the SSM Agent and IAM, with no inbound ports',0]],
[]);

const managed=K.dg(700,200,[
[10,10,680,180,'What makes a node managed',1],
[30,60,140,60,'SSM Agent|installed and running',0],[210,60,150,60,'IAM permission|instance profile or|hybrid activation',2],[400,60,130,60,'Network path|SSM endpoints',0],[570,60,100,60,'Managed|node',0]],
[[170,90,210,90],[360,90,400,90],[530,90,570,90]]);

const patch=K.dg(700,200,[
[10,10,680,180,'Patching workflow',1],
[25,60,120,60,'Patch baseline|what is approved',0],[175,60,120,60,'Patch group|tag on instances',0],[325,60,130,60,'Maintenance window|when',2],[485,60,190,60,'Run patch baseline|scan or install,|report compliance',0]],
[[145,90,175,90],[295,90,325,90],[455,90,485,90]]);

/* ---------- 0 ---------- */
L['aws:14:0']={blocks:[
{p:'**AWS Systems Manager** is the operations hub for your fleet. It acts on **managed nodes**: EC2 instances, on-premises servers and edge devices running the **SSM Agent**.'},
{svg:suite},
{svg:managed},
{h:'Making a node managed'},
{ul:['**SSM Agent** is preinstalled on Amazon Linux and many Windows and Ubuntu AMIs.','The instance needs an **instance profile** with `AmazonSSMManagedInstanceCore` (or equivalent).','It needs a network path to the SSM, SSMMessages and EC2Messages endpoints: internet, NAT or VPC endpoints.','**Hybrid activations** register on-premises servers with an activation code and ID, and they get `mi-` IDs.']},
{code:`aws ssm describe-instance-information --query "InstanceInformationList[].[InstanceId,PingStatus,PlatformName,AgentVersion]" --output table
aws ssm create-activation --default-instance-name onprem --iam-role SSMServiceRole --registration-limit 10`},
{note:'If an instance is missing from Fleet Manager, work through the three prerequisites: agent running, role attached, endpoint reachable.'}],
src:[['AWS Systems Manager',K.SSM+'what-is-systems-manager.html']]};

/* ---------- 1 ---------- */
L['aws:14:1']={blocks:[
{p:'**Session Manager** gives an interactive shell or PowerShell session with **no open inbound port, no bastion host and no SSH keys**. Access is controlled with IAM.'},
{h:'Benefits'},
{ul:['Access is **authorized by IAM** and can be limited by tags.','Every session can be **logged** to S3 and CloudWatch Logs, including commands.','Port forwarding lets you reach private databases through an instance.','CloudTrail records who started a session.']},
{code:`aws ssm start-session --target i-0abc123
aws ssm start-session --target i-0abc123 --document-name AWS-StartPortForwardingSession \\
  --parameters '{"portNumber":["5432"],"localPortNumber":["5432"]}'
aws ssm terminate-session --session-id <id>`},
{h:'IAM for users'},
{code:`{
  "Effect": "Allow",
  "Action": ["ssm:StartSession"],
  "Resource": "arn:aws:ec2:*:*:instance/*",
  "Condition": {"StringEquals": {"ssm:resourceTag/Environment": "dev"}}
}`},
{note:'Session preferences (logging destinations, idle timeout, shell profile) apply account-wide per Region. Set them once and verify logs arrive.'}],
src:[['Session Manager',K.SSM+'session-manager.html']]};

/* ---------- 2 ---------- */
L['aws:14:2']={blocks:[
{p:'**Run Command** executes a **document** (script or action) on many nodes at once, with targeting by tag, resource group or instance ID.'},
{ul:['Documents such as `AWS-RunShellScript` and `AWS-RunPowerShellScript`.','**Rate controls**: concurrency and error threshold, so a bad command stops early.','Output goes to the console, S3 or CloudWatch Logs.','Everything is logged in CloudTrail and requires IAM permission.']},
{code:`aws ssm send-command --document-name AWS-RunShellScript \\
  --targets "Key=tag:Environment,Values=dev" \\
  --parameters 'commands=["df -h","uptime"]' \\
  --max-concurrency 10 --max-errors 2 --output-s3-bucket-name my-ssm-output
aws ssm list-command-invocations --command-id <id> --details --query "CommandInvocations[].[InstanceId,Status]"`},
{h:'Statuses'},
{t:[['Status','Meaning'],
['Pending, InProgress','Waiting or running'],
['Success','Exit code 0'],
['Failed','Non-zero exit code'],
['TimedOut','Did not finish in the time limit'],
['Undeliverable','Node offline or not managed']]},
{note:'Use maintenance windows or State Manager for recurring work, not ad-hoc Run Command by hand.'}],
src:[['Run Command',K.SSM+'run-command.html']]};

/* ---------- 3 ---------- */
L['aws:14:3']={blocks:[
{p:'**Patch Manager** scans and installs operating system patches according to a **patch baseline**, on a schedule you set.'},
{svg:patch},
{t:[['Piece','Meaning'],
['Patch baseline','Rules for approved patches by classification, severity and auto-approval delay; AWS provides defaults per OS'],
['Patch group','A tag (Patch Group) that ties instances to a custom baseline'],
['Maintenance window','Schedule, duration and targets for patching tasks'],
['AWS-RunPatchBaseline','The document that scans or installs'],
['Compliance','Reports which instances are missing approved patches']]},
{code:`aws ssm create-patch-baseline --name linux-prod --operating-system AMAZON_LINUX_2023 \\
  --approval-rules "PatchRules=[{PatchFilterGroup={PatchFilters=[{Key=CLASSIFICATION,Values=[Security]}]},ApproveAfterDays=7}]"
aws ssm register-patch-baseline-for-patch-group --baseline-id pb-0abc --patch-group prod
aws ssm describe-instance-patch-states --instance-ids i-0abc`},
{note:'Scan and Install are different operations. Many teams scan daily and install in a controlled window. Reboot behaviour is part of the install operation and must be planned.'}],
src:[['Patch Manager',K.SSM+'patch-manager.html']]};

/* ---------- 4 ---------- */
L['aws:14:4']={blocks:[
{p:'**State Manager** keeps nodes in a **desired state** by running a document repeatedly through an **association**.'},
{h:'Typical uses'},
{ul:['Install and configure the CloudWatch agent on all instances.','Make sure an antivirus agent or SSM Agent is current.','Apply a hardening script and re-apply if drift occurs.','Gather inventory on a schedule.']},
{code:`aws ssm create-association --name AWS-ConfigureAWSPackage \\
  --targets "Key=tag:Environment,Values=prod" \\
  --parameters '{"action":["Install"],"name":["AmazonCloudWatchAgent"]}' \\
  --schedule-expression "rate(1 day)"
aws ssm list-associations --association-filter-list key=Status,value=Failed`},
{ul:['Associations report **compliance** per node.','They run when a new matching instance appears, not only on schedule.','Use **targets by tag** so new instances are covered automatically.']},
{note:'State Manager enforces configuration. Use CloudFormation for infrastructure and State Manager for what runs inside the instances.'}],
src:[['State Manager',K.SSM+'systems-manager-state.html']]};

/* ---------- 5 ---------- */
L['aws:14:5']={blocks:[
{p:'**Automation runbooks** are multi-step workflows that call AWS APIs, run scripts and wait for results. AWS provides many (`AWS-RestartEC2Instance`, `AWSSupport-TroubleshootRDP`) and you can write your own.'},
{h:'Key points'},
{ul:['Run **manually, on a schedule, from EventBridge, Config remediation** or a maintenance window.','Steps can approve, branch, retry and wait.','The runbook acts using an **assume role**, so it needs only what the task requires.','**Rate control** applies to multi-target runs.']},
{code:`aws ssm start-automation-execution --document-name AWS-RestartEC2Instance \\
  --parameters "InstanceId=i-0abc,AutomationAssumeRole=arn:aws:iam::111122223333:role/SSMAutomation"
aws ssm get-automation-execution --automation-execution-id <id> --query AutomationExecution.[Status,FailureMessage]`},
{code:`schemaVersion: '0.3'
parameters:
  InstanceId: {type: String}
mainSteps:
  - name: stop
    action: aws:changeInstanceState
    inputs: {InstanceIds: ['{{ InstanceId }}'], DesiredState: stopped}
  - name: start
    action: aws:changeInstanceState
    inputs: {InstanceIds: ['{{ InstanceId }}'], DesiredState: running}`},
{note:'Always test a runbook with one non-production instance and add an approval step for destructive actions.'}],
src:[['Systems Manager Automation',K.SSM+'systems-manager-automation.html']]};

/* ---------- 6 ---------- */
L['aws:14:6']={blocks:[
{p:'**Parameter Store** holds configuration values and secrets as parameters in a **hierarchy**, with versions and IAM-based access.'},
{t:[['Type','Use'],
['String','Plain text configuration'],
['StringList','Comma separated values'],
['SecureString','Encrypted with KMS, for secrets']]},
{h:'Tiers'},
{t:[['','Standard','Advanced'],
['Parameters','10,000','100,000'],
['Value size','4 KB','8 KB'],
['Policies (expiry, notification)','No','Yes'],
['Cost','Free','Per parameter per month']]},
{code:`aws ssm put-parameter --name /app/prod/db/host --type String --value db.internal
aws ssm put-parameter --name /app/prod/db/password --type SecureString --value 'S3cret' --key-id alias/app
aws ssm get-parameters-by-path --path /app/prod --recursive --with-decryption
aws ssm get-parameter-history --name /app/prod/db/password`},
{ul:['Design paths like `/app/env/component/key` and grant access by path.','CloudFormation can reference parameters directly, and many services read them.','For automatic rotation of credentials use **Secrets Manager**.']},
{note:'Public parameters under `/aws/service/` give current AMI IDs, for example the latest Amazon Linux image.'}],
src:[['Parameter Store',K.SSM+'systems-manager-parameter-store.html']]};

/* ---------- 7 ---------- */
L['aws:14:7']={blocks:[
{p:'Three capabilities help you **see and track** the fleet.'},
{t:[['Capability','What it gives'],
['Inventory','Collects installed applications, files, network config, Windows updates and custom data from managed nodes on a schedule. Query across accounts with resource data sync to S3'],
['Fleet Manager','Console view of managed nodes: file system, processes, registry, users and remote desktop without opening ports'],
['OpsCenter','A central place for operational work items (OpsItems) with related resources, runbooks and history. Alarms and EventBridge can create them']]},
{code:`aws ssm get-inventory --filters "Key=AWS:Application.Name,Values=nginx,Type=Equal"
aws ssm create-ops-item --title "High disk usage" --description "web-01 above 90 percent" --source ops --priority 2`},
{ul:['**Resource Data Sync** exports inventory to S3 for Athena queries.','Use inventory to prove which instances run a vulnerable version.','OpsItems link to CloudWatch alarms and Automation runbooks for response.']},
{note:'Inventory only knows what the agent can read and what you enabled. Create a State Manager association so it runs regularly.'}],
src:[['Inventory',K.SSM+'systems-manager-inventory.html'],['OpsCenter',K.SSM+'OpsCenter.html']]};

/* ---------- 8 ---------- */
L['aws:14:8']={blocks:[
{p:'**Event-driven remediation** fixes a problem automatically when it is detected. Choose the trigger and the action, and keep the action narrow and safe.'},
{t:[['Trigger','Action','Example'],
['EventBridge event','Lambda or SSM Automation','Re-add a required tag after an untagged launch'],
['CloudWatch alarm','SSM Automation or Lambda via SNS','Restart a service when a health metric fails'],
['AWS Config non-compliant rule','Automatic or manual remediation with an SSM document','Block public access on a bucket'],
['GuardDuty or Security Hub finding','Lambda or Automation','Isolate an instance with a quarantine security group']]},
{code:`aws configservice put-remediation-configurations --remediation-configurations '[{
  "ConfigRuleName":"s3-bucket-public-read-prohibited","TargetType":"SSM_DOCUMENT",
  "TargetId":"AWS-DisableS3BucketPublicReadWrite","Automatic":true,
  "MaximumAutomaticAttempts":3,"RetryAttemptSeconds":60,
  "Parameters":{"AutomationAssumeRole":{"StaticValue":{"Values":["arn:aws:iam::111122223333:role/ConfigRemediation"]}},
                "S3BucketName":{"ResourceValue":{"Value":"RESOURCE_ID"}}}}]'`},
{h:'Guard rails'},
{ul:['Start in **manual** mode and watch results before enabling automatic.','Limit **attempts** and notify on failure.','Use dedicated, narrow IAM roles.','Log every remediation action for audit.']}],
src:[['Config remediation','https://docs.aws.amazon.com/config/latest/developerguide/remediation.html']]};

/* ---------- 9 ---------- */
L['aws:14:9']={blocks:[
{p:'**Practical:** patch a fleet, collect inventory and auto-remediate a failed rule.'},
{flow:['Launch two instances with the SSM role and a Patch Group tag','Create a patch baseline and register it to the patch group','Run AWS-RunPatchBaseline in Scan mode and read compliance','Create a maintenance window that installs patches on the tagged group','Create an inventory association and query installed applications','Create a Config rule for required tags and attach the remediation runbook','Launch an untagged instance and watch it be corrected, then clean up']},
{t:[['Check','Where'],
['Patch results','Patch Manager dashboard and compliance'],
['Inventory','Fleet Manager and get-inventory'],
['Remediation','Config rule history and Automation executions']]},
{note:'Restrict the remediation role to the single action it performs. An over-privileged automation role is a shortcut for an attacker.'}],
src:[['Systems Manager tutorials',K.SSM+'systems-manager-tutorials.html']]};
})();
