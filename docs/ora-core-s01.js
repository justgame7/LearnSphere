/* LearnSphere - Oracle Core DBA, Section 01: Introduction & Oracle Foundations.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const stack=O.dg(700,200,[
[10,70,110,60,'Client|SQL*Plus, app',0],[160,70,110,60,'Listener|port 1521',0],
[310,10,380,180,'Database server',1],
[330,50,160,110,'Instance|SGA memory +|background processes',2],[520,50,150,110,'Database files|datafiles, redo logs,|control files',0]],
[[120,100,160,100],[270,100,330,100],[490,105,520,105]]);

const rels=O.dg(700,140,[
[10,40,150,60,'19c|long-term|baseline of this course',2],[190,40,150,60,'21c|innovation release|short support',0],
[370,40,150,60,'23ai|long-term|CDB only',0],[550,40,140,60,'26ai|long-term|current successor',2]],
[[160,70,190,70],[340,70,370,70],[520,70,550,70]]);

const role=O.dg(700,230,[
[30,15,150,44,'Install and patch',0],[275,15,150,44,'Backup and recovery',0],[520,15,150,44,'Security',0],
[280,90,140,50,'Oracle DBA',2],
[30,171,150,44,'Performance',0],[275,171,150,44,'Availability and DR',0],[520,171,150,44,'Capacity and users',0]],
[[300,90,150,59],[350,90,350,59],[400,90,550,59],[300,140,150,171],[350,140,350,171],[400,140,550,171]]);

const vocab=O.dg(700,330,[
[10,10,330,140,'Instance (in memory)',1],[30,45,140,40,'SGA|shared memory',0],[190,45,130,40,'Background|processes',0],[30,95,290,40,'PGA: private memory of each server process',0],
[360,10,330,140,'Database (on disk)',1],[380,45,140,40,'Datafiles',0],[540,45,130,40,'Redo logs',0],[380,95,290,40,'Control files + parameter file',0],
[10,180,680,140,'Container database (CDB): one database made of containers',1],
[30,215,140,50,'CDB$ROOT|Oracle metadata',2],[190,215,140,50,'PDB$SEED|template',0],[350,215,150,50,'PDB1|application data',0],[520,215,150,50,'PDB2|application data',0],
[30,275,640,32,'Users connect to a PDB through a service name',0]],
[[335,80,365,80]]);

const subs=O.dg(700,300,[
[10,110,150,80,'Core DBA|install, operate,|secure, move data',2],
[200,5,170,285,'Operate well',1],[215,30,140,50,'Backup & Recovery',0],[215,95,140,50,'Performance & Tuning',0],[215,160,140,50,'Security & Compliance',0],[215,225,140,50,'Upgrade & Patching',0],
[410,5,150,285,'High availability',1],[425,40,120,50,'RAC & ASM',0],[425,120,120,50,'Data Guard',0],[425,200,120,50,'GoldenGate',0],
[575,5,115,285,'Platform',1],[585,110,95,60,'Exadata',0]],
[[160,150,200,150],[370,150,410,150],[560,150,575,150]]);

/* ---------- 0: Course overview ---------- */
L['ora-core:0:0']={blocks:[
{p:'This course takes you from zero to someone who can **install, run, secure and troubleshoot an Oracle Database**. It is the first of nine Oracle sub-courses and the base for all the others. The baseline is **Oracle Database 19c**, the release most production systems run today. Where **26ai** works differently, the lecture says so.'},
{h:'Key terms in one minute'},
{t:[['Term','Plain meaning'],
['**Database**','The data files on disk that hold your data.'],
['**Instance**','The memory and background processes that open and serve a database.'],
['**DBA**','Database administrator: keeps the database available, safe, fast and recoverable.'],
['**PDB / CDB**','Pluggable database inside a container database. Section 9 covers it in full.'],
['**Listener**','The network process that accepts client connections.'],
['**Patch / Release Update**','A quarterly bundle of fixes and security updates.']]},
{h:'Who this is for'},
{t:[['You are','What you need first'],
['New to Oracle, comfortable with databases','Basic SQL: SELECT, INSERT, joins'],
['A developer moving to operations','Basic Linux: files, users, a shell'],
['A DBA from PostgreSQL or SQL Server','Nothing more: the vocabulary lecture maps the differences']]},
{p:'You do not need prior Oracle experience. The lab section builds a free practice database on your own machine.'},
{h:'The route through the course'},
{flow:['Foundations and lab (Sections 1 and 2)','Architecture: how Oracle works inside (Section 3)','Install, create and manage a database (Sections 4 and 5)','Connect: Oracle Net (Section 6)','Store: tablespaces, redo, control files (Sections 7 and 8)','Multitenant and users (Sections 9 and 10)','Objects, moving data, automation (Sections 11 to 13)','Troubleshoot and go to production (Sections 14 and 15)']},
{h:'The fifteen sections at a glance'},
{t:[['#','Section','After it you can'],
['1','Introduction & Oracle Foundations','Explain what Oracle is and how the courses fit'],
['2','Lab Setup & Tools','Run a practice database and connect'],
['3','Architecture: Instance, Memory & Processes','Describe what runs inside Oracle'],
['4','Installation & Database Creation','Install software and create a CDB'],
['5','Instance Management & Parameters','Start, stop and tune the instance'],
['6','Oracle Net Services','Configure listener and connections'],
['7','Storage: Tablespaces, Datafiles & Undo','Manage space and undo'],
['8','Redo, Control Files & Archiving','Protect committed data'],
['9','Multitenant Architecture (CDB & PDB)','Create, clone and plug PDBs'],
['10','Users, Privileges & Roles','Grant least privilege'],
['11','Schema Objects & SQL for DBAs','Manage tables, indexes and views'],
['12','Moving Data','Use Data Pump and SQL*Loader'],
['13','Automation & Resource Management','Schedule jobs and limit resources'],
['14','Monitoring, Diagnostics & Troubleshooting','Find and fix problems'],
['15','Production Readiness & Capstone','Hand over a database ready for production']]},
{h:'How lectures are tagged'},
{t:[['Marker','Meaning'],
['No tag','Works the same in 19c and 26ai.'],
['**[26ai]**','Applies to Oracle AI Database 26ai only.'],
['**8:00 core lecture**','Part of the main path. Read these first.'],
['**Additional lecture**','Optional depth, listed after the core lectures of a section.']]},
{note:'Practise every command. Reading about a recovery is not the same as having done one. Section 2 gives you a safe lab where nothing matters if you break it.'}],
src:[['Oracle Database 19c documentation',D],['Oracle Database 26ai documentation',O.D26]]};

/* ---------- 1: What Oracle Database is ---------- */
L['ora-core:0:1']={blocks:[
{p:'**Oracle Database** is a relational database management system from Oracle. It stores data in tables, you query it with **SQL**, and you program inside it with **PL/SQL**. It is known for reliability, security and features for very large, always-on systems.'},
{svg:stack},
{h:'The path of one request'},
{flow:['Client sends a connection request to the listener','The listener hands it to the instance (a server process starts)','The server process reads data through memory (the SGA)','Changes are written to redo first, data files later','The result goes back to the client']},
{h:'Why people choose it'},
{t:[['Strength','What it gives you'],
['**ACID transactions**','Committed work is never lost, and readers do not block writers.'],
['**High availability**','Real Application Clusters (RAC) and Data Guard keep it running through failures.'],
['**Security**','Encryption, auditing, fine-grained access, separation of duties.'],
['**Scale**','Partitioning, parallel query and Exadata handle huge data.'],
['**PL/SQL**','Business logic runs next to the data.'],
['**Tooling**','Mature backup (RMAN), diagnostics (AWR) and patching tools.']]},
{h:'The converged database'},
{p:'Oracle calls itself a **converged database**: one engine for many data types, so you do not need a separate system for each.'},
{t:[['Data type','Supported as'],
['Relational','Tables and SQL'],
['Documents','JSON, including JSON Relational Duality views in 23ai and later'],
['Graph','Property graph and RDF'],
['Spatial','Geographic data and queries'],
['Text and XML','Oracle Text, XMLType'],
['AI vectors','AI Vector Search (23ai and later) **[26ai]**']]},
{h:'Where Oracle Database runs'},
{t:[['Platform','Who manages the server and database'],
['**On premises**','You manage everything.'],
['**Exadata**','Oracle engineered hardware: you or Oracle run it.'],
['**Oracle Cloud (OCI) Base Database / Exadata service**','Oracle runs the hardware, you run the database.'],
['**Autonomous Database**','Oracle runs both, with automatic tuning and patching.'],
['**Other clouds**','Amazon RDS for Oracle, and Oracle Database@Azure, @AWS and @Google Cloud.']]},
{p:'The DBA skills in this course are the same everywhere. What changes is how much of the work the platform does for you.'},
{h:'Try it: which version am I on?'},
{code:`-- Connect as an administrator and run:
SELECT banner_full FROM v$version;

-- Example result
-- Oracle Database 19c Enterprise Edition Release 19.0.0.0.0 - Production
-- Version 19.25.0.0.0`},
{note:'Everything you run later (V$ views, SQL*Plus commands) works against this one engine, whichever platform hosts it.'}],
src:[['Introduction to Oracle Database',O.CN+'introduction-to-oracle-database.html'],['Oracle Database Concepts',O.CN]]};

/* ---------- 2: Releases and support ---------- */
L['ora-core:0:2']={blocks:[
{p:'Choosing a release decides how long you get fixes and how often you must upgrade. Oracle ships two kinds: **long-term releases** for production and **innovation releases** for early access to new features.'},
{svg:rels},
{t:[['Release','Type','What to know'],
['**19c**','Long-term','The baseline of this course. Most widely deployed. First release was 19.3.'],
['**21c**','Innovation','Short support window. Skipped by most production systems.'],
['**23ai**','Long-term','Renamed from 23c. Adds AI Vector Search. Multitenant only.'],
['**26ai**','Long-term','Oracle AI Database 26ai, the current long-term release and successor of 23ai.']]},
{note:'Support dates change. Always confirm them in the Oracle lifetime support policy and in My Oracle Support Doc ID 742060.1 (Release Schedule of Current Database Releases) before you plan an upgrade.'},
{h:'Reading a version string'},
{code:`19.25.0.0.0
|  |
|  +-- Release Update (RU) number: the quarterly patch level
+----- Release: 19c

SELECT version_full FROM v$instance;   -- shows it on a running database`},
{p:'Since 18c the first number is the release name (19, 21, 23, 26). The second number goes up with each **Release Update (RU)**, issued every quarter in January, April, July and October.'},
{h:'Support stages'},
{flow:['Premier Support: full fixes, updates and security alerts','Extended Support: fixes continue, usually for an extra fee','Sustaining Support: no new fixes, help only for existing patches']},
{t:[['Type of update','What it is','When'],
['**Release Update (RU)**','Security and critical fixes plus selected regression fixes. The normal quarterly patch.','Every quarter'],
['**Release Update Revision (RUR)**','Extra fixes on an older RU. Stopped for new releases.','Older releases'],
['**Interim (one-off) patch**','A fix for one bug you hit.','On request']]},
{h:'Which release should I use?'},
{ul:['**New production system:** a long-term release (26ai, or 19c if the application is certified only for it).','**Existing 19c system:** plan the move to 26ai before 19c support ends.','**Learning and testing:** the free Oracle AI Database Free, which is 26ai based.','**Avoid** innovation releases in production unless you accept a short upgrade cycle.']},
{h:'What changes in 26ai for DBAs **[26ai]**'},
{ul:['Multitenant is the only architecture: non-CDB databases are not supported.','AI Vector Search and new SQL features come as standard.','A direct upgrade from 19c to 26ai is supported (see the Upgrade sub-course).']}],
src:[['Oracle Database 19c release notes',D+'rnrdm/'],['Oracle Lifetime Support Policy','https://www.oracle.com/support/lifetime-support/'],['Oracle Database 26ai documentation',O.D26]]};

/* ---------- 3: Editions and licensing ---------- */
L['ora-core:0:3']={blocks:[
{p:'Oracle licensing is part of the DBA job. One careless click can turn on a feature that costs real money. This lecture gives you the map. It is not legal advice: always confirm with Oracle or your licence manager.'},
{h:'The editions'},
{t:[['Edition','Typical use','Key limits'],
['**Enterprise Edition (EE)**','Production, large and critical systems','Full feature set. Options are extra cost.'],
['**Standard Edition 2 (SE2)**','Small business and departments','Up to 2 sockets and 16 CPU threads. No RAC from 19c. Fewer features.'],
['**Express / Free**','Learning, development, small apps','Free. About 12 GB of user data, 2 GB RAM and 2 CPU threads.']]},
{p:'The Free edition is what you use for the course lab. Its limits can change, so read the licence page when you download it.'},
{h:'Options, packs and features'},
{t:[['Term','Meaning','Examples'],
['**Feature**','Included in the edition at no extra cost','Data Guard, RMAN, Data Pump, basic auditing'],
['**Option**','Extra-cost add-on for Enterprise Edition','Partitioning, Advanced Compression, Advanced Security (TDE), Active Data Guard, RAC, In-Memory, Multitenant (more than 3 PDBs)'],
['**Management pack**','Extra-cost tooling for Enterprise Edition','Diagnostics Pack, Tuning Pack, Data Masking and Subsetting Pack']]},
{h:'The Diagnostics and Tuning Pack trap'},
{p:'AWR reports, ASH, ADDM and the SQL Tuning Advisor are the DBA favourite tools. They are also **separately licensed**. Using them without the licence is a common audit finding, even if you only ran one report.'},
{flow:['A DBA runs an AWR report to find a slow query','AWR reads the DBA_HIST views','Those views belong to the Diagnostics Pack','Use without a licence counts as unlicensed usage']},
{t:[['You want to','Licensed way','Free alternative'],
['Find past performance problems','AWR and ADDM (Diagnostics Pack)','**Statspack**'],
['See active sessions','ASH views (Diagnostics Pack)','V$SESSION and V$SQL'],
['Tune a SQL statement','SQL Tuning Advisor (Tuning Pack)','EXPLAIN PLAN and DBMS_XPLAN']]},
{code:`-- Is the pack access switched on? (default on Enterprise Edition)
SHOW PARAMETER control_management_pack_access
-- NONE, DIAGNOSTIC or DIAGNOSTIC+TUNING

-- Block the packs if you are not licensed
ALTER SYSTEM SET control_management_pack_access = 'NONE' SCOPE=BOTH;

-- See which features the database has actually used
SELECT name, detected_usages, currently_used
FROM   dba_feature_usage_statistics
WHERE  detected_usages > 0
ORDER  BY name;`},
{h:'How Oracle is licensed'},
{t:[['Metric','How it counts','Notes'],
['**Processor**','Per CPU core times a core factor (0.5 for most x86 CPUs)','Common for Enterprise Edition servers'],
['**Named User Plus (NUP)**','Per person or device that uses the database','Enterprise minimum of 25 per processor. SE2 minimum of 10 per server.']]},
{note:'Rule of thumb: if a feature is not listed as included for your edition in the Licensing Information User Manual, assume it costs extra and ask before you use it.'}],
src:[['Licensing Information User Manual',O.LIC],['Oracle Database editions','https://www.oracle.com/database/technologies/appdev/xe.html']]};

/* ---------- 4: DBA role ---------- */
L['ora-core:0:4']={blocks:[
{p:'A DBA keeps a database **available, secure, fast and recoverable**. The title is the same in every company, but the work differs: some DBAs install and patch, others tune queries all day, others run Data Guard. Core DBA skills cover all of them at a basic level.'},
{svg:role},
{h:'What a DBA is responsible for'},
{t:[['Area','Typical tasks'],
['**Install and patch**','Install software, create databases, apply quarterly patches, upgrade releases.'],
['**Backup and recovery**','Schedule RMAN backups, test restores, recover after failure.'],
['**Security**','Create users, grant least privilege, encrypt, audit.'],
['**Performance**','Find slow SQL, check waits, manage statistics and indexes.'],
['**Availability and DR**','Run standby databases, test failover, document runbooks.'],
['**Capacity**','Watch space and growth, add storage, plan for next year.']]},
{h:'A typical working day'},
{t:[['When','Check'],
['**Daily**','Alert log, backup success, tablespace space, listener up, failed jobs, standby lag'],
['**Weekly**','Invalid objects, statistics, growth trends, security audit logs'],
['**Monthly**','Restore test, patch review, capacity report, user clean-up'],
['**Every quarter**','Release Update planning and testing']]},
{h:'Administrative privileges'},
{p:'A DBA connects with special **administrative privileges**. Day to day, use the narrowest one that does the job.'},
{t:[['Privilege','Who uses it'],
['`SYSDBA`','Full control: start, stop, create, recover. The most powerful.'],
['`SYSOPER`','Start, stop, backup. Cannot see user data.'],
['`SYSBACKUP`','Backup and recovery tools only.'],
['`SYSDG`','Data Guard operations only.'],
['`SYSKM`','Encryption key management only.']]},
{code:`-- Connect as the OS user that owns the software
sqlplus / as sysdba

SHOW USER
-- USER is "SYS"`},
{h:'Who else you work with'},
{t:[['Role','You hand them or ask them for'],
['Developer','Slow queries and schema changes'],
['System administrator','OS, memory, CPU, kernel settings'],
['Storage administrator','Disks, ASM, snapshots'],
['Network engineer','Ports, firewalls, latency'],
['Security team','Audit rules, password policy, compliance reports']]},
{h:'How a safe change is made'},
{flow:['Request and reason','Assess the risk and write the rollback','Test on a copy of production','Take a backup, then change in the agreed window','Verify and document']},
{note:'Golden rule of the job: never run an untested command on production, and always know how to undo it before you start.'}],
src:[['Oracle Database Administrator Guide',O.AD],['Administrative privileges',O.AD+'configuring-and-administering-the-database.html']]};

/* ---------- 5: Vocabulary ---------- */
L['ora-core:0:5']={blocks:[
{p:'Most beginner confusion in Oracle comes from three words: **instance**, **database** and **PDB**. Get these right now and every later section is easier.'},
{svg:vocab},
{h:'Instance vs database'},
{t:[['','Instance','Database'],
['**Lives in**','Memory and processes','Files on disk'],
['**Contains**','SGA, PGA, background processes','Datafiles, redo logs, control files'],
['**Exists when**','Started with STARTUP','Created once with CREATE DATABASE or DBCA'],
['**Survives a restart**','No, it is rebuilt each start','Yes']]},
{p:'An instance **opens** one database. After a crash the instance is gone but the database files stay, and starting a new instance recovers them.'},
{h:'Instances and databases together'},
{t:[['Setup','Instances','Databases'],
['Single instance','1','1'],
['Real Application Clusters (RAC)','Many, one per node','1 shared database'],
['Data Guard','One per site','A primary and one or more standby copies']]},
{h:'Container database and PDB'},
{ul:['A **container database (CDB)** is one Oracle database that holds other databases.','**CDB$ROOT** holds Oracle-supplied metadata and common users. You do not store application data there.','**PDB$SEED** is a template used to create new PDBs.','A **pluggable database (PDB)** looks like an ordinary database to the application and can be cloned, unplugged and moved.']},
{note:'Since 21c, Oracle databases are created as CDBs. In 19c you can still create a non-CDB, but that architecture is deprecated, and it is not supported in 26ai **[26ai]**.'},
{h:'Names you will meet'},
{t:[['Name','What it identifies'],
['`ORACLE_HOME`','Folder with the installed Oracle software'],
['`ORACLE_BASE`','Parent folder for Oracle installs and diagnostic files'],
['`ORACLE_SID`','Name of the instance on this server (an OS variable)'],
['`DB_NAME`','Name of the database (inside the control file)'],
['`DB_UNIQUE_NAME`','Unique name of one copy, used with Data Guard'],
['**Service name**','Name clients connect to. Each PDB has at least one.'],
['**Schema**','The objects owned by one user']]},
{h:'See it yourself'},
{code:`SELECT instance_name, status FROM v$instance;      -- the instance (memory)
SELECT name, cdb, open_mode FROM v$database;       -- the database (files)
SHOW CON_NAME                                      -- which container am I in?
SELECT con_id, name, open_mode FROM v$pdbs;        -- list the PDBs`},
{h:'Common mistakes'},
{ul:['Saying "the Oracle database is down" when only the listener is down.','Connecting to a PDB with the SID instead of its **service name**.','Creating application tables in `CDB$ROOT`.','Mixing up `ORACLE_SID` (instance) with the PDB name.']}],
src:[['Introduction to the Multitenant Architecture',O.CN+'CDBs-and-PDBs.html'],['Database instance and database',O.CN+'introduction-to-oracle-database.html']]};

/* ---------- 6: Documentation and My Oracle Support ---------- */
L['ora-core:0:6']={blocks:[
{p:'No DBA knows everything. The skill is knowing **where to look**. Oracle has two main sources: the public **documentation** and the paid **My Oracle Support (MOS)** site.'},
{h:'Where to look for what'},
{t:[['Need','Best source'],
['How a feature works','**Concepts** guide'],
['Step-by-step tasks','**Administrator Guide**'],
['What a view or parameter means','**Database Reference**'],
['Exact SQL syntax','**SQL Language Reference**'],
['What an ORA- error means','**Database Error Messages**'],
['What you are licensed for','**Licensing Information User Manual**'],
['A known bug or a patch','**My Oracle Support**'],
['Hands-on practice','Oracle LiveLabs, Oracle Learning Library']]},
{note:'Always open the guide for **your release**. The URL contains the release number (19 or 26), and a 26ai page can describe behaviour your 19c database does not have.'},
{h:'My Oracle Support'},
{t:[['What MOS has','Example'],
['**Knowledge base**','Notes with a Doc ID, for example 742060.1'],
['**Patches and updates**','Download Release Updates and OPatch'],
['**Service requests (SR)**','Open a case with Oracle engineers'],
['**Community**','Questions from other DBAs']]},
{p:'MOS needs a **Customer Support Identifier (CSI)** from a paid support contract. Without one you rely on public documentation and community sites.'},
{h:'Finding an answer to an error'},
{flow:['Copy the exact error, for example ORA-01017','Look it up in Database Error Messages','Search MOS with the error code and your version','Check the alert log and trace files for context','Match a known bug or note: apply the fix or workaround','If still stuck, open a service request with diagnostics attached']},
{h:'Useful habits'},
{t:[['Habit','Why'],
['Search with the **error number and release**','Fixes differ between 19c and 26ai'],
['Read the whole MOS note, including the **applies to** section','The note may not match your version or platform'],
['Keep the Doc IDs you used in your runbook','You or a colleague can find them fast next time'],
['Pick the right **severity** on an SR','Severity 1 is production down and gets round-the-clock attention']]},
{code:`-- Dictionary view names follow a pattern
-- USER_  your own objects     ALL_  what you can see
-- DBA_   everything           V$    live instance data
-- CDB_   DBA_ across all containers

SELECT * FROM dba_users;
SELECT * FROM v$session;`}],
src:[['Oracle Database 19c documentation',D],['Database Error Messages',O.ERR],['My Oracle Support',O.MOS],['Oracle LiveLabs','https://livelabs.oracle.com/']]};

/* ---------- 7: Sub-course map ---------- */
L['ora-core:0:7']={blocks:[
{p:'Oracle is too large for one course. LearnSphere splits it into **nine sub-courses**. This one, **Core DBA**, comes first and teaches what every other course assumes.'},
{svg:subs},
{h:'The nine sub-courses'},
{t:[['Sub-course','You learn','Take it when'],
['**Core DBA**','Install, architecture, storage, users, data movement, troubleshooting','First, always'],
['**Backup, Recovery & Flashback**','RMAN, restore, point-in-time recovery, Flashback','Right after Core. Most important for production.'],
['**Performance & Tuning**','Waits, AWR, ASH, plans, statistics','When you own slow systems'],
['**Security & Compliance**','Authentication, encryption, auditing, firewall','When you handle sensitive data'],
['**Upgrade, Patching & Migration**','OPatch, AutoUpgrade, moving to PDB','Before your next Release Update'],
['**RAC & ASM**','Clusters, Grid Infrastructure, Cache Fusion','After Core and Backup'],
['**Data Guard**','Standby databases, failover, switchover','After Core and Backup'],
['**GoldenGate**','Real-time replication between databases','After Core, for migrations and integration'],
['**Exadata**','Engineered system, smart scan, storage cells','When your site runs Exadata']]},
{h:'How the high-availability pieces fit'},
{t:[['Technology','Protects against','How'],
['**RAC**','Server or instance failure','Many instances share one database'],
['**Data Guard**','Site loss, data corruption','Keeps a synchronised copy of the database elsewhere'],
['**GoldenGate**','Planned moves, upgrades, mixed systems','Replicates changes logically, even between versions'],
['**Exadata**','Slow storage, hardware faults','Hardware and storage software built for Oracle']]},
{h:'Suggested paths'},
{t:[['Goal','Order'],
['**Production DBA**','Core, Backup, Security, Performance, Upgrade'],
['**HA and DR specialist**','Core, Backup, Data Guard, RAC, GoldenGate'],
['**Performance specialist**','Core, Performance, Exadata'],
['**Cloud DBA**','Core, Backup, Upgrade, Security']]},
{flow:['Core DBA','Backup and recovery','Pick: security, performance or upgrade','Then high availability: Data Guard, RAC','Specialise: GoldenGate or Exadata']},
{note:'If you only have time for two, take **Core DBA** and **Backup & Recovery**. A DBA who cannot restore the database has not done the job.'}],
src:[['Oracle Database High Availability Overview',D+'haovw/'],['Oracle Database documentation library',D]]};

})();
