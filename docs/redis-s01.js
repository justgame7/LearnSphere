/* LearnSphere - Redis, Section 01: Introduction & Redis Foundations.
   Lectures 0-7 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const path=K.dg(700,200,[
[10,10,680,180,'The learning path',1],
[25,60,100,60,'Foundations|and data types',0],[145,60,100,60,'Memory and|persistence',0],[265,60,100,60,'Replication|and Sentinel',0],[385,60,100,60,'Cluster|and security',0],[505,60,80,60,'Operate and|monitor',0],[605,60,70,60,'Patterns',2]],
[[125,90,145,90],[245,90,265,90],[365,90,385,90],[485,90,505,90],[585,90,605,90]]);

const place=K.dg(700,210,[
[10,10,680,190,'Where Redis usually sits',1],
[30,70,120,60,'Application|servers',0],[240,70,140,60,'Redis|in memory',2],[500,40,160,50,'Primary database|PostgreSQL, MongoDB',0],[500,120,160,50,'Disk: RDB and AOF|(optional)',0]],
[[150,100,240,100],[380,100,500,65],[380,100,500,145]]);

const loop=K.dg(700,230,[
[10,10,680,210,'One Redis server process',1],
[30,60,110,60,'Many client|connections',0],[190,60,130,60,'Event loop|(one thread)',2],[380,60,130,60,'Execute one|command at a time',2],[560,60,110,60,'Reply',0],
[190,150,130,44,'I/O threads (optional)',0],[380,150,290,44,'Background: fork, lazy free, fsync',0]],
[[140,90,190,90],[320,90,380,90],[510,90,560,90],[255,150,255,120]]);

/* ---------- 0 ---------- */
L['redis:0:0']={blocks:[
{p:'**Redis** is an in-memory data structure server. Applications use it to make things fast (caches, sessions, counters, leaderboards), to move work around (queues, streams, messages) and, increasingly, as a primary store for data that must be quick to read and write. This course takes you from the first command to running Redis in production.'},
{h:'What you will be able to do'},
{ul:['Pick the right data structure for a requirement and use it correctly.','Control memory, eviction and expiry so a node stays healthy.','Choose persistence and replication settings that match how much data you can afford to lose.','Run Sentinel or Cluster and explain how each fails over.','Secure a deployment with ACLs, TLS and network isolation.','Measure, monitor and troubleshoot a running instance.','Apply proven application patterns: caching, rate limiting, locks, queues and leaderboards.']},
{svg:path},
{h:'Prerequisites'},
{t:[['You should know','If not'],
['Basic command line use','Practise cd, ls, editing files and running commands in a Linux shell'],
['What a client and a server are','Read the next two lessons carefully: they cover it'],
['A programming language (any)','Most examples use redis-cli. Application code is shown rarely and only briefly'],
['Basic networking: IP, port, TCP','Redis listens on a TCP port, 6379 by default']]},
{h:'How to use the course'},
{ul:['Sections build on one another. Complete 1 to 4 before the operations sections.','Run every command against a scratch instance. A Docker container is enough.','Each section ends with a quiz. Use the quick reference for revision and maps for the big picture.']},
{note:'Commands in this course target Redis 8 (Redis Open Source). Where a feature needs a specific version it is marked. Always check the release notes for the version you run.'}],
src:[['Redis documentation',K.D],['Redis commands',K.CMD]]};

/* ---------- 1 ---------- */
L['redis:0:1']={blocks:[
{p:'Redis stands for **RE**mote **DI**ctionary **S**erver. At its core it is a dictionary: you store a **value** under a **key**. What makes it different is that the value is not just a blob. It can be a string, list, hash, set, sorted set, stream or another structure, and the server has commands that operate on those structures directly.'},
{h:'The three ideas'},
{t:[['Idea','Meaning','Consequence'],
['In-memory','The working dataset lives in RAM','Sub-millisecond latency, but capacity is limited by memory'],
['Data structures','Values are typed structures with their own commands','Work is done on the server, with less data over the network'],
['Single command at a time','Commands execute one after another','Every command is atomic, with no locks to reason about']]},
{h:'A first look'},
{code:`SET user:1:name "Ana"
GET user:1:name
LPUSH recent:logins "ana" "ben"
LRANGE recent:logins 0 -1
ZADD scores 120 "ana" 95 "ben"
ZRANGE scores 0 -1 WITHSCORES`},
{p:'Each of these is one atomic operation. Pushing onto a list, adding a member to a sorted set, incrementing a counter: none of them need a read, a change in application code and a write back.'},
{h:'What Redis is not'},
{ul:['**Not a relational database.** There are no joins, no ad hoc SQL and no schema. You design keys around your queries.','**Not only a cache.** It can persist data and run as a primary store, but the design is memory first.','**Not a message broker with every feature.** Streams and Pub/Sub cover a lot, but it is not a drop-in replacement for a full broker.']}],
src:[['Redis introduction',K.D+'get-started/'],['Data types',K.DT]]};

/* ---------- 2 ---------- */
L['redis:0:2']={blocks:[
{p:'Redis is a good fit when the data is accessed by key, must be returned quickly and has a shape that one of its structures describes naturally. It is a poor fit when you need complex queries across large, rarely used data.'},
{svg:place},
{h:'Common uses'},
{t:[['Use case','Structure often used','Why Redis fits'],
['Cache','String, hash','Fast reads, TTL built in, eviction'],
['Session store','Hash, string','Expiry and quick lookup'],
['Rate limiting and counters','String counters, sorted set','Atomic increments'],
['Leaderboards','Sorted set','Ranking is built in'],
['Queues and event streams','List, stream','Blocking reads, consumer groups'],
['Real-time messaging','Pub/Sub, stream','Low latency fan-out'],
['Search, vectors, JSON documents','Query Engine, JSON, vector set','Indexing inside the data store']]},
{h:'When another system is a better answer'},
{ul:['**The dataset is much larger than affordable RAM** and most of it is cold. A disk-based database is cheaper.','**You need relational queries, joins and strong multi-row transactions.**','**Zero data loss is mandatory** and you cannot accept the durability trade-offs of asynchronous replication. Consider a database built for it, or use Redis as a derived copy.','**Long-running analytics** over huge scans. Redis is built for many small operations.']},
{note:'A common, healthy architecture keeps the system of record in a database and uses Redis in front of it for speed. Section 16 returns to when Redis can be the primary store.'}],
src:[['Redis use cases',K.D+'develop/get-started/'],['Redis data types',K.DT]]};

/* ---------- 3 ---------- */
L['redis:0:3']={blocks:[
{p:'The word Redis now covers more than one product, and a licence change in 2024 and 2025 makes it worth understanding who ships what.'},
{h:'Licence history in brief'},
{t:[['Period','Licence of the server','Notes'],
['Up to Redis 7.2','BSD three-clause','Fully open source'],
['Redis 7.4 to 7.x','RSALv2 or SSPLv1','Source available, not OSI open source'],
['Redis 8.0 and later','RSALv2, SSPLv1 or AGPLv3 (your choice)','AGPLv3 made it open source again']]},
{p:'The 2024 change prompted the community fork **Valkey**, hosted by the Linux Foundation and started from Redis 7.2.4 under the BSD licence. It is largely command compatible with Redis 7.2 and has since added its own features.'},
{h:'Products and names'},
{t:[['Name','What it is'],
['Redis Open Source','The community server. From Redis 8 it includes JSON, Query Engine, time series, probabilistic types and vector sets in the same package'],
['Redis Stack','Earlier bundle of the server plus modules. Its contents are merged into Redis Open Source from Redis 8'],
['Redis Software','Commercial, self-managed enterprise product (clustering, active-active, tiering)'],
['Redis Cloud','Managed service run by Redis'],
['Valkey','BSD fork, offered by many cloud providers']]},
{h:'Reading a version'},
{p:'A version is major.minor.patch. Patches fix bugs and security issues. Minor releases add features. Plan upgrades with the release notes, and keep to a supported minor version that still receives fixes.'},
{note:'Managed services from cloud providers may run Redis OSS, Valkey or their own compatible engine, and may be on an older version. Check the engine and version in the service documentation before relying on a new feature.'}],
src:[['Redis releases',K.D+'about/'],['Redis Open Source',K.D+'operate/oss_and_stack/'],['Valkey','https://valkey.io/']]};

/* ---------- 4 ---------- */
L['redis:0:4']={blocks:[
{p:'Redis executes commands on **one thread**. That single decision explains most of its behaviour: why each command is atomic, why a slow command hurts everyone, and why scaling out means more instances rather than more cores on one.'},
{svg:loop},
{h:'The event loop'},
{flow:['Clients connect and send commands over TCP','The event loop reads requests from ready sockets','Each command is executed to completion, one at a time','The reply is written back to the client','The loop continues with the next ready client']},
{h:'What is not on the main thread'},
{t:[['Work','Where it happens'],
['Reading and writing sockets, parsing','Main thread, or I/O threads when enabled'],
['RDB snapshots','A forked child process'],
['AOF rewrite','A forked child process'],
['AOF fsync, closing files, lazy freeing','Background threads'],
['Command execution','Always the main thread']]},
{h:'What this means for you'},
{ul:['Atomicity is free: no other command runs in the middle of one.','One slow command, such as a huge `KEYS *`, blocks all clients while it runs.','CPU is rarely the first limit for simple commands. Network, memory and slow commands usually are.','To use more cores, run more instances (a cluster) or enable I/O threads for network work.']},
{note:'Redis 8 improved I/O threading so reads and writes of client data can use extra threads. Command execution is still serial.'}],
src:[['Redis latency and threading',K.MGT+'optimization/latency/'],['Redis architecture notes',K.D+'operate/oss_and_stack/']]};

/* ---------- 5 ---------- */
L['redis:0:5']={blocks:[
{p:'There are three common ways to run Redis for learning and production: the operating system package, a container, and a build from source. Use a package or container for almost everything.'},
{t:[['Method','When to use','Notes'],
['OS package or vendor repository','Servers, VMs','Service management and upgrades through the package manager'],
['Docker image','Local labs, CI, Kubernetes','Mount a volume if the data must survive the container'],
['Build from source','Specific version or custom build','You manage updates and service files']]},
{h:'Docker in one minute'},
{code:`docker run -d --name redis -p 6379:6379 redis:8
docker exec -it redis redis-cli ping
# PONG`},
{p:'The default image keeps data inside the container. For anything you want to keep, mount a volume on `/data`.'},
{code:`docker run -d --name redis -p 6379:6379 \\
  -v redis-data:/data redis:8 redis-server --appendonly yes`},
{h:'Linux package'},
{code:`# Debian and Ubuntu after adding the Redis repository
sudo apt-get install redis
sudo systemctl enable --now redis-server
redis-cli ping`},
{h:'Checking that it works'},
{ul:['`redis-cli ping` answers `PONG`.','`redis-cli INFO server` shows the version and run mode.','`redis-cli CONFIG GET port` shows the port in use.']},
{note:'Never publish a lab instance on a public address without authentication. Binding, protected mode and ACLs are covered in the Security section.'}],
src:[['Install Redis',K.D+'operate/oss_and_stack/install/'],['Redis on Docker',K.D+'operate/oss_and_stack/install/install-stack/docker/']]};

/* ---------- 6 ---------- */
L['redis:0:6']={blocks:[
{p:'**redis-cli** is the standard command line client. It sends commands, prints replies and offers helpers for administration. Understanding how it talks to the server also explains how every client library works.'},
{h:'Connecting'},
{code:`redis-cli                              # localhost:6379
redis-cli -h 10.0.0.5 -p 6380 -a secret
redis-cli --user app --pass secret --tls -h redis.example.com
redis-cli -n 2                         # logical database 2`},
{h:'Running commands'},
{code:`127.0.0.1:6379> SET greeting "hello"
OK
127.0.0.1:6379> GET greeting
"hello"
127.0.0.1:6379> EXISTS greeting missing
(integer) 1
127.0.0.1:6379> HELP SET`},
{h:'The wire protocol'},
{p:'Clients and servers speak **RESP** (Redis Serialization Protocol), a simple text-framed protocol. A command is an array of bulk strings, and the reply has a type: simple string, error, integer, bulk string, array and, in RESP3, maps, sets, doubles and more.'},
{code:`*3\\r\\n$3\\r\\nSET\\r\\n$5\\r\\ngreet\\r\\n$5\\r\\nhello\\r\\n
+OK\\r\\n`},
{h:'Handy redis-cli options'},
{t:[['Option','Use'],
['`--scan --pattern "user:*"`','Iterate keys safely with SCAN'],
['`--bigkeys`','Sample the keyspace for large keys'],
['`--latency`, `--latency-history`','Measure round trip time'],
['`--stat`','Rolling statistics'],
['`-x`','Read the last argument from standard input'],
['`--raw`','Print replies without quoting']]},
{note:'`MONITOR` streams every command the server receives. It is useful for a short look and expensive on a busy instance. Never leave it running in production.'}],
src:[['redis-cli',K.D+'develop/tools/cli/'],['RESP protocol',K.D+'develop/reference/protocol-spec/']]};

/* ---------- 7 ---------- */
L['redis:0:7']={blocks:[
{p:'Redis reads its settings from a **configuration file** at start (commonly `redis.conf`) and lets you view and change most of them at runtime with `CONFIG`.'},
{h:'Commands'},
{code:`CONFIG GET maxmemory
CONFIG GET *max-*-entries*
CONFIG SET maxmemory 2gb
CONFIG REWRITE`},
{t:[['Command','What it does'],
['CONFIG GET pattern','Show settings that match'],
['CONFIG SET name value','Change a setting now, in memory only'],
['CONFIG REWRITE','Write the running settings back into the config file'],
['CONFIG RESETSTAT','Reset counters in INFO']]},
{flow:['Edit redis.conf and restart: permanent, needs a restart','CONFIG SET: immediate, lost on restart','CONFIG REWRITE after CONFIG SET: makes the change permanent']},
{h:'Settings you meet first'},
{t:[['Setting','Purpose','Typical starting point'],
['bind','Interfaces to listen on','Private address only'],
['port','TCP port','6379'],
['protected-mode','Refuse outside access with no auth','yes'],
['requirepass or ACL users','Authentication','Set ACL users'],
['maxmemory','Memory limit','Set for caches and shared hosts'],
['appendonly','AOF persistence','Depends on data'],
['dir','Working directory for dumps and AOF','A dedicated disk path']]},
{note:'A few settings are immutable at runtime (for example some TLS and bind related items). `CONFIG SET` returns an error if it cannot apply one, so check the reply.'}],
src:[['Redis configuration',K.MGT+'config/'],['CONFIG SET',K.CMD+'config-set/']]};
})();
