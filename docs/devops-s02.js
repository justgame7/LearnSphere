/* LearnSphere - DevOps & CI/CD, Section 02: Lab Setup & Toolchain.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const lab=K.dg(700,220,[
[10,10,680,200,'Lab layout',1],
[30,60,140,70,'Your laptop|editor, Git, Docker',2],
[260,40,170,50,'GitHub or GitLab|(free account)',0],[260,110,170,50,'Local Jenkins|(container)',0],
[520,60,150,70,'Registry and|optional free cloud',0]],
[[170,85,260,65],[170,110,260,135],[430,65,520,85],[430,135,520,110]]);

const repo=K.dg(700,220,[
[10,10,680,200,'Sample repository layout',1],
[30,60,140,60,'src/|application code',0],[190,60,140,60,'tests/|unit and integration',0],[350,60,140,60,'Dockerfile|image build',0],[510,60,160,60,'deploy/|Kubernetes manifests',0],
[190,140,300,50,'.github/workflows, .gitlab-ci.yml,|Jenkinsfile (added per section)',2]],
[[260,120,340,140]]);

/* ---------- 0 ---------- */
L['devops:1:0']={blocks:[
{p:'Every section ends with a practical. To keep them cheap and safe, build the lab from **local tools and free tiers**, and always clean up what you create.'},
{svg:lab},
{h:'Where labs run'},
{t:[['Option','Cost','Good for'],
['Your laptop with Docker','Free','Builds, tests, Jenkins, local Kubernetes (kind, minikube)'],
['GitHub Free or GitLab Free','Free tier','Actions and GitLab CI/CD with hosted runners'],
['Free-tier cloud account','Free tier, watch limits','Cloud OIDC, registries, a small managed cluster']]},
{h:'Safety rules'},
{ul:['Set a **budget alert** in any cloud account before creating anything.','Prefer short-lived and local resources. Delete clusters, runners and registries after each lab.','Never put real secrets in a lab repository. Use throwaway values.','Use a separate account or project for experiments, not your employer\'s.']},
{h:'Cleanup checklist'},
{flow:['Stop and delete test clusters and containers','Remove self-hosted runners and revoke their tokens','Delete cloud resources created by the lab','Revoke personal access tokens used for the lab','Confirm the bill or usage page shows nothing running']}],
src:[['GitHub Actions billing',K.GHD+'billing/managing-billing-for-your-products/managing-billing-for-github-actions']]};

/* ---------- 1 ---------- */
L['devops:1:1']={blocks:[
{p:'Pipelines are mostly shell commands in disguise. Three ideas explain most pipeline behaviour: **exit codes**, **pipes** and **environment variables**.'},
{h:'Exit codes decide pass or fail'},
{p:'Every command returns a number. `0` means success and anything else means failure. A CI step fails when its last command returns non-zero.'},
{code:`ls /does-not-exist
echo $?          # prints 2: the previous command failed

test -f package.json && echo found || echo missing`},
{h:'Stop at the first error'},
{code:`#!/usr/bin/env bash
set -euo pipefail   # -e exit on error, -u error on unset variable, -o pipefail fail if any pipe stage fails`},
{t:[['Option','Effect'],
['`set -e`','Exit when a command fails'],
['`set -u`','Treat an unset variable as an error'],
['`set -o pipefail`','A pipeline fails if any command in it fails, not just the last']]},
{h:'Pipes and quoting'},
{code:`# The pipeline takes the exit code of the last command unless pipefail is set
curl -fsS https://example.com/health | grep -q ok

# Quote variables so spaces are not split
echo "$BUILD_DIR"`},
{h:'Environment variables'},
{code:`export APP_ENV=staging        # visible to child processes
APP_ENV=test ./run-tests.sh   # set only for this command
printenv | sort               # list the environment`},
{note:'CI platforms set many variables (commit SHA, branch, run number). They are the main way a pipeline passes configuration into scripts. Never print secrets with `printenv` in a job log.'}],
src:[['Bash manual','https://www.gnu.org/software/bash/manual/bash.html']]};

/* ---------- 2 ---------- */
L['devops:1:2']={blocks:[
{p:'Almost every pipeline is a **YAML** file, and most pipeline failures at the start are YAML mistakes. YAML expresses three shapes: mappings (key and value), sequences (lists) and scalars (strings, numbers, booleans).'},
{code:`name: build               # scalar
on: [push, pull_request]  # inline sequence
jobs:                     # mapping
  test:
    steps:                # sequence of mappings
      - run: npm ci
      - run: npm test`},
{h:'Rules that cause most errors'},
{ul:['**Indent with spaces**, never tabs, and be consistent (two spaces is common).','A list item starts with `- `. The key under it aligns with the first key of that item.','Quote strings that could be read as another type, such as `"yes"`, `"1.10"` or `"on"`.','A colon followed by space starts a value, so quote strings containing `: `.']},
{h:'Multi-line strings'},
{code:`script: |            # literal block: line breaks kept
  echo one
  echo two
desc: >              # folded block: lines joined with spaces
  a long sentence
  written over lines`},
{h:'Anchors and aliases'},
{code:`defaults: &defaults
  image: node:22
  timeout: 10

unit:
  <<: *defaults      # merge the defaults
  script: npm test`},
{h:'JSON'},
{p:'JSON is stricter (quoted keys, no comments, no trailing commas) and is common in API calls and tool output. YAML is a superset of JSON, so valid JSON is also valid YAML.'},
{t:[['Mistake','Symptom'],
['Tab characters','Parse error about found character that cannot start any token'],
['`on:` read as boolean `true` by some parsers','Trigger section ignored'],
['Version `3.10` unquoted','Becomes number `3.1`'],
['Wrong indentation under a list item','Step keys treated as siblings, schema error']]}],
src:[['YAML specification','https://yaml.org/spec/1.2.2/']]};

/* ---------- 3 ---------- */
L['devops:1:3']={blocks:[
{p:'Install three things: **Git**, **Docker** and an **editor** that validates pipeline files while you type.'},
{t:[['Tool','Purpose','Verify'],
['Git','Version control','`git --version`'],
['Docker Engine or Docker Desktop','Build and run containers','`docker run --rm hello-world`'],
['An editor (VS Code is common)','Edit with syntax checks','Open a `.yml` file and confirm highlighting']]},
{h:'First-time Git configuration'},
{code:`git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase true`},
{h:'Editor support'},
{ul:['Install the YAML extension and associate **JSON schemas** so the editor highlights unknown keys.','Install the GitHub Actions extension (or the GitLab Workflow extension) to validate syntax and expressions.','Use an `.editorconfig` file so everyone shares indentation and line endings.']},
{h:'Linting from the command line'},
{code:`# GitHub Actions workflow linter
actionlint

# General YAML linter
yamllint .github/workflows/`},
{note:'Run a linter locally and in the pipeline. Catching a typo in your editor takes seconds. Catching it after a push takes minutes of queue time.'}],
src:[['Git installation','https://git-scm.com/downloads'],['Docker installation',K.DK+'get-started/get-docker/']]};

/* ---------- 4 ---------- */
L['devops:1:4']={blocks:[
{p:'Every practical in the course builds on one small application, so the focus stays on the **pipeline**, not on learning a new codebase. It has tests, a Dockerfile and deployment manifests, which gives each stage something real to do.'},
{svg:repo},
{h:'What each part is for'},
{t:[['Path','Used in'],
['`src/` and `tests/`','CI sections: build, test, coverage'],
['`Dockerfile`','Artifacts and container builds, scanning, signing'],
['`deploy/`','Delivery strategies, GitOps with Argo CD'],
['Pipeline files','Added per platform: Actions, GitLab CI/CD, Jenkins']]},
{h:'The application'},
{p:'A small HTTP service with a `/health` endpoint and one business route. It reads its configuration from environment variables, so the same image runs in every environment.'},
{code:`# Typical commands for the sample app
npm ci            # install exact dependencies
npm test          # run unit tests
npm run build     # produce the build output
docker build -t sample-app:dev .`},
{note:'The app\'s language does not matter. If you prefer Python or Go, keep the same three things: a test command, a build command and a Dockerfile. The pipeline lessons transfer directly.'}]};

/* ---------- 5 ---------- */
L['devops:1:5']={blocks:[
{p:'Pipelines need access to your code and your registries. Use **accounts with two-factor authentication** and **scoped, expiring tokens**, never your password and never a token with every permission.'},
{h:'Account hygiene'},
{ul:['Enable two-factor authentication on GitHub and GitLab, ideally with a security key or passkey.','Use SSH keys or the platform credential helper for Git, not passwords.','Keep lab accounts separate from work accounts.']},
{h:'Personal access tokens'},
{t:[['Choose','Instead of'],
['Fine-grained token limited to one repository','Classic token with every repository scope'],
['Expiry of 7 to 30 days','No expiry'],
['Read-only unless you must write','Write and admin by default'],
['A job-specific token (for example `GITHUB_TOKEN`)','A personal token inside CI']]},
{flow:['Decide what the token must do','Create a token with only those permissions','Set a short expiry','Store it in a secret manager or CI secret, never in the repository','Revoke it when the lab ends']},
{note:'The best token in a pipeline is one you did not create: platform-issued job tokens and OpenID Connect (Section 6 and 15) remove stored long-lived credentials entirely.'}],
src:[['GitHub tokens',K.GHD+'authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens'],['GitLab tokens',K.GLD+'user/profile/personal_access_tokens/']]};

/* ---------- 6 ---------- */
L['devops:1:6']={blocks:[
{p:'Before automating, **do it by hand**. A pipeline is only these same commands run in a clean environment, so you need to know what success looks like.'},
{flow:['Clone the sample repository','Install dependencies with the lock file','Run the unit tests','Build the application','Build the container image','Run the container and call the health endpoint']},
{code:`git clone https://github.com/<you>/sample-app.git
cd sample-app

npm ci
npm test
npm run build

docker build -t sample-app:local .
docker run --rm -d -p 8080:8080 --name sample sample-app:local
curl -fsS localhost:8080/health
docker stop sample`},
{h:'What to note down'},
{t:[['Question','Why it matters for the pipeline'],
['Which language version and tools were needed?','The runner must provide them'],
['How long does each step take?','A baseline to improve'],
['Which steps need network access?','Caching and offline considerations'],
['What file or image is the output?','The artifact to publish']]},
{note:'If a step is flaky on your laptop it will be worse in CI. Fix flakiness now, before it is hidden behind a pipeline.'}]};
})();
