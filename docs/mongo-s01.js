/* LearnSphere - MongoDB, Section 01: Introduction & Document Database Foundations.
   Lectures 0-5 are core, 6-7 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const hier=M.dg(700,200,[
[10,10,680,180,'One MongoDB deployment',1],
[30,45,170,120,'Database|for example shop',2],
[240,45,190,120,'Collection|for example orders|(like a table)',0],
[470,45,200,120,'Document|one record, BSON|(like a row)',0]],
[[200,105,240,105],[430,105,470,105]]);

const tour=M.dg(700,150,[
[10,15,680,120,'Learning route',1],
[30,55,110,55,'Foundations|and model',0],[160,55,110,55,'Use it|CRUD, queries',0],[290,55,110,55,'Design it|schema, indexes',2],
[420,55,110,55,'Scale it|replicas, shards',0],[550,55,120,55,'Run it|secure, back up,|monitor',0]],
[[140,82,160,82],[270,82,290,82],[400,82,420,82],[530,82,550,82]]);

const deploy=M.dg(700,170,[
[10,10,680,150,'Where MongoDB can run',1],
[30,50,190,90,'Atlas|fully managed cloud|service',2],[255,50,190,90,'Self-managed server|Community or Enterprise|on VM or bare metal',0],[480,50,190,90,'Containers|Docker, Kubernetes|operator',0]],
[]);

/* ---------- 0: Course overview ---------- */
L['mongo:0:0']={blocks:[
{p:'This course takes you from your first document to **running MongoDB in production**. It covers the server and the database design around it: how data is stored, how to query and model it, how to keep it fast, available, secure and recoverable, and how to run it yourself or on **MongoDB Atlas**, the managed cloud service.'},
{svg:tour},
{h:'Key terms in one minute'},
{t:[['Term','Plain meaning'],
['**Document**','One record, stored as a JSON-like object with fields and values.'],
['**Collection**','A group of documents, similar to a table but without a fixed schema.'],
['**Database**','A group of collections.'],
['**mongod**','The MongoDB server process that stores and serves data.'],
['**mongosh**','The MongoDB shell: the command line you use to talk to the server.'],
['**Replica set**','Several servers holding copies of the same data for availability.'],
['**Sharding**','Splitting one large dataset across several servers.'],
['**Atlas**','MongoDB managed cloud service.']]},
{h:'The sections at a glance'},
{t:[['Group','Sections','After it you can'],
['Foundations','1 to 3','Explain the document model, the architecture and set up a working lab'],
['Using the database','4 to 5','Read and write data and build aggregation pipelines'],
['Designing for it','6 to 8','Model data, build indexes and tune slow queries'],
['Reliability and scale','9 to 11','Choose consistency settings, run replica sets and shard a cluster'],
['Production','12 to 15','Secure, back up, monitor, upgrade and migrate'],
['Cloud and beyond','16 to 17','Use Atlas, automate and apply search, time series and other features'],
['Wrap-up','18','Run a capstone and prepare for certification']]},
{h:'Lecture tags: Self-managed, Atlas or Both'},
{t:[['Tag','Meaning'],
['**Self-managed**','You run the server yourself (VM, bare metal, container). Settings and files are yours to control.'],
['**Atlas**','A feature of the managed service, configured in the Atlas UI, API or CLI.'],
['**Both**','The idea applies everywhere. Untagged lectures are about the database itself and work the same everywhere.']]},
{h:'Prerequisites self-check'},
{ul:['I can use a terminal: `cd`, `ls`, `cat` and run a command.','I know what a database table and a query are, at a basic level.','I can read JSON (braces, keys, values, arrays).','I have a computer where I can install software or sign up for a free Atlas cluster.']},
{h:'How to study'},
{ul:['Read the lecture, then **type the commands yourself** in a free lab (Section 3).','Take the section quiz. Wrong answers point back to the lecture.','Use a throw-away lab for destructive commands such as drop and delete.']},
{note:'Version baseline: **MongoDB 8.0**. Where 6.0, 7.0 or newer rapid releases behave differently, the lecture says so.'}],
src:[['MongoDB manual',MAN],['MongoDB University','https://learn.mongodb.com/']]};

/* ---------- 1: Documents, collections, databases ---------- */
L['mongo:0:1']={blocks:[
{p:'MongoDB is a **document database**. Instead of rows in tables, it stores **documents**: JSON-like objects that can hold nested objects and arrays. A group of documents is a **collection**, and a group of collections is a **database**.'},
{svg:hier},
{h:'Relational terms and MongoDB terms'},
{t:[['Relational','MongoDB','Notes'],
['Database','Database','Same idea'],
['Table','Collection','No fixed columns by default'],
['Row','Document','Can contain nested data and arrays'],
['Column','Field','Different documents can have different fields'],
['Primary key','`_id` field','Added automatically if you do not supply one'],
['Join','`$lookup` or embedding','Related data is often stored inside the same document'],
['Index','Index','Same purpose, B-tree based']]},
{h:'What a document looks like'},
{code:`{
  _id: ObjectId("66f1a2b3c4d5e6f708192a3b"),
  name: "Asha Rao",
  email: "asha@example.com",
  address: { city: "Pune", country: "IN" },
  orders: [
    { sku: "A-100", qty: 2 },
    { sku: "B-220", qty: 1 }
  ],
  createdAt: ISODate("2026-01-15T09:30:00Z")
}`},
{p:'The address is an **embedded document** and orders is an **array** of documents. In a relational design these would be separate tables joined by keys. In MongoDB you can keep what is read together stored together.'},
{h:'Flexible schema, not no schema'},
{ul:['Documents in one collection **may** have different fields. You can add a field to new documents with no migration.','You are still expected to design the shape of your data. Section 6 covers modeling and **schema validation**, which lets the database enforce rules.','Every document has a unique `_id`. It is indexed automatically.']},
{h:'JSON and BSON'},
{p:'You write and read documents as JSON-like text, but the server stores them as **BSON** (Binary JSON). BSON adds types JSON lacks (dates, 64-bit integers, decimals, binary) and is faster to scan. Types are covered in Section 2.'},
{note:'Databases and collections are created **implicitly**: the first insert into a collection creates it, and the first collection creates the database.'}],
src:[['Databases and collections',MAN+'core/databases-and-collections/'],['Documents',MAN+'core/document/']]};

/* ---------- 2: When to choose ---------- */
L['mongo:0:2']={blocks:[
{p:'MongoDB is a general-purpose database, not a replacement for every other database. Choosing it well means knowing what it does best and where another tool fits better.'},
{h:'Where MongoDB is a strong fit'},
{ul:['**Data with varied or evolving shape**: product catalogs, content, user profiles.','**Data read as a whole object**: one document returns an order with its lines, no join needed.','**High write volume and horizontal scale**: sharding spreads data and load across servers.','**Fast iteration**: the schema can change with the application.','**Event, log and time series data**, with dedicated time series collections.','**Search and AI features** through Atlas Search and Vector Search.']},
{h:'Where to think twice'},
{ul:['**Heavy multi-table reporting** with many ad hoc joins across large tables. Possible with `$lookup`, but a relational warehouse is usually simpler.','**Strict relational integrity everywhere**: MongoDB has no foreign keys. Your application or schema rules must keep references consistent.','**Very small, simple, single-server applications** where any database works and your team already knows another one.']},
{h:'Quick comparison'},
{t:[['Topic','Relational database','MongoDB'],
['**Data shape**','Tables, fixed columns','Documents, flexible fields'],
['**Relationships**','Joins and foreign keys','Embedding or references'],
['**Scaling reads**','Replicas','Replicas (secondaries)'],
['**Scaling writes**','Usually bigger server, or manual partitioning','Built-in sharding'],
['**Transactions**','Core feature','Supported, but single-document atomicity often removes the need'],
['**Query language**','SQL','MQL and aggregation pipelines (SQL is not native)']]},
{h:'A simple decision flow'},
{flow:['Is your data naturally object-shaped or changing often?','Do most reads fetch one entity with its details?','Do you need to scale writes or data size horizontally?','If yes to most: MongoDB is a good fit','If your core need is complex cross-table analytics: consider a relational or analytical database']},
{note:'Many systems use both: MongoDB for the operational application data and a data warehouse for reporting.'}],
src:[['Introduction to MongoDB',MAN+'introduction/'],['Data modeling',MAN+'data-modeling/']]};

/* ---------- 3: Editions and deployment options ---------- */
L['mongo:0:3']={blocks:[
{p:'The same core database comes in a few editions and can run in several places. Pick the edition for the **features** you need and the deployment for **who operates it**.'},
{svg:deploy},
{h:'Editions'},
{t:[['Edition','Who runs it','What it adds'],
['**Community Edition**','You','Free, source-available (SSPL license). Full database engine: replication, sharding, aggregation, transactions, SCRAM and x.509 authentication.'],
['**Enterprise Advanced**','You','Paid. Adds LDAP and Kerberos auth, auditing, encryption at rest, in-memory engine, Ops Manager and support.'],
['**Atlas**','MongoDB','Managed cloud service on AWS, Azure and Google Cloud. Backups, scaling, monitoring, security and extras such as Atlas Search.']]},
{h:'Deployment shapes'},
{t:[['Shape','What it is','Typical use'],
['**Single server**','One mongod, no copies','Development only'],
['**Replica set**','3 or more members with copies of data','Default for production'],
['**Sharded cluster**','Several replica sets plus routers','Very large data or throughput'],
['**Atlas cluster**','Replica set or sharded cluster managed for you','Most new projects']]},
{h:'Choosing between self-managed and Atlas'},
{ul:['Choose **Atlas** to avoid running servers, patching, backups and monitoring yourself.','Choose **self-managed** when you need on-premises or a specific network, full control over the OS and hardware, or have fixed regulatory rules.','You can start on a free Atlas cluster to learn and move later.']},
{note:'Feature availability changes between releases. Check the comparison pages for the current split between Community, Enterprise and Atlas before you design around a feature.'}],
src:[['Install MongoDB',MAN+'installation/'],['Atlas documentation',M.ATLAS],['Enterprise features','https://www.mongodb.com/products/self-managed/enterprise-advanced']]};

/* ---------- 4: Versions and lifecycle ---------- */
L['mongo:0:4']={blocks:[
{p:'MongoDB ships **major releases** (for example 7.0, 8.0) on a regular cadence, plus **rapid releases** (8.1, 8.2 and so on) that deliver features sooner. Knowing which one you run decides your support window and upgrade plan.'},
{h:'Release types'},
{t:[['Type','Example','Cadence','Meant for'],
['**Major release**','7.0, 8.0','About once a year','Production, long support window'],
['**Rapid release**','8.1, 8.2','Between majors','Atlas first; short support, not the normal choice for self-managed production'],
['**Patch release**','8.0.x','Regular','Bug and security fixes. Stay current on your major version.']]},
{h:'How versions are numbered'},
{p:'`8.0.4` means major 8.0, patch 4. Upgrade **one major release at a time** (for example 6.0 to 7.0 to 8.0). Section 15 covers the procedure.'},
{h:'Support lifecycle'},
{ul:['Each major release is supported for a fixed period, then reaches **end of life** and receives no fixes.','Atlas keeps clusters on supported versions and can upgrade them for you.','Drivers also have compatibility tables: a driver supports a range of server versions.']},
{h:'The Stable API'},
{p:'The **Stable API** lets an application declare an API version (currently version 1) so the server keeps behaving the same for it after upgrades. It protects applications from breaking changes in new server releases.'},
{code:`// Node.js driver example
const client = new MongoClient(uri, {
  serverApi: { version: "1", strict: true, deprecationErrors: true }
});`},
{note:'Do not rely on memorised dates. Check the MongoDB support policy page for the end-of-life date of your version.'}],
src:[['MongoDB support policy and lifecycles',M.LC],['Release notes',M.REL],['Stable API',MAN+'reference/stable-api/']]};

/* ---------- 5: Where to find answers ---------- */
L['mongo:0:5']={blocks:[
{p:'Good administrators look things up quickly. Knowing where each kind of answer lives saves hours.'},
{h:'Where to look'},
{t:[['You need','Go to'],
['Exact command syntax and options','Server manual (`mongodb.com/docs/manual`), especially the **Reference** section'],
['What changed in a version','**Release notes** and the compatibility changes page'],
['Shell helpers','mongosh documentation'],
['Driver code for your language','Driver docs for Node.js, Python, Java, Go and others'],
['Atlas features and limits','Atlas documentation'],
['A problem you hit','MongoDB Community Forums and Stack Overflow, then the docs'],
['Free structured learning','MongoDB University']]},
{h:'Help inside the shell'},
{code:`mongosh
> help                         // top-level help
> db.help()                    // database methods
> db.orders.help()             // collection methods
> db.orders.find              // prints the method signature
> show dbs                     // list databases
> show collections             // list collections in the current db`},
{h:'A habit that saves time'},
{flow:['Search the manual for the command or concept','Check the page version selector matches your server version','Try it on a lab database','Confirm with explain or db.runCommand output']},
{note:'Always check the version selector on a docs page. Syntax and limits differ between releases.'}],
src:[['MongoDB manual',MAN],['MongoDB Community Forums','https://www.mongodb.com/community/forums/']]};
})();
