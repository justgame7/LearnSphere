/* LearnSphere - DevOps & CI/CD, Section 18: Production Readiness & Capstone.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const ref=K.dg(700,330,[
[10,10,680,310,'Reference architecture: commit to production',1],
[25,50,110,50,'Developer|branch and PR',0],[155,50,120,50,'Protected main|review, checks',0],[295,50,110,50,'CI|build, test',0],[425,50,110,50,'Scan, SBOM|sign, attest',2],[555,50,115,50,'Registry|digest',0],
[155,150,140,50,'Config repo|desired state',0],[320,150,140,50,'GitOps agent|pulls, reconciles',2],[485,150,130,50,'Kubernetes|staging, prod',0],
[155,250,130,45,'Policy|admission verify',0],[320,250,140,45,'Observability|SLOs, DORA',0],[485,250,130,45,'Alert, rollback|incident',0]],
[[135,75,155,75],[275,75,295,75],[405,75,425,75],[535,75,555,75],[610,100,610,125],[610,125,225,125],[225,125,225,150],[295,175,320,175],[460,175,485,175],[550,200,550,225],[550,225,390,225],[390,225,390,250],[285,272,320,272],[460,272,485,272]]);

const baseline=K.dg(700,200,[
[10,10,680,180,'Baseline controls',1],
[25,60,150,60,'Identity|SSO, MFA, least privilege',0],[200,60,150,60,'Source|protection, review',0],[375,60,150,60,'Build|pinned, isolated',0],[550,60,125,60,'Artifact|signed, verified',2]],
[[175,90,200,90],[350,90,375,90],[525,90,550,90]]);

const method=K.dg(700,200,[
[10,10,680,180,'Troubleshooting loop',1],
[25,70,100,60,'Observe|the symptom',0],[155,70,100,60,'Locate|the stage',0],[285,70,100,60,'Compare|to last green',0],[415,70,100,60,'Hypothesis|and test',2],[545,70,125,60,'Fix, verify,|prevent',0]],
[[125,100,155,100],[255,100,285,100],[385,100,415,100],[515,100,545,100]]);

/* ---------- 0 ---------- */
L['devops:17:0']={blocks:[
{p:'Before teams rely on a pipeline for production, check it against a short list. A pipeline that ships software is itself a production system.'},
{t:[['Area','Check'],
['**Security**','Least-privilege tokens, no stored cloud keys (OIDC), actions pinned, secrets scoped to environments, branch protection with no bypass'],
['**Quality**','Required checks (tests, lint, scan), reviewed pull requests, coverage floor on new code'],
['**Artifact integrity**','Build once, immutable digest, SBOM, signature, provenance, verified at deploy'],
['**Delivery**','Environments with promotion rules, progressive rollout, automated rollback, documented manual rollback'],
['**Reliability**','Runner capacity and autoscaling, timeouts, platform SLOs and alerts, backups of controller and config'],
['**Observability**','Pipeline metrics, deployment events, DORA metrics, logs retained'],
['**Governance**','Audit trail, separation of duties, owners for every pipeline, documented exceptions'],
['**Cost**','Budgets and alerts, retention rules, usage visible per team'],
['**Operations**','Runbooks, on-call, upgrade plan for platform and plugins']]},
{note:'Treat the checklist as a living document. Each incident should add or sharpen an item.'}]};

/* ---------- 1 ---------- */
L['devops:17:1']={blocks:[
{p:'This reference design combines the course\'s tools and controls. Replace any box with your platform of choice. The **controls**, not the product names, are the point.'},
{svg:ref},
{t:[['Stage','Controls'],
['Source','Protected main, required reviews and CODEOWNERS, secret scanning, signed commits optional'],
['CI','Ephemeral runners, pinned actions, least-privilege token, tests, lint, SAST, SCA'],
['Artifact','Build once, scan image, SBOM, cosign signature, provenance, push by digest'],
['Config','Separate repository, pull request promotion between environments'],
['Delivery','GitOps agent pulls, progressive rollout, policy admission verifies signature'],
['Operate','SLOs, burn-rate alerts, automated verification and rollback, DORA metrics']]},
{flow:['Developer opens a pull request','Checks and review pass, change merges','CI builds one image and publishes by digest','Pipeline scans, signs and attests the digest','A config pull request updates the staging overlay','Agent deploys; verification passes','Promotion pull request updates production','Observability confirms health or rolls back']}]};

/* ---------- 2 ---------- */
L['devops:17:2']={blocks:[
{p:'Whatever you build, a **minimum baseline** applies. These controls are low cost and prevent the most common failures.'},
{svg:baseline},
{t:[['Control','Minimum'],
['Accounts','SSO or two-factor on every account with pipeline access'],
['Branches','Main protected: pull request, review, required checks, no force push, no bypass'],
['Pipeline permissions','Read-only default token. Grant per job'],
['Secrets','No secrets in code. Scanned, scoped and rotated. OIDC for cloud'],
['Third-party code','Actions and plugins pinned and reviewed. Dependencies locked and scanned'],
['Runners','Ephemeral where possible. No untrusted code on privileged runners'],
['Artifacts','Immutable versions. Signed. Deployed by digest'],
['Logging','Audit logs retained. Pipeline logs free of secrets'],
['Recovery','Pipeline definitions in Git. Platform configuration backed up']]},
{h:'Where to start'},
{flow:['Turn on MFA and branch protection','Set read-only default permissions','Add secret scanning and dependency updates','Move cloud access to OIDC','Pin actions and add image scanning','Add signing and verification']}]};

/* ---------- 3 ---------- */
L['devops:17:3']={blocks:[
{p:'Your delivery platform can fail. If it is the only way to ship, an outage during an incident means you cannot deploy the **fix**. Plan for that.'},
{t:[['Component','What to protect','How'],
['**Controller or server** (Jenkins, self-managed GitLab)','Configuration, jobs, credentials','Regular backups, tested restore, configuration as code'],
['**Runners**','Nothing unique, ideally','Rebuild from images; treat as disposable'],
['**Secrets**','Keys and tokens','Secret manager with backup and break-glass access'],
['**Artifact storage and registries**','Images and packages','Replication, backups, retention for rollback'],
['**Pipeline definitions**','The logic of delivery','In Git, mirrored if the host is the only copy'],
['**State** (Terraform and others)','Infrastructure records','Versioned backend with backup']]},
{h:'Break-glass'},
{ul:['Document a **manual deployment path** that works without the CI system, using a trusted artifact and approved credentials.','Protect it, log its use and review every use afterwards.','Rehearse it. A procedure never tested will not work during an incident.']},
{h:'Recovery targets'},
{t:[['Term','Meaning'],
['**RTO**','How long the platform may be down'],
['**RPO**','How much configuration or data loss is acceptable']]},
{note:'Using a hosted platform shifts operations to the vendor but not your dependency. Know what you will do if GitHub or GitLab itself is down.'}]};

/* ---------- 4 ---------- */
L['devops:17:4']={blocks:[
{p:'A platform people cannot understand is a platform people work around. Documentation, runbooks and onboarding turn the platform into something teams can **adopt and operate**.'},
{t:[['Document','Audience','Contents'],
['**Getting started**','New teams','Create a service, first pipeline, first deployment'],
['**How-to guides**','Developers','Add a secret, add a stage, roll back, add a dependency scan'],
['**Reference**','Everyone','Template inputs, runner labels, policies, limits'],
['**Runbooks**','On-call','Symptom, checks, mitigation, escalation'],
['**Architecture and decisions**','Maintainers','Diagrams and decision records']]},
{h:'A good runbook'},
{code:`Title:     Queue time above 10 minutes
Impact:    Developers wait; releases delayed
Check:     Dashboard "Runners". Is maxRunners reached? Is the controller healthy?
Mitigate:  Raise maxRunners to 40, then check cloud quota
Escalate:  platform-oncall after 30 minutes
After:     Open a ticket to tune autoscaling`},
{h:'Onboarding teams'},
{ul:['Provide a **guided path** with a checklist and a working example repository.','Offer **office hours** or a support channel and respond quickly.','Keep documentation **next to the code** so it is updated with it, and test the examples.','Gather feedback from each onboarding and fix the top friction.']}]};

/* ---------- 5 ---------- */
L['devops:17:5']={blocks:[
{p:'Failing pipelines are routine. A **method** replaces guessing and works across GitHub Actions, GitLab CI/CD and Jenkins.'},
{svg:method},
{flow:['Read the exact error and the failing step, not the red icon','Classify: code, test, configuration, environment, credentials, platform','Compare with the last green run: what changed in code, config, dependencies, runner image?','Reproduce locally or with a debug re-run if possible','Change one thing and test the hypothesis','Fix, verify, and add a guard so it cannot recur']},
{t:[['Symptom','Likely cause','First check'],
['Fails after a dependency update','New version incompatible','Lock file diff, pin the previous version'],
['Works locally, fails in CI','Different environment, missing file, case sensitivity','Runner image, working directory, env variables'],
['Permission denied on push or deploy','Token scope or protected branch','Job permissions and environment rules'],
['Cannot pull image or package','Credentials or rate limit','Registry login step, token expiry'],
['Job stuck waiting','No matching runner','Labels, runner status, queue'],
['Flaky: passes on retry','Test order, timing, shared state','Quarantine, run repeatedly to reproduce'],
['Cache or artifact missing','Key mismatch or expiry','Key construction, retention']]},
{h:'Habits'},
{ul:['Make logs readable: group output, print versions, fail with clear messages.','Add **debug on demand** (a re-run with debug logging, or a manual dispatch input).','Keep a **last green** reference to compare against.']}]};

/* ---------- 6 ---------- */
L['devops:17:6']={blocks:[
{p:'The capstone combines everything: build a protected, tested, scanned, signed and GitOps-delivered pipeline for the sample app, then observe it and recover from a failure.'},
{flow:['Protect main and require checks and review','CI: test, lint, SCA and build with cache','Build once, scan, generate SBOM, push by digest','Sign and attest the digest with OIDC and cosign','Update the config repository by pull request','Argo CD deploys to staging, then production, with canary analysis','Add dashboards, an SLO and an alert','Inject a failure and recover']},
{h:'Acceptance checklist'},
{t:[['Area','Evidence'],
['Source','Direct pushes to main rejected; required checks block a failing change'],
['Build','One image per commit, tagged by SHA, referenced by digest'],
['Security','A vulnerable dependency fails the build; secrets scan blocks a planted token'],
['Integrity','Unsigned image is rejected by policy; signature and provenance verify'],
['Delivery','Config PR promotes staging to production; manual drift is reverted'],
['Observability','Dashboard, SLO, alert and a deployment record exist'],
['Recovery','A bad release is rolled back by revert or automated analysis and postmortem actions are written']]},
{h:'Failure to inject'},
{ul:['Merge a change that makes the new version return errors, and watch analysis stop the rollout.','Revoke the pipeline token and recover by rotating it.','Delete a Deployment by hand and confirm the agent restores it.']},
{note:'Write a short postmortem for your own capstone: what was hard, what you would change and which control caught which problem.'}]};
})();
