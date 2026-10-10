/* LearnSphere - Backup & Recovery, Section 09: Enterprise Backup, Cloud & Ransomware Resilience.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const BR=O.D+'bradv/';
const ZD='https://docs.oracle.com/en/engineered-systems/zero-data-loss-recovery-appliance/';

/* ---------- diagrams ---------- */
const zd=O.dg(700,220,[
[10,40,150,120,'Protected|databases|(many)',2],
[220,10,260,200,'Recovery Appliance',1],[240,45,220,40,'Real-time redo transport',0],[240,100,220,40,'Incremental forever,|virtual full backups',0],[240,155,220,40,'Validate, replicate, tape',0],
[540,20,150,60,'Replica|appliance',0],[540,120,150,60,'Tape or cloud|archive',0]],
[[160,100,220,100],[480,60,540,50],[480,160,540,150]]);

const arch=O.dg(700,200,[
[10,30,150,70,'Primary|database',2],
[220,10,150,60,'Standby|(Active Data Guard)|offloads backups',0],
[220,110,150,60,'Local backup|disk (fast restore)',0],
[430,10,120,60,'Second site|copy',0],
[430,110,120,60,'Cloud object|storage',0],
[600,60,90,70,'Tape or|immutable|vault',0]],
[[160,55,220,40],[160,75,220,140],[370,40,430,40],[370,140,430,140],[550,40,600,80],[550,140,600,110]]);

/* ---------- 0: ZDLRA ---------- */
L['ora-bkp:8:0']={blocks:[
{p:'The **Zero Data Loss Recovery Appliance (ZDLRA)** is an Oracle engineered system for **backing up many databases**. Databases send **redo in real time** and only **changed blocks** after the first backup.'},
{svg:zd},
{t:[['Concept','Meaning'],
['**Real-time redo transport**','The database ships redo to the appliance as it is generated. Loss is seconds or zero, not "since the last log backup".'],
['**Incremental forever**','After the first level 0, only level 1 backups are taken. The appliance builds **virtual full backups**.'],
['**Validation**','The appliance checks backups for corruption'],
['**Replication and tape**','Copies to another appliance, to tape or to the cloud'],
['**Central policy**','Recovery window per database and a central view']]},
{h:'Value'},
{ul:['Lower RPO than log backups every few minutes.','Less load on production, because full backups are no longer taken.','One place for the fleet, with reports and policies.']},
{note:'ZDLRA is for fleets and critical databases. For a few small databases, plain RMAN to disk and a standby is enough.'}],
src:[['Zero Data Loss Recovery Appliance',ZD]]};

/* ---------- 1: Object storage ---------- */
L['ora-bkp:8:1']={blocks:[
{p:'Backups can go to **cloud object storage** through the Oracle Database Cloud Backup Module (or the service-specific integration). It is cheap, durable and off-site.'},
{t:[['Aspect','Notes'],
['**Interface**','RMAN SBT device with a cloud backup library, or the OCI integration'],
['**Cost**','Pay for storage and, sometimes, requests and retrieval'],
['**Durability**','High, replicated by the provider'],
['**Restore speed**','Limited by network bandwidth and egress'],
['**Security**','Encrypt before it leaves the premises, and protect credentials']]},
{code:`CONFIGURE CHANNEL DEVICE TYPE sbt
  PARMS \'SBT_LIBRARY=<library path>, SBT_PARMS=(<config file>)\';
CONFIGURE DEFAULT DEVICE TYPE TO sbt;
BACKUP AS COMPRESSED BACKUPSET DATABASE;`},
{h:'Design points'},
{ul:['Keep **recent** backups on local disk for fast restore. Send older backups to the cloud.','Size the bandwidth for the restore, not only the backup.','Use lifecycle rules to move old data to cheaper tiers.']},
{note:'A restore that must pull 20 TB over a 1 Gbps link takes more than 44 hours. Calculate the restore time before choosing the cloud as the only copy.'}],
src:[['Cloud backup',BR]]};

/* ---------- 2: Encrypted and immutable ---------- */
L['ora-bkp:8:2']={blocks:[
{p:'Attackers delete or encrypt backups first. Protect them with **encryption** and **immutability**.'},
{t:[['Control','What it gives','Notes'],
['**Backup encryption**','Data is useless without the key','Keep the key outside the backups'],
['**Immutability (WORM)**','A backup cannot be changed or deleted for a retention time','Object storage retention rules, appliance or vault'],
['**Air gap**','A copy that is offline or logically isolated','Tape or a separate account'],
['**Separate credentials**','The backup system cannot be reached with production admin accounts','Different identity provider or account'],
['**Monitoring**','Alerts when backups are deleted or changed','Audit events']]},
{flow:['Encrypt the backup','Write it to storage with a retention lock','Copy to a second location with separate credentials','Test restore from the protected copy']},
{note:'If one stolen admin password can delete both production and every backup, you do not have a backup, you have a copy.'}],
src:[['Backup security',BR]]};

/* ---------- 3: Architectures ---------- */
L['ora-bkp:8:3']={blocks:[
{p:'Choose where backups are taken and where they go. Four common building blocks.'},
{svg:arch},
{t:[['Pattern','Idea','Benefit'],
['**Standby offload**','Back up on the standby (Active Data Guard)','Primary has no backup load'],
['**Local disk first**','Recent backups on fast disk','Quick restore'],
['**Centralized**','All databases to one appliance or repository','Policy and reporting'],
['**Tiered**','Disk, then cloud, then tape or vault','Cost and retention']]},
{h:'Rule of three'},
{ul:['**3** copies of the data (production plus two backups).','**2** different media or systems.','**1** copy off site, ideally immutable.']},
{note:'RMAN can back up files on a physical standby and use them to restore the primary, because the files are interchangeable.'}],
src:[['Backup architectures',BR]]};

/* ---------- 4: DR vs backup ---------- */
L['ora-bkp:8:4']={blocks:[
{p:'Backup and disaster recovery solve **different** problems.'},
{t:[['','Backup','Disaster recovery (standby)'],
['**Protects against**','Loss, corruption, mistakes, ransomware','Site or system loss'],
['**RPO**','Last backup or log','Seconds or zero'],
['**RTO**','Hours (restore time)','Minutes (switchover or failover)'],
['**Time travel**','Yes, any time within retention','Limited (delay, Flashback)'],
['**Copies a mistake?**','No (kept as of that time)','**Yes**, within seconds'],
['**Cost**','Lower','Higher (second site and licenses)']]},
{flow:['Business requirements say RPO and RTO','If RTO is hours and loss is acceptable: backups can be enough','If RTO is minutes: add a standby','Always keep backups too, for corruption and human error']},
{note:'A standby replays a `DROP TABLE` as faithfully as an `INSERT`. Only a delay, Flashback, or a backup lets you go back in time.'}],
src:[['Data Guard',O.DG],['Backup and recovery',BR]]};

/* ---------- 5: Security ---------- */
L['ora-bkp:8:5']={blocks:[
{p:'The backup system is a **target**. Protect who can run, change and delete backups.'},
{t:[['Principle','In practice'],
['**Separation of duties**','The person who administers the database is not the only one who can delete its backups'],
['**Least privilege**','Backup user has `SYSBACKUP`, not `SYSDBA`'],
['**Key management**','TDE keystore and backup keys in a separate vault, backed up separately'],
['**Credential safety**','Cloud and SBT credentials in a wallet, not in scripts'],
['**Audit**','Log who changed retention or deleted backups'],
['**Network**','Backup traffic on a dedicated, restricted network']]},
{code:`-- RMAN with a secure external password store (wallet)
mkstore -wrl /home/oracle/wallet -create
mkstore -wrl /home/oracle/wallet -createCredential prodbackup sysbackup <password>
-- sqlnet.ora: WALLET_LOCATION and SQLNET.WALLET_OVERRIDE=TRUE
rman target /@prodbackup`},
{note:'Back up the wallet and keystore **separately** and test that you can restore with them. Without keys, encrypted backups are lost.'}],
src:[['Securing backups',BR]]};

/* ---------- 6: Practical ---------- */
L['ora-bkp:8:6']={blocks:[
{p:'Design backup and recovery for a **mission-critical** database. This is a design exercise: fill the table and justify each choice.'},
{h:'Requirements'},
{t:[['Item','Value'],
['Database','12 TB, RAC, 24x7 trading platform'],
['RPO','Zero for committed trades'],
['RTO','15 minutes for site loss, 2 hours for corruption'],
['Compliance','7 years retention, encrypted, immutable archive'],
['Threat','Ransomware with admin access is in scope']]},
{h:'Your design'},
{t:[['Layer','Choice'],
['Site failure','Synchronous Data Guard standby with fast-start failover? Far sync?'],
['Corruption / mistakes','Flashback, delayed copy, backups'],
['Backup tool','RMAN with incrementals, or ZDLRA?'],
['Where to back up','Standby offload'],
['Local copy','Disk with fast restore'],
['Off-site','Object storage with retention lock'],
['Long term','Yearly KEEP backups to vault'],
['Security','Encryption, separate credentials, immutable copy, audit'],
['Testing','Restore drill schedule and measured RTO']]},
{h:'Check your result'},
{ul:['Every requirement has a technical answer.','You can restore to a point in time when ransomware hits.','Restore time from the off-site copy was calculated from bandwidth.','Key management is described.']},
{note:'Show which layer answers which failure. If two failures have only one answer, one of them is not really covered.'}],
src:[['MAA best practices','https://www.oracle.com/database/technologies/maximum-availability-architecture/'],['Backup and Recovery User\'s Guide',BR]]};

})();
