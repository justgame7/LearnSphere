/* LearnSphere - Security, Section 01: Security Foundations & Threat Model.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const SG=O.D+'dbseg/';

/* ---------- diagrams ---------- */
const did=O.dg(700,250,[
[10,10,680,230,'Defense in depth',1],
[40,45,620,40,'Network and perimeter: firewalls, TLS, listener hardening',0],
[40,95,620,40,'Host: OS hardening, file permissions, patching',0],
[40,145,620,40,'Database: authentication, authorization, auditing, encryption',2],
[40,195,620,35,'Data: redaction, masking, VPD, Database Vault',0]],[]);

const threat=O.dg(700,190,[
[10,50,140,80,'Outside attacker|stolen credentials,|SQL injection',0],
[190,50,140,80,'Insider|over-privileged|admin or developer',0],
[370,50,140,80,'Application|vulnerable code,|shared accounts',0],
[550,50,140,80,'Platform|unpatched OS,|exposed backups',0]],[]);

/* ---------- 0: Defense in depth ---------- */
L['ora-sec:0:0']={blocks:[
{p:'No single control is enough. Oracle security is built in **layers**, so a failure in one layer does not expose the data.'},
{svg:did},
{t:[['Layer','Oracle features','Question it answers'],
['**Who connects**','Authentication, profiles, directory services','Is this really that user?'],
['**What they can do**','Roles, privileges, privilege analysis','Do they have only what they need?'],
['**What they did**','Unified Auditing','Can we prove what happened?'],
['**Data in motion**','Native encryption, TLS','Can someone read it on the wire?'],
['**Data at rest**','TDE, backup encryption','Is a stolen disk useless?'],
['**Data in use**','Redaction, VPD, Database Vault, masking','Who sees which values?']]},
{note:'Start with the **boring** controls: patching, least privilege, strong authentication, and auditing. They stop most real attacks.'}],
src:[['Database Security Guide',SG]]};

/* ---------- 1: Threat model ---------- */
L['ora-sec:0:1']={blocks:[
{p:'Before choosing controls, list **who might attack** and **how**. A short threat model drives priorities.'},
{svg:threat},
{t:[['Threat','Example','Main controls'],
['**Stolen credentials**','Password reuse, phishing','MFA or directory authentication, strong profiles, auditing'],
['**SQL injection**','Application builds SQL from input','Bind variables, SQL Firewall, least-privilege application account'],
['**Privileged abuse**','A DBA reads salary data','Database Vault, auditing, separation of duties'],
['**Data theft from files**','Stolen backup or datafile','TDE, encrypted backups'],
['**Network sniffing**','Data on the wire','TLS or native encryption'],
['**Unpatched flaw**','Known CVE exploited','Regular patching'],
['**Misconfiguration**','Default accounts, open listener','Hardening checklist, DBSAT']]},
{flow:['List assets (what is valuable)','List threats against each','Choose controls and rank by risk','Implement, test and audit']},
{note:'Most breaches use credentials or known flaws. They do not use clever Oracle attacks. Get the basics right first.'}],
src:[['Security planning',SG]]};

/* ---------- 2: Least privilege ---------- */
L['ora-sec:0:2']={blocks:[
{p:'**Least privilege**: give each account only what it needs. **Separation of duties**: no single person can do everything.'},
{t:[['Principle','Practice'],
['**Named accounts**','Every human has an own account. No shared `SYS` or `SYSTEM`.'],
['**Application accounts**','Own schema holds objects. The connecting account has only DML on needed objects, or runs through roles.'],
['**Admin privileges**','Use `SYSBACKUP`, `SYSDG`, `SYSKM` instead of `SYSDBA` where possible'],
['**Separate roles**','Security admin, DBA, auditor and application owner are different people'],
['**No `ANY` privileges**','Avoid `SELECT ANY TABLE` and similar'],
['**Review**','Regularly list who has what and remove the unused']]},
{h:'Administrative privileges'},
{t:[['Privilege','For'],
['`SYSDBA`','Full administration'],
['`SYSOPER`','Start, stop, backup'],
['`SYSBACKUP`','Backup and recovery'],
['`SYSDG`','Data Guard operations'],
['`SYSKM`','Key management (TDE)'],
['`SYSRAC`','RAC and Clusterware operations']]},
{note:'The goal is that a stolen application password can read or change **only that application\'s** data.'}],
src:[['Administrative privileges',SG]]};

/* ---------- 3: Standards ---------- */
L['ora-sec:0:3']={blocks:[
{p:'Security is usually driven by **standards** and **regulations**. Use them as checklists.'},
{t:[['Standard','What it is','Use'],
['**CIS Benchmark for Oracle Database**','Community configuration checklist','Practical hardening'],
['**DISA STIG**','US Department of Defense configuration rules','Required in defense and government'],
['**PCI DSS**','Payment card data','Encryption, auditing, access control'],
['**GDPR, HIPAA, SOX**','Privacy, health, financial reporting','Who accessed personal data, retention, breach duties'],
['**ISO 27001, SOC 2**','Management and audit frameworks','Evidence of controls']]},
{h:'How a DBA uses them'},
{ul:['Map each rule to a **technical control** (parameter, audit policy, encryption).','Automate checks with **DBSAT** or a scanner.','Keep evidence: reports, change records.']},
{flow:['Pick the standard that applies','Map each requirement to a setting','Check the database against it','Fix gaps, accept documented exceptions','Re-check regularly']},
{note:'A standard tells you **what** to protect. It does not tell you the Oracle command. That is your job, with the Security Guide.'}],
src:[['CIS Benchmarks','https://www.cisecurity.org/benchmark/oracle_database'],['Database Security Guide',SG]]};

/* ---------- 4: Options and licensing ---------- */
L['ora-sec:0:4']={blocks:[
{p:'Many strong security features are **separately licensed**. Know what is included.'},
{t:[['Feature','License','Notes'],
['**Unified Auditing**','Included','Basic'],
['**Strong authentication** (Kerberos, TLS, RADIUS)','Included (since 19c, with Advanced Security options noted in the licensing guide)','Check the guide for your release'],
['**Transparent Data Encryption (TDE)**','**Advanced Security** option','Also Data Redaction'],
['**Data Redaction**','**Advanced Security** option',''],
['**Database Vault**','Option','Realms and command rules'],
['**Label Security**','Option','Row labels'],
['**Data Masking and Subsetting**','Option (Enterprise Manager)','For non-production'],
['**Virtual Private Database**','Enterprise Edition','Fine-grained access'],
['**SQL Firewall**','Check the 26ai licensing guide','New'],
['**Oracle Data Safe**','Cloud service, included for some Oracle databases','Assessment and auditing service']]},
{note:'Always confirm against the **Licensing Information User Manual** for your release. Rules change between releases, and cloud services may include options on premises does not.'}],
src:[['Licensing Information User Manual',O.LIC],['26ai licensing',O.D26]]};

/* ---------- 5: Shared responsibility ---------- */
L['ora-sec:0:5']={blocks:[
{p:'In the cloud, security is **shared**. The provider secures the platform. You secure your data, access and configuration.'},
{t:[['Area','On premises','IaaS (your VM)','Autonomous / managed DB'],
['**Physical and network**','You','Provider','Provider'],
['**OS and patching**','You','You','Provider'],
['**Database patching**','You','You','Provider (you schedule)'],
['**Users, roles, privileges**','You','You','**You**'],
['**Encryption keys**','You','You','Provider or **you** (customer-managed keys)'],
['**Network exposure**','You','You','**You** (private endpoints, ACLs)'],
['**Data classification, auditing**','You','You','**You**']]},
{h:'Hybrid'},
{ul:['Keep keys and identity under your control when possible.','Use the same standards on and off premises.','Check where data is stored and who the provider\'s staff can be.']},
{note:'"The cloud is secure" is half true. Your configuration of users, networks and keys is still your responsibility.'}],
src:[['Shared responsibility','https://docs.oracle.com/en-us/iaas/Content/Security/Concepts/security_overview.htm']]};

/* ---------- 6: DBSAT practical ---------- */
L['ora-sec:0:6']={blocks:[
{p:'**Assess a database with DBSAT**, the Oracle Database Security Assessment Tool. It collects configuration data and reports **findings** ranked by risk.'},
{code:`# collect (run as a user with the needed privileges)
./dbsat collect system@pdb1 /tmp/pdb1_data

# report: HTML, text, Excel
./dbsat report /tmp/pdb1_data

# discover sensitive data
./dbsat discover -c dbsat.config /tmp/pdb1_sensitive`},
{t:[['Report section','Content'],
['**Summary**','Counts of findings by risk: High, Medium, Low, Advisory, Evaluate'],
['**User accounts**','Privileged users, default or locked accounts, password profiles'],
['**Privileges and roles**','Dangerous grants (`ANY`, `PUBLIC`)'],
['**Authorization control**','Roles and application controls'],
['**Fine-grained access**','VPD, redaction, label security'],
['**Auditing**','Policies and trail'],
['**Encryption**','TDE and network encryption'],
['**Database configuration**','Parameters, files, listener']]},
{h:'Check your result'},
{ul:['You have an HTML report with a list of High findings.','For each High finding, you can name a fix and the owner.','You made a priority list: top five actions.']},
{note:'Treat the report as a **to-do list**, not a grade. Fix the High findings first and repeat the scan to show progress.'}],
src:[['DBSAT','https://docs.oracle.com/en/database/oracle/oracle-database/19/dbsat/index.html']]};

})();
