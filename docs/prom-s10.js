/* LearnSphere - Prometheus & Grafana, Section 10: Logs & Traces: Loki, Tempo and Correlation.
   Lectures 0-4 are core; additional lectures (not written yet) follow. Needs prom-common.js. */
(function(){
const K=window.PM,L=window.LESSONS,LK=K.LK,TP=K.TP;

/* ---------- diagrams ---------- */
const loki=K.dg(700,210,[
[10,10,680,190,'Loki indexes only the labels, not the log text',1],
[30,55,130,60,'Log lines|from app and host',0],[210,55,140,60,'Alloy / agent|adds labels|app, env, level',2],[400,45,130,80,'Loki|index: labels|chunks: compressed',2],[570,55,100,60,'Grafana|LogQL',0]],
[[160,85,210,85],[350,85,400,85],[530,85,570,85]]);

const trace=K.dg(700,230,[
[10,10,680,210,'One trace, many spans',1],
[30,45,640,34,'frontend: GET /checkout   (total 480 ms)',2],
[110,90,520,34,'cart-service: load cart   (120 ms)',0],
[230,135,400,34,'payments: charge card   (300 ms)',0],
[300,180,300,34,'bank API call   (260 ms)  <- the slow step',2]],
[]);

const corr=K.dg(700,240,[
[10,10,680,220,'One investigation, three signals',1],
[260,40,180,50,'Dashboard panel|latency spike at 14:05',2],
[40,150,170,60,'Metrics: Prometheus|exemplar with trace ID',0],[265,150,170,60,'Logs: Loki|filter by trace_id|or labels',0],[490,150,170,60,'Traces: Tempo|full request path',0]],
[[320,90,150,150],[350,90,350,150],[380,90,570,150],[210,180,265,180],[435,180,490,180]]);

/* ---------- 0: Loki basics ---------- */
L['prom:9:0']={blocks:[
{p:'**Loki** is a log aggregation system designed to feel like Prometheus. It does **not** index the full text of logs. It indexes only a small set of **labels** per stream and stores the log lines compressed. This makes it cheap to run and fast for label-based queries.'},
{svg:loki},
{h:'Key ideas'},
{t:[['Term','Meaning'],
['**Log line**','One entry with a timestamp and text'],
['**Label**','Key/value metadata such as `app`, `env`, `namespace`'],
['**Stream**','All lines sharing the exact same label set'],
['**Chunk**','Compressed block of lines of one stream, stored in object storage'],
['**Index**','Maps label sets to chunks (small)']]},
{h:'Loki vs full-text indexing'},
{t:[['','Loki','Elasticsearch-style'],
['**What is indexed**','Labels only','Every word'],
['**Storage cost**','Low','High'],
['**Query speed for text search**','Scans matching chunks (parallel)','Very fast from index'],
['**Best for**','Known service or host, then filter','Ad-hoc search across everything'],
['**Operational weight**','Lighter','Heavier']]},
{h:'The label rule'},
{p:'Just like Prometheus, **high-cardinality labels are harmful**. Every unique label set is a new stream. Use a few stable labels (`namespace`, `app`, `env`, `level`) and put the rest in the log line, where you filter and parse it at query time.'},
{t:[['Good labels','Bad labels'],
['`app`, `namespace`, `env`, `cluster`, `level`','`user_id`, `request_id`, `ip`, `url`, timestamps']]},
{h:'Deployment modes'},
{t:[['Mode','Use'],
['**Monolithic**','One process; labs and small volumes'],
['**Simple scalable / distributed**','Read and write paths scaled separately in production'],
['**Microservices**','All components separate for very large setups']]},
{h:'Quick start'},
{code:`docker run -d --name loki -p 3100:3100 grafana/loki

# then in Grafana: Connections, Data sources, Add data source, Loki
# URL: http://loki:3100`},
{note:'Think of Loki as "grep with labels, at scale". Select streams by label first (cheap), then filter text (scan).'}],
src:[['Loki overview',LK],['Loki labels',LK+'get-started/labels/']]};

/* ---------- 1: Collecting logs ---------- */
L['prom:9:1']={blocks:[
{p:'Logs must be read from files or container runtimes, labelled and pushed to Loki. **Grafana Alloy** is the current collector for this and for metrics and traces too. **Promtail** is the older log-only agent and is being retired, but you will still find it in existing setups.'},
{h:'Agents'},
{t:[['Agent','Status','Notes'],
['**Grafana Alloy**','Current, recommended','Collects logs, metrics and traces; OpenTelemetry compatible'],
['**Promtail**','Deprecated, legacy','Log-only; migrate to Alloy'],
['**Docker Loki logging driver**','Alternative','Simple, but affects the Docker daemon'],
['**OpenTelemetry Collector**','Alternative','Can send logs to Loki via OTLP']]},
{h:'Alloy: files to Loki'},
{code:`// config.alloy
local.file_match "app" {
  path_targets = [{"__path__" = "/var/log/app/*.log", "app" = "shop", "env" = "prod"}]
}

loki.source.file "app" {
  targets    = local.file_match.app.targets
  forward_to = [loki.write.default.receiver]
}

loki.write "default" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}`},
{p:'Alloy configuration is a pipeline of **components**: a source reads data, optional components transform it, and a writer sends it on. `forward_to` wires them together.'},
{h:'Docker and Kubernetes'},
{code:`// containers on a Docker host
discovery.docker "local" {
  host = "unix:///var/run/docker.sock"
}
discovery.relabel "containers" {
  targets = discovery.docker.local.targets
  rule {
    source_labels = ["__meta_docker_container_name"]
    regex         = "/(.*)"
    target_label  = "container"
  }
}
loki.source.docker "containers" {
  host       = "unix:///var/run/docker.sock"
  targets    = discovery.relabel.containers.output
  forward_to = [loki.write.default.receiver]
}`},
{p:'On Kubernetes, Alloy runs as a **DaemonSet**, discovers pods with `discovery.kubernetes` and tails their log files, turning pod metadata (namespace, pod, container, app label) into Loki labels.'},
{h:'What a good pipeline does'},
{flow:['Discover files or containers','Attach a small set of stable labels','Optionally parse and drop noisy lines','Batch and send to Loki with retries','Verify in Grafana Explore']},
{h:'Check it works'},
{code:`# Loki push endpoint is up
curl -s http://loki:3100/ready

# last lines in Grafana Explore (Loki)
{app="shop"}`},
{note:'For a new setup choose Alloy. If you inherit Promtail, plan the migration: Alloy ships a conversion command for Promtail configuration files.'}],
src:[['Grafana Alloy','https://grafana.com/docs/alloy/latest/'],['Send logs to Loki',LK+'send-data/']]};

/* ---------- 2: LogQL ---------- */
L['prom:9:2']={blocks:[
{p:'**LogQL** is Loki query language. It looks like PromQL: you first select streams by labels, then filter and parse lines, and optionally turn the result into **metrics**.'},
{h:'The structure of a query'},
{flow:['Stream selector picks streams by label','Line filters narrow by text','A parser extracts fields from the line','Label filters compare extracted fields','Optional metric function turns lines into numbers']},
{h:'Stream selector and line filters'},
{code:`{app="shop", env="prod"}                       # all lines
{app="shop"} |= "timeout"                       # contains
{app="shop"} != "healthcheck"                   # does not contain
{app="shop"} |~ "error|exception"               # regex match
{app="shop"} !~ "debug|trace"                   # regex not match`},
{t:[['Operator','Meaning'],
['`|=` and `!=`','Contains or does not contain a string'],
['`|~` and `!~`','Matches or does not match a regex']]},
{h:'Parsers and label filters'},
{code:`{app="shop"} | json | status >= 500
{app="shop"} | logfmt | level="error" | duration > 1s
{app="nginx"} | pattern "<ip> - - <_> \\"<method> <uri> <_>\\" <status> <size>"
{app="shop"} | json | line_format "{{.method}} {{.path}} took {{.duration}}"`},
{t:[['Parser','Use'],
['`json`','JSON logs; fields become labels'],
['`logfmt`','key=value logs'],
['`pattern`','Fixed text layouts with placeholders'],
['`regexp`','Arbitrary patterns with named groups'],
['`line_format`','Rewrite the displayed line']]},
{h:'Metric queries'},
{code:`# errors per second per app
sum by (app) (rate({env="prod"} |= "error" [5m]))

# number of lines in the last hour
count_over_time({app="shop"}[1h])

# 5xx responses per minute from parsed JSON
sum(rate({app="shop"} | json | status >= 500 [1m]))

# p95 request duration from a logged field
quantile_over_time(0.95, {app="shop"} | json | unwrap duration [5m]) by (app)`},
{h:'Where it is used'},
{ul:['**Explore and log panels** to read lines.','**Time series panels** to graph error rates from logs.','**Alert rules** (Grafana or Loki ruler) to alert on log patterns.','**Recording rules** to precompute counts of log patterns into Prometheus-compatible metrics.']},
{h:'Performance habits'},
{ul:['Use the **narrowest stream selector** possible; add `app` and `env`.','Put **cheap filters first** (`|=`) before parsers.','Do not query a long range with only a broad selector.']},
{note:'Metrics from logs are a convenient bridge, but prefer real instrumentation for important service levels. Logs can be sampled, rotated or dropped.'}],
src:[['LogQL',LK+'query/'],['Log queries',LK+'query/log_queries/'],['Metric queries',LK+'query/metric_queries/']]};

/* ---------- 3: Tracing ---------- */
L['prom:9:3']={blocks:[
{p:'A **trace** follows one request through every service it touches. Each step is a **span** with a start, a duration and attributes. Traces answer the question metrics and logs cannot: **where in this request did the time go?**'},
{svg:trace},
{h:'Vocabulary'},
{t:[['Term','Meaning'],
['**Trace**','The whole journey of one request, identified by a trace ID'],
['**Span**','One operation inside a trace (an HTTP call, a query)'],
['**Parent / child**','Spans form a tree; a span records its parent span ID'],
['**Attributes**','Key/value details: `http.method`, `db.statement`'],
['**Context propagation**','Passing the trace ID in headers (W3C `traceparent`) to the next service'],
['**Sampling**','Keeping only some traces to control volume']]},
{h:'OpenTelemetry'},
{p:'**OpenTelemetry (OTel)** is the vendor-neutral standard for generating and shipping telemetry. Applications use an **SDK**, send data with **OTLP**, and an optional **Collector** routes it to backends such as Tempo.'},
{flow:['Application instrumented with OpenTelemetry SDK','Spans sent over OTLP to a Collector or Alloy','Collector batches, samples and forwards','Tempo stores traces in object storage','Grafana queries by trace ID or with TraceQL']},
{h:'Collector to Tempo'},
{code:`# otel-collector.yaml
receivers:
  otlp:
    protocols:
      grpc:      # port 4317
      http:      # port 4318
processors:
  batch: {}
exporters:
  otlp:
    endpoint: tempo:4317
    tls:
      insecure: true
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]`},
{h:'Tempo'},
{ul:['Stores traces cheaply in **object storage**, with a minimal index.','Finds traces by **trace ID** fast; searches use **TraceQL** and attributes.','Can generate **metrics** (request rate, errors, duration) from spans and send them to Prometheus.']},
{code:`# TraceQL: slow requests with errors in one service
{ resource.service.name = "payments" && status = error && duration > 500ms }`},
{h:'Sampling'},
{t:[['Type','Decision made','Trade-off'],
['**Head sampling**','At the start of the request','Cheap; may miss rare errors'],
['**Tail sampling**','After the trace is complete','Keeps errors and slow ones; needs a Collector with memory']]},
{note:'Metrics tell you **that** it is slow, logs tell you **what** happened, traces tell you **where**.'}],
src:[['Tempo documentation',TP],['OpenTelemetry','https://opentelemetry.io/docs/']]};

/* ---------- 4: Correlation ---------- */
L['prom:9:4']={blocks:[
{p:'The real value of the stack is not three separate tools but **moving between them in one click**. Grafana can link a metric spike to the logs and traces of the same moment and service, if the data shares the right identifiers.'},
{svg:corr},
{h:'The links that make it work'},
{t:[['From','To','How it is configured'],
['**Metric graph**','Trace','**Exemplars**: trace IDs attached to histogram samples'],
['**Log line**','Trace','Loki data source **derived field** extracts `trace_id` and links to Tempo'],
['**Trace span**','Logs','Tempo **trace to logs**: query Loki with service labels and the time window'],
['**Trace span**','Metrics','Tempo **trace to metrics**: run a PromQL query for the service'],
['**Dashboard**','Logs','Explore link or a logs panel using the same `$service` variable']]},
{h:'A derived field in Loki'},
{code:`# Loki data source settings (UI or provisioning)
derivedFields:
  - name: TraceID
    matcherRegex: 'trace_id=(\\w+)'
    url: '\${__value.raw}'
    datasourceUid: tempo`},
{h:'Exemplars'},
{p:'An **exemplar** is a sample trace ID attached to a metric observation. With exemplar storage enabled and a client library that supports them, a latency graph shows dots you can click to open the exact slow trace.'},
{code:`# start Prometheus with
--enable-feature=exemplar-storage`},
{h:'Be consistent'},
{ul:['Use the **same label names** everywhere: `service`, `namespace`, `env`. Linking relies on them.','Log the **trace ID** on every request line (a structured field).','Keep clocks synchronised with NTP so time windows line up.']},
{h:'A typical investigation'},
{flow:['Alert fires for high latency on checkout','Open the dashboard; spot the time and service','Click an exemplar or use Explore to open a slow trace','Find the slow span (the bank API call)','Open logs for that span to read the error text']},
{note:'Without shared labels and trace IDs, you still have three good tools; with them you have an observability platform.'}],
src:[['Correlate telemetry',K.G+'explore/'],['Exemplars',K.G+'fundamentals/exemplars/'],['Derived fields',K.G+'datasources/loki/configure-loki-data-source/']]};
})();
