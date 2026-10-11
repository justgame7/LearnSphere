/* LearnSphere - Prometheus & Grafana, Section 13: Troubleshooting, Best Practices & Exam Preparation.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs prom-common.js. */
(function(){
const K=window.PM,L=window.LESSONS,PP=K.PP,PA=K.PA,G=K.G;

/* ---------- diagrams ---------- */
const down=K.dg(700,200,[
[10,10,680,180,'Follow the data from the target to the graph',1],
[30,60,110,60,'Target|process running?|port open?',0],[170,60,110,60,'Network|firewall,|DNS, TLS',0],[310,60,110,60,'Scrape|timeout,|auth, parse',0],[450,60,110,60,'Storage|series created,|limits, relabel',0],[590,60,80,60,'Query|selector,|time range',0]],
[[140,90,170,90],[280,90,310,90],[420,90,450,90],[560,90,590,90]]);

const alertpath=K.dg(700,200,[
[10,10,680,180,'Where does an alert get lost?',1],
[30,60,110,60,'Rule loaded?|/rules',0],[170,60,110,60,'Expr returns|series?|/graph',0],[310,60,110,60,'Fired?|pending vs for|/alerts',0],[450,60,110,60,'Reached|Alertmanager?|/alerts',0],[590,60,80,60,'Routed|and sent?',0]],
[[140,90,170,90],[280,90,310,90],[420,90,450,90],[560,90,590,90]]);

const capstone=K.dg(700,260,[
[10,10,680,240,'Capstone: a three-tier shop',1],
[30,50,120,50,'Browser|synthetic users',0],[190,50,120,50,'web|nginx',0],[350,50,120,50,'api|Python app|/metrics',2],[510,50,120,50,'db|PostgreSQL',0],
[190,150,120,50,'blackbox|probes web',0],[350,150,120,50,'node_exporter|host',0],[510,150,120,50,'postgres_|exporter',0],
[30,215,120,28,'Prometheus',2],[190,215,120,28,'Alertmanager',0],[350,215,120,28,'Grafana',2]],
[[150,75,190,75],[310,75,350,75],[470,75,510,75],[250,150,250,100],[410,150,410,100],[570,150,570,100]]);

/* ---------- 0: Targets down ---------- */
L['prom:12:0']={blocks:[
{p:'"I do not see my data" is the most common monitoring problem. It is also the easiest to solve, because the data path is short and each step can be checked. Work through the path **from the source to the screen**.'},
{svg:down},
{h:'Step 1: is the target scraped?'},
{p:'Open **Status, then Targets**. Find the job and read the **Error** column.'},
{t:[['Error text','Meaning','Fix'],
['`connection refused`','Nothing listening on that address and port','Start the exporter; check port and bind address'],
['`context deadline exceeded`','Scrape took longer than `scrape_timeout`, or network drops','Check target performance, firewall; raise timeout (must be below interval)'],
['`no such host`','DNS failure','Fix the name or service discovery'],
['`server returned HTTP status 401/403`','Authentication or authorisation','Configure `basic_auth` or `authorization`'],
['`server returned HTTP status 404`','Wrong `metrics_path`','Set the correct path'],
['`x509: certificate signed by unknown authority`','TLS trust problem','Add `tls_config.ca_file`'],
['`expected value after metric` or `invalid metric type`','The page is not valid exposition format','`curl` the URL and inspect it']]},
{h:'Step 2: check from the Prometheus host'},
{code:`curl -sv --max-time 5 http://target:9100/metrics | head
# is DNS resolved? is the TCP connection open? is the status 200? is it text?`},
{h:'Step 3: samples arrive but series are missing'},
{ul:['**Relabeling dropped it:** compare `/service-discovery` before and after, and review `metric_relabel_configs`.','**Limits:** `sample_limit` or `label_limit` rejects the scrape (`scrape_samples_scraped`, error text mentions limit).','**Duplicates:** two series with the same labels in one scrape produce an error; fix the exporter or labels.']},
{h:'Step 4: the query'},
{code:`count({__name__="my_metric"})        # does the series exist at all?
count({__name__=~"my_met.*"})        # misspelt name?
my_metric[10m]                       # are samples in the time range?
up{job="myjob"}                      # is the job scraped?`},
{ul:['Check the **time range** and that clocks are in sync (NTP), because future or past timestamps break queries.','A series that stops being reported becomes **stale** after the last scrape and disappears from instant queries.','Selectors are exact: `job="Node"` is not `job="node"`.']},
{h:'The short checklist'},
{flow:['Targets page: UP or DOWN, and the error','curl the endpoint from the Prometheus host','Compare discovery and relabeling output','Query the series by name and by up','Check time range, labels and spelling']},
{note:'The built-in metrics `up`, `scrape_duration_seconds`, `scrape_samples_scraped` and `scrape_samples_post_metric_relabeling` exist for every target and tell you what Prometheus saw.'}],
src:[['Targets and troubleshooting',K.PI+'faq/'],['Configuration',PP+'configuration/configuration/']]};

/* ---------- 1: Slow queries ---------- */
L['prom:12:1']={blocks:[
{p:'Prometheus slows down or runs out of memory for a small number of reasons: too many series, too many or too expensive queries, and too much churn. Find which one, then fix at the source.'},
{h:'Symptoms and first checks'},
{t:[['Symptom','Look at'],
['Dashboards slow or timing out','`prometheus_engine_query_duration_seconds`, query log, panel queries'],
['Memory keeps growing, OOM kills','`prometheus_tsdb_head_series`, `process_resident_memory_bytes`'],
['Slow start after restart','WAL replay time; many head series and a large WAL'],
['Disk full','Retention, block size, `prometheus_tsdb_storage_blocks_bytes`'],
['CPU high','Rule evaluation duration, compaction, expensive queries']]},
{h:'Find the expensive queries'},
{code:`# prometheus.yml
global:
  query_log_file: /var/log/prometheus/query.log   # JSON log of queries and timings

# slowest rule groups
topk(10, prometheus_rule_group_last_duration_seconds)

# queries by phase
rate(prometheus_engine_query_duration_seconds_sum[5m])
/ rate(prometheus_engine_query_duration_seconds_count[5m])`},
{h:'Query patterns that cost a lot'},
{t:[['Pattern','Why it is costly','Alternative'],
['`{__name__=~".+"}` or very broad regex','Touches every series','Narrow by metric and job'],
['Long ranges with no aggregation','Many raw samples','Recording rule, lower resolution'],
['Large subqueries','Re-run the inner query many times','Record the inner expression'],
['`count by (label)` over high-cardinality metrics','Walks all series','Fix the label'],
['Dashboards with many panels and short refresh','Query storms','Longer refresh, fewer panels, caching']]},
{h:'Cardinality explosion'},
{code:`# What exploded?
topk(10, count by (__name__) ({__name__=~".+"}))
topk(10, count by (job) ({__name__=~".+"}))
rate(prometheus_tsdb_head_series_created_total[5m])    # churn: new series per second`},
{p:'**Churn** means series appear and disappear quickly, for example with every pod restart or deployment (a label like `pod` or `build_id`). It inflates the head and the index even if the count at one moment looks small.'},
{flow:['Alert fires on head series growth or memory','Identify the metric and label with the TSDB status page','Fix the application or drop the label via relabeling','Wait for old series to leave the head (about 2 hours)','Add sample_limit and a growth alert so it cannot repeat']},
{note:'Cure the cause, not the symptom. Adding RAM to survive a bad label only delays the next crash.'}],
src:[['Query log',PP+'configuration/configuration/#configuration-file'],['TSDB status',PP+'storage/']]};

/* ---------- 2: Alerts ---------- */
L['prom:12:2']={blocks:[
{p:'An alert that does not fire during an outage is dangerous. An alert that fires constantly is useless. Both are debugged by tracing the path from the **rule** to the **notification**.'},
{svg:alertpath},
{h:'Alert never fires'},
{t:[['Check','How','Typical finding'],
['**Rule loaded?**','`/rules` page, `promtool check rules`','File not in `rule_files`, YAML error, not reloaded'],
['**Expression returns data?**','Run `expr` in the graph','Typo in the selector or label; no series'],
['**Stuck pending?**','`/alerts` page','Condition is true for shorter than `for`'],
['**Evaluation errors?**','`prometheus_rule_evaluation_failures_total`','Query error or timeout'],
['**Reached Alertmanager?**','Alertmanager UI, `/api/v2/alerts`','`alerting` block wrong, network issue'],
['**Routed?**','`amtool config routes test`','No matching route, falls to default'],
['**Silenced or inhibited?**','Alertmanager UI','Old silence, inhibition rule'],
['**Sent?**','`alertmanager_notifications_failed_total`, logs','Webhook URL, API key, SMTP errors']]},
{h:'Alert fires too often'},
{ul:['**Flapping:** add or lengthen `for`, add `keep_firing_for`, use a wider `rate()` window.','**Too many separate pages:** change `group_by`, add inhibition, aggregate in the expression.','**Repeats:** `repeat_interval` too short.','**Cause alerts:** replace with symptom alerts and move the cause to dashboards.','**Threshold too tight:** base thresholds on real history, not guesses.']},
{h:'Test a route and a receiver'},
{code:`amtool config routes test --config.file=alertmanager.yml severity=critical team=db
amtool alert add test_alert severity=critical --annotation=summary="routing test" \\
  --alertmanager.url=http://localhost:9093`},
{h:'Staleness and absence'},
{p:'If a series disappears (the target died), a rule such as `error_ratio > 0.05` returns **nothing**, so the alert resolves rather than fires. Pair availability and error alerts with `absent()` or `up == 0` so "no data" is not mistaken for "healthy".'},
{code:`absent(up{job="payments"} == 1)`},
{note:'Keep one always-firing **Watchdog** alert routed to an external dead-man-switch. If it stops arriving, the alerting pipeline itself is broken.'}],
src:[['Alerting rules',PP+'configuration/alerting_rules/'],['Alertmanager configuration',PA+'configuration/']]};

/* ---------- 3: Grafana problems ---------- */
L['prom:12:3']={blocks:[
{p:'Grafana failures usually fall into four groups: it cannot reach the data source, it reaches it but the query returns nothing, it is slow, or people lack permission. Each has a quick test.'},
{h:'Data source problems'},
{t:[['Symptom','Likely cause','Fix'],
['Save & test fails: connection refused','`localhost` used inside a container, wrong port','Use the service name or host IP'],
['`context deadline exceeded`','Network or slow Prometheus','Check connectivity; raise timeout'],
['`401` or `403`','Authentication in front of Prometheus','Set basic auth or headers in the data source'],
['TLS error','Untrusted certificate','Add CA or client certificate'],
['Works in Explore but not in a dashboard','Different data source selected','Check the panel data source and variable']]},
{h:'No data in a panel'},
{flow:['Open Inspect then Query to see the exact request','Run the same expression in Explore or the Prometheus UI','Check the time range and refresh','Check variables: is a value selected and does the matcher use =~','Check units, thresholds, transformations and field overrides']},
{h:'Slow dashboards'},
{ul:['Too many panels or very large ranges: split dashboards, lower the default range.','Short refresh intervals multiplied by many users: raise the interval.','Expensive queries: use recording rules and `$__rate_interval`.','Set sensible **Min interval** and **Max data points** on panels.']},
{h:'Permissions and access'},
{t:[['Symptom','Check'],
['User cannot see a dashboard','Folder permissions and team membership, organisation role'],
['Cannot edit or save','Role is Viewer; provisioned dashboards are read-only'],
['Cannot create alerts','Needs Editor role and folder write access'],
['Login redirect loops','`root_url` and proxy headers; SSO callback URL']]},
{h:'Where to read logs'},
{code:`# package install
sudo journalctl -u grafana-server -f
# container
docker logs -f grafana
# useful to raise temporarily: [log] level = debug`},
{h:'Provisioning problems'},
{ul:['YAML errors appear at start up in the log, with the file name.','Duplicate `uid` or a changed `uid` creates copies or fails.','Dashboards in a read-only provider cannot be saved; copy to a new dashboard.']},
{note:'Most "Grafana is broken" reports end up being a wrong data source URL, a wrong time range or a variable that selects nothing.'}],
src:[['Troubleshooting dashboards',G+'troubleshooting/'],['Inspect a panel',G+'panels-visualizations/query-transform-data/']]};

/* ---------- 4: Best practices ---------- */
L['prom:12:4']={blocks:[
{p:'Good monitoring is a practice, not an installation. The standards below keep it useful as systems and teams grow, and the maturity table helps you decide what to improve next.'},
{h:'Best practices'},
{t:[['Area','Practice'],
['**Instrumentation**','Instrument entry points and dependencies; use base units and conventional names; keep labels bounded'],
['**Collection**','Short scrape intervals only where needed; discovery over static lists; limits per job'],
['**Rules**','Recording rules for reused or expensive queries; test with promtool; store in Git'],
['**Alerting**','Alert on symptoms and SLO burn; every alert has an owner and a runbook; review after incidents'],
['**Dashboards**','One purpose each; variables, not copies; provisioned from Git; owner named'],
['**Operations**','HA for alerting; long-term storage by remote write; capacity and cardinality monitored; backups tested'],
['**Security**','No open endpoints; TLS and auth; secrets in files; least privilege'],
['**Process**','Monitoring changes are reviewed like code; incidents lead to monitoring improvements']]},
{h:'Monitoring maturity'},
{t:[['Level','Description','Typical signs'],
['**1 Reactive**','Users report problems first','Few dashboards, host metrics only, ad-hoc alerts'],
['**2 Proactive**','Basic coverage, alerts on resources','Exporters everywhere, CPU and disk alerts, some noise'],
['**3 Service-oriented**','Service level metrics and SLOs','RED dashboards, SLO burn alerts, runbooks, tracing available'],
['**4 Optimised**','Monitoring drives decisions','Error budgets steer releases, automated remediation, regular review']]},
{h:'Checklist'},
{ul:['Every service exposes request rate, errors and latency.','Every alert links to a runbook and has an owner.','No alert has fired and been ignored in the last month.','Cardinality is tracked and there are limits on every job.','Dashboards and rules live in Git and are deployed by pipeline.','Alertmanager is clustered and a Watchdog verifies the path.','Restoring from backup has been practised.','Access is authenticated and encrypted.']},
{note:'Revisit this checklist every quarter. Monitoring that is not maintained decays faster than the systems it watches.'}],
src:[['Best practices',K.PG],['Google SRE workbook: monitoring','https://sre.google/workbook/monitoring/']]};

/* ---------- 5: Capstone ---------- */
L['prom:12:5']={blocks:[
{p:'In this capstone you monitor a small three-tier application end to end: instrument it, collect metrics, probe it, build dashboards, set SLO-based alerts and prove it all works by breaking something on purpose.'},
{svg:capstone},
{h:'Scenario'},
{p:'A shop has an **nginx** front end, a **Python API** and a **PostgreSQL** database. The business wants: 99.9% of API requests succeed, 95% of requests under 300 ms, and a page to the on-call person when the budget burns fast.'},
{h:'Step 1: the lab'},
{code:`# docker-compose.yml (monitoring part)
services:
  prometheus:
    image: prom/prometheus
    ports: ["9090:9090"]
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./rules:/etc/prometheus/rules
  alertmanager:
    image: prom/alertmanager
    ports: ["9093:9093"]
    volumes: ["./alertmanager.yml:/etc/alertmanager/alertmanager.yml"]
  grafana:
    image: grafana/grafana
    ports: ["3000:3000"]
  node-exporter:
    image: prom/node-exporter
  blackbox:
    image: prom/blackbox-exporter
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter
    environment:
      DATA_SOURCE_NAME: "postgresql://monitor:change-me@db:5432/shop?sslmode=disable"`},
{h:'Step 2: scrape configuration'},
{code:`scrape_configs:
  - job_name: api
    static_configs: [{ targets: ["api:8000"] }]
  - job_name: node
    static_configs: [{ targets: ["node-exporter:9100"] }]
  - job_name: postgres
    static_configs: [{ targets: ["postgres-exporter:9187"] }]
  - job_name: web-probe
    metrics_path: /probe
    params: { module: [http_2xx] }
    static_configs: [{ targets: ["http://web/health"] }]
    relabel_configs:
      - { source_labels: [__address__], target_label: __param_target }
      - { source_labels: [__param_target], target_label: instance }
      - { target_label: __address__, replacement: "blackbox:9115" }`},
{h:'Step 3: build in this order'},
{flow:['Instrument the API: request counter, in-flight gauge, duration histogram','Confirm all targets are UP on the Targets page','Write recording rules: request rate, error ratio, p95 latency','Create the service dashboard (RED) and database panels','Add SLO burn-rate alerts and host and database alerts','Route critical to pager and warning to chat, then test the route']},
{h:'Step 4: acceptance tests'},
{t:[['Failure injected','Expected result'],
['Stop the API container','HostDown or InstanceDown fires; dashboards show gap; page sent'],
['Make the API return 500 for 10% of requests','Error ratio rises; burn-rate alert fires after its `for`'],
['Add `sleep` to slow responses','p95 latency alert and heatmap shift'],
['Stop PostgreSQL','`pg_up` is 0; API errors increase; database alert; inhibition keeps pages down to one'],
['Fill a disk or lower the threshold','Disk prediction alert as a ticket']]},
{h:'Deliverables'},
{ul:['A repository with prometheus.yml, rules, alertmanager.yml and dashboard JSON.','Passing `promtool check` and `promtool test rules`.','A dashboard showing SLO compliance for 30 days.','A short runbook for each page-level alert.']},
{note:'If you can explain every panel and alert you built and what you would do when it fires, you have the working skills this course set out to teach.'}],
src:[['Prometheus getting started',K.PI+'first_steps/'],['Google SRE: implementing SLOs','https://sre.google/workbook/implementing-slos/']]};

/* ---------- 6: Practice exam ---------- */
L['prom:12:6']={blocks:[
{p:'The **Prometheus Certified Associate (PCA)** exam checks that you understand Prometheus fundamentals, PromQL, instrumentation, alerting and observability concepts. This lecture maps the course to the domains, works through typical questions and gives a revision plan.'},
{h:'Domains and where to revise'},
{t:[['Domain','Weight','Key topics','Course sections'],
['**Observability concepts**','18%','Signals, SLOs, push vs pull, golden signals, alerting philosophy','1, 6, 10'],
['**Prometheus fundamentals**','20%','Architecture, config, scrape, service discovery, relabeling, storage, HA','2, 4, 12'],
['**PromQL**','28%','Selectors, rate, aggregation, matching, histograms, subqueries','5'],
['**Instrumentation and exporters**','16%','Metric types, naming, client libraries, exporters, textfile, Pushgateway','3, 4'],
['**Alerting and dashboarding**','18%','Rules, Alertmanager routing, inhibition, silences, Grafana basics','6 to 9']]},
{h:'Worked questions'},
{t:[['Question','Answer and reasoning'],
['Which metric type should record request latency so quantiles can be aggregated across instances?','**Histogram**. Buckets can be summed across instances before `histogram_quantile`; summaries cannot be aggregated.'],
['What does `rate(x[5m])` return?','Per-second average increase of a counter over 5 minutes, handling resets. It needs at least two samples.'],
['Which function is correct for the total increase of a counter over an hour?','`increase(x[1h])`.'],
['What happens to alerts with the same label set from two Prometheus replicas?','Alertmanager **deduplicates** them into one.'],
['A batch job runs for 30 seconds. How do you expose its metrics?','Push to the **Pushgateway** (or use the textfile collector on the host).'],
['Which label matcher selects all status codes starting with 5?','`code=~"5.."` (regexes are fully anchored).'],
['Which component evaluates alerting rules?','The **Prometheus server**, not Alertmanager.'],
['What does `for: 5m` do?','The condition must hold for five minutes: the alert is pending, then firing.'],
['How do you attach labels from an `_info` metric to another series?','Multiply with `on(...) group_left(label)`.'],
['Why avoid a `user_id` label?','Unbounded **cardinality**: each value is a new series.']]},
{h:'Exam strategy'},
{ul:['Read each question for the **exact term**: counter or gauge, instant or range vector, Prometheus or Alertmanager.','For PromQL, write the query on paper and check **types**: what does each sub-expression return?','Eliminate answers that need features Prometheus does not have (push-based collection, built-in auth, log search).','Practise with the section quizzes, then the mixed review of missed questions.']},
{h:'Final revision checklist'},
{ul:['Explain the data flow from exporter to notification without notes.','Write error ratio, p95 latency and disk-full predict queries from memory.','Describe all metric types and when to use each.','Configure a scrape job with relabeling and discovery.','Describe routing, grouping, inhibition and silences.','Describe HA, remote write and federation and their limits.']},
{note:'Check the Linux Foundation page for the current exam duration, format and price before you book. Good luck.'}],
src:[['PCA certification','https://training.linuxfoundation.org/certification/prometheus-certified-associate/'],['Prometheus documentation',K.P]]};
})();
