/* LearnSphere - Terraform, Section 12: Testing, Debugging & Troubleshooting.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,LG=K.L,CLI=K.CLI;

/* ---------- diagrams ---------- */
const pyr=K.dg(700,240,[
[10,10,680,220,'Layers of checking: cheap and fast at the top, real and slow at the bottom',1],
[200,45,300,36,'fmt + validate + tflint (seconds, no cloud)',0],
[160,90,380,36,'Static security scans: Checkov, Trivy (seconds)',0],
[120,135,460,36,'terraform test with plan or mock providers (fast, no cost)',2],
[80,180,540,36,'terraform test with apply / full deployment (slow, real cost)',2]],
[]);

const wf=K.dg(700,170,[
[10,10,680,150,'Troubleshooting workflow',1],
[25,55,100,60,'1. Read the|error text',0],[140,55,100,60,'2. validate|and fmt',0],[255,55,100,60,'3. Narrow|the scope',2],[370,55,100,60,'4. Check state|and credentials',2],[485,55,90,60,'5. Turn on|TF_LOG',2],[590,55,80,60,'6. Search|and report',0]],
[[125,85,140,85],[240,85,255,85],[355,85,370,85],[470,85,485,85],[575,85,590,85]]);

/* ---------- 0: Testing strategy ---------- */
L['tf:11:0']={blocks:[
{p:'Infrastructure code can break things that cost money and take hours to fix. **Testing** finds mistakes early and cheaply. The key idea is **layers**: run the fast, cheap checks often and the slow, real ones less often.'},
{svg:pyr},
{t:[['Layer','Tool','Needs cloud?','Catches'],
['**Format and syntax**','`terraform fmt -check`, `validate`','No','Typos, wrong types, missing arguments'],
['**Lint**','`tflint`','No','Invalid instance types, deprecated syntax, bad habits'],
['**Security scan**','Checkov, Trivy','No','Open security groups, unencrypted storage'],
['**Plan-level tests**','`terraform test` (`command = plan`) or mocks','No or little','Logic, conditions, outputs'],
['**Integration tests**','`terraform test` with `apply`','Yes','Real behaviour, permissions, quotas'],
['**Policy checks**','Sentinel, OPA','No','Company rules (tags, regions, sizes)']]},
{h:'What each layer is good for'},
{flow:['Every save: editor validation and fmt','Every commit: validate, tflint, security scan','Every pull request: terraform test (plan or mock) and a plan review','Nightly or before release: integration tests with real resources']},
{h:'What to test in a module'},
{ul:['Does it create the expected resources with sensible inputs?','Does it reject bad input (validation, preconditions)?','Are outputs the right shape?','Does an upgrade of the provider change anything unexpected?']},
{note:'Aim for lots of fast tests and few slow ones. A test that needs 20 minutes and a cloud account will rarely be run.'}],
src:[['Testing Terraform',K.T],['terraform test',CLI+'commands/test']]};

/* ---------- 1: Static checks ---------- */
L['tf:11:1']={blocks:[
{p:'Static checks look at your code **without creating anything** and need **no cloud account**. They run in seconds, so run them all the time.'},
{h:'The basics'},
{code:`terraform fmt -check -recursive      # fail if any file is badly formatted
terraform init -backend=false        # providers only, no state needed
terraform validate                   # syntax, types, references`},
{h:'tflint: a linter with provider knowledge'},
{p:'`terraform validate` knows Terraform rules but not **provider rules**. `tflint` adds checks such as "this instance type does not exist" or "this argument is deprecated".'},
{code:`# .tflint.hcl
plugin "aws" {
  enabled = true
  version = "0.30.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

# run
tflint --init
tflint`},
{t:[['Check','Finds'],
['`terraform fmt -check`','Style differences'],
['`terraform validate`','Syntax, unknown arguments, wrong types, bad references'],
['`tflint`','Invalid values for the provider, deprecated usage, naming rules, unused declarations']]},
{h:'Put them in a pre-commit hook or CI'},
{code:`#!/bin/sh
set -e
terraform fmt -check -recursive
terraform init -backend=false -input=false
terraform validate
tflint`},
{h:'Typical findings'},
{t:[['Message','Fix'],
['`Unsupported argument`','Misspelled or removed argument'],
['`Reference to undeclared resource`','Wrong address or missing block'],
['`"t2.mcro" is an invalid value`','Typo caught by tflint'],
['`Missing required argument`','Add it']]},
{note:'Fast checks first. If `validate` fails, a plan will fail too, and it takes far longer to tell you.'}],
src:[['tflint','https://github.com/terraform-linters/tflint'],['terraform validate',CLI+'commands/validate']]};

/* ---------- 2: terraform test ---------- */
L['tf:11:2']={blocks:[
{p:'**`terraform test`** is the built-in test framework. You write tests in files ending in `.tftest.hcl`. Each test is a sequence of **run blocks** that plan or apply your configuration and check **assertions**.'},
{h:'A first test'},
{code:`# tests/naming.tftest.hcl
variables {
  env = "dev"
}

run "bucket_name_has_env" {
  command = plan

  assert {
    condition     = aws_s3_bucket.logs.bucket == "app-dev-logs"
    error_message = "Bucket name must be app-<env>-logs."
  }
}`},
{code:`terraform test
# tests/naming.tftest.hcl... pass
#   run "bucket_name_has_env"... pass
# Success! 1 passed, 0 failed.`},
{h:'Parts of a test file'},
{t:[['Part','Meaning'],
['`variables { }`','Input values for all runs in the file'],
['`run "name" { }`','One test step, run in order'],
['`command = plan` or `apply`','Plan only (fast, no resources) or create real resources (default `apply`)'],
['`assert { condition error_message }`','The check; a false condition fails the test'],
['`expect_failures = [ ... ]`','Pass the test only if the named check or validation fails'],
['`provider` / `mock_provider`','Configure or replace providers for the test']]},
{h:'plan vs apply'},
{t:[['','`command = plan`','`command = apply`'],
['**Creates real resources**','No','Yes (destroyed at the end of the test)'],
['**Speed and cost**','Fast, free','Slower, may cost'],
['**Can check**','Values known at plan time','Final values such as generated ids']]},
{h:'Test a validation rule'},
{code:`run "rejects_bad_env" {
  command = plan
  variables {
    env = "qa"
  }
  expect_failures = [var.env]
}`},
{h:'Where tests live'},
{ul:['In files named `*.tftest.hcl` in the module root or in a `tests/` folder.','Run all with `terraform test`, or one file with `-filter=tests/naming.tftest.hcl`.','State for `apply` tests is kept in memory and cleaned up automatically.']},
{note:'Think of a `run` block as "execute the configuration with these inputs, then inspect the result".'}],
src:[['Tests',LG+'tests'],['terraform test command',CLI+'commands/test']]};

/* ---------- 3: Mock providers and plan-only tests ---------- */
L['tf:11:3']={blocks:[
{p:'Real cloud tests are slow and cost money. With a **mock provider**, Terraform fakes the provider so you can test your **logic** with `command = apply` and no real resources, no credentials and no account.'},
{code:`# tests/mock.tftest.hcl
mock_provider "aws" {
  mock_resource "aws_s3_bucket" {
    defaults = {
      arn = "arn:aws:s3:::mock-bucket"
    }
  }
}

variables {
  env = "dev"
}

run "output_contains_arn" {
  command = apply            # applies against the MOCK, nothing real is created

  assert {
    condition     = output.bucket_arn == "arn:aws:s3:::mock-bucket"
    error_message = "bucket_arn output is wrong."
  }
}`},
{h:'Why mocks help'},
{t:[['Without mock','With mock'],
['Needs credentials','No credentials'],
['Creates real resources','Nothing created'],
['Slow and may cost','Runs in a second'],
['Generated values unknown at plan','You choose the values with `defaults`']]},
{h:'Override single values'},
{code:`run "uses_fixed_id" {
  command = plan

  override_resource {
    target = aws_s3_bucket.logs
    values = {
      id = "fixed-id"
    }
  }
  # ... assert on things that depend on id
}`},
{h:'Plan-only tests'},
{p:'`command = plan` never creates anything, even with a real provider. It still needs working provider credentials, unless you also use a mock provider.'},
{h:'Choose'},
{flow:['Logic, conditions, outputs and naming: mock provider','Just the plan result with real provider checks: command = plan','Real behaviour such as permissions and quotas: apply with a real provider (integration test)']},
{note:'A mock cannot find problems the real API would raise, such as a name already in use. Keep a few real integration tests too.'}],
src:[['Mock providers',LG+'tests/mocking']]};

/* ---------- 4: TF_LOG ---------- */
L['tf:11:4']={blocks:[
{p:'When an error message is not enough, turn on **verbose logging** to see what Terraform and the provider are doing, including the API calls.'},
{t:[['Variable','Meaning'],
['`TF_LOG`','Log level: `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, or `JSON`'],
['`TF_LOG_CORE`','Log level for Terraform core only'],
['`TF_LOG_PROVIDER`','Log level for providers only'],
['`TF_LOG_PATH`','Write the log to this file']]},
{p:'`TRACE` is the most detailed; `ERROR` the least.'},
{code:`export TF_LOG=DEBUG
export TF_LOG_PATH=terraform.log
terraform plan
# read terraform.log

# turn it off again
unset TF_LOG TF_LOG_PATH`},
{h:'Read a log'},
{code:`2026-10-09T10:01:02Z [DEBUG] provider.terraform-provider-aws: ... Request:
GET /?Action=DescribeInstances ...
2026-10-09T10:01:02Z [DEBUG] ... Response: 403 Forbidden
  UnauthorizedOperation: You are not authorized to perform ec2:DescribeInstances`},
{ul:['Search for `ERROR`, `403`, `401`, `429` (rate limit), `timeout`.','The provider lines show the actual API request and response.','Logs can contain **secrets**. Do not paste them publicly and delete them afterwards.']},
{h:'Crash logs'},
{p:'If Terraform or a provider **crashes** (a panic), it writes `crash.log` in the working directory. Do not commit it. It contains a stack trace you can attach to a bug report, after removing secrets.'},
{h:'Best practice'},
{flow:['Reproduce the problem with one small command','Set TF_LOG and TF_LOG_PATH','Run the command once','Unset the variables','Read the log from the bottom upwards']},
{note:'Logging slows Terraform down and fills disks. Use it to debug, then switch it off.'}],
src:[['Debugging Terraform',CLI+'log'],['Environment variables',CLI+'config/environment-variables']]};

/* ---------- 5: Troubleshooting workflow ---------- */
L['tf:11:5']={blocks:[
{p:'Most Terraform problems are solved faster with a **repeatable method** than with guessing. Use the same steps each time.'},
{svg:wf},
{t:[['Step','Do','Why'],
['**1. Read the error**','Read the whole message, including file and line','It usually names the cause and often a hint ("Did you mean ...")'],
['**2. Validate**','`terraform fmt`, `terraform validate`','Rules out syntax and reference mistakes'],
['**3. Narrow the scope**','Comment out resources, test one module, use `plan -target` carefully, or reproduce in a tiny folder','Finds the single failing piece'],
['**4. Check state and credentials**','`terraform state list`, `terraform plan -refresh-only`, `aws sts get-caller-identity`','Many failures are an expired login or a wrong account'],
['**5. Turn on logging**','`TF_LOG=DEBUG TF_LOG_PATH=...`','Shows the real API conversation'],
['**6. Search and report**','Provider issue tracker, docs, community forum','Someone may have fixed it already']]},
{h:'Quick questions to ask'},
{ul:['Did the code change, or did the **environment** change (credentials, region, quota)?','Does `terraform init` need to run again?','Is it only on my machine, or in CI too?','Is the provider or Terraform version different from last time?','Does the object exist in the cloud but not in state (or the reverse)?']},
{h:'Decide where the problem is'},
{t:[['Symptom','Likely area'],
['Error before any plan','Syntax, init, backend, versions'],
['Error during plan','Credentials, data sources, references, state'],
['Error during apply','Provider API, permissions, quotas, ordering'],
['Plan shows changes you did not make','Drift, provider upgrade, defaults']]},
{note:'Change one thing at a time and re-run. If you change five things and it works, you will not know which fixed it.'}],
src:[['Troubleshooting',K.T],['Debugging',CLI+'log']]};

/* ---------- 6: Common errors ---------- */
L['tf:11:6']={blocks:[
{p:'A short field guide to the messages you will see most often, what causes them and how to fix them. Keep it as a **runbook**.'},
{t:[['Error (shortened)','Cause','Fix'],
['`No valid credential sources found` / `ExpiredToken`','No or expired cloud credentials','Log in again, check profile or role, run `aws sts get-caller-identity`'],
['`AccessDenied` / `UnauthorizedOperation` / `403`','Identity lacks permission','Add the required action to the policy; check the account and region'],
['`Error acquiring the state lock`','Another run is active or a lock was left behind','Wait, or `terraform force-unlock ID` once sure nothing runs'],
['`Backend initialization required`','Backend changed or not initialised','`terraform init` (or `-reconfigure`)'],
['`Failed to query available provider packages`','Network, proxy or wrong provider source','Check connectivity and `required_providers` source'],
['`Inconsistent dependency lock file`','Lock file does not match requirements','`terraform init -upgrade` and commit the lock file'],
['`Error: Cycle: a, b`','Two resources depend on each other','Remove one reference or split the logic'],
['`Provider produced inconsistent result after apply`','Provider bug or API quirk','Re-run apply; upgrade the provider; report the bug'],
['`Invalid for_each argument ... known only after apply`','Keys depend on values created in the same run','Build keys from inputs or apply in two steps'],
['`LimitExceeded` / `QuotaExceeded`','Cloud quota reached','Request a quota increase or delete unused resources'],
['`AlreadyExists` / `BucketAlreadyOwnedByYou`','Object exists outside state','Import it or choose another name'],
['`Unsupported argument` / `Unsupported block type`','Typo or provider version too old','Fix the name; upgrade the provider'],
['`Error: Invalid reference`','Reference to something that does not exist','Fix the address; check for removed resources']]},
{h:'Fast triage'},
{flow:['Copy the first line of the error into your notes','Match it to the table','If it mentions permissions, check identity and region','If it mentions state, check lock, backend and init','If it is new, enable logging and search the provider issues']}],
src:[['Troubleshooting',K.T],['AWS provider issues','https://github.com/hashicorp/terraform-provider-aws/issues']]};

/* ---------- 7: Practical break/fix ---------- */
L['tf:11:7']={blocks:[
{p:'Faults are injected into a **working** configuration. Your job: read the error, decide which step of the workflow finds it, and fix it. All faults can be reproduced locally with no cloud account.'},
{h:'The working base'},
{code:`terraform {
  required_providers {
    random = { source = "hashicorp/random", version = "~> 3.6" }
    local  = { source = "hashicorp/local",  version = "~> 2.5" }
  }
}

variable "env" {
  type = string
}

resource "random_pet" "name" {
  length = 2
}

resource "local_file" "out" {
  filename = "\${var.env}.txt"
  content  = random_pet.name.id
}`},
{code:`terraform init && terraform apply -var="env=dev" -auto-approve`},
{h:'Fault 1: a typo'},
{p:'Change `content` to `contnet`.'},
{code:`terraform validate
# Error: Unsupported argument ... Did you mean "content"?`},
{p:'Found by **validate**. Fix the spelling.'},
{h:'Fault 2: a wrong reference'},
{p:'Change the content to `random_pet.nam.id`.'},
{code:`terraform validate
# Error: Reference to undeclared resource`},
{h:'Fault 3: a missing provider install'},
{p:'Add a new provider (for example `time`) to `required_providers` and run `plan` without `init`.'},
{code:`terraform plan
# Error: Inconsistent dependency lock file / Required plugins are not installed`},
{p:'Fix: `terraform init`.'},
{h:'Fault 4: a lock'},
{p:'Open two terminals. In the first, run `terraform apply` and do not answer. In the second run `terraform plan`.'},
{code:`# Error: Error acquiring the state lock`},
{p:'Fix: answer `no` in the first terminal, or wait.'},
{h:'Fault 5: a dependency cycle'},
{p:'Make the pet depend on the file: add `keepers = { f = local_file.out.filename }` to `random_pet.name`.'},
{code:`terraform validate
# Error: Cycle: local_file.out, random_pet.name`},
{h:'Fault 6: a drift'},
{code:`echo "hacked" > dev.txt
terraform plan
# ~ local_file.out will be updated / replaced`},
{p:'Decide: revert with `apply`, or accept with `apply -refresh-only` and update the code.'},
{h:'Fault 7: use logging'},
{code:`TF_LOG=DEBUG TF_LOG_PATH=debug.log terraform plan
grep -i "error" debug.log | head`},
{t:[['Fault','Found by'],
['Typo, wrong reference, cycle','`validate`'],
['Missing provider, bad lock file','`init`'],
['Lock','Plan or apply start'],
['Drift','`plan` / `plan -refresh-only`']]},
{note:'Keep a note of each error and its fix. Over time it becomes your own runbook.'}],
src:[['Troubleshooting',K.T]]};
})();
