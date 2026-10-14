/* LearnSphere - AWS Administrator, Section 07: Amazon S3.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const model=K.dg(700,210,[
[10,10,680,190,'S3 data model',1],
[30,60,150,70,'Bucket|globally unique name,|one Region',2],[240,60,200,70,'Object|key + data + metadata|+ version ID',0],[500,60,170,70,'Prefix|part of the key,|not a real folder',0]],
[[180,95,240,95],[440,95,500,95]]);

const life=K.dg(700,190,[
[10,10,680,170,'Lifecycle: transition then expire',1],
[30,60,120,60,'Standard|day 0',0],[190,60,130,60,'Standard-IA|day 30',0],[360,60,130,60,'Glacier Flexible|day 90',0],[530,60,140,60,'Expire|day 365',2]],
[[150,90,190,90],[320,90,360,90],[490,90,530,90]]);

const rep=K.dg(700,200,[
[10,10,680,180,'Replication',1],
[30,60,170,70,'Source bucket|versioning on',0],[270,60,160,60,'Replication rule|filter, role, KMS',2],[500,60,170,70,'Destination bucket|same or other Region|versioning on',0]],
[[200,95,270,90],[430,90,500,95]]);

/* ---------- 0 ---------- */
L['aws:6:0']={blocks:[
{p:'**Amazon S3** stores **objects** in **buckets**. It offers practically unlimited capacity, 11 nines of durability and a simple HTTP API.'},
{svg:model},
{h:'Concepts'},
{t:[['Term','Meaning'],
['Bucket','Container with a globally unique name, created in one Region'],
['Object','Data plus metadata, up to 5 TB'],
['Key','The full name of the object inside the bucket'],
['Prefix','A leading part of a key, used like a folder path'],
['Version ID','Identifies a version when versioning is on'],
['Storage class','Cost and access tier of an object']]},
{h:'Consistency'},
{p:'S3 provides **strong read-after-write consistency** for all operations, including overwrites, deletes and listings. A successful write is immediately visible to subsequent reads.'},
{h:'Storage class families'},
{t:[['Family','Access','Examples'],
['Frequent','Milliseconds','Standard'],
['Intelligent','Automatic tiering','Intelligent-Tiering'],
['Infrequent','Milliseconds, retrieval fee','Standard-IA, One Zone-IA'],
['Archive','Minutes to hours','Glacier Instant, Flexible, Deep Archive']]}],
src:[['What is Amazon S3',K.S3+'Welcome.html'],['S3 consistency',K.S3+'Welcome.html#ConsistencyModel']]};

/* ---------- 1 ---------- */
L['aws:6:1']={blocks:[
{p:'New buckets are created with secure defaults. Know them and why you rarely change them.'},
{h:'Defaults for new buckets'},
{ul:['**Block Public Access** is on for all four settings.','**ACLs are disabled** (Object Ownership: Bucket owner enforced), so the bucket owner owns all objects and access is controlled by policies.','**Default encryption** with SSE-S3 is applied to new objects.']},
{h:'Naming and Region'},
{ul:['3 to 63 characters, lowercase letters, numbers, dots and hyphens.','The name is unique across all AWS accounts in a partition.','Choose the Region for latency, compliance and cost. It cannot be changed later.']},
{code:`aws s3api create-bucket --bucket acme-logs-eu-prod --region eu-west-1 \\
  --create-bucket-configuration LocationConstraint=eu-west-1
aws s3api get-public-access-block --bucket acme-logs-eu-prod
aws s3api put-public-access-block --bucket acme-logs-eu-prod --public-access-block-configuration \\
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true`},
{note:'Set Block Public Access at the **account** level too, so no bucket can be made public by accident. Serve public websites through CloudFront with Origin Access Control instead of a public bucket.'}],
src:[['Block Public Access',K.S3+'access-control-block-public-access.html'],['Object Ownership',K.S3+'about-object-ownership.html']]};

/* ---------- 2 ---------- */
L['aws:6:2']={blocks:[
{p:'The storage class sets **price per GB**, **retrieval fees**, **minimum storage duration** and **access time**. Picking the right class is the largest S3 cost lever.'},
{t:[['Class','Use','Retrieval','Min duration'],
['Standard','Frequently accessed','Immediate','None'],
['Intelligent-Tiering','Unknown or changing access','Immediate (automatic tiers)','None'],
['Standard-IA','Infrequent, needs quick access','Immediate, per-GB fee','30 days'],
['One Zone-IA','Reproducible infrequent data, one AZ','Immediate, per-GB fee','30 days'],
['Glacier Instant Retrieval','Archive with millisecond access','Immediate','90 days'],
['Glacier Flexible Retrieval','Archive, minutes to hours','Minutes to 12 hours','90 days'],
['Glacier Deep Archive','Long-term archive','12 to 48 hours','180 days']]},
{h:'Intelligent-Tiering'},
{p:'Objects move automatically between access tiers (frequent, infrequent, archive instant) based on access, with no retrieval charge. There is a small monthly monitoring fee per object, and objects below 128 KB are not monitored, so it pays off for **larger, unpredictable** data.'},
{note:'Small objects in IA classes are billed at a minimum size (128 KB) and short-lived objects are billed for the minimum duration. Do not move many small or short-lived objects to IA or Glacier.'},
{code:`aws s3 cp backup.tar s3://my-bucket/ --storage-class STANDARD_IA
aws s3api restore-object --bucket my-bucket --key old.zip \\
  --restore-request '{"Days":7,"GlacierJobParameters":{"Tier":"Standard"}}'`}],
src:[['Storage classes',K.S3+'storage-class-intro.html']]};

/* ---------- 3 ---------- */
L['aws:6:3']={blocks:[
{p:'**Lifecycle rules** move objects between classes and delete them automatically. They apply to current and noncurrent versions, incomplete multipart uploads and expired delete markers.'},
{svg:life},
{code:`{
  "Rules": [{
    "ID": "tier-and-expire-logs",
    "Status": "Enabled",
    "Filter": {"Prefix": "logs/"},
    "Transitions": [
      {"Days": 30, "StorageClass": "STANDARD_IA"},
      {"Days": 90, "StorageClass": "GLACIER"}
    ],
    "Expiration": {"Days": 365},
    "NoncurrentVersionExpiration": {"NoncurrentDays": 30},
    "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7}
  }]
}`},
{code:`aws s3api put-bucket-lifecycle-configuration --bucket my-bucket --lifecycle-configuration file://lifecycle.json`},
{h:'Points to remember'},
{ul:['Rules apply by **prefix**, **tag** or object size filter.','Transitions respect the minimum storage durations of the destination class.','Always add a rule to **abort incomplete multipart uploads**, they cost money and are invisible.','Lifecycle works daily and takes effect asynchronously.']}],
src:[['Lifecycle management',K.S3+'object-lifecycle-mgmt.html']]};

/* ---------- 4 ---------- */
L['aws:6:4']={blocks:[
{p:'**Versioning** keeps every version of every object, so overwrites and deletes are recoverable. Once enabled it can only be **suspended**, not removed.'},
{h:'Behaviour'},
{t:[['Action','Without versioning','With versioning'],
['Overwrite (PUT)','Old data is replaced','New version created, old version kept'],
['Delete (no version ID)','Object removed','A **delete marker** becomes the current version'],
['Delete with version ID','Not applicable','That version is permanently deleted']]},
{flow:['Enable versioning on the bucket','A user deletes an object and a delete marker hides it','To restore, delete the delete marker or copy a previous version','Use lifecycle rules to remove old noncurrent versions so cost stays controlled']},
{code:`aws s3api put-bucket-versioning --bucket my-bucket --versioning-configuration Status=Enabled
aws s3api list-object-versions --bucket my-bucket --prefix report.csv
aws s3api delete-object --bucket my-bucket --key report.csv --version-id <delete-marker-id>`},
{h:'Protection'},
{ul:['**MFA Delete** requires MFA to change versioning state or delete versions. It can only be enabled by the root user with the CLI.','**Object Lock** (WORM) enforces retention for compliance and ransomware protection, and requires versioning.']},
{note:'Versioning increases storage cost. Combine it with a noncurrent version expiration rule.'}],
src:[['Versioning',K.S3+'Versioning.html'],['Object Lock',K.S3+'object-lock.html']]};

/* ---------- 5 ---------- */
L['aws:6:5']={blocks:[
{p:'S3 access is controlled by **identity policies**, **bucket policies** and, for sharing datasets, **access points**. Legacy **ACLs** are best disabled.'},
{h:'Mechanisms'},
{t:[['Mechanism','Where','Use'],
['IAM identity policy','Attached to users and roles','What this principal may do'],
['Bucket policy','On the bucket','Cross-account, conditions, org-wide rules'],
['Access point','Named endpoint with own policy','Give each team or app a scoped view of a shared bucket'],
['Object ownership (ACLs disabled)','Bucket setting','Simplify: bucket owner owns every object'],
['VPC endpoint policy','On the endpoint','Limit which buckets a VPC can reach']]},
{h:'Useful bucket policy patterns'},
{code:`{
  "Version": "2012-10-17",
  "Statement": [
    {"Sid": "DenyInsecureTransport", "Effect": "Deny", "Principal": "*",
     "Action": "s3:*", "Resource": ["arn:aws:s3:::my-bucket","arn:aws:s3:::my-bucket/*"],
     "Condition": {"Bool": {"aws:SecureTransport": "false"}}},
    {"Sid": "OnlyMyOrg", "Effect": "Deny", "Principal": "*",
     "Action": "s3:*", "Resource": "arn:aws:s3:::my-bucket/*",
     "Condition": {"StringNotEquals": {"aws:PrincipalOrgID": "o-abc123"}}}
  ]
}`},
{note:'Presigned URLs give time-limited access using the signer permissions. They stop working if the signing role or credentials expire, even before the URL expiry time.'}],
src:[['Bucket policies',K.S3+'bucket-policies.html'],['Access points',K.S3+'access-points.html']]};

/* ---------- 6 ---------- */
L['aws:6:6']={blocks:[
{p:'S3 encrypts objects at rest with **server-side encryption (SSE)**. Since 2023 every new object is encrypted with SSE-S3 by default. You choose who manages the key.'},
{t:[['Option','Key managed by','Notes'],
['SSE-S3','S3','Default, no extra cost, no per-request key audit'],
['SSE-KMS','KMS key (AWS managed or customer managed)','Key policy control, CloudTrail audit, per-request KMS cost'],
['DSSE-KMS','KMS, two layers','Dual-layer encryption for specific compliance needs'],
['SSE-C','You supply the key on each request','AWS does not store the key. Rarely chosen']]},
{h:'Bucket Keys'},
{p:'With SSE-KMS every object operation can call KMS. An **S3 Bucket Key** lets S3 create a short-lived key from the KMS key and reuse it, cutting KMS request cost by up to about **99 percent** for high-volume buckets.'},
{code:`aws s3api put-bucket-encryption --bucket my-bucket --server-side-encryption-configuration '{
  "Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms","KMSMasterKeyID":"alias/s3-data"},
            "BucketKeyEnabled":true}]}'`},
{note:'Cross-account readers of an SSE-KMS object need permission on the **KMS key** as well as on the object. A missing key policy causes confusing AccessDenied errors.'}],
src:[['Server-side encryption',K.S3+'serv-side-encryption.html'],['Bucket Keys',K.S3+'bucket-key.html']]};

/* ---------- 7 ---------- */
L['aws:6:7']={blocks:[
{p:'**Replication** copies new objects to another bucket automatically, in the same Region (SRR) or a different Region (CRR). Use it for compliance, latency, log aggregation and data protection.'},
{svg:rep},
{h:'Prerequisites'},
{ul:['**Versioning** enabled on both source and destination.','An **IAM role** S3 can assume to read the source and write to the destination.','KMS permissions if objects are encrypted with SSE-KMS.','Replication applies to **new objects** after the rule is created. Use Batch Replication for existing ones.']},
{h:'Behaviour'},
{ul:['Delete markers can be replicated optionally. Version deletions are not.','Replication is asynchronous. **Replication Time Control (RTC)** targets 15 minutes for 99.99% of objects and emits metrics and events.','You can change storage class and ownership of replicas.']},
{code:`aws s3api put-bucket-replication --bucket src-bucket --replication-configuration file://replication.json
aws s3api head-object --bucket src-bucket --key file.txt --query ReplicationStatus`},
{note:'Replication status values are PENDING, COMPLETED, FAILED and REPLICA. A FAILED status usually means a missing permission or KMS key access.'}],
src:[['Replication',K.S3+'replication.html']]};

/* ---------- 8 ---------- */
L['aws:6:8']={blocks:[
{p:'S3 scales horizontally. For speed, **parallelize** and move data closer to the bucket.'},
{t:[['Technique','What it does','When'],
['Multipart upload','Splits a large object into parts uploaded in parallel and retried independently','Objects over 100 MB, required over 5 GB'],
['Transfer Acceleration','Uses CloudFront edge locations to enter the AWS network sooner','Long-distance uploads'],
['Byte-range fetch','Downloads parts of an object in parallel or reads only a range','Large downloads, partial reads'],
['Prefix parallelism','Request rates scale per prefix: 3,500 writes and 5,500 reads per second each','Very high request rates'],
['S3 Express One Zone','Single-digit millisecond directory buckets in one AZ','Latency-sensitive workloads']]},
{code:`aws configure set default.s3.multipart_threshold 64MB
aws configure set default.s3.max_concurrent_requests 20
aws s3api put-bucket-accelerate-configuration --bucket my-bucket --accelerate-configuration Status=Enabled
aws s3 cp big.iso s3://my-bucket/ --endpoint-url https://my-bucket.s3-accelerate.amazonaws.com`},
{note:'Add a lifecycle rule to abort incomplete multipart uploads. Orphaned parts are billed but do not appear in a normal listing.'}],
src:[['Performance guidelines',K.S3+'optimizing-performance.html']]};

/* ---------- 9 ---------- */
L['aws:6:9']={blocks:[
{p:'**Practical:** build a bucket with encryption, versioning, a lifecycle rule and replication, then test recovery.'},
{flow:['Create a source bucket with default encryption and Block Public Access on','Enable versioning and upload a file twice with different content','Add a lifecycle rule for noncurrent versions and multipart cleanup','Create a destination bucket in another Region with versioning','Configure replication with an IAM role and upload a new object','Delete the object and recover it by removing the delete marker','Empty both buckets including versions, then delete them']},
{h:'Expected results'},
{t:[['Step','Check'],
['Versioning','list-object-versions shows two versions'],
['Replication','head-object shows COMPLETED, destination has the object'],
['Delete marker','Object returns after removing the marker'],
['Cleanup','Use the console Empty action or delete versions in a script']]},
{note:'A bucket with versions or delete markers cannot be deleted until every version is removed.'}],
src:[['Tutorials',K.S3+'tutorials.html']]};
})();
