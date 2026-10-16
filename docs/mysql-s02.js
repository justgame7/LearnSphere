/* LearnSphere - MySQL, Section 02: Databases, Tables & Data Types.
   Lectures 0-9 are core. Needs mysql-common.js. */
(function(){
const K=window.MY,L=window.LESSONS;

const rel=K.dg(700,230,[
[10,10,680,210,'One table: customers',1],
[30,40,120,36,'id (PK)',2],[150,40,160,36,'name',2],[310,40,200,36,'email',2],[510,40,160,36,'created_at',2],
[30,76,120,36,'1',0],[150,76,160,36,'Ana',0],[310,76,200,36,'ana@example.com',0],[510,76,160,36,'2026-01-05',0],
[30,112,120,36,'2',0],[150,112,160,36,'Ben',0],[310,112,200,36,'ben@example.com',0],[510,112,160,36,'2026-01-06',0],
[30,160,640,44,'Columns run down (attributes with a type). Each row is one record. The primary key identifies every row.',0]],[]);

const nums=K.dg(700,200,[
[10,10,680,180,'Integer types and storage',1],
[25,50,120,60,'TINYINT|1 byte',0],[160,50,120,60,'SMALLINT|2 bytes',0],[295,50,120,60,'MEDIUMINT|3 bytes',0],[430,50,100,60,'INT|4 bytes',2],[545,50,130,60,'BIGINT|8 bytes',0],
[25,130,650,40,'Signed range is half negative, half positive. UNSIGNED doubles the positive range.',0]],[]);

const tzflow=K.dg(700,170,[
[10,10,680,150,'TIMESTAMP and the session time zone',1],
[30,60,150,50,'Client sends|local time',0],[270,60,150,50,'Server converts|to UTC and stores',2],[510,60,160,50,'Reader sees time|in its own zone',0]],
[[180,85,270,85],[420,85,510,85]]);

/* ---------- 0 ---------- */
L['mysql:1:0']={blocks:[
{p:'Before writing SQL you need the vocabulary of the **relational model**. It is small, and every later topic (joins, normalization, indexes) builds on it.'},
{svg:rel},
{h:'Core terms'},
{t:[['Formal term','MySQL term','Meaning'],
['Relation','Table','A set of rows with the same columns'],
['Tuple','Row, record','One entity or fact, such as one customer'],
['Attribute','Column, field','A named property with a data type'],
['Domain','Data type and constraints','Which values a column may hold'],
['Key','Primary, unique and foreign keys','Columns that identify or link rows']]},
{h:'Keys'},
{ul:['**Primary key**: the column or columns that uniquely identify each row. Cannot be NULL. A table has one.','**Unique key**: also forbids duplicates, but a table may have several, and by default NULL is allowed.','**Foreign key**: a column that refers to the primary key of another table. This is how tables are related.','**Candidate key**: any column set that could serve as the primary key.','**Composite key**: a key made from two or more columns.']},
{h:'Integrity rules'},
{t:[['Rule','Meaning','Enforced by'],
['Entity integrity','Every row is identifiable','PRIMARY KEY'],
['Referential integrity','A reference points to a row that exists','FOREIGN KEY'],
['Domain integrity','Values are valid for the column','Data types, NOT NULL, CHECK'],
['Uniqueness','No duplicates where forbidden','UNIQUE']]},
{h:'Objects you will meet'},
{ul:['**Server** holds many **databases** (also called schemas: in MySQL the two words mean the same thing).','A **database** holds tables, views, routines, triggers and events.','A **table** holds rows. Indexes belong to tables.']},
{note:'In MySQL, SCHEMA and DATABASE are synonyms. Unlike some other systems there is no extra level of schema inside a database.'}],
src:[['Data definition statements',K.D+'sql-data-definition-statements.html']]};

/* ---------- 1 ---------- */
L['mysql:1:1']={blocks:[
{p:'Databases and tables are created with **DDL** statements. Learn the patterns for creating, inspecting and dropping them, because you will repeat them throughout the course.'},
{h:'Databases'},
{code:`CREATE DATABASE IF NOT EXISTS shop
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

SHOW DATABASES;
USE shop;
SELECT DATABASE();          -- current database
DROP DATABASE IF EXISTS shop;`},
{p:'The character set and collation set here become the defaults for tables created later. Section 2 lesson 5 explains them.'},
{h:'Tables'},
{code:`CREATE TABLE products (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku         VARCHAR(40)  NOT NULL,
  name        VARCHAR(200) NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  in_stock    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku)
) ENGINE=InnoDB;`},
{h:'Inspecting what exists'},
{t:[['Statement','Shows'],
['`SHOW TABLES;`','Tables in the current database'],
['`DESCRIBE products;`','Columns, types, null, key, default'],
['`SHOW CREATE TABLE products\\G`','The exact statement that recreates the table'],
['`SHOW COLUMNS FROM products;`','Same information as DESCRIBE'],
['`SHOW INDEX FROM products;`','Indexes and their columns'],
['`SELECT * FROM information_schema.tables WHERE table_schema = \'shop\';`','Metadata as rows, queryable']]},
{h:'Copying and removing'},
{code:`CREATE TABLE products_copy LIKE products;                 -- same structure, no rows
CREATE TABLE products_snap AS SELECT * FROM products;     -- structure of the result plus rows
DROP TABLE IF EXISTS products_snap;
RENAME TABLE products_copy TO products_old;`},
{note:'`CREATE TABLE ... AS SELECT` does not copy keys, defaults or indexes. Use `LIKE` first when you need the structure exactly.'},
{h:'Naming advice'},
{ul:['Use lowercase with underscores. Table and database names are case sensitive on Linux and not on Windows by default.','Avoid reserved words. If you must use one, quote it with backticks.','Pick singular or plural for table names and stay consistent.']}],
src:[['CREATE DATABASE',K.D+'create-database.html'],['CREATE TABLE',K.D+'create-table.html']]};

/* ---------- 2 ---------- */
L['mysql:1:2']={blocks:[
{p:'Choosing the right numeric type affects correctness, storage and index size. The two golden rules are: use the **smallest integer type that safely fits**, and use **DECIMAL for money**.'},
{svg:nums},
{h:'Integer ranges'},
{t:[['Type','Bytes','Signed range','Unsigned maximum'],
['TINYINT','1','-128 to 127','255'],
['SMALLINT','2','-32,768 to 32,767','65,535'],
['MEDIUMINT','3','about -8.4 million to 8.4 million','about 16.7 million'],
['INT','4','about -2.1 billion to 2.1 billion','about 4.29 billion'],
['BIGINT','8','about -9.2 quintillion to 9.2 quintillion','about 1.8e19']]},
{p:'`INT(11)` does not mean eleven digits. The number in parentheses is a display hint that is deprecated and ignored in modern versions. Only the base type sets the range. A `TINYINT(1)` or `BOOLEAN` column is the usual way to store true and false (1 and 0).'},
{h:'Exact and approximate numbers'},
{t:[['Type','Kind','Use for'],
['DECIMAL(p,s)','Exact','Money, rates, anything that must add up precisely'],
['FLOAT, DOUBLE','Approximate binary','Scientific measurements where tiny rounding is acceptable'],
['BIT(n)','Bit field','Rarely. Flags are usually clearer as separate columns']]},
{code:`SELECT 0.1 + 0.2;                    -- 0.3 (DECIMAL arithmetic)
SELECT 0.1e0 + 0.2e0;                -- 0.30000000000000004 (DOUBLE)
CREATE TABLE payments (amount DECIMAL(12,2) NOT NULL);`},
{p:'`DECIMAL(12,2)` holds 12 digits in total, 2 after the decimal point, so the maximum is 9,999,999,999.99. If a value does not fit, strict mode raises an error. Without strict mode the value is clamped silently, which is dangerous.'},
{h:'Practical choices'},
{ul:['Primary keys: `INT UNSIGNED` is fine for up to 4 billion rows. Use `BIGINT UNSIGNED` when growth may exceed that.','Counts, flags and small ranges: TINYINT or SMALLINT. Smaller keys mean smaller indexes.','Money: DECIMAL, or store whole minor units (cents) in an integer.','Never compare floating point values with equality.']},
{note:'Overflow is a classic production incident: an INT AUTO_INCREMENT id passes 2.1 billion (signed) and inserts start to fail. Choose the type for the table size you expect in years.'}],
src:[['Numeric data types',K.D+'numeric-types.html'],['Integer types',K.D+'integer-types.html']]};

/* ---------- 3 ---------- */
L['mysql:1:3']={blocks:[
{p:'String types hold text and binary data. The decisions are: fixed or variable length, how long, and whether the column should be indexed. Wrong choices waste space and slow queries.'},
{h:'The main types'},
{t:[['Type','Length','Notes'],
['CHAR(n)','Fixed, up to 255','Padded with spaces and trimmed on read. Good for fixed codes such as country'],
['VARCHAR(n)','Variable, up to 65,535 bytes per row total','Stores a length prefix of 1 or 2 bytes. The default choice for names, emails'],
['TINYTEXT, TEXT, MEDIUMTEXT, LONGTEXT','Up to 255 B, 64 KB, 16 MB, 4 GB','Long text, usually stored off page. Cannot have a full default'],
['BINARY, VARBINARY','Like CHAR and VARCHAR','Raw bytes, no character set. Hashes, tokens'],
['TINYBLOB to LONGBLOB','Like TEXT sizes','Binary objects. Usually better stored as files with a path in the table'],
['ENUM(...)','One value from a list, stored as a small integer','Fixed set such as statuses. Changing the list needs ALTER'],
['SET(...)','Zero or more values from a list, stored as a bitmap','Rarely the best design. A child table is clearer']]},
{h:'VARCHAR length and characters'},
{p:'The length in `VARCHAR(n)` counts **characters**, not bytes. With `utf8mb4` each character takes up to 4 bytes, so a `VARCHAR(255)` can need up to 1,020 bytes. This matters for the maximum row size and for index limits (3,072 bytes for a regular index in InnoDB DYNAMIC rows).'},
{code:`CREATE TABLE users (
  id      INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  country CHAR(2)       NOT NULL,        -- ISO code, always 2 chars
  email   VARCHAR(255)  NOT NULL,
  status  ENUM('new','active','blocked') NOT NULL DEFAULT 'new',
  bio     TEXT
);`},
{h:'CHAR versus VARCHAR'},
{ul:['Use **CHAR** only when every value has the same length.','Use **VARCHAR** otherwise, sized to a realistic maximum, not 255 by habit.','A very oversized VARCHAR is harmless for storage but affects memory used for sorting and temporary tables, which size by the declared maximum.']},
{h:'ENUM caution'},
{p:'ENUM values are stored as numbers, and sorting uses the **list position**, not the text. Adding a value at the end is an instant change, but reordering or inserting in the middle rebuilds data. For lists that change, use a small lookup table with a foreign key.'},
{h:'TEXT and BLOB'},
{ul:['Keep large values out of tables that are scanned often, or put them in a separate table.','Index only a prefix: `INDEX (bio(100))`.','Do not use SELECT star on tables with big TEXT or BLOB columns if you do not need them.']}],
src:[['String data types',K.D+'string-types.html'],['The CHAR and VARCHAR types',K.D+'char.html']]};

/* ---------- 4 ---------- */
L['mysql:1:4']={blocks:[
{p:'A **character set** defines which characters can be stored and how they are encoded as bytes. A **collation** defines how characters compare and sort. Almost every garbled text, "Illegal mix of collations" error and slow comparison traces back to these two settings.'},
{h:'Use utf8mb4'},
{p:'`utf8mb4` is the real UTF-8 and stores every Unicode character, including emoji. The older name `utf8` (utf8mb3) is a three-byte subset and is deprecated. Since MySQL 8.0 the default is `utf8mb4` with the collation `utf8mb4_0900_ai_ci`.'},
{t:[['Part of the name','Meaning'],
['utf8mb4','Character set'],
['0900','Based on Unicode 9.0 rules (accurate, fast)'],
['ai','Accent insensitive: e equals é'],
['ci','Case insensitive: a equals A'],
['bin or _as_cs','Binary or accent and case sensitive']]},
{code:`SELECT 'a' = 'A';                         -- 1 with a _ci collation
SELECT 'a' COLLATE utf8mb4_0900_as_cs = 'A';   -- 0, forced case sensitive
SHOW CHARACTER SET LIKE 'utf8%';
SHOW COLLATION WHERE Charset = 'utf8mb4' AND Collation LIKE '%0900%';`},
{h:'Where character sets are set'},
{flow:['Server default: character_set_server and collation_server','Database default: CREATE DATABASE ... CHARACTER SET','Table default: CREATE TABLE ... DEFAULT CHARSET','Column setting overrides the table default','The connection has its own character set for what the client sends and receives']},
{p:'The most common production bug is a **connection** set to latin1 while data is utf8mb4. The bytes arrive wrongly encoded and are stored garbled. Configure the connection to use utf8mb4 as well.'},
{code:`SHOW VARIABLES LIKE 'character_set%';
SHOW VARIABLES LIKE 'collation%';
SET NAMES utf8mb4;       -- sets the three connection variables`},
{h:'Collation conflicts'},
{p:'Comparing columns that have different collations raises an error such as *Illegal mix of collations*. Fix the schema so related columns agree. In an emergency, add `COLLATE` to the expression. This is also a hidden cause of slow joins: when collations differ an index on one side may not be usable.'},
{h:'Converting'},
{code:`ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`},
{note:'Converting rebuilds the table and can change index sizes. Test on a copy and check that no data was already double encoded before converting.'}],
src:[['Character sets and collations',K.D+'charset.html'],['Unicode support',K.D+'charset-unicode.html']]};

/* ---------- 5 ---------- */
L['mysql:1:5']={blocks:[
{p:'Date and time handling is where subtle bugs hide, especially across time zones. Know what each type stores and which one to use.'},
{h:'The types'},
{t:[['Type','Stores','Range','Time zone aware'],
['DATE','Year, month, day','1000-01-01 to 9999-12-31','No'],
['TIME','Hours, minutes, seconds','-838:59:59 to 838:59:59 (also durations)','No'],
['DATETIME','Date and time','1000-01-01 to 9999-12-31','No, stored as written'],
['TIMESTAMP','Date and time as UTC seconds','1970-01-01 00:00:01 to 2038-01-19 UTC','Yes, converted by session time zone'],
['YEAR','A year','1901 to 2155','No']]},
{p:'Any of DATETIME, TIMESTAMP and TIME can carry **fractional seconds**, declared with a precision from 0 to 6: `DATETIME(3)` stores milliseconds.'},
{svg:tzflow},
{h:'DATETIME or TIMESTAMP'},
{ul:['**TIMESTAMP** stores an instant. Good for created and updated times. It converts to the session time zone on the way in and out. Its range ends in **2038**, which matters for long-lived data such as expiry dates.','**DATETIME** stores a calendar value exactly as written. Good for future events such as a booking at 09:00 local time, and for dates past 2038.','Many teams store everything in UTC and convert in the application. Whatever you choose, use one rule everywhere.']},
{h:'Automatic initialisation and update'},
{code:`CREATE TABLE posts (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  title      VARCHAR(200) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
             ON UPDATE CURRENT_TIMESTAMP(3)
);`},
{h:'Time zones'},
{code:`SELECT @@global.time_zone, @@session.time_zone, NOW(), UTC_TIMESTAMP();
SET time_zone = '+00:00';                     -- offset, always available
SET time_zone = 'Europe/Berlin';              -- named zone, needs time zone tables loaded
SELECT CONVERT_TZ('2026-03-29 02:30:00', 'UTC', 'Asia/Kolkata');`},
{p:'Named zones work only after the time zone tables are loaded (`mysql_tzinfo_to_sql`), except on many container and cloud images that do this for you. The server default is `SYSTEM`, the host zone, which is a frequent source of differences between servers.'},
{note:'Do not store dates as strings or as plain integers unless you have a reason. The date types allow validation, date arithmetic and efficient indexing.'}],
src:[['Date and time data types',K.D+'date-and-time-types.html'],['Time zone support',K.D+'time-zone-support.html']]};

/* ---------- 6 ---------- */
L['mysql:1:6']={blocks:[
{p:'The **JSON** type stores a JSON document in a column. The server validates the document on insert, stores it in an efficient binary format and offers functions to read and change parts of it. It is useful for flexible, sparsely used attributes, not as a replacement for a proper schema.'},
{code:`CREATE TABLE events (
  id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind    VARCHAR(40) NOT NULL,
  payload JSON NOT NULL
);

INSERT INTO events (kind, payload) VALUES
 ('signup', '{"user": "ana", "plan": "pro", "tags": ["beta", "eu"]}');

SELECT payload->'$.user'          AS quoted,
       payload->>'$.user'         AS plain,
       payload->>'$.tags[0]'      AS first_tag
FROM events;`},
{p:'The `->` operator extracts a JSON value, and `->>` extracts and unquotes it to text. `$` is the document root and `.key` and `[n]` navigate into it. Section 6 covers JSON functions in depth.'},
{h:'Properties'},
{ul:['Invalid JSON is rejected with an error.','Object keys are sorted and duplicate keys keep the last value, so the stored text can differ from what you inserted.','The maximum size is limited by `max_allowed_packet` (64 MB default).','You cannot index a JSON column directly. Index a generated column from a path, or a multi-valued index for arrays.','A partial update with JSON_SET or JSON_REPLACE can be logged and applied efficiently, but only when conditions are met.']},
{h:'When JSON fits and when it does not'},
{t:[['Good fit','Poor fit'],
['Optional attributes that vary by row','Core fields you filter, join and sort on every time'],
['Storing an external API payload for reference','Data that needs foreign keys and constraints'],
['Settings and preferences per user','Counters and amounts updated frequently'],
['Event details of different shapes','Large documents read only in small parts all the time']]},
{note:'A common pattern: keep the identifying and frequently filtered fields as real columns and put the rest in JSON. Promote a JSON field to a column when it becomes important.'}],
src:[['The JSON data type',K.D+'json.html'],['JSON functions',K.D+'json-function-reference.html']]};

/* ---------- 7 ---------- */
L['mysql:1:7']={blocks:[
{p:'Three small features decide what a column holds when you do not supply a value: **NULL**, **DEFAULT** and **AUTO_INCREMENT**.'},
{h:'NULL means unknown'},
{p:'`NULL` is not zero, not an empty string and not false. It means *no value, unknown*. Columns allow NULL unless declared `NOT NULL`. The next section shows that comparisons with NULL return NULL, which needs special handling.'},
{ul:['Declare columns `NOT NULL` whenever a value is always required. It documents intent and avoids special cases.','Allow NULL when absence has meaning, for example `ended_at` for something still running.','Primary key columns can never be NULL. UNIQUE indexes allow multiple NULLs.']},
{h:'DEFAULT'},
{code:`CREATE TABLE tickets (
  id        INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  title     VARCHAR(200) NOT NULL,
  priority  TINYINT NOT NULL DEFAULT 3,
  status    VARCHAR(20) NOT NULL DEFAULT 'open',
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  token     CHAR(36) NOT NULL DEFAULT (UUID())        -- expression default, 8.0.13+
);

INSERT INTO tickets (title) VALUES ('Printer is down');   -- all other columns use defaults`},
{p:'Since 8.0.13 a default may be an **expression** in parentheses. Before that only constants and `CURRENT_TIMESTAMP` were allowed. TEXT, BLOB, JSON and GEOMETRY columns can use only expression defaults.'},
{h:'AUTO_INCREMENT'},
{p:'An `AUTO_INCREMENT` column generates the next integer when you insert without a value. It must be indexed, usually as the primary key, and a table can have only one.'},
{code:`INSERT INTO tickets (title) VALUES ('A'), ('B');
SELECT LAST_INSERT_ID();                  -- first id generated by this connection
SHOW CREATE TABLE tickets\\G              -- shows AUTO_INCREMENT=next value`},
{h:'What to expect'},
{ul:['**Gaps are normal.** Rolled back transactions, failed inserts and bulk inserts consume numbers.','The counter is **per table**, and from 8.0 it survives a restart (it was stored only in memory before).','`LAST_INSERT_ID()` is per connection, so other sessions inserting at the same time do not affect it.','`innodb_autoinc_lock_mode` controls locking. The default (2, interleaved) gives the best concurrency with row-based replication.','When the column reaches its maximum, the next insert fails with a duplicate key error. Use a large enough type.']},
{note:'Do not rely on AUTO_INCREMENT values being consecutive or reflecting time order across servers. If you need a gapless number such as an invoice number, generate it in a controlled way.'}],
src:[['Handling of NULL',K.D+'working-with-null.html'],['Data type default values',K.D+'data-type-defaults.html'],['AUTO_INCREMENT',K.D+'example-auto-increment.html']]};

/* ---------- 8 ---------- */
L['mysql:1:8']={blocks:[
{p:'**Constraints** are rules the database enforces itself, whatever application writes the data. They are your last line of defence against bad data, and declaring them also documents the model.'},
{t:[['Constraint','Enforces','On violation'],
['NOT NULL','A value is required','Error 1048'],
['PRIMARY KEY','Unique and not null, one per table','Error 1062 duplicate entry'],
['UNIQUE','No duplicates (NULLs allowed)','Error 1062'],
['CHECK','A condition on the row is true','Error 3819 (8.0.16 and later)'],
['FOREIGN KEY','A reference exists in the parent table','Error 1452, or 1451 when deleting a parent'],
['DEFAULT','A value when none is given','Not a restriction, but a rule']]},
{code:`CREATE TABLE orders (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  total       DECIMAL(12,2) NOT NULL,
  status      VARCHAR(20)   NOT NULL DEFAULT 'new',
  CONSTRAINT ck_orders_total  CHECK (total >= 0),
  CONSTRAINT ck_orders_status CHECK (status IN ('new','paid','shipped','cancelled')),
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);`},
{h:'Foreign key actions'},
{t:[['ON DELETE or ON UPDATE','Behaviour when the parent row changes'],
['RESTRICT or NO ACTION','Refuse the change (default)'],
['CASCADE','Apply the change to child rows'],
['SET NULL','Set the child column to NULL (column must allow NULL)'],
['SET DEFAULT','Not supported by InnoDB']]},
{h:'Foreign key rules'},
{ul:['Both tables must use InnoDB. Other engines accept the syntax and ignore it.','Parent and child columns must have the same type, and the parent needs an index on them.','An index on the child column is created automatically if missing, and is needed for good performance on parent deletes.','Cascades are executed inside InnoDB and are not logged as separate statements, which can surprise triggers and replication.','Foreign keys add locking cost. Many large systems keep them anyway because integrity is cheaper than repair.']},
{note:'Before MySQL 8.0.16, `CHECK` was parsed but ignored. If you migrate old schemas, confirm that the checks you thought were active really are.'}],
src:[['Constraints',K.D+'constraints.html'],['FOREIGN KEY constraints',K.D+'create-table-foreign-keys.html'],['CHECK constraints',K.D+'create-table-check-constraints.html']]};

/* ---------- 9 ---------- */
L['mysql:1:9']={blocks:[
{p:'Requirements change, so tables change. `ALTER TABLE` adds, modifies and removes columns, indexes and constraints. How the server performs the change decides whether the table stays usable, so understand the **algorithms**.'},
{h:'Common changes'},
{code:`ALTER TABLE customers ADD COLUMN phone VARCHAR(30) NULL AFTER email;
ALTER TABLE customers MODIFY COLUMN name VARCHAR(150) NOT NULL;
ALTER TABLE customers CHANGE COLUMN phone mobile VARCHAR(30) NULL;   -- rename and retype
ALTER TABLE customers RENAME COLUMN mobile TO phone;
ALTER TABLE customers DROP COLUMN phone;
ALTER TABLE customers ADD INDEX idx_customers_name (name);
ALTER TABLE customers DROP INDEX idx_customers_name;
ALTER TABLE customers ADD CONSTRAINT ck_name CHECK (CHAR_LENGTH(name) > 0);
RENAME TABLE customers TO clients;`},
{p:'`MODIFY` and `CHANGE` replace the whole column definition. If you leave out `NOT NULL` or a default that was there, they are lost. Always restate the full definition.'},
{h:'DDL algorithms'},
{t:[['ALGORITHM','What happens','Typical examples'],
['INSTANT','Only metadata changes. No rebuild, no wait','ADD COLUMN (almost anywhere since 8.0.29), DROP COLUMN, rename, change default'],
['INPLACE','Changes data in place, concurrent DML usually allowed','ADD INDEX, ADD FOREIGN KEY with checks off, change NULL to NOT NULL needs rebuild'],
['COPY','Creates a new table, copies rows, swaps. Blocks writes','Changing column type, character set conversion, some changes needing a rebuild']]},
{code:`ALTER TABLE big_table ADD COLUMN flag TINYINT NOT NULL DEFAULT 0, ALGORITHM=INSTANT;
ALTER TABLE big_table ADD INDEX idx_x (x), ALGORITHM=INPLACE, LOCK=NONE;`},
{p:'Naming `ALGORITHM` and `LOCK` makes the statement **fail** instead of silently falling back to a heavier method. That is the safe way to run DDL on a large table in production.'},
{h:'Atomic DDL'},
{p:'In MySQL 8 DDL statements are **atomic**: a statement either completes fully or has no effect, even after a crash, because metadata is kept in transactional data dictionary tables. DDL still causes an **implicit commit** of the current transaction.'},
{h:'Before you alter a big table'},
{ul:['Check the algorithm in the manual for your exact change. Try it on a copy.','Watch for **metadata locks**: a long-running transaction can block the ALTER, and the waiting ALTER then blocks every new query on the table (section 10, lesson 7).','For changes that need COPY, consider an online schema change tool such as gh-ost or pt-online-schema-change (section 16).','Take a backup, or at least know your restore path.']}],
src:[['ALTER TABLE',K.D+'alter-table.html'],['Online DDL operations',K.D+'innodb-online-ddl-operations.html']]};
})();
