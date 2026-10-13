/* LearnSphere - Azure SQL and Hybrid Quick Reference (cheat sheet).
   window.QREF['mss-az'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for SQL Server 2019 to 2022 and current Azure SQL; verify syntax against your build. Check build-specific behaviour in the release notes. */
window.QREF=window.QREF||{};
window.QREF['mss-az']={title:'Azure SQL and Hybrid Quick Reference',blurb:'Platform comparison and CLI commands for Azure SQL Database, Managed Instance and SQL Server on Azure VMs, plus maps of platform choice, security and hybrid.',hint:'private endpoint',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every Azure SQL administrator should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Choosing and sizing'},
{acc:[
{t:'The three Azure SQL platforms',s:'SQL Database, Managed Instance, SQL on a VM.',
 a:'**Azure SQL Database** is a fully managed single database or pool. **Managed Instance** is a near-complete instance with managed operations. **SQL Server on Azure VMs** is full control with you managing the OS and engine.',
 w:'The more control you want, the more you operate.',
 c:`SELECT SERVERPROPERTY('EngineEdition'), @@VERSION;`,see:[0,0,'Azure SQL Database vs Managed Instance vs SQL on VM']},
{t:'DTU and vCore',s:'Purchasing models.',
 a:'**DTU** bundles CPU, memory and I/O into units and is simple. **vCore** lets you choose compute and storage separately, and supports reserved capacity and the hybrid benefit.',
 w:'vCore gives more control and is preferred for new deployments.',
 c:`SELECT * FROM sys.dm_user_db_resource_governance;`,see:[0,1,'DTU vs vCore purchasing models']},
{t:'Service tiers',s:'General Purpose, Business Critical, Hyperscale.',
 a:'General Purpose uses remote storage, Business Critical uses local SSD with replicas and readable secondaries, and Hyperscale separates compute and storage for very large databases.',
 w:'Pick the tier from latency, availability and size needs.',
 c:`SELECT DATABASEPROPERTYEX(DB_NAME(), 'ServiceObjective');`,see:[0,2,'Service tiers and sizing']},
{t:'Serverless and elastic pools',s:'Cost shaped to use.',
 a:'**Serverless** scales compute automatically and can pause when idle. **Elastic pools** share resources across many databases with different peak times.',
 w:'They suit spiky or many-small-database workloads.',
 c:`SELECT * FROM sys.elastic_pool_resource_stats;`,see:[1,1,'Serverless and elastic pools']}
]},

{h:'Operating Azure SQL'},
{acc:[
{t:'Logical server',s:'Container for databases.',
 a:'A **logical server** holds databases, logins, firewall rules and the connection endpoint. It is not a host you manage.',
 w:'Security settings are mostly at the server level.',
 c:`SELECT name FROM sys.databases;`,see:[1,0,'Provisioning and logical servers']},
{t:'Backups and point-in-time restore',s:'Automatic.',
 a:'Backups are automatic (full, differential and log) with a retention period you set, allowing point-in-time restore to a new database and long-term retention. You cannot run native `BACKUP` to disk.',
 w:'Restore creates a new database. Test it.',
 c:`SELECT * FROM sys.dm_database_backups;`,see:[1,3,'Backups and point-in-time restore']},
{t:'Hyperscale architecture',s:'Separate compute and storage.',
 a:'Page servers hold data, a log service handles log, and compute nodes cache pages. Scale and restore are fast regardless of size.',
 w:'Great for very large databases and fast restores.',
 c:`SELECT * FROM sys.dm_db_resource_stats;`,see:[1,2,'Hyperscale architecture']},
{t:'Managed Instance networking',s:'Delegated subnet.',
 a:'Managed Instance runs inside your virtual network in a dedicated subnet with specific NSG and route requirements. Connectivity uses a private endpoint.',
 w:'Network design comes before deployment.',
 c:`SELECT @@SERVERNAME;`,see:[2,1,'Networking and VNet requirements']},
{t:'Management operations',s:'Long-running.',
 a:'Scaling, creating and updating Managed Instances are long operations (minutes to hours). Plan them and monitor operation status.',
 w:'Do not schedule changes during a deadline.',
 c:`az sql mi op list --mi mymi -g rg`,see:[2,3,'Management operations and timing']},
{t:'SQL IaaS Agent extension',s:'Management features on VMs.',
 a:'The extension enables automated backup and patching, licensing flexibility and portal management for SQL Server on Azure VMs.',
 w:'Register VMs so Azure can see them.',
 c:`az sql vm show -n sqlvm -g rg`,see:[3,1,'The SQL IaaS Agent extension']},
{t:'Monitoring and scaling',s:'Resource metrics.',
 a:'Use Azure Monitor metrics, `sys.dm_db_resource_stats`, Query Store and Intelligent Insights. Scale by changing the service objective online.',
 w:'Scale in response to measured saturation.',
 c:`SELECT TOP 5 * FROM sys.dm_db_resource_stats ORDER BY end_time DESC;`,see:[1,4,'Scaling and monitoring']}
]},

{h:'Security and hybrid'},
{acc:[
{t:'Microsoft Entra authentication',s:'Central identity.',
 a:'Entra ID supports users, groups, managed identities and MFA. Set an Entra admin on the server and create contained users from external providers.',
 w:'Prefer Entra over SQL authentication.',
 c:`CREATE USER [app-mi] FROM EXTERNAL PROVIDER;`,see:[4,0,'Entra ID authentication']},
{t:'Network isolation',s:'Firewall and private endpoints.',
 a:'Server firewall rules limit public access. **Private endpoints** place the server on your virtual network and allow disabling public access.',
 w:'Disable public access where possible.',
 c:`SELECT * FROM sys.firewall_rules;`,see:[4,1,'Private endpoints and firewall rules']},
{t:'Encryption and customer-managed keys',s:'TDE with your key.',
 a:'TDE is on by default with a service-managed key. Use a customer-managed key in Key Vault for control, and manage rotation and access.',
 w:'Losing key access makes the database inaccessible.',
 c:`SELECT * FROM sys.dm_database_encryption_keys;`,see:[4,2,'Encryption and customer-managed keys']},
{t:'Auditing and threat protection',s:'Evidence and detection.',
 a:'Auditing writes to storage, Log Analytics or Event Hubs. Microsoft Defender for SQL detects anomalous access and vulnerabilities.',
 w:'Turn on both for production.',
 c:`SELECT * FROM sys.fn_get_audit_file('https://...', DEFAULT, DEFAULT);`,see:[4,3,'Auditing and threat protection']},
{t:'Azure Arc and hybrid',s:'Manage on-premises from Azure.',
 a:'Azure Arc-enabled SQL Server projects on-premises instances into Azure for inventory, assessments, Defender and policy.',
 w:'One control plane for hybrid estates.',
 c:`az sql server-arc list`,see:[5,0,'Azure Arc-enabled SQL Server']},
{t:'Fabric mirroring',s:'Analytics without ETL.',
 a:'Mirroring replicates operational databases into Microsoft Fabric as Delta tables continuously, so analytics run without building pipelines.',
 w:'Check supported sources and limits.',
 c:`SELECT * FROM sys.dm_change_feed_log_scan_sessions;`,see:[5,3,'Fabric mirroring']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Three small maps of how the parts fit together: platform choice, Azure SQL Database and hybrid.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. Choosing the platform'},
{map:{title:'Platform map',h:216,trace:'Which Azure SQL option fits',
 hint:'Tap any box, or press Which Azure SQL option fits to follow a choice by need.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'need',x:126,y:24,w:200,h:56,c:'ext',t:'Requirements',s:'features and control',d:'List needed features, size, compatibility and control.',why:'Start here.',chk:`SELECT SERVERPROPERTY('Edition');`,see:[0,3,'Decision tree for choosing a platform']},
 {id:'db',x:354,y:24,w:200,h:56,c:'proc',t:'Azure SQL Database',s:'single or pool',d:'Fully managed with the least administration. Some instance features are missing.',why:'Cloud-native apps.',chk:`SELECT SERVERPROPERTY('EngineEdition');`,see:[1,0,'Provisioning and logical servers']},
 {id:'mi',x:126,y:136,w:200,h:56,c:'proc',t:'Managed Instance',s:'near full SQL Server',d:'Instance-level features such as Agent and cross-database queries with managed operations.',why:'Lift and shift.',chk:`SELECT @@VERSION;`,see:[2,0,'Managed Instance architecture']},
 {id:'vm',x:354,y:136,w:200,h:56,c:'proc',t:'SQL on Azure VM',s:'full control',d:'Any version and feature, with OS and patching your job.',why:'Maximum compatibility.',chk:`SELECT SERVERPROPERTY('Edition');`,see:[3,0,'Sizing and storage best practices']}],
 steps:[
 {ids:['need','db'],t:'1. Start with requirements and choose the least administration that fits.',w:'Less to operate.',s:'Features.',x:'Choosing by habit.',c:`SELECT SERVERPROPERTY('EngineEdition');`},
 {ids:['mi','vm'],t:'2. Use Managed Instance for instance features, VMs for full control.',w:'Fit.',s:'Compatibility.',x:'Underestimating operations.',c:`SELECT @@VERSION;`}]}},

{h:'2. Azure SQL Database'},
{map:{title:'Azure SQL Database map',h:328,trace:'Connect, protect and recover',
 hint:'Tap any box, or press Connect, protect and recover to follow the main parts of Azure SQL Database.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'cli',x:126,y:24,w:200,h:56,c:'ext',t:'Client',s:'app or user',d:'Connects with Entra or SQL authentication over TLS.',why:'Use managed identity.',chk:`sqlcmd -S server.database.windows.net -d db -G`,see:[4,0,'Entra ID authentication']},
 {id:'fw',x:354,y:24,w:200,h:56,c:'net',t:'Firewall or private endpoint',s:'network gate',d:'IP rules or a private endpoint control access.',why:'Disable public access.',chk:`az sql server firewall-rule list -s server -g rg`,see:[4,1,'Private endpoints and firewall rules']},
 {id:'srv',x:126,y:136,w:200,h:56,c:'proc',t:'Logical server',s:'endpoint',d:'Holds databases, admin and policies.',why:'Security settings.',chk:`az sql server show -n server -g rg`,see:[1,0,'Provisioning and logical servers']},
 {id:'db',x:354,y:136,w:200,h:56,c:'disk',t:'Database',s:'compute tier',d:'A database with a service objective.',why:'Scale online.',chk:`SELECT * FROM sys.dm_db_resource_stats;`,see:[1,4,'Scaling and monitoring']},
 {id:'bk',x:240,y:248,w:200,h:56,c:'disk',t:'Automatic backups',s:'PITR and LTR',d:'Full, differential and log backups managed by the service.',why:'Set retention.',chk:`SELECT * FROM sys.dm_database_backups;`,see:[1,3,'Backups and point-in-time restore']}],
 steps:[
 {ids:['cli','fw'],t:'1. A client connects through the firewall or private endpoint.',w:'Network gate.',s:'Rules.',x:'Public access left open.',c:`az sql server firewall-rule list -s server -g rg`},
 {ids:['srv','db'],t:'2. The server routes to the database.',w:'Managed endpoint.',s:'Tier.',x:'Under-sized tier.',c:`SELECT * FROM sys.dm_db_resource_stats;`},
 {ids:['bk'],t:'3. Backups run automatically.',w:'Recoverability.',s:'Retention.',x:'Short retention.',c:`SELECT * FROM sys.dm_database_backups;`}]}},

{h:'3. Hybrid and Fabric'},
{map:{title:'Hybrid map',h:216,trace:'On-premises to Azure',
 hint:'Tap any box, or press On-premises to Azure to follow hybrid connections.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'onp',x:126,y:24,w:200,h:56,c:'ext',t:'On-premises SQL Server',s:'existing estate',d:'Instances that stay on-premises.',why:'Inventory first.',chk:`SELECT @@VERSION;`,see:[5,0,'Azure Arc-enabled SQL Server']},
 {id:'arc',x:354,y:24,w:200,h:56,c:'proc',t:'Azure Arc',s:'agent',d:'Connects the instance to Azure for management.',why:'Needs outbound access.',chk:`az sql server-arc list`,see:[5,0,'Azure Arc-enabled SQL Server']},
 {id:'def',x:126,y:136,w:200,h:56,c:'warn',t:'Defender and assessments',s:'security and best practice',d:'Assessments and threat protection for Arc-enabled instances.',why:'Review findings.',chk:`az security assessment list`,see:[5,1,'Best practices assessment']},
 {id:'fab',x:354,y:136,w:200,h:56,c:'ext',t:'Fabric mirroring',s:'analytics',d:'Continuous replication into Fabric.',why:'No ETL pipelines.',chk:`SELECT * FROM sys.dm_change_feed_log_scan_sessions;`,see:[5,3,'Fabric mirroring']}],
 steps:[
 {ids:['onp','arc'],t:'1. Connect on-premises instances with Azure Arc.',w:'One control plane.',s:'Agent.',x:'Blocked outbound.',c:`az sql server-arc list`},
 {ids:['def','fab'],t:'2. Add assessments and Defender, and mirror data to Fabric for analytics.',w:'Value added.',s:'Licensing.',x:'Unsupported source.',c:`az security assessment list`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Three small maps of how something happens, step by step: migrating to Managed Instance, secure connection and point-in-time restore.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Migrating to Managed Instance'},
{map:{title:'MI migration map',h:328,trace:'Move with minimal downtime',
 hint:'Tap any box, or press Move with minimal downtime to follow a migration to Managed Instance.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'asm',x:126,y:24,w:200,h:56,c:'mem',t:'Assess',s:'compatibility',d:'Run assessments for blockers and sizing.',why:'Fix first.',chk:`az datamigration --help`,see:[2,2,'Migrating to Managed Instance']},
 {id:'net',x:354,y:24,w:200,h:56,c:'net',t:'Prepare network',s:'subnet and NSG',d:'Create the delegated subnet, routes and connectivity.',why:'Hard to change later.',chk:`az network vnet subnet show ...`,see:[2,1,'Networking and VNet requirements']},
 {id:'bk',x:126,y:136,w:200,h:56,c:'proc',t:'Backup to storage',s:'URL',d:'Back up to Azure Blob Storage.',why:'Use COPY_ONLY if needed.',chk:`BACKUP DATABASE MyDb TO URL = N'https://...' WITH COPY_ONLY;`,see:[2,2,'Migrating to Managed Instance']},
 {id:'rs',x:354,y:136,w:200,h:56,c:'proc',t:'Restore or replay',s:'log replay service',d:'Restore with native restore or Log Replay Service for online migration.',why:'Keep applying logs.',chk:`RESTORE DATABASE MyDb FROM URL = N'https://...';`,see:[2,2,'Migrating to Managed Instance']},
 {id:'cut',x:240,y:248,w:200,h:56,c:'warn',t:'Cutover',s:'final log',d:'Stop writes, apply the final log and switch.',why:'Test connection strings.',chk:`az sql midb log-replay complete ...`,see:[2,2,'Migrating to Managed Instance']}],
 steps:[
 {ids:['asm','net'],t:'1. Assess and prepare the network.',w:'Foundations.',s:'Subnet.',x:'Network not ready.',c:`az datamigration --help`},
 {ids:['bk','rs'],t:'2. Back up to storage, then restore or replay logs.',w:'Keeps the target current.',s:'Log replay.',x:'Long operation.',c:`RESTORE DATABASE MyDb FROM URL = N'https://...';`},
 {ids:['cut'],t:'3. Apply the final log and cut over.',w:'Minimal downtime.',s:'Cutover plan.',x:'Connection strings not updated.',c:`az sql midb log-replay complete ...`}]}},

{h:'2. Connecting securely to Azure SQL'},
{map:{title:'Secure connection map',h:216,trace:'Identity and network',
 hint:'Tap any box, or press Identity and network to follow secure connection setup.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'mi',x:126,y:24,w:200,h:56,c:'proc',t:'Managed identity',s:'no secrets',d:'An identity assigned to the application.',why:'Prefer to passwords.',chk:`az webapp identity assign -n app -g rg`,see:[4,0,'Entra ID authentication']},
 {id:'ent',x:354,y:24,w:200,h:56,c:'proc',t:'Entra user',s:'contained user',d:'Create the identity as a database user and grant roles.',why:'Least privilege.',chk:`CREATE USER [app] FROM EXTERNAL PROVIDER;`,see:[4,0,'Entra ID authentication']},
 {id:'pe',x:126,y:136,w:200,h:56,c:'net',t:'Private endpoint',s:'VNet address',d:'A private IP for the server in your network.',why:'Add DNS zone.',chk:`az network private-endpoint create ...`,see:[4,1,'Private endpoints and firewall rules']},
 {id:'fw',x:354,y:136,w:200,h:56,c:'warn',t:'Disable public access',s:'firewall',d:'Turn off public network access and remove open rules.',why:'Verify connectivity first.',chk:`az sql server update -n server -g rg --enable-public-network false`,see:[4,1,'Private endpoints and firewall rules']}],
 steps:[
 {ids:['mi','ent'],t:'1. Use a managed identity and map it to a database user.',w:'No passwords.',s:'Roles.',x:'Over-privileged identity.',c:`SELECT * FROM sys.database_principals;`},
 {ids:['pe','fw'],t:'2. Add a private endpoint and disable public access.',w:'Network isolation.',s:'DNS.',x:'DNS resolves publicly.',c:`nslookup server.database.windows.net`}]}},

{h:'3. Restoring an Azure SQL database'},
{map:{title:'Azure restore map',h:216,trace:'Point-in-time restore',
 hint:'Tap any box, or press Point-in-time restore to follow a restore in Azure SQL Database.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'tm',x:126,y:24,w:200,h:56,c:'mem',t:'Choose the time',s:'within retention',d:'Pick a time inside the retention window.',why:'Be precise.',chk:`SELECT * FROM sys.dm_database_backups;`,see:[1,3,'Backups and point-in-time restore']},
 {id:'rs',x:354,y:24,w:200,h:56,c:'proc',t:'Restore to new',s:'new database',d:'Restore creates a new database next to the original.',why:'Same or another server.',chk:`az sql db restore --dest-name db_restore --time '2026-03-05T14:29:00Z' ...`,see:[1,3,'Backups and point-in-time restore']},
 {id:'vf',x:126,y:136,w:200,h:56,c:'mem',t:'Verify',s:'check data',d:'Check the data in the restored copy.',why:'Compare counts.',chk:`SELECT COUNT(*) FROM dbo.Orders;`,see:[1,3,'Backups and point-in-time restore']},
 {id:'sw',x:354,y:136,w:200,h:56,c:'proc',t:'Swap or copy',s:'rename or copy rows',d:'Rename the databases or copy needed rows back.',why:'Update connection strings.',chk:`ALTER DATABASE db MODIFY NAME = db_old;`,see:[1,3,'Backups and point-in-time restore']}],
 steps:[
 {ids:['tm','rs'],t:'1. Choose the time and restore to a new database.',w:'Original untouched.',s:'Retention.',x:'Out of retention.',c:`az sql db restore ...`},
 {ids:['vf','sw'],t:'2. Verify, then swap names or copy rows.',w:'Safe recovery.',s:'Cutover.',x:'Missed connection strings.',c:`SELECT COUNT(*) FROM dbo.Orders;`}]}},

]},

{t:'Platform comparison',d:'How the three Azure SQL options differ on the points that decide a choice.',see:[[0,3,'Decision tree for choosing a platform'],[0,0,'Azure SQL Database vs Managed Instance vs SQL on VM']],b:[
{t:[['Feature','Azure SQL Database','Managed Instance','SQL on Azure VM'],['Management model','Fully managed PaaS','Managed PaaS instance','IaaS, you manage'],['Instance-level features (Agent, CLR, cross-DB)','Limited','Mostly supported','All'],['Native backup to disk','No (automatic backups)','COPY_ONLY to URL','Yes'],['Operating system access','No','No','Yes'],['Version control','Always current','Always current','You choose'],['Networking','Public with firewall or private endpoint','In your VNet','In your VNet'],['Scaling','Online, serverless, Hyperscale','Vertical, with operations','Resize VM'],['Typical use','New cloud apps','Lift and shift','Maximum compatibility']]}
]},
{t:'Azure CLI commands',d:'Azure CLI commands used for Azure SQL tasks.',see:[[1,0,'Provisioning and logical servers'],[1,4,'Scaling and monitoring']],b:[
{t:[['Task','Command'],['Create a server','`az sql server create -n srv -g rg -l westeurope --enable-ad-only-auth ...`'],['Create a database','`az sql db create -n db -s srv -g rg --service-objective GP_Gen5_2`'],['Scale a database','`az sql db update -n db -s srv -g rg --service-objective GP_Gen5_4`'],['Firewall rule','`az sql server firewall-rule create -s srv -g rg -n office --start-ip-address ... --end-ip-address ...`'],['Point-in-time restore','`az sql db restore -n db -s srv -g rg --dest-name db_restore --time <UTC time>`'],['Managed Instance operations','`az sql mi op list --mi mi1 -g rg`'],['Elastic pool','`az sql elastic-pool create -n pool -s srv -g rg --edition GeneralPurpose`'],['VM registration','`az sql vm create -n vm -g rg --license-type PAYG`']]}
]},
]};
