/* LearnSphere - GoldenGate, Section 13: Production Readiness & Capstone.
   Lectures 0-4 are core, 5-9 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const plat=O.dg(700,250,[
[10,10,330,230,'Source side',1],[30,45,290,40,'Source database (logging, user, parameter)',0],[30,100,290,50,'Source deployment: Extract|local trail, distribution path',2],[30,165,290,60,'Monitoring, alerts, runbook, backups',0],
[360,10,330,230,'Target side',1],[380,45,290,40,'Target database (user, parameter)',0],[380,100,290,50,'Target deployment: Receiver, Replicat|remote trail',2],[380,165,290,60,'Secured (TLS, roles), HA, tested',0]],
[[340,125,360,125]]);

/* ---------- 0: Checklist ---------- */
L['ora-gg:12:0']={blocks:[
{p:'Before a replication carries real business data, check each area and keep the evidence.'},
{t:[['Area','Check','How'],
['**Databases**','ARCHIVELOG, FORCE LOGGING, supplemental logging, `ENABLE_GOLDENGATE_REPLICATION`','`V$DATABASE`, `SHOW PARAMETER`'],
['**Support**','Tables supported, keys present','`DBA_GOLDENGATE_SUPPORT_MODE`'],
['**Users**','Least-privilege GoldenGate users, credentials in the credential store','`INFO CREDENTIALSTORE`'],
['**Architecture**','Extract, trail, paths, Replicat sized and configured','`INFO ALL`, parameter files in version control'],
['**Initial load and sync**','Instantiated at the right SCN, lag low','`LAG`, comparisons'],
['**Error handling**','REPERROR rules reviewed, discard file monitored','Parameter review'],
['**Performance**','Lag within target at peak','Heartbeat table, metrics'],
['**Security**','TLS everywhere, named users and roles, secrets protected','Security review'],
['**HA and backup**','Failover tested, backups of deployments and wallets','Drill'],
['**Monitoring**','Process state, lag, discards, disk space, certificate expiry','Alert test'],
['**Operations**','Runbooks, on-call, change process','Documents'],
['**Licences**','GoldenGate licensed for all systems in use','Review']]},
{flow:['Walk through the checklist with a second engineer','Collect evidence for each item','Fix failures and repeat','Test failure scenarios','Go live']},
{note:'Treat the checklist as a gate. A failed item means not ready.'}],
src:[['GoldenGate Administration',O.GG]]};

/* ---------- 1: Sizing, monitoring, alerting ---------- */
L['ora-gg:12:1']={blocks:[
{p:'Decide the numbers for **size** and for **alerts** before you start. They become the baseline for operations.'},
{h:'Sizing baseline'},
{t:[['Item','Rule'],
['**CPU and memory**','Sized from tests at peak change rate, with headroom'],
['**Trail disk**','Peak change rate times the longest outage you accept, plus margin'],
['**Network**','Peak change rate with headroom'],
['**Database**','Extra redo and sessions on source and target accounted for']]},
{h:'Alert baseline'},
{t:[['Alert','Warning','Critical'],
['**Process state**','A process stopped','Abended or down for more than a few minutes'],
['**Lag**','Above your RPO divided by two','Above your RPO'],
['**Trail disk space**','80 percent','90 percent'],
['**Discard records**','Any new discards','Many discards'],
['**Heartbeat missing**','No update for 5 minutes','No update for 15 minutes'],
['**Certificate expiry**','30 days','7 days']]},
{h:'Where alerts go'},
{ul:['The same on-call process as the databases.','A dashboard that shows lag and process state at a glance.','A daily summary report for the team.']},
{flow:['Measure the change rate in a test','Set the sizes from the measurements','Define alerts from the business RPO','Test that alerts reach a person']},
{note:'Set the lag alert from the business need. If the business can accept 15 minutes of lag, alert at half of that, so there is time to act.'}],
src:[['Monitoring GoldenGate',O.GG]]};

/* ---------- 2: Runbooks and on-call ---------- */
L['ora-gg:12:2']={blocks:[
{p:'When a replication stops at night, the person on call must know **what to do**, from a document, not from memory.'},
{h:'Runbooks to write'},
{t:[['Runbook','Content'],
['**Daily checks**','What to look at and what healthy looks like'],
['**Process abended**','Where to read, common causes, how to restart'],
['**Lag growing**','Which stage, what to check, what to tune'],
['**Disk space**','How to find what grows, purge, extend'],
['**Failover of GoldenGate**','Exact steps, expected results, time'],
['**Cutover and fallback**','For migration projects, step by step with timings'],
['**Credential or certificate rotation**','How, who approves, what to restart']]},
{h:'On-call'},
{ul:['Know who is on call and who is the escalation.','Give the on-call person the access and tools they need.','Keep a simple incident log: time, symptom, cause, fix.','Review incidents monthly and improve the runbooks.']},
{flow:['Write the runbook from tested steps','Review with the team','Practise with a scenario','Update after every incident']},
{note:'A runbook should be short and exact. Use numbered steps with copy-ready commands, and the expected output after each.'}],
src:[['GoldenGate Administration',O.GG]]};

/* ---------- 3: Testing failure scenarios ---------- */
L['ora-gg:12:3']={blocks:[
{p:'A replication works in good weather. A production replication must work in **bad weather**. Test the failures you expect.'},
{t:[['Scenario','What to do','What you expect'],
['**Target down**','Stop the target database for an hour','Trail grows. After restart the Replicat catches up. No data loss.'],
['**Network break**','Block the path between source and target','Path retries. After restore, trail transfer resumes.'],
['**Extract stops**','Kill the Extract process','Restart continues from its checkpoint'],
['**Large batch**','Run a big update in one transaction','Lag spike, then recovery. Check memory and disk.'],
['**Host failure**','Stop the GoldenGate host (or its deployment)','Failover starts it elsewhere, processes resume'],
['**Source failover** (Data Guard)','Switch the source database','Extract recreated or resumed on the new primary, no data lost'],
['**Credential change**','Rotate a database password','Update the credential store, restart, replication resumes'],
['**Certificate expiry**','Simulate an expired certificate','Path stops, alert fires, renewal fixes it']]},
{h:'How to run the tests'},
{flow:['Plan the test and the expected result','Run it in a test or approved window','Measure: lag, time to recover, data differences','Fix what was wrong and repeat','Update the runbook']},
{note:'Compare the data after each test. A recovery that "looks fine" can still leave a difference that only a comparison finds.'}],
src:[['Testing GoldenGate',O.GG]]};

/* ---------- 4: Capstone ---------- */
L['ora-gg:12:4']={blocks:[
{p:'**Capstone.** Build a **secure, monitored, highly available replication platform**, and prove it with a migration and failure tests. Keep notes, because the notes are your deliverable.'},
{svg:plat},
{h:'Specification'},
{t:[['Requirement','Detail'],
['Source','Oracle database with an application schema, ARCHIVELOG, supplemental logging'],
['Target','A new Oracle database (a PDB), the same schema'],
['Replication','Integrated Extract, distribution path over `wss://`, parallel Replicat'],
['Transformation','At least one filter and one computed column'],
['Security','HTTPS, named users with roles, credentials only in the credential store'],
['HA','Deployment failover tested'],
['Monitoring','Heartbeat table, alerts for state, lag, discards and disk space'],
['Migration','Zero-downtime cutover with reverse replication for fallback'],
['Documentation','Runbooks for operations, failover and cutover']]},
{h:'Steps'},
{flow:['Install and create source and target deployments (section 3)','Prepare the databases (section 4)','Build and load the replication (sections 5 and 6)','Tune and monitor it (sections 8 and 9)','Secure it and set up HA (section 10)','Rehearse and run the cutover with fallback (section 11)','Write runbooks and test failure scenarios (this section)']},
{h:'Acceptance'},
{t:[['Test','Pass condition'],
['`INFO ALL` on both deployments','All RUNNING, lag under the target'],
['Data comparison','Counts and checksums equal'],
['Filter and computed column','Correct on the target'],
['No plain passwords','None in files or scripts'],
['Failover test','Processes resume from checkpoints on the other host'],
['Failure scenarios','Target down, network break and Extract stop recovered without data loss'],
['Cutover rehearsal','Downtime measured, fallback tested'],
['Runbooks','Complete and reviewed']]},
{h:'Self-assessment'},
{t:[['Level','Meaning'],
['**Foundation**','Replication works and you can explain every component'],
['**Solid**','You also broke it on purpose and diagnosed it from reports'],
['**Ready**','Another engineer can operate, fail over and cut over using your runbooks']]},
{note:'You have now finished the four advanced Oracle sub-courses on this path. Combine them: RAC and Data Guard for availability, Exadata for platform, GoldenGate for change.'}],
src:[['GoldenGate Administration',O.GG],['Oracle Database 19c documentation',D]]};

})();
