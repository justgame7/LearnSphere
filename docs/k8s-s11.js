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
{p:'A cluster is not one program but a set of components, released together and **upgraded at different moments**. During an upgrade the control plane is on one version while nodes are still on another. The **version skew policy** states which combinations are supported. It is the rulebook behind every upgrade plan, and it explains why upgrades must happen **in a fixed order, one minor version at a time**.'},
{h:'Reading a version'},
{p:'Versions look like `v1.37.1`: major 1, **minor 37**, **patch 1**. A **minor** release (1.36 to 1.37) brings features and may deprecate or remove APIs. A **patch** release (1.37.0 to 1.37.1) contains only bug and security fixes. The project ships about **three minor releases a year** and supports the three newest (each with roughly a year of patches).'},
{svg:skew},
{h:'The skew rules'},
{t:[['Component','Allowed relative to the kube-apiserver','Why'],
['kube-apiserver (HA members)','At most **one minor** apart while upgrading','Instances share etcd and must agree on stored formats'],
['kube-controller-manager, kube-scheduler, cloud-controller-manager','Same minor, or **one minor older**; never newer','They speak to the API server and must understand its API'],
['**kubelet**','Same minor, or up to **three minors older**; **never newer**','Nodes can lag behind a control plane upgrade'],
['kube-proxy','Same minor as the kubelet on that node; within the kubelet range','It runs beside the kubelet'],
['**kubectl**','Within **one minor**, older or newer','The client should understand the server API']]},
{note:'Skew allowances have changed over time (the kubelet allowance used to be two minors). Always read the Version Skew Policy for the exact release you run before planning an upgrade, and do not rely on a table you memorised.'},
{h:'What the rules imply for upgrades'},
{ul:['**Control plane first, workers second.** A kubelet must never be newer than the API server.','**One minor at a time.** Skipping minors is unsupported: 1.34 to 1.37 means three separate upgrades (1.35, 1.36, 1.37).','**Patch upgrades may jump**: 1.37.1 to 1.37.9 in one step is fine.','Within an HA control plane, upgrade the API servers one by one; the one-minor difference is only for the duration of the upgrade.','Because kubelets may lag, you can upgrade the control plane promptly and roll workers over days, but do not stay long in the mixed state.']},
{h:'Support window'},
{t:[['Situation','Consequence'],
['You run the newest minor','Patched for about a year; plan the next upgrade within that window'],
['You are one or two minors behind','Still supported, but each skipped release adds deprecations to handle later'],
['Out of support (older than the three newest)','**No security patches**; upgrading means several sequential upgrades'],
['Managed service','The provider publishes its own supported list and can force-upgrade clusters that fall out of support']]},
{p:'Falling behind compounds: a cluster two years behind needs many upgrades back to back, each with its own removed APIs. A steady cadence (one upgrade per release, or at least a few per year) is cheaper than heroic catch-ups.'},
{h:'Check your versions'},
{code:`$ kubectl version
Client Version: v1.37.1
Server Version: v1.37.1
$ kubectl get nodes -o custom-columns=NAME:.metadata.name,KUBELET:.status.nodeInfo.kubeletVersion,RUNTIME:.status.nodeInfo.containerRuntimeVersion
NAME   KUBELET   RUNTIME
cp1    v1.37.1   containerd://2.0.x
w1     v1.36.4   containerd://2.0.x            # one minor behind the API server: allowed
$ kubectl -n kube-system get pods -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image | grep -E "apiserver|scheduler|controller|proxy|etcd|coredns"
$ kubeadm version -o short`},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Upgrading workers before the control plane','Kubelet newer than the API server: unsupported, may fail','Control plane first, always'],
['Skipping a minor version','Unsupported, can corrupt or break components','One minor at a time'],
['Leaving kubelets several minors behind indefinitely','Fall out of the skew window; harder upgrade later','Roll workers soon after the control plane'],
['Using a very old kubectl','Odd behaviour with new APIs','Keep within one minor of the server'],
['Ignoring that add-ons have their own skew rules','CNI, CoreDNS or ingress break after upgrade','Check each add-on compatibility']]},
{note:'Exam tip: for an upgrade task the order is fixed: plan, control plane first (`kubeadm upgrade apply`), then each worker (drain, upgrade, uncordon). Always check the current and target versions with `kubeadm version` and `kubectl get nodes`.'}],
src:[['Version Skew Policy','https://kubernetes.io/releases/version-skew-policy/'],['Kubernetes Releases','https://kubernetes.io/releases/'],['Upgrade a kubeadm cluster',K.T+'administer-cluster/kubeadm/kubeadm-upgrade/']]};

/* ---------- 1: Pre-upgrade checks ---------- */
L['k8s:10:1']={blocks:[
{p:'Most failed upgrades fail **before they start**: a manifest uses an API that the new version removed, the container runtime is too old, an add-on does not support the target release, or there is no way back. A pre-upgrade review takes about an hour and prevents most of these. Think of it as the safety briefing before a flight.'},
{svg:order},
{h:'The checklist and why each item exists'},
{t:[['Check','Why it matters','How'],
['**Release notes** of every minor you cross','Removals and behaviour changes are listed under "Urgent upgrade notes"','Read kubernetes.io release notes'],
['**Deprecated or removed APIs** in use','After the upgrade the API server rejects removed versions; CI and GitOps start failing','Metric `apiserver_requested_deprecated_apis`, scan manifests and charts (kubent, pluto)'],
['**Container runtime** version and **cgroup** setup','A newer kubelet may require a newer runtime (containerd 2.x) and the systemd driver on cgroup v2','`containerd --version`, `stat -fc %T /sys/fs/cgroup`'],
['**Add-ons** support the target version','CNI, CoreDNS, ingress, CSI, metrics-server, policy engines','Their release notes'],
['Cluster is **healthy now**','You cannot tell a problem you caused from one that was already there','Nodes Ready, system Pods Running, no stuck Pending'],
['Workloads survive a **drain**','Upgrading drains nodes: single replicas and missing PDBs cause outages','Replicas, PDBs, no bare Pods or local-only data'],
['**Backup**','Your way back','etcd snapshot plus application and volume backups'],
['Window, owners and **rollback plan**','Decisions are hard at 2 am','Written plan, tested in a non-production cluster']]},
{h:'Finding deprecated APIs'},
{code:`# the API server counts requests made to deprecated APIs
$ kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis | head -n 3
apiserver_requested_deprecated_apis{group="policy",removed_release="1.25",resource="podsecuritypolicies",version="v1beta1"} 1

# scan what is stored in the cluster and what is in Git
$ kubectl convert -f old.yaml --output-version networking.k8s.io/v1        # kubectl-convert plugin
$ grep -rn "apiVersion:" manifests/ charts/ | sed 's/.*apiVersion: //' | sort | uniq -c | sort -rn
# tools: kubent (cluster), pluto (files and Helm releases)`},
{p:'Stored objects are served in the new version automatically; the danger is **manifests in Git, Helm charts and operators** that still use the removed version: they will fail the next time they are applied.'},
{h:'Runtime and cgroup considerations'},
{ul:['Official runtime documentation states that older containerd (1.x) stops working with newer kubelets: the fallback that lets the kubelet cope with runtimes that cannot report their cgroup driver is dropped in Kubernetes 1.38, and Kubernetes 1.35 was the last release to support containerd 1.x. **Upgrade to containerd 2.x before you reach that version.**','Use the **systemd cgroup driver** and cgroup v2; support for cgroup v1 is on a removal path.','Check the **kernel and OS** support for the target release.']},
{h:'Health and readiness baseline'},
{code:`kubectl get nodes
kubectl get pods -A | grep -v -E "Running|Completed"          # should be empty
kubectl get --raw='/readyz?verbose' | grep -v ok
kubectl get pdb -A                                            # any ALLOWED DISRUPTIONS = 0 will block a drain
kubectl get deploy -A -o json | jq -r '.items[] | select(.spec.replicas==1) | .metadata.namespace+"/"+.metadata.name'   # single replicas
kubectl get pods -A --field-selector status.phase=Pending
kubeadm certs check-expiration                                # an upgrade renews them, but know the state
sudo ETCDCTL_API=3 etcdctl ... snapshot save /root/pre-upgrade.db      # the backup, last`},
{h:'Rehearse'},
{ul:['Upgrade a **non-production cluster first**, with the same add-ons, policies and a representative workload.','Time the drain of one node: how long until its Pods are healthy elsewhere?','Write down the **rollback**: for kubeadm that usually means restoring an etcd snapshot and static Pod manifests of the same version, or rebuilding.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Reading only the target release notes, not those of every minor crossed','Missing removals from intermediate versions','Read each'],
['No etcd snapshot','No way back','Always snapshot, and keep it off the node'],
['Testing nothing before production','Surprises in the live cluster','A staging cluster that mirrors production'],
['Upgrading add-ons after the cluster without checking support','CNI or ingress failures mid-upgrade','Check add-on compatibility first'],
['Starting with an unhealthy cluster','Cannot attribute failures','Fix existing problems first']]},
{note:'The best upgrade is boring: every risk was found in the checklist, the cluster was healthy, a backup exists and the steps are written down.'}],
src:[['Deprecated API Migration Guide',R+'using-api/deprecation-guide/'],['Upgrade a kubeadm cluster',T+'administer-cluster/kubeadm/kubeadm-upgrade/'],['Kubernetes Release Notes','https://kubernetes.io/releases/notes/']]};

/* ---------- 2: Upgrading control plane ---------- */
L['k8s:10:2']={blocks:[
{p:'Upgrading a kubeadm control plane has a fixed shape: the **first** control plane node uses `kubeadm upgrade apply`, every **other** control plane node uses `kubeadm upgrade node`, and on each of them you then upgrade the **kubelet and kubectl packages**. The commands are few; the value is in knowing **what each one changes**, because that tells you how to recover when a step fails. The example moves from 1.36 to 1.37; use your own versions.'},
{h:'What `kubeadm upgrade` does and does not touch'},
{t:[['Changes','Does not change'],
['Static Pod manifests of apiserver, controller manager, scheduler, etcd (new image tags and flags)','Your **workloads**'],
['The `kube-proxy` and CoreDNS add-ons','The **CNI** plugin and other add-ons you installed yourself'],
['Cluster configuration stored in the `kubeadm-config` ConfigMap','The kubelet **package** (you upgrade it)'],
['Leaf **certificates** (renewed if due)','The CAs']]},
{flow:['Switch the package repository to the target minor','Upgrade the kubeadm package','kubeadm upgrade plan: see what is available and what will change','kubeadm upgrade apply vX.Y.Z on the FIRST control plane node','Drain, upgrade kubelet and kubectl, restart the kubelet, uncordon','Other control plane nodes: kubeadm upgrade node, then the same kubelet steps','Then the workers (next lecture)']},
{h:'1. Repository and kubeadm'},
{code:`# Debian or Ubuntu: edit the repository to the NEW minor
sudo sed -i 's#/stable:/v1.36/#/stable:/v1.37/#' /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
apt-cache madison kubeadm | head -n 3                 # find the latest patch of the new minor

sudo apt-mark unhold kubeadm
sudo apt-get install -y kubeadm='1.37.1-*'
sudo apt-mark hold kubeadm
kubeadm version -o short`},
{h:'2. Plan'},
{code:`$ sudo kubeadm upgrade plan
[upgrade/config] Making sure the configuration is correct:
[upgrade] Running cluster health checks
Components that must be upgraded manually after you have upgraded the control plane with 'kubeadm upgrade apply':
COMPONENT   NODE   CURRENT    TARGET
kubelet     cp1    v1.36.4    v1.37.1
kubelet     w1     v1.36.4    v1.37.1
Upgrade to the latest stable version:
COMPONENT                 NODE   CURRENT    TARGET
kube-apiserver            cp1    v1.36.4    v1.37.1
etcd                      cp1    3.5.x      3.5.y
You can now apply the upgrade by executing: kubeadm upgrade apply v1.37.1`},
{h:'3. Apply on the first control plane node'},
{code:`$ sudo kubeadm upgrade apply v1.37.1
[upgrade/versions] Cluster version: v1.36.4 -> v1.37.1
[upgrade/prepull] Pulling images required for setting up a Kubernetes cluster
[upgrade/staticpods] Preparing for "kube-apiserver" upgrade
[upgrade/staticpods] Renewing apiserver certificate ... Moved new manifest to "/etc/kubernetes/manifests/kube-apiserver.yaml" and backed up old manifest to "/etc/kubernetes/tmp/kubeadm-backup-manifests-.../kube-apiserver.yaml"
[upgrade/staticpods] Component "kube-apiserver" upgraded successfully!
[addons] Applied essential addon: CoreDNS
[addons] Applied essential addon: kube-proxy
[upgrade] SUCCESS! Your cluster was upgraded to "v1.37.1". Enjoy!`},
{p:'kubeadm **backs up the old manifests and etcd data** before changing anything (look in `/etc/kubernetes/tmp`). The static Pods restart because their manifests change; with a single API server, `kubectl` is briefly unavailable. With an HA load balancer it is not.'},
{h:'4. The kubelet and kubectl on that node'},
{code:`kubectl drain cp1 --ignore-daemonsets                    # control plane nodes may run CoreDNS and other workloads
sudo apt-mark unhold kubelet kubectl
sudo apt-get install -y kubelet='1.37.1-*' kubectl='1.37.1-*'
sudo apt-mark hold kubelet kubectl
sudo systemctl daemon-reload
sudo systemctl restart kubelet
kubectl uncordon cp1
kubectl get nodes                                        # cp1 shows v1.37.1`},
{h:'5. Other control plane nodes'},
{code:`# on cp2 and cp3, one at a time
# (switch the repo, upgrade the kubeadm package as above)
sudo kubeadm upgrade node                                # NOT "apply": the cluster-wide steps are already done
# then drain, upgrade kubelet and kubectl, restart kubelet, uncordon`},
{h:'Verify'},
{code:`kubectl get nodes
kubectl get --raw='/readyz?verbose' | tail -n 3
kubectl -n kube-system get pods -o wide
kubectl -n kube-system get pods -l component=kube-apiserver -o jsonpath='{.items[*].spec.containers[0].image}{"\\n"}'
sudo kubeadm certs check-expiration                      # renewed by the upgrade`},
{h:'When a step fails'},
{t:[['Symptom','Cause and response'],
['`upgrade plan` reports a failed health check','Fix the unhealthy component first; do not force'],
['`apply` fails midway','Read the error, fix, **re-run it** (it is designed to be re-run); the backups allow manual restoration of a component'],
['API server does not come back after apply','`crictl logs`; compare with the backed-up manifest in `/etc/kubernetes/tmp`'],
['Node stays NotReady after the kubelet upgrade','Check `systemctl status kubelet`, runtime compatibility, cgroup driver'],
['Wrong version installed','`apt-cache madison kubeadm`, repository still pointing at the old minor'],
['Drain hangs on a control plane node','A PodDisruptionBudget or a bare Pod: handle as in Section 6']]},
{note:'Do not skip `kubeadm upgrade plan`: it is a free dry run that checks health and tells you exactly what will change.'}],
src:[['Upgrading kubeadm clusters',K.T+'administer-cluster/kubeadm/kubeadm-upgrade/'],['kubeadm upgrade',K.R+'setup-tools/kubeadm/kubeadm-upgrade/'],['Changing the package repository',K.T+'administer-cluster/kubeadm/change-package-repository/']]};

/* ---------- 3: Workers ---------- */
L['k8s:10:3']={blocks:[
{p:'With the control plane upgraded, the workers follow. This is where users feel an upgrade, because each worker is **drained**: its Pods are evicted and recreated elsewhere. Done carefully, one node at a time with a PodDisruptionBudget protecting each application, nobody notices. Done carelessly, the application is briefly or completely unavailable.'},
{h:'The routine for one worker'},
{flow:['Drain the node from a machine with kubectl (workloads move away)','On the node: switch the repository and upgrade kubeadm','kubeadm upgrade node: updates the local kubelet configuration','Upgrade the kubelet and kubectl packages and restart the kubelet','Uncordon and wait until the node is Ready and Pods spread back','Move on to the next node']},
{code:`# from your admin machine
kubectl drain w1 --ignore-daemonsets --delete-emptydir-data --timeout=300s

# on w1
sudo sed -i 's#/stable:/v1.36/#/stable:/v1.37/#' /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
sudo apt-mark unhold kubeadm kubelet kubectl
sudo apt-get install -y kubeadm='1.37.1-*'
sudo kubeadm upgrade node
sudo apt-get install -y kubelet='1.37.1-*' kubectl='1.37.1-*'
sudo apt-mark hold kubeadm kubelet kubectl
sudo systemctl daemon-reload && sudo systemctl restart kubelet

# from your admin machine
kubectl uncordon w1
$ kubectl get nodes
NAME   STATUS   ROLES           VERSION
cp1    Ready    control-plane   v1.37.1
w1     Ready    <none>          v1.37.1          # done
w2     Ready    <none>          v1.36.4          # next`},
{h:'Watching the effect on users'},
{p:'While you drain and upgrade, watch the application from a second terminal. With enough replicas and a PodDisruptionBudget you should see at most a few failures, and often none:'},
{code:`kubectl get pods -o wide -w                                  # Pods leave w1, appear elsewhere
kubectl run probe --rm -it --image=busybox:1.36 --restart=Never -- sh -c 'while true; do wget -qO- -T 2 http://web >/dev/null && echo ok || echo FAIL; sleep 1; done'`},
{h:'Capacity: how many nodes at a time?'},
{ul:['Draining a node removes its capacity. Make sure the **remaining nodes can host the evicted Pods**: check allocated resources (`kubectl describe node`).','One node at a time is the safe default. For big pools drain a small batch only if you have spare capacity (a surge node).','Stateful workloads: wait until replicas are caught up and healthy before the next node.','Spread critical Pods across zones so a batch does not take a whole zone.']},
{h:'What goes wrong'},
{t:[['Symptom','Cause','Fix'],
['Drain stuck','A PDB would be violated, a bare Pod, or emptyDir data without the flag','`kubectl get pdb -A`; add replicas or relax; use the correct flags'],
['Node `NotReady` after restarting the kubelet','Runtime or cgroup mismatch, bad kubelet config','`journalctl -u kubelet`, `systemctl status containerd`'],
['Pods Pending after the drain','Not enough capacity elsewhere, or taints and affinity','`describe pod`, add capacity'],
['Node still shows the old version','Package not upgraded or kubelet not restarted','`kubelet --version`, restart'],
['Application errors during the drain','Single replica, no readiness probe, slow shutdown','More replicas, probes, `preStop`'],
['Workloads do not return to the node','Uncordon only allows scheduling','`kubectl rollout restart` to rebalance if needed']]},
{h:'Managed services and replaceable nodes'},
{p:'On EKS, AKS and GKE you upgrade the control plane through the provider, then **roll node pools**: new nodes with the target version are created, old ones drained and deleted (surge or blue-green), rather than upgrading packages in place. Many self-managed teams do the same: treat workers as **replaceable**, build a new node on the new version, join it, remove an old one. The rules remain: control plane first, graceful drains, one minor at a time.'},
{note:'Exam tip: for a worker node upgrade task the commands are drain, then on that node `apt-get install kubeadm`, `kubeadm upgrade node`, install kubelet and kubectl, restart kubelet, then uncordon. Practise the whole sequence until it takes about five minutes.'}],
src:[['Upgrade Linux nodes',K.T+'administer-cluster/kubeadm/upgrading-linux-nodes/'],['Safely Drain a Node',K.T+'administer-cluster/safely-drain-node/']]};

/* ---------- 4: etcd backup and restore ---------- */
L['k8s:10:4']={blocks:[
{p:'On a self-managed cluster the only complete backup of the cluster **definition** is a snapshot of **etcd**. Every object, every RBAC rule, every Deployment lives there. Taking snapshots is easy; the skill that matters is knowing **exactly what a snapshot contains, what it does not, and how a restore works**, because you will only find out you got it wrong during an emergency.'},
{svg:snap},
{h:'What a snapshot contains'},
{t:[['In an etcd snapshot','Not in an etcd snapshot'],
['All API objects: Deployments, Services, ConfigMaps, **Secrets**, RBAC, CRDs and custom resources, Nodes, Events','**Volume data** (PersistentVolume contents)'],
['Cluster state at that moment','Certificates and keys in `/etc/kubernetes/pki`'],
['','Static Pod manifests and kubeconfigs on the nodes'],
['','Images, application databases, anything outside Kubernetes']]},
{p:'So a full cluster backup is **three** things: the etcd snapshot, the PKI and configuration files from the control plane nodes, and backups of persistent data. Because the snapshot contains every Secret, **protect and encrypt it**.'},
{h:'Taking a snapshot'},
{code:`$ sudo ETCDCTL_API=3 etcdctl snapshot save /var/backups/etcd-$(date +%F-%H%M).db \\
    --endpoints=https://127.0.0.1:2379 \\
    --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
    --cert=/etc/kubernetes/pki/etcd/server.crt \\
    --key=/etc/kubernetes/pki/etcd/server.key
Snapshot saved at /var/backups/etcd-2026-10-09-1200.db

$ sudo etcdutl snapshot status /var/backups/etcd-2026-10-09-1200.db --write-out=table      # verify (offline tool in recent etcd releases)
+----------+----------+------------+------------+
|   HASH   | REVISION | TOTAL KEYS | TOTAL SIZE |
+----------+----------+------------+------------+
| 7a1c0e3f |   482113 |       1342 |      12 MB |
$ scp /var/backups/etcd-*.db backup-host:/backups/            # OFF the node, encrypted`},
{ul:['The endpoint and certificate paths come from `/etc/kubernetes/manifests/etcd.yaml` (`--listen-client-urls`, `--cert-file`, `--key-file`, `--trusted-ca-file`).','Take snapshots **on a schedule** (a CronJob, systemd timer or backup tool) and **before every upgrade or risky change**.','A backup stored on the failing machine is not a backup.']},
{h:'Restoring: a new data directory'},
{p:'A restore does **not** overwrite the running database. It builds a **new data directory** from the snapshot, and then you point the etcd static Pod at it. The cluster returns to the **state at snapshot time**: objects created later are gone, objects deleted later come back.'},
{code:`# 1. restore into a NEW directory (single control plane example)
sudo etcdutl snapshot restore /var/backups/etcd-2026-10-09-1200.db --data-dir /var/lib/etcd-restored
# older tooling: sudo ETCDCTL_API=3 etcdctl snapshot restore <file> --data-dir /var/lib/etcd-restored

# 2. edit the etcd static Pod manifest: change the hostPath of the data volume
sudo vim /etc/kubernetes/manifests/etcd.yaml
#   volumes:
#   - hostPath:
#       path: /var/lib/etcd-restored          # was /var/lib/etcd
#       type: DirectoryOrCreate
#     name: etcd-data

# 3. the kubelet recreates etcd; wait and verify
sudo crictl ps | grep etcd
kubectl get nodes ; kubectl get pods -A`},
{flow:['Stop relying on the cluster; announce the restore','Restore the snapshot into a new data directory on the control plane node','Repoint the etcd manifest data hostPath to the new directory','The kubelet restarts etcd, then the API server reconnects','Verify objects, nodes and workloads; let controllers reconcile','Re-create anything created after the snapshot, from Git or your records']},
{h:'What a restore means for running workloads'},
{ul:['Kubelets reconcile node state with the restored API: Pods that **do not exist** in the restored data are stopped; Pods that exist but are missing on nodes are recreated.','Anything you created **after** the snapshot (a Deployment, a Secret) is gone. GitOps makes recovering it automatic.','Persistent volumes are **not** rolled back; the data on disk stays at its current state. A mismatch between application data and cluster objects can need manual care.','Restoring a snapshot into a cluster that has **already been upgraded** is not a supported rollback of Kubernetes versions: restore to the **same version** the snapshot came from.','For an HA control plane, restore **every** member from the same snapshot with new cluster identity, following the etcd disaster recovery guide.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Snapshot never tested','You find a corrupt or unusable backup in the emergency','Restore into a scratch cluster regularly'],
['Backup only on the control plane node','Lost with the machine','Copy off-site, encrypted, with retention'],
['Forgetting to edit the etcd manifest after restoring','etcd still runs the old data','Repoint `hostPath` to the restored directory'],
['No copy of the PKI directory','Rebuilt control plane cannot be trusted by existing nodes','Back up `/etc/kubernetes/pki` too'],
['Assuming a snapshot covers volumes','Application data lost','Back up persistent data separately (Velero, storage snapshots)'],
['Restoring across different cluster versions','Unsupported and unpredictable','Same version, then upgrade']]},
{note:'Exam tip: you are usually given the snapshot path and certificate locations. Use `etcdutl snapshot restore` (or `etcdctl` if told) with a **new** `--data-dir`, then change the etcd manifest `hostPath` to it. The last step is the one people forget.'}],
src:[['Operating etcd clusters for Kubernetes',K.T+'administer-cluster/configure-upgrade-etcd/'],['etcd disaster recovery','https://etcd.io/docs/latest/op-guide/recovery/']]};

/* ---------- 5: Certificate expiry ---------- */
L['k8s:10:5']={blocks:[
{p:'Certificates expire. On a kubeadm cluster the leaf certificates last **one year**, so a cluster that is never upgraded and never renewed will, one day, refuse to work: the API server rejects its own kubelets or you cannot log in with `kubectl`. This is an entirely avoidable outage once you know the dates and the procedure.'},
{h:'What expires and when'},
{code:`$ sudo kubeadm certs check-expiration
CERTIFICATE                EXPIRES                  RESIDUAL TIME   CERTIFICATE AUTHORITY   EXTERNALLY MANAGED
admin.conf                 Oct 01, 2027 08:00 UTC   357d            ca                      no
apiserver                  Oct 01, 2027 08:00 UTC   357d            ca                      no
apiserver-etcd-client      Oct 01, 2027 08:00 UTC   357d            etcd-ca                 no
apiserver-kubelet-client   Oct 01, 2027 08:00 UTC   357d            ca                      no
controller-manager.conf    Oct 01, 2027 08:00 UTC   357d            ca                      no
etcd-server                Oct 01, 2027 08:00 UTC   357d            etcd-ca                 no
front-proxy-client         Oct 01, 2027 08:00 UTC   357d            front-proxy-ca          no
scheduler.conf             Oct 01, 2027 08:00 UTC   357d            ca                      no
CERTIFICATE AUTHORITY      EXPIRES                  RESIDUAL TIME   EXTERNALLY MANAGED
ca                         Sep 28, 2036 08:00 UTC   9y              no`},
{t:[['Item','Lifetime','Renewed by'],
['Leaf certificates (API server, etcd, kubeconfigs of components, admin)','**1 year**','`kubeadm upgrade`, or `kubeadm certs renew`'],
['Cluster CAs (cluster, etcd, front-proxy)','**10 years**','Manual, a major project'],
['Kubelet client certificate','About 1 year','The kubelet itself when `rotateCertificates: true` (kubeadm default)'],
['Kubelet **serving** certificate','Per signer','Needs CSR approval when `serverTLSBootstrap` is on'],
['ServiceAccount signing key (`sa.key`)','No expiry','Manual rotation'],
['Your application certificates (Ingress TLS)','Per issuer','cert-manager']]},
{p:'`kubeadm upgrade apply` and `upgrade node` **renew** the leaf certificates, so a cluster upgraded at least once a year never expires. The danger is the "stable" cluster nobody touches.'},
{h:'Renewing'},
{code:`sudo kubeadm certs renew all                           # or one: apiserver, apiserver-kubelet-client, front-proxy-client ...
sudo kubeadm certs check-expiration

# Control plane components must reload the new certificates: recreate the static Pods
cd /etc/kubernetes/manifests && sudo mkdir -p /root/mh && sudo mv *.yaml /root/mh/ && sleep 30 && sudo mv /root/mh/*.yaml . && cd -
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config     # admin.conf was renewed too: refresh your copy
kubectl get nodes`},
{h:'After expiry: the recovery path'},
{code:`$ kubectl get nodes
Unable to connect to the server: x509: certificate has expired or is not yet valid: current time 2027-10-02T09:00:00Z is after 2027-10-01T08:00:00Z
# Renewal works LOCALLY on the control plane node even though the API is unreachable
sudo kubeadm certs renew all
# restart the control plane Pods (move manifests out and back) and restart the kubelet
sudo systemctl restart kubelet
# refresh admin.conf, then check workers: kubelets use their own rotating certificates`},
{flow:['Check the system clock first: a wrong date makes valid certificates look expired','SSH to a control plane node (kubectl will not work yet)','kubeadm certs renew all (works offline from the API)','Recreate the control plane static Pods and restart the kubelet','Copy the renewed admin.conf; confirm kubectl works','Repeat on every control plane node; check kubelet certificates on workers']},
{h:'Preventing it'},
{ul:['Put **expiry dates on a dashboard** and alert at 30 days: `kubeadm certs check-expiration` in a daily job, or exporters that read certificate files.','Include certificate renewal in your **upgrade routine** and in a calendar entry.','Enable kubelet **certificate rotation** and plan how serving certificate requests are approved.','Track **application** certificates separately with cert-manager and its metrics.','Never let the clock drift: run NTP on every node.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Renewing but not restarting the control plane Pods','The old certificates stay in memory; errors persist','Recreate the static Pods'],
['Forgetting to refresh `$HOME/.kube/config` after renewing `admin.conf`','kubectl still uses the expired client certificate','Copy the new file'],
['Renewing only one control plane node of an HA cluster','Other nodes expire later and surprise you','Renew on all'],
['Replacing a CA casually','Every kubeconfig and kubelet must trust the new CA','Treat CA rotation as a project'],
['Assuming a managed service covers application certificates','Your Ingress certificate still expires','cert-manager with alerts']]},
{note:'Exam tip: certificate tasks use `kubeadm certs check-expiration` to find expiry and `kubeadm certs renew <name>` to renew. Practise reading the table and renewing a single certificate as well as `all`.'}],
src:[['Certificate Management with kubeadm',K.T+'administer-cluster/kubeadm/kubeadm-certs/'],['PKI certificates and requirements',K.S+'best-practices/certificates/']]};

/* ---------- 6: Practical ---------- */
L['k8s:10:6']={blocks:[
{p:'This lab is the capstone of the section: you take a snapshot, upgrade the control plane and a worker by **one minor version** while an application keeps serving, verify everything, and optionally rehearse an etcd restore. You need a kubeadm cluster (one control plane, two workers) one minor behind the version you can upgrade to. **Use a lab only.** Read each step and **predict the result** before running it.'},
{h:'Plan'},
{flow:['Record the baseline: versions, workload, probe loop','Snapshot etcd and copy it off the node','Upgrade the control plane (plan, apply, kubelet)','Upgrade worker 1 while watching the application','Upgrade worker 2','Verify nodes, certificates and workload','Optional: delete an object and restore it from the snapshot']},
{h:'1. Baseline'},
{code:`kubectl get nodes -o wide
kubectl create deployment web --image=nginx:1.27 --replicas=3
kubectl expose deployment web --port=80
kubectl create configmap marker --from-literal=state=before-upgrade
kubectl create poddisruptionbudget web-pdb --selector=app=web --min-available=2
kubectl get all,cm,pdb
# in a second terminal, a continuous probe
kubectl run probe --image=busybox:1.36 --restart=Never -- sh -c 'while true; do wget -qO- -T 2 http://web >/dev/null && echo "$(date +%T) ok" || echo "$(date +%T) FAIL"; sleep 1; done'
kubectl logs -f probe`},
{h:'2. Snapshot and copy it away'},
{code:`sudo ETCDCTL_API=3 etcdctl snapshot save /root/pre-upgrade.db \\
  --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key
sudo etcdutl snapshot status /root/pre-upgrade.db --write-out=table
scp /root/pre-upgrade.db backup-host:/backups/
sudo cp -r /etc/kubernetes /root/k8s-config-backup       # PKI and manifests too`},
{h:'3. Control plane'},
{code:`# switch the package repository to the next minor, then
sudo apt-mark unhold kubeadm && sudo apt-get install -y kubeadm='1.37.1-*' && sudo apt-mark hold kubeadm
sudo kubeadm upgrade plan
sudo kubeadm upgrade apply v1.37.1
kubectl drain cp1 --ignore-daemonsets
sudo apt-mark unhold kubelet kubectl && sudo apt-get install -y kubelet='1.37.1-*' kubectl='1.37.1-*' && sudo apt-mark hold kubelet kubectl
sudo systemctl daemon-reload && sudo systemctl restart kubelet
kubectl uncordon cp1
kubectl get nodes`},
{p:'**Predict:** will the probe fail while the API server restarts? Probably not at all: running Pods and Services do not depend on the API server. **Check:** the probe log shows `ok` throughout, even if `kubectl` itself paused for a moment.'},
{h:'4. Workers, one at a time'},
{code:`# for w1, then w2:
kubectl drain w1 --ignore-daemonsets --delete-emptydir-data
# on w1: repository, kubeadm package, "sudo kubeadm upgrade node", kubelet and kubectl packages, restart kubelet
kubectl uncordon w1
kubectl get pods -o wide                                   # web Pods rebalanced; PDB kept at least 2 up
kubectl get pdb web-pdb                                    # ALLOWED DISRUPTIONS changes during the drain`},
{p:'**Observe:** the drain waits when the PDB would be violated (`Cannot evict pod as it would violate the pod\'s disruption budget`) and continues as soon as a replacement is Ready. That waiting is the safety mechanism working.'},
{h:'5. Verify'},
{code:`kubectl get nodes                                          # all Ready, all on the new version
kubectl get cm marker -o jsonpath='{.data.state}{"\\n"}'   # the object survived
kubectl -n kube-system get pods
sudo kubeadm certs check-expiration                        # leaf certificates renewed by the upgrade
kubectl logs probe | grep -c FAIL                          # how many failed probes? ideally 0 to a few`},
{h:'6. Optional: restore rehearsal'},
{code:`kubectl delete cm marker                                   # simulate a mistake
sudo etcdutl snapshot restore /root/pre-upgrade.db --data-dir /var/lib/etcd-restored
# edit /etc/kubernetes/manifests/etcd.yaml: change the data hostPath to /var/lib/etcd-restored
sudo crictl ps | grep etcd                                 # wait for the new etcd
kubectl get cm marker                                      # the object is back (the cluster state returned to snapshot time)`},
{note:'Restoring a snapshot taken **before** an upgrade into a cluster that has **already** been upgraded is not a supported way to roll back Kubernetes versions. In real incidents, restore to the **same** version the snapshot came from. Do this step on a throwaway cluster.'},
{h:'Self-check questions'},
{ul:['Which step would block the drain if `web` had one replica and a PDB with `minAvailable: 1`?','Why must workers be upgraded after the control plane?','What does `kubeadm upgrade node` do differently from `apply`?','What would you do if the API server did not return after `apply`? Where is the backup of the old manifest?','What is missing from an etcd snapshot that you would still need to rebuild a control plane?']},
{h:'Clean up'},
{code:`kubectl delete pod probe ; kubectl delete deployment web ; kubectl delete svc web ; kubectl delete pdb web-pdb ; kubectl delete cm marker --ignore-not-found`},
{note:'Exam tip: upgrade tasks are about order and care. Write the steps on the exam scratch pad first (repo, kubeadm, plan, apply, drain, kubelet, restart, uncordon) and tick them off.'}],
src:[['Upgrading kubeadm clusters',K.T+'administer-cluster/kubeadm/kubeadm-upgrade/'],['Operating etcd clusters for Kubernetes',K.T+'administer-cluster/configure-upgrade-etcd/']]};

/* ---------- Additional content ---------- */
/* 7: Velero */
L['k8s:10:7']={blocks:[
{p:'An etcd snapshot restores the **whole** cluster state, which is blunt. **Velero** backs up and restores **Kubernetes resources and persistent volumes** at namespace or label level, to object storage, and works on managed clusters where you cannot reach etcd.'},
{svg:K.dg(700,200,[
[10,70,130,60,'Velero server|runs in the cluster',2],[190,20,150,50,'Kubernetes API|resources as JSON',0],[190,130,150,50,'Volumes|snapshots or file copies',0],[400,70,150,60,'Object storage|S3, GCS, Azure Blob',2],[590,70,100,60,'Restore|into same or other cluster',0]],
[[140,90,190,50],[140,110,190,150],[340,45,400,90],[340,155,400,110],[550,100,590,100]])},
{h:'What it backs up'},
{ul:['**Resources**: Deployments, Services, ConfigMaps, Secrets, CRDs and more, selected by namespace, label or resource type.','**Volumes**: through **CSI snapshots** (with a data mover to copy snapshot data to object storage) or **file-system backup** of Pod volumes (Kopia).','**Hooks**: commands run before and after a backup in a Pod (for example flush or freeze a database).','**Schedules** and retention (TTL).']},
{code:`velero install --provider aws --plugins velero/velero-plugin-for-aws:<version> \\
  --bucket my-backups --backup-location-config region=eu-west-1 \\
  --use-node-agent --features=EnableCSI
velero backup create shop-1 --include-namespaces shop --snapshot-move-data
velero backup get
velero backup describe shop-1 --details
velero schedule create nightly --schedule="0 2 * * *" --include-namespaces shop --ttl 720h`},
{code:`# Restore, optionally into a different namespace or cluster
velero restore create --from-backup shop-1
velero restore create --from-backup shop-1 --namespace-mappings shop:shop-restored
velero restore get ; velero restore logs <name>`},
{h:'Velero vs etcd snapshot'},
{t:[['','etcd snapshot','Velero'],
['Granularity','Entire cluster state','Namespaces, labels, resource types'],
['Includes volume data','No','Yes (snapshots or file copies)'],
['Works on managed clusters','No (no etcd access)','Yes'],
['Cross-cluster migration','No','Yes'],
['Rebuild a broken control plane','Yes','Needs a working cluster to restore into']]},
{ul:['Use both on self-managed clusters: etcd for control plane recovery, Velero for applications.','**Test restores** regularly into a scratch cluster and time them.','Back up the **backup configuration** (credentials, bucket policy) and enable bucket versioning and replication.','Cluster-scoped resources and CRDs need ordering: restore CRDs before custom resources (Velero handles most of it).']},
{note:'Backups taken without application consistency (flush, quiesce) may restore into a state that needs recovery. Use hooks or application-native backups for databases.'}],
src:[['Velero documentation','https://velero.io/docs/'],['Kubernetes backup concepts',K.T+'administer-cluster/configure-upgrade-etcd/']]};

/* 8: Add and remove control plane nodes */
L['k8s:10:8']={blocks:[
{p:'Control plane membership changes happen when you scale from one node to three, replace a failed machine or retire hardware. With stacked etcd every control plane node is also an **etcd member**, so each change touches the etcd cluster too.'},
{h:'Adding a control plane node'},
{code:`# On an existing control plane node: new certificate key and join command
sudo kubeadm init phase upload-certs --upload-certs
kubeadm token create --print-join-command
# On the new node (prepared like any other node)
sudo kubeadm join k8s-api:6443 --token <t> --discovery-token-ca-cert-hash sha256:<h> \\
  --control-plane --certificate-key <key>
kubectl get nodes
sudo ETCDCTL_API=3 etcdctl ... member list --write-out=table`},
{ul:['Add **one at a time** and wait until the new etcd member is healthy and caught up before the next change.','Keep an **odd** number of members; going from 3 to 4 adds no fault tolerance.','Update load balancers and any firewall rules for the new node.']},
{h:'Removing a control plane node'},
{flow:['Check cluster and etcd health first (all members healthy)','Drain and delete the node: kubectl drain cp3 --ignore-daemonsets --delete-emptydir-data; kubectl delete node cp3','Remove the etcd member BEFORE shutting the node down, if kubeadm reset did not','Run kubeadm reset on the node and clean up','Remove it from the load balancer']},
{code:`# Find the member ID of the departing node and remove it
sudo ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key \\
  member list --write-out=table
sudo ETCDCTL_API=3 etcdctl ... member remove <member-id>
# on the retired node
sudo kubeadm reset -f`},
{h:'Replacing a failed node'},
{ul:['**Failed but recoverable**: repair and bring it back; do not change membership unnecessarily.','**Permanently lost**: remove the dead member from etcd (`member remove`), delete the Node object, then add a **fresh** node with the same role. Never reuse old etcd data on a new node without clearing it.','If you lost **quorum** (2 of 3 gone), you cannot remove members normally: restore from a snapshot, or follow the etcd disaster-recovery procedure.']},
{h:'Mistakes to avoid'},
{ul:['Removing two members at once from a three-member cluster.','Leaving a dead member in the etcd member list: it counts toward quorum and every restart tries to reach it.','Forgetting the API server certificate SANs and the load balancer when the address list changes.']},
{note:'Take an etcd snapshot before any membership change. It is cheap insurance for the one operation that can lose quorum.'}],
src:[['Creating Highly Available Clusters with kubeadm',K.S+'production-environment/tools/kubeadm/high-availability/'],['Operating etcd clusters',K.T+'administer-cluster/configure-upgrade-etcd/'],['etcd runtime reconfiguration','https://etcd.io/docs/latest/op-guide/runtime-configuration/']]};

/* 9: etcd monitoring */
L['k8s:10:9']={blocks:[
{p:'etcd problems begin as small latency changes long before an outage. Know the metrics that matter and the maintenance that keeps it fast.'},
{h:'Key metrics (Prometheus)'},
{t:[['Metric','Why it matters','Rough guide'],
['`etcd_disk_wal_fsync_duration_seconds` (p99)','Disk latency on commit; the number one cause of slowness','Below about 10 ms'],
['`etcd_disk_backend_commit_duration_seconds` (p99)','Time to commit batches to the database file','Below about 25 ms'],
['`etcd_server_leader_changes_seen_total`','Leader elections; frequent changes signal instability','Near zero over hours'],
['`etcd_server_has_leader`','Whether a member sees a leader','1 for every member'],
['`etcd_mvcc_db_total_size_in_bytes` and `..._in_use_...`','Database size and how much is live data','Below the quota; large gap means defrag helps'],
['`etcd_network_peer_round_trip_time_seconds`','Latency between members','Low and stable'],
['`etcd_server_proposals_failed_total` and `..._pending`','Raft proposals failing or backing up','Zero or tiny']]},
{p:'Treat these numbers as starting points, not rules. Compare to your own baseline and alert on **changes**.'},
{h:'Check by hand'},
{code:`E="--endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key"
sudo ETCDCTL_API=3 etcdctl $E endpoint status --write-out=table      # DB SIZE, IN USE, IS LEADER, RAFT TERM
sudo ETCDCTL_API=3 etcdctl $E endpoint health --write-out=table
sudo ETCDCTL_API=3 etcdctl $E check perf                              # synthetic load test (use on a test cluster)
curl -s --cacert ... --cert ... --key ... https://127.0.0.1:2379/metrics | grep -E "wal_fsync|backend_commit|leader_changes"`},
{h:'Defragmentation'},
{ul:['After many updates and compactions the file contains **free pages** that are not returned to the filesystem. `DB SIZE` is much larger than `IN USE`.','**Defrag** one member at a time, off peak; each member blocks reads and writes while it defragments.','Defragment the **leader last**, and only when needed (for example size above 80 percent of the quota, or a big gap between size and in-use).']},
{code:`sudo ETCDCTL_API=3 etcdctl $E defrag --endpoints=https://10.0.0.22:2379       # a follower first
sudo ETCDCTL_API=3 etcdctl $E endpoint status --write-out=table
sudo ETCDCTL_API=3 etcdctl $E alarm list ; sudo ETCDCTL_API=3 etcdctl $E alarm disarm   # after NOSPACE`},
{h:'Performance practices'},
{ul:['Dedicated, **fast local SSD or NVMe** for the data directory, separate from noisy neighbours (for example container image storage).','Keep members in the **same region** with low latency; spreading across distant sites hurts every write.','Do not store large objects or huge numbers of objects: events, CRDs with big payloads and ConfigMaps near 1 MiB cause growth. Fix the source.','Set the **quota** (`--quota-backend-bytes`, default about 2 GB; recommended max about 8 GB) to match your needs and alert before it fills.','Use **separate etcd** for Events at very large scale (an API server option) to isolate churn.']},
{note:'If fsync latency is high, no tuning helps. Move the data directory to faster disks before touching anything else.'}],
src:[['Operating etcd clusters',K.T+'administer-cluster/configure-upgrade-etcd/'],['etcd metrics','https://etcd.io/docs/latest/metrics/'],['etcd tuning','https://etcd.io/docs/latest/tuning/']]};

/* 10: OS upgrades and node rotation */
L['k8s:10:10']={blocks:[
{p:'Nodes need operating system patches, kernel updates and replacement images. Patching in place and rotating immutable images are two strategies with different risks.'},
{h:'Strategy 1: patch in place'},
{flow:['Cordon and drain the node','Apply OS updates and reboot if the kernel changed','Check kubelet, runtime and CNI come back','Uncordon and verify workloads return','Repeat, one node (or a small batch) at a time']},
{code:`kubectl drain w2 --ignore-daemonsets --delete-emptydir-data --timeout=300s
ssh w2 'sudo apt-get update && sudo apt-get -y upgrade && sudo systemctl reboot'
kubectl get nodes -w                          # wait for Ready
kubectl uncordon w2`},
{ul:['**Kured** (Kubernetes Reboot Daemon) detects the reboot-required flag and reboots nodes one at a time, with drains and a lock, automatically.','Hold Kubernetes packages (`apt-mark hold kubelet kubeadm kubectl`) so OS updates do not upgrade Kubernetes by accident.','Containerd or kernel updates can restart containers: always drain first.']},
{h:'Strategy 2: replace nodes with new images'},
{p:'Build a **new node image** (OS patched, runtime and kubelet at the target version), launch new nodes, join them and **retire** the old ones. No patch drift, and rollback is "go back to the old image".'},
{code:`# Typical flow with node pools or instance groups
1. publish image v2 (golden image or immutable OS such as Talos, Flatcar, Bottlerocket)
2. create a new node pool/group with image v2
3. kubectl cordon <old nodes>; kubectl drain <old nodes> ...
4. verify workloads on the new pool; delete the old pool`},
{t:[['','Patch in place','Replace with new image'],
['Drift between nodes','Possible over time','None: nodes are identical'],
['Speed per node','Reboot time','New VM boot and join time'],
['Rollback','Hard','Easy: previous image'],
['Fits','Small, static clusters','Cloud, autoscaling, many nodes'],
['Needs','Config management','Image pipeline']]},
{h:'Safe rolling'},
{ul:['Roll **one failure zone** or pool at a time, and keep capacity for the drained workloads (surge nodes).','PodDisruptionBudgets and topology spread are what make rotation safe.','Stateful workloads: wait for replicas to become healthy and caught up between nodes.','Set a **maximum node age** (for example 30 days) so every node is rotated regularly; managed services offer auto-upgrade and maintenance windows for this.','Automate with Karpenter drift or node expiry, Cluster API MachineDeployments, or provider auto-repair features.']},
{code:`kubectl get nodes -o custom-columns=NAME:.metadata.name,OS:.status.nodeInfo.osImage,KERNEL:.status.nodeInfo.kernelVersion,KUBELET:.status.nodeInfo.kubeletVersion,AGE:.metadata.creationTimestamp`},
{note:'A node that has not been rebooted or replaced for a year probably has unpatched vulnerabilities. Put node age and OS version on your dashboard.'}],
src:[['Safely Drain a Node',K.T+'administer-cluster/safely-drain-node/'],['Kured','https://kured.dev/docs/'],['Upgrade Linux nodes',K.T+'administer-cluster/kubeadm/upgrading-linux-nodes/']]};

/* 11: Cluster API and blue-green */
L['k8s:10:11']={blocks:[
{h:'Cluster API (CAPI): clusters as Kubernetes objects'},
{p:'**Cluster API** uses a **management cluster** that runs controllers which create and operate other clusters (workload clusters) on infrastructure providers (AWS, Azure, vSphere, bare metal and more). A cluster, its control plane and its machines are all declarative objects.'},
{t:[['Object','Role'],
['`Cluster`','The workload cluster and its network references'],
['`KubeadmControlPlane`','Manages control plane machines, including rolling upgrades'],
['`MachineDeployment` / `MachinePool`','Worker machines, like a Deployment for nodes'],
['`Machine` and `MachineHealthCheck`','A single node, and automatic replacement of unhealthy ones'],
['Infrastructure objects (for example `AWSMachineTemplate`)','Provider-specific machine definitions']]},
{code:`apiVersion: cluster.x-k8s.io/v1beta1
kind: MachineDeployment
metadata: {name: prod-md-0, namespace: prod}
spec:
  clusterName: prod
  replicas: 5
  selector: {matchLabels: {cluster.x-k8s.io/cluster-name: prod}}
  template:
    spec:
      clusterName: prod
      version: v1.37.1                    # change this to upgrade workers
      bootstrap: {configRef: {apiVersion: bootstrap.cluster.x-k8s.io/v1beta1, kind: KubeadmConfigTemplate, name: prod-md-0}}
      infrastructureRef: {apiVersion: infrastructure.cluster.x-k8s.io/v1beta2, kind: AWSMachineTemplate, name: prod-md-0}`},
{ul:['**Upgrades** become edits: change `version` on `KubeadmControlPlane` first, then on each `MachineDeployment`; CAPI replaces machines using rolling updates and honours drains and PDBs.','**clusterctl** installs providers, generates cluster templates and moves management to another cluster (`clusterctl move`).','Pairs well with GitOps: all clusters defined in Git.','API versions and provider kinds change between releases; follow the current CAPI book.']},
{h:'Blue-green cluster upgrades'},
{p:'Instead of upgrading in place, build a **new cluster** at the target version (green), move workloads and traffic, then retire the old one (blue). It trades cost and effort for a very safe rollback.'},
{flow:['Build the green cluster from the same code (CAPI, Terraform, GitOps) at the new version','Deploy platform add-ons and applications through GitOps','Restore stateful data (Velero, database replication) and verify','Shift traffic gradually with DNS weights or a global load balancer','Watch SLOs; roll traffic back to blue if needed','Decommission blue after a safe period']},
{t:[['','In-place upgrade','Blue-green cluster'],
['Risk','Changes the live cluster','Live cluster untouched until cutover'],
['Cost','Low','Double capacity during the move'],
['Rollback','Hard (restore or reverse)','Switch traffic back'],
['Stateful data','Stays in place','Needs migration or replication'],
['Needs','kubeadm upgrade skills','Fully automated cluster and app builds']]},
{ul:['Good fit: stateless services and teams with mature GitOps.','Harder for databases and for IP-address or DNS dependencies: plan data movement and external allowlists.','Skipping minor versions is possible this way, because you are not upgrading the control plane in place, as long as your workloads and APIs work on the new version.']},
{note:'Blue-green cluster rollout turns "upgrade day" into a routine, rehearsed pipeline, which is the real prize: if you can recreate a cluster at any time, you also have disaster recovery.'}],
src:[['Cluster API Book','https://cluster-api.sigs.k8s.io/'],['clusterctl','https://cluster-api.sigs.k8s.io/clusterctl/overview'],['Upgrade a kubeadm cluster',K.T+'administer-cluster/kubeadm/kubeadm-upgrade/']]};
})();
