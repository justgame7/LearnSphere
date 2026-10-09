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
{p:'Every Pod you create starts life without a node. The **kube-scheduler** is the component that chooses one. It does not start containers, move Pods or monitor them afterwards; it makes one decision per Pod, at creation, and writes it down. Understanding exactly how that decision is made turns the cryptic `0/5 nodes are available` message into a precise diagnosis.'},
{h:'The scheduler as a pipeline of plugins'},
{p:'The scheduler is a **framework** made of plugins attached to fixed stages. The built-in behaviour (resources, taints, affinity, spread, volumes) is just the default set of plugins. Each Pod passes through two cycles:'},
{svg:cycle},
{t:[['Stage','What happens','Examples of plugins'],
['**Queue**','Pods wait in a priority queue; higher `priority` first. Pods that failed go to a backoff or unschedulable queue and are retried when something changes (a node appears, a Pod is deleted)','`PrioritySort`'],
['**PreFilter / Filter**','Remove nodes that **cannot** run the Pod. Each plugin vetoes nodes with a reason','`NodeResourcesFit`, `NodeAffinity`, `TaintToleration`, `NodePorts`, `VolumeBinding`, `PodTopologySpread`, `InterPodAffinity`, `NodeUnschedulable`'],
['**PostFilter**','Runs only if no node fits: tries **preemption** (evict lower priority Pods)','`DefaultPreemption`'],
['**Score**','Rank the remaining nodes from 0 to 100 per plugin; weighted sum','`NodeResourcesFit` (spreading or packing), `ImageLocality`, `NodeAffinity` preferences, `TaintToleration` preferences'],
['**Reserve / Permit**','Reserve resources in the scheduler cache so the next Pod sees them; optionally wait for approval','`VolumeBinding`'],
['**Bind**','Write `spec.nodeName` through the API (the "binding")','`DefaultBinder`']]},
{p:'In large clusters the scheduler does not score every node: it evaluates a percentage of nodes (adaptive, between 5 and 100 percent) and stops once it found enough feasible ones. So placement is "good", not mathematically perfect.'},
{h:'Filtering: why a node is rejected'},
{t:[['Rule','Plugin','Example reason in the message'],
['Requests do not fit in free allocatable CPU, memory, ephemeral storage','`NodeResourcesFit`','`Insufficient cpu`, `Insufficient memory`'],
['Node does not match `nodeSelector` or required node affinity','`NodeAffinity`','`node(s) didn\'t match Pod\'s node affinity/selector`'],
['Node has a taint the Pod does not tolerate','`TaintToleration`','`node(s) had untolerated taint {key: value}`'],
['Node is cordoned','`NodeUnschedulable`','`node(s) were unschedulable`'],
['Another Pod already uses the requested host port','`NodePorts`','`node(s) didn\'t have free ports`'],
['Volume is in another zone, or PVC is unbound','`VolumeBinding`, `VolumeZone`','`node(s) had volume node affinity conflict`, `unbound immediate PersistentVolumeClaims`'],
['Required anti-affinity or a spread constraint would be violated','`InterPodAffinity`, `PodTopologySpread`','`node(s) didn\'t match pod anti-affinity rules`, `didn\'t match pod topology spread constraints`'],
['Node already runs the maximum number of Pods','`NodeResourcesFit`','`Too many pods` (default limit 110 per node)']]},
{h:'Reading FailedScheduling like a report'},
{code:`$ kubectl describe pod big
Events:
  Warning  FailedScheduling  12s  default-scheduler
    0/5 nodes are available:
      1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: },
      2 Insufficient memory,
      2 node(s) didn't match Pod's node affinity/selector.
    preemption: 0/5 nodes are available: 5 Preemption is not helpful for scheduling.`},
{p:'The numbers add up to the total: **1 + 2 + 2 = 5 nodes**, each rejected for one reason. Read it as a table: one node is the control plane, two lack memory, two lack the label the Pod wants. The fix depends on the biggest bucket: fewer memory requests, a different selector, or more nodes. A message whose numbers do not add up usually means some nodes failed for several reasons and only the first is counted.'},
{h:'Scoring: choosing among the survivors'},
{ul:['By default the scheduler **spreads** load: nodes with more free resources score higher (`LeastAllocated`), and the Pod prefers nodes where its image is already present.','**Preferred** (soft) affinity, preferred anti-affinity and `PreferNoSchedule` taints add or subtract points; they influence but never forbid.','You can change the strategy (for example `MostAllocated` to pack Pods tightly so a node autoscaler can remove empty nodes) with a scheduler profile (additional lecture).','Ties are broken randomly, which is why identical replicas land on different nodes.']},
{h:'What the scheduler does not do'},
{t:[['Misconception','Reality'],
['"It moves Pods when a node gets busy"','No. Placement is decided once. A descheduler or a drain is needed to rebalance'],
['"It looks at actual CPU use"','No. It uses **requests**. A node with idle CPU but fully requested is "full"'],
['"It starts the containers"','No. The kubelet does, after the binding is written'],
['"It restarts failed Pods"','No. Controllers recreate Pods; the scheduler places the new ones'],
['"A Pod with `nodeName` set is scheduled normally"','Setting `spec.nodeName` bypasses the scheduler entirely: no filters, no resource check']]},
{h:'Troubleshooting a Pending Pod: the procedure'},
{flow:['kubectl describe pod and read the FailedScheduling message','Match the biggest reason to a cause (resources, taints, selectors, volumes)','Check the cluster side: kubectl get nodes, describe node (Allocated resources, Taints, Labels)','Fix the Pod spec or the cluster, never both at once','If there are no scheduling events at all, check that kube-scheduler is running and that spec.schedulerName exists']},
{code:`kubectl get nodes --show-labels
kubectl describe node worker1 | sed -n '/Taints:/p;/Allocated resources/,/Events/p'
kubectl get events --field-selector reason=FailedScheduling -A
kubectl -n kube-system get pods -l component=kube-scheduler
kubectl -n kube-system logs -l component=kube-scheduler --tail=20`},
{note:'Exam tip: for a Pending Pod, the answer is nearly always in the first line of the FailedScheduling event. Read the numbers per reason before changing anything.'}],
src:[['Kubernetes Scheduler',SE+'kube-scheduler/'],['Scheduling Framework',SE+'scheduling-framework/'],['Assigning Pods to Nodes',SE+'assign-pod-node/']]};

/* ---------- 1: Affinity ---------- */
L['k8s:5:1']={blocks:[
{p:'Left alone, the scheduler places Pods wherever resources allow. Real applications often need more control: databases on SSD nodes, replicas on different machines, a cache next to its client. Kubernetes offers a ladder of tools, from a simple label match to expressions about **other Pods**. Choosing the simplest tool that works keeps clusters understandable.'},
{h:'The ladder'},
{t:[['Tool','Strength','Expresses','Use when'],
['`nodeName`','Absolute (bypasses scheduler)','"this exact node"','Debugging only'],
['**`nodeSelector`**','Hard, simple','Node must have all these labels','One or two clear requirements'],
['**Node affinity**','Hard or soft, expressive','Operators (`In`, `NotIn`, `Exists`, `Gt`, `Lt`), several terms, weights','Zones, hardware types, preferences'],
['**Pod affinity**','Hard or soft','"Near Pods matching X"','Co-locate a cache with its consumer'],
['**Pod anti-affinity**','Hard or soft','"Away from Pods matching X"','Spread replicas'],
['**Topology spread constraints**','Hard or soft, with skew','"Even across zones or nodes"','Preferred modern way to spread replicas (next lectures)']]},
{h:'nodeSelector'},
{code:`kubectl label node worker1 disktype=ssd
kubectl get nodes -l disktype=ssd

spec:
  nodeSelector:
    disktype: ssd            # node must carry ALL listed labels`},
{p:'Built-in labels you can use without adding your own: `kubernetes.io/hostname`, `kubernetes.io/os`, `kubernetes.io/arch`, `topology.kubernetes.io/zone`, `topology.kubernetes.io/region`, `node.kubernetes.io/instance-type`.'},
{h:'Node affinity: required versus preferred'},
{code:`spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:    # HARD: filter
        nodeSelectorTerms:
        - matchExpressions:                              # expressions in one term are ANDed
          - {key: topology.kubernetes.io/zone, operator: In, values: [eu-west-1a, eu-west-1b]}
          - {key: disktype, operator: Exists}
      preferredDuringSchedulingIgnoredDuringExecution:   # SOFT: score
      - weight: 80                                       # 1 to 100
        preference:
          matchExpressions: [{key: node.kubernetes.io/instance-type, operator: In, values: [m5.xlarge]}]`},
{ul:['Multiple entries under `nodeSelectorTerms` are **ORed**; the expressions inside one term are **ANDed**.','`IgnoredDuringExecution` means that if node labels change later, a **running** Pod is not evicted. The rule is only checked when scheduling.','If you use both `nodeSelector` and `nodeAffinity`, **both** must be satisfied.','Preferred rules add the weight to a node score when matched; they never make a Pod unschedulable.']},
{h:'Pod affinity and anti-affinity and the topologyKey'},
{p:'These rules relate a Pod to **other Pods already running**. The `topologyKey` is a node label that defines what "together" means: `kubernetes.io/hostname` means the same node, `topology.kubernetes.io/zone` the same zone.'},
{code:`spec:
  affinity:
    podAntiAffinity:                       # never two web replicas on the same node
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector: {matchLabels: {app: web}}
        topologyKey: kubernetes.io/hostname
    podAffinity:                           # prefer the zone where the cache runs
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 50
        podAffinityTerm:
          labelSelector: {matchLabels: {app: cache}}
          topologyKey: topology.kubernetes.io/zone`},
{t:[['Goal','Rule','Behaviour with 3 replicas and 2 nodes'],
['Max one replica per node (hard)','Required anti-affinity on hostname','2 Pods run, the **third stays Pending**'],
['Prefer separate nodes (soft)','Preferred anti-affinity on hostname','All 3 run; two share a node'],
['Keep app next to its cache (soft)','Preferred pod affinity on zone','Placed in the cache zone if possible']]},
{h:'A worked scenario'},
{code:`# Goal: web replicas on SSD nodes in eu-west-1, never two on the same node, and near the cache.
$ kubectl get nodes -L disktype,topology.kubernetes.io/zone
NAME      STATUS   DISKTYPE   ZONE
worker1   Ready    ssd        eu-west-1a
worker2   Ready    ssd        eu-west-1b
worker3   Ready    hdd        eu-west-1a
$ kubectl get pods -l app=web -o wide
NAME      NODE
web-a     worker1
web-b     worker2
web-c     <none>                # Pending: only two SSD nodes and a hard anti-affinity rule
$ kubectl describe pod web-c | grep -A2 FailedScheduling
  0/3 nodes are available: 1 node(s) didn't match Pod's node affinity/selector, 2 node(s) didn't match pod anti-affinity rules.`},
{h:'Cost and pitfalls'},
{ul:['**Required anti-affinity with more replicas than nodes** leaves replicas Pending forever. Use a soft rule or topology spread.','Pod affinity and anti-affinity are **expensive** in large clusters (the scheduler compares many Pods), so avoid them on thousands of nodes.','Labels are strings: a typo in a key or value simply matches nothing. Check with `kubectl get nodes -l key=value`.','`matchLabels` in anti-affinity must select the **same** Pods you want to spread (include the right labels, and use `namespaceSelector` if needed).','Affinity is not a security boundary: it only guides placement.']},
{note:'Rule of thumb: nodeSelector for simple needs, node affinity for expressions and preferences, topology spread constraints for spreading, pod affinity only when co-location really matters.'}],
src:[['Assigning Pods to Nodes',SE+'assign-pod-node/'],['Well-Known Labels, Annotations and Taints',C+'overview/working-with-objects/common-labels/']]};

/* ---------- 2: Taints and tolerations ---------- */
L['k8s:5:2']={blocks:[
{p:'Affinity **attracts** Pods to nodes. **Taints** do the opposite: a node declares "keep away unless you have permission", and Pods that **tolerate** the taint are the permitted exceptions. Taints let the node owner protect a node (control plane, GPU machines, nodes under maintenance) without editing every workload.'},
{svg:taint},
{h:'Anatomy of a taint and a toleration'},
{p:'A taint is `key=value:effect` on a node. A toleration on a Pod **matches** a taint by key, value, operator and effect. A toleration only **permits**; it does not attract.'},
{code:`kubectl taint nodes gpu1 hardware=gpu:NoSchedule        # add
kubectl taint nodes gpu1 hardware=gpu:NoSchedule-       # remove (trailing minus)
kubectl describe node gpu1 | grep -i taints
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints[*].key

spec:
  tolerations:
  - {key: hardware, operator: Equal, value: gpu, effect: NoSchedule}
  - {key: maintenance, operator: Exists}                 # any value, any effect for this key
  - {operator: Exists}                                   # tolerates EVERYTHING (system agents)`},
{t:[['Effect','New Pods without toleration','Running Pods without toleration','Use'],
['`NoSchedule`','Not scheduled here','Left alone','Reserve nodes for specific workloads'],
['`PreferNoSchedule`','Avoided if possible (soft)','Left alone','A gentle discouragement'],
['`NoExecute`','Not scheduled','**Evicted** (after `tolerationSeconds`, if set)','Node failures, forced drains']]},
{h:'Taints the system adds automatically'},
{t:[['Taint','When','Effect on your Pods'],
['`node-role.kubernetes.io/control-plane:NoSchedule`','kubeadm control plane nodes','Normal workloads stay off the control plane'],
['`node.kubernetes.io/not-ready:NoExecute`, `unreachable:NoExecute`','Node controller when the node stops reporting','Pods evicted after the default toleration of **300 seconds**'],
['`node.kubernetes.io/memory-pressure`, `disk-pressure`, `pid-pressure`','Kubelet under resource pressure','New Pods avoid the node'],
['`node.kubernetes.io/unschedulable:NoSchedule`','`kubectl cordon`','No new Pods'],
['`node.cloudprovider.kubernetes.io/uninitialized`','New cloud node before the cloud controller finishes','Wait for initialisation']]},
{p:'Every Pod gets default tolerations for `not-ready` and `unreachable` with `tolerationSeconds: 300`. That is why a failed node takes **about five minutes** to lose its Pods. Latency-sensitive services can shorten it:'},
{code:`spec:
  tolerations:
  - {key: node.kubernetes.io/unreachable, operator: Exists, effect: NoExecute, tolerationSeconds: 30}
  - {key: node.kubernetes.io/not-ready,   operator: Exists, effect: NoExecute, tolerationSeconds: 30}`},
{h:'Dedicated nodes: taint plus label'},
{p:'To dedicate nodes to a team or hardware, you need **two** controls, because a toleration does not attract: a **taint** keeps other workloads off, and a **label with nodeSelector or affinity** pulls your workload on.'},
{code:`kubectl label node gpu1 hardware=gpu
kubectl taint node gpu1 hardware=gpu:NoSchedule
# GPU workloads: tolerate the taint AND select the label
spec:
  nodeSelector: {hardware: gpu}
  tolerations: [{key: hardware, operator: Equal, value: gpu, effect: NoSchedule}]`},
{h:'Seeing it work'},
{code:`$ kubectl run plain --image=nginx
$ kubectl get pod plain -o wide                       # lands on a normal node, never on gpu1
$ kubectl taint nodes worker2 maint=true:NoExecute    # NoExecute evicts running Pods without toleration
$ kubectl get pods -o wide -w                         # Pods on worker2 terminate and are recreated elsewhere
$ kubectl taint nodes worker2 maint-`},
{h:'Common mistakes'},
{t:[['Mistake','Result','Fix'],
['Adding a toleration and expecting Pods to go to that node','They may run anywhere, including there','Add nodeSelector or affinity as well'],
['Tainting every node `NoSchedule`','Nothing can be scheduled','Keep some nodes untainted'],
['Using `NoExecute` casually on a busy node','Running Pods are evicted at once','Use `NoSchedule` or cordon + drain'],
['Forgetting DaemonSet tolerations','Agents (logging, monitoring) missing on tainted nodes','Add `operator: Exists` or the right key'],
['Value mismatch (`gpu` versus `GPU`)','Toleration does not match','Copy values from `describe node`'],
['Single-node lab and the control plane taint','Everything Pending','`kubectl taint nodes NODE node-role.kubernetes.io/control-plane-`']]},
{note:'Exam tip: for "Pod Pending, untolerated taint" the fix is either a toleration in the Pod spec or removing the taint from the node. Read the task to see which one you are allowed to change.'}],
src:[['Taints and Tolerations',SE+'taint-and-toleration/']]};

/* ---------- 3: Topology spread, priority ---------- */
L['k8s:5:3']={blocks:[
{p:'Two questions remain once Pods can be placed: **how do I keep replicas evenly spread** so one failure does not take them all, and **what happens when the cluster is full** and an important Pod cannot fit? Topology spread constraints answer the first; priority and preemption answer the second.'},
{h:'Topology spread constraints'},
{p:'A constraint tells the scheduler to keep the number of matching Pods **balanced across topology domains** (zones, nodes, racks). It is more precise and cheaper than anti-affinity, and it expresses "as even as possible" instead of "never two".'},
{svg:spread},
{code:`spec:
  topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule          # hard; ScheduleAnyway makes it a preference
    labelSelector: {matchLabels: {app: web}}
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector: {matchLabels: {app: web}}`},
{p:'**Skew** is the difference between the number of matching Pods in the **fullest** domain and in the **emptiest** domain. With `maxSkew: 1` across three zones:'},
{t:[['Zone A','Zone B','Zone C','Skew','Where can the next Pod go?'],
['2','2','1','1','C (becomes 2,2,2); A or B would give skew 2'],
['3','3','3','0','Anywhere: any choice gives skew 1'],
['2','2','0','2','Violates the rule already (e.g. after a zone outage); only C is allowed']]},
{ul:['`minDomains` requires a minimum number of domains before a hard constraint is satisfied, useful to force the cluster autoscaler to create zones.','`nodeAffinityPolicy` and `nodeTaintsPolicy` decide whether nodes excluded by affinity or taints count as domains.','Like affinity, constraints are only evaluated at **scheduling time**: scaling down or node loss can leave an imbalance (the descheduler fixes this).','A hard zone constraint plus a soft node constraint is a common, resilient combination.']},
{h:'Priority and preemption'},
{p:'A **PriorityClass** gives Pods an integer priority. Higher priority Pods are scheduled **first** from the queue. When a high-priority Pod cannot fit anywhere, the scheduler can **preempt**: it picks a node, evicts enough lower-priority Pods there, and places the high-priority Pod.'},
{code:`apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: {name: business-critical}
value: 100000                              # higher = more important; system classes are above 1 billion
globalDefault: false                       # true would apply to Pods with no class
preemptionPolicy: PreemptLowerPriority     # Never = queue first but never evict others
description: "Customer-facing services"
---
spec:
  priorityClassName: business-critical     # in the Pod template`},
{code:`$ kubectl get priorityclass
NAME                      VALUE        GLOBAL-DEFAULT   AGE
system-cluster-critical   2000000000   false            40d
system-node-critical      2000001000   false            40d
business-critical         100000       false            1m
$ kubectl get pod web-abc -o jsonpath='{.spec.priority}{"  "}{.spec.priorityClassName}{"\\n"}'
100000  business-critical`},
{flow:['A high-priority Pod is Pending: no node fits','PostFilter looks for nodes where evicting lower-priority Pods would make room','It chooses the node with the least damage and marks victims (graceful termination)','The Pod is "nominated" for that node and scheduled once resources are free','Victims are recreated by their controllers and may become Pending themselves']},
{ul:['Preemption respects **PodDisruptionBudgets** on a best-effort basis: it tries not to violate them but may.','Priority also influences **eviction order** under node pressure (after QoS class and usage over requests).','**Danger**: if any team can use a very high class, they can evict everyone else. Control access with admission policy or a ResourceQuota scoped to PriorityClass.','Do not mix priority with the idea of "guaranteed resources": a high-priority Pod still needs requests to be placed.']},
{h:'Over-provisioning with low priority placeholders'},
{p:'A common pattern keeps spare capacity ready: run "pause" Pods with a **very low** priority that reserve resources. When real workloads arrive, they preempt the placeholders instantly, and the autoscaler adds nodes in the background to host the displaced placeholders.'},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Hard anti-affinity instead of spread for many replicas','Pending replicas when nodes are fewer than replicas','Topology spread with `ScheduleAnyway` or maxSkew above 1'],
['Spread constraint without matching `labelSelector`','Counts the wrong Pods, no spreading','Match the Deployment label'],
['Everything marked critical priority','Preemption storms, priority loses meaning','Few classes; reserve top for platform components'],
['Expecting rebalancing after scale down','Pods stay skewed','Rebalance with rolling restart or descheduler']]},
{note:'Design question: "If one zone disappears, how many replicas remain, and is that still enough?" Spread constraints with maxSkew 1 across three zones turn that answer into a rule.'}],
src:[['Pod Topology Spread Constraints',K.C+'scheduling-eviction/topology-spread-constraints/'],['Pod Priority and Preemption',SE+'pod-priority-preemption/']]};

/* ---------- 4: Cordon, drain, uncordon ---------- */
L['k8s:5:4']={blocks:[
{p:'Nodes need maintenance: kernel updates, Kubernetes upgrades, hardware replacement. The goal is to take a node out of service **without dropping user traffic**. Kubernetes gives you three steps for this (**cordon, drain, uncordon**) and one safety mechanism (**PodDisruptionBudgets**). Knowing what each step really does lets you predict, and fix, a stuck drain.'},
{flow:['cordon: mark the node unschedulable (no NEW Pods)','drain: evict the existing Pods gracefully, respecting PodDisruptionBudgets','do the maintenance: patch, reboot, upgrade, resize','uncordon: make the node schedulable again']},
{h:'Cordon'},
{code:`$ kubectl cordon worker2
node/worker2 cordoned
$ kubectl get nodes
NAME      STATUS                     ROLES    AGE   VERSION
worker2   Ready,SchedulingDisabled   <none>   40d   v1.37.1       # still Ready, existing Pods keep running`},
{p:'Cordon sets `spec.unschedulable: true` and adds the taint `node.kubernetes.io/unschedulable:NoSchedule`. Existing Pods are untouched; only **new** placement is blocked. It is also useful on its own, to hold a suspect node for investigation.'},
{h:'Drain'},
{p:'`kubectl drain` cordons the node, then **evicts** every Pod it can. It uses the **Eviction API**, which, unlike a plain delete, checks PodDisruptionBudgets. Controller-owned Pods are recreated on other nodes by their ReplicaSets, StatefulSets and Jobs.'},
{code:`$ kubectl drain worker2 --ignore-daemonsets --delete-emptydir-data
node/worker2 already cordoned
Warning: ignoring DaemonSet-managed Pods: kube-system/kube-proxy-9xk2p, kube-system/calico-node-4tq8z
evicting pod shop/web-6d4f8b7c9-4xk2p
evicting pod shop/db-1
error when evicting pods/"db-1" -n "shop" (will retry after 5s): Cannot evict pod as it would violate the pod's disruption budget.
evicting pod shop/db-1
pod/web-6d4f8b7c9-4xk2p evicted
pod/db-1 evicted
node/worker2 drained`},
{t:[['What blocks a drain','Flag or fix'],
['DaemonSet Pods (cannot be moved)','`--ignore-daemonsets`'],
['Pods using `emptyDir` (data would be lost)','`--delete-emptydir-data`'],
['Pods with no controller (bare Pods would be gone for good)','`--force`, knowing they will not return'],
['A PodDisruptionBudget would be violated','Wait, add replicas, or fix the budget; the drain keeps retrying'],
['Pods that never terminate (stuck finalizer, long grace period)','`--timeout`, `--grace-period`, investigate the Pod']]},
{h:'PodDisruptionBudgets: availability under voluntary disruption'},
{code:`apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: {name: web-pdb, namespace: shop}
spec:
  minAvailable: 2           # or maxUnavailable: 1 (use one of the two)
  selector: {matchLabels: {app: web}}`},
{code:`$ kubectl get pdb -n shop
NAME      MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS   AGE
web-pdb   2               N/A               1                     5m          # with 3 healthy Pods, 1 may be evicted now`},
{t:[['Situation','ALLOWED DISRUPTIONS','Drain behaviour'],
['3 replicas, `minAvailable: 2`, all Ready','1','Evicts one, waits until it is Ready elsewhere, then the next'],
['2 replicas, `minAvailable: 2`','0','**Hangs**: nothing can ever be evicted; use `maxUnavailable: 1`'],
['1 replica, `minAvailable: 1`','0','**Hangs** (use 2+ replicas)'],
['A Pod already NotReady','Reduced','The budget counts only healthy Pods']]},
{p:'PDBs protect only against **voluntary** disruptions (drain, autoscaler, upgrades). A node crash, an OOM kill or `kubectl delete pod` are involuntary and ignore the budget, though they use it up.'},
{h:'Uncordon and verify'},
{code:`kubectl uncordon worker2
kubectl get nodes
kubectl get pods -A -o wide --field-selector spec.nodeName=worker2        # Pods do NOT automatically return
kubectl rollout restart deployment/web -n shop                            # optional: rebalance`},
{p:'Uncordon only **allows** scheduling; it does not move Pods back. Over time new Pods land on the node again, or you can restart workloads to spread them.'},
{h:'Troubleshooting a stuck drain'},
{code:`kubectl drain worker2 --ignore-daemonsets --delete-emptydir-data --timeout=120s
# stuck? find what is left
kubectl get pods -A -o wide --field-selector spec.nodeName=worker2
kubectl get pdb -A                                    # any ALLOWED DISRUPTIONS = 0 ?
kubectl describe pod STUCK-POD | sed -n '/Events:/,$p'`},
{note:'Safe upgrade rhythm: drain one node, wait until all Pods are healthy again on other nodes, then continue. Draining all nodes of a pool at once ignores capacity and recovery time.'}],
src:[['Safely Drain a Node',T+'administer-cluster/safely-drain-node/'],['Disruptions and PodDisruptionBudget',C+'workloads/pods/disruptions/'],['kubectl drain',R+'kubectl/generated/kubectl_drain/']]};

/* ---------- 5: Metrics server and HPA ---------- */
L['k8s:5:5']={blocks:[
{p:'Load changes. The **HorizontalPodAutoscaler (HPA)** adjusts the number of replicas of a workload to follow load. It depends on **Metrics Server** for CPU and memory numbers. Understanding the formula and its inputs explains both how scaling works and why it so often does nothing.'},
{h:'Where the numbers come from'},
{flow:['The kubelet measures container CPU and memory (cAdvisor)','Metrics Server scrapes every kubelet (about every 15 seconds) and keeps the latest sample','It serves the Metrics API (metrics.k8s.io), registered as an APIService','kubectl top and the HPA controller query it']},
{code:`kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl -n kube-system rollout status deployment/metrics-server
# Lab clusters with self-signed kubelet certificates usually need this container arg (lab only):
#   --kubelet-insecure-tls
$ kubectl get apiservice v1beta1.metrics.k8s.io
NAME                     SERVICE                      AVAILABLE   AGE
v1beta1.metrics.k8s.io   kube-system/metrics-server   True        2m          # False = broken
$ kubectl top nodes ; kubectl top pods -A --sort-by=cpu | head`},
{h:'The HPA control loop'},
{p:'Roughly every 15 seconds the HPA controller reads the current metric for the target Pods, compares it with the target and computes a desired replica count:'},
{p:'**desiredReplicas = ceil( currentReplicas x currentValue / targetValue )**'},
{t:[['Current replicas','Average CPU utilization','Target','Calculation','Desired'],
['4','90%','60%','4 x 90 / 60 = 6','6'],
['6','30%','60%','6 x 30 / 60 = 3','3 (scale-down is damped)'],
['4','63%','60%','4 x 63 / 60 = 4.2, within a 10% tolerance of the target','4 (no change)']]},
{ul:['**Utilization** means usage as a percentage of the container **request**. Without CPU requests the HPA cannot compute it and shows `<unknown>`.','The HPA ignores changes within a **tolerance** (about 10 percent) to avoid flapping.','Pods that are not Ready or are still starting are treated conservatively so a slow start does not cause runaway scaling.','The bounds `minReplicas` and `maxReplicas` always apply.']},
{code:`apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: {name: web, namespace: shop}
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
    scaleUp:
      policies: [{type: Percent, value: 100, periodSeconds: 60}]      # at most double per minute
    scaleDown:
      stabilizationWindowSeconds: 300                                 # default: look back 5 minutes
      policies: [{type: Pods, value: 1, periodSeconds: 60}]           # remove one Pod per minute`},
{h:'Watching it work'},
{code:`$ kubectl autoscale deployment web -n shop --cpu-percent=60 --min=2 --max=10
$ kubectl run load -n shop --image=busybox:1.36 --restart=Never -- sh -c "while true; do wget -q -O- http://web; done"
$ kubectl get hpa web -n shop -w
NAME   REFERENCE        TARGETS    MINPODS   MAXPODS   REPLICAS   AGE
web    Deployment/web   <unknown>/60%   2    10        2          10s       # no metrics yet or no requests
web    Deployment/web   145%/60%        2    10        2          1m
web    Deployment/web   145%/60%        2    10        5          1m        # scaled toward 2 x 145/60 = 4.8 -> 5
web    Deployment/web   58%/60%         2    10        5          3m
$ kubectl describe hpa web -n shop | sed -n '/Conditions:/,$p'
  AbleToScale     True   ReadyForNewScale
  ScalingActive   True   ValidMetricsFound
  ScalingLimited  False  DesiredWithinRange`},
{t:[['Symptom','Cause'],
['`<unknown>/60%`','Metrics Server missing or unhealthy, or Pods have **no CPU request**'],
['Never scales up under load','Request too high so utilization stays low, or the bottleneck is not CPU (use custom metrics)'],
['Scales up but new Pods Pending','No node capacity; a node autoscaler is needed'],
['Flapping up and down','Stabilization window too short or metric noisy'],
['`FailedGetResourceMetric` events','Metrics API unavailable, or Pod metrics not yet scraped']]},
{h:'Practical rules'},
{ul:['Every autoscaled container needs **requests**; otherwise the HPA has no baseline.','Omit `replicas` from the Deployment manifest once an HPA manages it, or each `apply` resets it.','Scale up quickly and down slowly: defaults already behave this way.','CPU is only one signal. For queues, request rates and latency use **custom or external metrics** (Prometheus adapter, KEDA).','The HPA scales Pods; adding nodes for Pending Pods needs a cluster or node autoscaler.']},
{note:'Exam tip: `kubectl autoscale deployment NAME --cpu-percent=50 --min=2 --max=8` creates the HPA. Remember it needs Metrics Server and a CPU request on the Pods.'}],
src:[['Horizontal Pod Autoscaling',C+'workloads/autoscaling/horizontal-pod-autoscale/'],['HPA walkthrough',T+'run-application/horizontal-pod-autoscale-walkthrough/'],['Metrics Server','https://github.com/kubernetes-sigs/metrics-server']]};

/* ---------- 6: ResourceQuota and LimitRange ---------- */
L['k8s:5:6']={blocks:[
{p:'On a shared cluster, one team can unintentionally consume everything, and one forgotten Pod without limits can destabilise a node. **LimitRange** and **ResourceQuota** are the guardrails: LimitRange shapes **individual containers**, ResourceQuota caps **a whole namespace**. Together they make multi-team clusters predictable.'},
{t:[['','LimitRange','ResourceQuota'],
['Scope','Each container, Pod or PVC in a namespace','The sum over the namespace'],
['What it does','Sets **defaults**; enforces **min**, **max** and request to limit **ratio**','Caps **totals**: CPU, memory, storage, object counts'],
['When checked','At object creation (admission)','At object creation (admission)'],
['Effect on running Pods','None','None (it does not evict)'],
['Violation','Request rejected','Request rejected: `exceeded quota`']]},
{h:'LimitRange: shape the individual workload'},
{code:`apiVersion: v1
kind: LimitRange
metadata: {name: container-limits, namespace: team-a}
spec:
  limits:
  - type: Container
    defaultRequest: {cpu: 100m, memory: 128Mi}      # request given if the container sets none
    default:        {cpu: 500m, memory: 256Mi}      # limit given if the container sets none
    min:            {cpu: 50m,  memory: 64Mi}
    max:            {cpu: "2",  memory: 2Gi}
    maxLimitRequestRatio: {cpu: "10"}               # limit may be at most 10x the request
  - type: PersistentVolumeClaim
    max: {storage: 50Gi}`},
{ul:['Defaults are **injected into the Pod** at creation: `kubectl get pod -o yaml` shows values you never wrote.','A container asking for more than `max` or less than `min` is rejected with a clear message (`maximum cpu usage per Container is 2, but limit is 4`).','LimitRange acts on **new** objects only; changing it does not alter running Pods.']},
{h:'ResourceQuota: cap the namespace'},
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
{code:`$ kubectl describe quota team-a-quota -n team-a
Name:                   team-a-quota
Resource                Used   Hard
--------                ----   ----
limits.cpu              8      20
limits.memory           16Gi   40Gi
pods                    23     50
requests.cpu            4500m  10            # 4.5 of 10 CPUs requested by all Pods in the namespace
requests.memory         9Gi    20Gi
services.loadbalancers  1      2`},
{h:'What happens when a quota is hit'},
{code:`$ kubectl -n team-a create deployment big --image=nginx --replicas=3
deployment.apps/big created                         # the Deployment object itself is accepted...
$ kubectl -n team-a get deploy big
NAME   READY   UP-TO-DATE   AVAILABLE
big    0/3     0            0
$ kubectl -n team-a describe rs -l app=big | grep -A2 Events
  Warning  FailedCreate  replicaset-controller  Error creating: pods "big-xxxx" is forbidden: exceeded quota: team-a-quota, requested: requests.cpu=4, used: requests.cpu=8, limited: requests.cpu=10`},
{p:'Two details matter. First, the **Deployment is created**, but its **ReplicaSet** cannot create Pods, so the error appears in the ReplicaSet events, not on the Deployment. Second, once a quota covers `requests.cpu` or `limits.memory`, every Pod **must declare** those values (or get them from a LimitRange); otherwise creation fails with `must specify requests.cpu`.'},
{h:'Quota scopes'},
{t:[['Scope','Counts only'],
['`BestEffort` / `NotBestEffort`','Pods by QoS class'],
['`Terminating` / `NotTerminating`','Pods with or without an active deadline (batch versus services)'],
['`PriorityClass` (with `scopeSelector`)','Pods of given priority classes: limits who can use high priority'],
['`CrossNamespacePodAffinity`','Pods using affinity across namespaces']]},
{h:'Typical multi-tenant setup'},
{flow:['Namespace per team with team labels','LimitRange: sane defaults and a ceiling per container','ResourceQuota: total CPU, memory, storage, object counts','Default-deny NetworkPolicy and Pod Security labels','RoleBinding for the team group, so they can use their namespace but not change the quota']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Fix'],
['Quota on CPU or memory without a LimitRange','Every Pod without requests is rejected, teams are confused','Add LimitRange defaults'],
['Looking for quota errors on the Deployment','Nothing visible there','Check `kubectl describe rs` and events'],
['Quota too tight for rolling updates','Surge Pods cannot be created, rollout stalls','Leave headroom for maxSurge'],
['Letting teams edit their own quota','Quota is bypassed','Restrict RBAC on `resourcequotas`'],
['Assuming quota evicts Pods','It only blocks new requests','Scale down or raise the quota']]},
{note:'Exam tip: `kubectl create quota NAME --hard=cpu=2,memory=4Gi,pods=10 -n ns` creates a ResourceQuota quickly; a LimitRange has no imperative shortcut, so copy the YAML from the docs.'}],
src:[['Resource Quotas',C+'policy/resource-quotas/'],['Limit Ranges',C+'policy/limit-range/'],['Configure Memory and CPU Quotas for a Namespace',T+'administer-cluster/manage-resources/quota-memory-cpu-namespace/']]};

/* ---------- 7: Practical ---------- */
L['k8s:5:7']={blocks:[
{p:'This lab uses everything in the section: placement with labels and taints, controlled maintenance with a PodDisruptionBudget, and autoscaling under load. You need a cluster with **at least two worker nodes** (kind with two workers is enough) and Metrics Server installed. For every step, **predict the outcome first**, then check.'},
{flow:['Label a node and place a Pod on it','Taint a node and watch placement change','Spread replicas with topology constraints','Drain a node with a PDB in place','Autoscale a Deployment under load','Clean up']},
{h:'0. Setup'},
{code:`kubectl create ns sched-lab && kubectl config set-context --current --namespace=sched-lab
kubectl get nodes -o wide
kubectl top nodes                                   # confirms Metrics Server works`},
{h:'1. Node selector and a deliberately impossible rule'},
{code:`kubectl label node <worker1> disktype=ssd
kubectl run ssd-pod --image=nginx:1.27 --dry-run=client -o yaml > ssd.yaml
# add under spec:   nodeSelector: {disktype: ssd}
kubectl apply -f ssd.yaml && kubectl get pod ssd-pod -o wide          # expect: worker1

# Now break it: change the selector to disktype=nvme and recreate
kubectl delete pod ssd-pod && sed -i 's/ssd$/nvme/' ssd.yaml && kubectl apply -f ssd.yaml
kubectl describe pod ssd-pod | grep -A2 FailedScheduling             # didn't match Pod's node affinity/selector`},
{h:'2. Taints'},
{code:`kubectl taint node <worker2> maint=true:NoSchedule
kubectl create deployment spread --image=nginx:1.27 --replicas=4
kubectl get pods -l app=spread -o wide              # predict: all on worker1 (worker2 is tainted)

kubectl patch deployment spread --type=json -p '[{"op":"add","path":"/spec/template/spec/tolerations","value":[{"key":"maint","operator":"Exists","effect":"NoSchedule"}]}]'
kubectl get pods -l app=spread -o wide              # new Pods may now land on worker2`},
{h:'3. Topology spread'},
{code:`kubectl delete deployment spread
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata: {name: even}
spec:
  replicas: 4
  selector: {matchLabels: {app: even}}
  template:
    metadata: {labels: {app: even}}
    spec:
      tolerations: [{key: maint, operator: Exists, effect: NoSchedule}]
      topologySpreadConstraints:
      - {maxSkew: 1, topologyKey: kubernetes.io/hostname, whenUnsatisfiable: DoNotSchedule, labelSelector: {matchLabels: {app: even}}}
      containers: [{name: web, image: nginx:1.27, resources: {requests: {cpu: 50m}}}]
EOF
kubectl get pods -l app=even -o wide                # expect 2 and 2 across the two workers`},
{h:'4. Drain with a PodDisruptionBudget'},
{code:`kubectl create poddisruptionbudget even-pdb --selector=app=even --min-available=3
kubectl get pdb                                    # ALLOWED DISRUPTIONS 1
kubectl drain <worker1> --ignore-daemonsets --delete-emptydir-data --timeout=60s
# Observe: it evicts one Pod, then waits ("would violate the pod's disruption budget") until the replacement is Ready.
kubectl get pods -l app=even -o wide -w            # replacements appear on the other node
kubectl uncordon <worker1>`},
{p:'**Predict:** which Pods block the drain? The bare `ssd-pod` has no controller, so drain refuses without `--force`. Forcing it deletes the Pod permanently.'},
{h:'5. Autoscaling under load'},
{code:`kubectl set resources deployment even --requests=cpu=50m --limits=cpu=200m
kubectl expose deployment even --port=80
kubectl autoscale deployment even --cpu-percent=50 --min=2 --max=6
kubectl run load --image=busybox:1.36 --restart=Never -- sh -c "while true; do wget -q -O- http://even >/dev/null; done"
kubectl get hpa even -w                            # watch TARGETS rise and REPLICAS grow, then Ctrl+C
kubectl delete pod load
kubectl get hpa even -w                            # replicas fall slowly after the 5 minute stabilization window`},
{h:'Check yourself'},
{t:[['Question','Answer'],
['Why did the Pod stay Pending with the `nvme` selector?','No node carries the label; FailedScheduling names it'],
['Why did the tainted node receive no Pods until the toleration?','The taint filtered it out; a toleration only permits'],
['Why did the drain pause?','The PDB allowed only one disruption at a time'],
['Why did the HPA show `<unknown>` at first?','No metrics yet or no CPU requests'],
['Why do scaled-down Pods disappear slowly?','Scale-down stabilization window and policies']]},
{h:'Clean up'},
{code:`kubectl taint node <worker2> maint-
kubectl label node <worker1> disktype-
kubectl delete ns sched-lab
kubectl config set-context --current --namespace=default`},
{note:'Exam tip: tasks in this domain are usually "schedule this Pod on that node", "tolerate this taint", "drain this node" or "create an HPA". Practise each in under two minutes using `kubectl run`, `kubectl taint`, `kubectl drain` and `kubectl autoscale`.'}],
src:[['Assigning Pods to Nodes',SE+'assign-pod-node/'],['Safely Drain a Node',T+'administer-cluster/safely-drain-node/'],['Horizontal Pod Autoscaling',C+'workloads/autoscaling/horizontal-pod-autoscale/']]};

/* ---------- Additional content ---------- */
/* 8: Scheduler profiles and multiple schedulers */
L['k8s:5:8']={blocks:[
{p:'The default scheduler is a **framework of plugins**. You can tune which plugins run and with what weights using **profiles**, or run a **second scheduler** for special workloads.'},
{h:'Scheduler configuration and profiles'},
{p:'On kubeadm the scheduler reads an optional `KubeSchedulerConfiguration` file passed with `--config`. One scheduler process can host several **profiles**, each with its own `schedulerName`.'},
{code:`# /etc/kubernetes/scheduler-config.yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
clientConnection:
  kubeconfig: /etc/kubernetes/scheduler.conf
profiles:
- schedulerName: default-scheduler
- schedulerName: bin-packing-scheduler
  pluginConfig:
  - name: NodeResourcesFit
    args:
      scoringStrategy:
        type: MostAllocated              # pack Pods tightly instead of spreading
        resources:
        - {name: cpu, weight: 1}
        - {name: memory, weight: 1}
  plugins:
    score:
      disabled:
      - {name: NodeResourcesBalancedAllocation}`},
{code:`# kube-scheduler static Pod manifest: add the flag and mount the file
#   --config=/etc/kubernetes/scheduler-config.yaml
# (plus a hostPath volume and volumeMount for that file)

# A Pod opts into a profile by name
spec:
  schedulerName: bin-packing-scheduler`},
{ul:['Pods without `schedulerName` use `default-scheduler`.','A Pod naming a scheduler that does not exist stays **Pending** with no events: nobody is looking at it.','Extension points include queue sort, filter, score, reserve and bind. Plugins attach to them.']},
{h:'Running a second scheduler'},
{p:'For custom logic you can deploy another scheduler binary (or the same one with a different config) as a Deployment, with its own ServiceAccount, RBAC, leader election name and `schedulerName`.'},
{code:`kubectl -n kube-system get deploy,pods -l component=my-scheduler
kubectl get pod web -o jsonpath='{.spec.schedulerName}{"\\n"}'
kubectl get events --field-selector reason=Scheduled | head     # who scheduled it: "Successfully assigned ... (by bin-packing-scheduler)"`},
{ul:['Give the second scheduler its own **lease name** so leader election does not clash with the default one.','Keep the roles minimal: it needs permissions to watch Pods and Nodes and to create bindings.','Competing schedulers can both see a Pod only if the Pod does not name one; always set `schedulerName`.']},
{note:'On managed services you normally cannot change the default scheduler configuration, but you can still run an additional scheduler as a normal workload.'}],
src:[['Scheduler Configuration',K.C+'scheduling-eviction/scheduler-perf-tuning/'],['Configure Multiple Schedulers',K.T+'extend-kubernetes/configure-multiple-schedulers/'],['Scheduling Framework',K.C+'scheduling-eviction/scheduling-framework/']]};

/* 9: Descheduler */
L['k8s:5:9']={blocks:[
{p:'The scheduler decides **once**, when a Pod is created. Over time nodes join and leave, labels change and load shifts, so the cluster drifts away from a good layout. The **descheduler** evicts Pods that no longer fit well so the scheduler can place them again.'},
{h:'What it does and does not do'},
{ul:['It **evicts** Pods through the Eviction API (respecting PDBs); it never places them. The normal scheduler decides the new location.','It only evicts Pods that have an owner controller, so they come back.','It runs as a **Job, CronJob or Deployment** with a policy configuration.']},
{h:'Typical strategies (plugins)'},
{t:[['Strategy','Evicts Pods when'],
['`RemoveDuplicates`','Several Pods of one controller run on the same node'],
['`LowNodeUtilization`','Some nodes are underused and others overused: moves Pods toward balance'],
['`HighNodeUtilization`','Packs Pods onto fewer nodes so autoscalers can remove empty ones'],
['`RemovePodsViolatingNodeAffinity`, `...NodeTaints`, `...InterPodAntiAffinity`','Rules were violated after scheduling because labels or taints changed'],
['`RemovePodsViolatingTopologySpreadConstraint`','Replicas have become skewed across zones'],
['`PodLifeTime`, `RemovePodsHavingTooManyRestarts`','Pods are too old or crash too often']]},
{code:`apiVersion: descheduler/v1alpha2
kind: DeschedulerPolicy
profiles:
- name: balance
  pluginConfig:
  - name: LowNodeUtilization
    args:
      thresholds:        {cpu: 20, memory: 20, pods: 20}
      targetThresholds:  {cpu: 50, memory: 50, pods: 50}
  - name: DefaultEvictor
    args:
      evictLocalStoragePods: false
      nodeFit: true
  plugins:
    balance:
      enabled: [LowNodeUtilization]`},
{code:`helm repo add descheduler https://kubernetes-sigs.github.io/descheduler/
helm install descheduler descheduler/descheduler -n kube-system --set schedule="*/10 * * * *"
kubectl -n kube-system logs -l app.kubernetes.io/name=descheduler --tail=30`},
{h:'Safe use'},
{ul:['Always protect applications with **PodDisruptionBudgets** before running it.','Start with `dryRun: true` (or read logs) to see what it would evict.','Exclude system namespaces and use annotation `descheduler.alpha.kubernetes.io/evict` and priority thresholds to control targets.','Do not combine aggressive descheduling with aggressive autoscaling without watching for churn loops.']},
{note:'Use the descheduler when you see persistent skew after maintenance or upgrades. For most clusters, topology spread constraints plus a node autoscaler cover the same need with less moving parts.'}],
src:[['Descheduler','https://github.com/kubernetes-sigs/descheduler'],['Eviction',K.C+'scheduling-eviction/api-eviction/'],['Pod Disruption Budget',K.C+'workloads/pods/disruptions/']]};

/* 10: VPA */
L['k8s:5:10']={blocks:[
{p:'The **Vertical Pod Autoscaler (VPA)** watches real resource use and recommends, or applies, better CPU and memory **requests** for containers. The HPA changes how many Pods run; the VPA changes how big each Pod is.'},
{h:'Components'},
{t:[['Component','Role'],
['**Recommender**','Computes target requests from usage history'],
['**Updater**','Evicts Pods whose requests differ too much from the recommendation (in modes that recreate Pods)'],
['**Admission controller**','Sets the recommended requests when new Pods are created']]},
{p:'The VPA is **not part of core Kubernetes**: install it from the autoscaler project. It needs Metrics Server.'},
{code:`apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata: {name: web}
spec:
  targetRef: {apiVersion: apps/v1, kind: Deployment, name: web}
  updatePolicy:
    updateMode: "Off"          # Off | Initial | Recreate | Auto
  resourcePolicy:
    containerPolicies:
    - containerName: app
      minAllowed: {cpu: 50m, memory: 64Mi}
      maxAllowed: {cpu: "2", memory: 2Gi}
      controlledResources: [cpu, memory]`},
{t:[['updateMode','Behaviour'],
['`Off`','Only produce recommendations (safe starting point)'],
['`Initial`','Apply requests only when Pods are created'],
['`Recreate` / `Auto`','Evict Pods to apply new requests; newer versions can use in-place resize where supported']]},
{code:`kubectl describe vpa web
# Recommendation:
#   Container Recommendations:
#     Container Name: app
#     Lower Bound:   cpu 25m  memory 262144k
#     Target:        cpu 63m  memory 262144k
#     Upper Bound:   cpu 301m memory 1047M`},
{h:'VPA and HPA together'},
{ul:['Do **not** let the VPA and HPA both act on the same metric (CPU) for the same workload: they fight.','A common pairing: HPA on a custom or request-rate metric, VPA for memory.','VPA in `Off` mode is excellent for **right-sizing reports** even when you apply changes through Git.']},
{h:'Limits'},
{ul:['Changing requests of a running Pod used to require a restart; check whether your VPA and Kubernetes versions support in-place updates.','Pods in a single-replica Deployment suffer a disruption on eviction; use 2+ replicas and PDBs.','Recommendations need time and representative load to be meaningful.']},
{note:'Treat VPA recommendations as input to a decision. Compare them with peak load, JVM and runtime settings and your SLOs before changing production requests.'}],
src:[['Vertical Pod Autoscaling',K.C+'workloads/autoscaling/vertical-pod-autoscale/'],['VPA project','https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler'],['Resource Management for Pods and Containers',K.C+'configuration/manage-resources-containers/']]};

/* 11: Node autoscaling */
L['k8s:5:11']={blocks:[
{p:'The HPA adds Pods; **node autoscalers** add the machines those Pods need and remove machines that sit idle.'},
{flow:['HPA or a user creates more Pods','Scheduler cannot place some: they stay Pending (Insufficient cpu)','Node autoscaler sees unschedulable Pods and adds node capacity','New node joins, scheduler places the Pods','Later: nodes become underused, Pods are consolidated and empty nodes are removed']},
{h:'Cluster Autoscaler'},
{ul:['Works with **predefined node groups** (cloud auto scaling groups, scale sets, managed node pools) with a min and max size.','**Scale up**: when Pods are Pending because of resources, it simulates which node group would fit them and grows it.','**Scale down**: when a node is underused for a period and its Pods can be moved elsewhere, it drains and removes it.','Respects PodDisruptionBudgets, and will not remove nodes with Pods that cannot be evicted (local storage, no controller, annotation `cluster-autoscaler.kubernetes.io/safe-to-evict: "false"`).']},
{code:`kubectl -n kube-system logs deploy/cluster-autoscaler --tail=30
kubectl get nodes
kubectl get pods -A --field-selector status.phase=Pending
# Pod annotation to protect a Pod from scale-down
metadata:
  annotations:
    cluster-autoscaler.kubernetes.io/safe-to-evict: "false"`},
{h:'Karpenter'},
{p:'**Karpenter** provisions nodes **directly from Pod requirements** instead of scaling predefined groups. It picks the instance types that fit the pending Pods (size, architecture, price, zone), launches them and later **consolidates** workloads to cheaper or fewer nodes.'},
{code:`apiVersion: karpenter.sh/v1
kind: NodePool
metadata: {name: general}
spec:
  template:
    spec:
      requirements:
      - {key: karpenter.sh/capacity-type, operator: In, values: [on-demand, spot]}
      - {key: kubernetes.io/arch, operator: In, values: [amd64]}
      nodeClassRef: {group: karpenter.k8s.aws, kind: EC2NodeClass, name: default}
  limits:
    cpu: "200"
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized`},
{t:[['','Cluster Autoscaler','Karpenter'],
['Capacity model','Fixed node groups','Provisions nodes to fit Pods'],
['Instance choice','Per group','Per request, across many types and spot'],
['Consolidation','Basic scale-down','Active consolidation and replacement'],
['Where','Many clouds and providers','Strongest on AWS, with other providers developing']]},
{h:'Practical advice'},
{ul:['Always set **requests**: autoscalers decide using requests, not actual usage.','Use PDBs and topology spread so scale-down and consolidation do not cause outages.','Spread critical workloads across zones; keep system Pods on stable nodes.','Set max sizes and budgets to avoid runaway cost.','Provider names and APIs (`NodePool`, `EC2NodeClass`) change between versions; follow the current project documentation.']},
{note:'Cluster autoscaling reacts in minutes (VM boot). Keep some headroom or use over-provisioning Pods (low-priority placeholders) when you need instant capacity.'}],
src:[['Node Autoscaling',K.C+'cluster-administration/node-autoscaling/'],['Cluster Autoscaler','https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler'],['Karpenter','https://karpenter.sh/']]};

/* 12: KEDA */
L['k8s:5:12']={blocks:[
{p:'The HPA scales on resource metrics and a few custom ones. **KEDA** (Kubernetes Event-driven Autoscaling) scales workloads on **external events** such as queue length, stream lag, cron schedules or database counts, and it can **scale to zero**.'},
{h:'How it works'},
{flow:['You create a ScaledObject describing the target and the trigger','KEDA polls the event source (queue, stream, metric)','It exposes the value as an external metric to an HPA it manages','Between 1 and max replicas the HPA scales the workload','KEDA itself activates the workload from 0 to 1 and back to 0']},
{code:`apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: {name: worker, namespace: jobs}
spec:
  scaleTargetRef: {name: worker}          # a Deployment
  minReplicaCount: 0                      # scale to zero when idle
  maxReplicaCount: 30
  cooldownPeriod: 300
  triggers:
  - type: rabbitmq
    metadata:
      queueName: tasks
      mode: QueueLength
      value: "20"                         # about 20 messages per replica
    authenticationRef: {name: rabbitmq-auth}
---
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata: {name: rabbitmq-auth, namespace: jobs}
spec:
  secretTargetRef:
  - {parameter: host, name: rabbitmq-secret, key: host}`},
{h:'Scalers'},
{ul:['Message systems: Kafka, RabbitMQ, SQS, Azure Service Bus, Pub/Sub.','Metrics systems: Prometheus queries, Datadog, cloud monitoring.','Data: PostgreSQL, Redis lists, Elasticsearch.','Time: **cron** scaler for scheduled capacity.','HTTP request-based scaling through an add-on.','`ScaledJob` creates Jobs per batch of events instead of scaling a Deployment.']},
{code:`helm repo add kedacore https://kedacore.github.io/charts
helm install keda kedacore/keda -n keda --create-namespace
kubectl get scaledobject -A
kubectl describe scaledobject worker -n jobs
kubectl get hpa -n jobs                  # KEDA creates and owns this HPA`},
{ul:['Do not create your own HPA for the same Deployment; KEDA manages one.','Authenticate to event sources with `TriggerAuthentication` and Secrets or workload identity, not values in the ScaledObject.','Scale to zero means the first event waits for a Pod to start; size that cold start for your SLO.']},
{note:'KEDA scales Pods; node capacity still comes from a node autoscaler. Combine them for fully elastic batch and event workloads.'}],
src:[['KEDA','https://keda.sh/'],['Horizontal Pod Autoscaling',K.C+'workloads/autoscaling/horizontal-pod-autoscale/'],['KEDA scalers','https://keda.sh/docs/latest/scalers/']]};

/* 13: DRA */
L['k8s:5:13']={blocks:[
{p:'Classic **device plugins** expose hardware as simple counted resources such as `nvidia.com/gpu: 1`. **Dynamic Resource Allocation (DRA)** adds a richer model for GPUs, FPGAs, network adapters and other devices: describe what you need, and the scheduler finds a matching device with its attributes.'},
{h:'Concepts'},
{t:[['Object','Purpose'],
['**DeviceClass**','Admin-defined category of devices and how to select them (for example "gpus from this driver")'],
['**ResourceSlice**','Published by drivers on each node: the devices available and their attributes (model, memory, partitions)'],
['**ResourceClaim**','A request for devices by a user or workload, with selection expressions'],
['**ResourceClaimTemplate**','Creates a claim per Pod from a template'],
['**DRA driver**','Node-level plugin that prepares devices for containers']]},
{code:`apiVersion: resource.k8s.io/v1
kind: ResourceClaimTemplate
metadata: {name: gpu-claim}
spec:
  spec:
    devices:
      requests:
      - name: gpu
        exactly:
          deviceClassName: gpu.example.com
          selectors:
          - cel:
              expression: "device.attributes['gpu.example.com'].memory >= 24"   # CEL selects by attribute
---
apiVersion: v1
kind: Pod
metadata: {name: trainer}
spec:
  resourceClaims:
  - name: gpu
    resourceClaimTemplateName: gpu-claim
  containers:
  - name: train
    image: myorg/train:1.0
    resources:
      claims:
      - name: gpu`},
{h:'Why it matters'},
{ul:['**Selection by attributes** (memory size, model) instead of only counts.','**Sharing and partitioning** of devices between Pods or containers.','Scheduling that understands device topology and availability.','A standard API for vendors and platforms instead of per-vendor conventions.']},
{code:`kubectl get deviceclass
kubectl get resourceslices -o wide
kubectl get resourceclaims -A
kubectl describe resourceclaim -n ml trainer-gpu-xxxx`},
{note:'DRA has been advancing quickly across releases. Check the Kubernetes version you run for the current API version (`resource.k8s.io/v1beta1` or `v1`) and feature status, and use the driver documentation of your hardware vendor.'}],
src:[['Dynamic Resource Allocation',K.C+'scheduling-eviction/dynamic-resource-allocation/'],['Device Plugins',K.C+'extend-kubernetes/compute-storage-net/device-plugins/'],['Schedule GPUs',K.T+'manage-gpus/scheduling-gpus/']]};
})();
