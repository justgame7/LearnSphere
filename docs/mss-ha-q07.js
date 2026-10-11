/* LearnSphere - SQL Server High Availability & DR quiz, Section 7: Log Shipping.
   Format: see pg-quiz.js. window.QUIZZES['mss-ha:6']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-ha:6']={qs:[
{q:'Which are the three **log shipping jobs**?',
 o:['Backup, copy, restore','Create, alter, drop','Check, repair, shrink','Seed, join, failover'],
 a:0,why:'Backup runs on the primary. Copy and restore run on the secondary.',lec:0},
{q:'What is the main **limit** of log shipping?',
 o:['Failover is manual and data loss up to the shipping interval','It needs a cluster','It needs Enterprise','It cannot be monitored'],
 a:0,why:'Role change is manual, and log not yet shipped is lost.',lec:0},
{q:'How do you initialize a log shipping **secondary**?',
 o:['Restore a full backup WITH NORECOVERY or STANDBY','Create an empty database','Copy the .mdf while running','Attach the log only'],
 a:0,why:'The secondary starts from a restored full backup, then logs are applied.',lec:1},
{q:'What is a **restore delay** useful for?',
 o:['A window to recover from user errors before they reach the secondary','Faster backups','Smaller logs','Authentication'],
 a:0,why:'A delay lets you stop log restores before a mistake is applied.',lec:1},
{q:'Which restore mode allows **read-only access** between restores?',
 o:['STANDBY','NORECOVERY','RECOVERY','REPLACE'],
 a:0,why:'STANDBY keeps the database readable, with users disconnected during each restore.',
 lec:1},
{q:'Where is log shipping **history** stored?',
 o:['msdb log_shipping tables','master','model','tempdb'],
 a:0,why:'msdb has log_shipping_monitor_primary and secondary tables.',lec:2},
{q:'Which alert tells you the secondary is **falling behind**?',
 o:['Restore threshold exceeded','Backup success','CPU high','Memory low'],
 a:0,why:'The restore threshold fires when no restore happened within the set time.',lec:2},
{q:'What is the **first step** of a role change if the primary is reachable?',
 o:['Back up the tail of the log WITH NORECOVERY','Drop the primary database','Restart the secondary','Disable backups'],
 a:0,why:'Capturing the tail avoids data loss and leaves the old primary restoring.',lec:3},
{q:'Which objects does log shipping **not** move?',
 o:['Logins and jobs','Database data','Log records','Table schemas'],
 a:0,why:'Server-level objects must be created on the secondary separately.',lec:3}
]};
