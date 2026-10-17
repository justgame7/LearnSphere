/* LearnSphere - Google Cloud, Section 09: Google Kubernetes Engine (GKE).
   Lectures 0-10 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const k8s=K.dg(700,300,[
[10,10,680,280,'Kubernetes objects',1],
[30,50,150,60,'Pod|one or more containers',2],[220,50,150,60,'Deployment|keeps N pods running',0],[410,50,130,60,'Service|stable address',0],[570,50,100,60,'Ingress|HTTP entry',0],
[30,150,150,60,'ConfigMap and|Secret',0],[220,150,150,60,'Namespace|logical partition',0],[410,150,130,60,'Node|VM that runs pods',0],[570,150,100,60,'Cluster',0],
[30,235,640,35,'You declare the desired state. Kubernetes continuously works to make reality match it.',2]],
[[370,80,410,80],[220,80,180,80],[540,80,570,80]]);

const arch=K.dg(700,310,[
[10,10,680,290,'GKE cluster',1],
[30,45,640,80,'Control plane (managed by Google)|API server, scheduler, controllers, etcd|zonal or regional',2],
[30,150,200,130,'Node pool A|VMs in Compute Engine|pods run here',0],[250,150,200,130,'Node pool B|different machine type|GPU or Spot',0],[470,150,200,130,'Autopilot|Google manages nodes|you pay per pod',0]],
[[130,125,130,150],[350,125,350,150],[570,125,570,150]]);

const modes=K.dg(700,250,[
[10,10,680,230,'Autopilot versus Standard',1],
[30,60,300,140,'Autopilot|Google manages nodes, scaling, security defaults|Pay for pod CPU, memory, storage requests|Less control, fewer decisions',2],
[370,60,300,140,'Standard|You manage node pools, upgrades settings, sizing|Pay for the node VMs|Full control, more work',0]],
[]);

const net=K.dg(700,260,[
[10,10,680,240,'VPC-native cluster ranges',1],
[30,60,180,70,'Subnet primary|node IPs',0],[260,60,180,70,'Secondary range 1|Pod IPs',2],[490,60,180,70,'Secondary range 2|Service IPs',2],
[30,160,640,60,'Pods get VPC-routable alias IPs, so they can talk to VMs and services without NAT',0]],
[]);

const scale=K.dg(700,230,[
[10,10,680,210,'Scaling layers',1],
[30,70,190,70,'HPA|more pods when load rises',2],[255,70,190,70,'VPA|right size pod requests',0],[480,70,190,70,'Cluster Autoscaler|add or remove nodes',2]],
[[220,105,255,105],[445,105,480,105]]);

/* ---------- 0 ---------- */
L['gcp:8:0']={blocks:[
{p:'A **container** packages an application and everything it needs to run into one image that behaves the same on a laptop, a VM or the cloud. **Kubernetes** is the system that runs many containers across many machines, keeping them healthy, connected and scaled. **GKE** is Google\'s managed Kubernetes.'},
{h:'Containers in short'},
{ul:['An **image** is a read-only template with the app and its dependencies.','A **container** is a running instance of an image, isolated by the operating system.','A **registry** such as Artifact Registry stores and distributes images.','Containers start in seconds and use fewer resources than VMs because they share the host kernel.']},
{h:'Kubernetes objects you will meet'},
{svg:k8s},
{t:[['Object','Purpose'],
['Pod','The smallest unit. One or more containers sharing network and storage'],
['Deployment','Declares how many replicas of a pod to run and handles rolling updates'],
['Service','A stable IP and DNS name that load balances across a set of pods'],
['Ingress / Gateway','HTTP routing into the cluster from outside'],
['ConfigMap and Secret','Configuration and sensitive values injected into pods'],
['Namespace','A logical partition for teams or environments'],
['StatefulSet','Pods with stable identity and storage, for databases'],
['Job and CronJob','Run-to-completion and scheduled tasks']]},
{h:'Declarative model'},
{p:'You write YAML describing the **desired state**. Kubernetes controllers constantly compare it with the actual state and fix differences. If a pod dies, a new one is created. If you change the image in the Deployment, pods are replaced gradually.'},
{code:`apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels: {app: web}
  template:
    metadata:
      labels: {app: web}
    spec:
      containers:
      - name: web
        image: us-docker.pkg.dev/my-project/apps/web:1.0
        ports: [{containerPort: 8080}]
        resources:
          requests: {cpu: 250m, memory: 256Mi}`},
{note:'This lesson is only the minimum needed for GKE. If you want a full Kubernetes course, see the Kubernetes course in LearnSphere.'}],
src:[['GKE overview',K.GKE+'concepts/kubernetes-engine-overview'],['Kubernetes documentation','https://kubernetes.io/docs/home/']]};

/* ---------- 1 ---------- */
L['gcp:8:1']={blocks:[
{p:'A GKE cluster has two parts: a **control plane** that Google runs for you, and **nodes** where your pods run. The mode you choose decides how much of the node side Google manages.'},
{svg:arch},
{h:'Control plane'},
{ul:['Contains the Kubernetes API server, scheduler, controllers and etcd database.','Fully managed, patched and scaled by Google. You never see the machines.','**Zonal** clusters have one control plane replica. **Regional** clusters run three replicas across zones, so the API stays available during a zone outage and during upgrades.']},
{h:'Operation modes'},
{svg:modes},
{t:[['Aspect','Autopilot','Standard'],
['Nodes','Managed by Google, invisible','You create and manage node pools'],
['Billing','Per pod resource requests (CPU, memory, ephemeral storage), plus cluster fee','Per node VM, plus cluster fee'],
['Scaling','Automatic','You configure autoscaling'],
['Security defaults','Hardened by default, restrictions on privileged pods','You decide'],
['Flexibility','Some limits (no SSH to nodes, restricted host access)','Full: custom node images, daemon sets, privileged'],
['Best for','Most workloads, small teams, less operations','Special hardware, custom node configuration, fine-grained cost control']]},
{h:'Cluster fee and editions'},
{p:'Each cluster has a management fee per hour, with a monthly free credit that covers one Autopilot or zonal cluster per billing account. **GKE Enterprise** adds multi-cluster management, policy and service mesh features. Check the pricing page for current figures.'},
{note:'Start with Autopilot unless you have a clear need for Standard. You can run both in the same project and move workloads between them with the same YAML.'}],
src:[['GKE architecture',K.GKE+'concepts/cluster-architecture'],['Autopilot overview',K.GKE+'concepts/autopilot-overview'],['Pricing','https://cloud.google.com/kubernetes-engine/pricing']]};

/* ---------- 2 ---------- */
L['gcp:8:2']={blocks:[
{p:'Creating a cluster is one command. Connecting to it needs credentials in your kubeconfig and the right plugin.'},
{h:'Create clusters'},
{code:`gcloud services enable container.googleapis.com
gcloud container clusters create-auto demo-auto --region=us-central1
gcloud container clusters create demo-std --zone=us-central1-a --num-nodes=2 --machine-type=e2-standard-4 \\
  --release-channel=regular --enable-ip-alias
gcloud container clusters list`},
{h:'Connect with kubectl'},
{code:`gcloud components install kubectl gke-gcloud-auth-plugin
gcloud container clusters get-credentials demo-auto --region=us-central1
kubectl config current-context
kubectl get nodes
kubectl get pods -A`},
{ul:['`get-credentials` writes a context to your kubeconfig. The auth plugin fetches tokens through your Google identity.','Your IAM role decides if you can reach the API (for example `roles/container.developer`). Kubernetes RBAC then controls what you can do inside.','Use `kubectl config use-context` to switch clusters. Always check the current context before destructive commands.']},
{h:'IAM roles for GKE'},
{t:[['Role','Allows'],
['Kubernetes Engine Cluster Viewer','View clusters'],
['Kubernetes Engine Developer','Manage objects inside clusters'],
['Kubernetes Engine Admin','Manage clusters and objects'],
['Kubernetes Engine Cluster Admin','Manage clusters but not objects']]},
{h:'First deployment'},
{code:`kubectl create deployment hello --image=us-docker.pkg.dev/google-samples/containers/gke/hello-app:1.0 --replicas=2
kubectl expose deployment hello --type=LoadBalancer --port=80 --target-port=8080
kubectl get service hello --watch
kubectl delete service hello && kubectl delete deployment hello`},
{note:'A Service of type LoadBalancer creates a Google Cloud load balancer that costs money. Delete it when you finish.'}],
src:[['Create an Autopilot cluster',K.GKE+'how-to/creating-an-autopilot-cluster'],['Install kubectl and the auth plugin',K.GKE+'how-to/cluster-access-for-kubectl']]};

/* ---------- 3 ---------- */
L['gcp:8:3']={blocks:[
{p:'In Standard clusters, nodes are grouped into **node pools**, sets of VMs with the same configuration. You can have several pools in one cluster for different needs.'},
{h:'Why several pools'},
{ul:['A pool of general nodes for web services.','A pool of high-memory nodes for caches.','A GPU pool for ML inference, scaled to zero when idle.','A Spot pool for batch jobs with taints to keep other pods off it.']},
{code:`gcloud container node-pools create spot-pool --cluster=demo-std --zone=us-central1-a \\
  --machine-type=e2-standard-4 --spot --num-nodes=0 --enable-autoscaling --min-nodes=0 --max-nodes=5 \\
  --node-taints=workload=batch:NoSchedule
gcloud container node-pools list --cluster=demo-std --zone=us-central1-a`},
{p:'A pod chooses a pool using a `nodeSelector` or affinity, and tolerates the pool taint.'},
{h:'Release channels and upgrades'},
{t:[['Channel','Behaviour'],
['Rapid','Newest versions first, for testing'],
['Regular (default)','Balance of features and stability'],
['Stable','Most validated versions'],
['Extended','Longer support period for slow upgrade cycles']]},
{ul:['Clusters on a channel are **auto-upgraded** by Google within the channel, in the control plane first, then nodes.','Use **maintenance windows** and **exclusions** to control when upgrades occur.','**Surge upgrades** (max surge, max unavailable) create extra nodes to keep capacity during the upgrade. **Blue-green upgrades** keep the old pool until the new one is verified.','Pods must tolerate eviction. Use PodDisruptionBudgets to keep a minimum number running.']},
{code:`gcloud container clusters update demo-std --zone=us-central1-a --maintenance-window-start=2026-01-01T02:00:00Z \\
  --maintenance-window-end=2026-01-01T06:00:00Z --maintenance-window-recurrence="FREQ=WEEKLY;BYDAY=SA,SU"
gcloud container node-pools update default-pool --cluster=demo-std --zone=us-central1-a --max-surge-upgrade=1 --max-unavailable-upgrade=0`},
{note:'In Autopilot, node pools, sizes and upgrades are handled for you. You still control the version channel and maintenance window.'}],
src:[['Node pools',K.GKE+'concepts/node-pools'],['Release channels',K.GKE+'concepts/release-channels'],['Node upgrade strategies',K.GKE+'concepts/node-pool-upgrade-strategies']]};

/* ---------- 4 ---------- */
L['gcp:8:4']={blocks:[
{p:'You deploy to GKE by applying YAML manifests with `kubectl`. The core trio is Deployment (pods), Service (networking) and ConfigMap or Secret (configuration).'},
{h:'Deployment and Service'},
{code:`apiVersion: apps/v1
kind: Deployment
metadata: {name: web}
spec:
  replicas: 3
  selector: {matchLabels: {app: web}}
  strategy:
    rollingUpdate: {maxSurge: 1, maxUnavailable: 0}
  template:
    metadata: {labels: {app: web}}
    spec:
      containers:
      - name: web
        image: us-docker.pkg.dev/my-project/apps/web:1.1
        ports: [{containerPort: 8080}]
        env:
        - name: APP_ENV
          valueFrom: {configMapKeyRef: {name: web-config, key: env}}
        resources:
          requests: {cpu: 250m, memory: 256Mi}
          limits: {memory: 512Mi}
        readinessProbe: {httpGet: {path: /healthz, port: 8080}, periodSeconds: 5}
---
apiVersion: v1
kind: Service
metadata: {name: web}
spec:
  type: ClusterIP
  selector: {app: web}
  ports: [{port: 80, targetPort: 8080}]`},
{h:'Service types'},
{t:[['Type','What it does'],
['ClusterIP','Internal virtual IP inside the cluster (default)'],
['NodePort','Opens a port on every node'],
['LoadBalancer','Creates a Google Cloud network load balancer with an external or internal IP'],
['Headless (clusterIP: None)','DNS returns pod IPs for stateful apps']]},
{h:'Everyday kubectl'},
{code:`kubectl apply -f web.yaml
kubectl rollout status deployment/web
kubectl set image deployment/web web=us-docker.pkg.dev/my-project/apps/web:1.2
kubectl rollout undo deployment/web
kubectl scale deployment/web --replicas=5
kubectl logs deployment/web --tail=50
kubectl describe pod web-xyz
kubectl exec -it web-xyz -- sh`},
{h:'Good practice'},
{ul:['Always set resource **requests**. They drive scheduling, autoscaling and Autopilot billing.','Add **readiness** and **liveness** probes.','Keep images small, use fixed tags or digests, not `latest`.','Use namespaces and labels, and apply manifests from source control.']},
{note:'Secrets in Kubernetes are only base64 encoded by default. Use Secret Manager with the CSI driver or enable application-layer secrets encryption for sensitive values.'}],
src:[['Deploying workloads',K.GKE+'concepts/deployment'],['Services',K.GKE+'concepts/service']]};

/* ---------- 5 ---------- */
L['gcp:8:5']={blocks:[
{p:'To receive HTTP traffic from the internet or other networks, GKE integrates with Google Cloud load balancers. You describe what you want in Kubernetes objects, and GKE creates and updates the load balancer.'},
{h:'Options'},
{t:[['Object','Creates','Notes'],
['Service type LoadBalancer','Layer 4 passthrough network load balancer','Simple TCP/UDP exposure'],
['Ingress (class gce)','Global external Application Load Balancer','The original HTTP(S) method, annotation based'],
['Gateway API','Application Load Balancer by GatewayClass (global, regional, internal, multi-cluster)','Current, role-oriented standard. Preferred for new designs'],
['Multi-cluster Ingress and Gateway','One load balancer for several clusters','Global apps, failover']]},
{h:'Gateway example'},
{code:`apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: {name: external-http}
spec:
  gatewayClassName: gke-l7-global-external-managed
  listeners:
  - name: http
    protocol: HTTP
    port: 80
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: {name: web-route}
spec:
  parentRefs: [{name: external-http}]
  rules:
  - matches: [{path: {type: PathPrefix, value: /api}}]
    backendRefs: [{name: api, port: 80}]
  - backendRefs: [{name: web, port: 80}]`},
{h:'Container-native load balancing'},
{p:'In VPC-native clusters, the load balancer sends traffic **directly to pod IPs** using **network endpoint groups (NEGs)**. It skips an extra hop through node ports, which improves latency and gives accurate health checks.'},
{h:'Typical add-ons'},
{ul:['**ManagedCertificate** or Certificate Manager for HTTPS.','**BackendConfig / GCPBackendPolicy** for Cloud CDN, Cloud Armor, IAP and health checks.','Static IP address referenced by annotation or the Gateway.','Internal Gateway classes for private load balancers.']},
{note:'If the load balancer shows unhealthy backends, check the health check path and port, the readiness probe and the firewall rule that allows Google health check ranges.'}],
src:[['Gateway API in GKE',K.GKE+'concepts/gateway-api'],['Container-native load balancing',K.GKE+'concepts/container-native-load-balancing']]};

/* ---------- 6 ---------- */
L['gcp:8:6']={blocks:[
{p:'GKE networking builds on your VPC. Good IP planning avoids running out of addresses, and network controls limit who reaches the cluster and which pods can talk to which.'},
{svg:net},
{h:'VPC-native (alias IP) clusters'},
{ul:['Default and recommended. Pods and services use **secondary ranges** of the subnet, so pods have real VPC IPs.','Pod range size limits the number of pods. Each node reserves a block (for example /24 gives 110 pods).','Service range size limits the number of Services.','Plan large ranges at creation. They are hard to change later.']},
{code:`gcloud container clusters create-auto private-demo --region=us-central1 --network=prod-vpc --subnetwork=gke-us \\
  --cluster-secondary-range-name=pods --services-secondary-range-name=services \\
  --enable-private-nodes --enable-master-authorized-networks --master-authorized-networks=203.0.113.0/24`},
{h:'Private clusters'},
{t:[['Setting','Effect'],
['Private nodes','Nodes have only internal IPs. They need Cloud NAT for internet and Private Google Access for Google APIs'],
['Private endpoint','Control plane reachable only from internal networks'],
['Authorized networks','Limit which IP ranges can call the public control plane endpoint'],
['DNS-based endpoint','Control plane access through a DNS name controlled by IAM']]},
{h:'Network policy'},
{p:'By default any pod can reach any other pod. **Network policies** restrict this. GKE enforces them with Dataplane V2 (eBPF, recommended and the default in Autopilot) or Calico.'},
{code:`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: db-allow-app}
spec:
  podSelector: {matchLabels: {app: db}}
  policyTypes: [Ingress]
  ingress:
  - from: [{podSelector: {matchLabels: {app: api}}}]
    ports: [{protocol: TCP, port: 5432}]`},
{h:'DNS and service discovery'},
{p:'Services get DNS names such as `web.default.svc.cluster.local`. GKE uses kube-dns or Cloud DNS for GKE for cluster DNS, with optional node-local caching.'},
{note:'Check the firewall rules GKE creates automatically. Do not delete them. Add your own rules for extra access.'}],
src:[['GKE networking overview',K.GKE+'concepts/network-overview'],['Private clusters',K.GKE+'concepts/private-cluster-concept'],['Network policy',K.GKE+'how-to/network-policy']]};

/* ---------- 7 ---------- */
L['gcp:8:7']={blocks:[
{p:'Kubernetes scales at three levels. You need to understand all three because they work together.'},
{svg:scale},
{t:[['Tool','Scales','Based on','Notes'],
['Horizontal Pod Autoscaler (HPA)','Number of pod replicas','CPU, memory, custom or external metrics','Most common'],
['Vertical Pod Autoscaler (VPA)','CPU and memory requests of pods','Observed usage','Recommends or applies. Do not combine with HPA on the same metric'],
['Cluster Autoscaler','Number of nodes in a node pool','Pending pods that do not fit, or idle nodes','Standard clusters'],
['Node auto-provisioning','New node pools with suitable machine types','Pending pod requirements','Standard clusters'],
['Autopilot','Nodes automatically','Pod requests','Nothing to configure']]},
{h:'HPA example'},
{code:`kubectl autoscale deployment web --cpu-percent=60 --min=3 --max=20
kubectl get hpa

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: {name: web}
spec:
  scaleTargetRef: {apiVersion: apps/v1, kind: Deployment, name: web}
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource: {name: cpu, target: {type: Utilization, averageUtilization: 60}}`},
{h:'Cluster autoscaler'},
{code:`gcloud container clusters update demo-std --zone=us-central1-a --enable-autoscaling --min-nodes=1 --max-nodes=10 --node-pool=default-pool
gcloud container clusters update demo-std --zone=us-central1-a --autoscaling-profile=optimize-utilization`},
{h:'How they fit'},
{flow:['Load rises and CPU of pods goes above the target','HPA adds replicas','Some pods cannot be scheduled for lack of node capacity','Cluster Autoscaler adds nodes (Autopilot does it automatically)','When load falls, HPA removes pods and idle nodes are removed']},
{note:'Autoscaling depends on correct resource requests. Without requests, HPA percentages and scheduling decisions are meaningless.'}],
src:[['Horizontal Pod autoscaling',K.GKE+'concepts/horizontalpodautoscaler'],['Cluster autoscaler',K.GKE+'concepts/cluster-autoscaler']]};

/* ---------- 8 ---------- */
L['gcp:8:8']={blocks:[
{p:'Pods often need to call Google Cloud APIs. The safest method is **Workload Identity Federation for GKE**, which maps a Kubernetes service account to a Google identity with no keys. Other controls restrict who can use the cluster and what can run in it.'},
{h:'Workload Identity Federation for GKE'},
{flow:['A pod uses a Kubernetes service account (KSA)','GKE exchanges its token for a short-lived Google credential','IAM grants roles to the KSA identity (principal) directly','The pod calls the Google API with no key file']},
{code:`gcloud container clusters update demo-std --zone=us-central1-a --workload-pool=my-project.svc.id.goog
kubectl create serviceaccount app-ksa -n prod
gcloud projects add-iam-policy-binding my-project \\
  --role="roles/storage.objectViewer" \\
  --member="principal://iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/my-project.svc.id.goog/subject/ns/prod/sa/app-ksa"`},
{p:'Autopilot clusters have Workload Identity Federation enabled by default. Do not use the node service account for application permissions.'},
{h:'Layers of security'},
{t:[['Layer','Controls'],
['Cluster access','IAM roles, authorized networks, private endpoint'],
['Inside the cluster','Kubernetes RBAC with Roles and RoleBindings'],
['Pod identity','Workload Identity Federation, no node-wide credentials'],
['Pod behavior','Pod Security Standards, no privileged containers'],
['Network','Network policies, private nodes'],
['Supply chain','Artifact Registry scanning, Binary Authorization to allow only signed images'],
['Nodes','Shielded GKE Nodes, automatic upgrades, Container-Optimized OS'],
['Secrets','Secret Manager CSI driver, encryption with CMEK']]},
{h:'RBAC example'},
{code:`kubectl create role pod-reader --verb=get,list,watch --resource=pods -n prod
kubectl create rolebinding ana-pods --role=pod-reader --user=ana@example.com -n prod
kubectl auth can-i delete pods -n prod --as=ana@example.com`},
{h:'Binary Authorization'},
{p:'A policy requires images to be **attested** (signed after passing checks) before GKE will run them. It blocks unknown or unscanned images in production clusters.'},
{note:'Avoid giving the node service account broad roles. Create a dedicated, least-privilege node service account for Standard clusters.'}],
src:[['Workload Identity Federation for GKE',K.GKE+'concepts/workload-identity'],['GKE security overview',K.GKE+'concepts/security-overview'],['Binary Authorization','https://cloud.google.com/binary-authorization/docs/overview']]};

/* ---------- 9 ---------- */
L['gcp:8:9']={blocks:[
{p:'Pods are temporary, so data that must live longer needs a **persistent volume**. GKE integrates Kubernetes storage with Google Cloud disks and file services.'},
{h:'Storage building blocks'},
{t:[['Object','Meaning'],
['PersistentVolumeClaim (PVC)','A request for storage by a pod, with size and access mode'],
['PersistentVolume (PV)','The actual volume, usually created automatically (dynamic provisioning)'],
['StorageClass','Defines the backing type, such as pd-balanced or Hyperdisk'],
['StatefulSet','Gives each pod a stable name and its own PVC']]},
{code:`apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: data}
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: standard-rwo
  resources: {requests: {storage: 50Gi}}`},
{h:'Choices for volumes'},
{t:[['Backend','Access','Use'],
['Persistent Disk / Hyperdisk (CSI)','ReadWriteOnce (one node), regional disk option','Databases, single-pod state'],
['Filestore (CSI)','ReadWriteMany','Shared content between many pods'],
['Cloud Storage FUSE CSI','ReadWriteMany','Large datasets read by ML jobs'],
['Local SSD','Per node, ephemeral','Caches, scratch'],
['emptyDir','Pod lifetime','Temporary files']]},
{h:'Running databases'},
{ul:['Prefer managed databases (Cloud SQL, AlloyDB, Spanner) for most production data.','If you must run one in GKE, use a StatefulSet with a regional disk or an operator, and test backups and restores.','Use **Backup for GKE** to back up cluster state and volumes, and restore into the same or another cluster.']},
{code:`kubectl get pvc,pv
kubectl describe pvc data
gcloud beta container backup-restore backup-plans list --location=us-central1`},
{note:'A ReadWriteOnce disk can be attached to one node at a time. If a pod moves to a node in another zone, a zonal disk cannot follow. Use regional disks or topology-aware scheduling.'}],
src:[['Storage in GKE',K.GKE+'concepts/storage-overview'],['Backup for GKE',K.GKE+'add-on/backup-for-gke/concepts/backup-for-gke']]};

/* ---------- 10 ---------- */
L['gcp:8:10']={blocks:[
{p:'GKE integrates with Cloud Logging and Cloud Monitoring from the start. Knowing the usual pod failure states shortens troubleshooting.'},
{h:'Observability'},
{ul:['**Logs.** Container stdout and stderr go to Cloud Logging with pod, namespace and cluster labels.','**Metrics.** System metrics appear in Cloud Monitoring. **Managed Service for Prometheus** collects application metrics with the Prometheus format and PromQL.','**Dashboards.** The GKE console shows workload, node and cluster health.','**Events.** `kubectl get events` explains scheduling and image problems.']},
{h:'Common pod problems'},
{t:[['Status','Meaning','Check'],
['Pending','Not scheduled: no node fits, quota, taints, or unbound PVC','`kubectl describe pod` events, node capacity, cluster autoscaler'],
['ImagePullBackOff / ErrImagePull','Cannot fetch the image','Name and tag, Artifact Registry permissions, private cluster access'],
['CrashLoopBackOff','Container starts and exits repeatedly','`kubectl logs --previous`, config, probes'],
['OOMKilled','Used more memory than its limit','Raise the limit or fix the leak'],
['CreateContainerConfigError','Missing ConfigMap or Secret','Names and namespace'],
['Running but not Ready','Readiness probe fails','Probe path, port and startup time'],
['Evicted','Node pressure','Resource requests, node size']]},
{code:`kubectl get pods -o wide
kubectl describe pod web-xyz | tail -30
kubectl logs web-xyz --previous
kubectl top pods
kubectl get events --sort-by=.lastTimestamp | tail
gcloud logging read 'resource.type="k8s_container" AND resource.labels.cluster_name="demo-std" AND severity>=ERROR' --limit=20`},
{h:'A troubleshooting order'},
{flow:['Is the pod scheduled and Running?','If not, read events for scheduling or image errors','Check logs of the current and previous container','Check the Service selector and endpoints with kubectl get endpoints','Check the load balancer health and firewall rules','Check node and quota issues']},
{note:'A Service with no endpoints usually means its selector does not match the pod labels, or no pod is Ready.'}],
src:[['Troubleshooting GKE',K.GKE+'troubleshooting'],['Observability for GKE',K.GKE+'concepts/observability']]};
})();
