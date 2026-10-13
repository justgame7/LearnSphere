/* LearnSphere - Oracle in the Cloud, Section 05: Migration and Disaster Recovery.
   Needs ora-common.js. Lesson keys ora-cloud:4:<lecture>. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const dg=O.dg;

L['ora-cloud:4:0']={blocks:[
{p:'There are many ways to move a database, and most projects use more than one. Four facts decide the method: **how much data**, **how much downtime**, **whether the platform and version change**, and **whether the target is Autonomous**.'},
{t:[['Method','Downtime','Source and target','Good for','Limits'],['**Data Pump export and import**','Hours (export, transfer, import)','Any version to any version, any platform','Small and medium schemas, Autonomous and RDS targets','Time grows with size'],['**RMAN backup and restore**','Hours','Same platform family, restoring to a VM or Base Database','Whole database to a VM-based target','Not for Autonomous or RDS'],['**Data Guard (physical standby)**','Minutes (switchover)','Same platform and endian format, compatible versions','Large databases to Base Database or Exadata','Target must be a physical copy'],['**Zero Downtime Migration (ZDM)**','Minutes','Orchestrates RMAN, Data Guard, Data Pump and GoldenGate','Standard moves to OCI and Exadata services','Supported matrix applies'],['**GoldenGate**','Seconds to minutes','Heterogeneous, cross-version, cross-platform','Large databases and strict downtime, with fallback','Licence and design effort'],['**AWS DMS**','Minutes','To RDS and Aurora targets','AWS-side migrations','Data type limits, tuning'],['**Transportable tablespaces**','Short to hours','Same endian (or converted)','Very large data with few objects','Metadata work']]},
{flow:['Inventory: size, change rate, features, dependencies','Check target restrictions (Autonomous, RDS)','Pick method by downtime and platform','Rehearse with a copy and measure','Plan cut-over and fallback']},
{note:'Run an assessment tool before you commit: the **Cloud Premigration Advisor Tool (CPAT)** for Autonomous, the target service compatibility checks for RDS, and a plain feature usage report for the source.'}
],src:[['Zero Downtime Migration','https://docs.oracle.com/en/database/oracle/zero-downtime-migration/'],['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm']]};

L['ora-cloud:4:1']={blocks:[
{p:'**Data Pump** is the most general method, and it is the one most often used for Autonomous and RDS targets. The difference between targets is **how the dump file travels** and **how the import is run**.'},
{t:[['Target','How the dump reaches the target','How you import'],['**Base Database / VM**','Copy to the node (SCP) or an NFS or object storage mount','`impdp` on the node as `oracle`'],['**Autonomous Database**','Upload to **Object Storage**','`impdp` from a client with a credential and the object URI, or the Data Pump API'],['**Amazon RDS for Oracle**','Upload to **S3**, download into `DATA_PUMP_DIR` with S3 integration','`DBMS_DATAPUMP` API or `impdp` over a database link']]},
{code:`# export on the source
expdp system/*** schemas=APP directory=DP_DIR dumpfile=app_%U.dmp parallel=4 logfile=app_exp.log \\
      exclude=statistics compression=all

# upload to object storage (OCI CLI)
oci os object bulk-upload --bucket-name loads --src-dir /u01/dp --include 'app_*.dmp'

# import into Autonomous Database with impdp from a client
impdp admin/***@salesatp_high directory=data_pump_dir credential=OBJ_CRED \\
  dumpfile=https://objectstorage.eu-frankfurt-1.oraclecloud.com/n/mytenancy/b/loads/o/app_%U.dmp \\
  parallel=4 remap_tablespace=%:DATA exclude=cluster,db_link logfile=import.log`},
{ul:['**Remap tablespaces** to the single DATA tablespace on Autonomous, and exclude objects the service does not support.','Use **parallelism** and multiple files. Transfer time is often longer than export time, so plan bandwidth.','After import, **gather statistics**, recompile invalid objects and compare counts.']}
],src:[['Data Pump import to Autonomous Database','https://docs.oracle.com/en/cloud/paas/autonomous-database/index.html'],['Importing data into Oracle on Amazon RDS','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Oracle.html']]};

L['ora-cloud:4:2']={blocks:[
{p:'When the source and target are the **same platform family**, a physical standby is the least risky way to move a large database: the copy is built while production runs, and the cut-over is a switchover.'},
{flow:['Build the target database as a standby','Keep it synchronised','Test the target (snapshot standby or clone)','Stop writes, final sync','Switchover to the cloud','Keep the on-premises database as a fallback']},
{t:[['Item','Detail'],['Network','A private connection (VPN or FastConnect, Direct Connect, ExpressRoute) with enough bandwidth'],['Same endian format and compatible platform','Required for a physical standby'],['TDE wallet','Must be copied or recreated with the same master key'],['Parameters and services','Align `DB_UNIQUE_NAME`, listener, TNS and role-based services'],['Fallback','After switchover, reverse the roles or keep redo shipping back to on-premises for a while']]},
{h:'What ZDM adds'},
{ul:['A **response file** driven workflow that runs prechecks, builds the target, synchronises and switches over.','Support for **physical** (Data Guard, RMAN) and **logical** (Data Pump, GoldenGate) paths, online and offline.','A repeatable, auditable job with a pause point before the final switchover.']},
{code:`# example: evaluate, then migrate, with a pause before switchover
zdmcli migrate database -sourcedb ORCL -sourcenode srchost -srcauth zdmauth -srcarg1 user:zdmuser \\
  -targetnode tgthost -tgtauth zdmauth -tgtarg1 user:opc -rsp /home/zdm/physical_online.rsp -eval
zdmcli migrate database ... -rsp /home/zdm/physical_online.rsp -pauseafter ZDM_CONFIGURE_DG_SRC
zdmcli resume job -jobid 17`}
],src:[['Zero Downtime Migration','https://docs.oracle.com/en/database/oracle/zero-downtime-migration/']]};

L['ora-cloud:4:3']={blocks:[
{p:'**GoldenGate** and **AWS DMS** copy changes logically, so source and target can differ in version, platform and even product. The cut-over is a short pause for the last changes.'},
{t:[['Tool','Source to target','Where it runs','Good for'],['**OCI GoldenGate**','Oracle and many databases to OCI targets and Autonomous','Managed service on OCI','Migrations and ongoing replication'],['**GoldenGate (self-managed)**','Any supported source and target','Your hosts or cloud VMs','Full control, active-active, heterogeneous'],['**AWS DMS**','Oracle to RDS and Aurora (and others)','AWS replication instance','Moves into AWS database services'],['**OCI Database Migration**','Oracle sources to OCI targets','Managed OCI service','Orchestrated online and offline moves']]},
{flow:['Initial load of the target at a known SCN','Start capture and apply from that SCN','Wait until lag is near zero','Validate data','Pause writes and drain','Switch the application and keep reverse replication for fallback']},
{ul:['Make sure **supplemental logging**, keys and unsupported data types are checked first.','**Sequences** and DDL need an explicit plan.','Keep **reverse replication** until the new system has proven itself.']}
],src:[['Zero Downtime Migration','https://docs.oracle.com/en/database/oracle/zero-downtime-migration/'],['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm']]};

L['ora-cloud:4:4']={blocks:[
{p:'Cloud makes DR easier to build and easier to neglect. A standby in another Region is a few clicks, and a **tested** failover is the work that matters.'},
{t:[['Pattern','Protects from','Typical RPO','Typical RTO','How'],['Backups to object storage in another Region','Region loss (slow)','Minutes to hours','Hours','Cross-region backup copy and restore'],['**Data Guard** in another AD','Loss of an AD','Near zero','Minutes','Base Database association, Autonomous Data Guard local'],['**Data Guard cross-Region**','Regional outage','Seconds to minutes','Minutes','Standby in another Region'],['**Hybrid**: on-premises to cloud DR (or the reverse)','Site loss','Seconds to minutes','Minutes to hours','Data Guard across the VPN'],['**RDS** Multi-AZ plus cross-region replica','AZ and Region loss','Seconds to minutes','Minutes','Replica promotion']]},
{h:'A DR runbook has these parts'},
{ul:['**Decision:** who declares a disaster, with the criteria.','**Steps:** the exact commands to fail over, in order, with checks after each.','**Application:** DNS or connection change, configuration, dependent systems.','**Verification:** data and application checks.','**Fail back:** how to return and re-protect.','**Test record:** the date and the times of the last drill.']},
{note:'An untested standby is a hope. Schedule a **switchover drill** with the application twice a year and record the real recovery time.'}
],src:[['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm'],['Amazon RDS for Oracle','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Oracle.html']]};

L['ora-cloud:4:5']={blocks:[
{p:'Managed backups are convenient, but the **strategy** is still yours: how long to keep, where copies live, and who can delete them.'},
{t:[['Layer','Purpose','Notes'],['Automatic backups','Short-term recovery and PITR','Retention matched to the longest time to detect a problem'],['Manual backups before changes','A known restore point','Delete after the change is accepted'],['Long-term retention backups','Compliance and archive','Different retention and cost'],['Cross-region copies','Recovery after a regional loss','Encrypted, with a separate key if required'],['Protection from deletion','Stops accidental or malicious removal','IAM limits, retention locks, deletion protection'],['Logical exports','Object-level recovery','Data Pump for critical schemas']]},
{ul:['Define **RPO and RTO** per database and check the backup set meets them.','**Restrict who can delete** backups and databases. Use separate roles for backup administration.','**Test restores** to a new database regularly and keep the result.']}
],src:[['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm'],['Amazon RDS for Oracle','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Oracle.html']]};

L['ora-cloud:4:6']={blocks:[
{p:'Take one real or sample database (for example 2 TB, Oracle 19c, Linux, 99.9 percent availability, RPO 5 minutes) and complete the template.'},
{t:[['Item','Your answer'],['Source: size, version, platform, options used',''],['Target service and why',''],['Migration method and why',''],['Estimated transfer time (size / bandwidth)',''],['Downtime allowed and planned',''],['Rehearsal plan and success criteria',''],['Cut-over steps (with owners and times)',''],['Fallback: when, how and how long',''],['DR design: pattern, RPO and RTO, test date',''],['Backup retention and restore test schedule','']]},
{flow:['Assess','Choose','Rehearse','Cut over','Verify','Keep fallback','Decommission']},
{note:'A plan that cannot say **when you stop and go back** is not finished. Agree the fallback criteria before the cut-over window starts.'}
],src:[['Zero Downtime Migration','https://docs.oracle.com/en/database/oracle/zero-downtime-migration/']]};

})();
