/* LearnSphere - Terraform, Section 11: Secrets, Security & Policy.
   Lectures 0-7 are core, 8-14 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,LG=K.L,CLI=K.CLI;

/* ---------- diagrams ---------- */
const leak=K.dg(700,230,[
[10,10,680,210,'Where a secret can end up',1],
[30,80,150,60,'A secret value|(password, key, token)',2],
[260,35,170,40,'State file',0],[260,85,170,40,'Plan file',0],[260,135,170,40,'Logs and CI output',0],[260,185,170,35,'Git (tfvars, code)',0],
[500,80,170,60,'Anyone with access|to these places',0]],
[[180,100,260,55],[180,110,260,105],[180,120,260,155],[180,130,260,200],[430,55,500,95],[430,105,500,105],[430,155,500,125],[430,200,500,135]]);

const eph=K.dg(700,180,[
[10,10,680,160,'Ephemeral and write-only values never reach state or plan files',1],
[30,60,170,70,'ephemeral resource|(e.g. password,|vault secret)',2],[265,60,170,70,'Used during the run|write-only argument|(password_wo)',0],[500,60,170,70,'Saved to state?|NO|Saved to plan? NO',2]],
[[200,95,265,95],[435,95,500,95]]);

const dyn=K.dg(700,170,[
[10,10,680,150,'Short-lived credentials instead of stored keys',1],
[30,60,150,60,'CI job or|HCP run',0],[230,60,150,60,'Identity provider|(OIDC token)',2],[430,60,110,60,'Cloud role|assumed',0],[580,60,90,60,'Temporary|credentials',2]],
[[180,90,230,90],[380,90,430,90],[540,90,580,90]]);

/* ---------- 0: where secrets leak ---------- */
L['tf:10:0']={blocks:[
{p:'Infrastructure code touches passwords, API keys and certificates. Terraform makes it easy to **leak** them without noticing. First learn **where** secrets end up.'},
{svg:leak},
{t:[['Place','How it leaks','Defence'],
['**State file**','Every attribute is stored, including passwords and keys, in plain text','Encrypt, restrict access, keep secrets out (ephemeral values)'],
['**Plan files**','A saved plan contains values, including secrets','Treat plan files like secrets; delete after use'],
['**Logs and CI output**','`TF_LOG=DEBUG` prints API calls; pipelines print plans','Never log at TRACE or DEBUG in shared CI; mark values sensitive'],
['**Git**','`terraform.tfvars`, `.tf` files with literal passwords','Never commit; use secret stores and environment variables'],
['**Outputs**','An output prints on screen','`sensitive = true` hides on screen only'],
['**Shell history / CLI args**','`-var="password=..."` stays in history','Use environment variables or files with strict permissions']]},
{h:'Bad vs better'},
{code:`# BAD: a literal secret in code, ends up in Git and state
resource "aws_db_instance" "main" {
  password = "SuperSecret123!"
}

# BETTER: the value comes from outside the code
variable "db_password" {
  type      = string
  sensitive = true
}

# BEST: never stored in state at all (lecture 3)
password_wo = ephemeral.random_password.db.result`},
{h:'Rules of thumb'},
{flow:['Do not write secrets in .tf or .tfvars files that go to Git','Pass secrets at run time from a secret manager or the pipeline','Assume anyone who can read state can read every secret in it','Prefer values that are generated, short-lived and never stored']},
{note:'Exam tip: state files can contain secrets in plain text even when you use `sensitive`, so state must be protected like a password file.'}],
src:[['Sensitive data in state',LG+'state/sensitive-data'],['Manage sensitive data',K.T]]};

/* ---------- 1: sensitive ---------- */
L['tf:10:1']={blocks:[
{p:'The **`sensitive`** flag tells Terraform to **hide a value** in plan and apply output. It is useful, but it is **not encryption** and does not keep the value out of state.'},
{h:'Sensitive variables and outputs'},
{code:`variable "db_password" {
  type      = string
  sensitive = true
}

output "connection_string" {
  value     = "postgres://admin:\${var.db_password}@\${aws_db_instance.main.endpoint}/app"
  sensitive = true
}`},
{code:`  # aws_db_instance.main will be created
  + password = (sensitive value)

Outputs:
connection_string = <sensitive>`},
{h:'It spreads'},
{p:'Any value **built from** a sensitive value is also sensitive. Terraform tracks this automatically.'},
{t:[['Expression','Sensitive?'],
['`var.db_password`','Yes'],
['`"user:\${var.db_password}"`','Yes (derived)'],
['`length(var.db_password)`','Yes (derived)'],
['`nonsensitive(var.db_password)`','No: you decided to reveal it']]},
{p:'If an output uses a sensitive value but is not marked, Terraform stops with an error asking you to add `sensitive = true`. This protects you.'},
{h:'What sensitive does NOT do'},
{t:[['Myth','Reality'],
['The value is encrypted','No. It is plain text in **state**.'],
['It cannot be read','`terraform output db_password` prints it; `terraform show -json` shows it'],
['It is hidden in saved plans','The plan **file** contains the real value'],
['It is hidden in every log','Debug logs of API calls may show it']]},
{h:'Where it helps'},
{ul:['Stops accidental display in terminals and CI logs.','Forces you to be explicit when you reveal something (`nonsensitive`).','Marks intent for reviewers.']},
{ul:['A sensitive value **cannot** be used as a `for_each` key or in a resource address.']},
{note:'Use `sensitive` as a seatbelt for screens. To keep a value out of state altogether, use ephemeral values and write-only arguments (next lecture).'}],
src:[['Sensitive values',LG+'values/variables#suppressing-values-in-cli-output'],['sensitive function',LG+'functions/sensitive']]};

/* ---------- 2: Ephemeral and write-only ---------- */
L['tf:10:2']={blocks:[
{p:'Newer Terraform versions can use values **during a run** and then **forget them**, so they never reach the state file or plan file. Two features work together: **ephemeral values** and **write-only arguments**.'},
{svg:eph},
{h:'Ephemeral values'},
{p:'An **ephemeral** value exists only while Terraform runs. It is not written to state or plan files.'},
{t:[['Kind','How'],
['**Ephemeral resource**','`ephemeral "type" "name" { }` reads or generates a temporary value (a secret, a token)'],
['**Ephemeral variable**','`variable "x" { ephemeral = true }`'],
['**Ephemeral output**','`output "x" { ephemeral = true }` (child modules)']]},
{h:'Write-only arguments'},
{p:'A **write-only argument** (usually named `*_wo`) lets Terraform **send** a value to the provider but **not store it**. It is available only on resources whose provider supports it.'},
{code:`ephemeral "random_password" "db" {
  length = 24
}

resource "aws_db_instance" "main" {
  # ...
  username            = "admin"
  password_wo         = ephemeral.random_password.db.result
  password_wo_version = 1       # change this number to rotate the password
}`},
{t:[['Argument','Meaning'],
['`password_wo`','The value is sent to the API and **never saved**'],
['`password_wo_version`','Terraform cannot compare a value it did not store, so bump this to trigger an update']]},
{h:'The flow'},
{flow:['An ephemeral resource produces a secret during the run','A write-only argument passes it to the provider','The resource is created or updated','State and plan keep only the non-secret parts, not the password']},
{h:'Compared'},
{t:[['','`sensitive`','Ephemeral / write-only'],
['**Hidden on screen**','Yes','Yes'],
['**In state**','Yes','**No**'],
['**In plan file**','Yes','**No**'],
['**Can be reused later**','Yes','No: it is gone after the run']]},
{h:'Limits'},
{ul:['Ephemeral values can be used only in places that allow them: other ephemeral things, write-only arguments, provider configuration, provisioners.','You cannot reference them in normal arguments, which would store them.','Not every provider or resource supports write-only arguments yet; check the docs.','Version note: ephemeral values arrived in Terraform 1.10 and write-only arguments in 1.11.']},
{note:'Exam focus (004): know that ephemeral values and write-only arguments keep secrets **out of state and plan files**, while `sensitive` only hides them on screen.'}],
src:[['Ephemeral resources',LG+'resources/ephemeral'],['Write-only arguments',LG+'resources/ephemeral#write-only-arguments']]};

/* ---------- 3: Vault ---------- */
L['tf:10:3']={blocks:[
{p:'**HashiCorp Vault** is a secrets service: it stores secrets, hands out **short-lived dynamic credentials**, and logs who asked. Terraform can read from Vault so secrets never appear in your code.'},
{h:'Connect and read a secret'},
{code:`provider "vault" {
  address = "https://vault.example.com:8200"
  # token comes from VAULT_TOKEN in the environment
}

data "vault_kv_secret_v2" "db" {
  mount = "secret"
  name  = "app/db"
}

resource "aws_db_instance" "main" {
  # ...
  password = data.vault_kv_secret_v2.db.data["password"]
}`},
{p:'A normal `data` source stores what it reads **in state**. Where the Vault provider supports it, prefer an **ephemeral** version of the same lookup so the secret is not stored.'},
{code:`ephemeral "vault_kv_secret_v2" "db" {
  mount = "secret"
  name  = "app/db"
}
# use with a write-only argument: password_wo = ephemeral.vault_kv_secret_v2.db.data["password"]`},
{h:'Dynamic credentials'},
{t:[['Static secret','Dynamic secret'],
['Created once, stored, rotated by hand','Created on request for a short time (minutes or hours)'],
['If leaked, valid until someone notices','If leaked, expires soon and can be revoked'],
['Example: a stored database password','Example: Vault creates a temporary DB user or AWS key']]},
{flow:['Terraform asks Vault for credentials','Vault creates a short-lived account in the target system','Terraform uses it for the run','Vault revokes it when the lease ends']},
{h:'Also useful'},
{ul:['**Authentication:** use a role or OIDC instead of a long-lived Vault token.','**Write secrets:** the `vault_kv_secret_v2` resource stores data in Vault, but its values pass through state.','**HCP Terraform:** can fetch dynamic credentials from Vault for each run.']},
{note:'Whatever the source, the rule is the same: pass a **reference** to the secret, and fetch the value at the last moment.'}],
src:[['Vault provider','https://registry.terraform.io/providers/hashicorp/vault/latest/docs'],['Vault with Terraform',K.T]]};

/* ---------- 4: Cloud secret managers ---------- */
L['tf:10:4']={blocks:[
{p:'Every major cloud has a service for storing secrets. Terraform can **read a secret** or, better, **give an application a reference** so the value is never copied around.'},
{t:[['Cloud','Service','Terraform data source or resource'],
['AWS','Secrets Manager','`aws_secretsmanager_secret_version`'],
['AWS','Systems Manager Parameter Store','`aws_ssm_parameter`'],
['Azure','Key Vault','`azurerm_key_vault_secret`'],
['Google Cloud','Secret Manager','`google_secret_manager_secret_version`']]},
{h:'Reading a secret (value ends up in state)'},
{code:`data "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/app/db"
}

locals {
  creds = jsondecode(data.aws_secretsmanager_secret_version.db.secret_string)
}`},
{p:'This works, but `secret_string` is stored in state. Protect state accordingly.'},
{h:'Better: pass a reference, not the value'},
{code:`# The app container reads the secret itself at start-up.
resource "aws_ecs_task_definition" "app" {
  # ...
  container_definitions = jsonencode([{
    name  = "app"
    image = "my-app:1.0"
    secrets = [{
      name      = "DB_PASSWORD"
      valueFrom = aws_secretsmanager_secret.db.arn   # only the ARN is in state
    }]
  }])
}`},
{h:'Let the service manage the password'},
{code:`resource "aws_db_instance" "main" {
  # ...
  manage_master_user_password = true   # RDS creates and rotates it in Secrets Manager
}`},
{h:'Choosing an approach'},
{t:[['Approach','Secret in state?','Notes'],
['Read with a data source','Yes','Simple; protect state'],
['Pass the secret ARN or name to the app','No','Preferred when the app can fetch it'],
['Service-managed passwords','No (only a reference)','Best for databases'],
['Ephemeral lookup + write-only argument','No','Newest approach, where supported']]},
{note:'Permissions matter too: give Terraform read access only to the secrets it needs, and give each application access only to its own secret.'}],
src:[['AWS Secrets Manager data source','https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/secretsmanager_secret_version']]};

/* ---------- 5: least privilege ---------- */
L['tf:10:5']={blocks:[
{p:'Terraform runs with real cloud permissions. If those permissions are **too broad** or **never expire**, a leak is a disaster. Two ideas reduce the risk: **least privilege** and **short-lived credentials**.'},
{svg:dyn},
{h:'Least privilege'},
{ul:['Give Terraform only the actions it needs on the services it manages.','Use **separate identities** per environment and per project; a dev pipeline cannot touch production.','Review permissions regularly; remove what is unused.','Separate who can **plan** (read-mostly) from who can **apply** (write).']},
{h:'Short-lived credentials'},
{t:[['Approach','How it works','Lifetime'],
['**Long-lived access key**','A key stored in CI or on a laptop','Months or years: avoid'],
['**Assume a role**','Terraform calls STS and gets temporary keys','Minutes to hours'],
['**OIDC / workload identity**','The CI job proves its identity with a signed token; no stored key','Per run'],
['**SSO / device login**','You sign in and get a session','Hours']]},
{code:`provider "aws" {
  region = "us-east-1"

  assume_role {
    role_arn     = "arn:aws:iam::123456789012:role/terraform-deploy"
    session_name = "terraform"
  }
}`},
{h:'CI with OIDC (no stored key)'},
{flow:['The pipeline requests an OIDC token from its platform','The cloud trusts that identity provider and a specific repository','It issues temporary credentials for one role','Terraform runs; the credentials expire after the job']},
{h:'HCP Terraform'},
{p:'**Dynamic provider credentials** let each run authenticate to AWS, Azure, Google Cloud or Vault with OIDC, so no cloud keys are stored in workspace variables.'},
{note:'Avoid long-lived keys wherever you can. If one leaks, its damage lasts as long as it lives.'}],
src:[['AWS provider authentication','https://registry.terraform.io/providers/hashicorp/aws/latest/docs#authentication-and-configuration'],['Dynamic provider credentials',K.D+'cloud-docs/workspaces/dynamic-provider-credentials']]};

/* ---------- 6: Securing state ---------- */
L['tf:10:6']={blocks:[
{p:'Because state can hold every secret, **securing the state backend** is one of the most important security tasks.'},
{t:[['Control','What to do'],
['**Encrypt at rest**','Enable server-side encryption (S3 `encrypt = true` with KMS, Azure and Google do it by default)'],
['**Encrypt in transit**','Use HTTPS only; backends do this by default'],
['**Restrict access**','Only the pipeline role and a few admins can read or write state; use bucket policies and IAM'],
['**Block public access**','Enable "block public access" on the bucket'],
['**Versioning**','Keep old versions so you can recover from corruption or deletion'],
['**Audit**','Turn on access logging (CloudTrail, storage logs) to see who read state'],
['**Locking**','Prevent concurrent writes']]},
{h:'A hardened S3 backend'},
{code:`# the bucket (created once, outside the main configuration)
resource "aws_s3_bucket" "state" {
  bucket = "my-team-tfstate"
}
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "aws:kms" }
  }
}
resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}`},
{h:'Who needs access'},
{t:[['Who','Access'],
['Pipeline / apply role','Read and write state, take locks'],
['Developers','Often read-only, or none (use plan in CI)'],
['Auditors','Read logs, not state'],
['Everyone else','None']]},
{h:'HCP Terraform'},
{p:'State in HCP Terraform is encrypted, versioned and protected by workspace permissions. You can also limit which teams may read **state versions** or run apply.'},
{note:'Never put state in a place that is easier to read than your production database. The two have the same risk.'}],
src:[['S3 backend',LG+'backend/s3'],['Sensitive data in state',LG+'state/sensitive-data']]};

/* ---------- 7: Practical ---------- */
L['tf:10:7']={blocks:[
{p:'Find a plaintext secret in state, see why `sensitive` is not enough, then redesign so the secret never reaches state. Steps 1 to 3 run locally with no account; step 4 shows the redesign with AWS.'},
{h:'Step 1: create a secret and find it in state'},
{code:`terraform {
  required_providers {
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

resource "random_password" "db" {
  length = 20
}

output "password" {
  value     = random_password.db.result
  sensitive = true
}`},
{code:`terraform init
terraform apply
# Outputs: password = <sensitive>

grep -n "result" terraform.tfstate
terraform output -raw password          # prints the real password`},
{p:'The screen hid the value, but it sits in state and `terraform output` reveals it.'},
{h:'Step 2: look in other places'},
{code:`terraform show -json | grep -i result      # visible in JSON
terraform plan -out=tfplan
terraform show -json tfplan | grep -i result   # also in the saved plan`},
{h:'Step 3: harden what you cannot remove'},
{ul:['Add `*.tfstate*` and `tfplan` to `.gitignore`.','Move state to a remote backend with encryption and restricted access (Section 8).','Delete saved plans after use.']},
{h:'Step 4: redesign with ephemeral and write-only (AWS)'},
{code:`ephemeral "random_password" "db" {
  length = 20
}

resource "aws_secretsmanager_secret" "db" {
  name = "lab/db-password"
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id                = aws_secretsmanager_secret.db.id
  secret_string_wo         = ephemeral.random_password.db.result
  secret_string_wo_version = 1
}`},
{code:`terraform apply
grep -c "result" terraform.tfstate     # the password is not stored`},
{h:'Compare'},
{t:[['Design','Secret in state?','In plan file?'],
['Resource + `sensitive` output','Yes','Yes'],
['Ephemeral resource + write-only argument','**No**','**No**']]},
{h:'Clean up'},
{code:`terraform destroy`},
{note:'If your provider version does not yet offer a `*_wo` argument for your resource, fall back to a secret manager or a service-managed password and protect state. Check the provider documentation.'}],
src:[['Ephemeral resources',LG+'resources/ephemeral'],['Manage sensitive data',K.T]]};
})();
