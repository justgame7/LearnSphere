/* LearnSphere - SQL Server Operations, Monitoring & Automation, Section 01: SQL Server Agent.
   Lectures 0-4 are core, 5 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const job=M.dg(700,220,[
[10,10,680,200,'A SQL Server Agent job',1],
[30,45,190,50,'Job|name, owner, category',2],[255,45,190,50,'Steps|T-SQL, PowerShell,|CmdExec, SSIS',0],[480,45,190,50,'Schedules|when it runs',0],
[30,115,190,50,'On success|go to next step or quit',0],[255,115,190,50,'On failure|retry, go to step, quit',0],[480,115,190,50,'Notifications|email an operator',2],
[30,175,640,28,'History is stored in msdb: sysjobs, sysjobsteps, sysjobhistory',0]],
[[220,70,255,70],[445,70,480,70]]);

const alert=M.dg(700,170,[
[10,25,150,70,'Event|error 823,|severity 19,|counter threshold',0],[190,25,150,70,'Agent alert|matches the event',2],[370,25,150,70,'Operator|email or pager',2],[550,25,140,70,'Database Mail|profile sends|the message',0],
[10,115,680,40,'Database Mail needs a profile, an account and the Agent configured to use that profile',0]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

const prox=M.dg(700,170,[
[10,25,200,70,'Credential|a Windows account|and password',0],[250,25,200,70,'Proxy|maps credential to|subsystems',2],[490,25,200,70,'Job step runs as|the proxy account|not the Agent account',0],
[10,115,680,40,'Least privilege: a file copy step needs file rights, not sysadmin',0]],
[[210,60,250,60],[450,60,490,60]]);

const tsh=M.dg(700,170,[
[10,25,170,70,'Job failed|email or alert',2],[210,25,170,70,'Job history|which step,|which message',0],[410,25,130,70,'Step output|file or table|more detail',0],[570,25,120,70,'Fix and|rerun|document',2],
[10,115,680,40,'Failure at step 3 of 5 tells you where to look. The default history limit may hide older runs.',0]],
[[180,60,210,60],[380,60,410,60],[540,60,570,60]]);

const flow=M.dg(700,200,[
[10,20,130,60,'Step 1|check inputs',0],[170,20,130,60,'Step 2|load data',2],[330,20,130,60,'Step 3|validate',0],[490,20,100,60,'Step 4|report',0],
[170,115,200,60,'Failure step|clean up, log,|notify, then fail',2],[420,115,200,60,'Success|quit reporting|success',0]],
[[140,50,170,50],[300,50,330,50],[460,50,490,50],[235,80,260,115],[590,50,590,115]]);

/* ---------- 0: Jobs, steps, schedules ---------- */
L['mss-ops:0:0']={blocks:[
{p:'**SQL Server Agent** is the built-in scheduler of SQL Server. It runs **jobs**: backups, maintenance, ETL, reports. It is not available in Express edition.'},
{svg:job},
{h:'Parts of a job'},
{t:[['Part','Meaning'],
['**Job**','A named unit of work with an owner and a category'],
['**Step**','One action: T-SQL, PowerShell, CmdExec, SSIS package and others'],
['**Schedule**','When it runs: once, recurring, at Agent start or when the CPU is idle'],
['**Operator**','A person or group to notify'],
['**Alert**','A response to an event, error or counter']]},
{h:'Create a job in T-SQL'},
{code:`USE msdb;
EXEC dbo.sp_add_job        @job_name = N'Nightly purge';
EXEC dbo.sp_add_jobstep    @job_name = N'Nightly purge', @step_name = N'Delete old rows',
     @subsystem = N'TSQL', @database_name = N'SalesDB',
     @command = N'DELETE TOP (5000) FROM dbo.AuditLog WHERE LogDate < DATEADD(day,-90,GETDATE());';
EXEC dbo.sp_add_jobschedule @job_name = N'Nightly purge', @name = N'Daily 01:00',
     @freq_type = 4, @freq_interval = 1, @active_start_time = 010000;
EXEC dbo.sp_add_jobserver  @job_name = N'Nightly purge';`},
{note:'On Linux the Agent is a separate service enabled with mssql-conf (sqlagent.enabled). Job subsystems and paths differ slightly from Windows.'}],
src:[['SQL Server Agent',M.SQL+'ssms/agent/sql-server-agent'],['Create a job',M.SQL+'ssms/agent/create-a-job']]};

/* ---------- 1: Operators, alerts, Database Mail ---------- */
L['mss-ops:0:1']={blocks:[
{p:'Jobs and events need someone to hear about them. **Operators** and **alerts** deliver the message, and **Database Mail** is the usual transport.'},
{svg:alert},
{code:`-- Operator and a job failure notification
EXEC msdb.dbo.sp_add_operator @name = N'DBA Team', @email_address = N'dba@contoso.com';
EXEC msdb.dbo.sp_update_job @job_name = N'Nightly purge',
     @notify_level_email = 2, @notify_email_operator_name = N'DBA Team';   -- 2 = on failure

-- Alert for severity 19 to 25 errors
EXEC msdb.dbo.sp_add_alert @name = N'Severity 19', @severity = 19, @delay_between_responses = 300;
EXEC msdb.dbo.sp_add_notification @alert_name = N'Severity 19', @operator_name = N'DBA Team', @notification_method = 1;`},
{h:'Useful alerts'},
{ul:['**Severity 17 to 25** errors.','Errors **823, 824, 825** (I/O and corruption).','**9002** transaction log full.','**Performance conditions** such as log used percent above a threshold.']},
{h:'Database Mail'},
{flow:['Enable Database Mail XPs','Create an account (SMTP server, sender) and a profile','Give the Agent the profile in Agent properties, Alert System','Test with sp_send_dbmail']},
{note:'Send alerts to a distribution list or a monitoring system, not to one person. Add a delay between responses so one event does not send hundreds of messages.'}],
src:[['Database Mail',M.RD+'database-mail/database-mail'],['Alerts',M.RD+'sql-server-agent/alerts']]};

/* ---------- 2: Proxies and job security ---------- */
L['mss-ops:0:2']={blocks:[
{p:'By default job steps run as the **Agent service account**, or as the job owner for T-SQL. Powerful steps should not run with powerful rights. **Proxies** let a step run as a limited account.'},
{svg:prox},
{code:`USE master;
CREATE CREDENTIAL FileCopyCred WITH IDENTITY = N'CONTOSO\\svc-filecopy', SECRET = N'<password>';

USE msdb;
EXEC dbo.sp_add_proxy @proxy_name = N'FileCopyProxy', @credential_name = N'FileCopyCred';
EXEC dbo.sp_grant_proxy_to_subsystem @proxy_name = N'FileCopyProxy', @subsystem_id = 3;   -- 3 = CmdExec
EXEC dbo.sp_grant_login_to_proxy @proxy_name = N'FileCopyProxy', @login_name = N'ETLUser';`},
{h:'Who can do what'},
{t:[['msdb role','Rights'],
['**SQLAgentUserRole**','Create and manage own jobs'],
['**SQLAgentReaderRole**','Also view all jobs and history'],
['**SQLAgentOperatorRole**','Also start and stop all jobs'],
['**sysadmin**','Everything, including any owner']]},
{note:'Jobs owned by a sysadmin run with that power. Own jobs with a service or dedicated login, and avoid personal accounts, so jobs do not break when people leave.'}],
src:[['Create a proxy',M.RD+'sql-server-agent/create-a-sql-server-agent-proxy'],['Configure a user to create and manage jobs',M.RD+'sql-server-agent/configure-a-user-to-create-and-manage-sql-server-agent-jobs']]};

/* ---------- 3: Job history and troubleshooting ---------- */
L['mss-ops:0:3']={blocks:[
{p:'Most Agent problems are found by reading **history**, the **step output** and the **error log** in that order.'},
{svg:tsh},
{code:`-- Last run of every job, with outcome
SELECT j.name, h.run_date, h.run_time, h.run_status, h.step_id, h.step_name, h.message
FROM   msdb.dbo.sysjobs j
JOIN   msdb.dbo.sysjobhistory h ON h.job_id = j.job_id
WHERE  h.run_status = 0                         -- failed
ORDER  BY h.instance_id DESC;`},
{t:[['run_status','Meaning'],
['0','Failed'],['1','Succeeded'],['2','Retry'],['3','Canceled'],['4','In progress']]},
{h:'Common causes'},
{ul:['**Login or permission** changed: job owner disabled, password expired, proxy rights.','**Path or share** unavailable at run time.','**Overlap**: a job started again before the earlier run finished.','**Dependency** failed earlier, such as a restore or ETL.','**History purge settings** too small, losing detail.']},
{note:'Increase job history limits if you lose runs too quickly, and write step output to a file or table for long steps.'}],
src:[['sysjobhistory',M.RD+'system-tables/dbo-sysjobhistory-transact-sql'],['Troubleshoot Agent jobs',M.SQL+'ssms/agent/monitor-job-activity']]};

/* ---------- 4: Multi-step jobs and error handling ---------- */
L['mss-ops:0:4']={blocks:[
{p:'Real jobs have several steps. Design each step to **fail clearly** and tell the job what to do next.'},
{svg:flow},
{h:'Step actions'},
{t:[['Setting','Options'],
['**On success**','Go to next step, quit with success, quit with failure, go to a step'],
['**On failure**','Quit with failure, go to a step (such as cleanup), retry attempts'],
['**Retry attempts and interval**','For transient errors such as locks or network']]},
{code:`-- A step script that fails loudly and cleanly
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRAN;
    EXEC dbo.LoadSales;
    EXEC dbo.ValidateSales;     -- THROWs if checks fail
  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  INSERT dbo.JobErrorLog (JobName, ErrorNumber, ErrorMessage, LoggedAt)
  VALUES (N'Nightly load', ERROR_NUMBER(), ERROR_MESSAGE(), SYSDATETIME());
  THROW;                        -- let the job step fail
END CATCH;`},
{note:'Do not swallow errors. A TRY/CATCH without THROW makes the step report success, and the job looks green while data is wrong.'}],
src:[['Define job steps',M.SQL+'ssms/agent/create-a-job-step'],['TRY...CATCH',M.TS+'language-elements/try-catch-transact-sql']]};

})();
