/* LearnSphere - Kubernetes Administrator, Section 03: Cluster Architecture & Components.
   Lectures 0-5 are core, 6-9 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T,R=K.R;

const reqflow=K.dg(700,200,[
[10,70,100,60,'Client|kubectl, kubelet,|controllers',0],
[140,70,110,60,'Authentication|who are you?',0],
[280,70,110,60,'Authorization|RBAC: allowed?',0],
[420,70,110,60,'Admission|mutate, validate',2],
[560,70,120,60,'Schema validation|then write to etcd',2]],
[[110,100,140,100],[250,100,280,100],[390,100,420,100],[530,100,560,100]]);

const etcd=K.dg(700,230,[
[10,10,680,210,'etcd cluster (3 members tolerate 1 failure)',1],
[40,60,170,70,'Member A|LEADER|accepts writes',2],[265,60,170,70,'Member B|follower',0],[490,60,170,70,'Member C|follower',0],
[40,160,620,40,'A write commits only after a majority (2 of 3) has stored it',0]],
[[210,95,265,95],[210,85,490,85]]);

const pki=K.dg(700,260,[
[10,10,330,115,'Cluster CA (ca.crt / ca.key)',1],[360,10,330,115,'etcd CA (etcd/ca.crt)',1],
[30,45,140,60,'apiserver cert|serves HTTPS',0],[180,45,140,60,'apiserver-kubelet-client|API to kubelet',0],
[380,45,140,60,'etcd server + peer|certs',0],[535,45,140,60,'apiserver-etcd-client|API to etcd',0],
[10,140,330,110,'Front-proxy CA',1],[30,175,290,55,'front-proxy-client: aggregation layer',0],
[360,140,330,110,'Service account keypair',1],[380,175,290,55,'sa.key / sa.pub: sign and verify tokens',0]],
[]);

/* ---------- 0: API server ---------- */
L['k8s:2:0']={blocks:[
{p:'Every action in a Kubernetes cluster, from `kubectl get pods` to a kubelet reporting a container status, is an HTTPS request to the **kube-apiserver**. It is the **only** component that reads and writes etcd, and the only door into the cluster state. Understanding exactly what it does with a request explains authentication errors, admission rejections, API slowness and what breaks when it is down.'},
{h:'It is just a REST API'},
{p:'`kubectl` is a thin client. You can see the real HTTP calls it makes by raising the verbosity:'},
{code:`$ kubectl get pods -n shop -v=6
I1009 10:02:11.201 loader.go:395] Config loaded from file: /home/ops/.kube/config
I1009 10:02:11.320 round_trippers.go:553] GET https://10.0.0.10:6443/api/v1/namespaces/shop/pods?limit=500 200 OK in 13 milliseconds

$ kubectl get --raw /api/v1/namespaces/shop/pods | head -c 200      # the same call, raw JSON
$ kubectl get --raw /apis                                           # every API group the server offers
$ kubectl get --raw /version`},
{t:[['HTTP','kubectl verb','Meaning'],
['`GET /api/v1/namespaces/shop/pods`','`get`, `list`','Read a collection'],
['`GET ...?watch=true`','`watch`, `get -w`','Stream changes as they happen'],
['`POST`','`create`','Create an object'],
['`PUT`, `PATCH`','`update`, `patch`, `apply`, `edit`','Replace or modify'],
['`DELETE`','`delete`','Remove']]},
{h:'The request pipeline'},
{flow:['TLS connection on port 6443 (the server presents its certificate; clients may present one too)','Authentication: which user and groups is this?','Authorization: may that identity perform this verb on this resource?','Mutating admission: plugins and webhooks may change the object (defaults, injected sidecars)','Schema validation: is the object well formed for its API version?','Validating admission: policies and webhooks may reject it (quota, Pod Security, custom rules)','Write to etcd; return the stored object']},
{svg:reqflow},
{t:[['Stage','Typical failure','Message'],
['Authentication','Expired or unknown credential','`401 Unauthorized`'],
['Authorization','No RBAC rule','`403 Forbidden: ... cannot create resource "pods"`'],
['Mutating admission','Webhook unreachable with `failurePolicy: Fail`','`failed calling webhook ...`'],
['Validation','Unknown field or wrong type','`unknown field`, `Invalid value`'],
['Validating admission','Policy violation or quota','`violates PodSecurity`, `exceeded quota`, `denied the request`']]},
{h:'Watches: why controllers are cheap'},
{p:'Components do not poll. A controller first **lists** a resource and remembers its `resourceVersion`, then opens a **watch** and receives each change as an event. The API server serves most of these reads from an **in-memory watch cache**, not from etcd. If a client falls too far behind, the server answers `410 Gone` and the client must list again. This design is why thousands of kubelets and controllers can follow the cluster, and why **object count and number of watchers** drive API server load.'},
{h:'Where it runs and how it is configured'},
{code:`$ kubectl -n kube-system get pod -l component=kube-apiserver -o wide
$ sudo grep -E "^\\s+- --" /etc/kubernetes/manifests/kube-apiserver.yaml | head -n 25
    - --advertise-address=10.0.0.10
    - --authorization-mode=Node,RBAC                    # authorizers, in order
    - --client-ca-file=/etc/kubernetes/pki/ca.crt        # CA that signs client certificates it trusts
    - --enable-admission-plugins=NodeRestriction
    - --etcd-servers=https://127.0.0.1:2379
    - --service-cluster-ip-range=10.96.0.0/12
    - --tls-cert-file=/etc/kubernetes/pki/apiserver.crt
$ kubectl get --raw='/livez?verbose' | tail -n 5
$ kubectl get --raw='/readyz?verbose' | grep -v ok`},
{h:'What happens when it is down'},
{t:[['Effect','Detail'],
['kubectl and every controller fail','`connection refused` or timeouts'],
['**Running containers keep running**','The kubelet and the runtime do not need the control plane to keep existing Pods alive'],
['Nothing new happens','No scheduling, no scaling, no healing, no new Services or endpoints updates'],
['Nodes may be marked NotReady later','If it stays down, kubelets cannot renew their Lease'],
['Recovery','Check the static Pod manifest, `crictl logs`, etcd health and certificates (Section 13)']]},
{h:'High availability'},
{ul:['The API server is **stateless**: all state is in etcd, so you can run several instances behind a load balancer (active-active).','Clients (kubelets, kubectl, controllers) should use the **load balancer address**, which must be in the API server certificate SANs.','Version skew: during an upgrade the instances may differ by one minor version.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Pointing kubeconfigs at one control plane node IP','Single point of failure despite HA','Use a stable endpoint (load balancer or DNS)'],
['Heavy `list` calls from many clients (dashboards, scripts)','API memory and latency spikes','Use selectors, pagination, watches'],
['Slow validating webhooks with `failurePolicy: Fail`','Every matching write slows or fails','Short timeouts, replicas, narrow rules'],
['Treating 401 and 403 as the same','Wrong debugging path','401 = identity unknown, 403 = identity known but not allowed']]},
{note:'Exam tip: when something about the API behaves oddly, `kubectl get --raw=/readyz?verbose` and `kubectl ... -v=6` tell you whether the problem is the server, the network or your request.'}],
src:[['Controlling Access to the Kubernetes API',C+'security/controlling-access/'],['kube-apiserver reference',R+'command-line-tools-reference/kube-apiserver/'],['Admission Controllers',R+'access-authn-authz/admission-controllers/']]};

/* ---------- 1: etcd ---------- */
L['k8s:2:1']={blocks:[
{p:'**etcd** is the cluster database. Every Pod, Secret, ConfigMap, Role and Node you have ever created is a key and a value in etcd, and nothing else in Kubernetes stores cluster state durably. If etcd is lost without a backup, the cluster definition is gone, even though containers already running on nodes continue until they stop. Its health therefore decides the health of the whole cluster.'},
{h:'What is inside'},
{p:'etcd is a distributed, strongly consistent **key-value store**. Kubernetes stores each object under a path that reflects its type:'},
{code:`$ sudo ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 \\
    --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key \\
    get /registry --prefix --keys-only | head -n 8
/registry/apiregistration.k8s.io/apiservices/v1.
/registry/clusterrolebindings/cluster-admin
/registry/configmaps/kube-system/coredns
/registry/deployments/shop/web
/registry/minions/worker1                             # "minions" is the old name for Nodes
/registry/namespaces/shop
/registry/pods/shop/web-6d4f8b7c9-4xk2p
/registry/secrets/shop/db-cred`},
{p:'Only the API server talks to etcd. Values are stored in a binary (protobuf) encoding, and by default **Secrets are not encrypted**: anyone who can read etcd or a backup can read them.'},
{h:'How etcd stays consistent: Raft'},
{svg:etcd},
{flow:['The members elect one leader; the others are followers','A write request goes to the leader (followers forward it)','The leader appends it to its log and sends it to the followers','When a majority (quorum) has stored it, the entry is committed','The leader applies it and answers the client; followers apply it too']},
{p:'Because every write needs a **majority**, etcd tolerates the loss of a minority of members and never serves conflicting answers. If the leader fails, the followers hold a new election after a timeout (a few hundred milliseconds to seconds).'},
{t:[['Members','Quorum','Failures tolerated','Comment'],
['1','1','0','Labs only'],
['2','2','0','**Worse than 1**: two things to fail, no tolerance'],
['3','2','1','Typical for production'],
['4','3','1','No gain over 3'],
['5','3','2','Large or critical clusters'],
['7','4','3','Rarely needed; every write is slower']]},
{ul:['Use an **odd** number of members, in separate failure zones with low latency between them.','More members do **not** make etcd faster; writes wait for a majority, so large clusters are slower.','Losing quorum makes the cluster **read-only in practice**: the API server cannot create or update anything.']},
{h:'What etcd needs to be healthy'},
{t:[['Requirement','Why','Sign of trouble'],
['**Fast disks** (SSD or NVMe)','Every commit is flushed to disk (fsync)','`etcdserver: request timed out`, slow API, leader changes'],
['Low network latency between members','Raft heartbeats and replication','Frequent leader elections'],
['Enough memory and CPU','Working set is kept in memory','Slowdown, restarts'],
['Space within the quota','The database file has a size limit (default about 2 GB)','`mvcc: database space exceeded`, `NOSPACE` alarm, read-only'],
['Regular **backups**','Disaster recovery','No way back after data loss']]},
{h:'Inspecting etcd on a kubeadm cluster'},
{code:`$ kubectl -n kube-system get pod -l component=etcd
$ sudo grep -E "data-dir|listen-client-urls|cert-file|key-file|trusted-ca" /etc/kubernetes/manifests/etcd.yaml
$ E="--endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key"
$ sudo ETCDCTL_API=3 etcdctl $E endpoint health --write-out=table
$ sudo ETCDCTL_API=3 etcdctl $E endpoint status --write-out=table
+------------------------+------------------+---------+---------+-----------+------------+
|        ENDPOINT        |        ID        | VERSION | DB SIZE | IS LEADER | RAFT TERM  |
+------------------------+------------------+---------+---------+-----------+------------+
| https://127.0.0.1:2379 | 8e9e05c52164694d |  3.5.x  |   25 MB |      true |          4 |
$ sudo ETCDCTL_API=3 etcdctl $E member list --write-out=table
$ sudo ETCDCTL_API=3 etcdctl $E alarm list`},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Running two etcd members','No fault tolerance','1, 3 or 5'],
['Putting etcd on slow shared disks','Latency, leader flapping, API timeouts','Dedicated SSD or NVMe'],
['No backups, or never restored','Total loss after corruption','Scheduled snapshots, tested restores'],
['Storing huge objects or many events','Database growth, NOSPACE alarm','Clean up, tune quotas, fix the producer'],
['Assuming Secrets are encrypted','Plain data in etcd and in backups','Enable encryption at rest (Section 10)']]},
{p:'On managed services (EKS, AKS, GKE) you never see etcd: the provider runs, scales and backs it up. That is one of the main reasons teams choose managed control planes.'},
{note:'Exam tip: for backup and restore tasks you need three things at hand: the endpoint, and the three certificate paths (`--cacert`, `--cert`, `--key`). They are in the etcd static Pod manifest.'}],
src:[['Operating etcd clusters for Kubernetes',T+'administer-cluster/configure-upgrade-etcd/'],['etcd documentation','https://etcd.io/docs/'],['Options for Highly Available Topology',K.S+'production-environment/tools/kubeadm/ha-topology/']]};

/* ---------- 2: Scheduler and controller manager ---------- */
L['k8s:2:2']={blocks:[
{p:'Two control plane components turn the objects you store into reality. The **kube-scheduler** decides **where** Pods run. The **kube-controller-manager** decides **what must exist** and creates it. Between them, and the kubelets, they implement the central idea of Kubernetes: **desired state, reconciled continuously**.'},
{h:'The controller pattern'},
{flow:['A controller watches the objects it cares about (through the API server)','It compares desired state (spec) with observed state (status and related objects)','If they differ, it acts: creates, updates or deletes other objects','It writes the result back (status, events) and goes back to watching']},
{p:'Controllers do not run commands on machines; they **change API objects**, and other components react to those changes. A Deployment controller does not start containers: it creates a ReplicaSet, whose controller creates Pod objects, which the scheduler and a kubelet then act on. That chain of small loops is why Kubernetes is robust, and why any loop can be the broken one.'},
{h:'kube-controller-manager: many controllers in one process'},
{t:[['Controller','Watches','Acts by'],
['**Deployment**','Deployments','Creating ReplicaSets, scaling them during rollouts'],
['**ReplicaSet**','ReplicaSets and Pods','Creating or deleting Pods to match the replica count'],
['**StatefulSet**, **DaemonSet**','Their objects, Nodes','Ordered Pod creation; one Pod per node'],
['**Job**, **CronJob**','Jobs','Running Pods to completion; creating Jobs on schedule'],
['**Node**','Nodes and their Leases','Marking nodes NotReady, adding taints, evicting Pods from dead nodes'],
['**EndpointSlice**','Services and Pods','Keeping the list of ready Pod IPs behind each Service'],
['**ServiceAccount**, **Namespace**, **PersistentVolume**','Respective objects','Default accounts, cleanup of deleted namespaces, binding volumes to claims'],
['**Garbage collector**','`ownerReferences`','Deleting dependents when an owner is deleted'],
['**HPA**','HorizontalPodAutoscalers and metrics','Changing replica counts']]},
{h:'Owner references: the chain you can follow'},
{code:`$ kubectl get pod web-6d4f8b7c9-4xk2p -n shop -o jsonpath='{.metadata.ownerReferences[*].kind}/{.metadata.ownerReferences[*].name}{"\\n"}'
ReplicaSet/web-6d4f8b7c9
$ kubectl get rs web-6d4f8b7c9 -n shop -o jsonpath='{.metadata.ownerReferences[*].kind}/{.metadata.ownerReferences[*].name}{"\\n"}'
Deployment/web
$ kubectl delete pod web-6d4f8b7c9-4xk2p -n shop      # the ReplicaSet controller creates a replacement within seconds
$ kubectl delete deployment web -n shop               # the garbage collector removes the ReplicaSets and Pods`},
{h:'kube-scheduler: choosing nodes'},
{p:'The scheduler watches for Pods with an empty `spec.nodeName`. For each it filters nodes that cannot run the Pod, scores the rest and **binds** the Pod by writing the chosen node name. It never starts a container. (The scheduler is covered in depth in Section 6.)'},
{code:`$ kubectl get events --field-selector reason=Scheduled -n shop | tail -n 2
Normal  Scheduled  pod/web-6d4f8b7c9-4xk2p  Successfully assigned shop/web-6d4f8b7c9-4xk2p to worker2
$ kubectl describe pod stuck | grep -A2 FailedScheduling
  0/3 nodes are available: 3 Insufficient memory.`},
{h:'Leader election: one active copy'},
{p:'In a high-availability control plane several scheduler and controller-manager processes run, but **only one is active**, or they would create duplicates and fight. They coordinate through a **Lease** object: the holder renews it regularly, and if it stops, another instance takes over.'},
{code:`$ kubectl -n kube-system get lease
NAME                      HOLDER                                          AGE
kube-controller-manager   cp2_8c1f3d6e-...                                40d
kube-scheduler            cp1_2b7a91cd-...                                40d`},
{h:'What stops when each is down'},
{t:[['Component down','Visible effect','Still works'],
['**kube-scheduler**','New Pods stay **Pending with no scheduling events**','Running Pods, existing Services, kubectl'],
['**kube-controller-manager**','No healing or rollouts: deleted Pods not replaced, Deployment changes ignored, dead nodes not detected, Jobs not created','Running Pods and traffic'],
['**API server**','Everything management-related','Running containers']]},
{h:'How to check them'},
{code:`kubectl -n kube-system get pods -l component=kube-scheduler
kubectl -n kube-system get pods -l component=kube-controller-manager
kubectl -n kube-system logs -l component=kube-controller-manager --tail=20
sudo crictl ps | grep -E "scheduler|controller"                  # when kubectl is unavailable
kubectl get --raw='/readyz?verbose' | grep -E "scheduler|controller"`},
{note:'Mental model for debugging: "nothing happens after I create an object" means a controller is not acting; "Pods exist but are Pending with no events" means the scheduler is not acting; "Pods are scheduled but not running" means the kubelet or runtime is the problem.'}],
src:[['Kubernetes Scheduler',C+'scheduling-eviction/kube-scheduler/'],['Controllers',C+'architecture/controller/'],['kube-controller-manager reference',R+'command-line-tools-reference/kube-controller-manager/']]};

/* ---------- 3: Node components and add-ons ---------- */
L['k8s:2:3']={blocks:[
{p:'The control plane decides; **worker nodes do the work**. Each node runs a small set of components that turn Pod objects into running containers and make them reachable. A working cluster also needs a few **add-ons** (networking, DNS) that are not optional in practice. This lecture explains what each does, where it lives, and how to check it.'},
{h:'What runs on a node'},
{t:[['Component','Runs as','Role','Where its config lives'],
['**kubelet**','systemd service (not a Pod)','Node agent: runs Pods, mounts volumes, runs probes, reports status','`/var/lib/kubelet/config.yaml`, `/etc/kubernetes/kubelet.conf`'],
['**Container runtime**','systemd service (containerd or CRI-O)','Pulls images, creates and stops containers through the CRI','`/etc/containerd/config.toml`'],
['**kube-proxy**','DaemonSet Pod','Programs rules that make Services work','ConfigMap `kube-proxy` in `kube-system`'],
['**CNI plugin**','DaemonSet Pod + binaries on the node','Pod IPs and cross-node connectivity','`/etc/cni/net.d`, `/opt/cni/bin`'],
['**CoreDNS**','Deployment (2 replicas)','Cluster DNS','ConfigMap `coredns`'],
['**metrics-server** (common)','Deployment','Resource metrics for `kubectl top` and the HPA','Its own manifest']]},
{h:'The kubelet: the most important one'},
{p:'The kubelet runs on every node (including the control plane) and does the following continuously:'},
{flow:['Registers the node with the API server and keeps a Lease alive (about every 10 seconds)','Watches for Pods assigned to its node and for static Pod manifests on disk','Asks the runtime (via CRI) to pull images and create containers; asks the CNI for networking and the volume plugins for mounts','Runs liveness, readiness and startup probes and restarts containers per policy','Reports Pod and node status back, and evicts Pods under resource pressure']},
{code:`$ systemctl status kubelet
$ sudo journalctl -u kubelet -f
$ sudo cat /var/lib/kubelet/config.yaml | grep -E "cgroupDriver|clusterDNS|staticPodPath|rotateCertificates|authorization|anonymous"
$ sudo cat /etc/kubernetes/kubelet.conf | grep -E "server:|client-certificate"      # how it reaches the API server
$ kubectl get lease -n kube-node-lease worker1 -o jsonpath='{.spec.renewTime}{"\\n"}'   # the node heartbeat`},
{h:'Runtime, CRI and crictl'},
{p:'The kubelet speaks the **Container Runtime Interface** to the runtime. Docker Engine is not a CRI runtime itself; images built with Docker run unchanged because they follow the OCI format. `crictl` lets you inspect containers on a node even when `kubectl` is not available:'},
{code:`$ sudo crictl ps                              # running containers
$ sudo crictl pods                            # Pod sandboxes
$ sudo crictl logs <container-id>
$ sudo crictl info | head -n 20               # includes RuntimeReady and NetworkReady`},
{h:'kube-proxy and the CNI'},
{ul:['**kube-proxy** watches Services and EndpointSlices and programs iptables, nftables or IPVS rules so a Service IP reaches a ready Pod (Section 7). Some CNIs replace it completely.','The **CNI plugin** gives each Pod an IP and routes between nodes. Until it is installed, nodes stay `NotReady` and CoreDNS Pods stay `Pending`.','**CoreDNS** answers names such as `api.shop.svc.cluster.local`; Pods use it through the `kube-dns` Service.']},
{h:'Is this node healthy? A checklist'},
{code:`$ kubectl get nodes -o wide
$ kubectl describe node worker1 | sed -n '/Conditions:/,/Addresses:/p'
$ kubectl -n kube-system get pods -o wide --field-selector spec.nodeName=worker1     # kube-proxy, CNI, ... on this node
$ kubectl get --raw "/api/v1/nodes/worker1/proxy/healthz"                              # kubelet health via the API (needs permission)`},
{t:[['Node condition','Meaning','If False or True (bad)'],
['`Ready`','Kubelet is healthy and the node accepts Pods','Check kubelet, runtime, CNI'],
['`MemoryPressure`, `DiskPressure`, `PIDPressure`','Resource thresholds crossed; Pods may be evicted','Free resources (Section 13)'],
['`NetworkUnavailable`','Network not yet configured (set by CNI or cloud)','CNI Pods and configuration']]},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Expecting `docker ps` on a containerd node','Shows nothing','Use `crictl ps`'],
['Forgetting the CNI after `kubeadm init`','Node NotReady, DNS Pending','Install a CNI plugin immediately'],
['Kubelet and runtime with different cgroup drivers','Unstable nodes, failing Pods','Use `systemd` for both'],
['Editing the kubelet config without restarting','Change not applied','`systemctl restart kubelet`'],
['Treating kube-proxy as the network','Looking in the wrong place for Pod-to-Pod problems','kube-proxy does Services only; the CNI does Pod networking']]},
{note:'On managed services you still have kubelets, runtimes and CNIs on your nodes; you just do not run the control plane. Node troubleshooting skills apply everywhere.'}],
src:[['Node Components',C+'architecture/#node-components'],['kubelet reference',R+'command-line-tools-reference/kubelet/'],['Nodes',C+'architecture/nodes/'],['Addons',C+'cluster-administration/addons/']]};

/* ---------- 4: Static pods ---------- */
L['k8s:2:4']={blocks:[
{p:'There is a chicken-and-egg problem at the heart of a kubeadm cluster: the API server, scheduler, controller manager and etcd are themselves Pods, but Pods are created through the API server. **Static Pods** break the loop. A static Pod is defined by a **file on the node** and run directly by the **kubelet**, with no API server needed. kubeadm uses them to start the whole control plane.'},
{h:'How static Pods work'},
{flow:['The kubelet is configured with a staticPodPath (usually /etc/kubernetes/manifests)','It watches that directory continuously','A new or changed YAML file makes the kubelet create (or recreate) that Pod through the runtime','A removed file stops the Pod','When an API server exists, the kubelet publishes a read-only mirror Pod so you can see it with kubectl']},
{code:`$ sudo grep staticPodPath /var/lib/kubelet/config.yaml
staticPodPath: /etc/kubernetes/manifests
$ ls -l /etc/kubernetes/manifests
-rw------- 1 root root 2552 Oct  1 08:00 etcd.yaml
-rw------- 1 root root 3891 Oct  1 08:00 kube-apiserver.yaml
-rw------- 1 root root 3385 Oct  1 08:00 kube-controller-manager.yaml
-rw------- 1 root root 1465 Oct  1 08:00 kube-scheduler.yaml
$ kubectl get pods -n kube-system -o wide | grep cp1
kube-apiserver-cp1            1/1   Running   0   40d   10.0.0.10   cp1      # the name has the node name appended`},
{h:'Static Pod versus normal Pod'},
{t:[['','Normal Pod','Static Pod'],
['Defined by','An API object','A file on one node'],
['Managed by','A controller (ReplicaSet, ...) and the scheduler','Only the **kubelet** on that node'],
['Scheduled by','kube-scheduler','Never: it always runs on that node'],
['Edit with','`kubectl edit`, apply','Edit the file'],
['`kubectl delete pod`','Pod removed (controller recreates it)','Mirror Pod deleted; the kubelet **recreates it at once**; the real Pod is untouched'],
['Needs the API server to start','Yes','**No**'],
['Can reference ConfigMaps and Secrets','Yes','**No** in recent releases (it must run without the API)']]},
{h:'Hands-on: create and remove a static Pod'},
{code:`# on a node (control plane or worker); the directory is the staticPodPath above
sudo tee /etc/kubernetes/manifests/static-web.yaml <<'EOF'
apiVersion: v1
kind: Pod
metadata: {name: static-web}
spec:
  containers:
  - name: web
    image: nginx:1.27
EOF
sleep 15
kubectl get pods -A | grep static-web                  # static-web-cp1 (node name appended)
kubectl delete pod static-web-cp1                      # it comes back at once
sudo rm /etc/kubernetes/manifests/static-web.yaml      # NOW it is gone`},
{h:'Changing a control plane component safely'},
{p:'To change an API server flag you edit its manifest; the kubelet notices and **recreates the Pod** with the new arguments. That is powerful and dangerous: a typo means the API server does not start, and then `kubectl` cannot help you fix it.'},
{code:`sudo cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak     # backup OUTSIDE the manifests directory
sudo vim /etc/kubernetes/manifests/kube-apiserver.yaml
# watch it restart (use crictl: kubectl may be down for a moment)
sudo crictl ps | grep kube-apiserver
sudo crictl logs --tail 20 $(sudo crictl ps -a --name kube-apiserver -q | head -1)     # if it does not start
kubectl get nodes`},
{h:'Pitfalls'},
{ul:['**Never keep backup files in the manifests directory** (for example `kube-apiserver.yaml.bak` is ignored, but `.yaml` copies are started). Keep backups elsewhere.','The kubelet restarts the Pod whenever the file **content** changes; saving with the same content does nothing.','To force a restart without changing anything, move the file out for a few seconds and back.','Static Pods run only on the node that holds the file: for control plane HA each control plane node needs its own set.','Resource requests, probes and volumes work as in any Pod, but there is no controller to reschedule it elsewhere.']},
{t:[['Symptom','Cause'],
['The Pod does not appear after you add a file','YAML error (kubelet journal: `can not process`), wrong directory, or the kubelet is not running'],
['Control plane Pod loops restarting','Bad flag or path in the manifest: read `crictl logs`'],
['Mirror Pod shows but is `Pending`','Usually normal for a few seconds; check the node and runtime'],
['Deleted the Pod with kubectl and it returned','Expected: remove the file instead']]},
{note:'Exam tip: tasks like "create a static Pod on node X" mean writing the manifest into that node `staticPodPath`. Find the path in `/var/lib/kubelet/config.yaml` (or in the kubelet process arguments) rather than assuming it.'}],
src:[['Create static Pods',T+'configure-pod-container/static-pod/'],['kubeadm implementation details',R+'setup-tools/kubeadm/implementation-details/']]};

/* ---------- 5: Certificates ---------- */
L['k8s:2:5']={blocks:[
{p:'A kubeadm cluster is held together by **TLS certificates**. Components prove who they are to each other with them, and they encrypt traffic. When one expires or does not match, parts of the cluster stop talking, and the error messages (`x509: certificate ...`) are cryptic unless you know who trusts whom. This lecture is the map.'},
{h:'Who trusts whom'},
{svg:pki},
{p:'There are several separate **trust domains**, each with its own certificate authority (CA): the cluster CA (clients and the API server), the **etcd CA** (etcd and its clients), the **front-proxy CA** (the aggregation layer) and a plain **key pair for ServiceAccount tokens**.'},
{t:[['File in `/etc/kubernetes/pki`','Purpose','Signed by'],
['`ca.crt`, `ca.key`','The cluster CA: signs the others; the key is the crown jewel','(self-signed)'],
['`apiserver.crt`','Serving certificate of the API server; must include every name and IP clients use (SANs)','cluster CA'],
['`apiserver-kubelet-client.crt`','Identity the API server uses to call kubelets (logs, exec)','cluster CA'],
['`apiserver-etcd-client.crt`','Identity the API server uses to call etcd','etcd CA'],
['`etcd/ca.crt`, `etcd/server.crt`, `etcd/peer.crt`, `etcd/healthcheck-client.crt`','etcd serving, member-to-member and health check certificates','etcd CA'],
['`front-proxy-ca.crt`, `front-proxy-client.crt`','Aggregation layer to extension API servers','front-proxy CA'],
['`sa.key`, `sa.pub`','Sign and verify ServiceAccount tokens (not X.509)','(key pair)']]},
{p:'The files in `/etc/kubernetes/*.conf` (`admin.conf`, `kubelet.conf`, `controller-manager.conf`, `scheduler.conf`) are kubeconfigs that **embed client certificates** for those components.'},
{h:'Reading a certificate'},
{code:`$ sudo openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -subject -issuer -dates -ext subjectAltName
subject=CN = kube-apiserver
issuer=CN = kubernetes
notBefore=Oct  1 08:00:00 2026 GMT
notAfter=Oct  1 08:00:00 2027 GMT
X509v3 Subject Alternative Name:
    DNS:cp1, DNS:kubernetes, DNS:kubernetes.default.svc, DNS:k8s-api.example.com, IP Address:10.96.0.1, IP Address:10.0.0.10

$ sudo kubeadm certs check-expiration
CERTIFICATE                EXPIRES                  RESIDUAL TIME   CERTIFICATE AUTHORITY
admin.conf                 Oct 01, 2027 08:00 UTC   357d            ca
apiserver                  Oct 01, 2027 08:00 UTC   357d            ca
etcd-server                Oct 01, 2027 08:00 UTC   357d            etcd-ca
CERTIFICATE AUTHORITY      EXPIRES                  RESIDUAL TIME
ca                         Sep 28, 2036 08:00 UTC   9y`},
{ul:['Leaf certificates last **one year** by default; CAs last **ten years**.','`kubeadm upgrade` renews leaf certificates, so regularly upgraded clusters rarely expire.','Kubelet client certificates can rotate themselves (`rotateCertificates: true`).','The **SANs** (Subject Alternative Names) of the API server certificate must contain every DNS name and IP clients connect to, including the load balancer.']},
{h:'Common x509 errors'},
{t:[['Error','Meaning','Fix'],
['`x509: certificate has expired or is not yet valid`','Past `notAfter` or before `notBefore`, **or the system clock is wrong**','Renew the certificate; check `timedatectl`'],
['`x509: certificate is valid for A, B, not C`','The name or IP used is not in the SANs','Regenerate the API server certificate with the extra SAN'],
['`x509: certificate signed by unknown authority`','The client does not trust the CA that signed it','Fix the CA data in the kubeconfig'],
['`tls: bad certificate` in the API server log','A client presented a certificate the server rejects (wrong CA, expired)','Find the client; renew or replace its certificate'],
['Kubelet cannot register after a long downtime','Expired kubelet client certificate','Re-bootstrap the node']]},
{h:'Renewing'},
{code:`sudo kubeadm certs renew all                      # or one: apiserver, apiserver-kubelet-client, front-proxy-client ...
sudo kubeadm certs check-expiration
# control plane components must reload them: move the static manifests out, wait, move them back
cd /etc/kubernetes/manifests && sudo mkdir -p /root/mh && sudo mv *.yaml /root/mh/ && sleep 30 && sudo mv /root/mh/*.yaml .
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config        # admin.conf was renewed too`},
{p:'`kubeadm certs renew` works **locally on the control plane node, even when the API server is down**, which is exactly what you need when an expired certificate has locked you out.'},
{h:'Common mistakes'},
{ul:['Not tracking expiry: a cluster that is never upgraded stops working one year after installation.','Forgetting to add the load balancer name to the API server SANs when going HA.','Renewing certificates but not restarting the control plane Pods, so the old ones stay in memory.','Copying `admin.conf` widely: it is a **cluster-admin** credential.','Replacing the CA without a plan: every kubeconfig and kubelet must trust the new one.']},
{note:'On managed clusters the provider rotates control plane certificates. You still own certificates of your own applications (Ingress TLS and service certificates), typically automated with cert-manager.'}],
src:[['PKI certificates and requirements',K.S+'best-practices/certificates/'],['Certificate Management with kubeadm',T+'administer-cluster/kubeadm/kubeadm-certs/'],['Manage TLS Certificates',T+'tls/']]};

/* ---------- Additional content ---------- */
/* 6: API server internals */
L['k8s:2:6']={blocks:[
{p:'Behind the simple REST API sits machinery that makes the API server scale and extend. Three parts matter to an administrator: the **aggregation layer**, the **watch cache** and **API Priority and Fairness**.'},
{h:'Aggregation layer'},
{p:'The API server can proxy part of its API tree to **another server** that registers itself with an `APIService` object. Clients see one API, but requests under that group go to the extension server. The metrics API (`metrics.k8s.io`) works this way.'},
{code:`kubectl get apiservices | head
kubectl get apiservice v1beta1.metrics.k8s.io -o yaml | sed -n '/spec:/,/status:/p'
# AVAILABLE=False means the backing Service is not reachable (common after a broken metrics-server install)
kubectl get apiservices | grep -v True`},
{ul:['The proxy authenticates to the extension server using the **front-proxy** client certificate in `/etc/kubernetes/pki`.','An unhealthy extension API can slow or break discovery commands such as `kubectl api-resources` and namespace deletion.']},
{h:'Watch cache'},
{p:'Most reads (`list` and `watch`) are served from an **in-memory cache** inside the API server instead of hitting etcd every time. Controllers start with a `list`, remember the `resourceVersion`, and then `watch` for changes. If a client falls too far behind, the server answers `410 Gone` and the client must list again (a relist).'},
{ul:['A `list` with `resourceVersion=0` may return cached, slightly stale data; a consistent read goes to etcd.','Large lists of big objects (for example all Pods in all namespaces from many clients) are the usual cause of API server memory spikes.','Use **pagination** (`--chunk-size`), label or field selectors and watches instead of repeated full lists.']},
{h:'API Priority and Fairness (APF)'},
{p:'APF protects the API server from being overloaded by one noisy client. Requests are classified into **priority levels** with their own concurrency shares and queues, and fair-queued per flow, so a runaway controller cannot starve everything else.'},
{code:`kubectl get flowschemas
kubectl get prioritylevelconfigurations
kubectl get --raw /debug/api_priority_and_fairness/dump_priority_levels
# Throttled clients receive 429 Too Many Requests with a Retry-After header`},
{t:[['Object','Purpose'],
['`FlowSchema`','Matches requests (by user, group, verb, resource) and assigns them to a priority level'],
['`PriorityLevelConfiguration`','Defines concurrency shares, queues and whether requests are queued or rejected']]},
{h:'Operational signs'},
{ul:['Many `429` responses or high `apiserver_flowcontrol_*` rejection metrics: some client is flooding the API.','Slow `kubectl get` for large kinds: check list sizes and client behaviour.','Request latency histograms and in-flight requests are the first metrics to alert on.']},
{note:'Defaults protect system components first (leader election and node heartbeats have high priority). Change FlowSchemas only after measuring, because a wrong rule can starve kubelets or controllers.'}],
src:[['Kubernetes API Concepts',K.R+'using-api/api-concepts/'],['API Priority and Fairness',K.C+'cluster-administration/flow-control/'],['Extending the Kubernetes API with the aggregation layer',K.C+'extend-kubernetes/api-extension/apiserver-aggregation/']]};

/* 7: etcd internals */
L['k8s:2:7']={blocks:[
{p:'etcd is a replicated, strongly consistent key-value store built on the **Raft** consensus algorithm. Understanding how it commits writes and grows explains most etcd health problems.'},
{h:'Raft in four ideas'},
{ul:['**Leader election**: members elect one leader per **term**. Followers who miss heartbeats become candidates and call an election.','**Log replication**: writes go to the leader, which appends them to its log and replicates them to followers.','**Commit by majority**: an entry is committed once a **quorum** has stored it, then applied to the state machine and acknowledged.','**Safety**: only a member with an up-to-date log can win an election, so committed data is never lost while a quorum survives.']},
{h:'Quorum math'},
{t:[['Members (n)','Quorum floor(n/2)+1','Failures tolerated'],['1','1','0'],['3','2','1'],['5','3','2'],['7','4','3']]},
{p:'A cluster without quorum becomes **read-unavailable for writes**: the API server cannot create or update anything. Even-sized clusters add cost without adding fault tolerance (4 members still tolerate only 1 failure).'},
{h:'Storage: revisions, compaction and defragmentation'},
{ul:['Kubernetes uses etcd MVCC: each change creates a new **revision**; old revisions remain until **compaction**.','The API server asks etcd to compact periodically (default about every 5 minutes), but compaction only marks space as free.','**Defragmentation** rewrites the database file to return the free space to the filesystem. It blocks the member briefly, so do one member at a time and not on the leader at peak.','If the file exceeds the backend quota (default about 2 GB), etcd raises a `NOSPACE` alarm and goes **read-only**.']},
{code:`E="--endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key"
sudo ETCDCTL_API=3 etcdctl $E endpoint status --write-out=table      # DB size, leader, raft term
sudo ETCDCTL_API=3 etcdctl $E member list --write-out=table
sudo ETCDCTL_API=3 etcdctl $E alarm list
sudo ETCDCTL_API=3 etcdctl $E defrag
sudo ETCDCTL_API=3 etcdctl $E alarm disarm                            # after freeing space`},
{h:'Signals of trouble'},
{t:[['Symptom','Likely cause'],
['`etcdserver: request timed out`, slow API','Slow disk (fsync), CPU starvation, network latency'],
['Frequent leader changes','Heartbeat timeouts: disk or network problems'],
['`mvcc: database space exceeded`','Quota reached: compact, defrag, disarm; find the object churn'],
['One member cannot join','Wrong peer URLs or certificates, or data from an old cluster']]},
{note:'A large number of objects (for example thousands of Events, Jobs or custom resources) is the common cause of etcd growth. Fix the producer rather than only defragmenting.'}],
src:[['Operating etcd clusters for Kubernetes',K.T+'administer-cluster/configure-upgrade-etcd/'],['etcd documentation','https://etcd.io/docs/'],['The Raft consensus algorithm','https://raft.github.io/']]};

/* 8: Cloud controller manager */
L['k8s:2:8']={blocks:[
{p:'Some cluster behaviour depends on the infrastructure beneath it: creating load balancers, learning which cloud instance a node is, setting up routes. The **cloud controller manager (CCM)** holds that provider-specific logic so the core of Kubernetes stays cloud-neutral.'},
{h:'What it runs'},
{t:[['Controller','What it does'],
['**Node controller**','Initialises Node objects with cloud information (instance ID, zone, addresses) and removes nodes whose VMs no longer exist'],
['**Route controller**','Configures cloud routes so Pod networks can communicate (when the CNI relies on them)'],
['**Service controller**','Creates, updates and deletes **cloud load balancers** for `type: LoadBalancer` Services']]},
{h:'How it fits together'},
{flow:['You create a Service of type LoadBalancer','The service controller in the CCM calls the cloud API to create a load balancer','It writes the external IP or host name into the Service status','When the Service is deleted, it removes the load balancer']},
{ul:['On managed services (EKS, AKS, GKE) the CCM runs as part of the managed control plane; you do not see it.','On kubeadm clusters in a cloud, you install the **provider CCM** yourself and start the kubelet with `--cloud-provider=external`.','Nodes start with a taint `node.cloudprovider.kubernetes.io/uninitialized` until the CCM initialises them.','In-tree cloud provider code has been removed from Kubernetes in favour of external CCMs and CSI drivers.']},
{code:`kubectl -n kube-system get pods | grep -i cloud
kubectl get nodes -o custom-columns=NAME:.metadata.name,PROVIDER:.spec.providerID,ZONE:.metadata.labels.topology\\.kubernetes\\.io/zone
kubectl get svc -A | grep LoadBalancer
kubectl describe svc web | sed -n '/Events:/,$p'      # load balancer creation errors appear here`},
{h:'Troubleshooting'},
{ul:['`EXTERNAL-IP` stays `<pending>`: no CCM or no load balancer implementation, missing cloud permissions or quota.','New nodes stay tainted `uninitialized`: the CCM is not running or lacks permissions.','Load balancers left behind after deleting a cluster: delete Services of type LoadBalancer **first**.']},
{note:'On bare metal there is no cloud, so LoadBalancer Services stay pending unless you install something such as MetalLB (Section 7, additional content).'}],
src:[['Cloud Controller Manager',K.C+'architecture/cloud-controller/']]};

/* 9: Leader election and HA */
L['k8s:2:9']={blocks:[
{p:'In a highly available control plane several copies of each component run, but **only one active** scheduler and controller manager should act at a time, or they would create duplicates and conflicting decisions. They coordinate through **leader election**.'},
{h:'How leader election works'},
{p:'Instances compete to hold a **Lease** object in `kube-system`. The holder renews the lease regularly. If it stops renewing (crash, network loss), another instance acquires it after the lease duration and becomes the leader.'},
{code:`kubectl -n kube-system get lease
kubectl -n kube-system get lease kube-scheduler -o yaml | grep -E "holderIdentity|renewTime|leaseDurationSeconds"
kubectl -n kube-system get lease kube-controller-manager -o jsonpath='{.spec.holderIdentity}{"\\n"}'
kubectl get lease -n kube-node-lease | head      # node heartbeats are Leases too`},
{ul:['**kube-apiserver** is stateless and **active-active**: all instances serve requests behind a load balancer.','**kube-scheduler** and **kube-controller-manager** are **active-standby**: one leader, others idle.','**etcd** has its own Raft leader, separate from these.','Default timings are roughly 15 s lease duration, 10 s renew deadline and 2 s retry period; flags `--leader-elect-*` tune them.']},
{h:'What happens when a control plane node fails'},
{t:[['Failed component','Effect','Recovery'],
['An API server','Load balancer stops sending it traffic; no interruption if others are healthy','Automatic'],
['The scheduler leader','New Pods stay Pending for up to the lease duration','Another instance takes over'],
['The controller manager leader','Healing and rollouts pause briefly','Another instance takes over'],
['An etcd member','Writes continue if quorum remains','Replace or repair the member'],
['Quorum lost (2 of 3 down)','API server cannot write; cluster state is frozen','Restore quorum or restore from snapshot']]},
{h:'Check HA is real'},
{ul:['Verify there are at least **three** control plane nodes in separate failure zones for production.','Stop the kubelet on one control plane node in a lab and watch: `kubectl` through the load balancer keeps working and the Lease holder changes.','The load balancer must health-check `/livez` or `/readyz` on each API server and must itself be redundant.']},
{note:'Nodes also use Leases (namespace `kube-node-lease`) as cheap heartbeats. A node whose Lease is not renewed for a while is marked NotReady by the node controller.'}],
src:[['Leases',K.C+'architecture/leases/'],['Options for Highly Available Topology',K.S+'production-environment/tools/kubeadm/ha-topology/'],['kube-scheduler reference',K.R+'command-line-tools-reference/kube-scheduler/']]};
})();
