/* LearnSphere - MySQL, Section 05: Changing Data & Basic Transactions.
   Lectures 0-6 are core. Needs mysql-common.js. */
(function(){
const K=window.MY,L=window.LESSONS;

const remove=K.dg(700,200,[
[10,10,680,180,'Three ways to remove data',1],
[25,50,200,110,'DELETE|DML, row by row|WHERE allowed|can roll back|counter kept',0],[250,50,200,110,'TRUNCATE|DDL, rebuilds table|no WHERE|implicit commit|counter reset',2],[475,50,200,110,'DROP TABLE|DDL, removes the table|structure and data|implicit commit|gone',0]],[]);

const tx=K.dg(700,170,[
[10,10,680,150,'A transaction',1],
[25,60,120,50,'START|TRANSACTION',0],[175,60,150,50,'Statements|change data',2],[355,60,130,50,'COMMIT|make permanent',0],[515,60,150,50,'ROLLBACK|undo everything',0]],
[[145,85,175,85],[325,85,355,85],[325,85,515,85]]);

/* ---------- 0 ---------- */
L['mysql:4:0']={blocks:[
{p:'`INSERT` adds rows. The statement has three common shapes: explicit values, many rows at once and rows copied from a query.'},
{code:`-- one row, naming the columns
INSERT INTO customers (name, city, country) VALUES ('Gus', 'Madrid', 'ES');

-- several rows in one statement
INSERT INTO customers (name, city, country) VALUES
  ('Hana', 'Lyon', 'FR'),
  ('Ivo',  NULL,   'PT');

-- from a query
INSERT INTO archived_orders (id, customer_id, order_date, status, total)
SELECT id, customer_id, order_date, status, total
FROM orders WHERE order_date < '2026-02-01';`},
{h:'Good habits'},
{ul:['**Always list the columns.** `INSERT INTO t VALUES (...)` breaks when the table gains a column.','Omitted columns get their `DEFAULT`, or NULL if the column allows it. A NOT NULL column without a default is an error in strict mode.','Use `DEFAULT` to ask for the default explicitly: `VALUES (DEFAULT, \'x\')`.','Read the generated id with `LAST_INSERT_ID()` on the same connection.']},
{h:'Bulk insert performance'},
{t:[['Technique','Why it helps'],
['Multi-row INSERT (hundreds to a few thousand rows)','Fewer round trips and parses than one statement per row'],
['Wrap many inserts in one transaction','One commit and one log flush instead of one per row'],
['LOAD DATA (lesson 5)','The fastest way to load files'],
['Load first, add secondary indexes afterwards for huge loads','Less index maintenance while loading'],
['Insert in primary key order','Fills pages sequentially and avoids splits']]},
{p:'A row-by-row loop with autocommit on is the slowest way: each statement is its own transaction and waits for a log flush. Batch the work and commit in sensible chunks.'},
{h:'Errors and warnings'},
{code:`INSERT INTO customers (name, country) VALUES ('Jo', 'GERMANY');
-- strict mode: ERROR 1406 Data too long for column country at row 1
SHOW WARNINGS;`},
{note:'A multi-row INSERT is atomic in InnoDB: if one row fails, none are inserted (unless you use IGNORE).'}],
src:[['INSERT statement',K.D+'insert.html'],['Optimizing INSERT statements',K.D+'insert-optimization.html']]};

/* ---------- 1 ---------- */
L['mysql:4:1']={blocks:[
{p:'`UPDATE` and `DELETE` change existing rows. The `WHERE` clause chooses which. Forgetting it changes **every** row. These statements need the most care in the whole language.'},
{code:`UPDATE products SET price = price * 1.05 WHERE category = 'accessories';
UPDATE orders SET status = 'shipped', total = total + 5 WHERE id = 4;   -- several columns
DELETE FROM order_items WHERE order_id = 4;
DELETE FROM orders WHERE status = 'cancelled' ORDER BY order_date LIMIT 100;`},
{h:'A safe routine'},
{flow:['Write the WHERE as a SELECT first and check the rows it returns','Check the row count you expect (`SELECT COUNT(*) ...`)','Run the change inside a transaction','Check `ROW_COUNT()` or the "rows affected" message','COMMIT only when it matches your expectation, otherwise ROLLBACK']},
{code:`START TRANSACTION;
UPDATE orders SET status = 'paid' WHERE id = 4;
SELECT ROW_COUNT();             -- 1 expected
SELECT * FROM orders WHERE id = 4;
COMMIT;                          -- or ROLLBACK;`},
{h:'Rows matched versus changed'},
{p:'MySQL reports *rows matched* and *rows changed*. An UPDATE that sets a column to the value it already has matches the row but does not change it, so "changed" is lower. Use the `CLIENT_FOUND_ROWS` connector flag if your application needs the matched count.'},
{h:'Safety nets'},
{ul:['`--safe-updates` (or `SET sql_safe_updates = 1`) rejects UPDATE and DELETE without a key column in WHERE or a LIMIT.','Application accounts should only have the privileges they need. Many do not need `DELETE`.','Big deletes: delete in **batches** with `LIMIT` and commit between them, so you hold locks briefly and keep the undo log and replication lag under control.','Prefer **soft delete** (a `deleted_at` column) when deleted data may need to be restored, and purge later.']},
{code:`-- batch delete loop: repeat until 0 rows affected
DELETE FROM events WHERE created_at < NOW() - INTERVAL 90 DAY LIMIT 5000;`},
{note:'`UPDATE ... ORDER BY ... LIMIT` and `DELETE ... ORDER BY ... LIMIT` are allowed in single-table statements. They are not safe for statement-based replication unless the order is fully deterministic.'}],
src:[['UPDATE statement',K.D+'update.html'],['DELETE statement',K.D+'delete.html']]};

/* ---------- 2 ---------- */
L['mysql:4:2']={blocks:[
{p:'An **upsert** inserts a row, or updates the existing one if a key conflict occurs. MySQL offers three variants with very different behaviour.'},
{t:[['Statement','On key conflict','Side effects'],
['`INSERT ... ON DUPLICATE KEY UPDATE`','Updates the existing row','Keeps the row, fires update logic, preserves other columns'],
['`REPLACE INTO`','Deletes the old row, then inserts a new one','Resets columns not given, new AUTO_INCREMENT, fires delete and insert triggers, cascades foreign keys'],
['`INSERT IGNORE`','Skips the row silently','Also downgrades other errors to warnings, which hides problems']]},
{h:'ON DUPLICATE KEY UPDATE'},
{code:`CREATE TABLE stock (
  product_id INT PRIMARY KEY,
  qty INT NOT NULL,
  updated_at DATETIME NOT NULL
);

INSERT INTO stock (product_id, qty, updated_at) VALUES (1, 10, NOW())
ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty), updated_at = NOW();

-- modern form with a row alias (8.0.19 and later). VALUES() is deprecated
INSERT INTO stock (product_id, qty, updated_at) VALUES (1, 10, NOW()) AS new
ON DUPLICATE KEY UPDATE qty = stock.qty + new.qty, updated_at = NOW();`},
{p:'The conflict can be on **any** unique index, not only the primary key. With several unique keys the statement may update a different row than you expect, so keep upsert tables to one clear unique key. Rows affected is 1 for an insert, 2 for an update and 0 when nothing changed.'},
{h:'REPLACE'},
{code:`REPLACE INTO stock (product_id, qty, updated_at) VALUES (1, 5, NOW());`},
{p:'REPLACE is easy to misuse. It deletes, so any column you omit is reset to its default, a new auto-increment value is generated if the key is not explicit, and child rows may be removed by `ON DELETE CASCADE`. Prefer ON DUPLICATE KEY UPDATE.'},
{h:'INSERT IGNORE'},
{p:'`IGNORE` turns many errors, including data truncation and invalid values, into warnings. It is acceptable for loading data that you expect to contain duplicates, but it can hide real problems. Always check `SHOW WARNINGS`.'},
{h:'Concurrency note'},
{p:'Upserts are safe to run from many sessions because the unique index makes the check and write one atomic step. They can still take **gap locks** and cause deadlocks under heavy parallel load (section 10).'}],
src:[['INSERT ... ON DUPLICATE KEY UPDATE',K.D+'insert-on-duplicate.html'],['REPLACE statement',K.D+'replace.html']]};

/* ---------- 3 ---------- */
L['mysql:4:3']={blocks:[
{p:'Sometimes the rows to change are chosen by another table. MySQL allows joins in `UPDATE` and `DELETE`, which is a common MySQL extension of standard SQL.'},
{h:'UPDATE with a join'},
{code:`-- mark paid orders from German customers as priority
ALTER TABLE orders ADD COLUMN priority TINYINT NOT NULL DEFAULT 0;

UPDATE orders o
JOIN customers c ON c.id = o.customer_id
SET o.priority = 1
WHERE c.country = 'DE' AND o.status = 'paid';

-- copy a value from another table
UPDATE order_items i
JOIN products p ON p.id = i.product_id
SET i.price = p.price
WHERE i.order_id = 4;`},
{h:'DELETE with a join'},
{code:`-- delete order items of cancelled orders
DELETE i
FROM order_items i
JOIN orders o ON o.id = i.order_id
WHERE o.status = 'cancelled';

-- delete from both tables in one statement (list both before FROM)
DELETE i, o
FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'cancelled';`},
{p:'The tables named between `DELETE` and `FROM` are the ones rows are removed from. Rows from tables only used in the join are left alone.'},
{h:'Restrictions'},
{ul:['**No `ORDER BY` or `LIMIT`** in the multi-table forms.','You cannot update a table that is read in a subquery of the same statement directly. Put the subquery in a derived table: `WHERE id IN (SELECT id FROM (SELECT ...) AS t)`.','With foreign keys, delete the child table rows first or use `ON DELETE CASCADE`.','The join must be sound: if several rows of the other table match, the update uses one of them in an unspecified order.']},
{h:'The portable alternative'},
{code:`UPDATE orders SET priority = 1
WHERE status = 'paid'
  AND customer_id IN (SELECT id FROM customers WHERE country = 'DE');

DELETE FROM order_items
WHERE order_id IN (SELECT id FROM orders WHERE status = 'cancelled');`},
{note:'Always preview multi-table changes by turning the statement into a SELECT with the same joins and WHERE and checking the rows first.'}],
src:[['UPDATE statement',K.D+'update.html'],['DELETE statement',K.D+'delete.html']]};

/* ---------- 4 ---------- */
L['mysql:4:4']={blocks:[
{p:'`DELETE`, `TRUNCATE` and `DROP` all remove data, but they differ in speed, locking, rollback and what remains.'},
{svg:remove},
{t:[['Feature','DELETE','TRUNCATE TABLE','DROP TABLE'],
['Removes','Selected or all rows','All rows','Rows, table, indexes, triggers'],
['WHERE clause','Yes','No','No'],
['Statement type','DML','DDL','DDL'],
['Rollback','Yes, in a transaction','No, implicit commit','No'],
['Speed on big tables','Slow, per-row work and undo','Fast, drops and recreates','Fast'],
['AUTO_INCREMENT','Not reset','Reset to 1','Gone'],
['Triggers','ON DELETE triggers run','Do not run','Do not run'],
['Foreign keys','Honoured','Refused if referenced by a foreign key','Refused if referenced'],
['Table structure','Kept','Kept','Removed']]},
{code:`DELETE FROM log_entries;            -- row by row, can roll back, large undo
TRUNCATE TABLE log_entries;          -- fast reset
DROP TABLE log_entries;              -- table gone
DROP TABLE IF EXISTS log_entries;`},
{h:'How to choose'},
{ul:['Remove some rows: **DELETE** with WHERE, in batches when the set is large.','Empty a whole table and you do not need to roll back: **TRUNCATE**.','Get rid of the table: **DROP**. Take a backup first on anything that matters.','Regularly remove old data by time: consider **partitioning** by date so you can drop an old partition instead of deleting rows (section 16).']},
{h:'Space and locking'},
{p:'A `DELETE` marks rows as deleted but the file does not shrink. The free space inside the tablespace is reused by later inserts, and `OPTIMIZE TABLE` (or `ALTER TABLE ... ENGINE=InnoDB`) rebuilds the table to give space back. `TRUNCATE` and `DROP` free the space immediately for file-per-table tablespaces.'},
{note:'`TRUNCATE` and `DROP` take a metadata lock on the table. A long running transaction that touched the table will block them, and then block everyone behind them. Section 10 covers metadata locks.'}],
src:[['TRUNCATE TABLE',K.D+'truncate-table.html'],['DROP TABLE',K.D+'drop-table.html']]};

/* ---------- 5 ---------- */
L['mysql:4:5']={blocks:[
{p:'Data often arrives as files. `LOAD DATA` reads a text file straight into a table and is typically many times faster than inserting row by row. `SELECT ... INTO OUTFILE` writes query results to a file on the server.'},
{h:'LOAD DATA'},
{code:`LOAD DATA INFILE '/var/lib/mysql-files/customers.csv'
INTO TABLE customers
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\\n'
IGNORE 1 LINES
(name, city, country);

-- file on the client machine
LOAD DATA LOCAL INFILE '/home/me/customers.csv' INTO TABLE customers
FIELDS TERMINATED BY ',' IGNORE 1 LINES (name, city, country);`},
{ul:['`INFILE` reads a file **on the server**. `LOCAL INFILE` reads one on the client and sends it. LOCAL is disabled by default for security and needs `local_infile=ON` on both sides.','The server may read and write only inside the directory in **`secure_file_priv`**. Check it with `SELECT @@secure_file_priv`. If it is NULL, import and export through files are disabled.','The `FILE` privilege is needed for the server-side forms.','Use `SET col = expression` to transform values, and user variables to skip columns in the file.']},
{code:`LOAD DATA INFILE '/var/lib/mysql-files/prices.csv' INTO TABLE products
FIELDS TERMINATED BY ','
(name, category, @price)
SET price = NULLIF(@price, '');`},
{h:'Export'},
{code:`SELECT id, name, country
FROM customers
INTO OUTFILE '/var/lib/mysql-files/customers_out.csv'
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\\n';`},
{p:'The statement fails if the file already exists, and the file is created by the server process, owned by the MySQL user, not by you.'},
{h:'Speeding up large loads'},
{ul:['Load in primary key order and inside a transaction, or load into a table without secondary indexes and add them after.','Temporarily relax checks **only** when you trust the data: `SET unique_checks=0; SET foreign_key_checks=0;`. Turn them back on afterwards.','For very large imports use MySQL Shell `util.importTable()`, which loads in parallel, or restore from a dump with `util.loadDump()`.']},
{note:'Treat imported files as untrusted. Load into a staging table first, validate and clean the data with SQL, then insert into the real table.'}],
src:[['LOAD DATA',K.D+'load-data.html'],['secure_file_priv',K.D+'server-system-variables.html#sysvar_secure_file_priv']]};

/* ---------- 6 ---------- */
L['mysql:4:6']={blocks:[
{p:'A **transaction** groups statements so that they succeed or fail **together**. Moving money between two accounts is the classic case: debit and credit must both happen, or neither. This lesson covers the commands. Sections 9 and 10 explain how InnoDB makes them work.'},
{svg:tx},
{code:`START TRANSACTION;                 -- or BEGIN
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;                            -- both changes become permanent

START TRANSACTION;
DELETE FROM orders WHERE id = 7;
ROLLBACK;                          -- as if it never happened`},
{h:'Autocommit'},
{p:'By default `autocommit = 1`: every statement is its own transaction and is committed as soon as it finishes. `START TRANSACTION` switches to explicit mode until you `COMMIT` or `ROLLBACK`. `SET autocommit = 0` makes the session keep a transaction open all the time, which is a common cause of forgotten open transactions.'},
{h:'Savepoints'},
{code:`START TRANSACTION;
INSERT INTO orders (customer_id, order_date, status, total) VALUES (1, CURDATE(), 'new', 50);
SAVEPOINT after_order;
INSERT INTO order_items (order_id, product_id, qty, price) VALUES (LAST_INSERT_ID(), 99, 1, 10);   -- fails
ROLLBACK TO SAVEPOINT after_order;       -- keep the order, undo only the item
COMMIT;`},
{h:'What cannot be rolled back'},
{ul:['**DDL** such as CREATE, ALTER, DROP and TRUNCATE causes an **implicit commit**. Anything before it is committed.','Changes in non-transactional engines such as MyISAM and MEMORY.','Operations outside the database: files written, emails sent.','Sequence values: AUTO_INCREMENT numbers consumed by a rolled back insert are not returned.']},
{h:'Rules of thumb'},
{ul:['Keep transactions **short**. They hold locks until they end.','Never leave a transaction open while waiting for a user or a slow external call.','Handle errors: on failure, `ROLLBACK` and decide whether to retry. A deadlock error (1213) is a signal to retry.','A connection closing without COMMIT rolls the transaction back.']},
{note:'Reading data inside a transaction also depends on the isolation level. That is covered in section 10. The default for InnoDB is REPEATABLE READ.'}],
src:[['START TRANSACTION, COMMIT and ROLLBACK',K.D+'commit.html'],['Savepoints',K.D+'savepoint.html'],['Statements that cause implicit commit',K.D+'implicit-commit.html']]};
})();
