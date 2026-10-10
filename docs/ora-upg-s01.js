/* LearnSphere - Upgrade, Patching & Migration, Section 01: Release, Patch & Lifecycle Fundamentals.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const UG=O.D+'upgrd/';
const MOSNOTE='Check My Oracle Support (Doc ID 742060.1) for current dates.';

/* ---------- diagrams ---------- */
const rel=O.dg(700,190,[
[10,50,200,90,'Long-Term Release|19c, 26ai|years of support,|regular RUs',2],
[260,50,200,90,'Innovation Release|shorter support,|new features first',0],
[510,50,180,90,'Your choice|stability and long|support vs. new features',0]],
[[210,95,260,95],[460,95,510,95]]);

const cycle=O.dg(700,170,[
[10,45,130,80,'Quarterly|Release Update|(RU)',2],
[190,45,130,80,'Test on a|copy of production',0],
[370,45,130,80,'Apply to|non-prod, then prod',0],
[550,45,140,80,'Verify, record|in the register',0]],
[[140,85,190,85],[320,85,370,85],[500,85,550,85]]);

/* ---------- 0: Release model ---------- */
L['ora-upg:0:0']={blocks:[
{p:'Oracle Database releases come in two kinds. Know which one you run, because it decides how long you are supported.'},
{svg:rel},
{t:[['Term','Meaning','Example'],
['**Long-Term Release**','Supported for many years, receives regular Release Updates','19c, 26ai'],
['**Innovation Release**','Newer features, shorter support period','23ai (innovation) preceded 26ai'],
['**Release Update (RU)**','Quarterly bundle of fixes (security, bug, regression)','19.24, 19.25...'],
['**Version naming**','Since 23ai: year-based (23ai, 26ai) with RU numbers such as 26.1','Check the release notes']]},
{h:'What this means for a DBA'},
{ul:['Production should normally run a **long-term** release.','A new long-term release is the usual upgrade target (19c to 26ai).','A database is "patched" within a release and "upgraded" between releases.']},
{note:MOSNOTE}],
src:[['Database Upgrade Guide',UG],['Support policy',O.MOS]]};

/* ---------- 1: Patch types ---------- */
L['ora-upg:0:1']={blocks:[
{p:'Patches come in several forms. Choose by purpose.'},
{t:[['Patch type','What it is','When to use'],
['**Release Update (RU)**','Quarterly bundle: security, critical bug and regression fixes','The standard, every quarter'],
['**Release Update Revision (RUR)**','Previous RU plus only security and critical fixes (discontinued for newer releases)','Check availability for your release'],
['**Monthly Recommended Patches (MRP)**','Extra fixes on top of an RU between quarters','Platform-specific recommended fixes'],
['**One-off (interim) patch**','A fix for one bug','A specific problem you hit'],
['**Bundle patch**','Patches for a component or platform (for example Windows, Exadata)','Platform specific'],
['**Critical Patch Update (CPU)**','The security patch set of each quarter','Security compliance'],
['**Oracle JVM / OJVM**','Separate patch for the embedded Java VM','If JVM is used']]},
{h:'What is cumulative?'},
{ul:['An **RU** includes fixes of earlier RUs of the same release. You can apply a later one directly.','One-off patches may conflict with an RU. They are checked and sometimes need a **merge** (MLR).']},
{note:'Always read the README of each patch. It lists prerequisites, conflicts, and post-install steps (datapatch).'}],
src:[['Patching',UG]]};

/* ---------- 2: CSPU and CPU cycle ---------- */
L['ora-upg:0:2']={blocks:[
{p:'Oracle changed the **security patch** delivery from 2026. Read the current announcement before you plan, as details can change. **[26ai]**'},
{t:[['','Quarterly CPU (earlier model)','Monthly CSPU (newer model)'],
['**Content**','Security fixes together with the quarterly RU','Security-only fixes, delivered monthly'],
['**Frequency**','Four times a year','Every month'],
['**Effort**','One larger change','Smaller, more frequent changes'],
['**Risk**','Bigger test scope','Smaller test scope, more repetitions']]},
{h:'Planning impact'},
{ul:['Move toward **automated** patching (gold images, AutoUpgrade patch mode).','Keep a standard monthly slot and a standard rollback.','Decide which environments take every monthly patch and which only quarterly RUs.']},
{flow:['Oracle announces the patch set','Assess severity (CVSS) and exposure','Test in non-production','Apply in production in the agreed window','Record the result']},
{note:'Names and cadence for each release are published on My Oracle Support. This course gives the concept: see the current announcement for exact details.'}],
src:[['Critical Patch Updates','https://www.oracle.com/security-alerts/']]};

/* ---------- 3: Support timelines ---------- */
L['ora-upg:0:3']={blocks:[
{p:'Support dates decide how long you can stay on a release. Plan upgrades **before** the end.'},
{t:[['Support level','Meaning'],
['**Premier Support**','Full support: patches, fixes, certification'],
['**Extended Support**','Continued patches for a period, usually at extra cost'],
['**Sustaining Support**','No new fixes. Existing patches and help only.'],
['**Error correction**','Date until new fixes are produced for a release']]},
{h:'Planning'},
{ul:['Find the end dates for **each** release you run (MOS Doc ID 742060.1).','Upgrade projects take **months**: start 12 to 18 months before the end date.','Third-party applications must certify the new release.']},
{flow:['List all databases with release and end of support','Order by earliest end date','Check application certification','Create the upgrade plan with dates','Review every quarter']},
{note:'A date written in a course can be outdated. Always take support dates from the official support policy.'}],
src:[['Lifetime Support Policy','https://www.oracle.com/support/lifetime-support/'],['MOS Doc ID 742060.1',O.MOS]]};

/* ---------- 4: Reading READMEs ---------- */
L['ora-upg:0:4']={blocks:[
{p:'Every patch has a **README**. Read it before you apply anything. It is short and decisive.'},
{t:[['README section','What to look for'],
['**Prerequisites**','Minimum OPatch version, base release, required other patches'],
['**Patch conflicts**','Conflicting one-off patches, merge patch needed'],
['**Download notes**','Platform and component (DB, GI, OJVM)'],
['**Steps**','Online or offline, order for RAC, GI before DB'],
['**Post-install**','`datapatch` (SQL changes), recompile, parameters'],
['**Rollback**','`opatch rollback`, `datapatch -rollback`'],
['**Known issues**','Issues and workarounds']]},
{flow:['Find the patch on My Oracle Support by number or via the RU Doc ID','Download for your platform and version','Read the README fully','Run pre-checks (`opatch prereq`)','Plan steps and rollback']},
{h:'Key documents'},
{ul:['**Release Update** notes for your release (MOS: "Database Release Updates" documents).','**Patch Set Update** and "Known Issues" documents for the RU.','OPatch download (latest version) in MOS patch 6880880.']},
{note:'Update OPatch **first**. Many failures come from an old OPatch that does not support the new patch format.'}],
src:[['My Oracle Support',O.MOS]]};

/* ---------- 5: Patch strategy ---------- */
L['ora-upg:0:5']={blocks:[
{p:'A patch **strategy** says how often, where first, and how to roll back.'},
{svg:cycle},
{t:[['Decision','Typical answer'],
['**Cadence**','Each quarterly RU (or at most one RU behind), plus critical security out of band'],
['**Environments**','Development, test, pre-production (like production), production'],
['**Order**','Non-production first. Some time gap (weeks) before production.'],
['**Method**','Out-of-place with gold images (preferred), rolling for RAC, standby first'],
['**Rollback**','Prepared and rehearsed, with restore point or previous home'],
['**Risk acceptance**','Who may delay a patch and for how long']]},
{h:'Risk based approach'},
{ul:['Exposed systems and high CVSS fixes first.','Critical business systems get more testing, not less patching.']},
{note:'A patch you never apply fixes nothing. Skipping several RUs makes the next step harder and riskier.'}],
src:[['Patch management',UG]]};

/* ---------- 6: Practical ---------- */
L['ora-upg:0:6']={blocks:[
{p:'**Build a patch calendar and inventory** for your (or a sample) estate.'},
{h:'Inventory'},
{t:[['Database','Release / RU','Platform','Environment','Support end','RAC / DG'],
['ERP','19.20','Linux','Prod','__','RAC + DG'],
['CRM','19.18','Linux','Prod','__','Single'],
['DW','19.22','Exadata','Prod','__','RAC'],
['TEST1','19.22','Linux','Test','__','Single']]},
{code:`-- collect the facts from each database
SELECT banner_full FROM v$version;
SELECT patch_id, action, status, description FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 5 ROWS ONLY;
SELECT name, cdb, open_mode FROM v$database;`},
{h:'Calendar'},
{t:[['Quarter','Action'],
['Q1','Non-prod RU test, production in week 4'],
['Q2','Same'],
['Q3','Same, plus review of support dates'],
['Q4','Same, plus upgrade project milestones']]},
{h:'Check your result'},
{ul:['Every database has a release, a patch level and a support end date.','The calendar has a test date before every production date.','Each database has a named owner and a rollback method.']},
{note:'Keep the inventory in one place and update it automatically from the databases. A manual spreadsheet decays in a month.'}],
src:[['Patching and upgrade planning',UG]]};

})();
