/* LearnSphere - Prometheus & Grafana, Section 02: Prometheus Architecture & Installation.
   Lectures 0-5 are core; additional lectures (not written yet) follow. Needs prom-common.js. */
(function(){
const K=window.PM,L=window.LESSONS,PI=K.PI,PP=K.PP;

/* ---------- diagrams ---------- */
const arch=K.dg(700,330,[
[10,10,680,310,'Prometheus architecture',1],
[30,50,130,50,'Instrumented|applications',0],[30,120,130,50,'Exporters|node, db, ...',0],[30,200,130,50,'Pushgateway|(batch jobs)',0],
[230,60,200,190,'Prometheus server',1],[245,90,170,40,'Retrieval (scrape)',2],[245,140,170,40,'TSDB (storage)',2],[245,190,170,40,'Rules and HTTP API',2],
[520,50,150,50,'Alertmanager',0],[520,125,150,50,'Grafana|and API clients',0],[520,200,150,50,'Service discovery|(file, DNS, k8s)',0]],
[[160,75,245,110],[160,145,245,115],[160,225,245,125],[415,210,520,80],[520,150,415,160],[520,225,415,200]]);

const tsdb=K.dg(700,200,[
[10,10,680,180,'How samples reach the disk',1],
[30,60,130,60,'Scrape|new samples',0],[200,60,130,60,'Head block|in memory',2],[200,135,130,40,'WAL on disk|crash safety',0],[380,60,130,60,'Block|2 hours|immutable',2],[560,60,110,60,'Compacted|larger blocks',0]],
[[160,90,200,90],[265,120,265,135],[330,90,380,90],[510,90,560,90]]);

const nodeFlow=K.dg(700,150,[
[10,10,680,130,'Monitoring a Linux host',1],
[30,55,150,60,'Linux kernel|/proc and /sys',0],[230,55,150,60,'node_exporter|:9100/metrics',2],[430,55,110,60,'Prometheus|:9090',2],[580,55,90,60,'Query and|graph',0]],
[[180,85,230,85],[380,85,430,85],[540,85,580,85]]);

/* ---------- 0: Components ---------- */
L['prom:1:0']={blocks:[
{p:'Prometheus is not one program but a small ecosystem. The **server** is the core; everything else is optional and plugs into it. Knowing what each part does and which way data flows removes most of the confusion later.'},
{svg:arch},
{h:'The components'},
{t:[['Component','Job','Notes'],
['**Prometheus server**','Scrapes targets, stores samples, evaluates rules, serves queries','One binary: retrieval, TSDB, rule manager and HTTP API'],
['**Client libraries**','Let your code expose metrics','Official: Go, Java, Python, Ruby, Rust'],
['**Exporters**','Expose metrics for systems you cannot change','node_exporter, blackbox, database exporters'],
['**Pushgateway**','Holds metrics of short-lived batch jobs','Prometheus scrapes it'],
['**Alertmanager**','Groups, silences and routes alerts','Separate process, separate config'],
['**Service discovery**','Finds targets automatically','Kubernetes, EC2, DNS, files and more']]},
{h:'What the server does internally'},
{ul:['**Retrieval:** schedules scrapes and parses the response.','**TSDB:** the built-in time-series database that stores samples on local disk.','**Rule manager:** evaluates recording and alerting rules on a schedule.','**HTTP API and UI:** serves PromQL queries and the web interface on port 9090.']},
{h:'Data flow'},
{flow:['A target exposes metrics at /metrics over HTTP','Prometheus scrapes it every scrape interval','Samples are written to the TSDB','Rules read the data and create new series or alerts','Alerts go to Alertmanager; queries are answered for Grafana and users']},
{h:'Design choices worth knowing'},
{ul:['**Single server, local storage:** no cluster to run. Each server is autonomous and keeps working when others fail.','**Multi-dimensional data model:** one metric name plus labels (Section 3).','**Pull over HTTP:** targets only need to serve text.','**Not a long-term archive:** local storage is not replicated. Long-term needs remote write (Section 12).']},
{note:'Exam tip: Alertmanager does not evaluate alert rules. Prometheus evaluates them and sends firing alerts to Alertmanager.'}],
src:[['Overview',PI+'overview/'],['Architecture',PI+'overview/#architecture']]};

/* ---------- 1: Installing ---------- */
L['prom:1:1']={blocks:[
{p:'Prometheus ships as a single static binary, so installation is simple. You will meet it as a downloaded binary, an OS package, a container and a Helm chart. The binary and the container are the best ways to learn.'},
{h:'Choose a method'},
{t:[['Method','Best for','Notes'],
['**Binary**','Learning, small servers','Download tar.gz from prometheus.io, run as a systemd service'],
['**Package**','Linux hosts','Distribution packages exist but may be old'],
['**Docker**','Labs and quick tests','Official image `prom/prometheus`'],
['**Helm**','Kubernetes','`kube-prometheus-stack` (Section 11) or the `prometheus` chart']]},
{h:'Quick start with Docker'},
{code:`# prometheus.yml in the current folder
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ["localhost:9090"]`},
{code:`docker run -d --name prometheus -p 9090:9090 \\
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \\
  -v prom-data:/prometheus \\
  prom/prometheus`},
{p:'Open **http://localhost:9090**. The named volume keeps the data when the container is replaced.'},
{h:'Binary on Linux with systemd'},
{code:`# 1. Create a user and folders
sudo useradd --no-create-home --shell /usr/sbin/nologin prometheus
sudo mkdir -p /etc/prometheus /var/lib/prometheus

# 2. Download, unpack and install (replace the version)
tar xzf prometheus-VERSION.linux-amd64.tar.gz
cd prometheus-VERSION.linux-amd64
sudo cp prometheus promtool /usr/local/bin/
sudo cp prometheus.yml /etc/prometheus/
sudo chown -R prometheus: /etc/prometheus /var/lib/prometheus`},
{code:`# /etc/systemd/system/prometheus.service
[Unit]
Description=Prometheus
After=network-online.target

[Service]
User=prometheus
ExecStart=/usr/local/bin/prometheus \\
  --config.file=/etc/prometheus/prometheus.yml \\
  --storage.tsdb.path=/var/lib/prometheus \\
  --storage.tsdb.retention.time=30d \\
  --web.enable-lifecycle
Restart=on-failure

[Install]
WantedBy=multi-user.target`},
{code:`sudo systemctl daemon-reload
sudo systemctl enable --now prometheus
curl -s localhost:9090/-/healthy      # Prometheus Server is Healthy.
curl -s localhost:9090/-/ready        # Prometheus Server is Ready.`},
{h:'Important command-line flags'},
{t:[['Flag','Purpose','Default'],
['`--config.file`','Path to prometheus.yml','prometheus.yml'],
['`--storage.tsdb.path`','Where data lives','data/'],
['`--storage.tsdb.retention.time`','How long to keep data','15d'],
['`--storage.tsdb.retention.size`','Maximum disk for blocks','none'],
['`--web.listen-address`','Address and port','0.0.0.0:9090'],
['`--web.enable-lifecycle`','Allow reload and quit over HTTP','off'],
['`--web.external-url`','Public URL, used in alert links','host and port']]},
{note:'Flags are fixed at start. The configuration file can be reloaded without a restart (next lecture), but changing a flag needs a restart.'}],
src:[['Installation',PP+'installation/'],['Command-line flags',PP+'command-line/prometheus/'],['Downloads','https://prometheus.io/download/']]};

/* ---------- 2: prometheus.yml ---------- */
L['prom:1:2']={blocks:[
{p:'**prometheus.yml** tells the server what to scrape, how often, which rules to load and where to send alerts. It is plain YAML and has only a few top-level keys.'},
{h:'The shape of the file'},
{code:`global:
  scrape_interval: 15s        # how often to scrape (default 1m)
  scrape_timeout: 10s         # per-scrape limit (default 10s)
  evaluation_interval: 15s    # how often rules run (default 1m)
  external_labels:            # added to alerts and remote write
    cluster: prod
    region: eu-west-1

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

scrape_configs:
  - job_name: node
    scrape_interval: 30s     # override the global value
    static_configs:
      - targets: ["web1:9100", "web2:9100"]
        labels:
          env: prod`},
{h:'Top-level keys'},
{t:[['Key','Purpose'],
['`global`','Defaults for scraping, evaluation and external labels'],
['`scrape_configs`','The list of jobs: what to scrape and how'],
['`rule_files`','Recording and alerting rule files (globs allowed)'],
['`alerting`','Where Alertmanagers are, and alert relabeling'],
['`remote_write` / `remote_read`','Send data to or read from long-term storage'],
['`storage`','Settings such as exemplars or TSDB tuning']]},
{h:'Jobs, targets and instances'},
{t:[['Term','Meaning','Example'],
['**Target**','One endpoint that is scraped','web1:9100'],
['**Instance**','A single target; becomes the `instance` label','web1:9100'],
['**Job**','A group of targets with the same purpose','node']]},
{p:'Every scraped series automatically gets the labels `job` and `instance`. Defaults are inherited from `global` unless a job overrides them.'},
{h:'Validate before you reload'},
{code:`promtool check config /etc/prometheus/prometheus.yml
# Checking /etc/prometheus/prometheus.yml
#  SUCCESS: 1 rule files found`},
{h:'Reload without a restart'},
{flow:['Edit prometheus.yml or a rule file','Run promtool check config','Send SIGHUP or POST /-/reload','Prometheus loads the new config','Check /config and /targets in the UI']},
{code:`# Option 1: signal
kill -HUP $(pidof prometheus)

# Option 2: HTTP, needs --web.enable-lifecycle
curl -X POST http://localhost:9090/-/reload`},
{note:'If the new file is invalid, Prometheus keeps the old configuration and logs an error. Check the logs after a reload.'}],
src:[['Configuration',PP+'configuration/configuration/'],['promtool',PP+'command-line/promtool/']]};

/* ---------- 3: First scrape ---------- */
L['prom:1:3']={blocks:[
{p:'With the quick-start configuration running, Prometheus is already scraping **itself**. This lecture walks through confirming that and running your first queries.'},
{h:'Tour of the web UI'},
{t:[['Page','URL path','Use'],
['**Query (graph)**','`/graph`','Run PromQL and graph results'],
['**Alerts**','`/alerts`','See rules and states: inactive, pending, firing'],
['**Targets**','`/targets`','Health of every scrape target'],
['**Service discovery**','`/service-discovery`','Discovered labels before relabeling'],
['**Status**','`/status`, `/config`, `/flags`','Configuration, flags, build info, TSDB stats']]},
{h:'Check the targets page'},
{p:'Open **Status, then Targets**. Each endpoint shows a state **UP** or **DOWN**, the labels, the last scrape time and duration, and an error message if the scrape failed.'},
{h:'Your first queries'},
{code:`up                                     # 1 per healthy target
up{job="prometheus"}                   # filter by label
prometheus_http_requests_total         # a counter, one series per handler and code
rate(prometheus_http_requests_total[5m])   # per-second rate over 5 minutes
prometheus_tsdb_head_series            # active series in memory`},
{p:'Switch between the **Table** tab (latest value) and the **Graph** tab (values over time). Use `up == 0` to find failing targets.'},
{h:'The raw data'},
{code:`curl -s localhost:9090/metrics | head
# HELP prometheus_http_requests_total Counter of HTTP requests.
# TYPE prometheus_http_requests_total counter
prometheus_http_requests_total{code="200",handler="/metrics"} 41`},
{h:'Target states'},
{t:[['State','Meaning','First thing to check'],
['**UP**','Last scrape succeeded','Nothing'],
['**DOWN**','Scrape failed','Error text: connection refused, timeout, 404, parse error'],
['**Unknown**','Not scraped yet','Wait one interval']]},
{flow:['Open /targets','Find the DOWN endpoint and read the error','Open the same URL with curl from the Prometheus host','Fix the network, port or path','Wait one scrape interval and check again']},
{note:'`up` is added by Prometheus itself for every scrape. It is the simplest and most important availability metric you have.'}],
src:[['First steps',PI+'first_steps/'],['Querying basics',K.PQ+'basics/']]};

/* ---------- 4: Storage ---------- */
L['prom:1:4']={blocks:[
{p:'Prometheus stores data in its own **time-series database (TSDB)** on local disk. Understanding the layout explains retention, disk usage and why local storage is not a backup.'},
{svg:tsdb},
{h:'How data is written'},
{ul:['New samples go into the **head block** in memory and are also appended to the **write-ahead log (WAL)** so a crash loses nothing.','Roughly every two hours the head is written to disk as an immutable **block**.','Background **compaction** merges small blocks into larger ones.','Blocks older than the retention limit are deleted.']},
{h:'What is on disk'},
{t:[['Path','Content'],
['`wal/`','Write-ahead log segments for recent data'],
['`chunks_head/`','Memory-mapped head chunks'],
['`01ABC.../`','A block directory named by ULID'],
['`.../chunks/`','Compressed sample data'],
['`.../index`','Label and series index'],
['`.../meta.json`','Time range and compaction info'],
['`.../tombstones`','Deleted series markers']]},
{h:'Retention'},
{t:[['Flag','Meaning'],
['`--storage.tsdb.retention.time=15d`','Delete blocks older than this (default 15d)'],
['`--storage.tsdb.retention.size=100GB`','Delete oldest blocks when total size exceeds this']]},
{p:'If both are set, whichever limit is hit first applies. Retention removes whole blocks, so usage can be slightly above the limit.'},
{h:'Sizing the disk'},
{code:`needed_disk_space = retention_seconds
                  * ingested_samples_per_second
                  * bytes_per_sample        # about 1 to 2 bytes`},
{code:`# Real values from your own server
rate(prometheus_tsdb_head_samples_appended_total[1h])   # samples per second
prometheus_tsdb_head_series                              # active series`},
{p:'Example: 100,000 series scraped every 15 s is about 6,700 samples/s. Over 15 days (1.3 million seconds) at 2 bytes that is about 17 GB, plus headroom for compaction.'},
{h:'Good storage practice'},
{ul:['Use a fast **local** disk (SSD). Do not use NFS or network filesystems for the TSDB.','Leave around 20% free for compaction.','Local storage is **not replicated**. Run two servers or use remote write for durability.','Take snapshots for backups (Section 12).']},
{note:'Memory also matters: every active series costs several kilobytes of RAM. Cardinality control (Section 3 and 12) matters more than disk size.'}],
src:[['Storage',PP+'storage/'],['TSDB format','https://github.com/prometheus/prometheus/blob/main/tsdb/docs/format/README.md']]};

/* ---------- 5: node_exporter ---------- */
L['prom:1:5']={blocks:[
{p:'The most common first real target is a Linux host. **node_exporter** reads kernel statistics and serves them as metrics. In this practical you install it, scrape it and see CPU, memory and disk data.'},
{svg:nodeFlow},
{h:'Step 1: install and run node_exporter'},
{code:`# download the Linux tarball from prometheus.io/download, then:
tar xzf node_exporter-VERSION.linux-amd64.tar.gz
sudo cp node_exporter-VERSION.linux-amd64/node_exporter /usr/local/bin/
sudo useradd --no-create-home --shell /usr/sbin/nologin node_exporter

# quick test in the foreground
node_exporter &
curl -s localhost:9100/metrics | grep node_load`},
{code:`# /etc/systemd/system/node_exporter.service
[Unit]
Description=Node Exporter
After=network-online.target

[Service]
User=node_exporter
ExecStart=/usr/local/bin/node_exporter
Restart=on-failure

[Install]
WantedBy=multi-user.target`},
{h:'Step 2: add a scrape job'},
{code:`scrape_configs:
  - job_name: node
    static_configs:
      - targets: ["localhost:9100"]
        labels:
          env: lab`},
{p:'Validate and reload, then open `/targets`: the **node** job should be UP.'},
{h:'Step 3: ask useful questions'},
{t:[['Question','PromQL'],
['Is the host up?','`up{job="node"}`'],
['Memory available (bytes)','`node_memory_MemAvailable_bytes`'],
['Memory used percentage','`100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)`'],
['CPU busy percentage','`100 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100`'],
['Root disk used percentage','`100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})`'],
['Network received (bytes/s)','`rate(node_network_receive_bytes_total[5m])`'],
['1-minute load average','`node_load1`']]},
{h:'Reading the CPU metric'},
{p:'`node_cpu_seconds_total` is a **counter** with one series per CPU and mode (user, system, idle, iowait ...). Taking `rate()` of the idle mode gives the fraction of time each CPU was idle; averaging and subtracting from 100 gives busy percentage. Section 5 explains `rate()` and `avg by` fully.'},
{note:'In a real environment you would install node_exporter on every host with configuration management, and let service discovery add them (Section 4).'}],
src:[['Monitoring Linux host metrics with node_exporter',PI+'first_steps/'],['node_exporter on GitHub','https://github.com/prometheus/node_exporter']]};
})();
