/* LearnSphere - Kubernetes Administrator, Section 02: Lab Setup & kubectl Essentials.
   Lectures 0-6 are core, 7-10 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T,R=K.R;

const kcfg=K.dg(700,250,[
[10,10,680,230,'~/.kube/config',1],
[30,45,200,150,'clusters|name + API server URL|+ CA certificate',0],
[250,45,200,150,'users|name + client cert,|token or exec plugin',0],
[470,45,200,150,'contexts|cluster + user|+ default namespace',2],
[250,205,200,30,'current-context',2]],
[[230,120,250,120],[450,120,470,120]]);

/* ---------- 0: Lab options ---------- */
L['k8s:1:0']={blocks:[
{p:'You learn Kubernetes by breaking and fixing clusters, so choose a lab you can create and destroy cheaply. Different labs support different exercises, and the choice matters mostly for Sections 3, 4 and 11 where you operate a real control plane.'},
{t:[['Lab','Good for','Limits','Cost'],
['**kind** (Kubernetes in Docker)','Fast multi-node clusters on a laptop; workloads, RBAC, networking basics','Nodes are containers; no real kubeadm install, limited node-level breakage','Free'],
['**minikube**','Single-node learning, add-ons, simple multi-node','Single node hides scheduling and drain behaviour','Free'],
['**kubeadm on VMs**','Real install, upgrades, etcd backup, certificates, node faults','Needs 2 to 4 VMs and some RAM','Free locally, or small cloud cost'],
['**Cloud managed (EKS/AKS/GKE)**','Managed behaviour, load balancers, cloud storage and IAM','Control plane is hidden; charges accrue while it exists','Billed per hour'],
['**Cloud VMs with kubeadm**','Same as VMs but always available','You pay while VMs run','Billed per hour']]},
{h:'Recommended path through this course'},
{ul:['Sections 1 to 2, 5 to 8: **kind** is enough.','Sections 3, 4, 9 (certificates), 11 and 13: a **kubeadm cluster of 3 VMs** (1 control plane, 2 workers) so you can SSH in, stop the kubelet and restore etcd.','Managed-service lectures: a cloud account, used briefly and deleted.']},
{h:'Quick start with kind'},
{code:`# kind needs a container runtime (Docker or Podman) installed
kind create cluster --name lab --config kind-3node.yaml
kubectl cluster-info --context kind-lab
kubectl get nodes

# kind-3node.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
- role: worker
- role: worker

# Tear down
kind delete cluster --name lab`},
{h:'Sizing a kubeadm lab'},
{t:[['Node','vCPU','RAM','Disk'],['Control plane','2 (minimum)','2 GB minimum, 4 GB comfortable','20 GB'],['Worker','2','2 GB or more','20 GB']]},
{h:'Clean teardown and cost safety'},
{ul:['Write down every cloud resource you create. Load balancers, disks and public IPs keep billing after a cluster is deleted.','Set a **budget alert** in your cloud account before creating anything.','Delete cloud labs the same day. Use a dedicated lab account or project so cleanup is one deletion.','Snapshot a local VM after a clean install so you can reset faster than rebuilding.']},
{note:'Whatever lab you choose, verify it passes the same smoke test: a cluster with Ready nodes, working DNS and a Deployment you can reach. The next lectures use that test repeatedly.'}],
src:[['Getting started',K.S],['Install tools',K.T+'tools/'],['kind','https://kind.sigs.k8s.io/']]};

/* ---------- 1: kubeconfig ---------- */
L['k8s:1:1']={blocks:[
{p:'`kubectl` finds out which cluster to talk to, and as whom, from a **kubeconfig** file. By default that is `~/.kube/config`. Mistakes here are how people delete the wrong namespace in the wrong cluster, so learn it properly.'},
{svg:kcfg},
{h:'Three lists and a pointer'},
{ul:['**clusters**: a name, the API server URL and the CA certificate used to trust it.','**users**: a name and credentials (client certificate and key, a token, or an exec plugin that fetches a short-lived token, as cloud providers use).','**contexts**: a named combination of cluster + user + optional default namespace.','**current-context**: which context kubectl uses right now.']},
{code:`apiVersion: v1
kind: Config
clusters:
- name: lab
  cluster:
    server: https://192.168.56.10:6443
    certificate-authority-data: LS0tLS1CRUdJTi...
users:
- name: lab-admin
  user:
    client-certificate-data: LS0tLS1CRUdJTi...
    client-key-data: LS0tLS1CRUdJTi...
contexts:
- name: lab
  context:
    cluster: lab
    user: lab-admin
    namespace: default
current-context: lab`},
{h:'Everyday commands'},
{code:`kubectl config get-contexts                   # list, * marks the current one
kubectl config current-context
kubectl config use-context prod-eu            # switch cluster
kubectl config set-context --current --namespace=payments   # set default namespace
kubectl config view --minify                  # show only the current context
kubectl --context staging get pods            # one-off, does not switch
kubectl -n kube-system get pods               # one-off namespace`},
{h:'Where kubectl looks'},
{ul:['`--kubeconfig <file>` flag, if given.','Otherwise the `KUBECONFIG` environment variable, which can hold several files separated by `:` (`;` on Windows) that are merged.','Otherwise `~/.kube/config`.']},
{code:`export KUBECONFIG=~/.kube/config:~/.kube/staging.yaml
kubectl config view --flatten > merged.yaml`},
{h:'Safe habits'},
{ul:['Show the context in your shell prompt (for example with a prompt plugin) so you always see it.','Use separate kubeconfig files for production and keep them out of shared folders; they contain credentials.','Prefer short-lived credentials (exec plugins, OIDC) to long-lived admin certificates.','On kubeadm, `/etc/kubernetes/admin.conf` is a **cluster-admin** credential. Copy it to your own `~/.kube/config`, do not distribute it.']},
{note:'In the exam you are given a command at the top of each task that switches to the right context. Run it every time. Doing the right work on the wrong cluster scores zero.'}],
src:[['Organizing cluster access using kubeconfig files',C+'configuration/organize-cluster-access-kubeconfig/'],['kubectl config',R+'kubectl/generated/kubectl_config/']]};

/* ---------- 2: kubectl basics ---------- */
L['k8s:1:2']={blocks:[
{p:'`kubectl` is a thin client that turns commands into REST calls to the API server. Learn these verbs and you can do most daily work.'},
{t:[['Command','Does','Reads or changes?'],
['`kubectl get <kind>`','List objects in a table','Reads'],
['`kubectl describe <kind> <name>`','Detail plus recent Events','Reads'],
['`kubectl apply -f file.yaml`','Create or update from a file','Changes'],
['`kubectl create ...`','Create (fails if it exists)','Changes'],
['`kubectl delete <kind> <name>`','Delete an object','Changes'],
['`kubectl logs <pod>`','Container stdout and stderr','Reads'],
['`kubectl exec -it <pod> -- sh`','Run a command inside a container','Runs in container'],
['`kubectl edit <kind> <name>`','Open the live object in an editor','Changes'],
['`kubectl port-forward <pod> 8080:80`','Tunnel a local port to a Pod','Network only']]},
{h:'A worked example'},
{code:`# Run a Pod
kubectl run web --image=nginx:1.27 --port=80

# Is it up? Add -o wide for node and IP
kubectl get pods -o wide

# Why not? Events are at the bottom of describe
kubectl describe pod web

# Look at it
kubectl logs web
kubectl logs web -f --tail=20            # follow
kubectl exec -it web -- sh               # shell inside
kubectl port-forward pod/web 8080:80 &
curl -s localhost:8080 | head -n 4

# Clean up
kubectl delete pod web`},
{h:'Useful flags'},
{ul:['`-n <ns>` or `-A` (all namespaces).','`-l key=value` to filter by label; `--field-selector status.phase=Running`.','`-o yaml`, `-o json`, `-o wide`, `-o name`.','`--watch` (`-w`) to stream changes.','`-c <container>` for multi-container Pods; `--previous` for logs of the last crashed container.']},
{h:'Debugging with describe and Events'},
{p:'`describe` ends with an **Events** section: scheduling failures, image pull errors, failed probes and OOM kills all appear there. It is the first place to look when a Pod is not Running. You can also list events cluster-wide:'},
{code:`kubectl get events -A --sort-by=.lastTimestamp | tail -n 20`},
{note:'`kubectl exec` and `port-forward` need access to the kubelet through the API server. If they hang on a managed cluster, check network policy and API server connectivity before blaming the Pod.'}],
src:[['kubectl Quick Reference',R+'kubectl/quick-reference/'],['kubectl reference',R+'kubectl/'],['Debug Pods',T+'debug/debug-application/debug-pods/']]};

/* ---------- 3: Imperative vs declarative ---------- */
L['k8s:1:3']={blocks:[
{p:'There are two ways to manage objects with kubectl. Knowing when to use each is the difference between a clean production workflow and a fast exam.'},
{t:[['Approach','Commands','Strength','Weakness'],
['**Imperative commands**','`kubectl run`, `create deployment`, `expose`, `scale`','Fastest to type; great for experiments and the exam','Not reproducible; the intent lives only in your shell history'],
['**Imperative object config**','`kubectl create -f`, `replace -f`','Files in Git','Create fails if object exists; `replace` can wipe fields'],
['**Declarative object config**','`kubectl apply -f` (a file or a directory)','Reproducible, reviewable, works with GitOps','Slightly more to write']]},
{h:'Generate YAML instead of writing it'},
{p:'The best of both worlds: let an imperative command write the YAML, then edit and apply it.'},
{code:`# A Pod manifest without creating anything
kubectl run web --image=nginx:1.27 --dry-run=client -o yaml > pod.yaml

# A Deployment manifest
kubectl create deployment web --image=nginx:1.27 --replicas=3 \\
  --dry-run=client -o yaml > deploy.yaml

# A Service for an existing Deployment
kubectl expose deployment web --port=80 --target-port=80 \\
  --dry-run=client -o yaml > svc.yaml

# Edit, then apply
vim deploy.yaml
kubectl apply -f deploy.yaml`},
{h:'dry-run modes'},
{ul:['`--dry-run=client`: build the object locally and print it. Nothing is sent. Does not catch server-side validation failures.','`--dry-run=server`: send the request, run validation and admission, but do not persist. Use before applying something risky.','`kubectl diff -f deploy.yaml` shows what `apply` would change against the live object.']},
{h:'How apply works'},
{p:'`kubectl apply` stores the last-applied configuration so it can calculate three-way merges: your new file, the last applied version and the live object. Fields that other tools changed (for example an autoscaler changing `replicas`) are left alone if your file does not set them. A newer mechanism, server-side apply, tracks field owners on the server (see the additional lecture).'},
{code:`kubectl apply -f deploy.yaml          # create or update
kubectl apply -f ./manifests/         # a whole directory
kubectl apply -k ./overlay/prod       # kustomize directory
kubectl delete -f deploy.yaml         # delete what the file defines`},
{h:'Mixing styles'},
{p:'Do not manage the same object with both `kubectl edit`/`scale` and `apply` in production, or your Git files drift from the cluster. Pick declarative for anything that lives longer than an hour.'},
{note:'Exam tip: define `export do="--dry-run=client -o yaml"` and use `kubectl run x --image=nginx $do > x.yaml`. It saves minutes over many tasks.'}],
src:[['Declarative Management',T+'manage-kubernetes-objects/declarative-config/'],['Imperative commands',T+'manage-kubernetes-objects/imperative-command/'],['kubectl diff',R+'kubectl/generated/kubectl_diff/']]};

/* ---------- 4: Labels ---------- */
L['k8s:1:4']={blocks:[
{p:'**Labels** are key/value pairs attached to objects. They are how Kubernetes finds related things: a Service picks its Pods by label, a Deployment owns its Pods by label, and you filter lists with them.'},
{code:`metadata:
  labels:
    app: web
    tier: frontend
    env: prod
    app.kubernetes.io/name: shop       # recommended standard labels
    app.kubernetes.io/version: "1.4.2"`},
{ul:['Keys may have an optional prefix: `example.com/team`. Prefixes `kubernetes.io/` and `k8s.io/` are reserved.','Values are up to 63 characters: letters, digits, `-`, `_`, `.`, starting and ending alphanumeric.','Labels identify; they are meant to be used in selectors.']},
{h:'Selectors'},
{t:[['Type','Syntax','Example'],
['Equality-based','`=`, `==`, `!=`','`kubectl get pods -l app=web,env!=dev`'],
['Set-based','`in`, `notin`, `exists`','`kubectl get pods -l "env in (prod,staging)"`'],
['In manifests','`matchLabels` and `matchExpressions`','See below']]},
{code:`selector:
  matchLabels:
    app: web
  matchExpressions:
  - key: env
    operator: In
    values: [prod, staging]`},
{h:'Working with labels'},
{code:`kubectl get pods --show-labels
kubectl get pods -l app=web
kubectl label pod web-1 tier=frontend           # add
kubectl label pod web-1 tier=backend --overwrite # change
kubectl label pod web-1 tier-                    # remove
kubectl label nodes node-1 disk=ssd              # nodes can be labeled too`},
{h:'Annotations'},
{p:'**Annotations** also hold key/value metadata, but they are for non-identifying information: build IDs, contact details, tool configuration, ingress controller options. They are not used in selectors and can be much larger.'},
{code:`metadata:
  annotations:
    kubernetes.io/change-cause: "update image to 1.4.2"
    contact: "team-payments@example.com"`},
{h:'Common failure'},
{p:'If a Service has no endpoints, the most common cause is a **selector that does not match the Pod labels**. Compare `kubectl get svc web -o wide` (SELECTOR) with `kubectl get pods --show-labels`.'},
{note:'A Deployment selector is effectively immutable after creation. Changing labels on a live Deployment template without matching its selector is a classic cause of orphaned ReplicaSets.'}],
src:[['Labels and Selectors',C+'overview/working-with-objects/labels/'],['Annotations',C+'overview/working-with-objects/annotations/'],['Recommended Labels',C+'overview/working-with-objects/common-labels/']]};

/* ---------- 5: API resources ---------- */
L['k8s:1:5']={blocks:[
{p:'The API server exposes a REST API organized into **groups** and **versions**. Understanding the layout lets you find any resource, write the correct `apiVersion`, and read errors that mention it.'},
{h:'Groups and versions'},
{t:[['Group','apiVersion','Examples'],
['core (legacy, empty name)','`v1`','Pod, Service, ConfigMap, Secret, Node, Namespace, PersistentVolume'],
['`apps`','`apps/v1`','Deployment, ReplicaSet, StatefulSet, DaemonSet'],
['`batch`','`batch/v1`','Job, CronJob'],
['`networking.k8s.io`','`networking.k8s.io/v1`','Ingress, NetworkPolicy, IngressClass'],
['`rbac.authorization.k8s.io`','`rbac.authorization.k8s.io/v1`','Role, ClusterRole, RoleBinding'],
['`storage.k8s.io`','`storage.k8s.io/v1`','StorageClass, CSIDriver'],
['custom groups','`example.com/v1`','Your own CustomResourceDefinitions']]},
{h:'Namespaced vs cluster-scoped'},
{ul:['**Namespaced**: Pod, Deployment, Service, ConfigMap, Secret, Role, PersistentVolumeClaim.','**Cluster-scoped**: Node, Namespace, PersistentVolume, StorageClass, ClusterRole, CustomResourceDefinition.']},
{h:'Discover resources'},
{code:`kubectl api-resources                          # name, short name, group, scope, kind
kubectl api-resources --namespaced=false       # cluster-scoped only
kubectl api-resources --api-group=apps
kubectl api-versions                           # groups/versions the server offers

# Short names save typing
kubectl get po,svc,deploy,ds,sts,cm,pvc,ns,no`},
{h:'kubectl explain: documentation in the terminal'},
{code:`kubectl explain pod
kubectl explain pod.spec.containers
kubectl explain pod.spec.containers.livenessProbe --recursive
kubectl explain deployment.spec.strategy`},
{p:'`explain` reads the live OpenAPI schema of your cluster, so it always matches the version you are running. Use it to find exact field names and types, especially in the exam where you cannot guess.'},
{h:'Raw API access'},
{code:`kubectl get --raw /api/v1/namespaces/default/pods | head -c 300
kubectl proxy --port=8001 &
curl localhost:8001/apis/apps/v1/namespaces/default/deployments`},
{note:'`kubectl get <kind>` with no group can be ambiguous when two groups define the same kind name. Use the full form, for example `kubectl get deployments.apps`, to be explicit.'}],
src:[['Kubernetes API',C+'overview/kubernetes-api/'],['API Overview',R+'using-api/'],['kubectl explain',R+'kubectl/generated/kubectl_explain/']]};

/* ---------- 6: Productivity ---------- */
L['k8s:1:6']={blocks:[
{p:'Speed matters in operations and on the exam. These habits pay for themselves quickly.'},
{h:'Output formats'},
{code:`kubectl get pods -o wide                 # node, IP
kubectl get pod web -o yaml              # full object
kubectl get pods -o name                 # pod/web only
kubectl get pods -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,IP:.status.podIP
kubectl get pods --sort-by=.metadata.creationTimestamp
kubectl get pods -A --field-selector status.phase!=Running`},
{h:'jsonpath'},
{p:'JSONPath extracts specific fields. Braces enclose the expression, `.items[*]` iterates a list.'},
{code:`# Node InternalIPs
kubectl get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="InternalIP")].address}'

# Image of each container in a Pod
kubectl get pod web -o jsonpath='{.spec.containers[*].image}'

# One line per node: name and kubelet version
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.status.nodeInfo.kubeletVersion}{"\\n"}{end}'

# Decode a Secret value
kubectl get secret db -o jsonpath='{.data.password}' | base64 -d`},
{h:'Aliases and completion'},
{code:`# ~/.bashrc
source <(kubectl completion bash)
alias k=kubectl
complete -o default -F __start_kubectl k
export do="--dry-run=client -o yaml"
export now="--force --grace-period=0"

# zsh
source <(kubectl completion zsh)`},
{ul:['Completion works for resource kinds, names and flags. Press Tab often.','`k run x --image=busybox $do` becomes a one-liner for generating manifests.','`$now` deletes stubborn Pods immediately. Use only in the lab or exam; force deletion can leave data in use.']},
{h:'Other time savers'},
{ul:['`kubectl get all` shows common workload kinds (not literally everything) in the namespace.','`kubectl api-resources` and `explain` instead of searching the docs.','`kubectl run tmp --rm -it --image=busybox -- sh` for a throwaway debug Pod.','`kubectl events --for pod/web` shows events for one object in recent versions.','`kubectl create ... --dry-run=client -o yaml | kubectl apply -f -` to pipe straight through.','Learn vim basics: `:set paste` before pasting YAML, `:set shiftwidth=2 expandtab`, and `.` to repeat.']},
{note:'Do not rely on `kubectl get all` to prove something is gone. It omits ConfigMaps, Secrets, PVCs, Ingresses, RBAC objects and custom resources.'}],
src:[['kubectl Quick Reference',R+'kubectl/quick-reference/'],['JSONPath Support',R+'kubectl/jsonpath/'],['kubectl Cheat Sheet',R+'kubectl/cheatsheet/']]};
/* ---------- Additional content ---------- */
/* 7: kubectl plugins and krew */
L['k8s:1:7']={blocks:[
{p:'`kubectl` is extensible. Any executable on your `PATH` named `kubectl-<name>` becomes the command `kubectl <name>`. **krew** is a plugin manager that finds, installs and updates such plugins.'},
{h:'How plugin discovery works'},
{code:`# A trivial plugin
cat > kubectl-hello <<'EOF'
#!/bin/sh
echo "hello from $(kubectl config current-context)"
EOF
chmod +x kubectl-hello && sudo mv kubectl-hello /usr/local/bin/
kubectl hello
kubectl plugin list          # lists every discovered plugin (and warns about shadowing)`},
{ul:['Dashes in the file name become spaces in the command: `kubectl-foo-bar` runs as `kubectl foo bar`.','Underscores in the file name become dashes in the command.','Plugins run with **your** credentials, so install only code you trust.']},
{h:'Installing krew'},
{p:'Follow the install instructions on the krew site for your OS, then add `$HOME/.krew/bin` to your `PATH`.'},
{code:`kubectl krew version
kubectl krew update
kubectl krew search
kubectl krew install ctx ns tree neat access-matrix
kubectl krew list
kubectl krew upgrade
kubectl krew uninstall tree`},
{h:'Plugins admins commonly use'},
{t:[['Plugin','Purpose'],
['`ctx`, `ns`','Switch context and namespace quickly'],
['`tree`','Show owner relationships (Deployment to ReplicaSet to Pod)'],
['`neat`','Clean up `-o yaml` output by removing managed noise'],
['`access-matrix`','Show who can do what on which resources (RBAC overview)'],
['`who-can`','Find subjects allowed to perform an action'],
['`stern`-style log tailing, `df-pv`, `resource-capacity`','Multi-Pod logs, volume usage, node capacity summaries']]},
{code:`kubectl tree deployment web
kubectl neat get pod web -o yaml
kubectl access-matrix -n shop
kubectl resource-capacity --util`},
{note:'Plugins are not available on the exam machine unless installed there. Use them to learn faster, but make sure you can do the same with plain kubectl, `jq` and `-o jsonpath`.'}],
src:[['Extend kubectl with plugins',K.T+'extend-kubectl/kubectl-plugins/'],['krew','https://krew.sigs.k8s.io/'],['kubectl plugin list',K.R+'kubectl/generated/kubectl_plugin/']]};

/* 8: Server-side apply */
L['k8s:1:8']={blocks:[
{p:'**Server-side apply (SSA)** moves the merge logic from kubectl to the API server and tracks **which manager owns each field**. It is designed for objects edited by several tools at once, such as a GitOps controller and an autoscaler.'},
{h:'Client-side vs server-side apply'},
{t:[['','Client-side apply (default)','Server-side apply'],
['Where merging happens','kubectl, using the `last-applied-configuration` annotation','API server'],
['Tracks ownership','No, one annotation per object','Yes, per field, in `metadata.managedFields`'],
['Conflicts','Silently overwritten by the last writer','Detected; the apply fails unless you force it'],
['Works with CRDs and strict schemas','Limited merge semantics','Uses schema-aware merge keys']]},
{code:`kubectl apply --server-side -f deploy.yaml
kubectl apply --server-side --field-manager=platform-team -f deploy.yaml
kubectl apply --server-side --force-conflicts -f deploy.yaml    # take over fields owned by others

kubectl get deployment web -o yaml --show-managed-fields | sed -n '/managedFields/,/^spec/p'`},
{h:'Field ownership in action'},
{p:'Suppose you apply a Deployment with `replicas: 3` as manager `platform`, and an HPA (a different manager) later scales it to 6. If you apply your file again, which still says `replicas: 3`, the server reports a **conflict** on `spec.replicas` instead of silently resetting it. You then decide:'},
{ul:['**Remove the field** from your file, so you stop owning it and the HPA keeps control (the recommended fix).','**Force** the apply and take ownership, accepting that the HPA must re-scale.','Keep the file as is and let the apply fail, if you want a signal.']},
{code:`# conflict output looks like
Apply failed with 1 conflict: conflict with "kube-controller-manager" using apps/v1: .spec.replicas
# Options: remove the field from the manifest, or use --force-conflicts`},
{h:'Where you meet SSA'},
{ul:['GitOps tools (Argo CD and Flux) can use SSA to avoid fighting other controllers.','Controllers written with client libraries use it for their own fields.','`kubectl apply --server-side` is **safe to try**: dry-run it first with `--dry-run=server`.','Switching an object between client-side and server-side apply is supported, but do it deliberately and test.']},
{note:'`managedFields` makes `-o yaml` long. Use `kubectl get ... -o yaml` without `--show-managed-fields` (the default hides them) for readable output.'}],
src:[['Server-Side Apply',K.R+'using-api/server-side-apply/'],['kubectl apply',K.R+'kubectl/generated/kubectl_apply/']]};

/* 9: API versions and deprecations */
L['k8s:1:9']={blocks:[
{p:'Every API group is versioned, and versions have a **maturity level** and a lifetime. Knowing the rules helps you avoid manifests that stop working after an upgrade.'},
{h:'Maturity levels'},
{t:[['Version form','Stage','Promise'],
['`v1alpha1`','Alpha','May change or vanish without notice; usually off by default'],
['`v1beta1`','Beta','Better tested; the API may still change; beta APIs are not enabled by default for new features since recent releases'],
['`v1`','Stable (GA)','Supported for a long time; removal requires a long deprecation process']]},
{h:'Deprecation policy in practice'},
{ul:['An API version is **deprecated** first (still works, warns), and **removed** in a later release after a minimum period depending on its stage.','Stable (GA) APIs must remain available for at least 12 months or three releases after deprecation.','The API server sends **warnings** when you use a deprecated API: kubectl prints `Warning: ... is deprecated in v1.xx+, unavailable in v1.yy+`.','Removed versions return errors: `no matches for kind "X" in version "...beta1"`.']},
{h:'Find what you use'},
{code:`kubectl api-versions | sort
kubectl api-resources -o wide | head
kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis

# What does the server store for a given object?
kubectl get ingress shop -o jsonpath='{.apiVersion}{"\\n"}'
kubectl explain ingress --api-version=networking.k8s.io/v1

# Convert an old manifest (kubectl-convert plugin)
kubectl convert -f old.yaml --output-version networking.k8s.io/v1`},
{h:'Before an upgrade'},
{flow:['Read the release notes: removals are listed under Urgent upgrade notes','Scan live objects and the manifests in Git for old apiVersions','Update charts, operators and CI templates to stable versions','Check the metric of deprecated APIs still being requested','Upgrade a test cluster first']},
{ul:['**Stored objects** are automatically served in the new version; **manifests in Git** are what break.','Tools such as kubent and pluto scan clusters and repositories for deprecated APIs.','Third-party operators and CRDs have their own versions: check their release notes too.']},
{note:'Warnings are easy to miss in CI. Make deprecation warnings visible, for example by failing a pipeline step when `kubectl apply --dry-run=server` prints one.'}],
src:[['Kubernetes Deprecation Policy',K.R+'using-api/deprecation-policy/'],['Deprecated API Migration Guide',K.R+'using-api/deprecation-guide/'],['API Overview',K.R+'using-api/']]};

/* 10: Docs under time pressure */
L['k8s:1:10']={blocks:[
{p:'On the exam you may use the official Kubernetes documentation (check the CNCF rules for the exact allowed sites). The skill is not reading docs, it is **finding the right page in seconds** and copying only what you need.'},
{h:'Pages worth bookmarking mentally'},
{t:[['Need','Where'],
['kubectl commands and shortcuts','Reference > kubectl > **Quick Reference** (cheat sheet)'],
['Pod, Deployment, Job, DaemonSet YAML','Concepts > Workloads (each page has copy-ready examples)'],
['Probes, volumes, security context, config','Tasks > Configure Pods and Containers'],
['PV, PVC, StorageClass','Concepts > Storage'],
['NetworkPolicy, Ingress, Gateway','Concepts > Services, Load Balancing, and Networking'],
['RBAC','Reference > API Access Control > **Using RBAC Authorization**'],
['etcd backup and restore','Tasks > Administer a Cluster > Operating etcd clusters'],
['kubeadm upgrade, certificates','Tasks > Administer a Cluster > kubeadm'],
['Static Pods, taints, affinity','Tasks > Configure Pods and Containers; Concepts > Scheduling']]},
{h:'Search habits'},
{ul:['Use the site search with **specific words**: `networkpolicy example`, `etcd snapshot restore`, `pod affinity`.','Prefer **Concepts** for explanation and **Tasks** for step-by-step YAML.','Copy a minimal example, then edit with `vim`. Do not copy whole pages.','Open pages in tabs you will reuse (cheat sheet, RBAC, etcd, NetworkPolicy).']},
{h:'Replace the browser with the terminal'},
{code:`kubectl explain pod.spec.containers.securityContext --recursive | less
kubectl create role --help | less
kubectl run --help | grep -A3 Examples
kubectl create deployment --help
kubectl api-resources | grep -i netpol
kubectl create clusterrolebinding --help`},
{ul:['`--help` for imperative commands contains working examples and is faster than any web page.','`kubectl explain` shows field names and types.','`kubectl create <kind> --dry-run=client -o yaml` produces YAML for most kinds without any docs.']},
{h:'Time budget'},
{p:'If a task needs more than about a minute of searching, you probably searched for the wrong thing. Switch to `explain` or `--help`, or skip the task and return.'},
{note:'Practise with a timer: pick a random task (for example, "create a NetworkPolicy allowing port 80 from namespace x"), find a starting YAML in the docs and apply it. Repeat until finding it is automatic.'}],
src:[['kubectl Quick Reference',K.R+'kubectl/quick-reference/'],['Kubernetes documentation',K.D],['CNCF CKA exam resources','https://www.cncf.io/training/certification/cka/']]};
})();
