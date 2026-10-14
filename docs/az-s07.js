/* LearnSphere - Azure Administrator, Section 07: Storage Accounts.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const acct=K.dg(700,240,[
[10,10,680,220,'One storage account, several services',1],
[30,55,140,50,'Blob|objects',0],[190,55,140,50,'Files|SMB and NFS',0],[350,55,140,50,'Queue|messages',0],[510,55,140,50,'Table|NoSQL key-value',0],
[30,135,620,60,'Shared account settings: redundancy, network rules, encryption, keys, access tier default',2]],
[]);

const red=K.dg(700,260,[
[10,10,680,240,'How data is copied',1],
[30,50,200,70,'LRS|3 copies, one datacenter',0],[250,50,200,70,'ZRS|3 copies across 3 zones',0],
[30,140,200,70,'GRS|LRS here + LRS in the pair',0],[250,140,200,70,'GZRS|ZRS here + LRS in the pair',2],
[480,50,180,70,'Within one region',1],[480,140,180,70,'Plus a second region',1]],
[]);

const net=K.dg(700,200,[
[10,10,680,180,'Storage firewall decision',1],
[30,60,140,70,'Request arrives|at the endpoint',0],[220,60,150,70,'Network rule|allows source?',2],[420,60,110,70,'Authorized?|key, SAS, Entra',0],[580,60,90,70,'Allowed',0]],
[[170,95,220,95],[370,95,420,95],[530,95,580,95]]);

/* ---------- 0 ---------- */
L['az:6:0']={blocks:[
{p:'An **Azure storage account** is a namespace that holds your data services. Everything you store, from blobs to file shares, lives inside an account that has a globally unique name and its own settings.'},
{svg:acct},
{h:'Services in an account'},
{t:[['Service','Stores','Typical use'],
['**Blob**','Unstructured objects','Backups, media, logs, static content, data lakes'],
['**Files**','SMB and NFS file shares','Lift and shift file servers, shared config'],
['**Queue**','Messages up to 64 KB','Decoupling application components'],
['**Table**','Key-value NoSQL','Simple structured data'],
['**Managed disks**','VM disks, a separate resource type','VM storage']]},
{h:'Account types'},
{t:[['Type','Redundancy options','Use'],
['**Standard general-purpose v2**','LRS, ZRS, GRS, GZRS, RA-GRS, RA-GZRS','Default choice for most workloads'],
['**Premium block blobs**','LRS, ZRS','Low latency, high transaction rates'],
['**Premium file shares**','LRS, ZRS','High-performance SMB and NFS'],
['**Premium page blobs**','LRS, ZRS','Unmanaged disks and page blob workloads']]},
{note:'General-purpose v1 and blob-only legacy accounts should be upgraded to v2. Standard general-purpose v2 supports all services and tiers.'}],
src:[['Storage account overview',K.STOR+'common/storage-account-overview']]};

/* ---------- 1 ---------- */
L['az:6:1']={blocks:[
{p:'Creating a storage account means choosing a handful of settings. Some can be changed later and some cannot, so know which is which.'},
{t:[['Setting','Notes','Changeable later?'],
['**Name**','3-24 characters, lowercase letters and digits, globally unique','No'],
['**Region**','Where the data lives','No (move by re-creating)'],
['**Performance**','Standard or Premium','No'],
['**Redundancy**','LRS, ZRS, GRS, GZRS and read-access options','Yes, with limits'],
['**Access tier default**','Hot or Cool for blobs','Yes'],
['**Hierarchical namespace**','Data Lake Storage Gen2 behavior','Only enabled at creation'],
['**Public network access and firewall**','Who can reach it','Yes'],
['**Minimum TLS version**','Reject older TLS','Yes']]},
{code:`az storage account create \\
  --name stdemoapp001 --resource-group rg-storage --location westeurope \\
  --sku Standard_GRS --kind StorageV2 --access-tier Hot \\
  --min-tls-version TLS1_2 --allow-blob-public-access false

az storage account show --name stdemoapp001 --query "{sku:sku.name,tier:accessTier,tls:minimumTlsVersion}"`},
{h:'Service endpoints'},
{p:'Each service has its own endpoint: `https://<account>.blob.core.windows.net`, `.file.core.windows.net`, `.queue.core.windows.net` and `.table.core.windows.net`. A **custom domain** can map to the blob endpoint.'},
{h:'Defaults worth setting'},
{ul:['Turn **off** anonymous blob access unless a public container is intended.','Require **secure transfer** (HTTPS) and TLS 1.2 or higher.','Use a naming standard and tags from the start.']}],
src:[['Create a storage account',K.STOR+'common/storage-account-create']]};

/* ---------- 2 ---------- */
L['az:6:2']={blocks:[
{p:'**Redundancy** decides how many copies of your data exist and where they are. It trades durability and availability against cost.'},
{svg:red},
{t:[['Option','Copies','Survives','Durability (over a year)'],
['**LRS**','3 in one datacenter','Drive and rack failure','11 nines'],
['**ZRS**','3 across availability zones','Datacenter (zone) failure','12 nines'],
['**GRS**','LRS + async copy to paired region (LRS)','Region outage (after failover)','16 nines'],
['**GZRS**','ZRS + async copy to paired region (LRS)','Zone and region failure','16 nines'],
['**RA-GRS / RA-GZRS**','Same as GRS or GZRS, plus **read** access to the secondary','Reads continue during a regional outage','16 nines']]},
{h:'Choosing'},
{ul:['**LRS**: cheapest, for data easily recreated or when residency forbids leaving a datacenter.','**ZRS**: production workloads that need to survive a zone outage within a region.','**GRS or GZRS**: disaster recovery across regions.','**Read-access** variants: when applications can read from the secondary endpoint.']},
{h:'Changing redundancy'},
{code:`az storage account update --name stdemoapp001 --resource-group rg-storage --sku Standard_ZRS`},
{p:'Some changes are done by **live migration** (for example LRS to GRS) and others, such as LRS to ZRS in some regions, may need a conversion request. The secondary of a geo-redundant account is **asynchronous**, so recent writes can be lost on failover (recovery point objective is typically under 15 minutes).'}],
src:[['Azure Storage redundancy',K.STOR+'common/storage-redundancy'],['Change redundancy',K.STOR+'common/redundancy-migration']]};

/* ---------- 3 ---------- */
L['az:6:3']={blocks:[
{p:'**Object replication** asynchronously copies block blobs between containers in **different storage accounts**, based on rules you define. It is useful for lower latency reads, data distribution and compliance copies.'},
{h:'Prerequisites'},
{ul:['**Blob versioning** enabled on both source and destination accounts.','**Change feed** enabled on the source account.','Both accounts are general-purpose v2 or premium block blob.','Source and destination can be in different regions, subscriptions or tenants.']},
{flow:['Enable versioning on both accounts and change feed on the source','Create a replication policy on the destination with a source and destination container','Add rules with an optional prefix filter and start-time option','New and changed blobs are copied asynchronously','Monitor replication status on each blob']},
{code:`az storage account blob-service-properties update -n stsrc001 -g rg-a --enable-versioning true --enable-change-feed true
az storage account blob-service-properties update -n stdst001 -g rg-b --enable-versioning true
az storage account or-policy create --account-name stdst001 -g rg-b --source-account stsrc001 --destination-container dstc --source-container srcc --min-creation-time 2026-01-01T00:00:00Z`},
{h:'Behavior'},
{t:[['Aspect','Detail'],
['Direction','One way, source to destination. Create a second policy for the reverse'],
['Timing','Asynchronous, no fixed time guarantee'],
['Destination writes','Treat the destination as read-only to avoid conflicts'],
['Compare','Not the same as GRS, which is whole-account and not readable unless RA']]}],
src:[['Object replication',K.STOR+'blobs/object-replication-overview']]};

/* ---------- 4 ---------- */
L['az:6:4']={blocks:[
{p:'Azure Storage encrypts all data **at rest** automatically with 256-bit AES. You decide who controls the keys.'},
{t:[['Option','Key owner','Notes'],
['**Microsoft-managed keys**','Microsoft','Default. No configuration, Microsoft rotates'],
['**Customer-managed keys (CMK)**','You, in Azure Key Vault or Managed HSM','You control rotation, access and revocation']]},
{h:'Using customer-managed keys'},
{flow:['Create a Key Vault with soft delete and purge protection','Create a key','Give the storage account a managed identity','Grant the identity wrap and unwrap permissions on the key','Configure the account encryption to use the key','Enable key rotation, ideally automatic']},
{code:`az storage account update --name stdemoapp001 --resource-group rg-storage \\
  --encryption-key-source Microsoft.Keyvault \\
  --encryption-key-vault https://kv-demo.vault.azure.net \\
  --encryption-key-name stkey`},
{h:'Other encryption layers'},
{ul:['**Infrastructure encryption**: a second layer of encryption at the platform, chosen at account creation.','**Encryption scopes**: different keys per container or blob in the same account.','**In transit**: HTTPS and SMB encryption, enforced with secure transfer required.']},
{note:'If a customer-managed key is deleted or access is revoked, the data becomes inaccessible. Always enable purge protection on the vault.'}],
src:[['Storage encryption',K.STOR+'common/storage-service-encryption'],['Customer-managed keys',K.STOR+'common/customer-managed-keys-overview']]};

/* ---------- 5 ---------- */
L['az:6:5']={blocks:[
{p:'By default, a storage account accepts requests from any network that can reach its public endpoint (still requiring authorization). The **firewall and virtual network rules** narrow that.'},
{svg:net},
{h:'Options'},
{t:[['Option','What it does'],
['**Public access: enabled from all networks**','Default, reachable from the internet'],
['**Enabled from selected virtual networks and IP addresses**','Allow listed subnets (service endpoints) and IP ranges'],
['**Disabled**','No public access. Use private endpoints only'],
['**Trusted Azure services exception**','Lets selected Azure services bypass the firewall']]},
{code:`az storage account update -n stdemoapp001 -g rg-storage --default-action Deny
az storage account network-rule add -n stdemoapp001 -g rg-storage --ip-address 203.0.113.10
az storage account network-rule add -n stdemoapp001 -g rg-storage --vnet-name vnet-app --subnet snet-app
az storage account update -n stdemoapp001 -g rg-storage --bypass AzureServices`},
{h:'Important details'},
{ul:['IP rules accept **public** IPs, not private ranges.','Subnets must have the **Microsoft.Storage service endpoint** enabled to be added.','Rules apply to all services in the account.','A **private endpoint** gives a private IP inside your VNet and is the strongest option (Section 12).']},
{note:'After setting the default action to Deny, you need to allow your own IP, or portal and tool access fails with an authorization error.'}],
src:[['Configure storage firewalls and virtual networks',K.STOR+'common/storage-network-security']]};

/* ---------- 6 ---------- */
L['az:6:6']={blocks:[
{p:'Storage has several ways to authorize a client. They differ in power and in how safely you can limit them.'},
{t:[['Method','Power','Risk'],
['**Account access keys**','Full control of the entire account','Very high, they are like root passwords'],
['**Shared access signature (SAS)**','Delegated, limited access with time, permissions and resource scope','Medium, valid until it expires unless tied to a policy'],
['**Entra ID with RBAC**','Identity-based, per user or app','Low, centrally managed and auditable']]},
{h:'Access keys'},
{p:'Each account has **two keys** so you can rotate without downtime. Anyone with a key can do anything to data in the account. Store them in Key Vault and rotate regularly.'},
{code:`az storage account keys list -n stdemoapp001 -g rg-storage
az storage account keys renew -n stdemoapp001 -g rg-storage --key primary`},
{h:'Shared access signatures'},
{p:'A SAS is a signed URL token. It states **which resource, which permissions, for how long, from which IPs and protocols**.'},
{code:`az storage container generate-sas --account-name stdemoapp001 --name data --permissions r --expiry 2026-12-31T00:00Z --https-only --auth-mode key`},
{h:'Stored access policies'},
{p:'A **stored access policy** is defined on a container. A SAS can reference it, and changing or deleting the policy changes or revokes every SAS that uses it. This is the practical way to revoke a service SAS.'},
{note:'An ad hoc SAS signed with the account key cannot be revoked individually, except by rotating the key. Prefer short lifetimes and policies.'}],
src:[['Shared access signatures',K.STOR+'common/storage-sas-overview'],['Manage account keys',K.STOR+'common/storage-account-keys-manage']]};

/* ---------- 7 ---------- */
L['az:6:7']={blocks:[
{p:'**Identity-based access** uses Microsoft Entra ID to authorize storage requests, so no key or SAS is needed. Permissions are Azure RBAC roles evaluated at each request.'},
{h:'Data roles'},
{t:[['Role','Allows'],
['**Storage Blob Data Reader**','Read and list blobs and containers'],
['**Storage Blob Data Contributor**','Read, write and delete blobs and containers'],
['**Storage Blob Data Owner**','Full control including POSIX ACLs'],
['**Storage Queue Data Contributor**','Read, write and delete queue messages'],
['**Storage File Data SMB Share Contributor**','Read, write and delete files over SMB']]},
{code:`# Use the signed-in identity instead of a key
az storage blob list --account-name stdemoapp001 --container-name data --auth-mode login

# Give a group access
az role assignment create --assignee-object-id <group-id> --assignee-principal-type Group --role "Storage Blob Data Reader" --scope $(az storage account show -n stdemoapp001 -g rg-storage --query id -o tsv)`},
{h:'Benefits and limits'},
{ul:['No secrets to store or leak, and access is revocable by removing the role.','Works with **managed identities** for applications.','Needs the role at the right scope: account, container or resource group.','Control plane roles such as Contributor do **not** include data access.']},
{h:'Closing the key path'},
{p:'Set **Allow storage account key access** to disabled so that only Entra authorization is accepted.'}],
src:[['Authorize with Microsoft Entra ID',K.STOR+'blobs/authorize-access-azure-active-directory']]};

/* ---------- 8 ---------- */
L['az:6:8']={blocks:[
{p:'Lock down a new storage account with layered controls and verify each one.'},
{flow:['Create a v2 account with ZRS, TLS 1.2 and no public blob access','Create a container and upload a test blob','Restrict the firewall to your IP','Give a test user Storage Blob Data Reader','Generate a short-lived read-only SAS and test it','Turn off key access and confirm key-based requests fail']},
{code:`az storage account create -n stsecure001 -g rg-storage -l westeurope --sku Standard_ZRS --min-tls-version TLS1_2 --allow-blob-public-access false
az storage container create --account-name stsecure001 -n data --auth-mode login
az storage blob upload --account-name stsecure001 -c data -n hello.txt -f hello.txt --auth-mode login
az storage account update -n stsecure001 -g rg-storage --default-action Deny
az storage account network-rule add -n stsecure001 -g rg-storage --ip-address <your-public-ip>
az storage account update -n stsecure001 -g rg-storage --allow-shared-key-access false`},
{h:'Verification'},
{t:[['Test','Expected'],
['Anonymous GET of the blob URL','Fails'],
['Request from another IP','Blocked by the firewall'],
['User with Reader role downloads the blob','Allowed with --auth-mode login'],
['Request using the account key','Rejected once shared key access is off']]},
{note:'The firewall change can lock you out of the portal data view. Add your own IP before turning default action to Deny.'}],
src:[['Security recommendations for Blob storage',K.STOR+'blobs/security-recommendations']]};

})();
