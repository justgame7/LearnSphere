/* LearnSphere - Data Guard, Section 12: Operations, DR Drills & Capstone.
   Lectures 0-5 are core, 6-9 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const gold=O.dg(700,250,[
[10,10,330,230,'Site A: production',1],[30,45,290,40,'Primary database (RAC or single)',2],[30,100,290,40,'Role-based service shop_svc (primary)',0],[30,155,290,40,'Backups to local and offsite storage',0],
[360,10,330,230,'Site B: disaster recovery',1],[380,45,290,40,'Physical standby (Active Data Guard)',2],[380,100,290,40,'Role-based service shop_ro (standby)',0],[380,155,290,40,'Backups taken from the standby',0],
[200,200,300,30,'Observer on a third site',0]],
[[340,65,380,65]]);

/* ---------- 0: Backup strategy ---------- */
L['ora-dg:11:0']={blocks:[
{p:'A standby does not replace backups, but it can **make them easier**. In a Data Guard configuration, backups can run from **either database**, and they can restore **either database**.'},
{h:'Where to take backups'},
{t:[['Option','Notes'],
['**From the primary**','Simple. Uses primary CPU and I/O.'],
['**From the standby**','Offloads the primary. Works on a mounted physical standby. With Active Data Guard you can back up while it is open read only.'],
['**Both**','For example datafile backups from the standby and archive log backups from the primary']]},
{p:'A backup of a datafile from the standby can be used to restore the primary, and the other way round, because they share the same DBID.'},
{h:'Archive log deletion policy'},
{code:`-- On the primary: logs are deleted only after every standby applied them
RMAN> CONFIGURE ARCHIVELOG DELETION POLICY TO APPLIED ON ALL STANDBY;

-- On the standby: logs are deleted after they have been applied
RMAN> CONFIGURE ARCHIVELOG DELETION POLICY TO APPLIED ON ALL STANDBY;

-- Or: delete only after being backed up (adds a condition)
RMAN> CONFIGURE ARCHIVELOG DELETION POLICY TO BACKED UP 1 TIMES TO DISK;`},
{h:'Use a recovery catalog'},
{p:'A **recovery catalog** keeps backup information for all members and makes restores easy from any site.'},
{code:`RMAN> CONNECT TARGET sys@prod
RMAN> CONNECT CATALOG rcat@catdb
RMAN> REGISTER DATABASE;
RMAN> CONFIGURE DB_UNIQUE_NAME stby CONNECT IDENTIFIER 'stby';
RMAN> RESYNC CATALOG FROM DB_UNIQUE_NAME ALL;
RMAN> CONFIGURE CONTROLFILE AUTOBACKUP ON;`},
{flow:['Decide where backups run','Set the deletion policy on both sides','Register all members in one catalog','Test a restore of the primary from a standby backup']},
{note:'Do a restore test from the standby backup. It proves the process works, and that backups taken on one side are usable on the other.'}],
src:[['RMAN and Data Guard',O.DG],['Backup and Recovery User Guide',D+'bradv/']]};

/* ---------- 1: Runbooks ---------- */
L['ora-dg:11:1']={blocks:[
{p:'In a disaster, people are stressed and time matters. A **runbook** tells everyone what to do, in order, with exact commands and names. **Communication** is as important as the commands.'},
{h:'What a DR runbook contains'},
{t:[['Part','Content'],
['**Declaration**','Who may declare a disaster, with what criteria (for example site lost for more than 15 minutes)'],
['**Roles**','DBA, application owner, network, incident manager, with names and phone numbers'],
['**Failover steps**','Exact commands, expected output, and times'],
['**Application steps**','Services, connection strings, DNS, restart order'],
['**Verification**','What to test to confirm that the business works'],
['**Communication**','Who to tell, when, with what message'],
['**After the failover**','Reinstate or rebuild the old primary, back up, stabilise'],
['**Failback**','The steps to return to the original site when ready']]},
{h:'Communication plan'},
{t:[['Time','Message and audience'],
['T+0','Incident declared: management and application owners'],
['T+15 min','Failover started: status update to the business'],
['On completion','Service restored: users and management, with next steps'],
['After','Report with timeline, cause and actions']]},
{h:'Keep it usable'},
{ul:['Store it where it is available during a disaster, not only on the primary site.','Keep the commands copy-ready and test them.','Review and update after every drill and every change.']},
{flow:['Write the runbook from your tested steps','Name the people and their backups','Store copies offsite','Rehearse in drills','Update after each use']},
{note:'A runbook that nobody has practised will fail on the day. Drill it, then improve it.'}],
src:[['Data Guard Concepts and Administration',O.DG]]};

/* ---------- 2: DR testing ---------- */
L['ora-dg:11:2']={blocks:[
{p:'Disaster recovery is only real if you **test it**. Different tests prove different things.'},
{t:[['Test','Frequency (example)','What it proves'],
['**Switchover drill**','Quarterly','Roles swap cleanly, applications follow, the standby site works under load'],
['**Failover test** (in a test environment)','Twice a year','Failover commands and FSFO work, reinstate works'],
['**Full DR exercise**','Yearly','The whole business process with people, communication and applications'],
['**Restore test**','Quarterly','Backups are usable, with known time'],
['**Validate and health checks**','Daily','The standby is ready now']]},
{h:'How to run a drill'},
{flow:['Plan: date, scope, success criteria, rollback','Inform everyone affected','Execute from the runbook, with a timekeeper','Record the real times','Review: what failed, what was slow, what to fix']},
{h:'Measure'},
{t:[['Measure','Target'],
['Real RTO','Within the business target'],
['Real RPO (lag at switch)','Within the business target'],
['Steps that needed a manual fix','Zero, or fixed in the runbook'],
['Application checks passed','All']]},
{note:'Switch to the standby site and run there for a few days, once a year. It proves that the standby has the capacity and the dependencies, not just the data.'}],
src:[['DR testing',O.DG]]};

/* ---------- 3: Cloud Data Guard ---------- */
L['ora-dg:11:3']={blocks:[
{p:'Oracle cloud services offer Data Guard as a **managed feature**. You choose it in the console or API, and the service builds and manages the standby. The concepts you have learned still apply.'},
{t:[['Service','Data Guard option'],
['**OCI Base Database and Exadata Cloud services**','A **Data Guard association** creates a standby in another availability domain or region from the console'],
['**Autonomous Database**','**Autonomous Data Guard**: built-in standby, local or cross-region, with automatic failover options'],
['**Oracle Database@Azure, @AWS, @Google Cloud**','Standby in another region or cloud region of the provider, or on OCI'],
['**Amazon RDS for Oracle**','Replicas based on Data Guard technology (check the current features and licence rules)'],
['**Your own VMs in any cloud**','Standard Data Guard as in this course']]},
{h:'What the service does for you'},
{ul:['Creates and configures the standby and the broker.','Offers switchover and failover from the console or API.','Handles patching of the infrastructure.']},
{h:'What stays with you'},
{ul:['Choosing the protection mode, region and design from RPO and RTO.','Application connection handling: services, retries, Application Continuity.','Testing switchover, failover and restore.','Backups, and keys for encrypted databases.']},
{code:`# Typical operations are in the console, CLI or API. Example (OCI CLI, illustrative):
oci db data-guard-association switchover --database-id <id> --data-guard-association-id <id> --database-admin-password <password>`},
{flow:['Pick the service and the region for the standby','Create the association','Test a switchover','Set up application connection handling and monitoring']},
{note:'Managed does not mean tested. Run switchover drills on cloud Data Guard just as you would on your own servers.'}],
src:[['Data Guard in Oracle Cloud','https://docs.oracle.com/en-us/iaas/Content/Database/Tasks/usingdataguard.htm']]};

/* ---------- 4: Readiness ---------- */
L['ora-dg:11:4']={blocks:[
{p:'Before you declare a Data Guard design production ready, check each area and keep the evidence.'},
{t:[['Area','Check','How'],
['**Prerequisites**','ARCHIVELOG, FORCE LOGGING, Flashback on both','`V$DATABASE`'],
['**Standby**','Physical standby synchronised, SRLs on both sides','`V$DATAGUARD_STATS`, `V$STANDBY_LOG`'],
['**Broker**','Configuration SUCCESS, validated','`SHOW CONFIGURATION`, `VALIDATE DATABASE`'],
['**Protection mode**','Matches RPO. Transport mode tested.','`V$DATABASE.PROTECTION_MODE`'],
['**Failover**','FSFO configured if RTO needs it. Observer on a third site, monitored.','`SHOW FAST_START FAILOVER`'],
['**Applications**','Role-based services, retry connect strings, Application Continuity where used','Application test'],
['**Dependencies**','Jobs, links, files and wallets work on both sites','Drill'],
['**Backups**','Strategy, deletion policy, catalog, restore tested','Restore test'],
['**Monitoring**','Lag, status, observer alerts reach a person','Alert test'],
['**Security**','Passwords, wallets, network encryption protected','Review'],
['**Runbooks and drills**','Written, tested, dates for the next drill','Documents']]},
{flow:['Walk the checklist with a second DBA','Keep evidence for each item','Fix failures and repeat','Run a switchover and a failover test','Go live']},
{note:'Treat the checklist as a gate. A failed item means not ready.'}],
src:[['Data Guard Concepts and Administration',O.DG]]};

/* ---------- 5: Capstone ---------- */
L['ora-dg:11:5']={blocks:[
{p:'**Capstone.** Build an **MAA Gold** design, prove it with a switchover and a failover, and reinstate. Keep notes. They are your deliverable.'},
{svg:gold},
{h:'Specification'},
{t:[['Requirement','Detail'],
['Databases','Primary `prod` and physical standby `stby`, same release and patch level'],
['Prerequisites','ARCHIVELOG, FORCE LOGGING, Flashback, SRLs on both sides'],
['Transport','Maximum Availability with SYNC (or FASTSYNC)'],
['Broker','Configuration enabled, VALIDATE clean'],
['Failover','Fast-start failover with an observer on a third host'],
['Applications','Role-based services and a connect string with both sites'],
['Backups','From the standby, with a deletion policy and a catalog'],
['Monitoring','Daily check script for SHOW CONFIGURATION and VALIDATE DATABASE'],
['Runbook','Switchover, failover, reinstate, failback']]},
{h:'Steps'},
{flow:['Prepare the environment and create the standby (sections 3 and 4)','Bring it under the broker and set the protection mode (sections 2 and 5)','Add services, backups and monitoring','Enable fast-start failover and start the observer (section 7)','Switch over and back, then fail over automatically and check reinstate (sections 6 and 7)','Write the runbook and run the readiness checklist']},
{h:'Acceptance'},
{t:[['Test','Pass condition'],
['`SHOW CONFIGURATION`','SUCCESS'],
['`VALIDATE DATABASE stby`','Ready for Switchover and Failover: Yes'],
['Switchover with a test application running','Reconnects without manual steps. Measured outage recorded.'],
['Simulated failure of the primary','Automatic failover within the threshold plus a few seconds'],
['Old primary returned','Reinstated automatically as a standby'],
['Restore test from a standby backup','Succeeds with a recorded time'],
['Runbook and checklist','Complete and reviewed']]},
{h:'Self-assessment'},
{t:[['Level','Meaning'],
['**Foundation**','The configuration works and you can explain every component'],
['**Solid**','You also broke it on purpose and diagnosed it from logs'],
['**Ready**','Another engineer can operate and test your design from the runbook']]},
{note:'Next steps: GoldenGate for zero-downtime migrations and active-active, and the Upgrade, Patching and Migration sub-course for planning a move to 26ai.'}],
src:[['Data Guard Concepts and Administration',O.DG],['Data Guard Broker',O.BKR]]};

})();
