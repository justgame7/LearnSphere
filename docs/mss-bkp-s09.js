/* LearnSphere - SQL Server Backup, Restore & Recovery, Section 09: Automation & Verification.
   Lectures 0-4 are core, 5 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const job=M.dg(700,170,[
[10,25,150,70,'Job|name, owner,|category',2],[190,25,150,70,'Step|T-SQL: run the|backup procedure',0],[370,25,150,70,'Schedule|full, diff, log',0],[550,25,140,70,'Notify|operator on|failure',2],
[10,115,680,40,'Same four parts for every job: what, when, who is told if it fails',0]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

const mp=M.dg(700,170,[
[10,25,200,70,'Maintenance plan|subplans: full, diff, log|one per schedule',2],[250,25,200,70,'Tasks|Back Up Database|Maintenance Cleanup',0],[490,25,200,70,'SSIS package|stored in msdb,|run by Agent',0],
[10,115,680,40,'Quick to start. Limited conditions and logging compared with scripts.',0]],
[[210,60,250,60],[450,60,490,60]]);

const tst=M.dg(700,150,[
[10,25,150,70,'Pick latest|full backup|from history',0],[185,25,150,70,'RESTORE to|test server|WITH MOVE',2],[360,25,150,70,'CHECKDB on|the copy',2],[535,25,155,70,'Log result,|drop copy,|alert on failure',0]],
[[160,60,185,60],[335,60,360,60],[510,60,535,60]]);

const mon=M.dg(700,150,[
[10,25,200,70,'Expected|full every 24 h|log every 15 min',0],[250,25,200,70,'Actual|from msdb.backupset|per database',2],[490,25,200,70,'Gap = alert|and ticket',0]],
[[210,60,250,60],[450,60,490,60]]);

const alr=M.dg(700,170,[
[10,25,150,70,'Job fails|or check finds gap',0],[190,25,150,70,'Operator|email, pager,|chat webhook',2],[370,25,150,70,'Someone owns it|on-call rota',0],[550,25,140,70,'Ticket and|root cause',0],
[10,115,680,40,'An alert nobody reads is the same as no alert',0]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

/* ---------- 0: Agent jobs ---------- */
L['mss-bkp:8:0']={blocks:[
{p:'Backups must run **without a person**. SQL Server Agent runs scheduled jobs and tells an operator when one fails.'},
{svg:job},
{code:`USE msdb;
EXEC dbo.sp_add_job @job_name = N'Backup - Log - User DBs';
EXEC dbo.sp_add_jobstep @job_name = N'Backup - Log - User DBs',
  @step_name = N'Log backup', @subsystem = N'TSQL', @database_name = N'master',
  @command = N'EXECUTE dbo.DatabaseBackup @Databases = ''USER_DATABASES'', @Directory = ''E:\\Backup'', @BackupType = ''LOG'', @Verify = ''Y'', @CheckSum = ''Y''';
EXEC dbo.sp_add_jobschedule @job_name = N'Backup - Log - User DBs',
  @name = N'Every 15 minutes', @freq_type = 4, @freq_interval = 1,
  @freq_subday_type = 4, @freq_subday_interval = 15;
EXEC dbo.sp_add_jobserver @job_name = N'Backup - Log - User DBs';`},
{h:'Good practice'},
{ul:['Run jobs under a **proxy or service account** with only the rights needed.','Set **notification on failure** to an operator.','Use **job step retries** only for transient errors, not to hide real ones.','Keep the log backup job **frequent and fast**.','**Do not overlap** a log backup with the start of a full backup in a way that blocks or errors.']},
{note:'Express edition has no Agent. Use Windows Task Scheduler or cron to run sqlcmd with the same backup commands.'}],
src:[['SQL Server Agent',M.SQL+'ssms/agent/sql-server-agent'],['sp_add_job',M.RD+'system-stored-procedures/sp-add-job-transact-sql']]};

/* ---------- 1: Maintenance plans ---------- */
L['mss-bkp:8:1']={blocks:[
{p:'**Maintenance plans** are the built-in wizard for backups and routine tasks. They are quick to create and good enough for small environments.'},
{svg:mp},
{h:'What a backup plan has'},
{ul:['**Back Up Database Task** (full, differential or log) with compression and verify.','**Maintenance Cleanup Task** to delete old backup files and history.','**Check Database Integrity Task** and statistics tasks.','**Notify Operator Task** for failures.']},
{t:[['Strengths','Limits'],
['Fast to build in SSMS, no scripting','Fewer options and conditions than scripts'],
['Built into SQL Server','Harder to keep in source control'],
['Good for small estates','Same plan is difficult to apply to many servers']]},
{h:'Check them'},
{code:`SELECT name, create_date FROM msdb.dbo.sysmaintplan_plans;

SELECT p.name AS plan_name, s.subplan_name, sch.name AS schedule_name
FROM   msdb.dbo.sysmaintplan_plans p
JOIN   msdb.dbo.sysmaintplan_subplans s ON s.plan_id = p.id
LEFT   JOIN msdb.dbo.sysschedules sch ON sch.schedule_uid = s.schedule_id;`},
{note:'If you outgrow plans, move to scripts or a community solution, but keep the same schedule and retention until you have tested the new one.'}],
src:[['Maintenance plans',M.RD+'maintenance-plans/maintenance-plans'],['Create a maintenance plan',M.RD+'maintenance-plans/create-a-maintenance-plan']]};

/* ---------- 2: Automated test restores ---------- */
L['mss-bkp:8:2']={blocks:[
{p:'The only proof of a good backup is a **restore**. Automating test restores turns that proof into a routine report instead of a yearly emergency.'},
{svg:tst},
{h:'The idea'},
{flow:['Choose the databases and a test server with enough space','Find the latest full (and diff/log if you want to test them) in msdb','Restore with MOVE to a test location','Run DBCC CHECKDB on the restored copy','Record duration and result in a table, drop the copy','Alert if any step fails or takes much longer than before']},
{code:`# dbatools: restore the most recent backup of every database to a test instance and check it
Test-DbaLastBackup -SqlInstance SQLPROD01 -Destination SQLTEST01 \`
  -DataDirectory D:\\Test -LogDirectory L:\\Test | \`
  Select-Object SourceServer, Database, RestoreResult, DbccResult, RestoreElapsed`},
{h:'What to record'},
{t:[['Field','Use'],
['**Restore duration**','Feeds your real RTO'],
['**Backup size**','Capacity planning'],
['**CHECKDB result**','Detect corruption in backups'],
['**Date and file**','Evidence for audit']]},
{note:'Do not run the test on the production server. Restore on a server with its own storage, and keep it patched at the same version or newer.'}],
src:[['Test-DbaLastBackup','https://docs.dbatools.io/Test-DbaLastBackup'],['Restore a database backup',M.RD+'backup-restore/restore-a-database-backup-using-ssms']]};

/* ---------- 3: Monitoring ---------- */
L['mss-bkp:8:3']={blocks:[
{p:'Backups fail quietly: a job stops, a disk fills, a credential expires. **Monitor the age of the last good backup**, not only the job status.'},
{svg:mon},
{code:`-- Databases with no recent full backup or no recent log backup
SELECT d.name, d.recovery_model_desc,
       MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END) AS last_full,
       MAX(CASE WHEN b.type = 'L' THEN b.backup_finish_date END) AS last_log
FROM   sys.databases d
LEFT   JOIN msdb.dbo.backupset b ON b.database_name = d.name AND b.is_copy_only = 0
WHERE  d.database_id <> 2 AND d.state_desc = 'ONLINE'
GROUP  BY d.name, d.recovery_model_desc
HAVING MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END) < DATEADD(hour, -26, GETDATE())
    OR MAX(CASE WHEN b.type = 'D' THEN b.backup_finish_date END) IS NULL
    OR (d.recovery_model_desc <> 'SIMPLE'
        AND (MAX(CASE WHEN b.type = 'L' THEN b.backup_finish_date END) < DATEADD(minute, -30, GETDATE())
          OR MAX(CASE WHEN b.type = 'L' THEN b.backup_finish_date END) IS NULL));`},
{h:'What to check'},
{t:[['Check','Why'],
['**Age of last full / log**','Is the RPO being met?'],
['**Backup size and duration trend**','Early sign of growth or I/O trouble'],
['**Free space** on backup target','A full disk stops all backups'],
['**Databases without any backup**','New databases that nobody added to the plan'],
['**Credential or SAS expiry**','Cloud backups stop suddenly']]},
{note:'Thresholds should come from RPO. A database with a 15-minute RPO should alert if the last log backup is 30 minutes old, not 24 hours.'}],
src:[['backupset',M.RD+'system-tables/backupset-transact-sql'],['Monitor backup and restore',M.RD+'backup-restore/monitor-backup-and-restore']]};

/* ---------- 4: Alerting ---------- */
L['mss-bkp:8:4']={blocks:[
{p:'Monitoring finds the problem. **Alerting** makes sure a person knows. Keep it simple, specific and owned.'},
{svg:alr},
{h:'Pieces in SQL Server'},
{t:[['Piece','Purpose'],
['**Database Mail**','Sends email from SQL Server'],
['**Operator**','Who gets the message and when'],
['**Job notification**','Email on job failure or success'],
['**Agent alert**','Fires on an error number or severity (for example 823, 824, 825, 9002)'],
['**External tool**','Pushes to chat, paging or ticket systems']]},
{code:`-- Alert for I/O errors
EXEC msdb.dbo.sp_add_alert @name = N'Error 824 - consistency',
  @message_id = 824, @severity = 0, @enabled = 1, @delay_between_responses = 60;
EXEC msdb.dbo.sp_add_notification @alert_name = N'Error 824 - consistency',
  @operator_name = N'DBA Team', @notification_method = 1;`},
{h:'Rules for good alerts'},
{ul:['**Every alert has an owner** and an action in the runbook.','Fewer, **meaningful** alerts. Noise makes people ignore all of them.','Alert on **gaps** (no backup in the window), not only on failures.','Test alerting **end to end**: break a job on purpose and see who is told.']}],
src:[['Alerts',M.RD+'sql-server-agent/alerts'],['Database Mail',M.RD+'database-mail/database-mail']]};

})();
