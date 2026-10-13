/* LearnSphere - Oracle in the Cloud, Section 04: Oracle Database on AWS, Azure and Google Cloud.
   Needs ora-common.js. Lesson keys ora-cloud:3:<lecture>. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const dg=O.dg;

L['ora-cloud:3:0']={blocks:[
{p:'Many organisations run applications in AWS, Azure or Google Cloud and want the Oracle database close to them. There are three families of option.'},
{t:[['Option','Operated by','Where the database runs','Access','Notes'],['**Managed service of the hyperscaler** (Amazon RDS for Oracle)','AWS','AWS','No OS, no SYSDBA','Standard features, AWS tooling and billing'],['**Oracle Database@Azure / @AWS / @Google Cloud**','Oracle (inside the hyperscaler data centre)','Exadata in the provider data centre, network-attached to your VNet or VPC','As OCI services','Exadata and Autonomous features near your applications'],['**Self-managed on IaaS**','You','A VM on the cloud','Full','Full control and full responsibility']]},
{flow:['Where is the application?','Do you need Exadata or Autonomous features?','Do you need OS or full control?','Which licences do you own?','Choose and check regional availability']},
{note:'Multicloud services are rolling out region by region. Always confirm availability, networking model and pricing with Oracle and the cloud provider before you plan around one.'}
],src:[['Amazon RDS for Oracle','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Oracle.html'],['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm']]};

L['ora-cloud:3:1']={blocks:[
{p:'**Amazon RDS for Oracle** is a managed database service on AWS. AWS installs and operates the OS and Oracle software, and you operate the database through SQL and the RDS API.'},
{svg:dg(700,210,[[10,10,680,190,'AWS Region',1],[30,45,150,55,'Application|VPC',0],[210,45,170,60,'RDS for Oracle|primary instance',2],[420,45,170,60,'Standby (Multi-AZ)|other AZ',0],[210,125,170,55,'EBS storage',0],[420,125,170,55,'Snapshots and|automated backups (S3)',0]],[[180,72,210,72],[380,75,420,75],[295,105,295,125],[505,105,505,125]])},
{t:[['Item','RDS for Oracle'],['Editions','Standard Edition Two and Enterprise Edition'],['Licence models','License Included (Standard Edition Two) or Bring Your Own License'],['Storage','EBS volumes (general purpose or provisioned IOPS), growable, with storage autoscaling'],['Availability','Multi-AZ deployments with automatic failover, and read replicas (Oracle Active Data Guard where licensed)'],['Access','No OS, no SYSDBA. Master user plus the `rdsadmin` package.'],['Options','Added through option groups, for example APEX, Enterprise Manager, S3 integration, SSL'],['Configuration','Parameter groups, with a restricted set of parameters']]},
{ul:['Versions and features supported change with each AWS release. Check the supported versions list when you design.','Many features (RAC, Data Guard as you configure it yourself, Exadata features) are **not** part of RDS for Oracle.']}
],src:[['Amazon RDS for Oracle','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Oracle.html']]};

L['ora-cloud:3:2']={blocks:[
{p:'Because you do not have SYSDBA, privileged operations are done through the **`rdsadmin`** packages, which wrap the operations in a controlled way.'},
{code:`-- kill a session (no ALTER SYSTEM KILL SESSION needed)
EXEC rdsadmin.rdsadmin_util.kill(sid => 123, serial => 4567);

-- grant select on a SYS object to a user
EXEC rdsadmin.rdsadmin_util.grant_sys_object('DBA_TABLES', 'APP_USER', 'SELECT');

-- flush caches in a controlled test
EXEC rdsadmin.rdsadmin_util.flush_shared_pool;
EXEC rdsadmin.rdsadmin_util.flush_buffer_cache;

-- add supplemental logging (for replication or DMS)
EXEC rdsadmin.rdsadmin_util.alter_supplemental_logging('ADD');

-- look at the alert log through a view
SELECT originating_timestamp, message_text FROM rdsadmin.rds_alert_log_view ORDER BY originating_timestamp DESC FETCH FIRST 20 ROWS ONLY;`},
{t:[['Mechanism','Purpose'],['**Parameter group**','Changeable database parameters, dynamic or static (needs reboot)'],['**Option group**','Optional features and integrations (APEX, S3 integration, SSL, Enterprise Manager, native network encryption)'],['**`rdsadmin` packages**','Privileged tasks: kill, grants, supplemental logging, directories, tablespace tasks'],['**Master user**','Highly privileged, but not SYSDBA'],['**Event and log export**','Alert log, listener log, audit and trace through the console, CloudWatch Logs']]},
{ul:['Create **tablespaces** and **users** with ordinary SQL as the master user.','Use **S3 integration** for Data Pump files and external tables instead of server paths.','Know the **restrictions**: no OS access, no custom binaries, some parameters locked, and `ALTER SYSTEM` limited.']}
],src:[['Common DBA tasks for Oracle on RDS','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Oracle.html']]};

L['ora-cloud:3:3']={blocks:[
{t:[['Feature','What it does','Notes'],['**Automated backups**','Daily snapshot plus archived logs, with a retention of up to 35 days','Point-in-time restore to a new instance'],['**Manual snapshots**','Kept until you delete them','Before releases and upgrades'],['**Multi-AZ**','A synchronous standby in another AZ with automatic failover','A short interruption on failover. The standby is not readable.'],['**Read replicas**','Asynchronous replicas using Oracle Data Guard, same or other Region','Read-only replicas need the Active Data Guard licence. Mounted replicas do not.'],['**Cross-region replicas and copies**','DR in another Region','Promote the replica in a disaster']]},
{code:`aws rds create-db-instance-read-replica --db-instance-identifier orcl-r1 --source-db-instance-identifier orcl-prod --replica-mode open-read-only
aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier orcl-prod --target-db-instance-identifier orcl-pitr --restore-time 2026-10-13T14:31:00Z
aws rds reboot-db-instance --db-instance-identifier orcl-prod --force-failover`},
{note:'A restore always creates a **new** instance. Plan the cut-over (or copy-back) as part of the recovery procedure, as with any managed service.'}
],src:[['Amazon RDS for Oracle','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Oracle.html']]};

L['ora-cloud:3:4']={blocks:[
{p:'**Oracle Database@Azure**, **Oracle Database@AWS** and **Oracle Database@Google Cloud** put Oracle-operated Exadata infrastructure inside the data centres of those providers, so applications in the hyperscaler have very low latency to the database.'},
{t:[['Aspect','How it works'],['**What runs**','Exadata Database Service and Autonomous Database, operated by Oracle'],['**Where**','Oracle-managed hardware in the hyperscaler data centre, inside its network'],['**Network**','Connected to your VNet or VPC through a delegated or dedicated subnet'],['**Provisioning**','From the hyperscaler portal or API (and through OCI for some control plane functions)'],['**Billing**','Typically through the hyperscaler marketplace with support from Oracle'],['**Operations**','As the underlying Oracle service: same tools, patching and features']]},
{ul:['Use it when the **applications are in a hyperscaler** and the database needs Exadata or Autonomous capabilities.','Confirm **regions, supported services, networking and support model** before design. Offerings and regional footprints change.','Skills carry over: Exadata, Autonomous and Data Guard knowledge apply directly.']}
],src:[['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm']]};

L['ora-cloud:3:5']={blocks:[
{p:'Some packaged applications need OS packages, agents or specific patch sets. In that case, a fully managed service is too restrictive.'},
{t:[['Option','Control','What the provider still does','What you take on'],['**RDS Custom for Oracle**','OS and database access within a support perimeter','Provisioning, backups and automation framework','Customisation, patching decisions inside the perimeter, staying supported'],['**Self-managed on EC2, Azure VM or Compute**','Full','Virtual machine and storage only','Everything: install, patching, backup, HA, monitoring, licences']]},
{ul:['With RDS Custom, **breaking the support perimeter** (for example changing the automation) can stop the service from managing the instance.','On a self-managed VM, the **HA design** is yours: Data Guard across zones, backup to object storage, and monitoring.','Count **licences** carefully. The counting rules differ by provider and instance type.']},
{note:'Prefer a managed option unless a requirement forces otherwise. Every responsibility you take adds an on-call duty.'}
],src:[['Amazon RDS for Oracle','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Oracle.html']]};

L['ora-cloud:3:6']={blocks:[
{flow:['Create option and parameter groups','Create the instance','Connect with SQL*Plus','Upload a dump file to S3','Download it to DATA_PUMP_DIR','Run the import','Check and clean up']},
{code:`-- download the dump file from S3 into the instance directory (S3_INTEGRATION option is needed)
SELECT rdsadmin.rdsadmin_s3_tasks.download_from_s3(
         p_bucket_name => 'my-dumps', p_s3_prefix => 'exp/', p_directory_name => 'DATA_PUMP_DIR') AS task_id FROM dual;

-- import the schema with the Data Pump API
DECLARE h NUMBER;
BEGIN
  h := DBMS_DATAPUMP.OPEN('IMPORT','SCHEMA',NULL,'IMP_APP');
  DBMS_DATAPUMP.ADD_FILE(h,'app.dmp','DATA_PUMP_DIR');
  DBMS_DATAPUMP.METADATA_FILTER(h,'SCHEMA_EXPR','IN (''APP'')');
  DBMS_DATAPUMP.START_JOB(h);
END;
/`},
{note:'Check the import log in `DATA_PUMP_DIR` with `rdsadmin.rds_file_util.read_text_file`, as you cannot open it from an OS shell.'}
],src:[['Importing data into Oracle on Amazon RDS','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Oracle.html']]};

})();
