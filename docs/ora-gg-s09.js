/* LearnSphere - GoldenGate, Section 09: Monitoring, Troubleshooting & Operations.
   Lectures 0-6 are core, 7-10 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const trbl=O.dg(700,200,[
[10,40,130,70,'Process abended|or lag growing',0],[180,40,140,70,'Read the report|and discard file',2],[360,40,140,70,'Find the first error|(ORA- or OGG-)',2],[540,40,150,70,'Fix the cause|restart and verify',2],
[10,130,680,55,'Report: what happened. Discard: which rows were rejected. Database log: why it failed.',1]],
[[140,75,180,75],[320,75,360,75],[500,75,540,75]]);

/* ---------- 0: Dashboards and alerts ---------- */
L['ora-gg:8:0']={blocks:[
{p:'Replication that you do not watch will fail without notice. The Administration Service gives you **dashboards** and **alerts** to watch it.'},
{h:'What the dashboard shows'},
{t:[['Item','Meaning'],
['**Process status**','Running, stopped or abended, for every Extract, path and Replicat'],
['**Lag**','Current lag of each process'],
['**Checkpoint information**','Where each process is'],
['**Recent messages**','Warnings and errors from the process'],
['**Alerts**','Conditions you set, such as lag over a limit']]},
{h:'Commands'},
{code:`OGG> INFO ALL
OGG> INFO EXTRACT ext1, DETAIL
OGG> INFO REPLICAT rep1
OGG> LAG REPLICAT rep1
OGG> VIEW REPORT rep1`},
{h:'Alerts to set'},
{t:[['Alert','Threshold example'],
['Process not running','Any'],
['Lag','Above your RPO or a few minutes'],
['Discard records','More than zero (or a small number)'],
['Trail disk space','Over 80 percent'],
['Heartbeat missing','No update for several minutes']]},
{flow:['Open the dashboard daily','Define alerts for state, lag and discards','Send alerts to the team mailbox or tool','Review alerts and thresholds monthly']},
{note:'Add GoldenGate to your normal monitoring system. It should alert the same on-call people as your databases.'}],
src:[['Monitoring GoldenGate',O.GG]]};

/* ---------- 1: Reports, logs, discard ---------- */
L['ora-gg:8:1']={blocks:[
{p:'Three files tell you what a process did and why it failed.'},
{svg:trbl},
{t:[['File','What it holds','How to see it'],
['**Report file**','Start and stop messages, parameters, statistics, errors','`VIEW REPORT ext1`, or in the Web UI'],
['**Discard file**','Records that were rejected, with the reason','`VIEW DISCARD rep1` or the file in the `dirrpt` folder'],
['**Process error log (ggserr.log)**','A log of events for the deployment','In the deployment log folder'],
['**Database alert log**','Errors raised by the database for the capture or apply','Standard ADR location']]},
{code:`OGG> VIEW REPORT rep1
OGG> VIEW GGSEVT                 -- deployment event log
-- Database side: the alert log and the capture views
SELECT capture_name, status, error_message FROM dba_capture;`},
{h:'Read in this order'},
{flow:['The report file: what error stopped the process','The discard file: which row and why','The database alert log: the database reason','The trail or checkpoint: where in the stream']},
{note:'Report files rotate. When something fails, read them at once, and copy them to the incident record before they are overwritten.'}],
src:[['Reports and logs',O.GG]]};

/* ---------- 2: Errors ---------- */
L['ora-gg:8:2']={blocks:[
{p:'Most replication errors fall into a few groups. Knowing the group tells you where to look.'},
{t:[['Error type','Example','Likely cause'],
['**Row not found**','ORA-01403, OGG-01403 on update or delete','The row was not copied by the initial load, or it was changed on the target'],
['**Duplicate key**','ORA-00001','The row already exists: overlap during instantiation, or a conflict'],
['**Constraint**','ORA-02291, ORA-02292','A parent row is missing or a child row exists. Order or filter problem.'],
['**Missing object or column**','ORA-00942, ORA-00904','The target structure differs from the source, or DDL was not applied'],
['**Resource**','ORA-01653, ORA-00257','Target tablespace or archive space full'],
['**Connection**','OGG-xxxx, ORA-12514','Network, credentials or listener'],
['**Data conversion**','Truncation, character set errors','Different data types or character sets']]},
{h:'Method'},
{flow:['Read the first error in the report','Match it to the group','Check the row or object in the discard file','Fix the cause on the target or in the mapping','Restart and watch the lag fall']},
{h:'Common fixes'},
{ul:['Missing row: re-instantiate that table or use a conflict rule if appropriate.','Structure mismatch: apply the missing DDL and restart.','Space: add space and restart. The process continues from its checkpoint.']},
{note:'Do not skip a failed transaction casually. It leaves the target different from the source. If you must skip, record it and verify the table afterwards.'}],
src:[['Troubleshooting GoldenGate',O.GG]]};

/* ---------- 3: Restart, reposition, recover ---------- */
L['ora-gg:8:3']={blocks:[
{p:'Processes can be stopped, restarted and, when needed, **moved to another position**. Know which action is safe.'},
{t:[['Action','Command','Use'],
['**Stop and start**','`STOP EXTRACT ext1`, `START EXTRACT ext1`','Normal. Continues from the checkpoint.'],
['**Kill a hung process**','`KILL EXTRACT ext1`','Last resort, then start it again'],
['**Reposition Extract**','`ALTER EXTRACT ext1, BEGIN NOW` or to a time or SCN','Skip or re-read changes. Dangerous: you can lose or repeat data.'],
['**Reposition Replicat**','`ALTER REPLICAT rep1, EXTSEQNO 25, EXTRBA 0`','Re-apply from a trail position'],
['**Recreate after damage**','Delete and add the process again with the right start point','When checkpoints are lost']]},
{h:'Safe patterns'},
{code:`OGG> STOP REPLICAT rep1
OGG> INFO REPLICAT rep1, SHOWCH
OGG> ALTER REPLICAT rep1, EXTSEQNO 25, EXTRBA 0
OGG> START REPLICAT rep1`},
{h:'Rules'},
{ul:['Repositioning Replicat **back** re-applies changes, which causes duplicates unless you handle them (for example HANDLECOLLISIONS for a short time).','Repositioning Extract **forward** skips changes. The target will be missing data.','Always take notes: process, old position, new position, reason, time.']},
{flow:['Understand why the process failed','Fix the cause','Restart from the checkpoint first','Reposition only if the checkpoint is wrong or lost','Verify the data afterwards']},
{note:'Most failures are fixed by solving the cause and restarting. Repositioning is the exception, and every use should be recorded.'}],
src:[['Restart and recovery',O.GG]]};

/* ---------- 4: Trail management ---------- */
L['ora-gg:8:4']={blocks:[
{p:'Trails grow. A purge policy removes files that are no longer needed, so the disk does not fill.'},
{h:'How purge works'},
{t:[['Setting','Meaning'],
['**Use checkpoints**','Delete a trail only after all readers (paths, Replicats) have finished with it'],
['**MinKeepDays / MinKeepHours**','Keep at least this long, as a safety margin'],
['**MaxKeepDays**','Delete after this long, even if unread (careful)']]},
{code:`# Purge rule in the Administration Server (illustrative)
PURGEOLDEXTRACTS ./dirdat/aa*, USECHECKPOINTS, MINKEEPHOURS 48

# Check disk and trail files
df -h /u01/ogg
ls -l /u01/ogg/deployments/src_dep/var/lib/data | tail`},
{h:'Disk space plan'},
{ul:['Alert at 80 percent used on the trail file system.','Keep enough space for the longest planned outage of the target.','If the target is down for long, the trail grows. Decide in advance who acts and when.']},
{flow:['Set purge rules based on checkpoints','Keep a time margin','Monitor disk space','Review when you add a new target or path']},
{note:'Use checkpoints for purge, never delete trail files by hand. A trail that is deleted but not yet applied means lost changes.'}],
src:[['Trail management',O.GG]]};

/* ---------- 5: REST automation ---------- */
L['ora-gg:8:5']={blocks:[
{p:'The **REST API** lets you automate checks, deployments and reports. It is the same service as the Web UI.'},
{h:'Examples'},
{code:`# List extracts
curl -k -u oggadmin:<password> https://host:9011/services/v2/extracts

# Status of one Extract
curl -k -u oggadmin:<password> https://host:9011/services/v2/extracts/ext1/info/status

# Stop and start
curl -k -u oggadmin:<password> -X POST -H 'Content-Type: application/json' \\
  -d '{"command":"STOP"}' https://host:9011/services/v2/commands/execute`},
{h:'A simple health check script'},
{code:`#!/bin/bash
STATUS=$(curl -sk -u "$OGG_USER:$OGG_PASS" https://host:9011/services/v2/extracts | grep -o '"name":"[^"]*"')
echo "$STATUS"
# Parse the JSON for status and lag, and alert when a process is not running`},
{ul:['Use HTTPS and a service account with limited rights.','Read passwords from a vault or environment variables.','Use the API from monitoring tools and pipelines.','Check the API reference for exact paths in your release, since details change.']},
{flow:['Pick the checks you do by hand today','Script them with REST','Run them on a schedule','Alert on failures and lag']},
{note:'Automate checks first. Automating changes (start, stop, create) needs more care and approval.'}],
src:[['GoldenGate REST API',O.GG]]};

/* ---------- 6: Practical ---------- */
L['ora-gg:8:6']={blocks:[
{p:'Five replications are broken. Diagnose each with the tools from this section. Create the faults in a lab, or ask a colleague to create them.'},
{h:'Fault 1: Replicat abends with row not found'},
{t:[['Symptom','Cause to find'],
['ORA-01403 on an update','The row is missing on the target (not loaded, or deleted)'],
['Fix','Insert or reload the row, restart, and verify the table']]},
{h:'Fault 2: Replicat abends on a new column'},
{t:[['Symptom','Cause to find'],
['ORA-00904 invalid identifier','A column was added on the source and not on the target'],
['Fix','Add the column on the target, restart']]},
{h:'Fault 3: Extract stops with a connection error'},
{t:[['Symptom','Cause to find'],
['Login failed in the report','The credential store alias or password changed'],
['Fix','Update the credential store entry and restart']]},
{h:'Fault 4: Lag grows and the disk fills'},
{t:[['Symptom','Cause to find'],
['Trail disk 95 percent, Replicat stopped for a long time','No purge rule, long target outage'],
['Fix','Restart the Replicat to let it drain, enlarge space, set a purge rule']]},
{h:'Fault 5: Discards are growing'},
{t:[['Symptom','Cause to find'],
['The discard file has many rows','A REPERROR rule discards a real problem'],
['Fix','Read the discard, find the cause, fix it, and remove the rule that hides it']]},
{h:'Method'},
{flow:['INFO ALL: which process is down','VIEW REPORT: the first error','VIEW DISCARD and the alert logs: the details','Fix the cause and restart from the checkpoint','Verify and write the cause']},
{note:'The most useful habit is reading the report file first. It usually states the problem in plain words.'}],
src:[['Troubleshooting GoldenGate',O.GG]]};

})();
