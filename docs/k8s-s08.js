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
{p:'Container filesystems are ephemeral: a restarted container starts from its image again. A **volume** is a directory made available to containers in a Pod so data can outlive a container restart and be shared.'},
{h:'Volume lifetime'},
{ul:['A **Pod volume** lives as long as the **Pod**. It survives container restarts but not Pod deletion (for ephemeral types).','A **PersistentVolume** lives independently of any Pod (next lectures).']},
{t:[['Type','Data comes from','Lifetime and notes'],
['`emptyDir`','Empty directory created on the node (or in memory with `medium: Memory`)','Removed when the Pod is removed. Scratch space and sharing between containers.'],
['`hostPath`','A path on the node filesystem','Survives Pod, but ties data to one node and exposes the host. Avoid except for system agents.'],
['`configMap`, `secret`','API objects as files','Read-only config; Secrets are held in memory (tmpfs)'],
['`projected`','Several sources merged: configMap, secret, serviceAccountToken, downwardAPI','One mount, many inputs'],
['`downwardAPI`','Pod metadata (labels, limits)','Expose Pod facts to the app'],
['`persistentVolumeClaim`','A claim for durable storage','Independent of Pod lifetime'],
['`ephemeral` (generic ephemeral volume)','A PVC created with the Pod and deleted with it','Scratch storage with real storage features']]},
{code:`apiVersion: v1
kind: Pod
metadata: {name: vol-demo}
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ['sh','-c','date > /scratch/start; sleep 3600']
    volumeMounts:
    - {name: scratch, mountPath: /scratch}
    - {name: cfg, mountPath: /etc/app, readOnly: true}
    - {name: ro, mountPath: /etc/combined, readOnly: true}
  volumes:
  - name: scratch
    emptyDir: {sizeLimit: 500Mi}
  - name: cfg
    configMap: {name: app-config}
  - name: ro
    projected:
      sources:
      - secret: {name: db-cred}
      - configMap: {name: app-config}
      - serviceAccountToken: {path: token, expirationSeconds: 3600, audience: api}`},
{ul:['`volumeMounts.subPath` mounts a single file or subdirectory, but does not receive ConfigMap updates.','`readOnly: true` on a mount is a cheap security improvement.','`emptyDir` counts against the node ephemeral storage; a Pod filling it can be evicted.']},
{code:`kubectl exec vol-demo -- df -h /scratch
kubectl exec vol-demo -- sh -c 'cat /scratch/start'
kubectl delete pod vol-demo           # emptyDir data is gone with it`},
{note:'`hostPath` lets a Pod read or write the node, including container runtime sockets and credentials. Restrict it with Pod Security Admission (Section 10). The additional lecture on local volumes covers when it is acceptable.'}],
src:[['Volumes',ST+'volumes/'],['Projected Volumes',ST+'projected-volumes/'],['Ephemeral Volumes',ST+'ephemeral-volumes/']]};

/* ---------- 1: PV and PVC ---------- */
L['k8s:7:1']={blocks:[
{p:'Kubernetes separates **providing** storage from **using** it, so application teams do not need to know whether the disk is an EBS volume, an NFS export or Ceph.'},
{svg:pvflow},
{ul:['A **PersistentVolume (PV)** is a piece of storage in the cluster: cluster-scoped, created by an admin or dynamically by a provisioner.','A **PersistentVolumeClaim (PVC)** is a namespaced request for storage: size, access mode and optionally a StorageClass.','The control plane **binds** one PVC to one suitable PV. A bound PV cannot be used by another claim.']},
{code:`apiVersion: v1
kind: PersistentVolume
metadata: {name: pv-nfs-1}
spec:
  capacity: {storage: 20Gi}
  accessModes: [ReadWriteMany]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  nfs:
    server: 10.0.0.20
    path: /exports/data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: data, namespace: shop}
spec:
  accessModes: [ReadWriteMany]
  resources:
    requests: {storage: 10Gi}
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
{h:'Binding rules'},
{ul:['The PV capacity must be **at least** the requested size (a 10Gi claim can bind a 20Gi PV and gets all 20Gi).','Access modes and `storageClassName` must match. An empty class (`""`) means "no class", which is different from omitting the field (which uses the default StorageClass).','`volumeName` in a PVC pins it to a specific PV; `claimRef` in a PV reserves it for a claim.']},
{h:'Status'},
{t:[['Object','Phase','Meaning'],
['PV','`Available`','Free, not bound'],['PV','`Bound`','Bound to a claim'],['PV','`Released`','Claim deleted, volume not yet reclaimed'],['PV','`Failed`','Automatic reclamation failed'],
['PVC','`Pending`','Waiting for a matching PV or provisioning'],['PVC','`Bound`','Ready to use'],['PVC','`Lost`','Its PV no longer exists']]},
{code:`kubectl get pv,pvc -A
kubectl describe pvc data -n shop        # events explain Pending
kubectl get pv -o custom-columns=NAME:.metadata.name,CLASS:.spec.storageClassName,STATUS:.status.phase,CLAIM:.spec.claimRef.name`},
{note:'A PVC stuck in Pending is the most common storage fault. Read its events: no matching PV, no default StorageClass, or (with WaitForFirstConsumer) simply no Pod using it yet.'}],
src:[['Persistent Volumes',ST+'persistent-volumes/']]};

/* ---------- 2: Access modes and reclaim ---------- */
L['k8s:7:2']={blocks:[
{h:'Access modes'},
{t:[['Mode','Short','Meaning'],
['`ReadWriteOnce`','RWO','Mounted read-write by **one node** (several Pods on that node can share it)'],
['`ReadOnlyMany`','ROX','Mounted read-only by many nodes'],
['`ReadWriteMany`','RWX','Mounted read-write by many nodes (needs shared filesystems: NFS, CephFS, EFS, Azure Files)'],
['`ReadWriteOncePod`','RWOP','Mounted read-write by **exactly one Pod** in the whole cluster']]},
{ul:['Block disks (EBS, Azure Disk, Persistent Disk) are typically **RWO** only.','RWO restricts to one **node**, not one Pod. Use RWOP if only one Pod may ever write, for example a single-writer database.','The access mode on a PVC states what you need; the backend must be able to provide it.','Replicas of a Deployment sharing one RWO claim can end up on different nodes and the second stays `ContainerCreating` with a multi-attach error.']},
{h:'Reclaim policy'},
{p:'What happens to the PV (and the data) after its claim is deleted:'},
{t:[['Policy','Effect','Use'],
['`Retain`','PV becomes `Released`; data stays; an admin must clean and reuse it manually','Production data you cannot afford to lose'],
['`Delete`','PV **and the backing storage** are deleted','Default for dynamic provisioning; scratch and dev'],
['`Recycle`','Removed from Kubernetes; use dynamic provisioning instead','Do not use']]},
{code:`# Change the policy of an existing PV (safe habit for important data)
kubectl patch pv pvc-3f2a... -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'

# Reuse a Released PV: clear its claimRef so it becomes Available again
kubectl patch pv pv-nfs-1 --type=json -p '[{"op":"remove","path":"/spec/claimRef"}]'
kubectl get pv`},
{h:'Protection against deletion'},
{ul:['**PVC protection**: a PVC in use by a Pod gets `Terminating` but is not removed until the Pod is gone (finalizer `kubernetes.io/pvc-protection`).','**PV protection**: a PV bound to a claim is not deleted until released.','Do not remove these finalizers by hand unless you are sure; it can destroy data in use.']},
{note:'The default reclaim policy of a StorageClass is **Delete**. Deleting a namespace therefore deletes the cloud disks of every PVC in it. For irreplaceable data set `reclaimPolicy: Retain` on the StorageClass or snapshot regularly.'}],
src:[['Persistent Volumes: access modes',ST+'persistent-volumes/#access-modes'],['Change the Reclaim Policy of a PersistentVolume',T+'administer-cluster/change-pv-reclaim-policy/']]};

/* ---------- 3: StorageClasses ---------- */
L['k8s:7:3']={blocks:[
{p:'A **StorageClass** describes a "kind" of storage and lets Kubernetes create PVs **on demand** when a PVC asks for it. This is **dynamic provisioning**, and it is how almost every real cluster handles storage.'},
{code:`apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
  annotations:
    storageclass.kubernetes.io/is-default-class: "false"
provisioner: ebs.csi.aws.com         # a CSI driver name
parameters:
  type: gp3
  encrypted: "true"
reclaimPolicy: Delete                # or Retain
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
mountOptions: [discard]`},
{code:`# A claim that uses it; the PV is created automatically
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: db-data}
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: fast-ssd
  resources: {requests: {storage: 50Gi}}`},
{h:'Key fields'},
{t:[['Field','Meaning'],
['`provisioner`','Which driver creates volumes (a CSI driver name; the older in-tree names are legacy)'],
['`parameters`','Driver-specific options: disk type, IOPS, encryption, filesystem'],
['`reclaimPolicy`','Policy copied to PVs it creates (default `Delete`)'],
['`allowVolumeExpansion`','Whether claims may be grown later'],
['`volumeBindingMode`','`Immediate` (create right away) or `WaitForFirstConsumer` (wait until a Pod is scheduled)']]},
{h:'Binding mode matters'},
{p:'With `Immediate`, a zonal disk can be created in zone A before the scheduler decides the Pod belongs in zone B, and the Pod becomes unschedulable. `WaitForFirstConsumer` delays provisioning until the scheduler has chosen a node, so the disk is created in the right zone. Use it for zonal storage.'},
{h:'The default class'},
{code:`kubectl get storageclass
# NAME                 PROVISIONER           RECLAIMPOLICY  VOLUMEBINDINGMODE
# standard (default)   rancher.io/local-path Delete         WaitForFirstConsumer

kubectl patch storageclass fast-ssd -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
kubectl patch storageclass standard  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'`},
{ul:['A PVC **without** `storageClassName` gets the default class. A PVC with `storageClassName: ""` gets no class and only binds a PV with no class.','Only one default class should exist.','Class parameters are **immutable** after creation; create a new class to change them.']},
{note:'A kubeadm cluster has no StorageClass and no provisioner by default. PVCs stay Pending until you install one, for example local-path-provisioner for labs or a CSI driver for your platform.'}],
src:[['Storage Classes',ST+'storage-classes/'],['Dynamic Volume Provisioning',ST+'dynamic-provisioning/'],['Change the default StorageClass',T+'administer-cluster/change-default-storage-class/']]};

/* ---------- 4: CSI ---------- */
L['k8s:7:4']={blocks:[
{p:'The **Container Storage Interface (CSI)** is a standard API between Kubernetes and storage systems. Vendors ship a driver; Kubernetes does not need to contain their code. The old "in-tree" volume plugins (such as the built-in AWS EBS one) have been migrated to CSI drivers.'},
{svg:csi},
{h:'Components of a typical driver'},
{t:[['Part','Runs as','Job'],
['**Controller plugin**','Deployment (control plane side)','Create, delete, attach, detach, resize and snapshot volumes via the storage API'],
['**Node plugin**','DaemonSet on every node','Format and mount the volume into the Pod path'],
['**Sidecars** (external-provisioner, attacher, resizer, snapshotter, node-driver-registrar)','Containers beside the driver','Watch Kubernetes objects and call the driver gRPC methods'],
['**CSIDriver** object','Cluster object','Declares driver capabilities (attach required, fsGroup, ephemeral)'],
['**CSINode** object','Per node','Records which drivers are registered on a node']]},
{flow:['PVC created with a StorageClass for the driver','external-provisioner calls CreateVolume','PV object created and bound','Pod scheduled; attacher attaches the volume to the node','kubelet calls the node plugin to stage and publish the mount','Container sees the directory']},
{code:`kubectl get csidrivers
kubectl get csinodes
kubectl -n kube-system get pods | grep -i csi
kubectl get volumeattachments
kubectl describe pod app | sed -n '/Events:/,$p'     # AttachVolume / MountVolume events`},
{h:'Troubleshooting'},
{t:[['Symptom','Look at'],
['PVC Pending','Provisioner logs, StorageClass name and parameters, cloud quotas and permissions'],
['Pod stuck `ContainerCreating`: `AttachVolume.Attach failed`','Controller plugin logs, node IAM permissions, volume already attached elsewhere (multi-attach)'],
['`MountVolume.MountDevice failed`','Node plugin logs, filesystem, missing mount utilities'],
['Driver not found on node','CSINode and the node DaemonSet Pod']]},
{note:'On managed clusters (EKS, AKS, GKE) the storage driver is often installed as an add-on, and it needs cloud permissions (IAM roles or managed identities). A missing permission is the most common reason dynamic provisioning fails.'}],
src:[['Volumes: CSI',ST+'volumes/#csi'],['CSI developer documentation','https://kubernetes-csi.github.io/docs/']]};

/* ---------- 5: Expansion and snapshots ---------- */
L['k8s:7:5']={blocks:[
{h:'Expanding a claim'},
{p:'You can grow (never shrink) a PVC if its StorageClass has `allowVolumeExpansion: true` and the driver supports it. Many drivers expand the filesystem online while the Pod runs; some need the Pod restarted.'},
{code:`kubectl patch pvc db-data -p '{"spec":{"resources":{"requests":{"storage":"100Gi"}}}}'
kubectl get pvc db-data -w
kubectl describe pvc db-data      # conditions: Resizing, FileSystemResizePending
kubectl exec db-0 -- df -h /var/lib/postgresql/data`},
{ul:['Shrinking is not supported: take a snapshot or backup and restore into a smaller claim.','If the class does not allow expansion, the patch is rejected. You may patch the class to allow it for future expansions on existing claims.','StatefulSet `volumeClaimTemplates` cannot be edited in place; patch each PVC manually, then recreate the StatefulSet with `--cascade=orphan`.']},
{h:'Volume snapshots'},
{p:'A **VolumeSnapshot** captures a point-in-time copy of a PVC through the CSI driver. It needs three things: the snapshot **CRDs** and controller (installed separately, not part of core Kubernetes), a **VolumeSnapshotClass**, and a driver that supports snapshots.'},
{code:`apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotClass
metadata: {name: csi-snap}
driver: ebs.csi.aws.com
deletionPolicy: Delete
---
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata: {name: db-snap-1}
spec:
  volumeSnapshotClassName: csi-snap
  source:
    persistentVolumeClaimName: db-data
---
# Restore: a new PVC that uses the snapshot as its data source
apiVersion: v1
kind: PersistentVolumeClaim
metadata: {name: db-restored}
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: fast-ssd
  resources: {requests: {storage: 50Gi}}
  dataSource:
    name: db-snap-1
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io`},
{code:`kubectl get volumesnapshotclass,volumesnapshot,volumesnapshotcontent
kubectl get volumesnapshot db-snap-1 -o jsonpath='{.status.readyToUse}'`},
{note:'A snapshot is **not a backup** if it lives in the same storage system as the volume: losing the system or the account loses both. Combine snapshots with off-site backups, and quiesce or flush databases so the snapshot is application-consistent.'}],
src:[['Volume Snapshots',ST+'volume-snapshots/'],['Persistent Volumes: expanding claims',ST+'persistent-volumes/#expanding-persistent-volumes-claims']]};

/* ---------- 6: Practical ---------- */
L['k8s:7:6']={blocks:[
{p:'Lab: prove that data survives Pod deletion when it is on a PVC. On kind or a kubeadm lab you need a provisioner first; kind includes `standard` (local-path). Check with `kubectl get storageclass`.'},
{h:'1. Claim and Pod'},
{code:`kubectl create ns store-lab && kubectl config set-context --current --namespace=store-lab
cat <<EOF | kubectl apply -f -
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
kubectl get pvc,pv                 # PVC may stay Pending until the Pod is scheduled (WaitForFirstConsumer)
kubectl wait --for=condition=Ready pod/writer --timeout=90s
kubectl exec writer -- cat /data/log.txt`},
{h:'2. Delete the Pod, keep the data'},
{code:`kubectl delete pod writer
# recreate with the same spec (re-apply the Pod part), then:
kubectl exec writer -- cat /data/log.txt        # two lines: old data survived`},
{h:'3. Look at what was created'},
{code:`kubectl get pvc data -o yaml | grep -E "volumeName|storageClassName|phase"
kubectl get pv
kubectl describe pv <pv-name> | grep -E "Reclaim|Source|Path|Node Affinity"`},
{h:'4. Expand (if your class allows)'},
{code:`kubectl get sc -o custom-columns=NAME:.metadata.name,EXPAND:.allowVolumeExpansion
kubectl patch pvc data -p '{"spec":{"resources":{"requests":{"storage":"2Gi"}}}}'
kubectl get pvc data`},
{h:'5. Failure drills'},
{ul:['Create a PVC with `storageClassName: nope` and read the Pending event.','Delete the PVC while the Pod is running: see it stay `Terminating` until the Pod is gone.','With a `Retain` PV, delete the PVC and observe `Released`; then clear `claimRef` and rebind.']},
{h:'Clean up'},
{code:`kubectl delete ns store-lab
kubectl get pv                      # Delete-policy volumes should disappear; Retain ones stay
kubectl config set-context --current --namespace=default`}],
src:[['Persistent Volumes',ST+'persistent-volumes/'],['Storage Classes',ST+'storage-classes/']]};
})();
