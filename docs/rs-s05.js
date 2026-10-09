/* LearnSphere - Amazon Redshift, Section 05: Databases, Schemas & System Catalog.
   Lectures 0-8 are core, 9-12 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const hier=R.dg(700,300,[
[10,10,680,280,'Cluster (Provisioned) or namespace (Serverless)',1],
[30,45,300,235,'Database: sales_dw',1],[360,45,310,235,'Database: marketing_dw',1],
[45,75,130,95,'Schema|public',0],[190,75,130,95,'Schema|curated',2],
[45,185,130,80,'Table|fact_sales',0],[190,185,130,80,'View|v_revenue',0],
[375,75,130,95,'Schema|public',0],[520,75,140,95,'Schema|campaigns',0],
[375,185,130,80,'Table|clicks',0],[520,185,140,80,'Procedure|load_clicks',0]],
[]);

const layers=R.dg(700,230,[
[10,10,680,210,'Layered schemas in one database',1],
[30,45,150,70,'raw|landed as-is|loaders write here',0],
[215,45,150,70,'staging|cleaned, deduplicated|ETL only',0],
[400,45,150,70,'curated|star schemas|analysts read here',2],
[585,45,95,70,'marts|team views',0],
[30,135,650,70,'Ownership and access|loader role writes raw, ETL role writes staging, transform role writes curated|analysts get read-only access to curated',0]],
[[180,80,215,80],[365,80,400,80],[550,80,585,80]]);

/* ================= LECTURE 0 ================= */
L['rs:4:0']={blocks:[
{p:'Everything you store in Redshift sits in a hierarchy. Knowing it tells you where to create objects, how names are resolved and what limits apply.'},
{svg:hier},
{h:'The levels'},
{t:[['Level','What it is','Limit'],
['**Cluster** or **namespace**','The warehouse. A provisioned cluster, or the data side of Serverless','n/a'],
['**Database**','Top-level container of schemas. A session is connected to one database','60 per cluster (excluding databases created from datashares); 100 per Serverless namespace'],
['**Schema**','A folder of objects inside a database; the unit for access control and organisation','9,900 per database'],
['**Objects**','Tables, views, materialized views, stored procedures and user-defined functions','Tables: limit depends on node type, 200,000 per Serverless namespace']]},
{p:'A new warehouse has one database, normally `dev`, with a schema called `public`. Redshift also has system databases (`template0`, `template1`, `padb_harvest`, `sys:internal`); you cannot create tables or views in them.'},
{h:'How a name is resolved'},
{p:'A fully qualified name has three parts: `database.schema.object`. When you write only the object name, Redshift looks through the schemas in your **search path** in order and uses the first match.'},
{code:`SHOW search_path;                  -- default: $user, public
SELECT current_database(), current_schema();

-- Fully qualified (three-part) name
SELECT COUNT(*) FROM dev.public.sales;

-- Unqualified: found through search_path
SELECT COUNT(*) FROM sales;`},
{ul:['`$user` means a schema named after the logged-in user, if it exists.','A **temporary table** lives in a hidden, session-specific schema that is placed first in the search path, so it hides a permanent table with the same name unless you qualify the permanent one.','Identifiers are **not case sensitive** by default (`enable_case_sensitive_identifier` is false), so `Sales` and `sales` are the same object.']},
{h:'Why this matters'},
{ul:['**Schemas are your main design tool.** They group related objects, carry quotas and are where you grant access (Section 10).','**Databases are heavier.** You connect to one at a time, so most designs use one database with several schemas. Reading across databases is possible but needs three-part names (additional lecture).','**Limits are per warehouse.** Table counts include permanent, temporary and datashare tables and materialized views, and also temporary tables Redshift creates internally while running queries.']},
{note:'Always schema-qualify objects in scripts, jobs and views. Relying on search_path makes behavior depend on who runs the code.'}],
src:[['Names and identifiers',DG+'r_names.html'],['search_path',DG+'r_search_path.html'],['Quotas and limits',MG+'amazon-redshift-limits.html']]};

/* ================= LECTURE 1 ================= */
L['rs:4:1']={blocks:[
{p:'Creating and managing databases and schemas is everyday DBA work. This lecture covers the commands and the schema **quota**, a handy way to stop one team using all the space.'},
{h:'Databases'},
{code:`CREATE DATABASE sales_dw;
-- A session is connected to one database; to work in another, connect to it
-- (for example psql -d sales_dw). Reading other databases uses three-part names.

ALTER DATABASE sales_dw RENAME TO sales_wh;
ALTER DATABASE sales_wh OWNER TO etl_admin;
DROP DATABASE sales_wh;            -- permanent; cannot drop the one you are connected to

SELECT * FROM svv_redshift_databases;   -- all databases in the warehouse`},
{ul:['Creating a database needs the `CREATE DATABASE` privilege or superuser.','Remember the limit of 60 databases per cluster (100 in Serverless).','Case sensitivity can be set per database with the `COLLATE` option at creation time.']},
{h:'Schemas'},
{code:`CREATE SCHEMA IF NOT EXISTS curated AUTHORIZATION etl_admin QUOTA 500 GB;
CREATE SCHEMA staging QUOTA UNLIMITED;

ALTER SCHEMA staging RENAME TO stg;
ALTER SCHEMA stg OWNER TO etl_admin;
ALTER SCHEMA stg QUOTA 200 GB;

DROP SCHEMA stg CASCADE;           -- also drops every object inside it

SELECT nspname AS schema, usename AS owner
FROM pg_namespace n JOIN pg_user u ON n.nspowner = u.usesysid
WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema';`},
{h:'Schema quotas'},
{ul:['`QUOTA` caps the **disk space** a schema can use: permanent tables, materialized views and the extra copies of `ALL` distributed tables on every node. Temporary tables are not counted.','You must be a superuser to **set or change** a quota. A user with CREATE SCHEMA permission can create a schema with a quota.','The check happens at the **end of a transaction**. If a transaction pushes a schema over its quota, Redshift stops it, rolls back and blocks further ingestion until you free space.','`DELETE` frees space only after `VACUUM` runs. Transactions made only of DELETE, TRUNCATE, VACUUM, DROP TABLE (or ALTER TABLE APPEND moving data out) are allowed even when over quota.','A schema without a quota is unlimited. Check quotas with `SVV_SCHEMA_QUOTA_STATE` and violations with `STL_SCHEMA_QUOTA_VIOLATIONS`.']},
{h:'Changing the search path'},
{code:`SET search_path TO curated, staging, public;          -- this session only
ALTER USER analyst SET search_path TO curated, public; -- every new session of that user
SHOW search_path;`},
{note:'The schema name PUBLIC is reserved and cannot be created. Plan your own schemas instead of putting everything in public.'}],
src:[['CREATE SCHEMA',DG+'r_CREATE_SCHEMA.html'],['CREATE DATABASE',DG+'r_CREATE_DATABASE.html'],['SVV_SCHEMA_QUOTA_STATE',DG+'r_SVV_SCHEMA_QUOTA_STATE.html']]};

/* ================= LECTURE 2 ================= */
L['rs:4:2']={blocks:[
{p:'The data type you choose affects how much space a column uses, how fast it scans and whether results are correct. Pick the **smallest type that safely holds the data**.'},
{h:'The supported types'},
{t:[['Category','Types (aliases)','Notes'],
['Integer','`SMALLINT` (INT2), `INTEGER` (INT, INT4), `BIGINT` (INT8)','2, 4 and 8 bytes, signed'],
['Exact decimal','`DECIMAL` (NUMERIC)','Selectable precision and scale; use for money'],
['Floating point','`REAL` (FLOAT4), `DOUBLE PRECISION` (FLOAT8, FLOAT)','Approximate; never for money'],
['Text','`CHAR` (CHARACTER, NCHAR, BPCHAR), `VARCHAR` (CHARACTER VARYING, NVARCHAR, TEXT)','`CHAR` is fixed length and single-byte only; `VARCHAR` supports UTF-8 up to 4 bytes per character'],
['Date and time','`DATE`, `TIME`, `TIMETZ`, `TIMESTAMP`, `TIMESTAMPTZ`, `INTERVAL`','Session time zone is UTC by default'],
['Logical','`BOOLEAN` (BOOL)','true or false'],
['Other','`SUPER`, `VARBYTE`, `GEOMETRY`, `GEOGRAPHY`, `HLLSKETCH`','`SUPER` holds semi-structured data (additional lecture)']]},
{h:'Choosing well'},
{ul:['**Integers**: use `INTEGER` unless values need `BIGINT`; use `SMALLINT` for small codes. Smaller columns mean less storage and less I/O.','**Money and exact values**: `DECIMAL(12,2)`, not `REAL` or `DOUBLE PRECISION`.','**Dates**: store dates as `DATE` and moments as `TIMESTAMP` or `TIMESTAMPTZ`, not as text. Text dates are larger and slower and invite bad data.','**Text**: size `VARCHAR` to what you need. `MAX` allows 65,535 bytes but oversized columns can use more memory when queries sort or hash them. For multibyte text, size in bytes: four three-byte characters need `VARCHAR(12)`.','**Flags**: `BOOLEAN`, not `CHAR(1)` or `INTEGER`.','**Join keys**: give both sides of a join the **same type**. Mismatched types can force conversions.']},
{h:'Conversions'},
{ul:['Types in the same category convert implicitly (for example inserting a decimal into an integer column rounds it).','Numbers overflow with an error rather than truncating the whole part.','Converting between `TIMESTAMP`, `TIMESTAMPTZ`, `DATE` and text uses the **session time zone**, UTC by default.','Be explicit with `CAST(x AS type)` or `x::type` when types differ, so behavior is clear.']},
{code:`-- Good: right-sized, typed columns
CREATE TABLE fact_orders (
  order_id    BIGINT,
  customer_id INTEGER,
  status_code SMALLINT,
  order_date  DATE,
  created_at  TIMESTAMP,
  amount      DECIMAL(12,2),
  is_gift     BOOLEAN,
  country     CHAR(2),
  note        VARCHAR(500)
);

-- Avoid: everything as wide text
-- order_id VARCHAR(256), order_date VARCHAR(256), amount VARCHAR(256)`},
{note:'PostgreSQL features such as arrays and the JSON type are not available as regular columns. For JSON use the SUPER type.'}],
src:[['Data types',DG+'c_Supported_data_types.html'],['Numeric types',DG+'r_Numeric_types201.html'],['Character types',DG+'r_Character_types.html'],['Datetime types',DG+'r_Datetime_types.html']]};

/* ================= LECTURE 3 ================= */
L['rs:4:3']={blocks:[
{p:'There are several ways to create a table. Pick the one that fits the job: a permanent table, a copy of another table, the result of a query, or a throwaway working table.'},
{h:'CREATE TABLE'},
{code:`CREATE TABLE IF NOT EXISTS curated.fact_sales (
  sale_id     BIGINT NOT NULL,
  date_key    INTEGER NOT NULL,
  product_key INTEGER NOT NULL,
  customer_id INTEGER,
  amount      DECIMAL(12,2) DEFAULT 0,
  loaded_at   TIMESTAMP DEFAULT GETDATE()
)
DISTSTYLE AUTO
SORTKEY AUTO;`},
{ul:['**DEFAULT** must be a variable-free expression; no subqueries or references to other columns.','**NOT NULL** is enforced. Primary key, unique and foreign key constraints are informational (next lecture).','**DISTSTYLE** and **SORTKEY** decide how data is spread and ordered. The default for both is **AUTO**, where Redshift chooses and adjusts them. You design them deliberately in Section 6.','**ENCODE AUTO** is the default: Redshift manages compression encoding for you.','Limits: 1,600 columns, table names up to 127 bytes.']},
{h:'CREATE TABLE AS (CTAS)'},
{p:'CTAS creates a table from a query and loads it in one step. It is the standard way to build derived tables, and you can set distribution and sort options.'},
{code:`CREATE TABLE curated.daily_sales
DISTSTYLE KEY DISTKEY (product_key)
SORTKEY (date_key)
AS
SELECT date_key, product_key, SUM(amount) AS revenue
FROM   curated.fact_sales
GROUP  BY date_key, product_key;`},
{h:'LIKE'},
{code:`-- Same columns, types, NOT NULL, distribution and sort keys; no data, no PK/FK
CREATE TABLE staging.fact_sales (LIKE curated.fact_sales);

-- Also copy default expressions
CREATE TABLE staging.fact_sales2 (LIKE curated.fact_sales INCLUDING DEFAULTS);`},
{p:'A table created with `LIKE` is decoupled from its parent: later changes to the parent do not carry over. Primary and foreign keys are not inherited.'},
{h:'Temporary tables'},
{code:`CREATE TEMP TABLE work_orders AS
SELECT * FROM curated.fact_sales WHERE date_key = 20260101;

CREATE TABLE #scratch (id INT);   -- a name starting with # is temporary too`},
{ul:['Visible **only in your session** and dropped automatically when it ends.','Created in a hidden schema that comes first in the search path, so it hides a permanent table of the same name.','Columns in temporary tables get no compression by default (RAW), which is fine for short-lived data.','Temporary tables **count towards the table quota** for the node type.','Anyone in the PUBLIC group can create them by default; revoke the TEMP privilege to prevent it.']},
{h:'When to use which'},
{t:[['Need','Use'],
['A permanent table with a designed layout','`CREATE TABLE`'],
['A derived or summary table','`CREATE TABLE AS`'],
['A copy of a table structure, such as a staging table','`CREATE TABLE ... (LIKE ...)`'],
['A working table inside one job or session','`CREATE TEMP TABLE`']]},
{h:'Other commands'},
{code:`ALTER TABLE curated.fact_sales ADD COLUMN channel VARCHAR(20);
TRUNCATE curated.fact_sales;      -- removes all rows quickly
SHOW TABLE curated.fact_sales;    -- the CREATE statement for a table`},
{note:'The BACKUP NO option excludes a table from snapshots only on older node types. On RA3, RG and Serverless a table marked BACKUP NO is still backed up, so truncate staging tables before snapshots if you want to avoid storing them.'}],
src:[['CREATE TABLE',DG+'r_CREATE_TABLE_NEW.html'],['CREATE TABLE AS',DG+'r_CREATE_TABLE_AS.html'],['Names and identifiers',DG+'r_names.html']]};

/* ================= LECTURE 4 ================= */
L['rs:4:4']={blocks:[
{p:'This is one of the biggest surprises for people coming from PostgreSQL: **Redshift does not enforce primary key, unique or foreign key constraints.** You can declare them, and the planner uses them, but nothing stops bad data from loading.'},
{h:'What is and is not enforced'},
{t:[['Constraint','Enforced?','Used by the planner?'],
['`NOT NULL`','**Yes**','Yes'],
['`PRIMARY KEY`','No, informational','Yes, as a hint'],
['`UNIQUE`','No, informational','Yes, as a hint'],
['`FOREIGN KEY` / `REFERENCES`','No, informational','Yes, as a hint']]},
{code:`CREATE TABLE dim_customer (
  customer_id INTEGER PRIMARY KEY,
  name VARCHAR(100)
);
INSERT INTO dim_customer VALUES (1, 'Asha');
INSERT INTO dim_customer VALUES (1, 'Asha again');   -- succeeds: duplicates are allowed!
SELECT customer_id, COUNT(*) FROM dim_customer GROUP BY 1 HAVING COUNT(*) > 1;`},
{h:'Why declare them at all?'},
{p:'The planner assumes declared keys are valid. It uses them to infer uniqueness and relationships so it can order joins and remove redundant ones. That makes queries faster. It also means **an invalid key can give wrong answers**: for example, `SELECT DISTINCT` may return duplicate rows if the primary key is not really unique.'},
{ul:['**Declare** keys that your load process guarantees.','**Do not declare** keys you doubt.','**Protect integrity yourself**: dedupe in a staging table before inserting (Section 7), and run validation queries after each load.']},
{h:'Validation queries to schedule'},
{code:`-- Duplicate primary keys
SELECT customer_id, COUNT(*) FROM dim_customer GROUP BY 1 HAVING COUNT(*) > 1;

-- Orphan foreign keys
SELECT f.customer_id, COUNT(*)
FROM   fact_sales f LEFT JOIN dim_customer d ON f.customer_id = d.customer_id
WHERE  d.customer_id IS NULL
GROUP  BY 1;`},
{h:'Identity columns'},
{p:'An `IDENTITY` column generates values automatically. The type must be `INT` or `BIGINT`.'},
{code:`CREATE TABLE orders (
  order_id BIGINT IDENTITY(1, 1),     -- seed 1, step 1
  note     VARCHAR(100)
);

-- Variant that lets you supply your own value
CREATE TABLE orders2 (
  order_id BIGINT GENERATED BY DEFAULT AS IDENTITY(1, 1),
  note     VARCHAR(100)
);
INSERT INTO orders2 (note) VALUES ('auto');          -- generated value
INSERT INTO orders2 (order_id, note) VALUES (500, 'mine');`},
{h:'Gaps and ordering'},
{ul:['`INSERT ... VALUES` generates seed, then seed + step, and so on.','`COPY` and `INSERT ... SELECT` load in parallel across slices, so Redshift **skips numbers** to keep values unique. Values are unique, but they may have **gaps** and may not follow the order of the source file.','Never rely on identity values being consecutive or as a record of load order. Use a timestamp column for that.','For `GENERATED BY DEFAULT AS IDENTITY`, a value you supply (or load with `EXPLICIT_IDS`) is not checked for uniqueness and does not change the next generated value. If you need uniqueness, supply values that cannot collide, such as a number below the seed.','You cannot add a default identity column with `ALTER TABLE ADD COLUMN`.','A `COPY` with `EXPLICIT_IDS` sets a `risk_event` flag in `SVV_TABLE_INFO` because Redshift then stops checking identity uniqueness.']},
{note:'For warehouse tables, prefer business keys or surrogate keys you generate in your ETL over relying on identity values.'}],
src:[['Table constraints',DG+'t_Defining_constraints.html'],['CREATE TABLE (identity columns)',DG+'r_CREATE_TABLE_NEW.html'],['SVV_TABLE_INFO',DG+'r_SVV_TABLE_INFO.html']]};

/* ================= LECTURE 5 ================= */
L['rs:4:5']={blocks:[
{p:'A **view** saves a query under a name. Redshift supports regular views and **late-binding views**, which are much more tolerant of change.'},
{h:'Regular views'},
{code:`CREATE VIEW curated.v_revenue AS
SELECT d.year, p.category, SUM(f.amount) AS revenue
FROM   curated.fact_sales f
JOIN   curated.dim_date d    ON f.date_key = d.date_key
JOIN   curated.dim_product p ON f.product_key = p.product_key
GROUP  BY d.year, p.category;

CREATE OR REPLACE VIEW curated.v_revenue AS ...;   -- same columns and types only
SHOW VIEW curated.v_revenue;`},
{ul:['A view is **not materialized**: its query runs every time you use the view.','To create a view you need access to the underlying objects. To **query** it you need `SELECT` on the **view** only, not on the underlying tables.','`CREATE OR REPLACE VIEW` can only replace a view with a query that returns the **identical set of columns, names and types**. It preserves owner and grants and locks the view while it runs.','A view cannot be updated, inserted into or deleted from. It can have up to 1,600 columns. A name starting with `#` makes a temporary view.']},
{h:'Late-binding views'},
{p:'A regular view is **bound** to the objects it uses, so you cannot drop or change them without dealing with the view. A late-binding view is not bound: Redshift checks the underlying objects only when the view is queried.'},
{code:`-- Objects must be schema-qualified
CREATE VIEW curated.v_events AS
SELECT eventid, eventname FROM public.event
WITH NO SCHEMA BINDING;

-- You can now rename a column or drop and recreate public.event
-- without dropping the view. The view works again once the object fits.`},
{t:[['','Regular view','Late-binding view'],
['Bound to underlying objects','Yes','No'],
['Can drop or alter the objects freely','No, dependencies block it','Yes'],
['Checked','When created','When queried'],
['External (Spectrum) tables','Not allowed','**Required** to reference them'],
['Objects must be schema-qualified','No','**Yes**']]},
{ul:['If you drop an underlying object, queries on the view **fail** until it exists again. If the query uses a column that no longer exists, it fails.','If you drop and **recreate** an underlying table, the new table has **default permissions**, so re-grant access.','To query a late-binding view you need `SELECT` on the view, and its **owner** must have `SELECT` on the referenced objects.','Details of late-binding views are available through the `PG_GET_LATE_BINDING_VIEW_COLS` function.','Recursive CTEs are not supported in late-binding views.']},
{h:'The classic use: lake plus warehouse'},
{code:`-- Recent data in Redshift, old data archived to S3 and exposed through Spectrum
CREATE VIEW curated.sales_all AS
SELECT * FROM curated.sales
UNION ALL
SELECT * FROM spectrum.sales
WITH NO SCHEMA BINDING;`},
{note:'A standard view built on a late-binding view captures its definition and owner when it is created. If you change the late-binding view, recreate the standard view with CREATE OR REPLACE VIEW to pick up the change. For stored query results that need to be fast, see materialized views in Section 8.'}],
src:[['CREATE VIEW',DG+'r_CREATE_VIEW.html'],['PG_GET_LATE_BINDING_VIEW_COLS',DG+'PG_GET_LATE_BINDING_VIEW_COLS.html']]};

/* ================= LECTURE 6 ================= */
L['rs:4:6']={blocks:[
{p:'Redshift exposes its own state through system tables and views. They tell you what exists, what is running and what ran. There are several families, and **which ones you can use depends on whether you run Provisioned or Serverless**.'},
{h:'The families'},
{t:[['Prefix','What it is','Where it works'],
['**PG_** catalog tables','PostgreSQL-style catalog: `pg_class`, `pg_namespace`, `pg_user`, `pg_table_def` ...','Everywhere'],
['**SVV_**','Views about database **objects** and metadata, such as `SVV_TABLE_INFO`, `SVV_ALL_TABLES`, `SVV_REDSHIFT_DATABASES`','Mostly everywhere; a few are provisioned only'],
['**SYS_**','**Monitoring** views for queries and workloads, such as `SYS_QUERY_HISTORY`, `SYS_QUERY_DETAIL`, `SYS_LOAD_HISTORY`','**Provisioned and Serverless**: use these first'],
['**STL_**','**Logs** persisted to disk giving a history of system activity','Provisioned only'],
['**STV_**','**Virtual** snapshots of the current state, held in memory','Provisioned only'],
['**SVL_**','Views over logs, about queries on the main cluster','Provisioned only'],
['**SVCS_**','Like SVL but covering both the main and concurrency scaling clusters','Provisioned only']]},
{note:'If you may ever move to Serverless, write monitoring queries against SYS_ views from the start. All STL, STV, SVCS and SVL views, and some SVV views, hold data only for provisioned clusters.'},
{h:'Visibility and retention'},
{ul:['Tables are either **user-visible** or **superuser-visible**. Regular users see only their **own** rows in most user-visible tables.','A superuser sees everything. To let a regular user query a superuser-only view, `GRANT SELECT` on it.','`ALTER USER ... SYSLOG ACCESS UNRESTRICTED` lets a user see **other users rows**. That can expose query text with sensitive values, so grant it sparingly.','STL views keep **seven days** of history. To keep more, copy them to tables or `UNLOAD` them to S3.','System tables are **not included in snapshots**.','System tables do not follow normal consistency rules, so a query comparing a system table with itself can return surprising rows.','Filter out internal queries with `userid > 1` in views that have a `userid` column.']},
{h:'IDs to be careful with'},
{ul:['`query_id` and process or session ids (`pid`, `session_id`) can be **reused over time**.','`transaction_id` (`xid`) is **unique**.','In SYS views one **user query** is one row in `SYS_QUERY_HISTORY` (`query_id`). The optimizer may split it into child queries, which you find in `SYS_QUERY_DETAIL`. The older STL views record each child query as a separate row, so the numbers differ.']},
{h:'Where to look'},
{t:[['I want to know','Use'],
['Tables, sizes, skew, unsorted data','`SVV_TABLE_INFO`'],
['All tables across databases','`SVV_ALL_TABLES`, `SVV_REDSHIFT_TABLES`'],
['Columns of a table','`SVV_ALL_COLUMNS`, `SVV_REDSHIFT_COLUMNS`'],
['Databases and schemas','`SVV_REDSHIFT_DATABASES`, `SVV_ALL_SCHEMAS`'],
['Recent, running or queued queries','`SYS_QUERY_HISTORY`'],
['Where a query spent time','`SYS_QUERY_DETAIL`'],
['Data loads and their errors','`SYS_LOAD_HISTORY`, `SYS_LOAD_ERROR_DETAIL`'],
['Sessions','`SYS_SESSION_HISTORY`'],
['Serverless RPU use','`SYS_SERVERLESS_USAGE`'],
['Locks and open transactions','`SVV_TRANSACTIONS`, `PG_LOCKS`']]},
{code:`-- A catalog query that works everywhere: tables and owners in a schema
SELECT n.nspname AS schema, c.relname AS table_name, u.usename AS owner
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
JOIN   pg_user u      ON u.usesysid = c.relowner
WHERE  c.relkind = 'r' AND n.nspname = 'curated';

-- Recent queries from the monitoring view
SELECT query_id, status, elapsed_time/1000000.0 AS seconds, LEFT(query_text, 60) AS q
FROM   sys_query_history ORDER BY start_time DESC LIMIT 10;`}],
src:[['System tables and views reference',DG+'cm_chap_system-tables.html'],['SYS monitoring views',DG+'serverless_views-monitoring.html'],['System view mapping for migrating to SYS views',DG+'sys_view_migration.html']]};

/* ================= LECTURE 7 ================= */
L['rs:4:7']={blocks:[
{p:'`SVV_TABLE_INFO` is the single most useful view for a DBA. For every user table it shows size, row count, distribution style, sort key, how unsorted it is, how skewed it is and how stale its statistics are.'},
{h:'Good to know'},
{ul:['It shows only **user tables and materialized views that hold at least one row**; empty tables are missing.','It is visible only to **superusers**; grant `SELECT` on it to other users who need it.','`table` is a reserved word, so write `"table"` in double quotes.']},
{h:'The columns that matter'},
{t:[['Column','Meaning','Look for'],
['`size`','Table size in **1 MB blocks**','Largest tables first'],
['`pct_used`','Share of available space the table uses','Tables taking a big share'],
['`tbl_rows`','Total rows, **including** rows marked for deletion but not yet vacuumed','Compare with `estimated_visible_rows`'],
['`estimated_visible_rows`','Estimated rows excluding deleted ones','Big gap = vacuum needed'],
['`diststyle`','`EVEN`, `KEY(col)`, `ALL`, or `AUTO(...)`','Matches your design'],
['`sortkey1`, `sortkey_num`','First sort key column and how many','Missing sort key on a big table'],
['`unsorted`','Percent of unsorted rows','High means scans skip fewer blocks'],
['`vacuum_sort_benefit`','Estimated gain in scan performance from a sort','Worth running VACUUM SORT'],
['`stats_off`','How stale statistics are: 0 current, 100 out of date','High means run ANALYZE'],
['`skew_rows`','Rows on the busiest slice divided by rows on the emptiest','Well above 1 = uneven distribution'],
['`encoded`','Whether any column has an encoding set','`N` on a large table'],
['`max_varchar`','Size of the widest VARCHAR column','Oversized columns'],
['`risk_event`','Flags such as COPY with `EXPLICIT_IDS`','Identity uniqueness no longer checked'],
['`create_time`','When the table was created','Old unused tables']]},
{h:'Queries to keep'},
{code:`-- Largest tables
SELECT "schema", "table", size AS mb, tbl_rows, diststyle, sortkey1
FROM svv_table_info ORDER BY size DESC LIMIT 20;

-- Size of the whole database in GB
SELECT SUM(size)/1024.0 AS gb FROM svv_table_info;

-- Size per schema
SELECT "schema", SUM(size)/1024.0 AS gb FROM svv_table_info GROUP BY 1 ORDER BY 2 DESC;

-- Tables that need attention
SELECT "schema", "table", unsorted, stats_off, skew_rows, vacuum_sort_benefit
FROM svv_table_info
WHERE unsorted > 20 OR stats_off > 10 OR skew_rows > 4
ORDER BY size DESC;`},
{p:'The thresholds above are rules of thumb to adjust for your own workload, not official limits. Sections 6 and 8 explain how to fix what you find: redesign keys for skew, `VACUUM` for unsorted data and `ANALYZE` for stale statistics.'},
{note:'SVV_TABLE_INFO is available on provisioned clusters and Serverless, which makes it a good first stop on any warehouse. Run it weekly and save the results to a table so you can see trends.'}],
src:[['SVV_TABLE_INFO',DG+'r_SVV_TABLE_INFO.html'],['Visibility of data in system tables',DG+'cm_chap_system-tables.html']]};

/* ================= LECTURE 8 ================= */
L['rs:4:8']={blocks:[
{p:'Sooner or later a query runs too long, blocks others or holds a connection you need. This lecture shows how to find it, cancel it and, if necessary, end the whole session without making things worse.'},
{h:'Find running and queued queries'},
{code:`-- Works on Provisioned and Serverless. Times are in microseconds.
SELECT query_id, session_id, user_id, status, start_time,
       DATEDIFF(second, start_time, GETDATE()) AS running_seconds,
       queue_time/1000000.0 AS queued_seconds,
       LEFT(query_text, 80) AS query
FROM   sys_query_history
WHERE  status IN ('running', 'queued')
ORDER  BY start_time;`},
{p:'`session_id` is the process id you pass to the cancel and terminate functions. On provisioned clusters the older `STV_RECENTS` and `STV_SESSIONS` views also list running statements and sessions.'},
{h:'Cancel a query (gentle)'},
{code:`CANCEL 18764;                         -- by process id; optional message after it
SELECT pg_cancel_backend(18764);      -- same effect as a function`},
{ul:['Cancelling stops the **current query** but keeps the session. It works only if the query is **not inside a transaction block** (BEGIN ... END).','You can cancel your own queries. A superuser can cancel anyone.']},
{h:'Terminate a session (firm)'},
{code:`SELECT pg_terminate_backend(18764);`},
{ul:['Ends the whole session. Any open transaction is **rolled back** and its **locks are released**.','You can end sessions you own; a superuser can end any session.','Use it for sessions stuck in a transaction, idle sessions holding locks or connections when you are near the connection limit.']},
{h:'Find who holds locks'},
{code:`SELECT * FROM svv_transactions;     -- open transactions, lock mode, granted or waiting, pid
SELECT * FROM pg_locks;`},
{h:'A safe routine'},
{flow:['Find the query and its session id','Check who owns it and why it is slow','Try CANCEL first','Terminate only if cancel fails or it is stuck in a transaction','Tell the owner and note what happened']},
{ul:['**Confirm the id.** Process ids can be reused, so re-check just before you act.','Do not terminate a large `COPY` or `VACUUM` without understanding the cost: the work rolls back and must be redone.','Prefer fixing the cause: add a `statement_timeout`, repair the query, or use workload management (Section 9).']},
{t:[['Goal','Do this'],
['Stop a runaway SELECT','`CANCEL <pid>`'],
['Free a lock held by a stuck transaction','`pg_terminate_backend(<pid>)`'],
['Free connections near the limit','Terminate idle sessions'],
['Prevent runaways','`statement_timeout`, query monitoring rules (Section 9)']]},
{note:'Anyone investigating also needs the right visibility: regular users see only their own sessions in system views unless granted SYSLOG ACCESS UNRESTRICTED.'}],
src:[['PG_TERMINATE_BACKEND',DG+'PG_TERMINATE_BACKEND.html'],['CANCEL',DG+'r_CANCEL.html'],['SYS_QUERY_HISTORY',DG+'SYS_QUERY_HISTORY.html']]};

/* ================= ADDITIONAL 9 ================= */
L['rs:4:9']={blocks:[
{p:'Redshift supports **stored procedures** written in PL/pgSQL and **user-defined functions (UDFs)** in SQL and as Lambda functions. Python UDFs are no longer an option, so migrate any that remain.'},
{h:'Stored procedures'},
{p:'A stored procedure is a saved block of procedural code that can run DDL and DML as well as queries, use loops and conditions, and does not have to return a value. A UDF, in contrast, is a function used inside a query and limited to expressions.'},
{code:`CREATE OR REPLACE PROCEDURE curated.load_daily_sales(p_date INTEGER)
AS $$
BEGIN
  DELETE FROM curated.fact_sales WHERE date_key = p_date;
  INSERT INTO curated.fact_sales
    SELECT * FROM staging.fact_sales WHERE date_key = p_date;
  RAISE INFO 'Loaded date %', p_date;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

CALL curated.load_daily_sales(20260101);`},
{ul:['`SECURITY DEFINER` runs the procedure with the **owner** privileges, so you can let a role load a table without direct write access. `SECURITY INVOKER` (the default) uses the caller privileges.','Grant `EXECUTE` on the procedure to the roles that may call it.','A database can hold up to **10,000** stored procedures.','Procedures are a good home for repeatable ELT steps, called from scheduled queries or the Data API.']},
{h:'SQL UDFs'},
{code:`CREATE OR REPLACE FUNCTION f_margin (price FLOAT, cost FLOAT)
RETURNS FLOAT
STABLE
AS $$
  SELECT ($1 - $2) / NULLIF($1, 0)
$$ LANGUAGE sql;

SELECT f_margin(100, 80);`},
{h:'Lambda UDFs'},
{p:'A Lambda UDF calls an AWS Lambda function. It can use current Python runtimes and external services and it scales independently of the warehouse.'},
{code:`CREATE EXTERNAL FUNCTION f_mask_email (VARCHAR)
RETURNS VARCHAR
VOLATILE
LAMBDA 'mask-email-function'
IAM_ROLE default;`},
{h:'Python UDFs: migrate now'},
{ul:['**Creating new Python UDFs is no longer possible** (it ended with patch 198).','AWS announced that **support ends June 30, 2026** and execution of existing Python UDFs is suspended after that date. That date has already passed, so any remaining Python UDF may already be failing.','Migrate to a **SQL UDF** if the function needs no Python libraries, otherwise to a **Lambda UDF**.']},
{code:`-- Find remaining Python UDFs (language name plpythonu)
SELECT p.proname AS function_name, n.nspname AS schema
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
JOIN   pg_language  l ON l.oid = p.prolang
WHERE  l.lanname = 'plpythonu';`},
{note:'Treat the Python UDF list as a migration backlog: for each function, check which queries and views use it, rewrite it as a SQL or Lambda UDF, compare results on sample data, then drop the old one.'}],
src:[['Creating stored procedures',DG+'stored-procedure-overview.html'],['CREATE FUNCTION',DG+'r_CREATE_FUNCTION.html'],['Python UDF end of support (AWS blog)','https://aws.amazon.com/blogs/big-data/amazon-redshift-python-user-defined-functions-will-reach-end-of-support-after-june-30-2026/']]};

/* ================= ADDITIONAL 10 ================= */
L['rs:4:10']={blocks:[
{p:'The **SUPER** data type stores semi-structured data such as JSON without you declaring its structure in advance. You query it with **PartiQL**, an SQL-compatible language for nested data.'},
{h:'Why SUPER'},
{ul:['Store schemaless arrays and structures, including nested ones, in a single column next to ordinary columns.','New attributes appear without schema changes: add `customer_id` to incoming click events and nothing breaks.','Data is stored in an efficient binary form that is smaller than text JSON and faster to ingest and process.','Good for the **ingest and explore** stage of ELT. For queries you run often, shred the data into ordinary columns.']},
{h:'Loading and querying'},
{code:`CREATE TABLE events (
  event_id INTEGER,
  payload  SUPER
);

-- Parse JSON text into SUPER
INSERT INTO events VALUES (1,
  JSON_PARSE('{"user":{"id":42,"name":"Asha"},"tags":["new","mobile"],"amount":19.5}'));

-- Navigate with dots and brackets
SELECT event_id,
       payload.user.name       AS user_name,
       payload.tags[0]         AS first_tag,
       payload.amount::DECIMAL(10,2) AS amount
FROM   events;

-- Unnest an array: each tag becomes a row
SELECT e.event_id, t AS tag
FROM   events e, e.payload.tags AS t;`},
{code:`-- Load JSON files from S3 straight into a SUPER column
COPY events_raw FROM 's3://my-bucket/events/'
IAM_ROLE default FORMAT JSON 'noshred';`},
{h:'How PartiQL behaves'},
{ul:['**Dynamic typing**: you do not declare types; they are worked out at run time as the data is read.','**Lax mode**: a type mismatch or a missing path returns `NULL` instead of an error. That is convenient for exploration and a reason to validate carefully.','Navigate objects with `.name` and arrays with `[index]`, and unnest arrays in the `FROM` clause.']},
{h:'Good practice'},
{ul:['Set `enable_case_sensitive_super_attribute` to true when working with SUPER so attribute names keep their case.','Use `COPY` to load from S3 into SUPER.','A single SUPER object is limited to 16 MB.','For frequently queried fields, create a **materialized view** that shreds the JSON into typed columns. Columnar storage then makes it fast.','Use JDBC 2.x, ODBC 2.x or Python driver 2.0.872 or later; older ODBC 1.x is not supported.']},
{h:'SUPER vs Spectrum for nested data'},
{t:[['','SUPER','Redshift Spectrum'],
['Where data lives','Inside Redshift','In S3'],
['Schema','None needed; mixed shapes allowed','A declared schema is required'],
['Best for','Ingesting and exploring JSON, flexible event data','Querying files in the lake without loading them']]}],
src:[['Semi-structured data in Amazon Redshift',DG+'super-overview.html'],['SUPER type',DG+'r_SUPER_type.html'],['PartiQL',DG+'super-partiql.html']]};

/* ================= ADDITIONAL 11 ================= */
L['rs:4:11']={blocks:[
{p:'**Cross-database queries** let you read, and with permission write, objects in other databases of the same warehouse without connecting to them and without copying data.'},
{h:'Three-part names'},
{code:`-- You are connected to database dev, but read from sales_dw
SELECT COUNT(*) FROM sales_dw.curated.fact_sales;

-- Join across databases in one query
SELECT c.name, SUM(f.amount)
FROM   sales_dw.curated.fact_sales f
JOIN   dev.public.dim_customer c ON c.customer_id = f.customer_id
GROUP  BY c.name;`},
{p:'The full path is `database.schema.object`, and `database.schema.object.column` for a column. You can query user tables, regular views, materialized views and late-binding views from other databases in the same read-only query.'},
{h:'External schema alias'},
{p:'To make another database look local, create an external schema that points at it. Tools and queries then use the short `schema.object` form.'},
{code:`CREATE EXTERNAL SCHEMA sales_schema
FROM REDSHIFT DATABASE 'sales_dw' SCHEMA 'curated';

SELECT * FROM sales_schema.fact_sales LIMIT 10;`},
{h:'Permissions'},
{ul:['Access is controlled with normal `GRANT` and `REVOKE`, per table, so users see only the data they are permitted to.','To **write** across databases you need write permission on the target objects; without it cross-database access is read-only.','You do not need to connect to the other database.']},
{h:'Seeing objects across databases'},
{t:[['View','Shows'],
['`SVV_ALL_TABLES`, `SVV_ALL_COLUMNS`, `SVV_ALL_SCHEMAS`','Redshift **and external** objects in every database'],
['`SVV_REDSHIFT_TABLES`, `SVV_REDSHIFT_COLUMNS`, `SVV_REDSHIFT_SCHEMAS`, `SVV_REDSHIFT_DATABASES`, `SVV_REDSHIFT_FUNCTIONS`','Redshift objects in every database']]},
{p:'BI tools use these views to browse objects in all databases. Redshift also shows tables under an external schema alias in `SVV_EXTERNAL_TABLES` and `SVV_EXTERNAL_COLUMNS`.'},
{h:'Cross-database vs data sharing'},
{t:[['','Cross-database query','Data sharing'],
['Scope','Databases in the **same** warehouse','Across warehouses, accounts and Regions'],
['Compute','The one warehouse you run on','The **consumer** warehouse, isolated from the producer'],
['Typical use','Organise one warehouse into several databases','Separate teams or workloads (Section 2 and Section 14)']]},
{note:'Heavy cross-database joins still run on one warehouse, so they share its compute. If a team needs its own capacity, use data sharing between warehouses instead.'}],
src:[['Cross-database queries',DG+'cross-database-overview.html'],['CREATE EXTERNAL SCHEMA',DG+'r_CREATE_EXTERNAL_SCHEMA.html']]};

/* ================= ADDITIONAL 12 ================= */
L['rs:4:12']={blocks:[
{p:'Once several teams share a warehouse you need a structure: where raw data lands, where it is cleaned, where analysts read, who owns what and how names look. Schemas are the tool.'},
{svg:layers},
{h:'A layered design'},
{t:[['Layer','Purpose','Who writes','Who reads'],
['`raw`','Data exactly as loaded from sources; keep it replayable','Loader role','ETL only'],
['`staging`','Cleaned, typed and deduplicated working tables; often truncated each run','ETL role','ETL only'],
['`curated`','Modelled facts and dimensions (star schemas); the trusted layer','Transform role','Analysts and BI tools, read-only'],
['`marts` or team schemas','Views and tables shaped for one team','Owning team','That team']]},
{h:'Setting it up'},
{code:`CREATE SCHEMA raw     AUTHORIZATION loader_admin    QUOTA 5 TB;
CREATE SCHEMA staging AUTHORIZATION etl_admin       QUOTA 1 TB;
CREATE SCHEMA curated AUTHORIZATION transform_admin QUOTA 2 TB;
CREATE SCHEMA mart_finance AUTHORIZATION finance_lead;

-- Roles for access (details in Section 10)
CREATE ROLE analyst;
GRANT USAGE ON SCHEMA curated TO ROLE analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA curated TO ROLE analyst;
-- Applies to future objects created by transform_admin (run as superuser)
ALTER DEFAULT PRIVILEGES FOR USER transform_admin IN SCHEMA curated
  GRANT SELECT ON TABLES TO ROLE analyst;

-- Do not let everyone create objects in public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;`},
{h:'Naming standards'},
{ul:['Lowercase, `snake_case` names for everything, since identifiers are case-insensitive anyway.','Table prefixes that say what a table is: `dim_`, `fact_`, `stg_`, `v_` for views.','Consistent column names and types for the same concept: `customer_id` is always `INTEGER`, `order_date` is always `DATE`.','Name constraints and keys the same way across tables so joins read naturally.','Avoid reserved words such as `table`, `user` and `group` as column names.']},
{h:'Ownership'},
{ul:['Each schema has **one accountable owner or team**.','Use **roles**, not individual users, for grants. Roles let you add and remove people without touching permissions.','Use **quotas** on raw and staging so a bad load cannot fill the warehouse.','Use `ALTER DEFAULT PRIVILEGES` so new tables automatically get the right access. It applies to objects created by the user it is set for (the current user, or the `FOR USER` target when a superuser runs it), and never changes existing objects.','Document the layers and rules in the repository next to your DDL.']},
{h:'Multiple teams, one warehouse or several?'},
{flow:['Few teams, similar load','One database, schemas per layer and team','Competing workloads','Add workload management (Section 9)','Teams need isolation or chargeback','Separate warehouses with data sharing']},
{note:'Keep one database where you can. Schemas give you separation and access control without the connection and limit costs of many databases, and you can still join across them when needed.'}],
src:[['CREATE SCHEMA',DG+'r_CREATE_SCHEMA.html'],['Role-based access control',DG+'t_Roles.html'],['ALTER DEFAULT PRIVILEGES',DG+'r_ALTER_DEFAULT_PRIVILEGES.html']]};
})();
