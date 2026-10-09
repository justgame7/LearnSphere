/* LearnSphere - Terraform, Section 01: Introduction & IaC Foundations.
   Lectures 0-6 are core, 7-13 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,I=K.I,D=K.D;

/* ---------- diagrams ---------- */
const manual=K.dg(700,170,[
[10,10,320,150,'Without IaC (click and hope)',1],[370,10,320,150,'With IaC (describe and apply)',1],
[25,45,90,40,'Console|clicks',0],[130,45,90,40,'Notes in|a wiki',0],[235,45,85,40,'Drift and|surprises',2],
[385,45,90,40,'Files in|Git',0],[490,45,90,40,'Terraform|plan/apply',2],[595,45,85,40,'Same result|every time',0]],
[[115,65,130,65],[220,65,235,65],[475,65,490,65],[580,65,595,65]]);

const how=K.dg(700,290,[
[10,10,680,270,'What happens on terraform plan / apply',1],
[30,50,150,50,'Configuration|*.tf files|(what you want)',0],[30,150,150,50,'State|terraform.tfstate|(what exists)',0],
[250,90,150,70,'Terraform Core|builds the graph and|calculates the plan',2],
[470,50,200,46,'Provider: aws',0],[470,120,200,46,'Provider: azurerm',0],[470,190,200,46,'Provider: kubernetes',0],
[250,215,150,44,'You: review and approve',0]],
[[180,75,250,105],[180,175,250,145],[400,125,470,73],[400,125,470,143],[400,140,470,213],[325,160,325,215]]);

const family=K.dg(700,200,[
[10,10,680,180,'The Terraform family',1],
[30,55,150,90,'Terraform CLI|one binary, you run it|free (BUSL licence)',2],[210,55,150,90,'HCP Terraform|hosted by HashiCorp|runs, state, teams',0],[390,55,140,90,'Terraform|Enterprise|self-hosted version',0],[555,55,120,90,'OpenTofu|open-source fork|(Linux Foundation)',0]],
[[180,100,210,100],[360,100,390,100]]);

/* ---------- 0: Course overview ---------- */
L['tf:0:0']={blocks:[
{p:'This course takes you from zero to someone who can **write, test, secure and operate infrastructure as code with Terraform**. It follows the objectives of the **HashiCorp Certified: Terraform Associate (004)** exam, but the goal is real skill: describe infrastructure in files, change it safely, share state with a team and fix problems when they appear. This lecture explains how the course is organised.'},
{h:'Key terms in one minute'},
{t:[['Term','Plain meaning'],
['**Infrastructure as Code (IaC)**','Servers, networks and databases described in text files instead of clicked together.'],
['**Terraform**','A tool that reads those files and creates or changes the real infrastructure to match.'],
['**Configuration**','Your `.tf` files: what you want to exist.'],
['**Provider**','A plugin that talks to one platform API (AWS, Azure, Kubernetes, GitHub ...).'],
['**Resource**','One object Terraform manages, for example a virtual machine or a bucket.'],
['**State**','Terraform own record of what it created and how it maps to real objects.'],
['**Module**','A reusable bundle of configuration.'],
['**HCP Terraform**','The hosted service that runs Terraform for teams.']]},
{h:'The route through the course'},
{flow:['Why IaC and how Terraform works (Section 1)','Install and set up a safe lab (Section 2)','The core workflow: init, plan, apply, destroy (Section 3)','Write configuration: providers, resources, variables (Sections 4 and 5)','Expressions, lifecycle and state (Sections 6 to 8)','Modules and maintaining infrastructure (Sections 9 and 10)','Security, testing, HCP Terraform and real projects (Sections 11 to 15)']},
{h:'The fifteen sections at a glance'},
{t:[['#','Section','After it you can'],
['1','Introduction & IaC Foundations','Explain IaC and how Terraform works'],
['2','Installation, Setup & Lab Environment','Install Terraform and run a first config'],
['3','The Core Workflow & CLI','Use init, plan, apply and destroy confidently'],
['4','HCL, Providers, Resources & Data Sources','Write real configuration'],
['5','Variables, Outputs, Locals & Types','Make configuration reusable'],
['6','Expressions, Functions & Dynamic Configuration','Create many resources from data'],
['7','Dependencies, Lifecycle & Validation','Control order and protect resources'],
['8','State Management','Store, share and repair state'],
['9','Modules','Package and reuse code'],
['10','Maintaining Infrastructure','Import, upgrade and refactor'],
['11','Secrets, Security & Policy','Keep secrets out of state and code'],
['12','Testing, Debugging & Troubleshooting','Test and fix problems'],
['13','HCP Terraform','Work as a team in the cloud'],
['14','Real-World Infrastructure Patterns','Build a three-tier platform'],
['15','Automation, CI/CD & Production Readiness','Ship it with a pipeline']]},
{h:'How sections map to the Associate (004) objectives'},
{t:[['Exam objective','Main sections'],
['1. Infrastructure as Code with Terraform','1'],
['2. Terraform fundamentals (providers, state)','1, 4, 8'],
['3. Core Terraform workflow','3'],
['4. Terraform configuration','4 to 7, 11'],
['5. Terraform modules','9'],
['6. Terraform state management','8'],
['7. Maintain infrastructure with Terraform','10, 12'],
['8. HCP Terraform','13']]},
{p:'HashiCorp publishes **no weights per objective**, so study every objective. Sections 14 and 15 are hands-on practice beyond the exam.'},
{h:'Lecture tags: CLI, HCP or Both'},
{t:[['Tag','Meaning'],
['**CLI**','Uses the Terraform command line on your own machine or a CI runner.'],
['**HCP**','Needs HCP Terraform (or Terraform Enterprise).'],
['**Both**','The idea applies in either place.']]},
{h:'Prerequisites self-check'},
{ul:['I can open a terminal and use `cd`, `ls`, `cat` and `curl`.','I know what an API, a virtual machine and a network are, at a basic level.','I can read JSON or YAML (indentation and key/value pairs).','I have a Windows, Mac or Linux computer where I can install software.']},
{p:'If a box is unchecked, do not worry: an extra Linux, Git and cloud refresher is planned, and every command here is explained.'},
{h:'How to study'},
{ul:['Read the lecture, then **type the commands yourself**.','Start with the free **local** labs (no cloud account, no cost) in Section 2.','Take the section quiz; wrong answers link back to the lecture.','After every change, run a command that **proves** it worked: `terraform plan`, `terraform show`, `terraform output`.']},
{note:'Always destroy lab resources when you finish (`terraform destroy`). Cloud labs can cost money if you forget.'}],
src:[['Terraform documentation',D],['Associate (004) exam content list','https://developer.hashicorp.com/terraform/tutorials/certification-004/associate-study-004']]};

/* ---------- 1: What is IaC ---------- */
L['tf:0:1']={blocks:[
{p:'**Infrastructure as Code (IaC)** means you describe servers, networks, databases and permissions in **text files**, keep them in version control, and let a tool build them. The files become the single source of truth, so anyone can recreate or review the environment.'},
{svg:manual},
{h:'Declarative vs imperative'},
{t:[['','Imperative','Declarative'],
['**You write**','The steps: do this, then that','The end result you want'],
['**Tool decides**','Nothing; it runs your steps','The steps and their order'],
['**Run it twice**','May fail or duplicate things','Nothing changes the second time (idempotent)'],
['**Example tools**','Shell scripts, AWS CLI calls','Terraform, CloudFormation, Kubernetes manifests'],
['**Question it answers**','How do I build it?','What should exist?']]},
{h:'The same task two ways'},
{p:'Goal: one S3 bucket. The imperative script must handle the "already exists" case itself. The declarative file only says what it wants.'},
{code:`# Imperative (shell): you handle every case
if ! aws s3api head-bucket --bucket demo-bucket-123 2>/dev/null; then
  aws s3api create-bucket --bucket demo-bucket-123 --region us-east-1
fi
aws s3api put-bucket-tagging --bucket demo-bucket-123 \\
  --tagging 'TagSet=[{Key=env,Value=dev}]'`},
{code:`# Declarative (Terraform HCL): describe the result
resource "aws_s3_bucket" "demo" {
  bucket = "demo-bucket-123"
  tags = {
    env = "dev"
  }
}`},
{h:'Key idea: desired state vs real state'},
{p:'A declarative tool compares **what you want** with **what exists** and works out the difference. Change one tag in the file and only that tag changes. Delete the block and the bucket is removed.'},
{flow:['You edit the file (desired state)','The tool reads the real infrastructure (current state)','It computes the difference','It shows the plan','You approve and it applies only the difference']},
{h:'Where IaC tools fit'},
{t:[['Kind','Job','Examples'],
['**Provisioning**','Create the infrastructure itself','Terraform, CloudFormation, Bicep, Pulumi'],
['**Configuration management**','Configure software inside servers','Ansible, Chef, Puppet'],
['**Image building**','Bake machine images','Packer'],
['**Orchestration**','Run and scale containers','Kubernetes']]},
{note:'Exam tip: Terraform is a declarative **provisioning** tool. It can run small scripts (provisioners), but that is a last resort, not its job.'}],
src:[['What is Infrastructure as Code',I+'what-is-terraform'],['Terraform use cases',I+'use-cases']]};

/* ---------- 2: Benefits and comparison ---------- */
L['tf:0:2']={blocks:[
{p:'Why do teams move from clicking in a console to IaC, and why choose Terraform over the alternatives? This lecture lists the benefits and then compares the tools.'},
{h:'Benefits of IaC'},
{t:[['Benefit','What it means in practice'],
['**Repeatable**','Build dev, test and prod from the same files. No "works on my account".'],
['**Version controlled**','Every change is in Git: who, when, why, and easy rollback.'],
['**Reviewable**','Teammates read a pull request and a plan before anything changes.'],
['**Faster**','Create a full environment in minutes, destroy it just as fast.'],
['**Less drift**','Real infrastructure is pulled back to what the code says.'],
['**Documented**','The code is the documentation of what exists.'],
['**Cheaper**','Easy to tear down test environments so you stop paying for them.']]},
{p:'**Drift** means the real infrastructure no longer matches the code, usually because someone changed it by hand. Section 8 shows how Terraform detects it.'},
{h:'Terraform vs the others'},
{t:[['Tool','Style','Clouds','State','Language'],
['**Terraform**','Declarative','Any (via providers)','State file you store (local, remote or HCP)','HCL'],
['**CloudFormation**','Declarative','AWS only','Managed by AWS','JSON or YAML'],
['**Ansible**','Mostly procedural, configuration management','Any','No state file; checks each run','YAML playbooks'],
['**Pulumi**','Declarative result, written as code','Any','State backend (like Terraform)','Python, TypeScript, Go, C#']]},
{h:'When to choose which'},
{ul:['**Terraform:** many platforms, a large module ecosystem, one workflow for everything.','**CloudFormation:** AWS-only shop that wants AWS to hold the state and support new services on day one.','**Ansible:** configure what runs *inside* servers (packages, files, services). Often used after Terraform creates them.','**Pulumi:** your team prefers a general-purpose language with loops, classes and unit tests.']},
{h:'Terraform and Ansible together'},
{flow:['Terraform creates the network and the servers','It outputs the server addresses','Ansible connects and installs and configures the software']},
{note:'These tools overlap but are not rivals in every case. A common pattern is Terraform to provision, Ansible to configure.'}],
src:[['Why Terraform',I],['Terraform vs alternatives',I+'vs']]};

/* ---------- 3: How Terraform works ---------- */
L['tf:0:3']={blocks:[
{p:'Terraform has a small number of moving parts. Once you know them, every command makes sense.'},
{svg:how},
{h:'The parts'},
{t:[['Part','What it is','Job'],
['**Configuration**','Your `.tf` files in HCL','Says what you want.'],
['**Terraform Core**','The `terraform` binary','Reads config and state, builds a dependency graph, calculates the plan, walks the graph.'],
['**Providers**','Plugins (separate programs)','Translate resource changes into API calls for one platform.'],
['**State**','A file (JSON) mapping config to real objects','Remembers what exists so the next plan knows what to change.'],
['**Registry**','registry.terraform.io','Where providers and modules are downloaded from.']]},
{h:'The plan/apply model'},
{p:'Terraform never changes anything silently. It first shows a **plan** (a list of what it would do) and only changes things when you **apply**.'},
{flow:['Read the configuration and the state','Refresh: ask the provider what really exists','Compare and build the plan: create, update, replace, destroy','Show the plan and wait for approval','Apply: call the APIs in dependency order','Write the result to state']},
{h:'What a plan looks like'},
{code:`$ terraform plan

  # aws_s3_bucket.demo will be created
  + resource "aws_s3_bucket" "demo" {
      + bucket = "demo-bucket-123"
      + id     = (known after apply)
    }

Plan: 1 to add, 0 to change, 0 to destroy.`},
{t:[['Symbol','Meaning'],
['`+`','Will be created'],
['`~`','Will be updated in place'],
['`-`','Will be destroyed'],
['`-/+`','Will be replaced (destroyed and created again)'],
['`(known after apply)`','Value is only available once the object exists']]},
{h:'Why dependency order matters'},
{p:'If a subnet uses a network id, Terraform sees the reference and creates the network first. It builds a **graph** of these references and runs unrelated parts in parallel.'},
{note:'Providers are versioned separately from Terraform itself. The Core version and each provider version are chosen and locked independently (Sections 3 and 4).'}],
src:[['How Terraform works',I+'core-workflow'],['Providers',K.L+'providers/'],['State',K.L+'state/']]};

/* ---------- 4: Multi-cloud ---------- */
L['tf:0:4']={blocks:[
{p:'Terraform is **service-agnostic**: one language and one workflow work for any platform that has a provider. A provider is just an adapter for an API, so the platform does not have to be a cloud.'},
{h:'One workflow, many targets'},
{t:[['Target','Example providers'],
['Public clouds','`aws`, `azurerm`, `google`, `oci`'],
['Containers and clusters','`kubernetes`, `helm`, `docker`'],
['DNS and CDN','`cloudflare`, `dns`'],
['SaaS and developer tools','`github`, `datadog`, `pagerduty`'],
['On-premises','`vsphere`, `nutanix`'],
['Helpers (no remote API)','`random`, `local`, `tls`']]},
{h:'Example: two platforms in one configuration'},
{p:'Create a cloud server, then point a DNS record at it. Terraform knows the DNS record depends on the server address.'},
{code:`provider "aws" {
  region = "us-east-1"
}
provider "cloudflare" {
  # token is read from the environment
}

resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
}

resource "cloudflare_dns_record" "www" {
  zone_id = var.zone_id
  name    = "www"
  type    = "A"
  content = aws_instance.web.public_ip
  ttl     = 300
}`},
{h:'Multi-cloud: when it helps and when it hurts'},
{t:[['Helps','Only adds complexity'],
['Regulation or customers require a second provider','"Just in case" with no real plan to move'],
['Best service for each job lives on different clouds','Trying to make every cloud look identical'],
['Acquired company already uses another cloud','Teams must learn two platforms without a need'],
['One tool for cloud, DNS, monitoring and Git','Maintaining duplicate code for every cloud']]},
{note:'Important: Terraform gives you one **workflow**, not one **configuration** for all clouds. An `aws_instance` is not the same resource as an `azurerm_linux_virtual_machine`. You still write cloud-specific code.'}],
src:[['Providers',K.L+'providers/'],['Terraform Registry','https://registry.terraform.io/browse/providers']]};

/* ---------- 5: The Terraform family ---------- */
L['tf:0:5']={blocks:[
{p:'"Terraform" can mean four different things. Keep them apart.'},
{svg:family},
{t:[['Name','What it is','Who runs it','Notes'],
['**Terraform CLI**','The `terraform` command, one binary','You (laptop or CI runner)','The core of everything. State is stored where you configure.'],
['**HCP Terraform**','Hosted service by HashiCorp','HashiCorp','Remote runs, state, teams, policies, private registry.'],
['**Terraform Enterprise**','The same platform, self-hosted','Your organisation','For strict data-residency or network rules.'],
['**OpenTofu**','Open-source fork of Terraform 1.5','Linux Foundation community','Same HCL, mostly compatible. Not on the exam.']]},
{h:'What the CLI does vs what HCP Terraform adds'},
{t:[['Capability','CLI alone','With HCP Terraform'],
['Run plan and apply','On your machine','On remote workers'],
['Store state','Local file or a backend you set up','Managed, versioned, locked'],
['Team access control','You build it','Teams and permissions built in'],
['Policy checks (Sentinel, OPA)','Not built in','Built in'],
['Private module registry','No','Yes'],
['Cost','Free to use','Free tier, then paid plans']]},
{h:'Which lectures apply to what'},
{ul:['**CLI** lectures work with any Terraform binary, including inside HCP Terraform runs.','**HCP** lectures (Section 13) need an HCP Terraform or Enterprise account.','**OpenTofu** commands are the same with the name `tofu`. Differences are covered in additional content.']},
{note:'Exam focus: know what the **CLI** does (init, plan, apply) and what **HCP Terraform** adds (remote runs and state, collaboration, governance).'}],
src:[['HCP Terraform',D+'cloud-docs'],['Terraform Enterprise',D+'enterprise'],['OpenTofu','https://opentofu.org/']]};

/* ---------- 6: Releases ---------- */
L['tf:0:6']={blocks:[
{p:'Terraform and its providers release on different schedules. Knowing how versions work helps you read a changelog, avoid surprise upgrades and understand what the exam covers.'},
{h:'How Terraform is versioned'},
{p:'Terraform uses **semantic versioning**: `MAJOR.MINOR.PATCH`, for example `1.12.2`.'},
{t:[['Part','Changes when','Example'],
['**Major** (1)','Breaking changes (rare; the 1.x series promises compatibility)','1.x to 2.0'],
['**Minor** (12)','New features, new behaviour. Released several times a year.','1.11 to 1.12'],
['**Patch** (2)','Bug and security fixes only','1.12.1 to 1.12.2']]},
{h:'Versions in this course'},
{t:[['What','Version'],
['Associate (004) exam tests','Terraform **1.12**'],
['Newest releases covered in the course','**1.15 and 1.16** (marked in the lessons)']]},
{p:'Newer features arrive in the course as additional content so you can pass the exam and still work with current Terraform. Where a feature needs a minimum version, the lesson says so.'},
{h:'Terraform and providers version separately'},
{svg:K.dg(700,150,[
[10,10,330,130,'Terraform CLI (Core)',1],[360,10,330,130,'Providers (each has its own version)',1],
[30,50,290,70,'required_version = ">= 1.9"|checked by Core when you run a command',0],[380,50,290,70,'aws ~> 5.0, azurerm ~> 4.0, random ~> 3.6|checked and locked at terraform init',2]],[])},
{h:'Pin both in code'},
{code:`terraform {
  required_version = ">= 1.9.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}`},
{h:'Reading a changelog'},
{flow:['Open the CHANGELOG for the release on GitHub','Read UPGRADE NOTES and BREAKING CHANGES first','Scan NEW FEATURES for things you might use','Check BUG FIXES for problems you hit','Test the upgrade with terraform plan before applying']},
{h:'Good practice'},
{ul:['Pin a version range, never leave it open.','Upgrade one minor step at a time and read the notes.','Keep the same Terraform version for everyone (Section 2 shows version managers).','State written by a newer version may not be readable by an older one, so upgrade the whole team together.']},
{note:'Support: HashiCorp supports the latest release lines; check the current support policy page before planning long-lived pins.'}],
src:[['Terraform releases','https://github.com/hashicorp/terraform/releases'],['Version constraints',K.L+'expressions/version-constraints'],['Terraform v1 compatibility promises',D+'language/v1-compatibility-promises']]};
})();
