/* LearnSphere - Oracle Core DBA, Section 14: Monitoring, Diagnostics & Troubleshooting.
   Lectures 0-7 are core, 8-13 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const layers=O.dg(700,210,[
[10,20,120,60,'Client|application,|driver',0],[155,20,120,60,'Network|firewall, DNS',0],[300,20,120,60,'Listener|service known?',0],[445,20,120,60,'Instance|open? errors?',2],[590,20,100,60,'Storage|space, I/O',0],
[10,110,680,90,'Work from the outside in. At each layer ask: is it working? Then go one layer inward.',1]],
[[130,50,155,50],[275,50,300,50],[420,50,445,50],[565,50,590,50]]);

const adr=O.dg(700,120,[
[10,30,140,60,'Critical error|ORA-00600|ORA-07445',0],[190,30,140,60,'Incident|dump files in the|ADR automatically',2],[370,30,140,60,'ADRCI|package the|incident',2],[550,30,140,60,'My Oracle Support|service request|with the package',0]],
[[150,60,190,60],[330,60,370,60],[510,60,550,60]]);

/* ---------- 0: Method ---------- */
L['ora-core:13:0']={blocks:[
{p:'Good troubleshooting is a **method**, not luck. A DBA who follows the same steps every time finds problems faster and breaks fewer things while looking.'},
{svg:layers},
{h:'The seven steps'},
{flow:['Define the problem: what fails, for whom, since when','Check what changed: patches, parameters, code, data, network','Gather facts: alert log, error messages, OS, load','Form a hypothesis from the layer that matches the symptoms','Test it with the least risky check first','Fix it, and verify with the same check that showed the fault','Record the cause and the fix']},
{h:'Questions that narrow it down'},
{t:[['Question','Why it helps'],
['One user or everyone?','One user: account, client, network. Everyone: server or database.'],
['Since when? What changed?','Most faults follow a change.'],
['Can you connect at all?','No: listener, network or instance. Yes: look at sessions.'],
['One statement or everything slow?','One: tune it. Everything: resources or a lock.'],
['Is there an error number?','Search the exact ORA- or TNS- code.']]},
{h:'The first five minutes'},
{code:`# On the server
uptime                       # load
df -h                        # disk space
free -m                      # memory
ps -ef | grep pmon           # is the instance up?
lsnrctl status               # is the listener up?
tail -50 alert_<SID>.log     # last events

-- In the database
SELECT instance_name, status, logins FROM v$instance;
SELECT name, open_mode FROM v$pdbs;`},
{h:'Rules to stay safe'},
{ul:['Look before you change. Reading costs nothing.','Change one thing at a time and note it.','Never restart as a first reaction. You lose the evidence in memory.','Do not run an untested command on production.','Take a backup before any repair that touches data or files.']},
{note:'If you cannot explain why the fix worked, you have not found the cause. Check that the problem is really gone and that it cannot come back.'}],
src:[['Diagnosing and resolving problems',O.AD+'diagnosing-and-resolving-problems.html']]};

/* ---------- 1: ADR and ADRCI ---------- */
L['ora-core:13:1']={blocks:[
{p:'Section 5 introduced the **Automatic Diagnostic Repository (ADR)**. Now meet **ADRCI**, the command-line tool to read it, and learn how to package an **incident** for Oracle Support.'},
{svg:adr},
{h:'Incidents and problems'},
{t:[['Term','Meaning'],
['**Incident**','One occurrence of a critical error, such as ORA-00600. Oracle collects trace and dump files for it.'],
['**Problem**','A set of incidents with the same cause (same error and arguments)'],
['**Package**','A zip of the files for an incident, ready to send to Oracle Support']]},
{h:'ADRCI basics'},
{code:`adrci
adrci> show homes
adrci> set home diag/rdbms/orcl/ORCL
adrci> show alert -tail 50
adrci> show alert -p "message_text like '%ORA-%'"
adrci> show problem
adrci> show incident
adrci> show tracefile`},
{h:'Package an incident'},
{code:`adrci> show incident
adrci> ips create package incident 12345
adrci> ips generate package 1 in /tmp`},
{p:'The result is a zip file in `/tmp` that you attach to a service request.'},
{h:'Housekeeping'},
{t:[['Policy','Default'],
['Short-term (traces, incidents)','Kept 30 days'],
['Long-term (alert, health records)','Kept 365 days']]},
{code:`adrci> show control
adrci> purge -age 10080 -type trace      -- keep seven days of traces (age in minutes)`},
{flow:['A critical error occurs','Oracle creates an incident automatically','Use ADRCI to see it','Package it with IPS','Attach the package to the service request']},
{note:'Traces fill the disk slowly. Make sure purge policies run, or you meet a full filesystem on the day you most need the logs.'}],
src:[['ADRCI',D+'sutil/diagnosing-problems.html'],['Managing diagnostic data',O.AD+'diagnosing-and-resolving-problems.html']]};

/* ---------- 2: Alert log and traces ---------- */
L['ora-core:13:2']={blocks:[
{p:'The **alert log** is a time-ordered diary of the instance. **Trace files** hold the detail of one process or one error. Together they answer most "what happened?" questions.'},
{h:'What the alert log shows'},
{t:[['Message pattern','Meaning'],
['`Starting ORACLE instance (normal)`','Startup began'],
['`Completed: ALTER DATABASE OPEN`','The database is open'],
['`Thread 1 advanced to log sequence n`','A log switch happened'],
['`Checkpoint not complete`','Redo logs are too small or too few for the load'],
['`ORA-xxxxx` and `Errors in file ...trc`','An error, and the trace file with the detail'],
['`ALTER SYSTEM SET ...`','A parameter changed (who changed what, when)']]},
{code:`grep -n "ORA-" alert_ORCL.log | tail -20
grep -n "Starting ORACLE instance" alert_ORCL.log | tail
tail -f alert_ORCL.log`},
{h:'Reading a trace file'},
{ul:['Start with the **header**: time, process, session.','The **call stack** shows which Oracle function failed.','The **SQL text** (if present) shows what was running.','Search the first lines for the ORA- number.']},
{h:'Trace your own session'},
{p:'To see why one session is slow, enable tracing for it, run the work, then turn tracing off.'},
{code:`-- Find the session
SELECT sid, serial#, username FROM v$session WHERE username = 'SHOP_APP';

EXEC DBMS_MONITOR.SESSION_TRACE_ENABLE(session_id => 123, serial_num => 4567, waits => TRUE, binds => FALSE);
-- reproduce the problem
EXEC DBMS_MONITOR.SESSION_TRACE_DISABLE(session_id => 123, serial_num => 4567);

# Format the trace file for reading
tkprof orcl_ora_12345.trc report.txt sort=exeela`},
{flow:['Identify the session or error','Enable tracing only for that session','Reproduce the problem once','Disable tracing','Read the trace with tkprof']},
{note:'Tracing adds load and the files can be large. Turn it off as soon as you have what you need. Binds can reveal sensitive data, so enable them only when required.'}],
src:[['Alert log and trace files',O.AD+'diagnosing-and-resolving-problems.html'],['DBMS_MONITOR',D+'arpls/DBMS_MONITOR.html'],['TKPROF',D+'tgsql/']]};

/* ---------- 3: Common ORA errors ---------- */
L['ora-core:13:3']={blocks:[
{p:'You will see the same errors again and again. Knowing what each means, and what to check first, saves a lot of time.'},
{h:'Space and resources'},
{t:[['Error','Meaning','First check'],
['**ORA-01653 / 01654**','Cannot extend a table or index','Tablespace full or MAXSIZE reached'],
['**ORA-01652**','Cannot extend temp segment','Large sort. Find the session.'],
['**ORA-00257**','Archiver stuck','Archive destination or FRA full'],
['**ORA-04031**','Cannot allocate shared memory','Shared pool pressure, many hard parses'],
['**ORA-00018 / 00020**','Maximum sessions or processes','`V$RESOURCE_LIMIT`, application connection leak']]},
{h:'Sessions and data'},
{t:[['Error','Meaning','First check'],
['**ORA-00054**','Resource busy and NOWAIT','Another session holds a lock'],
['**ORA-00060**','Deadlock detected','Application order of updates'],
['**ORA-01555**','Snapshot too old','Undo retention and long queries'],
['**ORA-03113 / 03114**','End of file on communication channel','Server process died. Read the alert log.']]},
{h:'Access'},
{t:[['Error','Meaning','First check'],
['**ORA-01017**','Invalid username or password','Typing, case, or the account in the right PDB'],
['**ORA-28000 / 28001**','Account locked / expired','`DBA_USERS.ACCOUNT_STATUS`'],
['**ORA-01031**','Insufficient privileges','Missing grant'],
['**ORA-00942**','Table or view does not exist','Name, schema, or missing grant']]},
{h:'Internal errors'},
{t:[['Error','Meaning','What to do'],
['**ORA-00600**','Internal error','Do not guess. Look up the first argument on MOS, package the incident.'],
['**ORA-07445**','Exception in a process (core dump)','Same: MOS search and package the incident']]},
{code:`-- How close are we to limits?
SELECT resource_name, current_utilization, max_utilization, limit_value
FROM   v$resource_limit WHERE resource_name IN ('processes','sessions');`},
{flow:['Copy the exact error and the lines around it','Look up the meaning in the documentation','Apply the first check from the table','If it is ORA-00600 or ORA-07445, go to My Oracle Support','Verify and record the fix']},
{note:'Many errors have the same symptom from different causes. Always check the alert log: the first error of a chain usually explains the later ones.'}],
src:[['Database Error Messages',O.ERR],['V$RESOURCE_LIMIT',O.RF+'V-RESOURCE_LIMIT.html']]};

/* ---------- 4: Monitoring sessions ---------- */
L['ora-core:13:4']={blocks:[
{p:'When the database is slow or stuck, three questions come first: who is connected, what are they waiting for, and who is blocking whom.'},
{h:'Useful columns of V$SESSION'},
{t:[['Column','Meaning'],
['`STATUS`','ACTIVE (running a call) or INACTIVE (idle)'],
['`SQL_ID`','The statement being run (join to `V$SQL`)'],
['`EVENT` and `WAIT_CLASS`','What the session is waiting for'],
['`BLOCKING_SESSION`','Another session holding what this one needs'],
['`LAST_CALL_ET`','Seconds since the last call started'],
['`CON_ID`','Container the session belongs to']]},
{code:`-- Active sessions and what they wait for
SELECT sid, serial#, username, status, event, wait_class, sql_id, last_call_et
FROM   v$session WHERE type = 'USER' AND status = 'ACTIVE';

-- Blocking chains
SELECT sid, blocking_session, event, seconds_in_wait FROM v$session WHERE blocking_session IS NOT NULL;

-- Top SQL by elapsed time
SELECT sql_id, executions, ROUND(elapsed_time/1e6) AS secs, SUBSTR(sql_text,1,60) AS txt
FROM   v$sqlarea ORDER BY elapsed_time DESC FETCH FIRST 5 ROWS ONLY;

-- Long operations
SELECT sid, opname, ROUND(sofar/totalwork*100) AS pct, time_remaining FROM v$session_longops WHERE sofar < totalwork;`},
{h:'Wait classes in one table'},
{t:[['Class','Typical meaning'],
['**Idle**','Waiting for work. Normal.'],
['**User I/O**','Reading data from disk'],
['**Commit**','Waiting for LGWR (log file sync)'],
['**Concurrency**','Contention such as latches and library cache'],
['**Application**','Locks from application logic (row locks)'],
['**Configuration**','Something is too small, for example redo logs']]},
{h:'Ending a session'},
{code:`ALTER SYSTEM KILL SESSION '123,4567' IMMEDIATE;
ALTER SYSTEM DISCONNECT SESSION '123,4567' IMMEDIATE;     -- ends the OS process of the session`},
{flow:['Find the active sessions and their waits','Find the blocker, if any','See the SQL and ask the owner','Ask them to commit or roll back','Kill only as a last step']},
{note:'Killing a session starts a rollback that takes as long as the work done. Do not use kill -9 on a server process unless Oracle itself is stuck, since it can leave the session in KILLED state for a long time.'}],
src:[['V$SESSION',O.RF+'V-SESSION.html'],['Monitoring performance',D+'tgdba/']]};

/* ---------- 5: MOS ---------- */
L['ora-core:13:5']={blocks:[
{p:'Lecture 7 of section 1 introduced My Oracle Support. Now the practical part: **how to find an answer** and **how to open a good service request**.'},
{h:'Searching well'},
{t:[['Tip','Why'],
['Search the **exact error text and number**, with the release','Fixes depend on version'],
['Filter by **Knowledge** for notes and **Patches** for fixes','Avoid noise from community posts'],
['Read **Applies to** and **Symptoms** before **Solution**','A note may not fit your version or platform'],
['Note the **Bug number** and which release update fixes it','You can plan the patch'],
['Prefer notes by Oracle with a recent update date','Old notes may be outdated']]},
{h:'Types of notes'},
{t:[['Type','Use'],
['**How To**','Step-by-step procedure'],
['**Troubleshooting**','Diagnosing a symptom'],
['**Known Issue / Bug**','A confirmed defect and its fix'],
['**Support Policy / Release schedule**','Dates and rules']]},
{h:'A good service request'},
{t:[['Include','Because'],
['**Severity** that matches the impact (1 is production down)','Decides how fast Oracle responds'],
['A short title and a clear **problem statement**','Saves round trips'],
['Release, platform, `opatch lspatches` output','Oracle needs to know your exact version'],
['Alert log extract and the **ADRCI incident package**','Shows the evidence'],
['What changed, and what you already tried','Avoids repeating your steps'],
['Time zone and a contact for severity 1','Allows continuous work']]},
{flow:['Problem found','Search MOS with the error and release','Fix found: test it, then apply','No fix: collect diagnostics','Open a service request with the package and a clear statement']},
{p:'Oracle also offers collection tools, such as **Autonomous Health Framework (AHF)**, which gather diagnostics for a service request in one step.'},
{note:'Do not post real data, passwords or keys in a service request. Mask sensitive values in logs before you upload them.'}],
src:[['My Oracle Support',O.MOS]]};

/* ---------- 6: Enterprise Manager ---------- */
L['ora-core:13:6']={blocks:[
{p:'**Oracle Enterprise Manager Cloud Control** is the central web console for many databases. It adds monitoring, alerts, jobs and patching in one place. Smaller sites use the lighter **EM Express**.'},
{h:'Cloud Control architecture'},
{t:[['Part','Role'],
['**Oracle Management Service (OMS)**','The web application and brain'],
['**Management Repository**','A database that stores monitoring data'],
['**Management Agent**','A small program on each monitored host'],
['**Targets**','Things monitored: hosts, databases, listeners, PDBs'],
['**Plug-ins**','Add support for more target types']]},
{flow:['The Agent on each host collects metrics from its targets','It uploads them to the OMS','The OMS stores them in the repository','You see dashboards, alerts and jobs in the console']},
{h:'What a DBA uses it for'},
{t:[['Area','Examples'],
['**Monitoring**','Availability, space, sessions, alerts across all databases'],
['**Incident rules**','Email or ticket when a metric crosses a threshold'],
['**Jobs**','Run scripts on many databases at once'],
['**Patching and provisioning**','Roll out patches to a fleet'],
['**Performance**','Top activity pages, SQL monitoring (licence needed)']]},
{note:'Many Enterprise Manager database performance pages use the Diagnostics and Tuning Packs. Check your licence before you use them.'},
{h:'EM Express'},
{p:'**EM Express** is built into the database. It needs no extra install, shows basic performance and configuration, and works for one database at a time.'},
{code:`SELECT DBMS_XDB_CONFIG.GETHTTPSPORT FROM dual;
EXEC DBMS_XDB_CONFIG.SETHTTPSPORT(5500);`},
{t:[['','EM Express','Cloud Control'],
['**Scope**','One database','Many databases and hosts'],
['**Install**','Built in','OMS, repository, agents'],
['**Features**','Basic monitoring and admin','Full monitoring, jobs, patching, compliance'],
['**Best for**','Labs and small sites','Larger estates']]},
{note:'A console is a convenience. You still need to know the SQL and command-line views, because the console depends on the same data and may be unavailable when you need it most.'}],
src:[['Enterprise Manager documentation','https://docs.oracle.com/en/enterprise-manager/'],['EM Express',D+'admin/']]};

/* ---------- 7: Practical ---------- */
L['ora-core:13:7']={blocks:[
{p:'Three small faults, three diagnoses. Break each one on purpose in your lab, then use the method to find the cause without looking at how you broke it. Ask a colleague to break it for you if you can.'},
{h:'Fault 1: Users cannot connect'},
{code:`-- Break it (as SYSDBA)
ALTER PLUGGABLE DATABASE freepdb1 CLOSE IMMEDIATE;
-- or, on a lab VM: lsnrctl stop`},
{p:'**Symptom:** applications report ORA-12514 (or ORA-12541 if the listener is down).'},
{t:[['Check','Result tells you'],
['`lsnrctl status`','Listener running?'],
['`lsnrctl services`','Is the service listed? Missing means closed PDB or not registered'],
['`SELECT name, open_mode FROM v$pdbs;`','MOUNTED means closed'],
['Fix','`ALTER PLUGGABLE DATABASE freepdb1 OPEN;` then `SAVE STATE`']]},
{h:'Fault 2: The application hangs'},
{code:`-- Session A
UPDATE shop.orders SET total = 1 WHERE id = 1;     -- no commit

-- Session B
UPDATE shop.orders SET total = 2 WHERE id = 1;     -- hangs`},
{p:'**Symptom:** a user says the screen froze.'},
{t:[['Check','Result tells you'],
['`SELECT sid, blocking_session, event FROM v$session WHERE blocking_session IS NOT NULL;`','B is blocked by A'],
['`SELECT sql_id, last_call_et, status FROM v$session WHERE sid = <A>;`','A is idle in transaction'],
['Fix','Ask the owner to commit or roll back. Kill A only if they cannot.']]},
{h:'Fault 3: Inserts fail'},
{code:`-- Break it
CREATE TABLESPACE tiny DATAFILE SIZE 2M AUTOEXTEND OFF;
CREATE TABLE shop.big (c CHAR(2000)) TABLESPACE tiny;
INSERT INTO shop.big SELECT 'x' FROM dual CONNECT BY level <= 10000;`},
{p:'**Symptom:** ORA-01653 unable to extend table.'},
{t:[['Check','Result tells you'],
['Alert log and error text','Which table and tablespace'],
['`SELECT tablespace_name, used_percent FROM dba_tablespace_usage_metrics;`','100 percent'],
['Fix','Add a datafile or enable AUTOEXTEND with a MAXSIZE, then retry']]},
{h:'Write it down'},
{ul:['For each fault, write the symptom, the cause, the checks you ran and the fix.','Add the checks you used to your own scripts folder.','Clean up: drop the tiny tablespace and the big table, and make sure the PDB is open and saved.']},
{note:'The aim is the method: define, gather facts, hypothesise, test, fix, verify, record. The same steps solve faults you have never seen.'}],
src:[['Diagnosing and resolving problems',O.AD+'diagnosing-and-resolving-problems.html'],['Database Error Messages',O.ERR]]};

})();
