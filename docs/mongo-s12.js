/* LearnSphere - MongoDB, Section 12: Security.
   Lectures 0-6 are core, 7-8 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const layers=M.dg(700,200,[
[10,10,680,180,'Defense in depth',1],
[30,45,150,60,'Network|firewall, private|network, bindIp',2],[200,45,150,60,'Transport|TLS',2],[370,45,150,60,'Access|authn and RBAC',2],[540,45,130,60,'Data|encryption at rest',2],
[30,120,640,50,'Operations: auditing, patching, least-privilege OS account, secrets management, backups',0]],
[]);

const authz=M.dg(700,130,[
[10,10,680,110,'Authentication then authorization',1],
[30,50,130,50,'Client|connects',0],[200,50,150,50,'Authentication|who are you',2],[390,50,150,50,'Authorization|what may you do',2],[580,50,90,50,'Operation|runs',0]],
[[160,75,200,75],[350,75,390,75],[540,75,580,75]]);

const rbac=M.dg(700,140,[
[10,10,680,120,'Role-based access control',1],
[30,55,120,50,'User',0],[190,55,120,50,'Role',2],[350,55,150,50,'Privilege|actions on a resource',0],[540,55,130,50,'Resource|db or collection',0]],
[[150,80,190,80],[310,80,350,80],[500,80,540,80]]);

const tls=M.dg(700,120,[
[10,10,680,100,'Encrypted in transit',1],
[30,45,150,50,'Application|driver',0],[260,45,170,50,'TLS|certificates',2],[510,45,160,50,'mongod / mongos',0]],
[[180,70,260,70],[430,70,510,70]]);

/* ---------- 0: checklist ---------- */
L['mongo:11:0']={blocks:[
{p:'An unprotected MongoDB exposed to the internet is the most common cause of database breaches. Security is built in layers, so one failure does not expose everything.'},
{svg:layers},
{h:'The checklist'},
{t:[['#','Control','How'],
['1','**Enable access control**','`security.authorization: enabled`'],
['2','**Use strong authentication**','SCRAM-SHA-256, x.509, or enterprise methods'],
['3','**Least-privilege roles**','Built-in or custom roles per application'],
['4','**Encrypt traffic**','TLS for clients and between members'],
['5','**Limit network exposure**','`bindIp`, firewall, private networks'],
['6','**Encrypt data at rest**','Storage engine, disk or Atlas encryption'],
['7','**Audit access**','Audit log (Enterprise, Atlas)'],
['8','**Keep patched**','Latest patch of a supported version'],
['9','**Protect secrets**','Secret manager, rotate credentials'],
['10','**Run safely**','Dedicated OS user, disable unused features']]},
{h:'How breaches usually happen'},
{ul:['Default install, **no authentication**, listening on all interfaces.','Credentials committed to source control or shared in chat.','An application user with **admin** privileges used for everything.','Old unpatched versions with known issues.']},
{note:'Treat the database as sensitive even in test environments: leaked test data often contains real customer data.'}],
src:[['Security checklist',MAN+'administration/security-checklist/'],['Security',MAN+'security/']]};

/* ---------- 1: authentication ---------- */
L['mongo:11:1']={blocks:[
{p:'**Authentication** verifies who is connecting. MongoDB supports several mechanisms; the right choice depends on your environment and edition.'},
{svg:authz},
{t:[['Mechanism','Edition','Use'],
['**SCRAM-SHA-256**','All','Default password mechanism for database users'],
['**x.509 certificates**','All','Cluster members and certificate-based users'],
['**LDAP proxy authentication**','Enterprise, Atlas','Central directory logins'],
['**Kerberos**','Enterprise','Single sign-on in Active Directory environments'],
['**OpenID Connect (OIDC)**','Enterprise, Atlas','Identity provider login (Entra ID, Okta and others)'],
['**AWS IAM**','Atlas','Roles for workloads on AWS']]},
{h:'First user: the localhost exception'},
{p:'When access control is enabled and **no users exist**, you can connect from localhost and create the first administrator.'},
{code:`use admin
db.createUser({
  user: "admin",
  pwd: passwordPrompt(),         // prompts instead of storing the password in history
  roles: [ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" ]
})`},
{h:'Application users'},
{code:`use shop
db.createUser({
  user: "shopapp",
  pwd: passwordPrompt(),
  roles: [ { role: "readWrite", db: "shop" } ]
})

// connect
mongosh "mongodb://localhost/shop" --username shopapp --authenticationDatabase shop`},
{h:'Internal authentication'},
{ul:['Replica set and sharded cluster members authenticate with a **key file** or **x.509 certificates**.','Key files are simple; x.509 is stronger for production because each member has its own identity.']},
{note:'Use `passwordPrompt()` or a secret manager. Avoid putting a password in a command that is saved in shell history.'}],
src:[['Authentication',MAN+'core/authentication/'],['SCRAM',MAN+'core/security-scram/']]};

/* ---------- 2: RBAC ---------- */
L['mongo:11:2']={blocks:[
{p:'**Authorization** decides what an authenticated user may do. MongoDB uses **role-based access control**: users get roles, roles hold privileges, privileges are actions on resources.'},
{svg:rbac},
{h:'Built-in roles you will use'},
{t:[['Role','Scope','Allows'],
['`read`','One database','Read all non-system collections'],
['`readWrite`','One database','Read and write'],
['`dbAdmin`','One database','Indexes, stats, validation, no data access'],
['`userAdmin`','One database','Create users and roles'],
['`dbOwner`','One database','All of readWrite, dbAdmin, userAdmin'],
['`clusterMonitor`','Cluster','Read-only monitoring commands'],
['`backup` / `restore`','Cluster','Back up and restore'],
['`readAnyDatabase`, `readWriteAnyDatabase`','All databases','Wide access: use sparingly'],
['`root`','All','Everything: avoid for applications']]},
{h:'Custom roles'},
{code:`use admin
db.createRole({
  role: "orderReader",
  privileges: [
    { resource: { db: "shop", collection: "orders" }, actions: [ "find" ] },
    { resource: { db: "shop", collection: "products" }, actions: [ "find" ] }
  ],
  roles: []
})
db.grantRolesToUser("reportuser", [ { role: "orderReader", db: "admin" } ])`},
{h:'Practices'},
{ul:['Give each application its **own user** and the minimum roles.','Separate **human** administrator accounts from application accounts.','Use `clusterMonitor` for monitoring tools, not an admin account.','Review roles regularly with `db.getUsers()` and `db.getRoles({ showPrivileges: true })`.']}],
src:[['Role-based access control',MAN+'core/authorization/'],['Built-in roles',MAN+'reference/built-in-roles/']]};

/* ---------- 3: TLS and network ---------- */
L['mongo:11:3']={blocks:[
{p:'Without **TLS** passwords and data cross the network in readable form. Network controls keep unwanted clients away from the port altogether.'},
{svg:tls},
{h:'Server TLS configuration'},
{code:`net:
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/ssl/mongo/server.pem
    CAFile: /etc/ssl/mongo/ca.pem
  bindIp: 10.0.0.12`},
{h:'Connect with TLS'},
{code:`mongosh "mongodb://mongo1.example.net:27017/?tls=true" \\
  --tlsCAFile /etc/ssl/mongo/ca.pem`},
{h:'TLS in a cluster'},
{ul:['Use TLS for **client to server** and for **member to member** traffic.','Certificates must match the **hostnames** used to connect.','Plan **rotation**: certificates expire, and rotating them needs a rolling restart or live reload.','Do not disable certificate validation in production.']},
{h:'Network controls'},
{t:[['Control','Purpose'],
['`bindIp`','Listen only on needed interfaces'],
['Firewall or security groups','Allow only application and administration hosts to port 27017'],
['Private network or VPN','Never expose the port to the public internet'],
['Separate management access','Bastion host or VPN for administrators'],
['Private endpoints (Atlas)','Reach Atlas without public internet']]},
{note:'Authentication without TLS still leaks data. TLS without authentication still lets anyone read. Use both.'}],
src:[['TLS/SSL configuration',MAN+'tutorial/configure-ssl/'],['Network and configuration hardening',MAN+'core/security-hardening/']]};

/* ---------- 4: encryption ---------- */
L['mongo:11:4']={blocks:[
{p:'Encryption protects data when files or backups are stolen and, with client-side encryption, even from the database administrator.'},
{h:'Three layers'},
{t:[['Layer','Protects against','How'],
['**In transit**','Network sniffing','TLS'],
['**At rest**','Stolen disks, snapshots and backups','Encrypted storage engine (Enterprise), disk or volume encryption, Atlas encryption'],
['**Client side**','Server operators and server compromise','Client-side field level encryption (CSFLE) and Queryable Encryption']]},
{h:'Encryption at rest'},
{ul:['**Enterprise**: the WiredTiger **encrypted storage engine** with AES-256, keys held in a **KMIP** server or a local key file.','**Community**: use **file system or volume encryption** (for example dm-crypt, cloud volume encryption).','**Atlas**: data and backups are encrypted by default; you can supply your own keys through a cloud KMS.']},
{h:'Client-side field level encryption'},
{p:'The **driver** encrypts selected fields before they leave the application. The server stores and indexes ciphertext. Keys live in a key management service, so even someone with full database access cannot read those fields.'},
{flow:['Application encrypts sensitive fields with a data key','Driver sends ciphertext to MongoDB','MongoDB stores it without ever seeing plaintext','Authorized clients with key access decrypt on read']},
{h:'Key management'},
{ul:['Keep keys in a **KMS** (cloud KMS, KMIP) separate from the data.','Plan **key rotation** and who can use the keys.','Test restoring encrypted backups.']},
{note:'Queryable Encryption goes further and lets you run certain queries on encrypted fields. It is covered as an additional topic.'}],
src:[['Encryption',MAN+'core/security-encryption/'],['Encryption at rest',MAN+'core/security-encryption-at-rest/'],['Client-side field level encryption',MAN+'core/csfle/']]};

/* ---------- 5: auditing ---------- */
L['mongo:11:5']={blocks:[
{p:'**Auditing** records who did what: authentication events, privilege changes, schema changes and, if configured, data access. It supports investigations and compliance.'},
{h:'Where it is available'},
{t:[['Platform','Auditing'],
['Community','Not available as a feature; rely on logs and external tools'],
['Enterprise','Built-in audit log with filters'],
['Atlas','Database auditing on dedicated tiers, plus access logs and activity feed']]},
{h:'Enterprise audit configuration'},
{code:`auditLog:
  destination: file
  format: JSON
  path: /var/log/mongodb/audit.json
  filter: '{ atype: { $in: [ "authenticate", "createUser", "dropCollection", "dropDatabase" ] } }'`},
{h:'What to audit'},
{ul:['**Authentication** successes and failures.','**Authorization** failures (someone trying things they are not allowed).','**User and role changes**.','**Schema** operations: create or drop collections, indexes, databases.','Optionally **reads and writes** of sensitive collections (large volume).']},
{h:'Compliance mapping'},
{t:[['Requirement','Control'],
['Know who accessed regulated data','Authentication and read auditing, role separation'],
['Detect unauthorized changes','Audit of DDL and role changes'],
['Retain evidence','Ship audit logs to a protected central store'],
['Show access reviews','Regular role and user reports']]},
{note:'Audit filters keep volume manageable. Auditing everything on a busy system can hurt performance and fill disks.'}],
src:[['Auditing',MAN+'core/auditing/'],['Configure auditing',MAN+'tutorial/configure-auditing/']]};

/* ---------- 6: atlas security ---------- */
L['mongo:11:6']={blocks:[
{p:'Atlas applies many controls by default (TLS, encryption at rest, authentication), and gives you tools to restrict who and what can connect. You still configure access.'},
{h:'Atlas controls'},
{t:[['Control','What it does'],
['**IP access list**','Only listed IP addresses or CIDR ranges may connect'],
['**Database users**','Users with built-in or custom roles, scoped to clusters'],
['**Private endpoints**','Connect over cloud provider private networking (PrivateLink or equivalent)'],
['**VPC or VNet peering**','Private network path to your cloud network'],
['**Federated and OIDC authentication**','Sign in with your identity provider'],
['**Customer-managed keys**','Your KMS key encrypts cluster data'],
['**Database auditing**','Audit log on dedicated tiers'],
['**Organization and project roles**','Control who administers Atlas itself']]},
{h:'Secure by design checklist'},
{flow:['Create a project per environment','Create database users with least privilege','Add only required IP addresses (never 0.0.0.0/0 in production)','Prefer private endpoints for application traffic','Enable auditing and alerts','Review access regularly']},
{ul:['**Organization access** (who manages Atlas) is separate from **database access** (who queries data).','Use **service accounts and secrets managers** for application credentials.']},
{note:'Allowing access from anywhere (0.0.0.0/0) in the IP access list exposes the cluster to the whole internet. It is fine for a short lab, not for real data.'}],
src:[['Atlas security',M.ATLAS+'security/'],['Atlas private endpoints',M.ATLAS+'security-private-endpoint/']]};
})();
