/* LearnSphere - MongoDB, Section 17: Search, Time Series & Advanced Features.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mongo-common.js. */
(function(){
const M=window.MONGO,L=window.LESSONS,MAN=M.MAN,A=M.ATLAS;

/* ---------- diagrams ---------- */
const search=M.dg(700,160,[
[10,10,680,140,'Atlas Search',1],
[30,55,130,55,'Collection|in MongoDB',0],[200,55,150,55,'Search index|Lucene based',2],[390,55,130,55,'$search stage|in a pipeline',0],[560,55,110,55,'Ranked|results',0]],
[[160,82,200,82],[350,82,390,82],[520,82,560,82]]);

const vec=M.dg(700,150,[
[10,10,680,130,'Vector search for semantic retrieval',1],
[30,55,130,55,'Text or image|source data',0],[190,55,130,55,'Embedding|model',0],[350,55,140,55,'Vectors stored|in documents',2],[520,55,150,55,'$vectorSearch|nearest neighbors',2]],
[[160,82,190,82],[320,82,350,82],[490,82,520,82]]);

const ts=M.dg(700,150,[
[10,10,680,130,'Time series collection',1],
[30,55,150,55,'Measurements|time, meta, values',0],[230,55,160,55,'Automatic bucketing|by time and meta',2],[440,55,230,55,'Compressed storage and fast|time-range queries',0]],
[[180,82,230,82],[390,82,440,82]]);

/* ---------- 0: Atlas Search ---------- */
L['mongo:16:0']={blocks:[
{p:'**Atlas Search** adds full-text search to MongoDB, built on Apache Lucene. Documents are indexed alongside the database, so there is no separate search cluster to synchronize. You query it with the `$search` aggregation stage.'},
{svg:search},
{h:'Why not just use regex or $text'},
{t:[['Need','`$regex` / `$text`','Atlas Search'],
['Relevance ranking','Basic with `$text`','Yes, scored with tuning'],
['Typo tolerance','No','Fuzzy matching'],
['Autocomplete','No','Yes'],
['Facets and counts','Manual aggregation','Built in with `$searchMeta`'],
['Language analysis','Limited','Analyzers for many languages'],
['Highlighting','No','Yes']]},
{h:'Create an index and query'},
{code:`// Define a search index (dynamic mapping)
db.products.createSearchIndex("default", { mappings: { dynamic: true } })

// Search with a compound query
db.products.aggregate([
  { $search: { compound: {
      must:   [ { text: { query: "wireless headphones", path: ["name", "description"], fuzzy: {} } } ],
      filter: [ { range: { path: "price", lte: 200 } } ]
  } } },
  { $limit: 10 },
  { $project: { name: 1, price: 1, score: { $meta: "searchScore" } } }
])`},
{h:'Key points'},
{ul:['Search indexes are separate from regular indexes and are built from a **mapping** (which fields, which analyzers).','Search runs on dedicated **search processes** (mongot) alongside the cluster.','The index updates **asynchronously** from the change stream, so results are near real time, not instant.','Available on **Atlas**. Support for self-managed deployments has been introduced in newer releases, so check current availability.']}],
src:[['Atlas Search',A+'atlas-search/'],['$search',A+'atlas-search/aggregation-stages/search/']]};

/* ---------- 1: Vector search ---------- */
L['mongo:16:1']={blocks:[
{p:'**Vector search** finds items by **meaning** instead of exact words. Text, images or other data are converted into **embeddings** (arrays of numbers) by a model. Items with similar meaning have vectors that are close together.'},
{svg:vec},
{h:'Typical use cases'},
{ul:['**Semantic search**: find documents that mean the same even if the words differ.','**Retrieval-augmented generation (RAG)**: fetch relevant passages to give an LLM.','**Recommendations** and **similar items**.']},
{h:'Create and query'},
{code:`// Index definition (index type: vectorSearch)
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 1536, "similarity": "cosine" },
    { "type": "filter", "path": "category" }
  ]
}

// Query
db.articles.aggregate([
  { $vectorSearch: {
      index: "vec_idx",
      path: "embedding",
      queryVector: queryEmbedding,   // same model that created the stored embeddings
      numCandidates: 200,
      limit: 5,
      filter: { category: "support" }
  } },
  { $project: { title: 1, score: { $meta: "vectorSearchScore" } } }
])`},
{h:'Things to decide'},
{t:[['Decision','Notes'],
['**Embedding model**','Fixes the number of dimensions; changing it means re-embedding'],
['**Similarity**','cosine, dotProduct or euclidean, matched to the model'],
['**numCandidates and limit**','More candidates give better recall at higher cost'],
['**Pre-filtering**','Filter fields in the index narrow results by metadata'],
['**Storage**','Vectors are large; account for memory and disk']]},
{note:'Vector search stores vectors next to your operational data, so one query can combine metadata filters and similarity.'}],
src:[['Atlas Vector Search',A+'atlas-vector-search/'],['$vectorSearch',A+'atlas-vector-search/vector-search-stage/']]};

/* ---------- 2: time series ---------- */
L['mongo:16:2']={blocks:[
{p:'**Time series collections** (5.0 and later) are optimized for measurements over time: metrics, sensors, events and prices. MongoDB groups measurements into buckets internally, so storage is smaller and time-range queries are faster.'},
{svg:ts},
{code:`db.createCollection("sensor_readings", {
  timeseries: {
    timeField: "ts",          // required: a date
    metaField: "sensor",      // labels that identify the series
    granularity: "minutes"    // seconds, minutes or hours: expected arrival interval
  },
  expireAfterSeconds: 60 * 60 * 24 * 90   // optional automatic retention: 90 days
})

db.sensor_readings.insertOne({
  ts: new Date(), sensor: { id: "s-17", site: "plant-1" }, temp: 21.6
})`},
{h:'Query example'},
{code:`db.sensor_readings.aggregate([
  { $match: { "sensor.id": "s-17", ts: { $gte: ISODate("2026-03-01"), $lt: ISODate("2026-03-02") } } },
  { $group: { _id: { $dateTrunc: { date: "$ts", unit: "hour" } }, avgTemp: { $avg: "$temp" } } },
  { $sort: { _id: 1 } }
])`},
{h:'When to use and how to choose options'},
{t:[['Setting','Guidance'],
['`timeField`','The measurement time'],
['`metaField`','Data that rarely changes and identifies the source; keep it small and stable'],
['`granularity`','Match how often a series produces data'],
['`expireAfterSeconds`','Retention policy built in'],
['Secondary indexes','Supported on time and meta fields and measurements']]},
{ul:['Best for **append-mostly** data. Updates and deletes are more limited than in regular collections.','You can still use the aggregation framework, including window functions.']}],
src:[['Time series collections',MAN+'core/timeseries-collections/']]};

/* ---------- 3: TTL, capped, GridFS ---------- */
L['mongo:16:3']={blocks:[
{p:'Three older features solve specific storage problems: **expiring data**, **fixed-size logs** and **large files**.'},
{h:'TTL indexes'},
{code:`db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 })
// a background task deletes documents older than one hour (checked about every minute)`},
{p:'Best for sessions, tokens, temporary data and short-lived caches.'},
{h:'Capped collections'},
{code:`db.createCollection("recent_events", { capped: true, size: 100 * 1024 * 1024, max: 100000 })`},
{ul:['Fixed size: when full, the **oldest documents are overwritten**.','Documents keep **insertion order**, and inserts and reads are fast.','You cannot delete individual documents or grow them, and they cannot be sharded.']},
{h:'GridFS'},
{p:'**GridFS** stores files larger than 16 MiB by splitting them into **chunks** (255 KiB by default) in two collections: `fs.files` (metadata) and `fs.chunks`.'},
{code:`mongofiles --uri "mongodb://localhost/shop" put manual.pdf
mongofiles --uri "mongodb://localhost/shop" list
mongofiles --uri "mongodb://localhost/shop" get manual.pdf`},
{h:'Choosing'},
{t:[['Need','Use'],
['Auto-expire documents by age','TTL index'],
['Rolling window of the most recent N items','Capped collection'],
['Store files bigger than 16 MiB inside MongoDB','GridFS'],
['Large binary assets served to users','Often object storage (S3, Blob) plus a reference in MongoDB'],
['Metrics over time with retention','Time series collection']]},
{note:'GridFS is fine for moderate file needs. For heavy file serving, object storage with metadata in MongoDB is usually cheaper and faster.'}],
src:[['TTL indexes',MAN+'core/index-ttl/'],['Capped collections',MAN+'core/capped-collections/'],['GridFS',MAN+'core/gridfs/']]};

/* ---------- 4: geospatial ---------- */
L['mongo:16:4']={blocks:[
{p:'MongoDB can store **locations** and answer questions such as "what is within 2 km" or "which region contains this point". It uses **GeoJSON** objects and a `2dsphere` index.'},
{h:'Store a location'},
{code:`// GeoJSON order is [longitude, latitude]
db.places.insertOne({
  name: "Central Cafe",
  location: { type: "Point", coordinates: [73.8567, 18.5204] }
})

db.places.createIndex({ location: "2dsphere" })`},
{h:'Common queries'},
{t:[['Operator','Question'],
['`$near`, `$nearSphere`','Closest to a point, sorted by distance (needs an index)'],
['`$geoWithin`','Inside a polygon or circle'],
['`$geoIntersects`','Intersecting a shape'],
['`$geoNear` (aggregation)','Nearest first with computed distance; must be the first stage']]},
{code:`// Within 1500 meters, nearest first
db.places.find({
  location: { $near: {
    $geometry: { type: "Point", coordinates: [73.85, 18.52] },
    $maxDistance: 1500
  } }
})

// Inside a polygon
db.places.find({ location: { $geoWithin: { $geometry: {
  type: "Polygon",
  coordinates: [ [ [73.8,18.4], [73.9,18.4], [73.9,18.6], [73.8,18.6], [73.8,18.4] ] ]
} } } })`},
{h:'Remember'},
{ul:['Coordinates are **longitude first, then latitude**.','Distances are in **meters** with `2dsphere`.','Polygons must be **closed**: the first and last point are the same.','Combine with a normal filter and index, for example category and location.']}],
src:[['Geospatial queries',MAN+'geospatial-queries/'],['2dsphere index',MAN+'core/indexes/index-types/geospatial/2dsphere/']]};
})();
