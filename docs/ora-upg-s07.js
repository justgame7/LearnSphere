/* LearnSphere - Upgrade, Patching & Migration, Section 07: Upgrade & Patching Capstone.
   Lectures 0-3 are core, 4+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const UG=O.D+'upgrd/';
const UG26=O.D26+'upgrd/';

/* ---------- diagrams ---------- */
const run=O.dg(700,230,[
[10,10,680,210,'End to end change',1],
[30,45,120,60,'T-30 days|plan, analyze,|rehearse',0],
[170,45,120,60,'T-7 days|fixups, backup,|approvals',0],
[310,45,120,60,'T-0|stop, upgrade,|convert',2],
[450,45,120,60,'T+0|verify, open,|smoke test',2],
[590,45,90,60,'T+7 days|stabilize,|COMPATIBLE',0],
[30,130,640,70,'Fallback point: after verify, a decision with the business: go forward or restore',0]],
[[150,75,170,75],[290,75,310,75],[430,75,450,75],[570,75,590,75]]);

/* ---------- 0: Runbook ---------- */
L['ora-upg:6:0']={blocks:[
{p:'A change of this size needs a **runbook**: an ordered list of steps, with owners, commands, timings, checks and a fallback.'},
{svg:run},
{t:[['Section','Content'],
['**Purpose and scope**','What changes, what does not, which systems'],
['**Roles**','Executor, reviewer, application owner, communications, decision maker'],
['**Pre-checks**','Backups, restore point, space, accounts, patch level, approvals'],
['**Steps**','Numbered, with exact commands, expected output and time'],
['**Verification**','Technical and application checks'],
['**Go / no-go points**','Where the decision is made and by whom'],
['**Fallback**','Exact commands, tested, with time to complete'],
['**Contacts**','Who to call']]},
{flow:['Write the runbook from the rehearsal','Review it with a second engineer','Walk through it on a dry run','Freeze it before the change','Update after the change']},
{note:'If a step is not in the runbook, you should not do it during the change. If you must, add it, with the reason, to the log.'}],
src:[['Upgrade Guide',UG]]};

/* ---------- 1: Testing and performance comparison ---------- */
L['ora-upg:6:1']={blocks:[
{p:'Testing proves **function** and **performance**. Both matter.'},
{t:[['Test','What','Tool'],
['**Functional**','Application features, batch jobs, interfaces','Application test suite'],
['**Performance**','Key transactions and top SQL: elapsed and plans','SPA, AWR compare, SPM'],
['**Capacity**','Concurrency and peak load','Database Replay or load test'],
['**Operations**','Backup, restore, monitoring, patching after the change','Runbooks'],
['**Failure**','Failover, switchover, rollback','Drill'],
['**Security**','Accounts, encryption, auditing still work','Checklist']]},
{h:'Performance comparison'},
{flow:['Capture baseline (AWR) and top SQL on the old release','Run the same workload on the new release','Compare with AWR Compare and SPA','Fix regressions (statistics, SPM baselines)','Accept when key transactions are equal or better']},
{h:'Acceptance'},
{ul:['Key transaction times within agreed limits.','No new top-5 waits without an explanation.','No invalid objects beyond the baseline.']},
{note:'Agree the acceptance criteria **before** the test. Otherwise the discussion afterwards is about opinions.'}],
src:[['Testing upgrades',UG]]};

/* ---------- 2: Communication and rollback decisions ---------- */
L['ora-upg:6:2']={blocks:[
{p:'Technical skill is half the work. **Communication** and **decisions** are the other half.'},
{t:[['When','Message','Audience'],
['**Weeks before**','What changes, when, downtime, what to test','Users and application owners'],
['**Day before**','Final reminder, contacts','Everyone affected'],
['**Start**','Window started','Stakeholders'],
['**Milestones**','Upgrade done, verification started','Project team'],
['**End**','Result, checks, what to report','Everyone'],
['**If rollback**','Decision and impact','Management, users']]},
{h:'Rollback decision'},
{t:[['Decision','Rule'],
['**Who decides**','The named decision maker (not the executor alone)'],
['**Latest time for go**','Time to finish plus fallback time must fit the window'],
['**Criteria**','A failed critical check, unfixable in agreed time'],
['**Record**','Time, reason, data used']]},
{h:'Change record'},
{ul:['Plan, approvals and risk.','Execution log with timestamps.','Evidence of verification.','Lessons for the next change.']},
{note:'Set the **latest go time** in advance. If you are at that time and not finished, the decision is already taken: roll back.'}],
src:[['Change management',UG]]};

/* ---------- 3: Capstone ---------- */
L['ora-upg:6:3']={blocks:[
{p:'**Capstone.** Upgrade a **primary and standby** from 19c to 26ai with a fallback. Use a lab. Keep a log: the runbook and the evidence are the deliverable.'},
{h:'Specification'},
{t:[['Item','Requirement'],
['Source','19c non-CDB primary with a physical standby (Data Guard)'],
['Target','26ai CDB, the database becomes a PDB'],
['Method','AutoUpgrade with conversion on the primary and the Data Guard procedure for the standby (see the Data Guard sub-course) or rolling upgrade'],
['Fallback','Guaranteed restore point and a tested path back'],
['Verification','Component status, application test, SPA or AWR comparison'],
['Downtime','Measured and below your agreed budget'],
['Documentation','Runbook, change record, post-upgrade report']]},
{h:'Steps'},
{flow:['Inventory and analyze (AutoUpgrade analyze)','Fix and rehearse the whole procedure on a copy','Take backups and create restore points on both sites','Execute the upgrade and convert the non-CDB','Rebuild or upgrade the standby and verify redo apply','Verify, compare performance, run the application test','Decide: go forward, or roll back','Stabilize, then raise COMPATIBLE and remove restore points']},
{h:'Acceptance'},
{t:[['Test','Pass condition'],
['`DBA_REGISTRY`','All components VALID at version 26'],
['`V$PDBS`','Database open READ WRITE as a PDB'],
['Data Guard','Standby applies redo, lag zero, switchover works'],
['Application','Smoke and key transaction tests pass'],
['Performance','Within acceptance limits (SPA or AWR)'],
['Fallback','Demonstrated on a second copy'],
['Runbook','Complete, with timings']]},
{h:'Self-assessment'},
{t:[['Level','Meaning'],
['**Foundation**','You completed the upgrade following the steps'],
['**Solid**','You also rehearsed failures and rolled back once'],
['**Ready**','Another engineer can run it from your runbook and you know the real downtime']]},
{note:'You have now finished the Upgrade, Patching and Migration sub-course. Combine it with Backup (restore points), Data Guard (rolling) and GoldenGate (near zero downtime) for your real projects.'}],
src:[['Upgrade Guide (26ai)',UG26],['Data Guard',O.DG],['Oracle Database 19c documentation',D]]};

})();
