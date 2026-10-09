/* LearnSphere - Kubernetes Administrator, Section 05: Workloads & Controllers.
   Lectures 0-8 are core, 9-13 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T;
const W=C+'workloads/';

const podlife=K.dg(700,200,[
[10,70,100,60,'Pending|accepted, not|all running',0],[140,70,120,60,'Init containers|run one by one|to completion',2],[290,70,120,60,'Running|app containers|started',2],
[440,20,110,60,'Succeeded|all exited 0',0],[440,120,110,60,'Failed|a container|exited non-zero',0],[580,70,100,60,'Unknown|node lost',0]],
[[110,100,140,100],[260,100,290,100],[410,90,440,50],[410,110,440,150]]);

const rollout=K.dg(700,230,[
[10,20,330,200,'Deployment web (replicas 3)',1],[360,20,330,200,'During a rolling update',1],
[30,55,290,70,'ReplicaSet web-6d4 (old image)|Pod  Pod  Pod',0],[30,140,290,60,'ReplicaSet web-9a1 (new image)|0 Pods',2],
[380,55,290,70,'old RS: 3 -> 2 -> 1 -> 0|Pods terminate one by one',0],[380,140,290,60,'new RS: 0 -> 1 -> 2 -> 3|maxSurge 25%, maxUnavailable 25%',2]],
[]);

const qos=K.dg(700,200,[
[10,20,210,160,'Guaranteed',1],[245,20,210,160,'Burstable',1],[480,20,210,160,'BestEffort',1],
[30,55,170,100,'Every container has|requests = limits|for CPU and memory|(evicted last)',2],[265,55,170,100,'At least one request or|limit, but not Guaranteed|(evicted in the middle)',0],[500,55,170,100,'No requests, no limits|(evicted first)',0]],
[]);

/* ---------- 0: Pods ---------- */
L['k8s:4:0']={blocks:[
{p:'A **Pod** is the smallest deployable unit in Kubernetes: one or more containers that share a network namespace (one IP, one set of ports) and can share volumes. Containers in a Pod are always scheduled together on the same node.'},
{code:`apiVersion: v1
kind: Pod
metadata:
  name: web
  labels:
    app: web
spec:
  restartPolicy: Always
  containers:
  - name: web
    image: nginx:1.27
    ports:
    - containerPort: 80`},
{p:'You rarely create bare Pods in production because a bare Pod is not replaced if its node fails. Controllers such as Deployments create Pods for you.'},
{svg:podlife},
{h:'Pod phases'},
{t:[['Phase','Meaning'],
['`Pending`','Accepted, but not yet running: waiting to be scheduled, pulling images, or init containers still running'],
['`Running`','Bound to a node and at least one container is running or starting'],
['`Succeeded`','All containers exited with code 0 and will not restart'],
['`Failed`','All containers terminated and at least one failed'],
['`Unknown`','The node cannot be contacted']]},
{p:'`kubectl get pods` also shows friendlier status text such as `CrashLoopBackOff`, `ImagePullBackOff` or `Completed`. These are container states and reasons, not phases. Pod **conditions** (`PodScheduled`, `Initialized`, `ContainersReady`, `Ready`) give more detail in `describe`.'},
{h:'Container states and restart policy'},
{ul:['Container states: `Waiting` (with a reason), `Running`, `Terminated` (with exit code and reason).','`restartPolicy`: `Always` (default; Deployments require it), `OnFailure` (Jobs) or `Never`.','Restarts use exponential backoff up to five minutes. That wait is what `CrashLoopBackOff` means.']},
{h:'Init containers'},
{p:'**Init containers** run one after another, each to completion, before the app containers start. Use them to wait for a dependency, fetch configuration, or prepare a volume.'},
{code:`spec:
  initContainers:
  - name: wait-for-db
    image: busybox:1.36
    command: ['sh','-c','until nc -z db 5432; do echo waiting; sleep 2; done']
  containers:
  - name: app
    image: myapp:2.1`},
{h:'Debugging a Pod that will not start'},
{code:`kubectl get pod web -o wide
kubectl describe pod web                  # Events at the bottom
kubectl logs web --previous               # last crashed run
kubectl get pod web -o jsonpath='{.status.containerStatuses[0].state}'`},
{t:[['Status','Typical cause'],['`ImagePullBackOff` / `ErrImagePull`','Wrong image name or tag, or missing registry credentials'],['`CrashLoopBackOff`','Application exits; read logs and exit code'],['`Pending` forever','Not schedulable: resources, taints, PVC not bound'],['`CreateContainerConfigError`','Missing ConfigMap or Secret referenced by the Pod'],['`OOMKilled` (exit 137)','Memory limit exceeded']]}],
src:[['Pods',W+'pods/'],['Pod Lifecycle',W+'pods/pod-lifecycle/'],['Init Containers',W+'pods/init-containers/']]};

/* ---------- 1: Multi-container and sidecars ---------- */
L['k8s:4:1']={blocks:[
{p:'Put several containers in one Pod only when they are **tightly coupled**: they must run together, scale together and share resources such as a volume or localhost.'},
{h:'Common patterns'},
{t:[['Pattern','Example'],
['**Sidecar**','A log shipper reading files the main container writes; a service mesh proxy'],
['**Adapter**','Converts the app output to a standard format, for example a metrics exporter'],
['**Ambassador**','A local proxy that handles connections to remote services on behalf of the app']]},
{h:'What the containers share'},
{ul:['**Network**: one IP; containers talk over `localhost` and cannot reuse the same port.','**Volumes**: mounted by name into any container that lists them.','**Lifecycle**: scheduled, started and deleted together.','CPU and memory are requested and limited **per container**, and added up for scheduling.']},
{code:`apiVersion: v1
kind: Pod
metadata:
  name: app-with-logger
spec:
  volumes:
  - name: logs
    emptyDir: {}
  containers:
  - name: app
    image: busybox:1.36
    command: ['sh','-c','while true; do date >> /var/log/app/out.log; sleep 2; done']
    volumeMounts:
    - {name: logs, mountPath: /var/log/app}
  - name: shipper
    image: busybox:1.36
    command: ['sh','-c','tail -F /var/log/app/out.log']
    volumeMounts:
    - {name: logs, mountPath: /var/log/app, readOnly: true}`},
{code:`kubectl logs app-with-logger -c shipper
kubectl exec -it app-with-logger -c app -- sh`},
{h:'The sidecar ordering problem and native sidecars'},
{p:'With ordinary containers there is no guarantee the proxy sidecar is ready before the app starts, and a Job cannot finish while a sidecar keeps running. **Native sidecar containers** solve both: declare the sidecar as an **init container with `restartPolicy: Always`**. It starts in order, before the app containers, keeps running alongside them, is not counted against Job completion, and is terminated after the main containers stop. This feature is stable in recent Kubernetes releases (GA in v1.33).'},
{code:`spec:
  initContainers:
  - name: proxy
    image: envoyproxy/envoy:v1.31-latest
    restartPolicy: Always          # makes this a native sidecar
    startupProbe:
      tcpSocket: {port: 9901}
  containers:
  - name: app
    image: myapp:2.1`},
{note:'Do not use multi-container Pods for things that merely talk to each other. A web server and its database belong in separate Pods so that each scales and fails independently.'}],
src:[['Sidecar Containers',W+'pods/sidecar-containers/'],['Multi-container Pod',T+'access-application-cluster/communicate-containers-same-pod-shared-volume/'],['Init Containers',W+'pods/init-containers/']]};

/* ---------- 2: Deployments ---------- */
L['k8s:4:2']={blocks:[
{p:'A **Deployment** manages stateless applications. It creates a **ReplicaSet**, which keeps the requested number of identical Pods running, and it performs controlled updates by creating new ReplicaSets.'},
{svg:rollout},
{code:`apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: web
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx:1.26
        readinessProbe:
          httpGet: {path: /, port: 80}`},
{h:'Rolling update parameters'},
{t:[['Setting','Meaning'],
['`maxSurge`','How many Pods above the desired count may exist during the update (number or %)'],
['`maxUnavailable`','How many Pods may be unavailable during the update'],
['`type: Recreate`','Stop all old Pods first, then start new ones (downtime, but no overlap)']]},
{p:'A rollout is triggered by any change to `spec.template`, such as a new image. Scaling does not trigger one.'},
{h:'Operate it'},
{code:`kubectl create deployment web --image=nginx:1.26 --replicas=3
kubectl set image deployment/web nginx=nginx:1.27      # container name = nginx here
kubectl rollout status deployment/web
kubectl rollout history deployment/web
kubectl rollout history deployment/web --revision=2

kubectl rollout undo deployment/web                    # back one revision
kubectl rollout undo deployment/web --to-revision=1

kubectl scale deployment/web --replicas=6
kubectl rollout pause deployment/web                   # batch several edits
kubectl rollout resume deployment/web
kubectl rollout restart deployment/web                 # recreate Pods (e.g. to pick up a ConfigMap)`},
{h:'How a stuck rollout looks'},
{ul:['New Pods never become Ready (bad image, failing readiness probe); old Pods keep serving because `maxUnavailable` protects them.','`kubectl rollout status` waits until `progressDeadlineSeconds` (600 s by default), then reports failure.','Inspect with `kubectl get rs`, `kubectl describe deployment web` and the events of the new Pods; then `rollout undo`.']},
{note:'Record why you changed something with the annotation `kubernetes.io/change-cause` so `rollout history` is readable. The old `--record` flag is deprecated.'}],
src:[['Deployments',W+'controllers/deployment/'],['ReplicaSet',W+'controllers/replicaset/'],['kubectl rollout',K.R+'kubectl/generated/kubectl_rollout/']]};

/* ---------- 3: DaemonSets and StatefulSets ---------- */
L['k8s:4:3']={blocks:[
{p:'Two controllers cover workloads that do not fit a plain Deployment.'},
{h:'DaemonSet: one Pod per node'},
{p:'A **DaemonSet** ensures a copy of a Pod runs on every node (or on a labeled subset). New nodes get a Pod automatically; removed nodes lose theirs. Typical use: CNI agents, `kube-proxy`, log collectors, node monitoring.'},
{code:`apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-agent
spec:
  selector:
    matchLabels: {app: node-agent}
  updateStrategy:
    type: RollingUpdate
    rollingUpdate: {maxUnavailable: 1}
  template:
    metadata:
      labels: {app: node-agent}
    spec:
      tolerations:                         # also run on control plane nodes
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      containers:
      - name: agent
        image: busybox:1.36
        command: ['sh','-c','sleep 1d']`},
{ul:['DaemonSet Pods ignore normal replica counts; there is no `replicas` field.','To limit nodes use `nodeSelector` or affinity in the Pod template.','Include tolerations when the Pod must also run on tainted nodes.']},
{h:'StatefulSet: stable identity and storage'},
{p:'A **StatefulSet** manages Pods that need a stable identity: ordered names, stable network names and their own persistent volume. Typical use: databases, Kafka, ZooKeeper, anything clustered with member identity.'},
{t:[['Property','Deployment','StatefulSet'],
['Pod names','Random suffix (`web-6d4-x2k`)','Ordinal (`db-0`, `db-1`, `db-2`)'],
['Start/stop order','Parallel','Ordered by default (0, then 1, then 2); reverse on scale down'],
['Network identity','Via Service only','Stable DNS per Pod through a **headless Service**: `db-0.db.default.svc`'],
['Storage','Shared or none','`volumeClaimTemplates` give each Pod its own PVC that survives rescheduling']]},
{code:`apiVersion: v1
kind: Service
metadata: {name: db}
spec:
  clusterIP: None            # headless
  selector: {app: db}
  ports: [{port: 5432}]
---
apiVersion: apps/v1
kind: StatefulSet
metadata: {name: db}
spec:
  serviceName: db
  replicas: 3
  selector:
    matchLabels: {app: db}
  template:
    metadata:
      labels: {app: db}
    spec:
      containers:
      - name: postgres
        image: postgres:17
        volumeMounts:
        - {name: data, mountPath: /var/lib/postgresql/data}
  volumeClaimTemplates:
  - metadata: {name: data}
    spec:
      accessModes: [ReadWriteOnce]
      resources:
        requests: {storage: 10Gi}`},
{note:'Deleting a StatefulSet does not delete its PersistentVolumeClaims by default. That protects data, but it also means leftover volumes keep costing money. Section 8 covers the retention policy.'}],
src:[['DaemonSet',W+'controllers/daemonset/'],['StatefulSets',W+'controllers/statefulset/'],['Headless Services',C+'services-networking/service/#headless-services']]};

/* ---------- 4: Jobs and CronJobs ---------- */
L['k8s:4:4']={blocks:[
{p:'Deployments run things forever. **Jobs** run things **to completion**, and **CronJobs** run Jobs on a schedule.'},
{h:'Job'},
{code:`apiVersion: batch/v1
kind: Job
metadata:
  name: report
spec:
  completions: 5          # total successful Pods needed
  parallelism: 2          # how many run at once
  backoffLimit: 3         # retries before the Job is marked failed
  activeDeadlineSeconds: 600
  ttlSecondsAfterFinished: 3600   # auto-clean finished Job
  template:
    spec:
      restartPolicy: Never       # Jobs require Never or OnFailure
      containers:
      - name: report
        image: busybox:1.36
        command: ['sh','-c','echo processing; sleep 5']`},
{t:[['Field','Effect'],
['`completions`','Number of successful Pod completions required (default 1)'],
['`parallelism`','Maximum Pods running in parallel (default 1)'],
['`backoffLimit`','Failed retries before giving up (default 6)'],
['`activeDeadlineSeconds`','Hard time limit for the whole Job'],
['`ttlSecondsAfterFinished`','Delete the Job and its Pods after it finishes']]},
{code:`kubectl create job once --image=busybox:1.36 -- sh -c "date"
kubectl get jobs
kubectl logs job/once
kubectl delete job once`},
{h:'CronJob'},
{p:'A CronJob creates a Job at each scheduled time using standard five-field cron syntax (minute, hour, day of month, month, day of week).'},
{code:`apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly
spec:
  schedule: "0 2 * * *"            # 02:00 every day
  timeZone: "Etc/UTC"
  concurrencyPolicy: Forbid        # Allow | Forbid | Replace
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  startingDeadlineSeconds: 300
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: backup
            image: busybox:1.36
            command: ['sh','-c','echo backup done']`},
{code:`kubectl create cronjob nightly --image=busybox:1.36 --schedule="*/5 * * * *" -- date
kubectl get cronjob
kubectl create job manual-run --from=cronjob/nightly       # run it now
kubectl patch cronjob nightly -p '{"spec":{"suspend":true}}'`},
{h:'Concurrency policy'},
{ul:['`Allow`: overlapping runs are fine.','`Forbid`: skip the new run if the previous is still going.','`Replace`: stop the old run and start the new one.']},
{note:'A CronJob that misses too many schedules because the controller was down (more than 100) stops scheduling. Set `startingDeadlineSeconds` to bound how late a missed run may start.'}],
src:[['Jobs',W+'controllers/job/'],['CronJob',W+'controllers/cron-jobs/'],['Automatic cleanup for finished Jobs',W+'controllers/ttlafterfinished/']]};

/* ---------- 5: ConfigMaps and Secrets ---------- */
L['k8s:4:5']={blocks:[
{p:'Keep configuration out of images. A **ConfigMap** holds non-confidential settings; a **Secret** holds sensitive values such as passwords and tokens. Both are namespaced objects consumed by Pods.'},
{h:'Create them'},
{code:`kubectl create configmap app-config --from-literal=LOG_LEVEL=info --from-file=app.properties
kubectl create secret generic db-cred --from-literal=username=app --from-literal=password='S3cr3t!'
kubectl create secret docker-registry regcred \\
  --docker-server=registry.example.com --docker-username=u --docker-password=p
kubectl create secret tls web-tls --cert=tls.crt --key=tls.key

kubectl get configmap app-config -o yaml
kubectl get secret db-cred -o jsonpath='{.data.password}' | base64 -d`},
{h:'Consume them'},
{code:`apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  imagePullSecrets:
  - name: regcred
  containers:
  - name: app
    image: registry.example.com/app:1.0
    envFrom:
    - configMapRef: {name: app-config}            # all keys as env vars
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef: {name: db-cred, key: password}
    volumeMounts:
    - {name: cfg, mountPath: /etc/app}
    - {name: creds, mountPath: /etc/creds, readOnly: true}
  volumes:
  - name: cfg
    configMap: {name: app-config}                  # each key becomes a file
  - name: creds
    secret: {secretName: db-cred}`},
{h:'How updates propagate'},
{t:[['Consumed as','When the ConfigMap or Secret changes'],
['Environment variable','**Not updated**. Restart the Pod (for example `kubectl rollout restart`).'],
['Mounted volume','Files are updated eventually (kubelet sync, up to about a minute); the app must re-read them'],
['Volume with `subPath`','**Not updated**']]},
{ul:['Mark objects `immutable: true` to protect against accidental edits and reduce API server load. To change them, create a new one and roll out.','A missing ConfigMap or Secret referenced by a Pod gives `CreateContainerConfigError`.','ConfigMaps and Secrets are limited to about 1 MiB.']},
{h:'What Secrets do and do not protect'},
{ul:['Values are only **base64 encoded** in etcd by default. That is not encryption.','Anyone allowed to `get secrets` (or create a Pod in the namespace) can read them. Restrict this with RBAC.','Enable **encryption at rest** for the API server, or use an external secret manager (Section 10).','Avoid environment variables for very sensitive secrets: they appear in process listings and crash dumps; mounted files are easier to protect.']},
{note:'Never commit Secret YAML to Git. Use sealed secrets, SOPS or an external secrets operator for GitOps workflows.'}],
src:[['ConfigMaps',C+'configuration/configmap/'],['Secrets',C+'configuration/secret/'],['Good practices for Kubernetes Secrets',C+'security/secrets-good-practices/']]};

/* ---------- 6: Requests, limits, QoS ---------- */
L['k8s:4:6']={blocks:[
{p:'Resource settings tell Kubernetes how much a container needs and how much it may use. They drive **scheduling**, **enforcement** and **eviction order**.'},
{t:[['Setting','Used by','Meaning'],
['`requests`','Scheduler','The amount reserved for the container. A Pod is placed only on a node with enough unreserved capacity.'],
['`limits`','Kubelet + kernel','The maximum. CPU over the limit is throttled; memory over the limit gets the container OOM-killed.']]},
{code:`spec:
  containers:
  - name: app
    image: myapp:2.1
    resources:
      requests:
        cpu: 250m          # 0.25 core
        memory: 256Mi
        ephemeral-storage: 1Gi
      limits:
        memory: 512Mi      # CPU limit deliberately omitted (see below)`},
{ul:['CPU: `1` = one core, `500m` = half a core (millicores).','Memory: `Mi` and `Gi` are binary units; `M` and `G` are decimal. `512M` and `512Mi` differ.','CPU is **compressible** (throttling); memory is **incompressible** (kill).']},
{h:'QoS classes'},
{svg:qos},
{t:[['Class','Rule'],
['**Guaranteed**','Every container has CPU and memory requests equal to limits'],
['**Burstable**','At least one request or limit set, but not Guaranteed'],
['**BestEffort**','No requests or limits at all']]},
{p:'When a node runs short of memory, the kubelet evicts BestEffort Pods first, then Burstable Pods exceeding their requests, and Guaranteed Pods last. The class appears as `status.qosClass`.'},
{code:`kubectl get pod app -o jsonpath='{.status.qosClass}'
kubectl describe node w1 | sed -n '/Allocated resources/,/Events/p'
kubectl top pod --containers          # needs metrics-server`},
{h:'Guardrails per namespace'},
{code:`apiVersion: v1
kind: LimitRange
metadata: {name: defaults, namespace: dev}
spec:
  limits:
  - type: Container
    default: {cpu: 500m, memory: 256Mi}
    defaultRequest: {cpu: 100m, memory: 128Mi}
---
apiVersion: v1
kind: ResourceQuota
metadata: {name: team-quota, namespace: dev}
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.memory: 16Gi
    pods: "30"`},
{ul:['**LimitRange** sets defaults and min/max per container.','**ResourceQuota** caps total consumption in a namespace. Once a quota covers CPU or memory, Pods must declare them or they are rejected.','Common failures: Pending with `Insufficient cpu`, exit code 137 / `OOMKilled`, or heavy latency from CPU throttling when limits are too low.']},
{note:'Setting requests too high wastes money; too low causes noisy neighbours. Measure real usage and revisit. Many teams set memory request = limit and leave CPU limits unset to avoid throttling.'}],
src:[['Resource Management for Pods and Containers',C+'configuration/manage-resources-containers/'],['Pod Quality of Service Classes',C+'workloads/pods/pod-qos/'],['Resource Quotas',C+'policy/resource-quotas/']]};

/* ---------- 7: Probes ---------- */
L['k8s:4:7']={blocks:[
{p:'**Probes** let the kubelet ask the application whether it is healthy. Each probe answers a different question, and mixing them up is a leading cause of self-inflicted outages.'},
{t:[['Probe','Question','If it fails'],
['**startup**','Has the app finished starting?','Container is killed and restarted. Other probes are disabled until it succeeds.'],
['**liveness**','Is the app stuck beyond recovery?','Container is **restarted**'],
['**readiness**','Can it serve traffic now?','Pod is **removed from Service endpoints** (not restarted)']]},
{h:'Probe mechanisms'},
{ul:['`httpGet`: success is a status code from 200 to 399.','`tcpSocket`: success when the port accepts a connection.','`exec`: success when the command exits 0.','`grpc`: uses the gRPC health checking protocol.']},
{code:`containers:
- name: web
  image: myapp:2.1
  startupProbe:
    httpGet: {path: /healthz, port: 8080}
    failureThreshold: 30        # up to 30 x 10 s = 5 min to start
    periodSeconds: 10
  livenessProbe:
    httpGet: {path: /healthz, port: 8080}
    periodSeconds: 10
    timeoutSeconds: 2
    failureThreshold: 3
  readinessProbe:
    httpGet: {path: /ready, port: 8080}
    periodSeconds: 5
    successThreshold: 1`},
{t:[['Field','Default','Meaning'],['`initialDelaySeconds`','0','Wait before the first probe'],['`periodSeconds`','10','Interval'],['`timeoutSeconds`','1','Probe timeout'],['`failureThreshold`','3','Consecutive failures before acting'],['`successThreshold`','1','Consecutive successes to recover (must be 1 for liveness/startup)']]},
{h:'Common mistakes'},
{ul:['**Liveness probe that checks a dependency** (database). When the database is down, every Pod restarts at once and the outage gets worse. Liveness should check only the process itself.','**Liveness without a startup probe** on a slow-starting app: the app is killed before it ever finishes starting. Use a startup probe.','**No readiness probe**: traffic reaches Pods that are not ready, and rolling updates cannot tell good Pods from bad ones.','Timeouts too short under load, causing restarts that add more load.']},
{code:`kubectl describe pod web | grep -A3 -E "Liveness|Readiness|Startup"
kubectl get events --field-selector involvedObject.name=web
# "Liveness probe failed: HTTP probe failed with statuscode: 500" appears in events`},
{note:'Readiness is also what makes rolling updates safe: a new Pod only counts as available once its readiness probe passes. A bad readiness probe will stall a rollout, which is the intended protection.'}],
src:[['Liveness, Readiness, and Startup Probes',C+'configuration/liveness-readiness-startup-probes/'],['Configure Probes',T+'configure-pod-container/configure-liveness-readiness-startup-probes/']]};

/* ---------- 8: Practical ---------- */
L['k8s:4:8']={blocks:[
{p:'This lab ties the section together. You will deploy an app, release a bad update, diagnose why the rollout stalls and roll back. Use a throwaway namespace.'},
{flow:['Create namespace and Deployment with probes','Expose it with a Service and verify','Update to a broken image','Observe the stalled rollout','Diagnose with describe, events and logs','Roll back and verify','Clean up']},
{h:'1. Deploy'},
{code:`kubectl create namespace lab
kubectl -n lab create deployment web --image=nginx:1.26 --replicas=3 \\
  --dry-run=client -o yaml > web.yaml

# Edit web.yaml: add a readinessProbe to the container
#   readinessProbe:
#     httpGet: {path: /, port: 80}
#     periodSeconds: 3
kubectl apply -f web.yaml
kubectl -n lab expose deployment web --port=80
kubectl -n lab rollout status deployment/web
kubectl -n lab get pods -o wide`},
{h:'2. Break it on purpose'},
{code:`kubectl -n lab set image deployment/web nginx=nginx:does-not-exist
kubectl -n lab rollout status deployment/web --timeout=30s`},
{h:'3. Diagnose'},
{code:`kubectl -n lab get pods                      # new Pod: ImagePullBackOff, old Pods still Running
kubectl -n lab get rs                        # old RS keeps 2-3, new RS has 1 not ready
kubectl -n lab describe pod -l app=web | grep -A6 Events
kubectl -n lab describe deployment web | grep -A4 Conditions`},
{p:'Notice what the rolling update protected: because the new Pod never became Ready and `maxUnavailable` is limited, most old Pods keep serving. The Service still answers while the rollout is stuck.'},
{h:'4. Roll back'},
{code:`kubectl -n lab rollout history deployment/web
kubectl -n lab rollout undo deployment/web
kubectl -n lab rollout status deployment/web
kubectl -n lab get pods
kubectl -n lab get deploy web -o jsonpath='{.spec.template.spec.containers[0].image}'`},
{h:'5. Try variations'},
{ul:['Break the readiness path instead (`/nope`) and watch Pods run but stay NotReady.','Set a memory limit of `4Mi` and watch `OOMKilled` restarts.','Scale to 0, then back, and see Service endpoints change: `kubectl -n lab get endpointslices`.']},
{h:'6. Clean up'},
{code:`kubectl delete namespace lab        # removes everything created in it`},
{note:'In the exam, speed comes from reading Events first. Most workload faults tell you what is wrong in the Events section of `kubectl describe`.'}],
src:[['Deployments',W+'controllers/deployment/'],['Debug Pods',T+'debug/debug-application/debug-pods/'],['Debug Running Pods',T+'debug/debug-application/debug-running-pod/']]};
})();
