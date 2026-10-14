/* LearnSphere - DevOps & CI/CD, Section 16: Observability, DORA Metrics & Incident Response.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const signals=K.dg(700,220,[
[10,10,680,200,'Three signals, three questions',1],
[30,70,190,80,'Metrics|numbers over time|Is something wrong?',0],[255,70,190,80,'Logs|events with detail|What happened?',0],[480,70,190,80,'Traces|path of one request|Where was the time spent?',0]],
[]);

const budget=K.dg(700,220,[
[10,10,680,200,'SLI, SLO and error budget',1],
[30,70,170,70,'SLI|measured, e.g. 99.93%|of requests succeed',0],[265,70,170,70,'SLO|target, e.g. 99.9%|over 30 days',2],[500,70,170,70,'Error budget|0.1% may fail|spend it on change',0]],
[[200,105,265,105],[435,105,500,105]]);

const incident=K.dg(700,200,[
[10,10,680,180,'Incident lifecycle',1],
[25,70,100,60,'Detect',0],[145,70,100,60,'Triage and|declare',0],[265,70,100,60,'Mitigate',2],[385,70,100,60,'Resolve',0],[505,70,80,60,'Postmortem',0],[600,70,75,60,'Follow-up|actions',0]],
[[125,100,145,100],[245,100,265,100],[365,100,385,100],[485,100,505,100],[585,100,600,100]]);

/* ---------- 0 ---------- */
L['devops:15:0']={blocks:[
{p:'**Observability** is how well you can understand what a system is doing from the outside. It is built on three kinds of telemetry, which answer different questions.'},
{svg:signals},
{t:[['Signal','Shape','Strength','Example tools'],
['**Metrics**','Numeric time series','Cheap, good for alerting and trends','Prometheus, CloudWatch, Azure Monitor'],
['**Logs**','Timestamped event records','Rich detail for investigation','Loki, Elasticsearch, cloud logging'],
['**Traces**','A request followed across services','Shows latency and failure location','Jaeger, Tempo, X-Ray, OpenTelemetry']]},
{h:'How they combine'},
{flow:['A metric alert says error rate is up','A dashboard narrows it to one service and version','Traces show which dependency is slow','Logs from that span give the specific error']},
{note:'OpenTelemetry is the open standard for producing all three signals. Use it so you can change backends without re-instrumenting. The Prometheus and Grafana course covers the stack in depth.'}],
src:[['OpenTelemetry','https://opentelemetry.io/docs/'],['Google SRE: monitoring',K.SRE]]};

/* ---------- 1 ---------- */
L['devops:15:1']={blocks:[
{p:'A deployment is not finished when the command exits. It is finished when you have **evidence the new version is healthy**.'},
{t:[['Check','Answers','Where'],
['**Liveness**','Is the process alive? Restart if not','Orchestrator'],
['**Readiness**','Can it serve traffic now? Remove from load balancing if not','Orchestrator'],
['**Startup**','Has a slow start finished?','Orchestrator'],
['**Smoke verification**','Does a basic request work end to end?','Pipeline after deploy']]},
{code:`readinessProbe:
  httpGet: { path: /ready, port: 8080 }
  periodSeconds: 5
  failureThreshold: 3
livenessProbe:
  httpGet: { path: /health, port: 8080 }
  periodSeconds: 10`},
{h:'Good health endpoints'},
{ul:['`/health` (liveness) should check only the process, not dependencies, so a slow database does not cause restart storms.','`/ready` (readiness) may check critical dependencies.','Return the **build version** in a response so verification can confirm the new version is serving.']},
{flow:['Deploy the new version','Wait for rollout and readiness','Run smoke verification','Watch error rate and latency for a short window','Declare success or roll back']}]};

/* ---------- 2 ---------- */
L['devops:15:2']={blocks:[
{p:'Reliability should be a **number you agree on**, not a feeling. Three terms define it.'},
{svg:budget},
{t:[['Term','Meaning','Example'],
['**SLI** (indicator)','A measured proportion of good events','Share of requests served under 300 ms without error'],
['**SLO** (objective)','The target for an SLI over a window','99.9 percent over 30 days'],
['**Error budget**','Allowed unreliability: 100 percent minus the SLO','0.1 percent, about 43 minutes of full outage per 30 days'],
['**SLA**','A contract with consequences, usually looser than the SLO','Credits if below 99.5 percent']]},
{h:'Using the budget'},
{ul:['While budget remains, ship quickly. Failure is acceptable within it.','When it is exhausted, slow down: prioritise reliability work and reduce risky changes.','The budget **settles the debate** between velocity and stability with data.']},
{h:'Choosing SLIs'},
{ul:['Measure what users experience: availability, latency, correctness.','Measure at the **edge** (load balancer or client), not only inside a service.','Start with one or two SLIs per service.']}],
src:[['Google SRE: service level objectives','https://sre.google/sre-book/service-level-objectives/']]};

/* ---------- 3 ---------- */
L['devops:15:3']={blocks:[
{p:'An alert is a request for a human to act. If it does not need action it is noise, and noise trains people to ignore alerts.'},
{t:[['Good alert','Bad alert'],
['Based on a **symptom** users feel (errors, latency, SLO burn)','Based on a cause that may not matter (CPU at 80 percent)'],
['Needs action now and has a **runbook**','Informational or self-resolving'],
['Routed to the **owning team**','Sent to a shared channel nobody owns'],
['Tied to an SLO burn rate','Static threshold without context']]},
{h:'Paging principles'},
{ul:['**Page** only for urgent, user-impacting problems. Everything else becomes a ticket or a dashboard.','Use **burn-rate** alerts: page when the budget is being consumed fast enough to run out soon.','Group related alerts so one incident produces one page.','Review alerts after incidents: remove, tune or fix noisy ones.']},
{h:'On-call basics'},
{t:[['Practice','Reason'],
['Clear rotation and escalation path','No gaps, no single person always paged'],
['Runbooks linked from alerts','Faster, calmer response'],
['Sustainable load: limit pages per shift','Burnout causes mistakes'],
['Handover notes','Continuity across shifts']]}],
src:[['Google SRE: alerting',K.SRE]]};

/* ---------- 4 ---------- */
L['devops:15:4']={blocks:[
{p:'You can compute the four DORA metrics from data your pipeline and incident tools already hold.'},
{t:[['Metric','Data needed','How to compute'],
['**Deployment frequency**','Production deployment events with timestamp','Count successful production deployments per day or week'],
['**Lead time for changes**','Commit time and deployment time for each change','Median of (deployed at - first commit or merge time)'],
['**Change failure rate**','Deployments and which ones caused an incident or rollback','Failed deployments divided by total deployments'],
['**Time to restore service**','Incident start and recovery times linked to a change','Median of (restored at - started at)']]},
{code:`-- Deployment frequency and failure rate from a deployments table
SELECT date_trunc('week', deployed_at) AS week,
       count(*)                          AS deployments,
       avg((caused_failure)::int)        AS change_failure_rate
FROM   deployments
WHERE  environment = 'production' AND status = 'success'
GROUP  BY 1 ORDER BY 1;`},
{h:'Pitfalls'},
{ul:['Define "deployment", "failure" and "lead time start" **once** and apply them consistently.','Use **medians**, because averages are distorted by outliers.','Look at trends per team or service, not a leaderboard.','Do not set the numbers as targets or compare teams that do different kinds of work.','The metrics are an outcome. Improve the **capabilities** behind them (testing, trunk-based work, small batches).']},
{note:'Open source options include Four Keys, Apache DevLake and platform built-in reports. Check that their definitions match yours before comparing numbers.'}],
src:[['DORA metrics',K.DORA+'guides/dora-metrics/'],['Apache DevLake','https://devlake.apache.org/']]};

/* ---------- 5 ---------- */
L['devops:15:5']={blocks:[
{p:'Instead of waiting for a person to notice, the pipeline or rollout controller can **compare health before and after** a release and roll back when it regresses.'},
{flow:['Record baseline error rate and latency before the release','Release progressively (canary or rolling)','Query the metrics for the new version over a window','Compare against thresholds or the baseline','Promote automatically if good, abort and roll back if not']},
{t:[['Signal','Typical threshold'],
['Error rate (5xx)','Not more than baseline plus a small margin'],
['Latency (p95, p99)','Within a percentage of baseline'],
['Saturation (CPU, memory)','No abnormal growth'],
['Business metric','Orders or logins not dropping']]},
{code:`# Argo Rollouts AnalysisTemplate metric (excerpt)
metrics:
  - name: error-rate
    interval: 1m
    failureLimit: 2
    successCondition: result[0] < 0.01
    provider:
      prometheus:
        address: http://prometheus:9090
        query: sum(rate(http_requests_total{status=~"5.."}[2m])) / sum(rate(http_requests_total[2m]))`},
{h:'Pitfalls'},
{ul:['Too little traffic yields no signal. Use synthetic checks or longer windows.','Choose thresholds from real baselines and review them.','Make sure a **rollback is itself safe** (data compatibility) before automating it.']}]};

/* ---------- 6 ---------- */
L['devops:15:6']={blocks:[
{p:'Incidents are inevitable. What differs between teams is how **organised** the response is. Clear roles and severities remove confusion.'},
{svg:incident},
{t:[['Role','Responsibility'],
['**Incident commander**','Coordinates the response, makes decisions, keeps the focus'],
['**Operations / technical lead**','Investigates and applies changes'],
['**Communications lead**','Updates stakeholders and status pages'],
['**Scribe**','Records the timeline for the postmortem']]},
{t:[['Severity','Typical meaning','Response'],
['SEV1','Major outage or data loss','Immediate, all hands, frequent updates'],
['SEV2','Significant degradation','Urgent, on-call team and owners'],
['SEV3','Minor impact, workaround exists','Next business day']]},
{h:'During an incident'},
{ul:['**Mitigate first**: restore service by rollback, failover or disabling a feature. Root cause can wait.','Communicate on a **fixed rhythm** even when there is nothing new.','Keep one channel as the source of truth and avoid side conversations.','Write down decisions and times as you go.']}],
src:[['Google SRE: incident management','https://sre.google/sre-book/managing-incidents/']]};

/* ---------- 7 ---------- */
L['devops:15:7']={blocks:[
{p:'A **blameless postmortem** examines how the system allowed a failure, not who made the mistake. People are far more honest when they are not at risk of punishment, and honest accounts are how teams learn.'},
{t:[['Section','Contents'],
['Summary','What happened, impact, duration'],
['Timeline','Key events with times (detection, response, mitigation)'],
['Contributing factors','Technical and process causes. Use "how did the system allow this" questions'],
['What went well','Things that limited the damage'],
['Action items','Specific, owned, dated follow-up work'],
['Lessons','What others should learn']]},
{h:'Avoid'},
{t:[['Instead of','Write'],
['"Alice deployed a bad config"','"A config change reached production without validation"'],
['"Human error" as a root cause','"What made the error easy to make and hard to catch?"'],
['A single root cause','Several contributing factors']]},
{flow:['Hold the review within days while memory is fresh','Build the timeline from logs and chat','Discuss contributing factors without blame','Agree action items with owners and dates','Publish, track and review progress']},
{note:'A postmortem without tracked follow-up is just a story. Count it as done only when the actions ship.'}],
src:[['Google SRE: postmortem culture','https://sre.google/sre-book/postmortem-culture/']]};

/* ---------- 8 ---------- */
L['devops:15:8']={blocks:[
{p:'Record deployments and failures in the pipeline, then compute two DORA metrics from the data.'},
{flow:['Add a step that records each production deployment with timestamp, SHA and result','Mark deployments that caused a rollback or incident','Store the events (a file, a table or a metrics backend)','Query deployment frequency per week','Query change failure rate']},
{code:`# Append a deployment event as the last step of a successful production deploy
- name: Record deployment
  if: success()
  run: |
    jq -n --arg sha "$GITHUB_SHA" --arg env production \\
          --arg at "$(date -u +%FT%TZ)" \\
          '{sha:$sha, environment:$env, deployed_at:$at, status:"success"}' \\
      >> deployments.jsonl
    aws s3 cp deployments.jsonl s3://acme-metrics/deployments.jsonl`},
{code:`# Count deployments per ISO week from the events file
jq -r '.deployed_at | .[0:10]' deployments.jsonl | sort | uniq -c`},
{h:'Check yourself'},
{ul:['What counts as a failure, and who marks it?','What is the median lead time from merge to deploy?','What would you change first to improve the weakest metric?']},
{note:'Do not display these numbers per individual. They describe the delivery system.'}]};
})();
