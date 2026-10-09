/* LearnSphere - Terraform, Section 13: HCP Terraform.
   Lectures 0-9 are core, 10-18 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,LG=K.L,CLI=K.CLI,C=K.D+'cloud-docs/';

/* ---------- diagrams ---------- */
const org=K.dg(700,250,[
[10,10,680,230,'How HCP Terraform is organised',1],
[30,45,200,50,'Organization|(your company)',2],
[80,115,200,45,'Project: network',0],[80,175,200,45,'Project: apps',0],
[330,115,150,45,'Workspace|net-dev',0],[330,175,150,45,'Workspace|net-prod',0],[510,115,160,105,'A workspace has:|state, variables,|runs, settings,|access',2]],
[[130,95,180,115],[130,95,180,175],[280,137,330,137],[280,197,330,197],[480,150,510,150]]);

const flows=K.dg(700,200,[
[10,10,680,180,'Three ways to start a run',1],
[30,55,190,110,'VCS-driven|push or merge to Git|-> run starts',2],[255,55,190,110,'CLI-driven|terraform plan/apply|from your terminal',0],[480,55,190,110,'API-driven|a script or pipeline|calls the API',0]],
[]);

const run=K.dg(700,150,[
[10,10,680,130,'A remote run',1],
[25,55,90,50,'Pending',0],[130,55,90,50,'Plan',2],[235,55,110,50,'Cost estimate|(optional)',0],[360,55,100,50,'Policy|check',2],[475,55,90,50,'Approval',0],[580,55,90,50,'Apply',2]],
[[115,80,130,80],[220,80,235,80],[345,80,360,80],[460,80,475,80],[565,80,580,80]]);

/* ---------- 0: overview ---------- */
L['tf:12:0']={blocks:[
{p:'**HCP Terraform** (formerly Terraform Cloud) is the **hosted platform** from HashiCorp for running Terraform as a team. It runs your plans and applies on **remote workers**, stores and locks **state**, and adds access control, policies and a private registry.'},
{svg:org},
{t:[['Concept','What it is'],
['**Organization**','Top level: your company or team. Holds users, teams, settings and billing.'],
['**Project**','A group of workspaces (for example by team or application). Permissions can be set per project.'],
['**Workspace**','The unit of work: one configuration with its own state, variables, runs and access.'],
['**Run**','One plan and optionally apply, with logs and history.'],
['**Variable set**','Variables shared across many workspaces.'],
['**Private registry**','Your own modules and providers.']]},
{h:'What HCP Terraform adds to the CLI'},
{t:[['Area','CLI only','HCP Terraform'],
['Runs','On your machine or CI','Remote, consistent workers'],
['State','You choose a backend','Managed, versioned, locked, encrypted'],
['Access','You build it','Teams, roles and project permissions'],
['Secrets','Environment and files','Sensitive variables, dynamic credentials'],
['Governance','Not built in','Policies, run tasks, health checks'],
['Collaboration','Git and chat','UI with run history, comments, notifications']]},
{h:'A workspace is not a CLI workspace'},
{p:'An HCP Terraform workspace is much richer than a **CLI workspace** (Section 8): it has its own **variables, settings, run history and permissions**. Think of it as one managed environment or component.'},
{note:'Exam focus (004): know the hierarchy organization > project > workspace, and what HCP Terraform adds to the CLI.'}],
src:[['HCP Terraform',C],['Workspaces',C+'workspaces']]};

/* ---------- 1: workspaces and workflows ---------- */
L['tf:12:1']={blocks:[
{p:'A workspace can be driven in three ways. They differ in **how a run starts** and **where the code comes from**.'},
{svg:flows},
{t:[['Workflow','Code comes from','Run starts when','Good for'],
['**VCS-driven**','A connected Git repository','You push or merge, or open a pull request (speculative plan)','Teams using Git and code review'],
['**CLI-driven**','Your local folder','You run `terraform plan` or `apply` with the `cloud` block','Developers, quick iteration'],
['**API-driven**','Uploaded by a script (configuration version)','A script or pipeline calls the API','Custom pipelines and automation']]},
{h:'VCS-driven in detail'},
{flow:['Connect the workspace to a repository and branch','A pull request opens','HCP Terraform runs a speculative plan and reports it on the pull request','You merge to the main branch','A real run plans and waits for approval (or auto-applies)','The apply updates state']},
{h:'Remote operations'},
{p:'With a remote workspace the plan and apply run **on HCP Terraform workers**, not on your computer. Your terminal streams the output.'},
{t:[['Execution mode','Where it runs'],
['**Remote** (default)','HCP Terraform workers'],
['**Local**','Your machine; HCP Terraform only stores state'],
['**Agent**','Your own network, using an installed agent']]},
{h:'Speculative plans'},
{p:'A **speculative plan** is a plan-only run that cannot be applied. Pull requests use them to show a preview for review.'},
{note:'In remote runs, environment variables and credentials must be set **in the workspace**, because your local shell is not used.'}],
src:[['Run workflows',C+'run'],['Execution modes',C+'workspaces/settings#execution-mode']]};

/* ---------- 2: login and cloud block ---------- */
L['tf:12:2']={blocks:[
{p:'To use HCP Terraform from the CLI you **log in** once and add a **`cloud` block** to your configuration.'},
{h:'Step 1: log in'},
{code:`terraform login
# opens a browser, you create a token, paste it back
# the token is saved in ~/.terraform.d/credentials.tfrc.json`},
{h:'Step 2: add the cloud block'},
{code:`terraform {
  cloud {
    organization = "my-org"

    workspaces {
      name = "network-dev"
    }
  }
}`},
{h:'Step 3: init and run'},
{code:`terraform init
terraform plan        # runs remotely, output streams to your terminal
terraform apply`},
{h:'Choosing workspaces'},
{t:[['Setting','Meaning'],
['`name = "network-dev"`','Use exactly this workspace'],
['`tags = ["app:web"]`','Use workspaces with matching tags; select with `terraform workspace select`'],
['`project = "network"`','Place a new workspace in this project']]},
{h:'cloud block vs backend block'},
{ul:['The `cloud` block is the way to connect to HCP Terraform (and Terraform Enterprise).','You cannot have both a `cloud` block and a `backend` block.','Configuration can be supplied with environment variables such as `TF_CLOUD_ORGANIZATION` and `TF_WORKSPACE`.']},
{h:'In CI'},
{p:'Use an API token in the environment variable `TF_TOKEN_app_terraform_io` instead of `terraform login`. Use a **team** or **service** token, not a personal one.'},
{note:'The token gives access to your organisation. Treat it like a password and never commit it.'}],
src:[['cloud block',LG+'terraform#terraform-cloud'],['terraform login',CLI+'commands/login']]};

/* ---------- 3: migrate state ---------- */
L['tf:12:3']={blocks:[
{p:'To start using HCP Terraform with an existing project you **move its state** into a workspace. The workflow is almost the same as moving to any remote backend.'},
{flow:['Back up your state: terraform state pull > backup.tfstate','terraform login','Add the cloud block with organization and workspace name','Run terraform init','Terraform detects existing state and asks to copy it; answer yes','Run terraform plan: it should show No changes','Remove the old backend block and delete leftover local state']},
{code:`$ terraform init

Initializing HCP Terraform...
Do you wish to proceed? yes
Migrating from backend "s3" to HCP Terraform.
Do you want to copy existing state to the new backend? yes

HCP Terraform has been successfully initialized!`},
{h:'Check the result'},
{ul:['In the UI the workspace **States** tab shows a first state version.','`terraform state list` still lists everything.','`terraform plan` shows **No changes**, running remotely.']},
{h:'After the move'},
{t:[['Thing','Do'],
['Cloud credentials','Set them as workspace variables or use dynamic credentials; the remote worker cannot see your laptop'],
['Terraform and provider versions','Set the workspace Terraform version to match your local one'],
['Variables','Move values from tfvars and environment into workspace variables'],
['Old state','Keep a backup, then remove it from the old backend when sure']]},
{note:'A multi-workspace layout (several states from one folder) needs the `tags` form of the cloud block or one workspace per directory. Plan the layout before you migrate.'}],
src:[['Migrate state',C+'migrate'],['Remote state',LG+'state/remote']]};

/* ---------- 4: variables and sets ---------- */
L['tf:12:4']={blocks:[
{p:'Remote runs cannot read your shell or your local `.tfvars`, so you give HCP Terraform its inputs through **workspace variables**.'},
{t:[['Kind','What it sets','Example'],
['**Terraform variable**','An input variable of the configuration','`instance_type = "t3.micro"`'],
['**Environment variable**','A variable in the run environment','`AWS_REGION`, `TF_LOG`']]},
{h:'Options on a variable'},
{ul:['**Sensitive:** the value is write-only in the UI and API; it is never shown again.','**HCL:** the value is parsed as HCL (for lists and maps), not a plain string.','**Description:** documentation for your team.']},
{h:'Variable sets'},
{p:'A **variable set** is a group of variables you define once and **apply to many workspaces or projects**. Perfect for shared cloud credentials or tags.'},
{svg:K.dg(700,170,[
[10,10,680,150,'One variable set, many workspaces',1],
[30,60,170,60,'Variable set|AWS_REGION, TAGS',2],[300,45,170,35,'workspace net-dev',0],[300,90,170,35,'workspace net-prod',0],[300,130,170,25,'workspace app-dev',0],[540,60,130,60,'All get the|same values',0]],
[[200,90,300,62],[200,90,300,107],[200,95,300,142],[470,62,540,80],[470,107,540,90]])},
{h:'Precedence (low to high)'},
{flow:['Default in the variable block','Variable sets (global, project, then workspace-level sets)','Workspace variables','Variables on a run (CLI -var, -var-file, TF_VAR in CLI-driven runs)']},
{p:'A value set directly on the workspace overrides one from a variable set.'},
{h:'Typical setup'},
{t:[['Variable','Where'],
['Cloud credentials / dynamic credentials role','Variable set shared by many workspaces'],
['`env`, `region`','Workspace variables'],
['Secrets','Sensitive workspace variables, or fetched from Vault at run time']]},
{note:'Sensitive values cannot be read back from the UI. To change one you replace it.'}],
src:[['Variables',C+'workspaces/variables'],['Variable sets',C+'workspaces/variables/managing-variables#variable-sets']]};

/* ---------- 5: projects ---------- */
L['tf:12:5']={blocks:[
{p:'**Projects** group workspaces so you can manage many of them without chaos. A project is also a place to apply **permissions** and **settings** to all its workspaces at once.'},
{svg:org},
{h:'What a project gives you'},
{t:[['Feature','Meaning'],
['**Grouping**','Put workspaces for one team or application together'],
['**Permissions**','Give a team access to the whole project instead of each workspace'],
['**Variable sets**','Apply a variable set to every workspace in a project'],
['**Policy sets**','Attach policies to a project'],
['**Default**','Every workspace belongs to exactly one project; new ones go to "Default Project" unless you choose']]},
{h:'Choosing a layout'},
{t:[['Layout','Example','Good when'],
['**By team**','`platform`, `data`, `web`','Teams own their workspaces'],
['**By application**','`shop`, `blog`','Several environments per app'],
['**By environment**','`dev`, `prod`','Strong separation of access'],
['**Mixed**','`shop-prod`, `shop-dev` projects','Different rules per environment']]},
{h:'Workspace naming'},
{code:`<app>-<component>-<env>

shop-network-dev
shop-network-prod
shop-database-prod`},
{ul:['Split by **blast radius and change rate**: network changes rarely, apps change often.','Separate **prod** from non-prod at least by workspace; often by project and team.','Do not put everything into one giant workspace.']},
{note:'Think of it as folders: organization > projects > workspaces. Use them to match how your company is structured and who may change what.'}],
src:[['Projects',C+'projects'],['Workspaces',C+'workspaces']]};

/* ---------- 6: run triggers ---------- */
L['tf:12:6']={blocks:[
{p:'**Run triggers** connect workspaces: when a **source** workspace finishes a successful apply, it automatically starts a run in a **downstream** workspace.'},
{svg:K.dg(700,150,[
[10,10,680,130,'Run trigger',1],
[30,55,170,55,'network-prod|applies a change',2],[270,55,170,55,'new subnet id in outputs|(shared via outputs)',0],[510,55,160,55,'apps-prod|run starts automatically',2]],
[[200,82,270,82],[440,82,510,82]])},
{h:'Why use them'},
{flow:['The network workspace changes a subnet','It applies successfully','The apps workspace, which uses the network outputs, plans automatically','You see immediately whether apps need changes']},
{t:[['Setting','Meaning'],
['**Source workspace**','The workspace whose successful apply triggers the run'],
['**Destination (downstream)**','The workspace that starts a run'],
['Limit','A workspace can have a limited number of source workspaces (check current limits)']]},
{h:'Sharing data between workspaces'},
{code:`# in the apps workspace: read the network outputs
data "tfe_outputs" "network" {
  organization = "my-org"
  workspace    = "network-prod"
}

resource "aws_instance" "app" {
  subnet_id = data.tfe_outputs.network.values.subnet_id
}`},
{p:'The source workspace must allow other workspaces to read its state outputs (setting: share state with specific workspaces).'},
{h:'Designing dependencies'},
{ul:['Keep dependencies **one way** (network before apps), never circular.','Chains should stay short; long chains are slow and fragile.','Use run triggers for **hand-offs** between layers, not for everything.']},
{note:'Triggered runs still go through your normal approval and policy checks. Triggers start the run; they do not skip the safety steps.'}],
src:[['Run triggers',C+'workspaces/settings/run-triggers'],['tfe_outputs data source','https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/data-sources/outputs']]};

/* ---------- 7: teams and registry ---------- */
L['tf:12:7']={blocks:[
{p:'HCP Terraform controls **who can do what** with **teams** and permissions, and gives you a **private registry** for company modules and providers.'},
{h:'Teams and permissions'},
{t:[['Level','Typical permissions'],
['**Organization owners**','Everything, including billing and settings'],
['**Organization-level teams**','Manage policies, workspaces, registry, members'],
['**Project permissions**','Read, write, or admin for all workspaces in a project'],
['**Workspace permissions**','Read, plan, write (apply), admin on one workspace']]},
{t:[['Common role','Can'],
['**Read**','View runs, state outputs, settings'],
['**Plan**','Queue plans, but not apply'],
['**Write**','Apply runs and edit variables'],
['**Admin**','Change settings and access']]},
{h:'Least privilege'},
{ul:['Give developers **plan** on production and **write** on dev.','Only a few people and the pipeline get **apply** on production.','Use **team tokens** for automation instead of personal tokens.','Review team membership regularly.']},
{h:'The private registry'},
{p:'Publish your own **modules** and **providers** so teams reuse approved building blocks.'},
{code:`module "vpc" {
  source  = "app.terraform.io/my-org/vpc/aws"
  version = "~> 2.0"
}`},
{t:[['Benefit','Meaning'],
['Discoverable','Search the catalogue in the UI'],
['Versioned','Publish with Git tags (semantic versions)'],
['Controlled','Only members of the organisation can use it'],
['No-code provisioning','Approved modules can be deployed without writing code']]},
{h:'Publishing a module'},
{flow:['Name the repository terraform-<PROVIDER>-<NAME>','Connect it to the private registry','Tag a release such as v1.0.0','Teams use it with source and version']},
{note:'The module source for the private registry uses your hostname: `app.terraform.io/<org>/<name>/<provider>`.'}],
src:[['Teams',C+'users-teams-organizations/teams'],['Private registry',C+'registry']]};

/* ---------- 8: policy, health, drift, explorer ---------- */
L['tf:12:8']={blocks:[
{p:'Beyond running Terraform, HCP Terraform helps you **govern** and **monitor** your infrastructure.'},
{svg:run},
{h:'Policy enforcement'},
{p:'**Policies** are code that checks a plan before it can apply. They are written in **Sentinel** or **Open Policy Agent (OPA)** and grouped in **policy sets** attached to workspaces or projects.'},
{t:[['Enforcement level','What happens on failure'],
['**Advisory**','Warns, run continues'],
['**Soft mandatory**','Blocks, but an authorised person can override'],
['**Hard mandatory**','Blocks; no override']]},
{ul:['Examples: all resources must have an `owner` tag; no public S3 buckets; only approved regions; no instance larger than a limit.']},
{h:'Health assessments'},
{t:[['Check','Meaning'],
['**Drift detection**','Regularly compares real infrastructure with state and reports differences'],
['**Continuous validation**','Re-evaluates your `check` blocks and conditions on a schedule']]},
{p:'Enable health assessments on a workspace and HCP Terraform runs them without you starting a run. Notifications can alert you when drift appears.'},
{h:'Explorer'},
{p:'**Explorer** is an organisation-wide view of your workspaces and resources: which providers and module versions are in use, which workspaces have drift or failed checks, and where old versions remain. It helps you spot work to do across hundreds of workspaces.'},
{h:'Together'},
{flow:['A pull request creates a speculative plan','Policies check the plan on every run','After apply, health assessments watch for drift','Explorer shows the whole estate in one place']},
{note:'Which policy and health features are available depends on your plan (tier). Check the current pricing page before relying on a feature.'}],
src:[['Policy enforcement',C+'policy-enforcement'],['Health',C+'workspaces/health'],['Explorer',C+'workspaces/explorer']]};

/* ---------- 9: practical ---------- */
L['tf:12:9']={blocks:[
{p:'Connect a Git repository to a workspace, set variables, trigger a run, review the plan and apply it. You need a free HCP Terraform account and a GitHub repository. The configuration uses the `random` and `local` providers, so there is **no cloud bill**.'},
{h:'Step 1: the repository'},
{code:`# main.tf
terraform {
  required_providers {
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

variable "pet_length" {
  type    = number
  default = 2
}

resource "random_pet" "name" {
  length = var.pet_length
}

output "pet" {
  value = random_pet.name.id
}`},
{p:'Commit it to a GitHub repository.'},
{h:'Step 2: create the workspace'},
{flow:['In HCP Terraform, create an organization (or use yours)','New > Workspace > Version control workflow','Connect GitHub and pick the repository','Name it lab-dev and create it']},
{h:'Step 3: set a variable'},
{ul:['Open the workspace > Variables.','Add a Terraform variable `pet_length` = `3`.','Add a **sensitive** environment variable `EXAMPLE_TOKEN` = `abc` and note you can no longer read it.']},
{h:'Step 4: run'},
{flow:['Actions > Start new run','Read the plan: 1 to add','Confirm and apply','Open the State tab and the Outputs']},
{h:'Step 5: change through Git'},
{code:`git checkout -b longer-name
# change the default pet_length or add a resource
git commit -am "longer pet name"
git push -u origin longer-name`},
{p:'Open a pull request: HCP Terraform posts a **speculative plan** on it. Merge, then confirm the apply.'},
{h:'Step 6: clean up'},
{p:'Workspace > Settings > Destruction and Deletion > **Queue destroy plan**, apply it, then delete the workspace.'},
{t:[['You practised','Lecture'],
['Workspaces and VCS workflow','2'],
['Variables and sensitivity','5'],
['Runs and approval','1 and 9'],
['Speculative plans on pull requests','2']]},
{note:'Ready to go further? Add `terraform { cloud {...} }` to the code and run `terraform plan` from your laptop to see CLI-driven remote runs.'}],
src:[['HCP Terraform get started',K.T+'cloud-get-started']]};
})();
