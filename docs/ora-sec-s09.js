/* LearnSphere - Security, Section 09: Security Operations, Hardening & Capstone.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const SG=O.D+'dbseg/';

/* ---------- diagrams ---------- */
const ir=O.dg(700,170,[
[10,45,120,80,'Detect|alerts, audit,|SIEM',2],
[160,45,120,80,'Contain|isolate, lock|accounts',0],
[310,45,120,80,'Investigate|audit trail,|logs, scope',0],
[460,45,110,80,'Recover|rotate keys,|restore',0],
[600,45,90,80,'Learn|fix root|cause',0]],
[[130,85,160,85],[280,85,310,85],[430,85,460,85],[570,85,600,85]]);

/* ---------- 0: Secure configuration ---------- */
L['ora-sec:8:0']={blocks:[
{p:'A secure **baseline** configuration closes the easy doors. Check it regularly, since drift is normal.'},
{t:[['Area','Check','Target'],
['**Default accounts**','Locked or removed: `SCOTT`, sample schemas, `DBSNMP` if unused','Locked and expired'],
['**Sample and demo schemas**','Not installed in production','Removed'],
['**Passwords**','All users have strong or no password','No default passwords (DBSAT, `DBA_USERS_WITH_DEFPWD`)'],
['**Parameters**','`REMOTE_LOGIN_PASSWORDFILE`, `O7_DICTIONARY_ACCESSIBILITY=FALSE`, `SQL92_SECURITY=TRUE`, `AUDIT_SYS_OPERATIONS`','Per CIS'],
['**UTL_ packages**','`PUBLIC` execute revoked where unneeded','Least privilege'],
['**Listener**','Restricted admin, valid nodes','Section 4'],
['**Files**','Permissions on datafiles, wallet, logs: owner only','`chmod 640`, `750`'],
['**Network**','Encrypted, firewalled','Section 4']]},
{code:`SELECT username FROM dba_users_with_defpwd;
SELECT name, value FROM v$parameter WHERE name IN
 (\'remote_login_passwordfile\',\'o7_dictionary_accessibility\',\'sql92_security\',\'audit_sys_operations\');
SELECT username, account_status FROM dba_users WHERE oracle_maintained=\'N\' ORDER BY 2;`},
{note:'Use **CIS** or **DBSAT** as your checklist, record exceptions with a reason, and re-check after every patch or upgrade.'}],
src:[['Security guidelines',SG],['CIS benchmark','https://www.cisecurity.org/benchmark/oracle_database']]};

/* ---------- 1: OS and container hardening ---------- */
L['ora-sec:8:1']={blocks:[
{p:'The database is only as safe as the **host** and **container** it runs on.'},
{t:[['Area','Practice'],
['**OS accounts**','Separate `oracle`, `grid` owners. No shared logins, `sudo` with logging.'],
['**Groups**','Keep `dba`, `oper`, `asmadmin` small and reviewed'],
['**Packages and services**','Minimal OS installation, disable unused services'],
['**File permissions**','Binaries, wallets, trace and audit files protected'],
['**SSH**','Keys, MFA, no root login'],
['**Patching OS**','Same cycle as database'],
['**SELinux / AppArmor**','Keep enabled where supported'],
['**Containers**','Run non-root, read-only image layers, secrets from a vault not the image, scanned images'],
['**Backups and dumps**','Stored with the same protection as the database']]},
{code:`# Linux checks
ls -l $ORACLE_HOME/network/admin
ls -ld /u01/app/oracle/admin/*/wallet
getenforce
grep -E \'^PermitRootLogin|^PasswordAuthentication\' /etc/ssh/sshd_config`},
{note:'For containers, do not store passwords or keystores inside the image. Mount secrets at run time from a secret manager.'}],
src:[['Platform security',SG]]};

/* ---------- 2: Patching ---------- */
L['ora-sec:8:2']={blocks:[
{p:'Known flaws are the main way attackers get in. **Patching** is the highest-value security control.'},
{t:[['Patch','Content','Frequency'],
['**Release Update (RU)**','Fixes (security and bug) and regression fixes','Quarterly'],
['**Critical Patch Update (CPU)**','Security fixes, delivered in the quarterly RU','Quarterly (see MOS for the changes since 2026)'],
['**Security patch (CSPU)**','Security-only fixes on a monthly stream (where applicable)','Per Oracle announcement'],
['**One-off / interim**','A specific fix','As needed']]},
{code:`-- what is installed?
SELECT patch_id, action, status, description FROM dba_registry_sqlpatch ORDER BY action_time DESC;
$ORACLE_HOME/OPatch/opatch lspatches`},
{h:'Process'},
{flow:['Read the quarterly advisory and score severity (CVSS)','Test the patch on a copy','Schedule by risk: internet-facing first','Apply (see Upgrade and Patching sub-course)','Verify and record in the register']},
{note:'Exact patch cadence and names change. Always read the current Oracle announcement on My Oracle Support before you plan.'}],
src:[['Critical Patch Updates','https://www.oracle.com/security-alerts/']]};

/* ---------- 3: Secrets ---------- */
L['ora-sec:8:3']={blocks:[
{p:'Passwords in scripts, config files and repositories are a top cause of breaches. Keep secrets in a **wallet** or **vault**.'},
{t:[['Where passwords hide','Better'],
['Shell scripts, cron jobs','**Secure External Password Store** (Oracle wallet)'],
['Application config files','Secret manager or vault, injected at run time'],
['Source repositories','Never commit. Scan repositories for secrets.'],
['Command lines (`ps` shows them)','Use `/@alias` connect strings with a wallet'],
['Emails, tickets','Never. Use a password manager.']]},
{code:`# create an external password store
mkstore -wrl /home/oracle/wallet -create
mkstore -wrl /home/oracle/wallet -createCredential PRODDB backup_user <password>
# sqlnet.ora
WALLET_LOCATION = (SOURCE=(METHOD=FILE)(METHOD_DATA=(DIRECTORY=/home/oracle/wallet)))
SQLNET.WALLET_OVERRIDE = TRUE
# use
sqlplus /@PRODDB`},
{h:'Rules'},
{ul:['Rotate secrets on a schedule and when people leave.','Wallet file mode `600`, owner only.','Back up wallets separately and securely.']},
{note:'Check history files and logs too: `.bash_history` and tool logs can contain secrets typed on the command line.'}],
src:[['Secure external password store',SG]]};

/* ---------- 4: Incident response ---------- */
L['ora-sec:8:4']={blocks:[
{p:'Plan the response **before** an incident.'},
{svg:ir},
{t:[['Phase','Database actions'],
['**Detect**','Alerts from audit and SIEM, unusual logons, large exports'],
['**Contain**','Lock or expire the account, kill sessions, restrict network, preserve evidence'],
['**Investigate**','Unified audit, listener and OS logs, `V$SESSION` history, what data and when'],
['**Recover**','Rotate passwords and keys, restore from clean backup if needed, close the hole'],
['**Learn**','Root cause, update controls, runbooks and training']]},
{code:`-- contain
ALTER USER suspect ACCOUNT LOCK PASSWORD EXPIRE;
SELECT sid, serial# FROM v$session WHERE username=\'SUSPECT\';
ALTER SYSTEM KILL SESSION \'sid,serial#\' IMMEDIATE;

-- evidence: do not purge; export the audit trail for the window
SELECT * FROM unified_audit_trail WHERE dbusername=\'SUSPECT\' ORDER BY event_timestamp;`},
{note:'**Preserve evidence first**: copy audit records and logs before cleaning. Involve security and legal contacts early, as rules on breach notification may apply.'}],
src:[['Incident response',SG]]};

/* ---------- 5: Monitoring and reporting ---------- */
L['ora-sec:8:5']={blocks:[
{p:'Make security **visible**. Regular reports show whether controls still work.'},
{t:[['Report','Frequency','Audience'],
['Failed logons and locked accounts','Daily','Security operations'],
['Privileged activity (DDL, grants, ALTER SYSTEM)','Daily or weekly','Security and DBA lead'],
['New users, role changes','Weekly','Owners'],
['Users with `DBA` or ANY privileges','Monthly','Management'],
['Patch level and gaps','Monthly','Management'],
['DBSAT or CIS scan','Quarterly','Auditors'],
['Encryption coverage (tablespaces)','Quarterly','Compliance']]},
{code:`SELECT TRUNC(event_timestamp) day, COUNT(*) failed_logons
FROM unified_audit_trail WHERE action_name=\'LOGON\' AND return_code <> 0
  AND event_timestamp > SYSTIMESTAMP - 7 GROUP BY TRUNC(event_timestamp) ORDER BY 1;`},
{h:'Key indicators'},
{ul:['Percent of data encrypted.','Percent of databases at current patch level.','Number of High findings open.','Mean time to remove leaver accounts.']},
{note:'A few measured indicators, reviewed monthly, beat a long checklist that nobody reads.'}],
src:[['Monitoring',SG]]};

/* ---------- 6: Capstone ---------- */
L['ora-sec:8:6']={blocks:[
{p:'**Capstone.** Harden and audit a **production-like** database. Keep a log: the evidence and the report are your deliverable.'},
{h:'Specification'},
{t:[['Area','Requirement'],
['Baseline','DBSAT report with all High findings addressed or accepted with reason'],
['Identity','Named admin accounts, profiles, schema-only owners'],
['Privileges','No `DBA` for applications, ANY privileges replaced, `PUBLIC` reviewed'],
['Network','TLS or native encryption required, valid nodes'],
['Data','TDE on application tablespaces, keystore backup tested'],
['Audit','Policies for privileged use, trail purge, export to SIEM'],
['Data protection','Redaction or VPD on the sensitive table, masked non-prod copy'],
['Secrets','No plain passwords in scripts, wallet in use'],
['Operations','Patch register, incident runbook, monthly report']]},
{h:'Steps'},
{flow:['Scan the baseline (DBSAT) and rank findings','Fix identity, privileges and configuration','Encrypt data and network','Enable auditing and forward the trail','Protect sensitive columns and non-production copies','Write runbooks and rescan']},
{h:'Acceptance'},
{t:[['Test','Pass condition'],
['Rescan','No High findings (or accepted with reason)'],
['Privilege test','Application account cannot do DDL or read other schemas'],
['Encryption test','Wire capture unreadable. Datafile strings show nothing.'],
['Audit test','A privileged action appears within the audit trail and the SIEM'],
['Restore test','Encrypted backup restores only with the keystore'],
['Incident drill','Compromised account locked and evidence preserved within the target time']]},
{h:'Self-assessment'},
{t:[['Level','Meaning'],
['**Foundation**','Controls are in place and you can explain each'],
['**Solid**','You also attacked your own system and the controls caught it'],
['**Ready**','Another engineer can operate, audit and respond using your runbooks']]},
{note:'You have now finished the Database Security sub-course. Combine it with Backup (encrypted backups) and Upgrade (secure patching) as one lifecycle.'}],
src:[['Database Security Guide',SG],['Oracle Database 19c documentation',D]]};

})();
