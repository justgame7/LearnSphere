/* LearnSphere - DevOps & CI/CD, Section 05: GitHub Actions: Workflows & Automation.
   Lectures 0-10 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const arch=K.dg(700,230,[
[10,10,680,210,'GitHub Actions model',1],
[15,50,125,50,'Event|push, PR, schedule',0],[170,50,130,50,'Workflow|YAML file',2],
[340,30,150,40,'Job: build',0],[340,90,150,40,'Job: test (needs build)',0],[340,150,150,40,'Job: deploy',0],
[530,60,140,60,'Runner|runs steps',0]],
[[140,75,170,75],[300,75,340,50],[300,75,340,110],[300,75,340,170],[490,110,530,90]]);

const matrix=K.dg(700,200,[
[10,10,680,180,'needs and matrix',1],
[30,70,100,50,'lint',0],[170,70,100,50,'build',0],[330,30,140,40,'test node 20',0],[330,80,140,40,'test node 22',0],[330,130,140,40,'test node 24',0],[540,70,130,50,'deploy',2]],
[[130,95,170,95],[270,95,330,50],[270,95,330,100],[270,95,330,150],[470,50,540,90],[470,100,540,95],[470,150,540,100]]);

/* ---------- 0 ---------- */
L['devops:4:0']={blocks:[
{p:'**GitHub Actions** is GitHub\'s built-in automation platform. An **event** in a repository triggers a **workflow**, which runs one or more **jobs**, each made of **steps** executed on a **runner**.'},
{svg:arch},
{t:[['Term','Meaning'],
['**Event**','Something that happens: `push`, `pull_request`, `schedule`, `workflow_dispatch` (manual), `release`'],
['**Workflow**','A YAML file in `.github/workflows/`; a repository can have many'],
['**Job**','A set of steps on one runner. Jobs run in parallel by default'],
['**Step**','A shell command (`run`) or a reusable **action** (`uses`)'],
['**Action**','A packaged, reusable step from the Marketplace, a repository or your own code'],
['**Runner**','The virtual machine or container that executes a job. GitHub-hosted or self-hosted']]},
{h:'A minimal workflow'},
{code:`name: hello
on: push
jobs:
  greet:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Hello from \${{ github.repository }}"`},
{note:'Every job starts on a fresh runner. Files and tools from one job are not visible to another unless you pass them with artifacts, caches or job outputs.'}],
src:[['Understanding GitHub Actions',K.GH+'get-started/understand-github-actions']]};

/* ---------- 1 ---------- */
L['devops:4:1']={blocks:[
{p:'The `on:` key chooses **when** a workflow runs. Filters narrow it to the branches, paths and event types you care about, and **concurrency** controls overlapping runs.'},
{code:`on:
  push:
    branches: [main, 'release/**']
    paths:
      - 'src/**'
      - 'package*.json'
  pull_request:
    types: [opened, synchronize, reopened]
  schedule:
    - cron: '0 3 * * 1'     # Mondays 03:00 UTC
  workflow_dispatch:         # manual run button

concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true`},
{t:[['Trigger','Typical use'],
['`push`','Build on commits to main or release branches'],
['`pull_request`','Validate changes before merge. Runs with a read-only token for forks'],
['`schedule`','Nightly scans, dependency checks'],
['`workflow_dispatch`','Manual runs and operational tasks, with inputs'],
['`release`, tags','Publish when a release is created'],
['`workflow_call`','Make a workflow reusable by others']]},
{h:'Concurrency'},
{p:'Without concurrency, five quick pushes start five full runs. A concurrency group with `cancel-in-progress: true` cancels the older runs, saving minutes. For **deployments** use a group without cancelling, so a deploy is never interrupted halfway.'},
{note:'Path filters and required status checks can conflict: a required check that is skipped by a path filter stays pending forever. Plan for that, for example with a final job that always runs.'}],
src:[['Workflow syntax',K.GH+'reference/workflows-and-actions/workflow-syntax'],['Events that trigger workflows',K.GH+'reference/workflows-and-actions/events-that-trigger-workflows']]};

/* ---------- 2 ---------- */
L['devops:4:2']={blocks:[
{p:'A **step** can run an **action**: a reusable unit published by GitHub, a vendor or the community. You pick it with `uses:` and configure it with `with:`.'},
{code:`steps:
  - uses: actions/checkout@v4          # official
    with:
      fetch-depth: 0
  - uses: actions/setup-node@v4
    with:
      node-version: 22
      cache: npm
  - uses: docker/build-push-action@v6   # verified creator
    with:
      push: false`},
{h:'Choosing actions you can trust'},
{t:[['Check','Why'],
['Publisher: GitHub, a verified creator, or your own organisation','A known owner is accountable'],
['Source is readable and small','You can audit what runs with your secrets'],
['Recent maintenance and a security policy','Abandoned actions rot'],
['Pins and permissions','You control the version and what the token can do']]},
{h:'Versions'},
{ul:['`@v4` follows a moving major tag. Convenient, but the tag can change.','`@<full-commit-sha>` is immutable. Use it for third-party actions (Section 6).','Never use `@main` for an action you do not control.']},
{h:'Inputs and outputs'},
{p:'Actions read **inputs** through `with:` and may set **outputs** you can read in later steps as `steps.<id>.outputs.<name>`.'},
{note:'An action runs with the privileges of your job, including its token and secrets. Adding a third-party action is adding a dependency that can read them.'}],
src:[['Using actions',K.GH+'writing-workflows/choosing-what-your-workflow-does/using-pre-written-building-blocks-in-your-workflow']]};

/* ---------- 3 ---------- */
L['devops:4:3']={blocks:[
{p:'**Contexts** are objects that hold information about the run. **Expressions** read them with `\${{ ... }}`. `if:` uses expressions to decide whether a step or job runs.'},
{t:[['Context','Holds','Example'],
['`github`','Event, repository, ref, SHA, actor','`github.ref_name`'],
['`env`','Variables set in the workflow','`env.REGISTRY`'],
['`vars`','Configuration variables','`vars.APP_NAME`'],
['`secrets`','Secret values','`secrets.TOKEN`'],
['`needs`','Outputs and result of required jobs','`needs.build.outputs.tag`'],
['`steps`','Outputs of earlier steps','`steps.meta.outputs.version`'],
['`runner`, `job`, `matrix`','Runner and job details','`runner.os`']]},
{code:`steps:
  - name: Only on main
    if: github.ref == 'refs/heads/main'
    run: ./deploy.sh

  - name: Run even if an earlier step failed
    if: always()
    run: ./collect-logs.sh

  - name: Only on failure
    if: failure()
    run: echo "something broke"`},
{h:'Status functions'},
{t:[['Function','True when'],
['`success()`','All previous steps passed (default)'],
['`failure()`','Any previous step failed'],
['`always()`','Always, even after cancellation request'],
['`cancelled()`','The run was cancelled']]},
{note:'Do not put untrusted values such as a pull request title directly into a `run:` script via expressions. That is script injection (Section 6). Pass them through `env:` instead.'}],
src:[['Contexts',K.GH+'reference/workflows-and-actions/contexts'],['Expressions',K.GH+'reference/workflows-and-actions/expressions']]};

/* ---------- 4 ---------- */
L['devops:4:4']={blocks:[
{p:'Workflows need values. GitHub gives you three places to keep them, and the right place depends on whether the value is sensitive and who needs it.'},
{t:[['Kind','Visible in logs?','Use for','Read as'],
['**Variables**','Yes','Non-sensitive configuration','`vars.NAME`'],
['**Secrets**','Masked, encrypted at rest','Tokens, keys, passwords','`secrets.NAME`'],
['**Workflow `env:`**','Yes','Values set inside the file','`env.NAME`']]},
{h:'Scopes'},
{svg:K.dg(700,200,[
[10,10,680,180,'Narrower scope wins',1],
[30,70,180,70,'Organization|all or selected repos',0],[260,70,180,70,'Repository|this repo only',0],[490,70,180,70,'Environment|production, staging',2]],
[[210,105,260,105],[440,105,490,105]])},
{ul:['**Organization** values are shared across selected repositories.','**Repository** values apply to one repository.','**Environment** values are available only to jobs that target that environment, and can require approval first.','A more specific scope overrides a broader one with the same name.']},
{h:'Handling secrets'},
{ul:['Pass a secret only to the step that needs it, through `env:`.','Secrets are not available to workflows triggered from **forks** by default.','Rotate secrets and prefer OIDC to stored cloud credentials (Section 6).']},
{code:`jobs:
  deploy:
    environment: production    # unlocks production secrets and its approvals
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh
        env:
          API_TOKEN: \${{ secrets.API_TOKEN }}`}],
src:[['Variables',K.GH+'writing-workflows/choosing-what-your-workflow-does/store-information-in-variables'],['Secrets',K.GHD+'actions/security-for-github-actions/security-guides/using-secrets-in-github-actions']]};

/* ---------- 5 ---------- */
L['devops:4:5']={blocks:[
{p:'By default jobs run in parallel. `needs` creates **order** and a dependency graph. A **matrix** repeats one job for several combinations. **Outputs** carry small values from one job to another.'},
{svg:matrix},
{code:`jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: \${{ steps.v.outputs.version }}
    steps:
      - uses: actions/checkout@v4
      - id: v
        run: echo "version=1.\${{ github.run_number }}" >> "$GITHUB_OUTPUT"

  test:
    needs: build
    strategy:
      fail-fast: false
      matrix:
        node: [20, 22, 24]
        os: [ubuntu-latest]
    runs-on: \${{ matrix.os }}
    steps:
      - run: echo "Testing \${{ needs.build.outputs.version }} on node \${{ matrix.node }}"`},
{h:'Details to remember'},
{ul:['A job runs only if everything in `needs` succeeded, unless you add `if: always()`.','`fail-fast: true` (default) cancels the other matrix jobs when one fails. Set `false` to see all results.','Outputs are strings and small. Use **artifacts** for files.','`include` and `exclude` add or remove specific matrix combinations.']}],
src:[['Running variations of jobs',K.GH+'writing-workflows/choosing-what-your-workflow-does/running-variations-of-jobs-in-a-workflow'],['Passing information between jobs',K.GH+'writing-workflows/choosing-what-your-workflow-does/passing-information-between-jobs']]};

/* ---------- 6 ---------- */
L['devops:4:6']={blocks:[
{p:'Caches and artifacts both store files between steps or runs, but for different reasons. Use the dedicated actions and design keys carefully.'},
{t:[['','Cache','Artifact'],
['Action','`actions/cache` (or setup actions with `cache:`)','`actions/upload-artifact`, `download-artifact`'],
['Purpose','Reuse dependencies between runs','Share outputs between jobs and keep results'],
['Retention','Evicted when unused (about 7 days) or over the repository limit','Default 90 days, configurable'],
['Visible in UI','No','Yes, downloadable from the run']]},
{code:`- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: npm-\${{ runner.os }}-\${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      npm-\${{ runner.os }}-

- uses: actions/upload-artifact@v4
  with:
    name: dist-\${{ github.sha }}
    path: dist/
    retention-days: 14
    if-no-files-found: error`},
{h:'Design notes'},
{ul:['Branch caches are isolated: a pull request can read the base branch cache but not write one that main reads. This limits cache poisoning.','Artifact names must be unique within a run when using v4 upload.','Large artifacts cost storage. Set a short `retention-days` for intermediate outputs.']}],
src:[['Caching',K.GH+'writing-workflows/choosing-what-your-workflow-does/caching-dependencies-to-speed-up-workflows'],['Artifacts',K.GH+'writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow']]};

/* ---------- 7 ---------- */
L['devops:4:7']={blocks:[
{p:'Copy and paste across repositories means every fix has to be made many times. GitHub offers two ways to share pipeline logic: **reusable workflows** and **composite actions**.'},
{t:[['','Reusable workflow','Composite action'],
['Unit','A whole workflow with its own jobs','A group of steps used inside a job'],
['Called with','`jobs.<id>.uses:`','A step `uses:`'],
['Runs on','Its own runners and jobs','The caller job\'s runner'],
['Secrets','Passed explicitly or with `secrets: inherit`','Inputs only (no direct secrets)'],
['Best for','Standard CI/CD pipeline, deploy process','Small repeated sequence such as setup'] ]},
{h:'A reusable workflow'},
{code:`# .github/workflows/build.yml in acme/shared-workflows
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '22'
    secrets:
      registry-token:
        required: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test`},
{code:`# Caller
jobs:
  ci:
    uses: acme/shared-workflows/.github/workflows/build.yml@v1
    with:
      node-version: '24'
    secrets: inherit`},
{h:'A composite action'},
{code:`# .github/actions/setup/action.yml
name: Setup project
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: npm }
    - run: npm ci
      shell: bash`},
{note:'Version shared workflows with tags and pin callers to a tag or SHA. A fix then rolls out deliberately, not to every repository the moment you push.'}],
src:[['Reusing workflows',K.GH+'sharing-automations/reusing-workflows'],['Creating a composite action',K.GH+'sharing-automations/creating-actions/creating-a-composite-action']]};

/* ---------- 8 ---------- */
L['devops:4:8']={blocks:[
{p:'An **environment** is a named deployment target such as `staging` or `production`. It adds protection that applies to any job that targets it.'},
{t:[['Protection','Effect'],
['**Required reviewers**','Named people or teams must approve before the job starts'],
['**Wait timer**','Delay the job by a number of minutes'],
['**Deployment branches and tags**','Only listed branches (for example `main`) may deploy'],
['**Environment secrets and variables**','Available only to this environment\'s jobs'],
['**Custom protection rules**','Checks from other systems, such as a monitoring gate']]},
{code:`jobs:
  deploy-prod:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.example.com
    steps:
      - run: ./deploy.sh production`},
{flow:['Job reaches the environment','Branch rule checked','Reviewers notified','Reviewer approves (and wait timer elapses)','Environment secrets unlocked','Job runs and the deployment is recorded']},
{h:'Practices'},
{ul:['Restrict `production` to the `main` branch.','Prevent the person who triggered the run from approving it where policy requires separation of duties.','Use the deployment history for audit and for DORA metrics.']}],
src:[['Managing environments for deployment',K.GH+'managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment']]};

/* ---------- 9 ---------- */
L['devops:4:9']={blocks:[
{p:'When a run fails you need the failing step and the reason, quickly. GitHub provides **workflow commands**, **job summaries** and **debug logging** to help.'},
{h:'Workflow commands'},
{code:`echo "::notice file=app.js,line=10::Consider caching"
echo "::warning::Deprecated flag in use"
echo "::error file=app.js,line=42::Missing semicolon"

echo "::group::Install dependencies"
npm ci
echo "::endgroup::"

echo "::add-mask::$SOME_VALUE"        # mask a computed value`},
{h:'Job summaries'},
{code:`{
  echo "### Test results"
  echo "| Suite | Result |"
  echo "|---|---|"
  echo "| unit | passed |"
} >> "$GITHUB_STEP_SUMMARY"`},
{h:'Reading a failed run'},
{flow:['Open the run and find the first failed job','Expand the first failed step','Read the last 20 lines before the error','Check what changed since the last green run','Re-run with debug logging if the cause is unclear']},
{ul:['Re-run failed jobs only, and enable **Enable debug logging** for extra detail.','Set `ACTIONS_STEP_DEBUG=true` as a secret or variable for step debug logs.','Use `act` locally for quick experiments, noting it is an approximation of the hosted runner.']}],
src:[['Workflow commands',K.GH+'reference/workflows-and-actions/workflow-commands'],['Enabling debug logging',K.GH+'monitoring-and-troubleshooting-workflows/troubleshooting-workflows/enabling-debug-logging']]};

/* ---------- 10 ---------- */
L['devops:4:10']={blocks:[
{p:'Put the section together in one workflow: matrix tests, a cache, an artifact and a deployment protected by an environment approval.'},
{flow:['Test on a matrix of runtime versions','Build once and upload the artifact','Download the artifact in the staging job','Deploy to staging automatically','Wait for approval on the production environment','Deploy the same artifact to production']},
{code:`name: pipeline
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: \${{ github.event_name == 'pull_request' }}

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  deploy-staging:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist }
      - run: ./deploy.sh staging

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production   # requires reviewer approval
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist }
      - run: ./deploy.sh production`},
{h:'Check yourself'},
{ul:['Does a pull request skip both deploy jobs?','What stops production deploying without approval?','Is the same artifact used in both environments?','What is the default token permission?']}]};
})();
