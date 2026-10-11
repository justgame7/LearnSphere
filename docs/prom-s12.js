/* LearnSphere - Prometheus & Grafana, Section 12: Production Operations & Scale.
   Lectures 0-5 are core; additional lectures (not written yet) follow. Needs prom-common.js. */
(function(){
const K=window.PM,L=window.LESSONS,PP=K.PP,PA=K.PA;

/* ---------- diagrams ---------- */
const ha=K.dg(700,260,[
[10,10,680,240,'Highly available pair',1],
[30,60,140,60,'Targets|same list|for both',0],[240,40,150,50,'Prometheus A|replica="a"',2],[240,130,150,50,'Prometheus B|replica="b"',2],
[470,60,130,50,'Alertmanager|cluster of 2 or 3',0],[470,150,130,50,'Grafana|queries A or B',0],[620,60,60,50,'Notify',0]],
[[170,80,240,65],[170,100,240,155],[390,65,470,80],[390,155,470,95],[390,160,470,175],[600,85,620,85]]);

const lt=K.dg(700,220,[
[10,10,680,200,'Long-term storage via remote write',1],
[30,60,140,60,'Prometheus|short retention|15 days',2],[230,60,150,60,'remote_write|queue, retry,|relabel',0],[440,40,230,100,'Long-term backend|Thanos, Mimir, VictoriaMetrics|object storage, years of data',2],[440,155,230,45,'Grafana queries it with PromQL',0]],
[[170,90,230,90],[380,90,440,90],[555,140,555,155]]);

const fed=K.dg(700,200,[
[10,10,680,180,'Hierarchical federation',1],
[30,50,130,50,'Prometheus|cluster A',0],[30,120,130,50,'Prometheus|cluster B',0],[270,85,150,60,'Global Prometheus|scrapes /federate|aggregates only',2],[520,85,150,60,'Grafana|global view',0]],
[[160,75,270,105],[160,145,270,125],[420,115,520,115]]);

/* ---------- 0: High availability ---------- */
L['prom:11:0']={blocks:[
{p:'A single Prometheus is a single point of failure: if it stops, you lose scraping, rule evaluation and alerts. The standard answer is simple: run **two identical servers** that scrape the same targets, and let Alertmanager deduplicate.'},
{svg:ha},
{h:'The pattern'},
{flow:['Run two Prometheus servers with identical configuration','Give each a different external label, such as replica: a and replica: b','Both scrape all targets and evaluate all rules independently','Both send alerts to the same Alertmanager cluster','Alertmanager deduplicates identical alerts into one notification']},
{code:`# prometheus-a: prometheus.yml
global:
  external_labels:
    cluster: prod
    replica: a        # b on the other server`},
{h:'What is and is not highly available'},
{t:[['Part','HA approach'],
['**Scraping and rules**','Two replicas, same config'],
['**Alert notification**','Alertmanager cluster of 2 or 3 (gossip), all Prometheus servers send to every instance'],
['**Dashboards**','Grafana in front of one replica or a query layer; use a stable data source URL'],
['**Data**','Not replicated: each replica has its own slightly different copy']]},
{h:'Be clear about the limits'},
{ul:['The two replicas have **small differences** (scrape times differ by milliseconds). They are not identical copies.','If one is down for a while, it has a **gap** in its data, and a dashboard pointed at it shows the gap.','A load balancer in front of both can show different values on each refresh.','Real deduplicated views need a query layer such as **Thanos Query** or **Mimir**, which merges replicas using the `replica` label.']},
{h:'Alertmanager clustering'},
{code:`alertmanager --config.file=alertmanager.yml \\
  --cluster.listen-address=0.0.0.0:9094 \\
  --cluster.peer=alertmanager-1:9094`},
{p:'Point Prometheus at **every** Alertmanager. Do not put a load balancer in front. Gossip shares notification and silence state between instances.'},
{note:'HA for Prometheus protects **availability of alerting**, not durability of history. For history, see remote write and long-term storage next.'}],
src:[['Alertmanager high availability',PA+'alertmanager/#high-availability'],['Prometheus FAQ: HA',K.PI+'faq/']]};

/* ---------- 1: Long-term storage ---------- */
L['prom:11:1']={blocks:[
{p:'Local TSDB storage is great for weeks of detail but is single-node and not replicated. For a year of history, for global queries across clusters, or for durability, you send data to a **remote storage system** with **remote write**.'},
{svg:lt},
{h:'Remote write'},
{code:`remote_write:
  - url: https://mimir.example.com/api/v1/push
    basic_auth:
      username: tenant1
      password_file: /etc/prometheus/remote-password
    queue_config:
      max_samples_per_send: 2000
      capacity: 10000
    write_relabel_configs:
      - source_labels: [__name__]
        regex: "go_.*|debug_.*"
        action: drop`},
{ul:['Prometheus reads from its WAL and **streams** samples to the remote endpoint with retries and a queue.','`write_relabel_configs` choose what leaves the server, saving cost.','Monitor `prometheus_remote_storage_samples_pending` and `..._failed_total`.']},
{h:'Choices'},
{t:[['Solution','Idea','Good for'],
['**Thanos**','Sidecar or receiver ships blocks to object storage; global query, downsampling, compaction','Keep Prometheus servers as they are and add a global view'],
['**Grafana Mimir** / Cortex','Horizontally scalable, multi-tenant, remote write target','Large central metrics platform'],
['**VictoriaMetrics**','Single binary or cluster, efficient storage, Prometheus compatible','Cost-efficient long retention'],
['**Managed services**','Amazon Managed Prometheus, Grafana Cloud, Google, Azure','Avoid running the backend yourself']]},
{h:'Thanos at a glance'},
{t:[['Component','Job'],
['**Sidecar**','Uploads Prometheus blocks to object storage, serves recent data'],
['**Store Gateway**','Serves historical blocks from object storage'],
['**Querier**','Single PromQL endpoint across everything; deduplicates replicas'],
['**Compactor**','Compacts and downsamples old blocks'],
['**Ruler**','Evaluates rules against the global view']]},
{h:'Choosing'},
{flow:['How long must data be kept and for whom?','Is one cluster enough or do you need a global view?','Do you want to operate the backend or buy it?','Pick Thanos to extend existing servers, Mimir or VictoriaMetrics for a central platform','Start by remote writing a subset and measure cost']},
{note:'Keep Prometheus retention short (days to weeks) and use the long-term store for history. Do not rely on a single local disk for anything you need to keep.'}],
src:[['Remote write',PP+'configuration/configuration/#remote_write'],['Thanos','https://thanos.io/'],['Grafana Mimir','https://grafana.com/docs/mimir/latest/']]};

/* ---------- 2: Federation ---------- */
L['prom:11:2']={blocks:[
{p:'**Federation** lets one Prometheus scrape selected series from another through the `/federate` endpoint. It is the original way to build a hierarchy: many local servers, one global server for overview.'},
{svg:fed},
{h:'How it looks'},
{code:`# on the global Prometheus
scrape_configs:
  - job_name: federate
    honor_labels: true
    metrics_path: /federate
    params:
      "match[]":
        - '{__name__=~"job:.*"}'          # only pre-aggregated recording rules
        - 'up{job="node"}'
    static_configs:
      - targets: ["prom-cluster-a:9090", "prom-cluster-b:9090"]`},
{t:[['Setting','Why'],
['`metrics_path: /federate`','The federation endpoint'],
['`params: match[]`','Instant vector selectors that choose what to pull'],
['`honor_labels: true`','Keep the original `job` and `instance` labels']]},
{h:'Good uses'},
{ul:['**Aggregates up:** pull recording-rule results such as `job:http_requests:rate5m` into a global server.','**Cross-service alerting:** one server needs a few series from another.','Hierarchical **cluster to region to global** views with small data volumes.']},
{h:'Limits'},
{t:[['Limitation','Consequence'],
['Pulls at scrape interval and only the **latest** value','Time resolution is lost; delayed data is not corrected'],
['Not meant for **all** series','Large federations are slow and heavy'],
['Staleness handling is weak','Disappearing series linger'],
['Single point at the top','Global server is a bottleneck and needs HA']]},
{h:'Federation vs remote write'},
{t:[['','Federation','Remote write'],
['**Direction**','Global pulls from local','Local pushes to a backend'],
['**Volume**','Small, aggregated','Large, complete'],
['**History**','Only current values','Complete samples'],
['**Typical choice today**','Small hierarchies, aggregated views','Central long-term storage']]},
{note:'Use federation for **aggregates**. If you find yourself federating everything, you want remote write.'}],
src:[['Federation',PP+'federation/'],['Scale and federation',K.PI+'faq/']]};

/* ---------- 3: Capacity planning ---------- */
L['prom:11:3']={blocks:[
{p:'Prometheus capacity is driven by **how many active series** you have and how many samples per second you ingest. Plan from those two numbers, measure your own, and control them at the source.'},
{h:'The numbers that matter'},
{code:`# active series in memory
prometheus_tsdb_head_series

# samples ingested per second
rate(prometheus_tsdb_head_samples_appended_total[5m])

# memory used by the server
process_resident_memory_bytes{job="prometheus"}

# scrape cost per job
sum by (job) (scrape_samples_scraped)
topk(10, count by (__name__) ({__name__=~".+"}))`},
{h:'Rules of thumb (measure your own)'},
{t:[['Resource','Estimate','Driver'],
['**Memory**','Several kilobytes per active series (often 3 to 8 KB with queries and overhead)','Head series count'],
['**Disk**','retention seconds x samples/s x about 1 to 2 bytes','Samples per second and retention'],
['**CPU**','Mostly queries, rule evaluation and compaction','Dashboards, recording rules'],
['**Network**','Scrape size x targets / interval','Targets and series per target']]},
{h:'Example'},
{code:`1,000 targets x 800 series each = 800,000 series
scrape_interval 30s  -> about 26,700 samples/s
memory: 800,000 x 6 KB = about 4.8 GB (plus headroom)
disk (30 d): 2,592,000 s x 26,700 x 1.5 B = about 104 GB`},
{h:'Finding the cost'},
{ul:['**Status, then TSDB Status** page: top metric names and labels by series count.','`promtool tsdb analyze /var/lib/prometheus` for a detailed report.','Per-job `scrape_samples_scraped` and `scrape_series_added`.']},
{h:'Controlling it'},
{flow:['Identify metrics and labels with the highest series count','Fix the source: remove or bound a label','Drop what you do not use with metric_relabel_configs','Increase scrape interval for low-value jobs','Split targets across servers with sharding or functional separation']},
{h:'Protect the server'},
{t:[['Setting','Protects against'],
['`sample_limit`, `label_limit` per job','A target suddenly exposing a huge number of series'],
['`--query.max-samples`','One query loading too many samples'],
['`--query.timeout`, `--query.max-concurrency`','Slow or too many parallel queries'],
['Recording rules for dashboards','Repeated expensive aggregations']]},
{note:'Alert on `prometheus_tsdb_head_series` growth and on memory use before the OOM kill, not after it.'}],
src:[['Storage and sizing',PP+'storage/'],['Operational aspects',PP+'storage/#operational-aspects']]};

/* ---------- 4: Securing the stack ---------- */
L['prom:11:4']={blocks:[
{p:'Out of the box Prometheus and Alertmanager have **no authentication or encryption**. Anyone who can reach port 9090 can read all your metrics and, with some flags, change things. Grafana adds users and roles but still needs hardening.'},
{h:'Layers of protection'},
{t:[['Layer','What to do'],
['**Network**','Do not expose 9090, 9093 or exporters to the internet; use private networks and firewalls or NetworkPolicies'],
['**TLS and auth in front**','Use a reverse proxy, or the built-in web configuration file'],
['**Admin features**','Keep `--web.enable-admin-api` and `--web.enable-lifecycle` off unless needed and the endpoint is protected'],
['**Secrets**','Passwords and tokens in files, not in command lines or labels'],
['**Least privilege**','Read-only exporter accounts, minimal Grafana roles']]},
{h:'Built-in web configuration'},
{code:`# web.yml
tls_server_config:
  cert_file: /etc/prometheus/tls/server.crt
  key_file:  /etc/prometheus/tls/server.key
basic_auth_users:
  admin: $2y$10$...bcrypt-hash...

# start
prometheus --web.config.file=web.yml`},
{p:'The same `--web.config.file` mechanism exists for **Alertmanager**, node_exporter and other exporters built on the shared web library. You can also require **client certificates** (mTLS).'},
{h:'Scraping protected targets'},
{code:`scrape_configs:
  - job_name: secure-app
    scheme: https
    basic_auth:
      username: prometheus
      password_file: /etc/prometheus/app-password
    tls_config:
      ca_file: /etc/prometheus/ca.pem
    static_configs:
      - targets: ["app.internal:8443"]`},
{h:'Securing Grafana'},
{ul:['Serve it over **HTTPS**, behind a proxy or with its own certificate.','Change the default admin password and **disable anonymous access** unless intended.','Use **SSO** (OAuth/OIDC, LDAP, SAML) and map groups to roles and teams.','Restrict **data source** permissions and use read-only database users.','Use **service accounts** with scoped tokens for automation.','Keep Grafana and plugins updated; install only plugins you trust.']},
{h:'Alert and secret hygiene'},
{ul:['Do not put secrets or personal data in labels, they are stored and sent everywhere.','Restrict who can create silences and edit alert routes.','Audit access to dashboards that expose sensitive business data.']},
{note:'Defaults are open for convenience. Treat the whole stack as internal infrastructure that must be authenticated and encrypted before it leaves a lab.'}],
src:[['Securing Prometheus',PP+'../../operating/security/'],['Web configuration','https://prometheus.io/docs/prometheus/latest/configuration/https/'],['Grafana security',K.G+'setup-grafana/configure-security/']]};

/* ---------- 5: Backups, upgrades, migrations ---------- */
L['prom:11:5']={blocks:[
{p:'Monitoring data is often worth keeping and the monitoring system itself must be maintained. This lecture covers how to back up the TSDB, how to upgrade safely and how to move data.'},
{h:'Snapshots'},
{p:'A snapshot is a consistent, hard-linked copy of the TSDB blocks made while the server runs. It needs the admin API.'},
{code:`# start with --web.enable-admin-api
curl -X POST http://localhost:9090/api/v1/admin/tsdb/snapshot
# {"status":"success","data":{"name":"20261011T120000Z-abc123"}}

# the snapshot lives under <data dir>/snapshots/
rsync -a /var/lib/prometheus/snapshots/20261011T120000Z-abc123/ backup-host:/backups/prom/`},
{h:'Restore'},
{flow:['Stop Prometheus','Copy the snapshot contents into an empty data directory','Fix ownership and permissions','Start Prometheus with the same data path','Check /tsdb-status and a few queries']},
{h:'What else to back up'},
{t:[['Item','Method'],
['**Configuration and rules**','Keep in Git; deploy by pipeline'],
['**Alertmanager silences and notification log**','`--storage.path` directory'],
['**Grafana**','Database (`grafana.db` or Postgres dump) plus provisioning files in Git'],
['**Dashboards and data sources**','Provisioned from Git; export JSON as a safety net']]},
{h:'Upgrading'},
{ul:['Read the **release notes** for removed flags, changed defaults and storage notes before every upgrade.','Upgrade one **minor version** at a time and test in a non-production copy first.','Take a **snapshot** before upgrading the server.','Validate configuration with the **new** `promtool` before restarting.','In an HA pair upgrade one replica, check, then the other.']},
{h:'Grafana upgrades'},
{ul:['Back up the Grafana database first, because migrations modify it.','Check plugin compatibility and deprecated features such as old alerting or panels.','Test provisioned dashboards on the new version in staging.']},
{h:'Migrating data'},
{t:[['Need','Approach'],
['Move to a new server of the same version','Copy the data directory or restore a snapshot'],
['Move to a long-term backend','Start remote write; backfill old blocks with the backend tooling'],
['Create data from other sources or rules','`promtool tsdb create-blocks-from openmetrics` and `... rules` for backfilling']]},
{note:'A backup you have never restored is a hope, not a backup. Rehearse the restore at least once.'}],
src:[['Snapshots',PP+'querying/api/#snapshot'],['Backfilling',PP+'storage/#backfilling-from-openmetrics-format'],['Release notes','https://github.com/prometheus/prometheus/releases']]};
})();
