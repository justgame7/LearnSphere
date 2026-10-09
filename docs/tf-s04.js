/* LearnSphere - Terraform, Section 04: HCL, Providers, Resources & Data Sources.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,D=K.D,LG=K.L;

/* ---------- diagrams ---------- */
const anatomy=K.dg(700,200,[
[10,10,680,180,'Anatomy of a block',1],
[30,55,120,50,'resource|(block type)',2],[165,55,130,50,'"aws_instance"|(label 1: type)',0],[310,55,110,50,'"web"|(label 2: name)',0],[435,55,235,50,'{ ...body... }|arguments and nested blocks',0],
[165,130,505,40,'Arguments inside the body:  name = expression',0]],
[[435,105,435,130]]);

const pv=K.dg(700,180,[
[10,10,680,160,'Provider source address',1],
[30,60,170,60,'registry.terraform.io|(hostname, optional)',0],[225,60,120,60,'hashicorp|(namespace)',0],[370,60,100,60,'aws|(type)',2],[500,60,170,60,'version = "~> 5.0"|(constraint)',2]],
[[200,90,225,90],[345,90,370,90],[470,90,500,90]]);

const alias=K.dg(700,200,[
[10,10,680,180,'One provider, two configurations',1],
[30,60,170,60,'provider "aws"|region us-east-1 (default)',0],[30,125,170,50,'provider "aws"|alias = "west"|us-west-2',2],
[260,60,170,50,'aws_instance.a|uses the default',0],[260,125,170,50,'aws_instance.b|provider = aws.west',2],
[500,70,170,90,'Two regions,|one configuration',0]],
[[200,90,260,85],[200,150,260,150],[430,85,500,100],[430,150,500,130]]);

/* ---------- 0: HCL syntax ---------- */
L['tf:3:0']={blocks:[
{p:'Terraform configuration is written in **HCL, the HashiCorp Configuration Language**. It is designed to be easy to read: a mix of **blocks** (containers) and **arguments** (name = value). Files end in `.tf` (HCL) or `.tf.json` (the same thing in JSON).'},
{svg:anatomy},
{h:'The building blocks'},
{t:[['Term','Meaning','Example'],
['**Block**','A container with a type, optional labels and a body','`resource "aws_instance" "web" { ... }`'],
['**Label**','A string after the block type that names it','`"aws_instance"`, `"web"`'],
['**Argument**','Assigns a value to a name inside a block','`instance_type = "t3.micro"`'],
['**Nested block**','A block inside another block','`tags { ... }`, `lifecycle { ... }`'],
['**Identifier**','A name (letters, digits, `_` and `-`)','`web`, `my_bucket`'],
['**Expression**','Anything that produces a value','`var.region`, `1 + 2`, `upper("a")`']]},
{h:'Value types'},
{code:`name      = "web"                 # string
count     = 3                     # number
enabled   = true                  # bool
zones     = ["a", "b", "c"]       # list
tags      = {                     # map / object
  env  = "dev"
  team = "platform"
}
note      = null                  # no value`},
{h:'Comments'},
{t:[['Style','Use'],
['`# comment`','Single line (preferred)'],
['`// comment`','Single line'],
['`/* ... */`','Multiple lines']]},
{h:'Multi-line strings (heredoc)'},
{code:`user_data = <<-EOT
  #!/bin/bash
  echo "hello"
EOT`},
{p:'`<<-EOT` removes the common leading spaces so your code can stay indented.'},
{h:'Files in a folder'},
{ul:['Terraform reads **every `.tf` file** in the folder and treats them as one configuration. File names and order do not matter.','A common layout: `main.tf`, `variables.tf`, `outputs.tf`, `providers.tf`.','`.tf.json` is for machine-generated configuration; people write `.tf`.']},
{h:'Common top-level blocks'},
{t:[['Block','Purpose','Section'],
['`terraform`','Settings: version, required providers, backend','4'],
['`provider`','Configure a provider','4'],
['`resource`','Create something','4'],
['`data`','Read something that exists','4'],
['`variable`','Input','5'],
['`locals`','Named expressions','5'],
['`output`','Result values','5'],
['`module`','Call a module','9']]},
{note:'Run `terraform fmt` after writing. It lines up the equals signs and indentation so every file follows the same standard style.'}],
src:[['Configuration syntax',LG+'syntax/configuration'],['Style conventions',LG+'syntax/style']]};

/* ---------- 1: terraform block ---------- */
L['tf:3:1']={blocks:[
{p:'The special `terraform` block holds **settings for Terraform itself**: which Terraform version is allowed, which providers are needed, and where state is stored. It does not create anything.'},
{code:`terraform {
  required_version = ">= 1.9.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}`},
{h:'What each part does'},
{t:[['Setting','Meaning'],
['`required_version`','Constrains the **Terraform CLI** version. Terraform refuses to run if the version does not match.'],
['`required_providers`','Lists each provider with its **source** and an allowed **version** range.'],
['`backend`','Where state is stored (Section 8).'],
['`cloud`','Connects to HCP Terraform (Section 13).']]},
{h:'Why declare providers explicitly?'},
{flow:['Without required_providers, Terraform guesses hashicorp/<name>','That breaks for non-HashiCorp providers','Declaring it names the exact source and version','Everyone gets the same provider and the lock file records it']},
{h:'The local name'},
{p:'The key (`aws`, `random`) is the **local name** used in `provider "aws"` blocks and in resource types such as `aws_instance`. Resource type prefixes must match the local name.'},
{h:'Only one terraform block?'},
{p:'You can have several `terraform` blocks in different files, but each setting must appear once. Most projects keep one in `versions.tf` or `main.tf`.'},
{note:'Exam tip: `required_version` is about the **Terraform CLI**; `version` inside `required_providers` is about a **provider**.'}],
src:[['The terraform block',LG+'terraform'],['Provider requirements',LG+'providers/requirements']]};

/* ---------- 2: providers and versions ---------- */
L['tf:3:2']={blocks:[
{p:'A **provider** is a plugin that teaches Terraform how to manage one platform. Terraform downloads providers from a **registry** during `terraform init`. This lecture covers how a provider is named and how to control which version you get.'},
{svg:pv},
{h:'Source address'},
{t:[['Part','Meaning','Default'],
['**Hostname**','Which registry','`registry.terraform.io`'],
['**Namespace**','Publisher','`hashicorp`, or a company or person'],
['**Type**','Provider name','`aws`, `azurerm`, `random`']]},
{p:'`source = "hashicorp/aws"` is short for `registry.terraform.io/hashicorp/aws`.'},
{h:'Version constraints'},
{t:[['Operator','Meaning','Example','Allows'],
['`=` (or none)','Exactly this version','`= 5.31.0`','5.31.0'],
['`!=`','Anything except','`!= 5.31.0`','all but 5.31.0'],
['`>` `>=` `<` `<=`','Comparison','`>= 5.0`','5.0 and above'],
['`~>`','Pessimistic: only the right-most number may rise','`~> 5.31`','5.31, 5.32 ... but below 6.0'],
['`~>` (patch)','Same, one level lower','`~> 5.31.0`','5.31.0, 5.31.1 ... below 5.32.0']]},
{h:'Combine constraints'},
{code:`version = ">= 5.0, < 5.50"      # both must be true
version = "~> 5.0"              # 5.x, never 6.0`},
{h:'Registry tiers'},
{t:[['Tier','Who maintains it'],
['**Official**','HashiCorp (`hashicorp/...`)'],
['**Partner**','A technology company, verified by HashiCorp'],
['**Community**','Anyone; check activity and downloads before using']]},
{h:'How the version is chosen'},
{flow:['You set a constraint in required_providers','terraform init finds the newest version that fits','It records the exact version and checksums in .terraform.lock.hcl','Later runs reuse the locked version until you run init -upgrade']},
{note:'Lock file vs constraint: the constraint says what is **allowed**, the lock file says what is **chosen**. Commit both so the whole team and CI use the same provider.'}],
src:[['Provider requirements',LG+'providers/requirements'],['Version constraints',LG+'expressions/version-constraints'],['Registry','https://registry.terraform.io/browse/providers']]};

/* ---------- 3: provider config and aliases ---------- */
L['tf:3:3']={blocks:[
{p:'`required_providers` says **which** provider you need. A `provider` block **configures** it: region, credentials, endpoints and default settings.'},
{code:`provider "aws" {
  region  = "us-east-1"
  profile = "terraform-lab"

  default_tags {
    tags = {
      managed_by = "terraform"
    }
  }
}`},
{p:'Arguments differ per provider; read the provider page in the Registry. Secrets should come from the environment, not from code (Section 2).'},
{h:'Default configuration'},
{p:'A provider block **without** `alias` is the default one. Resources of that provider use it automatically.'},
{h:'Aliases: several configurations of one provider'},
{svg:alias},
{code:`provider "aws" {
  region = "us-east-1"          # default
}

provider "aws" {
  alias  = "west"
  region = "us-west-2"
}

resource "aws_s3_bucket" "primary" {
  bucket = "demo-primary-123"   # default provider, us-east-1
}

resource "aws_s3_bucket" "backup" {
  provider = aws.west           # alias provider, us-west-2
  bucket   = "demo-backup-123"
}`},
{h:'When aliases are useful'},
{ul:['Resources in **several regions** from one configuration.','Resources in **several accounts** (each alias assumes a different role).','Two instances of a service, for example two Kubernetes clusters.']},
{h:'Reference syntax'},
{t:[['Where','Syntax'],
['Declare','`provider "aws" { alias = "west" }`'],
['Use in a resource','`provider = aws.west`'],
['Pass to a module','`providers = { aws = aws.west }`']]},
{note:'Provider configuration values must be known before planning. Do not feed them from a resource that is created in the same run.'}],
src:[['Provider configuration',LG+'providers/configuration'],['Multiple provider configurations',LG+'meta-arguments/provider']]};

/* ---------- 4: resources ---------- */
L['tf:3:4']={blocks:[
{p:'A **resource** block declares one infrastructure object that Terraform should create and manage: a server, a bucket, a DNS record. Resources are the heart of every configuration.'},
{code:`resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"

  tags = {
    Name = "web-server"
  }
}`},
{h:'Parts of a resource'},
{t:[['Part','Example','Meaning'],
['**Type**','`aws_instance`','What kind of object (provider prefix + kind)'],
['**Name**','`web`','Your label, unique per type in a module'],
['**Arguments**','`instance_type = "t3.micro"`','What you set (inputs)'],
['**Attributes**','`id`, `public_ip`','Values you read (outputs)']]},
{h:'Arguments vs attributes'},
{ul:['**Arguments** are the settings you write. They go in the block.','**Attributes** are everything the object has, including values set by the cloud after creation (an id, an address). Read them from other places.']},
{h:'Referencing a resource'},
{p:'Use `TYPE.NAME.ATTRIBUTE`. A reference also creates a **dependency**: Terraform builds the referenced resource first.'},
{code:`resource "aws_eip" "web" {
  instance = aws_instance.web.id      # needs the server first
}

output "ip" {
  value = aws_eip.web.public_ip
}`},
{h:'Resource addresses'},
{p:'An **address** is the unique name Terraform uses in plans, state and commands.'},
{t:[['Address','Points to'],
['`aws_instance.web`','A single resource'],
['`aws_instance.web[0]`','Instance 0 created with `count`'],
['`aws_instance.web["blue"]`','Instance keyed `blue` created with `for_each`'],
['`module.app.aws_instance.web`','A resource inside module `app`'],
['`data.aws_ami.ubuntu`','A data source']]},
{h:'Behaviour on change'},
{t:[['Change','Result'],
['Edit a mutable argument','Update in place (`~`)'],
['Edit an immutable argument','Replace (`-/+`)'],
['Remove the block','Destroy (`-`)'],
['Add a block','Create (`+`)']]},
{note:'Read the provider docs for each resource: the page lists arguments (required or optional), attributes and which arguments force replacement.'}],
src:[['Resources',LG+'resources/syntax'],['Resource behaviour',LG+'resources/behavior']]};

/* ---------- 5: data sources ---------- */
L['tf:3:5']={blocks:[
{p:'A **data source** reads information about something that **already exists** (or is computed), without managing it. Resources **create and manage**; data sources only **look up**.'},
{t:[['','resource','data'],
['**Block**','`resource "type" "name"`','`data "type" "name"`'],
['**Terraform**','Creates, updates, destroys','Only reads'],
['**In plans**','`+ ~ -`','`<=` read'],
['**Address**','`aws_instance.web`','`data.aws_ami.ubuntu`']]},
{h:'Example: find the latest Ubuntu image'},
{code:`data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]    # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-*-24.04-amd64-server-*"]
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
}`},
{flow:['Terraform reads the data block during plan','It asks the provider for matching values','The result is available as data.aws_ami.ubuntu.id','Other resources use it like any attribute']},
{h:'Common uses'},
{ul:['Look up an **image id**, **availability zones** or **account id**.','Read a **resource made elsewhere** (a shared VPC owned by another team).','Read a **secret** or a **parameter** from a store.','Compute things, for example `aws_iam_policy_document`.']},
{h:'Resource or data?'},
{flow:['Does this configuration own the lifecycle of the object? Use resource','Does it only need information about something that already exists? Use data']},
{note:'If the lookup depends on something not yet created, the data source is read during apply and its values show as `(known after apply)` in the plan.'}],
src:[['Data sources',LG+'data-sources']]};

/* ---------- 6: meta-arguments overview ---------- */
L['tf:3:6']={blocks:[
{p:'Every resource accepts a few special arguments that are part of **Terraform itself**, not of the provider. They are called **meta-arguments**. This lecture is a first look; each is taught in detail later.'},
{t:[['Meta-argument','What it does','Taught in'],
['`count`','Create N copies of a resource','Section 6'],
['`for_each`','Create one instance per item in a map or set','Section 6'],
['`provider`','Choose a non-default provider configuration','This section'],
['`depends_on`','Add an explicit dependency','Section 7'],
['`lifecycle`','Control create, replace and destroy behaviour','Section 7']]},
{h:'A glimpse of each'},
{code:`# count: three identical servers
resource "aws_instance" "web" {
  count         = 3
  ami           = var.ami
  instance_type = "t3.micro"
}
# addresses: aws_instance.web[0], [1], [2]

# for_each: one bucket per name
resource "aws_s3_bucket" "b" {
  for_each = toset(["logs", "data"])
  bucket   = "demo-\${each.key}-123"
}
# addresses: aws_s3_bucket.b["logs"], ["data"]

# provider: use the aliased provider
resource "aws_s3_bucket" "backup" {
  provider = aws.west
  bucket   = "demo-backup-123"
}

# depends_on and lifecycle
resource "aws_instance" "app" {
  depends_on = [aws_iam_role_policy.p]
  lifecycle {
    create_before_destroy = true
  }
}`},
{h:'count vs for_each in one line'},
{t:[['','count','for_each'],
['**Identity**','Position number','Key you choose'],
['**Remove an item in the middle**','Items after it shift','Only that item changes'],
['**Best for**','N identical copies','Distinct, named items']]},
{note:'`count` and `for_each` cannot be used together on the same resource. Prefer `for_each` when items have names.'}],
src:[['Meta-arguments',LG+'meta-arguments/count'],['Lifecycle',LG+'meta-arguments/lifecycle']]};

/* ---------- 7: Practical ---------- */
L['tf:3:7']={blocks:[
{p:'A lab that combines **three providers** in one configuration, passes values between them and reads the result in the plan and the state. No cloud account is needed.'},
{svg:K.dg(700,150,[
[10,10,680,130,'Values flow from provider to provider',1],
[30,55,170,55,'random_pet.name|(random provider)',0],[265,55,170,55,'time_static.created|(time provider)',0],[500,55,170,55,'local_file.report|(local provider)',2]],
[[200,82,265,82],[435,82,500,82]])},
{h:'The configuration'},
{code:`terraform {
  required_providers {
    random = { source = "hashicorp/random", version = "~> 3.6" }
    time   = { source = "hashicorp/time",   version = "~> 0.12" }
    local  = { source = "hashicorp/local",  version = "~> 2.5" }
  }
}

resource "random_pet" "name" {
  length = 2
}

resource "time_static" "created" {
  triggers = {
    pet = random_pet.name.id      # recreate the timestamp if the pet changes
  }
}

resource "local_file" "report" {
  filename = "report.txt"
  content  = "Pet: \${random_pet.name.id}\\nCreated: \${time_static.created.rfc3339}\\n"
}

output "report_path" {
  value = local_file.report.filename
}`},
{h:'Run it'},
{code:`terraform init
terraform validate
terraform plan
terraform apply
cat report.txt
terraform state list
terraform destroy`},
{h:'What to observe'},
{t:[['Look at','What you learn'],
['`terraform init` output','Three providers installed and recorded in the lock file'],
['The plan','`(known after apply)` for the pet name and the timestamp'],
['`terraform state list`','`local_file.report`, `random_pet.name`, `time_static.created`'],
['Resource order','Apply creates the pet, then the time, then the file, because of the references']]},
{h:'Challenge'},
{ul:['Change a provider constraint, run `init -upgrade` and compare `.terraform.lock.hcl` before and after.','Create a second `local_file` using `provider = local` explicitly.','Add `data "local_file"` that reads `report.txt` after apply and output its content.']},
{note:'You just used three providers, resources, references and outputs, the same pattern used with AWS, Azure and Kubernetes. Only the resource types change.'}],
src:[['time provider','https://registry.terraform.io/providers/hashicorp/time/latest/docs'],['Multiple providers',LG+'providers/configuration']]};
})();
