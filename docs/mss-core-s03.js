/* LearnSphere - SQL Server Core DBA, Section 03: Installation & Configuration.
   Lectures 0-6 are core, 7-8 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const layout=M.dg(700,200,[
[10,10,680,180,'Separate volumes for different I/O patterns',1],
[30,45,140,60,'OS and binaries|C: or /',0],[190,45,140,60,'Data files|random reads',2],[350,45,140,60,'Log files|sequential writes',2],[510,45,160,60,'tempdb|heavy, short-lived',2],
[30,120,640,50,'Backups on a different volume and, ideally, a different failure domain',0]],
[]);

const flow=M.dg(700,110,[
[10,25,120,60,'Plan|OS, disks,|collation',0],[160,25,120,60,'Run Setup|features,|instance',0],[310,25,120,60,'Configure|accounts,|memory, MAXDOP',2],
[460,25,100,60,'Patch|latest CU',0],[590,25,100,60,'Verify|connect, test',0]],
[[130,55,160,55],[280,55,310,55],[430,55,460,55],[560,55,590,55]]);

const lin=M.dg(700,130,[
[10,35,140,60,'Add the|Microsoft repo',0],[180,35,140,60,'Install package|mssql-server',0],[350,35,160,60,'mssql-conf setup|edition, password',2],
[540,35,150,60,'Open port 1433|connect with sqlcmd',0]],
[[150,65,180,65],[320,65,350,65],[510,65,540,65]]);

const cont=M.dg(700,170,[
[10,20,680,140,'Container host',1],
[30,55,190,60,'Image|mcr.microsoft.com/mssql/server',0],[260,55,190,60,'Container|sqlservr process',2],[490,55,190,60,'Volume|/var/opt/mssql',0],
[260,125,190,30,'Port 1433 published',0]],
[[220,85,260,85],[450,85,490,85]]);

const svc=M.dg(700,150,[
[10,15,200,50,'Virtual account|NT SERVICE\\MSSQLSERVER',2],[250,15,200,50,'Managed service account|gMSA',0],[490,15,200,50,'Domain user|only if required',0],
[10,90,680,45,'Avoid: Local System, Local Administrator, domain admin. Give only the rights SQL Server needs.',0]],
[]);

const par=M.dg(700,160,[
[10,20,200,60,'Query estimated cost|above the threshold?',2],
[250,20,200,60,'Yes: plan may go|parallel, up to MAXDOP workers',0],[490,20,200,60,'No: serial plan|one worker',0],
[10,100,680,45,'Cost threshold default 5 is very low. MAXDOP default 0 means use all CPUs.',0]],
[[210,50,250,50],[210,60,490,60]]);

/* ---------- 0: Planning ---------- */
L['mss-core:2:0']={blocks:[
{p:'A good install starts **before Setup runs**. Some choices, such as collation and drive layout, are hard to change later. Decide them first and write them down.'},
{h:'Planning checklist'},
{t:[['Topic','Decide','Why'],
['**Version and edition**','2022 Standard or Enterprise, for example','Features, limits, licensing'],
['**OS**','Windows Server or a supported Linux','Support and tooling'],
['**CPU and RAM**','Cores and memory for the workload','Licensing is per core, so size carefully'],
['**Storage layout**','Separate data, log, tempdb and backup volumes','Different I/O patterns, easier tuning'],
['**Collation**','Instance default collation','Sets sorting and tempdb behavior'],
['**Accounts**','Service accounts and admin group','Least privilege'],
['**Patch level**','Latest CU for the version','Fixes and security']]},
{h:'A typical layout'},
{svg:layout},
{h:'Storage notes'},
{ul:['On Windows format data and log volumes **NTFS with 64 KB allocation unit size**.','On Linux use **XFS or ext4**.','Use fast, low-latency storage for log and tempdb first.','Keep the **backup volume separate** from the data volume.']},
{h:'Collation in one minute'},
{p:'Collation defines how text is sorted and compared (case, accent). The **instance collation** is set at install and becomes the default for system databases and tempdb. Databases can use a different collation, but comparing columns with different collations or joining to temp tables can cause errors. Pick a collation that matches your applications, and keep it the same across servers.'},
{h:'Check collation and file layout later'},
{code:`SELECT SERVERPROPERTY('Collation') AS instance_collation;

SELECT name, collation_name FROM sys.databases;`},
{note:'Changing the instance collation later means rebuilding the system databases. Choose it once, carefully.'}],
src:[['Hardware and software requirements for SQL Server 2022',M.SS+'install/hardware-and-software-requirements-for-installing-sql-server-2022'],['Collation and Unicode support',M.RD+'collations/collation-and-unicode-support']]};

/* ---------- 1: Windows install ---------- */
L['mss-core:2:1']={blocks:[
{p:'On Windows the **Setup wizard** installs the Database Engine, then you install **SSMS** separately. The wizard also lets you set several production-ready options during the install.'},
{svg:flow},
{h:'Steps in the Setup wizard'},
{flow:['New SQL Server stand-alone installation','Choose edition or product key','Select features: Database Engine Services (and nothing you do not need)','Instance configuration: default or named','Server configuration: service accounts and collation','Database Engine configuration: authentication mode, admins, data directories, tempdb, memory, MAXDOP','Install, then check the summary log']},
{h:'Choices inside the wizard'},
{t:[['Page','Recommended','Why'],
['**Authentication mode**','Windows only, unless apps need SQL logins','Less attack surface'],
['**SQL Server administrators**','Add a DBA group, not just yourself','Access if a person leaves'],
['**Perform volume maintenance tasks**','On','Faster data file growth (instant file initialization)'],
['**Data root and log directories**','On the planned volumes','Keep data, log and backups apart'],
['**tempdb**','Several equal-size data files','Reduces allocation contention'],
['**Memory**','Accept the recommended max server memory, then review','Leave room for the OS'],
['**MAXDOP**','Accept the recommendation, then review','Prevents runaway parallelism']]},
{note:'In SQL Server 2019 and later, Setup recommends tempdb files, max server memory and MAXDOP on the Database Engine configuration page. Use them as a start, not as the final answer.'},
{h:'Unattended install'},
{p:'Production installs should be repeatable. Setup can use a configuration file or command line. The additional lectures cover it; for now know that Setup produces a **ConfigurationFile.ini** under the setup log folder after each wizard run.'},
{h:'Verify the install'},
{code:`SELECT @@VERSION;

SELECT servicename, status_desc, service_account, startup_type_desc
FROM   sys.dm_server_services;`}],
src:[['Install SQL Server on Windows',M.DE+'install-windows/install-sql-server'],['Install SQL Server Management Studio','https://learn.microsoft.com/en-us/ssms/install/install']]};

/* ---------- 2: Linux install ---------- */
L['mss-core:2:2']={blocks:[
{p:'SQL Server runs natively on supported Linux distributions. The engine is the same, the install is a **package** and the main configuration tool is **mssql-conf**.'},
{svg:lin},
{h:'Install in four steps (Ubuntu example)'},
{code:`# 1. Add the Microsoft repository (see the docs for your distro and version)
# 2. Install the package
sudo apt-get update
sudo apt-get install -y mssql-server

# 3. Run setup: choose edition, accept license, set the SA password
sudo /opt/mssql/bin/mssql-conf setup

# 4. Check the service
systemctl status mssql-server`},
{note:'Use a long, unique SA password and keep it in a password manager. Never put real passwords in scripts or shell history.'},
{h:'Where things are'},
{t:[['Item','Path'],
['**Binaries**','`/opt/mssql/bin`'],
['**Data and log files**','`/var/opt/mssql/data`'],
['**Error log**','`/var/opt/mssql/log/errorlog`'],
['**Configuration file**','`/var/opt/mssql/mssql.conf`'],
['**Service**','`mssql-server`']]},
{h:'mssql-conf'},
{code:`# Limit memory (MB)
sudo /opt/mssql/bin/mssql-conf set memory.memorylimitmb 4096

# Change the TCP port
sudo /opt/mssql/bin/mssql-conf set network.tcpport 1433

# Change default data and log locations
sudo /opt/mssql/bin/mssql-conf set filelocation.defaultdatadir /data/sql
sudo /opt/mssql/bin/mssql-conf set filelocation.defaultlogdir  /logs/sql

sudo systemctl restart mssql-server`},
{h:'What differs from Windows'},
{ul:['Authentication is **SQL logins**, or Active Directory with extra setup.','There is no Configuration Manager: use `mssql-conf` and `systemctl`.','Some Windows-only features are missing; check the feature list for your version.','Open TCP **1433** in the firewall for remote clients.']}],
src:[['Install SQL Server on Linux',M.LX+'sql-server-linux-setup'],['Configure with mssql-conf',M.LX+'sql-server-linux-configure-mssql-conf']]};

/* ---------- 3: Containers ---------- */
L['mss-core:2:3']={blocks:[
{p:'A **container** is the fastest way to get a clean SQL Server for a lab, a test or a CI pipeline. It starts in seconds and can be deleted without trace.'},
{svg:cont},
{h:'Start one'},
{code:`docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=<StrongPassword>" \\
  -p 1433:1433 --name sql1 \\
  -v sqldata:/var/opt/mssql \\
  -d mcr.microsoft.com/mssql/server:2022-latest

docker logs sql1          # watch the startup
docker exec -it sql1 /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C`},
{h:'What each option does'},
{t:[['Option','Meaning'],
['`ACCEPT_EULA=Y`','Accepts the license terms'],
['`MSSQL_SA_PASSWORD`','Sets the SA password: must meet complexity rules'],
['`-p 1433:1433`','Publishes the port'],
['`-v sqldata:/var/opt/mssql`','Keeps databases outside the container'],
['`MSSQL_PID`','Selects the edition, for example Developer']]},
{note:'Without a volume, deleting the container deletes your databases. Always mount a volume for anything you want to keep.'},
{h:'Good uses and limits'},
{ul:['**Good**: labs, dev, test, CI, learning, demos.','**Plan carefully**: production in containers needs persistent storage, resource limits, monitoring and an orchestration strategy.','Containers run the Linux edition, so Windows-only features are not available.']}],
src:[['Run SQL Server Linux containers with Docker',M.LX+'quickstart-install-connect-docker'],['SQL Server container images','https://mcr.microsoft.com/en-us/product/mssql/server/about']]};

/* ---------- 4: Service accounts ---------- */
L['mss-core:2:4']={blocks:[
{p:'SQL Server services run under an account. That account decides what the engine can read and write on the machine, so an over-privileged account turns a SQL Server bug into a server compromise.'},
{svg:svc},
{h:'Choices on Windows'},
{t:[['Account type','Pros','Cons'],
['**Virtual account** (default)','No password to manage, local only','Cannot be used for network resources'],
['**Group managed service account (gMSA)**','Automatic password rotation, works across servers','Needs Active Directory setup'],
['**Domain user**','Works with shares and clusters','You must rotate the password'],
['**Local System / Administrator**','Convenient','Too much power: avoid']]},
{h:'Rights the account needs'},
{ul:['**Log on as a service** (granted by Setup).','**Perform volume maintenance tasks** for instant file initialization (optional but recommended).','**Lock pages in memory** only if you have measured a need.','Read and write on its data, log and backup folders.']},
{note:'Change service accounts only with SQL Server Configuration Manager. It also updates the service master key and registry permissions, which the Services console does not.'},
{h:'Check them'},
{code:`SELECT servicename, service_account, startup_type_desc, status_desc,
       instant_file_initialization_enabled
FROM   sys.dm_server_services;`},
{h:'On Linux'},
{p:'The engine runs as the **mssql** user, created by the package. Data and log folders must be owned by it.'}],
src:[['Configure Windows service accounts and permissions',M.DE+'configure-windows/configure-windows-service-accounts-and-permissions'],['Database instant file initialization',M.RD+'databases/database-instant-file-initialization']]};

/* ---------- 5: sp_configure ---------- */
L['mss-core:2:5']={blocks:[
{p:'**sp_configure** is the standard way to read and change instance-level settings. Know how it works, which options matter and which are dangerous.'},
{h:'The pattern'},
{code:`-- Show all options, including advanced ones
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure;

-- Change one option
EXEC sp_configure 'backup compression default', 1;
RECONFIGURE;

-- Compare configured and running values
SELECT name, value, value_in_use, is_dynamic, is_advanced
FROM   sys.configurations
ORDER  BY name;`},
{h:'How a change becomes active'},
{flow:['sp_configure stores config_value','RECONFIGURE applies dynamic options','Non-dynamic options need an instance restart','value_in_use shows what is really active']},
{h:'Options a DBA touches often'},
{t:[['Option','Purpose','Typical action'],
['`max server memory (MB)`','Limit memory','Set it'],
['`max degree of parallelism`','Limit CPUs per query','Set it'],
['`cost threshold for parallelism`','When plans go parallel','Raise from 5'],
['`optimize for ad hoc workloads`','Smaller plan cache for one-time queries','Consider on'],
['`backup compression default`','Compress backups by default','On, if CPU allows'],
['`remote admin connections`','Dedicated admin connection from remote','On for emergencies'],
['`xp_cmdshell`','Run OS commands','Keep off'],
['`clr enabled`, `Ole Automation Procedures`','Extensibility','Off unless needed']]},
{note:'Change one option at a time, record the old value and the reason, and test. Some options, such as xp_cmdshell, widen the attack surface.'}],
src:[['Server configuration options',M.DE+'configure-windows/server-configuration-options-sql-server'],['sp_configure',M.RD+'system-stored-procedures/sp-configure-transact-sql']]};

/* ---------- 6: Memory, MAXDOP, cost threshold ---------- */
L['mss-core:2:6']={blocks:[
{p:'Three settings have the largest effect on a new server: **max server memory**, **MAXDOP** and **cost threshold for parallelism**. The defaults are rarely right for production.'},
{h:'1. Max server memory'},
{p:'Default is practically all RAM. Set a limit that leaves room for the OS, other services and drivers. Section 2 explained why.'},
{h:'2. Cost threshold and MAXDOP'},
{svg:par},
{t:[['Setting','Default','Common starting point'],
['`cost threshold for parallelism`','5','25 to 50 for most OLTP servers'],
['`max degree of parallelism`','0 (all CPUs)','See the guidance below']]},
{h:'MAXDOP starting guidance'},
{t:[['Server layout','Suggested MAXDOP'],
['One NUMA node, 8 or fewer logical CPUs','Number of logical CPUs'],
['One NUMA node, more than 8 logical CPUs','8'],
['Several NUMA nodes, 16 or fewer logical CPUs per node','Logical CPUs per node'],
['Several NUMA nodes, more than 16 logical CPUs per node','Half the CPUs per node, up to 16']]},
{note:'These are Microsoft starting points, not final values. Review wait statistics such as CXPACKET and CXCONSUMER after the change, and test the workload.'},
{h:'Set them'},
{code:`EXEC sp_configure 'show advanced options', 1; RECONFIGURE;

EXEC sp_configure 'cost threshold for parallelism', 50;
EXEC sp_configure 'max degree of parallelism', 8;
RECONFIGURE;

-- Per-database override (2016 and later)
ALTER DATABASE SCOPED CONFIGURATION SET MAXDOP = 4;

-- Per query
-- SELECT ... OPTION (MAXDOP 1);`},
{h:'Check the server layout'},
{code:`SELECT cpu_count, scheduler_count, numa_node_count = (SELECT COUNT(*) FROM sys.dm_os_nodes WHERE node_state_desc <> 'ONLINE DAC')
FROM   sys.dm_os_sys_info;`}],
src:[['Configure the max degree of parallelism',M.DE+'configure-windows/configure-the-max-degree-of-parallelism-server-configuration-option'],['Configure the cost threshold for parallelism',M.DE+'configure-windows/configure-the-cost-threshold-for-parallelism-server-configuration-option'],['Server memory options',M.DE+'configure-windows/server-memory-server-configuration-options']]};

})();
