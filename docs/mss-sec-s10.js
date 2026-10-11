/* LearnSphere - SQL Server Security & Compliance, Section 10: Compliance & Capstone.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const map=M.dg(700,200,[
[10,20,200,70,'Requirement|protect personal data,|restrict access, log use',0],[250,20,200,70,'Control|TDE, TLS, roles,|audit, masking',2],[490,20,200,70,'Evidence|query output,|settings, reports',0],
[10,115,680,70,'Auditors ask for evidence. A control without evidence is invisible, so save proof as you go.',0]],
[[210,55,250,55],[450,55,490,55]]);

const sod=M.dg(700,170,[
[10,20,200,70,'DBA|runs the server|cannot read business data|where required',0],[250,20,200,70,'Security officer|manages audit|and access reviews',2],[490,20,200,70,'Developer|no production|admin rights',0],
[10,110,680,45,'No one person can change data, remove the audit trail and approve their own access',0]],
[]);

const chk=M.dg(700,160,[
[10,25,120,70,'Identity|auth, MFA,|accounts',0],[145,25,120,70,'Access|roles, least|privilege',0],[280,25,120,70,'Data|encrypt, mask',0],[415,25,120,70,'Audit|log, review',2],[550,25,140,70,'Operate|patch, backup,|test',2]],
[]);

const cap=M.dg(700,150,[
[10,25,150,70,'1. Baseline|scan and list|findings',0],[190,25,150,70,'2. Fix|top risks|with scripts',2],[370,25,150,70,'3. Prove|run checks and|capture output',2],[550,25,140,70,'4. Report|findings, fixes,|residual risk',0]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

/* ---------- 0: Mapping to standards ---------- */
L['mss-sec:9:0']={blocks:[
{p:'Regulations such as **GDPR** and **PCI DSS** do not tell you which SQL Server setting to change. They set **requirements**. Your job is to map each to **controls** and **evidence**.'},
{svg:map},
{t:[['Requirement area','Typical SQL Server controls'],
['**Protect stored personal or card data**','TDE, Always Encrypted, backup encryption, key management'],
['**Protect data in transit**','TLS with trusted certificates, force encryption'],
['**Restrict access to need to know**','Roles, least privilege, RLS, column permissions'],
['**Identify and authenticate users**','Windows or Entra authentication, MFA, password policy'],
['**Log and monitor access**','SQL Server Audit, review and alerting'],
['**Keep systems patched and configured securely**','Patch process, vulnerability assessment, hardening checklist'],
['**Data minimization and erasure**','Retention, purge jobs, masking in non-production']]},
{note:'This is a technical overview, not legal advice. Standards and their versions change, so always work from the current text and with your compliance team.'}],
src:[['Security and compliance for SQL Server',M.RD+'security/security-center-for-sql-server-database-engine-and-azure-sql-database'],['Microsoft compliance offerings','https://learn.microsoft.com/en-us/compliance/regulatory/offering-home']]};

/* ---------- 1: Separation of duties ---------- */
L['mss-sec:9:1']={blocks:[
{p:'**Separation of duties** means no single person controls a whole sensitive process. It limits fraud and mistakes, and auditors look for it.'},
{svg:sod},
{h:'How it looks in SQL Server'},
{t:[['Duty','Example control'],
['**Administer the server**','sysadmin limited to a few named DBAs, with MFA'],
['**Manage access**','securityadmin or a separate identity team, with approval workflow'],
['**Manage audit**','Audit owned by security, DBAs cannot change or delete files'],
['**Change code**','Deployments through a pipeline, developers have no production admin'],
['**Read sensitive data**','Granted by data owner, not by the DBA alone']]},
{ul:['Use **separate accounts** for admin and daily work.','Use **just-in-time** elevation where possible, with logging.','Make the **audit target** out of reach of the people being audited.']},
{note:'Small teams cannot always separate every duty. Document compensating controls, such as extra review and logging.'}],
src:[['Security best practices checklist',M.RD+'security/sql-server-security-best-practices'],['Permissions hierarchy',M.RD+'security/permissions-hierarchy-database-engine']]};

/* ---------- 2: Review checklist ---------- */
L['mss-sec:9:2']={blocks:[
{p:'A **security review checklist** turns the course into a repeatable test you can run on any instance.'},
{svg:chk},
{t:[['Area','Check','Query or place'],
['**Authentication**','Windows or Entra preferred; sa disabled','`SERVERPROPERTY(\'IsIntegratedSecurityOnly\')`'],
['**Access**','sysadmin and db_owner lists are short and approved','`sys.server_role_members`'],
['**Permissions**','Apps use roles, no direct grants to people','`sys.database_permissions`'],
['**Transit**','Trusted certificate, force encryption','`sys.dm_exec_connections.encrypt_option`'],
['**At rest**','TDE or column encryption where required, keys backed up','`sys.dm_database_encryption_keys`'],
['**Audit**','Audit on, targets protected, reviews done','`sys.dm_server_audit_status`'],
['**Surface**','Unused features off, TRUSTWORTHY reviewed','`sys.configurations`, `sys.databases`'],
['**Patching**','Supported version, recent CU','`SERVERPROPERTY`'],
['**Backups**','Encrypted, restricted, tested','Backup jobs and restore tests']]},
{note:'Save the output of each check with a date. Over time this shows trend and gives auditors the evidence they ask for.'}],
src:[['Security best practices checklist',M.RD+'security/sql-server-security-best-practices'],['Securing SQL Server',M.RD+'security/securing-sql-server']]};

/* ---------- 3: Capstone ---------- */
L['mss-sec:9:3']={blocks:[
{p:'**Capstone.** Harden a lab instance and **prove** each control with evidence.'},
{svg:cap},
{h:'Tasks'},
{t:[['#','Task','Evidence'],
['1','Run a **Vulnerability Assessment** on the sample database and record the baseline','Scan report'],
['2','Set Windows-only authentication or disable and rename **sa**','`sys.server_principals`'],
['3','Create roles for **app**, **reporting** and **monitoring**, remove direct grants','`sys.database_permissions`'],
['4','Install a certificate and **force encryption**; test a client with Encrypt=True','`encrypt_option`'],
['5','Enable **TDE** on the database and **back up the certificate**; restore on a second instance','`sys.dm_database_encryption_keys`'],
['6','Add **RLS** or column permissions for a sensitive table','Test user results'],
['7','Create an **audit** for logins, role changes and sensitive-table reads','Audit file output'],
['8','Fix **SQL injection** in a sample procedure with sp_executesql','Before and after test'],
['9','Disable unused **features** and set TRUSTWORTHY off','`sys.configurations`'],
['10','Write a **one-page report**: findings, fixes, residual risk','Document']]},
{h:'Done when'},
{ul:['Each control has a **query or screenshot** as proof.','A restore of the encrypted database on another server **worked**.','The report names **owners** and **dates** for open risks.']},
{note:'Next: High Availability and DR, where encryption, auditing and access controls must also work on every replica.'}],
src:[['Security best practices checklist',M.RD+'security/sql-server-security-best-practices'],['SQL Vulnerability Assessment',M.RD+'security/sql-vulnerability-assessment']]};

})();
