/* LearnSphere - MongoDB, Section 09: Transactions, Consistency & Concurrency.
   Lectures 0-5 are core, 6-7 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const atomic=M.dg(700,150,[
[10,10,680,130,'Atomicity levels',1],
[30,55,190,55,'Single document|always atomic|(including embedded data)',2],[255,55,190,55,'Multi-document transaction|atomic across documents|and collections',0],[480,55,190,55,'Across sessions or servers|no guarantee without|a transaction',0]],
[]);

const txn=M.dg(700,130,[
[10,20,680,90,'Transaction lifecycle',1],
[30,55,130,40,'startTransaction',0],[190,55,150,40,'reads and writes|in the session',2],[370,55,130,40,'commit',0],[530,55,140,40,'or abort|nothing is visible',0]],
[[160,75,190,75],[340,75,370,75],[500,75,530,75]]);

const three=M.dg(700,160,[
[10,10,680,140,'Three dials for each operation',1],
[30,55,190,80,'Write concern|how many members must|acknowledge a write',2],[255,55,190,80,'Read concern|what data a read may see|(committed or not)',2],[480,55,190,80,'Read preference|which member serves|the read',2]],
[]);

const cs=M.dg(700,140,[
[10,10,680,120,'Change stream pipeline',1],
[30,55,120,55,'Write|on primary',0],[180,55,130,55,'Oplog|entry',0],[340,55,150,55,'Change stream|cursor',2],[520,55,150,55,'Your application|resume token saved',0]],
[[150,82,180,82],[310,82,340,82],[490,82,520,82]]);

/* ---------- 0: single document ---------- */
L['mongo:8:0']={blocks:[
{p:'In MongoDB a write to a **single document** is **atomic**, even when it changes several fields or embedded documents. Other operations see either the old document or the new one, never half of an update.'},
{svg:atomic},
{h:'Why this matters for design'},
{ul:['If data that must change together lives in **one document**, you get atomic updates **without** a transaction.','Good modeling (Section 6) removes the need for multi-document transactions in most cases.','Use conditional updates for safe check-then-change logic.']},
{code:`// Atomic decrement only if enough stock exists
db.products.updateOne(
  { _id: "A-100", stock: { $gte: 2 } },
  { $inc: { stock: -2 }, $push: { reservations: { orderId: 1001, qty: 2 } } }
)

// Atomic read-modify-write returning the document
db.counters.findOneAndUpdate(
  { _id: "orderNo" }, { $inc: { n: 1 } }, { returnDocument: "after", upsert: true }
)`},
{h:'What single-document atomicity does not give you'},
{ul:['Changes to **two documents** are two operations, and another client can see the state in between.','`updateMany` is **not atomic as a whole**: each document is atomic, but a failure can leave some updated.']},
{note:'Before reaching for a transaction, ask: can this data live in one document, or can one conditional update express the rule?'}],
src:[['Atomicity and transactions',MAN+'core/write-operations-atomicity/']]};

/* ---------- 1: multi-document transactions ---------- */
L['mongo:8:1']={blocks:[
{p:'When several documents must change **all or nothing**, use a **multi-document ACID transaction**. They are available on replica sets (4.0) and sharded clusters (4.2 and later).'},
{svg:txn},
{code:`const session = db.getMongo().startSession();
const accounts = session.getDatabase("bank").accounts;

session.startTransaction({
  readConcern:  { level: "snapshot" },
  writeConcern: { w: "majority" }
});
try {
  accounts.updateOne({ _id: "A" }, { $inc: { balance: -100 } });
  accounts.updateOne({ _id: "B" }, { $inc: { balance:  100 } });
  session.commitTransaction();
} catch (e) {
  session.abortTransaction();
  throw e;
}
session.endSession();`},
{h:'Use the callback API in applications'},
{p:'Drivers offer a **withTransaction** helper that retries the transaction on transient errors and the commit on unknown outcome. Prefer it over hand-written loops.'},
{h:'Limits and behavior'},
{t:[['Topic','Detail'],
['**Time limit**','60 seconds by default (`transactionLifetimeLimitSeconds`)'],
['**Isolation**','Snapshot isolation: the transaction reads a consistent snapshot'],
['**Conflicts**','Another write to the same document makes the transaction fail with a transient error; retry it'],
['**Cost**','More memory, oplog and locking; slower than single-document writes'],
['**Locks**','Held until commit or abort, so keep transactions short'],
['**Size**','Each transaction spans many oplog entries (4.2 and later), but still keep it small']]},
{h:'Good practice'},
{ul:['Keep transactions **short** and touch few documents.','Do reads and prepare data **before** starting the transaction.','Always use **majority** write concern for durability.','Handle `TransientTransactionError` and `UnknownTransactionCommitResult` by retrying.']}],
src:[['Transactions',MAN+'core/transactions/'],['Transactions in applications',MAN+'core/transactions-in-applications/'],['Production considerations',MAN+'core/transactions-production-consideration/']]};

/* ---------- 2: concerns and preference ---------- */
L['mongo:8:2']={blocks:[
{p:'Three settings decide how **durable** your writes are, how **fresh** your reads are, and **which server** answers. They trade consistency against latency and availability.'},
{svg:three},
{h:'Write concern: `w` and `j`'},
{t:[['Value','Meaning','Trade-off'],
['`w: 1`','Primary acknowledged','Fast; the write can be rolled back if the primary fails before replication'],
['`w: "majority"`','A majority of data-bearing voting members applied it','Durable across failover; slightly slower. **Default** in modern versions'],
['`w: 0`','No acknowledgment','Fire and forget; not recommended'],
['`j: true`','Also wait for the journal flush','Stronger single-node durability']]},
{h:'Read concern'},
{t:[['Level','Returns','Use'],
['`local`','Latest data on the node, may be rolled back','Default for reads outside transactions'],
['`available`','Like local; for sharded, may return orphaned documents','Lowest latency'],
['`majority`','Data acknowledged by a majority; will not be rolled back','Safe reads'],
['`snapshot`','Consistent point-in-time view (transactions)','Multi-document reads'],
['`linearizable`','Reflects all majority-acknowledged writes before the read','Strict single-document correctness; slow, primary only']]},
{h:'Read preference'},
{t:[['Mode','Reads from'],
['`primary`','The primary only (default)'],
['`primaryPreferred`','Primary, secondary if unavailable'],
['`secondary`','Secondaries only'],
['`secondaryPreferred`','Secondary, primary if none'],
['`nearest`','Lowest latency member']]},
{ul:['Reads from secondaries may be **slightly stale** (replication lag).','Read preference selects the **member**; read concern selects the **visibility** of data.']},
{code:`db.orders.find({ status: "paid" })
  .readPref("secondaryPreferred")

db.orders.insertOne({ item: "A" }, { writeConcern: { w: "majority", wtimeout: 5000 } })`},
{note:'`w: "majority"` together with `readConcern: "majority"` gives you reads that never see data that could be rolled back.'}],
src:[['Write concern',MAN+'reference/write-concern/'],['Read concern',MAN+'reference/read-concern/'],['Read preference',MAN+'core/read-preference/']]};

/* ---------- 3: causal consistency ---------- */
L['mongo:8:3']={blocks:[
{p:'If you write to the primary and then read from a secondary, you may not see your own write because of replication lag. **Causal consistency** guarantees that reads respect the order of causally related operations inside a session.'},
{h:'What it guarantees'},
{t:[['Guarantee','Meaning'],
['**Read your writes**','A read sees the effect of earlier writes in the same session'],
['**Monotonic reads**','Later reads do not see older data than earlier reads'],
['**Monotonic writes**','Writes happen in the order issued'],
['**Writes follow reads**','A write is ordered after the reads it depends on']]},
{h:'Using a causally consistent session'},
{code:`const session = client.startSession({ causalConsistency: true });
const coll = client.db("shop").collection("orders");

await coll.insertOne({ item: "A" }, { session, writeConcern: { w: "majority" } });
// This read may go to a secondary and will still see the insert
await coll.findOne({ item: "A" }, { session, readConcern: { level: "majority" }, readPreference: "secondary" });`},
{h:'How it works'},
{flow:['Each operation returns a cluster time and operation time','The session remembers the highest operation time','The next read carries it as afterClusterTime','A secondary waits until it has applied that time, then answers']},
{h:'Requirements'},
{ul:['Use a **session** shared by the related operations.','For the guarantees to hold, use **majority** read concern and **majority** write concern.','Causal consistency does not extend across different sessions or clients.']}],
src:[['Causal consistency',MAN+'core/causal-consistency-read-write-concerns/'],['Client sessions',MAN+'reference/server-sessions/']]};

/* ---------- 4: retryable ---------- */
L['mongo:8:4']={blocks:[
{p:'Networks fail and primaries step down. **Retryable writes** and **retryable reads** let a driver recover once from a transient failure **without applying an operation twice**.'},
{h:'How retryable writes work'},
{flow:['The driver tags the write with a session and transaction number','A network error or failover happens before it gets the answer','The driver finds the new primary and sends the same write again','The server recognizes the number and returns the saved result instead of applying it twice']},
{h:'Requirements and defaults'},
{ul:['Needs a **replica set** or sharded cluster (not standalone) and a driver that supports it. It is **on by default** in modern drivers.','Works for single-document writes and transactions commit.','The driver retries **once**.','Reads are also retried once by default (`retryReads`).']},
{code:`mongodb://host1,host2,host3/shop?replicaSet=rs0&retryWrites=true&retryReads=true`},
{h:'Not covered by automatic retry'},
{t:[['Operation','Why'],
['`updateMany`, `deleteMany`','Multi-document operations are not retried'],
['Operations that already returned an error to your code','Your code decides'],
['Business-level duplicates (the user clicks twice)','The server cannot know']]},
{h:'Idempotency in your application'},
{ul:['Give operations a **unique key** (for example an order id with a unique index) so a repeat attempt fails with a duplicate key error instead of duplicating data.','Prefer **set** over **increment** when the end state is known.','Store a processed-event id when handling messages that may be delivered twice.']},
{note:'Retries protect against transient failures, not against logic duplicates. Design write paths that are safe to repeat.'}],
src:[['Retryable writes',MAN+'core/retryable-writes/'],['Retryable reads',MAN+'core/retryable-reads/']]};

/* ---------- 5: change streams ---------- */
L['mongo:8:5']={blocks:[
{p:'A **change stream** lets an application subscribe to real-time changes in a collection, database or the whole deployment. It is built on the oplog and works on replica sets and sharded clusters.'},
{svg:cs},
{code:`// mongosh: watch inserts and updates on one collection
const cs = db.orders.watch([
  { $match: { operationType: { $in: ["insert", "update"] } } }
], { fullDocument: "updateLookup" });

while (!cs.isClosed()) {
  if (cs.tryNext()) printjson(cs.next());
}`},
{h:'Event contents'},
{t:[['Field','Meaning'],
['`operationType`','insert, update, replace, delete, drop and others'],
['`documentKey`','The `_id` of the changed document'],
['`fullDocument`','The document after the change (insert, replace, or update with `updateLookup`)'],
['`updateDescription`','Which fields changed'],
['`_id` (the token)','The **resume token**']]},
{h:'Resuming'},
{ul:['Save the **resume token** of the last processed event.','After a restart, call `watch` with `resumeAfter` or `startAfter` and that token to continue where you stopped.','Resume only works while the change is still in the **oplog window**. Size the oplog for the longest outage you must survive.']},
{h:'Typical uses'},
{ul:['Keep a **cache, search index or analytics store** in sync.','Trigger **notifications** or workflows.','Replicate data to **another system** (event-driven architecture).']},
{note:'MongoDB 6.0 added pre-images and post-images (`changeStreamPreAndPostImages`) for events that need the old document value. Change streams need a replica set or sharded cluster.'}],
src:[['Change streams',MAN+'changeStreams/'],['Resume a change stream',MAN+'changeStreams/#resume-a-change-stream']]};
})();
