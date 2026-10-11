/* LearnSphere - SQL Server Security & Compliance, Section 09: Hardening & Threat Detection.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const surf=M.dg(700,200,[
[10,15,680,170,'Turn off what you do not use',1],
[30,50,200,40,'xp_cmdshell',0],[250,50,200,40,'Ole Automation Procedures',0],[470,50,200,40,'Ad hoc distributed queries',0],
[30,100,200,40,'CLR (unless needed)',0],[250,100,200,40,'Unused protocols|and services',0],[470,100,200,40,'Sample databases',0],
[30,150,640,28,'Each enabled feature is something an attacker can use',0]],
[]);

const inj=M.dg(700,180,[
[10,20,330,140,'Vulnerable',1],[25,55,300,45,'SQL built by joining strings|with user input',2],[25,110,300,40,'Input can change the query',0],
[360,20,330,140,'Safe',1],[375,55,300,45,'Parameters or sp_executesql|input is data, never code',2],[375,110,300,40,'Least privilege limits damage',0]],
[]);

const va=M.dg(700,150,[
[10,25,200,70,'Scan|SSMS Vulnerability|Assessment task',2],[250,25,200,70,'Review|rules failed,|risk level',0],[490,25,200,70,'Baseline or fix|record accepted|exceptions',0]],
[[210,60,250,60],[450,60,490,60]]);

const patch=M.dg(700,170,[
[10,25,150,70,'Monitor|CU and security|release notes',0],[190,25,150,70,'Assess|CVE risk and|exposure',0],[370,25,150,70,'Test|non-production|first',2],[550,25,140,70,'Deploy|in a window,|with rollback',2],
[10,115,680,40,'Support lifecycle matters: a version past end of support gets no security fixes',0]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

const sa=M.dg(700,170,[
[10,25,200,70,'sa account|disable or rename|long random password',2],[250,25,200,70,'Service accounts|virtual or gMSA|no local admin',0],[490,25,200,70,'Dangerous settings|TRUSTWORTHY ON,|db owner = sa',2],
[10,115,680,40,'Review these on every instance. They are the usual path from small flaw to full control.',0]],
[]);

/* ---------- 0: Attack surface ---------- */
L['mss-sec:8:0']={blocks:[
{p:'**Reduce the attack surface**: every feature, protocol and account you do not need is a risk with no benefit.'},
{svg:surf},
{code:`-- Features that are on
SELECT name, value_in_use
FROM   sys.configurations
WHERE  name IN ('xp_cmdshell', 'Ole Automation Procedures', 'Ad Hoc Distributed Queries',
                'clr enabled', 'cross db ownership chaining', 'remote access',
                'Database Mail XPs', 'scan for startup procs');

-- Turn one off
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'xp_cmdshell', 0; RECONFIGURE;`},
{h:'Checklist'},
{ul:['Install **only the features** you need.','Disable unused **protocols** and the **SQL Browser** service if not needed.','Remove **sample databases** and unused logins.','Restrict who can reach the instance with **firewall rules**.','Run on a **supported** OS with current patches.','Use a **non-default port** only as extra obscurity, not as a control.']},
{note:'Do not disable a setting on a production instance without checking dependencies. Jobs, linked servers and applications may use it.'}],
src:[['Surface area configuration',M.DE+'configure-windows/server-configuration-options-sql-server'],['Security best practices checklist',M.RD+'security/sql-server-security-best-practices']]};

/* ---------- 1: SQL injection ---------- */
L['mss-sec:8:1']={blocks:[
{p:'**SQL injection** happens when user input becomes part of the SQL **code**. It remains one of the most damaging web application flaws, and the database is where the damage lands.'},
{svg:inj},
{h:'Vulnerable and safe'},
{code:`-- Vulnerable: input becomes code
DECLARE @sql nvarchar(max) = N'SELECT * FROM sales.Customers WHERE Name = ''' + @Name + N'''';
EXEC (@sql);
-- @Name = x' OR 1=1; DROP TABLE sales.Customers; --

-- Safe: parameterized dynamic SQL
EXEC sp_executesql
  N'SELECT * FROM sales.Customers WHERE Name = @Name',
  N'@Name nvarchar(100)', @Name = @Name;

-- Identifiers cannot be parameters: validate and quote
DECLARE @tbl sysname = QUOTENAME(@TableName);`},
{h:'Defenses'},
{t:[['Layer','Defense'],
['**Application**','Parameterized queries or ORM, never string concatenation'],
['**Database**','Stored procedures with typed parameters, least privilege for the app login'],
['**Validation**','Allow-list for identifiers, length and type checks'],
['**Monitoring**','Audit failed logins, unusual errors, WAF at the edge']]},
{note:'Least privilege is the safety net: an injected query can only do what the app login is allowed to do. A db_owner or sysadmin app login makes every injection a full breach.'}],
src:[['SQL injection',M.RD+'security/sql-injection'],['sp_executesql',M.RD+'system-stored-procedures/sp-executesql-transact-sql']]};

/* ---------- 2: Vulnerability assessment ---------- */
L['mss-sec:8:2']={blocks:[
{p:'**Vulnerability Assessment** in SSMS scans a database against a rule set of security best practices and shows what to fix.'},
{svg:va},
{flow:['In SSMS, right-click the database, Tasks, Vulnerability Assessment, Scan','Review failed rules, with risk level and remediation','Fix real issues, such as excessive permissions or missing encryption','Mark acceptable findings as a baseline with a reason','Re-run on a schedule and after changes']},
{t:[['Examples of rules','Why'],
['Excessive permissions to PUBLIC or guest','Unintended access'],
['Database owner is sa or TRUSTWORTHY is on','Privilege escalation path'],
['Weak or no TDE, no auditing','Missing protection and evidence'],
['Orphaned users','Account hygiene']]},
{note:'A scan is a snapshot of configuration, not a penetration test. Use it with patching, monitoring and periodic expert review.'}],
src:[['SQL Vulnerability Assessment',M.RD+'security/sql-vulnerability-assessment'],['Vulnerability assessment rules',M.RD+'security/sql-vulnerability-assessment-rules']]};

/* ---------- 3: Patching ---------- */
L['mss-sec:8:3']={blocks:[
{p:'Most successful attacks use **known** flaws that already have fixes. Patching on a schedule is one of the most effective security controls.'},
{svg:patch},
{h:'Practices'},
{ul:['Follow **Microsoft security updates** and the CU release notes for your version.','Define **patch windows** and an **emergency path** for critical flaws.','**Test** against a copy of production workload first.','Patch the **OS, drivers and SQL Server**, and any client drivers you control.','Stay on **supported** versions: out-of-support versions get no security fixes.']},
{code:`SELECT SERVERPROPERTY('ProductVersion') AS build,
       SERVERPROPERTY('ProductLevel') AS level,
       SERVERPROPERTY('ProductUpdateLevel') AS update_level,
       SERVERPROPERTY('ProductUpdateReference') AS kb;`},
{note:'Keep a record of builds per server. An inventory that shows each server build and the date of its last patch finds forgotten systems quickly.'}],
src:[['SQL Server builds and updates',M.SS+'sql-server-2022-release-notes'],['SQL Server 2022 lifecycle',M.LC+'sql-server-2022']]};

/* ---------- 4: sa and service accounts ---------- */
L['mss-sec:8:4']={blocks:[
{p:'Two things appear in almost every audit: the **sa** account and the **service accounts**. A few settings in databases also create hidden escalation paths.'},
{svg:sa},
{h:'sa'},
{code:`-- Rename and disable
ALTER LOGIN sa WITH NAME = [dba_sa_disabled];
ALTER LOGIN [dba_sa_disabled] DISABLE;

-- Check
SELECT name, is_disabled FROM sys.server_principals WHERE sid = 0x01;`},
{h:'Service accounts'},
{ul:['Use **virtual accounts** or **group managed service accounts**.','No **local administrator** or domain admin rights.','Separate accounts for **Engine, Agent** and other services.','Change them only with **Configuration Manager**.']},
{h:'Dangerous database settings'},
{code:`-- Databases where TRUSTWORTHY is on, and the database owner
SELECT d.name, d.is_trustworthy_on, SUSER_SNAME(d.owner_sid) AS owner
FROM   sys.databases d
WHERE  d.is_trustworthy_on = 1 AND d.database_id > 4;`},
{note:'TRUSTWORTHY ON with a privileged owner lets a db_owner of that database become sysadmin. Turn it off unless a documented feature requires it.'}],
src:[['Configure Windows service accounts and permissions',M.DE+'configure-windows/configure-windows-service-accounts-and-permissions'],['TRUSTWORTHY database property',M.RD+'security/trustworthy-database-property']]};

})();
