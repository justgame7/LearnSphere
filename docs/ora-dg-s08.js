/* LearnSphere - Data Guard, Section 08: Active Data Guard & Other Standby Types.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const adg=O.dg(700,220,[
[10,30,200,160,'Primary',1],[30,65,160,50,'Read write|OLTP workload',2],[30,125,160,50,'Ships redo',0],
[490,30,200,160,'Active Data Guard standby',1],[510,65,160,50,'Open read only|reports, backups',2],[510,125,160,50,'Redo applied|continuously',0],
[250,90,190,50,'Redo',0]],
[[190,150,250,115],[440,115,510,150]]);

const casc=O.dg(700,170,[
[10,50,130,70,'Primary|prod',2],[190,50,130,70,'Standby 1|stby1 (near)|receives from prod',0],[370,50,130,70,'Standby 2|stby2 (far)|receives from stby1',0],[550,50,140,70,'Less load and|bandwidth on|the primary',0]],
[[140,85,190,85],[320,85,370,85],[500,85,550,85]]);

/* ---------- 0: Active Data Guard ---------- */
L['ora-dg:7:0']={blocks:[
{p:'**Active Data Guard (ADG)** lets you **open the standby read only while redo apply keeps running**. The standby is both a DR copy and a working database for queries and reports.'},
{svg:adg},
{h:'Enable real-time query'},
{code:`-- On the standby (managed apply running, or stop first)
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE CANCEL;
ALTER DATABASE OPEN READ ONLY;
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT FROM SESSION;

SELECT open_mode, database_role FROM v$database;
-- READ ONLY WITH APPLY   PHYSICAL STANDBY`},
{p:'With the broker, when the standby is mounted, `EDIT DATABASE stby SET STATE = \'APPLY-ON\'` and open it read only. The broker keeps apply on.'},
{h:'What you can do on it'},
{t:[['Use','Notes'],
['**Reports and queries**','Offload read workload from the primary'],
['**Backups**','RMAN backups from the open standby'],
['**Monitoring and data export**','Read-only extraction'],
['**Read-mostly application**','With role-based services, send read connections to the standby']]},
{h:'How fresh is the data?'},
{code:`-- Session on the standby: fail if data is older than 5 seconds
ALTER SESSION SET STANDBY_MAX_DATA_DELAY = 5;
-- Or wait until apply has caught up to the last commit of this session on the primary
ALTER SESSION SYNC WITH PRIMARY;`},
{flow:['Open the standby read only with apply on','Create a standby role service for reports','Reports connect to that service','Primary load drops, standby stays a DR copy']},
{note:'Active Data Guard is an extra-cost option. Opening a standby read only without it stops redo apply, so the standby falls behind and cannot be used for fast failover.'}],
src:[['Active Data Guard',O.DG]]};

/* ---------- 1: Automatic block repair ---------- */
L['ora-dg:7:1']={blocks:[
{p:'Disk errors can damage a block. With Active Data Guard, **a corrupt block can be repaired automatically from the other database**, so users often do not see an error.'},
{h:'How it works'},
{t:[['Where the corruption is','What happens'],
['**Primary reads a corrupt block**','The primary asks the standby for a good copy, and repairs the block with it'],
['**Standby reads a corrupt block** (real-time query)','The standby asks the primary for a good copy and repairs it']]},
{flow:['A session reads a block and finds corruption','Oracle checks that the other database is available and in sync','It requests a good copy of the block','The block is repaired in memory and on disk','The session continues without an error']},
{h:'Requirements'},
{ul:['Active Data Guard option and an open, applying standby.','Real-time apply and a standby that is current.','The primary and standby are in a supported mode (Max Availability or Max Performance).','A physical corruption, not a logical one.']},
{h:'Check'},
{code:`SELECT * FROM v$database_block_corruption;
-- Look in the alert log for: "Automatic block repair" messages`},
{note:'Block repair covers many cases, but not all. A repaired block is a warning sign: look at the storage and the logs. The cause may still be there.'}],
src:[['Automatic block repair',O.DG]]};

/* ---------- 2: DML redirection ---------- */
L['ora-dg:7:2']={blocks:[
{p:'Normally an application that connects to the read-only standby cannot write. **DML redirection** lets it run **occasional writes** on the standby, which Oracle sends to the primary and then waits until the change is visible on the standby.'},
{h:'Enable'},
{code:`-- For one session
ALTER SESSION ENABLE ADG_REDIRECT_DML;

-- For the whole standby
ALTER SYSTEM SET adg_redirect_dml = TRUE SCOPE = BOTH;`},
{h:'Flow'},
{flow:['The application connects to the standby and runs an INSERT or UPDATE','Oracle redirects the statement to the primary','The primary commits it','The standby waits until the change has been applied','The session sees its own change on the standby']},
{t:[['Good for','Not for'],
['Applications with mostly reads and a few writes (session tables, audit rows)','Write-heavy applications'],
['Reports that update a status table','Bulk loads'],
['Simplifying application code: one connection for everything','Applications that need the lowest write latency']]},
{h:'Points'},
{ul:['Each redirected change is a round trip to the primary, so it is slower than a local write.','The commit waits for apply, so write latency includes apply time.','Not every statement type is supported. Check the reference for your release.','The primary must be reachable.']},
{note:'Use DML redirection to avoid rewriting a read-mostly application. Do not use it as a substitute for sending write workloads to the primary.'}],
src:[['DML redirection',O.DG]]};

/* ---------- 3: Snapshot standby ---------- */
L['ora-dg:7:3']={blocks:[
{p:'A **snapshot standby** is a physical standby that has been opened **read write** for testing. Redo from the primary is still **received**, but **not applied**. When you convert back, all your test changes are discarded and apply catches up.'},
{flow:['Convert the standby to a snapshot standby (a restore point is created)','The database opens read write, changes are allowed','The primary keeps sending redo, the standby stores it','Convert back to a physical standby: all test changes are flashed back','Apply starts and the standby catches up']},
{code:`DGMGRL> CONVERT DATABASE stby TO SNAPSHOT STANDBY;
-- test, load data, try an application upgrade...
DGMGRL> CONVERT DATABASE stby TO PHYSICAL STANDBY;

-- Without the broker
ALTER DATABASE CONVERT TO SNAPSHOT STANDBY;
ALTER DATABASE CONVERT TO PHYSICAL STANDBY;`},
{t:[['Aspect','Detail'],
['**Included in**','Enterprise Edition, no extra option'],
['**Needs**','Flash recovery area (a guaranteed restore point uses flashback logs)'],
['**Protection while open**','Redo is received, so no data is lost, but a failover takes longer (a backlog must be applied)'],
['**Duration**','Keep it short. Space and the apply backlog grow with time.']]},
{h:'Good uses'},
{ul:['Test an application release with real data volumes.','Try a patch or upgrade procedure on a copy of production.','Run performance tests that change data.']},
{note:'While in snapshot mode, your DR protection is reduced because the standby is far behind in apply. Do not leave it that way over a weekend unless you accept the risk.'}],
src:[['Snapshot standby',O.DG]]};

/* ---------- 4: Logical standby ---------- */
L['ora-dg:7:4']={blocks:[
{p:'A **logical standby** reads redo, turns it into **SQL statements** and applies them (**SQL Apply**). It has the same data as the primary, but the structure can differ, and it is open read write.'},
{t:[['','Physical standby','Logical standby'],
['**How**','Applies redo blocks','Applies SQL'],
['**Structure**','Identical','Can have extra indexes, materialized views, tables'],
['**Open mode**','Mounted or read only with ADG','Read write (for objects not maintained by apply)'],
['**Data types**','All','Some are not supported'],
['**Use**','DR','Rolling upgrades, reporting with extra structures']]},
{h:'Requirements'},
{ul:['Supplemental logging on the primary, so that rows can be identified.','Tables should have a primary key or unique index.','Check which objects are not supported.']},
{code:`-- Which tables cannot be replicated
SELECT owner, table_name, column_name, data_type FROM dba_logstdby_unsupported;
SELECT owner, table_name, bad_column FROM dba_logstdby_not_unique;

-- Primary: prepare the dictionary
ALTER DATABASE ADD SUPPLEMENTAL LOG DATA (PRIMARY KEY, UNIQUE) COLUMNS;
EXEC DBMS_LOGSTDBY.BUILD;

-- Logical standby
ALTER DATABASE START LOGICAL STANDBY APPLY IMMEDIATE;`},
{h:'When to use it'},
{ul:['As a **temporary** step in a rolling upgrade (`DBMS_ROLLING` converts a physical standby to a transient logical standby).','Rarely, for reporting with extra structures. GoldenGate or Active Data Guard are often better choices.']},
{note:'For plain disaster recovery use a physical standby. A logical standby is more complex and has limits that a physical one does not.'}],
src:[['Logical standby',O.DG]]};

/* ---------- 5: Cascaded and multiple standbys ---------- */
L['ora-dg:7:5']={blocks:[
{p:'A primary can feed **several standbys** (up to 30). A standby can also **forward redo to another standby**. This is called a **cascade**.'},
{svg:casc},
{h:'Why cascade'},
{ul:['Reduce the load and network use on the primary: it sends to one near standby only.','Reach a far-away standby over a better link from a near one.','Give each site a local copy.']},
{h:'Configure with the broker'},
{code:`-- The primary sends to stby1
DGMGRL> EDIT DATABASE prod SET PROPERTY RedoRoutes = '(prod : stby1 ASYNC)';
-- stby1 forwards redo that comes from prod to stby2
DGMGRL> EDIT DATABASE stby1 SET PROPERTY RedoRoutes = '(prod : stby2 ASYNC)';
DGMGRL> SHOW CONFIGURATION;`},
{t:[['Case','Notes'],
['**Cascaded standby**','Receives redo from another standby, not from the primary'],
['**Real-time cascade**','The first standby forwards redo as it arrives, not waiting for archive logs. Needs the Active Data Guard option.'],
['**Multiple standbys**','Different roles: one for fast failover, one for reports, one far away for DR'],
['**RedoRoutes**','Defines the routing for each primary and standby']]},
{h:'After a switchover'},
{p:'The **routes are role-based**. After a role change the broker applies the route defined for the new primary, so you set routes for every possible primary.'},
{flow:['List the standbys and their purpose','Draw the redo routes for each possible primary','Set RedoRoutes on each database','Test a switchover to each standby']},
{note:'More standbys mean more things to monitor and test. Add each one for a clear reason, and keep a diagram of the routes.'}],
src:[['Cascaded standbys',O.DG],['RedoRoutes',O.BKR]]};

/* ---------- 6: Practical ---------- */
L['ora-dg:7:6']={blocks:[
{p:'Open a standby for reporting, then use it as a snapshot standby for a test, then return it to physical. The reporting part needs the Active Data Guard option (a lab can use it for learning).'},
{h:'Part 1: Read-only with apply'},
{code:`-- On the standby
DGMGRL> EDIT DATABASE stby SET STATE = 'APPLY-OFF';
ALTER DATABASE OPEN READ ONLY;
DGMGRL> EDIT DATABASE stby SET STATE = 'APPLY-ON';

SELECT open_mode FROM v$database;      -- READ ONLY WITH APPLY

-- On the primary
INSERT INTO lab.t VALUES (SYSDATE); COMMIT;
-- On the standby, after a few seconds
SELECT COUNT(*) FROM lab.t;`},
{h:'Part 2: Freshness control'},
{code:`ALTER SESSION SET STANDBY_MAX_DATA_DELAY = 2;
SELECT COUNT(*) FROM lab.t;            -- ORA-03172 if the standby is more than 2 s behind`},
{h:'Part 3: Snapshot standby'},
{code:`DGMGRL> CONVERT DATABASE stby TO SNAPSHOT STANDBY;
-- on stby: open read write, make a test change
UPDATE lab.t SET d = SYSDATE;
COMMIT;
DGMGRL> CONVERT DATABASE stby TO PHYSICAL STANDBY;
DGMGRL> SHOW CONFIGURATION;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['Open mode in part 1','READ ONLY WITH APPLY'],
['New rows from the primary','Visible on the standby within seconds'],
['`STANDBY_MAX_DATA_DELAY`','ORA-03172 when the lag is above the limit'],
['Snapshot standby','Opens read write, changes allowed'],
['After converting back','Your test change is gone and apply catches up']]},
{h:'Questions'},
{ul:['What was the apply lag during part 1?','How long did the conversion back take, and why?','What would happen to a failover during part 3?']},
{note:'Without the Active Data Guard licence, skip part 1 and part 2. Snapshot standby does not need the option.'}],
src:[['Active Data Guard and snapshot standby',O.DG]]};

})();
