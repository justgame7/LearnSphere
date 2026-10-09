/* LearnSphere - Kubernetes Administrator, Section 11: Cluster Lifecycle: Upgrades, Backup & Maintenance.
   Lectures 0-6 are core, 7-11 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T,R=K.R;
const KB=K.S+'production-environment/tools/kubeadm/';

const skew=K.dg(700,230,[
[10,10,680,210,'Supported version skew (example: API server at 1.37)',1],
[30,50,200,60,'kube-apiserver|1.37 (reference)',2],
[260,50,200,60,'controller-manager, scheduler|1.37 or 1.36',0],
[490,50,180,60,'kubectl|1.36, 1.37 or 1.38',0],
[30,135,300,60,'kubelet, kube-proxy|1.37 down to 1.34 (never newer than the API server)',0],
[360,135,310,60,'Upgrade order: control plane first, then workers,|one minor version at a time',2]],
[]);

const order=K.dg(700,190,[
[10,60,130,60,'1. Read notes|check deprecated APIs|back up etcd',0],[165,60,130,60,'2. First control|plane node|kubeadm upgrade apply',2],[320,60,130,60,'3. Other control|plane nodes|kubeadm upgrade node',2],[475,60,110,60,'4. Workers|one at a time|drain, upgrade',2],[610,60,80,60,'5. Verify|workloads',0]],
[[140,90,165,90],[295,90,320,90],[450,90,475,90],[585,90,610,90]]);

const snap=K.dg(700,200,[
[10,70,130,60,'etcd (running)|static Pod',0],[190,70,150,60,'snapshot save|snapshot.db',2],[390,70,140,60,'snapshot status|verify hash',0],[580,70,110,60,'Copy off-node|(object storage)',0],
[190,150,340,40,'Restore: new data dir, then point the etcd manifest at it',1]],
[[140,100,190,100],[340,100,390,100],[530,100,580,100]]);

/* ---------- 0: Version skew ---------- */
L['k8s:10:0']={blocks:[
{p:'A cluster is made of components released together but upgraded at different times. The **version skew policy** says which combinations are supported, and it dictates the order of every upgrade.'},
{svg:skew},
{t:[['Component','Allowed relative to kube-apiserver'],
['kube-apiserver (HA members)','At most one minor apart during an upgrade'],
['kube-controller-manager, kube-scheduler, cloud-controller-manager','Same minor as the API server, or one minor older; never newer'],
['kubelet','Same minor, or up to **three** minors older; never newer'],
['kube-proxy','Same minor as the kubelet on the node, within three minors of the API server'],
['kubectl','Within **one** minor, older or newer']]},
{note:'These limits have changed over time (the kubelet allowance used to be two minors). Always read the Version Skew Policy for the exact version you run before planning an upgrade.'},
{h:'Rules that follow from the table'},
{ul:['**Control plane first, workers second.** A kubelet must never be newer than the API server.','**One minor at a time.** Skipping minors is unsupported. 1.34 to 1.37 means three separate upgrades (1.35, 1.36, 1.37).','**Patch upgrades can jump**: 1.37.1 to 1.37.9 directly.','Because kubelets can lag, you can upgrade the control plane promptly and roll workers out over days, but do not rely on long gaps: stay within support.']},
{h:'Support window'},
{ul:['Only the three most recent minor releases receive patches (roughly one year each).','Falling behind means several upgrades in a row, each with its own deprecations. Plan one upgrade per release or at least a few per year.','Managed services publish their own supported-version lists and force-upgrade clusters that fall out of support.']},
{code:`kubectl version                                  # client and server
kubectl get nodes -o custom-columns=NAME:.metadata.name,KUBELET:.status.nodeInfo.kubeletVersion
kubectl -n kube-system get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image | grep -E "apiserver|scheduler|controller|proxy|etcd"
kubeadm version -o short`},
{p:'Check what the plan is before you start: current version, target version, the kubelet versions on every node and how many minors apart they are.'}],
src:[['Version Skew Policy','https://kubernetes.io/releases/version-skew-policy/'],['Kubernetes Releases','https://kubernetes.io/releases/'],['Upgrade a kubeadm cluster',K.T+'administer-cluster/kubeadm/kubeadm-upgrade/']]};

/* ---------- 1: Pre-upgrade checks ---------- */
L['k8s:10:1']={blocks:[
{p:'Most failed upgrades fail **before** they start: removed APIs, an incompatible runtime, or no way back. This checklist takes about an hour and prevents most surprises.'},
{svg:order},
{h:'Checklist'},
{t:[['Check','How'],
['Read the release notes for **every** minor you cross','Look for "Urgent upgrade notes", deprecations and removals'],
['Find objects using **deprecated or removed APIs**','`kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis`; scan manifests and Helm charts with a tool such as kubent or pluto'],
['Container runtime and cgroup mode compatible with the target kubelet','`containerd --version`, `stat -fc %T /sys/fs/cgroup`'],
['CNI, CoreDNS, ingress and other add-ons support the target version','Add-on release notes'],
['Cluster is healthy','Nodes Ready, system Pods Running, no Pending workloads'],
['Workloads can survive a node drain','At least two replicas, PodDisruptionBudgets, no bare Pods or local-only storage'],
['**Backup**','etcd snapshot (see the etcd lecture) plus application data backups'],
['Rollback plan and maintenance window','Written down, with who does what']]},
{code:`kubectl get nodes
kubectl get pods -A | grep -v -E "Running|Completed"
kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis | head
kubectl get pdb -A
kubectl get pods -A --field-selector spec.nodeName= -o wide     # unscheduled Pods
containerd --version
stat -fc %T /sys/fs/cgroup                                       # cgroup2fs`},
{h:'Runtime and cgroup considerations'},
{ul:['Check the target release notes for runtime requirements. Official runtime documentation states that older containerd (1.x) stops working with newer kubelets because a fallback is dropped (in Kubernetes 1.38), so move to containerd 2.x before you reach that version.','Make sure the kubelet and runtime use the **systemd cgroup driver** and that the host uses cgroup v2, since support for cgroup v1 is on a removal path.']},
{h:'Deprecated API example'},
{p:'An old manifest using `apiVersion: policy/v1beta1` for PodDisruptionBudget stops applying once that version is removed. Convert manifests **before** the upgrade, because the API server will reject the old version afterwards, and your CI or GitOps tool will start failing.'},
{code:`kubectl convert -f old.yaml --output-version policy/v1      # kubectl-convert plugin
grep -rn "apiVersion:" manifests/ | sort | uniq -c | sort -rn`},
{note:'Upgrade a non-production cluster first, with the same add-ons and a representative workload. Surprises on a clone are free; surprises in production are not.'}],
src:[['Deprecated API Migration Guide',R+'using-api/deprecation-guide/'],['Upgrade a kubeadm cluster',T+'administer-cluster/kubeadm/kubeadm-upgrade/'],['Kubernetes Release Notes','https://kubernetes.io/releases/notes/']]};

/* ---------- 2: Upgrading control plane ---------- */
L['k8s:10:2']={blocks:[
{p:'Upgrade the **first control plane node** with `kubeadm upgrade apply`; every **other** control plane node uses `kubeadm upgrade node`. This example moves a cluster from one minor to the next. Substitute your versions.'},
{h:'1. Switch the package repository to the target minor'},
{code:`# Debian / Ubuntu: edit the repository file to the NEW minor
sudo sed -i 's#/stable:/v1.36/#/stable:/v1.37/#' /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
apt-cache madison kubeadm | head                 # find the latest patch, for example 1.37.1-1.1`},
{h:'2. Upgrade kubeadm and plan'},
{code:`sudo apt-mark unhold kubeadm
sudo apt-get install -y kubeadm='1.37.1-*'
sudo apt-mark hold kubeadm
kubeadm version -o short

sudo kubeadm upgrade plan                        # shows available versions and what will change`},
{h:'3. Apply on the first control plane node'},
{code:`sudo kubeadm upgrade apply v1.37.1
# ... [upgrade/successful] SUCCESS! Your cluster was upgraded to "v1.37.1". Enjoy!

# What it did: preflight checks, backed up the static Pod manifests and etcd data directory
# (see /etc/kubernetes/tmp), upgraded apiserver, controller-manager, scheduler, etcd and
# kube-proxy and CoreDNS add-ons, renewed certificates that were about to expire`},
{h:'4. Upgrade kubelet and kubectl on that node'},
{code:`kubectl drain cp1 --ignore-daemonsets            # control plane nodes can run CoreDNS and other workloads
sudo apt-mark unhold kubelet kubectl
sudo apt-get install -y kubelet='1.37.1-*' kubectl='1.37.1-*'
sudo apt-mark hold kubelet kubectl
sudo systemctl daemon-reload
sudo systemctl restart kubelet
kubectl uncordon cp1`},
{h:'5. Other control plane nodes'},
{code:`# on each additional control plane node, one at a time
# (switch the repo and upgrade the kubeadm package as above)
sudo kubeadm upgrade node                        # NOT "apply"
# then drain, upgrade kubelet/kubectl, restart kubelet, uncordon as in step 4`},
{h:'Verify'},
{code:`kubectl get nodes                                # control plane nodes show the new VERSION
kubectl -n kube-system get pods -o wide
kubectl get --raw=/readyz?verbose | tail -n 3
kubectl -n kube-system get pods -l component=kube-apiserver -o jsonpath='{.items[*].spec.containers[0].image}'`},
{ul:['All control plane containers restart during the upgrade because their configuration changes. With one API server, `kubectl` is briefly unavailable; with an HA load balancer it is not.','If `apply` fails midway, read the output, fix the cause and run it again: it is designed to be re-run. The backed-up manifests can restore a component.','`kubeadm upgrade` does not touch your workloads, only Kubernetes components. It also does not install a CNI or other add-ons that you manage yourself: upgrade those separately.']},
{note:'Do not drain a single control plane node cluster in a way that removes CoreDNS with nowhere to go. In a lab with one control plane node it is fine to skip the drain for the control plane, but never skip it for workers.'}],
src:[['Upgrading kubeadm clusters',K.T+'administer-cluster/kubeadm/kubeadm-upgrade/'],['kubeadm upgrade',K.R+'setup-tools/kubeadm/kubeadm-upgrade/'],['Changing the package repository',K.T+'administer-cluster/kubeadm/change-package-repository/']]};

/* ---------- 3: Workers ---------- */
L['k8s:10:3']={blocks:[
{p:'Once the control plane is on the new version, upgrade workers **one at a time** (or in small batches that your workload capacity allows).'},
{flow:['Drain the node from a machine with kubectl','On the node: switch the repository and upgrade kubeadm','kubeadm upgrade node','Upgrade kubelet and kubectl packages','Restart the kubelet','Uncordon and verify']},
{code:`# from your admin machine
kubectl drain w1 --ignore-daemonsets --delete-emptydir-data

# on w1
sudo sed -i 's#/stable:/v1.36/#/stable:/v1.37/#' /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
sudo apt-mark unhold kubeadm kubelet kubectl
sudo apt-get install -y kubeadm='1.37.1-*'
sudo kubeadm upgrade node                         # updates the local kubelet configuration
sudo apt-get install -y kubelet='1.37.1-*' kubectl='1.37.1-*'
sudo apt-mark hold kubeadm kubelet kubectl
sudo systemctl daemon-reload
sudo systemctl restart kubelet

# from your admin machine
kubectl uncordon w1
kubectl get nodes`},
{h:'What can go wrong'},
{t:[['Symptom','Cause and fix'],
['Drain stuck','A PodDisruptionBudget blocks eviction, or a bare Pod or emptyDir Pod needs flags. Fix the app or use `--force` knowingly'],
['Node NotReady after the kubelet restart','Runtime or cgroup driver mismatch, or the kubelet cannot read its config. `journalctl -u kubelet`'],
['Workloads lose capacity during the upgrade','Too many nodes drained at once; reduce batch size'],
['Version shows the old kubelet','Package not upgraded or kubelet not restarted']]},
{ul:['Keep node pools or groups: upgrade one pool at a time to limit blast radius.','Never upgrade a worker before the control plane: the kubelet must not be newer than the API server.','After an upgrade all Pods on the node were recreated, so applications must tolerate restarts. This is why replicas and PDBs matter.']},
{h:'Managed services and immutable nodes'},
{p:'On EKS, AKS and GKE you upgrade the control plane with a provider API, then **roll node pools** (replace nodes with new images, surge or blue-green) instead of upgrading packages in place. The same rules apply: control plane first, drain gracefully, one minor at a time. Many teams also treat self-managed workers as **replaceable**: build a new node on the new version, join it and remove an old one.'}],
src:[['Upgrade Linux nodes',K.T+'administer-cluster/kubeadm/upgrading-linux-nodes/'],['Safely Drain a Node',K.T+'administer-cluster/safely-drain-node/']]};

/* ---------- 4: etcd backup and restore ---------- */
L['k8s:10:4']={blocks:[
{p:'The cluster state lives in etcd, so **an etcd snapshot is the cluster backup** for self-managed control planes. Take one before every upgrade and on a schedule, and practise restoring it.'},
{svg:snap},
{h:'Take a snapshot'},
{code:`sudo ETCDCTL_API=3 etcdctl snapshot save /var/backups/etcd-$(date +%F-%H%M).db \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key

# Verify it (etcdutl is the offline tool in current etcd releases; older etcdctl also has snapshot status)
sudo etcdutl snapshot status /var/backups/etcd-2026-10-09-1200.db --write-out=table`},
{ul:['Find the certificate paths and endpoint in `/etc/kubernetes/manifests/etcd.yaml` (`--cert-file`, `--key-file`, `--trusted-ca-file`, `--listen-client-urls`).','Copy snapshots **off the node**, to object storage or another host, and encrypt them: they contain every Secret.','Snapshots capture etcd only. **Persistent volume data is not included**, nor are certificates in `/etc/kubernetes/pki`. Back those up as well.']},
{h:'Restore'},
{p:'A restore creates a **new data directory** from the snapshot. Then the etcd static Pod is pointed at it. On a multi-member cluster, restore every member from the same snapshot with a new cluster identity.'},
{code:`# 1. Restore into a NEW directory (single-node control plane example)
sudo etcdutl snapshot restore /var/backups/etcd-2026-10-09-1200.db --data-dir /var/lib/etcd-restored
# older tooling: sudo ETCDCTL_API=3 etcdctl snapshot restore <file> --data-dir /var/lib/etcd-restored

# 2. Edit the etcd static Pod manifest: change the hostPath of the data volume
sudo vim /etc/kubernetes/manifests/etcd.yaml
#   volumes:
#   - hostPath:
#       path: /var/lib/etcd-restored        # was /var/lib/etcd
#       type: DirectoryOrCreate
#     name: etcd-data

# 3. The kubelet recreates etcd; wait, then check
sudo crictl ps | grep etcd
kubectl get nodes
kubectl get pods -A`},
{h:'What a restore means'},
{ul:['The cluster returns to the **state at snapshot time**. Objects created after it are gone, objects deleted after it reappear.','Running containers on nodes are reconciled against the restored state: Pods that no longer exist in the API are killed.','Practise restore on a throwaway cluster. A backup you have never restored is a hope, not a plan.','On managed services the provider backs up etcd for you; use Velero or similar to back up your own resources and volumes.']},
{note:'Exam tip: you are usually told the snapshot path and the certificate locations. Use `etcdutl snapshot restore` (or `etcdctl` if told) with a new `--data-dir`, then change the hostPath in the etcd manifest. Do not forget this last step.'}],
src:[['Operating etcd clusters for Kubernetes',K.T+'administer-cluster/configure-upgrade-etcd/'],['etcd disaster recovery','https://etcd.io/docs/latest/op-guide/recovery/']]};

/* ---------- 5: Certificate expiry ---------- */
L['k8s:10:5']={blocks:[
{p:'kubeadm leaf certificates last about **one year**. If you never upgrade and never renew, one day the API server stops accepting kubelet or admin connections. This lecture covers checking and renewing them.'},
{code:`sudo kubeadm certs check-expiration
# CERTIFICATE                EXPIRES                  RESIDUAL TIME   CERTIFICATE AUTHORITY
# admin.conf                 Oct 09, 2027 12:00 UTC   364d            ca
# apiserver                  Oct 09, 2027 12:00 UTC   364d            ca
# ...
# CERTIFICATE AUTHORITY      EXPIRES                  RESIDUAL TIME
# ca                         Oct 07, 2036 12:00 UTC   9y`},
{ul:['Leaf certificates: about 1 year. CAs: about 10 years.','`kubeadm upgrade apply` and `upgrade node` **renew** certificates automatically, so regularly upgraded clusters rarely expire.','Kubelet client certificates can rotate automatically when `rotateCertificates` is enabled (default with kubeadm).','Certificates that kubeadm does not manage, such as your own user certificates, need their own tracking.']},
{h:'Renew'},
{code:`sudo kubeadm certs renew all                      # or one: apiserver, apiserver-kubelet-client, front-proxy-client ...
sudo kubeadm certs check-expiration

# Control plane components must reload the new certificates:
# move the manifests out and back (the kubelet stops, then recreates the static Pods)
cd /etc/kubernetes/manifests && sudo mkdir -p /root/manifests-hold && sudo mv *.yaml /root/manifests-hold/
sleep 30
sudo mv /root/manifests-hold/*.yaml /etc/kubernetes/manifests/
# admin.conf was renewed too: refresh your kubeconfig copy
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config`},
{h:'If it already expired'},
{ul:['`kubectl` shows `x509: certificate has expired`. Run the renewal **on the control plane node** using the local files: `kubeadm certs renew all` works even when the API is down.','Then restart the control plane Pods (above), restart the kubelet and refresh kubeconfig files.','Check the system clock first: a wrong date makes valid certificates look expired.']},
{h:'Monitoring'},
{p:'Alert at 30 days remaining. Prometheus exporters or a simple cron job running `kubeadm certs check-expiration` and posting to chat are enough. Also track **external** certificates such as Ingress TLS, which cert-manager can renew automatically.'},
{note:'Do not renew the CA lightly. Replacing a CA means redistributing trust to every kubelet and kubeconfig, which is a full maintenance project of its own.'}],
src:[['Certificate Management with kubeadm',K.T+'administer-cluster/kubeadm/kubeadm-certs/'],['PKI certificates and requirements',K.S+'best-practices/certificates/']]};

/* ---------- 6: Practical ---------- */
L['k8s:10:6']={blocks:[
{p:'Capstone lab for the section. You need a kubeadm cluster (1 control plane, 2 workers) on a version **one minor behind** a release you can upgrade to, with a small workload running. Work in a lab only.'},
{h:'1. Baseline'},
{code:`kubectl get nodes -o wide
kubectl create deployment web --image=nginx:1.27 --replicas=3
kubectl create configmap marker --from-literal=state=before-upgrade
kubectl create poddisruptionbudget web-pdb --selector=app=web --min-available=2
kubectl get all,cm,pdb`},
{h:'2. Snapshot etcd and keep it off the node'},
{code:`sudo ETCDCTL_API=3 etcdctl snapshot save /root/pre-upgrade.db \\
  --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key
sudo etcdutl snapshot status /root/pre-upgrade.db --write-out=table
scp /root/pre-upgrade.db backup-host:/backups/`},
{h:'3. Upgrade the control plane'},
{flow:['Change the repo to the next minor','Upgrade kubeadm, run kubeadm upgrade plan','kubeadm upgrade apply','Drain, upgrade kubelet and kubectl, restart, uncordon','Check kubectl get nodes and system Pods']},
{h:'4. Upgrade one worker while watching the app'},
{code:`# terminal 1
kubectl get pods -o wide -w
# terminal 2: keep requesting the app through a Service
kubectl expose deployment web --port=80
kubectl run probe --rm -it --image=busybox:1.36 --restart=Never -- sh -c 'while true; do wget -qO- -T 2 http://web >/dev/null && echo ok || echo FAIL; sleep 1; done'
# terminal 3: drain w1, upgrade kubeadm/kubelet, restart kubelet, uncordon w1
# repeat for w2`},
{p:'You should see Pods rescheduled but few or no FAIL lines, because the PDB keeps two replicas available and the Service only sends traffic to Ready Pods.'},
{h:'5. Verify'},
{code:`kubectl get nodes                                  # all Ready, all on the new version
kubectl get cm marker -o jsonpath='{.data.state}'  # still there
kubectl -n kube-system get pods
sudo kubeadm certs check-expiration                # renewed by the upgrade`},
{h:'6. Practise the restore (optional but valuable)'},
{code:`kubectl delete cm marker                           # simulate a mistake
sudo etcdutl snapshot restore /root/pre-upgrade.db --data-dir /var/lib/etcd-restored
# point the etcd manifest hostPath to /var/lib/etcd-restored, wait for etcd to restart
kubectl get cm marker                              # the object is back`},
{note:'Restoring a pre-upgrade snapshot into a cluster that was already upgraded is not a supported rollback of Kubernetes versions. In real incidents plan a restore to the **same** version the snapshot came from.'},
{ul:['Which step would block the drain if `web` had only 1 replica and a PDB `minAvailable: 1`?','Why must workers be upgraded after the control plane?','What does `kubeadm upgrade node` do differently from `apply`?']}],
src:[['Upgrading kubeadm clusters',K.T+'administer-cluster/kubeadm/kubeadm-upgrade/'],['Operating etcd clusters for Kubernetes',K.T+'administer-cluster/configure-upgrade-etcd/']]};
})();
