/* LearnSphere - MongoDB, Section 03: Installation, Configuration & Connecting.
   Lectures 0-6 are core, 7-8 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const lab=M.dg(700,190,[
[10,10,680,170,'Three ways to get a lab',1],
[30,50,190,110,'Atlas free cluster|no install|needs internet|good for first steps',2],
[255,50,190,110,'Docker container|one command|data in a volume|easy to throw away',0],
[480,50,190,110,'Local install|Community Edition|closest to real|self-managed work',0]],
[]);

const inst=M.dg(700,110,[
[10,25,130,60,'Add the|MongoDB repo|and key',0],[170,25,130,60,'Install|mongodb-org',0],[330,25,130,60,'Edit|mongod.conf',2],
[490,25,90,60,'Start|service',0],[610,25,80,60,'Connect|mongosh',0]],
[[140,55,170,55],[300,55,330,55],[460,55,490,55],[580,55,610,55]]);

const uri=M.dg(700,130,[
[10,20,680,90,'mongodb+srv://user:pass@cluster0.abc.mongodb.net/shop?retryWrites=true&w=majority',1],
[30,55,110,40,'Scheme',0],[160,55,150,40,'Credentials',0],[330,55,150,40,'Host or SRV name',2],[500,55,80,40,'Database',0],[600,55,80,40,'Options',0]],
[]);

const pool=M.dg(700,150,[
[10,10,680,130,'Driver connection pool',1],
[30,55,120,50,'App threads|or requests',0],[190,55,150,50,'Pool|maxPoolSize 100|default',2],[380,55,130,50,'Monitor threads|find the primary',0],[550,55,120,50,'mongod|members',0]],
[[150,80,190,80],[340,80,380,80],[510,80,550,80]]);

/* ---------- 0: Lab setup ---------- */
L['mongo:2:0']={blocks:[
{p:'Before the next sections you need somewhere to run commands. Pick the option that matches how you will work. All three give the same MongoDB for learning.'},
{svg:lab},
{h:'Comparison'},
{t:[['Option','Setup time','Best for','Watch out for'],
['**Atlas free cluster**','5 minutes','Learning queries, modeling, Atlas features','Network access list and limited features on the free tier'],
['**Docker**','2 minutes','Quick, disposable labs and testing','Persist data with a volume; set auth if you expose the port'],
['**Local install**','15 minutes','Self-managed topics: config, replica sets, backup','You manage the service and files']]},
{h:'Docker lab in two commands'},
{code:`docker run -d --name mongo-lab -p 27017:27017 \\
  -v mongo-lab-data:/data/db mongodb/mongodb-community-server:latest

docker exec -it mongo-lab mongosh`},
{h:'Atlas free cluster'},
{flow:['Create an Atlas account and a project','Create a free cluster (M0)','Add a database user and a password','Add your IP address to the network access list','Copy the connection string and connect with mongosh or Compass']},
{h:'Lab safety rules'},
{ul:['Use **sample or generated data**, never real customer data.','Destructive commands (drop, deleteMany with an empty filter) are safe in a lab but check the database name first with `db.getName()`.','Do not expose a lab mongod to the internet without authentication.','Delete cloud clusters you no longer need.']},
{note:'Section 10 builds a three-node replica set in containers or on one machine so you can practice failover without cost.'}],
src:[['Get started with Atlas',M.ATLAS+'getting-started/'],['Install with Docker',MAN+'tutorial/install-mongodb-community-with-docker/']]};

/* ---------- 1: Installing ---------- */
L['mongo:2:1']={blocks:[
{p:'Production installs use the **official package** for your operating system, so upgrades, the service unit and default paths are standard. The pattern is the same on every platform.'},
{svg:inst},
{h:'Package names and default locations'},
{t:[['Item','Linux package install','Windows MSI'],
['**Server package**','`mongodb-org` (server, mongosh, tools)','MongoDB Community Server MSI'],
['**Config file**','`/etc/mongod.conf`','`bin\\mongod.cfg` under the install folder'],
['**Data directory**','`/var/lib/mongodb`','`C:\\Program Files\\MongoDB\\Server\\8.0\\data`'],
['**Log file**','`/var/log/mongodb/mongod.log`','`...\\log\\mongod.log`'],
['**Service name**','`mongod`','MongoDB Server (service)']]},
{h:'Ubuntu example (repository and key steps shortened)'},
{code:`# 1. Import the public key and add the repository (see the install page for your version)
# 2. Install
sudo apt-get update
sudo apt-get install -y mongodb-org

# 3. Start and enable at boot
sudo systemctl start mongod
sudo systemctl enable mongod

# 4. Verify
sudo systemctl status mongod
mongosh --eval "db.runCommand({ ping: 1 })"`},
{h:'After installing'},
{ul:['The default configuration listens on **localhost only** and has **no authentication**. Do not open it to a network yet.','Check the log file for startup warnings (for example about transparent huge pages or file limits).','Set the data directory on a dedicated volume before loading data.','Pin the package version if you do not want unplanned major upgrades.']},
{note:'The install page for each OS shows the exact repository lines and key for each version. Copy from there rather than from memory.'}],
src:[['Install on Ubuntu',MAN+'tutorial/install-mongodb-on-ubuntu/'],['Install on Red Hat or CentOS',MAN+'tutorial/install-mongodb-on-red-hat/'],['Install on Windows',MAN+'tutorial/install-mongodb-on-windows/']]};

/* ---------- 2: mongod.conf ---------- */
L['mongo:2:2']={blocks:[
{p:'The **configuration file** is a YAML file read when mongod starts. Anything you can put in it can also be a command-line option, but a file is easier to review and keep in version control.'},
{h:'The most important settings'},
{t:[['Section.key','Purpose','Typical value'],
['`storage.dbPath`','Where data files live','`/var/lib/mongodb`'],
['`systemLog.path`','Log file path','`/var/log/mongodb/mongod.log`'],
['`systemLog.logAppend`','Append instead of overwrite on restart','`true`'],
['`net.port`','Listen port','`27017`'],
['`net.bindIp`','Interfaces to listen on','`127.0.0.1` or specific private IPs'],
['`security.authorization`','Turn on access control','`enabled`'],
['`replication.replSetName`','Name of the replica set','`rs0`'],
['`sharding.clusterRole`','Role in a sharded cluster','`shardsvr` or `configsvr`'],
['`operationProfiling`','Slow operation threshold and profiling mode','`slowOpThresholdMs: 100`']]},
{h:'A reasonable starting file'},
{code:`storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  path: /var/log/mongodb/mongod.log
  logAppend: true
net:
  port: 27017
  bindIp: 127.0.0.1,10.0.0.12
security:
  authorization: enabled
replication:
  replSetName: rs0`},
{h:'Check what the server is actually using'},
{code:`// Options the running server started with
db.adminCommand({ getCmdLineOpts: 1 })

// Individual runtime parameters
db.adminCommand({ getParameter: 1, slowms: 1 })`},
{h:'Rules'},
{ul:['YAML uses **spaces**, not tabs, and the indentation is meaningful.','Most changes need a **restart**. A few parameters can be changed at runtime with `setParameter`.','Open `bindIp` only to private interfaces you need and **enable authorization** at the same time.','Keep the file under change control.']},
{note:'Setting `bindIp` to `0.0.0.0` without authentication and a firewall is the classic cause of exposed MongoDB databases.'}],
src:[['Configuration file options',MAN+'reference/configuration-options/'],['Self-managed configuration file',MAN+'administration/configuration/']]};

/* ---------- 3: mongosh ---------- */
L['mongo:2:3']={blocks:[
{p:'**mongosh** is the MongoDB shell: a command-line client with a JavaScript runtime. It replaced the older `mongo` shell, which was removed in 6.0. It works with Atlas and any self-managed server.'},
{h:'Connecting'},
{code:`# Local server
mongosh

# Remote or Atlas with a connection string
mongosh "mongodb+srv://cluster0.abc.mongodb.net/shop" --username asha

# Run one command and exit
mongosh --quiet --eval "db.runCommand({ ping: 1 })"

# Run a script file
mongosh --file setup.js "mongodb://localhost:27017/shop"`},
{h:'Everyday helpers'},
{t:[['Command','What it does'],
['`show dbs`','List databases'],
['`use shop`','Switch current database (does not create it yet)'],
['`show collections`','List collections in the current database'],
['`db.getName()`','Name of the current database'],
['`db.orders.find()`','Query a collection'],
['`db.getSiblingDB("admin")`','Reach another database from a script'],
['`it`','Show the next batch of results'],
['`exit` or `quit()`','Leave the shell']]},
{h:'Useful features'},
{ul:['Full **JavaScript**: variables, functions, loops. Good for small admin scripts.','Syntax highlighting and autocomplete.','`.mongoshrc.js` for startup code and `config.set()` for preferences.','`printjson()` and `.pretty()` style output are built in; results are already formatted.']},
{h:'A small script'},
{code:`// count documents in every collection of the current database
db.getCollectionNames().forEach(name => {
  print(name + ": " + db.getCollection(name).countDocuments({}));
});`},
{note:'The shell and drivers are different things. mongosh is for administration and exploration. Applications use a driver for their language.'}],
src:[['mongosh documentation',M.SH],['Connect to a deployment',M.SH+'connect/']]};

/* ---------- 4: Connection strings, drivers ---------- */
L['mongo:2:4']={blocks:[
{p:'Applications connect with a **connection string** (URI). It carries the host list, credentials and options. **Drivers** parse it, discover the topology and manage a pool of connections.'},
{svg:uri},
{h:'Two URI formats'},
{t:[['Format','Looks like','Notes'],
['**Standard**','`mongodb://h1:27017,h2:27017,h3:27017/shop?replicaSet=rs0`','You list every member'],
['**SRV**','`mongodb+srv://cluster0.abc.mongodb.net/shop`','One DNS name. DNS SRV and TXT records list the members and options. TLS is on by default. Used by Atlas.']]},
{h:'Options you meet often'},
{t:[['Option','Meaning'],
['`replicaSet`','Name of the replica set to connect to'],
['`authSource`','Database that holds the user (often `admin`)'],
['`retryWrites`, `retryReads`','Retry once after transient errors (retryWrites is true by default in modern drivers)'],
['`w`, `readConcernLevel`, `readPreference`','Consistency settings (Section 9)'],
['`maxPoolSize`','Maximum connections per host in the driver pool (default 100)'],
['`serverSelectionTimeoutMS`','How long to wait to find a suitable server'],
['`tls`','Encrypt traffic']]},
{h:'How a driver connects to a replica set'},
{svg:pool},
{flow:['Driver reads the seed list from the URI','It connects and asks the server for the full topology','Background monitors track every member and which one is primary','Each operation picks a server according to read preference and uses a pooled connection']},
{h:'Practical rules'},
{ul:['Create **one client object per application process** and reuse it. Do not create a client per request.','Put the **same URI options** in every service for predictable behavior.','Store credentials in a secret manager, not in source code.','Escape special characters in passwords (`@`, `:`, `/`) with percent-encoding.']},
{code:`// Node.js example
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 50 });
await client.connect();
const orders = client.db("shop").collection("orders");`},
{note:'A connection string with a database name only sets the default database for the connection. Authentication uses `authSource`, which is a different thing.'}],
src:[['Connection strings',MAN+'reference/connection-string/'],['Drivers',M.D+'drivers/']]};

/* ---------- 5: Compass ---------- */
L['mongo:2:5']={blocks:[
{p:'**MongoDB Compass** is the free graphical client. It helps you look at data and plans visually, and is useful for learning and for quick checks. For automation and scripts you still use mongosh and drivers.'},
{h:'What it is good for'},
{t:[['Feature','Use'],
['**Document browser**','View, filter, edit and insert documents'],
['**Schema analysis**','Sample a collection to see field types and value distributions'],
['**Query bar**','Build filters, projections and sorts with immediate results'],
['**Aggregation builder**','Create pipelines stage by stage and see output at each stage'],
['**Explain plan**','See which index a query used and how many documents it examined'],
['**Indexes tab**','Create, view and drop indexes and see usage'],
['**Performance and validation tabs**','Live server metrics (when permitted) and schema validation rules']]},
{h:'Connecting safely'},
{ul:['Use the same connection string as an application would. For Atlas, copy it from the Connect dialog.','Use a **read-only** user when you only need to look.','Be careful with edit and delete in the document view: there is no undo.']},
{h:'Compass and the shell together'},
{flow:['Prototype a filter or pipeline in Compass','Export it to the language of your choice','Check the explain plan','Move the final query into the application or a mongosh script']},
{note:'Other tools exist: Atlas Data Explorer in the browser, mongosh in IDE extensions and VS Code. They all use the same server commands underneath.'}],
src:[['MongoDB Compass',M.D+'compass/current/']]};

/* ---------- 6: Database tools ---------- */
L['mongo:2:6']={blocks:[
{p:'The **MongoDB Database Tools** are command-line programs that ship separately from the server. They work against any deployment, including Atlas, by connection string.'},
{h:'The tools'},
{t:[['Tool','Purpose','Typical use'],
['**mongodump**','Export data as BSON files','Logical backup of a database or collection'],
['**mongorestore**','Restore from mongodump output','Restore or copy a database'],
['**mongoexport**','Export JSON or CSV','Share data with other systems'],
['**mongoimport**','Import JSON, CSV or TSV','Load seed or sample data'],
['**mongostat**','Live server counters','Quick health view'],
['**mongotop**','Time spent reading and writing per collection','Find hot collections'],
['**mongofiles**','Work with GridFS','Store and fetch large files'],
['**bsondump**','Read BSON files as JSON','Inspect a dump']]},
{h:'Examples'},
{code:`# Dump one database to a folder
mongodump --uri "mongodb://localhost:27017/shop" --out ./dump

# Restore it (into the same or another server)
mongorestore --uri "mongodb://localhost:27017" ./dump

# Import a JSON array file
mongoimport --uri "mongodb://localhost:27017/shop" --collection products --file products.json --jsonArray

# Live counters every 2 seconds
mongostat --uri "mongodb://localhost:27017" 2`},
{h:'Important points'},
{ul:['`mongoexport` and `mongoimport` use **JSON or CSV**, which can lose type detail. Use `mongodump` and `mongorestore` for faithful copies.','`mongodump` is a logical backup: it reads through the server and is slower than a file snapshot on large systems (Section 13).','Pass credentials with `--uri` and a password prompt, not as visible command-line arguments in shared environments.']},
{note:'Database Tools are versioned separately from the server. Keep them reasonably current. Check compatibility on the install page.'}],
src:[['MongoDB Database Tools',M.TOOLS],['mongodump',M.TOOLS+'mongodump/'],['mongorestore',M.TOOLS+'mongorestore/']]};
})();
