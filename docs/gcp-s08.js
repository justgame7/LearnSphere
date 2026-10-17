/* LearnSphere - Google Cloud, Section 08: Cloud Storage and File Storage.
   Lectures 0-7 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const model=K.dg(700,230,[
[10,10,680,210,'Project > bucket > objects',1],
[30,70,130,60,'Project|billing, IAM',0],[200,70,180,60,'Bucket|name, location, class',2],[420,40,240,40,'Object: images/logo.png',0],[420,100,240,40,'Object: reports/2026/q1.csv',0]],
[[160,100,200,100],[380,100,420,60],[380,100,420,120]]);

const classes=K.dg(700,250,[
[10,10,680,230,'Storage classes: colder is cheaper to store, costlier to read',1],
[30,60,150,120,'Standard|hot data|no minimum duration',2],
[200,60,150,120,'Nearline|monthly access|30 day minimum',0],
[370,60,150,120,'Coldline|quarterly access|90 day minimum',0],
[540,60,130,120,'Archive|yearly access|365 day minimum',0]],
[[180,120,200,120],[350,120,370,120],[520,120,540,120]]);

const locs=K.dg(700,230,[
[10,10,680,210,'Location types',1],
[30,60,190,120,'Region|one region|lowest cost,|data residency',0],
[250,60,190,120,'Dual-region|two chosen regions|HA with turbo option',0],
[470,60,200,120,'Multi-region|US, EU, ASIA|widest availability',2]],
[]);

const choose=K.dg(700,240,[
[10,10,680,220,'Which storage?',1],
[30,60,200,120,'Cloud Storage|objects|unlimited scale, HTTP API',2],
[250,60,200,120,'Persistent Disk|blocks for one VM|low latency boot and data',0],
[470,60,200,120,'Filestore|shared file system|NFS for many clients',0]],
[]);

/* ---------- 0 ---------- */
L['gcp:7:0']={blocks:[
{p:'**Cloud Storage** is Google Cloud\'s object storage. You store files as **objects** inside **buckets**, and access them over HTTP, the console, gcloud or client libraries. It is durable, scales without limit, and is used for backups, media, data lakes, static websites and exchange of data between services.'},
{svg:model},
{h:'Key facts'},
{ul:['Bucket names are **globally unique** and cannot be renamed.','An object is immutable. To change it you write a new version. Objects can be up to 5 TiB.','The namespace is flat: "folders" are only prefixes in object names (buckets with hierarchical namespace add real folders).','Strong consistency for reads after writes and listings.','Designed for 99.999999999% (11 nines) annual durability.','No file system semantics. To mount a bucket as a file system, use Cloud Storage FUSE, with caveats.']},
{h:'Location types'},
{svg:locs},
{t:[['Type','Description','Use'],
['Region','Data in one region','Lowest cost, data residency, compute in the same region'],
['Dual-region','Two specific regions, with optional turbo replication for faster sync','High availability and disaster recovery for analytics'],
['Multi-region','A large area with many regions: US, EU or ASIA','Serving content to users around the world']]},
{p:'The location cannot be changed after creation. Moving a bucket means copying data to a new bucket.'},
{h:'Everyday commands'},
{code:`gcloud storage buckets create gs://my-unique-bucket-123 --location=us-central1 --uniform-bucket-level-access
gcloud storage cp ./report.csv gs://my-unique-bucket-123/reports/
gcloud storage ls gs://my-unique-bucket-123/reports/
gcloud storage cp gs://my-unique-bucket-123/reports/report.csv ./local.csv
gcloud storage rm gs://my-unique-bucket-123/reports/report.csv
gcloud storage buckets describe gs://my-unique-bucket-123`},
{note:'`gcloud storage` is the current tool. The older `gsutil` still works but gcloud storage is faster and receives the new features.'}],
src:[['Cloud Storage overview',K.GCS+'introduction'],['Bucket locations',K.GCS+'locations']]};

/* ---------- 1 ---------- */
L['gcp:7:1']={blocks:[
{p:'**Storage classes** set the price and access characteristics of data. All classes offer the same low latency (milliseconds) and the same durability. The difference is cost per GB stored versus cost to read, and a minimum storage duration.'},
{svg:classes},
{t:[['Class','Intended access','Minimum duration','Storage cost','Retrieval cost'],
['Standard','Frequently accessed, short-lived','None','Highest','None'],
['Nearline','About once a month or less','30 days','Lower','Per GB read'],
['Coldline','About once a quarter or less','90 days','Lower still','Higher'],
['Archive','Less than once a year','365 days','Lowest','Highest']]},
{ul:['If you delete or move an object before the minimum duration, you are charged for the remainder.','Reading non-Standard data adds a **retrieval fee** per GB.','Class applies per object. A bucket has a default class for new objects.','There is no separate restore step. Archive data is available in milliseconds.']},
{h:'Changing class'},
{code:`gcloud storage buckets create gs://my-archive-123 --location=us --default-storage-class=COLDLINE
gcloud storage objects update gs://my-bucket/old/*.zip --storage-class=ARCHIVE
gcloud storage buckets update gs://my-bucket --enable-autoclass`},
{h:'Autoclass'},
{p:'**Autoclass** moves each object automatically between classes based on actual access. Objects that are not read drift colder. Objects that are read move back to Standard. It removes the need to guess lifecycle rules and avoids retrieval fees for the transitions.'},
{h:'Choosing'},
{t:[['Situation','Choice'],
['Active data, websites, analytics inputs','Standard'],
['Monthly reports, backups kept for recovery','Nearline'],
['Disaster recovery copies, quarterly access','Coldline'],
['Compliance archives, long-term retention','Archive'],
['Access pattern unknown or changing','Autoclass']]}],
src:[['Storage classes',K.GCS+'storage-classes'],['Autoclass',K.GCS+'autoclass']]};

/* ---------- 2 ---------- */
L['gcp:7:2']={blocks:[
{p:'Access to buckets and objects is controlled by IAM, plus a few Cloud Storage specific features. The goal is simple: private by default, shared deliberately.'},
{h:'Uniform bucket-level access'},
{p:'With **uniform bucket-level access**, only IAM controls access. Object ACLs are disabled. This is recommended because there is a single place to check and audit.'},
{code:`gcloud storage buckets update gs://my-bucket --uniform-bucket-level-access
gcloud storage buckets add-iam-policy-binding gs://my-bucket --member="group:analysts@example.com" --role="roles/storage.objectViewer"
gcloud storage buckets get-iam-policy gs://my-bucket`},
{t:[['Role','Allows'],
['storage.objectViewer','Read objects and list'],
['storage.objectCreator','Create objects only (no overwrite or delete)'],
['storage.objectUser','Read, write and delete objects'],
['storage.objectAdmin','Full control of objects'],
['storage.admin','Full control of buckets and objects']]},
{h:'Public access prevention'},
{ul:['**Public access prevention** blocks `allUsers` and `allAuthenticatedUsers` bindings on a bucket. Enforce it with an organization policy.','To make a website public, grant `roles/storage.objectViewer` to `allUsers` deliberately and only on that bucket.']},
{h:'Signed URLs'},
{p:'A **signed URL** gives time-limited access to one object to anyone who has the link, without a Google account. It is created with the credentials of a service account or a user, and expires (up to 7 days).'},
{code:`gcloud storage sign-url gs://my-bucket/report.pdf --duration=1h --impersonate-service-account=signer@my-project.iam.gserviceaccount.com`},
{h:'Other controls'},
{t:[['Control','Use'],
['IAM Conditions','Limit access by object prefix or time'],
['Managed folders','Grant IAM on a prefix as if it were a folder'],
['VPC Service Controls','Block exfiltration from the project perimeter'],
['CORS configuration','Allow browsers from other origins to read objects']]},
{note:'Most data leaks involve a bucket accidentally granted to allUsers. Enable public access prevention on the organization and review bindings with Cloud Asset Inventory.'}],
src:[['Uniform bucket-level access',K.GCS+'uniform-bucket-level-access'],['Signed URLs',K.GCS+'access-control/signed-urls'],['Public access prevention',K.GCS+'public-access-prevention']]};

/* ---------- 3 ---------- */
L['gcp:7:3']={blocks:[
{p:'**Object Lifecycle Management** lets you define rules that automatically change the class of objects or delete them as they age. It keeps storage cost down without scripts.'},
{h:'Rule parts'},
{t:[['Part','Examples'],
['Condition','age (days since creation), createdBefore, daysSinceNoncurrentTime, isLive, matchesStorageClass, matchesPrefix or suffix, numNewerVersions'],
['Action','Delete, SetStorageClass, AbortIncompleteMultipartUpload']]},
{code:`{
  "rule": [
    {"action": {"type": "SetStorageClass", "storageClass": "NEARLINE"}, "condition": {"age": 30, "matchesStorageClass": ["STANDARD"]}},
    {"action": {"type": "SetStorageClass", "storageClass": "COLDLINE"}, "condition": {"age": 90}},
    {"action": {"type": "Delete"}, "condition": {"age": 365}},
    {"action": {"type": "Delete"}, "condition": {"isLive": false, "numNewerVersions": 3}}
  ]
}`},
{code:`gcloud storage buckets update gs://my-bucket --lifecycle-file=lifecycle.json
gcloud storage buckets describe gs://my-bucket --format="default(lifecycle_config)"`},
{h:'How it behaves'},
{ul:['Rules are evaluated asynchronously. A change can take up to a day to apply.','Actions are not charged for transitions in the same way as manual rewrites, but class changes follow minimum durations.','You can only move to a colder class with SetStorageClass.','If several rules match, Delete wins over SetStorageClass.','Test with a prefix first. Deleted objects are not recoverable unless versioning or soft delete is on.']},
{h:'Common patterns'},
{t:[['Goal','Rule'],
['Expire logs after 90 days','Delete when age is 90'],
['Tier backups','Nearline at 30 days, Coldline at 90 days, delete at 7 years'],
['Clean old versions','Delete noncurrent objects older than 30 days or beyond 5 newer versions'],
['Clean failed uploads','AbortIncompleteMultipartUpload at 7 days']]},
{note:'Autoclass is an alternative to class-transition rules. You can still use lifecycle rules for deletion.'}],
src:[['Object Lifecycle Management',K.GCS+'lifecycle'],['Lifecycle configuration examples',K.GCS+'lifecycle-configurations']]};

/* ---------- 4 ---------- */
L['gcp:7:4']={blocks:[
{p:'Data can be lost by mistake, by a bug or by an attacker. Cloud Storage has several layers of protection that you can combine.'},
{t:[['Feature','Protects against','How'],
['Soft delete','Accidental deletion','Deleted objects and buckets are kept for a retention period (default 7 days) and can be restored'],
['Object Versioning','Overwrites and deletions','Keeps previous generations as noncurrent versions'],
['Retention policy','Early deletion','Objects cannot be deleted or replaced until they reach a minimum age'],
['Bucket Lock','Changing the retention policy','Locks the policy permanently. Used for compliance (WORM)'],
['Object holds','Deletion of selected objects','Temporary or event-based hold set by users or applications'],
['Object Retention Lock','Per object retention','Sets a retain-until time on each object'],
['Dual-region or multi-region','Regional outage','Data replicated across locations']]},
{h:'Versioning'},
{code:`gcloud storage buckets update gs://my-bucket --versioning
gcloud storage ls --all-versions gs://my-bucket/config.yaml
gcloud storage cp gs://my-bucket/config.yaml#1700000000000000 gs://my-bucket/config.yaml   # restore a version
gcloud storage buckets update gs://my-bucket --soft-delete-duration=14d`},
{ul:['Every overwrite creates a new generation. Pair versioning with lifecycle rules to remove old versions.','Versions are billed as storage.']},
{h:'Retention and WORM'},
{code:`gcloud storage buckets update gs://records-bucket --retention-period=7y
gcloud storage buckets update gs://records-bucket --lock-retention-period   # irreversible
gcloud storage objects update gs://records-bucket/contract.pdf --temporary-hold`},
{note:'Locking a retention policy is permanent. You cannot shorten it or remove it until the data expires. Test with an unlocked policy first.'},
{h:'Design thought'},
{ul:['Use versioning or soft delete for user data and configuration.','Use retention for records you must keep.','Keep backups in a different project or bucket with restricted deletion.','Enable audit logs so deletions can be traced.']}],
src:[['Soft delete',K.GCS+'soft-delete'],['Object versioning',K.GCS+'object-versioning'],['Retention policies and Bucket Lock',K.GCS+'bucket-lock']]};

/* ---------- 5 ---------- */
L['gcp:7:5']={blocks:[
{p:'Moving data into and between Google Cloud depends on size, speed and source. Choose a tool that fits.'},
{h:'Options'},
{t:[['Tool','Best for','Notes'],
['gcloud storage cp and rsync','Small to medium transfers from a machine you control','Parallel uploads, resumable, composite uploads for large files'],
['Storage Transfer Service','Online transfers from Amazon S3, Azure Blob, HTTP lists, other buckets or on-premises file systems','Managed, scheduled, checksums, no server for you to run (agents for on-premises)'],
['Transfer Appliance','Hundreds of TB to PB over slow networks','Ship a physical device, load data, return it'],
['Cloud Storage FUSE','Apps that expect a file system','Mounts a bucket. Not POSIX compliant'],
['Data pipelines and BigQuery transfers','Loading into BigQuery or other services','BigQuery Data Transfer Service']]},
{h:'Examples'},
{code:`gcloud storage rsync ./site gs://my-bucket/site --recursive --delete-unmatched-destination-objects
gcloud storage cp -r ./logs gs://my-bucket/logs/
gcloud transfer jobs create s3://source-bucket gs://dest-bucket --source-creds-file=aws-creds.json \\
  --schedule-repeats-every=1d --overwrite-when=different`},
{h:'Choosing by size and time'},
{flow:['Estimate the data size and the available bandwidth','Compute the time: size divided by sustained speed','Under a few TB and a good link? Use gcloud storage','Moving from another cloud or on-premises at scale? Use Storage Transfer Service','Too slow over the network? Use Transfer Appliance']},
{h:'Tips'},
{ul:['Transfer cost: ingress to Google Cloud is free, but the source provider may charge egress.','Verify with checksums and a count of objects after the move.','Run the final incremental sync just before cutover.','Use a service account with least privilege for transfers.']},
{note:'A dedicated Interconnect or Partner Interconnect raises the bandwidth available for large online transfers.'}],
src:[['Storage Transfer Service','https://cloud.google.com/storage-transfer/docs/overview'],['Transfer Appliance','https://cloud.google.com/transfer-appliance/docs/4.0/overview'],['Cloud Storage FUSE',K.GCS+'gcs-fuse']]};

/* ---------- 6 ---------- */
L['gcp:7:6']={blocks:[
{p:'Not every workload fits objects. Applications that need a shared file system, or a boot disk, need different storage. Google Cloud offers three kinds, each for a pattern.'},
{svg:choose},
{h:'File storage services'},
{t:[['Service','What it is','Use'],
['Filestore','Managed NFS file shares. Tiers: Basic, Zonal, Regional and Enterprise','Shared content, home directories, GKE and VM workloads that need NFS'],
['Parallelstore','Managed parallel file system for very high throughput','AI/ML training and HPC scratch'],
['Google Cloud NetApp Volumes','NetApp-based NFS and SMB with enterprise features','Windows shares, SAP, enterprise NAS replacement'],
['Cloud Storage FUSE','Mount buckets in Linux','Read large datasets with file APIs']]},
{code:`gcloud filestore instances create shared-nfs --zone=us-central1-a --tier=ZONAL --file-share=name=vol1,capacity=1TB --network=name=prod-vpc
# on a VM
sudo apt-get install -y nfs-common
sudo mkdir /mnt/share && sudo mount 10.0.0.2:/vol1 /mnt/share`},
{h:'Choosing storage'},
{t:[['Need','Choose'],
['Boot disk or database volume for one VM','Persistent Disk or Hyperdisk'],
['Shared files for many VMs or pods','Filestore or NetApp Volumes'],
['Windows SMB share','NetApp Volumes'],
['Unstructured data, backups, media, data lake','Cloud Storage'],
['Very fast scratch for many VMs','Local SSD or Parallelstore'],
['Structured queries','A database (see the database section)']]},
{h:'Performance tips'},
{ul:['Pick a Filestore tier by capacity and throughput needs. Performance scales with size in some tiers.','Keep the file share in the same region and preferably the same zone as clients.','Back up with Filestore backups or snapshots.']},
{note:'Do not use a bucket as a drop-in replacement for a file system without testing. Latency and consistency semantics are different.'}],
src:[['Filestore','https://cloud.google.com/filestore/docs/overview'],['Parallelstore','https://cloud.google.com/parallelstore/docs/overview'],['NetApp Volumes','https://cloud.google.com/netapp/volumes/docs/discover/overview']]};

/* ---------- 7 ---------- */
L['gcp:7:7']={blocks:[
{p:'This lesson collects the remaining things you meet when you run Cloud Storage: encryption, hosting a website, browser access, event notifications and common bucket layouts.'},
{h:'Encryption'},
{t:[['Option','Who holds the key'],
['Google-managed (default)','Google. Always on, at rest and in transit'],
['Customer-managed (CMEK)','You, in Cloud KMS. You can disable or rotate keys'],
['Customer-supplied (CSEK)','You provide the key with each request. Google does not store it']]},
{code:`gcloud storage buckets update gs://my-bucket --default-encryption-key=projects/p/locations/us/keyRings/kr/cryptoKeys/k1`},
{h:'Static website hosting'},
{ul:['Create a bucket, make objects readable by the public, set `MainPageSuffix` and `NotFoundPage`.','For HTTPS and a custom domain, put an external Application Load Balancer with a **backend bucket** in front, and optionally Cloud CDN.']},
{code:`gcloud storage buckets update gs://www.example.com --web-main-page-suffix=index.html --web-error-page=404.html`},
{h:'CORS'},
{p:'**Cross-origin resource sharing** settings let a web page from one domain read objects from the bucket in the browser.'},
{code:`[{"origin": ["https://app.example.com"], "method": ["GET"], "responseHeader": ["Content-Type"], "maxAgeSeconds": 3600}]
gcloud storage buckets update gs://my-bucket --cors-file=cors.json`},
{h:'Notifications and events'},
{ul:['**Pub/Sub notifications** publish a message when objects are created, deleted or updated.','**Eventarc** triggers Cloud Run or Cloud Run functions from storage events.','Use these to process uploads automatically, for example create thumbnails.']},
{h:'Bucket design patterns'},
{t:[['Pattern','Layout'],
['Per environment','my-app-dev-assets, my-app-prod-assets'],
['Per purpose','Separate buckets for raw, processed and backup data'],
['Per team with prefixes','One bucket with prefixes and IAM Conditions or managed folders'],
['Logging bucket','Dedicated, write-only for log sinks, retention locked']]},
{note:'Avoid sequential names such as timestamps at the start of object names on very high request rates. A short random prefix spreads the load.'}],
src:[['Cloud KMS keys with Cloud Storage',K.GCS+'encryption'],['Host a static website',K.GCS+'hosting-a-static-website'],['Pub/Sub notifications',K.GCS+'pubsub-notifications']]};
})();
