/* LearnSphere - SQL Server Security & Compliance, Section 01: Security Foundations.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const depth=M.dg(700,250,[
[10,10,680,230,'Defense in depth: no single control is enough',1],
[40,45,180,40,'Network: firewall, TLS',0],[260,45,180,40,'Host: OS patches, accounts',0],[480,45,180,40,'Instance: logins, roles',2],
[40,100,180,40,'Database: users, schemas',2],[260,100,180,40,'Data: TDE, Always Encrypted',2],[480,100,180,40,'Application: no SQL injection',0],
[40,155,180,40,'Audit: who did what',0],[260,155,180,40,'Backups: encrypted, protected',0],[480,155,180,40,'People: process, separation',0],
[40,205,620,26,'Assume one layer will fail and make sure the next one holds',0]],
[]);

const threat=M.dg(700,200,[
[10,20,160,60,'Stolen or weak|credentials',2],[190,20,160,60,'Over-privileged|accounts',2],[370,20,160,60,'SQL injection|in applications',2],[550,20,140,60,'Stolen backups|and files',0],
[10,110,160,60,'Misconfiguration|open features',0],[190,110,160,60,'Insider misuse',0],[370,110,160,60,'Unpatched|server',0],[550,110,140,60,'Ransomware',0]],
[]);

const prin=M.dg(700,220,[
[10,10,680,200,'Three levels of principals',1],
[30,45,190,55,'Windows level|domain user, group',0],[255,45,190,55,'SQL Server level|login, server role',2],[480,45,190,55,'Database level|user, database role',2],
[30,120,640,40,'A login maps to a user in each database. Roles bundle permissions for many users.',0],
[30,170,640,30,'Authentication: who are you (login). Authorization: what may you do (user + permissions).',0]],
[[220,72,255,72],[445,72,480,72]]);

const sec=M.dg(700,200,[
[10,15,680,170,'Securable scopes, large to small',1],
[30,55,130,50,'Server|logins, endpoints',0],[180,55,130,50,'Database',2],[330,55,130,50,'Schema',2],[480,55,190,50,'Object|table, view, procedure',2],
[30,125,640,50,'A permission granted on a larger scope flows down. DENY always beats GRANT.',0]],
[[160,80,180,80],[310,80,330,80],[460,80,480,80]]);

/* ---------- 0: Defense in depth ---------- */
L['mss-sec:0:0']={blocks:[
{p:'No single setting makes SQL Server secure. **Defense in depth** means many layers, so that an attacker who passes one still meets the next.'},
{svg:depth},
{h:'The layers and who owns them'},
{t:[['Layer','Examples','Usually owned by'],
['**Network**','Firewall, private network, TLS','Network team, DBA for TLS'],
['**Host**','OS patching, local accounts, antivirus rules','Server team'],
['**Instance**','Logins, server roles, features, endpoints','DBA'],
['**Database**','Users, roles, schemas, permissions','DBA and developers'],
['**Data**','Encryption at rest and in use, masking','DBA and security'],
['**Application**','Parameterized queries, secrets handling','Developers'],
['**Audit and monitoring**','Audit logs, alerts','DBA and security']]},
{note:'Security is not only a product feature list. It is permissions, patching, process and monitoring done consistently.'}],
src:[['Security center for SQL Server',M.RD+'security/security-center-for-sql-server-database-engine-and-azure-sql-database'],['Security best practices checklist',M.RD+'security/sql-server-security-best-practices']]};

/* ---------- 1: Threat model ---------- */
L['mss-sec:0:1']={blocks:[
{p:'Before choosing controls, know **what you defend against**. A simple threat model lists assets, threats and the control that answers each.'},
{svg:threat},
{h:'Simple threat model'},
{t:[['Threat','Example','Main controls'],
['**Weak or stolen credentials**','Shared sa password, leaked connection string','Windows auth, strong secrets, MFA, lockout'],
['**Over-privilege**','App login is db_owner or sysadmin','Least privilege, roles'],
['**SQL injection**','String-built queries','Parameterized queries, least privilege'],
['**Data theft from files**','Stolen backup, copied .mdf','TDE, backup encryption, file permissions'],
['**Eavesdropping**','Sniffing on the network','TLS'],
['**Insider misuse**','A DBA or developer reads sensitive data','Audit, masking, separation of duties'],
['**Unpatched flaw**','Known vulnerability','Patching process'],
['**Ransomware**','Backups encrypted','Offline or immutable copies']]},
{h:'Questions to ask'},
{ul:['What is the **most sensitive data** here, and where does it live and travel?','Who and what can **reach** the instance on the network?','What is the **worst thing** one stolen credential allows?','How would we **notice** a breach, and how fast?']}],
src:[['Security best practices checklist',M.RD+'security/sql-server-security-best-practices'],['Securing SQL Server',M.RD+'security/securing-sql-server']]};

/* ---------- 2: Principals ---------- */
L['mss-sec:0:2']={blocks:[
{p:'Access is built from **principals** (who) and **securables** (what). Knowing the principal levels explains most "why can this user do that" questions.'},
{svg:prin},
{t:[['Principal','Level','Notes'],
['**Windows login**','Server','Maps a Windows user or group'],
['**SQL login**','Server','Name and password stored in master'],
['**Server role**','Server','sysadmin, securityadmin, user-defined'],
['**Database user**','Database','Mapped to a login, or contained'],
['**Database role**','Database','db_owner, db_datareader, custom roles'],
['**Application role**','Database','Activated by password, legacy pattern']]},
{code:`-- Logins and server role membership
SELECT sp.name, sp.type_desc, sp.is_disabled
FROM   sys.server_principals sp
WHERE  sp.type IN ('S','U','G')
ORDER  BY sp.name;

-- Database users and roles in the current database
SELECT dp.name, dp.type_desc, dp.authentication_type_desc
FROM   sys.database_principals dp
WHERE  dp.type IN ('S','U','G','R','E','X')
ORDER  BY dp.type_desc, dp.name;`}],
src:[['Principals',M.RD+'security/authentication-access/principals-database-engine'],['Getting started with database permissions',M.RD+'security/authentication-access/getting-started-with-database-engine-permissions']]};

/* ---------- 3: Securables and permissions ---------- */
L['mss-sec:0:3']={blocks:[
{p:'A **securable** is anything permissions can be set on. Permissions flow **down** the hierarchy, and `DENY` always wins.'},
{svg:sec},
{t:[['Permission','Meaning'],
['`SELECT`, `INSERT`, `UPDATE`, `DELETE`','Read and change data'],
['`EXECUTE`','Run procedures and functions'],
['`ALTER`','Change an object definition'],
['`CONTROL`','Everything on that securable, including granting'],
['`VIEW DEFINITION`','See object definitions and metadata'],
['`IMPERSONATE`','Act as another principal']]},
{code:`-- What can I do here?
SELECT * FROM sys.fn_my_permissions('sales.Orders', 'OBJECT');
SELECT * FROM sys.fn_my_permissions(NULL, 'DATABASE');

-- Does a user have a permission?
SELECT HAS_PERMS_BY_NAME('sales.Orders', 'OBJECT', 'SELECT') AS can_select;`},
{h:'Rules'},
{ul:['**GRANT** adds, **REVOKE** removes a grant or deny, **DENY** blocks.','A user gets the **union** of permissions from all their roles, minus any **DENY**.','**sysadmin** bypasses permission checks. Keep that group small.','**db_owner** can do almost anything in the database, so treat it as admin of that database.']}],
src:[['Permissions hierarchy',M.RD+'security/permissions-hierarchy-database-engine'],['Permissions (Database Engine)',M.RD+'security/permissions-database-engine']]};

})();
