/* LearnSphere - SQL Server Upgrade and Migration Quick Reference (cheat sheet).
   window.QREF['mss-upg'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for SQL Server 2019 to 2022 and current Azure SQL; verify syntax against your build. Check build-specific behaviour in the release notes. */
window.QREF=window.QREF||{};
window.QREF['mss-upg']={title:'SQL Server Upgrade and Migration Quick Reference',blurb:'Checklist, build queries and fixes for patching, upgrading and migrating SQL Server, plus maps of approaches, methods and servicing.',hint:'side-by-side',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every SQL Server DBA should be able to explain about upgrades and migrations, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Servicing and patching'},
{acc:[
{t:'Cumulative updates and GDRs',s:'Two servicing branches.',
 a:'**CUs** include fixes and improvements and are released regularly. **GDRs** include only security fixes for instances that have not taken a CU. Once on the CU branch, stay on it.',
 w:'Mixing branches confuses the build chain.',
 c:`SELECT SERVERPROPERTY('ProductVersion'), SERVERPROPERTY('ProductLevel'), SERVERPROPERTY('ProductUpdateLevel');`,see:[0,0,'Cumulative updates, GDRs and builds']},
{t:'Build numbers',s:'Know what you are on.',
 a:'The build number identifies the exact CU or GDR. Compare with Microsoft\'s build lists to know how far behind you are and which fixes you have.',
 w:'Record the build in your inventory.',
 c:`SELECT @@VERSION;`,see:[0,1,'Finding build numbers and release notes']},
{t:'Patching a standalone instance',s:'Plan and verify.',
 a:'Back up system and user databases, read the release notes, install in a window, check the error log and validate applications. Keep the previous installer for rollback planning.',
 w:'Patching is not undone by uninstalling in all cases, so have restores ready.',
 c:`EXEC sp_readerrorlog 0, 1, 'Recovery';`,see:[0,2,'Patching a standalone instance']},
{t:'Rolling patching for AG and FCI',s:'Passive first.',
 a:'Patch secondary replicas (or passive nodes) first, fail over to a patched node, then patch the former primary. Applications see only the failover.',
 w:'Keep sync mode until the final failover.',
 c:`ALTER AVAILABILITY GROUP MyAG FAILOVER;`,see:[0,3,'Rolling patching for AG and FCI']},
{t:'Rollback planning',s:'Decide before you start.',
 a:'Know what rollback means: restore backups to another instance, fail back to the old primary, or uninstall the update. Test the plan on a copy.',
 w:'Rollback after databases are upgraded needs a restore on the old version.',
 c:`BACKUP DATABASE master TO DISK = N'X:\\bk\\master.bak';`,see:[0,4,'Rollback planning']}
]},

{h:'Upgrade strategy'},
{acc:[
{t:'In-place and side-by-side',s:'Two approaches.',
 a:'**In-place** upgrades the installed instance, which is simple but with harder rollback. **Side-by-side** installs a new instance and moves databases, which allows testing and easy rollback.',
 w:'Prefer side-by-side for production.',
 c:`SELECT SERVERPROPERTY('ProductMajorVersion');`,see:[1,0,'In-place vs side-by-side upgrades']},
{t:'Pre-upgrade assessment',s:'Find problems first.',
 a:'Data Migration Assistant and Database Experimentation Assistant find compatibility issues and compare workload behaviour on the old and new versions.',
 w:'Fix breaking changes before cutover.',
 c:`SELECT name, compatibility_level FROM sys.databases;`,see:[1,1,'Pre-upgrade assessment with Data Migration Assistant']},
{t:'Compatibility levels',s:'Behaviour control.',
 a:'A database keeps its compatibility level after restore on a newer version. Raise it after testing with Query Store, using the old level as a rollback.',
 w:'Do not raise the level and the version in one step.',
 c:`ALTER DATABASE MyDb SET COMPATIBILITY_LEVEL = 160;`,see:[1,2,'Compatibility levels and optimizer changes']},
{t:'Upgrade checklist',s:'Repeatable steps.',
 a:'Inventory, backups, assessment, test, change window, upgrade, validate, update statistics and compatibility, and monitor against the baseline.',
 w:'A checklist turns a risky event into a routine.',
 c:`EXEC sp_updatestats;`,see:[1,4,'Upgrade checklist and rollback']}
]},

{h:'Migration'},
{acc:[
{t:'Backup and restore migration',s:'The simplest method.',
 a:'Restore a full backup, optionally a differential, and logs to the new instance, then recover at cutover. Downtime is the final differential or log restore.',
 w:'Practise the restore to know the duration.',
 c:`RESTORE DATABASE MyDb FROM DISK = N'X:\\bk\\MyDb.bak' WITH NORECOVERY;`,see:[2,0,'Backup and restore migration']},
{t:'Log shipping cutover',s:'Minimal downtime.',
 a:'Keep the target in sync by log shipping, then take a tail backup, restore and recover during the window. Downtime is minutes.',
 w:'Validate before switching applications.',
 c:`BACKUP LOG MyDb TO DISK = N'X:\\bk\\tail.trn' WITH NORECOVERY;`,see:[2,1,'Log shipping cutover']},
{t:'Logins, jobs and linked servers',s:'What does not move with a database.',
 a:'Logins, Agent jobs, linked servers, credentials, server settings and certificates live outside the database and must be moved separately. Preserve login SIDs.',
 w:'Missing logins cause orphaned users.',
 c:`EXEC sp_help_revlogin;`,see:[2,3,'Moving logins, jobs and linked servers']},
{t:'Migrating to Azure',s:'Pick the target.',
 a:'Assess with Azure Migrate, then use Azure Database Migration Service for online or offline moves to Azure SQL Database, Managed Instance or SQL Server on Azure VMs. Managed Instance also supports log replay and link.',
 w:'The target choice drives the method.',
 c:`SELECT SERVERPROPERTY('EngineEdition');`,see:[3,1,'Azure Database Migration Service']},
{t:'Heterogeneous migration',s:'From other platforms.',
 a:'SQL Server Migration Assistant converts schema and data from Oracle, MySQL, Db2 and others, and reports what needs manual work.',
 w:'Budget for application changes, not only data.',
 c:`-- run SSMA project assessment report`,see:[4,2,'Migrating from Oracle with SSMA']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Three small maps of how the parts fit together: upgrade approaches, migration methods and the servicing model.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. Upgrade approaches'},
{map:{title:'Upgrade approach map',h:216,trace:'In-place or side-by-side',
 hint:'Tap any box, or press In-place or side-by-side to compare how rollback differs.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'old',x:126,y:24,w:200,h:56,c:'disk',t:'Old instance',s:'current version',d:'The running production instance.',why:'Back it up.',chk:`SELECT @@VERSION;`,see:[1,0,'In-place vs side-by-side upgrades']},
 {id:'inp',x:354,y:24,w:200,h:56,c:'warn',t:'In-place upgrade',s:'same host',d:'Upgrades the instance binaries and databases on the host.',why:'Rollback needs restores.',chk:`SELECT SERVERPROPERTY('ProductVersion');`,see:[1,0,'In-place vs side-by-side upgrades']},
 {id:'sbs',x:126,y:136,w:200,h:56,c:'proc',t:'Side-by-side',s:'new instance',d:'A new instance built next to the old one, then databases moved.',why:'Easy rollback.',chk:`RESTORE DATABASE MyDb FROM DISK = ... WITH NORECOVERY;`,see:[1,0,'In-place vs side-by-side upgrades']},
 {id:'rb',x:354,y:136,w:200,h:56,c:'mem',t:'Rollback path',s:'old stays available',d:'The old instance remains until sign-off.',why:'Keep it for a period.',chk:`SELECT name, state_desc FROM sys.databases;`,see:[1,4,'Upgrade checklist and rollback']}],
 steps:[
 {ids:['old','inp'],t:'1. In-place replaces the binaries on the same host.',w:'Simple.',s:'Downtime.',x:'Hard rollback.',c:`SELECT @@VERSION;`},
 {ids:['sbs','rb'],t:'2. Side-by-side builds a new instance and keeps the old for rollback.',w:'Safer.',s:'Cutover.',x:'More resources.',c:`SELECT name, compatibility_level FROM sys.databases;`}]}},

{h:'2. Migration methods'},
{map:{title:'Migration methods map',h:216,trace:'Pick a method by downtime',
 hint:'Tap any box, or press Pick a method by downtime to compare methods.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'br',x:126,y:24,w:200,h:56,c:'disk',t:'Backup and restore',s:'simple',d:'Full, differential and log restore.',why:'Downtime = last restore.',chk:`RESTORE DATABASE ...;`,see:[2,0,'Backup and restore migration']},
 {id:'ls',x:354,y:24,w:200,h:56,c:'proc',t:'Log shipping',s:'minutes of downtime',d:'Continuous log restore then tail backup at cutover.',why:'Needs same or older to newer.',chk:`SELECT * FROM msdb.dbo.log_shipping_monitor_secondary;`,see:[2,1,'Log shipping cutover']},
 {id:'dms',x:126,y:136,w:200,h:56,c:'ext',t:'Azure DMS',s:'to Azure',d:'Online or offline migration to Azure targets.',why:'Assess first.',chk:`az datamigration --help`,see:[3,1,'Azure Database Migration Service']},
 {id:'ssma',x:354,y:136,w:200,h:56,c:'ext',t:'SSMA',s:'from other DBs',d:'Converts schema and data from Oracle and others.',why:'Manual work remains.',chk:`-- SSMA assessment report`,see:[4,2,'Migrating from Oracle with SSMA']}],
 steps:[
 {ids:['br','ls'],t:'1. Backup and restore is simple, log shipping reduces downtime.',w:'Two on-premises options.',s:'Sync window.',x:'Large final restore.',c:`SELECT * FROM msdb.dbo.backupset;`},
 {ids:['dms','ssma'],t:'2. DMS and SSMA cover Azure and heterogeneous moves.',w:'Tool-supported.',s:'Assessment.',x:'Surprises in code.',c:`-- assessment`}]}},

{h:'3. Servicing model'},
{map:{title:'Servicing map',h:216,trace:'Which update path an instance is on',
 hint:'Tap any box, or press Which update path an instance is on to see the update branches.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'rtm',x:126,y:24,w:200,h:56,c:'disk',t:'RTM or service pack',s:'base',d:'The release baseline.',why:'Start of the build chain.',chk:`SELECT SERVERPROPERTY('ProductLevel');`,see:[0,0,'Cumulative updates, GDRs and builds']},
 {id:'cu',x:354,y:24,w:200,h:56,c:'proc',t:'Cumulative update',s:'CU branch',d:'Regular fixes and improvements. Once taken, later updates are CUs.',why:'Test, then apply.',chk:`SELECT SERVERPROPERTY('ProductUpdateLevel');`,see:[0,0,'Cumulative updates, GDRs and builds']},
 {id:'gdr',x:126,y:136,w:200,h:56,c:'warn',t:'GDR',s:'security only',d:'Security fixes for instances not on the CU branch.',why:'Do not mix.',chk:`SELECT SERVERPROPERTY('ProductUpdateReference');`,see:[0,0,'Cumulative updates, GDRs and builds']},
 {id:'bld',x:354,y:136,w:200,h:56,c:'mem',t:'Build number',s:'your position',d:'Identifies exactly what is installed.',why:'Record it.',chk:`SELECT SERVERPROPERTY('ProductVersion');`,see:[0,1,'Finding build numbers and release notes']}],
 steps:[
 {ids:['rtm','cu'],t:'1. From the base, a CU moves the instance to the CU branch.',w:'Regular fixes.',s:'CU level.',x:'Skipping updates.',c:`SELECT SERVERPROPERTY('ProductUpdateLevel');`},
 {ids:['gdr','bld'],t:'2. GDR gives security-only fixes, and the build number identifies the position.',w:'Know where you are.',s:'Build list.',x:'Mixed branches.',c:`SELECT @@VERSION;`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Three small maps of how something happens, step by step: a rolling patch, a cutover and moving objects outside the database.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Rolling patch of an Availability Group'},
{map:{title:'Rolling patch map',h:328,trace:'Patch with minimal downtime',
 hint:'Tap any box, or press Patch with minimal downtime to follow a rolling patch.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'bk',x:126,y:24,w:200,h:56,c:'disk',t:'Backups and checks',s:'before',d:'Back up and verify the AG is healthy.',why:'Check sync.',chk:`SELECT * FROM sys.dm_hadr_database_replica_states;`,see:[0,2,'Patching a standalone instance']},
 {id:'sec',x:354,y:24,w:200,h:56,c:'proc',t:'Patch secondary',s:'first',d:'Install the update on the secondary replicas.',why:'Data movement resumes.',chk:`SELECT synchronization_state_desc FROM sys.dm_hadr_database_replica_states;`,see:[0,3,'Rolling patching for AG and FCI']},
 {id:'fo',x:126,y:136,w:200,h:56,c:'proc',t:'Fail over',s:'to a patched replica',d:'A planned failover to a patched secondary.',why:'Short interruption.',chk:`ALTER AVAILABILITY GROUP MyAG FAILOVER;`,see:[0,3,'Rolling patching for AG and FCI']},
 {id:'pri',x:354,y:136,w:200,h:56,c:'proc',t:'Patch former primary',s:'last',d:'Update the former primary.',why:'Check the AG after.',chk:`SELECT @@VERSION;`,see:[0,3,'Rolling patching for AG and FCI']},
 {id:'rb',x:240,y:248,w:200,h:56,c:'warn',t:'Rollback plan',s:'ready',d:'Know what to do if a patched replica misbehaves.',why:'Keep old replica as an option.',chk:`BACKUP DATABASE ...;`,see:[0,4,'Rollback planning']}],
 steps:[
 {ids:['bk','sec'],t:'1. Verify health and patch the secondaries.',w:'No client impact.',s:'Order.',x:'Patching the primary first.',c:`SELECT * FROM sys.dm_hadr_availability_replica_states;`},
 {ids:['fo','pri'],t:'2. Fail over, then patch the former primary.',w:'Short outage.',s:'Failover.',x:'Unsynchronized failover.',c:`ALTER AVAILABILITY GROUP MyAG FAILOVER;`},
 {ids:['rb'],t:'3. Keep a rollback plan until validation is complete.',w:'Safety.',s:'Plan.',x:'No fallback.',c:`SELECT @@VERSION;`}]}},

{h:'2. Side-by-side migration cutover'},
{map:{title:'Cutover map',h:328,trace:'Move a database with little downtime',
 hint:'Tap any box, or press Move a database with little downtime to follow the cutover.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'asm',x:126,y:24,w:200,h:56,c:'mem',t:'Assess',s:'DMA',d:'Find compatibility issues and fix them.',why:'Before the window.',chk:`SELECT name, compatibility_level FROM sys.databases;`,see:[1,1,'Pre-upgrade assessment with Data Migration Assistant']},
 {id:'seed',x:354,y:24,w:200,h:56,c:'proc',t:'Seed target',s:'restore NORECOVERY',d:'Restore a full backup on the target with NORECOVERY.',why:'Practise timing.',chk:`RESTORE DATABASE MyDb FROM DISK = N'X:\\bk\\MyDb.bak' WITH NORECOVERY;`,see:[2,0,'Backup and restore migration']},
 {id:'syn',x:126,y:136,w:200,h:56,c:'proc',t:'Keep in sync',s:'log restores',d:'Apply log backups until the cutover.',why:'Automate.',chk:`RESTORE LOG MyDb FROM DISK = N'X:\\bk\\log.trn' WITH NORECOVERY;`,see:[2,1,'Log shipping cutover']},
 {id:'cut',x:354,y:136,w:200,h:56,c:'warn',t:'Cutover',s:'tail backup',d:'Stop writes, take a tail backup, restore and recover.',why:'Switch applications.',chk:`BACKUP LOG MyDb TO DISK = N'X:\\bk\\tail.trn' WITH NORECOVERY;`,see:[2,4,'Cutover planning and validation']},
 {id:'chk',x:240,y:248,w:200,h:56,c:'mem',t:'Validate',s:'logins, jobs, stats',d:'Move logins, jobs, update statistics and test.',why:'Run smoke tests.',chk:`EXEC sp_updatestats;`,see:[2,3,'Moving logins, jobs and linked servers']}],
 steps:[
 {ids:['asm','seed'],t:'1. Assess, then seed the target.',w:'Reduce risk.',s:'Backups.',x:'Missing compatibility fix.',c:`RESTORE HEADERONLY FROM DISK = N'X:\\bk\\MyDb.bak';`},
 {ids:['syn','cut'],t:'2. Keep it in sync and cut over with a tail backup.',w:'Minutes of downtime.',s:'Window.',x:'Writes continue.',c:`BACKUP LOG MyDb ... WITH NORECOVERY;`},
 {ids:['chk'],t:'3. Validate logins, jobs and performance.',w:'Complete the move.',s:'Checklist.',x:'Orphaned users.',c:`EXEC sp_change_users_login 'Report';`}]}},

{h:'3. What to move besides databases'},
{map:{title:'Outside-database map',h:216,trace:'Objects that live outside the database',
 hint:'Tap any box, or press Objects that live outside the database to follow what must be moved.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'lg',x:126,y:24,w:200,h:56,c:'ext',t:'Logins',s:'with SIDs',d:'Script logins with SIDs and password hashes.',why:'Prevents orphans.',chk:`EXEC sp_help_revlogin;`,see:[2,3,'Moving logins, jobs and linked servers']},
 {id:'jb',x:354,y:24,w:200,h:56,c:'ext',t:'Agent jobs',s:'msdb',d:'Script jobs, schedules, operators and alerts.',why:'Disable on the target until cutover.',chk:`SELECT name FROM msdb.dbo.sysjobs;`,see:[2,3,'Moving logins, jobs and linked servers']},
 {id:'ls',x:126,y:136,w:200,h:56,c:'ext',t:'Linked servers',s:'credentials',d:'Recreate with credentials.',why:'Test each.',chk:`SELECT name, data_source FROM sys.servers;`,see:[2,3,'Moving logins, jobs and linked servers']},
 {id:'cr',x:354,y:136,w:200,h:56,c:'ext',t:'Certificates and keys',s:'TDE, backups',d:'Move certificates used by TDE and backup encryption.',why:'Needed to restore.',chk:`SELECT name FROM sys.certificates;`,see:[2,3,'Moving logins, jobs and linked servers']}],
 steps:[
 {ids:['lg','jb'],t:'1. Move logins and jobs.',w:'Access and automation.',s:'Scripts.',x:'Jobs run twice.',c:`SELECT name FROM sys.server_principals;`},
 {ids:['ls','cr'],t:'2. Recreate linked servers and move certificates.',w:'Functionality.',s:'Credentials.',x:'Missing keys.',c:`SELECT name FROM sys.certificates;`}]}},

]},

{t:'Upgrade and migration checklist',d:'A step list for planning an upgrade or migration.',see:[[1,4,'Upgrade checklist and rollback'],[2,4,'Cutover planning and validation']],b:[
{t:[['Step','What to do'],['Inventory','Version, build, edition, features, jobs, linked servers, SSIS and SSRS use'],['Assess','Run Data Migration Assistant and review blockers and deprecated features'],['Test','Restore to a test instance and run workload with Query Store comparison'],['Back up','System and user databases, certificates, scripts for logins and jobs'],['Plan the cutover','Window, order, rollback decision point, owners'],['Execute','Upgrade or migrate and keep the old instance'],['Post-upgrade','Update statistics, set compatibility level, check jobs, logins and linked servers'],['Validate','Smoke tests, performance baseline, error log review'],['Close','Document the new build and retire the old instance after a hold period']]}
]},
{t:'Build and version queries',d:'Queries to identify what is installed and where it came from.',see:[[0,1,'Finding build numbers and release notes']],b:[
{t:[['Question','Query'],['Version and build','`SELECT @@VERSION;`'],['Major version','`SELECT SERVERPROPERTY(\'ProductMajorVersion\');`'],['CU or GDR','`SELECT SERVERPROPERTY(\'ProductUpdateLevel\'), SERVERPROPERTY(\'ProductUpdateReference\');`'],['Edition and engine','`SELECT SERVERPROPERTY(\'Edition\'), SERVERPROPERTY(\'EngineEdition\');`'],['Database compatibility','`SELECT name, compatibility_level FROM sys.databases;`'],['Install and patch history','SQL Server setup log summary and `Get-HotFix` for the OS']]}
]},
]};
