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
{p:'The **Pod** is the smallest thing Kubernetes schedules. Everything else in this section (Deployments, Jobs, StatefulSets) exists to create and manage Pods. If you understand exactly what a Pod is and how it moves through its lifecycle, almost every workload problem becomes readable.'},
{h:'What a Pod actually is'},
{p:'A Pod is a group of one or more containers that are **always scheduled together onto the same node** and share certain Linux namespaces: they have one IP address and one set of ports (the network namespace), they can share volumes, and they can optionally share the process namespace. Inside a Pod, containers talk to each other over `localhost`. Pods are **ephemeral**: they are created, they run, they are replaced, and they are never repaired in place. A new Pod gets a new name, a new IP and a fresh filesystem.'},
{code:`apiVersion: v1
kind: Pod
metadata:
  name: web
  labels:
    app: web
spec:
  restartPolicy: Always          # Always (default), OnFailure, Never
  containers:
  - name: web
    image: nginx:1.27
    ports:
    - containerPort: 80          # documentation only: does not open or close anything`},
{p:'You rarely create bare Pods in production. A bare Pod is not replaced if its node fails or if it is deleted. Controllers such as Deployments and Jobs create Pods from a **template** and keep the right number running.'},
{svg:podlife},
{h:'The lifecycle step by step'},
{flow:['You create the Pod (or a controller does); the API server stores it','The scheduler assigns a node (PodScheduled = True)','The kubelet pulls images, mounts volumes, creates the network sandbox','Init containers run one after another to completion (Initialized = True)','App containers start; startup, liveness and readiness probes begin','When readiness passes the Pod becomes Ready and joins Service endpoints','On delete: removed from endpoints, preStop hook, SIGTERM, grace period, SIGKILL']},
{h:'Phase, state, condition: three different things'},
{t:[['Concept','Level','Values','What it tells you'],
['**Phase**','Pod','`Pending`, `Running`, `Succeeded`, `Failed`, `Unknown`','Coarse summary of where the Pod is'],
['**Container state**','Each container','`Waiting` (with reason), `Running`, `Terminated` (with exit code)','What each container is doing right now'],
['**Conditions**','Pod','`PodScheduled`, `Initialized`, `ContainersReady`, `Ready`','Which stage has completed']]},
{p:'The text in the STATUS column of `kubectl get pods` (CrashLoopBackOff, ImagePullBackOff, Completed, Terminating) is **not a phase**. It is computed from container states and reasons. That is why a Pod with phase `Running` can show `CrashLoopBackOff`.'},
{h:'Restart policy and restart delay'},
{t:[['restartPolicy','Behaviour','Used by'],
['`Always` (default)','Restart whenever a container exits, even with code 0','Deployments, StatefulSets, DaemonSets (they require it)'],
['`OnFailure`','Restart only on non-zero exit','Jobs'],
['`Never`','Never restart','Jobs, one-shot debugging Pods']]},
{p:'The kubelet restarts a failing container with an **exponential delay** (10 seconds, 20, 40 and so on) capped at **five minutes**, and the delay resets after the container has run successfully for ten minutes. `CrashLoopBackOff` is the name of the waiting period between those restarts. Restart policy applies to containers **inside the Pod on the same node**: the Pod itself is never moved.'},
{h:'Init containers'},
{p:'**Init containers** run before any app container, strictly one at a time, and each must exit successfully before the next starts. If one fails, the kubelet retries it according to the restart policy, and the app containers never start. Use them for ordered preparation: wait for a dependency, run a database migration, fetch configuration, set file permissions on a volume.'},
{code:`spec:
  initContainers:
  - name: wait-for-db
    image: busybox:1.36
    command: ['sh','-c','until nc -z db 5432; do echo waiting for db; sleep 2; done']
  - name: fix-perms
    image: busybox:1.36
    command: ['sh','-c','chown -R 1000:1000 /data']
    volumeMounts: [{name: data, mountPath: /data}]
  containers:
  - name: app
    image: myapp:2.1
    volumeMounts: [{name: data, mountPath: /data}]
  volumes:
  - name: data
    emptyDir: {}`},
{ul:['Init containers can use a **different image** with tools the app image does not have, which keeps the app image small.','Their resource requests count differently: the scheduler uses the larger of the biggest init container and the sum of the app containers.','Status shows progress as `Init:0/2`, `Init:1/2`, then `PodInitializing`.']},
{h:'Reading a Pod in practice'},
{code:`$ kubectl get pod web -o wide
NAME   READY   STATUS    RESTARTS   AGE   IP            NODE
web    1/1     Running   0          2m    10.244.1.14   worker1

$ kubectl get pod web -o jsonpath='{.status.phase}{"  "}{.status.qosClass}{"\\n"}'
Running  BestEffort
$ kubectl get pod web -o jsonpath='{range .status.conditions[*]}{.type}={.status}{" "}{end}{"\\n"}'
PodReadyToStartContainers=True Initialized=True Ready=True ContainersReady=True PodScheduled=True`},
{h:'Common mistakes'},
{t:[['Mistake','What happens','Better'],
['Running a bare Pod for something important','Node failure or deletion loses it for good','Use a Deployment, StatefulSet or Job'],
['Relying on a Pod IP','The IP changes on every recreation','Use a Service name'],
['Putting a one-time task in the app container','Runs on every restart','Use an init container or a Job'],
['Assuming `containerPort` opens a port','It is documentation; the app must listen','Check the app binds `0.0.0.0` and the right port'],
['Using `restartPolicy: Always` for a finite task','The task restarts forever after finishing','Use a Job with `OnFailure` or `Never`']]},
{note:'Exam tip: `kubectl run NAME --image=IMAGE --dry-run=client -o yaml` generates a correct Pod manifest in one second. Add `--command -- sleep 3600` for a Pod that stays alive for testing.'}],
src:[['Pods',W+'pods/'],['Pod Lifecycle',W+'pods/pod-lifecycle/'],['Init Containers',W+'pods/init-containers/']]};

/* ---------- 1: Multi-container and sidecars ---------- */
L['k8s:4:1']={blocks:[
{p:'A Pod can hold more than one container. That is powerful when used for the right reason and a mistake when used as a shortcut. The rule: put containers in the same Pod only when they must **share a lifecycle, a network identity or files** and cannot sensibly run on different nodes.'},
{h:'What containers in one Pod share'},
{t:[['Resource','Shared?','Consequence'],
['Network (IP and ports)','Yes','They reach each other on `localhost`; two containers cannot listen on the same port'],
['Volumes','Only if both mount them','A common way to exchange files'],
['Process namespace','Only with `shareProcessNamespace: true`','One container can see and signal the others processes'],
['Filesystem root','No','Each container has its own image filesystem'],
['CPU and memory','Requested and limited **per container**','The scheduler sums them for placement'],
['Lifecycle','Scheduled, started and deleted together','One node, one Pod; they cannot be split across nodes']]},
{h:'The common patterns'},
{t:[['Pattern','Role','Example'],
['**Sidecar**','Extends the main container with a supporting function','Log shipper reading the app log files; service mesh proxy; certificate refresher'],
['**Adapter**','Translates the app output to a standard format','A metrics exporter turning custom stats into Prometheus format'],
['**Ambassador**','Proxies the app connections to the outside','A local proxy that handles sharding or credentials to a remote database']]},
{h:'A worked example: app plus log shipper'},
{code:`apiVersion: v1
kind: Pod
metadata: {name: app-with-logger}
spec:
  volumes:
  - name: logs
    emptyDir: {}
  containers:
  - name: app
    image: busybox:1.36
    command: ['sh','-c','while true; do date >> /var/log/app/out.log; sleep 2; done']
    volumeMounts: [{name: logs, mountPath: /var/log/app}]
  - name: shipper
    image: busybox:1.36
    command: ['sh','-c','tail -F /var/log/app/out.log']
    volumeMounts: [{name: logs, mountPath: /var/log/app, readOnly: true}]`},
{code:`$ kubectl get pod app-with-logger
NAME              READY   STATUS    RESTARTS   AGE
app-with-logger   2/2     Running   0          20s          # 2/2: two containers, both Ready

$ kubectl logs app-with-logger -c shipper --tail=2
Fri Oct  9 10:21:40 UTC 2026
Fri Oct  9 10:21:42 UTC 2026
$ kubectl exec -it app-with-logger -c app -- sh               # -c picks the container`},
{p:'READY `2/2` means two of two containers are ready; the Pod is only Ready (and only receives traffic) when **all** containers are ready. A failing sidecar can therefore take the whole Pod out of service.'},
{h:'The ordering problem and native sidecars'},
{p:'With ordinary containers there is **no start-up order and no shutdown order**. A proxy sidecar may not be ready when the app starts making calls, and on shutdown the proxy may die before the app finishes. Jobs have a worse problem: a sidecar that never exits keeps the Job from completing.'},
{p:'**Native sidecar containers** fix this. Declare the sidecar in `initContainers` with `restartPolicy: Always`. It starts in order (before the app containers, and the next init container waits until it has started), keeps running next to the app, is restarted if it fails, is **not** counted against Job completion, and is terminated after the main containers stop. This feature is stable in recent Kubernetes releases (GA in v1.33).'},
{code:`spec:
  initContainers:
  - name: proxy
    image: envoyproxy/envoy:v1.31-latest
    restartPolicy: Always            # this line makes it a native sidecar
    startupProbe:
      tcpSocket: {port: 9901}        # the next container waits for this probe to pass
  containers:
  - name: app
    image: myapp:2.1`},
{t:[['','Ordinary extra container','Native sidecar'],
['Starts before the app','Not guaranteed','Yes, and can have a startup probe gating the app'],
['Stops after the app','Not guaranteed','Yes'],
['Works with Jobs','Job never completes if it keeps running','Yes, ignored for completion'],
['Restarted on failure','Per Pod restartPolicy','Per its own restart policy (Always)']]},
{h:'Resources and failure behaviour'},
{ul:['Give **each container** its own requests and limits; the sidecar can be starved or can starve the app.','If one container crash-loops, the Pod shows `1/2 Ready` and `CrashLoopBackOff`; use `kubectl logs -c` to find which.','Scaling is per **Pod**, so a sidecar scales with the app whether or not it needs to: that is why heavy helpers should not be sidecars.','Per-Pod sidecars (for example one proxy per Pod) multiply cost on large clusters.']},
{h:'Common mistakes'},
{t:[['Mistake','Why it hurts','Better'],
['App and database in one Pod','Cannot scale or restart independently; data tied to the app lifecycle','Separate Pods with a Service between them'],
['Two containers binding the same port','The second one fails to start','Use different ports'],
['Forgetting `-c` when reading logs','Wrong container or an error asking which container','Always name the container'],
['Sidecar with no resource requests','Can consume the node and evict neighbours','Set requests and limits'],
['Using a plain container as a sidecar for a Job','The Job never finishes','Use a native sidecar']]},
{note:'Ask the design question: "must these two things run on the same machine at the same time?" If not, they are separate Pods.'}],
src:[['Sidecar Containers',W+'pods/sidecar-containers/'],['Communicate Between Containers in the Same Pod',T+'access-application-cluster/communicate-containers-same-pod-shared-volume/'],['Init Containers',W+'pods/init-containers/']]};

/* ---------- 2: Deployments ---------- */
L['k8s:4:2']={blocks:[
{p:'A **Deployment** is how you run a stateless application: a fixed number of identical, interchangeable Pods that can be updated without downtime and rolled back when an update goes wrong. It is the most used workload object, so the mechanics are worth understanding in detail.'},
{h:'Three layers: Deployment, ReplicaSet, Pod'},
{svg:rollout},
{p:'A Deployment does not create Pods directly. It creates a **ReplicaSet** for each version of the Pod template; the ReplicaSet creates the Pods and keeps the count right. During an update the Deployment creates a new ReplicaSet and gradually moves replicas from the old one to the new one. Old ReplicaSets are kept (scaled to zero) so you can roll back.'},
{code:`apiVersion: apps/v1
kind: Deployment
metadata: {name: web}
spec:
  replicas: 3
  revisionHistoryLimit: 5           # old ReplicaSets kept for rollback (default 10)
  progressDeadlineSeconds: 600      # report failure if no progress for 10 minutes (default)
  minReadySeconds: 5                # a new Pod must be Ready this long to count as available
  selector:
    matchLabels: {app: web}         # must match the template labels; immutable after creation
  strategy:
    type: RollingUpdate
    rollingUpdate: {maxSurge: 25%, maxUnavailable: 25%}
  template:
    metadata:
      labels: {app: web}
    spec:
      containers:
      - name: web
        image: nginx:1.26
        readinessProbe: {httpGet: {path: /, port: 80}}`},
{h:'How a rolling update proceeds'},
{p:'A rollout starts whenever the **Pod template** changes (new image, new env, new resources). Scaling does not trigger one. With 4 replicas, `maxSurge: 1` and `maxUnavailable: 1`, the Deployment may run up to 5 Pods in total and must keep at least 3 available:'},
{t:[['Step','Old Pods','New Pods','Total','Available'],
['Start','4','0','4','4'],
['1: create one new, stop one old','3','1 (starting)','4','3'],
['2: new one becomes Ready','3','1','4','4'],
['3: create another new, stop another old','2','2 (one starting)','4','3'],
['...','...','...','...','...'],
['End','0','4','4','4']]},
{ul:['**maxSurge**: how many Pods **above** the desired count may exist during the update (number or percent).','**maxUnavailable**: how many Pods may be **below** the desired count.','A new Pod only counts as **available** after its readiness probe passes (and `minReadySeconds`). Without a readiness probe, "Ready" means "the process started", and a broken version replaces good Pods.','`strategy: Recreate` stops all old Pods first, then starts new ones: downtime, but never two versions at once.']},
{h:'Operating a Deployment'},
{code:`kubectl create deployment web --image=nginx:1.26 --replicas=3
kubectl set image deployment/web nginx=nginx:1.27        # the container name here is "nginx"
kubectl rollout status deployment/web                    # waits and reports progress
kubectl rollout history deployment/web
kubectl rollout history deployment/web --revision=2      # see what changed in a revision
kubectl rollout undo deployment/web                      # back one revision
kubectl rollout undo deployment/web --to-revision=1
kubectl scale deployment/web --replicas=6                # no new ReplicaSet
kubectl rollout pause deployment/web                     # batch several changes
kubectl set resources deployment/web --requests=cpu=100m
kubectl rollout resume deployment/web                    # one rollout for all the changes
kubectl rollout restart deployment/web                   # recreate Pods without changing the spec`},
{code:`$ kubectl rollout status deployment/web
Waiting for deployment "web" rollout to finish: 1 out of 3 new replicas have been updated...
Waiting for deployment "web" rollout to finish: 2 old replicas are pending termination...
deployment "web" successfully rolled out

$ kubectl get rs -l app=web
NAME             DESIRED   CURRENT   READY   AGE
web-6d4f8b7c9    0         0         0       2h        # old version, kept for rollback
web-8f5c6d4b2    3         3         3       4m        # new version`},
{h:'A stuck rollout and how to read it'},
{code:`$ kubectl set image deployment/web nginx=nginx:does-not-exist
$ kubectl get pods
NAME                   READY   STATUS             RESTARTS   AGE
web-6d4f8b7c9-4xk2p    1/1     Running            0          2h      # old Pods keep serving
web-6d4f8b7c9-9tq8z    1/1     Running            0          2h
web-8f5c6d4b2-xk9ql    0/1     ImagePullBackOff   0          40s     # one new Pod is stuck
$ kubectl rollout status deployment/web --timeout=30s
error: timed out waiting for the condition
$ kubectl describe deployment web | grep -A3 Conditions
  Progressing   False   ProgressDeadlineExceeded         # after progressDeadlineSeconds
$ kubectl rollout undo deployment/web`},
{p:'Notice what the strategy protected: because the new Pod never became Ready, the Deployment did not retire more old Pods, so **the application stayed available**. The Deployment does not roll back automatically; it reports failure and waits for you.'},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['No readiness probe','A bad version gets traffic and replaces good Pods','Always define readiness'],
['Using `latest` or a reused tag','`rollout undo` and debugging become guesswork; nodes may run different content','Unique version tags or digests'],
['Editing live objects with `kubectl edit` and `apply` both','The manifest in Git and the cluster diverge','Pick one source of truth'],
['Changing the selector','Immutable; the old ReplicaSet is orphaned','Create a new Deployment'],
['`maxUnavailable: 0` and `maxSurge: 0`','Rollout can never progress','Allow at least one'],
['Forgetting `revisionHistoryLimit`','Dozens of old ReplicaSets clutter and slow listing','Set a small limit']]},
{note:'Record why you changed something with the annotation `kubernetes.io/change-cause`; it appears in `rollout history`. The old `--record` flag is deprecated.'}],
src:[['Deployments',W+'controllers/deployment/'],['ReplicaSet',W+'controllers/replicaset/'],['kubectl rollout',K.R+'kubectl/generated/kubectl_rollout/']]};

/* ---------- 3: DaemonSets and StatefulSets ---------- */
L['k8s:4:3']={blocks:[
{p:'A Deployment treats all Pods as identical and interchangeable. Two kinds of workload break that assumption: those that must run **on every node** (agents), and those where each Pod has its **own identity and its own data** (databases and clustered systems). Kubernetes has a controller for each.'},
{h:'DaemonSet: one Pod per node'},
{p:'A **DaemonSet** ensures exactly one copy of a Pod on every node, or on a chosen subset. When a node joins, a Pod appears on it; when a node leaves, its Pod is garbage collected. There is no `replicas` field: the node count decides.'},
{t:[['Typical DaemonSet','Why it must run on every node'],
['CNI agent, kube-proxy','Networking for Pods on that node'],
['Log collector (Fluent Bit)','Reads container logs from the node'],
['Node exporter, monitoring agent','Measures that node'],
['CSI node plugin','Mounts volumes on that node'],
['Security agent (Falco)','Watches the node kernel']]},
{code:`apiVersion: apps/v1
kind: DaemonSet
metadata: {name: node-agent, namespace: monitoring}
spec:
  selector:
    matchLabels: {app: node-agent}
  updateStrategy:
    type: RollingUpdate
    rollingUpdate: {maxUnavailable: 1}      # update one node at a time
  template:
    metadata: {labels: {app: node-agent}}
    spec:
      tolerations:                          # also run on control plane nodes
      - {key: node-role.kubernetes.io/control-plane, operator: Exists, effect: NoSchedule}
      containers:
      - name: agent
        image: busybox:1.36
        command: ['sh','-c','sleep 1d']
        resources: {requests: {cpu: 50m, memory: 64Mi}}`},
{ul:['To run on only some nodes use `nodeSelector` or affinity in the template; otherwise it runs everywhere it can.','Add **tolerations** if the agent must also run on tainted nodes (control plane, dedicated nodes). Many system DaemonSets tolerate everything.','`kubectl get ds` shows DESIRED, CURRENT, READY per node count. If DESIRED is less than the node count, taints or selectors exclude some nodes.']},
{h:'StatefulSet: stable identity and storage'},
{p:'A **StatefulSet** manages Pods that must keep an identity across restarts. Each Pod has a **stable name** with an ordinal (`db-0`, `db-1`, `db-2`), a **stable DNS name**, and its **own PersistentVolumeClaim** that follows it. If `db-1` is rescheduled to another node it comes back as `db-1` and reattaches the same volume.'},
{t:[['Property','Deployment','StatefulSet'],
['Pod names','Random suffix (`web-6d4-x2k`)','Ordinal (`db-0`, `db-1`, `db-2`)'],
['Create and delete order','All at once','In order 0, 1, 2 (and reverse on scale down) by default'],
['Network identity','Only through a Service','Stable DNS per Pod via a **headless Service**: `db-0.db.shop.svc.cluster.local`'],
['Storage','Shared or none','Per-Pod PVC from `volumeClaimTemplates`, kept when Pods are deleted'],
['Replacement','A new random Pod','The same ordinal, same volume'],
['Good for','Stateless apps','Databases, Kafka, ZooKeeper, anything with membership']]},
{code:`apiVersion: v1
kind: Service
metadata: {name: db, namespace: shop}
spec:
  clusterIP: None              # headless: DNS returns Pod IPs, gives each Pod its own record
  selector: {app: db}
  ports: [{port: 5432}]
---
apiVersion: apps/v1
kind: StatefulSet
metadata: {name: db, namespace: shop}
spec:
  serviceName: db              # must point at the headless Service
  replicas: 3
  selector: {matchLabels: {app: db}}
  template:
    metadata: {labels: {app: db}}
    spec:
      containers:
      - name: postgres
        image: postgres:17
        volumeMounts: [{name: data, mountPath: /var/lib/postgresql/data}]
  volumeClaimTemplates:
  - metadata: {name: data}
    spec:
      accessModes: [ReadWriteOnce]
      resources: {requests: {storage: 10Gi}}`},
{code:`$ kubectl get pods,pvc -n shop
NAME       READY   STATUS    AGE
pod/db-0   1/1     Running   3m
pod/db-1   1/1     Running   2m
pod/db-2   1/1     Running   1m                    # created in order: each waits for the previous to be Ready
NAME                         STATUS   VOLUME     CAPACITY
persistentvolumeclaim/data-db-0   Bound   pvc-a1     10Gi      # one PVC per Pod, named <template>-<pod>
persistentvolumeclaim/data-db-1   Bound   pvc-b2     10Gi
persistentvolumeclaim/data-db-2   Bound   pvc-c3     10Gi
$ kubectl exec -it db-0 -n shop -- nslookup db-1.db     # stable per-Pod DNS name`},
{h:'What happens on failure'},
{ul:['**Pod deleted or crashed**: recreated with the same name and the same PVC.','**Node lost**: the StatefulSet does **not** create a replacement while it cannot be sure the old Pod is gone (to avoid two writers on one volume); fix the node or delete the Node object.','**StatefulSet deleted**: the PVCs are **kept** by default, so data survives; remove them deliberately when you are done (and watch the storage cost).','**Scale down**: highest ordinal removed first; its PVC stays and is reused if you scale back up.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Using a Deployment for a database','Random names and a shared volume; data corruption risk','StatefulSet (or a database operator)'],
['Forgetting the headless Service or a wrong `serviceName`','No stable DNS names','Create it and match `serviceName`'],
['Assuming a StatefulSet gives you replication','It only gives identity and storage; the database must replicate itself','Configure replication in the application or use an operator'],
['DaemonSet without tolerations','Missing on tainted nodes (gaps in monitoring)','Add the right tolerations'],
['Deleting a StatefulSet and expecting storage to be freed','PVCs and disks remain','Delete the PVCs after confirming backups']]},
{note:'A StatefulSet makes **running** stateful software possible. It does not make it **safe**: you still need backups, tested restores and a way to replace members. For complex databases prefer a mature operator.'}],
src:[['DaemonSet',W+'controllers/daemonset/'],['StatefulSets',W+'controllers/statefulset/'],['Headless Services',K.C+'services-networking/service/#headless-services']]};

/* ---------- 4: Jobs and CronJobs ---------- */
L['k8s:4:4']={blocks:[
{p:'A Deployment is for things that run forever. A **Job** runs something **to completion** and then stops, and a **CronJob** runs Jobs on a schedule. Typical uses: database migrations, report generation, backups, batch processing, nightly cleanups.'},
{h:'How a Job works'},
{p:'A Job creates one or more Pods and tracks how many have **succeeded**. When the required number of completions is reached the Job is Complete. If a Pod fails, the Job controller creates another one, up to a retry limit, with an exponential delay between tries.'},
{code:`apiVersion: batch/v1
kind: Job
metadata: {name: report}
spec:
  completions: 5                  # total successful Pods required (default 1)
  parallelism: 2                  # how many run at the same time (default 1)
  backoffLimit: 3                 # failed Pods allowed before the Job fails (default 6)
  activeDeadlineSeconds: 600      # hard time limit for the whole Job
  ttlSecondsAfterFinished: 3600   # delete the Job and its Pods one hour after it finishes
  template:
    spec:
      restartPolicy: Never        # Jobs allow only Never or OnFailure
      containers:
      - name: report
        image: busybox:1.36
        command: ['sh','-c','echo processing; sleep 5']`},
{t:[['Pattern','completions','parallelism','Meaning'],
['**Single run**','1 (default)','1 (default)','One Pod runs once; Job done when it succeeds'],
['**Fixed batch**','N','M','N successful Pods in total, M at a time'],
['**Work queue**','unset','M','Pods pull work from a queue and exit when it is empty; Job completes when one exits successfully and all have terminated'],
['**Indexed**','N with `completionMode: Indexed`','M','Each Pod gets an index 0 to N-1 (environment `JOB_COMPLETION_INDEX`)']]},
{h:'restartPolicy: Never versus OnFailure'},
{ul:['**`Never`**: a failed container is not restarted; the Job controller creates a **new Pod** (you keep the failed Pods and their logs, which is good for debugging).','**`OnFailure`**: the kubelet restarts the container in the **same Pod** (fewer Pods created, but earlier logs are replaced by the newest run).','`backoffLimit` counts failures across Pods; when it is reached the Job is marked **Failed** and remaining Pods are stopped.']},
{code:`$ kubectl create job once --image=busybox:1.36 -- sh -c "echo hello; exit 0"
$ kubectl get job once
NAME   STATUS     COMPLETIONS   DURATION   AGE
once   Complete   1/1           4s         10s
$ kubectl logs job/once
hello
$ kubectl get pods -l job-name=once
NAME         READY   STATUS      RESTARTS   AGE
once-x7k2p   0/1     Completed   0          14s        # a finished Pod stays so you can read its logs
$ kubectl describe job once | grep -E "Events|Type"
$ kubectl delete job once                                # also deletes its Pods`},
{h:'CronJob: a Job on a schedule'},
{p:'A CronJob creates a Job at each scheduled time. The schedule uses the standard five-field cron format: minute, hour, day of month, month, day of week.'},
{code:`apiVersion: batch/v1
kind: CronJob
metadata: {name: nightly-backup}
spec:
  schedule: "0 2 * * *"               # 02:00 every day
  timeZone: "Etc/UTC"                 # without it, the controller manager time zone is used
  concurrencyPolicy: Forbid           # Allow | Forbid | Replace
  startingDeadlineSeconds: 300        # skip a run that cannot start within 5 minutes of its time
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  suspend: false
  jobTemplate:
    spec:
      backoffLimit: 2
      ttlSecondsAfterFinished: 86400
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: backup
            image: busybox:1.36
            command: ['sh','-c','echo backup done']`},
{t:[['Schedule','Meaning'],
['`*/5 * * * *`','Every 5 minutes'],
['`0 * * * *`','At the start of every hour'],
['`30 3 * * 1-5`','03:30 on weekdays'],
['`0 0 1 * *`','Midnight on the first of each month']]},
{t:[['concurrencyPolicy','When the previous run is still going at the next time'],
['`Allow` (default)','Start another run in parallel'],
['`Forbid`','Skip the new run'],
['`Replace`','Stop the old run, start the new one']]},
{code:`kubectl create cronjob nightly --image=busybox:1.36 --schedule="*/5 * * * *" -- date
kubectl get cronjob nightly                              # LAST SCHEDULE, ACTIVE, SUSPEND
kubectl create job manual-run --from=cronjob/nightly     # run it once right now
kubectl patch cronjob nightly -p '{"spec":{"suspend":true}}'   # pause the schedule
kubectl get jobs --sort-by=.metadata.creationTimestamp`},
{h:'Troubleshooting'},
{t:[['Symptom','Cause and fix'],
['Job never completes','The Pod never exits (sidecar, infinite loop) or `completions` is higher than expected; check Pods and logs'],
['Job Failed, `BackoffLimitExceeded`','Pods failed more than `backoffLimit` times; `kubectl logs` of the failed Pods (use `restartPolicy: Never` to keep them)'],
['Job Failed, `DeadlineExceeded`','`activeDeadlineSeconds` reached'],
['CronJob did not run','`suspend: true`, wrong schedule or time zone, `startingDeadlineSeconds` missed, controller manager down'],
['CronJob stopped scheduling','More than 100 missed runs since the last schedule; set `startingDeadlineSeconds` and fix the cause'],
['Thousands of old Pods and Jobs','No cleanup; set history limits and `ttlSecondsAfterFinished`'],
['Two runs overlapping and corrupting data','`concurrencyPolicy: Allow` for a non-reentrant task; use `Forbid`']]},
{h:'Design advice'},
{ul:['Make jobs **idempotent**: the same job run twice must not cause harm, because retries and duplicate runs happen.','Set `backoffLimit`, a deadline and cleanup on every Job; the defaults suit nobody in particular.','CronJob times are best-effort: a run may start slightly late, or very rarely twice; design for it.','Use resource requests, so batch work does not starve services.']},
{note:'Exam tip: `kubectl create job NAME --image=IMG -- cmd` and `kubectl create cronjob NAME --image=IMG --schedule="..." -- cmd` create the objects; add `--dry-run=client -o yaml` to edit fields such as `completions` and `backoffLimit`.'}],
src:[['Jobs',W+'controllers/job/'],['CronJob',W+'controllers/cron-jobs/'],['Automatic cleanup for finished Jobs',W+'controllers/ttlafterfinished/']]};

/* ---------- 5: ConfigMaps and Secrets ---------- */
L['k8s:4:5']={blocks:[
{p:'An image should be the same in every environment; **configuration** is what changes. Kubernetes separates the two with **ConfigMaps** (non-confidential settings) and **Secrets** (sensitive values). Both are namespaced API objects that Pods consume as environment variables or files. Getting the consumption method right matters, because it decides whether a change reaches a running application.'},
{h:'Creating them'},
{code:`kubectl create configmap app-config --from-literal=LOG_LEVEL=info --from-file=app.properties
kubectl create secret generic db-cred --from-literal=username=app --from-literal=password='S3cr3t!'
kubectl create secret docker-registry regcred \\
  --docker-server=registry.example.com --docker-username=ci --docker-password="$REG_TOKEN"
kubectl create secret tls web-tls --cert=tls.crt --key=tls.key

kubectl get configmap app-config -o yaml
kubectl get secret db-cred -o jsonpath='{.data.password}' | base64 -d`},
{p:'A Secret has a **type** that tells Kubernetes (and tools) what it contains: `Opaque` (generic), `kubernetes.io/tls`, `kubernetes.io/dockerconfigjson` (registry credentials), `kubernetes.io/service-account-token`, `kubernetes.io/basic-auth`, `kubernetes.io/ssh-auth`. The type enforces required keys, for example `tls.crt` and `tls.key` for TLS.'},
{h:'Four ways to consume them'},
{t:[['Method','Syntax idea','Updates reach a running Pod?','Notes'],
['Single environment variable','`env[].valueFrom.configMapKeyRef` or `secretKeyRef`','**No** (fixed at container start)','Simple; restart needed for changes'],
['All keys as variables','`envFrom: [{configMapRef: ...}]`','**No**','Invalid key names are skipped'],
['Mounted volume (directory)','`volumes[].configMap` or `secret`','**Yes**, eventually (kubelet sync, up to about a minute)','The app must re-read files'],
['Mounted file with `subPath`','`volumeMounts[].subPath`','**No**','Convenient for one file, but never refreshes'],
['Command arguments','`$(VAR)` from env','No','Expanded at start']]},
{code:`apiVersion: v1
kind: Pod
metadata: {name: app}
spec:
  imagePullSecrets: [{name: regcred}]
  containers:
  - name: app
    image: registry.example.com/app:1.0
    env:
    - name: LOG_LEVEL
      valueFrom: {configMapKeyRef: {name: app-config, key: LOG_LEVEL}}
    - name: DB_PASSWORD
      valueFrom: {secretKeyRef: {name: db-cred, key: password}}
    envFrom:
    - configMapRef: {name: app-config}
    volumeMounts:
    - {name: cfg, mountPath: /etc/app}
    - {name: creds, mountPath: /etc/creds, readOnly: true}
  volumes:
  - name: cfg
    configMap: {name: app-config, items: [{key: app.properties, path: app.properties}]}
  - name: creds
    secret: {secretName: db-cred, defaultMode: 0400}`},
{h:'Seeing it from inside the Pod'},
{code:`$ kubectl exec app -- env | grep -E "LOG_LEVEL|DB_PASSWORD"
LOG_LEVEL=info
DB_PASSWORD=S3cr3t!                          # environment: visible in process info, crash dumps and 'describe' of the Pod spec reference
$ kubectl exec app -- ls -l /etc/creds
lrwxrwxrwx ... password -> ..data/password     # files are symlinks into a versioned directory, swapped atomically on update
$ kubectl exec app -- cat /etc/app/app.properties`},
{h:'What happens when the ConfigMap changes'},
{flow:['You edit or replace the ConfigMap','Environment variables in running Pods keep the OLD value','Mounted files are updated by the kubelet after a delay (not instantly)','The application must notice and reload (or be restarted)','kubectl rollout restart deployment/app forces new Pods with new values']},
{ul:['To roll out a config change automatically, put a **hash of the config** in a Pod template annotation (Helm `checksum/config`, Kustomize generators with hash suffixes). The template changes, so a rollout happens.','`immutable: true` on a ConfigMap or Secret freezes it: protection against accidental edits, and less load on the API server. To change it, create a new object and update references.','A ConfigMap or Secret referenced by a Pod **must exist** (unless marked `optional: true`), otherwise the Pod fails with `CreateContainerConfigError`.','Objects are limited to about 1 MiB.']},
{h:'What a Secret does and does not protect'},
{t:[['Statement','Reality'],
['"Secrets are encrypted"','By default they are only **base64 encoded** in etcd. Enable encryption at rest (Section 10) or an external manager.'],
['"Only the Pod can read it"','Anyone allowed to `get secrets` in the namespace, or to create a Pod that mounts it, can read it. Protect with RBAC.'],
['"Environment variables are fine"','They appear in `/proc`, child processes and crash reports. Prefer mounted files for sensitive data.'],
['"Secrets stay in memory on the node"','Mounted Secret volumes use tmpfs (memory), not disk.'],
['"Git is a safe place for the YAML"','Never commit plain Secret YAML; use SOPS, Sealed Secrets or External Secrets.']]},
{h:'Common mistakes'},
{t:[['Mistake','Result','Fix'],
['Changing a ConfigMap and expecting env vars to update','Old values until restart','`kubectl rollout restart` or a config hash annotation'],
['Mounting with `subPath` and expecting live updates','File never changes','Mount the directory'],
['Secret in a different namespace','`CreateContainerConfigError` or pull failure','Create it in the Pod namespace'],
['Putting passwords in ConfigMaps','Readable by anyone who can read ConfigMaps','Use a Secret (and restrict access)'],
['Large binary data in ConfigMaps','Hits the size limit and bloats etcd','Use a volume or object storage'],
['Wrong key name in `secretKeyRef`','Container will not start','Compare with `kubectl get secret -o yaml`']]},
{note:'Quick check when config "does not apply": `kubectl exec POD -- env` (for variables) or `cat` the mounted file, then compare with the object. If they differ, the Pod needs a restart or a refresh delay.'}],
src:[['ConfigMaps',K.C+'configuration/configmap/'],['Secrets',K.C+'configuration/secret/'],['Good practices for Kubernetes Secrets',K.C+'security/secrets-good-practices/']]};

/* ---------- 6: Requests, limits, QoS ---------- */
L['k8s:4:6']={blocks:[
{p:'Resource settings are the contract between your application and the cluster. They decide **where a Pod can be scheduled**, **how much it may use** and **who is evicted first** when a node runs out of room. Misconfigured resources are behind a large share of production incidents: Pending Pods, OOM kills, throttled latency and evictions.'},
{h:'Requests and limits are different things'},
{t:[['','Request','Limit'],
['Used by','The **scheduler** (placement) and eviction ranking','The **kubelet and kernel** (enforcement)'],
['Meaning','"I need at least this much"; reserved on the node','"Never let me use more than this"'],
['CPU over the value','Allowed (it is only a share when contended)','**Throttled**: the process is slowed down'],
['Memory over the value','Allowed if the node has room','**OOM killed** (exit code 137)'],
['If not set','Treated as 0 (BestEffort risk), or defaults from a LimitRange','No cap, up to the node']]},
{code:`spec:
  containers:
  - name: app
    image: myapp:2.1
    resources:
      requests:
        cpu: 250m              # a quarter of a core
        memory: 256Mi
        ephemeral-storage: 1Gi
      limits:
        memory: 512Mi
        ephemeral-storage: 2Gi
        # CPU limit often left unset: see below`},
{ul:['CPU: `1` is one core, `500m` is half a core. It is **compressible**: over-use slows the container but does not kill it.','Memory: `Mi` and `Gi` are binary units, `M` and `G` decimal; `512M` and `512Mi` differ. Memory is **incompressible**: over-use means a kill.','Requests are summed over containers for scheduling; init containers use the larger of the biggest init request and the app sum.']},
{h:'How the scheduler uses requests'},
{p:'A node has **allocatable** resources (capacity minus system and kubelet reservations). The scheduler places a Pod only where `sum of requests of Pods on the node + new Pod requests <= allocatable`. It looks at **requests, not actual usage**.'},
{code:`$ kubectl describe node worker1 | sed -n '/Allocated resources/,/Events/p'
Allocated resources:
  Resource           Requests     Limits
  cpu                1650m (82%)  3 (150%)             # 82% of allocatable is already requested: the node is "full" for the scheduler
  memory             3200Mi (41%) 6Gi (79%)            # limits may exceed allocatable (overcommit)
$ kubectl top node worker1
NAME      CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
worker1   310m         15%    2400Mi          31%       # real usage is far below requests: over-requested`},
{p:'The two outputs show the classic waste: a node can be **full by requests and idle by usage**. The reverse (requests too low) overpacks nodes, and Pods fight for resources.'},
{h:'Quality of Service classes'},
{svg:qos},
{t:[['Class','Rule','Evicted','Typical use'],
['**Guaranteed**','Every container has CPU **and** memory requests **equal** to limits','Last','Critical services, databases'],
['**Burstable**','At least one request or limit, but not Guaranteed','Middle (those using more than requests first)','Most applications'],
['**BestEffort**','No requests or limits at all','First','Throw-away batch only']]},
{p:'The class is **derived**, not set: `kubectl get pod -o jsonpath=\'{.status.qosClass}\'`. It also sets the Linux OOM score, so under memory pressure BestEffort processes are killed first.'},
{h:'Namespace guardrails: LimitRange and ResourceQuota'},
{code:`apiVersion: v1
kind: LimitRange
metadata: {name: defaults, namespace: dev}
spec:
  limits:
  - type: Container
    defaultRequest: {cpu: 100m, memory: 128Mi}      # applied when a container sets none
    default: {cpu: 500m, memory: 256Mi}             # default limit
    max: {cpu: "2", memory: 2Gi}
---
apiVersion: v1
kind: ResourceQuota
metadata: {name: team-quota, namespace: dev}
spec:
  hard: {requests.cpu: "4", requests.memory: 8Gi, limits.memory: 16Gi, pods: "30"}`},
{ul:['A **LimitRange** injects defaults and rejects containers outside min and max at creation time.','A **ResourceQuota** caps the total of a namespace. When a quota covers CPU or memory, every Pod **must** declare them (or get defaults), otherwise creation fails with `must specify`.','Exceeding a quota rejects new objects (`exceeded quota`); it does not evict running Pods.']},
{h:'Diagnosing resource problems'},
{t:[['Symptom','Evidence','Likely cause'],
['Pod Pending','Event `Insufficient cpu` or `Insufficient memory`','Requests too large or nodes full'],
['Container restarts, exit 137','`Last State: OOMKilled`','Memory limit lower than real use'],
['Latency spikes under load, no restarts','High `container_cpu_cfs_throttled_periods`','CPU limit too low (throttling)'],
['Pods `Evicted`','Node condition `MemoryPressure` or `DiskPressure`','Node overcommitted or full; BestEffort first'],
['Pods not created, ReplicaSet events','`exceeded quota`','Namespace quota reached']]},
{h:'Practical guidance'},
{ul:['Set **requests from measured usage** (p95), not guesses; revisit them as the app changes.','Memory: set a limit and make **request equal to limit** for predictable behaviour.','CPU: set requests; many teams **omit CPU limits** to avoid needless throttling, while still using requests to guarantee a fair share.','Always set **ephemeral-storage** for apps that write logs or temp files.','Tell the runtime about the limit (JVM `-XX:MaxRAMPercentage`, Node.js `--max-old-space-size`).']},
{note:'Exam tip: `kubectl run x --image=nginx --dry-run=client -o yaml` then add `resources` under the container; or `kubectl set resources deployment/web --requests=cpu=100m,memory=128Mi --limits=memory=256Mi`.'}],
src:[['Resource Management for Pods and Containers',K.C+'configuration/manage-resources-containers/'],['Pod Quality of Service Classes',K.C+'workloads/pods/pod-qos/'],['Resource Quotas',K.C+'policy/resource-quotas/']]};

/* ---------- 7: Probes ---------- */
L['k8s:4:7']={blocks:[
{p:'A running process is not necessarily a **working** application. It may be starting, stuck in a deadlock, or unable to reach its database. **Probes** let the kubelet ask the application how it is, and **what happens next depends on which probe fails**. Using the wrong probe is a classic cause of outages that Kubernetes itself creates.'},
{h:'Three probes, three decisions'},
{t:[['Probe','Question','If it fails','Runs'],
['**Startup**','Has the application finished starting?','Container is **killed and restarted**','Until it succeeds once; liveness and readiness are held off until then'],
['**Liveness**','Is the process stuck beyond recovery?','Container is **restarted**','For the life of the container'],
['**Readiness**','Can it serve traffic **right now**?','Pod is **removed from Service endpoints**; nothing is restarted','For the life of the container']]},
{p:'The key distinction: **liveness decides whether to restart; readiness decides whether to send traffic.** A temporary overload or an unavailable dependency should make a Pod **not ready**, never "dead".'},
{h:'Mechanisms'},
{t:[['Type','Success means','Example'],
['`httpGet`','HTTP status 200 to 399','`{path: /healthz, port: 8080}`'],
['`tcpSocket`','The port accepts a connection','`{port: 5432}`'],
['`exec`','The command exits with code 0','`{command: [cat, /tmp/ready]}`'],
['`grpc`','The gRPC health service returns SERVING','`{port: 9000}`']]},
{code:`containers:
- name: web
  image: myapp:2.1
  startupProbe:
    httpGet: {path: /healthz, port: 8080}
    periodSeconds: 5
    failureThreshold: 60          # up to 5 s x 60 = 5 minutes to start
  livenessProbe:
    httpGet: {path: /healthz, port: 8080}
    periodSeconds: 10
    timeoutSeconds: 2
    failureThreshold: 3           # three consecutive failures (30 s) before a restart
  readinessProbe:
    httpGet: {path: /ready, port: 8080}
    periodSeconds: 5
    failureThreshold: 3           # three failures before leaving the endpoints
    successThreshold: 1`},
{t:[['Field','Default','Meaning'],
['`initialDelaySeconds`','0','Wait before the first probe'],
['`periodSeconds`','10','Interval between probes'],
['`timeoutSeconds`','1','Time allowed for one probe'],
['`failureThreshold`','3','Consecutive failures before acting'],
['`successThreshold`','1','Consecutive successes to recover (must be 1 for liveness and startup)']]},
{h:'What each failure looks like'},
{code:`$ kubectl describe pod web-7d9f | sed -n '/Events:/,$p'
  Warning  Unhealthy  30s (x3 over 50s)  kubelet  Readiness probe failed: HTTP probe failed with statuscode: 503
  Warning  Unhealthy  10s (x3 over 40s)  kubelet  Liveness probe failed: Get "http://10.244.1.9:8080/healthz": context deadline exceeded
  Normal   Killing    10s                kubelet  Container web failed liveness probe, will be restarted

$ kubectl get pod web-7d9f
NAME       READY   STATUS    RESTARTS   AGE
web-7d9f   0/1     Running   4          6m         # Running, restarting, and not Ready`},
{p:'**Readiness failing** shows as `0/1` READY with no restarts. **Liveness failing** shows as rising RESTARTS and `Killing` events. Look at both columns before concluding.'},
{h:'How probes combine with rolling updates and Services'},
{ul:['A rolling update only continues when new Pods become **Ready**: readiness is what makes updates safe.','A Service only sends traffic to **Ready** Pods: a failing readiness probe silently shrinks capacity. If all fail, the Service has no endpoints (503).','Startup probes let a slow-starting application take minutes to boot without loosening liveness for the rest of its life.']},
{h:'Common mistakes and their effects'},
{t:[['Mistake','What happens','Better'],
['Liveness probe that checks the **database**','Database outage restarts every Pod at once; recovery is slower','Liveness checks only the process; dependencies belong in readiness (and carefully)'],
['No startup probe on a slow app, tight liveness','Killed again and again before it finishes starting','Add a startup probe with a long enough window'],
['No readiness probe','Traffic hits Pods still starting; bad rollouts replace good Pods','Always define readiness'],
['Same endpoint for liveness and readiness that does heavy work','Load makes the probe slow and triggers restarts','Cheap liveness, meaningful readiness'],
['`timeoutSeconds: 1` on a busy service','Probes time out under load, causing restarts and more load','Tune timeouts with measured latency'],
['Probe port or path wrong','Pod never Ready, or restarts forever','Test with `kubectl exec ... wget` and `kubectl port-forward`']]},
{h:'Testing a probe by hand'},
{code:`kubectl port-forward pod/web-7d9f 8080:8080 &
curl -i localhost:8080/ready
curl -i localhost:8080/healthz
kubectl exec web-7d9f -- wget -qO- -T 2 http://localhost:8080/ready`},
{note:'Design rule: **liveness answers "should I restart you?" with a no unless you are truly stuck. Readiness answers "should I send you traffic?" honestly.**'}],
src:[['Liveness, Readiness, and Startup Probes',K.C+'configuration/liveness-readiness-startup-probes/'],['Configure Probes',T+'configure-pod-container/configure-liveness-readiness-startup-probes/']]};

/* ---------- 8: Practical ---------- */
L['k8s:4:8']={blocks:[
{p:'This lab ties the section together: you deploy an application, update it, break the update on purpose, diagnose the failure with the tools from this section and roll back. Work in a lab cluster; the whole exercise takes about twenty minutes. For each step, **predict the result before you run the command**, and note when your prediction was wrong.'},
{flow:['Create a namespace and a Deployment with a readiness probe','Expose it with a Service and verify traffic','Update to a broken image and watch the rollout stall','Diagnose with get, describe and events','Roll back and verify','Add resource limits and trigger an OOM kill','Run a Job and a CronJob','Clean up']},
{h:'1. Deploy with a probe'},
{code:`kubectl create namespace lab
kubectl -n lab create deployment web --image=nginx:1.26 --replicas=3 --dry-run=client -o yaml > web.yaml
# edit web.yaml: under the container add
#   readinessProbe: {httpGet: {path: /, port: 80}, periodSeconds: 3}
#   resources: {requests: {cpu: 50m, memory: 32Mi}, limits: {memory: 64Mi}}
kubectl apply -f web.yaml
kubectl -n lab expose deployment web --port=80
kubectl -n lab rollout status deployment/web
kubectl -n lab get pods -o wide
kubectl -n lab get endpointslices -l kubernetes.io/service-name=web      # three Pod IPs`},
{p:'**Check yourself:** how many ReplicaSets exist now? One. How many endpoints does the Service have? Three, one per Ready Pod.'},
{h:'2. Update successfully, then break it'},
{code:`kubectl -n lab set image deployment/web nginx=nginx:1.27
kubectl -n lab rollout status deployment/web           # healthy rollout
kubectl -n lab get rs                                  # two ReplicaSets: old at 0, new at 3

kubectl -n lab set image deployment/web nginx=nginx:does-not-exist
kubectl -n lab rollout status deployment/web --timeout=30s
kubectl -n lab get pods`},
{p:'**Predict:** will the application go down? No. With the default 25 percent surge and unavailable settings, one new Pod is created and stays `ImagePullBackOff`, while the old Pods keep serving.'},
{h:'3. Diagnose'},
{code:`kubectl -n lab get pods                      # one ImagePullBackOff, others Running
kubectl -n lab get rs                        # new ReplicaSet: 1 desired/current, 0 ready; old ReplicaSet still has 3
kubectl -n lab describe pod -l app=web | grep -A6 Events       # Failed to pull image "nginx:does-not-exist"
kubectl -n lab describe deployment web | grep -A4 Conditions
kubectl -n lab rollout history deployment/web`},
{h:'4. Roll back and verify'},
{code:`kubectl -n lab rollout undo deployment/web
kubectl -n lab rollout status deployment/web
kubectl -n lab get deploy web -o jsonpath='{.spec.template.spec.containers[0].image}{"\\n"}'
kubectl -n lab run probe --rm -it --image=busybox:1.36 --restart=Never -- wget -qO- -T 3 http://web | head -n 4`},
{h:'5. Variations to try'},
{t:[['Change','What you should see','What it teaches'],
['Readiness path set to `/nope`','Pods Running but `0/1` Ready; Service loses endpoints; rollout stalls','Readiness protects users and rollouts'],
['Memory limit set to `4Mi`','`OOMKilled`, exit 137, restarts, `CrashLoopBackOff`','Memory limits kill; `Last State` shows why'],
['Request set to `cpu: 100`','New Pods Pending, `Insufficient cpu`','The scheduler works on requests'],
['`kubectl scale deployment/web --replicas=0` then back','Endpoints disappear, then return','Services follow Ready Pods'],
['Delete one Pod','A replacement appears with a new name and IP','Pods are replaceable; controllers heal']]},
{h:'6. A Job and a CronJob'},
{code:`kubectl -n lab create job once --image=busybox:1.36 -- sh -c "echo done"
kubectl -n lab get job once ; kubectl -n lab logs job/once
kubectl -n lab create cronjob tick --image=busybox:1.36 --schedule="*/1 * * * *" -- date
sleep 70 ; kubectl -n lab get cronjob,jobs
kubectl -n lab patch cronjob tick -p '{"spec":{"suspend":true}}'`},
{h:'Self-check questions'},
{ul:['Why did users keep being served during the broken update?','Which command shows the exact reason a Pod is not Ready?','What is the difference between `rollout undo` and `rollout restart`?','What would have happened without a readiness probe on the broken image?','Why does a failed CronJob run leave a Pod behind?']},
{h:'Clean up'},
{code:`kubectl delete namespace lab
rm -f web.yaml`},
{note:'Exam tip: speed comes from reading the Events section first and from generating YAML with `--dry-run=client -o yaml` instead of typing it. Most workload faults tell you exactly what is wrong in `kubectl describe`.'}],
src:[['Deployments',W+'controllers/deployment/'],['Debug Pods',T+'debug/debug-application/debug-pods/'],['Debug Running Pods',T+'debug/debug-application/debug-running-pod/']]};

/* ---------- Additional content ---------- */
/* 9: PDBs */
L['k8s:4:9']={blocks:[
{p:'A **PodDisruptionBudget (PDB)** limits how many Pods of an application may be down at once during **voluntary** disruptions, so maintenance does not take the application offline.'},
{h:'Voluntary vs involuntary disruptions'},
{t:[['Type','Examples','Respects PDB?'],
['**Voluntary**','`kubectl drain`, node upgrades, cluster autoscaler scale-down, deleting via the Eviction API','Yes'],
['**Involuntary**','Node crash, kernel panic, hardware failure, OOM kill, direct `kubectl delete pod`','No (but they consume the budget)']]},
{code:`apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: {name: web-pdb, namespace: shop}
spec:
  minAvailable: 2            # or maxUnavailable: 1 (use one of the two, not both)
  selector:
    matchLabels: {app: web}
  unhealthyPodEvictionPolicy: AlwaysAllow    # let evictions remove Pods that are not Ready`},
{ul:['`minAvailable` and `maxUnavailable` accept numbers or percentages.','The selector must match the Pods; a PDB selecting nothing has no effect.','Status shows `ALLOWED DISRUPTIONS`: the number of Pods that may be evicted right now.','Using percentages with few replicas can round to zero allowed disruptions.']},
{code:`kubectl get pdb -A
kubectl describe pdb web-pdb -n shop
# ALLOWED DISRUPTIONS 0 means a drain will wait
kubectl get pods -l app=web -o wide`},
{h:'Designing them well'},
{t:[['Situation','Result'],
['3 replicas, `minAvailable: 2`','1 Pod may be evicted at a time'],
['2 replicas, `minAvailable: 2`','No evictions: drains hang. Use `maxUnavailable: 1` instead'],
['1 replica, `minAvailable: 1`','Never evictable: node upgrades block. Use 2+ replicas'],
['Use `maxUnavailable` for Deployments that scale','The budget scales with the replica count']]},
{ul:['Pair PDBs with **readiness probes**: a Pod only counts as available when Ready.','PDBs do not protect against a node failing; use replicas spread across nodes and zones for that.','StatefulSets and quorum-based systems (etcd, Kafka, databases) benefit most from carefully set budgets.','Cluster autoscalers and upgrade tools honour PDBs. A too-strict PDB is a common reason an upgrade stalls.']},
{note:'Debugging a drain that will not finish: `kubectl get pdb -A` and look for `ALLOWED DISRUPTIONS 0`, then fix replicas or the budget, not the drain flags.'}],
src:[['Specifying a Disruption Budget for your Application',K.T+'run-application/configure-pdb/'],['Disruptions',K.C+'workloads/pods/disruptions/']]};

/* 10: StatefulSets in depth */
L['k8s:4:10']={blocks:[
{p:'Beyond stable names and storage, StatefulSets have specific update, scaling and storage-retention rules that matter in production.'},
{h:'Pod management policy'},
{t:[['Policy','Behaviour'],
['`OrderedReady` (default)','Pods start in order 0, 1, 2 and each must be Ready before the next. Scale down in reverse order'],
['`Parallel`','All Pods start and stop together; use when ordering does not matter']]},
{h:'Update strategies'},
{code:`spec:
  updateStrategy:
    type: RollingUpdate           # or OnDelete
    rollingUpdate:
      partition: 2                # only Pods with ordinal >= 2 are updated
      maxUnavailable: 1           # newer versions: how many may be updating at once`},
{ul:['**RollingUpdate** updates Pods in reverse ordinal order (highest first), waiting for each to be Ready.','**partition** enables **canary and phased rollouts**: set it to the replica count to hold everything, then lower it step by step.','**OnDelete** updates a Pod only when you delete it: full manual control for databases.','A broken update can leave the set stuck waiting for a Pod that never becomes Ready; fix the template, then delete the stuck Pod.']},
{h:'Headless Service and identity'},
{p:'The `serviceName` field points at a headless Service that creates DNS records `pod-N.service.namespace.svc.cluster.local` for each Pod. Peers find each other by these stable names, even after rescheduling to another node with a new IP.'},
{h:'Storage from volumeClaimTemplates'},
{code:`volumeClaimTemplates:
- metadata: {name: data}
  spec:
    accessModes: [ReadWriteOnce]
    storageClassName: fast-ssd
    resources: {requests: {storage: 20Gi}}
persistentVolumeClaimRetentionPolicy:
  whenDeleted: Retain            # Retain (default) or Delete: what happens to PVCs when the StatefulSet is deleted
  whenScaled: Retain             # what happens to PVCs of removed replicas`},
{ul:['PVCs are named `<template>-<statefulset>-<ordinal>` (for example `data-db-0`) and reattach to the same ordinal Pod.','`Delete` retention helps cleanliness in dev; keep `Retain` for data you cannot lose.','You cannot edit `volumeClaimTemplates` in place. To resize, patch each PVC (if the class allows expansion) and recreate the StatefulSet with `kubectl delete sts db --cascade=orphan`, then apply the updated template.']},
{h:'Operational checklist'},
{ul:['Run an **odd** number of replicas for quorum-based software and set a PodDisruptionBudget.','Spread replicas across zones with topology spread constraints and zone-aware storage (`WaitForFirstConsumer`).','Test **restore**, not just backup, for every stateful app.','Prefer a well-maintained operator for complex databases.']},
{code:`kubectl rollout status sts/db
kubectl rollout history sts/db
kubectl patch sts db -p '{"spec":{"updateStrategy":{"rollingUpdate":{"partition":2}}}}'
kubectl scale sts db --replicas=5
kubectl delete sts db --cascade=orphan      # remove the set, keep the Pods running`}],
src:[['StatefulSets',K.C+'workloads/controllers/statefulset/'],['StatefulSet Basics',K.T+'run-application/run-replicated-stateful-application/']]};

/* 11: Advanced jobs */
L['k8s:4:11']={blocks:[
{p:'Basic Jobs run N Pods to completion. These settings handle failures, large batches and cleanup.'},
{h:'Indexed completion mode'},
{p:'In **Indexed** mode each Pod gets a unique completion index (0 to completions-1), available as the annotation and the environment variable `JOB_COMPLETION_INDEX`. This partitions work without a queue.'},
{code:`apiVersion: batch/v1
kind: Job
metadata: {name: shards}
spec:
  completionMode: Indexed
  completions: 8
  parallelism: 4
  backoffLimitPerIndex: 2          # retries per index (newer releases)
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: worker
        image: busybox:1.36
        command: ['sh','-c','echo processing shard $JOB_COMPLETION_INDEX']`},
{h:'Failures: backoff and deadlines'},
{ul:['**backoffLimit** (default 6): failed Pod retries before the Job is marked Failed, with exponential delay.','**activeDeadlineSeconds**: absolute time limit for the Job, regardless of retries.','**podFailurePolicy**: decide per exit code or Pod condition whether to retry, ignore (for example node disruptions) or fail the Job at once.']},
{code:`spec:
  backoffLimit: 4
  podFailurePolicy:
    rules:
    - action: FailJob              # a permanent application error: do not retry
      onExitCodes: {containerName: worker, operator: In, values: [42]}
    - action: Ignore               # do not count node disruptions as failures
      onPodConditions:
      - type: DisruptionTarget`},
{h:'Cleanup'},
{ul:['**ttlSecondsAfterFinished** deletes the finished Job and its Pods automatically.','CronJobs keep history with `successfulJobsHistoryLimit` and `failedJobsHistoryLimit`.','Without cleanup, thousands of finished Pods and Jobs fill etcd and slow listing.']},
{h:'Other useful settings'},
{ul:['**suspend: true** pauses a Job (and CronJob) without deleting it.','**parallelism: 0** on a running Job pauses it.','`kubectl create job --from=cronjob/name` runs a CronJob once now.','Work queues: set `completions` unset and let Pods exit when the queue is empty (work-queue pattern).']},
{code:`kubectl get jobs -w
kubectl describe job shards | sed -n '/Events:/,$p'
kubectl get pods -l job-name=shards
kubectl logs -l job-name=shards --prefix --tail=1`},
{note:'Some of these fields (per-index backoff, pod failure policy) were added in recent releases. Use `kubectl explain job.spec` on your cluster to see what your version supports.'}],
src:[['Jobs',K.C+'workloads/controllers/job/'],['Indexed Job for Parallel Processing',K.T+'job/indexed-parallel-processing-static/'],['Pod failure policy',K.C+'workloads/controllers/job/#pod-failure-policy']]};

/* 12: In-place resize */
L['k8s:4:12']={blocks:[
{p:'Traditionally changing a container CPU or memory request or limit meant **recreating the Pod**. **In-place Pod resize** lets you change them on a running Pod, often without restarting the container.'},
{h:'How it works'},
{ul:['Resource values for a running container can be patched through the Pod **`resize` subresource**.','Each container has a **resizePolicy** that says whether a change to CPU or memory needs a restart (`NotRequired` or `RestartContainer`).','The kubelet applies the change and reports it in the Pod status (allocated and actual resources).','If the node cannot fit the change, it is marked **Deferred** or **Infeasible** until resources free up.']},
{code:`spec:
  containers:
  - name: app
    image: myapp:2.1
    resizePolicy:
    - {resourceName: cpu, restartPolicy: NotRequired}
    - {resourceName: memory, restartPolicy: RestartContainer}
    resources:
      requests: {cpu: 250m, memory: 256Mi}
      limits:   {cpu: 500m, memory: 512Mi}`},
{code:`kubectl patch pod app --subresource resize --patch \\
  '{"spec":{"containers":[{"name":"app","resources":{"requests":{"cpu":"500m"},"limits":{"cpu":"1"}}}]}}'

kubectl get pod app -o jsonpath='{.status.containerStatuses[0].resources}{"\\n"}'
kubectl get pod app -o jsonpath='{.status.conditions}' | jq     # PodResizePending / PodResizeInProgress
kubectl describe pod app | grep -i resize`},
{h:'Why it matters'},
{ul:['Right-size long-running or stateful Pods without a disruptive restart.','Vertical autoscalers can use it to adjust live workloads.','Memory decreases are riskier than increases: use `RestartContainer` unless the application handles it.']},
{h:'Pod-level resources'},
{p:'Newer releases also let you set resource requests and limits for the **whole Pod** (`spec.resources`) so containers share a budget. Check the release notes for the stage of this feature in your version.'},
{note:'Version note: in-place Pod vertical scaling graduated to stable in Kubernetes v1.35 according to the release information tracked by this course. On older clusters it is beta or alpha and the field names or flags may differ. Confirm with `kubectl explain pod.spec.containers.resizePolicy` on your cluster.'}],
src:[['Resize CPU and Memory Resources assigned to Containers',K.T+'configure-pod-container/resize-container-resources/'],['Resource Management for Pods and Containers',K.C+'configuration/manage-resources-containers/']]};

/* 13: Termination */
L['k8s:4:13']={blocks:[
{p:'Rolling updates and drains work smoothly only if Pods **shut down gracefully**. This lecture follows what happens between a delete request and the process exiting.'},
{flow:['A delete request (or eviction) sets the Pod deletionTimestamp','The Pod is marked Terminating and removed from Service endpoints','preStop hook runs (if defined)','SIGTERM is sent to PID 1 of each container','Kubernetes waits up to terminationGracePeriodSeconds','SIGKILL is sent to anything still running','The Pod object is removed']},
{h:'Settings'},
{code:`spec:
  terminationGracePeriodSeconds: 45        # default 30
  containers:
  - name: web
    image: myapp:2.1
    lifecycle:
      preStop:
        exec:
          command: ['sh','-c','sleep 10']  # let load balancers stop sending traffic, then continue
    # or
    #   httpGet: {path: /drain, port: 8080}`},
{ul:['The grace period covers **preStop plus the SIGTERM handling**, not each one separately.','The shell form `command: sh -c "app"` can hide the app from signals; use `exec app` or a direct command so PID 1 receives SIGTERM.','`kubectl delete pod --grace-period=0 --force` skips graceful shutdown: only for stuck Pods.']},
{h:'The endpoint race'},
{p:'Removing a Pod from Service endpoints and sending SIGTERM happen at nearly the same time, but **load balancers and kube-proxy take a moment to stop sending traffic**. A short `preStop` sleep gives them time, avoiding dropped requests during rollouts.'},
{h:'What a good application does on SIGTERM'},
{ul:['Stop accepting new connections and **finish in-flight requests**.','Flush buffers, commit offsets, close database connections.','Exit with code 0 before the grace period ends.','Fail readiness immediately so traffic stops.']},
{h:'Troubleshooting'},
{t:[['Symptom','Cause'],
['Pods always take exactly 30 seconds to terminate','The app ignores SIGTERM and is killed after the grace period'],
['Errors during rollouts','No readiness handling, missing preStop delay, grace period too short'],
['Pod stuck `Terminating`','Finalizer, volume unmount problem, or unreachable node'],
['Data lost after delete','Writes not flushed before SIGKILL']]},
{code:`kubectl get pod web -o jsonpath='{.metadata.deletionTimestamp}{"\\n"}'
kubectl get pod web -o jsonpath='{.metadata.finalizers}{"\\n"}'
kubectl delete pod web --wait=false ; kubectl get pod web -w
kubectl logs web --tail=20                          # look for shutdown messages`},
{note:'Match the grace period to the real work your app needs, for example long-running requests or database shutdown, and test it by deleting Pods under load.'}],
src:[['Pod Lifecycle: termination',K.C+'workloads/pods/pod-lifecycle/#pod-termination'],['Container Lifecycle Hooks',K.C+'containers/container-lifecycle-hooks/']]};
})();
