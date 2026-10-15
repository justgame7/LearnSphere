/* LearnSphere - Redis, Section 07: JSON, Query Engine and Probabilistic Data.
   Lectures 0-6 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const core8=K.dg(700,230,[
[10,10,680,210,'Redis Open Source 8',1],
[30,50,200,50,'Core types: string, list, hash,|set, sorted set, stream',0],
[270,50,180,50,'JSON',2],[490,50,180,50,'Query Engine|(search, aggregate, vector)',2],
[30,125,200,50,'Time series',2],[270,125,180,50,'Probabilistic:|Bloom, Cuckoo, CMS, Top-K, t-digest',2],[490,125,180,50,'Vector sets',2]],
[]);

const idx=K.dg(700,200,[
[10,10,680,180,'A secondary index over hashes or JSON',1],
[30,70,140,60,'Writes to keys|with prefix user:',0],[240,70,150,60,'Index idx|updated on write',2],[460,70,200,60,'FT.SEARCH idx|@city:{Oslo} @age:[20 40]',0]],
[[170,100,240,100],[390,100,460,100]]);

/* ---------- 0 ---------- */
L['redis:6:0']={blocks:[
{p:'Before Redis 8, JSON, search, time series and probabilistic types were separate **modules**, bundled as Redis Stack. In Redis 8 they ship **inside** Redis Open Source, so one server provides them without loading anything.'},
{svg:core8},
{t:[['Capability','Prefix of commands','Typical use'],
['JSON','JSON.*','Documents with nested data and path updates'],
['Query Engine','FT.*','Secondary indexes, full text, aggregation, vector search'],
['Time series','TS.*','Metrics with retention and downsampling'],
['Bloom, Cuckoo, Count-min, Top-K, t-digest','BF.*, CF.*, CMS.*, TOPK.*, TDIGEST.*','Approximate membership, counting and quantiles'],
['Vector sets','V*','Embedding storage and similarity search']]},
{h:'Checking what you have'},
{code:`INFO server
MODULE LIST
COMMAND INFO JSON.SET
COMMAND COUNT`},
{note:'Older deployments or some managed services still use the module model, or may not include every capability. Confirm with the commands above, and check provider documentation before depending on one.'}],
src:[['Redis Open Source',K.D+'operate/oss_and_stack/']]};

/* ---------- 1 ---------- */
L['redis:6:1']={blocks:[
{p:'The **JSON** type stores a JSON document in a key and lets you read and change parts of it by **path** without sending the whole document.'},
{code:`JSON.SET user:1 $ '{"name":"Ana","age":30,"address":{"city":"Oslo"},"tags":["a","b"]}'
JSON.GET user:1 $.name
JSON.GET user:1 $.address.city $.age
JSON.SET user:1 $.age 31
JSON.NUMINCRBY user:1 $.age 1
JSON.ARRAPPEND user:1 $.tags '"c"'
JSON.DEL user:1 $.address
JSON.TYPE user:1 $.tags
JSON.MGET user:1 user:2 $.name`},
{h:'Paths'},
{t:[['Path','Meaning'],
['$','The root'],
['$.name','A field'],
['$.address.city','A nested field'],
['$.tags[0]','An array element'],
['$..city','Recursive descent'],
['$.items[*].price','All prices in an array']]},
{h:'Why use it'},
{ul:['Atomic updates of one nested value, with no read-modify-write in the client.','Documents can be indexed by the Query Engine, see the next lesson.','Replaces the pattern of a JSON string in a normal key, which rewrites the whole value on any change.']},
{note:'Replies of JSONPath commands that use `$` are arrays, because a path can match several values. Legacy paths without `$` return one value.'}],
src:[['JSON',K.DT+'json/'],['JSON.SET',K.CMD+'json.set/']]};

/* ---------- 2 ---------- */
L['redis:6:2']={blocks:[
{p:'Plain Redis looks up data only by key. The **Query Engine** adds **secondary indexes** on hashes and JSON documents so you can search by field values.'},
{svg:idx},
{code:`FT.CREATE idx:user ON JSON PREFIX 1 user: SCHEMA
  $.name AS name TEXT
  $.city AS city TAG
  $.age  AS age  NUMERIC SORTABLE

JSON.SET user:1 $ '{"name":"Ana","city":"Oslo","age":30}'

FT.SEARCH idx:user "@city:{Oslo} @age:[20 40]" RETURN 2 name age LIMIT 0 10
FT.SEARCH idx:user "@name:ana*"
FT.INFO idx:user
FT.DROPINDEX idx:user`},
{t:[['Field type','Matches','Example'],
['TEXT','Full text, stemming, prefix','@name:ana*'],
['TAG','Exact values, categories','@city:{Oslo}'],
['NUMERIC','Ranges','@age:[20 40]'],
['GEO','Radius','@loc:[lon lat 10 km]'],
['VECTOR','Nearest neighbours','KNN queries']]},
{h:'How it behaves'},
{ul:['An index watches keys with the given prefix, so new and changed keys are indexed automatically.','Existing keys are indexed in the background after `FT.CREATE`.','Indexes use extra memory. Index only fields you search or sort on.','`FT.EXPLAIN` and `FT.PROFILE` show how a query runs.']},
{note:'The Query Engine does not replace a relational database. Queries are fast but joins and transactions across indexes are not supported.'}],
src:[['Query Engine',K.D+'develop/ai/search-and-query/'],['FT.CREATE',K.CMD+'ft.create/']]};

/* ---------- 3 ---------- */
L['redis:6:3']={blocks:[
{p:'Beyond filtering, the Query Engine can **aggregate**, search **text** with ranking and run **vector similarity** searches.'},
{h:'Aggregation'},
{code:`FT.AGGREGATE idx:user "*"
  GROUPBY 1 @city
  REDUCE COUNT 0 AS users
  REDUCE AVG 1 @age AS avg_age
  SORTBY 2 @users DESC
  LIMIT 0 10`},
{p:'Aggregation pipelines are built from steps such as `GROUPBY`, `REDUCE`, `APPLY`, `FILTER` and `SORTBY`. They run on the indexed data and return a result set, not documents.'},
{h:'Full text'},
{ul:['Stemming and stop words by language.','Phrase and prefix matches, optional fuzzy matching.','Relevance scoring with weights per field.']},
{h:'Vector search'},
{code:`FT.CREATE idx:doc ON HASH PREFIX 1 doc: SCHEMA
  title TEXT
  embedding VECTOR HNSW 6 TYPE FLOAT32 DIM 768 DISTANCE_METRIC COSINE

FT.SEARCH idx:doc "*=>[KNN 5 @embedding $q]" PARAMS 2 q <binary> DIALECT 2`},
{t:[['Index type','Trade-off'],
['FLAT','Exact, linear scan, good for small sets'],
['HNSW','Approximate, fast on large sets, uses more memory'],
['SVS-VAMANA','Compressed approximate index for large collections (recent versions)']]},
{note:'Embeddings come from a model you run outside Redis. Redis stores the vectors and searches them. Use the same model and distance metric for data and queries.'}],
src:[['Aggregations',K.D+'develop/ai/search-and-query/advanced-concepts/aggregations/'],['Vector search',K.D+'develop/ai/search-and-query/vectors/']]};

/* ---------- 4 ---------- */
L['redis:6:4']={blocks:[
{p:'A **vector set** is a data type for storing elements together with embeddings and finding the most similar ones. It is designed to feel like a sorted set where the order is similarity.'},
{code:`VADD products VALUES 3 0.1 0.9 0.2 "shirt"
VADD products VALUES 3 0.2 0.8 0.1 "jacket"
VSIM products VALUES 3 0.1 0.85 0.2 COUNT 5 WITHSCORES
VSIM products ELE "shirt" COUNT 3
VCARD products
VDIM products
VEMB products "shirt"
VREM products "jacket"
VSETATTR products "shirt" '{"colour":"blue"}'`},
{t:[['','Vector set','Query Engine vector index'],
['Model','A data type with its own commands','An index over hashes or JSON'],
['Filters','Attributes with a filter expression','Full query language'],
['Best for','Simple similarity lookups and recommendations','Search that mixes text, tags and vectors'],
['Maturity','Introduced in Redis 8.0 as a beta','Established']]},
{h:'Things to remember'},
{ul:['Elements are unique, like set members.','Vectors are quantised by default to save memory, with a precision trade-off.','It builds an HNSW graph, so inserts cost more than plain keys.']},
{note:'Vector sets were introduced in Redis 8.0 as a beta. Check the release notes for their status and any command changes in your version.'}],
src:[['Vector sets',K.DT+'vector-sets/'],['VSIM',K.CMD+'vsim/']]};

/* ---------- 5 ---------- */
L['redis:6:5']={blocks:[
{p:'**Time series** stores timestamp and value samples with automatic retention and downsampling, and queries over ranges and labels.'},
{code:`TS.CREATE temp:room1 RETENTION 86400000 LABELS room 1 type temp
TS.ADD temp:room1 * 21.4
TS.ADD temp:room1 1760534400000 21.9
TS.RANGE temp:room1 - + AGGREGATION avg 60000
TS.GET temp:room1
TS.MRANGE - + FILTER type=temp GROUPBY room REDUCE max

TS.CREATE temp:room1:hourly RETENTION 2592000000
TS.CREATERULE temp:room1 temp:room1:hourly AGGREGATION avg 3600000`},
{t:[['Concept','Meaning'],
['RETENTION','Milliseconds to keep samples. 0 keeps forever'],
['LABELS','Key-value metadata for filtering across series'],
['Compaction rule','Automatic downsampling into another series'],
['Duplicate policy','What to do with a sample at an existing timestamp'],
['Aggregations','avg, sum, min, max, count, first, last, std and more']]},
{h:'When it fits'},
{ul:['Metrics and sensor readings where recent data is queried most.','Dashboards that need downsampled ranges quickly.','Not a replacement for a long-term analytical store. Use retention and rules to bound memory.']}],
src:[['Time series',K.DT+'timeseries/'],['TS.ADD',K.CMD+'ts.add/']]};

/* ---------- 6 ---------- */
L['redis:6:6']={blocks:[
{p:'**Probabilistic structures** answer questions about huge streams of data with a fixed small memory and a controlled error, trading exactness for scale.'},
{t:[['Structure','Question','Notes'],
['Bloom filter','Have I seen this element?','No false negatives, some false positives, no delete'],
['Cuckoo filter','Have I seen this? Can I delete?','Supports delete, slightly more memory'],
['Count-min sketch','How many times did X occur?','Overestimates, never underestimates'],
['Top-K','Which items are most frequent?','Keeps a fixed number of heavy hitters'],
['t-digest','What is the 99th percentile?','Accurate at the tails'],
['HyperLogLog','How many distinct items?','Built in to core since early versions']]},
{code:`BF.RESERVE seen:urls 0.01 1000000
BF.ADD seen:urls "https://a.example"
BF.EXISTS seen:urls "https://a.example"

CMS.INITBYPROB clicks 0.001 0.01
CMS.INCRBY clicks "page:1" 1
CMS.QUERY clicks "page:1"

TOPK.RESERVE trending 10
TOPK.ADD trending "a" "b" "a"
TOPK.LIST trending

TDIGEST.CREATE latency
TDIGEST.ADD latency 12 15 11 220
TDIGEST.QUANTILE latency 0.5 0.99`},
{h:'Choosing'},
{ul:['Avoid doing an expensive lookup for something unseen: Bloom filter in front of a database.','Counting events by key with bounded memory: count-min sketch.','A leaderboard of heavy hitters without tracking every key: Top-K.','Percentiles of latency across many hosts: t-digest, which can also be merged.']},
{note:'Set the error rate and capacity at creation. A Bloom filter that exceeds its capacity grows by adding layers and its false positive rate rises.'}],
src:[['Probabilistic data types',K.DT+'probabilistic/'],['BF.RESERVE',K.CMD+'bf.reserve/']]};
})();
