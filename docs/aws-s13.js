/* LearnSphere - AWS Administrator, Section 13: Containers & Serverless for Administrators.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const choose=K.dg(700,240,[
[10,10,680,220,'More managed to less managed',1],
[25,55,125,80,'Lambda|functions,|events',0],[165,55,125,80,'ECS on Fargate|containers,|no servers',2],[305,55,125,80,'EKS on Fargate|Kubernetes,|no nodes',0],[445,55,115,80,'ECS or EKS|on EC2|you run nodes',0],[575,55,100,80,'EC2|full control',0],
[25,155,650,50,'Moving right: more control and more operational work. Moving left: less to manage, more platform limits',0]],
[]);

const ecs=K.dg(700,230,[
[10,10,680,210,'ECS model',1],
[30,60,130,60,'Cluster|logical group',0],[200,60,150,60,'Service|keeps N tasks running',2],[390,60,130,60,'Task definition|image, CPU, memory, role',0],[560,60,110,60,'Task|running containers',0],
[200,150,320,45,'Capacity: Fargate, or EC2 via capacity provider',0]],
[[160,90,200,90],[350,90,390,90],[520,90,560,90]]);

/* ---------- 0 ---------- */
L['aws:12:0']={blocks:[
{p:'AWS has several ways to run code. The choice is a trade between **control** and **operational work**.'},
{svg:choose},
{t:[['Platform','You manage','Use when'],
['EC2','OS, runtime, scaling, patching','Full control, special software, licensing'],
['ECS on EC2','Container hosts plus tasks','Cost control at scale, GPU or special nodes'],
['ECS on Fargate','Task definitions only','Containers without servers'],
['EKS','Kubernetes workloads, nodes (or Fargate / Auto Mode)','Kubernetes API and ecosystem needed'],
['Lambda','Function code and configuration','Event-driven, short tasks, scale to zero']]},
{note:'For Docker image building and Kubernetes concepts, use the LearnSphere Docker and Kubernetes courses. This section covers how AWS runs them.'}],
src:[['Choosing container services','https://docs.aws.amazon.com/decision-guides/latest/containers-on-aws-how-to-choose/choosing-aws-container-service.html']]};

/* ---------- 1 ---------- */
L['aws:12:1']={blocks:[
{p:'**Amazon ECR** stores container images privately, scans them for vulnerabilities and expires old ones.'},
{h:'Operations'},
{ul:['**Repositories** hold images by tag and digest. Use **immutable tags** so a tag cannot be overwritten.','**Scanning**: basic scanning on push, or enhanced scanning with Amazon Inspector continuously.','**Lifecycle policies** expire untagged or old images to control storage cost.','**Repository policies** and IAM allow cross-account pulls.','**Replication** copies images to other Regions or accounts.']},
{code:`aws ecr create-repository --repository-name web --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true
aws ecr get-login-password | docker login --username AWS --password-stdin 111122223333.dkr.ecr.eu-west-1.amazonaws.com
aws ecr put-lifecycle-policy --repository-name web --lifecycle-policy-text file://policy.json
aws ecr describe-image-scan-findings --repository-name web --image-id imageTag=1.4.2`},
{code:`{"rules":[{"rulePriority":1,"description":"keep last 20","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":20},"action":{"type":"expire"}}]}`},
{note:'ECS and EKS nodes pull images through the **task execution role** or node role. A pull failure is usually a missing ecr:GetAuthorizationToken or no route to ECR endpoints from a private subnet.'}],
src:[['Amazon ECR','https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html']]};

/* ---------- 2 ---------- */
L['aws:12:2']={blocks:[
{p:'**Amazon ECS** is AWS own container orchestrator. Learn its objects and the roles it uses.'},
{svg:ecs},
{t:[['Object','Meaning'],
['Cluster','Logical grouping of tasks and capacity'],
['Task definition','Blueprint: images, CPU, memory, ports, environment, logging, roles'],
['Task','A running instance of a task definition'],
['Service','Maintains the desired task count, integrates with load balancers and rolling updates'],
['Capacity provider','Fargate, Fargate Spot or an EC2 Auto Scaling group']]},
{h:'Two roles'},
{t:[['Role','Used by','Purpose'],
['Task execution role','The ECS agent','Pull images from ECR, write logs, read secrets at start'],
['Task role','Your application code','Call AWS APIs such as S3 or DynamoDB']]},
{code:`aws ecs create-cluster --cluster-name prod
aws ecs register-task-definition --cli-input-json file://taskdef.json
aws ecs create-service --cluster prod --service-name web --task-definition web:1 --desired-count 2 \\
  --launch-type FARGATE --network-configuration "awsvpcConfiguration={subnets=[subnet-a,subnet-b],securityGroups=[sg-app]}"
aws ecs describe-services --cluster prod --services web --query "services[0].events[:5]"`},
{note:'On Fargate each task gets its own network interface (awsvpc mode). Plan subnet IP space for tasks, not just for nodes.'}],
src:[['Amazon ECS',K.ECS+'Welcome.html']]};

/* ---------- 3 ---------- */
L['aws:12:3']={blocks:[
{p:'ECS services scale their **task count** and roll out new versions with a deployment strategy.'},
{h:'Service auto scaling'},
{ul:['Target tracking on **CPU, memory or ALB requests per target**.','Step scaling and scheduled scaling are available.','With EC2 capacity, **capacity providers** scale the underlying Auto Scaling group too.']},
{h:'Deployment types'},
{t:[['Type','How','Rollback'],
['Rolling update','Replace tasks gradually using min and max healthy percent','Circuit breaker rolls back failed deployments'],
['Blue/green','Start the new task set, shift traffic, keep the old for rollback','Shift back'],
['Canary and linear (via blue/green)','Move traffic in steps','Automatic with alarms']]},
{code:`aws ecs update-service --cluster prod --service web --task-definition web:2 \\
  --deployment-configuration "minimumHealthyPercent=100,maximumPercent=200,deploymentCircuitBreaker={enable=true,rollback=true}"
aws application-autoscaling register-scalable-target --service-namespace ecs \\
  --resource-id service/prod/web --scalable-dimension ecs:service:DesiredCount --min-capacity 2 --max-capacity 10`},
{note:'If a deployment hangs, read service events. Typical causes are health check failures, insufficient CPU or memory in the cluster, image pull errors and a missing security group rule.'}],
src:[['ECS deployments',K.ECS+'deployment-types.html']]};

/* ---------- 4 ---------- */
L['aws:12:4']={blocks:[
{p:'**Amazon EKS** runs a managed Kubernetes **control plane**. You decide how worker capacity is provided and how people and workloads get access.'},
{h:'Who manages what'},
{t:[['Layer','AWS','You'],
['Control plane (API server, etcd)','Yes','Version choice and upgrades'],
['Worker nodes: managed node groups','Provisioning and AMI updates support','Instance types, scaling, upgrades'],
['Worker nodes: Fargate','Everything about the node','Pod specs'],
['EKS Auto Mode','Compute, networking and storage components','Workloads'],
['Add-ons: VPC CNI, CoreDNS, kube-proxy','Managed versions','Keep them current']]},
{h:'Access'},
{ul:['**Access entries** map IAM principals to Kubernetes permissions through the EKS API, replacing manual aws-auth edits.','**Pod Identity** or **IRSA** gives pods IAM roles instead of node-wide permissions.','Control plane logging goes to CloudWatch Logs when enabled.']},
{code:`aws eks create-cluster --name prod --role-arn <role> --resources-vpc-config subnetIds=subnet-a,subnet-b,securityGroupIds=sg-0abc
aws eks update-kubeconfig --name prod
aws eks create-access-entry --cluster-name prod --principal-arn arn:aws:iam::111122223333:role/ops
aws eks associate-access-policy --cluster-name prod --principal-arn <arn> \\
  --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSViewPolicy --access-scope type=cluster`},
{note:'Kubernetes versions leave standard support on a schedule. Track upgrade dates and test add-on compatibility before upgrading.'}],
src:[['Amazon EKS',K.EKS+'what-is-eks.html']]};

/* ---------- 5 ---------- */
L['aws:12:5']={blocks:[
{p:'Containers need metrics and logs at the **cluster, service, task and container** level.'},
{t:[['Tool','Collects','Notes'],
['CloudWatch Container Insights','CPU, memory, network, restarts per cluster, service, pod','Enable per cluster. EKS uses the CloudWatch observability add-on'],
['CloudWatch agent / Fluent Bit','Logs and custom metrics','Log drivers: awslogs, FireLens'],
['Amazon Managed Service for Prometheus','Prometheus metrics at scale','Scrape with an agent or collector'],
['Amazon Managed Grafana','Dashboards for CloudWatch and Prometheus','Workspace with SSO']]},
{h:'ECS logging in practice'},
{code:`"logConfiguration": {
  "logDriver": "awslogs",
  "options": {
    "awslogs-group": "/ecs/web",
    "awslogs-region": "eu-west-1",
    "awslogs-stream-prefix": "web"
  }
}`},
{code:`aws ecs update-cluster --cluster prod --settings name=containerInsights,value=enabled`},
{note:'Alarm on service-level symptoms first: running task count below desired, ALB 5xx rate and p99 latency. Then use resource metrics to explain them.'}],
src:[['Container Insights',K.CW+'ContainerInsights.html']]};

/* ---------- 6 ---------- */
L['aws:12:6']={blocks:[
{p:'**AWS Lambda** runs code in response to events with no servers to manage. An administrator tunes **configuration**, **permissions**, **concurrency** and **failure handling** and reads the metrics.'},
{h:'Key settings'},
{t:[['Setting','Notes'],
['Memory (128 MB to 10 GB)','Also sets CPU share. More memory often makes it faster'],
['Timeout','Up to 15 minutes'],
['Execution role','Permissions the function uses to call AWS'],
['Resource policy','Who may invoke the function'],
['VPC configuration','Reach private resources. Needs NAT or endpoints for internet and AWS APIs'],
['Environment variables','Config. Encrypt secrets with KMS or read from Secrets Manager'],
['Concurrency','Reserved and provisioned (see below)']]},
{h:'Concurrency'},
{ul:['Default account limit of concurrent executions per Region, requestable.','**Reserved concurrency** guarantees and caps a function.','**Provisioned concurrency** keeps environments initialized to avoid cold starts.']},
{h:'Errors and throttles'},
{t:[['Symptom','Cause and action'],
['Throttles','Concurrency limit reached. Raise limits or reserve'],
['Timeouts','Increase timeout or fix slow dependency'],
['AccessDenied in logs','Execution role missing permission'],
['Out of memory','Raise memory'],
['Async failures','Configure retries, DLQ or on-failure destination']]},
{code:`aws lambda update-function-configuration --function-name worker --memory-size 1024 --timeout 60
aws lambda put-function-concurrency --function-name worker --reserved-concurrent-executions 50
aws lambda get-function --function-name worker --query Configuration.[Runtime,MemorySize,Timeout,Role]`}],
src:[['AWS Lambda',K.LAM+'welcome.html']]};

/* ---------- 7 ---------- */
L['aws:12:7']={blocks:[
{p:'Lambda is the glue of operational automation. Know the invocation styles because errors and retries differ.'},
{t:[['Style','Triggers','Retry behaviour'],
['Synchronous','API Gateway, ALB, SDK invoke','Caller handles errors and retries'],
['Asynchronous','S3, SNS, EventBridge','Two retries, then DLQ or destination'],
['Poll-based (event source mapping)','SQS, Kinesis, DynamoDB streams','Retries until success or message expiry, batch failure handling']]},
{h:'Common operational triggers'},
{ul:['**EventBridge schedule** to run maintenance on a cron.','**EventBridge rule** on resource changes such as an EC2 state change or a Config finding.','**S3 event** when an object arrives.','**SQS** to process work queues with controlled concurrency.','**CloudWatch alarm via SNS** to run a remediation function.']},
{code:`aws events put-rule --name nightly-cleanup --schedule-expression "cron(0 2 * * ? *)"
aws lambda add-permission --function-name cleanup --statement-id events --action lambda:InvokeFunction \\
  --principal events.amazonaws.com --source-arn <rule-arn>
aws events put-targets --rule nightly-cleanup --targets "Id"="1","Arn"="<function-arn>"`},
{note:'Always give automation functions the **least privilege** and make them idempotent. A retry should not cause a second action.'}],
src:[['Lambda event sources',K.LAM+'lambda-services.html']]};

/* ---------- 8 ---------- */
L['aws:12:8']={blocks:[
{p:'**Practical:** run a service on Fargate, scale it and monitor it.'},
{flow:['Create an ECR repository and push a small web image','Create an ECS cluster and a task definition with awslogs and an execution role','Create a service with two tasks behind an ALB across two subnets','Add target tracking scaling on CPU','Generate load and watch the task count change','Stop a task and watch the service replace it','Check service events, Container Insights and logs, then delete the service, cluster and repository']},
{t:[['Check','Where'],
['Tasks running and healthy','ECS service tasks and ALB target group'],
['Logs','CloudWatch log group /ecs/web'],
['Scaling','Service auto scaling activity'],
['Cost','Fargate vCPU and memory per second, delete when done']]},
{note:'If tasks fail to start, read the stopped reason. Image pull and secret errors show there in plain text.'}],
src:[['ECS getting started',K.ECS+'getting-started-fargate.html']]};
})();
