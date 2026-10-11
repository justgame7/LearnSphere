/* LearnSphere - SQL Server Security & Compliance, Section 02: Authentication.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const modes=M.dg(700,200,[
[10,20,330,150,'Windows authentication',1],[25,55,300,30,'Identity from Active Directory',2],[25,95,300,30,'Kerberos or NTLM, no password in SQL',0],[25,135,300,28,'Preferred where possible',0],
[360,20,330,150,'SQL authentication',1],[375,55,300,30,'Name and password stored in master',0],[375,95,300,30,'Works across domains and platforms',0],[375,135,300,28,'Needs strong passwords and policy',2]],
[]);

const orph=M.dg(700,170,[
[10,25,170,70,'Login|server level|SID stored in master',2],[210,25,170,70,'User|database level|stores the login SID',2],[410,25,130,70,'Backup moved|to another server',0],[570,25,120,70,'SIDs differ:|user is orphaned',0],
[10,115,680,40,'Same SID on both servers or contained users avoids the problem',0]],
[[180,60,210,60],[380,60,410,60],[540,60,570,60]]);

const cont=M.dg(700,170,[
[10,25,200,70,'Contained database|users live inside the|database',2],[250,25,200,70,'Database moves|with its users|no login needed',0],[490,25,200,70,'Cautions|instance option on,|owner control, SQL passwords',0]],
[[210,60,250,60]]);

const ent=M.dg(700,160,[
[10,25,160,70,'User signs in with|Microsoft Entra ID',0],[210,25,170,70,'Token from Entra|MFA, Conditional|Access',2],[420,25,130,70,'SQL Server or|Azure SQL|validates token',0],[590,25,100,70,'Mapped to|database user',0]],
[[170,60,210,60],[380,60,420,60],[550,60,590,60]]);

const pol=M.dg(700,150,[
[10,25,200,70,'CHECK_POLICY|Windows password|complexity and lockout',2],[250,25,200,70,'CHECK_EXPIRATION|password age|and expiry',0],[490,25,200,70,'Lockout|after failed tries|unlock when sure',0]],
[]);

/* ---------- 0: Windows vs SQL ---------- */
L['mss-sec:1:0']={blocks:[
{p:'SQL Server supports two ways to prove identity. **Windows authentication** is the default and the safer choice. **SQL authentication** is for cases where Windows identity is not possible.'},
{svg:modes},
{t:[['','Windows','SQL'],
['**Credentials stored**','In Active Directory','In master, as a password hash'],
['**Password policy**','Domain policy','CHECK_POLICY uses Windows policy'],
['**Offboarding**','Disable the AD account','Must also drop the login'],
['**Kerberos / SSO**','Yes','No'],
['**Typical use**','Admins, services, domain apps','Cross-platform, legacy, some tools']]},
{h:'Authentication mode'},
{ul:['**Windows only**: SQL logins are disabled, including **sa**. Best when possible.','**Mixed mode**: both. Needed for SQL logins. Then secure sa and every SQL login.']},
{code:`SELECT SERVERPROPERTY('IsIntegratedSecurityOnly') AS windows_only;   -- 1 = Windows only

-- Windows group login (preferred over individual users)
CREATE LOGIN [CONTOSO\\SalesDbUsers] FROM WINDOWS;

-- SQL login with policy
CREATE LOGIN appsvc WITH PASSWORD = '<strong password>', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;`},
{note:'Use **groups** for Windows access, so joiners and leavers are handled in one place, Active Directory.'}],
src:[['Choose an authentication mode',M.DE+'configure-windows/change-server-authentication-mode'],['Authentication access',M.RD+'security/authentication-access/authentication-access']]};

/* ---------- 1: Logins, users, orphaned ---------- */
L['mss-sec:1:1']={blocks:[
{p:'A **login** lets you connect to the instance. A **user** is the identity inside a database. A login is mapped to a user in each database it needs.'},
{code:`-- Instance level
CREATE LOGIN appsvc WITH PASSWORD = '<strong password>', CHECK_POLICY = ON;

-- Database level
USE SalesDB;
CREATE USER appsvc FOR LOGIN appsvc;
ALTER ROLE db_datareader ADD MEMBER appsvc;`},
{h:'Orphaned users'},
{svg:orph},
{p:'A user is **orphaned** when its stored SID does not match any login on the server. This happens after a restore or attach on another server.'},
{code:`-- Find orphaned users
SELECT dp.name, dp.sid
FROM   sys.database_principals dp
LEFT   JOIN sys.server_principals sp ON sp.sid = dp.sid
WHERE  dp.type IN ('S','U') AND sp.sid IS NULL
  AND  dp.name NOT IN ('guest','INFORMATION_SCHEMA','sys','dbo');

-- Repair: map the user to a login of the same name
ALTER USER appsvc WITH LOGIN = appsvc;`},
{note:'To avoid orphaning for SQL logins, create the login on the target with the **same SID** as the source, or use contained database users.'}],
src:[['CREATE LOGIN',M.TS+'statements/create-login-transact-sql'],['Troubleshoot orphaned users',M.SS+'failover-clusters/troubleshoot-orphaned-users-sql-server']]};

/* ---------- 2: Contained users ---------- */
L['mss-sec:1:2']={blocks:[
{p:'A **contained database** keeps its own users, so it carries authentication with it. It removes the login-to-user mapping problem and makes moves and failovers easier.'},
{svg:cont},
{code:`-- Enable the feature once per instance
EXEC sp_configure 'contained database authentication', 1; RECONFIGURE;

ALTER DATABASE SalesDB SET CONTAINMENT = PARTIAL;

USE SalesDB;
CREATE USER reportuser WITH PASSWORD = '<strong password>';       -- no login needed
CREATE USER [CONTOSO\\Analysts] FOR EXTERNAL PROVIDER;          -- Azure SQL, Entra ID`},
{h:'Benefits and cautions'},
{t:[['Benefit','Caution'],
['Database moves with its users','Anyone with ALTER ANY USER in the database can create users that can connect'],
['No orphaned users after restore','Passwords are in the database, so protect backups'],
['Works well with availability groups','Some features are not available in contained mode']]},
{note:'Treat db_owner in a contained database as nearly as powerful as server-level access to that database, because it can create users that connect directly.'}],
src:[['Contained databases',M.RD+'databases/contained-databases'],['Security best practices with contained databases',M.RD+'databases/security-best-practices-with-contained-databases']]};

/* ---------- 3: Entra ID ---------- */
L['mss-sec:1:3']={blocks:[
{p:'**Microsoft Entra ID** (formerly Azure Active Directory) provides cloud identity with **MFA**, Conditional Access and central user management. It is native in Azure SQL, and supported for SQL Server on-premises from **SQL Server 2022**.'},
{svg:ent},
{h:'Where it works'},
{t:[['Platform','Support'],
['**Azure SQL Database, Managed Instance**','Built in'],
['**SQL Server on Azure VM**','Supported'],
['**SQL Server 2022 on-premises**','Supported with Azure Arc and a configured Entra application'],
['**Earlier versions**','Not supported natively']]},
{code:`-- Azure SQL: add an Entra user or group to a database
CREATE USER [dba-team@contoso.com] FROM EXTERNAL PROVIDER;
ALTER ROLE db_owner ADD MEMBER [dba-team@contoso.com];

-- Entra logins on SQL Server 2022 with Entra enabled
CREATE LOGIN [dba-team@contoso.com] FROM EXTERNAL PROVIDER;`},
{ul:['Prefer **groups** to individual users.','Use **MFA** and **Conditional Access** for admins.','Use **managed identities** for applications instead of passwords.']},
{note:'On-premises setup needs Arc connection, a Key Vault certificate and an app registration. Follow the current Microsoft guide for your version.'}],
src:[['Microsoft Entra authentication for SQL Server',M.SS+'azure-ad-authentication-sql-server-overview'],['Entra authentication for Azure SQL','https://learn.microsoft.com/en-us/azure/azure-sql/database/authentication-aad-overview']]};

/* ---------- 4: Password policies and lockouts ---------- */
L['mss-sec:1:4']={blocks:[
{p:'SQL logins can use the **Windows password policy** of the machine or domain. Turn it on, and know how lockouts behave.'},
{svg:pol},
{code:`-- Enforce policy on a login
ALTER LOGIN appsvc WITH CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;

-- Status of logins
SELECT name, is_policy_checked, is_expiration_checked, is_disabled,
       LOGINPROPERTY(name, 'IsLocked')   AS is_locked,
       LOGINPROPERTY(name, 'BadPasswordCount') AS bad_count,
       LOGINPROPERTY(name, 'PasswordLastSetTime') AS last_set
FROM   sys.sql_logins;

-- Unlock
ALTER LOGIN appsvc WITH PASSWORD = '<new password>' UNLOCK;`},
{h:'Practical rules'},
{ul:['**CHECK_POLICY = ON** for all SQL logins.','Service accounts for applications: policy on, expiration off, and rotate by process, because expiry breaks apps.','**Disable or rename sa**, and give it a long random password anyway.','Review the error log for **repeated failed logins** from the same source.']},
{note:'Lockout settings come from the operating system or domain policy. If you see a surprise lockout, check which policy applies to the server.'}],
src:[['Password policy',M.RD+'security/password-policy'],['ALTER LOGIN',M.TS+'statements/alter-login-transact-sql']]};

})();
