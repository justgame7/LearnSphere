/* LearnSphere - Backup & Recovery, Section 04: Maintaining Backups & the Repository.
   Lectures 0-7 are core, 8+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const BR=O.D+'bradv/';

/* ---------- diagrams ---------- */
const life=O.dg(700,170,[
[10,50,130,70,'Backup created|AVAILABLE',2],
[190,50,130,70,'Missing on disk|EXPIRED|(after CROSSCHECK)',0],
[370,50,130,70,'Beyond retention|OBSOLETE|(REPORT OBSOLETE)',0],
[550,50,140,70,'Deleted|(DELETE OBSOLETE|or EXPIRED)',0]],
[[140,85,190,85],[320,85,370,85],[500,85,550,85]]);

/* ---------- 0: LIST and REPORT ---------- */
L['ora-bkp:3:0']={blocks:[
{p:'Two families of commands show your backups. **LIST** says what exists. **REPORT** says what is **needed** or **obsolete**.'},
{t:[['Command','Answers'],
['`LIST BACKUP SUMMARY;`','One line per backup set: tag, level, time'],
['`LIST BACKUP OF DATABASE;`','Detail of database backups'],
['`LIST ARCHIVELOG ALL;`','Archived logs on disk'],
['`LIST COPY OF DATAFILE 4;`','Image copies'],
['`REPORT SCHEMA;`','Current structure of the database'],
['`REPORT NEED BACKUP;`','Files that violate the retention policy'],
['`REPORT UNRECOVERABLE;`','Files with unlogged operations'],
['`REPORT OBSOLETE;`','Backups no longer needed by the policy']]},
{flow:['LIST to see what exists','REPORT NEED BACKUP to see what is missing','REPORT OBSOLETE to see what can go']},
{note:'`REPORT NEED BACKUP` is the quickest health check. Run it every day. An empty result means the policy is met.'}],
src:[['LIST and REPORT',BR]]};

/* ---------- 1: CROSSCHECK ---------- */
L['ora-bkp:3:1']={blocks:[
{p:'RMAN believes its repository. If someone removes a file from disk, the repository still says it exists. **CROSSCHECK** compares the repository with reality.'},
{svg:life},
{code:`CROSSCHECK BACKUP;
CROSSCHECK ARCHIVELOG ALL;
LIST EXPIRED BACKUP;
DELETE EXPIRED BACKUP;`},
{t:[['Status','Meaning'],
['**AVAILABLE**','Found and usable'],
['**EXPIRED**','Not found on the media'],
['**OBSOLETE**','Still exists but not needed by the retention policy'],
['**UNAVAILABLE**','Marked unusable by you']]},
{note:'Expired and obsolete are different. **Expired** = missing. **Obsolete** = unneeded. A common mistake is to treat them as the same.'}],
src:[['CROSSCHECK',BR]]};

/* ---------- 2: Retention ---------- */
L['ora-bkp:3:2']={blocks:[
{p:'The **retention policy** decides which backups are obsolete. `DELETE OBSOLETE` removes them.'},
{code:`CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 14 DAYS;
-- or
CONFIGURE RETENTION POLICY TO REDUNDANCY 2;

REPORT OBSOLETE;
DELETE OBSOLETE;
DELETE NOPROMPT OBSOLETE RECOVERY WINDOW OF 7 DAYS;   -- one time, different window`},
{t:[['Policy','Keeps'],
['**Recovery window N days**','The backups and logs needed to recover to any point in the last N days'],
['**Redundancy N**','The N most recent backups of each file'],
['**NONE**','Nothing is obsolete. You delete manually.']]},
{h:'Keep for long-term'},
{code:`BACKUP DATABASE KEEP UNTIL TIME \'SYSDATE+365\' TAG \'year_end\';
CHANGE BACKUP TAG \'year_end\' KEEP FOREVER;`},
{note:'A **KEEP** backup ignores the retention policy and is a self-contained archive. Use it for legal or year-end backups.'}],
src:[['Retention policies',BR]]};

/* ---------- 3: Archivelog deletion ---------- */
L['ora-bkp:3:3']={blocks:[
{p:'Archived logs fill the disk quickly. Delete them **only when they are safe to lose**: backed up, and applied on any standby.'},
{code:`CONFIGURE ARCHIVELOG DELETION POLICY TO BACKED UP 2 TIMES TO DISK;
-- with Data Guard
CONFIGURE ARCHIVELOG DELETION POLICY TO APPLIED ON ALL STANDBY;
-- both
CONFIGURE ARCHIVELOG DELETION POLICY TO BACKED UP 1 TIMES TO DISK
  APPLIED ON ALL STANDBY;`},
{t:[['Policy','Log deletable when'],
['`BACKED UP n TIMES`','It is backed up n times to the device'],
['`APPLIED ON ALL STANDBY`','Applied on all standby databases'],
['`SHIPPED TO ALL STANDBY`','Shipped to all standbys'],
['`NONE`','Never auto-deleted']]},
{h:'Manual cleanup'},
{code:`DELETE ARCHIVELOG ALL COMPLETED BEFORE \'SYSDATE-2\';
DELETE ARCHIVELOG UNTIL TIME \'SYSDATE-1\' BACKED UP 1 TIMES TO DISK;`},
{note:'Do not use `rm` on archived logs. The repository would still list them, and the FRA does not know they are gone.'}],
src:[['Archivelog deletion policy',BR]]};

/* ---------- 4: Restore validate and preview ---------- */
L['ora-bkp:3:4']={blocks:[
{p:'Before you need a restore, ask RMAN: **what would you use?**'},
{t:[['Command','What it does'],
['`RESTORE DATABASE PREVIEW;`','Lists the backups it would use. Reads nothing.'],
['`RESTORE DATABASE PREVIEW SUMMARY;`','Short form'],
['`RESTORE DATABASE VALIDATE;`','Reads those backups to check them'],
['`RESTORE ARCHIVELOG FROM SEQUENCE 100 VALIDATE;`','Checks the logs needed'],
['`RESTORE DATABASE UNTIL TIME \'...\' PREVIEW;`','Preview a point-in-time plan']]},
{flow:['PREVIEW: which backups and logs are needed?','VALIDATE: can they be read?','Fix gaps now: missing logs, expired pieces','Rehearse a real restore']},
{note:'A preview that lists a missing log tells you about a problem when you can still fix it, not at 3 a.m. during an incident.'}],
src:[['RESTORE PREVIEW and VALIDATE',BR]]};

/* ---------- 5: Scheduling ---------- */
L['ora-bkp:3:5']={blocks:[
{p:'Backups must run **without a person**. Pick one scheduler and make it reliable.'},
{t:[['Option','Good for','Notes'],
['**cron / Task Scheduler**','Simple, one host','Call a shell script that runs RMAN and logs the result'],
['**DBMS_SCHEDULER**','Inside the database','Job type EXECUTABLE or an RMAN script'],
['**Enterprise Manager**','Many databases','Central scheduling, notifications, history'],
['**Recovery Appliance / cloud service**','Managed backups','Policy driven']]},
{code:`# cron: nightly level 1, at 01:30
30 1 * * * /home/oracle/scripts/rman_l1.sh >> /var/log/rman_l1.log 2>&1

# rman_l1.sh
rman target / log=/backup/logs/l1_$(date +%F).log <<EOF
RUN { BACKUP INCREMENTAL LEVEL 1 DATABASE PLUS ARCHIVELOG DELETE INPUT; DELETE NOPROMPT OBSOLETE; }
EOF`},
{h:'Always'},
{ul:['Check the exit code, and alert on failure.','Log with a date, and keep the logs.','Do not run two backups for the same database at once.']},
{note:'A backup job that fails silently is worse than no job. Make the script alert someone on a non-zero exit code.'}],
src:[['Scheduling',BR]]};

/* ---------- 6: V$RMAN views ---------- */
L['ora-bkp:3:6']={blocks:[
{p:'RMAN records its history in views. Use them for monitoring and for dashboards.'},
{t:[['View','Shows'],
['`V$RMAN_STATUS`','Each RMAN command, its status and time'],
['`V$RMAN_BACKUP_JOB_DETAILS`','One row per backup job: start, end, size, status'],
['`V$BACKUP_SET`, `V$BACKUP_PIECE`','Sets and pieces'],
['`V$BACKUP_DATAFILE`','Datafile blocks per backup, including corruption'],
['`V$RMAN_OUTPUT`','Output of running jobs'],
['`V$SESSION_LONGOPS`','Progress of long running backup steps']]},
{code:`SELECT start_time, end_time, status, input_type,
       ROUND(output_bytes/1024/1024/1024,1) out_gb
FROM v$rman_backup_job_details
WHERE start_time > SYSDATE-7
ORDER BY start_time;`},
{h:'What to alert on'},
{ul:['A job with status FAILED or COMPLETED WITH WARNINGS.','No successful backup in the last 26 hours.','Archived log backup older than the RPO.']},
{note:'Monitor **absence** too. A missing job produces no error, so the alert is "no successful backup in N hours".'}],
src:[['RMAN views',D+'refrn/']]};

/* ---------- 7: Practical ---------- */
L['ora-bkp:3:7']={blocks:[
{p:'Prove that your backups are **restorable**, without touching production data.'},
{code:`rman target /

CROSSCHECK BACKUP;
CROSSCHECK ARCHIVELOG ALL;
REPORT NEED BACKUP;
REPORT OBSOLETE;
RESTORE DATABASE PREVIEW SUMMARY;
RESTORE DATABASE VALIDATE;
RESTORE ARCHIVELOG ALL VALIDATE;
BACKUP VALIDATE CHECK LOGICAL DATABASE;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['CROSSCHECK','No EXPIRED entries'],
['REPORT NEED BACKUP','Empty'],
['RESTORE PREVIEW','Lists the backup sets and logs it would use'],
['VALIDATE','No errors reported'],
['`V$DATABASE_BLOCK_CORRUPTION`','No rows']]},
{h:'Now break it a little'},
{ul:['Rename one archived log on disk. Run `CROSSCHECK ARCHIVELOG ALL`. What is its status?','Run `RESTORE DATABASE PREVIEW`. Does it warn about a missing log?','Put the file back and crosscheck again.']},
{note:'Write the commands as a weekly job. A report that says "backups are restorable" is only true on the day you checked.'}],
src:[['Validating backups',BR]]};

})();
