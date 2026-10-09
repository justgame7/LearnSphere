/* LearnSphere - Terraform, Section 03: The Core Workflow & CLI.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,CLI=K.CLI,D=K.D;

/* ---------- diagrams ---------- */
const loop=K.dg(700,190,[
[10,10,680,170,'The core workflow',1],
[30,60,140,70,'WRITE|edit .tf files|(and fmt, validate)',0],[200,60,140,70,'INIT|download providers|set up backend',2],[370,60,140,70,'PLAN|preview changes',2],[540,60,130,70,'APPLY|make the changes|real',2]],
[[170,95,200,95],[340,95,370,95],[510,95,540,95],[605,130,605,160],[605,160,100,160],[100,160,100,130]]);

const init=K.dg(700,260,[
[10,10,680,240,'terraform init does four things',1],
[30,50,170,60,'1. Read the config|terraform block, providers,|modules, backend',0],[230,50,200,60,'2. Install providers|into .terraform/providers',2],[460,50,210,60,'3. Install modules|into .terraform/modules',2],
[130,150,200,60,'4. Configure the backend|where state is stored',2],[370,150,240,60,'Write .terraform.lock.hcl|exact provider versions + checksums',2]],
[[200,80,230,80],[430,80,460,80],[130,110,230,150],[330,180,370,180]]);

const saved=K.dg(700,150,[
[10,10,680,130,'Safest pattern: apply exactly what you reviewed',1],
[30,50,150,60,'terraform plan|-out=tfplan',2],[230,50,200,60,'Review (people, pull request)',0],[480,50,190,60,'terraform apply tfplan|no new prompt, no surprises',2]],
[[180,80,230,80],[430,80,480,80]]);

/* ---------- 0: Core workflow ---------- */
L['tf:2:0']={blocks:[
{p:'Every Terraform project, from a lab to a company platform, follows the same loop: **write** the configuration, **plan** the change, **apply** it. Everything else in the CLI supports these three steps.'},
{svg:loop},
{t:[['Stage','What you do','Command'],
['**Write**','Describe infrastructure in `.tf` files; keep code tidy and valid','editor, `terraform fmt`, `terraform validate`'],
['**Init**','Prepare the folder (once, and after provider or module changes)','`terraform init`'],
['**Plan**','Preview exactly what would change','`terraform plan`'],
['**Apply**','Make the real changes after approval','`terraform apply`'],
['**Destroy**','Remove everything when it is no longer needed','`terraform destroy`']]},
{h:'The loop in practice'},
{flow:['Edit main.tf','terraform fmt and terraform validate','terraform plan: read what will change','terraform apply: type yes','Commit the code to Git; repeat']},
{h:'The same loop, scaled to a team'},
{t:[['','Alone','In a team'],
['**Write**','On your laptop','On a feature branch'],
['**Plan**','Run by hand','Run automatically on every pull request'],
['**Review**','You read the plan','Teammates read the plan in the pull request'],
['**Apply**','Run by hand','Run by the pipeline after merge (or by HCP Terraform)']]},
{h:'A tiny example to keep in mind'},
{code:`# main.tf
resource "random_pet" "demo" {
  length = 2
}

# Then:
#   terraform init     (once)
#   terraform plan     (shows 1 to add)
#   terraform apply    (creates it)`},
{note:'Exam tip: the three-stage workflow is **write, plan, apply**. `init` prepares the directory and is needed before plan, but it is not one of the three.'}],
src:[['Core workflow',D+'intro/core-workflow'],['CLI commands',CLI+'commands']]};

/* ---------- 1: init ---------- */
L['tf:2:1']={blocks:[
{p:'`terraform init` prepares a working directory. It is the **first command** you run in any new or freshly cloned Terraform folder. It is safe to run many times.'},
{svg:init},
{h:'What appears after init'},
{t:[['Item','What it is','In Git?'],
['`.terraform/`','Downloaded providers, modules and backend settings','No'],
['`.terraform.lock.hcl`','Lock file: exact provider versions and checksums','**Yes**, commit it'],
['`terraform.tfstate`','Local state (only with the local backend)','No']]},
{h:'The dependency lock file'},
{p:'The lock file makes every machine use the **same provider version**. Without it, two people could download different versions and get different plans.'},
{code:`# .terraform.lock.hcl (created by init, do not edit by hand)
provider "registry.terraform.io/hashicorp/random" {
  version     = "3.6.3"
  constraints = "~> 3.6"
  hashes = [
    "h1:...",
    "zh:...",
  ]
}`},
{h:'When to run init again'},
{ul:['After you **add or change a provider** or its version constraint.','After you **add or change a module** source or version.','After you **change the backend** configuration.','After cloning a repository for the first time.']},
{h:'Useful options'},
{t:[['Option','Use'],
['`-upgrade`','Re-select the newest provider and module versions that fit the constraints, and update the lock file'],
['`-reconfigure`','Ignore saved backend settings and start the backend setup fresh'],
['`-migrate-state`','Move existing state to a newly configured backend'],
['`-backend=false`','Skip backend setup (useful for `validate` in CI)'],
['`-input=false`','Never prompt (automation)']]},
{code:`terraform init
terraform init -upgrade
terraform init -backend=false`},
{note:'If a command says "Required plugins are not installed" or "Backend initialization required", the answer is almost always: run `terraform init`.'}],
src:[['terraform init',CLI+'commands/init'],['Dependency lock file',K.L+'files/dependency-lock']]};

/* ---------- 2: fmt and validate ---------- */
L['tf:2:2']={blocks:[
{p:'Two quick commands keep your code tidy and catch simple mistakes before you ever touch real infrastructure. Neither needs a cloud account.'},
{h:'terraform fmt: canonical style'},
{p:'`fmt` rewrites your files into the standard HashiCorp layout: indentation of 2 spaces, aligned `=` signs, consistent spacing.'},
{code:`terraform fmt              # format files in this folder
terraform fmt -recursive   # include sub-folders (modules)
terraform fmt -check       # only report; exit code 3 if changes are needed
terraform fmt -diff        # show what would change`},
{t:[['Before','After'],
['`name="web"`','`name = "web"`'],
['`  instance_type="t3.micro"`','`instance_type = "t3.micro"`']]},
{h:'terraform validate: is the configuration valid?'},
{p:'`validate` checks that the configuration is **syntactically correct and internally consistent**: block names are known, required arguments are present, references point to things that exist and value types fit.'},
{code:`terraform init -backend=false
terraform validate
# Success! The configuration is valid.

# machine-readable result
terraform validate -json`},
{h:'What validate can and cannot check'},
{t:[['Can check','Cannot check'],
['Syntax errors (missing brace, bad quote)','Whether your credentials work'],
['Unknown or misspelled argument names','Whether a resource name is already taken in the cloud'],
['References to resources that do not exist','Values known only after apply'],
['Wrong value types (string where a number is needed)','Whether the plan will succeed against the real API']]},
{h:'Example of a validate error'},
{code:`Error: Unsupported argument

  on main.tf line 6, in resource "aws_instance" "web":
   6:   instance_typ = "t3.micro"

An argument named "instance_typ" is not expected here.
Did you mean "instance_type"?`},
{h:'Where they fit'},
{flow:['Write code','terraform fmt','terraform validate','terraform plan']},
{note:'In CI, run `terraform fmt -check` and `terraform validate`. They are fast, free and catch most careless mistakes. `validate` needs `init` first because it must know the provider schemas.'}],
src:[['terraform fmt',CLI+'commands/fmt'],['terraform validate',CLI+'commands/validate']]};

/* ---------- 3: plan ---------- */
L['tf:2:3']={blocks:[
{p:'`terraform plan` compares your **configuration**, the **state** and the **real world**, and prints what would change. It changes nothing. Learn to read it well: it is the safety net of the whole tool.'},
{h:'What plan does'},
{flow:['Read the configuration and the state','Refresh: ask each provider for the current real values','Compare desired and real values','Print a list of create, update, replace and destroy actions','Print a summary line']},
{h:'The symbols'},
{t:[['Symbol','Meaning','Example'],
['`+`','Create','New server'],
['`~`','Update in place','Change a tag'],
['`-`','Destroy','Removed block'],
['`-/+`','Replace: destroy then create','Change an immutable argument'],
['`+/-`','Replace: create first, then destroy','`create_before_destroy` set'],
['`<=`','Read a data source','`data` block']]},
{h:'Reading a real plan'},
{code:`  # aws_instance.web must be replaced
-/+ resource "aws_instance" "web" {
      ~ ami           = "ami-111" -> "ami-222" # forces replacement
      ~ id            = "i-0abc" -> (known after apply)
        instance_type = "t3.micro"
        tags          = {
            "env" = "dev"
        }
    }

Plan: 1 to add, 0 to change, 1 to destroy.`},
{ul:['The comment line gives the **reason**: "must be replaced".','`# forces replacement` points at the argument that cannot change in place.','Lines without a symbol are unchanged and shown for context.','`(known after apply)` means the value will exist only after creation.']},
{h:'The summary line'},
{t:[['Output','Meaning'],
['`Plan: 2 to add, 1 to change, 0 to destroy.`','Counts of each action'],
['`No changes. Your infrastructure matches the configuration.`','Real world equals code'],
['`Changes to Outputs:`','Only output values will change']]},
{h:'Useful options'},
{code:`terraform plan                     # normal
terraform plan -out=tfplan         # save the plan to a file
terraform plan -destroy            # preview a destroy
terraform plan -var="env=prod"     # set a variable for this run
terraform plan -refresh-only       # only look for drift`},
{note:'Always read the plan, especially lines with `-` or `-/+`. A replace of a database means data loss unless you intended it.'}],
src:[['terraform plan',CLI+'commands/plan'],['Plan symbols and output',CLI+'commands/plan#plan-options']]};

/* ---------- 4: apply ---------- */
L['tf:2:4']={blocks:[
{p:'`terraform apply` makes the real changes. By default it creates a plan, shows it and **asks you to type `yes`**. You can also apply a plan file you saved earlier.'},
{h:'Three ways to apply'},
{t:[['Way','Command','Use'],
['**Interactive**','`terraform apply`','Normal day-to-day work: plan, review, type `yes`'],
['**Saved plan**','`terraform apply tfplan`','Apply exactly the reviewed plan; no prompt'],
['**Auto approve**','`terraform apply -auto-approve`','Only in controlled automation']]},
{svg:saved},
{h:'Saved plan example'},
{code:`terraform plan -out=tfplan      # create and save the plan
terraform show tfplan           # read it again (people can review)
terraform apply tfplan          # apply that exact plan`},
{p:'If the real world or the state changes after you saved the plan, Terraform refuses to apply it ("saved plan is stale"). That protects you from surprises.'},
{h:'Why -auto-approve is risky'},
{ul:['It skips the human check. A typo can destroy things without anyone looking.','Use it only in a pipeline that has already shown a reviewed plan, ideally by applying a saved plan.','Never make it a habit on your laptop.']},
{h:'What happens during apply'},
{flow:['Terraform builds the graph and orders the actions','Creates or changes resources in parallel where possible (default 10 at a time)','Waits for each resource to be ready','Updates the state after each step','Prints outputs and the summary']},
{h:'If apply fails halfway'},
{p:'Resources that were created stay in the state. Fix the problem and run `apply` again; Terraform continues from where it stopped and does not duplicate what exists.'},
{code:`Apply complete! Resources: 3 added, 0 changed, 0 destroyed.

Outputs:
pet_name = "happy-lizard"`},
{note:'Automation tip: add `-input=false` so a missing variable fails fast instead of waiting for a prompt that nobody will answer.'}],
src:[['terraform apply',CLI+'commands/apply']]};

/* ---------- 5: destroy ---------- */
L['tf:2:5']={blocks:[
{p:'`terraform destroy` removes **everything the configuration manages**. It is the clean way to end a lab and a dangerous command in production. It is the same as `terraform apply -destroy`.'},
{h:'Always preview first'},
{code:`terraform plan -destroy       # list what would be removed
terraform destroy             # asks you to type yes`},
{p:'Destroy shows a plan full of `-` lines. Read the list. Check you are in the right folder and the right workspace or account.'},
{h:'In what order are things destroyed?'},
{flow:['Terraform builds the dependency graph','It reverses the order','Things that depend on others go first (the server before the network)','The network is removed last']},
{p:'If a subnet needs a VPC to exist, the subnet is destroyed first. The reverse of the creation order always applies.'},
{h:'Destroying one thing: -target'},
{code:`terraform destroy -target=aws_instance.web`},
{p:'`-target` limits the action to one resource and what it depends on. It is for **exceptions and emergencies**, because it skips the rest of the graph and can leave state and reality out of step.'},
{h:'Safe destroy habits'},
{t:[['Habit','Why'],
['Run `plan -destroy` first','See the exact list'],
['Check `terraform workspace show` and the cloud account','Avoid destroying the wrong environment'],
['Use `prevent_destroy` on critical resources','Terraform refuses to destroy them'],
['Keep production in a separate folder and state','A lab destroy can never reach it'],
['Check the console after','Some resources fail to delete (for example non-empty buckets)']]},
{code:`resource "aws_db_instance" "main" {
  # ...
  lifecycle {
    prevent_destroy = true   # destroy now fails with an error
  }
}`},
{note:'Removing a resource block from the code and running `apply` also destroys it. `destroy` is simply "remove everything".'}],
src:[['terraform destroy',CLI+'commands/destroy']]};

/* ---------- 6: show, output, console, graph ---------- */
L['tf:2:6']={blocks:[
{p:'Four read-only commands let you look inside a run. They change nothing, so use them freely.'},
{t:[['Command','What it shows','Typical use'],
['`terraform show`','The current state, or a saved plan file','See every attribute of every resource'],
['`terraform output`','Output values of the root module','Get an address or name for scripts'],
['`terraform console`','An interactive prompt that evaluates expressions','Try functions and references'],
['`terraform graph`','The dependency graph in DOT format','Understand or draw the order']]},
{h:'terraform show'},
{code:`terraform show              # human-readable state
terraform show tfplan       # read a saved plan
terraform show -json | jq . # machine-readable`},
{h:'terraform output'},
{code:`terraform output                  # all outputs
terraform output pet_name         # one output (quoted)
terraform output -raw pet_name    # plain text, good for scripts
terraform output -json            # JSON`},
{h:'terraform console'},
{p:'Console loads your configuration and state, so you can test an expression before writing it into code.'},
{code:`$ terraform console
> upper("hello")
"HELLO"
> random_pet.name.id
"happy-lizard"
> cidrsubnet("10.0.0.0/16", 8, 2)
"10.0.2.0/24"
> exit`},
{h:'terraform graph'},
{code:`terraform graph | dot -Tpng > graph.png    # needs Graphviz (dot)`},
{svg:K.dg(700,110,[[40,30,150,50,'aws_vpc.main',0],[270,30,150,50,'aws_subnet.a',0],[500,30,150,50,'aws_instance.web',2]],[[190,55,270,55],[420,55,500,55]])},
{p:'In the picture, an arrow shows "depends on" in the creation order: the VPC first, then the subnet, then the server.'},
{note:'`show` reads state, so run it after a successful apply. `output` and `console` also need state; if the infrastructure does not exist yet they have nothing to show.'}],
src:[['terraform show',CLI+'commands/show'],['terraform output',CLI+'commands/output'],['terraform console',CLI+'commands/console'],['terraform graph',CLI+'commands/graph']]};

/* ---------- 7: Practical ---------- */
L['tf:2:7']={blocks:[
{p:'A full lab cycle with **no cloud account**: create resources, change one **in place**, force a **replacement**, read each plan, then destroy. We use `random_pet` and the built-in `terraform_data` resource.'},
{h:'Step 1: the configuration'},
{code:`terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

resource "random_pet" "name" {
  length = 2
}

resource "terraform_data" "app" {
  input = "version-1"
}

output "pet" {
  value = random_pet.name.id
}

output "app_version" {
  value = terraform_data.app.output
}`},
{h:'Step 2: create'},
{code:`terraform init
terraform plan        # Plan: 2 to add
terraform apply       # type yes
terraform output`},
{h:'Step 3: change in place'},
{p:'Edit `input = "version-1"` to `input = "version-2"`.'},
{code:`terraform plan
#   ~ input = "version-1" -> "version-2"
# Plan: 0 to add, 1 to change, 0 to destroy.
terraform apply`},
{h:'Step 4: force a replacement'},
{code:`terraform plan -replace=terraform_data.app
# -/+ terraform_data.app will be replaced, as requested
# Plan: 1 to add, 0 to change, 1 to destroy.
terraform apply -replace=terraform_data.app`},
{h:'Step 5: destroy'},
{code:`terraform plan -destroy
terraform destroy
terraform show        # state is now empty`},
{h:'What you practised'},
{t:[['Plan shows','Action','Caused by'],
['`+`','Create','New resource blocks'],
['`~`','Update in place','Changing a normal argument'],
['`-/+`','Replace','`-replace` flag or an argument that cannot change in place'],
['`-`','Destroy','`terraform destroy`']]},
{note:'`-replace=ADDRESS` is the modern way to recreate one resource. The old `terraform taint` command is deprecated.'}],
src:[['terraform_data resource',K.L+'resources/terraform-data'],['Plan options',CLI+'commands/plan#replace-address']]};
})();
