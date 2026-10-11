/* LearnSphere - MongoDB, Section 16: MongoDB Atlas, Containers & Automation.
   Lectures 0-5 are core, 6-7 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN,A=M.ATLAS;

/* ---------- diagrams ---------- */
const hier=M.dg(700,200,[
[10,10,680,180,'Atlas hierarchy',1],
[30,55,150,60,'Organization|billing, users',2],[220,55,150,60,'Project|environment, access|list, users',0],[410,55,130,60,'Cluster|replica set or|sharded',0],[570,55,100,60,'Database|collections',0],
[30,130,640,40,'Each cluster runs on one or more cloud providers and regions',0]],
[[180,85,220,85],[370,85,410,85],[540,85,570,85]]);

const size=M.dg(700,150,[
[10,10,680,130,'Sizing a cluster',1],
[30,55,150,55,'Working set|and data size',2],[210,55,150,55,'Tier|RAM, vCPU, IOPS',0],[390,55,130,55,'Storage|and auto-scale',0],[550,55,120,55,'Regions|and replicas',0]],
[[180,82,210,82],[360,82,390,82],[520,82,550,82]]);

const iac=M.dg(700,140,[
[10,10,680,120,'Infrastructure as code for Atlas',1],
[30,55,150,55,'Terraform or|Atlas CLI files',2],[220,55,130,55,'Atlas Admin|API',0],[390,55,130,55,'Project and|cluster',0],[560,55,110,55,'Users and|network rules',0]],
[[180,82,220,82],[350,82,390,82],[520,82,560,82]]);

const k8s=M.dg(700,170,[
[10,10,680,150,'MongoDB on Kubernetes',1],
[30,50,150,80,'Operator|watches custom|resources',2],[220,50,140,80,'StatefulSet|3 pods',0],[400,50,130,80,'PVCs|one per pod',0],[570,50,100,80,'Services|stable DNS',0]],
[[180,90,220,90],[360,90,400,90],[530,90,570,90]]);

/* ---------- 0: architecture ---------- */
L['mongo:15:0']={blocks:[
{p:'**MongoDB Atlas** is the fully managed cloud service for MongoDB. It runs on AWS, Azure and Google Cloud, and handles provisioning, patching, backups, scaling and monitoring so you work at the database and data level.'},
{svg:hier},
{h:'Concepts'},
{t:[['Concept','Meaning'],
['**Organization**','Top level: billing, users and their roles, project list'],
['**Project**','A group of clusters with shared network rules, users, alerts and API keys. One project per environment or application is typical'],
['**Cluster**','A replica set or sharded cluster of a chosen tier, cloud and region'],
['**Database user**','Credentials for connecting to clusters (different from Atlas UI users)'],
['**IP access list**','Which networks may connect to clusters in the project']]},
{h:'Cluster families'},
{t:[['Type','Use','Notes'],
['**Free (M0)**','Learning and tiny apps','Limited storage and features'],
['**Flex**','Small, variable workloads','Pay for what you use up to a cap; check current limits'],
['**Dedicated (M10 and up)**','Production','Dedicated resources, backups, auto-scaling, private networking, advanced security'],
['**Sharded**','Very large data and throughput','Several shards plus routers']]},
{h:'What Atlas manages for you'},
{ul:['Provisioning, replica set topology and failover.','OS and MongoDB **patching** with rolling maintenance.','Backups, point-in-time restore, monitoring and alerts.','Scaling the cluster up or down, optionally automatically.']},
{note:'Tier names and limits change over time. Always check the current Atlas documentation when planning.'}],
src:[['Atlas documentation',A],['Atlas cluster types',A+'create-database-deployment/']]};

/* ---------- 1: creating and sizing ---------- */
L['mongo:15:1']={blocks:[
{p:'Good sizing balances **performance** and **cost**. Start from the working set and workload, choose a tier, and let monitoring correct the choice.'},
{svg:size},
{h:'Decisions when creating a cluster'},
{t:[['Decision','Guidance'],
['**Cloud provider and region**','Close to your application; check compliance and feature availability'],
['**Tier**','Choose RAM to hold indexes and the hot data; CPU for concurrency'],
['**Storage and IOPS**','Plan growth; provision IOPS for write-heavy workloads'],
['**Replication**','Default 3 nodes; add regions or more members for resilience or read locality'],
['**Auto-scaling**','Set minimum and maximum tier and storage so it grows safely'],
['**MongoDB version**','Latest major or the one you validated'],
['**Backup**','Enable cloud backup and choose a retention policy']]},
{h:'Auto-scaling'},
{ul:['**Compute auto-scaling** adjusts the tier based on CPU and memory use, within the limits you set.','**Storage auto-scaling** grows disk as it fills.','Scale-down has safeguards and a delay; do not rely on it for quick cost drops.','Scaling is rolling, so the cluster stays available.']},
{h:'Right-sizing method'},
{flow:['Estimate data size, index size and hot set','Pick a tier that fits the working set in RAM with headroom','Load test with realistic data','Watch cache, CPU, IOPS and latency in Atlas metrics','Adjust the tier or the data model']},
{note:'Increasing the tier is easy. The cheaper long-term fixes are usually indexes and data modeling (Sections 6 to 8).'}],
src:[['Cluster configuration',A+'cluster-config/'],['Auto-scaling',A+'cluster-autoscaling/']]};

/* ---------- 2: networking and cost ---------- */
L['mongo:15:2']={blocks:[
{p:'How applications reach Atlas affects **security**, **latency** and **cost**. Cost needs deliberate control because clusters run continuously.'},
{h:'Network options'},
{t:[['Option','What it is','When'],
['**Public with IP access list**','Internet path restricted to listed addresses','Development, simple deployments'],
['**VPC or VNet peering**','Private connection between your cloud network and Atlas','Same cloud provider, private traffic'],
['**Private endpoint**','A private address in your network for Atlas (PrivateLink or equivalent)','Production, strict security, cross-account access'],
['**Multi-region**','Nodes in several regions','Resilience and local reads']]},
{h:'Cost drivers'},
{t:[['Driver','Control'],
['**Cluster tier and node count**','Right-size; use autoscaling bounds'],
['**Storage and provisioned IOPS**','Delete unused data; use TTL and archive'],
['**Backups**','Policy retention and snapshot copies'],
['**Data transfer**','Keep apps and database in the same region; use private networking'],
['**Search and other add-ons**','Dedicated search nodes only when needed'],
['**Idle environments**','Pause dev and test clusters (dedicated tiers) when not in use']]},
{h:'Cost control habits'},
{ul:['Use **one project per environment** with budgets and billing alerts.','Tag clusters with the **owner and purpose**.','Review billing monthly and remove unused clusters.','Set **maximum** limits on auto-scaling.']},
{note:'Free and development clusters are ideal for learning. Delete them or let them auto-pause when finished.'}],
src:[['Atlas billing',A+'billing/'],['Network connections',A+'security/ip-access-list/'],['Private endpoints',A+'security-private-endpoint/']]};

/* ---------- 3: IaC ---------- */
L['mongo:15:3']={blocks:[
{p:'Clicking in the console does not scale and cannot be reviewed. Atlas can be fully described and automated with the **Atlas CLI**, the **Admin API** and the **Terraform provider**.'},
{svg:iac},
{t:[['Tool','Best for'],
['**Atlas CLI**','Quick commands, scripts, local development deployments'],
['**Admin API**','Custom integrations from any language'],
['**Terraform provider (mongodbatlas)**','Declarative, reviewable environments (same ideas as the Terraform course)'],
['**CloudFormation and other**','Wrap the same API in your platform of choice']]},
{h:'Atlas CLI'},
{code:`atlas auth login
atlas projects create shop-dev
atlas clusters create shop --provider AWS --region EU_WEST_1 --tier M10
atlas dbusers create readWrite --username shopapp --password '***'
atlas accessLists create 203.0.113.10/32 --comment "office"`},
{h:'Terraform'},
{code:`resource "mongodbatlas_advanced_cluster" "shop" {
  project_id   = var.project_id
  name         = "shop"
  cluster_type = "REPLICASET"

  replication_specs = [{
    region_configs = [{
      provider_name = "AWS"
      region_name   = "EU_WEST_1"
      priority      = 7
      electable_specs = { instance_size = "M10", node_count = 3 }
    }]
  }]
}`},
{h:'Practices'},
{ul:['Keep **API keys** and database passwords in a secret store, never in code.','Use a **separate project per environment** and the same module for each.','Run changes through a **pipeline** with review.','Version-lock the provider and plan before applying.']},
{note:'Resource arguments change between provider versions. Copy examples from the current provider documentation.'}],
src:[['Atlas CLI',M.D+'atlas/cli/current/'],['Terraform provider','https://registry.terraform.io/providers/mongodb/mongodbatlas/latest/docs'],['Atlas Administration API',A+'api/']]};

/* ---------- 4: Kubernetes ---------- */
L['mongo:15:4']={blocks:[
{p:'MongoDB can run on **Kubernetes**, but it is a **stateful** system, so it needs more care than a stateless service. An **operator** encodes how to deploy, scale, upgrade and secure MongoDB for you.'},
{svg:k8s},
{h:'Why an operator'},
{ul:['A plain Deployment cannot manage replica set membership, elections and reconfiguration.','The operator creates **StatefulSets**, **PersistentVolumeClaims**, **Services** and configures the replica set automatically.','It handles **rolling upgrades**, scaling and TLS configuration.']},
{h:'Options'},
{t:[['Operator','For','Notes'],
['**MongoDB Community Operator**','Community Edition replica sets','Open source; simpler feature set'],
['**MongoDB Enterprise Kubernetes Operator** (with Ops Manager)','Enterprise deployments, sharded clusters, backup and automation','Commercial'],
['**Atlas Kubernetes Operator**','Manage Atlas resources from Kubernetes','Atlas runs outside the cluster']]},
{h:'A minimal Community resource'},
{code:`apiVersion: mongodbcommunity.mongodb.com/v1
kind: MongoDBCommunity
metadata:
  name: shop-db
spec:
  members: 3
  type: ReplicaSet
  version: "8.0.4"
  security:
    authentication:
      modes: ["SCRAM"]
  users:
    - name: shopapp
      db: admin
      passwordSecretRef:
        name: shopapp-password
      roles:
        - name: readWrite
          db: shop
      scramCredentialsSecretName: shopapp-scram`},
{h:'Production considerations'},
{ul:['Use **fast storage classes** and avoid shared or network storage with high latency.','Set **resource requests and limits**; MongoDB needs memory headroom for its cache.','Spread pods across **zones** with anti-affinity.','Plan **backups** (snapshots or tools); the operator does not replace a backup strategy.']},
{note:'If you want the benefits of MongoDB without operating it on Kubernetes, use Atlas and connect from your cluster over a private endpoint.'}],
src:[['Kubernetes Operator',M.D+'kubernetes/current/'],['MongoDB Community Kubernetes Operator','https://github.com/mongodb/mongodb-kubernetes-operator']]};

/* ---------- 5: decision guide ---------- */
L['mongo:15:5']={blocks:[
{p:'There is no single right answer. Compare options on the dimensions that matter to **your** team.'},
{t:[['Dimension','Atlas','Self-managed (VM or bare metal)','Self-managed on Kubernetes'],
['**Operations effort**','Low','High','Medium to high'],
['**Control of OS and hardware**','Limited','Full','Container level'],
['**Time to start**','Minutes','Days','Days'],
['**Backups and PITR**','Built in','You build or add Ops Manager','You build'],
['**Upgrades**','Managed, rolling','You plan and run','Operator-assisted'],
['**Extra features**','Search, Vector Search, Data Federation, triggers','Core database (plus Enterprise features)','Core database'],
['**Cost model**','Pay per tier and usage','Hardware plus staff time','Cluster plus staff time'],
['**Compliance and location**','Many regions and certifications; check yours','Any, including on premises','Any']]},
{h:'Choose Atlas when'},
{ul:['You want to **focus on the application**, not database operations.','You need fast provisioning, multi-region and built-in backups.','You want features such as Atlas Search and Vector Search.']},
{h:'Choose self-managed when'},
{ul:['You must run **on premises** or in an isolated network.','Regulation or policy requires full control of the infrastructure.','You have the team and tooling to operate databases well.','Existing platform standards favour Kubernetes or specific hardware.']},
{h:'A simple path'},
{flow:['Start prototypes on a free Atlas cluster','Move to a dedicated Atlas tier for production, or deploy self-managed if constraints require it','Automate with infrastructure as code either way','Revisit the decision when scale, cost or compliance change']},
{note:'You can migrate between them (Section 15), so the decision is reversible with effort.'}],
src:[['Atlas',A],['MongoDB deployment options','https://www.mongodb.com/products']]};
})();
