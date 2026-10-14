/* LearnSphere - DevOps & CI/CD, Section 11: Continuous Delivery & Deployment Strategies.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const promo=K.dg(700,200,[
[10,10,680,180,'Promotion path with increasing confidence',1],
[25,70,100,60,'Dev|fast, unstable',0],[155,70,100,60,'Test|automated',0],[285,70,110,60,'Staging|production-like',0],[425,70,110,60,'Production|real users',2],[565,70,110,60,'Verify and|observe',0]],
[[125,100,155,100],[255,100,285,100],[395,100,425,100],[535,100,565,100]]);

const rolling=K.dg(700,220,[
[10,10,680,200,'Rolling update: replace instances gradually',1],
[30,50,90,40,'v1',0],[130,50,90,40,'v1',0],[230,50,90,40,'v1',0],[330,50,90,40,'v1',0],
[30,110,90,40,'v2',2],[130,110,90,40,'v2',2],[230,110,90,40,'v1',0],[330,110,90,40,'v1',0],
[30,165,90,30,'v2',2],[130,165,90,30,'v2',2],[230,165,90,30,'v2',2],[330,165,90,30,'v2',2],
[470,70,200,100,'At any time most|instances serve traffic.|No extra capacity needed,|but two versions run|together briefly.',0]],
[[75,90,75,110],[75,150,75,165]]);

const bg=K.dg(700,220,[
[10,10,680,200,'Blue/green: switch traffic between two full environments',1],
[30,80,110,60,'Users',0],[200,80,110,60,'Router or|load balancer',2],
[400,40,150,50,'Blue: v1 (live)',0],[400,130,150,50,'Green: v2 (idle, tested)',0],
[590,80,80,60,'Switch back|if needed',0]],
[[140,110,200,110],[310,110,400,65],[310,110,400,155]]);

const canary=K.dg(700,220,[
[10,10,680,200,'Canary: widen exposure as health holds',1],
[30,80,100,60,'Users',0],[180,80,110,60,'Traffic split',2],
[360,40,150,50,'Stable v1: 95%',0],[360,130,150,50,'Canary v2: 5%',2],
[560,50,110,100,'Watch errors,|latency. Step to|25, 50, 100%',0]],
[[130,110,180,110],[290,110,360,65],[290,110,360,155],[510,155,560,120]]);

/* ---------- 0 ---------- */
L['devops:10:0']={blocks:[
{p:'Both terms release every change that passes the pipeline, but they differ in who presses the button. This is a **business and risk decision**, not a technical measure of maturity.'},
{t:[['','Continuous delivery','Continuous deployment'],
['Release trigger','A person decides when','Automatic after the pipeline passes'],
['Always releasable?','Yes','Yes, and released'],
['Good fit','Regulated environments, coordinated launches, mobile app stores','Web services and internal systems with strong automation'],
['Requires','Reliable deployment automation','Excellent tests, monitoring, fast rollback, feature flags']]},
{h:'Prerequisites for continuous deployment'},
{ul:['Automated tests that you trust to catch regressions.','Deployment that is **repeatable and safe**: progressive rollout and automatic rollback.','Monitoring that detects a bad release within minutes.','Decoupling of **deploy** from **release** with feature flags.']},
{h:'A sensible path'},
{flow:['Automate the build and tests','Automate deployment to a test environment','Automate deployment to staging','Make production deployment one click (delivery)','Remove the click as confidence grows (deployment)']},
{note:'You can practise continuous deployment for some services and continuous delivery for others. The decision is per service, based on risk.'}],
src:[['DORA: continuous delivery',K.DORA+'capabilities/continuous-delivery/']]};

/* ---------- 1 ---------- */
L['devops:10:1']={blocks:[
{p:'**Environments** are separate places where the application runs, each with a purpose. A **promotion path** defines the order a build moves through and what must be true to advance.'},
{svg:promo},
{t:[['Environment','Purpose','Data','Who uses'],
['Development','Integration and experiments','Synthetic','Developers'],
['Test / QA','Automated and manual testing','Synthetic or masked','Testers, pipelines'],
['Staging / pre-production','Final verification in a production-like setup','Masked copy','Release team'],
['Production','Real users','Real','Everyone']]},
{h:'Principles'},
{ul:['**Same artifact, different configuration** in every environment.','Keep environments **as similar to production as practical** (same deployment method, same versions of dependencies).','Define promotion rules: required checks, approvals, soak time.','Keep the number small. Every environment is cost and maintenance.']},
{note:'Environment parity is most valuable in the **deployment method**. If staging deploys with one script and production with a different tool, staging proves little about production.'}]};

/* ---------- 2 ---------- */
L['devops:10:2']={blocks:[
{p:'The pipeline\'s last job delivers to a **target**. The target type decides what "deploy" means and which risks matter.'},
{t:[['Target','What deployment means','Typical tool','Watch for'],
['**Virtual machines**','Install or replace a package or image on servers','Ansible, scripts, image baking','Drift, ordering, load balancer draining'],
['**Containers**','Start new container versions','Docker, ECS, Container Apps','Image pulls, health checks'],
['**Kubernetes**','Apply declarative manifests; the cluster converges','kubectl, Helm, Argo CD, Flux','Probes, resource limits, rollout status'],
['**Serverless**','Publish a new function version and shift an alias','SAM, Serverless, cloud CLIs','Cold starts, versions and aliases'],
['**Static sites and CDN**','Upload files and invalidate cache','Object storage, CDN','Cache invalidation']]},
{h:'What stays the same'},
{ul:['Deploy a **named, immutable artifact**.','Provide **configuration** from the environment.','Verify with a **health check**, then monitor.','Have a **rollback** path.']},
{note:'Whatever the target, aim for a deployment that is **declarative and idempotent**: the pipeline states the desired version and the platform makes it so, repeatably.'}]};

/* ---------- 3 ---------- */
L['devops:10:3']={blocks:[
{p:'Two simple strategies: **recreate** stops the old version and starts the new one, and **rolling** replaces instances gradually.'},
{svg:rolling},
{t:[['Strategy','How','Downtime','Extra capacity','Risk'],
['**Recreate**','Stop all old instances, then start new ones','Yes, a gap','None','Simple, but an outage window'],
['**Rolling**','Replace a few instances at a time','No, if health checks work','Small surge','Two versions run together briefly']]},
{code:`# Kubernetes rolling update settings
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0     # never remove capacity first
      maxSurge: 1           # add one new pod at a time
  minReadySeconds: 10`},
{h:'Requirements for rolling'},
{ul:['**Readiness checks** so traffic only reaches ready instances.','Application and database versions that are **compatible** with each other during the overlap.','**Graceful shutdown** so in-flight requests finish.']},
{note:'Use recreate when two versions cannot run side by side, for example an incompatible schema change you cannot make backward compatible, and accept the downtime window.'}],
src:[['Kubernetes Deployments',K.K8S+'concepts/workloads/controllers/deployment/']]};

/* ---------- 4 ---------- */
L['devops:10:4']={blocks:[
{p:'**Blue/green** runs two complete environments. One serves users (blue). You deploy and test the new version in the other (green), then **switch traffic** in one step.'},
{svg:bg},
{t:[['Strength','Cost'],
['Instant cutover and instant rollback by switching back','Double capacity during the release'],
['New version fully tested on production infrastructure before users see it','Data and sessions need care: both versions share a database'],
['No mixed versions serving users','Extra environment to maintain']]},
{flow:['Deploy the new version to the idle environment','Run smoke and verification tests against it','Switch the router or load balancer to it','Monitor closely','Keep the old environment until confident, then reuse it']},
{h:'The database problem'},
{p:'Both colours usually share one database, so schema changes must be **backward compatible**. The switch is easy; the data cannot simply be switched back.'}]};

/* ---------- 5 ---------- */
L['devops:10:5']={blocks:[
{p:'A **canary release** sends a small share of real traffic to the new version first and increases it only while health signals stay good. **Progressive delivery** is this idea generalised: roll out in controlled steps with automated analysis.'},
{svg:canary},
{flow:['Deploy the new version alongside the stable one','Send a small share (for example 5 percent) to it','Compare error rate, latency and business metrics','If healthy, widen to 25, 50 and 100 percent','If not, route everything back and stop']},
{t:[['Technique','How traffic is split'],
['Weighted routing','Load balancer or service mesh weights'],
['By user or cohort','Internal users first, then a region or tier'],
['By header or cookie','Testers opt in explicitly']]},
{h:'What makes it work'},
{ul:['Clear **success metrics** and thresholds decided before the release.','Enough canary traffic for the signal to be statistically meaningful.','Automation to **analyse** and promote or roll back, using tools such as Argo Rollouts or Flagger.','Observability that distinguishes canary from stable traffic.']},
{code:`# Argo Rollouts (excerpt)
strategy:
  canary:
    steps:
      - setWeight: 5
      - pause: { duration: 5m }
      - setWeight: 25
      - pause: { duration: 10m }
      - setWeight: 100`}],
src:[['Argo Rollouts','https://argo-rollouts.readthedocs.io/en/stable/'],['Flagger','https://docs.flagger.app/']]};

/* ---------- 6 ---------- */
L['devops:10:6']={blocks:[
{p:'A **feature flag** is a runtime switch that turns code paths on or off without a deployment. It separates two ideas that are often confused.'},
{t:[['Term','Meaning'],
['**Deploy**','Put the new code into an environment'],
['**Release**','Make the new behaviour available to users']]},
{svg:K.dg(700,180,[
[10,10,680,160,'Decoupled deploy and release',1],
[30,60,180,60,'Deploy code dark|flag off',0],[260,60,160,60,'Enable for staff,|then 1%, 10%, 100%',2],[470,60,200,60,'Instant switch-off|if it misbehaves',0]],
[[210,90,260,90],[420,90,470,90]])},
{code:`// Pseudocode
if (flags.isEnabled('new-checkout', { userId })) {
  return newCheckout(cart);
}
return oldCheckout(cart);`},
{h:'Types of flag'},
{t:[['Type','Lifetime','Example'],
['Release flag','Short','Hide an unfinished feature'],
['Experiment flag','Short','A/B test'],
['Ops flag','Long','Kill switch for a costly path'],
['Permission flag','Long','Premium features']]},
{h:'Manage them'},
{ul:['Give every flag an **owner and a removal date**. Stale flags are technical debt and risk.','Test both states of important flags.','Use a flag service or open standard such as OpenFeature for targeting and audit.']}],
src:[['OpenFeature','https://openfeature.dev/docs/reference/intro']]};

/* ---------- 7 ---------- */
L['devops:10:7']={blocks:[
{p:'Approvals add a human step. They help when a person can **judge something a machine cannot**, and cost delay when they only confirm what the pipeline already proved.'},
{t:[['Approval adds value','Approval mostly adds delay'],
['Business timing: launch coordinated with marketing','Confirming that tests passed'],
['Risk judgement on unusual, high-impact changes','A routine small change with green checks'],
['Regulatory sign-off that requires an accountable person','A rubber stamp from someone who cannot assess it']]},
{h:'Better patterns'},
{ul:['**Automate evidence**: tests, scans and diff size feed the approver or a policy engine.','**Risk-based**: low-risk changes flow automatically, high-risk ones need review.','Approve the **change** in the pull request, not the **deployment**, where possible.','Use **change windows** only for the genuinely risky periods, and keep them short.','Make approval **fast**: a clear owner, notification and an expiry.']},
{flow:['Pipeline gathers evidence (tests, scan, diff, risk score)','Low risk: proceed automatically','High risk: request named approver with the evidence','Approver decides, decision is recorded','Deployment proceeds or stops']},
{note:'Measure approval wait time. If it dominates lead time, the process is the constraint, not the tooling.'}]};

/* ---------- 8 ---------- */
L['devops:10:8']={blocks:[
{p:'When a release goes wrong, you have two choices: **roll back** to the previous version, or **roll forward** with a fix. The right one depends on speed and on whether the change can be reversed.'},
{t:[['','Roll back','Roll forward'],
['Action','Redeploy the previous artifact','Ship a new fix'],
['Speed','Fast and predictable','Depends on diagnosis and a new build'],
['Works when','Previous version is compatible with current data','Cause is understood and small'],
['Risk','Data written by the new version may not fit the old','A rushed fix may add a new bug']]},
{h:'Make rollback boring'},
{ul:['Keep the previous artifact available and deployable by one command.','Deploy by immutable version or digest, so "previous" is unambiguous.','Rehearse rollback regularly.']},
{h:'Safe database changes: expand and contract'},
{flow:['Expand: add the new column or table, keep the old','Deploy code that writes both and reads the new','Backfill existing data','Deploy code that no longer uses the old structure','Contract: remove the old column in a later release']},
{note:'Destructive changes (dropping a column, rewriting data) cannot be undone by redeploying. Separate them from the release and take a backup or snapshot first.'}]};

/* ---------- 9 ---------- */
L['devops:10:9']={blocks:[
{p:'Release the sample app gradually, and let a failing health check trigger an automatic rollback.'},
{flow:['Deploy v2 as a canary at 10 percent of traffic','Pause and run analysis against error rate and latency','Introduce a deliberate failure (an error on a route)','Watch the analysis fail','Observe the rollout abort and traffic return to v1']},
{code:`apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: sample-app }
spec:
  replicas: 5
  strategy:
    canary:
      steps:
        - setWeight: 10
        - analysis:
            templates: [{ templateName: success-rate }]
        - setWeight: 50
        - pause: { duration: 2m }
  selector: { matchLabels: { app: sample-app } }
  template:
    metadata: { labels: { app: sample-app } }
    spec:
      containers:
        - name: app
          image: ghcr.io/acme/sample-app:2.0.0
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata: { name: success-rate }
spec:
  metrics:
    - name: success-rate
      interval: 30s
      failureLimit: 1
      successCondition: result[0] >= 0.99
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_requests_total{app="sample-app",code!~"5.."}[1m]))
            / sum(rate(http_requests_total{app="sample-app"}[1m]))`},
{h:'Check yourself'},
{ul:['Which signal triggered the rollback and how long did it take?','Were any users exposed beyond the canary share?','How would you roll back if the analysis itself were missing?']}]};
})();
