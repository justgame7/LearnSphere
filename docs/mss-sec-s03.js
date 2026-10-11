/* LearnSphere - SQL Server Security & Compliance, Section 03: Authorization & Least Privilege.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const roles=M.dg(700,220,[
[10,10,330,200,'Server roles',1],[25,45,300,30,'sysadmin: everything',2],[25,85,300,30,'securityadmin, serveradmin',0],[25,125,300,30,'dbcreator, processadmin ...',0],[25,165,300,30,'public: every login',0],
[360,10,330,200,'Database roles',1],[375,45,300,30,'db_owner: all in database',2],[375,85,300,30,'db_datareader, db_datawriter',0],[375,125,300,30,'db_ddladmin, db_backupoperator',0],[375,165,300,30,'Your own roles by job',2]],
[]);

const gdr=M.dg(700,150,[
[10,25,200,70,'GRANT|gives a permission',2],[250,25,200,70,'REVOKE|removes a grant or deny',0],[490,25,200,70,'DENY|blocks, beats any grant',2],
[10,115,680,30,'Effective permission = union of grants from user and roles, minus any DENY',0]],
[]);

const chain=M.dg(700,170,[
[10,25,160,70,'User|EXECUTE on|procedure only',0],[200,25,170,70,'Procedure|owned by dbo|reads sales.Orders',2],[400,25,150,70,'Table|owned by dbo|same owner',0],[580,25,110,70,'Access works|no SELECT on|table needed',2],
[10,115,680,40,'The chain is checked only for the same owner. Dynamic SQL breaks the chain.',0]],
[[170,60,200,60],[370,60,400,60],[550,60,580,60]]);

const lp=M.dg(700,200,[
[10,15,215,170,'Role per function',1],[25,50,185,30,'app_read',0],[25,90,185,30,'app_write',0],[25,130,185,30,'report_reader',0],
[245,15,215,170,'Members',1],[260,50,185,30,'Windows groups',2],[260,90,185,30,'Service accounts',0],[260,130,185,30,'Few named admins',0],
[480,15,210,170,'Rules',1],[495,50,180,30,'No direct grants to users',2],[495,90,180,30,'Procedures as interface',0],[495,130,180,30,'Review each quarter',0]],
[]);

const aud=M.dg(700,150,[
[10,25,200,70,'Who has what|sys.database_permissions|role membership',2],[250,25,200,70,'Who is sysadmin|and db_owner|should be small',0],[490,25,200,70,'Review and record|remove stale access',0]],
[[210,60,250,60],[450,60,490,60]]);

/* ---------- 0: Roles ---------- */
L['mss-sec:2:0']={blocks:[
{p:'**Roles** group permissions so you grant access to a **job function**, not to every person one by one.'},
{svg:roles},
{h:'Fixed server roles'},
{t:[['Role','What it can do'],
['**sysadmin**','Everything on the instance'],
['**securityadmin**','Manage logins and permissions (can escalate)'],
['**serveradmin**','Change server settings, shut down'],
['**dbcreator**','Create and alter databases'],
['**processadmin**','Kill sessions'],
['**public**','Every login, minimal rights']]},
{h:'Fixed database roles'},
{t:[['Role','What it can do'],
['**db_owner**','Everything in the database'],
['**db_datareader / db_datawriter**','Read / change all user tables'],
['**db_ddladmin**','Create and alter objects'],
['**db_backupoperator**','Back up the database'],
['**db_denydatareader**','Cannot read data']]},
{code:`CREATE ROLE report_reader;
GRANT SELECT ON SCHEMA::reporting TO report_reader;
ALTER ROLE report_reader ADD MEMBER [CONTOSO\\Analysts];

-- Members of sysadmin
SELECT m.name FROM sys.server_role_members rm
JOIN sys.server_principals r ON r.principal_id = rm.role_principal_id AND r.name = 'sysadmin'
JOIN sys.server_principals m ON m.principal_id = rm.member_principal_id;`},
{note:'SQL Server 2022 adds fixed server roles such as ##MS_ServerPerformanceStateReader## so monitoring tools do not need sysadmin.'}],
src:[['Server-level roles',M.RD+'security/authentication-access/server-level-roles'],['Database-level roles',M.RD+'security/authentication-access/database-level-roles']]};

/* ---------- 1: GRANT DENY REVOKE ---------- */
L['mss-sec:2:1']={blocks:[
{p:'Three statements manage permissions. Their interaction decides what a user can really do.'},
{svg:gdr},
{code:`GRANT SELECT, INSERT ON sales.Orders TO order_clerks;
GRANT EXECUTE ON SCHEMA::sales TO order_clerks;

DENY  DELETE ON sales.Orders TO order_clerks;

REVOKE INSERT ON sales.Orders FROM order_clerks;       -- removes the earlier grant

-- Pass on the right to others (use with care)
GRANT SELECT ON sales.Orders TO team_lead WITH GRANT OPTION;`},
{h:'Interactions'},
{t:[['Situation','Result'],
['Granted via two roles','Union: allowed'],
['Granted via role, denied to user','**Denied**'],
['Denied via role, granted to user directly','**Denied**'],
['Member of sysadmin','Checks are bypassed, DENY has no effect'],
['No grant at all','Denied by default']]},
{note:'Prefer REVOKE or no grant over DENY. DENY is hard to debug and can block people through a role in ways nobody expects.'}],
src:[['GRANT',M.TS+'statements/grant-transact-sql'],['DENY',M.TS+'statements/deny-transact-sql']]};

/* ---------- 2: Schemas and ownership chaining ---------- */
L['mss-sec:2:2']={blocks:[
{p:'**Schemas** group objects and are a permission boundary. **Ownership chaining** lets a procedure expose data without giving callers rights on the tables.'},
{svg:chain},
{code:`CREATE SCHEMA reporting AUTHORIZATION dbo;
GO
CREATE PROCEDURE reporting.GetOrders @CustomerID int AS
  SELECT OrderID, OrderDate, TotalDue FROM sales.Orders WHERE CustomerID = @CustomerID;
GO
-- Callers get EXECUTE only, no SELECT on sales.Orders
GRANT EXECUTE ON reporting.GetOrders TO app_read;`},
{h:'How it works'},
{ul:['If the procedure and the objects it uses have the **same owner**, SQL Server skips permission checks on the underlying objects.','**Dynamic SQL** (EXEC with a string) **breaks** the chain, so the caller needs rights on the table.','Use `EXECUTE AS` or module signing when you need more control.']},
{h:'Good design'},
{ul:['Give the application **EXECUTE on a schema** of procedures, not table rights.','Keep **owner dbo** for most schemas, so chaining works.','Use schemas per area (sales, reporting) to grant at schema level.']}],
src:[['Ownership chains',M.RD+'security/authentication-access/ownership-chains'],['Schemas',M.RD+'security/authentication-access/create-a-database-schema']]};

/* ---------- 3: Least privilege model ---------- */
L['mss-sec:2:3']={blocks:[
{p:'**Least privilege** means every account gets the minimum rights needed for its job and nothing more. It limits the damage from mistakes and attacks.'},
{svg:lp},
{h:'Build the model'},
{flow:['List the **functions** that touch the database: app read, app write, reports, ETL, monitoring, DBAs','Create a **role** for each function with only the needed permissions','Add **groups or service accounts** to roles, never grant to individuals','Use a **procedure interface** for the app where practical','Separate **admin accounts** from daily accounts']},
{t:[['Account','Rights'],
['**Application**','EXECUTE on schema; no sysadmin, no db_owner'],
['**Reporting**','SELECT on reporting schema'],
['**ETL**','INSERT and UPDATE on staging, EXECUTE on load procedures'],
['**Monitoring**','VIEW SERVER STATE, VIEW ANY DEFINITION, not sysadmin'],
['**DBA**','Named admin accounts, MFA, logged']]},
{note:'The most common mistake is adding the application login to db_owner or sysadmin "to make it work". Find the missing permission instead.'}],
src:[['Security best practices checklist',M.RD+'security/sql-server-security-best-practices'],['Permissions (Database Engine)',M.RD+'security/permissions-database-engine']]};

/* ---------- 4: Auditing permissions ---------- */
L['mss-sec:2:4']={blocks:[
{p:'Permissions drift over time. A regular **permission review** finds access that should have been removed.'},
{svg:aud},
{code:`-- Direct permissions in the current database
SELECT pr.name AS principal, pe.permission_name, pe.state_desc,
       COALESCE(OBJECT_SCHEMA_NAME(pe.major_id) + '.' + OBJECT_NAME(pe.major_id), pe.class_desc) AS securable
FROM   sys.database_permissions pe
JOIN   sys.database_principals pr ON pr.principal_id = pe.grantee_principal_id
WHERE  pr.name NOT IN ('public', 'dbo')
ORDER  BY pr.name;

-- Role membership
SELECT r.name AS role_name, m.name AS member_name
FROM   sys.database_role_members rm
JOIN   sys.database_principals r ON r.principal_id = rm.role_principal_id
JOIN   sys.database_principals m ON m.principal_id = rm.member_principal_id
WHERE  r.name IN ('db_owner','db_securityadmin','db_ddladmin');`},
{h:'Review routine'},
{ul:['Monthly or quarterly: list **sysadmin**, **db_owner** and direct grants.','Check for **disabled** or **unused** logins and remove them.','Compare with the **approved access list** of each application.','Keep a record of who reviewed and when.']}],
src:[['sys.database_permissions',M.RD+'system-catalog-views/sys-database-permissions-transact-sql'],['sys.server_role_members',M.RD+'system-catalog-views/sys-server-role-members-transact-sql']]};

})();
