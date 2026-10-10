/* LearnSphere - SQL Server Core DBA, Section 01: Introduction & SQL Server Foundations.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const stack=M.dg(700,200,[
[10,70,120,60,'Client|SSMS, app',0],[170,70,120,60,'TCP port 1433|or named pipes',0],
[330,10,360,180,'SQL Server instance',1],
[350,50,160,110,'Database Engine|SQLOS, memory,|query processor',2],[530,50,150,110,'Database files|MDF, NDF, LDF',0]],
[[130,100,170,100],[290,100,350,100],[510,105,530,105]]);

const comps=M.dg(700,260,[
[10,10,680,240,'One SQL Server installation can include',1],
[30,45,190,60,'Database Engine|stores, processes, secures data',2],[255,45,190,60,'SQL Server Agent|jobs, alerts, schedules',0],[480,45,190,60,'Full-Text Search|text indexes',0],
[30,125,190,60,'Integration Services|ETL packages',0],[255,125,190,60,'Analysis Services|cubes, tabular models',0],[480,125,190,60,'Machine Learning and|PolyBase|optional features',0],
[30,200,640,36,'This course covers the Database Engine and SQL Server Agent: the DBA core',0]],
[]);

const eds=M.dg(700,150,[
[10,20,150,60,'Express|free, small limits',0],[190,20,150,60,'Developer|free, non-production|full features',0],
[370,20,150,60,'Standard|core engine,|lower limits',2],[550,20,140,60,'Enterprise|all features,|highest limits',2],
[10,100,680,36,'Same engine and T-SQL in every edition: editions differ in limits and features',0]],
[]);

const life=M.dg(700,150,[
[10,30,125,70,'2017|14.x|extended to 2027',0],[145,30,125,70,'2019|15.x|extended to 2030',0],
[280,30,135,70,'2022|16.x|baseline of this course',2],[425,30,125,70,'2025|17.x|current release',2],
[560,30,130,70,'Next|about every|2 to 3 years',0]],
[[135,65,145,65],[270,65,280,65],[415,65,425,65],[550,65,560,65]]);

const fam=M.dg(700,200,[
[10,70,150,60,'Core DBA|this course',2],
[210,10,230,180,'Operate well',1],[225,40,200,36,'Backup, Restore and Recovery',0],[225,86,200,36,'Performance and Tuning',0],[225,132,200,36,'Security and Compliance',0],
[480,10,210,180,'Scale and move',1],[495,40,180,36,'High Availability and DR',0],[495,86,180,36,'Upgrade and Migration',0],[495,132,180,36,'Operations and Azure SQL',0]],
[[160,100,210,100],[440,100,480,100]]);

/* ---------- 0: Course overview ---------- */
L['mss-core:0:0']={blocks:[
{p:'This course takes you from zero to someone who can **install, run, secure and troubleshoot Microsoft SQL Server**. It is the first of eight SQL Server sub-courses and the base for all the others. The baseline is **SQL Server 2022**, the release most new deployments use today. Where **2019** or **2025** work differently, the lecture says so.'},
{h:'Key terms in one minute'},
{t:[['Term','Plain meaning'],
['**Instance**','One running copy of the SQL Server engine with its own memory, settings and databases.'],
['**Database**','The data and log files that hold your data, inside an instance.'],
['**T-SQL**','Transact-SQL: the SQL dialect SQL Server uses.'],
['**SSMS**','SQL Server Management Studio: the main graphical admin tool.'],
['**DMV**','Dynamic management view: a built-in view of the live state of the server.'],
['**DBA**','Database administrator: keeps the database available, safe, fast and recoverable.']]},
{h:'Who this is for'},
{t:[['You are','What you need first'],
['New to SQL Server, comfortable with databases','Basic SQL: SELECT, INSERT, joins'],
['A developer moving to operations','Basic Windows or Linux: files, services, a shell'],
['A DBA from PostgreSQL or Oracle','Nothing more: the vocabulary lecture maps the differences']]},
{p:'You do not need prior SQL Server experience. A free Developer Edition or a container on your own machine is enough for every lab.'},
{h:'The route through the course'},
{flow:['Foundations (Section 1)','Architecture: how SQL Server works inside (Section 2)','Install and configure (Section 3)','Tools and connectivity (Section 4)','Files, storage and the log (Sections 5 and 6)','Tables, indexes and data types (Section 7)','Concurrency and locking (Section 8)','Maintenance (Section 9)','Production readiness and capstone (Section 10)']},
{h:'The ten sections at a glance'},
{t:[['#','Section','After it you can'],
['1','Introduction & SQL Server Foundations','Explain what SQL Server is and how the courses fit'],
['2','SQL Server Architecture','Describe what runs inside the engine'],
['3','Installation & Configuration','Install on Windows, Linux and containers and set the key options'],
['4','Tools & Connectivity','Use SSMS, sqlcmd and DMVs and fix connection problems'],
['5','Databases, Files & Storage','Create databases and size files and tempdb'],
['6','The Transaction Log','Explain the log and fix a full log'],
['7','Tables, Indexes & Data Types','Choose data types and design basic indexes'],
['8','Concurrency, Locking & Isolation','Explain blocking and pick an isolation level'],
['9','Maintenance','Keep indexes, statistics and integrity healthy'],
['10','Production Readiness & Capstone','Hand over a production-ready instance']]},
{h:'How lectures are tagged'},
{ul:['Lectures without a tag apply to **SQL Server 2022** and, unless stated, to 2019 and 2025.','A **2025** note marks something new or changed in that release.','A **Linux** note marks where the platform differs from Windows.']},
{note:'Commands are written for a lab. Never run them on a production server without understanding them first and testing in a non-production instance.'}],
src:[['SQL Server documentation',M.SQL],['What is new in SQL Server 2022',M.SS+'what-s-new-in-sql-server-2022'],['What is new in SQL Server 2025',M.SS+'what-s-new-in-sql-server-2025']]};

/* ---------- 1: What SQL Server is ---------- */
L['mss-core:0:1']={blocks:[
{p:'**SQL Server** is Microsoft relational database server. It stores data in tables, answers T-SQL queries and keeps data safe, consistent and recoverable. It runs on Windows, Linux and in containers, and the same engine powers Azure SQL.'},
{h:'The picture to keep in mind'},
{svg:stack},
{p:'A client connects over the network to an **instance**. The instance runs the engine, reads and writes the database files and returns results.'},
{h:'Components of an installation'},
{svg:comps},
{t:[['Component','What it does','DBA concern'],
['**Database Engine**','Stores data, runs queries, enforces security','Yes: the focus of this course'],
['**SQL Server Agent**','Runs scheduled jobs and alerts','Yes: backups and maintenance'],
['**Integration Services (SSIS)**','Data movement and ETL packages','Sometimes: deploy and monitor'],
['**Analysis Services (SSAS)**','Cubes and tabular models','Rarely'],
['**Reporting Services (SSRS)**','Reports','Rarely: separate install since 2022']]},
{h:'Editions'},
{svg:eds},
{t:[['Edition','Use','Key point'],
['**Enterprise**','Large production','All features, OS-maximum memory and cores'],
['**Standard**','Departmental and mid-size production','Core engine, lower limits and fewer features'],
['**Developer**','Development and test','Free, Enterprise features, no production use'],
['**Express**','Small apps and learning','Free, small database size limit, no Agent'],
['**Evaluation**','Trial','Full features for 180 days']]},
{note:'Express has no SQL Server Agent, so you schedule jobs with the operating system instead. Edition limits and feature lists change between versions: check the editions page for your release.'},
{h:'See what you are running'},
{code:`SELECT @@VERSION;

SELECT SERVERPROPERTY('ProductVersion')  AS version,
       SERVERPROPERTY('Edition')         AS edition,
       SERVERPROPERTY('EngineEdition')   AS engine_edition,
       SERVERPROPERTY('ProductUpdateLevel') AS cu;`}],
src:[['Editions and components of SQL Server 2022',M.SS+'editions-and-components-of-sql-server-2022'],['SQL Server documentation',M.SQL]]};

/* ---------- 2: Versions and lifecycle ---------- */
L['mss-core:0:2']={blocks:[
{p:'A new SQL Server version arrives about every two to three years. Each version has a fixed support lifecycle, so knowing the version, build and support dates is the first thing a DBA checks on any server.'},
{h:'Versions you will meet'},
{svg:life},
{t:[['Version','Internal number','Compatibility level','Support (verify on the lifecycle page)'],
['SQL Server 2017','14.x','140','Extended support ends 2027'],
['SQL Server 2019','15.x','150','Mainstream ended Feb 2025, extended ends Jan 2030'],
['SQL Server 2022','16.x','160','Mainstream to Jan 2028, extended to Jan 2033'],
['SQL Server 2025','17.x','170','Generally available since late 2025']]},
{note:'Dates above are the published fixed lifecycle at the time of writing. Always confirm on the Microsoft lifecycle page before making a plan, because they are the source of truth.'},
{h:'The support lifecycle in plain words'},
{ul:['**Mainstream support**: security fixes, non-security fixes and design changes.','**Extended support**: security fixes only.','After extended support ends there are no fixes unless you buy paid extended security updates.']},
{h:'How a server is serviced'},
{t:[['Package','Contents','Cadence'],
['**CU** (cumulative update)','Fixes and some security fixes','About every two months in mainstream support'],
['**GDR** (general distribution release)','Security fixes only','When needed'],
['**Service pack**','Large bundle','Not used since 2017']]},
{p:'Stay on the CU track unless you have a reason to be on GDR-only. Moving from GDR to CU is allowed, but not the reverse without reinstalling.'},
{h:'Version, build and compatibility level'},
{code:`SELECT SERVERPROPERTY('ProductVersion') AS build,
       SERVERPROPERTY('ProductLevel')   AS level,
       SERVERPROPERTY('ProductUpdateLevel') AS cu;

-- Compatibility level of each database
SELECT name, compatibility_level FROM sys.databases;`},
{p:'The **compatibility level** controls which optimizer and T-SQL behaviors a database uses. A database restored from an older server keeps its old level until you change it, so upgrades are safe and gradual.'}],
src:[['SQL Server 2022 lifecycle',M.LC+'sql-server-2022'],['SQL Server 2019 lifecycle',M.LC+'sql-server-2019'],['Latest updates and version history',M.SS+'sql-server-2022-release-notes'],['Compatibility level',M.TS+'statements/alter-database-transact-sql-compatibility-level']]};

/* ---------- 3: Finding answers ---------- */
L['mss-core:0:3']={blocks:[
{p:'No DBA remembers everything. Good DBAs know **where to look** and how to tell a reliable answer from a risky one.'},
{h:'Sources, from most to least authoritative'},
{t:[['Source','Use it for','Trust'],
['**Microsoft Learn: SQL Server docs**','Syntax, architecture guides, how-to','Highest'],
['**Release notes and build lists**','Fixes in each CU, known issues','Highest'],
['**Microsoft Q&A and Tech Community**','Questions, product team answers','Good'],
['**Community sites and blogs**','Deep dives and scripts','Check the author and date'],
['**Stack Overflow / DBA Stack Exchange**','Specific errors','Verify before using']]},
{h:'A good habit'},
{flow:['Search the error number or message','Open the official page for your version','Confirm the version in the page selector','Test on a non-production instance','Write down what you changed']},
{h:'Getting around Microsoft Learn'},
{ul:['Use the **version selector** on each page so the page matches your SQL Server version.','The **Architecture guides** explain how the engine works. Read them once, slowly.','The **T-SQL reference** gives exact syntax and permissions for every statement.','The **dynamic management views** reference tells you which view answers which question.']},
{h:'Built-in help'},
{code:`-- Search system objects without leaving the query window
SELECT name FROM sys.all_objects WHERE name LIKE 'dm_os_wait%';

-- Look up which error a number means
SELECT message_id, text FROM sys.messages
WHERE message_id = 1105 AND language_id = 1033;`},
{note:'Be careful with scripts from blogs: some change settings or drop objects. Read every line, and run them on a test server first.'}],
src:[['Microsoft Learn: SQL Server',M.SQL],['Architecture guides',M.RD+'sql-server-guides'],['Dynamic management views',M.RD+'system-dynamic-management-views/system-dynamic-management-views']]};

/* ---------- 4: Certification path ---------- */
L['mss-core:0:4']={blocks:[
{p:'Certifications are optional, but the exam objectives are a useful **checklist of what a SQL Server DBA is expected to know**. The current Microsoft credential for database administrators is built around Azure SQL and SQL Server.'},
{h:'The path'},
{t:[['Exam','Credential','Level'],
['**DP-900**','Azure Data Fundamentals','Beginner, concepts only'],
['**DP-300**','Azure Database Administrator Associate','Main DBA credential'],
['**AZ-104**','Azure Administrator Associate','Helpful for the cloud side']]},
{note:'Microsoft retires and renames exams from time to time. Check the exam page for current codes, skills measured and renewal rules before booking.'},
{h:'What DP-300 measures'},
{t:[['Domain','Where it is taught here'],
['Plan and implement data platform resources','Core DBA, Azure SQL'],
['Implement a secure environment','Security and Compliance'],
['Monitor, configure and optimize database resources','Performance and Tuning, Operations'],
['Configure and manage automation of tasks','Operations, Core DBA (Agent)'],
['Plan and configure a high availability and disaster recovery environment','High Availability, Backup']]},
{h:'How the sub-courses fit together'},
{svg:fam},
{h:'A study approach that works'},
{flow:['Do Core DBA first','Pick the sub-course closest to your job','Build a lab for every exam domain','Take the Microsoft Learn practice assessment','Fix gaps and book the exam']}],
src:[['DP-300: Azure Database Administrator Associate','https://learn.microsoft.com/en-us/credentials/certifications/azure-database-administrator-associate/'],['DP-300 study guide','https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-300']]};

})();
