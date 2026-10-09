/* LearnSphere - Terraform, Section 05: Variables, Outputs, Locals & Types.
   Lectures 0-6 are core, 7-10 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,LG=K.L;

/* ---------- diagrams ---------- */
const flow3=K.dg(700,190,[
[10,10,680,170,'Inputs, locals and outputs',1],
[30,60,160,70,'variable|input from the outside|var.name',2],[270,60,160,70,'locals|named expressions|local.name',0],[510,60,160,70,'output|result to the outside|terraform output',2]],
[[190,95,270,95],[430,95,510,95],[110,130,110,160],[110,160,590,160],[590,160,590,130]]);

const prec=K.dg(700,170,[
[10,10,680,150,'Variable precedence (later wins)',1],
[25,55,95,60,'default|in the|variable block',0],[130,55,100,60,'TF_VAR_name|env variable',0],[240,55,110,60,'terraform.tfvars|(.json)',0],[360,55,120,60,'*.auto.tfvars|alphabetical',0],[490,55,180,60,'-var and -var-file|command line, in order',2]],
[[120,85,130,85],[230,85,240,85],[350,85,360,85],[480,85,490,85]]);

/* ---------- 0: Input variables ---------- */
L['tf:4:0']={blocks:[
{p:'An **input variable** is a parameter of your configuration. Instead of hard-coding "us-east-1" or "t3.micro", you declare a variable and supply the value when you run Terraform. The same code can then build dev, test and prod.'},
{svg:flow3},
{h:'Declare a variable'},
{code:`variable "instance_type" {
  description = "Size of the web server"
  type        = string
  default     = "t3.micro"
}

variable "env" {
  description = "Environment name"
  type        = string
  # no default: a value is required
}`},
{t:[['Argument','Meaning'],
['`type`','What kind of value is allowed (string, number, list ...)'],
['`default`','Value used if none is supplied. Without it the variable is **required**.'],
['`description`','Documentation shown to users and in docs'],
['`validation`','Extra checks (lecture 4)'],
['`sensitive`','Hide the value in plan output (Section 11)'],
['`nullable`','Whether `null` is accepted']]},
{h:'Use a variable'},
{p:'Refer to it as `var.NAME`.'},
{code:`resource "aws_instance" "web" {
  instance_type = var.instance_type
  tags = {
    env = var.env
  }
}`},
{h:'Required vs optional'},
{t:[['Has default?','Behaviour when no value is given'],
['Yes','Uses the default'],
['No','Terraform **prompts** (or fails in automation with `-input=false`)']]},
{h:'Good habits'},
{ul:['Always set a **type** and a **description**.','Give a default only when a safe default exists; leave environment-specific values without one.','Name variables for meaning (`db_instance_class`), not for the value (`small`).','Variables are **inputs to the root module** or a module; they cannot be changed during a run.']},
{note:'Variables can only be used inside the module that declares them. A module needs its own `variable` blocks to receive values (Section 9).'}],
src:[['Input variables',LG+'values/variables']]};

/* ---------- 1: types ---------- */
L['tf:4:1']={blocks:[
{p:'Every value in Terraform has a **type**. Declaring types catches mistakes early ("expected a number, got a string") and documents what a variable accepts.'},
{h:'Primitive types'},
{t:[['Type','Example','Notes'],
['`string`','`"hello"`','Text'],
['`number`','`3`, `0.5`','Whole or decimal'],
['`bool`','`true`, `false`','Yes or no']]},
{h:'Collection types (all items the same type)'},
{t:[['Type','Example','Ordered?','Duplicates?','Access'],
['`list(string)`','`["a", "b", "a"]`','Yes','Yes','`var.x[0]`'],
['`set(string)`','`toset(["a", "b"])`','No','No','No index; used with `for_each`'],
['`map(string)`','`{ env = "dev" }`','By key','Keys are unique','`var.x["env"]`']]},
{h:'Structural types (items may differ)'},
{t:[['Type','Example'],
['`object({ ... })`','`{ name = "web", port = 80 }` with a fixed set of named attributes'],
['`tuple([...])`','`["web", 80, true]` with a fixed number of items of set types']]},
{h:'Examples'},
{code:`variable "zones" {
  type    = list(string)
  default = ["a", "b", "c"]
}

variable "tags" {
  type = map(string)
  default = {
    env  = "dev"
    team = "platform"
  }
}

variable "server" {
  type = object({
    name = string
    port = number
    tls  = bool
  })
  default = {
    name = "web"
    port = 443
    tls  = true
  }
}`},
{h:'Using them'},
{code:`var.zones[0]            # "a"
var.tags["env"]         # "dev"
var.server.port         # 443
length(var.zones)       # 3`},
{h:'Choosing a type'},
{flow:['One value? string, number or bool','Many of the same kind in order? list','Many unique items, order not important? set','Name to value look-up? map','A record with different named fields? object']},
{note:'`any` accepts any type, but it hides mistakes. Prefer an explicit type.'}],
src:[['Type constraints',LG+'expressions/type-constraints']]};

/* ---------- 2: setting values ---------- */
L['tf:4:2']={blocks:[
{p:'There are several ways to give a variable its value. When more than one is used, Terraform has a clear **order of precedence**: later sources override earlier ones.'},
{svg:prec},
{h:'The ways to set a value'},
{t:[['Way','Example','Typical use'],
['**Default**','`default = "t3.micro"` in the block','Safe fallback'],
['**Environment variable**','`export TF_VAR_env=dev`','CI and secrets'],
['**terraform.tfvars**','File named exactly `terraform.tfvars` (or `.json`)','Loaded automatically'],
['***.auto.tfvars**','`prod.auto.tfvars`','Loaded automatically, alphabetical order'],
['**-var-file**','`-var-file=prod.tfvars`','Choose an environment'],
['**-var**','`-var="env=prod"`','One-off override'],
['**Prompt**','Terraform asks you','Interactive runs']]},
{h:'Precedence, lowest to highest'},
{flow:['Default in the variable block','Environment variable TF_VAR_name','terraform.tfvars, then terraform.tfvars.json','Any *.auto.tfvars or *.auto.tfvars.json, in alphabetical order','-var and -var-file on the command line, in the order given']},
{h:'A tfvars file'},
{code:`# prod.tfvars
env           = "prod"
instance_type = "m5.large"
zones         = ["a", "b"]
tags = {
  team = "platform"
}`},
{code:`terraform plan -var-file=prod.tfvars
terraform plan -var-file=prod.tfvars -var="env=prod-test"   # -var wins`},
{h:'Example of precedence'},
{t:[['Sources used','Final value of env'],
['default "dev"','dev'],
['default "dev" + `TF_VAR_env=test`','test'],
['+ `terraform.tfvars` with `env = "stage"`','stage'],
['+ `-var="env=prod"`','**prod**']]},
{note:'Do not commit `.tfvars` files that contain secrets. Use environment variables or a secret store instead (Section 11). In HCP Terraform, workspace variables take the place of tfvars files.'}],
src:[['Assigning values',LG+'values/variables#assigning-values-to-root-module-variables']]};

/* ---------- 3: validation ---------- */
L['tf:4:3']={blocks:[
{p:'A **validation block** rejects bad input as early as possible, with a message that tells the user what to fix. It runs during `validate` and `plan`, before anything is created.'},
{code:`variable "env" {
  type = string

  validation {
    condition     = contains(["dev", "stage", "prod"], var.env)
    error_message = "env must be one of: dev, stage, prod."
  }
}

variable "bucket_name" {
  type = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,63}$", var.bucket_name))
    error_message = "Bucket names use 3 to 63 lowercase letters, digits or hyphens."
  }
}`},
{h:'How it works'},
{flow:['A value arrives from tfvars, the command line or a default','Terraform evaluates each condition','If false, plan stops with your error_message','If true, the value is used']},
{t:[['Part','Meaning'],
['`condition`','An expression that must be **true**'],
['`error_message`','Shown to the user when it is false (end with a full stop)']]},
{h:'Helpful functions in conditions'},
{t:[['Function','Use'],
['`contains(list, value)`','Value is in an allowed list'],
['`can(expr)`','True if the expression does not error (good with `regex`)'],
['`length(x)`','Check size'],
['`startswith(x, "p")`','Check a prefix'],
['`alltrue([ ... ])`','All conditions true']]},
{h:'What the user sees'},
{code:`Error: Invalid value for variable

  on main.tf line 1:
   1: variable "env" {
      var.env is "qa"

env must be one of: dev, stage, prod.
This was checked by the validation rule at main.tf:4,3-13.`},
{h:'Several rules'},
{p:'A variable may have more than one `validation` block. Each is checked and all messages are shown.'},
{note:'Validation checks **input values**. To check conditions about resources and data (for example the chosen subnet must be in two zones), use preconditions and postconditions (Section 7).'}],
src:[['Custom validation',LG+'values/variables#custom-validation-rules']]};

/* ---------- 4: locals ---------- */
L['tf:4:4']={blocks:[
{p:'A **local value** gives a name to an expression so you can reuse it without repeating yourself. Think of it as a variable inside the module that nobody can set from the outside.'},
{code:`locals {
  name_prefix = "\${var.project}-\${var.env}"

  common_tags = {
    project = var.project
    env     = var.env
    managed = "terraform"
  }
}

resource "aws_s3_bucket" "logs" {
  bucket = "\${local.name_prefix}-logs"
  tags   = local.common_tags
}

resource "aws_s3_bucket" "data" {
  bucket = "\${local.name_prefix}-data"
  tags   = merge(local.common_tags, { purpose = "data" })
}`},
{h:'Syntax reminders'},
{ul:['Declare in a `locals { ... }` block (plural). Several blocks are fine.','Use as `local.NAME` (singular).','A local can refer to variables, resources, data and other locals (no cycles).']},
{h:'Variable or local?'},
{t:[['','variable','local'],
['**Set by**','The caller (tfvars, CLI, module caller)','The author, inside the module'],
['**Use for**','Things that differ between runs','Derived values and repeated expressions'],
['**Changes at run time?**','Different per run','Fixed for the configuration'],
['**Example**','`var.env`','`local.name_prefix`']]},
{h:'When to use locals'},
{flow:['Do you copy the same expression in several places? Make a local','Do you build a name or tag set from variables? Make a local','Is it a value users should choose? Use a variable instead']},
{note:'Do not overdo locals. If a value is used once and is easy to read, leave it inline. Too many indirections make code harder to follow.'}],
src:[['Local values',LG+'values/locals']]};

/* ---------- 5: outputs ---------- */
L['tf:4:5']={blocks:[
{p:'An **output value** exposes information from a configuration. It prints after `apply`, can be read with `terraform output`, and is how a **child module returns values to its parent**.'},
{code:`output "bucket_name" {
  description = "Name of the logs bucket"
  value       = aws_s3_bucket.logs.bucket
}

output "bucket_arn" {
  description = "ARN of the logs bucket"
  value       = aws_s3_bucket.logs.arn
}

output "db_password" {
  value     = random_password.db.result
  sensitive = true
}`},
{t:[['Argument','Meaning'],
['`value`','The expression to expose (required)'],
['`description`','What it is'],
['`sensitive`','Hide the value in CLI output (it is still stored in state)'],
['`depends_on`','Rare: force an output to wait for something']]},
{h:'Using outputs'},
{t:[['Where','How'],
['After apply','Printed in `Outputs:`'],
['Any time','`terraform output`, `terraform output bucket_name`, `terraform output -json`'],
['Scripts','`terraform output -raw bucket_name`'],
['Parent module','`module.NAME.OUTPUT_NAME`'],
['Another configuration','Read via remote state or a data source (Section 8)']]},
{svg:K.dg(700,130,[
[10,10,680,110,'Outputs carry values out of a module',1],
[30,50,170,50,'Child module|output "id"',0],[265,50,170,50,'Parent configuration|module.net.id',2],[500,50,170,50,'You / scripts|terraform output',0]],
[[200,75,265,75],[435,75,500,75]])},
{h:'Sensitive outputs'},
{code:`Outputs:

bucket_name = "demo-dev-logs"
db_password = <sensitive>`},
{p:'`terraform output db_password` still prints the real value when you ask for it explicitly. Hiding is for the screen, not for security; the value remains in state.'},
{note:'Exam tip: a root module output is printed after apply; a child module output is visible only to the parent unless the parent declares its own output for it.'}],
src:[['Output values',LG+'values/outputs']]};

/* ---------- 6: Practical ---------- */
L['tf:4:6']={blocks:[
{p:'Turn a fixed configuration into one driven by variables and `.tfvars` files for two environments. The lab uses local files, so it is free.'},
{h:'Step 1: variables, local and outputs'},
{code:`# main.tf
terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

variable "env" {
  type = string
  validation {
    condition     = contains(["dev", "prod"], var.env)
    error_message = "env must be dev or prod."
  }
}

variable "replicas" {
  type    = number
  default = 1
}

variable "tags" {
  type    = map(string)
  default = {}
}

locals {
  prefix = "app-\${var.env}"
  labels = merge({ env = var.env }, var.tags)
}

resource "local_file" "config" {
  filename = "\${local.prefix}.txt"
  content  = "env=\${var.env}\\nreplicas=\${var.replicas}\\nlabels=\${jsonencode(local.labels)}\\n"
}

output "file" {
  value = local_file.config.filename
}

output "labels" {
  value = local.labels
}`},
{h:'Step 2: one tfvars file per environment'},
{code:`# dev.tfvars
env      = "dev"
replicas = 1

# prod.tfvars
env      = "prod"
replicas = 3
tags = {
  team = "platform"
}`},
{h:'Step 3: run each environment'},
{code:`terraform init
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars
cat app-dev.txt
terraform destroy -var-file=dev.tfvars

terraform apply -var-file=prod.tfvars
cat app-prod.txt
terraform destroy -var-file=prod.tfvars`},
{h:'Step 4: break it on purpose'},
{code:`terraform plan -var="env=qa"
# Error: Invalid value for variable ... env must be dev or prod.

TF_VAR_replicas=5 terraform plan -var-file=dev.tfvars
# replicas = 1: the -var-file value beats the environment variable (5)`},
{t:[['You practised','Lecture'],
['Declaring variables with types and defaults','1 and 2'],
['Supplying values with `-var-file`, `-var` and `TF_VAR_`','3'],
['Rejecting bad input with `validation`','4'],
['Naming expressions with `locals`','5'],
['Exposing results with `output`','6']]},
{note:'Both environments here share one state in one folder, so we destroy before switching. In real projects each environment has its own state: separate folders, workspaces or HCP workspaces (Section 8 and Section 15).'}],
src:[['Variables and outputs tutorial',K.T]]};
})();
