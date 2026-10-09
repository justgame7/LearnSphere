/* LearnSphere - Kubernetes Administrator, Section 13: Monitoring, Logging & Troubleshooting.
   Lectures 0-8 are core, 9-13 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T,R=K.R;
const DBG=T+'debug/';

const topdown=K.dg(700,230,[
[10,90,120,60,'1. Workload|Deployment, Job',0],[150,90,120,60,'2. Pod|status, events,|logs',2],[290,90,120,60,'3. Service|selector, endpoints,|DNS',2],[430,90,120,60,'4. Node|kubelet, runtime,|pressure',2],[570,90,120,60,'5. Control plane|apiserver, etcd,|certs',2],
[10,170,680,50,'Move down only when the level above is healthy. Always read Events and logs before changing anything.',1]],
[[130,120,150,120],[270,120,290,120],[410,120,430,120],[550,120,570,120]]);

const states=K.dg(700,220,[
[10,20,160,60,'Pending|not scheduled, or|waiting for volume/image',0],[190,20,160,60,'ImagePullBackOff|name, tag or|credentials',0],[370,20,160,60,'CrashLoopBackOff|app exits repeatedly',2],[550,20,140,60,'OOMKilled|memory limit hit|exit code 137',2],
[10,120,680,80,'First commands:  kubectl describe pod  |  kubectl logs --previous  |  kubectl get events --sort-by=.lastTimestamp',1]],
[]);

const node=K.dg(700,220,[
[10,80,120,60,'Node NotReady',2],
[170,10,160,50,'kubelet running?|systemctl, journalctl',0],[170,85,160,50,'runtime healthy?|crictl info',0],[170,160,160,50,'CNI ready?|/etc/cni/net.d',0],
[380,10,160,50,'Resource pressure?|disk, memory, PID',0],[380,85,160,50,'Certificates,|clock, API reachable?',0],[380,160,160,50,'Network to API|server :6443',0]],
[[130,110,170,35],[130,110,170,110],[130,110,170,185]]);

/* ---------- 0: Method ---------- */
L['k8s:12:0']={blocks:[
{p:'Troubleshooting is the heaviest CKA domain (30 percent) and the skill that most separates an operator from someone who can only install clusters. A broken cluster produces dozens of symptoms at once, and the difference between a five-minute fix and a two-hour hunt is almost always **method**: a fixed order of questions that narrows the problem instead of guessing.'},
{h:'Why guessing fails in Kubernetes'},
{p:'Kubernetes is a chain of loosely coupled controllers. A Service points at Pods, Pods were created by a ReplicaSet, which was created by a Deployment, scheduled by the scheduler, started by a kubelet, networked by a CNI plugin and resolved by CoreDNS. Any link can fail, and a failure in one link usually shows up as a symptom in another. A user reports "the website returns 503", but the cause may be a readiness probe, a label typo, a full node or an expired certificate. If you start changing things at the symptom you will often fix nothing, or hide the cause.'},
{svg:topdown},
{h:'The mental model: five layers, top down'},
{p:'Work from what the user sees toward the infrastructure, and **only move down when the layer above checks out**. Each layer has one question and a small set of commands.'},
{t:[['Layer','Question to answer','First commands','Typical findings'],
['1. Workload','Does the controller want the right thing, and is the rollout healthy?','`kubectl get deploy,rs,sts,ds,job`, `kubectl rollout status`','Wrong replicas, stuck rollout, paused Deployment'],
['2. Pod','Is each Pod scheduled, started and Ready?','`kubectl get pod -o wide`, `kubectl describe pod`, `kubectl logs`','Pending, ImagePullBackOff, CrashLoopBackOff, failing probe'],
['3. Service and network','Can clients reach the Pods by name and IP?','`kubectl get svc,endpointslices`, DNS test from a Pod','No endpoints, selector typo, NetworkPolicy, DNS'],
['4. Node','Is the machine healthy and Ready?','`kubectl get nodes`, `kubectl describe node`, kubelet and runtime on the node','NotReady, pressure, runtime down'],
['5. Control plane','Are the API server, etcd, scheduler and controllers healthy?','`kubectl get --raw=/readyz?verbose`, manifests, `crictl`','Broken manifest, expired certificate, etcd full']]},
{h:'A worked example: "the shop returns 503"'},
{p:'Follow the layers. Every step is a read-only command, and each result decides the next step.'},
{code:`# Layer 1: workload
$ kubectl -n shop get deploy web
NAME   READY   UP-TO-DATE   AVAILABLE   AGE
web    0/3     3            0           2d          # 3 desired, 0 available: problem is below this layer

# Layer 2: pods
$ kubectl -n shop get pods -l app=web
NAME                  READY   STATUS    RESTARTS   AGE
web-6d4f8b7c9-4xk2p   0/1     Running   0          6m      # Running but NOT Ready
web-6d4f8b7c9-9tq8z   0/1     Running   0          6m

$ kubectl -n shop describe pod web-6d4f8b7c9-4xk2p | tail -n 6
  Warning  Unhealthy  3m (x20 over 6m)  kubelet  Readiness probe failed: HTTP probe failed with statuscode: 404

# Conclusion: the readiness probe path is wrong, so Pods are Ready=false,
# the Service has no endpoints, and the ingress returns 503. No need to look at nodes.
$ kubectl -n shop get deploy web -o jsonpath='{.spec.template.spec.containers[0].readinessProbe.httpGet}'
{"path":"/healthz","port":8080}                     # app actually serves /ready`},
{p:'The user-visible symptom (503) was three layers away from the cause (a probe path). The method found it in four commands without changing anything. If the Pods had been healthy, the next question would have been layer 3: does the Service have endpoints?'},
{h:'Symptom to layer cheat sheet'},
{t:[['What you observe','Start at layer','Why'],
['Users get 503, 502 or connection refused','3 (Service), then 2','Backends missing or not Ready'],
['`kubectl apply` succeeds but nothing changes','1, then 5 (controller manager)','Controllers may not be reconciling'],
['New Pods stay Pending with no events at all','5 (scheduler)','Nothing is evaluating them'],
['Pod Pending with `FailedScheduling` events','2 and 4','Resources, taints, volumes, node capacity'],
['One node hosts many failing Pods','4','Node, runtime or network of that node'],
['`kubectl` times out or refuses','5','API server, load balancer or kubeconfig'],
['Everything slow, intermittent errors','5 (etcd, API latency) and 4','Disk, CPU, network latency']]},
{h:'Rules that keep you out of trouble'},
{ul:['**Observe first, change second.** Use `get`, `describe` and `logs` until you can state the cause in one sentence.','**Change one thing at a time**, and note it, so you can undo it. Two simultaneous changes hide which one worked.','**Check context and namespace before anything else**; a surprising number of "bugs" are the wrong cluster or namespace.','**Compare with a healthy sibling**: another Pod of the same Deployment, another node, the same app in staging. The difference is usually the cause.','**Do not delete to fix.** Deleting a Pod discards the evidence (logs, state). Collect `describe` and `logs --previous` first.','When `kubectl` stops working you are no longer a kubectl user: go to the node and use `systemctl`, `journalctl` and `crictl`.']},
{h:'A five-minute triage you can run on any cluster'},
{code:`kubectl config current-context
kubectl get nodes                                          # any NotReady?
kubectl get pods -A | grep -v -E "Running|Completed"       # anything unhealthy?
kubectl get events -A --sort-by=.lastTimestamp | tail -n 20
kubectl get --raw=/readyz?verbose | grep -v "ok$"          # control plane checks that are not ok
kubectl -n kube-system get pods -o wide                    # CoreDNS, CNI, kube-proxy, metrics-server`},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Restarting Pods "to see if it helps"','Logs and state are lost; a flapping problem is hidden','Read `logs --previous` and `describe` first'],
['Editing a live Pod','Most fields are immutable and the change disappears on recreation','Fix the controller template (Deployment), then roll out'],
['Fixing the symptom (scale up, raise limits) without a cause','Cost rises and the fault returns','State the cause, then act'],
['Trusting `Running` as healthy','The Pod may be NotReady or restarting','Read READY and RESTARTS'],
['Forgetting `-n`','You inspect an empty namespace and conclude it is fine','Set the default namespace on the context']]},
{note:'Exam tip: each task is worth a few points. If you are stuck for more than about five minutes, flag the task and return to it. A partial fix on three tasks beats a perfect fix on one. Always run the context-switch command given with each task.'}],
src:[['Troubleshooting Applications',DBG+'debug-application/'],['Troubleshooting Clusters',DBG+'debug-cluster/'],['kubectl Quick Reference',R+'kubectl/quick-reference/']]};

/* ---------- 1: Logs, describe, events, exec ---------- */
L['k8s:12:1']={blocks:[
{p:'Four commands answer most questions about a workload: `describe`, `get events`, `logs` and `exec`. Each reads from a different source with a different lifetime, so knowing **where the information comes from** tells you when to trust it and when it is already gone.'},
{h:'Where each piece of information lives'},
{t:[['Command','Source','How long it lasts','Best for'],
['`kubectl get`','Object `spec` and `status` in etcd','As long as the object exists','State at a glance: phase, ready, restarts'],
['`kubectl describe`','The object plus recent Events about it','Events about one hour by default','Why something is not happening: scheduling, pulls, probes'],
['`kubectl get events`','Event objects in the API','About one hour, then garbage collected','Timeline across many objects'],
['`kubectl logs`','Container stdout and stderr files on the node','Until the Pod is deleted; rotated by the kubelet','What the application said'],
['`kubectl exec`','A new process inside the running container','Only while the container runs','Testing from the container point of view']]},
{p:'Two consequences: Events vanish quickly, so look early; and logs vanish with the Pod, so a deleted Pod has **no logs left** unless you ship them elsewhere.'},
{h:'Reading describe: an annotated example'},
{code:`$ kubectl describe pod web-6d4f8b7c9-4xk2p -n shop
Name:             web-6d4f8b7c9-4xk2p
Node:             worker2/10.0.0.12                     # where it was scheduled (empty means Pending)
Status:           Running
IP:               10.244.2.17
Controlled By:    ReplicaSet/web-6d4f8b7c9               # owner: who will recreate it
Containers:
  app:
    Image:          registry.example.com/web:1.4.2
    State:          Running
      Started:      Fri, 09 Oct 2026 10:02:11 +0000
    Last State:     Terminated                           # why the previous run ended
      Reason:       OOMKilled
      Exit Code:    137
    Ready:          False
    Restart Count:  5
    Limits:         memory: 256Mi
    Requests:       cpu: 100m  memory: 128Mi
    Liveness:       http-get http://:8080/healthz delay=10s timeout=1s period=10s #success=1 #failure=3
    Readiness:      http-get http://:8080/ready   delay=5s  timeout=1s period=5s  #success=1 #failure=3
Conditions:
  PodScheduled      True
  Initialized       True
  ContainersReady   False
  Ready             False
QoS Class:          Burstable
Events:
  Type     Reason     Age   From     Message
  Warning  Unhealthy  3m    kubelet  Readiness probe failed: Get "http://10.244.2.17:8080/ready": connect: connection refused
  Normal   Killing    2m    kubelet  Container app failed liveness probe, will be restarted`},
{p:'Read it in this order: **Status and Node** (is it scheduled?), **Containers: State, Last State, Exit Code** (what happened last?), **Conditions** (which stage is false?), then **Events** (what did the control plane notice?). The Conditions tell you which stage failed: `PodScheduled` false means a scheduling problem, `Initialized` false means an init container, `ContainersReady` false means probes or crashes.'},
{h:'Events: the timeline'},
{code:`kubectl get events -n shop --sort-by=.lastTimestamp
kubectl get events -A --field-selector type=Warning
kubectl get events -n shop --field-selector involvedObject.name=web-6d4f8b7c9-4xk2p
kubectl events --for pod/web-6d4f8b7c9-4xk2p -n shop      # newer kubectl, sorted output
kubectl get events -w                                      # watch live while you reproduce the problem`},
{ul:['Events have a **count and last-seen time**; a repeated warning shows `(x20 over 6m)`.','Event reasons such as `FailedScheduling`, `Failed`, `BackOff`, `Unhealthy`, `FailedMount` are the vocabulary of the next lectures.','Components write events (scheduler, kubelet, controllers): the **From** column tells you who noticed.']},
{h:'logs: the flags that matter'},
{t:[['Goal','Command'],
['Current container','`kubectl logs web-0`'],
['A specific container in a multi-container Pod','`kubectl logs web-0 -c sidecar`'],
['**The previous crashed run**','`kubectl logs web-0 --previous`'],
['Follow, last 50 lines, with time stamps','`kubectl logs -f web-0 --tail=50 --timestamps`'],
['Everything from the last 15 minutes','`kubectl logs web-0 --since=15m`'],
['All Pods of a label, all containers, prefixed','`kubectl logs -l app=web --all-containers --prefix --tail=20`'],
['An init container','`kubectl logs web-0 -c <init-container-name>`'],
['One Pod picked from a Deployment','`kubectl logs deploy/web`']]},
{ul:['A Pod that is still **Pending or ContainerCreating has no logs**; use `describe`.','`--previous` only works if the container has restarted at least once. Without it, a crash loop often shows an empty or very short log of the newest start.','Log lines are only what the application wrote to **stdout and stderr**. Applications that write only to files need a sidecar or a change.']},
{h:'exec: test from inside'},
{code:`kubectl exec -it web-0 -- sh
kubectl exec web-0 -c app -- env | sort
kubectl exec web-0 -- cat /etc/resolv.conf
kubectl exec web-0 -- wget -qO- -T 3 http://api:8080/health
kubectl exec web-0 -- ls -l /var/run/secrets/kubernetes.io/serviceaccount
kubectl exec web-0 -- id`},
{p:'`exec` is the best way to answer "does this work **from the Pod**?": DNS, connectivity to a dependency, mounted files, effective user. Minimal images may have no shell or tools; use an ephemeral debug container (next lecture) instead of rebuilding the image.'},
{h:'Exit codes you will see in Last State'},
{t:[['Exit code','Meaning','Usual cause'],
['0','Finished normally','A container meant to exit, or a Job'],
['1','Generic application error','Read the log; bad config or unhandled exception'],
['126, 127','Command not executable, command not found','Wrong `command` or image without that binary'],
['137','Killed by SIGKILL (128 + 9)','**OOM kill** (check reason), or killed after the grace period'],
['139','Segmentation fault (128 + 11)','A crash in native code'],
['143','Terminated by SIGTERM (128 + 15)','Normal graceful stop']]},
{h:'Common mistakes'},
{ul:['Reading `logs` of the **new** container after a restart and missing the real error; use `--previous`.','Looking for events an hour later: they have expired. Capture `describe` output as soon as you see the problem.','Running `kubectl exec` against the wrong container of a multi-container Pod (use `-c`).','Assuming no logs means no problem: check whether the log goes to a file instead of stdout.']},
{note:'Quick rule: **describe for why it is not running, logs for why it is running badly, exec to test from the inside.**'}],
src:[['Debug Pods',DBG+'debug-application/debug-pods/'],['Determine the Reason for Pod Failure',DBG+'debug-application/determine-reason-pod-failure/'],['kubectl logs',R+'kubectl/generated/kubectl_logs/']]};

/* ---------- 2: kubectl debug ---------- */
L['k8s:12:2']={blocks:[
{p:'Production images are deliberately minimal: no shell, no `curl`, no `ps`, sometimes nothing but the application binary (distroless or scratch images). That is good for security and terrible for debugging. `kubectl debug` solves this by letting you **bring tools to the Pod** instead of putting tools in the image.'},
{h:'Why this exists'},
{p:'A Pod cannot be edited to add containers: the container list is immutable. So until recently the options were to rebuild the image with debug tools, or to recreate the Pod, which destroyed the very state you wanted to investigate. **Ephemeral containers** are a special kind of container that can be added to a **running** Pod through a dedicated API subresource. They share the Pod namespaces, are never restarted, have no ports or probes, and disappear with the Pod. The feature is stable in current Kubernetes releases.'},
{h:'Three modes of kubectl debug'},
{t:[['Mode','Command shape','What it does','Use when'],
['**Ephemeral container**','`kubectl debug -it POD --image=busybox --target=app`','Adds a debug container to the **live** Pod','The Pod is running and you need tools inside its namespaces'],
['**Copy of the Pod**','`kubectl debug POD -it --copy-to=POD-debug --container=app -- sh`','Creates a **new Pod** with a modified spec (different command, image or extra container)','The container crashes at start, or you must change the command or image safely'],
['**Node debug**','`kubectl debug node/NAME -it --image=busybox`','Runs a Pod on that node with the host filesystem mounted at `/host`','You need to look at node files and logs without SSH']]},
{h:'1. Ephemeral container on a live Pod'},
{code:`$ kubectl debug -it web-6d4f8b7c9-4xk2p -n shop --image=busybox:1.36 --target=app
Targeting container "app". If you don't see processes from this container it may be because the container runtime doesn't support this feature.
Defaulting debug container name to debugger-7xk2q.
/ # ps aux
PID   USER     COMMAND
    1 1000     /app/server --port=8080            # the app process, visible because of --target
   14 root     sh
/ # wget -qO- http://localhost:8080/ready
/ # nslookup db.shop.svc.cluster.local
/ # ls /proc/1/root/etc/                          # the app container filesystem, through the shared process namespace
/ # exit
$ kubectl get pod web-6d4f8b7c9-4xk2p -n shop -o jsonpath='{.spec.ephemeralContainers[*].name}'
debugger-7xk2q`},
{ul:['`--target=app` shares the **process namespace** of that container, so you can see its processes and read its files via `/proc/<pid>/root`.','Without `--target` you still share the network namespace, which is enough for connectivity tests (`wget`, `nslookup`, `tcpdump`).','Useful images: `busybox` (small), `nicolaka/netshoot` (network tools), `alpine` plus `apk add`.','The ephemeral container stays listed in the Pod spec until the Pod is deleted; you cannot remove it.']},
{h:'2. Debugging a copy of a crashing Pod'},
{p:'When the container exits immediately you cannot attach to it. Create a copy whose command is replaced with something that stays up, then run the real command by hand.'},
{code:`$ kubectl debug web-6d4f8b7c9-4xk2p -n shop -it --copy-to=web-debug --container=app -- sh
If you don't see a command prompt, try pressing enter.
/ # env | grep DB_                                # compare config with a working Pod
/ # /app/server --port=8080                       # run the real command and read the error directly
2026/10/09 10:05:01 cannot open /etc/app/config.yaml: no such file or directory

# other useful variants
kubectl debug POD --copy-to=web-debug --set-image=app=myorg/web:debug        # swap the image
kubectl debug POD -it --copy-to=web-debug --image=busybox:1.36 --share-processes
kubectl delete pod web-debug -n shop                                         # always clean up`},
{p:'The copy has **no labels** by default, so Services and ReplicaSets ignore it. If you keep labels (`--keep-labels`), the copy could receive production traffic.'},
{h:'3. Debugging a node'},
{code:`$ kubectl debug node/worker2 -it --image=busybox:1.36
Creating debugging pod node-debugger-worker2-xk9ql with container debugger on node worker2.
/ # ls /host/var/log/pods | head                  # the node filesystem is mounted at /host
/ # chroot /host                                  # if the image has chroot: run host tools
# journalctl -u kubelet -n 20 --no-pager
# exit
$ kubectl delete pod node-debugger-worker2-xk9ql  # remove the helper Pod afterwards`},
{ul:['The helper Pod runs **in the namespace you are in**; Pod Security Admission may refuse host mounts there. Use a privileged namespace for node debugging.','If you can SSH to the node, `systemctl`, `journalctl` and `crictl` are usually simpler.']},
{h:'Permissions and limits'},
{t:[['Need','RBAC permission','Note'],
['Ephemeral container','`update` on `pods/ephemeralcontainers`','Separate from `pods/exec`; grant deliberately'],
['Pod copy','`create` on `pods`','Normal Pod creation'],
['Node debug','`create` on `pods` in some namespace','The Pod gets host access: treat as privileged']]},
{ul:['An ephemeral container is a **privileged operation in disguise**: whoever can add one can read the application memory and files. Include it in access reviews.','You cannot add ports, probes or resource limits to ephemeral containers.','If the Pod is already `Terminating`, add one before it disappears, or use the copy method.']},
{h:'Common mistakes'},
{ul:['Forgetting `--target`, then wondering why `ps` shows only the debug shell.','Leaving debug copies and node-debugger Pods running; they hold resources and can match selectors.','Debugging a copy that has different config than the original (for example a missing mounted Secret) and drawing wrong conclusions.']},
{note:'Choose by question: "what is it doing right now?" is an ephemeral container; "why does it crash at start?" is a copy with a replaced command; "what is on the node?" is a node debug Pod or SSH.'}],
src:[['Debug Running Pods',DBG+'debug-application/debug-running-pod/'],['Ephemeral Containers',C+'workloads/pods/ephemeral-containers/'],['Debugging Kubernetes nodes with kubectl',DBG+'debug-cluster/kubectl-node-debug/']]};

/* ---------- 3: Pod failures ---------- */
L['k8s:12:3']={blocks:[
{p:'Most workload tickets come down to four Pod states. For each, you need to know **what the kubelet or scheduler is actually doing**, what causes it, and the one command that proves the cause. Memorising causes is less useful than understanding the mechanism: then you can reason about variations you have not seen.'},
{svg:states},
{h:'How a Pod gets from creation to Running'},
{flow:['The API server stores the Pod (phase Pending)','The scheduler picks a node and binds it (PodScheduled = True)','The kubelet pulls images, mounts volumes, sets up networking (ContainerCreating)','Init containers run one by one (Initialized = True)','App containers start; probes begin (Running)','Readiness passes (Ready = True) and the Pod joins Service endpoints']},
{p:'A Pod can stall at **any** of these steps. The status text and Events tell you which step: that is the whole skill.'},
{h:'Pending: not running yet'},
{p:'**Mechanism.** Pending covers everything before the containers start. Two very different situations hide behind it: the Pod is **not scheduled yet** (no node assigned) or it is **scheduled but waiting** (image pull, volume, init container).'},
{code:`$ kubectl get pod big -n shop
NAME   READY   STATUS    RESTARTS   AGE
big    0/1     Pending   0          4m

$ kubectl describe pod big -n shop | sed -n '/Events:/,$p'
Events:
  Warning  FailedScheduling  4m  default-scheduler  0/3 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 2 Insufficient memory. preemption: 0/3 nodes are available: 3 Preemption is not helpful for scheduling.`},
{t:[['Check','Meaning','Fix'],
['`Node:` is `<none>`, event `FailedScheduling`','Scheduler could not place it','Read the reason per node: resources, taints, selectors, volumes'],
['`Insufficient cpu / memory`','Requests exceed free allocatable on every node','Lower requests, add nodes, evict something'],
['`untolerated taint`','Taint on nodes, no toleration','Add toleration or remove taint'],
['`didn\'t match Pod\'s node affinity/selector`','Label does not exist on any node','Fix the selector or label a node'],
['`unbound immediate PersistentVolumeClaims`','PVC not provisioned','`kubectl describe pvc` and the StorageClass'],
['`volume node affinity conflict`','Volume lives in a zone the Pod cannot use','Match zone, or recreate the volume'],
['Pod is scheduled but `ContainerCreating`','Image pull, volume mount or CNI problem on the node','Events show `Pulling`, `FailedMount`, `FailedCreatePodSandBox`'],
['No events at all, no node','No scheduler running, or Pod names a scheduler that does not exist','Check `kube-scheduler` and `spec.schedulerName`']]},
{h:'ImagePullBackOff and ErrImagePull'},
{p:'**Mechanism.** The kubelet asks the runtime to pull the image. On failure it retries with growing delays: first `ErrImagePull`, then `ImagePullBackOff` while it waits.'},
{code:`$ kubectl describe pod web -n shop | grep -A4 -i "pull"
  Warning  Failed     1m  kubelet  Failed to pull image "registry.example.com/web:1.4.3": rpc error: code = NotFound desc = ... not found
  Warning  Failed     1m  kubelet  Error: ErrImagePull
  Normal   BackOff    30s kubelet  Back-off pulling image "registry.example.com/web:1.4.3"

$ kubectl get pod web -n shop -o jsonpath='{.spec.containers[*].image}{"\\n"}'
$ kubectl get secret regcred -n shop              # does the pull secret exist in THIS namespace?`},
{t:[['Message fragment','Cause'],
['`not found`, `manifest unknown`','Tag or image name does not exist (typo, not pushed yet)'],
['`pull access denied`, `unauthorized`','Private registry and no or wrong `imagePullSecret` in this namespace'],
['`toomanyrequests`','Registry rate limit; use authenticated pulls or a mirror'],
['`dial tcp ... i/o timeout`, `no such host`','Node cannot reach the registry (DNS, firewall, proxy)'],
['`x509: certificate signed by unknown authority`','Registry uses a private CA the runtime does not trust']]},
{h:'CrashLoopBackOff'},
{p:'**Mechanism.** The container starts and exits. The kubelet restarts it (per `restartPolicy`) with an exponential delay that grows 10 s, 20 s, 40 s and so on up to **five minutes**, and resets after the container has run for ten minutes. `CrashLoopBackOff` is the **waiting** state between those restarts, not the error itself: the error is in the previous run.'},
{code:`$ kubectl get pod api-5f9c7d8b6-xk2p -n shop
NAME                   READY   STATUS             RESTARTS      AGE
api-5f9c7d8b6-xk2p     0/1     CrashLoopBackOff   6 (47s ago)   9m

$ kubectl logs api-5f9c7d8b6-xk2p -n shop --previous
2026/10/09 10:02:11 fatal: cannot connect to postgres at db:5432: dial tcp: lookup db: no such host

$ kubectl get pod api-5f9c7d8b6-xk2p -n shop -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'
{"exitCode":1,"reason":"Error","startedAt":"2026-10-09T10:02:11Z","finishedAt":"2026-10-09T10:02:11Z"}`},
{t:[['Evidence','Usual cause'],
['Log shows an error and exit code 1','Application config or dependency problem'],
['Exit code 137, reason `OOMKilled`','Memory limit too low'],
['Exit code 0 but restarts','The process finished (not a server) and `restartPolicy: Always` restarts it; use a Job or keep it running'],
['No log, exit code 127 or 126','Wrong command or entrypoint'],
['Log fine, but events show `Liveness probe failed`','The liveness probe kills a healthy but slow app; add a startup probe or fix the path'],
['`permission denied` in the log','Non-root user cannot write to a path; fix ownership or mount an `emptyDir`']]},
{h:'OOMKilled'},
{p:'**Mechanism.** The memory limit becomes a cgroup limit. When the container exceeds it the kernel kills the process; the kubelet records `OOMKilled` and exit code 137. Memory is **incompressible**, unlike CPU, which is only throttled.'},
{code:`$ kubectl get pod api-5f9c7d8b6-xk2p -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}{"\\n"}'
OOMKilled
$ kubectl top pod api-5f9c7d8b6-xk2p --containers
POD                   NAME   CPU(cores)   MEMORY(bytes)
api-5f9c7d8b6-xk2p    api    120m         251Mi          # right at the 256Mi limit
$ dmesg -T | grep -i "killed process"            # on the node, if you need the kernel view`},
{ul:['Raise the limit **after** checking whether usage grows without bound (a leak) or is just larger than expected.','Runtimes that size memory themselves (JVM, Node.js, .NET) must be told the container limit, or they assume the whole node.','**Evicted** is different: the kubelet removed the Pod because the **node** ran short of memory or disk. Look at node conditions.']},
{h:'Other states you will meet'},
{t:[['State','Mechanism and cause','Command'],
['`ContainerCreating` for long','Volume attach or mount, CNI sandbox failure, large image pull','`describe pod` Events'],
['`CreateContainerConfigError`','A referenced ConfigMap, Secret or key does not exist','`describe pod`, `get cm,secret`'],
['`Init:Error`, `Init:CrashLoopBackOff`','An init container failed; main containers never start','`logs -c <init-name>`'],
['`Terminating` forever','A finalizer, a stuck volume unmount or an unreachable node','`get pod -o yaml` finalizers, node status'],
['`Evicted`','Node pressure removed the Pod','`describe node` conditions'],
['Running but `0/1 Ready`','Readiness probe failing','`describe pod` probe lines, app logs']]},
{h:'Decision flow'},
{flow:['STATUS Pending? describe, read FailedScheduling and the per-node reasons','STATUS ImagePullBackOff? read the pull error message','STATUS CrashLoopBackOff? logs --previous and the exit code','Restarts rising and reason OOMKilled? memory limit versus real use','Running but not Ready? readiness probe and the dependency it checks']},
{note:'Exam tip: for any broken Pod the first two commands are always `kubectl get pod -o wide` and `kubectl describe pod`. The answer is in the Events or Last State in most tasks.'}],
src:[['Debug Pods',DBG+'debug-application/debug-pods/'],['Pod Lifecycle',C+'workloads/pods/pod-lifecycle/'],['Node-pressure Eviction',C+'scheduling-eviction/node-pressure-eviction/']]};

/* ---------- 4: Node failures ---------- */
L['k8s:12:4']={blocks:[
{p:'A node is a machine running a kubelet, a container runtime and a network plugin. When any of the three misbehaves, the node stops being useful, and the cluster reacts automatically. Understanding **how the cluster decides a node is dead** lets you predict what will happen to your Pods and fix the right thing.'},
{h:'How Kubernetes decides a node is NotReady'},
{flow:['The kubelet renews a Lease object (namespace kube-node-lease) about every 10 seconds and updates node status periodically','The node controller watches those heartbeats','If none arrive for the grace period (40 seconds by default) the node is marked NotReady or Unknown','The controller adds taints node.kubernetes.io/not-ready or unreachable (effect NoExecute)','Pods without a toleration are evicted; ordinary Pods tolerate these taints for 300 seconds by default','After that they are deleted and controllers recreate them elsewhere']},
{p:'So a dead node does **not** move its Pods instantly: expect roughly five to six minutes before replacements appear, unless your Pods set a shorter `tolerationSeconds`. StatefulSet Pods are deliberately **not** replaced while the node state is unknown, to avoid two copies writing the same data.'},
{svg:node},
{h:'First look from the cluster side'},
{code:`$ kubectl get nodes
NAME      STATUS     ROLES           AGE   VERSION
cp1       Ready      control-plane   40d   v1.37.1
worker1   Ready      <none>          40d   v1.37.1
worker2   NotReady   <none>          40d   v1.37.1

$ kubectl describe node worker2 | sed -n '/Conditions:/,/Addresses:/p'
Conditions:
  Type             Status    Reason                       Message
  MemoryPressure   Unknown   NodeStatusUnknown            Kubelet stopped posting node status.
  DiskPressure     Unknown   NodeStatusUnknown            Kubelet stopped posting node status.
  PIDPressure      Unknown   NodeStatusUnknown            Kubelet stopped posting node status.
  Ready            Unknown   NodeStatusUnknown            Kubelet stopped posting node status.

$ kubectl get pods -A -o wide --field-selector spec.nodeName=worker2   # what is affected`},
{t:[['What the Conditions say','Meaning','Where to go next'],
['`Ready` Unknown, "Kubelet stopped posting node status"','The control plane hears nothing from the kubelet: kubelet stopped, node down or network cut','SSH to the node, check kubelet'],
['`Ready` False with a message about runtime or CNI','The kubelet runs but reports a problem','The message names it: runtime, network plugin'],
['`MemoryPressure`, `DiskPressure`, `PIDPressure` True','Kubelet is evicting Pods to protect the node','Free the resource (see below)'],
['`NetworkUnavailable` True','The network plugin or cloud routes are not ready','CNI Pods and configuration']]},
{h:'On the node: kubelet first'},
{code:`ssh worker2
$ sudo systemctl status kubelet
 kubelet.service - kubelet: The Kubernetes Node Agent
   Active: activating (auto-restart) (Result: exit-code) since Fri 2026-10-09 10:12:03 UTC; 4s ago

$ sudo journalctl -u kubelet -n 30 --no-pager
... run.go:74] "command failed" err="failed to run Kubelet: running with swap on is not supported, please disable swap or set --fail-swap-on=false"`},
{t:[['Kubelet log message','Cause','Fix'],
['`running with swap on is not supported`','Swap enabled','`swapoff -a` and remove it from `/etc/fstab`'],
['`failed to connect to apiserver`, `connection refused`','Wrong API address in `kubelet.conf`, firewall, API server down','Check `server:` in `/etc/kubernetes/kubelet.conf`, test `nc -zv`'],
['`x509: certificate has expired or is not yet valid`','Expired kubelet client certificate or wrong clock','`timedatectl`, rotate or renew'],
['`misconfiguration: kubelet cgroup driver ... is different from docker cgroup driver`','Kubelet and runtime use different cgroup drivers','Set both to `systemd`'],
['`container runtime is down`, `rpc error ... containerd.sock`','Runtime stopped or wrong socket path','`systemctl status containerd`'],
['`NetworkPluginNotReady ... cni plugin not initialized`','CNI not installed or crash-looping','CNI DaemonSet Pods and `/etc/cni/net.d`']]},
{h:'The container runtime'},
{code:`sudo systemctl status containerd
sudo crictl info | head -n 20            # shows runtime conditions: RuntimeReady and NetworkReady
sudo crictl ps -a | head
sudo journalctl -u containerd -n 50 --no-pager
ls /etc/cni/net.d /opt/cni/bin           # network configuration and plugin binaries`},
{p:'`crictl info` prints `RuntimeReady` and `NetworkReady`. If `NetworkReady` is false, the problem is the CNI; if the command itself fails, the runtime is down.'},
{h:'Resource pressure and eviction'},
{p:'The kubelet watches node resources and starts **evicting Pods** when a hard threshold is crossed. Typical defaults are free memory below 100 Mi, free node filesystem below 10 percent, free image filesystem below 15 percent and free inodes below 5 percent. Pods are evicted by QoS class: BestEffort first, then Burstable over their requests, Guaranteed last.'},
{code:`df -h /var/lib/kubelet /var/lib/containerd /var/log          # DiskPressure
df -i /var/lib/containerd                                    # inode exhaustion looks like a full disk
free -m ; ps -eo pid,comm,%mem --sort=-%mem | head           # MemoryPressure
ps -e | wc -l ; cat /proc/sys/kernel/pid_max                 # PIDPressure
sudo crictl rmi --prune                                      # remove unused images
sudo journalctl --vacuum-size=500M                           # trim the system journal
kubectl get pods -A --field-selector status.phase=Failed | head   # Evicted Pods remain as Failed objects`},
{ul:['The kubelet also **garbage-collects images and dead containers** when disk use passes about 85 percent; if it cannot free enough, DiskPressure appears.','Evicted Pods are not deleted automatically in all setups; clean them with `kubectl delete pod --field-selector=status.phase=Failed -A`.','Log files of chatty containers are a common disk hog; check `containerLogMaxSize` and rotation.']},
{h:'Worked example: node flaps between Ready and NotReady'},
{p:'The kubelet log shows `PLEG is not healthy` and node conditions toggle every few minutes. PLEG (Pod Lifecycle Event Generator) is the kubelet loop that asks the runtime for container states. If the runtime is slow, PLEG times out and the node is declared unhealthy. Typical causes: an overloaded runtime (thousands of containers), disk I/O saturation, CPU starvation of the node, a hung container. Check `crictl ps` response time, `iostat`, and load average, rather than restarting the kubelet repeatedly.'},
{h:'Recovering a node'},
{ul:['**Fix and keep**: correct the cause, restart the failed service, watch the node return to Ready.','**Replace**: `kubectl drain` (if reachable) then `kubectl delete node`, rebuild the machine and rejoin with a fresh token.','If a node is unreachable and its Pods are stuck `Terminating`, deleting the Node object lets the controllers recreate them; never force-delete StatefulSet Pods unless you are sure the old node is really off.']},
{note:'A node that cannot be explained within a few minutes is cheaper to replace than to debug, if your workloads are replicated. That is one of the main reasons to keep nodes disposable.'}],
src:[['Troubleshooting Clusters',DBG+'debug-cluster/'],['Nodes',C+'architecture/nodes/'],['Node-pressure Eviction',C+'scheduling-eviction/node-pressure-eviction/']]};

/* ---------- 5: Control plane failures ---------- */
L['k8s:12:5']={blocks:[
{p:'On a kubeadm cluster the control plane is four static Pods managed by the kubelet from files on the control plane node. When something breaks, `kubectl` may stop working entirely, because it needs the very API server that is broken. This lecture gives you the procedure for working **below** the API.'},
{h:'How the pieces depend on each other'},
{flow:['kubelet reads /etc/kubernetes/manifests and starts the static Pods','etcd starts and holds the cluster data','kube-apiserver connects to etcd and serves the API on 6443','scheduler and controller manager connect to the API server using their kubeconfigs','Everything else (kubectl, kubelets, controllers) talks to the API server']},
{p:'Read that chain from the bottom: if the API server is down, check etcd and its own manifest; if the API server is up but nothing schedules, check the scheduler; and so on. Dependency order tells you what to inspect first.'},
{h:'Procedure when kubectl does not answer'},
{code:`# 1. From your machine: is it the API or your connection?
kubectl get --raw=/livez ; curl -k https://<api-endpoint>:6443/livez
# 2. SSH to a control plane node. Is the kubelet running?
sudo systemctl status kubelet
# 3. Are the control plane containers up?
sudo crictl ps -a | grep -E "kube-apiserver|etcd|kube-scheduler|kube-controller"
CONTAINER      IMAGE        CREATED         STATE     NAME             ATTEMPT
8a1f0c2e3d9b1  ...          2 minutes ago   Exited    kube-apiserver   7        # restarting repeatedly
# 4. Why did it exit?
sudo crictl logs --tail 30 $(sudo crictl ps -a --name kube-apiserver -q | head -1)
Error: unknown flag: --etcd-servrs                                          # a typo in the manifest
# 5. Check the kubelet view of manifests
sudo journalctl -u kubelet -n 50 --no-pager | grep -i -E "manifest|static|error"`},
{h:'Fault catalogue'},
{t:[['Symptom','What you will see','Cause and fix'],
['API server container exits at once','Log: `unknown flag` or `invalid value`','Typo in `kube-apiserver.yaml`; restore your backup copy and edit carefully'],
['API server up, errors about etcd','Log: `connection refused`, `context deadline exceeded` to 2379','etcd down, wrong `--etcd-servers`, wrong etcd certificate paths'],
['No static Pod appears after an edit','kubelet log: `can not process ... manifest`','YAML syntax or indentation error'],
['API server runs but kubelets and kubectl fail TLS','`x509: certificate has expired`','Renew certificates (`kubeadm certs renew`) and restart control plane Pods'],
['Pods never get scheduled, no events','Pending Pods with empty Events','kube-scheduler not running or crash-looping'],
['Deployments create no ReplicaSets; dead nodes not detected','Controller manager inactive','kube-controller-manager crashed, bad kubeconfig, expired certificate'],
['Scheduler or controller manager `Unauthorized`','Log: `Unauthorized` to the API','Its kubeconfig in `/etc/kubernetes/*.conf` has an expired or wrong certificate'],
['etcd restarts, API slow','Log: `mvcc: database space exceeded`','etcd quota reached: compact, defragment, `alarm disarm`'],
['Everything is down after a reboot','No containers at all','kubelet not enabled or swap on; `systemctl enable --now kubelet`']]},
{h:'Static Pod mechanics you must remember'},
{ul:['The kubelet watches **`/etc/kubernetes/manifests`** (the `staticPodPath` in `/var/lib/kubelet/config.yaml`). A file appearing starts a Pod; a file disappearing stops it; an edit recreates it.','**Never leave backup files** in that directory; the kubelet may try to start them. Keep backups outside, for example `/root/manifests-backup/`.','Deleting the mirror Pod with `kubectl` does nothing; manage the file.','To force a restart without editing, move the manifest out, wait a few seconds, then move it back.']},
{h:'etcd health and wiring checks'},
{code:`sudo ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key \\
  endpoint health --write-out=table
+------------------------+--------+-------------+-------+
|        ENDPOINT        | HEALTH |    TOOK     | ERROR |
+------------------------+--------+-------------+-------+
| https://127.0.0.1:2379 |   true | 8.113527ms  |       |
+------------------------+--------+-------------+-------+

# Do the API server flags agree with etcd?
sudo grep -E "etcd-servers|etcd-cafile|etcd-certfile|etcd-keyfile" /etc/kubernetes/manifests/kube-apiserver.yaml
sudo grep -E "data-dir|listen-client-urls|cert-file|key-file|trusted-ca-file" /etc/kubernetes/manifests/etcd.yaml
sudo ls -l /etc/kubernetes/pki /etc/kubernetes/pki/etcd
sudo grep "server:" /etc/kubernetes/*.conf              # every kubeconfig points at the right address?`},
{h:'Certificates and the clock'},
{code:`sudo kubeadm certs check-expiration
timedatectl                                             # a wrong date makes valid certificates look expired
sudo openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -dates -ext subjectAltName`},
{h:'Worked example: API server will not start after a manifest edit'},
{flow:['kubectl: connection refused','crictl ps -a shows kube-apiserver Exited with growing ATTEMPT','crictl logs shows the exact flag error','Restore the backup copy or fix the typo in the manifest','Wait for the kubelet to recreate the Pod (about 20 seconds)','kubectl get nodes works again; re-apply the intended change carefully']},
{note:'In break/fix tasks the injected fault is almost always small: a typo in a flag or path, a wrong port, a stopped service or a moved file. Read the **log of the failing component** before restoring anything.'}],
src:[['Troubleshooting kubeadm',K.S+'production-environment/tools/kubeadm/troubleshooting-kubeadm/'],['Troubleshooting Clusters',DBG+'debug-cluster/'],['Operating etcd clusters',T+'administer-cluster/configure-upgrade-etcd/']]};

/* ---------- 6: Service, DNS, network ---------- */
L['k8s:12:6']={blocks:[
{p:'"The service is not reachable" is the most common report and the most misdiagnosed, because several independent systems sit between the client and the application: DNS, the Service object, EndpointSlices, kube-proxy, the CNI, NetworkPolicy and the application itself. The way through is to **test each link separately** and let the result tell you which one is broken.'},
{h:'The path of a request'},
{flow:['Client Pod resolves the Service name through CoreDNS','The name returns the Service ClusterIP','kube-proxy rules on the client node translate ClusterIP to a ready Pod IP (DNAT)','The CNI carries the packet to the node of that Pod','A NetworkPolicy (if any) allows it','The application listens on the target port and answers']},
{h:'Step 1: Service and endpoints'},
{code:`$ kubectl get svc web -n shop -o wide
NAME   TYPE        CLUSTER-IP     PORT(S)   AGE   SELECTOR
web    ClusterIP   10.96.41.20    80/TCP    3d    app=web

$ kubectl get endpointslices -n shop -l kubernetes.io/service-name=web
NAME        ADDRESSTYPE   PORTS   ENDPOINTS   AGE
web-x7k2p   IPv4          8080    <unset>     3d          # no endpoints: stop here and find out why

$ kubectl get pods -n shop --show-labels
NAME      READY   STATUS    LABELS
web-abc   1/1     Running   app=webb          # label typo: app=webb does not match app=web`},
{t:[['What you see','Meaning','Fix'],
['Endpoints empty, Pods exist','Selector does not match Pod labels, or Pods are not Ready','Compare `SELECTOR` with `--show-labels`; check readiness'],
['Endpoints present, port wrong','`targetPort` differs from the container port','Match the port the app listens on'],
['Endpoints list only some Pods','The others fail readiness','Fix probes or the app'],
['Service has `targetPort` as a name that does not exist','Named port missing in the container','Fix the name in the Pod spec']]},
{h:'Step 2: isolate with a test Pod'},
{code:`kubectl run tmp -n shop --rm -it --image=busybox:1.36 --restart=Never -- sh
/ # nslookup web.shop.svc.cluster.local          # DNS
/ # wget -qO- -T 3 http://10.96.41.20:80         # by ClusterIP (bypasses DNS)
/ # wget -qO- -T 3 http://10.244.2.17:8080       # by Pod IP (bypasses the Service)
/ # nc -zv 10.244.2.17 8080`},
{t:[['Result','The broken link is'],
['Pod IP works, ClusterIP fails','The Service layer: selector, port mapping or kube-proxy'],
['ClusterIP works, name fails','DNS'],
['Pod IP works from the same node, fails from another','CNI or cross-node networking (firewall, MTU, overlay)'],
['Everything times out only from some namespaces','NetworkPolicy'],
['`Connection refused` on the Pod IP','Nothing listening on that port (or bound to 127.0.0.1 only)'],
['Timeout (no answer at all)','Packet dropped: NetworkPolicy, firewall, wrong IP']]},
{p:'The difference between **refused** and **timeout** is valuable. Refused means a host answered "nobody is listening". A timeout means the packets disappeared on the way: policy, firewall, routing.'},
{h:'Step 3: DNS'},
{code:`kubectl -n kube-system get pods -l k8s-app=kube-dns -o wide
kubectl -n kube-system logs -l k8s-app=kube-dns --tail=30
kubectl -n kube-system get svc kube-dns
kubectl -n kube-system get endpointslices -l kubernetes.io/service-name=kube-dns
kubectl exec tmp -- cat /etc/resolv.conf
# search shop.svc.cluster.local svc.cluster.local cluster.local
# nameserver 10.96.0.10
# options ndots:5`},
{t:[['Symptom','Cause'],
['Every lookup fails','CoreDNS Pods down, `kube-dns` has no endpoints, or the CNI is broken'],
['Cluster names work, external fail','`forward` upstream unreachable from CoreDNS'],
['Works sometimes','One CoreDNS replica unhealthy, conntrack race, overloaded CoreDNS'],
['Slow lookups','`ndots:5` search expansion; use fully qualified names or lower ndots'],
['CoreDNS `CrashLoopBackOff` with `Loop detected`','Node resolv.conf points at CoreDNS itself']]},
{h:'Step 4: kube-proxy, CNI and NetworkPolicy'},
{code:`kubectl -n kube-system get pods -o wide | grep -E "kube-proxy|calico|cilium|flannel"
kubectl -n kube-system logs ds/kube-proxy --tail=20
sudo iptables -t nat -L KUBE-SERVICES -n | grep 10.96.41.20     # does a rule exist for the ClusterIP? (iptables mode)
sudo nft list ruleset | grep 10.96.41.20                        # nftables mode
kubectl get netpol -A
kubectl describe netpol -n shop
ip route | head ; ping -c2 <other-node-pod-ip>                  # on a node: cross-node reachability
ip link show | grep mtu                                         # mismatched MTU breaks large packets only`},
{ul:['Small requests work but large responses hang: classic **MTU** problem on overlays.','Only one node fails: check kube-proxy and the CNI Pod on that node.','Traffic blocked after someone added a NetworkPolicy: `kubectl get netpol -A` and read what each selects.']},
{h:'Step 5: external access'},
{code:`kubectl describe ingress shop -n shop                    # backends and events
kubectl get svc -A | grep -E "LoadBalancer|NodePort"
curl -v -H "Host: shop.example.com" http://<ingress-address>/
kubectl -n ingress logs deploy/controller --tail=30`},
{t:[['Symptom','Cause'],
['Ingress `ADDRESS` empty','No controller for that IngressClass, or load balancer not provisioned'],
['404 from the controller','Host or path rule does not match'],
['503 from the controller','Backend Service has no ready endpoints'],
['LoadBalancer `<pending>`','No cloud controller or MetalLB; quota or permissions']]},
{note:'A single wrong label is the number one cause of "Service not working". Compare selector and Pod labels character by character before debugging anything deeper.'}],
src:[['Debug Services',DBG+'debug-application/debug-service/'],['Debugging DNS Resolution',T+'administer-cluster/dns-debugging-resolution/'],['Network Policies',C+'services-networking/network-policies/']]};

/* ---------- 7: Monitoring and logging ---------- */
L['k8s:12:7']={blocks:[
{p:'You cannot troubleshoot what you cannot see, and you cannot see yesterday unless something recorded it. Kubernetes gives you a small built-in view (current resource use and events) and expects you to add monitoring and logging for history. This lecture explains the built-in pieces and the standard architectures for the rest.'},
{h:'The built-in resource metrics pipeline'},
{flow:['The kubelet collects container usage with cAdvisor','Metrics Server scrapes every kubelet (about every 15 seconds)','It keeps only the latest sample in memory and serves it as the Metrics API (metrics.k8s.io)','kubectl top and the HorizontalPodAutoscaler read the Metrics API']},
{code:`$ kubectl top nodes
NAME      CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
worker1   412m         20%    3105Mi          39%
worker2   1830m        91%    7410Mi          93%       # hot node

$ kubectl top pods -A --sort-by=memory | head -n 5
$ kubectl top pod web-6d4f8b7c9-4xk2p -n shop --containers
$ kubectl get apiservice v1beta1.metrics.k8s.io           # AVAILABLE must be True`},
{ul:['`kubectl top` shows **usage**, not requests. Compare the two (`kubectl describe node` shows allocated requests) to find over- and under-provisioning.','Metrics Server is **not a monitoring system**: no history, no alerts, no custom metrics.','`error: Metrics API not available` means Metrics Server is missing or its APIService is unhealthy; on labs with self-signed kubelet certificates it often needs `--kubelet-insecure-tls`.']},
{h:'Three kinds of signals'},
{t:[['Signal','Question it answers','Typical tools','Cost profile'],
['**Metrics**','How much, how fast, how often? Trends and alerts','Prometheus, Grafana, cloud monitoring','Cheap, numeric, aggregated'],
['**Logs**','What exactly happened at that moment?','Fluent Bit, Vector, Loki, Elasticsearch','Volume grows with traffic'],
['**Traces**','Where did this request spend its time across services?','OpenTelemetry, Jaeger, Tempo','Sampled, higher effort']]},
{h:'Logging architecture'},
{p:'Containers write to **stdout and stderr**. The runtime stores these as files on the node under `/var/log/pods` and `/var/log/containers`, and the kubelet rotates them (by default around 10 Mi per file and 5 files per container). When a Pod is deleted its files go with it.'},
{t:[['Pattern','How it works','Strengths','Weaknesses'],
['**Node-level agent (standard)**','A DaemonSet (Fluent Bit, Vector) reads log files on every node and ships them to a backend','No change to apps; one agent per node; survives Pod deletion once shipped','Needs file access to node; the agent itself must be resourced'],
['**Sidecar**','A container in the Pod reads application files and writes to stdout or ships directly','Works for apps that only write files','More containers; more resources per Pod'],
['**Application pushes directly**','The app sends logs to a backend over the network','Rich structured logs','Tied to app code; lost if the app crashes before sending']]},
{code:`ls /var/log/pods/ | head                                  # on a node: <namespace>_<pod>_<uid>/<container>/0.log
ls /var/log/containers | head
sudo journalctl -u kubelet --since "10 min ago"           # kubelet is not a container: systemd journal
kubectl -n logging get ds                                 # the cluster-level log agent
# Control plane static Pod logs when the API is down:
sudo crictl logs <container-id>`},
{h:'What to alert on'},
{t:[['Area','Alert examples'],
['Nodes','NotReady for more than a few minutes; DiskPressure, MemoryPressure; filesystem above 85 percent'],
['Workloads','Pod restarts rising; Pods Pending for long; Deployment replicas unavailable; Job failures'],
['Control plane','API server error rate and latency; etcd leader changes, fsync latency, database size; certificate expiry within 30 days'],
['Platform','Backup job failures; autoscaler errors; CoreDNS errors; ingress 5xx rate'],
['Application','Golden signals: latency, traffic, errors, saturation']]},
{h:'Common mistakes'},
{ul:['No log shipping: a crash that deletes the Pod also deletes the evidence.','Logging agent without requests and limits; it can starve application Pods on busy nodes.','Alerting on causes (CPU high) instead of user-visible symptoms (error rate), producing noise.','Treating Metrics Server as monitoring; it has no history.','Retention too short for investigations that surface days later.']},
{note:'Design for the incident you will have: when a Pod crashes at 3 am, can you still read its last logs tomorrow, see its memory trend and find the related events? If not, add the missing piece before you need it.'}],
src:[['Logging Architecture',C+'cluster-administration/logging/'],['Resource metrics pipeline',DBG+'debug-cluster/resource-metrics-pipeline/'],['Metrics Server','https://github.com/kubernetes-sigs/metrics-server']]};

/* ---------- 8: Break/fix ---------- */
L['k8s:12:8']={blocks:[
{p:'This lecture is practice, not theory. Break/fix skill comes only from repetition under time pressure. Set up a throwaway kubeadm cluster (one control plane, two workers) and work through the scenarios. Ideally have someone else inject the faults, or inject them yourself and wait a day so you do not remember them. Aim for **5 to 10 minutes per scenario**, and write down the first command you ran and how long it took to find the cause.'},
{h:'How to practise'},
{flow:['Inject one fault (do not read the solution)','State the symptom in one sentence from what you observe','Walk the layers: workload, Pod, Service, node, control plane','Fix it with the smallest change','Verify with a read-only command and write down the cause']},
{h:'Scenario A: Pods stay Pending'},
{code:`kubectl create ns bf && kubectl -n bf create deployment app --image=nginx:1.27 --replicas=3
kubectl -n bf patch deployment app --type=json -p '[{"op":"add","path":"/spec/template/spec/containers/0/resources","value":{"requests":{"cpu":"64"}}}]'
# Task: find out why new Pods are Pending and fix it without deleting the Deployment.`},
{p:'**Expected path:** `get pods` (Pending), `describe pod` shows `0/3 nodes are available: Insufficient cpu`, the request of 64 CPUs is impossible. Fix with `kubectl -n bf set resources deployment app --requests=cpu=100m`, then `rollout status`. **Lesson:** the scheduler message lists the reason for each node.'},
{h:'Scenario B: Service has no endpoints'},
{code:`kubectl -n bf expose deployment app --port=80
kubectl -n bf patch svc app -p '{"spec":{"selector":{"app":"web"}}}'
# Task: make "wget http://app" work from a Pod in namespace bf.`},
{p:'**Expected path:** `get endpointslices` is empty, `get svc -o wide` shows SELECTOR `app=web`, `get pods --show-labels` shows `app=app`. Fix the selector with `kubectl -n bf patch svc app -p ...`. **Lesson:** compare selector and labels first.'},
{h:'Scenario C: container will not start'},
{code:`kubectl -n bf create deployment cfg --image=busybox:1.36 -- sh -c 'echo $DB_HOST; sleep 3600'
kubectl -n bf set env deployment/cfg --from=configmap/does-not-exist
# Task: find the exact reason the Pod does not start and fix it.`},
{p:'**Expected path:** status `CreateContainerConfigError`; `describe pod` names the missing ConfigMap. Create it (`kubectl -n bf create configmap does-not-exist --from-literal=DB_HOST=db`) or remove the reference. **Lesson:** a missing config object is a different failure from a bad image.'},
{h:'Scenario D: node NotReady'},
{code:`# On a worker (run in the node shell)
sudo systemctl stop kubelet
# Task: from the control plane find which node is NotReady, SSH there, find the cause and restore it.`},
{p:'**Expected path:** `kubectl get nodes` shows NotReady after about 40 seconds; `describe node` shows "Kubelet stopped posting node status"; on the node `systemctl status kubelet` shows inactive. Fix with `sudo systemctl start kubelet`. Variant: also try `sudo systemctl disable --now containerd` and see the different symptom (`container runtime is down`).'},
{h:'Scenario E: nothing gets scheduled'},
{code:`# On the control plane node
sudo mv /etc/kubernetes/manifests/kube-scheduler.yaml /tmp/
kubectl -n bf scale deployment app --replicas=5       # new Pods stay Pending with NO events
# Task: restore scheduling.`},
{p:'**Expected path:** new Pods are Pending with an empty Events section, which points away from resources and toward "nobody is scheduling". `crictl ps` shows no scheduler container. Move the manifest back; the kubelet recreates it. **Lesson:** no events at all is itself a clue.'},
{h:'Scenario F: kubectl stops working'},
{code:`# On the control plane node. KEEP A BACKUP FIRST.
sudo cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak
sudo sed -i 's#--etcd-servers=https://127.0.0.1:2379#--etcd-servers=https://127.0.0.1:2399#' /etc/kubernetes/manifests/kube-apiserver.yaml
# kubectl now fails. Task: diagnose with crictl and the kubelet log, then repair.`},
{p:'**Expected path:** `kubectl` refuses connections; `crictl ps -a` shows the API server restarting; `crictl logs` shows it cannot reach etcd on port 2399; the manifest shows the wrong port. Restore the backup. **Lesson:** below the API you work with `crictl`, logs and manifests.'},
{h:'Scenario G: a NetworkPolicy blocks traffic'},
{code:`kubectl -n bf run client --image=busybox:1.36 --restart=Never -- sleep 3600
kubectl -n bf apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: deny}
spec: {podSelector: {}, policyTypes: [Ingress]}
EOF
# Task: the client can no longer reach the app Service. Allow only the client Pod.`},
{p:'**Expected path:** a timeout (not a refusal) points at policy; `kubectl get netpol` shows the deny; add an allow policy selecting `app=app` Pods with `from` the client label. Needs a CNI that enforces NetworkPolicy.'},
{h:'Scoring yourself'},
{t:[['Measure','Good','Needs work'],
['First command is read-only','Always','You changed something before reading Events'],
['Time to state the cause','Under 5 minutes','More than 10 minutes'],
['Fix size','One small change','Several changes, or deleting and recreating'],
['Verification','You checked with a command','You assumed it worked']]},
{ul:['Which scenario cost the most time and why? Write a one-line checklist for it.','Repeat the ones you fumbled the next day with a fresh injection.','Add your own faults: a wrong image tag, a full disk, an expired certificate, a missing PVC.']},
{h:'Clean up'},
{code:`kubectl delete ns bf
# restore any manifest you moved back to /etc/kubernetes/manifests and start any stopped service
sudo systemctl start kubelet containerd`},
{note:'Exam tip: when a break/fix task looks big, run the five-minute triage from the first lecture of this section. The first abnormal line it prints is usually where to begin.'}],
src:[['Troubleshooting Applications',DBG+'debug-application/'],['Troubleshooting Clusters',DBG+'debug-cluster/']]};

/* ---------- Additional content ---------- */
/* 9: Prometheus and Grafana */
L['k8s:12:9']={blocks:[
{p:'**Prometheus** scrapes metrics over HTTP, stores them as time series and evaluates alert rules. **Grafana** draws dashboards from them. Together they are the standard open source monitoring stack for Kubernetes.'},
{svg:K.dg(700,210,[
[10,70,130,60,'Targets|kubelet, cAdvisor,|kube-state-metrics, apps',0],[190,70,140,60,'Prometheus|scrape, store, rules',2],[380,20,130,50,'Alertmanager|route, group, silence',0],[380,140,130,50,'Grafana|dashboards',0],[560,20,130,50,'Pager, chat, email',0]],
[[140,100,190,100],[330,85,380,50],[330,115,380,160],[510,45,560,45]])},
{h:'Install with kube-prometheus-stack'},
{code:`helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
kubectl -n monitoring get pods
kubectl -n monitoring port-forward svc/monitoring-grafana 3000:80       # admin password is in a Secret
kubectl -n monitoring port-forward svc/monitoring-kube-prometheus-prometheus 9090`},
{p:'The chart installs the **Prometheus Operator**, which turns CRDs into configuration, plus node-exporter on every node, kube-state-metrics, Alertmanager, Grafana and default dashboards and alerts.'},
{h:'Where the data comes from'},
{t:[['Source','What it provides'],
['**kubelet / cAdvisor**','Container CPU, memory, network and filesystem usage'],
['**kube-state-metrics**','Object state: Pod phases, Deployment replicas, node conditions, Job status'],
['**node-exporter**','Node CPU, memory, disk and network from the OS'],
['**API server, scheduler, controller manager, etcd**','Control plane health, latency, queue depth'],
['**Your applications**','`/metrics` endpoints with request rate, errors, latency']]},
{h:'Scraping your app with ServiceMonitor'},
{code:`apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata: {name: shop, namespace: shop, labels: {release: monitoring}}
spec:
  selector: {matchLabels: {app: shop}}
  endpoints:
  - {port: metrics, interval: 30s, path: /metrics}`},
{h:'Useful PromQL'},
{code:`sum(rate(container_cpu_usage_seconds_total{namespace="shop"}[5m])) by (pod)
sum(container_memory_working_set_bytes{namespace="shop"}) by (pod)
kube_pod_container_status_restarts_total > 3
sum(kube_pod_status_phase{phase="Pending"}) by (namespace)
kube_deployment_status_replicas_unavailable > 0
histogram_quantile(0.99, sum(rate(apiserver_request_duration_seconds_bucket[5m])) by (le, verb))
(node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.15`},
{h:'An alert rule'},
{code:`apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata: {name: shop-alerts, namespace: shop, labels: {release: monitoring}}
spec:
  groups:
  - name: shop
    rules:
    - alert: PodCrashLooping
      expr: increase(kube_pod_container_status_restarts_total{namespace="shop"}[15m]) > 3
      for: 5m
      labels: {severity: warning}
      annotations: {summary: "{{ $labels.pod }} restarting repeatedly"}`},
{ul:['Alert on **symptoms** users feel (error rate, latency, saturation), not only on causes.','Use the **four golden signals**: latency, traffic, errors, saturation. Use `for:` to avoid flapping.','Send alerts to Alertmanager and route by severity; every alert needs an owner and a runbook link.','Set retention and storage for Prometheus; long-term storage needs Thanos, Mimir or remote write.','Watch **cardinality**: labels with unbounded values (user IDs) can overwhelm Prometheus.']},
{note:'Version and chart values change often. Read the current chart documentation and review which default alerts are enabled before relying on them.'}],
src:[['Prometheus','https://prometheus.io/docs/'],['kube-prometheus-stack','https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack'],['Grafana','https://grafana.com/docs/grafana/latest/'],['Metrics for Kubernetes system components',K.C+'cluster-administration/system-metrics/']]};

/* 10: OpenTelemetry */
L['k8s:12:10']={blocks:[
{p:'Metrics tell you **that** something is slow. **Distributed tracing** shows **where** in a chain of services the time went. **OpenTelemetry (OTel)** is the vendor-neutral standard for producing and shipping traces, metrics and logs.'},
{h:'Concepts'},
{t:[['Term','Meaning'],
['**Trace**','The journey of one request through many services'],
['**Span**','One timed operation within a trace (an HTTP call, a database query), with attributes and a parent'],
['**Context propagation**','Trace and span IDs carried in headers (W3C `traceparent`) from service to service'],
['**SDK / auto-instrumentation**','Libraries or agents inside the application that create spans'],
['**Collector**','A service that receives, processes (batch, filter, add Kubernetes metadata) and exports telemetry to backends']]},
{h:'Typical architecture in Kubernetes'},
{flow:['Applications emit OTLP (traces, metrics, logs) with an SDK or an auto-instrumentation agent','A Collector runs as a DaemonSet (per node) and/or a Deployment (gateway)','The Collector adds Kubernetes attributes (namespace, Pod, node) and batches data','It exports to backends: Jaeger or Tempo for traces, Prometheus or Mimir for metrics, Loki for logs','Grafana correlates metrics, logs and traces']},
{code:`helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm install otel-collector open-telemetry/opentelemetry-collector -n observability --create-namespace \\
  --set mode=daemonset --set image.repository=otel/opentelemetry-collector-k8s`},
{code:`# collector config excerpt
receivers:
  otlp: {protocols: {grpc: {endpoint: 0.0.0.0:4317}, http: {endpoint: 0.0.0.0:4318}}}
processors:
  k8sattributes: {}
  batch: {}
exporters:
  otlp/tempo: {endpoint: tempo.observability:4317, tls: {insecure: true}}
service:
  pipelines:
    traces: {receivers: [otlp], processors: [k8sattributes, batch], exporters: [otlp/tempo]}`},
{code:`# Application Pod: point the SDK at the collector with standard environment variables
env:
- {name: OTEL_EXPORTER_OTLP_ENDPOINT, value: "http://otel-collector.observability:4317"}
- {name: OTEL_SERVICE_NAME, value: "shop-api"}
- {name: OTEL_RESOURCE_ATTRIBUTES, value: "deployment.environment=prod"}
- {name: OTEL_TRACES_SAMPLER, value: "parentbased_traceidratio"}
- {name: OTEL_TRACES_SAMPLER_ARG, value: "0.1"}`},
{ul:['The **OpenTelemetry Operator** can inject auto-instrumentation into Pods (Java, Python, Node.js, .NET, Go) through an annotation.','**Sampling** controls cost: sample a fraction of traces, or use tail sampling in the Collector to keep errors and slow requests.','Kubernetes components themselves can also emit traces (API server and kubelet tracing options), useful for control plane investigations.','Include **trace IDs in logs** so you can jump from a log line to its trace.']},
{note:'Start with one critical request path, instrument it end to end and learn what you actually need before instrumenting everything.'}],
src:[['OpenTelemetry','https://opentelemetry.io/docs/'],['OpenTelemetry on Kubernetes','https://opentelemetry.io/docs/kubernetes/'],['Traces for Kubernetes System Components',K.C+'cluster-administration/system-traces/']]};

/* 11: crictl */
L['k8s:12:11']={blocks:[
{p:'When the API server is down, `kubectl` cannot help. **`crictl`** talks directly to the container runtime on a node, so you can inspect Pods, containers and images, and read logs, with no control plane at all.'},
{h:'Setup'},
{code:`# /etc/crictl.yaml
runtime-endpoint: unix:///run/containerd/containerd.sock
image-endpoint: unix:///run/containerd/containerd.sock
timeout: 10
debug: false
# or per command: crictl --runtime-endpoint unix:///run/containerd/containerd.sock ps`},
{h:'Everyday commands'},
{t:[['Goal','Command'],
['List running containers (all, including exited)','`crictl ps`, `crictl ps -a`'],
['Filter by name or state','`crictl ps --name kube-apiserver`, `crictl ps -a --state exited`'],
['List Pod sandboxes','`crictl pods`, `crictl pods --name coredns`'],
['Container logs','`crictl logs <id>`, `crictl logs --tail 50 -f <id>`'],
['Inspect (JSON: mounts, env, state, exit code)','`crictl inspect <id>`, `crictl inspectp <pod-id>`'],
['Run a command in a container','`crictl exec -it <id> sh`'],
['Images','`crictl images`, `crictl pull`, `crictl rmi <img>`, `crictl rmi --prune`'],
['Resource use','`crictl stats`'],
['Runtime information and config','`crictl info`, `crictl version`'],
['Stop or remove (careful)','`crictl stop <id>`, `crictl rm <id>`, `crictl stopp <pod-id>`, `crictl rmp <pod-id>`']]},
{h:'Control plane triage on a node'},
{code:`sudo crictl ps -a | grep -E "kube-apiserver|etcd|scheduler|controller"
sudo crictl logs --tail 100 $(sudo crictl ps -a --name kube-apiserver -q | head -1)
sudo crictl inspect $(sudo crictl ps -a --name etcd -q | head -1) | jq '.status.exitCode, .status.reason, .status.message'
sudo crictl pods | grep kube-system
sudo ls /var/log/pods/ /var/log/containers | head`},
{ul:['Control plane containers of a kubeadm cluster are in the **`k8s.io`** containerd namespace; `crictl` sees them without extra flags.','Logs are also files in `/var/log/pods/<namespace>_<pod>_<uid>/<container>/` and `/var/log/containers/`.','`crictl` shows **CRI** objects (Pods and containers); `ctr -n k8s.io containers ls` is containerd own view.','Deleting containers with `crictl` is a last resort: the kubelet will recreate them from its desired state.']},
{h:'Image and disk problems'},
{code:`sudo crictl images | head
sudo crictl imagefsinfo
df -h /var/lib/containerd
sudo crictl rmi --prune                         # remove unused images to relieve DiskPressure
sudo journalctl -u containerd -n 50 --no-pager`},
{note:'`crictl` ships separately from kubeadm (cri-tools package). Install it on every node you manage, and set the endpoint file once, so it works when you need it in an incident.'}],
src:[['Debugging Kubernetes nodes with crictl',K.T+'debug/debug-cluster/crictl/'],['cri-tools','https://github.com/kubernetes-sigs/cri-tools']]};

/* 12: API server and etcd performance */
L['k8s:12:12']={blocks:[
{p:'A slow control plane makes everything feel broken: deploys lag, controllers fall behind, `kubectl` hangs. Find whether the time is spent in the API server, in etcd or in clients.'},
{h:'Look at the API server first'},
{code:`# Request latency by verb (p99)
histogram_quantile(0.99, sum(rate(apiserver_request_duration_seconds_bucket{verb!~"WATCH|CONNECT"}[5m])) by (le, verb, resource))
# Request rate and errors by code
sum(rate(apiserver_request_total[5m])) by (code)
# Requests waiting or rejected by priority and fairness
sum(rate(apiserver_flowcontrol_rejected_requests_total[5m])) by (priority_level, reason)
apiserver_flowcontrol_current_inqueue_requests
# Inflight requests and etcd request latency as seen by the API server
apiserver_current_inflight_requests
histogram_quantile(0.99, sum(rate(etcd_request_duration_seconds_bucket[5m])) by (le, operation, type))`},
{t:[['Observation','Likely cause'],
['High etcd request latency from the API server','etcd is slow: disk, size, network (see below)'],
['Latency high, etcd fine','Webhooks (slow admission), aggregated APIs, expensive list calls, CPU starvation of the API server'],
['Many `429` and APF rejections','A client is flooding: find it in audit logs or `apiserver_flowcontrol_*` metrics'],
['Large memory use','Big lists across many clients, large objects, many watches']]},
{h:'Spot slow or heavy requests'},
{code:`kubectl get --raw /metrics | grep -E "apiserver_request_duration_seconds_(sum|count)" | head
# with audit logging: slowest or most frequent users
sudo jq -r 'select(.verb=="list") | [.user.username,.objectRef.resource,.requestURI] | @tsv' /var/log/kubernetes/audit/audit.log | sort | uniq -c | sort -rn | head
kubectl get --raw "/debug/api_priority_and_fairness/dump_priority_levels"
kubectl get --raw "/readyz?verbose" | head -30`},
{h:'Large objects and many objects'},
{ul:['etcd limits a single request to about **1.5 MiB** by default; ConfigMaps and Secrets are capped around 1 MiB.','Count objects by kind to find churn: events, Jobs, custom resources, ConfigMaps.','Clean up finished Jobs (`ttlSecondsAfterFinished`), old ReplicaSets (`revisionHistoryLimit`), and Events.','Use field and label selectors and pagination in controllers; avoid listing everything repeatedly.']},
{code:`kubectl get --raw /metrics | grep apiserver_storage_objects | sort -t' ' -k2 -nr | head      # objects per resource (sorted)
kubectl get events -A --no-headers | wc -l
kubectl get jobs -A --no-headers | wc -l`},
{h:'etcd storage latency'},
{ul:['`etcd_disk_wal_fsync_duration_seconds` and `etcd_disk_backend_commit_duration_seconds` p99: if high, the disk is the cause.','Quick check from the node: `fio` with fdatasync to measure the data disk (use the etcd documented test).','Look for noisy neighbours on the same disk (image pulls, logs) and for CPU throttling of etcd.','Compact and defragment when the database is large but mostly free (previous section).']},
{note:'Fix in this order: disk latency, then excessive object counts and heavy clients, then webhooks, then scale (more or larger control plane nodes). Adding control plane nodes does not make etcd writes faster.'}],
src:[['Metrics for Kubernetes system components',K.C+'cluster-administration/system-metrics/'],['API Priority and Fairness',K.C+'cluster-administration/flow-control/'],['etcd performance','https://etcd.io/docs/latest/op-guide/performance/']]};

/* 13: Runbook */
L['k8s:12:13']={blocks:[
{p:'A quick map from the message you see to the most likely cause and the first command to run. Keep it next to your terminal.'},
{h:'Pod and workload errors'},
{t:[['Message or state','Likely cause','First step'],
['`ImagePullBackOff` / `ErrImagePull`','Wrong image or tag, missing pull secret, registry unreachable or rate limited','`kubectl describe pod` Events; check secret in the same namespace'],
['`CrashLoopBackOff`','App exits: bad config, missing dependency, failing probe','`kubectl logs --previous`, exit code'],
['`OOMKilled`, exit 137','Memory limit too low or a leak','`kubectl describe pod` Last State; `kubectl top`'],
['`CreateContainerConfigError`','Missing ConfigMap or Secret or key','`kubectl describe pod`'],
['`Pending` with `Insufficient cpu/memory`','Requests too large, nodes full','`kubectl describe pod`, `kubectl describe node`'],
['`Pending` with `untolerated taint` / `didn\'t match node selector`','Taints, selectors, affinity','Compare Pod spec with node labels and taints'],
['`Pending` with `unbound immediate PersistentVolumeClaims`','No StorageClass or provisioner problem','`kubectl describe pvc`'],
['`volume node affinity conflict`','Volume lives in a zone the Pod cannot use','Check PV node affinity and Pod placement rules'],
['`Evicted`','Node pressure (disk or memory)','`kubectl describe node` Conditions'],
['`Terminating` forever','Finalizer, stuck volume, unreachable node','`kubectl get pod -o yaml` finalizers; node status'],
['`0/1 Ready`','Readiness probe failing','`kubectl describe pod` probe lines, app logs']]},
{h:'API and authorization errors'},
{t:[['Message','Likely cause','First step'],
['`Unauthorized` (401)','Bad or expired credentials','`kubectl auth whoami`, kubeconfig, token or certificate expiry'],
['`Forbidden` (403): `cannot list resource ...`','No RBAC permission','`kubectl auth can-i ... --as`, check bindings'],
['`exceeded quota`','ResourceQuota full','`kubectl describe quota`'],
['`admission webhook ... denied the request`','A policy webhook rejected it','Read the message; check the webhook and policy'],
['`violates PodSecurity`','Pod Security Admission','Namespace labels, securityContext'],
['`no matches for kind ... in version ...`','Wrong or removed apiVersion, missing CRD','`kubectl api-resources`, `kubectl explain`'],
['`x509: certificate has expired or is not yet valid`','Expired certificate or wrong clock','`kubeadm certs check-expiration`, `timedatectl`'],
['`x509: certificate is valid for ..., not ...`','SAN missing for the address used','Check the API server certificate SANs'],
['`connection refused` to :6443','API server down or wrong endpoint','`crictl ps`, kubeconfig server address, load balancer'],
['`etcdserver: request timed out` / `mvcc: database space exceeded`','Slow disk, etcd full','etcd metrics, `alarm list`, defrag']]},
{h:'Node, networking and storage'},
{t:[['Message or symptom','Likely cause','First step'],
['Node `NotReady`','kubelet stopped, runtime down, CNI missing','`systemctl status kubelet`, `journalctl -u kubelet`'],
['`cni plugin not initialized`','CNI not installed or crashing','CNI DaemonSet Pods, `/etc/cni/net.d`'],
['`container runtime is down`','containerd stopped','`systemctl status containerd`, socket path'],
['Service has no endpoints','Selector mismatch or Pods not Ready','`kubectl get endpointslices`, labels'],
['Name does not resolve','CoreDNS or `kube-dns` problem','`kubectl -n kube-system logs -l k8s-app=kube-dns`'],
['Timeout between Pods','NetworkPolicy, firewall, MTU','`kubectl get netpol`, test with debug Pod'],
['`Multi-Attach error for volume`','RWO volume still attached to another node','`kubectl get volumeattachments`, wait or detach'],
['`MountVolume.SetUp failed`','Missing Secret or ConfigMap, driver or permission problem','`kubectl describe pod`, CSI node logs'],
['`FailedScheduling: too many pods`','Node maxPods reached','Spread or add nodes'],
['`LoadBalancer` `<pending>`','No cloud controller or load balancer implementation','CCM or MetalLB, cloud quota and permissions']]},
{note:'Add your own entries after every incident: message, cause, fix. A runbook that grows from real failures is the most useful one.'}],
src:[['Troubleshooting Applications',K.T+'debug/debug-application/'],['Troubleshooting Clusters',K.T+'debug/debug-cluster/'],['Debug Services',K.T+'debug/debug-application/debug-service/']]};
})();
