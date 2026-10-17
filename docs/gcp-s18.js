/* LearnSphere - Google Cloud, Section 18: Exam Readiness & Practical Labs.
   Lectures 0-5 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const domains=K.dg(700,260,[
[10,10,680,240,'What the Associate Cloud Engineer exam covers',1],
[25,60,150,110,'Set up the|environment|projects, billing,|IAM, tools',0],[195,60,150,110,'Plan and|implement|compute, storage,|data, network',2],[365,60,150,110,'Operate|monitor, manage,|troubleshoot,|upgrade',0],[535,60,140,110,'Access and|security|IAM, service|accounts, keys',0],
[25,190,650,40,'Scenario questions: pick the simplest solution that meets the stated requirement',2]],
[]);

const lab1=K.dg(700,200,[
[10,10,680,180,'Lab 1: governed project',1],
[25,70,120,60,'Create|project',0],[170,70,120,60,'Link billing|and budget',0],[315,70,120,60,'Enable|APIs',0],[460,70,100,60,'Grant|group roles',2],[585,70,90,60,'Verify',0]],
[[145,100,170,100],[290,100,315,100],[435,100,460,100],[560,100,585,100]]);

const lab2=K.dg(700,260,[
[10,10,680,240,'Lab 2: private VM with outbound access',1],
[30,90,150,70,'Custom VPC|subnet 10.10.0.0/24',2],[230,90,130,70,'VM|no external IP',0],[410,90,110,70,'Cloud NAT|plus Router',2],[560,90,110,70,'Internet',0],
[230,190,290,40,'IAP tunnel SSH, firewall allows 35.235.240.0/20',0]],
[[180,125,230,125],[360,125,410,125],[520,125,560,125]]);

const lab3=K.dg(700,250,[
[10,10,680,230,'Lab 3: load balanced web tier',1],
[25,90,100,60,'Client',0],[150,90,140,60,'Global HTTP LB|URL map',2],[320,90,130,60,'Backend service|health check',0],[480,50,190,45,'MIG VM zone a',0],[480,110,190,45,'MIG VM zone b',0],[480,170,190,40,'Autoscaler',0]],
[[125,120,150,120],[290,120,320,120],[450,120,480,75],[450,130,480,130]]);

const lab4=K.dg(700,230,[
[10,10,680,210,'Lab 4: Cloud Run with Cloud SQL',1],
[25,80,110,60,'Source|code',0],[165,80,110,60,'Cloud Build|image',0],[305,80,130,60,'Cloud Run|service',2],[470,80,110,60,'Cloud SQL|private',2],[610,80,65,60,'Logs',0]],
[[135,110,165,110],[275,110,305,110],[435,110,470,110],[580,110,610,110]]);

/* ---------- 0 ---------- */
L['gcp:17:0']={blocks:[
{p:'The **Associate Cloud Engineer (ACE)** certification validates the skills of someone who deploys applications, monitors operations and manages enterprise solutions on Google Cloud. It is the natural target for this course. The course also covers broader architecture topics that help in real work.'},
{svg:domains},
{h:'Exam facts (check the current guide)'},
{t:[['Item','Typical detail'],
['Format','About 50 to 60 multiple-choice and multiple-select questions'],
['Duration','2 hours'],
['Delivery','Online proctored or at a test center, through an authorized test provider'],
['Prerequisites','None required. Google recommends 6 months or more of hands-on experience'],
['Validity','Certification is valid for 3 years, then renew by retaking the exam']]},
{p:'The official guide lists the sections and approximate weights. Read it before you book, because Google updates the blueprint from time to time.'},
{h:'Skills covered, mapped to this course'},
{t:[['Area','Course sections'],
['Setting up a cloud solution environment: organization, projects, billing, tools','1 and 2'],
['Planning and implementing: compute, storage, databases, networking, data solutions','4 to 12'],
['Ensuring successful operation: managing, monitoring, logging, troubleshooting','13 and 7 to 11'],
['Configuring access and security: IAM, service accounts, keys, encryption','3 and 14']]},
{h:'How scenario questions work'},
{ul:['They describe a business need, then ask for the **best** option.','Look for keywords: lowest cost, least operational effort, highest availability, least privilege, minimal change.','Prefer **managed and serverless** services when the requirement does not need control.','Prefer **predefined roles and groups**, **private connectivity** and **no service account keys** for security questions.','Rule out options that break a stated constraint first, then pick the simplest of the rest.']},
{h:'Study plan'},
{flow:['Read the exam guide and compare it to your gaps','Study each section and take its quiz','Do the four labs in this section in a free-trial project','Practise gcloud commands: know the group and verb patterns','Review the quick reference maps and comparison tables','Take a practice exam, review every wrong answer, then book the exam']},
{note:'Hands-on time matters more than memorizing. Many questions ask which command or console step achieves a task.'}],
src:[['Associate Cloud Engineer','https://cloud.google.com/learn/certification/cloud-engineer'],['Exam guide','https://cloud.google.com/learn/certification/guides/cloud-engineer']]};

/* ---------- 1 ---------- */
L['gcp:17:1']={blocks:[
{p:'**Goal:** go from an empty account to a project that is billed, budgeted and accessible to a group with least privilege. Estimated time: 30 minutes. Cost: none.'},
{svg:lab1},
{h:'Steps'},
{code:`# 1. Set variables
export PROJECT_ID=lab1-$RANDOM
export BILLING=$(gcloud billing accounts list --format="value(ACCOUNT_ID)" --limit=1)

# 2. Create the project and link billing
gcloud projects create $PROJECT_ID --name="Lab 1"
gcloud config set project $PROJECT_ID
gcloud billing projects link $PROJECT_ID --billing-account=$BILLING

# 3. Create a budget with alerts
gcloud billing budgets create --billing-account=$BILLING --display-name="Lab budget" \\
  --budget-amount=20USD --threshold-rule=percent=0.5 --threshold-rule=percent=1.0

# 4. Enable the APIs you need
gcloud services enable compute.googleapis.com storage.googleapis.com

# 5. Grant a group least-privilege access (replace the group)
gcloud projects add-iam-policy-binding $PROJECT_ID --member="group:lab-users@example.com" --role="roles/compute.viewer"

# 6. Add a label for cost tracking
gcloud projects update $PROJECT_ID --update-labels=env=lab,owner=me`},
{h:'Verify'},
{code:`gcloud projects describe $PROJECT_ID --format="yaml(labels,lifecycleState)"
gcloud billing projects describe $PROJECT_ID
gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --format="table(bindings.role, bindings.members)"
gcloud services list --enabled`},
{h:'What you practised'},
{ul:['Resource hierarchy basics and project IDs.','Billing account linking and budgets.','APIs and enabling services.','IAM bindings to groups and predefined roles.','Labels for cost allocation.']},
{h:'Stretch'},
{ul:['Create a custom role with only start and stop permissions and bind it.','Create a service account, grant it a role and impersonate it with `--impersonate-service-account`.','Turn on Data Access audit logs for Cloud Storage and read an entry.']},
{h:'Clean up'},
{code:`gcloud projects delete $PROJECT_ID`},
{note:'If your organization policy blocks creating projects or budgets, use a sandbox folder or ask an administrator to grant the roles in the IAM section.'}],
src:[['Creating projects',K.RM+'creating-managing-projects'],['Budgets',K.BILL+'budgets/set-budget']]};

/* ---------- 2 ---------- */
L['gcp:17:2']={blocks:[
{p:'**Goal:** build a custom VPC with a subnet, a VM without an external IP, SSH access through IAP, and outbound internet through Cloud NAT. Estimated time: 30 minutes. Cost: a few cents.'},
{svg:lab2},
{h:'Steps'},
{code:`export REGION=us-central1 ZONE=us-central1-a
# 1. Network and subnet
gcloud compute networks create lab-vpc --subnet-mode=custom
gcloud compute networks subnets create lab-subnet --network=lab-vpc --region=$REGION --range=10.10.0.0/24 --enable-private-ip-google-access

# 2. Firewall: allow SSH only from IAP
gcloud compute firewall-rules create lab-allow-iap-ssh --network=lab-vpc --direction=INGRESS --action=ALLOW \\
  --rules=tcp:22 --source-ranges=35.235.240.0/20

# 3. A VM without an external IP
gcloud compute instances create lab-vm --zone=$ZONE --machine-type=e2-small --subnet=lab-subnet --no-address \\
  --image-family=debian-12 --image-project=debian-cloud

# 4. Cloud Router and NAT
gcloud compute routers create lab-router --network=lab-vpc --region=$REGION
gcloud compute routers nats create lab-nat --router=lab-router --region=$REGION --auto-allocate-nat-external-ips --nat-all-subnet-ip-ranges --enable-logging`},
{h:'Verify'},
{code:`gcloud compute ssh lab-vm --zone=$ZONE --tunnel-through-iap --command="curl -sI https://www.google.com | head -1; hostname -I"
gcloud compute instances describe lab-vm --zone=$ZONE --format="value(networkInterfaces[0].accessConfigs)"   # empty: no external IP
gcloud network-management connectivity-tests create lab-test --source-instance=projects/$(gcloud config get-value project)/zones/$ZONE/instances/lab-vm --destination-ip-address=8.8.8.8 --destination-port=53 --protocol=UDP`},
{p:'You should see an HTTP response line from the VM, proving outbound access through Cloud NAT, while the VM has no external IP and no direct inbound path from the internet.'},
{h:'Troubleshooting'},
{t:[['Symptom','Check'],
['SSH times out','Firewall rule for 35.235.240.0/20, IAP API enabled, your user has IAP-secured Tunnel User role'],
['curl fails','NAT covers the subnet, router in the same region, egress firewall rules'],
['Cannot create VM','Compute API enabled, quota available, subnet in the same region']]},
{h:'What you practised'},
{ul:['Custom VPC and regional subnets.','Firewall rules with specific sources.','IAP TCP forwarding and private VMs.','Cloud Router and Cloud NAT.','Connectivity Tests.']},
{h:'Clean up'},
{code:`gcloud compute routers nats delete lab-nat --router=lab-router --region=$REGION -q
gcloud compute routers delete lab-router --region=$REGION -q
gcloud compute instances delete lab-vm --zone=$ZONE -q
gcloud compute firewall-rules delete lab-allow-iap-ssh -q
gcloud compute networks subnets delete lab-subnet --region=$REGION -q
gcloud compute networks delete lab-vpc -q`}],
src:[['Cloud NAT','https://cloud.google.com/nat/docs/set-up-manage-network-address-translation'],['IAP TCP forwarding','https://cloud.google.com/iap/docs/using-tcp-forwarding']]};

/* ---------- 3 ---------- */
L['gcp:17:3']={blocks:[
{p:'**Goal:** run a web server on a managed instance group in three zones, behind a global HTTP load balancer, with a health check and autoscaling. Estimated time: 40 minutes. Cost: low; delete when done.'},
{svg:lab3},
{h:'Steps'},
{code:`export REGION=us-central1
# 1. Firewall for health checks and traffic
gcloud compute firewall-rules create lab-allow-lb --network=default --direction=INGRESS --action=ALLOW \\
  --rules=tcp:80 --source-ranges=130.211.0.0/22,35.191.0.0/16 --target-tags=lab-web

# 2. Instance template with a startup script
gcloud compute instance-templates create lab-tpl --machine-type=e2-small --region=$REGION --tags=lab-web \\
  --image-family=debian-12 --image-project=debian-cloud \\
  --metadata=startup-script='#! /bin/bash
apt-get update && apt-get install -y nginx
echo "Served by $(hostname)" > /var/www/html/index.html'

# 3. Regional managed instance group with autoscaling and autohealing
gcloud compute health-checks create http lab-hc --port=80 --request-path=/
gcloud compute instance-groups managed create lab-mig --template=lab-tpl --size=2 --region=$REGION \\
  --health-check=lab-hc --initial-delay=120
gcloud compute instance-groups managed set-autoscaling lab-mig --region=$REGION --min-num-replicas=2 --max-num-replicas=5 --target-cpu-utilization=0.6
gcloud compute instance-groups set-named-ports lab-mig --region=$REGION --named-ports=http:80

# 4. Global HTTP load balancer
gcloud compute backend-services create lab-bes --global --protocol=HTTP --port-name=http --health-checks=lab-hc --load-balancing-scheme=EXTERNAL_MANAGED
gcloud compute backend-services add-backend lab-bes --global --instance-group=lab-mig --instance-group-region=$REGION
gcloud compute url-maps create lab-map --default-service=lab-bes
gcloud compute target-http-proxies create lab-proxy --url-map=lab-map
gcloud compute forwarding-rules create lab-fr --global --load-balancing-scheme=EXTERNAL_MANAGED --target-http-proxy=lab-proxy --ports=80`},
{h:'Verify'},
{code:`gcloud compute forwarding-rules describe lab-fr --global --format="value(IPAddress)"
for i in 1 2 3 4 5 6; do curl -s http://LB_IP/; done      # responses come from different hosts
gcloud compute backend-services get-health lab-bes --global`},
{p:'Wait a few minutes for the load balancer to program. Then stop one VM from the console and watch autohealing recreate it.'},
{h:'Troubleshooting'},
{t:[['Symptom','Check'],
['502 or no response','Backends unhealthy, firewall for health check ranges, startup script finished'],
['Only one host answers','Instances still starting, or session affinity set'],
['Quota errors','CPU or address quota in the region']]},
{h:'Clean up'},
{code:`gcloud compute forwarding-rules delete lab-fr --global -q
gcloud compute target-http-proxies delete lab-proxy -q
gcloud compute url-maps delete lab-map -q
gcloud compute backend-services delete lab-bes --global -q
gcloud compute instance-groups managed delete lab-mig --region=$REGION -q
gcloud compute health-checks delete lab-hc -q
gcloud compute instance-templates delete lab-tpl -q
gcloud compute firewall-rules delete lab-allow-lb -q`},
{note:'The default network is used here for simplicity. In real projects, use a custom VPC.'}],
src:[['Set up an external Application Load Balancer with a MIG',K.LB+'https/setting-up-https']]};

/* ---------- 4 ---------- */
L['gcp:17:4']={blocks:[
{p:'**Goal:** build and deploy a container to Cloud Run, connect it to a Cloud SQL database using a service account and a secret, and observe it in Logging. Estimated time: 45 minutes. Cost: low.'},
{svg:lab4},
{h:'Steps'},
{code:`export REGION=us-central1
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com

# 1. Database
gcloud sql instances create lab-db --database-version=POSTGRES_16 --region=$REGION --tier=db-f1-micro --edition=ENTERPRISE
gcloud sql databases create app --instance=lab-db
gcloud sql users create appuser --instance=lab-db --password="$(openssl rand -base64 18)"   # store this in Secret Manager next

# 2. Store the password
printf '%s' "THE_PASSWORD" | gcloud secrets create db-password --data-file=-

# 3. Service account with least privilege
gcloud iam service-accounts create lab-run-sa
SA=lab-run-sa@$(gcloud config get-value project).iam.gserviceaccount.com
gcloud projects add-iam-policy-binding $(gcloud config get-value project) --member="serviceAccount:$SA" --role="roles/cloudsql.client"
gcloud secrets add-iam-policy-binding db-password --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"

# 4. Deploy from source (a small app that reads DB_PASSWORD and connects through the Cloud SQL socket)
gcloud run deploy lab-api --source=. --region=$REGION --service-account=$SA \\
  --add-cloudsql-instances=$(gcloud config get-value project):$REGION:lab-db \\
  --set-secrets=DB_PASSWORD=db-password:latest --set-env-vars=DB_NAME=app,DB_USER=appuser \\
  --no-allow-unauthenticated`},
{h:'Verify'},
{code:`URL=$(gcloud run services describe lab-api --region=$REGION --format="value(status.url)")
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" $URL
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="lab-api"' --limit=10 --freshness=15m
gcloud run revisions list --service=lab-api --region=$REGION`},
{h:'Extend'},
{ul:['Deploy a second revision with `--no-traffic --tag=canary` and send 10 percent of traffic to it.','Add a log-based metric for errors and an alert policy.','Put a global load balancer with Cloud Armor in front using a serverless NEG.','Move the database to private IP and use Direct VPC egress.']},
{h:'Clean up'},
{code:`gcloud run services delete lab-api --region=$REGION -q
gcloud sql instances delete lab-db -q
gcloud secrets delete db-password -q
gcloud iam service-accounts delete $SA -q`},
{note:'Never put the password in an environment variable in your shell history in real work. Generate it, store it in Secret Manager and let the service read it.'}],
src:[['Cloud Run with Cloud SQL',K.RUN+'integrate/cloud-sql'],['Quickstart: deploy from source',K.RUN+'deploying-source-code']]};

/* ---------- 5 ---------- */
L['gcp:17:5']={blocks:[
{p:'This lesson is a one-page reminder of the commands and decisions that appear most often, both in daily work and in the exam.'},
{h:'gcloud command patterns'},
{t:[['Task','Command'],
['Project and config','gcloud config set project ID; gcloud config list; gcloud projects list'],
['IAM grant','gcloud projects add-iam-policy-binding ID --member=group:g@x.com --role=roles/viewer'],
['Service account','gcloud iam service-accounts create NAME; gcloud iam service-accounts list'],
['VM','gcloud compute instances create|list|stop|delete NAME --zone=Z'],
['SSH','gcloud compute ssh NAME --zone=Z --tunnel-through-iap'],
['Disk and snapshot','gcloud compute disks create|snapshot; gcloud compute snapshots list'],
['Network','gcloud compute networks|subnets|firewall-rules|routes create|list'],
['Storage','gcloud storage cp|ls|rm|rsync; gcloud storage buckets create'],
['GKE','gcloud container clusters create-auto|get-credentials; kubectl get|apply'],
['Cloud Run','gcloud run deploy NAME --image=IMG --region=R'],
['Cloud SQL','gcloud sql instances create|patch|backups create'],
['BigQuery','bq query --use_legacy_sql=false; bq load; bq mk'],
['Pub/Sub','gcloud pubsub topics|subscriptions create|publish|pull'],
['Logs','gcloud logging read FILTER --limit=N'],
['Enable API','gcloud services enable X.googleapis.com']]},
{h:'Decision cheat sheet'},
{t:[['If the requirement says','Think'],
['Least operational effort, containers, HTTP','Cloud Run'],
['Kubernetes needed','GKE (Autopilot first)'],
['Full OS control or lift and shift','Compute Engine'],
['Global relational, strong consistency','Spanner'],
['Standard relational app','Cloud SQL'],
['Huge key-value or time series','Bigtable'],
['Documents and mobile','Firestore'],
['SQL analytics on big data','BigQuery'],
['Decouple with messages','Pub/Sub'],
['Cheap archive','Cloud Storage Coldline or Archive, or Autoclass'],
['Private VM needs internet','Cloud NAT'],
['Private VM needs Google APIs','Private Google Access'],
['SSH to private VM','IAP TCP forwarding'],
['Connect on-premises quickly with encryption','HA VPN'],
['High-bandwidth private link','Interconnect'],
['Share a network across projects','Shared VPC'],
['Stop data leaving projects','VPC Service Controls'],
['Block web attacks','Cloud Armor'],
['Keys under your control','Cloud KMS CMEK'],
['Store passwords','Secret Manager'],
['Avoid service account keys','Attached SA, impersonation, Workload Identity Federation']]},
{h:'Habits that prevent errors'},
{ul:['Check the active project and zone before running commands.','Prefer groups and predefined roles; avoid basic roles.','Use regional resources for high availability.','Label resources and set budgets early.','Clean up lab resources: load balancers, disks, IPs and clusters bill while idle.']},
{note:'Use the Quick Reference for key concepts, maps and troubleshooting. It is designed for fast revision before an exam or a design review.'}],
src:[['gcloud reference','https://cloud.google.com/sdk/gcloud/reference'],['Google Cloud for exam prep','https://cloud.google.com/learn/certification/cloud-engineer']]};
})();
