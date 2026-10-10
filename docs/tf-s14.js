/* LearnSphere - Terraform, Section 14: Real-World Infrastructure Patterns.
   Lectures 0-7 are core, 8-14 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,LG=K.L;
const AWS='https://registry.terraform.io/providers/hashicorp/aws/latest/docs';

/* ---------- diagrams ---------- */
const arch=K.dg(700,290,[
[10,10,680,270,'Reference architecture: a three-tier web application',1],
[30,60,130,50,'Internet',0],[200,60,140,50,'Load balancer|(public subnets)',2],[380,60,140,50,'App servers|(private subnets)',2],[560,60,110,50,'Database|(private)',2],
[200,160,470,40,'VPC 10.0.0.0/16  across two availability zones',0],
[30,225,200,40,'S3 + KMS (storage, keys)',0],[270,225,200,40,'IAM roles (least privilege)',0],[510,225,160,40,'Remote state + locking',0]],
[[160,85,200,85],[340,85,380,85],[520,85,560,85]]);

const net=K.dg(700,260,[
[10,10,680,240,'VPC with public and private subnets',1],
[30,45,640,200,'VPC 10.0.0.0/16',1],
[60,80,260,60,'Public subnet 10.0.1.0/24|route: 0.0.0.0/0 -> internet gateway',2],[60,160,260,60,'Private subnet 10.0.2.0/24|no direct internet route',0],
[380,80,130,60,'Internet|gateway',0],[380,160,130,60,'NAT gateway|(optional,|costs money)',0],[550,100,100,90,'Security|groups|(per resource)',0]],
[[320,110,380,110],[320,190,380,190],[445,160,445,140]]);

const comp=K.dg(700,200,[
[10,10,680,180,'Compute behind a load balancer',1],
[30,70,120,60,'Users',0],[190,70,150,60,'Application|Load Balancer|listener :80',2],[380,50,140,45,'EC2 instance (AZ a)',0],[380,110,140,45,'EC2 instance (AZ b)',0],[560,70,110,60,'Auto Scaling|group + launch|template',2]],
[[150,100,190,100],[340,100,380,72],[340,100,380,132],[520,95,560,100]]);

const tier=K.dg(700,210,[
[10,10,680,190,'Modules for the three tiers',1],
[30,70,160,70,'module network|outputs: vpc_id,|subnet ids',2],[270,50,160,50,'module app|(alb + asg)',0],[270,115,160,50,'module db|(rds postgres)',0],[510,70,160,70,'Root module|wires them together',2]],
[[190,95,270,75],[190,115,270,140],[430,75,510,95],[430,140,510,115]]);

/* ---------- 0: reference architecture ---------- */
L['tf:13:0']={blocks:[
{p:'Before writing any resource, **design** what you will build and **how the code is organised**. This section builds a small production-style platform: a network, application servers behind a load balancer, a database and supporting storage and IAM.'},
{svg:arch},
{h:'Decide before you code'},
{t:[['Decision','Typical choice'],
['**Layers**','Network, data, application (change at different speeds)'],
['**State**','One state per layer and environment (smaller blast radius)'],
['**Code reuse**','Modules for each layer; environments call them with different inputs'],
['**Environments**','dev, staging, prod with their own folders or workspaces and accounts'],
['**Naming and tags**','`<app>-<env>-<thing>` plus tags for owner, env and cost centre']]},
{h:'A repository layout'},
{code:`infra/
  modules/
    network/
    app/
    database/
  envs/
    dev/
      main.tf          # calls the modules with dev values
      backend.tf       # dev state location
      terraform.tfvars
    prod/
      main.tf
      backend.tf
      terraform.tfvars
  README.md`},
{flow:['Write modules once in modules/','Each environment folder calls them with its own values and its own state','Plan and apply per environment','Promote a change: dev, then staging, then prod']},
{h:'Why separate states'},
{ul:['A mistake in the app layer cannot destroy the network or database.','Plans are faster because each state is smaller.','Different teams can own different layers and permissions.']},
{h:'Cost note'},
{p:'The AWS labs in this section can cost money (NAT gateways, load balancers and databases are billed per hour). **Destroy everything after each lab** and set a budget alert.'},
{note:'A good habit: draw the architecture on one page, list the layers and states, **then** write code.'}],
src:[['Standard module structure',LG+'modules/develop/structure'],['AWS provider',AWS]]};

/* ---------- 1: AWS networking ---------- */
L['tf:13:1']={blocks:[
{p:'Almost everything on AWS lives in a **VPC** (virtual private cloud): your private network. Subnets split it, route tables decide where traffic goes and **security groups** act as per-resource firewalls.'},
{svg:net},
{t:[['Piece','Job','Terraform resource'],
['**VPC**','The network','`aws_vpc`'],
['**Subnet**','A range inside the VPC in one availability zone','`aws_subnet`'],
['**Internet gateway**','Connects the VPC to the internet','`aws_internet_gateway`'],
['**Route table**','Rules for where traffic goes','`aws_route_table`, `aws_route`'],
['**Association**','Links a subnet to a route table','`aws_route_table_association`'],
['**NAT gateway**','Lets private subnets reach out (not in)','`aws_nat_gateway`'],
['**Security group**','Stateful firewall for resources','`aws_security_group`']]},
{h:'Code'},
{code:`data "aws_availability_zones" "available" {}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "demo-vpc" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "demo-public-\${count.index}" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = { Name = "demo-private-\${count.index}" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "web" {
  name   = "demo-web"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`},
{h:'Public or private?'},
{t:[['Subnet','Route to internet gateway?','Put here'],
['Public','Yes','Load balancers, bastion hosts'],
['Private','No','Application servers, databases']]},
{ul:['Use at least **two availability zones** for resilience.','`cidrsubnet()` carves subnets out of the VPC range without hand-calculating.','Security groups refer to **other groups** (not only IP ranges), which keeps rules tight.','A NAT gateway is **billed per hour**; delete it after labs.']},
{note:'Open to `0.0.0.0/0` only what must be public (port 80 or 443 on the load balancer), never databases or SSH.'}],
src:[['aws_vpc',AWS+'/resources/vpc'],['aws_subnet',AWS+'/resources/subnet']]};

/* ---------- 2: Compute ---------- */
L['tf:13:2']={blocks:[
{p:'To run an application reliably, put **several servers** behind a **load balancer** and let an **Auto Scaling group** keep the right number running.'},
{svg:comp},
{t:[['Piece','Job','Resource'],
['**AMI lookup**','Find the image','`data "aws_ami"`'],
['**Launch template**','Blueprint: image, size, security group, user data','`aws_launch_template`'],
['**Auto Scaling group**','Keeps N instances across subnets','`aws_autoscaling_group`'],
['**Load balancer**','Spreads traffic','`aws_lb`'],
['**Target group**','The set of servers behind it','`aws_lb_target_group`'],
['**Listener**','Port and rule on the load balancer','`aws_lb_listener`']]},
{h:'Code'},
{code:`data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_launch_template" "web" {
  name_prefix            = "demo-web-"
  image_id               = data.aws_ami.al2023.id
  instance_type          = "t3.micro"
  vpc_security_group_ids = [aws_security_group.web.id]
  user_data = base64encode(<<-EOT
    #!/bin/bash
    dnf install -y nginx
    systemctl enable --now nginx
  EOT
  )
  lifecycle { create_before_destroy = true }
}

resource "aws_lb" "web" {
  name               = "demo-web"
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.web.id]
}

resource "aws_lb_target_group" "web" {
  name     = "demo-web"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.web.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_autoscaling_group" "web" {
  min_size            = 2
  max_size            = 4
  desired_capacity    = 2
  vpc_zone_identifier = aws_subnet.private[*].id
  target_group_arns   = [aws_lb_target_group.web.arn]

  launch_template {
    id      = aws_launch_template.web.id
    version = "$Latest"
  }
  lifecycle { ignore_changes = [desired_capacity] }
}`},
{h:'Ideas used from earlier sections'},
{ul:['Data source for the AMI (Section 4).','`create_before_destroy` on the launch template and `ignore_changes` on capacity (Section 7).','Splat `aws_subnet.public[*].id` (Section 6).']},
{note:'Servers in **private** subnets need a NAT gateway or VPC endpoints to download packages. In a small lab, use the public subnets, and destroy afterwards.'}],
src:[['aws_autoscaling_group',AWS+'/resources/autoscaling_group'],['aws_lb',AWS+'/resources/lb']]};

/* ---------- 3: Storage and IAM ---------- */
L['tf:13:3']={blocks:[
{p:'Almost every platform needs **storage** (S3), **encryption keys** (KMS) and **IAM roles** that give servers only the permissions they need.'},
{h:'An encrypted, private bucket'},
{code:`resource "aws_kms_key" "data" {
  description         = "Key for app data"
  enable_key_rotation = true
}

resource "aws_s3_bucket" "data" {
  bucket = "demo-app-data-12345"
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket                  = aws_s3_bucket.data.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.data.arn
    }
  }
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration { status = "Enabled" }
}`},
{h:'A least-privilege role for the servers'},
{code:`data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "read_data" {
  statement {
    actions   = ["s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.data.arn, "\${aws_s3_bucket.data.arn}/*"]
  }
}

resource "aws_iam_role" "app" {
  name               = "demo-app"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy" "read_data" {
  name   = "read-data"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.read_data.json
}

resource "aws_iam_instance_profile" "app" {
  name = "demo-app"
  role = aws_iam_role.app.name
}`},
{p:'Attach the instance profile in the launch template (`iam_instance_profile { name = aws_iam_instance_profile.app.name }`).'},
{t:[['Concept','Meaning'],
['**Trust policy** (assume role)','Who may use the role (here: EC2)'],
['**Permissions policy**','What the role may do (here: read one bucket)'],
['**Instance profile**','Container that attaches a role to an EC2 instance']]},
{h:'Habits'},
{ul:['Block public access and enable encryption on every bucket.','Scope policies to specific actions and resources, not `*`.','Use `aws_iam_policy_document` data sources: they check syntax and give readable code.','Never put access keys on servers; use roles.']},
{note:'Newer AWS provider versions split a bucket into many small resources (versioning, encryption, public access block). That is why you see several resources for one bucket.'}],
src:[['aws_s3_bucket',AWS+'/resources/s3_bucket'],['aws_iam_role',AWS+'/resources/iam_role']]};

/* ---------- 4: RDS ---------- */
L['tf:13:4']={blocks:[
{p:'Databases are **stateful**: mistakes lose data. Terraform can create **Amazon RDS for PostgreSQL** safely when you give it the right guard rails. (This pairs with the PostgreSQL course.)'},
{h:'Parts of an RDS setup'},
{t:[['Piece','Job','Resource'],
['**Subnet group**','Which private subnets the database may use','`aws_db_subnet_group`'],
['**Parameter group**','PostgreSQL settings (like `postgresql.conf`)','`aws_db_parameter_group`'],
['**Security group**','Only the app may connect, on 5432','`aws_security_group`'],
['**Instance**','The database server','`aws_db_instance`']]},
{code:`resource "aws_db_subnet_group" "db" {
  name       = "demo-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "db" {
  name   = "demo-db"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]   # only the app tier
  }
}

resource "aws_db_parameter_group" "pg" {
  name   = "demo-pg16"
  family = "postgres16"
  parameter {
    name  = "log_min_duration_statement"
    value = "500"
  }
}

resource "aws_db_instance" "main" {
  identifier        = "demo-db"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = "db.t3.micro"
  allocated_storage = 20

  db_name  = "app"
  username = "app_admin"
  manage_master_user_password = true      # secret lives in Secrets Manager

  db_subnet_group_name   = aws_db_subnet_group.db.name
  parameter_group_name   = aws_db_parameter_group.pg.name
  vpc_security_group_ids = [aws_security_group.db.id]

  storage_encrypted       = true
  multi_az                = false          # true in production
  backup_retention_period = 7
  publicly_accessible     = false
  deletion_protection     = false          # true in production
  skip_final_snapshot     = true           # false in production

  lifecycle { prevent_destroy = false }
}`},
{h:'Lab versus production'},
{t:[['Setting','Lab','Production'],
['`multi_az`','`false`','`true`'],
['`deletion_protection`','`false`','`true`'],
['`skip_final_snapshot`','`true`','`false` (with a snapshot identifier)'],
['`backup_retention_period`','1 to 7','7 to 35'],
['`prevent_destroy`','off','on']]},
{h:'Handling the password safely'},
{ul:['`manage_master_user_password = true` stores the password in **Secrets Manager** and keeps it out of your code.','Never use a literal password; do not output it.','Applications read the secret at start-up (Section 11).']},
{note:'Some changes (instance class, storage, engine version) can cause **downtime** or replacement. Read the plan, use `apply_immediately` carefully and take a snapshot first.'}],
src:[['aws_db_instance',AWS+'/resources/db_instance']]};

/* ---------- 5: Containers ---------- */
L['tf:13:5']={blocks:[
{p:'Terraform manages containers in two ways: **locally** with the Docker provider (great for learning, free), and **in the cloud** by creating the platform that runs them.'},
{h:'The Docker provider (local, free)'},
{code:`terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {}

resource "docker_image" "nginx" {
  name         = "nginx:1.27"
  keep_locally = true
}

resource "docker_container" "web" {
  name  = "tf-web"
  image = docker_image.nginx.image_id
  ports {
    internal = 80
    external = 8080
  }
}`},
{code:`terraform init
terraform apply
curl http://localhost:8080      # nginx welcome page
terraform destroy`},
{p:'It needs Docker running on your machine. It mirrors `docker run` and ties into the Docker course.'},
{h:'Container platforms in the cloud'},
{t:[['Platform','What Terraform creates','Good for'],
['**ECS (Fargate)**','Cluster, task definition, service, load balancer, IAM roles','Containers without managing servers'],
['**EKS**','Kubernetes control plane, node groups, IAM, networking','Kubernetes on AWS'],
['**App Runner** / similar','A service from an image or repository','Simplest hosting'],
['**ECR**','A private image registry','Storing images']]},
{h:'Typical ECS pieces'},
{flow:['aws_ecr_repository: store your image','aws_ecs_cluster: the logical cluster','aws_ecs_task_definition: image, CPU, memory, environment, secrets','aws_ecs_service: keeps N tasks running behind a load balancer','IAM roles: execution role (pull image, write logs) and task role (app permissions)']},
{note:'Terraform creates the **platform and its configuration**. Building and pushing the image is a CI step; Terraform then references the image tag.'}],
src:[['Docker provider','https://registry.terraform.io/providers/kreuzwerker/docker/latest/docs'],['aws_ecs_service',AWS+'/resources/ecs_service']]};

/* ---------- 6: Kubernetes and Helm ---------- */
L['tf:13:6']={blocks:[
{p:'Terraform can deploy workloads into a Kubernetes cluster with the **Kubernetes** and **Helm** providers. (This pairs with the Kubernetes course.)'},
{code:`provider "kubernetes" {
  config_path = "~/.kube/config"
}

provider "helm" {
  kubernetes = {
    config_path = "~/.kube/config"
  }
}

resource "kubernetes_namespace_v1" "app" {
  metadata { name = "demo" }
}

resource "kubernetes_deployment_v1" "web" {
  metadata {
    name      = "web"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }
  spec {
    replicas = 2
    selector { match_labels = { app = "web" } }
    template {
      metadata { labels = { app = "web" } }
      spec {
        container {
          name  = "nginx"
          image = "nginx:1.27"
        }
      }
    }
  }
}

resource "helm_release" "metrics" {
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  namespace  = "kube-system"
}`},
{h:'Kubernetes provider vs Helm provider'},
{t:[['','Kubernetes provider','Helm provider'],
['**You write**','Each object in HCL','A reference to a chart plus values'],
['**Good for**','Your own simple objects','Installing packaged software'],
['**Resource**','`kubernetes_deployment_v1`, ...','`helm_release`']]},
{h:'The ordering problem'},
{p:'A provider must be **configured before it is used**. If you create the cluster **and** deploy into it in the **same** configuration, the provider settings depend on a cluster that does not exist yet, which causes errors on the first run.'},
{svg:K.dg(700,150,[
[10,10,680,130,'Safer: two layers, two states',1],
[30,55,200,55,'Layer 1: cluster|(EKS, network)|outputs: endpoint, CA',2],[270,55,160,55,'State and outputs|(remote state or data)',0],[470,55,200,55,'Layer 2: workloads|providers read the|cluster details',2]],
[[230,82,270,82],[430,82,470,82]])},
{h:'Rules'},
{ul:['Create the cluster in one configuration and deploy workloads in another.','Authenticate with short-lived tokens (`exec` plugin or data source), not stored kubeconfigs.','Use GitOps tools (Argo CD, Flux) for application delivery when you have many workloads; keep Terraform for the platform.']},
{note:'Terraform is excellent for platform pieces (namespaces, quotas, ingress controllers). Fast-changing application deployments often belong to a deployment tool.'}],
src:[['Kubernetes provider','https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs'],['Helm provider','https://registry.terraform.io/providers/hashicorp/helm/latest/docs']]};

/* ---------- 7: practical ---------- */
L['tf:13:7']={blocks:[
{p:'Build the network, compute and database layers as **modules**, deploy a small application and **destroy it cleanly**. This lab uses AWS and **costs a small amount** while it runs: do it in one sitting and destroy at the end.'},
{svg:tier},
{h:'Step 1: layout'},
{code:`three-tier/
  main.tf
  variables.tf
  outputs.tf
  modules/
    network/   # vpc, subnets, routes, security groups
    app/       # launch template, asg, load balancer
    db/        # subnet group, parameter group, rds`},
{h:'Step 2: wire the modules in the root'},
{code:`module "network" {
  source = "./modules/network"
  name   = "demo"
  cidr   = "10.0.0.0/16"
}

module "db" {
  source             = "./modules/db"
  name               = "demo"
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  app_sg_id          = module.network.web_sg_id
}

module "app" {
  source            = "./modules/app"
  name              = "demo"
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  web_sg_id         = module.network.web_sg_id
}

output "app_url" {
  value = "http://\${module.app.lb_dns_name}"
}`},
{h:'Step 3: run it'},
{code:`terraform init
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
curl $(terraform output -raw app_url)`},
{h:'Step 4: check'},
{ul:['The URL returns the web page from the servers.','`terraform state list` shows addresses like `module.network.aws_vpc.main`.','In the console, the database has **no public address** and only the app group can reach port 5432.']},
{h:'Step 5: change and observe'},
{ul:['Change `max_size` in the Auto Scaling group: in-place update.','Change the launch template user data: `create_before_destroy` makes a new template first.']},
{h:'Step 6: destroy'},
{code:`terraform destroy
# then check the console: no VPC, load balancer, database or NAT gateway remains`},
{t:[['You practised','Lecture'],
['Layered architecture and modules','1'],
['VPC, subnets, routes, security groups','2'],
['Launch template, ASG, load balancer','3'],
['Encrypted storage and IAM roles','4'],
['RDS with safe settings','5']]},
{note:'Always finish with `terraform destroy` and a look at the billing console. The load balancer, NAT gateway and database are the usual surprises.'}],
src:[['AWS provider',AWS],['Module composition',LG+'modules/develop/composition']]};
})();
