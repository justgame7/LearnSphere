/* LearnSphere - Google Cloud, Section 15: DevOps, CI/CD & Infrastructure as Code.
   Lectures 0-6 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const pipe=K.dg(700,220,[
[10,10,680,200,'Delivery pipeline on Google Cloud',1],
[20,70,100,60,'Source|GitHub, GitLab',0],[140,70,110,60,'Cloud Build|build, test',2],[270,70,120,60,'Artifact|Registry|images, packages',2],[410,70,110,60,'Cloud Deploy|promotion',2],[540,70,130,60,'Run: GKE,|Cloud Run, VMs',0]],
[[120,100,140,100],[250,100,270,100],[390,100,410,100],[520,100,540,100]]);

const cd=K.dg(700,230,[
[10,10,680,210,'Cloud Deploy progression',1],
[30,80,110,60,'Release|image, YAML',0],[180,80,110,60,'Dev target|auto rollout',0],[330,80,120,60,'Staging target|verify',0],[490,80,180,60,'Prod target|approval, canary',2]],
[[140,110,180,110],[290,110,330,110],[450,110,490,110]]);

const tf=K.dg(700,230,[
[10,10,680,210,'Terraform workflow',1],
[30,80,110,60,'Write .tf|code',0],[170,80,110,60,'terraform|init',0],[310,80,110,60,'terraform|plan',2],[450,80,110,60,'terraform|apply',2],[590,80,80,60,'State in|GCS',0]],
[[140,110,170,110],[280,110,310,110],[420,110,450,110],[560,110,590,110]]);

/* ---------- 0 ---------- */
L['gcp:14:0']={blocks:[
{p:'**DevOps** joins development and operations so software is built, tested and released in small, frequent, automated steps. A **CI/CD pipeline** (continuous integration and continuous delivery) turns a code commit into a running release without manual copying.'},
{svg:pipe},
{h:'Stages and Google Cloud services'},
{t:[['Stage','Goal','Service'],
['Source','Version control and review','GitHub, GitLab, Bitbucket (Cloud Source Repositories is closed to new customers)'],
['Build and test','Compile, test, scan, build an image','Cloud Build'],
['Store artifacts','Keep images and packages with scanning','Artifact Registry'],
['Deliver','Promote releases through environments','Cloud Deploy'],
['Run','Operate the app','GKE, Cloud Run, Compute Engine, App Engine'],
['Provision infrastructure','Create environments from code','Terraform, Infrastructure Manager'],
['Observe','Monitor, alert and learn','Cloud Monitoring, Logging, Trace']]},
{h:'Principles'},
{ul:['**Everything as code**: application, pipeline and infrastructure live in version control.','**Small changes** merge often and are tested automatically.','**Same artifact** moves through environments. Do not rebuild for production.','**Fast feedback** and **safe rollback**: deploy gradually and watch metrics.','**Least privilege** pipelines: use dedicated service accounts and no long-lived keys.']},
{h:'DORA metrics'},
{p:'Google\'s DevOps Research and Assessment (DORA) identified four measures of delivery performance: **deployment frequency**, **lead time for changes**, **change failure rate** and **time to restore service**. Track them to see if improvements work.'},
{note:'Choose managed Google services where you can. Many teams also keep Jenkins, GitHub Actions or GitLab CI and deploy to Google Cloud with Workload Identity Federation instead of keys.'}],
src:[['DevOps on Google Cloud','https://cloud.google.com/devops'],['DORA research','https://dora.dev/']]};

/* ---------- 1 ---------- */
L['gcp:14:1']={blocks:[
{p:'**Artifact Registry** is the managed place to store build artifacts: container images and language packages. It replaces Container Registry (gcr.io), which was shut down in 2025.'},
{h:'What it stores'},
{t:[['Format','Examples'],
['Docker / OCI','Container images and Helm charts'],
['Maven / Gradle','Java packages'],
['npm','Node.js packages'],
['Python','pip packages'],
['Apt / Yum','Operating system packages'],
['Go, generic','Go modules and arbitrary files']]},
{h:'Repository types'},
{ul:['**Standard** repositories hold your own artifacts.','**Remote** repositories cache and proxy public sources like Docker Hub or PyPI, so builds are faster and more predictable.','**Virtual** repositories combine several repositories behind one endpoint.']},
{code:`gcloud artifacts repositories create apps --repository-format=docker --location=us-central1 --description="App images"
gcloud auth configure-docker us-central1-docker.pkg.dev
docker build -t us-central1-docker.pkg.dev/my-project/apps/web:1.0 .
docker push us-central1-docker.pkg.dev/my-project/apps/web:1.0
gcloud artifacts docker images list us-central1-docker.pkg.dev/my-project/apps
gcloud artifacts repositories add-iam-policy-binding apps --location=us-central1 --member="serviceAccount:gke-nodes@my-project.iam.gserviceaccount.com" --role="roles/artifactregistry.reader"`},
{p:'The image path is `LOCATION-docker.pkg.dev/PROJECT/REPOSITORY/IMAGE:TAG`.'},
{h:'Security and hygiene'},
{ul:['Roles: **Reader** to pull, **Writer** to push, **Administrator** to manage repositories.','Enable **vulnerability scanning**. Images are scanned on push and rescanned as new CVEs appear.','Use **cleanup policies** to delete old versions and untagged images automatically.','Use immutable tags or digests for production deployments.','Encrypt with CMEK where policy requires.']},
{note:'Keep the registry in the same region as the cluster or Cloud Run service to cut pull time and egress cost.'}],
src:[['Artifact Registry','https://cloud.google.com/artifact-registry/docs/overview'],['Cleanup policies','https://cloud.google.com/artifact-registry/docs/repositories/cleanup-policy']]};

/* ---------- 2 ---------- */
L['gcp:14:2']={blocks:[
{p:'**Cloud Build** is a serverless CI/CD service. It runs your build as a series of **steps**, each in a container, on Google-managed workers. You pay for build time.'},
{h:'A build config'},
{code:`# cloudbuild.yaml
steps:
- id: test
  name: python:3.12
  entrypoint: bash
  args: ["-c", "pip install -r requirements.txt && pytest"]
- id: build
  name: gcr.io/cloud-builders/docker
  args: ["build", "-t", "us-central1-docker.pkg.dev/$PROJECT_ID/apps/web:$SHORT_SHA", "."]
- id: push
  name: gcr.io/cloud-builders/docker
  args: ["push", "us-central1-docker.pkg.dev/$PROJECT_ID/apps/web:$SHORT_SHA"]
- id: deploy
  name: gcr.io/google.com/cloudsdktool/cloud-sdk
  entrypoint: gcloud
  args: ["run", "deploy", "web", "--image=us-central1-docker.pkg.dev/$PROJECT_ID/apps/web:$SHORT_SHA", "--region=us-central1"]
images: ["us-central1-docker.pkg.dev/$PROJECT_ID/apps/web:$SHORT_SHA"]
options: {logging: CLOUD_LOGGING_ONLY}`},
{ul:['Steps share a `/workspace` directory, so one step can use files made by another.','**Substitutions** such as `$PROJECT_ID`, `$COMMIT_SHA`, `$SHORT_SHA`, `$BRANCH_NAME` insert values at run time.','Secrets come from Secret Manager through `availableSecrets` and `secretEnv`.']},
{h:'Run and trigger'},
{code:`gcloud builds submit --config=cloudbuild.yaml .
gcloud builds submit --tag us-central1-docker.pkg.dev/my-project/apps/web:dev .     # build from a Dockerfile
gcloud builds triggers create github --name=web-main --repo-name=web --repo-owner=my-org --branch-pattern="^main$" --build-config=cloudbuild.yaml \\
  --service-account=projects/my-project/serviceAccounts/builder@my-project.iam.gserviceaccount.com
gcloud builds list --limit=5
gcloud builds log BUILD_ID`},
{h:'Triggers'},
{t:[['Trigger on','Use'],
['Push to a branch or tag','Build and deploy after merges'],
['Pull request','Run tests before merge'],
['Manual or webhook','Controlled or external triggers'],
['Pub/Sub message','Event-driven builds']]},
{h:'Permissions and speed'},
{ul:['Run builds with a **user-specified service account** that has only the roles it needs (push to Artifact Registry, deploy to Cloud Run).','Use **private pools** to build inside a VPC or reach private resources.','Use caching and larger machine types for speed.','Generate provenance for supply chain security.']},
{note:'The default Cloud Build account historically had broad permissions. Use a dedicated account to avoid giving builds more power than needed.'}],
src:[['Cloud Build','https://cloud.google.com/build/docs/overview'],['Build configuration','https://cloud.google.com/build/docs/build-config-file-schema']]};

/* ---------- 3 ---------- */
L['gcp:14:3']={blocks:[
{p:'**Cloud Deploy** is a managed continuous delivery service. It promotes the same release through a sequence of environments to GKE, Cloud Run or other targets, with approvals, canary strategies and rollbacks.'},
{svg:cd},
{h:'Concepts'},
{t:[['Term','Meaning'],
['Delivery pipeline','The ordered stages, for example dev, staging, prod'],
['Target','An environment: a GKE cluster, Cloud Run region or similar'],
['Release','An immutable set of images and rendered manifests created from a build'],
['Rollout','The deployment of a release to one target'],
['Promotion','Moving a release to the next target'],
['Approval','A required manual decision before a rollout']]},
{code:`# clouddeploy.yaml
apiVersion: deploy.cloud.google.com/v1
kind: DeliveryPipeline
metadata: {name: web-pipeline}
serialPipeline:
  stages:
  - targetId: dev
  - targetId: staging
  - targetId: prod
    strategy:
      canary:
        runtimeConfig:
          cloudRun: {automaticTrafficControl: true}
        canaryDeployment: {percentages: [10, 50]}
---
apiVersion: deploy.cloud.google.com/v1
kind: Target
metadata: {name: prod}
requireApproval: true
run: {location: projects/my-project/locations/us-central1}`},
{code:`gcloud deploy apply --file=clouddeploy.yaml --region=us-central1
gcloud deploy releases create rel-001 --delivery-pipeline=web-pipeline --region=us-central1 --images=web=us-central1-docker.pkg.dev/my-project/apps/web:abc123
gcloud deploy releases promote --release=rel-001 --delivery-pipeline=web-pipeline --region=us-central1
gcloud deploy rollouts list --release=rel-001 --delivery-pipeline=web-pipeline --region=us-central1`},
{h:'Why use it'},
{ul:['Same artifact through every environment, with a clear audit trail.','Progressive delivery with canary and verification steps.','One-click rollback to a previous release.','Cloud Build builds. Cloud Deploy delivers. They connect through a release created at the end of a build.']},
{note:'Cloud Deploy uses Skaffold to render and deploy manifests. You describe how in a skaffold.yaml alongside your Kubernetes or Cloud Run manifests.'}],
src:[['Cloud Deploy','https://cloud.google.com/deploy/docs/overview'],['Canary deployments','https://cloud.google.com/deploy/docs/deployment-strategies/canary']]};

/* ---------- 4 ---------- */
L['gcp:14:4']={blocks:[
{p:'**Infrastructure as Code (IaC)** describes infrastructure in files you review and run. **Terraform** is the most widely used IaC tool for Google Cloud. It declares desired resources, compares them with reality and applies the difference.'},
{svg:tf},
{h:'A first configuration'},
{code:`terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
  backend "gcs" {
    bucket = "my-tf-state"
    prefix = "network"
  }
}

provider "google" {
  project = "my-project"
  region  = "us-central1"
}

resource "google_compute_network" "vpc" {
  name                    = "prod-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "web" {
  name          = "web-us"
  region        = "us-central1"
  network       = google_compute_network.vpc.id
  ip_cidr_range = "10.10.0.0/24"
}

resource "google_storage_bucket" "assets" {
  name                        = "my-assets-12345"
  location                    = "US"
  uniform_bucket_level_access = true
}`},
{code:`terraform init
terraform fmt && terraform validate
terraform plan -out=tfplan
terraform apply tfplan
terraform destroy`},
{h:'State and backends'},
{ul:['Terraform records what it manages in a **state file**. Store it remotely in a **Cloud Storage bucket** with versioning enabled. The GCS backend provides locking.','Protect the state bucket. State can contain sensitive values.','Use separate state for separate environments.']},
{h:'Authentication'},
{ul:['Locally: `gcloud auth application-default login`, or impersonate a service account.','In CI: Workload Identity Federation, with no downloaded keys.','Give the Terraform identity only the roles it needs.']},
{h:'Practices'},
{ul:['Keep reusable **modules** (Google publishes Cloud Foundation Toolkit modules).','Review `plan` output in pull requests before apply.','Import existing resources with `terraform import` or config-driven import blocks.','Avoid manual console changes that cause drift.']},
{note:'Terraform and OpenTofu use the same language for most purposes. See the Terraform course in LearnSphere for a full treatment.'}],
src:[['Terraform on Google Cloud','https://cloud.google.com/docs/terraform'],['Google provider','https://registry.terraform.io/providers/hashicorp/google/latest/docs']]};

/* ---------- 5 ---------- */
L['gcp:14:5']={blocks:[
{p:'Terraform is not the only way to declare infrastructure on Google Cloud. Several Google tools relate to it. Knowing which are current avoids picking a retired one.'},
{h:'Options'},
{t:[['Tool','What it is','Status and use'],
['Infrastructure Manager','Managed service that runs Terraform for you. You supply configurations from Git or Cloud Storage, and it creates deployments, previews and revisions','Current. Good when you want Google to run Terraform without your own runners'],
['Terraform (self-run)','Open source CLI in your pipeline','Most common'],
['Config Connector','Kubernetes add-on that manages Google Cloud resources as Kubernetes objects (CRDs)','Current. Useful for teams that already manage everything with kubectl and GitOps'],
['Config Controller / Config Sync','Managed Kubernetes control plane for IaC and GitOps sync of manifests from Git','Part of GKE Enterprise'],
['Deployment Manager','Google\'s older YAML/Jinja template service','Reaching end of support. Migrate to Terraform or Infrastructure Manager']]},
{h:'Infrastructure Manager example'},
{code:`gcloud infra-manager deployments apply projects/my-project/locations/us-central1/deployments/network \\
  --service-account=projects/my-project/serviceAccounts/tf-runner@my-project.iam.gserviceaccount.com \\
  --git-source-repo=https://github.com/my-org/infra --git-source-directory=network --git-source-ref=main \\
  --input-values=project_id=my-project
gcloud infra-manager previews create prev-1 --location=us-central1 --service-account=projects/my-project/serviceAccounts/tf-runner@my-project.iam.gserviceaccount.com --git-source-repo=https://github.com/my-org/infra`},
{h:'Config Connector example'},
{code:`apiVersion: storage.cnrm.cloud.google.com/v1beta1
kind: StorageBucket
metadata:
  name: team-assets-123
spec:
  location: US
  uniformBucketLevelAccess: true`},
{h:'Choosing'},
{flow:['Do you use Kubernetes GitOps for everything? Consider Config Connector','Do you want managed Terraform execution? Use Infrastructure Manager','Otherwise run Terraform in Cloud Build or your CI with remote state','Migrate any remaining Deployment Manager templates']},
{note:'Whatever tool you choose, keep a single source of truth and prevent changes outside it with permissions and organization policy.'}],
src:[['Infrastructure Manager','https://cloud.google.com/infrastructure-manager/docs/overview'],['Config Connector','https://cloud.google.com/config-connector/docs/overview']]};

/* ---------- 6 ---------- */
L['gcp:14:6']={blocks:[
{p:'Developers work faster with good tools. Google Cloud offers a browser-based editor and IDE plugins so building, running and debugging cloud applications feels local.'},
{h:'Tools'},
{t:[['Tool','Description'],
['Cloud Shell Editor','A Code OSS-based editor in the browser with a terminal, preview and Google Cloud integrations. Zero setup'],
['Cloud Code','Plugins for VS Code, IntelliJ and others: create projects from templates, run and debug on local or remote Kubernetes and Cloud Run, browse resources'],
['Gemini Code Assist','AI assistance for code generation, explanation and review in IDEs and Google Cloud consoles'],
['Skaffold','Command line tool that builds, pushes and deploys on every code change; used by Cloud Code and Cloud Deploy'],
['Client libraries and Application Default Credentials','Call Google Cloud APIs from code with automatic authentication'],
['Emulators','Local emulators for Pub/Sub, Firestore, Bigtable, Spanner and Datastore to test without cloud cost']]},
{h:'Local development with credentials'},
{code:`gcloud auth application-default login           # libraries find these credentials automatically
gcloud beta emulators pubsub start --project=local-dev
export PUBSUB_EMULATOR_HOST=localhost:8085
skaffold dev                                   # build, deploy and watch for changes`},
{h:'Client library example'},
{code:`from google.cloud import storage
client = storage.Client()                      # uses Application Default Credentials
for blob in client.list_blobs("my-bucket", prefix="reports/"):
    print(blob.name)`},
{h:'A healthy developer workflow'},
{flow:['Write code in the IDE with Cloud Code and local emulators','Run unit tests locally and in Cloud Build','Deploy to a personal or dev project using the same pipeline','Open a pull request that triggers tests and a plan','Merge, and let the pipeline promote the release']},
{note:'Developers should have a sandbox project with a budget, not production access. Production changes should go only through the pipeline.'}],
src:[['Cloud Code','https://cloud.google.com/code'],['Gemini Code Assist','https://cloud.google.com/products/gemini/code-assist'],['Skaffold','https://skaffold.dev/docs/']]};
})();
