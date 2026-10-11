/* LearnSphere - SQL Server Operations, Monitoring & Automation quiz, Section 2: Automation with PowerShell.
   Format: see pg-quiz.js. window.QUIZZES['mss-ops:1']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-ops:1']={qs:[
{q:'Which cmdlet **runs a query** from the SqlServer module?',
 o:['Invoke-Sqlcmd','Run-Sql','Start-SqlQuery','Get-Query'],
 a:0,why:'Invoke-Sqlcmd executes T-SQL and returns objects.',lec:0},
{q:'What is a benefit of PowerShell over GUI work?',
 o:['Repeatable, many servers at once, objects not text','Slower','No logging','Needs no permissions'],
 a:0,why:'Scripts are repeatable and scale to many servers.',lec:0},
{q:'What is **dbatools**?',
 o:['An open-source PowerShell module with many DBA commands','A Microsoft sold product','A backup format','A Windows service'],
 a:0,why:'dbatools is a community module widely used in DBA automation.',lec:1},
{q:'Which command **restores backups to prove they work**?',
 o:['Test-DbaLastBackup','Get-Backup','Check-Backup','Verify-Sql'],
 a:0,why:'It restores the latest backups to a destination and runs checks.',lec:1},
{q:'What should a good automation script do on **failure**?',
 o:['Log and return a non-zero exit status','Hide the error','Continue silently','Delete logs'],
 a:0,why:'Clear failure status lets schedulers and people see problems.',lec:2},
{q:'Where can PowerShell scripts run **without SQL Server Agent**?',
 o:['Task Scheduler or cron','Only SSMS','Only Azure','Nowhere'],
 a:0,why:'Any scheduler can run the script, including an automation platform.',lec:2},
{q:'What should **never** be committed to source control?',
 o:['Passwords and secrets','Scripts','Documentation','Runbooks'],
 a:0,why:'Secrets belong in a vault or pipeline secret store.',lec:3},
{q:'What does **idempotent** mean for a deployment script?',
 o:['It is safe to run repeatedly','It runs once only','It needs a restart','It deletes data'],
 a:0,why:'Idempotent scripts reach the same state however many times they run.',lec:3}
]};
