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
