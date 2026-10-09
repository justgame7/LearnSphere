/* LearnSphere - Kubernetes Administrator, Section 04: Installing a Cluster with kubeadm.
   Lectures 0-7 are core, 8-11 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T,S=K.S;
const KB=S+'production-environment/tools/kubeadm/';

const phases=K.dg(700,230,[
[10,20,120,60,'1. preflight|checks',0],[150,20,120,60,'2. certs|PKI in /etc/|kubernetes/pki',0],[290,20,120,60,'3. kubeconfig|admin, kubelet,|scheduler, cm',0],
[430,20,120,60,'4. control-plane|static Pod|manifests',2],[570,20,120,60,'5. etcd|local static Pod',2],
[10,130,200,70,'6. wait for control plane|kubelet starts the Pods',0],[230,130,200,70,'7. upload config, mark-control-plane|taint the node',0],[450,130,240,70,'8. bootstrap-token, addons|CoreDNS + kube-proxy',2]],
[[130,50,150,50],[270,50,290,50],[410,50,430,50],[550,50,570,50],[630,80,350,130]]);

const topo=K.dg(700,280,[
[10,10,330,260,'Stacked etcd (kubeadm default HA)',1],[360,10,330,260,'External etcd',1],
[30,45,290,60,'Control plane node 1|apiserver + etcd member',2],[30,115,290,60,'Control plane node 2|apiserver + etcd member',2],[30,185,290,60,'Control plane node 3|apiserver + etcd member',2],
[380,45,140,60,'CP node 1|apiserver only',0],[380,115,140,60,'CP node 2|apiserver only',0],[380,185,140,60,'CP node 3|apiserver only',0],
[540,45,130,200,'etcd 1|etcd 2|etcd 3|(separate hosts)',2]],
[[520,75,540,100],[520,145,540,145],[520,215,540,190]]);

/* ---------- 0: Preparing nodes ---------- */
L['k8s:3:0']={blocks:[
{p:'Most failed kubeadm installs fail **before** `kubeadm init` is ever run, because a node did not meet one of a handful of requirements. Preparation is not boring housekeeping: each item exists for a specific reason, and knowing the reason lets you recognise the error when a requirement is missing. Everything here applies to **every** node, control plane and worker.'},
{h:'The requirements and why they exist'},
{t:[['Requirement','Why it matters','How to check'],
['Supported 64-bit Linux, a systemd distribution','Packages, kernel features and the systemd cgroup driver','`cat /etc/os-release`'],
['2 or more CPUs and 2 GB RAM (control plane)','kubeadm preflight refuses to continue below this','`nproc`, `free -h`'],
['**Unique hostname, MAC address and `product_uuid`**','Nodes are identified by them; cloned VMs with duplicates fail to join or behave oddly','`hostname`, `ip link`, `sudo cat /sys/class/dmi/id/product_uuid`'],
['Full network connectivity between all nodes','Control plane, kubelets and Pods must reach each other','`ping`, `nc -zv <ip> 6443`'],
['**Swap disabled**','The kubelet refuses to start with swap on by default; swap also makes memory limits unreliable','`swapon --show` (no output = off)'],
['Required **ports** open','Components talk on known ports (below)','`ss -tlnp`, firewall rules'],
['Kernel modules `overlay` and `br_netfilter`','Container filesystems and bridged traffic seen by iptables','`lsmod | grep -E "overlay|br_netfilter"`'],
['Sysctl: IPv4 forwarding and bridge netfilter','Pods are routed through the node','`sysctl net.ipv4.ip_forward`'],
['Time synchronised (NTP)','Certificates and etcd depend on correct clocks','`timedatectl`'],
['A container runtime','The kubelet needs a CRI runtime','Next lecture']]},
{h:'Ports'},
{t:[['Node','Port','Used by'],
['Control plane','6443','Kubernetes API server (used by everyone)'],
['Control plane','2379-2380','etcd client and peer'],
['Control plane','10250','kubelet API'],
['Control plane','10259 and 10257','kube-scheduler and kube-controller-manager (local)'],
['Workers','10250','kubelet API'],
['Workers','30000-32767','NodePort Services (default range)'],
['All','CNI specific','For example VXLAN UDP 8472 or 4789, BGP TCP 179: check your CNI']]},
{h:'Step by step'},
{code:`# 1. Swap off, now and after reboot
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab
swapon --show                                  # should print nothing

# 2. Kernel modules, now and at boot
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay && sudo modprobe br_netfilter

# 3. Network sysctls
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system

# 4. Names: every node must resolve every other node
sudo hostnamectl set-hostname cp1
cat /etc/hosts        # 192.168.56.10 cp1 / 192.168.56.11 w1 / 192.168.56.12 w2`},
{h:'Verify before you install anything'},
{code:`$ lsmod | grep -E "overlay|br_netfilter"
br_netfilter           32768  0
overlay               151552  0
$ sysctl net.ipv4.ip_forward net.bridge.bridge-nf-call-iptables
net.ipv4.ip_forward = 1
net.bridge.bridge-nf-call-iptables = 1
$ swapon --show ; echo "swap lines: $(swapon --show | wc -l)"
swap lines: 0
$ for h in cp1 w1 w2; do nc -zv -w 2 $h 22 ; done          # basic reachability by name`},
{h:'What each missing piece looks like'},
{t:[['Missing','Symptom later'],
['Swap still on','Kubelet fails to start: `running with swap on is not supported`'],
['`br_netfilter` or sysctl','Service and Pod traffic silently misbehaves; preflight warns `bridge-nf-call-iptables`'],
['`ip_forward` off','Preflight error `/proc/sys/net/ipv4/ip_forward contents are not set to 1`'],
['Port 6443 blocked','Workers cannot join; `connection refused` or timeout'],
['Duplicate `product_uuid`','Nodes overwrite each other or join with odd identities'],
['Clock skew','Join fails with certificate "not yet valid"']]},
{h:'Common mistakes'},
{ul:['Running the steps on the control plane only and forgetting the workers.','Cloning a VM image and not changing hostname, MAC address or machine ID.','Disabling swap with `swapoff -a` but not editing `/etc/fstab`, so it returns after a reboot.','A host firewall (ufw, firewalld) or cloud security group blocking the ports above.','Overlapping networks: node, Pod and Service ranges must not overlap each other or the VPN.']},
{note:'Automate these steps with a script or configuration management as soon as you have more than two nodes. Manual drift between nodes is a classic cause of strange behaviour.'}],
src:[['Installing kubeadm',KB+'install-kubeadm/'],['Container Runtimes',S+'production-environment/container-runtimes/'],['Ports and Protocols',K.R+'networking/ports-and-protocols/']]};

/* ---------- 1: containerd ---------- */
L['k8s:3:1']={blocks:[
{p:'The kubelet starts containers by asking a **container runtime** over the Container Runtime Interface (CRI). **containerd** is the most common choice and the one used in this course. Installing it is easy; configuring it correctly is where clusters go wrong, and almost always over **one setting: the cgroup driver**.'},
{h:'Why the cgroup driver matters'},
{p:'Linux **cgroups** limit and account for CPU and memory. On a systemd-based host, **systemd** owns the cgroup tree. If the kubelet and the runtime each manage cgroups in their own way (`cgroupfs`), the host ends up with two managers and two views of resource use, which becomes unstable under memory pressure. The recommendation is simple: use the **`systemd` cgroup driver in both the kubelet and containerd**, on a host with **cgroup v2**.'},
{t:[['Check','Command','Expected'],
['Which cgroup version?','`stat -fc %T /sys/fs/cgroup`','`cgroup2fs` means cgroup v2 (preferred)'],
['containerd driver','`grep SystemdCgroup /etc/containerd/config.toml`','`SystemdCgroup = true`'],
['kubelet driver','`grep cgroupDriver /var/lib/kubelet/config.yaml`','`cgroupDriver: systemd` (kubeadm default)']]},
{h:'Install and configure containerd'},
{code:`# Ubuntu example: from the distribution or Docker apt repository
sudo apt-get update && sudo apt-get install -y containerd

# Generate the default configuration, then switch to the systemd driver
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml >/dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
grep -n SystemdCgroup /etc/containerd/config.toml
sudo systemctl enable --now containerd
sudo systemctl restart containerd
systemctl is-active containerd`},
{note:'The section names inside `config.toml` differ between containerd 1.x and 2.x. Open the generated file and set `SystemdCgroup = true` wherever it appears, rather than copying a path from an old blog post.'},
{h:'Point crictl at it and verify'},
{code:`sudo tee /etc/crictl.yaml <<EOF
runtime-endpoint: unix:///run/containerd/containerd.sock
image-endpoint: unix:///run/containerd/containerd.sock
EOF
$ sudo crictl info | grep -E "RuntimeReady|NetworkReady"
    "type": "RuntimeReady", "status": true
    "type": "NetworkReady", "status": false      # false is NORMAL until a CNI plugin is installed
$ sudo crictl version
$ sudo ctr version`},
{h:'Version notes that affect you'},
{ul:['Run **containerd 2.x** for new clusters. Official runtime documentation states that older containerd 1.x stops working with newer kubelets: the kubelet fallback for runtimes that cannot report their cgroup driver is dropped in Kubernetes 1.38, and Kubernetes 1.35 was the last release to support containerd 1.x.','Recent kubelets can **detect the cgroup driver from the runtime** through the CRI (feature gate `KubeletCgroupDriverFromCRI`), so both sides agree automatically. Setting both explicitly is still good practice and required on older versions.','Docker Engine is not used as the runtime. Images built with Docker run unchanged.']},
{h:'The sandbox (pause) image'},
{p:'Every Pod starts with a tiny **pause** container that holds the network namespace. kubeadm may warn that the pause image configured in containerd differs from the one it expects. Align `sandbox_image` (or its containerd 2.x equivalent) with the version kubeadm recommends, especially on air-gapped clusters where the image must exist in your mirror.'},
{h:'Common problems'},
{t:[['Symptom','Cause','Fix'],
['`kubeadm init` hangs at "waiting for the kubelet"','cgroup driver mismatch or runtime not running','Check `journalctl -u kubelet` and `systemctl status containerd`'],
['`unknown service runtime.v1.RuntimeService`','Config missing CRI plugin (some packages disable it)','Regenerate `config.toml`, make sure the CRI plugin is not disabled'],
['`crictl` errors: connection refused','Wrong socket path in `/etc/crictl.yaml`','Use `/run/containerd/containerd.sock`'],
['Pods restart under memory pressure','cgroupfs and systemd both managing cgroups','Use `systemd` everywhere'],
['Image pulls fail behind a proxy','Runtime has no proxy settings','Set `HTTP_PROXY`, `NO_PROXY` for containerd (systemd drop-in)']]},
{note:'Quick sanity check before `kubeadm init`: runtime active, `SystemdCgroup = true`, swap off, modules loaded. Four checks prevent most first-install failures.'}],
src:[['Container Runtimes',S+'production-environment/container-runtimes/'],['containerd getting started','https://github.com/containerd/containerd/blob/main/docs/getting-started.md'],['About cgroup v2',C+'architecture/cgroups/']]};

/* ---------- 2: kubeadm, kubelet, kubectl ---------- */
L['k8s:3:2']={blocks:[
{p:'Three programs get installed on every node, and they are easy to confuse: **kubeadm** builds and upgrades the cluster, the **kubelet** is the node agent that runs as a service, and **kubectl** is the command line client. They have different jobs, are installed from a **version-specific package repository**, and must be kept at compatible versions. A little discipline here saves painful upgrades later.'},
{t:[['Package','Job','Where needed','Runs as'],
['`kubeadm`','Bootstraps a cluster, joins nodes, upgrades, manages certificates','Every node (for init, join and upgrade)','A command you run'],
['`kubelet`','Node agent that runs Pods','Every node','A **systemd service**'],
['`kubectl`','Talks to the API server','Control plane and wherever you administer from','A command you run'],
['`cri-tools` (crictl)','Debug the runtime','Every node (recommended)','A command you run']]},
{h:'One repository per minor version'},
{p:'Kubernetes packages are published at `pkgs.k8s.io`, with a **separate repository for each minor release** (for example `v1.37`). The repository you configure decides which minor you can install, so a routine `apt upgrade` can never move you to the next minor by accident. To upgrade you deliberately change the repository to the next minor (Section 11).'},
{code:`KVER=v1.37                                   # choose the minor you intend to run (check kubernetes.io/releases)
sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates curl gpg
sudo mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/$KVER/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/$KVER/deb/ /" | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
apt-cache madison kubeadm | head -n 3           # shows the available patch versions
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl      # no accidental upgrades
sudo systemctl enable --now kubelet`},
{note:'Do not copy a version number from this course. Pick the minor release you intend to run from the official releases page, and use the install page for your OS family (RHEL-based systems use a yum or dnf repository file instead).'},
{h:'Why hold the packages'},
{ul:['A background `apt upgrade` could upgrade the kubelet on one node while the control plane stays older, or jump a minor version, breaking the **version skew rules** (Section 11).','A kubelet restart caused by an unplanned upgrade disturbs workloads on that node.','Holding makes upgrades a **deliberate, ordered procedure**: unhold, upgrade kubeadm, run `kubeadm upgrade`, upgrade kubelet, hold again.']},
{h:'Check what you installed'},
{code:`$ kubeadm version -o short
v1.37.1
$ kubelet --version
Kubernetes v1.37.1
$ kubectl version --client
Client Version: v1.37.1
$ systemctl status kubelet | head -n 4
 kubelet.service - kubelet: The Kubernetes Node Agent
   Active: activating (auto-restart) (Result: exit-code)       # EXPECTED before kubeadm init or join
$ apt-mark showhold
kubeadm
kubectl
kubelet`},
{p:'The kubelet restarts every few seconds until `kubeadm init` or `join` gives it a configuration. A crash-looping kubelet **before** `kubeadm init` is normal; do not try to fix it.'},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Different minor versions of kubeadm and kubelet on one node','Init or join warnings and failures','Install matching versions from one repository'],
['Not holding the packages','A surprise upgrade','`apt-mark hold`'],
['Using the legacy `apt.kubernetes.io` repository','Frozen, no new releases','Use `pkgs.k8s.io`'],
['Installing the latest package without choosing a minor','Cluster on an unplanned version','Set the repository to the intended minor'],
['Putting kubectl on every node','Many admin credentials around','Install it where you administer from']]},
{note:'Exam tip: you are usually told the version to install or upgrade to. Know the three package names, how to select an exact version (`kubeadm=1.37.1-1.1` on apt), and how to hold them.'}],
src:[['Installing kubeadm, kubelet and kubectl',KB+'install-kubeadm/'],['Kubernetes package repositories','https://kubernetes.io/blog/2023/08/15/pkgs-k8s-io-introduction/']]};

/* ---------- 3: kubeadm init ---------- */
L['k8s:3:3']={blocks:[
{p:'`kubeadm init` turns a prepared node into the first **control plane** node. It is not one magic step but a sequence of **phases**, each creating something specific. Knowing the phases tells you what exists after init, where it lives, and which phase failed when something goes wrong.'},
{svg:phases},
{h:'What each phase does'},
{t:[['Phase','Creates or does','Where to see the result'],
['preflight','Checks CPU, RAM, swap, ports, modules, runtime','The init output (errors and warnings)'],
['certs','Generates the CAs and certificates','`/etc/kubernetes/pki`'],
['kubeconfig','Writes `admin.conf`, `kubelet.conf`, `controller-manager.conf`, `scheduler.conf`','`/etc/kubernetes/*.conf`'],
['kubelet-start','Writes kubelet configuration and (re)starts the kubelet','`/var/lib/kubelet/config.yaml`, `/var/lib/kubelet/kubeadm-flags.env`'],
['control-plane','Writes **static Pod manifests** for apiserver, controller manager and scheduler','`/etc/kubernetes/manifests`'],
['etcd','Writes a static Pod manifest for a local etcd','`/etc/kubernetes/manifests/etcd.yaml`, data in `/var/lib/etcd`'],
['upload-config, mark-control-plane','Stores configuration in ConfigMaps; labels and **taints** the node','`kubectl -n kube-system get cm kubeadm-config`'],
['bootstrap-token','Creates a token other nodes can use to join','`kubeadm token list`'],
['addon','Installs **CoreDNS** and **kube-proxy**','`kubectl -n kube-system get pods`']]},
{h:'Run it'},
{code:`$ sudo kubeadm init \\
    --apiserver-advertise-address=192.168.56.10 \\
    --pod-network-cidr=10.244.0.0/16 \\
    --control-plane-endpoint=k8s-api:6443 \\
    --upload-certs
[init] Using Kubernetes version: v1.37.1
[preflight] Running pre-flight checks
[certs] Generating "ca" certificate and key
[kubeconfig] Writing "admin.conf" kubeconfig file
[control-plane] Creating static Pod manifest for "kube-apiserver"
[etcd] Creating static Pod manifest for local etcd in "/etc/kubernetes/manifests"
[wait-control-plane] Waiting for the kubelet to boot up the control plane as static Pods ...
[mark-control-plane] Marking the node cp1 as control-plane by adding the taints [node-role.kubernetes.io/control-plane:NoSchedule]
[addons] Applied essential addon: CoreDNS
[addons] Applied essential addon: kube-proxy
Your Kubernetes control-plane has initialized successfully!
... kubeadm join k8s-api:6443 --token abcdef.0123456789abcdef --discovery-token-ca-cert-hash sha256:<hash>      # SAVE THIS`},
{ul:['`--pod-network-cidr` is needed by some CNI plugins; check the one you will use.','`--control-plane-endpoint` must be set **at init** if you may ever add control plane nodes: it fixes the address clients use.','`--apiserver-advertise-address` chooses the node IP the API server advertises (important with several interfaces).','Use `--dry-run` to preview, and `kubeadm init phase <name>` to run a single phase.']},
{h:'Give yourself access'},
{code:`mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
$ kubectl get nodes
NAME   STATUS     ROLES           AGE   VERSION
cp1    NotReady   control-plane   1m    v1.37.1              # NotReady until a CNI plugin is installed
$ kubectl -n kube-system get pods
coredns-...       0/1   Pending    # waits for the network
etcd-cp1          1/1   Running
kube-apiserver-cp1   1/1   Running`},
{h:'When init fails'},
{code:`journalctl -u kubelet -f                          # the kubelet explains most failures
sudo crictl ps -a                                 # did the control plane containers start?
sudo crictl logs <container-id>
sudo kubeadm reset -f                             # clean up, fix the cause, run init again`},
{t:[['Symptom','Likely cause'],
['Hangs at `waiting for the kubelet to boot up the control plane`','cgroup driver mismatch, runtime not running, swap on, wrong advertise address'],
['`[ERROR Port-6443]: Port 6443 is in use`','A previous attempt left processes; run `kubeadm reset`'],
['`[ERROR NumCPU]`, `[ERROR Mem]`','Node too small'],
['`unable to pull images`','No internet or registry; pre-pull with `kubeadm config images pull`'],
['`connection refused` to the control plane endpoint','The load balancer does not forward 6443 yet']]},
{note:'Admin credentials: `admin.conf` is a cluster-admin credential. It is fine in a lab; for real clusters create named admin users (certificates or OIDC) and keep `admin.conf` as a break-glass file.'}],
src:[['Creating a cluster with kubeadm',KB+'create-cluster-kubeadm/'],['kubeadm init',K.R+'setup-tools/kubeadm/kubeadm-init/'],['kubeadm init phases',K.R+'setup-tools/kubeadm/kubeadm-init-phase/']]};

/* ---------- 4: CNI ---------- */
L['k8s:3:4']={blocks:[
{p:'Right after `kubeadm init`, `kubectl get nodes` shows the node **NotReady** and the CoreDNS Pods sit in **Pending**. Nothing is broken: Kubernetes defines **how** Pods get networking but ships no network implementation. Until you install a **CNI plugin**, no Pod can get an IP address, so the node reports that its network is not ready. This is the most common "is my install broken?" moment.'},
{h:'What a CNI plugin provides'},
{ul:['**IP addresses** for Pods from the node slice of the Pod CIDR, and the virtual interfaces that connect Pods to the node.','**Pod-to-Pod connectivity across nodes**, with an overlay (VXLAN, Geneve), routing (BGP) or cloud routes.','Optionally **NetworkPolicy enforcement** (Calico, Cilium and others do; plain Flannel does not) and extras such as encryption and observability.']},
{t:[['Plugin','Notes'],
['Calico','Mature; routed (BGP) or overlay; NetworkPolicy support'],
['Cilium','eBPF dataplane; can replace kube-proxy; rich policy and observability'],
['Flannel','Simple VXLAN overlay; no NetworkPolicy'],
['Antrea, Weave and others','Check that a plugin is still actively maintained before choosing it'],
['Cloud CNIs (AWS VPC CNI, Azure CNI, GKE)','Pod IPs from the cloud network; used on managed services']]},
{h:'Why NotReady before the CNI'},
{flow:['kubeadm init starts the control plane; the node is registered','The kubelet checks the runtime network status through the CRI (crictl info shows NetworkReady false)','With no CNI configuration in /etc/cni/net.d, the node reports NetworkPluginNotReady','The node condition Ready stays False; CoreDNS Pods stay Pending (they need a Pod network)','You install the CNI: its DaemonSet writes the config and starts agents; the node becomes Ready']},
{code:`$ kubectl describe node cp1 | grep -A3 "Ready "
  Ready   False   ...   KubeletNotReady   container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized
$ ls /etc/cni/net.d                  # empty before the CNI is installed`},
{h:'Installing one (the pattern is the same for every plugin)'},
{code:`# 1. Make sure the Pod CIDR you passed to kubeadm matches what the plugin expects
# 2. Apply the plugin manifest or Helm chart from ITS official documentation
kubectl apply -f <cni-manifest-from-plugin-docs>

# 3. Watch it come up
kubectl -n kube-system get pods -w
kubectl get nodes                     # Ready within a minute or two
ls /etc/cni/net.d /opt/cni/bin        # configuration and plugin binaries now exist`},
{note:'On the CKA exam the task usually tells you which plugin manifest to apply (or the cluster already has one). In production choose based on NetworkPolicy needs, scale, observability and the constraints of your network team.'},
{h:'Verify that Pod networking really works'},
{code:`kubectl create deployment net-test --image=nginx:1.27 --replicas=2
kubectl get pods -o wide                                   # Pods on different nodes, each with its own IP
kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- wget -qO- -T 3 http://<pod-ip>     # Pod to Pod
kubectl expose deployment net-test --port=80
kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- nslookup net-test                 # DNS + Service
kubectl delete svc,deployment net-test`},
{h:'Diagnosing network plugin problems'},
{t:[['Symptom','Likely cause','Check'],
['Node NotReady, `cni plugin not initialized`','No CNI, or its Pod is crash-looping','`kubectl -n kube-system get pods`, `ls /etc/cni/net.d`'],
['Pods stuck `ContainerCreating`: `failed to set up sandbox`','CNI binary or config missing on that node, IP pool exhausted','`kubectl describe pod`, CNI Pod logs, `/opt/cni/bin`'],
['Pods on one node cannot reach other nodes','Firewall blocking the overlay port, wrong routes, MTU mismatch','Allow the plugin ports; `ip route`; compare MTUs'],
['CoreDNS keeps restarting right after install','CNI not yet healthy or Pod CIDR mismatch','CNI logs; compare `--pod-network-cidr` with plugin config'],
['Pod CIDR overlaps the node network','Routing conflicts, unreachable hosts','Rebuild with a non-overlapping CIDR']]},
{ul:['**Pod CIDR mismatch** is the usual first-install error: the plugin expects `10.244.0.0/16` but kubeadm was started with another range.','Install only **one** CNI plugin; leftover config files from a previous plugin in `/etc/cni/net.d` cause confusion after switching.']},
{note:'After switching CNI plugins, remove old configuration and reboot or restart nodes; leftover interfaces and rules from the previous plugin are a common hidden cause of problems.'}],
src:[['Network Plugins',C+'extend-kubernetes/compute-storage-net/network-plugins/'],['Cluster Networking',C+'cluster-administration/networking/'],['Installing addons',C+'cluster-administration/addons/']]};

/* ---------- 5: Join workers ---------- */
L['k8s:3:5']={blocks:[
{p:'Worker nodes join the cluster with `kubeadm join`. Two security questions are answered at join time: **can the new node trust the cluster** (is it really my control plane, not an impostor?) and **may the new node join** (does it hold a valid credential?). The two arguments of the join command are exactly those two answers.'},
{h:'The join command'},
{code:`sudo kubeadm join k8s-api:6443 \\
  --token abcdef.0123456789abcdef \\
  --discovery-token-ca-cert-hash sha256:3c4f...e91a`},
{t:[['Argument','Answers','How it works'],
['`--token`','"May I join?"','A short-lived **bootstrap token** (stored as a Secret in `kube-system`). It authenticates the node with narrow rights to request its kubelet certificate. Default lifetime **24 hours**'],
['`--discovery-token-ca-cert-hash`','"Is this really my cluster?"','The SHA-256 hash of the cluster CA public key. The node downloads the CA, checks it matches this hash and only then trusts the API server (prevents man-in-the-middle)']]},
{flow:['The node contacts the API server and downloads cluster-info (including the CA)','It verifies the CA against the pinned hash','It authenticates with the bootstrap token and submits a certificate request for its kubelet','The request is approved automatically and the kubelet receives its client certificate','The kubelet starts, registers the Node object and the node joins']},
{h:'When the token has expired'},
{code:`kubeadm token list                                         # TTL column; expired tokens are gone
sudo kubeadm token create --print-join-command             # a fresh token AND the complete join command

# If you need the hash separately
openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | openssl rsa -pubin -outform der 2>/dev/null | openssl dgst -sha256 -hex | sed 's/^.* //'`},
{h:'Verify the cluster'},
{code:`$ kubectl get nodes -o wide
NAME   STATUS   ROLES           AGE   VERSION   INTERNAL-IP
cp1    Ready    control-plane   20m   v1.37.1   192.168.56.10
w1     Ready    <none>          2m    v1.37.1   192.168.56.11
w2     Ready    <none>          2m    v1.37.1   192.168.56.12
$ kubectl -n kube-system get pods -o wide                  # kube-proxy and the CNI Pod on every node, CoreDNS Running
$ kubectl get --raw='/readyz?verbose' | tail -n 3
$ kubectl label node w1 node-role.kubernetes.io/worker=    # cosmetic: fills the ROLES column

# A smoke test: deploy, spread, expose, reach, clean up
kubectl create deployment hello --image=nginx:1.27 --replicas=4
kubectl get pods -o wide                                   # on w1 and w2 (the control plane is tainted)
kubectl expose deployment hello --port=80 --type=NodePort
kubectl get svc hello ; curl http://<node-ip>:<nodeport>
kubectl delete svc,deployment hello`},
{p:'ROLES shows `<none>` for workers because kubeadm only labels control plane nodes. The `worker` label is purely cosmetic. Control plane nodes carry the taint `node-role.kubernetes.io/control-plane:NoSchedule`, so your Pods land on workers. On a single-node lab remove the taint to schedule on the control plane: `kubectl taint nodes cp1 node-role.kubernetes.io/control-plane-`.'},
{h:'Common join problems'},
{t:[['Message','Cause','Fix'],
['`couldn\'t validate the identity of the API Server`','Wrong CA hash or token expired','New token and correct hash'],
['`connection refused` or timeout to 6443','Firewall or wrong address; the load balancer does not forward','`nc -zv k8s-api 6443`'],
['`unable to fetch the kubeadm-config ConfigMap`','Joining with a version far from the cluster, or API permissions problem','Match kubeadm to the cluster version'],
['`kubelet is not running`, `swap`, `cgroup`','Preparation incomplete on this node','Revisit preparation and runtime lectures'],
['Node joined but `NotReady`','CNI Pod not running on the new node','Check the CNI DaemonSet Pod and kubelet logs'],
['`a node with name ... already exists`','Hostname reused','Delete the old Node object or use a unique name']]},
{note:'Treat join tokens like credentials: they allow a machine to become a member of your cluster. They expire by default, so share them only for the minutes you need and delete unused ones with `kubeadm token delete`.'}],
src:[['kubeadm join',K.R+'setup-tools/kubeadm/kubeadm-join/'],['Creating a cluster with kubeadm',KB+'create-cluster-kubeadm/'],['kubeadm token',K.R+'setup-tools/kubeadm/kubeadm-token/']]};

/* ---------- 6: HA topologies ---------- */
L['k8s:3:6']={blocks:[
{p:'With one control plane node, losing that machine means you can no longer **manage** the cluster: no kubectl, no scheduling, no healing. The workloads on workers keep running, but nothing can change. An **HA (highly available) control plane** runs several instances of every control plane component, so one machine can fail without stopping operations. kubeadm supports two layouts for etcd, and the choice affects cost, complexity and failure behaviour.'},
{svg:topo},
{t:[['','Stacked etcd','External etcd'],
['Layout','etcd runs on the **same nodes** as the API server, scheduler and controller manager','etcd runs on **separate hosts**'],
['Nodes for HA','3 (minimum)','3 control plane + 3 etcd = 6'],
['Complexity','Lower: kubeadm manages it all','Higher: you manage another cluster and its certificates'],
['Failure coupling','Losing a node loses **both** an API server and an etcd member','Failures are independent'],
['Resource isolation','etcd competes with control plane processes for disk and CPU','etcd gets dedicated disks and CPU'],
['Typical use','Most clusters; the kubeadm default HA model','Large or critical clusters, strict isolation of etcd']]},
{h:'The load balancer'},
{p:'Kubelets, kubectl and controllers must reach the API servers through **one stable address**. Put a **load balancer** (HAProxy plus keepalived, a cloud load balancer, kube-vip) in front of the API servers on TCP 6443, and use its name as `--control-plane-endpoint` **when you run `kubeadm init`**.'},
{flow:['Create the load balancer and a DNS name (k8s-api)','kubeadm init --control-plane-endpoint k8s-api:6443 --upload-certs on the first node','kubeadm join ... --control-plane --certificate-key ... on the second and third nodes','Join workers with the same endpoint','Verify: stop one control plane node and keep using kubectl']},
{code:`$ kubectl get nodes
cp1   Ready   control-plane   40d
cp2   Ready   control-plane   40d
cp3   Ready   control-plane   40d
$ kubectl -n kube-system get pods -l component=etcd -o wide      # one etcd member per control plane node (stacked)
$ kubectl -n kube-system get lease kube-scheduler kube-controller-manager      # leader election: one active, others standby`},
{h:'Failure tolerance'},
{t:[['Control plane nodes (stacked)','etcd quorum','Nodes you can lose and keep working'],
['1','1','0'],
['2','2','**0** (never run two)'],
['3','2','1'],
['5','3','2']]},
{ul:['The **API server** is active-active: all instances serve traffic. The **scheduler** and **controller manager** are active-standby with leader election, so only one acts at a time.','Spread control plane nodes across **failure zones**, but keep latency between etcd members low (a few milliseconds).','HA protects the control plane. Your **applications** need their own replicas spread across worker nodes and zones.','The **load balancer must itself be redundant**; a single HAProxy VM only moves the single point of failure.']},
{h:'Testing the claim'},
{code:`# in a lab: take one control plane node away
sudo systemctl stop kubelet && sudo crictl stop $(sudo crictl ps -q)      # on cp2
kubectl get nodes                       # through the load balancer: still works, cp2 NotReady after a while
kubectl create deployment ha-test --image=nginx:1.27 --replicas=3         # writes still succeed (quorum 2 of 3)
# now remember: stopping a SECOND control plane node would break quorum, and the API could no longer write`},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Running `kubeadm init` without `--control-plane-endpoint`','Cannot cleanly add control plane nodes later','Set it from day one if HA is possible'],
['Two control plane nodes','Worse than one for etcd','Use 3 or 5'],
['Single load balancer VM','Single point of failure moved','Redundant load balancer'],
['API server certificate without the load balancer name','x509 errors for clients using the endpoint','Add `--apiserver-cert-extra-sans`'],
['All control plane nodes in one zone or rack','One outage takes everything','Spread across zones']]},
{note:'Whichever topology you choose, take an etcd snapshot after the build and rehearse a restore. HA protects against machine failure, not against deleted data or a bad upgrade.'}],
src:[['Options for Highly Available Topology',KB+'ha-topology/'],['Creating Highly Available Clusters with kubeadm',KB+'high-availability/']]};

/* ---------- 7: Config files and reset ---------- */
L['k8s:3:7']={blocks:[
{p:'A long list of `kubeadm init` flags is hard to review, repeat and keep in Git. A **configuration file** captures the same settings as YAML you can version, review in a pull request and reuse to rebuild an identical cluster. And when an install goes wrong, `kubeadm reset` takes a node back to a clean state so you can try again. Together these make cluster builds **repeatable**, which is what real operations need.'},
{h:'A configuration file'},
{code:`# kubeadm-config.yaml
apiVersion: kubeadm.k8s.io/v1beta4
kind: InitConfiguration
localAPIEndpoint:
  advertiseAddress: 192.168.56.10          # this node, as seen by the others
  bindPort: 6443
nodeRegistration:
  name: cp1
  criSocket: unix:///run/containerd/containerd.sock
---
apiVersion: kubeadm.k8s.io/v1beta4
kind: ClusterConfiguration
kubernetesVersion: v1.37.1
controlPlaneEndpoint: "k8s-api.example.com:6443"
networking:
  podSubnet: 10.244.0.0/16
  serviceSubnet: 10.96.0.0/12
  dnsDomain: cluster.local
apiServer:
  certSANs: ["k8s-api.example.com"]
---
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
cgroupDriver: systemd
rotateCertificates: true`},
{t:[['Document `kind`','Configures'],
['`InitConfiguration`','This node specific settings for `init`: advertise address, node name, runtime socket, bootstrap tokens'],
['`ClusterConfiguration`','Cluster-wide settings: version, endpoint, networking, component flags, image repository, etcd'],
['`KubeletConfiguration`','Kubelet settings applied to all nodes'],
['`KubeProxyConfiguration`','kube-proxy mode and options'],
['`JoinConfiguration`','The same idea for `kubeadm join` (token, CA hash, node registration)']]},
{code:`sudo kubeadm init --config kubeadm-config.yaml --upload-certs
sudo kubeadm init --config kubeadm-config.yaml --dry-run          # preview, change nothing

kubeadm config print init-defaults                                # a full template for YOUR installed version
kubeadm config migrate --old-config old.yaml --new-config new.yaml
kubectl -n kube-system get cm kubeadm-config -o yaml              # what the running cluster was built with
kubeadm config images list --config kubeadm-config.yaml`},
{note:'The kubeadm configuration API version changes over time (v1beta3, v1beta4 and so on). Use `kubeadm config print init-defaults` on your installed version to get the right `apiVersion` and field names.'},
{h:'Joining with a file'},
{code:`# join-config.yaml
apiVersion: kubeadm.k8s.io/v1beta4
kind: JoinConfiguration
discovery:
  bootstrapToken:
    apiServerEndpoint: k8s-api.example.com:6443
    token: abcdef.0123456789abcdef
    caCertHashes: ["sha256:3c4f...e91a"]
nodeRegistration:
  criSocket: unix:///run/containerd/containerd.sock
sudo kubeadm join --config join-config.yaml`},
{h:'kubeadm reset: back to clean'},
{p:'`kubeadm reset` undoes what `init` or `join` did **on that node**: it stops the kubelet containers, removes the static Pod manifests, certificates and kubeconfig files, and cleans the kubelet state. It deliberately **does not** remove everything.'},
{t:[['Removed by reset','Left behind (clean manually)'],
['`/etc/kubernetes` manifests, certificates, kubeconfigs','CNI configuration in `/etc/cni/net.d`'],
['Kubelet state, etcd data of that node','iptables, nftables and IPVS rules'],
['The node membership in a stacked etcd (control plane)','Your `$HOME/.kube/config`'],
['Running Kubernetes containers','Installed packages and the container runtime']]},
{code:`# remove a worker properly: from a machine with kubectl first
kubectl drain w2 --ignore-daemonsets --delete-emptydir-data
kubectl delete node w2
# then on w2
sudo kubeadm reset -f
sudo rm -rf /etc/cni/net.d $HOME/.kube
sudo iptables -F && sudo iptables -t nat -F && sudo iptables -t mangle -F && sudo iptables -X
sudo ipvsadm --clear 2>/dev/null; sudo systemctl restart containerd`},
{h:'Common mistakes'},
{ul:['Running `reset` on a control plane node of a live HA cluster without removing it from etcd first (reset tries, but check `etcdctl member list`).','Re-running `init` without cleaning CNI config and rules left by a previous attempt.','Keeping the configuration only in your shell history: store it in Git, with the join commands in a runbook.','Using an old config API version after upgrading kubeadm: migrate it.']},
{note:'Keep a **rebuild kit** in Git: `kubeadm-config.yaml`, the CNI manifest, node preparation script and notes. Rebuilding a lab then takes minutes, and you practise the skills the exam tests.'}],
src:[['Customizing components with the kubeadm API',KB+'control-plane-flags/'],['kubeadm configuration (v1beta4)',K.R+'config-api/kubeadm-config.v1beta4/'],['kubeadm reset',K.R+'setup-tools/kubeadm/kubeadm-reset/']]};

/* ---------- Additional content ---------- */
/* 8: HA control plane hands-on */
L['k8s:3:8']={blocks:[
{p:'A step-by-step build of a **three-node stacked-etcd control plane** behind a load balancer, plus workers. Use VMs; names and addresses below are examples.'},
{t:[['Host','Address','Role'],['lb','192.168.56.5','Load balancer for the API (TCP 6443)'],['cp1, cp2, cp3','192.168.56.11 to .13','Control plane nodes'],['w1, w2','192.168.56.21, .22','Workers']]},
{h:'1. Load balancer (HAProxy example)'},
{code:`# /etc/haproxy/haproxy.cfg  (on lb)
frontend k8s-api
    bind *:6443
    mode tcp
    default_backend k8s-cp
backend k8s-cp
    mode tcp
    balance roundrobin
    option tcp-check
    server cp1 192.168.56.11:6443 check
    server cp2 192.168.56.12:6443 check
    server cp3 192.168.56.13:6443 check

# DNS or /etc/hosts on every node:  192.168.56.5  k8s-api`},
{h:'2. First control plane node'},
{code:`# on cp1, after preparing the node and installing containerd and kubeadm
sudo kubeadm init \\
  --control-plane-endpoint "k8s-api:6443" \\
  --upload-certs \\
  --pod-network-cidr=10.244.0.0/16
# note the two join commands printed: one for control plane nodes (with --control-plane --certificate-key), one for workers
mkdir -p $HOME/.kube && sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config && sudo chown $(id -u):$(id -g) $HOME/.kube/config
kubectl apply -f <your-cni-manifest>`},
{h:'3. Join the other control plane nodes'},
{code:`# on cp2 and cp3
sudo kubeadm join k8s-api:6443 --token <token> \\
  --discovery-token-ca-cert-hash sha256:<hash> \\
  --control-plane --certificate-key <key>
# the certificate key expires after about two hours; create a new one with:
#   sudo kubeadm init phase upload-certs --upload-certs
kubectl get nodes
kubectl -n kube-system get pods -l component=etcd -o wide`},
{h:'4. Workers'},
{code:`# on w1 and w2: the worker join command from step 2
sudo kubeadm join k8s-api:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>`},
{h:'5. Test failure tolerance'},
{code:`# stop one control plane node
sudo systemctl stop kubelet && sudo crictl stop $(sudo crictl ps -q)    # on cp2
kubectl get nodes                          # through the load balancer: still works
kubectl create deployment ha-test --image=nginx:1.27 --replicas=3
sudo ETCDCTL_API=3 etcdctl ... endpoint status --cluster --write-out=table   # from cp1: 2 healthy members
# bring cp2 back
sudo systemctl start kubelet`},
{ul:['Never stop two of three control plane nodes at once: quorum is lost.','The load balancer is a new single point of failure unless it is redundant (keepalived, a cloud LB, kube-vip).','Verify certificates include the load balancer name: `openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text | grep -A1 "Alternative"`.']},
{note:'Take an etcd snapshot after the build and keep the kubeadm configuration and join commands in your repository.'}],
src:[['Creating Highly Available Clusters with kubeadm',K.S+'production-environment/tools/kubeadm/high-availability/'],['Options for Highly Available Topology',K.S+'production-environment/tools/kubeadm/ha-topology/']]};

/* 9: External etcd */
L['k8s:3:9']={blocks:[
{p:'With an **external etcd** topology, etcd runs on its own hosts and the control plane nodes only run the API server, scheduler and controller manager. This separates failure domains and lets you size and secure etcd on its own.'},
{h:'What changes compared to stacked etcd'},
{ul:['Three or five **etcd hosts**, each running etcd (as a systemd service or as static Pods managed by a kubelet on that host).','The API servers connect to etcd over TLS using a **client certificate** signed by the etcd CA.','kubeadm needs the etcd CA and API-server-etcd client certificate and key copied to the first control plane node, and the endpoints listed in the configuration.']},
{h:'kubeadm configuration'},
{code:`# kubeadm-config.yaml on cp1
apiVersion: kubeadm.k8s.io/v1beta4
kind: ClusterConfiguration
kubernetesVersion: v1.37.1
controlPlaneEndpoint: "k8s-api:6443"
etcd:
  external:
    endpoints:
    - https://10.0.0.21:2379
    - https://10.0.0.22:2379
    - https://10.0.0.23:2379
    caFile: /etc/kubernetes/pki/etcd/ca.crt
    certFile: /etc/kubernetes/pki/apiserver-etcd-client.crt
    keyFile: /etc/kubernetes/pki/apiserver-etcd-client.key`},
{code:`# files copied from an etcd host to cp1 before init
/etc/kubernetes/pki/etcd/ca.crt
/etc/kubernetes/pki/apiserver-etcd-client.crt
/etc/kubernetes/pki/apiserver-etcd-client.key

sudo kubeadm init --config kubeadm-config.yaml --upload-certs`},
{h:'Creating the etcd certificates'},
{p:'Use `kubeadm init phase certs` on one etcd host to generate the etcd CA, server, peer and client certificates, with the right host names and IPs, and copy the needed files to each member. Each member needs its own server and peer certificate for its own address.'},
{code:`# on an etcd host (example, using kubeadm to create certs from a config listing that host)
sudo kubeadm init phase certs etcd-ca
sudo kubeadm init phase certs etcd-server --config=etcd-config-host1.yaml
sudo kubeadm init phase certs etcd-peer --config=etcd-config-host1.yaml
sudo kubeadm init phase certs etcd-healthcheck-client --config=etcd-config-host1.yaml
sudo kubeadm init phase certs apiserver-etcd-client --config=etcd-config-host1.yaml`},
{h:'Operating it'},
{ul:['**Backups**: snapshot etcd from an etcd host; certificates live under `/etc/kubernetes/pki/etcd` there.','**Upgrades**: etcd versions are upgraded separately from the Kubernetes components, following the compatibility notes for your Kubernetes version.','**Monitoring**: etcd now has its own hosts to watch (disk latency, DB size, leader changes).','**Certificate renewal** for etcd members is your job; `kubeadm certs renew` on the control plane does not renew external etcd certificates.']},
{note:'External etcd costs more machines and more certificates to manage. Choose it when you need independent failure domains or dedicated storage for etcd, not by default.'}],
src:[['Set up a High Availability etcd Cluster with kubeadm',K.S+'production-environment/tools/kubeadm/setup-ha-etcd-with-kubeadm/'],['Options for Highly Available Topology',K.S+'production-environment/tools/kubeadm/ha-topology/']]};

/* 10: Other installers */
L['k8s:3:10']={blocks:[
{p:'kubeadm is the reference bootstrapper and the one tested by the exam, but there are other ways to build clusters. Each makes different trade-offs.'},
{t:[['Tool','Idea','Good for','Trade-offs'],
['**kubeadm**','Minimal bootstrapper; you prepare nodes, networking and add-ons','Learning, custom designs, the CKA','You automate everything around it'],
['**kubespray**','Ansible playbooks that use kubeadm to build and upgrade production clusters','On-prem or cloud VMs with existing Ansible skills','Slower runs; Ansible inventory and version pinning to manage'],
['**Cluster API (CAPI)**','Declarative cluster lifecycle: clusters, machines and machine pools are Kubernetes objects managed from a management cluster','Fleets, repeatable cluster creation and upgrades across providers','Needs a management cluster and provider knowledge'],
['**k3s**','Single small binary, lightweight Kubernetes with SQLite or embedded etcd, simple install','Edge, IoT, labs, small clusters, CI','Some components replaced or bundled; not the kubeadm layout'],
['**Talos Linux**','Immutable OS purpose-built for Kubernetes, managed only through an API (no SSH)','Hardened, repeatable bare-metal and cloud clusters','Different operations model: you use `talosctl`, not a shell'],
['**Managed services**','Provider runs the control plane','Most teams that do not need to own the control plane','Less control; provider limits']]},
{h:'How to choose'},
{ul:['**Exam or learning the internals**: kubeadm.','**Many clusters, same shape**: Cluster API or infrastructure-as-code with a distribution.','**Edge or tiny footprint**: k3s.','**Security-hardened, minimal OS**: Talos.','**No wish to run a control plane**: a managed service.']},
{h:'Taste test: a k3s lab'},
{code:`# server
curl -sfL https://get.k3s.io | sh -
sudo k3s kubectl get nodes
# agent
curl -sfL https://get.k3s.io | K3S_URL=https://<server>:6443 K3S_TOKEN=<token> sh -`},
{note:'Whatever the installer, the same Kubernetes objects and kubectl skills apply. Differences are in install, upgrade, file locations and the default add-ons (CNI, ingress, storage).'}],
src:[['Installing Kubernetes',K.S+'production-environment/'],['kubespray','https://kubespray.io/'],['Cluster API','https://cluster-api.sigs.k8s.io/'],['k3s','https://docs.k3s.io/'],['Talos Linux','https://www.talos.dev/']]};

/* 11: Air-gapped */
L['k8s:3:11']={blocks:[
{p:'In an **air-gapped** environment nodes cannot reach the internet. Everything a cluster needs must come from internal mirrors: operating system packages, Kubernetes binaries, container images and Helm charts.'},
{h:'What you must mirror'},
{t:[['Item','How'],
['OS packages and the Kubernetes package repository','Internal apt or yum mirror, or downloaded packages in a local repository'],
['Container images for control plane, CNI, CoreDNS, add-ons','Internal registry (Harbor, Nexus, Artifactory, registry:2) filled from a connected host'],
['Helm charts and manifests','Internal chart repository or OCI registry; manifests in Git'],
['Time and DNS','Internal NTP and DNS']]},
{h:'Get the list of images'},
{code:`kubeadm config images list --kubernetes-version v1.37.1
# registry.k8s.io/kube-apiserver:v1.37.1
# registry.k8s.io/kube-controller-manager:v1.37.1
# registry.k8s.io/kube-scheduler:v1.37.1
# registry.k8s.io/kube-proxy:v1.37.1
# registry.k8s.io/coredns/coredns:v1.xx
# registry.k8s.io/pause:3.x
# registry.k8s.io/etcd:3.x.x-0`},
{h:'Copy images into your registry'},
{code:`# on a connected host
for i in $(kubeadm config images list --kubernetes-version v1.37.1); do
  n=\${i#registry.k8s.io/}
  skopeo copy docker://$i docker://registry.internal.example/k8s/$n
done
# or: docker pull / tag / push, or ctr/crane tools; also export to a tarball for offline transfer:
#   crane pull --format=oci <image> image.tar`},
{h:'Point kubeadm and the runtime at the mirror'},
{code:`# kubeadm-config.yaml
apiVersion: kubeadm.k8s.io/v1beta4
kind: ClusterConfiguration
imageRepository: registry.internal.example/k8s
kubernetesVersion: v1.37.1

# containerd: use the registry (and optionally mirror docker.io and others)
# /etc/containerd/certs.d/registry.internal.example/hosts.toml  (config_path must be enabled)
server = "https://registry.internal.example"
[host."https://registry.internal.example"]
  capabilities = ["pull", "resolve"]
  ca = "/etc/containerd/certs.d/registry.internal.example/ca.crt"`},
{ul:['Align the **pause (sandbox) image** setting in containerd with the mirrored image.','Use image tags that match the Kubernetes version you install, and mirror every **add-on** image: CNI, CoreDNS, metrics-server, ingress, CSI, cert-manager.','Rewrite image references in Helm values and manifests to the internal registry (`image.registry`, Kustomize `images:`).','Plan **updates**: a repeatable process to bring new images and packages across the gap, with checksums and scanning.']},
{h:'Testing'},
{code:`sudo crictl pull registry.internal.example/k8s/pause:3.10
sudo kubeadm init --config kubeadm-config.yaml --dry-run
kubectl get pods -A -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\\n"}{end}' | sort -u | grep -v internal.example   # anything still external?`},
{note:'The first sign of a missed image is `ImagePullBackOff` or a `kubeadm init` timeout during preflight. Check which image failed, mirror it, and add it to your list.'}],
src:[['kubeadm config images',K.R+'setup-tools/kubeadm/kubeadm-config/'],['Container Runtimes',K.S+'production-environment/container-runtimes/'],['Images',K.C+'containers/images/']]};
})();
