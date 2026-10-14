/* LearnSphere - AWS Administrator, Section 06: Block & Shared Storage: EBS, EFS and FSx.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const map=K.dg(700,230,[
[10,10,680,210,'Which storage for which job',1],
[25,55,125,70,'EBS|block, one instance|(multi-attach rare)',2],[165,55,125,70,'Instance store|block, local,|ephemeral',0],[305,55,125,70,'EFS|shared NFS|Linux',0],[445,55,115,70,'FSx|SMB, Lustre,|ONTAP, ZFS',0],[575,55,100,70,'S3|objects,|HTTP API',0],
[25,145,650,50,'Choose by access protocol first, then by performance, durability and cost',0]],
[]);

const snap=K.dg(700,190,[
[10,10,680,170,'Incremental snapshots',1],
[30,60,130,60,'Volume|100 GiB used',0],[210,60,130,60,'Snapshot 1|full copy of blocks',0],[390,60,130,60,'Snapshot 2|changed blocks only',2],[570,60,100,60,'Snapshot 3|changed blocks',0]],
[[160,90,210,90],[340,90,390,90],[520,90,570,90]]);

/* ---------- 0 ---------- */
L['aws:5:0']={blocks:[
{p:'AWS offers storage for **blocks**, **files** and **objects**. Pick by access method first, then by performance, durability and cost.'},
{svg:map},
{t:[['Service','Type','Attached to','Durability and scope','Typical use'],
['EBS','Block','One instance in one AZ','Replicated within an AZ','Boot and data volumes, databases'],
['Instance store','Block','The physical host','Lost on stop or failure','Cache, scratch, temporary data'],
['EFS','File (NFS)','Many Linux clients across AZs','Regional, multi-AZ','Shared content, home directories'],
['FSx','File (SMB, NFS, Lustre)','Windows and Linux clients','Single or multi-AZ','Windows shares, HPC, enterprise NAS'],
['S3','Object','Any client over HTTPS','Regional, 11 nines','Backups, data lakes, static content']]},
{note:'EBS volumes are tied to one **Availability Zone**. To use data in another AZ you snapshot and restore there.'}],
src:[['Storage on AWS','https://aws.amazon.com/products/storage/']]};

/* ---------- 1 ---------- */
L['aws:5:1']={blocks:[
{p:'EBS volume types trade **price**, **IOPS** and **throughput**. SSD types suit random I/O. HDD types suit large sequential reads and writes.'},
{t:[['Type','Family','Use','Key limits'],
['gp3','General purpose SSD','Default for most workloads','3,000 IOPS and 125 MiB/s included, scale up independently'],
['gp2','General purpose SSD (older)','Legacy','IOPS tied to size with burst credits'],
['io2 / io2 Block Express','Provisioned IOPS SSD','Databases needing consistent high IOPS','High IOPS, 99.999% durability'],
['st1','Throughput optimized HDD','Big data, logs, streaming','Cannot be a boot volume'],
['sc1','Cold HDD','Infrequently accessed data','Lowest cost, cannot boot']]},
{h:'Choosing'},
{flow:['Need a boot volume or random I/O? Use SSD','Standard workload? gp3, then raise IOPS or throughput if needed','Latency sensitive database needing more IOPS than gp3 provides? io2','Large sequential throughput on a budget? st1','Rarely read archive data on a volume? sc1']},
{note:'Migrate gp2 to gp3 online with `modify-volume`. gp3 is usually cheaper and lets you tune IOPS without growing the volume.'},
{code:`aws ec2 modify-volume --volume-id vol-0abc --volume-type gp3 --iops 6000 --throughput 250
aws ec2 describe-volumes-modifications --volume-ids vol-0abc`}],
src:[['EBS volume types',K.EC2+'ebs-volume-types.html']]};

/* ---------- 2 ---------- */
L['aws:5:2']={blocks:[
{p:'A volume is created in one AZ, **attached** to an instance in the same AZ, then formatted and mounted by the OS. You can resize and change type while in use, but you must also extend the file system.'},
{h:'Create and attach'},
{code:`aws ec2 create-volume --availability-zone eu-west-1a --size 50 --volume-type gp3 --encrypted
aws ec2 attach-volume --volume-id vol-0abc --instance-id i-0abc --device /dev/sdf

# on the instance
lsblk
sudo mkfs -t xfs /dev/nvme1n1
sudo mkdir /data && sudo mount /dev/nvme1n1 /data`},
{h:'Resize'},
{flow:['Take a snapshot as a safety net','Modify the volume size (it can only grow)','Wait for the modification to reach optimizing or completed','Grow the partition if one exists with growpart','Extend the file system with xfs_growfs or resize2fs']},
{code:`aws ec2 modify-volume --volume-id vol-0abc --size 100
sudo growpart /dev/nvme1n1 1
sudo xfs_growfs -d /data      # or: sudo resize2fs /dev/nvme1n1p1`},
{h:'Encryption'},
{ul:['Encryption uses KMS and covers data at rest, in transit between the instance and volume, and snapshots.','You can enable **EBS encryption by default** per Region for new volumes.','To encrypt an existing unencrypted volume, snapshot it, copy the snapshot with encryption, then create a volume.']},
{code:`aws ec2 enable-ebs-encryption-by-default --region eu-west-1`}],
src:[['Create a volume',K.EC2+'ebs-creating-volume.html'],['EBS encryption',K.EC2+'ebs-encryption.html']]};

/* ---------- 3 ---------- */
L['aws:5:3']={blocks:[
{p:'An **EBS snapshot** is a point-in-time backup stored in S3 (managed by EBS). Snapshots are **incremental**: after the first, only changed blocks are stored, but each snapshot can restore a full volume.'},
{svg:snap},
{h:'Operations'},
{code:`aws ec2 create-snapshot --volume-id vol-0abc --description "pre-upgrade" \\
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Owner,Value=ops}]'
aws ec2 copy-snapshot --source-region eu-west-1 --source-snapshot-id snap-0abc --region eu-central-1 --encrypted
aws ec2 modify-snapshot-attribute --snapshot-id snap-0abc --attribute createVolumePermission \\
  --operation-type add --user-ids 222233334444
aws ec2 create-volume --snapshot-id snap-0abc --availability-zone eu-west-1b`},
{ul:['Deleting a snapshot only removes blocks no other snapshot needs.','**Recycle Bin** can retain deleted snapshots and AMIs for a period so accidental deletion is recoverable.','**Data Lifecycle Manager** or **AWS Backup** automates creation and retention.','**Fast snapshot restore** removes the first-read latency of a restored volume, at an extra cost.','**Archive tier** stores rarely needed snapshots at lower cost with a slower restore.']},
{note:'A snapshot is crash-consistent. For databases, flush and freeze or use an application-aware backup to get an application-consistent copy.'}],
src:[['EBS snapshots',K.EC2+'ebs-snapshots.html']]};

/* ---------- 4 ---------- */
L['aws:5:4']={blocks:[
{p:'A volume is slow when it hits its **IOPS limit**, its **throughput limit**, the **instance EBS bandwidth limit** or when the **first read** from a restored snapshot is slow. Metrics tell you which.'},
{h:'Metrics'},
{t:[['Metric','Meaning'],
['VolumeReadOps / VolumeWriteOps','Operations per period, divide by seconds for IOPS'],
['VolumeReadBytes / VolumeWriteBytes','Throughput'],
['VolumeQueueLength','Pending operations. High means saturated'],
['VolumeIdleTime','Time with no operations'],
['VolumeThroughputPercentage / VolumeConsumedReadWriteOps','Use against provisioned values'],
['BurstBalance (gp2, st1, sc1)','Remaining burst credit']]},
{h:'A diagnosis'},
{flow:['Compare IOPS and throughput with the volume type and provisioned limits','Check the instance type EBS-optimized bandwidth and IOPS caps','Look at queue length to confirm saturation','Increase gp3 IOPS or throughput, move to io2 or a larger instance','For restored volumes consider fast snapshot restore or initialize by reading all blocks']},
{code:`aws cloudwatch get-metric-statistics --namespace AWS/EBS --metric-name VolumeQueueLength \\
  --dimensions Name=VolumeId,Value=vol-0abc --statistics Average --period 300 \\
  --start-time 2026-10-15T00:00:00Z --end-time 2026-10-15T06:00:00Z`},
{note:'A volume can be fast and the instance can still be the bottleneck. Every instance type has its own EBS bandwidth ceiling.'}],
src:[['EBS CloudWatch metrics',K.EC2+'using_cloudwatch_ebs.html'],['EBS performance',K.EC2+'ebs-io-characteristics.html']]};

/* ---------- 5 ---------- */
L['aws:5:5']={blocks:[
{p:'**Amazon EFS** is a managed, elastic NFS file system that many Linux instances, containers and functions can mount at once across Availability Zones.'},
{h:'Concepts'},
{t:[['Piece','Meaning'],
['File system','Elastic storage, grows and shrinks automatically'],
['Mount target','Network endpoint in a subnet, one per AZ, with a security group'],
['Access point','Application entry with a fixed path, user and permissions'],
['Storage classes','Standard, Infrequent Access, Archive; One Zone variants']]},
{h:'Throughput modes'},
{t:[['Mode','Behaviour'],
['Elastic (default)','Scales automatically with the workload and you pay for use'],
['Provisioned','Fixed throughput you choose'],
['Bursting (older)','Throughput scales with stored size']]},
{h:'Lifecycle management'},
{p:'Lifecycle policies move files not accessed for a period (for example 30 days) to Infrequent Access and then Archive, cutting cost. A policy can move them back on access.'},
{code:`aws efs create-file-system --encrypted --performance-mode generalPurpose --throughput-mode elastic
aws efs create-mount-target --file-system-id fs-0abc --subnet-id subnet-0abc --security-groups sg-0abc
aws efs put-lifecycle-configuration --file-system-id fs-0abc \\
  --lifecycle-policies TransitionToIA=AFTER_30_DAYS TransitionToPrimaryStorageClass=AFTER_1_ACCESS

sudo mount -t efs -o tls fs-0abc:/ /mnt/efs     # needs amazon-efs-utils`},
{note:'The mount target security group must allow **TCP 2049** from the clients. Most EFS mount failures are this rule or DNS resolution.'}],
src:[['Amazon EFS','https://docs.aws.amazon.com/efs/latest/ug/whatisefs.html']]};

/* ---------- 6 ---------- */
L['aws:5:6']={blocks:[
{p:'**Amazon FSx** provides managed file systems built on popular file technologies. Choose by the **protocol and features** your workload already needs.'},
{t:[['FSx type','Protocols','Best for'],
['FSx for Windows File Server','SMB, Active Directory, DFS','Windows shares, home directories, SQL Server'],
['FSx for Lustre','POSIX, Lustre client','HPC, machine learning, fast scratch linked to S3'],
['FSx for NetApp ONTAP','NFS, SMB, iSCSI','Lift and shift NetApp, multi-protocol, snapshots, replication'],
['FSx for OpenZFS','NFS','Linux workloads migrating from ZFS, low latency, clones']]},
{h:'Operational points'},
{ul:['Choose single-AZ or **multi-AZ** deployment for availability where offered.','Backups are automatic and incremental, and you can take manual backups.','Windows file systems join **Active Directory** (managed or self-managed).','Storage can be increased online, while some types cannot shrink.','Security groups control access, and encryption uses KMS.']},
{note:'If the requirement says "SMB share for Windows with AD permissions" the answer is FSx for Windows File Server. If it says "NFS for many Linux hosts, simple and elastic" the answer is EFS.'}],
src:[['Amazon FSx','https://docs.aws.amazon.com/fsx/']]};

/* ---------- 7 ---------- */
L['aws:5:7']={blocks:[
{p:'Use this guide to choose shared storage for a requirement.'},
{t:[['Requirement','Choose','Why'],
['Shared NFS for Linux, elastic, multi-AZ, little management','EFS','Simple, regional, grows automatically'],
['Windows SMB share with Active Directory','FSx for Windows','Native SMB and NTFS permissions'],
['Highest throughput scratch for HPC or ML','FSx for Lustre','Parallel file system, S3 integration'],
['NetApp features, multi-protocol, replication','FSx for ONTAP','Same tooling as on premises'],
['ZFS snapshots and clones for Linux','FSx for OpenZFS','Cheap clones, low latency'],
['Object access from applications and many clients','S3','Cheapest, HTTP API, huge scale'],
['Mount S3 data as a file system','S3 Files or Mountpoint for S3','File-style access over S3 objects']]},
{h:'Mounting S3 as files'},
{p:'**Mountpoint for Amazon S3** lets Linux applications read and write S3 objects through a file path, with some limits (no full POSIX semantics, no in-place edits of existing objects). It suits large read-heavy workloads, not general shared home directories.'},
{note:'Always check the protocol, operating system, latency and consistency needs together. A cheaper tier is a bad choice if the application needs file locks it does not support.'}],
src:[['Mountpoint for Amazon S3','https://docs.aws.amazon.com/AmazonS3/latest/userguide/mountpoint.html']]};

/* ---------- 8 ---------- */
L['aws:5:8']={blocks:[
{p:'**Practical:** attach and resize a volume, snapshot and restore it, then share storage across two instances.'},
{flow:['Create a 10 GiB gp3 encrypted volume in the same AZ as an instance and attach it','Format with XFS, mount it and write a file','Grow the volume to 20 GiB and extend the file system without unmounting','Snapshot the volume, delete a file, restore the snapshot to a new volume in another AZ and mount it','Create an EFS file system with mount targets in two AZs','Mount it on two instances and confirm a file written by one appears on the other','Delete volumes, snapshots and the file system']},
{h:'Check list'},
{t:[['Step','What you should see'],
['Resize','lsblk shows the larger device, df shows more space after xfs_growfs'],
['Restore','The deleted file is present on the new volume'],
['EFS','Both instances list the same files, port 2049 is open between them']]},
{note:'Snapshots and EFS file systems keep charging until deleted. Tag everything with Expiry so the cleanup is not forgotten.'}],
src:[['EBS volumes',K.EC2+'ebs-volumes.html']]};
})();
