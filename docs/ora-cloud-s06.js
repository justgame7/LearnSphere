/* LearnSphere - Oracle in the Cloud, Section 06: Security, Operations and Cost.
   Needs ora-common.js. Lesson keys ora-cloud:5:<lecture>. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const dg=O.dg;

L['ora-cloud:5:0']={blocks:[
{p:'Cloud security is layered, and each layer has an owner. The database security features you know still apply inside, and the cloud adds controls around them.'},
{t:[['Layer','Controls','Your task'],['**Identity (IAM)**','Policies, groups, MFA, federation','Least privilege for who may create, change, back up and delete databases'],['**Network**','Private subnets, NSGs, private endpoints, no public IP','Expose only what is needed, and only to known sources'],['**Encryption at rest**','TDE is on by default on managed services. Keys in a vault if you choose customer-managed keys.','Decide key ownership and rotation'],['**Encryption in transit**','TLS or native encryption','Require it, and manage certificates'],['**Database access**','Users, roles, privilege analysis, VPD, Data Redaction','The same design as on-premises'],['**Audit**','Unified audit, cloud audit logs','Collect centrally and review'],['**Assessment**','Data Safe, DBSAT','Run regularly, track findings']]},
{ul:['Create **separate administrators** for the cloud account, the database service and the database itself.','Keep **secrets** (passwords, wallets, tokens) in a vault, and rotate them.','Use a **bastion or private connectivity** for administration, not the public internet.']}
],src:[['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm']]};

L['ora-cloud:5:1']={blocks:[
{p:'Monitoring a cloud database combines **platform metrics** (CPU, storage, connections, backups) with **database diagnostics** you already know.'},
{t:[['Tool','What it shows','Where'],['**OCI Monitoring and alarms**','CPU, storage, sessions, backup status','OCI'],['**Database Management and Operations Insights**','Fleet performance, SQL, capacity trends','OCI'],['**Performance Hub**','Active sessions, waits, top SQL, ASH','OCI console'],['**CloudWatch and Enhanced Monitoring**','Instance and OS metrics','AWS'],['**Alert log and trace**','Errors and events','Console view, log export, `rdsadmin` views'],['**AWR and ASH**','Workload history and active sessions','Inside the database (licence rules apply)']]},
{t:[['Alarm on','Why'],['CPU and storage utilisation','Capacity before it fails'],['Backup failures and age of last backup','Recoverability'],['Standby lag or replica lag','RPO'],['Session and connection count','Pool or leak problems'],['Failed logins and privileged changes','Security']]},
{note:'The same problem-solving applies as on-premises: find the top wait or the top SQL first, then act. The cloud gives you fewer **OS tools** and more **metrics and APIs**.'}
],src:[['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm'],['Amazon RDS for Oracle','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Oracle.html']]};

L['ora-cloud:5:2']={blocks:[
{t:[['Service','How patching happens','Your control'],['Self-managed VM','You apply patches','Everything'],['Base Database','You apply patches from the console, CLI or `dbaascli`','When, and in-place or out-of-place'],['Exadata Database Service','Infrastructure by the provider on a schedule, VM cluster and databases by you','Windows and ordering'],['Autonomous Database','Automatic, with a maintenance schedule and early patching options on some deployments','Timing preference, test on a clone or early-patch tier'],['Amazon RDS for Oracle','Minor versions and maintenance by AWS in your window, major upgrades by you','Window, auto minor upgrade setting, timing of major']]},
{flow:['Read the patch notes','Clone or snapshot production','Patch the clone and test','Choose the window','Apply with a backup','Verify and record']},
{ul:['Keep **non-production** one release ahead of production to find problems early.','Use **clones or restored snapshots** to rehearse upgrades.','Track **end of support** dates for your database version on each service.']}
],src:[['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm']]};

L['ora-cloud:5:3']={blocks:[
{p:'Manual console work does not scale and cannot be reviewed. Infrastructure as code makes databases **repeatable, reviewable and recoverable**.'},
{t:[['Tool','Use'],['**Terraform** (OCI, AWS, Azure providers)','Declare databases, networks and policies, with state and plans'],['**OCI Resource Manager**','Terraform as a managed service on OCI'],['**AWS CloudFormation**','Declare RDS resources on AWS'],['**OCI CLI and AWS CLI**','Scripts and one-off operations'],['**Events and functions**','Respond to events, for example scale at a schedule or tag new resources'],['**Ansible**','Configure the database hosts and run SQL in a repeatable way']]},
{ul:['Keep **state** in a protected remote location, and **secrets** out of the code.','Use **pull requests and plan reviews** for production changes.','Protect critical databases with **deletion protection** and lifecycle rules.']}
],src:[['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm']]};

L['ora-cloud:5:4']={blocks:[
{t:[['Lever','Action'],['**Visibility**','Tag every database with owner, environment and application. Use cost reports by tag.'],['**Budgets and alerts**','Set a budget per compartment or account with alerts at thresholds'],['**Right-size**','Compare CPU and memory use with the shape every month and resize'],['**Scheduling**','Stop non-production at night where the service allows it'],['**Storage and backups**','Delete unused copies, tune retention, keep only needed long-term backups'],['**Licences**','Choose License Included or BYOL deliberately. Use Standard Edition where possible.'],['**Commitments**','Use annual credits or reserved instances for steady production'],['**Architecture**','Consolidate small databases as PDBs, or use Autonomous elasticity for spiky load']]},
{flow:['Tag','Budget','Measure','Right-size','Review monthly','Report to owners']},
{note:'The most common finding in a cost review is **idle or oversized** databases. A monthly review with owners finds them while they are small.'}
],src:[['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm']]};

L['ora-cloud:5:5']={blocks:[
{h:'Operating checklist'},
{t:[['Frequency','Task'],['Daily','Alarms, backup status, replica or standby lag, error spikes'],['Weekly','Capacity and growth, top SQL, security findings, pending maintenance'],['Monthly','Cost review, right-sizing, access review, patch plan'],['Quarterly','Restore test, switchover or failover drill, licence review'],['Yearly','DR exercise, architecture review, end-of-support check']]},
{h:'Capstone project'},
{ul:['Choose a service for a described application and justify it (licence, access, features, cost).','Create the database with network, encryption, backups and monitoring configured as code.','Load data with the service-appropriate method and run a workload.','Add DR (standby or replica) and perform a failover drill, recording times.','Migrate a second schema from another source with a rehearsed cut-over and a fallback.','Produce the responsibility table, the runbook and a monthly cost report.']},
{note:'Success criteria: restore verified, failover time known, costs tagged, access reviewed and no manual-only steps in the runbook.'}
],src:[['Oracle Cloud Infrastructure documentation','https://docs.oracle.com/en-us/iaas/Content/home.htm']]};

})();
