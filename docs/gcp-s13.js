/* LearnSphere - Google Cloud, Section 13: Operations: Monitoring, Logging and Reliability.
   Lectures 0-7 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const suite=K.dg(700,270,[
[10,10,680,250,'Google Cloud Observability',1],
[30,60,150,70,'Cloud Monitoring|metrics, dashboards|alerts, uptime',2],[205,60,150,70,'Cloud Logging|logs, queries|sinks, metrics',2],[380,60,140,70,'Cloud Trace|latency of|requests',0],[545,60,125,70,'Profiler and|Error Reporting',0],
[30,160,640,60,'Sources: Google services, VMs with Ops Agent, GKE, Cloud Run, your apps with OpenTelemetry',0]],
[[105,160,105,130],[280,160,280,130],[450,160,450,130],[607,160,607,130]]);

const alert=K.dg(700,220,[
[10,10,680,200,'From metric to action',1],
[30,70,120,60,'Metric|CPU, latency',0],[190,70,140,60,'Alerting policy|condition, duration',2],[370,70,130,60,'Incident|opened',0],[540,70,130,60,'Notification|email, Slack, page',2]],
[[150,100,190,100],[330,100,370,100],[500,100,540,100]]);

const logs=K.dg(700,260,[
[10,10,680,240,'Log Router',1],
[30,95,120,60,'Log entries|from all services',0],[200,95,120,60,'Log Router|sinks and filters',2],[380,30,140,50,'_Required bucket|400 days',0],[380,95,140,50,'_Default bucket|30 days',0],[380,160,140,50,'Custom bucket',0],[560,30,110,50,'BigQuery',0],[560,95,110,50,'Cloud Storage',0],[560,160,110,50,'Pub/Sub',0]],
[[150,125,200,125],[320,115,380,55],[320,125,380,120],[320,135,380,185],[520,55,560,55],[520,120,560,120],[520,185,560,185]]);

/* ---------- 0 ---------- */
L['gcp:12:0']={blocks:[
{p:'You cannot run what you cannot see. **Google Cloud Observability** (previously the Operations suite, and before that Stackdriver) is a set of integrated services that collect signals from your systems so you can detect problems, find causes and prove reliability.'},
{svg:suite},
{h:'The signals'},
{t:[['Signal','Question it answers','Service'],
['Metrics','How much? How fast? Is it healthy over time?','Cloud Monitoring'],
['Logs','What happened and when?','Cloud Logging'],
['Traces','Where did the time go in this request?','Cloud Trace'],
['Profiles','Which code uses the CPU and memory?','Cloud Profiler'],
['Errors','Which exceptions are new and how often?','Error Reporting']]},
{h:'What is collected automatically'},
{ul:['Most Google Cloud services emit **metrics and logs** with no setup (for example VM CPU, load balancer requests, Cloud Run latency, audit logs).','VM memory and disk usage, and application logs from files, need the **Ops Agent**.','GKE and Cloud Run send container logs and metrics by default.','Your own applications can send telemetry with **OpenTelemetry** or client libraries.']},
{h:'The monitoring loop'},
{flow:['Instrument: collect the metrics, logs and traces that matter','Visualize: dashboards for health and capacity','Alert: define conditions that need human action','Investigate: pivot from alert to logs and traces','Improve: set objectives, fix causes and review']},
{note:'A signal nobody looks at is only cost. Alert on symptoms users feel (errors, latency, availability) and use dashboards for causes.'}],
src:[['Google Cloud Observability','https://cloud.google.com/products/observability'],['Observability documentation',K.OPS]]};

/* ---------- 1 ---------- */
L['gcp:12:1']={blocks:[
{p:'**Cloud Monitoring** collects numeric time series called **metrics**, shows them on dashboards and drives alerts.'},
{h:'Metric types'},
{t:[['Type','Example','Source'],
['System metrics','compute.googleapis.com/instance/cpu/utilization','Collected by Google automatically'],
['Agent metrics','agent.googleapis.com/memory/percent_used','Ops Agent on a VM'],
['Custom metrics','custom.googleapis.com/orders/created','Your code via the API or OpenTelemetry'],
['Log-based metrics','logging.googleapis.com/user/error_count','Counted from log entries'],
['Prometheus metrics','Managed Service for Prometheus','Scraped from apps and GKE workloads']]},
{h:'Ops Agent'},
{p:'The **Ops Agent** is the single agent for VMs. It collects memory, disk and process metrics, and application logs for common software such as nginx, MySQL and Apache.'},
{code:`curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
sudo bash add-google-cloud-ops-agent-repo.sh --also-install
sudo systemctl status google-cloud-ops-agent-opentelemetry-collector
# /etc/google-cloud-ops-agent/config.yaml holds custom receivers and pipelines`},
{h:'Metrics scopes'},
{p:'A **metrics scope** is the set of projects whose metrics you view together. Create a dedicated monitoring project and add other projects to its scope for a single pane of glass across environments.'},
{h:'Dashboards'},
{ul:['Many predefined dashboards exist for VMs, GKE, Cloud SQL and more.','Build custom dashboards with charts using the query editor and PromQL.','Share dashboards with the team or manage them as code with JSON and Terraform.']},
{code:`gcloud monitoring dashboards list
gcloud monitoring dashboards create --config-from-file=dashboard.json
gcloud monitoring metrics-descriptors list --filter="metric.type:compute.googleapis.com/instance/cpu"`},
{note:'Memory is not visible from the hypervisor. Without the Ops Agent a VM shows CPU and disk I/O but not memory use, which surprises many beginners.'}],
src:[['Cloud Monitoring',K.MON],['Ops Agent','https://cloud.google.com/stackdriver/docs/solutions/agents/ops-agent']]};

/* ---------- 2 ---------- */
L['gcp:12:2']={blocks:[
{p:'**Alerting policies** watch metrics and notify people when something needs attention. **Uptime checks** test your service from outside.'},
{svg:alert},
{h:'Parts of an alerting policy'},
{t:[['Part','Meaning'],
['Condition','What to watch: metric threshold, absence of data, forecast, rate of change, or a log match'],
['Duration','How long the condition must hold before it fires (avoids noise from spikes)'],
['Notification channel','Email, SMS, mobile app, Slack, PagerDuty, webhook, Pub/Sub'],
['Documentation','Runbook text and links shown in the notification'],
['Auto-close','Closes the incident after the condition clears']]},
{code:`gcloud alpha monitoring channels create --display-name="Ops email" --type=email --channel-labels=email_address=ops@example.com
gcloud alpha monitoring policies create --policy-from-file=cpu-alert.json
gcloud alpha monitoring policies list`},
{h:'Uptime checks'},
{ul:['Probe an HTTP, HTTPS or TCP endpoint from several global locations at regular intervals.','**Private uptime checks** reach internal endpoints inside a VPC.','Alert when several regions fail so one flaky probe does not wake someone.','Check TLS certificate expiry through the HTTPS check.']},
{h:'Good alerts'},
{ul:['Alert on **symptoms**: error rate, latency, availability, saturation.','Every alert should be **actionable**, urgent and have a runbook.','Use warnings for tickets and critical alerts for paging.','Review noisy alerts and delete or tune them.']},
{t:[['Condition kind','Typical use'],
['Threshold','CPU above 80 percent for 10 minutes'],
['Metric absence','A job stopped reporting'],
['Forecast','Disk will be full in 24 hours'],
['Log-based','A specific critical error appears'],
['SLO burn rate','The error budget is burning too fast']]},
{note:'Notification channels also need permissions to be useful. Test them. An untested pager route fails when it matters.'}],
src:[['Alerting overview',K.MON+'alerts'],['Uptime checks',K.MON+'uptime-checks']]};

/* ---------- 3 ---------- */
L['gcp:12:3']={blocks:[
{p:'**Cloud Logging** stores and searches log entries from Google Cloud services and your applications. **Log Explorer** is the console tool to query them.'},
{h:'Log entries'},
{ul:['Each entry has a **timestamp**, **severity** (DEBUG, INFO, WARNING, ERROR, CRITICAL), a **resource** (for example gce_instance, k8s_container, cloud_run_revision), a **log name** and a payload (text or JSON).','Applications writing JSON to stdout get structured logs with fields you can query.']},
{h:'Logging query language'},
{code:`resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND severity>=ERROR
jsonPayload.user_id="42" AND timestamp>="2026-10-16T09:00:00Z"
textPayload:"connection refused"
protoPayload.methodName="SetIamPolicy"
NOT resource.type="gce_instance"`},
{t:[['Operator','Meaning'],
['=  !=','Equals, not equals'],
['>  >=  <  <=','Comparison, severity and timestamps'],
[':','Contains (substring or key exists)'],
['=~  !~','Regular expression match'],
['AND  OR  NOT','Combine conditions']]},
{h:'Command line'},
{code:`gcloud logging read 'resource.type="gce_instance" AND severity>=ERROR' --limit=20 --format=json --freshness=1h
gcloud logging write my-log "Deployment finished" --severity=INFO
gcloud logging logs list`},
{h:'Log types to know'},
{t:[['Type','Examples'],
['Platform logs','Written by Google Cloud services (load balancer, Cloud Run requests, VPC flow logs)'],
['Audit logs','Admin Activity, Data Access, System Event, Policy Denied'],
['User-written logs','Your apps through stdout, the Ops Agent or client libraries'],
['Security logs','Access Transparency and others']]},
{h:'Log Analytics'},
{p:'**Log Analytics** lets you run SQL over log data, using a linked BigQuery dataset, to aggregate, join and chart logs without exporting them.'},
{note:'Structured JSON logs are far easier to search than free text. Include request IDs and trace IDs so you can follow one request across services.'}],
src:[['Cloud Logging',K.LOG],['Logging query language',K.LOG+'view/logging-query-language']]};

/* ---------- 4 ---------- */
L['gcp:12:4']={blocks:[
{p:'The **Log Router** receives every log entry and sends it to destinations according to **sinks**. Understanding it lets you control cost, retention and where logs are stored.'},
{svg:logs},
{h:'Buckets and retention'},
{t:[['Bucket','Contents','Default retention'],
['_Required','Admin Activity, System Event audit logs','400 days, cannot be changed or disabled'],
['_Default','All other logs','30 days, can be changed'],
['User-defined','Logs you route there','Chosen by you, up to 3650 days']]},
{h:'Sinks'},
{p:'A **sink** is a filter plus a destination. Matching logs are routed there in addition to the buckets.'},
{t:[['Destination','Use'],
['Cloud Storage','Cheap long-term archive'],
['BigQuery','Analysis with SQL'],
['Pub/Sub','Stream to SIEM, Splunk or other tools'],
['Another Logging bucket or project','Central log project'],
['Log bucket with Log Analytics','Search and SQL in Logging']]},
{code:`gcloud logging sinks create audit-to-bq bigquery.googleapis.com/projects/log-project/datasets/audit \\
  --log-filter='logName:"cloudaudit.googleapis.com"' --include-children --organization=987654321
gcloud logging buckets create app-logs --location=global --retention-days=90
gcloud logging sinks list
# grant the sink writer identity access to the destination, as shown in the sink output`},
{ul:['**Aggregated sinks** at the organization or folder level collect logs from all child projects. This is the standard way to centralize audit logs.','The sink has a **writer identity** (a service account) that must be granted write access to the destination.','**Exclusion filters** drop unwanted logs before storage to reduce cost.']},
{h:'Log-based metrics'},
{p:'Convert logs into metrics to chart and alert on them. A **counter** metric counts matching entries. A **distribution** metric extracts a numeric field such as latency.'},
{code:`gcloud logging metrics create payment_failures --description="Payment errors" \\
  --log-filter='resource.type="cloud_run_revision" AND jsonPayload.event="payment_failed"'`},
{note:'Logging cost comes from ingestion volume and retention beyond the defaults. Exclude noisy debug logs in production and set realistic retention.'}],
src:[['Routing and storage overview',K.LOG+'routing/overview'],['Log-based metrics',K.LOG+'logs-based-metrics']]};

/* ---------- 5 ---------- */
L['gcp:12:5']={blocks:[
{p:'Metrics tell you something is slow. Traces, profiles and error groups tell you **why**. These three tools work inside the application.'},
{h:'Cloud Trace'},
{ul:['A **trace** follows one request through services. Each step is a **span** with its duration.','Shows a latency distribution and helps find the slow service or call.','Cloud Run, App Engine and Cloud Run functions send some traces automatically. For your own code use **OpenTelemetry**.','Propagate trace context headers between services so spans connect into a single trace.']},
{code:`from opentelemetry import trace
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
trace.set_tracer_provider(TracerProvider())
trace.get_tracer_provider().add_span_processor(BatchSpanProcessor(CloudTraceSpanExporter()))
tracer = trace.get_tracer(__name__)
with tracer.start_as_current_span("charge-card"):
    pass`},
{h:'Cloud Profiler'},
{ul:['Continuous, low-overhead **CPU, heap and thread profiling** in production.','Flame graphs show which functions use resources.','Supports Java, Go, Node.js and Python, and works across Google Cloud and elsewhere.','Finds efficiency gains that lower cost.']},
{h:'Error Reporting'},
{ul:['Collects exceptions from logs and groups similar ones.','Shows first seen, count, affected versions and stack traces.','Can send a notification when a new error appears.','Works automatically for many runtimes when errors are written to logs in the right format.']},
{h:'Debugging flow'},
{flow:['Alert fires for high latency or errors','Open traces for slow requests to find the slow span','Check logs filtered by trace ID for details','Use Error Reporting for the exception and stack trace','Use Profiler to find hot code, fix, deploy and watch the metric']},
{note:'Cloud Debugger was retired. Use logs, traces and, for deeper work, snapshots in your IDE or OpenTelemetry-based tools.'}],
src:[['Cloud Trace','https://cloud.google.com/trace/docs'],['Cloud Profiler','https://cloud.google.com/profiler/docs'],['Error Reporting','https://cloud.google.com/error-reporting/docs']]};

/* ---------- 6 ---------- */
L['gcp:12:6']={blocks:[
{p:'Reliability needs targets. **Site Reliability Engineering (SRE)** practice from Google uses three terms to set them and decide trade-offs between speed and stability.'},
{h:'SLI, SLO and error budget'},
{t:[['Term','Meaning','Example'],
['SLI (service level indicator)','A measurement of service behaviour','Proportion of requests that succeed in under 300 ms'],
['SLO (service level objective)','The target for an SLI over a period','99.9 percent over 28 days'],
['SLA (service level agreement)','A contract with consequences, looser than the SLO','99.5 percent with credits if missed'],
['Error budget','How much failure the SLO allows','0.1 percent of requests, about 40 minutes per 28 days']]},
{h:'Using error budgets'},
{ul:['If budget remains, the team can ship features and take reasonable risks.','If budget is spent, focus on reliability work and slow down risky changes.','This replaces opinion with a shared number between development and operations.']},
{h:'SLO monitoring in Google Cloud'},
{ul:['Define a **service** (Cloud Run, GKE service, App Engine, or custom).','Choose an **SLI**: availability or latency (request-based), or a windows-based metric.','Set the **goal** and the **compliance period** (rolling or calendar).','Create **burn rate alerts**: a fast burn pages immediately, a slow burn opens a ticket.']},
{code:`# conceptual burn rate alert rules
fast burn:  consume 2 percent of the monthly budget in 1 hour   -> page
slow burn:  consume 5 percent of the monthly budget in 6 hours  -> ticket`},
{h:'Beyond alerts'},
{ul:['Write **runbooks** for each alert.','Run **blameless postmortems** after incidents and track follow-up actions.','Test recovery with game days and dependency failure drills.','Reduce **toil**: automate repeated manual work.']},
{note:'Set SLOs from what users need, not from what you already achieve. A target of 100 percent is wrong: it is unaffordable and freezes change.'}],
src:[['SLO monitoring',K.MON+'slo-monitoring'],['Google SRE books','https://sre.google/books/']]};

/* ---------- 7 ---------- */
L['gcp:12:7']={blocks:[
{p:'Sometimes the problem is not yours. Google Cloud tells you when its services have issues affecting you, and offers support when you need help.'},
{h:'Service health'},
{t:[['Tool','Shows'],
['Google Cloud Service Health','Public status of Google Cloud products and regions'],
['Personalized Service Health','Events affecting your projects and resources, with alerts and API access'],
['Cloud Monitoring','Whether your own metrics show an outage'],
['Active Assist and Recommender','Recommendations and insights about risks and cost']]},
{ul:['Subscribe to **Personalized Service Health** notifications through email, Pub/Sub or webhook.','Compare incident times with your own alerts before opening a ticket.']},
{h:'Support plans'},
{t:[['Plan','For','Notes'],
['Basic','Everyone','Billing support, documentation and community'],
['Standard','Development workloads','Technical support during business hours'],
['Enhanced','Production workloads','24/7 for high priority, faster response'],
['Premium','Critical workloads','Fastest response, technical account management']]},
{p:'Check the Google Cloud Customer Care page for current plan names, prices and response targets.'},
{h:'Opening a case with a good report'},
{flow:['State the impact, start time and affected project and resource IDs','Include error messages, request IDs and a minimal reproduction','Attach logs, traces and screenshots with timestamps','Say what you already tried and changed recently','Set the priority honestly and keep a contact available']},
{h:'Other help'},
{ul:['Documentation, quickstarts and the architecture center.','Cloud Skills Boost labs and Google Cloud certifications.','Community forums and Stack Overflow for how-to questions.','Partners for migration and managed services.']},
{note:'Treat provider incidents as part of design. Use multiple zones or regions, retries with backoff, and clear status communication to users.'}],
src:[['Personalized Service Health','https://cloud.google.com/service-health/docs/overview'],['Customer Care','https://cloud.google.com/support']]};
})();
