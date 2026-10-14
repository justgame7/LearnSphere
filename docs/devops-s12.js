/* LearnSphere - DevOps & CI/CD, Section 12: GitOps & Kubernetes Delivery.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const loop=K.dg(700,220,[
[10,10,680,200,'The GitOps loop',1],
[30,80,130,60,'Git repository|desired state',2],[230,80,150,60,'Agent in cluster|pulls and compares',0],[450,80,130,60,'Cluster|actual state',0],
[230,160,150,36,'Drift: reconcile',0]],
[[160,110,230,110],[380,110,450,110],[450,130,380,170],[300,160,300,140]]);

const pushpull=K.dg(700,260,[
[10,10,680,115,'Push: the pipeline holds cluster credentials',1],
[30,55,110,50,'CI pipeline',0],[200,55,140,50,'kubectl apply',0],[420,55,130,50,'Cluster',0],
[10,135,680,115,'Pull: the agent inside the cluster reads Git',1],
[30,180,110,50,'Git repo',0],[200,180,140,50,'Agent in cluster',2],[420,180,130,50,'Cluster',0]],
[[140,80,200,80],[340,80,420,80],[200,205,140,205],[340,205,420,205]]);

const argo=K.dg(700,230,[
[10,10,680,210,'Argo CD',1],
[25,80,130,60,'Git repo|manifests',0],[200,30,150,50,'Repo server|renders manifests',0],[200,100,150,50,'Application|controller',2],[200,160,150,40,'API server and UI',0],
[420,80,120,60,'Kubernetes|cluster',0],[580,80,90,60,'Sync status|and health',0]],
[[155,110,200,55],[275,80,275,100],[350,125,420,110],[540,110,580,110],[275,150,275,160]]);

/* ---------- 0 ---------- */
L['devops:11:0']={blocks:[
{p:'**GitOps** is a way of delivering and operating systems where the **desired state is stored in Git**, and software agents continuously make the running system match it. The Git repository becomes the single source of truth and the audit log.'},
{svg:loop},
{h:'The four OpenGitOps principles'},
{t:[['Principle','Meaning'],
['**1. Declarative**','The system\'s desired state is expressed declaratively (what, not how)'],
['**2. Versioned and immutable**','Desired state is stored so that it is versioned, immutable and keeps a complete history (Git)'],
['**3. Pulled automatically**','Software agents automatically pull the desired state from the source'],
['**4. Continuously reconciled**','Agents continuously observe actual state and try to apply the desired state']]},
{h:'What changes compared with scripted deployment'},
{t:[['Scripted deployment','GitOps'],
['A pipeline runs commands to change the system','A commit changes desired state; an agent converges the system'],
['Drift goes unnoticed until the next run','Drift is detected and corrected continuously'],
['Rollback is another deployment','Rollback is `git revert`'],
['Audit comes from pipeline logs','Audit is the Git history and reviews']]},
{note:'GitOps is a set of principles, not a product. Argo CD and Flux are popular implementations. The CNCF GitOps Associate (CGOA) exam is built around these principles.'}],
src:[['OpenGitOps',K.OGO],['CNCF GitOps Associate','https://training.linuxfoundation.org/certification/gitops-associate-cgoa/']]};

/* ---------- 1 ---------- */
L['devops:11:1']={blocks:[
{p:'There are two ways to get a change into a cluster. The difference is **where the credentials live** and **who initiates the change**.'},
{svg:pushpull},
{t:[['','Push','Pull'],
['Initiator','The CI/CD pipeline','An agent inside or next to the cluster'],
['Cluster credentials','Stored in the pipeline (an outside system with broad access)','Stay inside the cluster; the agent only needs read access to Git'],
['Drift handling','Only corrected on the next pipeline run','Continuously detected and corrected'],
['Network','Cluster API must be reachable from CI','Outbound connections only from the cluster'],
['Failure mode','Pipeline compromise exposes cluster','Compromise of Git is the concern, mitigated with review and protection']]},
{h:'The split of responsibilities'},
{p:'In a typical GitOps flow, **CI** still builds, tests and publishes the artifact and then updates the config repository (an image tag change). **CD** is the agent that pulls that change.'},
{flow:['CI builds and pushes the image','CI opens a commit or pull request updating the manifest in the config repository','The change is reviewed and merged','The agent pulls the new desired state','The agent applies it and reports health']},
{note:'Keeping cluster credentials out of CI is a major security gain. A compromised pipeline can no longer directly change production.'}],
src:[['OpenGitOps principles',K.OGO]]};

/* ---------- 2 ---------- */
L['devops:11:2']={blocks:[
{p:'Kubernetes accepts YAML manifests. To deliver the same application to several environments you need a way to **package and customise** them. Two tools dominate. This lesson builds on the Kubernetes course.'},
{t:[['','Helm','Kustomize'],
['Approach','Templated charts with values','Plain YAML patched with overlays'],
['Packaging','Versioned chart, can be published to a registry','Directory of bases and overlays'],
['Customisation','`values.yaml` per environment','Patches and generators per overlay'],
['Strength','Reuse, third-party software, release tracking','No templating language, readable'],
['Built into kubectl','No','Yes, `kubectl apply -k`']]},
{code:`# Kustomize layout
deploy/
  base/
    deployment.yaml
    service.yaml
    kustomization.yaml
  overlays/
    staging/
      kustomization.yaml    # replicas: 2, image tag, config
    production/
      kustomization.yaml    # replicas: 6, resources, config`},
{code:`# overlays/production/kustomization.yaml
resources: [../../base]
images:
  - name: ghcr.io/acme/sample-app
    newTag: 1.4.2
replicas:
  - name: sample-app
    count: 6`},
{h:'Choosing'},
{ul:['Use **Helm** to install third-party software and to distribute your own packaged apps.','Use **Kustomize** for simple, environment-specific variation of your own manifests.','Both work with Argo CD and Flux. Many teams combine them (Kustomize over a Helm chart).']}],
src:[['Helm','https://helm.sh/docs/'],['Kustomize',K.K8S+'tasks/manage-kubernetes-objects/kustomization/']]};

/* ---------- 3 ---------- */
L['devops:11:3']={blocks:[
{p:'**Argo CD** is a declarative GitOps controller for Kubernetes. You define an **Application** that links a path in a Git repository to a destination in a cluster, and Argo CD keeps them in line.'},
{svg:argo},
{t:[['Component','Role'],
['**API server**','UI, CLI and API access, authentication'],
['**Repo server**','Clones repositories and renders manifests (Helm, Kustomize, plain YAML)'],
['**Application controller**','Compares desired and live state and applies changes'],
['**Application**','Custom resource linking source (repo, path, revision) to destination (cluster, namespace)']]},
{code:`kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml`},
{code:`apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: sample-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/acme/sample-app-config.git
    targetRevision: main
    path: deploy/overlays/staging
  destination:
    server: https://kubernetes.default.svc
    namespace: sample
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions: [CreateNamespace=true]`}],
src:[['Argo CD architecture',K.ARGO+'operator-manual/architecture/'],['Argo CD getting started',K.ARGO+'getting_started/']]};

/* ---------- 4 ---------- */
L['devops:11:4']={blocks:[
{p:'Argo CD tracks two separate things for every Application: whether the cluster **matches Git**, and whether the application is **working**.'},
{t:[['Status','Values','Meaning'],
['**Sync status**','Synced, OutOfSync','Does live state equal the desired state in Git?'],
['**Health status**','Healthy, Progressing, Degraded, Suspended, Missing','Are the resources actually working?']]},
{p:'An application can be Synced but Degraded (the manifests were applied, but pods crash) or Healthy but OutOfSync (it works but differs from Git).'},
{h:'Sync policy'},
{t:[['Setting','Effect'],
['Manual sync','A person or pipeline triggers sync'],
['`automated`','Argo CD syncs when Git changes'],
['`prune: true`','Delete live resources that were removed from Git'],
['`selfHeal: true`','Revert manual changes made directly in the cluster']]},
{flow:['Someone edits a Deployment with kubectl','Argo CD notices the difference (OutOfSync)','With selfHeal, it reapplies the Git version','Application returns to Synced and Healthy']},
{h:'Useful controls'},
{ul:['**Sync waves and hooks** order resources (database migration before the app).','**Ignore differences** for fields set by other controllers (such as replica count with an autoscaler).','**Sync windows** limit when automatic syncs may happen.']},
{code:`argocd app get sample-app
argocd app diff sample-app
argocd app sync sample-app
argocd app history sample-app`}],
src:[['Sync options',K.ARGO+'user-guide/sync-options/'],['Automated sync policy',K.ARGO+'user-guide/auto_sync/']]};

/* ---------- 5 ---------- */
L['devops:11:5']={blocks:[
{p:'**Flux** is the other major GitOps implementation. Instead of one application with a UI, it is a set of small controllers (the **GitOps Toolkit**) that each do one job, driven by Kubernetes custom resources.'},
{t:[['Flux resource','Role'],
['**GitRepository / OCIRepository**','A source: where to fetch manifests from'],
['**Kustomization**','Apply a path from a source with Kustomize and reconcile it'],
['**HelmRelease**','Install and upgrade a Helm chart declaratively'],
['**Notification, Alert**','Send events to chat or webhooks'],
['**ImageUpdateAutomation**','Update image tags in Git when new images appear']]},
{code:`flux bootstrap github --owner=acme --repository=fleet --path=clusters/prod --personal`},
{code:`apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata: { name: sample-app, namespace: flux-system }
spec:
  interval: 1m
  url: https://github.com/acme/sample-app-config
  ref: { branch: main }
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata: { name: sample-app, namespace: flux-system }
spec:
  interval: 5m
  path: ./deploy/overlays/staging
  prune: true
  sourceRef: { kind: GitRepository, name: sample-app }`},
{h:'Argo CD compared with Flux'},
{t:[['','Argo CD','Flux'],
['Shape','One application with API and UI','Composable controllers, CLI first'],
['Unit of deployment','Application','Kustomization and HelmRelease'],
['UI','Rich built-in UI','Optional (third-party)'],
['Multi-tenancy','Projects and RBAC','Kubernetes RBAC and namespaces'],
['Fits','Teams that want visibility and a UI','Platform teams composing automation']]}],
src:[['Flux documentation',K.FLUX]]};

/* ---------- 6 ---------- */
L['devops:11:6']={blocks:[
{p:'Keep **application code** and **desired state** in separate repositories (or at least separate paths). Their rates of change, reviewers and risk differ.'},
{svg:K.dg(700,220,[
[10,10,680,200,'Two repositories, promoted by pull request',1],
[30,70,130,60,'App repo|source and tests',0],[220,70,130,60,'CI builds,|pushes image',0],[410,50,130,50,'Config repo:|staging overlay',0],[410,120,130,50,'Config repo:|production overlay',2],[590,80,80,60,'Agent|pulls',0]],
[[160,100,220,100],[350,100,410,75],[475,100,475,120],[540,145,590,110]])},
{t:[['Why separate','Benefit'],
['Config changes should not trigger application builds','Fewer wasted pipelines and no build loops'],
['Different access','Operators and release managers can approve config without app write access'],
['Clean audit','The config history is a log of what ran where'],
['Pull request promotion','Promote staging to production by copying a version in a PR']]},
{h:'Environment promotion'},
{flow:['CI publishes the image and opens a PR changing the staging overlay','The agent deploys it to staging','Tests and checks pass','A PR changes the production overlay to the same image tag','Review and merge; the agent deploys to production']},
{ul:['Use **directories per environment**, not long-lived branches per environment. Directories are easier to diff and promote.','Reference images by **tag or digest**, and let CI write the new value.']}]};

/* ---------- 7 ---------- */
L['devops:11:7']={blocks:[
{p:'GitOps wants everything in Git, but secrets must never be committed in plain text. Three families of solutions keep Git as the source of truth without exposing values.'},
{t:[['Approach','How it works','Good for'],
['**Sealed Secrets**','Encrypt a secret with the cluster\'s public key. Only that cluster can decrypt it. Commit the sealed object','Simple, per-cluster secrets'],
['**SOPS** (with age, KMS or Key Vault)','Encrypt values inside a YAML file and commit it. The agent decrypts at apply time','Flexible, works with Flux and Argo CD plugins'],
['**External Secrets Operator**','Git holds a reference. The operator fetches the real value from a secret manager (Vault, AWS, Azure, GCP) into a Kubernetes Secret','Central secret management and rotation']]},
{code:`# External Secrets: Git only contains the reference
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata: { name: db-credentials }
spec:
  refreshInterval: 1h
  secretStoreRef: { kind: ClusterSecretStore, name: vault }
  target: { name: db-credentials }
  data:
    - secretKey: password
      remoteRef: { key: apps/sample/db, property: password }`},
{h:'Choosing'},
{ul:['Use **External Secrets** when you already run a secret manager or need rotation.','Use **Sealed Secrets** or **SOPS** for small setups without an external store.','Never commit base64-encoded Secrets. Base64 is encoding, not encryption.']}],
src:[['External Secrets Operator','https://external-secrets.io/latest/'],['Sealed Secrets','https://github.com/bitnami-labs/sealed-secrets'],['SOPS','https://getsops.io/docs/']]};

/* ---------- 8 ---------- */
L['devops:11:8']={blocks:[
{p:'With dozens of applications and several clusters, one Application per app does not scale. Argo CD offers patterns to **generate** them from a few definitions.'},
{t:[['Pattern','What it does'],
['**App of apps**','A parent Application whose source is a directory of child Application manifests'],
['**ApplicationSet**','A template plus a **generator** (list, cluster, Git directories, pull requests) that produces many Applications']]},
{code:`apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata: { name: sample-app }
spec:
  generators:
    - list:
        elements:
          - { cluster: staging,    url: https://staging.example.com }
          - { cluster: production, url: https://prod.example.com }
  template:
    metadata: { name: 'sample-app-{{cluster}}' }
    spec:
      project: default
      source:
        repoURL: https://github.com/acme/sample-app-config.git
        targetRevision: main
        path: 'deploy/overlays/{{cluster}}'
      destination:
        server: '{{url}}'
        namespace: sample`},
{h:'Multi-cluster'},
{ul:['Register clusters with Argo CD (or run an agent per cluster, as in Flux and the Argo CD agent model).','Use **cluster generators** so a new cluster automatically receives the standard platform apps.','Use **projects** to limit which repositories and destinations a team can use.','Roll out changes **progressively** across clusters, not all at once.']}],
src:[['ApplicationSet',K.ARGO+'operator-manual/applicationset/']]};

/* ---------- 9 ---------- */
L['devops:11:9']={blocks:[
{p:'Deploy the sample app with Argo CD from a config repository, then change something by hand and watch Argo CD correct it.'},
{flow:['Create a kind cluster and install Argo CD','Create the config repository with a base and a staging overlay','Create the Application with automated sync and self-heal','Open the UI and confirm Synced and Healthy','Change the replica count with kubectl','Watch Argo CD revert it']},
{code:`kind create cluster --name gitops
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Get the initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port forward the UI
kubectl -n argocd port-forward svc/argocd-server 8080:443

# Apply the Application, then cause drift
kubectl apply -f application.yaml
kubectl -n sample scale deploy/sample-app --replicas=5
kubectl -n sample get deploy sample-app -w   # returns to the Git value`},
{h:'Check yourself'},
{ul:['What was the sync and health status before and after the manual change?','What would happen without selfHeal?','How would you deliver the change you wanted properly?']}]};
})();
