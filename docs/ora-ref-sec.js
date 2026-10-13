/* LearnSphere - Oracle Security & Compliance Quick Reference (cheat sheet).
   window.QREF['ora-sec'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Values are for Oracle Database 19c on Linux unless stated; 26ai features are marked [26ai].
   Many security features are separately licensed options: confirm in the Licensing Information User Manual. */
window.QREF=window.QREF||{};
window.QREF['ora-sec']={title:'Security & Compliance Quick Reference',blurb:'Which feature protects what, files, parameters, views, error codes and a hardening checklist, one page each.',hint:'audit or wallet',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas behind Oracle database security that you should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one query or command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Foundations'},
{acc:[
{t:'Defence in depth',s:'Many layers, so one failure is not a breach.',
 a:'No single control protects a database. You layer **network** controls, **host** hardening, **authentication**, **authorization**, **encryption**, **auditing** and **operations** (patching and configuration), so an attacker has to defeat several, and a mistake in one does not expose the data.',
 w:'When a review finds one weak layer, the other layers are what limit the damage.',
 c:`SELECT parameter, value FROM v$option WHERE parameter IN ('Advanced Security','Oracle Database Vault','Label Security');`,see:[0,0,'Defense in depth and the Oracle security architecture']},
{t:'Threat model',s:'Know who and what you defend against.',
 a:'A threat model lists **who** might attack (outsiders, compromised applications, malicious or careless insiders, privileged administrators) and **what** they could do (steal data, change it, destroy it, escalate). It decides where to spend effort.',
 w:'A control that is not tied to a threat is either wasted or a false comfort.',
 c:`SELECT username, account_status, authentication_type FROM dba_users WHERE oracle_maintained = 'N' ORDER BY 1;`,see:[0,1,'Threat model for an Oracle database']},
{t:'Least privilege and separation of duties',s:'Give the minimum, split the powers.',
 a:'**Least privilege** means every account holds only the privileges it needs. **Separation of duties** means no single person can do and hide a sensitive thing: the person who administers the database is not the person who reviews the audit trail or manages the keys. Oracle has separate administrative privileges for this.',
 w:'Most data breaches use a legitimate account with too much power.',
 c:`SELECT grantee, privilege FROM dba_sys_privs WHERE privilege LIKE '%ANY%' AND grantee NOT IN (SELECT username FROM dba_users WHERE oracle_maintained = 'Y');`,see:[0,2,'Least privilege and separation of duties']},
{t:'Security standards and assessment',s:'Measure against a recognised baseline.',
 a:'Benchmarks such as **CIS** and **DISA STIG** list secure settings for Oracle. **DBSAT** (the Database Security Assessment Tool) scans your database and reports findings against such rules and against good practice, with a risk rating.',
 w:'It gives you a prioritised list instead of an opinion, and a before-and-after measure.',
 c:`$ dbsat collect -n system@orcl /tmp/orcl_dbsat
$ dbsat report /tmp/orcl_dbsat`,see:[0,6,'Practical: Assess a database with DBSAT']},
{t:'Security options and licensing',s:'Which feature needs which licence.',
 a:'**Advanced Security** covers TDE and Data Redaction. **Database Vault** adds realms and command rules. **Label Security** adds label-based access. **Data Safe** is a cloud service for assessment, masking and audit. Several core features, such as Unified Auditing, VPD and network encryption, do not need extra licences, and the rules change by release.',
 w:'Check the licensing guide before enabling an option. Using a feature without a licence is a compliance finding.',
 c:`SELECT name, detected_usages, currently_used FROM dba_feature_usage_statistics WHERE name LIKE '%Encryption%' OR name LIKE '%Vault%' OR name LIKE '%Redaction%';`,see:[0,4,'Security options and licensing']}
]},

{h:'Authentication and authorization'},
{acc:[
{t:'Password verifiers',s:'How a password is stored.',
 a:'A database stores a **verifier**, not the password. Old verifiers (10G, 11G) are weak and are removed when you set a higher minimum logon version. The **12C** verifier uses a salted, iterated hash. Parameters such as `SQLNET.ALLOWED_LOGON_VERSION_SERVER` control which versions are accepted.',
 w:'Old clients that need old verifiers are a risk you should retire, not accommodate.',
 c:`SELECT username, password_versions FROM dba_users WHERE oracle_maintained = 'N';`,see:[1,0,'Database authentication and password verifiers']},
{t:'Profiles and account policy',s:'Rules for passwords and resources.',
 a:'A **profile** sets password lifetime, reuse, complexity (through a verify function), lockout after failed logins, and limits such as sessions per user. Every user has a profile, and the default profile is rarely what you want.',
 w:'Use a profile for people and another for application accounts (which may have no expiry but strong rotation).',
 c:`SELECT profile, resource_name, limit FROM dba_profiles WHERE resource_type = 'PASSWORD' AND profile = 'DEFAULT';`,see:[1,1,'Password profiles and account policies']},
{t:'Administrative privileges',s:'SYSDBA is not one thing.',
 a:'Oracle has several administrative privileges: **SYSDBA**, **SYSOPER**, **SYSBACKUP**, **SYSDG**, **SYSKM** and **SYSRAC**. Each is limited to its task, so a backup operator does not need SYSDBA. They authenticate through the **password file** or the operating system.',
 w:'Use the narrowest one. Review who is in the password file.',
 c:`SELECT username, sysdba, sysoper, sysbackup, sysdg, syskm FROM v$pwfile_users;`,see:[1,2,'OS authentication and the password file']},
{t:'External and centrally managed users',s:'Do not keep every password in the database.',
 a:'**Kerberos** and **certificate** authentication let clients prove identity without a database password. **Centrally managed users** map directory users and groups (Active Directory, Entra ID) to database accounts and roles, so joiners and leavers are managed in one place.',
 w:'It removes shared and stale accounts, and gives you one place to disable a person.',
 c:`SELECT username, authentication_type, external_name FROM dba_users WHERE authentication_type <> 'PASSWORD';`,see:[1,4,'Centrally managed users with Active Directory and Entra ID']},
{t:'Privileges, roles and ANY',s:'Who can do what.',
 a:'**System privileges** allow actions, **object privileges** allow access to one object, and **roles** group them. The `ANY` privileges (`SELECT ANY TABLE`, `CREATE ANY PROCEDURE`) apply across all schemas and are the most dangerous. Grants to **PUBLIC** apply to everyone.',
 w:'Audit the ANY privileges and PUBLIC grants first. They are the cheapest wins.',
 c:`SELECT grantee, table_name, privilege FROM dba_tab_privs WHERE grantee = 'PUBLIC' AND owner NOT IN (SELECT username FROM dba_users WHERE oracle_maintained = 'Y') FETCH FIRST 20 ROWS ONLY;`,see:[2,1,'The ANY privilege risk and PUBLIC grants']},
{t:'Privilege analysis',s:'Find out which privileges are really used.',
 a:'**Privilege analysis** records which privileges a user or role actually exercises over a period, and reports the ones that were granted but never used. You then revoke them with evidence.',
 w:'It is how you reduce an over-privileged application schema without breaking it.',
 c:`EXEC DBMS_PRIVILEGE_CAPTURE.CREATE_CAPTURE(name => 'app_cap', type => DBMS_PRIVILEGE_CAPTURE.G_ROLE, roles => role_name_list('APP_ROLE'));
EXEC DBMS_PRIVILEGE_CAPTURE.ENABLE_CAPTURE('app_cap');`,see:[2,2,'Privilege analysis: capture and revoke']},
{t:'Definer and invoker rights',s:'Whose privileges does the code use.',
 a:'A **definer\'s rights** procedure runs with the owner\'s privileges, so it can give users controlled access to data they cannot read directly. An **invoker\'s rights** procedure runs with the caller\'s. Code-based access (roles granted to a unit) refines this.',
 w:'Definer rights are a way to expose a narrow operation. A poorly written one is a privilege escalation path.',
 c:`SELECT owner, object_name, authid FROM dba_procedures WHERE authid = 'DEFINER' AND owner = 'APP' FETCH FIRST 10 ROWS ONLY;`,see:[2,3,'Invoker\'s rights, definer\'s rights and code-based access']}
]},

{h:'Protecting data in transit and at rest'},
{acc:[
{t:'Network encryption',s:'Native or TLS.',
 a:'**Native network encryption** is configured in `sqlnet.ora` on client and server and needs no certificates. **TLS** uses certificates and a wallet, and can also authenticate the client. Both encrypt and protect the integrity of the traffic between client and database.',
 w:'Use TLS where certificates are managed, native encryption where they are not. Do not leave connections unencrypted.',
 c:`SELECT network_service_banner FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV','SID');`,see:[3,0,'Native network encryption and integrity']},
{t:'Listener hardening',s:'The front door.',
 a:'Restrict who can administer the listener (local OS authentication, `ADMIN_RESTRICTIONS`), control which hosts can register services (`VALID_NODE_CHECKING`), limit the addresses it listens on, and keep it patched. A listener with default settings is an attack surface.',
 w:'Any change to a listener parameter is a security change. Treat it with the same care as the database.',
 c:`$ lsnrctl status
$ lsnrctl show admin_restrictions_listener`,see:[3,2,'Listener hardening']},
{t:'Database links',s:'A trusted path to another database.',
 a:'A **database link** stores credentials or uses the current user to connect to another database. A link with a stored password is a standing credential, and a **public** link is usable by everyone. Links expand the blast radius of a compromise.',
 w:'Inventory your links. Remove unused ones, avoid public links and use the least-privileged remote account.',
 c:`SELECT owner, db_link, username, host, created FROM dba_db_links;`,see:[3,4,'Securing database links']},
{t:'TDE key hierarchy',s:'A master key protects the data keys.',
 a:'**Transparent Data Encryption** uses a **master encryption key** held in a **keystore** outside the database. The master key protects the **table or tablespace keys**, and those encrypt the data. Rotating the master key re-encrypts only the small keys, not the data.',
 w:'The data on disk, in backups and in export files is useless without the keystore.',
 c:`SELECT wrl_type, wrl_parameter, status, wallet_type FROM v$encryption_wallet;`,see:[4,0,'TDE concepts: master key, table keys and keystores']},
{t:'Keystore types',s:'How the keystore is opened.',
 a:'A **password** keystore must be opened by an administrator after each restart. An **auto-login** keystore opens by itself and can be used on any host. A **local auto-login** keystore opens by itself only on the host where it was created. External options (HSM, Key Vault) keep the master key outside the file system.',
 w:'Auto-login is convenient and weaker. Choose by threat model, and know that a closed keystore stops encrypted data being read.',
 c:`SELECT wallet_type, status, keystore_mode FROM v$encryption_wallet;`,see:[4,1,'Keystore types: password, auto-login and local auto-login']},
{t:'Encrypting tablespaces and existing data',s:'Online conversion.',
 a:'Encrypting at **tablespace** level is the normal method, and existing tablespaces can be encrypted **online**, with the database open. Column encryption is available for specific columns, but has limits on indexes and queries.',
 w:'Plan I/O and space, since conversion rewrites the data files. Verify the result and the backups.',
 c:`SELECT tablespace_name, encrypted FROM dba_tablespaces;
ALTER TABLESPACE users ENCRYPT ONLINE USING 'AES256' ENCRYPT FILE_NAME_CONVERT = ('users01.dbf','users01_enc.dbf');`,see:[4,3,'Online conversion of existing data']},
{t:'Key rotation',s:'Change the key without re-encrypting everything.',
 a:'You rotate the **master key** regularly, and after any suspicion of exposure, with `ADMINISTER KEY MANAGEMENT SET KEY`. The data keys are re-wrapped under the new master key. Rekeying the data itself is a heavier operation.',
 w:'Take a keystore backup before and after. Old keystores are still needed to read old backups.',
 c:`ADMINISTER KEY MANAGEMENT SET KEY USING TAG 'rotation_2026' FORCE KEYSTORE IDENTIFIED BY "********" WITH BACKUP;`,see:[4,4,'Key rotation and rekeying']},
{t:'TDE with backups, Data Pump and standby',s:'Keys must travel with the data.',
 a:'Encrypted backups and standbys need the same master key. A **standby** needs a copy of the keystore, and RMAN restores need the keystore on the target host. Data Pump exports can be encrypted separately with a password.',
 w:'The most common TDE outage is a restore or failover to a host that does not have the keystore.',
 c:`SELECT key_id, creation_time, activation_time FROM v$encryption_keys ORDER BY creation_time DESC FETCH FIRST 3 ROWS ONLY;`,see:[4,6,'Backups, Data Pump and standby with TDE']}
]},

{h:'Auditing and data controls'},
{acc:[
{t:'Unified auditing',s:'One audit trail.',
 a:'**Unified Auditing** collects audit records from all sources into one trail, `UNIFIED_AUDIT_TRAIL`, stored securely in the `AUDSYS` schema. It is enabled by default in new databases, and policies decide what is recorded. A small set of actions is always audited.',
 w:'Everything you audit has a cost in storage and time, so audit what answers a question you will ask.',
 c:`SELECT policy_name, enabled_option, entity_name FROM audit_unified_enabled_policies;`,see:[5,0,'Unified auditing architecture']},
{t:'Audit policies',s:'Say what to record.',
 a:'A policy lists **actions**, **privileges** or **objects** to audit, with optional conditions and whether to record successes or failures. Oracle provides predefined policies for the common cases, such as logon failures and privileged use.',
 w:'Start with privileged users, logon failures and schema changes. Then add what the business needs.',
 c:`CREATE AUDIT POLICY admin_actions ACTIONS ALTER USER, CREATE USER, DROP USER, GRANT, REVOKE;
AUDIT POLICY admin_actions;`,see:[5,1,'Audit policies: predefined and custom']},
{t:'Fine-grained auditing',s:'Audit by data and condition.',
 a:'**FGA** records access to specific rows or columns that match a condition, for example a query that reads salary values above a threshold, and can call a handler. It is complementary to standard audit policies.',
 w:'Use it for sensitive data access where who and when matters, and keep the condition narrow.',
 c:`BEGIN DBMS_FGA.ADD_POLICY(object_schema => 'HR', object_name => 'EMPLOYEES', policy_name => 'sal_access', audit_column => 'SALARY', enable => TRUE); END;
/`,see:[5,4,'Fine-grained auditing']},
{t:'Audit trail management',s:'A trail that is never purged fills the disk.',
 a:'The unified audit trail grows and must be archived and purged with `DBMS_AUDIT_MGMT`. Set a retention, archive to a safe place first, and automate a purge job.',
 w:'An audit trail that is purged without being archived is not an audit trail.',
 c:`SELECT COUNT(*), MIN(event_timestamp) FROM unified_audit_trail;
SELECT segment_name, ROUND(bytes/1024/1024) AS mb FROM dba_segments WHERE owner = 'AUDSYS';`,see:[5,3,'Audit trail management and purge']},
{t:'Data Redaction',s:'Mask on the way out.',
 a:'**Data Redaction** changes query results at run time according to policies, for example showing only the last four digits of a card number, without changing the stored data or the application. Policies can depend on the user or the context.',
 w:'It limits what ordinary users and tools see, and it is not a replacement for access control.',
 c:`SELECT object_owner, object_name, column_name, function_type FROM redaction_columns;`,see:[6,1,'Data Redaction']},
{t:'Virtual Private Database',s:'Row-level security by policy.',
 a:'**VPD** attaches a predicate to every statement on a table, so a user sees only the rows they should (their region, their customers). It is applied inside the database, regardless of the tool used to connect.',
 w:'It centralises row security in the database rather than in every application.',
 c:`SELECT object_name, policy_name, function FROM dba_policies WHERE object_owner = 'APP';`,see:[6,2,'Virtual Private Database and fine-grained access']},
{t:'Database Vault',s:'Separate the administrator from the data.',
 a:'**Database Vault** uses **realms** that protect application data even from highly privileged accounts, and **command rules** that control which commands may run and when. It enforces separation of duties inside the database.',
 w:'It is for the case where the DBA should not be able to read the business data, and it adds operational process.',
 c:`SELECT name, enabled FROM dba_dv_realm;`,see:[6,4,'Database Vault: realms and command rules']},
{t:'Masking and subsetting',s:'Do not copy production data to test.',
 a:'**Data masking** replaces sensitive values with realistic fakes when copying data to non-production, and **subsetting** copies only part of the data. **Discovery** tools find where sensitive data lives first.',
 w:'Test and development copies are the usual place where production data leaks.',
 c:`SELECT table_name, column_name FROM dba_tab_columns WHERE column_name LIKE '%SSN%' OR column_name LIKE '%CARD%';`,see:[6,5,'Data masking and subsetting for non-production']}
]},

{h:'Modern protections and operations'},
{acc:[
{t:'SQL Firewall',s:'Allow only the statements the app runs.',
 a:'**SQL Firewall** (26ai) captures the SQL an application actually runs, builds an **allow-list** from it, and then blocks or reports statements and connections outside it. It sits in the database, so it works whatever path the statement came through.',
 w:'It is a strong defence against SQL injection and stolen credentials, because an attacker\'s statements do not match the allow-list.',
 c:`EXEC DBMS_SQL_FIREWALL.ENABLE;
EXEC DBMS_SQL_FIREWALL.CREATE_CAPTURE(username => 'APP', top_level_only => TRUE);`,see:[7,1,'SQL Firewall: capture, allow-list and enforce']},
{t:'Immutable tables',s:'Rows that cannot be changed or deleted.',
 a:'An **immutable table** blocks updates, and blocks deletes until a retention period passes. Blockchain tables add a cryptographic chain over the rows. They are for records that must not be altered, even by privileged users.',
 w:'They support audit and compliance records that need tamper evidence.',
 c:`CREATE IMMUTABLE TABLE app.audit_log (id NUMBER, msg VARCHAR2(200)) NO DROP UNTIL 16 DAYS IDLE NO DELETE UNTIL 16 DAYS AFTER INSERT;`,see:[7,3,'Immutable and blockchain tables']},
{t:'Schema-level privileges',s:'Grant on a schema, not on ANY.',
 a:'A **schema privilege** (26ai) grants an action on all current and future objects of one schema, such as `SELECT ANY TABLE ON SCHEMA hr`. It replaces broad ANY privileges with a narrower scope.',
 w:'It is the practical way to remove ANY privileges without a long list of object grants.',
 c:`GRANT SELECT ANY TABLE ON SCHEMA hr TO report_user;`,see:[7,4,'Schema-level privileges in practice']},
{t:'Secure configuration',s:'Defaults are not secure.',
 a:'Remove or lock sample and default accounts, change default passwords, restrict `UTL_*` and other powerful packages, set secure parameters and review them against a benchmark. A new database needs a hardening pass.',
 w:'Most findings in a security review are configuration, not exotic attacks.',
 c:`SELECT username, account_status FROM dba_users WHERE username IN ('SCOTT','HR','OE','SH') OR oracle_maintained = 'N' AND last_login IS NULL;`,see:[8,0,'Secure configuration checklist: defaults, parameters and accounts']},
{t:'Security patching',s:'Known vulnerabilities are the easy way in.',
 a:'Release Updates carry security fixes, and the **Critical Patch Update** programme publishes the security content on a fixed cycle. Unpatched databases are the most exploited weakness. Track your patch level against the latest.',
 w:'Patching is a security control. Put it in the same plan as the other controls.',
 c:`SELECT patch_id, action, status, description FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 5 ROWS ONLY;`,see:[8,2,'Patching for security: CPU, CSPU and release updates']},
{t:'Secrets handling',s:'No passwords in scripts.',
 a:'Store credentials in a **secure external password store** (a wallet) or a secrets manager, so scripts connect with `/@alias` instead of a password. Rotate secrets and give each application its own account.',
 w:'A password in a script or a repository is a password everyone with that file has.',
 c:`$ mkstore -wrl /u01/wallet -create
$ mkstore -wrl /u01/wallet -createCredential orcl_app app_user`,see:[8,3,'Secrets handling: wallets and secure external passwords']},
{t:'Incident response',s:'Decide before it happens.',
 a:'A database compromise needs a plan: contain (isolate, lock accounts, rotate credentials), preserve evidence (audit trail, logs, redo), assess scope (what was read or changed), recover, and learn. The audit trail is only useful if you have kept it safely.',
 w:'During an incident, the order of actions matters. Writing it down beforehand is the only reliable way.',
 c:`SELECT event_timestamp, dbusername, action_name, object_name, return_code FROM unified_audit_trail WHERE event_timestamp > SYSDATE - 1 ORDER BY event_timestamp DESC FETCH FIRST 20 ROWS ONLY;`,see:[8,4,'Incident response for database compromise']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Five small maps of how the parts fit together: defence in depth, authentication and authorization, the TDE key hierarchy, encrypted connections and the unified audit pipeline.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why a DBA cares, one query or command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. Layers of database security'},
{map:{title:'Defence in depth map',h:328,trace:'Follow an attacker through the layers',
 hint:'Tap any box, or press Follow an attacker through the layers to see which control stops what.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L340 219 L340 246'],
 nodes:[
 {id:'net',x:21,y:24,w:194,h:56,c:'net',t:'Network',s:'firewall, TLS, listener',d:'Who can reach the database at all, and whether the traffic is encrypted.',why:'The first filter. Removes most opportunistic attacks.',chk:`SELECT network_service_banner FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV','SID');`,see:[3,0,'Native network encryption and integrity']},
 {id:'host',x:243,y:24,w:194,h:56,c:'disk',t:'Host',s:'OS and file permissions',d:'Operating system hardening, file permissions and who has shell access to the server.',why:'Anyone with the oracle OS account has the database.',chk:`$ ls -l $ORACLE_HOME/network/admin/*.ora`,see:[8,1,'Operating system and container hardening']},
 {id:'authn',x:465,y:24,w:194,h:56,c:'proc',t:'Authentication',s:'who are you',d:'Strong, centrally managed identities, with password rules and lockouts.',why:'It decides who gets a session.',chk:`SELECT username, authentication_type, profile FROM dba_users WHERE oracle_maintained = 'N';`,see:[1,0,'Database authentication and password verifiers']},
 {id:'authz',x:21,y:136,w:194,h:56,c:'proc',t:'Authorization',s:'what can you do',d:'Privileges and roles limited to need, with no ANY privileges where avoidable.',why:'It limits what an authenticated session can do.',chk:`SELECT grantee, COUNT(*) FROM dba_sys_privs GROUP BY grantee ORDER BY 2 DESC FETCH FIRST 10 ROWS ONLY;`,see:[2,0,'Privilege model review']},
 {id:'data',x:243,y:136,w:194,h:56,c:'mem',t:'Data controls',s:'TDE, redaction, VPD',d:'Encryption at rest, redaction and row-level policies that protect the data itself.',why:'It protects data even when the layers above are bypassed.',chk:`SELECT tablespace_name, encrypted FROM dba_tablespaces;`,see:[4,0,'TDE concepts: master key, table keys and keystores']},
 {id:'audit',x:465,y:136,w:194,h:56,c:'mem',t:'Audit',s:'what happened',d:'Unified audit policies, kept safely and reviewed.',why:'It does not stop an attack, but it detects one and proves what occurred.',chk:`SELECT policy_name FROM audit_unified_enabled_policies;`,see:[5,0,'Unified auditing architecture']},
 {id:'ops',x:240,y:248,w:200,h:56,c:'ext',t:'Operations',s:'patch, configure, respond',d:'Patching, secure configuration, secrets handling and incident response.',why:'Without it, every other layer decays.',chk:`SELECT patch_id, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 3 ROWS ONLY;`,see:[8,2,'Patching for security: CPU, CSPU and release updates']}],
 steps:[
 {ids:['net'],t:'1. An attacker has to reach the listener first. Network controls decide which hosts and which networks can even try.',w:'It removes the unauthorised from the picture.',s:'Firewall rules, `VALID_NODE_CHECKING`, TLS.',x:'A database reachable from the whole network is exposed to the whole network.',c:`$ lsnrctl status`},
 {ids:['host'],t:'2. A host-level compromise bypasses the database, so the OS account, file permissions and the wallet files are protected.',w:'The oracle OS user can read datafiles directly.',s:'OS hardening, `umask`, file permissions.',x:'World-readable wallet or network configuration files.',c:`$ ls -l /u01/app/oracle/admin/orcl/wallet`},
 {ids:['authn'],t:'3. To get a session, the attacker needs a valid identity. Strong authentication, lockout and central management make that harder.',w:'Stolen or guessed passwords are the usual way in.',s:'Profiles, `FAILED_LOGIN_ATTEMPTS`, Kerberos, central users.',x:'Shared or default accounts defeat this layer.',c:`SELECT username, account_status FROM dba_users WHERE account_status <> 'OPEN';`},
 {ids:['authz'],t:'4. A session can only do what its privileges allow. Least privilege limits the damage of a stolen account.',w:'The blast radius is the privileges of the account.',s:'Roles, schema privileges, privilege analysis.',x:'One application account with DBA role is a full compromise.',c:`SELECT granted_role FROM dba_role_privs WHERE grantee = 'APP';`},
 {ids:['data'],t:'5. If everything above fails, encryption, redaction and row policies still protect what the data reveals on disk, in backups and in query results.',w:'It is the last line for the data itself.',s:'TDE, `DBMS_REDACT`, VPD.',x:'Encryption does not help against a legitimate but over-privileged session.',c:`SELECT * FROM v$encryption_wallet;`},
 {ids:['audit','ops'],t:'6. Auditing records what happened, and operations keep every layer current. Together they detect and close gaps.',w:'You cannot respond to what you cannot see.',s:'Audit policies, patch cadence, DBSAT runs.',x:'An audit trail nobody reads is only storage.',c:`SELECT COUNT(*) FROM unified_audit_trail WHERE event_timestamp > SYSDATE - 1;`}]}},

{h:'2. From login to a row of data'},
{map:{title:'Access path map',h:328,trace:'Follow a login and a query',
 hint:'Tap any box, or press Follow a login and a query to see every control a request passes.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'client',x:21,y:24,w:194,h:56,c:'ext',t:'Client',s:'user or application',d:'Sends a connection request with an identity and then SQL.',why:'It might be a person, an application server or an attacker.',chk:`SELECT username, osuser, machine, program FROM v$session WHERE type = 'USER';`,see:[0,1,'Threat model for an Oracle database']},
 {id:'lsn',x:243,y:24,w:194,h:56,c:'net',t:'Listener',s:'TLS and registration',d:'Accepts the connection, possibly over TLS, and hands it to the database.',why:'Listener rules can reject the connection before authentication.',chk:`$ lsnrctl services`,see:[3,2,'Listener hardening']},
 {id:'auth',x:465,y:24,w:194,h:56,c:'proc',t:'Authentication',s:'verifier or external',d:'Checks the credentials against the stored verifier, a directory or a certificate.',why:'Failures are audited and counted for lockout.',chk:`SELECT username, account_status, lock_date FROM dba_users WHERE username = '&user';`,see:[1,0,'Database authentication and password verifiers']},
 {id:'prof',x:21,y:136,w:194,h:56,c:'mem',t:'Profile',s:'account rules',d:'The profile enforces password lifetime, failed attempt limits and session limits.',why:'It can lock or expire the account at login.',chk:`SELECT limit FROM dba_profiles WHERE profile = '&profile' AND resource_name = 'FAILED_LOGIN_ATTEMPTS';`,see:[1,1,'Password profiles and account policies']},
 {id:'priv',x:243,y:136,w:194,h:56,c:'proc',t:'Privileges',s:'system, object, role',d:'Each statement is checked against the session privileges and enabled roles.',why:'ORA-01031 or ORA-00942 means the check failed.',chk:`SELECT privilege FROM session_privs ORDER BY 1;`,see:[2,0,'Privilege model review']},
 {id:'rows',x:465,y:136,w:194,h:56,c:'mem',t:'Row and column controls',s:'VPD, redaction',d:'Row policies add predicates, and redaction changes returned values.',why:'Applied inside the database, whatever the client.',chk:`SELECT policy_name, object_name FROM dba_policies WHERE object_owner = 'APP';`,see:[6,2,'Virtual Private Database and fine-grained access']},
 {id:'vault',x:126,y:248,w:200,h:56,c:'mem',t:'Database Vault',s:'realms and rules',d:'Realms and command rules can deny access even to privileged accounts.',why:'It enforces separation of duties at runtime.',chk:`SELECT name, enabled FROM dba_dv_realm;`,see:[6,4,'Database Vault: realms and command rules']},
 {id:'aud',x:354,y:248,w:200,h:56,c:'disk',t:'Audit',s:'records the event',d:'Audit policies write the action, the user and the result to the unified audit trail.',why:'It is written whether the request was allowed or denied.',chk:`SELECT event_timestamp, dbusername, action_name, return_code FROM unified_audit_trail ORDER BY event_timestamp DESC FETCH FIRST 5 ROWS ONLY;`,see:[5,2,'Reading and reporting from the unified audit trail']}],
 steps:[
 {ids:['client','lsn'],t:'1. The client connects through the listener, over TLS if configured, and sends its credentials.',w:'It is the first point at which a request can be refused.',s:'TLS settings, listener ACLs.',x:'Clear text connections expose credentials on the network.',c:`SELECT network_service_banner FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV','SID');`},
 {ids:['auth','prof'],t:'2. The database authenticates the identity and applies the profile: lockout, expiry and limits.',w:'Only valid, current accounts proceed.',s:'`FAILED_LOGIN_ATTEMPTS`, `PASSWORD_LIFE_TIME`.',x:'Service accounts exempt from every rule are a weak point.',c:`SELECT username, expiry_date, account_status FROM dba_users WHERE username = '&user';`},
 {ids:['priv'],t:'3. For each statement the privileges and roles are checked. Without the privilege the statement fails.',w:'It is the core of the access model.',s:'Roles, secure application roles.',x:'ANY privileges let one account reach all schemas.',c:`SELECT * FROM session_roles;`},
 {ids:['rows','vault'],t:'4. Row policies and redaction shape what the statement returns, and Database Vault may refuse it outright.',w:'The same SQL can return different rows to different users.',s:'VPD policy functions, redaction policies, realms.',x:'A policy function with a bug returns all rows or none.',c:`SELECT policy_name, enable FROM dba_policies WHERE object_name = 'ORDERS';`},
 {ids:['aud'],t:'5. The event is written to the audit trail, including denied attempts, which are often the best signal of an attack.',w:'It creates the evidence.',s:'Audit policies, `AUDIT_ADMIN`.',x:'Auditing nothing, or auditing everything and reviewing nothing.',c:`SELECT action_name, return_code, COUNT(*) FROM unified_audit_trail GROUP BY action_name, return_code ORDER BY 3 DESC FETCH FIRST 10 ROWS ONLY;`}]}},

{h:'3. The TDE key hierarchy'},
{map:{title:'TDE key map',h:328,trace:'Read encrypted data',
 hint:'Tap any box, or press Read encrypted data to see how a block on disk becomes readable in memory.',
 lines:[[215,52,241,52],[437,52,463,52],'M340 80 L340 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M340 192 L340 219 L226 219 L226 246','M340 80 L340 163 L454 163 L454 246'],
 nodes:[
 {id:'kms',x:21,y:24,w:194,h:56,c:'ext',t:'HSM or Key Vault',s:'optional external',d:'An external key manager that can hold the master key instead of a file.',why:'Keys stay off the database host, and access can be revoked centrally.',chk:`SELECT wallet_type, wrl_type FROM v$encryption_wallet;`,see:[4,1,'Keystore types: password, auto-login and local auto-login']},
 {id:'mk',x:243,y:24,w:194,h:56,c:'warn',t:'Master key',s:'TDE master encryption key',d:'The key that protects the data keys. It never encrypts data directly.',why:'Losing it makes the encrypted data unreadable. Back it up.',chk:`SELECT key_id, creation_time, activation_time FROM v$encryption_keys ORDER BY creation_time DESC;`,see:[4,0,'TDE concepts: master key, table keys and keystores']},
 {id:'ks',x:465,y:24,w:194,h:56,c:'disk',t:'Keystore',s:'wallet file',d:'A file (ewallet.p12 or cwallet.sso) that holds the master key, protected by a password or local auto-login.',why:'It is stored outside the datafiles, in WALLET_ROOT.',chk:`SELECT wrl_parameter, status FROM v$encryption_wallet;`,see:[4,1,'Keystore types: password, auto-login and local auto-login']},
 {id:'tek',x:21,y:136,w:194,h:56,c:'mem',t:'Tablespace key',s:'encrypted with master',d:'Each encrypted tablespace has its own key, stored in the file header, encrypted under the master key.',why:'Key rotation only re-wraps these small keys.',chk:`SELECT ts#, masterkeyid FROM v$encrypted_tablespaces;`,see:[4,2,'Encrypting tablespaces and columns']},
 {id:'df',x:243,y:136,w:194,h:56,c:'disk',t:'Encrypted datafile',s:'blocks on disk',d:'The blocks of the tablespace are stored encrypted. They are also encrypted in backups and on standbys.',why:'A stolen datafile or backup is unreadable.',chk:`SELECT tablespace_name, encrypted FROM dba_tablespaces;`,see:[4,2,'Encrypting tablespaces and columns']},
 {id:'buf',x:465,y:136,w:194,h:56,c:'mem',t:'Buffer cache',s:'decrypted blocks',d:'Blocks are decrypted as they are read into the cache, and encrypted when written.',why:'Memory holds plaintext. Protect the host and swap.',chk:`SELECT COUNT(*) FROM v$bh WHERE status <> 'free';`,see:[4,0,'TDE concepts: master key, table keys and keystores']},
 {id:'bkp',x:126,y:248,w:200,h:56,c:'disk',t:'Backups and standby',s:'need the key',d:'Backups, standbys and exports carry encrypted data and need the keystore to be read or restored.',why:'Keystore backup is part of every recovery plan.',chk:`SELECT * FROM v$encryption_keys;`,see:[4,6,'Backups, Data Pump and standby with TDE']},
 {id:'rot',x:354,y:248,w:200,h:56,c:'proc',t:'Rotation',s:'new master key',d:'A new master key is created and the data keys are re-wrapped under it.',why:'It limits exposure from an old key without rewriting data.',chk:`ADMINISTER KEY MANAGEMENT SET KEY FORCE KEYSTORE IDENTIFIED BY "********" WITH BACKUP;`,see:[4,4,'Key rotation and rekeying']}],
 steps:[
 {ids:['ks','mk'],t:'1. The keystore is opened with its password, or automatically in auto-login mode. The master key becomes available in memory.',w:'Nothing encrypted can be read until this happens.',s:'`ADMINISTER KEY MANAGEMENT SET KEYSTORE OPEN`, auto-login.',x:'After a restart a password keystore is closed, and encrypted data raises ORA-28365.',c:`ADMINISTER KEY MANAGEMENT SET KEYSTORE OPEN IDENTIFIED BY "********";`},
 {ids:['mk','tek'],t:'2. The master key unwraps the key of the tablespace that holds the data.',w:'Each tablespace has its own key.',s:'Encrypted tablespace headers.',x:'A missing master key blocks the tablespace but not others.',c:`SELECT ts#, encryptedts, masterkeyid FROM v$encrypted_tablespaces;`},
 {ids:['df','buf'],t:'3. Blocks are read from the datafile, decrypted with the tablespace key into the buffer cache and used like any other block.',w:'It is transparent to applications.',s:'Algorithm (AES128, AES256).',x:'CPU cost is low with hardware AES support.',c:`SELECT ts#, encryptionalg, encryptedts FROM v$encrypted_tablespaces;`},
 {ids:['bkp'],t:'4. Backups and standbys contain encrypted blocks. To use them elsewhere you need the keystore and the master key.',w:'This is where outages happen.',s:'Keystore backups, `WITH BACKUP`.',x:'Restoring to a host without the keystore fails with ORA-28365 or ORA-19914.',c:`SELECT status FROM v$encryption_wallet;`},
 {ids:['rot','mk'],t:'5. When you rotate, a new master key is generated, and the tablespace keys are re-wrapped. Old keys are retained to read old backups.',w:'You change the root of trust without rewriting data.',s:'`SET KEY`, `WITH BACKUP`.',x:'Not backing up the keystore before rotation is a common mistake.',c:`SELECT key_id, creation_time FROM v$encryption_keys ORDER BY creation_time DESC;`}]}},

{h:'4. An encrypted connection'},
{map:{title:'TLS connection map',h:216,trace:'Establish a TLS connection',
 hint:'Tap any box, or press Establish a TLS connection to follow the handshake and the checks that go with it.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'cl',x:21,y:24,w:194,h:56,c:'ext',t:'Client',s:'sqlnet.ora and tnsnames',d:'The client configured with a TCPS address and a wallet that holds the CA certificate.',why:'It decides which protocol is used for the connection.',chk:`$ cat $TNS_ADMIN/sqlnet.ora | grep -i wallet`,see:[3,1,'TLS and wallets for Oracle Net']},
 {id:'cw',x:243,y:24,w:194,h:56,c:'disk',t:'Client wallet',s:'trusted CA',d:'A wallet holding the certificate authority certificate, so the client can verify the server.',why:'Without it the client cannot trust the server.',chk:`$ orapki wallet display -wallet /u01/wallet_client`,see:[3,1,'TLS and wallets for Oracle Net']},
 {id:'hs',x:465,y:24,w:194,h:56,c:'net',t:'TLS handshake',s:'keys agreed',d:'Client and server negotiate a protocol version and cipher, the server proves its identity and session keys are derived.',why:'Everything after this is encrypted.',chk:`SELECT network_service_banner FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV','SID');`,see:[3,1,'TLS and wallets for Oracle Net']},
 {id:'sw',x:21,y:136,w:194,h:56,c:'disk',t:'Server wallet',s:'server certificate',d:'A wallet on the server with its certificate and private key.',why:'It is the identity of the database to clients.',chk:`$ orapki wallet display -wallet /u01/wallet_server`,see:[3,1,'TLS and wallets for Oracle Net']},
 {id:'lsn',x:243,y:136,w:194,h:56,c:'proc',t:'TCPS listener',s:'port 2484 or custom',d:'A listener endpoint for TCPS using the server wallet.',why:'It can serve TCP and TCPS at the same time while you migrate.',chk:`$ lsnrctl status`,see:[3,2,'Listener hardening']},
 {id:'db',x:465,y:136,w:194,h:56,c:'mem',t:'Session',s:'authenticated',d:'The database authenticates the user, optionally by the client certificate, and the session starts.',why:'The user can be identified by the certificate (SSL_CLIENT_AUTHENTICATION).',chk:`SELECT authentication_type, network_service_banner FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV','SID');`,see:[1,3,'External authentication: Kerberos and certificates']}],
 steps:[
 {ids:['cl','cw'],t:'1. The client connects to a TCPS address. It uses the wallet to hold the trusted CA certificate.',w:'The client must know whom to trust.',s:'`WALLET_LOCATION`, TCPS in the connect string.',x:'A wallet without the right CA gives ORA-29024 certificate validation failure.',c:`$ tnsping orcl_tls`},
 {ids:['hs'],t:'2. The TLS handshake runs: version and cipher, server certificate check, key agreement.',w:'It sets up the encrypted channel.',s:'`SSL_VERSION`, `SSL_CIPHER_SUITES`.',x:'Version or cipher mismatch ends the handshake with ORA-12560 or ORA-28860.',c:`SELECT network_service_banner FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV','SID');`},
 {ids:['sw','lsn'],t:'3. The listener presents the server certificate from its wallet. The client verifies the name and the chain.',w:'It prevents a man-in-the-middle from impersonating the database.',s:'`SSL_SERVER_DN_MATCH`, certificate CN or SAN.',x:'A certificate name that does not match the host fails the check.',c:`$ orapki wallet display -wallet /u01/wallet_server -complete`},
 {ids:['db'],t:'4. The database authenticates the user (password, or certificate if configured) and the session runs over the encrypted channel.',w:'Both confidentiality and identity are covered.',s:'`SQLNET.AUTHENTICATION_SERVICES`.',x:'TLS with password authentication still depends on password strength.',c:`SELECT username, authentication_type FROM v$session WHERE sid = SYS_CONTEXT('USERENV','SID');`},
 {ids:['hs'],t:'5. Enforce it: disable the clear-text endpoint when all clients have migrated, and monitor certificate expiry.',w:'An optional TLS is not a control.',s:'Listener endpoints, `SQLNET.ENCRYPTION_SERVER=REQUIRED`.',x:'Expired certificates stop all connections at once.',c:`$ orapki wallet display -wallet /u01/wallet_server | grep -i valid`}]}},

{h:'5. The unified audit pipeline'},
{map:{title:'Audit pipeline map',h:328,trace:'Audit one privileged action',
 hint:'Tap any box, or press Audit one privileged action to follow an event from the statement to a retained record.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L118 219 L118 246',[215,276,241,276],[437,276,463,276]],
 nodes:[
 {id:'act',x:21,y:24,w:194,h:56,c:'ext',t:'Action',s:'what a user did',d:'A statement, privilege use or object access by a session.',why:'It is audited only if a policy matches it, or it is a mandatory action.',chk:`SELECT username, action FROM v$session WHERE type = 'USER';`,see:[5,1,'Audit policies: predefined and custom']},
 {id:'pol',x:243,y:24,w:194,h:56,c:'proc',t:'Audit policy',s:'enabled for whom',d:'A policy lists the actions, privileges or objects to audit, for whom, and on success or failure.',why:'It is the only thing that decides what is recorded.',chk:`SELECT policy_name, enabled_option, entity_name FROM audit_unified_enabled_policies;`,see:[5,1,'Audit policies: predefined and custom']},
 {id:'rec',x:465,y:24,w:194,h:56,c:'mem',t:'Audit record',s:'built in the session',d:'The database builds a record: time, user, action, object, SQL text and result.',why:'It includes failed attempts.',chk:`SELECT event_timestamp, dbusername, action_name, sql_text FROM unified_audit_trail ORDER BY event_timestamp DESC FETCH FIRST 3 ROWS ONLY;`,see:[5,0,'Unified auditing architecture']},
 {id:'que',x:21,y:136,w:194,h:56,c:'mem',t:'SGA queue',s:'immediate or queued',d:'Records go to a memory queue, written to disk shortly after (or immediately in immediate-write mode).',why:'A crash can lose records in queued mode.',chk:`SELECT parameter_name, parameter_value FROM dba_audit_mgmt_config_params WHERE parameter_name LIKE '%WRITE%';`,see:[5,0,'Unified auditing architecture']},
 {id:'trail',x:243,y:136,w:194,h:56,c:'disk',t:'AUDSYS trail',s:'unified_audit_trail',d:'Records are stored in partitioned tables in the AUDSYS schema, and viewed through UNIFIED_AUDIT_TRAIL.',why:'Nobody, including SYS, can alter them with SQL.',chk:`SELECT COUNT(*) FROM unified_audit_trail;`,see:[5,2,'Reading and reporting from the unified audit trail']},
 {id:'sec',x:465,y:136,w:194,h:56,c:'warn',t:'Roles',s:'AUDIT_ADMIN, AUDIT_VIEWER',d:'Separate roles for who manages policies and who may read the trail.',why:'It enforces separation of duties.',chk:`SELECT grantee, granted_role FROM dba_role_privs WHERE granted_role LIKE 'AUDIT_%';`,see:[5,0,'Unified auditing architecture']},
 {id:'rep',x:21,y:248,w:194,h:56,c:'mem',t:'Reports',s:'review',d:'Queries and reports on privileged use, failures and changes, run on a schedule.',why:'An unread trail provides no protection.',chk:`SELECT dbusername, action_name, COUNT(*) FROM unified_audit_trail WHERE return_code <> 0 GROUP BY dbusername, action_name ORDER BY 3 DESC FETCH FIRST 10 ROWS ONLY;`,see:[5,2,'Reading and reporting from the unified audit trail']},
 {id:'arc',x:243,y:248,w:194,h:56,c:'ext',t:'Archive',s:'SIEM or safe store',d:'Records are exported to a system outside the database that the DBA cannot change.',why:'It keeps the evidence even if the database is compromised.',chk:`SELECT MIN(event_timestamp), MAX(event_timestamp) FROM unified_audit_trail;`,see:[5,3,'Audit trail management and purge']},
 {id:'pur',x:465,y:248,w:194,h:56,c:'proc',t:'Purge',s:'DBMS_AUDIT_MGMT',d:'Old records are purged after they are archived, on a schedule.',why:'It keeps the trail from filling the tablespace.',chk:`EXEC DBMS_AUDIT_MGMT.CREATE_PURGE_JOB(audit_trail_type => DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED, audit_trail_purge_interval => 24, audit_trail_purge_name => 'purge_job', use_last_arch_timestamp => TRUE);`,see:[5,3,'Audit trail management and purge']}],
 steps:[
 {ids:['act','pol'],t:'1. A user runs a privileged statement. The audit policy is checked: does a policy match this user and action?',w:'If no policy matches nothing is recorded.',s:'`AUDIT POLICY`, `AUDIT ... BY user`.',x:'A policy that is created but not enabled records nothing.',c:`SELECT policy_name, enabled_option FROM audit_unified_enabled_policies;`},
 {ids:['rec','que'],t:'2. A record is built and queued in memory, to be written in a batch.',w:'Performance impact stays low.',s:'`DBMS_AUDIT_MGMT.SET_AUDIT_TRAIL_PROPERTY`, write mode.',x:'Immediate write mode is slower but loses nothing.',c:`SELECT parameter_value FROM dba_audit_mgmt_config_params WHERE parameter_name = 'AUDIT WRITE MODE';`},
 {ids:['trail','sec'],t:'3. The record lands in the AUDSYS trail. Only users with the right roles can read it, and nobody can edit it.',w:'It is tamper-resistant from inside SQL.',s:'`AUDIT_VIEWER`, `AUDIT_ADMIN`.',x:'Granting AUDIT_ADMIN to the DBA removes the separation.',c:`SELECT COUNT(*) FROM unified_audit_trail WHERE dbusername = '&user';`},
 {ids:['rep'],t:'4. Reports and alerts run on the trail: failed logins, privilege grants, changes to policies.',w:'Detection needs a person or a rule.',s:'Scheduled queries, SIEM rules.',x:'Retention long enough to cover your detection time.',c:`SELECT event_timestamp, dbusername, action_name FROM unified_audit_trail WHERE action_name IN ('GRANT','CREATE USER') ORDER BY 1 DESC FETCH FIRST 10 ROWS ONLY;`},
 {ids:['arc','pur'],t:'5. Records are archived outside the database, then purged from it. The purge keeps the trail inside its space budget.',w:'Retention is met without growth.',s:'`DBMS_AUDIT_MGMT.SET_LAST_ARCHIVE_TIMESTAMP`, purge job.',x:'Purge before archive destroys evidence.',c:`SELECT job_name, enabled FROM dba_scheduler_jobs WHERE job_name LIKE '%PURGE%';`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Seven small maps of how something happens, step by step: hardening a database, enabling TLS, encrypting and rotating keys, reducing privileges, an audit policy, SQL Firewall and responding to a compromise.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Hardening a new database'},
{map:{title:'Hardening map',h:216,trace:'Harden a database',
 hint:'Tap any box, or press Harden a database to follow a hardening pass from assessment to evidence.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'asm',x:20,y:24,w:139,h:56,c:'mem',t:'Assess',s:'DBSAT or benchmark',d:'Run DBSAT or a CIS check to find the starting position.',why:'It gives a prioritised list.',chk:`$ dbsat collect -n system@orcl /tmp/orcl`,see:[0,6,'Practical: Assess a database with DBSAT']},
 {id:'acc',x:187,y:24,w:139,h:56,c:'proc',t:'Accounts',s:'default and unused',d:'Lock or remove sample and unused accounts, change default passwords, assign profiles.',why:'Default accounts are the first thing attackers try.',chk:`SELECT username, account_status FROM dba_users WHERE oracle_maintained = 'N';`,see:[8,0,'Secure configuration checklist: defaults, parameters and accounts']},
 {id:'pri',x:354,y:24,w:139,h:56,c:'proc',t:'Privileges',s:'PUBLIC and ANY',d:'Revoke unnecessary PUBLIC grants and review ANY privileges.',why:'It reduces the blast radius.',chk:`SELECT grantee, privilege FROM dba_sys_privs WHERE privilege LIKE '% ANY %' AND grantee NOT IN (SELECT username FROM dba_users WHERE oracle_maintained = 'Y');`,see:[2,1,'The ANY privilege risk and PUBLIC grants']},
 {id:'par',x:521,y:24,w:139,h:56,c:'mem',t:'Parameters',s:'secure values',d:'Set parameters such as `O7_DICTIONARY_ACCESSIBILITY`, `REMOTE_LOGIN_PASSWORDFILE` and audit settings.',why:'Defaults are chosen for compatibility, not security.',chk:`SELECT name, value FROM v$parameter WHERE name IN ('remote_login_passwordfile','sec_case_sensitive_logon','os_roles');`,see:[8,0,'Secure configuration checklist: defaults, parameters and accounts']},
 {id:'net',x:20,y:136,w:139,h:56,c:'net',t:'Network',s:'listener and TLS',d:'Restrict the listener, enable encryption, and limit database links.',why:'It closes remote exposure.',chk:`$ lsnrctl show admin_restrictions_listener`,see:[3,2,'Listener hardening']},
 {id:'aud',x:187,y:136,w:139,h:56,c:'mem',t:'Audit',s:'baseline policies',d:'Enable a baseline set of audit policies and a purge job.',why:'It gives visibility from day one.',chk:`AUDIT POLICY ORA_SECURECONFIG;`,see:[5,1,'Audit policies: predefined and custom']},
 {id:'pat',x:354,y:136,w:139,h:56,c:'proc',t:'Patch',s:'current RU',d:'Apply the latest Release Update with security fixes.',why:'Known vulnerabilities are the easiest way in.',chk:`SELECT patch_id, status FROM dba_registry_sqlpatch ORDER BY action_time DESC FETCH FIRST 3 ROWS ONLY;`,see:[8,2,'Patching for security: CPU, CSPU and release updates']},
 {id:'chk',x:521,y:136,w:139,h:56,c:'mem',t:'Re-assess',s:'evidence',d:'Run the assessment again and keep the before and after reports.',why:'It proves that the pass worked.',chk:`$ dbsat report /tmp/orcl`,see:[8,6,'Capstone: Harden and audit a production database']}],
 steps:[
 {ids:['asm'],t:'1. Run an assessment first, so you have a baseline and a priority list.',w:'It stops you hardening by guesswork.',s:'DBSAT, CIS benchmark.',x:'Hardening without a baseline cannot be shown to have worked.',c:`$ dbsat report /tmp/orcl`},
 {ids:['acc','pri'],t:'2. Fix accounts and privileges: lock defaults, remove unused accounts, and reduce PUBLIC and ANY privileges.',w:'These give the largest reduction in risk.',s:'Profiles, `REVOKE`, privilege analysis.',x:'Revoking from PUBLIC can break an application that relied on it. Test.',c:`SELECT table_name FROM dba_tab_privs WHERE grantee = 'PUBLIC' AND privilege = 'EXECUTE' AND table_name LIKE 'UTL_%';`},
 {ids:['par','net'],t:'3. Set secure parameters and harden the listener and network configuration.',w:'It closes remote and configuration-based exposure.',s:'`sqlnet.ora`, `listener.ora`, parameters.',x:'Changing a parameter that needs a restart without a window.',c:`SHOW PARAMETER remote_login_passwordfile`},
 {ids:['aud'],t:'4. Enable audit baseline policies and a purge job, so changes and failures are visible.',w:'Visibility must be there before an incident.',s:'`ORA_SECURECONFIG`, `ORA_LOGON_FAILURES`.',x:'Auditing without capacity planning fills the tablespace.',c:`SELECT policy_name FROM audit_unified_enabled_policies;`},
 {ids:['pat','chk'],t:'5. Patch to the current RU, run the assessment again, and file the evidence.',w:'It closes the loop.',s:'RU, `datapatch`, DBSAT.',x:'Findings that remain need a documented decision.',c:`$ dbsat report /tmp/orcl_after`}]}},

{h:'2. Enforcing TLS between client and database'},
{map:{title:'Enable TLS map',h:216,trace:'Enable TLS',
 hint:'Tap any box, or press Enable TLS to follow the steps from certificates to a TLS-only listener.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'ca',x:21,y:24,w:194,h:56,c:'ext',t:'Certificate',s:'from your CA',d:'Obtain a server certificate with the right host name from your certificate authority.',why:'Self-signed certificates work, and are not trusted automatically.',chk:`$ orapki wallet create -wallet /u01/wallet_server -auto_login`,see:[3,1,'TLS and wallets for Oracle Net']},
 {id:'sw',x:243,y:24,w:194,h:56,c:'disk',t:'Server wallet',s:'import and store',d:'Create the server wallet, add the CA chain and the server certificate.',why:'The wallet holds the private key. Protect it.',chk:`$ orapki wallet add -wallet /u01/wallet_server -user_cert -cert server.crt`,see:[3,1,'TLS and wallets for Oracle Net']},
 {id:'lsn',x:465,y:24,w:194,h:56,c:'proc',t:'Listener TCPS',s:'add endpoint',d:'Add a TCPS endpoint to the listener and point it at the wallet.',why:'Run TCP and TCPS together during migration.',chk:`$ lsnrctl reload
$ lsnrctl status`,see:[3,2,'Listener hardening']},
 {id:'cw',x:20,y:136,w:139,h:56,c:'disk',t:'Client wallet',s:'trust the CA',d:'Give the clients a wallet with the CA certificate.',why:'Without it the server is not trusted.',chk:`$ orapki wallet add -wallet /u01/wallet_client -trusted_cert -cert ca.crt`,see:[3,1,'TLS and wallets for Oracle Net']},
 {id:'cfg',x:187,y:136,w:139,h:56,c:'mem',t:'Client config',s:'TCPS address',d:'Change the connect descriptors to use TCPS and the new port.',why:'The application change is the connect string only.',chk:`orcl_tls = (DESCRIPTION=(ADDRESS=(PROTOCOL=TCPS)(HOST=db1)(PORT=2484))(CONNECT_DATA=(SERVICE_NAME=orcl)))`,see:[3,5,'Practical: Enforce TLS between client and database']},
 {id:'tst',x:354,y:136,w:139,h:56,c:'mem',t:'Test',s:'confirm encryption',d:'Connect and confirm that the session shows the TLS banner.',why:'Never assume. Check.',chk:`SELECT network_service_banner FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV','SID');`,see:[3,5,'Practical: Enforce TLS between client and database']},
 {id:'enf',x:521,y:136,w:139,h:56,c:'warn',t:'Enforce',s:'remove TCP',d:'When all clients use TCPS, remove the clear-text endpoint.',why:'It makes encryption mandatory.',chk:`$ lsnrctl status`,see:[3,5,'Practical: Enforce TLS between client and database']}],
 steps:[
 {ids:['ca','sw'],t:'1. Get a certificate for the database host name and place it, with its CA chain, in the server wallet.',w:'The name in the certificate must match the one clients use.',s:'`orapki`, certificate CN/SAN.',x:'A wallet without the full chain fails client validation.',c:`$ orapki wallet display -wallet /u01/wallet_server`},
 {ids:['lsn'],t:'2. Add a TCPS endpoint to the listener with the wallet location and reload it. Keep the TCP endpoint for now.',w:'It allows a staged migration.',s:'`listener.ora`, `WALLET_LOCATION`.',x:'A syntax error in listener.ora takes down all endpoints, so back it up.',c:`$ lsnrctl reload`},
 {ids:['cw','cfg'],t:'3. Give the client a wallet that trusts the CA and a connect descriptor that uses TCPS.',w:'The client can now verify the server.',s:'`sqlnet.ora`, `tnsnames.ora`.',x:'ORA-28860 appears on protocol mismatches.',c:`$ tnsping orcl_tls`},
 {ids:['tst'],t:'4. Connect and check the network banner on the session. Test failure behaviour with a wrong CA.',w:'It proves the connection is encrypted.',s:'`V$SESSION_CONNECT_INFO`.',x:'A connection that falls back to clear text goes unnoticed.',c:`SELECT network_service_banner FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV','SID');`},
 {ids:['enf'],t:'5. After all clients have moved, remove the TCP endpoint, so TLS is the only way in. Monitor certificate expiry.',w:'An optional control is not a control.',s:'Listener configuration, certificate monitoring.',x:'Removing TCP while one batch job still uses it.',c:`SELECT DISTINCT network_service_banner FROM v$session_connect_info;`}]}},

{h:'3. Encrypting a tablespace and rotating the key'},
{map:{title:'TDE operations map',h:216,trace:'Encrypt and rotate',
 hint:'Tap any box, or press Encrypt and rotate to follow the steps from a keystore to an encrypted database with a rotation.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'cfg',x:21,y:24,w:194,h:56,c:'proc',t:'Configure',s:'WALLET_ROOT',d:'Set WALLET_ROOT and TDE_CONFIGURATION so the database knows where its keystore is.',why:'A restart is needed for WALLET_ROOT.',chk:`ALTER SYSTEM SET wallet_root = '/u01/app/oracle/wallet' SCOPE = SPFILE;
ALTER SYSTEM SET tde_configuration = 'KEYSTORE_CONFIGURATION=FILE' SCOPE = BOTH;`,see:[4,1,'Keystore types: password, auto-login and local auto-login']},
 {id:'mk',x:243,y:24,w:194,h:56,c:'proc',t:'Keystore and key',s:'create and set',d:'Create the keystore and set the first master key.',why:'This is the root of trust. Back it up at once.',chk:`ADMINISTER KEY MANAGEMENT CREATE KEYSTORE IDENTIFIED BY "********";
ADMINISTER KEY MANAGEMENT SET KEY IDENTIFIED BY "********" WITH BACKUP;`,see:[4,0,'TDE concepts: master key, table keys and keystores']},
 {id:'open',x:465,y:24,w:194,h:56,c:'mem',t:'Open',s:'or auto-login',d:'Open the keystore, or create an auto-login keystore so it opens at startup.',why:'A closed keystore blocks access to encrypted data.',chk:`ADMINISTER KEY MANAGEMENT CREATE LOCAL AUTO_LOGIN KEYSTORE FROM KEYSTORE IDENTIFIED BY "********";`,see:[4,1,'Keystore types: password, auto-login and local auto-login']},
 {id:'enc',x:20,y:136,w:139,h:56,c:'proc',t:'Encrypt',s:'ONLINE',d:'Encrypt tablespaces online. Oracle rewrites the files while the database stays open.',why:'It needs free space and I/O capacity.',chk:`ALTER TABLESPACE users ENCRYPT ONLINE USING 'AES256' ENCRYPT FILE_NAME_CONVERT = ('users01.dbf','users01_enc.dbf');`,see:[4,3,'Online conversion of existing data']},
 {id:'ver',x:187,y:136,w:139,h:56,c:'mem',t:'Verify',s:'status and data',d:'Check that the tablespace shows as encrypted and the application works.',why:'Do not rely on the command succeeding.',chk:`SELECT tablespace_name, encrypted FROM dba_tablespaces;`,see:[4,2,'Encrypting tablespaces and columns']},
 {id:'bkp',x:354,y:136,w:139,h:56,c:'disk',t:'Back up keystore',s:'separately',d:'Copy the keystore to a safe place, away from the database and the backups.',why:'Without it the encrypted data is gone.',chk:`$ cp -p /u01/app/oracle/wallet/tde/* /secure/backup/`,see:[4,6,'Backups, Data Pump and standby with TDE']},
 {id:'rot',x:521,y:136,w:139,h:56,c:'proc',t:'Rotate',s:'new master key',d:'Rotate the master key on a schedule and when needed, with a backup.',why:'Take a keystore backup before and after.',chk:`ADMINISTER KEY MANAGEMENT SET KEY FORCE KEYSTORE IDENTIFIED BY "********" WITH BACKUP;`,see:[4,4,'Key rotation and rekeying']}],
 steps:[
 {ids:['cfg'],t:'1. Set WALLET_ROOT and TDE_CONFIGURATION, then restart if required.',w:'The database must know where the keystore is.',s:'`WALLET_ROOT`, `TDE_CONFIGURATION`.',x:'Using the old sqlnet.ora wallet location in 19c mixes two methods.',c:`SHOW PARAMETER wallet_root`},
 {ids:['mk','open'],t:'2. Create the keystore, set the master key with a backup, and open it (or make it auto-login).',w:'The data keys will be protected by this key.',s:'`ADMINISTER KEY MANAGEMENT`.',x:'Setting the key without WITH BACKUP leaves no copy.',c:`SELECT status, wallet_type FROM v$encryption_wallet;`},
 {ids:['enc'],t:'3. Encrypt the tablespaces online, a few at a time, outside peak I/O.',w:'It converts existing data without downtime.',s:'`ALTER TABLESPACE ... ENCRYPT ONLINE`, parallelism.',x:'Needs temporary space equal to the file, and the operation can be long.',c:`SELECT file#, name, encrypted FROM v$datafile_header;`},
 {ids:['ver','bkp'],t:'4. Verify the encrypted state and the application, then back up the keystore to a separate location.',w:'Both data and key are now protected and recoverable.',s:'Backup schedule for keystores.',x:'Keeping the keystore backup with the database backup defeats it.',c:`SELECT tablespace_name, encrypted FROM dba_tablespaces;`},
 {ids:['rot'],t:'5. Rotate the master key on a schedule. Test a restore with the old and the new keystore.',w:'Rotation limits exposure and tests your process.',s:'`SET KEY`, change control.',x:'An untested restore is the usual surprise.',c:`SELECT key_id, creation_time FROM v$encryption_keys ORDER BY creation_time DESC;`}]}},

{h:'4. Reducing the privileges of an application schema'},
{map:{title:'Privilege reduction map',h:216,trace:'Reduce privileges safely',
 hint:'Tap any box, or press Reduce privileges safely to follow privilege analysis from capture to revoke.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'inv',x:20,y:24,w:139,h:56,c:'mem',t:'Inventory',s:'what it has now',d:'List the privileges and roles the application account holds.',why:'You need to see the start before you reduce it.',chk:`SELECT privilege FROM dba_sys_privs WHERE grantee = 'APP' UNION SELECT granted_role FROM dba_role_privs WHERE grantee = 'APP';`,see:[2,5,'Practical: Reduce an over-privileged application schema']},
 {id:'cap',x:187,y:24,w:139,h:56,c:'proc',t:'Create capture',s:'privilege analysis',d:'Define a capture for the user or role, and enable it.',why:'It records what is used from now.',chk:`EXEC DBMS_PRIVILEGE_CAPTURE.CREATE_CAPTURE(name => 'app_cap', type => DBMS_PRIVILEGE_CAPTURE.G_ROLE, roles => role_name_list('APP_ROLE'));
EXEC DBMS_PRIVILEGE_CAPTURE.ENABLE_CAPTURE('app_cap');`,see:[2,2,'Privilege analysis: capture and revoke']},
 {id:'run',x:354,y:24,w:139,h:56,c:'ext',t:'Run a full cycle',s:'month end too',d:'Run the application through a complete business cycle, including rare jobs.',why:'Privileges used rarely are the ones you will wrongly revoke.',chk:`SELECT COUNT(*) FROM dba_used_privs WHERE capture = 'APP_CAP';`,see:[2,2,'Privilege analysis: capture and revoke']},
 {id:'rep',x:521,y:24,w:139,h:56,c:'mem',t:'Report',s:'used and unused',d:'Generate the capture and read used and unused privileges.',why:'The unused list is the revoke candidate list.',chk:`EXEC DBMS_PRIVILEGE_CAPTURE.DISABLE_CAPTURE('app_cap');
EXEC DBMS_PRIVILEGE_CAPTURE.GENERATE_RESULT('app_cap');`,see:[2,2,'Privilege analysis: capture and revoke']},
 {id:'rev',x:21,y:136,w:194,h:56,c:'warn',t:'Revoke',s:'in test first',d:'Revoke the unused privileges in a test environment first, then in production with a rollback script.',why:'Keep the revoke script, and the grant script to undo it.',chk:`SELECT 'REVOKE ' || sys_priv || ' FROM APP;' FROM dba_unused_sysprivs WHERE capture = 'APP_CAP' AND username = 'APP';`,see:[2,5,'Practical: Reduce an over-privileged application schema']},
 {id:'tst',x:243,y:136,w:194,h:56,c:'mem',t:'Test',s:'full regression',d:'Run the application tests, including the rare paths.',why:'It confirms nothing needed was removed.',chk:`SELECT COUNT(*) FROM dba_errors WHERE owner = 'APP';`,see:[2,5,'Practical: Reduce an over-privileged application schema']},
 {id:'mon',x:465,y:136,w:194,h:56,c:'mem',t:'Monitor',s:'ORA-01031',d:'Watch for privilege errors after the change and keep the capture available.',why:'A rare job may fail only at quarter end.',chk:`SELECT event_timestamp, action_name, return_code FROM unified_audit_trail WHERE dbusername = 'APP' AND return_code = 1031;`,see:[2,1,'The ANY privilege risk and PUBLIC grants']}],
 steps:[
 {ids:['inv','cap'],t:'1. List current privileges and roles, and start a privilege capture for the account or role.',w:'It begins collecting evidence.',s:'`DBMS_PRIVILEGE_CAPTURE`.',x:'A capture on the wrong role gives an empty report.',c:`SELECT * FROM dba_priv_captures;`},
 {ids:['run'],t:'2. Let the application run through a full business cycle, including month-end and rarely used jobs.',w:'Coverage decides the quality of the result.',s:'Test plan, job calendar.',x:'Capturing for one day and revoking leads to an outage at quarter end.',c:`SELECT COUNT(*) FROM dba_used_privs WHERE capture = 'APP_CAP';`},
 {ids:['rep'],t:'3. Disable the capture, generate the result and read the unused privileges.',w:'This is your evidence-based list.',s:'`GENERATE_RESULT`, `DBA_UNUSED_PRIVS`.',x:'Not generating the result leaves the views empty.',c:`SELECT username, sys_priv FROM dba_unused_sysprivs WHERE capture = 'APP_CAP';`},
 {ids:['rev','tst'],t:'4. Revoke in test, run the regression suite, and prepare the revoke and re-grant scripts for production.',w:'You prove it before it matters.',s:'Change control, rollback script.',x:'Revoking a role used through a definer-rights procedure.',c:`REVOKE CREATE ANY TABLE FROM app;`},
 {ids:['mon'],t:'5. Roll out to production and watch for privilege errors for a full cycle. Re-run the capture annually.',w:'Privileges creep back over time.',s:'Audit policy on failed privilege use.',x:'Never repeating it leaves new excess in place.',c:`SELECT COUNT(*) FROM unified_audit_trail WHERE return_code = 1031 AND dbusername = 'APP';`}]}},

{h:'5. Building and reviewing an audit policy'},
{map:{title:'Audit policy map',h:216,trace:'Audit privileged access',
 hint:'Tap any box, or press Audit privileged access to follow a policy from a requirement to a review routine.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'req',x:20,y:24,w:139,h:56,c:'ext',t:'Requirement',s:'what question',d:'State the question the audit must answer: who changed privileges, who read salaries, who logged in as admin.',why:'It prevents auditing everything.',chk:`SELECT policy_name FROM audit_unified_policies FETCH FIRST 5 ROWS ONLY;`,see:[5,1,'Audit policies: predefined and custom']},
 {id:'def',x:187,y:24,w:139,h:56,c:'proc',t:'Define policy',s:'CREATE AUDIT POLICY',d:'Create the policy with the actions, privileges or objects that answer the question.',why:'A narrow policy is cheap to keep and easy to read.',chk:`CREATE AUDIT POLICY priv_use PRIVILEGES CREATE USER, ALTER USER, DROP USER, GRANT ANY PRIVILEGE, GRANT ANY ROLE;`,see:[5,6,'Practical: Build an audit policy for privileged access']},
 {id:'en',x:354,y:24,w:139,h:56,c:'proc',t:'Enable',s:'for whom',d:'Enable it for the users, or for all, and for success, failure, or both.',why:'A policy does nothing until enabled.',chk:`AUDIT POLICY priv_use;
AUDIT POLICY priv_use BY sys, system;`,see:[5,1,'Audit policies: predefined and custom']},
 {id:'test',x:521,y:24,w:139,h:56,c:'mem',t:'Test',s:'generate an event',d:'Perform one audited action and see the record appear.',why:'It proves the policy and the reporting.',chk:`SELECT event_timestamp, dbusername, action_name FROM unified_audit_trail WHERE unified_audit_policies LIKE '%PRIV_USE%' ORDER BY 1 DESC FETCH FIRST 3 ROWS ONLY;`,see:[5,2,'Reading and reporting from the unified audit trail']},
 {id:'rev',x:21,y:136,w:194,h:56,c:'mem',t:'Review',s:'on a schedule',d:'Run the review query daily or weekly, and have someone own it.',why:'A review that is nobody\'s job does not happen.',chk:`SELECT dbusername, action_name, COUNT(*) FROM unified_audit_trail WHERE event_timestamp > SYSDATE - 7 GROUP BY dbusername, action_name ORDER BY 3 DESC;`,see:[5,2,'Reading and reporting from the unified audit trail']},
 {id:'act',x:243,y:136,w:194,h:56,c:'warn',t:'Act',s:'investigate',d:'Follow up on unexpected events: confirm with the change record or the person.',why:'An unexplained privileged action is an incident until proven otherwise.',chk:`SELECT event_timestamp, dbusername, os_user, userhost, sql_text FROM unified_audit_trail WHERE action_name = 'GRANT' ORDER BY 1 DESC FETCH FIRST 5 ROWS ONLY;`,see:[8,4,'Incident response for database compromise']},
 {id:'pur',x:465,y:136,w:194,h:56,c:'disk',t:'Archive and purge',s:'retention',d:'Export to a safe store and purge according to the retention rule.',why:'The trail stays inside its space budget.',chk:`EXEC DBMS_AUDIT_MGMT.CLEAN_AUDIT_TRAIL(audit_trail_type => DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED, use_last_arch_timestamp => TRUE);`,see:[5,3,'Audit trail management and purge']}],
 steps:[
 {ids:['req','def'],t:'1. Write down the question, then create a policy that records exactly the actions that answer it.',w:'Targeted auditing keeps cost and noise low.',s:'`CREATE AUDIT POLICY`, predefined policies.',x:'Auditing SELECT on everything generates millions of rows of noise.',c:`SELECT policy_name, audit_condition FROM audit_unified_policies;`},
 {ids:['en','test'],t:'2. Enable the policy and test it by performing one audited action. Confirm it appears in the trail.',w:'It proves the whole chain.',s:'`AUDIT POLICY`, `UNIFIED_AUDIT_TRAIL`.',x:'A policy enabled for a user who never logs in records nothing.',c:`SELECT * FROM audit_unified_enabled_policies WHERE policy_name = 'PRIV_USE';`},
 {ids:['rev'],t:'3. Review the results on a schedule, with an owner who is not the administrator being audited.',w:'Separation of duties makes the audit meaningful.',s:'AUDIT_VIEWER role, scheduled report.',x:'The audited person reviewing their own activity.',c:`SELECT dbusername, COUNT(*) FROM unified_audit_trail WHERE event_timestamp > SYSDATE - 1 GROUP BY dbusername;`},
 {ids:['act'],t:'4. Investigate anything unexpected against change records, and escalate if there is no explanation.',w:'It is where auditing turns into security.',s:'Incident process.',x:'Waiting for a pattern before asking about a single odd event.',c:`SELECT event_timestamp, dbusername, action_name, sql_text FROM unified_audit_trail WHERE return_code <> 0 ORDER BY 1 DESC FETCH FIRST 10 ROWS ONLY;`},
 {ids:['pur'],t:'5. Archive the records off the database, and purge on schedule so the trail does not fill its tablespace.',w:'It meets retention and keeps the system healthy.',s:'`DBMS_AUDIT_MGMT`, retention policy.',x:'Purging before archiving destroys the evidence.',c:`SELECT COUNT(*) FROM unified_audit_trail;`}]}},

{h:'6. Locking an application down with SQL Firewall'},
{map:{title:'SQL Firewall map',h:216,trace:'Capture and enforce',
 hint:'Tap any box, or press Capture and enforce to follow SQL Firewall from capture to blocking.',
 lines:[[159,52,185,52],[326,52,352,52],[493,52,519,52],'M590 80 L590 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'en',x:20,y:24,w:139,h:56,c:'proc',t:'Enable',s:'SQL Firewall',d:'Enable the SQL Firewall feature in the database.',why:'It is off by default.',chk:`EXEC DBMS_SQL_FIREWALL.ENABLE;`,see:[7,1,'SQL Firewall: capture, allow-list and enforce']},
 {id:'cap',x:187,y:24,w:139,h:56,c:'proc',t:'Start capture',s:'for the app user',d:'Create and start a capture for the application account, in a representative period.',why:'It records connection context and the SQL.',chk:`EXEC DBMS_SQL_FIREWALL.CREATE_CAPTURE(username => 'APP', top_level_only => TRUE);
EXEC DBMS_SQL_FIREWALL.START_CAPTURE('APP');`,see:[7,1,'SQL Firewall: capture, allow-list and enforce']},
 {id:'run',x:354,y:24,w:139,h:56,c:'ext',t:'Run workload',s:'normal and rare paths',d:'Run the application through its normal and rare paths, ideally in a test or a quiet production period.',why:'Anything not captured will be blocked later.',chk:`SELECT COUNT(*) FROM dba_sql_firewall_capture_logs WHERE username = 'APP';`,see:[7,5,'Practical: Lock down an application with SQL Firewall']},
 {id:'gen',x:521,y:24,w:139,h:56,c:'mem',t:'Generate allow-list',s:'from capture',d:'Stop the capture and generate an allow-list from it.',why:'It is the model of normal behaviour.',chk:`EXEC DBMS_SQL_FIREWALL.STOP_CAPTURE('APP');
EXEC DBMS_SQL_FIREWALL.GENERATE_ALLOW_LIST('APP');`,see:[7,1,'SQL Firewall: capture, allow-list and enforce']},
 {id:'ver',x:21,y:136,w:194,h:56,c:'mem',t:'Review',s:'allow-list content',d:'Read the allow-list for surprises, such as a statement that should not be there.',why:'It is the moment to catch a bad pattern.',chk:`SELECT sql_text FROM dba_sql_firewall_allowed_sql WHERE username = 'APP' FETCH FIRST 10 ROWS ONLY;`,see:[7,1,'SQL Firewall: capture, allow-list and enforce']},
 {id:'blk',x:243,y:136,w:194,h:56,c:'warn',t:'Enforce',s:'observe, then block',d:'Enable the allow-list first in observe mode, then in block mode.',why:'Observe mode logs violations without breaking the application.',chk:`EXEC DBMS_SQL_FIREWALL.ENABLE_ALLOW_LIST(username => 'APP', enforce => DBMS_SQL_FIREWALL.ENFORCE_ALL, block => FALSE);`,see:[7,1,'SQL Firewall: capture, allow-list and enforce']},
 {id:'mon',x:465,y:136,w:194,h:56,c:'mem',t:'Monitor',s:'violations',d:'Review the violation log and respond to real attacks and to legitimate misses.',why:'New application releases need an updated allow-list.',chk:`SELECT username, occurred_at, sql_text, violation_type FROM dba_sql_firewall_violations ORDER BY occurred_at DESC FETCH FIRST 10 ROWS ONLY;`,see:[7,2,'Monitoring and responding to violations']}],
 steps:[
 {ids:['en','cap'],t:'1. Enable SQL Firewall and start a capture for the application account.',w:'The capture is the learning phase.',s:'`DBMS_SQL_FIREWALL`, `SQL_FIREWALL_ADMIN`.',x:'Capturing as the wrong user records nothing useful.',c:`EXEC DBMS_SQL_FIREWALL.START_CAPTURE('APP');`},
 {ids:['run'],t:'2. Run the application through all of its paths. Include batch jobs and rare reports.',w:'The allow-list will contain only what it saw.',s:'Test plans, job schedule.',x:'A path not exercised in capture will be blocked in enforcement.',c:`SELECT COUNT(DISTINCT sql_signature) FROM dba_sql_firewall_capture_logs WHERE username = 'APP';`},
 {ids:['gen','ver'],t:'3. Stop the capture, generate the allow-list and review what it contains.',w:'You approve the model of normal.',s:'`GENERATE_ALLOW_LIST`.',x:'Capturing during an attack puts the attack in the allow-list.',c:`SELECT COUNT(*) FROM dba_sql_firewall_allowed_sql WHERE username = 'APP';`},
 {ids:['blk'],t:'4. Enable the allow-list in observe mode first. Violations are logged, and nothing is blocked.',w:'You see false positives safely.',s:'`BLOCK => FALSE`.',x:'Going straight to block mode can stop legitimate work.',c:`SELECT COUNT(*) FROM dba_sql_firewall_violations;`},
 {ids:['mon'],t:'5. After a clean observation period switch to blocking. Review violations and update the allow-list on each release.',w:'It becomes an active control.',s:'`ENABLE_ALLOW_LIST ... BLOCK => TRUE`.',x:'Forgetting to update the list at release time breaks the new feature.',c:`EXEC DBMS_SQL_FIREWALL.ENABLE_ALLOW_LIST(username => 'APP', enforce => DBMS_SQL_FIREWALL.ENFORCE_ALL, block => TRUE);`}]}},

{h:'7. Responding to a suspected database compromise'},
{map:{title:'Incident response map',h:216,trace:'Respond to an incident',
 hint:'Tap any box, or press Respond to an incident to follow the order of actions from detection to lessons learned.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L89 107 L89 134',[159,164,185,164],[326,164,352,164],[493,164,519,164]],
 nodes:[
 {id:'det',x:21,y:24,w:194,h:56,c:'warn',t:'Detect',s:'alert or report',d:'A signal: audit alert, unusual access, a report from a user or a security team.',why:'Confirm before you act, but do not wait long.',chk:`SELECT event_timestamp, dbusername, action_name, return_code FROM unified_audit_trail WHERE event_timestamp > SYSDATE - 1/24 ORDER BY 1 DESC FETCH FIRST 20 ROWS ONLY;`,see:[8,4,'Incident response for database compromise']},
 {id:'scope',x:243,y:24,w:194,h:56,c:'mem',t:'Scope',s:'who, what, when',d:'Determine which accounts, hosts and data are involved and the time window.',why:'It sets the size of the response.',chk:`SELECT dbusername, userhost, COUNT(*) FROM unified_audit_trail WHERE event_timestamp > SYSDATE - 7 GROUP BY dbusername, userhost ORDER BY 3 DESC FETCH FIRST 10 ROWS ONLY;`,see:[8,4,'Incident response for database compromise']},
 {id:'cont',x:465,y:24,w:194,h:56,c:'proc',t:'Contain',s:'stop the access',d:'Lock the account, kill sessions, block the source address and rotate exposed credentials.',why:'Containment comes before investigation.',chk:`ALTER USER app_user ACCOUNT LOCK;
ALTER SYSTEM KILL SESSION '&sid,&serial#' IMMEDIATE;`,see:[8,4,'Incident response for database compromise']},
 {id:'evid',x:20,y:136,w:139,h:56,c:'disk',t:'Preserve evidence',s:'copy before changing',d:'Export the audit trail, alert log and listener logs and note times.',why:'Evidence needs to be kept, in a place the attacker cannot reach.',chk:`SELECT * FROM unified_audit_trail WHERE dbusername = '&user' ORDER BY event_timestamp;`,see:[8,5,'Security monitoring and reporting']},
 {id:'erad',x:187,y:136,w:139,h:56,c:'proc',t:'Eradicate',s:'remove the cause',d:'Remove backdoors (new accounts, grants, jobs, links), patch the vulnerability and fix the weak control.',why:'Check for persistence, not just the visible damage.',chk:`SELECT username, created FROM dba_users WHERE created > SYSDATE - 30;
SELECT owner, job_name FROM dba_scheduler_jobs WHERE enabled = 'TRUE';`,see:[8,4,'Incident response for database compromise']},
 {id:'rec',x:354,y:136,w:139,h:56,c:'proc',t:'Recover',s:'restore trust',d:'Restore data if it was changed, rotate every secret, and return to service with monitoring.',why:'Treat all credentials the attacker could see as burned.',chk:`SELECT username, expiry_date FROM dba_users WHERE oracle_maintained = 'N';`,see:[8,4,'Incident response for database compromise']},
 {id:'learn',x:521,y:136,w:139,h:56,c:'ext',t:'Lessons learned',s:'close the gap',d:'Write the timeline, the cause and the changes to controls and runbooks.',why:'The incident should leave the system stronger.',chk:`SELECT policy_name FROM audit_unified_enabled_policies;`,see:[8,6,'Capstone: Harden and audit a production database']}],
 steps:[
 {ids:['det','scope'],t:'1. Confirm the signal and work out the scope: the accounts involved, the source hosts and the time window.',w:'The scope sets the response.',s:'Audit trail, listener logs.',x:'Assuming the first account found is the only one.',c:`SELECT DISTINCT userhost FROM unified_audit_trail WHERE dbusername = '&user';`},
 {ids:['cont'],t:'2. Contain: lock accounts, end sessions, block the source and rotate exposed credentials.',w:'Stop the damage before analysing it.',s:'`ALTER USER ... ACCOUNT LOCK`, firewall rules.',x:'Killing sessions before capturing what they were doing.',c:`SELECT sid, serial#, program FROM v$session WHERE username = '&user';`},
 {ids:['evid'],t:'3. Preserve evidence: copy the audit trail, alert log, listener log and relevant redo or archive logs to a safe place.',w:'Logs rotate and attackers delete them.',s:'Retention, archive, SIEM.',x:'Working directly on the only copy of the evidence.',c:`SELECT COUNT(*) FROM unified_audit_trail WHERE dbusername = '&user';`},
 {ids:['erad'],t:'4. Remove persistence: new users, grants, scheduled jobs, links, triggers. Patch or fix the way in.',w:'The attacker may come back through the same door.',s:'Comparison with a known-good baseline.',x:'Cleaning the visible damage and missing a scheduler job.',c:`SELECT owner, job_name, job_action FROM dba_scheduler_jobs WHERE enabled = 'TRUE' AND owner NOT IN ('SYS','ORACLE_OCM');`},
 {ids:['rec','learn'],t:'5. Recover data if needed, rotate every secret and return to service. Write up what happened and change the controls that failed.',w:'It prevents a repeat.',s:'Runbook, change records.',x:'Skipping the review because the system is working again.',c:`SELECT username, profile FROM dba_users WHERE oracle_maintained = 'N';`}]}},

]},

/* 1 ---------------------------------------------------------------- feature map */
{t:'Security features map',d:'Which control answers which risk, and which licence it needs.',see:[[0,0,'Defense in depth'],[0,4,'Options and licensing']],b:[
{t:[['Risk','Control','Where configured','Licence'],
['Guessed or stolen password','Profiles, strong verifiers, MFA through directory or token','`CREATE PROFILE`, CMU, OAuth','Included (CMU and tokens: check release)'],
['Over-privileged account','Least privilege, privilege analysis, schema privileges','`DBMS_PRIVILEGE_CAPTURE`','Privilege analysis: Database Vault option'],
['Reading data on the wire','Native encryption or TLS','`sqlnet.ora`, wallet','Included (since 19c)'],
['Stolen disk or backup','TDE, backup encryption','Keystore, tablespace encryption','Advanced Security option'],
['Unauthorized viewing of values','Data Redaction','`DBMS_REDACT`','Advanced Security option'],
['Unauthorized rows','VPD, Label Security','`DBMS_RLS`, OLS','VPD: Enterprise Edition. OLS: option'],
['Privileged user reading data','Database Vault realms','`DBMS_MACADM`','Database Vault option'],
['Cannot prove who did what','Unified Auditing, FGA','`CREATE AUDIT POLICY`','Included'],
['SQL injection','Bind variables, SQL Firewall [26ai]','`DBMS_SQL_FIREWALL`','Check 26ai licensing guide'],
['Test copies leak data','Data Masking and Subsetting','Enterprise Manager, Data Safe','Option'],
['Unchangeable records needed','Immutable and blockchain tables','`CREATE IMMUTABLE TABLE`','Included in recent releases (check)'],
['Known flaws','Patching (RU, CSPU)','OPatch, AutoUpgrade','Included'],
['Misconfiguration','DBSAT, CIS benchmark','`dbsat collect`, `dbsat report`','Free tool']]},
{note:'Licensing statements change per release and per cloud service. This page is a map, not a contract. Check the Licensing Information User Manual.'}
]},

/* 2 ---------------------------------------------------------------- files */
{t:'Files and directories that matter for security',d:'The files that hold secrets or control access, and how to protect them.',see:[[1,2,'OS authentication and password file'],[4,1,'Keystore types']],b:[
{t:[['File','Holds','Protect with'],
['`orapw<SID>`','Administrative user passwords for remote SYSDBA','Mode 640, owner only; in RAC store in ASM'],
['`ewallet.p12`','TDE keystore (password-protected)','Mode 600, back up separately'],
['`cwallet.sso`','Auto-login keystore (no password)','Mode 600, host-bound for local auto-login'],
['`sqlnet.ora`','Encryption, validnode, wallet location','Config control, review in changes'],
['`listener.ora`','Listener endpoints, admin restrictions','Owner only, `ADMIN_RESTRICTIONS_LISTENER=ON`'],
['`tnsnames.ora`','Aliases (no passwords)','Ordinary'],
['Secure external password store wallet','Credentials for `/@alias` connects','Mode 600, owner only'],
['Audit files (`.aud`)','OS audit for SYS and mandatory auditing','`$ORACLE_BASE/admin/<db>/adump`, rotate and ship'],
['`dbsat` output','Assessment of your configuration','Treat as sensitive'],
['Dump files (Data Pump)','Full copies of data','Encrypt and delete after use'],
['RMAN backup pieces','Full copies of data','Encrypt and restrict access']]},
{note:'Create wallets with `orapki` or `mkstore`, set file mode `600` and keep a second copy of keystores away from the backups they protect.'}
]},

/* 3 ---------------------------------------------------------------- logs */
{t:'Audit and log locations',d:'Where evidence of security events lives.',see:[[5,0,'Unified auditing architecture'],[5,2,'Reading the audit trail']],b:[
{t:[['Source','Contains','Where'],
['Unified audit trail','All audit policy records','`UNIFIED_AUDIT_TRAIL`, `CDB_UNIFIED_AUDIT_TRAIL`'],
['OS audit files','SYS operations and early startup/shutdown','`adump` directory'],
['Alert log','Logon-related errors, parameter changes, TDE messages','ADR `trace/alert_<SID>.log`'],
['Listener log','Connection attempts, source IP, service names','`.../tnslsnr/<host>/listener/trace/listener.log`'],
['FGA records','Fine-grained audit events','Also in `UNIFIED_AUDIT_TRAIL` (for `DB` trail)'],
['Database Vault','Realm and command rule violations','`DVSYS.AUDIT_TRAIL$` or unified audit'],
['OS logs','`sudo`, SSH, authentication','`/var/log/secure` or the journal'],
['SIEM','Central, tamper resistant copy','Forward from unified audit and OS']]},
{code:`SELECT event_timestamp, dbusername, action_name, return_code, userhost
FROM unified_audit_trail
WHERE event_timestamp > SYSTIMESTAMP - INTERVAL '1' DAY AND action_name = 'LOGON' AND return_code <> 0
ORDER BY event_timestamp DESC;`}
]},

/* 4 ---------------------------------------------------------------- parameters */
{t:'Important parameters',d:'Database and Oracle Net settings that matter for security.',see:[[8,0,'Secure configuration'],[3,0,'Native encryption']],b:[
{h:'Database parameters'},
{t:[['Parameter','Recommended','Why'],
['`remote_login_passwordfile`','`EXCLUSIVE`','Only this database uses the file'],
['`o7_dictionary_accessibility`','`FALSE`','`ANY` privileges do not reach the dictionary'],
['`sql92_security`','`TRUE`','Needs SELECT privilege for UPDATE and DELETE with WHERE'],
['`audit_sys_operations`','`TRUE`','Audit SYS and SYSDBA actions (when mixed mode)'],
['`audit_trail`','`DB` or unified only','Traditional trail target'],
['`os_authent_prefix`','`\'\'` (empty) or specific prefix','Affects OS authenticated users'],
['`sec_max_failed_login_attempts`','10 (default)','Closes a connection after failed logins'],
['`sec_protocol_error_further_action`','`(DROP,3)` or `DELAY`','Reaction to protocol errors'],
['`sec_return_server_release_banner`','`FALSE`','Hide the release in the banner'],
['`encrypt_new_tablespaces`','`ALWAYS`','New tablespaces are encrypted'],
['`wallet_root`, `tde_configuration`','Set','Keystore location and type (19c)'],
['`global_names`','`TRUE`','Link names must match database names'],
['`db_securefile`','`PREFERRED`','SecureFile LOBs, encryption-capable'],
['`resource_limit`','`TRUE` (default since 12c)','Profile resource limits are enforced'],
['`sqlnet.allowed_logon_version_server`','`12a` or higher','Rejects old password verifiers']]},
{h:'sqlnet.ora and listener.ora'},
{t:[['Setting','Value','Purpose'],
['`SQLNET.ENCRYPTION_SERVER`','`REQUIRED`','Force encryption of sessions'],
['`SQLNET.ENCRYPTION_TYPES_SERVER`','`(AES256)`','Cipher'],
['`SQLNET.CRYPTO_CHECKSUM_SERVER`','`REQUIRED`','Integrity'],
['`SQLNET.CRYPTO_CHECKSUM_TYPES_SERVER`','`(SHA256)`','Algorithm'],
['`SSL_CLIENT_AUTHENTICATION`','`TRUE` or `FALSE`','Require client certificates'],
['`SQLNET.WALLET_OVERRIDE`','`TRUE`','Use the credential wallet for `/@alias`'],
['`WALLET_LOCATION`','Path','TLS and credential wallet directory'],
['`TCP.VALIDNODE_CHECKING`','`YES`','Enable allow and deny lists'],
['`TCP.INVITED_NODES`','`(host1,host2)`','Allowed clients'],
['`ADMIN_RESTRICTIONS_LISTENER`','`ON`','No remote listener changes'],
['`SQLNET.EXPIRE_TIME`','10','Detect dead connections']]},
{note:'Defaults change between releases. Check the setting on your system with `SELECT name, value, isdefault FROM v$parameter WHERE name = \'...\'` and compare with your release Security Guide.'}
]},

/* 5 ---------------------------------------------------------------- views */
{t:'System views',d:'Which view answers which security question.',see:[[2,0,'Privilege review'],[5,2,'Reading the audit trail']],b:[
{t:[['Question','View'],
['Who are the users, and what is their state?','`DBA_USERS`, `CDB_USERS`'],
['Default or weak passwords?','`DBA_USERS_WITH_DEFPWD`, `DBA_USERS.PASSWORD_VERSIONS`'],
['Which profiles and limits?','`DBA_PROFILES`'],
['Who has which role?','`DBA_ROLE_PRIVS`, `ROLE_ROLE_PRIVS`'],
['Who has system privileges?','`DBA_SYS_PRIVS`'],
['Who has object privileges?','`DBA_TAB_PRIVS`, `DBA_COL_PRIVS`'],
['Schema privileges (23ai and later)','`DBA_SCHEMA_PRIVS`'],
['Administrative users (password file)','`V$PWFILE_USERS`'],
['Used and unused privileges','`DBA_USED_PRIVS`, `DBA_UNUSED_PRIVS`'],
['Audit records','`UNIFIED_AUDIT_TRAIL`'],
['Which policies exist, are enabled?','`AUDIT_UNIFIED_POLICIES`, `AUDIT_UNIFIED_ENABLED_POLICIES`'],
['Fine-grained audit','`DBA_AUDIT_POLICIES`, `DBA_FGA_AUDIT_TRAIL`'],
['Keystore and encryption','`V$ENCRYPTION_WALLET`, `V$ENCRYPTION_KEYS`, `V$ENCRYPTED_TABLESPACES`, `DBA_ENCRYPTED_COLUMNS`'],
['Network encryption in use','`V$SESSION_CONNECT_INFO`'],
['Redaction and VPD','`REDACTION_POLICIES`, `REDACTION_COLUMNS`, `DBA_POLICIES`'],
['Database Vault','`DBA_DV_REALM`, `DBA_DV_COMMAND_RULE`'],
['Database links','`DBA_DB_LINKS`'],
['Network access from the database (UTL_HTTP and similar)','`DBA_HOST_ACES`, `DBA_NETWORK_ACLS`'],
['SQL Firewall [26ai]','`DBA_SQL_FIREWALL_*` views (check names in the 26ai guide)']]}
]},

/* 6 ---------------------------------------------------------------- tools */
{t:'Command-line tools',d:'Utilities used for security work and a typical command for each.',see:[[0,6,'DBSAT assessment'],[8,3,'Secrets handling']],b:[
{t:[['Tool','Use','Typical command'],
['`dbsat`','Assess configuration and find sensitive data','`dbsat collect system@pdb1 out; dbsat report out`'],
['`orapki`','Create and manage wallets and certificates','`orapki wallet create -wallet /w -auto_login_local`'],
['`mkstore`','Manage the secure external password store','`mkstore -wrl /w -createCredential ALIAS user pw`'],
['`orapwd`','Create the password file','`orapwd file=orapwORCL format=12.2`'],
['`sqlplus`','Test connections and settings','`sqlplus /@ALIAS`'],
['`lsnrctl`','Listener security status','`lsnrctl status`'],
['`adrci`','Inspect and package diagnostic data','`adrci exec="show alert -tail 50"`'],
['`opatch`','Show patch level','`opatch lspatches`'],
['`openssl`','Inspect certificates','`openssl x509 -in cert.pem -noout -dates`'],
['`ldapsearch`','Test directory lookups (CMU)','`ldapsearch -H ldaps://... -b ...`'],
['`okvutil`','Oracle Key Vault client utility','Per Key Vault documentation']]},
{h:'Keystore commands in SQL'},
{code:`ADMINISTER KEY MANAGEMENT CREATE KEYSTORE IDENTIFIED BY "KsPw#1";
ADMINISTER KEY MANAGEMENT SET KEYSTORE OPEN IDENTIFIED BY "KsPw#1";
ADMINISTER KEY MANAGEMENT SET KEY IDENTIFIED BY "KsPw#1" WITH BACKUP;
ADMINISTER KEY MANAGEMENT CREATE LOCAL AUTO_LOGIN KEYSTORE FROM KEYSTORE IDENTIFIED BY "KsPw#1";
ADMINISTER KEY MANAGEMENT BACKUP KEYSTORE USING 'pre_rekey' IDENTIFIED BY "KsPw#1";`}
]},

/* 7 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'Which authentication, which encryption, which keystore and which data protection feature to choose.',see:[[1,0,'Database authentication'],[6,0,'Data discovery']],b:[
{h:'Authentication'},
{t:[['Situation','Use'],
['Few human users, no directory','Password with strong profile'],
['Company directory exists','CMU with Active Directory or Entra ID'],
['Single sign-on on Windows or Unix','Kerberos'],
['Need certificates for clients','TLS client authentication'],
['Cloud-native identity, MFA','Token (OAuth/OIDC, OCI IAM)'],
['Object owners','`NO AUTHENTICATION` schema-only accounts'],
['Scripts and jobs','Secure external password store or vault']]},
{h:'Encryption'},
{t:[['Protect','Use'],
['Data on the wire, simple','Native network encryption'],
['Wire plus authentication of server','TLS'],
['Data at rest','TDE tablespace encryption'],
['A few sensitive columns (legacy)','TDE column encryption'],
['Backups outside your control','RMAN backup encryption'],
['Export files','Data Pump `ENCRYPTION=ALL`']]},
{h:'Keystore type'},
{t:[['Type','Choose when'],
['Password-protected','Manual open acceptable, highest control'],
['Local auto-login','Automatic restart on one host'],
['Auto-login','Avoid unless the keystore must open on other hosts'],
['HSM or Key Vault','Separation of duties and central key lifecycle']]},
{h:'Data protection'},
{t:[['Need','Use'],
['Hide parts of a value from some users','Data Redaction'],
['Show only some rows','VPD or Label Security'],
['Stop DBAs reading application data','Database Vault realm'],
['Non-production copy','Masking and subsetting'],
['Log access to sensitive columns','Fine-grained auditing'],
['Stop injected SQL','Bind variables, SQL Firewall [26ai]']]}
]},

/* 8 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, likely cause and fix.',see:[[1,6,'Authentication practical'],[3,5,'Enforce encryption']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['ORA-01017 for a valid password','Client version, `PASSWORD_VERSIONS`','Old verifier, case, wrong service','Reset the password, update client'],
['Account locked for application','Profile `FAILED_LOGIN_ATTEMPTS`, unified audit','Wrong password in a script, attack','Unlock after finding the source'],
['ORA-28002 expiring, ORA-28001 expired','Profile `PASSWORD_LIFE_TIME`','Policy','Change password; separate service profile'],
['Cannot connect after enabling encryption `REQUIRED`','Client `sqlnet.ora`, client version','Old or non-supporting client','Upgrade client, set `ACCEPTED` temporarily'],
['TLS connect fails','Wallet contents, certificate dates, DN match','Missing CA, expired certificate','Fix wallet or renew certificate'],
['Encrypted tablespace unreadable after restart','`V$ENCRYPTION_WALLET`','Keystore closed (password type)','Open the keystore, or use local auto-login'],
['Standby cannot open encrypted files','Standby keystore','Missing or old keystore','Copy current keystore'],
['Backups cannot be restored','Keystore of backup time','Keys not available','Restore keystore backup'],
['Audit trail growing fast','Policies enabled, volume by policy','Over-broad policy','Narrow policy, purge job'],
['DBA cannot see schema','Database Vault realm','Realm protection','Authorize via realm participant'],
['Users see all rows despite VPD','`EXEMPT ACCESS POLICY`, context set?','Privilege or context not set','Revoke exemption, fix context package'],
['SQL Firewall blocks valid SQL [26ai]','Violation log','Allow-list outdated','Re-capture after release']]}
]},

/* 9 ---------------------------------------------------------------- errors */
{t:'Common error messages',d:'Security-related messages, with meaning and fix.',see:[[1,0,'Authentication'],[4,1,'Keystores']],b:[
{t:[['Error','Meaning','Fix'],
['ORA-01017','Invalid username or password; logon denied','Check credentials, verifier, case'],
['ORA-01031','Insufficient privileges','Grant the needed privilege or role'],
['ORA-00942','Table or view does not exist (also privilege hidden)','Check name and grants'],
['ORA-28000','Account is locked','Unlock'],
['ORA-28001','Password has expired','Change password'],
['ORA-28002','Password will expire within n days','Warning'],
['ORA-28003','Password verification failed (complexity)','Choose a stronger password'],
['ORA-28007','Password cannot be reused','Choose a new one'],
['ORA-28009','Connection as SYS must be AS SYSDBA or AS SYSOPER','Use `AS SYSDBA`'],
['ORA-28040','No matching authentication protocol','Client too old or `sqlnet.allowed_logon_version_server` too high'],
['ORA-28043 / 28044','Invalid authentication protocol','Same cause'],
['ORA-28365','Wallet is not open','Open the keystore'],
['ORA-28367','Wallet does not exist','Create or point to the keystore'],
['ORA-28374','Typed master key not found in wallet','Restore the right keystore'],
['ORA-28353 / 28354','Failed to open wallet / encryption wallet error','Check password and file'],
['ORA-28759','Failure to open file (wallet)','Permissions and path'],
['ORA-12638','Credential retrieval failed','Check authentication adapter or wallet'],
['ORA-12650','No common encryption or data integrity algorithm','Align client and server settings'],
['ORA-01994','Password file missing or invalid','Recreate with `orapwd`'],
['ORA-47400 series','Database Vault violation (for example ORA-47401 realm)','Authorize the user in the realm or use the approved path'],
['ORA-28110','Policy function or package has error','Fix the VPD function'],
['ORA-28113','Policy predicate has error','Fix the predicate'],
['ORA-45xxx','Unified audit management errors','Check privileges `AUDIT_ADMIN`']]}
]},

/* 10 ---------------------------------------------------------------- health check */
{t:'Health-check SQL pack',d:'Paste-ready queries for a security review.',see:[[8,0,'Secure configuration'],[8,5,'Monitoring and reporting']],b:[
{h:'Accounts'},
{code:`SELECT username, account_status, profile, last_login, expiry_date
FROM dba_users WHERE oracle_maintained = 'N' ORDER BY username;

SELECT username FROM dba_users_with_defpwd;

SELECT username, password_versions FROM dba_users WHERE password_versions LIKE '%10G%';`},
{h:'Privileges'},
{code:`SELECT grantee, privilege FROM dba_sys_privs
WHERE privilege LIKE '%ANY%' AND grantee NOT IN (SELECT username FROM dba_users WHERE oracle_maintained = 'Y');

SELECT grantee, granted_role FROM dba_role_privs WHERE granted_role IN ('DBA','SELECT_CATALOG_ROLE','EXECUTE_CATALOG_ROLE');

SELECT table_name, privilege FROM dba_tab_privs WHERE grantee = 'PUBLIC'
AND table_name IN ('UTL_FILE','UTL_HTTP','UTL_TCP','UTL_SMTP','DBMS_LOB','DBMS_SQL');`},
{h:'Encryption'},
{code:`SELECT wrl_type, status, wallet_type, keystore_mode FROM v$encryption_wallet;
SELECT tablespace_name, encrypted FROM dba_tablespaces;
SELECT network_service_banner FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV','SID');`},
{h:'Auditing'},
{code:`SELECT policy_name, enabled_option, entity_name FROM audit_unified_enabled_policies;
SELECT COUNT(*), MIN(event_timestamp), MAX(event_timestamp) FROM unified_audit_trail;
SELECT dbusername, userhost, COUNT(*) failed
FROM unified_audit_trail WHERE action_name = 'LOGON' AND return_code <> 0
AND event_timestamp > SYSTIMESTAMP - 1 GROUP BY dbusername, userhost ORDER BY 3 DESC;`},
{h:'Links and jobs'},
{code:`SELECT owner, db_link, username, host FROM dba_db_links;
SELECT owner, job_name, job_type FROM dba_scheduler_jobs WHERE enabled = 'TRUE' AND owner NOT IN ('SYS','ORACLE_OCM');`}
]},

/* 11 ---------------------------------------------------------------- naming decoder */
{t:'Roles, policies and names decoder',d:'Predefined roles, administrative privileges and audit policies, and what each means.',see:[[0,2,'Least privilege'],[2,0,'Privilege model']],b:[
{h:'Administrative privileges'},
{t:[['Privilege','For'],
['`SYSDBA`','Full administration, bypasses most checks'],
['`SYSOPER`','Start, stop, backup, but no data access'],
['`SYSBACKUP`','Backup and recovery'],
['`SYSDG`','Data Guard operations'],
['`SYSKM`','Key management (TDE)'],
['`SYSRAC`','RAC and Clusterware operations']]},
{h:'Predefined roles worth knowing'},
{t:[['Role','Grants'],
['`CONNECT`','`CREATE SESSION` only (since 12.2)'],
['`RESOURCE`','Create objects of common types (legacy, avoid broad use)'],
['`DBA`','Almost every system privilege'],
['`SELECT_CATALOG_ROLE`','Select on dictionary views'],
['`AUDIT_ADMIN`, `AUDIT_VIEWER`','Manage and read unified audit'],
['`CAPTURE_ADMIN`','Manage privilege capture'],
['`DV_OWNER`, `DV_ACCTMGR`','Database Vault administration'],
['`DATAPUMP_EXP_FULL_DATABASE`','Full exports'],
['`PDB_DBA`','Administration inside a PDB']]},
{h:'Predefined unified audit policies'},
{t:[['Policy','Audits'],
['`ORA_SECURECONFIG`','Security-relevant privileges and actions (enabled by default)'],
['`ORA_LOGON_FAILURES`','Failed logons (enabled by default)'],
['`ORA_ACCOUNT_MGMT`','User, role and profile management'],
['`ORA_DATABASE_PARAMETER`','Parameter changes'],
['`ORA_CIS_RECOMMENDATIONS`','Events from the CIS benchmark (where available)'],
['`ORA_STIG_RECOMMENDATIONS`','Events from the DISA STIG (where available)']]},
{note:'Policy and role names depend on release. List the real ones with `SELECT DISTINCT policy_name FROM audit_unified_policies` and `SELECT role FROM dba_roles`.'}
]},

/* 12 ---------------------------------------------------------------- checklist */
{t:'Hardening checklist',d:'A short checklist to review before go-live and every quarter.',see:[[8,0,'Secure configuration'],[8,6,'Capstone']],b:[
{t:[['Area','Check','Done?'],
['Accounts','Default accounts locked or removed, no default passwords',''],
['Accounts','Named users, no shared SYS or SYSTEM',''],
['Accounts','Application accounts have only DML on needed objects',''],
['Authentication','Profiles with lockout, verifier version 12C or newer',''],
['Authentication','Directory or MFA for humans where possible',''],
['Privileges','No `ANY` privileges outside DBAs, `PUBLIC` reviewed',''],
['Privileges','Privilege analysis done for application roles',''],
['Network','Listener restricted, validnode checking, TLS or native encryption required',''],
['Network','Database not reachable from the internet, admin via bastion',''],
['Data','TDE on application tablespaces, keystore backed up and tested',''],
['Data','Sensitive columns classified, redaction/VPD where needed',''],
['Audit','Unified auditing policies on, trail forwarded, purge job set',''],
['Secrets','No plain passwords in scripts, wallets protected',''],
['Platform','OS hardened, patched, file modes correct',''],
['Patching','Within one RU of current, security patches applied by policy',''],
['Backups','Encrypted, access limited, one immutable copy',''],
['Response','Incident runbook tested, contacts current','']]}
]}

]};
