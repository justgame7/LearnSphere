/* LearnSphere - Kubernetes Administrator, Section 06: Scheduling, Node Maintenance & Autoscaling.
   Lectures 0-7 are core, 8-13 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T,R=K.R;
const SE=C+'scheduling-eviction/';

const cycle=K.dg(700,200,[
[10,20,330,160,'Scheduling cycle (one Pod at a time)',1],[360,20,330,160,'Binding cycle (can run in parallel)',1],
[25,55,140,50,'Queue|sort by priority',0],[180,55,140,50,'Filter|feasible nodes',2],[25,120,140,50,'Score|rank nodes',2],[180,120,140,50,'Reserve|hold resources',0],
[380,55,140,50,'Permit / PreBind|volumes, gates',0],[535,55,140,50,'Bind|write spec.nodeName',2],[380,120,295,50,'Kubelet on the node sees the Pod and starts it',0]],
[[165,80,180,80],[100,105,100,120],[165,145,180,145],[320,145,380,100]]);

const taint=K.dg(700,200,[
[10,40,200,110,'Node gpu-1|taint: gpu=true:NoSchedule',2],
[260,20,200,60,'Pod A|no toleration|stays away',0],[260,110,200,60,'Pod B|tolerates gpu=true|may be placed here',2],
[510,40,180,110,'Effects|NoSchedule|PreferNoSchedule|NoExecute (evicts)',0]],
[[260,50,210,70],[260,140,210,110]]);

const spread=K.dg(700,220,[
[10,10,210,200,'Zone A',1],[245,10,210,200,'Zone B',1],[480,10,210,200,'Zone C',1],
[30,45,170,40,'node a1: web web',0],[30,95,170,40,'node a2: web',0],
[265,45,170,40,'node b1: web web',0],[265,95,170,40,'node b2: web',0],
[500,45,170,40,'node c1: web',2],[500,95,170,40,'maxSkew 1 across zones: |counts 3 / 3 / 1 is not allowed',0]],
[]);

/* ---------- 0: How the scheduler works ---------- */
L['k8s:5:0']={blocks:[
{p:'The scheduler assigns each new Pod to a node. It runs a framework of **plugins** at defined **extension points**, which is why scheduling behaviour is configurable and why every Pending Pod has a stated reason.'},
{svg:cycle},
{h:'The cycle'},
{flow:['Pod enters the scheduling queue, ordered by priority','Filter: drop nodes that cannot run the Pod','Score: rank the remaining nodes (0 to 100 per plugin)','Highest total wins; ties are broken randomly','Reserve resources in the scheduler cache','Bind: write spec.nodeName through the API','Kubelet starts the Pod']},
{h:'What filters out a node'},
{t:[['Check','Plugin / reason'],
['Not enough CPU, memory or ephemeral storage after requests','`NodeResourcesFit`'],
['Node selector or required node affinity does not match','`NodeAffinity`'],
['Untolerated taint','`TaintToleration`'],
['Host port already used','`NodePorts`'],
['Volume cannot attach or lives in another zone','`VolumeBinding`, `VolumeZone`'],
['Required Pod anti-affinity or topology spread would be violated','`InterPodAffinity`, `PodTopologySpread`'],
['Node cordoned (unschedulable)','`NodeUnschedulable`']]},
{h:'What scores a node'},
{ul:['Balance of resource use and spreading Pods of the same Service.','Preferred (soft) affinity and anti-affinity weights.','Locality of already-pulled images.']},
{h:'Why a Pod is Pending'},
{code:`kubectl get pod web -o wide
kubectl describe pod web | sed -n '/Events:/,$p'
# Warning FailedScheduling ... 0/4 nodes are available:
#   1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: },
#   3 Insufficient memory. preemption: not eligible ...

kubectl get events --field-selector reason=FailedScheduling -A`},
{t:[['Message fragment','Meaning and fix'],
['`Insufficient cpu` / `memory`','Requests too large for any node. Lower requests or add capacity'],
['`didn\'t match Pod\'s node affinity/selector`','Selector label does not exist on any node'],
['`had untolerated taint`','Add a toleration or remove the taint'],
['`persistentvolumeclaim ... not found` / `unbound`','Storage problem, see Section 8'],
['`Too many pods`','Node reached `maxPods` (default 110)']]},
{h:'Manual placement'},
{p:'Setting `spec.nodeName` yourself bypasses the scheduler entirely: no filters run, so resources and taints are ignored. It is fine for debugging, not for production. Without a scheduler running (control plane fault) this is also the way to force a Pod onto a node.'},
{note:'Scheduling happens once, at Pod creation. If nodes change later, the scheduler does not move running Pods. That is the job of the descheduler (additional lecture) and of draining.'}],
src:[['Kubernetes Scheduler',SE+'kube-scheduler/'],['Scheduling Framework',SE+'scheduling-framework/'],['Assigning Pods to Nodes',SE+'assign-pod-node/']]};

/* ---------- 1: Affinity ---------- */
L['k8s:5:1']={blocks:[
{p:'Kubernetes offers several ways to steer placement, from simple to expressive.'},
{h:'nodeSelector'},
{p:'The simplest rule: the node must carry all listed labels.'},
{code:`kubectl label node w1 disktype=ssd
# in the Pod spec:
spec:
  nodeSelector:
    disktype: ssd`},
{h:'Node affinity'},
{p:'Richer rules with operators and a distinction between hard and soft requirements.'},
{code:`spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:    # hard
        nodeSelectorTerms:
        - matchExpressions:
          - key: topology.kubernetes.io/zone
            operator: In
            values: [eu-west-1a, eu-west-1b]
      preferredDuringSchedulingIgnoredDuringExecution:   # soft
      - weight: 80
        preference:
          matchExpressions:
          - {key: disktype, operator: In, values: [ssd]}`},
{ul:['Operators: `In`, `NotIn`, `Exists`, `DoesNotExist`, `Gt`, `Lt`.','Several `nodeSelectorTerms` are ORed; expressions inside one term are ANDed.','`IgnoredDuringExecution` means a running Pod is not moved if node labels change later.']},
{h:'Pod affinity and anti-affinity'},
{p:'Place a Pod relative to **other Pods**, using a `topologyKey` that defines what "together" means (node, zone, ...).'},
{code:`spec:
  affinity:
    podAntiAffinity:                       # spread replicas over different nodes
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels: {app: web}
        topologyKey: kubernetes.io/hostname
    podAffinity:                           # co-locate with the cache
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 50
        podAffinityTerm:
          labelSelector:
            matchLabels: {app: cache}
          topologyKey: topology.kubernetes.io/zone`},
{t:[['Goal','Use'],
['Run only on SSD nodes','`nodeSelector` or required node affinity'],
['Prefer one zone but allow others','Preferred node affinity'],
['Never two replicas on the same node','Required Pod anti-affinity on `kubernetes.io/hostname` (or topology spread, next lectures)'],
['Keep app next to its cache','Preferred Pod affinity']]},
{note:'Required anti-affinity with more replicas than nodes leaves extra Pods Pending. Pod affinity rules are also expensive on large clusters; topology spread constraints are usually the better tool for spreading.'}],
src:[['Assigning Pods to Nodes',SE+'assign-pod-node/'],['Affinity and anti-affinity',SE+'assign-pod-node/#affinity-and-anti-affinity']]};

/* ---------- 2: Taints and tolerations ---------- */
L['k8s:5:2']={blocks:[
{p:'Affinity attracts Pods to nodes. **Taints** do the opposite: a node repels Pods unless they carry a matching **toleration**.'},
{svg:taint},
{h:'Taint effects'},
{t:[['Effect','Behaviour'],
['`NoSchedule`','New Pods without a toleration are not scheduled here. Running Pods stay.'],
['`PreferNoSchedule`','The scheduler tries to avoid the node but may use it'],
['`NoExecute`','New Pods are refused **and running Pods without a toleration are evicted**']]},
{code:`kubectl taint nodes gpu-1 gpu=true:NoSchedule
kubectl taint nodes gpu-1 gpu=true:NoSchedule-        # trailing minus removes it
kubectl describe node gpu-1 | grep -i taints
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints[*].key`},
{code:`# Pod toleration
spec:
  tolerations:
  - key: gpu
    operator: Equal
    value: "true"
    effect: NoSchedule
  - key: node.kubernetes.io/unreachable
    operator: Exists
    effect: NoExecute
    tolerationSeconds: 120            # how long to stay on a failing node`},
{ul:['`operator: Exists` matches any value for the key; an empty key with `Exists` tolerates everything.','A toleration **allows** a Pod onto a tainted node; it does not **require** it. Combine with a node selector or affinity to dedicate nodes.']},
{h:'Built-in taints'},
{t:[['Taint','Added when'],
['`node-role.kubernetes.io/control-plane:NoSchedule`','kubeadm control plane nodes'],
['`node.kubernetes.io/not-ready`, `unreachable`','Node condition problems; Pods get default 300 s tolerance'],
['`node.kubernetes.io/memory-pressure`, `disk-pressure`, `pid-pressure`','Node resource pressure'],
['`node.kubernetes.io/unschedulable`','Node cordoned']]},
{h:'Dedicated nodes pattern'},
{code:`kubectl label node gpu-1 hardware=gpu
kubectl taint node gpu-1 hardware=gpu:NoSchedule
# GPU workloads: toleration + nodeSelector hardware=gpu`},
{note:'Exam trick: a Pod stuck Pending on a cluster with one tainted control plane node and no workers is usually just an untolerated control-plane taint. Check `kubectl get nodes` and the taints before changing anything.'}],
src:[['Taints and Tolerations',SE+'taint-and-toleration/']]};

/* ---------- 3: Topology spread, priority ---------- */
L['k8s:5:3']={blocks:[
{p:'Two controls decide how replicas are distributed and what wins when resources run out.'},
{h:'Topology spread constraints'},
{svg:spread},
{code:`spec:
  topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule      # or ScheduleAnyway
    labelSelector:
      matchLabels: {app: web}
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels: {app: web}`},
{ul:['**maxSkew**: the largest allowed difference in matching Pod count between any two domains.','**topologyKey**: a node label that defines the domains (zone, node, rack).','`DoNotSchedule` is a hard rule; `ScheduleAnyway` makes it a preference.','Combine zone (hard) and node (soft) constraints for resilient replicas without blocking scale-out.']},
{h:'Priority and preemption'},
{p:'A **PriorityClass** gives Pods a numeric priority. When a high-priority Pod cannot be scheduled, the scheduler may **preempt** (evict) lower-priority Pods on a node to make room.'},
{code:`apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: {name: business-critical}
value: 100000
globalDefault: false
preemptionPolicy: PreemptLowerPriority     # or Never
description: "Customer-facing services"
---
# in the Pod spec
spec:
  priorityClassName: business-critical`},
{ul:['Built-in classes: `system-cluster-critical` and `system-node-critical` protect core components.','Higher priority also means scheduled earlier from the queue, and evicted later under node pressure.','`preemptionPolicy: Never` keeps priority in the queue without evicting others.','Preemption respects PodDisruptionBudgets on a best-effort basis, so it may still disrupt them.']},
{code:`kubectl get priorityclass
kubectl get pod web -o jsonpath='{.spec.priority}{"\\t"}{.spec.priorityClassName}{"\\n"}'`},
{note:'Give very few teams the right to create high-priority Pods; a low-trust namespace using a critical PriorityClass can evict everyone else. Use a ResourceQuota scoped to PriorityClass to control this.'}],
src:[['Pod Topology Spread Constraints',C+'scheduling-eviction/topology-spread-constraints/'],['Pod Priority and Preemption',SE+'pod-priority-preemption/']]};

/* ---------- 4: Cordon, drain, uncordon ---------- */
L['k8s:5:4']={blocks:[
{p:'Before patching, rebooting or retiring a node, move its workloads away cleanly.'},
{flow:['cordon: mark the node unschedulable','drain: evict Pods gracefully','do the maintenance (patch, reboot, resize)','uncordon: allow scheduling again']},
{code:`kubectl cordon w2                       # no NEW Pods; existing keep running
kubectl get nodes                       # STATUS: Ready,SchedulingDisabled

kubectl drain w2 --ignore-daemonsets --delete-emptydir-data
# --ignore-daemonsets   DaemonSet Pods cannot be moved, so skip them
# --delete-emptydir-data allow deleting Pods that use emptyDir (data is lost)
# --force               also delete Pods not managed by a controller (they will not return)
# --timeout=300s        give up after a time

# ... maintenance ...
kubectl uncordon w2`},
{h:'What drain does'},
{ul:['Cordons the node first.','Uses the **eviction API** for each Pod, which respects **PodDisruptionBudgets**. If an eviction would violate a PDB, drain retries until it is allowed or times out.','Pods owned by controllers are recreated on other nodes. Bare Pods are not replaced and block the drain unless `--force` is used.','Pods with local storage (`emptyDir`) block the drain unless `--delete-emptydir-data` is set.']},
{h:'PodDisruptionBudgets'},
{code:`apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: {name: web-pdb}
spec:
  minAvailable: 2          # or maxUnavailable: 1
  selector:
    matchLabels: {app: web}`},
{t:[['Situation','Result'],
['3 replicas, `minAvailable: 2`','Drain evicts one at a time; next waits until a replacement is Ready'],
['1 replica, `minAvailable: 1`','Drain blocks forever: the only Pod can never be evicted. Use 2+ replicas'],
['PDB selecting no Pods','No effect']]},
{note:'Cordon is not drain. A cordoned node keeps serving. And `kubectl delete node` removes the API object only; the machine and its kubelet still exist and may re-register. Drain first, then delete, then decommission.'}],
src:[['Safely Drain a Node',T+'administer-cluster/safely-drain-node/'],['Disruptions and PodDisruptionBudget',C+'workloads/pods/disruptions/'],['kubectl drain',R+'kubectl/generated/kubectl_drain/']]};

/* ---------- 5: Metrics server and HPA ---------- */
L['k8s:5:5']={blocks:[
{p:'**Metrics Server** collects CPU and memory usage from every kubelet and exposes it through the Metrics API. It powers `kubectl top` and the **HorizontalPodAutoscaler (HPA)**. It is **not** a monitoring system; it keeps only the latest values.'},
{h:'Install and verify'},
{code:`kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl -n kube-system rollout status deployment/metrics-server

# Lab clusters with self-signed kubelet certificates may need:
#   --kubelet-insecure-tls   (edit the metrics-server Deployment args; lab only)

kubectl top nodes
kubectl top pods -A --sort-by=memory
kubectl get apiservice v1beta1.metrics.k8s.io`},
{h:'HPA'},
{p:'The HPA changes the `replicas` of a Deployment, StatefulSet or other scalable resource to keep a metric near a target. It checks about every 15 seconds.'},
{code:`apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: {name: web}
spec:
  scaleTargetRef: {apiVersion: apps/v1, kind: Deployment, name: web}
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target: {type: Utilization, averageUtilization: 60}
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - {type: Percent, value: 50, periodSeconds: 60}`},
{code:`kubectl autoscale deployment web --cpu-percent=60 --min=2 --max=10
kubectl get hpa -w
kubectl describe hpa web
# load test
kubectl run load --rm -it --image=busybox:1.36 -- sh -c "while true; do wget -q -O- http://web; done"`},
{h:'The formula and its prerequisites'},
{p:'desiredReplicas = ceil( currentReplicas x currentMetric / targetMetric ). Utilization is measured against the container **requests**.'},
{ul:['Pods **must have CPU (or memory) requests**, or the HPA shows `<unknown>` and cannot compute utilization.','Do not set `replicas` in the Deployment manifest you keep applying, or each apply resets the HPA result. Omit the field once an HPA owns it.','Scale-up is fast, scale-down is deliberately slow (stabilization window) to avoid flapping.','The HPA scales Pods; adding nodes for Pending Pods is the job of a node autoscaler (additional lecture).']},
{t:[['Symptom','Likely cause'],
['TARGETS shows `<unknown>/60%`','Metrics Server missing or unhealthy, or Pods have no requests'],
['Never scales up despite load','Utilization measured vs requests; requests too high'],
['Scales up but Pods Pending','No node capacity; need cluster autoscaling']]}],
src:[['Horizontal Pod Autoscaling',C+'workloads/autoscaling/horizontal-pod-autoscale/'],['HPA walkthrough',T+'run-application/horizontal-pod-autoscale-walkthrough/'],['Metrics Server','https://github.com/kubernetes-sigs/metrics-server']]};

/* ---------- 6: ResourceQuota and LimitRange ---------- */
L['k8s:5:6']={blocks:[
{p:'Section 5 introduced both objects briefly. Together they let a platform team share a cluster safely: **LimitRange** shapes individual containers; **ResourceQuota** caps a whole namespace.'},
{h:'LimitRange'},
{code:`apiVersion: v1
kind: LimitRange
metadata: {name: container-limits, namespace: team-a}
spec:
  limits:
  - type: Container
    default:        {cpu: 500m, memory: 256Mi}      # limit if none given
    defaultRequest: {cpu: 100m, memory: 128Mi}      # request if none given
    min:            {cpu: 50m,  memory: 64Mi}
    max:            {cpu: "2",  memory: 2Gi}
    maxLimitRequestRatio: {cpu: "10"}
  - type: PersistentVolumeClaim
    max: {storage: 50Gi}`},
{ul:['Applies at **admission time** to new Pods. Existing Pods are untouched.','A Pod violating `min`, `max` or ratio is **rejected**.','Defaults are injected silently, which can surprise teams: check `kubectl get pod -o yaml`.']},
{h:'ResourceQuota'},
{code:`apiVersion: v1
kind: ResourceQuota
metadata: {name: team-a-quota, namespace: team-a}
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
    persistentvolumeclaims: "10"
    requests.storage: 200Gi
    services.loadbalancers: "2"
    count/deployments.apps: "20"
    secrets: "100"`},
{code:`kubectl -n team-a describe resourcequota team-a-quota      # Used vs Hard
kubectl -n team-a get quota`},
{h:'Behaviour to remember'},
{ul:['Once a quota covers `requests.cpu` or `limits.memory`, every new Pod must **declare** them (or get LimitRange defaults), or creation fails with `must specify`.','Exceeding a quota **rejects the request** at creation (`exceeded quota`); it does not evict running Pods.','Quota **scopes** narrow what is counted, for example `BestEffort`, `NotTerminating`, or `PriorityClass` (`scopeSelector`).','Quota does not stop a Deployment from being created; its ReplicaSet simply cannot create Pods. Look at ReplicaSet events when replicas are missing.']},
{t:[['Symptom','Where to look'],
['Pods not created, Deployment shows fewer than desired','`kubectl describe rs` events: `exceeded quota`'],
['`Forbidden: maximum cpu usage per Container is ...`','LimitRange `max`'],
['`must specify limits.memory`','Quota present, no limits and no LimitRange default']]},
{note:'Typical multi-tenant baseline: one namespace per team with a LimitRange (sane defaults) plus a ResourceQuota (total ceiling), plus a default-deny NetworkPolicy and RBAC bound to the team group.'}],
src:[['Resource Quotas',C+'policy/resource-quotas/'],['Limit Ranges',C+'policy/limit-range/'],['Configure Memory and CPU Quotas for a Namespace',T+'administer-cluster/manage-resources/quota-memory-cpu-namespace/']]};

/* ---------- 7: Practical ---------- */
L['k8s:5:7']={blocks:[
{p:'Hands-on lab. You need a cluster with at least **two worker nodes** (kind with 2 workers is enough) and Metrics Server installed. Everything happens in namespace `sched-lab`.'},
{h:'Part 1: Place Pods'},
{code:`kubectl create ns sched-lab && kubectl config set-context --current --namespace=sched-lab
kubectl get nodes
kubectl label node <worker1> disktype=ssd

# Pod that must run on the ssd node
kubectl run ssd-pod --image=nginx:1.27 --dry-run=client -o yaml > ssd.yaml
# add under spec:  nodeSelector: {disktype: ssd}
kubectl apply -f ssd.yaml && kubectl get pod ssd-pod -o wide`},
{h:'Part 2: Taint a node and observe'},
{code:`kubectl taint node <worker2> maint=true:NoSchedule
kubectl create deployment spread --image=nginx:1.27 --replicas=4
kubectl get pods -o wide           # all on worker1 (and control plane only if it tolerates)

# Add a toleration to the Deployment and watch worker2 receive Pods
kubectl patch deployment spread --type=json -p '[{"op":"add","path":"/spec/template/spec/tolerations","value":[{"key":"maint","operator":"Exists","effect":"NoSchedule"}]}]'
kubectl get pods -o wide`},
{h:'Part 3: Drain for maintenance'},
{code:`kubectl create deployment web --image=nginx:1.27 --replicas=3
kubectl create poddisruptionbudget web-pdb --selector=app=web --min-available=2
kubectl get pods -o wide
kubectl drain <worker1> --ignore-daemonsets --delete-emptydir-data
kubectl get pods -o wide           # web Pods moved; ssd-pod is a bare Pod and blocks the drain
kubectl drain <worker1> --ignore-daemonsets --delete-emptydir-data --force   # now allowed
kubectl uncordon <worker1>`},
{p:'Predict first: which Pods block the drain? The bare `ssd-pod` has no controller, so drain refuses without `--force`, and force-deleting it means it is gone for good.'},
{h:'Part 4: Autoscale under load'},
{code:`kubectl set resources deployment web --requests=cpu=50m --limits=cpu=200m
kubectl autoscale deployment web --cpu-percent=50 --min=2 --max=6
kubectl run load --image=busybox:1.36 --restart=Never -- sh -c "while true; do wget -q -O- http://web; done"
kubectl expose deployment web --port=80
kubectl get hpa -w                 # watch REPLICAS grow, then Ctrl+C
kubectl delete pod load`},
{h:'Clean up and reflect'},
{code:`kubectl taint node <worker2> maint-
kubectl label node <worker1> disktype-
kubectl delete ns sched-lab
kubectl config set-context --current --namespace=default`},
{ul:['Why did the HPA need a CPU request to work?','What happens to a Pod that tolerates a taint but has no node selector?','Which PDB setting would have made the drain of a single-replica app hang?']}],
src:[['Assigning Pods to Nodes',SE+'assign-pod-node/'],['Safely Drain a Node',T+'administer-cluster/safely-drain-node/'],['Horizontal Pod Autoscaling',C+'workloads/autoscaling/horizontal-pod-autoscale/']]};
})();
