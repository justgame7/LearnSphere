/* LearnSphere - Azure Administrator, Section 10: Containers & App Service for Administrators.
   Lectures 0-10 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const choose=K.dg(700,260,[
[10,10,680,240,'From least to most control',1],
[25,70,150,100,'App Service|code or container|web apps',0],[190,70,150,100,'Container Apps|serverless containers|scale to zero',2],[355,70,150,100,'Container Instances|run a container fast|no orchestration',0],[520,70,150,100,'AKS|full Kubernetes|you operate the cluster',0]],
[[175,120,190,120],[340,120,355,120],[505,120,520,120]]);

const plan=K.dg(700,240,[
[10,10,680,220,'App Service plan shares compute',1],
[30,60,200,130,'App Service plan|region, OS, size,|instance count',2],
[290,50,180,40,'Web app A',0],[290,100,180,40,'Web app B',0],[290,150,180,40,'Function app',0],
[520,70,150,100,'You pay for the|plan, not per app',0]],
[[230,125,290,70],[230,125,290,120],[230,125,290,170],[470,120,520,120]]);

const slot=K.dg(700,200,[
[10,10,680,180,'Swap slots with little downtime',1],
[30,60,150,70,'Staging slot|new version warmed up',0],[270,60,150,70,'Swap|exchange routing',2],[510,60,160,70,'Production slot|now serves new version',0]],
[[180,95,270,95],[420,95,510,95]]);

/* ---------- 0 ---------- */
L['az:9:0']={blocks:[
{p:'Azure offers several ways to run a container or a web application. As an administrator you choose based on **how much you want to operate** and what the workload needs.'},
{svg:choose},
{t:[['Service','What it is','Choose when'],
['**App Service**','Managed web hosting for code or a container','Web apps and APIs, minimal operations'],
['**Container Apps**','Serverless platform for microservices and jobs, based on Kubernetes and KEDA','Many containers, event-driven scale, scale to zero, no cluster work'],
['**Container Instances (ACI)**','Run a container or small group without servers or orchestration','Burst tasks, simple jobs, quick tests'],
['**AKS**','Managed Kubernetes control plane, you manage the nodes','Full Kubernetes API and ecosystem needed']]},
{h:'Quick decisions'},
{ul:['One web app and a database: **App Service**.','A set of microservices with HTTP and queue scaling: **Container Apps**.','A batch container that runs for minutes: **ACI** or Container Apps jobs.','You already run Kubernetes and need its tools: **AKS**.']},
{note:'Images for all of these come from a registry. Azure Container Registry (next lecture) is the common choice.'}],
src:[['Choose an Azure compute service',K.D+'architecture/guide/technology-choices/compute-decision-tree'],['Compare container options',K.D+'container-apps/compare-options']]};

/* ---------- 1 ---------- */
L['az:9:1']={blocks:[
{p:'**Azure Container Registry (ACR)** is a private registry for container images and related artifacts. Services such as ACI, Container Apps, App Service and AKS pull from it.'},
{h:'SKUs'},
{t:[['SKU','Highlights'],
['**Basic**','Entry level, development and learning'],
['**Standard**','More storage and throughput for production'],
['**Premium**','Geo-replication, private link, zone redundancy, customer-managed keys, content trust']]},
{h:'Authentication'},
{t:[['Method','Notes'],
['**Entra user or group with RBAC**','Roles AcrPull, AcrPush, AcrDelete. Preferred for people'],
['**Managed identity**','Best for Azure services pulling images'],
['**Service principal**','For CI/CD systems, prefer federated credentials'],
['**Repository-scoped tokens**','Limited access for external clients'],
['**Admin user**','Single shared account. Keep disabled']]},
{code:`az acr create -g rg-acr -n acrdemo001 --sku Standard
az acr login -n acrdemo001
docker tag app:1.0 acrdemo001.azurecr.io/app:1.0
docker push acrdemo001.azurecr.io/app:1.0
az acr repository list -n acrdemo001 -o table
az role assignment create --assignee <mi-principal-id> --role AcrPull --scope $(az acr show -n acrdemo001 --query id -o tsv)`},
{note:'The registry name becomes a DNS name, so it must be globally unique, 5-50 alphanumeric characters.'}],
src:[['Azure Container Registry',K.D+'container-registry/container-registry-intro'],['Authentication options',K.D+'container-registry/container-registry-authentication']]};

/* ---------- 2 ---------- */
L['az:9:2']={blocks:[
{p:'**Azure Container Instances (ACI)** runs containers in Azure without managing virtual machines. The unit is a **container group**: one or more containers on the same host that share network and storage.'},
{h:'Key settings'},
{t:[['Setting','Notes'],
['**CPU and memory**','Specified per container, billed per second'],
['**OS type**','Linux or Windows'],
['**Networking**','Public IP with DNS name label, or a private IP in a virtual network'],
['**Restart policy**','Always, OnFailure or Never'],
['**Volumes**','Azure Files share, emptyDir, secret, git repo'],
['**Identity**','Managed identity to pull images and reach resources']]},
{h:'Restart policy'},
{t:[['Policy','Behavior','Use'],
['**Always**','Restart whenever it stops','Long-running service'],
['**OnFailure**','Restart only on non-zero exit','Tasks that should retry'],
['**Never**','Run once','One-off job']]},
{code:`az container create -g rg-aci -n aci-web --image mcr.microsoft.com/azuredocs/aci-helloworld --cpu 1 --memory 1.5 --dns-name-label aci-web-demo --ports 80 --restart-policy Always
az container show -g rg-aci -n aci-web --query "{state:instanceView.state,fqdn:ipAddress.fqdn}" -o json
az container logs -g rg-aci -n aci-web
az container delete -g rg-aci -n aci-web --yes`},
{note:'ACI is billed while the group runs. A container that exits with restart policy Never stops billing for compute.'}],
src:[['Container Instances overview',K.D+'container-instances/container-instances-overview']]};

/* ---------- 3 ---------- */
L['az:9:3']={blocks:[
{p:'**Azure Container Apps** runs containerized applications on a serverless platform. You manage apps, not Kubernetes nodes.'},
{h:'Building blocks'},
{t:[['Concept','Meaning'],
['**Environment**','Secure boundary around apps: shared network, logging and settings'],
['**Container app**','A deployable service with containers, scale rules and ingress'],
['**Revision**','An immutable snapshot of a version of the app'],
['**Replica**','A running instance of a revision'],
['**Ingress**','HTTP or TCP entry point, external or internal']]},
{h:'Revisions'},
{ul:['**Single revision mode**: new revisions replace the old.','**Multiple revision mode**: several run at once, with traffic split by percentage, for blue-green and canary.','Changes to the container template create a new revision, while scale-rule-only changes do not.']},
{code:`az containerapp env create -g rg-ca -n env-demo -l westeurope
az containerapp create -g rg-ca -n app-web --environment env-demo --image mcr.microsoft.com/k8se/quickstart:latest --target-port 80 --ingress external --min-replicas 0 --max-replicas 5
az containerapp revision list -g rg-ca -n app-web -o table
az containerapp ingress traffic set -g rg-ca -n app-web --revision-weight app-web--v1=80 app-web--v2=20`},
{h:'Ingress choices'},
{t:[['Setting','Result'],
['External','Reachable from the internet (or the environment network edge)'],
['Internal','Reachable only inside the environment virtual network'],
['Disabled','No inbound, for background workers']]}],
src:[['Azure Container Apps overview',K.D+'container-apps/overview'],['Revisions',K.D+'container-apps/revisions']]};

/* ---------- 4 ---------- */
L['az:9:4']={blocks:[
{p:'Both ACI and Container Apps need to be **sized** and, for Container Apps, **scaled**.'},
{h:'Sizing'},
{t:[['Service','How CPU and memory are set','Notes'],
['**ACI**','Per container, in vCPU and GB','A group has total limits per region'],
['**Container Apps**','Per container, from allowed combinations','Combined limits per replica'],
['**Workload profiles**','Dedicated or consumption profiles in an environment','Choose for larger sizes or GPUs']]},
{h:'Scale rules in Container Apps'},
{t:[['Trigger','Example'],
['**HTTP concurrency**','Add replicas per number of concurrent requests'],
['**TCP connections**','Based on connections'],
['**Custom KEDA scalers**','Queue length, event hub lag, cron, CPU, memory']]},
{code:`az containerapp update -g rg-ca -n app-web --min-replicas 1 --max-replicas 10 --scale-rule-name http-rule --scale-rule-type http --scale-rule-http-concurrency 50`},
{h:'Key points'},
{ul:['**Minimum replicas 0** saves cost but causes a cold start on the first request.','Set **minimum 1** for latency-sensitive services.','Set a **maximum** to cap cost and protect dependencies.','ACI does not autoscale. Create more groups or move to Container Apps.']},
{note:'Scale on the signal that best predicts load. Queue length is usually better than CPU for background workers.'}],
src:[['Scaling in Container Apps',K.D+'container-apps/scale-app']]};

/* ---------- 5 ---------- */
L['az:9:5']={blocks:[
{p:'**App Service** hosts web apps, REST APIs and mobile backends without managing servers. Two resources matter: the **App Service plan** and the **app**.'},
{svg:plan},
{h:'The plan'},
{p:'The plan defines the **region, operating system and size** of the compute, and how many instances run. Every app in a plan shares those resources, and you pay for the plan.'},
{h:'Tiers'},
{t:[['Tier','For','Notable features'],
['**Free / Shared**','Learning and tests','Shared compute, limited, no SLA'],
['**Basic**','Dev and test','Dedicated instances, manual scale'],
['**Standard**','Production','Autoscale, deployment slots, backups'],
['**Premium v3 / v4**','Higher performance','More memory and scale, zones, more slots'],
['**Isolated v2**','Isolation and compliance','Dedicated environment in your VNet']]},
{h:'App settings'},
{ul:['**Application settings** become environment variables.','**Connection strings** are managed settings for databases.','**Slot settings** can be marked sticky so they do not move on a swap.','Reference **Key Vault secrets** from settings instead of storing them.']},
{code:`az appservice plan create -g rg-web -n plan-web --sku S1 --is-linux
az webapp create -g rg-web -p plan-web -n webapp-demo-001 --runtime "NODE:20-lts"
az webapp config appsettings set -g rg-web -n webapp-demo-001 --settings ENV=prod
az webapp config set -g rg-web -n webapp-demo-001 --always-on true --min-tls-version 1.2`}],
src:[['App Service overview',K.APP+'overview'],['App Service plans',K.APP+'overview-hosting-plans']]};

/* ---------- 6 ---------- */
L['az:9:6']={blocks:[
{p:'You can add capacity to an App Service plan in two ways.'},
{t:[['Type','What changes','How'],
['**Scale up** (vertical)','The size or tier of each instance','Change the plan SKU, for example S1 to P1v3'],
['**Scale out** (horizontal)','The number of instances','Manual count or autoscale rules']]},
{h:'Autoscale'},
{ul:['Available from the **Standard** tier up.','Rules use metrics such as CPU percentage, memory or HTTP queue length, or a schedule.','Always keep **minimum**, **maximum** and **default** counts.','Rules apply to the **plan**, so all apps in it scale together.']},
{code:`az appservice plan update -g rg-web -n plan-web --sku P1v3
az appservice plan update -g rg-web -n plan-web --number-of-workers 3
az monitor autoscale create -g rg-web --resource plan-web --resource-type Microsoft.Web/serverfarms --name auto-web --min-count 2 --max-count 6 --count 2
az monitor autoscale rule create -g rg-web --autoscale-name auto-web --condition "CpuPercentage > 70 avg 10m" --scale out 1`},
{note:'If an app has local state or in-memory session data, scaling out breaks it. Make apps stateless or use a shared store.'}],
src:[['Scale up an app',K.APP+'manage-scale-up'],['Scale out',K.APP+'manage-automatic-scaling']]};

/* ---------- 7 ---------- */
L['az:9:7']={blocks:[
{p:'To serve an app on your own domain name, you bind a **custom domain**, add a **certificate** and enforce **HTTPS**.'},
{flow:['Create a DNS record at your DNS provider','Verify domain ownership with a TXT record','Add the custom domain to the app','Add a certificate and create a TLS binding','Turn on HTTPS only and a minimum TLS version']},
{h:'DNS records'},
{t:[['Name','Record','Value'],
['`www`','CNAME','`<app>.azurewebsites.net`'],
['`asuid.www`','TXT','Domain verification ID of the app'],
['Apex `@`','A','App inbound IP address'],
['`asuid`','TXT','Domain verification ID']]},
{h:'Certificates'},
{t:[['Option','Notes'],
['**App Service managed certificate**','Free, auto-renewed, for subdomains and root domains with limits'],
['**App Service certificate**','Purchased through Azure'],
['**Key Vault certificate**','Import or reference a certificate in Key Vault'],
['**Uploaded .pfx**','You manage renewal']]},
{code:`az webapp config hostname add -g rg-web --webapp-name webapp-demo-001 --hostname www.contoso.com
az webapp update -g rg-web -n webapp-demo-001 --https-only true
az webapp config set -g rg-web -n webapp-demo-001 --min-tls-version 1.2`},
{note:'Custom domains need a paid dedicated tier at minimum. Verify DNS propagation before adding the binding.'}],
src:[['Map a custom domain',K.APP+'app-service-web-tutorial-custom-domain'],['Secure with TLS',K.APP+'configure-ssl-bindings']]};

/* ---------- 8 ---------- */
L['az:9:8']={blocks:[
{p:'App Service has separate controls for **inbound** and **outbound** traffic.'},
{t:[['Feature','Direction','What it does'],
['**Access restrictions**','Inbound','Allow or deny by IP, service tag or subnet'],
['**Private endpoint**','Inbound','Gives the app a private IP in your VNet and disables public path'],
['**VNet integration**','Outbound','Lets the app reach resources in or through a VNet'],
['**Service endpoints**','Inbound to PaaS','Restrict a back-end service to the integration subnet']]},
{h:'Typical private design'},
{flow:['Integrate the app with a delegated subnet for outbound calls','Create private endpoints for the database and storage','Use private DNS zones so names resolve to private IPs','Put a private endpoint or access restrictions on the app itself','Block public network access where possible']},
{code:`az webapp vnet-integration add -g rg-web -n webapp-demo-001 --vnet vnet-app --subnet snet-integration
az webapp config access-restriction add -g rg-web -n webapp-demo-001 --rule-name office --action Allow --ip-address 203.0.113.0/24 --priority 100
az network private-endpoint create -g rg-web -n pe-web --vnet-name vnet-app --subnet snet-pe --private-connection-resource-id $(az webapp show -g rg-web -n webapp-demo-001 --query id -o tsv) --group-id sites --connection-name pe-web-conn`},
{note:'The integration subnet must be dedicated and delegated to Microsoft.Web/serverFarms. VNet integration does not make the app reachable privately, a private endpoint does.'}],
src:[['App Service networking features',K.APP+'networking-features'],['VNet integration',K.APP+'overview-vnet-integration']]};

/* ---------- 9 ---------- */
L['az:9:9']={blocks:[
{p:'**Backups** protect app content and configuration, and **deployment slots** let you test a new version live and swap it in with little downtime.'},
{h:'Backups'},
{ul:['Backup stores app files, configuration and optionally a linked database in a **storage account** container.','Can be **scheduled** or run on demand.','Restore overwrites the app or goes to a new app or slot.','Backup availability depends on tier. Check the plan tier before relying on it.']},
{h:'Slots'},
{svg:slot},
{ul:['A **slot** is a live app with its own hostname, available in Standard tier and above.','Deploy to staging, test it, then **swap**. Azure warms up the staging slot before switching routing.','**Slot settings** marked sticky stay with the slot, such as production database settings.','A swap can be reverted by swapping again.','Use **traffic routing** to send a percentage to a slot for testing.']},
{code:`az webapp deployment slot create -g rg-web -n webapp-demo-001 --slot staging
az webapp deployment slot swap -g rg-web -n webapp-demo-001 --slot staging --target-slot production
az webapp config backup create -g rg-web --webapp-name webapp-demo-001 --container-url "<sas-url>" --backup-name b1`},
{note:'Slots share the plan resources of the app, so a heavy staging test affects production performance.'}],
src:[['Deployment slots',K.APP+'deploy-staging-slots'],['Back up an app',K.APP+'manage-backup']]};

/* ---------- 10 ---------- */
L['az:9:10']={blocks:[
{p:'Deploy a sample web app, scale it, add a staging slot and swap.'},
{flow:['Create a Standard plan and a web app','Deploy sample content and open the site','Scale out to two instances','Create a staging slot and deploy a visible change','Swap staging with production and confirm the change','Swap back to see rollback']},
{code:`az group create -n rg-webp -l westeurope
az appservice plan create -g rg-webp -n plan-p --sku S1
az webapp create -g rg-webp -p plan-p -n webp-demo-$RANDOM --runtime "NODE:20-lts"
az appservice plan update -g rg-webp -n plan-p --number-of-workers 2
az webapp deployment slot create -g rg-webp -n <app-name> --slot staging
az webapp deployment slot swap -g rg-webp -n <app-name> --slot staging --target-slot production`},
{h:'Checks'},
{t:[['Action','Expected'],
['Scale out','Instances count shows 2 on the plan'],
['Staging URL','Shows the new version before swap'],
['After swap','Production URL shows the new version'],
['Swap again','Old version returns, so swap is a rollback']]},
{note:'Delete the resource group afterwards. A Standard plan bills hourly whether or not the app receives traffic.'}],
src:[['App Service documentation',K.APP]]};

})();
