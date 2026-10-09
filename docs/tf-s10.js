/* LearnSphere - Terraform, Section 10: Maintaining Infrastructure: Import, Upgrades & Change.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,LG=K.L,CLI=K.CLI;

/* ---------- diagrams ---------- */
const imp=K.dg(700,210,[
[10,10,680,190,'Import brings an existing object under Terraform',1],
[30,70,150,70,'Real object|already exists|(made by hand)',0],[250,50,200,50,'import block|to = aws_s3_bucket.logs|id = "my-bucket"',2],[250,115,200,50,'resource block|(written by you or|generated)',2],[520,70,150,70,'State now has it|plan = no changes',0]],
[[180,105,250,75],[180,110,250,140],[450,75,520,90],[450,140,520,115]]);

const safe=K.dg(700,170,[
[10,10,680,150,'A safe change routine',1],
[25,55,110,60,'Branch|and edit',0],[150,55,110,60,'fmt, validate|and plan',2],[275,55,110,60,'Review|the plan',2],[400,55,110,60,'Apply|(saved plan)',2],[525,55,145,60,'Verify, then|merge or roll back',0]],
[[135,85,150,85],[260,85,275,85],[385,85,400,85],[510,85,525,85]]);

const upg=K.dg(700,170,[
[10,10,680,150,'Upgrade one step at a time',1],
[25,55,120,60,'Read notes|and back up state',0],[165,55,120,60,'Change|constraint',0],[305,55,120,60,'init -upgrade',2],[445,55,100,60,'plan: expect|no changes',2],[565,55,105,60,'apply|and commit lock',0]],
[[145,85,165,85],[285,85,305,85],[425,85,445,85],[545,85,565,85]]);

/* ---------- 0: import block ---------- */
L['tf:9:0']={blocks:[
{p:'**Import** brings an object that already exists (created by hand or by another tool) **under Terraform management**, without recreating it. After import, Terraform tracks it in state and future changes go through code.'},
{svg:imp},
{h:'The import block (configuration-driven import)'},
{code:`import {
  to = aws_s3_bucket.logs         # the address in your code
  id = "my-existing-logs-bucket"  # the real id in the cloud
}

resource "aws_s3_bucket" "logs" {
  bucket = "my-existing-logs-bucket"
}`},
{t:[['Argument','Meaning'],
['`to`','The resource address Terraform should manage it as'],
['`id`','The identifier the provider uses (see the **Import** section of the resource docs)']]},
{h:'Steps'},
{flow:['Find the real id (read the provider docs: the import section shows the format)','Write the resource block that describes the object','Add the import block','Run terraform plan: it shows "will be imported"','Adjust the code until the plan shows no unwanted changes','Run terraform apply to record it in state','Remove the import block (it has done its job)']},
{h:'What the plan shows'},
{code:`# aws_s3_bucket.logs will be imported
    resource "aws_s3_bucket" "logs" {
        bucket = "my-existing-logs-bucket"
        id     = "my-existing-logs-bucket"
    }

Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.`},
{h:'Why this way is better'},
{ul:['It is **declarative**: reviewed in a pull request and shown in `plan` before anything happens.','It works the same for every teammate and in CI.','The old command (lecture 3) changes state immediately with no preview.']},
{note:'Import only fills **state**. Your code must describe the object correctly, otherwise the next plan will try to change it to match your code.'}],
src:[['Import',LG+'import'],['Import blocks',LG+'import#syntax']]};

/* ---------- 1: generate-config-out ---------- */
L['tf:9:1']={blocks:[
{p:'Writing the resource block for a complicated existing object by hand is slow. Terraform can **draft the configuration for you** during an import.'},
{code:`import {
  to = aws_instance.legacy
  id = "i-0abc123def456"
}
# note: there is NO resource "aws_instance" "legacy" block yet`},
{code:`terraform plan -generate-config-out=generated.tf`},
{p:'Terraform reads the real object and writes a complete `resource` block into `generated.tf`.'},
{h:'The workflow'},
{flow:['Add import blocks for the objects','Run terraform plan -generate-config-out=generated.tf','Open generated.tf and review it','Clean up: remove defaults and read-only values, use variables, rename','Run terraform plan until it shows only the import','Apply, then delete the import block']},
{h:'What the generated code looks like'},
{code:`# __generated__ by Terraform
resource "aws_instance" "legacy" {
  ami                    = "ami-0abc..."
  instance_type          = "t3.micro"
  subnet_id              = "subnet-0123..."
  vpc_security_group_ids = ["sg-0123..."]
  tags = {
    Name = "legacy-server"
  }
  # ... many more arguments
}`},
{h:'Clean-up checklist'},
{t:[['Problem in generated code','Fix'],
['Hard-coded ids (`subnet-0123`)','Replace with references or variables'],
['Many arguments set to defaults','Delete what you do not need'],
['Computed values that cannot be set','Remove them if the plan complains'],
['Poor resource name','Rename (and update the import `to`)']]},
{h:'Rules'},
{ul:['The target resource block must **not exist** yet, or Terraform refuses to generate.','Generated code is a **starting point**, not finished code.','Use it for a safety review: compare the plan to be sure nothing will change.']},
{note:'`-generate-config-out` works with `plan`. Run it, fix, and use a normal `apply` afterwards.'}],
src:[['Generating configuration',LG+'import/generating-configuration']]};

/* ---------- 2: legacy import ---------- */
L['tf:9:2']={blocks:[
{p:'Before import blocks existed there was only the command `terraform import`. You will still see it in old guides and scripts.'},
{code:`# 1. write the resource block first
resource "aws_s3_bucket" "logs" {
  bucket = "my-existing-logs-bucket"
}

# 2. run the command
terraform import aws_s3_bucket.logs my-existing-logs-bucket`},
{h:'How it differs'},
{t:[['','`import` block','`terraform import` command'],
['**Where it lives**','In configuration (code)','In your shell history'],
['**Preview**','Yes, shown in `plan`','No, changes state at once'],
['**Reviewed by teammates**','Yes, in Git','No'],
['**Generates code**','Yes (`-generate-config-out`)','No'],
['**Repeatable in CI**','Yes','Awkward'],
['**Recommended**','**Yes**','Only when you cannot use blocks']]},
{h:'Rules for the command'},
{ul:['The **resource block must already exist** in your configuration; the command does not write it.','It writes to state **immediately**. Take a backup first (`terraform state pull`).','It imports **one object at a time**.','Afterwards run `terraform plan` and fix differences in the code.']},
{flow:['Write the resource block','Back up state','terraform import ADDRESS ID','terraform plan','Edit the code until the plan is empty']},
{h:'Common errors'},
{t:[['Error','Meaning'],
['"resource address does not exist in the configuration"','Write the block first'],
['"Cannot import non-existent remote object"','Wrong id or wrong region/account'],
['"Resource already managed by Terraform"','It is already in state']]},
{note:'Exam tip: the `import` block is the modern, declarative way (shown in plan). The `terraform import` command is the legacy way and needs the configuration to exist first.'}],
src:[['terraform import',CLI+'commands/import']]};

/* ---------- 3: Making changes safely ---------- */
L['tf:9:3']={blocks:[
{p:'Production infrastructure should change through a **routine**, not by luck. This lecture gives a simple one.'},
{svg:safe},
{h:'The routine'},
{flow:['Make the change on a Git branch','Run terraform fmt and terraform validate','Run terraform plan (save it with -out for important changes)','Review the plan: look for -, -/+ and unexpected changes','Apply the reviewed plan','Verify the result and merge']},
{h:'What to look for in a plan'},
{t:[['Symbol or text','Ask yourself'],
['`-` or `-/+` on a database, disk or volume','Is data going to be lost?'],
['`forces replacement`','Which argument? Is the downtime acceptable?'],
['More changes than you expected','Did a provider or module upgrade change defaults?'],
['`(known after apply)` on a name','Will dependent resources change too?'],
['Resources you did not touch','Drift or an unrelated change; investigate']]},
{h:'Targeting is for emergencies'},
{code:`terraform apply -target=aws_instance.web`},
{p:'`-target` limits a run to one resource and its dependencies. It skips the rest of the graph, so state and reality can drift apart. Use it to recover from a broken run, then do a normal full plan straight away.'},
{h:'Rolling back'},
{p:'Terraform has no "undo" button. Rolling back means going to a **previous desired state** and applying it.'},
{t:[['Situation','Rollback'],
['Code change not yet applied','Revert the Git commit'],
['Applied; the old code is still valid','Revert in Git, plan, apply'],
['Data destroyed','Restore from backup; Terraform cannot bring data back'],
['State damaged','Restore a previous state version from the backend'],
['Partly failed apply','Fix the cause and re-run apply (Terraform continues)']]},
{h:'Safety nets'},
{ul:['`prevent_destroy` on critical resources.','Backups and versioned remote state.','Separate state per environment so a mistake cannot touch production.','Apply saved plans in CI after human approval.']},
{note:'A plan that nobody reads is not a safety net. Make plan review part of every pull request.'}],
src:[['Plan',CLI+'commands/plan'],['Resource targeting',CLI+'commands/plan#resource-targeting']]};

/* ---------- 4: Upgrading ---------- */
L['tf:9:4']={blocks:[
{p:'Both **Terraform** and **providers** keep releasing. Staying reasonably current gets security fixes and new features, but upgrades should be **deliberate**, one step at a time.'},
{svg:upg},
{h:'Upgrading providers'},
{flow:['Read the provider changelog and upgrade guide for breaking changes','Back up state','Widen or change the version constraint in required_providers','Run terraform init -upgrade','Run terraform plan; fix warnings and unexpected changes','Apply and commit the updated .terraform.lock.hcl']},
{code:`terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"    # was ~> 5.0
    }
  }
}
# terraform init -upgrade`},
{t:[['Command','Effect'],
['`terraform init`','Uses the version in the lock file'],
['`terraform init -upgrade`','Picks the newest version allowed by the constraint and rewrites the lock file']]},
{h:'Upgrading Terraform itself'},
{flow:['Read the release notes and upgrade guide','Back up state (state pull)','Install the new version (a version manager helps)','Update required_version if needed','Run terraform init, then terraform plan on a safe environment first','Apply; roll out to the team and CI together']},
{ul:['Upgrade **one minor version at a time**, especially when you are several versions behind.','After a newer Terraform writes state, **older versions may not read it**. Upgrade everyone together; there is no state downgrade.','Run the plan in dev or staging before production.','Commit the lock file so CI uses the same providers.']},
{h:'Keeping up'},
{t:[['Habit','Why'],
['Pin with `~>`, not open-ended `>=`','Controlled upgrades'],
['Upgrade on a schedule (for example monthly)','Small steps are easier'],
['Test upgrades with a plan in non-production','No surprises'],
['Read warnings about deprecations','Fix them before they become errors']]},
{note:'The lock file records exactly which provider version was chosen. A pull request that changes it is a visible, reviewable upgrade.'}],
src:[['Upgrading',K.D+'upgrade-guides'],['Dependency lock file',LG+'files/dependency-lock']]};

/* ---------- 5: Breaking changes ---------- */
L['tf:9:5']={blocks:[
{p:'**Breaking changes** make code that worked yesterday fail or behave differently after an upgrade. Providers publish **major versions** (for example 4.x to 5.0) when they must break compatibility.'},
{h:'What can break'},
{t:[['Change','Example','Typical signal'],
['**Deprecated argument removed**','`acl` argument moved to its own resource','Deprecation warning, then error'],
['**Renamed resource or attribute**','`azurerm_virtual_machine` replaced by newer resource types','Error: unknown resource type'],
['**New default value**','A safer default changes behaviour','Plan shows an unexpected update'],
['**Behaviour change**','A resource is now replaced instead of updated','`-/+` where you saw `~`'],
['**Removed feature**','Old API versions dropped','Provider error at apply']]},
{h:'A safe approach'},
{flow:['Pin the major version so nothing upgrades by surprise','Watch deprecation warnings in every plan','Read the major-version upgrade guide before you change the constraint','Upgrade in a non-production environment first','Fix the code, run plan, expect no destructive changes','Apply and roll out to other environments']},
{h:'Handling a renamed or split resource'},
{code:`# old (deprecated)
resource "aws_s3_bucket" "b" {
  bucket = "demo"
  acl    = "private"
}

# new: separate resource in newer provider versions
resource "aws_s3_bucket" "b" {
  bucket = "demo"
}
resource "aws_s3_bucket_acl" "b" {
  bucket = aws_s3_bucket.b.id
  acl    = "private"
}`},
{ul:['If a new resource type replaces an old one, you may need an **import** or a **moved** block so Terraform does not recreate the real object.','Always check the plan for `-/+` on stateful resources.']},
{h:'Terraform CLI deprecations'},
{ul:['`terraform taint` is deprecated in favour of `-replace`.','`terraform refresh` is deprecated in favour of `plan/apply -refresh-only`.','Old `template_file` is replaced by `templatefile()`.']},
{note:'Warnings are a gift: they tell you what will break **before** it does. Treat them as to-do items.'}],
src:[['Provider versioning',LG+'providers/requirements'],['Upgrade guides',K.D+'upgrade-guides']]};

/* ---------- 6: Practical ---------- */
L['tf:9:6']={blocks:[
{p:'Build two resources **by hand**, then bring them under Terraform with `import` blocks and reach a **clean "no changes" plan**. The lab uses two S3 buckets (they cost almost nothing) and the AWS CLI. If you prefer a free local variant, use the Docker provider with a `docker_network` the same way.'},
{h:'Step 1: create the buckets by hand'},
{code:`aws s3api create-bucket --bucket lab-adopt-logs-12345 --region us-east-1
aws s3api create-bucket --bucket lab-adopt-data-12345 --region us-east-1
aws s3api put-bucket-tagging --bucket lab-adopt-logs-12345 \\
  --tagging 'TagSet=[{Key=env,Value=lab}]'`},
{h:'Step 2: imports and generated code'},
{code:`# imports.tf
import {
  to = aws_s3_bucket.logs
  id = "lab-adopt-logs-12345"
}
import {
  to = aws_s3_bucket.data
  id = "lab-adopt-data-12345"
}`},
{code:`terraform init
terraform plan -generate-config-out=generated.tf`},
{h:'Step 3: review and clean generated.tf'},
{ul:['Remove arguments that only repeat defaults or are read-only.','Keep `bucket` and `tags`.','Run `terraform fmt`.']},
{h:'Step 4: apply the import'},
{code:`terraform plan
# Plan: 2 to import, 0 to add, 0 to change, 0 to destroy.
terraform apply
terraform state list
# aws_s3_bucket.data
# aws_s3_bucket.logs`},
{h:'Step 5: prove it is clean'},
{code:`terraform plan
# No changes. Your infrastructure matches the configuration.`},
{p:'Now delete `imports.tf` (the import blocks are no longer needed) and run `plan` again. It should still say **No changes**.'},
{h:'Step 6: manage them for real'},
{code:`# add a tag in generated.tf
tags = {
  env     = "lab"
  managed = "terraform"
}
terraform apply            # ~ update in place`},
{h:'Step 7: clean up'},
{code:`terraform destroy`},
{t:[['You practised','Lecture'],
['`import` blocks','1'],
['`-generate-config-out`','2'],
['Plan review and clean-up','4'],
['Reaching a no-changes plan','1 to 4']]},
{note:'Billing: two empty S3 buckets cost essentially nothing, but always destroy lab resources when finished.'}],
src:[['Import',LG+'import'],['Generating configuration',LG+'import/generating-configuration']]};
})();
