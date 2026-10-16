/* LearnSphere - MySQL, Section 08: Views & Stored Programs.
   Lectures 0-7 are core. Needs mysql-common.js. Uses the shop sample database from section 3. */
(function(){
const K=window.MY,L=window.LESSONS;

const view=K.dg(700,170,[
[10,10,680,150,'A view is a stored query, not stored data',1],
[25,60,150,50,'Application|SELECT FROM view',0],[225,60,200,50,'View definition|stored SELECT',2],[475,60,190,50,'Base tables|real data',0]],
[[175,85,225,85],[425,85,475,85]]);

const programs=K.dg(700,190,[
[10,10,680,170,'Stored program types',1],
[25,50,150,100,'Procedure|CALL name(args)|IN, OUT, INOUT|DML, transactions',2],[195,50,150,100,'Function|used in expressions|returns one value|no transactions',0],[365,50,150,100,'Trigger|fires on INSERT,|UPDATE, DELETE|BEFORE or AFTER',0],[535,50,140,100,'Event|runs on a schedule|needs scheduler|like cron',0]],[]);

const trg=K.dg(700,160,[
[10,10,680,140,'Trigger timing for an UPDATE',1],
[25,60,130,50,'UPDATE statement|arrives',0],[190,60,150,50,'BEFORE UPDATE|NEW can be changed',2],[375,60,130,50,'Row is|changed',0],[540,60,130,50,'AFTER UPDATE|log or propagate',2]],
[[155,85,190,85],[340,85,375,85],[505,85,540,85]]);

/* ---------- 0 ---------- */
L['mysql:7:0']={blocks:[
{p:'A **view** is a saved `SELECT` with a name. Queries use it like a table, but no data is stored in the view: the server runs the saved query each time.'},
{svg:view},
{code:`CREATE VIEW v_order_summary AS
SELECT o.id AS order_id, c.name AS customer, o.order_date, o.status, o.total
FROM orders o
JOIN customers c ON c.id = o.customer_id;

SELECT * FROM v_order_summary WHERE status = 'paid' ORDER BY order_date;
CREATE OR REPLACE VIEW v_order_summary AS ...;   -- redefine
DROP VIEW IF EXISTS v_order_summary;
SHOW CREATE VIEW v_order_summary\\G`},
{h:'Why use views'},
{ul:['**Simplify**: hide a complex join or calculation behind a name.','**Consistency**: one definition of a business rule, such as active customers.','**Security**: expose selected columns or rows to a user without granting access to the base table.','**Compatibility**: keep an old table shape for existing code while the real tables change.']},
{h:'Updatable views'},
{p:'A simple view over one table (no aggregates, DISTINCT, GROUP BY, UNION or similar) is **updatable**: INSERT, UPDATE and DELETE on the view change the base table. Join views can sometimes be updated, one base table at a time.'},
{code:`CREATE VIEW v_open_orders AS
SELECT id, customer_id, status, total FROM orders WHERE status IN ('new','paid')
WITH CHECK OPTION;

UPDATE v_open_orders SET status = 'shipped' WHERE id = 5;
-- ERROR 1369: CHECK OPTION failed. The row would leave the view.`},
{p:'`WITH CHECK OPTION` refuses changes that would make a row disappear from the view, which keeps a view-based interface honest.'},
{h:'Algorithms'},
{t:[['ALGORITHM','Behaviour'],
['MERGE','The view query is merged into the outer query. Preferred and fastest, allows index use and updates'],
['TEMPTABLE','The view result is materialised in a temporary table first. Needed for aggregates, DISTINCT, UNION'],
['UNDEFINED (default)','MySQL chooses, preferring MERGE']]},
{h:'Security options'},
{ul:['`DEFINER` is the account whose privileges the view runs with. `SQL SECURITY DEFINER` (default) runs with the definer rights, `SQL SECURITY INVOKER` with the caller rights.','Give users `SELECT` on the view only. They then read the allowed columns without any privilege on the base tables.','If the definer account is dropped, the view stops working. Use a dedicated account.']},
{note:'MySQL has no materialised views. For stored results, use a summary table refreshed by a job or an event.'}],
src:[['CREATE VIEW',K.D+'create-view.html'],['Updatable and insertable views',K.D+'view-updatability.html']]};

/* ---------- 1 ---------- */
L['mysql:7:1']={blocks:[
{h:'User-defined variables'},
{p:'A user variable starts with `@`, needs no declaration and lasts for the connection. Its type follows the last value assigned.'},
{code:`SET @min_total = 100;
SELECT id, total FROM orders WHERE total > @min_total;
SELECT @max_id := MAX(id) FROM orders;      -- assign inside a query (deprecated style)
SELECT @max_id;
SELECT MAX(id) INTO @max_id FROM orders;    -- preferred`},
{p:'Variables are private to the session and disappear when it ends. They are not safe to use for logic that depends on evaluation order inside a single statement.'},
{h:'Prepared statements'},
{p:'A **prepared statement** is parsed once and executed many times with different values. The parameters are sent separately from the SQL text, which is the main defence against **SQL injection** and often reduces parsing work.'},
{code:`PREPARE find_orders FROM 'SELECT id, total FROM orders WHERE customer_id = ? AND status = ?';
SET @c = 1, @s = 'paid';
EXECUTE find_orders USING @c, @s;
DEALLOCATE PREPARE find_orders;`},
{ul:['`?` is a placeholder for a **value**. You cannot use a placeholder for a table or column name.','Application drivers use the binary protocol for real server-side prepared statements, or emulate them on the client. Check your connector setting for server-side preparation.','Prepared statements live for the connection. `max_prepared_stmt_count` limits how many exist server-wide. A leak of unclosed statements can exhaust it.']},
{h:'Dynamic SQL'},
{p:'When the SQL text itself must vary, such as the table name, build the string and prepare it. Whitelist and quote the identifiers, never concatenate raw user input.'},
{code:`SET @tbl = 'orders';
SET @sql = CONCAT('SELECT COUNT(*) FROM ', @tbl);
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;`},
{note:'Anything that goes into the SQL text rather than into a placeholder is an injection risk. Section 13 shows the attack and the defence.'}],
src:[['User-defined variables',K.D+'user-variables.html'],['Prepared statements',K.D+'sql-prepared-statements.html']]};

/* ---------- 2 ---------- */
L['mysql:7:2']={blocks:[
{p:'A **stored procedure** is a named block of SQL and control logic saved in the server. You run it with `CALL`. It can take parameters, run several statements, manage a transaction and return results.'},
{svg:programs},
{code:`DELIMITER //
CREATE PROCEDURE place_order (
  IN  p_customer INT UNSIGNED,
  IN  p_product  INT UNSIGNED,
  IN  p_qty      INT,
  OUT p_order_id INT UNSIGNED
)
BEGIN
  DECLARE v_price DECIMAL(10,2);
  SELECT price INTO v_price FROM products WHERE id = p_product;

  START TRANSACTION;
  INSERT INTO orders (customer_id, order_date, status, total)
  VALUES (p_customer, CURDATE(), 'new', v_price * p_qty);
  SET p_order_id = LAST_INSERT_ID();
  INSERT INTO order_items (order_id, product_id, qty, price)
  VALUES (p_order_id, p_product, p_qty, v_price);
  COMMIT;
END //
DELIMITER ;

CALL place_order(2, 3, 1, @new_id);
SELECT @new_id;`},
{p:'`DELIMITER` is a **client** command. It lets the client send the whole body, which contains semicolons, as one statement. It is not needed when the body is sent through a connector or a tool that handles it.'},
{h:'Parameters'},
{t:[['Mode','Meaning'],
['IN (default)','Value passed in. Changes inside are not visible to the caller'],
['OUT','Starts as NULL, value set inside is returned'],
['INOUT','Passed in and returned changed']]},
{h:'Managing procedures'},
{code:`SHOW PROCEDURE STATUS WHERE Db = 'shop';
SHOW CREATE PROCEDURE place_order\\G
DROP PROCEDURE IF EXISTS place_order;
GRANT EXECUTE ON PROCEDURE shop.place_order TO 'app'@'%';`},
{h:'Result sets'},
{p:'A procedure can return rows to the caller by running a plain `SELECT`. The client then reads one or more result sets. Multiple result sets need a client that supports them.'},
{h:'Advantages and costs'},
{ul:['Fewer round trips for multi-step work and a single place for the logic.','Permissions: users can run a procedure without access to the tables underneath.','Cost: logic outside the application code, harder to test and version, not portable, runs on the primary server and uses its CPU.']}],
src:[['CREATE PROCEDURE',K.D+'create-procedure.html'],['Stored routines',K.D+'stored-routines.html']]};

/* ---------- 3 ---------- */
L['mysql:7:3']={blocks:[
{p:'A **stored function** returns exactly one value and can be used inside expressions, like a built-in function. Use it for small, reusable calculations.'},
{code:`DELIMITER //
CREATE FUNCTION order_size (p_total DECIMAL(10,2))
RETURNS VARCHAR(10)
DETERMINISTIC
BEGIN
  RETURN CASE
    WHEN p_total >= 500 THEN 'large'
    WHEN p_total >= 100 THEN 'medium'
    ELSE 'small'
  END;
END //
DELIMITER ;

SELECT id, total, order_size(total) AS size FROM orders;`},
{h:'Characteristics'},
{t:[['Characteristic','Meaning'],
['DETERMINISTIC','Same input always gives the same output. Required for use in some contexts and for binary logging when enabled'],
['NOT DETERMINISTIC','Result can change, for example it uses NOW() or RAND()'],
['READS SQL DATA','Reads tables but does not change them'],
['MODIFIES SQL DATA','Changes data'],
['NO SQL, CONTAINS SQL','No SQL statements, or SQL but no data access']]},
{p:'When the binary log is on, MySQL requires you to declare a function as `DETERMINISTIC`, `NO SQL` or `READS SQL DATA`, or else creation fails unless the creator holds the `SET_USER_ID` privilege or `log_bin_trust_function_creators` is 1. The reason is that a wrongly declared function can produce different results on a replica.'},
{h:'Restrictions'},
{ul:['No transactions (`COMMIT`, `ROLLBACK`), and no statements that return a result set to the client.','A function that modifies data cannot be called from a statement that reads the same table in some cases.','Functions are called **per row** when used in `SELECT` or `WHERE`. A slow function on a big table is multiplied by the row count, and usually prevents index use on that expression.']},
{h:'Function or procedure?'},
{t:[['Use a function when','Use a procedure when'],
['You need a value inside a query','You perform a multi-step action'],
['The logic is small and deterministic','You need transactions or several result sets'],
['You want to reuse an expression','You return values through OUT parameters']]},
{note:'Built-in functions are implemented in C and are faster than stored functions. A stored function calling SQL inside a per-row call can be very slow on large tables. Test with realistic data.'}],
src:[['CREATE FUNCTION',K.D+'create-procedure.html'],['Stored program binary logging',K.D+'stored-programs-logging.html']]};

/* ---------- 4 ---------- */
L['mysql:7:4']={blocks:[
{p:'Inside the body of a stored program you can use variables, branches, loops, cursors and error handling. This is the **compound statement** language, available only inside `BEGIN ... END`.'},
{h:'Variables and branching'},
{code:`DECLARE v_count INT DEFAULT 0;
SELECT COUNT(*) INTO v_count FROM orders WHERE customer_id = p_customer;

IF v_count = 0 THEN
  SET v_label = 'new';
ELSEIF v_count < 5 THEN
  SET v_label = 'regular';
ELSE
  SET v_label = 'loyal';
END IF;

CASE p_status
  WHEN 'paid' THEN SET v_next = 'ship';
  ELSE SET v_next = 'wait';
END CASE;`},
{h:'Loops'},
{code:`WHILE v_i <= 10 DO
  SET v_i = v_i + 1;
END WHILE;

REPEAT
  SET v_i = v_i - 1;
UNTIL v_i = 0 END REPEAT;

my_loop: LOOP
  SET v_i = v_i + 1;
  IF v_i > 10 THEN LEAVE my_loop; END IF;
END LOOP;`},
{h:'Cursors'},
{p:'A **cursor** reads a query result one row at a time. Use it only when set-based SQL cannot do the job: cursors are much slower than a single statement over all rows.'},
{code:`DECLARE done INT DEFAULT 0;
DECLARE v_id INT;
DECLARE cur CURSOR FOR SELECT id FROM orders WHERE status = 'new';
DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

OPEN cur;
read_loop: LOOP
  FETCH cur INTO v_id;
  IF done = 1 THEN LEAVE read_loop; END IF;
  -- process v_id
END LOOP;
CLOSE cur;`},
{p:'Declarations must come in order: variables, conditions, cursors, then handlers.'},
{h:'Error handlers'},
{code:`DECLARE EXIT HANDLER FOR SQLEXCEPTION
BEGIN
  GET DIAGNOSTICS CONDITION 1 @sqlstate = RETURNED_SQLSTATE, @msg = MESSAGE_TEXT;
  ROLLBACK;
  RESIGNAL;                         -- pass the error to the caller
END;

DECLARE CONTINUE HANDLER FOR 1062 SET v_dup = 1;     -- a specific error number

-- raise your own error
IF p_qty <= 0 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantity must be positive';
END IF;`},
{ul:['`EXIT` handlers end the block, `CONTINUE` handlers resume after the statement that failed.','A handler can match a SQLSTATE, an error number, `SQLWARNING`, `NOT FOUND` or `SQLEXCEPTION`.','`SIGNAL` raises an error, `RESIGNAL` re-raises one, and `GET DIAGNOSTICS` reads details.']},
{note:'A procedure can run transaction control, so decide who owns the transaction. A common pattern is: the procedure starts the transaction, uses an EXIT HANDLER to roll back and re-signal, and commits at the end.'}],
src:[['Compound statements',K.D+'sql-compound-statements.html'],['Condition handling',K.D+'condition-handling.html']]};

/* ---------- 5 ---------- */
L['mysql:7:5']={blocks:[
{p:'A **trigger** runs automatically before or after an `INSERT`, `UPDATE` or `DELETE` on a table, once for each affected row. Triggers enforce rules and keep related data in step without relying on every application.'},
{svg:trg},
{code:`CREATE TRIGGER trg_orders_bi
BEFORE INSERT ON orders FOR EACH ROW
BEGIN
  IF NEW.total < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Total cannot be negative';
  END IF;
  SET NEW.status = LOWER(NEW.status);          -- adjust the incoming row
END;

CREATE TABLE order_audit (
  id INT AUTO_INCREMENT PRIMARY KEY, order_id INT, old_status VARCHAR(20), new_status VARCHAR(20),
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP, changed_by VARCHAR(100));

CREATE TRIGGER trg_orders_au
AFTER UPDATE ON orders FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO order_audit (order_id, old_status, new_status, changed_by)
    VALUES (OLD.id, OLD.status, NEW.status, USER());
  END IF;
END;`},
{h:'Rules'},
{t:[['Aspect','Detail'],
['Timing and event','BEFORE or AFTER, and INSERT, UPDATE or DELETE. Several triggers per event are allowed and ordered with FOLLOWS or PRECEDES'],
['OLD and NEW','OLD holds the row before the change, NEW the row after. INSERT has only NEW, DELETE only OLD'],
['BEFORE triggers','Can change NEW values and reject the row with SIGNAL'],
['AFTER triggers','Cannot change NEW. Use them for logging and side effects'],
['Not allowed','Transaction control statements, and changes to the table that fired the trigger'],
['Foreign key actions','Cascaded changes made by foreign keys do **not** fire triggers']]},
{h:'The hidden costs'},
{ul:['Triggers are **invisible** to people reading the application code. Behaviour appears from nowhere.','They run for every row, so a bulk update fires them millions of times.','They add work inside the transaction, lengthening locks.','Chains of triggers are hard to debug. Keep them small.']},
{h:'Good uses'},
{ul:['Audit trails of important changes.','Validation that cannot be expressed as a constraint.','Maintaining a small summary or counter in the same transaction.']},
{code:`SHOW TRIGGERS FROM shop;
SHOW CREATE TRIGGER trg_orders_bi\\G
DROP TRIGGER IF EXISTS trg_orders_bi;`},
{note:'Prefer constraints (NOT NULL, CHECK, FOREIGN KEY, UNIQUE) over triggers whenever one can express the rule. They are declarative, visible and cheaper.'}],
src:[['CREATE TRIGGER',K.D+'create-trigger.html'],['Using triggers',K.D+'triggers.html']]};

/* ---------- 6 ---------- */
L['mysql:7:6']={blocks:[
{p:'The **Event Scheduler** runs SQL on a schedule inside the server, like a small cron. It suits housekeeping that belongs next to the data: purging old rows, refreshing summary tables, rolling partitions.'},
{h:'Turn it on'},
{code:`SHOW VARIABLES LIKE 'event_scheduler';
SET PERSIST event_scheduler = ON;`},
{h:'Creating events'},
{code:`-- every night at 02:00
CREATE EVENT ev_purge_logs
ON SCHEDULE EVERY 1 DAY STARTS '2026-01-01 02:00:00'
DO
  DELETE FROM app_logs WHERE created_at < NOW() - INTERVAL 30 DAY LIMIT 10000;

-- one time
CREATE EVENT ev_once
ON SCHEDULE AT CURRENT_TIMESTAMP + INTERVAL 1 HOUR
DO CALL rebuild_summary();

-- complex body
DELIMITER //
CREATE EVENT ev_daily_summary ON SCHEDULE EVERY 1 DAY
DO BEGIN
  REPLACE INTO daily_sales
  SELECT order_date, COUNT(*), SUM(total) FROM orders GROUP BY order_date;
END //
DELIMITER ;`},
{h:'Managing events'},
{code:`SHOW EVENTS FROM shop;
SELECT event_name, status, last_executed, on_completion FROM information_schema.events;
ALTER EVENT ev_purge_logs DISABLE;
DROP EVENT IF EXISTS ev_purge_logs;`},
{h:'Behaviour to know'},
{ul:['Events run as the account that created them (the definer) and need the `EVENT` privilege.','An event may take longer than its interval. MySQL does not run the same event twice at once, and skips a run that would overlap.','`ON COMPLETION PRESERVE` keeps a one-time event after it has run. Otherwise it is dropped.','Errors go to the error log. Without monitoring, a failing event can stay unnoticed for months.','Events are **not** replicated as executions: the definition is replicated, and a replica marks them `REPLICA_SIDE_DISABLED` so they do not also run there. After a failover you must enable them on the new primary.','Time zone: the schedule uses the session time zone of the creating session.']},
{note:'For heavy or critical jobs, an external scheduler (cron, a workflow tool) gives better logging, retry, alerting and control than the Event Scheduler.'}],
src:[['Using the Event Scheduler',K.D+'event-scheduler.html'],['CREATE EVENT',K.D+'create-event.html']]};

/* ---------- 7 ---------- */
L['mysql:7:7']={blocks:[
{p:'Putting logic in the database is a design choice with trade-offs. This lesson covers the security model, deployment habits and a rule of thumb for deciding.'},
{h:'DEFINER and SQL SECURITY'},
{t:[['Setting','Behaviour'],
['`DEFINER = user`','The account stored with the object. Default is the creator'],
['`SQL SECURITY DEFINER` (default)','Runs with the definer privileges. Lets users do controlled actions they could not do directly'],
['`SQL SECURITY INVOKER`','Runs with the caller privileges. Users need access to the underlying tables']]},
{ul:['A `DEFINER` routine is a **privilege escalation tool**. Keep definer accounts narrow, not root.','If the definer account is dropped, the object fails with an error. Create a dedicated account for ownership.','Grant `EXECUTE` on only the routines an application needs.','After a dump and restore, definers must exist on the target server.']},
{h:'Deployment'},
{ul:['Keep every definition in **source control** as a script, with the DROP and CREATE in one file. The server does not track versions for you.','Deploy with a migration tool and apply the change on all environments in the same order.','Use `mysqldump --routines --triggers --events` or MySQL Shell dump to include them in backups (triggers are dumped by default).','Test with realistic row counts. A routine that is fast on ten rows can be slow on ten million.']},
{h:'Binary logging and replication'},
{ul:['With the binary log on, a routine must declare `DETERMINISTIC`, `NO SQL` or `READS SQL DATA`, unless `log_bin_trust_function_creators` is set.','Row-based logging records the changed rows rather than the logic, so non-deterministic code replicates safely. Statement-based logging may diverge.','Triggers and routines run **on the replica too** under statement-based logging. With row-based logging, only the resulting row changes are applied.']},
{h:'Where logic should live'},
{t:[['Keep in the application','Good in the database'],
['Business rules that change often and need unit tests','Integrity rules that must hold regardless of the client (constraints)'],
['Complex workflows, calling external services','Set-based batch work next to the data'],
['Logic shared with other systems or APIs','Audit logging that every client must trigger'],
['Anything that needs portability across databases','Controlled access paths through DEFINER procedures']]},
{note:'MySQL 9 adds JavaScript stored programs in the Enterprise and HeatWave editions. In Community, stored code is written in SQL. For most teams the guideline is: constraints and a few well-tested routines in the database, and the rest of the logic in application code.'}],
src:[['Stored object access control',K.D+'stored-objects-security.html'],['Stored program binary logging',K.D+'stored-programs-logging.html']]};
})();
