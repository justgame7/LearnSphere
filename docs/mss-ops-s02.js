/* LearnSphere - SQL Server Operations, Monitoring & Automation, Section 02: Automation with PowerShell.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const mods=M.dg(700,190,[
[10,20,330,150,'SqlServer module (Microsoft)',1],[25,55,300,30,'Invoke-Sqlcmd, Get-SqlInstance',2],[25,95,300,30,'Backup-SqlDatabase, Restore-SqlDatabase',0],[25,135,300,28,'SQLSERVER: provider, SMO objects',0],
[360,20,330,150,'dbatools (community)',1],[375,55,300,30,'Hundreds of ready commands',2],[375,95,300,30,'Copy, test, migrate, report',0],[375,135,300,28,'Open source, widely used',0]],
[]);

const task=M.dg(700,150,[
[10,25,150,70,'Parameters|instances, paths|thresholds',0],[190,25,150,70,'Do the work|loop over servers',2],[370,25,150,70,'Handle errors|try/catch, log',0],[550,25,140,70,'Report|output object,|email, file',2]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

const src=M.dg(700,170,[
[10,25,150,70,'Scripts in Git|one repo, folders',0],[190,25,150,70,'Review|pull request',2],[370,25,150,70,'Test|lab or pipeline',0],[550,25,140,70,'Deploy|run from agent|or runner',2],
[10,115,680,40,'Secrets are never committed: use a vault or SecretManagement',0]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

/* ---------- 0: SqlServer module ---------- */
L['mss-ops:1:0']={blocks:[
{p:'**PowerShell** is the main automation language for SQL Server administration. Microsoft provides the **SqlServer** module, and the community provides **dbatools**.'},
{svg:mods},
{code:`Install-Module SqlServer -Scope CurrentUser
Import-Module SqlServer

# Run a query and get objects back
Invoke-Sqlcmd -ServerInstance SQLPROD01 -Database master -Query "SELECT name, state_desc FROM sys.databases"

# Backup with a cmdlet
Backup-SqlDatabase -ServerInstance SQLPROD01 -Database SalesDB -BackupFile E:\\Backup\\SalesDB.bak -CompressionOption On

# Browse like a drive
Get-ChildItem SQLSERVER:\\SQL\\SQLPROD01\\DEFAULT\\Databases | Select-Object Name, RecoveryModel, Size`},
{h:'Why use PowerShell'},
{ul:['**Objects** instead of text, so you can filter, sort and export results.','**Many servers** in one script, not one connection at a time.','**Repeatable**: the same script gives the same result and can be stored in Git.']},
{note:'Use secure ways to supply credentials: integrated authentication, Get-Credential or a secret vault. Never put passwords in script text.'}],
src:[['SqlServer PowerShell module',M.SQL+'powershell/sql-server-powershell'],['Invoke-Sqlcmd','https://learn.microsoft.com/en-us/powershell/module/sqlserver/invoke-sqlcmd']]};

/* ---------- 1: dbatools ---------- */
L['mss-ops:1:1']={blocks:[
{p:'**dbatools** is an open-source PowerShell module with over 600 commands for everyday DBA work. It is a de facto standard because it saves a lot of scripting.'},
{t:[['Task','Command'],
['Find a command','`Find-DbaCommand -Tag Backup`'],
['List databases and sizes','`Get-DbaDatabase -SqlInstance SQLPROD01`'],
['Test backups by restoring them','`Test-DbaLastBackup -SqlInstance SQLPROD01`'],
['Copy logins and jobs','`Copy-DbaLogin`, `Copy-DbaAgentJob`'],
['Check memory setting','`Test-DbaMaxMemory`, `Set-DbaMaxMemory`'],
['Run T-SQL','`Invoke-DbaQuery`'],
['Install the maintenance solution','`Install-DbaMaintenanceSolution`']]},
{code:`Install-Module dbatools -Scope CurrentUser

# Every instance in a list: databases without a recent full backup
Get-DbaLastBackup -SqlInstance (Get-Content .\\servers.txt) |
  Where-Object { $_.LastFullBackup -lt (Get-Date).AddDays(-1) } |
  Select-Object SqlInstance, Database, LastFullBackup`},
{h:'Good habits'},
{ul:['**Read the help** and use `-WhatIf` where available before changes.','**Pin the version** in production scripts, so updates do not surprise you.','Review the source: it is a community project, so apply the same checks as for any third party code.']}],
src:[['dbatools','https://dbatools.io/'],['dbatools commands','https://docs.dbatools.io/']]};

/* ---------- 2: Automating routine tasks ---------- */
L['mss-ops:1:2']={blocks:[
{p:'Good automation follows a simple shape: **input, work, errors, output**. A script that looks at one server can usually be extended to many.'},
{svg:task},
{code:`param(
  [string[]]$SqlInstance = (Get-Content .\\servers.txt),
  [int]$FullBackupMaxAgeHours = 26
)
$results = foreach ($inst in $SqlInstance) {
  try {
    Get-DbaLastBackup -SqlInstance $inst -ErrorAction Stop |
      Where-Object { $_.LastFullBackup -lt (Get-Date).AddHours(-$FullBackupMaxAgeHours) } |
      Select-Object SqlInstance, Database, LastFullBackup
  } catch {
    [pscustomobject]@{ SqlInstance = $inst; Database = '(error)'; LastFullBackup = $_.Exception.Message }
  }
}
$results | Export-Csv .\\backup-gaps.csv -NoTypeInformation
if ($results) { exit 1 }   # non-zero exit lets the scheduler flag a failure`},
{h:'Where to run it'},
{t:[['Option','Use'],
['**SQL Server Agent PowerShell or CmdExec step**','Close to the database, simple'],
['**Task Scheduler or cron**','No Agent, or a central admin host'],
['**CI or automation platform**','Many servers, approvals, audit trail']]},
{note:'Always return a **clear exit status** and log output. A script that fails silently is worse than no script.'}],
src:[['PowerShell with SQL Agent',M.RD+'sql-server-agent/run-a-powershell-script-in-a-sql-server-agent-job'],['dbatools',  'https://dbatools.io/']]};

/* ---------- 3: Source control ---------- */
L['mss-ops:1:3']={blocks:[
{p:'Scripts and database objects belong in **source control**. It gives you history, review, and a way back.'},
{svg:src},
{h:'What to store'},
{ul:['**Operational scripts**: maintenance, checks, reports.','**Server configuration** as scripts, such as sp_configure and Agent jobs.','**Database objects**: schema as code in a SQL project, built to a DACPAC.','**Runbooks** and documentation in the same repository.']},
{h:'Practices'},
{t:[['Practice','Why'],
['**One folder per area** (agent, backup, security, reports)','Easy to find and review'],
['**Idempotent scripts** (CREATE OR ALTER, IF NOT EXISTS)','Safe to run again'],
['**Pull requests with review**','Second pair of eyes on production changes'],
['**Tags or releases**','Know what was deployed when'],
['**No secrets in the repo**','Use a vault or pipeline secrets']]},
{code:`-- Idempotent pattern
CREATE OR ALTER PROCEDURE dbo.PurgeAuditLog @KeepDays int = 90 AS
  DELETE TOP (5000) FROM dbo.AuditLog WHERE LogDate < DATEADD(day, -@KeepDays, GETDATE());`}],
src:[['SQL database projects',M.SQL+'tools/sql-database-projects/sql-database-projects'],['Data-tier applications (DACPAC)',M.RD+'data-tier-applications/data-tier-applications']]};

})();
