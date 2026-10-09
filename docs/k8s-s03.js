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
{p:'The **kube-apiserver** is the only component that reads and writes etcd and the only one every other component talks to. Whatever happens in a cluster happens through an API call, which makes the API server the best place to understand security, auditing and failure.'},
{svg:reqflow},
{h:'The request pipeline'},
{flow:['Authentication: who is making this request?','Authorization: is that identity allowed to do this verb on this resource?','Mutating admission: controllers may modify the object (defaults, sidecars)','Schema validation of the object','Validating admission: controllers may reject the object','Persist to etcd and return the result']},
{ul:['**Authentication** accepts client certificates, bearer tokens (service account tokens, OIDC), and webhooks. Section 9 covers this.','**Authorization** modes are usually `Node,RBAC`. A request denied here returns `403 Forbidden`.','**Admission** plugins such as `NamespaceLifecycle`, `LimitRanger`, `ServiceAccount`, `ResourceQuota` and `PodSecurity`, plus webhooks you add.']},
{h:'Watches make controllers efficient'},
{p:'Components do not poll. They open a **watch** on a resource type and the API server streams changes. The scheduler watches for unscheduled Pods; the kubelet watches for Pods bound to its node. This is why control plane load rises with the number of objects and watchers.'},
{h:'Look at it on a kubeadm cluster'},
{code:`# The API server runs as a static Pod
kubectl -n kube-system get pod -l component=kube-apiserver
sudo cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep -E "^\\s+- --"

# Health endpoints
kubectl get --raw=/livez?verbose
kubectl get --raw=/readyz?verbose
kubectl get --raw=/version`},
{h:'Important flags to recognise'},
{t:[['Flag','Purpose'],
['`--etcd-servers`','Where etcd lives'],
['`--authorization-mode`','Authorizers in order, for example `Node,RBAC`'],
['`--enable-admission-plugins`','Extra admission plugins turned on'],
['`--service-cluster-ip-range`','CIDR from which Service ClusterIPs are allocated'],
['`--client-ca-file`','CA that signs client certificates it will trust'],
['`--audit-policy-file`, `--audit-log-path`','Audit logging, see Section 10']]},
{h:'When the API server is down'},
{ul:['`kubectl` fails with `connection refused` or timeouts.','Existing Pods keep running because the kubelet and runtime do not need the control plane to keep containers alive.','Nothing new is scheduled, scaled or healed until the API server returns.','Diagnose with `crictl ps -a`, the kubelet journal and the static Pod manifest. Section 13 walks through it.']},
{note:'The API server is stateless: all state is in etcd. You can run several behind a load balancer for high availability.'}],
src:[['Controlling Access to the Kubernetes API',C+'security/controlling-access/'],['kube-apiserver reference',R+'command-line-tools-reference/kube-apiserver/'],['Admission Controllers',R+'access-authn-authz/admission-controllers/']]};

/* ---------- 1: etcd ---------- */
L['k8s:2:1']={blocks:[
{p:'**etcd** is a distributed, consistent key-value store. It holds every Kubernetes object: Pods, Secrets, ConfigMaps, RBAC. If etcd is lost with no backup, the cluster definition is gone, although containers already running on nodes continue until they stop.'},
{svg:etcd},
{h:'Quorum'},
{p:'etcd uses the **Raft** consensus algorithm. One member is the leader; writes commit when a **majority (quorum)** of members has recorded them. Quorum for n members is floor(n/2) + 1.'},
{t:[['Members','Quorum','Failures tolerated'],['1','1','0'],['2','2','0 (worse than 1: either failure stops writes)'],['3','2','1'],['4','3','1'],['5','3','2'],['7','4','3']]},
{ul:['Use an **odd** number of members: 3 for most clusters, 5 for large or critical ones.','More members do not make it faster. Every write must reach a majority, so large clusters write slower.','Place members in separate failure zones with low latency between them.']},
{h:'What it needs to be healthy'},
{ul:['**Fast disks**. etcd calls fsync on every commit. Slow or shared disks cause leader elections and API timeouts. Use SSD or NVMe, dedicated if possible.','**Low latency network** between members.','**Backups**. Take regular snapshots and test restores (Section 11).','A size limit (the default backend quota is about 2 GB, configurable). When exceeded, etcd goes read-only with a `NOSPACE` alarm.']},
{h:'Inspect etcd on a kubeadm cluster'},
{code:`# etcd runs as a static Pod; manifest and data directory
sudo cat /etc/kubernetes/manifests/etcd.yaml | grep -E "data-dir|listen-client|cert-file|key-file|trusted-ca"
sudo ls /var/lib/etcd/member

# Health and members with etcdctl (v3 API)
sudo ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  endpoint health --write-out=table

sudo ETCDCTL_API=3 etcdctl ... member list --write-out=table`},
{note:'Secrets are stored in etcd base64 encoded, not encrypted, unless you enable encryption at rest. Anyone who can read etcd or its backups can read every Secret. Section 10 covers encryption at rest.'},
{p:'On managed services (EKS, AKS, GKE) you never see etcd; the provider runs and backs it up. That is one of the main reasons teams choose managed control planes.'}],
src:[['Operating etcd clusters for Kubernetes',T+'administer-cluster/configure-upgrade-etcd/'],['etcd documentation','https://etcd.io/docs/'],['Options for Highly Available Topology',K.S+'production-environment/tools/kubeadm/ha-topology/']]};

/* ---------- 2: Scheduler and controller manager ---------- */
L['k8s:2:2']={blocks:[
{p:'Two control plane components turn declared intent into running Pods: the scheduler decides **where**, and the controller manager decides **what must exist**.'},
{h:'kube-scheduler'},
{p:'The scheduler watches for Pods with an empty `spec.nodeName`. For each one it runs a scheduling cycle and then binds the Pod to a node by writing `nodeName`.'},
{flow:['Pod appears unscheduled','Filter: remove nodes that cannot run it (resources, taints, selectors, volumes)','Score: rank remaining nodes by preferences','Pick the highest score','Bind: write the chosen node into the Pod','Kubelet on that node takes over']},
{ul:['It decides placement **only**. It never starts containers.','If no node fits, the Pod stays **Pending** with an event such as `0/3 nodes are available: 3 Insufficient cpu`.','Section 6 covers affinity, taints, topology spread and priority in detail.']},
{h:'kube-controller-manager'},
{p:'A single binary running many controllers, each a loop for one kind of object. Examples:'},
{t:[['Controller','Watches','Acts by'],
['Deployment','Deployments','Creating and scaling ReplicaSets, running rollouts'],
['ReplicaSet','ReplicaSets and Pods','Creating or deleting Pods to match the replica count'],
['Node','Nodes','Marking nodes NotReady, tainting, evicting Pods from dead nodes'],
['Job / CronJob','Jobs','Creating Pods to completion; creating Jobs on schedule'],
['EndpointSlice','Services and Pods','Maintaining the list of ready Pod IPs behind a Service'],
['ServiceAccount, Namespace, PV','respective objects','Creating default accounts, cleaning up deleted namespaces, binding volumes'],
['Garbage collector','ownerReferences','Deleting dependents when an owner is deleted']]},
{h:'Owner references'},
{p:'A Deployment owns ReplicaSets, which own Pods. Each child has an `ownerReferences` entry. Delete the Deployment and the garbage collector removes the rest. Delete a Pod owned by a ReplicaSet and the ReplicaSet creates a new one.'},
{code:`kubectl get pod web-7d9f -o jsonpath='{.metadata.ownerReferences[*].name}'

# Component health on a kubeadm cluster
kubectl -n kube-system get pods -l component=kube-scheduler
kubectl -n kube-system get pods -l component=kube-controller-manager
kubectl -n kube-system logs kube-scheduler-cp1 | tail`},
{note:'If the controller manager is down, existing Pods run but nothing self-heals: a deleted Pod is not replaced, a Deployment change does nothing and failed nodes are not detected. If the scheduler is down, new Pods stay Pending.'}],
src:[['Kubernetes Scheduler',C+'scheduling-eviction/kube-scheduler/'],['Controllers',C+'architecture/controller/'],['kube-controller-manager reference',R+'command-line-tools-reference/kube-controller-manager/']]};

/* ---------- 3: Node components and add-ons ---------- */
L['k8s:2:3']={blocks:[
{p:'Every worker node runs a small set of components that turn Pod objects into running containers and make them reachable. A working cluster also needs add-ons for networking and DNS.'},
{h:'kubelet'},
{ul:['Runs as a **systemd service**, not as a Pod, because it must start Pods.','Watches the API server for Pods assigned to its node, plus static Pod manifests on disk.','Tells the container runtime to create containers, runs probes, mounts volumes and reports Pod and node status.','Registers the node, sends heartbeats (Lease objects) and reports capacity.']},
{code:`systemctl status kubelet
journalctl -u kubelet -f
sudo cat /var/lib/kubelet/config.yaml          # KubeletConfiguration
sudo cat /etc/kubernetes/kubelet.conf          # how kubelet reaches the API server`},
{h:'Container runtime'},
{p:'The kubelet talks to the runtime (containerd or CRI-O) through the **CRI**. Docker Engine itself is not a supported runtime; containers built with Docker run fine because images follow the OCI standard.'},
{h:'kube-proxy'},
{p:'Implements Services on each node. It watches Services and EndpointSlices and programs kernel rules (iptables by default, or IPVS, or nftables) so traffic to a Service IP is spread across Pod IPs. Some network plugins, such as Cilium, can replace it.'},
{h:'Required add-ons'},
{t:[['Add-on','Why it is needed','Without it'],
['**CNI plugin** (Calico, Cilium, Flannel, ...)','Gives Pods IPs and routes between nodes','Nodes NotReady, Pods stuck ContainerCreating'],
['**CoreDNS**','Resolves `my-svc.my-ns.svc.cluster.local`','Pods cannot find Services by name'],
['**metrics-server** (optional but common)','Resource metrics for `kubectl top` and autoscaling','No `kubectl top`, no HPA']]},
{h:'Check a healthy node'},
{code:`kubectl get nodes -o wide
kubectl describe node worker1 | sed -n '/Conditions:/,/Addresses:/p'
kubectl -n kube-system get pods -o wide
kubectl -n kube-system get ds                  # kube-proxy and CNI are usually DaemonSets`},
{h:'Node conditions'},
{ul:['**Ready** is True when the kubelet is healthy and the node can accept Pods.','`MemoryPressure`, `DiskPressure`, `PIDPressure` become True when thresholds are crossed and trigger Pod eviction.','`NetworkUnavailable` is set by the CNI or cloud controller.']},
{note:'A node showing NotReady almost always means the kubelet, the runtime or the CNI is unhealthy. Start with `systemctl status kubelet` and `journalctl -u kubelet` on that node.'}],
src:[['Node Components',C+'architecture/#node-components'],['kubelet reference',R+'command-line-tools-reference/kubelet/'],['Nodes',C+'architecture/nodes/'],['Addons',C+'cluster-administration/addons/']]};

/* ---------- 4: Static pods ---------- */
L['k8s:2:4']={blocks:[
{p:'**Static Pods** are Pods managed directly by the kubelet on one node, defined by files on disk. They are how kubeadm runs the control plane: the kubelet starts the API server, scheduler, controller manager and etcd before any API server exists.'},
{h:'How they work'},
{ul:['The kubelet watches a directory, `staticPodPath` in its config, normally `/etc/kubernetes/manifests`.','Any Pod YAML placed there is started. Remove the file and the Pod stops. Edit the file and the Pod is recreated.','The kubelet creates a read-only **mirror Pod** in the API so you can see it with `kubectl get pods`. Deleting the mirror Pod does nothing; delete the file.','Static Pod names get the node name appended, for example `kube-apiserver-cp1`.']},
{code:`grep staticPodPath /var/lib/kubelet/config.yaml
ls /etc/kubernetes/manifests
# etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml

# Create your own static Pod on this node
sudo tee /etc/kubernetes/manifests/static-web.yaml <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: static-web
spec:
  containers:
  - name: web
    image: nginx:1.27
EOF
kubectl get pods -A | grep static-web`},
{h:'Why this matters to an admin'},
{ul:['**Changing a control plane flag**: edit the manifest. The kubelet restarts the component automatically. A typo can take the API server down, so keep a backup copy outside the manifests directory.','**Fixing a broken control plane** when kubectl does not work: go to the node and read container logs with `crictl`.','**Never** keep backup files in the manifests directory. The kubelet may try to start them.']},
{code:`# Safe edit pattern
sudo cp /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml.bak
sudo vim /etc/kubernetes/manifests/kube-apiserver.yaml
sudo crictl ps | grep kube-apiserver          # wait for the new container
kubectl get nodes`},
{note:'Version note: in recent Kubernetes releases a static Pod may not reference other API objects such as Secrets and ConfigMaps (for example through volumes or environment references), because it must run without the API server. Embed values in the manifest or use host paths. Check the release notes for the exact version where your cluster enforces this.'}],
src:[['Create static Pods',T+'configure-pod-container/static-pod/'],['kubeadm implementation details',K.R+'setup-tools/kubeadm/implementation-details/']]};

/* ---------- 5: Certificates ---------- */
L['k8s:2:5']={blocks:[
{p:'Kubernetes components authenticate each other with **TLS certificates**. kubeadm creates a small PKI in `/etc/kubernetes/pki`. Expired or mismatched certificates are one of the most common reasons a self-managed cluster suddenly stops working.'},
{svg:pki},
{h:'What lives in /etc/kubernetes/pki'},
{t:[['File','Purpose'],
['`ca.crt`, `ca.key`','Cluster CA. Signs the API server, kubelet client and admin certs. The key is the crown jewel.'],
['`apiserver.crt`','Serving certificate of the API server (SANs include its DNS names and IPs)'],
['`apiserver-kubelet-client.crt`','Client cert the API server uses to call kubelets'],
['`apiserver-etcd-client.crt`','Client cert the API server uses to call etcd'],
['`etcd/ca.crt`, `etcd/server.crt`, `etcd/peer.crt`','Separate CA and certs for etcd'],
['`front-proxy-ca.crt`, `front-proxy-client.crt`','Aggregation layer'],
['`sa.key`, `sa.pub`','Key pair used to sign and verify service account tokens (not X.509)']]},
{p:'Kubeconfig files in `/etc/kubernetes/` (`admin.conf`, `kubelet.conf`, `controller-manager.conf`, `scheduler.conf`) embed client certificates for those components.'},
{h:'Lifetimes'},
{ul:['Most kubeadm leaf certificates are valid for **1 year** and are renewed automatically when you run `kubeadm upgrade`.','CA certificates are valid for **10 years**.','Kubelet client and serving certificates can be rotated automatically when enabled.']},
{h:'Check and renew'},
{code:`sudo kubeadm certs check-expiration
sudo kubeadm certs renew all              # then restart control plane static Pods
sudo kubeadm certs renew apiserver

# Inspect any certificate
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text | \\
  grep -E "Subject:|Issuer:|Not After|DNS:|IP Address:"`},
{p:'After renewing, the control plane components must reload them. Moving the manifests out of the directory and back, or restarting the kubelet, recreates the static Pods.'},
{h:'Troubleshooting pointers'},
{ul:['`x509: certificate has expired or is not yet valid`: renew, and check the system clock (NTP).','`x509: certificate is valid for ..., not ...`: the API server certificate lacks a SAN for the address you used. Add it with `kubeadm init phase certs apiserver` and `--apiserver-cert-extra-sans`.','`x509: certificate signed by unknown authority`: the kubeconfig has the wrong CA.']},
{note:'On managed clusters the provider handles control plane certificates. You still manage the certificates of your own applications, typically with cert-manager.'}],
src:[['PKI certificates and requirements',K.S+'best-practices/certificates/'],['Certificate Management with kubeadm',T+'administer-cluster/kubeadm/kubeadm-certs/'],['Manage TLS Certificates',T+'tls/']]};
})();
