/* LearnSphere - Azure Administrator, Section 08: Azure Files & Blob Storage.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const blobs=K.dg(700,220,[
[10,10,680,200,'Account, container, blob',1],
[30,70,150,70,'Storage account|stdemoapp001',0],[260,70,150,70,'Container|data, logs, backups',2],[490,70,170,70,'Blobs|block, append, page',0]],
[[180,105,260,105],[410,105,490,105]]);

const tiers=K.dg(700,240,[
[10,10,680,220,'Cheaper to store, costlier to read',1],
[30,70,140,100,'Hot|frequent access|highest storage cost',2],[200,70,140,100,'Cool|30 days minimum|lower storage cost',0],[370,70,140,100,'Cold|90 days minimum|lower again',0],[540,70,130,100,'Archive|180 days minimum|offline, rehydrate',0]],
[[170,120,200,120],[340,120,370,120],[510,120,540,120]]);

const prot=K.dg(700,200,[
[10,10,680,180,'Layers of blob protection',1],
[30,60,140,70,'Container|soft delete',0],[200,60,140,70,'Blob|soft delete',0],[370,60,140,70,'Versioning',2],[540,60,130,70,'Immutability|and backup',0]],
[[170,95,200,95],[340,95,370,95],[510,95,540,95]]);

/* ---------- 0 ---------- */
L['az:7:0']={blocks:[
{p:'**Blob storage** is Azure object storage for unstructured data. Data is organized as **containers** inside a storage account, and each container holds **blobs**.'},
{svg:blobs},
{h:'Blob types'},
{t:[['Type','Optimized for','Typical use'],
['**Block blob**','Upload and read in blocks, up to about 190 TiB','Documents, images, backups, logs'],
['**Append blob**','Append-only writes','Log files'],
['**Page blob**','Random read and write, 512-byte pages','VHD disks']]},
{h:'Access levels for a container'},
{t:[['Level','Anonymous users can','Use'],
['**Private** (default)','Nothing','Almost always'],
['**Blob**','Read a blob if they know its URL','Public file downloads'],
['**Container**','List and read all blobs','Public listings']]},
{h:'Addressing'},
{code:`https://<account>.blob.core.windows.net/<container>/<folder>/<blob>`},
{p:'Folders are only a **naming convention** in a flat namespace, unless **hierarchical namespace** is enabled for Data Lake Storage Gen2.'},
{note:'Anonymous access is controlled at the account level too. Disable it at the account to make sure no container can become public.'}],
src:[['Introduction to Blob storage',K.STOR+'blobs/storage-blobs-introduction']]};

/* ---------- 1 ---------- */
L['az:7:1']={blocks:[
{p:'Containers are created, secured and populated with simple commands. The details to remember are the **naming rules** and the **authorization mode**.'},
{ul:['Container names: 3-63 characters, lowercase letters, digits and hyphens, and start with a letter or number.','Each container has an **access level** and optional **metadata**.','A container can have **stored access policies** and an **immutability policy**.']},
{code:`az storage container create --account-name stdemoapp001 --name data --public-access off --auth-mode login
az storage blob upload --account-name stdemoapp001 --container-name data --name report.pdf --file report.pdf --auth-mode login
az storage blob upload-batch --account-name stdemoapp001 --destination data --source ./files --auth-mode login
az storage blob list --account-name stdemoapp001 -c data --query "[].name" --auth-mode login
az storage blob show --account-name stdemoapp001 -c data -n report.pdf --auth-mode login`},
{h:'Useful blob properties'},
{t:[['Property','Meaning'],
['Content type','How browsers treat the file'],
['Access tier','Hot, Cool, Cold or Archive'],
['Metadata and tags','Key-value pairs. Tags are indexed and searchable'],
['Lease','An exclusive lock on a blob or container'],
['Snapshot and version','Point-in-time copies']]},
{note:'If an upload fails with an authorization error and you have Owner, check that you have a **data** role such as Storage Blob Data Contributor, and the firewall allows your IP.'}],
src:[['Quickstart: upload, download and list blobs',K.STOR+'blobs/storage-quickstart-blobs-cli']]};

/* ---------- 2 ---------- */
L['az:7:2']={blocks:[
{p:'Blob **access tiers** let you pay less for data you rarely read. Storage price goes down as the tier gets colder, while access and early-deletion cost goes up.'},
{svg:tiers},
{t:[['Tier','Best for','Minimum retention','Availability'],
['**Hot**','Active data','None','Immediate'],
['**Cool**','Short-term backups, infrequent access','30 days','Immediate'],
['**Cold**','Rarely accessed, still online','90 days','Immediate'],
['**Archive**','Long-term, compliance, backups','180 days','**Offline**, must rehydrate']]},
{h:'Default and per-blob tiers'},
{ul:['The **account default tier** (hot or cool) applies to blobs with no explicit tier.','You can set a tier **per blob** and change it later. Archive is set per blob only.','Deleting or moving a blob before the minimum period incurs an **early deletion** charge.']},
{h:'Rehydrating from Archive'},
{p:'An archived blob cannot be read. You **rehydrate** it by changing its tier to hot, cool or cold, or by copying it to another blob.'},
{t:[['Priority','Typical time','Cost'],
['**Standard**','Up to 15 hours','Lower'],
['**High**','Under 1 hour for blobs under 10 GB','Higher']]},
{code:`az storage blob set-tier --account-name stdemoapp001 -c data -n old.zip --tier Archive --auth-mode login
az storage blob set-tier --account-name stdemoapp001 -c data -n old.zip --tier Hot --rehydrate-priority Standard --auth-mode login`}],
src:[['Access tiers overview',K.STOR+'blobs/access-tiers-overview'],['Rehydrate archived blobs',K.STOR+'blobs/archive-rehydrate-overview']]};

/* ---------- 3 ---------- */
L['az:7:3']={blocks:[
{p:'**Soft delete** keeps deleted data recoverable for a retention period, so an accidental delete is not permanent.'},
{t:[['Setting','Protects','Retention'],
['**Blob soft delete**','Deleted or overwritten blobs and snapshots','1-365 days'],
['**Container soft delete**','Deleted containers and their contents','1-365 days']]},
{code:`az storage account blob-service-properties update -n stdemoapp001 -g rg-storage \\
  --enable-delete-retention true --delete-retention-days 14 \\
  --enable-container-delete-retention true --container-delete-retention-days 14

az storage blob list --account-name stdemoapp001 -c data --include d --auth-mode login
az storage blob undelete --account-name stdemoapp001 -c data -n report.pdf --auth-mode login
az storage container restore --account-name stdemoapp001 -n data --deleted-version <version> --auth-mode login`},
{h:'Behavior'},
{ul:['Soft-deleted data still **costs storage** until the retention expires.','Deleting the **storage account** is not covered. Protect the account with a resource lock.','Soft delete works with versioning: with versioning on, deleting creates a deleted version.','Azure Files has its own share soft delete (next lectures).']},
{note:'Soft delete is cheap insurance and is enabled by default for new accounts. Verify it is on for older accounts.'}],
src:[['Soft delete for blobs',K.STOR+'blobs/soft-delete-blob-overview'],['Soft delete for containers',K.STOR+'blobs/soft-delete-container-overview']]};

/* ---------- 4 ---------- */
L['az:7:4']={blocks:[
{p:'**Blob versioning** automatically keeps a previous version each time a blob is overwritten or deleted, identified by a **version ID**. You can read or restore any version.'},
{svg:prot},
{h:'How it behaves'},
{ul:['Each write creates a new **current version** and the previous becomes a **previous version**.','Deleting the blob makes the current version a previous version, with no current version left.','Previous versions are billed as storage and can be moved to cooler tiers by lifecycle rules.','Versioning and snapshots are different. Snapshots are manual and versioning is automatic.']},
{code:`az storage account blob-service-properties update -n stdemoapp001 -g rg-storage --enable-versioning true
az storage blob list --account-name stdemoapp001 -c data --include v --auth-mode login
az storage blob copy start --account-name stdemoapp001 --destination-container data --destination-blob report.pdf --source-uri "<blob-url>?versionid=<version-id>" --auth-mode login`},
{h:'Restore'},
{p:'To restore, **promote** a previous version by copying it over the current blob. Use **point-in-time restore** for block blobs when you need to roll a container back to an earlier time, which requires versioning, change feed and soft delete.'},
{note:'Without a lifecycle rule to delete old versions, storage grows with every overwrite.'}],
src:[['Blob versioning',K.STOR+'blobs/versioning-overview'],['Point-in-time restore',K.STOR+'blobs/point-in-time-restore-overview']]};

/* ---------- 5 ---------- */
L['az:7:5']={blocks:[
{p:'**Lifecycle management** policies move blobs between tiers and delete them automatically, based on age or last access, so you do not need to script it.'},
{h:'Rule structure'},
{t:[['Part','Meaning'],
['**Filter**','Blob type and name prefix or tags the rule applies to'],
['**Action**','tierToCool, tierToCold, tierToArchive, delete'],
['**Condition**','Days since modified, created or last accessed']]},
{code:`{
  "rules": [
    {
      "name": "age-out-logs",
      "enabled": true,
      "type": "Lifecycle",
      "definition": {
        "filters": { "blobTypes": ["blockBlob"], "prefixMatch": ["logs/"] },
        "actions": {
          "baseBlob": {
            "tierToCool":    { "daysAfterModificationGreaterThan": 30 },
            "tierToArchive": { "daysAfterModificationGreaterThan": 90 },
            "delete":        { "daysAfterModificationGreaterThan": 365 }
          },
          "version": { "delete": { "daysAfterCreationGreaterThan": 90 } }
        }
      }
    }
  ]
}`},
{code:`az storage account management-policy create --account-name stdemoapp001 -g rg-storage --policy @policy.json`},
{h:'Facts'},
{ul:['Policies run **once a day**, so changes are not instant.','Rules can apply to **current versions, previous versions and snapshots**.','Last-access conditions need **access tracking** enabled.','Tiering to Archive and early deletion carry minimum-duration charges.']}],
src:[['Lifecycle management',K.STOR+'blobs/lifecycle-management-overview']]};

/* ---------- 6 ---------- */
L['az:7:6']={blocks:[
{p:'**Azure Files** provides fully managed file shares in the cloud, accessed over **SMB** or **NFS**. It replaces or extends on-premises file servers.'},
{t:[['Protocol','Clients','Notes'],
['**SMB** 3.x','Windows, Linux, macOS','Identity-based access with AD DS, Entra Kerberos or keys'],
['**NFS** 4.1','Linux','Premium (SSD) shares only, access by network rules, not by user identity']]},
{h:'Tiers and media'},
{t:[['Tier','Media','Use'],
['**Premium**','SSD','Latency-sensitive, databases, high IOPS'],
['**Transaction optimized**','HDD','Transaction-heavy but not latency-critical'],
['**Hot**','HDD','General purpose file shares'],
['**Cool**','HDD','Online archive and backups']]},
{code:`az storage share-rm create --storage-account stfiles001 --resource-group rg-storage --name share1 --quota 100 --access-tier TransactionOptimized
az storage share-rm list --storage-account stfiles001 -g rg-storage -o table`},
{h:'Mounting'},
{code:`# Windows: map a drive with an account key
net use Z: \\\\stfiles001.file.core.windows.net\\share1 /user:Azure\\stfiles001 <key>

# Linux: mount over SMB
sudo mount -t cifs //stfiles001.file.core.windows.net/share1 /mnt/share -o username=stfiles001,password=<key>,serverino`},
{note:'SMB uses port 445. Many home networks and ISPs block it, so connecting from outside Azure often needs a VPN, ExpressRoute or Azure File Sync.'}],
src:[['Azure Files introduction',K.STOR+'files/storage-files-introduction'],['Planning for Azure Files',K.STOR+'files/storage-files-planning']]};

/* ---------- 7 ---------- */
L['az:7:7']={blocks:[
{p:'Azure Files supports **identity-based authentication** over SMB so users access shares with their own credentials and normal NTFS permissions, and has several protection features.'},
{h:'Identity sources for SMB'},
{t:[['Source','Notes'],
['**On-premises AD DS**','Domain-joined clients, account joined to AD'],
['**Microsoft Entra Domain Services**','Managed domain in Azure'],
['**Microsoft Entra Kerberos**','For hybrid identities, no line-of-sight to a domain controller required']]},
{h:'Permissions'},
{p:'Two layers apply. **Share-level** access is controlled by RBAC roles such as **Storage File Data SMB Share Contributor**. **File and folder** permissions are NTFS ACLs, which you set from a mounted drive.'},
{h:'Snapshots and soft delete'},
{ul:['**Share snapshots** are read-only, point-in-time copies of the whole share. They are incremental, so you pay for changes.','**Soft delete for shares** keeps a deleted share recoverable for a retention period.','Users can often restore a previous file version through **Previous Versions** in Windows Explorer.']},
{code:`az storage share snapshot --account-name stfiles001 --name share1
az storage account file-service-properties update -n stfiles001 -g rg-storage --enable-delete-retention true --delete-retention-days 14
az storage share-rm restore --storage-account stfiles001 -g rg-storage --name share1 --deleted-version <version>`},
{note:'A share snapshot is stored in the same account. It does not protect against deleting the account, so combine with Azure Backup for shares.'}],
src:[['Identity-based authentication for Azure Files',K.STOR+'files/storage-files-active-directory-overview'],['Share snapshots',K.STOR+'files/storage-snapshots-files']]};

/* ---------- 8 ---------- */
L['az:7:8']={blocks:[
{p:'Two tools help move and manage data: **Azure Storage Explorer**, a graphical app, and **AzCopy**, a command-line copy tool.'},
{t:[['Tool','Best for','Notes'],
['**Storage Explorer**','Browsing, uploading, SAS creation, quick work','Windows, macOS, Linux, plus a portal version'],
['**AzCopy**','Large and scripted transfers, sync','Parallel, resumable, works between accounts']]},
{h:'AzCopy'},
{code:`azcopy login
azcopy copy "C:\\data\\*" "https://stdemoapp001.blob.core.windows.net/data" --recursive
azcopy sync "C:\\data" "https://stdemoapp001.blob.core.windows.net/data" --recursive
azcopy copy "https://stsrc.blob.core.windows.net/c" "https://stdst.blob.core.windows.net/c" --recursive`},
{ul:['`copy` transfers, `sync` makes the destination match the source.','**Account to account** copy happens server-side, with no download.','Authorize with Entra (`azcopy login`) or a SAS appended to the URL.','Use `--dry-run` to preview and `azcopy jobs resume` to continue interrupted jobs.']},
{h:'Choosing'},
{flow:['Small manual job or exploring: Storage Explorer','Repeatable or large: AzCopy in a script','Huge datasets or poor bandwidth: offline transfer (Data Box)','Ongoing hybrid file synchronization: Azure File Sync']},
{note:'AzCopy needs the same data role (for example Storage Blob Data Contributor) when you use Entra sign-in, regardless of your subscription role.'}],
src:[['AzCopy',K.STOR+'common/storage-use-azcopy-v10'],['Storage Explorer',K.STOR+'storage-explorer/vs-azure-tools-storage-manage-with-storage-explorer']]};

/* ---------- 9 ---------- */
L['az:7:9']={blocks:[
{p:'Upload data, tier it, delete and recover it, and set a lifecycle rule. This brings together protection and cost features from the section.'},
{flow:['Enable blob soft delete and versioning on the account','Create a container and upload three files','Move one blob to Cool and another to Cold','Overwrite a file and list its versions','Delete a blob and undelete it','Create a lifecycle rule that tiers and deletes by age']},
{code:`az storage account blob-service-properties update -n stdemoapp001 -g rg-storage --enable-versioning true --enable-delete-retention true --delete-retention-days 7
az storage blob upload -a stdemoapp001 -c data -n a.txt -f a.txt --auth-mode login
az storage blob set-tier -a stdemoapp001 -c data -n a.txt --tier Cool --auth-mode login
az storage blob upload -a stdemoapp001 -c data -n a.txt -f a2.txt --overwrite --auth-mode login
az storage blob list -a stdemoapp001 -c data --include v --auth-mode login -o table
az storage blob delete -a stdemoapp001 -c data -n a.txt --auth-mode login
az storage blob undelete -a stdemoapp001 -c data -n a.txt --auth-mode login`},
{h:'Observe'},
{t:[['Action','Result'],
['Overwrite','Previous content kept as a previous version'],
['Delete','Blob is soft-deleted and shown with include deleted'],
['Undelete','Blob is restored and current again'],
['Lifecycle rule','Runs daily, so effects appear later']]},
{note:'Cleanup: lifecycle rules and soft delete keep data and cost money. Delete the resource group when you are done.'}],
src:[['Blob storage data protection',K.STOR+'blobs/data-protection-overview']]};

})();
