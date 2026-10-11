/* LearnSphere - SQL Server Backup, Restore & Recovery, Section 07: Backup to Cloud.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const url=M.dg(700,170,[
[10,35,170,70,'SQL Server|BACKUP ... TO URL',2],[220,35,170,70,'Credential|SAS token for the|container',0],[430,35,260,70,'Azure Blob Storage|container, block blobs|tiers, retention, immutability',0],
[10,125,680,32,'Off-site by design, no local disk to manage, pay for storage and egress',0]],
[[180,70,220,70],[390,70,430,70]]);

const s3=M.dg(700,150,[
[10,30,170,70,'SQL Server 2022|BACKUP TO URL|s3://...',2],[220,30,170,70,'Credential|S3 Access Key|identity',0],[430,30,260,70,'S3-compatible storage|object store over HTTPS|on premises or cloud',0]],
[[180,65,220,65],[390,65,430,65]]);

const cred=M.dg(700,200,[
[10,15,215,170,'Shared access signature',1],[25,50,185,35,'Scoped to a container',2],[25,95,185,35,'Time limited',0],[25,140,185,35,'Least privilege',0],
[245,15,215,170,'Storage account key',1],[260,50,185,35,'Full access to account',2],[260,95,185,35,'Hard to rotate',0],[260,140,185,35,'Avoid',2],
[480,15,210,170,'Managed identity',1],[495,50,180,35,'Azure VM or Arc',0],[495,95,180,35,'No secret to store',2],[495,140,180,35,'Check version support',0]],
[]);

const mbk=M.dg(700,150,[
[10,30,200,70,'Managed backup|policy: retention days,|database or instance',2],[250,30,200,70,'Service chooses|when to take full|and log backups',0],[490,30,200,70,'Backups in Azure|blob container',0]],
[[210,65,250,65],[450,65,490,65]]);

/* ---------- 0: Backup to URL ---------- */
L['mss-bkp:6:0']={blocks:[
{p:'**Backup to URL** writes SQL Server backups directly to **Azure Blob Storage**. You get off-site storage without a file server, and a choice of storage tiers for cost.'},
{svg:url},
{code:`-- A credential named after the container URL, using a SAS token
CREATE CREDENTIAL [https://mystorage.blob.core.windows.net/sqlbackups]
  WITH IDENTITY = 'SHARED ACCESS SIGNATURE',
       SECRET   = '<SAS token without the leading question mark>';

BACKUP DATABASE SalesDB
  TO URL = 'https://mystorage.blob.core.windows.net/sqlbackups/SalesDB_full_20261010.bak'
  WITH COMPRESSION, CHECKSUM, STATS = 10;

RESTORE VERIFYONLY
  FROM URL = 'https://mystorage.blob.core.windows.net/sqlbackups/SalesDB_full_20261010.bak';`},
{h:'Points to remember'},
{ul:['SQL Server writes **block blobs**. A single blob has a size limit, so large databases are **striped** over several URLs.','Use **compression** and **checksum**, as with disk backups.','Keep the **storage account in another region** or use geo-redundancy for disaster recovery.','Use **blob immutability** (WORM) to protect backups from deletion or ransomware.','Think about **egress cost and restore time**: restoring a large backup over the network is slow.']},
{note:'Never put a SAS token or key in a script that is checked into source control. Keep secrets in a vault or the credential store.'}],
src:[['SQL Server backup to URL',M.RD+'backup-restore/sql-server-backup-to-url'],['Back up to Azure Blob Storage',M.RD+'backup-restore/sql-server-backup-and-restore-with-microsoft-azure-blob-storage-service']]};

/* ---------- 1: S3 ---------- */
L['mss-bkp:6:1']={blocks:[
{p:'From **SQL Server 2022**, `BACKUP ... TO URL` also works with **S3-compatible object storage**: AWS S3, MinIO, Pure Storage, Dell and others that implement the S3 API.'},
{svg:s3},
{code:`-- Credential for an S3-compatible endpoint
CREATE CREDENTIAL [s3://s3.example.com:9000/sqlbackups]
  WITH IDENTITY = 'S3 Access Key',
       SECRET   = '<AccessKeyID>:<SecretKeyID>';

BACKUP DATABASE SalesDB
  TO URL = 's3://s3.example.com:9000/sqlbackups/SalesDB_full.bak'
  WITH FORMAT, COMPRESSION, CHECKSUM, MAXTRANSFERSIZE = 20971520, STATS = 10;`},
{h:'Rules to follow'},
{t:[['Item','Detail'],
['**Version**','SQL Server 2022 and later'],
['**Protocol**','HTTPS: the endpoint must have a trusted certificate'],
['**Transfer size**','MAXTRANSFERSIZE between 5 and 20 MB'],
['**Format**','Use WITH FORMAT when you write a new backup file'],
['**Striping**','Up to 64 URLs for very large databases']]},
{note:'This is also a good way to send backups to **on-premises object storage** that your organization already runs, without a separate backup agent.'}],
src:[['SQL Server backup and restore with S3-compatible object storage',M.RD+'backup-restore/sql-server-backup-and-restore-with-s3-compatible-object-storage'],['SQL Server 2022 what is new',M.SS+'what-s-new-in-sql-server-2022']]};

/* ---------- 2: Credentials ---------- */
L['mss-bkp:6:2']={blocks:[
{p:'Backup to the cloud needs a **credential**: the way SQL Server proves who it is to the storage service. Choose the safest option that your platform supports.'},
{svg:cred},
{h:'SAS token: practical steps'},
{flow:['Create a private container for backups','Generate a SAS for that container with read, write, list and delete','Set a sensible expiry and a rotation date','Create the SQL Server credential with the SAS as the secret','Test with a small backup and a restore verify']},
{code:`-- Credentials on this instance (names only)
SELECT name, credential_identity, create_date FROM sys.credentials;

-- Replace a secret when a SAS is rotated
ALTER CREDENTIAL [https://mystorage.blob.core.windows.net/sqlbackups]
  WITH IDENTITY = 'SHARED ACCESS SIGNATURE', SECRET = '<new SAS token>';`},
{ul:['**Rotate** SAS tokens before they expire and monitor the expiry date.','Use **separate credentials** per environment.','Restrict storage with **firewall rules** or private endpoints where possible.','Grant only the **permissions** the job needs.']},
{note:'An expired SAS looks like a sudden string of failed backup jobs. Put the expiry date in your monitoring.'}],
src:[['Create a credential',M.TS+'statements/create-credential-transact-sql'],['Use shared access signatures','https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview']]};

/* ---------- 3: Managed backup ---------- */
L['mss-bkp:6:3']={blocks:[
{p:'**SQL Server Managed Backup to Microsoft Azure** lets the service decide when to take full and log backups, based on a retention period and the workload. It is the least-work option for small teams.'},
{svg:mbk},
{code:`-- Enable managed backup for one database
EXEC msdb.managed_backup.sp_backup_config_basic
  @database_name = 'SalesDB',
  @enable_backup = 1,
  @container_url = 'https://mystorage.blob.core.windows.net/sqlbackups',
  @retention_days = 14;

-- Check configuration
SELECT * FROM msdb.managed_backup.fn_backup_db_config('SalesDB');`},
{h:'Pros and cons'},
{t:[['Pros','Cons'],
['Little to configure and maintain','Less control over timing and naming'],
['Backups stored off-site','Retention limited to a small number of days'],
['Log backup frequency follows activity','Not a replacement for your own tested strategy']]},
{note:'Whichever tool takes backups, you still need **test restores** and an **alert** for failures. Managed backup removes the scheduling work, not the verification work.'}],
src:[['SQL Server Managed Backup to Microsoft Azure',M.RD+'backup-restore/sql-server-managed-backup-to-microsoft-azure'],['sp_backup_config_basic',M.RD+'system-stored-procedures/managed-backup-sp-backup-config-basic-transact-sql']]};

})();
