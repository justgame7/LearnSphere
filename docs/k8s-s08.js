/* LearnSphere - Kubernetes Administrator, Section 08: Storage.
   Lectures 0-6 are core, 7-11 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T,R=K.R;
const ST=C+'storage/';

const pvflow=K.dg(700,240,[
[10,90,120,60,'Pod|mounts the claim',0],
[170,90,140,60,'PersistentVolumeClaim|request: 10Gi RWO',2],
[360,90,140,60,'PersistentVolume|the actual storage|(cluster-scoped)',2],
[550,90,140,60,'Backend|EBS, Azure Disk,|NFS, Ceph ...',0],
[170,10,330,45,'StorageClass: provisions PVs on demand when no PV matches',1],
[170,175,330,45,'Binding: one PVC to one PV, matched by size, access mode, class',0]],
[[130,120,170,120],[310,120,360,120],[500,120,550,120],[240,55,240,90]]);

const csi=K.dg(700,230,[
[10,10,330,210,'Control plane side (Deployment)',1],[360,10,330,210,'Every node (DaemonSet)',1],
[30,45,140,50,'external-provisioner|creates volumes',0],[185,45,140,50,'external-attacher|attaches to node',0],[30,105,140,50,'external-resizer|expands volumes',0],[185,105,140,50,'external-snapshotter|snapshots',0],
[30,165,295,45,'CSI controller plugin (driver) talks to the storage API',2],
[380,45,295,50,'kubelet calls CSI node plugin over a local socket',0],[380,105,295,50,'node-driver-registrar registers the driver',0],[380,165,295,45,'CSI node plugin: format, mount into Pod path',2]],
[]);

/* ---------- 0: Volumes ---------- */
L['k8s:7:0']={blocks:[
{p:'A container filesystem is **ephemeral**: it is created from the image, and when the container restarts it starts again from the image, losing everything written to it. Storage in Kubernetes begins with that fact. A **volume** is a directory made available to the containers of a Pod, and the volume type decides **where the data comes from, who can share it and how long it lives**.'},
{h:'Two lifetimes'},
{t:[['Kind','Lifetime','Examples','Use for'],
['**Pod volume (ephemeral)**','Same as the **Pod**: survives container restarts, not Pod deletion','`emptyDir`, `configMap`, `secret`, `projected`, `downwardAPI`','Scratch space, caches, injected configuration'],
['**Persistent**','Independent of any Pod','`persistentVolumeClaim` (PV, next lectures)','Databases, uploads, anything that must survive']]},
{h:'The common volume types'},
{t:[['Type','Data comes from','Shared across Pods?','Notes'],
['`emptyDir`','An empty directory created when the Pod starts (on node disk, or memory with `medium: Memory`)','No (shared between containers of one Pod)','Counts against node ephemeral storage; `sizeLimit` available'],
['`hostPath`','A path on the **node** filesystem','Only Pods on that node','Ties data to one node and **exposes the host**; avoid'],
['`configMap` / `secret`','API objects projected as files','Many Pods','Read-only; Secrets are held in memory (tmpfs)'],
['`projected`','Several sources merged into one directory (configMap, secret, downwardAPI, serviceAccountToken)','Many Pods','One mount, many inputs'],
['`downwardAPI`','Pod metadata (labels, annotations, limits) as files or env','No','Lets an app know its own name or limits'],
['`persistentVolumeClaim`','A claim bound to a PersistentVolume','Depends on the access mode','Durable storage'],
['`ephemeral` (generic ephemeral)','A claim created with the Pod and deleted with it','No','Scratch space with real storage features']]},
{h:'An example using several'},
{code:`apiVersion: v1
kind: Pod
metadata: {name: vol-demo}
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ['sh','-c','date > /scratch/start; ls -l /etc/app /etc/creds; sleep 3600']
    volumeMounts:
    - {name: scratch, mountPath: /scratch}
    - {name: cfg, mountPath: /etc/app, readOnly: true}
    - {name: creds, mountPath: /etc/creds, readOnly: true}
  volumes:
  - name: scratch
    emptyDir: {sizeLimit: 500Mi}
  - name: cfg
    configMap: {name: app-config}
  - name: creds
    projected:
      sources:
      - secret: {name: db-cred}
      - serviceAccountToken: {path: token, audience: api, expirationSeconds: 3600}`},
{code:`$ kubectl exec vol-demo -- df -h /scratch
Filesystem      Size   Used  Avail Use% Mounted on
/dev/sda1       100G    12G    88G  12%  /scratch                  # on node disk
$ kubectl delete pod vol-demo && kubectl apply -f vol-demo.yaml
$ kubectl exec vol-demo -- cat /scratch/start                      # new timestamp: emptyDir did NOT survive the Pod`},
{h:'Mount details that matter'},
{ul:['`volumeMounts.name` must match a name in `volumes`; a typo gives the error `volumeMounts[0].name: Not found`.','`readOnly: true` on a mount is a cheap safety improvement for config and secrets.','**`subPath`** mounts one file or sub-directory, but then ConfigMap and Secret **updates do not propagate**.','Mounting over an existing image directory **hides** the image contents at that path.','Several containers can mount the same volume at different paths: the standard way to share files inside a Pod.']},
{h:'emptyDir in practice'},
{ul:['Survives **container crashes and restarts** (the Pod stays), so it is suitable for caches and for sidecar hand-offs.','A Pod that fills its `emptyDir` can be **evicted** for exceeding ephemeral storage; set `sizeLimit` and requests for `ephemeral-storage`.','`medium: Memory` backs it by tmpfs (RAM): fast, but counted against the container memory limit.']},
{h:'hostPath and why it is risky'},
{p:'A `hostPath` volume mounts a path from the node. A Pod that can mount `/` or the container runtime socket effectively has **root on the node**, and the data is tied to whichever node the Pod happens to run on. Pod Security **baseline** and **restricted** profiles forbid it. Legitimate uses are node agents (log collectors, monitoring) that need to read host files, ideally read-only.'},
{h:'Choosing'},
{t:[['Need','Use'],
['Scratch space during one Pod life','`emptyDir`'],
['Share files between containers in a Pod','`emptyDir` mounted by both'],
['Configuration','ConfigMap volume'],
['Credentials','Secret volume (or an external secret mechanism)'],
['Short-lived identity token','Projected `serviceAccountToken`'],
['Data that must outlive the Pod','PersistentVolumeClaim'],
['Read a host file from an agent','`hostPath`, read-only, in a privileged namespace']]},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Fix'],
['Writing database files to the container filesystem or `emptyDir`','Data is lost on Pod deletion','Use a PVC'],
['Using `hostPath` for application data','Data stays on one node; Pod may start elsewhere with empty data','PVC with a proper StorageClass'],
['Mounting a ConfigMap over `/etc` or an app directory','The image files at that path disappear','Mount a single directory dedicated to config'],
['Expecting live config updates with `subPath`','No refresh','Mount the directory'],
['No `sizeLimit` on `emptyDir`','A runaway Pod fills the node disk and is evicted','Set a limit and ephemeral-storage requests']]},
{note:'Exam tip: for "share a volume between two containers" tasks, define one `emptyDir` in `spec.volumes` and add a `volumeMounts` entry with the same `name` to each container.'}],
src:[['Volumes',ST+'volumes/'],['Projected Volumes',ST+'projected-volumes/'],['Ephemeral Volumes',ST+'ephemeral-volumes/']]};

/* ---------- 1: PV and PVC ---------- */
L['k8s:7:1']={blocks:[
{p:'Durable storage raises an organisational problem: the person who writes an application does not know, and should not need to know, whether the disk is an EBS volume, an NFS export or a Ceph pool. Kubernetes separates **providing** storage from **requesting** it with two objects: the **PersistentVolume (PV)** and the **PersistentVolumeClaim (PVC)**.'},
{svg:pvflow},
{t:[['Object','Scope','Created by','Describes'],
['**PersistentVolume (PV)**','**Cluster**','An administrator, or **dynamically** by a provisioner','A real piece of storage: size, access modes, backend, node affinity, reclaim policy'],
['**PersistentVolumeClaim (PVC)**','**Namespace**','The application owner','A request: "I need 10Gi, ReadWriteOnce, class fast-ssd"'],
['**StorageClass**','Cluster','Administrator','How to create PVs on demand (next lectures)']]},
{h:'Binding: how a claim finds its volume'},
{flow:['A PVC is created with a size, access modes and optionally a StorageClass','The control plane looks for an Available PV that satisfies the claim (class, modes, capacity at least the request)','If one exists it is bound: PVC becomes Bound, PV becomes Bound (one to one)','If none exists and the class has a provisioner, a new PV is created dynamically','A Pod referencing the PVC mounts the bound volume']},
{code:`# Static example: an admin creates a PV; a developer claims it
apiVersion: v1
kind: PersistentVolume
metadata: {name: pv-nfs-1}
spec:
  capacity: {storage: 20Gi}
  accessModes: [ReadWriteMany]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  nfs: {server: 10.0.0.20, path: /exports/data}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: data, namespace: shop}
spec:
  accessModes: [ReadWriteMany]
  resources: {requests: {storage: 10Gi}}
  storageClassName: manual
---
apiVersion: v1
kind: Pod
metadata: {name: app, namespace: shop}
spec:
  containers:
  - name: app
    image: nginx:1.27
    volumeMounts: [{name: data, mountPath: /usr/share/nginx/html}]
  volumes:
  - name: data
    persistentVolumeClaim: {claimName: data}`},
{code:`$ kubectl get pv,pvc -A
NAME                      CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM            STORAGECLASS
persistentvolume/pv-nfs-1  20Gi      RWX            Retain           Bound    shop/data        manual
NAMESPACE   NAME                         STATUS   VOLUME     CAPACITY   ACCESS MODES   STORAGECLASS
shop        persistentvolumeclaim/data   Bound    pv-nfs-1   20Gi       RWX            manual       # claimed 10Gi, got the whole 20Gi PV`},
{h:'Binding rules in detail'},
{ul:['The PV capacity must be **at least** the requested size; the claim receives the **entire** PV (no partial use).','**Access modes** and **storageClassName** must match. An empty class (`""`) means "no class", which is different from omitting the field (then the **default** StorageClass applies).','A bound PV belongs to exactly one PVC; it cannot be shared even if there is spare capacity.','`volumeName` in a PVC pins it to a named PV; `claimRef` in a PV reserves it for one claim.','Selector labels (`spec.selector`) can narrow which PVs a claim may bind.']},
{h:'Phases and what they tell you'},
{t:[['Object','Phase','Meaning'],
['PV','`Available`','Free, not yet bound'],
['PV','`Bound`','Bound to a claim'],
['PV','`Released`','Claim deleted but the volume has not been reclaimed (data may still be there)'],
['PV','`Failed`','Automatic reclamation failed'],
['PVC','`Pending`','Waiting for a matching PV or for provisioning'],
['PVC','`Bound`','Ready to use'],
['PVC','`Lost`','The bound PV no longer exists']]},
{h:'A PVC stuck in Pending'},
{code:`$ kubectl get pvc data -n shop
NAME   STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
data   Pending                                      fast-ssd       4m
$ kubectl describe pvc data -n shop | sed -n '/Events:/,$p'
  Warning  ProvisioningFailed  persistentvolume-controller  storageclass.storage.k8s.io "fast-ssd" not found`},
{t:[['Event or state','Cause'],
['`storageclass ... not found`','Class name typo or missing class'],
['`no persistent volumes available for this claim and no storage class is set`','No default class and no matching PV'],
['`waiting for first consumer to be created before binding`','Normal with `WaitForFirstConsumer`: no Pod uses the claim yet'],
['`failed to provision volume ... AccessDenied` or quota errors','Cloud permissions or quota'],
['Size or access mode mismatch with every PV','Static PV does not satisfy the request']]},
{h:'Using a claim in a Pod'},
{ul:['The Pod references the **claim name**, in its own namespace, never the PV directly.','A Pod using a PVC is scheduled only after the claim can be bound (and, for zonal storage, where the volume is reachable).','Deleting a PVC that is **in use** leaves it `Terminating` until the Pod stops using it (the `pvc-protection` finalizer).']},
{note:'Exam tip: for storage tasks, the sequence is PV (if static), PVC, Pod with `persistentVolumeClaim.claimName`. Check `kubectl get pv,pvc` after each step: STATUS must read Bound before you create the Pod.'}],
src:[['Persistent Volumes',ST+'persistent-volumes/'],['Change the Reclaim Policy of a PersistentVolume',T+'administer-cluster/change-pv-reclaim-policy/']]};

/* ---------- 2: Access modes and reclaim ---------- */
L['k8s:7:2']={blocks:[
{p:'Two settings decide who may use a volume and what happens to your data when you are finished with it. They are chosen casually and regretted often: an access mode that does not match the storage backend leaves Pods stuck, and a reclaim policy of `Delete` can silently destroy production data.'},
{h:'Access modes: who can mount it, and how'},
{t:[['Mode','Short','Meaning','Typical backends'],
['`ReadWriteOnce`','RWO','Read-write by Pods on **one node** at a time (several Pods on that node may share it)','Block disks: EBS, Azure Disk, Persistent Disk, Ceph RBD'],
['`ReadOnlyMany`','ROX','Read-only by many nodes','NFS, CephFS, image-like data'],
['`ReadWriteMany`','RWX','Read-write by many nodes at once','NFS, CephFS, EFS, Azure Files'],
['`ReadWriteOncePod`','RWOP','Read-write by **exactly one Pod** in the entire cluster','CSI drivers that support it (single-writer databases)']]},
{ul:['The mode is a **capability and a request**: the claim states what you need and the backend must be able to provide it. A block disk cannot do RWX, however you ask.','**RWO is per node, not per Pod**: two Pods on the same node can both write. Use RWOP when only one Pod may ever write.','Modes constrain **mounting**, not what the application does inside the volume.']},
{h:'The classic RWO failure'},
{code:`# A Deployment with 3 replicas all sharing one RWO claim
$ kubectl get pods -o wide
NAME      READY   STATUS              NODE
app-1     1/1     Running             worker1
app-2     0/1     ContainerCreating   worker2         # stuck
$ kubectl describe pod app-2 | sed -n '/Events:/,$p'
  Warning  FailedAttachVolume  attachdetach-controller  Multi-Attach error for volume "pvc-a1": Volume is already used by pod(s) app-1`},
{p:'The volume is attached to `worker1`, and an RWO volume cannot attach to a second node. Fixes: schedule all replicas on one node (poor), use **one volume per Pod** (a StatefulSet with `volumeClaimTemplates`), use an RWX backend, or run a single replica.'},
{h:'Reclaim policy: what happens when the claim is deleted'},
{t:[['Policy','Result for PV and data','Typical use'],
['**`Delete`**','The PV object **and the storage behind it** are deleted','Default for dynamically provisioned volumes; development, scratch data'],
['**`Retain`**','The PV stays, becomes `Released`, data is kept; an admin must clean it and make it reusable','Production data you cannot afford to lose'],
['`Recycle`','Deprecated: basic scrub and reuse','Do not use; use dynamic provisioning']]},
{code:`# What deleting a namespace does with the default policy
$ kubectl delete namespace shop
# PVCs are deleted -> PVs with reclaimPolicy Delete are deleted -> the cloud disks are DELETED

# Protect important data: switch existing PVs to Retain
$ kubectl patch pv pvc-3f2a... -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'
$ kubectl get pv -o custom-columns=NAME:.metadata.name,RECLAIM:.spec.persistentVolumeReclaimPolicy,STATUS:.status.phase,CLAIM:.spec.claimRef.name`},
{h:'Reusing a Released volume'},
{p:'A `Retain` volume whose claim was deleted shows `Released` and still holds the old `claimRef`, so no new claim can bind it, to avoid handing old data to another user. After you have saved or wiped the data, clear the reference:'},
{code:`kubectl patch pv pv-nfs-1 --type=json -p '[{"op":"remove","path":"/spec/claimRef"}]'
kubectl get pv pv-nfs-1                 # Available again`},
{h:'Protection against accidental deletion'},
{ul:['**PVC protection**: a PVC used by a running Pod is not removed until the Pod is gone.','**PV protection**: a PV bound to a claim is not removed until it is released.','Never remove these finalizers by hand unless you are sure; it can delete data in use.','Set `reclaimPolicy: Retain` in the **StorageClass** for critical workloads so every new PV inherits it.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Fix'],
['Leaving the default `Delete` for production databases','Deleting the PVC or namespace destroys the data','`Retain` and regular backups'],
['Asking for RWX on a block-disk class','PVC stays Pending or Pod cannot start','Use a file-system class or one volume per Pod'],
['Several replicas on one RWO claim','Multi-Attach errors','StatefulSet with per-Pod claims'],
['Assuming Retain means backup','The data is only kept, not copied','Take snapshots and off-site backups'],
['Forgetting orphaned `Released` volumes','Disks keep costing money','Review `kubectl get pv` regularly']]},
{note:'Think of `Delete` as "cleanup is automatic" and `Retain` as "cleanup is a human decision". For anything you would be sad to lose, choose the human decision.'}],
src:[['Persistent Volumes: access modes',ST+'persistent-volumes/#access-modes'],['Persistent Volumes: reclaiming',ST+'persistent-volumes/#reclaiming'],['Change the Reclaim Policy of a PersistentVolume',T+'administer-cluster/change-pv-reclaim-policy/']]};

/* ---------- 3: StorageClasses ---------- */
L['k8s:7:3']={blocks:[
{p:'Creating PVs by hand does not scale: someone must provision a disk for every request. A **StorageClass** describes a *kind* of storage and tells Kubernetes **how to create volumes on demand**. When a PVC names a class, the matching provisioner creates the disk and the PV automatically. This is **dynamic provisioning**, and it is how nearly every real cluster works.'},
{flow:['A developer creates a PVC with storageClassName: fast-ssd','The provisioner for that class creates a volume in the backend (disk, share, LUN)','It creates a PV describing it and binds it to the PVC','The Pod that uses the PVC mounts it (optionally after the scheduler picks a node)']},
{code:`apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
  annotations: {storageclass.kubernetes.io/is-default-class: "false"}
provisioner: ebs.csi.aws.com            # the CSI driver that creates volumes
parameters:                             # driver-specific
  type: gp3
  encrypted: "true"
reclaimPolicy: Delete                   # copied into PVs created from this class (default Delete)
allowVolumeExpansion: true              # PVCs of this class can be grown
volumeBindingMode: WaitForFirstConsumer # create the volume only when a Pod needs it
mountOptions: [discard]
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: db-data}
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: fast-ssd
  resources: {requests: {storage: 50Gi}}`},
{h:'The important fields'},
{t:[['Field','Meaning','Notes'],
['`provisioner`','Which driver creates volumes','CSI driver name; older in-tree names are legacy'],
['`parameters`','Backend options: disk type, IOPS, encryption, filesystem','Immutable: create a new class to change them'],
['`reclaimPolicy`','Policy placed on created PVs','`Delete` by default'],
['`allowVolumeExpansion`','Whether PVCs may be grown later','Cannot shrink'],
['`volumeBindingMode`','`Immediate` or `WaitForFirstConsumer`','See below'],
['`allowedTopologies`','Limit where volumes may be created','Zones or nodes']]},
{h:'Why volumeBindingMode matters'},
{p:'With **Immediate**, the volume is created as soon as the PVC exists, in a zone the provisioner picks. If the Pod then needs a different zone (resources, taints, spread rules), it is **unschedulable**, because a zonal disk cannot move. With **WaitForFirstConsumer**, provisioning waits until the scheduler has chosen a node for the first Pod, then creates the volume in that node zone. Use it for any topology-bound storage (almost all cloud block storage).'},
{code:`$ kubectl get pvc db-data
NAME      STATUS    VOLUME   CAPACITY   STORAGECLASS   AGE
db-data   Pending                       fast-ssd       30s        # normal until a Pod uses it
$ kubectl describe pvc db-data | sed -n '/Events:/,$p'
  Normal  WaitForFirstConsumer  persistentvolume-controller  waiting for first consumer to be created before binding`},
{h:'The default StorageClass'},
{code:`$ kubectl get storageclass
NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION
standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false
fast-ssd             ebs.csi.aws.com         Delete          WaitForFirstConsumer   true
$ kubectl patch storageclass fast-ssd -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
$ kubectl patch storageclass standard -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'`},
{ul:['A PVC **without** `storageClassName` gets the default class; a PVC with `storageClassName: ""` gets **no** class and binds only PVs without one.','Only one class should be marked default; two defaults cause confusing behaviour.','Class parameters cannot be changed: to move to a new type, create a new class and migrate data (snapshot and restore).']},
{h:'Troubleshooting'},
{t:[['Symptom','Cause'],
['PVC Pending, no events about the class','No default class and none named; a plain **kubeadm cluster has no StorageClass or provisioner** until you install one'],
['`storageclass ... not found`','Class name typo'],
['`ProvisioningFailed` with permission or quota text','Cloud IAM permissions or quotas for the driver'],
['Pod Pending with `volume node affinity conflict`','Volume was created in a zone the Pod cannot use (Immediate binding)'],
['Volume cannot be expanded','`allowVolumeExpansion` is false on the class'],
['Wrong disk type used','Check `parameters` and which class the PVC actually got (`kubectl get pvc -o yaml`)']]},
{note:'On a kubeadm lab, install a provisioner (for example local-path-provisioner) and a default StorageClass first; otherwise every PVC will wait forever.'}],
src:[['Storage Classes',ST+'storage-classes/'],['Dynamic Volume Provisioning',ST+'dynamic-provisioning/'],['Change the default StorageClass',T+'administer-cluster/change-default-storage-class/']]};

/* ---------- 4: CSI ---------- */
L['k8s:7:4']={blocks:[
{p:'Early Kubernetes contained code for each storage vendor inside the core, which tied every storage fix to a Kubernetes release. The **Container Storage Interface (CSI)** replaced that with a standard API: a vendor ships a **driver** that runs as Pods in your cluster, and Kubernetes talks to it over gRPC. Knowing the pieces lets you read driver logs and place a failure in the right component.'},
{svg:csi},
{h:'The parts of a CSI driver'},
{t:[['Part','Runs as','Responsibility'],
['**Controller plugin**','Deployment (control-plane side)','Talks to the storage backend API: create and delete volumes, attach and detach, snapshot, expand'],
['**Node plugin**','DaemonSet on every node','Formats and mounts volumes on its node, exposes them to the kubelet'],
['**Sidecar containers**','Next to the driver containers','Translate Kubernetes objects into driver calls (see below)'],
['**CSIDriver object**','Cluster object','Declares driver capabilities (does it need attach? fsGroup support? ephemeral volumes?)'],
['**CSINode object**','One per node','Records which drivers are registered on that node']]},
{t:[['Sidecar','Watches','Calls the driver to'],
['`external-provisioner`','PVCs using the driver StorageClass','Create the volume, then create the PV'],
['`external-attacher`','`VolumeAttachment` objects','Attach the volume to a node (cloud disks)'],
['`external-resizer`','PVC size changes','Expand the volume'],
['`external-snapshotter`','VolumeSnapshot objects','Create snapshots'],
['`node-driver-registrar`','(on the node)','Register the driver with the kubelet'],
['`livenessprobe`','(health)','Report driver health']]},
{h:'The life of a volume'},
{flow:['PVC created: external-provisioner calls CreateVolume on the backend and creates the PV','Pod scheduled to a node: a VolumeAttachment object is created','external-attacher attaches the volume to that node (ControllerPublishVolume)','The kubelet calls the node plugin to stage the volume (format if new, mount to a staging path)','The kubelet publishes it: a bind mount into the Pod directory','On Pod deletion: unpublish, unstage, detach; later DeleteVolume per the reclaim policy']},
{h:'Looking at a driver'},
{code:`$ kubectl get csidrivers
NAME              ATTACHREQUIRED   PODINFOONMOUNT   STORAGECAPACITY   MODES        AGE
ebs.csi.aws.com   true             false            false             Persistent   20d
$ kubectl get csinodes
NAME      DRIVERS   AGE
worker1   1         20d                                         # drivers registered on that node
$ kubectl -n kube-system get pods | grep -i csi
ebs-csi-controller-6d9f7c-x2kq9   6/6   Running      # controller with sidecars
ebs-csi-node-4tq8z                3/3   Running      # one per node
$ kubectl get volumeattachments
NAME          ATTACHER          PV        NODE      ATTACHED   AGE
csi-5a1f...   ebs.csi.aws.com   pvc-a1    worker1   true       3m`},
{h:'Key CSIDriver settings'},
{ul:['`attachRequired`: whether a separate attach step exists (yes for cloud block disks, no for NFS-style).','`podInfoOnMount`: passes Pod name and namespace to the driver.','`fsGroupPolicy`: whether Kubernetes changes ownership of files for the Pod `fsGroup`.','`storageCapacity`: lets the scheduler consider remaining capacity.','`volumeLifecycleModes`: `Persistent` and/or `Ephemeral` (inline CSI volumes).']},
{h:'Diagnosing by layer'},
{t:[['Symptom','Where it failed','Where to look'],
['PVC Pending, `ProvisioningFailed`','Provisioning','`external-provisioner` logs in the controller Pod; cloud IAM and quota'],
['Pod `ContainerCreating`, `AttachVolume.Attach failed`','Attach','`VolumeAttachment` status, `external-attacher` logs; volume attached elsewhere'],
['`MountVolume.MountDevice failed` or `SetUp failed`','Node plugin / mount','Node plugin logs on that node, kubelet journal; missing mount tools (NFS client, iSCSI)'],
['PVC resize stuck','Expansion','`external-resizer` logs, PVC conditions (`FileSystemResizePending`)'],
['Driver not found on a node','Registration','`CSINode`, node DaemonSet Pod, registrar sidecar logs']]},
{code:`kubectl -n kube-system logs deploy/ebs-csi-controller -c csi-provisioner --tail=30
kubectl -n kube-system logs deploy/ebs-csi-controller -c csi-attacher --tail=30
kubectl -n kube-system logs ds/ebs-csi-node -c ebs-plugin --tail=30
kubectl describe pod app | sed -n '/Events:/,$p'
sudo journalctl -u kubelet | grep -i -E "mount|csi" | tail`},
{h:'Practical points'},
{ul:['On managed clusters the driver is usually an **add-on** with a cloud IAM role or managed identity; most outages are a missing or expired permission, not a bug.','Keep driver and sidecar versions compatible with your Kubernetes version when upgrading.','The old built-in cloud volume plugins have been migrated to CSI drivers, so install the CSI driver even for "standard" cloud disks.','StorageClass `provisioner` must match the CSI **driver name** exactly.']},
{note:'Mental model: **controller plugin = talks to the storage array; node plugin = talks to the node; sidecars = translate Kubernetes events into those calls.** A failure at attach is a controller problem; a failure at mount is a node problem.'}],
src:[['Volumes: CSI',ST+'volumes/#csi'],['CSI developer documentation','https://kubernetes-csi.github.io/docs/']]};

/* ---------- 5: Expansion and snapshots ---------- */
L['k8s:7:5']={blocks:[
{p:'Data grows and mistakes happen. Two operations let you cope without rebuilding: **expanding** a claim when a volume runs out of space, and **snapshotting** it before a risky change. Both depend on driver support, and both have limits that surprise people.'},
{h:'Expanding a claim'},
{p:'A PVC can be **grown** (never shrunk) if its StorageClass has `allowVolumeExpansion: true` and the driver supports it. Many drivers expand the file system **online** while the Pod keeps running; some need the Pod restarted.'},
{code:`$ kubectl get sc fast-ssd -o jsonpath='{.allowVolumeExpansion}{"\\n"}'
true
$ kubectl patch pvc db-data -p '{"spec":{"resources":{"requests":{"storage":"100Gi"}}}}'
$ kubectl get pvc db-data
NAME      STATUS   VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS
db-data   Bound    pvc-a1   50Gi       RWO            fast-ssd         # still 50Gi: expansion in progress
$ kubectl describe pvc db-data | grep -A3 Conditions
  FileSystemResizePending   True    Waiting for user to (re-)start a pod to finish file system resize
$ kubectl exec db-0 -- df -h /var/lib/postgresql/data                  # after resize completes: 100G`},
{t:[['Situation','What to do'],
['Class has `allowVolumeExpansion: false`','The patch is rejected; patch the class to `true` (affects expansion of existing claims of that class) if the driver supports it'],
['Condition `FileSystemResizePending`','The backend grew; the file system will grow when the Pod restarts (driver without online expansion)'],
['Need a smaller volume','Not possible: snapshot or back up, create a smaller claim, restore'],
['StatefulSet claims','`volumeClaimTemplates` cannot be edited; patch each PVC, then recreate the StatefulSet with `kubectl delete sts NAME --cascade=orphan` and apply the new template']]},
{h:'Volume snapshots'},
{p:'A **VolumeSnapshot** captures a point-in-time copy of a volume through the CSI driver. It needs three things: the snapshot **CRDs and controller** (installed separately, not part of core Kubernetes), a **VolumeSnapshotClass** naming the driver, and a driver that supports snapshots. The objects mirror PVC and PV: a namespaced `VolumeSnapshot` (the request) binds to a cluster-scoped `VolumeSnapshotContent` (the real snapshot).'},
{code:`apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotClass
metadata: {name: csi-snap}
driver: ebs.csi.aws.com
deletionPolicy: Delete                 # Retain keeps the storage snapshot when the object is deleted
---
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata: {name: db-snap-1, namespace: shop}
spec:
  volumeSnapshotClassName: csi-snap
  source: {persistentVolumeClaimName: db-data}
---
# Restore: a NEW claim whose data source is the snapshot
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: db-restored, namespace: shop}
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: fast-ssd
  resources: {requests: {storage: 100Gi}}          # at least the snapshot restore size
  dataSource: {apiGroup: snapshot.storage.k8s.io, kind: VolumeSnapshot, name: db-snap-1}`},
{code:`$ kubectl get volumesnapshot -n shop
NAME         READYTOUSE   SOURCEPVC   SNAPSHOTCLASS   SNAPSHOTCONTENT        AGE
db-snap-1    true         db-data     csi-snap        snapcontent-7a1c...    2m
$ kubectl get volumesnapshotcontent
$ kubectl get volumesnapshot db-snap-1 -n shop -o jsonpath='{.status.readyToUse}{"\\n"}'`},
{h:'Using snapshots safely'},
{ul:['A restore creates a **new volume**; it does not roll back the original in place. Point the application at the new claim, or swap claims.','The restored claim must be in the **same namespace** as the snapshot, and at least as large as the restore size.','A snapshot is **crash-consistent**, like pulling the plug. For databases flush or freeze first (a hook, or the database own backup tools) if you need application consistency.','A snapshot stored in the **same storage system** is not a disaster-recovery backup: losing the system or account loses both. Copy data off-site with a backup tool (Velero with data mover, replication).','`deletionPolicy: Delete` removes the real snapshot when the object is deleted; use `Retain` for snapshots that must survive.']},
{h:'Troubleshooting'},
{t:[['Symptom','Cause'],
['`no matches for kind VolumeSnapshot`','Snapshot CRDs not installed'],
['`READYTOUSE` stays false','Driver or controller problem: `kubectl describe volumesnapshot`, snapshotter sidecar logs'],
['Restore PVC Pending','Size smaller than restore size, wrong class, or snapshot in another namespace'],
['Expansion does nothing','Class forbids it, driver lacks support, or a Pod restart is pending']]},
{note:'Before any risky operation (upgrade, migration, schema change) take a snapshot **and** confirm you can restore from it in a test namespace. A snapshot you have never restored is only a hope.'}],
src:[['Volume Snapshots',ST+'volume-snapshots/'],['Expanding Persistent Volumes Claims',ST+'persistent-volumes/#expanding-persistent-volumes-claims'],['Volume Snapshot Classes',ST+'volume-snapshot-classes/']]};

/* ---------- 6: Practical ---------- */
L['k8s:7:6']={blocks:[
{p:'This lab proves the central promise of persistent storage: **data survives the Pod**. You will create a claim, write data, destroy the Pod, see the data survive, follow the objects behind the scenes, expand the claim and rehearse the failure cases. On kind, a default `standard` class with `local-path` is provided. On other clusters install a provisioner first (check `kubectl get storageclass`).'},
{flow:['Check there is a usable StorageClass','Create a PVC and a Pod that writes to it','Delete the Pod and prove the data survived','Inspect the PVC, PV and their relationship','Expand the claim','Practise failure cases','Clean up and check what remains']},
{h:'1. Claim, Pod and data'},
{code:`kubectl get storageclass                                 # one marked (default)?
kubectl create ns store-lab && kubectl config set-context --current --namespace=store-lab
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: data}
spec:
  accessModes: [ReadWriteOnce]
  resources: {requests: {storage: 1Gi}}
---
apiVersion: v1
kind: Pod
metadata: {name: writer}
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ['sh','-c','echo "written at $(date)" >> /data/log.txt; sleep 3600']
    volumeMounts: [{name: d, mountPath: /data}]
  volumes:
  - name: d
    persistentVolumeClaim: {claimName: data}
EOF
kubectl get pvc,pv                                       # PVC may stay Pending until the Pod is scheduled (WaitForFirstConsumer)
kubectl wait --for=condition=Ready pod/writer --timeout=90s
kubectl exec writer -- cat /data/log.txt`},
{p:'**Predict:** the PVC shows `Pending` for a moment, then `Bound` once the Pod is scheduled, because the default class uses `WaitForFirstConsumer`.'},
{h:'2. Destroy the Pod, keep the data'},
{code:`kubectl delete pod writer
kubectl get pvc data                                    # still Bound: the claim outlives the Pod
# recreate the Pod (apply only the Pod part again), then:
kubectl exec writer -- cat /data/log.txt                # two lines: the old line and a new line`},
{h:'3. Follow the objects'},
{code:`kubectl get pvc data -o jsonpath='{.spec.volumeName}{"\\n"}'            # name of the bound PV
kubectl get pv                                                             # CLAIM column: store-lab/data
kubectl describe pv <pv-name> | grep -E "Reclaim|StorageClass|Source|Path|Node Affinity"
kubectl get pod writer -o jsonpath='{.spec.volumes}{"\\n"}'`},
{h:'4. Expand'},
{code:`kubectl get sc -o custom-columns=NAME:.metadata.name,EXPAND:.allowVolumeExpansion
kubectl patch pvc data -p '{"spec":{"resources":{"requests":{"storage":"2Gi"}}}}'
kubectl describe pvc data | grep -A3 Conditions
kubectl get pvc data                                    # CAPACITY changes once the resize finishes`},
{p:'If your class forbids expansion, the patch is rejected with a message naming the class: that is the expected result and a useful one to see.'},
{h:'5. Failure drills'},
{t:[['Drill','How','What you learn'],
['Missing class','Create a PVC with `storageClassName: nope`','Pending, event `storageclass "nope" not found`'],
['No consumer yet','Create a PVC and no Pod, with a `WaitForFirstConsumer` class','Pending is normal: "waiting for first consumer"'],
['Protected claim','`kubectl delete pvc data` while the Pod runs','PVC stays `Terminating` until the Pod is gone (`pvc-protection`)'],
['Reclaim policy','Patch the PV to `Retain`, delete Pod and PVC','PV becomes `Released`; the data remains on the backend'],
['Reuse a Released PV','Remove `spec.claimRef` with a JSON patch','PV becomes `Available` again'],
['Wrong access mode','Request RWX on a class that cannot do it','Pending or mount failure with a clear event']]},
{h:'Self-check questions'},
{ul:['Which object carried the data when the Pod was deleted, and which object records where it really lives?','Why did the claim ask for 1Gi but a static PV would have returned its full size?','What would have happened to the data if the reclaim policy were `Delete` and you deleted the PVC?','Where would you look first if the Pod were stuck in `ContainerCreating` with a mount error?']},
{h:'Clean up and verify'},
{code:`kubectl delete ns store-lab
kubectl get pv                          # Delete-policy volumes should vanish; Retain ones remain (clean them up manually)
kubectl config set-context --current --namespace=default`},
{note:'Exam tip: storage tasks check the full chain. After creating objects always run `kubectl get pv,pvc` (Bound) and `kubectl exec POD -- ls MOUNTPATH` to prove the Pod actually sees the volume.'}],
src:[['Persistent Volumes',ST+'persistent-volumes/'],['Storage Classes',ST+'storage-classes/']]};

/* ---------- Additional content ---------- */
/* 7: Volume and group snapshots */
L['k8s:7:7']={blocks:[
{p:'The core lecture introduced `VolumeSnapshot`. This one covers how the objects relate, how to **restore** and how **group snapshots** capture several volumes consistently.'},
{h:'The object model'},
{t:[['Object','Scope','Role'],
['**VolumeSnapshotClass**','Cluster','Names the CSI driver and a `deletionPolicy` (Delete or Retain)'],
['**VolumeSnapshot**','Namespace','The request: "snapshot this PVC using that class"'],
['**VolumeSnapshotContent**','Cluster','The real snapshot on the storage system, bound one-to-one to a VolumeSnapshot']]},
{p:'This mirrors PVC and PV. Snapshots can be created **dynamically** from a PVC or **pre-provisioned** by pointing a VolumeSnapshotContent at an existing storage-side snapshot.'},
{code:`kubectl get volumesnapshotclass
kubectl get volumesnapshot -n shop
kubectl get volumesnapshotcontent
kubectl describe volumesnapshot db-snap-1 -n shop      # READYTOUSE, restore size, errors
kubectl get volumesnapshot db-snap-1 -n shop -o jsonpath='{.status.readyToUse}{"\\n"}'`},
{h:'Restore into a new PVC'},
{code:`apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: db-restored, namespace: shop}
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: fast-ssd
  resources: {requests: {storage: 50Gi}}        # at least the snapshot restore size
  dataSource:
    apiGroup: snapshot.storage.k8s.io
    kind: VolumeSnapshot
    name: db-snap-1`},
{ul:['Restore creates a **new** volume; it does not roll the original back in place.','The new claim must be in the **same namespace** as the VolumeSnapshot.','Cross-namespace restore needs an explicit transfer mechanism (check the current docs for the `CrossNamespaceVolumeDataSource` approach).','A snapshot with `deletionPolicy: Delete` removes the storage snapshot when the VolumeSnapshot object is deleted; use `Retain` for snapshots you must keep.']},
{h:'Group snapshots'},
{p:'Applications with several volumes (a database with data and WAL volumes) need a **crash-consistent set** taken at the same instant. **VolumeGroupSnapshot** asks the driver to snapshot all PVCs matching a label selector together.'},
{code:`apiVersion: groupsnapshot.storage.k8s.io/v1beta1
kind: VolumeGroupSnapshot
metadata: {name: db-group-1, namespace: shop}
spec:
  volumeGroupSnapshotClassName: csi-group
  source:
    selector:
      matchLabels: {app: db}`},
{ul:['Group snapshots depend on **driver support** and extra CRDs and sidecars; availability and API version vary by release. Check the current status in the Kubernetes docs and your driver documentation.','Always combine snapshots with **application quiescing** (flush or freeze) when you need application-consistent backups.']},
{note:'A snapshot on the same storage array is not a disaster-recovery backup. Copy data out with a backup tool (Velero with a data mover, or storage replication).'}],
src:[['Volume Snapshots',K.C+'storage/volume-snapshots/'],['Volume Snapshot Classes',K.C+'storage/volume-snapshot-classes/']]};

/* 8: CSI drivers in depth */
L['k8s:7:8']={blocks:[
{p:'A CSI driver is more than one container. Knowing the parts helps you read logs, size permissions and diagnose attach, mount and provisioning failures.'},
{h:'Plugin services'},
{t:[['gRPC service','Methods (examples)','Runs'],
['**Identity**','GetPluginInfo, GetPluginCapabilities, Probe','Both controller and node plugins'],
['**Controller**','CreateVolume, DeleteVolume, ControllerPublishVolume (attach), ControllerExpandVolume, CreateSnapshot','Controller plugin (Deployment, with sidecars)'],
['**Node**','NodeStageVolume, NodePublishVolume, NodeExpandVolume, NodeGetInfo','Node plugin (DaemonSet)']]},
{h:'Sidecar containers'},
{t:[['Sidecar','Watches','Calls the driver for'],
['`external-provisioner`','PVCs with the driver StorageClass','CreateVolume, then creates the PV'],
['`external-attacher`','VolumeAttachment objects','ControllerPublishVolume (attach to a node)'],
['`external-resizer`','PVC size changes','ControllerExpandVolume'],
['`external-snapshotter`','VolumeSnapshot objects','CreateSnapshot'],
['`node-driver-registrar`','(node side)','Registers the driver with the kubelet through a socket'],
['`livenessprobe`','(health)','Probe of the driver']]},
{h:'The path of a volume'},
{flow:['PVC created: external-provisioner calls CreateVolume','PV created and bound','Pod scheduled: a VolumeAttachment is created','external-attacher attaches the volume to the node','Kubelet calls NodeStageVolume (format and mount to a staging path)','Kubelet calls NodePublishVolume (bind mount into the Pod directory)','On deletion: unpublish, unstage, detach, and later DeleteVolume per reclaim policy']},
{code:`kubectl get csidriver ebs.csi.aws.com -o yaml | sed -n '/spec:/,$p'
# attachRequired, podInfoOnMount, volumeLifecycleModes (Persistent, Ephemeral), fsGroupPolicy
kubectl get volumeattachments
kubectl -n kube-system logs deploy/ebs-csi-controller -c csi-provisioner --tail=30
kubectl -n kube-system logs ds/ebs-csi-node -c ebs-plugin --tail=30
kubectl get csinode w1 -o yaml`},
{h:'Key CSIDriver settings'},
{ul:['`attachRequired`: whether a separate attach step exists (not for NFS-style drivers).','`podInfoOnMount`: passes Pod name and namespace to the driver.','`fsGroupPolicy`: whether Kubernetes changes group ownership of the volume for `fsGroup`.','`storageCapacity`: enables capacity-aware scheduling (next lecture).','`volumeLifecycleModes`: supports `Ephemeral` inline volumes as well.']},
{h:'Troubleshooting by layer'},
{t:[['Failure','Where to look'],
['PVC Pending','`external-provisioner` logs; cloud quota and IAM permissions'],
['Attach fails','`external-attacher` logs, `VolumeAttachment` status and error'],
['Mount fails','Node plugin logs and kubelet logs on that node'],
['Resize stuck','`external-resizer` logs and PVC conditions'],
['Driver missing on a node','`CSINode`, node DaemonSet Pod, registrar sidecar']]},
{note:'On managed clusters the driver is usually an add-on with a cloud IAM role. Most outages are expired or missing permissions, not driver bugs.'}],
src:[['Volumes: CSI',K.C+'storage/volumes/#csi'],['CSI developer documentation','https://kubernetes-csi.github.io/docs/'],['CSI Volume Cloning',K.C+'storage/volume-pvc-datasource/']]};

/* 9: Topology, binding modes, capacity-aware */
L['k8s:7:9']={blocks:[
{p:'A volume that exists in the wrong place is useless. Zonal disks, local disks and capacity-limited storage need the **scheduler and the provisioner to cooperate**.'},
{h:'The problem'},
{p:'With `volumeBindingMode: Immediate`, the volume is created as soon as the PVC exists, in a zone the provisioner picks. If the Pod then needs to run elsewhere (resources, taints, spread rules), it is **unschedulable** or the volume must be recreated.'},
{h:'WaitForFirstConsumer'},
{flow:['PVC is created and stays Pending','Pod using the PVC is created','The scheduler picks a node considering the Pod needs and the volume topology','The provisioner creates the volume in that node zone','PVC binds, Pod starts']},
{code:`apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: {name: zonal-ssd}
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer
allowedTopologies:                              # optional: limit where volumes may be created
- matchLabelExpressions:
  - key: topology.kubernetes.io/zone
    values: [eu-west-1a, eu-west-1b]`},
{h:'How topology is recorded'},
{ul:['The PV has **node affinity** (`spec.nodeAffinity`) naming the zone or node where it exists.','The scheduler **VolumeBinding** and **VolumeZone** plugins filter nodes that cannot reach the volume.','A Pod using an existing zonal volume is forced into that zone: spread rules and anti-affinity must fit.']},
{code:`kubectl get pv -o custom-columns=NAME:.metadata.name,ZONE:.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values
kubectl describe pod db-0 | sed -n '/Events:/,$p'      # "volume node affinity conflict" etc.
kubectl describe pvc data-db-0`},
{h:'Capacity-aware provisioning'},
{p:'Some drivers (local, NFS exports with quotas, SAN pools) have **limited capacity per node or zone**. With the `storageCapacity: true` setting on the CSIDriver, the driver publishes **CSIStorageCapacity** objects, and the scheduler avoids nodes where the requested size does not fit.'},
{code:`kubectl get csistoragecapacities -A
kubectl describe csistoragecapacity -n kube-system <name>`},
{h:'Common errors'},
{t:[['Message','Meaning'],
['`1 node(s) had volume node affinity conflict`','The Pod must run where the PV lives, but other rules exclude those nodes'],
['`pod has unbound immediate PersistentVolumeClaims`','PVC could not be provisioned; look at provisioner events'],
['`waiting for first consumer to be created before binding`','Normal with WaitForFirstConsumer until a Pod uses the claim'],
['`no persistent volumes available for this claim`','No matching PV and no provisioner']]},
{ul:['Use **WaitForFirstConsumer** for any topology-bound storage.','For StatefulSets spread across zones, use per-zone volumes through the binding mode, plus topology spread constraints.','If a zone is lost, volumes in it are unavailable; plan replication or backups for stateful data.']},
{note:'Rescheduling a stateful Pod after a node failure still requires its volume to be attachable to another node in the same zone. Cross-zone moves need a snapshot and restore, not just a new Pod.'}],
src:[['Storage Classes: volume binding mode',K.C+'storage/storage-classes/#volume-binding-mode'],['Storage Capacity',K.C+'storage/storage-capacity/'],['Volumes: allowed topologies',K.C+'storage/storage-classes/#allowed-topologies']]};

/* 10: Local volumes and hostPath */
L['k8s:7:10']={blocks:[
{p:'Local disks are fast and cheap, but they tie data to **one node**. Kubernetes supports them safely through **local PersistentVolumes**; `hostPath` is the dangerous shortcut.'},
{h:'hostPath: why it is risky'},
{ul:['The Pod reads and writes **any path** on the node, including `/var/run/containerd/containerd.sock`, `/etc` and `/`. Mounting the runtime socket is effectively root on the node.','Data is tied to a node, but nothing makes the Pod return there after rescheduling.','Behaviour differs by node (the path may not exist or hold different content).','Pod Security **baseline and restricted** profiles forbid `hostPath` volumes.']},
{code:`# Acceptable only for node-level system agents, read-only where possible
volumes:
- name: logs
  hostPath: {path: /var/log, type: Directory}
containers:
- volumeMounts: [{name: logs, mountPath: /host-logs, readOnly: true}]`},
{h:'local PersistentVolumes'},
{p:'A **local PV** points to a path on a specific node and carries **node affinity**, so the scheduler places Pods that use it on that node. It requires `WaitForFirstConsumer` binding.'},
{code:`apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: {name: local-nvme}
provisioner: kubernetes.io/no-provisioner      # no dynamic provisioning for static local PVs
volumeBindingMode: WaitForFirstConsumer
---
apiVersion: v1
kind: PersistentVolume
metadata: {name: local-pv-w1-nvme0}
spec:
  capacity: {storage: 500Gi}
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: local-nvme
  local: {path: /mnt/disks/nvme0}
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - {key: kubernetes.io/hostname, operator: In, values: [w1]}`},
{ul:['The **local static provisioner** discovers disks under a directory and creates PVs automatically.','If the node fails, the data is **unavailable** until the node returns. The Pod cannot move.','Use replicated applications (databases with replication) so another Pod holds a copy.','Local volumes are not backed up by default; you need your own backup process.']},
{h:'Other node-local options'},
{t:[['Option','Use'],
['`emptyDir`','Scratch space, cache; removed with the Pod; can use memory (`medium: Memory`)'],
['Generic ephemeral volume','Per-Pod claim from a StorageClass; can use local storage via a CSI driver that supports it'],
['Local PV','Durable data on a specific node, fast I/O'],
['CSI local drivers (TopoLVM, OpenEBS local)','Dynamic provisioning from node disks with capacity tracking']]},
{note:'Choose local storage when performance or cost justifies tying data to nodes, and design the application for node loss. For general use, network block storage is easier to operate.'}],
src:[['Volumes: local',K.C+'storage/volumes/#local'],['Local persistent volumes',K.C+'storage/persistent-volumes/#local'],['Pod Security Standards',K.C+'security/pod-security-standards/']]};

/* 11: OCI image volumes and projected volumes */
L['k8s:7:11']={blocks:[
{h:'Image volumes: mount image content as a volume'},
{p:'An **image volume** mounts the contents of an **OCI image or artifact** read-only into a container. Data and tools can ship through your registry without being baked into the application image: ML models, configuration bundles, plugins, scanner databases.'},
{code:`apiVersion: v1
kind: Pod
metadata: {name: model-server}
spec:
  containers:
  - name: server
    image: myorg/server:1.4
    volumeMounts:
    - {name: model, mountPath: /models, readOnly: true}
  volumes:
  - name: model
    image:
      reference: registry.example.com/models/classifier:2025-10
      pullPolicy: IfNotPresent`},
{ul:['The volume is **read-only** and populated by the container runtime when the Pod starts.','Updating the model means publishing a new image tag and rolling the Pods, with the same registry controls, signing and scanning you use for images.','This is a newer feature: stage and runtime support depend on the Kubernetes and containerd or CRI-O versions. Check release notes and enable it where needed.','Image pull secrets and caching work like normal images.']},
{h:'Projected volumes: combine several sources in one directory'},
{p:'A **projected** volume merges multiple sources into one mount path, which is handy when an application expects one directory of mixed content.'},
{code:`volumes:
- name: all-in-one
  projected:
    defaultMode: 0440
    sources:
    - configMap:
        name: app-config
        items: [{key: app.properties, path: conf/app.properties}]
    - secret:
        name: db-credentials
        items: [{key: password, path: secrets/db-password}]
    - downwardAPI:
        items:
        - {path: labels, fieldRef: {fieldPath: metadata.labels}}
        - {path: cpu-limit, resourceFieldRef: {containerName: app, resource: limits.cpu}}
    - serviceAccountToken:
        path: tokens/vault
        audience: vault
        expirationSeconds: 3600`},
{ul:['Each source keeps its own update behaviour: ConfigMaps and Secrets are refreshed in place; a `serviceAccountToken` is renewed by the kubelet before it expires.','File names must not collide across sources.','Use **file permissions** (`defaultMode`, `mode`) and `readOnly: true` for secrets.']},
{h:'Choosing between volume types'},
{t:[['Need','Use'],
['Configuration files','ConfigMap volume'],
['Credentials','Secret volume (or an external secret mechanism), projected if you need to combine'],
['Short-lived identity for another system','Projected `serviceAccountToken` with an audience'],
['Pod facts (labels, limits)','downwardAPI'],
['Large read-only data or tools versioned like software','Image volume'],
['Writable durable data','PVC']]},
{note:'Secrets in volumes are stored in memory (tmpfs) on the node, which is safer than environment variables, but they are still readable by anyone who can exec into the Pod.'}],
src:[['Volumes: image',K.C+'storage/volumes/#image'],['Projected Volumes',K.C+'storage/projected-volumes/'],['Use an Image Volume With a Pod',K.T+'configure-pod-container/image-volumes/']]};
})();
