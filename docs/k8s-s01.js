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
{p:'This course takes you from zero to a **production Kubernetes administrator**. You will understand how the cluster works inside, build one with kubeadm, run and schedule workloads, wire up networking and storage, lock the cluster down, upgrade and back it up, and troubleshoot it under pressure. The structure follows the **CKA (Certified Kubernetes Administrator)** exam domains, but the goal is real operations skill, not only a pass mark.'},
{h:'Course roadmap'},
{flow:['Foundations and kubectl','Architecture and kubeadm install','Workloads and scheduling','Networking and storage','Security, RBAC and hardening','Upgrades, backup, troubleshooting']},
{h:'The fourteen sections at a glance'},
{t:[['#','Section','What you will be able to do'],
['1','Introduction & Container Foundations','Explain containers, desired state and the cluster at a glance'],
['2','Lab Setup & kubectl Essentials','Build a lab and drive the API fluently with kubectl'],
['3','Cluster Architecture & Components','Describe every control plane and node component'],
['4','Installing a Cluster with kubeadm','Bootstrap, join and verify a cluster'],
['5','Workloads & Controllers','Run Pods, Deployments, Jobs, config and probes'],
['6','Scheduling, Node Maintenance & Autoscaling','Control placement, drain nodes, scale'],
['7','Services & Networking','Services, DNS, Ingress, Gateway API, NetworkPolicy'],
['8','Storage','Volumes, PersistentVolumes, StorageClasses'],
['9','Authentication, Authorization & RBAC','Design least-privilege access'],
['10','Cluster Hardening & Policy','Pod security, secrets, audit, supply chain'],
['11','Cluster Lifecycle','Upgrade, back up etcd, maintain nodes'],
['12','Extending Kubernetes','Helm, Kustomize, CRDs and operators'],
['13','Monitoring, Logging & Troubleshooting','Diagnose broken clusters and workloads'],
['14','Production Readiness & Capstone','Bring it all together']]},
{h:'How each lecture is tagged'},
{ul:['**Self-managed**: you run the control plane yourself, typically with kubeadm. Applies to etcd, certificates, control plane upgrades.','**Managed**: EKS, AKS or GKE run the control plane for you. You still own workloads, nodes (or node pools), networking and access.','**Both**: applies everywhere, for example kubectl, Pods, Services and RBAC.','Lectures under **Additional content** are optional deep dives. The core path stands on its own.']},
{h:'How the course maps to the CKA exam'},
{t:[['CKA domain','Weight','Where it is taught'],
['Troubleshooting','30%','Section 13, plus fault-finding tips in every section'],
['Cluster Architecture, Installation & Configuration','25%','Sections 3, 4, 9, 11, 12'],
['Services & Networking','20%','Section 7'],
['Workloads & Scheduling','15%','Sections 5, 6'],
['Storage','10%','Section 8']]},
{note:'Exam weights change when the CNCF updates the curriculum. Always confirm the current domains and the Kubernetes version of the exam on the CNCF CKA page before you book.'},
{h:'Prerequisites self-check'},
{ul:['You can use a Linux shell: `cd`, `ls`, `cat`, `grep`, editing a file with `vim` or `nano`.','You have seen YAML: indentation, lists and key/value pairs.','You know what an IP address, port, DNS name and firewall are.','You have run a container with Docker or Podman at least once (the next lecture covers the concepts if not).']},
{p:'If two or more feel shaky, spend a few hours on them first. Everything else is built from scratch.'}],
src:[['Kubernetes documentation',K.D],['CNCF: Certified Kubernetes Administrator','https://www.cncf.io/training/certification/cka/']]};

/* ---------- 1: Containers and images ---------- */
L['k8s:0:1']={blocks:[
{p:'Kubernetes schedules **containers**, so you need an accurate picture of what a container really is. A container is **not** a small virtual machine. It is an ordinary Linux process that the kernel has been told to isolate and limit.'},
{svg:container},
{h:'Namespaces: what a process can see'},
{p:'Linux **namespaces** give a process its own view of a system resource. A container usually gets its own set of them.'},
{t:[['Namespace','Isolates'],['`pid`','Process IDs: the container sees its own process tree starting at PID 1'],['`net`','Network interfaces, routes, ports and iptables rules'],['`mnt`','Mount points and the root filesystem'],['`uts`','Hostname'],['`ipc`','Shared memory and message queues'],['`user`','User and group IDs (root in the container can map to an unprivileged host user)'],['`cgroup`','The view of the cgroup hierarchy']]},
{note:'These are Linux namespaces. They are unrelated to Kubernetes namespaces, which are a way of grouping API objects. The same word means two different things.'},
{h:'cgroups: what a process can use'},
{p:'**Control groups (cgroups)** meter and limit CPU, memory, disk I/O and process counts. When Kubernetes sets a memory limit on a container, the runtime writes that limit into a cgroup, and the kernel kills the process (OOM kill) if it goes over. Modern distributions use **cgroup v2**, a single unified hierarchy.'},
{h:'OCI images'},
{p:'The **Open Container Initiative (OCI)** defines the image and runtime formats so any compliant tool can build or run the same image. An image consists of:'},
{ul:['**Layers**: compressed filesystem changes, stacked read-only. Shared layers are stored and pulled once.','**Config**: the default command, environment variables, user and exposed ports.','**Manifest**: lists the config and layers by digest.','**Digest**: a `sha256:` hash of the content. A tag such as `nginx:1.27` can move; a digest never does.']},
{h:'Registries and image references'},
{p:'A **registry** stores and serves images. A full reference looks like this:'},
{code:`registry.example.com:5000/team/web:1.4.2          # tag (mutable)
registry.example.com:5000/team/web@sha256:3f1c...  # digest (immutable)
nginx                                             # shorthand for docker.io/library/nginx:latest`},
{ul:['Prefer **explicit version tags** over `latest`, which makes rollbacks and debugging guesswork.','For production, pin by **digest** or use a policy that verifies image signatures.','Private registries need credentials. Kubernetes supplies them with an `imagePullSecret` (covered in Section 5).']},
{h:'See it on a Linux host'},
{code:`# Start a process in its own PID and UTS namespaces
sudo unshare --pid --uts --fork --mount-proc bash
hostname demo ; ps aux          # only a handful of processes are visible

# Look at the namespaces of any process
ls -l /proc/$$/ns

# Check which cgroup version this host uses
stat -fc %T /sys/fs/cgroup      # cgroup2fs means cgroup v2`},
{note:'Because containers share the host kernel, a kernel vulnerability affects every container on the node. This is why Section 10 spends time on Pod security and node hardening.'}],
src:[['Containers',C+'containers/'],['Images',C+'containers/images/'],['About cgroup v2',C+'architecture/cgroups/'],['OCI Image Specification','https://github.com/opencontainers/image-spec']]};

/* ---------- 2: What is Kubernetes ---------- */
L['k8s:0:2']={blocks:[
{p:'**Kubernetes** is an open source system for running containerized applications across a group of machines. Instead of telling it how to do things step by step, you declare what you want, and it works continuously to make reality match.'},
{h:'What problems it solves'},
{ul:['**Placement**: decide which machine runs each container.','**Self-healing**: restart failed containers and replace Pods on failed nodes.','**Scaling**: add or remove replicas by changing a number.','**Rollouts**: update an application gradually and roll back if it breaks.','**Service discovery and load balancing**: stable names for changing Pods.','**Configuration and storage**: inject settings, secrets and volumes.']},
{h:'Desired state and the control loop'},
{p:'Everything you create is an **API object** with a `spec` (the state you want) and a `status` (the state observed). A **controller** is a loop that watches objects and acts to close the gap between the two.'},
{svg:loop},
{flow:['You apply a Deployment asking for 3 replicas','API server validates it and stores it in etcd','Deployment controller sees 0 of 3 exist and creates a ReplicaSet','ReplicaSet controller creates 3 Pod objects','Scheduler assigns each Pod to a node','Kubelet on each node starts the containers']},
{p:'If a node dies and a Pod disappears, the same loop notices 2 of 3 exist and creates another. Nobody has to run a repair command. This is why Kubernetes is called **declarative** and **level-triggered**: it reacts to the current state, not just to events.'},
{h:'Anatomy of an API object'},
{code:`apiVersion: apps/v1        # API group and version
kind: Deployment           # object type
metadata:
  name: web                # unique within a namespace for this kind
  namespace: default
  labels:
    app: web
spec:                      # desired state (you write this)
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx:1.27
# status: is added by controllers (you do not write it)`},
{h:'What Kubernetes is not'},
{ul:['Not a PaaS: it does not build your code or provide databases and message buses for you.','Not a logging or monitoring system: it exposes the hooks, you add the tools.','Not magic high availability: you must run several replicas, spread them and set probes.']},
{note:'A useful exam habit: whenever something is wrong, ask what the desired state is and which controller is responsible for reconciling it. That tells you where to look.'}],
src:[['Kubernetes Overview',K.D+'concepts/overview/'],['Objects in Kubernetes',C+'overview/working-with-objects/'],['Controllers',C+'architecture/controller/']]};

/* ---------- 3: Architecture at a glance ---------- */
L['k8s:0:3']={blocks:[
{p:'A Kubernetes **cluster** is a set of machines called **nodes**. The **control plane** makes global decisions; **worker nodes** run your Pods. This lecture is a map. Section 3 covers each component in depth.'},
{svg:arch},
{h:'Control plane components'},
{t:[['Component','Role'],
['`kube-apiserver`','The front door. Every client and component talks to it over REST. Authenticates, authorizes, validates and stores objects.'],
['`etcd`','Consistent key-value database holding all cluster state. Only the API server talks to it.'],
['`kube-scheduler`','Picks a node for each Pod that has none.'],
['`kube-controller-manager`','Runs the built-in controllers (Deployment, Node, Job, ServiceAccount and many more).'],
['`cloud-controller-manager`','Optional. Integrates with a cloud provider for load balancers, routes and node lifecycle.']]},
{h:'Node components'},
{t:[['Component','Role'],
['`kubelet`','Agent on every node. Watches for Pods assigned to its node and has the runtime start them. Reports status back.'],
['Container runtime','containerd or CRI-O. Pulls images and runs containers through the Container Runtime Interface (CRI).'],
['`kube-proxy`','Programs the node network rules that make Services work (some CNI plugins replace it).'],
['CNI plugin','Gives each Pod an IP address and connects Pods across nodes.'],
['CoreDNS','Cluster DNS so Pods can resolve Service names.']]},
{h:'Following one command'},
{code:`kubectl create deployment web --image=nginx:1.27 --replicas=2`},
{flow:['kubectl sends a request to the API server','API server authenticates, authorizes, runs admission and writes to etcd','Controller manager creates ReplicaSet and Pods','Scheduler binds each Pod to a node','Kubelet asks the runtime to pull the image and start containers','Kubelet reports status; kube-proxy and CNI handle networking']},
{h:'Where things run'},
{ul:['On a **kubeadm** cluster, the control plane components run as **static Pods** on control plane nodes. You manage them.','On **EKS, AKS and GKE**, the control plane is hidden and operated by the provider. You see only the API endpoint and your nodes.','Control plane nodes normally carry a **taint** so ordinary workloads are not scheduled on them.']},
{note:'Communication is hub-and-spoke: all components talk to the API server and never directly to each other (the kubelet is the exception when the API server calls it for logs and exec).'}],
src:[['Cluster Architecture',C+'architecture/'],['Kubernetes Components',C+'overview/components/']]};

/* ---------- 4: Releases ---------- */
L['k8s:0:4']={blocks:[
{p:'Kubernetes releases on a predictable schedule, and knowing the rules tells you how often you must upgrade and which features are safe to use.'},
{h:'Reading a version'},
{p:'Versions follow `vMAJOR.MINOR.PATCH`, for example `v1.37.1`. The major version has been 1 for years. A **minor** release (1.36 to 1.37) adds features and may deprecate or remove APIs. A **patch** release (1.37.0 to 1.37.1) contains only bug and security fixes.'},
{h:'Cadence and support'},
{ul:['About **three minor releases per year**, roughly every four months.','The project maintains the **three most recent minor releases**. Each minor receives roughly **one year of patch support**.','Patch releases come regularly (around monthly) for every supported minor.','Upgrading is done **one minor version at a time**. You cannot skip from 1.34 to 1.37 in one step; Section 11 covers the procedure.']},
{p:'At the time this lecture was written, 1.37 was the newest minor release (1.37.1 was released on 2026-09-15), with 1.36 and 1.35 still supported and 1.34 reaching end of life on 2026-10-27. Always check the official releases page for the current table.'},
{h:'Version skew rules'},
{t:[['Component','Allowed skew'],
['`kube-apiserver` in an HA control plane','Members may differ by at most one minor version during an upgrade'],
['`kubelet`','May be older than the API server, up to three minor versions (never newer)'],
['`kube-proxy`','Same rule as the kubelet'],
['`kubectl`','Within one minor version of the API server, older or newer'],
['controller-manager, scheduler','Same as the API server or one minor older']]},
{note:'Skew limits change over time. Confirm them on the Version Skew Policy page before an upgrade rather than relying on a table you memorized.'},
{h:'Feature lifecycle'},
{t:[['Stage','Meaning','Enabled by default?'],['Alpha','Experimental, may change or vanish','No (feature gate off)'],['Beta','Mostly stable, API may still change','Depends on the feature'],['Stable (GA)','Supported long term','Yes']]},
{p:'Lectures in this course carry **version notes** where behaviour changed recently, for example containerd 1.x support ending or a feature graduating to GA. When a lecture says a feature is GA in a given release, treat older clusters as possibly lacking it.'},
{h:'Check your versions'},
{code:`kubectl version                 # client and server versions
kubectl get nodes               # VERSION column shows each kubelet
kubeadm version -o short        # on a kubeadm cluster`},
{note:'The CKA exam is aligned to a specific Kubernetes minor version. Practice on the version the CNCF lists, and read the release notes for features added since.'}],
src:[['Releases','https://kubernetes.io/releases/'],['Version Skew Policy','https://kubernetes.io/releases/version-skew-policy/'],['Deprecation Policy',K.D+'reference/using-api/deprecation-policy/']]};
})();
