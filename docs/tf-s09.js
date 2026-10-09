/* LearnSphere - Terraform, Section 09: Modules.
   Lectures 0-7 are core, 8-15 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,LG=K.L;

/* ---------- diagrams ---------- */
const tree=K.dg(700,230,[
[10,10,680,210,'Root module calls child modules',1],
[30,85,150,60,'Root module|your working folder|main.tf',2],
[290,35,180,50,'module "network"|./modules/network',0],[290,100,180,50,'module "app"|./modules/app',0],[290,165,180,45,'module "db"|registry or Git',0],
[540,100,130,50,'Real resources',0]],
[[180,105,290,60],[180,115,290,125],[180,125,290,185],[470,125,540,125]]);

const io=K.dg(700,170,[
[10,10,680,150,'Values enter through variables and leave through outputs',1],
[30,60,150,60,'Caller (root)|module "net" { cidr = ... }',0],[245,50,210,80,'Child module|variable "cidr"|resources|output "vpc_id"',2],[520,60,150,60,'Caller uses|module.net.vpc_id',0]],
[[180,90,245,90],[455,90,520,90]]);

const comp=K.dg(700,170,[
[10,10,680,150,'Composition: small modules wired together by outputs',1],
[30,60,150,60,'network|outputs subnet_ids',0],[260,60,150,60,'app|input subnet_ids|output lb_dns',2],[490,60,180,60,'dns|input target =|module.app.lb_dns',0]],
[[180,90,260,90],[410,90,490,90]]);

/* ---------- 0: What modules are ---------- */
L['tf:8:0']={blocks:[
{p:'A **module** is a folder of Terraform files that you can reuse. Every configuration is already a module: the folder you run Terraform in is the **root module**. A module that the root (or another module) calls is a **child module**.'},
{svg:tree},
{h:'Why use modules'},
{t:[['Reason','What it gives you'],
['**Reuse**','Write a network once, use it for dev, test and prod'],
['**Encapsulation**','Hide details; callers see only inputs and outputs'],
['**Consistency**','Everyone builds a database the same, approved way'],
['**Less code**','One module call instead of copying hundreds of lines'],
['**Easier review**','Change the module once, every caller gets it']]},
{h:'Calling a module'},
{code:`module "network" {
  source = "./modules/network"

  cidr_block = "10.0.0.0/16"     # an input variable of the module
  env        = "dev"
}

# use its output
resource "aws_instance" "web" {
  subnet_id = module.network.public_subnet_id
}`},
{t:[['Term','Meaning'],
['**Root module**','The folder where you run `terraform plan`'],
['**Child module**','A module called with a `module` block'],
['**Source**','Where the module code comes from'],
['**Inputs**','The module `variable` blocks (arguments in the call)'],
['**Outputs**','Values the module returns (`module.NAME.OUTPUT`)']]},
{h:'What happens at init'},
{flow:['Terraform reads each module block','It downloads or links the module code into .terraform/modules','You run plan and apply as usual','Resources inside get addresses like module.network.aws_vpc.main']},
{note:'Whenever you add a module or change its `source` or `version`, run `terraform init` again.'}],
src:[['Modules',LG+'modules'],['Module blocks',LG+'blocks/modules/syntax']]};

/* ---------- 1: Sources ---------- */
L['tf:8:1']={blocks:[
{p:'The `source` argument tells Terraform **where to find** the module code. Many locations are supported.'},
{t:[['Source type','Example','Notes'],
['**Local path**','`./modules/network`','Must start with `./` or `../`. Used while developing or in one repository.'],
['**Terraform Registry**','`terraform-aws-modules/vpc/aws`','`namespace/name/provider`. Supports `version`.'],
['**Private registry**','`app.terraform.io/my-org/vpc/aws`','HCP Terraform private registry.'],
['**GitHub**','`github.com/my-org/terraform-vpc`','Shorthand for a Git repo.'],
['**Generic Git**','`git::https://example.com/vpc.git?ref=v1.2.0`','Pin with `ref` (tag, branch or commit).'],
['**HTTP / S3 / GCS**','`s3::https://s3.amazonaws.com/bucket/vpc.zip`','Archives from storage.']]},
{h:'Examples'},
{code:`# local
module "app" {
  source = "./modules/app"
}

# registry (with version)
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
}

# git, pinned to a tag
module "db" {
  source = "git::https://github.com/my-org/terraform-db.git?ref=v2.1.0"
}

# a sub-folder inside a repository
module "net" {
  source = "git::https://github.com/my-org/infra.git//modules/network?ref=v1.0.0"
}`},
{h:'Rules'},
{ul:['`version` works **only** with registry sources. For Git, pin with `?ref=`.','Always pin: a tag or version, never a moving branch, for anything important.','The double slash `//` selects a sub-folder inside the downloaded repository.','Run `terraform init` after changing a source.']},
{h:'Choosing a source'},
{flow:['Only used in this repository? A local path','Shared in your company? A private registry or a tagged Git repository','Community best practice module? The public registry']}],
src:[['Module sources',LG+'modules/sources'],['Registry','https://registry.terraform.io/browse/modules']]};

/* ---------- 2: Registry modules ---------- */
L['tf:8:2']={blocks:[
{p:'The **Terraform Registry** hosts thousands of ready-made modules. Using one saves time, but you remain responsible for what it creates.'},
{h:'Using a registry module'},
{flow:['Find the module on registry.terraform.io','Read the Inputs and Outputs tabs and the README','Check the publisher, downloads, recent releases','Call it with a pinned version','Run terraform plan and read what it would create']},
{code:`module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "demo"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
}

output "vpc_id" {
  value = module.vpc.vpc_id
}`},
{h:'Versions'},
{t:[['Constraint','Meaning'],
['`version = "5.1.2"`','Exactly this version'],
['`version = "~> 5.1"`','5.1 up to but not including 6.0'],
['`version = ">= 5.0, < 6.0"`','A range']]},
{ul:['Without `version`, Terraform picks the newest release, which can change under you. **Pin it.**','Module versions use semantic versioning: breaking changes should come with a new major version.','Read the changelog before upgrading and check the plan carefully.']},
{h:'Evaluate before you use'},
{t:[['Check','Why'],
['Publisher and verification','Trust'],
['Last release date and open issues','Is it maintained?'],
['Inputs: are the defaults sensible?','Defaults may create costly or open resources'],
['What the plan creates','No surprises, no hidden costs']]},
{note:'You can also read the module source on GitHub from the Registry page. A module is code that runs with your credentials, so read it for anything sensitive.'}],
src:[['Registry modules',K.D+'registry/modules/use'],['Version constraints',LG+'expressions/version-constraints']]};

/* ---------- 3: Inputs, outputs, scope ---------- */
L['tf:8:3']={blocks:[
{p:'A module is a **sealed box**. The only way in is through **input variables**; the only way out is through **outputs**. Nothing else is shared.'},
{svg:io},
{h:'Input: variable in the module, argument in the call'},
{code:`# modules/network/variables.tf
variable "cidr_block" {
  type = string
}
variable "env" {
  type    = string
  default = "dev"
}

# root main.tf
module "network" {
  source     = "./modules/network"
  cidr_block = "10.0.0.0/16"        # argument = module variable
}`},
{h:'Output: how a child returns a value'},
{code:`# modules/network/outputs.tf
output "vpc_id" {
  value = aws_vpc.main.id
}

# root: read it
resource "aws_subnet" "extra" {
  vpc_id = module.network.vpc_id
}`},
{h:'Scope rules'},
{t:[['Rule','Meaning'],
['A module sees only its own variables, locals and resources','It cannot read the caller variables unless passed in'],
['The caller sees only the outputs','It cannot read `module.network.aws_vpc.main` directly'],
['A child output is not printed after apply','Unless the root module declares its own `output` for it'],
['Each call is independent','Two calls of one module have separate resources and state entries']]},
{h:'Passing values'},
{flow:['Declare a variable in the child for everything that may differ','Pass values as arguments in the module block','Expose what callers need as outputs','Reference them as module.NAME.OUTPUT']},
{code:`# print a child output from the root
output "network_vpc" {
  value = module.network.vpc_id
}`},
{note:'Providers are inherited automatically from the caller (default configuration). Do not put `provider` blocks inside a reusable child module; see the next lecture.'}],
src:[['Module inputs and outputs',LG+'modules/develop/structure'],['Output values',LG+'values/outputs']]};

/* ---------- 4: count, for_each, providers on modules ---------- */
L['tf:8:4']={blocks:[
{p:'A `module` block accepts the same meta-arguments as a resource: `count`, `for_each`, `providers` and `depends_on`. This lets you create **several instances of one module**.'},
{h:'for_each on a module'},
{code:`module "bucket" {
  source   = "./modules/bucket"
  for_each = toset(["logs", "data", "backup"])

  name = "demo-\${each.key}"
}

# addresses: module.bucket["logs"], module.bucket["data"], ...
output "bucket_ids" {
  value = { for k, m in module.bucket : k => m.id }
}`},
{h:'count on a module'},
{code:`module "web" {
  source = "./modules/web"
  count  = 2
  index  = count.index
}
# module.web[0], module.web[1]`},
{p:'Same advice as for resources: use `for_each` when instances have names.'},
{h:'Passing providers to a module'},
{p:'By default a child module uses the **default provider configuration** of its caller. To give it a different one (a second region), pass it with `providers`.'},
{code:`provider "aws" {
  region = "us-east-1"
}
provider "aws" {
  alias  = "west"
  region = "us-west-2"
}

module "replica" {
  source = "./modules/bucket"
  providers = {
    aws = aws.west        # child local name = caller alias
  }
}`},
{svg:K.dg(700,150,[
[10,10,680,130,'The module uses the provider you pass in',1],
[30,55,170,55,'provider aws|us-east-1 (default)',0],[30,100,170,30,'provider aws.west',2],[290,55,150,55,'module "replica"|providers:|aws = aws.west',2],[520,55,150,55,'Resources in|us-west-2',0]],
[[200,115,290,95],[440,82,520,82]])},
{h:'Inside a reusable module'},
{code:`# modules/bucket/versions.tf
terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}
# no provider "aws" block here; the caller supplies it`},
{note:'Modules that contain their own `provider` blocks cannot be used with `count` or `for_each`. Keep provider configuration in the root module.'}],
src:[['Module meta-arguments',LG+'blocks/modules/syntax#meta-arguments'],['Providers within modules',LG+'modules/develop/providers']]};

/* ---------- 5: First module ---------- */
L['tf:8:5']={blocks:[
{p:'Writing a module is just writing Terraform in a separate folder, plus a small amount of structure and documentation so other people can use it.'},
{h:'The standard structure'},
{code:`modules/web-app/
  main.tf          # resources
  variables.tf     # inputs
  outputs.tf       # outputs
  versions.tf      # required_version and required_providers
  README.md        # what it does, inputs, outputs, example
  examples/
    basic/
      main.tf      # a working example that calls the module`},
{t:[['File','Contents'],
['`main.tf`','The resources (split into more files for large modules)'],
['`variables.tf`','Every input with `type` and `description`'],
['`outputs.tf`','Every output with a `description`'],
['`versions.tf`','Terraform and provider requirements'],
['`README.md`','Purpose, usage example, inputs and outputs'],
['`examples/`','A runnable example; also useful for testing']]},
{h:'Example module'},
{code:`# variables.tf
variable "name" {
  type        = string
  description = "Name of the app"
}
variable "tags" {
  type        = map(string)
  description = "Extra tags"
  default     = {}
}

# main.tf
resource "aws_s3_bucket" "this" {
  bucket = var.name
  tags   = merge({ app = var.name }, var.tags)
}

# outputs.tf
output "bucket_arn" {
  description = "ARN of the bucket"
  value       = aws_s3_bucket.this.arn
}`},
{h:'Design habits'},
{ul:['Call the main resource `this` when the module has one main object.','Give every variable a `type` and `description`; give a default only if it is safe.','Output what callers will need (ids, arns, names).','Do not hard-code regions, accounts or names that callers might want to change.','Document with a README; `terraform-docs` can generate the tables.']},
{h:'Test it'},
{flow:['terraform init and terraform validate in the module or the example','terraform plan from examples/basic','terraform apply, check, then terraform destroy']},
{note:'Start by writing the module call you wish you could write. That is your interface; then build the module to match it.'}],
src:[['Standard module structure',LG+'modules/develop/structure'],['Creating modules',K.T]]};

/* ---------- 6: Composition ---------- */
L['tf:8:6']={blocks:[
{p:'Good modules are **small, focused and composable**. Instead of one giant module that builds everything, build several small ones and connect them with outputs and inputs.'},
{svg:comp},
{code:`module "network" {
  source = "./modules/network"
  cidr   = "10.0.0.0/16"
}

module "app" {
  source     = "./modules/app"
  subnet_ids = module.network.private_subnet_ids   # output -> input
}

module "dns" {
  source = "./modules/dns"
  target = module.app.lb_dns_name
}`},
{h:'Design principles'},
{t:[['Principle','Meaning'],
['**One purpose**','A module does one job: a network, a database, a service'],
['**Small interface**','Few inputs with sensible defaults; expose only needed outputs'],
['**Composition over nesting**','Wire modules together in the root; avoid modules calling deep chains of modules'],
['**Do not wrap a single resource**','A module that only passes variables to one resource adds no value'],
['**Pass dependencies in**','Take ids as inputs instead of looking them up inside'],
['**Stable contract**','Changing inputs or outputs breaks callers; version carefully']]},
{h:'Good and bad'},
{t:[['Too big','Too small','Just right'],
['`platform` module with VPC, EKS, RDS and DNS','`bucket` module that only calls `aws_s3_bucket` with the same arguments','`network`, `database`, `service` modules wired in the root']]},
{h:'When to create a module'},
{flow:['Are you copying the same group of resources? Consider a module','Will several people or environments reuse it? Make it a module','Is it used once and simple? Keep it as plain resources']},
{note:'A common rule: the root module is the **wiring**, child modules are the **building blocks**.'}],
src:[['Module composition',LG+'modules/develop/composition'],['Module best practices',K.D+'language/modules/develop']]};

/* ---------- 7: Practical ---------- */
L['tf:8:7']={blocks:[
{p:'Extract a module from existing code and call it **twice** with different inputs. The lab uses the `local` and `random` providers, so it is free.'},
{h:'Step 1: layout'},
{code:`lab/
  main.tf
  modules/
    app-config/
      main.tf
      variables.tf
      outputs.tf
      versions.tf`},
{h:'Step 2: the module'},
{code:`# modules/app-config/versions.tf
terraform {
  required_providers {
    local = { source = "hashicorp/local" }
  }
}

# modules/app-config/variables.tf
variable "name" {
  type        = string
  description = "App name"
}
variable "port" {
  type        = number
  description = "Port the app listens on"
  default     = 8080
}

# modules/app-config/main.tf
resource "local_file" "this" {
  filename = "\${path.root}/out/\${var.name}.conf"
  content  = "name=\${var.name}\\nport=\${var.port}\\n"
}

# modules/app-config/outputs.tf
output "path" {
  description = "Path of the generated file"
  value       = local_file.this.filename
}`},
{h:'Step 3: call it twice'},
{code:`# main.tf
terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

module "web" {
  source = "./modules/app-config"
  name   = "web"
  port   = 80
}

module "api" {
  source = "./modules/app-config"
  name   = "api"
  # port uses the default 8080
}

output "paths" {
  value = [module.web.path, module.api.path]
}`},
{h:'Step 4: run'},
{code:`terraform init           # "Initializing modules..."
terraform plan           # module.web.local_file.this and module.api.local_file.this
terraform apply
cat out/web.conf out/api.conf
terraform state list`},
{h:'Step 5: for_each on the module'},
{code:`module "svc" {
  source   = "./modules/app-config"
  for_each = { web = 80, api = 8080, admin = 9000 }
  name     = each.key
  port     = each.value
}
# module.svc["web"], module.svc["api"], module.svc["admin"]`},
{h:'What to observe'},
{t:[['Look at','What you learn'],
['`terraform init` output','Modules are installed in `.terraform/modules`'],
['Addresses in the plan','`module.NAME.TYPE.NAME`'],
['Defaults','`api` got port 8080 without being told'],
['`for_each` addresses','Add or remove a key and only that module instance changes']]},
{note:'Clean up with `terraform destroy`. Then publish the module in a Git repository with a tag such as `v1.0.0` and call it with `?ref=v1.0.0` to practise versioning.'}],
src:[['Module tutorial',K.T],['Standard module structure',LG+'modules/develop/structure']]};
})();
