/* LearnSphere - Kubernetes Administrator, Section 01: Introduction & Container Foundations.
   Lectures 0-4 are core, 5-7 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,R=K.R;

/* ---------- diagrams ---------- */
const container=K.dg(700,250,[
[10,10,330,230,'Virtual machine',1],[360,10,330,230,'Container',1],
[30,45,290,34,'App A + libraries',0],[30,89,290,34,'Guest operating system (full kernel)',0],[30,133,290,34,'Hypervisor',0],[30,177,290,40,'Host hardware',0],
[380,45,140,34,'App A',0],[535,45,140,34,'App B',0],[380,89,295,34,'Container runtime (namespaces + cgroups)',2],[380,133,295,34,'Host operating system (one shared kernel)',0],[380,177,295,40,'Host hardware',0]],
[]);

const loop=K.dg(700,230,[
[10,90,150,60,'You: apply YAML|(desired state)',0],
[210,90,150,60,'API server + etcd|stores the object',2],
[410,20,150,60,'Controller|compares desired vs actual',2],
[410,150,150,60,'Kubelet / nodes|run real Pods',0],
[600,90,90,60,'Actual|state',0]],
[[160,120,210,120],[360,110,410,60],[485,150,485,80],[560,180,600,130],[560,50,600,110]]);

const arch=K.dg(700,300,[
[10,10,420,150,'Control plane',1],[10,185,680,105,'Worker nodes',1],
[25,40,120,50,'kube-apiserver',2],[160,40,120,50,'etcd',0],[295,40,120,50,'scheduler',0],[25,100,200,45,'controller-manager',0],[240,100,175,45,'cloud-controller',0],
[25,215,200,60,'Node 1|kubelet + kube-proxy + runtime|Pod Pod',0],[250,215,200,60,'Node 2|kubelet + kube-proxy + runtime|Pod Pod',0],[475,215,200,60,'Node 3|kubelet + kube-proxy + runtime|Pod Pod',0],
[490,60,170,60,'kubectl / CI / users',0]],
[[490,90,145,90],[145,65,160,65],[225,160,125,215]]);

/* ---------- 0: Course overview ---------- */
L['k8s:0:0']={blocks:[
{p:'This course takes you from zero to a **production Kubernetes administrator**: someone who can build a cluster, run and secure workloads on it, keep it healthy through upgrades and failures, and find the cause when something breaks. The structure follows the domains of the **CKA (Certified Kubernetes Administrator)** exam, but the aim is real operations skill, not only passing a test. This first lecture explains how the course is organised and how to get the most out of it.'},
{h:'The route through the course'},
{flow:['Foundations and kubectl (Sections 1 and 2)','Architecture and installing a cluster with kubeadm (Sections 3 and 4)','Running workloads and controlling where they run (Sections 5 and 6)','Networking and storage (Sections 7 and 8)','Access control and hardening (Sections 9 and 10)','Upgrades, backups and extending the platform (Sections 11 and 12)','Troubleshooting, production readiness and the capstone (Sections 13 and 14)']},
{h:'The fourteen sections at a glance'},
{t:[['#','Section','After it you can'],
['1','Introduction & Container Foundations','Explain containers, desired state, the architecture and the release cycle'],
['2','Lab Setup & kubectl Essentials','Build a lab and use kubectl fluently'],
['3','Cluster Architecture & Components','Describe every control plane and node component and how they interact'],
['4','Installing a Cluster with kubeadm','Bootstrap, join and verify a cluster, including HA'],
['5','Workloads & Controllers','Run Pods, Deployments, StatefulSets, Jobs, configuration and probes'],
['6','Scheduling, Node Maintenance & Autoscaling','Control placement, drain nodes, scale automatically'],
['7','Services & Networking','Expose applications, DNS, Ingress, Gateway API, NetworkPolicy'],
['8','Storage','Volumes, PersistentVolumes, StorageClasses, snapshots'],
['9','Authentication, Authorization & RBAC','Design least-privilege access'],
['10','Cluster Hardening & Policy','Pod security, encryption, admission policy, audit'],
['11','Cluster Lifecycle','Upgrade, back up and restore, renew certificates'],
['12','Extending Kubernetes','Helm, Kustomize, CRDs and operators'],
['13','Monitoring, Logging & Troubleshooting','Diagnose broken clusters and workloads methodically'],
['14','Production Readiness & Capstone','Bring it all together and prepare for the exam']]},
{h:'How lectures are tagged'},
{t:[['Tag','Meaning','Where it applies'],
['**Self-managed**','You run the control plane yourself, typically with kubeadm','etcd, certificates, control plane upgrades, static Pods'],
['**Managed**','EKS, AKS or GKE run the control plane for you','Provider integration, node pools, shared responsibility'],
['**Both**','Applies everywhere','kubectl, Pods, Services, RBAC, scheduling, most troubleshooting']]},
{ul:['Lectures under **Additional content** are optional deep dives; the core path stands on its own.','Version notes mark features that changed recently, so you know when to check release notes.','Every lecture ends with sources in the official documentation.']},
{h:'How the sections map to the CKA exam'},
{t:[['CKA domain','Weight','Where it is taught'],
['Troubleshooting','30%','Section 13, plus fault-finding in every section'],
['Cluster Architecture, Installation & Configuration','25%','Sections 3, 4, 9, 11, 12'],
['Services & Networking','20%','Section 7'],
['Workloads & Scheduling','15%','Sections 5 and 6'],
['Storage','10%','Section 8']]},
{note:'Weights and the Kubernetes version of the exam change when the CNCF updates the curriculum. Confirm the current domains, duration and rules on the CNCF CKA page before you book.'},
{h:'How to study'},
{ul:['**Do, do not just read.** Almost every lecture has commands: run them on a lab cluster, and look at the output.','**Predict before you run.** In labs, write down what you expect; the learning is in the surprises.','**Break things deliberately.** Troubleshooting is a skill built by seeing failures, so inject faults and fix them.','**Use the quizzes** after each section; wrong answers point back to the lecture.','**Keep a repository** of your manifests and notes; the capstone reuses it.']},
{h:'Prerequisites self-check'},
{t:[['You should be able to','If not, spend a few hours on'],
['Use a Linux shell: `cd`, `ls`, `cat`, `grep`, edit a file with `vim` or `nano`','Linux command line basics'],
['Read and write YAML (indentation, lists, key and value)','A YAML primer'],
['Explain an IP address, port, DNS name and firewall','Networking basics'],
['Run a container with Docker or Podman','The next lecture covers the concepts']]},
{p:'If two or more of these feel shaky, spend a few hours there first. Everything else is built from scratch. A study plan, the capstone description and exam strategy are in the **Additional content** of this section.'}],
src:[['Kubernetes documentation',K.D],['CNCF: Certified Kubernetes Administrator','https://www.cncf.io/training/certification/cka/']]};

/* ---------- 1: Containers and images ---------- */
L['k8s:0:1']={blocks:[
{p:'Kubernetes schedules **containers**, so you need an accurate picture of what a container really is. The most useful correction is this: a container is **not a small virtual machine**. It is an ordinary Linux process that the kernel has been told to **isolate** and **limit**. Everything about container security, resource limits and the way Kubernetes behaves follows from that fact.'},
{svg:container},
{h:'Virtual machine versus container'},
{t:[['','Virtual machine','Container'],
['What it virtualises','Hardware: each VM runs a full guest operating system with its own kernel','The operating system view: all containers share the **host kernel**'],
['Start time','Tens of seconds to minutes','Milliseconds to seconds'],
['Size','Gigabytes','Megabytes to hundreds of megabytes'],
['Isolation','Strong: separate kernels','Weaker: shared kernel, isolation by namespaces and cgroups'],
['Density','Tens per host','Hundreds per host']]},
{p:'Because containers share the kernel, **a kernel vulnerability affects every container on the node**. That is why Section 10 spends time on Pod security, and why sandboxed runtimes exist for untrusted code.'},
{h:'Two kernel features make a container'},
{p:'**Namespaces** control what a process can **see**. **Control groups (cgroups)** control what it can **use**.'},
{t:[['Linux namespace','Isolates','Effect in a container'],
['`pid`','Process IDs','The container sees its own process tree; its first process is PID 1'],
['`net`','Network interfaces, routes, ports','Its own IP address, loopback and ports'],
['`mnt`','Mount points','Its own root filesystem (from the image)'],
['`uts`','Hostname','Its own hostname'],
['`ipc`','Shared memory and queues','Not shared with other containers'],
['`user`','User and group IDs','Root inside can map to an unprivileged user outside'],
['`cgroup`','View of the cgroup tree','Hides host resource accounting']]},
{note:'The word "namespace" means two unrelated things. A **Linux namespace** isolates what a process sees. A **Kubernetes namespace** only groups API objects. They share a name by coincidence.'},
{p:'**cgroups** meter and limit CPU, memory, I/O and process counts. When Kubernetes sets a memory limit, the runtime writes it into a cgroup and the kernel kills the process if it exceeds it (an OOM kill, exit code 137). A CPU limit slows the process instead (throttling). Modern distributions use **cgroup v2**, a single unified hierarchy.'},
{h:'See it yourself on any Linux host'},
{code:`# Start a shell in its own PID and UTS namespaces
$ sudo unshare --pid --uts --fork --mount-proc bash
# hostname demo ; ps aux                         # only a handful of processes are visible
# exit

$ ls -l /proc/$$/ns                              # the namespaces of the current shell
$ stat -fc %T /sys/fs/cgroup                     # cgroup2fs means cgroup v2
$ cat /sys/fs/cgroup/memory.max                  # a limit file (inside a container it shows the container limit)`},
{h:'OCI images: what a container starts from'},
{p:'The **Open Container Initiative (OCI)** defines the image and runtime formats so that tools are interchangeable: an image built by Docker runs under containerd or CRI-O. An image consists of:'},
{ul:['**Layers**: compressed filesystem changes, stacked read-only. Shared layers are stored and pulled once, which saves space and time.','**Config**: the default command, environment variables, working directory, user and exposed ports.','**Manifest**: lists the config and layers by digest.','**Digest**: a `sha256:` hash of the content. A **tag** (`nginx:1.27`) is a movable label; a digest never changes.']},
{code:`registry.example.com:5000/team/web:1.4.2            # tag: can be re-pushed to point at different content
registry.example.com:5000/team/web@sha256:3f1c...   # digest: always the same bytes
nginx                                              # shorthand for docker.io/library/nginx:latest`},
{h:'Registries and good habits'},
{ul:['A **registry** stores and serves images (Docker Hub, GHCR, ECR, ACR, Harbor).','Use **explicit version tags**, never `latest`, for anything beyond experiments; pin by **digest** for production or verify signatures.','Private registries need credentials: in Kubernetes an `imagePullSecret` (Section 5).','Keep images **small and minimal** (fewer files, fewer vulnerabilities) and run as a **non-root** user.']},
{h:'Common misunderstandings'},
{t:[['Belief','Reality'],
['"A container has its own operating system"','It has its own filesystem and view, but uses the host kernel'],
['"Root in a container is harmless"','Root with a shared kernel is dangerous unless capabilities, seccomp or user namespaces limit it'],
['"The container filesystem is persistent"','It is recreated from the image on restart: use volumes for data'],
['"Tag `1.27` always means the same image"','Tags can move; digests cannot']]},
{note:'Everything Kubernetes does to a container, it does through these two kernel features and the image format: starting a process, giving it a network and a filesystem, and limiting its resources.'}],
src:[['Containers',C+'containers/'],['Images',C+'containers/images/'],['About cgroup v2',C+'architecture/cgroups/'],['OCI Image Specification','https://github.com/opencontainers/image-spec']]};

/* ---------- 2: What is Kubernetes ---------- */
L['k8s:0:2']={blocks:[
{p:'Kubernetes is an open source system for running containerized applications across a group of machines. Its defining idea is simple but easy to miss: you do not tell it **how** to do things step by step. You declare **what you want**, store that in the cluster, and a set of **controllers** works continuously to make reality match. Once you really understand this, the rest of Kubernetes becomes predictable.'},
{h:'Problems it solves'},
{t:[['Problem','Without Kubernetes','With Kubernetes'],
['Where should this container run?','A person or a script picks a machine','The **scheduler** places it based on resources and rules'],
['A process or machine dies','Someone notices and restarts it','Controllers **recreate** it, usually in seconds'],
['More load','Manually add machines and copies','Change a number, or let an autoscaler do it'],
['Updating without downtime','Careful manual rolling','**Rolling updates** with automatic rollback support'],
['Finding services that move','Hard-coded addresses','**Services** and DNS give stable names'],
['Configuration and secrets','Files on machines','**ConfigMaps** and **Secrets**, injected into Pods']]},
{h:'Desired state and the control loop'},
{p:'Everything you create is an **API object**. Most objects have a **`spec`** (the state you **want**, written by you) and a **`status`** (the state **observed**, written by controllers). A **controller** is a loop that watches objects and acts to close the gap between spec and reality.'},
{svg:loop},
{flow:['You apply a Deployment asking for 3 replicas','The API server validates it and stores it in etcd','The Deployment controller sees no ReplicaSet and creates one','The ReplicaSet controller sees 0 of 3 Pods and creates 3 Pod objects','The scheduler assigns each Pod to a node','The kubelet on each node starts the containers and reports status']},
{p:'If a node dies and a Pod disappears, the same loop notices 2 of 3 exist and creates another. Nobody runs a repair command. That is what **declarative** and **self-healing** mean in practice. Kubernetes is also **level-triggered**: it reacts to the **current state**, not to a remembered event, so a controller that was down simply catches up when it returns.'},
{h:'Anatomy of an object'},
{code:`apiVersion: apps/v1          # API group and version
kind: Deployment             # the type of object
metadata:
  name: web                  # unique within a namespace for this kind
  namespace: shop
  labels: {app: web}         # key/value tags used for selection
spec:                        # DESIRED state (you write this)
  replicas: 3
  selector: {matchLabels: {app: web}}
  template:                  # the Pod each replica is built from
    metadata: {labels: {app: web}}
    spec:
      containers:
      - name: web
        image: nginx:1.27
# status:  is added and updated by controllers (you do not write it)`},
{code:`$ kubectl get deployment web -n shop -o yaml | sed -n '/^status:/,$p'
status:
  availableReplicas: 3
  readyReplicas: 3
  replicas: 3
  conditions:
  - type: Available
    status: "True"
$ kubectl scale deployment web -n shop --replicas=5      # change the desired state; controllers do the rest
$ kubectl get pods -n shop -w                            # watch the loop converge to 5`},
{h:'Declarative versus imperative thinking'},
{t:[['Imperative (commands)','Declarative (desired state)'],
['"Start 3 containers, then add a load balancer"','"There should be 3 replicas behind a Service"'],
['You track what has been done','The system tracks the difference'],
['Re-running may duplicate or fail','Re-applying is **safe** (idempotent)'],
['Failure handling is your job','Reconciliation is continuous']]},
{h:'What Kubernetes is not'},
{ul:['**Not a PaaS**: it does not build your code or provide databases and message brokers for you.','**Not a monitoring or logging system**: it exposes the hooks; you add the tools.','**Not automatic high availability**: you must run several replicas, spread them, set probes and budgets.','**Not magic**: every behaviour is a controller you can find and read about.']},
{note:'A habit that pays off in every section: when something is wrong, ask **what is the desired state and which controller is responsible for reconciling it?** That tells you where to look.'}],
src:[['Kubernetes Overview',K.D+'concepts/overview/'],['Objects in Kubernetes',C+'overview/working-with-objects/'],['Controllers',C+'architecture/controller/']]};

/* ---------- 3: Architecture at a glance ---------- */
L['k8s:0:3']={blocks:[
{p:'A Kubernetes **cluster** is a set of machines called **nodes**. The **control plane** makes global decisions and holds the cluster state; **worker nodes** run your Pods. This lecture is a **map**: it names every component and shows how a single command travels through them. Section 3 then examines each one in detail.'},
{svg:arch},
{h:'Control plane components'},
{t:[['Component','Role','If it fails'],
['`kube-apiserver`','The front door: every client and component talks to it over REST; authenticates, authorizes, validates and stores objects','Nothing can be managed; running containers keep running'],
['`etcd`','Consistent key-value database holding all cluster state','Cluster state unavailable or lost'],
['`kube-scheduler`','Picks a node for each new Pod','New Pods stay Pending'],
['`kube-controller-manager`','Runs the built-in controllers (Deployment, Node, Job and more)','No healing, no rollouts'],
['`cloud-controller-manager`','Optional: integrates with a cloud (load balancers, nodes, routes)','Cloud integration stops']]},
{h:'Node components'},
{t:[['Component','Role'],
['`kubelet`','Agent on every node: starts and monitors Pods, mounts volumes, runs probes, reports status'],
['Container runtime','containerd or CRI-O: pulls images and runs containers through the CRI'],
['`kube-proxy`','Programs node rules so Services reach Pods (some CNIs replace it)'],
['CNI plugin','Gives Pods IP addresses and connects them across nodes'],
['CoreDNS','Cluster DNS: Pods find Services by name']]},
{h:'Following one command through the cluster'},
{code:`kubectl create deployment web --image=nginx:1.27 --replicas=2`},
{flow:['kubectl sends an HTTPS request to the API server','The API server authenticates, authorizes, runs admission and writes the Deployment to etcd','The Deployment and ReplicaSet controllers create a ReplicaSet and two Pod objects','The scheduler binds each Pod to a node','The kubelet on each node asks the runtime to pull the image and start the containers','The CNI plugin gives each Pod an IP; kube-proxy and CoreDNS make a Service reachable by name']},
{code:`$ kubectl get pods -o wide -w
NAME                  READY   STATUS              NODE
web-6d4f8b7c9-4xk2p   0/1     Pending             <none>      # created, not yet scheduled
web-6d4f8b7c9-4xk2p   0/1     ContainerCreating   worker1     # scheduled, image being pulled
web-6d4f8b7c9-4xk2p   1/1     Running             worker1     # running
$ kubectl get events --sort-by=.lastTimestamp | tail -n 5       # Scheduled, Pulling, Pulled, Created, Started`},
{h:'Communication rules'},
{ul:['All communication goes **through the API server** (hub and spoke): components do not talk to each other directly, except that the API server calls kubelets for logs and exec.','Components **watch** the API server for changes rather than polling.','Only the API server talks to **etcd**.','Everything is authenticated with **TLS certificates** or tokens.']},
{h:'Where things run'},
{t:[['Environment','Control plane','Nodes'],
['**kubeadm (self-managed)**','Static Pods on control plane nodes: you operate them','Machines you build and patch'],
['**EKS, AKS, GKE (managed)**','Hidden: the provider operates it, you see only the API endpoint','Node pools you configure'],
['**kind or minikube (lab)**','Containers or a VM on your laptop','Containers or VMs']]},
{p:'Control plane nodes normally carry a **taint** so ordinary workloads do not run beside the control plane components.'},
{h:'What survives a failure'},
{t:[['Failure','Effect on running applications'],
['Control plane down','Containers keep running; no new changes, no healing'],
['One worker down','Its Pods are rebuilt on other workers after a delay (about five minutes by default)'],
['etcd data lost without backup','Cluster definition gone; containers keep running until restarted']]},
{note:'Use this map as an index: every later lecture picks one box and explains it. If you lose track, come back and ask which component the current symptom points at.'}],
src:[['Cluster Architecture',C+'architecture/'],['Kubernetes Components',C+'overview/components/']]};

/* ---------- 4: Releases ---------- */
L['k8s:0:4']={blocks:[
{p:'Kubernetes moves fast: a new minor version roughly **every four months**, and old ones fall out of support. As an administrator you must understand the **release rhythm**, how to read a version, what is supported and what you must do about it, because it determines how often you upgrade and which features you can rely on.'},
{h:'Reading a version'},
{p:'Versions look like **`v1.37.1`**: major `1`, **minor `37`**, **patch `1`**.'},
{t:[['Part','Changes when','Contains','Risk when upgrading'],
['**Major**','Practically never (still 1)','-','-'],
['**Minor** (1.36 to 1.37)','About three times a year','New features, deprecations, removals','Needs planning: read release notes'],
['**Patch** (1.37.0 to 1.37.1)','Regularly (about monthly)','Bug and **security** fixes only','Low: apply promptly']]},
{h:'Cadence and support'},
{ul:['About **three minor releases per year**, roughly every four months.','The project maintains the **three most recent minor versions**; each receives about **one year of patch support**.','Patch releases arrive regularly for every supported minor, including security fixes.','You may **not skip minor versions** when upgrading (Section 11): 1.34 to 1.37 means three upgrades.']},
{p:'At the time this lecture was written, **1.37** was the newest minor release (1.37.1 was published on 2026-09-15), with 1.36 and 1.35 supported and 1.34 reaching end of life on 2026-10-27. **Always check the official releases page** for the current table: it is the authority, and dates change.'},
{h:'The lifecycle of a feature'},
{t:[['Stage','Meaning','Enabled by default?','Should you use it?'],
['**Alpha**','Experimental; may change or disappear; bugs likely','No (behind a feature gate)','Only to experiment'],
['**Beta**','Mostly stable; API may still change','Depends on the feature','With care, in non-critical use'],
['**Stable (GA)**','Supported long term with compatibility promises','Yes','Yes']]},
{p:'Lectures in this course carry **version notes** where behaviour changed recently, for example the end of containerd 1.x support or a feature that graduated to GA. When a lecture says a feature became stable in a given release, an older cluster may lack it.'},
{h:'Deprecation and removal'},
{ul:['An API version is first **deprecated** (it still works, with warnings), then **removed** in a later release.','Stable APIs must stay available for a long time after deprecation; beta and alpha APIs may be removed sooner.','When removed, manifests using the old version fail: `no matches for kind "X" in version "...beta1"`. Fix them **before** upgrading (Section 11).']},
{h:'Check what you are running'},
{code:`$ kubectl version
Client Version: v1.37.1
Server Version: v1.37.1
$ kubectl get nodes
NAME      STATUS   ROLES           VERSION
cp1       Ready    control-plane   v1.37.1
worker1   Ready    <none>          v1.36.4          # one minor behind: allowed, but plan to catch up
$ kubeadm version -o short
$ kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis | head -n 3      # clients using deprecated APIs`},
{h:'What to do as an administrator'},
{t:[['Task','How often'],
['Apply **patch** releases','Regularly, within weeks'],
['Plan a **minor** upgrade','At least a few times a year; keep inside the supported window'],
['Read release notes of every minor you cross','Every upgrade'],
['Check **add-on** compatibility (CNI, CSI, ingress, policy engines)','Every upgrade'],
['Track the **end-of-life** date of your version','Continuously']]},
{h:'Common mistakes'},
{ul:['Treating the cluster as "done" after installation: unpatched clusters accumulate vulnerabilities.','Falling several minors behind, then facing many removals at once.','Assuming a managed service upgrades everything: add-ons and node pools often need your action.','Learning from material written for an older version and not checking changed behaviour.']},
{note:'The CKA exam is aligned to a specific Kubernetes minor version. Practise on the version the CNCF lists, and read the release notes for features added since.'}],
src:[['Releases','https://kubernetes.io/releases/'],['Version Skew Policy','https://kubernetes.io/releases/version-skew-policy/'],['Deprecation Policy',K.D+'reference/using-api/deprecation-policy/']]};

/* ---------- Additional content ---------- */
/* 5: Study plan */
L['k8s:0:5']={blocks:[
{p:'This lecture gives you a realistic **study plan**, describes the **capstone** and explains how to approach a performance-based exam such as the CKA. Adjust the pace to your own schedule: the order matters more than the speed.'},
{h:'A ten-week plan (about 8 to 10 hours a week)'},
{t:[['Week','Sections','Focus','Hands-on goal'],
['1','1, 2','Containers, desired state, kubectl fluency','Build a kind cluster; do every task with `--dry-run=client -o yaml`'],
['2','3, 4','Architecture and kubeadm install','Build a 3-node kubeadm cluster from scratch, twice'],
['3','5','Workloads and probes','Deploy, update, break and roll back an app'],
['4','6','Scheduling, drain, autoscaling','Taints, affinity, drain a node, HPA under load'],
['5','7','Services, DNS, Ingress, NetworkPolicy','Expose an app and lock it down'],
['6','8, 9','Storage and RBAC','PVC survives Pod deletion; least-privilege user'],
['7','10, 12','Hardening, Helm, Kustomize, CRDs','PSA labels, encryption at rest, a Helm release'],
['8','11','Upgrades, etcd backup and restore','Snapshot, restore, upgrade one minor'],
['9','13','Troubleshooting','Timed break/fix scenarios daily'],
['10','14','Capstone and exam rehearsal','Full mock exam under time limit']]},
{h:'Capstone project'},
{p:'In Section 14 you build a cluster with kubeadm, deploy and secure a small application, take an etcd backup, upgrade by one minor version, fix injected faults and restore. Start a **repository** now with your kubeadm config, manifests and notes, so the capstone reuses your own work.'},
{h:'The CKA exam: how to approach it'},
{ul:['It is **performance-based**: you work on live clusters in a terminal, not multiple-choice. The CNCF page states the current duration, domains and Kubernetes version; check it before booking.','Tasks have different weights. **Read the whole task**, note the points, and start with the cheap and certain ones.','Each task names a **context** to use. Run the provided command every time.','Allowed documentation is the official Kubernetes site. Practise finding pages quickly (see the docs lecture in Section 2).','Use `--dry-run=client -o yaml`, `kubectl explain` and `kubectl create` instead of typing YAML from scratch.','**Verify** each result with a read-only command before moving on.','If stuck for a few minutes, flag the task and return later.']},
{h:'Terminal habits to build early'},
{code:`alias k=kubectl
source <(kubectl completion bash); complete -o default -F __start_kubectl k
export do="--dry-run=client -o yaml"
export now="--force --grace-period=0"
# vim: set shiftwidth=2 tabstop=2 expandtab  (put in ~/.vimrc)`},
{note:'Do not memorise a long list of facts. Practise the same ten workflows (create, expose, schedule, drain, back up, restore, upgrade, RBAC, PV, fix a node) until they are routine.'}],
src:[['CNCF: Certified Kubernetes Administrator','https://www.cncf.io/training/certification/cka/'],['kubectl Quick Reference',K.R+'kubectl/quick-reference/'],['Kubernetes documentation',K.D]]};

/* 6: Container runtimes */
L['k8s:0:6']={blocks:[
{p:'The kubelet does not start containers itself. It talks to a **container runtime** through the **Container Runtime Interface (CRI)**. The runtime pulls images, creates containers and reports their state.'},
{flow:['kubelet receives a Pod to run','kubelet calls the CRI runtime service (gRPC over a Unix socket)','High-level runtime (containerd or CRI-O) pulls the image and manages the sandbox','Low-level runtime (runc) creates the container using namespaces and cgroups','CNI plugin gives the Pod sandbox its network']},
{h:'The pieces'},
{t:[['Component','Role'],
['**OCI** (Open Container Initiative)','Specifications for the image format and the runtime, so tools are interchangeable'],
['**runc**','Reference low-level runtime that actually creates containers'],
['**containerd**','High-level runtime: images, snapshots, container lifecycle. Used by most clusters'],
['**CRI-O**','A runtime built only for Kubernetes, popular on OpenShift and some distributions'],
['**Docker Engine**','Not a CRI runtime itself; dockershim was removed from the kubelet. Images built with Docker still run everywhere because they follow the OCI format'],
['**Sandboxed runtimes** (gVisor, Kata)','Alternative low-level runtimes with stronger isolation, selected per Pod with a RuntimeClass']]},
{h:'crictl: the node-level tool'},
{p:'`crictl` speaks CRI directly. It works when `kubectl` does not, which is why it is essential for control plane troubleshooting.'},
{code:`# /etc/crictl.yaml
runtime-endpoint: unix:///run/containerd/containerd.sock
image-endpoint: unix:///run/containerd/containerd.sock

sudo crictl ps                       # running containers
sudo crictl ps -a                    # including exited
sudo crictl pods                     # Pod sandboxes
sudo crictl logs <container-id>
sudo crictl inspect <container-id> | head
sudo crictl images
sudo crictl pull nginx:1.27
sudo crictl exec -it <container-id> sh
sudo crictl stats`},
{ul:['`ctr` and `nerdctl` are containerd-specific CLIs. In the **k8s.io** containerd namespace you see Kubernetes containers: `sudo ctr -n k8s.io containers ls`.','`docker ps` will show nothing on a containerd node.','The runtime socket path differs by runtime (`/run/containerd/containerd.sock`, `/var/run/crio/crio.sock`).']},
{note:'A kubelet reporting `container runtime is down` means it cannot reach the socket. Check `systemctl status containerd` and the socket path in the kubelet configuration.'}],
src:[['Container Runtimes',K.S+'production-environment/container-runtimes/'],['Container Runtime Interface',K.C+'architecture/cri/'],['Debugging Kubernetes nodes with crictl',K.T+'debug/debug-cluster/crictl/']]};

/* 7: Linux refresher */
L['k8s:0:7']={blocks:[
{p:'A self-managed cluster is Linux first and Kubernetes second. These skills solve many node-level problems in minutes.'},
{h:'systemd and logs'},
{code:`systemctl status kubelet
sudo systemctl restart kubelet
sudo systemctl enable --now containerd
systemctl list-units --type=service --state=failed
journalctl -u kubelet -n 100 --no-pager
journalctl -u kubelet -f                         # follow
journalctl -u kubelet --since "15 min ago" -p err
sudo systemctl daemon-reload                     # after editing unit files`},
{h:'Processes and resources'},
{code:`ps aux --sort=-%mem | head
top -o %CPU            # or htop
free -h ; df -h ; df -i
ss -tlnp | grep -E "6443|2379|10250"             # who listens on which port
lsof -i :6443
dmesg -T | tail                                  # kernel messages (OOM kills)`},
{h:'Files, permissions and ownership'},
{code:`ls -l /etc/kubernetes/pki
sudo chmod 600 /etc/kubernetes/admin.conf
sudo chown root:root /etc/kubernetes/manifests/*.yaml
find /etc/kubernetes -name "*.conf"
grep -rn "server:" /etc/kubernetes/*.conf
sudo tail -f /var/log/pods/*/*/*.log`},
{h:'Networking basics'},
{code:`ip addr ; ip route                               # interfaces and routes
ip link show type bridge
ss -s ; nc -zv 192.168.56.10 6443                # test a TCP port
curl -k https://127.0.0.1:6443/livez
dig +short kubernetes.default.svc.cluster.local @10.96.0.10
sudo iptables -t nat -L -n | head -30            # kube-proxy rules (iptables mode)
sudo nft list ruleset | head -30                 # nftables mode
cat /etc/resolv.conf`},
{h:'Kernel settings used by Kubernetes'},
{code:`lsmod | grep -E "overlay|br_netfilter"
sysctl net.ipv4.ip_forward net.bridge.bridge-nf-call-iptables
swapon --show
stat -fc %T /sys/fs/cgroup                       # cgroup2fs = cgroup v2
timedatectl                                      # clock sync matters for certificates`},
{h:'Editing and text tools you will use constantly'},
{ul:['`vim` basics: `i` insert, `Esc`, `:wq`, `:q!`, `/text` search, `dd` delete line, `yy` and `p` copy and paste, `:set paste` before pasting YAML.','`grep -E`, `awk`, `sed -i`, `cut`, `sort | uniq -c`, `jq` for JSON.','`tmux` or multiple terminals to keep logs open while you change things.']},
{note:'Always make a backup before editing a system file: `sudo cp file file.bak` (outside the static Pod manifests directory for manifests).'}],
src:[['Troubleshooting kubeadm',K.S+'production-environment/tools/kubeadm/troubleshooting-kubeadm/'],['Installing kubeadm: before you begin',K.S+'production-environment/tools/kubeadm/install-kubeadm/#before-you-begin']]};
})();
