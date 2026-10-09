/* LearnSphere - Amazon Redshift, Section 13: Backup, Recovery & High Availability.
   Lectures 0-7 are core, 8-12 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const snaps=R.dg(700,250,[
[10,10,680,230,'Provisioned snapshot lifecycle',1],
[30,60,150,60,'Automated snapshot|about every 8 hours|or 5 GB per node',2],[250,60,150,60,'Retention ends|(default 1 day)',0],[470,60,200,60,'Deleted by Redshift|(you cannot delete it)',0],
[30,155,150,55,'Copy to manual|snapshot',0],[250,155,150,55,'Kept until you|delete it (default)',2],[470,155,200,55,'Restore creates a|NEW cluster',2]],
[[180,90,250,90],[400,90,470,90],[105,120,105,155],[180,182,250,182],[400,182,470,182]]);

const dr=R.dg(700,270,[
[10,10,330,250,'Region A (primary)',1],[360,10,330,250,'Region B (recovery)',1],
[30,50,290,50,'Warehouse, 2 or 3 AZs',2],[30,115,290,50,'Automated and manual snapshots',0],[30,180,290,50,'KMS key in Region A',0],
[380,50,290,50,'Copied snapshots (own retention)',2],[380,115,290,50,'Restore on failover = new warehouse',0],[380,180,290,50,'KMS key and grant in Region B',0]],
[[320,140,380,140]]);

/* ================= LECTURE 0 ================= */
L['rs:12:0']={blocks:[
{p:'Backups for a provisioned cluster are **snapshots**: point-in-time copies stored by Redshift in S3. The first is a full backup. After that they are **incremental**, tracking only changes. There are two kinds.'},
{svg:snaps},
{h:'Automated snapshots'},
{ul:['Taken **automatically** by Redshift, by default about **every 8 hours or after every 5 GB of data change per node**, whichever comes first. If your data is bigger than 5 GB x number of nodes, the shortest gap between automated snapshots is 15 minutes.','Retention defaults to **1 day**. For RA3 and RG you can set 1 to 35 days. You **cannot turn off** automated snapshots on RA3 or RG.','You cannot delete an automated snapshot by hand. Redshift deletes them at the end of retention, when you delete the cluster, or when you disable them where allowed.','The latest automated snapshot is kept until you disable snapshots or delete the cluster.','A paused cluster takes no automated snapshots, except for a paused **data sharing producer**, which still gets them because consumers can write to it.']},
{h:'Manual snapshots'},
{ul:['Taken whenever you ask, for example before a risky change.','Kept **indefinitely by default**, even after you delete the cluster, unless you set a retention period.','There is a **quota** on manual snapshots per account per Region.','You can turn an automated snapshot into a manual one to keep it longer.']},
{code:`# Take a manual snapshot, kept 90 days
aws redshift create-cluster-snapshot --cluster-identifier dwh-prod \\
  --snapshot-identifier dwh-prod-pre-release-2026-10-09 --manual-snapshot-retention-period 90

# Change the automated retention
aws redshift modify-cluster --cluster-identifier dwh-prod --automated-snapshot-retention-period 14

# See what you have
aws redshift describe-cluster-snapshots --cluster-identifier dwh-prod --snapshot-type automated
aws redshift describe-cluster-snapshots --cluster-identifier dwh-prod --snapshot-type manual`},
{h:'Excluding tables'},
{p:'`BACKUP NO` on a staging table keeps it out of snapshots on older node types. **It is not supported on RA3, RG or Serverless.** There, a table marked `BACKUP NO` is backed up anyway. To avoid paying to back up scratch data, `TRUNCATE` or drop it before the snapshot.'},
{note:'Before you delete a cluster, take a **final snapshot** (the console asks). Without it, only the existing snapshots remain. Deleting a cluster does not delete its manual snapshots, but it does delete its automated ones.'}],
src:[['Snapshots and backups',MG+'working-with-snapshots.html'],['AWS Backup integration',MG+'managing-aws-backup.html']]};

/* ================= LECTURE 1 ================= */
L['rs:12:1']={blocks:[
{p:'The default snapshot timing depends on data change and may not match your recovery goal. A **snapshot schedule** lets you decide exactly when automated snapshots happen. Retention is set separately.'},
{h:'Rules for schedules'},
{ul:['A schedule is a set of rules, such as "every 12 hours" or a **cron** expression. Times are **UTC**.','The most often you can take snapshots on a custom schedule is **once per hour**. The least often is once per **24 hours**.','Overlapping rules that put snapshots less than an hour apart fail validation.','Attach one schedule to many clusters. Changing the schedule changes it for all of them.','A cluster with no schedule attached uses the default one.']},
{code:`# Two rules in one schedule: weekday office hours twice, and weekends once
aws redshift create-snapshot-schedule --schedule-identifier biz-hours \\
  --schedule-definitions "cron(0 9,17 MON-FRI)" "cron(0 17 SAT,SUN)"

aws redshift modify-cluster-snapshot-schedule --cluster-identifier dwh-prod --schedule-identifier biz-hours`},
{p:'Follow the cron format shown in the AWS documentation (modified Unix style with minutes, hours and day-of-week). Check the examples there when you write your own.'},
{h:'Match schedule and retention to the recovery goal'},
{t:[['Goal','Schedule','Retention'],
['Lose at most about 1 hour of data after a mistake','Every hour (the minimum gap)','At least 2 to 7 days so you can look back'],
['Daily protection, low cost','Once a day at a quiet time','7 to 14 days'],
['Month-end or audit copies','Manual snapshot after the close','Months, with a clear delete date'],
['Before a release or migration','Manual snapshot, name it with the ticket','Short, then delete']]},
{h:'Retention and cost'},
{ul:['Longer retention means more stored snapshot data. Set it to what you need, not "as long as possible".','Automated retention is 1 to 35 days for RA3 and RG. Copy a snapshot to a manual one for anything longer.','Use **AWS Backup** if you want one policy for many services, including long retention and vaults.','Name manual snapshots with date and purpose, and tag them with an owner.']},
{note:'A snapshot is not a replacement for good change control. Snapshot before risky changes anyway, since a manual snapshot is the cleanest rollback point.'}],
src:[['Automated snapshot schedules',MG+'working-with-snapshots.html#automated-snapshot-schedules'],['create-snapshot-schedule','https://docs.aws.amazon.com/cli/latest/reference/redshift/create-snapshot-schedule.html']]};

/* ================= LECTURE 2 ================= */
L['rs:12:2']={blocks:[
{p:'**Restoring never overwrites** a provisioned cluster. It creates a **new** cluster from a snapshot. The new cluster becomes available **before all the data is loaded**: it streams blocks from the snapshot on demand for queries and fills in the rest in the background. So you can start querying quickly, with slower first reads.'},
{h:'Restore a provisioned cluster'},
{code:`aws redshift restore-from-cluster-snapshot \\
  --cluster-identifier dwh-prod-restored \\
  --snapshot-identifier rs:dwh-prod-2026-10-09-04-02-11 \\
  --node-type ra3.xlplus --number-of-nodes 2 \\
  --cluster-subnet-group-name private-subnets \\
  --vpc-security-group-ids sg-0123456789abcdef0 \\
  --cluster-parameter-group-name prod-params \\
  --iam-roles arn:aws:iam::111122223333:role/RedshiftCopyRole \\
  --no-publicly-accessible`},
{h:'After the restore: check these'},
{t:[['Item','Why'],
['**Endpoint**','It is a new cluster with a new endpoint. Applications must be repointed (or use a DNS CNAME you control)'],
['Parameter group, subnet group, security groups','Pass them in the request and verify, so the restored cluster is not left on defaults'],
['IAM roles for COPY, UNLOAD and Spectrum','Attach again if they are not carried over'],
['Audit logging, event subscriptions, alarms','Confirm they still point at the right cluster name'],
['Snapshot schedule and retention','Re-attach so the new cluster is protected'],
['Database users, roles and permissions','They come back with the data, but check federated and IAM-mapped identities'],
['Integrations and data shares','Check each one (see the zero-ETL lecture and Section 14)'],
['Node count and size','You can choose a different node type or count, within what the snapshot data needs']]},
{h:'Serverless, in short'},
{ul:['Restoring a snapshot into a Serverless **namespace replaces its current database** with the snapshot contents.','It happens in two phases: the data is available for queries in minutes, then a **tuning phase** runs for hours to days, and for very large data sets, even a couple of weeks, with performance improving as it goes.','You can restore a Serverless snapshot to a provisioned cluster (pick node type and count), or a provisioned snapshot to a Serverless namespace. Tables with interleaved sort keys become compound when moved to Serverless.']},
{code:`aws redshift-serverless restore-from-snapshot --namespace-name analytics-ns --workgroup-name analytics-wg \\
  --snapshot-name analytics-pre-release --owner-account 111122223333`},
{note:'If you want to keep the current database while you check an older state, restore into a **different** namespace or cluster first, compare, then decide. A restore into the live Serverless namespace discards what is there.'}],
src:[['Restoring a cluster from a snapshot',MG+'managing-snapshots-console.html'],['Restoring a Serverless snapshot',MG+'serverless-snapshot-restore.html'],['restore-from-cluster-snapshot','https://docs.aws.amazon.com/cli/latest/reference/redshift/restore-from-cluster-snapshot.html']]};

/* ================= LECTURE 3 ================= */
L['rs:12:3']={blocks:[
{p:'Someone dropped or damaged **one table**. A full restore would be too heavy. Redshift can restore a **single table** from a snapshot into a running cluster, under a **new name**, so you can compare it and swap it in.'},
{h:'How it works'},
{flow:['Pick a snapshot from before the damage','Restore the table under a new name','Compare it with the current table','Swap names or copy rows back','Re-apply grants']},
{code:`aws redshift restore-table-from-cluster-snapshot --cluster-identifier dwh-prod \\
  --snapshot-identifier rs:dwh-prod-2026-10-09-04-02-11 \\
  --source-database-name dev --source-schema-name sales --source-table-name orders \\
  --target-database-name dev --target-schema-name sales --new-table-name orders_restored

aws redshift describe-table-restore-status --cluster-identifier dwh-prod`},
{code:`-- Swap after checking the restored data
BEGIN;
ALTER TABLE sales.orders RENAME TO orders_damaged;
ALTER TABLE sales.orders_restored RENAME TO orders;
COMMIT;
-- Re-apply grants, RLS and masking policies, then drop orders_damaged when you are sure.`},
{h:'Limits to know (provisioned)'},
{ul:['You restore **one table at a time**, into the **same running cluster** the snapshot came from.','The new table name must not already exist. Rename or drop the old one first.','You cannot restore from a snapshot taken before a **resize** (an elastic resize that did not change the node type is an exception).','The restored table has **no foreign keys** from the source, and no **dependent objects**: views and **permissions** are not applied.','Tables with **interleaved sort keys** cannot be restored this way.','You cannot restore a table from an unencrypted cluster to an encrypted one.']},
{h:'Serverless'},
{p:'The Serverless guide has a table restore too, from a **snapshot or a recovery point**, again with a new table name and without dependent objects. If row-level security is on for the table, the restored table has it on. Check the Serverless guide for the current command names.'},
{note:'A table restore is cheaper than a full restore but still reads from snapshot storage. Test the time on a large table in a drill (lecture 11), so you know whether it meets your recovery target.'}],
src:[['Restoring a table from a snapshot',MG+'working-with-snapshot-restore-table-from-snapshot.html'],['Restoring a table in Serverless',MG+'serverless-table-restore.html']]};

/* ================= LECTURE 4 ================= */
L['rs:12:4']={blocks:[
{p:'Redshift Serverless protects you with two kinds of backup. **Recovery points** are created for you. **Snapshots** are the ones you create to keep longer.'},
{t:[['','Recovery point','Snapshot'],
['Created by','Redshift automatically','You, or you convert a recovery point'],
['Frequency','About every **30 minutes** or after every 5 GB of change per node, whichever is first. Not less than 15 minutes apart for large data','On demand'],
['Retention','**24 hours**, fixed','Until you delete it, or the retention period you set'],
['Can you schedule?','**No**. You cannot set your own schedule for recovery points','Schedule with your own automation or AWS Backup'],
['Use','Undo a recent mistake','Release points, month-end, audit and disaster recovery']]},
{h:'Common tasks'},
{code:`aws redshift-serverless list-recovery-points --namespace-name analytics-ns

# Keep a recovery point longer by turning it into a snapshot
aws redshift-serverless convert-recovery-point-to-snapshot --recovery-point-id <id> \\
  --snapshot-name keep-before-migration --retention-period 30

# Take a snapshot now
aws redshift-serverless create-snapshot --namespace-name analytics-ns --snapshot-name pre-release --retention-period 30

# Restore a recovery point into the namespace (replaces its database)
aws redshift-serverless restore-from-recovery-point --namespace-name analytics-ns --workgroup-name analytics-wg \\
  --recovery-point-id <id>`},
{h:'What this means for your recovery goal'},
{ul:['**Roughly 30 minutes** of data loss at worst for a mistake in the last 24 hours, and often less when data changes quickly.','Anything older than a day needs a **snapshot**. If you want daily restore points for weeks, automate snapshot creation, for example with an EventBridge scheduled rule and a Lambda function or AWS Backup.','Snapshots and recovery points use managed storage. They are encrypted with the namespace key (Section 11).','You can **tag** snapshots and recovery points with owner and purpose, and share snapshots with other accounts (lecture 9).']},
{note:'Do not rely on recovery points for compliance copies. They disappear after 24 hours. Convert or snapshot anything you must keep.'}],
src:[['Snapshots and recovery points',MG+'serverless-snapshots-recovery-points.html'],['Restoring a snapshot',MG+'serverless-snapshot-restore.html']]};

/* ================= LECTURE 5 ================= */
L['rs:12:5']={blocks:[
{p:'A snapshot stored in the same Region as the warehouse will not help if the whole Region has a problem. **Cross-Region snapshot copy** automatically copies snapshots to a second Region so you can restore there.'},
{svg:dr},
{h:'Provisioned behaviour'},
{ul:['Enabled per cluster, with **one destination Region** at a time. To change the Region, turn copy off and on again.','Both **automated and manual** snapshots can be copied. A copied snapshot becomes available for restore once it arrives.','Copied automated snapshots have their **own retention** (default **7 days**), separate from the source Region. Manual snapshots stay until their retention ends or you delete them.','When you disable copy, copied automated snapshots expire on schedule. Manual copies stay until you delete them.']},
{code:`# Unencrypted, or encrypted with a Region-owned key in the destination
aws redshift enable-snapshot-copy --cluster-identifier dwh-prod --destination-region eu-central-1 \\
  --retention-period 7 --manual-snapshot-retention-period 30 --region eu-west-1

# Encrypted with your own key: create the grant in the destination first (Section 11)
aws redshift create-snapshot-copy-grant --snapshot-copy-grant-name dr-grant --kms-key-id <dest-key-arn> --region eu-central-1
aws redshift enable-snapshot-copy --cluster-identifier dwh-prod --destination-region eu-central-1 \\
  --snapshot-copy-grant-name dr-grant --region eu-west-1`},
{h:'Serverless'},
{p:'Serverless can also copy snapshots across Regions through a snapshot copy configuration on the namespace. Use the Serverless CLI reference for the exact commands and the retention it supports.'},
{h:'Design points'},
{ul:['Data transfer between Regions and storage in the second Region both cost money (lecture 12).','A big first copy takes time. Measure how far behind the copy runs, because that lag adds to your RPO.','If the source cluster is encrypted with KMS, you cannot rename it while copy is on (Section 11).','Restores in the second Region create a **new** warehouse with a new endpoint. Networking, roles and parameter groups must already exist there.','Alarm on the event "cross-region snapshot copy is not enabled" and on copy failures.']}],
src:[['Copying a snapshot to another Region',MG+'cross-region-snapshot-copy.html'],['Encrypted snapshot copy grants',MG+'working-with-db-encryption.html#configure-snapshot-copy-grant']]};

/* ================= LECTURE 6 ================= */
L['rs:12:6']={blocks:[
{p:'Hardware fails. What matters is how long your users notice. Redshift protects you at three levels: node replacement, Availability Zone relocation and **Multi-AZ**.'},
{h:'Node failure'},
{ul:['Redshift monitors nodes. A failed node is **replaced automatically** and you get an event (for example "a node was automatically replaced"). Queries on that node can fail and need a retry.','With RA3 and RG, data lives in managed storage, so replacement does not mean rebuilding data from local disks.','If a single-node cluster fails, you may need to restore from the latest snapshot, which the events tell you.','Events about hardware issues are worth sending to your on-call channel (Section 12).']},
{h:'AZ relocation (single-AZ, RA3)'},
{p:'With AZ relocation turned on, Redshift can move a cluster to another Availability Zone if its AZ has a problem, keeping the same endpoint. You can also request a relocation yourself. It is a recovery action, so expect a short outage while it moves.'},
{h:'Multi-AZ'},
{ul:['Available for **provisioned RG and RA3** clusters. Compute runs in **two AZs** behind **one endpoint**. If an AZ fails, the other keeps processing.','AWS states **zero RPO** (data is in shared managed storage) and a service level agreement of **99.99%**, compared with 99.9% for single-AZ.','The same hourly compute rate applies per RG or RA3 node, and storage is shared. In practice you pay for **nodes in both AZs**, and converting an existing cluster may require doubling the nodes to keep query performance.','You cannot make a single-node Multi-AZ deployment: use two or more nodes per AZ.','**Encryption is mandatory**. The subnet group must offer at least **three AZs**. You cannot pause or resume a Multi-AZ warehouse, and there are port range limits.','Monitoring uses **SYS** views, since older STL, SVL and STV views are not supported there (Section 12).','AWS recommends **snapshot isolation** with Multi-AZ (Section 9).','Failover is not invisible. Connections drop and running queries in the failed AZ fail, so applications must **reconnect and retry**.']},
{code:`aws redshift create-cluster --cluster-identifier dwh-ha --node-type ra3.xlplus --number-of-nodes 2 \\
  --multi-az --encrypted --master-username awsuser --manage-master-password

aws redshift modify-cluster --cluster-identifier dwh-prod --multi-az    # convert (check node count first)`},
{note:'Multi-AZ protects against an AZ failure, not against a bad `DELETE` or a Region outage. You still need snapshots and, for Region risk, cross-Region copy.'}],
src:[['Multi-AZ deployments',MG+'managing-cluster-multi-az.html'],['Setting up Multi-AZ',MG+'overview-multi-az.html'],['Event notifications',MG+'working-with-event-notifications.html']]};

/* ================= LECTURE 7 ================= */
L['rs:12:7']={blocks:[
{p:'Before choosing features, define what you must achieve. Two numbers drive the design.'},
{t:[['Term','Question it answers','Example'],
['**RPO** (recovery point objective)','How much data can we afford to lose, measured in time?','"No more than 1 hour of data"'],
['**RTO** (recovery time objective)','How long can the service be down?','"Back within 2 hours"']]},
{h:'Types of failure'},
{t:[['Failure','Likely cause','Main protection'],
['Node or hardware','Hardware fault','Automatic replacement'],
['Availability Zone','Power, network, building','**Multi-AZ** (provisioned) or AZ relocation. Serverless uses subnets in several AZs'],
['Human or application error','Bad delete, bad deploy, bad load','Snapshots, recovery points, table restore'],
['Region','Large regional event','Cross-Region snapshot copy and a second-Region restore plan'],
['Account or key','Compromise, deleted KMS key','Cross-account copy, protected keys, separate backup account']]},
{h:'Matching features to goals'},
{t:[['Feature','Typical RPO','Typical RTO'],
['Automated snapshot only','Up to the snapshot gap (hours)','Restore time. Query access is quick, full speed later'],
['Custom hourly schedule','About 1 hour','Same'],
['Serverless recovery points','About 30 minutes, for the last 24 hours','Restore time'],
['Multi-AZ','Zero for AZ failure','Minutes, with reconnect'],
['Cross-Region snapshot copy','Source gap plus copy lag','Detect, decide, restore, repoint applications'],
['Second warehouse fed by the same pipeline','Minutes (pipeline lag)','Switch DNS or connection string']]},
{p:'These are guides, not promises. Your real numbers come from testing (lecture 11).'},
{h:'Steps to a DR plan'},
{flow:['Agree RPO and RTO with the business','List failure types you will cover','Choose features and set the schedule and retention','Write the runbook','Test it and record the real times','Review after every change']},
{note:'Backups protect the **warehouse**. They do not protect the **source systems and pipelines**. Include the ETL code, schedules, secrets and IAM roles in the plan, or the restored warehouse will sit empty.'}],
src:[['Reliability pillar: disaster recovery','https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/plan-for-disaster-recovery-dr.html'],['Multi-AZ deployments',MG+'managing-cluster-multi-az.html'],['Snapshots and backups',MG+'working-with-snapshots.html']]};

/* ================= LECTURE 8 ================= */
L['rs:12:8']={blocks:[
{p:'Choose the DR pattern from the RPO and RTO, then from the budget. Two patterns cover most needs.'},
{h:'Pattern 1: Active-passive with snapshots (backup and restore)'},
{ul:['Primary warehouse in Region A. Cross-Region snapshot copy sends snapshots to Region B.','On disaster: restore the newest copied snapshot in Region B, then repoint applications.','**Lowest cost**: you pay for snapshot storage and transfer, not a second warehouse.','RTO is the restore and verification time plus the time to decide and switch. RPO is the snapshot gap plus copy lag.']},
{h:'Pattern 2: Active-passive with a warm standby'},
{ul:['A second warehouse in Region B runs all the time (or small, or Serverless) and receives data through the same pipeline, or loads from copied S3 files.','Failover is mostly a DNS or connection-string switch. RTO is short, and RPO is the pipeline lag.','Costs more, and you must keep both in step: schema, users, roles, parameter groups.']},
{h:'Active-active'},
{p:'Both warehouses serve users. You must handle double writes or partitioned ownership of data. It is the hardest and most expensive design, so use it only when the business requires it.'},
{h:'Cutover design'},
{ul:['Applications connect through a **DNS name you own** (a Route 53 record), not the Redshift endpoint directly. At failover you change the record.','Keep the DNS TTL short enough for your RTO.','Pre-create networking, KMS keys, IAM roles, parameter groups, secrets and event subscriptions in Region B using infrastructure as code.','Grant data share consumers and BI tools access to the new endpoint.']},
{flow:['Declare disaster','Restore the newest snapshot in Region B (or start the standby)','Check data counts and recent loads','Re-run missed loads from S3','Switch DNS and test applications','Record times and start failback planning']},
{h:'Failback'},
{p:'After the primary Region recovers you must move data back. Plan how you will copy changes made in Region B, because the old primary is out of date. Many teams stay in Region B and build a new standby in the old one.'},
{note:'The first real use of a DR plan should never be the real disaster. Run it quarterly (lecture 11).'}],
src:[['Copying a snapshot to another Region',MG+'cross-region-snapshot-copy.html'],['Restoring a cluster from a snapshot',MG+'managing-snapshots-console.html']]};

/* ================= LECTURE 9 ================= */
L['rs:12:9']={blocks:[
{p:'Sometimes you need to give another AWS account a copy of the data: a test account, a partner, or a **separate backup account** that an attacker who controls production cannot reach. Snapshot sharing does this without copying files by hand.'},
{h:'Steps for provisioned clusters'},
{flow:['Use a manual snapshot (copy an automated one first)','If encrypted, use a customer managed key and allow the other account to use it','Authorize the other account to restore','The other account restores, naming your account as owner']},
{code:`# Source account
aws redshift authorize-snapshot-access --snapshot-identifier dwh-prod-month-end \\
  --account-with-restore-access 444455556666

# Target account
aws redshift restore-from-cluster-snapshot --cluster-identifier dwh-from-prod \\
  --snapshot-identifier dwh-prod-month-end --owner-account 111122223333 \\
  --node-type ra3.xlplus --number-of-nodes 2

# Remove access when finished
aws redshift revoke-snapshot-access --snapshot-identifier dwh-prod-month-end --account-with-restore-access 444455556666`},
{h:'Rules and cautions'},
{ul:['Only **manual** snapshots are shared. Snapshots are shared inside a Region. For another Region, copy first.','Snapshots encrypted with an AWS-managed key cannot be shared across accounts. Use a **customer managed KMS key** and add the other account in the key policy or a grant (Section 11).','The restoring account pays for its restored warehouse. Check how snapshot storage is billed when sharing.','**Serverless** snapshots can be shared with other accounts too, and restored in the recipient account into a namespace.','A shared snapshot contains all the data. Mask or remove sensitive columns before you share it outside your organisation, or restore it only in accounts you control.']},
{h:'Backup account pattern'},
{ul:['A separate AWS account holds copies of critical snapshots, with strict IAM and key policies and restricted delete rights.','Automation in production shares a snapshot and the backup account copies it into its own snapshots.','If production is compromised, the copies remain safe. Test that you can restore from the backup account.']},
{note:'Treat sharing as a security event. Alert on `AuthorizeSnapshotAccess` in CloudTrail (Section 11) and review who has access regularly.'}],
src:[['Sharing snapshots',MG+'working-with-snapshots.html'],['Restoring a Serverless snapshot',MG+'serverless-snapshot-restore.html'],['authorize-snapshot-access','https://docs.aws.amazon.com/cli/latest/reference/redshift/authorize-snapshot-access.html']]};

/* ================= LECTURE 10 ================= */
L['rs:12:10']={blocks:[
{p:'A warehouse often receives data through **zero-ETL integrations** (from Aurora, RDS, DynamoDB or applications) and **S3 event integrations** that power auto-copy (Section 7). A restore creates a warehouse from a point in time, so these links need thought.'},
{h:'What AWS has announced'},
{ul:['In July 2026 AWS announced that **Redshift Serverless now preserves zero-ETL and S3 event integrations** when you restore a snapshot or recovery point **into the same namespace**. Before that, restored integrations were marked as failed and you had to recreate them.','This applies to the **same Serverless namespace**. Restoring into a different namespace, or restoring a **provisioned** cluster, does not keep them. Recreate the integrations there.','A third-party test says the behaviour needs a recent patch level. Confirm the patch and the current docs before you rely on it.']},
{note:'Treat anything not stated in AWS documentation as unconfirmed and verify it in a test restore. Integration behaviour changes between patches.'},
{h:'What to check after any restore'},
{t:[['Item','Question'],
['Zero-ETL integration','Is it active, or failed? Does the source still hold its replication slot or binlog position?'],
['History mode and destination database','Is the destination database present and complete? Check row counts against the source'],
['S3 event integration and auto-copy jobs','Are the copy jobs defined? Are new files still being loaded, and is anything missing from the gap?'],
['Streaming ingestion','Are the materialized views on streams refreshing, and from which offset?'],
['Data shares','Are producer and consumer shares still authorised? Consumers may need new namespace details'],
['Scheduled queries and external schemas','Do they still point at valid roles and endpoints?']]},
{h:'Gap handling'},
{p:'A restore goes back in time. Anything loaded after the snapshot must be loaded again. For zero-ETL and auto-copy, decide how to recover the gap: recreate the integration (which reloads the data), or load the missing files from S3 yourself and compare counts.'},
{code:`-- Look at integration health after a restore
SELECT * FROM svv_integration;                      -- zero-ETL integrations (check column names in your version)
SELECT * FROM sys_copy_job ORDER BY 1 DESC LIMIT 20;  -- auto-copy jobs
SELECT * FROM sys_copy_job_detail ORDER BY 1 DESC LIMIT 20;`}],
src:[['Zero-ETL integrations',MG+'zero-etl-using.html'],['Redshift Serverless preserves integrations during restores','https://aws.amazon.com/about-aws/whats-new/2026/07/redshift-serverless-zetl-autocopy-restore/'],['Auto-copy from S3',DG+'loading-data-copy-job.html']]};

/* ================= LECTURE 11 ================= */
L['rs:12:11']={blocks:[
{p:'A plan that has never been tested is a guess. Run a **DR test every quarter** and measure the real RPO and RTO. Do it in a test account, or in the recovery Region with production snapshots.'},
{h:'Before the test'},
{ul:['State the scenario (for example: "Region A is unavailable at 10:00").','Write the success criteria: RPO and RTO targets, and the list of checks.','Name a leader, a scribe and who does each step.','Warn users and make sure the test cannot write to production or send real emails.']},
{h:'Runbook outline'},
{flow:['T0: record time and the newest snapshot available','Restore into the recovery Region','Attach roles, parameter group, security groups, logging','Run checks: row counts, latest load, sample reports','Repoint a test application','Record the finish time']},
{code:`# Record the facts you need for RPO
aws redshift describe-cluster-snapshots --region eu-central-1 \\
  --query "reverse(sort_by(Snapshots,&SnapshotCreateTime))[0].{Id:SnapshotIdentifier,Created:SnapshotCreateTime,Status:Status}"

# Time the restore
date -u; aws redshift restore-from-cluster-snapshot ... ; aws redshift wait cluster-available --cluster-identifier dwh-dr-test; date -u`},
{p:'**Real RPO** is the time of the failure minus the time of the newest snapshot you could restore. **Real RTO** is the time from the decision to recover until applications work. Include the time to decide, which is often the longest part.'},
{h:'Checks after restore'},
{ul:['Row counts of key tables compared with the last known values.','The latest timestamp in the largest fact table.','A few business reports compared with production.','Users, roles and one RLS or masking rule behave as before.','Performance of the first heavy query (blocks are still streaming in).']},
{h:'After the test'},
{ul:['Delete the test warehouse and note the cost.','Write the findings: what broke, what was slow, what was missing from the runbook.','Fix them, update infrastructure as code, and set a date for the next test.']},
{note:'Also test the small things: a table restore, a restore from a recovery point and a restore in the backup account. These are the recoveries you will perform most often.'}],
src:[['Restoring a cluster from a snapshot',MG+'managing-snapshots-console.html'],['Reliability pillar: test reliability','https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/test-reliability.html']]};

/* ================= LECTURE 12 ================= */
L['rs:12:12']={blocks:[
{p:'Snapshots cost money in S3-backed storage, so protection should be deliberate. Know what you have, and delete what you do not need.'},
{h:'What costs money'},
{t:[['Item','Cost driver'],
['Automated snapshots','Storage for the retention period you set'],
['Manual snapshots','Kept until deleted, so forgotten ones keep costing'],
['Cross-Region copies','Storage in the second Region plus data transfer'],
['Serverless snapshots','Managed storage while they exist. Recovery points are kept 24 hours'],
['Shared snapshots','Charged to the owner, who must keep them']]},
{p:'Check the current Redshift pricing page for backup storage rates and how much is included for your node types or storage. Do not assume it from another service.'},
{h:'Find where the storage goes'},
{code:`aws redshift describe-storage          # total backup storage used in the account and Region

aws redshift describe-cluster-snapshots --snapshot-type manual \\
  --query "Snapshots[].{Id:SnapshotIdentifier,Cluster:ClusterIdentifier,Created:SnapshotCreateTime,Size:TotalBackupSizeInMegaBytes,Retention:ManualSnapshotRetentionPeriod}" \\
  --output table`},
{h:'Lifecycle rules'},
{ul:['Every manual snapshot gets a **retention period** when it is created, an owner tag and a purpose. Avoid "keep forever" unless a rule requires it.','Delete old manual snapshots in batches: `aws redshift batch-delete-cluster-snapshots`. Check the list before you delete.','Review snapshots of **deleted clusters**. Those are the ones nobody notices.','Reduce automated retention in non-production.','Truncate scratch tables before a snapshot on RA3, RG and Serverless, since `BACKUP NO` does not apply there.','For long retention with audit rules, consider AWS Backup with a vault and lifecycle policy.']},
{code:`# Delete two snapshots (review first!)
aws redshift batch-delete-cluster-snapshots --identifiers SnapshotIdentifier=old-snap-1 SnapshotIdentifier=old-snap-2`},
{h:'Monthly routine'},
{flow:['List manual snapshots and their age','Match each to an owner and a reason','Delete what has expired','Check cross-Region copies and cost','Record the storage trend']},
{note:'Deleting a snapshot is permanent. Keep the ones that your recovery goals and compliance rules need, and never delete the only copy of data you cannot rebuild.'}],
src:[['Snapshots and backups',MG+'working-with-snapshots.html'],['Redshift pricing','https://aws.amazon.com/redshift/pricing/'],['describe-storage','https://docs.aws.amazon.com/cli/latest/reference/redshift/describe-storage.html']]};
})();
