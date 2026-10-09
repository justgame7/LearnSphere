/* LearnSphere - Kubernetes Administrator, Section 14: Production Readiness & Capstone.
   Lectures 0-3 are core, 4-6 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T,R=K.R;

const resp=K.dg(700,260,[
[10,10,330,240,'Cloud provider (managed control plane)',1],[360,10,330,240,'You (the customer)',1],
[30,45,290,34,'Control plane: API server, etcd, scheduler',0],[30,89,290,34,'Control plane patching and availability',0],[30,133,290,34,'etcd backups and certificates',0],[30,177,290,34,'Underlying infrastructure and SLA',0],
[380,45,290,34,'Workloads: requests, probes, PDBs, images',2],[380,89,290,34,'Node pools: sizing, upgrades, images',2],[380,133,290,34,'RBAC, network policy, secrets, add-ons',2],[380,177,290,34,'Cost, monitoring, backups of your data',2]],
[]);

const tenant=K.dg(700,220,[
[10,10,680,200,'One cluster, soft multi-tenancy',1],
[30,45,200,150,'Namespace team-a|ResourceQuota|LimitRange|NetworkPolicy|RoleBinding (team-a)',2],[250,45,200,150,'Namespace team-b|ResourceQuota|LimitRange|NetworkPolicy|RoleBinding (team-b)',2],[470,45,200,150,'Shared: nodes, control plane,|DNS, ingress|(limits of isolation)',0]],
[]);

/* ---------- 0: Checklist ---------- */
L['k8s:13:0']={blocks:[
{p:'Almost every production incident traces back to something that was **skipped before launch**: no readiness probe, one replica, no resource requests, no backup that was ever restored. A production readiness review turns that experience into a checklist. The goal is not paperwork: for each item you should be able to say **what failure it prevents**, and verify it with a command.'},
{h:'The checklist, with the failure each item prevents'},
{h:'1. Workload definition'},
{t:[['Item','Prevents','How to verify'],
['Image pinned (version or digest), scanned, from your registry','Unexpected change, vulnerable code, supply-chain surprise','`kubectl get deploy -o jsonpath` image fields; no `latest`'],
['**2 or more replicas**, spread across nodes or zones','One node failure takes the service down','`kubectl get deploy`, topology spread constraints'],
['CPU and memory **requests** from measured use; memory limit','Noisy neighbours, OOM kills, scheduling surprises','`kubectl describe pod`, `kubectl top`'],
['**Readiness** probe (and liveness, startup where needed)','Traffic to unready Pods, unsafe rollouts, restart loops','`kubectl describe pod`'],
['Graceful shutdown: SIGTERM handling, grace period, `preStop`','Dropped requests during rollouts and drains','Delete a Pod under load and watch errors'],
['Configuration in ConfigMaps and Secrets','Rebuilding images to change settings; secrets in images','`kubectl get cm,secret`'],
['**PodDisruptionBudget**','Drains and upgrades taking down all replicas','`kubectl get pdb`'],
['Tested rolling update **and rollback**','Stuck releases without a way back','`kubectl rollout undo` rehearsed']]},
{h:'2. Security baseline'},
{t:[['Item','Prevents','How to verify'],
['Pod Security labels on the namespace (baseline enforced, restricted warned)','Privileged or host-level Pods','`kubectl get ns --show-labels`'],
['securityContext: non-root, no privilege escalation, drop capabilities, read-only root filesystem','Container escape and persistence','`kubectl get pod -o yaml`'],
['Dedicated ServiceAccount, token automount off if unused','Token theft, shared identities','`kubectl get pod -o jsonpath` serviceAccountName'],
['RBAC least privilege; no cluster-admin for workloads','Escalation','`kubectl auth can-i --list --as ...`'],
['Default-deny NetworkPolicy with explicit allows (on a CNI that enforces them)','Lateral movement','`kubectl get netpol`, test with a Pod'],
['Encryption at rest and audit logging on the cluster','Data exposure from etcd and backups, no forensics','`etcdctl get` check, audit log exists']]},
{h:'3. Operations'},
{t:[['Item','Prevents','How to verify'],
['Metrics, **alerts** and dashboards with an owner','Finding out from users','Alert rules exist and page someone'],
['Logs shipped off the node with retention','Evidence lost with the Pod','Query a deleted Pod logs'],
['**Backups** of etcd (self-managed), manifests and data, **restore tested**','Unrecoverable loss','A dated restore drill'],
['Upgrade plan: versions in support, staging cluster, rollback','Falling off support, surprise breakage','Calendar and runbook'],
['Capacity headroom: node loss, rollout surge, autoscaling limits','Outage when a node dies or a rollout runs','`kubectl describe node`, N-1 check'],
['Runbooks and on-call ownership','Slow, confused incident response','Link in each alert'],
['Cost visibility per team or namespace','Silent waste','Requests and usage reports']]},
{h:'A quick audit you can run'},
{code:`# single replicas
kubectl get deploy -A -o json | jq -r '.items[] | select(.spec.replicas==1) | .metadata.namespace+"/"+.metadata.name'
# containers without CPU/memory requests
kubectl get pods -A -o json | jq -r '.items[] | select(.spec.containers[] | .resources.requests == null) | .metadata.namespace+"/"+.metadata.name' | sort -u
# namespaces without Pod Security labels
kubectl get ns -o json | jq -r '.items[] | select(.metadata.labels["pod-security.kubernetes.io/enforce"] == null) | .metadata.name'
# images using :latest or no tag
kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"/"}{.metadata.name}{" "}{.spec.containers[*].image}{"\\n"}{end}' | grep -E ":latest|[^:]+ " | head
# PDBs and NetworkPolicies present?
kubectl get pdb -A ; kubectl get netpol -A
# any Pod running as root with privileged settings?
kubectl get pods -A -o json | jq -r '.items[] | select(.spec.containers[].securityContext.privileged==true) | .metadata.namespace+"/"+.metadata.name'`},
{h:'Make the checklist automatic'},
{ul:['Encode what you can as **admission policy** (ValidatingAdmissionPolicy, Kyverno): required requests, no `latest`, required labels, security contexts.','Add the same checks to **CI** so violations are found before they reach the cluster.','Use a **template or Helm chart** for services that already includes probes, PDB, security context and resources: teams start from a safe default.','Review the list at **launch** and again **quarterly**.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['"We will add monitoring after launch"','The first incident is blind','Ship dashboards and alerts with the service'],
['Backups never restored','Backups that do not work','Scheduled restore drills'],
['Copy-pasting manifests with `latest` and no limits','Hidden risk everywhere','A hardened template'],
['One checklist for everything','Ignored as bureaucracy','Fewer, enforced items that map to real failures'],
['Reviewing only the application, not the platform','Cluster-level gaps remain','Include upgrades, backups and capacity']]},
{note:'A good checklist is short enough to be followed and mostly enforced by tools. Every item should have an owner and a command that proves it.'}],
src:[['Production environment',K.S+'production-environment/'],['Pod Security Standards',C+'security/pod-security-standards/'],['Security checklist',C+'security/security-checklist/']]};

/* ---------- 1: Multi-tenancy ---------- */
L['k8s:13:1']={blocks:[
{p:'Many teams share clusters because separate clusters multiply cost and operations. **Multi-tenancy** is the discipline of making that sharing safe. The first question is not technical: **how much do you trust the tenants?** The answer decides whether namespaces and policies are enough, or whether you need separate clusters or sandboxing.'},
{svg:tenant},
{h:'Two models'},
{t:[['Model','Trust','Isolation','Typical case'],
['**Soft multi-tenancy**','Teams in one organisation: the risk is accidents and noisy neighbours, not attackers','Namespaces plus policies on shared nodes and a shared control plane','An internal platform for several product teams'],
['**Hard multi-tenancy**','Untrusted tenants, customer code, strict compliance','Separate clusters per tenant, or strong sandboxing (virtual clusters, VM-based runtimes)','SaaS running customer workloads, regulated environments']]},
{h:'The building blocks of a namespace-per-team design'},
{t:[['Control','What it provides','Command or object'],
['**Namespace**','A scope for names, RBAC and quotas','`kubectl create ns team-a`'],
['**RBAC**','The team can use its namespace and nothing else','RoleBinding to the `edit` ClusterRole for the team group'],
['**ResourceQuota**','Caps total CPU, memory, storage and object counts','`kubectl create quota`'],
['**LimitRange**','Defaults and ceilings per container','LimitRange object'],
['**NetworkPolicy**','Blocks cross-tenant traffic: default deny, explicit allows','`default-deny` policy'],
['**Pod Security Admission**','No privileged Pods, no host access','Namespace labels'],
['**Admission policy**','Required labels, allowed registries, forbidden settings','ValidatingAdmissionPolicy or a policy engine'],
['**PriorityClass control**','Tenants cannot use the highest priorities and evict others','Quota scoped to PriorityClass'],
['**Node pools and taints**','Dedicated nodes for sensitive or noisy tenants','Taints, labels, affinity'],
['**Ingress and DNS ownership**','One team cannot hijack another hostname','Gateway `allowedRoutes`, policy']]},
{h:'Onboarding a team: one repeatable script'},
{code:`kubectl create ns team-a
kubectl label ns team-a team=a pod-security.kubernetes.io/enforce=baseline pod-security.kubernetes.io/warn=restricted
kubectl -n team-a create rolebinding team-a-edit --clusterrole=edit --group=team-a
kubectl -n team-a create quota team-a --hard=requests.cpu=10,requests.memory=20Gi,limits.memory=40Gi,pods=50,services.loadbalancers=2
kubectl -n team-a apply -f limitrange.yaml -f default-deny.yaml -f allow-dns.yaml
kubectl auth can-i create deployments -n team-a --as alice --as-group team-a        # yes
kubectl auth can-i list pods -n team-b --as alice --as-group team-a                 # no`},
{p:'Put these objects in **Git** and apply them by GitOps so every tenant starts identical and drift is visible.'},
{h:'What shared clusters cannot hide'},
{t:[['Shared thing','Risk','What helps'],
['The **node kernel**','A container escape on a node exposes every tenant on it','Pod Security, seccomp, user namespaces, sandboxed runtimes, dedicated nodes'],
['The **control plane**','One tenant can overload the API server or etcd with objects and watches','API Priority and Fairness, quotas on object counts'],
['**Cluster-scoped objects** (CRDs, ClusterRoles, webhooks, StorageClasses)','Cannot be owned by a tenant; mistakes affect everyone','Platform team owns them'],
['**CPU, memory, disk, network**','Noisy neighbours','Requests and limits, quotas, node pools, bandwidth limits'],
['**DNS and ingress names**','Collisions and hijacking','Delegated domains, route attachment rules']]},
{ul:['**Namespaces alone are not a security boundary.** They become one only together with RBAC, network policy, Pod Security and quotas.','Decide early whether tenants may create their own CRDs, cluster roles or webhooks (usually not).','Give tenants **self-service** within limits so the platform team is not a bottleneck.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Namespaces without NetworkPolicy','Any Pod can reach any Pod','Default deny in every tenant namespace'],
['Giving teams cluster-admin','No isolation at all','Namespace-scoped roles'],
['No quotas','One team consumes the cluster','Quota and LimitRange from day one'],
['Assuming namespaces isolate the kernel','Escape affects all tenants','Dedicated nodes or sandbox runtimes for untrusted code'],
['Treating tenancy as an afterthought','Painful migration to separate clusters later','Decide the model first']]},
{note:'Decide the tenancy model before you onboard the second team. Moving from "everyone in one namespace" to proper isolation, or later to separate clusters, is far more work than starting with a clear policy.'}],
src:[['Multi-tenancy',C+'security/multi-tenancy/'],['Resource Quotas',C+'policy/resource-quotas/'],['Network Policies',C+'services-networking/network-policies/']]};

/* ---------- 2: Managed Kubernetes ---------- */
L['k8s:13:2']={blocks:[
{p:'Everything in this course works on **Amazon EKS, Azure AKS and Google GKE**: the API, objects, scheduling, networking and troubleshooting are the same. What changes is **who operates the control plane** and how identity, networking and storage plug into the cloud. Knowing exactly where that line falls is the difference between assuming "the provider handles it" and being surprised during an incident.'},
{svg:resp},
{h:'The shared responsibility split'},
{t:[['Area','Self-managed (kubeadm)','Managed (EKS, AKS, GKE)'],
['Control plane install, HA, patching','You','**Provider** (you choose version and region)'],
['etcd backup, control plane certificates','You','**Provider**'],
['Control plane upgrade','`kubeadm upgrade`','Provider API or console, one minor at a time, within a support window'],
['Worker nodes','VMs you build, join and patch','Node groups or pools: managed or self-managed, image rotation, surge upgrades'],
['Authentication','Certificates, OIDC','Cloud identity mapped to Kubernetes users and groups (IAM, Entra ID, Google identity)'],
['Authorization','RBAC','RBAC, **plus** cloud IAM for reaching the cluster API'],
['Pod networking','You choose a CNI','Provider CNI (VPC CNI, Azure CNI, GKE dataplane): Pod IPs often come from the cloud network'],
['Storage','CSI driver you install','Provider CSI drivers and StorageClasses, usually pre-installed (need IAM permissions)'],
['Load balancers','MetalLB or your own','Cloud load balancers created from `type: LoadBalancer`, Ingress and Gateway'],
['Troubleshooting depth','Everything, including the control plane','Workloads, nodes, networking, add-ons; control plane via provider status and logs']]},
{h:'What you still own on a managed cluster'},
{ul:['**Workloads**: requests and limits, probes, PDBs, security contexts, images.','**Access control**: RBAC, namespaces, network policies, Pod Security.','**Add-ons**: ingress controller, monitoring, logging, policy engine, cert-manager, CSI and CNI **versions**.','**Nodes**: pool sizing, OS and Kubernetes version of workers, upgrades, spot usage.','**Cloud IAM for Pods**: workload identity so Pods get least-privilege cloud permissions without node-wide credentials.','**Backups of your own data and resources** (the provider backs up the control plane, not your applications or volumes).','**Cost**: nodes, load balancers, disks, cross-zone traffic.']},
{h:'Getting access'},
{code:`# Same kubectl, different way to obtain credentials
aws eks update-kubeconfig --name prod --region eu-west-1
az aks get-credentials --resource-group rg-prod --name prod
gcloud container clusters get-credentials prod --region europe-west1

$ kubectl config current-context
$ kubectl get nodes -o wide            # note: no control plane nodes listed: the provider hides them
$ kubectl auth whoami                  # the identity the cluster derived from your cloud credentials`},
{p:'Notice that `kubectl get nodes` does not list any control plane nodes, and you cannot SSH into one. That is the whole point, and it also means you cannot edit API server flags or read its logs the way you did on kubeadm: you use the **provider settings and diagnostic logs** instead.'},
{h:'Mapping kubeadm skills to managed services'},
{t:[['Skill from this course','On a managed service'],
['`kubeadm upgrade` of the control plane','Provider upgrade operation; you still read release notes and check deprecated APIs first'],
['Upgrading workers (drain, upgrade, uncordon)','Roll a node pool; same PDB and capacity concerns'],
['etcd snapshot and restore','Not available; use Velero and GitOps for your own state'],
['Certificate renewal','Provider handles control plane; you handle application certificates'],
['Static Pods and control plane flags','Not accessible; some settings exposed as cluster options'],
['RBAC, NetworkPolicy, Pod Security, quotas','Unchanged, plus cloud IAM integration'],
['Node troubleshooting (kubelet, runtime, CNI)','Same, often via node debug Pods or provider tools']]},
{h:'Choosing and running one well'},
{ul:['Prefer a **private or restricted API endpoint** and limit who can reach it.','Know the **support window** and forced-upgrade policy: clusters out of support are upgraded for you.','Use **separate node pools** (system, general, special hardware) with taints and labels.','Pin and track **add-on versions**; they are not upgraded for you everywhere.','Understand the **cost model** and clean up fully: load balancers and disks outlive clusters.','Use **workload identity**, not static cloud keys in Secrets.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['"The provider handles security"','Open RBAC, public endpoints, over-privileged Pods','Apply the same hardening as anywhere'],
['Static cloud credentials in Secrets','Leaked keys','Workload identity'],
['Ignoring upgrade deadlines','Forced upgrades at a bad time','Track the support calendar'],
['No backup of application state','Control plane is safe, your data is not','Velero, volume snapshots, database backups'],
['Deleting the cluster but not its load balancers and disks','Ongoing cost','Clean up Services, PVCs and networking first']]},
{note:'Every skill in this course still applies on managed services. What changes is who patches the control plane and how identity, networking and storage integrate with the cloud: read the provider documentation for those parts.'}],
src:[['Best practices for Kubernetes',K.S+'best-practices/'],['Amazon EKS documentation','https://docs.aws.amazon.com/eks/'],['Azure Kubernetes Service documentation','https://learn.microsoft.com/azure/aks/'],['Google Kubernetes Engine documentation','https://cloud.google.com/kubernetes-engine/docs']]};

/* ---------- 3: Capstone ---------- */
L['k8s:13:3']={blocks:[
{p:'The capstone ties the course together: you **build a cluster, deploy and secure an application, make it production ready, upgrade the cluster, fix injected faults and restore from a backup**. Treat it as a small production project, and plan a weekend or several evenings. Use VMs (one control plane, two workers) so you can really break things. Everything below maps to a section of the course, so each part is also a revision exercise.'},
{flow:['Build the cluster with kubeadm and a CNI (Sections 3 and 4)','Deploy and secure an application (Sections 5 to 10)','Make it production ready (Section 14)','Take an etcd backup and upgrade one minor version (Section 11)','Inject and fix faults (Section 13)','Restore from the backup and write the runbook']},
{h:'Part 1: Build (about 1.5 hours)'},
{t:[['Step','Check that it worked'],
['Prepare all nodes: swap off, modules, sysctl, hostnames','Verify commands from the preparation lecture'],
['Install containerd with the systemd driver and the Kubernetes packages (held)','`crictl info` ready; `apt-mark showhold`'],
['`kubeadm init` from a **configuration file stored in Git**; install a CNI that enforces NetworkPolicy','`kubectl get nodes` Ready; CoreDNS Running'],
['Join both workers; label them; install Metrics Server and a StorageClass with a provisioner','`kubectl top nodes`; a test PVC binds'],
['Smoke test: Deployment, Service, NodePort, DNS lookup','All succeed; remove the test objects']]},
{h:'Part 2: Deploy and secure (about 2 hours)'},
{code:`# A two tier app (web + api) and a StatefulSet database with a PVC, in namespace "shop"
kubectl create ns shop
kubectl label ns shop pod-security.kubernetes.io/enforce=baseline pod-security.kubernetes.io/warn=restricted
# ResourceQuota, LimitRange, default-deny NetworkPolicy with explicit allows (web->api->db, DNS, ingress)
# ConfigMaps and Secrets for settings; ServiceAccount per app with automount disabled
# Roles: team group gets edit in shop; a CI ServiceAccount gets a Role to update Deployments; verify with can-i
# Ingress or Gateway with TLS; HPA on the web tier; PodDisruptionBudgets; probes and resources on every container
kubectl auth can-i --list -n shop --as jane --as-group shop-team
kubectl get netpol,quota,limitrange,pdb,hpa -n shop`},
{ul:['Enable **encryption at rest** and **audit logging** on the API server and prove each (etcd value prefix, audit log events).','Run `kube-bench` and record three findings you fixed and one you accepted.','Write down every decision and command in a repository: the runbook starts here.']},
{h:'Part 3: Operate (about 1.5 hours)'},
{code:`# backup, then upgrade one minor version
sudo ETCDCTL_API=3 etcdctl snapshot save /root/capstone.db ...
sudo kubeadm upgrade plan ; sudo kubeadm upgrade apply v1.<next>.x
# workers: drain, upgrade kubeadm, upgrade node, kubelet, restart, uncordon, one at a time
kubectl get nodes ; kubectl get pods -A ; kubectl logs probe | grep -c FAIL`},
{h:'Part 4: Break and fix (about 1 hour)'},
{p:'Have a friend or a script inject **three to five faults**: a Service selector change, a wrong image tag, a stopped kubelet, a bad flag in a static Pod manifest, a NetworkPolicy that blocks DNS, an expired certificate. Fix each using the **top-down method** of Section 13 and time yourself.'},
{h:'Part 5: Restore and document'},
{ul:['Delete a namespace on purpose, then recover: from GitOps and Velero, or by restoring the etcd snapshot on a **copy** of the cluster.','Compare what the snapshot restored with what needs separate backups (volumes, PKI).','Write a **one-page runbook**: build, upgrade, backup, restore, and the first five commands for an incident.']},
{h:'Self-assessment'},
{t:[['Skill','You are ready when you can'],
['Install','Build a working cluster from bare VMs in about an hour, and explain each phase of `kubeadm init`'],
['Workloads','Write Deployment, StatefulSet, Job, probes and resources from memory or with `--dry-run=client -o yaml`'],
['Scheduling','Place, taint, drain and autoscale; read a `FailedScheduling` message'],
['Networking','Expose an app, debug a Service by path, write a NetworkPolicy'],
['Storage','Create PVs, PVCs and StorageClasses and prove persistence'],
['Security','Create a user, a Role and a binding and test them with `can-i`; apply Pod Security'],
['Lifecycle','Snapshot and restore etcd; upgrade by one minor version; renew certificates'],
['Troubleshooting','Fix a broken node and a broken control plane component from logs']]},
{h:'Exam readiness'},
{ul:['Practise on the **Kubernetes version and curriculum** listed by the CNCF; check the allowed documentation and exam rules on their page.','Set aliases and `export do="--dry-run=client -o yaml"` first; use `kubectl explain` and `--help` instead of searching.','Run the **context-switch command** given with every task.','Flag slow tasks and return; **verify** each result with a read-only command.','Do at least two **timed mock runs** of mixed tasks before the real exam.']},
{note:'When the capstone feels routine, you are ready for real cluster work. Keep a lab cluster, upgrade it every release, and keep breaking it on purpose: that is how operators stay sharp.'}],
src:[['Production environment',K.S+'production-environment/'],['CNCF: Certified Kubernetes Administrator','https://www.cncf.io/training/certification/cka/'],['Kubernetes documentation',K.D]]};

/* ---------- Additional content ---------- */
/* 4: Cost and capacity planning */
L['k8s:13:4']={blocks:[
{p:'Kubernetes makes it easy to start workloads and just as easy to waste money. Cost work is mostly **capacity work**: requests that match reality, nodes that are well used, and headroom that is deliberate.'},
{h:'Where the money goes'},
{t:[['Cost driver','What to look at'],
['**Compute**','Node count and size; idle capacity from over-large requests'],
['**Storage**','PVCs that are never deleted, over-provisioned size, snapshots'],
['**Network**','Cross-zone and egress traffic, load balancers, NAT gateways'],
['**Control plane and add-ons**','Managed control plane fee, monitoring and logging volume'],
['**Licenses and support**','Per-node or per-core software']]},
{h:'Requests drive the bill'},
{p:'The scheduler reserves **requests**, so nodes fill up by requests, not by actual use. A cluster whose Pods request twice what they use needs about twice the nodes.'},
{code:`kubectl top nodes
kubectl top pods -A --sort-by=cpu | head
kubectl describe node w1 | sed -n '/Allocated resources/,/Events/p'      # requests vs capacity
# requests vs actual (Prometheus)
sum(kube_pod_container_resource_requests{resource="cpu"}) by (namespace)
sum(rate(container_cpu_usage_seconds_total[5m])) by (namespace)`},
{h:'Right-sizing'},
{ul:['Measure actual p95 or p99 usage over a representative period, then set **requests near typical use** and limits for protection.','Use the **VPA in Off mode** or tools such as Goldilocks and OpenCost reports for recommendations.','Memory request should cover the real working set; leave CPU limits off where throttling hurts.','Review **by namespace and team** so owners see their own numbers (showback or chargeback).']},
{h:'Utilization and bin packing'},
{ul:['Aim for healthy but not extreme utilization: for example 50 to 70 percent of allocatable CPU requested on average leaves room for spikes and node loss.','Use **node autoscaling** with consolidation (Karpenter or Cluster Autoscaler) and mixed instance types.','Use **spot or preemptible** nodes for fault-tolerant work, with PDBs, spread and graceful shutdown.','Separate pools for special hardware so expensive nodes are not wasted.']},
{h:'Capacity planning'},
{flow:['Measure current requests, usage and growth per team','Decide the failure budget: survive one node or one zone loss','Add headroom for rollouts and autoscaler delay','Project growth (traffic, new services) and review quarterly','Set quotas so teams cannot silently consume the buffer']},
{t:[['Question','How to answer'],
['Can we lose a node?','Sum of requests must fit on N-1 nodes'],
['Can we lose a zone?','Requests must fit in the remaining zones, and storage must be recoverable'],
['How fast can we grow?','Autoscaler speed, cloud quotas, node boot time']]},
{h:'Cleanup that pays back'},
{code:`kubectl get pvc -A --no-headers | grep -v Bound
kubectl get pv | grep Released
kubectl get svc -A | grep LoadBalancer                 # each one may cost money
kubectl get deploy -A -o json | jq -r '.items[] | select(.spec.replicas==0) | .metadata.namespace+"/"+.metadata.name'   # scaled to zero but still defined
kubectl get ns --show-labels`},
{note:'Do not cut requests blindly: too-low requests cause noisy neighbours and OOM kills. Change in steps, watch error rates and restarts, and keep the previous values noted.'}],
src:[['Resource Management for Pods and Containers',K.C+'configuration/manage-resources-containers/'],['OpenCost','https://www.opencost.io/docs/'],['Node Autoscaling',K.C+'cluster-administration/node-autoscaling/']]};

/* 5: Multi-cluster */
L['k8s:13:5']={blocks:[
{p:'Most organisations end up with **several clusters**: per environment, per region, per team or per compliance boundary. Operating many clusters well needs consistency, automation and clear rules about what runs where.'},
{h:'Why more than one cluster'},
{t:[['Reason','Example'],
['Environments','Dev, staging and production clusters (never share a cluster across risk levels)'],
['Blast radius','A bad upgrade or an incident affects only one cluster'],
['Geography and latency','Clusters per region; data residency rules'],
['Compliance and tenancy','Hard isolation for regulated or untrusted workloads'],
['Scale limits','Very large systems split into cells']]},
{h:'The cost of many clusters'},
{ul:['Every cluster needs upgrades, security patches, add-ons and monitoring.','Duplicated control plane and add-on resources.','Configuration drift unless everything is defined as code.','Cross-cluster networking, service discovery and identity are your problem.']},
{h:'Fleet management building blocks'},
{t:[['Concern','Common approach'],
['**Cluster creation and upgrades**','Cluster API, Terraform and managed-service APIs, with the same versions and modules'],
['**Configuration and apps**','GitOps with one repo structure: Argo CD ApplicationSets or Flux Kustomizations per cluster or per label'],
['**Policy**','Policy engines and admission policies deployed to every cluster from one source'],
['**Access**','Central identity (OIDC), same RBAC groups mapped everywhere'],
['**Observability**','Metrics and logs shipped to a central system (Thanos, Mimir, hosted), with a cluster label'],
['**Traffic**','Global load balancing or DNS across clusters; service mesh multi-cluster or Cilium Cluster Mesh when services must talk across clusters'],
['**Inventory**','Which clusters exist, their versions, owners and cost']]},
{code:`# Argo CD ApplicationSet: deploy one app to every cluster with a label
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata: {name: monitoring-agent, namespace: argocd}
spec:
  generators:
  - clusters: {selector: {matchLabels: {env: prod}}}
  template:
    metadata: {name: 'agent-{{name}}'}
    spec:
      project: platform
      source: {repoURL: https://git.example.com/platform/addons.git, targetRevision: main, path: monitoring-agent}
      destination: {server: '{{server}}', namespace: monitoring}
      syncPolicy: {automated: {prune: true, selfHeal: true}}`},
{h:'Practical rules'},
{ul:['**Version discipline**: define the supported versions and upgrade each cluster through a pipeline: dev, staging, canary production, then the rest.','Treat clusters as **cattle**: rebuildable from code, not hand-tuned.','Keep a **minimal number of cluster flavours**.','Use context names and prompts that make the target cluster obvious, and protect production with separate credentials.','Prefer **active-active across regions** only for stateless or well-replicated services; state is the hard part.']},
{code:`kubectl config get-contexts
for c in $(kubectl config get-contexts -o name); do echo "== $c"; kubectl --context "$c" get nodes -o custom-columns=NAME:.metadata.name,VER:.status.nodeInfo.kubeletVersion --no-headers | head -n 3; done`},
{note:'Start with the smallest fleet that meets your isolation needs. Each extra cluster is permanent operational work, so add it only for a clear reason.'}],
src:[['Multi-tenancy and cluster isolation',K.C+'security/multi-tenancy/'],['Argo CD ApplicationSet','https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/'],['Cluster API','https://cluster-api.sigs.k8s.io/']]};

/* 6: DR game day */
L['k8s:13:6']={blocks:[
{p:'A **game day** is a planned exercise where you cause a failure (or simulate one) and practise recovery with the real team, tools and runbooks. Plans that were never rehearsed fail when they are needed.'},
{h:'Define the targets first'},
{t:[['Term','Meaning','Example'],
['**RPO** (recovery point objective)','How much data you can afford to lose','15 minutes: backups or replication at most 15 minutes old'],
['**RTO** (recovery time objective)','How long you can be down','1 hour to serve traffic again'],
['**Blast radius**','What the exercise may affect','One namespace in staging, then one zone in production']]},
{h:'Scenarios to rehearse'},
{t:[['Scenario','What it tests'],
['Delete a namespace or critical Deployment by mistake','GitOps re-sync, Velero restore, who has permission'],
['Lose one worker node, then a whole zone','Replicas, spread, PDBs, storage in other zones, autoscaling'],
['Lose one control plane node (HA)','Quorum, load balancer, leader election'],
['Lose the whole control plane or etcd data','etcd snapshot restore, rebuild from code, certificates'],
['Expired certificates','Detection, renewal runbook'],
['Bad upgrade','Rollback, blue-green cutback'],
['Region or cloud outage','Cross-region failover, DNS, data replication'],
['Registry or Git outage','Mirrors, cached images, break-glass deploys'],
['Compromised credential or workload','Revocation, isolation, forensics']]},
{h:'How to run one'},
{flow:['Pick a scenario, objectives and a safe environment; announce it','Write the steps, success criteria and abort conditions','Inject the failure (delete, stop, block traffic) with a tool such as Chaos Mesh or Litmus, or manually','The team recovers using only the documented runbooks','Measure detection time, decision time, recovery time and data loss against RTO and RPO','Hold a blameless review and fix the gaps']},
{code:`# Examples of safe, reversible failure injection in a test cluster
kubectl drain w2 --ignore-daemonsets --delete-emptydir-data && kubectl get pods -A -o wide
kubectl -n shop delete pod -l app=api --grace-period=0 --force         # kill without graceful shutdown
sudo systemctl stop kubelet                                              # on one node
# blocking a dependency with a NetworkPolicy, then removing it
kubectl delete namespace shop-test                                       # then restore from GitOps and Velero`},
{h:'Runbook essentials'},
{ul:['Where are the **backups**, how old are they, and who can restore them?','Where are the **credentials and break-glass access** (kept offline and tested)?','Exact commands for: etcd restore, rebuilding a control plane, restoring a namespace, rotating certificates.','Contacts, escalation, and the **order** of recovery (identity, network, storage, platform add-ons, applications).','How to confirm success: smoke tests and SLO dashboards.']},
{h:'After the exercise'},
{ul:['Record timings and compare with RTO and RPO.','Turn every surprise into an action item with an owner and date.','Update runbooks and automate the slow manual steps.','Repeat on a schedule (for example twice a year) and after major changes.']},
{note:'Start in staging with a narrow failure, then widen. Production game days need clear abort criteria, an observer who can stop the exercise and a communications plan.'}],
src:[['Operating etcd clusters',K.T+'administer-cluster/configure-upgrade-etcd/'],['Velero','https://velero.io/docs/'],['Chaos Mesh','https://chaos-mesh.org/docs/'],['Litmus','https://docs.litmuschaos.io/']]};
})();
