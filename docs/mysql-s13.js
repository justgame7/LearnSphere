/* LearnSphere - MySQL, Section 13: Security.
   Lectures 0-8 are core. Needs mysql-common.js. Written for MySQL 8.4 LTS. */
(function(){
const K=window.MY,L=window.LESSONS;

const layers=K.dg(700,260,[
[10,10,680,240,'Defence in depth',1],
[25,45,630,34,'Network: firewall, private subnet, bind-address, no public 3306',0],
[25,87,630,34,'Transport: TLS for clients and replication',0],
[25,129,630,34,'Authentication and authorization: accounts, roles, least privilege',2],
[25,171,630,34,'Data: encryption at rest, masking, backups encrypted',0],
[25,213,630,28,'Auditing and monitoring, patching',0]],[]);

const login=K.dg(700,180,[
[10,10,680,160,'How a login is matched',1],
[25,60,150,50,'Client sends|user and host',0],[205,60,170,50,'Server picks the|best matching account|(most specific host)',2],[405,60,130,50,'Authentication|plugin check',0],[565,60,110,50,'Privileges|loaded',0]],
[[175,85,205,85],[375,85,405,85],[535,85,565,85]]);

const inj=K.dg(700,170,[
[10,10,680,150,'SQL injection',1],
[25,60,190,50,'Input: x\' OR \'1\'=\'1',0],[255,60,190,50,'String concatenation|builds SQL text',2],[485,60,190,50,'WHERE becomes always true|all rows returned',0]],
[[215,85,255,85],[445,85,485,85]]);

/* ---------- 0 ---------- */
L['mysql:12:0']={blocks:[
{p:'MySQL security rests on several layers. No single control is enough: the aim is that one failure does not expose the data. This section covers each layer, starting with who can connect and what they may do.'},
{svg:layers},
{h:'Two separate questions'},
{t:[['Question','Name','MySQL mechanism'],
['Who are you?','**Authentication**','Account (user and host) with a password or other credential, checked by an authentication plugin'],
['What may you do?','**Authorization**','Privileges granted to the account, directly or through roles']]},
{svg:login},
{h:'The grant tables'},
{p:'Accounts and privileges are stored in the system schema `mysql` (the tables `user`, `db`, `tables_priv`, `role_edges` and others). They are managed with SQL statements such as `CREATE USER` and `GRANT`, not by editing the tables. Since 8.0 they are InnoDB tables and changes are atomic.'},
{h:'Basic rules'},
{ul:['Every application and every person gets **their own account**. Shared accounts hide who did what.','Grant the **minimum privileges** needed. Applications rarely need DDL rights or global privileges.','Remote access is a deliberate decision. Restrict accounts to the hosts or subnets that need them.','Passwords are never stored in source code or chat. Use a secret manager.','Keep the server patched. Security fixes arrive in every quarterly release.']},
{code:`SELECT user, host, plugin, account_locked, password_expired FROM mysql.user ORDER BY user, host;
SHOW GRANTS FOR 'app'@'10.0.0.%';
SELECT CURRENT_USER(), USER();        -- matched account versus connecting identity`},
{note:'Always check `SELECT CURRENT_USER()` when privileges behave unexpectedly. It shows which account entry was actually matched, which can differ from the name you typed.'}],
src:[['Security',K.D+'security.html'],['Access control and account management',K.D+'access-control.html']]};

/* ---------- 1 ---------- */
L['mysql:12:1']={blocks:[
{p:'A MySQL **account** is a pair: a user name and a **host** that the connection comes from. `\'app\'@\'10.0.0.5\'` and `\'app\'@\'%\'` are two different accounts, with their own password and privileges.'},
{code:`CREATE USER 'app'@'10.0.0.%' IDENTIFIED BY 'a-long-random-secret';
CREATE USER IF NOT EXISTS 'report'@'localhost' IDENTIFIED BY '...' ;
CREATE USER 'batch'@'%' IDENTIFIED BY '...' WITH MAX_USER_CONNECTIONS 10;

ALTER USER 'app'@'10.0.0.%' IDENTIFIED BY 'new-secret';
RENAME USER 'old'@'%' TO 'new'@'%';
DROP USER 'app'@'10.0.0.%';
SHOW CREATE USER 'app'@'10.0.0.%';`},
{h:'Host patterns'},
{t:[['Host value','Matches'],
['`localhost`','Connections through the local Unix socket (and named pipe). **Not** TCP to 127.0.0.1 on Linux'],
['`127.0.0.1` or `::1`','Local TCP connections'],
['`10.0.0.5`','One IP'],
['`10.0.0.%`','Any address in a range using the wildcard'],
['`10.0.0.0/255.255.255.0`','Address with netmask'],
['`%`','Any host. Use only when needed']]},
{h:'How the account is chosen'},
{p:'When several entries could match, MySQL picks the **most specific host** first, then the most specific user. An entry with an **empty user name** (anonymous) is a matching candidate that can shadow a real account and break expectations. Remove anonymous accounts. With `skip_name_resolve` enabled, host names in accounts do not work, use IP addresses.'},
{h:'Account controls'},
{code:`ALTER USER 'app'@'10.0.0.%' ACCOUNT LOCK;                 -- cannot log in, kept for later
ALTER USER 'app'@'10.0.0.%' ACCOUNT UNLOCK;
ALTER USER 'app'@'10.0.0.%' PASSWORD EXPIRE INTERVAL 90 DAY;
ALTER USER 'app'@'10.0.0.%' FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LOCK_TIME 1;   -- lock one day after 5 failures
ALTER USER 'app'@'10.0.0.%' REQUIRE SSL;
ALTER USER 'app'@'10.0.0.%' WITH MAX_QUERIES_PER_HOUR 100000 MAX_USER_CONNECTIONS 20;`},
{h:'The root account'},
{ul:['`root`@`localhost` is the initial administrator. Protect it and do not use it for applications.','Create separate administrator accounts for people, with the `ALL PRIVILEGES` or specific administrative privileges they need.','Do not create `root`@`%`. If remote administration is required, create a named account restricted to the admin network.']},
{h:'Lost root password'},
{p:'Restart the server with `--skip-grant-tables` (together with `--skip-networking`), connect locally, run `FLUSH PRIVILEGES` and set a new password with `ALTER USER`, then restart normally. This mode lets **anyone** connect, so keep the server off the network while it is in use.'},
{note:'Since MySQL 8.0 the account must be created with `CREATE USER` first. The old behaviour of `GRANT ... IDENTIFIED BY` creating an account was removed.'}],
src:[['Account management statements',K.D+'account-management-statements.html'],['Specifying account names',K.D+'account-names.html']]};

/* ---------- 2 ---------- */
L['mysql:12:2']={blocks:[
{p:'**Privileges** authorise actions. They are granted at a **scope**: the whole server, a database, a table, a column or a routine. The narrower the scope, the safer.'},
{t:[['Scope','Syntax','Example'],
['Global','`*.*`','`GRANT PROCESS ON *.* TO ...`'],
['Database','`db.*`','`GRANT SELECT, INSERT, UPDATE, DELETE ON shop.* TO ...`'],
['Table','`db.table`','`GRANT SELECT ON shop.orders TO ...`'],
['Column','`GRANT SELECT (id, name) ON shop.customers TO ...`','Hide sensitive columns'],
['Routine','`GRANT EXECUTE ON PROCEDURE shop.place_order TO ...`','Let users run only a controlled routine']]},
{code:`GRANT SELECT, INSERT, UPDATE, DELETE ON shop.* TO 'app'@'10.0.0.%';
GRANT SELECT ON shop.* TO 'report'@'localhost';
GRANT SELECT (id, name, country) ON shop.customers TO 'support'@'%';

SHOW GRANTS FOR 'app'@'10.0.0.%';
REVOKE DELETE ON shop.* FROM 'app'@'10.0.0.%';
SHOW GRANTS;                                    -- for the current user`},
{h:'Common privileges'},
{t:[['Group','Privileges'],
['Data','SELECT, INSERT, UPDATE, DELETE'],
['Structure','CREATE, ALTER, DROP, INDEX, REFERENCES, CREATE VIEW, TRIGGER, EVENT'],
['Routines','CREATE ROUTINE, ALTER ROUTINE, EXECUTE'],
['Files and server','FILE, PROCESS, SHUTDOWN, RELOAD'],
['Replication','REPLICATION SLAVE, REPLICATION CLIENT'],
['Administration (dynamic)','CONNECTION_ADMIN, SYSTEM_VARIABLES_ADMIN, BACKUP_ADMIN, BINLOG_ADMIN, REPLICATION_SLAVE_ADMIN, ROLE_ADMIN'],
['Special','ALL PRIVILEGES (everything at the scope), USAGE (no privileges), GRANT OPTION (may pass privileges on)']]},
{p:'`SUPER` is deprecated. MySQL 8 splits it into many **dynamic privileges** so an administrator can receive only what is needed, for example `SYSTEM_VARIABLES_ADMIN` to change settings but not `SHUTDOWN`.'},
{h:'Typical account types'},
{t:[['Account','Privileges'],
['Application (OLTP)','SELECT, INSERT, UPDATE, DELETE on its schema. Perhaps EXECUTE on routines'],
['Read-only reporting','SELECT on selected schemas, on a replica if possible'],
['Migration tool','Schema change privileges, used only during deployments'],
['Backup','`SELECT, RELOAD, PROCESS, LOCK TABLES, REPLICATION CLIENT, BACKUP_ADMIN` as the backup tool requires'],
['Replication','`REPLICATION SLAVE` only'],
['DBA','Administrative privileges for the person, with GRANT OPTION only where needed']]},
{h:'Rules'},
{ul:['`GRANT` and `REVOKE` take effect without `FLUSH PRIVILEGES`. Table and column privilege changes apply from the next request, database privileges after the next `USE`, and global privileges only for new connections.','Do not grant `GRANT OPTION`, `FILE`, `SUPER` or `*.*` to applications.','Audit with `SELECT * FROM mysql.user` and `SHOW GRANTS` regularly. Remove accounts that are not used.']},
{note:'Avoid ALL PRIVILEGES ON *.* for anything but administrators. A compromised application account with global privileges can read every database and write files.'}],
src:[['GRANT statement',K.D+'grant.html'],['Privileges provided by MySQL',K.D+'privileges-provided.html']]};

/* ---------- 3 ---------- */
L['mysql:12:3']={blocks:[
{p:'A **role** is a named set of privileges. You grant privileges to the role once and then grant the role to many accounts. When access rules change you edit one role instead of every user. Roles arrived in MySQL 8.0.'},
{code:`CREATE ROLE 'shop_read', 'shop_write';
GRANT SELECT ON shop.* TO 'shop_read';
GRANT INSERT, UPDATE, DELETE ON shop.* TO 'shop_write';

CREATE USER 'ana'@'%' IDENTIFIED BY '...';
GRANT 'shop_read', 'shop_write' TO 'ana'@'%';
SET DEFAULT ROLE 'shop_read' TO 'ana'@'%';       -- active automatically at login

SHOW GRANTS FOR 'ana'@'%' USING 'shop_read';
SELECT CURRENT_ROLE();
SET ROLE ALL;                                      -- activate every granted role in this session
SET ROLE NONE;`},
{h:'Key points'},
{ul:['Granting a role to a user does **not** activate it. The role must be **active** in the session: set a default role (`SET DEFAULT ROLE`), enable `activate_all_roles_on_login`, or run `SET ROLE`.','A role is stored like an account (a locked account with no password), so `CREATE ROLE \'x\'` creates `\'x\'@\'%\'`.','Roles can be granted to other roles to build a hierarchy: `GRANT \'shop_read\' TO \'shop_write\'`.','`mandatory_roles` grants chosen roles to every account automatically.','Revoke with `REVOKE role FROM user` and remove with `DROP ROLE`.']},
{h:'Example role design'},
{t:[['Role','Privileges','Granted to'],
['`app_rw`','SELECT, INSERT, UPDATE, DELETE on the app schema','Application accounts'],
['`app_ro`','SELECT on the app schema','Reporting users'],
['`dba_ops`','BACKUP_ADMIN, CONNECTION_ADMIN, PROCESS, REPLICATION_SLAVE_ADMIN, SYSTEM_VARIABLES_ADMIN','Operations staff'],
['`schema_deploy`','CREATE, ALTER, DROP, INDEX on the app schema','The deployment account only']]},
{p:'This structure makes access reviews simple: list the members of each role and decide whether each should be there.'},
{note:'Role changes affect sessions at the next activation. Existing sessions do not gain a newly granted privilege on a role until they re-set their roles or reconnect.'}],
src:[['Using roles',K.D+'roles.html'],['CREATE ROLE',K.D+'create-role.html']]};

/* ---------- 4 ---------- */
L['mysql:12:4']={blocks:[
{h:'Authentication plugins'},
{p:'The **authentication plugin** of an account decides how the password or credential is verified and how it is stored.'},
{t:[['Plugin','Notes'],
['`caching_sha2_password`','**Default** since 8.0. SHA-256 based, with a cache that makes later logins fast. First login of an account needs a secure channel (TLS, a socket or RSA key exchange)'],
['`mysql_native_password`','Older SHA-1 based. Deprecated in 8.0.34, **disabled by default in 8.4** (enable with `--mysql-native-password=ON`) and **removed in 9.0**'],
['`sha256_password`','Deprecated. Use caching_sha2_password'],
['`auth_socket`','Authenticate by the operating system user over a local socket'],
['LDAP, Kerberos, PAM, OpenID, FIDO','External or multi-factor authentication. Mostly **Enterprise** edition. Community has PAM through some builds and Percona Server']]},
{code:`SELECT @@authentication_policy;             -- replaces the old default_authentication_plugin
CREATE USER 'app'@'%' IDENTIFIED WITH caching_sha2_password BY '...';
SELECT user, host, plugin FROM mysql.user;`},
{p:'Old clients and connectors that only support `mysql_native_password` fail against 8.4 with errors such as *Authentication plugin could not be loaded*. Fix by **upgrading the connector** rather than weakening the server. If you must support one temporarily, enable the plugin and plan its removal before 9.x.'},
{h:'Password policies'},
{code:`INSTALL COMPONENT 'file://component_validate_password';
SHOW VARIABLES LIKE 'validate_password%';
SET PERSIST validate_password.policy = 'MEDIUM';      -- LOW, MEDIUM or STRONG
SET PERSIST validate_password.length = 14;
SELECT VALIDATE_PASSWORD_STRENGTH('Pa55word!');       -- 0 to 100

SET PERSIST default_password_lifetime = 180;          -- days before expiry, 0 for never
ALTER USER 'ana'@'%' PASSWORD HISTORY 5 PASSWORD REUSE INTERVAL 365 DAY;
ALTER USER 'ana'@'%' IDENTIFIED BY 'newpw' REPLACE 'oldpw';`},
{h:'Rotating without downtime'},
{p:'**Dual passwords** let an application keep working while you change its secret. Set a new password and keep the current one as a secondary until clients are updated.'},
{code:`ALTER USER 'app'@'%' IDENTIFIED BY 'new-secret' RETAIN CURRENT PASSWORD;
-- update all application instances to the new secret, then:
ALTER USER 'app'@'%' DISCARD OLD PASSWORD;`},
{h:'Brute force defence'},
{ul:['`FAILED_LOGIN_ATTEMPTS` and `PASSWORD_LOCK_TIME` lock an account temporarily after failures.','The **connection control** component adds growing delays after repeated failed logins from the same account.','Keep the server off public networks, so there is nothing to brute force.']}],
src:[['Pluggable authentication',K.D+'pluggable-authentication.html'],['Password validation component',K.D+'validate-password.html'],['Password management',K.D+'password-management.html']]};

/* ---------- 5 ---------- */
L['mysql:12:5']={blocks:[
{p:'Without encryption, passwords (during first login), query text and results cross the network readable by anyone on the path. **TLS** encrypts the connection and, with certificates, proves the server identity.'},
{h:'Server side'},
{p:'MySQL generates a self-signed certificate at first start, so TLS is available by default. In production use certificates from your own certificate authority.'},
{code:`[mysqld]
ssl_ca   = /etc/mysql/certs/ca.pem
ssl_cert = /etc/mysql/certs/server-cert.pem
ssl_key  = /etc/mysql/certs/server-key.pem
tls_version = TLSv1.2,TLSv1.3
require_secure_transport = ON       # refuse unencrypted TCP connections`},
{code:`SHOW GLOBAL VARIABLES LIKE '%ssl%';
SHOW SESSION STATUS LIKE 'Ssl_cipher';
SHOW SESSION STATUS LIKE 'Ssl_version';
ALTER INSTANCE RELOAD TLS;           -- pick up renewed certificates without a restart
SELECT user, host, ssl_type FROM mysql.user;`},
{h:'Client side modes'},
{t:[['--ssl-mode','Behaviour'],
['`DISABLED`','No encryption'],
['`PREFERRED` (default)','Encrypt if the server offers it, otherwise fall back silently'],
['`REQUIRED`','Encrypt or fail. Does not check the certificate'],
['`VERIFY_CA`','Encrypt and verify the server certificate against the CA'],
['`VERIFY_IDENTITY`','Also verify that the certificate matches the host name. Strongest and recommended']]},
{code:`mysql -h db.example.com -u app -p --ssl-mode=VERIFY_IDENTITY --ssl-ca=/etc/ssl/ca.pem`},
{p:'`REQUIRED` encrypts but is vulnerable to a man in the middle who presents any certificate. Use `VERIFY_IDENTITY` in production, and the matching option in application connection strings.'},
{h:'Account requirements'},
{code:`ALTER USER 'app'@'%' REQUIRE SSL;
ALTER USER 'admin'@'%' REQUIRE X509;                       -- client certificate needed
ALTER USER 'admin'@'%' REQUIRE SUBJECT '/CN=dba-ana' ISSUER '/CN=My CA';`},
{h:'Replication traffic'},
{p:'Replicas connect to the source like clients. Enable TLS on that channel too (`SOURCE_SSL = 1` in `CHANGE REPLICATION SOURCE TO`), and set the same for Group Replication (`group_replication_ssl_mode`).'},
{ul:['TLS 1.0 and 1.1 are no longer supported since 8.0.28. Use 1.2 and 1.3.','Plan certificate renewal. Expired certificates cause outages. `ALTER INSTANCE RELOAD TLS` avoids a restart.','TLS adds a small CPU cost. With connection pooling it is rarely noticeable.']}],
src:[['Using encrypted connections',K.D+'using-encrypted-connections.html'],['Encrypted connection protocols and ciphers',K.D+'encrypted-connection-protocols-ciphers.html']]};

/* ---------- 6 ---------- */
L['mysql:12:6']={blocks:[
{p:'**Encryption at rest** protects data files, logs and backups if someone obtains the disks or a copy of the files. It does **not** protect against an authorised SQL user reading data, which is the job of privileges.'},
{h:'How InnoDB encryption works'},
{flow:['A **master key** is stored outside the data files, in a **keyring**','Each encrypted tablespace has its own **tablespace key**, stored encrypted in the tablespace header','Pages are encrypted with the tablespace key when written to disk and decrypted when read into the buffer pool','Rotating the master key re-encrypts only the small tablespace keys, not the data']},
{h:'Keyring'},
{t:[['Keyring component','Notes'],
['`component_keyring_file`','Community. Stores keys in a file on the server. Simple, but the file must be protected. For testing and low-risk use'],
['`component_keyring_encrypted_file`','Community. File protected by a password'],
['Enterprise keyrings','Integrate with HashiCorp Vault, Oracle Key Vault, AWS KMS, OCI Vault and KMIP servers']]},
{p:'In MySQL 8.4 the keyring is configured with **components**, through a manifest file `mysqld.my` next to the server binary and a component config file, loaded early in startup. The older keyring **plugins** are deprecated. Follow the keyring chapter for your edition.'},
{h:'Encrypting data'},
{code:`CREATE TABLE secrets (id INT PRIMARY KEY, v VARCHAR(100)) ENCRYPTION = 'Y';
ALTER TABLE orders ENCRYPTION = 'Y';                     -- rebuilds the table
CREATE TABLESPACE ts_enc ADD DATAFILE 'ts_enc.ibd' ENCRYPTION = 'Y';
SET PERSIST default_table_encryption = ON;               -- new schemas and tables encrypted by default

SELECT table_schema, table_name, create_options FROM information_schema.tables WHERE create_options LIKE '%ENCRYPTION%';
ALTER INSTANCE ROTATE INNODB MASTER KEY;                 -- key rotation`},
{h:'Also encrypt'},
{t:[['Item','Setting'],
['Redo log','`innodb_redo_log_encrypt = ON`'],
['Undo log','`innodb_undo_log_encrypt = ON`'],
['Binary and relay logs','`binlog_encryption = ON`'],
['System tablespace and data dictionary','Encrypted through schema and tablespace defaults when `default_table_encryption` is on, and with `mysql` tablespace encryption'],
['Backups','Encrypt dump files and backup archives (for example with XtraBackup encryption or file encryption tools)']]},
{h:'Limits and cautions'},
{ul:['**Lose the keyring and you lose the data.** Back up the keys separately from the data, and test restoring.','It protects the files at rest, and the data is plaintext in memory and to authorised sessions.','There is a small CPU overhead. Compression and encryption interact: compress first at the table level when you need both.','Replicas and backups of encrypted tables need access to the right keys.','Encrypted tables must be handled by backup tools that support them.']},
{note:'Use `table_encryption_privilege_check` and `default_table_encryption` to prevent people from creating unencrypted tables by accident in a schema that is meant to be fully encrypted.'}],
src:[['InnoDB data encryption',K.D+'innodb-data-encryption.html'],['MySQL keyring',K.D+'keyring.html']]};

/* ---------- 7 ---------- */
L['mysql:12:7']={blocks:[
{h:'Auditing'},
{p:'**Auditing** records who connected, what they ran and what changed, so that you can investigate incidents and prove compliance.'},
{t:[['Option','Edition','Notes'],
['MySQL Enterprise Audit','Enterprise','Filtering by account, event and object. JSON or XML output. The reference solution'],
['Percona Audit Log Plugin','Percona Server','Open source equivalent with filtering'],
['MariaDB Audit Plugin','Community (third-party)','Works on MySQL with limitations'],
['General query log','All','Logs everything and is heavy. Not an audit solution'],
['Triggers or application audit tables','All','Capture data changes for selected tables'],
['Binary log','All','Record of data changes, not of reads or logins']]},
{p:'An audit has to answer: **who, what, when, from where** and be stored where the audited administrators cannot alter it. Ship the audit log to a separate log system.'},
{h:'Hardening checklist'},
{t:[['Area','Action'],
['Network','Do not expose 3306 to the internet. Use private subnets, security groups and firewalls. Set `bind-address` to the needed interface. Disable the X Protocol port 33060 if unused (`mysqlx=OFF`)'],
['Accounts','No anonymous users. No remote root. Unique accounts per person and service. Remove test accounts and the `test` database'],
['Privileges','Least privilege. No `FILE`, `SUPER` or `*.*` for applications. Use roles'],
['Authentication','`caching_sha2_password`, a password policy, expiry for human accounts and lockout after failures'],
['Transport','`require_secure_transport = ON` with verified certificates'],
['Files','`local_infile = OFF`. `secure_file_priv` pointing to a dedicated directory. `skip_symbolic_links`. Data directory mode 750, owner mysql'],
['Server','Run mysqld as an unprivileged user. Use SELinux or AppArmor profiles. Keep `skip_name_resolve` on'],
['Data','Encryption at rest where required. Encrypted, access-controlled backups'],
['Process','Patch quarterly. Review accounts and grants regularly. Monitor failed logins. Test restores']]},
{code:`SELECT user, host FROM mysql.user WHERE user = '' OR host = '%';
SELECT @@bind_address, @@local_infile, @@secure_file_priv, @@require_secure_transport, @@skip_name_resolve;
SELECT user, host, authentication_string = '' AS empty_pw FROM mysql.user;
SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('test');`},
{note:'`mysql_secure_installation` handles several of these on a fresh host install. Treat it as a first step, not as a full hardening.'}],
src:[['MySQL Enterprise Audit',K.D+'audit-log.html'],['Security guidelines',K.D+'security-guidelines.html']]};

/* ---------- 8 ---------- */
L['mysql:12:8']={blocks:[
{p:'**SQL injection** happens when user input is placed into SQL text and changes the structure of the statement. It remains one of the most common causes of data breaches, and it is entirely preventable.'},
{svg:inj},
{code:`-- Vulnerable code (pseudo)
sql = "SELECT * FROM users WHERE name = '" + input + "' AND pass = '" + pw + "'"

-- Input: ' OR '1'='1
-- Resulting SQL:
SELECT * FROM users WHERE name = '' OR '1'='1' AND pass = ''   -- logs in without a password

-- Worse: input '; DROP TABLE users; --   (when multiple statements are allowed)
-- Or data theft: ' UNION SELECT user, authentication_string FROM mysql.user --`},
{h:'The defences'},
{t:[['Defence','Detail'],
['**Parameterised queries** (prepared statements)','Send the SQL and the values separately. The value can never become SQL. This is the main defence and should be used everywhere'],
['Allowlist for identifiers','Placeholders cannot hold table or column names, or ASC and DESC. Map user choices to a fixed list of allowed names'],
['Least privilege accounts','The web application account should not have DROP, FILE, GRANT or access to the `mysql` schema, so an injection has limited reach'],
['Validate input','Check types, lengths and formats. Useful, but not a substitute for parameters'],
['Safe error handling','Do not show SQL errors to users. Log them'],
['ORMs and query builders','Safe when you use their parameter binding. Raw SQL escape hatches are as dangerous as concatenation'],
['Stored procedures','Safe if they use parameters. Dynamic SQL inside them is still injectable']]},
{code:`# Python with a driver using placeholders
cur.execute("SELECT id, name FROM users WHERE email = %s AND status = %s", (email, status))

// Java (JDBC)
PreparedStatement ps = conn.prepareStatement("SELECT id FROM users WHERE email = ?");
ps.setString(1, email);

// Dynamic ORDER BY: allowlist, not parameter
if (!["name","created_at"].includes(sortColumn)) sortColumn = "name";`},
{h:'Types of injection'},
{ul:['**In-band:** results or errors appear in the response (union based, error based).','**Blind:** the page behaves differently for true and false, or response time differs (`SLEEP`), so data leaks one bit at a time.','**Second-order:** malicious input is stored safely, then used unsafely in a later query.']},
{h:'Other application-level protections'},
{ul:['Do not use accounts with administrative privileges for the application.','Store passwords as **salted slow hashes** (bcrypt, scrypt, Argon2) in the application, never plaintext or the MySQL password function.','Limit what a failed query reveals, and monitor for unusual statements (very long queries, `UNION`, `information_schema` access) in the audit or slow logs.','Consider a web application firewall as an extra layer, not the first.']},
{note:'Escaping functions are error-prone and depend on character set. Use parameterised queries instead of building escaped strings.'}],
src:[['SQL injection',K.D+'sql-injection.html'],['Prepared statements',K.D+'sql-prepared-statements.html']]};
})();
