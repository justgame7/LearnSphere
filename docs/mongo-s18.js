/* LearnSphere - MongoDB, Section 18: Capstone & Certification Preparation.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const cap=M.dg(700,200,[
[10,10,680,180,'Capstone: a protected replica set for a shop application',1],
[30,55,110,60,'App user|shopapp|readWrite',0],[180,55,130,60,'3-member|replica set|TLS + auth',2],[350,40,140,40,'Backup job|dump or snapshot',0],[350,95,140,40,'Monitoring|alerts',0],
[530,55,140,60,'Restore drill|and runbook',0],
[30,140,640,35,'Data model with validation, indexes and tested queries',0]],
[[140,85,180,85],[310,70,350,60],[310,100,350,115],[490,60,530,75]]);

const approach=M.dg(700,130,[
[10,10,680,110,'Answering scenario questions',1],
[30,50,120,50,'Identify the|topic',0],[180,50,130,50,'Find the|key constraint',2],[340,50,130,50,'Eliminate|wrong options',0],[500,50,170,50,'Choose the simplest|safe solution',2]],
[[150,75,180,75],[310,75,340,75],[470,75,500,75]]);

/* ---------- 0: capstone ---------- */
L['mongo:17:0']={blocks:[
{p:'The capstone ties the whole course together. You will design, deploy, secure and protect a small production-style MongoDB deployment, and prove it works. Use a lab: three containers or three VMs, or an Atlas dedicated cluster for the cloud variant.'},
{svg:cap},
{h:'The brief'},
{p:'A small online shop needs a database for products, customers, orders and reviews. It must survive the loss of one server, keep data safe, perform well for the main queries and be recoverable.'},
{h:'Deliverables checklist'},
{t:[['Area','What to produce','Section'],
['**Data model**','Collections and sample documents, embed or reference decisions, validation rules','6'],
['**Indexes**','Indexes for the top five queries with explain output showing IXSCAN','7, 8'],
['**Queries**','CRUD operations and two aggregation reports (monthly revenue, top products)','4, 5'],
['**Deployment**','Three-member replica set with a key file, TLS and authentication','3, 10, 12'],
['**Access**','Users: application read-write, reporting read-only, monitoring, backup','12'],
['**Consistency**','Write concern majority, an atomic stock update, one transaction','9'],
['**Backup**','Scheduled backup, retained copy, one point-in-time restore','13'],
['**Monitoring**','Alerts for no primary, lag, disk, connections','14'],
['**Operations**','A failover drill and a rolling restart documented','10, 15'],
['**Runbook**','One page: architecture, access, backup, restore, contacts','13, 14']]},
{h:'Acceptance tests'},
{flow:['Stop the primary: a new primary appears and the app continues','Run the top queries: each uses an index, docsExamined close to nReturned','Try an unauthenticated connection: it is refused','Restore last night backup to a new instance: counts match','Trigger an alert on purpose and confirm it arrives']},
{h:'Stretch goals'},
{ul:['Add a hidden member for reports.','Add a TTL index for sessions.','Rehearse a sharding design on paper: which shard key would you choose and why?','Automate the deployment with scripts or Terraform.']},
{note:'Keep notes of what failed while you built it. Those notes become your best troubleshooting guide.'}],
src:[['MongoDB manual',MAN],['MongoDB University','https://learn.mongodb.com/']]};

/* ---------- 1: exam domains ---------- */
L['mongo:17:1']={blocks:[
{p:'MongoDB offers two associate-level certifications relevant to this course. The exact objectives, number of questions and passing rules are published by MongoDB and change over time, so always read the current exam guide.'},
{h:'The exams'},
{t:[['Exam','Focus','Best matched sections'],
['**Associate Database Administrator**','Running and operating MongoDB: replication, sharding, security, backup, performance, monitoring','2, 3, 7 to 15'],
['**Associate Developer**','Using MongoDB in applications: CRUD, aggregation, indexes, data modeling, drivers','4 to 7, 9, 17']]},
{h:'Topic to section map (Associate DBA)'},
{t:[['Topic area','Course sections'],
['Philosophy, features and architecture','1, 2'],
['Installation, configuration and tools','3'],
['CRUD and the query language','4'],
['Aggregation','5'],
['Data modeling','6'],
['Indexes','7'],
['Performance and monitoring','8, 14'],
['Replication','9, 10'],
['Sharding','11'],
['Security','12'],
['Backup and recovery','13'],
['Upgrades and maintenance','15']]},
{h:'How to prepare'},
{flow:['Read the current exam guide and objectives','Map each objective to a lecture and quiz in this course','Use quizzes to find weak areas and re-read those lectures','Practice every command in a lab','Take the official practice material if offered','Schedule the exam when practice scores are steady']},
{note:'Do not rely on memorized dates, limits or option names. Practice reading the manual and understanding the reason behind each rule, which is what the questions test.'}],
src:[['MongoDB certification','https://learn.mongodb.com/pages/certification'],['Associate DBA exam','https://learn.mongodb.com/courses/database-administrator-certification-exam']]};

/* ---------- 2: scenarios ops ---------- */
L['mongo:17:2']={blocks:[
{p:'Scenario questions describe a situation and ask for the **best** action. Use the same approach each time.'},
{svg:approach},
{h:'Scenarios: operations and troubleshooting'},
{t:[['Scenario','Key clues','Best answer'],
['Writes disappeared after a primary failover','`w: 1` was used, secondaries had not replicated','Use `w: "majority"`; rolled-back writes are in the rollback folder'],
['A secondary is 2 hours behind and keeps falling behind','Lag grows, oplog window small, resource limits','Check resources and load; if beyond the oplog window, resync; resize the oplog'],
['The primary changes every few minutes','Missed heartbeats, latency spikes','Check network, clock sync, resource stalls on the primary'],
['Three-member set loses two members','Survivor is secondary','Restore a majority; as a last resort force reconfig on the survivor'],
['Disk is 95 percent full','Cache and data growth','Free non-database files, add TTL or archive, extend the volume; never delete dbPath files'],
['A query suddenly became slow after a deployment','New query shape, COLLSCAN in explain','Create a matching compound index (ESR), verify with explain'],
['The cluster has high CPU and many connections','Connection storm','Reuse the client, lower maxPoolSize, check pools'],
['Backup restores but data is inconsistent across shards','Shards backed up at different times','Use coordinated backup or stop balancer and snapshot consistently; or use Atlas/Ops Manager'],
['Need to undo an accidental delete from 20 minutes ago','Backups plus oplog','Point-in-time restore to a new cluster, extract and merge the data'],
['An application can read but not write','Auth success, write fails with unauthorized','Check the role: needs readWrite on that database']]},
{h:'Habits for answering'},
{ul:['Look for the **word that limits the answer**: "without downtime", "fastest", "least privilege".','Prefer the **built-in, supported** approach over a manual hack.','Remember the **order of operations** in upgrades and maintenance.','When data safety is involved, choose the answer that keeps a **copy** first.']}],
src:[['Troubleshoot replica sets',MAN+'tutorial/troubleshoot-replica-sets/'],['Production notes',MAN+'administration/production-notes/']]};

/* ---------- 3: scenarios modeling ---------- */
L['mongo:17:3']={blocks:[
{p:'These scenarios exercise modeling, indexes and queries. Think about the **access pattern first**, then the shape and the index.'},
{h:'Scenarios: modeling, indexes and queries'},
{t:[['Scenario','Key clues','Best answer'],
['Blog posts with thousands of comments each','Comments grow without limit','Store comments in their own collection referencing the post; embed a recent subset'],
['Order page needs order lines every time','Always read together, bounded','Embed lines in the order'],
['Query: status equals paid, sorted by date, amount over 100','Equality, sort, range','Index `{ status: 1, createdAt: -1, amount: 1 }` (ESR)'],
['Query uses `skip(500000)` and is slow','Deep pagination','Range pagination on an indexed field'],
['Search names starting with "Pat", case sensitive','Anchored prefix regex','Index on the field supports it; prefix regex uses the index'],
['Need documents matching two conditions on the same array element','Array of subdocuments','`$elemMatch`'],
['Counting orders per customer per month','Grouping, dates','Aggregation: `$group` with `$dateToString` and a leading `$match`'],
['Collection with many sparse optional fields','Varied attributes','Attribute pattern or wildcard index'],
['Documents must be removed after 30 days','Time-based expiry','TTL index on a date field with `expireAfterSeconds`'],
['Updating stock must not oversell','Concurrent orders','Single conditional update with `$gte` and `$inc`, or a transaction if several documents']]},
{h:'Self-check list for a design answer'},
{flow:['What are the reads and writes and how often?','Is the related data read together and bounded?','Which query needs which index, in ESR order?','Could a single-document update replace a transaction?','What is the growth and retention of this data?']},
{note:'Go back to the lectures where an answer is unfamiliar and rebuild the example yourself in a lab. Doing it once is worth more than rereading.'}],
src:[['Data modeling',MAN+'data-modeling/'],['Indexing strategies',MAN+'applications/indexes/']]};
})();
