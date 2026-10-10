/* LearnSphere - Oracle Security & Compliance Quick Reference (cheat sheet).
   window.QREF['ora-sec'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Values are for Oracle Database 19c on Linux unless stated; 26ai features are marked [26ai].
   Many security features are separately licensed options: confirm in the Licensing Information User Manual. */
window.QREF=window.QREF||{};
window.QREF['ora-sec']={title:'Security & Compliance Quick Reference',blurb:'Which feature protects what, files, parameters, views, error codes and a hardening checklist, one page each.',hint:'audit or wallet',pages:[

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
