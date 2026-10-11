/* LearnSphere - SQL Server Upgrade, Patching & Migration, Section 05: Cross-Platform & Heterogeneous Migration.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const win=M.dg(700,200,[
[10,20,200,70,'Windows instance|domain accounts,|Windows-only features',0],[250,20,200,70,'Assess|feature and driver|compatibility',2],[490,20,200,70,'Linux instance|backup and restore|same engine',0],
[10,115,680,70,'Backups restore across platforms. The work is in authentication, file paths, jobs and features that differ.',0]],
[[210,55,250,55],[450,55,490,55]]);

const cont=M.dg(700,200,[
[10,15,680,170,'SQL Server in containers',1],
[30,55,200,60,'Image|mcr.microsoft.com/mssql|versioned tag',0],[255,55,200,60,'Container|sqlservr process|resource limits',2],[480,55,190,60,'Persistent volume|data and log|outside container',2],
[30,130,640,45,'Orchestrators such as Kubernetes add scheduling, restart and networking,|and need careful storage and HA design',0]],
[[230,85,255,85],[455,85,480,85]]);

const ssma=M.dg(700,170,[
[10,25,130,70,'1. Assess|SSMA report',0],[160,25,130,70,'2. Convert|schema and code|to T-SQL',2],[310,25,130,70,'3. Migrate|data',2],[460,25,100,70,'4. Test|and fix',0],[580,25,110,70,'5. Cutover',0],
[10,115,680,40,'PL/SQL, data types and features differ: expect manual work after the tool',0]],
[[140,60,160,60],[290,60,310,60],[440,60,460,60],[560,60,580,60]]);

const other=M.dg(700,200,[
[10,20,215,70,'SSMA family|Oracle, MySQL,|Db2, SAP ASE, Access',2],[245,20,215,70,'Azure DMS|heterogeneous|online paths',0],[480,20,210,70,'ETL and CDC|SSIS, Data Factory,|custom pipelines',0],
[10,115,680,70,'Rule: a migration is a project with schema, data, code, performance and application testing, not a copy',0]],
[]);

/* ---------- 0: Windows to Linux ---------- */
L['mss-upg:4:0']={blocks:[
{p:'SQL Server on **Linux** uses the same engine, so migrating from Windows is mostly a **platform** change, not an application change.'},
{svg:win},
{h:'What stays the same'},
{ul:['**Database files and backups**: a backup from Windows restores on Linux and the other way round (same or newer version).','**T-SQL, collations, most features**.']},
{h:'What to check'},
{t:[['Area','Consideration'],
['**Authentication**','Windows auth needs Active Directory integration with a keytab. SQL auth works directly.'],
['**File paths**','Use `/var/opt/mssql/data` style paths and update scripts and jobs.'],
['**Agent jobs**','Supported, but some job steps (for example PowerShell and CmdExec behavior) differ.'],
['**Features**','Check the feature list for your version: some Windows-only components are not available.'],
['**Linked servers and drivers**','Provider availability differs.'],
['**Maintenance and monitoring**','systemd, mssql-conf, Linux logging and tools.']]},
{h:'Process'},
{flow:['Run an assessment for features and external dependencies','Build and harden the Linux host and install SQL Server','Restore databases, move logins, jobs and settings','Test the application and performance','Cutover using backup and restore or log shipping']},
{note:'Operations change: your DBAs need Linux basics for patching, storage, firewalls and troubleshooting.'}],
src:[['SQL Server on Linux documentation',M.LX+'sql-server-linux-overview'],['Migrate from Windows to Linux',M.LX+'sql-server-linux-migrate-restore-database']]};

/* ---------- 1: Containers and orchestration ---------- */
L['mss-upg:4:1']={blocks:[
{p:'**Containers** package SQL Server and its dependencies so that it starts the same way everywhere. They are very good for development and test, and can be used for production with care.'},
{svg:cont},
{h:'Benefits and cautions'},
{t:[['Benefit','Caution'],
['Fast, repeatable environments','State must live in **volumes**, not in the container'],
['Easy version testing and CI','Resource limits and memory settings need tuning'],
['Fits Kubernetes and DevOps pipelines','HA and backup need a clear design'],
['Isolation between instances','Operational skills for containers are needed']]},
{h:'Production considerations'},
{ul:['**Persistent storage** with the right performance and durability.','**Resource requests and limits** that match SQL Server memory settings.','**High availability**: AGs on Kubernetes through an operator or a cloud service.','**Backups** outside the cluster and tested restores.','**Patching** by replacing images, with a data safe procedure.']},
{note:'Many organizations use containers for non-production and managed services or VMs for production databases. Choose by your team skills and support model.'}],
src:[['SQL Server containers',M.LX+'sql-server-linux-docker-container-deployment'],['Deploy on Kubernetes',M.LX+'tutorial-sql-server-containers-kubernetes']]};

/* ---------- 2: SSMA for Oracle ---------- */
L['mss-upg:4:2']={blocks:[
{p:'**SQL Server Migration Assistant (SSMA) for Oracle** helps convert an Oracle schema and move the data to SQL Server or Azure SQL. It automates a part of the work. The rest is manual review.'},
{svg:ssma},
{h:'Major differences to plan for'},
{t:[['Oracle','SQL Server'],
['**PL/SQL** packages, procedures','T-SQL procedures, no packages: split or use schemas'],
['**NUMBER**','`decimal`, `int`, `bigint`, `float` depending on precision and scale'],
['**VARCHAR2, DATE**','`varchar` or `nvarchar`, `datetime2`'],
['**Sequences**','Sequences or identity columns'],
['**Empty string equals NULL**','Different NULL semantics: review comparisons'],
['**Read consistency model**','Locking vs row versioning defaults differ (use RCSI)']]},
{h:'Typical process'},
{ul:['Run the **assessment** to size effort and see unconvertible objects.','Convert schema, then **review and fix** converted code.','**Load data** with SSMA or an ETL tool and verify row counts.','**Test** with application and performance tests: execution plans and indexes differ.']},
{note:'Treat SSMA as an accelerator. A conversion report with many warnings means real development work, so plan time for testing and tuning.'}],
src:[['SQL Server Migration Assistant for Oracle',M.SS+'migrate/ssma/oracle/sql-server-migration-assistant-for-oracle-oracletosql'],['Oracle to SQL Server migration guide','https://learn.microsoft.com/en-us/azure/azure-sql/migration-guides/database/oracle-to-sql-database-guide']]};

/* ---------- 3: Other databases ---------- */
L['mss-upg:4:3']={blocks:[
{p:'Other databases can be moved to SQL Server with tools and patterns similar to Oracle migrations.'},
{svg:other},
{t:[['Source','Typical tool','Notes'],
['**MySQL, MariaDB**','SSMA for MySQL','Simpler SQL dialect, differences in data types and functions'],
['**IBM Db2**','SSMA for Db2','Check procedural code and data types'],
['**SAP ASE (Sybase)**','SSMA for SAP ASE','Close T-SQL heritage, but test carefully'],
['**Microsoft Access**','SSMA for Access','Often an upsizing project'],
['**PostgreSQL**','Azure DMS or custom ETL','Check Postgres-specific types and extensions'],
['**Files and other sources**','SSIS, Azure Data Factory','Design the pipeline']]},
{h:'A reliable approach'},
{flow:['Inventory objects, data volume and dependencies','Pick tool and target, and agree success criteria','Migrate schema, then data, in a test environment first','Run functional and performance tests, fix','Rehearse the cutover and execute with a rollback']},
{note:'Data types, collations, case sensitivity, date handling and NULL behavior cause most subtle bugs. Test with real data and real queries.'}],
src:[['SQL Server Migration Assistant',M.SS+'migrate/ssma/sql-server-migration-assistant'],['Data migration guides','https://learn.microsoft.com/en-us/data-migration/']]};

})();
