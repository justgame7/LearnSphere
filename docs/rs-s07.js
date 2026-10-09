/* LearnSphere - Amazon Redshift, Section 07: Data Loading, Unloading & Ingestion.
   Lectures 0-7 are core, 8-13 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const eltflow=R.dg(700,220,[
[10,80,110,60,'Source files|CSV, JSON, Parquet',0],
[160,80,110,60,'Amazon S3|split, compressed',2],
[310,80,110,60,'COPY|parallel load',2],
[460,20,110,60,'Staging table|raw, cleaned',0],
[460,140,110,60,'Validation|counts, duplicates',0],
[600,80,90,60,'MERGE into|target table',2]],
[[120,110,160,110],[270,110,310,110],[420,95,460,60],[420,125,460,165],[570,50,600,95],[570,170,600,125]]);

const autocopy=R.dg(700,200,[
[10,70,120,60,'New file lands|in S3 prefix',0],
[170,70,150,60,'S3 event integration|detects the new object',2],
[360,70,150,60,'COPY JOB|runs COPY for new files',2],
[550,70,140,60,'Target table|loaded; files tracked',0]],
[[130,100,170,100],[320,100,360,100],[510,100,550,100]]);

const streamz=R.dg(700,260,[
[10,20,330,100,'Streaming ingestion',1],[360,20,330,100,'Zero-ETL integration',1],
[25,55,95,50,'Kinesis or|MSK stream',0],[150,55,175,50,'Streaming materialized|view (auto refresh)',2],
[375,55,115,50,'Aurora, RDS,|DynamoDB, apps',0],[520,55,155,50,'Destination database|in Redshift',2],
[10,150,680,100,'Both land data in Redshift without you building a pipeline|you design: SUPER shredding, transformation views, monitoring and permissions',0]],
[[120,80,150,80],[490,80,520,80]]);

/* ================= LECTURE 0 ================= */
L['rs:6:0']={blocks:[
{p:'Getting data into Redshift quickly and safely is the DBA core skill after table design. The rule is simple: **load in bulk, in parallel, from Amazon S3.** This lecture gives the principles that the rest of the section builds on.'},
{svg:eltflow},
{h:'COPY beats INSERT'},
{t:[['Method','Speed','Use for'],
['**COPY** from S3 and other sources','Fastest: reads many files in parallel across all slices','Any load of real size; the default choice'],
['**INSERT ... SELECT** or **CTAS**','Fast: bulk insert inside the warehouse','Moving or transforming data already in Redshift'],
['**Multi-row INSERT** (`INSERT ... VALUES (...),(...)`)','Slower than the above','Small batches when COPY is not practical'],
['**Single-row INSERT**','Slowest: one commit and round trip per row','Almost never in a warehouse']]},
{h:'Best practices'},
{ul:['**Use one COPY command for many files**, not many COPY commands for one file each. A single COPY uses every slice.','**Split data into several files** (a multiple of the slice count) of similar size, and **compress** them (next lectures).','**Verify** files before and after a load: confirm the files are all there before you load, and check row counts and errors afterwards.','**Load in sort key order** when you can: data that arrives in the order of the sort key stays sorted and needs no vacuum. If it does not, sort within each load.','**Load in sequential blocks** and prefer **time-series tables** (for example one table per month, with a view over them) so that old data can be dropped rather than deleted.','**Use a staging table** to merge new data into existing tables (the upsert lecture).','**Run `ANALYZE`** after significant loads. The default threshold is 10 percent: ANALYZE skips a table where fewer than 10 percent of rows changed, so calling it at the end of every load is cheap.','**Schedule loads around the maintenance window** so a patch does not hit a load.','**Group related loads in one transaction**, so readers never see one table loaded and a related table not.']},
{h:'A transaction around related loads'},
{code:`BEGIN;
COPY staging.orders      FROM 's3://my-bucket/orders/2026-10-09/'      IAM_ROLE default FORMAT AS CSV GZIP IGNOREHEADER 1;
COPY staging.order_items FROM 's3://my-bucket/order_items/2026-10-09/' IAM_ROLE default FORMAT AS CSV GZIP IGNOREHEADER 1;
-- ... merge into target tables here ...
COMMIT;`},
{h:'Sources COPY can read'},
{t:[['Source','Notes'],
['Amazon S3','The standard. Text, CSV, JSON, Avro, Parquet and ORC'],
['Amazon DynamoDB','One table at a time; uses its provisioned throughput'],
['Amazon EMR','Read files from an EMR cluster'],
['Remote hosts over SSH','Specialised; run commands on hosts that produce text output']]},
{p:'Beyond COPY you can automate loading (auto-copy), stream data in (Kinesis and MSK), or replicate operational databases continuously (zero-ETL). Each is a later lecture.'},
{note:'Treat the warehouse as a bulk-load system. Applications that insert one row at a time are the most common cause of slow loads and heavy maintenance, because every tiny insert creates small blocks that must later be merged and vacuumed.'}],
src:[['Best practices for loading data',DG+'c_loading-data-best-practices.html'],['Loading data',DG+'t_Loading_data.html'],['Advisor recommendations',DG+'advisor-recommendations.html']]};

/* ================= LECTURE 1 ================= */
L['rs:6:1']={blocks:[
{p:'`COPY` is the command that loads data in parallel from files. This lecture covers its structure, authorization, formats and the options you will use most.'},
{h:'The basic forms'},
{code:`-- Load every file whose name starts with the prefix
COPY sales FROM 's3://my-bucket/sales/2026/10/'
IAM_ROLE 'arn:aws:iam::123456789012:role/MyRedshiftRole'
FORMAT AS CSV GZIP IGNOREHEADER 1;

-- Use the role set as default on the warehouse
COPY sales FROM 's3://my-bucket/sales/2026/10/' IAM_ROLE default CSV GZIP;

-- Load exactly the files listed in a manifest
COPY sales FROM 's3://my-bucket/manifests/sales_2026_10.json' IAM_ROLE default CSV MANIFEST;`},
{ul:['The target table must **already exist**.','Authorization uses an **IAM role** (`IAM_ROLE`). It is the preferred method; the role needs `s3:GetObject` and `s3:ListBucket` on the bucket.','If **no object matches** the prefix, the load fails.','A bucket in another Region needs the `REGION` option.']},
{h:'File formats'},
{t:[['Format','Keyword','Notes'],
['Delimited text (default)','`DELIMITER \'|\'`','Default delimiter is the pipe character'],
['CSV','`CSV [QUOTE \'"\']`','Comma by default; fields in quotes may contain delimiters and newlines. Cannot combine with `FIXEDWIDTH`, `REMOVEQUOTES` or `ESCAPE`'],
['Fixed width','`FIXEDWIDTH \'id:6,name:20\'`','Each column has a set width in bytes'],
['JSON','`FORMAT JSON \'auto\'`','Matches object keys to column names. `\'auto ignorecase\'`, a JSONPaths file, or `\'noshred\'` (load whole documents into a SUPER column)'],
['Avro','`FORMAT AVRO \'auto\'`','Schema is in the file'],
['Parquet, ORC','`FORMAT PARQUET`, `FORMAT ORC`','Columnar formats; efficient and typed, with some restrictions on mapping']]},
{ul:['JSON field names that are not lowercase need `\'auto ignorecase\'` or a JSONPaths file, since Redshift column names are lowercase.','A single JSON object must be a stand-alone root-level object; objects cannot be separated by commas. An object, or an Avro data block, is limited to 4 MB.','Parquet and ORC are the best formats for loading because they carry types and compress well.']},
{h:'Options you will use'},
{t:[['Option','Purpose'],
['`IGNOREHEADER n`','Skip n header lines'],
['`GZIP`, `BZIP2`, `LZOP`, `ZSTD`','Tell COPY the files are compressed'],
['`DATEFORMAT \'auto\'`, `TIMEFORMAT \'auto\'`','Parse varied date formats'],
['`NULL AS \'\\N\'`, `EMPTYASNULL`, `BLANKSASNULL`','Control how empty values and nulls are read'],
['`TRUNCATECOLUMNS`','Cut strings that are too long instead of failing (use with care)'],
['`ACCEPTINVCHARS`','Replace invalid UTF-8 characters'],
['`MAXERROR n`','Allow up to n bad rows before failing (default 0)'],
['`NOLOAD`','Check the files for errors without loading anything'],
['`COMPUPDATE OFF`, `STATUPDATE OFF`','Skip automatic compression analysis or statistics update'],
['`REGION \'us-west-2\'`','Source bucket is in another Region'],
['`COLUMNS`: `COPY t (col1, col2)`','Load a subset of columns; omitted ones get defaults']]},
{h:'Parallelism for a single big file'},
{p:'When you load a large **uncompressed delimited or CSV** file, COPY splits it into ranges and loads them in parallel. This does not apply when the command uses `ESCAPE`, `REMOVEQUOTES` or `FIXEDWIDTH`. Compressed files must be split by you.'},
{h:'Validate before you load'},
{code:`COPY sales FROM 's3://my-bucket/sales/2026/10/' IAM_ROLE default CSV GZIP NOLOAD;`},
{note:'Always load into a staging table first, check it, and then move it to the real table. It turns a failed or surprising load into a non-event.'}],
src:[['COPY',DG+'r_COPY.html'],['Data format parameters',DG+'copy-parameters-data-format.html'],['Using COPY from Amazon S3',DG+'t_loading-tables-from-s3.html']]};

/* ================= LECTURE 2 ================= */
L['rs:6:2']={blocks:[
{p:'COPY is fastest when every slice has about the same amount of work. How you prepare the files decides that.'},
{h:'Split to match the slices'},
{ul:['Make the **number of files a multiple of the number of slices** in the warehouse, so work divides evenly. For example, two dc2.large nodes have four slices in total, so use 4, 8, 12 ... files.','COPY **does not consider file size** when it divides the work, so make files **about equal in size**. Aim for **1 MB to 1 GB after compression**. Advisor suggests objects of **1 to 128 MB** after compression for typical loads.','Too few files leave most slices idle. One huge compressed file loads on a single slice.']},
{code:`-- How many slices do I have? (provisioned)
SELECT COUNT(*) AS slices FROM stv_slices;

# Split a big file into 8 pieces by lines, then compress each
split -n l/8 --numeric-suffixes=1 sales.csv sales_part_
gzip sales_part_*

# Upload everything under a common prefix
aws s3 cp . s3://my-bucket/sales/2026/10/ --recursive --exclude "*" --include "sales_part_*.gz"`},
{h:'Compress the files'},
{ul:['Compressed files upload faster and COPY decompresses them as it reads them. Supported compression: **gzip, bzip2, lzop and zstd**.','Compress each file separately; do not tar several files into one.','Columnar formats (Parquet, ORC) are already compressed, and are the better choice when you control the producer.']},
{h:'Choosing which files load'},
{p:'There are two ways to tell COPY what to read.'},
{t:[['Method','How','Watch out for'],
['**Prefix**','`FROM \'s3://bucket/sales/2026/10/\'` loads every object whose key starts with the prefix','A prefix such as `sales` also matches `sales_old.csv` or `sales_backup/`. Use a folder with a trailing slash and keep it clean'],
['**Manifest**','A JSON file that lists the exact objects to load; add the `MANIFEST` keyword','You must create and maintain the list. Files can be in different buckets and folders']]},
{code:`{
  "entries": [
    { "url": "s3://my-bucket/sales/2026/10/part_01.csv.gz", "mandatory": true },
    { "url": "s3://my-bucket/sales/2026/10/part_02.csv.gz", "mandatory": true }
  ]
}

COPY sales FROM 's3://my-bucket/manifests/sales_2026_10.json'
IAM_ROLE default CSV GZIP MANIFEST;`},
{ul:['`"mandatory": true` makes COPY fail if that file is missing. Without it, a missing file is skipped silently.','A manifest gives you an **audit trail**: keep it, and you know exactly what was loaded.','A manifest is the safest approach when files arrive over time and you must not load a half-written file.']},
{h:'A prepared-files checklist'},
{ul:['Files share one prefix with nothing else in it.','Same delimiter, quoting and column order in every file.','UTF-8 text; no five-byte characters.','Compressed, and a multiple of the slice count.','Similar size, roughly 1 MB to 1 GB each after compression.','Sorted by the table sort key if you can arrange it.']},
{note:'The slice count changes if you resize the warehouse. If you build a loader that splits files to match slices, read the slice count at run time, or choose a generous multiple such as 32.'}],
src:[['Loading data from compressed and uncompressed files',DG+'t_splitting-data-files.html'],['Using a manifest to specify data files',DG+'loading-data-files-using-manifest.html'],['Advisor: split and compress COPY files',DG+'advisor-recommendations.html']]};

/* ================= LECTURE 3 ================= */
L['rs:6:3']={blocks:[
{p:'Loads fail. The skill is to find out why quickly. Redshift records the details of every rejected row, so you rarely need to guess.'},
{h:'Where the errors are recorded'},
{t:[['View','Where it works','What it shows'],
['`SYS_LOAD_ERROR_DETAIL`','Provisioned and Serverless','One row per load error: file, line, column, type, error code and message'],
['`SYS_LOAD_HISTORY`','Provisioned and Serverless','Each COPY: status, rows loaded, files, duration'],
['`STL_LOAD_ERRORS`','Provisioned only','The older view, includes `raw_line` and `raw_field_value`'],
['`STL_LOAD_COMMITS`','Provisioned only','Which files each COPY committed']]},
{code:`-- Most recent load errors
SELECT query_id, TRIM(file_name) AS file_name, line_number,
       TRIM(column_name) AS column_name, TRIM(column_type) AS column_type,
       error_code, TRIM(error_message) AS error_message
FROM   sys_load_error_detail
ORDER  BY start_time DESC
LIMIT  20;
-- e.g. file ...wrong_format_000, column id, int4, "Invalid digit, Value 'a', Pos 0, Type: Integer"

-- How did recent loads go?
SELECT * FROM sys_load_history ORDER BY start_time DESC LIMIT 10;`},
{h:'Tolerating some errors: MAXERROR'},
{p:'By default one bad row fails the whole COPY (`MAXERROR 0`). `MAXERROR n` lets COPY skip up to n bad rows and record each in the error view. If the count reaches n, COPY fails.'},
{code:`COPY sales FROM 's3://my-bucket/sales/2026/10/' IAM_ROLE default CSV GZIP MAXERROR 100;`},
{note:'MAXERROR can hide data problems. Use it only when you also check the error views after every load and alert if rows were skipped.'},
{h:'Common errors and fixes'},
{t:[['Symptom','Likely cause','Fix'],
['`Invalid digit, Value \'a\'`','Wrong data type or shifted columns','Check the delimiter and column order; fix the data or the column type'],
['`Delimiter not found` or wrong column count','Delimiter differs from the file, or quoted fields without `CSV`','Set the right `DELIMITER` or use `CSV`'],
['`String length exceeds DDL length`','Value longer than the VARCHAR','Widen the column, or use `TRUNCATECOLUMNS` knowingly'],
['`Invalid UTF8 character`','Not UTF-8 text','Re-encode the file, or `ACCEPTINVCHARS`'],
['`Invalid timestamp format`','Date format differs','`DATEFORMAT \'auto\'`, `TIMEFORMAT \'auto\'`, or an explicit format'],
['`Load into table failed. No files found`','Prefix matches nothing, wrong Region, or no permission','Check the path, the `REGION` option and the IAM role'],
['Access denied','IAM role lacks `s3:GetObject` or `s3:ListBucket`, or the bucket policy blocks it','Fix the role and the bucket policy'],
['Header row in the data','Header was loaded as a row','Add `IGNOREHEADER 1`'],
['Empty fields rejected for a number','Empty string for an INT column','`EMPTYASNULL`, or `NULL AS`']]},
{h:'A reliable approach'},
{flow:['COPY with NOLOAD to validate','Load into a staging table','Check SYS_LOAD_ERROR_DETAIL and row counts','Fix the data or the options','Merge into the target table']},
{ul:['Record the `query_id` of each COPY in your pipeline log so you can look it up later.','Compare **source row count** with **loaded row count** every time.','Quarantine bad files in S3 instead of deleting them.']}],
src:[['SYS_LOAD_ERROR_DETAIL',DG+'SYS_LOAD_ERROR_DETAIL.html'],['SYS_LOAD_HISTORY',DG+'SYS_LOAD_HISTORY.html'],['STL_LOAD_ERRORS',DG+'r_STL_LOAD_ERRORS.html']]};

/* ================= LECTURE 4 ================= */
L['rs:6:4']={blocks:[
{p:'Because Redshift does not enforce unique keys, you must protect integrity yourself when new data overlaps old data. The pattern is always **load into a staging table, then merge**. Redshift now offers a `MERGE` statement for it.'},
{h:'MERGE'},
{code:`MERGE INTO target
USING source ON target.id = source.id
WHEN MATCHED THEN UPDATE SET name = source.name
WHEN NOT MATCHED THEN INSERT VALUES (source.id, source.name);

-- Delete matched rows instead of updating them
MERGE INTO target USING source ON target.id = source.id
WHEN MATCHED THEN DELETE
WHEN NOT MATCHED THEN INSERT VALUES (source.id, source.name);`},
{ul:['Matched rows are **updated or deleted**; unmatched source rows are **inserted**.','**A target row cannot match more than one source row.** If the source has duplicate keys, MERGE fails with `Found multiple matches to update the same tuple`. Deduplicate the source first, for example with `GROUP BY` in a subquery.','Source and target cannot be the same table, the target cannot be a system, catalog or external table, and `WITH` is not allowed in a MERGE.','The source can be a table, a view, a subquery or a Spectrum table.','If the source is large, make the join columns the **distribution keys** of both tables.']},
{h:'Simplified mode: REMOVE DUPLICATES'},
{code:`MERGE INTO target USING source ON target.id = source.id REMOVE DUPLICATES;`},
{p:'When target and source have the **same columns in the same order**, `REMOVE DUPLICATES` updates matches to the source values, inserts unmatched source rows and removes extra duplicate rows in the target that match the same source row. It performs better than the full `WHEN` form and is recommended when you do not need to keep duplicates in the target.'},
{h:'The staging pattern'},
{code:`BEGIN;

CREATE TEMP TABLE stage (LIKE curated.dim_customer);

COPY stage FROM 's3://my-bucket/customers/2026-10-09/'
IAM_ROLE default CSV GZIP IGNOREHEADER 1;

-- Source must have one row per key
MERGE INTO curated.dim_customer
USING (SELECT customer_id, MAX(name) AS name, MAX(email) AS email
       FROM stage GROUP BY customer_id) AS s
ON curated.dim_customer.customer_id = s.customer_id
WHEN MATCHED THEN UPDATE SET name = s.name, email = s.email
WHEN NOT MATCHED THEN INSERT VALUES (s.customer_id, s.name, s.email);

COMMIT;
ANALYZE curated.dim_customer;`},
{h:'Delete then insert (the classic way)'},
{p:'Before MERGE, the standard upsert deleted the overlapping rows and inserted all staged rows inside one transaction. It still works well and is simple to reason about.'},
{code:`BEGIN;
DELETE FROM curated.fact_sales
USING stage s WHERE curated.fact_sales.sale_id = s.sale_id;
INSERT INTO curated.fact_sales SELECT * FROM stage;
COMMIT;`},
{h:'Choosing a pattern'},
{t:[['Situation','Use'],
['Append-only facts that never change','Plain `COPY` or `INSERT ... SELECT`'],
['Dimensions with updates and new rows','`MERGE`'],
['Replace a whole day or partition','Delete that slice then insert (or drop and reload a time-series table)'],
['Source and target have identical shape and you only need latest row per key','`MERGE ... REMOVE DUPLICATES`']]},
{ul:['Create the staging table with the **same distribution key** as the target so the merge needs no data movement.','Use a **temporary** table for short-lived staging; use a permanent table when you need to inspect it after a failure.','After a big merge, `ANALYZE` the target and let automatic or manual `VACUUM` reclaim space (Section 8). Updates and deletes leave behind deleted rows until vacuumed.','Avoid many small `UPDATE` statements: one MERGE over a batch is much cheaper.']},
{note:'Primary keys are informational. Dedup in staging and verify with a duplicate-key query after the load, or the planner may later return wrong answers (Section 5).'}],
src:[['MERGE',DG+'r_MERGE.html'],['Updating and inserting new data',DG+'t_updating-inserting-using-staging-tables-.html'],['Table constraints',DG+'t_Defining_constraints.html']]};

/* ================= LECTURE 5 ================= */
L['rs:6:5']={blocks:[
{p:'`UNLOAD` writes the result of a query to files in Amazon S3. Use it to export data, archive old data, share it with other tools and feed a data lake.'},
{h:'The basics'},
{code:`UNLOAD ('SELECT * FROM curated.fact_sales WHERE sale_date >= ''2026-01-01'' ORDER BY sale_date')
TO 's3://my-bucket/exports/fact_sales_2026_'
IAM_ROLE default
FORMAT CSV HEADER GZIP
ALLOWOVERWRITE;`},
{ul:['The query goes inside single quotes; double the quotes around literals as in the example.','By default UNLOAD writes **one or more files per slice**, in parallel, named `<prefix><slice>_part_<n>`. Parallel output is fastest and what you want if the files will be reloaded with COPY.','The default format is pipe-delimited text. Choose `CSV`, `JSON` or `PARQUET`.','Files are encrypted with S3 server-side encryption by default (SSE-S3). Use `ENCRYPTED` with `KMS_KEY_ID` for SSE-KMS.','You cannot use `LIMIT` in the outer query. Use a nested query with `LIMIT`, or create a table first.']},
{h:'Parquet'},
{code:`UNLOAD ('SELECT sale_date, product_key, SUM(amount) AS revenue
         FROM curated.fact_sales GROUP BY 1, 2')
TO 's3://my-bucket/lake/daily_revenue/'
IAM_ROLE default
FORMAT PARQUET
PARTITION BY (sale_date)
MAXFILESIZE 256 MB;`},
{ul:['Parquet unloads are up to **2x faster** and use up to **6x less S3 storage** than text.','Each row group is compressed with **SNAPPY**; do not add `GZIP`, `BZIP2` or `ZSTD`, `DELIMITER`, `HEADER` or `NULL AS` with Parquet.','Redshift aims for equal 32 MB row groups, and rounds `MAXFILESIZE` down to a multiple of 32 MB.','Do not start a file prefix with `_` or `.`, because Spectrum treats those files as hidden.']},
{h:'Partitioned output'},
{ul:['`PARTITION BY (col, ...)` writes Hive-style folders such as `sale_date=2026-10-09/`. Partition columns must appear in the query, and at least one **non-partition** column must remain in the file.','Null partition values go to `col=__HIVE_DEFAULT_PARTITION__`.','UNLOAD does **not** register the partitions anywhere. Add them to an external table with `ALTER TABLE ... ADD PARTITION`, or create a new external table or crawler (Section 14).']},
{h:'Useful options'},
{t:[['Option','Purpose'],
['`PARALLEL OFF`','Write files serially, in `ORDER BY` order; a file is at most 6.2 GB'],
['`MAXFILESIZE n MB|GB`','Maximum file size, 5 MB to 6.2 GB (default 6.2 GB)'],
['`MANIFEST [VERBOSE]`','Write a manifest listing every file (and row counts with `VERBOSE`)'],
['`HEADER`','Add a header line (text, CSV)'],
['`ESCAPE`','Escape delimiters and newlines in text; **use it on both UNLOAD and COPY** if the data can contain them'],
['`ALLOWOVERWRITE`','Overwrite existing files (default: fail if files would be overwritten)'],
['`CLEANPATH`','Delete existing files under the path first; needs `s3:DeleteObject`; cannot be combined with `ALLOWOVERWRITE`; deleted files are permanently gone'],
['`REGION`','Needed when the bucket is in another Region'],
['`EXTENSION`','Add your own file extension']]},
{note:'UNLOAD followed by COPY can lose floating-point precision. For exact round trips use DECIMAL, or Parquet with the right types. Always include ORDER BY on the sort key when you plan to reload, to save the sort on the way back in.'}],
src:[['UNLOAD',DG+'r_UNLOAD.html'],['Unloading data',DG+'c_unloading_data.html'],['UNLOAD examples',DG+'r_UNLOAD_command_examples.html']]};

/* ================= LECTURE 6 ================= */
L['rs:6:6']={blocks:[
{p:'**Auto-copy** removes the need for your own scheduler to load files. Redshift watches a prefix in S3, and when new files arrive it runs a `COPY` for you and keeps track of which files it has already loaded.'},
{svg:autocopy},
{h:'How it fits together'},
{ul:['An **S3 event integration** connects a source bucket to a Redshift warehouse (provisioned cluster or Serverless namespace).','A **COPY JOB** is a COPY command saved with `JOB CREATE` and `AUTO ON`. You define it once and the same parameters are used every time.','Redshift decides how many files to batch together per COPY. You see the resulting COPY commands in the system views.']},
{h:'Set it up'},
{p:'Prerequisites: the bucket and warehouse are in the **same Region**; the bucket has a policy that lets the Redshift service manage notifications; an IAM role on the warehouse can `s3:GetObject` and `s3:ListBucket`; the warehouse has a resource policy that authorizes the integration (the console can fix this for you with **Fix it for me**).'},
{code:`# 1. Create the S3 event integration
aws redshift create-integration \\
  --integration-name s3-integration \\
  --source-arn arn:aws:s3:::my-bucket \\
  --target-arn arn:aws:redshift:us-east-1:123456789012:namespace:<namespace-uuid>

-- 2. Create the auto-copy job (in query editor v2 or any SQL client)
COPY public.target_table
FROM 's3://my-bucket/staging-folder'
IAM_ROLE 'arn:aws:iam::123456789012:role/MyLoadRoleName'
FORMAT AS CSV GZIP
JOB CREATE my_copy_job_name
AUTO ON;`},
{h:'Manage and monitor'},
{t:[['Task','How'],
['List, show, drop, alter, run a job','`COPY JOB LIST`, `COPY JOB SHOW`, `COPY JOB DROP`, `COPY JOB ALTER`, `COPY JOB RUN`'],
['Which jobs exist','`SYS_COPY_JOB`'],
['Pending, errored and ingested files per job','`SYS_COPY_JOB_DETAIL`'],
['Messages logged about a job','`SYS_COPY_JOB_INFO`'],
['COPY results and errors','`SYS_LOAD_HISTORY`, `SYS_LOAD_ERROR_DETAIL`'],
['S3 event integrations','`SVV_COPY_JOB_INTEGRATIONS`']]},
{code:`SELECT * FROM sys_copy_job;
SELECT * FROM sys_copy_job_detail ORDER BY 1 DESC LIMIT 20;`},
{h:'Limits and rules'},
{ul:['Up to **200 COPY JOBs** per cluster or workgroup in an account, and **50 S3 event integrations** per Redshift target.','**One integration** per source bucket and target pair.','The bucket name **cannot contain a period**.','The bucket **cannot already have event notifications for object-created events** on the whole bucket. After the integration exists you can narrow a notification to a prefix or suffix to share the bucket with other targets.','If you delete an integration, its COPY JOB becomes inactive but is **not dropped**, which can cause a name conflict if you recreate it.','Restoring a Serverless namespace from a snapshot to the same namespace keeps integrations and jobs; restoring to a different namespace or a provisioned cluster does not.','Auto-copy is available in most, but not all, Regions: check the Regions table.']},
{note:'Auto-copy is for steady file arrival into a landing prefix. Load into a staging table with it, then merge on a schedule, because auto-copy appends and does not deduplicate.'}],
src:[['Create an S3 event integration for auto-copy',DG+'loading-data-copy-job.html'],['COPY JOB',DG+'r_COPY-JOB.html'],['SYS_COPY_JOB',DG+'SYS_COPY_JOB.html']]};

/* ================= LECTURE 7 ================= */
L['rs:6:7']={blocks:[
{p:'A hands-on lab that walks the whole loading cycle: stage files, COPY, trigger and fix an error, upsert and unload. Use a small warehouse with the IAM role from Section 3 and an S3 bucket you own (replace `my-lab-bucket`). Delete everything at the end.'},
{h:'Step 1: create sample data and split it'},
{code:`# Generate 100,000 order rows: order_id, customer_id, order_date, amount
awk 'BEGIN{srand(1); for(i=1;i<=100000;i++) printf "%d,%d,2026-10-%02d,%.2f\\n", i, int(rand()*5000)+1, int(rand()*28)+1, rand()*500}' > orders.csv

split -n l/4 --numeric-suffixes=1 orders.csv orders_part_
gzip orders_part_*
aws s3 cp . s3://my-lab-bucket/lab/orders/ --recursive --exclude "*" --include "orders_part_*.gz"`},
{h:'Step 2: create the tables and load'},
{code:`CREATE TABLE lab_orders_stage (order_id BIGINT, customer_id INTEGER, order_date DATE, amount DECIMAL(10,2));
CREATE TABLE lab_orders       (LIKE lab_orders_stage);

COPY lab_orders_stage FROM 's3://my-lab-bucket/lab/orders/'
IAM_ROLE default CSV GZIP;

SELECT COUNT(*) FROM lab_orders_stage;      -- expect 100000
SELECT * FROM sys_load_history ORDER BY start_time DESC LIMIT 1;`},
{h:'Step 3: cause and diagnose an error'},
{code:`# Add a file with a bad row, then reload
printf "100001,abc,2026-10-01,9.99\\n" > bad.csv && gzip bad.csv
aws s3 cp bad.csv.gz s3://my-lab-bucket/lab/orders/

COPY lab_orders_stage FROM 's3://my-lab-bucket/lab/orders/' IAM_ROLE default CSV GZIP;
-- ERROR: Load into table failed

SELECT TRIM(file_name) AS file, line_number, TRIM(column_name) AS col, TRIM(error_message) AS msg
FROM sys_load_error_detail ORDER BY start_time DESC LIMIT 5;
-- column customer_id, int4, Invalid digit, Value 'a'`},
{p:'Fix it by removing the bad file, or load past it with `MAXERROR 1` and then inspect the error view. Try both.'},
{h:'Step 4: upsert'},
{code:`TRUNCATE lab_orders_stage;
COPY lab_orders_stage FROM 's3://my-lab-bucket/lab/orders/orders_part_' IAM_ROLE default CSV GZIP;

MERGE INTO lab_orders USING lab_orders_stage s ON lab_orders.order_id = s.order_id
WHEN MATCHED THEN UPDATE SET amount = s.amount
WHEN NOT MATCHED THEN INSERT VALUES (s.order_id, s.customer_id, s.order_date, s.amount);

-- Run the same MERGE again: nothing is duplicated
SELECT COUNT(*), COUNT(DISTINCT order_id) FROM lab_orders;`},
{h:'Step 5: unload'},
{code:`UNLOAD ('SELECT order_date, customer_id, SUM(amount) AS total FROM lab_orders GROUP BY 1, 2')
TO 's3://my-lab-bucket/lab/export/daily_'
IAM_ROLE default FORMAT PARQUET MAXFILESIZE 64 MB ALLOWOVERWRITE;`},
{code:`aws s3 ls s3://my-lab-bucket/lab/export/ --human-readable`},
{h:'Check your understanding'},
{ul:['How many files did UNLOAD write and why?','What happens to the row count if you run the MERGE twice? Why is that safe?','Which view told you which line and column failed?']},
{h:'Clean up'},
{code:`DROP TABLE lab_orders; DROP TABLE lab_orders_stage;
aws s3 rm s3://my-lab-bucket/lab/ --recursive`}],
src:[['COPY examples',DG+'r_COPY_command_examples.html'],['MERGE',DG+'r_MERGE.html'],['UNLOAD',DG+'r_UNLOAD.html']]};

/* ================= ADDITIONAL 8 ================= */
L['rs:6:8']={blocks:[
{p:'**Streaming ingestion** reads records directly from **Amazon Kinesis Data Streams** or **Amazon MSK** (Apache Kafka) into a Redshift **materialized view**, with no S3 landing step. It suits data that is generated continuously and must be queryable within seconds or minutes, such as clickstreams and telemetry.'},
{svg:streamz},
{h:'How it works'},
{flow:['Create an external schema for the streaming source','Create a streaming materialized view over a stream or topic','Redshift refreshes the view, reading new shards or partitions','Query the view, or transform it into tables']},
{ul:['Data flows straight from the stream to the warehouse; the warehouse is the **consumer**.','After setup each refresh can ingest hundreds of megabytes per second.','Works on provisioned clusters and Serverless; on Serverless size RPUs for auto refresh plus other work.','Refresh is **manual by default**. Add `AUTO REFRESH YES` to keep it up to date.']},
{code:`-- Kinesis Data Streams
CREATE EXTERNAL SCHEMA kds FROM KINESIS IAM_ROLE default;

CREATE MATERIALIZED VIEW orders_stream
AUTO REFRESH YES
AS
SELECT approximate_arrival_timestamp,
       partition_key, shard_id, sequence_number,
       JSON_PARSE(kinesis_data) AS payload
FROM   kds."orders-stream"
WHERE  CAN_JSON_PARSE(kinesis_data);

-- Query it with PartiQL, like any SUPER column
SELECT payload.customer_id::INT AS customer_id, payload.amount::DECIMAL(10,2) AS amount
FROM   orders_stream LIMIT 10;`},
{p:'For MSK or another Kafka cluster, create the external schema with `FROM MSK` or `FROM KAFKA`, a broker URI or cluster ARN, and an authentication type (`none`, `iam` or `mtls`).'},
{h:'Best practices and limits'},
{ul:['**Use `JSON_PARSE` into a SUPER column** and extract with PartiQL later. Extracting many columns with `JSON_EXTRACT_PATH_TEXT` re-parses each record once per column and raises latency.','**One materialized view per stream or topic.** Each view creates a consumer for every shard or partition, so several views can throttle the stream and ingest the same data repeatedly.','**Incremental only:** a streaming view must be incrementally maintainable. Joins are not supported directly in it; create a second view on top for joins.','The first refresh starts from `TRIM_HORIZON` for Kinesis or offset 0 for MSK, so it reads whatever the stream still retains.','The largest record is **16 MiB** (Kinesis itself allows 10 MiB). Larger records are skipped and a piece is written to `SYS_STREAM_SCAN_ERRORS`; errors from your own logic are **not** skipped.','Records aggregated by the Kinesis Producer Library are ingested but stored as binary protocol buffers, so turn aggregation off or decode them.','Compressed payloads cannot be decompressed inside Redshift. Decompress before sending.','If stream data has **upper-case identifiers**, set `enable_case_sensitive_identifier` to true at database or cluster level, or auto refresh can fail.','Exactly-once processing is guaranteed for Kinesis and Kafka sources.']},
{h:'Operating it'},
{code:`SELECT * FROM sys_mv_refresh_history ORDER BY start_time DESC LIMIT 10;   -- refresh activity
SELECT * FROM sys_stream_scan_errors ORDER BY 1 DESC LIMIT 10;            -- skipped records
SELECT * FROM sys_stream_scan_states;                                      -- where each consumer is`},
{note:'Treat the streaming view as a raw landing zone. Keep it small (set a retention rule), and copy useful data into properly designed tables on a schedule.'}],
src:[['Streaming ingestion to a materialized view',DG+'materialized-view-streaming-ingestion.html'],['SYS_STREAM_SCAN_ERRORS',DG+'r_SYS_STREAM_SCAN_ERRORS.html']]};

/* ================= ADDITIONAL 9 ================= */
L['rs:6:9']={blocks:[
{p:'A **zero-ETL integration** continuously replicates data from an operational source into Redshift, with no pipeline for you to build or run. You create the integration, and AWS handles the initial load and ongoing replication.'},
{h:'Supported sources'},
{ul:['Amazon Aurora MySQL and Aurora PostgreSQL','Amazon RDS for MySQL, RDS for PostgreSQL and RDS for Oracle','Amazon DynamoDB','Oracle Database@AWS','Applications such as Salesforce, SAP, ServiceNow, Zendesk and Meta ads (through AWS Glue)','Self-managed MySQL, PostgreSQL, SQL Server and Oracle']},
{h:'The pieces'},
{t:[['Term','Meaning'],
['Source database','Where data is replicated from'],
['Target data warehouse','The Redshift provisioned cluster or Serverless workgroup that receives the data'],
['Destination database','The database you create inside the target from the integration']]},
{p:'You specify the source and the Redshift target. After an initial load the integration replicates changes. Integrations from several sources of the same type can feed one warehouse so you can analyze them together.'},
{h:'Using it'},
{code:`-- After the integration is active, create a database from it in the target warehouse
CREATE DATABASE orders_replica FROM INTEGRATION '<integration-id>' DATABASE 'orders';

SELECT COUNT(*) FROM orders_replica.public.orders;`},
{ul:['Query the replicated data like any other, and build **materialized views** over it, share it with data sharing, or join it with warehouse tables.','Zero-ETL databases use **case-sensitive identifiers** by default (`enable_case_sensitive_identifier` is true), which matters for tools and quoting.','**History mode** lets you keep a history of changes (see the documentation).','You can run analytics without affecting the source database performance.']},
{h:'What the DBA monitors'},
{t:[['What','Where'],
['Integration state and errors','Console, `SVV_INTEGRATION` and `SYS_INTEGRATION_ACTIVITY`'],
['Per table replication state','`SYS_INTEGRATION_TABLE_STATE_CHANGE`'],
['Failures and lag','CloudWatch metrics for the integration, and Redshift event notifications through SNS and EventBridge'],
['Capacity','Serverless RPU use or cluster load: replication work shares the warehouse with your queries']]},
{ul:['Check each source documentation for **limitations** (supported table types, key requirements, data type restrictions, quotas, Regions).','Costs are on **both sides**: Redshift compute and storage, plus the source service (Aurora, RDS, DynamoDB) and Glue for application sources.','Plan permissions on the destination database as you would for any data.']},
{note:'Zero-ETL gives you raw replicated tables. You still own modelling: build curated tables or views on top, and decide how current each downstream table has to be.'}],
src:[['Zero-ETL integrations',MG+'zero-etl-using.html'],['Monitoring zero-ETL integrations',MG+'zero-etl-monitoring.html'],['Creating destination databases',MG+'zero-etl-using.creating-db.html']]};

/* ================= ADDITIONAL 10 ================= */
L['rs:6:10']={blocks:[
{p:'Most loads come from S3, but COPY can also read from Amazon DynamoDB, Amazon EMR and remote hosts over SSH. These are specialised paths; know their limits before you choose one.'},
{h:'Amazon DynamoDB'},
{code:`COPY favoritemovies FROM 'dynamodb://my-favorite-movies-table'
IAM_ROLE default
READRATIO 50;`},
{ul:['Loads from **one** DynamoDB table, in parallel across the compute nodes. The table must be in the **same Region** unless you use `REGION`.','The read **consumes the table provisioned read throughput**. `READRATIO` is the percentage of throughput COPY may use: set it well below the unused capacity of a production table, or to 100 to use it all.','Attribute names match column names **case-insensitively**. Attributes that differ only in case make COPY fail. Unmatched table columns load as NULL or empty; unmatched attributes are discarded, but are still read and still cost throughput.','Only **STRING and NUMBER** scalar attributes are supported. BINARY and SET types fail the load if they map to a column.','The role needs `dynamodb:Scan` and `dynamodb:DescribeTable`.','Automatic compression samples rows and then reads them again, so it **doubles reads** on a small sample. Use `COMPUPDATE OFF` on production tables.','For ongoing analytics, the **zero-ETL integration for DynamoDB** is usually a better answer than repeated COPY.']},
{h:'Amazon EMR'},
{p:'COPY can read files from the HDFS file system of an EMR cluster. In practice most teams write EMR results to **S3** and COPY from there, which is simpler, decouples the two services and survives the EMR cluster being terminated. Use the EMR path only if you have a reason to read HDFS directly.'},
{h:'Remote hosts (SSH)'},
{p:'COPY connects to hosts over SSH, runs commands you list in a manifest and loads the standard output of those commands.'},
{ul:['Setup: get the **cluster public key** and node IP addresses (`describe-clusters`), add the key to each host `authorized_keys`, allow the node addresses through the host security group on port 22, and write a **manifest** (endpoint, command, optional username and host public key, `mandatory`).','Use the host public key in the manifest to avoid man-in-the-middle attacks. Only RSA keys are supported.','Use **private** node addresses when the host is in the same VPC and Region; otherwise public ones.','With automatic compression COPY runs the remote command **twice**. If that has side effects, add `COMPUPDATE OFF`.','Node IP addresses do not exist on Serverless, so this method is for provisioned clusters.']},
{code:`COPY sales FROM 's3://my-bucket/ssh_manifest'
IAM_ROLE default DELIMITER '|' SSH;`},
{h:'Choosing a source'},
{t:[['Need','Best path'],
['Files you control','S3 + COPY'],
['A live DynamoDB table','Zero-ETL for DynamoDB; COPY with a low READRATIO for one-off loads'],
['Spark or Hadoop output','Write to S3'],
['Output of a program on a server','Write to S3 (preferred) or SSH if the data cannot leave the host']]},
{note:'When unsure, stage in S3. It is the one source that works the same everywhere, scales with slices and gives you a copy you can replay.'}],
src:[['Loading data from DynamoDB',DG+'t_Loading-data-from-dynamodb.html'],['Loading data from remote hosts',DG+'loading-data-from-remote-hosts.html'],['COPY',DG+'r_COPY.html']]};

/* ================= ADDITIONAL 11 ================= */
L['rs:6:11']={blocks:[
{p:'Ingestion often arrives in bursts: a nightly ETL, an auto-copy backlog, a zero-ETL catch-up. **Concurrency scaling** can add temporary capacity to run write statements during those bursts so reports do not slow down. This lecture is about the provisioned model; Serverless handles this by scaling RPUs.'},
{h:'What it can run'},
{ul:['Concurrency scaling covers **read queries** and the common write statements: `COPY`, `INSERT`, `DELETE`, `UPDATE`, `CREATE TABLE AS`, and `VACUUM`. It also covers manual refresh of materialized views and automatic vacuum.','Other DML and most DDL (such as plain `CREATE TABLE`) are **not** supported. If an unsupported write appears earlier in the same explicit transaction, none of the writes in that transaction use concurrency scaling.','Write support requires **RG or RA3** nodes. Reads also work on DC2.','Users always see the most current data, whichever cluster ran the statement.']},
{h:'Requirements and exclusions'},
{ul:['EC2-VPC platform and a supported node type; **not a single-node cluster**.','The main cluster must have **at most 32 compute nodes** for RG and RA3 types, and must also have been created with at most 32 nodes.','No support for tables with **interleaved sort keys**, **temporary tables**, no-backup tables, or queries that read system or catalog tables.','No support for **Python or Lambda UDFs**.','Writes are not supported to tables with `DISTSTYLE ALL` or with **identity columns**, and `ANALYZE` during COPY is not supported.','COPY or UNLOAD that reads external resources protected by restrictive policies (`aws:sourceVpc`, `aws:sourceVpce`, `aws:sourceIp`) will not run on a scaling cluster.']},
{h:'Turn it on'},
{p:'Concurrency scaling is enabled **per WLM queue**: set the queue **Concurrency Scaling mode** to `auto`. When the queue is full, eligible queries go to a scaling cluster instead of waiting. You can also route queries to such a queue with user groups, query groups or query monitoring rules, for example to send anything over five seconds there.'},
{code:`# How many scaling clusters may be added (default 1; account quota 10)
aws redshift modify-cluster-parameter-group --parameter-group-name prod-params \\
  --parameters ParameterName=max_concurrency_scaling_clusters,ParameterValue=3`},
{h:'Billing'},
{ul:['You pay only while scaling clusters actively run queries, per second.','Each main cluster earns **up to one hour of free credit per day**, accumulating up to 30 hours. Credits apply to both reads and writes.','Set `max_concurrency_scaling_clusters` to cap spend, and a usage limit if you need a hard stop.']},
{h:'Monitor'},
{code:`-- Which queries ran on a scaling cluster?
SELECT query_id, compute_type, queue_time/1000000.0 AS queue_s, execution_time/1000000.0 AS exec_s
FROM   sys_query_history
WHERE  compute_type = 'primary-scale'
ORDER  BY start_time DESC LIMIT 20;

SELECT * FROM svcs_concurrency_scaling_usage ORDER BY start_time DESC LIMIT 10;`},
{p:'In `SYS_QUERY_HISTORY.compute_type`, `primary` means the main cluster and `primary-scale` means a concurrency scaling cluster.'},
{note:'Design your ETL tables to be eligible: avoid ALL distribution and identity columns on tables you load heavily, and do not use interleaved keys. Otherwise bursts will queue on the main cluster.'}],
src:[['Concurrency scaling',DG+'concurrency-scaling.html'],['Concurrency scaling pricing','https://aws.amazon.com/redshift/pricing/'],['SYS_QUERY_HISTORY',DG+'SYS_QUERY_HISTORY.html']]};

/* ================= ADDITIONAL 12 ================= */
L['rs:6:12']={blocks:[
{p:'Moving an existing database into Redshift is a project with three parts: convert the **schema**, move the **data**, and keep it in sync until cutover. AWS has tools for each part.'},
{h:'The tools'},
{t:[['Tool','Use it for','Notes'],
['**AWS Schema Conversion Tool (SCT)**','Assess and convert schemas and code from a commercial or open-source database to Redshift','Produces converted DDL and an assessment of what needs manual work'],
['**AWS Database Migration Service (DMS)**','Move the data: full load, then ongoing change data capture (CDC)','Loads through S3 and COPY'],
['**AWS Glue**','Transform data in Spark jobs on its way in','Use when data needs heavy reshaping'],
['**Zero-ETL integrations**','Continuous replication from supported sources','Replaces DMS for sources it supports'],
['**Export files + COPY**','One-off bulk moves','Simplest and fastest for a one-time load']]},
{h:'How DMS loads Redshift'},
{ul:['DMS reads the source and writes **CSV files** to an S3 bucket, then issues a **COPY** into Redshift. Change data capture batches net changes the same way.','The Redshift warehouse must be in the **same account and Region** as the replication instance, and the instance needs network access to the endpoint. Use the Amazon provided endpoint name, not a custom DNS name.','Set `BatchApplyEnabled` to true so CDC changes are applied in batches. **A primary key on source and target** is needed for batch apply; without it changes are applied one statement at a time and CDC latency grows.','Redshift cannot store LOBs larger than VARCHAR limits (64 KB): LOBs are converted to VARCHAR.','Redshift does not enforce primary keys and DMS may replay CDC after a resume, so **duplicates can appear**. Plan a duplicate check.','Redshift closes idle sessions after four hours by default; give the DMS user a longer `SESSION TIMEOUT`.','For full load and CDC tuning, set parallel threads to a **multiple of the slice count**.','DMS statements share the **WLM queues** with your other work, so heavy ETL at the same time slows replication.','If enhanced VPC routing is on, give the VPC an **S3 endpoint**.']},
{h:'A migration plan'},
{flow:['Assess source and size the target','Convert schema, then design keys for Redshift','Full load into staging or target tables','Run CDC to stay in sync','Validate counts and results','Cut over applications','Retire the source']},
{ul:['**Re-design, do not just convert.** Distribution and sort keys, compression and ELT patterns matter more than a one-to-one copy of indexes and constraints.','**Replace row-by-row code** (cursors, loops) with set-based SQL.','**Validate**: row counts, checksums on key columns, and a set of business queries compared between source and target.','**Test performance** with realistic data volumes before you cut over.','**Plan cutover** with a short freeze: stop writes, let CDC drain, verify, switch connection strings.']},
{note:'If the source is a supported Aurora, RDS or DynamoDB database and you only need analytics, evaluate a zero-ETL integration before building a DMS pipeline.'}],
src:[['DMS: Redshift as a target','https://docs.aws.amazon.com/dms/latest/userguide/CHAP_Target.Redshift.html'],['AWS Schema Conversion Tool','https://docs.aws.amazon.com/SchemaConversionTool/latest/userguide/CHAP_Welcome.html'],['Zero-ETL integrations',MG+'zero-etl-using.html']]};

/* ================= ADDITIONAL 13 ================= */
L['rs:6:13']={blocks:[
{p:'Loads should run without anyone pressing a button. This lecture covers the main ways to schedule and orchestrate ELT on Redshift, from a single recurring query to a multi-step workflow.'},
{h:'Options'},
{t:[['Tool','Good for','Notes'],
['**Scheduled queries in query editor v2**','A single SQL statement or call on a schedule','Easiest; built on Amazon EventBridge'],
['**Amazon EventBridge + Data API**','Time-based or event-based triggers that run SQL without a server','A rule can target the Redshift Data API directly'],
['**AWS Step Functions**','Multi-step workflows with retries, branches and waits','Calls the Data API; use `ClientToken` for retries'],
['**Auto-copy and materialized view auto refresh**','Built-in continuous loading and refresh','No scheduler needed'],
['**Stored procedures**','Packaging a set of ELT steps behind one `CALL`','Triggered by any scheduler'],
['**Managed Airflow or another scheduler**','Teams already standardised on it','Use the Redshift provider or the Data API']]},
{h:'Scheduled query'},
{p:'In query editor v2 you can schedule a saved query to run at a time or interval. It automates recurring work such as refreshing summary tables or generating reports, and runs through EventBridge using an IAM role you provide.'},
{h:'EventBridge rule that calls Redshift'},
{code:`aws events put-rule --name nightly-sales-load --schedule-expression "cron(30 2 * * ? *)"

aws events put-targets --rule nightly-sales-load --targets '[{
  "Id": "1",
  "Arn": "arn:aws:redshift:us-east-1:123456789012:workgroup:<workgroup-id>",
  "RoleArn": "arn:aws:iam::123456789012:role/EventBridgeRedshiftRole",
  "RedshiftDataParameters": {
    "Database": "dev",
    "Sql": "CALL curated.load_daily_sales()",
    "StatementName": "nightly-sales-load",
    "WithEvent": true }
}]'`},
{ul:['`WithEvent` makes the Data API send an event to EventBridge when the statement finishes, so a **second rule can start the next step**.','The role needs permission to call the Data API and the database credentials (a Secrets Manager secret or a temporary-credential permission).']},
{h:'Step Functions workflow'},
{flow:['Start: new data arrived','ExecuteStatement: COPY into staging','Wait and check statement status','ExecuteStatement: MERGE into target','On error: alert and stop','Success: refresh materialized views']},
{ul:['Step Functions does not retry by default. Pass the Data API **`ClientToken`** (for example the execution Id) so a retry cannot run a statement twice.','Use the **Data API sessions** option when steps depend on a temporary table.','Fail loudly: send a notification and keep the failed statement Id, so you can read `SYS_LOAD_ERROR_DETAIL` and `SYS_QUERY_HISTORY`.']},
{h:'Habits for reliable pipelines'},
{ul:['**Make every step idempotent**: running it twice gives the same result (MERGE, delete-then-insert by key, truncate-and-reload).','**Keep a control table** with batch id, source files, row counts and status for each run.','**Validate** counts and duplicates after every load and fail the run if checks fail.','**Alert** on failures and on loads that did not run.','**Avoid overlapping runs**: a late run must not start while the previous one is still going.','**Mind the maintenance window** and large vacuums when you schedule.']},
{note:'Keep orchestration and logic apart: put the SQL in stored procedures or versioned scripts, and let the scheduler only call them. That makes the pipeline testable without the scheduler.'}],
src:[['Scheduled queries with query editor v2',MG+'query-editor-v2-schedule-query.html'],['Using the Amazon Redshift Data API',MG+'data-api.html'],['Amazon EventBridge targets: Redshift Data API','https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-targets.html']]};
})();
