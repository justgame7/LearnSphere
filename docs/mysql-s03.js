/* LearnSphere - MySQL, Section 03: Querying Data with SELECT.
   Lectures 0-7 are core. Needs mysql-common.js. Uses the shop sample database defined in lecture 0. */
(function(){
const K=window.MY,L=window.LESSONS;

const sample=K.dg(700,210,[
[10,10,680,190,'The shop sample database used in sections 3 to 6',1],
[25,45,145,90,'customers|id, name,|city, country',0],[190,45,145,90,'orders|id, customer_id,|order_date,|status, total',2],[355,45,145,90,'order_items|order_id,|product_id,|qty, price',0],[520,45,145,90,'products|id, name,|category, price',0],
[25,152,640,36,'orders.customer_id points to customers.id. order_items links orders to products.',0]],
[[190,90,170,90],[335,90,355,90],[500,90,520,90]]);

const order=K.dg(700,170,[
[10,10,680,150,'Logical processing order',1],
[20,60,90,50,'FROM|JOIN',0],[125,60,70,50,'WHERE',0],[210,60,90,50,'GROUP BY',0],[315,60,80,50,'HAVING',0],[410,60,90,50,'SELECT',2],[515,60,80,50,'ORDER BY',0],[610,60,70,50,'LIMIT',0]],
[[110,85,125,85],[195,85,210,85],[300,85,315,85],[395,85,410,85],[500,85,515,85],[595,85,610,85]]);

/* ---------- 0 ---------- */
L['mysql:2:0']={blocks:[
{p:'`SELECT` reads data. Every query has the same shape: choose columns, say where they come from, and optionally filter, group and sort. First, set up the sample data used by the next four sections so you can run every example.'},
{svg:sample},
{code:`CREATE DATABASE shop CHARACTER SET utf8mb4;
USE shop;

CREATE TABLE customers (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL, city VARCHAR(100), country CHAR(2) NOT NULL);
CREATE TABLE products (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL, category VARCHAR(40) NOT NULL, price DECIMAL(10,2) NOT NULL);
CREATE TABLE orders (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL, order_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL, total DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id));
CREATE TABLE order_items (
  order_id INT UNSIGNED NOT NULL, product_id INT UNSIGNED NOT NULL,
  qty INT NOT NULL, price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (order_id, product_id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id));

INSERT INTO customers VALUES (1,'Ana','Berlin','DE'),(2,'Ben','Paris','FR'),(3,'Chen','Berlin','DE'),
  (4,'Dara','Dublin','IE'),(5,'Eli',NULL,'US'),(6,'Fay','Paris','FR');
INSERT INTO products VALUES (1,'Keyboard','accessories',49.90),(2,'Mouse','accessories',19.90),
  (3,'Monitor','displays',189.00),(4,'Laptop','computers',899.00),(5,'Cable','accessories',4.50),
  (6,'Dock','accessories',129.00);
INSERT INTO orders VALUES (1,1,'2026-01-05','paid',89.70),(2,2,'2026-01-09','paid',189.00),
  (3,1,'2026-02-01','shipped',912.50),(4,3,'2026-02-03','cancelled',49.90),
  (5,4,'2026-02-10','paid',148.90),(6,2,'2026-03-02','shipped',238.90),(7,1,'2026-03-15','paid',19.90);
INSERT INTO order_items VALUES (1,1,1,49.90),(1,2,2,19.90),(2,3,1,189.00),(3,4,1,899.00),(3,5,3,4.50),
  (4,1,1,49.90),(5,6,1,129.00),(5,2,1,19.90),(6,3,1,189.00),(6,1,1,49.90),(7,2,1,19.90);`},
{p:'Customers 5 and 6 have no orders, and customer 5 has no city. Those gaps are deliberate: they make joins and NULL behaviour visible later.'},
{h:'The shape of a SELECT'},
{code:`SELECT   columns or expressions
FROM     table
WHERE    row filter
GROUP BY grouping columns
HAVING   group filter
ORDER BY sort columns
LIMIT    row count;`},
{p:'Only `SELECT` is required to evaluate an expression (`SELECT 1 + 1`). Everything else is optional, but the **order** of the clauses is fixed.'},
{h:'Selecting columns'},

{p:'The select list decides which **columns** appear in the result. It can contain column names, constants, expressions and function calls, each with an optional alias.'},
{code:`SELECT name, city FROM customers;
SELECT name AS customer, UPPER(country) AS country_code FROM customers;
SELECT name, price, price * 1.19 AS price_with_tax FROM products;
SELECT 1 + 1 AS two, NOW() AS server_time;`},
{h:'Aliases'},
{ul:['`AS` is optional but makes intent clear: `SELECT price * qty AS line_total`.','Use quotes for an alias with spaces: `AS \'Line Total\'`.','Table aliases shorten joins: `FROM orders AS o`. They are required for self joins and derived tables.']},
{h:'Expressions'},
{t:[['Kind','Examples'],
['Arithmetic','`+ - * / DIV %`. Note `/` returns a decimal and `DIV` is integer division'],
['String','`CONCAT(name, \' from \', city)`'],
['Date','`DATEDIFF(NOW(), order_date)`'],
['Conditional','`IF(total > 100, \'large\', \'small\')`']]},
{h:'Do not default to SELECT star'},
{p:'`SELECT *` is handy for exploring, but in application code it causes problems.'},
{ul:['It reads columns you do not need, including large TEXT and BLOB values, so more data travels and more memory is used.','It prevents the optimizer from using a **covering index** (section 11).','Adding a column to a table can change or break code that relied on the column order.']},
{code:`-- exploring: fine
SELECT * FROM orders LIMIT 5;
-- application code: name the columns
SELECT id, customer_id, order_date, total FROM orders;`},
{h:'Literals and quoting'},
{t:[['Quote','Meaning'],
['\'text\'','String literal. Use two quotes to embed one: \'it\'\'s\''],
['"text"','Also a string by default, but an identifier if ANSI_QUOTES is on. Prefer single quotes'],
['`name`','Backticks quote an identifier such as a reserved word']]},
{note:'`SELECT 10 / 4` returns 2.5000 and `SELECT 10 DIV 4` returns 2. Dividing by zero returns NULL, or an error in strict mode for data changes. See the SQL mode lesson.'}],
src:[['SELECT',K.D+'select.html'],['Expressions',K.D+'expressions.html']]};

/* ---------- 2 ---------- */
L['mysql:2:1']={blocks:[
{p:'`WHERE` keeps only the rows for which its condition is **true**. Rows where the condition is false or unknown (NULL) are dropped.'},
{h:'Comparison and logical operators'},
{t:[['Operator','Example','Meaning'],
['= <> != < <= > >=','`total >= 100`','Compare. `<>` and `!=` both mean not equal'],
['AND, OR, NOT','`status = \'paid\' AND total > 100`','Combine conditions'],
['IN (...)','`country IN (\'DE\',\'FR\')`','Equal to any in a list'],
['BETWEEN a AND b','`order_date BETWEEN \'2026-02-01\' AND \'2026-02-28\'`','Inclusive range'],
['LIKE','`name LIKE \'A%\'`','Pattern: % any string, _ one character'],
['IS NULL, IS NOT NULL','`city IS NULL`','The only way to test for NULL'],
['REGEXP','`name REGEXP \'^[A-C]\'`','Regular expression match']]},
{code:`SELECT * FROM orders WHERE status = 'paid' AND total > 100;
SELECT * FROM customers WHERE country IN ('DE','FR') AND city IS NOT NULL;
SELECT * FROM orders WHERE order_date >= '2026-02-01' AND order_date < '2026-03-01';
SELECT * FROM customers WHERE name LIKE '_a%';`},
{h:'Precedence'},
{p:'`AND` binds tighter than `OR`. Without parentheses, `a OR b AND c` means `a OR (b AND c)`. Use parentheses whenever you mix them.'},
{code:`-- Probably not what you meant: returns every DE customer plus all FR customers in Paris
SELECT * FROM customers WHERE country = 'DE' OR country = 'FR' AND city = 'Paris';
-- Clear intent:
SELECT * FROM customers WHERE (country = 'DE' OR country = 'FR') AND city = 'Paris';`},
{h:'Writing predicates that can use indexes'},
{ul:['Prefer ranges for dates: `order_date >= \'2026-02-01\' AND order_date < \'2026-03-01\'` instead of `MONTH(order_date) = 2`, which hides the column inside a function.','`LIKE \'abc%\'` can use an index. `LIKE \'%abc\'` cannot, as the prefix is unknown.','Compare columns to values of the same type to avoid implicit conversion.']},
{note:'`BETWEEN` includes both ends. With DATETIME columns `BETWEEN \'2026-02-01\' AND \'2026-02-28\'` stops at midnight on the 28th and misses the rest of that day. Use a half-open range instead.'}],
src:[['Comparison functions and operators',K.D+'comparison-operators.html'],['Pattern matching',K.D+'pattern-matching.html']]};

/* ---------- 3 ---------- */
L['mysql:2:2']={blocks:[
{p:'Relational results have **no guaranteed order** unless you ask for one. `ORDER BY` sorts, `LIMIT` restricts how many rows return, and `OFFSET` skips rows.'},
{code:`SELECT name, price FROM products ORDER BY price DESC;
SELECT name, category, price FROM products ORDER BY category ASC, price DESC;
SELECT * FROM orders ORDER BY order_date DESC LIMIT 3;          -- top 3 latest
SELECT * FROM orders ORDER BY id LIMIT 3 OFFSET 3;              -- rows 4 to 6
SELECT * FROM orders ORDER BY id LIMIT 3, 3;                    -- same, older syntax: offset, count`},
{h:'Rules'},
{ul:['`ASC` is the default. Each column in the sort list can have its own direction.','You can sort by an alias, by position (`ORDER BY 2`, avoid it) or by an expression.','NULLs sort **first** in ascending order and last in descending order in MySQL. There is no NULLS FIRST or LAST. Use `ORDER BY col IS NULL, col` to push NULLs last.','`LIMIT` without `ORDER BY` returns arbitrary rows. They may change between runs.','If the sort column has ties, add a unique column such as the id to make the order **deterministic**: `ORDER BY order_date DESC, id DESC`.']},
{h:'Top-N'},
{code:`-- the three most expensive products
SELECT name, price FROM products ORDER BY price DESC LIMIT 3;`},
{p:'When an index matches the order, MySQL reads the first N index entries and stops. Without a matching index it must **sort** (filesort), which is expensive for big result sets.'},
{h:'The cost of OFFSET'},
{p:'`OFFSET 100000` still reads and discards 100,000 rows before returning the page. Deep pagination gets slower the further you go. A **keyset** (seek) approach remembers the last value seen:'},
{code:`-- page after the last row seen (order_date, id) = ('2026-02-03', 4)
SELECT id, order_date, total FROM orders
WHERE (order_date, id) > ('2026-02-03', 4)
ORDER BY order_date, id
LIMIT 20;`},
{note:'A stable order is a correctness issue, not only a performance one. Without a deterministic ORDER BY, pagination can show the same row twice or skip rows.'}],
src:[['ORDER BY optimization',K.D+'order-by-optimization.html'],['LIMIT query optimization',K.D+'limit-optimization.html']]};

/* ---------- 4 ---------- */
L['mysql:2:3']={blocks:[
{p:'**NULL** means unknown, so SQL uses **three-valued logic**: an expression can be true, false or *unknown*. Most surprises come from forgetting the third value.'},
{t:[['Expression','Result'],
['`NULL = NULL`','NULL (unknown), not true'],
['`NULL <> 5`','NULL'],
['`NULL IS NULL`','1 (true)'],
['`NULL <=> NULL`','1. The null-safe equal operator'],
['`1 + NULL`','NULL'],
['`NULL AND false`','0 (false), since the result is false whatever the unknown is'],
['`NULL OR true`','1 (true)'],
['`5 NOT IN (1, NULL)`','NULL, so the row is not returned']]},
{h:'Consequences'},
{code:`SELECT * FROM customers WHERE city = NULL;       -- never matches
SELECT * FROM customers WHERE city IS NULL;      -- Eli
SELECT * FROM customers WHERE city <> 'Paris';   -- Eli is NOT returned either
SELECT * FROM customers WHERE city <> 'Paris' OR city IS NULL;`},
{p:'`WHERE` keeps only rows whose condition is **true**, so a NULL comparison removes the row. Be explicit about what you want for rows with a missing value.'},
{h:'NULL in other clauses'},
{ul:['**Aggregates** ignore NULL, except `COUNT(*)`. `AVG(col)` averages only non-null values.','**GROUP BY** puts all NULLs in one group. **DISTINCT** treats NULLs as equal to each other.','**UNIQUE** indexes allow several NULLs. **ORDER BY** places NULLs first in ascending order.']},
{h:'DISTINCT'},
{code:`SELECT DISTINCT country FROM customers;
SELECT DISTINCT country, city FROM customers;         -- distinct pairs
SELECT COUNT(DISTINCT country) FROM customers;`},
{p:'`DISTINCT` removes duplicate **rows** of the whole select list. It is not a function of one column. It often needs a sort or a temporary table, so use it deliberately and not to hide an accidental duplicate from a bad join.'},
{h:'Handling NULL'},
{code:`SELECT name, IFNULL(city, 'unknown') AS city FROM customers;
SELECT name, COALESCE(city, country, 'n/a') AS place FROM customers;   -- first non-null
SELECT NULLIF(status, '') FROM orders;                                  -- empty string to NULL`}],
src:[['Working with NULL',K.D+'working-with-null.html'],['DISTINCT optimization',K.D+'distinct-optimization.html']]};

/* ---------- 5 ---------- */
L['mysql:2:4']={blocks:[
{p:'**Aggregate functions** collapse many rows into one value. `GROUP BY` does this per group, so you can answer questions like *how many orders does each customer have*.'},
{t:[['Function','Returns','NULL behaviour'],
['COUNT(*)','Number of rows','Counts every row'],
['COUNT(col)','Rows where col is not NULL','Skips NULL'],
['COUNT(DISTINCT col)','Number of distinct non-null values','Skips NULL'],
['SUM, AVG','Total, average','Skip NULL. AVG divides by non-null count'],
['MIN, MAX','Smallest, largest','Skip NULL'],
['GROUP_CONCAT(col)','Values joined into one string','Skips NULL. Output length limited by group_concat_max_len'],
['JSON_ARRAYAGG, JSON_OBJECTAGG','Group into JSON','']]},
{code:`SELECT COUNT(*) AS orders, SUM(total) AS revenue, AVG(total) AS avg_order, MAX(total) AS biggest
FROM orders;

SELECT status, COUNT(*) AS n, SUM(total) AS revenue
FROM orders
GROUP BY status;

SELECT customer_id, COUNT(*) AS orders, MIN(order_date) AS first_order
FROM orders
GROUP BY customer_id
ORDER BY orders DESC;`},
{h:'How GROUP BY works'},
{flow:['Rows that pass WHERE are collected','Rows with the same GROUP BY values form a group','Each aggregate is computed per group','One result row is returned per group','HAVING can remove groups, ORDER BY sorts the result']},
{h:'The rule for the select list'},
{p:'Every column in the select list must be either in the `GROUP BY` clause or inside an aggregate function. Selecting something else would be ambiguous: which value from the group should be shown? With the default `ONLY_FULL_GROUP_BY` mode MySQL rejects such a query, unless the column is functionally dependent on the grouped columns (for example, grouping by a primary key).'},
{code:`-- Error 1055 with ONLY_FULL_GROUP_BY: status is neither grouped nor aggregated
SELECT customer_id, status, COUNT(*) FROM orders GROUP BY customer_id;

-- Correct: group by the key and the displayed columns
SELECT c.id, c.name, COUNT(o.id) AS orders
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name;`},
{note:'`COUNT(*)` after a LEFT JOIN counts the unmatched row as 1. Count a column from the right table, `COUNT(o.id)`, to get 0 for customers without orders.'}],
src:[['Aggregate functions',K.D+'aggregate-functions.html'],['GROUP BY modifiers',K.D+'group-by-modifiers.html']]};

/* ---------- 6 ---------- */
L['mysql:2:5']={blocks:[
{p:'`HAVING` filters **groups** after aggregation, while `WHERE` filters **rows** before it. `WITH ROLLUP` adds subtotal and total rows to a grouped result.'},
{t:[['','WHERE','HAVING'],
['Filters','Individual rows','Groups produced by GROUP BY'],
['Runs','Before grouping','After grouping'],
['Can use aggregates','No','Yes'],
['Uses indexes','Yes','No, groups do not exist yet']]},
{code:`-- customers with at least two orders
SELECT customer_id, COUNT(*) AS orders
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 2;

-- filter rows first (cheaper), then groups
SELECT customer_id, SUM(total) AS spent
FROM orders
WHERE status <> 'cancelled'
GROUP BY customer_id
HAVING spent > 200;`},
{p:'Put a condition in `WHERE` whenever it does not need an aggregate. It removes rows before the grouping work and can use an index. MySQL also lets `HAVING` refer to a select-list alias, which many other databases do not allow.'},
{h:'WITH ROLLUP'},
{p:'`WITH ROLLUP` adds extra rows with subtotals for each level of grouping and a grand total. The summary rows show NULL in the grouped columns, and the `GROUPING()` function tells a real NULL from a rollup NULL.'},
{code:`SELECT country, city, COUNT(*) AS customers,
       GROUPING(country) AS g_country, GROUPING(city) AS g_city
FROM customers
GROUP BY country, city WITH ROLLUP;`},
{t:[['country','city','customers','Meaning'],
['DE','Berlin','2','Detail row'],
['DE','NULL','2','Subtotal for DE (g_city = 1)'],
['NULL','NULL','6','Grand total (both grouping flags = 1)']]},
{note:'The table above shows only a few of the rows the query returns. Run it to see the rest.'}],
src:[['GROUP BY and HAVING',K.D+'group-by-handling.html'],['GROUP BY modifiers',K.D+'group-by-modifiers.html']]};

/* ---------- 7 ---------- */
L['mysql:2:6']={blocks:[
{p:'You write a query in one order, but the server evaluates it in another. Knowing the **logical processing order** explains many errors, such as why a select-list alias cannot be used in `WHERE`.'},
{svg:order},
{t:[['Step','Clause','What it does'],
['1','FROM and JOIN','Builds the set of source rows'],
['2','WHERE','Filters rows'],
['3','GROUP BY','Forms groups and computes aggregates'],
['4','HAVING','Filters groups'],
['5','SELECT','Evaluates the select list, including aliases and window functions'],
['6','DISTINCT','Removes duplicate result rows'],
['7','ORDER BY','Sorts. May use aliases'],
['8','LIMIT','Returns the requested part']]},
{h:'What follows from it'},
{ul:['`WHERE total_with_tax > 100` fails when `total_with_tax` is an alias, because WHERE runs before SELECT creates it. Repeat the expression, or use a derived table or CTE.','`ORDER BY` and MySQL `HAVING` can use aliases because they run later.','Window functions run after grouping and HAVING, which is why they cannot appear in WHERE.','This is **logical** order. The optimizer may execute the steps in another order as long as the result is the same.']},
{code:`-- Fails: Unknown column in WHERE clause
SELECT price * 1.19 AS gross FROM products WHERE gross > 100;

-- Works
SELECT price * 1.19 AS gross FROM products WHERE price * 1.19 > 100;
SELECT * FROM (SELECT price * 1.19 AS gross FROM products) t WHERE gross > 100;`},
{h:'Reading a query'},
{p:'When a query surprises you, walk it in this order: which rows come from FROM and JOIN, which survive WHERE, how they are grouped, which groups survive HAVING, and only then what SELECT shows and how it is sorted.'}],
src:[['SELECT statement',K.D+'select.html'],['Aliases in queries',K.D+'problems-with-alias.html']]};

/* ---------- 8 ---------- */
L['mysql:2:7']={blocks:[
{p:'The **SQL mode** is a server and session setting that changes how strict MySQL is about data and which SQL syntax it accepts. It decides whether a bad value raises an error or is quietly adjusted, so it affects correctness, portability and upgrades.'},
{code:`SELECT @@GLOBAL.sql_mode;
SELECT @@SESSION.sql_mode;
SET SESSION sql_mode = CONCAT(@@SESSION.sql_mode, ',ANSI_QUOTES');
SET GLOBAL sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';`},
{p:'The default in MySQL 8.4 includes `ONLY_FULL_GROUP_BY`, `STRICT_TRANS_TABLES`, `NO_ZERO_IN_DATE`, `NO_ZERO_DATE`, `ERROR_FOR_DIVISION_BY_ZERO` and `NO_ENGINE_SUBSTITUTION`.'},
{h:'The modes that matter'},
{t:[['Mode','Effect'],
['ONLY_FULL_GROUP_BY','Rejects a GROUP BY query whose select list has columns that are neither grouped nor aggregated'],
['STRICT_TRANS_TABLES','An invalid or out-of-range value in a transactional table is an error, not a silent change'],
['STRICT_ALL_TABLES','Strict behaviour for all engines'],
['NO_ZERO_DATE, NO_ZERO_IN_DATE','Rejects dates such as 0000-00-00 or 2026-00-10'],
['ERROR_FOR_DIVISION_BY_ZERO','Division by zero is an error in strict data-changing statements'],
['NO_ENGINE_SUBSTITUTION','Error when the requested storage engine is unavailable, instead of using another'],
['ANSI_QUOTES','Double quotes quote identifiers, as in standard SQL'],
['PIPES_AS_CONCAT','Treat the double pipe as string concatenation'],
['TRADITIONAL, ANSI','Shortcut combinations']]},
{h:'Strict mode in action'},
{code:`CREATE TABLE t (n TINYINT, s VARCHAR(3));

INSERT INTO t VALUES (500, 'abcdef');
-- strict:      ERROR 1264 Out of range value for column n
-- non-strict:  stored as 127 and abc with warnings, no error`},
{p:'Without strict mode MySQL **adjusts** the data to fit and only produces a warning. Those warnings are easy to miss, so bad data enters the database. Keep strict mode on in every environment, including development, so errors show up before production.'},
{h:'ONLY_FULL_GROUP_BY'},
{p:'Older MySQL versions allowed selecting non-grouped columns and picked an arbitrary row from each group. With the mode on, the query must be correct, or the extra column must be **functionally dependent** on the grouped columns. If an old application breaks after an upgrade, fix the query. If you really need an arbitrary value, say so with `ANY_VALUE(col)`.'},
{code:`SELECT customer_id, ANY_VALUE(status) AS some_status, COUNT(*)
FROM orders GROUP BY customer_id;`},
{h:'Good practice'},
{ul:['Use the same SQL mode on development, test and production servers and on replicas.','Check warnings after bulk operations: `SHOW WARNINGS;`','Set the mode in the option file so that it survives restarts, and check that managed services use the same value.','A session can change its own mode, so applications that set sessions modes should do it deliberately.']}],
src:[['Server SQL modes',K.D+'sql-mode.html'],['MySQL handling of GROUP BY',K.D+'group-by-handling.html']]};
})();
