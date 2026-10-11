/* LearnSphere - Prometheus & Grafana, Section 01: Observability Fundamentals.
   Lectures 0-5 are core; additional lectures (not written yet) follow. Needs prom-common.js. */
(function(){
const K=window.PM,L=window.LESSONS,PI=K.PI,PG=K.PG;

/* ---------- diagrams ---------- */
const pillars=K.dg(700,220,[
[10,10,680,200,'Three signals, three kinds of question',1],
[30,45,200,80,'Metrics|numbers over time|Is something wrong? How much?',2],[250,45,200,80,'Logs|events with detail|What exactly happened?',0],[470,45,200,80,'Traces|one request end to end|Where did the time go?',0],
[30,140,200,50,'Prometheus',0],[250,140,200,50,'Loki',0],[470,140,200,50,'Tempo',0]],
[[130,125,130,140],[350,125,350,140],[570,125,570,140]]);

const stack=K.dg(700,300,[
[10,10,680,280,'The stack at a glance',1],
[30,60,130,60,'Applications|and exporters|(expose /metrics)',0],[200,60,130,60,'Prometheus|scrapes, stores,|evaluates rules',2],[380,60,130,60,'Alertmanager|groups and routes|notifications',0],[560,60,115,60,'Slack, email,|PagerDuty',0],
[200,175,130,50,'Grafana|dashboards',2],[380,175,130,50,'Loki|logs',0],[560,175,115,50,'Tempo|traces',0],[30,175,130,50,'Alloy|ships logs and|traces onward',0]],
[[160,90,200,90],[330,90,380,90],[510,90,560,90],[265,120,265,175],[380,200,330,200],[560,200,510,200]]);

const pull=K.dg(700,200,[
[10,10,330,180,'Pull (Prometheus)',1],[360,10,330,180,'Push (many other systems)',1],
[30,60,110,60,'Prometheus',2],[220,40,100,40,'Target A',0],[220,100,100,40,'Target B',0],
[380,40,100,40,'App A',0],[380,100,100,40,'App B',0],[560,70,110,60,'Collector',2]],
[[140,80,220,60],[140,100,220,120],[480,60,560,90],[480,120,560,110]]);

/* ---------- 0: Course overview ---------- */
L['prom:0:0']={blocks:[
{p:'This course takes you from zero to someone who can **monitor systems with Prometheus, build dashboards and alerts in Grafana, and run the whole stack in production**. It follows the domains of the **Prometheus Certified Associate (PCA)** exam, but the goal is real skill: instrument an application, query its metrics, alert on what matters and explain what you see. This lecture explains how the course is organised.'},
{h:'Key terms in one minute'},
{t:[['Term','Plain meaning'],
['**Metric**','A number measured over time, such as requests per second or free disk space.'],
['**Prometheus**','An open-source system that collects metrics, stores them and lets you query and alert on them.'],
['**Exporter**','A small program that turns the metrics of some system into a format Prometheus can read.'],
['**PromQL**','The query language used to ask questions of Prometheus data.'],
['**Alertmanager**','The component that groups, routes and sends alert notifications.'],
['**Grafana**','A web application for dashboards, exploration and alerting on many data sources.'],
['**Observability**','How well you can understand what a system is doing from the outside, using its signals.']]},
{h:'The route through the course'},
{flow:['Observability ideas and how the pieces fit (Section 1)','Install Prometheus and collect your first metrics (Section 2)','Understand metrics, labels and instrumentation (Section 3)','Exporters, discovery and relabeling (Section 4)','Query with PromQL (Section 5)','Alert with Alertmanager (Section 6)','Grafana: dashboards and alerting (Sections 7 to 9)','Logs, traces, Kubernetes and production (Sections 10 to 13)']},
{h:'The thirteen sections at a glance'},
{t:[['#','Section','After it you can'],
['1','Observability Fundamentals','Explain signals, SLOs and where Prometheus fits'],
['2','Prometheus Architecture & Installation','Install, configure and scrape'],
['3','Metrics, Labels & Instrumentation','Choose metric types and instrument code'],
['4','Exporters & Service Discovery','Monitor hosts, databases and endpoints'],
['5','PromQL: Querying Metrics','Write rates, aggregations and percentiles'],
['6','Alerting with Alertmanager','Build and route alerts people trust'],
['7','Grafana Fundamentals','Build dashboards with variables'],
['8','Dashboards in Practice','Design, import and provision dashboards'],
['9','Grafana Alerting & Notifications','Alert from Grafana'],
['10','Logs & Traces','Use Loki and Tempo and correlate signals'],
['11','Monitoring Kubernetes','Deploy kube-prometheus-stack'],
['12','Production Operations & Scale','Run it highly available and secure'],
['13','Troubleshooting & Exam Preparation','Fix problems and prepare for the PCA']]},
{h:'How sections map to the PCA domains'},
{t:[['PCA domain','Weight','Main sections'],
['Observability concepts','18%','1, 10'],
['Prometheus fundamentals','20%','2, 4, 12'],
['PromQL','28%','5'],
['Instrumentation and exporters','16%','3, 4'],
['Alerting and dashboarding','18%','6, 7, 8, 9']]},
{p:'PromQL carries the largest weight, so Section 5 deserves the most practice. Check the Linux Foundation certification page for the current exam format, price and validity.'},
{h:'Lecture tags: Prometheus, Grafana or Both'},
{t:[['Tag','Meaning'],
['**Prometheus**','About the Prometheus server, exporters, PromQL or Alertmanager.'],
['**Grafana**','About Grafana dashboards, data sources or Grafana alerting.'],
['**Both**','The idea applies to the stack as a whole.']]},
{h:'Prerequisites self-check'},
{ul:['I can use a terminal: `cd`, `ls`, `cat`, `curl` and a text editor.','I know what an HTTP request, a port and a process are.','I can read YAML (indentation, lists and key/value pairs).','I have a Linux, Mac or Windows machine where I can run Docker or install a binary.']},
{p:'Nothing here needs a cloud account. Every lab runs on one machine, and the fastest start is Docker.'},
{h:'How to study'},
{ul:['Run every example yourself and look at the real output.','Keep one lab running through the course and add to it each section.','Write the query or rule yourself before reading the answer.','Take the section quiz and review the explanations for wrong answers.']}],
src:[['Prometheus overview',PI+'overview/'],['PCA certification (Linux Foundation)','https://training.linuxfoundation.org/certification/prometheus-certified-associate/']]};

/* ---------- 1: Monitoring vs observability ---------- */
L['prom:0:1']={blocks:[
{p:'**Monitoring** means collecting and watching known signals so you notice when something is wrong. **Observability** is the wider ability to understand why, including problems you did not predict, by asking new questions of the data. Monitoring is something you do; observability is a property of a system.'},
{svg:pillars},
{h:'The three signals'},
{t:[['Signal','What it is','Best question it answers','Typical cost'],
['**Metrics**','Numeric samples over time, aggregated','Is it broken? How bad? Is it getting worse?','Low and predictable'],
['**Logs**','Timestamped records of events','What happened in this one case?','Grows with traffic'],
['**Traces**','The path and timing of one request across services','Which service or call is slow?','Needs sampling at scale']]},
{p:'A fourth signal is becoming common: **profiles** (where CPU and memory go inside code). Events and continuous profiling are useful, but metrics, logs and traces are the foundation.'},
{h:'Monitoring vs observability'},
{t:[['','Monitoring','Observability'],
['**Starts from**','Known failure modes','Unknown unknowns'],
['**Typical output**','Dashboard and alert','Ability to ask a new question'],
['**Data needed**','Chosen metrics and checks','Rich, high-detail signals'],
['**Example**','CPU above 90% for 10 minutes','Why is checkout slow only for users in one region?']]},
{h:'A request through the three signals'},
{flow:['An alert fires from a metric: error ratio is high','A dashboard shows which service and when','Logs from that window show the error message','A trace of a failed request shows the slow database call','You fix and watch the metric recover']},
{h:'Black-box vs white-box monitoring'},
{ul:['**Black-box** tests from outside, as a user would: is the page up, how long did the request take. It catches symptoms.','**White-box** uses internal metrics the system exposes: queue depth, cache hit rate. It explains causes.','Use both: black-box tells you users are hurt, white-box tells you why.']},
{note:'Prometheus is a metrics system. Logs (Loki) and traces (Tempo) are covered in Section 10, and Grafana ties the three together.'}],
src:[['Prometheus overview',PI+'overview/'],['Monitoring distributed systems (Google SRE book)','https://sre.google/sre-book/monitoring-distributed-systems/']]};

/* ---------- 2: Golden signals, RED, USE ---------- */
L['prom:0:2']={blocks:[
{p:'A system can expose thousands of metrics. These three well-known methods tell you **which few to look at first**. They are the same idea at different levels: services use the golden signals and RED, resources use USE.'},
{h:'The four golden signals (Google SRE)'},
{t:[['Signal','Question','Example metric idea'],
['**Latency**','How long do requests take? Separate successes from errors.','Request duration histogram'],
['**Traffic**','How much demand is there?','Requests per second'],
['**Errors**','How many requests fail?','Failed requests / all requests'],
['**Saturation**','How full is the service?','Queue length, CPU or memory pressure']]},
{h:'RED method (for request-driven services)'},
{t:[['Letter','Meaning','Question'],
['**R**ate','Requests per second','How busy is it?'],
['**E**rrors','Failed requests per second (or ratio)','What fraction is failing?'],
['**D**uration','Time per request, as percentiles','How slow is it for users?']]},
{p:'RED is the golden signals without saturation, chosen because it is easy to apply to every microservice the same way.'},
{h:'USE method (for resources)'},
{t:[['Letter','Meaning','Example on a disk or CPU'],
['**U**tilisation','Percent of time the resource is busy','CPU busy 85%'],
['**S**aturation','Work waiting because the resource is full','Run queue length, disk queue'],
['**E**rrors','Count of error events','Disk read errors, NIC drops']]},
{h:'Which method where'},
{svg:K.dg(700,170,[
[10,10,680,150,'Pick the method by what you are measuring',1],
[30,50,190,80,'Services and APIs|RED or golden signals|Rate, Errors, Duration',2],[255,50,190,80,'Hosts, disks, networks|USE|Utilisation,|Saturation, Errors',2],[480,50,190,80,'Queues and batch jobs|Throughput, lag,|age of oldest item',0]],
[])},
{h:'Start dashboards from these'},
{ul:['One row per service: rate, error ratio, p95 or p99 duration.','One row per host: CPU, memory, disk, network with saturation.','Alert on **symptoms users feel** (errors, latency), investigate with resource metrics.']},
{note:'These methods give you a default answer to the question "what should I measure?" so you do not start from a blank page.'}],
src:[['The four golden signals','https://sre.google/sre-book/monitoring-distributed-systems/#xref_monitoring_golden-signals'],['Instrumentation best practices',PG+'instrumentation/']]};

/* ---------- 3: SLIs, SLOs, SLAs ---------- */
L['prom:0:3']={blocks:[
{p:'Alerting on CPU or memory tells you about machines, not users. **Service level objectives** turn reliability into numbers users care about and give you a rational way to decide what to alert on and how much risk you can take.'},
{h:'The definitions'},
{t:[['Term','Meaning','Example'],
['**SLI** (indicator)','A measurement of how well the service is doing','Proportion of requests that succeed'],
['**SLO** (objective)','The target you set for an SLI over a time window','99.9% of requests succeed over 30 days'],
['**SLA** (agreement)','A contract with consequences if missed','Credits if monthly availability falls below 99.5%'],
['**Error budget**','The amount of unreliability the SLO allows','0.1% of requests may fail']]},
{p:'An SLO is **stricter than the SLA** so you notice trouble before you owe anyone money.'},
{h:'Error budget arithmetic'},
{t:[['SLO','Allowed downtime per 30 days','Allowed failed requests per million'],
['99%','about 7 hours 12 minutes','10,000'],
['99.9%','about 43 minutes','1,000'],
['99.99%','about 4 minutes 19 seconds','100']]},
{p:'Each extra nine is about ten times harder and more expensive. Choose the target the business really needs, not the highest one.'},
{h:'A good SLI in PromQL terms'},
{code:`# Fraction of successful requests over 30 days
sum(rate(http_requests_total{code!~"5.."}[30d]))
/
sum(rate(http_requests_total[30d]))`},
{h:'Using the error budget'},
{flow:['Pick user-visible SLIs (availability, latency)','Set an SLO and a time window','Measure the budget burned so far','If budget is healthy, ship features faster','If budget is nearly gone, prioritise reliability work']},
{h:'Alerting on burn rate'},
{p:'Instead of alerting when one error happens, alert when you are **burning the budget too fast**. A burn rate of 1 uses exactly the whole budget by the end of the window. A burn rate of 14.4 over one hour would burn 2% of a 30-day budget, which deserves a page.'},
{t:[['Alert','Long window','Short window','Burn rate','Action'],
['Fast burn','1 hour','5 minutes','14.4','Page now'],
['Slow burn','6 hours','30 minutes','6','Page'],
['Gradual','3 days','6 hours','1','Ticket']]},
{note:'Multi-window, multi-burn-rate alerts are covered with real rules in Section 6. The key idea here: alerts should follow the SLO, not raw resource numbers.'}],
src:[['Service level objectives (Google SRE book)','https://sre.google/sre-book/service-level-objectives/'],['Alerting on SLOs (SRE workbook)','https://sre.google/workbook/alerting-on-slos/']]};

/* ---------- 4: Pull vs push ---------- */
L['prom:0:4']={blocks:[
{p:'Prometheus uses a **pull model**: the server visits each target on a schedule and reads its metrics over HTTP. This is called **scraping**. Many other systems use a **push model**, where each application sends data to a collector.'},
{svg:pull},
{h:'Pull vs push'},
{t:[['','Pull (Prometheus)','Push'],
['**Who starts**','The monitoring server','The monitored application'],
['**Target down?**','Visible: the scrape fails and `up` is 0','Looks the same as no data'],
['**Configuration**','Server holds the target list','Each app needs the collector address'],
['**Debugging**','Open the /metrics URL in a browser','Need access to the sender'],
['**Short-lived jobs**','Hard: may finish before a scrape','Natural'],
['**Firewalls**','Server must reach every target','Apps only need to reach the collector']]},
{h:'What pull gives you'},
{ul:['**Free health check:** the synthetic metric `up` is 1 when a scrape succeeds and 0 when it fails.','**Control:** you decide the interval and which targets exist from one place.','**Easy testing:** `curl http://host:9100/metrics` shows exactly what Prometheus sees.','**No overload:** the server collects at its own pace, so a flood from apps cannot overwhelm it.']},
{h:'When pushing is the right exception'},
{p:'Batch jobs that finish before the next scrape cannot be pulled. For these Prometheus provides the **Pushgateway**: the job pushes its final result once, and Prometheus scrapes the gateway as normal.'},
{flow:['Batch job runs and finishes','It pushes its metrics to the Pushgateway','The Pushgateway holds the last values','Prometheus scrapes the Pushgateway on its normal interval']},
{p:'Use the Pushgateway only for **service-level batch jobs**. Do not use it to turn Prometheus into a push system: you lose the `up` metric and the gateway keeps old values forever until deleted. Section 4 covers it in detail.'},
{note:'Newer Prometheus versions can also receive metrics by remote write and OTLP. These are meant for integrations and agents, not for general application instrumentation.'}],
src:[['Pull or push?',PI+'faq/'],['When to use the Pushgateway',PG+'pushing/']]};

/* ---------- 5: The stack at a glance ---------- */
L['prom:0:5']={blocks:[
{p:'Monitoring in this course is a small set of cooperating tools. Each does one job, and Grafana sits in front as the common window.'},
{svg:stack},
{h:'Which tool for which question'},
{t:[['Component','Job','You use it when'],
['**Prometheus**','Collects, stores and queries metrics, evaluates rules','You want numbers over time and alert conditions'],
['**Exporters**','Expose metrics of systems that cannot do it themselves','Monitoring a host, a database or a device'],
['**Alertmanager**','Deduplicates, groups, routes and silences alerts','Sending notifications to people or tools'],
['**Grafana**','Dashboards, exploration, its own alerting','Showing data to people'],
['**Loki**','Stores and queries logs by label','You need the text of events'],
['**Tempo**','Stores and queries traces','You need to follow a request across services'],
['**Alloy**','Telemetry collector (metrics, logs, traces)','Shipping signals from hosts and containers']]},
{h:'How an alert travels'},
{flow:['Prometheus scrapes metrics and evaluates an alerting rule','The condition holds for the "for" duration and the alert fires','Prometheus sends it to Alertmanager','Alertmanager groups, deduplicates and routes it','A receiver notifies the team (Slack, email, PagerDuty)']},
{h:'How a person investigates'},
{flow:['Open a Grafana dashboard from the alert link','Spot the time and service where the metric changed','Jump to logs in Loki for that window','Open a trace in Tempo for a failing request']},
{h:'Where you will build each piece'},
{t:[['Section','Piece'],
['2 to 6','Prometheus, exporters, PromQL, Alertmanager'],
['7 to 9','Grafana dashboards and alerting'],
['10','Loki, Tempo and correlation'],
['11','All of it on Kubernetes with kube-prometheus-stack'],
['12','HA, long-term storage and security']]},
{note:'Prometheus is the **metrics** engine. It does not store logs or traces, and it is not a long-term archive by itself. Section 12 shows the standard answers for retention and scale.'}],
src:[['Prometheus overview',PI+'overview/'],['Grafana documentation','https://grafana.com/docs/']]};
})();
