/* LearnSphere - SQL Server Security and Compliance Quick Reference (cheat sheet).
   window.QREF['mss-sec'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for SQL Server 2019 to 2022 and current Azure SQL; verify syntax against your build. Check build-specific behaviour in the release notes. */
window.QREF=window.QREF||{};
window.QREF['mss-sec']={title:'SQL Server Security and Compliance Quick Reference',blurb:'Security checklist, permission cheat sheet and fixes for SQL Server, plus maps of protection layers, TDE keys, authorization and common tasks.',hint:'TDE certificate',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every SQL Server DBA should be able to explain about security, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Principals and authorization'},
{acc:[
{t:'Defense in depth',s:'Several layers, not one.',
 a:'Combine network controls, authentication, least-privilege authorization, encryption in transit and at rest, auditing and patching. No single control is enough.',
 w:'A failure of one layer is contained by the next.',
 c:`SELECT name, value_in_use FROM sys.configurations WHERE name IN ('xp_cmdshell','clr enabled','remote access');`,see:[0,0,'Defense in depth for SQL Server']},
{t:'Logins, users and orphaned users',s:'Server and database identities.',
 a:'A **login** authenticates to the instance, a **user** is that login\'s identity in a database. Restoring a database to another server can leave **orphaned users** whose SID does not match any login.',
 w:'Fix orphans with `ALTER USER ... WITH LOGIN`, not by recreating.',
 c:`EXEC sp_change_users_login 'Report';`,see:[1,1,'Logins, users and orphaned users']},
{t:'Windows, SQL and Entra authentication',s:'Prefer centrally managed identity.',
 a:'Windows authentication uses Kerberos or NTLM and AD policy. SQL authentication stores a password in SQL Server. Microsoft Entra ID authentication is used for Azure SQL and SQL Server 2022.',
 w:'Use integrated identities where possible.',
 c:`SELECT SERVERPROPERTY('IsIntegratedSecurityOnly');`,see:[1,0,'Windows vs SQL authentication']},
{t:'Roles and permissions',s:'GRANT, DENY, REVOKE.',
 a:'Permissions are granted to principals on **securables**. `DENY` overrides `GRANT`, and role membership accumulates. Use **database roles** and grant to roles, not individuals.',
 w:'Avoid `db_owner` and `sysadmin` for applications.',
 c:`SELECT dp.name, p.permission_name, p.state_desc FROM sys.database_permissions p JOIN sys.database_principals dp ON dp.principal_id = p.grantee_principal_id;`,see:[2,1,'GRANT, DENY and REVOKE']},
{t:'Ownership chaining',s:'Access through objects.',
 a:'If objects in a chain have the same owner, SQL Server checks permissions only on the first object. Stored procedures can therefore grant controlled access to tables without direct permission.',
 w:'Schemas and procedures are the standard least-privilege tool.',
 c:`GRANT EXECUTE ON SCHEMA::app TO AppRole;`,see:[2,2,'Schemas and ownership chaining']},
{t:'Least privilege model',s:'Design by role.',
 a:'Create roles for each function (reader, writer, executor, operator), grant them narrowly, and keep admin rights separate. Review membership regularly.',
 w:'Over-privilege is the most common finding in reviews.',
 c:`SELECT r.name AS role, m.name AS member FROM sys.database_role_members rm JOIN sys.database_principals r ON r.principal_id = rm.role_principal_id JOIN sys.database_principals m ON m.principal_id = rm.member_principal_id;`,see:[2,3,'Designing a least-privilege model']}
]},

{h:'Encryption'},
{acc:[
{t:'Encryption in transit',s:'TLS for connections.',
 a:'Install a certificate trusted by clients, enable **Force Encryption** and prefer strict encryption in newer versions. Clients should validate the certificate.',
 w:'Without it, credentials and data cross the network in clear text.',
 c:`SELECT session_id, encrypt_option FROM sys.dm_exec_connections;`,see:[3,2,'Forcing encryption']},
{t:'TDE key hierarchy',s:'Service master key down to DEK.',
 a:'TDE uses a **database encryption key** protected by a **certificate** in master, which is protected by the **database master key**, which is protected by the **service master key**.',
 w:'Back up the certificate and private key before enabling TDE.',
 c:`SELECT db_name(database_id), encryption_state_desc FROM sys.dm_database_encryption_keys;`,see:[4,0,'The key hierarchy']},
{t:'Enabling TDE',s:'Order matters.',
 a:'Create the master key and certificate in master, **back up the certificate**, create the DEK in the user database and set `ENCRYPTION ON`. tempdb is encrypted too.',
 w:'Test a restore on another server before relying on it.',
 c:`ALTER DATABASE MyDb SET ENCRYPTION ON;`,see:[4,1,'Enabling TDE step by step']},
{t:'Always Encrypted',s:'Keys stay with the client.',
 a:'Column values are encrypted by the client driver using a **column encryption key**, protected by a **column master key**. The server never sees plaintext, except in secure enclaves.',
 w:'It protects against DBAs and cloud operators, at the cost of query functionality.',
 c:`SELECT * FROM sys.column_encryption_keys;`,see:[5,0,'What Always Encrypted protects']},
{t:'Deterministic and randomized',s:'A trade-off.',
 a:'**Deterministic** encryption allows equality comparison and joins. **Randomized** is stronger but supports no comparisons without enclaves.',
 w:'Choose by query need and risk.',
 c:`SELECT name, encryption_type_desc FROM sys.columns WHERE encryption_type IS NOT NULL;`,see:[5,2,'Deterministic vs randomized encryption']}
]},

{h:'Data controls, audit and hardening'},
{acc:[
{t:'Row-level security',s:'Filter rows by user.',
 a:'A **security policy** applies an inline table-valued function as a filter or block predicate, so users only see their own rows regardless of the query.',
 w:'It moves access rules into the database.',
 c:`CREATE SECURITY POLICY app.OrderFilter ADD FILTER PREDICATE app.fn_filter(TenantId) ON dbo.Orders WITH (STATE = ON);`,see:[6,0,'Row-level security']},
{t:'Dynamic data masking',s:'Obfuscate in results.',
 a:'Masking hides values in query results for users without `UNMASK`. It is not encryption and can be inferred by crafted queries.',
 w:'Use it to reduce accidental exposure, not as a security boundary.',
 c:`ALTER TABLE dbo.Customers ALTER COLUMN Email ADD MASKED WITH (FUNCTION = 'email()');`,see:[6,1,'Dynamic data masking']},
{t:'SQL Server Audit',s:'Who did what.',
 a:'An **audit** defines the target (file, application log, security log), and **specifications** choose events at server or database level. Protect and review the output.',
 w:'Audit data is only useful if someone reads it.',
 c:`SELECT * FROM sys.server_audits;`,see:[7,0,'SQL Server Audit architecture']},
{t:'Attack surface',s:'Turn off what you do not use.',
 a:'Disable `xp_cmdshell`, unused features, unneeded network protocols, and the SQL Browser if not required. Restrict who can use CLR and linked servers.',
 w:'Every feature enabled is more to defend.',
 c:`EXEC sp_configure 'xp_cmdshell';`,see:[8,0,'Reducing the attack surface']},
{t:'SQL injection',s:'Parameterise.',
 a:'Injection happens when user input is concatenated into SQL. Use parameterised queries or stored procedures, validate input, and give the application a low-privilege login.',
 w:'It is an application bug with a database-level blast radius.',
 c:`EXEC sp_executesql N'SELECT * FROM dbo.Users WHERE Name = @n', N'@n nvarchar(50)', @n = @Name;`,see:[8,1,'SQL injection and how to prevent it']},
{t:'The sa account and service accounts',s:'High-value targets.',
 a:'Rename or disable `sa`, use a strong password if it must be enabled, and keep service accounts unprivileged with managed passwords.',
 w:'Attackers try `sa` first.',
 c:`SELECT name, is_disabled FROM sys.server_principals WHERE name = 'sa';`,see:[8,4,'Protecting the sa account and service accounts']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Three small maps of how the parts fit together: protection layers, the TDE key hierarchy and authorization.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. Layers of protection'},
{map:{title:'Security layers map',h:328,trace:'From the network to the data',
 hint:'Tap any box, or press From the network to the data to follow a connection through the layers.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'net',x:126,y:24,w:200,h:56,c:'net',t:'Network',s:'firewall and ports',d:'Limit who can reach the instance.',why:'Segment and restrict.',chk:`SELECT local_tcp_port FROM sys.dm_exec_connections WHERE session_id = @@SPID;`,see:[8,0,'Reducing the attack surface']},
 {id:'tls',x:354,y:24,w:200,h:56,c:'net',t:'TLS',s:'encryption in transit',d:'Encrypt the connection with a trusted certificate.',why:'Force encryption.',chk:`SELECT encrypt_option FROM sys.dm_exec_connections WHERE session_id = @@SPID;`,see:[3,2,'Forcing encryption']},
 {id:'auth',x:126,y:136,w:200,h:56,c:'proc',t:'Authentication',s:'login',d:'Windows, SQL or Entra identity.',why:'Prefer integrated.',chk:`SELECT auth_scheme FROM sys.dm_exec_connections WHERE session_id = @@SPID;`,see:[1,0,'Windows vs SQL authentication']},
 {id:'z',x:354,y:136,w:200,h:56,c:'proc',t:'Authorization',s:'roles and permissions',d:'What the principal may do.',why:'Least privilege.',chk:`SELECT * FROM fn_my_permissions(NULL, 'DATABASE');`,see:[2,3,'Designing a least-privilege model']},
 {id:'tde',x:126,y:248,w:200,h:56,c:'disk',t:'Encryption at rest',s:'TDE, Always Encrypted',d:'Protect files and backups, and optionally columns.',why:'Protect the keys.',chk:`SELECT * FROM sys.dm_database_encryption_keys;`,see:[4,1,'Enabling TDE step by step']},
 {id:'aud',x:354,y:248,w:200,h:56,c:'mem',t:'Audit',s:'evidence',d:'Record access and changes.',why:'Review regularly.',chk:`SELECT * FROM sys.dm_server_audit_status;`,see:[7,0,'SQL Server Audit architecture']}],
 steps:[
 {ids:['net','tls'],t:'1. The network path is restricted and the connection is encrypted.',w:'Outer layers.',s:'Firewall, certificate.',x:'Unencrypted.',c:`SELECT encrypt_option FROM sys.dm_exec_connections;`},
 {ids:['auth','z'],t:'2. The caller authenticates and is authorized.',w:'Identity and rights.',s:'Roles.',x:'Over-privilege.',c:`SELECT * FROM fn_my_permissions(NULL, 'SERVER');`},
 {ids:['tde','aud'],t:'3. Data at rest is encrypted and access is audited.',w:'Last layers.',s:'Keys, audit.',x:'Lost certificates.',c:`SELECT * FROM sys.server_audits;`}]}},

{h:'2. TDE key hierarchy'},
{map:{title:'TDE map',h:328,trace:'Keys from the service master key to the database',
 hint:'Tap any box, or press Keys from the service master key to the database to follow the hierarchy.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'smk',x:126,y:24,w:200,h:56,c:'disk',t:'Service master key',s:'DPAPI',d:'Generated at setup and protected by the Windows service account.',why:'Back it up.',chk:`BACKUP SERVICE MASTER KEY TO FILE = 'X:\\keys\\smk.key' ENCRYPTION BY PASSWORD = '***';`,see:[4,0,'The key hierarchy']},
 {id:'dmk',x:354,y:24,w:200,h:56,c:'disk',t:'Database master key',s:'in master',d:'Protects the certificate\'s private key.',why:'Strong password.',chk:`CREATE MASTER KEY ENCRYPTION BY PASSWORD = '***';`,see:[4,0,'The key hierarchy']},
 {id:'cert',x:126,y:136,w:200,h:56,c:'disk',t:'Certificate',s:'in master',d:'Protects the DEK. Needed to restore elsewhere.',why:'Back up with the private key.',chk:`CREATE CERTIFICATE TdeCert WITH SUBJECT = 'TDE';`,see:[4,2,'Backing up certificates']},
 {id:'dek',x:354,y:136,w:200,h:56,c:'disk',t:'Database encryption key',s:'in the database',d:'Encrypts the data and log pages.',why:'AES_256.',chk:`CREATE DATABASE ENCRYPTION KEY WITH ALGORITHM = AES_256 ENCRYPTION BY SERVER CERTIFICATE TdeCert;`,see:[4,1,'Enabling TDE step by step']},
 {id:'bk',x:240,y:248,w:200,h:56,c:'warn',t:'Backups of keys',s:'offsite',d:'Without the certificate and key, backups are unreadable.',why:'Test restore on another server.',chk:`BACKUP CERTIFICATE TdeCert TO FILE = 'X:\\keys\\TdeCert.cer' WITH PRIVATE KEY (...);`,see:[4,2,'Backing up certificates']}],
 steps:[
 {ids:['smk','dmk'],t:'1. The service master key protects the database master key.',w:'Chain of protection.',s:'SMK.',x:'Lost SMK on rebuild.',c:`SELECT * FROM sys.symmetric_keys;`},
 {ids:['cert','dek'],t:'2. The certificate protects the DEK, which encrypts the data.',w:'Transparent to apps.',s:'Certificate.',x:'Expired or lost cert.',c:`SELECT * FROM sys.certificates;`},
 {ids:['bk'],t:'3. Back up the certificate and private key.',w:'Recoverable.',s:'Backup.',x:'Not tested.',c:`BACKUP CERTIFICATE ...`}]}},

{h:'3. Authorization path'},
{map:{title:'Authorization map',h:328,trace:'From login to a permission',
 hint:'Tap any box, or press From login to a permission to follow how access is decided.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'lg',x:126,y:24,w:200,h:56,c:'ext',t:'Login',s:'server principal',d:'Authenticates to the instance.',why:'Windows group logins are easier to manage.',chk:`SELECT name, type_desc FROM sys.server_principals;`,see:[1,1,'Logins, users and orphaned users']},
 {id:'us',x:354,y:24,w:200,h:56,c:'mem',t:'Database user',s:'mapped to login',d:'The identity inside the database.',why:'Contained users avoid orphan issues.',chk:`SELECT name, type_desc FROM sys.database_principals;`,see:[1,2,'Contained database users']},
 {id:'rl',x:126,y:136,w:200,h:56,c:'mem',t:'Role',s:'group of permissions',d:'Membership grants permissions.',why:'Grant to roles.',chk:`SELECT * FROM sys.database_role_members;`,see:[2,0,'Server and database roles']},
 {id:'pm',x:354,y:136,w:200,h:56,c:'proc',t:'Permission',s:'GRANT, DENY',d:'A permission on a securable. DENY wins.',why:'Check effective rights.',chk:`SELECT * FROM fn_my_permissions('dbo.Orders', 'OBJECT');`,see:[2,1,'GRANT, DENY and REVOKE']},
 {id:'ow',x:240,y:248,w:200,h:56,c:'proc',t:'Ownership chain',s:'same owner',d:'Permissions are not rechecked within an ownership chain.',why:'Use schemas and procedures.',chk:`SELECT name, principal_id FROM sys.schemas;`,see:[2,2,'Schemas and ownership chaining']}],
 steps:[
 {ids:['lg','us'],t:'1. A login maps to a user in the database.',w:'Identity.',s:'Mapping.',x:'Orphaned user.',c:`EXEC sp_change_users_login 'Report';`},
 {ids:['rl','pm'],t:'2. Roles and permissions decide the rights.',w:'Effective permission.',s:'DENY.',x:'Hidden role membership.',c:`SELECT * FROM fn_my_permissions(NULL, 'DATABASE');`},
 {ids:['ow'],t:'3. Ownership chaining lets procedures expose tables safely.',w:'Controlled access.',s:'Owner.',x:'Broken chain.',c:`SELECT * FROM sys.schemas;`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Three small maps of how something happens, step by step: enabling TDE, least-privilege design and auditing.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Enabling TDE'},
{map:{title:'TDE steps map',h:328,trace:'Encrypt a database and keep it recoverable',
 hint:'Tap any box, or press Encrypt a database and keep it recoverable to follow the steps.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L340 219 L340 246'],
 nodes:[
 {id:'mk',x:126,y:24,w:200,h:56,c:'proc',t:'Master key',s:'in master',d:'Create the database master key.',why:'Strong password.',chk:`CREATE MASTER KEY ENCRYPTION BY PASSWORD = '***';`,see:[4,1,'Enabling TDE step by step']},
 {id:'ce',x:354,y:24,w:200,h:56,c:'proc',t:'Certificate',s:'create',d:'Create the certificate that will protect the DEK.',why:'Set an expiry.',chk:`CREATE CERTIFICATE TdeCert WITH SUBJECT = 'TDE cert';`,see:[4,1,'Enabling TDE step by step']},
 {id:'bk',x:126,y:136,w:200,h:56,c:'warn',t:'Back up certificate',s:'before encrypting',d:'Export the certificate and private key to a secure location.',why:'Test a restore.',chk:`BACKUP CERTIFICATE TdeCert TO FILE = ... WITH PRIVATE KEY (...);`,see:[4,2,'Backing up certificates']},
 {id:'en',x:354,y:136,w:200,h:56,c:'proc',t:'Encrypt',s:'ALTER DATABASE',d:'Create the DEK and turn encryption on.',why:'Runs in the background.',chk:`ALTER DATABASE MyDb SET ENCRYPTION ON;`,see:[4,1,'Enabling TDE step by step']},
 {id:'ver',x:240,y:248,w:200,h:56,c:'mem',t:'Verify',s:'encryption_state',d:'State 3 means encrypted.',why:'Include tempdb.',chk:`SELECT encryption_state, percent_complete FROM sys.dm_database_encryption_keys;`,see:[4,3,'TDE and backups, tempdb and log shipping']}],
 steps:[
 {ids:['mk','ce'],t:'1. Create the master key and certificate.',w:'Key chain.',s:'Names.',x:'Forgotten password.',c:`SELECT * FROM sys.certificates;`},
 {ids:['bk','en'],t:'2. Back up the certificate, then encrypt.',w:'Never the other way round.',s:'Backup.',x:'No offsite copy.',c:`ALTER DATABASE MyDb SET ENCRYPTION ON;`},
 {ids:['ver'],t:'3. Verify completion and test restore.',w:'Proof.',s:'State.',x:'Untested restore.',c:`SELECT * FROM sys.dm_database_encryption_keys;`}]}},

{h:'2. Building a least-privilege model'},
{map:{title:'Least privilege map',h:216,trace:'From requirements to roles',
 hint:'Tap any box, or press From requirements to roles to follow the design.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'inv',x:126,y:24,w:200,h:56,c:'mem',t:'Inventory access',s:'who needs what',d:'List applications, people and the objects they need.',why:'Ask the owners.',chk:`SELECT * FROM sys.database_permissions;`,see:[2,3,'Designing a least-privilege model']},
 {id:'rol',x:354,y:24,w:200,h:56,c:'proc',t:'Create roles',s:'by function',d:'Create database roles per function.',why:'Name by purpose.',chk:`CREATE ROLE app_reader;`,see:[2,0,'Server and database roles']},
 {id:'grt',x:126,y:136,w:200,h:56,c:'proc',t:'Grant to roles',s:'on schemas',d:'Grant permissions to roles on schemas or procedures.',why:'Prefer EXECUTE.',chk:`GRANT SELECT ON SCHEMA::sales TO app_reader;`,see:[2,1,'GRANT, DENY and REVOKE']},
 {id:'rev',x:354,y:136,w:200,h:56,c:'mem',t:'Review',s:'regularly',d:'Review membership and permissions on a schedule.',why:'Remove stale access.',chk:`SELECT * FROM sys.database_role_members;`,see:[2,4,'Auditing permissions']}],
 steps:[
 {ids:['inv','rol'],t:'1. Inventory access and create roles.',w:'Based on need.',s:'Roles.',x:'One role for all.',c:`SELECT * FROM sys.database_principals WHERE type = 'R';`},
 {ids:['grt','rev'],t:'2. Grant to roles and review regularly.',w:'Controlled and auditable.',s:'Review.',x:'Stale members.',c:`SELECT * FROM sys.database_role_members;`}]}},

{h:'3. Setting up auditing'},
{map:{title:'Audit setup map',h:216,trace:'Capture and protect audit data',
 hint:'Tap any box, or press Capture and protect audit data to follow an audit setup.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164]],
 nodes:[
 {id:'tgt',x:126,y:24,w:200,h:56,c:'disk',t:'Create audit',s:'target',d:'Choose a file, application or security log target.',why:'Protect the location.',chk:`CREATE SERVER AUDIT MainAudit TO FILE (FILEPATH = 'X:\\audit\\');`,see:[7,2,'Audit targets: file, application and security log']},
 {id:'sp',x:354,y:24,w:200,h:56,c:'proc',t:'Specification',s:'what to log',d:'Choose server or database actions to capture.',why:'Be selective.',chk:`CREATE DATABASE AUDIT SPECIFICATION DbSpec FOR SERVER AUDIT MainAudit ADD (SELECT ON dbo.Customers BY public);`,see:[7,1,'Server and database audit specifications']},
 {id:'en',x:126,y:136,w:200,h:56,c:'proc',t:'Enable',s:'STATE ON',d:'Turn the audit and specification on.',why:'Check status.',chk:`ALTER SERVER AUDIT MainAudit WITH (STATE = ON);`,see:[7,1,'Server and database audit specifications']},
 {id:'rd',x:354,y:136,w:200,h:56,c:'mem',t:'Read and alert',s:'review',d:'Read events with `sys.fn_get_audit_file` and alert on key events.',why:'Someone must read it.',chk:`SELECT * FROM sys.fn_get_audit_file('X:\\audit\\*.sqlaudit', NULL, NULL);`,see:[7,3,'Reading and alerting on audit data']}],
 steps:[
 {ids:['tgt','sp'],t:'1. Create the audit target and specifications.',w:'Define the scope.',s:'Specifications.',x:'Too much data.',c:`SELECT * FROM sys.server_audits;`},
 {ids:['en','rd'],t:'2. Enable and read the events.',w:'Evidence.',s:'Retention.',x:'Nobody reviews.',c:`SELECT * FROM sys.fn_get_audit_file(...);`}]}},

]},

{t:'Security checklist',d:'A checklist of controls for a SQL Server instance and what to verify.',see:[[9,2,'Security review checklist'],[8,0,'Reducing the attack surface']],b:[
{t:[['Control','Verify with'],['Latest security updates installed','`SELECT @@VERSION;` and the build list'],['Encryption forced and certificate trusted','`SELECT encrypt_option FROM sys.dm_exec_connections;`'],['`sa` disabled or renamed','`SELECT name, is_disabled FROM sys.server_principals WHERE sid = 0x01;`'],['`xp_cmdshell` and unused features off','`SELECT name, value_in_use FROM sys.configurations;`'],['Few `sysadmin` members','`SELECT * FROM sys.server_role_members;`'],['TDE on sensitive databases, keys backed up','`SELECT * FROM sys.dm_database_encryption_keys;`'],['Audit enabled and reviewed','`SELECT * FROM sys.dm_server_audit_status;`'],['Service accounts unprivileged','`SELECT service_account FROM sys.dm_server_services;`'],['No orphaned users','`EXEC sp_change_users_login \'Report\';`'],['Backups protected','Check file permissions and encryption']]}
]},
{t:'Permission cheat sheet',d:'Common tasks and the permission or role that fits them.',see:[[2,0,'Server and database roles'],[2,1,'GRANT, DENY and REVOKE']],b:[
{t:[['Need','Grant'],['Read all tables','`db_datareader` (or `SELECT` on a schema)'],['Write all tables','`db_datawriter` (or specific rights)'],['Run procedures','`GRANT EXECUTE ON SCHEMA::app TO role`'],['See definitions','`VIEW DEFINITION`'],['See server state (DMVs)','`VIEW SERVER STATE`, `VIEW SERVER PERFORMANCE STATE` (2022)'],['Manage Agent jobs','`SQLAgentOperatorRole` or `SQLAgentUserRole` in msdb'],['Run backups','`db_backupoperator`'],['Create users','`ALTER ANY USER`'],['Impersonate','`IMPERSONATE` on the principal (use carefully)'],['Unmask data','`UNMASK`']]}
]},
]};
