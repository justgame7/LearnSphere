/* LearnSphere - MongoDB, Section 07: Indexes.
   Lectures 0-5 are core, 6-7 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN;

/* ---------- diagrams ---------- */
const scan=M.dg(700,160,[
[10,10,330,140,'Without an index: COLLSCAN',1],[360,10,330,140,'With an index: IXSCAN',1],
[30,55,290,60,'Read every document in the collection|and test the filter',0],
[380,45,130,35,'Index lookup',2],[540,45,130,35,'Few documents|fetched',0],[380,100,290,35,'Cost follows matches, not collection size',0]],
[[510,62,540,62]]);

const esr=M.dg(700,140,[
[10,10,680,120,'Compound index field order: ESR',1],
[30,55,190,55,'E: Equality|fields tested with =',2],[255,55,190,55,'S: Sort|fields in the sort',2],[480,55,190,55,'R: Range|fields tested with $gt, $lt, $in',2]],
[[220,82,255,82],[445,82,480,82]]);

const prefix=M.dg(700,150,[
[10,10,680,130,'Index { status: 1, city: 1, createdAt: -1 } supports',1],
[30,55,200,55,'{ status }',2],[255,55,200,55,'{ status, city }',2],[480,55,190,55,'{ status, city, createdAt }',2]],
[]);

const multikey=M.dg(700,150,[
[10,10,680,130,'Multikey index: one entry per array element',1],
[30,55,190,55,'doc { tags: [red, blue] }',0],[270,45,150,35,'index key: red',2],[270,90,150,35,'index key: blue',2],[470,55,200,55,'both keys point|to the same document',0]],
[[220,75,270,62],[220,85,270,107],[420,62,470,75],[420,107,470,90]]);

const build=M.dg(700,130,[
[10,20,680,90,'Index build on a replica set (4.4 and later)',1],
[30,55,150,40,'Build starts|on all members',0],[210,55,150,40,'Scan collection,|keep writing',0],[390,55,140,40,'Commit quorum|reached',2],[560,55,110,40,'Index ready',0]],
[[180,75,210,75],[360,75,390,75],[530,75,560,75]]);

/* ---------- 0: how indexes work ---------- */
L['mongo:6:0']={blocks:[
{p:'An **index** is a sorted data structure (a B-tree) that lets the server find documents without reading the whole collection. Indexes are the single biggest lever for query performance.'},
{svg:scan},
{h:'What an index does'},
{ul:['Stores a **sorted copy** of one or more fields, each entry pointing to a document.','Lets the server do **range scans** and **sorted reads** without sorting in memory.','Every collection has a **unique index on `_id`** automatically.']},
{h:'The cost'},
{t:[['Benefit','Cost'],
['Fast reads and sorts','Slower writes: every insert, update of an indexed field and delete must also maintain each index'],
['Fewer documents examined','Extra disk space and memory (indexes should fit in RAM in practice)']]},
{h:'Basic commands'},
{code:`db.orders.createIndex({ customerId: 1 })          // ascending
db.orders.createIndex({ createdAt: -1 })          // descending
db.orders.getIndexes()                            // list indexes
db.orders.dropIndex("customerId_1")               // drop by name
db.orders.aggregate([ { $indexStats: {} } ])      // how often each index is used`},
{h:'Is the query using an index?'},
{code:`db.orders.find({ customerId: 7 }).explain("executionStats")
// look at winningPlan.stage: IXSCAN (index) or COLLSCAN (full scan)
// compare totalDocsExamined with nReturned`},
{note:'Aim for **docsExamined close to nReturned**. A big gap means the index does not match the query well. Section 8 covers explain in depth.'}],
src:[['Indexes',MAN+'indexes/'],['createIndex',MAN+'reference/method/db.collection.createIndex/']]};

/* ---------- 1: single, compound, multikey ---------- */
L['mongo:6:1']={blocks:[
{p:'Most indexes you create are single-field, compound or multikey. Their field order and type decide which queries they serve.'},
{h:'Single-field'},
{p:'Supports equality, range and sort on that field. Direction does not matter for a single field because the index can be read in either direction.'},
{h:'Compound indexes'},
{p:'A compound index covers several fields in a defined order. It supports queries on any **prefix** of its fields.'},
{svg:prefix},
{h:'The ESR rule: choosing field order'},
{svg:esr},
{t:[['Position','Field kind','Why'],
['First','**Equality**','Narrows to an exact point in the index'],
['Next','**Sort**','Lets the index return documents already in order'],
['Last','**Range**','A range breaks sorted order of later fields, so it goes at the end']]},
{code:`// Query: status = "paid", sort by createdAt desc, amount > 100
db.orders.createIndex({ status: 1, createdAt: -1, amount: 1 })
db.orders.find({ status: "paid", amount: { $gt: 100 } }).sort({ createdAt: -1 })`},
{h:'Sort direction in compound indexes'},
{p:'A compound index supports a sort in the **same** directions as defined or in the **exact opposite** for all fields. Mixed combinations need their own index.'},
{h:'Multikey indexes'},
{svg:multikey},
{ul:['Created automatically when you index a field that holds an array.','A compound index may include **at most one array field** per document.','Large arrays create many index entries, so writes get more expensive.']}],
src:[['Compound indexes',MAN+'core/indexes/index-types/index-compound/'],['Multikey indexes',MAN+'core/indexes/index-types/index-multikey/'],['ESR rule',MAN+'tutorial/equality-sort-range-rule/']]};

/* ---------- 2: specialized ---------- */
L['mongo:6:2']={blocks:[
{p:'Besides the ordinary B-tree, MongoDB offers specialized index types for specific query shapes.'},
{t:[['Index','Create','Serves'],
['**Text**','`createIndex({ body: "text" })`','`$text` queries with stemming and relevance score. One per collection.'],
['**2dsphere**','`createIndex({ loc: "2dsphere" })`','Geospatial queries on GeoJSON: `$near`, `$geoWithin`'],
['**2d**','`createIndex({ loc: "2d" })`','Legacy flat coordinate pairs'],
['**Hashed**','`createIndex({ userId: "hashed" })`','Equality only; used for hashed shard keys'],
['**Wildcard**','`createIndex({ "attrs.$**": 1 })`','Fields whose names are not known in advance'],
['**Clustered**','Option on collection creation','Store documents in key order (additional lecture)'],
['**Atlas Search / Vector**','Atlas only','Full-text and similarity search (Section 17)']]},
{h:'Wildcard indexes'},
{p:'A wildcard index indexes all fields (or a subtree) of documents with varying shape. It is handy for the attribute pattern, but it is **not a replacement** for a purpose-built compound index.'},
{code:`db.products.createIndex({ "specs.$**": 1 })
db.products.find({ "specs.color": "red" })`},
{h:'Geospatial example'},
{code:`db.places.createIndex({ location: "2dsphere" })
db.places.find({
  location: { $near: {
    $geometry: { type: "Point", coordinates: [73.85, 18.52] },
    $maxDistance: 2000
  } }
})`},
{note:'Choose the specialized index only when the query uses the matching operator. A hashed or text index does not help ordinary range queries.'}],
src:[['Index types',MAN+'core/indexes/index-types/'],['Wildcard indexes',MAN+'core/indexes/index-types/index-wildcard/'],['Geospatial indexes',MAN+'core/indexes/index-types/geospatial/']]};

/* ---------- 3: properties ---------- */
L['mongo:6:3']={blocks:[
{p:'Index **properties** change how an index behaves. They are options on `createIndex` and can be combined with most index types.'},
{t:[['Property','What it does','Typical use'],
['**unique**','Rejects duplicate values','Emails, usernames, business keys'],
['**partial**','Indexes only documents matching a filter','Index only active or recent documents to save space'],
['**sparse**','Skips documents missing the field','Older equivalent of partial for missing fields'],
['**TTL**','Deletes documents after a time','Sessions, tokens, temporary data'],
['**hidden**','Invisible to the planner but still maintained','Test the effect of dropping an index'],
['**collation**','Language-specific comparison','Case-insensitive matching']]},
{h:'Examples'},
{code:`// Unique
db.users.createIndex({ email: 1 }, { unique: true })

// Partial: only open orders are indexed
db.orders.createIndex({ createdAt: 1 }, { partialFilterExpression: { status: "open" } })

// TTL: remove documents one hour after expiresAt
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 3600 })

// Hide, then observe, then drop
db.orders.hideIndex("createdAt_1")
db.orders.unhideIndex("createdAt_1")`},
{h:'Worth knowing'},
{ul:['A query can use a **partial** index only if its filter is guaranteed to fall within the index filter.','**TTL** deletion runs in a background task about **every 60 seconds**, so expiry is not exact.','TTL works on a single date field (or an array of dates).','**Unique** indexes on a sharded collection must include the shard key (Section 11).','A hidden index lets you check the impact of removing it before you drop it for good.']}],
src:[['Index properties',MAN+'core/indexes/index-properties/'],['TTL indexes',MAN+'core/index-ttl/'],['Partial indexes',MAN+'core/index-partial/']]};

/* ---------- 4: covered queries and index selection ---------- */
L['mongo:6:4']={blocks:[
{p:'When several indexes could serve a query, the **query planner** picks one. When an index contains **all** the fields a query needs, the server can answer without reading documents at all.'},
{h:'How the planner chooses'},
{flow:['The planner finds the indexes that could serve the query','It runs the candidate plans in a short trial, in parallel','The plan that returns results fastest wins','The winning plan is cached for queries of the same shape','The cache entry is dropped on index changes, big data changes or restart']},
{h:'Covered queries'},
{p:'A query is **covered** when its filter and its projection use only indexed fields, and `_id` is excluded (or indexed). The result comes straight from the index.'},
{code:`db.orders.createIndex({ customerId: 1, status: 1, amount: 1 })

// Covered: all fields are in the index and _id is not returned
db.orders.find(
  { customerId: 7, status: "paid" },
  { amount: 1, _id: 0 }
)
// explain: totalDocsExamined is 0`},
{h:'What stops a query from being covered'},
{ul:['The projection asks for a field that is **not in the index**.','A field in the query or projection is an **array** (multikey).','`_id` is returned but is not in the index.','The index is sparse or partial and the query does not guarantee coverage.']},
{h:'Steering the planner'},
{t:[['Tool','Use'],
['`explain("allPlansExecution")`','See rejected plans and why'],
['`hint({ field: 1 })`','Force an index (for diagnosis; avoid in application code if possible)'],
['`hideIndex`','Test without an index safely'],
['Plan cache commands','Inspect and clear cached plans']]}],
src:[['Query plans',MAN+'core/query-plans/'],['Covered queries',MAN+'core/query-optimization/#covered-query']]};

/* ---------- 5: production ---------- */
L['mongo:6:5']={blocks:[
{p:'Creating, changing and removing indexes on a live system needs care: builds consume I/O, memory and, on replica sets, they must complete on every member.'},
{svg:build},
{h:'How builds work now (4.4 and later)'},
{ul:['The index builds **on all data-bearing members at the same time**.','Builds hold an exclusive lock only briefly at the start and end, and **allow reads and writes** during the build.','A **commit quorum** decides when the primary commits: by default all voting members must have finished (`votingMembers`).','Memory use is capped (`maxIndexBuildMemoryUsageMegabytes`, default 200 MB) and the build spills to disk.']},
{code:`// Wait only for a majority of members to finish building
db.orders.createIndex({ customerId: 1, createdAt: -1 }, {}, "majority")

// Watch progress
db.currentOp({ "command.createIndexes": { $exists: true } })`},
{h:'Production checklist'},
{flow:['Check the query really needs the index with explain','Estimate size and free disk, memory and I/O headroom','Create the index during a quiet period','Monitor progress and replication lag','Verify with explain that queries use it','Review and drop indexes that became redundant']},
{h:'Finding indexes to remove'},
{code:`// Indexes with ops count 0 since the last restart are candidates (after enough uptime)
db.orders.aggregate([ { $indexStats: {} },
  { $project: { name: 1, ops: "$accesses.ops", since: "$accesses.since" } } ])`},
{ul:['An index that is a **prefix** of another compound index is usually redundant.','Hide an index first, watch for a few days, then drop it.','Keep the total number of indexes small. A collection can have up to 64.']},
{note:'On Atlas, Performance Advisor suggests missing indexes and flags redundant ones.'}],
src:[['Index builds on replica sets',MAN+'core/index-creation/'],['Manage indexes',MAN+'tutorial/manage-indexes/'],['$indexStats',MAN+'reference/operator/aggregation/indexStats/']]};
})();
