/* LearnSphere - MongoDB, Section 05: Aggregation Framework.
   Lectures 0-6 are core, 7-8 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const pipe=M.dg(700,150,[
[10,10,680,130,'An aggregation pipeline: documents flow through stages',1],
[30,55,100,55,'Collection|orders',0],[160,55,100,55,'$match|filter',2],[290,55,100,55,'$group|totals',2],[420,55,100,55,'$sort|order',2],[550,55,120,55,'Result|documents',0]],
[[130,82,160,82],[260,82,290,82],[390,82,420,82],[520,82,550,82]]);

const groupd=M.dg(700,160,[
[10,10,680,140,'$group collapses many documents into one per key',1],
[30,45,170,90,'orders|A 10|B 5|A 7|B 3',0],[260,60,150,60,'$group by customer|sum total',2],[470,45,200,90,'results|A 17|B 8',0]],
[[200,90,260,90],[410,90,470,90]]);

const lookup=M.dg(700,170,[
[10,10,680,150,'$lookup: left outer join',1],
[30,50,170,90,'orders|customerId',0],[260,60,170,70,'$lookup|from customers|match key',2],[490,50,180,90,'orders with|customer array',0],
[260,140,170,25,'customers',0]],
[[200,95,260,95],[430,95,490,95],[345,140,345,130]]);

const order=M.dg(700,140,[
[10,10,680,120,'Stage order matters',1],
[30,55,190,55,'$match first|fewer documents flow on',2],[255,55,190,55,'then $project or $group|work on less data',0],[480,55,190,55,'$sort + $limit last|top N, memory friendly',0]],
[[220,82,255,82],[445,82,480,82]]);

/* ---------- 0: pipeline model ---------- */
L['mongo:4:0']={blocks:[
{p:'An **aggregation pipeline** is an ordered list of **stages**. Documents enter the first stage, each stage transforms them, and the output of one stage is the input of the next. It is MongoDB tool for filtering, reshaping, grouping and computing data inside the database.'},
{svg:pipe},
{code:`db.orders.aggregate([
  { $match: { status: "paid" } },
  { $group: { _id: "$customerId", total: { $sum: "$amount" }, orders: { $sum: 1 } } },
  { $sort: { total: -1 } },
  { $limit: 5 }
])`},
{h:'find vs aggregate'},
{t:[['Need','Use'],
['Filter, project, sort, limit on one collection','`find()`'],
['Totals, averages, group by','`aggregate()` with `$group`'],
['Reshape documents, flatten arrays','`aggregate()` with `$unwind`, `$project`'],
['Join another collection','`aggregate()` with `$lookup`'],
['Multi-step calculation','`aggregate()`']]},
{h:'Field paths and variables'},
{ul:['`"$amount"` refers to the value of the field `amount` in the current document.','`"$$ROOT"` is the whole current document.','`"$$NOW"` is the current date and time.']},
{h:'How the server runs it'},
{ul:['The **optimizer** reorders stages when safe, for example moving `$match` before `$project`, and merging `$sort` with `$limit`.','The first `$match` and `$sort` stages can use an **index**.','Stages stream documents where possible. Some stages, such as `$group` and `$sort` without an index, need memory.','Use `explain` on an aggregation to see the chosen plan.']},
{note:'Think of a pipeline like a shell pipe: each stage does one job on the stream of documents.'}],
src:[['Aggregation pipeline',MAN+'core/aggregation-pipeline/'],['Aggregation stages',MAN+'reference/operator/aggregation-pipeline/']]};

/* ---------- 1: core stages ---------- */
L['mongo:4:1']={blocks:[
{p:'Five stages cover most real pipelines. Learn what each does and why their **order** matters.'},
{t:[['Stage','Purpose','Example'],
['`$match`','Filter documents (same syntax as find)','`{ $match: { status: "paid" } }`'],
['`$project`','Include, exclude or compute fields','`{ $project: { name: 1, total: { $multiply: ["$qty","$price"] } } }`'],
['`$group`','Group by a key and compute accumulators','`{ $group: { _id: "$city", n: { $sum: 1 } } }`'],
['`$sort`','Order documents','`{ $sort: { n: -1 } }`'],
['`$limit` / `$skip`','Take or skip documents','`{ $limit: 10 }`']]},
{h:'$group in detail'},
{svg:groupd},
{t:[['Accumulator','Result'],
['`$sum`','Sum of values, or count with `$sum: 1`'],
['`$avg`','Average'],
['`$min`, `$max`','Smallest or largest value'],
['`$first`, `$last`','First or last value in the group (use after `$sort`)'],
['`$push`','Array of all values'],
['`$addToSet`','Array of distinct values']]},
{h:'Put the cheap, selective stages first'},
{svg:order},
{ul:['`$match` as early as possible so fewer documents flow on, and so it can use an index.','Do not `$project` more fields than you need before heavy stages.','Use `$sort` followed directly by `$limit` for a top-N, which the server optimizes.']},
{note:'`$group` stage output is **not ordered**. Add `$sort` after it if order matters.'}],
src:[['$match',MAN+'reference/operator/aggregation/match/'],['$group',MAN+'reference/operator/aggregation/group/'],['Pipeline optimization',MAN+'core/aggregation-pipeline-optimization/']]};

/* ---------- 2: reshaping ---------- */
L['mongo:4:2']={blocks:[
{p:'Many pipelines need to change the **shape** of documents: flatten arrays, add computed fields or promote an embedded document to the top level.'},
{h:'$unwind'},
{p:'`$unwind` outputs one document per array element, repeating the other fields.'},
{code:`// { _id: 1, customer: "Asha", items: [ { sku: "A", qty: 2 }, { sku: "B", qty: 1 } ] }
db.orders.aggregate([
  { $unwind: "$items" }
])
// -> { _id: 1, customer: "Asha", items: { sku: "A", qty: 2 } }
// -> { _id: 1, customer: "Asha", items: { sku: "B", qty: 1 } }`},
{ul:['A document with an empty or missing array is **dropped** unless you use `preserveNullAndEmptyArrays: true`.','Unwinding large arrays multiplies the number of documents. Filter first.']},
{h:'$addFields / $set and $project'},
{t:[['Stage','Behavior'],
['`$project`','Output **only** the fields you name (plus `_id` unless excluded)'],
['`$addFields` or `$set`','Keep all fields and add or overwrite some'],
['`$unset`','Remove fields, keep the rest']]},
{code:`db.orders.aggregate([
  { $set: { lineTotal: { $multiply: ["$items.qty", "$items.price"] } } },
  { $unset: ["internalNotes"] }
])`},
{h:'$replaceRoot and $replaceWith'},
{p:'Promote an embedded document to be the new top-level document.'},
{code:`db.users.aggregate([
  { $replaceRoot: { newRoot: "$profile" } }
])`},
{h:'A typical combination'},
{flow:['$match the orders you need','$unwind the items array','$group by product to sum quantities','$sort by quantity descending','$limit to the top 10']},
{note:'`$project` is also used to rename: `{ $project: { customerName: "$name" } }`.'}],
src:[['$unwind',MAN+'reference/operator/aggregation/unwind/'],['$addFields',MAN+'reference/operator/aggregation/addFields/'],['$replaceRoot',MAN+'reference/operator/aggregation/replaceRoot/']]};

/* ---------- 3: lookup ---------- */
L['mongo:4:3']={blocks:[
{p:'`$lookup` performs a **left outer join** with another collection **in the same database**. Each input document receives an array of matching documents from the other collection.'},
{svg:lookup},
{code:`db.orders.aggregate([
  { $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
  } },
  { $unwind: "$customer" }
])`},
{h:'Two forms'},
{t:[['Form','Use when'],
['**localField / foreignField**','Simple equality join on one key'],
['**let + pipeline**','Complex conditions, extra filtering, several keys, uncorrelated subqueries']]},
{code:`{ $lookup: {
    from: "stock",
    let: { s: "$sku", q: "$qty" },
    pipeline: [
      { $match: { $expr: { $and: [
        { $eq: ["$sku", "$$s"] },
        { $gte: ["$onHand", "$$q"] }
      ] } } }
    ],
    as: "available"
} }`},
{h:'What to keep in mind'},
{ul:['An **index on the foreign field** is essential. Without it each lookup scans the other collection.','The result is an array. Use `$unwind` to flatten, or keep the array.','`$lookup` across **sharded** collections has restrictions on older versions. Check the docs for your version.','If you need joins on almost every query, reconsider the data model (Section 6): embedding or the extended reference pattern may fit better.']},
{note:'`$lookup` is a tool for occasional relationships and reporting. It is not meant to make MongoDB behave like a normalized relational database.'}],
src:[['$lookup',MAN+'reference/operator/aggregation/lookup/']]};

/* ---------- 4: expressions ---------- */
L['mongo:4:4']={blocks:[
{p:'**Expressions** compute values inside stages such as `$project`, `$addFields` and `$group`. They are built from operators that you nest, with field paths like `"$price"` as inputs.'},
{h:'Common expression families'},
{t:[['Family','Operators','Example'],
['**Arithmetic**','`$add`, `$subtract`, `$multiply`, `$divide`, `$round`','`{ $multiply: ["$qty", "$price"] }`'],
['**Conditional**','`$cond`, `$switch`, `$ifNull`','`{ $cond: [ { $gt: ["$qty", 10] }, "bulk", "single" ] }`'],
['**String**','`$concat`, `$toUpper`, `$substrCP`, `$split`','`{ $concat: ["$first", " ", "$last"] }`'],
['**Array**','`$size`, `$filter`, `$map`, `$arrayElemAt`, `$in`','`{ $size: "$items" }`'],
['**Date**','`$year`, `$month`, `$dateToString`, `$dateTrunc`','`{ $dateToString: { format: "%Y-%m", date: "$createdAt" } }`'],
['**Type**','`$toInt`, `$toDecimal`, `$convert`','`{ $toInt: "$qtyText" }`']]},
{h:'Example: revenue per month'},
{code:`db.orders.aggregate([
  { $match: { status: "paid" } },
  { $group: {
      _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
      revenue: { $sum: "$amount" },
      orders: { $sum: 1 },
      avgOrder: { $avg: "$amount" }
  } },
  { $sort: { _id: 1 } }
])`},
{h:'Example: bucket orders by size with $cond and $switch'},
{code:`{ $addFields: {
    size: { $switch: {
      branches: [
        { case: { $lt: ["$amount", 20] },  then: "small"  },
        { case: { $lt: ["$amount", 100] }, then: "medium" }
      ],
      default: "large"
    } }
} }`},
{note:'Dates are stored in UTC. Pass a `timezone` option to date operators to group by local calendar days.'}],
src:[['Aggregation operators',MAN+'reference/operator/aggregation/'],['$dateToString',MAN+'reference/operator/aggregation/dateToString/']]};

/* ---------- 5: facet, bucket, window ---------- */
L['mongo:4:5']={blocks:[
{p:'Three families of stages help with analytics: running several pipelines on one input, bucketing values, and computing over ordered **windows** of documents.'},
{h:'$facet: several pipelines on one input'},
{code:`db.products.aggregate([
  { $match: { category: "home" } },
  { $facet: {
      byBrand:  [ { $group: { _id: "$brand", n: { $sum: 1 } } } ],
      priceStats: [ { $group: { _id: null, avg: { $avg: "$price" }, max: { $max: "$price" } } } ],
      cheapest: [ { $sort: { price: 1 } }, { $limit: 3 } ]
  } }
])`},
{p:'One pass over the matched documents returns several result sets, handy for filter panels in a search page. Output of `$facet` must fit in one 16 MiB document.'},
{h:'$bucket and $bucketAuto'},
{code:`db.products.aggregate([
  { $bucket: {
      groupBy: "$price",
      boundaries: [0, 10, 50, 100, 1000],
      default: "other",
      output: { count: { $sum: 1 } }
  } }
])`},
{h:'Window functions: $setWindowFields (5.0 and later)'},
{p:'Compute values across a window of neighboring documents without collapsing them, as SQL window functions do.'},
{code:`db.sales.aggregate([
  { $setWindowFields: {
      partitionBy: "$region",
      sortBy: { date: 1 },
      output: {
        runningTotal: { $sum: "$amount", window: { documents: ["unbounded", "current"] } },
        movingAvg:    { $avg: "$amount", window: { documents: [-2, 0] } }
      }
  } }
])`},
{t:[['Need','Stage'],
['Several summaries of the same data','`$facet`'],
['Counts per value range','`$bucket`, `$bucketAuto`'],
['Running totals, moving averages, ranks','`$setWindowFields`'],
['Top N per group','`$group` with `$topN`, or `$setWindowFields` with `$rank`']]}],
src:[['$facet',MAN+'reference/operator/aggregation/facet/'],['$bucket',MAN+'reference/operator/aggregation/bucket/'],['$setWindowFields',MAN+'reference/operator/aggregation/setWindowFields/']]};

/* ---------- 6: performance ---------- */
L['mongo:4:6']={blocks:[
{p:'A pipeline is only as fast as its stages allow. Most gains come from reducing the number of documents early and using indexes where the server can.'},
{h:'Where indexes help'},
{t:[['Stage','Can use an index?'],
['`$match` at the start','Yes'],
['`$sort` at the start (or after only `$match`)','Yes, if the index supports the sort'],
['`$group`','Only for `$first`/`$last` patterns with a suitable sort; otherwise no'],
['`$lookup`','Yes, on the foreign collection field (needs an index there)'],
['`$project`, `$addFields`, `$unwind`','No (they work on documents already read)']]},
{h:'Memory limits'},
{ul:['Blocking stages such as `$group` and `$sort` may use up to **100 MB** of RAM per stage by default.','Since **6.0**, stages spill to disk by default (`allowDiskUseByDefault`). In older versions you must pass `allowDiskUse: true`.','Any single document in the pipeline must stay under **16 MiB**.']},
{h:'Optimization checklist'},
{flow:['Move $match and $sort to the start and back them with an index','Limit fields early with $project or $unset','Replace $unwind then $group patterns with array operators when possible','Index the foreign field used by $lookup','Run explain and check docsExamined and execution time']},
{code:`db.orders.explain("executionStats").aggregate([
  { $match: { status: "paid", createdAt: { $gte: ISODate("2026-01-01") } } },
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } }
])`},
{h:'Do heavy reports elsewhere'},
{p:'Large analytical pipelines on a busy primary compete with operational traffic. Run them on a secondary (read preference), an **analytics node** (Section 10), or an Atlas analytics node, and precompute results where the same report is requested often (additional lecture).'},
{note:'In explain output look for `COLLSCAN` at the start of a pipeline and for stages that report `usedDisk: true`.'}],
src:[['Pipeline optimization',MAN+'core/aggregation-pipeline-optimization/'],['Aggregation limits',MAN+'core/aggregation-pipeline-limits/']]};
})();
