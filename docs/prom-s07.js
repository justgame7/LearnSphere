/* LearnSphere - Prometheus & Grafana, Section 07: Grafana Fundamentals.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs prom-common.js. */
(function(){
const K=window.PM,L=window.LESSONS,G=K.G;

/* ---------- diagrams ---------- */
const arch=K.dg(700,200,[
[10,10,680,180,'Grafana does not store metrics, it queries them',1],
[30,70,110,60,'Browser|you',0],[200,60,150,80,'Grafana|dashboards, alerts,|users and folders',2],[420,30,120,40,'Prometheus',0],[420,80,120,40,'Loki',0],[420,130,120,40,'Tempo',0],[580,70,90,60,'SQLite or|Postgres|(Grafana DB)',0]],
[[140,100,200,100],[350,90,420,50],[350,100,420,100],[350,115,420,150],[500,100,580,100]]);

const anatomy=K.dg(700,230,[
[10,10,680,210,'Anatomy of a dashboard',1],
[30,40,640,36,'Dashboard header: title, time range picker, refresh, variables ($env, $instance)',2],
[30,90,200,70,'Panel: Stat|requests per second',0],[250,90,200,70,'Panel: Time series|latency p95',0],[470,90,200,70,'Panel: Gauge|CPU used',0],
[30,170,420,50,'Panel: Time series, one line per instance',0],[470,170,200,50,'Panel: Table|top endpoints',0]],
[]);

const varflow=K.dg(700,150,[
[10,10,680,130,'How a variable drives a dashboard',1],
[30,55,130,55,'Query variable|label_values(...)',0],[200,55,130,55,'Drop-down|shows the values',2],[370,55,130,55,'You pick one|or several',0],[540,55,130,55,'Panels re-run|with the choice',2]],
[[160,82,200,82],[330,82,370,82],[500,82,540,82]]);

/* ---------- 0: Install ---------- */
L['prom:6:0']={blocks:[
{p:'**Grafana** is a web application for visualising data from many sources. It does not collect or store your metrics itself: it sends queries to **data sources** such as Prometheus and draws what comes back. Its own database only holds dashboards, users and settings.'},
{svg:arch},
{h:'Run Grafana in Docker'},
{code:`docker run -d --name grafana -p 3000:3000 \\
  -v grafana-data:/var/lib/grafana \\
  grafana/grafana`},
{p:'Open **http://localhost:3000**. A new installation signs in with user `admin` and password `admin` and asks you to change the password immediately.'},
{h:'Install on a Linux VM (Debian family)'},
{code:`sudo apt-get install -y apt-transport-https software-properties-common wget
sudo mkdir -p /etc/apt/keyrings
wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | sudo tee /etc/apt/sources.list.d/grafana.list
sudo apt-get update && sudo apt-get install -y grafana
sudo systemctl enable --now grafana-server`},
{h:'Where things live'},
{t:[['Item','Package install','Docker'],
['**Config**','`/etc/grafana/grafana.ini`','Environment variables `GF_<SECTION>_<KEY>`'],
['**Data (SQLite)**','`/var/lib/grafana/grafana.db`','`/var/lib/grafana` volume'],
['**Provisioning**','`/etc/grafana/provisioning/`','`/etc/grafana/provisioning/`'],
['**Logs**','`/var/log/grafana/`','Container logs'],
['**Port**','3000','3000']]},
{code:`# Set values with environment variables
docker run -d -p 3000:3000 \\
  -e GF_SECURITY_ADMIN_PASSWORD__FILE=/run/secrets/grafana_admin \\
  -e GF_SERVER_ROOT_URL=https://grafana.example.com \\
  grafana/grafana`},
{h:'A tour of the interface'},
{t:[['Menu item','What it is for'],
['**Home**','Starred and recent dashboards'],
['**Dashboards**','Browse, search, folders, playlists'],
['**Explore**','Ad-hoc queries without making a dashboard; the best place to learn PromQL'],
['**Alerting**','Alert rules, contact points, policies, silences'],
['**Connections**','Data sources and plugins'],
['**Administration**','Users, teams, organisations, settings']]},
{note:'For production, Grafana should use an external database (PostgreSQL or MySQL) when you run more than one instance. SQLite is fine for a single server and labs.'}],
src:[['Install Grafana',G+'setup-grafana/installation/'],['Configure Grafana',G+'setup-grafana/configure-grafana/']]};

/* ---------- 1: Data sources ---------- */
L['prom:6:1']={blocks:[
{p:'A **data source** tells Grafana where to fetch data and how to authenticate. Panels are always tied to a data source (or to a mix of them). Prometheus is the one you will use most in this course.'},
{h:'Add Prometheus'},
{flow:['Connections, then Data sources, then Add data source','Choose Prometheus','Set the URL, for example http://prometheus:9090','Set the scrape interval to match your Prometheus (15s)','Click Save and test and look for the green message']},
{t:[['Setting','Meaning','Tip'],
['**URL**','Where Grafana server reaches Prometheus','Use the container or service name when both are in one network, not localhost'],
['**Authentication**','Basic auth, TLS client certificate, custom headers','Match the reverse proxy in front of Prometheus'],
['**Scrape interval**','Used to calculate `$__interval` and `$__rate_interval`','Set to your real scrape interval'],
['**Query timeout**','Maximum time for one query','60s is typical'],
['**HTTP method**','GET or POST','POST avoids URL length limits for long queries']]},
{h:'Common mistake'},
{p:'Grafana runs queries **from its server**, not from your browser. If Grafana runs in a container, `localhost:9090` points at the Grafana container itself. Use the Docker network name or host address instead.'},
{h:'Other data sources you will meet'},
{t:[['Data source','Used for'],
['**Prometheus** (and compatible: Mimir, Thanos, VictoriaMetrics)','Metrics with PromQL'],
['**Loki**','Logs with LogQL'],
['**Tempo**','Traces'],
['**PostgreSQL, MySQL, MSSQL**','Business or application data with SQL'],
['**CloudWatch, Azure Monitor, Google Cloud Monitoring**','Cloud provider metrics'],
['**Elasticsearch / OpenSearch**','Logs and search'],
['**Mixed**','A pseudo source that lets one dashboard use several']]},
{h:'Provisioning preview'},
{p:'Data sources can also be created from a file, which is how you make them repeatable (Section 8).'},
{code:`# /etc/grafana/provisioning/datasources/prometheus.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    jsonData:
      timeInterval: 15s`},
{note:'`access: proxy` (Server) is the standard: Grafana queries on behalf of the browser, so credentials never reach users.'}],
src:[['Prometheus data source',G+'datasources/prometheus/'],['Data sources overview',G+'datasources/']]};

/* ---------- 2: First dashboard ---------- */
L['prom:6:2']={blocks:[
{p:'A **dashboard** is a collection of panels on a grid with a shared time range. A **panel** is one query (or several) plus a visualisation. This lecture builds one from nothing.'},
{svg:anatomy},
{h:'Create and add a panel'},
{flow:['Dashboards, then New, then New dashboard','Add visualization and pick the Prometheus data source','Type a query in the query editor','Choose a visualization and a title on the right','Save the dashboard']},
{h:'The query editor'},
{t:[['Mode','What you get'],
['**Builder**','Pick metric and labels from lists; add operations like `rate`; good while learning'],
['**Code**','Write PromQL directly, with autocomplete and a metrics browser']]},
{code:`# A first panel: requests per second per instance
sum by (instance) (rate(prometheus_http_requests_total[$__rate_interval]))`},
{h:'Query options worth knowing'},
{t:[['Option','Purpose'],
['**Legend**','Format series names. `{{instance}}` shows the label value; `{{handler}} - {{code}}` combines labels'],
['**Min step**','Lowest query resolution; matches the scrape interval'],
['**Type: Range / Instant**','Time series over the range, or just the latest value (for tables and stat panels)'],
['**Format**','Time series, Table or Heatmap'],
['**Exemplars**','Show trace links on a graph when available']]},
{h:'Time range and refresh'},
{ul:['Use the **time picker** at the top right for absolute ranges (last 6 hours) and zoom by dragging on a graph.','**Refresh** at a sensible interval, not faster than the scrape interval.','Time-shift and comparison options live in the panel query options.']},
{h:'Interval variables'},
{t:[['Variable','Meaning'],
['`$__interval`','Grafana step based on range and panel width'],
['`$__rate_interval`','Safe window for `rate()`: at least four times the scrape interval'],
['`$__range`','The whole dashboard time range, for example for totals'],
['`$__from`, `$__to`','Time boundaries in milliseconds']]},
{h:'Inspect when something looks wrong'},
{p:'Press **e** on a panel to edit, or use the panel menu and **Inspect**. The **Query** tab shows the exact request, and **Data** shows the returned numbers, which is the fastest way to find a bad query.'},
{note:'Use `$__rate_interval` inside `rate()` instead of a fixed `[5m]`. A fixed window that is too small for a zoomed-out view produces gaps or noise.'}],
src:[['Build your first dashboard',G+'getting-started/build-first-dashboard/'],['Prometheus query editor',G+'datasources/prometheus/query-editor/']]};

/* ---------- 3: Visualisations ---------- */
L['prom:6:3']={blocks:[
{p:'The same query can be shown many ways. Choosing the right visualisation is a design decision: it should answer the viewer question at a glance.'},
{h:'Choose by question'},
{t:[['Question','Visualisation','Query type'],
['How does it change over time?','**Time series**','Range'],
['What is it right now?','**Stat**','Instant or reduced range'],
['How close is it to a limit?','**Gauge** or **Bar gauge**','Instant'],
['Which items are the biggest?','**Bar chart** or **Bar gauge** with topk','Instant'],
['Show me exact values for many series','**Table**','Instant, format Table'],
['How are latencies distributed over time?','**Heatmap**','Histogram buckets, format Heatmap'],
['Is it up or down over time?','**State timeline** or **Status history**','Range'],
['Show log lines','**Logs**','Loki'],
['Explain something in words','**Text**','None']]},
{h:'Time series'},
{p:'The default and most used. Settings include line or bars, fill, point size, stacking, axis placement and unit. Use **legend as a table** with Last and Max values to give numbers alongside the line.'},
{h:'Stat and gauge'},
{ul:['**Stat** shows one big number with an optional sparkline and colour. Choose the **calculation** (Last, Mean, Max, Total) because it decides what the number means.','**Gauge** shows a value against min and max. Always set both and a threshold so colour carries meaning.']},
{h:'Table'},
{p:'Use an **Instant** query so each series becomes one row. Combine several queries with transformations (next lecture). Add cell colouring and links for drill-down.'},
{h:'Heatmap for histograms'},
{code:`sum by (le) (increase(http_request_duration_seconds_bucket[$__rate_interval]))`},
{p:'Set **Format** to **Heatmap**. Each column is a moment, each row a latency bucket, and colour shows how many requests fell in it. It reveals bimodal distributions that a single percentile hides.'},
{h:'Good habits'},
{ul:['One main question per panel; put the unit and meaning in the **title** ("Error ratio, % of requests").','Use the same colours for the same meaning across the dashboard (red for errors).','Avoid pie charts for more than a few slices.','Limit lines per graph; use `topk` or a table when there are many.']},
{note:'Dashboards are for people at a glance. If a panel needs a paragraph of explanation, it is probably the wrong panel.'}],
src:[['Visualizations',G+'panels-visualizations/visualizations/'],['Time series panel',G+'panels-visualizations/visualizations/time-series/']]};

/* ---------- 4: Transformations ---------- */
L['prom:6:4']={blocks:[
{p:'You often want to change how data **looks** or combine results without touching the PromQL. Grafana separates this into **standard options** (units, thresholds), **transformations** (change the data) and **overrides** (special rules for individual series or fields).'},
{h:'Units, decimals and limits'},
{t:[['Option','Effect'],
['**Unit**','Formats numbers as bytes, percent (0 to 1 or 0 to 100), seconds, requests per second ...'],
['**Decimals**','Number of digits shown'],
['**Min / Max**','Axis and gauge range'],
['**Display name**','Rename a series, can use `\${__field.labels.instance}`'],
['**No value**','Text when a query returns nothing']]},
{p:'A well-named metric with the right unit in Grafana (for example `bytes(IEC)` or `percentunit` for a 0 to 1 ratio) lets Grafana pick sensible scales automatically.'},
{h:'Thresholds'},
{p:'Thresholds colour values and can draw lines on a graph. They are a list of steps: a base colour and values where the colour changes.'},
{t:[['Step','Value','Colour'],
['Base','(none)','Green'],
['Step 1','70','Orange'],
['Step 2','90','Red']]},
{h:'Value mappings'},
{p:'Map raw values to text and colours. For example `1` becomes **UP** in green, `0` becomes **DOWN** in red.'},
{h:'Transformations'},
{t:[['Transformation','Does'],
['**Reduce**','Turn each series into one row (Last, Max, Mean)'],
['**Merge** / **Join by field**','Combine results of several queries into one table'],
['**Organize fields**','Rename, reorder, hide columns'],
['**Filter data by values**','Keep only rows that match'],
['**Group by**','Aggregate in the front end'],
['**Add field from calculation**','New column, for example used / total'],
['**Labels to fields**','Turn labels into columns']]},
{p:'A common table: run one **Instant** query per metric (CPU, memory, disk), then **Join by field** on `instance`, then **Organize fields** to rename columns and set units per column.'},
{h:'Overrides'},
{p:'An override targets a series, a field name, a regex or a field type, and then sets any option for just those. Typical uses: a different unit for one column, a right-hand axis for one line, a fixed colour for the error series.'},
{flow:['Add field override','Choose what it matches: name, regex, type or query','Add one or more properties: unit, colour, axis, hidden','Save: only matching fields change']},
{note:'Do work in PromQL when it affects **correctness** (rates, ratios). Do it in transformations for **presentation** (renaming, joining, formatting).'}],
src:[['Transformations',G+'panels-visualizations/query-transform-data/transform-data/'],['Standard options',G+'panels-visualizations/configure-standard-options/'],['Overrides',G+'panels-visualizations/configure-overrides/']]};

/* ---------- 5: Variables ---------- */
L['prom:6:5']={blocks:[
{p:'**Variables** turn a dashboard into a template. Instead of one dashboard per server or environment you have one dashboard with drop-downs. This is the most important feature for keeping dashboards manageable.'},
{svg:varflow},
{h:'Variable types'},
{t:[['Type','Values come from','Use'],
['**Query**','A data source query','Hosts, jobs, namespaces'],
['**Custom**','A list you type','Fixed choices like 5m, 1h'],
['**Interval**','Preset time spans','Aggregation window'],
['**Data source**','Installed sources of a type','Switch Prometheus instances'],
['**Constant**','A hidden value','Shared settings'],
['**Text box**','Free text','Search strings'],
['**Ad hoc filters**','Any label of a data source','Add filters on the fly']]},
{h:'A query variable for Prometheus'},
{code:`# Variable: job
label_values(up, job)

# Variable: instance, chained to the selected job
label_values(up{job="$job"}, instance)`},
{h:'Using a variable in panels'},
{code:`rate(node_cpu_seconds_total{mode="idle", instance=~"$instance"}[$__rate_interval])

# use \${var} form to place a variable next to text
node_filesystem_avail_bytes{mountpoint="\${mount}"}`},
{ul:['For **multi-value** and **Include All** variables, always use the **regex matcher** `=~` so the panel works with one, several or all selections.','Grafana turns multi-value into a regex like `(web1|web2)` for Prometheus automatically.','Variables can be chained: the second list depends on the first.']},
{h:'Repeating panels and rows'},
{p:'In a panel or row, set **Repeat by variable**. Grafana creates one copy for each selected value. Use it for a small set of important items (a few databases), not for hundreds.'},
{h:'Useful built-in variables'},
{t:[['Variable','Meaning'],
['`$__interval`','Auto step for this panel width and range'],
['`$__rate_interval`','Safe window for `rate()`'],
['`$__range`','Duration of the whole time range'],
['`$__dashboard`','Dashboard name'],
['`$__user.login`','Current user']]},
{h:'Design tips'},
{ul:['Order variables left to right from broad (environment) to narrow (instance).','Set a sensible default, and use **Include All** only when it makes sense.','Keep variable queries cheap; they run whenever the dashboard loads.']},
{note:'If a panel shows **No data** after you pick "All", check that the matcher uses `=~` and not `=`.'}],
src:[['Variables',G+'dashboards/variables/'],['Prometheus template variables',G+'datasources/prometheus/template-variables/']]};

/* ---------- 6: Organising ---------- */
L['prom:6:6']={blocks:[
{p:'Once there are dozens of dashboards and many people, structure and access matter as much as the graphs. Grafana offers folders, permissions, teams and annotations for this.'},
{h:'The model'},
{t:[['Concept','What it is'],
['**Organisation**','A fully separate workspace with its own dashboards, data sources and users'],
['**User**','A person who signs in'],
['**Team**','A group of users, used to assign permissions once'],
['**Role**','Viewer, Editor or Admin at organisation level'],
['**Folder**','Container for dashboards, alert rules and its own permissions']]},
{h:'Roles in an organisation'},
{t:[['Role','Can'],
['**Viewer**','View dashboards and use Explore (if enabled), cannot save'],
['**Editor**','Create and edit dashboards and folders'],
['**Admin**','Plus manage users, data sources, teams and settings']]},
{h:'Folders and permissions'},
{flow:['Create a folder per team or system','Move related dashboards into it','Set folder permissions for teams (View, Edit, Admin)','Dashboards inherit folder permissions unless overridden']},
{p:'Grant access to **teams**, not individuals, so people joining or leaving only needs one change.'},
{h:'Annotations'},
{p:'**Annotations** mark moments on graphs: deployments, incidents, config changes. They answer "what changed?" when a line jumps.'},
{t:[['Kind','How'],
['**Manual**','Ctrl or Cmd click on a graph, add text and tags'],
['**Query-based**','A dashboard annotation query, for example a metric that changes at deploy time or alert state changes'],
['**API**','Your CI pipeline posts an annotation at each deployment']]},
{code:`# post an annotation from a deployment job
curl -X POST http://grafana:3000/api/annotations \\
  -H "Authorization: Bearer $GRAFANA_TOKEN" -H "Content-Type: application/json" \\
  -d '{"text":"Deployed v1.8.2","tags":["deploy","shop"]}'`},
{h:'Housekeeping features'},
{ul:['**Tags** and **search** to find dashboards; **Star** your favourites.','**Dashboard links** to jump between related dashboards while keeping variables and time range.','**Version history** to compare and restore earlier versions of a dashboard.','**Playlists** to rotate dashboards on a wall display.','**Service accounts** with tokens for automation instead of personal API keys.']},
{note:'Treat changes to shared dashboards carefully: save with a message, and prefer **provisioning** from Git (Section 8) for anything important.'}],
src:[['Dashboards: folders',G+'dashboards/manage-dashboards/'],['Permissions',G+'administration/roles-and-permissions/'],['Annotations',G+'dashboards/build-dashboards/annotate-visualizations/']]};
})();
