/* LearnSphere - Prometheus & Grafana, Section 11: Monitoring Kubernetes.
   Lectures 0-5 are core; additional lectures (not written yet) follow. Needs prom-common.js. */
(function(){
const K=window.PM,L=window.LESSONS,PP=K.PP;

/* ---------- diagrams ---------- */
const layers=K.dg(700,260,[
[10,10,680,240,'What to watch in a cluster, layer by layer',1],
[30,45,640,38,'Workloads: deployments, pods, containers (replicas, restarts, resource use)',2],
[30,93,640,38,'Cluster objects: kube-state-metrics (desired vs actual state)',0],
[30,141,640,38,'Nodes: node_exporter, kubelet and cAdvisor (CPU, memory, disk, pods per node)',0],
[30,189,640,38,'Control plane: API server, etcd, scheduler, controller manager',2]],
[]);

const stack=K.dg(700,260,[
[10,10,680,240,'kube-prometheus-stack',1],
[30,50,170,50,'Prometheus Operator|watches CRDs',2],[250,50,170,50,'Prometheus|StatefulSet',2],[470,50,180,50,'Alertmanager|StatefulSet',0],
[30,130,170,50,'ServiceMonitor|PodMonitor|PrometheusRule',0],[250,130,170,50,'kube-state-metrics|node-exporter',0],[470,130,180,50,'Grafana|dashboards and|datasource preloaded',2],
[250,205,170,35,'Default rules, dashboards',0]],
[[200,75,250,75],[420,75,470,75],[115,130,115,100],[335,130,335,100],[470,155,420,155]]);

const sm=K.dg(700,170,[
[10,10,680,150,'ServiceMonitor selects Services, which select Pods',1],
[30,55,150,60,'ServiceMonitor|selector, port,|path, interval',2],[230,55,130,60,'Service|label app=shop',0],[410,55,110,60,'Pods|expose /metrics',0],[570,55,100,60,'Prometheus|new target',2]],
[[180,85,230,85],[360,85,410,85],[520,85,570,85]]);

/* ---------- 0: What to monitor ---------- */
L['prom:10:0']={blocks:[
{p:'Kubernetes adds layers between your application and the hardware. Monitoring it well means watching each layer and understanding which signal answers which question.'},
{svg:layers},
{h:'Layers and sources'},
{t:[['Layer','Question','Source of metrics'],
['**Control plane**','Is the cluster able to accept and schedule work?','API server, etcd, scheduler and controller-manager `/metrics`'],
['**Nodes**','Are machines healthy and not full?','node_exporter, kubelet'],
['**Containers**','How much CPU and memory is each container using?','cAdvisor (in the kubelet)'],
['**Kubernetes objects**','Are the desired replicas running, are pods pending or crash-looping?','kube-state-metrics'],
['**Applications**','Are users served well?','Your own /metrics, exposed through ServiceMonitors']]},
{h:'Key metrics to know'},
{t:[['Metric','Meaning'],
['`kube_pod_status_phase`','Pod phase: Pending, Running, Failed ...'],
['`kube_pod_container_status_restarts_total`','Container restarts (crash loops)'],
['`kube_deployment_status_replicas_available`','Replicas ready vs `..._spec_replicas`'],
['`kube_node_status_condition`','Node Ready, MemoryPressure, DiskPressure'],
['`container_cpu_usage_seconds_total`','CPU used per container'],
['`container_memory_working_set_bytes`','Memory used per container'],
['`kube_pod_container_resource_limits`','Configured limits'],
['`apiserver_request_duration_seconds`','API latency'],
['`etcd_server_has_leader`','etcd health']]},
{h:'Four questions to start with'},
{flow:['Are all nodes Ready and with free capacity?','Are all workloads at their desired replica count?','Which containers restart or are throttled or near limits?','Is the API server fast and error free?']},
{h:'Useful starter queries'},
{code:`# Pods not running (excluding completed jobs)
sum by (namespace, phase) (kube_pod_status_phase{phase!~"Running|Succeeded"} == 1)

# Containers restarting
increase(kube_pod_container_status_restarts_total[1h]) > 3

# CPU used vs requested, per namespace
sum by (namespace) (rate(container_cpu_usage_seconds_total{container!=""}[5m]))
/ sum by (namespace) (kube_pod_container_resource_requests{resource="cpu"})`},
{note:'Many Kubernetes metrics are produced by **state** (kube-state-metrics) and **usage** (cAdvisor). Learn to join them: usage versus requests and limits is the heart of capacity work.'}],
src:[['Kubernetes metrics reference','https://kubernetes.io/docs/reference/instrumentation/metrics/'],['kube-state-metrics','https://github.com/kubernetes/kube-state-metrics']]};

/* ---------- 1: kube-prometheus-stack ---------- */
L['prom:10:1']={blocks:[
{p:'**kube-prometheus-stack** is a Helm chart that installs a complete monitoring system for Kubernetes: the Prometheus Operator, Prometheus, Alertmanager, Grafana, node-exporter, kube-state-metrics and a large set of ready-made rules and dashboards.'},
{svg:stack},
{h:'Install'},
{code:`helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install monitoring prometheus-community/kube-prometheus-stack \\
  --namespace monitoring --create-namespace \\
  -f values.yaml`},
{code:`# values.yaml (a sensible beginning)
prometheus:
  prometheusSpec:
    retention: 15d
    storageSpec:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 50Gi
    serviceMonitorSelectorNilUsesHelmValues: false   # pick up ServiceMonitors from any release
grafana:
  adminPassword: "change-me"
alertmanager:
  config:
    route:
      receiver: "null"
    receivers:
      - name: "null"`},
{h:'Look at what was created'},
{code:`kubectl -n monitoring get pods
kubectl -n monitoring get servicemonitors,prometheusrules
kubectl -n monitoring port-forward svc/monitoring-grafana 3000:80
kubectl -n monitoring port-forward svc/monitoring-kube-prometheus-prometheus 9090`},
{t:[['Component','Kind','Purpose'],
['Prometheus Operator','Deployment','Turns CRDs into running Prometheus and Alertmanager'],
['Prometheus','StatefulSet (created by the Operator)','Scrapes and stores'],
['Alertmanager','StatefulSet','Routes alerts'],
['Grafana','Deployment','Dashboards with data sources preconfigured'],
['kube-state-metrics','Deployment','Object state metrics'],
['node-exporter','DaemonSet','One per node']]},
{h:'What you get for free'},
{ul:['Dashboards for nodes, pods, namespaces, workloads, API server, etcd, kubelet.','A large set of alerting rules (KubePodCrashLooping, NodeNotReady, KubeletDown and more).','ServiceMonitors for the control-plane components that are scrapeable.']},
{note:'On managed clusters (EKS, GKE, AKS) some control-plane components are not reachable, so their ServiceMonitors show as down. Disable those in the chart values rather than ignoring them.'}],
src:[['kube-prometheus-stack chart','https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack'],['Prometheus Operator','https://prometheus-operator.dev/']]};

/* ---------- 2: Operator model ---------- */
L['prom:10:2']={blocks:[
{p:'In Kubernetes you rarely edit `prometheus.yml` by hand. The **Prometheus Operator** adds Custom Resources, and you describe monitoring with Kubernetes objects. The Operator turns them into Prometheus configuration and reloads it for you.'},
{svg:sm},
{h:'The custom resources'},
{t:[['Resource','What it configures'],
['**Prometheus**','A Prometheus server: replicas, retention, which monitors and rules to select'],
['**Alertmanager**','An Alertmanager cluster'],
['**ServiceMonitor**','Scrape the pods behind a Service'],
['**PodMonitor**','Scrape pods directly, no Service needed'],
['**PrometheusRule**','Recording and alerting rules'],
['**Probe**','Blackbox-style probes of endpoints'],
['**AlertmanagerConfig**','Namespaced routing and receivers']]},
{h:'ServiceMonitor'},
{code:`apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: shop
  namespace: shop
  labels:
    release: monitoring        # must match the Prometheus serviceMonitorSelector
spec:
  selector:
    matchLabels:
      app: shop                # selects the Service by label
  namespaceSelector:
    matchNames: ["shop"]
  endpoints:
    - port: metrics            # the NAME of the Service port
      path: /metrics
      interval: 30s`},
{h:'PrometheusRule'},
{code:`apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: shop-rules
  namespace: shop
  labels:
    release: monitoring
spec:
  groups:
    - name: shop
      rules:
        - alert: ShopHighErrorRate
          expr: |
            sum(rate(http_requests_total{job="shop",code=~"5.."}[5m]))
            / sum(rate(http_requests_total{job="shop"}[5m])) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Shop error ratio above 5%"`},
{h:'How selection works'},
{flow:['The Prometheus resource has serviceMonitorSelector labels','ServiceMonitors with matching labels are selected','Each ServiceMonitor selects Services by label and port name','The Operator generates scrape config and reloads Prometheus','New pods behind the Service become targets automatically']},
{h:'Common pitfalls'},
{t:[['Symptom','Likely cause'],
['ServiceMonitor ignored','Its labels do not match `serviceMonitorSelector` on the Prometheus'],
['Target not appearing','Service port has no name, or selector labels differ'],
['Target appears but is down','Wrong path, port, scheme or NetworkPolicy'],
['Rule not loaded','Missing `release` label, or YAML error']]},
{note:'Use `kubectl describe prometheus -n monitoring` and the Prometheus **Targets** page to see what the Operator selected.'}],
src:[['Prometheus Operator design','https://prometheus-operator.dev/docs/getting-started/design/'],['API reference','https://prometheus-operator.dev/docs/api-reference/api/']]};

/* ---------- 3: kube-state-metrics and node-exporter ---------- */
L['prom:10:3']={blocks:[
{p:'Two components give Kubernetes monitoring most of its raw material. **kube-state-metrics** exposes the **state of objects** in the API. **node-exporter** exposes **machine resources**. Neither one tells you everything on its own, so you combine them.'},
{h:'kube-state-metrics (KSM)'},
{p:'KSM watches the Kubernetes API and converts object fields into metrics. It does **not** measure usage; it reports what the cluster **says** should exist and what condition it is in.'},
{t:[['Object','Example metric','Question'],
['**Pod**','`kube_pod_status_phase`, `kube_pod_container_status_waiting_reason`','Why is the pod not running?'],
['**Deployment**','`kube_deployment_spec_replicas`, `kube_deployment_status_replicas_available`','Are all replicas up?'],
['**Node**','`kube_node_status_condition`, `kube_node_status_allocatable`','Is the node healthy and how much can it hold?'],
['**Job / CronJob**','`kube_job_status_failed`, `kube_cronjob_status_last_schedule_time`','Did the batch job fail or stop running?'],
['**PVC**','`kube_persistentvolumeclaim_status_phase`','Are volumes bound?'],
['**Container resources**','`kube_pod_container_resource_requests`, `..._limits`','What was requested?']]},
{h:'Labels from objects'},
{p:'KSM metrics like `kube_pod_labels` and `kube_pod_info` are **info-style** series with value 1. Join them with `group_left` to add owner, node or team labels to usage metrics.'},
{code:`# Memory working set with the pod owner (workload) label attached
container_memory_working_set_bytes{container!=""}
  * on (namespace, pod) group_left (owner_name)
    kube_pod_owner`},
{h:'node-exporter on Kubernetes'},
{ul:['Runs as a **DaemonSet**, one pod per node, with `hostNetwork` and access to `/proc` and `/sys`.','Provides the same `node_*` metrics as on a VM: CPU, memory, disk, network.','Node-level view: `instance` is the node address; join with `kube_node_info` for the node name.']},
{h:'Usage vs request vs limit'},
{code:`# CPU: using vs asking for, per namespace
sum by (namespace) (rate(container_cpu_usage_seconds_total{container!=""}[5m]))
sum by (namespace) (kube_pod_container_resource_requests{resource="cpu"})

# Containers at risk of OOM kill
container_memory_working_set_bytes{container!=""}
/ on (namespace, pod, container)
kube_pod_container_resource_limits{resource="memory"} > 0.9

# CPU throttling
rate(container_cpu_cfs_throttled_periods_total[5m])
/ rate(container_cpu_cfs_periods_total[5m]) > 0.25`},
{note:'KSM data comes from the API server, not from the container. A pod can be "Running" in KSM and still be failing health checks, so combine state with real usage and application metrics.'}],
src:[['kube-state-metrics documentation','https://github.com/kubernetes/kube-state-metrics/tree/main/docs'],['node_exporter','https://github.com/prometheus/node_exporter']]};

/* ---------- 4: Monitoring your own apps ---------- */
L['prom:10:4']={blocks:[
{p:'To monitor your own application on Kubernetes you need three things: the app **exposes metrics**, a **Service** reaches them and a **ServiceMonitor** tells Prometheus to scrape. Then you build a dashboard and rules from the data.'},
{h:'1. Expose metrics'},
{p:'Your container serves `/metrics` on a port, for example 8000 (see Section 3). Declare the port in the Deployment so it is discoverable.'},
{code:`apiVersion: apps/v1
kind: Deployment
metadata: { name: shop, namespace: shop }
spec:
  replicas: 2
  selector: { matchLabels: { app: shop } }
  template:
    metadata: { labels: { app: shop } }
    spec:
      containers:
        - name: shop
          image: example/shop:1.0
          ports:
            - { name: http, containerPort: 8080 }
            - { name: metrics, containerPort: 8000 }`},
{h:'2. A Service with a named port'},
{code:`apiVersion: v1
kind: Service
metadata:
  name: shop
  namespace: shop
  labels: { app: shop }
spec:
  selector: { app: shop }
  ports:
    - { name: http, port: 80, targetPort: http }
    - { name: metrics, port: 8000, targetPort: metrics }`},
{h:'3. A ServiceMonitor'},
{p:'Use the ServiceMonitor from the previous lecture, with the same `release` label as your Prometheus selects, and `port: metrics`. Alternatively use a **PodMonitor** if you do not have a Service.'},
{h:'4. Verify end to end'},
{flow:['kubectl get servicemonitor -n shop shows the object','Prometheus Targets page lists shop with 2 pods as UP','Query up{job="shop"} in Prometheus','Query a business metric, for example rate(http_requests_total[5m])','Build or import a dashboard and add alert rules']},
{h:'Labels you get'},
{p:'The Operator adds `namespace`, `pod`, `service`, `container` and `job` labels, so dashboards can group by service or pod without extra work.'},
{h:'A starter dashboard and alerts'},
{ul:['Variables: `namespace` and `pod` or `service`.','Panels: request rate, error ratio, p95 latency, restarts, CPU and memory vs limits.','Alerts: error ratio, latency above SLO, crash looping, no replicas available.']},
{note:'Common mistake: referring to a port **number** in the ServiceMonitor when the Service port has a **name**. The `port` field takes the port name.'}],
src:[['ServiceMonitor guide','https://prometheus-operator.dev/docs/developer/getting-started/'],['Kubernetes Service','https://kubernetes.io/docs/concepts/services-networking/service/']]};

/* ---------- 5: Cluster alerts and dashboards ---------- */
L['prom:10:5']={blocks:[
{p:'The chart ships with many rules and dashboards. They are useful immediately, but they also produce noise for clusters they were not tuned for. This lecture lists the ones worth knowing and how to tune the rest.'},
{h:'Alerts worth having'},
{t:[['Alert','Meaning','Severity'],
['`KubePodCrashLooping`','A container restarts repeatedly','warning'],
['`KubePodNotReady`','A pod has been not ready for a long time','warning'],
['`KubeDeploymentReplicasMismatch`','Desired and available replicas differ','warning'],
['`KubeNodeNotReady`','A node is not Ready','critical'],
['`NodeFilesystemSpaceFillingUp`','Disk predicted to fill','warning'],
['`NodeMemoryHighUtilization`','Node memory above threshold','warning'],
['`KubeletDown`, `KubeAPIDown`','Component not scraped','critical'],
['`CPUThrottlingHigh`','Containers heavily throttled','info'],
['`Watchdog`','Always firing; proves the alert path works','none']]},
{p:'**Watchdog** is intentional. Connect it to a dead-man-switch service, which pages you when it **stops** arriving, proving that the pipeline from Prometheus to notification is intact.'},
{h:'Dashboards to open first'},
{t:[['Dashboard','Use'],
['**Kubernetes / Compute Resources / Cluster**','Overall usage vs requests'],
['**... / Namespace (Pods)**','Which namespaces and pods use the most'],
['**... / Node (Pods)**','What runs on one node'],
['**Node Exporter / Nodes**','Machine detail'],
['**Kubernetes / API server**','Control-plane latency and errors'],
['**Alertmanager / Overview**','Alert flow and failures']]},
{h:'Tuning the defaults'},
{code:`# values.yaml
defaultRules:
  rules:
    etcd: false                 # not reachable on managed clusters
    kubeSchedulerAlerting: false
kubeControllerManager:
  enabled: false
kubeScheduler:
  enabled: false
kubeEtcd:
  enabled: false`},
{flow:['Run the defaults for a week','List alerts that fired and were not actionable','Disable or raise thresholds for them with values or a custom PrometheusRule','Add inhibition and routing so critical goes to paging, warnings to tickets','Add your own application SLO alerts']},
{note:'Do not delete rules you do not understand. First read the rule expression and the runbook link, which the chart provides in the annotations.'}],
src:[['kubernetes-mixin','https://github.com/kubernetes-monitoring/kubernetes-mixin'],['Runbooks for kube-prometheus rules','https://runbooks.prometheus-operator.dev/']]};
})();
