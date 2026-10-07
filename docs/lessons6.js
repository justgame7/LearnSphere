/* LearnSphere: Section 07 - User Management & Security (lectures 1-7 + bonus lectures 8-11)
   Load AFTER lessons5.js. Docs links target PostgreSQL 18. Also back-fills notes into earlier lessons. */
(function(){
const D='https://www.postgresql.org/docs/18/';
const dg=window.LS_DG;

/* ---------- diagrams ---------- */
const roleSvg=dg(700,250,[
[10,15,200,215,'Login roles (people, apps)',1],[25,45,170,45,'alice|LOGIN',0],[25,105,170,45,'bob|LOGIN',0],[25,165,170,45,'app_user|LOGIN, CONNECTION LIMIT',0],
[250,15,200,215,'Group roles (NOLOGIN)',1],[265,45,170,50,'app_read|SELECT',2],[265,110,170,50,'app_write|INSERT, UPDATE, DELETE',2],[265,175,170,40,'app_owner|owns objects',0],
[490,15,200,215,'Database objects',1],[505,45,170,50,'Schema app|USAGE, CREATE',0],[505,110,170,50,'Tables, sequences|SELECT, INSERT ...',0],[505,175,170,40,'Rows via policies|RLS',0]],
[[195,67,265,67],[195,127,265,127],[195,187,265,135],[435,70,505,70],[435,135,505,135],[435,195,505,195]]);
const authSvg=dg(700,200,[
[10,70,95,55,'Client|connects',0],[125,70,110,55,'pg_hba.conf|first matching rule',2],[255,70,110,55,'Method|scram, peer, cert',2],[385,70,110,55,'Role checks|LOGIN, VALID UNTIL|CONNECTION LIMIT',0],[515,70,80,55,'CONNECT|on database',0],[615,70,75,55,'Object|privileges, RLS',0],
[10,15,355,30,'AUTHENTICATION: who are you?',1],[385,15,305,30,'AUTHORIZATION: what may you do?',1]],
[[105,97,125,97],[235,97,255,97],[365,97,385,97],[495,97,515,97],[595,97,615,97]]);
const pubSvg=dg(700,190,[
[10,65,130,55,'PUBLIC|every role,|present and future',2],
[220,10,200,45,'Database|CONNECT, TEMPORARY',0],[220,70,200,45,'Schema public|USAGE (CREATE removed in 15)',0],[220,130,200,45,'Functions, procedures|EXECUTE',0],[470,70,220,45,'Languages and types|USAGE',0]],
[[140,85,220,32],[140,92,220,92],[140,100,220,152],[420,92,470,92]]);
const inhSvg=dg(700,230,[
[10,15,320,200,'INHERIT: privileges are automatic',1],[25,50,100,45,'alice',0],[165,50,150,45,'dev_read|SELECT',2],[25,130,290,50,'alice can SELECT immediately',0],
[370,15,320,200,'NOINHERIT: privileges are opt-in',1],[385,50,100,45,'bob',0],[525,50,150,45,'migrator|DDL, owns tables',2],[385,130,290,50,'bob must run SET ROLE migrator|to use those privileges',0]],
[[125,72,165,72],[485,72,525,72],[170,95,170,130],[530,95,530,130]]);
const rlsSvg=dg(700,200,[
[10,70,120,55,'SELECT * FROM|orders',0],[170,70,150,55,'Policy USING|company = current_setting|(app.current_company)',2],[370,70,120,55,'Table orders|all tenants',0],[540,10,150,45,'acme sees|only acme rows',0],[540,75,150,45,'globex sees|only globex rows',0],[540,140,150,45,'no setting|sees no rows',0]],
[[130,97,170,97],[320,97,370,97],[490,85,540,32],[490,97,540,97],[490,110,540,162]]);

window.EXTRA_LECTURES=window.EXTRA_LECTURES||{};
window.EXTRA_LECTURES[6]=[
['Predefined Roles','0:00','The built-in pg_* roles (pg_monitor, pg_read_all_data, pg_signal_backend and others): what each grants and how to use them instead of superuser.'],
['Ownership, Default Privileges and Dropping Roles','0:00','Object ownership, ALTER DEFAULT PRIVILEGES, REASSIGN OWNED and DROP OWNED, and a safe procedure to offboard a role.'],
['Passwords, SCRAM and TLS','0:00','How passwords are stored and verified, migrating from md5 to SCRAM-SHA-256, password expiry, and encrypting connections with TLS and client certificates.'],
['Security Hardening Checklist and Auditing','0:00','Column-level privileges, SECURITY DEFINER safety, pgAudit, audit queries and a production hardening checklist.']];

Object.assign(window.LESSONS,{

/* ---------------------------------------------------------------- 6:0 */
'pg:6:0':{blocks:[
{p:'PostgreSQL manages access through **roles**. The documentation (Chapter "Database Roles") defines a role as an entity that can own database objects and have database privileges; depending on how it is used it can be thought of as a **user**, a **group**, or both. Since PostgreSQL 8.1 the older separate concepts of users and groups were merged into this single idea. Everything that follows in this section (authentication, `GRANT`, row-level security) is built on roles, so a clear mental model here saves many mistakes later.'},
{h:'Role, user and group'},
{t:[['Term','What it really is','How it is usually created'],['Role','The only account concept in PostgreSQL. Has a name, attributes, optional password, memberships','`CREATE ROLE name ...`'],['User','A role that has the `LOGIN` attribute, so it can start a session','`CREATE USER name` (same as `CREATE ROLE name LOGIN`)'],['Group','A role used as a **container of privileges**; other roles become members. Normally `NOLOGIN`','`CREATE ROLE name NOLOGIN` (or the legacy `CREATE GROUP`)']]},
{note:'`CREATE USER` and `CREATE ROLE` differ in one way only: `CREATE USER` assumes `LOGIN`, `CREATE ROLE` assumes `NOLOGIN`.'},
{h:'Key facts from the documentation'},
{ul:['Roles are **cluster-wide**. A role is not tied to one database, and role names are unique across the whole cluster.','Role names that start with `pg_` are **reserved** for predefined roles.','A role is **not** the same as an operating-system user, although `peer` authentication can link them.','The initial **superuser** is created by `initdb`; its name is the OS user that ran `initdb`, normally `postgres`.','A **superuser** bypasses every permission check except the right to log in. Treat it like root.','Roles are stored in the catalog `pg_authid` (password hashes, superuser only). The view `pg_roles` shows the same roles without passwords and is readable by everyone.']},
{h:'The role model'},
{svg:roleSvg},
{p:'The recommended pattern separates **who logs in** from **what is allowed**. People and applications are login roles. Privileges are granted to NOLOGIN group roles. Login roles become members of those groups. When someone changes team you change a membership, not dozens of table grants.'},
{h:'Role attributes at a glance'},
{t:[['Attribute','Default','Meaning'],['`LOGIN` / `NOLOGIN`','NOLOGIN for `CREATE ROLE`','May start a session'],['`SUPERUSER`','No','Bypasses permission checks; can do anything'],['`CREATEDB`','No','May create databases'],['`CREATEROLE`','No','May create and manage roles it has ADMIN rights on (restricted since PostgreSQL 16)'],['`REPLICATION`','No','May start streaming replication connections'],['`BYPASSRLS`','No','Ignores row-level security policies'],['`INHERIT` / `NOINHERIT`','INHERIT','Default for whether memberships pass privileges automatically'],['`CONNECTION LIMIT n`','`-1` (none)','Maximum concurrent sessions for this role'],['`PASSWORD`, `VALID UNTIL`','none','Credential and its expiry']]},
{p:'Each attribute is explained with examples in "User Creation". Attributes are **not inherited** through membership: being a member of a `CREATEDB` role does not let you create databases; you must have the attribute yourself.'},
{h:'Layers of access control (defence in depth)'},
{t:[['Layer','Controlled by','Question it answers'],['Network','Firewall, `listen_addresses`, `port`','Can the client reach the server?'],['Host-based authentication','`pg_hba.conf`','Is this client, user and database combination allowed to try?'],['Authentication','scram-sha-256, peer, cert, ...','Is the user really who they claim?'],['Role state','`LOGIN`, `VALID UNTIL`, connection limits','Is the account usable now?'],['Database','`CONNECT` privilege','May this role enter this database?'],['Schema','`USAGE`, `CREATE`','May it see or create objects in this schema?'],['Object','`SELECT`, `INSERT`, `EXECUTE`, ...','What may it do with each object?'],['Row','Row-level security policies','Which rows may it see or change?'],['Audit','Logging, pgAudit','What did it actually do?']]},
{h:'Least-privilege design flow'},
{flow:['List the duties (read, write, migrate, monitor)','Create NOLOGIN group role per duty','GRANT privileges to groups','Create login roles per person or app','GRANT groups to logins','Review with \\du and \\dp']},
{h:'First commands to know'},
{code:`-- list roles (psql)
\\du
\\du+                                  -- with descriptions

-- list roles with SQL
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin, rolconnlimit, rolvaliduntil
FROM pg_roles WHERE rolname !~ '^pg_' ORDER BY rolname;

-- who am I?
SELECT session_user, current_user;      -- differ after SET ROLE
SELECT pg_has_role('alice', 'app_read', 'MEMBER');

-- membership relations
SELECT r.rolname AS "group", m.rolname AS member, am.admin_option, am.inherit_option, am.set_option
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.roleid
JOIN pg_roles m ON m.oid = am.member;`},
{note:'`session_user` is the role that logged in; `current_user` is the role whose privileges apply right now. They differ after `SET ROLE`, which matters for the NOINHERIT model later in this section.'},
{h:'Common mistakes this section avoids'},
{ul:['Using the `postgres` superuser for applications.','Granting privileges directly to individuals instead of group roles.','Leaving the default `PUBLIC` privileges untouched on production databases.','Letting application roles own the tables they query, so a SQL injection can drop them.']}],
src:[['Database Roles',D+'user-manag.html'],['Role Attributes',D+'role-attributes.html'],['Role Membership',D+'role-membership.html'],['pg_roles view',D+'view-pg-roles.html']]},

/* ---------------------------------------------------------------- 6:1 */
'pg:6:1':{blocks:[
{p:'Two separate questions guard every session. **Authentication** asks "who are you?" and is decided by the **`pg_hba.conf`** file and the chosen method (password, certificate, OS identity...). **Authorization** asks "what are you allowed to do?" and is decided by role attributes, memberships and privileges stored in the catalogs. The documentation (Chapter "Client Authentication") describes `pg_hba.conf` as the file that controls client authentication: "HBA" stands for **host-based authentication**.'},
{h:'The path of a connection'},
{svg:authSvg},
{t:[['Step','Where decided','Failure message (typical)'],['1. Rule match','`pg_hba.conf`: type, database, user, address','`no pg_hba.conf entry for host "10.0.0.5", user "app", database "sales"`'],['2. Method','The method column of the matched rule','`password authentication failed for user "app"`'],['3. Role state','`rolcanlogin`, `rolvaliduntil`, `rolconnlimit`','`role "app" is not permitted to log in`; `too many connections for role "app"`'],['4. Database access','`CONNECT` privilege on the database','`permission denied for database "sales"`'],['5. Object access','Schema, table, function privileges','`permission denied for table orders`'],['6. Row access','Row-level security policies','No error: rows are simply not visible']]},
{h:'pg_hba.conf record format'},
{t:[['Field','Allowed values'],['Type','`local` (Unix socket), `host` (TCP, with or without TLS), `hostssl` (TLS only), `hostnossl`, `hostgssenc`, `hostnogssenc`'],['Database','`all`, a database name, `sameuser`, `samerole`, `replication`, comma list, or `@file`'],['User','`all`, a role name, `+groupname` (members of a role), comma list, or `@file`'],['Address','IP with mask (`10.0.0.0/24`), `samehost`, `samenet`, or a host name (not for `local`)'],['Method','See the table below'],['Options','`name=value` pairs such as `map=`, `clientcert=verify-full`']]},
{note:'The server reads rules **top to bottom and uses the first record that matches**. There is no fall-through: if that record fails authentication, the connection is refused even if a later record would have accepted it. Put specific rules before general ones and finish with a `reject`.'},
{h:'Authentication methods'},
{t:[['Method','How it works','Notes'],['`trust`','Accept without any check','Only for tightly controlled local testing. Never on a network'],['`reject`','Always refuse','Use to block ranges or as a final catch-all'],['`scram-sha-256`','Challenge-response with salted, iterated hashing; password never sent in clear','**Recommended** password method. Default for `password_encryption` since PostgreSQL 14'],['`md5`','Older challenge-response','**Deprecated** in PostgreSQL 18; replace with SCRAM'],['`password`','Clear text over the connection','Avoid; only safe inside TLS'],['`peer`','Takes the OS user name from the kernel and checks it matches the database role','Local sockets only; no password needed'],['`ident`','Asks an ident server for the OS user','TCP; rarely used, trust-dependent'],['`cert`','TLS client certificate; role name from certificate CN','Strong; needs a CA and `hostssl`'],['`gss`, `sspi`','Kerberos / Windows integrated sign-on','Enterprise single sign-on'],['`ldap`, `radius`, `pam`, `bsd`','Delegate to an external service','Central directory or MFA'],['`oauth`','OAuth 2.0 bearer tokens validated by a configured validator','New in PostgreSQL 18']]},
{h:'A sensible pg_hba.conf'},
{code:`# TYPE    DATABASE     USER          ADDRESS          METHOD
local     all          postgres                       peer
local     all          all                            scram-sha-256
host      all          all           127.0.0.1/32     scram-sha-256
host      all          all           ::1/128          scram-sha-256
# application servers, TLS required
hostssl   sales        app_user      10.0.1.0/24      scram-sha-256
# DBAs from the admin network only
hostssl   all          +dba          10.0.9.0/24      scram-sha-256
# standby server for streaming replication
hostssl   replication  replicator    10.0.2.15/32     scram-sha-256
# everything else is refused
host      all          all           0.0.0.0/0        reject
host      all          all           ::/0             reject`},
{h:'Applying and checking changes'},
{flow:['Edit pg_hba.conf','Check pg_hba_file_rules for errors','Reload (no restart)','Test from the client','Watch the log']},
{code:`-- parsed view of the file; error column shows syntax problems
SELECT line_number, type, database, user_name, address, auth_method, error
FROM pg_hba_file_rules ORDER BY line_number;

SELECT pg_reload_conf();            -- or: pg_ctl reload / systemctl reload postgresql-18`},
{ul:['A **syntax error** in `pg_hba.conf` makes the reload fail and the old rules stay active, so always check `pg_hba_file_rules` first.','Existing sessions are not affected by a reload; only new connections use the new rules.','Keep a way in: before tightening rules, test from a second session so you cannot lock yourself out.']},
{h:'User name maps (pg_ident.conf)'},
{p:'`peer`, `ident`, `gss`, `cert` and similar methods give the server an **external** user name. A map in `pg_ident.conf` translates it to a database role. Select it with `map=` in the `pg_hba.conf` record.'},
{code:`# pg_ident.conf   MAPNAME   SYSTEM-USERNAME   DATABASE-USERNAME
osmap             deploy     app_user
osmap             alice      alice

# pg_hba.conf
local   sales   all   peer map=osmap`},
{h:'Authentication versus authorization: worked example'},
{t:[['Scenario','Authentication','Authorization'],['`app_user` connects from `10.0.1.7` to `sales` with the correct password','Rule `hostssl sales app_user 10.0.1.0/24 scram-sha-256` matches and the password verifies','Allowed only if `app_user` (or its groups) has `CONNECT`, schema `USAGE` and table privileges'],['Same user connects from `10.0.7.7`','No matching rule except `reject`: refused before any password is asked','Never reached'],['`alice` logs in correctly but runs `SELECT * FROM payroll`','Succeeds','`ERROR: permission denied for table payroll`']]},
{note:'Authentication proves identity; it grants nothing. A freshly created login role with a valid password can connect to any database that grants `CONNECT` to `PUBLIC` (the default) but can read no tables until you grant privileges.'}],
src:[['Client Authentication',D+'client-authentication.html'],['The pg_hba.conf File',D+'auth-pg-hba-conf.html'],['Authentication Methods',D+'auth-methods.html'],['User Name Maps',D+'auth-username-maps.html'],['pg_hba_file_rules',D+'view-pg-hba-file-rules.html']]},

/* ---------------------------------------------------------------- 6:2 */
'pg:6:2':{blocks:[
{p:'**PUBLIC** is a special, implicitly defined group that always contains **every role**, including roles created in the future. The documentation (Privileges, and the `GRANT` reference) explains that when a privilege is granted to `PUBLIC` it is granted to all roles. `PUBLIC` is not a real role: you cannot create it, alter it, drop it, or see it in `\\du`. It exists only as a possible **grantee** in access control lists. Because new databases, functions and types start with some privileges already given to `PUBLIC`, a freshly installed cluster is more open than most people expect, and hardening it is one of the first DBA security tasks.'},
{h:'What PUBLIC is and is not'},
{t:[['Question','Answer'],['Is it a role?','No. `CREATE ROLE public` fails because the name is reserved. It is a pseudo-role used as a grantee keyword.'],['Does it show in `\\du` or `pg_roles`?','No. It appears in ACLs as an **empty grantee name** (the text before the `=` is blank).'],['Can a role opt out of it?','No. Every role is always a member. The only fix is to `REVOKE` the privilege from `PUBLIC`.'],['Does it include roles created later?','Yes. That is why a grant to `PUBLIC` is permanent exposure for all future accounts.'],['Is it different from `pg_*` predefined roles?','Yes. Predefined roles (next bonus lecture) are real, grantable roles. `PUBLIC` is not.']]},
{h:'Privileges PUBLIC receives by default'},
{p:'The Privileges chapter lists the defaults applied when an object is created and no explicit grants are made. Everything not listed here is private to the owner until granted.'},
{svg:pubSvg},
{t:[['Object type','Default granted to PUBLIC','Consequence'],['Database','`CONNECT` and `TEMPORARY`','Any role that passes authentication can enter every database and create temporary tables in it.'],['Function and procedure','`EXECUTE`','Any role can call any new function (including `SECURITY DEFINER` ones) unless you revoke it.'],['Language','`USAGE`','Any role can write functions in trusted languages such as PL/pgSQL.'],['Data type and domain','`USAGE`','Any role can use any new type in its own tables.'],['Schema `public`','`USAGE` (and `CREATE` only on clusters created before PostgreSQL 15)','See the search_path section below.'],['Table, sequence, tablespace, schema (other than public)','Nothing','Private to the owner. This is the safe default.']]},
{note:'System catalogs such as `pg_class` and `pg_proc` are readable by everyone and this cannot be revoked. Privileges protect **data**, not the existence of objects: any login can list table names and function definitions in a database it can connect to. That is another reason to remove `CONNECT` from `PUBLIC`.'},
{h:'How to read an ACL'},
{p:'Privileges are stored as `aclitem` values with the form `grantee=privileges/grantor`. A blank grantee means `PUBLIC`. An **empty (NULL) ACL column** means the object still has its default privileges, which is not the same as having none.'},
{t:[['Letter','Privilege','Letter','Privilege'],['`r`','SELECT (read)','`X`','EXECUTE'],['`w`','UPDATE (write)','`U`','USAGE'],['`a`','INSERT (append)','`C`','CREATE'],['`d`','DELETE','`c`','CONNECT'],['`D`','TRUNCATE','`T`','TEMPORARY'],['`x`','REFERENCES','`s`','SET (parameter)'],['`t`','TRIGGER','`A`','ALTER SYSTEM (parameter)'],['`m`','MAINTAIN (PostgreSQL 17+)','`*`','Suffix: WITH GRANT OPTION']]},
{code:`-- databases: =Tc/postgres means PUBLIC has TEMPORARY(T) and CONNECT(c), granted by postgres
\\l

-- schemas: on 15+ you see  pg_database_owner=UC/pg_database_owner  and  =U/pg_database_owner  for public
\\dn+

-- functions in a schema
\\df+ public.*

-- the same facts as SQL
SELECT datname, datacl FROM pg_database ORDER BY 1;
SELECT nspname, nspacl FROM pg_namespace WHERE nspname !~ '^(pg_|information_schema)';

-- expand an ACL into rows
SELECT a.grantor::regrole, a.grantee::regrole, a.privilege_type, a.is_grantable
FROM pg_database d, aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) a
WHERE d.datname = 'postgres';      -- grantee 0 (shown as -) is PUBLIC`},
{h:'Why PUBLIC is a security risk'},
{t:[['Exposure','Attack or mistake it enables','Mitigation'],['`CONNECT` to every database','A low-trust account (for example a reporting login) can open a database it was never meant to touch and read catalog metadata.','`REVOKE ALL ON DATABASE ... FROM PUBLIC`, then grant `CONNECT` to group roles'],['`TEMPORARY`','Creating many temporary tables consumes disk and catalog space.','Revoke from `PUBLIC`; grant only to roles that need it'],['`EXECUTE` on new functions','A helper function that was never meant for general use is callable by everyone, which is dangerous for `SECURITY DEFINER` functions.','`ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`'],['`CREATE` on schema `public` (pre-15 clusters)','Any user can plant objects that other users later call by accident (search_path hijack).','`REVOKE CREATE ON SCHEMA public FROM PUBLIC`']]},
{h:'Search_path hijacking'},
{p:'When a query uses an **unqualified name**, PostgreSQL looks through the schemas listed in `search_path`. The default is `"$user", public`: first a schema named after the current role, then `public`. `pg_catalog` is always searched too, but when several functions with the same name exist, the one whose argument types match **exactly** is chosen. If an untrusted user is allowed to create objects in a schema that appears in the path, they can create a function with a closer type match than the built-in one. When a privileged user later runs an unqualified call, the planted function executes **with the caller\'s privileges**. This class of problem was published as CVE-2018-1058 and is the reason for the `PUBLIC` changes in PostgreSQL 15.'},
{svg:dg(700,200,[[10,45,135,60,'Attacker|has CREATE on|schema public',0],[185,45,165,60,'Plants public.upper|(varchar) with a|hidden payload',2],[390,45,145,60,'Superuser runs|SELECT upper(name)|unqualified',0],[575,45,115,60,'Payload runs|as superuser',2],[10,135,680,50,'Defences: remove CREATE from PUBLIC; schema-qualify names (pg_catalog.upper)|SET search_path on functions; keep scripts out of superuser sessions',2]],[[145,75,185,75],[350,75,390,75],[535,75,575,75]])},
{code:`-- ATTACKER (possible when CREATE on public is granted to PUBLIC)
CREATE FUNCTION public.upper(varchar) RETURNS text LANGUAGE sql AS $$
    SELECT 'a real attack would run its payload here, with the caller''s rights'::text $$;

-- LATER, a maintenance script is run by a privileged role; name is varchar.
-- The exact match public.upper(varchar) beats pg_catalog.upper(text).
SELECT upper(name) FROM customers;

-- DEFENCE: always qualify, or pin the search path
SELECT pg_catalog.upper(name) FROM customers;
SET search_path = pg_catalog;      -- for a maintenance session`},
{h:'Secure schema usage patterns (from the documentation)'},
{t:[['Pattern','How','Trade-off'],['Private schema per user','`REVOKE CREATE ON SCHEMA public FROM PUBLIC;` then `CREATE SCHEMA alice AUTHORIZATION alice;` The default `"$user"` path finds it.','Best isolation for multi-user clusters'],['Remove public from the path','`ALTER ROLE ALL SET search_path = "$user";` (or set it in `postgresql.conf`). Users then qualify `public.table` explicitly.','Existing applications may break if they rely on `public`'],['Keep the default and trust everyone','Do nothing special, but only on a cluster where every user is trusted.','Acceptable only for single-tenant or lab systems']]},
{h:'Hardening procedure'},
{flow:['Inspect ACLs with \\l, \\dn+, \\df+','REVOKE database privileges from PUBLIC','REVOKE CREATE on public schema','Change default function privileges','Grant CONNECT to group roles only','Test with a low-privilege login']},
{code:`-- 1. Stop anonymous entry (database ACL is per database, so repeat for every database)
REVOKE ALL ON DATABASE sales FROM PUBLIC;
GRANT  CONNECT ON DATABASE sales TO app_rw, app_ro;

-- 2. Public schema (already default on new 15+ clusters; REQUIRED on clusters upgraded from 14 or older)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- 3. Future functions created by the current role are no longer executable by everybody
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- existing ones (run per schema; skip extension schemas you want left alone)
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- 4. Harden the template so new databases start safe
\\c template1
REVOKE CREATE ON SCHEMA public FROM PUBLIC;`},
{note:'The **database-level** ACL (`CONNECT`, `TEMPORARY`) is not copied from a template, so every new database starts with `PUBLIC` having `CONNECT`. Script the `REVOKE` into your database-creation procedure. Schema and function ACLs **are** copied from the template.'},
{h:'Verify that the lockdown works'},
{code:`-- as an unprivileged role that has not been granted CONNECT
psql -U alice -d sales
-- FATAL:  permission denied for database "sales"
-- DETAIL:  User does not have CONNECT privilege.

-- functions that still carry default (PUBLIC) EXECUTE: proacl IS NULL
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proacl IS NULL AND n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY 1,2;`},
{h:'Summary of good practice'},
{ul:['Treat **PUBLIC** as the broadest group you have and keep it empty on production databases.','Grant access to **named group roles**, never to `PUBLIC`.','Use **schema-qualified** names in scripts, views and functions.','Give every `SECURITY DEFINER` function a fixed `search_path` (covered in the hardening lecture).','Re-check after every major upgrade: `pg_upgrade` keeps the old ACLs, including a permissive `public` schema.']}],
src:[['Privileges',D+'ddl-priv.html'],['Schemas and secure usage patterns',D+'ddl-schemas.html'],['GRANT',D+'sql-grant.html'],['ALTER DEFAULT PRIVILEGES',D+'sql-alterdefaultprivileges.html'],['Release 15 notes (public schema change)','https://www.postgresql.org/docs/release/15.0/'],['A Guide to CVE-2018-1058: Protect Your Search Path','https://wiki.postgresql.org/wiki/A_Guide_to_CVE-2018-1058:_Protect_Your_Search_Path']]},

/* ---------------------------------------------------------------- 6:3 */
'pg:6:3':{blocks:[
{p:'Creating a role is simple; creating it **safely** is the skill. Every attribute you add widens what the account can do, so the rule from the documentation and from security practice is the same: start from nothing (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOLOGIN`) and add only what the duty requires. This lecture covers the full `CREATE ROLE` command, what each attribute means, how passwords and expiry work, connection limits, per-role defaults, and the changes to `CREATEROLE` in PostgreSQL 16.'},
{h:'Full syntax'},
{code:`CREATE ROLE name [ [ WITH ] option [ ... ] ]

option:   SUPERUSER   | NOSUPERUSER
        | CREATEDB    | NOCREATEDB
        | CREATEROLE  | NOCREATEROLE
        | INHERIT     | NOINHERIT
        | LOGIN       | NOLOGIN
        | REPLICATION | NOREPLICATION
        | BYPASSRLS   | NOBYPASSRLS
        | CONNECTION LIMIT connlimit
        | [ ENCRYPTED ] PASSWORD 'password' | PASSWORD NULL
        | VALID UNTIL 'timestamp'
        | IN ROLE role_name [, ...]      -- become a member of these roles now
        | ROLE role_name [, ...]         -- these roles become members of the new one
        | ADMIN role_name [, ...]        -- like ROLE, with ADMIN OPTION

-- shortcuts
CREATE USER  name ...;    -- identical to CREATE ROLE name LOGIN ...
CREATE GROUP name ...;    -- legacy synonym of CREATE ROLE`},
{h:'Attributes, risks and recommendations'},
{t:[['Attribute','What it allows','Risk','Recommendation'],['`SUPERUSER`','Bypasses all permission checks except the right to log in; can read files and run programs through server features','Total compromise of the cluster and often the host','One or two named break-glass accounts; never for applications; never for daily work'],['`CREATEDB`','Create databases and become their owner','Resource sprawl; owner of a database controls it','Only for provisioning roles'],['`CREATEROLE`','Create roles and manage the roles it has `ADMIN` rights on (PostgreSQL 16+)','Before 16 it was close to superuser (could grant itself powerful roles)','Give to a delegated user-administrator role, not to humans in general'],['`REPLICATION`','Open streaming-replication and base-backup connections','Can copy the entire cluster including all data','Dedicated `replicator` role, restricted in `pg_hba.conf` to standby addresses'],['`BYPASSRLS`','Ignores every row-level security policy','Defeats tenant isolation','Only for backup and maintenance roles that must see all rows'],['`LOGIN`','Start a session','Every login role is an attack surface','Set only on accounts used by a person or an application'],['`INHERIT`','Default for new memberships: privileges flow automatically','Privilege creep if used carelessly','Keep default for read roles; use NOINHERIT for powerful roles (see that lecture)'],['`CONNECTION LIMIT`','Cap on concurrent sessions for the role','Runaway application pools can exhaust slots','Set for every application role'],['`VALID UNTIL`','Password stops working at that time','Stale accounts stay usable forever','Use for contractors and temporary accounts']]},
{note:'Role **attributes** (`SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`, `LOGIN`) are never inherited through membership. Privileges on objects are. To use `CREATEDB` through a group you must `SET ROLE` to that group first.'},
{h:'Creation workflow'},
{flow:['Decide the duty and the account type (person, app, service)','Create with the minimum attributes','Set a strong password and expiry','Set a connection limit and role defaults','Add to group roles','Add a pg_hba.conf rule','Test login and permissions']},
{h:'Examples for typical account types'},
{code:`-- A person (DBA) : login, password with expiry, member of the dba group, no superuser
CREATE ROLE alice LOGIN PASSWORD 'Change_Me_1!' VALID UNTIL '2026-12-31' IN ROLE dba;

-- An application : limited sessions, no extra attributes
CREATE ROLE app_user LOGIN PASSWORD 'S3cret_App_Pw' CONNECTION LIMIT 40 IN ROLE app_rw;

-- A read-only reporting login
CREATE ROLE report_user LOGIN CONNECTION LIMIT 10 IN ROLE app_ro;

-- Streaming replication (see the Replication section)
CREATE ROLE replicator LOGIN REPLICATION CONNECTION LIMIT 5 PASSWORD 'Repl_Pw_2026';

-- Monitoring agent using a predefined role instead of superuser
CREATE ROLE exporter LOGIN CONNECTION LIMIT 3 IN ROLE pg_monitor;

-- A group role: cannot log in, holds privileges
CREATE ROLE app_rw NOLOGIN;`},
{h:'Passwords: do not leave them in logs or history'},
{p:'A literal password in `CREATE ROLE ... PASSWORD \'...\'` can appear in the server log (if `log_statement` is `ddl` or higher), in `pg_stat_statements` and in shell history. The server stores only a hash, but the statement text exists before hashing. Prefer the psql meta-command, which asks for the password interactively and hashes it **on the client** using the current `password_encryption` setting.'},
{code:`\\password alice            -- prompts twice, sends an already-hashed value
\\password                  -- change your own password

-- command-line utility: -P prompts for the password, --interactive asks questions
createuser --interactive -P app_user`},
{ul:['`VALID UNTIL \'infinity\'` removes an expiry; a past timestamp locks the password out.','After expiry the client sees only `password authentication failed`; the server log says `User "x" has an expired password`.','A role with no password (`PASSWORD NULL`) cannot use password methods, but still works with `peer`, `cert`, `gss` and similar methods.']},
{h:'Limiting connections at four levels'},
{t:[['Level','Setting','Scope'],['Cluster','`max_connections` (restart)','All sessions'],['Reserve for emergencies','`superuser_reserved_connections` (default 3) and `reserved_connections` (PostgreSQL 16+, used by members of `pg_use_reserved_connections`)','Slots kept free so admins can still log in'],['Database','`ALTER DATABASE sales CONNECTION LIMIT 100;`','Sessions to one database'],['Role','`ALTER ROLE app_user CONNECTION LIMIT 40;`','Sessions by one role']]},
{h:'Per-role defaults with ALTER ROLE ... SET'},
{p:'A role can carry its own defaults for run-time parameters. They are stored in `pg_db_role_setting` and applied **at login**. The most specific setting wins: role-and-database beats role, and role beats database, and all of them beat `postgresql.conf`.'},
{code:`ALTER ROLE app_user SET statement_timeout = '30s';
ALTER ROLE app_user SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE app_user IN DATABASE sales SET search_path = app, pg_catalog;
ALTER ROLE report_user SET default_transaction_read_only = on;

-- review and remove
SELECT r.rolname, d.datname, s.setconfig
FROM pg_db_role_setting s
LEFT JOIN pg_roles r ON r.oid = s.setrole
LEFT JOIN pg_database d ON d.oid = s.setdatabase;
ALTER ROLE app_user RESET statement_timeout;`},
{h:'CREATEROLE after PostgreSQL 16'},
{t:[['Behaviour','Before 16','16 and later (including 18)'],['What CREATEROLE can alter','Any non-superuser role','Only roles on which it holds `ADMIN OPTION`'],['Creator of a role','No special link','Receives `ADMIN OPTION` on the new role automatically'],['Granting powerful attributes','Could create `CREATEDB` roles freely','Cannot give an attribute (such as `REPLICATION` or `BYPASSRLS`) that it does not itself hold'],['Granting itself access','Possible by joining any non-superuser role','Does not get `INHERIT` or `SET` on created roles unless `createrole_self_grant` says so']]},
{h:'Changing and removing roles'},
{code:`ALTER ROLE alice VALID UNTIL '2027-06-30';
ALTER ROLE alice CONNECTION LIMIT 5;
ALTER ROLE alice NOLOGIN;                  -- lock the account but keep ownership and grants
ALTER ROLE alice RENAME TO alice_w;        -- an MD5 password is cleared by a rename (SCRAM is not)
DROP ROLE IF EXISTS alice_w;               -- fails while objects or privileges still reference it`},
{note:'Dropping a role that owns objects or holds privileges fails by design. The safe offboarding sequence (`REASSIGN OWNED`, `DROP OWNED`, `DROP ROLE`) is in the lecture on ownership and default privileges.'},
{h:'Verify and troubleshoot'},
{code:`\\du+ alice
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
       rolconnlimit, rolvaliduntil
FROM pg_roles WHERE rolname = 'alice';

SELECT usename, count(*) FROM pg_stat_activity GROUP BY usename;  -- compare with the limit`},
{t:[['Message','Meaning','Fix'],['`role "x" does not exist`','Wrong name or role created in a different cluster','Check `\\du` and the port'],['`role "x" is not permitted to log in`','Role is `NOLOGIN`','`ALTER ROLE x LOGIN`'],['`password authentication failed for user "x"`','Wrong or expired password, or the method in `pg_hba.conf` needs a different credential type','Reset password; read the log DETAIL line'],['`too many connections for role "x"`','Role connection limit reached','Raise limit or fix the application pool'],['`permission denied to create role`','Caller lacks `CREATEROLE`','Use a role that has it, or a superuser']]}],
src:[['CREATE ROLE',D+'sql-createrole.html'],['ALTER ROLE',D+'sql-alterrole.html'],['Role Attributes',D+'role-attributes.html'],['Database Roles',D+'user-manag.html'],['createuser',D+'app-createuser.html'],['pg_db_role_setting',D+'catalog-pg-db-role-setting.html']]},

/* ---------------------------------------------------------------- 6:4 */
'pg:6:4':{blocks:[
{p:'`GRANT` and `REVOKE` are the two commands that implement authorization. The documentation (Privileges) describes the model: every object has an **owner**; the owner can do anything with it and decides which other roles receive which privileges. A privilege is a right to perform one kind of action on one kind of object. `GRANT` has two forms: granting **privileges on objects** to roles, and granting **membership in a role** to another role. Both are covered here.'},
{h:'Privileges by object type'},
{t:[['Object','Privileges that can be granted','Notes'],['Database','`CONNECT`, `CREATE` (schemas), `TEMPORARY`','`CONNECT` and `TEMPORARY` default to PUBLIC'],['Schema','`USAGE`, `CREATE`','Without `USAGE` the objects inside cannot be reached at all'],['Table / view','`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN` (17+)','`UPDATE` and `DELETE` with a `WHERE` clause also need `SELECT`'],['Column','`SELECT`, `INSERT`, `UPDATE`, `REFERENCES`','Granted per column: `GRANT SELECT (col1, col2) ON t TO r`'],['Sequence','`USAGE`, `SELECT`, `UPDATE`','`nextval` needs `USAGE` or `UPDATE`; `currval` needs `USAGE` or `SELECT`'],['Function / procedure','`EXECUTE`','Defaults to PUBLIC'],['Tablespace','`CREATE`','Allows creating objects in it'],['Type, domain, language, FDW, foreign server','`USAGE`',''],['Large object','`SELECT`, `UPDATE`',''],['Configuration parameter','`SET`, `ALTER SYSTEM`','`GRANT SET ON PARAMETER log_statement TO auditor;` (PostgreSQL 15+)']]},
{h:'Privileges needed for one simple query'},
{flow:['CONNECT on the database','USAGE on the schema','SELECT on the table (or on each column used)','Row-level security policy allows the rows']},
{p:'A missing privilege at any step produces a different error. This is the first thing to check when a user reports `permission denied`.'},
{h:'GRANT on objects'},
{code:`GRANT SELECT ON TABLE app.orders TO app_ro;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO app_rw;   -- existing tables only
GRANT USAGE ON SCHEMA app TO app_ro, app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO app_rw;
GRANT EXECUTE ON FUNCTION app.close_order(bigint) TO app_rw;
GRANT CONNECT ON DATABASE sales TO app_ro, app_rw;
GRANT SELECT (order_id, status) ON app.orders TO support;                      -- column level
GRANT SELECT ON app.orders TO app_ro WITH GRANT OPTION;                         -- may pass it on
GRANT ALL PRIVILEGES ON SCHEMA app TO app_owner;`},
{ul:['`ON ALL TABLES IN SCHEMA` covers tables, views, materialized views and foreign tables that **exist now**. Objects created later need `ALTER DEFAULT PRIVILEGES` (next bonus lecture).','**serial** columns call `nextval` as the inserting role, so that role needs sequence privileges. **Identity** columns (`GENERATED ... AS IDENTITY`) do not.','`GRANT ... TO PUBLIC` gives the privilege to everyone, current and future. Avoid it outside of deliberate, documented cases.','Only the owner (or a role that is a member of the owner, or a superuser) can grant privileges on an object. Others can re-grant only if they hold `WITH GRANT OPTION`.']},
{h:'GRANT a role (membership)'},
{code:`GRANT app_ro TO alice;                                  -- alice becomes a member
GRANT app_rw TO app_user;
GRANT dba    TO alice WITH ADMIN OPTION;                -- alice may grant/revoke dba to others
GRANT migrator TO bob WITH INHERIT FALSE, SET TRUE;     -- PostgreSQL 16+: control how membership behaves
REVOKE app_ro FROM alice;`},
{t:[['Membership option (16+)','Meaning'],['`ADMIN`','The member can grant and revoke this role to others'],['`INHERIT`','The member automatically uses the role\'s privileges'],['`SET`','The member may `SET ROLE` to it']]},
{h:'REVOKE'},
{code:`REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app FROM app_ro;
REVOKE ALL PRIVILEGES ON DATABASE sales FROM PUBLIC;
REVOKE GRANT OPTION FOR SELECT ON app.orders FROM app_ro;     -- keep privilege, remove the right to pass it on
REVOKE SELECT ON app.orders FROM bob CASCADE;                 -- also removes what bob granted to others`},
{svg:dg(700,190,[[10,60,120,55,'owner|app_owner',0],[190,60,150,55,'bob|WITH GRANT OPTION',2],[400,60,130,55,'carol|granted by bob',0],[550,25,140,50,'REVOKE ... FROM bob|CASCADE',2],[550,110,140,50,'carol loses the|privilege too',0]],[[130,87,190,87],[340,87,400,87],[620,75,620,110]])},
{h:'Why a REVOKE seems to have no effect'},
{t:[['Symptom','Real cause','Check'],['User still reads the table after `REVOKE SELECT ... FROM alice`','The privilege also comes from **PUBLIC** or from a **group role** alice belongs to','`\\dp app.orders` shows `=r/...` for PUBLIC; `SELECT pg_has_role(\'alice\',\'app_ro\',\'USAGE\')`'],['Revoke ran but nothing changed','The grant was made by a **different grantor**. `REVOKE` removes only grants made by the current role (or a role it can act as).','Run as the owner, or `REVOKE ... GRANTED BY owner`'],['Owner lost access after `REVOKE ALL`','The owner can revoke its own privileges','`GRANT ALL ON ... TO owner`'],['Revoked on the table but column still readable','A separate column-level grant exists','`\\dp` column privileges section; `has_column_privilege`']]},
{h:'Role-based model: read-only and read-write'},
{svg:dg(700,200,[[10,15,180,170,'Login roles',1],[25,45,150,40,'report_user',0],[25,105,150,40,'app_user',0],[260,15,180,170,'Group roles (NOLOGIN)',1],[275,45,150,40,'app_ro|SELECT',2],[275,105,150,40,'app_rw|app_ro + DML',2],[500,15,190,170,'Objects in schema app',1],[515,45,160,40,'tables:|SELECT',0],[515,105,160,40,'tables:|INSERT UPDATE DELETE',0]],[[175,65,275,65],[175,125,275,125],[425,65,515,65],[425,125,515,125]])},
{code:`-- groups hold privileges
CREATE ROLE app_ro NOLOGIN;
CREATE ROLE app_rw NOLOGIN IN ROLE app_ro;      -- app_rw inherits everything app_ro has

GRANT CONNECT ON DATABASE sales TO app_ro;
GRANT USAGE   ON SCHEMA app TO app_ro;
GRANT SELECT  ON ALL TABLES IN SCHEMA app TO app_ro;

GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO app_rw;

-- people and applications are members
CREATE ROLE report_user LOGIN IN ROLE app_ro;
CREATE ROLE app_user    LOGIN IN ROLE app_rw;`},
{h:'Inspecting and testing privileges'},
{code:`\\dp app.*                                   -- table privileges, ACL strings like app_ro=r/app_owner
\\ddp                                        -- default privileges (next lecture)

SELECT has_table_privilege('report_user','app.orders','SELECT');   -- true
SELECT has_table_privilege('report_user','app.orders','INSERT');   -- false
SELECT has_schema_privilege('report_user','app','USAGE');
SELECT has_database_privilege('report_user','sales','CONNECT');
SELECT has_column_privilege('support','app.orders','status','SELECT');
SELECT has_function_privilege('app_user','app.close_order(bigint)','EXECUTE');

-- every table privilege, including those from PUBLIC
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.table_privileges WHERE table_schema = 'app' ORDER BY 1,3;

-- try it as the user
SET ROLE report_user;  SELECT count(*) FROM app.orders;  DELETE FROM app.orders;  RESET ROLE;
-- ERROR:  permission denied for table orders`},
{t:[['Error','Missing privilege'],['`permission denied for database "d"`','`CONNECT` on the database'],['`permission denied for schema app`','`USAGE` on the schema'],['`permission denied for table orders`','Table or column privilege (or the column list of `SELECT *`)'],['`permission denied for sequence orders_id_seq`','`USAGE` on the sequence (serial column)'],['`permission denied for function f`','`EXECUTE` on the function'],['`must be owner of table orders`','`ALTER`, `DROP`, `COMMENT`, `GRANT` need ownership; they are not grantable privileges'],['`permission denied to set parameter "x"`','`GRANT SET ON PARAMETER x`']]},
{note:'Grant privileges to **group roles**, grant groups to **login roles**, and let each person be a member of few groups. Direct grants to individual users are the most common reason that privilege audits become impossible.'}],
src:[['Privileges',D+'ddl-priv.html'],['GRANT',D+'sql-grant.html'],['REVOKE',D+'sql-revoke.html'],['Role Membership',D+'role-membership.html'],['Privilege inquiry functions',D+'functions-info.html#FUNCTIONS-INFO-ACCESS-TABLE'],['information_schema.table_privileges',D+'infoschema-table-privileges.html']]},

/* ---------------------------------------------------------------- 6:5 */
'pg:6:5':{blocks:[
{p:'Membership in a role can work in two different ways. With **INHERIT**, the member automatically holds every privilege of the role, exactly as if it had been granted directly. With **NOINHERIT**, the member holds **nothing** from the role until it explicitly runs `SET ROLE` to become that role. The documentation (Role Membership) calls out this choice as the way to separate everyday access from powerful access. Since PostgreSQL 16 the behaviour is a property of **each membership grant** (the `INHERIT` and `SET` options), and the `INHERIT`/`NOINHERIT` role attribute only sets the default for future grants.'},
{svg:inhSvg},
{h:'Two ways a role can use another role'},
{t:[['','Automatic (INHERIT)','Explicit (SET ROLE)'],['How','Privileges are combined with your own','You switch identity; your own privileges are no longer in effect'],['Needs','Membership with `INHERIT TRUE`','Membership with `SET TRUE`'],['Typical use','Read access, reporting, application groups','Schema changes, ownership, break-glass access'],['Audit trail','Hard to see which privilege was used','`current_user` changes, clearly visible in logs and pgAudit'],['Attributes (`CREATEDB`, `LOGIN`)','Not inherited','Not inherited, but `SET ROLE` to a role that has them makes you that role']]},
{h:'PostgreSQL 16 changes'},
{t:[['Topic','Before 16','16 and later'],['Where behaviour is set','`INHERIT` / `NOINHERIT` attribute of the **member** role, for all its memberships','`INHERIT` and `SET` options on **each** `GRANT role TO member`'],['Role attribute','Controls every membership','Default for memberships granted afterwards'],['`SET ROLE` permission','Any member could switch','Only if the grant has `SET TRUE`'],['Visibility','`pg_auth_members` had `admin_option`','Also `inherit_option` and `set_option`']]},
{code:`-- default for new grants comes from the role attribute
CREATE ROLE bob LOGIN NOINHERIT;

-- explicit per-grant control (16+)
GRANT dev_read TO alice WITH INHERIT TRUE,  SET FALSE;   -- automatic reading, cannot become dev_read
GRANT migrator TO bob   WITH INHERIT FALSE, SET TRUE;    -- must SET ROLE; nothing automatic

-- change an existing grant
GRANT migrator TO bob WITH INHERIT FALSE;`},
{h:'Enterprise pattern: separate duties'},
{p:'The goal is that **nobody can accidentally change the schema** while doing normal work. Developers read data every day (inherited) but make structural changes only after deliberately switching to the migration role.'},
{t:[['Role','Type','Holds'],['`migrator`','NOLOGIN','Owns the schema and every object in it. Nobody logs in as it directly.'],['`dev_read`','NOLOGIN','`USAGE` on schema, `SELECT` on tables'],['`alice`','LOGIN, INHERIT','Member of `dev_read`; reads data automatically'],['`bob`','LOGIN, NOINHERIT for migrator','Member of `dev_read` (INHERIT) and `migrator` (SET only)']]},
{code:`CREATE ROLE migrator NOLOGIN;                         -- owner of the schema and its objects
CREATE ROLE dev_read NOLOGIN;

CREATE SCHEMA app AUTHORIZATION migrator;
GRANT USAGE ON SCHEMA app TO dev_read;
-- tables that migrator creates later are readable by dev_read automatically
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA app GRANT SELECT ON TABLES TO dev_read;

CREATE ROLE alice LOGIN;
CREATE ROLE bob   LOGIN;
GRANT dev_read TO alice, bob;                         -- automatic read access for both
GRANT migrator TO bob WITH INHERIT FALSE, SET TRUE;   -- only bob, only when he asks for it`},
{h:'Using SET ROLE'},
{flow:['bob connects as bob','Normal work: SELECT only (via dev_read)','Change needed: SET ROLE migrator','Run DDL as the owner','RESET ROLE (back to bob)']},
{code:`-- session as bob
CREATE TABLE app.t1(id int);        -- ERROR:  permission denied for schema app

SET ROLE migrator;
SELECT session_user, current_user;  -- bob | migrator
CREATE TABLE app.t1(id int);        -- works; the new table is owned by migrator
RESET ROLE;                         -- or SET ROLE NONE

-- alice never could
SET ROLE migrator;                  -- ERROR:  permission denied to set role "migrator"`},
{note:'`session_user` is the identity that logged in and never changes (except with `SET SESSION AUTHORIZATION`, superuser only). `current_user` is the identity whose privileges are checked **now** and changes with `SET ROLE`. Log lines show `session_user`; pgAudit records both, which is how you can tell who really did a change.'},
{h:'Inspecting the effective privileges'},
{code:`-- three kinds of role test
SELECT pg_has_role('alice','dev_read','USAGE');   -- true : alice uses dev_read privileges
SELECT pg_has_role('alice','dev_read','MEMBER');  -- true : alice is a member (direct or indirect)
SELECT pg_has_role('alice','dev_read','SET');     -- false: alice cannot SET ROLE dev_read

SELECT r.rolname AS role, m.rolname AS member, g.rolname AS grantor,
       am.admin_option, am.inherit_option, am.set_option
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.roleid
JOIN pg_roles m ON m.oid = am.member
JOIN pg_roles g ON g.oid = am.grantor
ORDER BY 1,2;`},
{t:[['pg_has_role mode','Question answered'],['`USAGE`','Does the role use (inherit) the privileges of the other role?'],['`MEMBER`','Is it a member at all, ignoring inherit?'],['`SET`','May it `SET ROLE` to it?']]},
{h:'Rules and limits'},
{ul:['Privileges are inherited **through chains**: if `alice` inherits `dev_read` and `dev_read` inherits `base_read`, alice gets both.','**Membership loops** are not allowed. `GRANT a TO b` fails if `b` already contains `a`.','A superuser, `CREATEDB`, `CREATEROLE`, `REPLICATION` and `LOGIN` are **attributes**, never inherited.','Ownership matters: to `ALTER` or `DROP` an object you must act as its owner (`SET ROLE`) or hold the owner role with `INHERIT`. Making the owner a NOLOGIN role that only `SET`-capable members can become is the safest design.','Do not set `NOINHERIT` on application roles. It is meant for **people** who hold powerful roles.']},
{t:[['Mistake','Result','Better'],['Granting `migrator` to every developer with `INHERIT`','Everyone can drop tables silently','`WITH INHERIT FALSE, SET TRUE`, only to those who deploy'],['One shared superuser for deployments','No individual accountability','Named logins plus `SET ROLE migrator`'],['Tables owned by the application login','SQL injection can `DROP` them','Owner is a NOLOGIN role; application only has DML']]}],
src:[['Role Membership',D+'role-membership.html'],['GRANT (role membership options)',D+'sql-grant.html'],['SET ROLE',D+'sql-set-role.html'],['pg_auth_members',D+'catalog-pg-auth-members.html'],['Release 16 notes (role membership changes)','https://www.postgresql.org/docs/release/16.0/']]},

/* ---------------------------------------------------------------- 6:6 */
'pg:6:6':{blocks:[
{p:'Normal privileges work at the level of a whole table or column. **Row-level security (RLS)** adds a finer layer: it decides **which rows** a role may see or change. The documentation (Row Security Policies) explains that once RLS is enabled on a table, every normal access must be allowed by a **policy**; if no policy exists, a **default-deny** policy applies and no rows are visible or changeable. RLS is the standard PostgreSQL tool for multi-tenant designs where many customers share the same tables.'},
{svg:rlsSvg},
{h:'Enabling RLS and creating policies'},
{flow:['Table privileges granted (GRANT SELECT ...)','ALTER TABLE ... ENABLE ROW LEVEL SECURITY','CREATE POLICY with USING / WITH CHECK','Set the tenant context in the session','Test as the application role']},
{code:`CREATE POLICY name ON table_name
    [ AS { PERMISSIVE | RESTRICTIVE } ]
    [ FOR { ALL | SELECT | INSERT | UPDATE | DELETE } ]
    [ TO { role_name | PUBLIC | CURRENT_USER | SESSION_USER } [, ...] ]
    [ USING ( using_expression ) ]
    [ WITH CHECK ( check_expression ) ];

ALTER TABLE tbl ENABLE  ROW LEVEL SECURITY;
ALTER TABLE tbl DISABLE ROW LEVEL SECURITY;
ALTER TABLE tbl FORCE   ROW LEVEL SECURITY;     -- apply policies to the table owner as well
ALTER POLICY name ON tbl USING (...);
DROP  POLICY name ON tbl;`},
{h:'USING versus WITH CHECK'},
{t:[['Clause','Applies to','Meaning'],['`USING`','Rows that **already exist** (read, update target, delete target)','A row that fails the expression is invisible and cannot be touched'],['`WITH CHECK`','Rows being **created or changed** (`INSERT`, new version in `UPDATE`)','A row that fails the expression raises an error and is rejected']]},
{t:[['Command','USING used?','WITH CHECK used?'],['`SELECT`','Yes','No'],['`INSERT`','No','Yes'],['`UPDATE`','Yes (which rows can be updated)','Yes (what the new row may look like)'],['`DELETE`','Yes','No'],['`ALL`','Yes','Yes (falls back to `USING` if `WITH CHECK` is omitted)']]},
{h:'Worked example: tenant isolation by session variable'},
{code:`CREATE SCHEMA app AUTHORIZATION migrator;
CREATE TABLE app.orders (
    order_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company  text          NOT NULL,
    item     text          NOT NULL,
    amount   numeric(12,2) NOT NULL
);
INSERT INTO app.orders(company,item,amount) VALUES
  ('acme','Anvil',120),('acme','Rope',15),('globex','Drill',300),('globex','Saw',80);

GRANT USAGE ON SCHEMA app TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.orders TO app_rw;

ALTER TABLE app.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.orders
    FOR ALL TO app_rw
    USING      (company = current_setting('app.current_company', true))
    WITH CHECK (company = current_setting('app.current_company', true));`},
{p:'`current_setting(name, true)` returns NULL (or an empty string after a `RESET`) when the variable is unset, so the comparison matches **no row**: an application that forgets to set the tenant sees nothing instead of everything. This is **fail-closed** behaviour, which is what you want.'},
{code:`-- connect as app_user (member of app_rw)
SELECT count(*) FROM app.orders;                   -- 0 : no tenant set, nothing visible

SET app.current_company = 'acme';
SELECT order_id, item, amount FROM app.orders;     -- only the two acme rows

INSERT INTO app.orders(company,item,amount) VALUES ('acme','Hammer',25);    -- ok
INSERT INTO app.orders(company,item,amount) VALUES ('globex','Saw',1);
-- ERROR:  new row violates row-level security policy for table "orders"

UPDATE app.orders SET company = 'globex' WHERE item = 'Rope';
-- ERROR:  new row violates row-level security policy ... (WITH CHECK stops moving a row to another tenant)

DELETE FROM app.orders WHERE company = 'globex';   -- DELETE 0 : those rows are invisible`},
{h:'Who is NOT subject to RLS'},
{t:[['Role','Subject to policies?','Notes'],['Superuser','No','Always bypasses'],['Role with `BYPASSRLS`','No','Give to backup and maintenance roles only'],['Table owner','No, **unless** `FORCE ROW LEVEL SECURITY`','Use `FORCE` when the owner role can also log in or run application SQL'],['Everyone else','Yes','Including members of `pg_read_all_data` unless they also hold `BYPASSRLS`']]},
{h:'Several policies on one table'},
{t:[['Type','How combined','Use'],['`PERMISSIVE` (default)','Policies are joined with **OR**: a row is allowed if any permissive policy allows it','Add separate rules, for example "own rows" and "manager sees team rows"'],['`RESTRICTIVE`','Joined with **AND** to the permissive result: every restrictive policy must also pass','Mandatory rules, for example "never show rows flagged as legal hold"']]},
{code:`-- permissive: staff see their own rows OR rows of their department
CREATE POLICY own_rows  ON hr.reviews FOR SELECT TO staff USING (employee = current_user);
CREATE POLICY dept_rows ON hr.reviews FOR SELECT TO managers
    USING (dept = current_setting('app.dept', true));

-- restrictive: applies on top of everything above
CREATE POLICY not_sealed ON hr.reviews AS RESTRICTIVE FOR SELECT TO PUBLIC USING (NOT sealed);`},
{h:'A second pattern: policy on the database role'},
{p:'When each person has their own login, use `current_user` instead of a session variable. This cannot be bypassed by the user changing a setting.'},
{code:`CREATE POLICY mine ON app.tickets FOR ALL TO PUBLIC
    USING (owner_role = current_user) WITH CHECK (owner_role = current_user);`},
{note:'A session variable such as `app.current_company` is **trusted input from the application**. Any role that can run arbitrary SQL can simply `SET app.current_company = \'globex\'`. Use it only when the application is the sole SQL client, and keep application roles from running ad-hoc SQL. For direct database users, base policies on `current_user` or `pg_has_role`.'},
{h:'Connection pooling and the session variable'},
{ul:['With **session pooling** the variable lives for the connection; always set it at checkout and clear it at release.','With **transaction pooling** the next transaction can run on a different connection. Set the value inside the transaction with `SET LOCAL` or `SELECT set_config(\'app.current_company\', \'acme\', true)`; the value then disappears automatically at `COMMIT` or `ROLLBACK`.','Forgetting to reset is the classic cross-tenant leak. The fail-closed policy above limits the damage only if the variable is cleared.']},
{code:`BEGIN;
SELECT set_config('app.current_company', 'acme', true);   -- true = local to this transaction
SELECT * FROM app.orders;
COMMIT;                                                     -- setting is gone`},
{h:'Things RLS does not cover'},
{ul:['**Views** run with the privileges of the view owner, which can bypass RLS on the underlying tables. Create views with `WITH (security_invoker = true)` (PostgreSQL 15+) so policies apply to the caller.','**Foreign key and unique checks** bypass RLS internally, so error messages can reveal that a hidden row exists (a covert channel). Design keys accordingly.','**Functions** that are not marked `LEAKPROOF` may be evaluated after the policy filter to avoid leaking hidden rows through error messages; this can influence plans.','`pg_dump` sets `row_security = off` and **fails** if a policy would filter rows, so a backup never silently loses data. Use a role with `BYPASSRLS` for backups, or `--enable-row-security` when a filtered dump is intended.']},
{h:'Performance'},
{ul:['The policy expression is added to **every** query on the table; index the filtered column (here `company`).','Keep expressions simple and stable. `(SELECT current_setting(\'app.current_company\', true))` evaluates the setting once per query instead of once per row.','Check plans with `EXPLAIN`; the policy appears as an added filter or index condition.']},
{h:'Inspecting policies'},
{code:`\\d+ app.orders                                       -- lists policies at the bottom
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies;
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'orders';
SHOW row_security;                                    -- on by default
SELECT rolname FROM pg_roles WHERE rolbypassrls;      -- who ignores policies`}],
src:[['Row Security Policies',D+'ddl-rowsecurity.html'],['CREATE POLICY',D+'sql-createpolicy.html'],['ALTER TABLE (ENABLE / FORCE ROW LEVEL SECURITY)',D+'sql-altertable.html'],['pg_policies view',D+'view-pg-policies.html'],['Server Configuration: row_security',D+'runtime-config-client.html']]},

/* ---------------------------------------------------------------- 6:7 */
'pg:6:7':{blocks:[
{p:'Granting `SUPERUSER` to solve a narrow problem (monitoring, reporting, killing a stuck query) is the most common security mistake in PostgreSQL. The documentation (Predefined Roles) provides a set of **ready-made roles** whose names start with `pg_`. They give access to specific privileged capabilities, so a task can be delegated with a single `GRANT` and **no superuser account**. Administrators, including roles with `CREATEROLE`, can grant them like any other role. The documentation also warns that their exact permissions may grow in future releases, so review them after upgrades.'},
{svg:dg(700,200,[[250,15,200,50,'pg_monitor',2],[30,120,190,50,'pg_read_all_settings',0],[255,120,190,50,'pg_read_all_stats',0],[480,120,190,50,'pg_stat_scan_tables',0]],[[330,65,125,120],[350,65,350,120],[370,65,575,120]])},
{h:'The predefined roles'},
{t:[['Role','What it allows','Since'],['`pg_read_all_data`','`SELECT` on all tables, views and sequences and `USAGE` on all schemas. Does **not** include `BYPASSRLS`.','14'],['`pg_write_all_data`','Write all data (tables, views, sequences) as if holding `INSERT`, `UPDATE` and `DELETE`, plus `USAGE` on all schemas. Does not include `BYPASSRLS`.','14'],['`pg_read_all_settings`','Read all configuration parameters, including those normally visible only to superusers','10'],['`pg_read_all_stats`','Read all `pg_stat_*` views and use statistics extension functions, including superuser-only details such as other users\' query text','10'],['`pg_stat_scan_tables`','Run monitoring functions that may take `ACCESS SHARE` locks on tables for a long time','10'],['`pg_monitor`','Read and execute monitoring views and functions. It is a member of the three roles above.','10'],['`pg_signal_backend`','Send `pg_cancel_backend` and `pg_terminate_backend` to sessions of **non-superuser** roles','9.6'],['`pg_signal_autovacuum_worker`','Signal autovacuum workers to cancel the current table vacuum or terminate the session','18'],['`pg_read_server_files`','Read files on the server with `COPY ... FROM`, file functions and file foreign tables','11'],['`pg_write_server_files`','Write files on the server with `COPY ... TO`','11'],['`pg_execute_server_program`','Run programs on the server through `COPY ... PROGRAM`, as the OS user running PostgreSQL','11'],['`pg_checkpoint`','Run the `CHECKPOINT` command','15'],['`pg_maintain`','`VACUUM`, `ANALYZE`, `CLUSTER`, `REFRESH MATERIALIZED VIEW`, `REINDEX`, `LOCK TABLE` on all relations','17'],['`pg_use_reserved_connections`','Use connection slots set aside by `reserved_connections`','16'],['`pg_create_subscription`','`CREATE SUBSCRIPTION` for logical replication (with other required rights)','16'],['`pg_database_owner`','Implicit role that has exactly one member: the **owner of the current database**. Cannot have explicit members. Owns the `public` schema from PostgreSQL 15.','14']]},
{note:'The names beginning `pg_` are reserved. You cannot create your own role with such a name, and the server refuses it. Run `SELECT rolname FROM pg_roles WHERE rolname ~ \'^pg_\';` to see what your version provides.'},
{h:'Risk classification'},
{t:[['Risk level','Roles','Why'],['Low (information)','`pg_read_all_settings`, `pg_read_all_stats`, `pg_stat_scan_tables`, `pg_monitor`','Read-only metadata; but query text in statistics can contain sensitive values'],['Medium (data)','`pg_read_all_data`, `pg_write_all_data`','Cluster-wide data access without per-table grants. RLS still applies unless `BYPASSRLS` is also set'],['Medium (operations)','`pg_signal_backend`, `pg_signal_autovacuum_worker`, `pg_checkpoint`, `pg_maintain`, `pg_use_reserved_connections`','Can disrupt other users or consume maintenance capacity'],['**High (equivalent to superuser)**','`pg_read_server_files`, `pg_write_server_files`, `pg_execute_server_program`','They reach the server file system or run shell commands as the `postgres` OS user, which can be turned into full control of the cluster']]},
{h:'Typical uses'},
{code:`-- 1. Monitoring agent (postgres_exporter, Zabbix, Datadog): no superuser needed
CREATE ROLE exporter LOGIN CONNECTION LIMIT 3 PASSWORD '...';
GRANT pg_monitor TO exporter;

-- 2. Read-only analyst across every schema, now and in the future
CREATE ROLE analyst LOGIN;
GRANT pg_read_all_data TO analyst;
-- if RLS is used and the analyst must see all rows
ALTER ROLE analyst BYPASSRLS;

-- 3. Support engineer who may cancel runaway queries of normal users
CREATE ROLE support LOGIN;
GRANT pg_signal_backend TO support;
SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE usename = 'app_user' AND state = 'active';

-- 4. Scheduled maintenance job with no ownership of tables
CREATE ROLE janitor LOGIN;
GRANT pg_maintain TO janitor;       -- VACUUM, ANALYZE, REINDEX ... on every table

-- 5. Logical backup role
CREATE ROLE dumper LOGIN;
GRANT pg_read_all_data TO dumper;   -- enough for pg_dump of table data`},
{h:'Choosing the right role'},
{flow:['Define the task precisely','Does a predefined role cover it?','Grant that role, not SUPERUSER','If not, grant specific privileges to a group role','Review quarterly with pg_auth_members']},
{h:'What each monitoring role really changes'},
{t:[['Without the role','With `pg_monitor`'],['`SHOW ALL` hides some settings from non-superusers','`pg_settings` shows every value'],['`pg_stat_activity.query` is blank for other users\' sessions','Query text of all sessions is visible'],['`pg_ls_waldir()` and similar functions are denied','Selected monitoring functions work']]},
{h:'Checking who holds what'},
{code:`-- members of predefined roles
SELECT r.rolname AS predefined_role, m.rolname AS member, am.admin_option, am.inherit_option, am.set_option
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.roleid
JOIN pg_roles m ON m.oid = am.member
WHERE r.rolname ~ '^pg_'
ORDER BY 1,2;

-- test one account
SELECT pg_has_role('exporter','pg_monitor','USAGE');`},
{ul:['Predefined roles are cluster-wide like all roles, so a grant applies to every database.','Prefer granting them to a **group role** (`monitoring`, `readers`) and then adding logins to the group.','Predefined roles cannot be dropped or altered, but memberships can be revoked as usual.','The three **server file/program** roles belong only on a tightly controlled admin account, never on application roles.']}],
src:[['Predefined Roles',D+'predefined-roles.html'],['Role Membership',D+'role-membership.html'],['Monitoring Database Activity',D+'monitoring.html'],['pg_signal_backend and signalling functions',D+'functions-admin.html#FUNCTIONS-ADMIN-SIGNAL']]},

/* ---------------------------------------------------------------- 6:8 */
'pg:6:8':{blocks:[
{p:'Every object in PostgreSQL has exactly one **owner**, normally the role that created it. Ownership is the root of the privilege system: the owner holds all privileges on the object, and only the owner (or a superuser, or a role acting as the owner) can `ALTER` or `DROP` it and decide who else receives access. Ownership also explains why a role cannot be dropped while it still owns something. This lecture covers ownership, **default privileges** for objects created in the future, and the documented procedure for removing a role cleanly.'},
{h:'Ownership rules'},
{t:[['Fact','Detail'],['Initial owner','The role that ran `CREATE`, or the role named in `AUTHORIZATION` / `OWNER`'],['Owner rights','All privileges on the object; can revoke them from itself (not recommended)'],['Who can `ALTER` / `DROP`','Owner, a role that acts as the owner (`SET ROLE` or inherited membership), or a superuser. These are **not grantable privileges**.'],['Change owner','`ALTER ... OWNER TO new_owner`: you must own the object, be able to act as the new owner, and the new owner needs `CREATE` on the containing schema (or database)'],['Cluster-level owners','Databases and tablespaces are owned too; `ALTER DATABASE ... OWNER TO ...`'],['Special case','Owner of a schema owns it, but **not** the tables others create inside it']]},
{code:`ALTER TABLE   app.orders  OWNER TO migrator;
ALTER SCHEMA  app         OWNER TO migrator;
ALTER DATABASE sales      OWNER TO sales_owner;
ALTER FUNCTION app.close_order(bigint) OWNER TO migrator;

-- who owns what
SELECT schemaname, tablename, tableowner FROM pg_tables WHERE schemaname = 'app';
SELECT nspname, pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'app';
SELECT datname, pg_get_userbyid(datdba) FROM pg_database;
\\dt+ app.*      \\dn+      \\l`},
{note:'Design rule: **objects are owned by a NOLOGIN owner role; applications connect as different roles that only hold DML privileges.** If the application login owns the tables, a single SQL injection can drop or rewrite them, and it can also `GRANT` access to anyone.'},
{h:'Default privileges'},
{p:'`GRANT ... ON ALL TABLES IN SCHEMA` only affects tables that exist **now**. Tables created tomorrow start with owner-only access. `ALTER DEFAULT PRIVILEGES` stores a rule that is applied **automatically to future objects**. Per the documentation, it affects only objects created **by the role named in `FOR ROLE`** (by default, the role running the command), optionally limited to one schema. It never changes existing objects.'},
{code:`ALTER DEFAULT PRIVILEGES [ FOR { ROLE | USER } target_role [, ...] ]
    [ IN SCHEMA schema_name [, ...] ]
    { GRANT privileges ON { TABLES | SEQUENCES | FUNCTIONS | ROUTINES | TYPES | SCHEMAS } TO role [, ...]
    | REVOKE privileges ON ... FROM role [, ...] };

-- every table, sequence and function migrator creates in schema app is usable by the right groups
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA app GRANT SELECT ON TABLES TO app_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA app GRANT INSERT, UPDATE, DELETE ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO app_rw;

-- global: nothing created by migrator is executable by PUBLIC
ALTER DEFAULT PRIVILEGES FOR ROLE migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;`},
{t:[['Clause','Effect'],['No `FOR ROLE`','Applies to objects created by the **current** role only'],['`FOR ROLE x`','Applies to objects created by `x`. You must be `x` or a member that can act as `x`.'],['`IN SCHEMA s`','Limits the rule to that schema; schema-level defaults are **added to** global ones and cannot remove them'],['Object types','`TABLES` (includes views and foreign tables), `SEQUENCES`, `FUNCTIONS` / `ROUTINES`, `TYPES`, `SCHEMAS`'],['Existing objects','Untouched. Run `GRANT ... ON ALL ... IN SCHEMA` once for them']]},
{code:`\\ddp                                                    -- list default privileges
SELECT pg_get_userbyid(defaclrole) AS for_role,
       defaclnamespace::regnamespace AS in_schema,       -- 0 = global
       defaclobjtype AS type,                            -- r table, S sequence, f function, T type, n schema
       defaclacl
FROM pg_default_acl;`},
{note:'The most frequent surprise: you define defaults **for the role you are logged in as**, but a different role (a developer using `SET ROLE migrator`, or a deployment tool) creates the tables. Defaults must be defined **FOR ROLE the creator**, otherwise new tables arrive with no access for the groups.'},
{h:'Dropping a role safely'},
{p:'`DROP ROLE` refuses to run while the role owns objects, holds privileges, or appears in default-privilege rules in **any database of the cluster**, because dropping it would leave those objects without an owner. Two commands prepare the role, and both work **per database**.'},
{t:[['Command','What it does','Scope'],['`REASSIGN OWNED BY old TO new`','Transfers ownership of every object owned by `old` in the current database, **and** of shared objects (databases, tablespaces) owned by it. Privileges (ACL entries) are not moved.','Current database + shared objects'],['`DROP OWNED BY old`','Drops objects owned by `old` in the current database, and revokes privileges granted to `old` on objects in this database and on shared objects. Also removes its default-privilege entries. Databases and tablespaces it owns are **not** dropped.','Current database + shared privileges'],['`DROP ROLE old`','Removes the role and its memberships','Whole cluster']]},
{flow:['Lock the account: ALTER ROLE old NOLOGIN','Terminate its sessions','In every database: REASSIGN OWNED BY old TO successor','In every database: DROP OWNED BY old','DROP ROLE old','Remove its pg_hba.conf and pg_ident.conf entries and secrets']},
{code:`-- 1. lock and disconnect
ALTER ROLE old NOLOGIN;
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'old';

-- 2 and 3: repeat in EVERY database that allows connections (psql -d <db>)
REASSIGN OWNED BY old TO successor;
DROP OWNED BY old;

-- 4. finally
DROP ROLE old;`},
{code:`# loop over all databases from the shell
for db in $(psql -Atc "SELECT datname FROM pg_database WHERE datallowconn"); do
  psql -d "$db" -c "REASSIGN OWNED BY old TO successor" -c "DROP OWNED BY old"
done
psql -c "DROP ROLE old"`},
{t:[['DROP ROLE error','Cause','Fix'],['`role "old" cannot be dropped because some objects depend on it` with DETAIL lines such as `owner of table app.t1`','Still owns objects in the listed database','`REASSIGN OWNED` in that database'],['DETAIL `privileges for table app.orders`','It still holds grants','`DROP OWNED BY old` in that database'],['DETAIL `owner of database sales`','Shared object owner','`REASSIGN OWNED` (it handles databases) or `ALTER DATABASE ... OWNER TO`'],['DETAIL `N objects in database X`','Objects exist in a database you are not connected to','Connect to X and repeat'],['`current user cannot be dropped`','You are connected as that role','Connect as another role']]},
{ul:['**Never** run `DROP OWNED BY` before deciding who inherits the data: it deletes tables the role owns.','`REASSIGN OWNED` does not copy privileges. If other roles had access through grants made by `old`, check `\\dp` afterwards.','Dropping a role removes its memberships but **not** the roles it contained.','Take a backup (`pg_dumpall --globals-only` plus database dumps) before an offboarding that touches ownership.']}],
src:[['ALTER DEFAULT PRIVILEGES',D+'sql-alterdefaultprivileges.html'],['REASSIGN OWNED',D+'sql-reassign-owned.html'],['DROP OWNED',D+'sql-drop-owned.html'],['DROP ROLE',D+'sql-droprole.html'],['pg_default_acl',D+'catalog-pg-default-acl.html'],['Privileges (ownership)',D+'ddl-priv.html']]},

/* ---------------------------------------------------------------- 6:9 */
'pg:6:9':{blocks:[
{p:'Roles prove their identity with a **password** (or a certificate or external service), and the connection carries data that may be sensitive. This lecture covers how PostgreSQL stores and verifies passwords, why **SCRAM-SHA-256** replaced MD5, how to migrate, how to protect passwords on clients, and how to encrypt the connection with **TLS**. The documentation (Password Authentication, Secure TCP/IP Connections with SSL) is the reference for each point.'},
{h:'Password storage'},
{t:[['Format','Stored in `pg_authid.rolpassword` as','Strength'],['SCRAM-SHA-256','`SCRAM-SHA-256$<iterations>:<salt>$<StoredKey>:<ServerKey>`','Salted, iterated; the server never holds the password or anything that can be replayed to log in'],['MD5 (deprecated in 18)','`md5` + md5(password + role name)','Weak: fast hash, salt is the role name, and the stored hash itself can be used to log in over the MD5 protocol'],['Plain text','Never stored','The server always stores a hash']]},
{ul:['`pg_authid` (hashes) is readable only by superusers; `pg_roles` shows `********` instead.','`password_encryption` chooses the format used when a password is set. Default since PostgreSQL 14: `scram-sha-256`. Value `md5` is **deprecated in PostgreSQL 18**, and `md5_password_warnings` (default on) controls the deprecation warnings.','`scram_iterations` (default 4096, PostgreSQL 16+) sets the cost of new hashes.','A stored password hash cannot be converted between formats. The user must set the password again.']},
{h:'How SCRAM-SHA-256 authentication works'},
{svg:dg(700,230,[[10,10,100,210,'Client',0],[590,10,100,210,'Server',0],[160,15,380,40,'1  client-first: user name + random nonce',2],[160,70,380,40,'2  server-first: salt + iteration count + nonce',2],[160,125,380,40,'3  client-final: proof computed from the password',2],[160,180,380,40,'4  server-final: server signature (mutual proof)',2]],[[110,35,160,35],[540,35,590,35],[590,90,540,90],[160,90,110,90],[110,145,160,145],[540,145,590,145],[590,200,540,200],[160,200,110,200]])},
{t:[['Property','SCRAM-SHA-256','MD5','`password` (clear)'],['Password crosses the network','Never','Never (hash exchange)','**Yes, in the clear**'],['Replay of a captured exchange','Not possible (fresh nonces)','Limited by a salt from the server','Trivial'],['Server proves identity to client','Yes','No','No'],['Stolen `pg_authid` row is enough to log in','No','Yes','n/a'],['Supports channel binding','Yes (`scram-sha-256-plus` over TLS)','No','No'],['Recommendation','Use','Migrate away','Only inside TLS, avoid']]},
{h:'Migrating from MD5 to SCRAM'},
{flow:['Check driver and client support for SCRAM','Set password_encryption = scram-sha-256','List roles still on md5','Reset each password','Change pg_hba.conf md5 to scram-sha-256','Reload and test']},
{code:`-- 1. find the state of every role (requires superuser to read pg_authid)
SELECT rolname,
       CASE WHEN rolpassword LIKE 'SCRAM-SHA-256$%' THEN 'scram'
            WHEN rolpassword LIKE 'md5%'            THEN 'md5'
            WHEN rolpassword IS NULL                THEN 'no password'
            ELSE 'other' END AS format
FROM pg_authid WHERE rolcanlogin ORDER BY 2,1;

-- 2. make sure new passwords are SCRAM
SHOW password_encryption;                    -- scram-sha-256
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
SELECT pg_reload_conf();

-- 3. users set their own password again (psql hashes on the client)
\\password app_user

-- 4. pg_hba.conf: replace md5 with scram-sha-256 and reload`},
{note:'A `pg_hba.conf` rule that says `md5` still works for a role whose stored password is SCRAM: the server then performs SCRAM. So you can switch roles to SCRAM first and tighten `pg_hba.conf` last. Old client libraries without SCRAM support will fail after the change, so test every driver.'},
{h:'Protecting passwords on the client'},
{t:[['Method','Use','Caution'],['`~/.pgpass`','Line format `host:port:database:user:password`. Wildcards `*` allowed.','File must be `chmod 0600` or libpq ignores it. On Windows: `%APPDATA%\\postgresql\\pgpass.conf`'],['`PGPASSFILE`','Points libpq to another password file','Same permission rule'],['`PGPASSWORD` environment variable','Quick scripts','Not recommended: the environment of a process can be visible to other users'],['`pg_service.conf`','Named connection profiles (host, port, db)','Holds no secrets unless you put them there'],['Certificates or `peer`','Passwordless for services','Needs key management or local OS identity']]},
{ul:['`passwordcheck` is a sample contrib module (loaded by `shared_preload_libraries`) that rejects weak **clear-text** passwords. It cannot inspect a password that the client already hashed (for example with `\\password`). For real password policy use LDAP, Kerberos or OAuth and let the directory enforce it.','Rotate application passwords with `VALID UNTIL` and automate the change in your secret store.']},
{h:'Encrypting connections with TLS'},
{p:'By default PostgreSQL connections are **not encrypted**. SQL text, results and (for `password` authentication) credentials travel in clear text. TLS fixes this and, with certificate verification, also proves the server is the right one. Build the server with OpenSSL (`--with-openssl`; packaged builds have it).'},
{code:`# 1. certificate (self-signed for testing; use your CA in production)
openssl req -new -x509 -days 365 -nodes -text -out server.crt -keyout server.key \\
        -subj "/CN=db1.example.com"
chmod og-rwx server.key                  # the server refuses a key readable by group/other
cp server.crt server.key $PGDATA/        # owned by the postgres OS user

# 2. postgresql.conf
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file  = 'server.key'
ssl_min_protocol_version = 'TLSv1.2'     # TLSv1.3 where all clients support it
#ssl_ca_file  = 'root.crt'               # needed to verify client certificates

# 3. pg_hba.conf: force TLS for remote clients
hostssl  all  all  10.0.0.0/8  scram-sha-256

# 4. apply (ssl parameters need only a reload)
SELECT pg_reload_conf();`},
{h:'Client-side sslmode'},
{t:[['sslmode','Encrypts?','Verifies server certificate?','Protects against'],['`disable`','No','No','Nothing'],['`allow`','Only if server insists','No','Nothing against attackers'],['`prefer` (default)','If server offers','No','Passive listening only; attacker can downgrade'],['`require`','Yes','No','Eavesdropping; not impersonation'],['`verify-ca`','Yes','Certificate chain only','Fake CA'],['`verify-full`','Yes','Chain **and** host name','Man-in-the-middle. **Use for production.**']]},
{code:`psql "host=db1.example.com dbname=sales user=app_user sslmode=verify-full sslrootcert=root.crt"
psql "host=db1.example.com dbname=sales user=app_user sslmode=verify-full channel_binding=require"

-- confirm what each session uses
SELECT a.pid, a.usename, a.client_addr, s.ssl, s.version, s.cipher
FROM pg_stat_ssl s JOIN pg_stat_activity a USING (pid)
WHERE a.backend_type = 'client backend';`},
{h:'Client certificates'},
{p:'With **mutual TLS** the client also presents a certificate signed by a CA the server trusts. Use it either as the authentication method or as an extra requirement on top of a password.'},
{code:`# pg_hba.conf
hostssl  all  app_user  10.0.1.0/24  cert                                   # role = certificate CN
hostssl  all  all       10.0.9.0/24  scram-sha-256  clientcert=verify-full  # certificate AND password

# postgresql.conf
ssl_ca_file  = 'root.crt'
ssl_crl_file = 'root.crl'                # revoked certificates`},
{ul:['Certificate and key files are re-read on reload; **new** connections use the new certificate.','Keep the CA key off the database server and plan renewal dates: an expired server certificate stops `verify-full` clients.','TLS protects data in transit only. Data on disk needs OS or storage encryption.']}],
src:[['Password Authentication',D+'auth-password.html'],['Secure TCP/IP Connections with SSL',D+'ssl-tcp.html'],['SSL Support (libpq sslmode)',D+'libpq-ssl.html'],['The Password File (.pgpass)',D+'libpq-pgpass.html'],['Connections and Authentication settings',D+'runtime-config-connection.html'],['pg_stat_ssl',D+'monitoring-stats.html#MONITORING-PG-STAT-SSL-VIEW']]},

/* ---------------------------------------------------------------- 6:10 */
'pg:6:10':{blocks:[
{p:'Security is a **process**: configure, verify, record, and repeat. This final lecture brings the section together. It covers three extra privilege tools (column privileges, safe `SECURITY DEFINER` functions, security-invoker views), how to **audit** what roles do (server logging and the pgAudit extension), the queries that check the configuration, and a production **hardening checklist** you can apply to any cluster.'},
{h:'Column-level privileges'},
{p:'Give a role access to some columns of a table. This is simpler than a view when the only goal is to hide sensitive fields.'},
{code:`CREATE TABLE hr.employees (emp_id int PRIMARY KEY, name text, dept text, salary numeric, national_id text);

GRANT SELECT (emp_id, name, dept) ON hr.employees TO hr_read;      -- no salary, no national_id
GRANT UPDATE (dept)               ON hr.employees TO hr_clerk;

-- as a member of hr_read
SELECT name, dept FROM hr.employees;          -- works
SELECT * FROM hr.employees;                   -- ERROR: permission denied for table employees (needs every column)
SELECT salary FROM hr.employees;              -- ERROR: permission denied for table employees`},
{h:'SECURITY DEFINER functions'},
{p:'A function normally runs with the privileges of the **caller** (`SECURITY INVOKER`). A `SECURITY DEFINER` function runs with the privileges of its **owner**, like `sudo` for SQL. It is a controlled way to let a low-privilege role perform one specific privileged action, but it is also the classic privilege-escalation vector. The documentation (CREATE FUNCTION, Writing SECURITY DEFINER Functions Safely) lists the rules below.'},
{t:[['Rule','Why'],['`SET search_path = pg_catalog, pg_temp` on the function','Prevents callers from substituting their own objects (`pg_temp` last stops temporary-object tricks)'],['Schema-qualify every object in the body','Defence in depth against path changes'],['Owner has only the privileges the function needs','The owner\'s rights are what an exploit gains'],['`REVOKE EXECUTE ... FROM PUBLIC`, then grant to specific roles','New functions are executable by PUBLIC by default'],['Validate arguments; avoid dynamic SQL, or use `format(\'%I\', ...)`','Stops SQL injection inside privileged code']]},
{code:`CREATE FUNCTION app.force_password_change(p_user text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    UPDATE app.users SET must_change = true WHERE username = p_user;
END $$;
ALTER FUNCTION app.force_password_change(text) OWNER TO app_admin_owner;   -- minimal-rights owner
REVOKE ALL ON FUNCTION app.force_password_change(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.force_password_change(text) TO helpdesk;`},
{h:'Views as a security tool'},
{ul:['A normal view reads the underlying tables with the **view owner\'s** privileges. This makes views useful to hide columns or rows, but it can also bypass RLS.','`CREATE VIEW v WITH (security_invoker = true) AS ...` (PostgreSQL 15+) checks privileges and RLS as the **caller**.','`WITH (security_barrier = true)` stops user-supplied functions from running before the view\'s own filter, which could leak hidden rows.']},
{h:'Auditing: what to record'},
{flow:['Event (login, DDL, DML, role change)','Server log (log_connections, log_statement) or pgAudit','Log file / syslog','Central log store (SIEM)','Alerts and periodic review']},
{t:[['Mechanism','Records','Notes'],['`log_connections`, `log_disconnections`','Who connected from where, when, and for how long','In PostgreSQL 18 `log_connections` takes a list of stages (`receipt`, `authentication`, `authorization`, `setup_durations`) or `all`; `on` still works'],['`log_statement = ddl` (or `mod`, `all`)','Statement text','`ddl` is a good low-noise default; `all` is heavy and exposes literals'],['`log_line_prefix`','Metadata on each line','Use `%m [%p] %q%u@%d %h` to see user, database and client'],['`log_min_error_statement`, `log_min_messages`','Errors including `permission denied`','Repeated denials point to probing'],['**pgAudit** extension','Session and object audit trail with class, command, object and role','Third-party extension; needs `shared_preload_libraries` and a restart']]},
{code:`-- built-in baseline
ALTER SYSTEM SET log_connections = 'authentication,authorization';   -- 18 syntax; on older versions: on
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_statement = 'ddl';
ALTER SYSTEM SET log_line_prefix = '%m [%p] %q%u@%d %h ';
SELECT pg_reload_conf();

-- pgAudit
-- postgresql.conf:  shared_preload_libraries = 'pgaudit'     (restart)
CREATE EXTENSION pgaudit;
ALTER SYSTEM SET pgaudit.log = 'ddl, role, write';             -- classes: read, write, function, role, ddl, misc, all
ALTER SYSTEM SET pgaudit.log_relation = on;
SELECT pg_reload_conf();
-- log line example:
-- AUDIT: SESSION,1,1,ROLE,CREATE ROLE,,,"CREATE ROLE temp_user LOGIN",<not logged>`},
{h:'Audit queries you can run today'},
{code:`-- superusers and powerful attributes
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
FROM pg_roles WHERE rolsuper OR rolcreaterole OR rolreplication OR rolbypassrls ORDER BY 1;

-- login roles without expiry or connection limit
SELECT rolname, rolvaliduntil, rolconnlimit FROM pg_roles
WHERE rolcanlogin AND (rolvaliduntil IS NULL OR rolconnlimit = -1) AND rolname !~ '^pg_';

-- weak password hashes (superuser)
SELECT rolname FROM pg_authid WHERE rolpassword LIKE 'md5%';

-- dangerous pg_hba rules
SELECT line_number, type, database, user_name, address, auth_method
FROM pg_hba_file_rules
WHERE auth_method IN ('trust','password','md5') OR (type = 'host' AND address = '0.0.0.0');

-- unencrypted client sessions
SELECT a.usename, a.client_addr FROM pg_stat_activity a
JOIN pg_stat_ssl s USING (pid) WHERE a.client_addr IS NOT NULL AND NOT s.ssl;

-- tables owned by login roles
SELECT t.schemaname, t.tablename, t.tableowner FROM pg_tables t
JOIN pg_roles r ON r.rolname = t.tableowner
WHERE r.rolcanlogin AND t.schemaname NOT IN ('pg_catalog','information_schema');

-- SECURITY DEFINER functions without a fixed search_path
SELECT n.nspname, p.proname, pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'));

-- tables with RLS enabled but no policy (default-deny: confirm it is intended)
SELECT c.relname FROM pg_class c
WHERE c.relrowsecurity AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);`},
{h:'Production hardening checklist'},
{t:[['Area','Action','Where taught'],['Network','`listen_addresses` only on needed interfaces; firewall allows only application and admin subnets','Remote connection lecture'],['Authentication','No `trust` outside local testing; `scram-sha-256`; final `reject` rule; `hostssl` for remote','Authentication and Authorization'],['Encryption','`ssl = on`, `ssl_min_protocol_version = TLSv1.2`, clients use `verify-full`','Passwords, SCRAM and TLS'],['Accounts','Named logins; no shared accounts; at most a few superusers; `VALID UNTIL` for temporary staff','User Creation'],['Privileges','Group roles; revoke from `PUBLIC`; owner is NOLOGIN; default privileges defined','Public Role, Grant and Revoke, Ownership'],['Duties','`NOINHERIT` / `SET ROLE` for migration roles; predefined roles instead of superuser','INHERIT vs NOINHERIT, Predefined Roles'],['Data','RLS for multi-tenant tables; column privileges for sensitive fields; `security_invoker` views','Row Level Security, this lecture'],['Functions','Every `SECURITY DEFINER` has a fixed `search_path` and restricted `EXECUTE`','This lecture'],['Operating system','Data directory mode `0700`; separate OS user; `unix_socket_permissions`; no shell logins for `postgres`','Installation section'],['Logging','Connections, disconnections, DDL; ship logs off the server','Logging and Parameters'],['Backups','Encrypted, access-controlled, restore-tested; they contain all data and role hashes','Backup and Recovery section'],['Patching','Apply every **minor release** (they carry security fixes); plan major upgrades before end of support','Upgrade section']]},
{flow:['Inventory roles and ACLs','Run the audit queries','Fix findings (PUBLIC, owners, trust rules)','Enable logging / pgAudit','Re-test with a low-privilege account','Repeat every quarter and after each upgrade']},
{note:'A security review is only as good as its last re-test. After changes, always try to do the forbidden thing as the low-privilege role and confirm you get `permission denied`.'}],
src:[['CREATE FUNCTION (security considerations)',D+'sql-createfunction.html'],['CREATE VIEW (security_invoker, security_barrier)',D+'sql-createview.html'],['Error Reporting and Logging',D+'runtime-config-logging.html'],['Client Authentication',D+'client-authentication.html'],['pgAudit','https://github.com/pgaudit/pgaudit'],['Security information functions and views',D+'view-pg-hba-file-rules.html']]}

});

/* ------------------------------------------------------------------
   Back-fill: notes added to earlier lessons from what Section 07 teaches
   ------------------------------------------------------------------ */
const X=(k,blocks,src)=>{const L=window.LESSONS[k];if(!L)return;L.blocks.push(...blocks);if(src)L.src=(L.src||[]).concat(src)};

X('pg:0:2',[
{h:'Where each security duty is taught (Section 07)'},
{t:[['DBA duty','What it means in practice','Lecture'],['Control who can connect','Write and test `pg_hba.conf` rules, choose SCRAM, require TLS','Authentication and Authorization; Passwords, SCRAM and TLS'],['Create accounts with least privilege','Minimal attributes, expiry, connection limits, group roles','User Management Introduction; User Creation'],['Grant and review access','`GRANT`/`REVOKE`, default privileges, ownership, offboarding','Grant and Revoke; Ownership, Default Privileges and Dropping Roles'],['Close default exposure','Remove `PUBLIC` privileges and search_path risks','Public Role'],['Separate duties','`NOINHERIT` and `SET ROLE` for powerful roles; predefined roles','INHERIT vs NOINHERIT; Predefined Roles'],['Protect data inside tables','Row-level security, column privileges','Row Level Security; Security Hardening Checklist and Auditing'],['Prove what happened','Connection logging, pgAudit, audit queries','Security Hardening Checklist and Auditing']]}],
[['Database Roles',D+'user-manag.html']]);

X('pg:1:1',[
{h:'Secure the cluster at initdb time (see Section 07)'},
{p:'`initdb` decides the **initial `pg_hba.conf`** and the name of the first superuser. If you do not choose an authentication method, `initdb` warns that `trust` is being enabled for local connections, which means anyone who can reach the socket is accepted without a password. For a source build, set the methods explicitly.'},
{code:`# local sockets use the OS identity, TCP uses SCRAM, and the superuser gets a password
sudo -u postgres /usr/local/pgsql/bin/initdb -D /usr/local/pgsql/data \\
     --auth-local=peer --auth-host=scram-sha-256 --pwprompt`},
{t:[['initdb option','Effect'],['`--auth-local=METHOD`','Method for Unix-socket connections written into `pg_hba.conf`'],['`--auth-host=METHOD`','Method for TCP connections'],['`-A METHOD` / `--auth`','Sets both at once (avoid `trust`)'],['`-W` / `--pwprompt`, `--pwfile=FILE`','Sets the superuser password during initialisation'],['`-U NAME` / `--username=NAME`','Name of the bootstrap superuser (default: the OS user running `initdb`)']]},
{note:'After any installation method, open the generated `pg_hba.conf` and confirm there is **no `trust` line for `host` connections**. Section 07 explains every method and how to test the file.'}],
[['initdb',D+'app-initdb.html']]);

X('pg:1:2',[
{h:'Check the authentication that the package created'},
{p:'The package setup script runs `initdb` for you, so the default `pg_hba.conf` depends on packaging. Review it before opening the port: `sudo grep -v "^#" /var/lib/pgsql/18/data/pg_hba.conf | grep -v "^$"`. Look for `trust`, `ident` and `md5` entries and replace them as described in Section 07 (Authentication and Authorization). The administrative account is the `postgres` role, reachable locally with `sudo -u postgres psql` through `peer` authentication.'}],
[['The pg_hba.conf File',D+'auth-pg-hba-conf.html']]);

X('pg:2:0',[
{h:'Write the remote-access rule securely (Section 07)'},
{p:'Opening the port is two separate decisions: `listen_addresses` lets the server **accept** TCP connections, and a `pg_hba.conf` record decides who is **allowed**. Rules are checked top to bottom and the **first matching rule wins**, so a new rule placed below a `reject` is never reached.'},
{code:`# TYPE   DATABASE  USER      ADDRESS            METHOD
hostssl  sales     app_user  192.168.10.0/24    scram-sha-256     # one database, one user, one subnet, TLS
# not:  host all all 0.0.0.0/0 trust             <- accepts anyone, with no password`},
{ul:['Name the **database**, **user** and **narrow address range** instead of `all` / `0.0.0.0/0`.','Prefer `hostssl` for anything that crosses a network, and `scram-sha-256` as the method.','Run `SELECT * FROM pg_hba_file_rules WHERE error IS NOT NULL;` before `pg_reload_conf()`: a syntax error keeps the old rules active.','pgAdmin connects as an ordinary role, so grant that role only what it needs (Grant and Revoke) rather than registering the server with the `postgres` superuser.']}],
[['Client Authentication',D+'client-authentication.html'],['pg_hba_file_rules',D+'view-pg-hba-file-rules.html']]);

X('pg:2:1',[
{h:'Each cluster has its own roles and its own pg_hba.conf'},
{p:'Roles are **cluster-wide, not machine-wide**. Two clusters on one server (ports `5432` and `5433`) have separate role lists, separate passwords, separate `pg_hba.conf` and `pg_ident.conf` files in their own data directories, and separate `ssl_cert_file` settings. A role created in one cluster does not exist in the other, and a grant in one has no effect on the other. When a login fails with `role "x" does not exist`, first check that you are connected to the intended port.'},
{code:`psql -p 5432 -c "\\du"
psql -p 5433 -c "\\du"
psql -p 5433 -c "SHOW hba_file;"`}],
[['Database Roles',D+'user-manag.html']]);

X('pg:3:0',[
{h:'The postmaster and pg_hba.conf'},
{p:'The postmaster reads `pg_hba.conf` and `pg_ident.conf` at start-up and again whenever it receives **SIGHUP** (`pg_ctl reload` or `pg_reload_conf()`). Each new backend is created by `fork()` and therefore starts with the rule set that the postmaster held at that moment. This is why a rule change affects only **new** connections and never disturbs running sessions. The postmaster itself never authenticates anyone: that job is done by the backend, described in the next lecture.'}],
[['The pg_hba.conf File',D+'auth-pg-hba-conf.html']]);

X('pg:3:1',[
{h:'Where authentication fits in a backend\'s life (Section 07)'},
{flow:['Postmaster accepts the connection','fork() creates the backend','Backend reads the startup packet (user, database)','pg_hba.conf rule matched, method runs','Role checks and CONNECT privilege','ALTER ROLE / DATABASE settings applied','Ready for queries']},
{t:[['Stage','What is checked','Typical failure'],['Rule match','Connection type, database, user, address','`no pg_hba.conf entry for host ...`'],['Authentication method','Password, certificate, peer identity','`password authentication failed`'],['Role state','`LOGIN`, `VALID UNTIL`, role connection limit','`role is not permitted to log in`, `too many connections for role`'],['Database access','`CONNECT` privilege, database connection limit','`permission denied for database`'],['Session defaults','Per-role and per-database `SET` values','None (silent)']]},
{p:'The whole sequence must finish within `authentication_timeout` (default 1 minute). A half-open or slow client occupies a backend process, and a connection slot, until the timeout, which is one reason to restrict who can reach the port at all.'}],
[['Connections and Authentication',D+'runtime-config-connection.html']]);

X('pg:4:0',[
{h:'Catalogs and functions for security (Section 07)'},
{t:[['Object','Shows','Notes'],['`pg_roles`','All roles and attributes','Readable by everyone; password column masked'],['`pg_authid`','Roles including password hash','Superuser only'],['`pg_auth_members`','Membership with `admin_option`, `inherit_option`, `set_option`','Join to `pg_roles` twice'],['`pg_db_role_setting`','Per-role and per-database parameter defaults','Created by `ALTER ROLE ... SET`'],['`pg_default_acl`','Default privileges','Also `\\ddp`'],['`pg_hba_file_rules`, `pg_ident_file_mappings`','Parsed authentication files with errors','Check before reload'],['`pg_policies`','Row-level security policies','Also `pg_class.relrowsecurity`'],['`information_schema.table_privileges`','Table grants including PUBLIC','`role_table_grants` hides PUBLIC grants'],['`pg_stat_ssl`','TLS version and cipher per connection','Join on `pid`']]},
{code:`SELECT has_table_privilege('alice','app.orders','SELECT');
SELECT has_schema_privilege('alice','app','USAGE');
SELECT has_database_privilege('alice','sales','CONNECT');
SELECT pg_has_role('alice','app_ro','USAGE');
SELECT relname, relacl FROM pg_class WHERE relnamespace = 'app'::regnamespace;   -- raw ACLs`}],
[['System Catalogs',D+'catalogs.html'],['Privilege inquiry functions',D+'functions-info.html#FUNCTIONS-INFO-ACCESS-TABLE']]);

X('pg:4:1',[
{h:'Who may connect to and create databases (Section 07)'},
{ul:['A new database gives `PUBLIC` the `CONNECT` and `TEMPORARY` privileges. The database ACL is **not** copied from the template, so repeat `REVOKE ALL ON DATABASE name FROM PUBLIC` for every new database and grant `CONNECT` to group roles.','Creating a database needs the `CREATEDB` attribute (or superuser). The creator becomes the **owner**; `ALTER DATABASE name OWNER TO owner_role` changes it, and the owner is exposed through the special role `pg_database_owner`.','Objects inside the template (including the `public` schema ACL and function privileges) **are** copied, so harden `template1` once and every new database starts safer.','`ALTER DATABASE name CONNECTION LIMIT n` caps concurrent sessions to one database.']},
{code:`CREATE DATABASE sales OWNER sales_owner TEMPLATE template0;
REVOKE ALL ON DATABASE sales FROM PUBLIC;
GRANT CONNECT ON DATABASE sales TO app_ro, app_rw;`}],
[['CREATE DATABASE',D+'sql-createdatabase.html']]);

X('pg:4:4',[
{h:'Delegating session control without superuser (Section 07)'},
{p:'Cancelling or terminating **other users\'** sessions normally needs superuser. Instead of sharing the `postgres` account, grant the predefined role **`pg_signal_backend`**: its members may cancel or terminate sessions of non-superuser roles. PostgreSQL 18 adds `pg_signal_autovacuum_worker` for autovacuum workers. Both are explained in the Predefined Roles lecture.'},
{code:`GRANT pg_signal_backend TO support;
-- support can now run
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'app_user' AND state = 'idle in transaction';`},
{p:'Terminating a role\'s sessions is also the first step before **locking or dropping** the role: `ALTER ROLE x NOLOGIN` stops new logins, then terminate the existing ones (see Ownership, Default Privileges and Dropping Roles). A per-role `CONNECTION LIMIT` prevents one application from taking all slots in the first place.'}],
[['Server Signaling Functions',D+'functions-admin.html#FUNCTIONS-ADMIN-SIGNAL']]);

X('pg:4:5',[
{h:'Schema privileges and the PostgreSQL 15 change (Section 07)'},
{p:'A schema grants two privileges: `USAGE` (look up objects in it) and `CREATE` (make new objects). Until PostgreSQL 14 the `public` schema gave **CREATE to every role**, which allowed search_path hijacking. From PostgreSQL 15, new clusters give `PUBLIC` only `USAGE` on `public`, and the schema is owned by `pg_database_owner`. A cluster **upgraded** from 14 or earlier keeps its old ACL, so run `REVOKE CREATE ON SCHEMA public FROM PUBLIC;` yourself. The Public Role lecture shows the attack and the three documented usage patterns.'},
{code:`CREATE SCHEMA hr AUTHORIZATION hr_owner;                      -- one schema per team, owned by a NOLOGIN role
GRANT USAGE ON SCHEMA hr TO hr_read, hr_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE hr_owner IN SCHEMA hr GRANT SELECT ON TABLES TO hr_read;
ALTER ROLE ALL IN DATABASE sales SET search_path = "$user", pg_catalog;   -- optional: drop public from the path`}],
[['Schemas',D+'ddl-schemas.html']]);

X('pg:5:3',[
{h:'Security parameters: reload or restart? (Section 07)'},
{t:[['Parameter or file','Context','Action'],['`pg_hba.conf`, `pg_ident.conf`','file read by postmaster','Reload'],['`ssl`, `ssl_cert_file`, `ssl_key_file`, `ssl_ca_file`, `ssl_min_protocol_version`','`sighup`','Reload; new connections use them'],['`authentication_timeout`, `log_connections`, `log_disconnections`','`sighup`','Reload'],['`password_encryption`, `row_security`','`user`','`SET` for a session, or `ALTER SYSTEM` and reload'],['`listen_addresses`, `max_connections`, `superuser_reserved_connections`, `reserved_connections`','`postmaster`','Restart'],['`shared_preload_libraries` (for `pgaudit`)','`postmaster`','Restart']]},
{p:'Role-level defaults set with `ALTER ROLE ... SET` take effect for **new sessions** of that role; existing sessions keep their old values.'}],
[['Setting Parameters',D+'config-setting.html']]);

X('pg:5:4',[
{h:'Per-role settings and parameter privileges (Section 07)'},
{p:'`ALTER SYSTEM` changes the whole cluster. Two related mechanisms narrow the scope: **per-role / per-database defaults**, and, since PostgreSQL 15, **privileges on parameters** so that a non-superuser can change selected settings.'},
{code:`ALTER ROLE app_user SET statement_timeout = '30s';                  -- every session of app_user
ALTER DATABASE sales SET work_mem = '32MB';                         -- every session in sales
ALTER ROLE app_user IN DATABASE sales SET search_path = app;        -- most specific wins

GRANT SET          ON PARAMETER log_statement TO auditor;           -- may SET it in a session
GRANT ALTER SYSTEM ON PARAMETER log_min_duration_statement TO dba;  -- may ALTER SYSTEM that one parameter
SELECT * FROM pg_db_role_setting;`},
{t:[['Level','Command','Precedence (low to high)'],['File','`postgresql.conf`, `postgresql.auto.conf`','1'],['Database','`ALTER DATABASE ... SET`','2'],['Role','`ALTER ROLE ... SET`','3'],['Role in database','`ALTER ROLE ... IN DATABASE ... SET`','4'],['Session','`SET` / `PGOPTIONS`','5 (subject to the parameter\'s context)']]}],
[['ALTER ROLE',D+'sql-alterrole.html'],['GRANT (parameters)',D+'sql-grant.html']]);

X('pg:5:7',[
{h:'Security events to capture (Section 07)'},
{t:[['Want to see','Setting','Example log evidence'],['Logins and their stages','`log_connections` (PostgreSQL 18: list of stages or `all`)','`connection authorized: user=app_user database=sales`'],['Session end and duration','`log_disconnections = on`','`disconnection: session time: 0:12:03 user=app_user`'],['Failed logins','Always logged as FATAL','`password authentication failed for user "app_user"`'],['Rejected by `pg_hba.conf`','Always logged','`no pg_hba.conf entry for host "x", user "u", database "d"`'],['Privilege failures','Errors logged by default','`permission denied for table orders` (with STATEMENT line)'],['Schema and role changes','`log_statement = ddl`','`CREATE ROLE`, `GRANT`, `DROP TABLE`']]},
{p:'Include `%u` (user), `%d` (database) and `%h` (client host) in `log_line_prefix` so that each of these lines shows who and from where. For a complete audit trail with object and role detail, the pgAudit extension is covered in Security Hardening Checklist and Auditing.'}],
[['Error Reporting and Logging',D+'runtime-config-logging.html']]);

})();
