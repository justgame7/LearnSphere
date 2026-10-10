/* LearnSphere - GoldenGate, Section 12: Heterogeneous & Cloud Integrations.
   Lectures 0-5 are core, 6-9 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const het=O.dg(700,230,[
[10,70,150,90,'Oracle source|Integrated Extract|reads redo',0],
[210,70,140,90,'Trail|neutral format|(same trail)',2],
[400,10,140,60,'Replicat to|PostgreSQL',0],[400,85,140,60,'Replicat to|SQL Server',0],[400,160,140,60,'Handler to|Kafka',0],
[590,10,100,60,'PostgreSQL',0],[590,85,100,60,'SQL Server',0],[590,160,100,60,'Kafka topic',0]],
[[160,115,210,115],[350,100,400,40],[350,115,400,115],[350,135,400,190],[540,40,590,40],[540,115,590,115],[540,190,590,190]]);

/* ---------- 0: Oracle to PostgreSQL and SQL Server ---------- */
L['ora-gg:11:0']={blocks:[
{p:'GoldenGate can apply Oracle changes to **other databases**. The Extract on Oracle is the same. A **different Replicat** applies to the target database.'},
{svg:het},
{h:'What changes for a non-Oracle target'},
{t:[['Piece','Oracle to Oracle','Oracle to PostgreSQL or SQL Server'],
['**Extract**','Integrated Extract','Same'],
['**Trail**','Same format','Same format'],
['**Replicat**','Oracle Replicat','Replicat for the target database (installed from the matching GoldenGate package)'],
['**Data types**','Same','Mapped and converted'],
['**DDL**','Can be replicated','Usually **not** replicated. Change the target by hand.'],
['**Initial load**','Data Pump','GoldenGate initial load, or a database tool']]},
{h:'A Replicat for PostgreSQL (outline)'},
{code:`REPLICAT repPG
TARGETDB pgdb, USERIDALIAS pg_alias DOMAIN OracleGoldenGate
MAP pdb1.shop.orders, TARGET public.orders,
  COLMAP (USEDEFAULTS);`},
{h:'Typical tasks'},
{ul:['Create the target schema in the target database (translate data types).','Load existing data.','Start the Replicat and monitor.','Handle schema changes by a controlled process.']},
{flow:['Prepare the Oracle source as usual','Install GoldenGate for the target database','Create the target tables with converted types','Load and replicate','Verify and monitor']},
{note:'The target database must have a primary key on each table, or GoldenGate needs a key definition. Plan it with the schema conversion.'}],
src:[['GoldenGate for PostgreSQL and SQL Server',O.GG]]};

/* ---------- 1: Kafka ---------- */
L['ora-gg:11:1']={blocks:[
{p:'**Streaming targets** such as **Kafka** receive changes as **messages**. Other systems read the topic and react. GoldenGate does this with **handlers**, in the GoldenGate for Big Data and streaming package.'},
{t:[['Item','Meaning'],
['**Topic**','A Kafka channel that holds messages'],
['**Message**','One change record: an insert, update or delete, in a format like JSON or Avro'],
['**Handler**','The GoldenGate component that writes to the target (Kafka, a file system, cloud storage)'],
['**Schema registry**','Optional store of message formats']]},
{h:'Message content'},
{code:`{"table":"SHOP.ORDERS","op_type":"U","op_ts":"2026-01-15 10:00:00.000000",
 "before":{"ID":2,"TOTAL":200},"after":{"ID":2,"TOTAL":250}}`},
{h:'Design choices'},
{t:[['Choice','Options'],
['**Format**','JSON (readable), Avro (compact with a schema)'],
['**Partitioning**','By primary key, so changes to a row stay in order'],
['**Content**','After image only, or before and after']]},
{flow:['Oracle Extract captures changes','The trail holds them','A Replicat with a Kafka handler reads the trail','It publishes messages to a topic','Consumers read and process them']},
{note:'Messages are in commit order per key. Consumers must handle repeats (at-least-once delivery) and process by key, not by time.'}],
src:[['GoldenGate for Big Data',O.GG]]};

/* ---------- 2: OCI GoldenGate ---------- */
L['ora-gg:11:2']={blocks:[
{p:'**OCI GoldenGate** is a **managed** GoldenGate service. Oracle runs the software and the servers. You create **connections** and **deployments**, and design the replication.'},
{t:[['','Self-managed','OCI GoldenGate'],
['**Servers and OS**','You','Oracle'],
['**Software patching**','You','Oracle'],
['**Scaling**','You plan and resize','Set the OCPU count and scale'],
['**Cost**','Licences and servers','Pay per use'],
['**Control**','Full','Within the service features']]},
{h:'What you configure'},
{ul:['**Connections** to source and target databases (credentials, network).','A **deployment** (the GoldenGate instance), sized and in a subnet.','The **Extract and Replicat** (or pipelines in the service console).','Networking and security: private endpoints, IAM policies, vaults.']},
{h:'Typical uses'},
{ul:['Migration from on premises or other clouds into OCI databases.','Replication between OCI databases in different regions.','Feeding streams and data lakes.']},
{flow:['Create connections to the databases','Create a deployment of the right type and size','Create the replication (Extract and Replicat)','Monitor in the service console']},
{note:'Managed services reduce operations work, but not design work. You still decide topology, filters, error handling and cutover.'}],
src:[['OCI GoldenGate','https://docs.oracle.com/en-us/iaas/goldengate/index.html']]};

/* ---------- 3: Data Streams and Stream Analytics ---------- */
L['ora-gg:11:3']={blocks:[
{p:'Two ideas go beyond copying tables: **data streams** that deliver changes as events, and **stream analytics** that process events as they arrive.'},
{t:[['Piece','What it does'],
['**Data Streams**','Publish change events from databases to consumers, such as applications and analytics, with a defined contract'],
['**GoldenGate Stream Analytics**','Analyse streams in real time: filter, aggregate, detect patterns, raise alerts']]},
{h:'Example'},
{flow:['Orders are committed in Oracle','GoldenGate publishes each change as an event','Stream Analytics counts orders per minute and detects unusual patterns','An alert or a dashboard updates within seconds']},
{h:'When to use'},
{ul:['You want real-time dashboards without querying production.','You need event-driven applications that react to data changes.','You feed a data lake or warehouse continuously.']},
{h:'Points to plan'},
{t:[['Topic','Notes'],
['**Event design**','Decide the event format and the keys'],
['**Ordering**','Order is kept per key. Design consumers for that.'],
['**Volume**','Streams can be much larger than the change volume of a table copy'],
['**Retention and replay**','How long messages stay and how consumers recover']]},
{note:'Streaming moves the problem from "copy data" to "design events". Involve the people who will use the events from the start.'}],
src:[['Data streams and Stream Analytics',O.GG]]};

/* ---------- 4: Mapping data types ---------- */
L['ora-gg:11:4']={blocks:[
{p:'Databases store similar data in different ways. When the target is not Oracle, you must **map data types** with care. Wrong mapping causes errors or lost precision.'},
{t:[['Oracle type','PostgreSQL','SQL Server','Notes'],
['`VARCHAR2(n)`','`varchar(n)`','`nvarchar(n)` or `varchar(n)`','Check character semantics (bytes or characters)'],
['`NUMBER(p,s)`','`numeric(p,s)`','`decimal(p,s)`','`NUMBER` without precision needs a choice'],
['`NUMBER(1)` as flag','`boolean` or `smallint`','`bit`','Define the rule'],
['`DATE` (includes time)','`timestamp`','`datetime2`','Oracle DATE has a time part'],
['`TIMESTAMP`','`timestamp`','`datetime2(n)`','Check fractional seconds'],
['`CLOB`','`text`','`nvarchar(max)`','Large object handling'],
['`BLOB`','`bytea`','`varbinary(max)`','Large object handling'],
['`RAW(n)`','`bytea`','`varbinary(n)`','Binary']]},
{h:'Other differences'},
{ul:['**Empty strings:** Oracle treats an empty string as NULL. Other databases do not.','**Case and collation:** string comparison and sorting may differ.','**Time zones:** check how `TIMESTAMP WITH TIME ZONE` maps.','**Identity and sequences:** each database has its own method.']},
{flow:['List every column type in the replicated tables','Choose the target type and the rule for each','Test conversion on real data, including edge cases','Document the mapping']},
{note:'Test with the **extreme values** in your data: largest numbers, empty strings, special characters, oldest dates. They are where mapping fails.'}],
src:[['Data type mapping',O.GG]]};

/* ---------- 5: Practical ---------- */
L['ora-gg:11:5']={blocks:[
{p:'Replicate Oracle changes to **PostgreSQL**. If you do not have GoldenGate for PostgreSQL, follow the plan and read the parameters, then repeat later.'},
{h:'Target (PostgreSQL)'},
{code:`CREATE TABLE public.orders (
  id        numeric(10) PRIMARY KEY,
  customer  varchar(50),
  total     numeric(10,2),
  load_ts   timestamp DEFAULT now()
);`},
{h:'Source (Oracle) and GoldenGate'},
{flow:['Prepare the Oracle source as before','Create the Integrated Extract and local trail','Create a distribution path to the PostgreSQL deployment','Create a Replicat with the PostgreSQL connection','Load existing data and start the Replicat']},
{code:`-- Replicat on the PostgreSQL deployment
REPLICAT repPG
TARGETDB pgdb, USERIDALIAS pg_alias DOMAIN OracleGoldenGate
MAP pdb1.shop.orders, TARGET public.orders,
  COLMAP (id = id, customer = customer, total = total);`},
{h:'Test'},
{code:`-- Oracle
INSERT INTO shop.orders VALUES (21, 'Zeta', 99.5); COMMIT;
UPDATE shop.orders SET total = 120 WHERE id = 21; COMMIT;
DELETE FROM shop.orders WHERE id = 21; COMMIT;

-- PostgreSQL
SELECT * FROM public.orders;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['After insert','Row 21 on PostgreSQL'],
['After update','Total 120'],
['After delete','Row 21 removed'],
['Lag','Seconds'],
['Data types','Values correct with no truncation']]},
{note:'Make a short list of what you had to decide: types, keys, empty strings, case. This list is the start of a real migration plan.'}],
src:[['GoldenGate heterogeneous replication',O.GG]]};

})();
