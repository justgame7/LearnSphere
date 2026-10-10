/* LearnSphere - SQL Server Core DBA, Section 04: Tools & Connectivity.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const tools=M.dg(700,200,[
[10,10,680,180,'Pick the tool for the job',1],
[30,45,200,55,'SSMS|full admin GUI, Windows',2],[250,45,200,55,'VS Code + mssql|queries, cross-platform',0],[470,45,200,55,'sqlcmd|scripts and automation',0],
[30,120,200,50,'PowerShell|SqlServer, dbatools',0],[250,120,200,50,'Configuration Manager|services and protocols',0],[470,120,200,50,'Browser based|Azure portal for Azure SQL',0]],
[]);

const net=M.dg(700,180,[
[10,60,120,60,'Client|driver',0],
[170,10,200,50,'Shared memory|same machine',0],[170,65,200,50,'TCP/IP|usual choice',2],[170,120,200,50,'Named pipes|legacy',0],
[410,60,130,60,'Listener in|the instance',0],[580,60,110,60,'Database',0]],
[[130,90,170,35],[130,90,170,90],[130,90,170,145],[370,90,410,90],[540,90,580,90]]);

const trbl=M.dg(700,110,[
[10,25,120,60,'1. Name|resolves?',0],[150,25,120,60,'2. Port|reachable?',0],[290,25,120,60,'3. Service|running?',0],
[430,25,120,60,'4. Protocol|enabled?',0],[570,25,120,60,'5. Login and|permission?',2]],
[[130,55,150,55],[270,55,290,55],[410,55,430,55],[550,55,570,55]]);

const dmv=M.dg(700,170,[
[10,10,680,150,'Dynamic management views answer: who, what, how slow, how full',1],
[30,45,140,60,'Sessions|dm_exec_sessions|dm_exec_requests',0],[190,45,140,60,'Waits|dm_os_wait_stats',0],
[350,45,150,60,'Indexes|dm_db_index_usage|_stats',0],[520,45,150,60,'Space and I/O|dm_io_virtual|_file_stats',0],
[30,120,640,32,'Data lives in memory: counters reset when the instance restarts',0]],
[]);

/* ---------- 0: SSMS ---------- */
L['mss-core:3:0']={blocks:[
{p:'**SQL Server Management Studio (SSMS)** is the main graphical tool for DBAs on Windows. It connects to SQL Server, Azure SQL and Analysis Services, and lets you query, manage, monitor and script nearly everything.'},
{svg:tools},
{h:'What SSMS gives you'},
{ul:['**Object Explorer**: databases, security, Agent jobs, replication and more.','**Query editor**: IntelliSense, execution plans, results grid.','**Script button**: every dialog can generate its T-SQL instead of running it. Use it to learn and to keep changes in source control.','**Activity Monitor**, **Reports** and **Query Store** reports.']},
{h:'Azure Data Studio and its successor'},
{p:'Azure Data Studio was a lightweight, cross-platform query tool. Microsoft announced its retirement in early 2026 and points users to **Visual Studio Code with the MSSQL extension** instead. If you meet it on an older machine, the skills carry over directly.'},
{t:[['Tool','Best for','Platform'],
['**SSMS**','Administration, plans, jobs, security','Windows'],
['**VS Code + MSSQL extension**','Queries, notebooks, source control, developers','Windows, Linux, macOS'],
['**Azure portal query editor**','Quick Azure SQL checks','Browser']]},
{h:'First habits'},
{flow:['Connect and note the instance version','Switch to the right database before running anything','Use the Script button to review changes','Run read-only queries first on production']},
{note:'Version of SSMS is separate from the server version. A recent SSMS can connect to older servers, but check the notes for features that need a matching version.'}],
src:[['SQL Server Management Studio','https://learn.microsoft.com/en-us/ssms/'],['MSSQL extension for Visual Studio Code','https://learn.microsoft.com/en-us/sql/tools/visual-studio-code/sql-server-develop-use-vscode'],['Azure Data Studio retirement','https://learn.microsoft.com/en-us/azure-data-studio/']]};

/* ---------- 1: sqlcmd and VS Code ---------- */
L['mss-core:3:1']={blocks:[
{p:'**sqlcmd** is the command-line client. It is how you run scripts in automation, remote sessions, containers and Linux hosts where no GUI exists.'},
{h:'Common usage'},
{code:`# Windows authentication (current user)
sqlcmd -S SQLPROD01 -E -Q "SELECT @@VERSION"

# SQL authentication, prompts for the password
sqlcmd -S SQLPROD01 -U appuser -d SalesDB

# Run a script file and save the output
sqlcmd -S SQLPROD01 -E -d master -i check_server.sql -o result.txt

# Trust the server certificate in a lab with a self-signed certificate
sqlcmd -S localhost -U sa -C`},
{h:'Options to remember'},
{t:[['Option','Meaning'],
['`-S`','Server or instance, with optional port: `host,1433`'],
['`-E`','Use Windows authentication'],
['`-U` / `-P`','SQL login and password (prefer to be prompted)'],
['`-d`','Starting database'],
['`-Q` / `-q`','Run a query and exit / keep the session open'],
['`-i` / `-o`','Input script file / output file'],
['`-C`','Trust the server certificate (lab only)'],
['`-A`','Dedicated administrator connection (DAC)']]},
{note:'Recent drivers encrypt by default. In a lab with a self-signed certificate you may need -C. In production install a trusted certificate instead of trusting blindly.'},
{h:'VS Code with the MSSQL extension'},
{ul:['Install the **SQL Server (mssql)** extension.','Add a connection profile: server, auth type, database.','Run queries, view results, export to CSV or JSON, and keep scripts in Git.','Works on Windows, Linux and macOS, including with containers.']},
{h:'The dedicated admin connection'},
{p:'If the server is overloaded and normal connections fail, the **DAC** is a reserved connection for emergencies. Enable `remote admin connections` so you can use it from another machine, then connect with `sqlcmd -A` or `ADMIN:` before the server name.'}],
src:[['sqlcmd utility',M.SQL+'tools/sqlcmd/sqlcmd-utility'],['MSSQL extension',M.SQL+'tools/visual-studio-code/sql-server-develop-use-vscode'],['Diagnostic connection for database administrators',M.DE+'configure-windows/diagnostic-connection-for-database-administrators']]};

/* ---------- 2: Configuration Manager ---------- */
L['mss-core:3:2']={blocks:[
{p:'**SQL Server Configuration Manager** controls the services and the **network protocols** of each instance. It is separate from SSMS because it must work even when the instance is stopped.'},
{svg:net},
{h:'What you manage here'},
{t:[['Area','What you do'],
['**SQL Server Services**','Start, stop, change service accounts and startup mode'],
['**SQL Server Network Configuration**','Enable protocols, set ports, force encryption'],
['**SQL Native Client configuration**','Client protocol order and aliases']]},
{h:'Protocols'},
{t:[['Protocol','Use'],
['**Shared Memory**','Local connections on the same machine'],
['**TCP/IP**','Normal remote connections: enable it'],
['**Named Pipes**','Legacy: leave off unless needed']]},
{h:'Ports'},
{ul:['The **default instance** listens on TCP **1433**.','**Named instances** use a **dynamic port** by default, found by clients through the **SQL Server Browser** service on UDP 1434.','For firewalls and predictable access, set a **static TCP port** for named instances.']},
{h:'Check what the instance is listening on'},
{code:`SELECT local_net_address, local_tcp_port, net_transport, encrypt_option
FROM   sys.dm_exec_connections
WHERE  session_id = @@SPID;

-- Error log also shows: Server is listening on ...
EXEC sp_readerrorlog 0, 1, 'listening';`},
{note:'After changing protocols or ports a restart of the instance is required. Plan it, and open the firewall for the new port before you restart.'}],
src:[['SQL Server Configuration Manager',M.RD+'sql-server-configuration-manager'],['Configure a server to listen on a specific TCP port',M.DE+'configure-windows/configure-a-server-to-listen-on-a-specific-tcp-port'],['SQL Server Browser service',M.DE+'configure-windows/sql-server-browser-service-database-engine-and-ssas']]};

/* ---------- 3: Connection troubleshooting ---------- */
L['mss-core:3:3']={blocks:[
{p:'Most connection problems are **not** SQL Server problems. Work through the path from the client to the login in order, and the cause is usually found in minutes.'},
{svg:trbl},
{h:'A connection string, annotated'},
{code:`Server=tcp:SQLPROD01,1433;
Database=SalesDB;
User Id=appuser;
Password=<from-a-secret-store>;
Encrypt=True;
TrustServerCertificate=False;
Application Name=OrdersApi;`},
{ul:['**Server**: host, optional protocol and port.','**Encrypt / TrustServerCertificate**: modern drivers encrypt by default. Trusting any certificate is acceptable only in a lab.','**Application Name**: lets you identify the app in DMVs and logs.']},
{h:'Check each step'},
{code:`# 1 and 2: name and port from the client (PowerShell)
Test-NetConnection -ComputerName SQLPROD01 -Port 1433

# 3 and 4: on the server
-- SELECT @@SERVERNAME;  -- is the instance up and named as expected?
-- EXEC sp_readerrorlog 0, 1, 'listening';

# 5: try a known-good login with sqlcmd
sqlcmd -S SQLPROD01 -E -Q "SELECT SUSER_SNAME()"`},
{h:'Common errors'},
{t:[['Message','Usual cause'],
['**Error 53 or 40: network path / cannot open connection**','Wrong name, TCP disabled, blocked firewall, instance down'],
['**Error 26: cannot locate server**','Browser service stopped or named instance name wrong'],
['**Error 18456: login failed**','Bad password, disabled login, no access; check the **state** in the error log'],
['**Error 4060: cannot open database**','Database offline or login has no access to it'],
['**Certificate chain not trusted**','Untrusted or self-signed certificate with Encrypt on']]},
{note:'The client sees a vague login message by design. The **error log on the server** records the real state number for error 18456, which tells you whether it is a password, a disabled account or a missing database.'}],
src:[['Resolve connectivity errors','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/connect/resolve-connectivity-errors-overview'],['MSSQLSERVER_18456',M.SQL+'relational-databases/errors-events/mssqlserver-18456-database-engine-error']]};

/* ---------- 4: DMVs ---------- */
L['mss-core:3:4']={blocks:[
{p:'**Dynamic management views (DMVs)** are built-in views that expose the **live state** of the engine. They are the DBA main source of truth for sessions, waits, memory, I/O and indexes, and almost every tuning script is built on them.'},
{svg:dmv},
{h:'Four to start with'},
{t:[['View','Question it answers'],
['`sys.dm_exec_sessions`','Who is connected, from where, using which login?'],
['`sys.dm_exec_requests`','What is running right now, and what is it waiting for?'],
['`sys.dm_os_wait_stats`','What has the server waited on since it started?'],
['`sys.dm_io_virtual_file_stats`','How much I/O and how much stall per file?']]},
{h:'Try them'},
{code:`-- Who is connected
SELECT session_id, login_name, host_name, program_name, status
FROM   sys.dm_exec_sessions
WHERE  is_user_process = 1;

-- What is running and the SQL text
SELECT r.session_id, r.status, r.wait_type, r.cpu_time, t.text
FROM   sys.dm_exec_requests r
CROSS  APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE  r.session_id <> @@SPID;

-- Top waits
SELECT TOP (10) wait_type, wait_time_ms, waiting_tasks_count
FROM   sys.dm_os_wait_stats
ORDER  BY wait_time_ms DESC;`},
{h:'Rules of the road'},
{ul:['Most DMVs need **VIEW SERVER STATE** (or **VIEW SERVER PERFORMANCE STATE** in 2022 and later). Database-scoped ones need VIEW DATABASE STATE.','Counters are **cumulative since the last restart**: compare two samples, or read them after a known time.','DMVs show what is **in memory now**. A DMV is not a history table.']},
{note:'Many DMV results include benign system waits. Filter them before drawing conclusions. The Performance sub-course shows a safe filter.'}],
src:[['Dynamic management views and functions',M.RD+'system-dynamic-management-views/system-dynamic-management-views'],['Execution related DMVs',M.RD+'system-dynamic-management-views/execution-related-dynamic-management-views-and-functions-transact-sql']]};

})();
