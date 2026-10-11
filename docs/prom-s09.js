/* LearnSphere - Prometheus & Grafana, Section 09: Grafana Alerting & Notifications.
   Lectures 0-4 are core; additional lectures (not written yet) follow. Needs prom-common.js. */
(function(){
const K=window.PM,L=window.LESSONS,G=K.G,A=K.G+'alerting/';

/* ---------- diagrams ---------- */
const arch=K.dg(700,230,[
[10,10,680,210,'Grafana Alerting',1],
[30,60,130,60,'Data sources|Prometheus, Loki,|SQL, ...',0],[200,50,150,80,'Alert rule|query, expression,|condition, pending',2],[390,50,130,80,'Notification|policies|route by labels',2],[560,50,110,80,'Contact|points|Slack, email,|PagerDuty',0],
[390,160,130,45,'Silences and|mute timings',0],[200,160,150,45,'Alert instances|state per series',0]],
[[160,90,200,90],[350,90,390,90],[520,90,560,90],[455,160,455,130],[275,130,275,160]]);

const rulepipe=K.dg(700,170,[
[10,10,680,150,'One alert rule',1],
[30,55,120,60,'Query A|rate of errors',0],[190,55,120,60,'Reduce B|last value|per series',0],[350,55,120,60,'Math or|Threshold C|B is above 0.05',2],[510,55,160,60,'State per series|Normal, Pending,|Alerting',2]],
[[150,85,190,85],[310,85,350,85],[470,85,510,85]]);

/* ---------- 0: Architecture ---------- */
L['prom:8:0']={blocks:[
{p:'**Grafana Alerting** lets you define alert rules over any data source Grafana can query, and send notifications through contact points and policies. It uses the same ideas as Prometheus and Alertmanager (rules, grouping, routing, silences) but in one interface.'},
{svg:arch},
{h:'The building blocks'},
{t:[['Concept','Job'],
['**Alert rule**','Queries and expressions, a condition, evaluation interval and pending period'],
['**Alert instance**','One alert per returned series (multi-dimensional alerting)'],
['**Evaluation group**','Rules in a folder that share an evaluation interval'],
['**Contact point**','Where to send: email, Slack, PagerDuty, webhook and so on'],
['**Notification policy**','A tree that routes alert instances to contact points by labels'],
['**Silence**','Temporary mute with label matchers'],
['**Mute timing**','Recurring time windows when notifications are paused']]},
{h:'Alert instance states'},
{t:[['State','Meaning'],
['**Normal**','Condition is false'],
['**Pending**','Condition true, waiting for the pending period'],
['**Alerting**','Condition true long enough; notifications are sent'],
['**No Data**','The query returned no series'],
['**Error**','The query or expression failed']]},
{p:'You choose what happens for **No Data** and **Error**: alert, set to normal or keep the last state. This is an important design decision, because a broken query otherwise looks like "everything is fine".'},
{h:'How it differs from Prometheus alerting'},
{t:[['','Prometheus + Alertmanager','Grafana Alerting'],
['**Where rules are defined**','YAML files','UI, API, Terraform or provisioning files'],
['**Evaluated by**','The Prometheus server','The Grafana server'],
['**Data sources**','Prometheus only','Many (Prometheus, Loki, SQL, CloudWatch ...)'],
['**Multi-source conditions**','No','Yes, using expressions'],
['**Notification engine**','Alertmanager','Embedded Alertmanager (or an external one)']]},
{note:'Grafana evaluates rules itself, so a Grafana outage stops that alerting. Critical infrastructure rules usually stay in Prometheus, which is closest to the data.'}],
src:[['Grafana Alerting',A],['Alerting fundamentals',A+'fundamentals/']]};

/* ---------- 1: Creating rules ---------- */
L['prom:8:1']={blocks:[
{p:'An alert rule is built from **queries** that fetch data and **expressions** that turn the data into a yes or no condition. You can start from a panel query so you do not retype it.'},
{svg:rulepipe},
{h:'Create a rule'},
{flow:['Alerting, then Alert rules, then New alert rule','Name the rule and choose Grafana-managed','Add query A against Prometheus','Add expressions: Reduce, then a Threshold','Pick a folder and evaluation group and set the pending period','Add labels and annotations and choose a contact point or policy']},
{h:'The expression pipeline'},
{t:[['Expression','What it does','Why'],
['**Reduce**','Turns a time series into a single number per series (last, mean, max ...)','Alerts compare single values'],
['**Math**','Arithmetic between queries or expressions','Ratios such as errors / requests'],
['**Threshold**','Compares to a number and returns 0 or 1','The alert condition'],
['**Classic condition**','Older single-step condition','Avoid in new rules']]},
{h:'Example: high CPU per host'},
{code:`# Query A (instant query is fine)
1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))

# Expression B: Reduce, function Last, input A
# Expression C: Threshold, input B, IS ABOVE 0.9
# Condition: C`},
{p:'Because the query groups **by instance**, Grafana creates **one alert instance per host**. This is **multi-dimensional alerting**: you write the rule once and each series is evaluated and notified separately.'},
{h:'Evaluation settings'},
{t:[['Setting','Meaning'],
['**Evaluation group and interval**','How often all rules in the group run'],
['**Pending period**','How long the condition must be true before Alerting (like `for`)'],
['**No data state**','What to do when the query returns nothing'],
['**Error state**','What to do when evaluation fails'],
['**Keep firing for**','Hold the alert after it recovers to avoid flapping']]},
{h:'Labels and annotations'},
{code:`# Labels (used for routing)
severity = critical
team     = platform

# Annotation templates
summary     = CPU above 90% on {{ $labels.instance }}
description = Current value is {{ $values.B }}`},
{note:'Use **labels** for routing and grouping. Keep them stable. Put changing information such as values in **annotations**.'}],
src:[['Create alert rules',A+'alerting-rules/create-grafana-managed-rule/'],['Alert rule templating',A+'alerting-rules/templates/']]};

/* ---------- 2: Contact points and policies ---------- */
L['prom:8:2']={blocks:[
{p:'Rules decide **what** is wrong. **Contact points** and **notification policies** decide **who hears about it and how**. The two are deliberately separate so you can change routing without editing rules.'},
{h:'Contact points'},
{p:'A contact point is a named set of one or more integrations plus an optional message template.'},
{t:[['Integration','Typical use'],
['Email','Non-urgent, broad audience'],
['Slack, Microsoft Teams, Discord','Team channels'],
['PagerDuty, Opsgenie, VictorOps','Paging on-call staff'],
['Webhook','Custom automation, ticketing, chatbots'],
['Grafana OnCall / IRM','On-call scheduling and escalation']]},
{h:'Message templates'},
{code:`{{ define "alert.title" }}
[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }} ({{ .Alerts.Firing | len }} firing)
{{ end }}

{{ define "alert.body" }}
{{ range .Alerts }}
{{ .Labels.instance }}: {{ .Annotations.summary }}
{{ end }}
{{ end }}`},
{h:'Notification policies'},
{p:'Policies form a **tree**. Each alert instance enters at the root and goes down to the first nested policy whose label matchers match (unless **continue matching** is on). The policy decides the contact point and timing.'},
{t:[['Setting','Meaning','Typical'],
['**Matchers**','Labels this policy handles','`severity = critical`'],
['**Contact point**','Where matching alerts go','pagerduty'],
['**Group by**','Labels that form one notification','`alertname`, `cluster`'],
['**Group wait**','Delay before first notification of a group','30s'],
['**Group interval**','Delay between updates of a group','5m'],
['**Repeat interval**','Delay before re-notifying an unchanged alert','4h'],
['**Mute timings**','Windows during which this policy is quiet','nights']]},
{flow:['Alert instance with labels severity and team','Root policy checked, then nested policies in order','First matching policy selects the contact point','Group by labels forms one notification','Group timing decides when it is sent']},
{h:'Design pattern'},
{ul:['Root policy goes to a **default** contact point so nothing is lost.','Nested policies by **severity** (page vs ticket) and by **team**.','Keep the label set small and agreed across teams: `severity`, `team`, `service`.']},
{note:'If an alert fires but nobody is notified, check in order: the rule labels, the policy matchers and the contact point test button.'}],
src:[['Contact points',A+'configure-notifications/manage-contact-points/'],['Notification policies',A+'configure-notifications/create-notification-policy/']]};

/* ---------- 3: Silences and mute timings ---------- */
L['prom:8:3']={blocks:[
{p:'Sometimes alerts are expected: a deployment, a maintenance window, a known issue. Grafana provides **silences** for one-off pauses and **mute timings** for recurring ones.'},
{h:'Silences'},
{p:'A silence matches alert **labels** for a chosen time range. Matching alerts still evaluate and appear in the UI, but notifications are not sent.'},
{flow:['Alerting, then Silences, then New silence','Set the start and end time','Add matchers, for example instance = web1:9100','Add a comment explaining why','Save; it expires automatically']},
{h:'Mute timings'},
{p:'A mute timing defines **recurring periods**, such as every night or weekend. You attach it to a notification policy; the policy sends nothing during those times.'},
{t:[['Setting','Example'],
['Days of the week','Saturday and Sunday'],
['Time range','22:00 to 07:00'],
['Months and days','1 to 5 of January'],
['Location (time zone)','Europe/London']]},
{h:'Silence or mute timing?'},
{t:[['','Silence','Mute timing'],
['**Time pattern**','One window','Recurring schedule'],
['**Matches by**','Alert labels','The policy it is attached to'],
['**Created by**','Person, for a specific event','Admin, as standing configuration'],
['**Typical use**','Planned maintenance, known incident','Non-urgent alerts outside office hours']]},
{h:'Practices'},
{ul:['Always add a **comment** and an **end time**; open-ended silences hide outages.','Match narrowly: the host or service, not the whole organisation.','For automated maintenance, create silences from your deployment pipeline through the **API**.']},
{code:`# create a silence with the Alertmanager API of Grafana (service account token)
curl -X POST https://grafana.example.com/api/alertmanager/grafana/api/v2/silences \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"matchers":[{"name":"instance","value":"web1:9100","isRegex":false,"isEqual":true}],
       "startsAt":"2026-10-12T22:00:00Z","endsAt":"2026-10-13T00:00:00Z",
       "createdBy":"deploy-bot","comment":"Kernel patching"}'`},
{note:'A silence does not stop evaluation or state changes. It only stops notifications, so you can still see the alert on the page.'}],
src:[['Silences',A+'configure-notifications/create-silence/'],['Mute timings',A+'configure-notifications/mute-timings/']]};

/* ---------- 4: Grafana-managed vs data-source-managed ---------- */
L['prom:8:4']={blocks:[
{p:'You can alert in two places: in **Grafana** or in the **data source** (for example Prometheus rule files). Both end in a notification, but they behave differently. Knowing which to choose avoids duplicate alerts and surprise outages.'},
{h:'Side by side'},
{t:[['','Data-source-managed (Prometheus rules)','Grafana-managed'],
['**Defined in**','YAML rule files on the Prometheus side','Grafana UI, API, provisioning or Terraform'],
['**Evaluated by**','Prometheus (or Mimir, Loki ruler)','Grafana server'],
['**Sources**','Single data source','Any, and mixed in one rule'],
['**Notification engine**','Alertmanager','Grafana embedded Alertmanager (or external)'],
['**Survives Grafana outage**','Yes','No'],
['**Version control**','Natural (Git rule files)','Possible through provisioning or Terraform'],
['**Expressive power**','Full PromQL','Queries plus Reduce, Math, Threshold']]},
{h:'Which to choose'},
{flow:['Does the rule need only Prometheus metrics?','Yes: prefer Prometheus rules, close to the data','Does it combine several data sources or business data?','Yes: use a Grafana-managed rule','Do non-experts need to create alerts in a UI?','Yes: Grafana-managed with folders and permissions']},
{h:'Common patterns'},
{t:[['Pattern','Explanation'],
['**Infrastructure in Prometheus, business in Grafana**','Core availability and saturation rules are code reviewed; sales or SQL-based rules live in Grafana'],
['**One notification path**','Send both to the same Alertmanager so grouping and silences are in one place'],
['**View everything in Grafana**','Grafana can list and show data-source-managed rules from Prometheus-compatible rulers']]},
{h:'Avoid'},
{ul:['**Duplicating** the same rule in both places; you get two notifications.','**Two sets of routing** that disagree about who is on call.','Putting all production-critical alerting only in a single Grafana instance.']},
{h:'Using an external Alertmanager'},
{p:'Grafana can add an **external Alertmanager** as an alert destination, and can also show alerts from it. This lets one Alertmanager cluster serve both Prometheus and Grafana rules.'},
{note:'Exam tip: Prometheus alerting rules are evaluated by Prometheus and sent to Alertmanager. Grafana-managed rules are evaluated by Grafana.'}],
src:[['Alert rule types',A+'alerting-rules/'],['Alertmanager in Grafana',A+'set-up/configure-alertmanager/']]};
})();
