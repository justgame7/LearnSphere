/* LearnSphere - Terraform, Section 15: Automation, CI/CD & Production Readiness.
   Lectures 0-7 are core, 8-15 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,LG=K.L,CLI=K.CLI;

/* ---------- diagrams ---------- */
const git=K.dg(700,200,[
[10,10,680,180,'Git workflow for infrastructure',1],
[25,65,120,60,'Feature branch|edit code',0],[165,65,120,60,'Pull request|plan posted',2],[305,65,120,60,'Review and|approve',0],[445,65,100,60,'Merge to|main',2],[565,65,105,60,'Apply|(pipeline)',2]],
[[145,95,165,95],[285,95,305,95],[425,95,445,95],[545,95,565,95]]);

const pipe=K.dg(700,230,[
[10,10,680,210,'CI/CD pipeline',1],
[25,50,300,70,'On every pull request|fmt -check, validate, tflint, scan, plan (comment)',2],
[375,50,295,70,'On merge to main|apply the reviewed plan (approval for prod)',2],
[25,145,645,60,'Credentials: OIDC short-lived roles   |   State: remote with locking   |   Plan file: stored as an artifact',0]],
[[325,85,375,85]]);

const envs=K.dg(700,200,[
[10,10,680,180,'Three ways to separate environments',1],
[30,55,200,110,'Directories|envs/dev, envs/prod|own code, own state|clear and explicit',2],[250,55,200,110,'CLI workspaces|one code, many states|same backend and|credentials (weaker)',0],[470,55,200,110,'HCP workspaces|one workspace each|own variables, access|and runs',2]],
[]);

/* ---------- 0: Git workflows ---------- */
L['tf:14:0']={blocks:[
{p:'Infrastructure code deserves the same discipline as application code: **version control, branches, pull requests and review**. Git becomes the **audit log** of every change to your infrastructure.'},
{svg:git},
{h:'Basic rules'},
{ul:['**Everything in Git**: modules, environment folders, pipeline files, documentation.','**Never commit** state, plan files, secrets, `.terraform/` or tfvars with secrets.','**Commit the lock file** `.terraform.lock.hcl`.','**Protect the main branch**: require a pull request, a review and passing checks.','**Small pull requests**: easier to review, safer to apply.']},
{h:'A pull request should contain'},
{t:[['Item','Why'],
['The code change','What you want'],
['A **plan** posted automatically','Exactly what will change in real infrastructure'],
['Results of format, validate, lint and security checks','Catch mistakes early'],
['A reviewer who reads the plan','A second pair of eyes']]},
{h:'Repository strategy'},
{t:[['Strategy','Meaning','Good for'],
['**Monorepo**','All modules and environments in one repository','Small and medium teams, atomic changes'],
['**Repo per service or layer**','Each team owns its repository','Large organisations, clear ownership'],
['**Separate module repos**','Modules versioned with tags, consumed by many','Shared building blocks']]},
{h:'Branching'},
{flow:['Branch from main','Make and test the change','Open a pull request: pipeline plans automatically','Reviewers read code and plan','Merge: pipeline applies','Delete the branch']},
{note:'Treat the plan as part of the code review. A review of code alone cannot show you that a one-line change replaces a database.'}],
src:[['Terraform in automation',K.T+'automate'],['Recommended practices',K.D+'cloud-docs/recommended-practices']]};

/* ---------- 1: Environments ---------- */
L['tf:14:1']={blocks:[
{p:'Most organisations run **several environments** (dev, staging, prod). Terraform offers several ways to separate them. Choose by how strict the isolation must be.'},
{svg:envs},
{t:[['Approach','How','Strengths','Weaknesses'],
['**Directories**','`envs/dev`, `envs/prod` each with its own backend and variables, calling shared modules','Explicit, easy to read, different backends and accounts, safe','Some repetition'],
['**CLI workspaces**','One folder, `terraform workspace select prod`','Little code duplication','Same backend and credentials; easy to select the wrong one; hard to see'],
['**HCP Terraform workspaces**','One workspace per environment, shared code from Git','Separate variables, access, runs and approval rules','Needs HCP Terraform'],
['**Stacks (HCP)**','Components and deployments repeated per environment','Manages many similar deployments together','Newer, plan-dependent']]},
{h:'What should differ between environments'},
{t:[['Thing','Dev','Prod'],
['Account / subscription','Lab account','Production account'],
['Sizes and counts','Small, one AZ','Larger, multi-AZ'],
['Protection','Light','`prevent_destroy`, deletion protection'],
['Access to apply','Developers','Pipeline only, with approval'],
['State','Own state','Own state, stricter access']]},
{h:'How to keep them consistent'},
{ul:['Use **the same modules** in every environment; only inputs change.','Promote changes: dev, staging, prod, with the same pipeline.','Keep environment values in `tfvars` files or workspace variables, not in modules.']},
{note:'A strong default for most teams is **directories (or HCP workspaces) per environment** with shared modules. Use CLI workspaces only for short-lived copies.'}],
src:[['Workspaces',LG+'state/workspaces'],['Recommended practices',K.D+'cloud-docs/recommended-practices']]};

/* ---------- 2: CI/CD ---------- */
L['tf:14:2']={blocks:[
{p:'The standard pipeline: **plan on every pull request, apply on merge**. People review the plan; automation applies exactly that change.'},
{svg:pipe},
{h:'Stages'},
{t:[['Stage','Runs','Commands'],
['**1. Check**','Every pull request','`fmt -check`, `init -backend=false`, `validate`, `tflint`, Checkov or Trivy'],
['**2. Plan**','Every pull request','`init`, `plan -out=tfplan -input=false`, post the summary as a comment'],
['**3. Approve**','Reviewers','Human review; for prod an extra approval gate'],
['**4. Apply**','Merge to main','`init`, `plan` again or use the stored plan, `apply -input=false tfplan`']]},
{h:'A GitHub Actions example'},
{code:`name: terraform
on:
  pull_request:
  push:
    branches: [main]

permissions:
  id-token: write      # OIDC to the cloud
  contents: read
  pull-requests: write

jobs:
  terraform:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: envs/dev
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.12.2
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-ci
          aws-region: us-east-1
      - run: terraform fmt -check -recursive
      - run: terraform init -input=false
      - run: terraform validate
      - run: terraform plan -input=false -out=tfplan
        if: github.event_name == 'pull_request'
      - run: terraform apply -input=false -auto-approve
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'`},
{h:'Key points'},
{ul:['**No stored cloud keys**: the job assumes a role through OIDC.','**Pin** the Terraform version and action versions.','**Remote state with locking** so two pipelines never collide.','For production add an **environment approval** before the apply job.','`-auto-approve` is acceptable here because the plan was already reviewed in the pull request. Even better: apply the saved plan.']},
{note:'HCP Terraform does the same with VCS-driven workspaces: speculative plan on pull request, apply on merge, with policy checks in between.'}],
src:[['Terraform in automation',K.T+'automate'],['GitHub Actions','https://github.com/hashicorp/setup-terraform']]};

/* ---------- 3: Non-interactive ---------- */
L['tf:14:3']={blocks:[
{p:'Pipelines have nobody to type `yes`. Terraform has flags and conventions so it runs **non-interactively** and **safely**.'},
{t:[['Flag / variable','Effect'],
['`-input=false`','Never prompt; fail if a value is missing'],
['`-no-color`','Plain text for logs'],
['`-lock-timeout=5m`','Wait for the state lock instead of failing at once'],
['`-out=tfplan`','Save the plan to a file'],
['`terraform apply tfplan`','Apply the saved plan with no prompt'],
['`-detailed-exitcode` (plan)','Exit code 0 = no changes, 1 = error, 2 = changes present'],
['`TF_IN_AUTOMATION=1`','Quieter output, hides "next steps" hints'],
['`TF_INPUT=0`','Same as `-input=false`']]},
{h:'The safest pattern: plan, store, apply the same file'},
{code:`terraform init -input=false
terraform plan  -input=false -out=tfplan
terraform show  -no-color tfplan > plan.txt      # for the pull request comment
# ... review and approval ...
terraform apply -input=false tfplan`},
{p:'Applying the **saved plan** guarantees you apply exactly what was reviewed. If state changed in between, Terraform refuses with "saved plan is stale".'},
{h:'Using the exit code'},
{code:`terraform plan -detailed-exitcode -input=false
case $? in
  0) echo "No changes" ;;
  2) echo "Changes found" ;;      # for drift jobs, raise an alert
  *) echo "Error"; exit 1 ;;
esac`},
{h:'Handling the plan file'},
{ul:['A plan file contains values and may contain **secrets**: store it as a short-lived, restricted artifact.','Create it and apply it with the **same Terraform version and providers**.','Do not commit it.']},
{note:'Exit code 2 with `-detailed-exitcode` is not a failure; it means "there are changes". Many scripts get this wrong.'}],
src:[['terraform plan',CLI+'commands/plan'],['Automation',K.T+'automate']]};

/* ---------- 4: Scheduled plans and drift alerts ---------- */
L['tf:14:4']={blocks:[
{p:'Infrastructure changes outside Terraform. A **scheduled plan** finds that **drift** while it is still small.'},
{flow:['A scheduler starts a job (nightly or hourly)','The job runs terraform plan -detailed-exitcode -input=false','Exit code 0: nothing to do','Exit code 2: drift or pending changes found','Alert the team (chat, ticket) with the plan summary','Decide: apply, accept with -refresh-only, or fix the cause']},
{h:'A scheduled job (GitHub Actions)'},
{code:`on:
  schedule:
    - cron: "0 5 * * *"      # every day at 05:00 UTC

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init -input=false
      - run: terraform plan -detailed-exitcode -input=false -lock=false
        continue-on-error: true
      # post a message to chat when the exit code is 2`},
{p:'`-lock=false` is acceptable here because a **plan-only** job writes nothing, but prefer `-lock-timeout` to avoid hiding collisions with a real apply.'},
{h:'HCP Terraform'},
{p:'**Health assessments** (Section 13) run drift detection and continuous validation for you and send notifications, without writing a pipeline.'},
{h:'Responding to drift'},
{t:[['Cause','Response'],
['Manual console change by mistake','Revert with `apply`, then restrict console access'],
['Change by another tool (autoscaler)','`ignore_changes`'],
['A legitimate emergency fix','`apply -refresh-only`, then update the code'],
['A provider upgrade changed defaults','Review and adjust code']]},
{note:'Drift alerts only help if someone owns them. Decide who reads the alert and what they should do.'}],
src:[['Drift detection',K.D+'cloud-docs/workspaces/health'],['plan -detailed-exitcode',CLI+'commands/plan#other-options']]};

/* ---------- 5: Production readiness checklist ---------- */
L['tf:14:5']={blocks:[
{p:'Before a configuration manages **production**, check it against this list. Each row is a common cause of outages and incidents.'},
{t:[['Area','Check'],
['**State**','Remote backend, encrypted, versioned, access restricted, one state per layer and environment'],
['**Locking**','State locking works; people know when to use `force-unlock`'],
['**Access**','Least-privilege roles; short-lived credentials (OIDC); apply only from the pipeline'],
['**Versions**','`required_version` and provider versions pinned; lock file committed'],
['**Code review**','Protected main branch; plan reviewed in every pull request'],
['**Testing**','fmt, validate, lint, security scan, `terraform test` for modules'],
['**Policy**','Rules for tags, regions, sizes and security (Sentinel, OPA or CI checks)'],
['**Guard rails**','`prevent_destroy`, deletion protection, preconditions on critical resources'],
['**Secrets**','No secrets in code or Git; ephemeral or managed secrets; state protected'],
['**Rollback**','Previous code in Git, versioned state, database backups and restore tested'],
['**Drift**','Scheduled plans or health assessments with a named owner'],
['**Cost**','Budgets, tags for cost allocation, cost estimation in pull requests'],
['**Ownership**','Documented owner per workspace and runbooks for common problems']]},
{h:'How to use the list'},
{flow:['Before go-live, walk the list with the team','Mark each item: done, planned or accepted risk','Fix the gaps in order of risk','Review again after every major change']},
{h:'Quick self-test'},
{ul:['If the state file were deleted tonight, could you recover?','If a developer ran `destroy` by mistake, what stops it?','Who is paged when a scheduled plan finds drift?','Can you rebuild the environment in a new region from code alone?']},
{note:'Production readiness is a habit, not a checkbox. Revisit the list each quarter.'}],
src:[['Recommended practices',K.D+'cloud-docs/recommended-practices'],['Well-Architected Framework','https://developer.hashicorp.com/well-architected-framework']]};

/* ---------- 6: Operations ---------- */
L['tf:14:6']={blocks:[
{p:'Running Terraform for years means **keeping it current**, **keeping it fast** and **managing many states**.'},
{h:'Keeping up to date'},
{t:[['Task','How often','Method'],
['Provider upgrades','Monthly or quarterly','Raise the constraint, `init -upgrade`, read plan, apply in dev first'],
['Terraform upgrades','Every few releases','One minor step at a time (Section 10)'],
['Module upgrades','As needed','Pin versions, read changelogs'],
['Action versions in CI','Regularly','Dependabot or Renovate pull requests']]},
{p:'Automated dependency tools (Dependabot, Renovate) can open pull requests that bump provider, module and tool versions, with a plan to review.'},
{h:'Slow plans'},
{t:[['Cause','Fix'],
['Huge state with thousands of resources','Split into several states by layer, team or risk'],
['Refresh of everything on every plan','Use `-refresh=false` carefully for quick checks; keep scheduled full refreshes'],
['API rate limits','Lower `-parallelism`; spread across states'],
['Slow data sources','Cache values, avoid lookups that list everything']]},
{h:'Managing large estates'},
{ul:['Use consistent **naming and tagging** so anything can be found.','Standardise on **shared modules** and a small set of approved patterns.','Use HCP Terraform **projects, variable sets, policies and Explorer** to see and govern many workspaces.','Document an **owner and runbook** for every state.']},
{h:'Observe the platform itself'},
{ul:['Track pipeline run times and failure rates.','Track how many workspaces have drift or outdated providers.','Review who has apply rights, regularly.']},
{note:'Every extra state needs an owner, backups and monitoring. Split states to reduce risk, not just because you can.'}],
src:[['Terraform in automation',K.T+'automate']]};

/* ---------- 7: Capstone ---------- */
L['tf:14:7']={blocks:[
{p:'**Capstone:** design, build, test, secure and operate a **multi-environment platform**. This brings together every section of the course. Work through it in order; each step names the sections it uses.'},
{svg:K.dg(700,200,[
[10,10,680,180,'The capstone platform',1],
[25,55,130,60,'Modules|network, app,|database',2],[175,55,130,60,'Envs|dev and prod|own state',0],[325,55,130,60,'Pipeline|plan on PR,|apply on merge',2],[475,55,130,60,'Security|OIDC, no secrets|in state',0],[620,55,60,60,'Ops|drift',2]],
[[155,85,175,85],[305,85,325,85],[455,85,475,85],[605,85,620,85]])},
{h:'Requirements'},
{t:[['#','Task','Uses'],
['1','Create modules `network`, `app` and `database` with typed, documented variables and outputs','Sections 4 to 9'],
['2','Create `envs/dev` and `envs/prod` calling the modules with different sizes; each with a remote backend and locking','Sections 8, 9, 15'],
['3','Add variable validation, preconditions and `prevent_destroy` on the production database','Sections 5, 7'],
['4','Remove secrets from code and state (managed password or ephemeral and write-only)','Section 11'],
['5','Write `terraform test` files with a mock provider for each module','Section 12'],
['6','Add fmt, validate, tflint and a security scan to a pull request pipeline','Sections 12, 15'],
['7','Pipeline: plan on pull request, apply on merge, OIDC credentials, approval for prod','Section 15'],
['8','Add a scheduled drift job and an alert','Section 15'],
['9','Protect state: encryption, versioning, restricted access','Sections 8, 11'],
['10','Break something on purpose (delete a resource by hand, corrupt a lock) and recover','Sections 8, 12']]},
{h:'Suggested order'},
{flow:['Draw the architecture and the repository layout','Build and test the modules locally with a mock provider','Create the dev environment and apply','Add the pipeline and apply dev through it','Harden: secrets, policy, guard rails','Create prod and the approval gate','Add drift jobs, then run a failure drill']},
{h:'Definition of done'},
{ul:['`terraform plan` shows **no changes** on both environments.','A pull request shows checks, a plan and needs approval.','No secret appears in Git, state or logs.','You can destroy and rebuild dev from code in one pipeline run.','A README explains layout, how to run, owners and recovery steps.']},
{h:'Stretch goals'},
{ul:['Publish a module to a private registry with semantic versions.','Add cost estimation to pull requests.','Move the same code into HCP Terraform workspaces with a variable set and policies.']},
{note:'Always destroy lab environments when finished and check the billing console.'}],
src:[['Terraform tutorials',K.T],['Recommended practices',K.D+'cloud-docs/recommended-practices']]};
})();
