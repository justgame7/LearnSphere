/* LearnSphere - SQL Server Azure SQL & Hybrid, Section 07: DP-300 Exam Preparation.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const dom=M.dg(700,220,[
[10,15,330,70,'Plan and implement|data platform resources|about 20 to 25 percent',2],[360,15,330,70,'Implement a secure|environment|about 15 to 20 percent',0],
[10,100,330,60,'Monitor, configure and optimize|database resources|about 15 to 20 percent',0],[360,100,330,60,'Configure and manage|automation of tasks|about 10 to 15 percent',0],
[10,170,680,40,'Plan and configure a high availability and disaster recovery environment: about 20 to 25 percent',2]],
[]);

const approach=M.dg(700,170,[
[10,25,150,70,'Read the|scenario for|requirements',0],[190,25,150,70,'Find the|constraint|cost, downtime, scope',2],[370,25,150,70,'Eliminate|options that|break it',0],[550,25,140,70,'Choose the|simplest that|fits',2],
[10,115,680,40,'Exam questions test judgment: the right answer is the one that meets all stated requirements',0]],
[[160,60,190,60],[340,60,370,60],[520,60,550,60]]);

/* ---------- 0: Exam domains ---------- */
L['mss-az:6:0']={blocks:[
{p:'**DP-300: Administering Microsoft Azure SQL Solutions** is the main Microsoft exam for database administrators on Azure SQL and SQL Server. Passing it earns the **Azure Database Administrator Associate** certification.'},
{svg:dom},
{t:[['Domain','Where this course teaches it'],
['**Plan and implement data platform resources**','Azure SQL sections, Upgrade and Migration, Core DBA'],
['**Implement a secure environment**','Security and Compliance, Security in Azure SQL'],
['**Monitor, configure and optimize**','Performance and Tuning, Operations, Azure SQL'],
['**Automation**','Operations: Agent, PowerShell, Azure automation'],
['**HA and DR**','High Availability and DR, Backup and Recovery, Azure SQL']]},
{note:'Weightings and skills change with each exam update. Always check the current skills measured document and the exam page before you study and before you book.'}],
src:[['DP-300 study guide','https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-300'],['Azure Database Administrator Associate','https://learn.microsoft.com/en-us/credentials/certifications/azure-database-administrator-associate/']]};

/* ---------- 1: Plan and implement ---------- */
L['mss-az:6:1']={blocks:[
{p:'Questions in this domain ask you to **choose a platform**, **size it**, and **migrate or deploy**. Practice reading requirements and matching them to the options.'},
{svg:approach},
{h:'Practice scenarios'},
{t:[['Scenario','Likely answer','Reason'],
['An application needs SQL Agent, cross-database queries and minimal admin','Managed Instance','Instance features with PaaS management'],
['Unpredictable, intermittent usage for a single database','SQL Database serverless','Billed per second, auto-pause'],
['A SaaS provider has 300 small tenant databases with different peaks','Elastic pool','Shared resources'],
['A 40 TB database that needs fast restore and scale','Hyperscale','Architecture designed for size'],
['Needs OS access and a third-party agent','SQL Server on Azure VM','Requires IaaS'],
['Move an on-premises instance with minimal downtime to MI','Log Replay Service or MI link, or DMS online','Continuous log apply and short cutover']]},
{h:'Skills to be fluent in'},
{ul:['Choosing between **DTU and vCore**, and tiers.','**Azure Hybrid Benefit** and reserved capacity at a high level.','**Deployment** with portal, CLI, ARM and Bicep templates.','Migration tools: **DMS, Azure Migrate, LRS, link**.']}],
src:[['Plan and implement data platform resources','https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-300'],['Azure SQL migration guides','https://learn.microsoft.com/en-us/azure/azure-sql/migration-guides/']]};

/* ---------- 2: Secure, monitor, optimize ---------- */
L['mss-az:6:2']={blocks:[
{p:'These domains test whether you know the **built-in tools** and **when each applies**.'},
{h:'Security scenarios'},
{t:[['Scenario','Answer','Reason'],
['Admins should not read credit card numbers in SQL Database','Always Encrypted, with keys outside the service','Even server admins cannot decrypt'],
['An app must connect with no password','Managed identity with Entra user in the database','No secret to store'],
['Block internet access to a logical server','Private endpoint and deny public network access','Private connectivity only'],
['Record all access to a sensitive table for compliance','Auditing to Log Analytics or storage','Records who did what'],
['Detect SQL injection attempts','Microsoft Defender for SQL','Threat protection alerts']]},
{h:'Monitoring and optimization scenarios'},
{t:[['Scenario','Answer','Reason'],
['A query regressed after a platform change','Query Store, force the previous plan or use automatic plan correction','Plan history and forcing'],
['See top resource consuming queries in the portal','Query Performance Insight','Built-in view'],
['Add missing indexes automatically','Automatic tuning','Creates and drops indexes with validation'],
['Alert when CPU stays high','Azure Monitor metric alert','Metric-based alerts'],
['Understand waits in Azure SQL Database','sys.dm_db_wait_stats and Query Store wait stats','Database-scoped waits']]}],
src:[['Implement a secure environment','https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-300'],['Monitor and tune Azure SQL','https://learn.microsoft.com/en-us/azure/azure-sql/database/monitor-tune-overview']]};

/* ---------- 3: Automation and HA/DR ---------- */
L['mss-az:6:3']={blocks:[
{p:'The last domains cover **scheduling work** and **keeping data available**. Learn which feature fits which platform.'},
{h:'Automation scenarios'},
{t:[['Scenario','Answer','Reason'],
['Run T-SQL on a schedule on an Azure SQL Database','Elastic jobs, Azure Automation, Logic Apps','SQL Agent is not available in SQL Database'],
['Run T-SQL on a schedule on a Managed Instance','SQL Agent','Supported'],
['Deploy the same database configuration repeatedly','ARM or Bicep templates, pipelines','Infrastructure as code'],
['Be notified when a metric crosses a threshold','Azure Monitor alerts and action groups','Alerting']]},
{h:'HA and DR scenarios'},
{t:[['Scenario','Answer','Reason'],
['Cross-region DR with automatic failover for Azure SQL Database','Auto-failover group','Group failover with a read-write listener'],
['Restore to a point in time within a week','Point-in-time restore','Automated backups'],
['Keep yearly backups for 7 years','Long-term retention policy','Up to 10 years'],
['Zone redundancy for a Managed Instance','Zone-redundant configuration','Replicas in zones'],
['Readable secondary for reports in Business Critical','Read scale-out','Built-in replica']]},
{note:'On the exam read the recovery requirements closely: RPO, RTO, region scope and whether failover must be automatic. They decide between geo-replication, failover groups and backup based solutions.'}],
src:[['Business continuity in Azure SQL','https://learn.microsoft.com/en-us/azure/azure-sql/database/business-continuity-high-availability-disaster-recover-hadr-overview'],['Elastic jobs','https://learn.microsoft.com/en-us/azure/azure-sql/database/elastic-jobs-overview']]};

})();
