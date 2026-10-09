/* LearnSphere - Terraform, Section 08: State Management.
   Lectures 0-9 are core, 10-17 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,LG=K.L,CLI=K.CLI;

/* ---------- diagrams ---------- */
const why=K.dg(700,200,[
[10,10,680,180,'State links your code to real objects',1],
[30,60,170,80,'Configuration|aws_instance.web',0],[265,50,170,100,'State|aws_instance.web =|i-0abc123 (real id)|plus all attributes',2],[500,60,170,80,'Real world|server i-0abc123|in AWS',0]],
[[200,100,265,100],[435,100,500,100]]);

const remote=K.dg(700,220,[
[10,10,680,200,'Remote state shared by a team',1],
[30,55,120,50,'Engineer A',0],[30,125,120,50,'Engineer B',0],[30,170,120,30,'CI pipeline',0],
[270,80,160,90,'Remote backend|S3 / azurerm / gcs / HCP|state + lock',2],[520,80,150,90,'Real infrastructure',0]],
[[150,80,270,110],[150,150,270,130],[150,185,270,150],[430,125,520,125]]);

const lock=K.dg(700,170,[
[10,10,680,150,'State locking',1],
[30,55,150,60,'Run 1 starts|takes the lock',2],[230,55,210,60,'Run 2 starts|Error: state already locked|waits or fails',0],[490,55,180,60,'Run 1 finishes|releases the lock',2]],
[[180,85,230,85],[440,85,490,85]]);

const ws=K.dg(700,190,[
[10,10,680,170,'One configuration, several states (workspaces)',1],
[30,70,150,60,'main.tf|(one set of code)',0],[250,40,170,40,'workspace default|state A',0],[250,95,170,40,'workspace staging|state B',0],[250,140,170,30,'workspace prod|state C',0],[510,70,160,60,'Different real|objects per state',2]],
[[180,100,250,60],[180,100,250,115],[180,110,250,155],[420,60,510,90],[420,115,510,100],[420,155,510,110]]);

/* ---------- 0: Why state ---------- */
L['tf:7:0']={blocks:[
{p:'**State** is the record Terraform keeps of the infrastructure it manages. It is the link between a block in your code and the real object in the cloud. Without state Terraform could not tell what it already created.'},
{svg:why},
{h:'What state gives Terraform'},
{t:[['Purpose','Why it matters'],
['**Mapping**','`aws_instance.web` in code = server `i-0abc123` in AWS. Without this, Terraform would create a second server.'],
['**Metadata**','Dependencies and provider information, needed to destroy things in the right order (even after you delete the code).'],
['**Performance**','Terraform can read attributes from state instead of querying every object on large estates.'],
['**Syncing**','The plan compares code, state and reality to find what changed.']]},
{h:'What happens without state'},
{flow:['You run apply on a new folder: Terraform creates the server and records its id in state','You lose the state file','You run apply again: Terraform sees no record and thinks nothing exists','It creates a duplicate server and the old one is orphaned']},
{h:'Where state lives'},
{t:[['Backend','Where state is stored'],
['**local** (default)','A file `terraform.tfstate` in the working folder'],
['**Remote backends**','S3, Azure Blob, Google Cloud Storage, HCP Terraform and others']]},
{h:'The golden rules'},
{ul:['**Never edit state by hand.** Use `terraform state` commands.','**Never commit state to Git.** It may contain secrets.','**Protect state** like a password file: encrypt it and restrict access.','**Share state** through a remote backend with locking when more than one person works on it.']},
{note:'Exam tip: state maps configuration to real resources and stores metadata. It is **not** a backup of your infrastructure, and it is not the code.'}],
src:[['State',LG+'state'],['Purpose of state',LG+'state/purpose']]};

/* ---------- 1: Anatomy ---------- */
L['tf:7:1']={blocks:[
{p:'The state file is plain **JSON**. You should rarely read it, but knowing its shape explains why it is both useful and sensitive.'},
{code:`{
  "version": 4,
  "terraform_version": "1.12.2",
  "serial": 7,
  "lineage": "3f1c2c0e-...",
  "outputs": {
    "pet": { "value": "happy-lizard", "type": "string" }
  },
  "resources": [
    {
      "mode": "managed",
      "type": "random_pet",
      "name": "name",
      "provider": "provider[\\"registry.terraform.io/hashicorp/random\\"]",
      "instances": [
        { "attributes": { "id": "happy-lizard", "length": 2 } }
      ]
    }
  ]
}`},
{t:[['Field','Meaning'],
['`version`','State file format version'],
['`terraform_version`','CLI version that last wrote it'],
['`serial`','Counter that increases with every change; detects conflicts'],
['`lineage`','Unique id of this state; guards against mixing two different states'],
['`outputs`','Root module outputs'],
['`resources`','Every managed resource and data source with **all** its attributes']]},
{h:'Why state can contain secrets'},
{p:'State stores **every attribute** the provider returns: database passwords, private keys, tokens. Marking a value `sensitive` hides it on screen but does **not** remove it from state.'},
{h:'The local backend'},
{t:[['File','What it is'],
['`terraform.tfstate`','The current state'],
['`terraform.tfstate.backup`','The previous version, written before each change'],
['`.terraform.tfstate.lock.info`','Temporary lock information while a run is active']]},
{p:'The local backend is fine for learning and single-person experiments. It has no sharing and no versioning, and if the disk dies the state is gone.'},
{h:'Reading state safely'},
{code:`terraform state list              # addresses of everything
terraform state show random_pet.name   # one resource, readable
terraform show                    # whole state, readable
terraform output                  # only the outputs`},
{note:'Add `*.tfstate` and `*.tfstate.*` to `.gitignore` (done in Section 2). A state file in a public repository is a security incident.'}],
src:[['State file format',LG+'state'],['Local backend',LG+'backend/local']]};

/* ---------- 2: Remote backends ---------- */
L['tf:7:2']={blocks:[
{p:'A **backend** decides where state is stored and how operations run. A **remote backend** keeps state somewhere shared, safe and (usually) versioned and locked. Teams always use one.'},
{svg:remote},
{h:'Why use a remote backend'},
{t:[['Benefit','Meaning'],
['**Sharing**','Everyone and the CI pipeline see the same state'],
['**Locking**','Two runs cannot change state at the same time'],
['**Durability**','Stored in a managed service, not on a laptop'],
['**Versioning**','Older versions can be restored'],
['**Security**','Encryption and access control']]},
{h:'The common backends'},
{t:[['Backend','Stores state in','Locking'],
['`s3`','AWS S3 bucket','Native lock file (`use_lockfile`), older setups used DynamoDB'],
['`azurerm`','Azure Blob Storage','Built in (blob lease)'],
['`gcs`','Google Cloud Storage bucket','Built in'],
['`cloud` (HCP Terraform)','HCP Terraform workspace','Built in; also runs plans remotely'],
['`local`','A file on disk','File lock, local only']]},
{h:'Example: S3 backend'},
{code:`terraform {
  backend "s3" {
    bucket       = "my-team-tfstate"
    key          = "prod/network/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true      # native S3 locking
  }
}`},
{h:'Example: HCP Terraform'},
{code:`terraform {
  cloud {
    organization = "my-org"
    workspaces {
      name = "network-prod"
    }
  }
}`},
{h:'Rules for backend blocks'},
{ul:['Only **one** backend per configuration.','The backend block **cannot use variables or locals**; values must be literals (use partial configuration for secrets).','After adding or changing a backend, run `terraform init`.','The bucket or container itself must exist **before** you point Terraform at it.']},
{note:'Exam tip: remote state storage and locking are the main reasons to use a remote backend. HCP Terraform is a remote backend that also adds remote runs.'}],
src:[['Backends',LG+'backend'],['S3 backend',LG+'backend/s3'],['cloud block',LG+'terraform#terraform-cloud']]};

/* ---------- 3: Locking ---------- */
L['tf:7:3']={blocks:[
{p:'**State locking** stops two people (or two pipelines) from changing the same state at once, which could **corrupt** it. Terraform locks the state automatically for any operation that could write to it.'},
{svg:lock},
{h:'How it works'},
{flow:['A run starts (plan with refresh, apply, destroy)','Terraform asks the backend for a lock','If free, it gets the lock and works','If taken, it prints who holds it and waits or fails','The run ends and the lock is released']},
{h:'What you see when locked'},
{code:`Error: Error acquiring the state lock

Lock Info:
  ID:        4c9a2d1e-...
  Path:      my-team-tfstate/prod/terraform.tfstate
  Operation: OperationTypeApply
  Who:       alice@laptop
  Created:   2026-10-09 10:02:11 UTC`},
{h:'Backends and locking'},
{t:[['Backend','Locking'],
['`s3`','Yes: native lock file (`use_lockfile = true`) or a DynamoDB table (older approach)'],
['`azurerm`, `gcs`','Yes, built in'],
['HCP Terraform','Yes, per workspace'],
['`local`','Yes, but only on one machine'],
['`http`, `consul`, `pg`, `kubernetes`','Depends on the backend']]},
{h:'Useful flags'},
{code:`terraform plan  -lock-timeout=60s   # wait up to 60 s for the lock
terraform apply -lock=false         # skip locking (dangerous!)`},
{h:'A stuck lock'},
{p:'If a run crashes (laptop closes, CI job killed), the lock may stay behind. First **make sure no run is active**, then release it with the lock ID from the error:'},
{code:`terraform force-unlock 4c9a2d1e-...`},
{note:'`-lock=false` and `force-unlock` are for exceptions. Using them while someone else is running can corrupt state.'}],
src:[['State locking',LG+'state/locking'],['force-unlock',CLI+'commands/force-unlock']]};

/* ---------- 4: Configure backend and migrate ---------- */
L['tf:7:4']={blocks:[
{p:'Most projects start with local state and later **move** it to a remote backend. Terraform can copy the existing state for you.'},
{h:'Step by step'},
{flow:['Create the storage (for example an S3 bucket) outside this configuration','Add a backend block to the terraform block','Run terraform init -migrate-state','Answer yes when asked to copy existing state','Check with terraform state list and terraform plan (no changes)','Delete the old local state files once you are sure']},
{code:`terraform {
  backend "s3" {
    bucket       = "my-team-tfstate"
    key          = "dev/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}`},
{code:`$ terraform init -migrate-state

Initializing the backend...
Do you want to copy existing state to the new backend?
  Enter a value: yes

Successfully configured the backend "s3"!`},
{h:'Init options for backends'},
{t:[['Option','Use'],
['`-migrate-state`','Copy existing state to the new backend'],
['`-reconfigure`','Use the new backend settings and **ignore** saved ones, without copying'],
['`-backend-config=KEY=VALUE` or `=file`','Supply settings at init time (partial configuration)']]},
{h:'Partial configuration'},
{p:'The backend block cannot use variables, and secrets should not be in code. Leave settings out and pass them when you run init.'},
{code:`# backend block with only the type
terraform {
  backend "s3" {}
}

# dev.s3.tfbackend
bucket = "my-team-tfstate"
key    = "dev/terraform.tfstate"
region = "us-east-1"

terraform init -backend-config=dev.s3.tfbackend`},
{h:'Going back'},
{p:'To move state back to local, remove the backend block and run `terraform init -migrate-state`.'},
{note:'Always take a copy of the state before migrating: `terraform state pull > backup.tfstate`.'}],
src:[['Backend configuration',LG+'backend#backend-configuration'],['terraform init',CLI+'commands/init']]};

/* ---------- 5: state CLI ---------- */
L['tf:7:5']={blocks:[
{p:'The `terraform state` commands let you **inspect and carefully change** state without editing the JSON. Resource **addresses** (`aws_instance.web`, `module.app.aws_s3_bucket.b["logs"]`) identify the objects.'},
{t:[['Command','What it does','Changes state?'],
['`terraform state list`','List all resource addresses','No'],
['`terraform state show ADDR`','Show the attributes of one resource','No'],
['`terraform state pull`','Print the current state JSON','No'],
['`terraform state mv SRC DST`','Rename or move a resource address','**Yes**'],
['`terraform state rm ADDR`','Stop managing a resource (does **not** destroy it)','**Yes**'],
['`terraform state push FILE`','Overwrite remote state with a file','**Yes**, dangerous']]},
{h:'Examples'},
{code:`terraform state list
# aws_instance.web
# aws_s3_bucket.logs

terraform state show aws_instance.web

# rename a resource in state (also rename it in code)
terraform state mv aws_instance.web aws_instance.app

# forget a resource without destroying it
terraform state rm aws_s3_bucket.logs

# take a backup
terraform state pull > backup.tfstate`},
{h:'When to use which'},
{t:[['Goal','Command'],
['See what Terraform manages','`state list`'],
['Look at one object','`state show`'],
['Rename without recreating','`state mv` (or a `moved` block, lecture 8)'],
['Hand a resource over to another tool or team','`state rm` (or a `removed` block)'],
['Backup before surgery','`state pull`']]},
{h:'Safety habits'},
{ul:['Run `state pull > backup.tfstate` first.','After any change run `terraform plan` and check it shows what you expect.','Prefer **declarative** `moved` and `removed` blocks; they are reviewed in Git like code.','Never use `state push` unless you know exactly why.']},
{note:'`state rm` removes the record only. The real resource keeps running and Terraform forgets it.'}],
src:[['terraform state',CLI+'commands/state']]};

/* ---------- 6: Drift and refresh-only ---------- */
L['tf:7:6']={blocks:[
{p:'**Drift** is when real infrastructure no longer matches state and code, usually because someone changed it outside Terraform (a console edit, a script, an autoscaler).'},
{h:'How Terraform notices'},
{flow:['Every plan first refreshes: it asks providers for the real attributes','It compares real values with state','It compares state with the configuration','It shows both: changes outside Terraform, and changes needed to match the code']},
{code:`Note: Objects have changed outside of Terraform

  # aws_instance.web has changed
  ~ resource "aws_instance" "web" {
      ~ tags = { "owner" = "bob" } -> {}      # someone removed a tag
    }

# then the plan to fix it:
  ~ tags = {} -> { "owner" = "bob" }`},
{h:'Refresh-only mode'},
{p:'Sometimes the outside change is **right** and you want to record it, not undo it. `-refresh-only` updates state to match reality **without changing any infrastructure**.'},
{code:`terraform plan  -refresh-only    # show drift only
terraform apply -refresh-only    # accept it into state`},
{t:[['You want to','Do'],
['See what drifted','`terraform plan -refresh-only`'],
['Accept reality as the new state (and then update your code to match)','`terraform apply -refresh-only`'],
['Undo the drift and force reality back to the code','Normal `terraform apply`']]},
{h:'Two ways to resolve drift'},
{svg:K.dg(700,150,[
[10,10,680,130,'Someone changed a resource by hand',1],
[30,55,200,60,'Revert it: terraform apply|(code wins)',2],[270,55,200,60,'Accept it: apply -refresh-only,|then edit the code',0],[510,55,160,60,'Ignore it: lifecycle|ignore_changes',0]],[])},
{note:'The old `terraform refresh` command is deprecated because it changed state without showing a plan. Use `plan -refresh-only` and `apply -refresh-only`. Use `-refresh=false` to skip refresh on very large estates.'}],
src:[['Refresh-only mode',CLI+'commands/plan#refresh-only-mode'],['Manage drift',K.T]]};

/* ---------- 7: moved and removed ---------- */
L['tf:7:7']={blocks:[
{p:'When you **rename** a resource in code, Terraform sees "old one gone, new one appeared" and plans to destroy and recreate it. **Refactoring blocks** tell Terraform it is the same object.'},
{h:'moved block: rename or relocate'},
{code:`# you renamed aws_instance.web to aws_instance.app in code
moved {
  from = aws_instance.web
  to   = aws_instance.app
}`},
{code:`terraform plan
# aws_instance.web has moved to aws_instance.app
# Plan: 0 to add, 0 to change, 0 to destroy.`},
{t:[['You change','moved block'],
['Rename a resource','`from = a.old`  `to = a.new`'],
['Move into a module','`from = aws_s3_bucket.b`  `to = module.storage.aws_s3_bucket.b`'],
['Switch `count` to `for_each`','`from = aws_instance.web[0]`  `to = aws_instance.web["a"]`']]},
{h:'removed block: stop managing without destroying'},
{code:`# delete the resource block, then:
removed {
  from = aws_s3_bucket.logs

  lifecycle {
    destroy = false     # forget it, keep the real bucket
  }
}`},
{p:'Without the `removed` block, deleting the resource from code **destroys** the real object. With `destroy = false`, Terraform only forgets it.'},
{h:'Why blocks beat state commands'},
{t:[['','`terraform state mv/rm`','`moved` / `removed` blocks'],
['**Reviewed in Git**','No','Yes'],
['**Works for every teammate and environment**','Run by hand everywhere','Applied on the next normal plan'],
['**Safe to preview**','After the fact','In `plan`']]},
{ul:['Keep `moved` blocks in the code for a while so every environment catches up, then remove them.','Always run `plan` and expect **0 to destroy** for a pure rename.']},
{note:'Exam tip: `moved` renames or relocates; `removed` stops managing. Both are declarative alternatives to `terraform state mv` and `state rm`.'}],
src:[['Refactoring',LG+'modules/develop/refactoring'],['removed block',LG+'resources/syntax#removing-resources']]};

/* ---------- 8: Workspaces ---------- */
L['tf:7:8']={blocks:[
{p:'**CLI workspaces** let one configuration keep **several separate state files**. Each workspace has its own state, so the same code can manage different sets of real objects.'},
{svg:ws},
{code:`terraform workspace list          # * default
terraform workspace new staging   # create and switch
terraform workspace select default
terraform workspace show
terraform workspace delete staging`},
{p:'Use the name in code with `terraform.workspace`.'},
{code:`resource "aws_s3_bucket" "b" {
  bucket = "demo-\${terraform.workspace}-bucket"
}`},
{h:'What a workspace is and is not'},
{t:[['Is','Is not'],
['A separate **state** for the same backend and code','A separate **configuration** or branch'],
['Good for short-lived copies (test a change, feature environments)','A reliable boundary between dev and prod'],
['Selected with `workspace select` or `TF_WORKSPACE`','Visible in the code unless you print the name']]},
{h:'Why they are not an environment strategy by themselves'},
{ul:['Same code and same backend credentials for every workspace: one mistaken `select` and you change prod.','It is hard to see which workspace you are in.','Environments usually need different sizes, accounts and access, not only different state.']},
{h:'Common environment layouts'},
{t:[['Layout','Notes'],
['Separate folders per environment','Clear, different variables and backends (most common)'],
['Workspaces with var files','Same code, easy, but less isolation'],
['HCP Terraform workspaces','Different thing: a full workspace with its own variables, runs and access']]},
{note:'The term is confusing: **CLI workspaces** (this lecture) are not the same as **HCP Terraform workspaces** (Section 13), which are much richer.'}],
src:[['Workspaces',LG+'state/workspaces'],['terraform workspace',CLI+'commands/workspace']]};

/* ---------- 9: Practical ---------- */
L['tf:7:9']={blocks:[
{p:'Move local state to a "remote" location with locking, then change a resource by hand and find the drift. We use the **local backend with a custom path** so no cloud account is needed; the steps are the same for S3.'},
{h:'Step 1: start with default local state'},
{code:`terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

resource "local_file" "note" {
  filename = "note.txt"
  content  = "hello state"
}`},
{code:`terraform init
terraform apply
ls                      # terraform.tfstate is here
terraform state list    # local_file.note`},
{h:'Step 2: back up, add a backend, migrate'},
{code:`terraform state pull > backup.tfstate
mkdir -p ../shared-state`},
{p:'Add to the `terraform` block:'},
{code:`  backend "local" {
    path = "../shared-state/dev.tfstate"
  }`},
{code:`terraform init -migrate-state      # answer yes
terraform state list               # same resources
terraform plan                     # No changes
rm terraform.tfstate terraform.tfstate.backup`},
{h:'Step 3: see locking'},
{p:'Open two terminals in the folder. In the first run `terraform apply` and **do not type yes**. In the second run `terraform plan`:'},
{code:`Error: Error acquiring the state lock`},
{p:'Type `no` in the first terminal and the lock is released.'},
{h:'Step 4: create drift'},
{code:`echo "changed by hand" > note.txt
terraform plan -refresh-only
# Note: Objects have changed outside of Terraform
#   ~ local_file.note ... content changed`},
{h:'Step 5: resolve it both ways'},
{t:[['Option','Command','Result'],
['Revert to the code','`terraform apply`','`note.txt` is rewritten to "hello state"'],
['Accept the change','`terraform apply -refresh-only`','State records the new reality; edit the code to match']]},
{h:'Step 6: refactor without recreating'},
{p:'Rename `local_file.note` to `local_file.memo` in the code and add:'},
{code:`moved {
  from = local_file.note
  to   = local_file.memo
}`},
{code:`terraform plan     # 0 to add, 0 to change, 0 to destroy
terraform apply
terraform destroy`},
{t:[['You practised','Lecture'],
['Migrating state to a new backend','5'],
['Locking','4'],
['Drift and refresh-only','7'],
['`moved` blocks','8']]},
{note:'With S3 the backend block changes to `backend "s3" { ... use_lockfile = true }` and the bucket must exist first. Everything else in this lab stays the same.'}],
src:[['Backends',LG+'backend'],['Refresh-only mode',CLI+'commands/plan#refresh-only-mode']]};
})();
