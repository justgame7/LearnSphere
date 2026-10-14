/* LearnSphere - AWS Administrator, Section 17: Backup, Disaster Recovery & Resilience.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const rpo=K.dg(700,200,[
[10,10,680,180,'RPO and RTO on a timeline',1],
[30,70,140,60,'Last good|backup',0],[220,70,140,60,'Disaster|occurs',2],[410,70,140,60,'Service|restored',0],
[30,140,330,30,'RPO: how much data you can lose',0],[360,140,310,30,'RTO: how long you can be down',0]],
[[170,100,220,100],[360,100,410,100]]);

const bkp=K.dg(700,210,[
[10,10,680,190,'AWS Backup',1],
[25,70,140,60,'Backup plan|schedule, lifecycle,|copy rules',2],[195,70,130,60,'Resource|assignment|tags or ARNs',0],[355,70,130,60,'Backup vault|encrypted,|access policy',0],[515,70,160,60,'Recovery point|restore or copy|to another Region',0]],
[[165,100,195,100],[325,100,355,100],[485,100,515,100]]);

const dr=K.dg(700,260,[
[10,10,680,240,'DR strategies: cost goes up as recovery time goes down',1],
[25,60,150,100,'Backup and restore|hours RTO|lowest cost',0],[195,60,150,100,'Pilot light|core running,|scale up on disaster',0],[365,60,150,100,'Warm standby|scaled-down full copy|minutes',2],[535,60,140,100,'Active/active|full capacity|near zero RTO',0],
[25,180,650,45,'Pick the cheapest strategy that meets the RTO and RPO of each workload',0]],
[]);

/* ---------- 0 ---------- */
L['aws:16:0']={blocks:[
{p:'Two numbers define recovery needs for every workload.'},
{svg:rpo},
{t:[['Term','Question','Driven by'],
['RPO (recovery point objective)','How much data can we lose?','Backup frequency and replication lag'],
['RTO (recovery time objective)','How long can we be down?','Restore speed, automation, standby capacity']]},
{h:'Backup versus disaster recovery'},
{t:[['','Backup','Disaster recovery'],
['Protects against','Deletion, corruption, ransomware, mistakes','Loss of a site, AZ or Region'],
['Typical scope','Data','Whole workload: data, compute, network, DNS'],
['Unit','Copies of data at points in time','A tested, repeatable recovery procedure']]},
{h:'Cost and tiers'},
{ul:['Classify workloads into tiers, each with RPO and RTO.','Tighter targets require more infrastructure, so the business must agree the cost.','Backups that were never restored are **assumptions**, not protection.']},
{note:'Replication copies mistakes too. A deleted or corrupted record replicates instantly, so replication is not a substitute for point-in-time backup.'}],
src:[['Disaster recovery of workloads on AWS','https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-workloads-on-aws.html']]};

/* ---------- 1 ---------- */
L['aws:16:1']={blocks:[
{p:'**AWS Backup** centralizes backup policy across many services in one place.'},
{svg:bkp},
{t:[['Piece','Meaning'],
['Backup vault','Container for recovery points, encrypted with KMS, with an access policy'],
['Backup plan','Rules: schedule, window, lifecycle (cold storage, retention), copy actions'],
['Resource assignment','Selects resources by tag or ARN, with an IAM role'],
['Recovery point','One backup of one resource'],
['Vault Lock','WORM protection that prevents deletion before retention ends']]},
{code:`aws backup create-backup-vault --backup-vault-name prod-vault --encryption-key-arn <kms>
aws backup create-backup-plan --backup-plan file://plan.json
aws backup create-backup-selection --backup-plan-id <id> --backup-selection \\
  '{"SelectionName":"tagged","IamRoleArn":"<role>","ListOfTags":[{"ConditionType":"STRINGEQUALS","ConditionKey":"Backup","ConditionValue":"daily"}]}'`},
{ul:['**Tag-based selection** protects new resources automatically.','**Organizations backup policies** deploy plans to many accounts.','Backup jobs, restore jobs and compliance are visible in the console and via EventBridge.']},
{note:'Enable the AWS Backup service opt-in for each resource type per Region before a plan can protect it.'}],
src:[['AWS Backup',K.BKP+'whatisbackup.html']]};

/* ---------- 2 ---------- */
L['aws:16:2']={blocks:[
{p:'Each service has its own backup mechanism and restore behaviour. AWS Backup drives them through one policy.'},
{t:[['Service','What is backed up','Restore result'],
['EC2','AMI with attached EBS snapshots','New instance or AMI'],
['EBS','Volume snapshot','New volume'],
['RDS and Aurora','Snapshots and logs for PITR','New DB instance or cluster'],
['DynamoDB','On-demand and continuous backups','New table'],
['EFS','Incremental backups of the file system','New or in-place item restore'],
['S3','Versioned objects with continuous or periodic backup','Restore to bucket'],
['FSx','Backups of file system','New file system']]},
{ul:['**Application-consistent** backups of Windows (VSS) and databases need extra configuration.','Restores usually create **new resources**, so networking, security groups and IAM must be reattached.','Restoring a very large volume or file system takes time. Measure it.']},
{code:`aws backup start-backup-job --backup-vault-name prod-vault --resource-arn <arn> --iam-role-arn <role>
aws backup list-recovery-points-by-resource --resource-arn <arn>
aws backup start-restore-job --recovery-point-arn <rp> --iam-role-arn <role> --metadata file://restore-metadata.json`}],
src:[['Feature availability',K.BKP+'backup-feature-availability.html']]};

/* ---------- 3 ---------- */
L['aws:16:3']={blocks:[
{p:'A restore method is chosen by **how far back you need to go** and **how fast you need it**.'},
{t:[['Method','Granularity','Good for'],
['Point-in-time recovery','Any second in the retention window','Accidental deletes, bad changes (RDS, DynamoDB, S3 with continuous backup)'],
['Snapshot restore','The snapshot time','Known good states before a release'],
['Versioning','Object version','Single object recovery'],
['Cross-Region copy restore','Time of the copy','Region failure']]},
{h:'Restore testing'},
{ul:['**AWS Backup restore testing** runs automatic restores on a schedule and validates them.','Record real **restore time** and compare to RTO.','Validate application functionality, not just that the resource exists.','Include IAM, networking and secrets in the test.']},
{flow:['Pick a recovery point and a target environment','Start the restore job and note the time','Attach the right network, security group and role','Run application checks','Record results, delete the test resources, and fix any gaps found']},
{note:'A restore test that has never been run is the most common hidden gap in disaster recovery plans.'}],
src:[['Restore testing',K.BKP+'restore-testing.html']]};

/* ---------- 4 ---------- */
L['aws:16:4']={blocks:[
{p:'Local backups do not protect against **loss of a Region** or a **compromised account**. Copy recovery points elsewhere.'},
{t:[['Copy','Protects against'],
['Cross-Region','Regional outage or disaster'],
['Cross-account','Account compromise, insider deletion, ransomware'],
['Both together','Region loss plus an attacker with access to the production account']]},
{h:'Design'},
{ul:['Use a **dedicated backup account** with its own vault and restricted access.','Encrypt with a KMS key the destination account controls (customer managed key and a vault policy allowing the source).','Use **Vault Lock** for immutability and logically air-gapped vaults where required.','Control cost with lifecycle rules, because each copy is stored again.']},
{code:`{"Rules":[{"RuleName":"daily","TargetBackupVaultName":"prod-vault","ScheduleExpression":"cron(0 3 * * ? *)",
  "Lifecycle":{"DeleteAfterDays":35},
  "CopyActions":[{"DestinationBackupVaultArn":"arn:aws:backup:eu-central-1:999988887777:backup-vault:central","Lifecycle":{"DeleteAfterDays":90}}]}]}`},
{note:'For cross-account copies enable cross-account backup in the Organizations settings and allow the source in the destination vault access policy.'}],
src:[['Cross-account backup',K.BKP+'create-cross-account-backup.html']]};

/* ---------- 5 ---------- */
L['aws:16:5']={blocks:[
{p:'Some data is best protected by built-in **versioning** or **shadow copies** rather than separate backups.'},
{t:[['Service','Feature','Notes'],
['S3','Versioning','Recover overwritten and deleted objects. Add lifecycle for old versions, Object Lock for immutability'],
['FSx for Windows','Shadow copies','Users restore previous file versions through Windows Explorer'],
['FSx for ONTAP, OpenZFS','Snapshots','Fast point-in-time copies'],
['EFS','AWS Backup','No native versions, use backups']]},
{h:'Combining protection'},
{flow:['Enable versioning for day-to-day recovery of single objects','Add replication so a copy exists in another Region or account','Add backups or Object Lock for retention and compliance','Test a delete-and-recover scenario']},
{code:`aws s3api put-bucket-versioning --bucket my-bucket --versioning-configuration Status=Enabled
aws fsx describe-file-systems --query "FileSystems[].WindowsConfiguration.[ShadowCopies]" 2>/dev/null`},
{note:'Versioning does not protect against deletion of the whole bucket or of someone with permission to delete versions. Use MFA Delete or Object Lock and separate accounts for higher assurance.'}],
src:[['S3 Versioning',K.S3+'Versioning.html']]};

/* ---------- 6 ---------- */
L['aws:16:6']={blocks:[
{p:'Four standard DR strategies trade **cost** against **recovery time**.'},
{svg:dr},
{t:[['Strategy','What runs in the recovery Region','RTO and RPO','Cost'],
['Backup and restore','Only backups','Hours','Lowest'],
['Pilot light','Data replicated, core components ready but off or minimal','Tens of minutes to hours','Low'],
['Warm standby','Full but scaled-down copy that serves traffic if scaled up','Minutes','Medium'],
['Active/active','Full capacity serving users in several Regions','Near zero','Highest']]},
{h:'Practical choices'},
{ul:['**DNS failover** with Route 53 health checks or Application Recovery Controller shifts users.','Replicate data with Aurora Global Database, DynamoDB global tables, S3 replication or cross-Region backup copies.','Keep infrastructure as code so recovery is a deployment, not a rebuild.','Automate the failover and **rehearse** it.']},
{note:'Choose per workload. A mix is normal: a tier-1 service uses warm standby while internal tools use backup and restore.'}],
src:[['DR options in the cloud','https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html']]};

/* ---------- 7 ---------- */
L['aws:16:7']={blocks:[
{p:'**AWS Elastic Disaster Recovery (DRS)** continuously replicates servers, physical, virtual or cloud, to a low-cost staging area in AWS so they can be recovered quickly.'},
{flow:['Install the replication agent on the source server','Block-level data replicates continuously to staging EBS volumes on small instances','A launch template defines how the recovery instance will look','During a drill or disaster, start recovery jobs and AWS converts and launches instances','After the event, fail back to the original site or keep running in AWS']},
{ul:['Typical **RPO in seconds** and **RTO in minutes**.','You pay for staging resources and storage, not full duplicate servers.','**Drills** can be run without disrupting replication.','Supports on-premises to AWS and Region to Region for EC2.']},
{code:`aws drs describe-source-servers --query "items[].[sourceServerID,dataReplicationInfo.dataReplicationState]"
aws drs start-recovery --source-servers sourceServerID=s-0abc --is-drill`},
{note:'Check network and security group settings in the launch template. A recovered server that cannot reach its dependencies is not a recovery.'}],
src:[['Elastic Disaster Recovery','https://docs.aws.amazon.com/drs/latest/userguide/what-is-drs.html']]};

/* ---------- 8 ---------- */
L['aws:16:8']={blocks:[
{p:'**Practical:** protect a workload, restore it and rehearse a failover.'},
{flow:['Tag an instance, volume and database with Backup=daily','Create a backup plan with a tag selection and a cross-Region copy rule','Run an on-demand backup job and confirm recovery points','Restore the EC2 and database to new resources in the recovery Region','Measure restore time against your RTO','Switch a Route 53 failover record to the recovery endpoint and test','Delete restored resources and review lessons learned']},
{t:[['Result','Record'],
['Backup duration','Per resource'],
['Restore duration','Compared with RTO'],
['Data loss','Time of recovery point against the incident'],
['Gaps','Missing networking, secrets, permissions']]},
{note:'Write the steps as a runbook while you do them. The first real disaster is a bad time to discover the steps.'}],
src:[['AWS Backup tutorials',K.BKP+'getting-started.html']]};
})();
