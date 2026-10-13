/* LearnSphere - Prometheus and Grafana Quick Reference (cheat sheet).
   window.QREF['prom'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for Prometheus 2.x/3.x, Alertmanager 0.27+ and Grafana 10+. Defaults can change between releases. */
window.QREF=window.QREF||{};
window.QREF['prom']={title:'Prometheus and Grafana Quick Reference',blurb:'PromQL, ports, configuration, alerting and fixes for Prometheus, Alertmanager and Grafana, plus maps of the stack, scraping, alerting and Kubernetes.',hint:'target down',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every monitoring engineer should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Fundamentals and architecture'},
{acc:[
{t:'Pull-based monitoring',s:'Prometheus scrapes targets.',
 a:'Prometheus **pulls** metrics over HTTP from targets\' `/metrics` endpoints at a fixed interval and stores them in its time-series database. Short-lived jobs use the Pushgateway.',
 w:'A target that disappears is itself a signal: `up == 0`.',
 c:`curl -s localhost:9100/metrics | head`,see:[0,4,'Pull vs push monitoring and where Prometheus fits']},
{t:'Golden signals, RED and USE',s:'What to measure.',
 a:'**Four golden signals**: latency, traffic, errors, saturation. **RED** (rate, errors, duration) for services and **USE** (utilisation, saturation, errors) for resources.',
 w:'They give you a starting set of dashboards and alerts for anything.',
 c:`sum(rate(http_requests_total[5m]))`,see:[0,2,'The four golden signals, RED and USE methods']},
{t:'SLIs, SLOs and error budgets',s:'Reliability as a number.',
 a:'An **SLI** is a measurement, an **SLO** is a target for it, and the **error budget** is the allowed failure. Alert on budget burn rather than on every blip.',
 w:'It turns "is it reliable enough" into a decision.',
 c:`1 - (sum(rate(http_requests_total{code=~"5.."}[30d])) / sum(rate(http_requests_total[30d])))`,see:[0,3,'SLIs, SLOs, SLAs and error budgets']},
{t:'Components',s:'Server, exporters, Alertmanager, Grafana.',
 a:'The **Prometheus server** scrapes and stores, **exporters** expose metrics for systems that do not, **Alertmanager** routes alerts, and **Grafana** visualises. Loki and Tempo add logs and traces.',
 w:'Each component has one job and its own configuration.',
 c:`curl -s localhost:9090/-/healthy`,see:[1,0,'Components: server, time-series database, exporters, Pushgateway and Alertmanager']},
{t:'prometheus.yml',s:'Global, scrape configs and rule files.',
 a:'`global` sets intervals, `scrape_configs` lists jobs and discovery, `rule_files` points at recording and alerting rules, and `alerting` names Alertmanagers. `promtool check config` validates it.',
 w:'A bad file prevents reload, so always check before reloading.',
 c:`promtool check config /etc/prometheus/prometheus.yml
curl -X POST localhost:9090/-/reload`,see:[1,2,'prometheus.yml: global settings, scrape configs and rule files']},
{t:'TSDB and retention',s:'Local storage.',
 a:'Prometheus stores samples in blocks on local disk. Retention is by time (`--storage.tsdb.retention.time`) or size. Plan disk as roughly samples per second times bytes per sample times retention.',
 w:'Running out of disk loses data. Remote write is for long-term storage.',
 c:`curl -s localhost:9090/api/v1/status/tsdb | jq .data.headStats`,see:[1,4,'Storage: the TSDB, retention and disk sizing']}
]},

{h:'Metrics and PromQL'},
{acc:[
{t:'Data model',s:'Names, labels, series.',
 a:'A **time series** is a metric name plus a set of **labels**. Each unique label combination is a separate series. Labels are how you slice and aggregate.',
 w:'Everything in PromQL builds on this.',
 c:`up{job="node"}`,see:[2,0,'The data model: metric names, labels and time series']},
{t:'Metric types',s:'Counter, gauge, histogram, summary.',
 a:'A **counter** only increases (use `rate`). A **gauge** goes up and down. A **histogram** counts observations into buckets (use `histogram_quantile`). A **summary** reports quantiles client-side.',
 w:'Using the wrong function on a type gives meaningless results.',
 c:`rate(http_requests_total[5m])`,see:[2,1,'Metric types: counter, gauge, histogram and summary']},
{t:'Cardinality',s:'Labels can break Prometheus.',
 a:'Each unique label combination is a series with memory and disk cost. Unbounded values (user IDs, URLs) explode series count. Watch `prometheus_tsdb_head_series`.',
 w:'High cardinality is the most common cause of slow queries and OOMs.',
 c:`topk(10, count by (__name__)({__name__=~".+"}))`,see:[2,4,'Cardinality: why labels can break Prometheus']},
{t:'rate and increase',s:'Per-second change of counters.',
 a:'`rate(x[5m])` is the per-second average increase over the window. `increase` is the total. Use a window of at least four times the scrape interval. Handles counter resets.',
 w:'It is the function used most.',
 c:`rate(node_network_receive_bytes_total[5m])`,see:[4,1,'Counters and rate(), irate() and increase()']},
{t:'Aggregation',s:'sum by and without.',
 a:'`sum`, `avg`, `max`, `count` combine series. `by (label)` keeps listed labels, `without (label)` drops them. Aggregate **after** `rate`, not before.',
 w:'Aggregation order changes the answer.',
 c:`sum by (instance) (rate(http_requests_total[5m]))`,see:[4,2,'Aggregation: sum, avg, max, count and by/without']},
{t:'Histograms and quantiles',s:'Percentiles from buckets.',
 a:'`histogram_quantile(0.95, sum by (le) (rate(x_bucket[5m])))` estimates a percentile. Accuracy depends on bucket boundaries.',
 w:'Include `le` in the aggregation.',
 c:`histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))`,see:[4,4,'Histograms and histogram_quantile()']},
{t:'Recording rules',s:'Precompute expensive queries.',
 a:'A **recording rule** evaluates a query on a schedule and stores it as a new series with a naming convention `level:metric:operations`. Dashboards and alerts then use the cheap series.',
 w:'They make dashboards fast and give a single definition.',
 c:`promtool check rules rules.yml`,see:[4,7,'Recording rules: precomputing expensive queries']}
]},

{h:'Discovery and exporters'},
{acc:[
{t:'Exporters',s:'Metrics for things that do not speak Prometheus.',
 a:'An exporter translates another system\'s statistics into the exposition format (node_exporter, cAdvisor, database exporters, blackbox). Run one per host or per service.',
 w:'Check an exporter\'s own `/metrics` before blaming Prometheus.',
 c:`curl -s localhost:9100/metrics | grep node_cpu | head`,see:[3,0,'Exporters explained: official, community and custom']},
{t:'Service discovery',s:'Targets without hand-edited lists.',
 a:'`static_configs`, `file_sd`, DNS, EC2 and Kubernetes discovery produce target lists with metadata labels (`__meta_*`). Relabeling then selects and shapes them.',
 w:'It is how scrape configuration keeps up with changing infrastructure.',
 c:`curl -s localhost:9090/api/v1/targets | jq '.data.activeTargets | length'`,see:[3,5,'Service discovery: static, file_sd, DNS, EC2 and Kubernetes']},
{t:'Relabeling',s:'Shape targets and labels.',
 a:'`relabel_configs` act before scraping (keep, drop, rewrite target labels, set the address). `metric_relabel_configs` act after scraping on the metrics themselves.',
 w:'Wrong relabeling is a common reason for missing targets.',
 c:`curl -s localhost:9090/api/v1/targets | jq '.data.droppedTargets | length'`,see:[3,6,'Relabeling: shaping targets and labels']},
{t:'Blackbox probing',s:'Test from the outside.',
 a:'The blackbox exporter probes HTTP, TCP, ICMP and DNS endpoints and reports success and latency. Prometheus scrapes it with the target as a parameter.',
 w:'It measures what users see.',
 c:`curl 'localhost:9115/probe?target=https://example.com&module=http_2xx'`,see:[3,2,'Probing endpoints with the Blackbox Exporter']}
]},

{h:'Alerting and Grafana'},
{acc:[
{t:'Alerting rules',s:'expr, for, labels and annotations.',
 a:'A rule fires when `expr` returns series. `for` makes it wait (pending state) before firing. Labels drive routing, annotations carry text and links.',
 w:'A good alert says what is wrong, for whom and what to do.',
 c:`promtool check rules alerts.yml`,see:[5,0,'Alerting rules: expr, for, labels and annotations']},
{t:'Alertmanager routing',s:'Group, route, inhibit, silence.',
 a:'Alertmanager **groups** related alerts, **routes** them by label to receivers, **deduplicates** from replicas, **inhibits** dependent alerts and supports **silences**.',
 w:'It is what stops one outage from sending a hundred pages.',
 c:`amtool config routes test severity=critical team=db`,see:[5,1,'Alertmanager: routing, grouping and deduplication']},
{t:'Good alerts',s:'Symptoms over causes.',
 a:'Page on user-visible symptoms (error ratio, latency) and keep cause-based alerts as tickets or dashboards. Every page should be actionable.',
 w:'Alert fatigue makes real alerts get ignored.',
 c:`ALERTS{alertstate="firing"}`,see:[5,4,'Designing good alerts: symptoms over causes and reducing fatigue']},
{t:'Grafana data sources and dashboards',s:'Query and show.',
 a:'A Grafana **data source** connects to Prometheus (and Loki, Tempo). **Panels** hold queries, **variables** make a dashboard reusable, and provisioning stores dashboards as code.',
 w:'Dashboards as code can be reviewed and restored.',
 c:`curl -s -u admin:admin localhost:3000/api/datasources | jq '.[].name'`,see:[6,1,'Data sources: connecting Prometheus and others']},
{t:'Grafana alerting',s:'Rules, contact points, policies.',
 a:'Grafana-managed alerts use rules, **contact points** and **notification policies**. Data-source-managed alerts stay in Prometheus. Choose one place to own alerting.',
 w:'Duplicate alert systems cause duplicate pages.',
 c:`curl -s -u admin:admin localhost:3000/api/v1/provisioning/alert-rules | jq length`,see:[8,4,'Grafana-managed vs data-source-managed alerts']},
{t:'Loki and Tempo',s:'Logs and traces.',
 a:'**Loki** indexes labels, not log contents. **LogQL** filters and derives metrics. **Tempo** stores traces. Grafana correlates them with metrics through labels and trace IDs.',
 w:'Metrics tell you something is wrong, logs and traces tell you why.',
 c:`{app="web"} |= "error"`,see:[9,0,'Loki basics: labels, streams and why it is different']},
{t:'kube-prometheus-stack',s:'Monitoring Kubernetes.',
 a:'The Helm chart installs the Prometheus Operator, Prometheus, Alertmanager, Grafana, node-exporter and kube-state-metrics. **ServiceMonitor**, **PodMonitor** and **PrometheusRule** objects configure scraping and alerts.',
 w:'In Kubernetes you configure Prometheus with objects, not files.',
 c:`kubectl get servicemonitor,prometheusrule -A`,see:[10,2,'The operator model: ServiceMonitor, PodMonitor and PrometheusRule']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Four small maps of how the parts fit together: the stack, scrape pipeline, alert path and Kubernetes monitoring.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. The monitoring stack'},
{map:{title:'Stack map',h:328,trace:'A metric becomes an alert and a graph',
 hint:'Tap any box, or press A metric becomes an alert and a graph to follow a sample through the stack.',
 lines:[[215,52,463,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134','M562 80 L562 107 L340 107 L340 134',[437,164,463,164],'M562 192 L562 219 L454 219 L454 246','M226 248 L226 165 L562 165 L562 82'],
 nodes:[
 {id:'app',x:21,y:24,w:194,h:56,c:'ext',t:'Application',s:'/metrics',d:'Exposes metrics with a client library.',why:'Name and label carefully.',chk:`curl -s localhost:8080/metrics | head`,see:[2,5,'Instrumenting an application with a client library']},
 {id:'exp',x:243,y:24,w:194,h:56,c:'ext',t:'Exporter',s:'node_exporter etc.',d:'Exposes metrics for hosts and systems.',why:'One per host.',chk:`curl -s localhost:9100/metrics | head`,see:[3,0,'Exporters explained']},
 {id:'prom',x:465,y:24,w:194,h:56,c:'proc',t:'Prometheus server',s:'scrape and evaluate',d:'Scrapes targets at an interval and evaluates rules.',why:'Check the targets page.',chk:`curl -s localhost:9090/api/v1/targets | jq '.data.activeTargets[].health' | sort | uniq -c`,see:[1,0,'Components']},
 {id:'tsdb',x:21,y:136,w:194,h:56,c:'disk',t:'TSDB',s:'local blocks',d:'Stores samples on disk with a retention period.',why:'Size the disk.',chk:`du -sh /var/lib/prometheus`,see:[1,4,'Storage: the TSDB, retention and disk sizing']},
 {id:'rule',x:243,y:136,w:194,h:56,c:'proc',t:'Rules',s:'record and alert',d:'Recording rules precompute series and alerting rules produce alerts.',why:'Validate with promtool.',chk:`promtool check rules rules.yml`,see:[5,0,'Alerting rules']},
 {id:'am',x:465,y:136,w:194,h:56,c:'proc',t:'Alertmanager',s:'route and group',d:'Receives alerts and sends notifications.',why:'Run in a cluster.',chk:`amtool alert`,see:[5,1,'Alertmanager']},
 {id:'graf',x:126,y:248,w:200,h:56,c:'mem',t:'Grafana',s:'dashboards',d:'Queries Prometheus and shows results.',why:'Use variables.',chk:`curl -s localhost:3000/api/health`,see:[6,0,'Installing Grafana and a tour of the interface']},
 {id:'rcv',x:354,y:248,w:200,h:56,c:'net',t:'Receivers',s:'email, Slack, pager',d:'Where notifications arrive.',why:'Test them.',chk:`amtool alert add test severity=warning`,see:[5,2,'Receivers']}],
 steps:[
 {ids:['app','exp'],t:'1. Applications and exporters expose current values at /metrics.',w:'Plain text over HTTP.',s:'Exposition format.',x:'Endpoint unreachable.',c:`curl -s localhost:9100/metrics | head`},
 {ids:['prom','tsdb'],t:'2. Prometheus scrapes and writes samples to the TSDB.',w:'History for queries.',s:'scrape_interval.',x:'Scrape timeouts.',c:`curl -s localhost:9090/api/v1/targets | jq`},
 {ids:['rule','am'],t:'3. Rules are evaluated and firing alerts go to Alertmanager.',w:'Detection to routing.',s:'evaluation_interval.',x:'Rule errors.',c:`curl -s localhost:9090/api/v1/rules | jq`},
 {ids:['rcv'],t:'4. Alertmanager groups and sends to receivers.',w:'One notification, not many.',s:'Routes.',x:'Misrouted alerts.',c:`amtool config routes show`},
 {ids:['graf'],t:'5. Grafana queries Prometheus for dashboards.',w:'Humans see trends.',s:'Data source.',x:'Slow queries.',c:`curl -s localhost:3000/api/health`}]}},

{h:'2. From discovery to stored series'},
{map:{title:'Scrape pipeline map',h:216,trace:'Follow a target to a series',
 hint:'Tap any box, or press Follow a target to a series to see discovery, relabeling and scraping.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'sd',x:126,y:24,w:200,h:56,c:'ext',t:'Service discovery',s:'list of targets',d:'Static, file, DNS, cloud or Kubernetes discovery produces targets with metadata.',why:'Metadata labels start with __meta_.',chk:`curl -s localhost:9090/api/v1/targets/metadata | head`,see:[3,5,'Service discovery']},
 {id:'rl',x:354,y:24,w:200,h:56,c:'proc',t:'relabel_configs',s:'select and shape',d:'Keep or drop targets and set labels such as job and instance.',why:'Debug on the Service Discovery page.',chk:`curl -s localhost:9090/api/v1/targets | jq '.data.droppedTargets | length'`,see:[3,6,'Relabeling']},
 {id:'scr',x:21,y:136,w:194,h:56,c:'proc',t:'Scrape',s:'HTTP GET',d:'Prometheus requests /metrics with a timeout.',why:'`up` records success.',chk:`up`,see:[1,3,'Your first scrape']},
 {id:'mrl',x:243,y:136,w:194,h:56,c:'proc',t:'metric_relabel_configs',s:'after scrape',d:'Drop or rewrite metrics and labels after they are scraped.',why:'A cheap fix for cardinality.',chk:`grep -n metric_relabel prometheus.yml`,see:[2,4,'Cardinality']},
 {id:'tsdb',x:465,y:136,w:194,h:56,c:'disk',t:'TSDB',s:'stored series',d:'Samples are written to the head block and later compacted.',why:'Retention applies.',chk:`curl -s localhost:9090/api/v1/status/tsdb | jq`,see:[1,4,'Storage']}],
 steps:[
 {ids:['sd','rl'],t:'1. Discovery finds targets and relabeling decides which to scrape and with which labels.',w:'Configuration follows infrastructure.',s:'relabel_configs.',x:'Dropped by mistake.',c:`curl -s localhost:9090/api/v1/targets | jq '.data.droppedTargets | length'`},
 {ids:['scr'],t:'2. Prometheus scrapes each target and records `up`.',w:'A health signal.',s:'Interval and timeout.',x:'Timeout shorter than the response time.',c:`up == 0`},
 {ids:['mrl','tsdb'],t:'3. Metric relabeling filters samples before they are stored.',w:'Controls cardinality.',s:'metric_relabel_configs.',x:'Dropping labels that make series collide.',c:`prometheus_tsdb_head_series`}]}},

{h:'3. The alert path'},
{map:{title:'Alert path map',h:328,trace:'From a rule to a page',
 hint:'Tap any box, or press From a rule to a page to follow an alert through its states and routing.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'exp',x:21,y:24,w:194,h:56,c:'proc',t:'Rule expression',s:'PromQL',d:'Evaluated at the rule interval. Series returned make alerts.',why:'Test the query first.',chk:`curl -s 'localhost:9090/api/v1/query?query=up==0' | jq`,see:[5,0,'Alerting rules']},
 {id:'pend',x:243,y:24,w:194,h:56,c:'mem',t:'Pending',s:'for: 5m',d:'The condition is true but the `for` time has not elapsed.',why:'Filters flapping.',chk:`ALERTS{alertstate="pending"}`,see:[5,0,'Alerting rules']},
 {id:'fire',x:465,y:24,w:194,h:56,c:'warn',t:'Firing',s:'sent',d:'The alert is sent to Alertmanager repeatedly while active.',why:'Resolves when false.',chk:`ALERTS{alertstate="firing"}`,see:[5,0,'Alerting rules']},
 {id:'grp',x:21,y:136,w:194,h:56,c:'proc',t:'Group',s:'group_by',d:'Alerts with the same grouping labels are bundled in one notification.',why:'Group by alertname and cluster.',chk:`amtool config show | grep -A5 group_by`,see:[5,1,'Alertmanager']},
 {id:'rt',x:243,y:136,w:194,h:56,c:'proc',t:'Route',s:'match labels',d:'A routing tree sends alerts to receivers by label.',why:'Test with amtool.',chk:`amtool config routes test severity=critical`,see:[5,1,'Alertmanager']},
 {id:'inh',x:465,y:136,w:194,h:56,c:'mem',t:'Inhibit',s:'suppress dependents',d:'A firing alert can mute related ones, such as node down muting its service alerts.',why:'Reduces noise.',chk:`grep -n inhibit_rules alertmanager.yml`,see:[5,3,'Inhibition and silences']},
 {id:'sil',x:126,y:248,w:200,h:56,c:'mem',t:'Silence',s:'temporary mute',d:'A time-limited mute by matchers for maintenance.',why:'Set an expiry and a comment.',chk:`amtool silence add alertname=HighLatency -d 2h -c 'maintenance'`,see:[5,3,'Inhibition and silences']},
 {id:'rcv',x:354,y:248,w:200,h:56,c:'net',t:'Receiver',s:'notification',d:'Sends the notification to email, chat or a paging service.',why:'Test it.',chk:`amtool alert add test severity=critical`,see:[5,2,'Receivers']}],
 steps:[
 {ids:['exp','pend'],t:'1. The expression returns series and the alert goes pending.',w:'Wait for stability.',s:'for.',x:'for set to zero.',c:`ALERTS{alertstate="pending"}`},
 {ids:['fire'],t:'2. After `for` the alert is firing and sent.',w:'A real problem.',s:'Labels.',x:'Missing severity label.',c:`ALERTS{alertstate="firing"}`},
 {ids:['grp','rt'],t:'3. Alertmanager groups and routes by labels.',w:'To the right team.',s:'Routing tree.',x:'Misrouted alert.',c:`amtool config routes test severity=critical`},
 {ids:['inh','sil'],t:'4. Inhibition and silences remove noise.',w:'Fewer pages.',s:'Rules.',x:'A silence that never expires.',c:`amtool silence query`},
 {ids:['rcv'],t:'5. The receiver sends the notification.',w:'A person is told.',s:'Receiver config.',x:'Wrong webhook URL.',c:`amtool alert`}]}},

{h:'4. Monitoring Kubernetes'},
{map:{title:'Kubernetes monitoring map',h:216,trace:'From a ServiceMonitor to a panel',
 hint:'Tap any box, or press From a ServiceMonitor to a panel to follow Kubernetes monitoring.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'app',x:21,y:24,w:194,h:56,c:'ext',t:'Application pods',s:'/metrics',d:'Pods expose metrics on a named port.',why:'Name the port.',chk:`kubectl get pods -l app=web -o wide`,see:[10,4,'Monitoring your own applications on Kubernetes']},
 {id:'svc',x:243,y:24,w:194,h:56,c:'net',t:'Service',s:'selects pods',d:'A Service with labels and a named port.',why:'The ServiceMonitor selects it.',chk:`kubectl get svc -l app=web`,see:[10,2,'The operator model']},
 {id:'sm',x:465,y:24,w:194,h:56,c:'proc',t:'ServiceMonitor',s:'scrape definition',d:'Declares which Services to scrape, on which port and path.',why:'Match the release label.',chk:`kubectl get servicemonitor -A`,see:[10,2,'The operator model: ServiceMonitor, PodMonitor and PrometheusRule']},
 {id:'op',x:21,y:136,w:194,h:56,c:'proc',t:'Prometheus Operator',s:'generates config',d:'Watches the objects and generates Prometheus configuration.',why:'Check its logs.',chk:`kubectl -n monitoring logs deploy/prometheus-operator | tail`,see:[10,1,'kube-prometheus-stack: installing with Helm']},
 {id:'prom',x:243,y:136,w:194,h:56,c:'proc',t:'Prometheus',s:'scrapes',d:'Scrapes the discovered pods and stores series.',why:'Check Targets.',chk:`kubectl -n monitoring port-forward svc/prometheus-operated 9090`,see:[10,1,'kube-prometheus-stack']},
 {id:'graf',x:465,y:136,w:194,h:56,c:'mem',t:'Grafana',s:'dashboards',d:'Ships with cluster dashboards from kube-state-metrics and node-exporter.',why:'Add your own as ConfigMaps.',chk:`kubectl -n monitoring get cm -l grafana_dashboard=1`,see:[10,5,'Cluster alerts and dashboards to start with']}],
 steps:[
 {ids:['app','svc'],t:'1. Pods expose metrics and a Service selects them.',w:'A stable handle.',s:'Labels, port name.',x:'Port has no name.',c:`kubectl get svc,ep -l app=web`},
 {ids:['sm','op'],t:'2. A ServiceMonitor tells the operator what to scrape.',w:'Configuration as objects.',s:'Selectors.',x:'Release label mismatch.',c:`kubectl get servicemonitor -A`},
 {ids:['prom','graf'],t:'3. Prometheus scrapes and Grafana shows the data.',w:'End to end.',s:'Data source.',x:'Target missing.',c:`kubectl -n monitoring get pods`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Four small maps of how something happens, step by step: adding a target, writing an alert, a down target and a cardinality explosion.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Adding a new target'},
{map:{title:'New target map',h:216,trace:'Monitor a new service',
 hint:'Tap any box, or press Monitor a new service to follow adding a target.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'exp',x:21,y:24,w:194,h:56,c:'ext',t:'Expose metrics',s:'exporter or library',d:'Install an exporter or add a client library.',why:'Check /metrics.',chk:`curl -s localhost:9187/metrics | head`,see:[3,0,'Exporters explained']},
 {id:'cfg',x:243,y:24,w:194,h:56,c:'proc',t:'Add to scrape config',s:'job',d:'Add a scrape job or discovery for the target.',why:'Validate before reload.',chk:`promtool check config prometheus.yml`,see:[1,2,'prometheus.yml']},
 {id:'val',x:465,y:24,w:194,h:56,c:'mem',t:'Reload and verify',s:'targets page',d:'Reload and confirm the target is UP.',why:'Look at the error column.',chk:`curl -X POST localhost:9090/-/reload`,see:[1,3,'Your first scrape: targets page and the expression browser']},
 {id:'chk',x:21,y:136,w:194,h:56,c:'mem',t:'Query it',s:'expression',d:'Run a basic query to see data and labels.',why:'Check label names.',chk:`up{job="postgres"}`,see:[4,0,'Selectors, matchers and instant vs range vectors']},
 {id:'dash',x:243,y:136,w:194,h:56,c:'mem',t:'Dashboard',s:'panels',d:'Create or import a dashboard.',why:'Use variables.',chk:`curl -s -u admin:admin localhost:3000/api/search | jq length`,see:[7,4,'Importing and customising community dashboards']},
 {id:'alr',x:465,y:136,w:194,h:56,c:'warn',t:'Alerts',s:'at least down',d:'Add an alert for down and one symptom.',why:'Test with promtool.',chk:`promtool test rules tests.yml`,see:[5,5,'Testing rules with promtool']}],
 steps:[
 {ids:['exp','cfg'],t:'1. Expose metrics and add the scrape job.',w:'Prometheus can find it.',s:'Job name.',x:'Wrong port.',c:`promtool check config prometheus.yml`},
 {ids:['val','chk'],t:'2. Reload, check the target and query data.',w:'Prove it works.',s:'Reload.',x:'Firewall blocks the port.',c:`up{job="postgres"}`},
 {ids:['dash','alr'],t:'3. Add a dashboard and alerts.',w:'Make it useful.',s:'Rules.',x:'No alert for down.',c:`promtool test rules tests.yml`}]}},

{h:'2. Writing and testing an alert'},
{map:{title:'Alert writing map',h:328,trace:'From idea to a tested alert',
 hint:'Tap any box, or press From idea to a tested alert to follow writing an alert.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'sym',x:126,y:24,w:200,h:56,c:'mem',t:'Define the symptom',s:'user impact',d:'Decide what a user would notice: errors, latency, down.',why:'Page on symptoms.',chk:`sum(rate(http_requests_total{code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))`,see:[5,4,'Designing good alerts']},
 {id:'q',x:354,y:24,w:200,h:56,c:'proc',t:'Write the query',s:'PromQL',d:'Write and check the expression in the expression browser.',why:'Check labels.',chk:`curl -s 'localhost:9090/api/v1/query?query=...' | jq`,see:[4,6,'Common query patterns: error ratio, saturation and availability']},
 {id:'rule',x:126,y:136,w:200,h:56,c:'proc',t:'Rule definition',s:'for, labels, annotations',d:'Add `for`, a severity label and a useful annotation.',why:'Include a runbook link.',chk:`promtool check rules alerts.yml`,see:[5,0,'Alerting rules']},
 {id:'tst',x:354,y:136,w:200,h:56,c:'mem',t:'Unit test',s:'promtool test rules',d:'Feed sample series and assert the alert fires.',why:'Run in CI.',chk:`promtool test rules alerts_test.yml`,see:[5,5,'Testing rules with promtool']},
 {id:'rte',x:240,y:248,w:200,h:56,c:'proc',t:'Route',s:'to a receiver',d:'Make sure the severity and team labels route to the right receiver.',why:'Test routes.',chk:`amtool config routes test severity=critical team=web`,see:[5,1,'Alertmanager']}],
 steps:[
 {ids:['sym','q'],t:'1. Choose the symptom and write the query.',w:'Meaningful alerts.',s:'Query.',x:'A cause-based alert.',c:`curl -s 'localhost:9090/api/v1/query?query=...'`},
 {ids:['rule','tst'],t:'2. Write the rule and unit test it.',w:'No surprises in production.',s:'promtool.',x:'Missing test.',c:`promtool test rules alerts_test.yml`},
 {ids:['rte'],t:'3. Confirm routing.',w:'It reaches a person.',s:'Labels.',x:'Missing severity label.',c:`amtool config routes test severity=critical`}]}},

{h:'3. Finding why a target is down'},
{map:{title:'Target down map',h:328,trace:'Missing data or UP=0',
 hint:'Tap any box, or press Missing data or UP=0 to follow the triage.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'up',x:126,y:24,w:200,h:56,c:'mem',t:'Targets page',s:'health and error',d:'Shows each target, its last scrape and the error text.',why:'Read the error first.',chk:`curl -s localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health!="up") | .lastError'`,see:[12,0,'Targets down, missing data and stale series']},
 {id:'err',x:354,y:24,w:200,h:56,c:'warn',t:'Error message',s:'what it says',d:'Connection refused, timeout, context deadline, bad status, TLS error.',why:'Each points to a different layer.',chk:`curl -v http://target:9100/metrics`,see:[12,0,'Targets down']},
 {id:'net',x:126,y:136,w:200,h:56,c:'net',t:'Network',s:'reachability',d:'Firewall, security group, DNS or wrong port.',why:'Test from the Prometheus host.',chk:`nc -vz target 9100`,see:[12,0,'Targets down']},
 {id:'tls',x:354,y:136,w:200,h:56,c:'warn',t:'TLS and auth',s:'certificates',d:'Expired certificate or wrong credentials.',why:'Check scheme and tls_config.',chk:`openssl s_client -connect target:9100 -brief`,see:[11,4,'Securing the stack: TLS, authentication and reverse proxies']},
 {id:'cfg',x:126,y:248,w:200,h:56,c:'mem',t:'Scrape config',s:'port and path',d:'A wrong metrics path, port or scheme.',why:'Compare with the exporter.',chk:`grep -n metrics_path prometheus.yml`,see:[1,2,'prometheus.yml']},
 {id:'rl',x:354,y:248,w:200,h:56,c:'warn',t:'Relabeling',s:'dropped target',d:'A relabel rule dropped the target, so it is not on the page.',why:'Check the Service Discovery page.',chk:`curl -s localhost:9090/api/v1/targets | jq '.data.droppedTargets | length'`,see:[3,6,'Relabeling']}],
 steps:[
 {ids:['up','err'],t:'1. Open the targets page and read the error.',w:'It names the layer.',s:'UI.',x:'Looking at the dashboard first.',c:`curl -s localhost:9090/api/v1/targets`},
 {ids:['net','tls'],t:'2. Test the network and TLS from the Prometheus host.',w:'Same path as the scrape.',s:'Firewall.',x:'Testing from a laptop.',c:`curl -v http://target:9100/metrics`},
 {ids:['cfg','rl'],t:'3. Check the scrape config and relabeling.',w:'Configuration mistakes.',s:'Port, path.',x:'Target dropped by relabel.',c:`promtool check config prometheus.yml`}]}},

{h:'4. Handling a cardinality explosion'},
{map:{title:'Cardinality map',h:216,trace:'Find and fix runaway series',
 hint:'Tap any box, or press Find and fix runaway series to follow the triage.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'sym',x:126,y:24,w:200,h:56,c:'warn',t:'Symptoms',s:'memory and slow queries',d:'Rising head series, memory growth, slow queries or OOM.',why:'Check `prometheus_tsdb_head_series`.',chk:`prometheus_tsdb_head_series`,see:[12,1,'Slow queries, high memory and cardinality explosions']},
 {id:'top',x:354,y:24,w:200,h:56,c:'mem',t:'Find the top metric',s:'tsdb status',d:'The TSDB status page lists the metrics and labels with the most series.',why:'Start from the top.',chk:`curl -s localhost:9090/api/v1/status/tsdb | jq '.data.seriesCountByMetricName[:5]'`,see:[2,4,'Cardinality']},
 {id:'lbl',x:126,y:136,w:200,h:56,c:'warn',t:'Find the label',s:'unbounded value',d:'Identify the label with many values: user ID, URL path, pod hash.',why:'Count distinct values.',chk:`count(count by (path) (http_requests_total))`,see:[2,4,'Cardinality']},
 {id:'fix',x:354,y:136,w:200,h:56,c:'proc',t:'Fix at the source',s:'client or relabel',d:'Remove the label in the application, or drop it with metric_relabel_configs as a stop-gap.',why:'Fix the code too.',chk:`grep -n metric_relabel prometheus.yml`,see:[11,3,'Capacity planning and cardinality control']}],
 steps:[
 {ids:['sym','top'],t:'1. Confirm growth in series and find the biggest metric.',w:'Data, not guesses.',s:'TSDB status.',x:'Looking at CPU only.',c:`prometheus_tsdb_head_series`},
 {ids:['lbl'],t:'2. Find the label that creates the series.',w:'Cause identified.',s:'Query.',x:'Several labels at once.',c:`count(count by (path) (http_requests_total))`},
 {ids:['fix'],t:'3. Remove or drop it and watch the series count fall.',w:'Stable memory.',s:'Relabeling.',x:'Series linger until the head compacts.',c:`prometheus_tsdb_head_series`}]}},

]},

{t:'PromQL cookbook',d:'Queries used most, with what each one answers.',see:[[4,1,'Counters and rate(), irate() and increase()'],[4,6,'Common query patterns: error ratio, saturation and availability']],b:[
{t:[['Question','Query'],['Is it up?','`up == 0`'],['Request rate','`sum by (service) (rate(http_requests_total[5m]))`'],['Error ratio','`sum(rate(http_requests_total{code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))`'],['95th percentile latency','`histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))`'],['CPU use per host','`1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))`'],['Memory available','`node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes`'],['Disk full in 4 hours','`predict_linear(node_filesystem_avail_bytes[1h], 4*3600) < 0`'],['Top 5 series','`topk(5, sum by (instance) (rate(node_network_receive_bytes_total[5m])))`'],['Compare to yesterday','`rate(x[5m]) / rate(x[5m] offset 1d)`'],['Absent data','`absent(up{job="api"})`']]}
]},
{t:'Ports, files and flags',d:'Default ports of the stack and the files and flags that matter.',see:[[1,1,'Installing Prometheus: binary, package, Docker and Helm'],[1,4,'Storage: the TSDB, retention and disk sizing']],b:[
{t:[['Item','Value','Note'],['Prometheus','9090','UI and API'],['Alertmanager','9093 (9094 cluster)','Alerts API and cluster gossip'],['Grafana','3000','UI and API'],['node_exporter','9100','Host metrics'],['cAdvisor','8080','Container metrics'],['Blackbox exporter','9115','Probes'],['Pushgateway','9091','Batch jobs'],['Loki','3100','Log API'],['Tempo','3200','Trace API'],['`--storage.tsdb.retention.time`','15d default','Retention'],['`--web.enable-lifecycle`','flag','Allows /-/reload over HTTP'],['`--web.enable-remote-write-receiver`','flag','Accept remote write']]}
]},
{t:'Troubleshooting lookup',d:'Symptom, likely cause and first step for common monitoring problems.',see:[[12,0,'Targets down, missing data and stale series'],[12,2,'Alerts that do not fire or fire too often']],b:[
{t:[['Symptom','Likely cause','First step'],['Target DOWN','Network, port, TLS or exporter down','Targets page error, `curl` from the Prometheus host'],['No data in a panel','Wrong data source, query or time range','Run the query in Explore'],['Gaps in a graph','Scrape failures or restarts','Check `up` and scrape duration'],['Query is slow','High cardinality, long range','Use recording rules, narrow selectors'],['Prometheus OOM','Too many series','TSDB status page, drop labels'],['Alert never fires','Expression returns nothing, `for` too long','Run the expression, check Alerts page'],['Alert flaps','No `for` or threshold at the edge','Add `for`, use averages'],['Alert fires but no notification','Routing, silence or inhibition','`amtool config routes test`, check silences'],['Rate looks wrong','Window too small or counter reset','Use at least 4x scrape interval'],['Stale series','Target removed or renamed','Wait for staleness (5 minutes)']]}
]},
{t:'Configuration snippets',d:'Minimal examples of the files you edit most.',see:[[1,2,'prometheus.yml: global settings, scrape configs and rule files'],[5,1,'Alertmanager: routing, grouping and deduplication']],b:[
{code:`# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
rule_files:
  - /etc/prometheus/rules/*.yml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
scrape_configs:
  - job_name: node
    static_configs:
      - targets: ['host1:9100', 'host2:9100']`},
{code:`# alerting rule
groups:
  - name: availability
    rules:
      - alert: InstanceDown
        expr: up == 0
        for: 5m
        labels: {severity: page}
        annotations:
          summary: "{{ $labels.instance }} is down"`},
{code:`# alertmanager.yml
route:
  receiver: default
  group_by: [alertname, cluster]
  routes:
    - matchers: [severity="page"]
      receiver: oncall
receivers:
  - name: default
  - name: oncall`}
]},
]};
