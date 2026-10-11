/* LearnSphere - Prometheus & Grafana, Section 05: PromQL: Querying Metrics.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs prom-common.js. */
(function(){
const K=window.PM,L=window.LESSONS,Q=K.PQ,PG=K.PG;

/* ---------- diagrams ---------- */
const vectors=K.dg(700,230,[
[10,10,680,210,'The four PromQL data types',1],
[30,50,150,60,'Instant vector|one value per series|at one moment',2],[200,50,150,60,'Range vector|many values per series|over a time span',2],[370,50,140,60,'Scalar|one number|42',0],[530,50,140,60,'String|text|rarely used',0],
[30,140,150,60,'http_requests_total',0],[200,140,150,60,'http_requests_total[5m]',0],[370,140,140,60,'Used as constant|in expressions',0],[530,140,140,60,'Label values|in some functions',0]],
[[105,110,105,140],[275,110,275,140],[440,110,440,140],[600,110,600,140]]);

const rateFlow=K.dg(700,170,[
[10,10,680,150,'Raw counter to a useful number',1],
[30,55,130,60,'Counter|1000, 1060, 1130,|0 (restart), 40',0],[200,55,130,60,'rate(...[5m])|handles resets|per-second average',2],[370,55,130,60,'sum by (code)|collapse series',2],[540,55,130,60,'Graph or alert|requests per second',0]],
[[160,85,200,85],[330,85,370,85],[500,85,540,85]]);

const match=K.dg(700,200,[
[10,10,680,180,'Vector matching',1],
[30,50,200,50,'errors{job, instance}',0],[30,120,200,50,'requests{job, instance}',0],
[290,70,130,70,'errors / requests|one-to-one match|on identical labels',2],[490,50,180,50,'job1,inst1 : 0.02',0],[490,120,180,50,'job1,inst2 : 0.05',0]],
[[230,75,290,95],[230,145,290,115],[420,95,490,75],[420,115,490,145]]);

const rec=K.dg(700,170,[
[10,10,680,150,'Recording rules precompute expensive expressions',1],
[30,55,140,60,'Raw series|many, high volume',0],[210,55,150,60,'Rule evaluated|every interval|sum by (job) (...)',2],[400,55,120,60,'New series|job:http_requests:|rate5m',2],[560,55,110,60,'Dashboards|and alerts',0]],
[[170,85,210,85],[360,85,400,85],[520,85,560,85]]);

/* ---------- 0: Selectors ---------- */
L['prom:4:0']={blocks:[
{p:'**PromQL** (Prometheus Query Language) is a functional language built for time-series data. Every expression has a **type**, and most mistakes come from using the wrong type in the wrong place. Start with selectors: how you choose which series you are talking about.'},
{svg:vectors},
{h:'Instant vector selectors'},
{p:'A metric name, with optional label matchers in braces, returns **one sample per matching series** at the evaluation time.'},
{code:`http_requests_total
http_requests_total{job="api"}
http_requests_total{job="api", code=~"5.."}
http_requests_total{job!="batch", method!~"OPTIONS|HEAD"}
{__name__=~"http_.*", job="api"}`},
{h:'Label matchers'},
{t:[['Matcher','Meaning','Example'],
['`=`','Equals','`code="200"`'],
['`!=`','Not equal','`code!="200"`'],
['`=~`','Matches regex','`code=~"5.."`'],
['`!~`','Does not match regex','`path!~"/health.*"`']]},
{ul:['Regexes are **fully anchored**: `code=~"5"` matches only `5`, not `500`. Write `5..` or `5.*`.','At least one matcher must not match the empty string, so `{job=~".*"}` alone is invalid.','Regex uses the RE2 syntax; there is no lookahead.']},
{h:'Range vector selectors'},
{p:'Add a duration in square brackets to get **all samples in that window** for each series.'},
{code:`http_requests_total[5m]        # last 5 minutes of samples
node_load1[1h]`},
{t:[['Unit','Meaning'],
['`ms`, `s`, `m`, `h`','Milliseconds, seconds, minutes, hours'],
['`d`, `w`, `y`','Days, weeks, years'],
['`1h30m`','Units can be combined']]},
{p:'A range vector **cannot be graphed directly**. You pass it to a function such as `rate()` that returns an instant vector.'},
{h:'Time-shifting'},
{code:`http_requests_total offset 1h              # value an hour ago
rate(http_requests_total[5m] offset 1d)    # yesterday at this time`},
{h:'Staleness and lookback'},
{ul:['An instant vector returns the **most recent sample within the last 5 minutes** (lookback delta).','When a target or series disappears, Prometheus writes a **stale marker** so the series stops appearing immediately.','The Table tab shows an instant query; the Graph tab runs it at many steps across a range.']},
{note:'Exam tip: `http_requests_total[5m]` is a range vector, `rate(http_requests_total[5m])` is an instant vector. Aggregations such as `sum` accept only instant vectors.'}],
src:[['Querying basics',Q+'basics/'],['Operators',Q+'operators/']]};

/* ---------- 1: rate ---------- */
L['prom:4:1']={blocks:[
{p:'A counter is a running total since the process started. Graphing the raw value is almost never useful: a restart drops it to zero and the number tells you nothing about how busy the service is **now**. You always convert it to a rate.'},
{svg:rateFlow},
{h:'The three functions'},
{t:[['Function','Returns','Best for'],
['`rate(v[5m])`','Per-second average rate over the window, smoothed','Graphs, alerts, recording rules'],
['`irate(v[5m])`','Per-second rate from the **last two** samples','Fast-moving, zoomed-in graphs'],
['`increase(v[1h])`','Total increase over the window (like rate times seconds)','"How many in the last hour?"']]},
{code:`rate(http_requests_total[5m])                  # requests per second
sum(rate(http_requests_total[5m]))             # whole service
increase(http_requests_total[1h])              # requests in the last hour
irate(node_cpu_seconds_total{mode="idle"}[1m])`},
{h:'What rate() does for you'},
{ul:['**Handles counter resets**: a drop to zero is treated as a restart, not a negative rate.','**Extrapolates** to the window edges, so results can be fractional.','Needs **at least two samples** in the window, otherwise the series is empty.']},
{h:'Choosing the window'},
{ul:['Use at least **four times the scrape interval**: 15 s scrapes need `[1m]` or more.','Longer windows smooth spikes but react slower. 5 minutes is a common default.','In Grafana prefer `$__rate_interval`, which adapts to the panel and scrape interval.']},
{h:'Mistakes to avoid'},
{t:[['Mistake','Why it is wrong','Do instead'],
['`rate()` on a gauge','Gauges can fall; rate assumes resets','`deriv()`, `delta()`'],
['`sum(...)` then `rate()`','Resets of individual series are hidden','`sum(rate(...))`'],
['`rate(sum(...)[5m])`','Not valid: sum returns an instant vector','Use a subquery only if you really need it'],
['Graph raw counter','Meaningless after restarts','`rate()` or `increase()`']]},
{h:'Order of operations'},
{flow:['Select the counter series','Apply rate or increase over a range','Aggregate with sum, by or without','Compare, divide or alert on the result']},
{note:'Exam tip: always take `rate()` **first**, then `sum()`. Summing counters first can hide resets and produce wrong values.'}],
src:[['rate()',Q+'functions/#rate'],['Why rate then sum','https://www.robustperception.io/rate-then-sum-never-sum-then-rate/']]};

/* ---------- 2: Aggregation ---------- */
L['prom:4:2']={blocks:[
{p:'A single metric can have thousands of series. **Aggregation operators** collapse them into the answer you need: one number, or one line per team, per datacentre or per status code.'},
{h:'The operators'},
{t:[['Operator','Result'],
['`sum`','Total'],
['`avg`','Average'],
['`min`, `max`','Smallest, largest'],
['`count`','Number of series'],
['`group`','Value 1 for each group; useful for existence checks'],
['`stddev`, `stdvar`','Spread'],
['`topk(n, v)`, `bottomk(n, v)`','The n largest or smallest series (keeps labels)'],
['`quantile(q, v)`','The q-quantile across series at one instant'],
['`count_values("l", v)`','How many series have each value']]},
{h:'by and without'},
{p:'`by` lists the labels to **keep**. `without` lists the labels to **drop**, keeping everything else.'},
{code:`sum by (job) (rate(http_requests_total[5m]))        # keep only job
sum without (instance) (rate(http_requests_total[5m]))  # drop instance, keep the rest
sum by (job, code) (rate(http_requests_total[5m]))
sum(rate(http_requests_total[5m]))                  # collapse everything`},
{t:[['Series input','`sum by (job)`','`sum without (instance)`'],
['`{job="a", instance="1", code="200"}`','`{job="a"}`','`{job="a", code="200"}`'],
['`{job="a", instance="2", code="200"}`','joins the group above','joins the group above'],
['`{job="a", instance="1", code="500"}`','joins the group above','`{job="a", code="500"}`']]},
{h:'Typical uses'},
{code:`topk(5, sum by (instance) (rate(node_network_receive_bytes_total[5m])))
count by (job) (up == 1)                  # healthy targets per job
count(up == 0)                            # how many are down
max by (instance) (node_load1)
avg(node_memory_MemAvailable_bytes)`},
{h:'Aggregating over time (per series)'},
{p:'Functions ending in `_over_time` work **along time** on a range vector, one result per series.'},
{code:`avg_over_time(node_load1[1h])
max_over_time(go_goroutines[1d])
quantile_over_time(0.95, request_latency_seconds[1h])`},
{t:[['','Across series (aggregation)','Over time (`_over_time`)'],
['**Input**','Instant vector','Range vector'],
['**Collapses**','Many series into fewer','Many samples into one per series'],
['**Example**','`sum by (job) (...)`','`max_over_time(x[1h])`']]},
{note:'Prefer `without` when you want to keep unknown future labels. Prefer `by` when you want an exact, stable output set for alerts and dashboards.'}],
src:[['Aggregation operators',Q+'operators/#aggregation-operators'],['_over_time functions',Q+'functions/#aggregation_over_time']]};

/* ---------- 3: Binary operators ---------- */
L['prom:4:3']={blocks:[
{p:'Binary operators combine two expressions: metric with number, or metric with metric. When both sides are vectors, Prometheus must decide **which series pairs up with which**. That is vector matching.'},
{h:'Operators'},
{t:[['Kind','Operators','Notes'],
['**Arithmetic**','`+ - * / % ^`','Result drops the metric name'],
['**Comparison**','`== != > < >= <=`','Filters by default; add `bool` to return 0 or 1'],
['**Logical / set**','`and`, `or`, `unless`','Only between vectors']]},
{code:`node_memory_MemAvailable_bytes / 1024 / 1024         # scalar math
node_load1 > 4                                       # filter: only series above 4
node_load1 > bool 4                                  # 1 or 0 for every series
up == 1 and on (instance) node_load1 > 4             # intersection`},
{h:'One-to-one matching'},
{svg:match},
{p:'By default two series match when **all their labels except the metric name** are identical. Use `on` or `ignoring` to change what is compared.'},
{code:`# match only on instance, ignore other labels
node_filesystem_avail_bytes / on (instance) node_memory_MemTotal_bytes

# match on everything except mountpoint
a / ignoring (mountpoint) b`},
{h:'Many-to-one and one-to-many'},
{p:'When one side has several series for each match, you must say which side is the "many" with `group_left` or `group_right`. You can also copy labels from the "one" side.'},
{code:`# Add the hostname label from node_uname_info to every CPU series
rate(node_cpu_seconds_total{mode="idle"}[5m])
  * on (instance) group_left (nodename)
    node_uname_info`},
{t:[['Modifier','The "many" side is','Use'],
['`group_left`','Left','Left has several series per match'],
['`group_right`','Right','Right has several series per match']]},
{h:'Info metrics'},
{p:'Metrics ending in `_info` have a value of **1** and carry descriptive labels such as version or hostname. Multiply by them with `group_left` to attach those labels to other series without changing the value.'},
{h:'Logical operators'},
{t:[['Operator','Result'],
['`a and b`','Series of a that also exist in b'],
['`a or b`','All of a plus series of b not already in a'],
['`a unless b`','Series of a that do not exist in b']]},
{code:`# hosts that are up but have no load metric
up{job="node"} unless on (instance) node_load1

# default to zero when a series is missing
sum(rate(errors_total[5m])) or vector(0)`},
{note:'The most common error is "many-to-many matching not allowed". Fix it by narrowing with `on(...)`, or by declaring `group_left` / `group_right`.'}],
src:[['Binary operators',Q+'operators/#binary-operators'],['Vector matching',Q+'operators/#vector-matching']]};

/* ---------- 4: Histograms ---------- */
L['prom:4:4']={blocks:[
{p:'Latency is best described by **percentiles**, not averages: the average hides the slow tail that real users feel. Histograms store the data you need, and `histogram_quantile()` turns buckets into a percentile estimate.'},
{h:'The standard query'},
{code:`histogram_quantile(
  0.95,
  sum by (le) (rate(http_request_duration_seconds_bucket[5m]))
)`},
{flow:['rate() each bucket counter over the window','sum by (le) across instances (keep le)','histogram_quantile(0.95, ...) estimates the 95th percentile','Result is in seconds']},
{h:'Rules that prevent wrong answers'},
{ul:['**Keep `le`.** Aggregate with `by (le)` or `by (le, job)`. Dropping `le` destroys the buckets.','**Aggregate before the quantile**, never the reverse. Averaging p95 values from several instances is mathematically meaningless.','Always apply **`rate()`** to the buckets, otherwise you get a quantile over all time since start.','The estimate is **linear inside a bucket**, so accuracy depends on bucket boundaries.']},
{h:'Bucket design'},
{t:[['Situation','Effect','Fix'],
['Buckets too coarse around your SLO','p95 jumps in large steps','Add boundaries near the target, such as 0.25 and 0.3'],
['Values above the highest bucket','Quantile returns the highest finite bound','Add a larger bucket'],
['Too many buckets and labels','High cardinality','Fewer buckets, fewer labels']]},
{h:'Average and share-under-threshold'},
{code:`# average latency from the sum and count series
sum(rate(http_request_duration_seconds_sum[5m]))
/ sum(rate(http_request_duration_seconds_count[5m]))

# fraction of requests faster than 300 ms (a good SLI)
sum(rate(http_request_duration_seconds_bucket{le="0.3"}[5m]))
/ sum(rate(http_request_duration_seconds_count[5m]))`},
{h:'Per-service percentiles'},
{code:`histogram_quantile(0.99,
  sum by (le, service) (rate(http_request_duration_seconds_bucket[5m])))`},
{h:'Native histograms'},
{p:'Newer Prometheus versions support **native histograms**: one series with automatically sized buckets. The query is simpler, without `le` or the `_bucket` suffix, but the principles (rate, then aggregate, then quantile) are the same.'},
{code:`histogram_quantile(0.95, sum(rate(http_request_duration_seconds[5m])))`},
{note:'Exam tip: the quantile is an **estimate**. A quantile from a summary is exact in the client but cannot be aggregated; a quantile from a histogram can be aggregated but is approximate.'}],
src:[['histogram_quantile()',Q+'functions/#histogram_quantile'],['Histograms and summaries',PG+'histograms/']]};

/* ---------- 5: Time functions ---------- */
L['prom:4:5']={blocks:[
{p:'Good monitoring compares the present with the past and looks at how values **change**. PromQL gives you time modifiers, change functions and subqueries for that.'},
{h:'offset and @'},
{code:`# now vs the same time yesterday
rate(http_requests_total[5m])
  / rate(http_requests_total[5m] offset 1d)

# fixed evaluation time (Unix seconds)
http_requests_total @ 1700000000
http_requests_total @ start()`},
{t:[['Modifier','Meaning'],
['`offset 1h`','Evaluate the selector one hour earlier'],
['`@ <unix time>`','Evaluate at an absolute time'],
['`@ start()` / `@ end()`','Start or end of the query range']]},
{h:'Change functions for gauges'},
{t:[['Function','Returns'],
['`delta(g[1h])`','Difference between first and last value'],
['`deriv(g[1h])`','Per-second slope using linear regression'],
['`predict_linear(g[6h], 3600)`','Value predicted in 3600 seconds'],
['`changes(g[1h])`','Number of times the value changed'],
['`resets(c[1h])`','Number of counter resets']]},
{code:`predict_linear(node_filesystem_avail_bytes[6h], 4*3600) < 0     # disk full in 4 hours
changes(process_start_time_seconds[1h]) > 0                      # a restart happened`},
{h:'Time and date functions'},
{code:`time()                       # current Unix time (seconds)
time() - process_start_time_seconds   # uptime in seconds
timestamp(up)                # sample timestamps
hour() >= 9 and hour() < 17  # business hours (UTC)
day_of_week() == 0           # Sunday`},
{h:'Subqueries'},
{p:'A **subquery** evaluates an instant expression repeatedly over a range, producing a range vector you can feed to another function. Syntax: `expr[range:resolution]`.'},
{code:`# the highest 5-minute request rate seen in the past day
max_over_time(rate(http_requests_total[5m])[1d:1m])

# average of the CPU busy ratio over a week, computed hourly
avg_over_time((1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])))[7d:1h])`},
{ul:['Subqueries can be **expensive**: they re-run the inner query many times.','For a value you need often, use a **recording rule** and apply `_over_time` to its output.']},
{note:'`offset` and `@` change when a selector is evaluated; a subquery changes the shape of the result. Know the difference.'}],
src:[['Subqueries',Q+'basics/#subquery'],['Functions',Q+'functions/']]};

/* ---------- 6: Patterns ---------- */
L['prom:4:6']={blocks:[
{p:'These patterns appear again and again in dashboards and alerts. Learn them as a toolbox, and notice that they combine the same few ideas: rate, aggregate, divide.'},
{h:'Requests, errors and ratios'},
{code:`# Request rate per service
sum by (service) (rate(http_requests_total[5m]))

# Error ratio (0 to 1)
sum by (service) (rate(http_requests_total{code=~"5.."}[5m]))
/
sum by (service) (rate(http_requests_total[5m]))

# Availability over 30 days
1 - (sum(increase(http_requests_total{code=~"5.."}[30d]))
     / sum(increase(http_requests_total[30d])))`},
{h:'Latency'},
{code:`# p95 per service
histogram_quantile(0.95,
  sum by (le, service) (rate(http_request_duration_seconds_bucket[5m])))

# Apdex-like: share of requests under 300 ms
sum(rate(http_request_duration_seconds_bucket{le="0.3"}[5m]))
/ sum(rate(http_request_duration_seconds_count[5m]))`},
{h:'Saturation and resources'},
{code:`# CPU busy per host
1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))

# Memory used ratio
1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes

# Disk full in 24h
predict_linear(node_filesystem_avail_bytes{fstype!="tmpfs"}[6h], 24*3600) < 0

# Containers close to their memory limit
container_memory_working_set_bytes / container_spec_memory_limit_bytes > 0.9`},
{h:'Is it there? (absence)'},
{code:`# A job with no healthy targets at all
absent(up{job="payments"} == 1)

# A metric that stopped being reported
absent_over_time(myapp_heartbeat_total[10m])

# Targets that are down
up == 0`},
{h:'Handy helpers'},
{t:[['Function','Use'],
['`label_replace(v, dst, repl, src, regex)`','Create or rewrite a label at query time'],
['`clamp_min(v, 0)`, `clamp_max(v, 1)`','Bound values'],
['`round(v, 0.1)`','Round to a nearest multiple'],
['`sort_desc(v)`','Order table output'],
['`scalar(v)`','Convert a single-element vector to a number'],
['`vector(0)`','A constant series, for `or vector(0)` defaults']]},
{h:'Thinking recipe'},
{flow:['What question am I answering?','Which metric and labels contain it?','Is it a counter? Apply rate or increase','Aggregate to the level I care about','Divide or compare, then format with a unit']},
{note:'When a query returns "no data", check the selector first: `count(metric_name)` shows whether the series exists at all.'}],
src:[['Query examples',Q+'examples/'],['absent()',Q+'functions/#absent']]};

/* ---------- 7: Recording rules ---------- */
L['prom:4:7']={blocks:[
{p:'Some queries are expensive or used in many places. A **recording rule** evaluates a PromQL expression on a schedule and stores the result as a new time series, so dashboards and alerts read a cheap precomputed value.'},
{svg:rec},
{h:'A rules file'},
{code:`# rules/http.yml  (listed under rule_files in prometheus.yml)
groups:
  - name: http_aggregations
    interval: 30s                 # optional, defaults to evaluation_interval
    rules:
      - record: job:http_requests:rate5m
        expr: sum by (job) (rate(http_requests_total[5m]))

      - record: job:http_errors:ratio_rate5m
        expr: |
          sum by (job) (rate(http_requests_total{code=~"5.."}[5m]))
          /
          sum by (job) (rate(http_requests_total[5m]))
        labels:
          team: platform`},
{h:'Naming: level:metric:operations'},
{t:[['Part','Meaning','Example'],
['**level**','Labels the series is aggregated to','`job`, `instance:node`'],
['**metric**','The base metric name, usually without `_total`','`http_requests`'],
['**operations**','Functions applied, newest first','`rate5m`, `ratio_rate5m`']]},
{h:'Why use them'},
{ul:['**Speed:** dashboards load a ready series instead of aggregating thousands each time.','**Consistency:** everyone uses the same definition of "error ratio".','**Alerting:** simpler, faster alert expressions.','**History:** keep a long-lived aggregate and drop raw series sooner.']},
{h:'Rules of the road'},
{ul:['Keep the **source labels you need**; aggregate with `by` or `without` consciously.','Do not take `rate()` of a recorded rate. Record the rate, then use `avg_over_time` or `max_over_time` on it.','Rules are evaluated every `evaluation_interval`; a rule run takes the data **as of that moment**.','Recorded series are normal series: they have cardinality and storage cost.']},
{h:'Validate and reload'},
{code:`promtool check rules rules/http.yml
curl -X POST localhost:9090/-/reload`},
{p:'Use the **Rules** page of the UI (`/rules`) to see each group, last evaluation time and any error.'},
{note:'Do not record everything. Record what is **expensive**, what is **reused**, or what is **needed for alerting at speed**.'}],
src:[['Recording rules',K.PP+'configuration/recording_rules/'],['Rule naming best practices',PG+'rules/']]};
})();
