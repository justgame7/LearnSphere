/* LearnSphere - MySQL, Section 04: Joins, Subqueries & Set Operations.
   Lectures 0-7 are core. Needs mysql-common.js. Uses the shop sample database from section 3. */
(function(){
const K=window.MY,L=window.LESSONS;

const joins=K.dg(700,210,[
[10,10,680,190,'Join types as a picture of two sets (A = left table, B = right table)',1],
[25,50,150,100,'INNER|only rows that|match in both',2],[195,50,150,100,'LEFT|all of A, matches|from B, else NULL',0],[365,50,150,100,'RIGHT|all of B, matches|from A, else NULL',0],[535,50,140,100,'CROSS|every A with|every B',0],
[25,160,650,30,'FULL OUTER JOIN does not exist in MySQL. Emulate it with LEFT JOIN UNION RIGHT JOIN.',0]],[]);

const rows=K.dg(700,240,[
[10,10,680,220,'INNER JOIN versus LEFT JOIN on customers and orders',1],
[30,50,200,150,'customers|1 Ana|2 Ben|3 Chen|4 Dara|5 Eli|6 Fay',0],[260,50,170,150,'orders (customer_id)|1, 1, 1|2, 2|3|4',0],[460,50,210,150,'Result|INNER: only customers 1 to 4|LEFT: also Eli and Fay|with NULL order columns',2]],
[[230,125,260,125],[430,125,460,125]]);

const corr=K.dg(700,170,[
[10,10,680,150,'Correlated subquery: evaluated per outer row (conceptually)',1],
[30,60,170,50,'Outer row: customer 1',0],[270,60,190,50,'Inner query uses customers.id',2],[530,60,140,50,'Result for that row',0]],
[[200,85,270,85],[460,85,530,85]]);

/* ---------- 0 ---------- */
L['mysql:3:0']={blocks:[
{p:'Data is split across tables to avoid repetition: a customer is stored once and orders refer to it. A **join** puts the pieces back together in a query. It combines rows from two tables where a **join condition** is true.'},
{svg:joins},
{h:'INNER JOIN'},
{code:`SELECT o.id AS order_id, c.name AS customer, o.order_date, o.total
FROM orders AS o
INNER JOIN customers AS c ON c.id = o.customer_id
ORDER BY o.id;`},
{t:[['order_id','customer','order_date','total'],
['1','Ana','2026-01-05','89.70'],
['2','Ben','2026-01-09','189.00'],
['3','Ana','2026-02-01','912.50'],
['4','Chen','2026-02-03','49.90'],
['5','Dara','2026-02-10','148.90'],
['6','Ben','2026-03-02','238.90'],
['7','Ana','2026-03-15','19.90']]},
{p:'An inner join returns a row only when the condition is true. Customers without orders (Eli, Fay) do not appear, because nothing matches them.'},
{h:'How to think about it'},
{flow:['For each row in the first table, find rows in the second table where the ON condition is true','Each match produces one combined result row','A row with several matches appears several times','A row with no match produces nothing in an inner join']},
{h:'Writing joins'},
{ul:['Always use **explicit** `JOIN ... ON` syntax. The older comma form (`FROM a, b WHERE ...`) works but hides the join condition among the filters.','Qualify columns with the table alias whenever two tables share a name, such as `o.id` and `c.id`.','Put the join condition in `ON` and the row filters in `WHERE`. For inner joins the result is the same, for outer joins it is not.','Join on **indexed** columns. A join without an index on the matching column reads whole tables.']},
{h:'Joining on a foreign key'},
{p:'Most joins follow a foreign key from the child table to the parent: `orders.customer_id = customers.id`. The primary key side is unique, so each order matches at most one customer, and the number of result rows equals the number of orders. A join that multiplies row counts unexpectedly almost always means the join columns are not unique on one side.'}],
src:[['JOIN clause',K.D+'join.html'],['Join optimization',K.D+'nested-loop-joins.html']]};

/* ---------- 1 ---------- */
L['mysql:3:1']={blocks:[
{p:'An **outer join** keeps rows from one side even when nothing matches on the other. The missing columns are filled with NULL. In MySQL the two forms are `LEFT JOIN` (keep all left rows) and `RIGHT JOIN` (keep all right rows).'},
{svg:rows},
{code:`SELECT c.id, c.name, o.id AS order_id
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id
ORDER BY c.id, o.id;`},
{t:[['id','name','order_id'],
['1','Ana','1'],['1','Ana','3'],['1','Ana','7'],
['2','Ben','2'],['2','Ben','6'],
['3','Chen','4'],['4','Dara','5'],
['5','Eli','NULL'],['6','Fay','NULL']]},
{h:'Finding rows without a match (anti-join)'},
{p:'The classic use of a LEFT JOIN is to find what is **missing**: filter for the NULL on the right side.'},
{code:`-- customers who have never ordered
SELECT c.id, c.name
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id
WHERE o.id IS NULL;`},
{h:'The ON versus WHERE trap'},
{p:'In a LEFT JOIN, a condition on the right table placed in `WHERE` removes the NULL rows and silently turns the query into an inner join. Put it in `ON` to keep the unmatched left rows.'},
{code:`-- All customers, with only their PAID orders (Eli and Fay still appear)
SELECT c.name, o.id
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid';

-- Customers that have a paid order only (acts like INNER JOIN)
SELECT c.name, o.id
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'paid';`},
{h:'RIGHT JOIN and FULL OUTER JOIN'},
{ul:['`A RIGHT JOIN B` equals `B LEFT JOIN A`. Most people write only LEFT JOINs and reorder the tables, which is easier to read.','MySQL has **no FULL OUTER JOIN**. Combine both directions:']},
{code:`SELECT c.id, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
UNION
SELECT c.id, o.id FROM customers c RIGHT JOIN orders o ON o.customer_id = c.id;`},
{note:'Outer joins and aggregates: count the right side column, `COUNT(o.id)`, not `COUNT(*)`, or an unmatched row is counted as one.'}],
src:[['Outer join optimization',K.D+'outer-join-optimization.html'],['JOIN clause',K.D+'join.html']]};

/* ---------- 2 ---------- */
L['mysql:3:2']={blocks:[
{h:'CROSS JOIN'},
{p:'A cross join pairs **every** row of one table with every row of another (the Cartesian product). Six customers and six products give 36 rows. It is rarely what you want by accident, and it explodes quickly on large tables, but it is useful for generating combinations, calendars and test data.'},
{code:`SELECT c.name, p.name AS product FROM customers c CROSS JOIN products p;   -- 36 rows

-- A forgotten ON condition on an inner join also gives a Cartesian product in MySQL:
SELECT * FROM orders JOIN customers;                                        -- no ON: 7 x 6 = 42 rows`},
{h:'Self join'},
{p:'A table can be joined to itself when rows refer to other rows of the same table, such as employees and their managers. Aliases are required to tell the two roles apart.'},
{code:`CREATE TABLE staff (id INT PRIMARY KEY, name VARCHAR(50), manager_id INT NULL);
INSERT INTO staff VALUES (1,'Ana',NULL),(2,'Ben',1),(3,'Chen',1),(4,'Dara',2);

SELECT e.name AS employee, m.name AS manager
FROM staff e LEFT JOIN staff m ON m.id = e.manager_id;`},
{h:'USING and NATURAL JOIN'},
{ul:['`USING (col)` is a shorthand when the join columns have the same name in both tables, and it returns the column once: `FROM orders JOIN order_items USING (order_id)` in schemas that name the column the same.','`NATURAL JOIN` joins on **all** columns with matching names. Avoid it: adding a column to a table can silently change the join.']},
{h:'Joining several tables'},
{p:'Join tables one after another. Each join result becomes the left side of the next. The optimizer chooses the actual order, so you write for readability.'},
{code:`SELECT c.name, o.id AS order_id, p.name AS product, i.qty, i.price
FROM customers c
JOIN orders o       ON o.customer_id = c.id
JOIN order_items i  ON i.order_id    = o.id
JOIN products p     ON p.id          = i.product_id
WHERE o.status <> 'cancelled'
ORDER BY o.id, p.name;`},
{h:'Non-equi joins'},
{p:'The join condition does not have to be equality. Ranges and inequalities are valid, for example matching a value to a band.'},
{code:`CREATE TABLE price_bands (label VARCHAR(10), low DECIMAL(10,2), high DECIMAL(10,2));
INSERT INTO price_bands VALUES ('cheap',0,50),('mid',50,200),('premium',200,10000);
SELECT p.name, b.label FROM products p JOIN price_bands b ON p.price >= b.low AND p.price < b.high;`},
{note:'Non-equality joins cannot use a hash lookup on the condition and may be slow on big tables. Check the plan with EXPLAIN.'}],
src:[['JOIN clause',K.D+'join.html'],['Hash join optimization',K.D+'hash-joins.html']]};

/* ---------- 3 ---------- */
L['mysql:3:3']={blocks:[
{p:'A **subquery** is a SELECT inside another statement. It lets one query use the result of another. Many subqueries can be written as joins, and which is clearer depends on what you are asking.'},
{h:'Where subqueries appear'},
{t:[['Kind','Returns','Used where','Example'],
['Scalar','One value','Anywhere an expression is allowed','`(SELECT MAX(total) FROM orders)`'],
['Row','One row of several columns','Row comparisons','`(a,b) = (SELECT x,y ...)`'],
['Column (list)','One column, many rows','`IN`, `ANY`, `ALL`','`id IN (SELECT customer_id ...)`'],
['Table','Many rows and columns','`FROM` clause (derived table)','`FROM (SELECT ...) AS t`']]},
{code:`-- scalar: orders bigger than the average
SELECT id, total FROM orders WHERE total > (SELECT AVG(total) FROM orders);

-- list: customers who placed at least one order
SELECT name FROM customers WHERE id IN (SELECT customer_id FROM orders);

-- scalar in the select list
SELECT name, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orders
FROM customers c;

-- ANY and ALL
SELECT name, price FROM products WHERE price > ALL (SELECT price FROM products WHERE category = 'accessories');`},
{h:'Rules'},
{ul:['A **scalar** subquery must return one column and at most one row. More than one row is error 1242.','A subquery is written in parentheses.','A subquery in `FROM` must have an alias.','You cannot update a table and select from the same table in one subquery in plain form. Wrap it in a derived table when needed.']},
{h:'Subquery or join?'},
{t:[['Use a subquery when','Use a join when'],
['You need a single value, such as an average or a maximum','You need columns from both tables in the result'],
['You test existence or membership','You are combining many rows from several tables'],
['The logic reads naturally as nested questions','You want the optimizer to see all tables at once']]},
{p:'MySQL 8 rewrites many `IN` and `EXISTS` subqueries into **semi-joins** automatically, so both forms often run equally fast. Check the plan instead of guessing.'},
{note:'Readability matters. If a query has three nested subqueries, a CTE (last lesson of this section) usually reads better.'}],
src:[['Subqueries',K.D+'subqueries.html'],['Subquery optimization',K.D+'subquery-optimization.html']]};

/* ---------- 4 ---------- */
L['mysql:3:4']={blocks:[
{p:'A **correlated subquery** refers to a column of the outer query, so it is conceptually evaluated once for each outer row. `EXISTS` and `IN` are two ways to test whether related rows exist.'},
{svg:corr},
{code:`-- orders larger than the customer's own average (correlated)
SELECT o.id, o.customer_id, o.total
FROM orders o
WHERE o.total > (SELECT AVG(o2.total) FROM orders o2 WHERE o2.customer_id = o.customer_id);`},
{h:'EXISTS and NOT EXISTS'},
{p:'`EXISTS (subquery)` is true if the subquery returns at least one row. It stops at the first match and does not care about the selected columns, so `SELECT 1` is the convention.'},
{code:`-- customers with at least one paid order
SELECT c.name FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'paid');

-- customers with no orders
SELECT c.name FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);`},
{h:'IN versus EXISTS'},
{ul:['Both express a semi-join and are usually optimised to the same plan in MySQL 8.','`EXISTS` reads best for correlated conditions with several predicates.','**`NOT IN` has a NULL trap:** if the subquery returns any NULL, `NOT IN` returns no rows at all.']},
{code:`-- If any orders.customer_id were NULL this would return NOTHING:
SELECT name FROM customers WHERE id NOT IN (SELECT customer_id FROM orders);

-- Safe forms:
SELECT name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;`},
{p:'The cause: `5 NOT IN (1, NULL)` means `5 <> 1 AND 5 <> NULL`, and the second part is unknown, so the whole condition is never true.'},
{h:'Performance'},
{p:'A correlated subquery that the optimizer cannot rewrite runs once per outer row. That is fine when the inner lookup uses an index and the outer set is small. It is slow when the inner side scans a big table each time. Check `EXPLAIN` for `DEPENDENT SUBQUERY` and add an index on the correlated column.'}],
src:[['Subqueries with EXISTS or NOT EXISTS',K.D+'exists-and-not-exists-subqueries.html'],['Optimizing subqueries with semijoin',K.D+'semijoins.html']]};

/* ---------- 5 ---------- */
L['mysql:3:5']={blocks:[
{p:'A **derived table** is a subquery used in the `FROM` clause. It behaves like a temporary table that exists for the duration of the query. It is useful when you need to aggregate first and then join or filter the result.'},
{code:`-- spending per customer, then join to names and filter
SELECT c.name, s.spent
FROM (SELECT customer_id, SUM(total) AS spent
      FROM orders WHERE status <> 'cancelled'
      GROUP BY customer_id) AS s
JOIN customers c ON c.id = s.customer_id
WHERE s.spent > 200
ORDER BY s.spent DESC;`},
{p:'The derived table needs an alias, here `s`. MySQL may **merge** a simple derived table into the outer query or **materialise** it into an internal temporary table, whichever the optimizer decides is cheaper.'},
{h:'The lateral problem'},
{p:'A normal derived table cannot refer to columns of tables that appear earlier in the same `FROM`. Suppose you want the **latest two orders of each customer**. A plain subquery cannot reach the outer customer row. `LATERAL` (MySQL 8.0.14 and later) removes that restriction.'},
{code:`SELECT c.name, t.id AS order_id, t.order_date
FROM customers c
JOIN LATERAL (
  SELECT o.id, o.order_date
  FROM orders o
  WHERE o.customer_id = c.id
  ORDER BY o.order_date DESC
  LIMIT 2
) AS t ON TRUE
ORDER BY c.id, t.order_date DESC;`},
{p:'Use `LEFT JOIN LATERAL (...) AS t ON TRUE` to keep customers that have no orders. LATERAL is the tool for **top-N per group** and for calling a set-returning expression per row.'},
{h:'Alternatives for top-N per group'},
{t:[['Approach','Notes'],
['LATERAL join','Direct and readable. Needs an index on (customer_id, order_date) to be fast'],
['Window function ROW_NUMBER() in a derived table','Works well when you need all groups. Covered in the functions section'],
['Correlated subquery with LIMIT','Not allowed in IN subqueries in older versions. Avoid']]},
{note:'Derived tables and CTEs are evaluated for each query. They are not stored and they have no indexes of their own unless the optimizer adds an automatic key for a materialised result.'}],
src:[['Derived tables',K.D+'derived-tables.html'],['Lateral derived tables',K.D+'lateral-derived-tables.html']]};

/* ---------- 6 ---------- */
L['mysql:3:6']={blocks:[
{p:'**Set operators** combine the results of two or more SELECT statements vertically, stacking rows rather than adding columns as a join does.'},
{t:[['Operator','Result','Duplicates'],
['UNION','All rows from either query','Removed (the default is DISTINCT)'],
['UNION ALL','All rows from either query','Kept. Faster, no de-duplication step'],
['INTERSECT','Rows in both queries','Removed (ALL option available)'],
['EXCEPT','Rows in the first but not the second','Removed (ALL option available)']]},
{p:'`INTERSECT` and `EXCEPT` arrived in MySQL **8.0.31**. `UNION` has always been available.'},
{code:`SELECT name, 'customer' AS kind FROM customers
UNION ALL
SELECT name, 'product' FROM products;

-- customers in Berlin or Paris, no duplicates
SELECT id FROM customers WHERE city = 'Berlin'
UNION
SELECT id FROM customers WHERE city = 'Paris';

-- customers who ordered AND are in Berlin
SELECT customer_id FROM orders
INTERSECT
SELECT id FROM customers WHERE city = 'Berlin';

-- customers who never ordered
SELECT id FROM customers
EXCEPT
SELECT customer_id FROM orders;`},
{h:'Rules'},
{ul:['Every query must return the **same number of columns**, with compatible types, matched by position.','Column names in the result come from the **first** query.','`ORDER BY` and `LIMIT` for the whole result go at the end. To order one part, wrap that part in parentheses.','Prefer `UNION ALL` when you know the parts cannot overlap. Plain `UNION` sorts or hashes to remove duplicates.']},
{code:`(SELECT id, total FROM orders WHERE status = 'paid' ORDER BY total DESC LIMIT 2)
UNION ALL
(SELECT id, total FROM orders WHERE status = 'shipped' ORDER BY total DESC LIMIT 2)
ORDER BY total DESC;`},
{note:'Precedence: INTERSECT binds tighter than UNION and EXCEPT. Use parentheses when you mix operators.'}],
src:[['UNION clause',K.D+'union.html'],['INTERSECT and EXCEPT',K.D+'intersect.html']]};

/* ---------- 7 ---------- */
L['mysql:3:7']={blocks:[
{p:'A **common table expression (CTE)** is a named query defined with `WITH` at the start of a statement. It makes complex queries readable by splitting them into steps, and it supports **recursion**. CTEs arrived in MySQL 8.0.'},
{code:`WITH paid AS (
  SELECT customer_id, SUM(total) AS spent
  FROM orders
  WHERE status IN ('paid','shipped')
  GROUP BY customer_id
),
ranked AS (
  SELECT customer_id, spent, RANK() OVER (ORDER BY spent DESC) AS rnk
  FROM paid
)
SELECT c.name, r.spent, r.rnk
FROM ranked r JOIN customers c ON c.id = r.customer_id
ORDER BY r.rnk;`},
{ul:['Each CTE can use the ones defined before it.','A CTE can be referenced several times in the main query and is usually evaluated **once** and reused (materialised) when that is cheaper.','A CTE is visible only to its own statement. It is not a view and is not stored.','CTEs also work with `INSERT ... SELECT`, `UPDATE` and `DELETE`.']},
{h:'Recursive CTEs'},
{p:'A recursive CTE has an **anchor** query that produces the starting rows and a **recursive** part that refers to the CTE itself, joined with `UNION ALL`. It repeats until the recursive part returns no new rows.'},
{flow:['Run the anchor query to produce the first set of rows','Run the recursive part using the rows from the previous round','Add its rows to the result and use them as the input of the next round','Stop when a round returns no rows (or at cte_max_recursion_depth)']},
{code:`-- number series 1 to 5
WITH RECURSIVE n AS (
  SELECT 1 AS i
  UNION ALL
  SELECT i + 1 FROM n WHERE i < 5
)
SELECT i FROM n;

-- reporting chain from the staff table of the self join lesson
WITH RECURSIVE chain AS (
  SELECT id, name, manager_id, 0 AS depth FROM staff WHERE manager_id IS NULL
  UNION ALL
  SELECT s.id, s.name, s.manager_id, c.depth + 1
  FROM staff s JOIN chain c ON s.manager_id = c.id
)
SELECT CONCAT(REPEAT('  ', depth), name) AS org FROM chain ORDER BY depth, name;`},
{h:'Protecting against runaway recursion'},
{ul:['`cte_max_recursion_depth` (default 1000) stops infinite recursion with an error.','Always include a stopping condition in the recursive part (`WHERE i < 5`).','Cycles in the data (A manages B, B manages A) loop forever. Track visited ids in a path column or limit the depth.']},
{note:'Use a CTE for readability, not as a performance trick. A CTE referenced once is often merged into the query like a derived table.'}],
src:[['WITH (common table expressions)',K.D+'with.html'],['Recursive CTEs',K.D+'with.html#common-table-expressions-recursive']]};
})();
