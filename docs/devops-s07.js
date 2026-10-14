/* LearnSphere - DevOps & CI/CD, Section 07: GitLab CI/CD.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const arch=K.dg(700,230,[
[10,10,680,210,'GitLab CI/CD model',1],
[25,70,120,60,'Push or merge|request',0],[180,70,140,60,'GitLab server|creates pipeline',2],
[360,30,140,40,'Runner A (docker)',0],[360,90,140,40,'Runner B (kubernetes)',0],[360,150,140,40,'Runner C (shell)',0],
[540,70,130,60,'Job logs,|artifacts,|status',0]],
[[145,100,180,100],[320,100,360,50],[320,100,360,110],[320,100,360,170],[500,110,540,100]]);

const dag=K.dg(700,220,[
[10,10,680,200,'needs: a directed acyclic graph skips stage waiting',1],
[30,50,110,40,'build-api',0],[30,130,110,40,'build-web',0],
[250,50,110,40,'test-api',0],[250,130,110,40,'test-web',0],
[470,90,110,40,'deploy',2]],
[[140,70,250,70],[140,150,250,150],[360,70,470,100],[360,150,470,120]]);

const inc=K.dg(700,200,[
[10,10,680,180,'Reuse in GitLab CI/CD',1],
[30,70,150,60,'include:|files, templates,|components',0],[260,70,150,60,'extends:|inherit from a|hidden job',0],[490,70,180,60,'CI/CD components:|versioned, with inputs',2]],
[[180,100,260,100],[410,100,490,100]]);

/* ---------- 0 ---------- */
L['devops:6:0']={blocks:[
{p:'In **GitLab CI/CD** a pipeline is defined in `.gitlab-ci.yml` at the root of the repository. When something triggers it, the GitLab server creates a **pipeline** made of **stages**, which contain **jobs** that **runners** pick up and execute.'},
{svg:arch},
{t:[['Term','Meaning'],
['**Pipeline**','One run of the definition, tied to a commit, tag or merge request'],
['**Stage**','An ordered group of jobs. Stages run one after another; jobs within a stage run in parallel'],
['**Job**','A unit of work with a `script`; runs on a runner'],
['**Runner**','An agent, separate from the GitLab server, that executes jobs'],
['**Executor**','How a runner runs a job: shell, Docker, Kubernetes and others']]},
{h:'Why this design matters'},
{ul:['The server only orchestrates. Execution capacity scales by adding runners.','Runners can live inside private networks and connect out to GitLab.','GitLab.com offers shared runners. Self-managed instances use runners you install.']},
{h:'Pipeline types'},
{t:[['Type','Runs for'],
['Branch pipeline','Pushes to a branch'],
['Merge request pipeline','A merge request\'s source branch changes'],
['Tag pipeline','A pushed tag, often for releases'],
['Scheduled and API-triggered','Cron schedules and external triggers']]}],
src:[['CI/CD pipelines',K.GL+'pipelines/'],['CI/CD YAML syntax',K.GL+'yaml/']]};

/* ---------- 1 ---------- */
L['devops:6:1']={blocks:[
{p:'A small set of keywords covers most pipelines. `stages` orders the jobs, `image` selects the container, `script` lists commands and `rules` decides whether a job runs.'},
{code:`stages: [build, test, deploy]

default:
  image: node:22

build:
  stage: build
  script:
    - npm ci
    - npm run build
  artifacts:
    paths: [dist/]
    expire_in: 1 week

unit-tests:
  stage: test
  script:
    - npm ci
    - npm test

deploy-staging:
  stage: deploy
  script: ./deploy.sh staging
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH`},
{h:'Keywords'},
{t:[['Keyword','Purpose'],
['`stages`','Order of stages'],
['`image`','Container image the job runs in'],
['`script`, `before_script`, `after_script`','Commands to run'],
['`rules`','Conditions that include, exclude or change a job'],
['`variables`','Variables for the pipeline or a job'],
['`artifacts`, `cache`','Outputs and speed-ups'],
['`needs`, `dependencies`','Job ordering and artifact selection'],
['`environment`','Link a job to a deployment target']]},
{h:'How `rules` works'},
{p:'Rules are evaluated top to bottom. The first rule that matches decides; if none matches the job is not added.'},
{code:`rules:
  - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  - if: $CI_COMMIT_TAG
  - changes: [docs/**]
    when: never
  - when: on_success`},
{note:'Prefer `rules` over the older `only` and `except`, which are not recommended for new pipelines.'}],
src:[['Job rules',K.GL+'jobs/job_rules/'],['Predefined variables',K.GL+'variables/predefined_variables/']]};

/* ---------- 2 ---------- */
L['devops:6:2']={blocks:[
{p:'Variables carry configuration into jobs. GitLab lets you define them at several levels and decide who can see and use them.'},
{t:[['Where','Scope'],
['`variables:` in `.gitlab-ci.yml`','Pipeline or job'],
['Project settings > CI/CD > Variables','One project'],
['Group settings','All projects in a group'],
['Instance settings','Self-managed administrators only']]},
{h:'Variable options'},
{t:[['Option','Effect'],
['**Protected**','Only available to jobs on protected branches and tags'],
['**Masked**','Hidden in job logs (value must meet formatting rules)'],
['**Masked and hidden**','Cannot be revealed again in the UI after saving'],
['**File type**','Value is written to a temporary file and the variable holds its path'],
['**Environment scope**','Available only to a given environment such as `production`']]},
{code:`deploy-prod:
  stage: deploy
  environment: production
  script:
    - kubectl --kubeconfig "$KUBECONFIG" apply -f deploy/    # KUBECONFIG is a File variable
    - curl -H "Authorization: Bearer $API_TOKEN" https://api.example.com/notify`},
{h:'Practices'},
{ul:['Mark deploy credentials **protected** so merge request pipelines from feature branches cannot read them.','Use **file** variables for certificates and kubeconfig files rather than long strings.','Prefer short-lived credentials via OIDC (ID tokens) where the target supports it.']},
{note:'Masking prevents a value appearing in the log, not a script transforming and printing it. Limit which jobs can reach a secret rather than relying on masking.'}],
src:[['CI/CD variables',K.GL+'variables/']]};

/* ---------- 3 ---------- */
L['devops:6:3']={blocks:[
{p:'By default each stage waits for the previous stage to finish. `needs` lets a job start as soon as the jobs it depends on finish, forming a **directed acyclic graph** and shortening the pipeline.'},
{svg:dag},
{code:`build-api:
  stage: build
  script: make api
  artifacts:
    paths: [api/bin/]

test-api:
  stage: test
  needs: [build-api]       # start as soon as build-api is done
  script: make test-api

deploy:
  stage: deploy
  needs: [test-api, test-web]
  script: ./deploy.sh`},
{t:[['','Cache','Artifacts'],
['Purpose','Reuse between pipelines to speed up','Pass results to later jobs, and keep reports'],
['Key','`cache:key` (for example `files: [package-lock.json]`)','Job and expiry'],
['Guarantee','Best effort','Reliable within the pipeline']]},
{h:'`needs` and artifacts'},
{ul:['With `needs`, a job downloads artifacts only from the jobs it needs, unless `artifacts: false`.','`dependencies` limits which previous-stage artifacts a job downloads when not using `needs`.','A `needs` list may include jobs from earlier **or** the same stage.']}],
src:[['needs keyword',K.GL+'yaml/#needs'],['Caching in GitLab CI/CD',K.GL+'caching/']]};

/* ---------- 4 ---------- */
L['devops:6:4']={blocks:[
{p:'A **GitLab Runner** is a separate program that polls GitLab for jobs. Its **executor** decides how a job is run.'},
{t:[['Executor','Runs the job...','When to use'],
['**Docker**','In a fresh container from the job\'s `image`','Default choice, clean and reproducible'],
['**Kubernetes**','In a pod created per job','Elastic capacity in a cluster'],
['**Shell**','Directly on the runner host','Special hardware or simple setups; no isolation'],
['**Instance/autoscaling (docker-autoscaler)**','On cloud VMs created on demand','Elastic cloud capacity with VM isolation']]},
{flow:['Create a runner in the project or group (authentication token)','Install gitlab-runner on a machine','Register it with the token and choose an executor','Add tags that describe it','Jobs use tags to be routed to it']},
{code:`# Route a job to a matching runner
build-image:
  tags: [docker, linux]
  script: docker build -t app .`},
{h:'Scoping runners'},
{ul:['**Instance** runners serve all projects. **Group** runners serve a group. **Project** runners serve one project.','Mark production-deploy runners as **protected** so they run only protected branches.','Prefer ephemeral executors (Docker, Kubernetes) to avoid state carrying over between jobs.']}],
src:[['GitLab Runner',K.GLD+'runner/'],['Executors',K.GLD+'runner/executors/']]};

/* ---------- 5 ---------- */
L['devops:6:5']={blocks:[
{p:'Repeating the same job definitions in every project is slow and error-prone. GitLab provides three layered tools for reuse.'},
{svg:inc},
{t:[['Tool','Use for'],
['`include`','Pull in YAML from another file, project, remote URL or template'],
['`extends`','Make a job inherit configuration from a hidden job (name starting with `.`)'],
['**CI/CD components**','Versioned, reusable pipeline units with typed **inputs**, published in a catalog']]},
{code:`include:
  - project: acme/ci-templates
    ref: v2.1.0
    file: /templates/build.yml
  - component: gitlab.com/acme/components/docker-build@1.2.0
    inputs:
      image_name: app

.deploy-base:
  image: bitnami/kubectl
  before_script: [echo "deploying"]

deploy-staging:
  extends: .deploy-base
  script: ./deploy.sh staging`},
{h:'Tips'},
{ul:['Pin included projects and components to a **tag or SHA**, not a moving branch.','Use `inputs` with defaults so consumers customise without forking.','Hidden jobs and `!reference` tags let you reuse fragments of scripts.']}],
src:[['CI/CD components',K.GL+'components/'],['include',K.GL+'yaml/includes/']]};

/* ---------- 6 ---------- */
L['devops:6:6']={blocks:[
{p:'An **environment** in GitLab is a named place where code is deployed. Each deployment is recorded, so you can see what is running where and roll back. A **review app** is a temporary environment created for each merge request.'},
{code:`deploy-review:
  stage: deploy
  script: ./deploy-review.sh "$CI_COMMIT_REF_SLUG"
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    url: https://$CI_COMMIT_REF_SLUG.review.example.com
    on_stop: stop-review
    auto_stop_in: 2 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

stop-review:
  stage: deploy
  script: ./teardown-review.sh "$CI_COMMIT_REF_SLUG"
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    action: stop
  when: manual`},
{flow:['A merge request is opened','The pipeline deploys a copy of the app to review/<branch>','A link appears on the merge request','Reviewers try the change','The merge request is merged or closed','The environment is stopped and removed']},
{h:'Useful features'},
{ul:['**Protected environments** limit who can deploy to production.','**Deployment approvals** require sign-off for chosen environments.','Deployment history and **rollback** from the environments page.','`auto_stop_in` removes forgotten review apps to save cost.']}],
src:[['Environments',K.GL+'environments/'],['Review apps',K.GL+'review_apps/']]};

/* ---------- 7 ---------- */
L['devops:6:7']={blocks:[
{p:'A pipeline for the source branch only proves that the **branch** is fine. By the time you merge, main may have moved. GitLab offers three ways to test the real result.'},
{t:[['Feature','What it tests'],
['**Merge request pipelines**','The merge request\'s changes, with access to merge request variables'],
['**Merged results pipelines**','A temporary commit combining the source branch **with the latest target branch**'],
['**Merge trains**','A queue: each merge request is tested merged on top of those ahead of it, and merged only if the train stays green']]},
{svg:K.dg(700,200,[
[10,10,680,180,'Merge train',1],
[30,70,120,60,'main',0],[190,70,120,60,'MR 1 on main',0],[350,70,140,60,'MR 2 on main+MR1',0],[530,70,140,60,'MR 3 on main+MR1+2',0]],
[[150,100,190,100],[310,100,350,100],[490,100,530,100]])},
{ul:['If a merge request in the train fails, it is removed and the ones behind it are re-tested without it.','Merge trains keep main green when many people merge at once, at the cost of extra pipeline runs.','Configure jobs to run in merge request pipelines with `rules` on `$CI_PIPELINE_SOURCE == "merge_request_event"`.']},
{note:'Enable the setting that requires a pipeline to succeed before merging. Without it, a red pipeline can still be merged.'}],
src:[['Merge request pipelines',K.GL+'pipelines/merge_request_pipelines/'],['Merge trains',K.GL+'pipelines/merge_trains/']]};

/* ---------- 8 ---------- */
L['devops:6:8']={blocks:[
{p:'Build the sample app\'s full GitLab pipeline: build, test, scan, deploy and a review app for each merge request.'},
{flow:['Create the project and register or use a shared runner','Add build and test jobs with artifacts and cache','Add a security scan job','Deploy review apps from merge requests','Deploy to staging from the default branch','Require a successful pipeline before merge']},
{code:`stages: [build, test, scan, deploy]

default:
  image: node:22
  cache:
    key:
      files: [package-lock.json]
    paths: [node_modules/]

build:
  stage: build
  script: [npm ci, npm run build]
  artifacts: { paths: [dist/], expire_in: 1 week }

test:
  stage: test
  script: [npm ci, npm test]
  coverage: '/All files.*?\\s+(\\d+\\.?\\d*)\\s*%/'

dependency-scan:
  stage: scan
  image: aquasec/trivy:latest
  script: [trivy fs --exit-code 1 --severity HIGH,CRITICAL .]

review:
  stage: deploy
  script: ./deploy-review.sh "$CI_COMMIT_REF_SLUG"
  environment: { name: "review/$CI_COMMIT_REF_SLUG", on_stop: stop-review }
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

stop-review:
  stage: deploy
  script: ./teardown.sh "$CI_COMMIT_REF_SLUG"
  environment: { name: "review/$CI_COMMIT_REF_SLUG", action: stop }
  when: manual
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"`},
{h:'Verify'},
{ul:['Does opening a merge request create a review app and a link?','Is the review app removed when the merge request closes?','What happens if the scan finds a high-severity issue?']}]};
})();
