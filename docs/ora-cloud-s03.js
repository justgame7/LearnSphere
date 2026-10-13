/* LearnSphere - Oracle in the Cloud, Section 03: Autonomous Database.
   Needs ora-common.js. Lesson keys ora-cloud:2:<lecture>. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const dg=O.dg;

L['ora-cloud:2:0']={blocks:[
{p:'**Autonomous Database** is Oracle Database running on Exadata infrastructure with automation for the work a DBA normally does by hand. Oracle describes the automation in three groups: **self-driving**, **self-securing** and **self-repairing**.'},
{t:[['Group','What is automated','What it replaces'],['**Self-driving**','Provisioning, memory and parallelism settings, optimizer statistics, automatic indexing, scaling of compute and storage','Tuning parameters, index design, capacity changes'],['**Self-securing**','Patching, encryption (always on), network access control, auditing defaults','Patch projects, TDE setup, hardening checklists'],['**Self-repairing**','Automatic backups, failover to a standby, recovery, node replacement','Backup jobs, HA build, runbooks']]},
{svg:dg(700,210,[[10,10,680,190,'Autonomous Database',1],[30,45,200,60,'Your schema, SQL, data|and applications',2],[250,45,200,60,'Automation|tuning, patching, backup',0],[470,45,200,60,'Oracle Database engine|multitenant PDB',0],[30,125,640,55,'Exadata infrastructure: smart storage, flash, RoCE network, managed by Oracle',0]],[[230,75,250,75],[450,75,470,75],[570,105,570,125]])},
{h:'What is still yours'},
{ul:['**Design:** schema, data types, constraints, partitioning where it helps, and how the application uses the database.','**SQL:** automatic indexing and statistics help, but a badly written query is still a bad query.','**Security design:** who has access, network exposure, data classification, key choices.','**Data lifecycle:** loading, archiving, retention and cost.','**Integration:** connection pooling, retry logic, wallet and certificate handling in applications.']},
{note:'Autonomous reduces **operational** work, not **design** work. A team that moves a poorly designed schema to Autonomous gets a faster, automatically managed poorly designed schema.'}
],src:[['Oracle Autonomous Database','https://docs.oracle.com/en/cloud/paas/autonomous-database/index.html']]};

L['ora-cloud:2:1']={blocks:[
{p:'An Autonomous Database is created for a **workload type** and on a **deployment type**. Both are decided at creation.'},
{t:[['Workload type','Tuned for','Typical use'],['**Transaction Processing (ATP)**','Many short transactions, mixed workload','OLTP applications, SaaS back ends'],['**Data Warehouse (ADW)**','Scans, aggregations, parallel queries, columnar caching','Analytics, reporting, data marts'],['**JSON Database (AJD)**','Document workloads with SODA and JSON collections','Document applications'],['**APEX Service**','Low-code application development','Internal apps and prototypes']]},
{t:[['Deployment','What it is','Fits'],['**Serverless**','Your database shares managed Exadata infrastructure. You choose compute and storage, not hardware.','Most workloads. Fast to create, fine-grained scaling.'],['**Dedicated Exadata infrastructure**','Autonomous Database on Exadata infrastructure reserved for you','Isolation and control over patch timing and consolidation']]},
{h:'Sizing units'},
{ul:['**Compute** is measured in **ECPUs** (Exadata-based compute units, replacing the older OCPU unit for new databases). You set a base count, and **auto scaling** can use up to about three times that.','**Storage** is chosen in TB and can grow online. It is billed for what is allocated.','**Always Free** Autonomous Databases (small, limited in size and capacity) are available for learning and small projects, with their own limits and idle rules.']},
{code:`# example: create a serverless Autonomous Transaction Processing database (placeholders)
oci db autonomous-database create \\
  --compartment-id ocid1.compartment.oc1..aaaa \\
  --db-name SALESATP --display-name sales-atp \\
  --db-workload OLTP --compute-model ECPU --compute-count 2 \\
  --data-storage-size-in-tbs 1 --admin-password '********' \\
  --is-auto-scaling-enabled true --license-model LICENSE_INCLUDED`}
],src:[['Oracle Autonomous Database','https://docs.oracle.com/en/cloud/paas/autonomous-database/index.html']]};

L['ora-cloud:2:2']={blocks:[
{p:'An Autonomous Database has no OS login. Clients connect to **database services** over an encrypted network connection. How you authenticate and what network path you allow are your decisions.'},
{t:[['Option','How it works','Notes'],['**mTLS with a wallet**','Download a wallet (client certificate and `tnsnames.ora`). The client and server authenticate each other.','Default. Protect the wallet file and its password.'],['**TLS without a wallet**','The server certificate is trusted by the client. Needs an access control list or a private endpoint.','Simpler for tools and apps that cannot use a wallet'],['**Private endpoint**','The database gets a private address in your VCN','No public internet path. Use with a VPN or bastion.'],['**Access control list**','Allow only listed IP addresses or VCNs on a public endpoint','Set before you distribute connection details']]},
{t:[['Service name','Typical use'],['`<name>_high`','Highest priority and parallelism, for important reports'],['`<name>_medium`','Default for most workloads'],['`<name>_low`','Least resources, for batch or background'],['`<name>_tp`, `<name>_tpurgent`','Transaction Processing services, the urgent one has the highest priority']]},
{code:`# unpack the wallet and connect with SQLcl or SQL*Plus
unzip Wallet_SALESATP.zip -d /opt/wallet/salesatp
export TNS_ADMIN=/opt/wallet/salesatp
sqlplus admin@salesatp_tp

SQL> SELECT sys_context('USERENV','SERVICE_NAME') FROM dual;
SQL> SELECT * FROM v$pdbs;`},
{ul:['**Never** share one wallet and one password across all applications. Create an application user with its own credentials.','Applications need a **connection pool** and retry logic, because planned maintenance or scaling can reset connections briefly.','For a public endpoint set the **ACL first**.']}
],src:[['Connecting to Autonomous Database','https://docs.oracle.com/en/cloud/paas/autonomous-database/index.html']]};

L['ora-cloud:2:3']={blocks:[
{p:'An Autonomous Database cannot read files from a server disk. Data comes from **object storage** (and from database links and applications). The **`DBMS_CLOUD`** package is the standard way.'},
{flow:['Put files in an Object Storage bucket','Create a credential for access','COPY_DATA into a table, or CREATE_EXTERNAL_TABLE','Check the load log views','Validate counts and data']},
{code:`-- 1. credential (auth token or resource principal)
BEGIN
  DBMS_CLOUD.CREATE_CREDENTIAL(credential_name => 'OBJ_CRED', username => 'user@example.com', password => '<auth-token>');
END;
/

-- 2. load a CSV file from a bucket into an existing table
BEGIN
  DBMS_CLOUD.COPY_DATA(
    table_name      => 'SALES',
    credential_name => 'OBJ_CRED',
    file_uri_list   => 'https://objectstorage.eu-frankfurt-1.oraclecloud.com/n/mytenancy/b/loads/o/sales.csv',
    format          => JSON_OBJECT('type' value 'csv', 'skipheaders' value '1'));
END;
/

-- 3. check what happened
SELECT table_name, status, rows_loaded, logfile_table, badfile_table FROM user_load_operations ORDER BY start_time DESC;`},
{t:[['Task','Tool'],['Load files into a table','`DBMS_CLOUD.COPY_DATA`'],['Query files without loading','`DBMS_CLOUD.CREATE_EXTERNAL_TABLE`'],['Export query results to a bucket','`DBMS_CLOUD.EXPORT_DATA`'],['Import a schema','Data Pump `impdp` with a credential and an Object Storage URI'],['Copy from another database','Database link to an accessible source']]}
],src:[['Loading data into Autonomous Database','https://docs.oracle.com/en/cloud/paas/autonomous-database/index.html']]};

L['ora-cloud:2:4']={blocks:[
{p:'Scaling and performance control on Autonomous is mostly **a few settings**, not a set of parameters. You decide how much compute is allowed and which services get which share.'},
{t:[['Control','What it does','Notes'],['**Manual scaling**','Change the ECPU count and storage at any time, online','Billed from the change'],['**Auto scaling**','Allows the database to use up to about three times the base compute when load rises','Billed for what is used above the base'],['**Consumer groups**','Services (HIGH, MEDIUM, LOW, TP, TPURGENT) map to resource-manager groups with different shares and parallelism','Choose the right service name per application'],['**Automatic indexing**','Creates and drops indexes based on workload','Review with `DBA_AUTO_INDEX_*` views'],['**Result cache, in-memory** (where available)','Speeds repeated queries and scans','Built into the service']]},
{ul:['Send **interactive and dashboard** queries to a higher-priority service and **batch** to a lower one. Everything on HIGH leads to queuing.','Use **Performance Hub** and Database Actions to see active sessions, waits and top SQL. The same SQL tuning skills apply.','**Idle databases** can be stopped to save compute cost (storage is still billed).']},
{code:`# scale compute and storage from the CLI
oci db autonomous-database update --autonomous-database-id <ocid> --compute-count 4 --data-storage-size-in-tbs 2`}
],src:[['Scaling Autonomous Database','https://docs.oracle.com/en/cloud/paas/autonomous-database/index.html']]};

L['ora-cloud:2:5']={blocks:[
{p:'Protection and copies are services of the platform: backups run without you scheduling them, clones are made by a request, and standbys are enabled by a switch.'},
{t:[['Capability','What you get','Notes'],['**Automatic backups**','Daily backups to Object Storage with a retention of about 60 days','Restore to a point in time within the window'],['**Manual and long-term backups**','On-demand backups kept longer','For major changes and compliance'],['**Full clone**','A complete independent copy','Test, development'],['**Metadata clone**','Structure only, without data','Empty environments'],['**Refreshable clone**','A read-only clone refreshed from the source on a schedule','Reporting and reduced-load analytics'],['**Autonomous Data Guard (local)**','A standby in another AD of the same Region','Fast automatic failover'],['**Autonomous Data Guard (cross-region)**','A standby in another Region','Regional disaster recovery']]},
{code:`# clone a database (full clone) and restore to a time
oci db autonomous-database create-from-clone --compartment-id <ocid> --source-id <source-ocid> \\
  --clone-type FULL --db-name TESTATP --admin-password '********' --compute-model ECPU --compute-count 2 --data-storage-size-in-tbs 1
oci db autonomous-database restore --autonomous-database-id <ocid> --timestamp "2026-10-13T14:31:00.000Z"`},
{note:'A **restore** returns the same database to an earlier time, so it is disruptive. For a safe test of recovery use a **clone** at that time. A standby does not replace backups, because it replicates mistakes too.'}
],src:[['Backups and clones on Autonomous Database','https://docs.oracle.com/en/cloud/paas/autonomous-database/index.html']]};

L['ora-cloud:2:6']={blocks:[
{p:'Autonomous removes access to protect the automation and the other tenants. Knowing the restrictions before migration avoids late surprises.'},
{t:[['On a self-managed database you...','On Autonomous'],['Log in to the OS, use SYSDBA','No OS access. Use `ADMIN` and Database Actions. No SYSDBA.'],['Create tablespaces and datafiles','Not needed. Storage is managed. Objects go in the default tablespace.'],['Tune `init.ora` parameters','Most parameters are fixed. A small list is changeable with `ALTER SYSTEM`.'],['Read and write files with UTL_FILE','Use `DBMS_CLOUD` and Object Storage'],['Use RMAN, Data Pump with the server directory','Backups are automatic. Data Pump uses object storage.'],['Install your own agents or tools on the host','Not possible. Use client-side tools and the cloud monitoring services.'],['Patch when you decide','Patching is automatic, with a maintenance schedule you can influence'],['Use database links freely','Allowed within network and security limits. Check supported targets.'],['Run any option or feature','Included features are available. Some unsupported or restricted ones are blocked.']]},
{ul:['Run the **Autonomous compatibility check** or Cloud Premigration Advisor tool against your source schema before migrating.','Test application behaviour on a **clone**: restricted privileges show up as ORA-01031 or ORA-65xxx errors.','Build your runbook for the tasks that still exist: users, quotas, load jobs, scaling, clones.']}
],src:[['Autonomous Database restrictions','https://docs.oracle.com/en/cloud/paas/autonomous-database/index.html']]};

L['ora-cloud:2:7']={blocks:[
{p:'Use an Always Free database or the smallest paid size in a lab compartment.'},
{flow:['Create the database','Download the wallet','Connect as ADMIN','Create an application user','Create a credential and load a CSV','Query and check load results','Stop or delete it']},
{code:`-- as ADMIN
CREATE USER app_user IDENTIFIED BY "Str0ng#Passw0rd";
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW TO app_user;
ALTER USER app_user QUOTA 5G ON DATA;
GRANT EXECUTE ON DBMS_CLOUD TO app_user;

-- as APP_USER after creating the credential
CREATE TABLE sales (sale_id NUMBER, sale_date DATE, amount NUMBER(10,2));
BEGIN DBMS_CLOUD.COPY_DATA(table_name => 'SALES', credential_name => 'OBJ_CRED',
  file_uri_list => '<object-url>', format => JSON_OBJECT('type' value 'csv', 'skipheaders' value '1')); END;
/
SELECT COUNT(*) FROM sales;`},
{note:'Never use `ADMIN` for the application. Create a separate schema user and grant only what is needed.'}
],src:[['Oracle Autonomous Database','https://docs.oracle.com/en/cloud/paas/autonomous-database/index.html']]};

L['ora-cloud:2:8']={blocks:[
{t:[['Task','How','Impact'],['Stop and start','Console or `oci db autonomous-database stop` and `start`','Compute billing stops while stopped'],['Scale compute or storage','Console or `update` with `--compute-count`','Online'],['Rotate the admin password','Console or `update --admin-password`','None for connected sessions'],['Rotate a wallet','Download a new wallet, redistribute','Clients need the new wallet'],['Refresh a clone','Refreshable clone refresh','Read-only during refresh'],['View performance','Performance Hub, Database Actions, `V$` views','None'],['Check auto indexing','`DBA_AUTO_INDEX_CONFIG`, `DBA_AUTO_INDEX_EXECUTIONS`','None'],['Review maintenance','Console maintenance section','Schedule awareness']]},
{ul:['Create alarms on **CPU utilisation, storage and sessions** in OCI Monitoring.','Keep an inventory of **wallet owners** and rotate on a schedule.','Treat `ADMIN` like a root account: limited use, audited.']}
],src:[['Oracle Autonomous Database','https://docs.oracle.com/en/cloud/paas/autonomous-database/index.html']]};

})();
