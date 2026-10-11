/* LearnSphere - SQL Server Upgrade, Patching & Migration, Section 02: Upgrade Strategies.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const strat=M.dg(700,220,[
[10,15,330,190,'In-place upgrade',1],[25,55,300,30,'Setup upgrades the existing instance',2],[25,95,300,30,'Same server, same name, simple',0],[25,135,300,30,'Rollback is hard: restore or rebuild',0],[25,170,300,28,'Downtime during upgrade',0],
[360,15,330,190,'Side-by-side (migration)',1],[375,55,300,30,'New instance, new or same server',2],[375,95,300,30,'Move databases by backup or replication',0],[375,135,300,30,'Old instance kept for rollback',2],[375,170,300,28,'Short cutover, more work',0]],
[]);

const assess=M.dg(700,170,[
[10,25,200,70,'Scan source|instances and|databases',0],[250,25,200,70,'Report|breaking changes,|behavior changes,|deprecated features',2],[490,25,200,70,'Fix in code or|plan workarounds|retest',0],
[10,115,680,40,'Run the assessment on every database, including the small and forgotten ones',0]],
[[210,60,250,60],[450,60,490,60]]);

const compat=M.dg(700,170,[
[10,25,200,70,'Upgrade engine|keep old compat level|low risk',0],[250,25,200,70,'Baseline|Query Store captures|plans and runtime',2],[490,25,200,70,'Raise compat|compare, force plans|where needed',2],
[10,115,680,40,'Separate engine upgrade from optimizer change: two changes, two checks',0]],
[[210,60,250,60],[450,60,490,60]]);

const ab=M.dg(700,190,[
[10,20,200,70,'Capture workload|on production|trace or Extended Events',0],[250,10,200,50,'Replay on Target A|old version',0],[250,70,200,50,'Replay on Target B|new version',2],[490,20,200,70,'Compare|errors, duration,|result differences',2],
[10,130,680,50,'Provides data, not opinion, about what the upgrade changes',0]],
[[210,55,250,35],[210,55,250,95],[450,35,490,50],[450,95,490,70]]);

const chk=M.dg(700,150,[
[10,25,120,70,'Plan|scope, window,|owners',0],[150,25,120,70,'Assess|DMA or other,|fix',0],[290,25,120,70,'Test|workload,|performance',2],[430,25,120,70,'Upgrade|runbook|executed',2],[570,25,120,70,'Verify|and decide|keep or roll back',0]],
[[130,60,150,60],[270,60,290,60],[410,60,430,60],[550,60,570,60]]);

/* ---------- 0: In-place vs side-by-side ---------- */
L['mss-upg:1:0']={blocks:[
{p:'There are two basic ways to move to a newer SQL Server. They differ in **risk**, **downtime** and **effort**.'},
{svg:strat},
{t:[['','In-place','Side-by-side'],
['**Effort**','Low','Higher: new instance, move data and objects'],
['**Downtime**','The upgrade duration','Cutover only, with the right method'],
['**Rollback**','Hard','Easy: the old instance is still there'],
['**Hardware change**','No','Yes, can renew hardware or OS at the same time'],
['**Best for**','Small, non-critical, lab','Production, major version change, new platform']]},
{h:'Rolling upgrade of AG'},
{p:'For an availability group you can upgrade replicas one at a time, then fail over. It is a form of in-place upgrade with very short downtime, but the process is **one-way**: you cannot go back to the old version without a restore.'},
{note:'Choose side-by-side for production unless there is a strong reason not to. A kept copy of the old environment is the best insurance.'}],
src:[['Upgrade SQL Server',M.SS+'install/upgrade-sql-server'],['Choose a database engine upgrade method',M.SS+'install/choose-a-database-engine-upgrade-method']]};

/* ---------- 1: Pre-upgrade assessment ---------- */
L['mss-upg:1:1']={blocks:[
{p:'An **assessment** finds what will break or change before you upgrade. Microsoft has provided several tools for this over time, so check the current guidance for your path.'},
{svg:assess},
{h:'What an assessment reports'},
{t:[['Category','Meaning','Action'],
['**Breaking changes**','Features removed or behavior changed so code fails','Must fix before upgrade'],
['**Behavior changes**','Same code, different result or plan','Test and review'],
['**Deprecated features**','Still work, planned for removal','Plan to replace'],
['**Compatibility blockers**','Items that stop the target platform','Fix or choose another target']]},
{h:'Tools'},
{ul:['**Data Migration Assistant (DMA)**: long-standing assessment tool for SQL Server and Azure SQL targets. Microsoft has announced its retirement in favor of newer assessment features, so check current status.','**Azure Migrate** and the **Azure SQL migration** experiences for Azure targets.','**SSMS** and **Query Store** based comparisons for behavior changes.','Your own **code scans** for deprecated syntax and features.']},
{note:'A tool report is not a test. It finds known patterns. Always test the real application workload on the target.'}],
src:[['Data Migration Assistant overview',M.SS+'migrate/dma/data-migration-assistant-overview'],['Azure Migrate for SQL','https://learn.microsoft.com/en-us/azure/migrate/concepts-azure-sql-assessment-calculation']]};

/* ---------- 2: Compat levels and optimizer changes ---------- */
L['mss-upg:1:2']={blocks:[
{p:'The **compatibility level** is the main lever for controlling optimizer and T-SQL behavior after an upgrade. It lets you move the engine first and the behavior later.'},
{svg:compat},
{t:[['Setting','Controls'],
['**Compatibility level**','Optimizer features (CE version, IQP), T-SQL behavior'],
['**Database scoped configurations**','Legacy CE, parameter sniffing, batch mode on rowstore and more'],
['**Query hints and Query Store hints**','Per query behavior'],
['**Trace flags**','Older, instance wide, use only when documented as needed']]},
{code:`-- Upgrade, then keep the old behavior
ALTER DATABASE SalesDB SET COMPATIBILITY_LEVEL = 140;

-- Capture, then change when ready
ALTER DATABASE SalesDB SET QUERY_STORE = ON;
ALTER DATABASE SalesDB SET COMPATIBILITY_LEVEL = 160;`},
{note:'A database restored on a newer engine keeps its old compatibility level, and Query Store lets you compare plans before and after. The Performance sub-course explains the process in detail.'}],
src:[['ALTER DATABASE compatibility level',M.TS+'statements/alter-database-transact-sql-compatibility-level'],['Intelligent query processing',M.RD+'performance/intelligent-query-processing']]};

/* ---------- 3: DEA ---------- */
L['mss-upg:1:3']={blocks:[
{p:'To know how an upgrade affects **real workload**, replay it on the old and the new version and compare. The **Database Experimentation Assistant (DEA)** automates this A/B test.'},
{svg:ab},
{h:'How an A/B test works'},
{flow:['Take a backup of the production database to restore on both targets','Capture a trace of production workload for a period','Replay it on **Target 1**, the current version (the baseline)','Replay it on **Target 2**, the new version','Compare errors, duration and result differences']},
{ul:['**Same data**: restore the same backup on both targets.','**Same hardware**, if possible, so differences come from the version.','**Representative period**: include batch jobs and peak hours.']},
{h:'Alternatives'},
{ul:['**Query Store**: compare plans and runtime stats between compatibility levels.','**Query Tuning Assistant** for guided regression handling.','**Application tests**: functional and performance tests with the real app.']},
{note:'Capture and replay tools have limits: some workload cannot be replayed exactly. Treat the result as strong evidence, not a guarantee.'}],
src:[['Database Experimentation Assistant overview',M.SS+'migrate/dea/database-experimentation-assistant-overview'],['Query Tuning Assistant',M.RD+'performance/upgrade-dbcompat-using-qta']]};

/* ---------- 4: Checklist and rollback ---------- */
L['mss-upg:1:4']={blocks:[
{p:'An upgrade runs well when the **checklist** was written and rehearsed in advance.'},
{svg:chk},
{t:[['Phase','Items'],
['**Plan**','Scope, target version and edition, window, owners, communications'],
['**Prerequisites**','OS support, hardware, collations, supported drivers, licensing'],
['**Assess**','Compatibility and behavior reports, code fixes'],
['**Test**','Functional, performance, security, backup and restore on the target'],
['**Prepare**','Backups, rollback plan, runbook, access'],
['**Execute**','Cutover or in-place steps, with checkpoints'],
['**Verify**','Error log, jobs, logins, apps, performance against baseline'],
['**Close**','Update documentation, monitoring, decommission old after a hold period']]},
{h:'Rollback'},
{ul:['Keep the **old instance** and databases untouched for a defined period.','Know how to **redirect** applications back.','Decide **in advance** what data entered during the new period would be lost or must be copied back.']},
{note:'After the upgrade, set the compatibility level deliberately and raise it in a separate step once performance is verified.'}],
src:[['Upgrade planning',M.SS+'install/upgrade-sql-server'],['Plan and test the Database Engine upgrade plan',M.SS+'install/plan-and-test-the-database-engine-upgrade-plan']]};

})();
