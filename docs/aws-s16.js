/* LearnSphere - AWS Administrator, Section 16: CloudFormation, CDK & Deployment.
   Lectures 0-10 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const tools=K.dg(700,200,[
[10,10,680,180,'Describe, then provision',1],
[25,60,140,60,'Template|YAML or JSON',0],[195,60,140,60,'CloudFormation|stack',2],[365,60,150,60,'Resources|created and updated',0],
[25,135,140,35,'CDK code',0],[195,135,140,35,'Terraform',0]],
[[165,90,195,90],[335,90,365,90],[165,152,195,100],[335,152,365,105]]);

const life=K.dg(700,200,[
[10,10,680,180,'Stack lifecycle',1],
[25,70,110,60,'Create|CREATE_COMPLETE',0],[165,70,120,60,'Change set|preview',2],[315,70,120,60,'Update|UPDATE_COMPLETE',0],[465,70,100,60,'Failure|ROLLBACK',0],[595,70,80,60,'Delete',0]],
[[135,100,165,100],[285,100,315,100],[435,100,465,100],[565,100,595,100]]);

const stackset=K.dg(700,200,[
[10,10,680,180,'StackSets',1],
[30,70,140,60,'Admin account|StackSet',2],[280,40,150,40,'Account A, Region 1',0],[280,95,150,40,'Account B, Region 1',0],[280,150,150,30,'Account B, Region 2',0],[520,70,150,60,'Stack instances|same template',0]],
[[170,100,280,60],[170,100,280,115],[170,100,280,165],[430,100,520,100]]);

/* ---------- 0 ---------- */
L['aws:15:0']={blocks:[
{p:'**Infrastructure as code (IaC)** defines infrastructure in files that can be reviewed, versioned and deployed repeatably. It replaces click-ops and prevents drift between environments.'},
{svg:tools},
{t:[['Tool','Language','State','Notes'],
['CloudFormation','YAML or JSON templates','Managed by AWS in the stack','Native, no extra tool, automatic rollback'],
['AWS CDK','TypeScript, Python, Java and others','Generates CloudFormation','Loops, classes, higher level constructs'],
['Terraform','HCL','State file you manage','Multi-cloud, covered in the Terraform course'],
['SAM','Template extension','CloudFormation','Serverless focus']]},
{h:'Why administrators care'},
{ul:['Every change is a **reviewed diff** instead of a console action.','New environments are created from the same definition.','Deleting a stack removes everything it created, so labs clean up reliably.','Drift detection finds manual changes.']},
{note:'The choice of tool is mostly organizational. The administrator skill is reading templates, diagnosing failed stacks and operating deployments, whatever tool wrote them.'}],
src:[['AWS CloudFormation',K.CFN+'Welcome.html'],['AWS CDK','https://docs.aws.amazon.com/cdk/v2/guide/home.html']]};

/* ---------- 1 ---------- */
L['aws:15:1']={blocks:[
{p:'A **template** has a small number of sections. Only `Resources` is required.'},
{t:[['Section','Purpose'],
['Parameters','Inputs supplied at deploy time, with types, defaults and constraints'],
['Mappings','Static lookup tables, for example AMI by Region'],
['Conditions','Create things only if a condition is true'],
['Resources','The AWS resources to create (required)'],
['Outputs','Values to show or export'],
['Rules, Transform, Metadata','Validation, macros such as SAM, and descriptive data']]},
{code:`AWSTemplateFormatVersion: '2010-09-09'
Parameters:
  Env: {Type: String, AllowedValues: [dev, prod], Default: dev}
  AmiId: {Type: 'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>', Default: /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64}
Conditions:
  IsProd: !Equals [!Ref Env, prod]
Resources:
  Web:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: !Ref AmiId
      InstanceType: !If [IsProd, m7g.large, t3.micro]
      Tags: [{Key: Name, Value: !Sub 'web-\${Env}'}]
Outputs:
  InstanceId: {Value: !Ref Web}`},
{h:'Intrinsic functions to recognize'},
{t:[['Function','Does'],
['!Ref','Parameter value or resource ID'],
['!GetAtt','An attribute such as an ARN or DNS name'],
['!Sub','String substitution'],
['!Join, !Select, !Split','String and list handling'],
['!If, !Equals','Conditional values'],
['!ImportValue','Use an exported output of another stack']]}],
src:[['Template anatomy',K.CFN+'template-anatomy.html']]};

/* ---------- 2 ---------- */
L['aws:15:2']={blocks:[
{p:'A **stack** is the deployed instance of a template. Updating it applies only the differences, and a **change set** shows them first.'},
{svg:life},
{code:`aws cloudformation validate-template --template-body file://app.yaml
aws cloudformation create-change-set --stack-name app --change-set-name v2 \\
  --template-body file://app.yaml --capabilities CAPABILITY_IAM --parameters ParameterKey=Env,ParameterValue=prod
aws cloudformation describe-change-set --stack-name app --change-set-name v2 --query "Changes[].ResourceChange.[Action,LogicalResourceId,Replacement]" --output table
aws cloudformation execute-change-set --stack-name app --change-set-name v2`},
{h:'Update behaviour'},
{t:[['Behaviour','Meaning'],
['No interruption','Updated in place'],
['Some interruption','Brief outage, for example a reboot'],
['Replacement','New resource created, old deleted. Physical ID changes']]},
{ul:['Always read the **Replacement** column in a change set before executing.','`deploy` combines create or update with a change set.','Use **termination protection** on important stacks.','**Stack policies** protect named resources from updates.']},
{note:'Replacing a database or a stateful resource can destroy data. Use `DeletionPolicy: Snapshot` or `Retain` and review replacements carefully.'}],
src:[['Change sets',K.CFN+'using-cfn-updating-stacks-changesets.html']]};

/* ---------- 3 ---------- */
L['aws:15:3']={blocks:[
{p:'Large templates become hard to manage. Two patterns split them.'},
{t:[['Pattern','How','Use when'],
['Nested stacks','A parent template creates child stacks with AWS::CloudFormation::Stack','Reuse a component many times, parent owns the lifecycle'],
['Cross-stack references','Stack A exports a value, stack B imports it with Fn::ImportValue','Separate lifecycles, such as network and applications']]},
{code:`# network stack
Outputs:
  VpcId:
    Value: !Ref Vpc
    Export: {Name: !Sub '\${AWS::StackName}-VpcId'}

# application stack
Resources:
  Sg:
    Type: AWS::EC2::SecurityGroup
    Properties:
      VpcId: !ImportValue network-VpcId
      GroupDescription: app`},
{h:'Cautions'},
{ul:['You **cannot delete or change** an exported value while another stack imports it.','Exports are Regional and unique per account.','Prefer SSM parameters for loosely coupled values.','Nested stacks are updated through the parent. Do not edit them directly.']},
{note:'Treat exports like a public API: once someone imports a value you must keep it stable.'}],
src:[['Nested stacks',K.CFN+'using-cfn-nested-stacks.html']]};

/* ---------- 4 ---------- */
L['aws:15:4']={blocks:[
{p:'Stacks fail. Reading **stack events** tells you which resource failed and why.'},
{h:'Common states'},
{t:[['State','Meaning','Action'],
['CREATE_FAILED then ROLLBACK_COMPLETE','Creation failed and was rolled back','Fix the cause, delete the stack, redeploy'],
['UPDATE_ROLLBACK_COMPLETE','Update failed and reverted','Fix and update again'],
['UPDATE_ROLLBACK_FAILED','Rollback could not finish','Fix the blocking issue and continue rollback, skip resources if needed'],
['DELETE_FAILED','A resource could not be deleted','Empty buckets, detach dependencies, retry, or retain the resource']]},
{h:'Diagnosis'},
{flow:['Open the stack Events and find the first FAILED resource','Read the status reason: permission, quota, invalid property, dependency','Fix the template, permission or quota','Retry or delete and recreate','Use drift detection if the resources were changed outside CloudFormation']},
{code:`aws cloudformation describe-stack-events --stack-name app --query "StackEvents[?contains(ResourceStatus,'FAILED')].[LogicalResourceId,ResourceStatusReason]" --output table
aws cloudformation detect-stack-drift --stack-name app
aws cloudformation describe-stack-resource-drifts --stack-name app --stack-resource-drift-status-filters MODIFIED DELETED`},
{h:'Deletion policies'},
{ul:['`Delete` (default), `Retain` and `Snapshot` (for volumes, databases).','`UpdateReplacePolicy` applies when a resource is replaced.']}],
src:[['Troubleshooting CloudFormation',K.CFN+'troubleshooting.html']]};

/* ---------- 5 ---------- */
L['aws:15:5']={blocks:[
{p:'**StackSets** deploy one template to many accounts and Regions. **Resource Access Manager (RAM)** shares resources between accounts without copying them.'},
{svg:stackset},
{h:'StackSets'},
{ul:['**Service-managed** permissions use Organizations and can deploy to OUs, including new accounts automatically.','**Self-managed** uses roles you create in each account.','Set **maximum concurrent accounts** and failure tolerance to limit blast radius.','Operations roll out Region by Region according to your order.']},
{code:`aws cloudformation create-stack-set --stack-set-name baseline --template-body file://baseline.yaml \\
  --permission-model SERVICE_MANAGED --auto-deployment Enabled=true,RetainStacksOnAccountRemoval=false
aws cloudformation create-stack-instances --stack-set-name baseline \\
  --deployment-targets OrganizationalUnitIds=ou-abcd-12345678 --regions eu-west-1 eu-central-1`},
{h:'Resource Access Manager'},
{ul:['Share subnets, Transit Gateways, Resolver rules, License Manager configurations and more.','Share with accounts, OUs or the whole organization, with sharing enabled in Organizations.','Participants use the shared resource but cannot modify what they do not own.']},
{note:'A shared VPC subnet lets many accounts place resources in one network owned by a central account. Security groups and routing remain with the owner.'}],
src:[['StackSets',K.CFN+'what-is-cfnstacksets.html'],['AWS RAM','https://docs.aws.amazon.com/ram/latest/userguide/what-is.html']]};

/* ---------- 6 ---------- */
L['aws:15:6']={blocks:[
{p:'The **AWS CDK** lets developers write infrastructure in a programming language and **synthesizes** it into CloudFormation. An administrator needs to read, build, diff and deploy it and troubleshoot it, not write large applications.'},
{flow:['The CDK app defines stacks and constructs in code','cdk synth produces CloudFormation templates in cdk.out','cdk diff compares them with the deployed stacks','cdk deploy sends them to CloudFormation','Failures appear as normal CloudFormation events']},
{code:`npm install -g aws-cdk
cdk bootstrap aws://111122223333/eu-west-1     # one time per account and Region
cdk synth
cdk diff
cdk deploy --all --require-approval broadening
cdk destroy`},
{ul:['**Bootstrap** creates the roles and bucket CDK needs. A missing bootstrap is a common first error.','Constructs can create **IAM roles and policies** automatically. Read the diff for security changes.','All real failures are CloudFormation failures, so use the same troubleshooting method.','Pin the CDK version and review changes in code review.']},
{note:'`cdk diff` shows IAM and security group changes in a table. Make it part of pipeline review.'}],
src:[['AWS CDK','https://docs.aws.amazon.com/cdk/v2/guide/home.html']]};

/* ---------- 7 ---------- */
L['aws:15:7']={blocks:[
{p:'**EC2 Image Builder** automates creating, testing, hardening and distributing AMIs and container images on a schedule.'},
{t:[['Piece','Meaning'],
['Image recipe','Base image plus components (install, harden, configure)'],
['Components','Documents of build and test steps, AWS or custom'],
['Infrastructure configuration','Instance type, subnet and role used to build'],
['Distribution settings','Regions, accounts and sharing for the output'],
['Pipeline','Ties it together, on a schedule or when the parent image updates']]},
{flow:['A new base image or schedule triggers the pipeline','Image Builder launches a build instance and applies components','Tests run against the result','The AMI is created and distributed to chosen Regions and accounts','Publish the ID to Parameter Store so launch templates use it']},
{code:`aws imagebuilder list-image-pipelines --query "imagePipelineList[].[name,status]"
aws imagebuilder start-image-pipeline-execution --image-pipeline-arn <arn>`},
{note:'Golden images reduce patching to a rebuild and replace. Pair them with Auto Scaling instance refresh for a clean rollout.'}],
src:[['EC2 Image Builder','https://docs.aws.amazon.com/imagebuilder/latest/userguide/what-is-image-builder.html']]};

/* ---------- 8 ---------- */
L['aws:15:8']={blocks:[
{p:'A **deployment strategy** is how a new version replaces an old one. Each trades speed, cost and risk.'},
{t:[['Strategy','How','Downtime','Rollback','Risk'],
['All at once','Replace everything','Possible','Redeploy','High'],
['Rolling','Replace in batches','None if capacity kept','Redeploy previous','Medium, mixed versions'],
['Blue/green','Build full new environment, switch traffic','None','Switch back quickly','Low, double cost briefly'],
['Canary','Send a small share to the new version, then the rest','None','Remove the canary','Low'],
['Linear','Shift traffic in equal steps','None','Stop and revert','Low']]},
{h:'Where AWS provides them'},
{ul:['**Auto Scaling instance refresh**: rolling replacement.','**ECS and CodeDeploy**: rolling, blue/green, canary and linear for ECS and Lambda.','**Route 53 weighted records** and **ALB weighted target groups**: shift traffic by weight.','**Elastic Beanstalk**: rolling, immutable and blue/green swaps.']},
{note:'Rollback is only quick if the database changes are backward compatible. Plan schema changes in expand and contract steps.'}],
src:[['Deployment strategies','https://docs.aws.amazon.com/whitepapers/latest/overview-deployment-options/deployment-strategies.html']]};

/* ---------- 9 ---------- */
L['aws:15:9']={blocks:[
{p:'Teams often use **Terraform** and **Git** with AWS. As an administrator you operate pipelines that use them.'},
{h:'Terraform on AWS'},
{ul:['The **AWS provider** talks to the same APIs and uses your credentials or an assumed role.','**State** must be stored remotely, typically S3 with locking, and protected with encryption and versioning.','Use one role per environment so a plan cannot touch another account.','Plan output is the equivalent of a change set. Review before apply.']},
{code:`terraform {
  backend "s3" {
    bucket       = "acme-tf-state"
    key          = "prod/network.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
  }
}`},
{h:'Git as the source of truth'},
{ul:['Changes go through **pull requests** with review and automated checks.','Pipelines assume **short-lived roles** through OIDC instead of stored keys.','Tag releases and keep environment folders or branches clear.','Never commit secrets. Scan repositories for them.']},
{note:'For the full workflow see the LearnSphere Terraform course. Here the focus is state protection, role separation and review of plans.'}],
src:[['Terraform AWS provider','https://registry.terraform.io/providers/hashicorp/aws/latest/docs']]};

/* ---------- 10 ---------- */
L['aws:15:10']={blocks:[
{p:'**Practical:** deploy a stack, break it, fix it and roll it out to another account or Region.'},
{flow:['Write a template for a VPC security group and an S3 bucket with parameters and outputs','Deploy it and read the outputs','Make an update with a change set and read the replacement column','Introduce a failure, such as an invalid property or a duplicate bucket name, and diagnose from events','Modify the bucket manually in the console and run drift detection','Deploy the template with a StackSet to a second Region or account','Delete the stacks and confirm retained resources']},
{t:[['Step','Learning'],
['Change set','Know before you apply'],
['Failure','Events tell you the exact resource and reason'],
['Drift','Console edits are visible and reversible'],
['StackSet','One template, many targets']]},
{note:'S3 buckets cannot be deleted by a stack while they hold objects. Empty them first or use a custom resource that does.'}],
src:[['CloudFormation getting started',K.CFN+'GettingStarted.html']]};
})();
