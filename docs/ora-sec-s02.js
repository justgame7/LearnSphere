/* LearnSphere - Security, Section 02: Authentication & Identity.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const SG=O.D+'dbseg/';

/* ---------- diagrams ---------- */
const auth=O.dg(700,190,[
[10,60,120,70,'User or|application',0],
[170,60,130,70,'Listener',0],
[340,40,150,110,'Database|checks identity:|password, OS,|Kerberos, token',2],
[540,60,150,70,'Session with|roles and|privileges',0]],
[[130,95,170,95],[300,95,340,95],[490,95,540,95]]);

const dir=O.dg(700,190,[
[10,60,130,70,'User logs in|(directory or|cloud identity)',0],
[190,60,130,70,'Directory|Active Directory|or Entra ID',2],
[370,60,130,70,'Database|maps user to|shared schema',0],
[550,60,140,70,'Session|as that identity|(audited)',0]],
[[140,95,190,95],[320,95,370,95],[500,95,550,95]]);

/* ---------- 0: Database authentication ---------- */
L['ora-sec:1:0']={blocks:[
{p:'**Authentication** proves identity. The most common method is the **database password**, stored as a **verifier** (a salted hash), not as the password itself.'},
{svg:auth},
{t:[['Verifier','Meaning'],
['**11G, 12C**','Older SHA-1 and SHA-512 based verifiers'],
['**12C verifier** (PBKDF2 + SHA-512)','Strong. Used by default for new passwords in current releases.'],
['**10G verifier**','Weak and case-insensitive. Remove it.']]},
{code:`-- which verifiers do accounts have?
SELECT username, password_versions FROM dba_users WHERE oracle_maintained=\'N\';

-- sqlnet.ora (server): disallow old protocol
SQLNET.ALLOWED_LOGON_VERSION_SERVER=12a

-- change password
ALTER USER app_user IDENTIFIED BY "New#Strong_pw_2026";`},
{h:'Authentication types'},
{t:[['Type','How'],
['**Password**','Verifier in the database'],
['**OS**','`IDENTIFIED EXTERNALLY`, trusted OS login'],
['**External services**','Kerberos, TLS certificates, RADIUS'],
['**Directory / token**','LDAP directory, Entra ID, OAuth tokens'],
['**None (schema only)**','`NO AUTHENTICATION` for schema owners who cannot log in']]},
{note:'Use **schema-only accounts** (`CREATE USER x NO AUTHENTICATION`) for object owners. They cannot be attacked by password guessing.'}],
src:[['Authentication',SG]]};

/* ---------- 1: Profiles ---------- */
L['ora-sec:1:1']={blocks:[
{p:'A **profile** sets password rules and resource limits for a group of users.'},
{t:[['Parameter','Meaning','Suggested'],
['`FAILED_LOGIN_ATTEMPTS`','Failures before lock','5 to 10'],
['`PASSWORD_LOCK_TIME`','Lock duration in days','1 (or until admin unlocks)'],
['`PASSWORD_LIFE_TIME`','Days before expiry','Per policy (for service accounts, consider no expiry with other controls)'],
['`PASSWORD_REUSE_TIME / MAX`','Prevent reuse','Set one of them'],
['`PASSWORD_GRACE_TIME`','Days after expiry to change','7'],
['`PASSWORD_VERIFY_FUNCTION`','Complexity check','`ORA12C_STRONG_VERIFY_FUNCTION` or your own'],
['`INACTIVE_ACCOUNT_TIME`','Lock unused accounts after N days','30 to 90'],
['`SESSIONS_PER_USER`, `IDLE_TIME`, `CONNECT_TIME`','Resource limits','As needed']]},
{code:`CREATE PROFILE app_users LIMIT
  FAILED_LOGIN_ATTEMPTS 5
  PASSWORD_LOCK_TIME 1
  PASSWORD_LIFE_TIME 90
  PASSWORD_REUSE_MAX 10
  PASSWORD_VERIFY_FUNCTION ora12c_strong_verify_function
  INACTIVE_ACCOUNT_TIME 60
  IDLE_TIME 30;

ALTER USER app_user PROFILE app_users;

SELECT profile, resource_name, limit FROM dba_profiles WHERE profile=\'APP_USERS\';`},
{note:'Do not apply strict expiry to **application** accounts without coordinating, or applications fail at 3 a.m. Use separate profiles for people and applications.'}],
src:[['Profiles',SG]]};

/* ---------- 2: OS authentication and password file ---------- */
L['ora-sec:1:2']={blocks:[
{p:'Two special ways to authenticate administrators.'},
{t:[['','OS authentication','Password file'],
['**How**','Members of OS groups (`dba`, `oper`, `backupdba`, `dgdba`, `kmdba`, `racdba`) connect with `/ as sysdba`','`orapwd` file, `SYS` and other admin users with passwords'],
['**Remote**','No','Yes, `sqlplus sys@db as sysdba`'],
['**Risk**','Anyone in the OS group is an administrator','The file must be protected, strong passwords']]},
{code:`-- list administrative users in the password file
SELECT username, sysdba, sysoper, sysbackup, sysdg, syskm FROM v$pwfile_users;

-- create a password file (19c)
orapwd file=orapwORCL format=12.2 sys=password

-- grant a limited privilege
GRANT SYSBACKUP TO backup_admin;`},
{h:'Rules'},
{ul:['Keep the OS groups small, and audit who is in them.','Do not give remote `SYSDBA` to many people. Use `SYSBACKUP`, `SYSDG`, `SYSKM` for specific tasks.','Protect the password file (mode 640) and in RAC, store it in ASM.']},
{note:'`SYSDBA` connections bypass the data dictionary check when the database is closed. Audit them, since they are your most powerful accounts.'}],
src:[['Administrative authentication',SG]]};

/* ---------- 3: External: Kerberos and certificates ---------- */
L['ora-sec:1:3']={blocks:[
{p:'**External authentication** lets a trusted service prove identity, so the database holds no password.'},
{t:[['Method','Idea','Setup items'],
['**Kerberos**','A ticket from the Kerberos server (KDC) proves the user','`sqlnet.ora` Kerberos parameters, keytab, user `IDENTIFIED EXTERNALLY AS \'user@REALM\'`'],
['**TLS client certificates**','The client certificate names the user','Wallets on both sides, `SSL_CLIENT_AUTHENTICATION`, user `IDENTIFIED EXTERNALLY AS \'CN=...\'`'],
['**RADIUS**','Authentication server, often with tokens (MFA)','`sqlnet.ora` RADIUS settings']]},
{code:`-- user mapped to a Kerberos principal
CREATE USER alice IDENTIFIED EXTERNALLY AS \'alice@EXAMPLE.COM\';
GRANT CREATE SESSION TO alice;`},
{h:'Why use it'},
{ul:['Single sign-on and central password and lockout policy.','Passwords never travel to or live in the database.','Accounts follow the company directory: leaver disabled in one place.']},
{note:'Check the exact parameter names for your release in the Security Guide. They are numerous, and small typos give silent fallbacks.'}],
src:[['Kerberos and certificate authentication',SG]]};

/* ---------- 4: Centrally managed users ---------- */
L['ora-sec:1:4']={blocks:[
{p:'**Centrally managed users (CMU)** let the database use **Active Directory** (and in recent releases **Microsoft Entra ID**) for authentication and authorization, **without** creating a database user for every person.'},
{svg:dir},
{t:[['Piece','Meaning'],
['**Shared schema**','One database schema (for example `app_shared`) used by many directory users'],
['**Global user**','`CREATE USER app_shared IDENTIFIED GLOBALLY`'],
['**Global role**','`CREATE ROLE sales_ro IDENTIFIED GLOBALLY`, mapped to a directory group'],
['**Mapping**','Directory group to schema or role (`AS \'CN=...\'`)']]},
{code:`CREATE USER sales_schema IDENTIFIED GLOBALLY AS \'CN=SalesUsers,OU=Groups,DC=example,DC=com\';
CREATE ROLE sales_ro IDENTIFIED GLOBALLY AS \'CN=SalesReaders,OU=Groups,DC=example,DC=com\';
GRANT SELECT ON app.orders TO sales_ro;`},
{h:'Benefits'},
{ul:['Joiner, mover and leaver are handled in the directory.','Group membership drives privileges.','Strong policy and MFA from the identity provider.']},
{note:'Setup needs the directory configuration and certificates. Check the CMU chapter of the Security Guide for your release before you plan.'}],
src:[['Centrally managed users',SG]]};

/* ---------- 5: Token and OAuth ---------- */
L['ora-sec:1:5']={blocks:[
{p:'Modern cloud identity uses **tokens**, not passwords. The user signs in to the identity provider and receives a **token** that the database accepts.'},
{t:[['Method','Meaning'],
['**OAuth 2.0 / OIDC token**','Token issued by Entra ID or OCI IAM, presented to the database'],
['**OCI IAM token**','Database tokens for OCI users and groups'],
['**Resource principals**','Applications use their cloud identity, not stored passwords']]},
{flow:['User authenticates with the identity provider (with MFA)','Provider issues a signed token','Client connects to the database with the token','Database validates the token and maps user and roles']},
{h:'Why it matters'},
{ul:['MFA works because it is at the identity provider.','No password in application config.','Access is revoked centrally.']},
{note:'This is an overview. Exact steps depend on the cloud and the release. Read the matching chapter before you implement.'}],
src:[['Token-based authentication',SG]]};

/* ---------- 6: Practical ---------- */
L['ora-sec:1:6']={blocks:[
{p:'**Configure authentication policy** and, if you have a lab directory, directory-based authentication. The core of this practical is the profile and the checks, which do not need a directory.'},
{code:`-- 1. strong profile
CREATE PROFILE human_users LIMIT FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LIFE_TIME 90
  PASSWORD_VERIFY_FUNCTION ora12c_strong_verify_function INACTIVE_ACCOUNT_TIME 60;

-- 2. a schema-only owner and a login user
CREATE USER app_owner NO AUTHENTICATION;
CREATE USER app_login IDENTIFIED BY "Long#Random_pw_2026" PROFILE human_users;
GRANT CREATE SESSION TO app_login;

-- 3. checks
SELECT username, authentication_type, profile, account_status FROM dba_users WHERE username IN (\'APP_OWNER\',\'APP_LOGIN\');
SELECT username, password_versions FROM dba_users WHERE username=\'APP_LOGIN\';`},
{h:'If you have a directory'},
{ul:['Create the shared schema `IDENTIFIED GLOBALLY` and a global role.','Connect as a directory user and check `SELECT sys_context(\'USERENV\',\'AUTHENTICATED_IDENTITY\') FROM dual;`.']},
{h:'Check your result'},
{t:[['Check','Expected'],
['`app_owner`','`AUTHENTICATION_TYPE` NONE, cannot log in'],
['`app_login`','PASSWORD, profile `HUMAN_USERS`'],
['Wrong password 5 times','Account locked'],
['`password_versions`','Only current verifier versions']]},
{note:'Unlock with `ALTER USER app_login ACCOUNT UNLOCK;`. Write the unlock procedure into your support runbook.'}],
src:[['Authentication',SG]]};

})();
