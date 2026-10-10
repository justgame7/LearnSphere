/* LearnSphere - Exadata, Section 07: Administration, Monitoring & Resource Management.
   Lectures 0-7 are core, 8-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const iorm=O.dg(700,230,[
[10,70,130,70,'Databases|PROD, TEST, DEV|send I/O requests',0],
[190,20,200,190,'IORM on every cell',1],[210,55,160,40,'1 Category plan|OLTP over batch',0],[210,105,160,40,'2 Database plan|shares and limits',2],[210,155,160,40,'3 Intra-DB plan|inside a database',0],
[440,70,250,70,'Disks and flash serve requests|in the order the plans decide|(no starvation of the important work)',2]],
[[140,105,190,105],[390,105,440,105]]);

const cage=O.dg(700,170,[
[10,20,680,140,'Server with 64 CPU cores',1],[30,60,200,60,'DB A|CPU_COUNT = 24',2],[250,60,200,60,'DB B|CPU_COUNT = 24',2],[470,60,200,60,'DB C|CPU_COUNT = 16',2]],[]);

/* ---------- 0: Admin tools ---------- */
L['ora-exa:6:0']={blocks:[
{p:'Section 3 introduced `cellcli`, `dcli`, `exacli` and `dbmcli`. This lecture shows how to use them together for **everyday administration** across all layers of the rack.'},
{h:'Tools by layer'},
{t:[['Layer','Tool','Use'],
['**Database servers**','`dbmcli`, `imageinfo`, `srvctl`, `crsctl`','Server config, software image version, database and cluster'],
['**Storage servers**','`cellcli`, `exacli`','Cell configuration, metrics, alerts, IORM'],
['**Switches**','Switch CLI, `patchmgr`','Fabric status and updates'],
['**All servers at once**','`dcli`','Run one command on a group of hosts']]},
{h:'Group files'},
{code:`# One host name per line
~/dbs_group        dbnode1  dbnode2
~/cell_group       cell01  cell02  cell03
~/all_group        (all of the above)`},
{h:'Check software versions'},
{code:`# The Exadata software image of every server
dcli -g ~/all_group -l root "imageinfo -ver"

# History of image updates on this server
imagehistory

# Quick health of all cells
dcli -g ~/cell_group -l root "cellcli -e list cell attributes name,status,cellsrvStatus"`},
{h:'Rules of thumb'},
{ul:['Keep the group files up to date when servers are added or removed.','Run read-only checks across everything. Run changes with care, one group at a time.','Keep a log of every command and its output for important changes.','Use the same versions across cells and database servers within the supported matrix.']},
{flow:['Define groups for DB servers, cells and all servers','Run list or check commands with dcli','Compare results across servers','Act on any server that differs']},
{note:'Version drift between servers is a common cause of strange behaviour. A quick imageinfo with dcli shows it in seconds.'}],
src:[['Exadata administration tools',O.EXA]]};

/* ---------- 1: Monitoring ---------- */
L['ora-exa:6:1']={blocks:[
{p:'Exadata monitoring covers hardware, storage software, network and database. A few key checks catch most problems.'},
{h:'What to monitor'},
{t:[['Area','Examples','Tool'],
['**Cell health**','Services running, disk and flash status','`cellcli`, cell alerts'],
['**Capacity**','ASM `USABLE_FILE_MB`, flash cache hit ratio','ASM views, cell metrics'],
['**I/O**','Cell disk utilisation, I/O latency, IORM waits','Cell metrics'],
['**Offload**','Smart Scan efficiency of key queries','Database statistics'],
['**Network**','RoCE errors, link status','Switch and OS counters'],
['**Database servers**','CPU, memory, swap','OS tools, ExaWatcher, EM']]},
{h:'Thresholds'},
{p:'You can set your own alert thresholds on cell metrics.'},
{code:`cellcli -e create threshold db_io_rq_sm_sec.prod comparison='>', critical=5000 -- illustrative
cellcli -e list threshold
cellcli -e list metriccurrent where name like 'CD_IO_UTIL_.*' and metricValue > 50`},
{h:'ExaWatcher'},
{p:'**ExaWatcher** runs on every server and records OS metrics (CPU, memory, I/O, network) at short intervals. It lets you look back at the minutes before an incident.'},
{code:`ls /opt/oracle.ExaWatcher/archive/
exawatcherctl status`},
{flow:['Collect metrics continuously','Compare with thresholds','Alert on exceptions','Keep history to explain incidents','Review trends monthly']},
{note:'Alert only on conditions that need action. Too many alerts are ignored, and that makes a real alert easy to miss.'}],
src:[['Monitoring Exadata',O.EXA]]};

/* ---------- 2: Enterprise Manager ---------- */
L['ora-exa:6:2']={blocks:[
{p:'**Oracle Enterprise Manager Cloud Control** includes an **Exadata plug-in**. It discovers the whole rack and presents it as one system.'},
{t:[['Feature','What you see'],
['**Rack view**','Picture of the rack with the health of each server, switch and cell'],
['**Dashboards**','Capacity, performance and incidents for the whole Exadata'],
['**I/O resource management**','View and edit IORM plans centrally'],
['**Alerts and incidents**','Cell and hardware alerts in one place, with rules and notifications'],
['**Databases**','The databases and their use of storage']]},
{h:'How it works'},
{flow:['Agents run on the database servers','The plug-in discovers cells, switches and ILOMs','Metrics and alerts flow to Cloud Control','Incident rules send mail or tickets']},
{h:'In the cloud'},
{p:'Cloud Exadata services provide monitoring in the **cloud console**, with metrics, alarms and database management features. Many of the same measurements are available as APIs.'},
{note:'Check the licences for management packs before you use the performance pages. The data itself still comes from the database and cells, so you can always use the command-line views.'}],
src:[['Enterprise Manager for Exadata',O.EXA]]};

/* ---------- 3: EXAchk and AHF ---------- */
L['ora-exa:6:3']={blocks:[
{p:'**EXAchk** checks an Exadata system against Oracle best practices and known issues, across hardware, firmware, OS, Grid Infrastructure and database. It is part of the **Autonomous Health Framework (AHF)**.'},
{h:'What it checks'},
{ul:['Firmware and software versions and combinations','Network, storage and ASM configuration','Grid Infrastructure and database settings','Known problems and recommended patches']},
{code:`exachk                      # interactive full check
exachk -a                   # all checks
tfactl status               # AHF and TFA state`},
{h:'Reading the report'},
{t:[['Result','Meaning'],
['**FAIL**','Fix it. A known problem or risk.'],
['**WARNING**','Review and decide'],
['**INFO**','For awareness'],
['**PASS**','As expected']]},
{h:'When to run it'},
{flow:['Before and after every patching cycle','After a hardware change or expansion','On a regular schedule (for example monthly)','Before you open a service request for a complex problem']},
{h:'TFA for diagnostics'},
{code:`tfactl diagcollect -from "2026-01-15 10:00:00" -to "2026-01-15 10:30:00"`},
{note:'Keep each report. Compare reports over time to see drift, and keep a list of findings you accepted with the reason.'}],
src:[['EXAchk and AHF','https://docs.oracle.com/en/engineered-systems/health-diagnostics/autonomous-health-framework/']]};

/* ---------- 4: IORM ---------- */
L['ora-exa:6:4']={blocks:[
{p:'Many databases can share the same cells. **I/O Resource Manager (IORM)** makes sure one busy database does not take all the I/O. The plans are set on **every cell**.'},
{svg:iorm},
{h:'Three levels of plan'},
{t:[['Plan','Controls','Example'],
['**Category plan**','I/O share between categories of consumers','OLTP gets priority over BATCH'],
['**Inter-database plan**','I/O share between databases','PROD 8 shares, TEST 2 shares, with limits'],
['**Intra-database plan**','Share between consumer groups inside one database','The database Resource Manager plan']]},
{h:'Set a database plan'},
{code:`# On each cell (use dcli to apply to all)
cellcli -e alter iormplan dbplan=((name=prod,share=8,limit=100),(name=test,share=2,limit=30),(name=default,share=1))

cellcli -e list iormplan detail

# Objective: tell IORM what to optimise
cellcli -e alter iormplan objective=auto`},
{t:[['Parameter','Meaning'],
['`share`','Relative priority when the cells are busy'],
['`limit`','Maximum percent of disk bandwidth, even when idle capacity exists'],
['`objective`','`auto`, `low_latency`, `balanced`, `high_throughput`, `basic`']]},
{h:'PDBs and flash'},
{ul:['Plans can also be written per PDB, so one CDB can share its I/O across PDBs.','IORM can limit use of flash cache for a database.','Set an `objective` that suits the mix: OLTP latency or warehouse throughput.']},
{h:'Check the effect'},
{code:`cellcli -e list metriccurrent where name like 'DB_IO_WT_.*'
cellcli -e list metriccurrent where name like 'DB_IO_UTIL_.*'`},
{flow:['Decide who gets priority and who is limited','Write the plan on one cell, then apply the same on all cells','Watch the wait metrics per database','Adjust shares and limits']},
{note:'Apply the same plan to every cell, or the effect will be uneven. Use dcli with a group file so all cells always match.'}],
src:[['I/O Resource Management',O.EXA]]};

/* ---------- 5: Instance caging ---------- */
L['ora-exa:6:5']={blocks:[
{p:'IORM controls **I/O**. **Instance caging** controls **CPU** for each database instance on a database server, so consolidated databases cannot take all the processors.'},
{svg:cage},
{h:'How to enable it'},
{t:[['Step','Action'],
['1','Set `CPU_COUNT` for each instance to the number of CPUs it may use'],
['2','Activate a resource manager plan (for example `DEFAULT_PLAN`) so the limit is enforced']]},
{code:`ALTER SYSTEM SET cpu_count = 24 SCOPE = BOTH SID = '*';
ALTER SYSTEM SET resource_manager_plan = 'DEFAULT_PLAN' SCOPE = BOTH SID = '*';

SELECT name, value FROM v$parameter WHERE name IN ('cpu_count','resource_manager_plan');`},
{h:'Two styles'},
{t:[['Style','Rule','Effect'],
['**Partitioning**','The sum of all CPU_COUNT values is not more than the number of cores','Guaranteed CPU for each database, predictable'],
['**Over-subscription**','The sum is more than the cores','Better use of idle capacity, but databases can compete at peaks']]},
{h:'At PDB level'},
{p:'Within a CDB, each PDB can also have its own `CPU_COUNT` and CDB resource plan shares. This is how you limit PDBs of one consolidated container.'},
{flow:['Plan how many cores each database needs','Choose partitioning or over-subscription','Set CPU_COUNT and activate a plan','Check actual use and adjust']},
{note:'Memory, I/O and CPU all need limits in a consolidated system. Instance caging covers CPU only, IORM covers I/O. Check HugePages and SGA sizes for memory.'}],
src:[['Instance caging',O.AD+'managing-resources-with-oracle-database-resource-manager.html']]};

/* ---------- 6: ASR and support ---------- */
L['ora-exa:6:6']={blocks:[
{p:'When a part of an Exadata fails, Oracle can open a service request **automatically** and send field service. You still need to know how to collect data when you open one yourself.'},
{h:'Automatic Service Request (ASR)'},
{t:[['Item','Meaning'],
['**ASR**','Hardware fault events create a service request in My Oracle Support automatically'],
['**ASR Manager**','Software that receives fault events and sends them to Oracle (on-premises)'],
['**Cloud services**','Oracle monitors the infrastructure and handles hardware faults for you']]},
{h:'When you open a request yourself'},
{code:`# Collect hardware diagnostics for a service request
/opt/oracle.SupportTools/sundiag.sh

# Software and cluster diagnostics
tfactl diagcollect -from "2026-01-15 10:00:00" -to "2026-01-15 10:30:00"`},
{t:[['Attach','Why'],
['`sundiag` output','Hardware and OS details for the failing server'],
['TFA or AHF collection','Database, ASM and Clusterware logs'],
['`imageinfo` and `imagehistory`','Exact software versions'],
['Alert text and time of event','Context']]},
{flow:['A fault occurs','ASR or you open a service request','Collect sundiag and TFA data','Oracle Support or field service responds','Replace the part, then check the system health']},
{note:'Keep the contact details and support identifier up to date. A request with wrong contact details can lose hours.'}],
src:[['Exadata support',O.EXA],['My Oracle Support',O.MOS]]};

/* ---------- 7: Practical ---------- */
L['ora-exa:6:7']={blocks:[
{p:'Create an IORM plan and observe what it does when two databases compete for I/O. This is meant for a test Exadata or a cloud walkthrough. Do not do it on a production system.'},
{h:'Step 1: Look at the current state'},
{code:`dcli -g ~/cell_group -l root "cellcli -e list iormplan attributes name,status,objective,dbPlan"
dcli -g ~/cell_group -l root "cellcli -e list metriccurrent where name like 'DB_IO_WT_SM_RQ'"`},
{h:'Step 2: Define the plan on all cells'},
{code:`dcli -g ~/cell_group -l root "cellcli -e alter iormplan dbplan=((name=prod,share=8),(name=test,share=2),(name=default,share=1))"
dcli -g ~/cell_group -l root "cellcli -e alter iormplan objective=auto"
dcli -g ~/cell_group -l root "cellcli -e list iormplan detail"`},
{h:'Step 3: Create load'},
{ul:['Run a heavy scan in the TEST database and a transaction test in the PROD database at the same time.','Use the same table size and the same number of sessions for both.']},
{h:'Step 4: Observe'},
{code:`dcli -g ~/cell_group -l root "cellcli -e list metriccurrent where name like 'DB_IO_WT_.*'"
dcli -g ~/cell_group -l root "cellcli -e list metriccurrent where name like 'DB_IO_UTIL_.*'"`},
{h:'Step 5: Remove the plan'},
{code:`dcli -g ~/cell_group -l root "cellcli -e alter iormplan dbplan=''"`},
{h:'What you should see'},
{t:[['With the plan','Without the plan'],
['PROD wait time stays low while TEST runs','Both databases compete equally, PROD wait time grows'],
['TEST gets a smaller share of I/O','TEST can take most of the bandwidth']]},
{note:'The shares matter only when I/O is contended. If there is idle I/O capacity, TEST can still use more than its share unless you also set a limit.'}],
src:[['I/O Resource Management',O.EXA]]};

})();
