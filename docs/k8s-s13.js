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
{p:'Troubleshooting is the heaviest CKA domain (30%) and the skill that separates operators from people who only install. The difference is **method**: a fixed order of checks that stops you guessing.'},
{svg:topdown},
{h:'The loop'},
{flow:['Observe: what exactly is failing, since when, for whom?','Hypothesise from the status and events','Test one hypothesis with a read-only command','Fix one thing','Verify and note the cause']},
{h:'Top-down checks'},
{t:[['Level','Question','Commands'],
['Workload','Does the controller have the right replicas and a healthy rollout?','`kubectl get deploy,rs,job`, `kubectl rollout status`'],
['Pod','Is it scheduled, started and ready?','`kubectl get pod -o wide`, `describe`, `logs`'],
['Service','Do selectors match, and are there endpoints?','`kubectl get svc,endpointslices`, DNS test from a Pod'],
['Node','Is the node Ready and healthy?','`kubectl get nodes`, `describe node`, kubelet and runtime on the node'],
['Control plane','Are the API server, etcd, scheduler and controllers healthy?','`kubectl get --raw=/readyz?verbose`, static Pod manifests, `crictl`']]},
{h:'Habits that save time'},
{ul:['**Read the Events** first: `kubectl describe` and `kubectl get events --sort-by=.lastTimestamp`.','Check **namespace and context** before anything else.','Change **one thing at a time**, and write down what you changed so you can undo it.','Prefer read-only commands until you know the cause.','If the API server does not respond, you are no longer a kubectl user: go to the node and use `systemctl`, `journalctl` and `crictl`.','Compare with a **working** sibling (another Pod, node or namespace). The difference is usually the cause.']},
{code:`kubectl config current-context
kubectl get nodes
kubectl get pods -A | grep -v -E "Running|Completed"
kubectl get events -A --sort-by=.lastTimestamp | tail -n 20
kubectl get --raw=/readyz?verbose | grep -v ok`},
{note:'In the exam, each task is worth a few points and time is limited. If you are stuck for more than a few minutes, flag the task and come back. A partial fix on three tasks beats a perfect fix on one.'}],
src:[['Troubleshooting Applications',DBG+'debug-application/'],['Troubleshooting Clusters',DBG+'debug-cluster/']]};

/* ---------- 1: Logs, describe, events, exec ---------- */
L['k8s:12:1']={blocks:[
{p:'Four commands answer most questions. Learn exactly what each one shows.'},
{h:'describe: state and Events'},
{code:`kubectl describe pod web-7d9f -n shop
# Status / Reason / Message, Containers (State, Last State, Exit Code, Restart Count),
# Conditions (PodScheduled, Initialized, ContainersReady, Ready),
# Volumes, QoS Class, Node-Selectors, Tolerations, and at the bottom: Events`},
{p:'Events are short-lived (about an hour) and held by the API server. If you arrive late, they may be gone, so look at the container **Last State** and the logs.'},
{h:'Events across the cluster'},
{code:`kubectl get events -n shop --sort-by=.lastTimestamp
kubectl get events -A --field-selector type=Warning
kubectl events --for pod/web-7d9f -n shop              # newer, sorted output`},
{h:'logs'},
{code:`kubectl logs web-7d9f                    # current container
kubectl logs web-7d9f -c sidecar         # a specific container
kubectl logs web-7d9f --previous         # the last crashed instance (use for CrashLoopBackOff)
kubectl logs -f web-7d9f --tail=50       # follow
kubectl logs -l app=web --all-containers --prefix --tail=20
kubectl logs deploy/web                  # one Pod of the Deployment
kubectl logs web-7d9f --since=15m --timestamps`},
{ul:['A Pod that is Pending or still `ContainerCreating` has **no logs** yet; use describe.','Logs live on the node and disappear when the Pod is deleted. Ship them to a log system for history.','`kubectl logs` for **init containers**: add `-c <init-container-name>`.']},
{h:'exec'},
{code:`kubectl exec -it web-7d9f -- sh
kubectl exec web-7d9f -c app -- env | sort
kubectl exec web-7d9f -- cat /etc/resolv.conf
kubectl exec web-7d9f -- wget -qO- -T 3 http://api:8080/health
kubectl exec web-7d9f -- ls -l /var/run/secrets/kubernetes.io/serviceaccount`},
{p:'Minimal images may have **no shell**. Then use an ephemeral debug container (next lecture) instead of rebuilding the image.'},
{h:'Reading container state'},
{code:`kubectl get pod web-7d9f -o jsonpath='{.status.containerStatuses[0].lastState}'
# {"terminated":{"exitCode":137,"reason":"OOMKilled", ...}}
kubectl get pod web-7d9f -o jsonpath='{.status.containerStatuses[*].restartCount}'`},
{t:[['Exit code','Typical meaning'],['0','Finished normally'],['1','Application error'],['126 / 127','Command not executable / not found'],['137','Killed by SIGKILL: often OOM, or a failed liveness probe grace timeout'],['139','Segmentation fault'],['143','Terminated by SIGTERM']]}],
src:[['Debug Pods',DBG+'debug-application/debug-pods/'],['Determine the Reason for Pod Failure',DBG+'debug-application/determine-reason-pod-failure/'],['kubectl logs',R+'kubectl/generated/kubectl_logs/']]};

/* ---------- 2: kubectl debug ---------- */
L['k8s:12:2']={blocks:[
{p:'Production images are often minimal: no shell, no `curl`, no `ps`. **`kubectl debug`** gives you a toolbox without changing the image.'},
{h:'Ephemeral containers'},
{p:'An **ephemeral container** is added to a **running** Pod, shares its namespaces and is removed with the Pod. It cannot be restarted, has no ports or probes and is meant only for debugging. The feature is stable in current releases.'},
{code:`kubectl debug -it web-7d9f --image=busybox:1.36 --target=app
# --target=app shares the process namespace of container "app" so you can see its processes
# inside: ps aux; ls /proc/1/root/ ; wget -qO- localhost:8080 ; nslookup db

kubectl debug -it web-7d9f --image=nicolaka/netshoot --target=app -- bash
kubectl get pod web-7d9f -o jsonpath='{.spec.ephemeralContainers[*].name}'`},
{h:'Debug a copy of the Pod'},
{p:'When you need to change the spec (a different command, image or env) without touching the live Pod:'},
{code:`# Copy with the command replaced by sleep, so a crashing container stays up
kubectl debug web-7d9f -it --copy-to=web-debug --container=app -- sh

# Copy with a different image
kubectl debug web-7d9f --copy-to=web-debug --set-image=app=myapp:debug

# Copy sharing the process namespace and with an extra tool container
kubectl debug web-7d9f -it --copy-to=web-debug --image=busybox:1.36 --share-processes

kubectl delete pod web-debug`},
{h:'Debug a node'},
{code:`kubectl debug node/worker1 -it --image=busybox:1.36
# A Pod is created on that node with the host filesystem mounted at /host
chroot /host                    # (if the image has chroot) run host commands such as journalctl
ls /host/var/log/pods
# when finished, delete the debug Pod it created
kubectl get pods | grep node-debugger
kubectl delete pod node-debugger-worker1-xxxxx`},
{ul:['Node debugging is for **read-mostly** inspection. It still needs permissions to create Pods in the chosen namespace, and PSA may block host mounts.','If you can SSH to the node, `systemctl`, `journalctl` and `crictl` are often simpler.','Debug containers need the same RBAC as `pods/ephemeralcontainers`.']},
{note:'Clean up copies and node-debugger Pods afterwards. A forgotten copy can still hold resources, volumes and a duplicate of production traffic if it matches a Service selector. Remove labels with `--keep-labels=false` (the default drops them) to avoid receiving traffic.'}],
src:[['Debug Running Pods',DBG+'debug-application/debug-running-pod/'],['Ephemeral Containers',C+'workloads/pods/ephemeral-containers/'],['Debugging Kubernetes nodes with kubectl',DBG+'debug-cluster/kubectl-node-debug/']]};

/* ---------- 3: Pod failures ---------- */
L['k8s:12:3']={blocks:[
{p:'Four Pod problems cover most workload tickets. For each, know the meaning, the usual causes and the one command that confirms it.'},
{svg:states},
{h:'Pending'},
{ul:['**Meaning**: accepted by the API but not running. Either not scheduled, or waiting for something (volume, image).','**Confirm**: `kubectl describe pod` shows `FailedScheduling` and a reason per node.','**Causes**: insufficient CPU or memory, untolerated taint, node selector or affinity mismatch, unbound PVC, quota exceeded, no nodes Ready.']},
{code:`kubectl describe pod web | sed -n '/Events:/,$p'
# 0/3 nodes are available: 1 node(s) had untolerated taint, 2 Insufficient memory.
kubectl get pvc ; kubectl describe resourcequota -n shop ; kubectl get nodes`},
{h:'ImagePullBackOff / ErrImagePull'},
{ul:['**Confirm**: Events show `Failed to pull image ...` with the registry message.','**Causes**: typo in the image or tag, image does not exist, private registry without `imagePullSecrets`, registry rate limit or network egress blocked, no DNS from the node.']},
{code:`kubectl describe pod web | grep -A5 -i "pull"
kubectl get pod web -o jsonpath='{.spec.containers[*].image}'
kubectl get secret regcred -n shop      # does the pull secret exist in THIS namespace?`},
{h:'CrashLoopBackOff'},
{ul:['**Meaning**: the container starts, exits, and the kubelet retries with growing delays.','**Confirm**: `kubectl logs --previous` and the exit code in `describe`.','**Causes**: application error or bad config, missing env or Secret, wrong command, failing liveness probe, permission denied (non-root with a root-owned path), dependency not reachable.']},
{code:`kubectl logs web --previous
kubectl get pod web -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'
kubectl describe pod web | grep -E "Liveness|Readiness|Restart Count|Exit Code"
kubectl debug web -it --copy-to=web-debug --container=app -- sh     # run the command by hand`},
{h:'OOMKilled'},
{ul:['**Meaning**: the container exceeded its **memory limit** and the kernel killed it (exit code 137).','**Confirm**: `Last State: Terminated, Reason: OOMKilled`.','**Fix**: raise the limit, fix a memory leak, or tune the runtime (for example a JVM heap sized relative to the container limit). A node-wide shortage appears as **Evicted** Pods and node `MemoryPressure`.']},
{code:`kubectl get pod web -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'
kubectl top pod web --containers
kubectl describe node worker1 | grep -A8 "Allocated resources"`},
{h:'Other common states'},
{t:[['State','Cause'],
['`ContainerCreating` for a long time','Volume attach or mount, CNI sandbox failure, image pull in progress'],
['`CreateContainerConfigError`','Missing ConfigMap or Secret key referenced by the Pod'],
['`Init:Error` / `Init:CrashLoopBackOff`','An init container failed; `kubectl logs -c <init>`'],
['`Terminating` forever','Finalizer, stuck volume, or unreachable node; check `metadata.finalizers` and the node'],
['`Evicted`','Node pressure; check node conditions, requests and limits'],
['Running but `0/1 Ready`','Readiness probe failing']]}],
src:[['Debug Pods',DBG+'debug-application/debug-pods/'],['Pod Lifecycle',C+'workloads/pods/pod-lifecycle/'],['Node-pressure Eviction',C+'scheduling-eviction/node-pressure-eviction/']]};

/* ---------- 4: Node failures ---------- */
L['k8s:12:4']={blocks:[
{p:'When a node is **NotReady**, the node controller stops trusting it, taints it, and after a delay evicts its Pods. The cause is nearly always one of a short list.'},
{svg:node},
{code:`kubectl get nodes
kubectl describe node worker1 | sed -n '/Conditions:/,/Addresses:/p'
# Ready False/Unknown "Kubelet stopped posting node status" -> kubelet or network is down
# MemoryPressure / DiskPressure / PIDPressure True            -> resource problem`},
{h:'On the node: kubelet first'},
{code:`ssh worker1
sudo systemctl status kubelet
sudo journalctl -u kubelet -n 100 --no-pager
sudo journalctl -u kubelet -f

sudo systemctl restart kubelet               # after fixing the cause
cat /var/lib/kubelet/config.yaml             # staticPodPath, cgroupDriver, clusterDNS
cat /etc/kubernetes/kubelet.conf             # server: https://<api>:6443  and client certificate`},
{t:[['Kubelet log message','Likely cause'],
['`failed to run Kubelet: ... swap`','Swap enabled; `swapoff -a`'],
['`Failed to connect to apiserver` / `connection refused`','Wrong API address in `kubelet.conf`, firewall, API server down'],
['`x509: certificate has expired`','Kubelet client certificate expired or clock wrong'],
['`failed to create ... cgroup` / `cgroup driver mismatch`','Runtime and kubelet use different cgroup drivers'],
['`container runtime is down` / `rpc error ... containerd.sock`','Container runtime stopped'],
['`cni plugin not initialized`','CNI missing or crash-looping']]},
{h:'Runtime'},
{code:`sudo systemctl status containerd
sudo crictl info | head
sudo crictl ps -a | head
sudo journalctl -u containerd -n 50 --no-pager`},
{h:'Resource pressure'},
{code:`df -h /var/lib/kubelet /var/lib/containerd         # DiskPressure: free space or image GC
sudo crictl rmi --prune                            # remove unused images
free -m                                            # MemoryPressure
ps -eo pid,comm,%mem --sort=-%mem | head           # who is using it
cat /proc/sys/kernel/pid_max ; ps -e | wc -l       # PIDPressure`},
{h:'Recovering'},
{ul:['Fix the cause, restart the failing service, and watch the node return to Ready.','If the node cannot be repaired quickly: `kubectl drain` (or delete the node after Pods are rescheduled), replace it and rejoin with a fresh token.','Pods on an unreachable node stay `Terminating` or `Unknown` until the node returns or is deleted. StatefulSet Pods are **not** rescheduled automatically in that state, to protect against two copies writing the same data.']},
{note:'A node that flaps between Ready and NotReady is often a resource or network problem, not a crashed kubelet: check disk latency, CPU steal and network packet loss.'}],
src:[['Troubleshooting Clusters',DBG+'debug-cluster/'],['Nodes',C+'architecture/nodes/'],['Node-pressure Eviction',C+'scheduling-eviction/node-pressure-eviction/']]};

/* ---------- 5: Control plane failures ---------- */
L['k8s:12:5']={blocks:[
{p:'On a kubeadm cluster the control plane is four static Pods. When `kubectl` stops working, you troubleshoot from the control plane node using the manifests, `crictl` and logs.'},
{flow:['Does kubectl respond? If not, SSH to a control plane node','systemctl status kubelet: is the kubelet itself running?','crictl ps -a: are the control plane containers running or crash-looping?','crictl logs <id> for the failing component','Check the manifest in /etc/kubernetes/manifests for typos and wrong paths','Check certificates and etcd health']},
{code:`sudo systemctl status kubelet
sudo crictl ps -a | grep -E "kube-apiserver|etcd|scheduler|controller"
sudo crictl logs --tail 50 $(sudo crictl ps -a --name kube-apiserver -q | head -1)
sudo ls -l /etc/kubernetes/manifests
sudo journalctl -u kubelet -n 50 --no-pager | grep -i -E "manifest|static|error"`},
{h:'Typical faults'},
{t:[['Symptom','Cause and fix'],
['API server container exits at once, log says `unknown flag` or `invalid ...`','Typo in `kube-apiserver.yaml`; fix the flag (restore your backup copy)'],
['API server runs but `etcd: connection refused` / `context deadline exceeded`','etcd is down or `--etcd-servers` / etcd certificate paths are wrong'],
['No static Pod appears after you edited the manifest','YAML syntax error; the kubelet logs `can not process ... manifest`; fix indentation'],
['Scheduler or controller manager `Pending`/crash with `Unauthorized`','Its kubeconfig (`/etc/kubernetes/scheduler.conf`) is wrong or its certificate expired'],
['Pods stay Pending with no scheduling events at all','kube-scheduler not running'],
['Deployments create no ReplicaSets, nodes never marked NotReady','kube-controller-manager not running'],
['`x509: certificate has expired or is not yet valid`','Expired certificate or wrong clock; `kubeadm certs check-expiration` and renew'],
['etcd restarts repeatedly, `mvcc: database space exceeded`','etcd quota reached; compact, defrag and disarm the alarm']]},
{h:'etcd health'},
{code:`sudo ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key \\
  endpoint health --write-out=table
sudo ETCDCTL_API=3 etcdctl ... endpoint status --write-out=table
sudo ETCDCTL_API=3 etcdctl ... alarm list`},
{h:'Checks of wiring'},
{code:`sudo grep -E "etcd-servers|etcd-cafile|etcd-certfile|etcd-keyfile" /etc/kubernetes/manifests/kube-apiserver.yaml
sudo grep -E "data-dir|listen-client|cert-file|key-file|trusted-ca" /etc/kubernetes/manifests/etcd.yaml
sudo ls -l /etc/kubernetes/pki /etc/kubernetes/pki/etcd
sudo grep -E "server:" /etc/kubernetes/*.conf`},
{ul:['Wrong **hostPath** (for example the data directory) in a manifest makes the component start with empty or missing data.','Port clashes: another process on 6443 or 2379.','If the cluster used to work, ask what changed: a manifest edit, a certificate renewal, a reboot, a disk filling up.']},
{note:'In break/fix tasks the injected fault is almost always small: a typo in a path or flag, a stopped service, a wrong port or a deleted file. Read the log of the failing component before you start restoring anything.'}],
src:[['Troubleshooting kubeadm',K.S+'production-environment/tools/kubeadm/troubleshooting-kubeadm/'],['Troubleshooting Clusters',DBG+'debug-cluster/'],['Operating etcd clusters',T+'administer-cluster/configure-upgrade-etcd/']]};

/* ---------- 6: Service, DNS, network ---------- */
L['k8s:12:6']={blocks:[
{p:'Work along the path of a request: client Pod, DNS, Service, endpoints, backend Pod, application. Stop at the first broken link.'},
{flow:['Does the name resolve?','Does the Service exist with the right port?','Does it have endpoints?','Do selector labels match the Pods?','Are the Pods Ready and listening on targetPort?','Does a NetworkPolicy or the CNI block traffic?']},
{h:'1. Service and endpoints'},
{code:`kubectl get svc web -o wide                     # SELECTOR, PORT(S)
kubectl get endpointslices -l kubernetes.io/service-name=web
kubectl get pods --show-labels -l app=web
kubectl get pods -o wide                        # Ready? which node?
kubectl describe svc web                        # Endpoints list at the bottom`},
{ul:['**No endpoints**: selector does not match, or Pods are not Ready.','**Endpoints present but connection refused**: `targetPort` does not match what the container listens on, or the app binds only to `127.0.0.1` instead of `0.0.0.0`.','**Intermittent failures**: one bad Pod in the endpoints, or a readiness probe that is too lenient.']},
{h:'2. Test from inside the cluster'},
{code:`kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- sh
nslookup web.shop.svc.cluster.local
wget -qO- -T 3 http://web.shop:80
wget -qO- -T 3 http://<pod-ip>:8080              # bypass the Service
wget -qO- -T 3 http://<cluster-ip>:80            # bypass DNS`},
{t:[['Result','Meaning'],
['Pod IP works, ClusterIP fails','Problem in the Service layer (selector, port mapping, kube-proxy)'],
['ClusterIP works, name fails','DNS problem'],
['Pod IP works from the same node only','CNI or cross-node networking'],
['Timeout everywhere between certain Pods','NetworkPolicy or firewall'],
['Connection refused','Nothing listening, wrong port']]},
{h:'3. DNS'},
{code:`kubectl -n kube-system get pods -l k8s-app=kube-dns -o wide
kubectl -n kube-system logs -l k8s-app=kube-dns --tail=30
kubectl -n kube-system get svc kube-dns
kubectl -n kube-system get endpointslices -l kubernetes.io/service-name=kube-dns
kubectl exec tmp -- cat /etc/resolv.conf`},
{h:'4. NetworkPolicy and CNI'},
{code:`kubectl get netpol -A
kubectl describe netpol -n shop
kubectl -n kube-system get pods -o wide | grep -i -E "calico|cilium|flannel|weave|cni"
sudo ls /etc/cni/net.d ; sudo journalctl -u kubelet | grep -i cni | tail`},
{h:'5. Ingress and external access'},
{code:`kubectl describe ingress shop                  # backends and events
kubectl get svc -A | grep -E "LoadBalancer|NodePort"
curl -v -H "Host: shop.example.com" http://<ingress-address>/
kubectl -n ingress get pods ; kubectl -n ingress logs deploy/controller --tail=30`},
{note:'A single wrong label is the number one cause of "Service not working". Compare the Service selector and Pod labels character by character before debugging anything deeper.'}],
src:[['Debug Services',DBG+'debug-application/debug-service/'],['Debugging DNS Resolution',T+'administer-cluster/dns-debugging-resolution/'],['Network Policies',C+'services-networking/network-policies/']]};

/* ---------- 7: Monitoring and logging ---------- */
L['k8s:12:7']={blocks:[
{p:'Troubleshooting after the fact needs data from before the fact. Kubernetes provides basic resource metrics and leaves the rest of monitoring and logging to you.'},
{h:'Resource metrics'},
{code:`kubectl top nodes
kubectl top pods -A --sort-by=cpu
kubectl top pod web --containers
kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes | head -c 300`},
{ul:['Provided by **Metrics Server** and held only as the latest sample.','`top` shows usage; compare with **requests and limits** to find over- and under-provisioning.','No history, no alerting: use Prometheus (additional lecture) for that.']},
{h:'Three signal types'},
{t:[['Signal','Question it answers','Typical tools'],
['**Metrics**','How much, how fast, how often?','Prometheus, Grafana, cloud monitoring'],
['**Logs**','What happened?','Fluent Bit, Loki, Elasticsearch, cloud logging'],
['**Traces**','Where did this request spend time?','OpenTelemetry, Jaeger, Tempo']]},
{h:'Logging architecture'},
{ul:['Containers write to **stdout and stderr**. The runtime stores them as files on the node under `/var/log/pods` and `/var/log/containers`, rotated by the kubelet.','**Node-level logging agent**: a DaemonSet (Fluent Bit, Vector) reads those files from every node and ships them to a backend. This is the standard pattern.','**Sidecar logging**: a container reads application files and writes them to stdout, or ships directly. Use when an app only writes to files.','**Application pushes directly** to a backend: simple, but tied to the app and unavailable if it crashes before shipping.','Control plane and node component logs: `journalctl -u kubelet`, `crictl logs` for static Pods, and **audit logs** for API activity.']},
{code:`# On a node
ls /var/log/pods/ ; ls /var/log/containers | head
sudo journalctl -u kubelet --since "10 min ago"
# Cluster-level logging agent
kubectl -n logging get ds`},
{h:'What to alert on'},
{ul:['Node NotReady, node resource pressure, disk almost full.','Pod restarts rising, Pods Pending for long, failed Jobs.','API server error rate and latency, etcd leader changes and fsync latency.','Certificate expiry, backup job failures.','Application golden signals: latency, traffic, errors and saturation.']},
{note:'Logs and metrics are only useful if they outlive the Pod. Ship them off the node, set retention, and make sure the logging agent itself has requests and limits so it does not starve workloads.'}],
src:[['Logging Architecture',C+'cluster-administration/logging/'],['Resource metrics pipeline',DBG+'debug-cluster/resource-metrics-pipeline/']]};

/* ---------- 8: Break/fix ---------- */
L['k8s:12:8']={blocks:[
{p:'Timed break/fix practice. Set up a throwaway cluster, then have someone (or a script) inject the faults, or inject them yourself and wait a day so you do not remember them. Aim for **5 to 10 minutes** per scenario.'},
{h:'Scenario A: workload (Pending)'},
{code:`kubectl create ns bf && kubectl -n bf create deployment app --image=nginx:1.27 --replicas=3
kubectl -n bf patch deployment app --type=json -p '[{"op":"add","path":"/spec/template/spec/containers/0/resources","value":{"requests":{"cpu":"64"}}}]'
# Task: find out why new Pods are Pending and fix it (without deleting the Deployment).`},
{p:'Expected path: `get pods`, `describe pod` (Insufficient cpu), `set resources` or edit the request, `rollout status`.'},
{h:'Scenario B: Service has no endpoints'},
{code:`kubectl -n bf expose deployment app --port=80
kubectl -n bf patch svc app -p '{"spec":{"selector":{"app":"web"}}}'
# Task: make "curl http://app" work from a Pod in namespace bf.`},
{p:'Expected path: `get endpointslices` is empty, compare selector with Pod labels, fix selector.'},
{h:'Scenario C: CrashLoopBackOff from missing config'},
{code:`kubectl -n bf create deployment cfg --image=busybox:1.36 -- sh -c 'echo $DB_HOST; sleep 3600'
kubectl -n bf set env deployment/cfg --from=configmap/does-not-exist
# Task: find the exact reason the Pod does not start and fix it.`},
{p:'Expected path: `CreateContainerConfigError` in status, `describe pod` shows the missing ConfigMap. Create it or remove the reference.'},
{h:'Scenario D: node NotReady'},
{code:`# On a worker:
sudo systemctl stop kubelet           # or: sudo systemctl disable --now containerd
# Task: from the control plane find which node is NotReady, SSH there, find the cause and restore it.`},
{h:'Scenario E: scheduler down'},
{code:`# On the control plane node:
sudo mv /etc/kubernetes/manifests/kube-scheduler.yaml /tmp/
kubectl -n bf scale deployment app --replicas=5       # new Pods stay Pending with NO events
# Task: restore scheduling.`},
{h:'Scenario F: broken API server manifest'},
{code:`# On the control plane node (keep a backup first!):
sudo sed -i 's#--etcd-servers=https://127.0.0.1:2379#--etcd-servers=https://127.0.0.1:2399#' /etc/kubernetes/manifests/kube-apiserver.yaml
# kubectl stops working. Task: diagnose using crictl and the kubelet log, then repair.`},
{h:'Scenario G: NetworkPolicy blocks traffic'},
{code:`kubectl -n bf apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: deny}
spec: {podSelector: {}, policyTypes: [Ingress]}
EOF
# Task: after the policy, the client Pod can no longer reach the app. Allow only the client Pod.`},
{h:'Debrief'},
{ul:['What was the first command you ran? Was it a read-only one?','How long until you read the Events or the log of the failing component?','Which scenario cost the most time, and why?','Write a one-line checklist from each scenario for your own runbook.']},
{h:'Clean up'},
{code:`kubectl delete ns bf
# restore any manifest you moved back to /etc/kubernetes/manifests and restart stopped services`}],
src:[['Troubleshooting Applications',DBG+'debug-application/'],['Troubleshooting Clusters',DBG+'debug-cluster/']]};
})();
