/* LearnSphere - Security quiz, Section 01: Security Foundations & Threat Model.
   window.QUIZZES['ora-sec:0']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-sec:0']={qs:[
{q:'What is **defense in depth**?',o:['Several layers of controls','One strong firewall','Only encryption','Only passwords'],a:0,why:'One failure must not expose data.',lec:0},
{q:'Which control answers **who did what**?',o:['Auditing','TDE','Redaction','Profiles'],a:0,why:'Unified Auditing.',lec:0},
{q:'Which protects a **stolen disk**?',o:['TDE','Redaction','VPD','Auditing'],a:0,why:'Data at rest.',lec:0},
{q:'Where should you start?',o:['Patching, least privilege, auth, auditing','Exotic features','Only encryption','Only firewalls'],a:0,why:'Boring controls stop most attacks.',lec:0},
{q:'Which are in a **threat model**?',o:['Assets','Threats','Controls','Risk ranking'],a:[0,1,2,3],why:'All parts.',lec:1},
{q:'Which control helps with **SQL injection**?',o:['Bind variables and least-privilege account','Bigger SGA','More CPUs','Compression'],a:0,why:'Application-level fix.',lec:1},
{q:'Which stops a **DBA** from reading business data?',o:['Database Vault','A profile','An index','A view'],a:0,why:'Separation of duties.',lec:1},
{q:'Most breaches use:',o:['Credentials or known flaws','Clever zero days','Hardware','Satellites'],a:0,why:'Basics first.',lec:1},
{q:'What does **least privilege** mean?',o:['Only what the account needs','All privileges','No privileges','Admin by default'],a:0,why:'Reduce blast radius.',lec:2},
{q:'Which privilege is for **TDE key management**?',o:['SYSKM','SYSBACKUP','SYSDG','SYSOPER'],a:0,why:'Separate key admin.',lec:2},
{q:'Should humans share **SYS**?',o:['No, named accounts','Yes','Only DBAs','Only at night'],a:0,why:'Accountability.',lec:2},
{q:'Which privilege is for **Data Guard** operations?',o:['SYSDG','SYSKM','SYSRAC','SYSBACKUP'],a:0,why:'Least privilege.',lec:2},
{q:'What is the **CIS Benchmark**?',o:['A configuration hardening checklist','A backup tool','A license','A protocol'],a:0,why:'Practical guidance.',lec:3},
{q:'Which standard is for **payment card** data?',o:['PCI DSS','HIPAA','SOX','STIG'],a:0,why:'Encryption, auditing, access.',lec:3},
{q:'How do you use a standard?',o:['Map requirements to technical controls','Print it','Ignore it','Only read it'],a:0,why:'Then check and keep evidence.',lec:3},
{q:'Which tool **automates** checks?',o:['DBSAT','RMAN','OPatch','TKPROF'],a:0,why:'Security assessment.',lec:3},
{q:'TDE and Data Redaction need:',o:['Advanced Security option','Nothing','RAC','Exadata only'],a:0,why:'Licensed option.',lec:4},
{q:'Is **Database Vault** an option?',o:['Yes, licensed','No, free','Only in 11g','Only cloud'],a:0,why:'Check the licensing guide.',lec:4},
{q:'Where should you **confirm** licensing?',o:['Licensing Information User Manual','Alert log','Trace files','V$SESSION'],a:0,why:'Release specific.',lec:4},
{q:'Who manages **users and roles** in an Autonomous Database?',o:['You','Only the provider','Nobody','The OS'],a:0,why:'Shared responsibility.',lec:5},
{q:'Who patches the **OS** in IaaS?',o:['You','Provider','Nobody','Oracle only'],a:0,why:'Your VM.',lec:5},
{q:'What does a customer-managed key give?',o:['Control of keys','Faster queries','Smaller backups','No audit'],a:0,why:'Under your control.',lec:5},
{q:'In the DBSAT practical, how should you treat the report?',o:['As a to-do list','As a grade','As a license','Ignore it'],a:0,why:'Fix High first.',lec:6},
{q:'Which DBSAT step **collects** data?',o:['dbsat collect','dbsat drop','dbsat start','dbsat install'],a:0,why:'Then report.',lec:6},
{q:'Which risk level do you fix **first**?',o:['High','Low','Advisory','Evaluate'],a:0,why:'Highest risk.',lec:6}
]};
