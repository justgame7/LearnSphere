/* LearnSphere - Kubernetes Administrator, Section 12: Extending Kubernetes: Helm, Kustomize, CRDs & Operators.
   Lectures 0-5 are core, 6-10 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T,R=K.R;
const EX=C+'extend-kubernetes/';

const helm=K.dg(700,220,[
[10,80,120,60,'Chart|templates + values',2],[170,80,140,60,'helm install|merge values,|render YAML',0],[350,80,140,60,'Kubernetes API|objects created',0],[530,80,160,60,'Release|name, revision,|stored as Secret',2],
[170,160,320,40,'values.yaml defaults, overridden by -f file and --set',1]],
[[130,110,170,110],[310,110,350,110],[490,110,530,110]]);

const kust=K.dg(700,220,[
[10,10,200,200,'base/',1],[250,10,440,200,'overlays/',1],
[30,50,160,50,'deployment.yaml',0],[30,115,160,50,'service.yaml',0],
[270,45,190,70,'dev|replicas: 1|namePrefix: dev-',0],[480,45,190,70,'prod|replicas: 5|image tag, limits',2],
[270,135,400,60,'kubectl apply -k overlays/prod  =  base + prod patches',0]],
[[190,75,270,80],[190,140,480,100]]);

const crd=K.dg(700,200,[
[10,70,130,60,'CRD|defines kind Backup',2],[190,70,140,60,'API server|new REST endpoint|/apis/example.com/v1',0],[380,70,140,60,'Backup objects|stored in etcd',0],[570,70,120,60,'Controller|watches Backups,|does the work',2]],
[[140,100,190,100],[330,100,380,100],[520,100,570,100],[630,70,450,70]]);

const ifaces=K.dg(700,200,[
[250,10,200,50,'kubelet and control plane',2],
[10,100,200,70,'CRI|Container Runtime Interface|containerd, CRI-O',0],[250,100,200,70,'CNI|Container Network Interface|Calico, Cilium, Flannel',0],[490,100,200,70,'CSI|Container Storage Interface|EBS, Ceph, NFS drivers',0]],
[[320,60,110,100],[350,60,350,100],[380,60,590,100]]);

/* ---------- 0: Helm basics ---------- */
L['k8s:11:0']={blocks:[
{p:'A real application is not one YAML file: it is a Deployment, a Service, a ConfigMap, an Ingress, a ServiceAccount, maybe a HorizontalPodAutoscaler, all with values that differ between dev and prod. Copying and editing those files for every environment does not scale. **Helm** is the package manager for Kubernetes: it bundles the manifests into a **chart**, fills them in from **values**, and tracks each installation as a **release** you can upgrade and roll back.'},
{svg:helm},
{h:'The vocabulary'},
{t:[['Term','Meaning','Analogy'],
['**Chart**','A package: templates, default values and metadata','An installer package'],
['**Repository**','A place charts are published: an HTTP index or an **OCI registry**','A package repository'],
['**Release**','One installed instance of a chart in a namespace, with a name and a **revision** history','An installed application'],
['**Values**','The configuration inputs that fill the templates','Installer options'],
['**Revision**','A numbered version of a release; every install or upgrade creates one','A save point']]},
{h:'What is in a chart'},
{code:`mychart/
  Chart.yaml            # name, version (the CHART version), appVersion (the app), dependencies
  values.yaml           # default values
  values.schema.json    # optional: validates user values
  templates/            # Go-templated Kubernetes manifests
    deployment.yaml
    service.yaml
    _helpers.tpl        # named snippets (names, labels)
    NOTES.txt           # message printed after install
  charts/               # packaged dependency charts`},
{h:'Working with repositories'},
{code:`$ helm version
$ helm repo add bitnami https://charts.bitnami.com/bitnami
$ helm repo update
$ helm search repo nginx
NAME                CHART VERSION   APP VERSION   DESCRIPTION
bitnami/nginx       18.2.0          1.27.2        NGINX Open Source is a web server ...
$ helm search hub wordpress                       # search Artifact Hub, the public index
$ helm show chart bitnami/nginx
$ helm show values bitnami/nginx > values.yaml    # every option and its default: READ this before installing
$ helm pull bitnami/nginx --untar                 # download and unpack to read the templates`},
{h:'Installing and inspecting a release'},
{code:`$ helm install web bitnami/nginx -n shop --create-namespace --version 18.2.0
NAME: web
LAST DEPLOYED: Fri Oct  9 10:20:00 2026
NAMESPACE: shop
STATUS: deployed
REVISION: 1
$ helm list -A
NAME   NAMESPACE   REVISION   UPDATED                    STATUS     CHART          APP VERSION
web    shop        1          2026-10-09 10:20:00 UTC    deployed   nginx-18.2.0   1.27.2
$ helm status web -n shop
$ helm get values web -n shop                     # the values YOU supplied
$ helm get manifest web -n shop | head -n 30      # the YAML that was applied
$ kubectl -n shop get all
$ helm uninstall web -n shop`},
{h:'Where Helm keeps its state'},
{p:'Helm 3 has no server component. Release records are stored **in the cluster** as Secrets of type `helm.sh/release.v1` in the release namespace, one per revision. That is why `helm list` works from any machine, and also why **anyone who can read Secrets in that namespace can read the release values** (which may include passwords).'},
{code:`$ kubectl -n shop get secrets -l owner=helm
NAME                          TYPE                 DATA
sh.helm.release.v1.web.v1     helm.sh/release.v1   1`},
{h:'Look before you leap'},
{code:`helm template web bitnami/nginx -f values.yaml | less                 # render locally: nothing touches the cluster
helm install web bitnami/nginx --dry-run --debug -n shop              # render with server-side checks
helm lint ./mychart                                                   # check a chart you wrote`},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Installing a chart without reading `helm show values`','Surprising defaults (exposed Services, no persistence, wrong resources)','Review values and rendered manifests first'],
['No `--version`','Unpinned chart; installs differ over time','Pin the chart version in automation'],
['Treating a chart as trusted code','It creates cluster objects, including RBAC','Read templates, check the source, mirror charts you depend on'],
['Mixing `helm` and `kubectl edit` on the same objects','Helm overwrites your edits at the next upgrade','Change values, not live objects'],
['Forgetting the namespace','Two releases of the same name in different places','Always pass `-n` and set the context']]},
{note:'Think of Helm as `apt` for clusters, with one difference that matters: it is configuration, not just binaries. Always review what a chart will create, and keep your own values files in Git.'}],
src:[['Helm documentation','https://helm.sh/docs/'],['Using Helm','https://helm.sh/docs/intro/using_helm/'],['Helm quickstart','https://helm.sh/docs/intro/quickstart/']]};

/* ---------- 1: Helm operations ---------- */
L['k8s:11:1']={blocks:[
{p:'Installing a chart is the easy part. Operating it means changing configuration, upgrading to new chart versions, understanding what Helm will do to your running application, and recovering when an upgrade goes wrong. The key idea: **you change values, Helm re-renders and applies, and every change is a numbered revision you can return to**.'},
{h:'How values are merged'},
{p:'Several sources can supply values. They are merged in a fixed order, and **later sources override earlier ones**:'},
{flow:['The chart default values.yaml','Each -f values file, in the order given','--set and --set-string flags (highest priority)']},
{code:`# values-prod.yaml
replicaCount: 3
image:
  tag: "1.27.2"
resources:
  requests: {cpu: 100m, memory: 128Mi}
service: {type: ClusterIP}

helm install web bitnami/nginx -n shop -f values-prod.yaml --set replicaCount=5 --version 18.2.0
$ helm get values web -n shop                  # only what you supplied (replicaCount is 5)
$ helm get values web -n shop --all            # merged with every chart default`},
{ul:['`--set a.b=c` for scalars, `--set list[0]=x` for lists, `--set-string` to force text (so `"1.10"` is not turned into a number), `--set-file` to read a file.','Keep real configuration in **files under version control**; long `--set` chains cannot be reviewed.','Never put secrets in values files committed to Git.']},
{h:'Upgrade, history and rollback'},
{code:`$ helm upgrade web bitnami/nginx -n shop -f values-prod.yaml --version 18.3.0
Release "web" has been upgraded. Happy Helming!
REVISION: 2
$ helm upgrade --install web bitnami/nginx -n shop -f values-prod.yaml     # idempotent: install if missing, upgrade if present

$ helm history web -n shop
REVISION   UPDATED                    STATUS       CHART          APP VERSION   DESCRIPTION
1          Fri Oct  9 10:20:00 2026   superseded   nginx-18.2.0   1.27.2        Install complete
2          Fri Oct  9 11:05:00 2026   deployed     nginx-18.3.0   1.27.3        Upgrade complete

$ helm rollback web 1 -n shop                    # creates revision 3 with the content of revision 1
$ helm history web -n shop | tail -n 2
$ helm uninstall web -n shop --keep-history      # keep records so a rollback is still possible`},
{p:'A rollback re-applies the **Kubernetes manifests** of an earlier revision. It does **not** undo database migrations, deleted data or volumes changed by the application.'},
{h:'Making upgrades safer'},
{t:[['Option','What it does'],
['`--atomic`','Wait for readiness; **roll back automatically** if the upgrade fails or times out'],
['`--wait --timeout 5m`','Wait until Deployments, StatefulSets and Jobs are ready'],
['`helm diff upgrade` (plugin)','Show exactly what would change in the cluster before you apply it'],
['`--dry-run --debug`','Render and validate without applying'],
['`--reuse-values`','Reuse previous values: convenient but **hides new chart defaults**; prefer passing a full values file'],
['`--history-max 10`','Limit stored revisions (each is a Secret)']]},
{h:'Troubleshooting'},
{t:[['Message','Cause','Fix'],
['`cannot re-use a name that is still in use`','A release of that name exists in the namespace','`helm upgrade --install` or a new name'],
['`UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress`','A previous run left the release in a pending state','`helm history`; roll back to the last good revision or fix and retry'],
['`rendered manifests contain a resource that already exists`','The object was created outside Helm','Adopt it (ownership labels and annotations) or delete it'],
['`Error: UPGRADE FAILED: timed out waiting for the condition`','New Pods never became Ready','`kubectl describe` the new Pods; `helm rollback`'],
['Pods unchanged after upgrading a ConfigMap value','Pod template did not change, so no rollout','Add a checksum annotation in the chart, or `kubectl rollout restart`'],
['Template error `nil pointer evaluating`','A value used by the template is missing','Compare your values with `helm show values`']]},
{h:'Habits for production'},
{ul:['Pin **chart versions** and keep `values-<env>.yaml` in Git next to your Kustomize or GitOps config.','Upgrade in a lower environment first with the **same chart version**.','Read the chart **changelog** before each upgrade: defaults and required values change between versions.','Use `helm get manifest` and `kubectl diff` when you need to see the actual objects.']},
{note:'Exam tip: for Helm tasks, the commands are `helm repo add`, `helm search repo`, `helm install` with `--set` or `-f`, `helm upgrade`, `helm rollback` and `helm uninstall`. Always check the release with `helm list -A` and the objects with `kubectl get`.'}],
src:[['helm upgrade','https://helm.sh/docs/helm/helm_upgrade/'],['Values','https://helm.sh/docs/chart_best_practices/values/'],['helm rollback','https://helm.sh/docs/helm/helm_rollback/']]};

/* ---------- 2: Kustomize ---------- */
L['k8s:11:2']={blocks:[
{p:'Helm solves "package and configure" with templates. **Kustomize** solves a narrower problem with a different philosophy: you keep **plain, valid YAML** and describe **how to modify it** for each environment, using overlays and patches. There are no template languages, so every file is a normal Kubernetes manifest that you can read and apply. Kustomize is built into `kubectl`.'},
{svg:kust},
{h:'Bases and overlays'},
{ul:['A **base** is a directory with the common manifests and a `kustomization.yaml` that lists them.','An **overlay** is another directory (dev, staging, prod) whose `kustomization.yaml` points at the base and **adds changes**: patches, a name prefix, a namespace, different image tags, extra resources.','Rendering = base + overlay changes. The base files are never edited for one environment.']},
{code:`app/
  base/
    kustomization.yaml
    deployment.yaml
    service.yaml
  overlays/
    dev/kustomization.yaml
    prod/
      kustomization.yaml
      replica-patch.yaml`},
{code:`# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources: [deployment.yaml, service.yaml]
labels:
- pairs: {app: web}
  includeSelectors: true

# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: shop-prod
namePrefix: prod-
resources: [../../base]
images:
- name: nginx
  newTag: "1.27.2"
patches:
- path: replica-patch.yaml
configMapGenerator:
- name: app-config
  literals: [LOG_LEVEL=warn]

# overlays/prod/replica-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata: {name: web}
spec: {replicas: 5}`},
{h:'Build, review, apply'},
{code:`$ kubectl kustomize overlays/prod | head -n 20          # render to stdout: ALWAYS review first
apiVersion: v1
kind: Service
metadata: {labels: {app: web}, name: prod-web, namespace: shop-prod}
...
$ kubectl diff -k overlays/prod                         # what would change in the cluster
$ kubectl apply -k overlays/prod
$ kubectl get all -n shop-prod
$ kubectl delete -k overlays/prod`},
{h:'What Kustomize can do'},
{t:[['Field','Effect'],
['`resources`','Include files, directories or other bases (also remote URLs)'],
['`namespace`, `namePrefix`, `nameSuffix`','Retarget and rename **every** object and fix references between them'],
['`labels`, `commonLabels`, `commonAnnotations`','Add metadata to all objects (careful: labels in selectors are immutable on existing Deployments)'],
['`images`','Change image names, tags or digests without editing the base'],
['`patches`','Strategic merge or JSON 6902 patches targeting objects by name or label'],
['`configMapGenerator`, `secretGenerator`','Create ConfigMaps and Secrets from literals and files, with a **content hash suffix**'],
['`components`','Reusable optional features you can add to overlays']]},
{p:'The **hash suffix** on generated ConfigMaps is clever: `app-config-7k2f9m` changes whenever the content changes, Kustomize rewrites every reference to it, and the Deployment template changes, so the Pods **roll out automatically** with the new configuration.'},
{h:'Patching'},
{code:`# strategic merge patch: merges into the matching object by name
apiVersion: apps/v1
kind: Deployment
metadata: {name: web}
spec:
  template:
    spec:
      containers:
      - name: web
        resources: {limits: {memory: 512Mi}}

# JSON 6902 patch (precise operations)
patches:
- target: {kind: Deployment, name: web}
  patch: |-
    - op: replace
      path: /spec/replicas
      value: 5`},
{h:'Helm or Kustomize?'},
{t:[['','Helm','Kustomize'],
['Style','Templates and values','Plain YAML with overlays and patches'],
['Packaging and versioning','Charts in repositories, versions','Directories in Git (version control is the packaging)'],
['Release tracking and rollback','Yes (`helm history`, `rollback`)','No: use Git and GitOps'],
['Learning curve','Template language','Small and declarative'],
['Best for','Third-party software with many options','Your own apps and per-environment differences']]},
{p:'They combine well: render a third-party chart with `helm template` and apply Kustomize patches on top, or let a GitOps tool such as Argo CD or Flux do both.'},
{h:'Common mistakes'},
{ul:['Editing the base for one environment, defeating the purpose.','Using `commonLabels` on existing Deployments: the selector changes and the update is rejected (selectors are immutable).','Forgetting that patches match by **name**: a `namePrefix` applied in the same file changes what the target is called.','Applying an overlay without rendering it first, and discovering surprises in the cluster.','Mixing manual `kubectl edit` with Kustomize applies.']},
{note:'Exam tip: `kubectl kustomize DIR` to look, `kubectl apply -k DIR` to apply. For a quick patch, copy the example from the Kustomize page of the documentation.'}],
src:[['Declarative Management using Kustomize',T+'manage-kubernetes-objects/kustomization/'],['Kustomize','https://kubectl.docs.kubernetes.io/references/kustomize/'],['kubectl kustomize',R+'kubectl/generated/kubectl_kustomize/']]};

/* ---------- 3: CRDs ---------- */
L['k8s:11:3']={blocks:[
{p:'Kubernetes ships with types such as Pod, Deployment and Service. A **CustomResourceDefinition (CRD)** lets you teach the API server a **new type**. Once you create it, objects of that type behave like built-in ones: you `kubectl get` and `apply` them, RBAC and namespaces apply, they are stored in etcd and can be watched. This is the foundation of the operator ecosystem: cert-manager, Argo CD, Prometheus Operator and Gateway API are all CRDs.'},
{svg:crd},
{h:'A CRD in practice'},
{code:`apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backups.example.com              # must be <plural>.<group>
spec:
  group: example.com
  scope: Namespaced                       # or Cluster
  names:
    plural: backups
    singular: backup
    kind: Backup
    shortNames: [bk]
  versions:
  - name: v1
    served: true
    storage: true                         # exactly one version is the storage version
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            required: [schedule, target]
            properties:
              schedule: {type: string}
              target:   {type: string}
              keep:     {type: integer, minimum: 1, default: 7}
            x-kubernetes-validations:     # CEL rule evaluated by the API server
            - rule: "self.keep <= 100"
              message: "keep must be at most 100"
          status:
            type: object
            x-kubernetes-preserve-unknown-fields: true
    subresources: {status: {}}
    additionalPrinterColumns:
    - {name: Schedule, type: string, jsonPath: .spec.schedule}`},
{h:'Use it like any other resource'},
{code:`$ kubectl apply -f backup-crd.yaml
customresourcedefinition.apiextensions.k8s.io/backups.example.com created
$ kubectl get crd backups.example.com
$ kubectl api-resources --api-group=example.com
NAME      SHORTNAMES   APIVERSION       NAMESPACED   KIND
backups   bk           example.com/v1   true         Backup

$ kubectl apply -f - <<EOF
apiVersion: example.com/v1
kind: Backup
metadata: {name: nightly, namespace: shop}
spec: {schedule: "0 2 * * *", target: db}
EOF
$ kubectl get backups -n shop
NAME      SCHEDULE
nightly   0 2 * * *
$ kubectl explain backup.spec                      # schema documentation comes for free
$ kubectl get bk nightly -n shop -o yaml | grep keep      # default applied: keep: 7`},
{h:'The schema is the contract'},
{ul:['In `apiextensions.k8s.io/v1` a **structural schema is required**. The API server uses it to **validate** input, apply **defaults**, and **prune unknown fields** (fields not in the schema are silently dropped unless preserved).','**CEL rules** (`x-kubernetes-validations`) add cross-field validation without writing a webhook.','`subresources.status` separates `spec` (what users write) from `status` (what the controller writes); `scale` lets the HPA and `kubectl scale` work.','`additionalPrinterColumns` shapes the output of `kubectl get`.']},
{h:'Versions and conversion'},
{p:'A CRD can serve several versions (`v1alpha1`, `v1beta1`, `v1`), but **one** is the storage version. When versions differ in schema, a **conversion** strategy translates between them (none for identical schemas, or a conversion webhook). Evolving a CRD is like evolving an API: add optional fields, deprecate before removing, and never change the meaning of an existing field.'},
{h:'A CRD alone does nothing'},
{p:'Creating a `Backup` object only **stores** it. Nothing performs a backup until a **controller** watches `Backup` objects and acts, which is exactly what an **operator** is (next lecture). CRD plus controller is the whole pattern.'},
{h:'Operating CRDs: dangers and checks'},
{t:[['Risk','Consequence','Mitigation'],
['**Deleting a CRD**','**Deletes every custom resource of that kind**','Back up first; protect with RBAC and review before deleting'],
['Wrong or loose schema','Bad data stored, or fields pruned unexpectedly','Test with `kubectl apply --dry-run=server`'],
['CRD installed but controller missing','Objects sit without effect','Check the operator Deployment'],
['Helm and CRDs','Helm installs files in `crds/` once but **does not upgrade or delete** them','Manage CRD upgrades deliberately'],
['Cluster-scoped, shared','One team change affects everyone','Review CRD changes like API changes']]},
{code:`kubectl get crd | grep example.com
kubectl describe crd backups.example.com | sed -n '/Conditions:/,/Events:/p'      # Established=True, NamesAccepted=True
kubectl get crd backups.example.com -o jsonpath='{.status.storedVersions}{"\\n"}'
kubectl auth can-i create backups.example.com --as jane -n shop`},
{note:'Exam tip: CRD tasks usually ask you to inspect (`kubectl get crd`, `kubectl explain`), create a custom resource from a given CRD, or list resources of a custom kind: all with ordinary kubectl commands.'}],
src:[['Custom Resources',EX+'api-extension/custom-resources/'],['Extend the Kubernetes API with CustomResourceDefinitions',T+'extend-kubernetes/custom-resources/custom-resource-definitions/'],['Versions of CustomResourceDefinitions',T+'extend-kubernetes/custom-resources/custom-resource-definition-versioning/']]};

/* ---------- 4: Operators ---------- */
L['k8s:11:4']={blocks:[
{p:'Running a complex stateful application, such as a database cluster, involves human knowledge: how to bootstrap it, add a replica, take a consistent backup, upgrade versions in the right order, fail over safely. An **operator** captures that knowledge in software. It is a **custom resource definition plus a controller** that continuously reconciles the real application toward what the custom resource declares.'},
{h:'The operator idea'},
{flow:['You create a custom resource: for example a PostgreSQL cluster with 3 instances and 50Gi storage','The operator controller sees it through a watch','It creates what is needed: StatefulSets, Services, Secrets, volumes, configuration','It keeps reconciling: replaces failed members, promotes a new primary, runs backups','You edit the custom resource (version, size); the operator performs the safe sequence']},
{p:'This is the same control-loop pattern as the built-in Deployment controller (Section 3), applied to your application. The difference is that the **operational knowledge of that specific software** lives in the controller.'},
{h:'A worked example'},
{code:`# 1. Install the operator: CRDs plus the controller Deployment (Helm, manifests or OLM)
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm install cnpg cnpg/cloudnative-pg -n cnpg-system --create-namespace

# 2. See what it added
$ kubectl get crd | grep cnpg
clusters.postgresql.cnpg.io        poolers.postgresql.cnpg.io  ...
$ kubectl -n cnpg-system get deploy,pods

# 3. Declare a database cluster as a custom resource
$ kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata: {name: pg, namespace: shop}
spec:
  instances: 3
  storage: {size: 10Gi}
EOF
$ kubectl get cluster -n shop
NAME   AGE   INSTANCES   READY   STATUS                     PRIMARY
pg     2m    3           3       Cluster in healthy state   pg-1
$ kubectl get pods,pvc,svc -n shop                   # the operator created Pods, volumes and Services for you`},
{h:'What operators are good at'},
{t:[['Task','Why an operator helps'],
['Provisioning','A few lines of YAML instead of dozens of objects'],
['Day-2 operations','Backup schedules, restores, rolling upgrades in the right order'],
['Self-healing with application knowledge','Failover, re-sync of a replica, quorum handling'],
['Configuration changes','Safe sequence, with status reporting'],
['Consistency','The same declared state everywhere, driven by GitOps']]},
{h:'Operating operators: what you must know'},
{ul:['**Install order**: CRDs first, then the controller. Helm charts keep CRDs in a `crds/` directory that Helm installs once but **never upgrades or deletes**, so plan CRD upgrades.','**RBAC**: operators are powerful and often need wide permissions. Read the ClusterRole they ask for.','**Scope**: some watch one namespace, others the whole cluster. Match your tenancy model.','**Upgrades**: read release notes, back up data, upgrade the **operator before** the managed instances, and test on a copy.','**Failure mode**: if the operator is down, the **running database keeps running**, but there is no healing or change handling until it returns.','**Observability**: look at the custom resource **status**, the operator logs and Kubernetes events.']},
{code:`kubectl get crd
kubectl api-resources | grep -v "k8s.io"                     # custom kinds in the cluster
kubectl -n cnpg-system logs -l app.kubernetes.io/name=cloudnative-pg --tail=20
kubectl describe cluster pg -n shop                          # events and conditions written by the operator
kubectl get cluster pg -n shop -o jsonpath='{.status.phase}{"\\n"}'`},
{h:'Finding and choosing operators'},
{p:'**Artifact Hub** and **OperatorHub.io** list community and vendor operators. The **Operator Lifecycle Manager (OLM)** is an optional layer that installs and updates operators from catalogs; many clusters simply use Helm or plain manifests.'},
{t:[['Check before adopting','Why'],
['Maintenance activity and release cadence','You are adding a dependency for critical data'],
['How **backups and restores** work','You must be able to recover without the operator'],
['Upgrade path and CRD versioning','Avoid being stuck on an old version'],
['RBAC requested','Security review'],
['Support model','Community, vendor, or your team']]},
{note:'An operator is a convenience, not a substitute for understanding the software it runs. Practise a restore and a failover on a test instance before you depend on it in production.'}],
src:[['Operator pattern',EX+'operator/'],['Custom Resources',EX+'api-extension/custom-resources/'],['Artifact Hub','https://artifacthub.io/']]};

/* ---------- 5: CNI CSI CRI ---------- */
L['k8s:11:5']={blocks:[
{p:'Kubernetes does not ship its own container runtime, network implementation or storage drivers. Instead it defines **interfaces**, and vendors provide interchangeable plugins behind them. Three of them matter most to an administrator: **CRI**, **CNI** and **CSI**. Knowing which interface sits where makes troubleshooting much faster: a Pod stuck `ContainerCreating` is a clue that points at one of the three.'},
{svg:ifaces},
{t:[['Interface','Between','Examples','Typical failure messages','Where to look'],
['**CRI** (Container Runtime Interface)','kubelet and the container runtime','containerd, CRI-O','`container runtime is down`, image pull errors, `failed to create containerd task`','`crictl info`, runtime and kubelet logs'],
['**CNI** (Container Network Interface)','Runtime (sandbox creation) and the network plugin','Calico, Cilium, Flannel, cloud CNIs','`cni plugin not initialized`, `failed to set up sandbox network`','`/etc/cni/net.d`, `/opt/cni/bin`, CNI DaemonSet Pods'],
['**CSI** (Container Storage Interface)','kubelet and storage drivers','EBS, Azure Disk, Ceph, NFS, local','`AttachVolume.Attach failed`, `MountVolume.SetUp failed`','CSIDriver, CSINode, `VolumeAttachment`, driver Pod logs']]},
{h:'How one Pod start crosses all three'},
{flow:['The kubelet receives a Pod and calls the runtime over CRI to create a sandbox (RunPodSandbox)','The runtime invokes the CNI plugin, which gives the sandbox an IP address and network','The kubelet asks the CSI node plugin to stage and mount the Pod volumes','The runtime pulls the images and creates the containers (CRI)','Probes run; status flows back to the API server']},
{code:`# Which plugins does this node use?
$ kubectl get nodes -o wide                                     # CONTAINER-RUNTIME column: containerd://2.0.x
$ sudo crictl info | grep -E "RuntimeReady|NetworkReady"
$ ls /etc/cni/net.d /opt/cni/bin
$ kubectl get csidrivers ; kubectl get csinodes
$ kubectl describe pod stuck | sed -n '/Events:/,$p'            # the reason names the failing layer`},
{h:'Using the three to diagnose'},
{t:[['Event reason','Layer','First check'],
['`FailedCreatePodSandBox`','CNI or runtime','CNI Pod on that node; `crictl info`; `/etc/cni/net.d`'],
['`ErrImagePull`, `ImagePullBackOff`','Runtime and registry','Image name, credentials, DNS from the node'],
['`FailedAttachVolume`, `FailedMount`','CSI','Driver Pods, `VolumeAttachment`, cloud permissions'],
['`NetworkNotReady`','CNI','CNI installation and CIDR']]},
{h:'Other extension points'},
{t:[['Extension point','What it lets you add'],
['**Device plugins** / **DRA**','GPUs, FPGAs and other hardware'],
['**Admission webhooks** and policies','Rules and mutation on API requests'],
['**Aggregated API servers**','Whole new API groups (metrics.k8s.io)'],
['**Custom controllers and operators**','Domain logic, reconciling custom resources'],
['**Scheduler plugins** and extra schedulers','Custom placement'],
['**kubectl plugins**','New `kubectl` subcommands (executables named `kubectl-foo`)'],
['**Cloud controller manager**','Cloud load balancers, routes and node lifecycle'],
['**Authentication webhooks**','External identity systems']]},
{h:'Practical consequences'},
{ul:['**Replacing a CNI plugin** is disruptive: plan a maintenance window; remove leftover config; expect Pod restarts.','**Storage drivers** need cloud permissions and sometimes node packages (NFS client, iSCSI tools); missing ones appear as mount errors.','The **runtime and kubelet cgroup drivers** must match (Section 4).','You can swap implementations of an interface **without changing your applications**: that is the point of the interfaces.']},
{h:'Common mistakes'},
{ul:['Debugging the application when the Pod never left `ContainerCreating`: the failure is in CNI, CSI or CRI.','Installing two CNI plugins.','Upgrading Kubernetes without checking that the CNI and CSI versions support it.','Forgetting that on managed clusters these plugins are add-ons you may need to upgrade yourself.']},
{note:'Exam hint: when a Pod is stuck in `ContainerCreating`, read the event reason: sandbox errors point at the CNI, image errors at the CRI and registry, volume errors at the CSI.'}],
src:[['Container Runtime Interface',C+'architecture/cri/'],['Network Plugins',EX+'compute-storage-net/network-plugins/'],['Device Plugins',EX+'compute-storage-net/device-plugins/']]};

/* ---------- Additional content ---------- */
/* 6: Writing Helm charts */
L['k8s:11:6']={blocks:[
{p:'Writing your own chart turns a set of manifests into a reusable, configurable package. Start small: template only what really varies between installs.'},
{h:'Scaffold and structure'},
{code:`helm create shop                    # generates a working example chart
tree shop
# shop/Chart.yaml  values.yaml  .helmignore  charts/  templates/{deployment,service,ingress,hpa,serviceaccount}.yaml  _helpers.tpl  NOTES.txt  tests/`},
{code:`# Chart.yaml
apiVersion: v2
name: shop
description: The shop application
type: application
version: 0.3.0            # the CHART version (bump on any chart change)
appVersion: "1.4.2"       # the APPLICATION version, informational
dependencies:
- name: postgresql
  version: 15.x.x
  repository: oci://registry-1.docker.io/bitnamicharts
  condition: postgresql.enabled`},
{h:'Templates, values and helpers'},
{code:`# values.yaml
replicaCount: 2
image: {repository: registry.example.com/shop/web, tag: "", pullPolicy: IfNotPresent}
resources: {requests: {cpu: 100m, memory: 128Mi}}
ingress: {enabled: false, host: shop.example.com}

# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "shop.fullname" . }}
  labels: {{- include "shop.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels: {{- include "shop.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels: {{- include "shop.selectorLabels" . | nindent 8 }}
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
    spec:
      containers:
      - name: web
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
        resources: {{- toYaml .Values.resources | nindent 10 }}

# templates/ingress.yaml
{{- if .Values.ingress.enabled }}
...
{{- end }}`},
{ul:['`{{ .Values.x }}` reads values; `{{ .Release.Name }}`, `{{ .Chart.Name }}` and `{{ .Release.Namespace }}` are built-in objects.','`include` + `nindent` + `toYaml` handle indentation; wrong indentation is the most common template bug.','`default`, `required`, `quote`, `tpl` and conditionals (`if`, `with`, `range`) are the everyday functions.','**Helpers** in `_helpers.tpl` define names and labels once.','The `checksum/config` annotation forces a rollout when a ConfigMap changes.']},
{h:'Validate values with a schema'},
{code:`# values.schema.json
{"$schema":"http://json-schema.org/draft-07/schema#","type":"object",
 "required":["image"],
 "properties":{"replicaCount":{"type":"integer","minimum":1},
               "image":{"type":"object","required":["repository"]}}}`},
{h:'Test and lint'},
{code:`helm lint shop
helm template shop ./shop -f values-prod.yaml | kubectl apply --dry-run=server -f -
helm install shop ./shop --dry-run --debug
helm unittest shop                              # unit tests (plugin)
helm install shop ./shop && helm test shop      # runs Pods under templates/tests with the helm.sh/hook: test annotation
helm package shop && helm dependency update shop`},
{note:'Keep charts boring: few options, sensible defaults, no logic that hides Kubernetes objects. Every extra value is something you must test and support.'}],
src:[['Chart Template Guide','https://helm.sh/docs/chart_template_guide/'],['Chart best practices','https://helm.sh/docs/chart_best_practices/'],['Helm chart tests','https://helm.sh/docs/topics/chart_tests/']]};

/* 7: Helm with OCI and provenance */
L['k8s:11:7']={blocks:[
{p:'Charts can be stored in an **OCI registry** (the same kind that stores container images), which means one place, one set of access controls and one signing story for everything you deploy.'},
{h:'Push and pull'},
{code:`helm package shop                                         # shop-0.3.0.tgz
helm registry login registry.example.com -u ci --password-stdin < token.txt
helm push shop-0.3.0.tgz oci://registry.example.com/charts
helm show chart oci://registry.example.com/charts/shop --version 0.3.0
helm install shop oci://registry.example.com/charts/shop --version 0.3.0 -n shop --create-namespace
helm pull oci://registry.example.com/charts/shop --version 0.3.0 --untar`},
{ul:['No \`helm repo add\` and no index file: charts are referenced by full OCI URL and **version**.','Registries use the same authentication, replication, retention and scanning as images.','Pin the **version** (or a digest) in automation.']},
{h:'Provenance: proving who built a chart'},
{p:'Helm supports **provenance files** (`.prov`) signed with a PGP key. Consumers verify the signature and the chart hash before installing.'},
{code:`helm package --sign --key "release@example.com" --keyring ~/.gnupg/secring.gpg shop
# creates shop-0.3.0.tgz and shop-0.3.0.tgz.prov
helm verify shop-0.3.0.tgz --keyring ~/.gnupg/pubring.gpg
helm install shop shop-0.3.0.tgz --verify --keyring ~/.gnupg/pubring.gpg`},
{h:'Sigstore and Cosign for OCI charts'},
{p:'Because a chart in an OCI registry is just another OCI artifact, you can sign it with **Cosign** and verify it in CI or an admission policy, exactly as for images.'},
{code:`cosign sign registry.example.com/charts/shop@sha256:<digest>
cosign verify --key cosign.pub registry.example.com/charts/shop@sha256:<digest>`},
{h:'Supply chain checklist for charts'},
{ul:['Review third-party charts and their **dependencies** before use; mirror them into your own registry.','Pin versions, scan rendered manifests (`helm template | trivy config -`).','Sign what you publish and verify what you consume.','Use short-lived registry credentials in CI.','Remember that images referenced by the chart need their own scanning and signing.']},
{note:'Version numbers are part of the contract: increment the chart `version` for every change, and use SemVer meaningfully so consumers know what an upgrade may break.'}],
src:[['Registries (OCI)','https://helm.sh/docs/topics/registries/'],['Helm Provenance and Integrity','https://helm.sh/docs/topics/provenance/'],['Sigstore Cosign','https://docs.sigstore.dev/']]};

/* 8: GitOps */
L['k8s:11:8']={blocks:[
{p:'**GitOps** makes Git the **single source of truth** for cluster state. An in-cluster controller continuously compares what Git says with what is running, applies the difference and corrects **drift**.'},
{flow:['A change is proposed as a pull request to the config repository','Review, tests and policy checks run in CI','The merge updates the desired state in Git','The cluster controller pulls the change and applies it','It keeps reconciling: manual changes are reverted or flagged']},
{h:'Principles'},
{ul:['Declarative desired state, stored in Git (versioned, auditable).','Changes are **pulled** by an agent inside the cluster, so CI needs no cluster credentials.','Continuous reconciliation, with drift detection and optional self-heal.','Rollback is `git revert`.']},
{h:'Argo CD'},
{code:`apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: {name: shop, namespace: argocd}
spec:
  project: default
  source:
    repoURL: https://git.example.com/platform/config.git
    targetRevision: main
    path: apps/shop/overlays/prod          # plain YAML, Kustomize or a Helm chart
  destination: {server: https://kubernetes.default.svc, namespace: shop}
  syncPolicy:
    automated: {prune: true, selfHeal: true}
    syncOptions: [CreateNamespace=true]`},
{h:'Flux'},
{code:`apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata: {name: config, namespace: flux-system}
spec: {interval: 1m, url: https://git.example.com/platform/config.git, ref: {branch: main}}
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata: {name: shop, namespace: flux-system}
spec:
  interval: 5m
  path: ./apps/shop/overlays/prod
  prune: true
  sourceRef: {kind: GitRepository, name: config}
  targetNamespace: shop`},
{t:[['','Argo CD','Flux'],
['Style','Application-centric with a rich web UI','Toolkit of controllers, CLI and Git-first (less UI)'],
['Config','`Application` and `ApplicationSet` objects','`GitRepository`, `Kustomization`, `HelmRelease`'],
['Multi-cluster','One Argo CD manages many clusters','Typically one Flux per cluster, or fleet patterns'],
['Helm','Renders charts into manifests','Native `HelmRelease` controller']]},
{h:'Practical advice'},
{ul:['**Separate repositories** (or paths) for application code and environment configuration.','One folder per environment with **overlays** (Kustomize) or per-environment values.','Handle **secrets** with SOPS, Sealed Secrets or External Secrets; never plain Secrets in Git.','Use `prune` carefully: removing a file deletes the resource. Protect critical resources with annotations or sync options.','Order dependencies (CRDs and operators before the objects that use them) with sync waves or dependsOn.','Alert on **out-of-sync** and **failed sync** states.']},
{note:'GitOps does not remove the need to understand Kubernetes: when a sync fails you debug with kubectl, events and logs exactly as before, and then fix Git.'}],
src:[['Argo CD','https://argo-cd.readthedocs.io/'],['Flux','https://fluxcd.io/flux/'],['OpenGitOps principles','https://opengitops.dev/']]};

/* 9: kubebuilder */
L['k8s:11:9']={blocks:[
{p:'**kubebuilder** is a framework (built on controller-runtime) that scaffolds a Go project for a **CRD and its controller**: the standard way to write an operator. You do not need it for the CKA, but seeing how a controller is built makes every operator easier to reason about.'},
{h:'Scaffold'},
{code:`kubebuilder init --domain example.com --repo github.com/example/backup-operator
kubebuilder create api --group ops --version v1 --kind Backup --resource --controller
# generated: api/v1/backup_types.go, internal/controller/backup_controller.go, config/ (CRD, RBAC, manager), Makefile`},
{h:'Define the API'},
{code:`// api/v1/backup_types.go
type BackupSpec struct {
    // +kubebuilder:validation:MinLength=1
    Schedule string \`json:"schedule"\`
    Target   string \`json:"target"\`
    // +kubebuilder:default=7
    Keep     int32  \`json:"keep,omitempty"\`
}
type BackupStatus struct {
    LastRun metav1.Time \`json:"lastRun,omitempty"\`
    Phase   string      \`json:"phase,omitempty"\`
}
// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
type Backup struct { ... }`},
{h:'The reconcile loop'},
{code:`func (r *BackupReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    var backup opsv1.Backup
    if err := r.Get(ctx, req.NamespacedName, &backup); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)       // deleted: nothing to do
    }
    // 1. observe the actual state (does the CronJob exist?)
    // 2. compare with the desired state (backup.Spec)
    // 3. create or update owned objects, set owner references
    // 4. update backup.Status
    return ctrl.Result{RequeueAfter: time.Hour}, nil
}`},
{ul:['A reconciler must be **idempotent**: running it twice with the same input gives the same result.','It reacts to events for the custom resource and for **owned** objects (`Owns(&batchv1.CronJob{})`).','Return errors to retry with backoff; use finalizers when external cleanup is needed on delete.','Status conditions report progress to users.']},
{h:'Build and run'},
{code:`make manifests generate          # regenerate CRD YAML and deepcopy code from the markers
make install                     # install the CRD into the current cluster
make run                         # run the controller locally against the cluster (development)
make docker-build docker-push IMG=registry.example.com/backup-operator:0.1.0
make deploy IMG=registry.example.com/backup-operator:0.1.0
kubectl apply -f config/samples/ops_v1_backup.yaml
kubectl get backups`},
{ul:['RBAC rules are generated from `+kubebuilder:rbac` markers; review them.','Add **webhooks** (defaulting and validation) with `kubebuilder create webhook`.','Test with envtest (a local API server and etcd) before using a real cluster.','Alternatives: Operator SDK (builds on kubebuilder), Kopf (Python), kube-rs (Rust), Metacontroller.']},
{note:'Many problems that look like they need an operator are solved by a Helm chart, a CronJob or GitOps. Write a controller when you must continuously react to changing state.'}],
src:[['The Kubebuilder Book','https://book.kubebuilder.io/'],['Operator pattern',K.C+'extend-kubernetes/operator/'],['Custom Resources',K.C+'extend-kubernetes/api-extension/custom-resources/']]};

/* 10: Webhooks and aggregated APIs */
L['k8s:11:10']={blocks:[
{p:'Two advanced ways to extend the API server itself: **admission webhooks** that inspect or change requests, and **aggregated API servers** that add whole new API groups.'},
{h:'Admission webhooks'},
{p:'When a request reaches the admission stage, the API server calls HTTPS endpoints you register. **Mutating** webhooks may change the object; **validating** webhooks accept or reject it.'},
{code:`apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata: {name: pod-policy}
webhooks:
- name: pods.policy.example.com
  admissionReviewVersions: ["v1"]
  sideEffects: None
  failurePolicy: Fail                    # Fail or Ignore when the webhook is unreachable
  timeoutSeconds: 5
  matchPolicy: Equivalent
  rules:
  - {apiGroups: [""], apiVersions: ["v1"], operations: ["CREATE","UPDATE"], resources: ["pods"]}
  namespaceSelector:
    matchExpressions:
    - {key: kubernetes.io/metadata.name, operator: NotIn, values: [kube-system, policy-system]}
  clientConfig:
    service: {name: policy-webhook, namespace: policy-system, path: /validate}
    caBundle: <base64 CA that signed the webhook server certificate>`},
{p:'The API server sends an `AdmissionReview` request and the webhook answers `allowed: true/false` (plus a JSON patch for mutating webhooks).'},
{h:'Operating webhooks safely'},
{t:[['Risk','Mitigation'],
['Webhook down with `failurePolicy: Fail` blocks all matching requests','Run several replicas, exclude system namespaces and the webhook own namespace, use `Ignore` for non-critical checks'],
['Slow webhook slows every API call','Short `timeoutSeconds`, efficient code, narrow `rules`'],
['Certificate expiry breaks it silently','Automate with cert-manager and watch expiry'],
['Order and loops between mutating webhooks','Keep mutations idempotent; `reinvocationPolicy: IfNeeded`'],
['Side effects','Declare `sideEffects: None` and support dry-run']]},
{h:'Aggregated API servers'},
{p:'An extension server runs in the cluster, serves a new API group (for example `metrics.k8s.io`), and is **registered** with an `APIService`. The main API server proxies matching requests to it (aggregation layer).'},
{code:`apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata: {name: v1beta1.metrics.k8s.io}
spec:
  group: metrics.k8s.io
  version: v1beta1
  service: {name: metrics-server, namespace: kube-system}
  groupPriorityMinimum: 100
  versionPriority: 100
  insecureSkipTLSVerify: false
  caBundle: <CA bundle>`},
{t:[['Choose','When'],
['**CRD**','Most cases: you want new resource types stored in etcd with schema validation'],
['**Aggregated API**','You need custom storage, subresources and behaviour that CRDs cannot offer (metrics, virtual resources)'],
['**Webhook**','Policy or defaults on existing objects'],
['**ValidatingAdmissionPolicy**','Simple field rules without running a service']]},
{ul:['Aggregated servers must handle authentication delegation, authorization and TLS correctly; use the API server libraries (`k8s.io/apiserver`).','An unavailable aggregated API makes `kubectl api-resources` and namespace deletion noisy or slow.','Check status with `kubectl get apiservices` and keep their Services healthy.']},
{note:'Default to the simplest extension that works: ValidatingAdmissionPolicy, then CRD plus controller, then webhooks, and only then an aggregated API server.'}],
src:[['Dynamic Admission Control',K.R+'access-authn-authz/extensible-admission-controllers/'],['Extending the Kubernetes API with the aggregation layer',K.C+'extend-kubernetes/api-extension/apiserver-aggregation/'],['Admission Webhook Good Practices',K.C+'cluster-administration/admission-webhooks-good-practices/']]};
})();
