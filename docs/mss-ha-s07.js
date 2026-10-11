/* LearnSphere - SQL Server High Availability & DR, Section 07: Log Shipping.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const arch=M.dg(700,240,[
[10,10,230,110,'Primary server',1],[25,45,200,60,'Database SalesDB|log backup job',2],
[255,10,190,110,'Backup share',1],[270,55,160,50,'.trn files',0],
[460,10,230,110,'Secondary server',1],[475,45,200,60,'Copy job, restore job|STANDBY or NORECOVERY',2],
[10,135,680,45,'Optional monitor server records history and raises alerts when copy or restore falls behind',0],
[10,190,680,40,'The secondary is a delayed copy. A failover is a manual role change.',0]],
[[225,75,270,75],[430,80,475,75]]);

const cfg=M.dg(700,130,[
[10,25,130,60,'1. Full backup|restore on secondary|NORECOVERY',0],[160,25,130,60,'2. Backup job|every 15 min',2],[310,25,130,60,'3. Copy job|every 15 min',0],[460,25,100,60,'4. Restore job|with delay',2],[580,25,110,60,'5. Alerts|thresholds',0]],
[[140,55,160,55],[290,55,310,55],[440,55,460,55],[560,55,580,55]]);

const mon=M.dg(700,150,[
[10,25,200,70,'Backup threshold|no backup in 60 min|alert',0],[250,25,200,70,'Restore threshold|no restore in 45 min|alert',2],[490,25,200,70,'History|msdb log_shipping_*|tables and reports',0]],
[]);

const role=M.dg(700,200,[
[10,15,150,70,'1. Stop apps|or accept loss',0],[180,15,150,70,'2. Tail-log|backup, NORECOVERY',2],[350,15,150,70,'3. Restore remaining|logs on secondary',0],[520,15,170,70,'4. Recover|secondary online',2],
[10,110,680,75,'5. Redirect apps (DNS or connection strings), fix logins and jobs, then reverse log shipping for the new direction',0]],
[[160,50,180,50],[330,50,350,50],[500,50,520,50]]);

/* ---------- 0: Architecture ---------- */
L['mss-ha:6:0']={blocks:[
{p:'**Log shipping** automatically takes transaction log backups on a primary database, copies them to one or more secondary servers and restores them there. It is simple, robust and cheap, with a delay by design.'},
{svg:arch},
{h:'Three jobs'},
{t:[['Job','Where','What it does'],
['**Backup**','Primary','Takes log backups to a share, on a schedule'],
['**Copy**','Secondary','Copies the files to a local folder'],
['**Restore**','Secondary','Restores the logs in order, optionally with a delay']]},
{h:'Where it fits'},
{ul:['**DR to another site** where a small delay is acceptable.','**Delayed copy** that lets you recover from a user error before it reaches the secondary.','**Migration** with a short final cutover.','**Reporting** copy in STANDBY mode (read-only between restores).']},
{h:'Limits'},
{ul:['**Manual** failover and role change.','**Data loss** up to the time between log backups, plus unrestored logs.','Works at **database** level: logins, jobs and settings are your job.','Needs **FULL** or **BULK_LOGGED** recovery.']}],
src:[['About log shipping',M.SS+'log-shipping/about-log-shipping-sql-server'],['Log shipping tables and stored procedures',M.RD+'system-tables/log-shipping-tables-transact-sql']]};

/* ---------- 1: Configuring ---------- */
L['mss-ha:6:1']={blocks:[
{p:'Configure log shipping from SSMS (database Properties, **Transaction Log Shipping**) or with T-SQL. The wizard creates the jobs for you.'},
{svg:cfg},
{h:'Steps'},
{flow:['Take a **full backup** of the primary database','Restore it on the secondary **WITH NORECOVERY** (or STANDBY)','Configure the **backup job**: share, schedule, retention','Configure **copy** and **restore** jobs on the secondary: schedule, delay, mode','Optionally add a **monitor** server and set alert thresholds']},
{t:[['Setting','Choice'],
['**Backup schedule**','Every 5 to 15 minutes, matches RPO'],
['**Copy schedule**','Same as backup or a bit slower'],
['**Restore mode**','NORECOVERY for DR, STANDBY for read-only reporting'],
['**Restore delay**','0 for DR, 30 to 60 minutes as an error-recovery window'],
['**Backup share**','Reachable by both servers, enough space']]},
{note:'In STANDBY mode, users are disconnected during each restore, unless you choose to skip restores while users are connected. Plan around the schedule.'}],
src:[['Configure log shipping',M.SS+'log-shipping/configure-log-shipping-sql-server'],['sp_add_log_shipping_primary_database',M.RD+'system-stored-procedures/sp-add-log-shipping-primary-database-transact-sql']]};

/* ---------- 2: Monitoring ---------- */
L['mss-ha:6:2']={blocks:[
{p:'Log shipping fails quietly: a job stops and nobody notices until the day you need the secondary. Set **thresholds** and **alerts**.'},
{svg:mon},
{code:`-- On the primary
SELECT primary_database, last_backup_date, last_backup_file, backup_threshold
FROM   msdb.dbo.log_shipping_monitor_primary;

-- On the secondary
SELECT secondary_database, last_copied_date, last_restored_date, last_restored_latency,
       restore_threshold
FROM   msdb.dbo.log_shipping_monitor_secondary;

-- Built-in summary
EXEC sp_help_log_shipping_monitor;`},
{h:'What to alert on'},
{ul:['**Backup threshold** exceeded: no log backup in the expected time.','**Restore threshold** exceeded: secondary is falling behind.','**Job failures** and a growing backup folder.','**Disk space** on the share and the secondary.']},
{note:'Also test restore regularly. A restored log chain that has a gap stops silently when a file is missing.'}],
src:[['Monitor log shipping',M.SS+'log-shipping/monitor-log-shipping-transact-sql'],['sp_help_log_shipping_monitor',M.RD+'system-stored-procedures/sp-help-log-shipping-monitor-transact-sql']]};

/* ---------- 3: Failover and role change ---------- */
L['mss-ha:6:3']={blocks:[
{p:'A **role change** makes the secondary the new primary. There is no automatic switch, so a written, rehearsed procedure matters.'},
{svg:role},
{code:`-- On the old primary (if reachable): back up the tail and leave it restoring
BACKUP LOG SalesDB TO DISK = N'\\\\share\\sql\\SalesDB_tail.trn' WITH NORECOVERY;

-- On the secondary: restore any logs not yet applied, then the tail, then recover
RESTORE LOG SalesDB FROM DISK = N'\\\\share\\sql\\SalesDB_tail.trn' WITH NORECOVERY;
RESTORE DATABASE SalesDB WITH RECOVERY;`},
{h:'Things log shipping does not move'},
{ul:['**Logins** and permissions (orphaned users).','**Agent jobs**, linked servers, credentials, server settings.','**Connection strings** and DNS aliases.']},
{h:'Going back'},
{p:'To fail back, either **reverse** log shipping from the new primary to the old one, or rebuild by restoring a new full backup. Plan the downtime for it.'},
{note:'If the primary is lost and the tail cannot be backed up, accept the data loss up to the last copied log and recover from there.'}],
src:[['Fail over to a log shipping secondary',M.SS+'log-shipping/fail-over-to-a-log-shipping-secondary-sql-server'],['Change roles',M.SS+'log-shipping/change-roles-between-primary-and-secondary-log-shipping-servers-sql-server']]};

})();
