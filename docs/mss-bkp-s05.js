/* LearnSphere - SQL Server Backup, Restore & Recovery, Section 05: System Database Recovery.
   Lectures 0-4 are core, 5 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const sys=M.dg(700,200,[
[10,15,160,70,'master|logins, config|back up: yes',2],[190,15,160,70,'msdb|jobs, history|back up: yes',2],[370,15,160,70,'model|template|back up: yes',2],[550,15,140,70,'tempdb|rebuilt at start|back up: no',0],
[10,110,680,70,'Back up master and msdb at least daily, and master after every login, setting or database change.|Keep a scripted copy of server settings.',0]],
[]);

const mst=M.dg(700,150,[
[10,30,170,70,'1. Start in|single-user mode',2],[210,30,170,70,'2. Connect with one|sqlcmd session',0],[410,30,130,70,'3. RESTORE master|WITH REPLACE',2],[570,30,120,70,'4. Instance stops|start normally',0]],
[[180,65,210,65],[380,65,410,65],[540,65,570,65]]);

const msdb=M.dg(700,150,[
[10,30,160,70,'Stop SQL Server|Agent',0],[200,30,170,70,'RESTORE DATABASE|msdb',2],[400,30,140,70,'Start Agent|check jobs',0],[570,30,120,70,'Verify history|and schedules',0]],
[[170,65,200,65],[370,65,400,65],[540,65,570,65]]);

const tmp=M.dg(700,170,[
[10,25,200,70,'Instance will not start|tempdb path or drive|missing',2],[250,25,200,70,'Start with minimal|configuration|and trace flag 3608',0],[490,25,200,70,'ALTER DATABASE tempdb|MODIFY FILE to a|valid path, restart',2],
[10,115,680,40,'tempdb has no backup and needs none: it is rebuilt from model at every start',0]],
[[210,60,250,60],[450,60,490,60]]);

const reb=M.dg(700,170,[
[10,25,200,70,'Rebuild system|databases (Setup)|defaults restored',2],[250,25,200,70,'Restore master,|msdb and model|from backup',0],[490,25,200,70,'Attach or restore|user databases,|verify logins',0],
[10,115,680,40,'Last resort when master cannot be restored or the instance cannot start',0]],
[[210,60,250,60],[450,60,490,60]]);

/* ---------- 0: Backing up system databases ---------- */
L['mss-bkp:4:0']={blocks:[
{p:'System databases hold the instance itself: logins, jobs, settings. If you lose them, user databases may be fine but nobody can use them. Back them up like any production database.'},
{svg:sys},
{t:[['Database','Default recovery','Back up how often','Why'],
['**master**','SIMPLE (fixed)','Daily, plus after changes','Logins, endpoints, database list, settings'],
['**msdb**','SIMPLE (default)','Daily','Jobs, schedules, history, mail'],
['**model**','FULL (default)','After changes','Template for new databases'],
['**tempdb**','SIMPLE','Never: cannot be backed up','Rebuilt at start'],
['**Resource**','n/a','Copy the files with the binaries','Hidden system objects']]},
{code:`BACKUP DATABASE master TO DISK = 'E:\\Backup\\master.bak' WITH CHECKSUM, COMPRESSION;
BACKUP DATABASE msdb   TO DISK = 'E:\\Backup\\msdb.bak'   WITH CHECKSUM, COMPRESSION;
BACKUP DATABASE model  TO DISK = 'E:\\Backup\\model.bak'  WITH CHECKSUM, COMPRESSION;`},
{h:'Also keep'},
{ul:['A **script of server configuration**: sp_configure output, logins with SIDs and passwords hashes, linked servers, operators, alerts.','The **version and build** of the instance the backups came from.','The **service account** and file path layout.']},
{note:'A master backup can be restored only to an instance of the same version. Record the build number with every backup set.'}],
src:[['Back up and restore system databases',M.RD+'backup-restore/back-up-and-restore-of-system-databases-sql-server'],['System databases',M.RD+'databases/system-databases']]};

/* ---------- 1: Restoring master ---------- */
L['mss-bkp:4:1']={blocks:[
{p:'**master** is special: SQL Server cannot run user databases without it, and it cannot be restored while the instance is running in normal mode. You restore it in **single-user mode**.'},
{svg:mst},
{code:`REM Windows, from an elevated command prompt (default instance)
net stop MSSQLSERVER
net start MSSQLSERVER /m"SQLCMD"

REM Connect with sqlcmd in that one allowed connection
sqlcmd -S . -E

-- In sqlcmd
RESTORE DATABASE master FROM DISK = 'E:\\Backup\\master.bak' WITH REPLACE;
GO`},
{h:'After the restore'},
{ul:['The instance **shuts down** by itself. Start it normally.','Databases created since the backup are **not known** to master: attach them or restore them.','Logins and server settings made since the backup are **lost**: re-create them from your script.','Check **msdb** is online and the Agent jobs are present.']},
{note:'On Linux, start the engine with the single-user startup parameter instead and connect with sqlcmd. Use the documented procedure for your version, and practice it on a test server first.'}],
src:[['Restore the master database',M.RD+'backup-restore/restore-the-master-database-transact-sql'],['Start SQL Server in single-user mode',M.DE+'configure-windows/start-sql-server-in-single-user-mode']]};

/* ---------- 2: msdb and model ---------- */
L['mss-bkp:4:2']={blocks:[
{p:'**msdb** and **model** are restored like user databases, with a few extras. Both matter more than people expect: msdb holds your jobs, and model decides how tempdb and every new database are built.'},
{svg:msdb},
{h:'msdb'},
{code:`-- Stop SQL Server Agent first, then:
RESTORE DATABASE msdb FROM DISK = 'E:\\Backup\\msdb.bak' WITH REPLACE;

-- Start Agent, then check
SELECT name, enabled FROM msdb.dbo.sysjobs;`},
{ul:['SQL Server Agent holds msdb open, so **stop Agent** first.','You lose backup history, job history and Database Mail changes made since the backup.','If msdb is damaged and unrecoverable, you can rebuild it, but you lose all jobs.']},
{h:'model'},
{ul:['**model** is used to create tempdb at every start.','If model is damaged, the instance may fail to start because tempdb cannot be built.','The documented fix is to start with trace flag **3608** to avoid recovering model at startup, then restore it.']},
{note:'Keep scripts for jobs, operators and alerts in source control. They are quicker and more reliable than restoring an old msdb.'}],
src:[['Back up and restore system databases',M.RD+'backup-restore/back-up-and-restore-of-system-databases-sql-server'],['Restore the model database',M.RD+'backup-restore/restore-the-model-database']]};

/* ---------- 3: Lost tempdb ---------- */
L['mss-bkp:4:3']={blocks:[
{p:'**tempdb** has nothing to restore. It is recreated every time the instance starts. The failure you will see is the **drive or path for tempdb no longer exists**, so the instance cannot start.'},
{svg:tmp},
{flow:['Read the error log: it names the tempdb file path that failed','Start the instance with minimal configuration (-f) and trace flag 3608','Connect with sqlcmd and point tempdb files at a valid location','Restart the instance normally','Check file sizes and number of files']},
{code:`-- With the instance running in minimal configuration
ALTER DATABASE tempdb MODIFY FILE (NAME = tempdev, FILENAME = 'D:\\TempDB\\tempdb.mdf');
ALTER DATABASE tempdb MODIFY FILE (NAME = templog, FILENAME = 'D:\\TempDB\\templog.ldf');
-- repeat for every tempdb data file, then restart`},
{h:'Prevent it'},
{ul:['Put tempdb on a **volume that is always present** at service start.','If tempdb is on local ephemeral storage (cloud or SSD), make a start-up step that creates the folder before SQL Server starts.','Keep the tempdb layout in your **runbook**.']}],
src:[['tempdb database',M.RD+'databases/tempdb-database'],['Database Engine service startup options',M.DE+'configure-windows/database-engine-service-startup-options']]};

/* ---------- 4: Rebuilding ---------- */
L['mss-bkp:4:4']={blocks:[
{p:'If **master** cannot be restored, or the instance cannot start at all, the last resort is to **rebuild the system databases**. This recreates master, model, msdb and tempdb with defaults, then you restore the backups.'},
{svg:reb},
{code:`REM Windows: run Setup from the install media (example, default instance)
Setup.exe /QUIET /ACTION=REBUILDDATABASE /INSTANCENAME=MSSQLSERVER ^
  /SQLSYSADMINACCOUNTS="CONTOSO\\DBA-Admins" /SAPWD="<new-strong-password>" ^
  /SQLCOLLATION=SQL_Latin1_General_CP1_CI_AS`},
{h:'What a rebuild resets'},
{ul:['All **logins**, linked servers, server settings and jobs (they live in master and msdb).','The **collation** of the instance, if you pass a new one. Use the same as before unless you must change it.','**User databases are not touched**, but they are no longer registered: attach or restore them.']},
{h:'Recovery order'},
{flow:['Rebuild with Setup','Restore master (single-user mode) from backup','Restore msdb and model','Start Agent; check jobs and logins','Verify user databases are online; attach any that are missing','Run CHECKDB and a smoke test']},
{note:'Keep Setup media for the exact version and CU you run, and a copy of the service account and collation settings. Rebuild is a rehearsed procedure, not an improvisation.'}],
src:[['Rebuild system databases',M.RD+'databases/rebuild-system-databases'],['Install SQL Server from the command prompt',M.DE+'install-windows/install-sql-server-from-the-command-prompt']]};

})();
