/* LearnSphere - Redis, Section 15: Operations and Administration.
   Lectures 0-5 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const upgrade=K.dg(700,200,[
[10,10,680,180,'Rolling upgrade of a primary with replicas',1],
[30,60,130,60,'Upgrade|replicas first',0],[210,60,130,60,'Check replication|is healthy',0],[390,60,130,60,'Failover to an|upgraded replica',2],[570,60,100,60,'Upgrade the|old primary',0]],
[[160,90,210,90],[340,90,390,90],[520,90,570,90]]);

const k8s=K.dg(700,220,[
[10,10,680,200,'Redis on Kubernetes',1],
[30,70,140,60,'Service|(headless)',0],[230,50,180,50,'StatefulSet pod 0|PVC',2],[230,120,180,50,'StatefulSet pod 1|PVC',2],[480,50,190,50,'ConfigMap: redis.conf',0],[480,120,190,50,'Secret: passwords, TLS',0]],
[[170,100,230,75],[170,100,230,145]]);

const dr=K.dg(700,200,[
[10,10,680,180,'Disaster recovery layers',1],
[30,60,150,60,'Replicas|same Region, other zone',0],[210,60,150,60,'Backups|off-host, encrypted',2],[390,60,150,60,'Cross-Region|replica or restore',0],[570,60,100,60,'Tested|runbook',2]],
[]);

/* ---------- 0 ---------- */
L['redis:14:0']={blocks:[
{p:'Most production problems with Redis come from the host, not from Redis. A few settings prevent the common ones.'},
{t:[['Area','Setting','Why'],
['Memory','vm.overcommit_memory = 1','Allow the fork for persistence'],
['Memory','Transparent huge pages = never','Avoid latency and memory bloat after fork'],
['Memory','vm.swappiness low, or no swap','Avoid pages going to disk'],
['Network','net.core.somaxconn at least tcp-backlog (511)','Avoid dropped connections'],
['Files','LimitNOFILE above maxclients + 32','Avoid running out of descriptors'],
['Time','NTP or chrony','Consistent TTL and logs across nodes'],
['Process','Run as a dedicated unprivileged user','Contain impact'],
['Disk','Separate fast volume for dir, enough free space','Snapshots need room']]},
{code:`# /etc/sysctl.d/99-redis.conf
vm.overcommit_memory = 1
net.core.somaxconn = 1024

# systemd unit
[Service]
LimitNOFILE=65535
User=redis
Restart=always`},
{h:'Disk space'},
{p:'An RDB snapshot can need as much disk as the dataset, and AOF rewrites need room for both the old and the new files. Keep free space above that, and alert on it.'},
{note:'Redis warns about several of these at startup. Read the log of a new host before you put traffic on it.'}],
src:[['Admin',K.MGT+'admin/']]};

/* ---------- 1 ---------- */
L['redis:14:1']={blocks:[
{p:'Upgrades are routine when planned. The general rule is: read the release notes, test, then upgrade replicas before primaries.'},
{svg:upgrade},
{h:'Compatibility'},
{ul:['A newer Redis reads RDB and AOF files from older versions. An older version cannot read files from a newer one, so downgrading needs a backup made before.','Replicas can usually be newer than the primary during a rollout, but not the reverse.','New persistence formats and commands appear in minor releases. Check the release notes for **breaking changes** and changed defaults.']},
{h:'Rolling upgrade by topology'},
{t:[['Topology','Procedure'],
['Primary and replicas with Sentinel','Upgrade replicas one by one, SENTINEL failover, then upgrade the old primary'],
['Cluster','Upgrade each replica, failover its primary with CLUSTER FAILOVER, upgrade the former primary'],
['Standalone','Take a backup, plan a short restart, restart with the same files']]},
{h:'Redis and Valkey'},
{p:'Valkey 7.2 is compatible with Redis OSS up to 7.2. Data created with newer Redis versions or with Redis 8 types (JSON, search, vector sets) cannot be moved to Valkey as is. Plan a migration at the application level or use tools that copy through the protocol, and test them.'},
{note:'Always take a backup, check `INFO` of every node after each step and keep the old version available until you are confident.'}],
src:[['Upgrade',K.MGT+'admin/#upgrading-or-restarting-a-redis-instance-without-downtime'],['Release notes',K.D+'about/releases/']]};

/* ---------- 2 ---------- */
L['redis:14:2']={blocks:[
{p:'Containers are an easy way to run Redis, but data and addressing need attention.'},
{h:'Docker'},
{ul:['Mount a volume on `/data`, or data is lost with the container.','Pass a config file: `redis-server /usr/local/etc/redis/redis.conf`.','Do not publish the port on public interfaces. Use a private network.','Set a memory limit larger than `maxmemory` to leave room for buffers and fork.']},
{h:'Kubernetes'},
{svg:k8s},
{t:[['Topic','Guidance'],
['Workload','StatefulSet with a PersistentVolumeClaim per pod'],
['Addressing','Headless Service for stable names. Use hostnames for Sentinel and Cluster announcements'],
['Resources','Memory request equals limit. A limit that is too tight gets the pod OOM killed during a fork'],
['Config and secrets','ConfigMap and Secret, not baked into the image'],
['Probes','Readiness with PING, a gentle liveness probe, long enough startup for large RDB loads'],
['Shutdown','Allow enough termination time to save, and handle SIGTERM'],
['Placement','Anti-affinity so replicas are on different nodes and zones'],
['Management','Prefer an operator or maintained Helm chart for failover and upgrades']]},
{note:'Pod IPs change. Set `cluster-announce-hostname` and `cluster-preferred-endpoint-type hostname`, or the Sentinel hostname options, so peers and clients keep working after a restart.'}],
src:[['Redis on Docker',K.D+'operate/oss_and_stack/install/'],['Kubernetes operators',K.D+'operate/kubernetes/']]};

/* ---------- 3 ---------- */
L['redis:14:3']={blocks:[
{p:'A **managed service** runs the servers, patches, replication and failover for you. You give up some control in return.'},
{t:[['Service','Notes'],
['Amazon ElastiCache','Redis OSS and Valkey engines, cluster mode on or off, Multi-AZ, a serverless option, Global Datastore for cross-Region'],
['Amazon MemoryDB','Redis OSS compatible database with a durable multi-AZ transaction log'],
['Azure Managed Redis and Azure Cache for Redis','Azure offerings, with tiers and clustering. Check the service roadmap for the current product'],
['Google Memorystore','Redis and Valkey options, including a cluster mode'],
['Redis Cloud','Run by Redis, with enterprise features such as active-active and multiple data types']]},
{h:'What the provider handles'},
{ul:['Provisioning, patching, minor version upgrades and failover.','Backups and snapshots, monitoring integration, encryption at rest and in transit.']},
{h:'What you still own'},
{ul:['Choosing the node size, cluster mode, eviction policy and parameter group settings.','Key design, big keys and application timeouts.','Network access, authentication and cost.']},
{h:'Limitations to check'},
{ul:['Blocked commands (`CONFIG`, `DEBUG`, `MODULE`, sometimes `KEYS`).','Engine and version, and which modules or types are available.','Maximum item size, connection limits and failover behaviour in your client.']},
{note:'Test failover and maintenance windows with your real client. Provider failover often changes a DNS endpoint, and clients must reconnect and refresh DNS.'}],
src:[['Redis Cloud',K.D+'operate/rc/'],['ElastiCache','https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html']]};

/* ---------- 4 ---------- */
L['redis:14:4']={blocks:[
{p:'Disaster recovery (DR) plans for losing a whole zone, Region or account. Start from two numbers.'},
{t:[['Objective','Meaning','Question'],
['RPO (recovery point objective)','Data you can afford to lose','How old may the restored data be?'],
['RTO (recovery time objective)','Time to be back','How long can you be down?']]},
{svg:dr},
{h:'Options'},
{t:[['Approach','RPO','RTO','Notes'],
['Backups to object storage in another Region','Backup interval','Hours (restore and warm up)','Cheapest'],
['Cross-Region replica (asynchronous)','Seconds to minutes','Minutes (promote)','Needs bandwidth and tested promotion'],
['Active-active (Redis Software and Cloud)','Near zero, conflict resolved by CRDTs','Near zero','Needs enterprise product and data types that support it'],
['Rebuild from system of record','Data is derived','Time to rebuild and warm','Fine for caches']]},
{h:'Practices'},
{ul:['Automate backups, encrypt them and copy them off the account and Region.','Document and rehearse the runbook: promote, repoint clients, validate data.','Remember the application tier and DNS during failover, not only Redis.']},
{note:'A cache often needs no backup at all. Say so explicitly, and make sure the database behind it can survive a cold cache.'}],
src:[['Persistence',K.MGT+'persistence/']]};

/* ---------- 5 ---------- */
L['redis:14:5']={blocks:[
{p:'Capacity planning turns requirements into a node count and size.'},
{flow:['Estimate keys and average size per key from a sample, using MEMORY USAGE and a test load','Multiply, then add overhead and growth for 12 months','Add headroom for copy-on-write, buffers and fragmentation','Estimate operations per second and value sizes, benchmark one node','Pick the topology: standalone, Sentinel or Cluster, and the node count']},
{t:[['Input','How to find it'],
['Dataset size','Sample load and `MEMORY STATS`, projected'],
['Throughput','Application metrics, peak not average'],
['Payload size','Largest and typical values'],
['Availability','Number of replicas and zones'],
['Retention','TTL and eviction policy']]},
{h:'Cost levers'},
{ul:['Shorter keys, compact encodings and hashes for small objects.','TTLs and trimming so memory holds only what is needed.','Right-size nodes. Memory is the main cost, so compare memory-optimised and standard instance types.','Use replicas only where you need the availability or the read capacity.','Tiering options in enterprise products for large, mostly cold datasets.']},
{note:'Plan for peak and failure. After a node is lost, the remaining nodes still need to carry the load and the memory of the data that moves.'}],
src:[['Memory optimization',K.MGT+'optimization/memory-optimization/']]};
})();
