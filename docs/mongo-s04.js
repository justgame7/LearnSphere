/* LearnSphere - MongoDB, Section 04: CRUD & the Query Language.
   Lectures 0-6 are core, 7-8 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const crud=M.dg(700,150,[
[10,10,680,130,'CRUD methods on a collection',1],
[30,55,140,60,'Create|insertOne|insertMany',2],[200,55,140,60,'Read|find|findOne',2],[370,55,150,60,'Update|updateOne|updateMany|replaceOne',2],[550,55,120,60,'Delete|deleteOne|deleteMany',2]],
[]);

const qflow=M.dg(700,120,[
[10,30,110,60,'Filter|which documents',2],[150,30,120,60,'Sort|order',0],[300,30,120,60,'Skip, limit|window',0],[450,30,120,60,'Projection|which fields',0],[600,30,90,60,'Result|cursor',0]],
[[120,60,150,60],[270,60,300,60],[420,60,450,60],[570,60,600,60]]);

const cur=M.dg(700,150,[
[10,10,680,130,'A cursor returns results in batches',1],
[30,55,130,50,'find()|returns a cursor',2],[200,55,140,50,'First batch|about 101 docs',0],[380,55,140,50,'getMore|next batch',0],[560,55,110,50,'Cursor closed|or times out',0]],
[[160,80,200,80],[340,80,380,80],[520,80,560,80]]);

/* ---------- 0: insert ---------- */
L['mongo:3:0']={blocks:[
{p:'Every collection supports four basic groups of operations, often called **CRUD**. The examples in this section use a small `shop` database with `products` and `orders` collections.'},
{svg:crud},
{h:'insertOne and insertMany'},
{code:`use shop

db.products.insertOne({
  sku: "A-100", name: "Desk lamp", price: 24.5,
  tags: ["home", "light"], stock: 40
})

db.products.insertMany([
  { sku: "B-220", name: "Notebook", price: 3.2, tags: ["paper"], stock: 500 },
  { sku: "C-310", name: "Backpack", price: 55,  tags: ["bag", "travel"], stock: 25 }
])`},
{p:'Both return an acknowledgment with the inserted `_id` values. If you do not supply `_id`, the driver creates an ObjectId.'},
{h:'Ordered and unordered inserts'},
{t:[['Mode','Behavior on an error','Use'],
['**ordered: true** (default)','Stops at the first failing document; earlier ones stay inserted','When order matters'],
['**ordered: false**','Continues and reports all errors at the end; faster','Bulk loads where documents are independent']]},
{code:`db.products.insertMany(docs, { ordered: false })`},
{h:'Duplicate key errors'},
{p:'Inserting a document with an `_id` (or a value in a unique index) that already exists fails with **E11000 duplicate key error**. Handle it in code instead of retrying blindly.'},
{h:'Write acknowledgment'},
{p:'By default a write returns after the server **acknowledges** it according to the default write concern (majority on a replica set in recent versions). Section 9 explains write concern in detail.'},
{note:'The shell and drivers use `insertOne` and `insertMany`. The older `insert()` and `save()` helpers are deprecated.'}],
src:[['Insert documents',MAN+'tutorial/insert-documents/'],['insertMany',MAN+'reference/method/db.collection.insertMany/']]};

/* ---------- 1: find ---------- */
L['mongo:3:1']={blocks:[
{p:'`find()` takes a **filter** (which documents) and optionally a **projection** (which fields). It returns a **cursor**. A filter with several fields means **AND**.'},
{svg:qflow},
{code:`db.products.find({ price: { $lt: 30 }, stock: { $gt: 0 } })

db.products.find(
  { tags: "home" },                 // filter
  { name: 1, price: 1, _id: 0 }     // projection
).sort({ price: -1 }).limit(5)

db.products.findOne({ sku: "A-100" })`},
{h:'Comparison and logical operators'},
{t:[['Operator','Meaning','Example'],
['`$eq`, `$ne`','Equal, not equal','`{ price: { $ne: 0 } }`'],
['`$gt`, `$gte`, `$lt`, `$lte`','Range comparisons','`{ stock: { $gte: 10 } }`'],
['`$in`, `$nin`','Value in or not in a list','`{ sku: { $in: ["A-100","B-220"] } }`'],
['`$and`, `$or`, `$nor`','Combine conditions','`{ $or: [ { price: { $lt: 5 } }, { stock: 0 } ] }`'],
['`$not`','Negate an operator','`{ price: { $not: { $gt: 100 } } }`'],
['`$exists`','Field is present','`{ discount: { $exists: true } }`'],
['`$type`','Field has a BSON type','`{ price: { $type: "double" } }`']]},
{h:'Projection rules'},
{ul:['`field: 1` includes a field; `field: 0` excludes it.','You **cannot mix** inclusion and exclusion in one projection, except that `_id: 0` is allowed with inclusions.','Projection returns only the needed fields, which saves network and memory.']},
{h:'Counting'},
{code:`db.products.countDocuments({ stock: { $gt: 0 } })   // exact, uses the filter
db.products.estimatedDocumentCount()                // fast, from metadata, no filter`},
{note:'`find()` with no filter returns every document. Always add a `limit()` when exploring a large collection.'}],
src:[['Query documents',MAN+'tutorial/query-documents/'],['Query operators',MAN+'reference/operator/query/'],['Projection',MAN+'tutorial/project-fields-from-query-results/']]};

/* ---------- 2: arrays and embedded ---------- */
L['mongo:3:2']={blocks:[
{p:'Arrays and embedded documents are the heart of the document model, and querying them has a few rules that surprise newcomers.'},
{h:'Embedded documents: dot notation'},
{code:`// Document: { name: "Asha", address: { city: "Pune", pin: "411001" } }

db.users.find({ "address.city": "Pune" })        // good: dot notation
db.users.find({ address: { city: "Pune" } })     // matches only if address is EXACTLY { city: "Pune" }`},
{p:'Dot notation matches one field inside the embedded document. An exact embedded document match needs the same fields **in the same order**.'},
{h:'Arrays'},
{code:`// Document: { sku: "A-100", tags: ["home", "light", "led"] }

db.products.find({ tags: "light" })                    // array contains "light"
db.products.find({ tags: { $all: ["home", "led"] } })  // contains both
db.products.find({ tags: { $size: 3 } })               // exactly 3 elements
db.products.find({ "tags.0": "home" })                 // first element`},
{h:'Arrays of documents and $elemMatch'},
{p:'When an array holds documents, conditions on several fields of the **same element** need `$elemMatch`. Without it, conditions may match **different** elements.'},
{code:`// Document: { order: 1, items: [ { sku: "A-100", qty: 1 }, { sku: "B-220", qty: 5 } ] }

// Wrong intent: matches if ANY element has sku A-100 and ANY element has qty >= 5
db.orders.find({ "items.sku": "A-100", "items.qty": { $gte: 5 } })

// Correct: both conditions on the SAME element
db.orders.find({ items: { $elemMatch: { sku: "A-100", qty: { $gte: 5 } } } })`},
{h:'Summary table'},
{t:[['Need','Use'],
['Field inside an embedded document','`"a.b": value`'],
['Array contains a value','`{ arr: value }`'],
['Array contains all values','`$all`'],
['Several conditions on one array element','`$elemMatch`'],
['Array length','`$size`'],
['Element at a position','`"arr.0": value`']]},
{note:'Indexing arrays creates a **multikey index**, with one index entry per array element. Section 7 covers it.'}],
src:[['Query an array',MAN+'tutorial/query-arrays/'],['Query embedded documents',MAN+'tutorial/query-embedded-documents/'],['$elemMatch',MAN+'reference/operator/query/elemMatch/']]};

/* ---------- 3: update ---------- */
L['mongo:3:3']={blocks:[
{p:'An update needs a **filter** and an **update document** that uses update operators. Without operators the document would be replaced, which is a different operation.'},
{code:`db.products.updateOne(
  { sku: "A-100" },
  { $set: { price: 22.0 }, $inc: { stock: -1 } }
)

db.products.updateMany(
  { tags: "paper" },
  { $set: { category: "stationery" } }
)`},
{h:'The operators'},
{t:[['Operator','Effect'],
['`$set`','Set or add a field'],
['`$unset`','Remove a field'],
['`$inc`, `$mul`','Add or multiply a number'],
['`$min`, `$max`','Set only if the new value is lower or higher'],
['`$rename`','Rename a field'],
['`$currentDate`','Set a field to now'],
['`$push`','Append to an array (use `$each` for several values)'],
['`$addToSet`','Append only if not already present'],
['`$pull`','Remove matching elements from an array'],
['`$pop`','Remove the first or last element']]},
{h:'Updating inside arrays'},
{code:`// Positional operator: the first matching element
db.orders.updateOne(
  { _id: 1, "items.sku": "A-100" },
  { $set: { "items.$.qty": 3 } }
)

// All elements
db.orders.updateOne({ _id: 1 }, { $inc: { "items.$[].qty": 1 } })

// Filtered positional operator
db.orders.updateOne(
  { _id: 1 },
  { $set: { "items.$[it].qty": 0 } },
  { arrayFilters: [ { "it.sku": "B-220" } ] }
)`},
{h:'Upsert'},
{p:'With `upsert: true`, if no document matches, a new one is inserted from the filter and update. `$setOnInsert` sets fields only for that insert case.'},
{code:`db.counters.updateOne(
  { _id: "visits" },
  { $inc: { n: 1 }, $setOnInsert: { createdAt: new Date() } },
  { upsert: true }
)`},
{h:'Replace vs update'},
{t:[['Method','Behavior'],
['`updateOne` / `updateMany`','Changes only the fields named by operators'],
['`replaceOne`','Replaces the whole document except `_id`'],
['`findOneAndUpdate`','Updates one document and returns it (before or after)']]},
{note:'A single-document update is **atomic**. Several operators in one update are applied together.'}],
src:[['Update documents',MAN+'tutorial/update-documents/'],['Update operators',MAN+'reference/operator/update/'],['Update arrays',MAN+'reference/operator/update-array/']]};

/* ---------- 4: delete and bulk ---------- */
L['mongo:3:4']={blocks:[
{p:'Deletion is permanent. Good habits matter more here than syntax.'},
{code:`db.orders.deleteOne({ _id: 42 })
db.sessions.deleteMany({ expiresAt: { $lt: new Date() } })

db.products.findOneAndDelete({ sku: "X-1" })   // delete and return the document`},
{h:'Deleting everything, three different things'},
{t:[['Command','What it does','Cost'],
['`deleteMany({})`','Removes all documents one by one, keeps the collection and indexes','Slow on large collections, writes oplog entries'],
['`drop()`','Removes the collection and its indexes','Fast'],
['`dropDatabase()`','Removes the whole database','Fast, very dangerous']]},
{h:'Safety habits'},
{flow:['Run the same filter with find() and countDocuments() first','Check the count is what you expect','Confirm the current database with db.getName()','Run the delete with the same filter','Check the result deletedCount']},
{h:'bulkWrite'},
{p:'`bulkWrite` sends many different write operations in one request. It reduces round trips and can be ordered or unordered.'},
{code:`db.products.bulkWrite([
  { insertOne: { document: { sku: "D-1", name: "Pen", stock: 100 } } },
  { updateOne: { filter: { sku: "A-100" }, update: { $inc: { stock: 5 } } } },
  { deleteOne: { filter: { sku: "OLD-1" } } }
], { ordered: false })`},
{h:'Removing old data automatically'},
{p:'For data that expires (sessions, logs) use a **TTL index** (Section 7) instead of periodic delete jobs. For large clean-ups delete in **batches** to avoid long operations and replication lag.'},
{note:'There is no undo. In production, rely on backups and point-in-time recovery (Section 13), and give application users the minimum privileges they need.'}],
src:[['Delete documents',MAN+'tutorial/remove-documents/'],['bulkWrite',MAN+'reference/method/db.collection.bulkWrite/']]};

/* ---------- 5: operators in practice ---------- */
L['mongo:3:5']={blocks:[
{p:'Beyond comparisons, MongoDB has operators for text patterns and expressions. Each has an **index story**: some use indexes well, some do not.'},
{h:'Regular expressions'},
{code:`db.products.find({ name: { $regex: "^Desk" } })        // anchored prefix: can use an index
db.products.find({ name: { $regex: "lamp", $options: "i" } })  // unanchored, case-insensitive: scans`},
{ul:['A **case-sensitive, anchored prefix** pattern (`^abc`) can use an index efficiently.','Unanchored or case-insensitive patterns examine every index key or document.','For real text search use a text index or Atlas Search.']},
{h:'Text search'},
{code:`db.articles.createIndex({ title: "text", body: "text" })
db.articles.find({ $text: { $search: "mongodb replica" } },
                 { score: { $meta: "textScore" } }).sort({ score: { $meta: "textScore" } })`},
{p:'A collection can have **one** text index. It supports stemming and stop words for several languages, but Atlas Search is the richer option on Atlas.'},
{h:'Comparing fields: $expr'},
{code:`// Documents where the sold quantity exceeds the available stock
db.products.find({ $expr: { $gt: ["$sold", "$stock"] } })`},
{h:'Other useful operators'},
{t:[['Operator','Use','Index friendly?'],
['`$in`','Match any of several values','Yes'],
['`$regex`','Pattern match','Only anchored case-sensitive prefix'],
['`$text`','Full-text search','Needs a text index'],
['`$expr`','Compare fields or use aggregation expressions','Limited'],
['`$mod`','Modulus','No'],
['`$where`','JavaScript expression','No; avoid, slow and risky'],
['`$jsonSchema`','Match documents against a schema','No']]},
{note:'Anything that must run for every document is a **collection scan**. Check with explain (Section 8) before shipping a query to production.'}],
src:[['$regex',MAN+'reference/operator/query/regex/'],['Text search',MAN+'core/indexes/index-types/index-text/'],['$expr',MAN+'reference/operator/query/expr/']]};

/* ---------- 6: cursors and pagination ---------- */
L['mongo:3:6']={blocks:[
{p:'`find()` does not return all documents at once. It returns a **cursor**, and the server sends results in **batches**. Understanding cursors explains most paging and timeout behavior.'},
{svg:cur},
{h:'Cursor facts'},
{ul:['The first batch is about **101 documents** (or up to 16 MiB); later batches are larger, up to 16 MiB.','The server keeps cursor state, so an idle cursor is closed after about **10 minutes** by default.','You can set the batch size with `batchSize()`, but the driver normally handles it.','Prefer iterating a cursor over loading everything into an array.']},
{h:'Pagination approaches'},
{t:[['Approach','How','Behavior at scale'],
['**skip and limit**','`find().sort({ _id: 1 }).skip(10000).limit(20)`','Server still walks past skipped entries, so it gets slower for deep pages'],
['**Range (keyset)**','`find({ _id: { $gt: lastId } }).sort({ _id: 1 }).limit(20)`','Uses the index and stays fast at any depth']]},
{code:`// Keyset pagination: remember the last _id of the page
let page = db.orders.find({}).sort({ _id: 1 }).limit(20).toArray();
let last = page[page.length - 1]._id;

page = db.orders.find({ _id: { $gt: last } }).sort({ _id: 1 }).limit(20).toArray();`},
{h:'Stable sort order'},
{p:'Always sort by a **unique** field (or add `_id` as a tie-breaker) when paging. Without it, ties can appear twice or be missed between pages.'},
{note:'A sort that is not supported by an index happens in memory and has a memory limit. Section 7 shows how to support sorts with indexes.'}],
src:[['Iterate a cursor',MAN+'tutorial/iterate-a-cursor/'],['cursor.skip',MAN+'reference/method/cursor.skip/'],['Cursor behavior',MAN+'core/cursors/']]};
})();
