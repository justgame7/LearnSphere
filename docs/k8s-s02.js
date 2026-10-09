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
{p:'You learn Kubernetes by **breaking and repairing clusters**, so you need a lab you can create, destroy and recreate cheaply. Different labs support different exercises: a laptop cluster is perfect for workloads and RBAC, but only a real node you can log into lets you practise kubeadm, certificates, etcd backup and kubelet failures. Choosing well saves you both money and frustration.'},
{h:'The options compared'},
{t:[['Lab','What it is','Good for','Limits','Cost'],
['**kind**','Kubernetes nodes as Docker containers on your machine','Fast multi-node clusters; workloads, RBAC, networking basics, Helm','Nodes are containers: no real kubeadm install, limited node-level breakage','Free'],
['**minikube**','A single-node (or small) cluster in a VM or container','Learning, add-ons, quick trials','One node hides scheduling, drain and failure behaviour','Free'],
['**kubeadm on VMs**','A real cluster built by hand on 2 to 4 virtual machines','Install, upgrade, etcd backup and restore, certificates, kubelet faults','Needs RAM and a hypervisor (VirtualBox, VMware, Multipass, KVM)','Free locally'],
['**Cloud VMs with kubeadm**','The same, on rented machines','Always available; realistic networking','Billed while running','Per hour'],
['**Managed cloud (EKS, AKS, GKE)**','A provider-operated control plane','Managed behaviour, cloud load balancers, IAM and storage integration','Control plane hidden; resources keep billing if forgotten','Per hour']]},
{h:'A path through the course'},
{t:[['Sections','Recommended lab','Why'],
['1, 2, 5 to 8, 12','**kind** (3 nodes)','Fast to recreate; plenty for workloads, Services, storage, Helm'],
['3, 4, 9 (certificates), 11, 13','**kubeadm on VMs** (1 control plane + 2 workers)','You must SSH in, stop the kubelet, edit manifests, restore etcd'],
['Managed-service topics','A cloud account, used briefly and deleted','Provider specifics, IAM and cost awareness']]},
{h:'Quick start with kind'},
{code:`# kind needs a container runtime (Docker or Podman)
$ cat kind-3node.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
- role: worker
- role: worker

$ kind create cluster --name lab --config kind-3node.yaml
$ kubectl cluster-info --context kind-lab
$ kubectl get nodes
NAME                 STATUS   ROLES           AGE   VERSION
lab-control-plane    Ready    control-plane   60s   v1.37.1
lab-worker           Ready    <none>          40s   v1.37.1
lab-worker2          Ready    <none>          40s   v1.37.1
$ kind delete cluster --name lab                  # tear down in seconds`},
{note:'kind uses its own default CNI that does **not** enforce NetworkPolicy. For the NetworkPolicy exercises install Calico or Cilium in the kind config, or use kubeadm VMs.'},
{h:'Sizing a kubeadm lab'},
{t:[['Node','vCPU','RAM','Disk','Notes'],
['Control plane','2 (minimum)','2 GB minimum, 4 GB comfortable','20 GB','One is enough for a lab'],
['Worker','2','2 GB or more','20 GB','Two workers let you practise drains and spreading']]},
{ul:['Use a **private network** between the VMs with fixed IPs (host-only or bridged) and hostnames that resolve.','Take a **snapshot** after a clean install so you can reset in a minute instead of rebuilding.','Keep the kubeadm configuration, CNI manifest and preparation script in Git.']},
{h:'The smoke test every lab must pass'},
{code:`kubectl get nodes                                         # all Ready
kubectl -n kube-system get pods                           # all Running (DNS, CNI, proxy, ...)
kubectl create deployment hello --image=nginx:1.27 --replicas=2
kubectl expose deployment hello --port=80
kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- wget -qO- -T 3 http://hello      # DNS and Service work
kubectl delete svc,deployment hello`},
{h:'Cost safety and clean teardown'},
{ul:['Set a **budget alert** in your cloud account before creating anything.','Write down every cloud resource you create: **load balancers, disks and public IPs keep billing** after the cluster is deleted.','Delete Services of type LoadBalancer and PVCs **before** deleting a cloud cluster.','Use a **dedicated lab account or project** so cleanup is one deletion.','Delete cloud labs the **same day**.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Doing everything on kind','Never practise real install, upgrades or etcd','Add a kubeadm VM lab for the infrastructure sections'],
['Sizing VMs too small','Preflight failures, evictions, slow labs','Meet the minimums'],
['Cloning VMs without changing hostname or machine ID','Join failures and odd identities','Fix identity after cloning'],
['Forgetting cloud resources','Surprise bill','Inventory and budget alerts'],
['No reset path','Hours lost fixing a lab you could recreate','Snapshots and a rebuild script']]},
{note:'Whatever lab you pick, make sure you can destroy and rebuild it in under an hour: the ability to start from scratch is itself one of the skills you are practising.'}],
src:[['Getting started',K.S],['Install tools',K.T+'tools/'],['kind','https://kind.sigs.k8s.io/']]};

/* ---------- 1: kubeconfig ---------- */
L['k8s:1:1']={blocks:[
{p:'`kubectl` finds out **which cluster to talk to, and as whom**, from a **kubeconfig** file. Almost every dramatic operational mistake with kubectl, such as deleting something in production while you thought you were in the lab, comes from not knowing which context was active. This lecture makes the file, and the habits around it, completely clear.'},
{svg:kcfg},
{h:'Three lists and a pointer'},
{t:[['Section','Holds','Example'],
['**clusters**','A name, the API server URL and the CA certificate to trust it','`lab` at `https://192.168.56.10:6443`'],
['**users**','A name and credentials: client certificate and key, a token, or an **exec plugin** that fetches a short-lived token','`lab-admin` with a certificate'],
['**contexts**','A named combination of **cluster + user + default namespace**','`lab` = cluster lab, user lab-admin, namespace default'],
['**current-context**','Which context kubectl uses right now','`lab`']]},
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
  context: {cluster: lab, user: lab-admin, namespace: default}
current-context: lab`},
{h:'Everyday commands'},
{code:`$ kubectl config get-contexts
CURRENT   NAME      CLUSTER   AUTHINFO    NAMESPACE
*         lab       lab       lab-admin   default
          prod-eu   prod-eu   prod-oidc   shop
$ kubectl config current-context
$ kubectl config use-context prod-eu                              # switch cluster
$ kubectl config set-context --current --namespace=payments       # default namespace for this context
$ kubectl config view --minify                                    # only the active context
$ kubectl --context staging get pods                              # one command, does not switch
$ kubectl -n kube-system get pods                                 # one command, other namespace
$ kubectl config delete-context old ; kubectl config rename-context lab lab-old`},
{h:'Where kubectl looks for the file'},
{flow:['The --kubeconfig flag, if given','Otherwise the KUBECONFIG environment variable: one or several files separated by : (; on Windows), merged','Otherwise the default file ~/.kube/config']},
{code:`export KUBECONFIG=~/.kube/config:~/.kube/staging.yaml
kubectl config view --flatten > merged.yaml          # write one merged file (includes credentials: protect it)
kubectl --kubeconfig ./other.yaml get nodes`},
{h:'How the credentials get used'},
{ul:['**Client certificate**: sent during the TLS handshake; the API server reads user and group from it (Section 9).','**Token**: sent as an `Authorization: Bearer` header.','**Exec plugin**: kubectl runs a command (for example a cloud CLI or an OIDC helper), gets a short-lived token and uses it. This is how EKS, AKS, GKE and OIDC logins work.']},
{h:'Safe habits'},
{ul:['**Show the context and namespace in your shell prompt** so you always see where you are.','Use **separate kubeconfig files** for production and keep them out of shared folders: they contain credentials.','Prefer **short-lived credentials** (OIDC, exec plugins) to long-lived admin certificates.','On kubeadm, `/etc/kubernetes/admin.conf` is a **cluster-admin** credential. Copy it to your own `~/.kube/config`; do not distribute it.','Before any destructive command run `kubectl config current-context` and `kubectl get nodes` as a reflex.']},
{h:'Troubleshooting'},
{t:[['Symptom','Cause'],
['`The connection to the server localhost:8080 was refused`','No kubeconfig found: `KUBECONFIG` or `~/.kube/config` missing'],
['`Unable to connect to the server: dial tcp ... connection refused or timeout`','API server down, wrong address, firewall, VPN'],
['`x509: certificate signed by unknown authority`','Wrong CA data for that cluster'],
['`Unauthorized`','Expired or wrong credentials'],
['Resources "missing"','Wrong namespace or wrong context']]},
{note:'Exam tip: every task states a context to use, usually with a command to run first (`kubectl config use-context ...`). Run it before every task. Doing correct work on the wrong cluster scores nothing.'}],
src:[['Organizing cluster access using kubeconfig files',C+'configuration/organize-cluster-access-kubeconfig/'],['kubectl config',R+'kubectl/generated/kubectl_config/']]};

/* ---------- 2: kubectl basics ---------- */
L['k8s:1:2']={blocks:[
{p:'`kubectl` is a thin client: every command is turned into a REST call to the API server. A handful of **verbs** cover most of your day, and the skill is knowing which one **reads**, which one **changes**, and what each really shows. This lecture follows one Pod from creation to cleanup with the output you should expect.'},
{h:'The core verbs'},
{t:[['Command','What it does','Reads or changes?'],
['`kubectl get <kind>`','List objects in a table','Reads'],
['`kubectl describe <kind> <name>`','Details **plus recent Events**','Reads'],
['`kubectl apply -f file.yaml`','Create or update to match the file','Changes'],
['`kubectl create ...`','Create (fails if it already exists)','Changes'],
['`kubectl delete <kind> <name>`','Delete an object','Changes'],
['`kubectl logs <pod>`','Container stdout and stderr','Reads'],
['`kubectl exec -it <pod> -- sh`','Run a command inside a container','Runs in the container'],
['`kubectl edit <kind> <name>`','Open the live object in an editor','Changes'],
['`kubectl port-forward <pod> 8080:80`','Tunnel a local port to a Pod','Network only']]},
{h:'One Pod, start to finish'},
{code:`$ kubectl run web --image=nginx:1.27 --port=80
pod/web created

$ kubectl get pods -o wide
NAME   READY   STATUS    RESTARTS   AGE   IP            NODE
web    1/1     Running   0          15s   10.244.1.14   worker1            # IP and node are visible with -o wide

$ kubectl describe pod web | sed -n '/Events:/,$p'
  Type    Reason     Age   From               Message
  Normal  Scheduled  20s   default-scheduler  Successfully assigned default/web to worker1
  Normal  Pulling    19s   kubelet            Pulling image "nginx:1.27"
  Normal  Pulled     12s   kubelet            Successfully pulled image
  Normal  Created    12s   kubelet            Created container web
  Normal  Started    12s   kubelet            Started container web

$ kubectl logs web --tail=2
$ kubectl exec -it web -- sh                              # a shell inside; type exit to leave
$ kubectl port-forward pod/web 8080:80 &
$ curl -s localhost:8080 | head -n 4
$ kubectl delete pod web
pod "web" deleted`},
{p:'The **Events** at the bottom of `describe` tell the story of what the scheduler and kubelet did. When a Pod is not Running, that section is the first place to look: scheduling failures, image pull errors, failed probes and OOM kills all appear there.'},
{h:'Selecting and filtering'},
{t:[['Flag','Meaning'],
['`-n <ns>`, `-A` (or `--all-namespaces`)','One namespace, or all of them'],
['`-l key=value`','Filter by **label**: `kubectl get pods -l app=web`'],
['`--field-selector status.phase=Running`','Filter by a field'],
['`-o wide`, `-o yaml`, `-o json`, `-o name`','More columns, full object, JSON, names only'],
['`-w`','**Watch**: keep streaming changes'],
['`-c <container>`','Pick a container in a multi-container Pod'],
['`--previous`','Logs of the **last crashed** container instance']]},
{h:'Reading versus changing: a safety habit'},
{ul:['Start every investigation with **read-only** verbs: `get`, `describe`, `logs`.','Preview changes: `kubectl apply --dry-run=server -f x.yaml` and `kubectl diff -f x.yaml`.','Before `delete`, run the same selector with `get`: `kubectl get pods -l app=old` then `kubectl delete pods -l app=old`.','`kubectl delete -f` and `-l` can remove many objects at once: check twice.']},
{h:'Cluster-wide events and quick overview'},
{code:`kubectl get events -A --sort-by=.lastTimestamp | tail -n 10
kubectl get all -n shop                                   # common workload kinds only (NOT everything)
kubectl get nodes,ns,pv                                    # several kinds at once
kubectl top pod -A --sort-by=memory | head                # needs Metrics Server`},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Forgetting `-n`','Empty results and a wrong conclusion','Set the default namespace on the context'],
['Reading `logs` of the new container after a crash','Misses the real error','`logs --previous`'],
['`kubectl get all` as proof of "nothing left"','Omits ConfigMaps, Secrets, PVCs, Ingresses, RBAC, CRDs','Use `kubectl api-resources` and per-kind queries'],
['`kubectl exec` without `-c` in multi-container Pods','Wrong container or an error','Name the container'],
['`kubectl edit` on production objects managed by Git','Drift from the source of truth','Change the manifest and apply']]},
{note:'`kubectl exec` and `port-forward` go through the API server to the kubelet. If they hang on a managed cluster, check API server connectivity and network policy before blaming the Pod.'}],
src:[['kubectl Quick Reference',R+'kubectl/quick-reference/'],['kubectl reference',R+'kubectl/'],['Debug Pods',T+'debug/debug-application/debug-pods/']]};

/* ---------- 3: Imperative vs declarative ---------- */
L['k8s:1:3']={blocks:[
{p:'There are two ways to tell Kubernetes what to do. **Imperative** commands say *do this now* (`kubectl run`, `kubectl scale`). **Declarative** management says *this is what I want*, in a file, and Kubernetes works out the difference (`kubectl apply -f`). Knowing when each is right is the difference between a clean production workflow and a fast exam.'},
{h:'Three styles'},
{t:[['Style','Commands','Strength','Weakness'],
['**Imperative commands**','`kubectl run`, `create deployment`, `expose`, `scale`, `set image`','Fastest to type; ideal for experiments and the exam','Not reproducible; the intent lives only in your shell history'],
['**Imperative object configuration**','`kubectl create -f`, `replace -f`, `delete -f`','Files in Git','`create` fails if the object exists; `replace` can drop fields set by others'],
['**Declarative object configuration**','`kubectl apply -f` (file, directory or `-k`)','Reproducible, reviewable, works with GitOps','Slightly more to write']]},
{h:'The best of both: generate YAML, then manage it declaratively'},
{p:'Let an imperative command **write the manifest** for you (without creating anything), edit what you need, then apply the file. This is also the fastest way to produce correct YAML in the exam.'},
{code:`# A Pod manifest without creating anything
$ kubectl run web --image=nginx:1.27 --dry-run=client -o yaml > pod.yaml
# A Deployment with 3 replicas
$ kubectl create deployment web --image=nginx:1.27 --replicas=3 --dry-run=client -o yaml > deploy.yaml
# A Service for an existing Deployment
$ kubectl expose deployment web --port=80 --target-port=8080 --dry-run=client -o yaml > svc.yaml
# Others: create job, cronjob, configmap, secret generic, role, rolebinding, quota, ingress, serviceaccount ...

$ vim deploy.yaml                            # edit what you need: probes, resources, env
$ kubectl apply -f deploy.yaml
deployment.apps/web created
$ kubectl apply -f deploy.yaml               # run again: safe, nothing changes
deployment.apps/web unchanged`},
{h:'The dry-run modes'},
{t:[['Mode','What happens','Catches'],
['`--dry-run=client`','The object is built **locally** and printed; nothing is sent for validation','Only syntax and structure kubectl knows'],
['`--dry-run=server`','The request goes through the **API server** (validation, admission, defaults) but is **not stored**','Schema errors, admission and policy rejections, quota'],
['`kubectl diff -f file`','Compares your file with the **live** object and prints the difference','Exactly what `apply` would change']]},
{h:'What apply does'},
{p:'`kubectl apply` records the last applied configuration (in an annotation, or with server-side apply in `managedFields`) and performs a **three-way merge** of your new file, the previously applied file and the live object. Fields that other actors changed (for example an autoscaler changing `replicas`) are preserved if your file does not mention them, and fields you removed from the file are removed from the cluster.'},
{code:`kubectl apply -f deploy.yaml                 # create or update
kubectl apply -f ./manifests/                # a whole directory
kubectl apply -k ./overlays/prod             # a Kustomize directory
kubectl diff -f deploy.yaml                  # preview
kubectl delete -f deploy.yaml                # delete what the file defines
kubectl apply -f deploy.yaml --prune -l app=web      # also delete labelled objects no longer in the files (use with care)`},
{h:'Mixing styles safely'},
{ul:['Do not manage the **same object** with both `kubectl edit`/`scale`/`set image` and `kubectl apply` in production: the file in Git and the cluster will diverge, and the next apply may undo emergency changes.','If you must change something live, **back-port it to the manifest** straight away.','In production prefer **declarative with review** (pull requests, GitOps). Keep imperative commands for learning, debugging and the exam.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['`kubectl create -f` again on an existing object','`AlreadyExists` error','Use `apply`'],
['`kubectl replace` without all fields','Removes fields set elsewhere','Use `apply`, or `patch` a single field'],
['Trusting `--dry-run=client` to catch policy errors','The real apply fails','`--dry-run=server`'],
['Editing YAML from scratch in the exam','Slow, typo-prone','Generate with `--dry-run=client -o yaml`'],
['Forgetting to remove the generated `status` or `creationTimestamp` lines when copying live YAML','Noise or errors','Generate from commands, not from `get -o yaml`']]},
{note:'Exam tip: define `export do="--dry-run=client -o yaml"` and use `kubectl run x --image=nginx $do > x.yaml`. It saves minutes across many tasks.'}],
src:[['Declarative Management',T+'manage-kubernetes-objects/declarative-config/'],['Imperative commands',T+'manage-kubernetes-objects/imperative-command/'],['kubectl diff',R+'kubectl/generated/kubectl_diff/']]};

/* ---------- 4: Labels ---------- */
L['k8s:1:4']={blocks:[
{p:'Kubernetes has no hard-wired relationships between objects. A Service does not "contain" its Pods; a Deployment does not "contain" its ReplicaSets by pointer. Relationships are expressed by **labels** and **selectors**: objects carry labels, other objects select them. This is the glue of Kubernetes, and a single typo in a label is one of the most common reasons "it does not work".'},
{h:'Labels'},
{p:'A **label** is a key and value pair attached to an object (and to Pods, nodes, Namespaces and more). Labels **identify**; they are meant to be used for selection.'},
{code:`metadata:
  name: web-7d9f
  labels:
    app: web                                  # which application
    tier: frontend
    env: prod
    app.kubernetes.io/name: shop              # recommended standard labels
    app.kubernetes.io/version: "1.4.2"
    app.kubernetes.io/part-of: store`},
{ul:['Keys may have an optional **prefix** (`example.com/team`); `kubernetes.io/` and `k8s.io/` are reserved.','Values are up to 63 characters: letters, digits, `-`, `_`, `.`, starting and ending alphanumeric.','Changing a label can change which controllers and Services act on the object.']},
{h:'Selectors: how objects find each other'},
{t:[['Selector kind','Syntax','Example'],
['**Equality-based**','`=`, `==`, `!=`','`kubectl get pods -l app=web,env!=dev`'],
['**Set-based**','`in`, `notin`, `exists`','`kubectl get pods -l "env in (prod,staging)"`, `-l tier`'],
['**In manifests**','`matchLabels` (equality) and `matchExpressions` (set-based)','See below']]},
{code:`selector:
  matchLabels: {app: web}                     # all listed pairs must match (AND)
  matchExpressions:
  - {key: env, operator: In, values: [prod, staging]}
  - {key: tier, operator: Exists}`},
{h:'Who uses selectors'},
{t:[['Object','What its selector selects','If it matches nothing'],
['**Service**','The Pods it sends traffic to','Service with **no endpoints**'],
['**ReplicaSet / Deployment / StatefulSet**','The Pods it owns (must match the template labels)','Controller cannot manage its Pods'],
['**NetworkPolicy**','Pods the policy applies to and peers','Policy has no effect'],
['**Node affinity and `nodeSelector`**','Nodes by label','Pod stays Pending'],
['**PodDisruptionBudget**','Pods it protects','Budget protects nothing'],
['**HPA, Ingress and others**','Targets by reference or name','No scaling or routing']]},
{h:'Working with labels'},
{code:`$ kubectl get pods --show-labels
NAME      READY   STATUS    LABELS
web-abc   1/1     Running   app=web,pod-template-hash=7d9f
$ kubectl get pods -l app=web
$ kubectl get pods -L app,tier                         # show label values as columns
$ kubectl label pod web-abc tier=frontend              # add
$ kubectl label pod web-abc tier=backend --overwrite   # change
$ kubectl label pod web-abc tier-                      # remove (trailing minus)
$ kubectl label nodes worker1 disktype=ssd             # nodes too
$ kubectl delete pods -l app=old                       # selectors work with delete`},
{h:'Annotations: metadata that is not for selection'},
{p:'**Annotations** also hold key and value pairs, but for **non-identifying** information: build IDs, contact details, tool configuration (such as ingress controller options). They are not used in selectors and may hold larger values.'},
{code:`metadata:
  annotations:
    kubernetes.io/change-cause: "update image to 1.4.2"
    contact: "team-payments@example.com"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"`},
{t:[['','Labels','Annotations'],
['Purpose','Identify and group','Attach extra information'],
['Used by selectors','**Yes**','No'],
['Size limits','Small values','Larger values allowed'],
['Typical content','`app`, `tier`, `env`, `version`','Build info, tool settings, change reasons']]},
{h:'The classic failure: a Service with no endpoints'},
{code:`$ kubectl get svc web -o wide
NAME   TYPE        CLUSTER-IP    PORT(S)   SELECTOR
web    ClusterIP   10.96.41.20   80/TCP    app=web
$ kubectl get pods --show-labels
web-abc   1/1   Running   app=webb               # typo: "webb"
$ kubectl get endpointslices -l kubernetes.io/service-name=web
NAME        ENDPOINTS
web-x7k2p   <unset>                              # no endpoints
$ kubectl label pod web-abc app=web --overwrite   # fix the label, or fix the selector`},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Changing labels in a Deployment template without updating the Service','The Service stops matching new Pods','Change both; roll out and verify endpoints'],
['Editing a Deployment `selector` after creation','Immutable; orphaned ReplicaSets','Create a new Deployment'],
['Inconsistent label naming across teams','Policies and queries miss objects','Adopt the recommended `app.kubernetes.io/*` labels'],
['Using annotations where you need to select','Selectors cannot see them','Use labels'],
['Too few labels','Cannot group or select','At least `app`, `tier` or component, `env`']]},
{note:'Habit: when a Service, policy or budget "does nothing", compare its selector with `kubectl get pods --show-labels` first. It solves a large share of cases.'}],
src:[['Labels and Selectors',C+'overview/working-with-objects/labels/'],['Annotations',C+'overview/working-with-objects/annotations/'],['Recommended Labels',C+'overview/working-with-objects/common-labels/']]};

/* ---------- 5: API resources ---------- */
L['k8s:1:5']={blocks:[
{p:'Behind `kubectl` is a REST API organised into **groups**, **versions** and **resources**. Understanding that layout lets you find any resource, write the correct `apiVersion` in a manifest, read error messages that mention a group, and discover options without leaving the terminal, which is exactly what you need under exam pressure.'},
{h:'Groups and versions'},
{t:[['Group','`apiVersion`','Examples'],
['core (legacy, empty name)','`v1`','Pod, Service, ConfigMap, Secret, Node, Namespace, PersistentVolume, PVC'],
['`apps`','`apps/v1`','Deployment, ReplicaSet, StatefulSet, DaemonSet'],
['`batch`','`batch/v1`','Job, CronJob'],
['`networking.k8s.io`','`networking.k8s.io/v1`','Ingress, NetworkPolicy, IngressClass'],
['`rbac.authorization.k8s.io`','`rbac.authorization.k8s.io/v1`','Role, ClusterRole, RoleBinding, ClusterRoleBinding'],
['`storage.k8s.io`','`storage.k8s.io/v1`','StorageClass, CSIDriver, VolumeAttachment'],
['`autoscaling`','`autoscaling/v2`','HorizontalPodAutoscaler'],
['`policy`','`policy/v1`','PodDisruptionBudget'],
['custom groups','`example.com/v1`','Your own CRDs']]},
{p:'The **version** shows maturity: `v1` is stable, `v1beta1` is beta, `v1alpha1` is alpha (Section 1, releases). A manifest names `apiVersion: <group>/<version>` and a `kind`; the core group omits the group part.'},
{h:'Namespaced or cluster-scoped'},
{t:[['Scope','Examples','Consequence'],
['**Namespaced**','Pod, Deployment, Service, ConfigMap, Secret, Role, RoleBinding, PVC, Ingress','Name unique **within** a namespace; `-n` matters'],
['**Cluster-scoped**','Node, Namespace, PersistentVolume, StorageClass, ClusterRole, ClusterRoleBinding, CRD','Visible everywhere; no namespace']]},
{h:'Discovering resources'},
{code:`$ kubectl api-resources | head -n 8
NAME          SHORTNAMES   APIVERSION   NAMESPACED   KIND
configmaps    cm           v1           true         ConfigMap
namespaces    ns           v1           false        Namespace
nodes         no           v1           false        Node
pods          po           v1           true         Pod
services      svc          v1           true         Service
deployments   deploy       apps/v1      true         Deployment
$ kubectl api-resources --namespaced=false                # cluster-scoped kinds
$ kubectl api-resources --api-group=apps
$ kubectl api-resources -o wide | grep -i netpol         # includes allowed verbs
$ kubectl api-versions | sort | head                      # group/versions the server offers
$ kubectl get po,svc,deploy,ds,sts,cm,pvc,ns,no          # short names save typing`},
{h:'kubectl explain: documentation in the terminal'},
{code:`$ kubectl explain pod
$ kubectl explain pod.spec.containers.livenessProbe
KIND:       Pod
VERSION:    v1
FIELD: livenessProbe <Probe>
DESCRIPTION: Periodic probe of container liveness. Container will be restarted if the probe fails.
FIELDS:
  exec <ExecAction>
  failureThreshold <integer>
  httpGet <HTTPGetAction>
  initialDelaySeconds <integer>
$ kubectl explain deployment.spec.strategy --recursive | head -n 20
$ kubectl explain pod.spec --api-version=v1`},
{p:'`explain` reads the **live OpenAPI schema of your cluster**, so it always matches the version you run, including custom resources (`kubectl explain backup.spec` once the CRD exists). Use it to find exact field names and types instead of guessing.'},
{h:'Raw API access'},
{code:`$ kubectl get --raw /apis | jq -r '.groups[].name' | head
$ kubectl get --raw /api/v1/namespaces/default/pods | head -c 300
$ kubectl proxy --port=8001 &
$ curl -s localhost:8001/apis/apps/v1/namespaces/default/deployments | head -c 300
$ kubectl get deployments.apps -A                        # full name: resource.group, useful when two groups share a kind name`},
{h:'Reading errors with this knowledge'},
{t:[['Message','Meaning'],
['`error: the server doesn\'t have a resource type "foo"`','Wrong kind name, or a CRD not installed'],
['`no matches for kind "Ingress" in version "extensions/v1beta1"`','The apiVersion was **removed**; use `networking.k8s.io/v1`'],
['`cannot list resource "deployments" in API group "apps"`','RBAC needs group `apps`, not the core group'],
['`unknown field "foo"` when applying','Misspelled or misplaced field: check with `kubectl explain`']]},
{note:'Exam tip: when you cannot remember a field, `kubectl explain <path>` is faster than any web page. When you cannot remember a kind or its short name, `kubectl api-resources` has it.'}],
src:[['Kubernetes API',C+'overview/kubernetes-api/'],['API Overview',R+'using-api/'],['kubectl explain',R+'kubectl/generated/kubectl_explain/']]};

/* ---------- 6: Productivity ---------- */
L['k8s:1:6']={blocks:[
{p:'In operations and on the exam, speed comes from a few habits: choosing the right **output format**, extracting exactly the field you need, and removing repetitive typing. None of it is hard, and it can halve the time you spend on routine tasks. This lecture collects the techniques you will use every day.'},
{h:'Output formats'},
{t:[['Flag','Output','Use for'],
['`-o wide`','Extra columns (node, IP)','Where is it running?'],
['`-o yaml` / `-o json`','The full object','Understand the real state; feed to `jq`'],
['`-o name`','`pod/web` per line','Piping to other commands'],
['`-o custom-columns=...`','Your own table','Compact reports'],
['`-o jsonpath=...`','Selected values','Scripts and exact fields'],
['`--sort-by=<jsonpath>`','Sorted listing','Newest, largest']]},
{code:`$ kubectl get pods -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,IP:.status.podIP
NAME      NODE      IP
web-abc   worker1   10.244.1.14
$ kubectl get pods --sort-by=.metadata.creationTimestamp
$ kubectl get pods -A --field-selector status.phase!=Running
$ kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.status.nodeInfo.kubeletVersion}{"\\n"}{end}'
cp1     v1.37.1
worker1 v1.37.1`},
{h:'jsonpath in five minutes'},
{ul:['Wrap the expression in braces: `{.metadata.name}`. `.items[*]` iterates a list. `[?(@.type=="InternalIP")]` filters.','`{range .items[*]}...{end}` loops; `{"\\t"}` and `{"\\n"}` print tab and newline.','Always quote the whole expression with single quotes in the shell.']},
{code:`# image of every container in a Pod
kubectl get pod web -o jsonpath='{.spec.containers[*].image}{"\\n"}'
# node internal IPs
kubectl get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="InternalIP")].address}{"\\n"}'
# decode a Secret value
kubectl get secret db-cred -o jsonpath='{.data.password}' | base64 -d
# restart counts
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.status.containerStatuses[0].restartCount}{"\\n"}{end}'
# the same with jq when you prefer it
kubectl get pods -o json | jq -r '.items[] | [.metadata.name, .status.phase] | @tsv'`},
{h:'Shell setup for speed'},
{code:`# ~/.bashrc
source <(kubectl completion bash)                    # Tab completion for kinds, names and flags
alias k=kubectl
complete -o default -F __start_kubectl k             # completion also for the alias
export do="--dry-run=client -o yaml"
export now="--force --grace-period=0"
# zsh: source <(kubectl completion zsh)

$ k run x --image=nginx $do > x.yaml                 # a manifest in one line
$ k delete pod web $now                              # immediate deletion (lab and exam only)`},
{ul:['**Tab completion** works for resource types, object names and flags: press Tab often.','`$now` skips the grace period and can leave data in use. Use it only in the lab or exam.','Set your editor options (`vim`: `set expandtab shiftwidth=2`, `:set paste` before pasting YAML).']},
{h:'More time savers'},
{t:[['Task','Command'],
['A throwaway debug Pod','`kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- sh`'],
['Events for one object','`kubectl events --for pod/web`, `kubectl describe`'],
['Watch for changes','`kubectl get pods -w`'],
['Create and pipe YAML straight in','`kubectl create deploy x --image=nginx $do | kubectl apply -f -`'],
['Change one field without an editor','`kubectl patch deploy web -p \'{"spec":{"replicas":3}}\'`'],
['Set the image','`kubectl set image deployment/web nginx=nginx:1.27`'],
['Which pages exist for a flag','`kubectl <command> --help` (examples included)'],
['Leave a namespace default','`kubectl config set-context --current --namespace=shop`']]},
{h:'Common mistakes'},
{ul:['Reading long YAML by eye instead of extracting the field with jsonpath.','Forgetting quotes around jsonpath so the shell eats the braces.','Using `kubectl get all` to prove something is gone: it omits many kinds.','Pasting YAML into vim without `:set paste`, mangling indentation.','Typing full names when short names exist (`po`, `svc`, `deploy`, `cm`, `pvc`, `ns`).']},
{note:'Practise until the setup is automatic: alias, completion and `$do` should be in place in the first 30 seconds of the exam. The time saved over a whole exam is considerable.'}],
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
