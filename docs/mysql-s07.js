/* LearnSphere - MySQL, Section 07: Schema Design.
   Lectures 0-5 are core. Needs mysql-common.js. */
(function(){
const K=window.MY,L=window.LESSONS;

const process=K.dg(700,170,[
[10,10,680,150,'Design process',1],
[20,60,115,50,'Requirements|questions, rules',0],[150,60,115,50,'Entities|and attributes',0],[280,60,115,50,'Relationships|and cardinality',2],[410,60,115,50,'Logical model|tables, keys',0],[540,60,130,50,'Physical model|types, indexes',0]],
[[135,85,150,85],[265,85,280,85],[395,85,410,85],[525,85,540,85]]);

const er=K.dg(700,230,[
[10,10,680,210,'Shop model: crow-foot idea in words',1],
[25,50,140,60,'customer|1',0],[280,50,140,60,'order|many per customer',2],[535,50,140,60,'order_item|many per order',0],[280,150,140,60,'product|1 per item',0],
[25,150,200,60,'address|one-to-one with customer',0]],
[[165,80,280,80],[420,80,535,80],[605,110,420,165],[95,110,95,150]]);

const m2m=K.dg(700,170,[
[10,10,680,150,'Many-to-many through a junction table',1],
[25,60,170,50,'students|id, name',0],[265,60,170,50,'enrolments|student_id, course_id',2],[505,60,170,50,'courses|id, title',0]],
[[265,85,195,85],[435,85,505,85]]);

/* ---------- 0 ---------- */
L['mysql:6:0']={blocks:[
{p:'A good schema is easy to query, hard to corrupt and cheap to change. The best way to get there is to model the **business** first and only then think about tables, types and indexes.'},
{svg:process},
{h:'Step 1: collect requirements'},
{ul:['What does the system store, and what questions must it answer? List the reports and screens.','What are the rules? One email per account, an order must have a customer, a price cannot be negative.','How much data, how fast does it grow, and what is read or written most?']},
{h:'Step 2: entities and attributes'},
{p:'An **entity** is a thing the business tracks: customer, product, order. **Attributes** are its properties: name, price, order date. A noun that has its own properties and several instances is usually an entity. A noun that only describes another is usually an attribute.'},
{t:[['Statement','Entities','Attributes'],
['Customers place orders. An order contains products with quantities and prices.','Customer, Order, Product','Customer name, Order date, Product price, Quantity'],
['A product belongs to one category.','Product, Category','Category name']]},
{h:'Step 3: relationships and keys'},
{p:'Decide how entities relate and how many on each side: one customer **has many** orders, an order **has many** items, a product **appears in many** items. Each entity gets a primary key. Each relationship is stored through foreign keys.'},
{svg:er},
{h:'Step 4: logical to physical'},
{ul:['Choose data types and lengths (section 2).','Add constraints: NOT NULL, UNIQUE, CHECK, FOREIGN KEY.','Design indexes from the queries you identified (section 11).','Decide the engine (InnoDB), character set (utf8mb4) and naming rules.']},
{note:'Draw the model first. MySQL Workbench can reverse engineer an existing schema into an EER diagram and generate DDL from one, which is a quick way to review a design with others.'}],
src:[['Data definition statements',K.D+'sql-data-definition-statements.html'],['MySQL Workbench',K.MGT+'workbench/en/']]};

/* ---------- 1 ---------- */
L['mysql:6:1']={blocks:[
{p:'**Cardinality** describes how many rows on one side relate to rows on the other. Each type maps to a standard table pattern.'},
{t:[['Relationship','Example','Implementation'],
['One-to-many','One customer, many orders','Foreign key on the **many** side: `orders.customer_id`'],
['One-to-one','A customer and an optional detailed profile','Foreign key that is also UNIQUE (or the child primary key is the parent key)'],
['Many-to-many','Students and courses, products and tags','A **junction** (link) table with two foreign keys']]},
{h:'One-to-many'},
{code:`CREATE TABLE orders (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers (id)
);`},
{h:'One-to-one'},
{code:`CREATE TABLE customer_profile (
  customer_id INT UNSIGNED PRIMARY KEY,           -- same key as the parent
  bio TEXT, avatar BLOB,
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
);`},
{p:'Use one-to-one when you want to split rarely used or large columns away from a hot table, or when only some rows have the extra data. Otherwise keep the columns in one table.'},
{h:'Many-to-many'},
{svg:m2m},
{code:`CREATE TABLE students (id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100) NOT NULL);
CREATE TABLE courses  (id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT, title VARCHAR(100) NOT NULL);
CREATE TABLE enrolments (
  student_id  INT UNSIGNED NOT NULL,
  course_id   INT UNSIGNED NOT NULL,
  enrolled_on DATE NOT NULL,
  grade       CHAR(1),
  PRIMARY KEY (student_id, course_id),
  KEY idx_course (course_id, student_id),
  FOREIGN KEY (student_id) REFERENCES students (id),
  FOREIGN KEY (course_id)  REFERENCES courses (id)
);`},
{ul:['The **composite primary key** prevents the same pair from being stored twice.','Add a second index in the opposite column order to make lookups from the other side fast.','A junction table often carries **attributes of the relationship** itself, such as the date or grade. That is a sign it is a real entity (an enrolment).']},
{h:'Optional relationships'},
{p:'If a child may exist without a parent, make the foreign key column nullable. If it must always have a parent, declare `NOT NULL`. This decision is a business rule and belongs in the schema.'},
{note:'Avoid storing lists in one column, such as a comma separated list of tag ids. You cannot index it, enforce it with a foreign key or query it cleanly. Use a junction table.'}],
src:[['FOREIGN KEY constraints',K.D+'create-table-foreign-keys.html'],['Using foreign keys',K.D+'example-foreign-keys.html']]};

/* ---------- 2 ---------- */
L['mysql:6:2']={blocks:[
{p:'**Normalization** organises tables so that each fact is stored once. It prevents update, insert and delete **anomalies**: contradictory copies of the same data, rows that cannot be added without unrelated data, and data lost by deleting something else.'},
{h:'A badly designed table'},
{t:[['order_id','customer_name','customer_city','products','total'],
['1','Ana','Berlin','Keyboard, Mouse','89.70'],
['2','Ben','Paris','Monitor','189.00'],
['3','Ana','Berlin','Laptop, Cable','912.50']]},
{ul:['**Update anomaly:** if Ana moves, you must change every one of her rows.','**Insert anomaly:** you cannot store a customer who has not ordered yet.','**Delete anomaly:** deleting order 2 loses Ben completely.','The `products` column holds a list, so it cannot be searched or constrained well.']},
{h:'The normal forms'},
{t:[['Form','Rule','Fix in the example'],
['1NF','Every column holds a single atomic value. No repeating groups or lists. Rows are identifiable','Split `products` into one row per product, in an order_items table'],
['2NF','1NF and every non-key column depends on the **whole** key, not part of it. Matters for composite keys','In order_items(order_id, product_id, product_name, qty): move product_name to products'],
['3NF','2NF and no non-key column depends on another non-key column (no transitive dependency)','customer_city depends on the customer, not on the order: move to customers'],
['BCNF','Every determinant is a candidate key. A slightly stricter 3NF','Rare edge cases with overlapping candidate keys']]},
{p:'A short way to remember 3NF: every non-key column must depend on **the key, the whole key and nothing but the key**.'},
{h:'The result'},
{code:`customers(id PK, name, city)
orders(id PK, customer_id FK, order_date, status)
products(id PK, name, price)
order_items(order_id FK, product_id FK, qty, price, PRIMARY KEY (order_id, product_id))`},
{p:'Each fact now lives in one place. Changing Ana city is one update, and customers exist without orders.'},
{h:'Checking a design'},
{ul:['For each table ask: what does one row represent? Can I state it in one sentence?','For each non-key column ask: what determines this value? If it is not the primary key, move it.','A repeated value in many rows that really belongs to something else is a smell.']},
{note:'Beyond BCNF there are 4NF and 5NF, which handle multi-valued and join dependencies. Most practical designs are fine at 3NF, with deliberate exceptions.'}],
src:[['Database design basics (Oracle MySQL docs)',K.D+'tutorial.html'],['Using foreign keys',K.D+'example-foreign-keys.html']]};

/* ---------- 3 ---------- */
L['mysql:6:3']={blocks:[
{p:'Normalized tables are correct and flexible, but reading them needs joins. **Denormalization** deliberately stores redundant data to make important reads faster or simpler. It is a trade: faster reads against more storage, more complex writes and the risk of inconsistency.'},
{h:'When it is worth it'},
{ul:['A hot query joins many tables and runs very often, and the joined values rarely change.','You report on large history where recomputing aggregates is expensive.','Archival or reporting copies where the source of truth lives elsewhere.','You measured the problem. Do not denormalize on a guess.']},
{h:'Common techniques'},
{t:[['Technique','Example','Cost'],
['Copy a column','`orders.customer_name` copied at order time','Can drift. But a snapshot is often **correct**: the address on the order should not change when the customer moves'],
['Precomputed counter','`customers.order_count`','Must be updated with every order. Races under concurrency'],
['Summary table','`daily_sales(date, revenue, orders)` filled by a job','Stale between refreshes. Needs rebuild logic'],
['Pre-joined reporting table','Flattened table for dashboards','Duplicates data, refresh required'],
['JSON column','Store flexible attributes with the row','Weaker constraints, harder queries']]},
{h:'Keeping redundant data consistent'},
{ul:['Update it in the **same transaction** as the source change.','Use a **trigger** or generated column for simple, per-row cases.','Use a periodic **job** or an event for summaries, and make it idempotent so it can be re-run.','Keep a way to **recompute** from the normalized data, so drift can be repaired.']},
{code:`-- summary table refreshed by a scheduled job
CREATE TABLE daily_sales (
  sale_date DATE PRIMARY KEY,
  orders INT NOT NULL,
  revenue DECIMAL(14,2) NOT NULL
);

REPLACE INTO daily_sales
SELECT order_date, COUNT(*), SUM(total) FROM orders
WHERE status <> 'cancelled' AND order_date >= CURDATE() - INTERVAL 7 DAY
GROUP BY order_date;`},
{note:'Try indexes and better queries first. A good index often removes the need to denormalize. Denormalize second, and document why, so a later reader does not "fix" it.'}],
src:[['Optimizing database structure',K.D+'optimizing-database-structure.html']]};

/* ---------- 4 ---------- */
L['mysql:6:4']={blocks:[
{p:'The primary key is the most important design decision in a table, because in InnoDB it is also the **clustered index**: rows are physically organised by it, and every secondary index stores a copy of it. A poor key makes everything larger and slower.'},
{h:'Surrogate versus natural keys'},
{t:[['Kind','Example','Pros','Cons'],
['Surrogate','`id` AUTO_INCREMENT','Small, stable, meaningless, fast joins','Not meaningful, needs a UNIQUE on the business key'],
['Natural','email, ISBN, country code','Meaningful, no extra column','May change, may be long, privacy concerns']]},
{p:'Use a **surrogate key** for the primary key in most tables, and still declare the natural identifier as `UNIQUE`. Natural keys fit stable small codes such as `country(code)`.'},
{h:'AUTO_INCREMENT'},
{ul:['Sequential, so inserts append to the end of the clustered index. This is the most efficient insert pattern.','Compact: 4 or 8 bytes. All secondary indexes carry it, so a small key keeps them small.','Predictable. Do not expose it publicly if enumeration is a risk. Add a separate public identifier.','Needs coordination when several writers generate ids across servers (see `auto_increment_increment`).']},
{h:'UUID'},
{p:'UUIDs are globally unique and can be created by any client. They also have a cost in InnoDB.'},
{t:[['Choice','Size','Insert pattern','Notes'],
['UUID v4 as CHAR(36)','36 bytes plus overhead','Random, causes page splits and a poor cache hit rate','Avoid as a clustered key'],
['UUID as BINARY(16)','16 bytes','Still random','Store with `UUID_TO_BIN(uuid)` and read with `BIN_TO_UUID(bin)`'],
['Time-ordered UUID (v7) or `UUID_TO_BIN(UUID(), 1)`','16 bytes','Mostly sequential','The swap flag moves the time part first. Much better locality'],
['BIGINT AUTO_INCREMENT plus a UUID column','8 bytes plus a unique index','Sequential','A common compromise: internal join key and external id']]},
{code:`CREATE TABLE devices (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID(), 1)),
  name      VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_public_id (public_id)
);
SELECT BIN_TO_UUID(public_id, 1) FROM devices;`},
{h:'Composite keys'},
{p:'A junction table can use its two foreign keys as the primary key. For other tables a composite key makes every secondary index larger and every foreign key reference longer, so prefer a single surrogate unless the pair is the natural identity.'},
{note:'Do not change the primary key of a large table lightly. It rebuilds the table and all indexes. Always declare a primary key. InnoDB creates a hidden one when you do not, which cannot be used in queries and hurts replication.'}],
src:[['Clustered and secondary indexes',K.D+'innodb-index-types.html'],['UUID functions',K.D+'miscellaneous-functions.html#function_uuid-to-bin']]};

/* ---------- 5 ---------- */
L['mysql:6:5']={blocks:[
{p:'Consistent conventions make a schema readable for everyone who touches it. The patterns below solve problems that appear in nearly every project.'},
{h:'Naming'},
{ul:['Lowercase with underscores: `order_items`, `created_at`. Case rules for table names differ between operating systems, so lowercase avoids surprises.','Singular or plural for tables, but pick one. Name foreign keys after the parent: `customer_id`.','Name constraints and indexes explicitly: `fk_orders_customer`, `uq_users_email`, `idx_orders_date`. Error messages and plans become clearer.','Do not use reserved words, spaces or prefixes like `tbl_`.']},
{h:'Audit columns'},
{code:`created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
created_by INT UNSIGNED NULL,`},
{p:'Time columns help debugging and support. For full history of changes use an audit table filled by triggers or by the application.'},
{h:'Soft delete'},
{p:'Add `deleted_at DATETIME NULL` and treat NULL as active. It makes accidental deletes recoverable, but it also means every query must filter, unique keys need care and the table grows. Purge old rows on a schedule. Consider a separate archive table when deleted rows should leave the hot table.'},
{h:'Statuses and lookups'},
{t:[['Approach','Use when'],
['`VARCHAR` with a CHECK constraint','Small fixed set that rarely changes'],
['`ENUM`','Fixed set, never reordered. Be aware of the cost of change'],
['Lookup table with a foreign key','The list is data: it changes, has labels, flags or translations']]},
{h:'Hierarchies'},
{t:[['Model','Idea','Good for'],
['Adjacency list','`parent_id` column. Recursive CTEs read it','Most trees. Simple to write'],
['Path or materialised path','Store `/1/4/9/`','Fast subtree reads with LIKE on the prefix'],
['Nested set','Left and right numbers','Read heavy, rarely changed trees'],
['Closure table','All ancestor and descendant pairs','Flexible queries at a storage cost']]},
{h:'Storing common values'},
{ul:['**Money:** DECIMAL(p,2), or integer minor units. Store the currency code too.','**Addresses:** separate columns, or a table linked to customers when there are several.','**Booleans:** `TINYINT(1)` or `BOOLEAN`, NOT NULL with a default.','**Phone numbers:** VARCHAR, never an integer, because of leading zeros and plus signs.','**Tags:** a junction table, not a comma separated string.','**Files:** keep large binary files outside the database and store a path or object key.','**Time:** one convention. UTC is the easiest.']},
{note:'A schema is a long-lived contract. Write migrations as versioned scripts in source control, so every environment can be rebuilt and every change is reviewed.'}],
src:[['Optimizing database structure',K.D+'optimizing-database-structure.html'],['Schema object names',K.D+'identifiers.html']]};
})();
