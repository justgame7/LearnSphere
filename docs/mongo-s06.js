/* LearnSphere - MongoDB, Section 06: Data Modeling & Schema Design.
   Lectures 0-6 are core, 7-8 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const approach=M.dg(700,140,[
[10,10,680,120,'Model from the application, not from the tables',1],
[30,55,150,55,'Workload|reads, writes, sizes',2],[210,55,150,55,'Access patterns|the queries you run',2],[390,55,130,55,'Document shape|and relationships',0],[550,55,120,55,'Indexes and|validation',0]],
[[180,82,210,82],[360,82,390,82],[520,82,550,82]]);

const embref=M.dg(700,230,[
[10,10,330,210,'Embedded: one document',1],[360,10,330,210,'Referenced: two collections',1],
[30,50,290,155,'order { _id, customer,|  lines: [ {sku, qty}, {sku, qty} ] }|one read returns everything|one atomic write',0],
[380,50,140,60,'orders|{ _id, customerId }',0],[540,50,130,60,'customers|{ _id, name }',0],[380,140,290,55,'two reads or $lookup, more flexible sharing',0]],
[[520,80,540,80]]);

const rel=M.dg(700,190,[
[10,10,680,170,'Relationship size guides the choice',1],
[30,55,190,100,'One to few|embed|address in user',2],[255,55,190,100,'One to many|embed if bounded,|else reference|order lines, comments',0],[480,55,190,100,'One to squillions|reference the parent|in each child|log lines per device',0]],
[]);

/* ---------- 0: principles ---------- */
L['mongo:5:0']={blocks:[
{p:'In a relational database you normalize first and write queries later. In MongoDB you do the opposite: **start from how the application reads and writes data**, and shape documents to serve those operations efficiently.'},
{svg:approach},
{h:'The design questions'},
{t:[['Question','Why it matters'],
['What are the most frequent reads and writes?','Optimize those; accept cost on rare operations'],
['What data is read **together**?','Store it together in one document'],
['How big can a document or array grow?','Unbounded growth breaks the 16 MiB limit and performance'],
['How often does each piece change?','Frequently updated data should not be duplicated widely'],
['What must be consistent at the same instant?','Data that must change atomically belongs in one document'],
['How many documents does an operation touch?','Fewer documents means fewer reads and simpler writes']]},
{h:'Principles'},
{ul:['**Data that is accessed together should be stored together.**','Favor **embedding** unless there is a reason to reference.','**Duplicate** data when it is read often and changes rarely; keep it consistent in the application.','Plan for **growth**: documents and arrays should be bounded.','Design so that the **important queries use an index**.']},
{h:'The modeling workflow'},
{flow:['List the entities and their sizes','List the queries and writes with their frequencies','Draft documents that answer the top queries in one read','Choose relationships: embed or reference','Add indexes and validation','Test with realistic data volume']},
{note:'There is no single correct schema. A good schema is the one that serves your workload and can be changed safely as it evolves.'}],
src:[['Data modeling',MAN+'data-modeling/'],['Data modeling introduction',MAN+'data-modeling/concepts/']]};

/* ---------- 1: embed vs reference ---------- */
L['mongo:5:1']={blocks:[
{p:'Relationships can be stored by **embedding** the related data inside a document or by **referencing** it with an id stored in another document. This is the most important modeling decision.'},
{svg:embref},
{h:'Comparison'},
{t:[['','Embedding','Referencing'],
['**Reads**','One read, no join','Two reads or `$lookup`'],
['**Writes**','One atomic write for the whole document','Several writes; use a transaction if they must be atomic'],
['**Data duplication**','Possible when the same data is embedded in several parents','Minimal; one source of truth'],
['**Document size**','Grows; limit 16 MiB','Small documents'],
['**Updating shared data**','Update many copies','Update once']]},
{h:'Rules of thumb by relationship size'},
{svg:rel},
{h:'Choose embedding when'},
{ul:['The related data is **read with** the parent almost every time.','The relationship is **one to one** or **one to few**.','The embedded data **belongs** to the parent (order lines in an order).','The child is not queried or updated independently of the parent.']},
{h:'Choose referencing when'},
{ul:['The related data is **large**, or the array can **grow without bound**.','The child is used by **many parents** and changes often.','You often query the child **on its own**.','Parts of the data have different access control or lifecycle.']},
{h:'Example'},
{code:`// Embedding: order lines live in the order (bounded, read together)
{ _id: 1001, customerId: 7, lines: [ { sku: "A-100", qty: 2, price: 24.5 } ], total: 49 }

// Referencing: reviews can be thousands per product, so each review points to the product
{ _id: 9001, productId: "A-100", rating: 5, text: "Great lamp" }`},
{note:'You can mix both: embed what is needed for the common read, and keep the full record in its own collection (extended reference pattern in the next lecture).'}],
src:[['One-to-many relationships',MAN+'data-modeling/embedding/'],['Referencing',MAN+'data-modeling/referencing/']]};

/* ---------- 2: patterns ---------- */
L['mongo:5:2']={blocks:[
{p:'**Schema design patterns** are proven answers to recurring problems. You do not need all of them; knowing them gives you vocabulary and options.'},
{t:[['Pattern','Problem','Idea','Example'],
['**Subset**','Document too big because of a long array that is only partly needed','Keep only the most useful subset in the main document; the rest in another collection','Latest 10 reviews inside the product, all reviews in a reviews collection'],
['**Extended reference**','Repeated joins just to show a name','Copy a few frequently needed fields from the referenced document','Customer name and city stored in the order'],
['**Computed**','Same expensive calculation on every read','Store the result and update it on write or by a job','Total and item count stored on the order'],
['**Bucket**','Huge numbers of tiny time-ordered documents','Group several measurements into one document per time window','One document per sensor per hour'],
['**Outlier**','A few documents are far larger than the rest','Flag them and move the overflow to another document','A viral post with huge comments'],
['**Polymorphic**','Items of different kinds in one collection','Store a type field and keep the shared fields common','Products: books, laptops, shoes'],
['**Attribute**','Many similar optional fields to index','Store them as an array of key-value pairs and index once','Product specs'],
['**Schema versioning**','Documents of old and new shapes coexist','Add a `schemaVersion` field and handle each version','Migrating field names'],
['**Approximation**','Exact counts are too costly','Update counters only now and then','Page view counters']]},
{h:'Extended reference example'},
{code:`// Order keeps a copy of the customer fields shown in the order list
{
  _id: 1001,
  customer: { _id: 7, name: "Asha Rao", city: "Pune" },   // copied, stable fields
  lines: [ { sku: "A-100", qty: 2 } ]
}`},
{h:'Bucket example'},
{code:`// One document per sensor per hour instead of one per reading
{
  sensorId: "s-17",
  hour: ISODate("2026-03-10T14:00:00Z"),
  count: 3,
  readings: [ { t: 0, v: 21.5 }, { t: 60, v: 21.7 }, { t: 120, v: 21.6 } ]
}`},
{note:'For metrics and events, **time series collections** (Section 17) implement the bucket idea natively.'}],
src:[['Schema design patterns','https://www.mongodb.com/blog/post/building-with-patterns-a-summary'],['Data modeling schema design patterns',MAN+'data-modeling/design-patterns/']]};

/* ---------- 3: anti-patterns ---------- */
L['mongo:5:3']={blocks:[
{p:'Most MongoDB performance problems trace back to a handful of design mistakes. Recognizing them early is cheaper than fixing them in production.'},
{t:[['Anti-pattern','Why it hurts','Fix'],
['**Unbounded arrays**','The document grows without limit, hits 16 MiB, and each update rewrites more data','Reference the parent from children, or use bucketing'],
['**Massive documents**','Large reads for small needs; cache pressure','Split rarely used data; subset pattern'],
['**Too many collections**','Each collection and index has file overhead; hard to manage','Combine related data with a type field'],
['**Unnecessary indexes**','Slower writes and more memory','Drop unused indexes'],
['**Separating data read together**','Extra queries and joins','Embed or use extended reference'],
['**Case-insensitive queries without a suitable index**','Collection scans','Use a case-insensitive collation index or store a normalized field'],
['**Unnecessary `$lookup` everywhere**','Behaves like a relational model with its cost','Embed or duplicate stable fields'],
['**Fields with dynamic keys**','Cannot be indexed well','Use arrays of key-value pairs (attribute pattern)'],
['**Mixed types in a field**','Surprising sorts and comparisons','One type per field, enforced by validation']]},
{h:'How to find them'},
{ul:['Look at **document size** distribution and the largest arrays.','Review the **profiler** for repeated multi-query sequences (Section 8).','Use Atlas **Performance Advisor** and Schema Suggestions on Atlas.','Check **index usage** statistics for unused indexes.']},
{code:`// Documents with arrays that are too large (example for a field named comments)
db.posts.aggregate([
  { $project: { n: { $size: { $ifNull: ["$comments", []] } } } },
  { $sort: { n: -1 } },
  { $limit: 5 }
])

// Which indexes are used
db.orders.aggregate([ { $indexStats: {} } ])`}],
src:[['Schema design anti-patterns',MAN+'data-modeling/design-antipatterns/']]};

/* ---------- 4: validation ---------- */
L['mongo:5:4']={blocks:[
{p:'MongoDB is flexible by default, but you can add **schema validation** so the database rejects documents that break your rules. Validation uses a **JSON Schema** document and can be added when a collection is created or later.'},
{code:`db.createCollection("products", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["sku", "name", "price"],
    properties: {
      sku:   { bsonType: "string", pattern: "^[A-Z]-[0-9]{3}$" },
      name:  { bsonType: "string", minLength: 1 },
      price: { bsonType: ["double","decimal"], minimum: 0 },
      tags:  { bsonType: "array", items: { bsonType: "string" } }
    },
    additionalProperties: true
  } },
  validationLevel: "strict",
  validationAction: "error"
})`},
{h:'Two controls'},
{t:[['Setting','Values','Meaning'],
['**validationLevel**','`strict` (default)','Apply to all inserts and updates'],
['','`moderate`','Apply to inserts and to updates of documents that already satisfy the rules; existing invalid documents can still be updated'],
['**validationAction**','`error` (default)','Reject the write'],
['','`warn`','Allow the write and log a warning']]},
{h:'Adding rules to existing data'},
{flow:['Add the validator with validationAction warn','Check the log for violations','Fix or migrate invalid documents','Switch to validationLevel strict and validationAction error']},
{code:`db.runCommand({
  collMod: "products",
  validator: { $jsonSchema: { bsonType: "object", required: ["sku", "price"] } },
  validationLevel: "moderate",
  validationAction: "warn"
})`},
{h:'Notes'},
{ul:['Validation checks **inserts and updates**; existing documents are not checked until changed.','Use `$jsonSchema` for most rules. You can also write query-operator validators.','Keep rules strict for critical fields (keys, types, required fields) and loose for optional extras.','Bypass is possible with the `bypassDocumentValidation` option for users with the right privilege.']}],
src:[['Schema validation',MAN+'core/schema-validation/'],['$jsonSchema',MAN+'reference/operator/query/jsonSchema/']]};

/* ---------- 5: versioning ---------- */
L['mongo:5:5']={blocks:[
{p:'Applications change, and so do documents. Because a collection can hold documents of different shapes, you can evolve data **without downtime** if you plan for it.'},
{h:'The schema version pattern'},
{p:'Add a `schemaVersion` field to documents. Application code understands several versions and upgrades documents when it touches them, while a background job migrates the rest.'},
{code:`// v1
{ _id: 1, name: "Asha Rao", phone: "9876543210", schemaVersion: 1 }

// v2: phone becomes a list
{ _id: 2, name: "Ravi K", phones: [ { type: "mobile", number: "9123456780" } ], schemaVersion: 2 }`},
{h:'Rollout plan'},
{flow:['Deploy code that reads both old and new shapes','Start writing the new shape','Migrate old documents in batches in the background','Verify nothing reads the old shape any more','Remove old-shape handling and optionally enforce the new schema with validation']},
{h:'Batch migration example'},
{code:`db.users.updateMany(
  { schemaVersion: 1 },
  [ { $set: {
      phones: [ { type: "mobile", number: "$phone" } ],
      schemaVersion: 2
  } },
    { $unset: "phone" } ]
)`},
{p:'On very large collections, run the update in **batches** by `_id` range and throttle it so replication and the primary stay healthy.'},
{h:'Rules of thumb'},
{ul:['Adding a field is easy and non-breaking. Removing or renaming a field is a migration.','Keep migrations **idempotent** so they can be re-run safely.','Test on a copy of production-like data first.']}],
src:[['Schema versioning pattern','https://www.mongodb.com/blog/post/building-with-patterns-the-schema-versioning-pattern']]};

/* ---------- 6: modeling exercise ---------- */
L['mongo:5:6']={blocks:[
{p:'Let us design a small **online shop** end to end using the workflow from this section.'},
{h:'1. Requirements'},
{ul:['Show a product page with details, price and the 10 latest reviews.','Show a customer order history with totals.','Place an order that reduces stock.','Show average rating per product.']},
{h:'2. Access patterns'},
{t:[['Operation','Frequency','Needs'],
['View product page','Very high','Product plus latest reviews'],
['List customer orders','High','Orders by customer, newest first'],
['Place order','Medium','Order plus stock decrement'],
['Average rating','High (shown on lists)','Precomputed value']]},
{h:'3. Collections and shapes'},
{code:`// products: reviews summary and a subset of recent reviews are embedded
{ _id: "A-100", name: "Desk lamp", price: Decimal128("24.50"), stock: 40,
  ratingAvg: 4.6, ratingCount: 218,
  recentReviews: [ { user: "Asha", rating: 5, text: "Bright" } ] }

// reviews: full history, one document per review (unbounded, so a collection)
{ _id: ObjectId(), productId: "A-100", userId: 7, rating: 5, text: "Bright", at: ISODate() }

// orders: lines embedded (bounded), customer fields copied
{ _id: 1001, customer: { _id: 7, name: "Asha Rao" },
  lines: [ { sku: "A-100", qty: 2, price: Decimal128("24.50") } ],
  total: Decimal128("49.00"), status: "paid", createdAt: ISODate() }`},
{h:'4. Patterns used'},
{t:[['Pattern','Where'],
['Subset','recentReviews in the product'],
['Computed','ratingAvg, ratingCount, total'],
['Extended reference','customer name in the order'],
['Referencing','reviews point to the product']]},
{h:'5. Indexes'},
{code:`db.orders.createIndex({ "customer._id": 1, createdAt: -1 })
db.reviews.createIndex({ productId: 1, at: -1 })`},
{h:'6. Placing an order'},
{p:'Stock check and decrement must be atomic. A single conditional update on the product document is atomic by itself.'},
{code:`const r = db.products.updateOne(
  { _id: "A-100", stock: { $gte: 2 } },
  { $inc: { stock: -2 } }
)
if (r.modifiedCount === 1) { /* insert the order */ }`},
{note:'Notice that the design came from the access patterns. Changing the patterns would change the shapes.'}],
src:[['Data modeling',MAN+'data-modeling/'],['Atlas schema suggestions',M.ATLAS+'schema-suggestions/']]};
})();
