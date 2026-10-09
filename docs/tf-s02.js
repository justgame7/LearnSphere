/* LearnSphere - Terraform, Section 02: Installation, Setup & Lab Environment.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,D=K.D,CLI=K.CLI;

/* ---------- diagrams ---------- */
const pick=K.dg(700,200,[
[10,10,680,180,'Where will Terraform run?',1],
[30,55,190,100,'Your laptop|package manager or|version manager',0],[255,55,190,100,'CI runner|official setup action or|pinned binary',2],[480,55,190,100,'Shared jump host|package repo + a|pinned version',0]],
[]);

const cred=K.dg(700,250,[
[10,10,680,230,'How the AWS provider finds credentials (first match wins)',1],
[30,50,120,50,'1. Provider|block arguments',0],[170,50,120,50,'2. Environment|variables',2],[310,50,120,50,'3. Shared files|~/.aws/*',0],[450,50,100,50,'4. Container|role',0],[570,50,100,50,'5. Instance|profile',0],
[170,150,360,60,'Best habit: no keys in code. Use a profile, SSO or a role.',0]],
[[150,75,170,75],[290,75,310,75],[430,75,450,75],[550,75,570,75]]);

/* ---------- 0: Choosing an install path ---------- */
L['tf:1:0']={blocks:[
{p:'Terraform is **one binary** with no dependencies. There are three ways to get it. Pick based on where it will run.'},
{svg:pick},
{t:[['Path','How','Best for','Watch out for'],
['**Package manager**','apt, dnf, brew, winget, choco','Your own laptop, jump hosts','Updates may move you to a new minor version unplanned.'],
['**Manual binary**','Download a zip from releases.hashicorp.com, put it on the PATH','CI runners, containers, locked-down machines','You must verify and update it yourself.'],
['**Version manager**','tfenv or tenv switch versions per project','Many projects with different versions','One more tool to install.']]},
{h:'How to decide'},
{flow:['Do you work on one project with one version? Use the package manager','Do several projects need different Terraform versions? Use a version manager','Is it a CI runner or container? Download a pinned binary or use the official setup action','Is the machine offline? Copy a verified binary (see additional content)']},
{h:'Which platforms are supported'},
{t:[['OS','Architectures'],
['Linux','amd64, arm64'],
['macOS','amd64 (Intel), arm64 (Apple silicon)'],
['Windows','amd64']]},
{h:'Quick comparison of effort'},
{ul:['**Package manager:** one command to install, one to upgrade.','**Binary:** download, unzip, move to a folder on PATH.','**Version manager:** install the manager once, then `install` and `use` any version.']},
{note:'Whatever you choose, record the exact Terraform version your team uses (for example in `required_version`), so everyone runs the same code the same way.'}],
src:[['Install Terraform',D+'install'],['Release downloads','https://releases.hashicorp.com/terraform/']]};

/* ---------- 1: Install on each OS ---------- */
L['tf:1:1']={blocks:[
{p:'Installing Terraform is mostly copying one file. Below are the usual steps for each system. Always check the download before trusting it.'},
{h:'Linux (Ubuntu or Debian) with the HashiCorp repository'},
{code:`wget -O - https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform`},
{h:'macOS with Homebrew'},
{code:`brew tap hashicorp/tap
brew install hashicorp/tap/terraform`},
{h:'Windows with winget or Chocolatey'},
{code:`winget install Hashicorp.Terraform
# or
choco install terraform`},
{h:'Any system: manual binary'},
{flow:['Download the zip for your OS and architecture from releases.hashicorp.com','Download the SHA256SUMS file and its signature','Verify the checksum (and the signature with HashiCorp public key)','Unzip to get the single terraform file','Put it in a folder on your PATH, for example /usr/local/bin','Open a new terminal and run terraform version']},
{code:`# Linux/macOS: verify the checksum
sha256sum -c terraform_1.12.2_SHA256SUMS --ignore-missing

# Move the binary onto the PATH
unzip terraform_1.12.2_linux_amd64.zip
sudo mv terraform /usr/local/bin/`},
{h:'Why verify?'},
{p:'A checksum proves the file was not corrupted, and the **signature** proves it was produced by HashiCorp. Package managers do this for you; with a manual download you must do it.'},
{h:'Windows PATH reminder'},
{ul:['Unzip `terraform.exe` into a folder, for example `C:\\terraform`.','Add that folder to the **Path** environment variable (System Properties > Environment Variables).','Open a **new** terminal; old ones do not see the change.']},
{note:'If the shell says "command not found", the binary is not on the PATH. Check with `which terraform` (Linux/macOS) or `where terraform` (Windows).'}],
src:[['Install Terraform',D+'install'],['Verify downloads','https://developer.hashicorp.com/well-architected-framework/operational-excellence']]};

/* ---------- 2: Verify, completion, editor ---------- */
L['tf:1:2']={blocks:[
{p:'After installing, confirm it works, turn on shell help and set up an editor that checks your code as you type.'},
{h:'Verify the install'},
{code:`terraform version
# Terraform v1.12.2
# on linux_amd64

terraform -help          # list all commands
terraform -help plan     # help for one command`},
{h:'Tab completion'},
{p:'Autocomplete suggests commands and options when you press Tab. It works for bash and zsh.'},
{code:`terraform -install-autocomplete
# restart your shell afterwards

# remove it again
terraform -uninstall-autocomplete`},
{h:'Editor setup (VS Code)'},
{flow:['Install Visual Studio Code','Open Extensions and install HashiCorp Terraform','The extension downloads the terraform-ls language server','Open a folder with .tf files and enjoy highlighting, completion and error squiggles']},
{t:[['Feature','What it gives you'],
['**Syntax highlighting**','Easier to read HCL'],
['**Completion**','Suggests resource types, arguments and references'],
['**Validation**','Shows errors and missing arguments live'],
['**Formatting**','Format on save with `terraform fmt` style'],
['**Go to definition**','Jump from a reference to its block']]},
{p:'`terraform-ls` is the **language server**: a background program that understands your configuration and answers the editor questions.'},
{h:'Handy first commands'},
{t:[['Command','Use'],
['`terraform version`','Check version and platform'],
['`terraform -help`','Command list'],
['`terraform fmt`','Format code'],
['`terraform validate`','Check syntax']]},
{note:'Add `.terraform/` and `*.tfstate*` to your `.gitignore` right away. You will meet both soon, and neither belongs in Git.'}],
src:[['Terraform CLI',CLI],['VS Code extension','https://marketplace.visualstudio.com/items?itemName=HashiCorp.terraform']]};

/* ---------- 3: Lab options and safety ---------- */
L['tf:1:3']={blocks:[
{p:'Terraform can create real, billable resources. Learn on a safe path first, then move to the cloud with guard rails.'},
{h:'Three lab levels'},
{t:[['Level','Providers','Cost','Used for'],
['**1. Local only**','`local`, `random`, `null`/`terraform_data`','Free, no account','Learn the workflow in Sections 2 to 8'],
['**2. Containers**','`docker`','Free, needs Docker','Real resources on your machine'],
['**3. Cloud**','`aws` (free tier)','Small cost if you forget cleanup','Real-world patterns in Sections 14 and 15']]},
{flow:['Start with the local and random providers','Move to the Docker provider when you want real resources','Use an AWS free-tier account with a budget alert for cloud labs','Always destroy after every lab']},
{h:'Cloud cost guards'},
{ul:['Create an **AWS Budget** with an alert at a very low amount (for example 5 dollars).','Use a separate lab account, never your production account.','Prefer the smallest sizes (`t3.micro`) and one region.','Know which services cost money even when idle: NAT gateways, load balancers, Elastic IPs not attached, RDS.']},
{h:'Safety rules for every lab'},
{t:[['Rule','Why'],
['**Tag everything** (`env = "lab"`)','Easy to find leftovers in the console'],
['**Run `terraform destroy` at the end**','Stops charges'],
['**Check the console afterwards**','Destroy can fail halfway'],
['**Never commit credentials or state**','State may contain secrets'],
['**Use least-privilege keys**','A leaked lab key does less damage'],
['**One lab per folder**','Separate state, easy cleanup']]},
{h:'A safe .gitignore'},
{code:`# Terraform working files
.terraform/
*.tfstate
*.tfstate.*
crash.log
*.tfvars
override.tf
override.tf.json
.terraformrc

# keep the lock file in Git: do not ignore .terraform.lock.hcl`},
{note:'Rule of thumb: if you would not post it on a public website, do not commit it. That includes `.tfstate` files and `.tfvars` with secrets.'}],
src:[['Get started',K.T],['Sensitive data in state',K.L+'state/sensitive-data']]};

/* ---------- 4: Cloud credentials ---------- */
L['tf:1:4']={blocks:[
{p:'Terraform needs permission to call your cloud. The safest approach is a **dedicated identity with only the permissions it needs** (least privilege), and credentials that are never written in code.'},
{h:'Create a least-privilege identity (AWS)'},
{flow:['Create an IAM user or role just for Terraform','Attach a policy that allows only the services your lab uses','For learning, use short-lived credentials (SSO or assumed role) where possible','Configure an AWS CLI profile with those credentials','Point Terraform at the profile']},
{h:'Configure a profile'},
{code:`aws configure --profile terraform-lab
# AWS Access Key ID: ...
# AWS Secret Access Key: ...
# Default region name: us-east-1

# Check who you are
aws sts get-caller-identity --profile terraform-lab`},
{h:'Three ways to give Terraform the credentials'},
{t:[['Method','How','Notes'],
['**Profile**','`export AWS_PROFILE=terraform-lab`','Keys stay in `~/.aws/credentials`, not in code.'],
['**Environment variables**','`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`','Good for CI; they disappear with the shell.'],
['**Provider block arguments**','`access_key = "..."` in code','Avoid. Secrets would land in Git and state.']]},
{svg:cred},
{h:'Example'},
{code:`# provider block: only the region, no keys
provider "aws" {
  region = "us-east-1"
}

# in your shell
export AWS_PROFILE=terraform-lab
terraform plan`},
{h:'Least-privilege tips'},
{ul:['Start from the narrowest policy that works and widen it when an error asks for it.','Avoid `AdministratorAccess` for anything except a throw-away personal lab.','Prefer roles and short-lived tokens over long-lived access keys.','Rotate or delete lab keys when finished.']},
{note:'Azure and Google use the same idea: CLI login or a service principal or service account, never keys in code. They are covered in additional content.'}],
src:[['AWS provider authentication','https://registry.terraform.io/providers/hashicorp/aws/latest/docs#authentication-and-configuration']]};

/* ---------- 5: CLI configuration ---------- */
L['tf:1:5']={blocks:[
{p:'Terraform behaviour can be tuned in two places that are **not** your `.tf` files: the **CLI configuration file** and **environment variables**. They affect how the tool runs, not what it builds.'},
{h:'The CLI configuration file'},
{t:[['OS','Default location'],
['Linux and macOS','`~/.terraformrc`'],
['Windows','`%APPDATA%\\terraform.rc`'],
['Any (override)','Set `TF_CLI_CONFIG_FILE` to a path']]},
{code:`# ~/.terraformrc
plugin_cache_dir = "$HOME/.terraform.d/plugin-cache"

credentials "app.terraform.io" {
  token = "xxxxxxxx.atlasv1.xxxxxxxxxxxx"   # created by terraform login
}`},
{h:'The plugin cache'},
{p:'Every project downloads its own copy of each provider into `.terraform/`. A **plugin cache** keeps one shared copy so later `terraform init` runs reuse it. This saves time and bandwidth.'},
{flow:['Create the cache folder: mkdir -p ~/.terraform.d/plugin-cache','Set plugin_cache_dir in .terraformrc (or TF_PLUGIN_CACHE_DIR)','Run terraform init in any project','Providers are downloaded once and then linked from the cache']},
{h:'Useful TF_* environment variables'},
{t:[['Variable','Effect'],
['`TF_LOG`','Turn on logging (`TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`)'],
['`TF_LOG_PATH`','Write the log to a file'],
['`TF_VAR_name`','Set the input variable `name`'],
['`TF_INPUT=0`','Never prompt for input (automation)'],
['`TF_IN_AUTOMATION`','Hint that a script runs it: quieter output'],
['`TF_DATA_DIR`','Move the `.terraform` directory'],
['`TF_WORKSPACE`','Select a workspace'],
['`TF_CLI_ARGS`','Extra arguments added to every command'],
['`TF_PLUGIN_CACHE_DIR`','Plugin cache location'],
['`TF_CLI_CONFIG_FILE`','Use a different CLI config file']]},
{h:'Example'},
{code:`export TF_LOG=DEBUG
export TF_LOG_PATH=terraform.log
export TF_VAR_region=eu-west-1
terraform plan`},
{h:'Logging in to HCP Terraform'},
{p:'`terraform login` opens a browser, creates an API token and saves it in `credentials.tfrc.json` in the Terraform data folder. Section 13 uses it.'},
{note:'Treat the CLI config like a secret if it contains a token. Do not copy it into a shared repository.'}],
src:[['CLI configuration',CLI+'config/config-file'],['Environment variables',CLI+'config/environment-variables']]};

/* ---------- 6: Practical ---------- */
L['tf:1:6']={blocks:[
{p:'Time to run Terraform for real, with **no cloud account**. You will use the `random` provider to invent a name and the `local` provider to write a file.'},
{h:'Step 1: create a folder and a file'},
{code:`mkdir first-config && cd first-config`},
{p:'Create `main.tf` with this content:'},
{code:`terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

resource "random_pet" "name" {
  length = 2
}

resource "local_file" "greeting" {
  filename = "greeting.txt"
  content  = "Hello from Terraform, \${random_pet.name.id}!"
}

output "pet_name" {
  value = random_pet.name.id
}`},
{h:'Step 2: run the workflow'},
{flow:['terraform init: download the two providers','terraform plan: see 2 resources to add','terraform apply: type yes to create them','cat greeting.txt: see the result','terraform destroy: remove everything']},
{code:`terraform init
terraform plan
terraform apply
cat greeting.txt
terraform output pet_name
terraform destroy`},
{h:'What to look for'},
{t:[['Command','What you should see'],
['`init`','"Terraform has been successfully initialized", plus a `.terraform` folder and `.terraform.lock.hcl`'],
['`plan`','`Plan: 2 to add, 0 to change, 0 to destroy`'],
['`apply`','`Apply complete! Resources: 2 added`, and an output `pet_name`'],
['`destroy`','`Destroy complete! Resources: 2 destroyed`']]},
{h:'Try it: change something'},
{ul:['Change `length = 2` to `length = 3` and run `terraform plan`. The pet is replaced (`-/+`) and the file is updated, because the file depends on the pet name.','Run `plan` again with no change: **No changes**.','Look at `terraform.tfstate` to see how Terraform remembers both resources.']},
{note:'Reference to a value: `random_pet.name.id` means the `id` attribute of the resource `random_pet` named `name`. You will use this pattern everywhere.'}],
src:[['random provider','https://registry.terraform.io/providers/hashicorp/random/latest/docs'],['local provider','https://registry.terraform.io/providers/hashicorp/local/latest/docs']]};
})();
