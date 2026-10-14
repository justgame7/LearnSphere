/* LearnSphere - Kubernetes Quick Reference (cheat sheet).
   window.QREF['k8s'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for kubeadm-based clusters on a recent Kubernetes release. Check flags and API versions with kubectl explain and the release notes. */
window.QREF=window.QREF||{};
window.QREF['k8s']={title:'Kubernetes Quick Reference',blurb:'Components, ports, files, kubectl commands, states and fixes for a Kubernetes cluster, plus maps of how requests, traffic, storage and security fit together.',hint:'pending or crashloop',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every Kubernetes administrator should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Architecture'},
{acc:[
{t:'Desired state and control loops',s:'You declare, controllers converge.',
 a:'A Kubernetes object stores your **desired state** (`spec`). Controllers continuously compare it with the **observed state** (`status`) and act to remove the difference. Nothing runs a one-off script: the loop keeps trying until reality matches.',
 w:'It explains why a deleted pod comes back, why a failed rollout keeps retrying and why `kubectl apply` is safe to repeat.',
 c:`kubectl get deploy web -o jsonpath='{.spec.replicas} desired, {.status.readyReplicas} ready{"\\n"}'`,see:[0,2,'What is Kubernetes: desired state, control loops and API objects']},
{t:'The API server and request flow',s:'Every change goes through one door.',
 a:'The **kube-apiserver** is the only component that talks to etcd. A request is **authenticated**, **authorised** (RBAC), passed through **admission** (mutating, then validating) and then persisted. Controllers, the scheduler and kubelets all watch the API server.',
 w:'When something is rejected, the stage (authn, authz, admission) tells you where to look.',
 c:`kubectl auth can-i create deployments -n dev
kubectl get --raw /readyz?verbose | head`,see:[2,0,'kube-apiserver and the request flow']},
{t:'etcd',s:'The cluster database.',
 a:'**etcd** is a consistent key-value store that holds all cluster state. It needs a **quorum** (majority) of members. Losing it without a backup means losing the cluster configuration, although running containers continue for a while.',
 w:'A snapshot of etcd is the cluster backup. Test restoring it.',
 c:`sudo ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key endpoint health`,see:[2,1,'etcd as the cluster database']},
{t:'Scheduler and controller manager',s:'Placement and reconciliation.',
 a:'The **scheduler** picks a node for each unscheduled pod by **filtering** (nodes that can run it) then **scoring** (the best fit). The **controller manager** runs the built-in controllers (Deployment, ReplicaSet, Node, Job and others).',
 w:'A pod stuck in Pending is a scheduler question. A deployment that does not scale is a controller question.',
 c:`kubectl get pods -n kube-system -l tier=control-plane
kubectl describe pod mypod | sed -n '/Events/,$p'`,see:[2,2,'Scheduler and controller manager']},
{t:'Node components',s:'kubelet, kube-proxy and the runtime.',
 a:'On every node the **kubelet** talks to the API server and makes the container runtime (containerd) run the pods. **kube-proxy** programs Service rules. A CNI plugin gives pods their network.',
 w:'A NotReady node usually means kubelet, runtime or network trouble on that node.',
 c:`kubectl get nodes -o wide
systemctl status kubelet containerd`,see:[2,3,'Node components and add-ons']},
{t:'Static pods and certificates',s:'The control plane is run by the kubelet.',
 a:'With **kubeadm** the control plane components run as **static pods** from manifests in `/etc/kubernetes/manifests`. Components authenticate with certificates in `/etc/kubernetes/pki`, which expire after one year by default unless renewed.',
 w:'Expired certificates are a classic cause of a dead control plane. Check expiry on a schedule.',
 c:`sudo kubeadm certs check-expiration
ls /etc/kubernetes/manifests`,see:[2,4,'Static pods and component manifests']}
]},

{h:'Workloads and scheduling'},
{acc:[
{t:'Pods',s:'The unit of scheduling.',
 a:'A **pod** is one or more containers that share a network namespace and volumes, and are scheduled together. Pods are disposable: they are replaced, not repaired. Use a controller (Deployment, StatefulSet, Job) rather than bare pods.',
 w:'State belongs outside the pod, and identity belongs to the controller.',
 c:`kubectl get pod mypod -o wide
kubectl get pod mypod -o jsonpath='{.status.phase}{"\\n"}'`,see:[4,0,'Pods and lifecycle']},
{t:'Deployments and rolling updates',s:'Replace pods gradually.',
 a:'A **Deployment** manages ReplicaSets. On a change it creates a new ReplicaSet and shifts pods gradually, governed by `maxSurge` and `maxUnavailable`. `kubectl rollout undo` returns to the previous ReplicaSet.',
 w:'It is the default way to run stateless apps with no downtime on updates.',
 c:`kubectl rollout status deploy/web
kubectl rollout history deploy/web
kubectl rollout undo deploy/web`,see:[4,2,'Deployments, rolling updates and rollbacks']},
{t:'StatefulSets and DaemonSets',s:'Identity and one-per-node.',
 a:'A **StatefulSet** gives pods stable names, ordered rollout and their own volumes. A **DaemonSet** runs one pod per node (agents, CNI). **Jobs** and **CronJobs** run to completion.',
 w:'Pick the controller from the workload\'s identity and lifecycle, not from habit.',
 c:`kubectl get sts,ds,jobs,cronjobs -A`,see:[4,3,'DaemonSets and StatefulSets']},
{t:'Probes',s:'How Kubernetes knows an app is healthy.',
 a:'**Liveness** restarts a stuck container, **readiness** removes a pod from Service endpoints while it cannot serve, and **startup** protects slow starters. A wrong liveness probe causes restart loops.',
 w:'Most unexplained restarts and 502s come from probe design.',
 c:`kubectl describe pod mypod | grep -A6 -i 'liveness\\|readiness'`,see:[4,7,'Probes: liveness, readiness and startup']},
{t:'Requests, limits and QoS',s:'Scheduling input and enforcement.',
 a:'**Requests** are used by the scheduler and set a guaranteed share. **Limits** are enforced: exceeding a memory limit gets the container OOMKilled, exceeding a CPU limit throttles it. QoS class (Guaranteed, Burstable, BestEffort) decides eviction order.',
 w:'Missing requests make scheduling and capacity planning meaningless.',
 c:`kubectl top pod -A --sort-by=memory | head
kubectl get pod mypod -o jsonpath='{.status.qosClass}{"\\n"}'`,see:[4,6,'Requests, limits and QoS classes']},
{t:'Taints, tolerations and affinity',s:'Steer pods and keep them away.',
 a:'A **taint** on a node repels pods that lack a matching **toleration**. **nodeSelector** and **affinity** attract pods to nodes or to each other. **Topology spread** keeps replicas apart.',
 w:'These are the tools for dedicated nodes, spreading across zones and keeping noisy neighbours apart.',
 c:`kubectl describe node worker1 | grep -i taint`,see:[5,2,'Taints and tolerations']},
{t:'Drain and cordon',s:'Maintenance without surprise.',
 a:'`cordon` stops new pods from landing on a node. `drain` also evicts the pods, respecting **PodDisruptionBudgets**. `uncordon` returns it to service.',
 w:'It is the first step of every node upgrade or repair.',
 c:`kubectl drain worker1 --ignore-daemonsets --delete-emptydir-data`,see:[5,4,'Cordon, drain and uncordon']},
{t:'Horizontal Pod Autoscaler',s:'Replica count follows load.',
 a:'The **HPA** changes the replica count of a workload from metrics such as CPU (from Metrics Server) or custom metrics, between a minimum and a maximum.',
 w:'It needs resource requests and a working Metrics Server to do anything.',
 c:`kubectl get hpa
kubectl top pods`,see:[5,5,'Metrics Server and the Horizontal Pod Autoscaler']}
]},

{h:'Networking, storage and configuration'},
{acc:[
{t:'Services',s:'A stable address for changing pods.',
 a:'A **Service** selects pods by label and gives them a stable virtual IP and DNS name. Types: **ClusterIP** (inside), **NodePort**, **LoadBalancer** (cloud), and **headless** (no VIP, direct pod records).',
 w:'A Service with no endpoints almost always has a selector or readiness problem.',
 c:`kubectl get svc,endpointslices -n dev
kubectl get endpoints web -n dev`,see:[6,1,'Services: ClusterIP, NodePort, LoadBalancer and headless']},
{t:'kube-proxy and EndpointSlices',s:'How a virtual IP reaches a pod.',
 a:'**EndpointSlices** list the ready pod addresses behind a Service. **kube-proxy** on each node programs iptables or IPVS rules that rewrite the Service address to one of them.',
 w:'It explains why traffic still goes to a pod during a rollout, and why readiness matters.',
 c:`kubectl get endpointslices -l kubernetes.io/service-name=web -o wide`,see:[6,2,'EndpointSlices and kube-proxy modes']},
{t:'DNS',s:'Names for Services and pods.',
 a:'**CoreDNS** answers `<service>.<namespace>.svc.cluster.local`. Pods get a search path so short names work in the same namespace.',
 w:'A broken CoreDNS looks like random application failures.',
 c:`kubectl run -it --rm dns --image=busybox:1.36 --restart=Never -- nslookup kubernetes.default`,see:[6,3,'CoreDNS and service discovery']},
{t:'Ingress and Gateway API',s:'HTTP routing into the cluster.',
 a:'An **Ingress** (with an ingress controller) or the **Gateway API** (GatewayClass, Gateway, HTTPRoute) routes external HTTP and HTTPS to Services by host and path, and terminates TLS.',
 w:'A Service of type LoadBalancer per app is expensive. One gateway serves many.',
 c:`kubectl get ingress,gateway,httproute -A`,see:[6,4,'Ingress and ingress controllers']},
{t:'NetworkPolicy',s:'A firewall for pods.',
 a:'By default all pods can talk to all pods. A **NetworkPolicy** selects pods and limits ingress and egress. It only works if the CNI plugin enforces policy.',
 w:'Default-deny plus explicit allows is the usual starting point.',
 c:`kubectl get networkpolicy -A
kubectl describe networkpolicy default-deny -n dev`,see:[6,6,'NetworkPolicy']},
{t:'PersistentVolumes and claims',s:'Storage as a request.',
 a:'A pod asks for storage with a **PersistentVolumeClaim**. A **StorageClass** and a CSI driver provision a **PersistentVolume** dynamically. The **reclaim policy** decides what happens to data when the claim is deleted.',
 w:'Know the reclaim policy before you delete a claim.',
 c:`kubectl get pvc,pv,storageclass`,see:[7,1,'PersistentVolumes and PersistentVolumeClaims']},
{t:'ConfigMaps and Secrets',s:'Configuration outside the image.',
 a:'**ConfigMaps** and **Secrets** inject settings as environment variables or files. Secrets are base64-encoded, not encrypted, unless encryption at rest is enabled and access is restricted by RBAC.',
 w:'Treat Secret objects as sensitive data and restrict who can read them.',
 c:`kubectl get secret db-pass -o jsonpath='{.data}' | head -c 80`,see:[4,5,'ConfigMaps and Secrets']}
]},

{h:'Security and lifecycle'},
{acc:[
{t:'RBAC',s:'Who may do what.',
 a:'A **Role** or **ClusterRole** lists verbs on resources. A **RoleBinding** or **ClusterRoleBinding** grants it to users, groups or service accounts. Use `kubectl auth can-i` to test.',
 w:'Grant the narrowest role at the narrowest scope.',
 c:`kubectl auth can-i list secrets --as=system:serviceaccount:dev:app -n dev`,see:[8,4,'RBAC: Roles, ClusterRoles and bindings']},
{t:'Service accounts',s:'Identity for pods.',
 a:'A pod runs as a **ServiceAccount**, which receives a short-lived projected token. RBAC decides what that identity may call on the API.',
 w:'Do not use the default service account for workloads that call the API.',
 c:`kubectl get sa -n dev
kubectl create token app -n dev`,see:[8,3,'Service accounts and token projection']},
{t:'Pod Security Standards',s:'Baseline rules for pods.',
 a:'**Pod Security Admission** enforces the *privileged*, *baseline* and *restricted* standards per namespace, using labels. Security contexts set user, capabilities and filesystem options per pod.',
 w:'Label namespaces with the level you want enforced.',
 c:`kubectl label ns dev pod-security.kubernetes.io/enforce=restricted`,see:[9,0,'Pod Security Standards and Pod Security Admission']},
{t:'Admission control',s:'Policy before persistence.',
 a:'Admission controllers and **ValidatingAdmissionPolicy** (and webhooks) can change or reject requests after authorisation, for example to require labels or block privileged pods.',
 w:'It is where cluster-wide policy is enforced.',
 c:`kubectl get validatingadmissionpolicy,validatingwebhookconfigurations`,see:[9,3,'Admission control and ValidatingAdmissionPolicy']},
{t:'Upgrades with kubeadm',s:'Control plane first, then nodes.',
 a:'Upgrade one minor version at a time. Run `kubeadm upgrade plan`, apply on the first control plane node, `kubeadm upgrade node` on the others, then drain and upgrade each worker kubelet. Respect the **version skew** policy.',
 w:'Take an etcd snapshot and check deprecated APIs before you start.',
 c:`sudo kubeadm upgrade plan
kubectl get nodes`,see:[10,2,'Upgrading the control plane with kubeadm']},
{t:'etcd backup and restore',s:'The cluster backup.',
 a:'`etcdctl snapshot save` writes a point-in-time snapshot. A restore creates a new data directory that the etcd static pod is pointed to. Workload data in volumes is separate.',
 w:'Practise the restore. An untested snapshot is not a backup.',
 c:`sudo ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-$(date +%F).db --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key`,see:[10,4,'etcd backup and restore']},
{t:'Helm and Kustomize',s:'Packaging and overlays.',
 a:'**Helm** packages manifests as charts with values and tracks **releases** that can be rolled back. **Kustomize** patches plain manifests with bases and overlays. Both generate ordinary Kubernetes objects.',
 w:'Use them to keep environment differences in values or overlays, not in copies of YAML.',
 c:`helm list -A
kubectl kustomize overlays/prod | head`,see:[11,0,'Helm basics: charts, repositories and releases']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Four small maps of how the parts fit together: the control plane and request flow, the path of a Service request, storage and the security layers.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. Control plane and the request flow'},
{map:{title:'Control plane map',h:328,trace:'Apply a Deployment',
 hint:'Tap any box, or press Apply a Deployment to follow a kubectl request through the cluster until a container runs.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'cli',x:21,y:24,w:194,h:56,c:'ext',t:'kubectl',s:'client and kubeconfig',d:'A client that reads `~/.kube/config` for the server, user and context, and sends REST calls.',why:'The wrong context applies the change to the wrong cluster.',chk:`kubectl config current-context`,see:[1,1,'kubeconfig, contexts and namespaces']},
 {id:'api',x:243,y:24,w:194,h:56,c:'proc',t:'kube-apiserver',s:'authn, authz, admission',d:'Authenticates the caller, authorises with RBAC, runs admission and stores the object. It is the only component that writes to etcd.',why:'A 403 is authorisation, a 401 authentication, a webhook error is admission.',chk:`kubectl get --raw /readyz?verbose`,see:[2,0,'kube-apiserver and the request flow']},
 {id:'etcd',x:465,y:24,w:194,h:56,c:'disk',t:'etcd',s:'the stored state',d:'Persists every object. A quorum is needed for writes.',why:'Back it up and keep it on fast disks.',chk:`etcdctl endpoint status -w table`,see:[2,1,'etcd as the cluster database']},
 {id:'ctl',x:21,y:136,w:194,h:56,c:'proc',t:'Controller manager',s:'Deployment, ReplicaSet',d:'The Deployment controller creates a ReplicaSet, which creates Pod objects to match the replica count.',why:'Stuck rollouts are visible in the Deployment conditions.',chk:`kubectl describe deploy web | sed -n '/Conditions/,/Events/p'`,see:[2,2,'Scheduler and controller manager']},
 {id:'sch',x:243,y:136,w:194,h:56,c:'proc',t:'Scheduler',s:'filter, score, bind',d:'Picks a node for each unscheduled pod by filtering and scoring, and binds the pod to it.',why:'Pending pods carry the reason in their events.',chk:`kubectl get events --field-selector reason=FailedScheduling`,see:[5,0,'How the scheduler works']},
 {id:'kub',x:465,y:136,w:194,h:56,c:'proc',t:'kubelet',s:'on the node',d:'Watches pods bound to its node, starts containers through the runtime and reports status.',why:'It also runs the probes.',chk:`journalctl -u kubelet -n 50 --no-pager`,see:[2,3,'Node components and add-ons']},
 {id:'rt',x:126,y:248,w:200,h:56,c:'proc',t:'Container runtime',s:'containerd',d:'Pulls the image and starts the container with namespaces and cgroups.',why:'Image pull errors show here first.',chk:`sudo crictl ps`,see:[2,3,'Node components and add-ons']},
 {id:'pod',x:354,y:248,w:200,h:56,c:'mem',t:'Running pod',s:'ready for traffic',d:'When readiness passes, the pod joins Service endpoints.',why:'A failing readiness probe keeps it out.',chk:`kubectl get pod -l app=web -o wide`,see:[4,0,'Pods and lifecycle']}],
 steps:[
 {ids:['cli','api'],t:'1. `kubectl apply` sends the Deployment to the API server. The API server authenticates and authorises the user.',w:'No component skips the API server.',s:'kubeconfig, RBAC.',x:'Wrong context or missing permission.',c:`kubectl auth can-i create deployments -n dev`},
 {ids:['api','etcd'],t:'2. Admission runs and the object is written to etcd.',w:'The change now exists as desired state.',s:'Admission webhooks, policies.',x:'A webhook that is down blocks all writes.',c:`kubectl get deploy web -o yaml | head -20`},
 {ids:['ctl'],t:'3. The Deployment controller notices the new object and creates a ReplicaSet, and then Pod objects.',w:'Controllers react to watches, not to commands.',s:'Replica count, strategy.',x:'Quota exceeded blocks pod creation.',c:`kubectl get rs,pods -l app=web`},
 {ids:['sch'],t:'4. The scheduler filters nodes and scores the rest, then binds each pod to a node.',w:'Resource requests drive this decision.',s:'Requests, taints, affinity.',x:'No node fits: Pending with FailedScheduling.',c:`kubectl describe pod <pod> | tail -10`},
 {ids:['kub','rt'],t:'5. The kubelet on that node sees the bound pod and asks the runtime to pull the image and start the containers.',w:'The node does the work.',s:'Image, pull secret, runtime.',x:'ImagePullBackOff.',c:`kubectl describe pod <pod>`},
 {ids:['pod'],t:'6. Probes pass and the pod is ready. It receives traffic through the Service.',w:'Readiness gates traffic.',s:'Probe settings.',x:'CrashLoopBackOff or failing readiness.',c:`kubectl get pods -l app=web`}]}},

{h:'2. Service and traffic path'},
{map:{title:'Service traffic map',h:328,trace:'Follow a request to a pod',
 hint:'Tap any box, or press Follow a request to a pod to see how a client request reaches a container in the cluster.',
 lines:['M118 80 L118 163 L226 163 L226 246','M226 248 L226 165 L340 165 L340 82',[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M454 248 L454 221 L562 221 L562 194'],
 nodes:[
 {id:'cl',x:21,y:24,w:194,h:56,c:'ext',t:'Client',s:'outside or inside',d:'A browser, another service or a pod. Inside the cluster it resolves names with CoreDNS.',why:'Check where the client is before testing.',chk:`kubectl run -it --rm t --image=busybox:1.36 --restart=Never -- wget -qO- http://web.dev`,see:[6,3,'CoreDNS and service discovery']},
 {id:'ing',x:243,y:24,w:194,h:56,c:'net',t:'Ingress or Gateway',s:'HTTP routing',d:'An ingress controller or gateway routes by host and path to a Service and terminates TLS.',why:'A missing class or wrong host gives 404.',chk:`kubectl describe ingress web -n dev`,see:[6,4,'Ingress and ingress controllers']},
 {id:'svc',x:465,y:24,w:194,h:56,c:'proc',t:'Service',s:'ClusterIP',d:'A virtual IP and name that selects pods by label.',why:'No endpoints means selector or readiness problems.',chk:`kubectl get svc web -n dev -o wide`,see:[6,1,'Services']},
 {id:'ep',x:21,y:136,w:194,h:56,c:'mem',t:'EndpointSlices',s:'ready pod IPs',d:'The list of ready pod addresses for the Service.',why:'Only ready pods appear.',chk:`kubectl get endpointslices -n dev -l kubernetes.io/service-name=web`,see:[6,2,'EndpointSlices and kube-proxy modes']},
 {id:'kp',x:243,y:136,w:194,h:56,c:'proc',t:'kube-proxy',s:'iptables or IPVS',d:'Rewrites the Service address to a pod address on each node.',why:'Stale rules or a crashed kube-proxy break Services on that node.',chk:`kubectl -n kube-system get ds kube-proxy`,see:[6,2,'EndpointSlices and kube-proxy modes']},
 {id:'pod',x:465,y:136,w:194,h:56,c:'mem',t:'Pod',s:'container port',d:'The container that listens on the target port.',why:'The container must listen on the declared port.',chk:`kubectl exec <pod> -- ss -ltn`,see:[4,0,'Pods and lifecycle']},
 {id:'dns',x:126,y:248,w:200,h:56,c:'net',t:'CoreDNS',s:'name resolution',d:'Resolves `<service>.<namespace>.svc.cluster.local` to the ClusterIP.',why:'Failures look like random timeouts.',chk:`kubectl -n kube-system get pods -l k8s-app=kube-dns`,see:[6,3,'CoreDNS and service discovery']},
 {id:'np',x:354,y:248,w:200,h:56,c:'warn',t:'NetworkPolicy',s:'allow or deny',d:'Policy can block traffic between pods even when everything else is right.',why:'Check policies when a connection is refused or times out.',chk:`kubectl get networkpolicy -n dev`,see:[6,6,'NetworkPolicy']}],
 steps:[
 {ids:['cl','dns'],t:'1. The client resolves the Service name through CoreDNS to the ClusterIP.',w:'Names, not addresses, are the interface.',s:'Namespace, search path.',x:'Wrong namespace in the name.',c:`nslookup web.dev.svc.cluster.local`},
 {ids:['ing','svc'],t:'2. From outside, the ingress or gateway matches host and path and forwards to the Service.',w:'One entry point serves many apps.',s:'Ingress rules, TLS.',x:'404 for a wrong host or path.',c:`curl -H 'Host: app.example.com' http://<ingress-ip>/`},
 {ids:['ep'],t:'3. The Service has a list of ready endpoints. A pod that fails readiness is not on the list.',w:'It protects users from unready pods.',s:'Readiness probe.',x:'Zero endpoints and 503.',c:`kubectl get endpointslices -n dev`},
 {ids:['kp'],t:'4. kube-proxy on the node rewrites the destination to one pod IP.',w:'Load balancing is per connection.',s:'Proxy mode.',x:'Rules not programmed.',c:`sudo iptables -t nat -L KUBE-SERVICES | head`},
 {ids:['np','pod'],t:'5. If NetworkPolicy allows, the connection reaches the pod and its container answers.',w:'Policy is the last gate.',s:'Policy selectors.',x:'A default-deny without an allow.',c:`kubectl exec <client-pod> -- wget -qO- --timeout=3 http://<pod-ip>:8080`}]}},

{h:'3. Storage path'},
{map:{title:'Storage map',h:216,trace:'Provision a volume for a pod',
 hint:'Tap any box, or press Provision a volume for a pod to follow a claim to a mounted volume.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'pod',x:21,y:24,w:194,h:56,c:'ext',t:'Pod',s:'volumeMounts',d:'A pod references a claim by name and mounts it at a path.',why:'Pods using a claim wait for it to bind.',chk:`kubectl describe pod db-0 | grep -A5 Volumes`,see:[7,0,'Volumes and volume types']},
 {id:'pvc',x:243,y:24,w:194,h:56,c:'proc',t:'PersistentVolumeClaim',s:'the request',d:'A namespaced request for size, access mode and class.',why:'A Pending claim means no volume could be provisioned.',chk:`kubectl get pvc -n dev`,see:[7,1,'PersistentVolumes and PersistentVolumeClaims']},
 {id:'sc',x:465,y:24,w:194,h:56,c:'proc',t:'StorageClass',s:'how to provision',d:'Names a provisioner and parameters, and the reclaim policy and binding mode.',why:'A default class decides what claims without a class get.',chk:`kubectl get storageclass`,see:[7,3,'StorageClasses and dynamic provisioning']},
 {id:'csi',x:21,y:136,w:194,h:56,c:'proc',t:'CSI driver',s:'talks to the storage',d:'A plugin that creates, attaches and mounts volumes on the storage system.',why:'Driver pods must be healthy on every node.',chk:`kubectl get pods -n kube-system | grep csi`,see:[7,4,'CSI overview']},
 {id:'pv',x:243,y:136,w:194,h:56,c:'disk',t:'PersistentVolume',s:'the volume object',d:'Represents the provisioned volume with capacity and reclaim policy, bound to one claim.',why:'Reclaim policy decides if data survives claim deletion.',chk:`kubectl get pv`,see:[7,2,'Access modes and reclaim policies']},
 {id:'vol',x:465,y:136,w:194,h:56,c:'disk',t:'Backing volume',s:'disk or share',d:'The actual cloud disk, NFS share or similar.',why:'Zone and attach limits matter.',chk:`kubectl get volumeattachment`,see:[7,1,'PersistentVolumes and PersistentVolumeClaims']}],
 steps:[
 {ids:['pod','pvc'],t:'1. The pod names a claim. The claim states how much storage and which class.',w:'The app asks, it does not choose a disk.',s:'Size, access mode, class.',x:'Wrong class name.',c:`kubectl get pvc data -n dev -o yaml | head -20`},
 {ids:['sc','csi'],t:'2. The StorageClass tells the CSI provisioner to create a volume.',w:'Dynamic provisioning removes manual steps.',s:'Provisioner, parameters.',x:'Provisioner not installed.',c:`kubectl describe storageclass fast`},
 {ids:['pv','vol'],t:'3. A PersistentVolume is created, bound to the claim, and the backing volume exists.',w:'The claim is Bound.',s:'Binding mode.',x:'WaitForFirstConsumer delays binding until a pod is scheduled.',c:`kubectl get pv,pvc -n dev`},
 {ids:['pod'],t:'4. The volume is attached to the node and mounted into the pod.',w:'The pod starts.',s:'Zone placement.',x:'A volume in another zone cannot attach.',c:`kubectl describe pod db-0 | tail -15`}]}},

{h:'4. Security layers'},
{map:{title:'Cluster security map',h:328,trace:'Follow a request through the layers',
 hint:'Tap any box, or press Follow a request through the layers to see the controls between a user and a running workload.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'id',x:21,y:24,w:194,h:56,c:'ext',t:'Authentication',s:'who are you',d:'Certificates, tokens or OIDC identify the caller. Service accounts identify pods.',why:'Without identity, nothing else applies.',chk:`kubectl auth whoami`,see:[8,1,'Authentication methods']},
 {id:'authz',x:243,y:24,w:194,h:56,c:'proc',t:'RBAC authorisation',s:'what may you do',d:'Roles and bindings grant verbs on resources in a namespace or cluster-wide.',why:'Least privilege and no wildcard roles.',chk:`kubectl auth can-i --list -n dev`,see:[8,4,'RBAC']},
 {id:'adm',x:465,y:24,w:194,h:56,c:'proc',t:'Admission',s:'policy before storage',d:'Mutating and validating admission and policies can change or reject the request.',why:'A broken webhook blocks writes.',chk:`kubectl get validatingadmissionpolicy`,see:[9,3,'Admission control and ValidatingAdmissionPolicy']},
 {id:'psa',x:21,y:136,w:194,h:56,c:'proc',t:'Pod Security Admission',s:'baseline, restricted',d:'Namespace labels enforce standards on pod specs.',why:'Set `enforce` for production namespaces.',chk:`kubectl get ns --show-labels | grep pod-security`,see:[9,0,'Pod Security Standards and Pod Security Admission']},
 {id:'sc',x:243,y:136,w:194,h:56,c:'proc',t:'Security context',s:'user, caps, fs',d:'Run as non-root, drop capabilities, read-only root filesystem, seccomp profile.',why:'The default is more permissive than you want.',chk:`kubectl get pod <pod> -o jsonpath='{.spec.securityContext}'`,see:[9,1,'Security contexts']},
 {id:'net',x:465,y:136,w:194,h:56,c:'net',t:'NetworkPolicy',s:'pod firewall',d:'Limits which pods may talk to which.',why:'Needs a CNI that enforces policies.',chk:`kubectl get networkpolicy -A`,see:[6,6,'NetworkPolicy']},
 {id:'sec',x:126,y:248,w:200,h:56,c:'disk',t:'Secrets',s:'at rest and in use',d:'Encryption at rest for etcd, restricted read access, external secret stores for sensitive values.',why:'Base64 is not encryption.',chk:`kubectl get secrets -A | wc -l`,see:[9,2,'Secrets handling and encryption at rest']},
 {id:'aud',x:354,y:248,w:200,h:56,c:'mem',t:'Audit logging',s:'evidence',d:'The API server can record who did what and when.',why:'Enable it before an incident.',chk:`grep audit /etc/kubernetes/manifests/kube-apiserver.yaml`,see:[9,5,'Audit logging and the CIS benchmark']}],
 steps:[
 {ids:['id','authz'],t:'1. The caller is identified, then RBAC decides whether the verb on the resource is allowed.',w:'Two separate questions.',s:'Roles, bindings.',x:'Cluster-admin for everyone.',c:`kubectl auth can-i delete pods -n dev --as=jane`},
 {ids:['adm','psa'],t:'2. Admission and Pod Security Admission validate the object against policy.',w:'Policy that RBAC cannot express.',s:'Namespace labels, policies.',x:'Policies only in warn mode.',c:`kubectl label ns dev pod-security.kubernetes.io/enforce=baseline --dry-run=server`},
 {ids:['sc','net'],t:'3. The pod runs with its security context, and NetworkPolicy limits its connections.',w:'Defence at runtime.',s:'Context, policy.',x:'Privileged containers.',c:`kubectl get pod <pod> -o yaml | grep -A8 securityContext`},
 {ids:['sec','aud'],t:'4. Secrets are protected at rest, and audit logs record the activity.',w:'Evidence and confidentiality.',s:'Encryption config, audit policy.',x:'Audit logs never reviewed.',c:`sudo ls /var/log/kubernetes/`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Five small maps of how something happens, step by step: a failing pod, a rolling update, a node drain, a cluster upgrade and an etcd backup and restore.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Triaging a failing pod'},
{map:{title:'Pod triage map',h:328,trace:'Find why a pod is not running',
 hint:'Tap any box, or press Find why a pod is not running to follow the checks by pod status.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L340 219 L340 246'],
 nodes:[
 {id:'st',x:21,y:24,w:194,h:56,c:'mem',t:'Read the status',s:'get and describe',d:'`kubectl get pod` shows the phase and reason, and `describe` shows the events.',why:'Always read events before logs.',chk:`kubectl describe pod <pod> | sed -n '/Events/,$p'`,see:[12,1,'Logs, describe, events and exec']},
 {id:'pen',x:243,y:24,w:194,h:56,c:'warn',t:'Pending',s:'not scheduled',d:'No node fits: requests too large, taints, affinity, or an unbound claim.',why:'The reason is in the FailedScheduling event.',chk:`kubectl get events --field-selector reason=FailedScheduling`,see:[12,3,'Pod failures']},
 {id:'img',x:465,y:24,w:194,h:56,c:'warn',t:'ImagePullBackOff',s:'cannot pull',d:'Wrong name or tag, missing pull secret, registry unreachable.',why:'Check the image reference and secret.',chk:`kubectl get pod <pod> -o jsonpath='{.spec.containers[*].image}'`,see:[12,3,'Pod failures']},
 {id:'crash',x:21,y:136,w:194,h:56,c:'warn',t:'CrashLoopBackOff',s:'container keeps exiting',d:'The process exits repeatedly: bad config, missing dependency, or a failing probe.',why:'Read the previous container logs.',chk:`kubectl logs <pod> --previous`,see:[12,3,'Pod failures']},
 {id:'oom',x:243,y:136,w:194,h:56,c:'warn',t:'OOMKilled',s:'memory limit',d:'The container exceeded its memory limit (exit code 137).',why:'Raise the limit or fix the leak.',chk:`kubectl get pod <pod> -o jsonpath='{.status.containerStatuses[0].lastState}'`,see:[4,6,'Requests, limits and QoS classes']},
 {id:'evt',x:465,y:136,w:194,h:56,c:'mem',t:'Events and node',s:'node conditions',d:'Node pressure, evictions or a NotReady node can explain several pods at once.',why:'Check the node, not just the pod.',chk:`kubectl describe node <node> | grep -A8 Conditions`,see:[12,4,'Node failures']},
 {id:'fix',x:240,y:248,w:200,h:56,c:'proc',t:'Fix and verify',s:'one change',d:'Change one thing and watch the rollout.',why:'Record the cause.',chk:`kubectl rollout status deploy/web`,see:[12,0,'A top-down troubleshooting method']}],
 steps:[
 {ids:['st'],t:'1. Look at the status and the events. The event usually names the cause.',w:'It narrows the search at once.',s:'kubectl output.',x:'Reading logs first for a pod that never started.',c:`kubectl get pod <pod> -o wide`},
 {ids:['pen','img'],t:'2. For Pending, find the scheduling reason. For image errors, check the reference and the pull secret.',w:'Two different families of cause.',s:'Requests, taints, secrets.',x:'Treating all as a node problem.',c:`kubectl describe pod <pod> | grep -i -A3 'events'`},
 {ids:['crash','oom'],t:'3. For a restart loop, read the previous logs and the last state and exit code.',w:'Exit codes tell the story.',s:'Probes, limits, config.',x:'Only reading the current log of a fresh container.',c:`kubectl logs <pod> --previous --tail=50`},
 {ids:['evt'],t:'4. If several pods fail together, check node conditions and pressure.',w:'A node problem looks like many pod problems.',s:'Node resources.',x:'Fixing each pod separately.',c:`kubectl get nodes`},
 {ids:['fix'],t:'5. Fix one cause at a time, verify, and record it.',w:'Repeatable knowledge.',s:'Change record.',x:'Changing five things at once.',c:`kubectl get pods -w`}]}},

{h:'2. Rolling update and rollback'},
{map:{title:'Rollout map',h:216,trace:'Update a Deployment safely',
 hint:'Tap any box, or press Update a Deployment safely to follow a rolling update and a rollback.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'chg',x:21,y:24,w:194,h:56,c:'ext',t:'Change the spec',s:'image or config',d:'Edit the pod template, for example a new image tag. Only template changes trigger a rollout.',why:'Scaling does not create a new ReplicaSet.',chk:`kubectl set image deploy/web web=app:2.0`,see:[4,2,'Deployments, rolling updates and rollbacks']},
 {id:'rs',x:243,y:24,w:194,h:56,c:'proc',t:'New ReplicaSet',s:'scaled up gradually',d:'The Deployment creates a ReplicaSet for the new template.',why:'Each ReplicaSet is a revision.',chk:`kubectl get rs -l app=web`,see:[4,2,'Deployments, rolling updates and rollbacks']},
 {id:'surge',x:465,y:24,w:194,h:56,c:'mem',t:'Surge and unavailable',s:'maxSurge, maxUnavailable',d:'Control how many extra and how many unavailable pods are allowed during the update.',why:'Zero unavailable needs spare capacity.',chk:`kubectl get deploy web -o jsonpath='{.spec.strategy}'`,see:[4,2,'Deployments, rolling updates and rollbacks']},
 {id:'ready',x:21,y:136,w:194,h:56,c:'mem',t:'Readiness gates',s:'probe passes',d:'A new pod receives traffic only when its readiness probe passes. The rollout waits for it.',why:'A bad probe stalls the rollout.',chk:`kubectl rollout status deploy/web`,see:[4,7,'Probes']},
 {id:'old',x:243,y:136,w:194,h:56,c:'disk',t:'Old ReplicaSet',s:'kept for history',d:'Old ReplicaSets stay scaled to zero, up to the revision history limit.',why:'They allow rollback.',chk:`kubectl rollout history deploy/web`,see:[4,2,'Deployments, rolling updates and rollbacks']},
 {id:'undo',x:465,y:136,w:194,h:56,c:'warn',t:'Rollback',s:'undo',d:'Return to the previous revision, which scales the old ReplicaSet up again.',why:'Rollback is another rollout.',chk:`kubectl rollout undo deploy/web`,see:[4,8,'Practical: Deploy, update and roll back an app']}],
 steps:[
 {ids:['chg','rs'],t:'1. A template change creates a new ReplicaSet and the rollout starts.',w:'The change is declarative.',s:'Template.',x:'Applying the wrong tag.',c:`kubectl rollout status deploy/web`},
 {ids:['surge','ready'],t:'2. New pods are created within the surge limit, and old pods are removed as new pods become ready.',w:'Capacity stays up.',s:'maxSurge, maxUnavailable, probes.',x:'Readiness never passes.',c:`kubectl get pods -l app=web -w`},
 {ids:['old'],t:'3. When all pods are on the new template, the old ReplicaSet stays at zero.',w:'History is kept.',s:'revisionHistoryLimit.',x:'History set to zero removes rollback.',c:`kubectl rollout history deploy/web`},
 {ids:['undo'],t:'4. If the update is bad, undo returns to the previous revision.',w:'A quick return.',s:'Revision number.',x:'A config change outside the template is not undone.',c:`kubectl rollout undo deploy/web --to-revision=2`}]}},

{h:'3. Draining a node for maintenance'},
{map:{title:'Node maintenance map',h:216,trace:'Drain, repair and return a node',
 hint:'Tap any box, or press Drain, repair and return a node to follow a safe node maintenance.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'pdb',x:21,y:24,w:194,h:56,c:'mem',t:'Check disruption budgets',s:'PDB',d:'A PodDisruptionBudget limits how many pods of an app may be unavailable during voluntary disruption.',why:'A too-strict PDB blocks the drain.',chk:`kubectl get pdb -A`,see:[5,4,'Cordon, drain and uncordon']},
 {id:'cord',x:243,y:24,w:194,h:56,c:'proc',t:'Cordon',s:'stop new pods',d:'Mark the node unschedulable.',why:'Existing pods keep running.',chk:`kubectl cordon worker1`,see:[5,4,'Cordon, drain and uncordon']},
 {id:'drain',x:465,y:24,w:194,h:56,c:'warn',t:'Drain',s:'evict pods',d:'Evict pods, respecting PDBs and grace periods. DaemonSet pods remain.',why:'Pods with local storage need a flag.',chk:`kubectl drain worker1 --ignore-daemonsets --delete-emptydir-data`,see:[5,4,'Cordon, drain and uncordon']},
 {id:'work',x:21,y:136,w:194,h:56,c:'ext',t:'Do the work',s:'patch or repair',d:'Patch the OS, change hardware or upgrade the kubelet.',why:'The node is out of service.',chk:`sudo apt-get upgrade -y`,see:[10,3,'Upgrading worker nodes']},
 {id:'unc',x:243,y:136,w:194,h:56,c:'proc',t:'Uncordon',s:'return to service',d:'Allow scheduling again.',why:'Pods do not move back by themselves.',chk:`kubectl uncordon worker1`,see:[5,4,'Cordon, drain and uncordon']},
 {id:'chk',x:465,y:136,w:194,h:56,c:'mem',t:'Verify',s:'Ready and balanced',d:'Check the node is Ready and that workloads are spread again.',why:'Rebalance if needed.',chk:`kubectl get nodes
kubectl get pods -A -o wide | grep worker1`,see:[5,7,'Practical: Schedule, drain and scale']}],
 steps:[
 {ids:['pdb','cord'],t:'1. Check disruption budgets, then cordon the node.',w:'Prevents new work from arriving.',s:'PDB values.',x:'A budget that cannot be met.',c:`kubectl get pdb -A`},
 {ids:['drain'],t:'2. Drain the node. Pods are evicted gracefully and rescheduled elsewhere.',w:'The workload moves, the service stays.',s:'Grace period, flags.',x:'Stuck on a pod with a strict PDB.',c:`kubectl drain worker1 --ignore-daemonsets --delete-emptydir-data`},
 {ids:['work'],t:'3. Do the maintenance work on the empty node.',w:'Safe to reboot.',s:'Change record.',x:'Forgetting a taint.',c:`uname -r`},
 {ids:['unc','chk'],t:'4. Uncordon and verify the node is Ready and carries workloads again.',w:'The cycle is complete.',s:'Scheduler spread.',x:'All pods on one node.',c:`kubectl get nodes`}]}},

{h:'4. Upgrading a cluster with kubeadm'},
{map:{title:'Cluster upgrade map',h:216,trace:'Upgrade control plane and nodes',
 hint:'Tap any box, or press Upgrade control plane and nodes to follow a minor version upgrade with a backup.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'chk',x:21,y:24,w:194,h:56,c:'mem',t:'Pre-checks',s:'skew and APIs',d:'Check version skew, deprecated API usage and add-on compatibility.',why:'Skipped minor versions are not allowed.',chk:`kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis`,see:[10,1,'Pre-upgrade checks']},
 {id:'bak',x:243,y:24,w:194,h:56,c:'disk',t:'etcd snapshot',s:'the safety net',d:'Take an etcd snapshot before changing anything.',why:'Verify the file.',chk:`sudo ETCDCTL_API=3 etcdctl snapshot save /backup/pre-upgrade.db ...`,see:[10,4,'etcd backup and restore']},
 {id:'plan',x:465,y:24,w:194,h:56,c:'mem',t:'kubeadm upgrade plan',s:'available versions',d:'Shows which versions you can upgrade to and what will change.',why:'Read the output.',chk:`sudo kubeadm upgrade plan`,see:[10,2,'Upgrading the control plane with kubeadm']},
 {id:'cp',x:21,y:136,w:194,h:56,c:'proc',t:'Control plane',s:'apply, then node',d:'Upgrade kubeadm, run `kubeadm upgrade apply` on the first control plane node, `upgrade node` on others, then the kubelet.',why:'One node at a time.',chk:`sudo kubeadm upgrade apply v1.31.2`,see:[10,2,'Upgrading the control plane with kubeadm']},
 {id:'wk',x:243,y:136,w:194,h:56,c:'proc',t:'Workers',s:'drain, upgrade, uncordon',d:'For each worker: drain, upgrade kubeadm and kubelet, restart, uncordon.',why:'Respect PDBs.',chk:`sudo kubeadm upgrade node`,see:[10,3,'Upgrading worker nodes']},
 {id:'ver',x:465,y:136,w:194,h:56,c:'mem',t:'Verify',s:'versions and health',d:'Check node versions, workload health and add-ons.',why:'Record the new baseline.',chk:`kubectl get nodes`,see:[10,6,'Practical: Full upgrade with an etcd snapshot']}],
 steps:[
 {ids:['chk','bak'],t:'1. Run the checks and take an etcd snapshot.',w:'A restore point.',s:'Skew policy.',x:'No snapshot.',c:`kubectl version`},
 {ids:['plan','cp'],t:'2. Plan, then upgrade the control plane node by node.',w:'API stays available with several control planes.',s:'Version.',x:'Upgrading all control planes at once.',c:`sudo kubeadm upgrade plan`},
 {ids:['wk'],t:'3. Drain and upgrade each worker, then uncordon.',w:'Workloads move around the work.',s:'PDB.',x:'A node left cordoned.',c:`kubectl uncordon worker1`},
 {ids:['ver'],t:'4. Verify the cluster and applications, and record the result.',w:'Close the change.',s:'Smoke tests.',x:'No verification.',c:`kubectl get nodes -o wide`}]}},

{h:'5. Backing up and restoring etcd'},
{map:{title:'etcd backup map',h:216,trace:'Snapshot and restore etcd',
 hint:'Tap any box, or press Snapshot and restore etcd to follow a backup and a restore on a kubeadm cluster.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'snap',x:21,y:24,w:194,h:56,c:'proc',t:'Snapshot',s:'etcdctl snapshot save',d:'Writes a point-in-time snapshot using the etcd client certificates.',why:'Run on a control plane node.',chk:`sudo ETCDCTL_API=3 etcdctl snapshot save /backup/etcd.db --endpoints=https://127.0.0.1:2379 --cacert=... --cert=... --key=...`,see:[10,4,'etcd backup and restore']},
 {id:'chk',x:243,y:24,w:194,h:56,c:'mem',t:'Verify the file',s:'snapshot status',d:'Check that the snapshot is readable and has a hash and revision.',why:'A bad snapshot is found now, not later.',chk:`sudo ETCDCTL_API=3 etcdctl snapshot status /backup/etcd.db -w table`,see:[10,4,'etcd backup and restore']},
 {id:'store',x:465,y:24,w:194,h:56,c:'disk',t:'Store off the node',s:'remote copy',d:'Copy the snapshot, with the PKI files, to storage off the cluster.',why:'A backup on the same node is lost with it.',chk:`scp /backup/etcd.db backup:/vault/`,see:[10,4,'etcd backup and restore']},
 {id:'stop',x:21,y:136,w:194,h:56,c:'warn',t:'Stop the control plane',s:'move manifests',d:'For a restore, stop the static pods by moving the manifests out of the manifests directory.',why:'The API is down.',chk:`sudo mv /etc/kubernetes/manifests/*.yaml /tmp/manifests/`,see:[12,5,'Control plane failures']},
 {id:'rest',x:243,y:136,w:194,h:56,c:'proc',t:'Restore',s:'new data dir',d:'Restore the snapshot into a new data directory.',why:'Use the same cluster token settings.',chk:`sudo ETCDCTL_API=3 etcdctl snapshot restore /backup/etcd.db --data-dir /var/lib/etcd-restore`,see:[10,4,'etcd backup and restore']},
 {id:'start',x:465,y:136,w:194,h:56,c:'proc',t:'Point etcd at it',s:'edit manifest, start',d:'Update the etcd manifest to the new data directory and return the manifests.',why:'Wait for the API server.',chk:`sudo sed -i 's#/var/lib/etcd#/var/lib/etcd-restore#' /etc/kubernetes/manifests/etcd.yaml`,see:[10,4,'etcd backup and restore']}],
 steps:[
 {ids:['snap','chk'],t:'1. Take the snapshot and verify it.',w:'A verified file is a backup.',s:'Certificates and endpoint.',x:'Missing client certificate arguments.',c:`etcdctl snapshot status /backup/etcd.db`},
 {ids:['store'],t:'2. Copy it off the node, with a retention schedule.',w:'Survives node loss.',s:'Backup job.',x:'Only local copies.',c:`ls -l /vault/`},
 {ids:['stop','rest'],t:'3. To restore: stop the control plane and restore into a new data directory.',w:'The old directory stays for fallback.',s:'Procedure.',x:'Overwriting the original data directory.',c:`sudo ls /var/lib/etcd-restore`},
 {ids:['start'],t:'4. Point etcd at the restored directory and start the control plane, then verify workloads.',w:'State returns to the snapshot time.',s:'Manifest edit.',x:'Objects created after the snapshot are gone.',c:`kubectl get nodes`}]}},

]},

{t:'Components, ports and paths',d:'Control plane and node components with their ports, and the files and directories you use most on a kubeadm cluster.',see:[[2,0,'kube-apiserver and the request flow'],[2,4,'Static pods and component manifests']],b:[
{h:'Components and ports'},
{t:[['Component','Where','Default port','Note'],['kube-apiserver','Control plane','6443/TCP','All clients and components connect here'],['etcd','Control plane (or external)','2379 client, 2380 peer','Only the API server should reach 2379'],['kube-scheduler','Control plane','10259/TCP','Secure metrics and health'],['kube-controller-manager','Control plane','10257/TCP','Secure metrics and health'],['kubelet','Every node','10250/TCP','API server calls it for logs and exec'],['kube-proxy','Every node','10256 health','Programs Service rules'],['NodePort Services','Every node','30000 to 32767','Open only what you need'],['CoreDNS','Pods in kube-system','53/UDP and TCP','Cluster DNS']]},
{h:'Files and directories'},
{t:[['Path','Contains'],['`/etc/kubernetes/manifests`','Static pod manifests for the control plane'],['`/etc/kubernetes/pki`','Cluster CA and component certificates and keys'],['`/etc/kubernetes/admin.conf`','Admin kubeconfig'],['`/var/lib/kubelet/config.yaml`','Kubelet configuration'],['`/var/lib/etcd`','etcd data directory'],['`/etc/containerd/config.toml`','Container runtime configuration'],['`~/.kube/config`','Client kubeconfig: clusters, users, contexts']]}
]},
{t:'kubectl cheat sheet',d:'The kubectl commands used most, by task.',see:[[1,2,'kubectl basics'],[1,6,'kubectl productivity']],b:[
{t:[['Task','Command'],['Current context and namespace','`kubectl config current-context`, `kubectl config set-context --current --namespace=dev`'],['List with more detail','`kubectl get pods -A -o wide`, `kubectl get all -n dev`'],['Describe and events','`kubectl describe pod <pod>`, `kubectl get events --sort-by=.lastTimestamp`'],['Logs','`kubectl logs <pod> -c <container> --previous -f`'],['Shell in a pod','`kubectl exec -it <pod> -- sh`'],['Debug with an ephemeral container','`kubectl debug -it <pod> --image=busybox:1.36 --target=<container>`'],['Apply and diff','`kubectl diff -f app.yaml`, `kubectl apply -f app.yaml`'],['Rollouts','`kubectl rollout status|history|undo deploy/<name>`'],['Scale','`kubectl scale deploy/<name> --replicas=3`'],['Explain a field','`kubectl explain deployment.spec.strategy`'],['Access test','`kubectl auth can-i <verb> <resource> --as=<user>`'],['Resource use','`kubectl top nodes`, `kubectl top pods -A`'],['Cluster and API info','`kubectl cluster-info`, `kubectl get nodes -o wide`, `kubectl version`, `kubectl api-versions`, `kubectl get --raw /readyz?verbose`'],['Create quickly','`kubectl create deployment web --image=nginx:1.27 --replicas=2`, `kubectl expose deploy web --port 80`, `kubectl run tmp --rm -it --image=busybox:1.36 -- sh`'],['Generate YAML','`kubectl create deploy web --image=nginx:1.27 --dry-run=client -o yaml`, `kubectl apply -f app.yaml --dry-run=server`'],['Edit and patch','`kubectl edit deploy/<name>`, `kubectl set image deploy/<name> <container>=<image>`, `kubectl patch deploy <name> -p \'{"spec":{"replicas":3}}\'`, `kubectl label pod <pod> tier=web`, `kubectl annotate pod <pod> note=x`'],['Delete','`kubectl delete -f app.yaml`, `kubectl delete pod <pod>`, `kubectl delete pod <pod> --grace-period=0 --force`'],['Namespaces','`kubectl create namespace dev`, `kubectl get ns`, `kubectl get pods -n dev`'],['Port forward and proxy','`kubectl port-forward svc/<svc> 8080:80`, `kubectl proxy`'],['Copy files','`kubectl cp <pod>:/path/file ./file`, `kubectl cp ./file <pod>:/path/file`'],['Wait for a condition','`kubectl wait --for=condition=Available deploy/<name> --timeout=120s`'],['Node maintenance','`kubectl cordon <node>`, `kubectl drain <node> --ignore-daemonsets --delete-emptydir-data`, `kubectl uncordon <node>`'],['Taints and labels','`kubectl taint nodes <node> key=value:NoSchedule`, `kubectl label node <node> disk=ssd`'],['Select and format output','`-l app=web`, `--show-labels`, `-o yaml`, `-o json`, `-o name`, `-o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName`'],['Logs from many pods','`kubectl logs -l app=web --all-containers --tail=50`, `kubectl logs deploy/<name>`'],['Config and secrets','`kubectl create configmap <name> --from-file=app.conf`, `kubectl create secret generic <name> --from-literal=key=value`'],['Autoscaling','`kubectl autoscale deploy <name> --min=2 --max=10 --cpu-percent=70`, `kubectl get hpa`'],['Jobs','`kubectl create job <name> --image=busybox:1.36 -- echo hi`, `kubectl create job --from=cronjob/<cron> <name>`'],['RBAC checks','`kubectl auth can-i --list`, `kubectl create role <name> --verb=get --resource=pods`, `kubectl create rolebinding <name> --role=<role> --user=<user>`'],['kubeadm cluster tasks','`kubeadm certs check-expiration`, `kubeadm certs renew all`, `kubeadm token create --print-join-command`, `kubeadm upgrade plan`'],['etcd backup','`ETCDCTL_API=3 etcdctl snapshot save snapshot.db --endpoints=<url> --cacert=<ca> --cert=<cert> --key=<key>`, `etcdutl snapshot restore snapshot.db`'],['Helm','`helm repo add <name> <url>`, `helm upgrade --install <release> <chart> -f values.yaml`, `helm list -A`, `helm rollback <release> <revision>`, `helm template <release> <chart>`']]},
{code:`kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"\\t"}{.metadata.name}{"\\t"}{.status.phase}{"\\n"}{end}'
kubectl get pods --field-selector=status.phase!=Running -A
kubectl api-resources --namespaced=true`}
]},
{t:'Troubleshooting lookup',d:'Symptom, likely cause and first command for the most common Kubernetes problems.',see:[[12,0,'A top-down troubleshooting method'],[12,3,'Pod failures']],b:[
{t:[['Symptom','Likely cause','First command'],['Pod Pending','Insufficient resources, taints, unbound claim, no matching node','`kubectl describe pod` (events)'],['ImagePullBackOff','Wrong image or tag, missing pull secret, registry unreachable','`kubectl describe pod`, check the image reference'],['CrashLoopBackOff','Application exits, bad config, failing liveness probe','`kubectl logs --previous`'],['OOMKilled (137)','Memory limit too low or a leak','`kubectl get pod -o jsonpath` for lastState'],['Node NotReady','kubelet, runtime or network problem, pressure','`kubectl describe node`, `journalctl -u kubelet`'],['Service has no endpoints','Selector mismatch or pods not ready','`kubectl get endpointslices`'],['DNS failures','CoreDNS down or policy blocks DNS','`kubectl -n kube-system get pods -l k8s-app=kube-dns`'],['Connection refused or timeout between pods','NetworkPolicy, wrong port, CNI issue','`kubectl get networkpolicy`, test from a debug pod'],['API server unreachable','Expired certificate, static pod down, etcd issue','`sudo crictl ps`, `kubeadm certs check-expiration`'],['PVC Pending','No StorageClass, provisioner down, zone mismatch','`kubectl describe pvc`'],['Forbidden (403)','RBAC missing','`kubectl auth can-i`']]}
]},
{t:'Common messages and states',d:'Pod states, exit codes and event reasons, with meaning and action.',see:[[12,3,'Pod failures']],b:[
{t:[['State or reason','Meaning','Action'],['`Pending`','Not scheduled, or waiting for volumes or images','Read events'],['`ContainerCreating`','Pulling the image or mounting volumes','Check events for pull and mount errors'],['`Running` but not Ready','Readiness probe failing','Check the probe and app logs'],['`CrashLoopBackOff`','Repeated container exits with increasing back-off','Logs of the previous run'],['`Error`, exit 1','Application error','Logs'],['Exit 137','SIGKILL, usually OOMKilled','Raise the memory limit or fix the leak'],['Exit 143','SIGTERM, normal stop','Check the grace period'],['`Evicted`','Node resource pressure','Check requests, node pressure and QoS'],['`FailedScheduling`','No node satisfies the pod','Resources, taints, affinity'],['`FailedMount`','Volume cannot be attached or mounted','Check the claim, zone and CSI driver'],['`Unhealthy`','A probe failed','Check the probe path and timing']]}
]},
]};
