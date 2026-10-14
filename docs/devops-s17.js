/* LearnSphere - DevOps & CI/CD, Section 17: Pipeline Operations, Governance & Platform Engineering.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const product=K.dg(700,220,[
[10,10,680,200,'CI/CD as an internal product',1],
[30,70,140,70,'Users|product teams',0],[240,60,150,90,'Platform team|roadmap, support,|SLOs, docs',2],[460,70,200,70,'Shared services|runners, templates,|registries, policy',0]],
[[170,105,240,105],[390,105,460,105]]);

const golden=K.dg(700,220,[
[10,10,680,200,'A golden path',1],
[25,70,110,60,'Scaffold a|new service',0],[160,70,120,60,'Template pipeline|build, test, scan',0],[305,70,110,60,'Sign and|publish',0],[440,70,110,60,'GitOps|deploy',0],[575,70,100,60,'Dashboards|and alerts',2]],
[[135,100,160,100],[280,100,305,100],[415,100,440,100],[550,100,575,100]]);

/* ---------- 0 ---------- */
L['devops:16:0']={blocks:[
{p:'When many teams depend on the same pipelines, runners and registries, those become a **product** with users, reliability needs and an owner. Treating the platform as an afterthought produces the outages everyone feels.'},
{svg:product},
{t:[['Product thinking','What it looks like'],
['**Users**','Developers are the customers. Interview them and watch where they struggle'],
['**Ownership**','A named team owns the platform, with an on-call rota'],
['**Reliability targets**','SLOs such as 95 percent of builds start within two minutes'],
['**Roadmap and support**','A visible backlog, a support channel, release notes'],
['**Documentation**','A getting-started path and examples']]},
{h:'Example SLOs for a delivery platform'},
{t:[['SLI','SLO'],
['Queue time to start a job','95 percent start within 2 minutes'],
['Pipeline platform availability','99.5 percent of runs are not failed by the platform'],
['Time to restore after a platform incident','Under 1 hour']]},
{note:'Tell users when the platform is down and what it means for them. If the platform has no owner, every team becomes its own unreliable platform.'}]};

/* ---------- 1 ---------- */
L['devops:16:1']={blocks:[
{p:'A **golden path** is the supported, easiest way to do a common task. It bakes in security and quality defaults so that following it is **less effort** than going your own way.'},
{svg:golden},
{t:[['Template element','Provides'],
['Standard pipeline','Build, test, scan, SBOM, sign, publish and deploy steps'],
['Defaults','Least-privilege permissions, pinned actions, caching'],
['Inputs','A few parameters (language, service name) instead of copying YAML'],
['Escape hatches','Ways to add custom steps without forking the template']]},
{code:`# A service pipeline that uses the central template
jobs:
  ci:
    uses: acme/platform-workflows/.github/workflows/service-ci.yml@v3
    with:
      language: node
      service-name: sample-app
    secrets: inherit`},
{h:'Keeping it healthy'},
{ul:['**Version** templates with tags. Services opt into upgrades through a bot.','Offer **paved**, not mandatory, paths where possible. Adoption comes from usefulness.','Let teams **extend** safely. A template that cannot be extended gets forked.','Measure adoption and the time to first deployment of a new service.']}],
src:[['Backstage','https://backstage.io/docs/overview/what-is-backstage/']]};

/* ---------- 2 ---------- */
L['devops:16:2']={blocks:[
{p:'Runners are capacity. The key signal is **queue time**: how long a job waits before it starts. Waiting is wasted developer time.'},
{t:[['Signal','Meaning','Action'],
['Queue time rising','Not enough runners for demand','Raise maximum capacity or scale faster'],
['Low utilisation, long queue','Wrong labels or capacity in the wrong place','Review labels, pools and routing'],
['Frequent job failures at start','Runner image or capacity problems','Fix images, use health checks'],
['Spiky demand (releases, mornings)','Short bursts','Autoscale and use warm pools']]},
{h:'Sizing and scaling'},
{ul:['**Autoscale** on queue depth: create runners when jobs wait, remove them when idle.','Use **ephemeral** runners so each job is clean, and burst capacity is cheap.','Provide a few **sizes** (small, large, GPU) and charge or limit large ones.','Keep a small **warm pool** to avoid cold-start delay for latency-sensitive paths.','Set **job timeouts** and cancel redundant runs to free capacity.']},
{flow:['Measure queue time and utilisation','Set a target such as 95 percent under two minutes','Scale on queue depth, not on CPU','Review monthly with cost data']}]};

/* ---------- 3 ---------- */
L['devops:16:3']={blocks:[
{p:'Pipelines cost money in compute minutes, storage and idle capacity. The biggest savings are usually **waste**, not discounts.'},
{t:[['Source of cost','Typical waste','Fix'],
['Compute minutes','Redundant runs, no caching, oversized runners','Concurrency cancel, cache, right-size'],
['Idle capacity','Always-on runners at night','Autoscale to zero, schedules'],
['Storage','Old artifacts, images, caches','Retention rules, cleanup'],
['Flaky tests','Re-runs that fail and run again','Fix or quarantine flaky tests'],
['Scheduled jobs','Nightly runs nobody reads','Review and remove']]},
{h:'Attribute cost'},
{ul:['Tag or label runs by **team and service** so cost can be reported to its owner.','Show teams their usage on a dashboard. Visible cost changes behaviour.','Set **budgets and alerts** for sudden growth.']},
{flow:['Find the top ten workflows by minutes','Look for redundant, slow or flaky runs','Apply caching, cancellation and path filters','Right-size runners','Re-measure and keep a regular review']},
{note:'Do not optimise cost at the expense of feedback time. A cheaper but much slower pipeline costs more in waiting developers.'}]};

/* ---------- 4 ---------- */
L['devops:16:4']={blocks:[
{p:'You cannot improve what you do not measure. Measure the pipeline as a system, not only the applications it builds.'},
{t:[['Metric','Why it matters'],
['**Success rate** (excluding code failures)','Platform reliability'],
['**Failure reasons** (infrastructure vs test vs config)','Where to invest'],
['**Duration** (p50, p95)','Developer feedback speed'],
['**Queue time**','Capacity health'],
['**Flaky test rate and retries**','Trust and waste'],
['**Cache hit rate**','Efficiency'],
['**Stage durations**','Which step to optimise']]},
{h:'Where the data comes from'},
{ul:['Platform APIs and webhooks for workflow runs (GitHub, GitLab, Jenkins).','Export metrics to Prometheus or a data warehouse and chart in Grafana.','Add trace spans around pipeline stages with OpenTelemetry where supported.']},
{flow:['Collect run events and durations','Classify failures (platform vs user)','Chart trends weekly','Pick the biggest contributor and fix it','Check the trend moved']}]};

/* ---------- 5 ---------- */
L['devops:16:5']={blocks:[
{p:'Auditors and regulators want evidence of who changed what, who approved it and that controls ran. A good pipeline **produces this evidence as a side effect**.'},
{t:[['Control question','Evidence from the pipeline'],
['Who changed this?','Commit author and pull request'],
['Who approved it?','Review approvals and environment approval records'],
['What was tested and scanned?','Check results attached to the commit'],
['What exactly was deployed?','Artifact digest, signature, provenance, deployment record'],
['Did anyone bypass controls?','Branch protection audit log and bypass records']]},
{h:'Separation of duties'},
{p:'The person who writes a change should not be the only person who approves it into production.'},
{ul:['Require **at least one reviewer who is not the author**.','Prevent the user who triggered a deployment from approving it in the environment.','Limit who can change pipeline definitions and protection rules.','Keep an **audit log** and retain it for the required period.']},
{note:'Automated, consistent enforcement is stronger evidence than a manual checklist.'}]};

/* ---------- 6 ---------- */
L['devops:16:6']={blocks:[
{p:'Traditional change management used tickets and weekly boards. Research shows heavy external approval boards do **not** reduce failures and slow delivery. Replace them with **automation and peer review**.'},
{t:[['Traditional','Modern'],
['Change advisory board approves each change','Peer review in the pull request'],
['Manual risk assessment form','Automated risk signals (size, area, test results)'],
['Weekly release windows','Deploy any time, with progressive rollout'],
['Evidence collected by hand','Evidence from pipeline records']]},
{h:'Risk-based flow'},
{t:[['Change risk','Path'],
['**Standard** (pre-approved type, low risk)','Automatic once checks pass'],
['**Normal**','Peer review and passing checks'],
['**High risk** (data migration, security-sensitive)','Extra reviewer, staged rollout, rollback plan']]},
{ul:['Pre-approve **standard change types** whose risk is known.','Record the ticket link in the pull request so tools can sync with the system of record.','Keep an **emergency path** with after-the-fact review.']}],
src:[['DORA: streamlining change approval',K.DORA+'capabilities/streamlining-change-approval/']]};

/* ---------- 7 ---------- */
L['devops:16:7']={blocks:[
{p:'**Platform engineering** builds an **internal developer platform (IDP)**: a set of self-service capabilities that let product teams ship and run software without becoming experts in every underlying system.'},
{t:[['Layer','Contents'],
['Self-service interface','Portal, CLI or API to create services and environments (for example Backstage)'],
['Orchestration','Pipelines and GitOps that provision and deliver'],
['Capabilities','Runners, registries, secrets, observability, databases as a service'],
['Guardrails','Policy, templates, defaults that make the safe thing easy']]},
{h:'Treat developers as customers'},
{ul:['Start from **real pain points**, measured by time and surveys, not from technology.','Build the **thinnest viable platform**, then grow it with usage.','Provide **documentation and support**, and track satisfaction.','Measure outcomes: lead time, onboarding time, number of tickets avoided.']},
{h:'Pitfalls'},
{ul:['Building a portal nobody asked for.','Forcing adoption instead of earning it.','Hiding so much that teams cannot debug.','A platform team that becomes a ticket queue.']}],
src:[['CNCF platform engineering maturity model','https://tag-app-delivery.cncf.io/whitepapers/platform-eng-maturity-model/']]};

/* ---------- 8 ---------- */
L['devops:16:8']={blocks:[
{p:'AI coding assistants and agents can draft workflows, explain failures and suggest fixes. They speed up work, and they also produce plausible but wrong output, so **guardrails** matter.'},
{t:[['Use','Benefit','Control'],
['Draft a pipeline or Dockerfile','Faster start','Lint, review and test the result'],
['Explain a failing run','Quicker diagnosis','Verify against logs'],
['Suggest dependency or action updates','Less toil','Pin and review diffs'],
['Agents opening pull requests','Automation of routine fixes','Pull request review and required checks apply as usual']]},
{h:'Guardrails'},
{ul:['**Human review** of every change. Treat AI output as an untrusted contribution.','**Least privilege**: give agents read access and pull request rights only, never production credentials.','**No secrets in prompts**, and no pipeline logs with secrets sent to external services.','Keep **required checks and branch protection** so AI changes face the same gates.','Be wary of **hallucinated** actions or packages. Verify that they exist and are trustworthy.','Test generated pipelines in a sandbox repository.']},
{note:'AI makes it cheap to produce changes, so review capacity becomes the bottleneck. Keep changes small and the pipeline strict.'}]};

/* ---------- 9 ---------- */
L['devops:16:9']={blocks:[
{p:'Publish a reusable pipeline template, move a team onto it and measure the result.'},
{flow:['Pick the pattern repeated across repositories','Write a reusable workflow with a few inputs and secure defaults','Version it with a tag and document it','Migrate one pilot team','Measure adoption and pipeline outcomes','Collect feedback and release v2']},
{code:`# platform-workflows: .github/workflows/service-ci.yml
on:
  workflow_call:
    inputs:
      node-version: { type: string, default: '22' }
permissions:
  contents: read
jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: \${{ inputs.node-version }}, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm audit --audit-level=high`},
{h:'Measure'},
{t:[['Measure','Before','After'],
['Time to create a new service pipeline','Hours','Minutes'],
['Repositories on the template','0','Count'],
['Median pipeline duration','Baseline','Compare'],
['Security findings caught on pull requests','Baseline','Compare']]},
{h:'Check yourself'},
{ul:['Would the team keep using it if it were optional?','What feedback did they give?','What changed in v2 because of it?']}]};
})();
