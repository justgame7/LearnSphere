/* LearnSphere - SQL Server Operations, Monitoring & Automation, Section 04: Multi-Server Administration.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const cms=M.dg(700,200,[
[10,15,680,170,'Central Management Server (CMS)',1],
[30,55,190,50,'CMS instance|stores server groups',2],[255,45,190,35,'Group: Production',0],[255,90,190,35,'Group: Test',0],[480,45,190,35,'SQLPROD01',0],[480,90,190,35,'SQLPROD02',0],
[30,135,640,40,'Run one query or evaluate one policy against every server in a group',0]],
[[220,80,255,62],[220,80,255,108],[445,62,480,62],[445,62,480,108]]);

const msx=M.dg(700,200,[
[10,20,200,70,'Master server MSX|defines the job once',2],[260,10,180,50,'Target TSX 1',0],[260,70,180,50,'Target TSX 2',0],[490,20,200,70,'Status and history|reported back',0],
[10,125,680,60,'Master and target Agent: one job, many servers. Targets enlist with the master and poll for new jobs.',0]],
[[210,45,260,35],[210,55,260,95],[440,45,490,55]]);

const pbm=M.dg(700,190,[
[10,20,160,70,'Facet|properties of a|thing: Database',0],[190,20,160,70,'Condition|AutoShrink = False',2],[370,20,160,70,'Policy|condition + target|+ mode',2],[550,20,140,70,'Evaluate|on demand or|schedule',0],
[10,115,680,60,'Modes: on demand, on schedule, on change log only, on change prevent (for some facets)',0]],
[[170,55,190,55],[350,55,370,55],[530,55,550,55]]);

const inv=M.dg(700,170,[
[10,25,150,70,'Collect|version, build,|edition, size',0],[190,25,150,70,'Store|central table|or CMDB',2],[370,25,150,70,'Compare|to standard|and policy',0],[550,25,140,70,'Act|patch, fix,|retire',2]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

/* ---------- 0: CMS ---------- */
L['mss-ops:3:0']={blocks:[
{p:'A **Central Management Server (CMS)** is a SQL Server instance that holds **groups of registered servers**. From it you can run one query on many servers at once.'},
{svg:cms},
{h:'Use it for'},
{ul:['**Run a query** on every server of a group, for example to find the version or a setting.','**Evaluate policies** against many servers.','Keep a **shared list** of servers organized by environment.']},
{flow:['Choose an instance (not a production server being managed) as the CMS','In SSMS, Registered Servers, Central Management Servers, register it','Create **server groups**, such as Production and Test','Register servers into groups','Right-click a group, New Query']},
{note:'Queries run with the **Windows authentication** of the person who runs them, so access follows their rights. A CMS cannot be a member of its own groups.'}],
src:[['Central Management Servers',M.SS+'central-management-servers/create-a-central-management-server-and-server-group'],['Run a query against a server group',M.SS+'central-management-servers/administer-multiple-servers-using-central-management-servers']]};

/* ---------- 1: Master and target jobs ---------- */
L['mss-ops:3:1']={blocks:[
{p:'**Master and target (MSX/TSX) administration** lets you define a SQL Server Agent job **once** and run it on many servers.'},
{svg:msx},
{h:'How it works'},
{flow:['Designate one instance as the **master** (MSX)','**Enlist** other instances as **targets** (TSX)','Create jobs on the master and assign them to targets','Targets poll the master, run the job and report status back']},
{t:[['Pros','Cons'],
['One definition, consistent jobs everywhere','Master is a dependency: protect and monitor it'],
['Central history and status','Requires encrypted connections and permissions setup'],
['Good for standard maintenance','Less flexible than a deployment pipeline']]},
{note:'Many teams now deploy identical jobs with scripts or a pipeline from source control instead. Choose the approach that your team can support.'}],
src:[['Multiserver environments',M.RD+'sql-server-agent/automated-administration-across-an-enterprise'],['Create a multiserver environment',M.RD+'sql-server-agent/create-a-multiserver-environment']]};

/* ---------- 2: Policy-Based Management ---------- */
L['mss-ops:3:2']={blocks:[
{p:'**Policy-Based Management (PBM)** lets you express standards, such as "AUTO_SHRINK is off", as **policies** and check or enforce them on many servers.'},
{svg:pbm},
{t:[['Term','Meaning'],
['**Facet**','A set of properties of a managed object, such as Database or Server Configuration'],
['**Condition**','A rule about a facet property'],
['**Policy**','A condition applied to targets, with an evaluation mode'],
['**Category**','A group of policies, used to organize and subscribe']]},
{h:'Typical use'},
{ul:['**Audit standards**: AUTO_CLOSE off, recovery model, collation, naming.','**Run against a CMS group** to get a compliance report.','Use **evaluation on schedule** and review failures.']},
{note:'On change prevent mode is available only for some facets. For most checks PBM reports, it does not fix. Combine it with a script or pipeline to remediate.'}],
src:[['Policy-Based Management',M.RD+'policy-based-management/administer-servers-by-using-policy-based-management'],['Create a policy',M.RD+'policy-based-management/create-a-policy-based-on-a-facet-on-a-managed-target']]};

/* ---------- 3: Inventory and standards ---------- */
L['mss-ops:3:3']={blocks:[
{p:'You cannot manage what you cannot list. An **inventory** is the base of patching, licensing, security reviews and capacity work.'},
{svg:inv},
{h:'What to record per instance'},
{t:[['Item','Why'],
['**Host, instance, port, environment, owner**','Who and where'],
['**Version, build, edition**','Patching and licensing'],
['**Cores and memory**','Licensing and sizing'],
['**Databases and sizes**','Capacity'],
['**HA role and DR partner**','Protection map'],
['**Last backup and last CHECKDB**','Recoverability'],
['**Service accounts, certificates and expiry**','Security and renewals']]},
{h:'Standards'},
{ul:['Write down **configuration standards**: memory, MAXDOP, tempdb, collation, naming, file layout.','Make them **checkable** with scripts or PBM.','Review them with every **new version** and after incidents.']},
{code:`Get-DbaInstanceProperty -SqlInstance (Get-Content .\\servers.txt) |
  Where-Object Name -in 'VersionString','Edition','Processors','PhysicalMemory' |
  Select-Object SqlInstance, Name, Value`}],
src:[['dbatools instance properties','https://docs.dbatools.io/Get-DbaInstanceProperty'],['Central Management Servers',M.SS+'central-management-servers/administer-multiple-servers-using-central-management-servers']]};

})();
