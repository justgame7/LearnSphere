/* LearnSphere - DevOps & CI/CD, Section 13: Infrastructure & Configuration Automation in Pipelines.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const iacFlow=K.dg(700,220,[
[10,10,680,200,'Infrastructure change flow',1],
[25,70,100,60,'Pull request|changes .tf',0],[150,70,110,60,'fmt, validate,|lint, scan',0],[285,70,110,60,'plan posted|on the PR',2],[420,70,100,60,'Review and|approve',0],[545,70,125,60,'Merge: apply|from main',0]],
[[125,100,150,100],[260,100,285,100],[395,100,420,100],[520,100,545,100]]);

const immut=K.dg(700,220,[
[10,10,680,200,'Mutable vs immutable',1],
[30,60,300,60,'Mutable: log in, patch, drift',0],[30,130,300,60,'Immutable: build image, replace servers',2],
[380,50,290,60,'Servers become unique over time',0],[380,130,290,60,'Every server is identical and disposable',0]],
[[330,90,380,80],[330,160,380,160]]);

/* ---------- 0 ---------- */
L['devops:12:0']={blocks:[
{p:'**Infrastructure as code (IaC)** describes servers, networks and services in files. The delivery pipeline should treat those files **exactly like application code**: review, test, version and promote.'},
{svg:iacFlow},
{t:[['Application code','Infrastructure code'],
['Unit tests and lint','Format, validate, lint, policy checks'],
['Build an artifact','Produce a plan (the proposed change)'],
['Deploy to environments','Apply to dev, then staging, then production'],
['Rollback by redeploying','Revert and apply, or targeted fix (harder, state matters)']]},
{h:'Principles'},
{ul:['**One source of truth**: all changes arrive through version control and a pipeline, never by hand in a console.','**Review the plan**, not only the code. The plan shows the real effect.','**Separate state per environment** and per blast radius so one mistake cannot touch everything.','**Promote by configuration**: the same modules, different variables per environment.','**Protect** the pipeline identity with least privilege (Section 15).']},
{note:'Infrastructure changes are riskier than most application changes: they can delete data. Require a plan review and a clear path to recover.'}],
src:[['Terraform documentation',K.TF]]};

/* ---------- 1 ---------- */
L['devops:12:1']={blocks:[
{p:'The standard pattern for Terraform in a pipeline: **validate and plan on every pull request**, then **apply from the main branch** after approval. This builds on the Terraform course.'},
{flow:['terraform fmt -check','terraform init (with the remote backend)','terraform validate','Lint and security scan (tflint, checkov)','terraform plan, saved and posted to the pull request','Reviewer reads the plan and approves','Merge to main','terraform apply using the same plan']},
{code:`name: terraform
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
  pull-requests: write
  id-token: write
jobs:
  plan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform fmt -check -recursive
      - run: terraform init -input=false
      - run: terraform validate
      - run: terraform plan -input=false -out=tfplan
  apply:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production        # approval gate
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init -input=false
      - run: terraform apply -input=false -auto-approve`},
{h:'Good practice'},
{ul:['Always use **-input=false** and a non-interactive flow in CI.','Apply a **saved plan** when you can, so what was reviewed is what runs.','Gate production apply with an environment approval.','Show the plan in the pull request so reviewers do not have to open the run log.']},
{note:'Tools such as Atlantis, Terragrunt wrappers or HCP Terraform provide this workflow ready made, including locking and plan comments.'}],
src:[['Terraform in automation','https://developer.hashicorp.com/terraform/tutorials/automate-terraform']]};

/* ---------- 2 ---------- */
L['devops:12:2']={blocks:[
{p:'State maps your code to real resources and often contains secrets. In a pipeline it must be **shared, locked and protected**.'},
{t:[['Need','Solution'],
['Shared between pipeline runs and people','Remote backend (object storage, HCP Terraform)'],
['Two applies at once corrupt state','State **locking** (supported by the backend)'],
['State contains secrets','Encrypt at rest, restrict who can read it'],
['A mistake damages everything','**Separate state** per environment and per component'],
['Recovery from deletion or corruption','Versioning on the state bucket']]},
{code:`terraform {
  backend "s3" {
    bucket         = "acme-tfstate-prod"
    key            = "network/terraform.tfstate"
    region         = "eu-west-1"
    use_lockfile   = true
    encrypt        = true
  }
}`},
{h:'Pipeline identity'},
{ul:['Use **OIDC** federation to short-lived cloud credentials, not stored keys.','Give the **plan** job read-only permissions and the **apply** job write permissions, as separate roles.','Scope each role to the account and resources of one environment.','Only the main branch and the protected environment may assume the apply role.']},
{note:'A plan job running on a pull request from a fork must not receive credentials. Plan with a read role on trusted branches only.'}],
src:[['Terraform backends','https://developer.hashicorp.com/terraform/language/backend']]};

/* ---------- 3 ---------- */
L['devops:12:3']={blocks:[
{p:'**Policy as code** turns rules into automated checks that run on every plan or manifest. Instead of a person remembering "no public storage", the pipeline refuses the change.'},
{t:[['Tool','Language','Typical use'],
['**OPA** (Open Policy Agent)','Rego','General-purpose policy for plans, Kubernetes, APIs'],
['**Conftest**','Rego (on OPA)','Test structured config files (Terraform plan JSON, Kubernetes YAML, Dockerfiles) in CI'],
['**Sentinel**','Sentinel','Policy in HCP Terraform and Terraform Enterprise'],
['**Kyverno**, **Gatekeeper**','YAML or Rego','Enforce policy inside Kubernetes at admission']]},
{code:`# policy/s3.rego  (Conftest)
package main

deny contains msg if {
  some r in input.resource_changes
  r.type == "aws_s3_bucket_public_access_block"
  r.change.after.block_public_acls == false
  msg := sprintf("%s must block public ACLs", [r.address])
}`},
{code:`terraform plan -out=tfplan
terraform show -json tfplan > plan.json
conftest test plan.json --policy policy/`},
{h:'Adopt gradually'},
{ul:['Start in **advisory** mode (warn), fix the noise, then **enforce**.','Give clear, actionable messages that say how to fix.','Version policies and test them like code.','Plan for exceptions with an expiry and an owner.']}],
src:[['Open Policy Agent','https://www.openpolicyagent.org/docs/latest/'],['Conftest','https://www.conftest.dev/']]};

/* ---------- 4 ---------- */
L['devops:12:4']={blocks:[
{p:'Terraform creates infrastructure. **Ansible** configures what runs on it. A pipeline can run playbooks the same way it runs any other deployment. This builds on the Ansible course.'},
{flow:['Pipeline checks out the playbooks','Lint with ansible-lint','Run in check mode against staging','Apply to staging with the real run','Verify with a smoke test','Apply to production after approval']},
{code:`jobs:
  configure:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - run: pipx install ansible-core ansible-lint
      - run: ansible-lint
      - name: Write SSH key
        run: |
          install -m 600 /dev/null key
          printf '%s\\n' "$SSH_KEY" > key
        env:
          SSH_KEY: \${{ secrets.DEPLOY_SSH_KEY }}
      - run: ansible-playbook -i inventories/staging site.yml --private-key key --check --diff
      - run: ansible-playbook -i inventories/staging site.yml --private-key key`},
{h:'Practices'},
{ul:['Keep playbooks **idempotent**, so a second run changes nothing.','Use **ansible-vault** or an external secret store for secrets, never plain variables.','Prefer short-lived SSH certificates or cloud session access to long-lived keys.','Pin collection and role versions in `requirements.yml`.','For fleets, use a controller (AWX, Automation Platform) that holds credentials instead of the CI runner.']}],
src:[['Ansible documentation','https://docs.ansible.com/ansible/latest/']]};

/* ---------- 5 ---------- */
L['devops:12:5']={blocks:[
{p:'**Immutable infrastructure** means servers are never changed after they are created. To change something, you build a **new image** and **replace** the servers.'},
{svg:immut},
{t:[['','Mutable','Immutable'],
['Change method','Patch and configure in place','Build a new image, replace instances'],
['Drift','Accumulates','Cannot happen on running servers'],
['Rollback','Reverse the changes by hand','Redeploy the previous image'],
['Reproducibility','Low','High'],
['Debugging','Log in and fix','Fix the image and redeploy']]},
{h:'Image baking'},
{flow:['Pipeline builds a base image with Packer or an image builder','Configuration is applied with a script or Ansible during the build','The image is tested and scanned','The image is published with a version and signature','Infrastructure code rolls instances to the new image']},
{h:'Practical effects'},
{ul:['Containers are immutable by design. The same idea applies to VM images.','Servers are **cattle, not pets**: no one logs in to fix one by hand.','Patching becomes a pipeline: rebuild with updated packages and roll out.','State must live **outside** the instance (databases, object storage).']}],
src:[['Packer','https://developer.hashicorp.com/packer/docs']]};

/* ---------- 6 ---------- */
L['devops:12:6']={blocks:[
{p:'**Drift** is when real infrastructure no longer matches what the code says, usually because someone changed it by hand or another system modified it.'},
{flow:['Run a scheduled plan with no code changes','A non-empty plan means drift','Alert the owner with the diff','Decide: revert reality to code, or update code to adopt the change','Apply or commit, and record why']},
{code:`# A scheduled drift check
on:
  schedule:
    - cron: '0 6 * * *'
jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init -input=false
      - run: terraform plan -input=false -detailed-exitcode
        # exit code 2 means changes are pending (drift)`},
{t:[['Exit code','Meaning'],
['0','No changes'],
['1','Error'],
['2','Changes present (drift or unapplied code)']]},
{h:'Decide, do not just overwrite'},
{ul:['**Revert** when the manual change was a mistake or not approved.','**Adopt** when the change is correct and was needed: update the code so it becomes the source of truth.','Reduce drift at the source: remove console write access and use break-glass procedures with logging.']},
{note:'Some drift is harmless (a tag added by a cost tool). Use ignore rules sparingly so real drift is not hidden.'}]};

/* ---------- 7 ---------- */
L['devops:12:7']={blocks:[
{p:'Build a pull-request-driven pipeline for a small piece of infrastructure: plan on pull request, review the plan, apply on merge.'},
{flow:['Create a repository with a small Terraform configuration','Configure a remote backend with locking','Add the plan workflow, triggered on pull requests','Add the apply workflow, gated by a protected environment','Open a pull request that adds a resource and read the plan','Merge and watch the apply']},
{h:'Checks to include'},
{t:[['Step','Tool'],
['Format','`terraform fmt -check`'],
['Validate','`terraform validate`'],
['Lint','`tflint`'],
['Security','`checkov` or `trivy config`'],
['Policy','`conftest test plan.json`'],
['Plan','`terraform plan -out`']]},
{h:'Check yourself'},
{ul:['Can the plan job change infrastructure? It should not.','What stops someone applying from a feature branch?','Is the credential used by the pipeline long-lived?','What would the plan show if a teammate edited the resource by hand?']}]};
})();
