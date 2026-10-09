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
{p:'Most failed installs are failed **preparation**. Every node, control plane and worker, must meet the same baseline before you run kubeadm.'},
{h:'Checklist'},
{t:[['Requirement','Why','How to check'],
['Supported Linux (for example Ubuntu, Debian, RHEL family)','Packages and kernel features','`cat /etc/os-release`'],
['2+ vCPU and 2+ GB RAM (control plane)','kubeadm preflight refuses less','`nproc`, `free -h`'],
['Unique hostname, MAC address and `product_uuid`','Nodes are identified by them','`hostname`, `ip link`, `sudo cat /sys/class/dmi/id/product_uuid`'],
['Full network connectivity between nodes','Pods and components must reach each other','`ping`, `nc -zv ip 6443`'],
['Swap disabled (default)','The kubelet fails to start with swap on unless configured for it','`swapon --show`'],
['Required ports open','Components talk on known ports','Table below'],
['Kernel modules and sysctls','Pod networking and iptables','Below'],
['Time synchronised','Certificates and etcd depend on clocks','`timedatectl`']]},
{h:'Ports'},
{t:[['Node','Port','Used by'],
['Control plane','6443','Kubernetes API server (everyone)'],
['Control plane','2379-2380','etcd client and peer'],
['Control plane','10250','kubelet API'],
['Control plane','10259, 10257','scheduler, controller manager (localhost / control plane)'],
['Workers','10250','kubelet API'],
['Workers','30000-32767','NodePort Services (default range)'],
['All','CNI-specific','For example VXLAN UDP 4789 or 8472, BGP 179 -- check your CNI']]},
{h:'Disable swap'},
{code:`sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab
swapon --show        # should print nothing`},
{p:'Kubernetes has support for running with swap enabled (NodeSwap), but the safe default for a new cluster is to leave swap off, which also keeps memory limits meaningful.'},
{h:'Kernel modules and sysctl'},
{code:`# Load now and on every boot
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay
sudo modprobe br_netfilter

# Networking settings
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system

# Verify
lsmod | grep -E "overlay|br_netfilter"
sysctl net.ipv4.ip_forward`},
{h:'Hostnames and name resolution'},
{code:`sudo hostnamectl set-hostname cp1
# every node should resolve every other node (DNS or /etc/hosts)
cat /etc/hosts
192.168.56.10 cp1
192.168.56.11 w1
192.168.56.12 w2`},
{note:'Run every step on every node (except where a lecture says control plane only). Use a script or configuration management for more than two nodes: manual drift between nodes is a classic cause of strange behaviour.'}],
src:[['Installing kubeadm',KB+'install-kubeadm/'],['Container Runtimes',S+'production-environment/container-runtimes/'],['Ports and Protocols',K.R+'networking/ports-and-protocols/']]};

/* ---------- 1: containerd ---------- */
L['k8s:3:1']={blocks:[
{p:'The kubelet needs a **container runtime** that implements the CRI. **containerd** is the most common choice. This lecture installs it and sets the one setting that most often breaks new clusters: the cgroup driver.'},
{h:'Why the cgroup driver matters'},
{p:'On a systemd-based Linux, systemd manages the cgroup tree. If the kubelet and the runtime both manage cgroups through different drivers, the system ends up with two views of resources, which causes instability under load. The recommendation is to use the **systemd** driver on both the kubelet and containerd, and cgroup v2 on current distributions.'},
{h:'Install and configure'},
{code:`# Ubuntu example: use the distribution package or Docker's apt repository
sudo apt-get update && sudo apt-get install -y containerd

# Generate the default config, then switch to the systemd cgroup driver
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml >/dev/null

# In config.toml (containerd 2.x layout):
#   [plugins.'io.containerd.cri.v1.runtime'.containerd.runtimes.runc.options]
#     SystemdCgroup = true
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

sudo systemctl enable --now containerd
sudo systemctl restart containerd
systemctl is-active containerd`},
{note:'The section names inside config.toml differ between containerd 1.x and 2.x. Open the generated file and set the SystemdCgroup option wherever it appears rather than copying a path from an old blog post.'},
{h:'Check the runtime'},
{code:`sudo ctr version
sudo crictl --runtime-endpoint unix:///run/containerd/containerd.sock info | head -n 20
stat -fc %T /sys/fs/cgroup          # cgroup2fs`},
{h:'Version notes'},
{ul:['Run **containerd 2.x** on new clusters. Official docs state that older containerd (1.x) will stop working with newer kubelets: the kubelet fallback for runtimes that cannot report their cgroup driver is dropped in Kubernetes 1.38, and Kubernetes 1.35 was the last release to support containerd 1.x.','Recent kubelets can **detect the cgroup driver from the runtime** through the CRI (feature gate `KubeletCgroupDriverFromCRI`), so the kubelet and runtime agree automatically. Setting both explicitly is still good practice and required on older versions.','Docker Engine is not used as the runtime directly. Images built with Docker run unchanged.']},
{h:'Sandbox (pause) image'},
{p:'Every Pod starts with a tiny **pause** container that holds its namespaces. kubeadm may warn that the pause image differs from the version it expects. Align `sandbox_image` (or the equivalent setting in containerd 2.x) with the version kubeadm suggests, especially for air-gapped clusters.'},
{h:'Configure crictl'},
{code:`sudo tee /etc/crictl.yaml <<EOF
runtime-endpoint: unix:///run/containerd/containerd.sock
image-endpoint: unix:///run/containerd/containerd.sock
EOF
sudo crictl ps
sudo crictl images`}],
src:[['Container Runtimes',S+'production-environment/container-runtimes/'],['containerd getting started','https://github.com/containerd/containerd/blob/main/docs/getting-started.md'],['About cgroup v2',C+'architecture/cgroups/']]};

/* ---------- 2: kubeadm, kubelet, kubectl ---------- */
L['k8s:3:2']={blocks:[
{p:'Three tools get installed on every node. They have different jobs and must be kept at compatible versions.'},
{t:[['Package','Job','Where'],
['`kubeadm`','Bootstraps and upgrades the cluster','All nodes'],
['`kubelet`','Node agent, runs as a service','All nodes'],
['`kubectl`','CLI client','Anywhere you administer from (at least the control plane / admin box)']]},
{h:'The package repository is per minor version'},
{p:'Kubernetes publishes packages at `pkgs.k8s.io`, with a separate repository for each minor release. The repository you configure decides which minor version you can install, which makes accidental minor upgrades impossible. Replace the version in the URL when you upgrade (Section 11).'},
{code:`# Debian / Ubuntu. Set the minor version you want:
KVER=v1.37
sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates curl gpg
sudo mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/$KVER/deb/Release.key | \\
  sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/$KVER/deb/ /" | \\
  sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl      # no accidental upgrades
sudo systemctl enable --now kubelet`},
{note:'Do not copy a version number from this lecture. Pick the minor release you intend to run from the official releases page, and use the install page for your OS family (RHEL-based systems use a yum repo file instead).'},
{h:'Why hold the packages'},
{p:'A routine `apt upgrade` that upgrades kubelet on one node while the control plane stays old could break version skew rules, and an unplanned kubelet restart can disturb workloads. Holding the packages makes upgrades a deliberate act.'},
{h:'After install'},
{code:`kubeadm version -o short
kubelet --version
kubectl version --client
systemctl status kubelet     # activating (auto-restart) is NORMAL until kubeadm init/join runs`},
{p:'The kubelet restarts every few seconds until it receives configuration from kubeadm. Seeing it crash-looping before `kubeadm init` is expected; do not try to fix it.'}],
src:[['Installing kubeadm, kubelet and kubectl',KB+'install-kubeadm/'],['Kubernetes package repositories','https://kubernetes.io/blog/2023/08/15/pkgs-k8s-io-introduction/']]};

/* ---------- 3: kubeadm init ---------- */
L['k8s:3:3']={blocks:[
{p:'`kubeadm init` turns a prepared node into the first control plane node. It is a sequence of **phases**, and knowing them tells you where an install failed.'},
{svg:phases},
{h:'What the phases do'},
{t:[['Phase','Result'],
['preflight','Checks CPU, RAM, swap, ports, runtime. Fails early with a clear message.'],
['certs','Creates the CAs and certificates in `/etc/kubernetes/pki`'],
['kubeconfig','Writes `admin.conf`, `kubelet.conf`, `controller-manager.conf`, `scheduler.conf`'],
['kubelet-start','Writes kubelet config and starts the kubelet'],
['control-plane','Writes static Pod manifests for apiserver, controller manager, scheduler'],
['etcd','Writes a static Pod manifest for a local etcd'],
['upload-config, mark-control-plane','Stores config in a ConfigMap; labels and taints the control plane node'],
['bootstrap-token','Creates a token other nodes use to join'],
['addon','Installs CoreDNS and kube-proxy']]},
{h:'Run it'},
{code:`# Pod network CIDR must match your CNI plugin's expectation
sudo kubeadm init \\
  --apiserver-advertise-address=192.168.56.10 \\
  --pod-network-cidr=10.244.0.0/16 \\
  --kubernetes-version=stable-1

# Give your user kubectl access
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

kubectl get nodes          # NotReady until a CNI is installed
kubectl -n kube-system get pods`},
{ul:['`--pod-network-cidr` is only needed by some CNIs; check the one you plan to use.','`--control-plane-endpoint` is **required for HA** later. Set it to a stable DNS name or load balancer address now if you may ever add control plane nodes.','Save the `kubeadm join ...` command printed at the end, or regenerate it later.','Use `--dry-run` to see what would be done, and `kubeadm init phase <name>` to run a single phase.']},
{h:'When init fails'},
{code:`journalctl -u kubelet -f
sudo crictl ps -a
sudo crictl logs <container-id>
sudo kubeadm reset -f        # clean up, fix the cause, run init again`},
{ul:['Container runtime not reachable: check the containerd socket and `crictl info`.','Control plane never becomes healthy: usually a cgroup driver mismatch or a wrong advertise address.','Port 6443 or 10250 already in use: a previous failed attempt left processes behind; reset.']},
{note:'Admin credentials: `admin.conf` grants cluster-admin. It is fine for a lab; on real clusters create named admin users or use OIDC (Section 9).'}],
src:[['Creating a cluster with kubeadm',KB+'create-cluster-kubeadm/'],['kubeadm init',K.R+'setup-tools/kubeadm/kubeadm-init/'],['kubeadm init phases',K.R+'setup-tools/kubeadm/kubeadm-init-phase/']]};

/* ---------- 4: CNI ---------- */
L['k8s:3:4']={blocks:[
{p:'Right after `kubeadm init`, `kubectl get nodes` shows the node **NotReady** and the CoreDNS Pods sit in **Pending**. This is expected. Kubernetes defines how Pods get networking but ships no network implementation; you install a **CNI plugin**.'},
{h:'What a CNI plugin does'},
{ul:['Assigns each Pod an IP from the Pod CIDR and wires it into the network namespace.','Provides Pod-to-Pod connectivity across nodes (overlay such as VXLAN, or routed such as BGP).','Optionally enforces **NetworkPolicy** (Calico, Cilium and others do; plain Flannel does not).']},
{t:[['Plugin','Notes'],['Calico','Mature; BGP or overlay; NetworkPolicy support'],['Cilium','eBPF dataplane; can replace kube-proxy; rich policy and observability'],['Flannel','Simple overlay; no NetworkPolicy enforcement'],['Weave and others','Check that a plugin is still maintained before choosing it'],['Cloud CNIs (VPC CNI, Azure CNI)','Used on managed services; Pod IPs come from the cloud network']]},
{note:'On the CKA exam the task usually tells you which CNI manifest to apply (or the cluster already has one). In production, choose based on NetworkPolicy needs, scale and the network team\'s constraints.'},
{h:'Install (pattern, any plugin)'},
{code:`# 1. Make sure --pod-network-cidr matched what the plugin expects
# 2. Apply the plugin manifest from its official documentation
kubectl apply -f <cni-manifest-url-from-plugin-docs>

# 3. Watch it come up
kubectl -n kube-system get pods -w
kubectl get nodes                  # Ready within a minute or two`},
{h:'Verify networking works'},
{code:`kubectl create deployment net-test --image=nginx:1.27 --replicas=2
kubectl get pods -o wide                        # Pods on different nodes
kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- \\
  wget -qO- http://<pod-ip>                     # Pod to Pod

kubectl expose deployment net-test --port=80
kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- \\
  nslookup net-test                             # DNS
kubectl delete svc,deployment net-test`},
{h:'Symptoms and causes'},
{t:[['Symptom','Likely cause'],
['Node NotReady, message "cni plugin not initialized"','No CNI installed or its Pods are crash-looping'],
['Pods stuck ContainerCreating with sandbox errors','CNI binaries or config missing in `/etc/cni/net.d` and `/opt/cni/bin`'],
['Pods on different nodes cannot talk','Firewall blocks the overlay port, or MTU mismatch'],
['Pod CIDR conflicts with node network','Choose a CIDR that does not overlap with node or VPN ranges']]}],
src:[['Network Plugins',C+'extend-kubernetes/compute-storage-net/network-plugins/'],['Cluster Networking',C+'cluster-administration/networking/'],['Installing addons',C+'cluster-administration/addons/']]};

/* ---------- 5: Join workers ---------- */
L['k8s:3:5']={blocks:[
{p:'Workers join with `kubeadm join`. It uses a short-lived **bootstrap token** to securely fetch cluster information, then the kubelet obtains its own certificate.'},
{h:'The join command'},
{code:`sudo kubeadm join 192.168.56.10:6443 \\
  --token abcdef.0123456789abcdef \\
  --discovery-token-ca-cert-hash sha256:<hash>`},
{ul:['**token**: authenticates the new node to the API server for a limited time.','**discovery-token-ca-cert-hash**: the SHA-256 hash of the cluster CA public key. It lets the node verify it is talking to the real cluster and not an impostor.']},
{h:'Tokens expire'},
{p:'Bootstrap tokens last **24 hours** by default. When a node is added later, create a new token and print the full command:'},
{code:`kubeadm token list
sudo kubeadm token create --print-join-command

# Compute the CA hash manually if needed
openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | \\
  openssl rsa -pubin -outform der 2>/dev/null | \\
  openssl dgst -sha256 -hex | sed 's/^.* //'`},
{h:'Verify the cluster'},
{code:`kubectl get nodes -o wide                 # all Ready; correct VERSION
kubectl -n kube-system get pods -o wide   # CNI, kube-proxy, CoreDNS Running on every node
kubectl get --raw=/readyz?verbose | tail -n 5

# Label workers (cosmetic, makes get nodes readable)
kubectl label node w1 node-role.kubernetes.io/worker=

# Smoke test
kubectl create deployment hello --image=nginx:1.27 --replicas=4
kubectl get pods -o wide                  # spread across workers
kubectl expose deployment hello --port=80 --type=NodePort
kubectl get svc hello
curl http://<node-ip>:<nodeport>
kubectl delete svc,deployment hello`},
{h:'Common join problems'},
{t:[['Message','Fix'],
['`couldn\'t validate the identity of the API Server`','Wrong or missing CA hash, or token expired'],
['`connection refused` / timeout to :6443','Firewall or wrong address; test with `nc -zv`'],
['Node joined but NotReady','CNI not running on the new node; check kubelet logs'],
['`kubelet is not running` during join','Runtime not running, swap on, or cgroup driver mismatch']]},
{note:'Control plane nodes are tainted `node-role.kubernetes.io/control-plane:NoSchedule`, so your smoke test Pods land on workers only. On a single-node lab you must remove the taint with `kubectl taint nodes <node> node-role.kubernetes.io/control-plane-`.'}],
src:[['kubeadm join',K.R+'setup-tools/kubeadm/kubeadm-join/'],['Creating a cluster with kubeadm',KB+'create-cluster-kubeadm/'],['kubeadm token',K.R+'setup-tools/kubeadm/kubeadm-token/']]};

/* ---------- 6: HA topologies ---------- */
L['k8s:3:6']={blocks:[
{p:'A single control plane node is a single point of failure for the **management** of the cluster. An HA control plane runs several API servers, schedulers, controller managers and an etcd cluster so the loss of one machine does not stop you from operating.'},
{svg:topo},
{t:[['','Stacked etcd','External etcd'],
['Layout','etcd runs on the same nodes as control plane components','etcd on its own hosts'],
['Nodes needed (HA)','3 (minimum)','3 control plane + 3 etcd = 6'],
['Simplicity','Simpler; kubeadm manages everything','More machines and certificates to manage'],
['Failure coupling','Losing a node loses an apiserver **and** an etcd member','Failures are independent'],
['Typical use','Most clusters; kubeadm default','Large, critical clusters, or strict isolation of etcd']]},
{h:'The load balancer'},
{p:'Clients and kubelets must reach the API server through a stable address. Put a **load balancer** (HAProxy plus keepalived, a cloud load balancer, or kube-vip) in front of the API servers on port 6443, and use its address as `--control-plane-endpoint` at `kubeadm init`.'},
{flow:['Create the load balancer with a DNS name','kubeadm init --control-plane-endpoint lb:6443 --upload-certs','kubeadm join ... --control-plane on the 2nd node','kubeadm join ... --control-plane on the 3rd node','Join workers using the same endpoint']},
{h:'Failure tolerance'},
{t:[['Control plane nodes (stacked)','Etcd quorum','Nodes you can lose'],['1','1','0'],['2','2','0 (never run 2)'],['3','2','1'],['5','3','2']]},
{ul:['Spread nodes across failure zones, but keep latency between etcd members low.','HA protects the control plane. Your applications are protected by replicas spread across worker nodes and zones (Section 6).','Test failure: stop the kubelet or shut down one control plane node and confirm `kubectl` still works through the load balancer.']},
{note:'The load balancer itself must be redundant. A single HAProxy VM in front of three control plane nodes only moves the single point of failure.'}],
src:[['Options for Highly Available Topology',KB+'ha-topology/'],['Creating Highly Available Clusters with kubeadm',KB+'high-availability/']]};

/* ---------- 7: Config files and reset ---------- */
L['k8s:3:7']={blocks:[
{p:'Long lists of `kubeadm init` flags are hard to review and repeat. A **configuration file** captures them in YAML you can store in Git, and `kubeadm reset` lets you tear nodes down cleanly to try again.'},
{h:'A configuration file'},
{code:`# kubeadm-config.yaml
apiVersion: kubeadm.k8s.io/v1beta4
kind: InitConfiguration
localAPIEndpoint:
  advertiseAddress: 192.168.56.10
  bindPort: 6443
nodeRegistration:
  criSocket: unix:///run/containerd/containerd.sock
  name: cp1
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
  certSANs:
  - k8s-api.example.com
---
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
cgroupDriver: systemd`},
{code:`sudo kubeadm init --config kubeadm-config.yaml
sudo kubeadm init --config kubeadm-config.yaml --dry-run

# Generate a template, and convert an old config
kubeadm config print init-defaults
kubeadm config migrate --old-config old.yaml --new-config new.yaml

# See the config of the running cluster
kubectl -n kube-system get cm kubeadm-config -o yaml`},
{note:'The kubeadm config API version changes over time (v1beta3, v1beta4, ...). Use `kubeadm config print init-defaults` on your installed version to get the right apiVersion and field names.'},
{h:'Joining with a file'},
{code:`# join-config.yaml
apiVersion: kubeadm.k8s.io/v1beta4
kind: JoinConfiguration
discovery:
  bootstrapToken:
    apiServerEndpoint: k8s-api.example.com:6443
    token: abcdef.0123456789abcdef
    caCertHashes:
    - sha256:<hash>
nodeRegistration:
  criSocket: unix:///run/containerd/containerd.sock`},
{h:'kubeadm reset'},
{p:'`kubeadm reset` undoes what init or join did on **that node**: stops the kubelet, removes certificates and manifests, and cleans up. It does not clean everything.'},
{code:`sudo kubeadm reset -f
sudo rm -rf /etc/cni/net.d
sudo iptables -F && sudo iptables -t nat -F && sudo iptables -t mangle -F && sudo iptables -X
rm -rf $HOME/.kube
# On a worker you are removing, drain and delete it from the API first:
kubectl drain w2 --ignore-daemonsets --delete-emptydir-data
kubectl delete node w2`},
{ul:['Reset does not remove CNI configuration or iptables rules; clean them manually as shown.','On a control plane node that is part of a stacked etcd cluster, remove the member from etcd cleanly; kubeadm reset tries to do this.','Keep your config file in Git. Rebuilding a lab then takes minutes.']}],
src:[['Customizing components with the kubeadm API',KB+'control-plane-flags/'],['kubeadm configuration (v1beta4)',K.R+'config-api/kubeadm-config.v1beta4/'],['kubeadm reset',K.R+'setup-tools/kubeadm/kubeadm-reset/']]};
})();
