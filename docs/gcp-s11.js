/* LearnSphere - Google Cloud, Section 11: Databases.
   Lectures 0-8 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const choose=K.dg(700,360,[
[10,10,680,340,'Choosing a Google Cloud database',1],
[250,35,200,40,'What is the data like?',2],
[20,100,150,50,'Relational,|moderate scale',0],[190,100,150,50,'Relational,|global or huge scale',0],[360,100,150,50,'Wide-column,|huge throughput',0],[530,100,150,50,'Documents,|apps and mobile',0],
[20,175,150,50,'Cloud SQL|or AlloyDB',2],[190,175,150,50,'Spanner',2],[360,175,150,50,'Bigtable',2],[530,175,150,50,'Firestore',2],
[20,250,320,40,'In-memory cache: Memorystore',0],[360,250,320,40,'Analytics warehouse: BigQuery',0],
[20,305,660,30,'Start from the access pattern and consistency needed, not from familiarity',0]],
[[350,75,95,100],[350,75,265,100],[350,75,435,100],[350,75,605,100],[95,150,95,175],[265,150,265,175],[435,150,435,175],[605,150,605,175]]);

const sqlha=K.dg(700,250,[
[10,10,680,230,'Cloud SQL high availability and replicas',1],
[30,70,180,80,'Primary|zone a|read and write',2],[260,70,180,80,'Standby|zone b|synchronous copy',0],[490,70,180,80,'Read replica|other zone or region|async',0]],
[[210,110,260,110],[210,130,490,130]]);

const spanner=K.dg(700,230,[
[10,10,680,210,'Spanner scales out and stays consistent',1],
[30,60,640,40,'Instance (regional or multi-region configuration)',1],
[50,110,150,60,'Split A|rows by key range',0],[230,110,150,60,'Split B|replicated in zones',0],[410,110,150,60,'Split C|moved automatically',0],[590,110,70,60,'...',0]],
[]);

/* ---------- 0 ---------- */
L['gcp:10:0']={blocks:[
{p:'Google Cloud has more than one managed database because different data and access patterns need different engines. Choosing well is one of the most important design decisions, because changing later is expensive.'},
{svg:choose},
{h:'The services at a glance'},
{t:[['Service','Type','Best for','Scale'],
['Cloud SQL','Relational (MySQL, PostgreSQL, SQL Server)','Typical applications, lift-and-shift, familiar SQL','One primary, vertical scale, read replicas'],
['AlloyDB','Relational, PostgreSQL-compatible','Demanding PostgreSQL workloads and mixed OLTP and analytics','Primary plus read pools'],
['Spanner','Relational, distributed','Global applications, very high scale, strong consistency','Horizontal, virtually unlimited'],
['Bigtable','Wide-column NoSQL','Time series, IoT, ad tech, very high throughput with low latency','Horizontal, petabytes'],
['Firestore','Document NoSQL','Mobile and web apps, real-time sync','Automatic, serverless'],
['Memorystore','In-memory (Redis, Valkey, Memcached)','Caching, sessions, leaderboards','Instance size or cluster shards'],
['BigQuery','Analytical warehouse','Reporting and analysis over large data','Serverless petabyte scale']]},
{h:'Decision questions'},
{ul:['**Do you need joins and transactions across tables?** Relational: Cloud SQL, AlloyDB, Spanner.','**Is the volume or global write scale beyond one server?** Spanner or Bigtable.','**Is access by a single key with huge throughput?** Bigtable.','**Does the app want flexible JSON-like documents and real-time listeners?** Firestore.','**Do you only need to speed up reads?** Add a cache with Memorystore.','**Is it analysis over history rather than serving users?** BigQuery.']},
{h:'Common mistakes'},
{ul:['Choosing Spanner or Bigtable for a small app that Cloud SQL would handle at a fraction of the cost.','Putting analytics queries on the production OLTP database instead of a replica or BigQuery.','Using a document database when the data is highly relational.']},
{note:'Oracle, SQL Server and other licensed engines have options such as Bare Metal Solution and Cloud SQL for SQL Server. Third-party databases are also available on Google Cloud Marketplace.'}],
src:[['Google Cloud databases','https://cloud.google.com/products/databases'],['Choose a database','https://cloud.google.com/architecture/databases']]};

/* ---------- 1 ---------- */
L['gcp:10:1']={blocks:[
{p:'**Cloud SQL** is a fully managed relational database service for MySQL, PostgreSQL and SQL Server. Google handles provisioning, patching, backups, replication and failover. You manage the schema, queries and users.'},
{svg:sqlha},
{h:'Create and connect'},
{code:`gcloud sql instances create app-db --database-version=POSTGRES_16 --region=us-central1 --tier=db-custom-2-8192 \\
  --availability-type=REGIONAL --storage-size=50GB --storage-auto-increase --backup-start-time=03:00 --enable-point-in-time-recovery
gcloud sql databases create shop --instance=app-db
gcloud sql users create appuser --instance=app-db --password=CHANGE_ME
gcloud sql connect app-db --user=appuser --database=shop`},
{h:'High availability'},
{ul:['Choosing **regional** availability creates a standby in another zone. Data is copied synchronously.','On failure, Cloud SQL **fails over automatically** to the standby. The instance keeps the same IP address and name, and connections must reconnect.','HA protects against zone failure and maintenance. It does not protect against deleting data or a bad query.','Standby is not readable. Use **read replicas** for reads.']},
{h:'Read replicas'},
{ul:['Asynchronous copies in the same or another region.','Offload reporting queries and read-heavy traffic.','A replica can be **promoted** to a standalone primary, which is part of a disaster recovery plan.','Replica lag should be monitored.']},
{h:'Ways to connect'},
{t:[['Method','Notes'],
['Cloud SQL Auth Proxy / language connectors','Recommended. Uses IAM, encrypts traffic, no IP allow lists'],
['Private IP','Reaches the instance inside your VPC (private services access or Private Service Connect). No public exposure'],
['Public IP with authorized networks','Allowed ranges only. Use SSL and avoid when possible'],
['IAM database authentication','Log in with IAM users or service accounts instead of passwords']]},
{note:'Prefer private IP and the Auth Proxy or connectors. Do not open a database to 0.0.0.0/0.'}],
src:[['Cloud SQL overview',K.SQL+'introduction'],['High availability',K.SQL+'postgres/high-availability'],['Connection options',K.SQL+'postgres/connect-overview']]};

/* ---------- 2 ---------- */
L['gcp:10:2']={blocks:[
{p:'Running Cloud SQL means handling changes safely: patches, settings, scale, backups and restores.'},
{h:'Backups and recovery'},
{t:[['Feature','Notes'],
['Automated backups','Daily backups in a window you choose, with retention you set (default 7 days)'],
['On-demand backups','Manual backups before risky changes'],
['Point-in-time recovery (PITR)','Replays transaction logs to restore to a second. Needs binary logging or WAL archiving enabled'],
['Restore','Creates a new instance, or restores over the original instance. Always verify'],
['Cross-region backup','Copy backups to another region for disaster recovery']]},
{code:`gcloud sql backups create --instance=app-db --description="before migration"
gcloud sql backups list --instance=app-db
gcloud sql instances clone app-db app-db-restore --point-in-time="2026-10-16T09:30:00Z"
gcloud sql backups restore BACKUP_ID --restore-instance=app-db`},
{h:'Maintenance'},
{ul:['Set a **maintenance window** (day and hour) and an update channel for earlier or later versions.','**Deny maintenance periods** prevent updates during critical times such as a sales event, for up to 90 days.','Maintenance may restart the instance. HA reduces the downtime.']},
{h:'Flags, scaling and sizing'},
{code:`gcloud sql instances patch app-db --database-flags=max_connections=500,log_min_duration_statement=500
gcloud sql instances patch app-db --tier=db-custom-4-16384    # changing the machine causes a restart
gcloud sql instances patch app-db --maintenance-window-day=SUN --maintenance-window-hour=3`},
{ul:['Storage can grow automatically but cannot shrink.','Changing machine size is vertical scaling and restarts the instance.','Use connection pooling (managed pooling or an application pool) to avoid exhausting connections.']},
{h:'Observability'},
{ul:['**Query Insights** finds slow queries and shows load by query, user and database.','Cloud Monitoring metrics for CPU, memory, connections, disk, replication lag.','Database logs go to Cloud Logging when enabled.']},
{note:'A restore test is the only proof that backups work. Schedule a periodic restore into a temporary instance and run checks.'}],
src:[['Backups and recovery',K.SQL+'postgres/backup-recovery/backups'],['Maintenance',K.SQL+'postgres/maintenance'],['Query Insights',K.SQL+'postgres/using-query-insights']]};

/* ---------- 3 ---------- */
L['gcp:10:3']={blocks:[
{p:'**AlloyDB for PostgreSQL** is a fully managed, PostgreSQL-compatible database designed for demanding workloads. It separates compute from a log-based distributed storage layer, which gives fast failover, quick replicas and strong performance.'},
{h:'Architecture'},
{ul:['A **cluster** contains a **primary instance** and optional **read pool instances** that share the same storage.','Storage is a regional, distributed layer. Instances are stateless compute, so adding a replica does not copy data.','Includes an in-memory **columnar engine** that speeds up analytical queries on the same data.','Compatible with PostgreSQL tools, extensions and drivers.','High availability is built in with a 99.99 percent SLA including maintenance.']},
{code:`gcloud alloydb clusters create prod-cluster --region=us-central1 --password=CHANGE_ME --network=projects/p/global/networks/prod-vpc
gcloud alloydb instances create primary --cluster=prod-cluster --region=us-central1 --instance-type=PRIMARY --cpu-count=4
gcloud alloydb instances create reads --cluster=prod-cluster --region=us-central1 --instance-type=READ_POOL --read-pool-node-count=2 --cpu-count=4`},
{h:'Cloud SQL versus AlloyDB'},
{t:[['Aspect','Cloud SQL for PostgreSQL','AlloyDB'],
['Engine','PostgreSQL','PostgreSQL-compatible, Google storage layer'],
['Performance','Good for common apps','Higher transaction and analytics performance'],
['Replicas','Copy of data','Read pools share storage, near-instant'],
['Cost','Lower entry cost','Higher, for demanding workloads'],
['Use','Most apps','Large or mixed workloads, heavy reads, analytics on live data']]},
{h:'Other features'},
{ul:['Continuous backup with point-in-time recovery.','Cross-region replication for disaster recovery.','AlloyDB AI: vector search and model integration inside the database.','AlloyDB Omni runs the engine on-premises or in other clouds.']},
{note:'Start with Cloud SQL for most applications. Move to AlloyDB when Cloud SQL performance, replica needs or analytics demands justify the extra cost.'}],
src:[['AlloyDB overview','https://cloud.google.com/alloydb/docs/overview'],['AlloyDB columnar engine','https://cloud.google.com/alloydb/docs/columnar-engine/about']]};

/* ---------- 4 ---------- */
L['gcp:10:4']={blocks:[
{p:'**Spanner** is a globally distributed relational database. It offers SQL, ACID transactions and **strong consistency** like a traditional database, but scales horizontally like NoSQL, and can span regions with 99.999 percent availability.'},
{svg:spanner},
{h:'How it scales'},
{ul:['Data is divided into **splits** by primary key range. Spanner moves and replicates splits automatically.','Capacity is measured in **nodes or processing units** (1000 processing units equal 1 node) and can be adjusted or autoscaled.','**Instance configurations** define where replicas live: regional, dual-region or multi-region.','Strong consistency uses synchronized clocks (TrueTime) so reads are consistent across the world.']},
{code:`gcloud spanner instances create orders-inst --config=regional-us-central1 --description="Orders" --processing-units=1000 --edition=ENTERPRISE
gcloud spanner databases create shop --instance=orders-inst
gcloud spanner databases ddl update shop --instance=orders-inst --ddl="CREATE TABLE Orders (OrderId STRING(36) NOT NULL, CustomerId STRING(36), Total NUMERIC) PRIMARY KEY (OrderId)"
gcloud spanner databases execute-sql shop --instance=orders-inst --sql="SELECT COUNT(*) FROM Orders"`},
{h:'Design rules'},
{t:[['Rule','Why'],
['Avoid monotonically increasing primary keys such as timestamps or sequential IDs','They send all writes to one split (hotspot). Use UUIDs or hashed prefixes'],
['Use interleaved tables or foreign keys for parent-child data','Keeps related rows together for fast joins'],
['Use secondary indexes with care','Each index adds write cost'],
['Pick SQL dialect at creation','GoogleSQL or PostgreSQL interface']]},
{h:'When Spanner fits'},
{ul:['Global applications that need one consistent database for users everywhere.','Workloads beyond what a single server can handle, with relational semantics.','Systems that need near-zero downtime and no maintenance windows.']},
{h:'When it does not'},
{ul:['Small or moderate applications: Cloud SQL is far cheaper.','Pure analytics: use BigQuery.','Very simple key-value access at extreme scale: Bigtable may be cheaper.']},
{note:'Spanner also supports graph, full-text and vector search features and change streams. Check the current editions for which are included.'}],
src:[['Spanner overview','https://cloud.google.com/spanner/docs/overview'],['Schema design best practices','https://cloud.google.com/spanner/docs/schema-design']]};

/* ---------- 5 ---------- */
L['gcp:10:5']={blocks:[
{p:'**Bigtable** is a fully managed, sparse, wide-column NoSQL database. It serves very high read and write throughput with single-digit millisecond latency, and scales to petabytes. It powers Search, Maps and Analytics services at Google.'},
{h:'Data model'},
{t:[['Concept','Meaning'],
['Table','A sorted map of rows'],
['Row key','The only index. Rows are stored in lexicographic order of the key'],
['Column family','Group of columns, set at table creation'],
['Column qualifier','Column name inside a family, can be created freely'],
['Cell','Value at a row and column, with timestamps for versions']]},
{h:'Instances, clusters, nodes'},
{ul:['An **instance** has one or more **clusters** in different zones or regions.','Each cluster has **nodes**. More nodes means more throughput. Autoscaling adjusts node count.','**Replication** across clusters gives availability and lower read latency. **App profiles** route traffic and choose single-cluster or multi-cluster routing.','Storage is SSD (typical) or HDD (large cold data).']},
{code:`gcloud bigtable instances create metrics-inst --display-name="Metrics" --cluster-config=id=c1,zone=us-central1-a,nodes=3
cbt -instance=metrics-inst createtable readings
cbt -instance=metrics-inst createfamily readings stats
cbt -instance=metrics-inst set readings sensor42#20261016T101500 stats:temp=21.5
cbt -instance=metrics-inst read readings prefix=sensor42#`},
{h:'Row key design is everything'},
{ul:['Bigtable looks up by key or key range only. Design the key for your reads.','Avoid keys that cause **hotspots**, such as a timestamp first or sequential IDs.','Common time-series key: `sensorId#reversedTimestamp` so recent rows for a sensor are adjacent.','Keep related data in one row to avoid joins. There are no joins or secondary indexes.']},
{h:'Typical uses'},
{ul:['Time series and IoT telemetry.','Ad tech, personalization and fraud signals.','Large analytic and machine learning feature stores.','HBase-compatible workloads.']},
{note:'Bigtable is not for small data or ad-hoc SQL. For those, use Cloud SQL or BigQuery (which can query Bigtable data as an external source).'}],
src:[['Bigtable overview','https://cloud.google.com/bigtable/docs/overview'],['Schema design','https://cloud.google.com/bigtable/docs/schema-design']]};

/* ---------- 6 ---------- */
L['gcp:10:6']={blocks:[
{p:'**Firestore** is a serverless NoSQL document database designed for mobile, web and server apps. You store JSON-like **documents** in **collections**, and it scales automatically with real-time updates and offline support.'},
{h:'Data model'},
{ul:['A **document** is a set of fields (strings, numbers, maps, arrays, references) with an ID.','A **collection** is a group of documents.','A document can have **subcollections**, forming a hierarchy such as `users/ana/orders/1001`.','Queries return documents from one collection (or a collection group). There are no joins.']},
{code:`# create a database (Native mode)
gcloud firestore databases create --location=nam5 --type=firestore-native
# a Python example
from google.cloud import firestore
db = firestore.Client()
db.collection("users").document("ana").set({"name": "Ana", "plan": "pro"})
for d in db.collection("users").where("plan", "==", "pro").stream():
    print(d.id, d.to_dict())`},
{h:'Key features'},
{t:[['Feature','Detail'],
['Serverless and scalable','No instances to size. Pay per read, write, delete and storage'],
['Real-time listeners','Clients receive changes instantly'],
['Offline support','Mobile and web SDKs cache data'],
['Transactions and batched writes','ACID across documents'],
['Security rules','For client SDK access, plus IAM for servers'],
['Multi-region','Strong consistency with high availability']]},
{h:'Indexes'},
{p:'Single-field indexes are created automatically. Queries that filter or sort on several fields need **composite indexes**, which you define. The console shows an error with a link to create a missing index.'},
{h:'Native mode and Datastore mode'},
{t:[['Mode','Use'],
['Native mode','New mobile, web and server apps, real-time features'],
['Datastore mode','Backward compatible with Cloud Datastore API, server-side use']]},
{note:'Design documents around how the app reads them. Avoid very large documents (1 MiB limit) and avoid hot spots from sequential document IDs at high write rates.'}],
src:[['Firestore overview','https://cloud.google.com/firestore/docs/overview'],['Data model','https://cloud.google.com/firestore/docs/data-model']]};

/* ---------- 7 ---------- */
L['gcp:10:7']={blocks:[
{p:'**Memorystore** provides managed in-memory data stores. It reduces load on databases by caching, and serves data that needs microsecond latency such as sessions, counters and leaderboards.'},
{h:'Products'},
{t:[['Product','Description'],
['Memorystore for Redis Cluster','Sharded, scalable Redis with high availability across zones'],
['Memorystore for Redis (instance)','Basic (no failover) and Standard (replica with failover) tiers'],
['Memorystore for Valkey','Managed Valkey, the open-source Redis fork, with cluster mode'],
['Memorystore for Memcached','Simple distributed cache, no persistence']]},
{h:'Create and connect'},
{code:`gcloud redis instances create session-cache --region=us-central1 --tier=STANDARD --size=5 --redis-version=redis_7_2 \\
  --network=projects/p/global/networks/prod-vpc
gcloud redis instances describe session-cache --region=us-central1 --format="value(host,port)"
# from a VM in the same VPC
redis-cli -h 10.0.0.5 -p 6379 ping`},
{ul:['Memorystore has **private IP only**. Clients must be in the VPC (or reach it by VPN, Interconnect or a connector for serverless).','Use in-transit encryption and authentication where available.','Standard tier fails over to a replica in another zone.']},
{h:'Caching patterns'},
{t:[['Pattern','Idea'],
['Cache-aside','App checks the cache first, loads from the database on a miss and stores the result with a TTL'],
['Write-through','App writes to cache and database together'],
['Session store','Keep user sessions in Redis so any web server can serve any user'],
['Rate limiting and counters','Atomic increments with expiry']]},
{note:'A cache is not a database of record. Design for the cache being empty, with a TTL and an eviction policy, and protect the database from a stampede after a restart.'}],
src:[['Memorystore','https://cloud.google.com/memorystore/docs'],['Redis in Google Cloud','https://cloud.google.com/memorystore/docs/redis/redis-overview']]};

/* ---------- 8 ---------- */
L['gcp:10:8']={blocks:[
{p:'Moving a database to Google Cloud without long downtime uses **Database Migration Service (DMS)**. It also helps to define a consistent backup strategy across the different database services.'},
{h:'Database Migration Service'},
{ul:['Migrates **MySQL, PostgreSQL, SQL Server and Oracle** sources to Cloud SQL or AlloyDB.','**Continuous** migration: copy existing data, then stream changes until you cut over, so downtime is minutes.','**Homogeneous** migrations (same engine) use native replication. **Heterogeneous** migrations (for example Oracle to PostgreSQL) convert schema and code.','Sources can be on-premises, Amazon RDS or other clouds.']},
{flow:['Assess the source: version, size, features, connectivity','Create a connection profile for the source and a destination','Create the migration job and choose initial dump plus continuous replication','Wait until lag is near zero and validate data','Promote the destination, switch applications, and keep the source as fallback for a while']},
{h:'Network and prerequisites'},
{ul:['Connectivity through VPN, Interconnect, VPC peering or a reverse SSH tunnel.','The source needs replication enabled, such as binary logs or logical decoding, and a user with permissions.','Plan application cutover and connection strings.']},
{h:'Backups by service'},
{t:[['Service','Backup and recovery'],
['Cloud SQL','Automated and on-demand backups, PITR, cross-region replicas'],
['AlloyDB','Automated and continuous backup with PITR, cross-region'],
['Spanner','Backups, point-in-time recovery up to 7 days, schedules'],
['Bigtable','Table backups, replication to other clusters'],
['Firestore','Scheduled backups and point-in-time recovery, export to Cloud Storage'],
['Memorystore','Persistence options on Redis, RDB snapshots on some tiers']]},
{h:'A simple strategy'},
{ul:['Decide RPO and RTO for each database.','Use automatic backups plus PITR where data loss must be small.','Copy critical backups to another region or project.','Test restores regularly and document the steps.','Protect backups from deletion with IAM and, where offered, retention locks.']},
{note:'Replication is not backup. A destructive change is copied to replicas immediately, while a backup keeps the earlier state.'}],
src:[['Database Migration Service','https://cloud.google.com/database-migration/docs/overview'],['Cloud SQL backups',K.SQL+'postgres/backup-recovery/backups']]};
})();
