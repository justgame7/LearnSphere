/* LearnSphere - GoldenGate, Section 01: GoldenGate Foundations & Use Cases.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const cdc=O.dg(700,200,[
[10,50,130,70,'Source database|commits changes|writes redo or logs',0],[190,50,130,70,'Extract|reads the log,|captures changes',2],[370,50,130,70,'Trail files|ordered record of|committed changes',0],[550,50,140,70,'Replicat|applies changes|to the target',2],
[10,140,680,50,'Capture, trail, apply: changes flow in commit order, continuously, in near real time',1]],
[[140,85,190,85],[320,85,370,85],[500,85,550,85]]);

const uses=O.dg(700,230,[
[10,10,215,100,'Migration and upgrade',1],[25,45,185,50,'Move, minutes of downtime',0],
[245,10,215,100,'Active-active',1],[260,45,185,50,'Two sites accept writes',0],
[480,10,210,100,'Data distribution',1],[495,45,180,50,'Feed many targets',0],
[10,125,215,100,'Offload reporting',1],[25,160,185,50,'Reports on a copy',0],
[245,125,215,100,'Integration and streaming',1],[260,160,185,50,'Oracle to PostgreSQL, Kafka',0],
[480,125,210,100,'HA for non-Oracle',1],[495,160,180,50,'Keep a second copy current',0]],[]);

/* ---------- 0: What GoldenGate is ---------- */
L['ora-gg:0:0']={blocks:[
{p:'**Oracle GoldenGate** captures changes from a database **log** and **applies** them to another database, in near real time. Because it works from the log, it adds little load to the source, and the source and target can be **different** databases.'},
{svg:cdc},
{h:'The idea in three steps'},
{flow:['**Capture:** the Extract process reads committed changes from the transaction log','**Trail:** it writes them, in commit order, to trail files','**Apply:** the Replicat process reads the trail and applies the changes to the target']},
{h:'Key terms'},
{t:[['Term','Meaning'],
['**Change data capture (CDC)**','Finding the changes that happened to data, from the log'],
['**Extract**','The capture process'],
['**Trail**','A file set that holds captured changes'],
['**Replicat**','The apply process'],
['**Distribution path**','Sends a trail from one GoldenGate deployment to another'],
['**Heterogeneous**','Source and target are different kinds of database']]},
{h:'What makes it different'},
{t:[['Feature','Meaning'],
['**Log based**','Little impact on the source, no triggers'],
['**Transaction consistent**','Transactions are applied in commit order as whole units'],
['**Heterogeneous**','Oracle, PostgreSQL, SQL Server, MySQL, Kafka and more'],
['**Bidirectional**','Active-active replication with conflict handling'],
['**Selective**','Replicate some tables, rows and columns, and transform data']]},
{note:'Think of GoldenGate as a conveyor belt for changes. The source keeps working, and the belt carries each committed change to where it is needed.'}],
src:[['GoldenGate documentation',O.GG]]};

/* ---------- 1: vs other tools ---------- */
L['ora-gg:0:1']={blocks:[
{p:'Several tools copy data. Know how GoldenGate differs, so you pick the right one.'},
{t:[['Tool','How it works','Strength','Limit'],
['**GoldenGate**','Logical, log-based, row changes','Heterogeneous, selective, bidirectional, near zero downtime','Separate product, setup effort'],
['**Data Guard (physical standby)**','Applies redo blocks to an identical copy','Simple, complete DR copy','Same version, platform and structure'],
['**Oracle Streams**','An older log-based tool','Replaced by GoldenGate','Desupported in recent releases'],
['**Materialized views**','Refreshes a query result','Simple, built in','Not real time, load on the source'],
['**Triggers and ETL jobs**','Capture changes in the application or on a schedule','Flexible','Load on the source, more code, not in log order'],
['**Data Pump**','Exports and imports data at a point in time','Simple one-time copy','Not continuous']]},
{h:'When GoldenGate is the right choice'},
{ul:['The target is a **different version, platform or database type**.','You need **minutes of downtime** for a migration or upgrade.','You need **both sides to accept writes**.','You want only **part** of the data, or changed data.']},
{h:'When another tool is better'},
{ul:['An exact DR copy: **Data Guard**.','A one-time copy with downtime allowed: **Data Pump** or RMAN.','Simple scheduled summaries: **materialized views**.']},
{flow:['Do you need an exact copy of the same version? Data Guard','Different version, platform or database? GoldenGate','One-time copy? Data Pump','Reports on a schedule? Materialized views']},
{note:'GoldenGate and Data Guard work well together: Data Guard for disaster recovery and GoldenGate for migration, upgrade and integration.'}],
src:[['GoldenGate overview',O.GG]]};

/* ---------- 2: Use cases ---------- */
L['ora-gg:0:2']={blocks:[
{p:'GoldenGate solves a few clear problems. Most projects fit one of these use cases.'},
{svg:uses},
{t:[['Use case','What it solves','Example'],
['**Zero-downtime migration**','Move a database with minutes of downtime','Migrate Oracle from AIX to Linux, or to the cloud'],
['**Zero-downtime upgrade**','Upgrade to a new release while the old one runs','19c to 26ai with a short cutover'],
['**Active-active**','Both sites accept writes','Two regions, each serving local users'],
['**Data distribution**','Send the same data to many places','Central data to branch databases'],
['**Reporting offload**','Move reporting load from production','A reporting database with extra indexes'],
['**Integration and streaming**','Feed other systems with changes','Oracle to PostgreSQL, or to Kafka'],
['**HA for non-Oracle databases**','Keep a second copy of PostgreSQL or SQL Server','Bidirectional between two sites']]},
{h:'Typical project steps'},
{flow:['Prepare source and target (logging, users, privileges)','Do an initial load of existing data','Start replication and let it catch up','Verify the data','Cut over applications to the target']},
{note:'Most GoldenGate projects start with the migration pattern. The skills (capture, trail, apply, verify) are the same for the other use cases.'}],
src:[['GoldenGate use cases',O.GG]]};

/* ---------- 3: Product family ---------- */
L['ora-gg:0:3']={blocks:[
{p:'GoldenGate is a family of products. This course focuses on the core product with Microservices Architecture.'},
{t:[['Product','Purpose'],
['**GoldenGate (core)**','Capture and apply for Oracle and many other databases'],
['**GoldenGate for Big Data and streaming handlers**','Deliver changes to Kafka, cloud storage, data lakes and other targets'],
['**GoldenGate Veridata**','Compare source and target data to find differences, and repair them'],
['**GoldenGate Stream Analytics**','Analyse streams of events in real time'],
['**OCI GoldenGate**','A managed GoldenGate service in Oracle Cloud'],
['**GoldenGate Free**','A free edition for small databases and learning (check the current limits)']]},
{h:'Where each fits'},
{t:[['Need','Product'],
['Replicate between databases','GoldenGate core'],
['Send changes to Kafka or cloud storage','GoldenGate with the big data and stream handlers'],
['Prove that the target equals the source','Veridata'],
['No servers to manage','OCI GoldenGate'],
['Learning on a laptop','GoldenGate Free or a container image']]},
{flow:['Start from the use case','Pick the product','Choose managed (OCI) or self-managed','Plan skills: this course covers the self-managed core']},
{note:'Product names and packaging change over time. Check the current Oracle documentation for the exact products and editions.'}],
src:[['GoldenGate products',O.GG]]};

/* ---------- 4: Versions ---------- */
L['ora-gg:0:4']={blocks:[
{p:'GoldenGate has its own version numbers. They are close to the database release numbers, but they are **separate software**.'},
{t:[['Version','Notes'],
['**19c**','Long-term release. Supports Microservices Architecture and Classic Architecture. Widely used.'],
['**21c**','Innovation release. Classic Architecture is desupported from here. Microservices only.'],
['**23ai**','Microservices only. Adds new features such as the Configuration Service and improved administration.'],
['**26ai**','The current release. Continues the Microservices Architecture **[26ai]**.']]},
{h:'Two architectures'},
{t:[['','Classic','Microservices'],
['**Management**','GGSCI command line, parameter files','Web UI, REST API, Admin Client'],
['**Services**','One manager process','Several services (Service Manager, Administration, Distribution and others)'],
['**Status**','Desupported in recent releases','The standard']]},
{h:'Compatibility'},
{ul:['Source and target GoldenGate versions can differ. Trail file format versions are handled by the Extract and Replicat settings.','The database and GoldenGate versions must be on the support matrix.','New projects should use Microservices Architecture.']},
{note:'Check the certification matrix for the exact combination of GoldenGate, database and operating system before you install.'}],
src:[['GoldenGate certification and releases',O.GG]]};

/* ---------- 5: Licensing ---------- */
L['ora-gg:0:5']={blocks:[
{p:'GoldenGate is licensed **separately** from the database. This is a summary, not legal advice. Check with Oracle.'},
{t:[['Item','Licence'],
['**GoldenGate for Oracle**','Per processor (with core factor) on the systems where it runs, source and target as applicable'],
['**GoldenGate for non-Oracle databases**','A separate licence'],
['**Veridata, Stream Analytics**','Separate licences'],
['**OCI GoldenGate**','Pay per use in the cloud service'],
['**Migration use**','Oracle offers limited licences or cloud options for migrations (for example with ZDM). Check the current terms.'],
['**GoldenGate Free**','Free within its limits']]},
{h:'Database settings that matter'},
{code:`-- On any database that GoldenGate captures from or applies to:
ALTER SYSTEM SET enable_goldengate_replication = TRUE SCOPE = BOTH;`},
{p:'This parameter is the database switch that allows GoldenGate to work. It is also a licensing signal: do not set it on a database you are not licensed to use with GoldenGate.'},
{h:'Practical advice'},
{ul:['Decide early where GoldenGate software will run, since licences follow the processors.','Cloud services and migration programmes can reduce cost.','Keep a record of which databases have the parameter set.']},
{note:'Licensing is part of the design. Ask before you build, not after the first audit.'}],
src:[['Licensing Information User Manual',O.LIC],['GoldenGate licensing',O.GG]]};

/* ---------- 6: Practical ---------- */
L['ora-gg:0:6']={blocks:[
{p:'Match tools to six scenarios. Decide first, then compare with the answers.'},
{h:'Scenarios'},
{t:[['#','Scenario'],
['1','An Oracle 12c database on AIX must move to Oracle 19c on Linux with 10 minutes of downtime.'],
['2','A bank needs an exact DR copy in another city, same version and platform.'],
['3','Orders in Oracle must be sent to a PostgreSQL reporting database in near real time.'],
['4','A one-time copy of a schema to a test database, with a weekend of downtime allowed.'],
['5','Two data centres must both accept writes to the same customer data.'],
['6','Changes in Oracle must be published to Kafka for other applications.']]},
{h:'Answers'},
{t:[['#','Tool','Why'],
['1','**GoldenGate** (or ZDM with GoldenGate)','Different platform and version, minimal downtime'],
['2','**Data Guard**','Exact copy, same platform, simple DR'],
['3','**GoldenGate** to PostgreSQL','Heterogeneous, near real time'],
['4','**Data Pump**','One-time copy, downtime acceptable'],
['5','**GoldenGate** active-active with conflict handling','Both sides accept writes'],
['6','**GoldenGate** with a Kafka handler','Stream the changes to a topic']]},
{flow:['Read the requirement','Check: exact copy, or logical?','Check downtime, platform and version','Pick the simplest tool that fits']},
{h:'Challenge'},
{p:'Write three scenarios from your own work. For each, say which tool you would use and what you would check first.'},
{note:'The simplest tool that meets the requirement is usually the best. Use GoldenGate when the requirement needs what only it can do.'}],
src:[['GoldenGate documentation',O.GG]]};

})();
