/* LearnSphere - Azure Administrator, Section 14: Backup & Disaster Recovery.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const rpo=K.dg(700,200,[
[10,10,680,180,'RPO and RTO on a timeline',1],
[30,70,110,60,'Last good|backup',0],[210,50,120,100,'Failure|moment',2],[400,70,120,60,'Service|restored',0],
[560,70,110,60,'Normal|operation',0]],
[[140,100,210,100],[330,100,400,100],[520,100,560,100]]);

const vault=K.dg(700,220,[
[10,10,680,200,'Protected workload to vault',1],
[30,60,150,70,'Azure VM,|Files, SQL in VM',0],[250,60,170,70,'Backup policy|schedule and retention',2],[490,60,170,70,'Recovery Services|vault',0]],
[[180,95,250,95],[420,95,490,95]]);

const asr=K.dg(700,240,[
[10,10,680,220,'Site Recovery',1],
[30,50,260,150,'Primary region|VMs run here|Replication is continuous',0],[410,50,260,150,'Secondary region|Replica disks|VMs created on failover',2]],
[[290,125,410,125]]);

/* ---------- 0 ---------- */
L['az:13:0']={blocks:[
{p:'Backup and disaster recovery answer two questions: **how much data can we lose** and **how long can we be down**. Everything you design follows from these numbers.'},
{svg:rpo},
{t:[['Term','Meaning','Drives'],
['**RPO** (recovery point objective)','Maximum acceptable data loss, measured in time','How often you back up or replicate'],
['**RTO** (recovery time objective)','Maximum acceptable time to restore service','The recovery method and automation'],
['**Retention**','How long recovery points are kept','Storage cost and compliance']]},
{h:'Backup versus disaster recovery'},
{t:[['','Backup','Disaster recovery'],
['**Protects against**','Deletion, corruption, ransomware, mistakes','Loss of a site or region'],
['**Mechanism**','Point-in-time copies in a vault','Continuous replication to a second location'],
['**Recovery time**','Hours, restore from a copy','Minutes to hours, failover'],
['**Azure service**','Azure Backup','Azure Site Recovery']]},
{note:'You need both. Replication copies a corruption or a delete to the secondary quickly, so replication does not replace backup.'}],
src:[['Azure Backup overview',K.BKP+'backup-overview'],['Business continuity',K.D+'reliability/']]};

/* ---------- 1 ---------- */
L['az:13:1']={blocks:[
{p:'Backups are stored in a **vault**. There are two vault types, and which one you need depends on the workload.'},
{t:[['','Recovery Services vault','Backup vault'],
['**Protects**','Azure VMs, Azure Files, SQL and SAP HANA in VMs, on-premises with MARS and MABS','Azure Disks, Blobs, Azure Database for PostgreSQL, AKS'],
['**Also used for**','Site Recovery replication','Only backup'],
['**Create in**','Same region as the protected resource','Same region as the protected resource']]},
{h:'Vault settings'},
{ul:['**Storage redundancy**: LRS, ZRS or GRS (GRS is the default). Set before the first backup.','**Cross Region Restore**: restore from the paired region when GRS is used.','**Soft delete**: deleted backup data kept for 14 days by default, so ransomware cannot instantly wipe it.','**Immutable vault** and **multi-user authorization** add extra protection.']},
{code:`az backup vault create -g rg-bkp -n rsv-prod -l westeurope
az backup vault backup-properties set -g rg-bkp -n rsv-prod --backup-storage-redundancy GeoRedundant
az backup vault list -o table`},
{note:'A vault can only protect resources in its own region. Use one vault per region and workload class, for example per environment.'}],
src:[['Recovery Services vaults',K.BKP+'backup-azure-recovery-services-vault-overview'],['Backup vaults',K.BKP+'backup-vault-overview']]};

/* ---------- 2 ---------- */
L['az:13:2']={blocks:[
{p:'A **backup policy** states **when** backups run and **how long** each recovery point is kept. It is separate from the vault, and many items can share one policy.'},
{h:'Policy parts'},
{t:[['Part','Options'],
['**Schedule**','Daily or weekly, at a time of day. Enhanced policy allows hourly backups'],
['**Retention**','Daily, weekly, monthly and yearly recovery points'],
['**Instant restore**','Snapshots kept for 1 to 5 days for fast restore'],
['**Tier**','Vault-standard and optionally vault-archive for long-term retention']]},
{code:`az backup policy list-defaults-for-vm -g rg-bkp -v rsv-prod
az backup policy create -g rg-bkp -v rsv-prod -n pol-daily --backup-management-type AzureIaasVM --workload-type VM --policy @policy.json
az backup policy list -g rg-bkp -v rsv-prod -o table`},
{h:'Choosing retention'},
{ul:['Match retention to **legal and business** rules, not guesses.','Longer retention costs more storage, and archive tier lowers that cost.','Keep **instant restore** days short, since snapshots cost in the source resource group.']},
{t:[['Policy type','Notes'],
['**Standard**','Daily backup, simple retention'],
['**Enhanced**','Hourly backups, Trusted Launch VMs, multiple disks, and more']]}],
src:[['Backup policies',K.BKP+'backup-during-vm-creation'],['Manage Azure VM backup policies',K.BKP+'backup-azure-manage-vms']]};

/* ---------- 3 ---------- */
L['az:13:3']={blocks:[
{p:'Azure VM backup takes a **snapshot** of the VM disks through an extension, then transfers the data to the vault. It needs no agent installed by you.'},
{svg:vault},
{h:'Consistency'},
{t:[['Type','Meaning'],
['**Application-consistent**','Windows: VSS coordinates with apps. Linux: pre/post scripts'],
['**File-system consistent**','Consistent file system without app awareness'],
['**Crash-consistent**','As if power was cut. Used when the others are not possible']]},
{h:'Enable and restore'},
{code:`az backup protection enable-for-vm -g rg-bkp -v rsv-prod --vm vm-linux01 --policy-name DefaultPolicy
az backup protection backup-now -g rg-bkp -v rsv-prod -c vm-linux01 -i vm-linux01 --retain-until 30-12-2026
az backup recoverypoint list -g rg-bkp -v rsv-prod -c vm-linux01 -i vm-linux01 -o table`},
{t:[['Restore option','Result'],
['**Create new VM**','A new VM from the recovery point'],
['**Restore disks**','Disks to a storage account, then you build a VM from them'],
['**Replace existing**','Replace the disks of the current VM'],
['**File recovery**','Mount the recovery point to copy individual files'],
['**Cross region restore**','Restore in the paired region when GRS and CRR are enabled']]},
{note:'Restoring over an existing VM is destructive. For a safe test, restore as a new VM in an isolated network.'}],
src:[['Back up Azure VMs',K.BKP+'backup-azure-vms-first-look-arm'],['Restore VMs',K.BKP+'backup-azure-arm-restore-vms']]};

/* ---------- 4 ---------- */
L['az:13:4']={blocks:[
{p:'Azure Backup also protects data services, with a different mechanism for each.'},
{t:[['Workload','How it is backed up','Vault'],
['**Azure Files**','Share snapshots managed by a policy','Recovery Services vault'],
['**Blobs**','Operational backup (continuous, using versioning and point-in-time restore) and vaulted backup','Backup vault'],
['**Managed disks**','Incremental snapshots on a schedule','Backup vault'],
['**SQL Server in VM**','Full, differential and log backups with log chain','Recovery Services vault'],
['**On-premises files**','MARS agent','Recovery Services vault']]},
{h:'Notes by service'},
{ul:['**Files**: snapshot-based, the snapshots remain in the storage account, with the policy managing retention. Enable it per share.','**Blobs operational backup**: not a copy, it uses features of the account. Restore returns containers to an earlier time.','**Disks**: snapshots stay in a snapshot resource group you choose.','Backup protects against deletion, but you must also use **soft delete** and locks as defense in depth.']},
{code:`az backup protection enable-for-azurefileshare -g rg-bkp -v rsv-prod --storage-account stfiles001 --azure-file-share share1 --policy-name pol-files`},
{note:'Operational blob backup requires versioning and change feed. Check the prerequisites before enabling.'}],
src:[['Back up Azure Files',K.BKP+'backup-afs'],['Back up blobs',K.BKP+'blob-backup-overview'],['Back up disks',K.BKP+'disk-backup-overview']]};

/* ---------- 5 ---------- */
L['az:13:5']={blocks:[
{p:'A backup you have not checked is a hope, not a control. Monitor backup **jobs**, **alerts** and **reports** every day.'},
{h:'Where to look'},
{t:[['Place','Shows'],
['**Backup jobs**','Status of each backup and restore'],
['**Backup items**','Protection status and last backup time per item'],
['**Built-in alerts**','Failures and warnings, sent by email or to Azure Monitor'],
['**Backup center / Business continuity center**','One view across vaults and subscriptions'],
['**Backup reports**','Usage, jobs, policy adherence and costs, from Log Analytics']]},
{flow:['Enable diagnostic settings on the vault to a Log Analytics workspace','Open Backup reports and choose the scope','Review failed jobs and items without a recent backup','Create alerts for failures and missed backups','Review monthly with the application owners']},
{code:`az backup job list -g rg-bkp -v rsv-prod --status Failed -o table
az backup item list -g rg-bkp -v rsv-prod -o table`},
{note:'Test restores on a schedule. Many teams find that restores fail because of permissions, quotas or missing keys only when they need them.'}],
src:[['Monitor Azure Backup',K.BKP+'backup-azure-monitoring-built-in-monitor'],['Backup reports',K.BKP+'configure-reports']]};

/* ---------- 6 ---------- */
L['az:13:6']={blocks:[
{p:'**Azure Site Recovery (ASR)** replicates running VMs to a secondary region so you can fail over during a regional outage. Replication is continuous, which keeps RPO low.'},
{svg:asr},
{h:'How it works for Azure VMs'},
{flow:['Enable replication on the VM, choose target region, resource group and network','A Mobility service extension is installed on the VM','Disks replicate through a cache storage account in the source region','Replica disks and recovery points are kept in the target region','During failover, a VM is created from a recovery point']},
{h:'Concepts'},
{t:[['Term','Meaning'],
['**Replication policy**','Recovery point retention and app-consistent snapshot frequency'],
['**Recovery point**','Crash-consistent every few minutes, and app-consistent at an interval'],
['**Recovery plan**','Ordered failover of groups of VMs with scripts and manual steps'],
['**Target resources**','Region, resource group, VNet and availability setup in the target']]},
{ul:['The **vault** lives in the **target** region, in the same subscription as typical setups.','Cache storage, target network and quotas must be ready in advance.','ASR protects VMs. For PaaS services use their built-in geo-replication.']},
{note:'ASR is not a backup. Corruption is replicated. Keep Azure Backup in place.'}],
src:[['Site Recovery overview',K.ASR+'site-recovery-overview'],['Azure to Azure disaster recovery',K.ASR+'azure-to-azure-architecture']]};

/* ---------- 7 ---------- */
L['az:13:7']={blocks:[
{p:'A DR plan is only credible if it is **tested**. ASR provides a safe test, a real failover and a return path.'},
{t:[['Operation','What it does','Impact'],
['**Test failover**','Creates VMs in an isolated test network from a recovery point','No impact to production or replication'],
['**Failover**','Creates VMs in the target region and makes them the active workload','Real, the source may be down'],
['**Commit**','Finalizes the failover and discards other recovery points','Cannot go back to earlier points'],
['**Reprotect**','Reverses replication from target back to source','Starts syncing changes back'],
['**Failback**','Fail over again to return to the original region','Planned cutover']]},
{flow:['Run a test failover into an isolated network','Verify the application, then clean up the test','During an outage, run failover to the chosen recovery point','Commit the failover','When the source is healthy, reprotect and replicate back','Fail back and reprotect to restore the original direction']},
{h:'Recovery plans'},
{ul:['Group VMs into ordered steps such as database first, then app, then web.','Add automation runbooks and manual approval steps.','Tests must include DNS or traffic manager changes and dependencies.']},
{note:'Never test by failing over production. Always use test failover, and clean it up so it does not leave costs.'}],
src:[['Failover in Site Recovery',K.ASR+'site-recovery-failover'],['Run a DR drill',K.ASR+'azure-to-azure-tutorial-dr-drill']]};

/* ---------- 8 ---------- */
L['az:13:8']={blocks:[
{p:'Back up a VM, restore it, then replicate it and run a test failover.'},
{flow:['Create a vault and a VM in the source region','Enable backup with a policy and run a backup now','Delete a file in the VM, then recover it from the recovery point','Restore the VM disks or create a new VM from the point','Enable Site Recovery to a second region','Run a test failover and clean it up']},
{code:`az backup vault create -g rg-dr -n rsv-lab -l westeurope
az backup protection enable-for-vm -g rg-dr -v rsv-lab --vm vm1 --policy-name DefaultPolicy
az backup protection backup-now -g rg-dr -v rsv-lab -c vm1 -i vm1 --retain-until 01-12-2026
az backup restore restore-disks -g rg-dr -v rsv-lab -c vm1 -i vm1 -r <recovery-point-name> --storage-account stdrlab001 --target-resource-group rg-dr-restore`},
{h:'Checks'},
{t:[['Step','Expected'],
['First backup','Job completes and a recovery point appears'],
['File recovery','Script mounts the point and the file is copied back'],
['Test failover','A test VM starts in the target VNet'],
['Cleanup','Test resources removed']]},
{note:'Stop protection and delete backup data, the vault and the resource groups at the end. A vault with items cannot be deleted until they are removed.'}],
src:[['Azure Backup tutorials',K.BKP+'']]};

})();
