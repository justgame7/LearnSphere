/* LearnSphere - Data Guard, Section 06: Role Transitions.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const sw=O.dg(700,210,[
[10,40,130,70,'Before|prod = primary|stby = standby',0],[190,20,150,50,'Primary ends redo|sends end-of-redo|marker',2],[190,90,150,50,'Standby applies|all redo, becomes|primary',2],[390,40,130,70,'After|prod = standby|stby = primary',0],[570,40,120,70,'No data lost|short outage',0]],
[[140,75,190,45],[140,75,190,115],[340,45,390,65],[340,115,390,85],[520,75,570,75]]);

const fo=O.dg(700,170,[
[10,40,130,70,'Primary lost|(site, power,|hardware)',0],[190,40,140,70,'Decide to fail over|(you or the observer)',2],[380,40,140,70,'Standby becomes|primary|(applies what it has)',2],[570,40,120,70,'Old primary is|reinstated later|or rebuilt',0]],
[[140,75,190,75],[330,75,380,75],[520,75,570,75]]);

/* ---------- 0: Switchover ---------- */
L['ora-dg:5:0']={blocks:[
{p:'A **switchover** is a **planned** role change. The primary and the standby swap roles with **no data loss**. You use it for maintenance, tests and moving production to another site on purpose.'},
{svg:sw},
{h:'What happens'},
{flow:['Check that the standby is in sync and ready','The primary stops accepting work and sends an end-of-redo marker','The standby applies all redo up to that marker','The standby opens as the new primary','The old primary restarts as a standby and starts to apply']},
{h:'With the broker'},
{code:`DGMGRL> VALIDATE DATABASE stby;
DGMGRL> SWITCHOVER TO stby;
DGMGRL> SHOW CONFIGURATION;`},
{h:'With SQL (12c and later)'},
{code:`-- On the primary
SELECT switchover_status FROM v$database;                   -- TO STANDBY
ALTER DATABASE SWITCHOVER TO stby VERIFY;                   -- dry run
ALTER DATABASE SWITCHOVER TO stby;`},
{t:[['Aspect','Switchover'],
['**Data loss**','None'],
['**Downtime**','Seconds to a few minutes (depends on database size and apps)'],
['**Reversible**','Yes: switch back at any time'],
['**Needs**','Both databases healthy and in sync']]},
{note:'Practise switchover regularly, in test and then in production. A DR plan you have never used at least once a year is not a plan.'}],
src:[['Role transitions',O.DG]]};

/* ---------- 1: Failover ---------- */
L['ora-dg:5:1']={blocks:[
{p:'A **failover** is an **unplanned** role change. The primary is lost and cannot cooperate, so the standby takes over with the redo it has.'},
{svg:fo},
{h:'Failover commands'},
{code:`-- Broker
DGMGRL> FAILOVER TO stby;
DGMGRL> FAILOVER TO stby IMMEDIATE;     -- skip applying remaining redo, fastest

-- SQL (without the broker), on the standby
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE FINISH;
ALTER DATABASE COMMIT TO SWITCHOVER TO PRIMARY;
ALTER DATABASE OPEN;`},
{t:[['Option','Meaning'],
['`FAILOVER TO stby`','Apply all redo that has been received, then open as primary. Minimum data loss.'],
['`FAILOVER TO stby IMMEDIATE`','Open at once without applying the rest. Faster, may lose more data.']]},
{h:'Data loss depends on the mode'},
{t:[['Mode','Loss at failover'],
['Maximum Availability or Protection, in sync','None'],
['Maximum Performance','Redo not yet sent (seconds, sometimes minutes)'],
['Standby with an apply delay','Delay time of data is not applied unless you finish the apply']]},
{h:'Switchover vs failover'},
{t:[['','Switchover','Failover'],
['**Planned?**','Yes','No'],
['**Old primary**','Becomes a standby at once','Must be reinstated or rebuilt'],
['**Data loss**','None','Depends on mode'],
['**Use**','Maintenance, tests','Disaster']]},
{h:'Decision'},
{flow:['Is the primary really lost, and not just slow?','Can it be fixed faster than failover would take?','If not, decide to fail over (or let fast-start failover decide)','After failover, reconnect applications and reinstate the old primary']},
{note:'Do not fail over casually. The old primary may hold changes that never reached the standby. Fail over only when you accept that risk, or have checked it.'}],
src:[['Failover',O.DG]]};

/* ---------- 2: Reinstate ---------- */
L['ora-dg:5:2']={blocks:[
{p:'After a failover, the old primary can often be **reinstated** as a standby without rebuilding it. This works with **Flashback Database**.'},
{h:'Why flashback is used'},
{p:'The old primary may contain redo that the standby never received. The new primary went on from an earlier point. To rejoin, the old primary has to **flash back** to the point where the two paths split, and then follow the new primary.'},
{flow:['Failover happens. The standby becomes the new primary at SCN X.','The old primary is repaired and started in MOUNT','Flashback Database takes it back to SCN X','It is converted to a standby','It receives redo from the new primary and catches up']},
{h:'With the broker'},
{code:`DGMGRL> REINSTATE DATABASE prod;
DGMGRL> SHOW CONFIGURATION;`},
{h:'Manually'},
{code:`-- On the new primary
SELECT standby_became_primary_scn FROM v$database;

-- On the old primary (mounted)
FLASHBACK DATABASE TO SCN <that scn>;
ALTER DATABASE CONVERT TO PHYSICAL STANDBY;
STARTUP MOUNT FORCE;
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT FROM SESSION;`},
{h:'Requirements'},
{t:[['Requirement','Why'],
['Flashback Database **on** at the old primary before the failure','To return to the earlier point'],
['Flashback logs retained long enough','Must cover the time back to the failover SCN'],
['The old primary can be started','The disk and files are intact']]},
{h:'If reinstate is not possible'},
{p:'If flashback was off or logs are missing, **rebuild** the old primary as a new standby with RMAN duplicate.'},
{note:'This is why Flashback Database is a Data Guard prerequisite. It saves hours or days of rebuild time after every failover.'}],
src:[['Reinstating a failed primary',O.DG]]};

/* ---------- 3: Broker vs SQL ---------- */
L['ora-dg:5:3']={blocks:[
{p:'Role changes can be made with the broker or with SQL. The broker is simpler and safer. Know both so you can work when the broker is not available.'},
{t:[['Task','Broker','SQL'],
['Check readiness','`VALIDATE DATABASE stby;`','`SELECT switchover_status FROM v$database;`'],
['Switchover','`SWITCHOVER TO stby;`','`ALTER DATABASE SWITCHOVER TO stby;` (12c and later, with `VERIFY` for a dry run)'],
['Failover','`FAILOVER TO stby;`','`RECOVER MANAGED STANDBY DATABASE FINISH;` then `COMMIT TO SWITCHOVER TO PRIMARY;`'],
['Reinstate','`REINSTATE DATABASE prod;`','`FLASHBACK DATABASE`, `CONVERT TO PHYSICAL STANDBY`, start apply'],
['Update parameters after a role change','Automatic','Manual on each side'],
['Restart instances','Automatic','You do it'],
['Start role-based services','Automatic (with clusterware)','Trigger or manual']]},
{h:'Why prefer the broker'},
{ul:['One command replaces many steps, which reduces mistakes.','It updates destinations and properties for you.','It works with fast-start failover.','It verifies readiness before it starts.']},
{h:'When SQL is still needed'},
{ul:['The broker is not configured or is damaged.','Teaching and troubleshooting, to see what happens underneath.','Special cases, such as a failover when the broker configuration is out of date.']},
{flow:['Use the broker as the normal way','Know the SQL steps for an emergency','Practise both in the lab']},
{note:'Do not mix methods in the middle of a role change. Pick the broker or SQL and finish with it.'}],
src:[['Broker and SQL role transitions',O.DG]]};

/* ---------- 4: Validate readiness ---------- */
L['ora-dg:5:4']={blocks:[
{p:'A role change should never be a surprise. A short checklist before you start prevents most failures.'},
{h:'The checklist'},
{t:[['Check','How'],
['Broker status','`SHOW CONFIGURATION;` is SUCCESS'],
['Readiness','`VALIDATE DATABASE stby;` shows Ready for Switchover: Yes'],
['No lag','`V$DATAGUARD_STATS`: transport and apply lag small'],
['Standby redo logs','Present on both databases'],
['Flashback','On on both databases'],
['Password file and wallet','Same on both; TDE wallet open on the standby'],
['Services and connect strings','Role-based services defined and tested'],
['Jobs and external dependencies','Known and handled (next lecture)'],
['People','Application owners and users informed, runbook ready']]},
{code:`DGMGRL> SHOW CONFIGURATION;
DGMGRL> VALIDATE DATABASE stby;
DGMGRL> VALIDATE NETWORK CONFIGURATION FOR ALL;

-- Dry run without the broker
ALTER DATABASE SWITCHOVER TO stby VERIFY;`},
{h:'A short runbook'},
{flow:['T-1 day: validate, inform, confirm the window','T-0: take a backup or restore point','Run VALIDATE DATABASE and SHOW CONFIGURATION','Execute the switchover','Check roles, services and application, then record the time']},
{h:'After the change'},
{ul:['Run SHOW CONFIGURATION: all SUCCESS.','Run VALIDATE DATABASE on the new standby.','Check lag and apply.','Test the application and the reporting jobs.']},
{note:'A good habit is to switch over to the standby and run on it for a week. It proves that the standby is a real production-ready site.'}],
src:[['Preparing for switchover',O.DG]]};

/* ---------- 5: Application considerations ---------- */
L['ora-dg:5:5']={blocks:[
{p:'Data Guard keeps the **database** available. Your **applications** must follow it to the new primary. Plan this part just as carefully.'},
{h:'Connecting to the right site'},
{t:[['Technique','How'],
['**Role-based services**','A service that runs only on the primary, so its name always points to the right database'],
['**Connect string with both sites**','`ADDRESS_LIST` with primary and standby SCANs and retry settings'],
['**Connection pools and FAN**','The pool removes dead connections quickly and reconnects'],
['**Application Continuity**','Replays in-flight work on the new primary'],
['**DNS alias**','Alternative: repoint a DNS name, with a low TTL']]},
{h:'Things that exist only on the primary'},
{t:[['Item','What to do'],
['**Scheduler jobs**','Use the job attribute `database_role` or services so jobs run only on the primary'],
['**Database links**','Check that links work from the new primary'],
['**Directory objects, external files**','Same folders on both servers'],
['**UTL_FILE, UTL_SMTP**','Same configuration, network access and ACLs'],
['**Wallets and credentials**','Present on both']]},
{h:'Test it'},
{flow:['Do a switchover in test','Check that the application reconnects without manual steps','Check batch jobs and reports','Fix what failed and repeat']},
{note:'The usual cause of a failed DR test is not the database. It is a job, a link, a file path or a firewall rule that nobody checked on the other site.'}],
src:[['Application considerations',O.DG]]};

/* ---------- 6: Practical ---------- */
L['ora-dg:5:6']={blocks:[
{p:'Switch over, fail over and reinstate in your lab. Use the broker. Start from a healthy configuration (section 5).'},
{h:'Part 1: Switchover'},
{code:`DGMGRL> SHOW CONFIGURATION;
DGMGRL> VALIDATE DATABASE stby;
DGMGRL> SWITCHOVER TO stby;
DGMGRL> SHOW CONFIGURATION;

-- On the new primary
SELECT name, database_role, open_mode FROM v$database;`},
{h:'Part 2: Switch back'},
{code:`DGMGRL> SWITCHOVER TO prod;`},
{h:'Part 3: Failover (simulate a disaster)'},
{code:`-- On the primary host: kill the primary (lab only!)
SHUTDOWN ABORT

DGMGRL> CONNECT sys@stby
DGMGRL> FAILOVER TO stby;
DGMGRL> SHOW CONFIGURATION;`},
{h:'Part 4: Reinstate'},
{code:`-- Start the old primary in MOUNT
STARTUP MOUNT

DGMGRL> REINSTATE DATABASE prod;
DGMGRL> SHOW CONFIGURATION;`},
{h:'Check your result'},
{t:[['Step','Expected'],
['After switchover','`stby` is primary, `prod` is standby, status SUCCESS'],
['After switching back','Original roles'],
['After failover','`stby` is primary. `prod` shows as disabled or needing reinstate.'],
['After reinstate','`prod` is a physical standby and applying redo. Status SUCCESS.']]},
{h:'Notes'},
{ul:['Time each step and write the times down: they become your real RTO.','Check the application connection after each step.','If reinstate fails, read the message: flashback logs may be missing. Then rebuild with duplicate.']},
{note:'Only simulate a disaster in a lab or in an approved test window. SHUTDOWN ABORT on a production primary is a real outage.'}],
src:[['Role transitions',O.DG]]};

})();
