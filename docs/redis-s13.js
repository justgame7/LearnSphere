/* LearnSphere - Redis, Section 13: Security.
   Lectures 0-5 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const layers=K.dg(700,230,[
[10,10,680,210,'Defence in depth',1],
[30,60,140,60,'Network|private subnet,|firewall',0],[190,60,140,60,'Bind and|protected mode',0],[350,60,140,60,'TLS|in transit',0],[510,60,160,60,'ACL users|least privilege',2],
[30,145,300,50,'Disable or limit dangerous commands',0],[350,145,320,50,'Patching, secrets and auditing',0]],
[]);

const acl=K.dg(700,200,[
[10,10,680,180,'An ACL user',1],
[30,60,130,60,'Name and state|on or off',0],[190,60,130,60,'Password|hashed',0],[350,60,150,60,'Commands|+get -@dangerous',2],[530,60,140,60,'Keys and channels|~app:* &events:*',2]],
[[160,90,190,90],[320,90,350,90],[500,90,530,90]]);

/* ---------- 0 ---------- */
L['redis:12:0']={blocks:[
{p:'Redis was designed for trusted networks. An instance that is reachable and unauthenticated gives an attacker full control: read and delete all data, and in the worst case run code on the host through configuration abuse. Most real incidents come from exposed instances.'},
{svg:layers},
{h:'Attacks that appear again and again'},
{ul:['Exposed port with no authentication: data theft, wiping and ransom notes.','`CONFIG SET dir` and `CONFIG SET dbfilename` followed by `SAVE`: writing files such as SSH keys or cron entries.','Loading a malicious module with `MODULE LOAD`.','Vulnerabilities in the Lua engine or parsers on unpatched versions.']},
{h:'Safe defaults to know'},
{t:[['Setting','Default intent','Notes'],
['bind 127.0.0.1 -::1','Listen on loopback only','Add private interfaces deliberately'],
['protected-mode yes','Refuse outside clients when no password or ACL is set','A safety net, not a security plan'],
['enable-protected-configs no','Block CONFIG SET of dangerous options','Needed for dir, dbfilename, modules'],
['enable-debug-command no','Block DEBUG','Leave off'],
['enable-module-command no','Block MODULE LOAD','Leave off']]},
{note:'Container images and some distributions bind to all interfaces so that published ports work. Publishing a port on a public interface then exposes Redis. Always combine a network boundary with authentication.'}],
src:[['Redis security',K.MGT+'security/']]};

/* ---------- 1 ---------- */
L['redis:12:1']={blocks:[
{p:'Since Redis 6 authentication is based on **ACL users**. The older `requirepass` still works and sets the password of the built-in `default` user.'},
{code:`# simple, legacy style
requirepass "a-long-random-secret"

# ACL style
ACL SETUSER app on >S3cretPass ~app:* +@read +@write -@dangerous
AUTH app S3cretPass
ACL WHOAMI
ACL LIST
ACL GETUSER app
ACL DELUSER app
ACL SAVE`},
{h:'The default user'},
{p:'Out of the box the `default` user is `on nopass ~* &* +@all`: everything for everyone who can connect. Give it a password, or switch it off after creating named users.'},
{h:'Persisting users'},
{t:[['Method','Behaviour'],
['aclfile /etc/redis/users.acl','One file, managed with ACL LOAD and ACL SAVE'],
['user lines in redis.conf','Static, CONFIG REWRITE cannot update them with ACL SAVE'],
['Managed service console','Provider specific']]},
{note:'Use a long random password, not a memorable one. Redis can check passwords very fast, so strength matters. Store hashes in files with `#<sha256>` instead of plain text where possible.'}],
src:[['ACL',K.MGT+'security/acl/'],['AUTH',K.CMD+'auth/']]};

/* ---------- 2 ---------- */
L['redis:12:2']={blocks:[
{p:'An ACL rule set says **which commands**, on **which keys**, and on **which channels** a user may use.'},
{svg:acl},
{t:[['Rule','Meaning'],
['on, off','Enable or disable the user'],
['>password, <password, #hash, nopass','Add or remove credentials'],
['+get, -set','Allow or deny a command'],
['+@read, -@dangerous','Allow or deny a category'],
['+config|get','Allow one subcommand'],
['~app:*','Key pattern (read and write)'],
['%R~cache:*, %W~out:*','Read-only or write-only key patterns'],
['allkeys, resetkeys','All keys, or clear patterns'],
['&events:*','Pub/Sub channel patterns'],
['(+get ~tmp:*)','A selector: an extra permission set (Redis 7+)']]},
{code:`ACL CAT
ACL CAT dangerous
ACL SETUSER reader on >pw ~* +@read -@dangerous
ACL SETUSER cache on >pw %R~prod:* %RW~tmp:* +@all -@dangerous
ACL DRYRUN reader SET k v
ACL LOG`},
{h:'Guidelines'},
{ul:['Create one user per application and role.','Start from nothing: `+@read`, `+@write` as needed, then deny `@dangerous` and `@admin`.','Use `ACL DRYRUN` to test, and `ACL LOG` to see denied attempts.','Pub/Sub channels are denied by default in 7.0 and later (`acl-pubsub-default resetchannels`).']}],
src:[['ACL rules',K.MGT+'security/acl/#acl-rules']]};

/* ---------- 3 ---------- */
L['redis:12:3']={blocks:[
{p:'**TLS** encrypts traffic between clients and servers, between replicas and primaries and between cluster nodes. It also allows **client certificate** authentication.'},
{code:`# redis.conf
port 0
tls-port 6379
tls-cert-file /etc/redis/tls/redis.crt
tls-key-file  /etc/redis/tls/redis.key
tls-ca-cert-file /etc/redis/tls/ca.crt
tls-auth-clients yes
tls-replication yes
tls-cluster yes
tls-protocols "TLSv1.2 TLSv1.3"

redis-cli --tls --cacert ca.crt --cert client.crt --key client.key -h redis.example.com`},
{t:[['Setting','Meaning'],
['port 0','Disable the plain TCP port'],
['tls-port','Port for TLS connections'],
['tls-auth-clients yes|no|optional','Require, ignore or accept client certificates'],
['tls-replication yes','Use TLS on the replication link'],
['tls-cluster yes','Use TLS for the cluster bus and redirections']]},
{h:'Operational points'},
{ul:['Redis must be built with TLS support. Official packages and images include it.','Certificates expire. Automate renewal and test reload with `CONFIG SET tls-cert-file`.','TLS adds CPU cost. Enable I/O threads when throughput matters.','Sentinels and clients need the same CA to talk to nodes.']},
{note:'On a trusted private network some teams skip TLS. For anything crossing networks you do not control, or for compliance, enable it.'}],
src:[['TLS',K.MGT+'security/encryption/']]};

/* ---------- 4 ---------- */
L['redis:12:4']={blocks:[
{p:'Treat the network as the first and strongest layer.'},
{h:'Network'},
{ul:['Run Redis in a private subnet. No public IP and no inbound rule from the internet.','Allow only the application subnets or security groups on the client port, and the cluster bus port between nodes.','Bind to specific private addresses, not `0.0.0.0` unless a firewall guarantees isolation.','Use a bastion or a private connection for administrators.']},
{h:'Dangerous commands'},
{t:[['Command','Risk'],
['FLUSHALL, FLUSHDB','Delete all data'],
['KEYS, SMEMBERS on big sets','Latency'],
['CONFIG','Change settings, write files'],
['DEBUG, MODULE','Run internals, load code'],
['SHUTDOWN, REPLICAOF, CLUSTER','Availability'],
['SCRIPT, EVAL, FUNCTION','Server side code']]},
{code:`ACL SETUSER app on >pw ~app:* +@all -@dangerous -@admin
ACL SETUSER ops on >pw ~* +@all`},
{note:'`rename-command` is the older way to hide commands and is discouraged because it breaks tools and clients. Use ACLs. Managed services often block `CONFIG` and `DEBUG` for you.'}],
src:[['Security',K.MGT+'security/']]};

/* ---------- 5 ---------- */
L['redis:12:5']={blocks:[
{p:'Security is a process. Detect misuse, protect secrets and review regularly.'},
{h:'Auditing'},
{ul:['`ACL LOG` records denied commands, key access and failed authentication.','`SLOWLOG` and `CLIENT LIST` show who is running what.','Ship server logs and provider audit logs (for example cloud trail features) to a central place.','`MONITOR` is not an audit tool: it is costly and unstructured.']},
{h:'Secrets'},
{ul:['Do not commit passwords in config files in repositories.','Restrict file permissions: config and ACL file readable only by the redis user.','Use a secrets manager or orchestrator secrets to inject credentials.','Rotate passwords: add the new one with `>new`, move clients, then remove `<old`.']},
{h:'Hardening checklist'},
{t:[['Check','Done when'],
['Not reachable from the internet','Verified from outside'],
['Authentication on','default user off or has a strong password'],
['Application users least privilege','No +@all, no @dangerous'],
['TLS where needed','port 0 or TLS required'],
['Protected configs and debug off','enable-* settings are no'],
['Patched version','Running a supported release with security fixes'],
['Backups encrypted and tested','Restore verified'],
['Monitoring and alerts','ACL LOG and error rate watched']]},
{note:'Keep up with security advisories for Redis, Valkey and your managed service. Some vulnerabilities require only a client that can run scripts, so patch quickly and limit who can use `EVAL`.'}],
src:[['Security',K.MGT+'security/'],['Redis security advisories','https://redis.io/security/']]};
})();
