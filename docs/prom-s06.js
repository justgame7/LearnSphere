/* LearnSphere - Prometheus & Grafana, Section 06: Alerting with Alertmanager.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs prom-common.js. */
(function(){
const K=window.PM,L=window.LESSONS,PA=K.PA,PP=K.PP,PG=K.PG;

/* ---------- diagrams ---------- */
const states=K.dg(700,150,[
[10,10,680,130,'Life of an alert',1],
[30,55,130,55,'Inactive|expr returns nothing',0],[220,55,130,55,'Pending|expr true,|waiting for "for"',2],[410,55,130,55,'Firing|sent to|Alertmanager',2],[590,50,90,65,'Resolved|expr false|again',0]],
[[160,82,220,82],[350,82,410,82],[540,82,590,82]]);

const route=K.dg(700,260,[
[10,10,680,240,'A routing tree',1],
[270,40,160,45,'Root route|receiver: default',2],
[60,130,160,50,'severity=critical|receiver: pagerduty',0],[270,130,160,50,'team=db|receiver: db-slack',0],[480,130,160,50,'everything else|receiver: default',0],
[60,200,160,40,'group_by: alertname,|cluster',0],[270,200,160,40,'group_wait 30s',0]],
[[320,85,140,130],[350,85,350,130],[380,85,560,130],[140,180,140,200],[350,180,350,200]]);

const flow=K.dg(700,170,[
[10,10,680,150,'From a rule to a notification',1],
[30,55,120,60,'Prometheus|rule fires',2],[190,55,130,60,'Alertmanager|dedupe, group',2],[360,55,130,60,'Route|match labels|choose receiver',0],[530,55,140,60,'Receiver|Slack, email,|PagerDuty',0]],
[[150,85,190,85],[320,85,360,85],[490,85,530,85]]);

/* ---------- 0: Alerting rules ---------- */
L['prom:5:0']={blocks:[
{p:'An **alerting rule** is a PromQL expression plus rules about how long and with which labels. When the expression returns series, each one becomes an **alert**. Prometheus evaluates the rules and tells Alertmanager what is firing.'},
{svg:states},
{h:'Anatomy of a rule'},
{code:`groups:
  - name: availability
    rules:
      - alert: InstanceDown
        expr: up == 0
        for: 5m
        keep_firing_for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Instance {{ $labels.instance }} is down"
          description: "{{ $labels.job }} on {{ $labels.instance }} has been unreachable for more than 5 minutes."
          runbook_url: "https://runbooks.example.com/instance-down"`},
{t:[['Field','Meaning'],
['`alert`','Name of the alert (appears as the `alertname` label)'],
['`expr`','PromQL; every returned series is a candidate alert'],
['`for`','How long the condition must be true before firing'],
['`keep_firing_for`','How long to keep firing after the condition clears (reduces flapping)'],
['`labels`','Extra labels, used for **routing** (`severity`, `team`)'],
['`annotations`','Human text: summary, description, runbook link']]},
{h:'The three states'},
{t:[['State','Condition','Visible in'],
['**Inactive**','No series from `expr`','Alerts page (green)'],
['**Pending**','True, but `for` has not elapsed','Alerts page (yellow)'],
['**Firing**','True for at least `for`','Alerts page (red); sent to Alertmanager']]},
{p:'Without `for`, a one-sample blip triggers a notification. A `for` of a few minutes trades speed for stability.'},
{h:'Labels vs annotations'},
{ul:['**Labels** identify the alert and drive routing and grouping. Keep them stable and low-cardinality. Changing a label creates a different alert.','**Annotations** carry text for humans and can contain templates, such as `{{ $value }}`. They do not identify the alert.']},
{h:'Template variables'},
{t:[['Variable','Content'],
['`$labels.<name>`','Value of a label on the alert'],
['`$value`','The value of the expression for that series'],
['`$externalLabels`','The server external labels'],
['`humanize`, `humanizePercentage`','Functions to format `$value`']]},
{code:`description: "Error ratio is {{ $value | humanizePercentage }} on {{ $labels.service }}"`},
{h:'The ALERTS metric'},
{code:`ALERTS{alertstate="firing"}
ALERTS{alertname="InstanceDown", alertstate="pending"}
count by (alertname) (ALERTS{alertstate="firing"})`},
{note:'Prometheus itself does not send notifications. It only evaluates rules. Notification handling is Alertmanager job, covered next.'}],
src:[['Alerting rules',PP+'configuration/alerting_rules/'],['Template examples',PP+'configuration/template_examples/']]};

/* ---------- 1: Alertmanager routing ---------- */
L['prom:5:1']={blocks:[
{p:'**Alertmanager** receives alerts from Prometheus and decides who is told, how, and how often. Its three core jobs are **deduplication** (one problem, one notification), **grouping** (related alerts together) and **routing** (the right team gets it).'},
{svg:flow},
{h:'Connect Prometheus to Alertmanager'},
{code:`# prometheus.yml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]
rule_files:
  - "rules/*.yml"`},
{h:'A routing configuration'},
{code:`# alertmanager.yml
route:
  receiver: team-default
  group_by: ["alertname", "cluster", "service"]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - matchers: ['severity="critical"']
      receiver: pagerduty
      group_wait: 10s
    - matchers: ['team="database"']
      receiver: db-slack
      continue: false

receivers:
  - name: team-default
  - name: pagerduty
  - name: db-slack`},
{svg:route},
{h:'The timing knobs'},
{t:[['Setting','Meaning','Typical'],
['`group_by`','Labels that define one group (one notification)','`alertname`, `cluster`, `service`'],
['`group_wait`','Wait for more alerts of a new group before the first notification','30s'],
['`group_interval`','Wait before notifying about new alerts added to an existing group','5m'],
['`repeat_interval`','Re-send if still firing and unchanged','4h']]},
{h:'How a route is chosen'},
{flow:['The alert enters the root route','Child routes are checked in order for a label match','The first match wins unless continue is true','If none match, the parent receiver is used','The alert joins a group by group_by labels']},
{h:'Deduplication and high availability'},
{ul:['Prometheus sends the same firing alert repeatedly. Alertmanager treats identical label sets as **one** alert.','Run **two or more Alertmanagers** as a cluster (gossip). Point **each Prometheus at all of them**; they share notification state so you are not notified twice.','Do not put a load balancer in front of the Alertmanagers for Prometheus: Prometheus must reach each instance.']},
{h:'Check and operate'},
{code:`amtool check-config alertmanager.yml
amtool config routes show --config.file=alertmanager.yml
amtool config routes test --config.file=alertmanager.yml severity=critical team=database
amtool alert --alertmanager.url=http://localhost:9093`},
{note:'The default `group_by` should include `alertname`; leave out volatile labels such as `instance` if you want one message for the whole cluster.'}],
src:[['Alertmanager overview',PA+'overview/'],['Configuration',PA+'configuration/']]};

/* ---------- 2: Receivers ---------- */
L['prom:5:2']={blocks:[
{p:'A **receiver** is a named destination plus the settings to reach it. The route tree picks a receiver; the receiver sends a message through one or more integrations.'},
{h:'Common integrations'},
{t:[['Integration','Use','Key settings'],
['**email_configs**','Slow, broad notification','`to`, `from`, `smarthost`, `auth_*`'],
['**slack_configs**','Team chat','`api_url`, `channel`, `title`, `text`'],
['**pagerduty_configs**','Paging on-call','`routing_key` (Events v2) or `service_key`'],
['**webhook_configs**','Anything else','`url` (receives JSON)'],
['**opsgenie_configs**, **victorops**, **msteams**, **telegram**','Other platforms','Per-integration keys']]},
{h:'A complete example'},
{code:`global:
  resolve_timeout: 5m
  smtp_smarthost: "smtp.example.com:587"
  smtp_from: "alerts@example.com"
  smtp_auth_username: "alerts@example.com"
  smtp_auth_password_file: /etc/alertmanager/smtp-password

route:
  receiver: slack-ops
  routes:
    - matchers: ['severity="critical"']
      receiver: pagerduty-oncall

receivers:
  - name: slack-ops
    slack_configs:
      - api_url_file: /etc/alertmanager/slack-url
        channel: "#ops-alerts"
        send_resolved: true
        title: "{{ .Status | toUpper }}: {{ .CommonLabels.alertname }}"
        text: |
          {{ range .Alerts }}
          *{{ .Annotations.summary }}*
          {{ .Annotations.description }}
          {{ end }}

  - name: pagerduty-oncall
    pagerduty_configs:
      - routing_key_file: /etc/alertmanager/pagerduty-key
        send_resolved: true`},
{h:'Templates'},
{p:'Notification text uses Go templates with an alert-group data structure.'},
{t:[['Field','Content'],
['`.Status`','`firing` or `resolved`'],
['`.Alerts`','List of alerts; use `range`'],
['`.CommonLabels`, `.CommonAnnotations`','Labels or annotations shared by every alert in the group'],
['`.GroupLabels`','Labels from `group_by`'],
['`.ExternalURL`','Alertmanager address']]},
{h:'Good receiver practice'},
{ul:['Set `send_resolved: true` so people see when problems end.','Keep **secrets in files** (`*_file` options) rather than in the main configuration.','Use **one receiver per audience** (team, severity), not per alert.','Test with a deliberate test alert before depending on it.']},
{code:`# send a test alert
amtool alert add TestAlert severity=warning --annotation=summary="test" \\
  --alertmanager.url=http://localhost:9093`},
{note:'Notification failures are logged by Alertmanager and exposed as `alertmanager_notifications_failed_total`. Alert on that metric so a broken integration does not stay silent.'}],
src:[['Receivers and integrations',PA+'configuration/#receiver-integration-settings'],['Notification templates',PA+'notification_examples/']]};

/* ---------- 3: Inhibition and silences ---------- */
L['prom:5:3']={blocks:[
{p:'Two features reduce noise without changing your rules. **Inhibition** automatically mutes alerts that are consequences of another. **Silences** are temporary, manual mutes, for example during maintenance.'},
{h:'Inhibition'},
{p:'If a whole node is down, you do not also need alerts for every service on it. An inhibit rule says: while the **source** alert is firing, suppress **target** alerts that have the same values for the `equal` labels.'},
{code:`inhibit_rules:
  - source_matchers: ['alertname="InstanceDown"']
    target_matchers: ['severity=~"warning|info"']
    equal: ["instance"]

  - source_matchers: ['severity="critical"']
    target_matchers: ['severity="warning"']
    equal: ["alertname", "cluster", "service"]`},
{t:[['Field','Meaning'],
['`source_matchers`','The alert that causes suppression'],
['`target_matchers`','The alerts that get suppressed'],
['`equal`','Labels that must be identical on both']]},
{h:'Silences'},
{p:'A silence is a set of **label matchers** with a start, an end and an author. Matching alerts are still evaluated and visible, but no notification is sent.'},
{code:`# create a 2 hour silence for one host
amtool silence add instance="web1:9100" \\
  --duration=2h --comment="Kernel patching" --author="alice" \\
  --alertmanager.url=http://localhost:9093

amtool silence query
amtool silence expire <silence-id>`},
{p:'You can also create silences in the Alertmanager web UI and via its API, and Grafana can create them too.'},
{h:'Inhibition vs silence'},
{t:[['','Inhibition','Silence'],
['**Defined in**','Configuration file','UI, API or amtool'],
['**Trigger**','Another alert is firing','A person at a time'],
['**Duration**','As long as the source fires','Fixed time window'],
['**Use for**','Known dependencies (node down, cluster down)','Planned maintenance, known issues']]},
{h:'Time-based muting'},
{p:'**Time intervals** let a route be muted or active at certain times, such as nights and weekends for non-urgent alerts.'},
{code:`time_intervals:
  - name: office-hours
    time_intervals:
      - weekdays: ["monday:friday"]
        times:
          - start_time: "08:00"
            end_time: "18:00"

route:
  routes:
    - matchers: ['severity="info"']
      receiver: team-email
      active_time_intervals: ["office-hours"]`},
{note:'Silences expire. A silence with no end that someone forgot is a hidden outage risk, so always set a duration and a comment.'}],
src:[['Inhibition and silences',PA+'alertmanager/#inhibition'],['amtool and Alertmanager','https://github.com/prometheus/alertmanager#amtool']]};

/* ---------- 4: Designing good alerts ---------- */
L['prom:5:4']={blocks:[
{p:'A noisy alert system trains people to ignore it. The most important skill in alerting is deciding **what deserves to wake a person**. The guidance is consistent across Google SRE and the Prometheus documentation: alert on symptoms, keep alerts actionable and keep them few.'},
{h:'Symptoms over causes'},
{t:[['Cause (avoid paging on)','Symptom (page on)'],
['CPU is at 90%','Request latency above the SLO'],
['A pod restarted','Error ratio above threshold'],
['Disk at 80%','Disk will be full in 4 hours'],
['Database connection pool is 70% used','Checkout failing for users']]},
{p:'Causes are useful for **investigation**, so keep them on dashboards. Symptoms are what users feel, so alert on them.'},
{h:'Questions every alert must pass'},
{flow:['Does it indicate real or imminent user impact?','Does a human need to act now?','Is the action clear and documented?','Is it unique, not duplicated by another alert?','Can it clear itself if the problem is transient?']},
{h:'Page, ticket or dashboard'},
{t:[['Severity','Response','Example'],
['**critical** (page)','A human now, any hour','Error budget burning fast; service down'],
['**warning** (ticket)','Next working day','Disk filling in 3 days; certificate expires in 14 days'],
['**info** (dashboard)','Nobody is notified','Deployment happened; CPU slightly high']]},
{h:'Make alerts useful'},
{ul:['**A clear name and summary** that says what is wrong and where.','**A runbook_url** annotation with steps to diagnose and fix.','**A dashboard link** that opens on the right time range.','**Labels for routing** such as `team` and `severity`, not free text.']},
{h:'Reducing fatigue'},
{ul:['Use `for` so short blips do not notify.','Use **multi-window burn-rate** alerts for SLOs instead of one hard threshold.','Use **inhibition** so one failure produces one page.','Review alerts after every incident: delete or fix any that were noisy or never actionable.','Track the pages per on-call shift; aim for very few.']},
{h:'Burn-rate alert example'},
{code:`- alert: ErrorBudgetFastBurn
  expr: |
    (
      sum(rate(http_requests_total{code=~"5.."}[5m]))
        / sum(rate(http_requests_total[5m])) > (14.4 * 0.001)
    and
      sum(rate(http_requests_total{code=~"5.."}[1h]))
        / sum(rate(http_requests_total[1h])) > (14.4 * 0.001)
    )
  for: 2m
  labels:
    severity: critical`},
{p:'With a 99.9% SLO the budget is 0.1%. A burn rate of 14.4 over both a short and a long window means the budget will be gone in about two days if it continues, which justifies a page.'},
{note:'A good test: if you would not be willing to be woken up for it at 3 a.m., it should not be a page.'}],
src:[['Alerting best practices',PG+'alerting/']]};

/* ---------- 5: promtool ---------- */
L['prom:5:5']={blocks:[
{p:'Rules are code. Before they reach production you can **unit-test** them with `promtool` by feeding artificial time series and asserting which alerts fire and what values rules produce. This catches typos, wrong thresholds and wrong `for` durations.'},
{h:'Rule file under test'},
{code:`# rules/alerts.yml
groups:
  - name: demo
    rules:
      - record: job:http_requests:rate5m
        expr: sum by (job) (rate(http_requests_total[5m]))
      - alert: HighErrorRatio
        expr: |
          sum by (job) (rate(http_requests_total{code="500"}[5m]))
          / sum by (job) (rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error ratio on {{ $labels.job }}"`},
{h:'A test file'},
{code:`# tests/alerts_test.yml
rule_files:
  - ../rules/alerts.yml
evaluation_interval: 1m

tests:
  - interval: 1m
    input_series:
      # 1 request per second total, 10% of them errors, for 20 minutes
      - series: 'http_requests_total{job="api", code="200"}'
        values: '0+54x20'
      - series: 'http_requests_total{job="api", code="500"}'
        values: '0+6x20'

    promql_expr_test:
      - expr: job:http_requests:rate5m
        eval_time: 10m
        exp_samples:
          - labels: 'job:http_requests:rate5m{job="api"}'
            value: 1

    alert_rule_test:
      - eval_time: 3m             # not yet: for is 5m
        alertname: HighErrorRatio
        exp_alerts: []
      - eval_time: 10m
        alertname: HighErrorRatio
        exp_alerts:
          - exp_labels:
              severity: critical
              job: api
            exp_annotations:
              summary: "High error ratio on api"`},
{h:'Series notation'},
{t:[['Notation','Expands to'],
['`0+10x5`','0 10 20 30 40 50 (start 0, add 10, 5 times)'],
['`5x3`','5 5 5 5 (a constant)'],
['`1 _ _ 1`','1 then two missing samples then 1'],
['`stale`','A stale marker']]},
{h:'Run the tests'},
{code:`promtool check rules rules/alerts.yml
promtool test rules tests/alerts_test.yml
# SUCCESS`},
{h:'Put it in CI'},
{flow:['Developer changes a rule or threshold','Pull request runs promtool check and promtool test','Failing tests block the merge','Merged rules are deployed and reloaded']},
{note:'Test the boundaries: the value just below the threshold, the moment before `for` has elapsed and the moment it resolves.'}],
src:[['Unit testing for rules',PP+'configuration/unit_testing_rules/'],['promtool',PP+'command-line/promtool/']]};

/* ---------- 6: Practical ---------- */
L['prom:5:6']={blocks:[
{p:'In this practical you build three real alerts end to end: a **host down** alert, a **disk filling** alert and a **high error rate** alert. You then route them, test them and trigger one on purpose.'},
{h:'Step 1: the rules'},
{code:`# /etc/prometheus/rules/practical.yml
groups:
  - name: practical
    rules:
      - alert: HostDown
        expr: up{job="node"} == 0
        for: 2m
        labels: { severity: critical }
        annotations:
          summary: "{{ $labels.instance }} is down"
          description: "node_exporter on {{ $labels.instance }} has not answered for 2 minutes."

      - alert: DiskWillFillIn4Hours
        expr: |
          predict_linear(node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"}[1h], 4*3600) < 0
          and node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes < 0.4
        for: 15m
        labels: { severity: warning }
        annotations:
          summary: "{{ $labels.mountpoint }} on {{ $labels.instance }} will fill within 4 hours"

      - alert: HighErrorRate
        expr: |
          sum by (job) (rate(http_requests_total{code=~"5.."}[5m]))
          / sum by (job) (rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels: { severity: critical }
        annotations:
          summary: "More than 5% errors on {{ $labels.job }}"`},
{h:'Step 2: routing'},
{code:`route:
  receiver: slack-warnings
  group_by: ["alertname", "instance"]
  routes:
    - matchers: ['severity="critical"']
      receiver: pagerduty
receivers:
  - name: slack-warnings
    slack_configs:
      - api_url_file: /etc/alertmanager/slack-url
        channel: "#alerts"
        send_resolved: true
  - name: pagerduty
    pagerduty_configs:
      - routing_key_file: /etc/alertmanager/pd-key`},
{h:'Step 3: validate and test'},
{code:`promtool check rules /etc/prometheus/rules/practical.yml
promtool test rules tests/practical_test.yml
amtool check-config /etc/alertmanager/alertmanager.yml
amtool config routes test --config.file=/etc/alertmanager/alertmanager.yml severity=critical`},
{h:'Step 4: trigger one for real'},
{flow:['Reload Prometheus and Alertmanager','Stop node_exporter: sudo systemctl stop node_exporter','Watch /alerts: HostDown goes pending then firing after 2 minutes','Check the notification arrives in the right channel','Start node_exporter and confirm the resolved message']},
{h:'What to look for'},
{t:[['Symptom','Likely cause'],
['Alert stays pending forever','`for` longer than the condition stays true, or flapping data'],
['Firing in Prometheus, nothing in Alertmanager','`alerting` block wrong or network blocked'],
['In Alertmanager, no message','Route did not match, or receiver credentials wrong'],
['Duplicate notifications','Several Alertmanagers not clustered']]},
{note:'Congratulations: you now have the full alerting path working. Section 9 repeats alerting with Grafana, and Section 13 covers debugging when alerts do not behave.'}],
src:[['Alerting overview',PA+'overview/'],['Alerting rules',PP+'configuration/alerting_rules/']]};
})();
