/* LearnSphere - SQL Server Upgrade, Patching & Migration, Section 03: Migration Methods.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const meth=M.dg(700,230,[
[10,10,680,210,'Choose the method by allowed downtime',1],
[30,50,200,55,'Backup and restore|downtime = last backup|plus restore',0],[250,50,200,55,'Log shipping|downtime = final log|and redirect',2],[470,50,200,55,'AG or distributed AG|seconds to minutes|more setup',2],
[30,125,200,55,'Detach and attach|downtime = copy time|no rollback safety',0],[250,125,200,55,'Replication|per-object, flexible|complex',0],[470,125,200,55,'Cloud link, DMS|see Azure section',0],
[30,190,640,22,'Test the chosen method with a full rehearsal and a timed cutover',0]],
[]);

const bkp=M.dg(700,150,[
[10,25,150,70,'Full backup|to shared storage|production runs',0],[180,25,150,70,'Restore on target|WITH NORECOVERY',2],[350,25,150,70,'Final diff and|log backups at cutover',0],[520,25,170,70,'RECOVERY,|redirect apps',2]],
[[160,60,180,60],[330,60,350,60],[500,60,520,60]]);

const ls=M.dg(700,170,[
[10,25,150,70,'Configure log|shipping to the|new server',0],[180,25,150,70,'Let it catch up|and monitor',0],[350,25,150,70,'Cutover:|stop apps, tail-log|backup, restore',2],[520,25,170,70,'Recover target,|redirect apps|keep old as fallback',2],
[10,115,680,40,'Downtime is the final log, plus the redirect. Good for large databases.',0]],
[[160,60,180,60],[330,60,350,60],[500,60,520,60]]);

const obj=M.dg(700,200,[
[10,15,680,170,'What is outside the databases',1],
[30,50,200,45,'Logins and passwords|SIDs',2],[250,50,200,45,'Agent jobs, schedules,|operators, alerts',0],[470,50,200,45,'Linked servers|credentials',0],
[30,110,200,45,'Server settings|sp_configure, trace flags',0],[250,110,200,45,'Certificates and keys|TDE, backup, TLS',2],[470,110,200,45,'Database Mail,|proxies, endpoints',0],
[30,160,640,22,'Inventory first, move second, verify third',0]],
[]);

const cut=M.dg(700,200,[
[10,15,150,70,'T-1 week|rehearse,|freeze changes',0],[180,15,150,70,'T-1 day|final checks,|communication',0],[350,15,150,70,'T0 cutover|run steps,|checkpoints',2],[520,15,170,70,'T+1|verify, monitor,|decide to keep',2],
[10,110,680,75,'Cutover plan: step, owner, expected time, check, and rollback point for each. Practice with the real timings.',0]],
[[160,50,180,50],[330,50,350,50],[500,50,520,50]]);

/* ---------- 0: Backup and restore ---------- */
L['mss-upg:2:0']={blocks:[
{p:'**Backup and restore** is the simplest and most reliable migration method. It works across versions, hardware and even platforms, with downtime that depends on how you sequence the backups.'},
{svg:meth},
{svg:bkp},
{h:'Two flavours'},
{t:[['Flavour','Downtime','Use'],
['**Single full backup**','The full backup, copy and restore time','Small databases, test, long window'],
['**Full, then differential and log at cutover**','Final differential plus logs, then restore and recover','Larger databases, short window']]},
{code:`-- Target: restore the full backup ahead of time, leave restoring
RESTORE DATABASE SalesDB FROM DISK = N'\\\\share\\SalesDB_full.bak' WITH NORECOVERY, STATS = 10;

-- Cutover: stop applications, take final log, restore, recover
RESTORE LOG SalesDB FROM DISK = N'\\\\share\\SalesDB_final.trn' WITH RECOVERY;`},
{note:'A restore to a newer version upgrades the database internally. You cannot restore it back to an older version, so keep the old database untouched as your rollback.'}],
src:[['Copy databases with backup and restore',M.RD+'databases/copy-databases-with-backup-and-restore'],['Restore a database',M.RD+'backup-restore/restore-a-database-backup-using-ssms']]};

/* ---------- 1: Log shipping cutover ---------- */
L['mss-upg:2:1']={blocks:[
{p:'**Log shipping** keeps a copy of the database on the new server up to date. At cutover only the last small piece of log must be moved, so downtime is short even for large databases.'},
{svg:ls},
{h:'Steps'},
{flow:['Set up log shipping from the old server to the new one (full backup, restore NORECOVERY, jobs)','Run it until the copy is current and monitor lag','At the window: stop applications and take a tail-log backup','Restore the tail on the new server WITH RECOVERY','Bring applications up against the new server, and keep the old server as fallback']},
{ul:['Prepare **logins, jobs and linked servers** on the target in advance.','Update **connection strings** or DNS alias for the switch.','Take a **new full backup** on the new server after cutover to start a fresh chain.']}],
src:[['Log shipping to upgrade',M.SS+'log-shipping/about-log-shipping-sql-server'],['Fail over to a log shipping secondary',M.SS+'log-shipping/fail-over-to-a-log-shipping-secondary-sql-server']]};

/* ---------- 2: Detach and attach ---------- */
L['mss-upg:2:2']={blocks:[
{p:'**Detach and attach** moves the data files themselves. It is simple, but it takes the database offline for the whole copy time, and it leaves you without a rollback if something goes wrong.'},
{code:`-- On the source
USE master;
ALTER DATABASE SalesDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
EXEC sp_detach_db @dbname = N'SalesDB', @skipchecks = 'false';
-- copy the .mdf, .ndf and .ldf files to the target

-- On the target
CREATE DATABASE SalesDB
  ON (FILENAME = N'D:\\SQLData\\SalesDB.mdf'),
     (FILENAME = N'D:\\SQLData\\SalesDB_d1.ndf'),
     (FILENAME = N'L:\\SQLLog\\SalesDB_log.ldf')
  FOR ATTACH;`},
{h:'Cautions'},
{ul:['**Take a backup first**. Once attached to a newer version, you cannot attach back to the old one.','Copy **all files** of the database, and keep the originals until verified.','The database is **unavailable** during the whole copy.','Permissions on the files must allow the SQL Server service account.']},
{t:[['Prefer','When'],
['Backup and restore','Almost always'],
['Detach and attach','Very large database on storage that can be re-presented to the new server, or when no backup space exists']]}],
src:[['Detach a database',M.RD+'databases/detach-a-database'],['Attach a database',M.RD+'databases/attach-a-database']]};

/* ---------- 3: Logins, jobs, linked servers ---------- */
L['mss-upg:2:3']={blocks:[
{p:'A database is only part of the system. **Logins, jobs, linked servers** and other server-level objects must move too, or applications will fail at the first connection.'},
{svg:obj},
{h:'How to move them'},
{t:[['Object','Method'],
['**Logins**','Script with the same SIDs and password hashes (dbatools Copy-DbaLogin, or Microsoft sp_help_revlogin pattern)'],
['**Server roles and permissions**','Script, then compare with source'],
['**Agent jobs, operators, alerts, proxies**','Script from SSMS or use a copy tool'],
['**Linked servers and credentials**','Script, re-enter secrets'],
['**Server settings**','Compare sp_configure output, set same values'],
['**Certificates and keys**','Backup and restore, protect the files'],
['**Database Mail, endpoints**','Script and test']]},
{code:`# dbatools example: copy logins with SIDs and passwords
Copy-DbaLogin -Source OLDSQL -Destination NEWSQL -Login appsvc, report_reader

# Orphaned users after the restore
Get-DbaDbOrphanUser -SqlInstance NEWSQL -Database SalesDB`},
{note:'Do this early and test it, not at 2 a.m. of the cutover. A comparison script for server-level objects is a good deliverable of the migration.'}],
src:[['Transfer logins and passwords',M.SS+'failover-clusters/troubleshoot-orphaned-users-sql-server'],['Manage metadata when making a database available',M.RD+'databases/manage-metadata-when-making-a-database-available-on-another-server']]};

/* ---------- 4: Cutover planning ---------- */
L['mss-upg:2:4']={blocks:[
{p:'The **cutover** is the moment applications move to the new platform. Plan it as a sequence of small, checked steps.'},
{svg:cut},
{h:'A cutover plan has'},
{ul:['**Steps** in order, with an **owner** and **expected duration** for each.','**Checkpoints**: a query or test that proves the step worked.','**Go and no-go** decision points, with criteria.','**Rollback** point and instructions, with timing.','**Communication**: who is told when.']},
{h:'Validation after cutover'},
{t:[['Check','How'],
['Data complete','Row counts or checksums on key tables'],
['Objects present','Compare schema, jobs, logins'],
['Applications work','Smoke tests and key business flows'],
['Performance','Compare to baseline: waits, Query Store, response times'],
['Backups and monitoring','New server in backup and alert systems']]},
{note:'Do a full rehearsal with the real data size at least once. Real timings, not estimates, decide whether the window is enough.'}],
src:[['Upgrade planning',M.SS+'install/plan-and-test-the-database-engine-upgrade-plan'],['Post-upgrade tasks',M.SS+'install/complete-the-database-engine-upgrade']]};

})();
