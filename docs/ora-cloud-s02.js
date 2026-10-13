/* LearnSphere - Oracle in the Cloud, Section 02: OCI Base Database and Exadata Database Service.
   Needs ora-common.js. Lesson keys ora-cloud:1:<lecture>. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const dg=O.dg;

L['ora-cloud:1:0']={blocks:[
{p:'**OCI Base Database** runs a full Oracle Database on a compute node that OCI provisions and prepares. You get the same database you know, with OCI tooling for creation, backup, patching and Data Guard.'},
{svg:dg(700,260,[[10,10,680,240,'VCN',1],[30,45,200,80,'Client subnet|bastion, applications',0],[260,45,410,190,'DB system',1],[280,80,180,60,'Compute node|VM or bare metal',2],[480,80,170,60,'Grid Infrastructure|and Oracle Database',0],[280,160,180,55,'Block storage|(ASM or LVM)',0],[480,160,170,55,'Object Storage|backups',0],[30,150,200,60,'Backup subnet',0]],[[230,85,280,110],[460,110,480,110],[370,140,370,160],[650,215,570,190]])},
{h:'Building blocks'},
{t:[['Piece','What it is','Notes'],['**DB system**','The compute node (or nodes), storage and software that host your databases','One or two nodes (two for RAC on VM)'],['**Shape**','CPU and memory size. VM flexible shapes let you choose cores. Bare metal gives a whole server.','VM shapes can scale online. Bare metal does not.'],['**Edition**','Standard, Enterprise, Enterprise High Performance, Extreme Performance','Determines included options'],['**Storage management**','Oracle ASM (Grid Infrastructure) or Logical Volume Manager','ASM is needed for RAC and offers normal or high redundancy'],['**Database home**','An Oracle home with a patch level. A DB system may have several.','Used for out-of-place patching'],['**CDB and PDBs**','Databases are created as multitenant container databases','Create more PDBs with SQL or the console'],['**Subnets**','Client subnet for applications, and a backup subnet for traffic to Object Storage','Security lists or NSGs control port 1521']]},
{ul:['You connect to the node by SSH as `opc`, then switch to `oracle` or `grid`. The database is yours to administer with SQL*Plus, RMAN and `dbaascli` or `dbcli`.','OCI performs life-cycle operations (backup, patch, Data Guard) by running automation on the node. Do not remove the agent software or unsupported-change the home it uses.']}
],src:[['Oracle Base Database Service','https://docs.oracle.com/en-us/iaas/base-database/index.html']]};

L['ora-cloud:1:1']={blocks:[
{p:'Creating a DB system takes a few decisions up front, because some of them (edition, storage management, network) are hard to change later.'},
{flow:['Choose compartment, AD and shape','Choose edition, version and storage management','Choose network, subnet and SSH key','Set the admin password and PDB name','Create, wait, connect and check']},
{code:`# example only: names, OCIDs and sizes are placeholders
oci db system launch \\
  --compartment-id ocid1.compartment.oc1..aaaa \\
  --availability-domain "Uocm:EU-FRANKFURT-1-AD-1" \\
  --shape VM.Standard.E4.Flex --cpu-core-count 4 \\
  --database-edition ENTERPRISE_EDITION_HIGH_PERFORMANCE \\
  --db-version 19.0.0.0 --db-name ORCL --pdb-name PDB1 \\
  --admin-password '********' --hostname dbhost01 \\
  --subnet-id ocid1.subnet.oc1..bbbb \\
  --ssh-authorized-keys-file ~/.ssh/id_rsa.pub \\
  --initial-data-storage-size-in-gb 256 --license-model LICENSE_INCLUDED`},
{h:'Connect and check'},
{code:`# 1. reach the node (through a bastion or private connectivity)
ssh -i ~/.ssh/id_rsa opc@dbhost01
sudo su - oracle

# 2. check the database and listener
sqlplus / as sysdba
SQL> SELECT name, open_mode, log_mode, cdb FROM v$database;
SQL> SELECT con_id, name, open_mode FROM v$pdbs;
$ lsnrctl status

# 3. connect as an application would
sqlplus app_user/***@//dbhost01.sub.vcn.oraclevcn.com:1521/pdb1.sub.vcn.oraclevcn.com`},
{t:[['Check','Expected'],['Database in ARCHIVELOG','Yes (default on managed DB systems)'],['Backups configured','Automatic backup enabled with a retention'],['Service name resolves','Using the VCN DNS name'],['Port 1521 reachable only from the application subnet','Security list or NSG limits the source'],['TDE wallet open','Encryption is on by default']]},
{note:'Choose the **storage management** and the **subnet** carefully. Changing either later usually means building a new DB system and moving the database.'}
],src:[['Creating a DB system','https://docs.oracle.com/en-us/iaas/base-database/index.html']]};

L['ora-cloud:1:2']={blocks:[
{p:'Backups on Base Database are **RMAN backups written to OCI Object Storage**. The service schedules them, tracks them and drives restores. You choose the retention and you are responsible for testing recovery.'},
{t:[['Type','What it is','Notes'],['**Automatic backup**','A level 0 backup followed by incrementals, plus continuous archived log backup','Retention from days to about two months. Set by policy.'],['**Manual (standalone) backup**','A full backup you start on demand','Kept until you delete it. Use before big changes.'],['**Long-term backup**','A backup kept for a long retention','Compliance and archive']]},
{t:[['Restore option','Result'],['Restore to the **latest** backup or recovery point','Brings the database to the most recent recoverable state'],['Restore to a **timestamp or SCN**','Point-in-time recovery inside the retention window'],['**Create a new database from a backup**','A new database in a DB system, leaving the original untouched']]},
{code:`# list and start a manual backup (OCI CLI)
oci db backup list --database-id <database-ocid>
oci db backup create --database-id <database-ocid> --display-name before-release-42

# restore to a point in time (the database is unavailable during restore)
oci db database restore --database-id <database-ocid> --timestamp "2026-10-13T14:31:00.000Z"`},
{ul:['Backups depend on the **Object Storage connectivity** from the backup subnet, and on the service agent running on the node. A broken path shows as failed backups.','**Test a restore** into a new database at least quarterly: create from backup, check the data, record the time.','A standby database (Data Guard) is a different protection. It does not replace backups.']},
{note:'Recovery steps use RMAN underneath, so the recovery concepts from the Backup and Recovery sub-course apply. The service only automates the commands.'}
],src:[['Backing up and restoring a database','https://docs.oracle.com/en-us/iaas/base-database/index.html']]};

L['ora-cloud:1:3']={blocks:[
{p:'On Base Database, **OCI provides the patches and the automation**, and you decide **when** to apply them. A patch has two targets: the **Grid Infrastructure** home (where present) and each **database home**.'},
{flow:['See available patches','Run the precheck','Back up the database','Apply to the Grid Infrastructure','Apply to the database home','Verify the patch level']},
{t:[['Method','What happens','Notes'],['**In-place patch**','Patches the existing home and the database restarts from it','Short downtime on one node. Rolling on RAC.'],['**Out-of-place (move to a new home)**','Create a new patched database home and move the database to it','Faster rollback. Recommended for production.'],['**Version upgrade**','Upgrade the database to a newer release with automation (AutoUpgrade behind the scenes)','Test on a clone first']]},
{code:`# precheck and apply with the OCI CLI (example)
oci db database patch list --database-id <database-ocid>
oci db database patch apply --database-id <database-ocid> --patch-id <patch-ocid> --patch-action PRECHECK
oci db database patch apply --database-id <database-ocid> --patch-id <patch-ocid> --patch-action APPLY

# on the node, the same through dbaascli (release dependent)
dbaascli patch db prereq --dbname ORCL
dbaascli patch db apply  --dbname ORCL`},
{ul:['Run **precheck** first and fix what it reports (space, missing prerequisites, invalid objects).','Take a **manual backup** before applying.','After the patch, check `DBA_REGISTRY_SQLPATCH` and the application, as you would on-premises.']}
],src:[['Patching a Base Database','https://docs.oracle.com/en-us/iaas/base-database/index.html'],['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm']]};

L['ora-cloud:1:4']={blocks:[
{p:'High availability and scaling are options of the DB system. Choose them when you create it, or add them as the requirement becomes clear.'},
{t:[['Need','Option','Notes'],['More CPU or memory','Scale the OCPU or ECPU count of a flexible VM shape','Online on VM flex shapes, with a small impact'],['More storage','Increase the block storage size','Online. Cannot be reduced.'],['Protect from node failure','A **two-node RAC** DB system','Needs ASM storage and a suitable edition'],['Protect from site or AD failure','A **Data Guard association** with a standby in another AD or Region','Choose the protection mode (Maximum Availability or Maximum Performance)'],['Planned maintenance','Switchover to the standby','A role swap with no data loss'],['Unplanned outage','Failover to the standby','Possible data loss depends on protection mode']]},
{code:`# create a standby (Data Guard association) in another availability domain
oci db data-guard-association create from-existing-db-system \\
  --database-id <primary-database-ocid> --creation-type ExistingDbSystem \\
  --database-admin-password '********' --protection-mode MAXIMUM_PERFORMANCE \\
  --transport-type ASYNC --peer-db-system-id <standby-dbsystem-ocid>

# switchover and failover
oci db data-guard-association switchover --database-id <primary-ocid> --data-guard-association-id <assoc-ocid> --database-admin-password '********'
oci db data-guard-association failover   --database-id <standby-ocid> --data-guard-association-id <assoc-ocid> --database-admin-password '********'`},
{ul:['The service uses the **Data Guard broker** under the hood. The concepts (protection modes, redo transport, lag) are the same as in the Data Guard sub-course.','Application connection strings need a **role-based service** or a connection descriptor that tries both sites.','Test a **switchover** once a quarter, with the application.']}
],src:[['Using Data Guard with Base Database','https://docs.oracle.com/en-us/iaas/base-database/index.html']]};

L['ora-cloud:1:5']={blocks:[
{p:'**Exadata Database Service** runs your Oracle databases on **Exadata hardware** operated by the cloud provider. You get the Exadata features (Smart Scan, flash caching, storage-level I/O management) with a cloud billing and provisioning model.'},
{svg:dg(700,230,[[10,10,680,210,'Exadata infrastructure (operated by Oracle)',1],[30,45,200,70,'Storage servers|Smart Scan, flash',0],[250,45,200,70,'RoCE network|switches',0],[470,45,200,70,'Database servers|hypervisor',0],[30,135,640,70,'VM cluster (yours): Grid Infrastructure, databases, your OS and software',2]],[[230,80,250,80],[450,80,470,80],[570,115,570,135]])},
{t:[['Level','Who manages it','What it is'],['**Exadata infrastructure**','Provider','Storage servers, database servers, network, firmware'],['**VM cluster**','You','VMs on the database servers, with Grid Infrastructure (ASM on grid disks) and your OS'],['**Databases and PDBs**','You','As on any Oracle system, with options included']]},
{ul:['Typical sizes start with a quarter-rack-class configuration, and capacity is added by adding database or storage servers.','It is available as **Dedicated Infrastructure**, **Cloud@Customer** (in your data centre) and inside other clouds through the multicloud offerings.','Operations reuse the Exadata sub-course: IORM, patching order, Smart Scan checks and cell tools apply in your VM cluster.']},
{note:'Choose Exadata Database Service when the workload justifies the Exadata features and scale. For standard workloads, Base Database or Autonomous is more economical.'}
],src:[['Exadata Database Service','https://docs.oracle.com/en-us/iaas/exadatacloud/index.html']]};

L['ora-cloud:1:6']={blocks:[
{p:'Do this in a lab compartment with budgets set, and delete everything at the end.'},
{flow:['Create the DB system','Connect and create test data','Take a manual backup','Create a new database from the backup','Add a Data Guard standby','Switch over and back','Clean up']},
{t:[['Step','What to do','What to check'],['1. Create','Launch a small flexible VM DB system with a PDB','Status Available, listener up'],['2. Data','Create a table and insert rows','`SELECT COUNT(*)`'],['3. Backup','Start a manual backup and wait for it','Backup status Active, size and time'],['4. Restore','Create a new database from that backup in a second DB system','Row count matches'],['5. Standby','Create a Data Guard association in another AD','Role, lag, protection mode'],['6. Switchover','Run a switchover and reconnect','Role swapped, no data loss'],['7. Clean up','Delete the associations, databases, DB systems and backups','No resources left, no cost']]},
{note:'Record the **time** each step takes. Those numbers are the beginning of your own recovery and switchover runbook.'}
],src:[['Oracle Base Database Service','https://docs.oracle.com/en-us/iaas/base-database/index.html']]};

L['ora-cloud:1:7']={blocks:[
{p:'A console click is not repeatable. For production, describe database resources as **code** so they can be reviewed, versioned and recreated.'},
{code:`# Terraform (OCI provider) - a DB system sketch
resource "oci_database_db_system" "prod" {
  compartment_id      = var.compartment_id
  availability_domain = var.ad
  shape               = "VM.Standard.E4.Flex"
  cpu_core_count      = 4
  database_edition    = "ENTERPRISE_EDITION_HIGH_PERFORMANCE"
  hostname            = "dbhost01"
  subnet_id           = var.db_subnet_id
  ssh_public_keys     = [var.ssh_key]
  license_model       = "LICENSE_INCLUDED"
  db_home {
    db_version = "19.0.0.0"
    database {
      admin_password = var.admin_password   # keep in a vault, not in the repository
      db_name        = "ORCL"
      pdb_name       = "PDB1"
    }
  }
}`},
{ul:['Keep **secrets in a vault** and reference them, not in the repository.','Use **separate state and compartments** for production and non-production.','Review plans before apply, and protect databases with `prevent_destroy` lifecycle rules.']}
],src:[['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm']]};

})();
