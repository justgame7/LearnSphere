/* LearnSphere - DevOps & CI/CD, Section 04: CI Fundamentals & Pipeline Design.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const ciLoop=K.dg(700,200,[
[10,10,680,180,'The continuous integration loop',1],
[25,70,100,60,'Small change|on a branch',0],[155,70,100,60,'Push or|pull request',0],[285,70,100,60,'Automatic|build and test',0],[415,70,100,60,'Fast result|pass or fail',2],[545,70,130,60,'Merge, or fix|immediately',0]],
[[125,100,155,100],[255,100,285,100],[385,100,415,100],[515,100,545,100]]);

const anatomy=K.dg(700,260,[
[10,10,680,240,'Pipeline anatomy',1],
[30,50,130,40,'Trigger: push, PR, tag',0],
[30,110,200,120,'Stage: build',1],[45,140,170,34,'Job: compile',0],[45,184,170,34,'Job: package',0],
[260,110,200,120,'Stage: test',1],[275,140,170,34,'Job: unit',0],[275,184,170,34,'Job: integration',0],
[490,110,180,120,'Stage: publish',1],[505,150,150,40,'Job: push image',2]],
[[95,90,95,110],[230,170,260,170],[460,170,490,170]]);

const matrix=K.dg(700,200,[
[10,10,680,180,'Matrix: one job definition, many combinations',1],
[30,60,160,90,'node 20|node 22|node 24',0],[250,70,60,70,'x',0],[360,60,160,90,'ubuntu|windows|macos',0],[580,70,90,70,'9 parallel|jobs',2]],
[[190,105,250,105],[310,105,360,105],[520,105,580,105]]);

/* ---------- 0 ---------- */
L['devops:3:0']={blocks:[
{p:'**Continuous integration** is the practice of every developer merging into a shared main branch **at least daily**, with each merge verified by an automated build and test run. The tool is only the enabler.'},
{svg:ciLoop},
{h:'The habits that make it work'},
{ul:['Merge **small** changes **often**. Small merges conflict less and are easy to review.','Keep the main branch **always releasable**. A broken main is the team\'s top priority.','**Fix a failing build first**, before starting new work.','Keep the build **fast** so people run it and wait for it.','Make results **visible** to everyone.']},
{h:'Why small frequent merges matter'},
{t:[['Branch lives for','Conflict size','Review quality','Feedback delay'],
['Hours','Tiny','High','Minutes'],
['Days','Moderate','Medium','Hours'],
['Weeks','Large, painful','Low (too big to read)','Days; bugs found late']]},
{note:'If merging feels scary, the answer is to merge more often, not less. The pain is proportional to how long changes stay apart.'}],
src:[['DORA: continuous integration',K.DORA+'capabilities/continuous-integration/']]};

/* ---------- 1 ---------- */
L['devops:3:1']={blocks:[
{p:'Every CI system uses the same small vocabulary under different names. Learn it once and you can read any pipeline.'},
{svg:anatomy},
{t:[['Concept','Meaning','GitHub Actions','GitLab CI/CD','Jenkins'],
['**Trigger**','What starts a run','`on:` event','Pipeline source and `rules`','Webhook, SCM polling'],
['**Pipeline**','The whole automated process','Workflow','Pipeline','Pipeline job'],
['**Stage**','A group of jobs that run in order','(implicit via `needs`)','`stages:`','`stage`'],
['**Job**','A unit of work on one runner','Job','Job','Stage with steps'],
['**Step**','One command or action in a job','Step','`script` line','Step'],
['**Runner**','The machine that executes jobs','Runner','Runner','Agent'],
['**Artifact**','A file produced and kept','Artifact','Artifact','Archived artifact']]},
{h:'Rules of thumb'},
{ul:['Jobs in the same stage may run **in parallel**. Stages run in order.','Each job usually starts from a **clean** environment. Share data through artifacts or caches.','A step that exits non-zero fails the job, and a failed job normally fails the stage.']}],
src:[['GitHub Actions concepts',K.GH+'get-started/understand-github-actions'],['GitLab pipelines',K.GL+'pipelines/']]};

/* ---------- 2 ---------- */
L['devops:3:2']={blocks:[
{p:'A **build** turns source into something runnable or deliverable: compiled binaries, a bundle, a package or an image. The pipeline should produce it the same way every time.'},
{h:'Steps of a typical build'},
{flow:['Check out the source at the commit','Install the exact toolchain','Resolve dependencies from the lock file','Compile or bundle','Package the output']},
{h:'Dependencies and pinning'},
{t:[['Ecosystem','Install exact versions from','Command'],
['npm','`package-lock.json`','`npm ci`'],
['Python','`requirements.txt` with hashes or `poetry.lock`','`pip install --require-hashes -r ...`'],
['Java','Pinned versions in Maven or Gradle with locking','`mvn -B verify`'],
['Go','`go.sum`','`go build ./...`']]},
{p:'Using the **lock file** means today\'s build uses the same dependency versions as yesterday\'s. Without it, a new upstream release can break or compromise your build for no change of yours.'},
{h:'Reproducible builds'},
{ul:['Pin the **toolchain** version (language runtime, compiler) as well as libraries.','Do not depend on the current date, hostname or network at build time where avoidable.','Build in a clean environment, not on a developer\'s machine.']},
{note:'A build that behaves differently from run to run cannot be trusted as the thing you promote. Aim for the same inputs always giving the same output.'}],
src:[['Reproducible Builds','https://reproducible-builds.org/']]};

/* ---------- 3 ---------- */
L['devops:3:3']={blocks:[
{p:'Tests in CI should be **reliable**, **fast** and **readable**. A test suite people do not trust is ignored.'},
{t:[['Test type','Scope','Speed','CI notes'],
['**Unit**','One function or class, no I/O','Milliseconds','Run on every push'],
['**Integration**','Several components, real database or service','Seconds','Use service containers'],
['**End-to-end**','Whole system through its interface','Minutes','Fewer, after deployment to a test environment']]},
{h:'Make results easy to read'},
{ul:['Publish results in a standard format such as **JUnit XML** so the platform can show failed tests, trends and timings.','Fail with a clear message that says which test and why.','Keep the full log available but show the summary first.']},
{code:`# Example: produce a JUnit report
npm test -- --reporters=default --reporters=jest-junit
# then upload junit.xml as a test report in the platform`},
{h:'Flaky tests'},
{p:'A flaky test passes and fails without code changes. Retrying hides the problem. Track flaky tests, quarantine them from the blocking path, and fix or delete them.'},
{note:'Treat a flaky test as a bug with an owner. Left alone, it teaches the team to ignore red builds, which defeats continuous integration.'}],
src:[['GitHub Actions testing',K.GH+'use-cases-and-examples/building-and-testing']]};

/* ---------- 4 ---------- */
L['devops:3:4']={blocks:[
{p:'An **artifact** is a file or set of files produced by a job that you keep: a binary, a package, a test report, a coverage file. Stored artifacts let later jobs and later environments use **exactly** what was built.'},
{svg:K.dg(700,200,[
[10,10,680,180,'Build once, reuse downstream',1],
[30,70,140,60,'Build job|creates dist/',0],[250,70,140,60,'Artifact store|dist.tar.gz',2],[470,40,200,50,'Test job downloads it',0],[470,110,200,50,'Deploy job downloads it',0]],
[[170,100,250,100],[390,100,470,65],[390,100,470,135]])},
{h:'Why not rebuild?'},
{ul:['A rebuild is a **different** artifact, even from the same commit, if dependencies or tools changed.','Rebuilding wastes time.','You can only claim that what was tested is what is deployed if it is the same file.']},
{t:[['Property','Notes'],
['Naming','Include the commit SHA or version'],
['Retention','Set an expiry so storage does not grow without limit'],
['Integrity','Record a checksum or digest alongside the file'],
['Long-term storage','Release artifacts go to a registry, not just the CI artifact store']]},
{note:'CI artifact storage is temporary working space. Anything you must keep as a release belongs in a package or container registry.'}],
src:[['Storing workflow data as artifacts',K.GH+'writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow']]};

/* ---------- 5 ---------- */
L['devops:3:5']={blocks:[
{p:'A **cache** stores files that are expensive to fetch or compute (downloaded dependencies, compiled objects) so later runs can reuse them. It is a speed optimisation, not a storage of results.'},
{t:[['','Cache','Artifact'],
['Purpose','Speed up repeated work','Pass or keep an output'],
['If missing','Pipeline still works, slower','Pipeline fails or is wrong'],
['Keyed by','Content such as a lock file hash','Job or run'],
['Lifetime','Evicted automatically','Retained for a set time']]},
{h:'Cache keys'},
{p:'A good key changes exactly when the cached content should change.'},
{code:`# Key built from the lock file: new key when dependencies change
key: deps-\${{ runner.os }}-\${{ hashFiles('package-lock.json') }}
# Fallback to the most recent compatible cache
restore-keys: |
  deps-\${{ runner.os }}-`},
{h:'Pitfalls'},
{ul:['A key that never changes serves **stale** dependencies.','A key that always changes never hits the cache.','Do not cache secrets or anything that should differ per run.','Caches can be poisoned by untrusted pull requests. Restrict who can write to the cache used for releases.']},
{note:'Always make the pipeline correct **without** a cache. Treat a cache hit as a bonus, never a requirement.'}],
src:[['Dependency caching',K.GH+'writing-workflows/choosing-what-your-workflow-does/caching-dependencies-to-speed-up-workflows']]};

/* ---------- 6 ---------- */
L['devops:3:6']={blocks:[
{p:'Pipeline duration is the delay between a developer\'s change and feedback. Three techniques shorten it: run independent work **in parallel**, test **several variants** with a matrix, and **avoid doing work** that is not needed.'},
{svg:matrix},
{h:'Techniques'},
{t:[['Technique','Use when','Watch for'],
['**Parallel jobs**','Steps do not depend on each other (lint, unit tests, build)','Runner capacity and queueing'],
['**Matrix**','Same job across versions or operating systems','Combinatorial explosion in cost'],
['**Test sharding**','One suite is long; split it across workers','Even split, merged reports'],
['**Path filters**','Only run docs checks when docs change','Missing a dependency between paths'],
['**Caching**','Dependencies and build outputs repeat','Correctness without the cache'],
['**Fail fast**','Cheapest checks first, cancel on failure','Debug value of seeing all failures']]},
{h:'Measure first'},
{p:'Look at where time actually goes before optimising. Many pipelines spend most of their time in a single step (dependency install, one slow test file) or in **queue time** waiting for a runner.'},
{note:'A common target is under ten minutes from push to result for the main checks. Beyond that, developers start context switching and batching changes.'}]};

/* ---------- 7 ---------- */
L['devops:3:7']={blocks:[
{p:'**Configuration** that differs between environments (URLs, feature switches, credentials) must live **outside** the code and the image, so the same artifact runs everywhere.'},
{t:[['Kind','Example','Where it lives'],
['Plain configuration','`LOG_LEVEL=info`, API base URL','Pipeline variables or environment config'],
['Sensitive value','Database password, API key, signing key','Secret store of the platform or a secret manager'],
['Build-time value','Version, commit SHA','Computed in the pipeline']]},
{h:'Rules for secrets in pipelines'},
{ul:['Never commit secrets to the repository, even in a private one.','Use the platform\'s secret storage, and **mask** values in logs (masking is a safety net, not protection).','Never bake secrets into images or artifacts.','Pass secrets only to the steps that need them, not to the whole job.','Prefer **short-lived credentials** (OIDC) to stored keys.']},
{code:`# GitHub Actions: a secret exposed only to one step
- name: Deploy
  env:
    API_TOKEN: \${{ secrets.API_TOKEN }}
  run: ./deploy.sh`},
{note:'Any code that runs in a job can read the job\'s secrets. A third-party action or a pull request from a fork must be treated as untrusted. Section 6 and Section 15 return to this in depth.'}],
src:[['Using secrets in GitHub Actions',K.GH+'security-for-github-actions/security-guides/using-secrets-in-github-actions']]};

/* ---------- 8 ---------- */
L['devops:3:8']={blocks:[
{p:'**Pipeline as code** means the pipeline definition is a file stored in the repository next to the application, not a set of options clicked into a web console.'},
{t:[['Aspect','Defined in a UI','Pipeline as code'],
['History','None or partial','Full Git history'],
['Review','Not reviewed','Reviewed in pull requests'],
['Branches','One definition for all','Changes with the branch, testable before merging'],
['Recovery','Rebuild by hand','Recreate from the repository'],
['Reuse','Copy and paste','Templates and shared libraries']]},
{h:'File names by platform'},
{t:[['Platform','File'],
['GitHub Actions','`.github/workflows/*.yml`'],
['GitLab CI/CD','`.gitlab-ci.yml`'],
['Jenkins','`Jenkinsfile`']]},
{h:'Practices'},
{ul:['Review pipeline changes like application changes, and protect them with CODEOWNERS.','Keep logic in **scripts** you can run locally, and let the pipeline call them. Pipelines then stay short and portable.','Validate the pipeline syntax in an editor and in a pull request check.']},
{note:'A useful test of a good pipeline: can a developer run the same build and test commands locally with one script? If only CI can do it, debugging will be slow.'}]};

/* ---------- 9 ---------- */
L['devops:3:9']={blocks:[
{p:'Write the simplest useful pipeline for the sample app: on every push and pull request, install dependencies, run the tests and upload the build output.'},
{flow:['Check out the code','Set up the language runtime','Install with the lock file','Run tests','Build','Upload the output as an artifact']},
{code:`# .github/workflows/ci.yml
name: ci
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist-\${{ github.sha }}
          path: dist/`},
{h:'Check the result'},
{ul:['Does the run start when you open a pull request?','Does a failing test turn the check red and block merging (with branch protection)?','Is the artifact named with the commit SHA?','How long did it take, and which step was slowest?']},
{note:'The same logic in GitLab CI/CD and Jenkins appears in Sections 7 and 8. The vocabulary from this section maps one-to-one.'}]};
})();
