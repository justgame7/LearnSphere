/* LearnSphere - Prometheus & Grafana, Section 04: Exporters & Service Discovery.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs prom-common.js. */
(function(){
const K=window.PM,L=window.LESSONS,PI=K.PI,PP=K.PP,PX=K.PX;

/* ---------- diagrams ---------- */
const expo=K.dg(700,170,[
[10,10,680,150,'An exporter sits between the system and Prometheus',1],
[30,55,150,60,'The system|database, device,|service',0],[240,55,170,60,'Exporter|speaks its native API,|serves /metrics',2],[470,55,100,60,'Prometheus|scrapes',2],[600,55,70,60,'Alerts and|dashboards',0]],
[[180,85,240,85],[410,85,470,85],[570,85,600,85]]);

const probe=K.dg(700,200,[
[10,10,680,180,'Blackbox probing: Prometheus asks the exporter to test a target',1],
[30,70,110,60,'Prometheus',2],[220,70,140,60,'blackbox_exporter|:9115/probe',2],[450,40,200,45,'https://shop.example.com',0],[450,115,200,45,'db.example.com:5432 (TCP)',0]],
[[140,100,220,100],[360,85,450,62],[360,115,450,135]]);

const reflow=K.dg(700,180,[
[10,10,680,160,'From discovery to stored series',1],
[30,60,110,60,'Service|discovery|meta labels',0],[170,60,110,60,'relabel_configs|choose and shape|targets',2],[310,60,100,60,'Scrape|HTTP GET',0],[440,60,120,60,'metric_relabel_|configs|filter samples',2],[590,60,80,60,'TSDB',0]],
[[140,90,170,90],[280,90,310,90],[410,90,440,90],[560,90,590,90]]);

/* ---------- 0: Exporters ---------- */
L['prom:3:0']={blocks:[
{p:'An **exporter** is a small program that collects data from a system that does not speak Prometheus, and serves it on /metrics. Hundreds exist, so the skill is knowing where to look and how to judge what you find.'},
{svg:expo},
{h:'Three families'},
{t:[['Family','Examples','Notes'],
['**Official**','node_exporter, blackbox_exporter, snmp_exporter, mysqld_exporter, memcached, haproxy, statsd, graphite','Maintained under the Prometheus organisation'],
['**Community**','postgres_exporter, redis_exporter, mongodb_exporter, kafka_exporter, nginx and many more','Widely used, quality varies'],
['**Custom**','Your own script or small service','For internal systems and business metrics']]},
{h:'Where to find them'},
{ul:['The **Exporters and integrations** page on prometheus.io lists them by category.','The `prometheus-community` GitHub organisation and Helm charts.','Many applications now serve /metrics natively (Kubernetes, etcd, Grafana, Traefik, Envoy). Check before adding an exporter.']},
{h:'Judging an exporter'},
{t:[['Check','Why'],
['Actively maintained, recent releases','Targets change; old exporters break'],
['Follows naming conventions and base units','Dashboards and rules stay consistent'],
['Exposes a health metric such as `*_up`','You can alert when it cannot reach the system'],
['Bounded cardinality','No label per row, user or query text'],
['Minimal privileges (read-only account)','It runs with credentials for your database'],
['Documented collectors you can switch off','Control cost and noise']]},
{h:'Where exporters run'},
{ul:['**On the same host** as the system (node_exporter, a local database exporter): simple and fast.','**As a sidecar** next to a container in the same pod.','**Remote/central** for things you cannot install on (SNMP devices, cloud APIs, blackbox probes).']},
{h:'A tiny custom exporter'},
{code:`# pip install prometheus-client
import time
from prometheus_client import Gauge, start_http_server

QUEUE = Gauge("orders_pending", "Orders waiting for fulfilment")

def read_pending():
    return 42            # replace with a real query or API call

if __name__ == "__main__":
    start_http_server(9877)
    while True:
        QUEUE.set(read_pending())
        time.sleep(15)`},
{note:'Prefer instrumenting your own code directly. Write an exporter only for something you cannot modify, and keep it stateless: collect at scrape time and return current values.'}],
src:[['Exporters and integrations',PX+'exporters/'],['Writing exporters',PX+'writing_exporters/'],['Default port allocations','https://github.com/prometheus/prometheus/wiki/Default-port-allocations']]};

/* ---------- 1: node_exporter and cAdvisor ---------- */
L['prom:3:1']={blocks:[
{p:'Two exporters cover almost every infrastructure: **node_exporter** for the host and **cAdvisor** for containers. Together they answer "how busy is the machine?" and "which container is using it?".'},
{h:'node_exporter collectors'},
{t:[['Collector','Typical metrics','Default'],
['`cpu`','`node_cpu_seconds_total`','on'],
['`meminfo`','`node_memory_MemAvailable_bytes`','on'],
['`filesystem`','`node_filesystem_avail_bytes`, `_size_bytes`','on'],
['`diskstats`','`node_disk_io_time_seconds_total`','on'],
['`netdev`','`node_network_receive_bytes_total`','on'],
['`loadavg`','`node_load1`, `node_load5`','on'],
['`systemd`','`node_systemd_unit_state`','off'],
['`processes`','`node_procs_running`','off'],
['`textfile`','Metrics from files you write','on, needs a directory']]},
{h:'Turning collectors on and off'},
{code:`node_exporter \\
  --collector.systemd \\
  --collector.systemd.unit-include="(sshd|nginx).service" \\
  --no-collector.wifi \\
  --collector.filesystem.mount-points-exclude="^/(sys|proc|dev|run)(/|$)"`},
{p:'Use `--collector.disable-defaults` followed by explicit `--collector.<name>` flags when you want only a small set.'},
{h:'Host queries you will reuse'},
{code:`# CPU busy %
100 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100

# Memory used %
100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)

# Disk space used % per mount
100 * (1 - node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"}
         / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"})

# Disk will fill within 24 hours (linear prediction)
predict_linear(node_filesystem_avail_bytes[6h], 24*3600) < 0`},
{h:'cAdvisor for containers'},
{p:'**cAdvisor** reads cgroups and the container runtime to report CPU, memory, network and filesystem use **per container**. It is built into the kubelet on Kubernetes, and runs as a container itself on plain Docker hosts.'},
{code:`docker run -d --name cadvisor -p 8080:8080 \\
  -v /:/rootfs:ro -v /var/run:/var/run:ro \\
  -v /sys:/sys:ro -v /var/lib/docker/:/var/lib/docker:ro \\
  gcr.io/cadvisor/cadvisor`},
{t:[['Metric','Meaning'],
['`container_cpu_usage_seconds_total`','CPU seconds used (counter): take `rate()`'],
['`container_memory_working_set_bytes`','Memory the OOM killer cares about'],
['`container_network_receive_bytes_total`','Network bytes in (counter)'],
['`container_fs_usage_bytes`','Filesystem use of the container'],
['`container_last_seen`','Used to detect a vanished container']]},
{code:`# CPU cores used per container
sum by (name) (rate(container_cpu_usage_seconds_total{name!=""}[5m]))`},
{note:'Use the working set, not `container_memory_usage_bytes`, to judge memory pressure: the latter includes reclaimable cache.'}],
src:[['node_exporter','https://github.com/prometheus/node_exporter'],['cAdvisor','https://github.com/google/cadvisor'],['Host monitoring guide',PI+'first_steps/']]};

/* ---------- 2: Blackbox ---------- */
L['prom:3:2']={blocks:[
{p:'Internal metrics tell you what a system believes. The **blackbox exporter** tests what a user would actually experience: can I reach this URL, does the port accept connections, does the certificate expire soon. It probes from outside.'},
{svg:probe},
{h:'How it works'},
{p:'The exporter is **one service that can probe many targets**. Prometheus calls `/probe?target=...&module=...` and the exporter performs the test and returns the result as metrics.'},
{h:'Modules in blackbox.yml'},
{code:`modules:
  http_2xx:
    prober: http
    timeout: 5s
    http:
      valid_status_codes: []        # default 2xx
      preferred_ip_protocol: ip4
  tcp_connect:
    prober: tcp
  icmp:
    prober: icmp
  dns_example:
    prober: dns
    dns:
      query_name: example.com
      query_type: A`},
{h:'Scrape config with relabeling'},
{p:'The target list holds the **URLs to test**. Relabeling moves each URL into the `target` parameter and points the scrape at the exporter.'},
{code:`scrape_configs:
  - job_name: blackbox_http
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - https://example.com
          - https://example.com/health
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115`},
{h:'Key metrics'},
{t:[['Metric','Meaning'],
['`probe_success`','1 if the probe passed, 0 if not'],
['`probe_duration_seconds`','Total probe time'],
['`probe_http_status_code`','HTTP status returned'],
['`probe_http_ssl`','1 if the connection used TLS'],
['`probe_ssl_earliest_cert_expiry`','Unix time when the earliest certificate expires'],
['`probe_dns_lookup_time_seconds`','Time spent resolving']]},
{code:`# Days until the certificate expires
(probe_ssl_earliest_cert_expiry - time()) / 86400

# Sites that are failing
probe_success == 0`},
{h:'Limits to remember'},
{ul:['Probes run from where the exporter runs; run it in several places for a user-like view.','A passing probe shows availability from one vantage point, not full correctness.','ICMP probes need extra privileges or capabilities.']},
{note:'Black-box checks are good symptom alerts: "the checkout page returns an error" is something users feel, regardless of cause.'}],
src:[['blackbox_exporter','https://github.com/prometheus/blackbox_exporter'],['Blackbox configuration','https://github.com/prometheus/blackbox_exporter/blob/master/CONFIGURATION.md']]};

/* ---------- 3: Database exporters ---------- */
L['prom:3:3']={blocks:[
{p:'Databases are monitored with an exporter that connects like a client, runs read-only statistics queries and publishes the results. The rules are the same for all: **least privilege**, a dedicated account, and watch a few key metrics rather than hundreds.'},
{h:'Setup at a glance'},
{t:[['Database','Exporter','Port','Account'],
['**PostgreSQL**','`postgres_exporter`','9187','Role with `pg_monitor`'],
['**MySQL / MariaDB**','`mysqld_exporter`','9104','`PROCESS`, `REPLICATION CLIENT`, `SELECT` on performance_schema'],
['**Redis**','`redis_exporter`','9121','Password or ACL user with read-only commands']]},
{h:'PostgreSQL'},
{code:`-- in psql
CREATE USER prometheus WITH PASSWORD 'change-me';
GRANT pg_monitor TO prometheus;`},
{code:`export DATA_SOURCE_NAME="postgresql://prometheus:change-me@localhost:5432/postgres?sslmode=disable"
postgres_exporter`},
{h:'MySQL'},
{code:`CREATE USER 'exporter'@'localhost' IDENTIFIED BY 'change-me' WITH MAX_USER_CONNECTIONS 3;
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'localhost';`},
{code:`# ~/.my.cnf used by mysqld_exporter
[client]
user=exporter
password=change-me`},
{h:'Redis'},
{code:`redis_exporter --redis.addr=redis://localhost:6379`},
{h:'The few metrics that matter'},
{t:[['Area','PostgreSQL','MySQL','Redis'],
['**Is it up?**','`pg_up`','`mysql_up`','`redis_up`'],
['**Connections**','`pg_stat_database_numbackends`','`mysql_global_status_threads_connected`','`redis_connected_clients`'],
['**Throughput**','`pg_stat_database_xact_commit`','`mysql_global_status_queries`','`redis_commands_processed_total`'],
['**Memory**','`pg_settings_shared_buffers_bytes`','InnoDB buffer pool metrics','`redis_memory_used_bytes`'],
['**Cache efficiency**','Buffer hit ratio from `blks_hit` and `blks_read`','Buffer pool reads and requests','`redis_keyspace_hits_total` and `_misses_total`'],
['**Replication**','`pg_replication_lag_seconds`','`mysql_slave_status_seconds_behind_master`','`redis_connected_slaves`']]},
{code:`# Redis hit ratio
rate(redis_keyspace_hits_total[5m])
/ (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))`},
{h:'Safe practice'},
{ul:['Never reuse an application or admin account.','Keep credentials in environment variables or secret files, not on the command line.','Use TLS between exporter and database when it is not on the same host.','Limit custom queries; each scrape runs them.']},
{note:'In the exam you may be asked **why** a dedicated read-only user is used. The answer: the exporter only needs to read statistics, and a leaked credential should do little harm.'}],
src:[['postgres_exporter','https://github.com/prometheus-community/postgres_exporter'],['mysqld_exporter','https://github.com/prometheus/mysqld_exporter'],['redis_exporter','https://github.com/oliver006/redis_exporter']]};

/* ---------- 4: Textfile and Pushgateway ---------- */
L['prom:3:4']={blocks:[
{p:'Sometimes the thing you want to measure is a **script or a job**, not a running service. Two tools cover this: the textfile collector for jobs on a host, and the Pushgateway for jobs that run elsewhere.'},
{h:'Textfile collector'},
{p:'node_exporter reads every `*.prom` file in a directory and includes its content in its own /metrics output. Any script can therefore publish metrics by writing a file.'},
{flow:['Cron job runs a backup script','Script writes metrics to a temporary file','Script renames it to backup.prom (atomic)','node_exporter serves it on the next scrape']},
{code:`# node_exporter --collector.textfile.directory=/var/lib/node_exporter/textfile
#!/bin/sh
OUT=/var/lib/node_exporter/textfile/backup.prom
TMP=\${OUT}.$$
echo "# TYPE backup_last_success_timestamp_seconds gauge" > "$TMP"
echo "backup_last_success_timestamp_seconds $(date +%s)" >> "$TMP"
mv "$TMP" "$OUT"            # atomic: never a half-written file`},
{code:`# Alert if no successful backup for 26 hours
time() - backup_last_success_timestamp_seconds > 26 * 3600`},
{h:'Pushgateway'},
{p:'The Pushgateway accepts metrics over HTTP from jobs and **holds the last pushed values**, which Prometheus scrapes like any target.'},
{code:`# push from a batch job
cat <<EOF | curl --data-binary @- http://pushgateway:9091/metrics/job/nightly_etl/instance/db1
# TYPE etl_last_success_timestamp_seconds gauge
etl_last_success_timestamp_seconds $(date +%s)
# TYPE etl_rows_processed gauge
etl_rows_processed 120345
EOF

# delete a group when the job is retired
curl -X DELETE http://pushgateway:9091/metrics/job/nightly_etl/instance/db1`},
{code:`scrape_configs:
  - job_name: pushgateway
    honor_labels: true          # keep job and instance set by the pusher
    static_configs:
      - targets: ["pushgateway:9091"]`},
{h:'When to use which'},
{t:[['','Textfile collector','Pushgateway'],
['**Where the job runs**','On the monitored host','Anywhere that can reach the gateway'],
['**Freshness**','Old file stays until overwritten','Last value stays until deleted'],
['**Extra component**','None (uses node_exporter)','Yes, one more service'],
['**Typical use**','Cron jobs, one-off host facts','Short-lived service-level batch jobs']]},
{h:'Pushgateway pitfalls'},
{ul:['**No automatic expiry:** metrics stay forever, so a dead job still looks fine. Always push a last-success **timestamp** and alert on its age.','**`up` is for the gateway, not the job.** You lose per-job health.','It is a single point of failure and a bottleneck if used for many instances.','Do not use it for services that run continuously; make them scrapeable instead.']},
{note:'Exam tip: the Pushgateway is for **service-level batch jobs**, not for converting Prometheus to push.'}],
src:[['Pushgateway','https://github.com/prometheus/pushgateway'],['When to use the Pushgateway',K.PG+'pushing/'],['Textfile collector','https://github.com/prometheus/node_exporter#textfile-collector']]};

/* ---------- 5: Service discovery ---------- */
L['prom:3:5']={blocks:[
{p:'Static target lists are fine for a lab and painful in production, where servers and containers appear and disappear. **Service discovery (SD)** lets Prometheus ask a platform what exists and update targets automatically.'},
{h:'Discovery mechanisms'},
{t:[['Mechanism','Source of targets','When to use'],
['**static_configs**','A fixed list in prometheus.yml','Few, stable targets'],
['**file_sd_configs**','JSON or YAML files you or a tool generate','Custom inventory, config management output'],
['**dns_sd_configs**','DNS A, AAAA or SRV records','Services registered in DNS'],
['**ec2_sd_configs**','AWS API (also azure, gce, openstack)','Cloud virtual machines'],
['**kubernetes_sd_configs**','Kubernetes API','Pods, services, nodes, endpoints'],
['**consul_sd_configs**','Consul catalog','Consul-based environments']]},
{h:'file_sd: the universal glue'},
{code:`# prometheus.yml
scrape_configs:
  - job_name: web
    file_sd_configs:
      - files: ["/etc/prometheus/targets/web-*.yml"]
        refresh_interval: 1m`},
{code:`# /etc/prometheus/targets/web-prod.yml
- targets: ["web1:9100", "web2:9100"]
  labels:
    env: prod
    team: shop`},
{p:'Prometheus watches the files. Update the file from any script and no reload is needed.'},
{h:'EC2 example'},
{code:`scrape_configs:
  - job_name: ec2-nodes
    ec2_sd_configs:
      - region: eu-west-1
        port: 9100
        filters:
          - name: tag:monitoring
            values: ["enabled"]
    relabel_configs:
      - source_labels: [__meta_ec2_tag_Name]
        target_label: instance_name
      - source_labels: [__meta_ec2_availability_zone]
        target_label: az`},
{h:'Kubernetes roles'},
{t:[['Role','Discovers','Typical use'],
['`node`','One target per node','kubelet and node metrics'],
['`pod`','Each pod and container port','Annotated application pods'],
['`service`','Each service port','Black-box probing of services'],
['`endpoints` / `endpointslice`','Backing pods of a service','Application metrics via services'],
['`ingress`','Each ingress path','Probing public URLs']]},
{h:'Meta labels'},
{p:'Every mechanism attaches **meta labels** beginning with `__meta_` that describe the discovered object. You see them on the **Service Discovery** page and use them in relabeling to build your final labels or to filter targets.'},
{flow:['Prometheus asks the platform API what exists','Each result becomes a target with __meta_* labels','relabel_configs choose and reshape targets','Final targets are scraped on the schedule']},
{note:'Open /service-discovery whenever targets do not look as expected: it shows the labels before and after relabeling, and why a target was dropped.'}],
src:[['Configuration: scrape_config',PP+'configuration/configuration/#scrape_config'],['Kubernetes SD',PP+'configuration/configuration/#kubernetes_sd_config'],['file_sd',PP+'configuration/configuration/#file_sd_config']]};

/* ---------- 6: Relabeling ---------- */
L['prom:3:6']={blocks:[
{p:'**Relabeling** rewrites the label set of a target or a sample using rules. It is how you choose which discovered targets to scrape, give them clean labels, and discard data you do not want. It looks complex, but it is one small idea applied in two places.'},
{svg:reflow},
{h:'Two places, two jobs'},
{t:[['Setting','Runs','Acts on','Use for'],
['`relabel_configs`','Before the scrape','The target and its meta labels','Pick targets, set address, path, scheme and labels'],
['`metric_relabel_configs`','After the scrape','Each returned series','Drop metrics, drop labels, rename'],
['`alert_relabel_configs`','Before sending alerts','Alerts','Remove or add alert labels'],
['`write_relabel_configs`','Before remote write','Samples','Control what leaves the server']]},
{h:'The anatomy of one rule'},
{code:`- source_labels: [__meta_kubernetes_pod_label_app]   # input label(s)
  separator: ";"                                    # join multiple with this
  regex: "(.+)"                                     # matched against the joined value
  target_label: app                                 # label to write
  replacement: "$1"                                 # value, can use capture groups
  action: replace                                   # what to do`},
{h:'Common actions'},
{t:[['Action','Effect'],
['`replace` (default)','Write replacement into target_label if regex matches'],
['`keep`','Keep the target or series only if regex matches'],
['`drop`','Drop the target or series if regex matches'],
['`labelmap`','Copy all labels matching a regex to new names'],
['`labeldrop` / `labelkeep`','Remove or retain labels by name'],
['`hashmod`','Shard targets across several servers'],
['`lowercase` / `uppercase`','Normalise label values']]},
{h:'Recipes'},
{code:`# 1. Scrape only pods annotated prometheus.io/scrape: "true"
relabel_configs:
  - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
    action: keep
    regex: "true"

# 2. Use a custom port from an annotation
  - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
    regex: "([^:]+)(?::\\\\d+)?;(\\\\d+)"
    replacement: "$1:$2"
    target_label: __address__

# 3. Copy all pod labels as target labels
  - action: labelmap
    regex: __meta_kubernetes_pod_label_(.+)

# 4. Drop noisy metrics after the scrape
metric_relabel_configs:
  - source_labels: [__name__]
    regex: "go_gc_.*|debug_.*"
    action: drop`},
{h:'Special labels'},
{t:[['Label','Meaning'],
['`__address__`','host:port to scrape'],
['`__scheme__`, `__metrics_path__`','Protocol and URL path'],
['`__param_<name>`','URL parameter sent to the target'],
['`__meta_*`','Metadata from discovery; removed after relabeling'],
['`__tmp_*`','Free for temporary use in rules']]},
{h:'Debugging'},
{ul:['Labels starting with `__` are dropped after relabeling, so copy what you need to a normal label.','Rules run **in order** and each sees the output of the previous one.','The regex is **fully anchored**: `app` does not match `myapp`.','Use the Service Discovery page to compare before and after.']},
{note:'Remember: `relabel_configs` decides **what is scraped**, `metric_relabel_configs` decides **what is stored**.'}],
src:[['relabel_config',PP+'configuration/configuration/#relabel_config'],['Relabeling tricks','https://www.robustperception.io/life-of-a-label/']]};
})();
