/* LearnSphere - MySQL, Section 10: Transactions & Locking.
   Lectures 0-7 are core. Needs mysql-common.js. */
(function(){
const K=window.MY,L=window.LESSONS;

const acid=K.dg(700,170,[
[10,10,680,150,'ACID',1],
[25,60,150,60,'Atomicity|all or nothing|undo log',0],[195,60,150,60,'Consistency|rules always hold|constraints',0],[365,55,150,70,'Isolation|work does not|interfere: MVCC,|locks',2],[535,60,140,60,'Durability|committed stays|redo log',0]],[]);

const mvcc=K.dg(700,210,[
[10,10,680,190,'MVCC: two sessions, one row (REPEATABLE READ)',1],
[25,50,200,50,'Session A: BEGIN|SELECT balance = 100',0],[25,120,200,50,'Session A: SELECT again|still 100',2],
[255,50,200,50,'Session B: UPDATE to 150|COMMIT',0],[485,50,190,50,'Row now 150|old version 100 in undo',0],[485,120,190,50,'A reads version 100|from undo via read view',2]],
[[225,75,255,75],[455,75,485,75],[225,145,485,145]]);

const gap=K.dg(700,170,[
[10,10,680,150,'Locks on an index with values 10, 20, 30 (REPEATABLE READ)',1],
[25,60,80,50,'gap|below 10',0],[115,60,70,50,'10',2],[195,60,90,50,'gap|10 to 20',0],[295,60,70,50,'20',2],[375,60,90,50,'gap|20 to 30',0],[475,60,70,50,'30',2],[555,60,120,50,'gap|above 30',0]],[]);

const dead=K.dg(700,190,[
[10,10,680,170,'A deadlock',1],
[40,50,230,50,'Txn 1 holds row 1, wants row 2',0],[430,50,230,50,'Txn 2 holds row 2, wants row 1',0],
[40,125,230,40,'Waits for Txn 2',0],[430,125,230,40,'Waits for Txn 1',0]],
[[155,100,155,125],[545,100,545,125],[270,145,430,145],[430,135,270,135]]);

/* ---------- 0 ---------- */
L['mysql:9:0']={blocks:[
{p:'**ACID** names the four guarantees of a transaction. InnoDB provides all four, but application code must still use transactions correctly to benefit.'},
{svg:acid},
{t:[['Property','Meaning','InnoDB mechanism','What can still go wrong'],
['Atomicity','All statements succeed or none do','Undo log, rollback','Autocommit splits one business action into several transactions'],
['Consistency','Data moves from one valid state to another','Constraints, foreign keys, triggers','Rules not in the schema can be broken by application bugs'],
['Isolation','Concurrent transactions do not see each other half done','MVCC and locks','Wrong isolation level or read-then-write races'],
['Durability','Committed data survives crashes','Redo log, doublewrite, binlog flush','Relaxed flush settings']]},
{h:'Transaction boundaries'},
{p:'The **application** decides the boundary: one business operation is one transaction. Two statements that must go together (debit and credit) belong in one `START TRANSACTION ... COMMIT`. Running them in autocommit mode gives no atomicity, and a failure between them leaves money missing.'},
{code:`START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE id = 1 AND balance >= 100;
-- check ROW_COUNT() = 1, else ROLLBACK
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
INSERT INTO transfers (from_id, to_id, amount) VALUES (1, 2, 100);
COMMIT;`},
{p:'Notice that the update is written as `balance = balance - 100` and guarded by the `balance >= 100` condition. A **single atomic statement** is safer than reading the balance, computing in the application and writing it back.'},
{h:'Consistency is a shared job'},
{p:'The database can enforce rules only if you declare them: NOT NULL, UNIQUE, CHECK and FOREIGN KEY. A rule that exists only in code can be bypassed by another client, a script or a bug.'},
{h:'Durability trade-offs'},
{p:'Durability depends on `innodb_flush_log_at_trx_commit` and `sync_binlog`. The defaults (1 and 1) make each commit durable at the cost of a disk flush. Replication adds another layer: a committed transaction that is not yet on a replica is lost if the primary fails and a replica is promoted, unless semi-synchronous or group replication is used.'},
{note:'In everyday MySQL work, "isolation" is the property you reason about most. The next lessons explain how InnoDB provides it.'}],
src:[['InnoDB and the ACID model',K.D+'mysql-acid.html'],['Transactional and locking statements',K.D+'sql-transactional-statements.html']]};

/* ---------- 1 ---------- */
L['mysql:9:1']={blocks:[
{p:'**Isolation levels** define how much one transaction can see of another. Lower levels allow more anomalies in exchange for less locking. The SQL standard defines four, and InnoDB implements all of them.'},
{h:'The anomalies'},
{t:[['Anomaly','Description','Example'],
['Dirty read','Reading data another transaction changed but has not committed','You see a balance that is later rolled back'],
['Non-repeatable read','Reading the same row twice and getting different values because another transaction committed in between','Balance 100, then 150'],
['Phantom read','Running the same range query twice and getting different **sets of rows**','A new order appears between two counts']]},
{h:'The levels'},
{t:[['Level','Dirty read','Non-repeatable read','Phantom read','Notes for InnoDB'],
['READ UNCOMMITTED','Possible','Possible','Possible','Rarely useful. Effectively no isolation'],
['READ COMMITTED','No','Possible','Possible','New snapshot for every statement. Few gap locks'],
['REPEATABLE READ (default)','No','No','No for snapshot reads, guarded by next-key locks for locking reads','One snapshot for the whole transaction'],
['SERIALIZABLE','No','No','No','Plain SELECT becomes locking read. Lowest concurrency']]},
{code:`SELECT @@transaction_isolation;
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET GLOBAL  TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;      -- only for the next transaction`},
{h:'Choosing a level'},
{ul:['**REPEATABLE READ** is InnoDB default and a sound choice. A transaction sees a stable snapshot, which makes reports and multi-step reads consistent.','**READ COMMITTED** reduces locking (fewer gap locks) and deadlocks and is common in high-concurrency web systems. Each statement sees the latest committed data. Row-based binary logging is required.','**SERIALIZABLE** is for rare strictness. Reads take shared locks, so concurrency drops sharply.','Do not use **READ UNCOMMITTED** in normal applications.']},
{h:'What the levels do not solve'},
{p:'No level fixes the **lost update** by itself. If two transactions read the same value with plain `SELECT` and both write back a result computed in the application, the second write overwrites the first. Use an atomic update (`SET qty = qty - 1`), a locking read (`FOR UPDATE`) or a version check in `WHERE`.'},
{code:`-- Session A and B both run this at the same time with a plain SELECT:
SELECT qty FROM stock WHERE product_id = 1;      -- both read 5
UPDATE stock SET qty = 4 WHERE product_id = 1;   -- both write 4, one decrement is lost

-- Safe:
UPDATE stock SET qty = qty - 1 WHERE product_id = 1 AND qty > 0;`}],
src:[['Transaction isolation levels',K.D+'innodb-transaction-isolation-levels.html'],['SET TRANSACTION',K.D+'set-transaction.html']]};

/* ---------- 2 ---------- */
L['mysql:9:2']={blocks:[
{p:'**MVCC (multi-version concurrency control)** lets readers and writers work at the same time without blocking each other. InnoDB keeps old versions of changed rows in the undo log and shows each transaction the version it is entitled to see.'},
{svg:mvcc},
{h:'How it works'},
{ul:['Every row carries hidden fields: the id of the last transaction that changed it and a pointer to its previous version in the undo log.','A **read view** is a snapshot of which transactions were committed at a moment: it lists active transaction ids.','A consistent read walks the version chain until it finds a version created by a transaction that the read view regards as committed.','In **REPEATABLE READ** the read view is created at the **first consistent read** of the transaction and reused. In **READ COMMITTED** a new one is created for every statement.']},
{h:'Consistent (snapshot) reads versus current reads'},
{t:[['Kind','Statements','Sees','Locks'],
['Consistent read','Plain `SELECT`','The snapshot of the read view','None'],
['Current read','`SELECT ... FOR UPDATE`, `FOR SHARE`, `UPDATE`, `DELETE`, `INSERT`','The **latest committed** row version','Takes row and gap locks']]},
{p:'This explains a classic puzzle. In REPEATABLE READ a transaction may `SELECT` a row and see the old value, then `UPDATE` it and succeed, and a following `SELECT` shows the new value, because the update was a **current read** on the latest data. Writes always work on the latest version.'},
{code:`-- Session A
START TRANSACTION;
SELECT balance FROM accounts WHERE id = 1;        -- 100  (snapshot taken)

-- Session B
UPDATE accounts SET balance = 150 WHERE id = 1;   -- autocommit

-- Session A
SELECT balance FROM accounts WHERE id = 1;        -- still 100 (REPEATABLE READ)
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;   -- 150 (current read)
COMMIT;`},
{h:'Costs and consequences'},
{ul:['Old versions occupy **undo** space until purged. A long transaction keeps all versions newer than its snapshot.','Searching long version chains slows reads on heavily updated rows.','Start a snapshot on demand with `START TRANSACTION WITH CONSISTENT SNAPSHOT`, which is how consistent backups of InnoDB tables are taken without locking.','Use `START TRANSACTION READ ONLY` for read-only work. It allows some optimisations.']},
{note:'A transaction that just sits open after a SELECT in REPEATABLE READ holds its snapshot, and therefore prevents purge from cleaning up. Close transactions promptly, also for readers.'}],
src:[['InnoDB multi-versioning',K.D+'innodb-multi-versioning.html'],['Consistent nonlocking reads',K.D+'innodb-consistent-read.html']]};

/* ---------- 3 ---------- */
L['mysql:9:3']={blocks:[
{p:'InnoDB uses **row-level locks** taken on **index records**. Which locks a statement takes, and how many rows it blocks, depends on the isolation level and on the **index** the statement uses.'},
{h:'Lock modes'},
{t:[['Lock','Meaning'],
['Shared (S)','Allows reading. Several transactions can hold S on a row, none can write'],
['Exclusive (X)','Allows changing or deleting. Only one holder, blocks S and X'],
['Intention (IS, IX)','Table-level signals that a transaction intends to lock rows. Let table locks coexist with row locks'],
['Auto-inc','A short table lock while generating AUTO_INCREMENT values']]},
{h:'Lock types by what they cover'},
{svg:gap},
{t:[['Lock','Covers','Purpose'],
['Record lock','One index record','Protect a specific row'],
['Gap lock','The space **between** index records','Prevent other transactions inserting into the gap, preventing phantoms'],
['Next-key lock','A record plus the gap before it','Default for searches and index scans in REPEATABLE READ'],
['Insert intention lock','A gap, taken by an insert','Lets inserts into different positions of the same gap proceed in parallel']]},
{p:'Gap locks only block **inserts** into the gap. Several transactions can hold a gap lock on the same gap, because they do not conflict with each other.'},
{h:'The index decides the damage'},
{code:`-- orders has an index on customer_id, none on status
START TRANSACTION;
UPDATE orders SET status = 'x' WHERE customer_id = 2;   -- locks matching index records and the gaps near them
UPDATE orders SET status = 'x' WHERE status = 'paid';   -- no index: scans the clustered index and locks every row it visits!`},
{p:'Without a usable index on the filter column, InnoDB scans the whole table and **locks every row it examines**, so concurrent writers wait. Many production incidents come from a missing index on an `UPDATE` or `DELETE` condition.'},
{h:'Isolation level and gaps'},
{ul:['In **REPEATABLE READ**, range conditions take next-key locks. This blocks inserts into the range, which prevents phantoms for locking reads.','In **READ COMMITTED**, gap locking is largely disabled (it remains for foreign key and duplicate-key checks). Rows that do not match the WHERE are unlocked after the statement evaluates them. This reduces blocking and deadlocks.','A unique lookup of an **existing** row with a unique index takes only a record lock. A lookup of a missing value locks the gap.']},
{h:'See current locks'},
{code:`SELECT engine_transaction_id, object_name, index_name, lock_type, lock_mode, lock_status, lock_data
FROM performance_schema.data_locks;
SELECT * FROM performance_schema.data_lock_waits;`}],
src:[['InnoDB locking',K.D+'innodb-locking.html'],['Locks set by SQL statements',K.D+'innodb-locks-set.html'],['data_locks table',K.D+'performance-schema-data-locks-table.html']]};

/* ---------- 4 ---------- */
L['mysql:9:4']={blocks:[
{p:'A **locking read** reads data and locks it so that no one else changes it until your transaction ends. Use it when you must read a value and then base a change on it.'},
{t:[['Statement','Lock','Use'],
['`SELECT ... FOR UPDATE`','Exclusive','Read, then change the row. Blocks other writers and other locking readers'],
['`SELECT ... FOR SHARE`','Shared','Read and make sure the row cannot change. Others may also share-lock it'],
['`... FOR UPDATE NOWAIT`','Exclusive','Fail immediately if the row is locked'],
['`... FOR UPDATE SKIP LOCKED`','Exclusive','Skip locked rows. For work queues']]},
{p:'`FOR SHARE` replaces the older `LOCK IN SHARE MODE`. `NOWAIT` and `SKIP LOCKED` are available since 8.0.1.'},
{h:'Read-modify-write safely'},
{code:`START TRANSACTION;
SELECT qty FROM stock WHERE product_id = 1 FOR UPDATE;    -- row is now locked
-- application checks qty >= 1
UPDATE stock SET qty = qty - 1 WHERE product_id = 1;
COMMIT;`},
{p:'Another transaction trying the same sequence waits at the `SELECT ... FOR UPDATE` until the first commits, so no update is lost. The lock is released at commit or rollback, so **keep the transaction short**.'},
{h:'Work queue with SKIP LOCKED'},
{p:'Several workers need to take jobs without waiting for each other. `SKIP LOCKED` hands each worker different unlocked rows.'},
{code:`START TRANSACTION;
SELECT id, payload FROM jobs
WHERE status = 'pending'
ORDER BY id
LIMIT 1
FOR UPDATE SKIP LOCKED;

-- process the job, then:
UPDATE jobs SET status = 'done' WHERE id = :id;
COMMIT;`},
{h:'Optimistic alternative'},
{p:'Instead of locking, add a `version` column and make the write conditional. If another transaction changed the row, the update affects zero rows and you retry.'},
{code:`UPDATE stock SET qty = qty - 1, version = version + 1
WHERE product_id = 1 AND version = 7;
-- ROW_COUNT() = 0 means someone else changed it first`},
{t:[['Strategy','Good when','Cost'],
['Pessimistic (FOR UPDATE)','Conflicts are common and retries are expensive','Waiting, deadlock risk, locks held'],
['Optimistic (version check)','Conflicts are rare','Retry logic in the application'],
['Atomic update statement','The change is a simple calculation','None. Best when possible']]},
{note:'A locking read on a range without a good index locks a lot. Always check that the WHERE of a FOR UPDATE can use an index.'}],
src:[['Locking reads',K.D+'innodb-locking-reads.html'],['SELECT ... FOR UPDATE',K.D+'select.html']]};

/* ---------- 5 ---------- */
L['mysql:9:5']={blocks:[
{p:'A **deadlock** happens when transactions wait for each other in a cycle, so none can proceed. InnoDB detects the cycle automatically and rolls back one transaction, the **victim**, which receives error `1213`.'},
{svg:dead},
{code:`-- Session 1                                   -- Session 2
START TRANSACTION;                              START TRANSACTION;
UPDATE t SET v = 1 WHERE id = 1;                UPDATE t SET v = 1 WHERE id = 2;
UPDATE t SET v = 1 WHERE id = 2;  -- waits     UPDATE t SET v = 1 WHERE id = 1;  -- deadlock
-- ERROR 1213 (40001): Deadlock found when trying to get lock; try restarting transaction`},
{h:'Deadlock versus lock wait timeout'},
{t:[['','Deadlock','Lock wait timeout'],
['Error','1213','1205: Lock wait timeout exceeded'],
['Cause','A wait cycle','One transaction holds a lock for too long'],
['Resolution','Immediate, InnoDB picks a victim (usually the one that changed the fewest rows)','After `innodb_lock_wait_timeout` seconds (default 50). Only the statement is rolled back, not the transaction'],
['Fix','Consistent lock order, shorter transactions, better indexes, retry','Shorten the holder transaction, find the blocker']]},
{h:'Common causes and cures'},
{ul:['**Different lock order.** Always access rows and tables in the same order in every code path.','**Large transactions.** The longer you hold locks, the likelier a clash. Commit in smaller units.','**Missing indexes.** A scan locks many rows. Add an index on the filtered column.','**Gap locks in REPEATABLE READ.** Two transactions each take a gap lock, then both try to insert in the gap. Consider READ COMMITTED.','**Hot rows.** Many sessions updating one counter row. Shard counters or batch the updates.']},
{p:'Deadlocks are **normal** in a busy system. The application must catch error 1213 (and 1205 where appropriate), roll back and **retry** the whole transaction.'},
{h:'Diagnosing'},
{code:`SHOW ENGINE INNODB STATUS\\G              -- see LATEST DETECTED DEADLOCK
SET GLOBAL innodb_print_all_deadlocks = ON;   -- write every deadlock to the error log

SELECT * FROM sys.innodb_lock_waits\\G         -- who blocks whom right now
SELECT trx_id, trx_started, trx_state, trx_query, trx_rows_locked
FROM information_schema.innodb_trx;`},
{p:'The deadlock report names the two transactions, the statements, the locks held and waited for, and which one was rolled back. Read it for the **indexes and rows** involved.'},
{h:'Kill a blocker'},
{code:`SELECT * FROM sys.innodb_lock_waits\\G   -- find blocking_pid
KILL 1234;                                -- ends that connection and rolls back its transaction`},
{note:'Retrying blindly can repeat the deadlock. Add a short random delay and a limit on attempts, and log retries so patterns become visible.'}],
src:[['Deadlocks in InnoDB',K.D+'innodb-deadlocks.html'],['How to minimize and handle deadlocks',K.D+'innodb-deadlocks-handling.html']]};

/* ---------- 6 ---------- */
L['mysql:9:6']={blocks:[
{p:'**Metadata locks (MDL)** protect the **definition** of tables and other objects. Every statement takes a metadata lock on the tables it uses and holds it until the transaction ends. DDL needs an exclusive MDL, so it must wait for all transactions that touched the table.'},
{h:'The pile-up'},
{flow:['Session A runs a SELECT inside a transaction and forgets to commit. It holds a shared MDL on the table','Session B runs ALTER TABLE and waits for an exclusive MDL','Session C runs a plain SELECT. It queues behind B','Every following query on the table queues too, and the application appears frozen']},
{p:'The waiting DDL did not do any work, yet it stopped everything. The culprit is the **open transaction** in session A. This is one of the most common production incidents in MySQL.'},
{h:'Finding the blocker'},
{code:`SELECT * FROM sys.schema_table_lock_waits\\G

SELECT object_schema, object_name, lock_type, lock_status, owner_thread_id
FROM performance_schema.metadata_locks
WHERE object_name = 'orders';

SELECT thread_id, processlist_id, processlist_info
FROM performance_schema.threads WHERE thread_id = 123;
SHOW FULL PROCESSLIST;`},
{p:'In `SHOW PROCESSLIST` the status "Waiting for table metadata lock" identifies the waiting statements. The blocker is often a connection in state `Sleep` with an open transaction (visible in `information_schema.innodb_trx`).'},
{h:'Preventing it'},
{ul:['Keep transactions short and commit read-only transactions too. Do not leave connections idle in a transaction.','Run DDL in quiet periods and set a **short wait** for it: `SET SESSION lock_wait_timeout = 5;` so the DDL fails rather than blocking everyone behind it.','Check for open transactions before a schema change: `SELECT * FROM information_schema.innodb_trx;`.','Use online schema change tools or `ALGORITHM=INSTANT` for changes that avoid long locks.','The default `lock_wait_timeout` is one year. Always lower it for DDL.']},
{h:'Online DDL still needs brief MDLs'},
{p:'Even online operations such as `ADD INDEX` take a short exclusive MDL at the start and at the end. They can still wait behind a long transaction, and block others while waiting.'},
{note:'Application-side defences matter too: connection pools with idle timeouts, transaction timeouts and monitoring of the oldest transaction age (`trx_started`).'}],
src:[['Metadata locking',K.D+'metadata-locking.html'],['metadata_locks table',K.D+'performance-schema-metadata-locks-table.html']]};

/* ---------- 7 ---------- */
L['mysql:9:7']={blocks:[
{p:'Good transactions are **small, short and repeatable**. The rules below prevent most locking and consistency problems in real applications.'},
{h:'Design rules'},
{ul:['**One business operation, one transaction.** Group the statements that must succeed together, and nothing else.','**No waiting inside a transaction.** Never hold one open while calling an API, sending email or waiting for a user. Do slow work before `BEGIN` or after `COMMIT`.','**Do the reads first, then the writes**, and take locks late and in a fixed order.','**Prefer atomic statements.** `UPDATE ... SET qty = qty - 1 WHERE qty > 0` beats read, compute, write.','**Keep transactions small.** Bulk work goes in batches of a few thousand rows with a commit in between.','**Use the right isolation level** for the job, and set it explicitly when the default does not suit.']},
{h:'Autocommit mistakes'},
{ul:['Autocommit **on** with a multi-statement operation: no atomicity.','Autocommit **off** in a connection pool: transactions stay open after a request ends, holding locks and snapshots. Make sure every code path commits or rolls back.','ORM frameworks may begin a transaction for you. Know when it ends.']},
{h:'Retry on transient errors'},
{t:[['Error','Meaning','Action'],
['1213','Deadlock victim','Roll back and retry the whole transaction'],
['1205','Lock wait timeout','Retry after review. Investigate the blocker'],
['2013, 2006','Connection lost','Reconnect. The transaction was rolled back. Retry if safe'],
['1062','Duplicate key','Business conflict. Do not blindly retry']]},
{h:'Idempotency'},
{p:'If a retry can repeat a successful write, for example after a timeout where the commit actually happened, use an **idempotency key**: a unique request id stored with the result. Repeating the insert fails on the unique key, and the application treats it as success.'},
{code:`INSERT INTO payments (request_id, order_id, amount) VALUES ('7c2b-...', 42, 99.00)
ON DUPLICATE KEY UPDATE request_id = request_id;    -- no change on a repeat`},
{h:'Large operations'},
{code:`-- delete or update in chunks, committing between them (stored procedure body or application loop)
REPEAT
  DELETE FROM events WHERE created_at < NOW() - INTERVAL 90 DAY LIMIT 5000;
UNTIL ROW_COUNT() = 0 END REPEAT;`},
{p:'Chunking keeps lock times short, limits undo growth, helps replicas keep up and lets other traffic through.'},
{h:'Observe your transactions'},
{code:`SELECT trx_id, trx_started, TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS age_s,
       trx_rows_locked, trx_rows_modified, trx_mysql_thread_id
FROM information_schema.innodb_trx ORDER BY trx_started;`},
{note:'Alert on a transaction older than a threshold (for example 60 seconds). Long transactions cause metadata lock pile-ups, undo growth and replication lag.'}],
src:[['Transaction management (InnoDB best practices)',K.D+'innodb-transaction-model.html'],['The InnoDB transaction model',K.D+'innodb-transaction-model.html']]};
})();
