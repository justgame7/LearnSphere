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
{p:'Before a workload goes live, walk through a checklist. Most production incidents trace back to something on this list that was skipped.'},
{h:'Workload definition'},
{t:[['Area','Check'],
['Image','Pinned version or digest, scanned, from a trusted registry, runs as non-root'],
['Replicas','At least 2 for anything that must stay up, spread across nodes or zones (topology spread)'],
['Resources','CPU and memory **requests** set from measured use, memory limit set, QoS understood'],
['Probes','Readiness always; liveness only for the process itself; startup for slow starters'],
['Shutdown','Handles SIGTERM, sensible `terminationGracePeriodSeconds`, `preStop` if needed'],
['Config','ConfigMaps and Secrets, no secrets in images or Git'],
['Disruption','PodDisruptionBudget so drains and upgrades keep it available'],
['Rollout','Rolling update settings and a tested rollback']]},
{h:'Security baseline'},
{ul:['Namespace has Pod Security Admission labels (baseline enforced, restricted warned or enforced).','securityContext: non-root, no privilege escalation, drop capabilities, read-only root filesystem where possible.','Dedicated ServiceAccount, token automount off unless needed, RBAC least privilege.','Default-deny NetworkPolicy with explicit allows (and a CNI that enforces it).','Encryption at rest enabled (or provider KMS), audit logging on.']},
{h:'Operations'},
{ul:['**Monitoring and alerting**: node, Pod and application metrics; alerts that someone owns.','**Logging**: shipped off the node with retention.','**Backups**: etcd snapshots (self-managed) and application and volume backups, with a **tested restore**.','**Upgrade plan**: a calendar, a staging cluster and a rollback plan; versions inside the support window.','**Capacity**: headroom for a node loss, autoscaling limits, quotas.','**Runbooks and ownership**: who is paged, and what the first three commands are.','**Cost visibility**: requests tracked per team or namespace.']},
{code:`# Quick audit commands
kubectl get deploy -A -o json | jq -r '.items[] | select(.spec.replicas==1) | .metadata.namespace+"/"+.metadata.name'     # single replicas
kubectl get pods -A -o json | jq -r '.items[] | select(.spec.containers[].resources.requests==null) | .metadata.namespace+"/"+.metadata.name'
kubectl get ns --show-labels | grep -v pod-security
kubectl get pdb -A ; kubectl get netpol -A
kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"/"}{.metadata.name}{" "}{.spec.containers[*].image}{"\\n"}{end}' | grep ":latest"`},
{note:'A checklist works when it is enforced: encode as much as you can in admission policy (ValidatingAdmissionPolicy or Kyverno) and CI checks, so the safe path is the default one.'}],
src:[['Production environment',K.S+'production-environment/'],['Pod Security Standards',C+'security/pod-security-standards/'],['Security checklist',C+'security/security-checklist/']]};

/* ---------- 1: Multi-tenancy ---------- */
L['k8s:13:1']={blocks:[
{p:'Many teams often share one cluster to save cost and effort. **Multi-tenancy** is how you make that safe. The key question is how much you trust the tenants.'},
{svg:tenant},
{h:'Soft and hard multi-tenancy'},
{t:[['Model','Trust','Isolation','Example'],
['**Soft** (namespaces in one cluster)','Teams in one organisation, accidental harm is the main risk','Namespaces plus policy: shares nodes and the control plane','Internal platform for several product teams'],
['**Hard** (separate clusters, or strong sandboxing)','Untrusted or hostile tenants, compliance needs','Cluster per tenant, or virtual clusters and sandboxed runtimes','SaaS running customer code, regulated workloads']]},
{h:'Building blocks for a namespace-per-team design'},
{t:[['Control','Purpose'],
['**Namespace**','Scope for names, RBAC and quota'],
['**RBAC**','A RoleBinding giving the team group `edit` (or a custom role) in its namespace only; no cluster-wide rights'],
['**ResourceQuota**','Caps total CPU, memory, storage and object counts'],
['**LimitRange**','Default and maximum per-container sizes'],
['**NetworkPolicy**','Default deny, allow only needed flows; stops lateral movement between namespaces'],
['**Pod Security Admission**','Baseline or restricted per namespace; block privileged Pods and hostPath'],
['**Admission policies**','Required labels, allowed registries, forbidden settings'],
['**Priority classes**','Protect platform workloads; restrict who can use high priorities'],
['**Node pools / taints**','Dedicated nodes for sensitive or noisy tenants'],
['**Ingress and DNS**','Host name ownership per team; avoid one team capturing another name']]},
{code:`# Onboarding a team: one script, repeatable (or GitOps)
kubectl create ns team-a
kubectl label ns team-a pod-security.kubernetes.io/enforce=baseline pod-security.kubernetes.io/warn=restricted team=a
kubectl -n team-a create rolebinding team-a-edit --clusterrole=edit --group=team-a
kubectl -n team-a apply -f quota.yaml -f limitrange.yaml -f default-deny.yaml`},
{h:'Limits of soft multi-tenancy'},
{ul:['**Shared kernel**: a container escape on a node exposes every tenant on that node.','**Shared control plane**: one tenant can overload the API server or etcd with many objects or watches (API Priority and Fairness helps).','**Cluster-scoped resources** (CRDs, ClusterRoles, StorageClasses, webhooks) are shared and cannot be tenant-owned.','**Noisy neighbours**: CPU, memory, disk I/O and network are only as isolated as your limits and node separation.','Namespaces are **not** a security boundary by themselves; the policies above are what make them one.']},
{note:'Decide the tenancy model early. Moving from "everyone in one cluster" to separate clusters later is far more work than starting with a clear policy about who shares what.'}],
src:[['Multi-tenancy',C+'security/multi-tenancy/'],['Resource Quotas',C+'policy/resource-quotas/'],['Network Policies',C+'services-networking/network-policies/']]};

/* ---------- 2: Managed Kubernetes ---------- */
L['k8s:13:2']={blocks:[
{p:'EKS, AKS and GKE run the **control plane** for you. That removes a large part of the work from Sections 3, 4 and 11, but not all of the responsibility.'},
{svg:resp},
{h:'What carries over from the kubeadm skills'},
{t:[['Topic','Self-managed (kubeadm)','Managed (EKS / AKS / GKE)'],
['Control plane install and HA','You build it','Provider operates it; you pick a version and region'],
['etcd backup and certificates','You','Provider'],
['Control plane upgrade','`kubeadm upgrade`','Provider API or console, one minor at a time, within a support window'],
['Worker nodes','VMs you join and patch','Node groups or pools (managed or self-managed), image rotation, surge upgrades, optional auto-provisioning'],
['Authentication','Certificates, OIDC','Cloud identity integration (IAM, Entra ID, Google identity) mapped to Kubernetes users or groups'],
['Authorization','RBAC','RBAC, plus cloud IAM for access to the cluster API'],
['Networking','You choose a CNI','Provider CNI (VPC CNI, Azure CNI, GKE dataplane) with Pod IPs from the cloud network'],
['Storage','CSI driver you install','Provider CSI drivers and StorageClasses, usually pre-installed'],
['Load balancers','MetalLB or your own','Cloud load balancers created from `type: LoadBalancer` Services and Ingress or Gateway'],
['Troubleshooting','Everything, including the control plane','Workloads, nodes, networking; control plane via provider logs and status']]},
{h:'What you still own'},
{ul:['Workload design: requests, probes, PDBs, security contexts.','RBAC and namespaces, network policies, Pod Security.','Add-ons: ingress controller, monitoring, logging, policy engine, cert-manager.','Node pool sizing, upgrades and cost.','Cloud IAM for Pods (workload identity: IRSA or Pod Identity on AWS, Workload Identity on Azure and GCP) instead of node-wide credentials.','Backups of **your** data and resources (for example Velero).']},
{h:'Choosing and operating a managed cluster'},
{ul:['Pick a **private or restricted API endpoint** where possible and limit who can reach it.','Understand **version support windows and forced upgrades**: clusters out of support are upgraded for you.','Use **separate node pools** for system, general and special workloads, with taints and labels.','Know the **cost model**: control plane fee, nodes, load balancers, disks and cross-zone traffic.','Delete labs fully: load balancers and disks can outlive a cluster.']},
{code:`# Same kubectl, different way to get credentials
aws eks update-kubeconfig --name prod --region eu-west-1
az aks get-credentials --resource-group rg --name prod
gcloud container clusters get-credentials prod --region europe-west1
kubectl get nodes -o wide`},
{note:'Every skill in this course still applies on managed services: the API, objects, scheduling, networking and troubleshooting are identical. What changes is who patches the control plane and how identity, networking and storage integrate with the cloud.'}],
src:[['Best practices for managed clusters',K.S+'best-practices/'],['Amazon EKS documentation','https://docs.aws.amazon.com/eks/'],['Azure Kubernetes Service documentation','https://learn.microsoft.com/azure/aks/'],['Google Kubernetes Engine documentation','https://cloud.google.com/kubernetes-engine/docs']]};

/* ---------- 3: Capstone ---------- */
L['k8s:13:3']={blocks:[
{p:'The capstone ties the course together. Plan **a weekend or several evenings** and treat it like a small production project. Use VMs (one control plane, two workers) so you can really break things.'},
{flow:['Build the cluster with kubeadm and a CNI','Deploy and secure an application','Make it production-ready','Take an etcd backup and upgrade one minor version','Inject and fix faults','Restore from the backup']},
{h:'Part 1: Build (Sections 3 and 4)'},
{ul:['Prepare nodes, install containerd (systemd cgroup driver) and the Kubernetes packages.','`kubeadm init` from a **config file** stored in Git, install a CNI that enforces NetworkPolicy, join both workers.','Install Metrics Server and a StorageClass with a provisioner. Verify with a smoke test.']},
{h:'Part 2: Deploy and secure (Sections 5 to 10)'},
{ul:['Two-tier app (web and API) plus a StatefulSet database with a PVC, using ConfigMaps and Secrets.','Namespace with Pod Security labels, ResourceQuota, LimitRange, default-deny NetworkPolicy and explicit allows.','RBAC: a team group with namespace-only access, a CI ServiceAccount with a Role, tested with `kubectl auth can-i`.','Expose through Ingress or Gateway API with TLS. Add an HPA and PodDisruptionBudgets.','Enable encryption at rest and audit logging on the API server.']},
{h:'Part 3: Operate (Sections 11 and 13)'},
{code:`# Backup, then upgrade one minor
sudo ETCDCTL_API=3 etcdctl snapshot save /root/capstone.db ...
sudo kubeadm upgrade plan ; sudo kubeadm upgrade apply v1.<next>.x
# workers: drain, upgrade kubeadm/kubelet, uncordon, one at a time
kubectl get nodes ; kubectl get pods -A`},
{h:'Part 4: Break and fix'},
{p:'Have a friend (or a script) inject three to five faults: a Service selector change, a wrong image tag, a stopped kubelet, a bad flag in a static Pod manifest, a NetworkPolicy that blocks the API. Fix each and time yourself.'},
{h:'Part 5: Restore'},
{ul:['Delete a namespace on purpose, then restore the cluster state from the etcd snapshot on a copy of the cluster, or rebuild from Git.','Compare what a snapshot restores with what needs separate backups (volumes, PKI).','Write a one-page runbook: build, upgrade, backup, restore, first-response commands.']},
{h:'Self-assessment'},
{t:[['Skill','You are ready when you can'],
['Install','Build a working cluster from bare VMs in under an hour'],
['Workloads','Write Deployment, StatefulSet, Job, probes and resources from memory or with `--dry-run`'],
['Networking','Expose an app, debug a Service and write a NetworkPolicy'],
['Security','Create a user, a Role and a binding, and test them'],
['Lifecycle','Snapshot and restore etcd, and upgrade by one minor version'],
['Troubleshooting','Fix a broken node and a broken control plane component using logs']]},
{h:'Exam readiness'},
{ul:['Practise with the **current CKA curriculum and Kubernetes version** from the CNCF; confirm the allowed documentation and exam rules.','Set up aliases and `$do` at the start of the exam; use `--dry-run=client -o yaml` and `kubectl explain`.','Always run the context-switch command given with each task.','Flag slow tasks and return. Verify each result before moving on.']},
{note:'When the capstone feels routine, you are ready for real cluster work. Keep a lab cluster running on a schedule, upgrade it every release and keep breaking it on purpose.'}],
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
