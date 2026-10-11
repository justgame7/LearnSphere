/* LearnSphere - Prometheus & Grafana, Section 03: Metrics, Labels & Instrumentation.
   Lectures 0-5 are core; additional lectures (not written yet) follow. Needs prom-common.js. */
(function(){
const K=window.PM,L=window.LESSONS,PI=K.PI,PX=K.PX,PG=K.PG;

/* ---------- diagrams ---------- */
const series=K.dg(700,210,[
[10,10,680,190,'One metric name, many time series',1],
[30,50,220,60,'http_requests_total|{method="GET", code="200"}',2],[30,130,220,60,'http_requests_total|{method="POST", code="500"}',2],
[320,50,150,60,'Samples|(timestamp, value)|(t1, 1027) (t2, 1031)',0],[320,130,150,60,'Samples|(t1, 12) (t2, 12)',0],
[520,90,150,60,'Each unique label|set is a separate|series',0]],
[[250,80,320,80],[250,160,320,160],[470,80,520,110],[470,160,520,130]]);

const types=K.dg(700,190,[
[10,10,680,170,'Which type?',1],
[30,45,150,55,'Counter|only goes up|requests, errors',2],[205,45,150,55,'Gauge|goes up and down|temperature, queue',2],[380,45,150,55,'Histogram|counts in buckets|latency, size',2],[555,45,125,55,'Summary|client-side|quantiles',0],
[30,115,150,45,'use rate()',0],[205,115,150,45,'use directly',0],[380,115,150,45,'histogram_quantile()',0],[555,115,125,45,'read quantile',0]],
[[105,100,105,115],[280,100,280,115],[455,100,455,115],[617,100,617,115]]);

/* ---------- 0: Data model ---------- */
L['prom:2:0']={blocks:[
{p:'Everything in Prometheus is a **time series**: a stream of timestamped values that belong to one metric name and one set of labels. Labels give the data its dimensions, so one name can describe many things.'},
{svg:series},
{h:'Anatomy of a series'},
{code:`http_requests_total{method="GET", code="200", job="api", instance="10.0.0.5:8080"}  1027
\\_________________/ \\______________ labels _____________________________/        \\__/
   metric name                                                                   value`},
{t:[['Part','Meaning','Rules'],
['**Metric name**','What is measured','Letters, digits, underscores and colons; cannot start with a digit'],
['**Labels**','Key/value pairs that identify one dimension','Names use letters, digits, underscore; values are any text'],
['**Sample**','One float64 value plus a millisecond timestamp','Stored at every scrape'],
['**Series**','Name plus the exact label set','Different label values mean a different series']]},
{h:'Key facts'},
{ul:['The metric name is itself the label `__name__`. `up` and `{__name__="up"}` are the same query.','Labels starting with **two underscores** are reserved for Prometheus internal use.','An **empty** label value is the same as not having the label.','Colons in names are reserved for **recording rules**, not for instrumentation.','Values are always 64-bit floats. Text and booleans do not exist, so they are expressed as labels or 0/1.']},
{h:'Where labels come from'},
{t:[['Source','Examples'],
['**The target itself**','`method`, `code`, `handler` set by the application'],
['**Prometheus at scrape time**','`job`, `instance`'],
['**Service discovery and relabeling**','`env`, `region`, `pod`, `namespace`'],
['**External labels**','Labels added when talking to Alertmanager or remote storage']]},
{h:'Why this matters for queries'},
{p:'Because every label combination is its own series, you can ask for all of them, a subset, or a sum without changing instrumentation.'},
{code:`http_requests_total                          # every series of this metric
http_requests_total{code="500"}              # only errors
sum by (method) (rate(http_requests_total[5m]))   # one line per method`},
{note:'A new label value creates a new series. Choosing labels is therefore a cost decision as well as a design one, which is the topic of the cardinality lecture.'}],
src:[['Data model',PI+'../concepts/data_model/'],['Jobs and instances',PI+'../concepts/jobs_instances/']]};

/* ---------- 1: Metric types ---------- */
L['prom:2:1']={blocks:[
{p:'Prometheus has four core metric types. The type is a hint to the client library about how to expose the value and to you about which functions to apply. Choosing the right type is the most important instrumentation decision.'},
{svg:types},
{h:'The four types'},
{t:[['Type','Behaviour','Use for','Query with'],
['**Counter**','Only increases (resets to 0 on restart)','Requests, errors, bytes sent, tasks completed','`rate()`, `increase()`'],
['**Gauge**','Goes up and down','Temperature, memory used, queue length, in-flight requests','Directly, `avg_over_time`, `delta`'],
['**Histogram**','Counts observations into buckets, plus sum and count','Request latency, response sizes','`histogram_quantile()`'],
['**Summary**','Quantiles calculated in the client, plus sum and count','Latency when you need exact client-side quantiles','Read the quantile series']]},
{h:'Counter'},
{p:'A counter is a running total. Its raw value is rarely useful, because it depends on when the process started. You care about **how fast** it grows, so you always wrap it in `rate()`.'},
{h:'Gauge'},
{p:'A gauge is a snapshot of a value that can go either way. If you ever want the **rate of change** of a thing that only grows, it is a counter, not a gauge.'},
{h:'Histogram: what is exposed'},
{code:`http_request_duration_seconds_bucket{le="0.1"}  240
http_request_duration_seconds_bucket{le="0.5"}  980
http_request_duration_seconds_bucket{le="1"}    1010
http_request_duration_seconds_bucket{le="+Inf"} 1030
http_request_duration_seconds_sum               312.4
http_request_duration_seconds_count             1030`},
{p:'Buckets are **cumulative**: `le="0.5"` counts everything that took 0.5 seconds or less. The `+Inf` bucket always equals `_count`.'},
{h:'Histogram vs summary'},
{t:[['','Histogram','Summary'],
['**Quantile calculated**','On the server with `histogram_quantile()`','In the application'],
['**Aggregate across instances**','Yes: sum the buckets, then compute','No: quantiles cannot be averaged'],
['**Choose quantiles**','Any, later, at query time','Fixed in code'],
['**Accuracy**','Depends on bucket boundaries','Exact within the configured error'],
['**Cost**','One series per bucket','One series per quantile']]},
{note:'Default to **histograms**. They can be aggregated across replicas, which is almost always what you need. Newer versions also support native histograms with automatic buckets; the idea is the same.'},
{h:'Which type?'},
{flow:['Does the value only go up (events counted)?','Yes: counter','Can it go down (a level or size)?','Yes: gauge','Do you need a distribution such as latency?','Yes: histogram']}],
src:[['Metric types',PI+'../concepts/metric_types/'],['Histograms and summaries',PG+'histograms/']]};

/* ---------- 2: Naming ---------- */
L['prom:2:2']={blocks:[
{p:'Consistent names let anyone guess a metric and its unit, and they let queries and dashboards be reused across teams. The conventions are simple and worth following from the first metric.'},
{h:'The conventions'},
{t:[['Rule','Good','Avoid'],
['**snake_case**','`http_requests_total`','`httpRequests`, `http-requests`'],
['**Application prefix**','`myapp_queue_depth`','`queue_depth`'],
['**Base units**','`_seconds`, `_bytes`, `_meters`','`_milliseconds`, `_megabytes`'],
['**Counters end in `_total`**','`jobs_failed_total`','`jobs_failed`'],
['**Unit as suffix**','`process_cpu_seconds_total`','`cpu_total_seconds_used`'],
['**Ratios from 0 to 1**','`cache_hit_ratio`','`cache_hit_percent`'],
['**Info metrics end in `_info`**','`build_info{version="1.4"}` = 1','`version` as a metric value']]},
{h:'Label rules'},
{ul:['Use labels to **separate dimensions of the same thing**, such as `method` or `code`, not different things.','Do not put the label name into the metric name: use `requests_total{method="GET"}`, not `get_requests_total`.','**Every name must mean the same across all label values.** If summing the series makes no sense, they should be different metrics.','Do not generate metric names dynamically from data.']},
{h:'Why base units'},
{p:'Prometheus and Grafana both format values automatically when the base unit is known. Seconds and bytes also make arithmetic across metrics safe: dividing `_bytes` by `_seconds` gives bytes per second without conversion.'},
{h:'Before and after'},
{t:[['Before','After','Problem fixed'],
['`requestLatencyMs`','`http_request_duration_seconds`','Case, unit and prefix'],
['`errors`','`myapp_errors_total`','No prefix, no counter suffix'],
['`mem_used_percent`','`myapp_memory_used_bytes` and `..._limit_bytes`','Derive ratio at query time'],
['`get_requests`, `post_requests`','`http_requests_total{method=...}`','Label name in metric name']]},
{note:'Exam tip: a name ending in `_total` is a counter; ending in `_bucket`, `_sum` or `_count` is a histogram or summary component.'}],
src:[['Metric and label naming',PG+'naming/'],['Instrumentation best practices',PG+'instrumentation/']]};

/* ---------- 3: Exposition format ---------- */
L['prom:2:3']={blocks:[
{p:'Prometheus scrapes a URL, normally **/metrics**, that returns plain text. The format is simple enough to read by eye and to write by hand, which is why so many systems support it.'},
{h:'A complete example'},
{code:`# HELP http_requests_total Total HTTP requests handled.
# TYPE http_requests_total counter
http_requests_total{method="GET",code="200"} 1027
http_requests_total{method="POST",code="500"} 3

# HELP queue_depth Items waiting in the queue.
# TYPE queue_depth gauge
queue_depth 12

# HELP request_duration_seconds Request latency.
# TYPE request_duration_seconds histogram
request_duration_seconds_bucket{le="0.1"} 240
request_duration_seconds_bucket{le="+Inf"} 1030
request_duration_seconds_sum 312.4
request_duration_seconds_count 1030`},
{h:'Line types'},
{t:[['Line','Meaning'],
['`# HELP name text`','A one-line description of the metric'],
['`# TYPE name type`','counter, gauge, histogram, summary or untyped'],
['`name{labels} value`','One sample'],
['`name{labels} value timestamp`','Sample with an explicit millisecond timestamp (rare)'],
['`# EOF`','End marker, required by the OpenMetrics variant']]},
{h:'Rules of the format'},
{ul:['One sample per line, **UTF-8 text**, lines end with a newline.','Label values go in double quotes. Escape backslash, double quote and newline with a backslash.','Values may be `NaN`, `+Inf` or `-Inf`.','`HELP` and `TYPE` appear once per metric, before its samples.','The HTTP response uses `Content-Type: text/plain; version=0.0.4`; OpenMetrics uses `application/openmetrics-text`.']},
{h:'Reading it with curl'},
{code:`curl -s localhost:8000/metrics | grep -v "^#" | head
curl -s localhost:8000/metrics | grep http_requests_total`},
{h:'Text format vs OpenMetrics'},
{t:[['','Prometheus text format','OpenMetrics'],
['**Standardised by**','Prometheus project','CNCF specification'],
['**Extras**','None','Exemplars, created timestamps, units, `# EOF`'],
['**Counter names**','`_total` suffix by convention','`_total` required on samples']]},
{note:'If a target will not scrape, `curl` the /metrics URL first. Parse errors and wrong content types show up there before you look anywhere else.'}],
src:[['Exposition formats',PX+'exposition_formats/'],['OpenMetrics','https://openmetrics.io/']]};

/* ---------- 4: Cardinality ---------- */
L['prom:2:4']={blocks:[
{p:'**Cardinality** is the number of unique time series. Each series costs memory and disk, and the number grows by **multiplication** across labels. High cardinality is the most common reason Prometheus becomes slow or runs out of memory.'},
{h:'How it multiplies'},
{code:`http_requests_total{method, code, handler}
  5 methods x 8 status codes x 40 handlers = 1,600 series per instance
  x 50 instances = 80,000 series

Add one label user_id with 100,000 users:
  80,000 x 100,000 = 8 billion series   <- the server falls over`},
{h:'What to avoid as a label value'},
{t:[['Do not use','Why','Use instead'],
['User IDs, emails, session IDs','Unbounded','Log it, or count totals'],
['Full URL paths with IDs','Unbounded','The route template `/users/:id`'],
['IP addresses of clients','Unbounded','Aggregated bucketed data'],
['Timestamps or build hashes that change every run','New series each time','A single `_info` metric'],
['Error message text','Unbounded','A small set of error classes']]},
{p:'A good rule: the number of values of a label should be bounded and **small** (tens, not thousands), and a single metric should rarely exceed a few thousand series across the whole server.'},
{h:'Finding the expensive metrics'},
{code:`# Top 10 metric names by number of series
topk(10, count by (__name__) ({__name__=~".+"}))

# Series count per job
count by (job) ({__name__=~".+"})

# Active series on this server
prometheus_tsdb_head_series`},
{p:'The **TSDB status** page (Status, then TSDB Status) lists the top metric names, label names and label-value pairs by series count.'},
{h:'Controlling it'},
{flow:['Find the metric and label with the biggest series count','Fix the application if it created an unbounded label','Drop it at scrape time with metric_relabel_configs if you cannot','Set sample_limit and label_limit on the job as a safety net','Alert on prometheus_tsdb_head_series growth']},
{code:`scrape_configs:
  - job_name: api
    sample_limit: 50000        # scrape fails if more samples are returned
    label_limit: 30
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: "debug_.*"
        action: drop`},
{note:'This is high-value knowledge for the exam and for production. Section 12 returns to it with capacity planning.'}],
src:[['Instrumentation: labels',PG+'instrumentation/#use-labels'],['Cardinality in practice','https://www.robustperception.io/cardinality-is-key/']]};

/* ---------- 5: Client library ---------- */
L['prom:2:5']={blocks:[
{p:'A **client library** adds metrics to your own code and serves them on /metrics. The steps are the same in every language: create metrics once, update them where events happen, and expose an HTTP endpoint.'},
{h:'Python example'},
{code:`# app.py  -  pip install prometheus-client
import random, time
from prometheus_client import Counter, Gauge, Histogram, start_http_server

REQUESTS = Counter("myapp_requests_total", "Requests handled", ["method", "code"])
IN_FLIGHT = Gauge("myapp_in_flight_requests", "Requests being handled")
LATENCY = Histogram(
    "myapp_request_duration_seconds", "Request latency",
    buckets=[0.05, 0.1, 0.25, 0.5, 1, 2.5])

def handle(method):
    IN_FLIGHT.inc()
    with LATENCY.time():                       # records duration
        time.sleep(random.random() / 2)
    code = "200" if random.random() > 0.1 else "500"
    REQUESTS.labels(method=method, code=code).inc()
    IN_FLIGHT.dec()

if __name__ == "__main__":
    start_http_server(8000)                    # serves /metrics on :8000
    while True:
        handle(random.choice(["GET", "POST"]))`},
{h:'Scrape it'},
{code:`scrape_configs:
  - job_name: myapp
    static_configs:
      - targets: ["localhost:8000"]`},
{h:'Useful first queries'},
{code:`sum(rate(myapp_requests_total[1m]))                       # requests per second
sum(rate(myapp_requests_total{code="500"}[1m]))
  / sum(rate(myapp_requests_total[1m]))                   # error ratio
histogram_quantile(0.95,
  sum by (le) (rate(myapp_request_duration_seconds_bucket[5m])))   # p95 latency`},
{h:'The same idea in Go'},
{code:`var requests = promauto.NewCounterVec(
    prometheus.CounterOpts{Name: "myapp_requests_total", Help: "Requests handled"},
    []string{"method", "code"})

func main() {
    http.Handle("/metrics", promhttp.Handler())
    requests.WithLabelValues("GET", "200").Inc()
    http.ListenAndServe(":8000", nil)
}`},
{h:'Instrumentation checklist'},
{ul:['Create metrics **once** at start up, not per request.','Instrument entry points (HTTP handlers), outgoing calls (databases, APIs) and queues.','Count both successes and failures with a `code` or `status` label.','Pick histogram buckets that surround your SLO threshold.','Initialise label combinations you know exist so rates start from 0 rather than being absent.']},
{note:'Client libraries also export default process and runtime metrics such as CPU, memory and garbage collection, so you get a useful baseline for free.'}],
src:[['Client libraries',PX+'clientlibs/'],['Python client','https://github.com/prometheus/client_python'],['Instrumentation best practices',PG+'instrumentation/']]};
})();
