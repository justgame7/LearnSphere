/* LearnSphere - Oracle Core DBA, Section 15: Production Readiness & Capstone.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const pillars=O.dg(700,210,[
[10,15,105,60,'Standards|naming, layout,|parameters',0],[125,15,105,60,'Storage|space, redo,|archiving',0],[240,15,105,60,'Security|users, profiles,|listener',0],[355,15,105,60,'Recovery|backup and|restore test',2],[470,15,105,60,'Monitoring|alerts and|routines',0],[585,15,105,60,'Documents|runbooks and|change process',0],
[10,100,680,95,'Production ready = every pillar checked and written down. A failed check means no go-live, not "we will fix it later".',1]],[]);

const build=O.dg(700,110,[
[10,25,105,60,'1 Host|prepare OS',0],[130,25,105,60,'2 Software|install, patch',0],[250,25,105,60,'3 CDB|run DBCA',2],[370,25,105,60,'4 Harden|users, profiles',0],[490,25,105,60,'5 Protect|archive, FRA',2],[610,25,80,60,'6 Prove|checklist',2]],
[[115,55,130,55],[235,55,250,55],[355,55,370,55],[475,55,490,55],[595,55,610,55]]);

/* ---------- 0: Checklist ---------- */
L['ora-core:14:0']={blocks:[
{p:'A database is **production ready** when it is safe to run real business data on it. A checklist makes this objective: each item is either done and proven, or it is not.'},
{svg:pillars},
{h:'The checklist'},
{t:[['Area','Check','How to verify'],
['**Platform**','Certified OS, kernel settings, time sync','Preinstall package, `chronyc tracking`'],
['**Software**','Latest Release Update applied, one home per version','`opatch lspatches`, `DBA_REGISTRY_SQLPATCH`'],
['**Database**','CDB with PDBs, AL32UTF8, correct block size','`V$DATABASE`, `V$PDBS`, `NLS_DATABASE_PARAMETERS`'],
['**Storage**','Tablespaces per application, AUTOEXTEND with MAXSIZE, temp and undo sized','`DBA_TABLESPACE_USAGE_METRICS`'],
['**Redo and control**','Redo multiplexed and sized, control files multiplexed','`V$LOG`, `V$LOGFILE`, `V$CONTROLFILE`'],
['**Recovery**','ARCHIVELOG, FRA sized, backups scheduled **and a restore tested**','`V$DATABASE.LOG_MODE`, RMAN reports'],
['**Security**','No default passwords, named accounts, least privilege, hardened listener','`DBA_USERS_WITH_DEFPWD`, role checks'],
['**Monitoring**','Availability, space and failures alert a person','Alert test'],
['**Operations**','Runbooks, contacts, change process','Documents exist and are current']]},
{h:'Two examples of proof'},
{code:`-- Default passwords still in use?
SELECT username FROM dba_users_with_defpwd;

-- Is the database recoverable in principle?
SELECT log_mode, force_logging FROM v$database;

-- Is the patch level recorded?
SELECT patch_id, description, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 3 ROWS ONLY;`},
{flow:['Walk through every checklist item','Record evidence for each: output, screenshot or script result','Fix failures and re-check','Review with a second DBA','Go-live only when every item is green']},
{note:'A backup you have never restored is a hope, not a backup. Make "restore tested" a required line on the checklist.'}],
src:[['Oracle Database Administrator Guide',O.AD],['Database Security Guide',D+'dbseg/']]};

/* ---------- 1: Standards ---------- */
L['ora-core:14:1']={blocks:[
{p:'**Standards** make every database look the same, so anyone on the team can find things and fix them. They cover names, folders and parameters.'},
{h:'Naming'},
{t:[['Object','Pattern','Example'],
['**CDB**','`<site><env><nn>`','`LONPRD01`'],
['**PDB**','`<app>_<env>`','`SHOP_PRD`'],
['**Tablespace**','`<APP>_<DATA|IDX|LOB>`','`SHOP_DATA`, `SHOP_IDX`'],
['**Schema owner**','`<APP>`','`SHOP`'],
['**Application user**','`<APP>_APP`','`SHOP_APP`'],
['**Common admin user**','`C##<role>_<person>`','`C##DBA_ALICE`'],
['**Service**','`<app>_svc`','`shop_svc`']]},
{h:'Standard layout (OFA)'},
{code:`/u01/app/oracle/product/<version>/dbhome_<n>    ORACLE_HOME (one per version)
/u02/oradata/<CDB>/                             datafiles
/u03/fast_recovery_area/<CDB>/                  FRA: backups and archive logs
/u04/redo/<CDB>/                                online redo, second members`},
{h:'A parameter baseline'},
{p:'These are **starting points**. Test them on your workload.'},
{t:[['Parameter','Typical baseline','Why'],
['`COMPATIBLE`','The release in use','Set deliberately, never lowered'],
['`PROCESSES`','Sized from connection needs','Leave headroom'],
['`OPEN_CURSORS`','300 to 1000','Avoids ORA-01000'],
['`UNDO_RETENTION`','At least the longest query','Avoids ORA-01555'],
['`DB_RECOVERY_FILE_DEST_SIZE`','Sized for backups plus archive logs','Avoids a stuck archiver'],
['`REMOTE_LOGIN_PASSWORDFILE`','`EXCLUSIVE`','Named admin accounts'],
['`SGA_TARGET` / `PGA_AGGREGATE_TARGET`','Sized from RAM, with HugePages','Predictable memory'],
['`CONTROL_MANAGEMENT_PACK_ACCESS`','`NONE` unless licensed','Avoids unlicensed use']]},
{code:`-- Show what differs from the defaults
SELECT name, value FROM v$parameter WHERE isdefault = 'FALSE' ORDER BY name;`},
{flow:['Write the standard once and keep it in version control','Use it in DBCA templates and scripts','Compare every database against it with a query','Record approved exceptions with a reason']},
{note:'A standard no one follows is worse than none. Make the standard the easy path by putting it into the build scripts.'}],
src:[['Optimal Flexible Architecture',D+'ladbi/'],['Initialization parameters',O.RF+'initialization-parameters.html']]};

/* ---------- 2: Security, backup, patching baselines ---------- */
L['ora-core:14:2']={blocks:[
{p:'Three baselines protect the data and the business: **security**, **backup** and **patching**. Decide each one before go-live, not after an incident.'},
{h:'Security baseline'},
{t:[['Control','Baseline'],
['**Passwords**','No default passwords. Strong profile with lockout and verify function.'],
['**Accounts**','Named admin accounts. Unused accounts locked or dropped. Schema owners with NO AUTHENTICATION.'],
['**Privileges**','Roles per application. No DBA or ANY privileges for applications.'],
['**Admin access**','SYSBACKUP for backups. SYSDBA limited and audited.'],
['**Listener**','Valid node checking, admin restrictions, port closed to the internet.'],
['**Auditing**','Unified auditing with a baseline policy. Review regularly.'],
['**Encryption**','Plan TLS for the network and TDE for sensitive data (Security sub-course).']]},
{code:`SELECT username FROM dba_users_with_defpwd;
SELECT grantee FROM dba_role_privs WHERE granted_role = 'DBA';
SELECT username, account_status, profile FROM dba_users WHERE oracle_maintained = 'N';`},
{h:'Backup baseline'},
{t:[['Item','Baseline'],
['**Mode**','ARCHIVELOG with FORCE LOGGING'],
['**Backups**','A weekly full (level 0), daily incrementals, frequent archive log backups'],
['**Control file**','Autobackup on'],
['**Retention**','A written recovery window, for example 14 days'],
['**Copies**','A second copy off the server or site'],
['**Proof**','A full restore test at least every quarter']]},
{p:'The RMAN commands are the subject of the Backup, Recovery and Flashback sub-course. For now, make sure the plan exists, is written down and is tested.'},
{h:'Patching baseline'},
{t:[['Item','Baseline'],
['**Cadence**','Apply each quarterly Release Update after testing'],
['**Test first**','On a copy of production'],
['**Out-of-cycle**','Critical security alerts handled within an agreed time'],
['**Method**','Prefer out-of-place patching with a new home'],
['**Record**','Patch level in the system sheet, from `opatch lspatches` and `DBA_REGISTRY_SQLPATCH`']]},
{flow:['A new Release Update is published','Apply it to a test copy','Run the application tests','Schedule the change window','Patch production and record the result']},
{note:'Write the three baselines as short documents. During an audit or an incident you will be asked what your standard is.'}],
src:[['Database Security Guide',D+'dbseg/'],['Backup and Recovery User Guide',D+'bradv/']]};

/* ---------- 3: Monitoring baseline ---------- */
L['ora-core:14:3']={blocks:[
{p:'Monitoring answers "is it working, and will it keep working?". Pick a small set of checks, set thresholds, and make sure each alert reaches a person who knows what to do.'},
{h:'The baseline set'},
{t:[['Check','Source','Warning','Critical'],
['**Instance up and open**','`V$INSTANCE`','Any state change','Not OPEN'],
['**Listener up**','`lsnrctl status`','Slow reply','No reply'],
['**PDBs open**','`V$PDBS`','Not saved state','Application PDB MOUNTED'],
['**Tablespace usage**','`DBA_TABLESPACE_USAGE_METRICS`','85 percent','95 percent'],
['**FRA usage**','`V$RECOVERY_FILE_DEST`','80 percent','90 percent'],
['**Disk space**','`df -h`','80 percent','90 percent'],
['**Backup result**','RMAN or job output','Late','Failed or missing'],
['**Sessions and processes**','`V$RESOURCE_LIMIT`','80 percent of limit','95 percent of limit'],
['**Blocking sessions**','`V$SESSION`','Over 5 minutes','Over 15 minutes'],
['**Scheduler jobs**','`DBA_SCHEDULER_JOB_RUN_DETAILS`','One failure','Repeated failures'],
['**Alert log errors**','`ORA-` in the alert log','Any new ORA-','ORA-00600, ORA-07445']]},
{code:`#!/bin/bash
# Minimal morning check, run from cron, mail on errors
export ORACLE_SID=ORCL ORACLE_HOME=/u01/app/oracle/product/19.0.0/dbhome_1
OUT=$(sqlplus -s / as sysdba <<'EOF'
SET HEADING OFF FEEDBACK OFF
SELECT 'TS ' || tablespace_name || ' ' || ROUND(used_percent) FROM dba_tablespace_usage_metrics WHERE used_percent > 85;
SELECT 'PDB ' || name || ' ' || open_mode FROM v$pdbs WHERE open_mode NOT IN ('READ WRITE','READ ONLY');
EOF
)
[ -n "$OUT" ] && echo "$OUT" | mail -s "DB check: attention" dba-team@example.com`},
{flow:['A check runs on a schedule or continuously','It compares the value with the thresholds','A warning goes to the team mailbox, a critical goes to on-call','The responder follows the runbook','The alert is closed with a note']},
{h:'Avoid alert noise'},
{ul:['Alert only on things that need action.','Give every alert an owner and a runbook line.','Review alerts monthly and remove those that were ignored.']},
{note:'AWR needs the Diagnostics Pack. If you are not licensed, use Statspack for a performance baseline, and keep long-term trends of space, sessions and waits in your monitoring tool.'}],
src:[['Monitoring the database',O.AD+'monitoring-the-operation-of-your-database.html']]};

/* ---------- 4: Documentation and change ---------- */
L['ora-core:14:4']={blocks:[
{p:'At three in the morning, nobody remembers how the database was built. **Documentation** and **runbooks** remember for you. **Change management** makes sure nothing changes without a record and a way back.'},
{h:'The system sheet (one page per database)'},
{t:[['Field','Example'],
['Name, role, environment','`LONPRD01`, production'],
['Host, OS, Oracle version and patch level','`dbhost01`, OL 8, 19.25'],
['PDBs and services','`SHOP_PRD`, `shop_svc`'],
['Storage layout and sizes','`/u02`, `/u03`, `/u04`'],
['Backup method, schedule, retention, location','Weekly level 0, daily level 1, 14 days'],
['Standby or DR','None or Data Guard to site B'],
['Owners and contacts','Application owner, DBA team, on-call']]},
{h:'Runbooks'},
{p:'A **runbook** is a short step-by-step procedure for a task or incident. Write them for a tired person, with exact commands.'},
{t:[['Runbook','Content'],
['Start and stop','Commands, order, checks'],
['Restore and recovery','Where backups are, commands, expected time'],
['Add space','Check, add datafile, verify'],
['Unlock or reset a user','Approval, commands, notify'],
['Listener or PDB not available','Checks from this course, fix, escalation']]},
{h:'Change management'},
{t:[['Step','What you record'],
['**Request**','What, why, who asked'],
['**Risk and impact**','What could go wrong, who is affected'],
['**Plan and rollback**','Exact steps and how to undo them'],
['**Test**','Result on a copy'],
['**Approval and window**','Who approved, when'],
['**Execute and verify**','Checks after the change'],
['**Close**','Outcome and lessons']]},
{flow:['Request raised and assessed','Plan, rollback and test','Approval and window','Backup, change and verify','Update the system sheet and close']},
{note:'Keep scripts and runbooks in version control, with dates. A document that is out of date is dangerous because people trust it.'}],
src:[['Oracle Database Administrator Guide',O.AD]]};

/* ---------- 5: Routines ---------- */
L['ora-core:14:5']={blocks:[
{p:'A DBA life is a set of routines. Doing them every time catches problems while they are small.'},
{h:'Daily (15 minutes)'},
{t:[['Check','How'],
['Instance, listener, PDBs up','`V$INSTANCE`, `lsnrctl status`, `V$PDBS`'],
['Backups of last night succeeded','Backup log or job status'],
['Tablespace and FRA space','Usage views'],
['New errors in the alert log','`grep ORA- alert.log` since yesterday'],
['Failed jobs','`DBA_SCHEDULER_JOB_RUN_DETAILS`'],
['Blocking sessions','`V$SESSION`'],
['Standby lag (if any)','Data Guard views']]},
{h:'Weekly'},
{t:[['Check','How'],
['Growth trend of data, redo and archive','Space history, archive log counts'],
['Invalid objects','`DBA_OBJECTS`'],
['Statistics freshness on key tables','`DBA_TAB_STATISTICS`'],
['Security events and account changes','Audit trail, `DBA_USERS`'],
['Top SQL and waits','Statspack, or AWR if licensed']]},
{h:'Monthly and quarterly'},
{t:[['Task','Frequency'],
['Restore test of a backup','Monthly or at least quarterly'],
['Release Update plan, test and apply','Quarterly'],
['Capacity report and forecast','Monthly'],
['User and privilege review','Quarterly'],
['DR or failover test (if you have a standby)','Twice a year'],
['Licence usage check (`DBA_FEATURE_USAGE_STATISTICS`)','Twice a year']]},
{code:`-- A compact daily health query
SELECT 'instance'   AS item, status AS value FROM v$instance
UNION ALL SELECT 'log_mode', log_mode FROM v$database
UNION ALL SELECT 'pdb ' || name, open_mode FROM v$pdbs
UNION ALL SELECT 'ts>85% ' || tablespace_name, TO_CHAR(ROUND(used_percent)) FROM dba_tablespace_usage_metrics WHERE used_percent > 85;`},
{flow:['Run the daily checks','Record anything abnormal','Fix small things now','Raise a change for bigger ones','Review the weekly and monthly lists']},
{note:'Automate the checks, but still read the results. A green dashboard that nobody opens catches nothing.'}],
src:[['Oracle Database Administrator Guide',O.AD]]};

/* ---------- 6: Capstone ---------- */
L['ora-core:14:6']={blocks:[
{p:'**Capstone.** You build a production-ready container database from scratch and prove it with the checklist. This ties together everything from sections 1 to 14. Take your time and keep notes, because the notes are your deliverable.'},
{svg:build},
{h:'The specification'},
{t:[['Requirement','Detail'],
['Platform','Oracle Linux VM, 19c Enterprise Edition (or the Free container where noted)'],
['Database','CDB named `LABPRD01`, one PDB `SHOP_PRD`, AL32UTF8'],
['Storage','`SHOP_DATA` and `SHOP_IDX` with AUTOEXTEND and MAXSIZE, undo and temp sized'],
['Recovery','ARCHIVELOG, FORCE LOGGING, FRA, redo multiplexed, control files multiplexed'],
['Security','Profile, named admin account, schema owner with NO AUTHENTICATION, app and report users with roles'],
['Operations','Scheduler job for statistics, a daily check script, a resource plan, a runbook']]},
{h:'Build steps'},
{flow:['Prepare the host and install the software (sections 2 and 4)','Create the CDB and PDB, set parameters (sections 4, 5 and 9)','Create tablespaces, users and roles (sections 7 and 10)','Enable ARCHIVELOG, FRA, multiplexing (section 8)','Add job, resource plan and alerts (section 13)','Take a Data Pump export and a control file backup (sections 8 and 12)','Document and run the readiness checklist (section 15)']},
{h:'Acceptance criteria'},
{t:[['Test','Pass condition'],
['`SELECT log_mode, force_logging FROM v$database;`','`ARCHIVELOG` and `YES`'],
['`SELECT name, open_mode FROM v$pdbs;`','`SHOP_PRD` is READ WRITE and survives a CDB restart'],
['`SELECT COUNT(*) FROM v$log;` and members','At least 3 groups, 2 members each'],
['`SELECT name FROM v$controlfile;`','At least 2 copies'],
['`SELECT username FROM dba_users_with_defpwd;`','No rows'],
['Scheduler job run details','A successful run'],
['Reboot test','Instance, listener and PDB come up unaided'],
['Runbook and system sheet','Present and correct']]},
{h:'Self-assessment'},
{t:[['Level','Meaning'],
['**Foundation**','Everything works. You can explain what each step did.'],
['**Solid**','You also broke something on purpose and diagnosed it with the method.'],
['**Ready**','Another person can run the database from your runbook, without you.']]},
{note:'When you finish, you are ready for the next sub-course. Backup, Recovery and Flashback is the best next step, because you now have a database worth protecting.'}],
src:[['Oracle Database Administrator Guide',O.AD],['Oracle Database 19c documentation',D]]};

})();
