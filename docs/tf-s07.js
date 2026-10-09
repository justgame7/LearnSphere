/* LearnSphere - Terraform, Section 07: Dependencies, Lifecycle & Validation.
   Lectures 0-7 are core, 8-13 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,LG=K.L;

/* ---------- diagrams ---------- */
const graph=K.dg(700,230,[
[10,10,680,210,'Dependency graph: arrows point to what must exist first',1],
[30,90,130,50,'aws_vpc.main',0],[210,40,150,50,'aws_subnet.a',0],[200,140,170,50,'aws_security_group.web',0],[420,90,130,50,'aws_instance.web',2],[600,90,80,50,'output',0]],
[[160,105,210,70],[160,125,210,160],[360,70,420,100],[360,160,420,130],[550,115,600,115]]);

const cbd=K.dg(700,200,[
[10,10,330,180,'Default: destroy, then create',1],[360,10,330,180,'create_before_destroy: create, then destroy',1],
[30,55,130,40,'1. Destroy old',0],[190,55,130,40,'2. Create new',0],[30,115,290,50,'Gap: nothing is running (downtime)',2],
[380,55,130,40,'1. Create new',0],[540,55,130,40,'2. Destroy old',0],[380,115,290,50,'Both exist for a moment: no gap',2]],
[[160,75,190,75],[510,75,540,75]]);

const conds=K.dg(700,180,[
[10,10,680,160,'Where to put checks',1],
[30,55,150,70,'variable validation|checks INPUT|before plan',0],[205,55,150,70,'precondition|checks assumptions|before a resource',2],[380,55,150,70,'postcondition|checks the result|after a resource',2],[555,55,115,70,'check block|ongoing health|warns only',0]],
[]);

/* ---------- 0: Dependencies ---------- */
L['tf:6:0']={blocks:[
{p:'Terraform must create things in the right order: a network before the server in it. It works out the order from **dependencies**. Most are found automatically; a few you must state yourself.'},
{h:'Implicit dependency (automatic)'},
{p:'When one resource **references** another, Terraform knows the second must exist first.'},
{code:`resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "a" {
  vpc_id     = aws_vpc.main.id      # reference = dependency
  cidr_block = "10.0.1.0/24"
}`},
{p:'No extra code is needed: the subnet waits for the VPC.'},
{h:'Explicit dependency: depends_on'},
{p:'Use `depends_on` when there is a dependency Terraform **cannot see** because nothing is referenced: for example a server that needs an IAM policy attached, but never reads any value from it.'},
{code:`resource "aws_instance" "app" {
  ami           = var.ami
  instance_type = "t3.micro"

  depends_on = [aws_iam_role_policy.app_policy]
}`},
{t:[['','Implicit','Explicit (`depends_on`)'],
['**Created by**','A reference such as `aws_vpc.main.id`','You list the resource'],
['**Use when**','You use a value from the other resource','Order matters but no value is shared'],
['**Preference**','Always first choice','Last resort']]},
{h:'Why prefer implicit?'},
{ul:['It documents **why** something depends on another (you use its value).','`depends_on` can make Terraform treat values as unknown and plan more changes than needed.','Always add a comment explaining why a `depends_on` exists.']},
{h:'depends_on also works on modules and data'},
{code:`module "app" {
  source     = "./app"
  depends_on = [module.network]
}`},
{note:'Exam tip: a reference creates an implicit dependency. `depends_on` is for hidden dependencies only.'}],
src:[['Resource dependencies',LG+'meta-arguments/depends_on']]};

/* ---------- 1: Graph ---------- */
L['tf:6:1']={blocks:[
{p:'Behind every plan is a **dependency graph**: a map of what depends on what. Terraform walks it to decide order and what can happen **in parallel**.'},
{svg:graph},
{h:'How it uses the graph'},
{flow:['Read every resource, data source, variable and output','Add an edge for each reference and each depends_on','Walk the graph from the nodes with no dependencies','Run independent branches at the same time (parallelism, default 10)','Wait for dependencies before starting a node']},
{t:[['Operation','Order'],
['**Create / update**','Dependencies first, dependents after'],
['**Destroy**','Reverse: dependents first, then what they depend on'],
['**Independent resources**','In parallel']]},
{h:'In the picture above'},
{ul:['The VPC is created first.','The subnet and the security group both need only the VPC, so they are created **in parallel**.','The instance waits for both.','On destroy the order is reversed: instance, then subnet and group, then VPC.']},
{h:'See the graph'},
{code:`terraform graph | dot -Tpng > graph.png
# or list resources in state order
terraform state list`},
{h:'Control the speed'},
{code:`terraform apply -parallelism=5      # fewer parallel operations
# default is 10`},
{p:'Lowering parallelism helps when an API rate-limits you.'},
{h:'Cycles'},
{p:'If A depends on B and B depends on A, Terraform reports a **dependency cycle** and refuses to continue. Break it by removing one reference or moving the shared piece into a third resource.'},
{note:'The graph is built from your configuration, not from the order of lines in a file. Moving code around changes nothing.'}],
src:[['terraform graph',K.CLI+'commands/graph'],['Resource behavior',LG+'resources/behavior']]};

/* ---------- 2: create_before_destroy and prevent_destroy ---------- */
L['tf:6:2']={blocks:[
{p:'The `lifecycle` block, available on every resource, changes **how Terraform creates, replaces and destroys** it. Two settings are used constantly.'},
{h:'create_before_destroy'},
{p:'When a change needs a **replacement**, the default is destroy the old, then create the new, which leaves a gap. `create_before_destroy = true` reverses it.'},
{svg:cbd},
{code:`resource "aws_launch_template" "web" {
  name_prefix   = "web-"
  image_id      = var.ami
  instance_type = "t3.micro"

  lifecycle {
    create_before_destroy = true
  }
}`},
{ul:['Use it for things that must keep serving: instances behind a load balancer, certificates, launch templates.','The old and new object exist at the same time, so names must not collide. Use `name_prefix` or random suffixes.','It spreads to dependencies: Terraform may apply it to resources the object depends on.']},
{h:'prevent_destroy'},
{p:'`prevent_destroy = true` makes Terraform **fail** any plan that would destroy the resource. It protects databases, state buckets and other critical objects.'},
{code:`resource "aws_db_instance" "main" {
  # ...
  lifecycle {
    prevent_destroy = true
  }
}`},
{code:`Error: Instance cannot be destroyed

  on main.tf line 1:
  Resource aws_db_instance.main has lifecycle.prevent_destroy set,
  but the plan calls for this resource to be destroyed.`},
{t:[['Setting','Effect','Typical use'],
['`create_before_destroy`','New first, then old','Zero-downtime replacement'],
['`prevent_destroy`','Plan fails if destroy is needed','Critical data']]},
{h:'Limits of prevent_destroy'},
{ul:['It only protects while the setting is in your code. Remove the block and the setting, and destroy proceeds.','It does not stop someone deleting the object in the console.','`terraform destroy` fails entirely if one protected resource would be destroyed.']},
{note:'Guard rails in code are a safety net, not security. Combine them with access control on who may run Terraform.'}],
src:[['lifecycle',LG+'meta-arguments/lifecycle']]};

/* ---------- 3: ignore_changes and replace_triggered_by ---------- */
L['tf:6:3']={blocks:[
{p:'Two more lifecycle settings handle **drift** you want to tolerate and **replacements** you want to trigger.'},
{h:'ignore_changes'},
{p:'Tells Terraform to **ignore differences** in certain arguments after the resource is created. Use it when something else manages that value (an autoscaler, another team, a tagging tool).'},
{code:`resource "aws_autoscaling_group" "web" {
  desired_capacity = 2
  # ...

  lifecycle {
    ignore_changes = [desired_capacity, tags]
  }
}

# ignore everything (rare)
#   ignore_changes = all`},
{t:[['Without ignore_changes','With ignore_changes'],
['Autoscaler changes capacity to 5; the next plan wants to set it back to 2','The plan shows no change for capacity']]},
{ul:['The value you write is used **only at creation**.','Do not use `all` unless you really mean "create it and never touch it again".']},
{h:'replace_triggered_by'},
{p:'Forces a resource to be **replaced** whenever a different resource (or one of its attributes) changes.'},
{code:`resource "aws_instance" "app" {
  ami           = var.ami
  instance_type = "t3.micro"

  lifecycle {
    replace_triggered_by = [
      aws_security_group.app.id
    ]
  }
}`},
{p:'If the security group `id` changes, the instance is replaced too.'},
{h:'Choose the right tool'},
{t:[['Goal','Use'],
['Something else changes an argument and I want to leave it alone','`ignore_changes`'],
['Replace B whenever A changes','`replace_triggered_by`'],
['Replace once, right now','`terraform apply -replace=ADDRESS`'],
['Keep serving during replacement','`create_before_destroy`']]},
{h:'The lifecycle block at a glance'},
{code:`lifecycle {
  create_before_destroy = true
  prevent_destroy       = true
  ignore_changes        = [tags]
  replace_triggered_by  = [aws_security_group.app.id]
}`},
{note:'Lifecycle arguments need literal values (true, a list of attribute names). They cannot be variables or expressions.'}],
src:[['lifecycle',LG+'meta-arguments/lifecycle']]};

/* ---------- 4: Preconditions and postconditions ---------- */
L['tf:6:4']={blocks:[
{p:'**Custom conditions** let you state assumptions and guarantees in code, with a clear message, so a configuration fails early instead of creating something broken.'},
{svg:conds},
{t:[['Condition','Checked','Purpose'],
['`precondition`','Before the resource is created or changed','Is my assumption true? (inputs, data, other resources)'],
['`postcondition`','After the resource is created','Did I get what I expected?']]},
{h:'Where they go'},
{p:'Inside the `lifecycle` block of a resource, data source or output.'},
{code:`data "aws_ami" "app" {
  most_recent = true
  owners      = ["self"]

  lifecycle {
    postcondition {
      condition     = self.architecture == "x86_64"
      error_message = "The AMI must be x86_64."
    }
  }
}

resource "aws_instance" "app" {
  ami           = data.aws_ami.app.id
  instance_type = var.instance_type

  lifecycle {
    precondition {
      condition     = data.aws_ami.app.root_device_type == "ebs"
      error_message = "The AMI must use an EBS root device."
    }
  }
}`},
{h:'self in postconditions'},
{p:'In a `postcondition` use `self` to refer to the resource that was just created, for example `self.public_ip != ""`.'},
{h:'Choosing between checks'},
{t:[['Need','Use'],
['Validate a single input variable','Variable `validation` block'],
['Check an assumption about other resources or data before creating','`precondition`'],
['Verify a guarantee of the created object','`postcondition`'],
['Ongoing warning about the whole system','`check` block (next lecture)']]},
{note:'Failing conditions **stop** the plan or apply with your message. They protect users of reusable modules, who get a clear error instead of a confusing provider failure.'}],
src:[['Custom conditions',LG+'expressions/custom-conditions']]};

/* ---------- 5: check blocks ---------- */
L['tf:6:5']={blocks:[
{p:'A **check block** defines an **assertion** about your infrastructure that Terraform evaluates at the end of plan and apply. If it fails, you get a **warning**, but the run is **not blocked**. It is for ongoing health, not for gating changes.'},
{code:`check "website_is_up" {
  data "http" "site" {
    url = "https://www.example.com"
  }

  assert {
    condition     = data.http.site.status_code == 200
    error_message = "The website did not return 200 OK."
  }
}`},
{t:[['','precondition / postcondition','check block'],
['**Failure**','Error: the run stops','Warning: the run continues'],
['**Belongs to**','One resource or data source','Stands alone'],
['**Use for**','Guarding a change','Watching overall health']]},
{h:'How it behaves'},
{flow:['Terraform finishes the plan or apply','It evaluates every check block','A scoped data source inside the block runs its lookup','If an assert is false a warning is printed','Errors in the data source inside a check become warnings too']},
{h:'Typical uses'},
{ul:['A website or API responds after deployment.','A certificate has more than 30 days left.','A required tag exists on a resource.','The number of subnets matches what you expect.']},
{h:'The warning'},
{code:`Warning: Check block assertion failed

  on main.tf line 9, in check "website_is_up":
   9:     condition = data.http.site.status_code == 200

The website did not return 200 OK.`},
{note:'Because a check cannot stop a run, do not use it to protect against dangerous changes. Use preconditions or `prevent_destroy` for that.'}],
src:[['check blocks',LG+'checks']]};

/* ---------- 6: Timeouts and provisioners ---------- */
L['tf:6:6']={blocks:[
{p:'Two features deal with **slow operations** and **running scripts**. Both exist for edge cases; learn them so you recognise them, then prefer better options.'},
{h:'Timeouts'},
{p:'Many resources accept a `timeouts` block that sets how long Terraform waits for create, update or delete before giving up. Which operations are supported depends on the resource.'},
{code:`resource "aws_db_instance" "main" {
  # ...
  timeouts {
    create = "60m"
    delete = "30m"
  }
}`},
{p:'Raise a timeout only when the real operation is legitimately slow, such as a large database.'},
{h:'Provisioners: a last resort'},
{p:'A **provisioner** runs a script or command as part of creating or destroying a resource.'},
{t:[['Provisioner','Runs','Example'],
['`local-exec`','On the machine running Terraform','`echo done >> log.txt`'],
['`remote-exec`','On the new resource (over SSH or WinRM)','Install a package'],
['`file`','Copies a file to the new resource','Upload a config']]},
{code:`resource "aws_instance" "web" {
  ami           = var.ami
  instance_type = "t3.micro"

  provisioner "local-exec" {
    command = "echo \${self.private_ip} >> ips.txt"
  }
}`},
{h:'Why they are a last resort'},
{ul:['Terraform cannot **plan** what a script will do or undo it, so it is outside the declarative model.','They run only at create or destroy, so they cannot fix drift later.','Failures leave resources **tainted** (marked for replacement).','They need network access and credentials to the new resource.']},
{h:'Better alternatives'},
{t:[['You want to','Prefer'],
['Configure a server at first boot','`user_data` / cloud-init, or a prebuilt image (Packer)'],
['Configure software continuously','Ansible or another configuration-management tool'],
['Call an API that has no resource','A provider or a `terraform_data` resource with a trigger'],
['Run a one-off check','A `check` block or a pipeline step']]},
{h:'Controlling failures'},
{code:`provisioner "local-exec" {
  command    = "./notify.sh"
  on_failure = continue      # default is fail
}
provisioner "local-exec" {
  when    = destroy          # run when the resource is destroyed
  command = "./cleanup.sh"
}`},
{note:'HashiCorp documents provisioners as a last resort. If you can use user data, an image or a configuration-management tool, do that instead.'}],
src:[['Provisioners',LG+'resources/provisioners/syntax'],['Timeouts',LG+'resources/syntax#operation-timeouts']]};

/* ---------- 7: Practical ---------- */
L['tf:6:7']={blocks:[
{p:'A lab with **no cloud account** that practises replacing safely and adding guard rails: `create_before_destroy`, `prevent_destroy`, a variable validation, a precondition and a check block.'},
{h:'Step 1: the configuration'},
{code:`terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

variable "release" {
  type    = string
  default = "v1"
  validation {
    condition     = can(regex("^v[0-9]+$", var.release))
    error_message = "release must look like v1, v2, v3."
  }
}

# replaced when release changes, new one is created FIRST
resource "random_pet" "app" {
  keepers = { release = var.release }
  length  = 2
  lifecycle {
    create_before_destroy = true
  }
}

# a protected "database" file
resource "local_file" "db" {
  filename = "db.txt"
  content  = "important data"
  lifecycle {
    prevent_destroy = true
  }
}

# a file that must only be written when the pet name is long enough
resource "local_file" "app" {
  filename = "app-\${var.release}.txt"
  content  = "running \${random_pet.app.id}"
  lifecycle {
    precondition {
      condition     = length(random_pet.app.id) > 5
      error_message = "The pet name is too short."
    }
  }
}

check "db_file_present" {
  assert {
    condition     = fileexists("db.txt")
    error_message = "db.txt is missing (this is only a warning)."
  }
}`},
{h:'Step 2: run it'},
{code:`terraform init
terraform apply`},
{h:'Step 3: replace with create_before_destroy'},
{code:`terraform apply -var="release=v2"
# random_pet.app must be replaced
# +/- create replacement and then destroy   (note +/- not -/+)`},
{p:'The `+/-` symbol means **create first, then destroy**.'},
{h:'Step 4: trigger the guard rails'},
{code:`terraform apply -var="release=beta"
# Error: release must look like v1, v2, v3.        (validation)

terraform destroy
# Error: Instance cannot be destroyed              (prevent_destroy)

rm db.txt && terraform plan
# Warning: Check block assertion failed            (check)`},
{h:'Step 5: clean up'},
{p:'Remove `prevent_destroy` from `local_file.db`, run `terraform apply`, then `terraform destroy`.'},
{t:[['You saw','Where'],
['`+/-` replacement order','create_before_destroy'],
['Error stops the run','validation, precondition, prevent_destroy'],
['Warning only','check block']]},
{note:'Guard rails cost nothing and catch mistakes early. Add them to every shared module and every production resource.'}],
src:[['Lifecycle',LG+'meta-arguments/lifecycle'],['Custom conditions',LG+'expressions/custom-conditions']]};
})();
