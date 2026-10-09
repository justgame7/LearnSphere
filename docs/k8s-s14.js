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
})();
