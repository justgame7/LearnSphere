/* LearnSphere - SQL Server High Availability & DR, Section 09: Disaster Recovery Planning.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const plan=M.dg(700,200,[
[10,20,150,70,'1. Business impact|analysis: what matters,|how fast',0],[185,20,150,70,'2. Define tiers|RPO and RTO per|application',2],[360,20,150,70,'3. Design|features, sites,|network',0],[535,20,155,70,'4. Implement|and document|runbooks',2],
[10,115,680,70,'5. Test regularly, review after every incident and every major change',0]],
[[160,55,185,55],[335,55,360,55],[510,55,535,55]]);

const tier=M.dg(700,200,[
[10,15,215,170,'Tier 1: critical',1],[25,50,185,30,'RPO near 0, RTO minutes',2],[25,90,185,30,'Sync AG + async DR',0],[25,130,185,30,'Tested every quarter',0],
[245,15,215,170,'Tier 2: important',1],[260,50,185,30,'RPO minutes, RTO hours',2],[260,90,185,30,'Async AG or log shipping',0],[260,130,185,30,'Tested twice a year',0],
[480,15,210,170,'Tier 3: standard',1],[495,50,180,30,'RPO hours, RTO a day',2],[495,90,180,30,'Backups to DR site',0],[495,130,180,30,'Tested yearly',0]],
[]);

const run=M.dg(700,170,[
[10,20,150,70,'Declare|who decides,|criteria',2],[180,20,150,70,'Fail over|data tier|then app tier',0],[350,20,150,70,'Redirect|DNS, listener,|connection strings',0],[520,20,170,70,'Verify|smoke tests,|inform users',2],
[10,110,680,50,'Written so a person who did not build the system can follow it under stress',0]],
[[160,55,180,55],[330,55,350,55],[500,55,520,55]]);

const test=M.dg(700,200,[
[10,20,215,70,'Tabletop|walk through the plan|with people',0],[245,20,215,70,'Component test|restore, single failover|in test',0],[480,20,210,70,'Full DR test|production failover|and failback',2],
[10,115,680,70,'Start small and grow: a plan that was never executed has unknown gaps',0]],
[[225,55,245,55],[460,55,480,55]]);

const back=M.dg(700,170,[
[10,25,150,70,'DR site is now|primary, running',2],[190,25,170,70,'Rebuild the|original site|catch up data',0],[390,25,150,70,'Reverse the|data flow|resync',0],[570,25,120,70,'Planned|switch back',2],
[10,115,680,40,'Failback is a planned change with its own downtime and risks',0]],
[[160,60,190,60],[360,60,390,60],[540,60,570,60]]);

/* ---------- 0: Building a DR plan ---------- */
L['mss-ha:8:0']={blocks:[
{p:'A **disaster recovery plan** is a documented, agreed way to restore service after a major loss. It starts with business impact, not with technology.'},
{svg:plan},
{h:'Inputs'},
{t:[['Input','Questions'],
['**Business impact analysis**','Which systems matter most? What does an hour of outage cost?'],
['**RPO and RTO per system**','Agreed with the business, written down'],
['**Dependencies**','Network, DNS, identity, other databases, file shares, certificates'],
['**Scenarios**','Server, rack, datacenter, region, cyber attack'],
['**Constraints**','Budget, skills, distance, regulation']]},
{h:'Tiers'},
{svg:tier},
{note:'One design rarely fits everything. Group systems into tiers and give each tier an appropriate level of investment.'}],
src:[['Business continuity',M.RD+'backup-restore/disaster-recovery-sql-server'],['Disaster recovery guidance','https://learn.microsoft.com/en-us/azure/architecture/framework/resiliency/backup-and-recovery']]};

/* ---------- 1: Runbooks ---------- */
L['mss-ha:8:1']={blocks:[
{p:'In a disaster people are stressed and short of time. A **runbook** turns the plan into exact steps.'},
{svg:run},
{h:'What every DR runbook contains'},
{ul:['**Trigger and authority**: what conditions allow failover, and who may declare it.','**Pre-checks**: current state of replicas, last log applied, network and storage.','**Ordered steps** with commands and expected results.','**Redirect** instructions: DNS, listener, load balancer, connection strings, jobs.','**Verification**: queries and application checks that prove it works.','**Communication**: who to tell, when, and how.','**Rollback or failback** outline.']},
{h:'Typical SQL Server steps'},
{flow:['Confirm the primary is lost or isolated','Fail over the AG (forced if needed) or recover the log shipping copy','Fix logins, jobs and linked servers on the DR instance','Point applications and DNS to the DR environment','Run smoke tests and inform stakeholders']},
{note:'Keep a copy of the runbook outside the system it describes. If the wiki is in the failed datacenter, nobody can read it.'}],
src:[['Business continuity',M.RD+'backup-restore/disaster-recovery-sql-server'],['Availability group failover',M.SS+'availability-groups/windows/failover-and-failover-modes-always-on-availability-groups']]};

/* ---------- 2: Testing ---------- */
L['mss-ha:8:2']={blocks:[
{p:'A DR plan that has not been **tested** is a guess. Testing finds the missing login, the wrong firewall rule and the step nobody wrote down.'},
{svg:test},
{t:[['Test','What it proves','Effort'],
['**Tabletop**','People know their role and the order of steps','Low'],
['**Restore test**','Backups restore, time is known','Medium'],
['**Single failover**','Technology works, applications reconnect','Medium'],
['**Full DR exercise**','End to end service in the DR site, then failback','High']]},
{h:'Plan a test'},
{flow:['Define scope, success criteria and a rollback','Inform stakeholders and pick a low-risk window','Execute from the runbook only, record times','Capture gaps and fix the runbook or design','Report results and schedule the next test']},
{note:'Measure real RPO and RTO during tests. They are usually worse than the numbers in the plan, and that is the main value of testing.'}],
src:[['Business continuity',M.RD+'backup-restore/disaster-recovery-sql-server'],['Test and validate DR','https://learn.microsoft.com/en-us/azure/architecture/framework/resiliency/testing']]};

/* ---------- 3: Failback ---------- */
L['mss-ha:8:3']={blocks:[
{p:'**Failback** returns service to the original site after the disaster is over. It is easy to forget, and it carries its own risks and outage.'},
{svg:back},
{h:'Common approaches'},
{t:[['Approach','How','Notes'],
['**Reverse the AG or log shipping**','The old primary becomes a secondary, catches up, then a planned failover','Fastest, needs the old site intact or rebuilt'],
['**Distributed AG switch**','Fail over in the reverse direction','Planned and clean'],
['**Rebuild and re-seed**','Rebuild old site, restore backups, then sync and switch','Slow, for severe loss'],
['**Stay and swap roles**','Keep the DR site as primary permanently','Simple, needs a new DR target']]},
{h:'Checklist'},
{ul:['Confirm the original site is **healthy** and secure.','Re-establish **replication** and verify it is synchronized.','Choose a **window** and tell users: failback has an outage.','Move **applications**, DNS and jobs, then verify.','Update **documentation** and re-run DR tests.']}],
src:[['Perform a planned manual failover',M.SS+'availability-groups/windows/perform-a-planned-manual-failover-of-an-availability-group-sql-server'],['Distributed AG failover',M.SS+'availability-groups/windows/configure-distributed-availability-groups']]};

})();
