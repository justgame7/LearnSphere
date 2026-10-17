/* LearnSphere - Google Cloud, Section 10: Serverless: Cloud Run, Functions and App Engine.
   Lectures 0-7 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const choose=K.dg(700,330,[
[10,10,680,310,'Where should this workload run?',1],
[250,35,200,40,'Need full OS control?',2],
[30,100,190,50,'Yes: Compute Engine',0],
[250,100,200,50,'Need Kubernetes features?|Yes: GKE',0],
[480,100,190,50,'No: containerized?',0],
[30,200,190,60,'Yes, HTTP or jobs:|Cloud Run',2],[250,200,200,60,'Small event handler:|Cloud Run functions',0],[480,200,190,60,'Classic web app, PaaS:|App Engine',0],
[30,275,640,30,'Prefer the most managed option that meets your needs',0]],
[[350,75,125,100],[350,75,350,100],[350,75,575,100],[575,150,125,200],[575,150,350,200],[575,150,575,200]]);

const run=K.dg(700,260,[
[10,10,680,240,'Cloud Run service',1],
[30,90,100,60,'Request|HTTPS',0],[170,90,140,60,'Cloud Run|URL and IAM',2],[350,40,140,40,'Revision 2: 90 percent',2],[350,100,140,40,'Revision 1: 10 percent',0],[350,160,140,40,'Instances 0 to N',0],[540,90,130,60,'Cloud SQL,|Pub/Sub, APIs',0]],
[[130,120,170,120],[310,110,350,60],[310,120,350,120],[490,60,540,100],[490,180,540,140]]);

const events=K.dg(700,230,[
[10,10,680,210,'Event-driven flow',1],
[30,80,130,60,'Event source|Storage, Pub/Sub',0],[200,80,120,60,'Eventarc|routes events',2],[360,80,140,60,'Cloud Run or|function',2],[540,80,130,60,'Result|DB, API, queue',0]],
[[160,110,200,110],[320,110,360,110],[500,110,540,110]]);

/* ---------- 0 ---------- */
L['gcp:9:0']={blocks:[
{p:'Google Cloud offers many ways to run code. The right one depends on how much control you need and how much operations you want to avoid. A good rule is to choose the **most managed** option that still fits.'},
{svg:choose},
{h:'Compute options compared'},
{t:[['Option','You manage','Scales','Best for'],
['Compute Engine','VM, OS, runtime, app','MIG autoscaling, minutes','Lift-and-shift, custom OS, licenses, special hardware'],
['GKE','Containers and Kubernetes objects','Pods and nodes','Many microservices, Kubernetes ecosystem, portability'],
['Cloud Run','A container (or source)','Instances, scales to zero, seconds','HTTP services, APIs, jobs, most new container apps'],
['Cloud Run functions','A function','Per request, scales to zero','Small event handlers and glue code'],
['App Engine standard','Application code','Instances, scales to zero','Web apps in supported runtimes']]},
{h:'Questions to ask'},
{ul:['Is it a **container** already? Cloud Run or GKE.','Does it need **Kubernetes** APIs, custom controllers or daemon sets? GKE.','Is it **event-driven** and short? Cloud Run functions or Cloud Run with Eventarc.','Does it need a specific **OS or kernel**, GPUs with special drivers, or persistent local state? Compute Engine.','Is it **long-running or stateful**? Prefer VMs or GKE.','Can it be **stateless** and scale to zero? Cloud Run is a good fit.']},
{h:'Typical mapping'},
{t:[['Workload','Choice'],
['Public REST API','Cloud Run'],
['Process an uploaded file','Cloud Run functions with a Cloud Storage trigger'],
['Nightly batch job','Cloud Run jobs with Cloud Scheduler'],
['Legacy Java application server','Compute Engine or GKE'],
['Hundreds of microservices with mesh','GKE'],
['Small company website with a database','Cloud Run or App Engine']]},
{note:'You can mix them. A common design has a load balancer in front of Cloud Run services, a Cloud SQL database, and functions that react to storage and messaging events.'}],
src:[['Choose a compute option','https://cloud.google.com/docs/choosing-a-compute'],['Serverless on Google Cloud','https://cloud.google.com/serverless']]};

/* ---------- 1 ---------- */
L['gcp:9:1']={blocks:[
{p:'**Cloud Run** runs stateless containers that respond to HTTP requests or run as jobs. It scales from zero to many instances automatically and you pay only while handling requests (or for the configured instances).'},
{svg:run},
{h:'Concepts'},
{t:[['Term','Meaning'],
['Service','A named, long-lived app with a stable HTTPS URL'],
['Revision','An immutable snapshot of a service version (image plus settings). Each deployment creates one'],
['Instance','A running container. Cloud Run adds or removes them with load'],
['Concurrency','Requests one instance handles at once (default 80, up to 1000)'],
['Job','Run-to-completion work without an HTTP endpoint']]},
{h:'Deploy'},
{code:`gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
# from a container image
gcloud run deploy hello --image=us-docker.pkg.dev/cloudrun/container/hello --region=us-central1 --allow-unauthenticated
# straight from source code (builds with buildpacks)
gcloud run deploy api --source=. --region=us-central1
gcloud run services list
gcloud run services describe api --region=us-central1 --format="value(status.url)"`},
{h:'Container contract'},
{ul:['Listen on the port in the `PORT` environment variable (default 8080) on all interfaces.','Be stateless. The file system is in-memory, local data disappears with the instance.','Start quickly. Slow start increases cold-start latency.','Log to stdout and stderr. Logs go to Cloud Logging.']},
{h:'Key settings'},
{t:[['Setting','Notes'],
['CPU and memory','Up to 8 vCPU and 32 GiB per instance'],
['Min and max instances','Min above 0 avoids cold starts but costs. Max protects downstream systems'],
['Request timeout','Up to 60 minutes for services'],
['CPU allocation','Only during requests (default) or always allocated for background work'],
['Authentication','Require IAM (roles/run.invoker) or allow unauthenticated for public services']]},
{note:'Cloud Run is billed by rounded 100 ms of use of CPU, memory and requests, with a free tier. With request-based CPU, an idle service at zero instances costs nothing.'}],
src:[['Cloud Run overview',K.RUN+'overview/what-is-cloud-run'],['Deploying container images',K.RUN+'deploying']]};

/* ---------- 2 ---------- */
L['gcp:9:2']={blocks:[
{p:'After the first deployment, you will configure traffic, secrets, networking and identity. These settings turn a demo into a production service.'},
{h:'Traffic splitting and rollouts'},
{code:`gcloud run deploy api --image=IMAGE:v2 --region=us-central1 --no-traffic --tag=canary
gcloud run services update-traffic api --region=us-central1 --to-revisions=api-00002-abc=10,api-00001-xyz=90
gcloud run services update-traffic api --region=us-central1 --to-latest
gcloud run revisions list --service=api --region=us-central1`},
{ul:['Deploy a new revision with **no traffic** and a tag to test it at its own URL.','Shift traffic gradually: 10 percent, 50 percent, 100 percent.','Roll back by sending traffic to the previous revision.']},
{h:'Service identity and secrets'},
{code:`gcloud run deploy api --image=IMAGE --region=us-central1 \\
  --service-account=api-sa@my-project.iam.gserviceaccount.com \\
  --set-env-vars=APP_ENV=prod \\
  --set-secrets=DB_PASSWORD=db-password:latest`},
{ul:['Each service runs as a **service account**. Create a dedicated one with least privilege instead of the default Compute Engine account.','**Secrets** from Secret Manager are mounted as environment variables or files. The service account needs `roles/secretmanager.secretAccessor`.']},
{h:'Networking'},
{t:[['Need','Setting'],
['Control who can call the service','Ingress: all, internal, or internal and Cloud Load Balancing'],
['Reach private VPC resources (Cloud SQL private IP, internal APIs)','Direct VPC egress or a Serverless VPC Access connector'],
['Static outbound IP','Route egress through Cloud NAT with a reserved IP'],
['Custom domain and WAF','External Application Load Balancer with a serverless NEG and Cloud Armor'],
['Connect to Cloud SQL','`--add-cloudsql-instances` for the built-in connector']]},
{h:'Calling a private service'},
{p:'When a service requires authentication, the caller sends an **ID token** for the service URL. A service account that calls it needs `roles/run.invoker` on that service.'},
{code:`gcloud run services add-iam-policy-binding api --region=us-central1 --member="serviceAccount:caller@my-project.iam.gserviceaccount.com" --role="roles/run.invoker"
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://api-xxxx.a.run.app`},
{note:'Allow unauthenticated access only for public content. Private APIs should require IAM and be called with ID tokens.'}],
src:[['Rollbacks, gradual rollouts and traffic migration',K.RUN+'rollouts-rollbacks-traffic-migration'],['Configure secrets',K.RUN+'configuring/secrets'],['Direct VPC egress',K.RUN+'configuring/vpc-direct-vpc']]};

/* ---------- 3 ---------- */
L['gcp:9:3']={blocks:[
{p:'**Cloud Run jobs** run containers that do a task and exit, such as data processing, migrations, reports or batch work. There is no HTTP server and no incoming URL.'},
{h:'Services versus jobs'},
{t:[['Aspect','Service','Job'],
['Trigger','HTTP requests or events','Manual run, schedule or workflow'],
['Lifecycle','Runs while requests arrive, scales to zero','Runs to completion then stops'],
['Parallelism','Many concurrent requests per instance','Multiple tasks in parallel, each in a container'],
['Timeout','Up to 60 minutes per request','Up to 24 hours per task']]},
{code:`gcloud run jobs create nightly-report --image=IMAGE --region=us-central1 --tasks=10 --parallelism=5 --max-retries=2 --task-timeout=1h
gcloud run jobs execute nightly-report --region=us-central1 --wait
gcloud run jobs executions list --job=nightly-report --region=us-central1`},
{ul:['Each task receives `CLOUD_RUN_TASK_INDEX` and `CLOUD_RUN_TASK_COUNT`, so it can process its slice of the data.','Failed tasks are retried up to `max-retries`.']},
{h:'Triggers'},
{t:[['Trigger','How'],
['On a schedule','Cloud Scheduler calls the Cloud Run Admin API to execute the job'],
['Event-driven','Eventarc starts a service or workflow that runs the job'],
['Workflow step','Workflows connector executes a job and waits'],
['Manual','Console, gcloud or API']]},
{code:`gcloud scheduler jobs create http nightly-trigger --location=us-central1 --schedule="0 2 * * *" \\
  --uri="https://run.googleapis.com/v2/projects/my-project/locations/us-central1/jobs/nightly-report:run" \\
  --http-method=POST --oauth-service-account-email=scheduler-sa@my-project.iam.gserviceaccount.com`},
{note:'The scheduler service account needs the Cloud Run Invoker role on the job (roles/run.invoker) to start it.'}],
src:[['Cloud Run jobs',K.RUN+'create-jobs'],['Execute jobs on a schedule',K.RUN+'execute/jobs-on-schedule']]};

/* ---------- 4 ---------- */
L['gcp:9:4']={blocks:[
{p:'**Cloud Run functions** (formerly Cloud Functions) run a single function in response to an HTTP request or an event. You write the function. Google builds, deploys and scales it. It is the quickest route for small glue code.'},
{svg:events},
{h:'Runtimes and triggers'},
{ul:['Runtimes: Node.js, Python, Go, Java, .NET, Ruby, PHP.','Triggers: **HTTP** (a URL), and **event** triggers through Eventarc such as Pub/Sub messages, Cloud Storage changes, Firestore changes and Cloud Audit Logs.','Under the hood each function is a Cloud Run service, so you get Cloud Run features.']},
{h:'A Python HTTP function'},
{code:`# main.py
import functions_framework

@functions_framework.http
def hello(request):
    name = request.args.get("name", "world")
    return f"Hello {name}"`},
{code:`gcloud run deploy hello-fn --source=. --function=hello --base-image=python312 --region=us-central1 --no-allow-unauthenticated
# older command still widely used
gcloud functions deploy hello-fn --gen2 --runtime=python312 --region=us-central1 --source=. --entry-point=hello --trigger-http`},
{h:'Event-driven example'},
{code:`# runs when a file is uploaded to a bucket
gcloud functions deploy on-upload --gen2 --runtime=python312 --region=us-central1 --source=. --entry-point=on_upload \\
  --trigger-event-filters="type=google.cloud.storage.object.v1.finalized" \\
  --trigger-event-filters="bucket=my-bucket"`},
{h:'Function or Cloud Run service?'},
{t:[['Choose functions when','Choose a service when'],
['The code is a single small handler','You already have a container or a web framework'],
['You want zero container work','You need custom system libraries or a custom runtime'],
['It reacts to events','You serve multiple routes and long-lived HTTP']]},
{note:'Keep functions idempotent. Event delivery is at least once, so the same event can arrive twice.'}],
src:[['Cloud Run functions',K.RUN+'functions/overview'],['Functions Framework','https://github.com/GoogleCloudPlatform/functions-framework']]};

/* ---------- 5 ---------- */
L['gcp:9:5']={blocks:[
{p:'**App Engine** is Google\'s original platform as a service. You deploy application code and configuration, and App Engine runs, scales and patches the infrastructure. It remains in use for existing apps, though Cloud Run is the usual choice for new work.'},
{h:'Structure'},
{ul:['One App Engine **application** per project, in a region chosen at creation that cannot be changed.','An application has one or more **services** (microservices), each with **versions**, each running **instances**.','Traffic can be split between versions.']},
{h:'Standard and flexible'},
{t:[['Feature','Standard','Flexible'],
['Runs on','Sandbox with specific runtimes','Docker containers on Compute Engine VMs'],
['Scales to zero','Yes','No (at least one instance)'],
['Start time','Seconds or less','Minutes'],
['Language support','Fixed list of runtimes','Any, with a custom Dockerfile'],
['Pricing','Instance hours, free quota','VM resources'],
['Use','Typical web apps and APIs','Custom runtimes, background processes']]},
{code:`# app.yaml
runtime: python312
instance_class: F2
automatic_scaling:
  min_instances: 0
  max_instances: 10
  target_cpu_utilization: 0.65
env_variables:
  APP_ENV: prod`},
{code:`gcloud app create --region=us-central
gcloud app deploy app.yaml --version=v2 --no-promote
gcloud app services set-traffic default --splits=v2=0.1,v1=0.9
gcloud app browse
gcloud app logs tail -s default`},
{h:'Config files'},
{t:[['File','Purpose'],
['app.yaml','Runtime, scaling, environment, handlers'],
['cron.yaml','Scheduled HTTP calls'],
['dispatch.yaml','Route URL patterns to services'],
['queue.yaml','Task queue settings (legacy)']]},
{note:'App Engine standard older runtimes reach end of support. Check the runtime support schedule before relying on one.'}],
src:[['App Engine overview','https://cloud.google.com/appengine/docs/standard'],['Choosing an environment','https://cloud.google.com/appengine/docs/the-appengine-environments']]};

/* ---------- 6 ---------- */
L['gcp:9:6']={blocks:[
{p:'Two small services cover scheduled and queued work: **Cloud Scheduler** triggers things at set times, and **Cloud Tasks** manages queues of work items with controlled delivery.'},
{h:'Cloud Scheduler'},
{ul:['A managed cron service. Jobs use the cron format and a time zone.','Targets: HTTP or HTTPS endpoints, Pub/Sub topics, and App Engine HTTP.','Retries failed attempts with a configurable policy.','Authenticates to private targets with an OIDC or OAuth token from a service account.']},
{code:`gcloud scheduler jobs create http cleanup --location=us-central1 --schedule="0 3 * * *" --time-zone="Europe/London" \\
  --uri="https://api-xxxx.a.run.app/cleanup" --http-method=POST --oidc-service-account-email=scheduler-sa@my-project.iam.gserviceaccount.com
gcloud scheduler jobs create pubsub tick --location=us-central1 --schedule="*/5 * * * *" --topic=ticks --message-body="tick"
gcloud scheduler jobs run cleanup --location=us-central1`},
{h:'Cloud Tasks'},
{p:'A queue holds **tasks**, each an HTTP request to run later. Cloud Tasks delivers them at a rate you control, retries on failure, and can delay or deduplicate.'},
{code:`gcloud tasks queues create email-queue --location=us-central1 --max-dispatches-per-second=10 --max-concurrent-dispatches=5 --max-attempts=5
gcloud tasks create-http-task --queue=email-queue --location=us-central1 --url=https://worker-xxxx.a.run.app/send --body-content='{"to":"a@example.com"}'`},
{h:'Tasks versus Pub/Sub'},
{t:[['Aspect','Cloud Tasks','Pub/Sub'],
['Model','You decide exactly which endpoint runs each task','Publisher does not know subscribers'],
['Control','Rate limits, scheduling, per-task delay','Fan-out to many subscribers'],
['Use','Rate-limited API calls, background jobs, deferred work','Event streams and decoupled services']]},
{note:'Use Scheduler to start things at a time, Tasks to meter work to a service, and Pub/Sub to broadcast events.'}],
src:[['Cloud Scheduler','https://cloud.google.com/scheduler/docs/overview'],['Cloud Tasks','https://cloud.google.com/tasks/docs/dual-overview']]};

/* ---------- 7 ---------- */
L['gcp:9:7']={blocks:[
{p:'Serverless systems combine small pieces. Google Cloud has services to route events and coordinate steps so you do not hand-write the glue.'},
{h:'Eventarc'},
{p:'**Eventarc** routes events from Google Cloud sources, your own apps (through Pub/Sub) and SaaS providers to targets such as Cloud Run, Cloud Run functions, GKE and Workflows. Events use the open **CloudEvents** format.'},
{code:`gcloud eventarc triggers create audit-trigger --location=us-central1 --destination-run-service=handler --destination-run-region=us-central1 \\
  --event-filters="type=google.cloud.audit.log.v1.written" --event-filters="serviceName=compute.googleapis.com" --event-filters="methodName=v1.compute.instances.insert" \\
  --service-account=eventarc-sa@my-project.iam.gserviceaccount.com`},
{h:'Workflows'},
{p:'**Workflows** runs a sequence of steps defined in YAML or JSON: call HTTP APIs and Google Cloud services, branch, loop, wait and handle errors. It is for orchestration with state, retries and long waits.'},
{code:`main:
  steps:
  - get_user:
      call: http.get
      args:
        url: https://users.example.com/42
      result: user
  - check:
      switch:
      - condition: \${user.body.active == true}
        next: notify
      next: end
  - notify:
      call: http.post
      args:
        url: https://notify-xxxx.a.run.app/send
        body: {id: \${user.body.id}}
        auth: {type: OIDC}`},
{code:`gcloud workflows deploy onboarding --location=us-central1 --source=workflow.yaml --service-account=wf-sa@my-project.iam.gserviceaccount.com
gcloud workflows run onboarding --location=us-central1 --data='{"id":42}'`},
{h:'Application Integration'},
{p:'**Application Integration** is a low-code tool with many connectors to SaaS and databases, for integrating business systems without custom code.'},
{h:'Choosing'},
{t:[['Need','Tool'],
['React to an event from a Google service','Eventarc'],
['Multi-step process with branching and retries','Workflows'],
['Connect SaaS apps with a visual designer','Application Integration'],
['Simple one-to-many messages','Pub/Sub']]},
{note:'Workflows is not a place for heavy computation. It coordinates calls to other services that do the work.'}],
src:[['Eventarc','https://cloud.google.com/eventarc/docs/overview'],['Workflows','https://cloud.google.com/workflows/docs/overview'],['Application Integration','https://cloud.google.com/application-integration/docs/overview']]};
})();
