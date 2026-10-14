/* LearnSphere - AWS Administrator, Section 12: Databases for Administrators.
   Lectures 0-10 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const map=K.dg(700,230,[
[10,10,680,210,'Pick the database by data model',1],
[25,55,125,70,'Relational|RDS, Aurora',2],[165,55,125,70,'Key-value|DynamoDB',0],[305,55,125,70,'In-memory|ElastiCache,|MemoryDB',0],[445,55,115,70,'Analytics|Redshift,|Athena',0],[575,55,100,70,'Document, graph,|search and more',0],
[25,145,650,50,'Managed means AWS runs the host and engine. You still own schema, access, sizing and backups strategy',0]],
[]);

const maz=K.dg(700,220,[
[10,10,680,200,'Multi-AZ versus read replicas',1],
[30,50,300,140,'Multi-AZ|synchronous standby in another AZ|automatic failover, same endpoint|for HIGH AVAILABILITY',2],
[370,50,300,140,'Read replica|asynchronous copy|own endpoint, read only|for READ SCALING and DR',0]],
[]);

const aur=K.dg(700,230,[
[10,10,680,210,'Aurora cluster',1],
[30,50,150,45,'Writer instance',2],[200,50,150,45,'Reader instance',0],[370,50,150,45,'Reader instance',0],
[30,110,640,45,'Shared cluster volume: 6 copies across 3 AZs, grows to 128 TiB',0],
[30,165,200,35,'Cluster endpoint (writes)',0],[250,165,200,35,'Reader endpoint (reads)',0],[470,165,200,35,'Instance endpoints',0]],
[]);

/* ---------- 0 ---------- */
L['aws:11:0']={blocks:[
{p:'AWS offers purpose-built databases. As an administrator you rarely choose the data model, but you must know what each service **manages for you** and what remains yours.'},
{svg:map},
{h:'Responsibility split'},
{t:[['','You run it on EC2','Managed (RDS, Aurora, DynamoDB)'],
['Hardware and OS patching','You','AWS'],
['Engine installation and patching','You','AWS (in a maintenance window)'],
['Backups and failover','You build it','AWS provides, you configure'],
['Schema, users, queries, indexes','You','You'],
['Sizing and cost','You','You'],
['OS access','Full','None for most services']]},
{h:'Service overview'},
{t:[['Need','Service'],
['SQL, existing engine applications','RDS (MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, Db2)'],
['SQL with higher scale and availability','Aurora (MySQL and PostgreSQL compatible)'],
['Key-value at any scale, serverless','DynamoDB'],
['Caching, sessions, leaderboards','ElastiCache'],
['Data warehouse','Redshift'],
['Document store compatible with MongoDB','DocumentDB']]},
{note:'The PostgreSQL, MongoDB and Redshift courses in LearnSphere cover the engines themselves. This section covers how AWS operates them.'}],
src:[['AWS databases','https://aws.amazon.com/products/databases/']]};

/* ---------- 1 ---------- */
L['aws:11:1']={blocks:[
{p:'**Amazon RDS** runs relational engines on managed instances. You choose engine, version, **instance class**, **storage** and networking, and AWS handles provisioning, patching and backups.'},
{h:'Building blocks'},
{t:[['Piece','Meaning'],
['DB instance','An isolated database environment'],
['Instance class','CPU and memory: db.m7g, db.r7g, db.t4g (burstable)'],
['Storage type','gp3, io1/io2 (provisioned IOPS); storage autoscaling can grow it'],
['DB subnet group','The subnets (in at least two AZs) where RDS may place the instance'],
['Security group','Controls who connects to the engine port'],
['Parameter and option groups','Engine configuration']]},
{code:`aws rds create-db-instance --db-instance-identifier app-db --engine postgres \\
  --db-instance-class db.m7g.large --allocated-storage 100 --storage-type gp3 \\
  --master-username admin --manage-master-user-password \\
  --db-subnet-group-name private-db --vpc-security-group-ids sg-db --no-publicly-accessible \\
  --storage-encrypted --multi-az --backup-retention-period 7`},
{ul:['**Storage encryption** is chosen at creation and cannot be removed.','`--manage-master-user-password` keeps the master password in Secrets Manager.','Put databases in **private subnets** and do not make them publicly accessible.','You cannot SSH to the host. **RDS Custom** offers OS access for specific engines.']}],
src:[['Amazon RDS',K.RDS+'Welcome.html']]};

/* ---------- 2 ---------- */
L['aws:11:2']={blocks:[
{p:'Multi-AZ and read replicas solve **different problems**. Do not confuse them.'},
{svg:maz},
{t:[['','Multi-AZ','Read replica'],
['Purpose','Availability and durability','Read scaling, reporting, DR'],
['Replication','Synchronous','Asynchronous'],
['Serves reads','No (instance deployment)','Yes, its own endpoint'],
['Failover','Automatic, DNS endpoint flips','Manual promotion'],
['Cross-Region','No','Yes'],
['Backups from','The standby, no I/O pause on primary','Independent']]},
{h:'Failover'},
{ul:['Triggers: instance failure, AZ failure, maintenance, manual reboot with failover.','The **same DNS endpoint** points at the new primary, typically within 1 to 2 minutes.','Applications must **reconnect** and retry, and respect DNS TTL.','A **Multi-AZ DB cluster** (MySQL, PostgreSQL) has two readable standbys with faster failover.']},
{code:`aws rds reboot-db-instance --db-instance-identifier app-db --force-failover
aws rds create-db-instance-read-replica --db-instance-identifier app-db-r1 --source-db-instance-identifier app-db
aws rds promote-read-replica --db-instance-identifier app-db-r1`},
{note:'Monitor **ReplicaLag**. A lagging replica returns stale data and takes longer to promote safely.'}],
src:[['Multi-AZ',K.RDS+'Concepts.MultiAZ.html'],['Read replicas',K.RDS+'USER_ReadRepl.html']]};

/* ---------- 3 ---------- */
L['aws:11:3']={blocks:[
{p:'**Parameter groups** hold engine settings. **Option groups** enable engine features (mainly Oracle and SQL Server). **Maintenance windows** control when patching and upgrades happen.'},
{h:'Parameters'},
{ul:['You cannot edit the default group. Create a **custom parameter group** and attach it.','Parameters are **dynamic** (apply immediately) or **static** (apply after a reboot). The instance shows `pending-reboot`.','Changes that need a reboot should be planned with the maintenance window or a failover.']},
{h:'Maintenance and upgrades'},
{t:[['Type','Notes'],
['Minor version upgrade','Can be automatic in the window. Usually low risk'],
['Major version upgrade','Manual, with testing. Blue/green deployments reduce risk'],
['OS and hardware maintenance','Required items scheduled in the window']]},
{code:`aws rds create-db-parameter-group --db-parameter-group-name pg16-custom --db-parameter-group-family postgres16 --description custom
aws rds modify-db-parameter-group --db-parameter-group-name pg16-custom --parameters "ParameterName=log_min_duration_statement,ParameterValue=500,ApplyMethod=immediate"
aws rds modify-db-instance --db-instance-identifier app-db --preferred-maintenance-window sun:03:00-sun:04:00
aws rds describe-pending-maintenance-actions`},
{note:'RDS **Blue/Green Deployments** create a staging copy, let you upgrade and test it, then switch over with a short downtime. Prefer it for major upgrades.'}],
src:[['Parameter groups',K.RDS+'USER_WorkingWithParamGroups.html'],['Blue/green deployments',K.RDS+'blue-green-deployments.html']]};

/* ---------- 4 ---------- */
L['aws:11:4']={blocks:[
{p:'RDS protects data with **automated backups** and **manual snapshots**. Together they provide **point-in-time restore (PITR)**.'},
{t:[['','Automated backups','Manual snapshots'],
['Created','Daily snapshot plus transaction logs','On demand'],
['Retention','0 to 35 days','Until you delete'],
['Restore granularity','Any second in the window (PITR)','The snapshot moment'],
['On instance delete','Removed (unless retained)','Kept']]},
{h:'Restore always creates a new instance'},
{flow:['Choose the instance and a restore time or snapshot','RDS creates a new instance with a new endpoint','Validate data on the new instance','Repoint the application or promote the new instance by renaming','Delete the old instance when safe']},
{code:`aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier app-db \\
  --target-db-instance-identifier app-db-restore --restore-time 2026-10-15T09:30:00Z
aws rds create-db-snapshot --db-instance-identifier app-db --db-snapshot-identifier pre-release
aws rds copy-db-snapshot --source-db-snapshot-identifier arn:aws:rds:eu-west-1:111122223333:snapshot:pre-release \\
  --target-db-snapshot-identifier pre-release-dr --source-region eu-west-1 --region eu-central-1`},
{note:'Recovery objectives drive the choice: PITR gives an RPO of about 5 minutes. RTO depends on size and must be tested. Use AWS Backup for central policies and cross-account copies.'}],
src:[['Backing up and restoring',K.RDS+'CHAP_CommonTasks.BackupRestore.html']]};

/* ---------- 5 ---------- */
L['aws:11:5']={blocks:[
{p:'Three layers of monitoring explain a slow database.'},
{t:[['Tool','Shows','Question answered'],
['CloudWatch metrics','CPU, connections, free memory, IOPS, latency, replica lag','Is the instance resource constrained?'],
['Enhanced Monitoring','OS metrics at up to 1 second, per process','Which process or OS limit is hot?'],
['Performance Insights / Database Insights','Database load by SQL, wait events, host, user','Which query and wait is causing load?']]},
{h:'Reading Performance Insights'},
{ul:['**DB load** is average active sessions. Compare it with the number of vCPUs.','Wait events show what sessions wait for: CPU, I/O, locks.','Top SQL ranks queries by load so you know what to tune.']},
{h:'Common patterns'},
{t:[['Symptom','Likely cause'],
['High CPU, many CPU waits','Inefficient queries, missing indexes'],
['High read latency and IOPS at limit','Storage type or size too small, add IOPS or move to gp3/io2'],
['FreeableMemory low, swap','Instance too small or too many connections'],
['DatabaseConnections at max','Connection leaks or no pooling (use RDS Proxy)'],
['Lock wait events','Long transactions blocking others']]},
{code:`aws rds modify-db-instance --db-instance-identifier app-db --enable-performance-insights --monitoring-interval 15 --monitoring-role-arn <role>
aws cloudwatch get-metric-statistics --namespace AWS/RDS --metric-name CPUUtilization \\
  --dimensions Name=DBInstanceIdentifier,Value=app-db --statistics Average --period 300 --start-time 2026-10-15T00:00:00Z --end-time 2026-10-15T06:00:00Z`}],
src:[['Monitoring RDS',K.RDS+'MonitoringOverview.html']]};

/* ---------- 6 ---------- */
L['aws:11:6']={blocks:[
{p:'**RDS Proxy** sits between applications and the database. It **pools connections**, reuses them and keeps them through failovers.'},
{h:'Why use it'},
{ul:['**Lambda and bursty clients** open many short connections that exhaust database connection limits.','Reduces failover time for applications because the proxy keeps client connections and moves to the new primary.','Can enforce **IAM authentication** and read credentials from Secrets Manager.']},
{h:'Setup points'},
{flow:['Store database credentials in Secrets Manager','Create the proxy in the same VPC with security groups and an IAM role to read the secret','Register the DB instance or cluster as a target','Point applications at the proxy endpoint instead of the database endpoint']},
{code:`aws rds create-db-proxy --db-proxy-name app-proxy --engine-family POSTGRESQL \\
  --auth AuthScheme=SECRETS,SecretArn=<secret>,IAMAuth=REQUIRED \\
  --role-arn <role> --vpc-subnet-ids subnet-a subnet-b --vpc-security-group-ids sg-proxy`},
{note:'The proxy adds a small latency and a cost per vCPU. It is most valuable where connection count, not query speed, is the problem.'}],
src:[['RDS Proxy',K.RDS+'rds-proxy.html']]};

/* ---------- 7 ---------- */
L['aws:11:7']={blocks:[
{p:'**Amazon Aurora** is a MySQL and PostgreSQL compatible engine built for AWS. Storage is **shared and distributed** across three AZs, separate from compute.'},
{svg:aur},
{h:'Differences from RDS instances'},
{ul:['Storage is **6 copies over 3 AZs**, auto-growing up to 128 TiB, and no storage provisioning.','Up to **15 reader instances** share the same storage with very low replica lag.','Failover promotes a reader in typically about **30 seconds** or less.','Backups are continuous and do not affect performance.']},
{h:'Features for administrators'},
{t:[['Feature','Use'],
['Cluster and reader endpoints','Route writes and reads without tracking instances'],
['Aurora Serverless v2','Capacity scales in fine increments by ACU, including scale to near zero where supported'],
['Global Database','Cross-Region replication with typically under 1 second lag, fast regional recovery'],
['Backtrack (MySQL)','Rewind a cluster without a restore'],
['Fast database cloning','Copy-on-write clones for testing']]},
{code:`aws rds create-db-cluster --db-cluster-identifier aurora-app --engine aurora-postgresql \\
  --master-username admin --manage-master-user-password --storage-encrypted \\
  --db-subnet-group-name private-db --vpc-security-group-ids sg-db
aws rds create-db-instance --db-instance-identifier aurora-app-1 --db-cluster-identifier aurora-app \\
  --engine aurora-postgresql --db-instance-class db.r7g.large`}],
src:[['Amazon Aurora',K.RDS+'CHAP_AuroraOverview.html']]};

/* ---------- 8 ---------- */
L['aws:11:8']={blocks:[
{p:'**Amazon DynamoDB** is a serverless key-value and document database with single-digit millisecond performance at any scale. The administrator manages **capacity, scaling, protection and replication**, not servers.'},
{h:'Capacity modes'},
{t:[['Mode','How it bills','Best for'],
['On-demand','Per read and write request, scales instantly','Unpredictable or new workloads'],
['Provisioned','You set read and write capacity units, with auto scaling','Steady predictable traffic, lower unit cost']]},
{h:'Operations'},
{ul:['**Throttling** (ProvisionedThroughputExceeded) means demand exceeded capacity or a **hot partition**.','**Auto scaling** adjusts provisioned capacity from utilization targets.','**Point-in-time recovery** restores to any second in the last 35 days into a new table.','**On-demand backups** and AWS Backup keep long-term copies.','**Global tables** replicate multi-Region and multi-active.','**TTL** expires items automatically.']},
{code:`aws dynamodb update-continuous-backups --table-name orders --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
aws dynamodb update-table --table-name orders --billing-mode PAY_PER_REQUEST
aws dynamodb restore-table-to-point-in-time --source-table-name orders --target-table-name orders-restore --use-latest-restorable-time`},
{note:'Key design happens before production. Poor partition key choice cannot be fixed by capacity alone, so involve the application team early.'}],
src:[['DynamoDB','https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html']]};

/* ---------- 9 ---------- */
L['aws:11:9']={blocks:[
{p:'**Amazon ElastiCache** provides managed in-memory caches with **Valkey**, **Redis OSS** and **Memcached** engines. Caching cuts database load and latency.'},
{h:'Caching patterns'},
{t:[['Pattern','How','Trade-off'],
['Lazy loading (cache aside)','Read cache, on miss read DB and populate','Stale data possible, first request slow'],
['Write-through','Write to cache and database together','Always fresh, more write cost'],
['TTL','Expire entries after a time','Bounds staleness']]},
{h:'Operating it'},
{ul:['**Replication group** with a primary and replicas in different AZs, with automatic failover.','**Cluster mode** (sharding) spreads keys over shards for memory and write scale.','Scale vertically (node size) or horizontally (shards and replicas). Serverless options scale automatically.','Monitor **EngineCPUUtilization**, **DatabaseMemoryUsagePercentage**, **Evictions**, **CurrConnections** and **ReplicationLag**.','Encrypt in transit and at rest and place nodes in private subnets.']},
{note:'Evictions rising means the cache is too small for the working set or TTLs are missing. A cache that always misses adds latency without benefit.'}],
src:[['ElastiCache','https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html']]};

/* ---------- 10 ---------- */
L['aws:11:10']={blocks:[
{p:'**Practical:** build a Multi-AZ database, fail it over, scale it and restore it.'},
{flow:['Create a DB subnet group and a Multi-AZ PostgreSQL or MySQL instance in private subnets','Connect from an instance in the VPC and create sample data','Reboot with failover and measure how long reconnection takes','Resize the instance class and note the brief interruption','Create a read replica and compare the endpoints','Note the time, delete a row, then restore to a point in time to a new instance','Delete the instances, replica, snapshots and subnet group']},
{h:'Observations'},
{t:[['Test','Expect'],
['Failover','Same endpoint, 1 to 2 minutes of connection errors'],
['Replica','Reads succeed, writes fail'],
['PITR','New instance with the data before the delete']]},
{note:'Databases and snapshots continue to bill. Always remove the final snapshot unless you need it.'}],
src:[['RDS tutorials',K.RDS+'CHAP_Tutorials.html']]};
})();
