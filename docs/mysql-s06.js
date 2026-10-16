/* LearnSphere - MySQL, Section 06: Functions & Advanced SQL.
   Lectures 0-7 are core. Needs mysql-common.js. Uses the shop sample database from section 3. */
(function(){
const K=window.MY,L=window.LESSONS;

const win=K.dg(700,220,[
[10,10,680,200,'GROUP BY collapses rows. A window function keeps them.',1],
[25,50,300,140,'GROUP BY customer_id|1 row per customer|SUM(total)',0],[375,50,300,140,'SUM(total) OVER (PARTITION BY customer_id)|every order row kept|the customer total added to each row',2]],
[[325,120,375,120]]);

const frame=K.dg(700,170,[
[10,10,680,150,'Window pieces: OVER (PARTITION BY ... ORDER BY ... frame)',1],
[25,55,200,60,'PARTITION BY|splits rows into groups|(optional)',0],[255,55,200,60,'ORDER BY|orders rows inside each group',2],[485,55,190,60,'Frame|which rows to include|ROWS BETWEEN ...',0]],
[[225,85,255,85],[455,85,485,85]]);

const gen=K.dg(700,170,[
[10,10,680,150,'Generated column',1],
[30,60,160,50,'price, qty|real columns',0],[270,60,170,50,'total = price * qty|expression',2],[520,60,150,50,'VIRTUAL: computed|on read|STORED: saved|on write',0]],
[[190,85,270,85],[440,85,520,85]]);

/* ---------- 0 ---------- */
L['mysql:5:0']={blocks:[
{p:'Built-in functions transform values inside a query. Learn the families, not every name, and look up exact syntax in the manual. Remember that applying a function to an indexed column in a `WHERE` clause usually prevents the index from being used.'},
{t:[['Task','Functions','Example'],
['Join text','`CONCAT`, `CONCAT_WS`','`CONCAT_WS(\', \', city, country)`'],
['Case','`UPPER`, `LOWER`','`LOWER(email)`'],
['Length','`CHAR_LENGTH`, `LENGTH`','`CHAR_LENGTH(\'héllo\')` is 5, `LENGTH` is 6 bytes'],
['Slice','`SUBSTRING`, `LEFT`, `RIGHT`','`SUBSTRING(email, 1, 3)`'],
['Find','`LOCATE`, `INSTR`, `POSITION`','`LOCATE(\'@\', email)`'],
['Replace','`REPLACE`, `INSERT`','`REPLACE(phone, \'-\', \'\')`'],
['Trim and pad','`TRIM`, `LTRIM`, `LPAD`, `RPAD`','`LPAD(id, 6, \'0\')`'],
['Repeat and reverse','`REPEAT`, `REVERSE`',''],
['Compare','`STRCMP`, `LIKE`, `REGEXP_LIKE`','`REGEXP_LIKE(email, \'^[a-z]+@\')`'],
['Split and group','`SUBSTRING_INDEX`, `GROUP_CONCAT`','`SUBSTRING_INDEX(email, \'@\', -1)` returns the domain']]},
{code:`SELECT CONCAT(name, ' <', country, '>') AS label FROM customers;
SELECT CONCAT_WS(', ', city, country) AS place FROM customers;    -- skips NULL parts
SELECT LPAD(id, 6, '0') AS padded FROM customers;
SELECT SUBSTRING_INDEX('ana@example.com', '@', -1);                 -- example.com
SELECT REGEXP_REPLACE('a1b22c333', '[0-9]+', '#');                  -- a#b#c#
SELECT GROUP_CONCAT(name ORDER BY name SEPARATOR ', ') FROM customers WHERE country = 'FR';`},
{h:'Cautions'},
{ul:['`CONCAT` returns **NULL** if any argument is NULL. `CONCAT_WS` skips NULLs.','`LENGTH` counts bytes, `CHAR_LENGTH` counts characters. With utf8mb4 they differ for non-ASCII text.','String comparison depends on the **collation**. `LOWER(a) = LOWER(b)` is usually unnecessary with a `_ci` collation and stops index use.','Do not search with `LIKE \'%word%\'` on big tables. Use a full-text index (section 11).','`GROUP_CONCAT` output is cut at `group_concat_max_len` (1024 by default) without an error, only a warning.']},
{note:'`REGEXP`, `REGEXP_LIKE`, `REGEXP_REPLACE`, `REGEXP_SUBSTR` and `REGEXP_INSTR` use the ICU library since MySQL 8.0 and follow Unicode rules. Old patterns written for the earlier engine may behave slightly differently.'}],
src:[['String functions',K.D+'string-functions.html'],['Regular expressions',K.D+'regexp.html']]};

/* ---------- 1 ---------- */
L['mysql:5:1']={blocks:[
{h:'Numeric functions'},
{t:[['Function','Purpose','Example'],
['`ROUND(x, d)`','Round to d decimals','`ROUND(2.675, 2)`'],
['`CEIL`, `FLOOR`','Round up, round down','`CEIL(4.1)` is 5'],
['`TRUNCATE(x, d)`','Cut without rounding','`TRUNCATE(4.99, 1)` is 4.9'],
['`MOD(a, b)`, `%`','Remainder','`MOD(10, 3)` is 1'],
['`ABS`, `SIGN`','Absolute value, sign',''],
['`POW`, `SQRT`','Powers and roots',''],
['`RAND()`','Random value from 0 to 1','`ORDER BY RAND()` sorts the whole table, avoid it on big tables']]},
{p:'`ROUND` on exact DECIMAL values rounds half away from zero. On floating point it follows the C library, so results can look odd. Another reason to use DECIMAL for money.'},
{h:'Date and time functions'},
{t:[['Task','Functions'],
['Current time','`NOW()`, `CURRENT_TIMESTAMP`, `CURDATE()`, `CURTIME()`, `UTC_TIMESTAMP()`'],
['Parts','`YEAR`, `MONTH`, `DAY`, `HOUR`, `DAYOFWEEK`, `WEEK`, `QUARTER`, `EXTRACT(YEAR FROM d)`'],
['Arithmetic','`DATE_ADD(d, INTERVAL 7 DAY)`, `DATE_SUB`, `d + INTERVAL 1 MONTH`, `TIMESTAMPADD`'],
['Differences','`DATEDIFF(a, b)` in days, `TIMESTAMPDIFF(HOUR, a, b)`'],
['Format and parse','`DATE_FORMAT(d, \'%Y-%m-%d\')`, `STR_TO_DATE(\'05/01/2026\', \'%d/%m/%Y\')`'],
['Truncate','`DATE(dt)`, `LAST_DAY(d)`, `DATE_FORMAT(d, \'%Y-%m-01\')`']]},
{code:`SELECT NOW(), CURDATE();
SELECT order_date, order_date + INTERVAL 30 DAY AS due_date FROM orders;
SELECT DATEDIFF('2026-03-15', '2026-01-05');                         -- 69
SELECT TIMESTAMPDIFF(MONTH, '2026-01-05', '2026-03-15');            -- 2
SELECT DATE_FORMAT(order_date, '%Y-%m') AS month, COUNT(*) AS orders, SUM(total) AS revenue
FROM orders GROUP BY DATE_FORMAT(order_date, '%Y-%m') ORDER BY month;
SELECT LAST_DAY('2026-02-10');                                       -- 2026-02-28`},
{h:'Cautions'},
{ul:['`NOW()` is fixed for the duration of a statement. `SYSDATE()` is evaluated at each call and can behave badly with replication.','Do not wrap an indexed date column in functions in WHERE. Use a range on the column instead.','Month and week arithmetic differs: `DATEDIFF` returns whole days, `TIMESTAMPDIFF(MONTH, ...)` returns complete months.','`WEEK()` has modes that decide the first day of the week. State the mode.']}],
src:[['Numeric functions',K.D+'mathematical-functions.html'],['Date and time functions',K.D+'date-and-time-functions.html']]};

/* ---------- 2 ---------- */
L['mysql:5:2']={blocks:[
{p:'Conditional expressions put decision logic inside a query, for labels, buckets and safe handling of NULL.'},
{h:'CASE'},
{code:`SELECT id, total,
  CASE
    WHEN total >= 500 THEN 'large'
    WHEN total >= 100 THEN 'medium'
    ELSE 'small'
  END AS size
FROM orders;

-- simple form: compares one expression to values
SELECT id, CASE status WHEN 'paid' THEN 1 WHEN 'shipped' THEN 2 ELSE 0 END AS rank_no FROM orders;`},
{p:'`CASE` tests the `WHEN` branches in order and returns the first match. Without `ELSE`, no match returns NULL. All the result expressions should be of a compatible type.'},
{h:'Conditional aggregation'},
{p:'Placing CASE inside an aggregate pivots rows into columns and computes several filtered totals in one pass.'},
{code:`SELECT customer_id,
       SUM(CASE WHEN status = 'paid'      THEN total ELSE 0 END) AS paid,
       SUM(CASE WHEN status = 'shipped'   THEN total ELSE 0 END) AS shipped,
       COUNT(CASE WHEN status = 'cancelled' THEN 1 END)          AS cancelled_orders
FROM orders
GROUP BY customer_id;`},
{h:'IF, IFNULL, NULLIF and COALESCE'},
{t:[['Function','Meaning','Example'],
['`IF(cond, a, b)`','Two-way choice','`IF(total > 100, \'big\', \'small\')`'],
['`IFNULL(a, b)`','b when a is NULL','`IFNULL(city, \'unknown\')`'],
['`COALESCE(a, b, c, ...)`','First non-NULL argument. Standard SQL','`COALESCE(mobile, phone, email)`'],
['`NULLIF(a, b)`','NULL when a equals b','`NULLIF(qty, 0)` prevents division by zero']]},
{code:`SELECT total / NULLIF(qty, 0) FROM metrics;       -- NULL instead of an error or warning
SELECT name, COALESCE(city, country) AS place FROM customers;`},
{h:'Notes'},
{ul:['Prefer `COALESCE` and `CASE` over `IF` and `IFNULL` when you want portable SQL.','Booleans in MySQL are the integers 1 and 0, so `SUM(status = \'paid\')` counts paid rows without CASE.','`CASE` branches can use subqueries and functions, but keep them readable. If the logic grows, move it to a view or application code.']}],
src:[['Flow control functions',K.D+'flow-control-functions.html'],['CASE expression',K.D+'case.html']]};

/* ---------- 3 ---------- */
L['mysql:5:3']={blocks:[
{p:'A **window function** computes a value for each row using a set of related rows, **without collapsing** them into one row as GROUP BY does. Window functions arrived in MySQL 8.0 and solve ranking, running totals, comparisons with the previous row and top-N per group.'},
{svg:win},
{code:`SELECT id, customer_id, total,
       SUM(total) OVER (PARTITION BY customer_id) AS customer_total,
       total / SUM(total) OVER (PARTITION BY customer_id) AS share
FROM orders;`},
{t:[['id','customer_id','total','customer_total'],
['1','1','89.70','1022.10'],['3','1','912.50','1022.10'],['7','1','19.90','1022.10'],
['2','2','189.00','427.90'],['6','2','238.90','427.90']]},
{p:'Every order row remains, and the customer total is repeated on each of that customer rows. A GROUP BY query could not show both the single order and the total.'},
{h:'The OVER clause'},
{svg:frame},
{ul:['**PARTITION BY** splits the rows into independent groups. Without it the whole result is one partition.','**ORDER BY** orders the rows within each partition. It is required for ranking and for running totals.','The **frame** (`ROWS` or `RANGE BETWEEN ...`) says which rows around the current row are included. When ORDER BY is present and no frame is given, the default is from the start of the partition to the current row, including ties (`RANGE`).']},
{h:'Where window functions run'},
{p:'They run after `WHERE`, `GROUP BY` and `HAVING`, and before the final `ORDER BY`. You can only use them in the select list and in `ORDER BY`. To filter on a window result, put the query in a derived table or CTE.'},
{code:`SELECT * FROM (
  SELECT id, customer_id, total,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY total DESC) AS rn
  FROM orders
) t
WHERE rn = 1;               -- biggest order per customer`},
{h:'Named windows'},
{code:`SELECT id, total,
       SUM(total) OVER w AS running,
       AVG(total) OVER w AS running_avg
FROM orders
WINDOW w AS (ORDER BY order_date, id);`},
{note:'Window functions can be expensive on large partitions because the server sorts rows to build the window. An index that matches PARTITION BY and ORDER BY can help.'}],
src:[['Window functions',K.D+'window-functions.html'],['Window function concepts',K.D+'window-functions-usage.html']]};

/* ---------- 4 ---------- */
L['mysql:5:4']={blocks:[
{h:'Ranking functions'},
{t:[['Function','Behaviour on ties','Result for totals 300, 300, 200'],
['`ROW_NUMBER()`','Unique number, ties broken arbitrarily','1, 2, 3'],
['`RANK()`','Same rank for ties, then gaps','1, 1, 3'],
['`DENSE_RANK()`','Same rank for ties, no gaps','1, 1, 2'],
['`NTILE(n)`','Splits rows into n buckets','bucket numbers'],
['`PERCENT_RANK()`, `CUME_DIST()`','Relative position from 0 to 1','']]},
{code:`SELECT p.name, p.category, p.price,
       RANK()       OVER (PARTITION BY category ORDER BY price DESC) AS price_rank,
       ROW_NUMBER() OVER (ORDER BY price DESC) AS overall
FROM products p;`},
{h:'Offset functions: look at other rows'},
{t:[['Function','Returns'],
['`LAG(col, n, default)`','Value from n rows before the current row in the window'],
['`LEAD(col, n, default)`','Value from n rows after'],
['`FIRST_VALUE(col)`, `LAST_VALUE(col)`','First or last value of the frame'],
['`NTH_VALUE(col, n)`','The n-th value of the frame']]},
{code:`-- change from the previous order of the same customer
SELECT customer_id, order_date, total,
       total - LAG(total) OVER (PARTITION BY customer_id ORDER BY order_date) AS change_vs_previous,
       DATEDIFF(order_date, LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date)) AS days_since
FROM orders;`},
{p:'`LAG` returns NULL for the first row in a partition unless you give a default as the third argument.'},
{h:'Running totals and moving averages'},
{code:`SELECT order_date, total,
       SUM(total) OVER (ORDER BY order_date, id
                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total,
       AVG(total) OVER (ORDER BY order_date, id
                        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg_3
FROM orders;`},
{h:'ROWS or RANGE'},
{ul:['`ROWS` counts physical rows around the current one. Use it for running totals so ties do not group.','`RANGE` includes all rows with the **same ORDER BY value** as the current row (peers). It is the default frame, so a running `SUM` with duplicate dates gives the same total to all tied rows.','`LAST_VALUE` with the default frame returns the current row, not the last in the partition. Give the frame `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.']},
{note:'Any aggregate (SUM, AVG, COUNT, MIN, MAX) can be used as a window function by adding OVER. The ranking and offset functions can only be used with OVER.'}],
src:[['Window function descriptions',K.D+'window-function-descriptions.html'],['Window function frame specification',K.D+'window-functions-frames.html']]};

/* ---------- 5 ---------- */
L['mysql:5:5']={blocks:[
{p:'MySQL has many JSON functions for reading, searching and modifying documents. Combined with `JSON_TABLE` they let you treat JSON as rows. Section 2 introduced the type. This lesson uses it.'},
{code:`CREATE TABLE profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  doc JSON NOT NULL
);
INSERT INTO profiles (doc) VALUES
 ('{"name":"Ana","address":{"city":"Berlin"},"skills":["sql","python"],"active":true}'),
 ('{"name":"Ben","address":{"city":"Paris"},"skills":["go"],"active":false}');`},
{h:'Reading'},
{t:[['Function or operator','Purpose','Example'],
['`col->\'$.path\'`','Extract, keeps JSON quotes','`doc->\'$.name\'` returns "Ana"'],
['`col->>\'$.path\'`','Extract and unquote to text','`doc->>\'$.address.city\'` returns Berlin'],
['`JSON_EXTRACT(doc, path)`','Same as ->',''],
['`JSON_CONTAINS(doc, val, path)`','Does a value exist','`JSON_CONTAINS(doc->\'$.skills\', \'"sql"\')`'],
['`JSON_SEARCH(doc, \'one\', \'sql\')`','Find the path of a string',''],
['`JSON_LENGTH`, `JSON_KEYS`, `JSON_TYPE`','Inspect structure',''],
['`MEMBER OF`','Is the value in the array','`\'sql\' MEMBER OF (doc->\'$.skills\')`']]},
{code:`SELECT doc->>'$.name' AS name, doc->>'$.address.city' AS city FROM profiles;
SELECT id FROM profiles WHERE 'sql' MEMBER OF (doc->'$.skills');
SELECT id FROM profiles WHERE doc->>'$.address.city' = 'Paris';`},
{h:'Changing'},
{t:[['Function','Behaviour'],
['`JSON_SET(doc, path, val)`','Insert or replace'],
['`JSON_INSERT`','Add only if the path does not exist'],
['`JSON_REPLACE`','Replace only if the path exists'],
['`JSON_REMOVE(doc, path)`','Delete a path'],
['`JSON_ARRAY_APPEND`, `JSON_ARRAY_INSERT`','Change arrays'],
['`JSON_MERGE_PATCH`','Merge documents, later value wins (RFC 7396)']]},
{code:`UPDATE profiles SET doc = JSON_SET(doc, '$.address.zip', '10115', '$.active', true) WHERE id = 1;
UPDATE profiles SET doc = JSON_ARRAY_APPEND(doc, '$.skills', 'docker') WHERE id = 1;`},
{h:'JSON_TABLE: JSON to rows'},
{code:`SELECT p.id, s.skill
FROM profiles p,
     JSON_TABLE(p.doc, '$.skills[*]' COLUMNS (skill VARCHAR(40) PATH '$')) AS s;`},
{p:'`JSON_TABLE` turns an array into relational rows that you can join, filter and aggregate. Use `JSON_OBJECT`, `JSON_ARRAY` and `JSON_ARRAYAGG` in the other direction to build JSON from rows.'},
{h:'Performance'},
{ul:['Filtering on `doc->>\'$.name\'` scans every document unless you index it through a generated column or a functional index.','Arrays can be indexed with a **multi-valued index** (section 11) to support `MEMBER OF`, `JSON_CONTAINS` and `JSON_OVERLAPS`.']}],
src:[['JSON function reference',K.D+'json-function-reference.html'],['JSON_TABLE',K.D+'json-table-functions.html']]};

/* ---------- 6 ---------- */
L['mysql:5:6']={blocks:[
{p:'A **generated column** is a column whose value is computed from an expression over other columns of the same row. The database keeps it consistent, and you can index it. It is a clean way to avoid repeating logic and to index expressions such as JSON paths.'},
{svg:gen},
{code:`CREATE TABLE line_items (
  id        INT PRIMARY KEY AUTO_INCREMENT,
  price     DECIMAL(10,2) NOT NULL,
  qty       INT NOT NULL,
  total     DECIMAL(12,2) GENERATED ALWAYS AS (price * qty) VIRTUAL,
  total_stored DECIMAL(12,2) GENERATED ALWAYS AS (price * qty) STORED,
  INDEX idx_total (total)
);`},
{t:[['','VIRTUAL (default)','STORED'],
['Where the value lives','Computed when read (or when its index is built)','Written to the row on insert and update'],
['Table size','No extra space for the column','Uses space'],
['Write cost','None','Computed on each write'],
['Read cost','Computed on each read, unless indexed','Free'],
['Can be indexed','Yes (secondary indexes)','Yes'],
['Add or change','Often instant or in place','Usually needs a table rebuild']]},
{h:'Indexing a JSON field or an expression'},
{code:`ALTER TABLE profiles
  ADD COLUMN city VARCHAR(80) GENERATED ALWAYS AS (doc->>'$.address.city') VIRTUAL,
  ADD INDEX idx_city (city);

SELECT id FROM profiles WHERE city = 'Paris';          -- uses idx_city

CREATE TABLE users (email VARCHAR(255), email_lower VARCHAR(255) AS (LOWER(email)), KEY (email_lower));`},
{h:'Rules'},
{ul:['The expression may use only deterministic functions and columns of the same row. No subqueries, no non-deterministic functions such as NOW() or RAND().','You cannot write to a generated column directly. You may only set it to DEFAULT.','They cannot be the target of AUTO_INCREMENT or reference columns that are generated later in the table definition.','A foreign key has restrictions with generated columns.']},
{h:'Generated column or functional index?'},
{p:'Since 8.0.13 you can create an index directly on an expression, `INDEX ((LOWER(email)))`, which creates a hidden virtual generated column for you. Use an explicit generated column when you also want to select or reference the computed value by name.'},
{note:'Use a view, not a generated column, when the value depends on other tables. Generated columns see only their own row.'}],
src:[['Generated columns',K.D+'create-table-generated-columns.html'],['Secondary indexes and generated columns',K.D+'create-table-secondary-indexes.html']]};

/* ---------- 7 ---------- */
L['mysql:5:7']={blocks:[
{p:'MySQL converts values between types **implicitly** when you compare or combine them. The rules are convenient and a classic source of wrong results and slow queries. Learn when conversion happens and how to make it explicit.'},
{h:'Explicit conversion'},
{code:`SELECT CAST('123' AS UNSIGNED), CAST(12.5 AS SIGNED), CAST('2026-03-01' AS DATE);
SELECT CONVERT('abc' USING utf8mb4);
SELECT CAST(price AS CHAR) FROM products;
SELECT CAST('12abc' AS UNSIGNED);        -- 12, with a warning`},
{h:'Surprising comparisons'},
{t:[['Expression','Result','Why'],
['`\'abc\' = 0`','1 (true)','The string is converted to a number, becoming 0'],
['`\'10\' = 10`','1','String is converted to number'],
['`\'10\' < \'9\'`','1','Both are strings, compared character by character'],
['`\'1a\' = 1`','1','Leading digits are used, with a warning'],
['`0.1 + 0.2 = 0.3` with DOUBLE','0','Binary floating point rounding'],
['`NULL = NULL`','NULL','Unknown']]},
{h:'Conversion and indexes'},
{p:'If you compare a **string column** with a **number**, MySQL converts the column value of every row to a number, so the index on the column cannot be used. The reverse (number column compared with a string constant) is fine, because the constant is converted once.'},
{code:`-- phone is VARCHAR with an index
SELECT * FROM contacts WHERE phone = 5551234;      -- converts every row, ignores the index
SELECT * FROM contacts WHERE phone = '5551234';    -- uses the index`},
{p:'The same happens when comparing columns with different character sets or collations, or a DATETIME column with a TIMESTAMP value in another zone. Always compare like with like: the right type, character set and collation.'},
{h:'Dates'},
{ul:['`\'2026-03-01\'` compared with a DATE column is converted to a date. This is safe.','Comparing a DATETIME with a DATE string means midnight: `dt <= \'2026-03-01\'` excludes the rest of that day.','`STR_TO_DATE` returns NULL (or an error in strict mode) for invalid dates.']},
{h:'How to stay safe'},
{ul:['Make column types match the values you compare with. Store numbers as numbers and dates as dates.','Cast explicitly when you must convert, and cast the **constant**, not the column.','Look at the **warnings** (`SHOW WARNINGS`): "Truncated incorrect DOUBLE value" signals an unintended conversion.','Check `EXPLAIN` when an expected index is not used. A hidden conversion is a frequent cause.']}],
src:[['Type conversion in expression evaluation',K.D+'type-conversion.html'],['Cast functions',K.D+'cast-functions.html']]};
})();
