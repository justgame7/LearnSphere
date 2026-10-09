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
{p:'**Helm** is the package manager for Kubernetes. It bundles the manifests an application needs into a **chart**, lets you configure it with **values**, and tracks each installation as a **release** so you can upgrade and roll back.'},
{svg:helm},
{h:'Key terms'},
{t:[['Term','Meaning'],
['**Chart**','A package: templates, default values, metadata and optional dependencies'],
['**Repository**','A place charts are published (an HTTP index or an OCI registry)'],
['**Release**','One installed instance of a chart, with a name, namespace and revision number'],
['**Values**','Configuration inputs that fill the templates'],
['**Revision**','Each install or upgrade of a release creates a new numbered revision']]},
{h:'Chart structure'},
{code:`mychart/
  Chart.yaml          # name, version (chart), appVersion (the app), dependencies
  values.yaml         # default values
  values.schema.json  # optional: validate values
  templates/          # Go-templated manifests
    deployment.yaml
    service.yaml
    _helpers.tpl      # named template helpers
    NOTES.txt         # message printed after install
  charts/             # packaged dependencies`},
{h:'Working with repositories'},
{code:`helm version
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo nginx                      # search added repositories
helm search hub wordpress                   # search Artifact Hub
helm show chart bitnami/nginx
helm show values bitnami/nginx > values.yaml
helm pull bitnami/nginx --untar             # download and unpack to read it`},
{h:'Releases'},
{code:`helm install web bitnami/nginx -n shop --create-namespace
helm list -A
helm status web -n shop
helm get values web -n shop
helm get manifest web -n shop
helm uninstall web -n shop`},
{ul:['Release state is stored in the cluster, by default as **Secrets** of type `helm.sh/release.v1` in the release namespace. Anyone who can read Secrets there can read the release values.','A release belongs to a namespace; the same release name can exist in different namespaces.','Helm uses your kubeconfig and RBAC permissions: it can only create what you are allowed to create.']},
{h:'Look before you install'},
{code:`helm template web bitnami/nginx -f values.yaml | less     # render locally, no cluster changes
helm install web bitnami/nginx --dry-run --debug             # render against the cluster API`},
{note:'A chart is third-party code that creates cluster objects. Read the rendered manifests, check the chart source and pin the **chart version** (`--version`) so installs are reproducible.'}],
src:[['Helm documentation','https://helm.sh/docs/'],['Using Helm','https://helm.sh/docs/intro/using_helm/'],['Helm quickstart','https://helm.sh/docs/intro/quickstart/']]};

/* ---------- 1: Helm operations ---------- */
L['k8s:11:1']={blocks:[
{p:'Day-two Helm work: change configuration, upgrade, look at history and recover from a bad change.'},
{h:'Values'},
{p:'Values are merged in this order, later sources winning: chart `values.yaml`, then each `-f` file in order, then `--set` flags.'},
{code:`# values-prod.yaml
replicaCount: 3
image:
  tag: "1.27.2"
resources:
  requests: {cpu: 100m, memory: 128Mi}
service:
  type: ClusterIP

helm install web bitnami/nginx -n shop -f values-prod.yaml --set replicaCount=5 --version 18.2.0
helm get values web -n shop                    # values you supplied
helm get values web -n shop --all              # merged, including defaults`},
{ul:['`--set a.b=c` for scalars, `--set list[0]=x` for lists, `--set-string` to force text, `--set-file` for file contents.','Keep environment values in **files under version control**, not long `--set` chains.','Never put secrets in values files committed to Git; use an external secrets mechanism.']},
{h:'Upgrade and rollback'},
{code:`helm upgrade web bitnami/nginx -n shop -f values-prod.yaml --version 18.3.0
helm upgrade --install web bitnami/nginx -n shop -f values-prod.yaml     # idempotent: install if missing
helm upgrade web bitnami/nginx -n shop --reuse-values --set replicaCount=4

helm history web -n shop
# REVISION  STATUS      CHART         DESCRIPTION
# 1         superseded  nginx-18.2.0  Install complete
# 2         deployed    nginx-18.3.0  Upgrade complete

helm rollback web 1 -n shop                    # creates revision 3 with revision 1 content
helm uninstall web -n shop --keep-history`},
{h:'Safer upgrades'},
{ul:['`--atomic` rolls back automatically if the upgrade fails; `--wait --timeout 5m` waits for resources to become ready.','`helm diff upgrade` (plugin) shows what would change before you apply it.','`--reuse-values` can hide new chart defaults; prefer passing a full values file.','Test changes in a lower environment with the same chart version.']},
{h:'Troubleshooting'},
{t:[['Symptom','Cause'],
['`cannot re-use a name that is still in use`','A release with that name exists; use `upgrade --install`'],
['`UPGRADE FAILED: another operation is in progress`','A previous operation left the release in a pending state; inspect with `helm history` and roll back or retry'],
['`rendered manifests contain a resource that already exists`','The object was created outside Helm; adopt it with Helm ownership labels and annotations or delete it'],
['Pods not changed after upgrade','A ConfigMap changed but the Pod template did not; add a checksum annotation in the chart or restart the Deployment']]},
{note:'Helm rollback restores the **Kubernetes manifests** of an earlier revision. It does not undo database migrations, deleted PVCs or data written by the application.'}],
src:[['Helm: upgrade and rollback','https://helm.sh/docs/helm/helm_upgrade/'],['Helm: values','https://helm.sh/docs/chart_best_practices/values/'],['helm rollback','https://helm.sh/docs/helm/helm_rollback/']]};

/* ---------- 2: Kustomize ---------- */
L['k8s:11:2']={blocks:[
{p:'**Kustomize** customises plain YAML **without templates**. It is built into kubectl (`kubectl apply -k`) and works by layering patches over a base.'},
{svg:kust},
{h:'Structure'},
{code:`app/
  base/
    kustomization.yaml
    deployment.yaml
    service.yaml
  overlays/
    dev/
      kustomization.yaml
    prod/
      kustomization.yaml
      replica-patch.yaml`},
{code:`# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- deployment.yaml
- service.yaml
commonLabels:
  app: web

# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: shop-prod
namePrefix: prod-
resources:
- ../../base
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
spec:
  replicas: 5`},
{code:`kubectl kustomize overlays/prod              # render to stdout, review first
kubectl apply -k overlays/prod
kubectl diff -k overlays/prod
kubectl delete -k overlays/prod`},
{h:'What it can do'},
{t:[['Feature','Use'],
['`resources`','Include files, directories or other bases'],
['`namespace`, `namePrefix`, `nameSuffix`','Retarget and rename everything consistently, including references'],
['`commonLabels`, `commonAnnotations`','Add metadata to every object (labels in selectors are immutable, be careful)'],
['`images`','Change image names and tags without editing the base'],
['`patches`','Strategic-merge or JSON patches targeting specific objects'],
['`configMapGenerator`, `secretGenerator`','Create ConfigMaps and Secrets with a content hash suffix, so changes trigger a rollout'],
['`components`','Reusable optional pieces']]},
{h:'Helm or Kustomize?'},
{t:[['','Helm','Kustomize'],['Style','Templates and values','Patches over plain YAML'],['Packaging','Versioned charts, repositories','Directories in Git'],['Release tracking','Yes (history, rollback)','No (use Git and GitOps)'],['Best for','Third-party software','Your own apps and per-environment differences']]},
{p:'They combine well: render a third-party Helm chart with `helm template` and apply Kustomize patches on top, or let a GitOps tool do both.'}],
src:[['Declarative Management using Kustomize',T+'manage-kubernetes-objects/kustomization/'],['Kustomize','https://kubectl.docs.kubernetes.io/references/kustomize/'],['kubectl kustomize',R+'kubectl/generated/kubectl_kustomize/']]};

/* ---------- 3: CRDs ---------- */
L['k8s:11:3']={blocks:[
{p:'A **CustomResourceDefinition (CRD)** teaches the API server a new resource type. After you create it, you can `kubectl get` and apply objects of that kind exactly like built-in ones, and RBAC, namespaces and watches work the same.'},
{svg:crd},
{code:`apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backups.example.com            # <plural>.<group>
spec:
  group: example.com
  scope: Namespaced                     # or Cluster
  names:
    plural: backups
    singular: backup
    kind: Backup
    shortNames: [bk]
  versions:
  - name: v1
    served: true
    storage: true                       # exactly one version is the storage version
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
            x-kubernetes-validations:
            - rule: "self.keep <= 100"
              message: "keep must be at most 100"
          status:
            type: object
            x-kubernetes-preserve-unknown-fields: true
    subresources:
      status: {}
    additionalPrinterColumns:
    - {name: Schedule, type: string, jsonPath: .spec.schedule}`},
{code:`kubectl apply -f backup-crd.yaml
kubectl get crd backups.example.com
kubectl api-resources --api-group=example.com

cat <<EOF | kubectl apply -f -
apiVersion: example.com/v1
kind: Backup
metadata: {name: nightly, namespace: shop}
spec: {schedule: "0 2 * * *", target: db}
EOF
kubectl get backups -n shop
kubectl get bk -A
kubectl explain backup.spec`},
{ul:['**Schema is required** in `apiextensions.k8s.io/v1`: it validates input and drops unknown fields (pruning). CEL rules in `x-kubernetes-validations` add checks without a webhook.','**Versions** let a type evolve (`v1alpha1` to `v1`). A conversion strategy (none or a webhook) converts between served versions.','A custom resource alone does nothing: it is just stored data. A **controller** must watch it and act.','Deleting a CRD **deletes all custom resources of that kind**. Treat it as a destructive operation and back up first.','CRDs are cluster-scoped objects; creating them usually needs cluster-admin.']},
{note:'Debugging tips: `kubectl get crd | grep <name>`, `kubectl describe crd <name>` (look at `Established` and `NamesAccepted` conditions) and `kubectl get <kind> -o yaml` to see the stored object with defaults applied.'}],
src:[['Custom Resources',EX+'api-extension/custom-resources/'],['Extend the Kubernetes API with CustomResourceDefinitions',T+'extend-kubernetes/custom-resources/custom-resource-definitions/'],['Versions of CustomResourceDefinitions',T+'extend-kubernetes/custom-resources/custom-resource-definition-versioning/']]};

/* ---------- 4: Operators ---------- */
L['k8s:11:4']={blocks:[
{p:'An **operator** is a CRD plus a controller that encodes how to run one piece of software: install it, scale it, back it up, upgrade it and heal it. It automates what a human administrator of that application would do.'},
{flow:['You create a custom resource (for example a Postgres cluster with 3 instances)','The operator controller sees it through a watch','It creates the StatefulSets, Services, Secrets and volumes','It keeps reconciling: replaces failed members, promotes a new primary','You change the spec; the operator performs the safe sequence (rolling upgrade, resize)']},
{h:'Example: a database operator'},
{code:`# 1. Install the operator (CRDs + controller Deployment), usually with Helm or a manifest
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm install cnpg cnpg/cloudnative-pg -n cnpg-system --create-namespace

# 2. Check what it added
kubectl get crd | grep cnpg
kubectl -n cnpg-system get deploy,pods

# 3. Declare a database cluster as a custom resource
cat <<EOF | kubectl apply -f -
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata: {name: pg, namespace: shop}
spec:
  instances: 3
  storage: {size: 10Gi}
EOF
kubectl get cluster -n shop
kubectl get pods,pvc -n shop`},
{h:'Operating operators'},
{ul:['**Install order**: CRDs first, then the controller. Helm charts normally include a `crds/` directory that Helm installs but **does not upgrade or delete**, so handle CRD upgrades deliberately.','**RBAC**: operators are powerful. Review the ClusterRole they ask for; many need broad access.','**Namespace scope**: some operators watch one namespace, others the whole cluster. Match it to your tenancy model.','**Upgrades**: read the operator release notes, back up the data, upgrade the operator **before** the managed instances and test on a copy.','**Failure mode**: if the operator is down, running workloads continue, but no healing or changes occur.']},
{h:'Where to find operators'},
{p:'Artifact Hub and OperatorHub.io list community and vendor operators. The **Operator Lifecycle Manager (OLM)** is an optional layer that installs, updates and manages operators with catalogs; many clusters simply use Helm or plain manifests instead.'},
{code:`kubectl get crd
kubectl api-resources | grep -v "k8s.io"
kubectl -n cnpg-system logs -l app.kubernetes.io/name=cloudnative-pg --tail=20
kubectl describe cluster pg -n shop             # events and status written by the operator`},
{note:'Choosing an operator is choosing a dependency for your most important data. Check maintenance activity, how upgrades and backups work, and whether you can restore without the operator.'}],
src:[['Operator pattern',EX+'operator/'],['Custom Resources',EX+'api-extension/custom-resources/'],['Artifact Hub','https://artifacthub.io/']]};

/* ---------- 5: CNI CSI CRI ---------- */
L['k8s:11:5']={blocks:[
{p:'Kubernetes does not ship its own container runtime, network or storage implementation. Instead it defines **interfaces**, and vendors provide interchangeable plugins. Knowing which interface sits where makes troubleshooting much faster.'},
{svg:ifaces},
{t:[['Interface','Between','Examples','Where to look when broken'],
['**CRI** (Container Runtime Interface)','kubelet and the container runtime','containerd, CRI-O','`crictl ps`, `crictl info`, runtime logs, kubelet logs'],
['**CNI** (Container Network Interface)','Runtime and the network plugin','Calico, Cilium, Flannel, cloud CNIs','`/etc/cni/net.d`, `/opt/cni/bin`, CNI DaemonSet Pods'],
['**CSI** (Container Storage Interface)','kubelet and storage drivers','EBS, Azure Disk, Ceph, NFS, local','CSIDriver, CSINode, driver Pods, `VolumeAttachment` objects']]},
{h:'How a Pod start crosses all three'},
{flow:['Kubelet receives a Pod and calls the runtime over CRI (RunPodSandbox)','The runtime invokes the CNI plugin to give the sandbox an IP','The kubelet asks the CSI node plugin to mount volumes','The runtime pulls images and creates the containers','Probes and status flow back to the API server']},
{h:'Other extension points'},
{ul:['**Device plugins**: expose GPUs, FPGAs and other hardware to the scheduler and containers.','**Admission webhooks** and **ValidatingAdmissionPolicy**: change or reject requests (Section 10).','**Aggregated API servers**: add whole API groups served by another process.','**Scheduler plugins and extra schedulers**: customise placement.','**kubectl plugins**: executables named `kubectl-foo` on your PATH become `kubectl foo`.','**Cloud controller manager**: provider-specific node, route and load balancer logic.','**Custom controllers and operators**: the pattern from the previous lecture.']},
{code:`# Which runtime, network and storage plugins does this node use?
kubectl get nodes -o wide                                      # CONTAINER-RUNTIME column
kubectl get csidrivers
ls /etc/cni/net.d /opt/cni/bin                                 # on a node
sudo crictl --runtime-endpoint unix:///run/containerd/containerd.sock info | head`},
{h:'Practical consequences'},
{ul:['Replacing a CNI plugin is a disruptive change: plan a maintenance window and expect Pod restarts.','Storage drivers need permissions and sometimes node-level packages (NFS client, iSCSI tools). Missing ones appear as mount errors.','Always match the runtime and its cgroup driver to the kubelet (Section 4).']},
{note:'Exam hint: when a Pod is stuck in `ContainerCreating`, ask which interface failed. A sandbox or IP error points at CNI, an image or container error at CRI, and a volume attach or mount error at CSI.'}],
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
