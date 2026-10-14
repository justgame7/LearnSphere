/* LearnSphere - DevOps & CI/CD, Section 01: Introduction & DevOps Foundations.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const roadmap=K.dg(700,200,[
[10,10,680,180,'The learning path',1],
[25,60,100,60,'Foundations|and lab',0],[145,60,100,60,'Git and CI|fundamentals',0],[265,60,100,60,'Platforms:|Actions, GitLab,|Jenkins',0],[385,60,100,60,'Artifacts,|tests, release|strategies',0],[505,60,80,60,'GitOps,|IaC,|security',0],[600,60,80,60,'Operate and|platform',2]],
[[125,90,145,90],[245,90,265,90],[365,90,385,90],[485,90,505,90],[585,90,600,90]]);

const wall=K.dg(700,200,[
[10,10,680,180,'The wall between teams',1],
[30,60,140,70,'Developers|want change|and speed',0],[280,50,140,90,'The wall|tickets, handoffs,|release weekends',2],[530,60,140,70,'Operations|want stability|and control',0]],
[[170,95,280,95],[420,95,530,95]]);

const loop=K.dg(700,220,[
[10,10,680,200,'The DevOps loop',1],
[30,50,100,50,'Plan',0],[160,50,100,50,'Code',0],[290,50,100,50,'Build and test',0],[420,50,100,50,'Release',0],
[550,50,100,50,'Deploy',0],[420,140,100,50,'Operate',0],[290,140,100,50,'Monitor',0],[160,140,100,50,'Learn',2]],
[[130,75,160,75],[260,75,290,75],[390,75,420,75],[520,75,550,75],[600,100,520,165],[420,165,390,165],[290,165,260,165]]);

const stream=K.dg(700,200,[
[10,10,680,180,'One change, idea to production',1],
[25,70,90,60,'Idea',0],[135,70,90,60,'Code and|review',0],[245,70,90,60,'Build and|test',0],[355,70,90,60,'Approve|and release',0],[465,70,90,60,'Deploy',0],[575,70,100,60,'In use,|feedback',2]],
[[115,100,135,100],[225,100,245,100],[335,100,355,100],[445,100,465,100],[555,100,575,100]]);

const pyramid=K.dg(700,220,[
[10,10,680,200,'Pipeline stages ordered by cost of waiting',1],
[40,50,200,50,'Lint, unit tests|seconds to minutes',2],[40,110,200,50,'Integration tests|minutes',0],
[300,50,170,50,'Package and scan',0],[300,110,170,50,'Deploy to staging',0],
[530,50,140,50,'Smoke tests',0],[530,110,140,50,'Release',0]],
[[240,75,300,75],[470,75,530,75],[140,100,140,110],[385,100,385,110],[600,100,600,110]]);

/* ---------- 0: Course overview ---------- */
L['devops:0:0']={blocks:[
{p:'This course takes you from **a working knowledge of Git and the command line** to designing, securing and operating the delivery pipelines of a production team. It is built around one idea: every change should travel from commit to production by the same automated, observable, reviewable path.'},
{svg:roadmap},
{h:'Who this course is for'},
{ul:['Developers who want to own how their code is built, tested and shipped.','System administrators and operations engineers moving toward automation.','Engineers who maintain CI/CD platforms, runners or deployment tooling.','Anyone preparing for platform exams such as the **CNCF GitOps Associate (CGOA)**. The course is informed by its objectives and by the **DORA** research programme, but is not limited to them.']},
{h:'What you will be able to do'},
{ul:['Design pipelines that are fast, reproducible and safe, on GitHub Actions, GitLab CI/CD or Jenkins.','Build once and promote the same artifact through environments.','Release with rolling, blue/green and canary strategies and roll back deliberately.','Deliver to Kubernetes with GitOps and manage infrastructure from pipelines.','Secure the software supply chain: scanning, SBOMs, signing and short-lived credentials.','Measure delivery with DORA metrics and operate the platform as a product.']},
{h:'The sections at a glance'},
{t:[['Sections','Theme','Outcome'],
['1 to 2','Foundations and lab','Shared vocabulary and a working toolchain'],
['3 to 4','Git workflows and CI fundamentals','A first pipeline that builds and tests'],
['5 to 8','GitHub Actions, GitLab CI/CD, Jenkins','Fluent in each platform, with security and administration'],
['9 to 11','Artifacts, testing, delivery strategies','Build once, gate quality, release safely'],
['12 to 13','GitOps and infrastructure automation','Declarative delivery and pull-request driven infrastructure'],
['14 to 15','Supply chain and secrets','Trustworthy builds and no long-lived credentials'],
['16 to 17','Observability, metrics, platform operations','Measure, respond and run CI/CD as a product'],
['18','Production readiness and capstone','Everything combined end to end']]},
{h:'How lectures are tagged'},
{p:'Every lecture ends with a tag in its description so you know which platform it needs. Concepts are taught tool-neutrally first, then shown on each platform.'},
{t:[['Tag','Meaning','Needs'],
['**Any**','The idea applies to every platform','Nothing special'],
['**GitHub**','Specific to GitHub and GitHub Actions','A GitHub account'],
['**GitLab**','Specific to GitLab CI/CD','A GitLab account or instance'],
['**Jenkins**','Specific to Jenkins','A Jenkins controller you can run locally']]},
{h:'Prerequisites self-check'},
{t:[['Skill','Quick test'],
['Git basics','You can clone, commit, branch and push'],
['Linux shell','You can run commands, read exit codes and set environment variables'],
['Containers','You know what a Docker image and container are (see the Docker course)'],
['One programming language','You can read a small application and its tests']]},
{note:'Practice matters more than reading. From Section 2 onward, keep the sample repository open and run every example on a free tier or locally.'}],
src:[['DORA research',K.DORA],['OpenGitOps principles',K.OGO]]};

/* ---------- 1: What DevOps is ---------- */
L['devops:0:1']={blocks:[
{p:'**DevOps** is a set of cultural habits and technical practices that let one team build, ship and run software together, so changes reach users quickly and safely. It is not a job title, a tool or a team that sits between developers and operations.'},
{svg:wall},
{h:'The problem it grew out of'},
{p:'Traditionally developers were rewarded for **change** and operations for **stability**. Each side optimised its own goal, so the handoff between them became slow and risky: large releases, manual runbooks and blame when something failed.'},
{t:[['Symptom','Cause','DevOps response'],
['Releases once a quarter','Big batches, manual steps','Small, frequent, automated changes'],
['It works on my machine','Different environments','Same build and environment definition everywhere'],
['Deploys happen at night','Risky, hard to roll back','Safe deploys any time, with fast rollback'],
['Outages are blamed on people','Hidden system weaknesses','Blameless learning and shared ownership']]},
{h:'The loop'},
{svg:loop},
{h:'Practices, not tools'},
{ul:['**Shared ownership**: the team that builds a service also helps run it.','**Automation**: build, test, deploy and provision without manual steps.','**Small batches**: many small changes are easier to review and revert than a few huge ones.','**Fast feedback**: tests, monitoring and users tell you quickly if a change was good.','**Measurement**: use data such as the DORA metrics to improve, not to blame.']},
{note:'Tools support the practices but cannot replace them. A team with excellent pipelines and a blame culture still ships slowly.'}],
src:[['DORA capabilities',K.DORA+'capabilities']]};

/* ---------- 2: Delivery lifecycle and value stream ---------- */
L['devops:0:2']={blocks:[
{p:'The **software delivery lifecycle** is the path one change takes from idea to running in production. A **value stream** is that path viewed as a sequence of steps with the time spent *working* and the time spent *waiting* at each one.'},
{svg:stream},
{h:'Lead time is mostly waiting'},
{p:'Teams are often surprised that the actual work (writing code, running tests) is a small share of the total. Most of the time a change sits in a queue: waiting for review, for a build agent, for an approval, for a release window.'},
{t:[['Step','Typical work time','Typical wait'],
['Code review','20 minutes','Hours to days until a reviewer is free'],
['Build and test','10 minutes','Minutes in a runner queue'],
['Approval','5 minutes','Days until the approver responds'],
['Deploy','5 minutes','Until the next release window']]},
{h:'Finding the constraint'},
{flow:['Draw the steps a change goes through','Record work time and wait time for each','Find the step with the longest wait','Remove or shorten that wait (automate, parallelise, delegate)','Measure again and repeat']},
{p:'Improving anything other than the constraint does not shorten the total. Faster tests do not help if changes then wait three days for approval.'},
{note:'Two measures matter: **lead time** (commit to production) and **flow efficiency** (work time divided by total time). Low flow efficiency points straight to the queues.'}],
src:[['DORA value stream',K.DORA+'capabilities/']]};

/* ---------- 3: CI, CD, CD defined ---------- */
L['devops:0:3']={blocks:[
{p:'The three terms are often mixed up. Each one adds a further guarantee on top of the previous one.'},
{svg:K.row(['Continuous|integration','Continuous|delivery','Continuous|deployment'],-1,'Each term builds on the one before')},
{t:[['Term','What it guarantees','Human step'],
['**Continuous integration (CI)**','Every change is merged often and built and tested automatically; the main branch stays working','Review before merge'],
['**Continuous delivery**','Every change that passes is always **ready** to release; releasing is one deliberate action','A person chooses when to release'],
['**Continuous deployment**','Every change that passes is **released automatically** to production','None after merge']]},
{h:'What each one requires'},
{ul:['CI needs fast automated tests and a team habit of merging small changes at least daily.','Continuous delivery needs a repeatable deployment, automated environments and release confidence.','Continuous deployment needs strong tests, monitoring and automatic rollback, because no person is watching each release.']},
{h:'Common misuses'},
{t:[['Claim','Reality'],
['We do CI because we have Jenkins','CI is the practice of merging often. A tool alone does not provide it'],
['Feature branches live for weeks, but they are built','Long-lived branches defeat integration'],
['We do CD but release needs a three-week manual test','Not ready to release at any time, so not continuous delivery']]},
{note:'Both continuous delivery and continuous deployment are abbreviated CD. In this course, **delivery** means ready to release and **deployment** means released automatically.'}],
src:[['DORA: continuous integration',K.DORA+'capabilities/continuous-integration/'],['DORA: continuous delivery',K.DORA+'capabilities/continuous-delivery/']]};

/* ---------- 4: DORA metrics ---------- */
L['devops:0:4']={blocks:[
{p:'The **DORA** research programme found that a small set of measures distinguishes high-performing delivery teams. Four are widely used: two for **throughput** (how fast) and two for **stability** (how safe).'},
{t:[['Metric','Measures','Group'],
['**Deployment frequency**','How often you deploy to production','Throughput'],
['**Lead time for changes**','Time from commit to running in production','Throughput'],
['**Change failure rate**','Share of deployments that cause a failure needing a fix or rollback','Stability'],
['**Time to restore service** (failed deployment recovery time)','How long it takes to recover from a failed change','Stability']]},
{h:'Read them together'},
{p:'The key finding is that speed and stability are **not a trade-off**. Teams that deploy more often also tend to fail less and recover faster, because their changes are small and well understood.'},
{svg:K.dg(700,180,[
[10,10,680,160,'Throughput and stability move together in high performers',1],
[40,60,180,70,'Small frequent changes',0],[260,60,180,70,'Easier to test, review|and revert',0],[480,60,190,70,'Fewer failures,|faster recovery',2]],
[[220,95,260,95],[440,95,480,95]])},
{h:'How to use them'},
{ul:['Measure at the **team or service** level, from real deployment and incident data.','Track the trend over months. A single number has little meaning.','Use them to find constraints, never to rank people or compare unrelated teams.']},
{note:'When a measure becomes a target it gets gamed. If people are rewarded for deployment frequency, expect trivial deployments. Pair every throughput metric with a stability metric.'}],
src:[['DORA metrics',K.DORA+'guides/dora-metrics/']]};

/* ---------- 5: Roles ---------- */
L['devops:0:5']={blocks:[
{p:'Job titles vary between companies and the same person often does parts of several. What matters is the **responsibility** behind each title.'},
{t:[['Role','Primary focus','Typical outputs'],
['**DevOps engineer**','Connect development and operations: pipelines, environments, automation','CI/CD pipelines, deployment tooling, infrastructure code'],
['**Site reliability engineer (SRE)**','Reliability of running services using engineering and data','SLOs, alerting, capacity plans, incident response, automation of toil'],
['**Platform engineer**','Build an internal platform other teams use','Golden paths, templates, self-service infrastructure'],
['**Release engineer**','Reliable, repeatable release process','Versioning, packaging, release trains, hotfix process']]},
{h:'Where they overlap'},
{svg:K.dg(700,180,[
[10,10,680,160,'Shared ground',1],
[30,60,140,70,'DevOps|engineer',0],[200,60,140,70,'Release|engineer',0],[370,60,140,70,'SRE',0],[540,60,130,70,'Platform|engineer',0]],
[[170,95,200,95],[340,95,370,95],[510,95,540,95]])},
{p:'All four care about pipelines and automation. The difference is the question each answers: *how do we ship* (DevOps, release), *how do we keep it running* (SRE), *how do we make this easy for everyone* (platform).'},
{h:'How the course maps to them'},
{t:[['Role','Most relevant sections'],
['DevOps engineer','3 to 13 (workflows, platforms, delivery, GitOps)'],
['SRE','16 and 18 (observability, SLOs, incidents)'],
['Platform engineer','8, 17 and 18 (runners, templates, platform product)'],
['Security-minded roles','14 and 15 (supply chain, secrets)']]}],
src:[['Google SRE book',K.SRE]]};

/* ---------- 6: Toolchain landscape ---------- */
L['devops:0:6']={blocks:[
{p:'There are many tools, but they fall into a small number of **categories** that mirror the delivery lifecycle. Learn the categories first; products within a category are largely interchangeable.'},
{t:[['Category','Purpose','Examples'],
['Source control','Store and review code','Git with GitHub, GitLab, Bitbucket'],
['CI/CD orchestration','Run build, test and deploy workflows','GitHub Actions, GitLab CI/CD, Jenkins, CircleCI'],
['Build and package','Produce artifacts','Maven, Gradle, npm, Docker, BuildKit'],
['Artifact storage','Hold build outputs','Container registries, Artifactory, Nexus'],
['Quality and security','Test and scan','SonarQube, Trivy, Snyk, Checkov'],
['Infrastructure','Provision and configure','Terraform, Ansible, Pulumi'],
['Deploy and orchestrate','Run workloads','Kubernetes, Argo CD, Flux, Helm'],
['Observe','See what is happening','Prometheus, Grafana, OpenTelemetry, logging platforms'],
['Incident and collaboration','Respond and communicate','PagerDuty, Opsgenie, chat and ticketing tools']]},
{svg:K.row(['Source','CI/CD','Artifacts','Deploy','Observe'],-1,'Categories along the delivery path')},
{h:'Choosing without regret'},
{ul:['Prefer tools that keep your configuration **in files** you can review and move.','Prefer open formats (containers, OpenTelemetry, OCI, SBOM standards) over proprietary ones.','Each added tool is something to secure, upgrade and learn. Add one only for a clear need.']}],
src:[['CNCF landscape','https://landscape.cncf.io/']]};

/* ---------- 7: Principles ---------- */
L['devops:0:7']={blocks:[
{p:'Whatever the tool, healthy pipelines follow the same handful of rules. Each rule exists because breaking it produces a predictable kind of pain.'},
{t:[['Principle','Meaning','What breaks without it'],
['**Fast feedback**','Developers learn within minutes whether a change works','People batch work, avoid running checks and merge less often'],
['**Small batches**','Ship small changes frequently','Large changes are hard to review and risky to release'],
['**Automation**','No manual steps in the normal path','Mistakes, delays and knowledge held by one person'],
['**Idempotency**','Running a step twice gives the same result as once','Retries cause duplicates and half-applied changes'],
['**Build once, promote**','The same artifact moves through every environment','What you tested is not what you deploy'],
['**Everything as code**','Pipelines and infrastructure live in version control','Undocumented, unreviewed and irreproducible changes'],
['**Visibility**','Status and history are visible to everyone','Failures are noticed late and nobody knows why']]},
{svg:pyramid},
{h:'Fast feedback in practice'},
{p:'Order checks so the **cheapest and fastest** run first. A formatting error should fail in seconds, not after a twenty-minute integration suite.'},
{h:'Idempotency in practice'},
{code:`# Not idempotent: fails or duplicates on a second run
mkdir release && echo v1 > release/version

# Idempotent: safe to run any number of times
mkdir -p release && echo v1 > release/version`},
{note:'When a pipeline step is not idempotent, a retry after a network blip can leave a deployment half done. Design every step so that running it again is harmless.'}],
src:[['DORA capabilities',K.DORA+'capabilities']]};
})();
