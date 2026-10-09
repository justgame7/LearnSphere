/* LearnSphere - Amazon Redshift, Section 10: User Management & Access Control.
   Lectures 0-6 are core, 7-12 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const planes=R.dg(700,280,[
[10,10,330,260,'AWS IAM: who may manage the service',1],[360,10,330,260,'Database permissions: who may read the data',1],
[30,45,290,40,'Create, resize, delete clusters and workgroups',0],[30,95,290,40,'Create snapshots, change networking',0],
[30,145,290,40,'Get temporary database credentials',2],[30,195,290,55,'Roles Redshift assumes for S3 (COPY, UNLOAD)',0],
[380,45,290,40,'Who can SELECT, INSERT, UPDATE, DELETE',2],[380,95,290,40,'Who can create schemas and tables',0],
[380,145,290,40,'Row-level security and data masking',0],[380,195,290,55,'Roles, groups and the superuser',0]],
[[320,165,380,165]]);

const roles=R.dg(700,260,[
[10,10,680,240,'Role-based access: users get roles, roles get privileges',1],
[30,45,120,45,'user: asha',0],[30,105,120,45,'user: ravi',0],[30,165,120,45,'user: svc_etl',0],
[210,45,160,45,'role: analyst',2],[210,105,160,45,'role: finance_analyst',2],[210,165,160,45,'role: etl_runner',2],
[440,45,230,45,'SELECT on curated schema',0],[440,105,230,45,'Rows: finance region only|masked card numbers',0],[440,165,230,45,'Write staging, read raw',0]],
[[150,67,210,67],[150,127,210,127],[150,187,210,187],[370,67,440,67],[370,127,440,127],[370,187,440,187]]);

/* ================= LECTURE 0 ================= */
L['rs:9:0']={blocks:[
{p:'Redshift security has **two layers that work together**: AWS IAM controls the **service** (the warehouse as an AWS resource), and database permissions control the **data** inside it. Mixing them up is the most common access-control mistake.'},
{svg:planes},
{h:'What each layer controls'},
{t:[['Question','Answered by','Mechanism'],
['Who can create, resize, pause or delete a cluster or workgroup?','**IAM**','IAM policies, for example the managed `AmazonRedshiftFullAccess`'],
['Who can take or restore snapshots, change the VPC or security groups?','**IAM**','IAM policies on the Redshift API'],
['Who can connect to the database, and as which database user?','**IAM** and the **database**','IAM permission to get temporary credentials, or a database user and password'],
['Who can read or change this table or column?','**Database**','`GRANT` and `REVOKE`, roles, RLS, masking'],
['Which AWS resources can the warehouse itself reach (S3 for COPY)?','**IAM role** attached to the warehouse','Trust policy plus S3 permissions (Section 3)']]},
{h:'How the layers meet'},
{ul:['**Temporary credentials**: an IAM identity is allowed to call `redshift:GetClusterCredentials`, `redshift:GetClusterCredentialsWithIAM` or `redshift-serverless:GetCredentials`. Redshift then maps it to a database user such as `IAM:foo` (an IAM user) or `IAMR:rolename` (an IAM role), and database permissions decide what that user can do.','**ASSUMEROLE**: a database privilege that lets specific users, roles or groups use a specific IAM role for `COPY`, `UNLOAD`, external functions or `CREATE MODEL`. It stops every database user from using your powerful S3 role.','**Data API**: IAM controls who may call it, and the credentials it uses decide the database identity (Section 3).','**IAM Identity Center** and identity-provider federation connect your corporate directory to both layers (later lectures).']},
{code:`-- Let only the loader role use the S3 IAM role in COPY
GRANT ASSUMEROLE ON 'arn:aws:iam::123456789012:role/MyRedshiftRole' TO ROLE etl_runner FOR COPY;

-- See who you are and what the database thinks of you
SELECT current_user, session_user;`},
{h:'Principles to follow'},
{ul:['**Least privilege** in both layers: grant only what a person or job needs.','**Roles, not individuals**: IAM roles for people and services, database roles for permissions.','**No shared admin credentials**: every person has their own identity so audit logs mean something.','**Short-lived credentials** over stored passwords.','**Separate duties**: those who manage infrastructure, those who manage data and those who manage security should not be the same account.']},
{note:'A user with full IAM access to Redshift can still be blocked from every table, and a user with no IAM rights can hold a database password. Check both layers when someone says they cannot get in, or can get in when they should not.'}],
src:[['Identity and access management in Amazon Redshift',MG+'redshift-iam-authentication-access-control.html'],['Data API authorization',MG+'data-api-access.html'],['GRANT',DG+'r_GRANT.html']]};

/* ================= LECTURE 1 ================= */
L['rs:9:1']={blocks:[
{p:'Inside the database, people and applications are **users**. Users can be placed in **groups**, and one special kind of user, the **superuser**, bypasses every permission check.'},
{h:'Creating users'},
{code:`CREATE USER asha PASSWORD 'Str0ngPassw0rd' IN GROUP analysts;

-- Application account that signs in only with IAM temporary credentials
CREATE USER svc_etl PASSWORD DISABLE;

ALTER USER asha PASSWORD 'An0therStr0ngOne';
DROP USER asha;                 -- fails if the user still owns objects`},
{ul:['`CREATE USER` needs superuser or the `CREATE USER` permission (through a role).','By default users can change their **own password**.','The user name cannot be `PUBLIC`.','Users with `PASSWORD DISABLE` can log on only with temporary IAM credentials. You cannot disable a superuser password.']},
{h:'Groups'},
{code:`CREATE GROUP analysts WITH USER asha, ravi;
ALTER GROUP analysts ADD USER priya;
ALTER GROUP analysts DROP USER ravi;
GRANT SELECT ON ALL TABLES IN SCHEMA curated TO GROUP analysts;`},
{ul:['A group is a simple list of users; you grant privileges to the group and every member has them.','Groups are still used in **WLM routing** (Section 9) and in older scripts.','**Roles** (next lecture) are more capable: they can be nested, and can hold system permissions. Prefer roles for new designs.','`PUBLIC` is a special group that always contains **every user**, including users created later. A user effective permissions are the sum of what is granted to PUBLIC, to their groups, and to the user directly.']},
{h:'The superuser'},
{ul:['A **superuser** has the same permissions as the database owner on every database and **bypasses all permission checks**. GRANT and REVOKE do not limit it.','The **admin user** you create with the warehouse is a superuser.','Only a superuser can create another superuser: `CREATE USER name CREATEUSER` or `ALTER USER name CREATEUSER`.','AWS recommends doing most work as a role that is **not** a superuser, and creating administrator **roles** with only the permissions they need.','Superusers can run in the **superuser queue** and see superuser-only system tables.']},
{code:`-- Who are the superusers?
SELECT usename, usesuper, usecreatedb FROM pg_user ORDER BY usename;

-- Users and their groups
SELECT u.usename, g.groname
FROM   pg_user u LEFT JOIN pg_group g ON u.usesysid = ANY (g.grolist)
ORDER  BY 1, 2;

SELECT * FROM svl_user_info;      -- provisioned: includes session timeout`},
{h:'Good habits'},
{ul:['Keep the admin account **sealed**: store its credentials in Secrets Manager and use it only to set up roles.','One named user per person or application; no shared logins.','Use `PASSWORD DISABLE` and IAM or SSO for people and services where possible.','Review the user list every quarter and drop leavers (Identity Center and IdP removals do **not** remove the Redshift user automatically).']},
{note:'A superuser is a skeleton key. If an analyst or a BI tool uses a superuser login, a single mistake or leaked credential exposes everything.'}],
src:[['CREATE USER',DG+'r_CREATE_USER.html'],['Superusers',DG+'r_superusers.html'],['CREATE GROUP',DG+'r_CREATE_GROUP.html']]};

/* ================= LECTURE 2 ================= */
L['rs:9:2']={blocks:[
{p:'**Role-based access control (RBAC)** lets you grant privileges to a **role** and then give people the role. When someone changes jobs you change their roles, not dozens of object privileges.'},
{svg:roles},
{h:'The basics'},
{code:`CREATE ROLE analyst;
CREATE ROLE etl_runner;

GRANT USAGE ON SCHEMA curated TO ROLE analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA curated TO ROLE analyst;

GRANT ROLE analyst TO asha;                 -- give a user the role
GRANT ROLE analyst TO ROLE team_lead;       -- nest: team_lead gets analyst privileges too
GRANT ROLE etl_runner TO svc_etl WITH ADMIN OPTION;   -- svc_etl may grant this role on

REVOKE ROLE analyst FROM asha;
DROP ROLE analyst;`},
{ul:['Granting and revoking happens **at the role level**: change the role and every holder is updated.','A role can be granted to **users or other roles**. A user with a nested role gets the privileges of both.','`WITH ADMIN OPTION` lets the grantee pass the role to others; use it sparingly.','You can have up to **1,000 roles** per cluster or workgroup by default.']},
{h:'System-defined roles'},
{t:[['Role','Can do'],
['`sys:monitor`','Access catalog and system tables'],
['`sys:operator`','Everything in `sys:monitor`, plus `ANALYZE`, `VACUUM` and cancel queries'],
['`sys:dba`','Create and drop schemas, tables, views, functions and procedures, truncate tables; inherits `sys:operator`'],
['`sys:superuser`','All system permissions'],
['`sys:secadmin`','Create, alter and drop users and roles, grant roles, manage **RLS and masking** policies. Sees user tables only if explicitly granted']]},
{p:'These roles start with `sys:` and cannot be recreated by you. Data sharing also creates internal roles and users starting with `ds:`, which you can ignore.'},
{h:'System permissions for custom roles'},
{p:'Beyond table and schema privileges, you can grant **system permissions** to a custom role, so people can do tasks that once needed a superuser, without being one. Permissions include `CREATE USER`, `DROP USER`, `ALTER USER`, `CREATE SCHEMA`, `CREATE TABLE`, `ALTER TABLE`, `TRUNCATE TABLE`, `VACUUM`, `ANALYZE`, `CANCEL`, `ACCESS SYSTEM TABLE`, `ACCESS CATALOG`, `CREATE DATASHARE`, and more.'},
{code:`-- An operations role: monitor, vacuum, analyze and cancel queries, nothing else
CREATE ROLE ops;
GRANT ROLE "sys:operator" TO ROLE ops;

-- A narrower custom example
CREATE ROLE maintenance;
GRANT VACUUM, ANALYZE, CANCEL TO ROLE maintenance;
GRANT ROLE maintenance TO svc_maintenance;

-- Who holds what
SELECT * FROM svv_user_grants;
SELECT * FROM svv_role_grants;`},
{h:'Role design tips'},
{ul:['Name roles after **jobs**, not people: `analyst`, `etl_runner`, `finance_analyst`.','Build **small, composable roles** and combine them by nesting, rather than one giant role per team.','Keep **security administration separate**: give `sys:secadmin` to a small group that does not also have data access.','Roles can be used in **WLM queue routing** (Section 9) and in **RLS and masking policies**.']},
{note:'Document each role in one sentence: what it is for and who may hold it. A role nobody can explain is a role nobody dares remove.'}],
src:[['Role-based access control',DG+'t_Roles.html'],['System-defined roles',DG+'r_roles-default.html'],['GRANT',DG+'r_GRANT.html']]};

/* ================= LECTURE 3 ================= */
L['rs:9:3']={blocks:[
{p:'`GRANT` and `REVOKE` are how you hand out and take back permissions on objects. Learn the pattern for schemas, tables and future objects, because most real mistakes come from forgetting one of them.'},
{h:'The access chain'},
{p:'To read a table a user needs **two things**: `USAGE` on the **schema**, and `SELECT` on the **table** (directly, through a role or group, or through PUBLIC). Missing either one gives "permission denied".'},
{code:`GRANT USAGE ON SCHEMA curated TO ROLE analyst;
GRANT SELECT ON TABLE curated.fact_sales TO ROLE analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA curated TO ROLE analyst;   -- existing tables only

GRANT INSERT, UPDATE, DELETE ON TABLE staging.orders TO ROLE etl_runner;
GRANT CREATE ON SCHEMA staging TO ROLE etl_runner;               -- create objects in the schema
GRANT EXECUTE ON PROCEDURE curated.load_daily_sales(INTEGER) TO ROLE etl_runner;
GRANT TEMP ON DATABASE dev TO ROLE analyst;

REVOKE INSERT ON TABLE staging.orders FROM ROLE etl_runner;`},
{h:'Privileges by object'},
{t:[['Object','Privileges'],
['Table or view','`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, `ALTER`, `REFERENCES`'],
['Column','`SELECT`, `UPDATE` on named columns'],
['Schema','`USAGE`, `CREATE`, `ALTER`, `DROP`'],
['Database','`CREATE` (schemas), `TEMPORARY`, `USAGE`, `ALTER`'],
['Function or procedure','`EXECUTE`'],
['Language','`USAGE` (needed to create UDFs and procedures)'],
['Datashare','`ALTER`, `SHARE`, `USAGE`'],
['IAM role','`ASSUMEROLE` for `COPY`, `UNLOAD`, external functions'],
['Copy job','`ALTER`, `DROP`']]},
{ul:['**An UPDATE or DELETE also needs SELECT**, because it must read the columns it changes.','`WITH GRANT OPTION` lets the grantee pass the privilege on; it cannot be given to a group or PUBLIC.','Redshift does not support the `RULE` and `TRIGGER` privileges.']},
{h:'Future objects: two tools'},
{p:'`GRANT ... ON ALL TABLES IN SCHEMA` covers only tables that **exist now**. For future tables use one of these.'},
{code:`-- 1. Default privileges: for objects created later by a given user
ALTER DEFAULT PRIVILEGES FOR USER transform_admin IN SCHEMA curated
  GRANT SELECT ON TABLES TO ROLE analyst;

-- 2. Scoped permissions: current AND future objects, whoever creates them
GRANT SELECT FOR TABLES IN SCHEMA curated TO ROLE analyst;
GRANT USAGE  FOR SCHEMAS IN DATABASE dev TO ROLE analyst;
GRANT EXECUTE FOR FUNCTIONS IN SCHEMA curated TO ROLE analyst;`},
{t:[['Tool','Applies to','Notes'],
['`ALTER DEFAULT PRIVILEGES`','Future objects created by a specified user','Does not change existing objects'],
['**Scoped permissions** (`FOR TABLES IN SCHEMA ...`)','All current and future objects in a schema or database, by any creator','Cleaner for broad read access. Visible in `SVV_SCHEMA_PRIVILEGES`, `SVV_DATABASE_PRIVILEGES`']]},
{h:'Check and tidy'},
{code:`SELECT has_schema_privilege('asha', 'curated', 'usage')      AS can_use_schema,
       has_table_privilege('asha', 'curated.fact_sales', 'select') AS can_select;

SELECT * FROM svv_relation_privileges WHERE namespace_name = 'curated' AND relation_name = 'fact_sales';

-- Remove the open defaults
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE TEMP ON DATABASE dev FROM PUBLIC;`},
{h:'Pitfalls'},
{ul:['**Forgetting USAGE on the schema.**','**A dropped and recreated table loses its grants** (and so does a recreated table behind a late-binding view).','**PUBLIC** has `CREATE` and `USAGE` on the `public` schema and `TEMP` on databases by default: revoke these in a hardened warehouse.','A user permission is the **sum** of grants to PUBLIC, groups, roles and the user.','Views: a user needs `SELECT` on the **view**, not on the tables behind it; the view **owner** needs access to the tables.']},
{note:'Grant to roles, never directly to people, and prefer scoped permissions for broad read access. It removes most of the "why can I not see the new table" tickets.'}],
src:[['GRANT',DG+'r_GRANT.html'],['REVOKE',DG+'r_REVOKE.html'],['Scoped permissions',DG+'t_scoped-permissions.html'],['ALTER DEFAULT PRIVILEGES',DG+'r_ALTER_DEFAULT_PRIVILEGES.html']]};

/* ================= LECTURE 4 ================= */
L['rs:9:4']={blocks:[
{p:'Every database object has an **owner**: whoever created it. Ownership carries power that cannot be granted away, so it shapes your whole access design.'},
{h:'What ownership means'},
{ul:['The creator is the **owner**. By default only the owner and superusers can query, modify or grant permissions on the object.','**Only the owner (or a superuser) can alter or drop it.** Privileges like `ALTER` and `DROP` can be granted for tables and schemas, but ownership rights themselves, including `GRANT` and `REVOKE`, are implicit and cannot be granted or revoked.','Owners can revoke their own ordinary privileges, for example to make a table read-only even for themselves.','Superusers have all permissions regardless of GRANT and REVOKE.']},
{code:`ALTER TABLE curated.fact_sales OWNER TO deploy_user;
ALTER SCHEMA curated OWNER TO deploy_user;
ALTER VIEW curated.v_revenue OWNER TO deploy_user;

-- Who owns what in a schema
SELECT n.nspname AS schema, c.relname AS object, u.usename AS owner, c.relkind
FROM   pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_user u ON u.usesysid = c.relowner
WHERE  n.nspname = 'curated' AND c.relkind IN ('r', 'v')
ORDER  BY 3, 2;`},
{h:'Design patterns'},
{t:[['Pattern','How','Why'],
['**Deploy owner**','One service user (or role holder) owns all objects in a schema; people and jobs get privileges through roles','Objects survive staff changes; one place to look; reads never depend on a person'],
['**Schema as the security boundary**','Grant `USAGE` and scoped permissions per schema; keep raw, staging and curated apart','Easy to explain and audit (Section 5)'],
['**Views as filters**','Expose only chosen columns or rows through a view; grant `SELECT` on the view alone','A simple, visible access layer'],
['**Procedures as gates**','`SECURITY DEFINER` procedures run with the owner privileges and let a role perform one action without table access','Controlled write paths']]},
{h:'Views and procedures'},
{ul:['To **query** a view you need `SELECT` on the view; you do **not** need access to the underlying tables. The view **owner** must have access to them.','For a **late-binding** view the owner must have `SELECT` on the referenced objects, checked at query time.','`SECURITY DEFINER` runs a procedure with the owner privileges; `SECURITY INVOKER` (default) uses the caller. Be careful: a definer procedure that takes free-form input can be abused.']},
{h:'Handling people leaving'},
{flow:['Move ownership of their objects to a service owner','Drop or disable the user','Remove role memberships','Rotate any shared credentials they knew']},
{code:`-- A user who still owns objects cannot be dropped. Transfer, then drop.
ALTER TABLE staging.orders OWNER TO deploy_user;   -- repeat for each owned object
DROP USER former_employee;`},
{note:'Do not let analysts create permanent objects in shared schemas. Give them a personal or team sandbox schema with a quota (Section 5), and keep ownership of curated objects with the deploy owner.'}],
src:[['Default database user permissions',DG+'r_Privileges.html'],['CREATE VIEW',DG+'r_CREATE_VIEW.html'],['CREATE PROCEDURE',DG+'r_CREATE_PROCEDURE.html']]};

/* ================= LECTURE 5 ================= */
L['rs:9:5']={blocks:[
{p:'Authentication answers "who are you?". Redshift supports passwords, IAM-based temporary credentials and federated single sign-on. Choose the strongest option each kind of user can use.'},
{t:[['Method','How it works','Best for'],
['**Database user and password**','The user types a password stored (hashed) in Redshift','Break-glass accounts, quick labs; not for people at scale'],
['**AWS Secrets Manager**','Credentials stored and rotated in a secret; applications and the Data API read it','Application accounts that need a fixed database user'],
['**IAM temporary credentials**','An IAM identity is allowed to get short-lived database credentials; no password is stored','Applications and AWS users; no secrets to leak'],
['**Identity-provider federation**','Corporate users sign in through SAML or OIDC through your IdP (Okta, Microsoft Entra ID, Ping and others)','Human users from an existing directory'],
['**IAM Identity Center**','Single sign-on with trusted identity propagation; groups from your IdP','Human users and BI tools (query editor v2, Amazon Quick)']]},
{h:'IAM temporary credentials'},
{ul:['The caller needs `redshift:GetClusterCredentials` or `redshift:GetClusterCredentialsWithIAM` (provisioned), or `redshift-serverless:GetCredentials` (Serverless).','The database user name comes from the IAM identity, for example `IAM:foo` for an IAM user or `IAMR:rolename` for a role. With `GetClusterCredentials` you can name a database user and have it join database groups.','Use the Redshift JDBC and ODBC drivers (`jdbc:redshift:iam://...`) or the Python connector with `iam=True` (Section 3).']},
{h:'Native identity provider federation'},
{p:'Register your IdP namespace, then create database users that are bound to external identities and have **no password**.'},
{code:`CREATE USER myco_aad:bob EXTERNALID "ABC123" PASSWORD DISABLE;
CREATE ROLE myco_aad:analysts;
GRANT ROLE myco_aad:analysts TO myco_aad:bob;`},
{h:'IAM-only users'},
{code:`-- Cannot sign in with a password at all; temporary IAM credentials only
CREATE USER svc_reporting PASSWORD DISABLE;

-- A superuser cannot have its password disabled, but you can set an unknowable one
CREATE USER iam_superuser PASSWORD 'md5A1234567890123456780123456789012' CREATEUSER;`},
{h:'Choosing'},
{flow:['Human user with a corporate directory','Use IAM Identity Center or IdP federation','Application on AWS','Use an IAM role with temporary credentials','Application outside AWS','Secrets Manager with rotation','Everything else','A password, as a last resort']},
{ul:['**Connect over SSL always.** `require_ssl` is true by default on new warehouses (since January 10, 2025).','Never put passwords in code, notebooks or tickets.','Where passwords exist, set `VALID UNTIL`, rotate them and prefer hashed forms (next lecture).','For federated users, **removing them from the directory does not drop the Redshift user**: run `DROP USER` yourself.']},
{note:'Aim for no human ever to hold a Redshift password. People use SSO, services use IAM roles, and only one sealed admin account has a password.'}],
src:[['Identity and access management in Amazon Redshift',MG+'redshift-iam-authentication-access-control.html'],['Native IdP federation',MG+'redshift-iam-access-control-native-idp.html'],['Connect with AWS IAM Identity Center',MG+'redshift-iam-access-control-idp-connect.html']]};

/* ================= LECTURE 6 ================= */
L['rs:9:6']={blocks:[
{p:'For accounts that must use passwords, tighten the password itself, how long it lives, and how many connections and how long a session each user may hold.'},
{h:'Password rules'},
{ul:['In clear text a password must be **8 to 64 characters**, with at least **one uppercase letter, one lowercase letter and one number**. It can use ASCII characters 33 to 126 except single quote, double quote, backslash, slash and at sign.','**Do not send clear text**: send a hash instead. An MD5 hash is built from the password plus user name; a **SHA-256** value is stronger: `PASSWORD \'sha256|Mypassword1\'` lets Redshift generate and manage the salt, or you can supply your own digest and 256-bit salt.','A clear-text password with no hashing keyword gets an MD5 digest using the user name as salt.','Hashing keeps the real password out of statement logs and history.']},
{code:`CREATE USER admin2 PASSWORD 'sha256|Mypassword1';

-- Expire a password on a date
CREATE USER temp_contractor PASSWORD 'sha256|Un1queTempPw' VALID UNTIL '2026-12-31';
ALTER USER temp_contractor VALID UNTIL '2026-11-15';

-- Rotate
ALTER USER temp_contractor PASSWORD 'sha256|N3wTempPassword';`},
{h:'Connection limits'},
{ul:['`CONNECTION LIMIT n` is the maximum concurrent connections for a user (default unlimited; **not enforced for superusers**).','A **per-database** connection limit can also be set when you create a database. If both apply, a free slot must exist within **both** limits.','Overall limits: 2,000 connections on RA3, RG and Serverless (Section 4). Use limits to stop one tool from using them all.']},
{code:`ALTER USER tableau_svc CONNECTION LIMIT 30;
CREATE DATABASE sales_dw CONNECTION LIMIT 100;`},
{h:'Session timeout'},
{ul:['`SESSION TIMEOUT n` is the maximum seconds a session may sit idle: from **60 seconds to 1,728,000 (20 days)**. It applies to new sessions.','A user setting overrides the warehouse default (4 hours provisioned, 1 hour Serverless).','Idle transactions are ended after 6 hours whatever the setting.']},
{code:`ALTER USER analyst_user SESSION TIMEOUT 1800;      -- 30 minutes idle

SELECT usename, useconnlimit, valuntil FROM pg_user_info WHERE usename = 'analyst_user';
SELECT * FROM svl_user_info;       -- provisioned: includes session timeout`},
{h:'Other per-user settings'},
{ul:['`SYSLOG ACCESS RESTRICTED` (default) lets a user see only their own rows in system tables; `UNRESTRICTED` shows other users rows, including full query text. Grant it carefully.','`CREATEDB` lets the user create databases. Leave it off by default.','`ALTER USER ... SET search_path TO ...` and other `SET` defaults apply on every login.']},
{h:'A baseline policy'},
{t:[['Setting','Suggested baseline'],
['Passwords','SHA-256 form; rotated on a schedule; `VALID UNTIL` for temporary accounts'],
['People','SSO or IAM, no passwords'],
['Connection limit','Set for every application account'],
['Session timeout','30 to 60 minutes for interactive users'],
['SYSLOG ACCESS','Restricted except for named operations staff'],
['Superusers','One or two, sealed']]},
{note:'Redshift has no built-in password complexity policy beyond the format rules above or automatic lockout. For stronger controls use SSO and IAM, where your identity provider enforces multi-factor authentication and lockout.'}],
src:[['CREATE USER',DG+'r_CREATE_USER.html'],['ALTER USER',DG+'r_ALTER_USER.html'],['Quotas and limits',MG+'amazon-redshift-limits.html']]};

/* ================= ADDITIONAL 7 ================= */
L['rs:9:7']={blocks:[
{p:'**Row-level security (RLS)** restricts which **rows** of a table a user or role can see. Instead of putting `WHERE` clauses in every query or building a view per team, you attach a policy to the table and Redshift filters automatically.'},
{h:'How it works'},
{flow:['Create a policy with a column list and a predicate','Attach it to a table for a role or user','Turn RLS on for the table','Queries see only rows the predicate allows']},
{code:`-- 1. A policy: the WITH list names the columns the predicate uses
CREATE RLS POLICY policy_emea
WITH (region VARCHAR(10))
USING (region = 'EMEA');

-- 2. Attach to a table for a role
ATTACH RLS POLICY policy_emea ON curated.fact_orders TO ROLE emea_analyst;

-- 3. Enforce it
ALTER TABLE curated.fact_orders ROW LEVEL SECURITY ON;

-- Change or remove
ALTER RLS POLICY policy_emea USING (region IN ('EMEA', 'MEA'));
DETACH RLS POLICY policy_emea ON curated.fact_orders FROM ROLE emea_analyst;
DROP RLS POLICY policy_emea;`},
{h:'Rules'},
{ul:['Policies are managed by **superusers** and by the **`sys:secadmin`** role (the security admin).','When RLS is **on** for a table and a user has **no policy** attached, they see **no rows**. Add a policy for every group that should see data.','Several policies on one table combine with **AND** by default. A table can be set to combine them with **OR**: `ALTER TABLE ... ROW LEVEL SECURITY ON CONJUNCTION TYPE OR`.','Superusers, and roles with the system permission **`IGNORE RLS`**, bypass RLS, which you grant to pipelines that must see everything. `EXPLAIN RLS` lets someone see the policy filter in an `EXPLAIN` plan.','To read an RLS-protected table through a datashare the table needs `ALTER TABLE ... ROW LEVEL SECURITY ... FOR DATASHARES`, and consumers see **no RLS** on the shared copy.','You can also attach policies to roles for different regions or tenants from a **single table**.']},
{h:'A lookup-table pattern'},
{p:'When the rule is "a user sees rows for the regions they are assigned", store assignments in a table and refer to it from the policy. The lookup table must be granted to the policy.'},
{code:`CREATE TABLE security.user_region (username VARCHAR(128), region VARCHAR(10));
INSERT INTO security.user_region VALUES ('asha', 'EMEA'), ('ravi', 'APAC');

CREATE RLS POLICY policy_by_user
WITH (region VARCHAR(10))
USING (EXISTS (SELECT 1 FROM security.user_region ur
               WHERE ur.username = current_user AND ur.region = region));

GRANT SELECT ON security.user_region TO RLS POLICY policy_by_user;
ATTACH RLS POLICY policy_by_user ON curated.fact_orders TO PUBLIC;
ALTER TABLE curated.fact_orders ROW LEVEL SECURITY ON;`},
{h:'Performance and design'},
{ul:['Keep policies **simple**. Avoid many joins in a policy definition.','A policy that refers to a **lookup table** makes Redshift scan that table too, so the same query is slower for a user with a policy than for one without.','Filter on a column that is also useful for the **sort key**, so protected scans stay cheap.','Test as each role: `SET SESSION AUTHORIZATION user;` (superuser) then query and `RESET SESSION AUTHORIZATION;`.']},
{h:'RLS or something else?'},
{t:[['Need','Use'],
['Each team sees its own rows in one table','RLS'],
['Hide some columns','Column-level privileges or masking'],
['Show a changed value instead of the real one','Dynamic data masking'],
['A fixed subset for everyone','A view']]},
{note:'RLS controls what a query returns, not what a user may infer. Aggregates over small groups can still reveal facts. Combine RLS with sensible grouping rules for sensitive data.'}],
src:[['Row-level security',DG+'t_rls.html'],['CREATE RLS POLICY',DG+'r_CREATE_RLS_POLICY.html'],['ALTER TABLE (row level security)',DG+'r_ALTER_TABLE.html']]};

/* ================= ADDITIONAL 8 ================= */
L['rs:9:8']={blocks:[
{p:'**Dynamic data masking (DDM)** changes how a column **looks** to a user at query time without changing what is stored. A support analyst sees `****-****-****-1234` while the finance role sees the real card number.'},
{h:'How it works'},
{ul:['A **masking policy** holds an expression that turns the real value into the masked one. Masking happens at **query time**; the stored data is untouched.','You **attach** the policy to a column of a table for a user, role or `PUBLIC`.','You can attach **several policies to the same column** for different roles and set a **priority** to settle any conflict.','Expressions can hide, partly redact or **hash** data. They can use SQL, and user-defined functions written in SQL, Python or AWS Lambda. Hashing keeps **joins** working on masked values.','You can mask at the **cell level** with conditional masking, using other columns in the policy.']},
{code:`-- A policy that keeps only the domain of an email address
CREATE MASKING POLICY mask_email
WITH (email VARCHAR(256))
USING ('****@' || SPLIT_PART(email, '@', 2));

-- A policy that hashes a value so it can still be joined
CREATE MASKING POLICY hash_card
WITH (card VARCHAR(256))
USING (SHA2(card + 'my-salt', 256));

-- Attach: higher PRIORITY number wins when several apply to one user
ATTACH MASKING POLICY mask_email ON curated.dim_customer (email) TO ROLE support PRIORITY 10;
ATTACH MASKING POLICY hash_card  ON curated.fact_payment (card) TO PUBLIC PRIORITY 5;

DETACH MASKING POLICY mask_email ON curated.dim_customer (email) FROM ROLE support;
DROP MASKING POLICY mask_email;`},
{h:'Roles and priorities'},
{t:[['Role','Policy attached','Sees'],
['`finance`','none (or an identity policy)','Real values'],
['`support`','`mask_email` priority 10','`****@example.com`'],
['`analyst`','`hash_card` priority 5','A hash that still joins'],
['everyone else','`PUBLIC` policy with low priority','Fully redacted']]},
{ul:['When a user matches **more than one** policy on a column, the one with the **higher priority** applies. Give your most specific role-based policies higher priority than a broad `PUBLIC` policy.','**`sys:secadmin`** (and superusers) manage policies. `EXPLAIN MASKING` is a permission that lets a role see masking filters in plans.','To read a masked table through a datashare you must opt in with `ALTER TABLE ... MASKING ON FOR DATASHARES`, and the consumer sees **no masking**.']},
{h:'Cautions'},
{ul:['Masking is **presentation**, not encryption. Anyone who can change or detach the policy, or read the table another way, can see the real data.','Filters, `GROUP BY` and `JOIN` on a masked column can reveal information; hash masks keep joins possible by design.','Think about **copies**: `CREATE TABLE AS`, `UNLOAD` and exports run under the querying user, so they copy masked values, but a user with an unmasked role can copy real ones.','Keep expressions simple and test performance on large tables.']},
{note:'Mask by default with a broad PUBLIC policy, then unmask for the roles that need real values. That way a new role starts with the safest view.'}],
src:[['Dynamic data masking',DG+'t_ddm.html'],['CREATE MASKING POLICY',DG+'r_CREATE_MASKING_POLICY.html'],['ATTACH MASKING POLICY',DG+'r_ATTACH_MASKING_POLICY.html']]};

/* ================= ADDITIONAL 9 ================= */
L['rs:9:9']={blocks:[
{p:'**Column-level access control** grants privileges on specific columns of a table or view. It is the right tool when a team should see a table but not its sensitive columns, such as a salary or national ID.'},
{h:'Grant on columns'},
{code:`-- The support role can read only these columns
GRANT SELECT (customer_id, name, city, signup_date) ON curated.dim_customer TO ROLE support;

-- Allow updating only the status column
GRANT UPDATE (status) ON curated.dim_customer TO ROLE ops;

REVOKE SELECT (city) ON curated.dim_customer FROM ROLE support;`},
{ul:['Column privileges are **`SELECT` and `UPDATE`** on a table or view, for users, roles, groups or PUBLIC.','An `UPDATE` also needs `SELECT` on the columns it reads.','You can combine them with RLS: column privileges decide **which columns**, RLS decides **which rows**.']},
{h:'What users experience'},
{code:`-- As a user who can read only some columns
SELECT customer_id, name FROM curated.dim_customer;     -- works
SELECT * FROM curated.dim_customer;                     -- permission denied
SELECT salary FROM curated.dim_customer;                -- permission denied`},
{p:'`SELECT *` fails when the user lacks access to one of the columns, so tools and applications that use it will break until they list their columns. That is a sign the control is working, but you must tell users.'},
{h:'Column privileges, masking or a view?'},
{t:[['Approach','Strength','Weakness'],
['**Column privileges**','Native, simple, enforced by the engine; denied columns cannot be read at all','`SELECT *` fails; all-or-nothing per column'],
['**Dynamic data masking**','Column stays readable but shows a masked value; works with `SELECT *`','Policy design and priorities to manage'],
['**View with fewer columns**','Familiar; can also filter rows','One more object to maintain; users need the view name'],
['**RLS**','Controls rows','Does not hide columns']]},
{h:'Operating it'},
{ul:['Put sensitive columns in a **separate table** when you can, and grant on whole tables: it is simpler to audit than many column grants.','Document which role may see which sensitive columns.','Re-check privileges after you **drop and recreate** a table: column grants are lost with it.','With **federated permissions** you can define column-level privileges on shared catalog tables across warehouses (later lecture).']},
{note:'Treat a new sensitive column as an event: decide who may read it before any data is loaded.'}],
src:[['GRANT (column-level)',DG+'r_GRANT.html'],['Usage notes for column-level access control',DG+'r_GRANT-usage-notes.html']]};

/* ================= ADDITIONAL 10 ================= */
L['rs:9:10']={blocks:[
{p:'**AWS IAM Identity Center** lets your workforce sign in once, with the identities and groups from your corporate directory, and reach Redshift without separate database passwords or hand-built IAM roles.'},
{h:'How it works'},
{ul:['Identity Center holds your users and groups, either created there or synchronized from an identity provider such as **Okta, PingOne or Microsoft Entra ID**.','**Trusted identity propagation** passes the signed-in user identity through to Redshift. Redshift knows **who** the user is and which **groups** they belong to, and authorizes by those groups.','Users appear in the database with a **namespace prefix** (for example `awsidc:asha`) and groups map to roles (`awsidc:analysts`).','One Identity Center instance can serve **many clusters and workgroups**, with simple auto-discovery. The instance must be in the **same Region** as the Redshift datashares you connect.','Redshift supports Identity Center in **multiple Regions**: you can extend it to additional Regions and create applications there without copying identities.']},
{h:'Typical set-up flow'},
{flow:['Application administrator connects Redshift to Identity Center','Identity Center administrator assigns users and groups','Data administrator maps groups to roles and privileges','Users sign in with SSO from query editor v2 or Amazon Quick']},
{code:`-- A role for an Identity Center group, then permissions as usual
CREATE ROLE "awsidc:analysts";
GRANT USAGE ON SCHEMA curated TO ROLE "awsidc:analysts";
GRANT SELECT ON ALL TABLES IN SCHEMA curated TO ROLE "awsidc:analysts";

-- With federated permissions enabled, control who may connect at all
GRANT CONNECT TO ROLE "awsidc:analysts";`},
{p:'The namespace prefix is the one you configured for the connection. Quote names that contain a colon.'},
{h:'Benefits'},
{ul:['Users do not re-enter passwords, and BI authors do not need IAM roles with complex permissions.','Every access is tied to a **known person**, so CloudTrail and query logs show who did what, which helps compliance.','Access follows **directory groups**: joiners and leavers change through your normal process.']},
{h:'Operational notes'},
{ul:['**Deleting a user from Identity Center or your IdP does not delete the Redshift user.** Run `DROP USER` to remove it (and clear its role memberships).','With **enhanced VPC routing**, create interface VPC endpoints for the Identity Center services, or sign-in fails (Section 3).','The `CONNECT` privilege lets you restrict which federated users or groups may connect to each workgroup or cluster that has federated permissions enabled.','Test with a pilot group first, then roll out by group.']},
{note:'Once SSO works, remove password logins for people. What remains should be a handful of sealed service and break-glass accounts.'}],
src:[['Connect Redshift with IAM Identity Center',MG+'redshift-iam-access-control-idp-connect.html'],['Trusted identity propagation','https://docs.aws.amazon.com/singlesignon/latest/userguide/trustedidentitypropagation-overview.html'],['GRANT (CONNECT)',DG+'r_GRANT.html']]};

/* ================= ADDITIONAL 11 ================= */
L['rs:9:11']={blocks:[
{p:'**Amazon Redshift federated permissions** centralize access control across warehouses and your data lake. You define table, column, row and masking rules **once** on a shared catalog database, and every warehouse in the account enforces them, instead of repeating grants in each warehouse.'},
{h:'What you can define'},
{t:[['Level','Controls'],
['**Coarse-grained**','`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` on tables, views and materialized views; database and schema permissions; **scoped permissions** (all current and future objects)'],
['**Column-level**','`SELECT` and `UPDATE` on named columns of tables and views'],
['**Row-level security**','`CREATE RLS POLICY`, attach and detach, turn RLS on for a relation'],
['**Dynamic data masking**','`CREATE MASKING POLICY`, attach and detach with priority'],
['**Connection**','`CONNECT` for Identity Center users and groups']]},
{p:'Objects in the federated catalog are addressed with the form `database@catalog`, for example `"sales_db@finance-catalog".sales_schema.sales_table`.'},
{code:`-- Table level, for an IAM role
GRANT SELECT ON "sales_db@finance-catalog".sales_schema.sales_table TO "IAMR:sales_analyst";

-- Scoped: all current and future tables in a schema
GRANT SELECT FOR TABLES IN SCHEMA "sales_db@finance-catalog".sales_schema TO "IAMR:sales_manager";

-- Column level
GRANT SELECT ON "sales_db@finance-catalog".sales_schema.sales_table (order_number, sales_date, sale_amount)
TO "IAMR:sales_revenue_analyst";

-- Row-level security and masking
CREATE RLS POLICY "sales_db@finance-catalog".policy_america WITH (region VARCHAR(10)) USING (region = 'USA');
ATTACH RLS POLICY "sales_db@finance-catalog".policy_america
  ON "sales_db@finance-catalog".sales_schema.sales_table TO "IAMR:america_sales_analyst";`},
{h:'Who can be a grantee'},
{ul:['An **IAM user, IAM role or Identity Center user** by name with its provider prefix (`IAM:`, `IAMR:`, or the Identity Center prefix).','An **Identity Center group**, written as `ROLE`. **IAM groups are not supported.**','Superusers and `sys:secadmin` manage the RLS and masking policies; `SHOW POLICIES` lists them.']},
{h:'Limits to know'},
{ul:['**UDFs** are not supported in RLS or masking policy definitions on federated permissions.','The functions `user_is_member_of`, `role_is_member_of` and `user_is_member_of_role` are not supported with federated permissions.','The **DEBUG** permission controls who sees unredacted secure logging records on a database with fine-grained access control.']},
{h:'The data lake side: Lake Formation'},
{p:'For data in S3 queried through Redshift Spectrum, permissions can be managed in the **AWS Glue Data Catalog and AWS Lake Formation**. You grant access to an **IAM role** on an external schema or table, and the individual permissions are recorded in the catalog.'},
{code:`-- Database users and groups get USAGE on the external schema
GRANT USAGE ON SCHEMA spectrum_schema TO GROUP analysts;

-- With Lake Formation, table and column permissions go to IAM roles
GRANT SELECT ON EXTERNAL TABLE spectrum_schema.sales TO IAM_ROLE 'arn:aws:iam::123456789012:role/AnalystRole';
GRANT SELECT (order_id, amount) ON EXTERNAL TABLE spectrum_schema.sales TO IAM_ROLE 'arn:aws:iam::123456789012:role/AnalystRole';`},
{ul:['You can grant or revoke only `USAGE` on an external schema to database users and groups with `ON SCHEMA`. With `ON EXTERNAL SCHEMA` and Lake Formation you can grant and revoke permissions **only to an IAM role**.','`GRANT` or `REVOKE` on an external resource cannot run inside a transaction block.','`GRANT ALL` on a schema does not grant `CREATE` on an external schema; only the owner or a superuser creates external tables there.','When you grant `USAGE` on an external schema, you do not grant actions on its objects separately: the catalog permissions control those.']},
{h:'When to use it'},
{t:[['Situation','Prefer'],
['One warehouse, a few schemas','Local roles and grants'],
['Several warehouses sharing the same governed data','Federated permissions, so rules live in one place'],
['Lake data in S3 shared with Athena and others','Lake Formation permissions']]},
{note:'Central governance reduces drift, where one warehouse quietly has different rules from the next. Pair it with Identity Center so people and groups are the same everywhere.'}],
src:[['Managing access control on federated permissions catalog',DG+'federated-permissions-managing-access.html'],['GRANT',DG+'r_GRANT.html'],['Redshift Spectrum and Lake Formation',DG+'c-spectrum-lake-formation.html']]};

/* ================= ADDITIONAL 12 ================= */
L['rs:9:12']={blocks:[
{p:'This case study designs access for a multi-team warehouse from scratch. The company has loaders, a transformation team, analysts, a finance team that sees sensitive data, a support team and a small security group. Apply every idea in the section.'},
{h:'Requirements'},
{t:[['Who','Needs','Must not'],
['Loader job','Write raw and staging','Read curated, change roles'],
['Transform team','Read raw and staging, write curated','Drop raw'],
['Analysts','Read curated','See raw or card data, create objects in shared schemas'],
['Finance','Read curated with real values for their region','See other regions'],
['Support','Read basic customer fields','See email in full or card numbers'],
['Operations','Monitor, vacuum, cancel queries','Read business data'],
['Security admins','Manage users, roles and policies','Read business data']]},
{h:'Design'},
{ul:['Layered schemas `raw`, `staging`, `curated` (Section 5), all **owned by a deploy user**.','**One role per job**, combined by nesting where it helps.','**No privileges to individuals**, only to roles. **No permissions for PUBLIC** on shared schemas.','Sensitive access through **RLS and masking**, not copies of tables.','**Security duties** separate from data duties (`sys:secadmin` holders cannot read curated data).']},
{h:'Script'},
{code:`-- 0. Lock down the defaults
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE TEMP ON DATABASE dev FROM PUBLIC;

-- 1. Schemas owned by the deploy user
CREATE SCHEMA raw     AUTHORIZATION deploy_user QUOTA 5 TB;
CREATE SCHEMA staging AUTHORIZATION deploy_user QUOTA 1 TB;
CREATE SCHEMA curated AUTHORIZATION deploy_user QUOTA 2 TB;

-- 2. Roles, one per job
CREATE ROLE loader;  CREATE ROLE transformer;  CREATE ROLE analyst;
CREATE ROLE finance_analyst;  CREATE ROLE support;  CREATE ROLE ops;

-- 3. Loader: write raw and staging
GRANT USAGE ON SCHEMA raw, staging TO ROLE loader;
GRANT INSERT, UPDATE, DELETE, TRUNCATE FOR TABLES IN SCHEMA raw     TO ROLE loader;
GRANT INSERT, UPDATE, DELETE, TRUNCATE FOR TABLES IN SCHEMA staging TO ROLE loader;
GRANT CREATE ON SCHEMA staging TO ROLE loader;
GRANT ASSUMEROLE ON 'arn:aws:iam::123456789012:role/MyRedshiftRole' TO ROLE loader FOR COPY;

-- 4. Transformer: read raw and staging, write curated
GRANT USAGE ON SCHEMA raw, staging, curated TO ROLE transformer;
GRANT SELECT FOR TABLES IN SCHEMA raw     TO ROLE transformer;
GRANT SELECT FOR TABLES IN SCHEMA staging TO ROLE transformer;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE FOR TABLES IN SCHEMA curated TO ROLE transformer;
GRANT CREATE ON SCHEMA curated TO ROLE transformer;

-- 5. Analysts read curated, including tables created later
GRANT USAGE ON SCHEMA curated TO ROLE analyst;
GRANT SELECT FOR TABLES IN SCHEMA curated TO ROLE analyst;
GRANT ROLE analyst TO ROLE finance_analyst;      -- finance gets everything analysts get
GRANT ROLE analyst TO ROLE support;

-- 6. Support sees no raw email or card data (masking, section 10)
CREATE MASKING POLICY mask_email WITH (email VARCHAR(256)) USING ('****@' || SPLIT_PART(email, '@', 2));
ATTACH MASKING POLICY mask_email ON curated.dim_customer (email) TO ROLE support PRIORITY 10;
CREATE MASKING POLICY redact_card WITH (card VARCHAR(256)) USING ('****');
ATTACH MASKING POLICY redact_card ON curated.fact_payment (card) TO PUBLIC PRIORITY 1;

-- 7. Finance sees only its region
CREATE RLS POLICY finance_emea WITH (region VARCHAR(10)) USING (region = 'EMEA');
ATTACH RLS POLICY finance_emea ON curated.fact_orders TO ROLE finance_analyst;
ALTER TABLE curated.fact_orders ROW LEVEL SECURITY ON;

-- 8. Operations: monitor and maintain, no data
GRANT ROLE "sys:operator" TO ROLE ops;

-- 9. People and services get roles
GRANT ROLE analyst TO "awsidc:asha";
GRANT ROLE loader  TO svc_loader;`},
{p:'The RLS in step 7 means **everyone without a policy sees no rows** of `fact_orders`. In a real design, attach a policy for analysts too (for example `USING (true)`) and an `IGNORE RLS` role for the pipeline, then test every role.'},
{h:'Verify'},
{code:`SET SESSION AUTHORIZATION asha;          -- superuser: act as another user
SELECT COUNT(*) FROM curated.fact_orders;
SELECT email FROM curated.dim_customer LIMIT 3;
SELECT * FROM raw.orders LIMIT 1;        -- expect: permission denied
RESET SESSION AUTHORIZATION;

SELECT * FROM svv_user_grants ORDER BY 1;
SELECT * FROM svv_role_grants ORDER BY 1;
SELECT has_table_privilege('svc_loader', 'curated.fact_sales', 'select') AS loader_reads_curated;   -- expect false`},
{h:'Review routine'},
{flow:['List users, roles and memberships','Check each role against the requirements table','Look for superusers, PUBLIC grants and direct user grants','Test denial for each role','Record findings and fix']},
{ul:['Quarterly access review by the data owner and the security admin.','Alert on grants to PUBLIC and on new superusers (audit logs, Section 11).','Keep the whole script in version control and change roles through reviewed changes.']},
{note:'Least privilege is a habit, not a one-off script. New tables, teams and tools appear all the time, so build the review into your calendar.'}],
src:[['GRANT',DG+'r_GRANT.html'],['Role-based access control',DG+'t_Roles.html'],['Row-level security',DG+'t_rls.html'],['Dynamic data masking',DG+'t_ddm.html']]};
})();
